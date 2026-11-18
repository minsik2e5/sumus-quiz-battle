// V13.245 게임 공통 렉 측정(검사에는 넣지 않는다). 운영 · 테스트 서버에 연결하지 않는다.
// docs/runner-play-shot.mjs --perf(펫 대행진) · docs/arena-perf.mjs(펫 아레나)가 없는 다른 게임을 같은 숫자로 잰다.
//
// 미리: 로컬 서버를 테스트 앱 처음 데이터로 켠다(학생 ts1 / test1234) — docs/runner-play-shot.mjs 머리말과 같다.
// 사용: node docs/game-perf.mjs --game match|wall|timing|fishing|claw|rps|yabawi|hunt|monster|runner
//         [--cpu 4] [--rounds 1] [--base http://localhost:8787] [--user ts1] [--seconds 40] [--profile 파일] [--shot 파일.png]
// 조건: 세로 폰 390×844 · 배율 3 · 터치 · CPU N배. 이 환경은 캔버스 · 화면을 CPU로 그려 진짜 폰보다 불리하다.
//
// 잰 것(판마다):
//   start_ms            시작 버튼 → 판이 도는 표시가 보일 때까지
//   fps · over33_min · over50_min · max · first5s_over50 · long_tasks   판 중 프레임
//   input_p95           누름(pointerdown · keydown) → 다음 프레임 시작
//   style_ms · layout_ms · script_ms(판 중 합), layout_count           판 중 DOM 쓰기 · 배치 다시 계산
//   net                 판 중에 나간 서버 요청(경로 · 횟수)
//   img                 판 중에 처음 받은 그림(판 중 디코드 후보)
//   anims_inf           판 중 끝없이 도는 CSS 애니메이션 수(이름별)
// 판을 --rounds 번 이어서 한 뒤:
//   heap_mb[]           판마다 끝나고(가비지 수거 뒤) JS 힙 → 계속 늘면 메모리가 샌다
//   nodes[] · listeners[]   DOM 노드 · 이벤트 리스너 수(판마다 쌓이는지)
//   after_exit          게임을 나간 뒤 3초: 초당 requestAnimationFrame 호출 · 살아 있는 setInterval · 소리 · 끝없는 애니메이션
//   hidden              판 중 탭 숨김 3초 → 돌아온 직후 가장 긴 프레임(visibilitychange 흉내)
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';

const require = createRequire(import.meta.url);
const arg = (n, f) => { const i = process.argv.indexOf(`--${n}`); return i > 0 ? process.argv[i + 1] : f; };
const has = n => process.argv.includes(`--${n}`);
const BASE = arg('base', 'http://localhost:8787'), GAME = arg('game', 'match'), CPU = Number(arg('cpu', 4)), ROUNDS = Number(arg('rounds', 1)), SECONDS = Number(arg('seconds', 40)), USER = arg('user', 'ts1');
const pw = (() => { for (const n of [process.env.PLAYWRIGHT, 'playwright', '/opt/node-tools/node_modules/playwright'].filter(Boolean)) { try { return require(n); } catch {} } throw Error('playwright가 필요해요'); })();
const sleep = ms => new Promise(r => setTimeout(r, ms));
const r1 = x => Math.round(x * 10) / 10;

