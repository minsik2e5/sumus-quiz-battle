// 시안 그림 · 영상 만들기 (playwright는 저장소 의존성이 아님: PLAYWRIGHT=경로)
//   node docs/design-concept-mock/shot.mjs [--before 폴더] [--video] [--only a-street,d-magazine]
// 만드는 것 (docs/screenshots/design-concept/):
//   dir-NN-<이름>.jpg       방향마다 홈 화면 + 견본 카드
//   all-1.jpg, all-2.jpg   10방향 모음(번호 크게). --before가 있으면 지금 앱 홈도 첫 칸에
//   <a|b|c>.jpg            01~03의 홈 · 공부 · 야차전 3화면
//   compare-<a|b|c>.jpg    --before가 있으면 지금 화면 vs 시안
//   tour.mp4 (--video)     10방향 차례로, 방향마다 들어오는 움직임 + 버튼 누름 (ffmpeg 있으면 mp4, 없으면 webm)
// --before 폴더: docs/app-audit.mjs --shots 로 찍은 s-home-390.png · s-quick-practice-390.png · s-yacha-battle-390.png
import { createRequire } from 'node:module';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { mkdir, writeFile, readFile, rm, readdir, rename } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../..');
const require = createRequire(import.meta.url);
const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i > 0 ? (process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : true) : d; };
const pw = [process.env.PLAYWRIGHT, 'playwright', '/opt/node-tools/node_modules/playwright'].filter(Boolean).map(n => { try { return require(n); } catch { return null; } }).find(Boolean);
if (!pw) throw Error('playwright를 찾지 못했어요. PLAYWRIGHT=경로');
const OUT = resolve(root, 'docs/screenshots/design-concept');
const BEFORE = arg('before', '');
const ONLY = String(arg('only', '') || '').split(',').filter(Boolean);
const DIRS = [
  ['01', 'a-street', '스트릿 HUD'], ['02', 'b-cobalt', '코발트 포커스'], ['03', 'c-archive', '홀로 도감'],
  ['04', 'd-magazine', '매거진 커버'], ['05', 'e-moonlight', '월광 RPG'], ['06', 'f-planner', '플래너 그리드'],
  ['07', 'g-sticker', '팝 스티커'], ['08', 'h-pixel', '픽셀 아케이드'], ['09', 'i-league', '학교 리그 중계'], ['10', 'j-diary', '다꾸 노트'],
].filter(d => !ONLY.length || ONLY.includes(d[1]));
const NOW = { home: 's-home-390.png', study: 's-quick-practice-390.png', yacha: 's-yacha-battle-390.png' };
const url = (f, q) => pathToFileURL(resolve(here, `${f}.html`)).href + q;
const b64 = buf => 'data:image/png;base64,' + buf.toString('base64');

await mkdir(OUT, { recursive: true });
const browser = await pw.chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 }, deviceScaleFactor: 2 });
const compose = async (html, width, scale = 1) => {
  const p = await browser.newPage({ viewport: { width, height: 300 }, deviceScaleFactor: scale });
  await p.setContent(`<body style="margin:0;background:#111;color:#eee;font-family:sans-serif">${html}</body>`); await p.waitForTimeout(250);
  const buf = await p.screenshot({ type: 'jpeg', quality: 74, fullPage: true }); await p.close(); return buf;
};
const tile = (src, label, sub) => `<div style="width:250px"><div style="display:flex;align-items:baseline;gap:8px;margin:0 0 8px"><b style="font-size:40px;line-height:1">${label}</b><span style="font-size:15px;font-weight:700">${sub}</span></div><img src="${src}" style="width:250px;height:541px;object-fit:cover;object-position:top;border-radius:16px;display:block"></div>`;

