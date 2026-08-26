const TEXT_MODEL_DEFAULT = 'gemini-3.1-flash-lite';
const IMAGE_MODEL_DEFAULT = 'gemini-3.1-flash-image';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const providerConfigured = isProviderConfigured(env);
    const externalAiEnabled = isExternalAiEnabled(env);

    if (url.pathname === '/api/health') {
      return json({
        ok: true,
        mode: externalAiEnabled ? 'gemini' : 'free',
        externalAiEnabled,
        reillustrationEnabled: externalAiEnabled,
        providerConfigured,
        billingSafe: !externalAiEnabled,
        aiConfigured: externalAiEnabled,
        pinRequired: providerConfigured,
        configurationIssue: providerConfigured && !env.AI_ACCESS_PIN ? 'PIN_NOT_CONFIGURED' : null
      });
    }

    if (url.pathname === '/api/story-help' && request.method === 'POST') {
      const disabled = aiDisabledResponse(env);
      if (disabled) return disabled;
      return storyHelp(request, env);
    }

    if (url.pathname === '/api/image-finish' && request.method === 'POST') {
      const disabled = aiDisabledResponse(env);
      if (disabled) return disabled;
      return imageFinish(request, env);
    }

    if (url.pathname === '/api/reillustrate' && request.method === 'POST') {
      const disabled = aiDisabledResponse(env);
      if (disabled) return disabled;
      return reillustrate(request, env);
    }

    return env.ASSETS.fetch(request);
  }
};

function isProviderConfigured(env) {
  return env.AI_MODE === 'gemini' && Boolean(env.GEMINI_API_KEY);
}

function isExternalAiEnabled(env) {
  return isProviderConfigured(env) && Boolean(env.AI_ACCESS_PIN);
}

function aiDisabledResponse(env) {
  if (!isProviderConfigured(env)) return freeModeResponse();
  if (!env.AI_ACCESS_PIN) return json({
    error: 'AI_ACCESS_PIN must be configured before external AI can be enabled',
    code: 'PIN_NOT_CONFIGURED',
    billingSafe: true
  }, 503);
  return null;
}

function freeModeResponse() {
  return json({
    error: 'External AI is disabled in FREE MODE',
    code: 'FREE_MODE',
    billingSafe: true
  }, 403);
}

async function storyHelp(request, env) {
  const authError = aiAuth(request, env);
  if (authError) return authError;

  let body;
  try { body = await request.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }
  const mode = body.mode;
  let prompt, schema;

  if (mode === 'theme_examples') {
    prompt = `あなたは4コマ漫画制作の補助AIです。作者はこのシステムを操作している本人です。AIは作者になってはいけません。\n役割: 物語を完成させず、考え始めるための「お題の入口」を5個だけ出す。\n条件: 各候補は短い一文。起承転結やオチを作らない。奇妙・不思議・意味不明な発想を歓迎する。簡単な日本語。\n現在の入力: ${safe(body.theme) || 'なし'}`;
    schema = itemsSchema(5);
  } else if (mode === 'story_hint') {
    prompt = `あなたは4コマ漫画制作の補助AI。作者本人の発想を奪わない。\n絶対ルール: ストーリー案、答え、完成文を作らない。質問だけを3個返す。奇妙な発想を普通に修正しない。\nお題: ${safe(body.theme)}\n主役: ${safe(body.hero)}\nこれまでの4コマ: ${JSON.stringify(body.story || [])}\n今考えているのは${Number(body.index) + 1}コマ目。本人が自分で続きを考えやすくなる短い質問を3個。`;
    schema = itemsSchema(3);
  } else if (mode === 'draw_instructions') {
    prompt = `あなたは作画アシスタント。ストーリーを作り足してはいけない。作者が決めた4コマ文章を、A4用紙にラフを描くための指示へ変換する。\n重要: 文章にない事件・登場物・オチを追加しない。奇妙な内容を常識的に直さない。上手な絵を要求しない。丸・線・矢印・文字メモで表せる程度にする。各コマ1〜2文、簡単な日本語。\nお題: ${safe(body.theme)}\n主役: ${safe(body.hero)}\n4コマ: ${JSON.stringify(body.story || [])}\n4つのラフ指示を順番どおり返す。`;
    schema = itemsSchema(4);
  } else {
    return json({ error: 'Unknown mode' }, 400);
  }

  try {
    const result = await geminiText(env, prompt, schema);
    return json(result);
  } catch (error) {
    return json({ error: error?.message || 'AI request failed' }, 502);
  }
}

