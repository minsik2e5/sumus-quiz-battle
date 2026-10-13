// V13.146 던전 전투 프레임 측정(폰 그리기). 선생님이 본 증상: 사람 2~3명이 같이 하면 화면이 뚝뚝 끊기고,
// 봇과 하면 괜찮다(쓰기 · 객관식 모두, 아이폰 · 갤럭시 모두).
//
// 무엇을 돌리나: 진짜 던전 방(cloudflare/dungeon-room.mjs)과 엔진을 이 Node에서 돌리고(가짜 저장소 · 알람,
// 소켓은 진짜 WebSocket), 진짜 전투 화면(public/modules/dungeon.js)을 브라우저 탭으로 연다. 사람 학생 탭은
// 스스로 문제를 푼다(보기 누르기 · 쓰기 글자 누르기, 사람처럼 1.2~3.5초 · 글자 사이 0.18~0.35초, 약 80% 정답).
// 재는 탭(나)은 폰처럼: 가로 844×390, 화면 배율 3, 터치, CPU 4배 느리게.
//
// 잰 것: 초당 프레임, 33ms 넘은 프레임, 50ms 넘는 긴 작업(개수 · 가장 긴 것), 긴 작업 안에서 시간을 쓴
// 함수(크롬 Performance 기록의 JS 샘플) · 스타일 · 배치 · 그리기 시간, 내 폰이 받은 메시지 수.
//
// 사용: node server/dungeon-perf.mjs [--engine chromium|webkit] [--seconds 20] [--only 사람3-일반층]
// playwright가 필요하다(이 저장소 의존성이 아니다): PLAYWRIGHT=/경로/node_modules/playwright 로 알려 줄 수 있다.
// webkit은 playwright의 webkit 브라우저가 깔려 있어야 한다. webkit은 CPU 느리게 · 성능 기록이 없어서 프레임 ·
// 긴 작업(rAF 간격으로 잰다)만 본다.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { extname, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DungeonRoom } from '../cloudflare/dungeon-room.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const pub = resolve(root, 'public');
const require = createRequire(import.meta.url);
const arg = (name, fallback) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : fallback; };
const ENGINE = arg('engine', 'chromium');
const SECONDS = Number(arg('seconds', 20));
const ONLY = arg('only', '');
const CPU = Number(arg('cpu', 4));

function loadPlaywright() {
  for (const name of [process.env.PLAYWRIGHT, 'playwright', '/opt/node-tools/node_modules/playwright'].filter(Boolean)) {
    try { return require(name); } catch {}
  }
  throw Error('playwright를 찾지 못했어요. PLAYWRIGHT=/경로/node_modules/playwright 로 알려 주세요.');
}
function loadWsServer() {
  const pw = dirname(require.resolve('playwright-core/package.json', { paths: [process.env.PLAYWRIGHT || '/opt/node-tools/node_modules/playwright', root] }));
  return require(resolve(pw, 'lib/utilsBundle.js')).wsServer;
}

/* ---------- 문제: 쓰기 · 영어 고르기 · 뜻 고르기가 모두 나오게 ---------- */
const WORDS = 'apple river window garden pencil travel planet silver monkey basket doctor island bridge camera orange forest market rocket summer winter candle letter yellow pocket button castle dragon flower jacket ladder'.split(' ');
const questions = Array.from({ length: 150 }, (_, i) => {
  const w = WORDS[i % WORDS.length], others = WORDS.filter(x => x !== w);
  return { word_id: 'w' + i, prompt: w, meaning: `뜻 ${w}`, wrong: [1, 2, 3, 4, 5].map(k => `뜻 ${others[(i + k) % others.length]}`), wrong_en: [1, 2, 3, 4, 5].map(k => others[(i + k * 3) % others.length]) };
});
const PETS = [{ key: 'dog', form: 3 }, { key: 'cat', form: 3 }, { key: 'fox', form: 3 }];
const player = (id, i, extra = {}) => ({ id, name: extra.bot ? `봇 동료 ${i}` : `학생${id.toUpperCase()}`, grade: '고1', pet: PETS[i % 3], questions, cleared: [], ...extra });

