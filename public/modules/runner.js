import { api, esc, num, icon, toast } from './ui.js';
import { coin } from './emblems.js';
import { avatar } from './character.js';
import { openSheet } from './sheet.js';
import { CHARACTERS } from './core.js';
import { RUNNER, PET_SKILL, cardName, CARDS, makeMap, runInit, runTick, runPick, recorder, quantTx, crowdR, tri, goodGate, isBoss, stageTarget } from './runner-rules.js';
import { RUNNER_ART, RUNNER_SFX } from './runner-art.js';
import { ARENA_ART } from './arena-art.js';

// V13.241 펫 대행진(크라우드 러너, 놀이터). 구성안 docs/pet-runner-plan.md · 펫 대행진 연출 시험 페이지의 엔진을 옮겨 씀.
// 화면 흐름: 지도(스테이지 1~25, 별 3개) → [출발] → 한 판(달리기 · 카드 2번 · 수정 구출 · 공성전) → 결과 → [다시] 한 번에 바로.
// 규칙은 runner-rules.js(서버와 같은 파일)가 고정 틱 50ms로 돌리고, 여기서는 그리기 · 소리 · 조종 기록만 한다.
//   - 무리는 숫자 하나. 정령은 품질 단계마다 최대 40 · 70 · 110 · 150마리만 그린다(나머지는 머리 위 숫자).
//   - 효과 저장소는 정해진 크기의 풀(파편 · 연기 · 불꽃 · 빛 · 날아가는 정령 · 탄). 빛 번짐은 미리 번진 그림(ctx.filter 없음).
//   - 품질 자동 4단계: 2초마다 20ms 넘은 프레임이 15% 넘으면 한 단계, 50% 넘으면 두 단계 내림(올리지 않음). 내려간 단계는 7일 기억.
//   - 그림 74(public/assets/runner/<이름>.webp)는 build:assets가 RUNNER_ART에 적은 것만 쓰고, 없으면 같은 자리를 코드 그림으로.
//   - 소리는 runner-sfx.js(다른 작업에서 만듦)가 있을 때만 runnerSound(사건 이름)를 부른다(RUNNER_SFX). 없으면 조용히.
// 서버 요청은 판마다 두 번: POST /runner/start → POST /runner/finish(조종 기록). 지도 · 반 순위는 GET.

const SND_EVENTS = ['gate-good', 'gate-bad', 'multiply', 'shoot', 'rock-hit', 'rock-break', 'saw', 'hammer', 'rescue', 'card', 'cannon', 'castle-hit', 'castle-fall', 'star', 'fail', 'start'];
let soundFn = null;
function loadSound() { if (!RUNNER_SFX || soundFn) return; import('./runner-sfx.js').then(m => { soundFn = m.runnerSound || null; }).catch(() => {}); }
const snd = (name, opts) => { try { soundFn?.(name, opts); } catch {} };
const readPref = (k, f) => { try { return localStorage.getItem(k) ?? f; } catch { return f; } };
const writePref = (k, v) => { try { localStorage.setItem(k, v); } catch {} };
const root = () => document.getElementById('app');
const $ = id => document.getElementById(id);
let R = null;   // 화면 상태 { A, exit, v, sel, game }

export function openRunner(A, exit) {
  closeGame();
  R = { A, exit, v: A.data.rewards?.runner || null, sel: null, busy: false };
  A.screen = 'runner';
  loadSound();
  lobby();
  api('/runner/home').then(res => { if (R && res?.runner) { R.v = res.runner; if (!R.game) lobby(); } }).catch(() => {});
}
const view = () => R.v || { stages: RUNNER.STAGES, st: 0, stars: '', total: 0, coin_today: 0, coin_daily: RUNNER.COIN_DAILY, box: true, box_coins: RUNNER.BOX_COINS, plays_left: RUNNER.PLAYS_DAILY, cheer: null };
const starAt = (v, s) => Number(String(v.stars || '')[s - 1] || 0);
const starRow = (n, cls = '') => `<span class="rn-stars ${cls}" aria-label="별 ${n}개">${[0, 1, 2].map(i => `<i class="${i < n ? 'on' : ''}"></i>`).join('')}</span>`;

/* ---------- 지도(로비) ---------- */
function lobby() {
  const v = view(), open = Math.min(v.stages, v.st + 1);
  if (!R.sel || R.sel > open) R.sel = open;
  const nodes = [];
  for (let s = 1; s <= v.stages; s++) {
    const n = starAt(v, s), lock = s > open, boss = isBoss(s);
    nodes.push(`<button type="button" class="rn-node${lock ? ' lock' : ''}${boss ? ' boss' : ''}${s === R.sel ? ' sel' : ''}${n ? ' done' : ''}" data-rn="pick" data-s="${s}" ${lock ? 'disabled' : ''} aria-label="${s}스테이지${lock ? ' 잠김' : ` 별 ${n}개`}">
      <b>${s}</b>${lock ? '<i class="rn-lock" aria-hidden="true"></i>' : starRow(n)}</button>`);
  }
  const s = R.sel, cheer = v.cheer?.stage === s ? v.cheer.bonus : 0, tg = stageTarget(s);
  root().innerHTML = `<div class="session-app rn-app" id="rn-app"><header class="rn-top"><button type="button" class="yb-back" data-rn="exit" aria-label="나가기">${icon('back')}</button><strong>펫 대행진</strong>
      <span class="rn-chip" title="오늘 받은 코인">${coin()}<b>${num(v.coin_today)}/${num(v.coin_daily)}</b></span><button type="button" class="rn-chip rn-board" data-rn="board">반 순위</button></header>
    <main class="rn-main">
      <section class="rn-hero"><div class="rn-hero-sky" aria-hidden="true"><i></i><i></i><i></i></div>
        <h1>하늘 다리</h1><p>좌우로 끌어 숫자 문을 고르고, 바위를 쏴 깨고, 갇힌 내 펫을 구한 뒤 대포로 성을 무너뜨려요!</p>
        <div class="rn-total"><span>${starRow(3, 'big')}<b>${num(v.total)}</b><small>/ ${v.stages * 3}</small></span>${v.box ? `<span class="rn-box">오늘 첫 판 상자 +${v.box_coins}</span>` : ''}</div></section>
      <section class="rn-map" aria-label="스테이지 지도">${nodes.join('')}</section>
      <section class="rn-go-panel">
        <div><strong>${s}스테이지${isBoss(s) ? ' · 보스 성' : ''}</strong><small>${starAt(v, s) ? `내 최고 ${starRow(starAt(v, s))}` : '처음 도전'}${cheer ? ` · 응원 정령 +${Math.round(cheer * 100)}%` : ''}</small></div>
        <button type="button" class="yl-cta rn-go" data-rn="go" ${R.busy ? 'disabled' : ''}>출발!</button>
      </section>
      <p class="rn-note">별을 처음 받으면 별마다 ${RUNNER.STAR_NEW}코인, 다시 받으면 ${RUNNER.STAR_AGAIN}코인(하루 ${RUNNER.COIN_DAILY}코인까지) · 매일 첫 판 상자 ${RUNNER.BOX_COINS}코인. 판 수는 끝이 없어요.</p>
      <p class="rn-note sub">${isBoss(s) ? '보스 성은 조금 더 단단해요. ' : ''}처음 도전한 친구 중 약 ${Math.round(tg.clear * 100)}%가 깨요.</p>
    </main></div>`;
  root().onclick = onLobbyClick;
  window.scrollTo(0, 0);
}
async function onLobbyClick(e) {
  const b = e.target.closest('[data-rn]'); if (!b || !R) return;
  const act = b.dataset.rn;
  if (act === 'exit') { const ex = R.exit; closeGame(); R = null; return ex?.(); }
  if (act === 'pick') { R.sel = Number(b.dataset.s); return lobby(); }
  if (act === 'board') return showBoard();
  if (act === 'go') return startGame(R.sel);
}
async function showBoard() {
  let res; try { res = await api('/runner/board'); } catch (err) { return toast(err.message || '반 순위를 불러오지 못했어요.'); }
  const row = r => `<li class="${r.me ? 'me' : ''}"><b>${r.rank}</b>${avatar(r.pet, { small: true })}<span>${esc(r.name)}</span><em>${starRow(1)}${num(r.total)}</em><small>${r.st}스테이지</small></li>`;
  openSheet(`<div class="rn-board-sheet"><h2>펫 대행진 반 순위</h2><p>같은 학교 · 같은 학년 친구들의 별 합계예요(1분마다 새로).</p>
    <ol>${(res.top || []).map(row).join('') || '<li class="empty">아직 아무도 안 했어요. 첫 주인공이 되어 봐요!</li>'}</ol>${res.me && !res.top.some(r => r.me) ? `<ol class="mine">${row(res.me)}</ol>` : ''}</div>`, '펫 대행진 반 순위', { className: 'rn-sheet' });
}

