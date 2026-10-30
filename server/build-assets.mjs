import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';

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
  "v1341.css",
  "v1344.css",
  "v1345.css",
  "v1353.css",
  "v1354.css",
  "v1358.css",
  "v1359.css",
  "v1360.css",
  "v1361.css",
  "v1362.css",
  "v1363.css",
  "v1364.css",
  "v1365.css",
  "v1366.css",
  "v1367.css",
  "v1368.css",
  "v1369.css",
  "v1370.css",
  "v1371.css",
  "v1372.css",
  "v1373.css",
  "v1374.css",
  "v1375.css",
  "v1376.css",
  "v1377.css",
  "v1378.css",
  "v1380.css",
  "v1382.css",
  "v1385.css",
  "v1386.css",
  "v13861.css",
  "v1388.css",
  "v1389.css",
  "v1390.css",
  "v1391.css",
  "v1392.css",
  "v1394.css",
  "v1395.css",
  "v1396.css",
  "v1398.css",
  "v13101.css",
  "v13104.css",
  "v13105.css",
  "v13105fx.css",
  "v13107.css",
  "v13108.css",
  "v13109.css",
  "v13111.css",
  "v13112.css",
  "v13113.css",
  "v13118.css",
  "v13119.css",
  "v13123.css",
  "v13124.css",
  "v13125.css",
  "v13127.css",
  "v13128.css",
  "v13130.css",
  "v13132.css",
  "v13133.css",
  "v13141.css",
  "v13142.css",
  "v13143.css",
  "v13144.css",
  "v13146.css",
  "v13149.css",
  "v13150.css",
  "v13151.css",
  "v13152.css",
  "v13154.css",
  "v13158.css",
  "v13159.css",
  "v13162.css",
  "v13166.css",
  "v13168.css",
  "v13173.css",
  "v13174.css",
  "v13177.css",
  "v13180.css",
  "v13181.css",
  "v13182.css",
  "v13190.css",
  "v13192.css",
  "v13191.css",
  "v13194.css",
  "v13195.css",
  "v13196.css",
  "v13198.css",
  "v13185.css",
  "v13184.css",
  "v13178.css"
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

// V13.166 몬스터 사냥 장소 몬스터는 그림(기본 · 공격 · 맞음)이 다 들어온 것만 지도에 나온다.
// 그림 폴더를 보고 public/modules/monster-art.js를 만든다: 그림을 넣고 build:assets를 돌리면 자동으로 나온다.
{
  const dir = resolve(root, 'public/assets/monsters');
  const files = new Set(readdirSync(dir));
  const keys = [...files].map(f => f.match(/^([a-z0-9]+)\.webp$/)?.[1]).filter(Boolean)
    .filter(k => files.has(`${k}-attack.webp`) && files.has(`${k}-hurt.webp`)).sort();
  const out = resolve(root, 'public/modules/monster-art.js');
  const text = `// 만든 곳: server/build-assets.mjs (손으로 고치지 않는다). 기본 · 공격 · 맞음 그림이 다 있는 몬스터.\nexport const MONSTER_ART = new Set(${JSON.stringify(keys)});\n`;
  if (!existsSync(out) || readFileSync(out, 'utf8') !== text) writeFileSync(out, text);
  console.log(`[monster-art] ${keys.length} monsters with art`);
}

