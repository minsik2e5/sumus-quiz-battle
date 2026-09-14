import { readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';

const vocabPath = fileURLToPath(new URL('../data/vocabulary.json', import.meta.url));
const raw = readFileSync(vocabPath);
if (raw.length >= 2 && raw[0] === 0x1f && raw[1] === 0x8b) {
  writeFileSync(vocabPath, gunzipSync(raw));
}
await import('./index.mjs');
