// V13.191 인형뽑기 물리 시험 측정(docs/claw-3d-feasibility.md 표). 머지 대상 아님(초안 브랜치 claude/claw-physics-proto).
// public/ 을 그대로 내주는 가짜 서버(Playwright route) 위에서
//   ① 2.5D 물리 시험 페이지(public/proto/claw-physics.html, 인형 20개)와 ② 지금 인형뽑기 화면(DOM 그림 층, 집게 한 번)을
//   CPU 1× · 4× · 6× 느리게(Chrome DevTools 스로틀링 = 저사양 근사), 해상도 dpr 2 · 1로 8초씩 돌려 프레임 시간을 잰다.
// 사용: node docs/proto/claw-physics-measure.mjs  (Playwright가 깔린 곳. 이 환경은 전역 설치를 쓴다)
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { extname, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch { pw = createRequire(execSync('npm root -g').toString().trim() + '/')('playwright'); }
const PUB = join(dirname(fileURLToPath(import.meta.url)), '../../public');
const types = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp', '.mp3': 'audio/mpeg', '.html': 'text/html' };
const SECONDS = Number(process.env.SECONDS || 8);

async function serve(page, extra = () => null) {
  await page.route('**/*', route => {
    const p = new URL(route.request().url()).pathname;
    const x = extra(p, route); if (x) return x;
    const f = join(PUB, p);
    if (existsSync(f)) return route.fulfill({ body: readFileSync(f), contentType: types[extname(f)] || 'application/octet-stream' });
    return route.fulfill({ status: 404, body: '' });
  });
}
async function throttle(page, rate) { const cdp = await page.context().newCDPSession(page); await cdp.send('Emulation.setCPUThrottlingRate', { rate }); }
const r1 = v => Math.round(v * 10) / 10;

async function physics(browser, rate, dpr) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: dpr });
  await serve(page);
  await throttle(page, rate);
  const t0 = Date.now();
  await page.goto(`http://local.test/proto/claw-physics.html?dpr=${dpr}`);
  await page.waitForFunction(() => window.__firstFrame && window.__stats);
  const load = Date.now() - t0;
  await page.waitForTimeout(1500);
  await page.evaluate(() => window.__statsReset());
  await page.waitForTimeout(SECONDS * 1000);
  const s = await page.evaluate(() => window.__stats());
  await page.close();
  return { what: '2.5D 물리(인형 20)', rate, dpr: s.dpr, load, fps: r1(1000 / s.avgFrame), avg: r1(s.avgFrame), p95: r1(s.p95Frame), phys: r1(s.avgPhys), physP95: r1(s.p95Phys), draw: r1(s.avgDraw), long: s.long, frames: s.frames };
}
async function current(browser, rate, dpr) {
  const { roundLayout } = await import(join(PUB, 'modules/claw-rules.js'));
  const now = Date.now(), view = { open: true, ready: [], tickets: 3, max: 6, got: {}, book: Array(12).fill(0), gold: 0, kinds: 4, gold_kinds: 0, all: 12, n: 5, ng: 0, coin_today: 0, coin_daily: 30, pity: 0, live: null, guide: true };
  const dolls = roundLayout('r-measure-01'), target = dolls.find(d => d.z === 2);
  const round = { id: 'r-measure-01', dolls, drops: 3, time: 30, n: 0, left: 3, won: 0, ends: now + 99999, aim_left: 30 };
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: dpr });
  await serve(page, (p, route) => {
    const json = b => route.fulfill({ contentType: 'application/json', body: JSON.stringify(b) });
    if (p === '/api/claw/home') return json({ claw: view, news: [] });
    if (p === '/api/claw/start') return json({ round, claw: view });
    if (p === '/api/claw/drop') return json({ n: 0, aim: 'perfect', target: target.i, result: 'slip', slip: 'lift', grip: 57, doll: null, extra: null, fresh: false, coins: 0, nudge: [], left: 2, end: false, claw: view });
    if (p === '/m.html') return route.fulfill({ contentType: 'text/html', body: '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/app.bundle.css"><div id="app"></div><script type="module" src="/m.js"></script>' });
    if (p === '/m.js') return route.fulfill({ contentType: 'text/javascript', body: `import { openClaw } from '/modules/claw.js'; openClaw({ data: { rewards: { claw: ${JSON.stringify(view)} } } }, () => {});
      const F = []; let last = performance.now(); window.__reset = () => { F.length = 0; }; (function f(n) { F.push(n - last); last = n; requestAnimationFrame(f); })(last);
      window.__stats = () => { const s = [...F].sort((a, b) => a - b); const a = F.reduce((x, y) => x + y, 0) / F.length; return { avg: a, p95: s[Math.floor(s.length * .95)], long: F.filter(x => x > 25).length, frames: F.length }; };` });
    return null;
  });
  await throttle(page, rate);
  const t0 = Date.now();
  await page.goto('http://local.test/m.html');
  await page.waitForSelector('[data-cw="start"]:not([disabled])');
  const load = Date.now() - t0;
  await page.click('[data-cw="start"]', { force: true });
  await page.waitForTimeout(2200);
  await page.evaluate(() => window.__reset());
  await page.click('#cw-drop', { force: true });
  await page.waitForTimeout(SECONDS * 1000);
  const s = await page.evaluate(() => window.__stats());
  await page.close();
  return { what: '지금 화면(DOM, 집게 한 번)', rate, dpr, load, fps: r1(1000 / s.avg), avg: r1(s.avg), p95: r1(s.p95), phys: '-', physP95: '-', draw: '-', long: s.long, frames: s.frames };
}

const browser = await pw.chromium.launch();
const rows = [];
for (const rate of [1, 4, 6]) for (const dpr of [2, 1]) { rows.push(await physics(browser, rate, dpr)); rows.push(await current(browser, rate, dpr)); }
// 재현: 같은 판 id로 두 번 → 같은 자리인가.
const page = await browser.newPage(); await serve(page);
await page.goto('http://local.test/proto/claw-physics.html?auto=0');
await page.waitForFunction(() => window.__proto);
const same = await page.evaluate(() => window.__proto.replay('r-proto-0001', 300) === window.__proto.replay('r-proto-0001', 300));
const diff = await page.evaluate(() => window.__proto.replay('r-proto-0001', 300) !== window.__proto.replay('r-proto-0002', 300));
await browser.close();
console.log('| 장면 | CPU | dpr | 첫 화면(ms) | fps | 프레임 평균(ms) | 95%(ms) | 물리 평균 · 95%(ms) | 그리기 평균(ms) | 25ms 넘는 프레임 |');
console.log('|---|---|---|---|---|---|---|---|---|---|');
for (const r of rows) console.log(`| ${r.what} | ${r.rate}× | ${r.dpr} | ${r.load} | ${r.fps} | ${r.avg} | ${r.p95} | ${r.phys} · ${r.physP95} | ${r.draw} | ${r.long}/${r.frames} |`);
console.log(`\n재현(같은 판 id 300걸음 두 번 같은 자리): ${same ? 'OK' : '다름'} · 다른 판 id는 다른 장면: ${diff ? 'OK' : '같음'}`);
