// V13.239 펫 아레나 전투 밖 화면(입구 · 친구 대전 · 방 · VS · 결과 · 랭킹 · 꾸미기) 스크린샷. 검사에는 넣지 않는다(docs/arena-perf.mjs와 같은 방식).
// 진짜 화면 코드(public/modules/arena*.js) + 가짜 서버(/api/games/arena/* 흉내, 운영 · 테스트 서버에 연결하지 않음).
// 친구 방은 WebSocket을 페이지 안에서 흉내 내서 대기실 메시지(lobby) 한 번만 보낸다. 소리는 끈다(--mute-audio).
// 사용: npm run build:assets 다음에 node docs/arena-screens-shot.mjs [--out 폴더] [--only lobby,result-win]
//   playwright가 필요하다(이 저장소 의존성이 아니다): PLAYWRIGHT=/경로/node_modules/playwright
import http from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { extname, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const pub = resolve(here, 'public');
const require = createRequire(import.meta.url);
const arg = (name, fallback) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : fallback; };
const OUT = resolve(arg('out', resolve(here, 'docs/screenshots/arena-screens')));
const ONLY = arg('only', '').split(',').filter(Boolean);
function loadPlaywright() {
  for (const name of [process.env.PLAYWRIGHT, 'playwright'].filter(Boolean)) { try { return require(name); } catch {} }
  throw Error('playwright를 찾지 못했어요. PLAYWRIGHT=/경로/node_modules/playwright 로 알려 주세요.');
}

const PETS = [['gumiho', 24], ['phoenix', 22], ['bear', 18], ['dragon', 15], ['turtle', 12], ['dog', 9], ['tiger', 6]].map(([key, level], i) => ({ key, form: 3, level, active: i === 0 }));
const team = keys => keys.map((key, i) => ({ key, form: 3, level: 20 - i, s2: i & 1 }));
const MATCH = { id: 'shot', seed: 12345, foe_level: 1, me: team(['gumiho', 'phoenix', 'bear']), foe: { name: '민준', bot: false, team: team(['dragon', 'turtle', 'dog']) }, team: ['gumiho', 'phoenix', 'bear'], left: 4, tickets: 2, coin_play: true, wins: 23, streak: 2, best_streak: 5 };
const VIEW = { tickets: 2, left: 4, wins: 23, streak: 2, best_streak: 5, rank: { season: 3, days_left: 9, rp: 1240, pending: [] }, deco: { wins: 23, dc: { bg: 'sky', rg: 'flower', en: 'smoke', ps: 'jump' } } };
const FINISH = {
  win: { winner: 'me', paid: true, coins: 30, xp: 12, ko: 3, dealt: 1820, ults: 2, streak: 3, streak_coins: 10, rp: { d: 18, from: 1222, rp: 1240, streak: 3 }, points_balance: 130, left: 3, tickets: 1, wins: 24 },
  lose: { winner: 'foe', paid: true, coins: 10, xp: 6, ko: 1, dealt: 940, ults: 1, streak: 0, rp: { d: -12, from: 1252, rp: 1240 }, points_balance: 110, left: 3, tickets: 1, wins: 23 }
};
const LIVE_HOME = { invite: { id: 'i1', host: '서연', mode: '2v2', code: '7310' }, room: null, friends: [{ id: 'f1', name: '민준', class_name: '1-3', pair_left: 2 }, { id: 'f2', name: '서연', class_name: '1-1', pair_left: 0 }] };

const PAGE = scene => `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><link rel="stylesheet" href="/app.bundle.css"></head>
<body><div id="app"></div><script type="module">
window.speechSynthesis && (speechSynthesis.speak = u => { try { u.onend?.(); } catch {} });
${scene === 'room' ? `
// 친구 방: 대기실 메시지를 한 번 보내는 가짜 WebSocket.
window.WebSocket = class { constructor() { this.readyState = 1; setTimeout(() => { this.onopen?.(); this.onmessage?.({ data: JSON.stringify(Object.assign(${JSON.stringify({
  type: 'lobby', you: 'me', code: '4821', mode: '1v1', seats: 2, pets_n: 3, fill: false,
  players: [{ id: 'me', name: '나', host: true, ready: false, online: true, team: team(['gumiho', 'phoenix', 'bear']) }, { id: 'f1', name: '민준', ready: true, online: true, team: team(['dragon', 'turtle', 'dog']) }],
  pets: PETS.map(p => ({ ...p, s2: 0, tr: '000' }))
})}, { closes_at: Date.now() + 245000, now: Date.now() })) }); }, 60); } send() {} close() {} };` : ''}
const { openArena } = await import('/modules/arena.js');
const A = { data: { profile: { id: 'me', display_name: '나', role: 'student' }, stats: { pets: ${JSON.stringify(PETS)}, points_balance: 100 }, rewards: { arena: ${JSON.stringify(VIEW)} } }, screen: 'arena' };
openArena(A, () => {});
window.__ready = true;
</script></body></html>`;

