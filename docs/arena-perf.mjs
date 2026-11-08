// V13.226 펫 아레나 폰 화면 프레임 측정(그리기 쪽, 검사에는 넣지 않는다). docs/yacha-perf.mjs와 같은 방식.
// 선생님이 본 증상: "지금 렉 살짝 걸린다"(테스트 앱 · 폰).
//
// 무엇을 돌리나: 진짜 아레나 화면(public/modules/arena.js)을 폰처럼(세로 390×844, 배율 3, 터치, CPU N배 느리게) 연다.
// 서버는 가짜(/api/games/arena/start · finish만 흉내). 전투 계산은 진짜 arena-rules.js다.
// 탭이 스스로 조종한다: 120ms마다 방향을 바꾸고, 공격은 계속 누르고, 스킬 1 · 2 · 필살기 · 회피를 틈틈이 누른다(키보드 이벤트).
//
// 잰 것: 프레임 간격(평균 · 95%), 33ms · 50ms 넘은 프레임(분당), 50ms 넘는 긴 작업, 입력 지연(누른 시각 → 다음 프레임이 그려진 직후),
//   스타일 재계산 · 배치 시간, 효과 조각이 떠 있는 프레임만 따로.
//
// 사용: node docs/arena-perf.mjs [--cpu 4] [--seconds 70] [--lite auto|off] [--profile] [--trace] [--css '실험 CSS'] [--shot 파일.png] [--mode ffa|2v2]
// V13.232 --mode ffa | 2v2: 1:1:1 난투(펫 3마리) · 2:2 팀전(펫 4마리)을 잰다. 방은 페이지 안에서 흉내 낸다(0.1초마다 내 조작을 확정해 돌려줌),
//   다른 자리는 컴퓨터(보통)가 조종하므로 경기장에 펫이 3 · 4마리 동시에 싸운다. 화면 · 전투는 진짜(arena.js · createLiveSimN).
// playwright가 필요하다(이 저장소 의존성이 아니다). 먼저 npm run build:assets(public/app.bundle.css).
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { extname, resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const arg = (name, fallback) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : fallback; };
const pub = resolve(here, 'public');
const CPU = Number(arg('cpu', 4));
const SECONDS = Number(arg('seconds', 70));
const SHOT = arg('shot', '');
const { fighter } = await import(pathToFileURL(resolve(pub, 'modules/arena-rules.js')).href);

function loadPlaywright() {
  for (const name of [process.env.PLAYWRIGHT, 'playwright', '/opt/node-tools/node_modules/playwright'].filter(Boolean)) {
    try { return require(name); } catch {}
  }
  throw Error('playwright를 찾지 못했어요. PLAYWRIGHT=/경로/node_modules/playwright 로 알려 주세요.');
}

// 내 팀: 신화(독 · 구슬) · 전설(불 · 빔) · 일반(바위 · 지진). 상대: 불 빔 · 물 구슬 · 바람 돌진 → 모양이 다 나온다.
const ME = ['gumiho', 'phoenix', 'bear'], FOE = ['dragon', 'turtle', 'dog'];
// V13.229 스킬 ②: 두 쪽이 서로 다른 새 스킬을 고른다(내 팀 독침 연사 · 불 뿜기 · 지진 장판, 상대 운석 낙하 · 물대포 · 질풍 연속 베기).
//   --s2 a|b: 모두 A(0) 또는 B(1)로 바꿔 다른 스킬도 잰다.
const S2 = arg('s2', '') === 'a' ? [0, 0, 0] : arg('s2', '') === 'b' ? [1, 1, 1] : null;
const brief = (key, i, mine) => { const s2 = S2 ? S2[i] : mine ? [1, 0, 1][i] : [1, 0, 1][i]; const f = fighter({ key, form: 3, level: 20, s2 }); return { key, form: 3, level: 20, s2, hp: f.hp, atk: f.atk, el: f.el, shape: f.shape, rank: f.rank, skill: f.skill, ult: f.ult }; };
const MATCH = { id: 'perf', seed: 12345, foe_level: 1, me: ME.map((k, i) => brief(k, i, true)), foe: { name: '친구', bot: false, team: FOE.map((k, i) => brief(k, i, false)) }, team: ME, left: 5, tickets: 3, coin_play: true, wins: 0, streak: 0, best_streak: 0 };
const PETS = ME.map((key, i) => ({ key, form: 3, level: 20 - i, active: i === 0 }));