async function imageFinish(request, env) {
  const authError = aiAuth(request, env);
  if (authError) return authError;

  let body;
  try { body = await request.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }
  const parsed = parseDataUrl(body.imageDataUrl);
  if (!parsed) return json({ error: 'Invalid imageDataUrl' }, 400);
  if (parsed.data.length > 16_000_000) return json({ error: 'Image is too large' }, 413);

  const prompt = `この画像は作者本人がA4用紙に描いた4コマ漫画の原画です。あなたは作画アシスタントです。\n最優先ルール:\n- 原画の構図、位置関係、キャラクターの独特な形、線、奇妙さ、作者の癖を尊重する。\n- 「上手な普通の絵」に作り替えない。\n- 原画に存在しない重要な登場人物や事件を追加しない。\n- 主役の個性を別の一般的キャラクターへ置き換えない。\n- 手描き感を残したまま、線を見やすくし、必要に応じて自然な着色と背景整理を行う。\n- 画像内に文章・字幕・吹き出し文字を追加しない（文字は後でシステムが入れる）。\nこのコマの文章: ${safe(body.story)}\n主役: ${safe(body.hero)}\n作画指示: ${safe(body.drawGuide)}\n原画を尊重した完成用イラストとして仕上げる。`;

  return generateGeminiImage(env, [
    { text: prompt },
    imagePart(parsed)
  ]);
}

async function reillustrate(request, env) {
  const authError = aiAuth(request, env);
  if (authError) return authError;

  let body;
  try { body = await request.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }
  const mode = body.mode;
  const style = visualStylePrompt(body.visualStyle);

  if (mode === 'character') {
    const rough = body.roughImageDataUrl ? parseDataUrl(body.roughImageDataUrl) : null;
    if (body.roughImageDataUrl && !rough) return json({ error: 'Invalid roughImageDataUrl' }, 400);
    if (rough && rough.data.length > 12_000_000) return json({ error: 'Character rough is too large' }, 413);

    const prompt = `あなたは絵本のキャラクターデザイナーです。作者本人が決めた主役を、今後のページで同じ姿に保つための「主人公見本」を1枚作ります。\n\nこれは作者の発想を直す仕事ではありません。次のルールを厳守してください。\n- 作者が書いた奇妙な特徴、目の数、手足の数、色、形、大きさのアンバランスを勝手に一般的な姿へ直さない。\n- 参考ラフがある場合は、ラフを清書・補正するのではなく、特徴を読み取って一から新しい絵本イラストとして描く。\n- 主役を1体、全身または姿が十分分かる大きさで描く。\n- 背景はごく簡単な無地または淡い背景。文字、名前、説明文、吹き出しは描かない。\n- 後の4ページで同じ顔・色・服・特徴を再現しやすい、明確な見本にする。\n\n主役: ${safe(body.hero)}\n作者が決めた特徴: ${safe(body.characterBrief)}\n仕上げの画風: ${style}`;
    const parts = [{ text: prompt }];
    if (rough) parts.push({ text: '\n[参考画像] 作者本人の主人公ラフ。形と特徴の参考にする。' }, imagePart(rough));
    return generateGeminiImage(env, parts);
  }

  if (mode === 'panel') {
    const rough = parseDataUrl(body.roughImageDataUrl);
    if (!rough) return json({ error: 'roughImageDataUrl is required' }, 400);
    if (rough.data.length > 12_000_000) return json({ error: 'Rough image is too large' }, 413);
    const characterReference = body.characterReferenceDataUrl ? parseDataUrl(body.characterReferenceDataUrl) : null;
    if (body.characterReferenceDataUrl && !characterReference) return json({ error: 'Invalid characterReferenceDataUrl' }, 400);
    if (characterReference && characterReference.data.length > 12_000_000) return json({ error: 'Character reference is too large' }, 413);

    const panelNo = Math.max(1, Math.min(4, Number(body.panelIndex) + 1 || 1));
    const prompt = `あなたは絵本の作画担当です。作者本人のラフを「設計図」として読み取り、完成イラストを一から描き直してください。ラフの線を清書・補正する作業ではありません。\n\n【作者性を守る最優先ルール】\n1. ラフにある主役・物・人数・位置関係・向き・大きさ・変な形をできる限り維持する。\n2. 目が多い、手足が変、巨大、左右非対称などの奇妙な特徴を「正しい普通の姿」に直さない。\n3. 作者が決めていない新しい事件、重要人物、重要な物を勝手に追加しない。背景は場面を理解する最低限にする。\n4. 参考の主人公画像がある場合、その顔・色・服・体型・固有特徴を同じキャラクターとして維持する。ただしポーズと位置はラフを優先する。\n5. 画像内に文章、字幕、吹き出し文字、タイトル、ロゴを描かない。文章は後でシステムが配置する。\n6. 完成絵はラフと見比べて「自分のラフがこんな絵になった」と作者が分かる構図にする。\n\n${panelNo}コマ目の文章: ${safe(body.story)}\n主役: ${safe(body.hero)}\n主人公の固定特徴: ${safe(body.characterBrief)}\nラフ作画ヒント: ${safe(body.drawGuide)}\n作者からの修正指示: ${safe(body.correctionNote) || 'なし'}\n仕上げの画風: ${style}\n\n[画像1] 作者本人のこのコマのラフ。構図・位置・ポーズ・物の関係の設計図。`;
    const parts = [{ text: prompt }, imagePart(rough)];
    if (characterReference) parts.push({ text: '\n[画像2] 主人公の見本。キャラクターの見た目を統一するためだけに使用する。' }, imagePart(characterReference));
    return generateGeminiImage(env, parts);
  }

  return json({ error: 'Unknown reillustration mode' }, 400);
}

