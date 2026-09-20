import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const partsDir = resolve(root, 'build_parts');
const stylesPath = resolve(root, 'public/styles.css');
const vocabPath = resolve(root, 'data/vocabulary.json');

if (!existsSync(stylesPath)) {
  const styles = ['styles.00', 'styles.01']
    .map(name => readFileSync(resolve(partsDir, name), 'utf8'))
    .join('');
  writeFileSync(stylesPath, styles);
}

if (!existsSync(vocabPath)) {
  mkdirSync(dirname(vocabPath), { recursive: true });
  const chunks = readdirSync(partsDir)
    .filter(name => /^vocab\..+\.b64$/.test(name))
    .sort();
  if (!chunks.length) throw new Error('Vocabulary build parts not found');
  const encoded = chunks
    .map(name => readFileSync(resolve(partsDir, name), 'utf8'))
    .join('')
    .replace(/\s+/g, '');
  writeFileSync(vocabPath, Buffer.from(encoded, 'base64'));
}

const raw = readFileSync(vocabPath);
if (raw.length >= 2 && raw[0] === 0x1f && raw[1] === 0x8b) {
  writeFileSync(vocabPath, gunzipSync(raw));
}

try {
  const { runContentValidation } = await import('./content-validation.mjs');
  runContentValidation();
  console.log('[content-validation] PASS');
} catch (error) {
  console.error('[content-validation] WARNING ·', error?.message || error);
}