/* ---------- 한 판 ---------- */
async function startGame(stage) {
  if (R.busy) return;
  R.busy = true;
  const id = `rn-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  let res;
  try { res = await api('/runner/start', { id, stage }); }
  catch (err) { R.busy = false; toast(err.message || '시작하지 못했어요.'); return lobby(); }
  R.busy = false;
  if (res.runner) R.v = res.runner;
  snd('start');
  playGame(res);
}

// 품질 단계(시험 페이지와 같은 값). draw = 그리는 정령 수.
const TIERS = [
  { name: '최저', scale: .75, draw: 40, debris: 70, smoke: 18, sparks: 70, glows: 60, fly: 30, shots: 20, mult: .35, glow: false, cutLines: 4, posts: 6 },
  { name: '낮음', scale: 1, draw: 70, debris: 90, smoke: 26, sparks: 90, glows: 90, fly: 40, shots: 28, mult: .45, glow: false, cutLines: 6, posts: 8 },
  { name: '중간', scale: 1.5, draw: 110, debris: 200, smoke: 48, sparks: 180, glows: 160, fly: 70, shots: 44, mult: .7, glow: true, cutLines: 10, posts: 12 },
  { name: '높음', scale: 2, draw: 150, debris: 300, smoke: 72, sparks: 260, glows: 240, fly: 100, shots: 60, mult: 1, glow: true, cutLines: 14, posts: 16 }
];
const DRAW_MAX = 150;
const TIER_KEY = 'sumus-runner-tier', TIER_DAYS = 7;
function savedTier() { try { const o = JSON.parse(readPref(TIER_KEY, 'null')); return o && Date.now() - o.at < TIER_DAYS * 86400000 ? Math.max(0, Math.min(3, o.t | 0)) : 3; } catch { return 3; } }
const TAU = Math.PI * 2, clamp = (v, a, b) => v < a ? a : v > b ? b : v, lerp = (a, b, t) => a + (b - a) * t, easeOut = t => 1 - (1 - t) * (1 - t) * (1 - t);
const rnd = Math.random, rr = (a, b) => a + rnd() * (b - a);
const mk = (w, h) => { const c = document.createElement('canvas'); c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h)); return c; };
const EL_RGB = { star: '255,226,90', flame: '255,130,50', ice: '140,215,255', toxic: '200,110,255', water: '80,180,255', leaf: '140,230,90', earth: '214,170,110', wind: '170,255,220', spirit: '120,220,255' };
const THEME = { skyTop: '#3f7fe0', skyMid: '#8cc3ff', horizon: '#e9f3ff', sea: '#f4f0ff', seaDeep: '#b9b4ef', roadA: [236, 205, 150], roadB: [222, 186, 124], rail: '#f6d36a', railDark: '#b8862d', fog: [226, 238, 255] };
const art = k => RUNNER_ART.has(k) ? `/assets/runner/${k}.webp` : null;
const petSrc = (key, form) => `/assets/pets/${key}-${Math.max(1, Math.min(3, form || 3))}.webp`;

let G = null;   // 게임 상태
function closeGame() {
  if (!G) return;
  cancelAnimationFrame(G.raf); G.alive = false;
  removeEventListener('pointermove', G.onMove); removeEventListener('pointerup', G.onUp); removeEventListener('pointercancel', G.onUp);
  document.removeEventListener('visibilitychange', G.onVis); removeEventListener('resize', G.onResize);
  G = null; if (R) R.game = null;
}
function playGame(start) {
  closeGame();
  const map = makeMap(start.stage), pet = start.pet || {};
  root().innerHTML = `<div class="rn-game" id="rn-game"><canvas id="rn-cvs"></canvas>
    <div class="rn-veil" id="rn-tint"></div><div class="rn-veil rn-vig" id="rn-vig"></div><div class="rn-veil" id="rn-flash"></div>
    <header class="rn-hud"><button type="button" class="rn-x" data-g="quit" aria-label="그만하기">${icon('close')}</button><div class="rn-hud-mid"><b>${start.stage}스테이지${isBoss(start.stage) ? ' · 보스 성' : ''}</b><div class="rn-prog"><i id="rn-prog"></i></div></div><span class="rn-hud-r" id="rn-hint">끌어서 조종</span></header>
    <div class="rn-cards" id="rn-cards" aria-live="polite"></div>
    <div class="rn-result" id="rn-result" hidden></div></div>`;
  const cvs = $('rn-cvs');
  G = {
    alive: true, map, start, cvs, ctx: cvs.getContext('2d', { alpha: false, desynchronized: true }), id: start.id,
    S: runInit(map, { start: start.start, pet: pet.el ? { el: pet.el, mul: pet.mul } : null }), rec: recorder(),
    pet, tx: 0, hold: false, drag: null, last: 0, acc: 0, clock: 0, timers: [], frameLog: [], lastCheck: 0, frames: 0,
    tier: savedTier(), sent: false, pz: 0, pcx: 0, paused: false, shotT: 0, lastN: 0, hitstop: 0, castleHitT: 0, cracks: 0
  };
  if (R) R.game = G;
  G.T = TIERS[G.tier];
  initEngine(G);
  const app = $('rn-game');
  app.addEventListener('contextmenu', e => e.preventDefault());
  app.onclick = e => { const b = e.target.closest('[data-g]'); if (!b) return; onGameClick(b); };
  cvs.addEventListener('pointerdown', e => { if (G.S.phase === 'siege') { G.hold = true; $('rn-hint').textContent = '발사 중!'; return; } G.drag = { x: e.clientX, tx: G.tx }; try { cvs.setPointerCapture(e.pointerId); } catch {} });
  G.onMove = e => { if (!G?.drag) return; G.tx = clamp(G.drag.tx + (e.clientX - G.drag.x) / G.cssW * RUNNER.ROAD * 2.4, -RUNNER.ROAD, RUNNER.ROAD); };
  G.onUp = () => { if (!G) return; G.drag = null; if (G.hold) { G.hold = false; $('rn-hint').textContent = '누르고 있으면 발사'; } };
  G.onVis = () => { if (G) G.paused = document.hidden; G && (G.last = 0); };
  G.onResize = () => G && resize(G);
  addEventListener('pointermove', G.onMove); addEventListener('pointerup', G.onUp); addEventListener('pointercancel', G.onUp);
  document.addEventListener('visibilitychange', G.onVis); addEventListener('resize', G.onResize);
  G.raf = requestAnimationFrame(frame);
}
function onGameClick(b) {
  const g = b.dataset.g;
  if (g === 'quit') { if (G.S.phase === 'done' || confirm('이 판을 그만할까요? 이 판의 기록은 남지 않아요.')) { const r = R; closeGame(); if (r) lobby(); } return; }
  if (g === 'card') return pickCard(Number(b.dataset.i));
  if (g === 'again') { const s = G.start.stage; closeGame(); return startGame(s); }
  if (g === 'next') { const s = Math.min(view().stages, G.start.stage + 1); closeGame(); return startGame(s); }
  if (g === 'map') { closeGame(); return lobby(); }
}

/* ---------- 엔진: 카메라 · 그림 · 풀 (연출 시험 페이지와 같은 방식) ---------- */
function initEngine(g) {
  g.cam = { z: -8.5, x: 0, h: 8, zoom: 1, back: 8.5, trauma: 0, punch: 0 };
  g.img = {}; g.mat = {}; g.tintCache = new Map(); g.SPR = {};
  g.pools = {
    D: pool(300, ['x', 'y', 'z', 'vx', 'vy', 'vz', 'rot', 'vr', 'life', 'max', 'size', 'kind']),
    M: pool(72, ['x', 'y', 'z', 'r', 'vr', 'vx', 'vy', 'vz', 'life', 'max', 'a', 'kind']),
    K: pool(260, ['x', 'y', 'z', 'vx', 'vy', 'vz', 'life', 'max', 'len', 'col']),
    Gl: pool(240, ['x', 'y', 'z', 'vx', 'vy', 'vz', 'life', 'max', 'size', 'kind', 'up']),
    F: pool(100, ['x', 'y', 'z', 'vx', 'vy', 'vz', 'life', 'max', 'rot', 'vr', 'kind']),
    B: pool(60, ['x', 'y', 'z', 'vx', 'vy', 'vz', 'life'])
  };
  g.rings = []; g.flashes = []; g.pops = []; g.fx = []; g.pieces = []; g.cutin = null; g.banner = null; g.view = new Map();
  g.slot = { ox: new Float32Array(DRAW_MAX), oz: new Float32Array(DRAW_MAX), pop: new Float32Array(DRAW_MAX) }; g.shown = 0;
  buildMats(g);
  resize(g);
  const want = [['pet', petSrc(g.pet.key, g.pet.form)]];
  for (const k of ['spirit-run', 'gate-good', 'gate-bad', 'rock-num', 'saw', 'hammer', 'crystal', 'cannon', 'bg-sky', 'post-sky', 'cloud-isle', 'castle-sky']) if (art(k)) want.push([k, art(k)]);
  for (const k of ['glow', 'ring', 'burst', 'flame', 'ember', 'star', 'stardust', 'speed', 'rock-a', 'rock-b', 'shard', 'smoke', 'dust']) if (ARENA_ART.has('mat-' + k)) want.push(['mat:' + k, `/assets/arena/mat-${k}.webp`]);
  for (const [k, src] of want) { const im = new Image(); im.decoding = 'async'; im.onload = () => { if (!G || G !== g) return; if (k.startsWith('mat:')) { const c = mk(im.width, im.height); c.getContext('2d').drawImage(im, 0, 0); g.mat[k.slice(4)] = c; g.matArt.add(k.slice(4)); g.tintCache.clear(); } else { g.img[k] = im; buildSprites(g); } }; im.src = src; }
  syncCrowd(g, 0, 0);
}
const pool = (n, keys) => { const o = { n: 0, keys, cap: n }; for (const k of keys) o[k] = new Float32Array(n); return o; };
function swapOut(A, j) { const l = --A.n; for (const k of A.keys) A[k][j] = A[k][l]; }
function resize(g) {
  g.cssW = innerWidth; g.cssH = innerHeight;
  g.S2 = g.T.scale < 1 ? g.T.scale : Math.min(devicePixelRatio || 1, g.T.scale);
  g.cvs.width = Math.round(g.cssW * g.S2); g.cvs.height = Math.round(g.cssH * g.S2);
  g.F = Math.min(g.cssW * 1.05, g.cssH * .62) * g.S2; g.CX = g.cvs.width / 2; g.HZ = g.cvs.height * .25;
  buildSky(g); buildSprites(g);
}
function radial(c, r0, stops, Rr, cx, cy) { const x = cx ?? (r0 || 0), y = cy ?? (r0 || 0), rad = Rr ?? r0; const gr = c.createRadialGradient(x, y, 0, x, y, rad); for (const [o, col] of stops) gr.addColorStop(o, col); c.fillStyle = gr; c.beginPath(); c.arc(x, y, rad, 0, TAU); c.fill(); }
function roundRect(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
function shade(hex, amt) { const n = parseInt(hex.slice(1), 16), f = v => clamp(v + amt, 0, 255); return `rgb(${f(n >> 16)},${f(n >> 8 & 255)},${f(n & 255)})`; }
function rock(c, size, base, flat = 1) {
  const r = size / 2, n = 8, pts = [];
  for (let i = 0; i < n; i++) { const a = i / n * TAU + (i % 3 - 1) * .2, d = r * (.68 + (i * 37 % 10) / 50); pts.push([r + Math.cos(a) * d, r + Math.sin(a) * d * flat]); }
  c.beginPath(); pts.forEach((p, i) => i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])); c.closePath();
  const gr = c.createLinearGradient(0, 0, size, size); gr.addColorStop(0, shade(base, 45)); gr.addColorStop(.55, base); gr.addColorStop(1, shade(base, -50));
  c.fillStyle = gr; c.fill(); c.lineWidth = Math.max(1.5, size / 30); c.strokeStyle = '#3a2a1c'; c.stroke();
  c.fillStyle = 'rgba(255,255,255,.3)'; c.beginPath(); c.moveTo(pts[0][0], pts[0][1]); c.lineTo(r, r); c.lineTo(pts[n - 1][0], pts[n - 1][1]); c.closePath(); c.fill();
}
function puff(c, size, n) { const r = size / 2; for (let i = 0; i < n; i++) { const a = i / n * TAU, d = r * .26 * (.4 + (i % 3) * .3); radial(c, 0, [[0, 'rgba(255,255,255,.55)'], [.7, 'rgba(235,235,235,.25)'], [1, 'rgba(220,220,220,0)']], r * .6, r + Math.cos(a) * d, r + Math.sin(a) * d); } }
// 효과 재료(아레나 그림 71과 같은 칸 이름 · 같은 처리). 그림이 오면 그 그림.
const MATS = {
  glow: ['add', 256, c => radial(c, 128, [[0, '#fff'], [.25, 'rgba(255,255,255,.75)'], [.6, 'rgba(255,255,255,.18)'], [1, 'rgba(255,255,255,0)']])],
  ring: ['add', 256, c => { for (const [w, a] of [[16, .18], [9, .35], [4, .9]]) { c.strokeStyle = `rgba(255,255,255,${a})`; c.lineWidth = w; c.beginPath(); c.arc(128, 128, 104, 0, TAU); c.stroke(); } }],
  burst: ['add', 256, c => { radial(c, 128, [[0, '#fff'], [.18, 'rgba(255,240,190,.8)'], [.45, 'rgba(255,220,140,0)']]); c.fillStyle = 'rgba(255,245,210,.95)'; for (let i = 0; i < 14; i++) { const a = i / 14 * TAU, L = 80 + (i * 29 % 40), w = .06; c.beginPath(); c.moveTo(128 + Math.cos(a - w) * 18, 128 + Math.sin(a - w) * 18); c.lineTo(128 + Math.cos(a) * L, 128 + Math.sin(a) * L); c.lineTo(128 + Math.cos(a + w) * 18, 128 + Math.sin(a + w) * 18); c.fill(); } }],
  flame: ['add', 256, c => { for (const [s, col] of [[1, 'rgba(200,40,10,.85)'], [.75, 'rgba(255,130,30,.9)'], [.48, 'rgba(255,220,110,.95)'], [.25, '#fff']]) { c.fillStyle = col; c.beginPath(); c.moveTo(128, 128 - 115 * s - 6); c.bezierCurveTo(128 + 70 * s, 128 - 30 * s, 128 + 62 * s, 128 + 90 * s, 128, 128 + 100 * s); c.bezierCurveTo(128 - 62 * s, 128 + 90 * s, 128 - 70 * s, 128 - 30 * s, 128, 128 - 115 * s - 6); c.fill(); } }],
  ember: ['add', 128, c => radial(c, 64, [[0, '#fff'], [.15, 'rgba(255,220,120,.95)'], [.4, 'rgba(255,120,30,.45)'], [1, 'rgba(255,80,20,0)']])],
  star: ['add', 256, c => { radial(c, 128, [[0, '#fff'], [.08, 'rgba(255,255,255,.8)'], [.2, 'rgba(190,220,255,0)']]); for (const [w, h, a] of [[230, 7, 0], [7, 230, 0], [120, 5, .785], [120, 5, -.785]]) { c.save(); c.translate(128, 128); c.rotate(a); const lg = c.createLinearGradient(-w / 2, 0, w / 2, 0); lg.addColorStop(0, 'rgba(200,225,255,0)'); lg.addColorStop(.5, '#fff'); lg.addColorStop(1, 'rgba(200,225,255,0)'); c.fillStyle = lg; c.beginPath(); c.ellipse(0, 0, w / 2, h / 2, 0, 0, TAU); c.fill(); c.restore(); } }],
  stardust: ['add', 256, c => { for (let i = 0; i < 13; i++) { const x = 50 + (i * 53 % 156), y = 50 + (i * 97 % 156), r = 6 + (i * 7 % 14); c.save(); c.translate(x, y); radial(c, 0, [[0, '#fff'], [.3, 'rgba(255,230,140,.8)'], [1, 'rgba(255,210,90,0)']], r); c.restore(); } }],
  speed: ['luma', 512, c => { for (let i = 0; i < 11; i++) { const y = 40 + (i * 13 % 133), x0 = 10 + (i * 31 % 150), L = 180 + (i * 17 % 150), h = 2 + (i % 5); const lg = c.createLinearGradient(x0, 0, x0 + L, 0); lg.addColorStop(0, '#fff'); lg.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = lg; c.fillRect(x0, y - h / 2, L, h); } }, 213],
  'rock-a': ['key', 128, c => rock(c, 128, '#8a7a66')],
  'rock-b': ['key', 128, c => rock(c, 128, '#7d7a72', .55)],
  shard: ['key', 128, c => { c.translate(64, 64); c.rotate(-.75); const gr = c.createLinearGradient(-40, -10, 40, 10); gr.addColorStop(0, '#e9fbff'); gr.addColorStop(.5, '#8fd6f5'); gr.addColorStop(1, '#3c8fc8'); c.fillStyle = gr; c.strokeStyle = '#1d4f86'; c.lineWidth = 2.5; c.beginPath(); c.moveTo(-50, 0); c.lineTo(-8, -13); c.lineTo(54, -2); c.lineTo(-4, 14); c.closePath(); c.fill(); c.stroke(); }],
  smoke: ['luma', 256, c => puff(c, 256, 7)],
  dust: ['luma', 256, c => { c.setTransform(1, 0, 0, .58, 0, 54); puff(c, 256, 9); }]
};
function buildMats(g) { g.matArt = new Set(); for (const [k, [, size, draw, h]] of Object.entries(MATS)) { const c = mk(size, h || size); draw(c.getContext('2d')); g.mat[k] = c; } }
function tint(g, k, rgb) {
  const key = k + '|' + rgb; let c = g.tintCache.get(key); if (c) return c;
  const src = g.mat[k]; c = mk(src.width, src.height); const x = c.getContext('2d'); x.drawImage(src, 0, 0);
  if (MATS[k][0] === 'luma') { x.globalCompositeOperation = 'source-in'; x.fillStyle = `rgb(${rgb})`; x.fillRect(0, 0, c.width, c.height); }
  else { x.globalCompositeOperation = 'saturation'; x.fillStyle = '#808080'; x.fillRect(0, 0, c.width, c.height); if (rgb !== '255,255,255') { x.globalCompositeOperation = 'multiply'; x.fillStyle = `rgb(${rgb})`; x.fillRect(0, 0, c.width, c.height); } x.globalCompositeOperation = 'destination-in'; x.drawImage(src, 0, 0); }
  g.tintCache.set(key, c); return c;
}
function buildSky(g) {
  const W = g.cvs.width, H = g.cvs.height, HZ = g.HZ, c = mk(W, H), x = c.getContext('2d');
  if (g.img['bg-sky']) { const im = g.img['bg-sky'], sc = Math.max(W / im.width, H / im.height); x.drawImage(im, (W - im.width * sc) / 2, (H - im.height * sc) / 2, im.width * sc, im.height * sc); g.sky = c; return; }
  let lg = x.createLinearGradient(0, 0, 0, HZ); lg.addColorStop(0, THEME.skyTop); lg.addColorStop(.7, THEME.skyMid); lg.addColorStop(1, THEME.horizon); x.fillStyle = lg; x.fillRect(0, 0, W, HZ + 1);
  radial(x, 0, [[0, 'rgba(255,252,230,1)'], [.15, 'rgba(255,240,190,.7)'], [1, 'rgba(255,240,190,0)']], W * .45, W * .72, HZ * .5);
  lg = x.createLinearGradient(0, HZ, 0, H); lg.addColorStop(0, THEME.horizon); lg.addColorStop(.25, THEME.sea); lg.addColorStop(1, THEME.seaDeep); x.fillStyle = lg; x.fillRect(0, HZ, W, H - HZ);
  for (let i = 0; i < 26; i++) radial(x, 0, [[0, 'rgba(255,255,255,.85)'], [1, 'rgba(255,255,255,0)']], (.04 + (i * 7 % 6) / 100) * W, ((i * 0.618) % 1.2 - .1) * W, HZ - (i * 13 % 10) / 30 * HZ);
  for (let i = 0; i < 46; i++) { const t = (i * 0.382) % 1, y = HZ + t * t * (H - HZ), r = (.03 + t * .16) * W; radial(x, 0, [[0, 'rgba(255,255,255,.7)'], [.6, 'rgba(248,246,255,.35)'], [1, 'rgba(240,238,255,0)']], r, ((i * 0.737) % 1.2 - .1) * W, y); }
  g.sky = c;
}
function fromImg(g, k, w, h) { const im = g.img[k]; if (!im) return null; const c = mk(w, h); c.getContext('2d').drawImage(im, 0, 0, w, h); return c; }
function whiteOf(c) { const w = mk(c.width, c.height), x = w.getContext('2d'); x.drawImage(c, 0, 0); x.globalCompositeOperation = 'source-in'; x.fillStyle = '#fff'; x.fillRect(0, 0, w.width, w.height); return w; }
function shrink(im, px) { let src = im, w = im.width, h = im.height; while (w / 2 > px * 1.2) { const c = mk(w / 2, h / 2); c.getContext('2d').drawImage(src, 0, 0, w / 2, h / 2); src = c; w /= 2; h /= 2; } const out = mk(px, px * h / w); out.getContext('2d').drawImage(src, 0, 0, out.width, out.height); return out; }
function spiritSprite(px, body = ['#e8fbff', '#7fd8ff', '#2f86d8'], flame = '#bff3ff') {
  const c = mk(px, px), x = c.getContext('2d'); x.scale(px / 64, px / 64);
  x.fillStyle = flame; x.beginPath(); x.moveTo(32, 3); x.bezierCurveTo(40, 14, 46, 22, 44, 30); x.lineTo(20, 30); x.bezierCurveTo(18, 22, 26, 14, 32, 3); x.fill();
  const gr = x.createRadialGradient(26, 30, 3, 32, 38, 26); gr.addColorStop(0, body[0]); gr.addColorStop(.55, body[1]); gr.addColorStop(1, body[2]);
  x.fillStyle = gr; x.strokeStyle = '#174a86'; x.lineWidth = 2.6; x.beginPath(); x.moveTo(32, 12); x.bezierCurveTo(50, 22, 56, 36, 54, 46); x.bezierCurveTo(52, 58, 12, 58, 10, 46); x.bezierCurveTo(8, 36, 14, 22, 32, 12); x.closePath(); x.fill(); x.stroke();
  x.fillStyle = 'rgba(255,255,255,.75)'; x.beginPath(); x.ellipse(22, 30, 5, 8, -.5, 0, TAU); x.fill();
  x.fillStyle = '#10213f'; for (const ex of [25, 39]) { x.beginPath(); x.ellipse(ex, 41, 3.4, 4.6, 0, 0, TAU); x.fill(); }
  x.fillStyle = '#fff'; for (const ex of [26.2, 40.2]) { x.beginPath(); x.arc(ex, 39.4, 1.3, 0, TAU); x.fill(); }
  x.fillStyle = 'rgba(255,120,160,.5)'; for (const ex of [19, 45]) { x.beginPath(); x.ellipse(ex, 47, 3.6, 2, 0, 0, TAU); x.fill(); }
  return c;
}
function buildSprites(g) {
  const S = g.S2, P = g.SPR, sp = Math.round(30 * S);
  P.spirit = fromImg(g, 'spirit-run', sp, sp) || spiritSprite(sp); P.spiritW = whiteOf(P.spirit);
  const sh = mk(64, 32), sx = sh.getContext('2d'), gr = sx.createRadialGradient(32, 16, 0, 32, 16, 32); gr.addColorStop(0, 'rgba(40,40,80,.4)'); gr.addColorStop(1, 'rgba(40,40,80,0)'); sx.setTransform(1, 0, 0, .5, 0, 8); sx.fillStyle = gr; sx.fillRect(0, -16, 64, 64); P.shadow = sh;
  P.pet = g.img.pet ? shrink(g.img.pet, Math.round(96 * S)) : null;
  P.petBig = g.img.pet ? shrink(g.img.pet, Math.round(Math.min(g.cssW * .8, 300) * S)) : null;
  P.rock = fromImg(g, 'rock-num', 160 * S, 150 * S); if (!P.rock) { P.rock = mk(160 * S, 150 * S); const x = P.rock.getContext('2d'); x.scale(S * 160 / 128, S * 150 / 128); rock(x, 128, '#9b8b78', .92); }
  P.rockW = whiteOf(P.rock);
  for (const [k, c1, c2, edge] of [['gate-good', 'rgba(70,170,255,.62)', 'rgba(40,120,240,.35)', '#bfe6ff'], ['gate-bad', 'rgba(255,90,100,.62)', 'rgba(220,40,70,.35)', '#ffc4c4']]) {
    P[k] = fromImg(g, k, 200, 150); if (P[k]) continue;
    const c = mk(200, 150), x = c.getContext('2d'), lg = x.createLinearGradient(0, 0, 0, 150); lg.addColorStop(0, c1); lg.addColorStop(1, c2); x.fillStyle = lg; roundRect(x, 4, 4, 192, 142, 14); x.fill(); x.lineWidth = 6; x.strokeStyle = edge; x.stroke(); x.fillStyle = 'rgba(255,255,255,.28)'; roundRect(x, 14, 12, 172, 22, 10); x.fill(); P[k] = c;
  }
  P.saw = fromImg(g, 'saw', 128, 128); if (!P.saw) { P.saw = mk(128, 128); const x = P.saw.getContext('2d'); x.translate(64, 64); x.fillStyle = '#d7dde6'; x.strokeStyle = '#3b4250'; x.lineWidth = 3; x.beginPath(); for (let i = 0; i < 16; i++) { const a = i / 16 * TAU; x.lineTo(Math.cos(a) * 60, Math.sin(a) * 60); x.lineTo(Math.cos(a + .2) * 46, Math.sin(a + .2) * 46); } x.closePath(); x.fill(); x.stroke(); const r2 = x.createRadialGradient(-10, -10, 4, 0, 0, 44); r2.addColorStop(0, '#fff'); r2.addColorStop(1, '#8b96a8'); x.fillStyle = r2; x.beginPath(); x.arc(0, 0, 40, 0, TAU); x.fill(); x.fillStyle = '#e04848'; x.beginPath(); x.arc(0, 0, 12, 0, TAU); x.fill(); x.stroke(); }
  P.hammer = fromImg(g, 'hammer', 160, 110); if (!P.hammer) { P.hammer = mk(160, 110); const x = P.hammer.getContext('2d'), lg = x.createLinearGradient(0, 0, 0, 110); lg.addColorStop(0, '#ffcf6b'); lg.addColorStop(1, '#a8621a'); x.fillStyle = lg; x.strokeStyle = '#4a2a08'; x.lineWidth = 5; roundRect(x, 6, 8, 148, 94, 18); x.fill(); x.stroke(); x.fillStyle = 'rgba(255,255,255,.35)'; roundRect(x, 18, 16, 124, 18, 9); x.fill(); }
  P.post = fromImg(g, 'post-sky', 40, 120); if (!P.post) { P.post = mk(40, 120); const x = P.post.getContext('2d'), lg = x.createLinearGradient(0, 0, 40, 0); lg.addColorStop(0, '#fff3c2'); lg.addColorStop(.5, THEME.rail); lg.addColorStop(1, THEME.railDark); x.fillStyle = lg; x.fillRect(10, 20, 20, 100); x.beginPath(); x.arc(20, 18, 15, 0, TAU); x.fill(); }
  P.cloud = fromImg(g, 'cloud-isle', 256, 140); if (!P.cloud) { P.cloud = mk(256, 140); const x = P.cloud.getContext('2d'); for (const [cx, cy, r] of [[70, 80, 50], [120, 62, 62], [180, 82, 48], [140, 96, 52], [92, 100, 44]]) radial(x, 0, [[0, '#fff'], [.75, 'rgba(250,248,255,.95)'], [1, 'rgba(235,232,255,0)']], r, cx, cy); }
  // 수정 감옥(안에 구출할 내 펫)
  { const W = 200 * S, H = 240 * S, c = mk(W, H), x = c.getContext('2d'); x.scale(S, S);
    const shape = [[100, 6], [176, 70], [160, 200], [100, 234], [40, 200], [24, 70]], path = () => { x.beginPath(); shape.forEach(([a, b], i) => i ? x.lineTo(a, b) : x.moveTo(a, b)); x.closePath(); };
    if (g.img.pet) { x.save(); path(); x.clip(); x.drawImage(g.img.pet, 40, 70, 120, 120 * g.img.pet.height / g.img.pet.width); x.restore(); }
    if (g.img.crystal) x.drawImage(g.img.crystal, 0, 0, 200, 240);
    else { path(); const lg = x.createLinearGradient(24, 0, 176, 240); lg.addColorStop(0, 'rgba(230,250,255,.55)'); lg.addColorStop(.5, 'rgba(120,200,255,.25)'); lg.addColorStop(1, 'rgba(60,120,220,.5)'); x.fillStyle = lg; x.fill(); x.lineWidth = 5; x.strokeStyle = '#e8fbff'; x.stroke(); x.lineWidth = 2; x.strokeStyle = 'rgba(40,110,200,.8)'; x.beginPath(); x.moveTo(100, 6); x.lineTo(100, 234); x.moveTo(24, 70); x.lineTo(100, 110); x.lineTo(176, 70); x.moveTo(40, 200); x.lineTo(100, 110); x.lineTo(160, 200); x.stroke(); x.fillStyle = 'rgba(255,255,255,.6)'; x.beginPath(); x.moveTo(44, 74); x.lineTo(96, 18); x.lineTo(80, 96); x.closePath(); x.fill(); }
    P.crystal = c; P.crystalW = whiteOf(c); }
  buildCastle(g); buildCannon(g); buildDigits(g);
  P.text = new Map();
}
function buildCastle(g) {
  const S = g.S2, W = 300 * S, H = 300 * S, c = mk(W, H), x = c.getContext('2d');
  if (g.img['castle-sky']) x.drawImage(g.img['castle-sky'], 0, 0, W, H);
  else {
    x.scale(S, S);
    const stone = (sx, sy, w, h) => { const lg = x.createLinearGradient(sx, 0, sx + w, 0); lg.addColorStop(0, '#d9d1c4'); lg.addColorStop(.5, '#bdb2a1'); lg.addColorStop(1, '#8f8474'); x.fillStyle = lg; x.fillRect(sx, sy, w, h); x.strokeStyle = '#4c4236'; x.lineWidth = 3; x.strokeRect(sx, sy, w, h); x.strokeStyle = 'rgba(76,66,54,.45)'; x.lineWidth = 1.5; for (let yy = sy + 14; yy < sy + h; yy += 14) { x.beginPath(); x.moveTo(sx, yy); x.lineTo(sx + w, yy); x.stroke(); } for (let xx = sx; xx < sx + w - 4; xx += 16) { x.fillStyle = '#c9bfae'; x.fillRect(xx, sy - 12, 10, 12); x.strokeStyle = '#4c4236'; x.lineWidth = 2.5; x.strokeRect(xx, sy - 12, 10, 12); } };
    stone(50, 110, 200, 180); stone(10, 60, 70, 230); stone(220, 60, 70, 230); stone(115, 30, 70, 120);
    for (const [fx, fy] of [[45, 40], [255, 40], [150, 10]]) { x.fillStyle = '#6b4b2a'; x.fillRect(fx - 2, fy - 40, 4, 44); x.fillStyle = g.map.boss ? '#9b5bff' : '#ff5a6a'; x.beginPath(); x.moveTo(fx + 2, fy - 40); x.lineTo(fx + 34, fy - 30); x.lineTo(fx + 2, fy - 20); x.fill(); }
    x.fillStyle = '#3a2614'; x.beginPath(); x.moveTo(115, 290); x.lineTo(115, 215); x.arc(150, 215, 35, Math.PI, 0); x.lineTo(185, 290); x.fill();
    for (const [wx, wy] of [[45, 120], [255, 120], [150, 70], [45, 200], [255, 200]]) { x.fillStyle = '#20263a'; x.beginPath(); x.moveTo(wx - 7, wy + 18); x.lineTo(wx - 7, wy); x.arc(wx, wy, 7, Math.PI, 0); x.lineTo(wx + 7, wy + 18); x.fill(); x.fillStyle = 'rgba(255,210,120,.8)'; x.fillRect(wx - 3, wy + 2, 6, 10); }
  }
  g.castleBase = c; g.SPR.castle = mk(W, H); g.SPR.castle.getContext('2d').drawImage(c, 0, 0); g.SPR.castleW = whiteOf(c);
  for (let l = 1; l <= (g.cracks || 0); l++) crackCastle(g, l);
}
function crackCastle(g, level) {
  const x = g.SPR.castle.getContext('2d'); x.save(); x.scale(g.S2, g.S2); x.globalCompositeOperation = 'source-atop'; x.strokeStyle = 'rgba(40,28,18,.85)'; x.lineCap = 'round';
  for (let i = 0; i < 4 + level * 3; i++) { let cx = 30 + (i * 67 + level * 41) % 240, cy = 60 + (i * 53 + level * 29) % 210; x.lineWidth = 1.5 + (i % 3); x.beginPath(); x.moveTo(cx, cy); for (let k = 0; k < 6; k++) { cx += ((i + k) % 5 - 2) * 6; cy += 6 + (k * 3 % 10); x.lineTo(cx, cy); } x.stroke(); }
  x.restore();
}
function buildCannon(g) {
  const S = g.S2, c = fromImg(g, 'cannon', 140 * S, 120 * S); if (c) { g.SPR.cannon = c; return; }
  const d = mk(140 * S, 120 * S), x = d.getContext('2d'); x.scale(S, S);
  x.save(); x.translate(70, 64); x.rotate(-.2); const lg = x.createLinearGradient(-22, 0, 22, 0); lg.addColorStop(0, '#5b6a8a'); lg.addColorStop(.45, '#a9b8d8'); lg.addColorStop(1, '#2f3a54'); x.fillStyle = lg; x.strokeStyle = '#141a2a'; x.lineWidth = 3; roundRect(x, -20, -58, 40, 72, 10); x.fill(); x.stroke(); x.fillStyle = '#ffd25a'; x.fillRect(-21, -50, 42, 7); x.restore();
  for (const wx of [34, 106]) { const r = x.createRadialGradient(wx - 4, 92, 2, wx, 96, 22); r.addColorStop(0, '#e9b56a'); r.addColorStop(1, '#7a4a1a'); x.fillStyle = r; x.strokeStyle = '#3a2208'; x.lineWidth = 3; x.beginPath(); x.arc(wx, 96, 20, 0, TAU); x.fill(); x.stroke(); }
  g.SPR.cannon = d;
}
const NUM_STYLES = { count: [30, '#ffffff', '#d8f3ff', '#123a6b', 6], rock: [30, '#ffffff', '#fff1d0', '#3a2614', 6], good: [44, '#ffffff', '#d6f1ff', '#0d3f86', 8], bad: [44, '#ffffff', '#ffe0e0', '#7a1020', 8], pop: [34, '#fff7b0', '#ffc53a', '#5a2c00', 7], minus: [30, '#ffe0e0', '#ff6a6a', '#4a0a10', 6] };
const GLYPHS = '0123456789+×−';
function buildDigits(g) {
  const S = g.S2; g.SPR.digits = {};
  for (const [k, [size, f0, f1, stroke, lw]] of Object.entries(NUM_STYLES)) {
    const fs = size * S, cw = Math.ceil(fs * .78), ch = Math.ceil(fs * 1.3), c = mk(cw * GLYPHS.length, ch), x = c.getContext('2d');
    x.font = `${fs}px Jua, system-ui, sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.lineJoin = 'round';
    const gr = x.createLinearGradient(0, ch * .2, 0, ch * .8); gr.addColorStop(0, f0); gr.addColorStop(1, f1);
    for (let d = 0; d < GLYPHS.length; d++) { x.lineWidth = lw * S; x.strokeStyle = stroke; x.strokeText(GLYPHS[d], d * cw + cw / 2, ch / 2); x.fillStyle = gr; x.fillText(GLYPHS[d], d * cw + cw / 2, ch / 2); }
    g.SPR.digits[k] = { c, cw, ch, adv: cw * .74 };
  }
}
function drawNum(g, style, str, x, y, sc = 1, a = 1) {
  const A = g.SPR.digits[style], w = A.adv * str.length * sc, c = g.ctx; c.globalAlpha = a;
  for (let d = 0; d < str.length; d++) { const v = GLYPHS.indexOf(str[d]); if (v < 0) continue; c.drawImage(A.c, v * A.cw, 0, A.cw, A.ch, x - w / 2 + d * A.adv * sc - (A.cw - A.adv) * sc / 2, y - A.ch * sc / 2, A.cw * sc, A.ch * sc); }
  c.globalAlpha = 1;
}
function textSprite(g, text, kind, el = 'star') {
  const key = kind + '|' + el + '|' + text; let s = g.SPR.text.get(key); if (s) return s;
  const S = g.S2, fs = { pill: 16, cut: 46, banner: 40 }[kind] * S, m = mk(4, 4).getContext('2d'); m.font = `${fs}px Jua, system-ui, sans-serif`;
  const w = Math.ceil(m.measureText(text).width + 24 * S), h = Math.ceil(fs * 1.7), c = mk(w, h), x = c.getContext('2d'); x.font = m.font; x.textAlign = 'center'; x.textBaseline = 'middle'; x.lineJoin = 'round';
  const col = { star: '#ffd84a', flame: '#ff7a3a', ice: '#7fd4ff', spirit: '#7fd8ff', water: '#5fc0ff', leaf: '#8fe06a', earth: '#d8a868', wind: '#8ff0c8', toxic: '#c06cff' }[el] || '#ffd84a';
  if (kind === 'pill') { roundRect(x, 2 * S, 3 * S, w - 4 * S, h - 6 * S, (h - 6 * S) / 2); x.fillStyle = 'rgba(16,20,40,.88)'; x.fill(); x.lineWidth = 2 * S; x.strokeStyle = col; x.stroke(); x.fillStyle = '#fff'; x.fillText(text, w / 2, h / 2 + S); }
  else { const gr = x.createLinearGradient(0, h * .2, 0, h * .8); gr.addColorStop(0, '#fff'); gr.addColorStop(1, col); x.lineWidth = 9 * S; x.strokeStyle = '#141a33'; x.strokeText(text, w / 2, h / 2); x.fillStyle = gr; x.fillText(text, w / 2, h / 2); }
  s = { c, w, h }; g.SPR.text.set(key, s); return s;
}