const MIME = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.json': 'application/json', '.html': 'text/html' };
const MODE = arg('mode', '');
const MULTI_PETS = [['gumiho', 'bear'], ['dragon', 'turtle'], ['phoenix', 'dog'], ['tiger', 'penguin']];
const sideOf = (i, tm, x, y) => ({ side: `p${i}`, tm, x, y, bot: i > 0, name: i === 0 ? '나' : `친구 ${i}`, team: MULTI_PETS[i].map((key, j) => ({ key, form: 3, level: 20, s2: (i + j) & 1 })) });
const MULTI_SIDES = MODE === 'ffa' ? [sideOf(0, 0, 50, 78), sideOf(1, 1, 18, 24), sideOf(2, 2, 82, 24)]
  : [sideOf(0, 0, 32, 76), sideOf(1, 0, 68, 76), sideOf(2, 1, 32, 24), sideOf(3, 1, 68, 24)];
const MULTI_PAGE = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><link rel="stylesheet" href="/app.bundle.css"></head>
<body><div id="app"></div><script type="module">
const { openArena, arenaMatch } = await import('/modules/arena.js');
const { createLiveSimN } = await import('/modules/arena-live-rules.js');
const { fighter } = await import('/modules/arena-rules.js');
const A = { data: { profile: { id: 'me', display_name: '나', role: 'student' }, stats: { pets: ${JSON.stringify(PETS)}, points_balance: 100 }, rewards: {} }, screen: 'arena' };
openArena(A, () => {});
const sides = ${JSON.stringify(MULTI_SIDES)}, mode = '${MODE}';
let pending = [], lastC = -1, start = 0;
const sim = createLiveSimN({ seed: 4321, mode, sides, side: 'p0', send: l => pending.push(...l) });
// 방 흉내: 0.1초마다 (지금 틱 − 4)까지 확정해 돌려준다(내 조작만, 나머지는 컴퓨터).
setInterval(() => {
  if (!start) return;
  sim.flush();
  const c = Math.floor((performance.now() - start) / 50) - 4; if (c <= lastC) return;
  const l = pending.filter(x => x[0] <= c).map(x => [0, Math.max(x[0], lastC + 1), ...x.slice(1)]);
  pending = pending.filter(x => x[0] > c); lastC = c;
  sim.onBatch({ c, l });
  if (sim.C.S.over && !sim.roomOver) sim.end({ winner: sim.C.S.winner, ticks: sim.C.S.t });
}, 100);
const brief = t => t.map(f => ({ ...f, el: fighter(f).el }));
const info = slot => { const s = sides.find(x => x.side === sim.back[slot]); return { slot, name: slot === 'me' ? '나' : s.name, team: brief(s.team), ally: slot === 'me' || sim.allies.includes(slot), me: slot === 'me' }; };
const r = { id: 'perf', seed: 4321, live: true, multi: true, mode, me: brief(sides[0].team), foe: { name: info('foe').name, team: info('foe').team }, others: sim.slots.filter(w => w !== 'me' && w !== 'foe').map(info), people: [...sim.slots.filter(w => w !== 'me'), 'me'].map(info), title: mode, foe_level: 1 };
setTimeout(() => arenaMatch(r, { sim, live: true, want: now => { start ||= now; return (now - start) / 50; }, finish: async () => ({ paid: false, reason: 'replay' }), why: () => '', buttons: () => '', quit: () => {}, mounted: () => {} }), 300);
</script></body></html>`;
const PAGE = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><link rel="stylesheet" href="/app.bundle.css"></head>
<body><div id="app"></div><script type="module">
const { openArena } = await import('/modules/arena.js');
const A = { data: { profile: { id: 'me', display_name: '나', role: 'student' }, stats: { pets: ${JSON.stringify(PETS)}, points_balance: 100 }, rewards: {} }, screen: 'arena' };
openArena(A, () => {});
setTimeout(() => document.querySelector('[data-ar="start"]')?.click(), 600);
</script></body></html>`;

