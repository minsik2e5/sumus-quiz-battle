// V13.214 야차전 폰 화면 프레임 측정(그리기 쪽). 선생님이 본 증상: 대회 중 "야차전 화면이 뚝뚝 끊긴다, 단어를 눌렀는데 렉".
// 서버 쪽(메인 객체 복사)은 v13.212.0에서 고쳤다. 이 도구는 폰 화면 쪽만 잰다(검사에는 넣지 않는다).
//
// 무엇을 돌리나: 진짜 대결 방(cloudflare/battle-room.mjs)과 엔진을 이 Node에서 돌리고(가짜 저장소 · 알람,
// 소켓은 진짜 WebSocket), 진짜 야차전 화면(public/modules/battle.js)을 브라우저 탭 두 개로 연다.
// 두 탭 모두 스스로 문제를 푼다(1.2~2.8초, 나 약 85% · 상대 약 70% 정답) · 이모트도 가끔 보낸다.
// 재는 탭(나)은 폰처럼: 세로 390×844, 화면 배율 3, 터치, CPU N배 느리게. 펫은 신화(나) 대 전설(상대)이라
// 특기 · 등급 연출이 다 나온다(--pets dog,cat 처럼 바꿀 수 있다).
//
// 잰 것: 프레임 간격(평균 · 95%), 33ms · 50ms 넘은 프레임, 50ms 넘는 긴 작업, 답을 누른 순간부터 다음 화면이
// 그려질 때까지(입력 지연, 누른 시각 → 다음 프레임), 스타일 재계산 · 배치 시간(크롬 Performance.getMetrics).
//
// 사용: node docs/yacha-perf.mjs [--root ../다른-작업트리] [--cpu 4] [--seconds 75] [--pets gumiho,haechi] [--shot 파일.png]
//   --root: 다른 버전(예: v13.180 worktree)의 public · cloudflare를 같은 조건으로 잰다(전 · 후 비교).
// playwright가 필요하다(이 저장소 의존성이 아니다): PLAYWRIGHT=/경로/node_modules/playwright 로 알려 줄 수 있다.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { extname, resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const arg = (name, fallback) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : fallback; };
const ROOT = resolve(here, arg('root', '.'));
const pub = resolve(ROOT, 'public');
const CPU = Number(arg('cpu', 4));
const SECONDS = Number(arg('seconds', 75));
const [PET_ME, PET_OP] = arg('pets', 'gumiho,haechi').split(',');
const SHOT = arg('shot', '');
const { BattleRoom } = await import(pathToFileURL(resolve(ROOT, 'cloudflare/battle-room.mjs')).href);

function loadPlaywright() {
  for (const name of [process.env.PLAYWRIGHT, 'playwright', '/opt/node-tools/node_modules/playwright'].filter(Boolean)) {
    try { return require(name); } catch {}
  }
  throw Error('playwright를 찾지 못했어요. PLAYWRIGHT=/경로/node_modules/playwright 로 알려 주세요.');
}
function loadWsServer() {
  const pw = dirname(require.resolve('playwright-core/package.json', { paths: [process.env.PLAYWRIGHT || '/opt/node-tools/node_modules/playwright', here] }));
  return require(resolve(pw, 'lib/utilsBundle.js')).wsServer;
}

/* ---------- 문제 ---------- */
const WORDS = 'apple river window garden pencil travel planet silver monkey basket doctor island bridge camera orange forest market rocket summer winter candle letter yellow pocket button castle dragon flower jacket ladder'.split(' ');
const questions = Array.from({ length: 60 }, (_, i) => {
  const w = WORDS[i % WORDS.length], others = WORDS.filter(x => x !== w), answer = i % 4;
  const options = [0, 1, 2, 3].map(k => k === answer ? `뜻 ${w}` : `뜻 ${others[(i + k * 5) % others.length]}`);
  return { word_id: 'w' + i, prompt: w, options, answer };
});