/* ---------- 원근 ---------- */
let PX = 0, PY = 0, PS = 0;
function proj(g, x, y, z) { const cam = g.cam, dz = z - cam.z; if (dz < .7) return false; const f = g.F * (cam.zoom + cam.punch) / dz; PX = g.CX + (x - cam.x) * f; PY = g.HZ + (cam.h - y) * f; PS = f; return true; }

/* ---------- 무리(그리는 칸) ---------- */
const TOX = new Float32Array(DRAW_MAX), TOZ = new Float32Array(DRAW_MAX), PH = new Float32Array(DRAW_MAX);
for (let i = 0; i < DRAW_MAX; i++) { const r = .22 * Math.sqrt(i + .5), a = i * 2.39996; TOX[i] = Math.cos(a) * r; TOZ[i] = Math.sin(a) * r * .85; PH[i] = (i * .618 % 1) * TAU; }
const ORDER = Array.from({ length: DRAW_MAX }, (_, i) => i).sort((a, b) => TOZ[b] - TOZ[a]);
function syncCrowd(g, fromX, fromZ) {
  const want = Math.min(g.S.n, g.T.draw), sl = g.slot;
  if (want > g.shown) for (let i = g.shown; i < want; i++) { sl.ox[i] = fromX; sl.oz[i] = fromZ; sl.pop[i] = 0; }
  else for (let i = want; i < g.shown; i++) flyer(g, g.S.cx + sl.ox[i], .4, g.S.z + sl.oz[i], 0);
  g.shown = want;
}

