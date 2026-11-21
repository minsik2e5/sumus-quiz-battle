import { api, esc, num, icon, toast } from './ui.js';
import { coin } from './emblems.js';
import { avatar } from './character.js';
import { openSheet } from './sheet.js';
import { CHARACTERS } from './core.js';
import { RUNNER, PET_SKILL, cardName, CARDS, CARD_TEXT, UPGRADES, THEME_NAME, theme, makeMap, runInit, runTick, runPick, recorder, quantTx, crowdR, foeR, tri, goodGate, gateSides, gateSplit, gateSwapped, pillarUp, isBoss, stageTarget } from './runner-rules.js';
import { RUNNER_ART, RUNNER_SFX } from './runner-art.js';
import { ARENA_ART } from './arena-art.js';
import { modeMap } from './runner-modes.js';
import { metaCards, openDailySheet, openRaidSheet, resultMeta, fillDailyRank, elKo } from './runner-meta.js';

// V13.241 펫 대행진(크라우드 러너, 놀이터). 구성안 docs/pet-runner-plan.md · 펫 대행진 연출 시험 페이지의 엔진을 옮겨 씀.
// 화면 흐름: 지도(스테이지 1~25, 별 3개) → [출발] → 한 판(달리기 · 카드 2번 · 수정 구출 · 공성전) → 결과 → [다시] 한 번에 바로.
// 규칙은 runner-rules.js(서버와 같은 파일)가 고정 틱 50ms로 돌리고, 여기서는 그리기 · 소리 · 조종 기록만 한다.
//   - 무리는 숫자 하나. 정령은 품질 단계마다 최대 40 · 70 · 110 · 150마리만 그린다(나머지는 머리 위 숫자).
//   - 효과 저장소는 정해진 크기의 풀(파편 · 연기 · 불꽃 · 빛 · 날아가는 정령 · 탄). 빛 번짐은 미리 번진 그림(ctx.filter 없음).
//   - 품질 자동 4단계: 2초마다 20ms 넘은 프레임이 15% 넘으면 한 단계, 50% 넘으면 두 단계 내림(올리지 않음). 내려간 단계는 7일 기억.
//   - 그림 74(public/assets/runner/<이름>.webp)는 build:assets가 RUNNER_ART에 적은 것만 쓰고, 없으면 같은 자리를 코드 그림으로.
//   - 소리는 runner-sfx.js(다른 작업에서 만듦)가 있을 때만 runnerSound(사건 이름)를 부른다(RUNNER_SFX). 없으면 조용히.
// 서버 요청은 판마다 두 번: POST /runner/start → POST /runner/finish(조종 기록). 지도 · 반 순위는 GET.

// v13.242 새 사건 7개(벽 맞음 · 벽 깨짐 · 정면 충돌 · 충돌 승리 함성 · 피버 · 모래 소용돌이 · 불기둥)는 기존 rn-* 소리의 높낮이 · 겹침 변형(runner-sfx.js)
const SND_EVENTS = ['gate-good', 'gate-bad', 'multiply', 'shoot', 'rock-hit', 'rock-break', 'saw', 'hammer', 'rescue', 'card', 'cannon', 'castle-hit', 'castle-fall', 'star', 'fail', 'start', 'wall-hit', 'wall-break', 'clash', 'clash-win', 'fever', 'whirl', 'pillar'];
let soundFn = null;
// 펫 대행진에 들어갈 때 한 번: 소리 표를 불러 preloadRunnerSound()로 rn-*.mp3를 미리 받는다(첫 화면 로딩 · 서비스 워커 미리 받기에는 없음).
function loadSound() { if (!RUNNER_SFX || soundFn) return; import('./runner-sfx.js').then(m => { soundFn = m.runnerSound || null; try { m.preloadRunnerSound?.(); } catch {} }).catch(() => {}); }
// 화면 시험(docs/runner-play-shot.mjs)만 window.__rnSndLog로 사건 · 낸 소리 수를 받는다(앱은 이 값을 만들지 않는다).
const snd = (name, opts) => { try { const n = soundFn?.(name, opts); window.__rnSndLog?.(name, n || 0); } catch {} };
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
  warmArt().catch(() => {});
  api('/runner/home').then(res => { if (R && res?.runner) { R.v = res.runner; if (!R.game) lobby(); } }).catch(() => {});
}
const view = () => R.v || { stages: RUNNER.STAGES, up: null, st: 0, stars: '', total: 0, coin_today: 0, coin_daily: RUNNER.COIN_DAILY, box: true, box_coins: RUNNER.BOX_COINS, plays_left: RUNNER.PLAYS_DAILY, cheer: null };
const starAt = (v, s) => Number(String(v.stars || '')[s - 1] || 0);
const starRow = (n, cls = '') => `<span class="rn-stars ${cls}" aria-label="별 ${n}개">${[0, 1, 2].map(i => `<i class="${i < n ? 'on' : ''}"></i>`).join('')}</span>`;

/* ---------- 지도(로비) ---------- */
function lobby() {
  const v = view(), open = Math.min(v.stages, v.st + 1);
  if (!R.sel || R.sel > open) R.sel = open;
  const nodes = [];
  for (let s = 1; s <= v.stages; s++) {
    const n = starAt(v, s), lock = s > open, boss = isBoss(s);
    if (s % 25 === 1) { const th = theme(s); nodes.push(`<h3 class="rn-map-h th-${th}">${THEME_NAME[th]} <small>${s}~${s + 24}</small></h3>`); }
    nodes.push(`<button type="button"${s === R.sel ? ' id="rn-sel"' : ''} class="rn-node${art('map-node') ? ' art' : ''}${lock ? ' lock' : ''}${boss ? ' boss' : ''}${s === R.sel ? ' sel' : ''}${n ? ' done' : ''}" data-rn="pick" data-s="${s}" ${lock ? 'disabled' : ''} aria-label="${s}스테이지${lock ? ' 잠김' : ` 별 ${n}개`}">
      <b>${s}</b>${lock ? '<i class="rn-lock" aria-hidden="true"></i>' : starRow(n)}</button>`);
  }
  const s = R.sel, cheer = v.cheer?.stage === s ? v.cheer.bonus : 0, tg = stageTarget(s);
  root().innerHTML = `<div class="session-app rn-app" id="rn-app"${art('map-node') ? ` style="--rn-node:url(${art('map-node')})"` : ''}><header class="rn-top"><button type="button" class="yb-back" data-rn="exit" aria-label="나가기">${icon('back')}</button><strong>펫 대행진</strong>
      <span class="rn-chip" title="오늘 받은 코인">${coin()}<b>${num(v.coin_today)}/${num(v.coin_daily)}</b></span><button type="button" class="rn-chip rn-board" data-rn="up">강화</button><button type="button" class="rn-chip rn-board" data-rn="board">반 순위</button></header>
    <main class="rn-main">
      <section class="rn-hero th-${theme(s)}"><div class="rn-hero-sky" aria-hidden="true"><i></i><i></i><i></i></div>
        <h1>${THEME_NAME[theme(s)]}</h1><p>숫자 문을 골라 무리를 불리고, 벽을 쏴 뚫고, 달려오는 적 무리를 이겨요! 좋은 문 3번 연속이면 <b>피버</b>!</p>
        <div class="rn-total"><span>${starRow(3, 'big')}<b>${num(v.total)}</b><small>/ ${v.stages * 3}</small></span>${v.box ? `<span class="rn-box">${art('daily-chest') ? `<img src="${art('daily-chest')}" alt="" draggable="false">` : ''}오늘 첫 판 상자 +${v.box_coins}</span>` : ''}</div></section>
      ${metaCards(v)}
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
  try { $('rn-sel')?.scrollIntoView({ block: 'center' }); } catch {}
}
async function onLobbyClick(e) {
  const b = e.target.closest('[data-rn]'); if (!b || !R) return;
  const act = b.dataset.rn;
  if (act === 'exit') { const ex = R.exit; closeGame(); R = null; return ex?.(); }
  if (act === 'pick') { R.sel = Number(b.dataset.s); return lobby(); }
  if (act === 'board') return showBoard();
  if (act === 'up') return showUpgrade();
  if (act === 'go') return startGame(R.sel);
  // V13.243 오늘의 도전 · 주간 반 보스(runner-meta.js): 누를 때만 GET 한 번
  if (act === 'daily') return openDailySheet(() => R && startGame(0, 'daily'));
  if (act === 'raid') return openRaidSheet(out => { if (!R) return; if (out?.coins && R.A?.data?.stats) R.A.data.stats.points_balance = Number(R.A.data.stats.points_balance || 0) + out.coins; api('/runner/home').then(res => { if (R && res?.runner) { R.v = res.runner; if (!R.game) lobby(); } }).catch(() => {}); });
}
async function showBoard() {
  let res; try { res = await api('/runner/board'); } catch (err) { return toast(err.message || '반 순위를 불러오지 못했어요.'); }
  const row = r => `<li class="${r.me ? 'me' : ''}"><b>${r.rank}</b>${avatar(r.pet, { size: 'mini' })}<span>${esc(r.name)}</span><em>${starRow(1)}${num(r.total)}</em><small>${r.st}스테이지</small></li>`;
  openSheet(`<div class="rn-board-sheet"><h2>펫 대행진 반 순위</h2><p>같은 학교 · 같은 학년 친구들의 별 합계예요(1분마다 새로).</p>
    <ol>${(res.top || []).map(row).join('') || '<li class="empty">아직 아무도 안 했어요. 첫 주인공이 되어 봐요!</li>'}</ol>${res.me && !res.top.some(r => r.me) ? `<ol class="mine">${row(res.me)}</ol>` : ''}</div>`, '펫 대행진 반 순위', { className: 'rn-sheet' });
}

// v13.242 정령 강화(구성안 3-3): 기존 코인으로 한 단계씩. 강화 없이도 별 3이 가능하다(스테이지 기준은 강화 없음).
function upgradeBody() {
  const v = view(), up = v.up || {}, bal = Number(R.A.data?.stats?.points_balance ?? 0);
  const rows = Object.entries(UPGRADES).map(([k, u]) => { const o = up[k] || { lv: 0, max: u.max, cost: u.base }; const full = o.cost == null;
    return `<li><div><b>${u.name}</b><small>단계마다 ${u.unit}</small><span class="rn-up-bar" style="--p:${o.lv / u.max}"><i></i></span><em>${o.lv} / ${u.max}</em></div>
      <button type="button" class="rn-up-buy" data-up="${k}" ${full || bal < o.cost ? 'disabled' : ''}>${full ? '완성!' : `${coin()} ${num(o.cost)}`}</button></li>`; }).join('');
  return `<div class="rn-up-sheet"><h2>정령 강화</h2><p>코인으로 정령을 영원히 강하게 해요. 강화 없이도 별 3개는 딸 수 있어요. <span class="rn-up-bal">${coin()} <b>${num(bal)}</b></span></p><ul>${rows}</ul></div>`;
}
function showUpgrade() {
  const sh = openSheet(upgradeBody(), '정령 강화', { className: 'rn-sheet' });
  sh.box.onclick = async e => {
    const b = e.target.closest('[data-up]'); if (!b || b.disabled || !R) return;
    b.disabled = true;
    try { const res = await api('/runner/upgrade', { key: b.dataset.up }); if (res.runner) R.v = res.runner; if (res.points_balance != null && R.A.data?.stats) R.A.data.stats.points_balance = res.points_balance; snd('card', { pick: true }); toast(`${UPGRADES[res.key].name} ${res.lv}단계!`); }
    catch (err) { toast(err.message || '강화하지 못했어요.'); }
    if (R) sh.set(upgradeBody());
  };
}

/* ---------- 한 판 ---------- */
async function startGame(stage, mode = 'stage') {
  if (R.busy) return;
  R.busy = true;
  const id = `rn-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  let res;
  try { res = await api('/runner/start', { id, stage, mode, rules: RUNNER.RULES }); }
  catch (err) { R.busy = false; toast(err.message || '시작하지 못했어요.'); return lobby(); }
  if (res.runner) R.v = res.runner;
  // 판에 쓸 그림(구출 펫 · 그림 74 · 재료)을 디코드까지 기다린다(최대 1.8초): 판 첫 몇 초에 처음 그리기 비용이 몰리지 않게
  await Promise.race([warmArt(res.pet?.key, res.pet?.form, theme(res.stage)).catch(() => {}), new Promise(r => setTimeout(r, 1800))]);
  R.busy = false;
  if (!R) return;
  playGame(res);
}

// 품질 단계(시험 페이지와 같은 값). draw = 그리는 정령 수.
const TIERS = [
  // v13.241 퀄리티 업: shadows = 정령마다 발밑 그림자, trail = 탄 · 대포 정령 빛 꼬리, speed = 가장자리 속도선 수, sky = 떠가는 구름 수,
  //   fire = 성이 약해지면 불 · 연기, rim = 맨 앞줄 테두리 빛, coins = 결과 화면 코인 비 수. 모두 품질 단계와 함께 내려간다.
  // v13.241 그래픽 안정화: 단계를 내릴 때 효과(정령 수 · 파편 · 빛 · 그림자)부터 줄이고 해상도는 마지막에 줄인다(res: 3 = 원래 배율, 0 = 하한).
  //   해상도 하한 = CSS 픽셀 × min(dpr, 2) × 0.5, 폭 540px 이상(s2Of). 낮은 단계도 선명하게.
  { name: '최저', scale: .68, res: 0, draw: 40, debris: 70, smoke: 18, sparks: 70, glows: 60, fly: 30, shots: 20, mult: .35, glow: false, cutLines: 4, posts: 6, shadows: false, trail: false, speed: 0, sky: 0, fire: false, rim: false, coins: 6 },
  { name: '낮음', scale: 1, res: 1, draw: 70, debris: 90, smoke: 26, sparks: 90, glows: 90, fly: 40, shots: 28, mult: .45, glow: false, cutLines: 6, posts: 8, shadows: false, trail: false, speed: 4, sky: 1, fire: true, rim: false, coins: 10 },
  { name: '중간', scale: 1.5, res: 2, draw: 110, debris: 200, smoke: 48, sparks: 180, glows: 160, fly: 70, shots: 44, mult: .7, glow: true, cutLines: 10, posts: 12, shadows: true, trail: true, speed: 6, sky: 3, fire: true, rim: true, coins: 14 },
  { name: '높음', scale: 2, res: 3, draw: 150, debris: 300, smoke: 72, sparks: 260, glows: 240, fly: 100, shots: 60, mult: 1, glow: true, cutLines: 14, posts: 16, shadows: true, trail: true, speed: 8, sky: 4, fire: true, rim: true, coins: 18 }
];
const DRAW_MAX = 150;
const COUNTDOWN = 1.5;   // 판 시작 전 3 · 2 · 1(효과음 START_GO와 같은 길이): 이 동안 장면을 그려 캐시 · 그림을 데우고 규칙은 멈춰 둔다
const TIER_KEY = 'sumus-runner-tier', TIER_DAYS = 7;
function savedTier() { try { const o = JSON.parse(readPref(TIER_KEY, 'null')); return o && Date.now() - o.at < TIER_DAYS * 86400000 ? Math.max(0, Math.min(3, o.t | 0)) : 3; } catch { return 3; } }
const TAU = Math.PI * 2, clamp = (v, a, b) => v < a ? a : v > b ? b : v, lerp = (a, b, t) => a + (b - a) * t, easeOut = t => 1 - (1 - t) * (1 - t) * (1 - t);
const rnd = Math.random, rr = (a, b) => a + rnd() * (b - a);
const mk = (w, h) => { const c = document.createElement('canvas'); c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h)); return c; };
const EL_RGB = { star: '255,226,90', flame: '255,130,50', ice: '140,215,255', toxic: '200,110,255', water: '80,180,255', leaf: '140,230,90', earth: '214,170,110', wind: '170,255,220', spirit: '120,220,255' };
// 테마 색(그림 74가 없을 때 코드 그림 · 안개 · 벽). 판마다 THEME = THEMES[테마].
const THEMES = {
  sky: { skyTop: '#3f7fe0', skyMid: '#8cc3ff', horizon: '#e9f3ff', sea: '#f4f0ff', seaDeep: '#b9b4ef', roadA: [236, 205, 150], roadB: [222, 186, 124], rail: '#f6d36a', railDark: '#b8862d', fog: [226, 238, 255], wall: ['#9fe0ff', '#3b8fe0', '#1f4fa8', '#0d2a66'], chunk: '#6fb8ef' },
  desert: { skyTop: '#e98a3c', skyMid: '#f6c27a', horizon: '#fff0d2', sea: '#f2d39b', seaDeep: '#c99a5b', roadA: [214, 170, 110], roadB: [196, 150, 92], rail: '#e8b250', railDark: '#9a6a28', fog: [250, 230, 196], wall: ['#ffe4b0', '#e0a95e', '#a8682e', '#5e3816'], chunk: '#d9a05a' },
  ice: { skyTop: '#2c5f9e', skyMid: '#8fc4ec', horizon: '#eaf7ff', sea: '#d8eefc', seaDeep: '#8fb8de', roadA: [210, 232, 248], roadB: [186, 214, 238], rail: '#bfe6ff', railDark: '#4f86b8', fog: [228, 244, 255], wall: ['#ffffff', '#c6ecff', '#6fb6e6', '#25608f'], chunk: '#c6ecff' },
  volcano: { skyTop: '#2a1222', skyMid: '#7a2a2a', horizon: '#ff9a50', sea: '#5a2220', seaDeep: '#2a0d10', roadA: [110, 84, 78], roadB: [92, 70, 66], rail: '#ff9a3a', railDark: '#7a2a10', fog: [120, 60, 50], wall: ['#7a5a52', '#4f3a36', '#2b1e1c', '#120a08'], chunk: '#5a403a' }
};
let THEME = THEMES.sky;
const art = k => RUNNER_ART.has(k) ? `/assets/runner/${k}.webp` : null;
const petSrc = (key, form) => `/assets/pets/${key}-${Math.max(1, Math.min(3, form || 3))}.webp`;

// 그림 미리 받기: 한 번 디코드한 그림은 모듈에 남겨 다음 판에 다시 받지 않는다(지도 화면에서 미리, 판 시작 전에 기다림)
const IMGS = new Map(), READY = new Map();
function getImg(src) {
  let p = IMGS.get(src); if (p) return p;
  p = new Promise(res => { const im = new Image(); im.decoding = 'async'; im.onload = () => (im.decode ? im.decode().catch(() => {}) : Promise.resolve()).then(() => { READY.set(src, im); res(im); }); im.onerror = () => res(null); im.src = src; });
  IMGS.set(src, p); return p;
}
// 그림 74: 공통 그림 + 테마 그림(bg · road · post · castle-<테마>). 스테이지 1~25는 하늘 다리(sky).
// v13.242: 그림 74 테마 장애물(sand-whirl · ice-slide · fire-pillar)과 그림 75(적 정령 · 피버 · 충돌 빛)도 있으면 쓴다(RUNNER_ART에 있을 때만, 없으면 코드 그림).
const ART_KEYS = ['spirit-run', 'spirit-fly', 'spirit-hurt', 'spirit-cheer', 'gate-good', 'gate-bad', 'gate-burst', 'gate-frame', 'rock-num', 'saw', 'hammer', 'crystal', 'cannon', 'cannon-fire', 'castle-chunk-a', 'castle-chunk-b', 'cloud-isle',
  'sand-whirl', 'ice-slide', 'fire-pillar', 'enemy-run', 'enemy-hit', 'enemy-down', 'enemy-boss', 'fever-plate', 'light-band', 'fever-aura', 'clash-burst'];