/* ---------- 가짜 Durable Object(저장소 · 알람) + 진짜 소켓 ---------- */
function makeCtx(ref) {
  const store = new Map(), sockets = [];
  let timer = null;
  return {
    storage: {
      async get(key) { return store.has(key) ? structuredClone(store.get(key)) : undefined; },
      async put(key, value) { store.set(key, structuredClone(value)); },
      async setAlarm(time) { clearTimeout(timer); timer = setTimeout(() => ref.room?.alarm().catch(e => console.error('[alarm]', e)), Math.max(0, time - Date.now())); },
      async deleteAll() { store.clear(); clearTimeout(timer); }
    },
    blockConcurrencyWhile: fn => fn(),
    acceptWebSocket(ws, tags) { ws.tags = tags; sockets.push(ws); },
    getWebSockets(tag) { return sockets.filter(ws => ws.readyState === 1 && (!tag || ws.tags.includes(tag))); },
    getTags: ws => ws.tags,
    stop() { clearTimeout(timer); }
  };
}
let pendingAdapter = null;
globalThis.WebSocketPair = function () { return { 0: {}, 1: pendingAdapter }; };
const RealResponse = globalThis.Response;
globalThis.Response = class extends RealResponse { constructor(body, init = {}) { if (init?.status === 101) { super(null, { status: 200 }); return; } super(body, init); } };