async function startServer() {
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://x');
    const json = body => { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(body)); };
    if (url.pathname === '/arena.html') { res.writeHead(200, { 'Content-Type': 'text/html' }); return res.end(MODE ? MULTI_PAGE : PAGE); }
    if (url.pathname === '/api/games/arena/start') return json(MATCH);
    if (url.pathname === '/api/games/arena/finish') return json({ winner: 'me', paid: false, reason: 'short' });
    if (url.pathname.startsWith('/api/')) return json({});
    try {
      const file = resolve(pub, '.' + decodeURIComponent(url.pathname));
      if (!file.startsWith(pub)) throw Error('bad path');
      const body = await readFile(file);
      res.writeHead(200, { 'Content-Type': MIME[extname(file)] || 'application/octet-stream', 'Cache-Control': 'max-age=600' });
      res.end(body);
    } catch { res.writeHead(404); res.end('not found'); }
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  return server;
}

/* ---------- 탭이 스스로 조종한다(키보드 이벤트 = 화면 버튼과 같은 press()) ---------- */
const AUTOPLAY = () => {
  const key = (type, code) => document.dispatchEvent(new KeyboardEvent(type, { code, bubbles: true }));
  const DIRS = [['KeyW'], ['KeyS'], ['KeyA'], ['KeyD'], ['KeyW', 'KeyA'], ['KeyW', 'KeyD'], ['KeyS', 'KeyA'], ['KeyS', 'KeyD'], []];
  let held = [], atk = false, n = 0;
  setInterval(() => {
    if (!document.getElementById('ar-pad')) { held = []; atk = false; return; }
    n++;
    if (n % 6 === 0) { for (const c of held) key('keyup', c); held = DIRS[Math.floor(Math.random() * DIRS.length)]; for (const c of held) key('keydown', c); }
    if (!atk) { key('keydown', 'KeyJ'); atk = true; }
    const r = Math.random();
    if (r < .04) key('keydown', 'KeyK'); else if (r < .07) key('keydown', 'KeyI'); else if (r < .10) key('keydown', 'KeyL'); else if (r < .14) key('keydown', 'Space');
  }, 120);
};
const PROBE = () => {
  const P = window.__perf = { frames: [], fxFrames: [], long: [], input: [], on: false, fxMax: 0, tagLong: {}, tagAll: {} };
  let last = 0, tags = new Set();
  // 프레임마다 무엇이 생겼나(효과 조각 · 배너 · 컷인 · 그림 바꾸기)를 적어 두고, 긴 프레임(50ms+)에 무엇이 있었나 센다.
  const mo = new MutationObserver(list => { for (const m of list) {
    if (m.type === 'childList') for (const n of m.addedNodes) { if (n.nodeType === 1) tags.add((n.className?.baseVal ?? n.className ?? n.nodeName).toString().split(' ').filter(c => c && c !== 'ar-fx').slice(0, 2).join('.') || n.nodeName); }
    else if (m.attributeName === 'src') tags.add('img-src');
    else if (m.attributeName === 'class' && /ar-app/.test(m.target.className)) tags.add('app:' + m.target.className.replace(/session-app|ar-app|playing/g, '').trim());
  } });
  document.addEventListener('DOMContentLoaded', () => mo.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['src', 'class'] }));
  const loop = t => {
    const playing = !!document.getElementById('ar-pad');
    if (playing && !P.on) { P.on = true; P.t0 = t; }
    if (P.on && playing && last) {
      const d = t - last; P.frames.push(d);
      for (const k of tags) { P.tagAll[k] = (P.tagAll[k] || 0) + 1; if (d > 50) P.tagLong[k] = (P.tagLong[k] || 0) + 1; }
      if (d > 50) P.tagLong['(모든 긴 프레임)'] = (P.tagLong['(모든 긴 프레임)'] || 0) + 1;
      const fx = document.querySelectorAll('#ar-field .ar-fx').length; if (fx) P.fxFrames.push(d); if (fx > P.fxMax) P.fxMax = fx;
    }
    if (P.on && !playing && !P.t1) P.t1 = t;
    last = t; tags = new Set(); requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
  try { new PerformanceObserver(list => { if (P.on && !P.t1) for (const e of list.getEntries()) P.long.push(Math.round(e.duration)); }).observe({ type: 'longtask', buffered: false }); } catch {}
  document.addEventListener('keydown', e => {
    if (!P.on || P.t1 || e.code === 'KeyW' || e.code === 'KeyA' || e.code === 'KeyS' || e.code === 'KeyD') return;
    const t0 = performance.now();
    requestAnimationFrame(() => { const ch = new MessageChannel(); ch.port1.onmessage = () => P.input.push(performance.now() - t0); ch.port2.postMessage(0); });
  }, true);
};