const MIME = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.json': 'application/json', '.woff2': 'font/woff2', '.html': 'text/html' };
let finish = FINISH.win;
async function rankData() {
  const { tierOf } = await import(new URL('file:///' + resolve(pub, 'modules/arena-rank-rules.js').replace(/\\/g, '/')).href);
  const rows = [['하윤', '1-2', 1530], ['지호', '1-4', 1415], ['서연', '1-1', 1302], ['나', '1-3', 1240], ['민준', '1-3', 1180], ['도윤', '1-5', 990], ['수아', '1-2', 820], ['예준', '1-1', 610]];
  return { place: 4, total: 37, me: { season: 3, days_left: 9, rp: 1240, wins: 24, history: [{ s: 2, best: 'gold', label: '골드 I' }, { s: 1, best: 'silver', label: '실버 II' }] },
    top: rows.map(([name, cls, rp], i) => ({ place: i + 1, name, cls, rp, mine: name === '나', tier: tierOf(rp).key, label: tierOf(rp).label })) };
}
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const json = d => { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(d)); };
  if (url.pathname === '/arena.html') { res.writeHead(200, { 'Content-Type': 'text/html' }); return res.end(PAGE(url.searchParams.get('s'))); }
  if (url.pathname === '/api/games/arena/start') return json(MATCH);
  if (url.pathname === '/api/games/arena/finish') return json(finish);
  if (url.pathname === '/api/games/arena/rank') return json(await rankData());
  if (url.pathname === '/api/games/arena/live') return json(LIVE_HOME);
  if (url.pathname === '/api/games/arena/live/open') return json({ room: { id: 'r1', ticket: 't' } });
  if (url.pathname.startsWith('/api/')) return json({});
  try {
    const file = resolve(pub, '.' + decodeURIComponent(url.pathname));
    if (!file.startsWith(pub)) throw Error('밖');
    const body = await readFile(file);
    res.writeHead(200, { 'Content-Type': MIME[extname(file)] || 'application/octet-stream' }); res.end(body);
  } catch { res.writeHead(404); res.end(); }
});
await new Promise(ok => server.listen(0, '127.0.0.1', ok));
const base = `http://127.0.0.1:${server.address().port}`;
const { chromium } = loadPlaywright();
const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ['--mute-audio', '--autoplay-policy=user-gesture-required'] });
await mkdir(OUT, { recursive: true });
const W = 390, H = 844;

// 긴 화면은 스크롤 칸 높이만큼 늘려서 한 장으로.
async function shot(page, name, scroller = '') {
  await page.waitForTimeout(250);
  if (scroller) {
    const h = await page.evaluate(sel => { const el = document.querySelector(sel); return el ? Math.ceil(el.scrollHeight) : 0; }, scroller);
    if (h > H) { await page.setViewportSize({ width: W, height: Math.min(h, 3200) }); await page.waitForTimeout(400); }
  }
  await page.screenshot({ path: resolve(OUT, `${name}.png`) });
  console.log('찍음', name);
}
async function open(scene = '') {
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 2, reducedMotion: 'no-preference' });
  page.on('pageerror', e => console.error('페이지 오류', e.message));
  await page.goto(`${base}/arena.html?s=${scene}`);
  await page.waitForFunction(() => window.__ready);
  await page.waitForSelector('.ar-lobby');
  await page.waitForTimeout(900);
  return page;
}
const want = n => !ONLY.length || ONLY.includes(n);

if (want('lobby')) { const p = await open(); await shot(p, 'lobby', '.ar-lobby'); await p.close(); }
if (want('live')) { const p = await open(); await p.click('[data-ar="live"]'); await p.waitForSelector('.ar-live'); await p.waitForTimeout(700); await shot(p, 'live', '.ar-live'); await p.close(); }
if (want('room')) { const p = await open('room'); await p.click('[data-ar="live"]'); await p.waitForSelector('.ar-live'); await p.click('[data-ar="lv-open"][data-mode="1v1"]'); await p.waitForSelector('.ar-lv-lobby'); await p.waitForTimeout(700); await shot(p, 'room', '.ar-lv-lobby'); await p.close(); }
if (want('rank')) { const p = await open(); await p.click('[data-ar="rank"]'); await p.waitForSelector('.ark-board'); await p.waitForTimeout(700); await shot(p, 'rank', '.ark-board'); await p.close(); }
if (want('deco')) { const p = await open(); await p.click('[data-ar="dc-open"]'); await p.waitForSelector('.ar-deco'); await p.waitForTimeout(900); await shot(p, 'deco', '.ar-deco'); await p.close(); }
for (const kind of ['win', 'lose']) {
  if (!want('vs') && !want(`result-${kind}`)) continue;
  finish = FINISH[kind];
  const p = await open();
  await p.click('[data-ar="start"]');
  await p.waitForSelector('.ar-vs');
  await p.waitForTimeout(1300);
  if (kind === 'win' && want('vs')) await shot(p, 'vs');
  await p.waitForSelector('#ar-field');
  await p.waitForFunction(async () => { const { arenaUi } = await import('/modules/arena.js'); return arenaUi.R()?.started; }, null, { timeout: 15000 });
  await p.evaluate(async k => { const { arenaUi } = await import('/modules/arena.js'); const S = arenaUi.R().sim.S; S.winner = k === 'win' ? 'me' : 'foe'; S.over = true; }, kind);
  await p.waitForSelector('.ar-result', { timeout: 15000 });
  await p.waitForTimeout(2600);
  if (want(`result-${kind}`)) await shot(p, `result-${kind}`, '.ar-result');
  await p.close();
}
await browser.close();
server.close();
