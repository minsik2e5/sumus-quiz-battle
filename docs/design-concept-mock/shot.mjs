// 시안 스크린샷: node docs/design-concept-mock/shot.mjs [--only a-street] [--before 폴더] [--scale 1]
// - 각 시안 HTML의 폰 3개(홈 · 공부 · 야차전)를 찍어 docs/screenshots/design-concept/<시안>.jpg 로 붙인다.
// - --before 폴더에 "지금" 화면(s-home-390.png, s-quick-practice-390.png, s-yacha-battle-390.png)이 있으면
//   compare-<시안>.jpg (위: 지금, 아래: 시안)도 만든다. 지금 화면은 docs/app-audit.mjs --shots 로 찍는다(테스트 데이터 로컬 서버).
// - 주소에 ?still 을 붙여 움직임이 끝난 화면을 찍는다. playwright는 저장소 의존성이 아니다(PLAYWRIGHT=경로).
import { createRequire } from 'node:module';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../..');
const require = createRequire(import.meta.url);
const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i > 0 ? process.argv[i + 1] : d; };
const pw = [process.env.PLAYWRIGHT, 'playwright', '/opt/node-tools/node_modules/playwright'].filter(Boolean).map(n => { try { return require(n); } catch { return null; } }).find(Boolean);
if (!pw) throw Error('playwright를 찾지 못했어요. PLAYWRIGHT=경로');
const OUT = resolve(root, 'docs/screenshots/design-concept');
const ONLY = arg('only', '');
const BEFORE = arg('before', '');
const SCALE = Number(arg('scale', 1));
const MOCKS = ['a-street', 'b-cobalt', 'c-archive'].filter(m => !ONLY || ONLY.split(',').includes(m));
const SCREENS = ['home', 'study', 'yacha'];
const NOW = { home: 's-home-390.png', study: 's-quick-practice-390.png', yacha: 's-yacha-battle-390.png' };

await mkdir(OUT, { recursive: true });
const browser = await pw.chromium.launch();
const page = await browser.newPage({ viewport: { width: 1320, height: 1000 }, deviceScaleFactor: SCALE });
const strip = async (title, rows) => {
  // rows: [{ label, imgs: [dataURL] }]
  const html = `<body style="margin:0;background:#111;font-family:sans-serif;color:#eee;padding:14px">
  <div style="font-size:18px;font-weight:700;margin:0 0 10px">${title}</div>
  ${rows.map(r => `<div style="display:flex;gap:12px;align-items:flex-start;margin-bottom:14px"><div style="width:54px;font-size:15px;font-weight:700;padding-top:6px">${r.label}</div>${r.imgs.map(s => `<img src="${s}" style="width:240px;height:519px;object-fit:cover;object-position:top;border-radius:14px">`).join('')}</div>`).join('')}</body>`;
  const p = await browser.newPage({ viewport: { width: 66 + 3 * 252 + 14, height: 200 }, deviceScaleFactor: SCALE });
  await p.setContent(html); await p.waitForTimeout(200);
  const buf = await p.screenshot({ type: 'jpeg', quality: 72, fullPage: true }); await p.close(); return buf;
};
const { writeFile, readFile } = await import('node:fs/promises');
for (const m of MOCKS) {
  await page.goto(pathToFileURL(resolve(here, `${m}.html`)).href + '?still');
  await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(400);
  const shots = [];
  for (const s of SCREENS) shots.push('data:image/png;base64,' + (await page.locator(`.phone[data-screen=${s}]`).screenshot()).toString('base64'));
  const title = await page.title();
  await writeFile(resolve(OUT, `${m}.jpg`), await strip(title, [{ label: '시안', imgs: shots }]));
  if (BEFORE && SCREENS.every(s => existsSync(resolve(BEFORE, NOW[s])))) {
    const now = await Promise.all(SCREENS.map(async s => 'data:image/png;base64,' + (await readFile(resolve(BEFORE, NOW[s]))).toString('base64')));
    await writeFile(resolve(OUT, `compare-${m}.jpg`), await strip(`지금 화면 vs ${title}`, [{ label: '지금', imgs: now }, { label: '시안', imgs: shots }]));
  }
  console.log('찍음', m);
}
await browser.close();