/* ---------- 가짜 Durable Object(저장소 · 알람) + 진짜 소켓 ---------- */
function makeCtx(roomRef) {
  const store = new Map(), sockets = [];
  let timer = null;
  return {
    sockets,
    storage: {
      async get(key) { if (Array.isArray(key)) return new Map(key.filter(k => store.has(k)).map(k => [k, structuredClone(store.get(k))])); return store.has(key) ? structuredClone(store.get(key)) : undefined; },
      async put(key, value) { roomRef.puts = (roomRef.puts || 0) + 1; const entries = typeof key === 'object' ? Object.entries(key) : [[key, value]]; for (const [k, v] of entries) store.set(k, structuredClone(v)); },
      async setAlarm(time) { clearTimeout(timer); timer = setTimeout(() => roomRef.room?.alarm().catch(e => console.error('[alarm]', e)), Math.max(0, time - Date.now())); },
      async deleteAll() { store.clear(); clearTimeout(timer); }
    },
    blockConcurrencyWhile: fn => fn(),
    acceptWebSocket(ws, tags) { ws.tags = tags; sockets.push(ws); },
    getWebSockets(tag) { return sockets.filter(ws => ws.readyState === 1 && (!tag || ws.tags.includes(tag))); },
    getTags: ws => ws.tags,
    stop() { clearTimeout(timer); }
  };
}
// cloudflare/dungeon-room.mjs의 accept()는 WebSocketPair · 101 응답을 쓴다: Node에서는 준비해 둔 소켓 어댑터를 돌려준다.
let pendingAdapter = null;
globalThis.WebSocketPair = function () { return { 0: {}, 1: pendingAdapter }; };
const RealResponse = globalThis.Response;
globalThis.Response = class extends RealResponse { constructor(body, init = {}) { if (init?.status === 101) { super(null, { status: 200 }); return; } super(body, init); } };

