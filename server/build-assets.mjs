import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const partsDir = resolve(root, 'build_parts');
const stylesPath = resolve(root, 'public/styles.css');
const vocabPath = resolve(root, 'data/vocabulary.json');
const cssSources = [
  "styles.css",
  "student-learning.css",
  "teacher-dashboard-v136.css",
  "v137.css",
  "v138.css",
  "v139.css",
  "v1310.css",
  "v1311.css",
  "v1313.css",
  "v1315.css",
  "v1317.css",
  "v1320.css",
  "v1321.css",
  "v1322.css",
  "v1323.css",
  "v1324.css",
  "v1325.css",
  "v1326.css",
  "v1327.css",
  "v1328.css",
  "v1329.css",
  "v1330.css",
  "v1332.css",
  "v1334.css",
  "v1337.css",
  "v1339.css",
  "v1340.css",
  "v1341.css"
];
const cssBundlePath = resolve(root, 'public/app.bundle.css');


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

const cssBundle = cssSources
  .map(name => readFileSync(resolve(root, 'public', name), 'utf8'))
  .join('\n');
writeFileSync(cssBundlePath, cssBundle);

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