/* ---------- 풀에 넣기 ---------- */
function addDebris(g, x, y, z, n, kind = 0, power = 1) { const D = g.pools.D; n = Math.round(n * g.T.mult); for (let i = 0; i < n; i++) { if (D.n >= g.T.debris) return; const j = D.n++, a = rnd() * TAU, sp = rr(.2, 1) * 7 * power; D.x[j] = x + rr(-.3, .3); D.y[j] = y + rr(0, .4); D.z[j] = z + rr(-.3, .3); D.vx[j] = Math.cos(a) * sp; D.vz[j] = Math.sin(a) * sp * .8 - rr(0, 4) * power; D.vy[j] = rr(4, 11) * power; D.rot[j] = rnd() * TAU; D.vr[j] = rr(-12, 12); D.max[j] = D.life[j] = rr(1, 1.8); D.size[j] = rr(.18, .5); D.kind[j] = kind; } }
function addSmoke(g, x, y, z, n, kind = 0, r = .8, spread = 1) { const M = g.pools.M; n = Math.max(1, Math.round(n * g.T.mult)); for (let i = 0; i < n; i++) { if (M.n >= g.T.smoke) return; const j = M.n++, a = rnd() * TAU, d = rr(0, spread); M.x[j] = x + Math.cos(a) * d; M.y[j] = y + rr(0, .5); M.z[j] = z + Math.sin(a) * d; M.r[j] = r * rr(.6, 1.2); M.vr[j] = r * rr(.8, 1.6); M.vx[j] = Math.cos(a) * rr(.5, 2); M.vy[j] = rr(.3, 1.4); M.vz[j] = Math.sin(a) * rr(.5, 2); M.max[j] = M.life[j] = rr(.9, 1.8); M.a[j] = rr(.5, .85); M.kind[j] = kind; } }
function addSparks(g, x, y, z, n, col = 0, speed = 12, len = .5) { const K = g.pools.K; n = Math.round(n * g.T.mult); for (let i = 0; i < n; i++) { if (K.n >= g.T.sparks) return; const j = K.n++, a = rnd() * TAU, b = rr(-.3, 1.2), sp = speed * rr(.35, 1); K.x[j] = x; K.y[j] = y; K.z[j] = z; K.vx[j] = Math.cos(a) * Math.cos(b) * sp; K.vz[j] = Math.sin(a) * Math.cos(b) * sp; K.vy[j] = Math.sin(b) * sp; K.max[j] = K.life[j] = rr(.2, .45); K.len[j] = len * rr(.6, 1.3); K.col[j] = col; } }
function addGlow(g, x, y, z, n, kind, speed = 3, size = .6, life = .6, up = 0) { const Q = g.pools.Gl; n = Math.max(1, Math.round(n * g.T.mult)); for (let i = 0; i < n; i++) { if (Q.n >= g.T.glows) return; const j = Q.n++, a = rnd() * TAU, sp = speed * rr(.3, 1); Q.x[j] = x + rr(-.2, .2); Q.y[j] = y + rr(-.2, .2); Q.z[j] = z; Q.vx[j] = Math.cos(a) * sp; Q.vz[j] = Math.sin(a) * sp; Q.vy[j] = rr(-.5, 1) * sp * .5; Q.max[j] = Q.life[j] = life * rr(.6, 1.2); Q.size[j] = size * rr(.6, 1.3); Q.kind[j] = kind; Q.up[j] = up; } }
function flyer(g, x, y, z, kind, tx = 0, ty = 0, tz = 0, dur = .9) { const F = g.pools.F; if (F.n >= g.T.fly) return; const j = F.n++; F.x[j] = x; F.y[j] = y; F.z[j] = z; F.kind[j] = kind; F.rot[j] = 0; F.vr[j] = rr(-10, 10); if (kind) { F.vx[j] = (tx - x) / dur; F.vz[j] = (tz - z) / dur; F.vy[j] = (ty - y) / dur + 15.7 * dur / 2; F.max[j] = F.life[j] = dur; } else { const a = rr(-.9, .9) + (x > g.S.cx ? 0 : Math.PI); F.vx[j] = Math.cos(a) * rr(3, 7); F.vz[j] = rr(-3, 3); F.vy[j] = rr(5, 9); F.max[j] = F.life[j] = rr(.7, 1); } }
function shoot(g, x, z, tx, ty, tz) { const B = g.pools.B; if (B.n >= g.T.shots) return; const j = B.n++, d = Math.hypot(tx - x, tz - z) || 1, sp = 42; B.x[j] = x; B.y[j] = .7; B.z[j] = z; B.vx[j] = (tx - x) / d * sp; B.vz[j] = (tz - z) / d * sp; B.vy[j] = (ty - .7) / d * sp; B.life[j] = d / sp; }
function ring(g, x, y, z, r1, dur, rgb, delay = 0) { if (g.rings.length < 14) g.rings.push({ x, y, z, r1, dur, rgb, t: -delay }); }
function flash(g, x, y, z, r, dur, rgb = '255,255,255', k = 'glow') { if (g.flashes.length < 20) g.flashes.push({ x, y, z, r, dur, k, rgb, t: 0 }); }
function popNum(g, style, str, x, y, z) { if (g.pops.length >= 10) g.pops.shift(); g.pops.push({ style, str, x, y, z, t: 0 }); }
function shake(g, v) { g.cam.trauma = Math.min(1, g.cam.trauma + v); }
function later(g, s, fn) { g.timers.push({ at: g.clock + s, fn }); }
function screenTint(el, a = .16) { const t = $('rn-tint'); if (!t) return; t.style.background = `rgb(${EL_RGB[el] || '255,255,255'})`; t.style.transition = 'none'; t.style.opacity = a; requestAnimationFrame(() => { t.style.transition = 'opacity .5s ease-out'; t.style.opacity = 0; }); }
function whiteFlash(a) { const f = $('rn-flash'); if (!f) return; f.style.transition = 'none'; f.style.opacity = Math.min(.85, a); requestAnimationFrame(() => { f.style.transition = 'opacity .3s ease-out'; f.style.opacity = 0; }); }