const MIME = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.json': 'application/json', '.html': 'text/html' };
const PAGE = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><link rel="stylesheet" href="/app.bundle.css"></head>
<body><div id="app"></div><script type="module">
const u = new URLSearchParams(location.search).get('u');
document.cookie = 'u=' + u + '; path=/';
const { openDungeon } = await import('/modules/dungeon.js');
openDungeon({ data: { profile: { id: u, school: '강서고', class_name: '고1A' } }, school: '강서고', screen: '' }, () => {});
</script></body></html>`;

async function startServer(H) {
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://x');
    const u = /(?:^|; )u=([^;]+)/.exec(req.headers.cookie || '')?.[1] || url.searchParams.get('u');
    if (url.pathname === '/dungeon.html') { res.writeHead(200, { 'Content-Type': 'text/html' }); return res.end(PAGE); }
    if (url.pathname === '/api/dungeon/home') { res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ room: { id: H.roomId, ticket: `t-${u}`, code: '123456' }, cuts: [] })); }
    if (url.pathname === '/debug/q') {
      // 사람 학생 탭이 '사람처럼' 풀기 위한 정답(재는 앱 코드는 이것을 모른다).
      const q = H.room?.room?.state?.players?.[u]?.q;
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify(q ? { n: q.n, kind: q.kind, answer: q.answer, covered: q.covered, word: q.word || null } : {}));
    }
    if (url.pathname.startsWith('/api/')) { res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ pending: true })); }
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
    if (!/^\/api\/dungeon\/ws\//.test(url.pathname)) return socket.destroy();
    wss.handleUpgrade(req, socket, head, async real => {
      const adapter = { readyState: 1, tags: [], sent: 0, bytes: 0, send(text) { this.sent++; this.bytes += text.length; real.send(text); }, close(code, reason) { this.readyState = 3; try { real.close(code, reason); } catch {} } };
      const pid = url.searchParams.get('ticket').replace(/^t-/, '');
      H.adapters[pid] = adapter;
      real.on('message', data => { const type = /"type":"(\w+)"/.exec(data.toString())?.[1]; H.inMsgs[type] = (H.inMsgs[type] || 0) + 1; H.room.webSocketMessage(adapter, data.toString()).catch(e => console.error('[msg]', e)); });
      real.on('close', () => { if (adapter.readyState !== 3) { adapter.readyState = 3; H.room.webSocketClose(adapter).catch(() => {}); } });
      pendingAdapter = adapter;
      await H.room.accept(url);
      pendingAdapter = null;
    });
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  return server;
}

/* ---------- 사람 학생 탭: 스스로 문제를 푼다 ---------- */
const AUTOPLAY = () => {
  const rnd = (a, b) => a + Math.random() * (b - a), sleep = ms => new Promise(r => setTimeout(r, ms));
  let busy = false, lastN = null;
  setInterval(async () => {
    if (busy) return;
    const opts = [...document.querySelectorAll('.dgs-opt')], tiles = [...document.querySelectorAll('.dgs-tile')];
    if (!opts.length && !tiles.length) return;
    const q = await (await fetch('/debug/q')).json().catch(() => ({}));
    if (!q.n || q.n === lastN) return;
    lastN = q.n; busy = true;
    try {
      const right = Math.random() < 0.8;
      if (q.kind === 'spell') {
        await sleep(rnd(900, 1800));
        if (!right) { const t = [...document.querySelectorAll('.dgs-tile:not([disabled])')].find(b => b.textContent !== q.word[0]); t?.click(); await sleep(rnd(180, 350)); }
        for (const ch of q.word) {
          const t = [...document.querySelectorAll('.dgs-tile')].find(b => b.textContent === ch && !b.disabled && !b.classList.contains('wait') && !b.classList.contains('used'));
          if (!t) break;
          t.click();
          await sleep(rnd(180, 350));
        }
      } else {
        await sleep(rnd(1200, 3500));
        const pick = right ? q.answer : [0, 1, 2, 3].find(i => i !== q.answer && i !== q.covered);
        document.querySelector(`.dgs-opt[data-choice="${pick}"]`)?.click();
      }
    } finally { busy = false; }
  }, 120);
};
// 재는 탭: 프레임 간격과 긴 작업을 모은다.
const PROBE = () => {
  const P = window.__perf = { frames: [], long: [], on: false };
  let last = 0;
  const loop = t => { if (P.on && last) P.frames.push(t - last); last = t; requestAnimationFrame(loop); };
  requestAnimationFrame(loop);
  try { new PerformanceObserver(list => { if (P.on) for (const e of list.getEntries()) P.long.push(Math.round(e.duration)); }).observe({ type: 'longtask', buffered: false }); } catch {}
  // webkit에는 longtask가 없다: rAF 간격이 50ms를 넘으면 긴 작업으로 센다(아래 결과에서 표시).
};

/* ---------- 한 경우 ---------- */
async function scenario(pw, { name, humans, boss }) {
  const H = { roomId: '00000000-0000-4000-8000-' + String(Date.now()).slice(-12).padStart(12, '0'), adapters: {}, room: null, inMsgs: {} };
  const ref = {};
  const ctx = makeCtx(ref);
  const env = { VOCA_STATE_SECRET: 'perf', VOCA_STATE: { idFromName: n => n, get: () => ({ fetch: async () => new RealResponse('{}', { status: 200 }) }) } };
  H.room = ref.room = new DungeonRoom(ctx, env);
  await H.room.ready;
  const ids = ['a', 'b', 'c'].slice(0, humans);
  await H.room.admin({ action: 'init', id: H.roomId, cut: 'c3', grade: '고1', host: player('a', 0), ticket: 't-a', seed: 7, lobby_until: Date.now() + 600000 });
  for (let i = 1; i < humans; i++) await H.room.admin({ action: 'join', player: player(ids[i], i), ticket: `t-${ids[i]}` });
  const server = await startServer(H);
  const base = `http://127.0.0.1:${server.address().port}`;

  const type = pw[ENGINE];
  // --gpu: 폰처럼 캔버스 · 그림을 GPU로 그린다(이 컴퓨터에는 GPU가 없어 SwiftShader가 대신한다).
  const gpuArgs = process.argv.includes('--gpu') ? ['--enable-gpu', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-gpu-rasterization'] : [];
  const meBrowser = await type.launch(ENGINE === 'chromium' ? { args: ['--autoplay-policy=no-user-gesture-required', ...gpuArgs] } : {});
  const peerBrowser = humans > 1 ? await pw.chromium.launch() : null;
  const phone = { viewport: { width: 844, height: 390 }, deviceScaleFactor: 3, isMobile: ENGINE !== 'firefox', hasTouch: true };
  const meCtx = await meBrowser.newContext({ ...phone, ...(process.argv.includes('--reduced') ? { reducedMotion: 'reduce' } : {}) });
  const me = await meCtx.newPage();
  me.on('pageerror', e => console.error('[me pageerror]', e.message));
  if (!process.argv.includes('--idle')) await me.addInitScript(AUTOPLAY);
  await me.addInitScript(PROBE);
  const peers = [];
  for (const id of ids.slice(1)) {
    const c = await peerBrowser.newContext({ viewport: { width: 844, height: 390 } });
    const p = await c.newPage();
    p.on('pageerror', e => console.error(`[${id} pageerror]`, e.message));
    if (!process.argv.includes('--idle')) await p.addInitScript(AUTOPLAY);
    await p.goto(`${base}/dungeon.html?u=${id}`);
    peers.push(p);
  }
  await me.goto(`${base}/dungeon.html?u=a`);
  let cdp = null;
  if (ENGINE === 'chromium') { cdp = await meCtx.newCDPSession(me); await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU }); await cdp.send('Performance.enable'); }
  // 봇 동료(처음부터 준비).
  for (let i = humans; i < 3; i++) await H.room.admin({ action: 'bot', player: player(`bot-${i}`, i, { bot: true }) });
  // 모두 준비.
  for (const p of [me, ...peers]) { await p.waitForSelector('[data-dg="ready"]', { timeout: 20000 }); await p.click('[data-dg="ready"]'); }
  const st = () => H.room.room.state;
  const waitFor = async (fn, ms = 20000) => { const t0 = Date.now(); while (!fn()) { if (Date.now() - t0 > ms) throw Error(`${name}: 기다리다 시간 초과`); await new Promise(r => setTimeout(r, 50)); } };
  await waitFor(() => st().phase === 'intro');
  if (boss) st().floor = 5; // 입장 연출이 끝나면 6층(보스)부터
  await waitFor(() => st().phase === 'fight' && st().monster);
  // 측정 중에 몬스터가 쓰러지지 않게 체력을 크게(보스는 61%에서 시작해 첫 정답에 2페이즈, 절반쯤 3페이즈).
  const m = st().monster;
  m.max_hp = 1_000_000; m.hp = boss ? 610_000 : 1_000_000;
  for (const id of st().order) st().players[id].hp = 100;
  await new Promise(r => setTimeout(r, 1500));

  const sent0 = H.adapters.a?.sent || 0, bytes0 = H.adapters.a?.bytes || 0, puts0 = ref.puts || 0, in0 = { ...H.inMsgs };
  const out0 = Object.values(H.adapters).reduce((n, a) => n + a.sent, 0);
  let trace = null;
  if (ENGINE === 'chromium') {
    await meBrowser.startTracing(me, { categories: ['devtools.timeline', 'disabled-by-default-devtools.timeline', 'disabled-by-default-v8.cpu_profiler', 'v8.execute', 'blink.user_timing'] });
  }
  // 기록을 켜는 순간의 멈춤(성능 기록 도구 자체)은 세지 않는다.
  await new Promise(r => setTimeout(r, 600));
  const pm0 = cdp ? await cdp.send('Performance.getMetrics') : null;
  await me.evaluate(() => { performance.mark('dg-perf-start'); window.__perf.on = true; });
  const half = SECONDS * 500;
  await new Promise(r => setTimeout(r, half));
  if (arg('shot')) await me.screenshot({ path: `${arg('shot')}-${name}.png` }).catch(e => console.error('[shot]', e.message));
  if (boss && st().monster?.boss) { st().monster.hp = Math.min(st().monster.hp, 310_000); }
  for (const id of st().order) if (st().players[id].hp < 40) st().players[id].hp = 100;
  await new Promise(r => setTimeout(r, SECONDS * 1000 - half));
  const probe = await me.evaluate(() => { window.__perf.on = false; performance.mark('dg-perf-end'); return window.__perf; });
  const pm1 = cdp ? await cdp.send('Performance.getMetrics') : null;
  if (ENGINE === 'chromium') { const buf = await meBrowser.stopTracing(); trace = JSON.parse(buf.toString()); if (arg('dump')) (await import('node:fs')).writeFileSync(`${arg('dump')}-${name}.json`, buf); }
  const msgs = (H.adapters.a?.sent || 0) - sent0, kb = ((H.adapters.a?.bytes || 0) - bytes0) / 1024;
  // 서버 쪽: 방이 받은 메시지(종류별) · 보낸 메시지(모든 폰) · 저장(put) 수, 1초당.
  const serverSide = { savesPerSec: +(((ref.puts || 0) - puts0) / SECONDS).toFixed(2), outPerSec: +((Object.values(H.adapters).reduce((n, a) => n + a.sent, 0) - out0) / SECONDS).toFixed(1), inPerSec: Object.fromEntries(Object.entries(H.inMsgs).map(([k, v]) => [k, +((v - (in0[k] || 0)) / SECONDS).toFixed(2)]).filter(([, v]) => v > 0)) };

  const frames = probe.frames, total = frames.reduce((a, b) => a + b, 0) / 1000;
  const result = {
    name, engine: ENGINE, phase: st().phase, floor: st().floor,
    fps: +(frames.length / total).toFixed(1),
    slow33: frames.filter(f => f > 33.4).length,
    worstFrame: Math.round(Math.max(...frames)),
    long50: ENGINE === 'chromium' ? probe.long.length : frames.filter(f => f > 50).length,
    longMax: ENGINE === 'chromium' ? Math.max(0, ...probe.long) : Math.round(Math.max(...frames)),
    msgsPerSec: +(msgs / SECONDS).toFixed(1), kbPerSec: +(kb / SECONDS).toFixed(1), server: serverSide
  };
  if (pm0 && pm1) {
    const get = (pm, k) => pm.metrics.find(x => x.name === k)?.value || 0;
    for (const k of ['ScriptDuration', 'RecalcStyleDuration', 'LayoutDuration', 'TaskDuration']) result[k.replace('Duration', 'ms')] = Math.round((get(pm1, k) - get(pm0, k)) * 1000);
  }
  if (trace) Object.assign(result, analyzeTrace(trace));
  for (const b of [meBrowser, peerBrowser]) await b?.close();
  ctx.stop();
  server.close();
  return result;
}

