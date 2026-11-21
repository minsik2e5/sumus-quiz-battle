// 디자인 리뉴얼 시안을 찍는다. 사용: node docs/design-renewal-mock/shot.mjs [--only dir1] [--scale 2]
//   방향별 한 장(화면 5개 나란히): docs/screenshots/design-renewal/dir1.png …
//   화면별 비교(지금 vs 시안 1 · 2 · 3): docs/screenshots/design-renewal/compare-home.jpg …
//   "지금" 화면은 docs/screenshots/design-renewal/before/*.jpg (docs/app-audit.mjs --shots로 찍은 것)
//   playwright 위치: PLAYWRIGHT=/경로/node_modules/playwright. 검사(npm run check)에는 넣지 않는다.
import { createRequire } from 'node:module';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const here = dirname(fileURLToPath(import.meta.url)), require = createRequire(import.meta.url);
const arg = (n, f) => { const i = process.argv.indexOf(`--${n}`); return i > 0 ? process.argv[i + 1] : f; };
const OUT = resolve(here, '../screenshots/design-renewal'), TMP = resolve(OUT, '.tmp'), SCALE = Number(arg('scale', 2)), ONLY = arg('only', '');
const load = () => { for (const n of [process.env.PLAYWRIGHT, 'playwright', '/opt/node-tools/node_modules/playwright'].filter(Boolean)) { try { return require(n); } catch {} } throw Error('playwright를 찾지 못했어요.'); };
const { chromium } = load();
const DIRS = [['dir1', 'dir1-lobby.html', '시안 1 · 게임 로비'], ['dir2', 'dir2-map.html', '시안 2 · 모험 지도'], ['dir3', 'dir3-minimal.html', '시안 3 · 큰 글자 미니멀']];
const SCREENS = [['home', '홈'], ['study', '학습'], ['yacha', '야차전 준비'], ['arcade', '놀이터'], ['result', '연습 결과']];

await mkdir(TMP, { recursive: true });
const browser = await chromium.launch();
for (const [key, file] of DIRS) {
  if (ONLY && !key.includes(ONLY)) continue;
  if (!existsSync(resolve(here, file))) continue;
  const page = await browser.newPage({ viewport: { width: 2200, height: 1100 }, deviceScaleFactor: SCALE });
  await page.goto(pathToFileURL(resolve(here, file)).href + '?still');
  await page.waitForLoadState('networkidle'); await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(300);
  await page.locator('.stage').screenshot({ path: resolve(OUT, `${key}.png`) });
  for (const [s] of SCREENS) await page.locator(`.phone[data-screen=${s}]`).screenshot({ path: resolve(TMP, `${key}-${s}.png`) });
  await page.close();
  console.log('찍음:', key);
}
// 화면별 비교
if (!ONLY) for (const [s, name] of SCREENS) {
  const cols = [['지금', resolve(OUT, `before/${s}.jpg`)], ...DIRS.map(([k, , label]) => [label, resolve(TMP, `${k}-${s}.png`)])].filter(([, f]) => existsSync(f));
  const html = `<!doctype html><meta charset="utf-8"><style>@font-face{font-family:P;font-weight:100 900;src:url(${pathToFileURL(resolve(here, 'fonts/pretendard-var-kr.woff2')).href})}
    body{margin:0;background:#15161a;font-family:P,sans-serif;color:#fff;width:max-content}main{display:flex;gap:20px;padding:20px 24px 24px}
    h1{font-size:26px;font-weight:800;padding:20px 24px 0}figure{margin:0}figcaption{font-size:18px;font-weight:700;margin:0 0 10px 4px}figcaption.now{color:#ff9d8f}
    img{display:block;width:390px;height:844px;object-fit:cover;object-position:top;border-radius:34px}</style>
    <h1>${name} — 지금 화면과 새 시안</h1><main>${cols.map(([l, f]) => `<figure><figcaption class="${l === '지금' ? 'now' : ''}">${l}</figcaption><img src="${pathToFileURL(f).href}"></figure>`).join('')}</main>`;
  const f = resolve(TMP, `compare-${s}.html`); await writeFile(f, html);
  const page = await browser.newPage({ viewport: { width: 1800, height: 1000 }, deviceScaleFactor: SCALE });
  await page.goto(pathToFileURL(f).href); await page.waitForLoadState('networkidle'); await page.evaluate(() => document.fonts.ready);
  await page.locator('body').screenshot({ path: resolve(OUT, `compare-${s}.jpg`), type: 'jpeg', quality: 86 });
  await page.close();
}
await browser.close();
await rm(TMP, { recursive: true, force: true });
console.log('저장:', OUT);