const homes = {};
for (const [no, f, name] of DIRS) {
  await page.goto(url(f, '?still')); await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(350);
  const home = await page.locator('.phone[data-screen=home]').screenshot();
  const spec = await page.locator('.spec').screenshot();
  homes[no] = b64(home);
  await writeFile(resolve(OUT, `dir-${no}-${f}.jpg`), await compose(
    `<div style="display:flex;gap:20px;padding:20px;align-items:flex-start"><img src="${b64(home)}" style="width:390px;border-radius:24px"><img src="${b64(spec)}" style="width:300px;border-radius:16px"></div>`, 750, 2));
  if (['a-street', 'b-cobalt', 'c-archive'].includes(f)) {
    const three = [];
    for (const s of ['home', 'study', 'yacha']) three.push(b64(await page.locator(`.phone[data-screen=${s}]`).screenshot()));
    const row = (label, imgs) => `<div style="display:flex;gap:14px;align-items:flex-start;margin-bottom:16px"><b style="width:56px;font-size:17px;padding-top:6px">${label}</b>${imgs.map(s => `<img src="${s}" style="width:250px;height:541px;object-fit:cover;object-position:top;border-radius:16px">`).join('')}</div>`;
    const head = t => `<div style="font-size:22px;font-weight:800;margin:0 0 14px">${t}</div>`;
    await writeFile(resolve(OUT, `${f}.jpg`), await compose(`<div style="padding:18px">${head(`${no} · ${name} — 홈 · 단어 공부 · 야차전`)}${row('시안', three)}</div>`, 900, 1.6));
    if (BEFORE && Object.values(NOW).every(n => existsSync(resolve(BEFORE, n)))) {
      const now = await Promise.all(Object.values(NOW).map(async n => b64(await readFile(resolve(BEFORE, n)))));
      await writeFile(resolve(OUT, `compare-${f}.jpg`), await compose(`<div style="padding:18px">${head(`지금 화면 vs ${no} · ${name}`)}${row('지금', now)}${row('시안', three)}</div>`, 900, 1.2));
    }
  }
  console.log('찍음', no, f);
}

if (DIRS.length === 10) {
  const now = BEFORE && existsSync(resolve(BEFORE, NOW.home)) ? b64(await readFile(resolve(BEFORE, NOW.home))) : null;
  const groups = [DIRS.slice(0, 5), DIRS.slice(5)];
  for (let g = 0; g < 2; g++) {
    const tiles = (now ? [tile(now, '지금', '현재 앱 홈')] : []).concat(groups[g].map(([no, , name]) => tile(homes[no], no, name)));
    await writeFile(resolve(OUT, `all-${g + 1}.jpg`), await compose(
      `<div style="padding:20px"><div style="font-size:22px;font-weight:800;margin-bottom:14px">SUMUS VOCA 디자인 컨셉 10방향 (${g ? '06~10' : '01~05'}) — 홈 화면</div><div style="display:flex;gap:16px">${tiles.join('')}</div></div>`, 40 + tiles.length * 266, 1));
  }
  console.log('모음 그림 2장');
}

if (arg('video', false)) {
  const vdir = resolve(tmpdir(), `concept-video-${process.pid}`);
  await mkdir(vdir, { recursive: true });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, recordVideo: { dir: vdir, size: { width: 390, height: 844 } } });
  const p = await ctx.newPage();
  const btnSel = '.phone[data-screen=home] :is(.go,.pill.w,.btn,.d-go,.e-go,.f-go,.g-go,.h-go,.i-go,.j-go)';
  for (const [no, f, name] of DIRS) {
    await p.goto(url(f, '?solo'));
    await p.evaluate(([no, name]) => {
      const t = document.createElement('div');
      t.textContent = `${no}  ${name}`;
      t.style.cssText = 'position:fixed;left:0;right:0;top:0;z-index:99;padding:14px 18px;background:rgba(0,0,0,.78);color:#fff;font:800 22px Pretendard,sans-serif;letter-spacing:-.02em;transition:opacity .3s';
      document.body.appendChild(t); setTimeout(() => { t.style.opacity = '0'; }, 1500);
    }, [no, name]);
    await p.waitForTimeout(1900);
    const b = p.locator(btnSel).first();
    const box = await b.boundingBox();
    if (box) {
      await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 6 });
      await b.evaluate(el => el.classList.add('press')); await p.waitForTimeout(260);
      await b.evaluate(el => el.classList.remove('press')); await p.waitForTimeout(160);
      await b.evaluate(el => el.classList.add('press')); await p.waitForTimeout(220);
      await b.evaluate(el => el.classList.remove('press'));
    }
    await p.waitForTimeout(900);
  }
  await p.close(); await ctx.close();
  const webm = (await readdir(vdir)).find(n => n.endsWith('.webm'));
  try {
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', resolve(vdir, webm), '-vf', 'fps=30,scale=390:-2', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '28', '-preset', 'slow', '-movflags', '+faststart', resolve(OUT, 'tour.mp4')]);
    console.log('영상 tour.mp4');
  } catch { await rename(resolve(vdir, webm), resolve(OUT, 'tour.webm')); console.log('영상 tour.webm (ffmpeg 없음)'); }
  await rm(vdir, { recursive: true, force: true });
}
await browser.close();
