// V13.241 펫 대행진 실제 화면 한 판 시험 + 스크린샷(검사에는 넣지 않는다). 운영 · 테스트 서버에 연결하지 않는다.
// 미리: 로컬 서버를 테스트 앱 처음 데이터로 켠다(학생 ts1 / test1234). 예:
//   node -e "..." 로 server/test-seed.mjs testSeedState()를 DATA_PATH sqlite에 넣고 DATA_PATH=… PORT=8787 node server/index.mjs
// 사용: node docs/runner-play-shot.mjs [--base http://localhost:8787] [--stage 1] [--out 폴더] [--bad]
//   측정: --perf --cpu 4 --q auto|3|2|1|0 → 폰처럼(390×844 · 배율 3 · 터치, CPU N배) 한 판 동안 프레임을 잰다(docs/arena-fx-perf.mjs와 같은 숫자).
// 하는 일: 로그인 → 놀이터 → 펫 대행진 카드 → 지도 스크린샷 → 출발 → 간단한 자동 조종(window.__rnAutopilot: 좋은 문 · 바위 · 수정 노리기,
//   공성전 누르기)으로 끝까지 → 결과 스크린샷. 카드는 첫 장을 누른다. 중간 장면도 몇 장 찍는다.
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const here = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const arg = (n, f) => { const i = process.argv.indexOf(`--${n}`); return i > 0 ? process.argv[i + 1] : f; };
const BASE = arg('base', 'http://localhost:8787'), OUT = resolve(arg('out', resolve(here, 'docs/screenshots'))), STAGE = Number(arg('stage', 1));
const pw = (() => { for (const n of [process.env.PLAYWRIGHT, 'playwright'].filter(Boolean)) { try { return require(n); } catch {} } throw Error('playwright가 필요해요'); })();
await mkdir(OUT, { recursive: true });
const browser = await pw.chromium.launch({ args: ['--mute-audio'] });
const PERF = process.argv.includes('--perf'), CPU = Number(arg('cpu', 1)), Q = arg('q', 'auto');
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: PERF ? 3 : 1, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
const errors = [], reqs = [];
page.on('request', r => reqs.push(r.url()));
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
await page.addInitScript(q => {
  try { if (q === 'auto') localStorage.removeItem('sumus-runner-tier'); else localStorage.setItem('sumus-runner-tier', JSON.stringify({ t: Number(q), at: Date.now() })); } catch {}
  const P = window.__perf = { frames: [], long: [], on: false }; let last = 0;
  const loop = t => { if (last && P.on) P.frames.push(t - last); last = t; requestAnimationFrame(loop); }; requestAnimationFrame(loop);
  try { new PerformanceObserver(l => { if (P.on) for (const e of l.getEntries()) P.long.push(Math.round(e.duration)); }).observe({ type: 'longtask' }); } catch {}
  // 입력 지연: 손가락(포인터) 움직임이 처리되고 다음 화면 프레임이 시작될 때까지(ms)
  P.lat = []; addEventListener('pointermove', e => { if (!P.on) return; const t0 = e.timeStamp; requestAnimationFrame(t => P.lat.push(t - t0)); }, { capture: true, passive: true });
}, Q);
await page.addInitScript(() => {
  // 사건별 낸 소리 수(runner.js snd → window.__rnSndLog)
  window.__rnSnd = {}; window.__rnSndLog = (name, n) => { const o = window.__rnSnd[name] ||= { calls: 0, played: 0 }; o.calls++; o.played += n; };
  window.__rnBad = new URLSearchParams(location.search).has('bad');
  // 간단한 자동 조종: 20단위 안 첫 물체를 보고 좋은 문 쪽 · 바위(깰 수 있으면) · 수정으로, 톱날 · 망치는 반대쪽. 공성전은 계속 누름.
  const apply = (n, g) => g[0] === '+' ? n + g[1] : g[0] === '×' ? n * g[1] : Math.max(0, n - g[1]);
  window.__rnAutopilot = S => {
    if (window.__rnBad) return { tx: 0, hold: false };
    window.__rnPhase = S.phase; window.__rnSiegeT = S.siegeT;
    if (S.phase === 'siege') return { tx: 0, hold: S.siegeT > 10 };
    for (const o of S.items) {
      if (o.done || o.z < S.z - 1 || o.z > S.z + 20 || o.type === 'card' || o.type === 'end') continue;
      if (o.type === 'gate') return { tx: apply(S.n, o.l) >= apply(S.n, o.r) ? -2.2 : 2.2 };
      if (o.type === 'crystal') return { tx: o.x };
      if (o.type === 'rock') return { tx: o.hp < (1 + Math.min(S.n, 400) * 0.028) * (o.z - S.z) * 1.6 ? o.x : (o.x > 0 ? -3 : 3) };
      return { tx: (o.x ?? o.x0) > 0 ? -2.8 : 2.8 };
    }
    return { tx: S.cx };
  };
});
await page.goto(BASE + (process.argv.includes('--bad') ? '/?bad=1' : '/'));
await page.fill('input[autocomplete="username"], input[name="username"]', arg('user', 'ts1')).catch(() => {});
await page.fill('input[type="password"]', 'test1234').catch(() => {});
await page.keyboard.press('Enter');
await page.waitForTimeout(2500);
// 처음 안내 창(알 깨기 · 앱 설치 등)을 닫고 놀이터 → 미니게임 → 펫 대행진
for (let i = 0; i < 6; i++) {
  const x = await page.$('#modal-root button[aria-label*="닫기"], #modal-root .modal-close, #modal-root [data-action="close"], .install-banner button[aria-label*="닫기"]');
  if (x) { await x.click().catch(() => {}); await page.waitForTimeout(500); continue; }
  const auto = await page.$('#modal-root button:has-text("자동으로 보기"), #modal-root button:has-text("확인"), #modal-root button:has-text("좋아요")');
  if (auto) { await auto.click().catch(() => {}); await page.waitForTimeout(1500); continue; }
  await page.keyboard.press('Escape'); await page.waitForTimeout(300);
}
const nav = await page.$('nav button:has-text("놀이터"), nav a:has-text("놀이터"), [data-tab="arcade"]');
if (nav) { await nav.click().catch(() => {}); await page.waitForTimeout(1000); }
const pg = await page.$('[data-pg="arcade"]'); if (pg) { await pg.click().catch(() => {}); await page.waitForTimeout(800); }
await page.evaluate(() => document.querySelector('[data-action="runner-open"]')?.scrollIntoView());
await page.waitForTimeout(400);
await page.screenshot({ path: resolve(OUT, 'runner-card.jpg'), type: 'jpeg', quality: 70 });
await page.click('[data-action="runner-open"]');
await page.waitForTimeout(1500);
await page.screenshot({ path: resolve(OUT, 'runner-map.jpg'), type: 'jpeg', quality: 70 });
if (STAGE > 1) await page.click(`[data-rn="pick"][data-s="${STAGE}"]`).catch(() => {});
let cdp = null;
if (PERF) { cdp = await ctx.newCDPSession(page); await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU }); }
// 출발 누름 → 판 시작(그림 받기 · 디코드 · 재료 굽기 · 카운트다운 포함)까지 걸린 시간과 그동안 가장 긴 멈춤도 잰다(새 브라우저라 첫 판 디코드 포함).
if (PERF) await page.evaluate(() => { window.__perf.frames = []; window.__perf.long = []; window.__perf.on = true; window.__perf.t0 = performance.now(); });
await page.click('[data-rn="go"]');
// 측정: 규칙이 돌기 시작한 순간(카운트다운 뒤)부터 WINDOW초. CPU N배는 출발 전에 걸어 둔다(판 첫 몇 초도 같은 조건).
const WINDOW = Number(arg('window', 40));
if (PERF) {
  await page.waitForFunction(() => window.__rnPhase, null, { timeout: 30000 });
  var pre = await page.evaluate(() => ({ ms: Math.round(performance.now() - window.__perf.t0), frame: Math.round(Math.max(0, ...window.__perf.frames)), long: Math.max(0, ...window.__perf.long) }));
  await page.evaluate(() => { window.__perf.frames = []; window.__perf.long = []; window.__perf.lat = []; window.__perf.on = true; });
  if (arg('profile')) { await cdp.send('Profiler.enable'); await cdp.send('Profiler.start'); }
  const tEnd = Date.now() + WINDOW * 1000, box = { x: 195, y: 600 };
  while (Date.now() < tEnd) { box.x = 150 + Math.random() * 90; await page.mouse.move(box.x, box.y); await page.waitForTimeout(250); if (await page.$('#rn-cards.on')) { await page.click('#rn-cards.on .rn-card', { timeout: 1500 }).catch(() => {}); await page.waitForTimeout(400); } if (await page.$('#rn-result:not([hidden])')) break; }
  await page.evaluate(() => { window.__perf.on = false; });
}
const t0 = Date.now(), shots = [[9000, 'runner-play-run.jpg']];
let cards = 0, shotRescue = false, shotSiege = false;
while (!PERF && Date.now() - t0 < 150000) {
  await page.waitForTimeout(120);
  if (await page.$('#rn-result:not([hidden])')) { if (PERF) await page.evaluate(() => { window.__perf.on = false; }); break; }
  if (await page.$('#rn-cards.on')) { await page.waitForTimeout(500); if (cards === 0) await page.screenshot({ path: resolve(OUT, 'runner-play-card.jpg'), type: 'jpeg', quality: 70 }); await page.click('#rn-cards.on .rn-card', { timeout: 1500 }).catch(() => {}); cards++; await page.waitForTimeout(600); }
  const el = Date.now() - t0;
  while (shots.length && el > shots[0][0]) { const [, f] = shots.shift(); await page.screenshot({ path: resolve(OUT, f), type: 'jpeg', quality: 70 }); }
  const siegeT = await page.evaluate(() => window.__rnPhase === 'siege' ? window.__rnSiegeT : 0).catch(() => 0);
  if (!shotSiege && siegeT > 24) { shotSiege = true; await page.screenshot({ path: resolve(OUT, 'runner-play-siege.jpg'), type: 'jpeg', quality: 70 }); }
  void shotRescue;
}
if (!PERF) { await page.waitForTimeout(1800); await page.screenshot({ path: resolve(OUT, 'runner-play-result.jpg'), type: 'jpeg', quality: 70 }); }
const result = await page.textContent('#rn-result').catch(() => '');
let perf = null;
if (PERF) {
  const P = await page.evaluate(() => { window.__perf.on = false; return window.__perf; }) /* 결과 화면이 뜨기 전까지(달리기 · 카드 · 구출 · 공성전) */, tierEnd = await page.evaluate(() => { try { return JSON.parse(localStorage.getItem('sumus-runner-tier'))?.t ?? 3; } catch { return 3; } });
  if (arg('profile')) { const { profile } = await cdp.send('Profiler.stop'); (await import('node:fs')).writeFileSync(arg('profile'), JSON.stringify(profile)); }
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  const fr = P.frames.filter(d => d < 5000), secs = fr.reduce((a, b) => a + b, 0) / 1000, mins = secs / 60, pct = q => { const x = [...fr].sort((a, b) => a - b); return x[Math.min(x.length - 1, Math.floor(x.length * q))] || 0; };
  const r1 = x => Math.round(x * 10) / 10;
  const lat = [...P.lat].sort((a, b) => a - b), lp = q => r1(lat[Math.min(lat.length - 1, Math.floor(lat.length * q))] || 0);
  perf = { cpu: CPU, q: Q, seconds: r1(secs), fps: r1(fr.length / secs), p95: r1(pct(.95)), p99: r1(pct(.99)), max: r1(Math.max(...fr)), over33_min: r1(fr.filter(d => d > 33.4).length / mins), over50_min: r1(fr.filter(d => d > 50).length / mins), long_tasks: P.long.length, input_p50: lp(.5), input_p95: lp(.95), input_n: lat.length, first5s_over50: (() => { let t = 0, n = 0; for (const d of fr) { t += d; if (t > 5000) break; if (d > 50) n++; } return n; })(), tier_end: ['최저', '낮음', '중간', '높음'][tierEnd], start_ms: pre.ms, start_frame_max: pre.frame, start_long_max: pre.long };
  console.log(JSON.stringify(perf)); await browser.close(); process.exit(0);
}
const sounds = await page.evaluate(() => window.__rnSnd).catch(() => null);
// 16개 사건 소리를 직접 한 번씩(이 판에 안 나온 사건 포함): 낸 소리 수가 1 이상이어야 한다
const direct = await page.evaluate(async () => { const m = await import('/modules/runner-sfx.js'), out = {}; for (const e of Object.keys(m.RUNNER_SFX)) { out[e] = m.runnerSound(e, e === 'star' ? { i: 2 } : {}); await new Promise(r => setTimeout(r, 200)); } return out; }).catch(e => String(e));
const mp3 = reqs.filter(u => /\/assets\/sfx\/rn-/.test(u)).length;
if (PERF) { console.log(JSON.stringify(perf)); await browser.close(); process.exit(0); }
console.log(JSON.stringify({ sounds, direct, mp3_loaded: mp3, seconds: Math.round((Date.now() - t0) / 1000), cards, result: (result || '').replace(/\s+/g, ' ').trim().slice(0, 160), errors: errors.slice(0, 5) }));
await browser.close();