/* ---------- 규칙 사건 → 연출 · 소리 ---------- */
function onEvent(type, a, b, c, d) {
  const g = G; if (!g) return; const S = g.S, sl = g.slot;
  if (type === 'shoot') { const v = vw(g, a); v.hitT = .08; if ((g.shotT -= 1) > 0) return; g.shotT = 2; const n = Math.min(3, 1 + (S.n / 80 | 0)); for (let i = 0; i < n; i++) { const k = (rnd() * Math.max(1, g.shown)) | 0; shoot(g, S.cx + sl.ox[k], S.z + sl.oz[k] + .4, a.x + rr(-.4, .4), .9, a.z - .6); } snd('shoot'); return; }
  if (type === 'break') { snd('rock-break'); shake(g, .18); addDebris(g, a.x, .5, a.z, 22, 0, 1.1); addSmoke(g, a.x, .2, a.z, 5, 0, .9, .8); addSparks(g, a.x, .8, a.z, 14, 1, 13); addGlow(g, a.x, .8, a.z, 6, 0, 4, .5, .5, 2); flash(g, a.x, .8, a.z, 2.2, .3); flash(g, a.x, .8, a.z, 1.6, .25, '255,255,255', 'burst'); ring(g, a.x, .2, a.z, 2.6, .4, '255,240,200'); return; }
  if (type === 'crash') { snd('rock-hit'); if (!b) return; shake(g, .45); whiteFlash(.25); addDebris(g, a.x, .5, a.z, 26, a.type === 'crystal' ? 1 : 0, 1.2); addSmoke(g, a.x, .2, a.z, 8, 2, 1, 1); lose(g, b, S.cx); return; }
  if (type === 'saw' || type === 'hammer') { snd(type); if (!b) return; shake(g, type === 'saw' ? .15 : .4); addSparks(g, a.x, .6, a.z, type === 'saw' ? 12 : 8, 1, 14); if (type === 'hammer') { addSmoke(g, a.x, 0, a.z, 6, 0, 1, 1.2); ring(g, a.x, .1, a.z, 2.4, .35, '255,240,210'); } lose(g, b, a.x); return; }
  if (type === 'gate') {
    const ok = goodGate(c), gx = b * RUNNER.ROAD / 2, v = vw(g, a); v.passT = 0;
    snd(ok ? (c[0] === '×' ? 'multiply' : 'gate-good') : 'gate-bad'); if (ok) screenTint('spirit', .12); else shake(g, .25);
    flash(g, gx, 1.2, a.z, 3.4, .35, ok ? '140,210,255' : '255,120,120'); ring(g, gx, .3, a.z, 3.2, .45, ok ? '170,230,255' : '255,150,150'); addGlow(g, gx, 1.2, a.z, 14, ok ? 4 : 0, 4, .6, .7, 1.5);
    if (S.n > d) { popNum(g, 'pop', '+' + (S.n - d), S.cx, 2.6, S.z + 1.5); syncCrowd(g, gx - S.cx, 1); addGlow(g, S.cx, 1, S.z, 10, 2, 3, .5, .6, 1); }
    else if (S.n < d) lose(g, d - S.n, S.cx);
    return;
  }
  if (type === 'card') { snd('card'); showCards(a); return; }
  if (type === 'pick') { if (S.n !== g.lastN) { popNum(g, 'pop', '+' + Math.max(0, S.n - g.lastN), S.cx, 2.6, S.z + 1.5); syncCrowd(g, 0, 2); } return; }
  if (type === 'rescue') {
    snd('rescue'); shake(g, .6); whiteFlash(.5); addDebris(g, a.x, 1.2, a.z, 40, 1, 1.4); addGlow(g, a.x, 1.4, a.z, 16, 3, 5, .9, .7, 2); flash(g, a.x, 1.4, a.z, 4, .5, '160,230,255'); ring(g, a.x, .3, a.z, 4, .5, '200,240,255');
    const sk = PET_SKILL[g.pet.el] || PET_SKILL.star;
    g.cutin = { t: 0, dur: 1.05, name: `${CHARACTERS[g.pet.key]?.ko || '펫'} 구출!`, sub: sk.name + '!', el: g.pet.el || 'star' }; $('rn-vig')?.classList.add('ult'); later(g, 1.1, () => $('rn-vig')?.classList.remove('ult'));
    return;
  }
  if (type === 'skill') {
    const el = a; screenTint(el, .2); shake(g, .5); const z0 = S.z + 1, rgb = EL_RGB[el] || EL_RGB.star;
    g.fx.push({ t: 0, dur: 1, draw(dt) { const wz = z0 + this.t * 40; for (let i = 0; i < 3; i++) addGlow(g, rr(-RUNNER.ROAD, RUNNER.ROAD), rr(.2, 1.4), wz, 1, el === 'flame' ? 1 : 4, 1.5, rr(1, 1.8), .45, 3); if (rnd() < .4) addSmoke(g, rr(-RUNNER.ROAD, RUNNER.ROAD), .3, wz - 1, 1, 3, 1, .5); void dt; } });
    flash(g, S.cx, 1.5, S.z + 3, 5, .6, rgb); pill(g, (PET_SKILL[el] || PET_SKILL.star).name + '!', el);
    if (S.n !== g.lastN) { popNum(g, 'pop', '+' + (S.n - g.lastN), S.cx, 2.6, S.z + 1.5); syncCrowd(g, 0, 2); }
    return;
  }
  if (type === 'siege') { snd('card'); pill(g, '공성전! 화면을 누르고 있으면 발사', 'star', 2.4); $('rn-hint').textContent = '누르고 있으면 발사'; syncCrowd(g, 0, 0); return; }
  if (type === 'petSiege') { snd('castle-hit'); screenTint(g.pet.el, .22); shake(g, .6); whiteFlash(.35); const cz = S.castle.z; flash(g, 0, 4, cz - 1, 7, .5, EL_RGB[g.pet.el] || '255,180,90'); addDebris(g, 0, 4, cz - 1, 20, 0, 1); popNum(g, 'minus', '−' + a, 0, 9, cz); castleHit(g); return; }
  if (type === 'pour') { snd('cannon'); const vis = Math.min(3, a); for (let i = 0; i < vis; i++) flyer(g, S.cx + rr(-.3, .3), 2, S.z + crowdR(S.n) + 1.2, 1, rr(-2.5, 2.5), rr(1.5, 5), S.castle.z - 1, rr(.55, .75)); g.cam.punch += .006; syncCrowd(g, 0, 0); return; }
  if (type === 'fall') { castleDown(g); return; }
  if (type === 'done') { later(g, S.castle.down ? 1.4 : .6, () => sendFinish(g)); if (!a) snd('fail'); return; }
}
const vw = (g, o) => { let v = g.view.get(o); if (!v) { v = { hitT: 0, passT: -1 }; g.view.set(o, v); } return v; };
function lose(g, loss, x) { const S = g.S, sl = g.slot; popNum(g, 'minus', '−' + loss, x, 2.2, S.z + 1); for (let i = 0; i < Math.min(14, loss); i++) { const k = (rnd() * Math.max(1, g.shown)) | 0; flyer(g, S.cx + sl.ox[k], .4, S.z + sl.oz[k], 0); } syncCrowd(g, 0, 0); }
function pill(g, text, el = 'spirit', dur = 1.6) { g.banner = { text, el, t: 0, dur }; }
function castleHit(g) {
  const c = g.S.castle; g.castleHitT = .08; snd('castle-hit');
  const level = c.hp / c.max < .33 ? 2 : c.hp / c.max < .66 ? 1 : 0;
  if (level > (g.cracks || 0)) { g.cracks = level; crackCastle(g, level); addDebris(g, rr(-3, 3), 6, c.z, 12, 0, .8); shake(g, .3); }
}
function castleDown(g) {
  const c = g.S.castle; snd('castle-fall'); whiteFlash(.8); shake(g, 1); g.hitstop = .12; g.cam.punch += .08;
  flash(g, 0, 4, c.z, 10, .7); flash(g, 0, 4, c.z, 14, 1, '255,214,140');
  for (let i = 0; i < 3; i++) ring(g, 0, .2, c.z, 7 + i * 3, .6 + i * .15, i ? '255,230,180' : '255,255,255', i * .08);
  addDebris(g, 0, 3, c.z, 120, 0, 1.6); addSmoke(g, 0, .5, c.z, 26, 0, 2.2, 5); addSmoke(g, 0, 3, c.z, 10, 2, 2, 3); addSparks(g, 0, 4, c.z, 40, 1, 18, .8); addGlow(g, 0, 4, c.z, 30, 2, 8, 1, 1.2, 1);
  g.pieces = [];
  for (let r = 0; r < 5; r++) for (let q = 0; q < 6; q++) g.pieces.push({ sx: q / 6, sy: r / 5, x: (q + .5) / 6 * 10 - 5, y: 10 - (r + .5) / 5 * 10, z: c.z, vx: rr(-2, 2) + ((q + .5) / 6 - .5) * 4, vy: rr(1, 5) + (5 - r) * .4, vz: rr(-3, 1), rot: 0, vr: rr(-2, 2), t: 0 });
}
function showCards(o) {
  const el = $('rn-cards'); if (!el) return;
  $('rn-vig')?.classList.add('ult'); G.lastN = G.S.n;
  el.innerHTML = `<p class="rn-cards-h">카드 한 장을 골라요</p><div class="rn-card-row">${o.cards.map((c, i) => `<button type="button" class="rn-card" data-g="card" data-i="${i}"><b>${esc(cardName(c))}</b><small>${esc(CARDS[c[0]]?.tag || '')}</small></button>`).join('')}</div>`;
  el.classList.add('on');
}
function pickCard(i) {
  const g = G; if (!g || g.S.phase !== 'card') return;
  const el = $('rn-cards'); el.querySelectorAll('.rn-card')[i]?.classList.add('picked');
  g.lastN = g.S.n; g.rec.pick(i); runPick(g.S, i, onEvent); snd('star');
  setTimeout(() => { el.classList.remove('on'); $('rn-vig')?.classList.remove('ult'); }, 260);
}

