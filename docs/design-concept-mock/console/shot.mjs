// 최신 콘솔 게임 감각 3안 그림 · 영상: node docs/design-concept-mock/console/shot.mjs [--before 폴더] [--video] [--only c1-white]
// 만드는 것 (docs/screenshots/design-concept/console/): <안>.jpg(4화면 + 견본), all.jpg(지금 앱 홈 + 3안 홈), <안>.mp4(4화면을 넘겨 봄, 약 13초)
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
const OUT = resolve(root, 'docs/screenshots/design-concept/console');
const BEFORE = arg('before', '');
const ONLY = String(arg('only', '') || '').split(',').filter(Boolean);
const ALL = [['1', 'c1-white', '화이트 스튜디오'], ['2', 'c2-arena', '라일락 아레나'], ['3', 'c3-neon', '네온 시티']];
const DIRS = ALL.filter(d => !ONLY.length || ONLY.includes(d[1]));
const SCREENS = [['home', '홈'], ['study', '단어 공부'], ['battle', '야차전 대결'], ['pet', '펫 · 도감']];
const url = (f, q) => pathToFileURL(resolve(here, `${f}.html`)).href + q;
const b64 = buf => 'data:image/png;base64,' + buf.toString('base64');
await mkdir(OUT, { recursive: true });
const browser = await pw.chromium.launch();
const page = await browser.newPage({ viewport: { width: 2000, height: 1000 }, deviceScaleFactor: 2 });
const compose = async (html, width, scale) => {
  const p = await browser.newPage({ viewport: { width, height: 300 }, deviceScaleFactor: scale });
  await p.setContent(`<body style="margin:0;background:#111;color:#eee;font-family:sans-serif">${html}</body>`); await p.waitForTimeout(250);
  const buf = await p.screenshot({ type: 'jpeg', quality: 74, fullPage: true }); await p.close(); return buf;
};
const homes = {};
for (const [no, f, name] of DIRS) {
  await page.goto(url(f, '?still')); await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(400);
  const shots = [];
  for (const [s] of SCREENS) shots.push(b64(await page.locator(`.phone[data-screen=${s}]`).screenshot()));
  const sp = b64(await page.locator('.spec').screenshot());
  homes[no] = shots[0];
  await writeFile(resolve(OUT, `${f}.jpg`), await compose(`<div style="padding:18px"><div style="font-size:24px;font-weight:800;margin-bottom:12px">${no} · ${name} <span style="font-size:15px;opacity:.7">— 홈 · 단어 공부 · 야차전 대결 · 펫과 도감</span></div><div style="display:flex;gap:14px;align-items:flex-start">${shots.map(s => `<img src="${s}" style="width:250px;border-radius:18px">`).join('')}<img src="${sp}" style="width:230px;border-radius:14px"></div></div>`, 1330, 1.25));
  console.log('찍음', no, f);
}
if (DIRS.length === ALL.length) {
  const now = BEFORE && existsSync(resolve(BEFORE, 's-home-390.png')) ? b64(await readFile(resolve(BEFORE, 's-home-390.png'))) : null;
  const tile = (src, label, sub) => `<div style="width:270px"><div style="display:flex;align-items:baseline;gap:8px;margin:0 0 8px"><b style="font-size:44px;line-height:1">${label}</b><span style="font-size:16px;font-weight:700">${sub}</span></div><img src="${src}" style="width:270px;height:584px;object-fit:cover;object-position:top;border-radius:18px;display:block"></div>`;
  const tiles = (now ? [tile(now, '지금', '현재 앱 홈')] : []).concat(DIRS.map(([no, , name]) => tile(homes[no], no, name)));
  await writeFile(resolve(OUT, 'all.jpg'), await compose(`<div style="padding:20px"><div style="font-size:22px;font-weight:800;margin-bottom:14px">SUMUS VOCA · 최신 콘솔 게임 감각 3안 — 홈 화면</div><div style="display:flex;gap:16px">${tiles.join('')}</div></div>`, 40 + tiles.length * 286, 1.4));
  console.log('모음 all.jpg');
}
if (arg('video', false)) {
  for (const [no, f, name] of DIRS) {
    const vdir = resolve(tmpdir(), `console-video-${process.pid}-${f}`); await mkdir(vdir, { recursive: true });
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, recordVideo: { dir: vdir, size: { width: 390, height: 844 } } });
    const p = await ctx.newPage();
    for (let i = 0; i < SCREENS.length; i++) {
      await p.goto(url(f, `?solo&s=${i + 1}`));
      await p.evaluate(t => { const d = document.createElement('div'); d.textContent = t; d.style.cssText = 'position:fixed;left:0;right:0;bottom:0;z-index:99;padding:14px 18px 26px;background:rgba(0,0,0,.8);color:#fff;font:800 19px Pretendard,sans-serif;transition:opacity .3s'; document.body.appendChild(d); setTimeout(() => { d.style.opacity = '0'; }, 1200); }, `${no} ${name} · ${SCREENS[i][1]}`);
      await p.waitForTimeout(2300);
      const b = p.locator('.shot.show .k-go').first();
      if (await b.count()) { for (let k = 0; k < 2; k++) { await b.evaluate(el => el.classList.add('press')); await p.waitForTimeout(200); await b.evaluate(el => el.classList.remove('press')); await p.waitForTimeout(160); } }
      await p.waitForTimeout(300);
    }
    await p.close(); await ctx.close();
    const webm = (await readdir(vdir)).find(n => n.endsWith('.webm'));
    try { execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', resolve(vdir, webm), '-vf', 'fps=30,scale=390:-2', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '28', '-preset', 'slow', '-movflags', '+faststart', resolve(OUT, `${f}.mp4`)]); console.log('영상', `${f}.mp4`); }
    catch { await rename(resolve(vdir, webm), resolve(OUT, `${f}.webm`)); console.log('영상', `${f}.webm`); }
    await rm(vdir, { recursive: true, force: true });
  }
}
await browser.close();
