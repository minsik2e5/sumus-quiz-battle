// 디자인 정리 시안(index.html)을 화면별 한 장씩 찍는다. 사용: node docs/app-audit-mock/shot.mjs [--out 폴더]
//   playwright 위치: PLAYWRIGHT=/경로/node_modules/playwright
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const here = dirname(fileURLToPath(import.meta.url)), require = createRequire(import.meta.url);
const at = process.argv.indexOf('--out'), OUT = resolve(at > 0 ? process.argv[at + 1] : resolve(here, '../screenshots/app-audit'));
const load = () => { for (const n of [process.env.PLAYWRIGHT, 'playwright', '/opt/node-tools/node_modules/playwright'].filter(Boolean)) { try { return require(n); } catch {} } throw Error('playwright를 찾지 못했어요.'); };
const { chromium } = load();
const browser = await chromium.launch(), page = await browser.newPage({ viewport: { width: 1300, height: 900 }, deviceScaleFactor: 1 });
await page.goto(pathToFileURL(resolve(here, 'index.html')).href);
await page.waitForLoadState('networkidle');
await mkdir(OUT, { recursive: true });
const names = ['mock-playground', 'mock-yacha', 'mock-home'];
const rows = page.locator('.row');
for (let i = 0; i < await rows.count(); i++) await rows.nth(i).screenshot({ path: resolve(OUT, `${names[i]}.png`) });
await browser.close();
console.log('저장:', OUT);
