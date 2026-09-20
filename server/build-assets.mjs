import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';

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

const { runContentValidation } = await import('./content-validation.mjs');
runContentValidation();
console.log('[content-validation] PASS');


function publicJavaScriptFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = resolve(dir, entry.name);
    if (entry.isDirectory()) return publicJavaScriptFiles(full);
    return entry.isFile() && entry.name.endsWith('.js') ? [full] : [];
  });
}

for (const file of publicJavaScriptFiles(resolve(root, 'public'))) {
  try {
    execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });
  } catch (error) {
    const detail = String(error?.stderr || error?.stdout || error?.message || error);
    throw new Error('Browser JavaScript syntax check failed: ' + file.replace(root, '') + '\n' + detail);
  }
}
console.log('[browser-syntax] PASS');