const pct = (xs, p) => { if (!xs.length) return 0; const s = [...xs].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(s.length * p))]; };
const avg = xs => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
const r1 = x => Math.round(x * 10) / 10;

async function main() {
  const pw = loadPlaywright();
  const server = await startServer();
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await pw.chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  const me = await ctx.newPage();
  me.on('pageerror', e => console.error('[pageerror]', e.message));
  await me.addInitScript(AUTOPLAY);
  await me.addInitScript(PROBE);
  const LITE = arg('lite', 'off');
  await me.addInitScript(mode => { try { if (mode === 'off') localStorage.removeItem('sumus-arena-lite'); else if (mode === 'on') localStorage.setItem('sumus-arena-lite', String(Date.now())); } catch {} }, LITE);
  // --lite off: 자동 단계도 못 켜게 막는다(보통 연출 그대로 잰다).
  if (LITE === 'off') await me.addInitScript(() => { const s = Storage.prototype.setItem; Storage.prototype.setItem = function (k, v) { if (k === 'sumus-arena-lite') return; return s.call(this, k, v); }; });
  const EXTRA = arg('css', '');
  if (EXTRA) await me.addInitScript(css => document.addEventListener('DOMContentLoaded', () => { const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st); }), EXTRA);
  const cdp = await ctx.newCDPSession(me);
  await cdp.send('Performance.enable');
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU });
  const PROFILE = process.argv.includes('--profile'), TRACE = process.argv.includes('--trace');
  await me.goto(`${base}/arena.html`);
  // --vs-shot 파일.png: VS 화면(판 시작 전)을 찍는다.
  if (arg('vs-shot', '')) { await me.waitForSelector('#ar-vs', { timeout: 30000 }); await new Promise(r => setTimeout(r, 1300)); await me.screenshot({ path: arg('vs-shot', ''), scale: 'css' }); }
  await me.waitForSelector('#ar-pad', { timeout: 30000 });
  if (TRACE) await browser.startTracing(me, { categories: ['devtools.timeline', 'disabled-by-default-devtools.timeline'] });
  if (PROFILE) { await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 200 }); await cdp.send('Profiler.start'); }
  const m0 = Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(m => [m.name, m.value]));
  const started = Date.now(); let shot = false;
  while (Date.now() - started < SECONDS * 1000) {
    await new Promise(r => setTimeout(r, 1000));
    if (SHOT && !shot && Date.now() - started > Number(arg('shot-at', 12000))) { await me.screenshot({ path: SHOT, scale: 'css' }); shot = true; }
    if (await me.evaluate(() => !!window.__perf.t1)) break;
  }
  // --probe '식': 끝에 페이지에서 식을 돌려 값을 찍는다(화면 확인용).
  if (arg('probe', '')) console.log('probe:', JSON.stringify(await me.evaluate(arg('probe', ''))));
  // --anims: 끝에 돌고 있는 애니메이션(무한 반복 포함) 이름과 대상.
  if (process.argv.includes('--anims')) console.log(await me.evaluate(() => { const c = {}; for (const a of document.getAnimations()) { const k = `${a.animationName || a.transitionProperty || 'waapi'} on .${String(a.effect?.target?.className?.baseVal ?? a.effect?.target?.className).split(' ').slice(0, 2).join('.')} x${a.effect?.getTiming?.().iterations}`; c[k] = (c[k] || 0) + 1; } return Object.entries(c).map(([k, v]) => `${v} ${k}`).join('\n'); }));
  const m1 = Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(m => [m.name, m.value]));
  const P = await me.evaluate(() => window.__perf);
  if (TRACE) {
    const trace = JSON.parse((await browser.stopTracing()).toString());
    const ev = trace.traceEvents.filter(e => e.ph === 'X' && e.dur);
    const sum = {}; for (const e of ev) if (['UpdateLayoutTree', 'Layout', 'Paint', 'PrePaint', 'Layerize', 'Commit', 'FunctionCall', 'FireAnimationFrame', 'TimerFire', 'EventDispatch', 'Decode Image', 'ImageDecodeTask', 'ParseHTML', 'MajorGC', 'MinorGC', 'HitTest'].includes(e.name)) sum[e.name] = (sum[e.name] || 0) + e.dur / 1000;
    console.log('trace(ms):', Object.entries(sum).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${Math.round(v)}`).join(' · '));
    const why = {};
    for (const e of trace.traceEvents) if (e.name === 'ScheduleStyleRecalculation' || e.name === 'InvalidateLayout') { const f = e.args?.data?.stackTrace?.[0]; const k = `${e.name}: ${f ? `${f.functionName || '(anon)'} ${String(f.url).split('/').pop()}:${f.lineNumber + 1}` : '(no js)'}`; why[k] = (why[k] || 0) + 1; }
    console.log(Object.entries(why).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([k, v]) => `${v} ${k}`).join('\n'));
  }
  if (PROFILE) {
    const { profile } = await cdp.send('Profiler.stop');
    const self = new Map(), dt = profile.timeDeltas, byId = new Map(profile.nodes.map(n => [n.id, n]));
    profile.samples.forEach((id, i) => { const n = byId.get(id), f = n.callFrame, k = `${f.functionName || '(anon)'} ${f.url.split('/').pop()}:${f.lineNumber + 1}`; self.set(k, (self.get(k) || 0) + (dt[i] || 0) / 1000); });
    console.log([...self].sort((a, b) => b[1] - a[1]).slice(0, 15).map(([k, v]) => `${Math.round(v)}ms ${k}`).join('\n'));
  }
  // --tags: 긴 프레임에 함께 있던 것(그 프레임에 생긴 효과 · 바뀐 그림). '긴/전체'가 높을수록 그것이 무겁다.
  if (process.argv.includes('--tags')) console.log(Object.entries(P.tagLong).sort((a, b) => b[1] - a[1]).slice(0, 16).map(([k, v]) => `${v}/${P.tagAll[k] ?? '-'} ${k}`).join('\n'));
  const secs = P.frames.reduce((a, b) => a + b, 0) / 1000;
  const mins = secs / 60;
  const out = {
    mode: MODE || '1v1', pets_max: await me.evaluate(() => document.querySelectorAll('.ar-mon').length), cpu: CPU, lite: LITE, seconds: r1(secs), frames: P.frames.length, fps: r1(P.frames.length / secs),
    frame_avg: r1(avg(P.frames)), frame_p95: r1(pct(P.frames, .95)), over33_per_min: r1(P.frames.filter(d => d > 33.4).length / mins), over50_per_min: r1(P.frames.filter(d => d > 50).length / mins),
    fx_frame_avg: r1(avg(P.fxFrames)), fx_frame_p95: r1(pct(P.fxFrames, .95)), fx_max: P.fxMax,
    long_tasks: P.long.length, long_max: Math.max(0, ...P.long),
    taps: P.input.length, input_avg: r1(avg(P.input)), input_p95: r1(pct(P.input, .95)), input_max: r1(Math.max(0, ...P.input)),
    style_ms: Math.round((m1.RecalcStyleDuration - m0.RecalcStyleDuration) * 1000), style_count: m1.RecalcStyleCount - m0.RecalcStyleCount,
    layout_ms: Math.round((m1.LayoutDuration - m0.LayoutDuration) * 1000), layout_count: m1.LayoutCount - m0.LayoutCount,
    script_ms: Math.round((m1.ScriptDuration - m0.ScriptDuration) * 1000), task_ms: Math.round((m1.TaskDuration - m0.TaskDuration) * 1000),
    nodes: m1.Nodes, lite_class: await me.evaluate(() => !!document.querySelector('.ar-app.ar-lite'))
  };
  console.log(JSON.stringify(out));
  await browser.close(); server.close();
  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
