import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const index = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
const robust = readFileSync(new URL('../public/robustness-v07.js', import.meta.url), 'utf8');
const wrangler = readFileSync(new URL('../wrangler.jsonc', import.meta.url), 'utf8');

assert.match(index, /FREE MODE • AI課金なし/);
assert.match(index, /外部AI：OFF/);
assert.match(index, /robustness-v07\.js/);
assert.doesNotMatch(index, /security\.js/);
assert.match(robust, /cyberStoryLabDraftDB/);
assert.match(robust, /第1巻を作る・印刷\/PDF/);
assert.match(robust, /images: \[null, null, null, null\]/);
assert.match(wrangler, /"AI_MODE": "free"/);

console.log('ui free-mode tests: 8/8 PASS');
