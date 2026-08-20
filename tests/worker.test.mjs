import worker from '../src/worker.js';
import assert from 'node:assert/strict';

const assetEnv = { ASSETS: { fetch: async () => new Response('asset', { status: 200 }) } };

{
  const res = await worker.fetch(new Request('https://example.test/api/health'), assetEnv);
  const data = await res.json();
  assert.equal(res.status, 200);
  assert.equal(data.aiConfigured, false);
  assert.equal(data.pinRequired, false);
}

{
  const res = await worker.fetch(
    new Request('https://example.test/api/story-help', {
      method: 'POST',
      body: '{}',
      headers: { 'content-type': 'application/json' }
    }),
    assetEnv
  );
  assert.equal(res.status, 503);
}

{
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    assert.match(String(url), /generativelanguage\.googleapis\.com/);
    assert.equal(init.headers['x-goog-api-key'], 'fake');
    const body = JSON.parse(init.body);
    assert.equal(body.generationConfig.responseFormat.text.mimeType, 'application/json');
    assert.equal(body.generationConfig.responseFormat.text.schema.type, 'object');
    assert.equal(body.generationConfig.responseFormat.text.schema.properties.items.type, 'array');
    return new Response(
      JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify({ items: ['a', 'b', 'c', 'd', 'e'] }) }] } }] }),
      { status: 200, headers: { 'content-type': 'application/json' } }
    );
  };
  try {
    const env = { ...assetEnv, GEMINI_API_KEY: 'fake' };
    const req = new Request('https://example.test/api/story-help', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ mode: 'theme_examples' })
    });
    const res = await worker.fetch(req, env);
    const data = await res.json();
    assert.equal(res.status, 200);
    assert.deepEqual(data.items, ['a', 'b', 'c', 'd', 'e']);
  } finally {
    globalThis.fetch = realFetch;
  }
}

{
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(
    JSON.stringify({ candidates: [{ content: { parts: [{ inlineData: { mimeType: 'image/png', data: 'YWJj' } }] } }] }),
    { status: 200, headers: { 'content-type': 'application/json' } }
  );
  try {
    const env = { ...assetEnv, GEMINI_API_KEY: 'fake' };
    const req = new Request('https://example.test/api/image-finish', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ imageDataUrl: 'data:image/jpeg;base64,YWJj', story: '変な話', hero: '丸' })
    });
    const res = await worker.fetch(req, env);
    const data = await res.json();
    assert.equal(res.status, 200);
    assert.equal(data.imageDataUrl, 'data:image/png;base64,YWJj');
  } finally {
    globalThis.fetch = realFetch;
  }
}

{
  const env = { ...assetEnv, GEMINI_API_KEY: 'fake', AI_ACCESS_PIN: '2468' };
  const req = new Request('https://example.test/api/story-help', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ mode: 'theme_examples' })
  });
  const res = await worker.fetch(req, env);
  const data = await res.json();
  assert.equal(res.status, 401);
  assert.equal(data.code, 'PIN_REQUIRED');
}

console.log('worker tests: 5/5 PASS');