// 그림을 효과 재료 칸으로도 쓰는 것: 문 통과 빛 · 대포 불꽃(검은 배경 → 더하기), 성 조각(파편)
const ART_MAT = { 'gate-burst': 'gate-burst', 'cannon-fire': 'cannon-fire', 'castle-chunk-a': 'chunk-a', 'castle-chunk-b': 'chunk-b', 'clash-burst': 'clash-burst', 'fever-aura': 'fever-aura' };
const themeKeys = th => ['bg', 'road', 'post', 'castle', 'wall', 'wall-chunk'].map(k => `${k}-${th}`);
const MAT_KEYS = ['glow', 'ring', 'burst', 'flame', 'ember', 'star', 'stardust', 'speed', 'rock-a', 'rock-b', 'shard', 'smoke', 'dust'];
const artSrcs = (th = 'sky') => [...ART_KEYS.concat(themeKeys(th)).filter(k => art(k)).map(art), ...MAT_KEYS.filter(k => ARENA_ART.has('mat-' + k)).map(k => `/assets/arena/mat-${k}.webp`)];
function warmArt(petKey = null, form = 3, th = 'sky') { return Promise.all([...artSrcs(th), ...(petKey ? [petSrc(petKey, form)] : [])].map(getImg)); }
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
  // V13.243 모드 자리: 오늘의 도전은 서버가 준 맵 씨앗으로(runner-modes.js modeMap, 서버와 같은 맵)
  const daily = start.mode === 'daily', map = daily ? modeMap({ mode: 'daily', stage: start.stage, seed: start.map_seed, el: start.el }) : makeMap(start.stage), pet = start.pet || {};
  root().innerHTML = `<div class="rn-back" id="rn-back" aria-hidden="true"></div><div class="rn-game" id="rn-game"${art('card-frame') ? ` style="--rn-card:url(${art('card-frame')})"` : ''}><canvas id="rn-cvs"></canvas>
    <div class="rn-veil" id="rn-tint"></div><div class="rn-veil rn-vig" id="rn-vig"></div><div class="rn-veil" id="rn-flash"></div>
    <header class="rn-hud"><button type="button" class="rn-x" data-g="quit" aria-label="그만하기">${icon('close')}</button><div class="rn-hud-mid"><b>${daily ? `오늘의 도전 · ${elKo(start.el)} 속성` : `${start.stage}스테이지${isBoss(start.stage) ? ' · 보스 성' : ''}`}</b><div class="rn-prog"><i id="rn-prog"></i><em class="rn-prog-castle${isBoss(start.stage) ? ' boss' : ''}" aria-hidden="true"></em></div></div><div class="rn-hud-r"><span class="rn-count" id="rn-count" aria-label="정령 수"><i aria-hidden="true"></i><b id="rn-count-n">${num(start.start)}</b></span><span class="rn-streak" id="rn-streak" aria-label="피버까지"><i></i><i></i><i></i></span><small id="rn-hint">끌어서 조종</small></div></header>
    <div class="rn-cards" id="rn-cards" aria-live="polite"></div>
    <div class="rn-result" id="rn-result" hidden></div></div>`;
  const cvs = $('rn-cvs');
  G = {
    alive: true, map, start, cvs, ctx: cvs.getContext('2d', { alpha: false, desynchronized: true }), id: start.id,
    S: runInit(map, { start: start.start, pet: pet.el ? { el: pet.el, mul: pet.mul } : null, up: start.up }), rec: recorder(),
    pet, tx: 0, hold: false, drag: null, last: 0, acc: 0, clock: 0, timers: [], frameLog: [], jsLog: [], lastCheck: 0, frames: 0,
    tier: savedTier(), emerg: 0, sent: false, pz: 0, pcx: 0, paused: false, shotT: 0, lastN: 0, hitstop: 0, castleHitT: 0, cracks: 0, slow: 0, bursts: [], hudN: -1, hudBumpAt: 0, hudAt: 0, hudTextAt: 0, cd: COUNTDOWN, vx: 0, lastCx: 0, petLand: null, fireT: 0, chunkT: 0,
    cheerT: 0, clashFx: 0, feverT: 0, feverOn: false, streakShown: -1, foeWarned: false
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
  // 판 시작 준비를 두 번에 나눈다(한 번에 길게 멈추지 않게): ① 정령 · 하늘 굽기(위) → 한 프레임 그리기 → ② 색 입힌 재료 굽기 · 카운트다운 시작
  const g = G;
  requestAnimationFrame(() => setTimeout(() => {
    if (G !== g) return;
    prebake(g); syncCrowd(g, 0, 0);
    app.insertAdjacentHTML('beforeend', '<div class="rn-cd" aria-hidden="true"><b>3</b><b>2</b><b>1</b><b class="go">출발!</b></div>');
    snd('start');   // 효과음 rn-start: 삑 · 삑 · 삑 → 1.5초에 "출발!"(카운트다운과 같은 때)
    g.raf = requestAnimationFrame(frame);
  }, 0));
}
function onGameClick(b) {
  const g = b.dataset.g;
  if (g === 'quit') { if (G.S.phase === 'done' || confirm('이 판을 그만할까요? 이 판의 기록은 남지 않아요.')) { const r = R; closeGame(); if (r) lobby(); } return; }
  if (g === 'card') return pickCard(Number(b.dataset.i));
  if (g === 'again') { const s = G.start.stage, m = G.start.mode === 'daily' ? 'daily' : 'stage'; closeGame(); return startGame(s, m); }
  if (g === 'next') { const s = Math.min(view().stages, G.start.stage + 1); closeGame(); return startGame(s); }
  if (g === 'map') { closeGame(); return lobby(); }
}

