// 몬스터 수집 RPG 갈래 그림 · 영상: node docs/design-concept-mock/monster/shot.mjs [--before 폴더] [--video] [--only m1-sky]
// 만드는 것 (docs/screenshots/design-concept/monster/): <안>.jpg(홈 + 둘째 화면 + 견본), all.jpg(지금 앱 홈 + 6안 홈), tour.mp4
import { createRequire } from 'node:module';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { mkdir, writeFile, readFile, rm, readdir, rename } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../../..');
const require = createRequire(import.meta.url);
const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i > 0 ? (process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : true) : d; };
const pw = [process.env.PLAYWRIGHT, 'playwright', '/opt/node-tools/node_modules/playwright'].filter(Boolean).map(n => { try { return require(n); } catch { return null; } }).find(Boolean);
if (!pw) throw Error('playwright를 찾지 못했어요. PLAYWRIGHT=경로');
const OUT = resolve(root, 'docs/screenshots/design-concept/monster');
const BEFORE = arg('before', '');
const ONLY = String(arg('only', '') || '').split(',').filter(Boolean);
const ALL = [['1', 'm1-sky', '하늘 모험'], ['2', 'm2-dex', '도감 노트'], ['3', 'm3-trainer', '트레이너 카드'], ['4', 'm4-battle', '대결 명령'], ['5', 'm5-handheld', '휴대용 게임기'], ['6', 'm6-cards', '반짝 카드']];
const DIRS = ALL.filter(d => existsSync(resolve(here, `${d[1]}.html`)) && (!ONLY.length || ONLY.includes(d[1])));
const url = (f, q) => pathToFileURL(resolve(here, `${f}.html`)).href + q;
const b64 = buf => 'data:image/png;base64,' + buf.toString('base64');
await mkdir(OUT, { recursive: true });
const browser = await pw.chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 }, deviceScaleFactor: 2 });
const compose = async (html, width, scale) => {
  const p = await browser.newPage({ viewport: { width, height: 300 }, deviceScaleFactor: scale });
  await p.setContent(`<body style="margin:0;background:#111;color:#eee;font-family:sans-serif">${html}</body>`); await p.waitForTimeout(250);
  const buf = await p.screenshot({ type: 'jpeg', quality: 74, fullPage: true }); await p.close(); return buf;
};
const homes = {};
for (const [no, f, name] of DIRS) {
  await page.goto(url(f, '?still')); await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(400);
  const h = b64(await page.locator('.phone[data-screen=home]').screenshot());
  const s2 = b64(await page.locator('.phone[data-screen=second]').screenshot());
  const sp = b64(await page.locator('.spec').screenshot());
  homes[no] = h;
  const cap = await page.locator('.shot:nth-child(2) figcaption').innerText();
  await writeFile(resolve(OUT, `${f}.jpg`), await compose(`<div style="padding:18px"><div style="font-size:24px;font-weight:800;margin-bottom:12px">${no} · ${name} <span style="font-size:15px;opacity:.7">— 홈 · ${cap}</span></div><div style="display:flex;gap:16px;align-items:flex-start"><img src="${h}" style="width:300px;border-radius:20px"><img src="${s2}" style="width:300px;border-radius:20px"><img src="${sp}" style="width:260px;border-radius:14px"></div></div>`, 950, 1.7));
  console.log('찍음', no, f);
}
if (DIRS.length === ALL.length) {
  const now = BEFORE && existsSync(resolve(BEFORE, 's-home-390.png')) ? b64(await readFile(resolve(BEFORE, 's-home-390.png'))) : null;
  const tile = (src, label, sub) => `<div style="width:230px"><div style="display:flex;align-items:baseline;gap:8px;margin:0 0 8px"><b style="font-size:40px;line-height:1">${label}</b><span style="font-size:15px;font-weight:700">${sub}</span></div><img src="${src}" style="width:230px;height:498px;object-fit:cover;object-position:top;border-radius:16px;display:block"></div>`;
  const tiles = (now ? [tile(now, '지금', '현재 앱 홈')] : []).concat(DIRS.map(([no, , name]) => tile(homes[no], no, name)));
  await writeFile(resolve(OUT, 'all.jpg'), await compose(`<div style="padding:20px"><div style="font-size:22px;font-weight:800;margin-bottom:14px">SUMUS VOCA · 몬스터 수집 RPG 느낌 6안 — 홈 화면</div><div style="display:flex;gap:14px">${tiles.join('')}</div></div>`, 40 + tiles.length * 244, 1));
  console.log('모음 all.jpg');
}
if (arg('video', false)) {
  const vdir = resolve(tmpdir(), `monster-video-${process.pid}`); await mkdir(vdir, { recursive: true });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, recordVideo: { dir: vdir, size: { width: 390, height: 844 } } });
  const p = await ctx.newPage();
  const label = async t => p.evaluate(t => { const d = document.createElement('div'); d.textContent = t; d.style.cssText = 'position:fixed;left:0;right:0;top:0;z-index:99;padding:14px 18px;background:rgba(0,0,0,.78);color:#fff;font:800 21px Pretendard,sans-serif;transition:opacity .3s'; document.body.appendChild(d); setTimeout(() => { d.style.opacity = '0'; }, 1300); }, t);
  for (const [no, f, name] of DIRS) {
    await p.goto(url(f, '?solo')); await label(`${no} ${name} · 홈`); await p.waitForTimeout(1700);
    const b = p.locator('.phone[data-screen=home] [class$="-go"], .phone[data-screen=home] [class*="-go "]').first();
    if (await b.count()) { const box = await b.boundingBox(); if (box) await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 5 }); for (let i = 0; i < 2; i++) { await b.evaluate(el => el.classList.add('press')); await p.waitForTimeout(230); await b.evaluate(el => el.classList.remove('press')); await p.waitForTimeout(180); } }
    await p.goto(url(f, '?solo&solo2')); await label(`${no} ${name} · ${await p.locator('.shot:nth-child(2) figcaption').innerText()}`); await p.waitForTimeout(2600);
  }
  await p.close(); await ctx.close();
  const webm = (await readdir(vdir)).find(n => n.endsWith('.webm'));
  try { execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', resolve(vdir, webm), '-vf', 'fps=30,scale=390:-2', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '28', '-preset', 'slow', '-movflags', '+faststart', resolve(OUT, 'tour.mp4')]); console.log('영상 tour.mp4'); }
  catch { await rename(resolve(vdir, webm), resolve(OUT, 'tour.webm')); console.log('영상 tour.webm'); }
  await rm(vdir, { recursive: true, force: true });
}
await browser.close();
