// 펫 아레나 캔버스 연출 시험 페이지(public/proto/arena-fx.html) 폰 프레임 측정. docs/arena-perf.mjs와 같은 방식(검사에는 넣지 않는다).
// 무엇을 돌리나: 시험 페이지를 폰처럼(세로 390×844, 배율 3, 터치, CPU N배 느리게) 연다. 페이지가 스스로 번개 · 광선 · 지진 ·
//   얼음 · 독 · 필살기(파편 200개)를 10초마다 반복한다. 서버는 public/ 폴더를 그대로 내주는 작은 정적 서버.
// 잰 것: 프레임 간격(평균 · 95% · 가장 긴 것), 33ms · 50ms 넘은 프레임(분당), 50ms 넘는 긴 작업, JS 힙 · 캔버스 메모리,
//   파편 · 연기 · 불꽃 최대 개수, 자동 품질이 내려간 횟수.
// 사용: node docs/arena-fx-perf.mjs [--cpu 4] [--seconds 40] [--q auto|3|2|1|0 (높음 · 중간 · 낮음 · 최저)] [--pets 2|4] [--fx 0(효과 없이 바탕만)] [--gpu] [--shot 파일.jpg --shot-at 8300] [--json]
//   여러 줄 한 번에: node docs/arena-fx-perf.mjs --table  (CPU 1× · 4× · 6× × 품질 높음 · 자동, 펫 4)
// playwright가 필요하다(이 저장소 의존성이 아니다). 주의: 이 작업 환경의 크로뮴은 GPU가 없어 캔버스를 CPU로 그린다 → 진짜 폰(GPU 있음)보다 불리한 쪽으로 잰다.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { extname, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const pub = resolve(here, 'public');
const require = createRequire(import.meta.url);
const arg = (name, fallback) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : fallback; };
const MIME = { '.js': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml', '.html': 'text/html', '.woff2': 'font/woff2' };

function loadPlaywright() {
  for (const name of [process.env.PLAYWRIGHT, 'playwright', '/opt/node-tools/node_modules/playwright'].filter(Boolean)) { try { return require(name); } catch {} }
  throw Error('playwright를 찾지 못했어요. PLAYWRIGHT=/경로/node_modules/playwright 로 알려 주세요.');
}
async function startServer() {
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://x');
    try {
      const file = resolve(pub, '.' + decodeURIComponent(url.pathname));
      if (!file.startsWith(pub)) throw Error('bad path');
      const body = await readFile(file);
      // 운영과 같은 CSP(인라인 스크립트 금지)로 내준다 → 시험 페이지가 테스트 앱에서도 그대로 돈다는 확인
      res.writeHead(200, { 'Content-Type': MIME[extname(file)] || 'application/octet-stream', 'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'" });
      res.end(body);
    } catch { res.writeHead(404); res.end('not found'); }
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  return server;
}
const PROBE = () => {
  const P = window.__perf = { frames: [], long: [] };
  let last = 0;
  const loop = t => { if (last) P.frames.push(t - last); last = t; requestAnimationFrame(loop); };
  requestAnimationFrame(loop);
  try { new PerformanceObserver(l => { for (const e of l.getEntries()) P.long.push(Math.round(e.duration)); }).observe({ type: 'longtask' }); } catch {}
};
const pct = (xs, p) => { if (!xs.length) return 0; const s = [...xs].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(s.length * p))]; };
const r1 = x => Math.round(x * 10) / 10;

async function measure(browser, base, { cpu, seconds, q, pets, fx = '1', shot, shotAt, shots }) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.addInitScript(PROBE);
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Performance.enable');
  await page.goto(`${base}/proto/arena-fx.html?q=${q}&pets=${pets}&fx=${fx}&decal=${arg('decal', '1')}&clean=1`);
  await page.waitForFunction(() => window.__fx && window.__fx.frames > 10, null, { timeout: 30000 });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu });
  // 처음 2초(그림 디코드 · 글꼴)는 버리고 잰다. --gpu는 SwiftShader 셰이더 준비가 길어 6초
  await page.waitForTimeout(Number(arg('warm', GPU ? 6 : 2)) * 1000);
  await page.evaluate(() => { window.__perf.frames = []; window.__perf.long = []; });
  const t0 = Date.now(); let heapMax = 0; const shotList = shots ? [...shots] : shot ? [[shot, shotAt]] : [];
  while (Date.now() - t0 < seconds * 1000) {
    await page.waitForTimeout(500);
    const m = Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(x => [x.name, x.value]));
    heapMax = Math.max(heapMax, m.JSHeapUsedSize || 0);
    while (shotList.length && Date.now() - t0 > shotList[0][1]) { const [path] = shotList.shift(); await page.screenshot(path.endsWith('.png') ? { path, scale: 'css' } : { path, type: 'jpeg', quality: 72, scale: 'css' }); }
  }
  const P = await page.evaluate(() => window.__perf);
  const F = await page.evaluate(() => ({ ...window.__fx, canvasMB: window.__fx.canvasMB(), accel: (() => { try { const c = document.createElement('canvas'); c.width = c.height = 300; const g = c.getContext('2d'); return typeof g.isContextLost === 'function' ? 'ok' : '-'; } catch { return '-'; } })() }));
  await ctx.close();
  const secs = P.frames.reduce((a, b) => a + b, 0) / 1000, mins = secs / 60;
  return {
    cpu, q, pets, fx, gpu: GPU, seconds: r1(secs), fps: r1(P.frames.length / secs), frame_p95: r1(pct(P.frames, .95)), frame_p99: r1(pct(P.frames, .99)), frame_max: r1(Math.max(0, ...P.frames)),
    over33_per_min: r1(P.frames.filter(d => d > 33.4).length / mins), over50_per_min: r1(P.frames.filter(d => d > 50).length / mins),
    long_tasks: P.long.length, long_max: Math.max(0, ...P.long), heap_mb: r1(heapMax / 1048576), canvas_mb: F.canvasMB,
    debris_max: F.debrisMax, smoke_max: F.smokeMax, sparks_max: F.sparksMax, fx_max: F.fxMax, tier_end: F.tier, tier_drops: F.tierDrops, stalls: (F.stalls || []).slice(-8), heals: F.heals, cycles: F.cycles, errors: errors.slice(0, 3)
  };
}