const MIME = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.json': 'application/json', '.html': 'text/html' };
const PAGE = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><link rel="stylesheet" href="/app.bundle.css"></head>
<body><div id="app"></div><script type="module">
const u = new URLSearchParams(location.search).get('u');
document.cookie = 'u=' + u + '; path=/';
const { openBattle } = await import('/modules/battle.js');
const A = { data: { profile: { id: u, display_name: u, school: '단원고', school_id: 'danwon-high', class_name: '고1A', division: 'high', pets: [] }, stats: {}, coins: 0 }, screen: 'battle', tab: 'yacha' };
openBattle(A, () => {});
</script></body></html>`;

async function startServer(H) {
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://x');
    const u = /(?:^|; )u=([^;]+)/.exec(req.headers.cookie || '')?.[1] || url.searchParams.get('u');
    const json = body => { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(body)); };
    if (url.pathname === '/yacha.html') { res.writeHead(200, { 'Content-Type': 'text/html' }); return res.end(PAGE); }
    if (url.pathname === '/api/battle/current') return json({ battle: { id: H.roomId, ticket: `t-${u}`, status: 'active', stake: 10 } });
    if (url.pathname === '/api/battle/history') return json({ record: { wins: 0, losses: 0, draws: 0 }, battles: [], lost_today: 0, daily_loss_cap: 150 });
    if (url.pathname === '/debug/q') {
      // 탭이 '사람처럼' 풀기 위한 정답(재는 앱 코드는 이것을 모른다).
      const b = H.room?.room?.battle, q = b?.turn ? b.questions[b.turn.q] : null;
      return json(q ? { n: b.idx + 1, answer: q.answer, phase: b.phase } : { phase: b?.phase || 'none' });
    }
    if (url.pathname.startsWith('/api/')) return json({});
    try {
      const file = resolve(pub, '.' + decodeURIComponent(url.pathname));
      if (!file.startsWith(pub)) throw Error('bad path');
      const body = await readFile(file);
      res.writeHead(200, { 'Content-Type': MIME[extname(file)] || 'application/octet-stream', 'Cache-Control': 'max-age=600' });
      res.end(body);
    } catch { res.writeHead(404); res.end('not found'); }
  });
  const WSS = loadWsServer();
  const wss = new WSS({ noServer: true });
  server.on('upgrade', (req, socket, head) => {
    const url = new URL(req.url, 'http://x');
    if (!/^\/api\/battle\/ws\//.test(url.pathname)) return socket.destroy();
    wss.handleUpgrade(req, socket, head, async real => {
      const adapter = { readyState: 1, tags: [], send(text) { real.send(text); }, close(code, reason) { this.readyState = 3; try { real.close(code, reason); } catch {} } };
      real.on('message', data => { H.room.webSocketMessage(adapter, data.toString()).catch(e => console.error('[msg]', e)); });
      real.on('close', () => { if (adapter.readyState !== 3) { adapter.readyState = 3; H.room.webSocketClose(adapter).catch(() => {}); } });
      pendingAdapter = adapter;
      await H.room.accept(url);
      pendingAdapter = null;
    });
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  return server;
}

/* ---------- 탭이 스스로 푼다 ---------- */
const AUTOPLAY = accuracy => {
  const rnd = (a, b) => a + Math.random() * (b - a), sleep = ms => new Promise(r => setTimeout(r, ms));
  let busy = false, lastN = null, emoteAt = Date.now();
  setInterval(async () => {
    if (busy) return;
    const buttons = [...document.querySelectorAll('.yb-answer:not([disabled])')];
    if (!buttons.length) return;
    const q = await (await fetch('/debug/q')).json().catch(() => ({}));
    if (!q.n || q.n === lastN) return;
    lastN = q.n; busy = true;
    try {
      await sleep(rnd(1200, 2800));
      if (Date.now() - emoteAt > 9000 && Math.random() < .5) { emoteAt = Date.now(); document.querySelector('.yb-emote:not([disabled])')?.click(); await sleep(200); }
      const pick = Math.random() < accuracy ? q.answer : (q.answer + 1) % 4;
      document.querySelector(`.yb-answer[data-choice="${pick}"]:not([disabled])`)?.click();
    } finally { busy = false; }
  }, 120);
};
// 재는 탭: 프레임 간격 · 긴 작업 · 입력 지연을 모은다.
const PROBE = () => {
  const P = window.__perf = { frames: [], fxFrames: [], long: [], input: [], on: false };
  let last = 0;
  const loop = t => {
    if (P.on && last) { const d = t - last; P.frames.push(d); if (document.querySelector('#yb-arena [data-fx]')) P.fxFrames.push(d); }
    last = t; requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
  try { new PerformanceObserver(list => { if (P.on) for (const e of list.getEntries()) P.long.push(Math.round(e.duration)); }).observe({ type: 'longtask', buffered: false }); } catch {}
  // 직접 재기: 답 버튼을 누른 이벤트 시각 → 다음 rAF 뒤 첫 작업(화면이 그려진 직후).
  document.addEventListener('click', e => {
    if (!P.on || !e.target.closest?.('.yb-answer')) return;
    const t0 = e.timeStamp;
    requestAnimationFrame(() => { const ch = new MessageChannel(); ch.port1.onmessage = () => P.input.push(performance.now() - t0); ch.port2.postMessage(0); });
  }, true);
};

const pct = (xs, p) => { if (!xs.length) return 0; const s = [...xs].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(s.length * p))]; };
const avg = xs => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
const r1 = x => Math.round(x * 10) / 10;

async function main() {
  const pw = loadPlaywright();
  const H = { roomId: 'perf-' + Date.now() };
  const ref = {};
  const ctx = makeCtx(ref);
  const env = { VOCA_STATE_SECRET: 'perf', VOCA_STATE: { idFromName: n => n, get: () => ({ fetch: async () => new RealResponse('{}', { status: 200 }) }) } };
  H.room = ref.room = new BattleRoom(ctx, env);
  await H.room.ready;
  // HP 250(진짜와 같다). 둘 다 잘 맞히면 1분 반 안팎에 K.O. 또는 2분 시간 종료.
  const host = { id: 'me', name: '나', pet: { key: PET_ME, form: 3 }, tier: 'gold', streak: 3 };
  const guest = { id: 'op', name: '상대', pet: { key: PET_OP, form: 3 }, tier: 'silver' };
  await H.room.admin({ action: 'init', id: H.roomId, stake: 10, label: '대회 8강', mode: 'speed', host, questions, tickets: { me: 't-me' }, expires_at: Date.now() + 600000 });
  await H.room.admin({ action: 'join', guest, tickets: { me: 't-me', op: 't-op' } });
  const server = await startServer(H);
  const base = `http://127.0.0.1:${server.address().port}`;

  const browser = await pw.chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const peerBrowser = await pw.chromium.launch();
  const meCtx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  const me = await meCtx.newPage();
  me.on('pageerror', e => console.error('[me pageerror]', e.message));
  await me.addInitScript(AUTOPLAY, .85);
  await me.addInitScript(PROBE);
  // --lite auto: 저사양 자동 단계를 켠 채로 잰다(기본은 꺼서 '보통 연출' 그대로 잰다).
  const LITE = arg('lite', 'off');
  await me.addInitScript(mode => { try { if (mode === 'off') localStorage.setItem('sumus-yacha-lite', 'off'); else localStorage.removeItem('sumus-yacha-lite'); } catch {} }, LITE);
  const cdp = await meCtx.newCDPSession(me);
  await cdp.send('Performance.enable');
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU });

  const peerCtx = await peerBrowser.newContext({ viewport: { width: 390, height: 844 } });
  const peer = await peerCtx.newPage();
  peer.on('pageerror', e => console.error('[op pageerror]', e.message));
  await peer.addInitScript(AUTOPLAY, .7);

  await me.goto(`${base}/yacha.html?u=me`);
  await me.evaluate(() => { window.__perf.on = true; });
  // --profile: 크롬 JS 샘플(어느 함수가 시간을 썼나) 상위 15개를 함께 적는다.
  const PROFILE = process.argv.includes('--profile');
  // --trace: 크롬 성능 기록에서 50ms 넘는 작업마다 안에서 무엇이 시간을 썼는지(스타일 · 배치 · 그리기 · 그림 풀기 · JS).
  const TRACE = process.argv.includes('--trace');
  if (TRACE) await browser.startTracing(me, { categories: ['devtools.timeline', 'disabled-by-default-devtools.timeline', 'blink.user_timing'] });
  if (PROFILE) { await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 200 }); await cdp.send('Profiler.start'); }
  const m0 = Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(m => [m.name, m.value]));
  await peer.goto(`${base}/yacha.html?u=op`);
  const started = Date.now();
  let shotTaken = false;
  while (Date.now() - started < SECONDS * 1000) {
    await new Promise(r => setTimeout(r, 1000));
    if (SHOT && !shotTaken && await me.evaluate(() => !!document.querySelector('.yb-answer') && !!document.querySelector('#yb-arena .fx2-cut'))) { await me.screenshot({ path: SHOT, scale: 'css' }); shotTaken = true; }
    if (await me.evaluate(() => !document.getElementById('yb-arena') && !!document.querySelector('.yb-main .yb-result, .yb-main [class*="result"]'))) break;
  }
  // --anims: 끝에 돌고 있는 애니메이션(무한 반복 포함) 이름과 대상을 적는다.
  if (process.argv.includes('--anims')) console.log(await me.evaluate(() => document.getAnimations().map(a => `${a.animationName || a.transitionProperty || 'waapi'} on ${a.effect?.target?.className?.baseVal ?? a.effect?.target?.className} ${a.effect?.getTiming?.().iterations}`).join('\n')));
  const m1 = Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(m => [m.name, m.value]));
  const P = await me.evaluate(() => window.__perf);
  if (TRACE) {
    const trace = JSON.parse((await browser.stopTracing()).toString());
    const ev = trace.traceEvents.filter(e => e.ph === 'X' && e.dur);
    const main = ev.filter(e => e.name === 'RunTask' && e.dur > 50000 && e.args?.data === undefined);
    const tids = new Map(); for (const e of ev) if (e.name === 'UpdateLayoutTree') tids.set(`${e.pid}:${e.tid}`, (tids.get(`${e.pid}:${e.tid}`) || 0) + 1);
    const [mainKey] = [...tids].sort((a, b) => b[1] - a[1])[0] || [];
    const kids = ['UpdateLayoutTree', 'Layout', 'Paint', 'PrePaint', 'Layerize', 'Commit', 'ParseHTML', 'Decode Image', 'ImageDecodeTask', 'FunctionCall', 'EventDispatch', 'FireAnimationFrame', 'TimerFire', 'HitTest', 'v8.compile', 'ParseAuthorStyleSheet', 'MajorGC', 'MinorGC'];
    const rows = main.filter(t => `${t.pid}:${t.tid}` === mainKey).map(t => {
      const inside = ev.filter(e => `${e.pid}:${e.tid}` === mainKey && e.ts >= t.ts && e.ts + e.dur <= t.ts + t.dur && kids.includes(e.name));
      const sum = {}; for (const e of inside) sum[e.name] = (sum[e.name] || 0) + e.dur / 1000;
      const fn = inside.filter(e => e.name === 'FunctionCall').map(e => e.args?.data?.functionName || '').filter(Boolean);
      return `${Math.round(t.dur / 1000)}ms @${Math.round((t.ts - main[0].ts) / 1e6)}s ` + Object.entries(sum).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k, v]) => `${k} ${Math.round(v)}`).join(' · ') + (fn.length ? ` [${[...new Set(fn)].slice(0, 4).join(',')}]` : '');
    });
    console.log(rows.join('\n'));
    // 스타일 재계산을 부른 곳(JS면 함수 이름, 아니면 애니메이션 · 브라우저 스스로).
    const why = {};
    for (const e of trace.traceEvents) if (e.name === 'ScheduleStyleRecalculation' || e.name === 'InvalidateLayout') { const f = e.args?.data?.stackTrace?.[0]; const k = `${e.name}: ${f ? `${f.functionName || '(anon)'} ${String(f.url).split('/').pop()}:${f.lineNumber + 1}` : '(no js)'}`; why[k] = (why[k] || 0) + 1; }
    console.log(Object.entries(why).sort((a, b) => b[1] - a[1]).slice(0, 14).map(([k, v]) => `${v} ${k}`).join('\n'));
    const ult = trace.traceEvents.filter(e => e.name === 'UpdateLayoutTree' && e.ph === 'X');
    console.log('UpdateLayoutTree', ult.length, 'avg ms', (ult.reduce((a, e) => a + e.dur, 0) / ult.length / 1000).toFixed(2), 'elements avg', Math.round(ult.reduce((a, e) => a + (e.args?.elementCount || e.args?.data?.elementCount || 0), 0) / ult.length));
  }
  if (PROFILE) {
    const { profile } = await cdp.send('Profiler.stop');
    const self = new Map(), dt = profile.timeDeltas, byId = new Map(profile.nodes.map(n => [n.id, n]));
    profile.samples.forEach((id, i) => { const n = byId.get(id), f = n.callFrame, key = `${f.functionName || '(anon)'} ${f.url.split('/').pop()}:${f.lineNumber + 1}`; self.set(key, (self.get(key) || 0) + (dt[i] || 0) / 1000); });
    console.log([...self].sort((a, b) => b[1] - a[1]).slice(0, 15).map(([k, v]) => `${Math.round(v)}ms ${k}`).join('\n'));
  }
  if (SHOT && !shotTaken) await me.screenshot({ path: SHOT, scale: 'css' });
  const secs = (Date.now() - started) / 1000;
  const out = {
    root: ROOT === here ? '.' : ROOT, cpu: CPU, seconds: r1(secs), pets: `${PET_ME} vs ${PET_OP}`,
    frames: P.frames.length, fps: r1(P.frames.length / secs),
    frame_avg: r1(avg(P.frames)), frame_p95: r1(pct(P.frames, .95)), over33: P.frames.filter(d => d > 33.4).length, over50: P.frames.filter(d => d > 50).length,
    fx_frame_avg: r1(avg(P.fxFrames)), fx_frame_p95: r1(pct(P.fxFrames, .95)),
    long_tasks: P.long.length, long_max: Math.max(0, ...P.long), long_total: P.long.reduce((a, b) => a + b, 0),
    taps: P.input.length, input_avg: r1(avg(P.input)), input_p95: r1(pct(P.input, .95)), input_max: r1(Math.max(0, ...P.input)),
    style_ms: Math.round((m1.RecalcStyleDuration - m0.RecalcStyleDuration) * 1000), style_count: m1.RecalcStyleCount - m0.RecalcStyleCount,
    layout_ms: Math.round((m1.LayoutDuration - m0.LayoutDuration) * 1000), layout_count: m1.LayoutCount - m0.LayoutCount,
    script_ms: Math.round((m1.ScriptDuration - m0.ScriptDuration) * 1000), task_ms: Math.round((m1.TaskDuration - m0.TaskDuration) * 1000),
    nodes: m1.Nodes, lite: await me.evaluate(() => !!document.querySelector('.battle-app.yb-lite'))
  };
  console.log(JSON.stringify(out));
  await browser.close(); await peerBrowser.close();
  ctx.stop(); server.close();
  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