/* ---------- 페이지 안 측정기 ---------- */
const PROBE = () => {
  const P = window.__gp = { frames: [], long: [], lat: [], on: false, net: [], img: [], raf: 0, timers: new Map(), audio: 0 };
  let last = 0;
  const raf0 = window.requestAnimationFrame.bind(window);
  const loop = t => { if (last && P.on) P.frames.push(t - last); last = t; raf0(loop); }; raf0(loop);
  // 나간 뒤에도 도는 것: 앱이 부른 requestAnimationFrame 횟수 · 살아 있는 setInterval(만든 곳)
  window.requestAnimationFrame = cb => { P.raf++; return raf0(cb); };
  const si = window.setInterval, ci = window.clearInterval;
  window.setInterval = (fn, ms, ...a) => { const id = si(fn, ms, ...a); P.timers.set(id, { ms: ms | 0, at: (Error().stack || '').split('\n').slice(2, 4).map(s => s.trim().replace(/^at /, '').replace(/https?:\/\/[^/]+/, '')).join(' < ') }); return id; };
  window.clearInterval = id => { P.timers.delete(id); return ci(id); };
  try { new PerformanceObserver(l => { if (P.on) for (const e of l.getEntries()) P.long.push(Math.round(e.duration)); }).observe({ type: 'longtask' }); } catch {}
  try { new PerformanceObserver(l => { for (const e of l.getEntries()) { const u = e.name.replace(/https?:\/\/[^/]+/, ''); if (!P.on) continue; if (/\/api\//.test(u)) P.net.push(u.split('?')[0]); else if (/\.(webp|png|jpe?g|gif|svg)(\?|$)/.test(u)) P.img.push(u.split('?')[0].split('/').pop()); } }).observe({ type: 'resource' }); } catch {}
  const tap = e => { if (!P.on) return; const t0 = e.timeStamp; raf0(t => P.lat.push(t - t0)); };
  addEventListener('pointerdown', tap, { capture: true, passive: true }); addEventListener('keydown', tap, { capture: true, passive: true });
  // 소리: 지금 나는 <audio> 수와 AudioContext 수
  const AC = window.AudioContext || window.webkitAudioContext;
  if (AC) { P.ctxs = []; window.AudioContext = window.webkitAudioContext = class extends AC { constructor(...a) { super(...a); P.ctxs.push(this); } }; }
  P.snap = () => ({
    raf: P.raf, timers: [...P.timers.values()],
    audio: [...document.querySelectorAll('audio')].filter(a => !a.paused).length, ctx_running: (P.ctxs || []).filter(c => c.state === 'running').length,
    anims: (() => { const c = {}; for (const a of document.getAnimations()) { let it = 1; try { it = a.effect.getComputedTiming().iterations; } catch {} if (it !== Infinity || a.playState !== 'running') continue; const k = a.animationName || 'waapi'; c[k] = (c[k] || 0) + 1; } return c; })()
  });
};

/* ---------- 게임별 조종 ---------- */
// open: 놀이터에서 게임 화면 열기 · start: 판 시작 누르기 · playing: 판이 도는 표시 · done: 판 끝 표시 · act: 판 중 0.25초마다 부르는 조작 · again: 다음 판 준비 · exit: 게임 나가기
const DRIVERS = {};
export const driver = (name, d) => { DRIVERS[name] = d; };
const vis = async (page, sel) => !!(await page.$(sel).then(async el => el && await el.isVisible()).catch(() => false));
const tapIf = async (page, sel) => { const el = await page.$(sel); if (el && await el.isVisible().catch(() => false)) { await el.click({ timeout: 1500, force: true }).catch(() => {}); return true; } return false; };

await import('./game-perf-drivers.mjs').then(m => m.register(driver, { vis, tapIf, sleep }));

/* ---------- 실행 ---------- */
const D = DRIVERS[GAME]; if (!D) { console.error(`모르는 게임: ${GAME} (${Object.keys(DRIVERS).join(' | ')})`); process.exit(1); }
const browser = await pw.chromium.launch({ args: ['--mute-audio', '--autoplay-policy=no-user-gesture-required', '--js-flags=--expose-gc'] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
const page = await ctx.newPage(), errors = [];
page.on('pageerror', e => errors.push(e.message));
await page.addInitScript(PROBE);
if (D.init) await page.addInitScript(D.init);
await page.goto(BASE + '/');
await page.fill('input[autocomplete="username"], input[name="username"]', USER).catch(() => {});
await page.fill('input[type="password"]', 'test1234').catch(() => {});
await page.keyboard.press('Enter');
await sleep(2500);
for (let i = 0; i < 6; i++) {
  const x = await page.$('#modal-root button[aria-label*="닫기"], #modal-root .modal-close, #modal-root [data-action="close"], .install-banner button[aria-label*="닫기"]');
  if (x) { await x.click().catch(() => {}); await sleep(500); continue; }
  const auto = await page.$('#modal-root button:has-text("자동으로 보기"), #modal-root button:has-text("확인"), #modal-root button:has-text("좋아요")');
  if (auto) { await auto.click().catch(() => {}); await sleep(1500); continue; }
  await page.keyboard.press('Escape'); await sleep(300);
}
await page.evaluate(() => document.querySelector('.pwa-install-close, #pwa-install-close, [class*="pwa-install-close"]')?.click());   // 설치 안내 배너가 카드를 가린다
await sleep(900);
const cdp = await ctx.newCDPSession(page);
await cdp.send('Performance.enable');
const metrics = async () => Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(m => [m.name, m.value]));
const gc = async () => { await cdp.send('HeapProfiler.collectGarbage').catch(() => {}); await sleep(150); await cdp.send('HeapProfiler.collectGarbage').catch(() => {}); };
await D.open(page);
const rounds = [], heap = [], nodes = [], listeners = [];
let hidden = null, shot = !arg('shot');
await gc(); { const m = await metrics(); heap.push(r1(m.JSHeapUsedSize / 1048576)); nodes.push(m.Nodes); listeners.push(m.JSEventListeners); }
await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU });
for (let r = 0; r < ROUNDS; r++) {
  const t0 = Date.now();
  await D.start(page, r);
  await page.waitForFunction(D.playing, null, { timeout: 30000, polling: 50 });
  const startMs = Date.now() - t0;
  const m0 = await metrics();
  await page.evaluate(() => { const P = window.__gp; P.frames = []; P.long = []; P.lat = []; P.net = []; P.img = []; P.on = true; });
  if (arg('profile') && r === 0) { await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 200 }); await cdp.send('Profiler.start'); }
  if (has('trace') && r === 0) await browser.startTracing(page, { categories: ['devtools.timeline', 'disabled-by-default-devtools.timeline', 'disabled-by-default-devtools.timeline.stack'] });
  const tEnd = Date.now() + SECONDS * 1000; let anims = {}, n = 0;
  while (Date.now() < tEnd) {
    if (await page.evaluate(D.done).catch(() => false)) break;
    await D.act(page, n++).catch(() => {});
    if (n === 12) anims = (await page.evaluate(() => window.__gp.snap())).anims;
    if (!shot && n === 16) { shot = true; await page.screenshot({ path: arg('shot'), scale: 'css' }); }
    // 탭 숨김 흉내(첫 판, 3초쯤 지난 뒤): 숨김 3초 → 돌아온 뒤 1.5초 동안 가장 긴 프레임
    if (has('hide') && r === 0 && n === 14 && !hidden) {
      await page.evaluate(() => { const P = window.__gp; P.on = false; Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' }); Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); });
      await sleep(3000);
      await page.evaluate(() => { const P = window.__gp; delete document.visibilityState; delete document.hidden; P.hf = P.frames.length; P.on = true; document.dispatchEvent(new Event('visibilitychange')); });
      await sleep(1500);
      hidden = await page.evaluate(() => { const P = window.__gp, f = P.frames.splice(P.hf); return { back_max: Math.round(Math.max(0, ...f)), back_over50: f.filter(d => d > 50).length }; });
    }
    await sleep(D.every || 250);
  }
  const P = await page.evaluate(() => { const P = window.__gp; P.on = false; return { frames: P.frames, long: P.long, lat: P.lat, net: P.net, img: P.img }; });
  if (arg('profile') && r === 0) { const { profile } = await cdp.send('Profiler.stop'); writeFileSync(arg('profile'), JSON.stringify(profile)); }
  // --trace: 판 중 브라우저 일(종류별 ms) · 40ms 넘는 작업마다 안에서 한 일 · 스타일/배치를 다시 하게 만든 코드 줄(많은 순)
  if (has('trace') && r === 0) {
    const tr = JSON.parse((await browser.stopTracing()).toString()).traceEvents, ev = tr.filter(e => e.ph === 'X' && e.dur), sum = {};
    for (const e of ev) if (['UpdateLayoutTree', 'Layout', 'Paint', 'PrePaint', 'Layerize', 'Commit', 'FunctionCall', 'FireAnimationFrame', 'TimerFire', 'EventDispatch', 'Decode Image', 'ImageDecodeTask', 'ParseHTML', 'MajorGC', 'MinorGC', 'HitTest', 'RasterTask', 'XHRReadyStateChange'].includes(e.name)) sum[e.name] = (sum[e.name] || 0) + e.dur / 1000;
    console.error('trace(ms): ' + Object.entries(sum).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${Math.round(v)}`).join(' · '));
    const t00 = Math.min(...ev.map(e => e.ts));
    for (const t of ev.filter(e => e.name === 'RunTask' && e.dur > 40000).slice(0, 25)) { const kids = {}; for (const e of ev) if (e.tid === t.tid && e.pid === t.pid && e.ts >= t.ts && e.ts + e.dur <= t.ts + t.dur && e !== t && e.name !== 'RunTask') kids[e.name] = Math.max(kids[e.name] || 0, e.dur / 1000); console.error(`long ${((t.ts - t00) / 1e6).toFixed(1)}s ${Math.round(t.dur / 1000)}ms: ` + Object.entries(kids).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k, v]) => `${k} ${Math.round(v)}`).join(' · ')); }
    const why = {};
    for (const e of tr) if (e.name === 'ScheduleStyleRecalculation' || e.name === 'InvalidateLayout') { const st = e.args?.data?.stackTrace?.[0]; const k = `${e.name}: ${st ? `${st.functionName || '(anon)'} ${String(st.url).split('/').pop().split('?')[0]}:${st.lineNumber + 1}` : '(js 아님: CSS 애니메이션 등)'}`; why[k] = (why[k] || 0) + 1; }
    console.error(Object.entries(why).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([k, v]) => `${v} ${k}`).join('\n'));
  }
  const m1 = await metrics();
  const fr = P.frames.filter(d => d < 5000), secs = fr.reduce((a, b) => a + b, 0) / 1000, mins = secs / 60 || 1, sorted = [...fr].sort((a, b) => a - b), lat = [...P.lat].sort((a, b) => a - b);
  let acc = 0, f5 = 0; for (const d of fr) { acc += d; if (acc > 5000) break; if (d > 50) f5++; }
  const count = xs => { const c = {}; for (const x of xs) c[x] = (c[x] || 0) + 1; return c; };
  rounds.push({
    start_ms: startMs, seconds: r1(secs), fps: r1(fr.length / (secs || 1)), p95: r1(sorted[Math.floor(sorted.length * .95)] || 0), max: r1(Math.max(0, ...fr)),
    over33_min: r1(fr.filter(d => d > 33.4).length / mins), over50_min: r1(fr.filter(d => d > 50).length / mins), first5s_over50: f5, long_tasks: P.long.length,
    input_p95: r1(lat[Math.min(lat.length - 1, Math.floor(lat.length * .95))] || 0), input_n: lat.length,
    style_ms: Math.round((m1.RecalcStyleDuration - m0.RecalcStyleDuration) * 1000), layout_ms: Math.round((m1.LayoutDuration - m0.LayoutDuration) * 1000), layout_count: m1.LayoutCount - m0.LayoutCount,
    script_ms: Math.round((m1.ScriptDuration - m0.ScriptDuration) * 1000), task_ms: Math.round((m1.TaskDuration - m0.TaskDuration) * 1000),
    net: count(P.net), img: [...new Set(P.img)].slice(0, 8), anims_inf: anims
  });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  await D.again(page, r, r === ROUNDS - 1);
  await gc(); { const m = await metrics(); heap.push(r1(m.JSHeapUsedSize / 1048576)); nodes.push(m.Nodes); listeners.push(m.JSEventListeners); }
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU });
}
await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
// 게임을 나간 뒤 3초: 아직 도는 것
await D.exit(page); await sleep(1500);
const a0 = await page.evaluate(() => window.__gp.snap()); await sleep(3000);
const a1 = await page.evaluate(() => window.__gp.snap());
await gc(); const mEnd = await metrics();
const mid = k => { const xs = rounds.map(r => r[k]).sort((a, b) => a - b); return xs[xs.length >> 1]; };
console.log(JSON.stringify({
  game: GAME, cpu: CPU, rounds: ROUNDS,
  ...Object.fromEntries(['start_ms', 'seconds', 'fps', 'p95', 'max', 'over33_min', 'over50_min', 'first5s_over50', 'long_tasks', 'input_p95', 'style_ms', 'layout_ms', 'layout_count', 'script_ms', 'task_ms'].map(k => [k, mid(k)])),
  net: rounds[0].net, img: rounds[0].img, anims_inf: rounds[0].anims_inf, hidden,
  heap_mb: heap, nodes, listeners,
  after_exit: { raf_per_s: r1((a1.raf - a0.raf) / 3), intervals: a1.timers, audio: a1.audio, ctx_running: a1.ctx_running, anims_inf: a1.anims, heap_mb: r1(mEnd.JSHeapUsedSize / 1048576), nodes: mEnd.Nodes, listeners: mEnd.JSEventListeners },
  per_round: has('rounds-detail') ? rounds : undefined, errors: errors.slice(0, 3)
}));
await browser.close();
