import worker from '../src/worker.js';
import assert from 'node:assert/strict';

const assetEnv = { ASSETS: { fetch: async () => new Response('asset', { status: 200 }) } };

{
  const res = await worker.fetch(new Request('https://example.test/api/health'), { ...assetEnv, AI_MODE: 'free' });
  const data = await res.json();
  assert.equal(res.status, 200);
  assert.equal(data.mode, 'free');
  assert.equal(data.externalAiEnabled, false);
  assert.equal(data.reillustrationEnabled, false);
  assert.equal(data.billingSafe, true);
}

{
  let called = false;
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => { called = true; throw new Error('should not call external fetch'); };
  try {
    const env = { ...assetEnv, AI_MODE: 'free', GEMINI_API_KEY: 'fake' };
    const res = await worker.fetch(new Request('https://example.test/api/reillustrate', { method: 'POST', body: '{}' }), env);
    const data = await res.json();
    assert.equal(res.status, 403);
    assert.equal(data.code, 'FREE_MODE');
    assert.equal(data.billingSafe, true);
    assert.equal(called, false);
  } finally { globalThis.fetch = realFetch; }
}

{
  const env = { ...assetEnv, AI_MODE: 'gemini', GEMINI_API_KEY: 'fake' };
  const res = await worker.fetch(new Request('https://example.test/api/health'), env);
  const data = await res.json();
  assert.equal(data.providerConfigured, true);
  assert.equal(data.externalAiEnabled, false);
  assert.equal(data.configurationIssue, 'PIN_NOT_CONFIGURED');
  assert.equal(data.billingSafe, true);
}

{
  const env = { ...assetEnv, AI_MODE: 'gemini', GEMINI_API_KEY: 'fake' };
  const res = await worker.fetch(new Request('https://example.test/api/story-help', { method: 'POST', body: '{}' }), env);
  const data = await res.json();
  assert.equal(res.status, 503);
  assert.equal(data.code, 'PIN_NOT_CONFIGURED');
}

{
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    assert.match(String(url), /generativelanguage\.googleapis\.com/);
    assert.equal(init.headers['x-goog-api-key'], 'fake');
    return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify({ items: ['a','b','c','d','e'] }) }] } }] }), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  try {
    const env = { ...assetEnv, AI_MODE: 'gemini', GEMINI_API_KEY: 'fake', AI_ACCESS_PIN: '2468' };
    const req = new Request('https://example.test/api/story-help', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-ai-pin': '2468' },
      body: JSON.stringify({ mode: 'theme_examples' })
    });
    const res = await worker.fetch(req, env);
    const data = await res.json();
    assert.equal(res.status, 200);
    assert.deepEqual(data.items, ['a','b','c','d','e']);
  } finally { globalThis.fetch = realFetch; }
}

{
  let inspectedPayload;
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    assert.match(String(url), /gemini-3\.1-flash-image/);
    assert.equal(init.headers['x-goog-api-key'], 'fake');
    inspectedPayload = JSON.parse(init.body);
    return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ inlineData: { mimeType: 'image/png', data: 'ZmFrZS1pbWFnZQ==' } }] } }] }), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  try {
    const env = { ...assetEnv, AI_MODE: 'gemini', GEMINI_API_KEY: 'fake', AI_ACCESS_PIN: '2468' };
    const req = new Request('https://example.test/api/reillustrate', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-ai-pin': '2468' },
      body: JSON.stringify({
        mode: 'panel',
        roughImageDataUrl: 'data:image/png;base64,cm91Z2g=',
        characterReferenceDataUrl: 'data:image/png;base64,Y2hhcg==',
        hero: '目が3つの青い丸',
        characterBrief: '青い丸、目が3つ、黄色い帽子',
        story: '月からラーメンが落ちる',
        panelIndex: 1,
        visualStyle: 'picturebook'
      })
    });
    const res = await worker.fetch(req, env);
    const data = await res.json();
    assert.equal(res.status, 200);
    assert.match(data.imageDataUrl, /^data:image\/png;base64,/);
    assert.equal(inspectedPayload.contents[0].parts.filter(part => part.inline_data).length, 2);
    assert.match(inspectedPayload.contents[0].parts[0].text, /一から描き直/);
    assert.match(inspectedPayload.contents[0].parts[0].text, /奇妙な特徴/);
  } finally { globalThis.fetch = realFetch; }
}

{
  const env = { ...assetEnv, AI_MODE: 'gemini', GEMINI_API_KEY: 'fake', AI_ACCESS_PIN: '2468' };
  const req = new Request('https://example.test/api/reillustrate', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-ai-pin': 'wrong' },
    body: JSON.stringify({ mode: 'character', hero: '青い丸' })
  });
  const res = await worker.fetch(req, env);
  const data = await res.json();
  assert.equal(res.status, 401);
  assert.equal(data.code, 'PIN_REQUIRED');
}

{
  const res = await worker.fetch(new Request('https://example.test/'), { ...assetEnv, AI_MODE: 'free' });
  assert.equal(res.status, 200);
  assert.equal(await res.text(), 'asset');
}

console.log('worker tests: 8/8 PASS');
