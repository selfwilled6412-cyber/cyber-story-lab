const TEXT_MODEL_DEFAULT = 'gemini-3.1-flash-lite';
const IMAGE_MODEL_DEFAULT = 'gemini-3.1-flash-lite-image';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const externalAiEnabled = isExternalAiEnabled(env);

    if (url.pathname === '/api/health') {
      return json({
        ok: true,
        mode: externalAiEnabled ? 'gemini' : 'free',
        externalAiEnabled,
        billingSafe: !externalAiEnabled,
        aiConfigured: externalAiEnabled,
        pinRequired: externalAiEnabled && Boolean(env.AI_ACCESS_PIN)
      });
    }

    if (url.pathname === '/api/story-help' && request.method === 'POST') {
      if (!externalAiEnabled) return freeModeResponse();
      return storyHelp(request, env);
    }

    if (url.pathname === '/api/image-finish' && request.method === 'POST') {
      if (!externalAiEnabled) return freeModeResponse();
      return imageFinish(request, env);
    }

    return env.ASSETS.fetch(request);
  }
};

function isExternalAiEnabled(env) {
  return env.AI_MODE === 'gemini' && Boolean(env.GEMINI_API_KEY);
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
    prompt = `あなたは作画アシスタント。ストーリーを作り足してはいけない。作者が決めた4コマ文章を、A4用紙に絵を描くための指示へ変換する。\n重要: 文章にない事件・登場物・オチを追加しない。奇妙な内容を常識的に直さない。絵の上手さを要求しない。各コマ1〜2文、簡単な日本語。\nお題: ${safe(body.theme)}\n主役: ${safe(body.hero)}\n4コマ: ${JSON.stringify(body.story || [])}\n4つの作画指示を順番どおり返す。`;
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

  const model = env.GEMINI_IMAGE_MODEL || IMAGE_MODEL_DEFAULT;
  const api = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  const payload = {
    contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: parsed.mime, data: parsed.data } }] }],
    generationConfig: { responseModalities: ['Image'] }
  };

  const response = await fetch(api, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
    body: JSON.stringify(payload)
  });
  const data = await response.json();
  if (!response.ok) return json({ error: extractApiError(data) }, response.status);

  const parts = data?.candidates?.[0]?.content?.parts || [];
  const imagePart = parts.find(p => p.inlineData?.data || p.inline_data?.data);
  const inline = imagePart?.inlineData || imagePart?.inline_data;
  if (!inline?.data) return json({ error: 'Gemini returned no image' }, 502);
  return json({ imageDataUrl: `data:${inline.mimeType || inline.mime_type || 'image/png'};base64,${inline.data}` });
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
  if (!env.AI_ACCESS_PIN) return null;
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

function parseDataUrl(value) {
  const match = String(value || '').match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/s);
  return match ? { mime: match[1], data: match[2] } : null;
}
function safe(value) { return String(value ?? '').slice(0, 4000); }
function extractApiError(data) { return data?.error?.message || data?.message || 'Gemini API request failed'; }
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }
  });
}