/* ---------- 성능 기록 읽기: 긴 작업과 그 안에서 시간을 쓴 것 ---------- */
function analyzeTrace(trace) {
  const events = trace.traceEvents || trace;
  const names = new Map(); // pid:tid → thread name
  for (const e of events) if (e.ph === 'M' && e.name === 'thread_name') names.set(`${e.pid}:${e.tid}`, e.args.name);
  const mains = [...names].filter(([, n]) => n === 'CrRendererMain').map(([k]) => k);
  const count = k => events.filter(e => `${e.pid}:${e.tid}` === k && e.ph === 'X').length;
  const main = mains.sort((a, b) => count(b) - count(a))[0];
  // 잰 구간(performance.mark 'dg-perf-start' ~ 'dg-perf-end')만 본다.
  const mark = name => events.find(e => e.name === name && `${e.pid}:${e.tid}` === main)?.ts;
  const from = mark('dg-perf-start') ?? -Infinity, to = mark('dg-perf-end') ?? Infinity;
  const onMain = events.filter(e => `${e.pid}:${e.tid}` === main && e.ts >= from && e.ts <= to);
  const tasks = onMain.filter(e => e.ph === 'X' && e.name === 'RunTask' && e.dur > 50000).map(e => ({ ts: e.ts, end: e.ts + e.dur, dur: e.dur / 1000 }));
  const inLong = ts => tasks.some(t => ts >= t.ts && ts < t.end);
  // 긴 작업 안: 스타일 · 배치 · 그리기 · 이벤트 종류.
  const kinds = {};
  for (const e of onMain) {
    if (e.ph !== 'X' || !inLong(e.ts)) continue;
    const k = { UpdateLayoutTree: 'style', Layout: 'layout', Paint: 'paint', PrePaint: 'prepaint', Layerize: 'layerize', ParseHTML: 'parseHTML', FireAnimationFrame: 'rAF', TimerFire: 'timer', EventDispatch: 'event', FunctionCall: 'js-call', 'v8.compile': 'compile' }[e.name];
    if (k) kinds[k] = (kinds[k] || 0) + e.dur / 1000;
  }
  // JS 샘플(ProfileChunk): 함수별 self 시간(전체, 긴 작업 안).
  const nodes = new Map();
  const self = new Map(), selfLong = new Map();
  let t = null;
  const profPid = main.split(':')[0];
  for (const e of events) {
    if (String(e.pid) !== profPid) continue;
    if (e.name === 'ProfileChunk' && (e.ts < from || e.ts > to)) { const d = e.args.data; for (const n of d.cpuProfile?.nodes || []) nodes.set(n.id, n.callFrame); t ??= e.ts; for (const x of d.timeDeltas || []) t += x; continue; }
    if (e.name === 'Profile') t = e.args.data.startTime;
    if (e.name !== 'ProfileChunk') continue;
    const d = e.args.data, cp = d.cpuProfile || {};
    for (const n of cp.nodes || []) nodes.set(n.id, n.callFrame);
    t ??= e.ts;
    (cp.samples || []).forEach((id, i) => {
      t += (d.timeDeltas?.[i] || 0);
      const cf = nodes.get(id) || {};
      const key = `${cf.functionName || '(anonymous)'} ${String(cf.url || '').replace(/^.*\/(modules\/)?/, '')}:${(cf.lineNumber ?? -1) + 1}`;
      if (/\(idle\)|\(program\)|\(garbage collector\)|\(root\)/.test(cf.functionName || '')) return;
      const dt = (d.timeDeltas?.[i + 1] || 100) / 1000;
      self.set(key, (self.get(key) || 0) + dt);
      if (inLong(t)) selfLong.set(key, (selfLong.get(key) || 0) + dt);
    });
  }
  // 메인 스레드에서 종류별로 쓴 시간(자기 시간): 스크립트 · 스타일 · 배치 · 그리기 · 올리기(Commit).
  const xs = onMain.filter(e => e.ph === 'X').sort((a, b) => a.ts - b.ts || b.dur - a.dur), selfBy = {}, stack = [];
  for (const e of xs) { while (stack.length && stack.at(-1).ts + stack.at(-1).dur <= e.ts) stack.pop(); if (stack.length) selfBy[stack.at(-1).name] = (selfBy[stack.at(-1).name] || 0) - e.dur; selfBy[e.name] = (selfBy[e.name] || 0) + e.dur; stack.push(e); }
  const mainMs = Object.fromEntries(['FunctionCall', 'UpdateLayoutTree', 'Layout', 'PrePaint', 'Paint', 'Layerize', 'Commit'].map(k => [k, Math.round((selfBy[k] || 0) / 1000)]));
  const top = map => [...map].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, v]) => `${k} ${v.toFixed(0)}ms`);
  return { mainMs, traceLong: tasks.length, traceLongMs: tasks.map(t => Math.round(t.dur)).sort((a, b) => b - a).slice(0, 6), inLong: Object.fromEntries(Object.entries(kinds).map(([k, v]) => [k, Math.round(v)])), topJs: top(self), topJsInLong: top(selfLong) };
}

const SCENARIOS = [
  { name: '사람3-일반층', humans: 3, boss: false },
  { name: '사람1+봇2-일반층', humans: 1, boss: false },
  { name: '사람3-보스층', humans: 3, boss: true },
  { name: '사람1+봇2-보스층', humans: 1, boss: true }
];

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const pw = loadPlaywright();
  const out = [];
  for (const s of SCENARIOS.filter(s => !ONLY || ONLY.split(',').includes(s.name))) {
    const r = await scenario(pw, s);
    out.push(r);
    console.log(JSON.stringify(r, null, 1));
  }
  console.log('\n경우 | 초당 프레임 | 33ms 넘은 프레임 | 50ms 넘는 긴 작업(가장 긴 것) | 내 폰이 받은 메시지/초');
  for (const r of out) console.log(`${r.name} (${r.engine}) | ${r.fps} | ${r.slow33} | ${r.long50} (${r.longMax}ms) | ${r.msgsPerSec} (${r.kbPerSec}KB)`);
  process.exit(0);
}