/* ---------- 결과 ---------- */
async function sendFinish(g) {
  if (g.sent || G !== g) return; g.sent = true;
  let res = null, err = null;
  try { res = await api('/runner/finish', { id: g.id, input: g.rec.out() }); } catch (e) { err = e; }
  if (G !== g) return;
  if (res?.runner && R) R.v = res.runner;
  if (res?.points_balance != null && R?.A?.data?.stats) R.A.data.stats.points_balance = res.points_balance;
  showResult(g, res, err);
}
function showResult(g, res, err) {
  const el = $('rn-result'); if (!el) return;
  const stars = res?.valid ? res.stars : g.S.stars, clear = stars > 0, v = view(), last = g.start.stage >= v.stages, canNext = clear && !last;
  const reason = err ? (err.message || '결과를 보내지 못했어요.') : res && !res.valid ? ({ fast: '너무 빨리 끝난 판이라 기록되지 않았어요.', expired: '판이 너무 오래 열려 있어서 기록되지 않았어요.', input: '조종 기록을 읽지 못했어요.' }[res.reason] || '기록되지 않았어요.') : '';
  el.innerHTML = `<div class="rn-res-card${clear ? ' win' : ''}"><h2>${clear ? (g.map.boss ? '보스 성 함락!' : '성 함락!') : '아쉬워요!'}</h2>
    <div class="rn-res-stars">${[0, 1, 2].map(i => `<i class="${i < stars ? 'on' : ''}" style="--d:${.25 + i * .3}s"></i>`).join('')}</div>
    <ul class="rn-res-list"><li><span>남은 정령</span><b>${num(g.S.left)}</b></li><li><span>깬 바위</span><b>${num(g.S.broke)}</b></li>
      ${res?.valid ? `<li><span>코인</span><b>${coin()}+${num(res.coins || 0)}</b></li>${res.box ? `<li class="box"><span>오늘 첫 판 상자</span><b>${coin()}+${num(res.box)}</b></li>` : ''}` : ''}</ul>
    ${res?.valid && !res.coins && res.stars && v.coin_today >= v.coin_daily ? `<p class="rn-res-note">오늘 코인은 다 받았어요. 별과 기록은 그대로 쌓여요!</p>` : ''}
    ${!clear && res?.cheer_next ? `<p class="rn-res-note">다음 판은 응원 정령 +${Math.round(res.cheer_next * 100)}%로 시작해요!</p>` : ''}
    ${reason ? `<p class="rn-res-note warn">${esc(reason)}</p>` : ''}
    <div class="rn-res-btns"><button type="button" class="yl-cta" data-g="${canNext ? 'next' : 'again'}">${canNext ? '다음 스테이지' : '다시 도전'}</button>${canNext ? '<button type="button" class="rn-ghost" data-g="again">다시</button>' : ''}<button type="button" class="rn-ghost" data-g="map">지도</button></div></div>`;
  el.hidden = false;
  if (clear) for (let i = 0; i < stars; i++) setTimeout(() => snd('star'), 250 + i * 300);
}

/* ---------- 고리: 고정 틱 + 보간 · 자동 품질 ---------- */
function frame(now) {
  const g = G; if (!g || !g.alive) return;
  g.raf = requestAnimationFrame(frame);
  if (!g.last) { g.last = now; return; }
  let dt = (now - g.last) / 1000; g.last = now;
  if (g.paused) return;
  g.frameLog.push(dt * 1000); dt = Math.min(dt, .1);
  const fdt = g.hitstop > 0 ? 0 : dt; g.clock += fdt;
  for (let i = g.timers.length - 1; i >= 0; i--) if (g.clock >= g.timers[i].at) { const f = g.timers[i].fn; g.timers.splice(i, 1); f(); }
  const S = g.S;
  if (S.phase !== 'card' && S.phase !== 'done') {
    g.acc += dt * 1000; let steps = 0;
    while (g.acc >= RUNNER.TICK && steps < 5 && S.phase !== 'card' && S.phase !== 'done') {
      g.pz = S.z; g.pcx = S.cx; g.lastN = S.n;
      // 화면 시험(docs/runner-play-shot.mjs)만 자동 조종을 넣는다(앱은 이 값을 만들지 않는다).
      if (typeof window.__rnAutopilot === 'function') { const ap = window.__rnAutopilot(S); g.tx = ap.tx; g.hold = !!ap.hold; }
      const tx = quantTx(g.tx), hold = S.phase === 'siege' && g.hold;
      g.rec.tick(S.tick, tx, hold); runTick(S, tx, hold, onEvent); g.acc -= RUNNER.TICK; steps++;
    }
    if (steps === 5) g.acc = 0;
  } else { g.pz = S.z; g.pcx = S.cx; g.acc = 0; }
  render(g, dt, Math.min(1, g.acc / RUNNER.TICK));
  g.frames++;
  if (now - g.lastCheck > 2000) { g.lastCheck = now; autoTier(g); const p = $('rn-prog'); if (p) p.style.transform = `scaleX(${clamp(S.z / g.map.len, 0, 1)})`; }
}
function autoTier(g) {
  const log = g.frameLog; g.frameLog = []; if (!log.length || g.tier === 0 || g.frames < 90) return;
  const slow = log.filter(d => d > 20).length / log.length;
  if (slow > .15) { g.tier = Math.max(0, g.tier - (slow > .5 ? 2 : 1)); g.T = TIERS[g.tier]; writePref(TIER_KEY, JSON.stringify({ t: g.tier, at: Date.now() })); const P = g.pools; for (const [k, cap] of [['D', 'debris'], ['M', 'smoke'], ['K', 'sparks'], ['Gl', 'glows'], ['F', 'fly'], ['B', 'shots']]) P[k].n = Math.min(P[k].n, g.T[cap]); resize(g); syncCrowd(g, 0, 0); }
}