async function generateGeminiImage(env, parts) {
  const model = env.GEMINI_IMAGE_MODEL || IMAGE_MODEL_DEFAULT;
  const api = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  const payload = {
    contents: [{ parts }],
    generationConfig: { responseModalities: ['Image'] }
  };

  const response = await fetch(api, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
    body: JSON.stringify(payload)
  });
  const data = await response.json();
  if (!response.ok) return json({ error: extractApiError(data) }, response.status);

  const responseParts = data?.candidates?.[0]?.content?.parts || [];
  const imageResponsePart = responseParts.find(p => p.inlineData?.data || p.inline_data?.data);
  const inline = imageResponsePart?.inlineData || imageResponsePart?.inline_data;
  if (!inline?.data) return json({ error: 'Gemini returned no image' }, 502);
  return json({
    imageDataUrl: `data:${inline.mimeType || inline.mime_type || 'image/png'};base64,${inline.data}`,
    model
  });
}

async function geminiText(env, prompt, schema) {
  const model = env.GEMINI_TEXT_MODEL || TEXT_MODEL_DEFAULT;
  const api = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  const payload = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      responseFormat: { text: { mimeType: 'application/json', schema } },
      temperature: 0.8
    }
  };

  const response = await fetch(api, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
    body: JSON.stringify(payload)
  });
  const data = await response.json();
  if (!response.ok) throw new Error(extractApiError(data));
  const text = data?.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('') || '';
  try { return JSON.parse(text); } catch { throw new Error('AI response was not valid JSON'); }
}

function aiAuth(request, env) {
  if (!env.AI_ACCESS_PIN) return json({ error: 'AI access PIN is not configured', code: 'PIN_NOT_CONFIGURED' }, 503);
  const pin = request.headers.get('x-ai-pin') || '';
  return pin === env.AI_ACCESS_PIN ? null : json({ error: 'AI access PIN required', code: 'PIN_REQUIRED' }, 401);
}

function itemsSchema(count) {
  return {
    type: 'object',
    properties: { items: { type: 'array', minItems: count, maxItems: count, items: { type: 'string' } } },
    required: ['items']
  };
}

function visualStylePrompt(value) {
  return {
    watercolor: 'やわらかな水彩絵本。紙の質感、自然な色むら、親しみやすい形。',
    pop: '明るく大胆なポップ絵本。はっきりした形、楽しい配色、子どもが見やすい画面。',
    crayon: 'クレヨンと色鉛筆で描いたような温かい絵本。手仕事感のある質感。',
    picturebook: 'やさしく親しみやすい現代の絵本イラスト。見やすい形と色、温かい質感。'
  }[String(value || '')] || 'やさしく親しみやすい現代の絵本イラスト。';
}

function imagePart(parsed) {
  return { inline_data: { mime_type: parsed.mime, data: parsed.data } };
}

function parseDataUrl(value) {
  const match = String(value || '').match(/^data:(image\/(?:png|jpe?g|webp));base64,(.+)$/is);
  return match ? { mime: match[1].toLowerCase(), data: match[2] } : null;
}
function safe(value) { return String(value ?? '').slice(0, 4000); }
function extractApiError(data) { return data?.error?.message || data?.message || 'Gemini API request failed'; }
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }
  });
}