/* ---------- 엔진: 카메라 · 그림 · 풀 (연출 시험 페이지와 같은 방식) ---------- */
function initEngine(g) {
  g.th = g.map.theme; THEME = THEMES[g.th] || THEMES.sky;
  g.cam = { z: -7.6, x: 0, h: 8.6, zoom: 1, back: 7.6, trauma: 0, punch: 0 };
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
  g.objs = []; g.oCastle = { type: 'castle', z: 0 }; g.oCrowd = { type: 'crowd', z: 0 }; g.shootOpt = { crowd: 0 }; g.progPct = -1;
  g.slot = { ox: new Float32Array(DRAW_MAX), oz: new Float32Array(DRAW_MAX), pop: new Float32Array(DRAW_MAX) }; g.shown = 0;
  buildMats(g);
  const want = [['pet', petSrc(g.pet.key, g.pet.form)], ...ART_KEYS.concat(themeKeys(g.th)).filter(k => art(k)).map(k => [k, art(k)]), ...MAT_KEYS.filter(k => ARENA_ART.has('mat-' + k)).map(k => ['mat:' + k, `/assets/arena/mat-${k}.webp`])];
  const use = (k, im) => { if (!im) return; if (k.startsWith('mat:')) { const c = mk(im.width, im.height); c.getContext('2d').drawImage(im, 0, 0); g.mat[k.slice(4)] = c; g.matArt.add(k.slice(4)); g.tintCache.clear(); } else { g.img[k] = im; if (k.startsWith('wall-chunk-')) { const c = mk(im.width, im.height); c.getContext('2d').drawImage(im, 0, 0); g.mat.wchunk = c; } if (ART_MAT[k]) { const c = mk(im.width, im.height); c.getContext('2d').drawImage(im, 0, 0); g.mat[ART_MAT[k]] = c; } } };
  for (const [k, src] of want) { const im = READY.get(src); if (im) use(k, im); else { getImg(src).then(im2 => { if (G !== g || !im2) return; use(k, im2); g.sprS2 = g.logS2 = g.S2; buildSprites(g); buildSky(g); prebake(g); }); } }
  resize(g);   // 준비된 그림을 먼저 넣고 하늘 · 정령을 한 번만 굽는다(예전에는 두 번)
  g.ctx.drawImage(g.sky, 0, 0);   // 굽기를 둘로 나눈 사이의 한 프레임에도 하늘이 보이게
}
// 미리 굽기: 판 중에 쓰는 색 입힌 빛 · 고리 · 연기 그림과 길 색 표를 판 시작 전에 만들어 둔다(카운트다운 동안).
function prebake(g) {
  // v13.243 판 중 첫 글자 그림 굽기 없애기: 판에서 뜨는 알림 글자를 카운트다운 동안 미리 굽는다(처음 뜰 때 끊김 방지)
  if (g.SPR.text) {
    for (const [t, el] of [['벽 격파!', 'star'], ['틈으로 쏙!', 'spirit'], ['적 무리가 달려와요!', 'flame'], ['적 대장이 달려와요!', 'flame'], ['정면 충돌!', 'flame'], ['적 대장과 정면 충돌!', 'flame'], ['승리!', 'star'], ['적 대장 격파!', 'star'],
      ['공성전! 화면을 누르고 있으면 발사', 'star'], ['미끄러워요! 조종이 느려져요', 'ice'], ['↔ 움직이는 문', 'spirit'], ['⇄ 바뀌는 문', 'star']]) textSprite(g, t, 'pill', el);
    textSprite(g, '피버 타임!', 'cut', 'star');
  }
  const T = (k, rgb) => tint(g, k, rgb);
  g.tg = { gateGood: T('glow', '90,170,255'), gateBad: T('glow', '255,80,90'), crystal: T('glow', '140,220,255'), trail: T('glow', '150,225,255'), speedW: T('speed', '255,255,255'),
    speedF: T('speed', '255,214,90'), aura: g.matArt.has('fever-aura') || g.img['fever-aura'] ? g.mat['fever-aura'] : T('glow', '255,200,70'), foeGlow: T('glow', '255,70,70'), lava: T('glow', '255,120,40'), gold: T('glow', '255,220,120'),
    clash: g.img['clash-burst'] ? g.mat['clash-burst'] : T('burst', '255,230,190') };
  for (const rgb of ['255,90,90', '255,200,80', '255,214,140']) T('ring', rgb);
  for (const rgb of ['255,90,90', '255,220,120']) T('glow', rgb);   // 충돌 · 승리 · 적 격파 빛(처음 쓸 때 굽지 않게)
  for (const rgb of ['140,210,255', '255,120,120', '160,230,255', '255,214,140', '255,180,90', ...Object.values(EL_RGB)]) T('glow', rgb);
  for (const rgb of ['255,240,200', '170,230,255', '255,150,150', '255,240,210', '200,240,255', '255,255,255', '255,230,180', ...Object.values(EL_RGB)]) T('ring', rgb);
  for (const rgb of Object.values(EL_RGB)) T('speed', rgb);
  for (const [k, rgb] of PUFF) T(k, rgb);
  for (const [k, rgb] of GLOW) if (rgb !== '255,255,255') T(k, rgb);
  const col = (a, b, f) => `rgb(${lerp(a[0], b[0], f) | 0},${lerp(a[1], b[1], f) | 0},${lerp(a[2], b[2], f) | 0})`, L = 32;
  g.pal = { roadA: [], roadB: [], seam: [], stripe: [] };
  for (let i = 0; i < L; i++) { const f = i / (L - 1); g.pal.roadA.push(col(THEME.roadA, THEME.fog, f)); g.pal.roadB.push(col(THEME.roadB, THEME.fog, f)); g.pal.seam.push(`rgba(120,80,40,${(.25 * (1 - f)).toFixed(3)})`); g.pal.stripe.push(`rgba(255,250,230,${(.55 * (1 - f)).toFixed(3)})`); }
}
const pool = (n, keys) => { const o = { n: 0, keys, cap: n }; for (const k of keys) o[k] = new Float32Array(n); return o; };
function swapOut(A, j) { const l = --A.n; for (const k of A.keys) A[k][j] = A[k][l]; }
// 단계마다 캔버스 배율. 낮음 · 최저(배율 1 이하)는 칸 넓이를 폰(390×844)만큼으로 맞춘다: 아이패드 · PC 큰 칸에서 느린 기기가 폰보다 많이 칠하지 않게.
//   v13.241 그래픽 안정화: 어떤 단계도 하한(CSS × min(dpr, 2) × 0.5, 폭 540 이상) 아래로 내려가지 않는다 — 예전 최저(폭 약 265px)를 4배 넘게 늘려 길 · 숫자가 흐리고 계단처럼 깨졌다.
//   높음 = min(dpr, 2), 중간 = 높음과 하한 사이 2/3, 낮음 = 1/3, 최저 = 하한. 큰 PC · 아이패드 칸도 하한까지만(폰보다 많이 칠하지 않게 낮은 단계는 하한).
const RES_MIN_W = 540;
function floorS2(g) { const d = Math.min(devicePixelRatio || 1, 2); return Math.max(d * .5, RES_MIN_W / Math.max(1, g.cssW)); }
// 비상 단계(g.emerg, 선생님 확인): 최저(하한)에서도 판 중 4초(2초 창 둘) 평균 프레임이 EMERG_MS(25ms)를 넘고 화면 30Hz 묶임도 아니면(캔버스를 CPU로 그리거나 GPU가 약한 기기)
//   한 단계씩 내려간다: 하한(세로 폰 538px) → 1 중간(하한 × 0.75, 약 400px) → 2 예전 최저 크기(배율 0.68, 265px). 단계 사이 6초 쉼, 그 판 동안만이고 기억하지 않는다.
//   20ms 넘는 프레임이 12% 넘어도(60Hz에서 자주 끊김) 내려간다. 카운트다운에서 이미 무거우면(하한 예상 18ms↑) 처음부터 중간으로(중간도 18ms↑면 예전 크기로) 시작한다. 다음 판은 다시 하한부터. RES_EMERGENCY = false면 끈다.
// v13.243: 카운트다운(효과 없는 장면) 예상 기준 18 → 12ms. 판에서는 효과 · 적 무리 · 벽이 더해져 카운트다운보다 무겁다 → 판 중에 다시 내려가며 캔버스를 다시 만들던 끊김을 없앰(빠른 폰은 카운트다운이 5ms 안팎이라 그대로)
const EMERG_CD = 12;
const RES_EMERGENCY = true, EMERG_MS = 25, EMERG_MID = .75, PHONE_AREA = 390 * 844;
const emergS2 = g => .68 * Math.min(1, Math.sqrt(PHONE_AREA / (g.cssW * g.cssH)));
function s2Of(g, t) { if (g.emerg && t === 0) return Math.round(Math.min(floorS2(g) * (g.emerg === 1 ? EMERG_MID : 1), g.emerg === 1 ? 9 : emergS2(g)) * 100) / 100; const top = Math.max(floorS2(g), Math.min(devicePixelRatio || 1, 2)), lo = floorS2(g), r = TIERS[t].res; return Math.round((lo + (top - lo) * r / 3) * 100) / 100; }
function resize(g) {
  const box = g.cvs.parentElement; g.cssW = box?.clientWidth || innerWidth; g.cssH = box?.clientHeight || innerHeight;   // 가운데 세로 칸 크기 기준
  g.S2 = s2Of(g, g.tier);
  g.cvs.width = Math.round(g.cssW * g.S2); g.cvs.height = Math.round(g.cssH * g.S2);
  g.F = Math.min(g.cssW * 1.05, g.cssH * .62) * g.S2; g.CX = g.cvs.width / 2; g.HZ = g.cvs.height * .25;
  buildSky(g);
  // v13.243 판 중 다시 굽기 0: 그림(정령 · 숫자 아틀라스 · 성 · 벽 …)은 판에서 처음 정한 해상도(또는 더 높을 때만 다시)로 한 번 굽고,
  //   해상도가 내려가면 다시 굽지 않는다. 화면 픽셀로 크기를 적어 둔 것(숫자 아틀라스 · 글자 그림 · 컷인 펫 · 피버 판)만 비율로 고친다.
  if (!g.sprS2 || g.S2 > g.sprS2 * 1.01) { g.sprS2 = g.logS2 = g.S2; buildSprites(g); }
  else if (g.logS2 !== g.S2) { rescaleLogical(g, g.S2 / g.logS2); g.logS2 = g.S2; }
}
function rescaleLogical(g, r) {
  const P = g.SPR;
  for (const A of Object.values(P.digits)) { A.cw *= r; A.ch *= r; A.adv *= r; }
  for (const s of P.text.values()) { s.w *= r; s.h *= r; }
  P.petBigW = (P.petBigW || P.petBig?.width || 0) * r; P.feverW = (P.feverW || P.feverPlate?.width || 0) * r;
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
function buildMats(g) { g.matArt = new Set(); for (const [k, [, size, draw, h]] of Object.entries(MATS)) { const c = mk(size, h || size); draw(c.getContext('2d')); g.mat[k] = c; } g.mat['gate-burst'] = g.mat.burst; g.mat['cannon-fire'] = g.mat.burst; g.mat['chunk-a'] = g.mat['rock-a']; g.mat['chunk-b'] = g.mat['rock-b']; g.mat['clash-burst'] = g.mat.burst; g.mat['fever-aura'] = g.mat.glow; g.mat.wchunk = wallChunk(THEME.chunk); }
// 벽 조각(그림 75 wall-chunk-<테마>가 없을 때): 테마 색 모난 돌
function wallChunk(col) { const c = mk(128, 128); rock(c.getContext('2d'), 128, col, .7); return c; }
function tint(g, k, rgb) {
  // 이름 → 색 → 그림 두 단 캐시(프레임마다 키 문자열을 만들지 않는다)
  let m = g.tintCache.get(k); if (!m) g.tintCache.set(k, m = new Map()); let c = m.get(rgb); if (c) return c;
  const src = g.mat[k]; c = mk(src.width, src.height); const x = c.getContext('2d'); x.drawImage(src, 0, 0);
  if (MATS[k][0] === 'luma') { x.globalCompositeOperation = 'source-in'; x.fillStyle = `rgb(${rgb})`; x.fillRect(0, 0, c.width, c.height); }
  else { x.globalCompositeOperation = 'saturation'; x.fillStyle = '#808080'; x.fillRect(0, 0, c.width, c.height); if (rgb !== '255,255,255') { x.globalCompositeOperation = 'multiply'; x.fillStyle = `rgb(${rgb})`; x.fillRect(0, 0, c.width, c.height); } x.globalCompositeOperation = 'destination-in'; x.drawImage(src, 0, 0); }
  m.set(rgb, c); return c;
}
// 양옆 장식: 하늘 그림을 27×40으로 줄여 JPEG 한 장으로(그림마다 한 번). 크게 늘리면 저절로 부드럽게 흐려진다(filter 없음).
const BACK = new Map();
function backdrop(im) {
  let u = BACK.get(im); if (!u) { const c = mk(27, 40); c.getContext('2d').drawImage(im, 0, 0, 27, 40); u = `url(${c.toDataURL('image/jpeg', .8)})`; BACK.set(im, u); }
  $('rn-back')?.style.setProperty('--rn-back', u);
}
function buildSky(g) {
  const W = g.cvs.width, H = g.cvs.height, HZ = g.HZ, c = mk(W, H), x = c.getContext('2d', { alpha: false });   // 불투명 캔버스: 매 프레임 화면 전체를 섞기 없이 복사
  g.fogGrad = g.ctx.createLinearGradient(0, HZ, 0, HZ + H * .2); const fg = THEME.fog.join(','); g.fogGrad.addColorStop(0, `rgba(${fg},.85)`); g.fogGrad.addColorStop(1, `rgba(${fg},0)`);
  g.roadMip = g.img['road-' + g.th] ? (MIPS.get(g.img['road-' + g.th]) || MIPS.set(g.img['road-' + g.th], roadMip(g.img['road-' + g.th])).get(g.img['road-' + g.th])) : null;   // 축소본은 그림마다 한 번(해상도가 바뀌어도 다시 안 만듦)
  if (g.img['bg-' + g.th]) backdrop(g.img['bg-' + g.th]);
  if (g.img['bg-' + g.th]) { const im = g.img['bg-' + g.th], sc = Math.max(W / im.width, H / im.height); x.drawImage(im, (W - im.width * sc) / 2, (H - im.height * sc) / 2, im.width * sc, im.height * sc); g.sky = c; return; }
  let lg = x.createLinearGradient(0, 0, 0, HZ); lg.addColorStop(0, THEME.skyTop); lg.addColorStop(.7, THEME.skyMid); lg.addColorStop(1, THEME.horizon); x.fillStyle = lg; x.fillRect(0, 0, W, HZ + 1);
  radial(x, 0, [[0, 'rgba(255,252,230,1)'], [.15, 'rgba(255,240,190,.7)'], [1, 'rgba(255,240,190,0)']], W * .45, W * .72, HZ * .5);
  lg = x.createLinearGradient(0, HZ, 0, H); lg.addColorStop(0, THEME.horizon); lg.addColorStop(.25, THEME.sea); lg.addColorStop(1, THEME.seaDeep); x.fillStyle = lg; x.fillRect(0, HZ, W, H - HZ);
  for (let i = 0; i < 26; i++) radial(x, 0, [[0, 'rgba(255,255,255,.85)'], [1, 'rgba(255,255,255,0)']], (.04 + (i * 7 % 6) / 100) * W, ((i * 0.618) % 1.2 - .1) * W, HZ - (i * 13 % 10) / 30 * HZ);
  for (let i = 0; i < 46; i++) { const t = (i * 0.382) % 1, y = HZ + t * t * (H - HZ), r = (.03 + t * .16) * W; radial(x, 0, [[0, 'rgba(255,255,255,.7)'], [.6, 'rgba(248,246,255,.35)'], [1, 'rgba(240,238,255,0)']], r, ((i * 0.737) % 1.2 - .1) * W, y); }
  g.sky = c;
}
// 정령 그림 + 남색 테두리(8방향으로 실루엣을 찍고 그 위에 그림): 나무 길 · 구름 위에서도 32px 정령이 또렷하게
function outlined(g, k, px) {
  const im = g.img[k]; if (!im) return null;
  const c = mk(px, px), x = c.getContext('2d'), sil = mk(px, px), sx = sil.getContext('2d'), pad = Math.max(1, px * .045), inner = px - pad * 2;
  sx.drawImage(im, pad, pad, inner, inner); sx.globalCompositeOperation = 'source-in'; sx.fillStyle = '#123a6b'; sx.fillRect(0, 0, px, px);
  for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; x.drawImage(sil, Math.cos(a) * pad, Math.sin(a) * pad); }
  x.drawImage(im, pad, pad, inner, inner); return c;
}
// 검은 배경 빛 그림 → 진한 색 유리: 밝기를 알파로(검정 = 투명), 색은 알파로 나눠 되살리고 조금 진하게. 그림마다 한 번(모듈 캐시).
const GLASS = new Map();
function glassOf(im, w, h) {
  let c = GLASS.get(im); if (c) return c;
  c = mk(w, h); const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(im, 0, 0, w, h);
  const d = x.getImageData(0, 0, w, h), p = d.data;
  for (let i = 0; i < p.length; i += 4) { const m = Math.max(p[i], p[i + 1], p[i + 2]); if (m < 8) { p[i + 3] = 0; continue; } const k = 255 / m * .8; p[i] = Math.min(255, p[i] * k); p[i + 1] = Math.min(255, p[i + 1] * k); p[i + 2] = Math.min(255, p[i + 2] * k); p[i + 3] = Math.min(255, m * 1.12); }
  x.putImageData(d, 0, 0); GLASS.set(im, c); return c;
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
  const S = g.S2, P = g.SPR, sp = Math.round(46 * S);   // v13.241 안정화: 그리는 크기(약 35~45 × 배율)보다 크게 구워 늘려 그리지 않는다(예전 30 × 배율은 흐림)
  P.spirit = outlined(g, 'spirit-run', sp) || spiritSprite(sp); P.spiritW = whiteOf(P.spirit);
  P.spiritFly = outlined(g, 'spirit-fly', sp) || P.spirit; P.spiritCheer = outlined(g, 'spirit-cheer', sp); P.spiritHurt = outlined(g, 'spirit-hurt', sp) || P.spiritW;
  g.spiritU = g.img['spirit-run'] ? .66 : .52;   // 그림 정령은 조금 크게(그림 안 여백 · 32px에서 읽히게)
  // 그림 74 문 판(gate-good · bad)은 검은 배경 빛 그림 → 판 전에 검정을 투명으로 바꾼 진한 색 유리(glassOf)로 보통 섞기. 빛만 더하기. 가운데 기둥은 gate-frame.
  P.gateFrame = g.img['gate-frame'] ? fromImg(g, 'gate-frame', 192, 384) : null; P.gateFrameS = P.gateFrame && shrink(P.gateFrame, 96);
  const sh = mk(64, 32), sx = sh.getContext('2d'), gr = sx.createRadialGradient(32, 16, 0, 32, 16, 32); gr.addColorStop(0, 'rgba(40,40,80,.4)'); gr.addColorStop(1, 'rgba(40,40,80,0)'); sx.setTransform(1, 0, 0, .5, 0, 8); sx.fillStyle = gr; sx.fillRect(0, -16, 64, 64); P.shadow = sh;
  P.pet = g.img.pet ? shrink(g.img.pet, Math.round(150 * S)) : null;   // 그리는 폭(2.5 × 거리 배율 ≈ 135 × 배율)보다 크게
  P.petBig = g.img.pet ? shrink(g.img.pet, Math.round(Math.min(g.cssW * .8, 300) * S)) : null; P.petBigW = P.petBig?.width || 0;
  P.rock = fromImg(g, 'rock-num', 256, 240); if (!P.rock) { P.rock = mk(160 * S, 150 * S); const x = P.rock.getContext('2d'); x.scale(S * 160 / 128, S * 150 / 128); rock(x, 128, '#9b8b78', .92); }
  P.rockW = whiteOf(P.rock);
  for (const [k, c1, c2, edge] of [['gate-good', 'rgba(70,170,255,.62)', 'rgba(40,120,240,.35)', '#bfe6ff'], ['gate-bad', 'rgba(255,90,100,.62)', 'rgba(220,40,70,.35)', '#ffc4c4']]) {
    if (g.img[k]) { P[k] = glassOf(g.img[k], g.img[k].width, g.img[k].height); P[k + 'S'] = shrink(P[k], 192); continue; }   // 원본 해상도(384×272) + 반 축소본: 가까우면 원본, 멀면 축소본
    const c = mk(200, 150), x = c.getContext('2d'), lg = x.createLinearGradient(0, 0, 0, 150); lg.addColorStop(0, c1); lg.addColorStop(1, c2); x.fillStyle = lg; roundRect(x, 4, 4, 192, 142, 14); x.fill(); x.lineWidth = 6; x.strokeStyle = edge; x.stroke(); x.fillStyle = 'rgba(255,255,255,.28)'; roundRect(x, 14, 12, 172, 22, 10); x.fill(); P[k] = c; P[k + 'S'] = c;
  }
  P.saw = fromImg(g, 'saw', 128, 128); if (!P.saw) { P.saw = mk(128, 128); const x = P.saw.getContext('2d'); x.translate(64, 64); x.fillStyle = '#d7dde6'; x.strokeStyle = '#3b4250'; x.lineWidth = 3; x.beginPath(); for (let i = 0; i < 16; i++) { const a = i / 16 * TAU; x.lineTo(Math.cos(a) * 60, Math.sin(a) * 60); x.lineTo(Math.cos(a + .2) * 46, Math.sin(a + .2) * 46); } x.closePath(); x.fill(); x.stroke(); const r2 = x.createRadialGradient(-10, -10, 4, 0, 0, 44); r2.addColorStop(0, '#fff'); r2.addColorStop(1, '#8b96a8'); x.fillStyle = r2; x.beginPath(); x.arc(0, 0, 40, 0, TAU); x.fill(); x.fillStyle = '#e04848'; x.beginPath(); x.arc(0, 0, 12, 0, TAU); x.fill(); x.stroke(); }
  // 망치 그림(손잡이 위 · 머리 아래 한 장)이 오면 통째로 돌린다(hammerArt)
  g.hammerArt = !!g.img.hammer; P.hammer = g.hammerArt ? fromImg(g, 'hammer', 128, 192) : null; if (!P.hammer) { P.hammer = mk(160, 110); const x = P.hammer.getContext('2d'), lg = x.createLinearGradient(0, 0, 0, 110); lg.addColorStop(0, '#ffcf6b'); lg.addColorStop(1, '#a8621a'); x.fillStyle = lg; x.strokeStyle = '#4a2a08'; x.lineWidth = 5; roundRect(x, 6, 8, 148, 94, 18); x.fill(); x.stroke(); x.fillStyle = 'rgba(255,255,255,.35)'; roundRect(x, 18, 16, 124, 18, 9); x.fill(); }
  P.post = fromImg(g, 'post-' + g.th, 96, 256); P.postS = fromImg(g, 'post-' + g.th, 48, 128); if (!P.post) { P.post = mk(40, 120); const x = P.post.getContext('2d'), lg = x.createLinearGradient(0, 0, 40, 0); lg.addColorStop(0, '#fff3c2'); lg.addColorStop(.5, THEME.rail); lg.addColorStop(1, THEME.railDark); x.fillStyle = lg; x.fillRect(10, 20, 20, 100); x.beginPath(); x.arc(20, 18, 15, 0, TAU); x.fill(); P.postS = P.post; }
  P.cloud = fromImg(g, 'cloud-isle', 288, 192); if (!P.cloud) { P.cloud = mk(256, 140); const x = P.cloud.getContext('2d'); for (const [cx, cy, r] of [[70, 80, 50], [120, 62, 62], [180, 82, 48], [140, 96, 52], [92, 100, 44]]) radial(x, 0, [[0, '#fff'], [.75, 'rgba(250,248,255,.95)'], [1, 'rgba(235,232,255,0)']], r, cx, cy); }
  // 수정 감옥(안에 구출할 내 펫)
  { const W = 200 * S, H = 240 * S, c = mk(W, H), x = c.getContext('2d'); x.scale(S, S);
    const shape = [[100, 6], [176, 70], [160, 200], [100, 234], [40, 200], [24, 70]], path = () => { x.beginPath(); shape.forEach(([a, b], i) => i ? x.lineTo(a, b) : x.moveTo(a, b)); x.closePath(); };
    if (g.img.pet) { x.save(); path(); x.clip(); x.drawImage(g.img.pet, 40, 70, 120, 120 * g.img.pet.height / g.img.pet.width); x.restore(); }
    if (g.img.crystal) x.drawImage(g.img.crystal, 0, 0, 200, 240);
    else { path(); const lg = x.createLinearGradient(24, 0, 176, 240); lg.addColorStop(0, 'rgba(230,250,255,.55)'); lg.addColorStop(.5, 'rgba(120,200,255,.25)'); lg.addColorStop(1, 'rgba(60,120,220,.5)'); x.fillStyle = lg; x.fill(); x.lineWidth = 5; x.strokeStyle = '#e8fbff'; x.stroke(); x.lineWidth = 2; x.strokeStyle = 'rgba(40,110,200,.8)'; x.beginPath(); x.moveTo(100, 6); x.lineTo(100, 234); x.moveTo(24, 70); x.lineTo(100, 110); x.lineTo(176, 70); x.moveTo(40, 200); x.lineTo(100, 110); x.lineTo(160, 200); x.stroke(); x.fillStyle = 'rgba(255,255,255,.6)'; x.beginPath(); x.moveTo(44, 74); x.lineTo(96, 18); x.lineTo(80, 96); x.closePath(); x.fill(); }
    P.crystal = c; P.crystalW = whiteOf(c);
    // 수정 금 세 단계(흰 줄 + 파란 그늘, 수정 모양 안에만)
    P.crystalCrack = [1, 2, 3].map(level => { const k = mk(W, H), y = k.getContext('2d'); y.scale(S, S); y.save(); y.beginPath(); shape.forEach(([a, b], i) => i ? y.lineTo(a, b) : y.moveTo(a, b)); y.closePath(); y.clip(); y.lineCap = 'round'; y.lineJoin = 'round';
      for (let i = 0; i < level * 3; i++) { let px = 100 + ((i * 47) % 70) - 35, py = 60 + ((i * 61) % 120); for (const [col, lw] of [['rgba(30,90,170,.55)', 4.5], ['rgba(255,255,255,.95)', 2]]) { let qx = px, qy = py; y.strokeStyle = col; y.lineWidth = lw; y.beginPath(); y.moveTo(qx, qy); for (let k2 = 0; k2 < 4 + level; k2++) { qx += ((i + k2) % 3 - 1) * 14 + (k2 % 2 ? 6 : -6); qy += ((i * k2) % 5) * 5 - 10; y.lineTo(qx, qy); } y.stroke(); } }
      y.restore(); return k; }); }
  // 경고 그림자(톱날 · 망치가 지나갈 자리): 빨간 타원 한 장
  { const c = mk(128, 64), x = c.getContext('2d'), gr = x.createRadialGradient(64, 32, 0, 64, 32, 64); gr.addColorStop(0, 'rgba(255,60,70,.75)'); gr.addColorStop(.6, 'rgba(255,60,70,.35)'); gr.addColorStop(1, 'rgba(255,60,70,0)'); x.setTransform(1, 0, 0, .5, 0, 16); x.fillStyle = gr; x.fillRect(0, -32, 128, 128); P.warn = c; }
  buildFoes(g); buildWall(g); buildThemed(g);
  buildCastle(g); buildCannon(g); buildDigits(g);
  P.text = new Map();
}
// v13.242 적 정령(그림 75 enemy-*가 없으면 빨간 정령 코드 그림) · 적 대장(왕관)
function buildFoes(g) {
  const S = g.S2, P = g.SPR, sp = Math.round(64 * S);   // 적 정령은 1.75배로 그리므로 크게 구움(흐려지지 않게, 안정화와 같은 원칙)
  P.foe = outlined(g, 'enemy-run', sp) || spiritSprite(sp, ['#ffb4a8', '#ff3434', '#8a0c18'], '#ff7a3a'); P.foeW = whiteOf(P.foe);
  P.foeHit = outlined(g, 'enemy-hit', sp) || P.foeW;
  P.foeDown = outlined(g, 'enemy-down', sp) || P.foe;
  const bp = Math.round(64 * S); P.foeBoss = g.img['enemy-boss'] ? shrink(g.img['enemy-boss'], bp) : (() => { const c = spiritSprite(bp, ['#ffd6f0', '#c04ad8', '#5a1478'], '#ff9ad8'), x = c.getContext('2d'); x.fillStyle = '#ffd24a'; x.strokeStyle = '#7a4a00'; x.lineWidth = bp / 40; x.beginPath(); const k = bp / 64; x.moveTo(20 * k, 14 * k); x.lineTo(24 * k, 4 * k); x.lineTo(28 * k, 11 * k); x.lineTo(32 * k, 2 * k); x.lineTo(36 * k, 11 * k); x.lineTo(40 * k, 4 * k); x.lineTo(44 * k, 14 * k); x.closePath(); x.fill(); x.stroke(); return c; })();
}
// 숫자 벽 한 칸(가로 2 : 세로 1). 그림 75 wall-<테마>가 없으면 테마 색 돌판(위 빛 · 벽돌 줄 · 아래 그늘). 금 2단계는 그 위에 겹친다.
function buildWall(g) {
  const S = g.S2, P = g.SPR, W = Math.round(224 * S), H = Math.round(112 * S), art = g.img['wall-' + g.th];
  let c = art ? fromImg(g, 'wall-' + g.th, W, H) : null;
  if (!c) {
    c = mk(W, H); const x = c.getContext('2d'), [hi, mid, lo, line] = THEME.wall, lg = x.createLinearGradient(0, 0, 0, H);
    lg.addColorStop(0, hi); lg.addColorStop(.35, mid); lg.addColorStop(1, lo); x.fillStyle = lg; roundRect(x, 2 * S, 2 * S, W - 4 * S, H - 4 * S, 10 * S); x.fill();
    x.strokeStyle = line; x.lineWidth = 4 * S; x.stroke(); x.globalAlpha = .35; x.lineWidth = 2 * S;
    for (let r = 1; r < 3; r++) { const y = H * r / 3; x.beginPath(); x.moveTo(6 * S, y); x.lineTo(W - 6 * S, y); x.stroke(); for (let q = 0; q < 4; q++) { const bx = W * (q + (r % 2 ? .5 : 0)) / 4; x.beginPath(); x.moveTo(bx, y - H / 3); x.lineTo(bx, y); x.stroke(); } }
    x.globalAlpha = .5; x.fillStyle = '#fff'; x.fillRect(10 * S, 8 * S, W - 20 * S, 5 * S); x.globalAlpha = 1;
    if (g.th === 'volcano') { x.strokeStyle = '#ff8a2a'; x.lineWidth = 3 * S; x.beginPath(); x.moveTo(W * .2, H * .2); x.lineTo(W * .32, H * .55); x.lineTo(W * .26, H * .85); x.moveTo(W * .7, H * .15); x.lineTo(W * .62, H * .5); x.lineTo(W * .74, H * .8); x.stroke(); }
  }
  P.wall = c; P.wallW = whiteOf(c);
  P.wallCrack = [1, 2].map(lv => { const k = mk(W, H), y = k.getContext('2d'); y.lineCap = 'round'; y.lineJoin = 'round';
    for (const [col, lw] of [['rgba(20,10,10,.7)', 5], ['rgba(255,255,255,.55)', 2]]) { y.strokeStyle = col; y.lineWidth = lw * S; for (let i = 0; i < lv * 3; i++) { let px = W * ((i * .37 + .1) % 1), py = (i % 2) * H; y.beginPath(); y.moveTo(px, py); for (let st = 0; st < 4; st++) { px += (((i * 7 + st * 3) % 5) - 2) * 12 * S; py += (i % 2 ? -1 : 1) * H * .22; y.lineTo(px, py); } y.stroke(); } }
    return k; });
}
// 테마 장애물: 모래 소용돌이(바닥 소용돌이) · 얼음 미끄럼(바닥 판) · 불기둥(구멍 + 기둥). 그림 74가 있으면 그 그림.
function buildThemed(g) {
  const S = g.S2, P = g.SPR, R2 = Math.round(160 * S);
  P.whirl = fromImg(g, 'sand-whirl', R2, R2); if (!P.whirl) { P.whirl = mk(R2, R2); const x = P.whirl.getContext('2d'); x.translate(R2 / 2, R2 / 2); radial(x, 0, [[0, 'rgba(120,80,30,.85)'], [.5, 'rgba(200,150,80,.55)'], [1, 'rgba(230,190,120,0)']], R2 / 2); x.strokeStyle = 'rgba(255,235,190,.8)'; x.lineWidth = 4 * S; for (let k = 0; k < 4; k++) { x.beginPath(); for (let a = 0; a < 5; a += .2) { const r = (a / 5) * R2 * .46, t = a + k * Math.PI / 2; a ? x.lineTo(Math.cos(t) * r, Math.sin(t) * r) : x.moveTo(0, 0); } x.stroke(); } }
  P.slide = fromImg(g, 'ice-slide', Math.round(200 * S), Math.round(200 * S)); if (!P.slide) { const w = Math.round(200 * S), c = mk(w, w), x = c.getContext('2d'), lg = x.createLinearGradient(0, 0, w, w); lg.addColorStop(0, 'rgba(240,252,255,.9)'); lg.addColorStop(.5, 'rgba(170,225,255,.85)'); lg.addColorStop(1, 'rgba(110,180,235,.9)'); x.fillStyle = lg; x.fillRect(0, 0, w, w); x.strokeStyle = 'rgba(255,255,255,.8)'; x.lineWidth = 3 * S; for (let i = 0; i < 6; i++) { x.beginPath(); x.moveTo(w * (i / 6), 0); x.lineTo(w * (i / 6) + w * .3, w); x.stroke(); } P.slide = c; }
  P.pillar = fromImg(g, 'fire-pillar', Math.round(96 * S), Math.round(256 * S)); if (!P.pillar) { const w = Math.round(96 * S), h = Math.round(256 * S), c = mk(w, h), x = c.getContext('2d'); for (const [k, col] of [[1, 'rgba(200,40,10,.85)'], [.72, 'rgba(255,130,30,.9)'], [.42, 'rgba(255,230,140,.95)']]) { x.fillStyle = col; x.beginPath(); x.moveTo(w / 2 - w * .45 * k, h); x.bezierCurveTo(w / 2 - w * .5 * k, h * .5, w / 2 - w * .2 * k, h * .2, w / 2, 0); x.bezierCurveTo(w / 2 + w * .2 * k, h * .2, w / 2 + w * .5 * k, h * .5, w / 2 + w * .45 * k, h); x.fill(); } P.pillar = c; }
  { const w = Math.round(128 * S), c = mk(w, w / 2), x = c.getContext('2d'); x.translate(w / 2, w / 4); x.scale(1, .45); radial(x, 0, [[0, 'rgba(255,200,90,1)'], [.35, 'rgba(255,90,20,.9)'], [.7, 'rgba(60,20,10,.85)'], [1, 'rgba(30,10,8,0)']], w / 2); P.vent = c; }
  P.feverPlate = g.img['fever-plate'] ? fromImg(g, 'fever-plate', Math.round(320 * S), Math.round(160 * S)) : null; P.feverW = P.feverPlate?.width || 0;
}
function buildCastle(g) {
  const S = g.S2, W = 300 * S, H = 300 * S, c = mk(W, H), x = c.getContext('2d');
  if (g.img['castle-' + g.th]) x.drawImage(g.img['castle-' + g.th], 0, 0, W, H);
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
  const x = g.SPR.castle.getContext('2d'); x.save(); x.scale(g.sprS2 || g.S2, g.sprS2 || g.S2); x.globalCompositeOperation = 'source-atop'; x.strokeStyle = 'rgba(40,28,18,.85)'; x.lineCap = 'round';
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
// 숫자 아틀라스(v13.241 안정화): 기본 크기 × 배율 × AT로 크게 구워 두고(문 · 바위는 2배, 튀어나오는 숫자 good · bad는 3배), 그릴 때 1/AT로 줄인다.
//   튀어나오는 큰 숫자는 아틀라스보다 1.1배 넘게 늘리지 않는다(drawBursts의 상한) → 뿌옇게 번지지 않음.
const NUM_AT = { foe: 2, wall: 2, count: 2, rock: 2, good: 3, bad: 3, pop: 2, minus: 2 };
const NUM_STYLES = { foe: [30, '#ffffff', '#ffd2d2', '#5a0a10', 6], wall: [40, '#ffffff', '#fff1d0', '#2a1a10', 8], count: [30, '#ffffff', '#d8f3ff', '#123a6b', 6], rock: [30, '#ffffff', '#fff1d0', '#3a2614', 6], good: [48, '#ffffff', '#d6f1ff', '#062a63', 11], bad: [48, '#ffffff', '#ffe0e0', '#55060f', 11], pop: [34, '#fff7b0', '#ffc53a', '#5a2c00', 7], minus: [30, '#ffe0e0', '#ff6a6a', '#4a0a10', 6] };
const GLYPHS = '0123456789+×−';
function buildDigits(g) {
  const S = g.S2; g.SPR.digits = {};
  for (const [k, [size, f0, f1, stroke, lw]] of Object.entries(NUM_STYLES)) {
    const fs = size * S * NUM_AT[k], cw = Math.ceil(fs * .78), ch = Math.ceil(fs * 1.3), c = mk(cw * GLYPHS.length, ch), x = c.getContext('2d');
    x.font = `${fs}px Jua, system-ui, sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.lineJoin = 'round';
    const gr = x.createLinearGradient(0, ch * .2, 0, ch * .8); gr.addColorStop(0, f0); gr.addColorStop(1, f1);
    const L = S * NUM_AT[k]; for (let d = 0; d < GLYPHS.length; d++) { x.lineWidth = lw * L; x.strokeStyle = 'rgba(0,0,0,.28)'; x.strokeText(GLYPHS[d], d * cw + cw / 2, ch / 2 + 3 * L); x.strokeStyle = stroke;   // 약한 그림자(아래로 비킨 진한 테두리) → 테두리 → 글자
       x.strokeText(GLYPHS[d], d * cw + cw / 2, ch / 2); x.fillStyle = gr; x.fillText(GLYPHS[d], d * cw + cw / 2, ch / 2); }
    const kk = 1 / NUM_AT[k]; g.SPR.digits[k] = { c, cw: cw * kk, ch: ch * kk, adv: cw * .74 * kk, k: NUM_AT[k], scw: cw, sch: ch };
  }
}
// 숫자 크기는 화면 배율과 상관없이 같게(PS ÷ 배율, v13.241 안정화 — 예전에는 배율이 낮을수록 숫자가 작아졌다)
// 숫자 → 글자 캐시(바위 · 성 · 배지 숫자를 프레임마다 String()으로 새로 만들지 않는다)
const NSTR = []; const ns = n => n >= 0 && n < 20000 ? (NSTR[n] ??= String(n)) : String(n);
function drawNum(g, style, str, x, y, sc = 1, a = 1) {
  const A = g.SPR.digits[style], w = A.adv * str.length * sc, c = g.ctx; c.globalAlpha = a;
  for (let d = 0; d < str.length; d++) { const v = GLYPHS.indexOf(str[d]); if (v < 0) continue; c.drawImage(A.c, v * A.scw, 0, A.scw, A.sch, x - w / 2 + d * A.adv * sc - (A.cw - A.adv) * sc / 2, y - A.ch * sc / 2, A.cw * sc, A.ch * sc); }
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
// 통통 리듬: 정령마다 빠르기 · 높이가 조금씩 다르다(같은 박자로 튀면 기계 같아 보임)
const HF = new Float32Array(DRAW_MAX), HA = new Float32Array(DRAW_MAX);
for (let i = 0; i < DRAW_MAX; i++) { HF[i] = 9.5 + (i * 37 % 7) * .45; HA[i] = .2 + (i * 13 % 5) * .035; }
function syncCrowd(g, fromX, fromZ) {
  const want = Math.min(g.S.n, g.T.draw), sl = g.slot;
  g.capK = 1 - .35 * want / DRAW_MAX;   // 그리는 정령이 많을수록 파편 · 빛 · 불꽃 상한을 줄인다(최대 35%)
  if (want > g.shown) for (let i = g.shown; i < want; i++) { sl.ox[i] = fromX; sl.oz[i] = fromZ; sl.pop[i] = 0; }
  else for (let i = want; i < g.shown; i++) flyer(g, g.S.cx + sl.ox[i], .4, g.S.z + sl.oz[i], 0);
  g.shown = want;
}

/* ---------- 풀에 넣기 ---------- */
function addDebris(g, x, y, z, n, kind = 0, power = 1) { const D = g.pools.D; n = Math.round(n * g.T.mult); for (let i = 0; i < n; i++) { if (D.n >= g.T.debris * g.capK) return; const j = D.n++, a = rnd() * TAU, sp = rr(.2, 1) * 7 * power; D.x[j] = x + rr(-.3, .3); D.y[j] = y + rr(0, .4); D.z[j] = z + rr(-.3, .3); D.vx[j] = Math.cos(a) * sp; D.vz[j] = Math.sin(a) * sp * .8 - rr(0, 4) * power; D.vy[j] = rr(4, 11) * power; D.rot[j] = rnd() * TAU; D.vr[j] = rr(-12, 12); D.max[j] = D.life[j] = rr(1, 1.8); D.size[j] = rr(.18, .5) * (kind === 2 ? 2.6 : kind === 3 ? 2.2 : 1); D.kind[j] = kind; } }
function addSmoke(g, x, y, z, n, kind = 0, r = .8, spread = 1) { const M = g.pools.M; n = Math.max(1, Math.round(n * g.T.mult)); for (let i = 0; i < n; i++) { if (M.n >= g.T.smoke * g.capK) return; const j = M.n++, a = rnd() * TAU, d = rr(0, spread); M.x[j] = x + Math.cos(a) * d; M.y[j] = y + rr(0, .5); M.z[j] = z + Math.sin(a) * d; M.r[j] = r * rr(.6, 1.2); M.vr[j] = r * rr(.8, 1.6); M.vx[j] = Math.cos(a) * rr(.5, 2); M.vy[j] = rr(.3, 1.4); M.vz[j] = Math.sin(a) * rr(.5, 2); M.max[j] = M.life[j] = rr(.9, 1.8); M.a[j] = rr(.5, .85); M.kind[j] = kind; } }
function addSparks(g, x, y, z, n, col = 0, speed = 12, len = .5) { const K = g.pools.K; n = Math.round(n * g.T.mult); for (let i = 0; i < n; i++) { if (K.n >= g.T.sparks * g.capK) return; const j = K.n++, a = rnd() * TAU, b = rr(-.3, 1.2), sp = speed * rr(.35, 1); K.x[j] = x; K.y[j] = y; K.z[j] = z; K.vx[j] = Math.cos(a) * Math.cos(b) * sp; K.vz[j] = Math.sin(a) * Math.cos(b) * sp; K.vy[j] = Math.sin(b) * sp; K.max[j] = K.life[j] = rr(.2, .45); K.len[j] = len * rr(.6, 1.3); K.col[j] = col; } }
function addGlow(g, x, y, z, n, kind, speed = 3, size = .6, life = .6, up = 0) { const Q = g.pools.Gl; n = Math.max(1, Math.round(n * g.T.mult)); for (let i = 0; i < n; i++) { if (Q.n >= g.T.glows * g.capK) return; const j = Q.n++, a = rnd() * TAU, sp = speed * rr(.3, 1); Q.x[j] = x + rr(-.2, .2); Q.y[j] = y + rr(-.2, .2); Q.z[j] = z; Q.vx[j] = Math.cos(a) * sp; Q.vz[j] = Math.sin(a) * sp; Q.vy[j] = rr(-.5, 1) * sp * .5; Q.max[j] = Q.life[j] = life * rr(.6, 1.2); Q.size[j] = size * rr(.6, 1.3); Q.kind[j] = kind; Q.up[j] = up; } }
function flyer(g, x, y, z, kind, tx = 0, ty = 0, tz = 0, dur = .9) { const F = g.pools.F; if (F.n >= g.T.fly) return; const j = F.n++; F.x[j] = x; F.y[j] = y; F.z[j] = z; F.kind[j] = kind; F.rot[j] = 0; F.vr[j] = rr(-10, 10); if (kind === 1 || kind === 2) { F.vx[j] = (tx - x) / dur; F.vz[j] = (tz - z) / dur; F.vy[j] = (ty - y) / dur + 15.7 * dur / 2; F.max[j] = F.life[j] = dur; } else { const a = rr(-.9, .9) + ((x > g.S.cx) !== (kind === 3) ? 0 : Math.PI); F.vx[j] = Math.cos(a) * rr(3, 7); F.vz[j] = rr(-3, 3); F.vy[j] = rr(5, 9); F.max[j] = F.life[j] = rr(.7, 1); } }
function shoot(g, x, z, tx, ty, tz) { const B = g.pools.B; if (B.n >= g.T.shots) return; const j = B.n++, d = Math.hypot(tx - x, tz - z) || 1, sp = 42; B.x[j] = x; B.y[j] = .7; B.z[j] = z; B.vx[j] = (tx - x) / d * sp; B.vz[j] = (tz - z) / d * sp; B.vy[j] = (ty - .7) / d * sp; B.life[j] = d / sp; }
function ring(g, x, y, z, r1, dur, rgb, delay = 0) { if (g.rings.length < 14) g.rings.push({ x, y, z, r1, dur, rgb, t: -delay, img: tint(g, 'ring', rgb), css: `rgb(${rgb})` }); }
// 목록에서 하나 빼기: 마지막 것을 그 자리로(순서가 상관없는 목록, splice가 만드는 배열 없음)
function cut(list, i) { list[i] = list[list.length - 1]; list.length--; }
function flash(g, x, y, z, r, dur, rgb = '255,255,255', k = 'glow') { if (g.flashes.length < 20) g.flashes.push({ x, y, z, r, dur, k, t: 0, img: rgb === '255,255,255' && k !== 'glow' ? g.mat[k] : tint(g, k, rgb) }); }
function popNum(g, style, str, x, y, z) { if (g.pops.length >= 10) g.pops.shift(); g.pops.push({ style, str, x, y, z, t: 0 }); }
function shake(g, v) { g.cam.trauma = Math.min(1, g.cam.trauma + v); }
function later(g, s, fn) { g.timers.push({ at: g.clock + s, fn }); }
function screenTint(el, a = .16) { const t = $('rn-tint'); if (!t) return; t.style.background = `rgb(${EL_RGB[el] || '255,255,255'})`; t.style.transition = 'none'; t.style.opacity = a; requestAnimationFrame(() => { t.style.transition = 'opacity .5s ease-out'; t.style.opacity = 0; }); }
function invertFlash() { const c = $('rn-cvs'); if (!c) return; c.classList.add('inv'); setTimeout(() => c.classList.remove('inv'), 70); setTimeout(() => { c.classList.add('inv'); setTimeout(() => c.classList.remove('inv'), 45); }, 130); }
function whiteFlash(a) { const f = $('rn-flash'); if (!f) return; f.style.transition = 'none'; f.style.opacity = Math.min(.85, a); requestAnimationFrame(() => { f.style.transition = 'opacity .3s ease-out'; f.style.opacity = 0; }); }

/* ---------- 규칙 사건 → 연출 · 소리 ---------- */
function onEvent(type, a, b, c, d) {
  const g = G; if (!g) return; const S = g.S, sl = g.slot;
  if (type === 'shoot') { const v = vw(g, a); v.hitT = .08; if ((g.shotT -= 1) > 0) return; g.shotT = g.feverOn && g.tier ? 1 : 2; const n = Math.min(g.feverOn && g.tier ? 5 : 3, 1 + (S.n / 80 | 0)), az = a.type === 'foe' ? a.pz : a.z; for (let i = 0; i < n; i++) { const k = (rnd() * Math.max(1, g.shown)) | 0, tx = a.type === 'wall' ? S.cx + rr(-1.5, 1.5) : a.x + rr(-.4, .4); shoot(g, S.cx + sl.ox[k], S.z + sl.oz[k] + .4, tx, a.type === 'wall' ? rr(.6, 1.8) : .9, az - .6); } if (a.type === 'wall' && (g.wallSnd = (g.wallSnd || 0) + 1) % 4 === 0) snd('wall-hit'); g.shootOpt.crowd = S.n; snd('shoot', g.shootOpt); return; }
  if (type === 'break') { snd('rock-break'); shake(g, .26); g.hitstop = Math.max(g.hitstop, .03); addDebris(g, a.x, .5, a.z, 22, 0, 1.1); addSmoke(g, a.x, .2, a.z, 5, 0, .9, .8); addSparks(g, a.x, .8, a.z, 14, 1, 13); addGlow(g, a.x, .8, a.z, 6, 0, 4, .5, .5, 2); flash(g, a.x, .8, a.z, 2.2, .3); flash(g, a.x, .8, a.z, 1.6, .25, '255,255,255', 'burst'); ring(g, a.x, .2, a.z, 2.6, .4, '255,240,200'); return; }
  if (type === 'crash') { snd('rock-hit'); if (!b) return; shake(g, .45); whiteFlash(.25); addDebris(g, a.x, .5, a.z, 26, a.type === 'crystal' ? 1 : 0, 1.2); addSmoke(g, a.x, .2, a.z, 8, 2, 1, 1); lose(g, b, S.cx); return; }
  if (type === 'saw' || type === 'hammer') { snd(type); if (!b) return; shake(g, type === 'saw' ? .15 : .4); addSparks(g, a.x, .6, a.z, type === 'saw' ? 12 : 8, 1, 14); if (type === 'hammer') { addSmoke(g, a.x, 0, a.z, 6, 0, 1, 1.2); ring(g, a.x, .1, a.z, 2.4, .35, '255,240,210'); } lose(g, b, a.x); return; }
  if (type === 'gate') {
    const ok = goodGate(c), gx = b * RUNNER.ROAD / 2, v = vw(g, a); v.passT = 0;
    const mul = c[0] === '×';
    snd(ok ? (mul ? 'multiply' : 'gate-good') : 'gate-bad'); if (ok) screenTint('spirit', mul ? .2 : .12); else { shake(g, .3); screenTint('star', 0); whiteFlash(.12); }
    flash(g, gx, 1.2, a.z, mul ? 5 : 3.4, .4, ok ? '140,210,255' : '255,120,120'); ring(g, gx, .3, a.z, mul ? 4.6 : 3.2, .45, ok ? '170,230,255' : '255,150,150'); addGlow(g, gx, 1.2, a.z, mul ? 22 : 14, ok ? 4 : 0, 4, .6, .7, 1.5);
    burst(g, c[0] + c[1], ok ? 'good' : 'bad', mul);
    if (ok) flash(g, gx, 1.4, a.z, mul ? 3.6 : 2.6, .35, '255,255,255', 'gate-burst');   // 그림 74 gate-burst(더하기)   // 통과한 숫자가 화면 쪽으로 튀어나온다
    if (ok) { addGlow(g, gx, 1.6, a.z, mul ? 16 : 10, 3, 6, .7, .7, 2); addGlow(g, gx, 1.4, a.z, mul ? 14 : 8, 2, 5, .6, .8, 1); if (mul) { g.hitstop = .06; g.cam.punch += .05; shake(g, .3); flash(g, gx, 1.4, a.z, 2.6, .3, '255,255,255', 'burst'); } }
    if (S.n > d) {
      popNum(g, 'pop', '+' + (S.n - d), S.cx, 2.6, S.z + 1.5); syncCrowd(g, gx - S.cx, 1); addGlow(g, S.cx, 1, S.z, 10, 2, 3, .5, .6, 1);
      // 정령이 문에서 쏟아져 무리로 합류(포물선, 연출만)
      const k = Math.min(mul ? 16 : 10, S.n - d), dur = .4;
      for (let i = 0; i < k; i++) flyer(g, gx + rr(-1.2, 1.2), rr(.5, 2.2), a.z, 2, S.cx + rr(-1, 1), .3, S.z + RUNNER.SPEED * dur + rr(-1, 1), dur + rr(-.08, .08));
    }
    else if (S.n < d) lose(g, d - S.n, S.cx);
    streak(g);
    return;
  }
  // v13.242 숫자 벽: 깨지면 큰 조각 · 흔들림 · 멈칫, 부딪히면 남은 숫자만큼 잃고 뚫음, 틈은 끼어 지나감
  if (type === 'wallBreak') { snd('wall-break'); shake(g, .7); g.hitstop = Math.max(g.hitstop, .07); g.cam.punch += .05; whiteFlash(.28); wallBurst(g, a, 1.2); pill(g, '벽 격파!', 'star', .9); return; }
  if (type === 'wallCrash') { snd('wall-break'); shake(g, .85); g.hitstop = Math.max(g.hitstop, .09); whiteFlash(.35); screenTint('flame', .14); wallBurst(g, a, 1.5); if (b) lose(g, b, S.cx); return; }
  if (type === 'gap') { snd('saw'); const gx = a.gap.x; addSparks(g, gx - a.gap.w / 2, 1, a.z, 8, 1, 10); addSparks(g, gx + a.gap.w / 2, 1, a.z, 8, 1, 10); addGlow(g, gx, 1, a.z, 10, 4, 3, .5, .5, 1); if (b) lose(g, b, gx); else pill(g, '틈으로 쏙!', 'spirit', 1); return; }
  // v13.242 적 무리: 다가오면 붉은 경고, 정면 충돌은 느린 동작 + 충돌 빛 + 양쪽이 우르르 깎임, 이기면 함성
  if (type === 'foeWake') { if (!g.foeWarned) { g.foeWarned = true; pill(g, a.boss ? '적 대장이 달려와요!' : '적 무리가 달려와요!', 'flame', 1.4); } screenTint('flame', .1); return; }
  if (type === 'clash') {
    // 충돌 빛은 짧고 작게(0.18초 · 반지름 1.8): 부딪치는 두 무리가 가려지지 않게. 대신 불꽃 · 붉은 고리 · 흔들림으로 세게.
    const cz = (S.z + a.pz) / 2, cxm = (S.cx + a.x) / 2; snd('clash'); g.slow = .5; g.hitstop = .06; g.cam.punch += .06; shake(g, .7); g.clashFx = 1;
    flash(g, cxm, 1.2, cz + 1.2, 1.8, .18, '255,255,255', 'clash-burst'); ring(g, cxm, .15, cz + .6, 4, .4, '255,90,90'); ring(g, cxm, .15, cz + .6, 6, .55, '255,200,80', .06);
    addSparks(g, cxm, 1, cz, 30, 2, 16, .7); addSmoke(g, cxm, .2, cz, 8, 0, 1.2, 2); pill(g, a.boss ? '적 대장과 정면 충돌!' : '정면 충돌!', 'flame', 1.1); return;
  }
  if (type === 'fight') {
    const cz = (S.z + a.pz) / 2, cxm = (S.cx + a.x) / 2; if ((g.fightT = (g.fightT || 0) + 1) % 2) snd('rock-hit'); shake(g, .12);
    if (g.tier || g.fightT % 2) addSparks(g, cxm + rr(-1.5, 1.5), rr(.4, 1.4), cz, 5, rnd() < .5 ? 1 : 2, 12, .5); addGlow(g, cxm, 1, cz, 2, 0, 3, .5, .4, 1);
    for (let i = 0; i < Math.min(3, b); i++) flyer(g, a.x + rr(-1, 1), .4, a.pz + rr(-.5, .5), 3);
    if (c) { for (let i = 0; i < Math.min(3, c); i++) { const k = (rnd() * Math.max(1, g.shown)) | 0; flyer(g, S.cx + sl.ox[k], .4, S.z + sl.oz[k], 0); } syncCrowd(g, 0, 0); }
    if (g.fightT % 5 === 1) { popNum(g, 'minus', '−' + c, S.cx - 1.4, 3, S.z + .5); popNum(g, 'foe', '−' + b, a.x + 1.4, 3.6, a.pz + 1.4); }   // 숫자는 드물게 · 높게(두 무리가 가려지지 않게)
    return;
  }
  if (type === 'clashWin') { snd('clash-win'); g.cheerT = 1.1; g.slow = Math.max(g.slow, .25); shake(g, .3); ring(g, S.cx, .2, S.z, 5, .6, '255,214,140'); addGlow(g, S.cx, 1.4, S.z, 18, 3, 5, .7, .8, 2.5); flash(g, S.cx, 1.6, S.z + 1, 4, .4, '255,220,120'); pill(g, a.boss ? '적 대장 격파!' : '승리!', 'star', 1.1); return; }
  if (type === 'foeDown') { snd('rock-break'); shake(g, .3); flash(g, a.x, 1, a.pz, 3, .3, '255,90,90'); addGlow(g, a.x, 1, a.pz, 10, 0, 4, .5, .5, 2); for (let i = 0; i < 6; i++) flyer(g, a.x + rr(-1, 1), .5, a.pz, 3); popNum(g, 'pop', '격파', a.x, 2.4, a.pz); return; }
  // v13.242 피버: 가장 좋은 문 3번 연속 → 7초(빨라짐 · 사격 2배 · 무리 금빛)
  if (type === 'fever') { snd('fever'); g.feverT = 0; g.feverOn = true; $('rn-game')?.classList.add('fever'); shake(g, .35); whiteFlash(.3); screenTint('star', .25); g.cam.punch += .06; addGlow(g, S.cx, 1.4, S.z, 24, 3, 6, .8, .9, 2.5); ring(g, S.cx, .2, S.z, 6, .6, '255,214,140'); g.feverBig = { t: 0, spr: textSprite(g, '피버 타임!', 'cut', 'star') }; return; }
  if (type === 'feverEnd') { g.feverOn = false; $('rn-game')?.classList.remove('fever'); streak(g); return; }
  // v13.242 테마 장애물
  if (type === 'whirl') { snd('whirl'); addSmoke(g, a.x, .2, a.z, 3, 2, .9, 1); if (b) lose(g, b, a.x); return; }
  if (type === 'slide') { pill(g, '미끄러워요! 조종이 느려져요', 'ice', 1.2); screenTint('ice', .12); return; }
  if (type === 'erupt') { if (a.z - S.z < 45 && a.z > S.z - 4) { snd('pillar'); shake(g, .12); addGlow(g, a.x, .5, a.z, 8, 0, 4, .6, .7, 4); addSmoke(g, a.x, 2, a.z, 2, 3, 1.2, .5); } return; }
  if (type === 'pillar') { shake(g, .4); screenTint('flame', .15); if (b) lose(g, b, a.x); return; }
  if (type === 'card') { snd('card'); showCards(a); return; }
  if (type === 'pick') { if (S.n !== g.lastN) { popNum(g, 'pop', '+' + Math.max(0, S.n - g.lastN), S.cx, 2.6, S.z + 1.5); syncCrowd(g, 0, 2); } return; }
  if (type === 'rescue') {
    snd('rescue'); shake(g, .6); whiteFlash(.5); addDebris(g, a.x, 1.2, a.z, 40, 1, 1.4); addGlow(g, a.x, 1.4, a.z, 16, 3, 5, .9, .7, 2); flash(g, a.x, 1.4, a.z, 4, .5, '160,230,255'); ring(g, a.x, .3, a.z, 4, .5, '200,240,255');
    const sk = PET_SKILL[g.pet.el] || PET_SKILL.star;
    const cel = g.pet.el || 'star', cname = `${CHARACTERS[g.pet.key]?.ko || '펫'} 구출!`;
    g.cutin = { t: 0, dur: 1.05, el: cel, s1: textSprite(g, cname, 'cut', 'spirit'), s2: textSprite(g, sk.name + '!', 'cut', cel), sp: tint(g, 'speed', EL_RGB[cel] || EL_RGB.star) }; $('rn-vig')?.classList.add('ult'); later(g, 1.1, () => $('rn-vig')?.classList.remove('ult'));
    return;
  }
  if (type === 'skill') {
    g.petLand = { t: -.05, hit: false };   // 펫이 무리 앞에 내려앉고(0.35초) 필살기
    const el = a; screenTint(el, .2); shake(g, .5); const z0 = S.z + 4, rgb = EL_RGB[el] || EL_RGB.star;
    g.fx.push({ t: 0, dur: 1, draw(dt) { const wz = z0 + this.t * 40; for (let i = 0; i < 3; i++) addGlow(g, rr(-RUNNER.ROAD, RUNNER.ROAD), rr(.2, 1.4), wz, 1, el === 'flame' ? 1 : 4, 1.5, rr(1, 1.8), .45, 3); if (rnd() < .4) addSmoke(g, rr(-RUNNER.ROAD, RUNNER.ROAD), .3, wz - 1, 1, 3, 1, .5); void dt; } });
    flash(g, S.cx, 1.5, S.z + 3, 5, .6, rgb); pill(g, (PET_SKILL[el] || PET_SKILL.star).name + '!', el);
    if (S.n !== g.lastN) { popNum(g, 'pop', '+' + (S.n - g.lastN), S.cx, 2.6, S.z + 1.5); syncCrowd(g, 0, 2); }
    return;
  }
  if (type === 'siege') { if (g.feverOn) { g.feverOn = false; g.feverBig = null; $('rn-game')?.classList.remove('fever'); streak(g); }   // 규칙이 공성전에서 피버를 끈다(feverEnd 사건 없음) → 연출도 같이 끔
    snd('card'); pill(g, '공성전! 화면을 누르고 있으면 발사', 'star', 2.4); $('rn-hint').textContent = '누르고 있으면 발사'; syncCrowd(g, 0, 0); return; }
  if (type === 'petSiege') { snd('castle-hit'); screenTint(g.pet.el, .22); shake(g, .6); whiteFlash(.35); const cz = S.castle.z; flash(g, 0, 4, cz - 1, 7, .5, EL_RGB[g.pet.el] || '255,180,90'); addDebris(g, 0, 4, cz - 1, 20, 0, 1); popNum(g, 'minus', '−' + a, 0, 9, cz); castleHit(g); return; }
  if (type === 'pour') { snd('cannon'); if ((g.fireFx = (g.fireFx || 0) + 1) % 3 === 1) flash(g, S.cx, 2.6, S.z + crowdR(S.n) + 1.6, 1.4, .16, '255,255,255', 'cannon-fire'); const vis = Math.min(3, a); for (let i = 0; i < vis; i++) flyer(g, S.cx + rr(-.3, .3), 2, S.z + crowdR(S.n) + 1.2, 1, rr(-2.5, 2.5), rr(1.5, 5), S.castle.z - 1, rr(.55, .75)); g.cam.punch += .006; syncCrowd(g, 0, 0); return; }
  if (type === 'fall') { g.slow = .75; if (g.tier) invertFlash(); castleDown(g); return; }   // 마지막 일격: 느린 동작 + 반전 섬광(최저 단계는 캔버스 전체 반전을 빼서 한 프레임이 길어지지 않게) + 붕괴
  // v13.243 결과 화면 한 프레임 줄이기: 판이 끝나면(결과 요청 전 기다리는 동안) 결과 얼굴 그림을 미리 디코드해 둔다
  if (type === 'done') { const f = art(a ? 'spirit-cheer' : 'spirit-hurt'); if (f) getImg(f).catch(() => {}); later(g, S.castle.down ? 1.4 : .6, () => sendFinish(g)); if (!a) snd('fail'); return; }
}
function warn(g, x, z, r, a) { if (!proj(g, x, 0, z)) return; const w = r * 2 * PS; g.ctx.globalAlpha = clamp(a, 0, 1) * .8; g.ctx.drawImage(g.SPR.warn, PX - w / 2, PY - w * .25, w, w * .5); g.ctx.globalAlpha = 1; }
function petImpact(g, x, z) {
  const el = g.pet.el || 'star', rgb = EL_RGB[el] || EL_RGB.star;
  shake(g, .5); g.cam.punch += .05; g.hitstop = .05; snd('hammer');
  ring(g, x, .1, z, 3.6, .45, '255,255,255'); ring(g, x, .1, z, 5, .6, rgb, .06); flash(g, x, .8, z, 3, .35, rgb); flash(g, x, .5, z, 2, .25, '255,255,255', 'burst');
  addSmoke(g, x, 0, z, 8, 0, 1, 1.4); addDebris(g, x, .2, z, 10, 0, .7); addGlow(g, x, .6, z, 12, el === 'flame' ? 0 : 4, 4, .5, .6, 1.5);
}
// 피버까지 남은 칸(위쪽 막대 점 3개): 문을 지날 때만 바뀐다(DOM은 그때만 씀)
function streak(g) { const n = g.S.fever > 0 ? 3 : g.S.streak; if (n === g.streakShown) return; g.streakShown = n; const el = $('rn-streak'); if (!el) return; el.dataset.n = n; el.classList.toggle('hot', g.S.fever > 0); }
// 벽 깨짐 · 부딪힘: 길 너비만큼 큰 조각 · 먼지 · 불꽃(조각은 그림 75 wall-chunk-<테마> 또는 테마 색 돌)
const WALL_XS = [-3, -1, 1, 3], WALL_XS0 = [-2, 2];
function wallBurst(g, o, power) {
  ring(g, 0, .2, o.z, 7, .5, '255,240,200'); flash(g, 0, 1.4, o.z, 7, .4); flash(g, 0, 1.2, o.z, 4, .3, '255,255,255', 'burst');
  const xs = g.tier ? WALL_XS : WALL_XS0;   // 최저 단계는 두 곳에서만(한 프레임에 조각이 몰려 생기지 않게)
  for (const x of xs) { addDebris(g, x, 1.2, o.z, 9, 3, power); addSmoke(g, x, .4, o.z, g.tier ? 3 : 1, 0, 1.2, 1); }
  addSparks(g, 0, 1.4, o.z, g.tier ? 24 : 10, 1, 15, .7); if (g.tier) addGlow(g, 0, 1.2, o.z, 10, 0, 5, .6, .6, 2);
}
const vw = (g, o) => { let v = g.view.get(o); if (!v) { v = { hitT: 0, passT: -1, labL: '', labR: '' }; g.view.set(o, v); } return v; };
function lose(g, loss, x) { const S = g.S, sl = g.slot; popNum(g, 'minus', '−' + loss, x, 2.2, S.z + 1); for (let i = 0; i < Math.min(14, loss); i++) { const k = (rnd() * Math.max(1, g.shown)) | 0; flyer(g, S.cx + sl.ox[k], .4, S.z + sl.oz[k], 0); } syncCrowd(g, 0, 0); }
function pill(g, text, el = 'spirit', dur = 1.6) { g.banner = { text, el, t: 0, dur, spr: textSprite(g, text, 'pill', el) }; }
function castleHit(g) {
  const c = g.S.castle; g.castleHitT = .08; snd('castle-hit');
  const level = c.hp / c.max < .33 ? 2 : c.hp / c.max < .66 ? 1 : 0;
  if (level > (g.cracks || 0)) { g.cracks = level; crackCastle(g, level); addDebris(g, rr(-3, 3), 6, c.z, 12, 0, .8); shake(g, .3); }
}
function castleDown(g) {
  const c = g.S.castle; snd('castle-fall'); whiteFlash(.8); shake(g, 1); g.hitstop = .12; g.cam.punch += .08;
  flash(g, 0, 4, c.z, 10, .7); flash(g, 0, 4, c.z, 14, 1, '255,214,140');
  for (let i = 0; i < 3; i++) ring(g, 0, .2, c.z, 7 + i * 3, .6 + i * .15, i ? '255,230,180' : '255,255,255', i * .08);
  addDebris(g, 0, 3, c.z, 80, 0, 1.6); addSparks(g, 0, 4, c.z, 40, 1, 18, .8);
  // 나머지 조각 · 연기 · 빛은 다음 몇 프레임에 나눠 만든다(한 프레임에 몰리지 않게, 보이는 모습은 같음)
  later(g, .03, () => { addDebris(g, 0, 4, c.z, 40, 2, 1.4); addSmoke(g, 0, .5, c.z, 26, 0, 2.2, 5); });
  later(g, .06, () => { addSmoke(g, 0, 3, c.z, 10, 2, 2, 3); addGlow(g, 0, 4, c.z, 30, 2, 8, 1, 1.2, 1); });   // 40개는 성 조각 그림(castle-chunk-a · b)
  g.pieces = [];
  for (let r = 0; r < 5; r++) for (let q = 0; q < 6; q++) g.pieces.push({ sx: q / 6, sy: r / 5, x: (q + .5) / 6 * 10 - 5, y: 10 - (r + .5) / 5 * 10, z: c.z, vx: rr(-2, 2) + ((q + .5) / 6 - .5) * 4, vy: rr(1, 5) + (5 - r) * .4, vz: rr(-3, 1), rot: 0, vr: rr(-2, 2), t: 0 });
}
function showCards(o) {
  const el = $('rn-cards'); if (!el) return;
  $('rn-vig')?.classList.add('ult'); G.lastN = G.S.n;
  el.innerHTML = `<p class="rn-cards-h">카드 한 장을 골라요</p><div class="rn-card-row">${o.cards.map((c, i) => `<button type="button" class="rn-card${art('card-frame') ? ' art' : ''}" data-g="card" data-i="${i}"><b>${esc(cardName(c))}</b><small>${esc(CARD_TEXT[c[0]] || CARDS[c[0]]?.tag || '')}</small></button>`).join('')}</div>`;
  el.classList.add('on');
}
function pickCard(i) {
  const g = G; if (!g || g.S.phase !== 'card') return;
  const el = $('rn-cards'); el.querySelectorAll('.rn-card')[i]?.classList.add('picked');
  g.lastN = g.S.n; g.rec.pick(i); runPick(g.S, i, onEvent); snd('card', { pick: true });
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
  const stars = res?.valid ? res.stars : g.S.stars, clear = stars > 0, v = view(), daily = g.start.mode === 'daily', last = g.start.stage >= v.stages, canNext = clear && !last && !daily, S = g.S, c = S.castle;
  const reason = err ? (err.message || '결과를 보내지 못했어요.') : res && !res.valid ? ({ fast: '너무 빨리 끝난 판이라 기록되지 않았어요.', expired: '판이 너무 오래 열려 있어서 기록되지 않았어요.', input: '조종 기록을 읽지 못했어요.', version: '펫 대행진이 새로워졌어요. 새로 고친 뒤 다시 해 주세요!' }[res.reason] || '기록되지 않았어요.') : '';
  // 아깝게 졌을 때: 성 HP가 얼마 남았는지(공성전까지 갔으면) · 성까지 얼마 남았는지(달리다 졌으면)를 크게
  const hpLeft = Math.max(1, Math.ceil(c.hp / c.max * 100)), runLeft = Math.max(1, Math.round((1 - clamp(S.z / g.map.len, 0, 1)) * 100));
  const near = clear ? '' : S.siegeT > 0 ? `<p class="rn-near${hpLeft <= 30 ? ' hot' : ''}">성 HP <b>${hpLeft}%</b> 남았어${hpLeft <= 30 ? '!' : '요'}</p>` : `<p class="rn-near${runLeft <= 30 ? ' hot' : ''}">성까지 <b>${runLeft}%</b> 남았어${runLeft <= 30 ? '!' : '요'}</p>`;
  const coins = res?.valid ? Number(res.coins || 0) : 0, box = res?.valid ? Number(res.box || 0) : 0;
  const face = art(clear ? 'spirit-cheer' : 'spirit-hurt');
  el.innerHTML = `<div class="rn-res-card${clear ? ' win' : ''}" id="rn-res-card">${face ? `<img class="rn-res-face" src="${face}" alt="" draggable="false">` : ''}<h2>${clear ? (daily ? '오늘의 도전 성공!' : g.map.boss ? '보스 성 함락!' : '성 함락!') : '아쉬워요!'}</h2>
    <div class="rn-res-stars">${[0, 1, 2].map(i => `<i class="${i < stars ? 'on' : ''}" style="--d:${.25 + i * .3}s"></i>`).join('')}</div>
    ${near}
    ${resultMeta(res)}
    <ul class="rn-res-list"><li><span>남은 정령</span><b>${num(S.left)}</b></li><li><span>깬 바위 · 벽</span><b>${num(S.broke)}</b></li>${S.won ? `<li><span>이긴 적 무리</span><b>${num(S.won)}</b></li>` : ''}${S.fevers ? `<li class="fever"><span>피버</span><b>${num(S.fevers)}번</b></li>` : ''}
      ${res?.valid ? `<li class="coin"><span>코인</span><b>${coin()}+<em id="rn-coin-n">0</em></b></li>${box ? `<li class="box"><span>오늘 첫 판 상자</span><b>${coin()}+${num(box)}</b></li>` : ''}` : ''}</ul>
    ${res?.valid && !coins && res.stars && v.coin_today >= v.coin_daily ? `<p class="rn-res-note">오늘 코인은 다 받았어요. 별과 기록은 그대로 쌓여요!</p>` : ''}
    ${!clear && res?.cheer_next ? `<p class="rn-res-note">다음 판은 응원 정령 +${Math.round(res.cheer_next * 100)}%로 시작해요!</p>` : ''}
    ${reason ? `<p class="rn-res-note warn">${esc(reason)}</p>` : ''}
    <div class="rn-res-btns"><button type="button" class="rn-big gold" data-g="again">한 판 더</button>${canNext ? '<button type="button" class="rn-big blue" data-g="next">다음 스테이지 →</button>' : ''}<button type="button" class="rn-ghost" data-g="map">지도</button></div></div>
    <div class="rn-coinrain" id="rn-coinrain" aria-hidden="true"></div>`;
  // 글을 만든 프레임과 보이는 프레임을 나눈다(한 프레임에 글 만들기 + 배치 + 칠하기가 몰려 100ms까지 걸리던 것)
  requestAnimationFrame(() => { if (el.isConnected) el.hidden = false; });
  if (daily && res?.valid) fillDailyRank();
  const card = $('rn-res-card');
  // 별이 하나씩 쾅: CSS 별 애니메이션(--d)과 같은 때 소리 · 카드 흔들림
  for (let i = 0; i < stars; i++) setTimeout(() => { snd('star', { i }); try { card?.animate([{ transform: 'translateY(0)' }, { transform: 'translateY(6px)' }, { transform: 'translateY(0)' }], { duration: 180, easing: 'ease-out' }); } catch {} }, 250 + i * 300);
  // 코인 비 + 숫자 올라가기(별 뒤에)
  if (coins + box > 0) setTimeout(() => {
    const rain = $('rn-coinrain'); if (!rain) return;
    const n = g.T.coins; rain.innerHTML = Array.from({ length: n }, (_, i) => `<span style="--x:${(i * 37 % 100)}%;--d:${(i % 6) * .07}s;--r:${(i * 53 % 60) - 30}deg">${coin()}</span>`).join('');
    const target = $('rn-coin-n'), t0 = performance.now(), dur = 800;
    const step = now => { if (!target?.isConnected) return; const p = Math.min(1, (now - t0) / dur); target.textContent = num(Math.round(coins * (1 - Math.pow(1 - p, 3)))); if (p < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
    setTimeout(() => { if (rain.isConnected) rain.innerHTML = ''; }, 2200);
  }, 250 + stars * 300);
  else { const t = $('rn-coin-n'); if (t) t.textContent = '0'; }
}

/* ---------- 고리: 고정 틱 + 보간 · 자동 품질 ---------- */
function frame(now) {
  const g = G; if (!g || !g.alive) return;
  g.raf = requestAnimationFrame(frame);
  if (!g.last) { g.last = now; return; }
  let dt = (now - g.last) / 1000; g.last = now;
  if (g.paused) return;
  g.frameLog.push(dt * 1000); dt = Math.min(dt, .1);
  const fdt = g.hitstop > 0 ? 0 : g.slow > 0 ? dt * .3 : dt; g.clock += fdt; g.slow = Math.max(0, g.slow - dt);
  for (let i = g.timers.length - 1; i >= 0; i--) if (g.clock >= g.timers[i].at) { const f = g.timers[i].fn; g.timers.splice(i, 1); f(); }
  const S = g.S;
  // 카운트다운: 장면만 그린다(규칙 멈춤). 끝날 때 이 동안의 프레임으로 품질을 한 번 정해, 다시 굽기가 판 시작 전에 끝나게 한다.
  if (g.cd > 0) {
    g.cd -= dt; g.pz = S.z; g.pcx = S.cx; const j0 = performance.now(); render(g, dt, 0); g.jsLog.push(performance.now() - j0); g.frames++; if (g.cd <= 0) { autoTier(g, true); g.last = 0; g.frameLog.length = 0; g.jsLog.length = 0; } return; }
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
  const j0 = performance.now(); render(g, dt, Math.min(1, g.acc / RUNNER.TICK)); g.jsLog.push(performance.now() - j0);
  g.frames++;
  hud(g, now);
  if (now - g.lastCheck > 2000) { g.lastCheck = now; autoTier(g); }
}
// 위쪽 막대: 진행(0.25초마다) · 정령 수 배지(바뀔 때만 글자를 쓰고, 늘면 금빛 · 줄면 빨강으로 튄다 — Web Animations, 배치 다시 계산 없음)
function hud(g, now) {
  const S = g.S;
  if (now - g.hudAt > 250) { g.hudAt = now; const pct = Math.round(clamp(S.z / g.map.len, 0, 1) * 100); if (pct !== g.progPct) { g.progPct = pct; const p = $('rn-prog'); if (p) p.style.transform = `scaleX(${pct / 100})`; } }
  // 글자는 바뀔 때만, 0.1초에 한 번까지(공성전에는 틱마다 바뀌어 글자 쓰기 · 배치가 매 프레임 생기지 않게)
  if (S.n === g.hudN || now - g.hudTextAt < 100) return;
  const up = S.n > g.hudN, first = g.hudN < 0; g.hudN = S.n; g.hudTextAt = now;
  const b = $('rn-count-n'), box = $('rn-count'); if (!b || !box) return;
  b.textContent = num(S.n);
  if (first || now - g.hudBumpAt < 140) return; g.hudBumpAt = now;
  box.dataset.dir = up ? 'up' : 'down';
  try { box.animate([{ transform: 'scale(1.32)' }, { transform: 'scale(.94)' }, { transform: 'scale(1)' }], { duration: 280, easing: 'ease-out' }); } catch {}
}
// 품질 자동(v13.241 그래픽 안정화 — 히스테리시스):
//   카운트다운: 효과 없는 장면 프레임의 중간값으로 단계마다 예상 시간을 계산해 고른다. 저장된 단계보다 한 단계까지는 다시 올라갈 수 있다(한 번 잘못 내려간 폰이 7일 동안 최저에 갇히지 않게).
//   판 중: 2초 창 두 개(4초)를 보고, 둘 다 느리면(20ms 넘는 프레임 25%↑, 또는 평균 프레임 24ms↑) 한 단계만 내린다. 내린 뒤 6초 동안은 다시 보지 않고, 판 중에는 올리지 않는다.
//   화면이 30Hz로 묶인 폰(저전력 모드: 프레임이 고르게 33ms)은 그리기 시간(JS)이 짧으면 내리지 않는다 — 내려도 빨라지지 않고 흐려지기만 한다.
// 30Hz 묶임(저전력 모드): 프레임의 90% 이상이 30~37ms이고 40ms 넘는 프레임이 2% 아래(고르게 33ms). 그리기가 느린 기기는 33 · 50ms가 섞여 여기에 안 걸린다.
const cappedOf = log => { let c = 0, big = 0; for (const d of log) { if (d > 30 && d < 37) c++; else if (d > 40) big++; } return log.length > 0 && c / log.length >= .9 && big / log.length < .02; };
function winStats(log, js) {
  const n = log.length; let sum = 0, slow = 0; for (const d of log) { sum += d; if (d > 20) slow++; }
  const js2 = [...js].sort((a, b) => a - b);
  return { n, avg: sum / n, slow: slow / n, capped: cappedOf(log), js: js2[js2.length >> 1] || 0 };
}
function autoTier(g, warm = false) {
  const log = g.frameLog, js = g.jsLog; g.frameLog = []; g.jsLog = [];
  if (warm) {
    if (log.length < 20) return;
    const sorted = [...log].sort((a, b) => a - b), mid = sorted[sorted.length >> 1], sc = g.S2, jsMid = [...js].sort((a, b) => a - b)[js.length >> 1] || 0, capped = cappedOf(log) && jsMid < 8;
    if (capped) return;
    let t = Math.min(3, g.tier + 1);
    while (t > 0 && mid * (s2Of(g, t) / sc) ** 2 * (t > g.tier ? 1.25 : 1) > 10) t--;   // 올라갈 때는 25% 더 여유를 본다
    // 효과 없는 카운트다운 장면도 하한에서 18ms를 넘을 만큼 무거우면 처음부터 비상 중간으로(그 판만)
    //   중간 크기(0.75배)로도 18ms를 넘을 만큼 무거우면 바로 예전 최저 크기로
    if (RES_EMERGENCY && t === 0 && mid * (floorS2(g) / sc) ** 2 > EMERG_CD) return setTier(g, 0, mid * (floorS2(g) * EMERG_MID / sc) ** 2 > EMERG_CD ? 2 : 1);
    if (t !== g.tier) setTier(g, t);
    return;
  }
  if (!log.length || g.frames < 90) return;
  const w = winStats(log, js), prev = g.lastWin; g.lastWin = w;
  if (g.emerg >= 2 || !prev || g.clock - (g.tierAt || 0) < 6) return;
  if (w.capped && w.js < 10 && prev.capped) return;
  if (g.tier === 0) {
    // 비상 단계: 하한(또는 중간)에서 4초 평균 EMERG_MS 초과 또는 20ms 넘는 프레임 12%↑ · 30Hz 묶임이 아님 → 한 단계 더(6초 쉼)
    const avg = (w.avg * w.n + prev.avg * prev.n) / (w.n + prev.n), slow = (w.slow * w.n + prev.slow * prev.n) / (w.n + prev.n);
    if (RES_EMERGENCY && (avg > EMERG_MS || slow > .12) && !(w.capped && prev.capped)) { setTier(g, 0, g.emerg + 1); g.lastWin = null; }
    return;
  }
  const bad = x => x.slow > .25 || x.avg > 24;
  if (bad(w) && bad(prev)) { setTier(g, g.tier - 1); g.lastWin = null; }
}
function setTier(g, t, emerg = 0) {
  g.tier = t; g.T = TIERS[t]; g.tierAt = g.clock; g.emerg = t === 0 ? Math.max(0, Math.min(2, emerg | 0)) : 0;
  window.__rnTier = g.emerg ? -g.emerg : t;   // 화면 시험(docs/runner-play-shot.mjs)이 읽는다(−1 = 비상 중간, −2 = 비상 끝)
  writePref(TIER_KEY, JSON.stringify({ t, at: Date.now() }));   // 비상 단계는 기억하지 않는다(다음 판은 하한부터)
  const P = g.pools; for (const [k, cap] of [['D', 'debris'], ['M', 'smoke'], ['K', 'sparks'], ['Gl', 'glows'], ['F', 'fly'], ['B', 'shots']]) P[k].n = Math.min(P[k].n, g.T[cap]);
  if (s2Of(g, t) !== g.S2) resize(g);   // 해상도가 그대로면 다시 굽지 않는다(효과만 줄어 끊김 없음)
  syncCrowd(g, 0, 0);
}

/* ---------- 그리기 ---------- */
function render(g, dt, alpha) {
  const ctx = g.ctx, S = g.S, cam = g.cam, fdt = g.hitstop > 0 ? 0 : g.slow > 0 ? dt * .3 : dt;
  const z = lerp(g.pz, S.z, alpha), cx = lerp(g.pcx, S.cx, alpha), siege = S.phase === 'siege' || (S.phase === 'done' && S.castle.down) || S.siegeT > 0;
  // 무리가 커질수록 카메라가 살짝 물러나 높아진다(정령이 화면 밖으로 넘치지 않게). 기본 거리 7.6: 무리가 화면 아래쪽 1/3에 크게
  const Rr = crowdR(S.n), tb = siege ? 11 : 7.6 + Math.min(2.4, Rr * .8), th = siege ? 9 : 8.6 + Math.min(1.2, Rr * .4), tzm = siege ? 1.3 : 1, k = 1 - Math.exp(-dt * 2.5);
  if (dt) { g.vx = clamp((cx - g.lastCx) / dt, -12, 12); g.lastCx = cx; }
  cam.back += (tb - cam.back) * k; cam.h += (th - cam.h) * k; cam.zoom += (tzm - cam.zoom) * k;
  cam.z = z - cam.back; cam.x += (cx * .35 - cam.x) * (1 - Math.exp(-dt * 4));
  // 흔들림 · 줌(v13.241 안정화): 줌 펀치 상한 0.15 → 0.08, 흔들림 폭 0.35 → 0.2 · 떨림 71Hz → 두 사인(23 · 31)을 섞은 느린 흔들림 → 화면이 덜 어지럽고 글자가 덜 번진다
  cam.punch = Math.min(cam.punch, .08) * Math.exp(-dt * 6); cam.trauma = Math.max(0, cam.trauma - dt * 1.8);
  const shk = cam.trauma * cam.trauma * .2, tt = performance.now() / 1000, sx = cam.x, sh = cam.h;
  cam.x += shk * (Math.sin(tt * 23) * .7 + Math.sin(tt * 31 + 2) * .3); cam.h += shk * Math.sin(tt * 27 + 1) * .5;
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  ctx.drawImage(g.sky, 0, 0);
  drawSkyDrift(g); drawClouds(g); drawRoad(g); drawFloor(g);
  // 그릴 물체 목록(먼 것부터): 판마다 하나의 배열을 다시 쓰고(새 배열 없음), 거의 정렬된 상태라 끼워 넣기 정렬
  const objs = g.objs; objs.length = 0;
  // 정렬 깊이 dz: 달려오는 적 무리는 지금 자리보다 7 앞(앞의 문 판 위에 그려 가리지 않게, 연출만), 나머지는 z. 바닥 장애물(미끄럼 · 소용돌이)은 drawFloor가 먼저 그렸다.
  for (let i = S.lo; i < S.items.length; i++) { const o = S.items[i]; if (o.z > cam.z + 95) break; const dz = o.type === 'foe' && o.on ? Math.max(o.pz - 7, S.z + .5) : o.z; if (dz > cam.z + 1 && o.type !== 'card' && o.type !== 'end' && o.type !== 'slide' && o.type !== 'whirl') { o.dz = dz; objs.push(o); } }
  if (siege || S.castle.z < cam.z + 95) { g.oCastle.z = g.oCastle.dz = S.castle.z; objs.push(g.oCastle); }
  g.oCrowd.z = g.oCrowd.dz = z + .01; objs.push(g.oCrowd);
  for (let i = 1; i < objs.length; i++) { const o = objs[i]; let j = i - 1; while (j >= 0 && objs[j].dz < o.dz) { objs[j + 1] = objs[j]; j--; } objs[j + 1] = o; }
  for (let i = 0; i < objs.length; i++) drawObj(g, objs[i], fdt, cx, z, alpha);
  drawSmoke(g, fdt); drawDebris(g, fdt); drawFlyers(g, fdt); drawBullets(g, fdt);
  drawRings(g, fdt); drawFlashes(g, fdt); drawGlows(g, fdt); drawSparks(g, fdt);
  for (let i = g.fx.length - 1; i >= 0; i--) { const f = g.fx[i]; f.draw(fdt); f.t += fdt; if (f.t >= f.dur) cut(g.fx, i); }
  castleStage(g, fdt);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (S.phase === 'run') drawSpeedLines(g, dt);
  if (g.feverOn || g.feverBig) drawFever(g, dt);
  drawPops(g, fdt); drawBursts(g, dt); drawBanner(g, dt); drawCutin(g, dt);
  cam.x = sx; cam.h = sh; g.hitstop = Math.max(0, (g.hitstop || 0) - dt);
}
// 하늘 층: 소실점 근처를 천천히 떠가는 구름(화면 좌표, 품질별 1~4개) — 아래 구름 섬과 다른 속도라 깊이가 생긴다
function drawSkyDrift(g) {
  const ctx = g.ctx, W = g.cvs.width, n = g.T.sky, img = g.SPR.cloud;
  ctx.globalAlpha = .75;
  for (let i = 0; i < n; i++) { const sp = 6 + i * 5, w = W * (.32 + (i % 2) * .14), x = ((i * .37 + g.clock * sp / 390) % 1.4 - .2) * W, y = g.HZ * (.55 + i * .1); ctx.drawImage(img, x - w / 2, y - w * .2, w, w * .45); }
  ctx.globalAlpha = 1;
}
// 가장자리 속도선: 소실점에서 화면 바깥으로 뻗는 흰 줄(재료 speed) — 달릴 때만, 품질별 0~8줄
function drawSpeedLines(g, dt) {
  const n = g.T.speed * (g.feverOn ? 2 : 1); if (!n) return; void dt;
  const ctx = g.ctx, W = g.cvs.width, H = g.cvs.height, img = g.feverOn ? g.tg.speedF : g.tg.speedW;
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < n; i++) {
    const side = i % 2 ? 1 : -1, a = side * (.62 + ((i * .37) % 1) * .5), ph = (g.clock * 1.6 + i * .29) % 1, d = (.35 + ph * .9) * H, L = H * (.18 + ph * .22);
    const x = g.CX + Math.sin(a) * d, y = g.HZ + Math.cos(a) * d * .9; if (x < -L || x > W + L) continue;
    ctx.globalAlpha = (g.feverOn ? .3 : .16) * Math.sin(ph * Math.PI); ctx.save(); ctx.translate(x, y); ctx.rotate(Math.atan2(Math.cos(a) * .9, Math.sin(a))); ctx.drawImage(img, -L * .5, -4 * g.S2, L, 8 * g.S2); ctx.restore();
  }
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
}
// 화면 쪽으로 튀어나오는 큰 숫자(문 통과): 화면 가운데에서 커지며 사라진다
// v13.242 피버 연출(화면 좌표): 시작 때 "피버 타임!" 큰 글자(그림 75 fever-plate가 있으면 뒤에) + 빛 띠가 위아래로 지나감, 피버 동안 남은 시간 막대
function drawFever(g, dt) {
  const ctx = g.ctx, W = g.cvs.width, H = g.cvs.height, S2 = g.S2, F = g.feverBig;
  if (F) {
    F.t += dt; if (F.t > 1.3) g.feverBig = null;
    else {
      const p = F.t / 1.3, sc = p < .15 ? .5 + easeOut(p / .15) * .7 : 1.2 - (p - .15) * .2, a = p > .8 ? (1 - p) / .2 : 1, s = F.spr, cy = H * .36;
      ctx.globalAlpha = a;
      if (g.SPR.feverPlate) { const pw = g.SPR.feverW * sc, ph = pw / 2; ctx.drawImage(g.SPR.feverPlate, W / 2 - pw / 2, cy - ph / 2, pw, ph); }
      ctx.drawImage(s.c, W / 2 - s.w * sc / 2, cy - s.h * sc / 2, s.w * sc, s.h * sc);
      const band = g.img['light-band'] ? g.img['light-band'] : g.tg.speedF; ctx.globalCompositeOperation = 'lighter';
      for (let k = 0; k < 2; k++) { const y = k ? H * (.15 + p * .7) : H * (.85 - p * .7), bw = W * 1.4; ctx.globalAlpha = a * .6; ctx.drawImage(band, W / 2 - bw / 2 + (k ? 1 : -1) * (p - .5) * W * .6, y - 30 * S2, bw, 60 * S2); }
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    }
  }
  if (g.feverOn) { const p = g.S.fever / RUNNER.FEVER_TICKS, bw = W * .5, bh = 6 * S2, y = H - 26 * S2; ctx.fillStyle = 'rgba(40,20,0,.55)'; roundRect(ctx, W / 2 - bw / 2, y, bw, bh, bh / 2); ctx.fill(); ctx.fillStyle = '#ffd24a'; roundRect(ctx, W / 2 - bw / 2, y, Math.max(bh, bw * p), bh, bh / 2); ctx.fill(); }
}
function burst(g, str, style, big = false) { if (g.bursts.length >= 4) g.bursts.shift(); g.bursts.push({ str, style, big, t: 0 }); }
function drawBursts(g, dt) {
  for (let i = g.bursts.length - 1; i >= 0; i--) {
    const b = g.bursts[i]; b.t += dt; const d = b.big ? .7 : .55; if (b.t > d) { cut(g.bursts, i); continue; }
    const A = g.SPR.digits[b.style], cap = A.k * 1.1, p = b.t / d, sc = Math.min(cap, (b.big ? 1.4 : 1.1) + easeOut(p) * (b.big ? 2 : 1.5)), a = p < .15 ? p / .15 : 1 - (p - .15) / .85;   // 아틀라스 1.1배까지만
    drawNum(g, b.style, b.str, g.cvs.width / 2, g.cvs.height * (.46 - p * .06), sc, a * .95);
  }
}
// 성 HP 단계: 66% 아래 금, 50% 아래 불 · 연기, 25% 아래 위에서 조각이 떨어진다(품질 '최저'는 불을 끔)
function castleStage(g, dt) {
  const S = g.S, c = S.castle; if (!dt || c.down || !(S.phase === 'siege' || S.siegeT > 0)) return;
  const p = c.hp / c.max;
  if (p < .5 && g.T.fire && (g.fireT -= dt) <= 0) { g.fireT = .12 + p * .3; const x = rr(-3.8, 3.8), y = rr(3, 9); addGlow(g, x, y, c.z - .6, 1, 1, .6, rr(1.2, 2.2), .55, 2.5); if (rnd() < .35) addSmoke(g, x, y + .5, c.z - .4, 1, 3, 1.2, .3); }
  if (p < .25 && (g.chunkT -= dt) <= 0) { g.chunkT = .28; addDebris(g, rr(-4, 4), rr(8, 10), c.z - .3, 3, 2, .5); }
}
function drawClouds(g) {
  const ctx = g.ctx, k0 = Math.floor((g.cam.z + 4) / 15), img = g.SPR.cloud;
  ctx.globalAlpha = .95;
  for (let k = k0 + 7; k >= k0; k--) for (let sd = -1; sd <= 1; sd += 2) {
    const h = Math.sin(k * 12.9898 + sd * 78.233) * 43758.5453, f = h - Math.floor(h);
    if (proj(g, sd * (7 + f * 9), -2.5 - f * 2.5, k * 15 + f * 6)) { const ww = (3 + f * 3) * PS, hh = ww * img.height / img.width; ctx.drawImage(img, PX - ww / 2, PY - hh * .55, ww, hh); }   // 그림 비율 그대로(구름 섬 288×192)
  }
  ctx.globalAlpha = 1;
}
// 길(v13.241 그래픽 안정화): 띠마다 따로 칠하던 판(이음매 · 계단)을 **사다리꼴 한 장**으로 바꿨다.
//   ① 난간까지 포함한 사다리꼴 한 장(가까이 난간 색 → 멀리 안개 색 그라디언트) ② 안을 길 무늬 띠로 채움(띠는 길 가장자리보다 pad만큼 넓게)
//   ③ 길 가장자리 테두리 띠: 진짜 가장자리 선(직선)에서 화면 픽셀로 ±(pad + 0.5)인 매끈한 사다리꼴 한 장씩 → 띠 끝의 계단을 덮는다
//     (clip은 CPU로 그리는 느린 기기에서 비싸서 쓰지 않는다) ④ 난간 윗줄 · 기둥. 모두 부드러운(안티앨리어스) 다각형이고 imageSmoothing은 늘 켠다.
function roadQuad(g, half, zNear, zFar) {
  if (!proj(g, -half, 0, zFar)) return null; const lf = PX, yf = PY; proj(g, half, 0, zFar); const rf = PX;
  proj(g, -half, 0, zNear); const ln = PX, yn = PY; proj(g, half, 0, zNear); return [lf, yf, rf, PX, yn, ln];
}
function quadPath(ctx, q) { ctx.beginPath(); ctx.moveTo(q[0], q[1]); ctx.lineTo(q[2], q[1]); ctx.lineTo(q[3], q[4]); ctx.lineTo(q[5], q[4]); ctx.closePath(); }
function drawRoad(g) {
  const ctx = g.ctx, cam = g.cam, ROAD = RUNNER.ROAD, rail = .35, endZ = g.S.castle.z + 6, tile = g.img['road-' + g.th], PAL = g.pal;
  const zNear = cam.z + .8, zFar = Math.min(endZ, cam.z + 90); if (zFar <= zNear) return;
  ctx.imageSmoothingEnabled = true;
  const outer = roadQuad(g, ROAD + rail, zNear, zFar); if (!outer) return;
  // ① 난간 띠까지 한 장: 단색(그라디언트는 카메라가 움직일 때마다 다시 만들어야 하고 CPU로 그리는 기기에서 비싸다). 먼 곳(안개)만 밝은 색 사다리꼴 한 장 더.
  const zMid = Math.min(zFar, cam.z + 64), farQ = zMid < zFar ? roadQuad(g, ROAD + rail, zMid, zFar) : null;
  ctx.fillStyle = THEME.rail; quadPath(ctx, outer); ctx.fill();
  if (farQ) { ctx.fillStyle = '#e8e2d0'; quadPath(ctx, farQ); ctx.fill(); }
  const inner = roadQuad(g, ROAD, zNear, zFar);
  if (tile) {
    const pad = drawRoadTiled(g, tile, endZ) + .5;
    // ③ 테두리 띠(진한 갈색 단색): 가장자리 직선을 화면에서 ±pad 픽셀 옮긴 사다리꼴(먼 쪽은 0.6배로 가늘게)
    ctx.fillStyle = 'rgba(96,60,24,.92)';
    for (const sd of [-1, 1]) { const xf = sd < 0 ? inner[0] : inner[2], xn = sd < 0 ? inner[5] : inner[3]; ctx.beginPath(); ctx.moveTo(xf - pad * .6, inner[1]); ctx.lineTo(xf + pad * .6, inner[1]); ctx.lineTo(xn + pad, inner[4]); ctx.lineTo(xn - pad, inner[4]); ctx.closePath(); ctx.fill(); }
  }
  else {
    // 코드 그림 길: 바탕 사다리꼴 한 장 + 3단위 줄무늬(가로 띠는 길 사다리꼴 안에서만, 잘라서 가장자리가 매끈)
    ctx.fillStyle = PAL.roadB[8]; quadPath(ctx, inner); ctx.fill();
    ctx.save(); quadPath(ctx, inner); ctx.clip();
    const z0 = Math.floor((cam.z + 1) / 3) * 3;
    for (let zz = z0 + 90; zz >= z0; zz -= 3) {
      if (zz > endZ) continue; const za = Math.max(zz, zNear), zb = zz + 3; if (zb <= za) continue;
      const q = roadQuad(g, ROAD + .2, za, zb); if (!q) continue;
      const fog = clamp((zz - cam.z) / 90, 0, 1) * .85, odd = Math.floor(zz / 3) & 1, fi = Math.min(31, Math.round(fog * 31));
      ctx.fillStyle = (odd ? PAL.roadA : PAL.roadB)[fi]; quadPath(ctx, q); ctx.fill();
      if (odd && fog < .7) { const m = roadQuad(g, .09, za, zb); if (m) { ctx.fillStyle = PAL.stripe[fi]; quadPath(ctx, m); ctx.fill(); } }
    }
    ctx.restore();
  }
  // 난간 윗줄(기둥을 잇는 금빛 막대) · 아래 그늘 줄: 가까운 끝 ~ 먼 끝 사다리꼴 한 장씩
  const zn = cam.z + 1.6, zf = Math.min(endZ, cam.z + 80);
  for (const [yy, col, wd] of [[1.12, 'rgba(90,60,20,.35)', .05], [1.15, THEME.rail, .07]]) {
    ctx.fillStyle = col;
    for (const sd of [-1, 1]) { if (!proj(g, sd * (ROAD + .18), yy, zn)) continue; const x0 = PX, y0 = PY, w0 = wd * PS; proj(g, sd * (ROAD + .18), yy, zf); const w1 = Math.max(.6, wd * PS); ctx.beginPath(); ctx.moveTo(x0, y0 - w0); ctx.lineTo(PX, PY - w1); ctx.lineTo(PX, PY + w1); ctx.lineTo(x0, y0 + w0); ctx.fill(); }
  }
  const p0 = Math.ceil((cam.z + 1.5) / 6) * 6;
  for (let i = g.T.posts - 1; i >= 0; i--) { const zz = p0 + i * 6; if (zz > endZ) continue; for (const sd of [-1, 1]) if (proj(g, sd * (ROAD + .18), 0, zz)) { const w = .45 * PS, h = 1.3 * PS; ctx.drawImage(h > g.SPR.post.height * .6 ? g.SPR.post : g.SPR.postS, PX - w / 2, PY - h, w, h); } }
}
// 길 타일(그림 74 road-<테마>, 세로로 이어지는 256px): 화면을 가로 띠(품질별 5~12px)로 나눠 띠마다 그 깊이의 길 폭 · 타일 줄을 잘라 찍는다.
//   타일 한 장 = 길 4단위. 띠 위아래 깊이로 타일 줄을 고르고, 타일 경계를 넘으면 두 번에 나눠 찍어 이음매가 없다. 멀리는 안개 그라디언트 한 장.
const frac = v => v - Math.floor(v), TILE_Z = 4;
// 길 타일 축소본: 불투명 캔버스(섞기 없음) 256 · 128 · 64 · 32px. 먼 줄은 작은 것을 써서 큰 그림을 줄여 그리는 비용을 없앤다(판 전에 한 번).
const MIPS = new Map();
function roadMip(img) {
  if (!img) return null; const out = []; let src = img;
  for (let w = 256; w >= 32; w /= 2) { const h = Math.round(w * img.height / img.width), c = mk(w, h), x = c.getContext('2d', { alpha: false }); x.imageSmoothingQuality = 'high'; x.drawImage(src, 0, 0, w, h); out.push(c); src = c; }
  return out;
}
function drawRoadTiled(g, img, endZ) {
  const ctx = g.ctx, cam = g.cam, K = g.F * (cam.zoom + cam.punch), HZ = g.HZ, ROAD = RUNNER.ROAD, mip = g.roadMip;
  const zFar = Math.min(cam.z + 90, endZ), yTop = HZ + cam.h * K / (zFar - cam.z), yBot = Math.min(g.cvs.height, HZ + cam.h * K / .8);
  // 띠 높이는 화면 픽셀 4~5px(띠 안 길 폭 차이 1px 안팎): 가장자리는 바깥의 사다리꼴 clip이 매끈하게 자르고, 띠는 아래 끝 폭으로 넉넉히 칠한다.
  // 비상 끝 단계(2, 예전 최저 크기)만 길 무늬를 가까운 점으로(예전 최저와 같음 — 그 기기에서는 부드럽게 늘리기가 프레임의 큰 몫). 그 밖은 늘 부드럽게.
  if (g.emerg >= 2) ctx.imageSmoothingEnabled = false;
  const band = g.emerg ? 4 : clamp(Math.round(2.2 * g.S2 + 1), 3, 6);
  let padMax = 0;
  for (let y = yTop; y < yBot; y += band) {
    const y2 = Math.min(yBot, y + band), dzm = cam.h * K / ((y + y2) * .5 - HZ), dzb = cam.h * K / (y2 - HZ), half = ROAD * K / dzm, x0 = g.CX - cam.x * K / dzm - half, w = half * 2, pad = (ROAD * K / dzb - half) + 1; if (pad > padMax) padMax = pad;
    if (mip) img = mip[w > 192 ? 0 : w > 96 ? 1 : w > 48 ? 2 : 3]; const iw = img.width, ih = img.height;
    const za = cam.z + cam.h * K / (y - HZ), zb = cam.z + cam.h * K / (y2 - HZ);
    // 타일 가로는 길 폭에 맞추고 양옆 pad만큼 늘려(타일 가장자리 줄은 1px 안팎으로만 흔들림) clip 밖까지 덮는다
    const X = x0 - pad, Wd = w + pad * 2;
    if (za - zb >= TILE_Z) { ctx.drawImage(img, 0, 0, iw, ih, X, y, Wd, y2 - y + 1); continue; }
    const ra = (1 - frac(za / TILE_Z)) * ih, rb = (1 - frac(zb / TILE_Z)) * ih;
    if (rb > ra) ctx.drawImage(img, 0, ra, iw, Math.max(.5, rb - ra), X, y, Wd, y2 - y + 1);
    else { const t = (ih - ra) / (ih - ra + rb), ys = y + (y2 - y) * t; if (ih - ra > .5) ctx.drawImage(img, 0, ra, iw, ih - ra, X, y, Wd, ys - y + 1); if (rb > .5) ctx.drawImage(img, 0, 0, iw, rb, X, ys, Wd, y2 - ys + 1); }
  }
  ctx.imageSmoothingEnabled = true;
  // 멀리 안개(화면 크기마다 한 번 만든 그라디언트): 먼 길이 하늘색으로 흐려진다
  if (proj(g, -ROAD, 0, zFar)) { const ax = PX, ay = PY; proj(g, ROAD, 0, zFar); const bx = PX; const zm = cam.z + 26; proj(g, ROAD, 0, zm); const cxp = PX, cy = PY; proj(g, -ROAD, 0, zm); ctx.fillStyle = g.fogGrad; ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, ay); ctx.lineTo(cxp, cy); ctx.lineTo(PX, cy); ctx.fill(); }
  return padMax;   // 띠가 길 가장자리 밖으로 나간 최대 픽셀(테두리 띠 폭)
}
function drawObj(g, o, dt, cx, z, alpha) {
  const ctx = g.ctx, P = g.SPR, S = g.S, t = S.tick - 1 + alpha;
  if (o.type === 'gate') {
    const v = vw(g, o); if (v.passT >= 0) { v.passT += dt; if (v.passT > .5) return; }
    if (!proj(g, 0, 0, o.z)) return;
    const fade = v.passT >= 0 ? 1 - v.passT / .5 : 1;
    if (!v.labL) { v.labL = o.l[0] + o.l[1]; v.labR = o.r[0] + o.r[1]; }
    // v13.242 움직이는 문(칸막이 sx가 오감) · 바뀌는 문(sw틱마다 두 칸이 바뀜, 바뀌기 직전 깜빡). 지난 문은 지날 때 칸막이 · 값 그대로.
    const passed = v.passT >= 0, sx = passed ? (v.sx ?? 0) : gateSplit(o, t), swp = passed ? !!v.swp : gateSwapped(o, S.tick);
    if (!passed) { v.sx = sx; v.swp = swp; }
    const blink = o.sw && !passed ? (o.sw - S.tick % o.sw) < 7 : false;
    for (let side = -1; side <= 1; side += 2) {
      const val = (side < 0) !== swp ? o.l : o.r, lab = (side < 0) !== swp ? v.labL : v.labR, x0 = side < 0 ? -RUNNER.ROAD + .15 : sx + .15, x1 = side < 0 ? sx - .15 : RUNNER.ROAD - .15;
      proj(g, x0, 2.6, o.z); const ax = PX, ay = PY; proj(g, x1, 0, o.z); const bx = PX, by = PY, sc = PS;
      const chosen = o.took === side, a = (passed ? (chosen ? fade : fade * .4) : 1) * (blink ? .55 + .45 * Math.abs(Math.sin(g.clock * 22)) : 1), grow = chosen && passed ? 1 + v.passT * .6 : 1;
      const cxm = (ax + bx) / 2, cym = (ay + by) / 2, w = (bx - ax) * grow, h = (by - ay) * grow;
      // 테두리 빛(속성 없이 파랑 · 빨강, 숨 쉬듯) → 판 → 박동하는 숫자(×문은 더 크게)
      const ok = goodGate(val), puls = 1 + Math.sin(g.clock * 6 + side) * .07 * (val[0] === '×' ? 1.6 : 1);
      if (g.T.glow) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = a * (.45 + .2 * Math.sin(g.clock * 5 + side)); const gw = w * 1.5; ctx.drawImage(ok ? g.tg.gateGood : g.tg.gateBad, cxm - gw / 2, cym - gw * .55, gw, gw * 1.1); ctx.globalCompositeOperation = 'source-over'; }
      const gp = ok ? (w > 260 ? P['gate-good'] : P['gate-goodS']) : (w > 260 ? P['gate-bad'] : P['gate-badS']);
      ctx.globalAlpha = a; ctx.drawImage(gp, cxm - w / 2, cym - h / 2, w, h);
      const fitN = w * .5 / (P.digits[ok ? 'good' : 'bad'].adv * lab.length);   // 숫자는 문 판 폭의 절반까지(멀리서 판을 가리지 않게, 가까우면 1.8배 상한)
      drawNum(g, ok ? 'good' : 'bad', lab, cxm, cym, Math.min(1.8, sc / (17 * g.S2), fitN) * grow * puls * (val[0] === '×' ? 1.15 : 1), a); ctx.globalAlpha = 1;
    }
    if (P.gateFrame) { proj(g, sx, 0, o.z); const fh = 3.4 * PS, fw = fh * .5; ctx.drawImage(fh > 260 ? P.gateFrame : P.gateFrameS, PX - fw / 2, PY - fh, fw, fh); }   // 가운데 기둥(그림 74 gate-frame)
    else { proj(g, sx, 2.8, o.z); const tx = PX, ty = PY; proj(g, sx, 0, o.z); ctx.fillStyle = '#f2f6ff'; ctx.fillRect(tx - .1 * PS, ty, .2 * PS, PY - ty); }
    if ((o.mv || o.sw) && !passed && g.tier && o.z - S.z < 60 && proj(g, sx, 3.5, o.z)) { const lb = v.lb ||= textSprite(g, o.mv ? '↔ 움직이는 문' : '⇄ 바뀌는 문', 'pill', o.mv ? 'spirit' : 'star'), k = Math.min(1, PS / (20 * g.S2)); ctx.drawImage(lb.c, PX - lb.w * k / 2, PY - lb.h * k, lb.w * k, lb.h * k); }
    return;
  }
  if (o.type === 'wall') return drawWall(g, o, dt);
  if (o.type === 'foe') return drawFoe(g, o, dt, alpha);
  if (o.type === 'pillar') return drawPillar(g, o, t);
  if (o.type === 'rock') {
    if (o.done || !proj(g, o.x, 0, o.z)) return; const v = vw(g, o);
    const w = 2.1 * PS, h = w * 150 / 160, wob = v.hitT > 0 ? rr(-.06, .06) * PS : 0;
    ctx.globalAlpha = .5; ctx.drawImage(P.shadow, PX - w * .55, PY - w * .12, w * 1.1, w * .3); ctx.globalAlpha = 1;
    ctx.drawImage(P.rock, PX - w / 2 + wob, PY - h * .9, w, h);
    if (v.hitT > 0) { v.hitT -= dt; ctx.globalAlpha = .45; ctx.drawImage(P.rockW, PX - w / 2 + wob, PY - h * .9, w, h); ctx.globalAlpha = 1; }
    const hit = v.hitT > 0, jx = hit ? rr(-.08, .08) * PS : 0;   // 맞는 동안 숫자가 흔들리며 커졌다 줄어든다
    const hs = ns(Math.ceil(o.hp)); drawNum(g, 'rock', hs, PX + jx, PY - h * (g.img['rock-num'] ? .36 : .45), Math.min(1.5, PS / (17 * g.S2), w * .7 / (P.digits.rock.adv * hs.length)) * (hit ? 1.14 : 1)); return;
  }
  if (o.type === 'saw') {
    const x = o.stop ? o.x : o.x0 + o.amp * tri(t / o.per);
    if (!o.stop && o.z - S.z < 30) warn(g, x, o.z, 1.3, .5 + .5 * Math.sin(g.clock * 9));   // 경고 그림자(다가오면 깜빡)
    if (!proj(g, x, .75, o.z)) return; const r = .8 * PS, y0 = PY;
    proj(g, -RUNNER.ROAD, .05, o.z); const lx = PX, ly = PY; proj(g, RUNNER.ROAD, .05, o.z); ctx.fillStyle = 'rgba(60,60,80,.55)'; ctx.fillRect(lx, ly - .06 * PS, PX - lx, .12 * PS); proj(g, x, .75, o.z);
    ctx.save(); ctx.translate(PX, y0); ctx.rotate(o.stop ? 0 : g.clock * 14); ctx.drawImage(P.saw, -r, -r, r * 2, r * 2); ctx.restore(); return;
  }
  if (o.type === 'hammer') {
    const L = 3, ang = o.stop ? 0 : Math.sin(tri(t / o.per + o.ph) * Math.PI / 2) * 1.25;
    if (!o.stop && o.z - S.z < 30) warn(g, o.x, o.z, 1.2, .35 + .65 * (1 - Math.min(1, Math.abs(ang) / 1.25)));   // 내려칠 자리: 머리가 내려올수록 진하게
    if (!proj(g, o.x, 4.2, o.z)) return; const px = PX, py = PY;
    if (g.hammerArt) { const hh = (L + .9) * PS, hw = hh * 192 / 288; ctx.save(); ctx.translate(px, py); ctx.rotate(ang); ctx.drawImage(P.hammer, -hw / 2, -hh * .1, hw, hh); ctx.restore(); return; }   // 손잡이 위 끝이 축
    proj(g, o.x + Math.sin(ang) * L, 4.2 - Math.cos(ang) * L, o.z); const hx = PX, hy = PY, s2 = PS;
    ctx.strokeStyle = '#6b4520'; ctx.lineWidth = .22 * s2; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(hx, hy); ctx.stroke();
    ctx.fillStyle = '#4a3a2a'; ctx.beginPath(); ctx.arc(px, py, .25 * s2, 0, TAU); ctx.fill();
    ctx.save(); ctx.translate(hx, hy); ctx.rotate(ang); const w = 1.8 * s2, h = 1.2 * s2; ctx.drawImage(P.hammer, -w / 2, -h / 2, w, h); ctx.restore(); return;
  }
  if (o.type === 'crystal') {
    if (o.done || !proj(g, o.x, 0, o.z)) return; const v = vw(g, o), w = 2.6 * PS, h = w * 1.2, bob = Math.sin(g.clock * 2) * .1 * PS, wob = v.hitT > 0 ? rr(-.05, .05) * PS : 0;
    ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = .5 + .2 * Math.sin(g.clock * 4); ctx.drawImage(g.tg.crystal, PX - w, PY - h * 1.05, w * 2, w * 2); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(P.crystal, PX - w / 2 + wob, PY - h + bob, w, h);
    const crack = o.hp < o.max * .25 ? 3 : o.hp < o.max * .5 ? 2 : o.hp < o.max * .8 ? 1 : 0;   // 수정 금: 깎일수록 세 단계
    if (crack) ctx.drawImage(P.crystalCrack[crack - 1], PX - w / 2 + wob, PY - h + bob, w, h);
    if (v.hitT > 0) { v.hitT -= dt; ctx.globalAlpha = .5; ctx.drawImage(P.crystalW, PX - w / 2 + wob, PY - h + bob, w, h); ctx.globalAlpha = 1; }
    const hs = ns(Math.ceil(o.hp)); drawNum(g, 'rock', hs, PX, PY - h - .3 * PS, Math.min(1.4, PS / (20 * g.S2), w * .8 / (P.digits.rock.adv * hs.length))); return;
  }
  if (o.type === 'castle') return drawCastle(g, dt);
  if (o.type === 'crowd') return drawCrowd(g, dt, cx, z);
}
// v13.242 숫자 벽: 길 전체(틈이 있으면 두 토막) · 칸 그림을 가로로 이어 붙임 · 맞으면 흰 번쩍 · HP 66% · 33% 아래 금 · 큰 숫자. 틈 바닥에는 파란 빛.
function drawWall(g, o, dt) {
  if (o.done || !proj(g, 0, 0, o.z)) return;
  const ctx = g.ctx, P = g.SPR, v = vw(g, o), H = 3.1, ROAD = RUNNER.ROAD + .25, wob = v.hitT > 0 ? rr(-.05, .05) : 0, crack = o.hp < o.max * .33 ? 2 : o.hp < o.max * .66 ? 1 : 0;
  if (v.hitT > 0) v.hitT -= dt;
  const segs = v.segs ||= o.gap ? [[-ROAD, o.gap.x - o.gap.w / 2], [o.gap.x + o.gap.w / 2, ROAD]] : [[-ROAD, ROAD]], tw = g.tier ? H * 2 : 99;   // 최저 단계는 토막마다 한 장으로 늘려 그림(그리기 횟수 줄임)   // 토막은 벽마다 한 번만 만든다
  if (o.gap && g.T.glow && proj(g, o.gap.x, .1, o.z)) { const gw = o.gap.w * PS * 1.2; ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = .55 + .25 * Math.sin(g.clock * 6); ctx.drawImage(g.tg.gateGood, PX - gw / 2, PY - gw * .8, gw, gw); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; }
  let big = 0, bx = 0;
  for (const [x0, x1] of segs) {
    if (x1 - x0 < .2) continue;
    if (x1 - x0 > big) { big = x1 - x0; bx = (x0 + x1) / 2; }
    for (let x = x0; x < x1 - .01; x += tw) {
      const xe = Math.min(x1, x + tw), f = g.tier ? (xe - x) / tw : 1; if (!proj(g, x + wob, H, o.z)) continue; const ax = PX, ay = PY; proj(g, xe + wob, 0, o.z); const w = PX - ax, h = PY - ay, sw = P.wall.width * f;
      ctx.drawImage(P.wall, 0, 0, sw, P.wall.height, ax, ay, w, h);
      if (crack && g.tier) ctx.drawImage(P.wallCrack[crack - 1], 0, 0, sw, P.wall.height, ax, ay, w, h);   // 최저 단계는 금 · 번쩍 없이(넓은 그림을 덜 칠함)
      if (v.hitT > 0 && g.tier) { ctx.globalAlpha = .4; ctx.drawImage(P.wallW, 0, 0, sw, P.wall.height, ax, ay, w, h); ctx.globalAlpha = 1; }
    }
  }
  if (big && proj(g, bx, H * .5, o.z)) { const hit = v.hitT > 0; drawNum(g, 'wall', ns(Math.ceil(o.hp)), PX + (hit ? rr(-.06, .06) * PS : 0), PY, Math.min(2, PS / (13 * g.S2)) * (hit ? 1.1 : 1)); }
}
// v13.242 적 무리: 빨간 정령(품질별 최대 14 · 24 · 36 · 50마리) 해바라기 대형 · 통통 뛰며 달려옴 · 머리 위 빨간 숫자 배지. 적 대장은 큰 정령 하나 + 무리.
const FOE_DRAW = [12, 28, 40, 56];
function drawFoe(g, o, dt, alpha) {
  if (o.done) return;   // 싸우는 동안은 1.4단위 앞에 그려 내 무리에 가리지 않게(연출만)
  const ctx = g.ctx, P = g.SPR, S = g.S, moving = o.on && S.clash !== o, z = o.on ? o.pz + (moving ? RUNNER.FOE_SPEED * RUNNER.DT * (1 - alpha) : 1.4) : o.z, n = Math.min(Math.max(6, Math.ceil(o.hp)), FOE_DRAW[g.tier]), t = g.clock, v = vw(g, o);
  if (v.hitT > 0) v.hitT -= dt;
  const Rf = foeR(o.hp), spread = Rf / crowdR(Math.min(150, o.hp)) * 1.35, sz0 = g.spiritU * 1.75, fight = S.clash === o;   // 적 정령은 조금 크게(멀리서도 붉은 무리가 읽히게)
  if (g.tier && proj(g, o.x, 0, z)) { const w = (Rf * 2 + .6) * PS; ctx.globalAlpha = .5; ctx.drawImage(P.shadow, PX - w / 2, PY - w * .14, w, w * .32); ctx.globalAlpha = 1; }
  if (g.T.glow && o.on && proj(g, o.x, .6, z)) { const w = (Rf * 2.4 + 1) * PS; ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = .28 + .1 * Math.sin(t * 7); ctx.drawImage(g.tg.foeGlow, PX - w / 2, PY - w * .5, w, w); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; }
  for (let oi = DRAW_MAX - 1; oi >= 0; oi--) {
    const i = ORDER[oi]; if (i >= n) continue;
    const hop = Math.abs(Math.sin(t * (fight ? 16 : HF[i]) + PH[i])) * (fight ? .35 : HA[i]), jx = fight ? rr(-.08, .08) : 0;
    if (!proj(g, o.x + TOX[i] * spread + jx, hop, z - TOZ[i] * spread)) continue;
    const sz = sz0 * PS, im = v.hitT > 0 && i % 3 === 0 ? P.foeHit : P.foe; ctx.drawImage(im, PX - sz / 2, PY - sz, sz, sz);
  }
  if (o.boss && proj(g, o.x, Math.abs(Math.sin(t * 5)) * .3, z - Rf - .3)) { const w = 2.2 * PS; ctx.drawImage(P.foeBoss, PX - w / 2, PY - w, w, w); }
  // 다가오는 동안: 발밑 붉은 고리(숨 쉬듯) + 큰 숫자 배지 → 1~2초 전부터 "빨간 무리가 온다"가 읽힌다
  if (o.on && !fight && g.tier && proj(g, o.x, .05, z)) { const w = (Rf * 2.2 + .8) * PS * (1 + .06 * Math.sin(t * 10)); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = .8; ctx.drawImage(tint(g, 'ring', '255,90,90'), PX - w / 2, PY - w * .18, w, w * .36); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; }
  if (proj(g, o.x, 1.9 + Rf * .35, z)) {
    const str = ns(Math.ceil(o.hp)), sc = Math.min(1.5, PS / ((o.on ? 13 : 17) * g.S2)), A = P.digits.foe, w = A.adv * str.length * sc + 26 * g.S2 * sc, h = A.ch * sc * .9;
    ctx.fillStyle = 'rgba(90,10,20,.82)'; roundRect(ctx, PX - w / 2, PY - h / 2, w, h, h / 2); ctx.fill(); ctx.lineWidth = 2 * g.S2; ctx.strokeStyle = '#ff9a9a'; ctx.stroke();
    ctx.drawImage(P.foe, PX - w / 2 + 4 * g.S2 * sc, PY - h * .42, h * .84, h * .84); drawNum(g, 'foe', str, PX + 10 * g.S2 * sc, PY, sc);
  }
}
// v13.242 불기둥: 바닥 구멍(늘) → 솟기 0.6주기 전부터 경고 빛 → 솟는 동안 기둥(그림 74 fire-pillar)이 늘어났다 줄어듦
function drawPillar(g, o, t) {
  const ctx = g.ctx, P = g.SPR; if (!proj(g, o.x, 0, o.z)) return;
  const w = 2.2 * PS; ctx.drawImage(P.vent, PX - w / 2, PY - w * .25, w, w * .5);
  if (o.stop) return;
  const ph = (t / o.per + o.ph) % 1, ph1 = ph < 0 ? ph + 1 : ph;
  if (ph1 > .7) warn(g, o.x, o.z, 1.4, (ph1 - .7) / .3);
  if (ph1 < .18 || ph1 > .94) {
    const p = ph1 > .94 ? (ph1 - .94) / .06 * .3 : ph1 < .04 ? .3 + ph1 / .04 * .7 : ph1 > .14 ? (.18 - ph1) / .04 : 1, h = 6.5 * PS * p, pw = 1.6 * PS * (.8 + .2 * Math.sin(g.clock * 30));
    ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = .9; ctx.drawImage(P.pillar, PX - pw / 2, PY - h, pw, h);
    if (g.T.glow) { const gw = 3 * PS; ctx.globalAlpha = .5 * p; ctx.drawImage(g.tg.lava, PX - gw / 2, PY - gw * .7, gw, gw); }
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    if (rnd() < .3 * g.T.mult) addGlow(g, o.x + rr(-.4, .4), rr(.5, 4) * p, o.z, 1, 0, 2, .5, .5, 4);
  }
}
// v13.242 바닥 장애물(길 위, 물체보다 먼저): 얼음 미끄럼 판(z ~ z+len, 길 전체) · 모래 소용돌이(돌아감)
function drawFloor(g) {
  const ctx = g.ctx, S = g.S, cam = g.cam, P = g.SPR, ROAD = RUNNER.ROAD;
  for (let i = S.lo; i < S.items.length; i++) {
    const o = S.items[i]; if (o.z > cam.z + 95) break;
    if (o.type === 'slide') {
      const z0 = Math.max(o.z, cam.z + 1), z1 = o.z + o.len; if (z1 <= z0) continue;
      if (!proj(g, -ROAD, 0, z1)) continue; const ax = PX, ay = PY; proj(g, ROAD, 0, z1); const bx = PX; proj(g, ROAD, 0, z0); const cxp = PX, cy = PY; proj(g, -ROAD, 0, z0);
      ctx.globalAlpha = .85; const steps = 6;   // 원근 띠 6장(가까울수록 넓게)
      for (let k = 0; k < steps; k++) { const f0 = k / steps, f1 = (k + 1) / steps, y0 = ay + (cy - ay) * f0, y1 = ay + (cy - ay) * f1, l0 = ax + (PX - ax) * f0, r0 = bx + (cxp - bx) * f0, l1 = ax + (PX - ax) * f1, r1 = bx + (cxp - bx) * f1; ctx.drawImage(P.slide, 0, P.slide.height * f0, P.slide.width, P.slide.height / steps, Math.min(l0, l1), y0, Math.max(r0, r1) - Math.min(l0, l1), y1 - y0 + 1); }
      ctx.globalAlpha = 1;
    } else if (o.type === 'whirl') {
      if (o.z < cam.z + 1 || !proj(g, o.x, 0, o.z)) continue; const w = 3.4 * PS;
      ctx.save(); ctx.translate(PX, PY); ctx.scale(1, .42); ctx.rotate(o.stop ? 0 : -g.clock * 3.2); ctx.drawImage(P.whirl, -w / 2, -w / 2, w, w); ctx.restore();
      if (!o.stop && o.z - S.z < 40 && rnd() < .12 * g.T.mult) addSmoke(g, o.x + rr(-1, 1), .2, o.z, 1, 2, .7, .3);
    }
  }
}
function drawCastle(g, dt) {
  const ctx = g.ctx, c = g.S.castle, P = g.SPR; if (c.down) return drawPieces(g, dt);
  if (!proj(g, 0, 0, c.z)) return; const w = 10 * PS, wob = g.castleHitT > 0 ? rr(-.05, .05) * PS : 0;
  ctx.drawImage(P.castle, PX - w / 2 + wob, PY - w, w, w);
  if (g.castleHitT > 0) { g.castleHitT -= dt; ctx.globalAlpha = .35; ctx.drawImage(P.castleW, PX - w / 2 + wob, PY - w, w, w); ctx.globalAlpha = 1; }
  proj(g, 0, 11.4, c.z); const bw = 6 * PS, bh = .55 * PS, p = c.hp / c.max;
  ctx.fillStyle = 'rgba(16,20,40,.8)'; roundRect(ctx, PX - bw / 2 - 3, PY - 3, bw + 6, bh + 6, bh / 2 + 3); ctx.fill();
  ctx.fillStyle = p > .5 ? '#6dea7a' : p > .25 ? '#ffd257' : '#ff6262'; roundRect(ctx, PX - bw / 2, PY, Math.max(bh, bw * p), bh, bh / 2); ctx.fill();
  drawNum(g, 'count', ns(Math.ceil(c.hp)), PX, PY + bh / 2, Math.min(1.1, PS / (15 * g.S2)));
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
  // 피버: 무리 아래 금빛 숨(더하기). 그림 75 fever-aura가 있으면 그 그림.
  if (g.feverOn && g.T.glow && proj(g, cx, .5, z)) { const w = (Rr * 2.8 + 1.5) * PS * (1 + .08 * Math.sin(t * 9)); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = .55; ctx.drawImage(g.tg.aura, PX - w / 2, PY - w * .55, w, w); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; }
  if (g.cheerT > 0) g.cheerT -= dt;
  // 대형: 숨 쉬듯 퍼졌다 모이고(breath), 좌우로 움직이면 뒤쪽이 늦게 따라온다(lag). 맨 앞줄(앞 30%)은 조금 크게 · 테두리 빛.
  const spring = 1 - Math.exp(-dt * 7), spr = P.spirit, breath = 1 + Math.sin(t * 1.7) * .06 + (run ? 0 : -.04), lag = -g.vx * .035, front = Math.sqrt(Math.max(1, g.shown)) * .22 * .85 * .55;
  for (let oi = 0; oi < DRAW_MAX; oi++) {
    const i = ORDER[oi]; if (i >= g.shown) continue;
    const back = 1.4 - TOZ[i] / 3;
    sl.ox[i] += (TOX[i] * breath + lag * back - sl.ox[i]) * spring; sl.oz[i] += (TOZ[i] * breath - sl.oz[i]) * spring; if (sl.pop[i] < 1) sl.pop[i] = Math.min(1, sl.pop[i] + dt * 3.5);
    const hop = g.cheerT > 0 ? Math.abs(Math.sin(t * 13 + PH[i])) * .6 * Math.min(1, g.cheerT) : run ? Math.abs(Math.sin(t * HF[i] + PH[i])) * HA[i] * (g.feverOn ? 1.4 : 1) : Math.abs(Math.sin(t * 4 + PH[i])) * .1;
    if (g.T.shadows && proj(g, cx + sl.ox[i], 0, z + sl.oz[i])) { const sw = g.spiritU * .95 * PS * (1 - hop * .9); ctx.globalAlpha = .45; ctx.drawImage(P.shadow, PX - sw / 2, PY - sw * .16, sw, sw * .32); ctx.globalAlpha = 1; }
    if (!proj(g, cx + sl.ox[i], hop, z + sl.oz[i])) continue;
    const lead = TOZ[i] > front, pp = sl.pop[i], sz = g.spiritU * PS * (pp < 1 ? easeOut(pp) * 1.15 : 1) * (lead ? 1.1 : 1), sq = run ? 1 + Math.sin(t * HF[i] * 2 + PH[i]) * .07 : 1;
    ctx.drawImage(g.cheerT > 0 && P.spiritCheer ? P.spiritCheer : spr, PX - sz / 2, PY - sz * sq, sz, sz * sq);
    if (g.feverOn && g.T.rim && (i & 3) === 0) { ctx.globalAlpha = .22 + .12 * Math.sin(t * 12 + PH[i]); ctx.drawImage(P.spiritW, PX - sz / 2, PY - sz * sq, sz, sz * sq); ctx.globalAlpha = 1; }
    else if (lead && g.T.rim) { ctx.globalAlpha = .16 + .08 * Math.sin(t * 6 + PH[i]); ctx.drawImage(P.spiritW, PX - sz / 2, PY - sz * sq, sz, sz * sq); ctx.globalAlpha = 1; }
  }
  // 구한 펫: 하늘에서 무리 앞으로 내려앉는다(0.35초) → 착지 충격파
  let drop = 0; const L = g.petLand;
  if (L) { L.t += dt; const p = Math.min(1, L.t / .35); drop = (1 - p * p) * 7; if (p >= 1 && !L.hit) { L.hit = true; petImpact(g, cx + (siege ? -1.9 : Rr * .55), z + Rr * .5 + .6); } if (L.t > 1) g.petLand = null; }
  if (S.petOn && P.pet && (!L || L.t > 0) && proj(g, cx + (siege ? -1.9 : Rr * .55), drop + Math.abs(Math.sin(t * 8)) * .25, z + Rr * .5 + .6)) { const w = 2.5 * PS, h = w * P.pet.height / P.pet.width; ctx.drawImage(P.pet, PX - w / 2, PY - h, w, h); }
  if (proj(g, cx, 1.9 + Rr * .35, z + Rr * .3)) {
    const str = ns(S.n), sc = Math.min(1.3, PS / (17 * g.S2)), A = P.digits.count, w = A.adv * str.length * sc + 26 * g.S2 * sc, h = A.ch * sc * .9;
    ctx.fillStyle = 'rgba(16,40,90,.78)'; roundRect(ctx, PX - w / 2, PY - h / 2, w, h, h / 2); ctx.fill(); ctx.lineWidth = 2 * g.S2; ctx.strokeStyle = '#9fe1ff'; ctx.stroke();
    ctx.drawImage(spr, PX - w / 2 + 4 * g.S2 * sc, PY - h * .42, h * .84, h * .84); drawNum(g, 'count', str, PX + 10 * g.S2 * sc, PY, sc);
  }
}
const DEB = [['rock-a', 'rock-b'], ['shard'], ['chunk-a', 'chunk-b'], ['wchunk']], PUFF = [['dust', '235,225,205'], ['smoke', '255,255,255'], ['dust', '200,185,160'], ['smoke', '120,110,130']], SPARK = ['#ffffff', '#ffe066', '#ff8a3a', '#8fe0ff'];
const GLOW = [['ember', '255,190,90'], ['flame', '255,255,255'], ['stardust', '255,255,255'], ['star', '255,255,255'], ['ember', '120,220,255']];
const ADJ = { glow: [.55, .8], burst: [.8, .9], ring: [.85, 1], ember: [1, 3.2], stardust: [.9, 1.3], star: [.85, 1] };
const ONE = [1, 1], adj = (g, k) => g.matArt.has(k) ? ADJ[k] || ONE : ONE;
function drawDebris(g, dt) {
  const D = g.pools.D, ctx = g.ctx;
  for (let j = D.n - 1; j >= 0; j--) { D.life[j] -= dt; if (D.life[j] <= 0) { swapOut(D, j); continue; } if (dt) { D.vy[j] -= 22 * dt; D.x[j] += D.vx[j] * dt; D.y[j] += D.vy[j] * dt; D.z[j] += D.vz[j] * dt; D.rot[j] += D.vr[j] * dt; if (D.y[j] < 0) { D.y[j] = 0; D.vy[j] *= -.3; D.vx[j] *= .6; D.vz[j] *= .6; D.vr[j] *= .5; } } }
  for (let j = 0; j < D.n; j++) { if (!proj(g, D.x[j], D.y[j], D.z[j])) continue; const set = DEB[D.kind[j]], im = g.mat[set[j % set.length]], s = D.size[j] * PS, c = Math.cos(D.rot[j]), sn = Math.sin(D.rot[j]), iw = s / im.width; ctx.globalAlpha = Math.min(1, D.life[j] / .3); ctx.setTransform(c * iw, sn * iw, -sn * iw, c * iw, PX, PY); ctx.drawImage(im, -im.width / 2, -im.height / 2); }
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1;
}
function drawSmoke(g, dt) {
  const M = g.pools.M, ctx = g.ctx;
  for (let j = M.n - 1; j >= 0; j--) { M.life[j] -= dt; if (M.life[j] <= 0) { swapOut(M, j); continue; } M.x[j] += M.vx[j] * dt; M.y[j] += M.vy[j] * dt; M.z[j] += M.vz[j] * dt; M.vx[j] *= 1 - dt * 1.5; M.vz[j] *= 1 - dt * 1.5; M.r[j] += M.vr[j] * dt; M.vr[j] *= 1 - dt * .8; }
  for (let j = 0; j < M.n; j++) { if (!proj(g, M.x[j], M.y[j], M.z[j])) continue; const p = 1 - M.life[j] / M.max[j], a = M.a[j] * (p < .15 ? p / .15 : 1 - (p - .15) / .85), r = M.r[j] * PS, PF = PUFF[M.kind[j]], k = PF[0], rgb = PF[1]; ctx.globalAlpha = a; ctx.drawImage(tint(g, k, rgb), PX - r, PY - r, r * 2, r * 2); }
  ctx.globalAlpha = 1;
}
function drawFlyers(g, dt) {
  const F = g.pools.F, ctx = g.ctx, c = g.S.castle;
  for (let j = F.n - 1; j >= 0; j--) { F.life[j] -= dt; if (F.life[j] <= 0) { if (F.kind[j] === 1 && !c.down) { g.castleHitT = .06; if (rnd() < .5) addSparks(g, F.x[j], F.y[j], F.z[j], 3, 3, 8, .4); if (rnd() < .25) addSmoke(g, F.x[j], F.y[j], F.z[j], 1, 1, .6, .3); castleHit(g); } swapOut(F, j); continue; } if (dt) { F.vy[j] -= (F.kind[j] ? 15.7 : 18) * dt; F.x[j] += F.vx[j] * dt; F.y[j] += F.vy[j] * dt; F.z[j] += F.vz[j] * dt; F.rot[j] += F.vr[j] * dt; } }
  const spr = g.SPR.spirit;
  // 빛 꼬리(대포 정령 · 합류 정령): 진행 반대쪽에 흐린 빛 두 점(품질 중간 이상)
  if (g.T.trail) { ctx.globalCompositeOperation = 'lighter'; const gl = g.tg.trail; for (let j = 0; j < F.n; j++) { if (F.kind[j] !== 1 && F.kind[j] !== 2) continue; for (let k = 1; k <= 2; k++) { if (!proj(g, F.x[j] - F.vx[j] * .03 * k, F.y[j] - F.vy[j] * .03 * k, F.z[j] - F.vz[j] * .03 * k)) continue; const s = (.9 - k * .2) * PS; ctx.globalAlpha = .5 / k; ctx.drawImage(gl, PX - s / 2, PY - s / 2, s, s); } } ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; }
  for (let j = 0; j < F.n; j++) { if (!proj(g, F.x[j], F.y[j], F.z[j])) continue; const sz = g.spiritU * PS, a = F.kind[j] === 1 || F.kind[j] === 2 ? 1 : Math.min(1, F.life[j] / F.max[j] * 1.5), cc = Math.cos(F.rot[j]), sn = Math.sin(F.rot[j]), iw = sz / spr.width; ctx.globalAlpha = a; ctx.setTransform(cc * iw, sn * iw, -sn * iw, cc * iw, PX, PY); ctx.drawImage(F.kind[j] === 3 ? g.SPR.foeDown : F.kind[j] ? g.SPR.spiritFly : g.SPR.spiritHurt, -spr.width / 2, -spr.height / 2); }
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1;
}
function drawBullets(g, dt) {
  const B = g.pools.B, ctx = g.ctx;
  for (let j = B.n - 1; j >= 0; j--) { B.life[j] -= dt; if (B.life[j] <= 0) { addSparks(g, B.x[j], B.y[j], B.z[j], 2, 1, 7, .3); swapOut(B, j); continue; } B.x[j] += B.vx[j] * dt; B.y[j] += B.vy[j] * dt; B.z[j] += B.vz[j] * dt; }
  if (!B.n) return;
  ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round'; ctx.strokeStyle = g.feverOn ? '#ffe27a' : '#bff0ff'; ctx.lineWidth = (g.feverOn ? 3 : 2.2) * g.S2; ctx.beginPath();
  const tl = g.T.trail ? .06 : .035;
  for (let j = 0; j < B.n; j++) { if (!proj(g, B.x[j], B.y[j], B.z[j])) continue; const x1 = PX, y1 = PY; if (!proj(g, B.x[j] - B.vx[j] * tl, B.y[j] - B.vy[j] * tl, B.z[j] - B.vz[j] * tl)) continue; ctx.moveTo(x1, y1); ctx.lineTo(PX, PY); }
  ctx.stroke();
  if (g.T.trail) { const gl = g.tg.crystal; ctx.globalAlpha = .8; for (let j = 0; j < B.n; j++) { if (!proj(g, B.x[j], B.y[j], B.z[j])) continue; const s = .55 * PS; ctx.drawImage(gl, PX - s / 2, PY - s / 2, s, s); } ctx.globalAlpha = 1; }
  ctx.globalCompositeOperation = 'source-over';
}
function drawGlows(g, dt) {
  const Q = g.pools.Gl, ctx = g.ctx;
  for (let j = Q.n - 1; j >= 0; j--) { Q.life[j] -= dt; if (Q.life[j] <= 0) { swapOut(Q, j); continue; } Q.x[j] += Q.vx[j] * dt; Q.y[j] += Q.vy[j] * dt + Q.up[j] * dt; Q.z[j] += Q.vz[j] * dt; Q.vx[j] *= 1 - dt * 2; Q.vz[j] *= 1 - dt * 2; }
  if (!Q.n) return;
  ctx.globalCompositeOperation = 'lighter';
  for (let j = 0; j < Q.n; j++) { if (!proj(g, Q.x[j], Q.y[j], Q.z[j])) continue; const GK = GLOW[Q.kind[j]], k = GK[0], rgb = GK[1], im = rgb === '255,255,255' ? g.mat[k] : tint(g, k, rgb), p = Q.life[j] / Q.max[j], AJ = adj(g, k), ga = AJ[0], gs = AJ[1], s = Q.size[j] * gs * PS * (Q.kind[j] === 1 ? .6 + p * .6 : 1); ctx.globalAlpha = Math.min(1, p * 2) * ga; ctx.drawImage(im, PX - s / 2, PY - s / 2, s, s); }
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
  for (let i = g.rings.length - 1; i >= 0; i--) { const r = g.rings[i]; r.t += dt; if (r.t >= r.dur) { cut(g.rings, i); continue; } if (r.t < 0 || !proj(g, r.x, r.y, r.z)) continue; const p = r.t / r.dur, a = (1 - p) * (1 - p), Rr = r.r1 * easeOut(p) * PS;
    if (g.T.glow) { ctx.globalAlpha = a * adj(g, 'ring')[0]; const s = Rr * 2 * (256 / 208); ctx.drawImage(r.img, PX - s / 2, PY - s * .2, s, s * .4); ctx.globalAlpha = 1; } else { ctx.globalAlpha = a; ctx.strokeStyle = r.css; ctx.lineWidth = 2 * g.S2; ctx.beginPath(); ctx.ellipse(PX, PY, Rr, Rr * .35, 0, 0, TAU); ctx.stroke(); ctx.globalAlpha = 1; } }
  ctx.globalCompositeOperation = 'source-over';
}
function drawFlashes(g, dt) {
  const ctx = g.ctx; ctx.globalCompositeOperation = 'lighter';
  for (let i = g.flashes.length - 1; i >= 0; i--) { const f = g.flashes[i]; f.t += dt; if (f.t >= f.dur) { cut(g.flashes, i); continue; } if (!proj(g, f.x, f.y, f.z)) continue; const AJ = adj(g, f.k), ga = AJ[0], gs = AJ[1], p = f.t / f.dur, a = (p < .1 ? 1 : 1 - (p - .1) / .9) * ga, r = f.r * gs * (.6 + .4 * easeOut(p)) * PS, im = f.img; ctx.globalAlpha = a; ctx.drawImage(im, PX - r, PY - r, r * 2, r * 2); }
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
}
function drawPops(g, dt) { for (let i = g.pops.length - 1; i >= 0; i--) { const n = g.pops[i]; n.t += dt; if (n.t > 1.1) { cut(g.pops, i); continue; } if (!proj(g, n.x, n.y + easeOut(Math.min(1, n.t / .6)) * 1.2, n.z)) continue; const pop = n.t < .1 ? 1.8 - 8 * n.t : 1, a = n.t > .8 ? (1.1 - n.t) / .3 : 1; drawNum(g, n.style, n.str, PX, PY, pop * Math.min(1.5, PS / (15 * g.S2) + .4), a); } }
function drawBanner(g, dt) {
  const b = g.banner; if (!b) return; b.t += dt; if (b.t > b.dur) { g.banner = null; return; }
  const s = b.spr, a = b.t > b.dur - .2 ? (b.dur - b.t) / .2 : 1, sc = b.t < .12 ? .6 + b.t / .12 * .4 : 1;
  g.ctx.globalAlpha = a; g.ctx.drawImage(s.c, g.cvs.width / 2 - s.w * sc / 2, 96 * g.S2 - s.h * sc / 2, s.w * sc, s.h * sc); g.ctx.globalAlpha = 1;
}
function drawCutin(g, dt) {
  const c = g.cutin; if (!c) return; c.t += dt; if (c.t > c.dur) { g.cutin = null; return; }
  const ctx = g.ctx, W = g.cvs.width, H = g.cvs.height, S = g.S2, t = c.t / c.dur, cy = H * .4, bh = Math.min(H * .26, 240 * S), open = t < .15 ? easeOut(t / .15) : t > .85 ? 1 - (t - .85) / .15 : 1;
  ctx.save(); ctx.translate(W / 2, cy); ctx.rotate(-.12); ctx.scale(1, open);
  ctx.fillStyle = 'rgba(12,10,30,.92)'; ctx.fillRect(-W, -bh / 2, W * 2, bh); ctx.fillStyle = `rgb(${EL_RGB[c.el] || EL_RGB.star})`; ctx.fillRect(-W, -bh / 2, W * 2, 4 * S); ctx.fillRect(-W, bh / 2 - 4 * S, W * 2, 4 * S);
  ctx.globalCompositeOperation = 'lighter'; const sp = c.sp;
  for (let i = 0; i < g.T.cutLines; i++) { const yy = (-.45 + .9 * ((i * .618) % 1)) * bh, len = W * (.5 + ((i * .37) % .5)), xx = W * .9 - ((c.t * 2.6 * W + i * 97 * S) % (W * 2.2)); ctx.globalAlpha = .55; ctx.drawImage(sp, xx, yy - 10 * S, len, 22 * S); }
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  const big = g.SPR.petBig; if (big) { const bw = g.SPR.petBigW || big.width, slide = t < .3 ? 1 - easeOut(t / .3) : t > .7 ? -easeOut((t - .7) / .3) : 0; ctx.drawImage(big, slide * W * .9 + bw * .15 - bw / 2, -bw * .55, bw, bw * big.height / big.width); }
  const s1 = c.s1, s2 = c.s2, sc = t < .25 ? 1.6 - t / .25 * .6 : 1;
  ctx.drawImage(s1.c, -W * .2 - s1.w * sc / 2, -bh * .2 - s1.h * sc / 2, s1.w * sc, s1.h * sc); ctx.drawImage(s2.c, -W * .14 - s2.w * sc * .4, bh * .2 - s2.h * sc * .4, s2.w * sc * .8, s2.h * sc * .8);
  ctx.restore();
}
export const RUNNER_SOUND_EVENTS = SND_EVENTS;
