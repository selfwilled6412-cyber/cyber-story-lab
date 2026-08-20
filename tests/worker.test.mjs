import worker from '../src/worker.js';
import assert from 'node:assert/strict';

const assetEnv = { ASSETS: { fetch: async () => new Response('asset', { status: 200 }) } };

{
  const res = await worker.fetch(new Request('https://example.test/api/health'), { ...assetEnv, AI_MODE: 'free' });
  const data = await res.json();
  assert.equal(res.status, 200);
  assert.equal(data.mode, 'free');
  assert.equal(data.externalAiEnabled, false);
  assert.equal(data.billingSafe, true);
}

{
  let called = false;
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => { called = true; throw new Error('should not call external fetch'); };
  try {
    const env = { ...assetEnv, AI_MODE: 'free', GEMINI_API_KEY: 'fake' };
    const res = await worker.fetch(new Request('https://example.test/api/story-help', { method: 'POST', body: '{}' }), env);
    const data = await res.json();
    assert.equal(res.status, 403);
    assert.equal(data.code, 'FREE_MODE');
    assert.equal(called, false);
  } finally { globalThis.fetch = realFetch; }
}

{
  let called = false;
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => { called = true; throw new Error('should not call external fetch'); };
  try {
    const env = { ...assetEnv, AI_MODE: 'free', GEMINI_API_KEY: 'fake' };
    const res = await worker.fetch(new Request('https://example.test/api/image-finish', { method: 'POST', body: '{}' }), env);
    const data = await res.json();
    assert.equal(res.status, 403);
    assert.equal(data.billingSafe, true);
    assert.equal(called, false);
  } finally { globalThis.fetch = realFetch; }
}

{
  const res = await worker.fetch(new Request('https://example.test/'), { ...assetEnv, AI_MODE: 'free' });
  assert.equal(res.status, 200);
  assert.equal(await res.text(), 'asset');
}

{
  const env = { ...assetEnv, AI_MODE: 'gemini' };
  const res = await worker.fetch(new Request('https://example.test/api/health'), env);
  const data = await res.json();
  assert.equal(data.externalAiEnabled, false);
  assert.equal(data.billingSafe, true);
}

{
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    assert.match(String(url), /generativelanguage\.googleapis\.com/);
    assert.equal(init.headers['x-goog-api-key'], 'fake');
    return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify({ items: ['a','b','c','d','e'] }) }] } }] }), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  try {
    const env = { ...assetEnv, AI_MODE: 'gemini', GEMINI_API_KEY: 'fake' };
    const req = new Request('https://example.test/api/story-help', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ mode: 'theme_examples' })
    });
    const res = await worker.fetch(req, env);
    const data = await res.json();
    assert.equal(res.status, 200);
    assert.deepEqual(data.items, ['a','b','c','d','e']);
  } finally { globalThis.fetch = realFetch; }
}

console.log('worker tests: 6/6 PASS');