const pw = loadPlaywright();
const server = await startServer();
const base = `http://127.0.0.1:${server.address().port}`;
// --gpu: 캔버스를 GPU 쪽(SwiftShader)에서 그리게 한다 → 진짜 폰처럼 그리기가 메인 스레드 밖으로 빠진다(이때 CPU N배는 스크립트에만 걸림).
const GPU = process.argv.includes('--gpu');
const browser = await pw.chromium.launch({ args: GPU ? ['--enable-gpu', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-accelerated-2d-canvas'] : [] });
const SECONDS = Number(arg('seconds', 40));
const runs = process.argv.includes('--table')
  ? [[1, '3'], [4, '3'], [4, '2'], [4, 'auto'], [6, '3'], [6, 'auto'], [6, '1'], [6, '0']].map(([cpu, q]) => ({ cpu, q, pets: 4, seconds: SECONDS }))
  : [{ cpu: Number(arg('cpu', 4)), q: arg('q', 'auto'), pets: Number(arg('pets', 4)), fx: arg('fx', '1'), seconds: SECONDS, shot: arg('shot', ''), shotAt: Number(arg('shot-at', 8300)), shots: arg('shots', '') ? arg('shots', '').split(',').map(s => s.split('@')).map(([p, t]) => [p, Number(t)]) : null }];
const rows = [];
for (const r of runs) { const out = await measure(browser, base, r); rows.push(out); console.log(JSON.stringify(out)); }
if (rows.length > 1 || !process.argv.includes('--json')) {
  const Q = { 3: '높음(고정)', 2: '중간(고정)', 1: '낮음(고정)', 0: '최저(고정)', auto: '자동' };
  console.log('\n| CPU | 품질 | fps | 95% 프레임 | 99% | 가장 긴 | 33ms↑/분 | 50ms↑/분 | 긴 작업 | JS 힙 | 캔버스 | 파편 최대 | 끝 품질 |');
  console.log('|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const o of rows) console.log(`| ${o.cpu}× | ${Q[o.q] ?? o.q} | ${o.fps} | ${o.frame_p95}ms | ${o.frame_p99}ms | ${o.frame_max}ms | ${o.over33_per_min} | ${o.over50_per_min} | ${o.long_tasks} | ${o.heap_mb}MB | ${o.canvas_mb}MB | ${o.debris_max} | ${['최저', '낮음', '중간', '높음'][o.tier_end]} |`);
}
await browser.close(); server.close();
process.exit(0);