// V13.168 그림 폴더를 보고 public/modules/pet-art.js를 만든다(새 펫은 그림이 다 들어와야 알 · 도감 등에 나온다, core.js petReady).
// PET_ART: 단계 0~3 기본 · 작은 그림(-s), 알 반응(happy · eat), 단계 1~3 표정(happy · eat · sad · cheer)이 다 있는 펫.
// PET_FIGHT: 단계 1~3 야차전 공격 · 맞음(attack · hurt)이 다 있는 펫. PET_REVEAL: 신화 등장 포즈(pets/<key>-reveal)와 등장 배경(reveal/bg-<key>)이 있는 펫.
{
  const files = new Set(readdirSync(resolve(root, 'public/assets/pets')));
  const reveal = new Set(readdirSync(resolve(root, 'public/assets/reveal')));
  const has = name => files.has(`${name}.webp`);
  const all = [...new Set([...files].map(f => f.match(/^([a-z]+)-0\.webp$/)?.[1]).filter(Boolean))].sort();
  const art = all.filter(k => [0, 1, 2, 3].every(f => has(`${k}-${f}`) && has(`${k}-${f}-s`) && (f ? ['happy', 'eat', 'sad', 'cheer'] : ['happy', 'eat']).every(e => has(`${k}-${f}-${e}`))));
  const fight = all.filter(k => [1, 2, 3].every(f => has(`${k}-${f}-attack`) && has(`${k}-${f}-hurt`)));
  const shows = all.filter(k => has(`${k}-reveal`) && reveal.has(`bg-${k}.webp`));
  const titles = readdirSync(resolve(root, 'public/assets/titles'));
  const medals = ['zodiac12'].filter(k => titles.includes(`${k}.webp`) && titles.includes(`${k}-s.webp`));
  const out = resolve(root, 'public/modules/pet-art.js');
  const text = `// 만든 곳: server/build-assets.mjs (손으로 고치지 않는다). 그림 폴더(public/assets/pets · reveal)에 그림이 다 있는 펫.\nexport const PET_ART = new Set(${JSON.stringify(art)});\nexport const PET_FIGHT = new Set(${JSON.stringify(fight)});\nexport const PET_REVEAL = new Set(${JSON.stringify(shows)});\n// V13.168 칭호 '12지 수호자' 메달(titles/zodiac12 · -s).\nexport const PET_TITLE_ART = new Set(${JSON.stringify(medals)});\n`;
  if (!existsSync(out) || readFileSync(out, 'utf8') !== text) writeFileSync(out, text);
  console.log(`[pet-art] ${art.length} pets with art, ${fight.length} with battle poses, ${shows.length} with a reveal`);
}

// V13.180 인형뽑기 그림 게이트: 그림 폴더(public/assets/claw)를 보고 public/modules/claw-art.js를 만든다.
// CLAW_DOLLS: 네 자세(doll-<key> · -grab · -fall · -joy)가 다 있는 인형. CLAW_ART: 그 밖의 그림 이름(기계 · 집게 · UI · 배경 · 도감 · 효과).
// 인형뽑기는 기계 · 집게 그림과 인형 6종 이상이 있어야 열린다(claw-rules.js clawOpen).
{
  const dir = resolve(root, 'public/assets/claw');
  const files = existsSync(dir) ? new Set(readdirSync(dir).filter(f => f.endsWith('.webp')).map(f => f.slice(0, -5))) : new Set();
  const dolls = [...new Set([...files].map(f => f.match(/^doll-([a-z]+)$/)?.[1]).filter(Boolean))]
    .filter(k => ['', '-grab', '-fall', '-joy'].every(p => files.has(`doll-${k}${p}`))).sort();
  const art = [...files].filter(f => !f.startsWith('doll-') && !f.startsWith('preview')).sort();
  const out = resolve(root, 'public/modules/claw-art.js');
  const text = `// 만든 곳: server/build-assets.mjs (손으로 고치지 않는다). 그림 폴더(public/assets/claw)에 있는 인형뽑기 그림.\nexport const CLAW_DOLLS = new Set(${JSON.stringify(dolls)});\nexport const CLAW_ART = new Set(${JSON.stringify(art)});\n`;
  if (!existsSync(out) || readFileSync(out, 'utf8') !== text) writeFileSync(out, text);
  console.log(`[claw-art] ${dolls.length} dolls, ${art.length} pictures`);
}

