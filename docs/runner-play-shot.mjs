// V13.241 펫 대행진 실제 화면 한 판 시험 + 스크린샷(검사에는 넣지 않는다). 운영 · 테스트 서버에 연결하지 않는다.
// 미리: 로컬 서버를 테스트 앱 처음 데이터로 켠다(학생 ts1 / test1234). 예:
//   node -e "..." 로 server/test-seed.mjs testSeedState()를 DATA_PATH sqlite에 넣고 DATA_PATH=… PORT=8787 node server/index.mjs
// 사용: node docs/runner-play-shot.mjs [--base http://localhost:8787] [--stage 1] [--out 폴더] [--cpu 1]
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
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
const errors = [], reqs = [];
page.on('request', r => reqs.push(r.url()));
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
await page.addInitScript(() => {
  // 사건별 낸 소리 수(runner.js snd → window.__rnSndLog)
  window.__rnSnd = {}; window.__rnSndLog = (name, n) => { const o = window.__rnSnd[name] ||= { calls: 0, played: 0 }; o.calls++; o.played += n; };
  window.__rnBad = new URLSearchParams(location.search).has('bad');
  // 간단한 자동 조종: 20단위 안 첫 물체를 보고 좋은 문 쪽 · 바위(깰 수 있으면) · 수정으로, 톱날 · 망치는 반대쪽. 공성전은 계속 누름.
  const apply = (n, g) => g[0] === '+' ? n + g[1] : g[0] === '×' ? n * g[1] : Math.max(0, n - g[1]);
  window.__rnAutopilot = S => {
    if (window.__rnBad) return { tx: 0, hold: false };
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
await page.fill('input[autocomplete="username"], input[name="username"]', 'ts1').catch(() => {});
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
await page.click('[data-rn="go"]');
const t0 = Date.now(), shots = [[9000, 'runner-play-run.jpg']];
let cards = 0, shotRescue = false, shotSiege = false;
while (Date.now() - t0 < 150000) {
  await page.waitForTimeout(250);
  if (await page.$('#rn-result:not([hidden])')) break;
  if (await page.$('#rn-cards.on')) { await page.waitForTimeout(500); if (cards === 0) await page.screenshot({ path: resolve(OUT, 'runner-play-card.jpg'), type: 'jpeg', quality: 70 }); await page.click('#rn-cards .rn-card').catch(() => {}); cards++; }
  const el = Date.now() - t0;
  while (shots.length && el > shots[0][0]) { const [, f] = shots.shift(); await page.screenshot({ path: resolve(OUT, f), type: 'jpeg', quality: 70 }); }
  const hint = await page.textContent('#rn-hint').catch(() => '');
  if (!shotSiege && /발사/.test(hint || '')) { shotSiege = true; await page.waitForTimeout(1600); await page.screenshot({ path: resolve(OUT, 'runner-play-siege.jpg'), type: 'jpeg', quality: 70 }); }
  void shotRescue;
}
await page.waitForTimeout(1800);
await page.screenshot({ path: resolve(OUT, 'runner-play-result.jpg'), type: 'jpeg', quality: 70 });
const result = await page.textContent('#rn-result').catch(() => '');
const sounds = await page.evaluate(() => window.__rnSnd).catch(() => null);
// 16개 사건 소리를 직접 한 번씩(이 판에 안 나온 사건 포함): 낸 소리 수가 1 이상이어야 한다
const direct = await page.evaluate(async () => { const m = await import('/modules/runner-sfx.js'), out = {}; for (const e of Object.keys(m.RUNNER_SFX)) { out[e] = m.runnerSound(e, e === 'star' ? { i: 2 } : {}); await new Promise(r => setTimeout(r, 200)); } return out; }).catch(e => String(e));
const mp3 = reqs.filter(u => /\/assets\/sfx\/rn-/.test(u)).length;
console.log(JSON.stringify({ sounds, direct, mp3_loaded: mp3, seconds: Math.round((Date.now() - t0) / 1000), cards, result: (result || '').replace(/\s+/g, ' ').trim().slice(0, 160), errors: errors.slice(0, 5) }));
await browser.close();