/* ---------- 그리기 ---------- */
function render(g, dt, alpha) {
  const ctx = g.ctx, S = g.S, cam = g.cam, fdt = g.hitstop > 0 ? 0 : dt;
  const z = lerp(g.pz, S.z, alpha), cx = lerp(g.pcx, S.cx, alpha), siege = S.phase === 'siege' || (S.phase === 'done' && S.castle.down) || S.siegeT > 0;
  const tb = siege ? 11 : 8.5, th = siege ? 9 : 8, tzm = siege ? 1.3 : 1, k = 1 - Math.exp(-dt * 2.5);
  cam.back += (tb - cam.back) * k; cam.h += (th - cam.h) * k; cam.zoom += (tzm - cam.zoom) * k;
  cam.z = z - cam.back; cam.x += (cx * .35 - cam.x) * (1 - Math.exp(-dt * 4));
  cam.punch = Math.min(cam.punch, .15) * Math.exp(-dt * 7); cam.trauma = Math.max(0, cam.trauma - dt * 1.6);
  const shk = cam.trauma * cam.trauma * .35, tt = performance.now() / 1000, sx = cam.x, sh = cam.h;
  cam.x += shk * Math.sin(tt * 71); cam.h += shk * Math.sin(tt * 89 + 1) * .6;
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  ctx.drawImage(g.sky, 0, 0);
  drawClouds(g); drawRoad(g);
  const objs = [];
  for (const o of S.items) if (o.z > cam.z + 1 && o.z < cam.z + 95 && o.type !== 'card' && o.type !== 'end') objs.push(o);
  if (siege || S.castle.z < cam.z + 95) objs.push({ type: 'castle', z: S.castle.z });
  objs.push({ type: 'crowd', z: z + .01 });
  objs.sort((a, b) => b.z - a.z);
  for (const o of objs) drawObj(g, o, fdt, cx, z, alpha);
  drawSmoke(g, fdt); drawDebris(g, fdt); drawFlyers(g, fdt); drawBullets(g, fdt);
  drawRings(g, fdt); drawFlashes(g, fdt); drawGlows(g, fdt); drawSparks(g, fdt);
  for (let i = g.fx.length - 1; i >= 0; i--) { const f = g.fx[i]; f.draw(fdt); f.t += fdt; if (f.t >= f.dur) g.fx.splice(i, 1); }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  drawPops(g, fdt); drawBanner(g, dt); drawCutin(g, dt);
  cam.x = sx; cam.h = sh; g.hitstop = Math.max(0, (g.hitstop || 0) - dt);
}
function drawClouds(g) {
  const ctx = g.ctx, k0 = Math.floor((g.cam.z + 4) / 15), ord = [];
  for (let k = k0 + 7; k >= k0; k--) for (const sd of [-1, 1]) { const h = Math.sin(k * 12.9898 + sd * 78.233) * 43758.5453, f = h - Math.floor(h); ord.push([sd * (7 + f * 9), -2.5 - f * 2.5, k * 15 + f * 6, 3 + f * 3]); }
  ctx.globalAlpha = .95;
  for (const [x, y, zz, w] of ord) if (proj(g, x, y, zz)) { const ww = w * PS; ctx.drawImage(g.SPR.cloud, PX - ww / 2, PY - ww * .3, ww, ww * .55); }
  ctx.globalAlpha = 1;
}
function drawRoad(g) {
  const ctx = g.ctx, cam = g.cam, ROAD = RUNNER.ROAD, z0 = Math.floor((cam.z + 1) / 3) * 3, far = 90, rail = .35, endZ = g.S.castle.z + 6;
  for (let zz = z0 + far; zz >= z0; zz -= 3) {
    if (zz > endZ) continue;
    const za = Math.max(zz, cam.z + .8), zb = zz + 3; if (zb <= za) continue;
    if (!proj(g, -ROAD - rail, 0, zb)) continue; const lxB = PX, yB = PY, sB = PS; proj(g, ROAD + rail, 0, zb); const rxB = PX;
    proj(g, -ROAD - rail, 0, za); const lxA = PX, yA = PY, sA = PS; proj(g, ROAD + rail, 0, za); const rxA = PX;
    const fog = clamp((zz - cam.z) / far, 0, 1) * .85, base = (Math.floor(zz / 3) & 1) ? THEME.roadA : THEME.roadB;
    ctx.fillStyle = fog > .6 ? '#e8e2d0' : THEME.rail; ctx.beginPath(); ctx.moveTo(lxB, yB); ctx.lineTo(rxB, yB); ctx.lineTo(rxA, yA); ctx.lineTo(lxA, yA); ctx.fill();
    const iB = rail * sB, iA = rail * sA;
    ctx.fillStyle = `rgb(${lerp(base[0], THEME.fog[0], fog) | 0},${lerp(base[1], THEME.fog[1], fog) | 0},${lerp(base[2], THEME.fog[2], fog) | 0})`; ctx.beginPath(); ctx.moveTo(lxB + iB, yB); ctx.lineTo(rxB - iB, yB); ctx.lineTo(rxA - iA, yA); ctx.lineTo(lxA + iA, yA); ctx.fill();
    ctx.fillStyle = `rgba(120,80,40,${.25 * (1 - fog)})`; ctx.fillRect(lxB + iB, yB, rxB - lxB - iB * 2, Math.max(1, .05 * sB));
  }
  const p0 = Math.ceil((cam.z + 1.5) / 6) * 6;
  for (let i = g.T.posts - 1; i >= 0; i--) { const zz = p0 + i * 6; if (zz > endZ) continue; for (const sd of [-1, 1]) if (proj(g, sd * (ROAD + .18), 0, zz)) { const w = .45 * PS, h = 1.3 * PS; ctx.drawImage(g.SPR.post, PX - w / 2, PY - h, w, h); } }
}
function drawObj(g, o, dt, cx, z, alpha) {
  const ctx = g.ctx, P = g.SPR, S = g.S, t = S.tick - 1 + alpha;
  if (o.type === 'gate') {
    const v = vw(g, o); if (v.passT >= 0) { v.passT += dt; if (v.passT > .5) return; }
    if (!proj(g, 0, 0, o.z)) return;
    const fade = v.passT >= 0 ? 1 - v.passT / .5 : 1;
    for (const [side, val] of [[-1, o.l], [1, o.r]]) {
      const x0 = side < 0 ? -RUNNER.ROAD + .15 : .15, x1 = side < 0 ? -.15 : RUNNER.ROAD - .15;
      proj(g, x0, 2.6, o.z); const ax = PX, ay = PY; proj(g, x1, 0, o.z); const bx = PX, by = PY, sc = PS;
      const chosen = o.took === side, a = v.passT >= 0 ? (chosen ? fade : fade * .4) : 1, grow = chosen && v.passT >= 0 ? 1 + v.passT * .6 : 1;
      const cxm = (ax + bx) / 2, cym = (ay + by) / 2, w = (bx - ax) * grow, h = (by - ay) * grow;
      ctx.globalAlpha = a; ctx.drawImage(goodGate(val) ? P['gate-good'] : P['gate-bad'], cxm - w / 2, cym - h / 2, w, h);
      drawNum(g, goodGate(val) ? 'good' : 'bad', val[0] + val[1], cxm, cym, Math.min(1.8, sc / 34) * grow, a); ctx.globalAlpha = 1;
    }
    proj(g, 0, 2.8, o.z); const tx = PX, ty = PY; proj(g, 0, 0, o.z); ctx.fillStyle = '#f2f6ff'; ctx.fillRect(tx - .1 * PS, ty, .2 * PS, PY - ty);
    return;
  }
  if (o.type === 'rock') {
    if (o.done || !proj(g, o.x, 0, o.z)) return; const v = vw(g, o);
    const w = 2.1 * PS, h = w * 150 / 160, wob = v.hitT > 0 ? rr(-.06, .06) * PS : 0;
    ctx.globalAlpha = .5; ctx.drawImage(P.shadow, PX - w * .55, PY - w * .12, w * 1.1, w * .3); ctx.globalAlpha = 1;
    ctx.drawImage(P.rock, PX - w / 2 + wob, PY - h * .9, w, h);
    if (v.hitT > 0) { v.hitT -= dt; ctx.globalAlpha = .45; ctx.drawImage(P.rockW, PX - w / 2 + wob, PY - h * .9, w, h); ctx.globalAlpha = 1; }
    drawNum(g, 'rock', String(Math.ceil(o.hp)), PX, PY - h * .45, Math.min(1.5, PS / 34)); return;
  }
  if (o.type === 'saw') {
    const x = o.stop ? o.x : o.x0 + o.amp * tri(t / o.per); if (!proj(g, x, .75, o.z)) return; const r = .8 * PS, y0 = PY;
    proj(g, -RUNNER.ROAD, .05, o.z); const lx = PX, ly = PY; proj(g, RUNNER.ROAD, .05, o.z); ctx.fillStyle = 'rgba(60,60,80,.55)'; ctx.fillRect(lx, ly - .06 * PS, PX - lx, .12 * PS); proj(g, x, .75, o.z);
    ctx.save(); ctx.translate(PX, y0); ctx.rotate(o.stop ? 0 : g.clock * 14); ctx.drawImage(P.saw, -r, -r, r * 2, r * 2); ctx.restore(); return;
  }
  if (o.type === 'hammer') {
    const L = 3, ang = o.stop ? 0 : Math.sin(tri(t / o.per + o.ph) * Math.PI / 2) * 1.25; if (!proj(g, o.x, 4.2, o.z)) return; const px = PX, py = PY;
    proj(g, o.x + Math.sin(ang) * L, 4.2 - Math.cos(ang) * L, o.z); const hx = PX, hy = PY, s2 = PS;
    ctx.strokeStyle = '#6b4520'; ctx.lineWidth = .22 * s2; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(hx, hy); ctx.stroke();
    ctx.fillStyle = '#4a3a2a'; ctx.beginPath(); ctx.arc(px, py, .25 * s2, 0, TAU); ctx.fill();
    ctx.save(); ctx.translate(hx, hy); ctx.rotate(ang); const w = 1.8 * s2, h = 1.2 * s2; ctx.drawImage(P.hammer, -w / 2, -h / 2, w, h); ctx.restore(); return;
  }
  if (o.type === 'crystal') {
    if (o.done || !proj(g, o.x, 0, o.z)) return; const v = vw(g, o), w = 2.6 * PS, h = w * 1.2, bob = Math.sin(g.clock * 2) * .1 * PS, wob = v.hitT > 0 ? rr(-.05, .05) * PS : 0;
    ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = .5 + .2 * Math.sin(g.clock * 4); ctx.drawImage(tint(g, 'glow', '140,220,255'), PX - w, PY - h * 1.05, w * 2, w * 2); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(P.crystal, PX - w / 2 + wob, PY - h + bob, w, h);
    if (v.hitT > 0) { v.hitT -= dt; ctx.globalAlpha = .5; ctx.drawImage(P.crystalW, PX - w / 2 + wob, PY - h + bob, w, h); ctx.globalAlpha = 1; }
    drawNum(g, 'rock', String(Math.ceil(o.hp)), PX, PY - h - .3 * PS, Math.min(1.4, PS / 40)); return;
  }
  if (o.type === 'castle') return drawCastle(g, dt);
  if (o.type === 'crowd') return drawCrowd(g, dt, cx, z);
}
function drawCastle(g, dt) {
  const ctx = g.ctx, c = g.S.castle, P = g.SPR; if (c.down) return drawPieces(g, dt);
  if (!proj(g, 0, 0, c.z)) return; const w = 10 * PS, wob = g.castleHitT > 0 ? rr(-.05, .05) * PS : 0;
  ctx.drawImage(P.castle, PX - w / 2 + wob, PY - w, w, w);
  if (g.castleHitT > 0) { g.castleHitT -= dt; ctx.globalAlpha = .35; ctx.drawImage(P.castleW, PX - w / 2 + wob, PY - w, w, w); ctx.globalAlpha = 1; }
  proj(g, 0, 11.4, c.z); const bw = 6 * PS, bh = .55 * PS, p = c.hp / c.max;
  ctx.fillStyle = 'rgba(16,20,40,.8)'; roundRect(ctx, PX - bw / 2 - 3, PY - 3, bw + 6, bh + 6, bh / 2 + 3); ctx.fill();
  ctx.fillStyle = p > .5 ? '#6dea7a' : p > .25 ? '#ffd257' : '#ff6262'; roundRect(ctx, PX - bw / 2, PY, Math.max(bh, bw * p), bh, bh / 2); ctx.fill();
  drawNum(g, 'count', String(Math.ceil(c.hp)), PX, PY + bh / 2, Math.min(1.1, PS / 30));
}
function drawPieces(g, dt) {
  const ctx = g.ctx, src = g.SPR.castle, cw = src.width / 6, ch = src.height / 5;
  for (const q of g.pieces) {
    if (dt) { q.t += dt; q.vy -= 14 * dt; q.x += q.vx * dt; q.y += q.vy * dt; q.z += q.vz * dt; q.rot += q.vr * dt; if (q.y < .6) { q.y = .6; q.vy *= -.25; q.vx *= .6; q.vr *= .5; } }
    const a = q.t > 2 ? Math.max(0, 1 - (q.t - 2) / .8) : 1; if (a <= 0 || !proj(g, q.x, q.y, q.z)) continue;
    ctx.globalAlpha = a; ctx.save(); ctx.translate(PX, PY); ctx.rotate(q.rot); const w = 10 / 6 * PS * 1.04, h = 10 / 5 * PS * 1.04; ctx.drawImage(src, q.sx * src.width, q.sy * src.height, cw, ch, -w / 2, -h / 2, w, h); ctx.restore();
  }
  ctx.globalAlpha = 1;
}
function drawCrowd(g, dt, cx, z) {
  const ctx = g.ctx, S = g.S, P = g.SPR, sl = g.slot, siege = S.phase === 'siege' || S.siegeT > 0, run = S.phase === 'run', t = g.clock, Rr = crowdR(S.n);
  if (siege && proj(g, cx, 0, z + Rr + .8)) { const w = 2.6 * PS, h = w * 120 / 140; ctx.drawImage(P.cannon, PX - w / 2, PY - h * .92, w, h); }
  if (proj(g, cx, 0, z)) { const w = (Rr * 2 + .8) * PS; ctx.globalAlpha = .55; ctx.drawImage(P.shadow, PX - w / 2, PY - w * .14, w, w * .32); ctx.globalAlpha = 1; }
  const spring = 1 - Math.exp(-dt * 7), spr = P.spirit;
  for (let oi = 0; oi < DRAW_MAX; oi++) {
    const i = ORDER[oi]; if (i >= g.shown) continue;
    sl.ox[i] += (TOX[i] - sl.ox[i]) * spring; sl.oz[i] += (TOZ[i] - sl.oz[i]) * spring; if (sl.pop[i] < 1) sl.pop[i] = Math.min(1, sl.pop[i] + dt * 3.5);
    const hop = run ? Math.abs(Math.sin(t * 11 + PH[i])) * .28 : Math.abs(Math.sin(t * 4 + PH[i])) * .1;
    if (!proj(g, cx + sl.ox[i], hop, z + sl.oz[i])) continue;
    const pp = sl.pop[i], sz = .52 * PS * (pp < 1 ? easeOut(pp) * 1.15 : 1), sq = run ? 1 + Math.sin(t * 22 + PH[i]) * .06 : 1;
    ctx.drawImage(spr, PX - sz / 2, PY - sz * sq, sz, sz * sq);
  }
  if (S.petOn && P.pet && proj(g, cx + (siege ? -1.9 : Rr * .55), Math.abs(Math.sin(t * 8)) * .25, z + Rr * .5 + .6)) { const w = 2.5 * PS, h = w * P.pet.height / P.pet.width; ctx.drawImage(P.pet, PX - w / 2, PY - h, w, h); }
  if (proj(g, cx, 1.9 + Rr * .35, z + Rr * .3)) {
    const str = String(S.n), sc = Math.min(1.3, PS / 34), A = P.digits.count, w = A.adv * str.length * sc + 26 * g.S2 * sc, h = A.ch * sc * .9;
    ctx.fillStyle = 'rgba(16,40,90,.78)'; roundRect(ctx, PX - w / 2, PY - h / 2, w, h, h / 2); ctx.fill(); ctx.lineWidth = 2 * g.S2; ctx.strokeStyle = '#9fe1ff'; ctx.stroke();
    ctx.drawImage(spr, PX - w / 2 + 4 * g.S2 * sc, PY - h * .42, h * .84, h * .84); drawNum(g, 'count', str, PX + 10 * g.S2 * sc, PY, sc);
  }
}
const DEB = [['rock-a', 'rock-b'], ['shard']], PUFF = [['dust', '235,225,205'], ['smoke', '255,255,255'], ['dust', '200,185,160'], ['smoke', '120,110,130']], SPARK = ['#ffffff', '#ffe066', '#ff8a3a', '#8fe0ff'];
const GLOW = [['ember', '255,190,90'], ['flame', '255,255,255'], ['stardust', '255,255,255'], ['star', '255,255,255'], ['ember', '120,220,255']];
const ADJ = { glow: [.55, .8], burst: [.8, .9], ring: [.85, 1], ember: [1, 3.2], stardust: [.9, 1.3], star: [.85, 1] };
const adj = (g, k) => g.matArt.has(k) ? ADJ[k] || [1, 1] : [1, 1];
function drawDebris(g, dt) {
  const D = g.pools.D, ctx = g.ctx;
  for (let j = D.n - 1; j >= 0; j--) { D.life[j] -= dt; if (D.life[j] <= 0) { swapOut(D, j); continue; } if (dt) { D.vy[j] -= 22 * dt; D.x[j] += D.vx[j] * dt; D.y[j] += D.vy[j] * dt; D.z[j] += D.vz[j] * dt; D.rot[j] += D.vr[j] * dt; if (D.y[j] < 0) { D.y[j] = 0; D.vy[j] *= -.3; D.vx[j] *= .6; D.vz[j] *= .6; D.vr[j] *= .5; } } }
  for (let j = 0; j < D.n; j++) { if (!proj(g, D.x[j], D.y[j], D.z[j])) continue; const set = DEB[D.kind[j]], im = g.mat[set[j % set.length]], s = D.size[j] * PS, c = Math.cos(D.rot[j]), sn = Math.sin(D.rot[j]), iw = s / im.width; ctx.globalAlpha = Math.min(1, D.life[j] / .3); ctx.setTransform(c * iw, sn * iw, -sn * iw, c * iw, PX, PY); ctx.drawImage(im, -im.width / 2, -im.height / 2); }
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1;
}
function drawSmoke(g, dt) {
  const M = g.pools.M, ctx = g.ctx;
  for (let j = M.n - 1; j >= 0; j--) { M.life[j] -= dt; if (M.life[j] <= 0) { swapOut(M, j); continue; } M.x[j] += M.vx[j] * dt; M.y[j] += M.vy[j] * dt; M.z[j] += M.vz[j] * dt; M.vx[j] *= 1 - dt * 1.5; M.vz[j] *= 1 - dt * 1.5; M.r[j] += M.vr[j] * dt; M.vr[j] *= 1 - dt * .8; }
  for (let j = 0; j < M.n; j++) { if (!proj(g, M.x[j], M.y[j], M.z[j])) continue; const p = 1 - M.life[j] / M.max[j], a = M.a[j] * (p < .15 ? p / .15 : 1 - (p - .15) / .85), r = M.r[j] * PS, [k, rgb] = PUFF[M.kind[j]]; ctx.globalAlpha = a; ctx.drawImage(tint(g, k, rgb), PX - r, PY - r, r * 2, r * 2); }
  ctx.globalAlpha = 1;
}
function drawFlyers(g, dt) {
  const F = g.pools.F, ctx = g.ctx, c = g.S.castle;
  for (let j = F.n - 1; j >= 0; j--) { F.life[j] -= dt; if (F.life[j] <= 0) { if (F.kind[j] && !c.down) { g.castleHitT = .06; if (rnd() < .5) addSparks(g, F.x[j], F.y[j], F.z[j], 3, 3, 8, .4); if (rnd() < .25) addSmoke(g, F.x[j], F.y[j], F.z[j], 1, 1, .6, .3); castleHit(g); } swapOut(F, j); continue; } if (dt) { F.vy[j] -= (F.kind[j] ? 15.7 : 18) * dt; F.x[j] += F.vx[j] * dt; F.y[j] += F.vy[j] * dt; F.z[j] += F.vz[j] * dt; F.rot[j] += F.vr[j] * dt; } }
  const spr = g.SPR.spirit;
  for (let j = 0; j < F.n; j++) { if (!proj(g, F.x[j], F.y[j], F.z[j])) continue; const sz = .52 * PS, a = F.kind[j] ? 1 : Math.min(1, F.life[j] / F.max[j] * 1.5), cc = Math.cos(F.rot[j]), sn = Math.sin(F.rot[j]), iw = sz / spr.width; ctx.globalAlpha = a; ctx.setTransform(cc * iw, sn * iw, -sn * iw, cc * iw, PX, PY); ctx.drawImage(F.kind[j] ? spr : g.SPR.spiritW, -spr.width / 2, -spr.height / 2); }
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1;
}
function drawBullets(g, dt) {
  const B = g.pools.B, ctx = g.ctx;
  for (let j = B.n - 1; j >= 0; j--) { B.life[j] -= dt; if (B.life[j] <= 0) { addSparks(g, B.x[j], B.y[j], B.z[j], 2, 1, 7, .3); swapOut(B, j); continue; } B.x[j] += B.vx[j] * dt; B.y[j] += B.vy[j] * dt; B.z[j] += B.vz[j] * dt; }
  if (!B.n) return;
  ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round'; ctx.strokeStyle = '#bff0ff'; ctx.lineWidth = 2.2 * g.S2; ctx.beginPath();
  for (let j = 0; j < B.n; j++) { if (!proj(g, B.x[j], B.y[j], B.z[j])) continue; const x1 = PX, y1 = PY; if (!proj(g, B.x[j] - B.vx[j] * .035, B.y[j] - B.vy[j] * .035, B.z[j] - B.vz[j] * .035)) continue; ctx.moveTo(x1, y1); ctx.lineTo(PX, PY); }
  ctx.stroke(); ctx.globalCompositeOperation = 'source-over';
}
function drawGlows(g, dt) {
  const Q = g.pools.Gl, ctx = g.ctx;
  for (let j = Q.n - 1; j >= 0; j--) { Q.life[j] -= dt; if (Q.life[j] <= 0) { swapOut(Q, j); continue; } Q.x[j] += Q.vx[j] * dt; Q.y[j] += Q.vy[j] * dt + Q.up[j] * dt; Q.z[j] += Q.vz[j] * dt; Q.vx[j] *= 1 - dt * 2; Q.vz[j] *= 1 - dt * 2; }
  if (!Q.n) return;
  ctx.globalCompositeOperation = 'lighter';
  for (let j = 0; j < Q.n; j++) { if (!proj(g, Q.x[j], Q.y[j], Q.z[j])) continue; const [k, rgb] = GLOW[Q.kind[j]], im = rgb === '255,255,255' ? g.mat[k] : tint(g, k, rgb), p = Q.life[j] / Q.max[j], [ga, gs] = adj(g, k), s = Q.size[j] * gs * PS * (Q.kind[j] === 1 ? .6 + p * .6 : 1); ctx.globalAlpha = Math.min(1, p * 2) * ga; ctx.drawImage(im, PX - s / 2, PY - s / 2, s, s); }
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
}
function drawSparks(g, dt) {
  const K = g.pools.K, ctx = g.ctx;
  for (let j = K.n - 1; j >= 0; j--) { K.life[j] -= dt; if (K.life[j] <= 0) { swapOut(K, j); continue; } K.vy[j] -= 10 * dt; K.x[j] += K.vx[j] * dt; K.y[j] += K.vy[j] * dt; K.z[j] += K.vz[j] * dt; const d = 1 - 3 * dt; K.vx[j] *= d; K.vz[j] *= d; }
  if (!K.n) return;
  ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round'; ctx.lineWidth = 1.6 * g.S2;
  for (let c = 0; c < SPARK.length; c++) { let any = false; ctx.beginPath(); for (let j = 0; j < K.n; j++) { if (K.col[j] !== c || !proj(g, K.x[j], K.y[j], K.z[j])) continue; const x1 = PX, y1 = PY, sp = Math.hypot(K.vx[j], K.vy[j], K.vz[j]) || 1, l = K.len[j] * K.life[j] / K.max[j]; if (!proj(g, K.x[j] - K.vx[j] / sp * l, K.y[j] - K.vy[j] / sp * l, K.z[j] - K.vz[j] / sp * l)) continue; any = true; ctx.moveTo(x1, y1); ctx.lineTo(PX, PY); } if (any) { ctx.strokeStyle = SPARK[c]; ctx.stroke(); } }
  ctx.globalCompositeOperation = 'source-over';
}
function drawRings(g, dt) {
  const ctx = g.ctx; ctx.globalCompositeOperation = 'lighter';
  for (let i = g.rings.length - 1; i >= 0; i--) { const r = g.rings[i]; r.t += dt; if (r.t >= r.dur) { g.rings.splice(i, 1); continue; } if (r.t < 0 || !proj(g, r.x, r.y, r.z)) continue; const p = r.t / r.dur, a = (1 - p) * (1 - p), Rr = r.r1 * easeOut(p) * PS;
    if (g.T.glow) { ctx.globalAlpha = a * adj(g, 'ring')[0]; const s = Rr * 2 * (256 / 208); ctx.drawImage(tint(g, 'ring', r.rgb), PX - s / 2, PY - s * .2, s, s * .4); ctx.globalAlpha = 1; } else { ctx.strokeStyle = `rgba(${r.rgb},${a})`; ctx.lineWidth = 2 * g.S2; ctx.beginPath(); ctx.ellipse(PX, PY, Rr, Rr * .35, 0, 0, TAU); ctx.stroke(); } }
  ctx.globalCompositeOperation = 'source-over';
}
function drawFlashes(g, dt) {
  const ctx = g.ctx; ctx.globalCompositeOperation = 'lighter';
  for (let i = g.flashes.length - 1; i >= 0; i--) { const f = g.flashes[i]; f.t += dt; if (f.t >= f.dur) { g.flashes.splice(i, 1); continue; } if (!proj(g, f.x, f.y, f.z)) continue; const [ga, gs] = adj(g, f.k), p = f.t / f.dur, a = (p < .1 ? 1 : 1 - (p - .1) / .9) * ga, r = f.r * gs * (.6 + .4 * easeOut(p)) * PS, im = f.rgb === '255,255,255' && f.k !== 'glow' ? g.mat[f.k] : tint(g, f.k, f.rgb); ctx.globalAlpha = a; ctx.drawImage(im, PX - r, PY - r, r * 2, r * 2); }
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
}
function drawPops(g, dt) { for (let i = g.pops.length - 1; i >= 0; i--) { const n = g.pops[i]; n.t += dt; if (n.t > 1.1) { g.pops.splice(i, 1); continue; } if (!proj(g, n.x, n.y + easeOut(Math.min(1, n.t / .6)) * 1.2, n.z)) continue; const pop = n.t < .1 ? 1.8 - 8 * n.t : 1, a = n.t > .8 ? (1.1 - n.t) / .3 : 1; drawNum(g, n.style, n.str, PX, PY, pop * Math.min(1.5, PS / 30 + .4), a); } }
function drawBanner(g, dt) {
  const b = g.banner; if (!b) return; b.t += dt; if (b.t > b.dur) { g.banner = null; return; }
  const s = textSprite(g, b.text, 'pill', b.el), a = b.t > b.dur - .2 ? (b.dur - b.t) / .2 : 1, sc = b.t < .12 ? .6 + b.t / .12 * .4 : 1;
  g.ctx.globalAlpha = a; g.ctx.drawImage(s.c, g.cvs.width / 2 - s.w * sc / 2, 96 * g.S2 - s.h * sc / 2, s.w * sc, s.h * sc); g.ctx.globalAlpha = 1;
}
function drawCutin(g, dt) {
  const c = g.cutin; if (!c) return; c.t += dt; if (c.t > c.dur) { g.cutin = null; return; }
  const ctx = g.ctx, W = g.cvs.width, H = g.cvs.height, S = g.S2, t = c.t / c.dur, cy = H * .4, bh = Math.min(H * .26, 240 * S), open = t < .15 ? easeOut(t / .15) : t > .85 ? 1 - (t - .85) / .15 : 1;
  ctx.save(); ctx.translate(W / 2, cy); ctx.rotate(-.12); ctx.scale(1, open);
  ctx.fillStyle = 'rgba(12,10,30,.92)'; ctx.fillRect(-W, -bh / 2, W * 2, bh); ctx.fillStyle = `rgb(${EL_RGB[c.el] || EL_RGB.star})`; ctx.fillRect(-W, -bh / 2, W * 2, 4 * S); ctx.fillRect(-W, bh / 2 - 4 * S, W * 2, 4 * S);
  ctx.globalCompositeOperation = 'lighter'; const sp = tint(g, 'speed', EL_RGB[c.el] || EL_RGB.star);
  for (let i = 0; i < g.T.cutLines; i++) { const yy = (-.45 + .9 * ((i * .618) % 1)) * bh, len = W * (.5 + ((i * .37) % .5)), xx = W * .9 - ((c.t * 2.6 * W + i * 97 * S) % (W * 2.2)); ctx.globalAlpha = .55; ctx.drawImage(sp, xx, yy - 10 * S, len, 22 * S); }
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  const big = g.SPR.petBig; if (big) { const bw = big.width, slide = t < .3 ? 1 - easeOut(t / .3) : t > .7 ? -easeOut((t - .7) / .3) : 0; ctx.drawImage(big, slide * W * .9 + bw * .15 - bw / 2, -bw * .55, bw, bw * big.height / big.width); }
  const s1 = textSprite(g, c.name, 'cut', 'spirit'), s2 = textSprite(g, c.sub, 'cut', c.el), sc = t < .25 ? 1.6 - t / .25 * .6 : 1;
  ctx.drawImage(s1.c, -W * .2 - s1.w * sc / 2, -bh * .2 - s1.h * sc / 2, s1.w * sc, s1.h * sc); ctx.drawImage(s2.c, -W * .14 - s2.w * sc * .4, bh * .2 - s2.h * sc * .4, s2.w * sc * .8, s2.h * sc * .8);
  ctx.restore();
}
export const RUNNER_SOUND_EVENTS = SND_EVENTS;
