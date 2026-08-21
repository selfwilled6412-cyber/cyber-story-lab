import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const index = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
const robust = readFileSync(new URL('../public/robustness-v07.js', import.meta.url), 'utf8');
const freeCopy = readFileSync(new URL('../public/free-copy.js', import.meta.url), 'utf8');
const ux = readFileSync(new URL('../public/ux-v08.js', import.meta.url), 'utf8');
const uxCss = readFileSync(new URL('../public/ux-v08.css', import.meta.url), 'utf8');
const backup = readFileSync(new URL('../public/backup-v09.js', import.meta.url), 'utf8');
const wrangler = readFileSync(new URL('../wrangler.jsonc', import.meta.url), 'utf8');

assert.match(index, /FREE MODE • AI課金なし/);
assert.match(index, /外部AI：OFF/);
assert.match(index, /robustness-v07\.js/);
assert.doesNotMatch(index, /security\.js/);
assert.match(robust, /cyberStoryLabDraftDB/);
assert.match(robust, /第1巻を作る・印刷\/PDF/);
assert.match(robust, /images: \[null, null, null, null\]/);
assert.match(wrangler, /"AI_MODE": "free"/);
assert.match(freeCopy, /ux-v08\.js/);
assert.match(freeCopy, /ux-v08\.css/);
assert.match(freeCopy, /backup-v09\.js/);
assert.match(freeCopy, /backup-v09\.css/);
assert.match(ux, /自動保存/);
assert.match(ux, /4コマを1本作ってみよう/);
assert.match(ux, /外部AIへの送信なし・AI課金なし/);
assert.match(uxCss, /prefers-reduced-motion/);
assert.match(backup, /cyber-story-lab-backup-v1/);
assert.match(backup, /全作品を保存/);
assert.match(backup, /バックアップを戻す/);
assert.match(backup, /data:image/);

console.log('ui free-mode tests: 20/20 PASS');