// V13.185 물고기 그림 게이트: 그림 폴더(public/assets/fish)를 보고 public/modules/fish-art.js를 만든다.
// FISH_READY: 세 그림(<key> · <key>-hang · <key>-hang-s)이 다 있는 물고기. 심해 물고기(그림 주문서 53)는 여기 있어야 낚시터에 나온다.
{
  const dir = resolve(root, 'public/assets/fish');
  const files = new Set(readdirSync(dir).filter(f => f.endsWith('.webp')).map(f => f.slice(0, -5)));
  const keys = [...files].filter(k => /^[a-z]+$/.test(k) && files.has(`${k}-hang`) && files.has(`${k}-hang-s`)).sort();
  const out = resolve(root, 'public/modules/fish-art.js');
  const text = `// 만든 곳: server/build-assets.mjs (손으로 고치지 않는다). 그림 폴더(public/assets/fish)에 세 그림(본그림 · -hang · -hang-s)이 다 있는 물고기.\nexport const FISH_READY = new Set(${JSON.stringify(keys)});\n`;
  if (!existsSync(out) || readFileSync(out, 'utf8') !== text) writeFileSync(out, text);
  console.log(`[fish-art] ${keys.length} fish with art`);
}

// Service worker: precache list + a hash of every served file. Any change to
// the app changes sw.js, so installed apps pick up each deploy even when no
// version string was bumped by hand.
{
  const publicDir = resolve(root, 'public');
  const walk = dir => readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = resolve(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
  const urlOf = full => '/' + full.slice(publicDir.length + 1).split(/[\\/]/).join('/');
  const legacyCss = new Set(cssSources.map(name => '/' + name));
  const served = walk(publicDir)
    .map(full => ({ full, url: urlOf(full) }))
    .filter(({ url }) => /\.(?:js|mjs|css|html|svg|webp|png|webmanifest|mp3)$/.test(url) && url !== '/sw.js' && !legacyCss.has(url))
    .sort((a, b) => a.url.localeCompare(b.url));
  const hash = createHash('sha256');
  for (const { full, url } of served) hash.update(url).update('\0').update(readFileSync(full)).update('\0');
  // Loaded on every start; teacher tools, grammar data and pet images are cached on first
  // use. Images still count toward ASSET_HASH, so a redrawn pet reaches installed apps.
  // V13.77: the install guide, its QR code and the PNG icons are also only fetched when used.
  const onDemand = /^\/(?:(?:teacher-enhancements|exam-ops|grammar-choice-sample|blank-writing|[a-z-]+-grammar-data|[a-z-]+-blank-data|install)\.js|install\.html|vendor\/.+|icons\/.+\.png|assets\/.+\.(?:webp|mp3))$/;
  // The page is cached as "/": Cloudflare answers /index.html with a 307 to /,
  // and a redirected response cannot be used to answer a navigation.
  const precache = served.map(({ url }) => url === '/index.html' ? '/' : url).filter(url => !onDemand.test(url));
  const swPath = resolve(publicDir, 'sw.js');
  const sw = readFileSync(swPath, 'utf8');
  const generated = `// BUILD:START (generated by server/build-assets.mjs, do not edit by hand)\nconst ASSET_HASH = '${hash.digest('hex').slice(0, 16)}';\nconst PRECACHE = ${JSON.stringify(precache)};\n// BUILD:END`;
  const next = sw.replace(/\/\/ BUILD:START[\s\S]*?\/\/ BUILD:END/, generated);
  if (next === sw && !sw.includes(generated)) throw new Error('sw.js BUILD markers not found');
  if (next !== sw) writeFileSync(swPath, next);
  console.log(`[service-worker] ${precache.length} precached files, hash ${generated.match(/ASSET_HASH = '(\w+)'/)[1]}`);
}

const validateBuild = process.env.NODE_ENV !== 'production' || process.env.RUN_BUILD_VALIDATION === 'true';
if (validateBuild) {
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
} else {
  console.log('[build-assets] production runtime validation skipped; CI already validates release assets');
}
