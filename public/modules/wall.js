import { api, esc, num, icon, toast, buttonBusy } from './ui.js';
import { avatar } from './character.js';
import { coin } from './emblems.js';
import { playSound, unlockSound, soundOn, preloadSound } from './sound.js';
import { coinShower, countUp } from './celebrate.js';
import { WALL, WALL_KINDS, dealWalls, gradeWalls, passPoints, stageOf, comboMult } from './wall-rules.js';

// V13.222 벽 통과(놀이터 미니게임): 전체 화면. 게임쇼 무대 위 내 펫, 멀리 아치에서 구멍 4개 뚫린 벽이 원근으로 다가온다.
// 맞는 단어 구멍을 누르면 펫이 그 구멍으로 뛰어들고 벽이 펫을 감싸며 지나간다(통과). 틀리거나 시간이 다 되면 벽에 쾅 →
// 뒤(화면 아래)의 풀장으로 날아가 풍덩, 오리 튜브를 끼고 둥둥. 5장마다 단계가 올라 무대 조명이 바뀌고 빨라진다.
// 그림은 주문서 64(public/assets/wall/), 진행자는 '삑삑 심판' 펭귄. 판 · 채점 · 보상은 서버(server/wall.mjs).
// 클래스는 wl-.

// 벽 그림(768px, 세 벽 같은 자리)의 구멍 · 단어 판 자리(그림 크기의 %, DONE_64.md 실측).
export const HOLES = [
  { x: 28.96, y: 33.40, w: 27.34, h: 26.07 },
  { x: 72.85, y: 33.54, w: 26.86, h: 26.76 },
  { x: 32.96, y: 73.49, w: 31.64, h: 26.76 },
  { x: 69.14, y: 71.88, w: 27.64, h: 26.27 }
];
export const PLATES = [{ x: 30, y: 14 }, { x: 70, y: 14 }, { x: 30, y: 52.5 }, { x: 70, y: 52.5 }];
export const PLATE_W = 29;
// 무대 그림(세로)의 경계(화면 높이의 %): 아치 밑 16, 바닥 끝(노란 띠 위) 60, 풀장 68~.
// 벽이 처음 나오는 곳(ARCH)은 아치 밑보다 조금 아래: 문제 띠에 가리지 않게.
export const STAGE = { ARCH: 25, FLOOR: 60, POOL: 84 };
const START_SCALE = 0.2;    // 처음 보이는 벽 크기
const RUSH_MS = 380;        // 고른 뒤 벽이 펫에게 닿기까지
const KEYS = ['1', '2', '3', '4'];
const CHEERS = ['', '', '', '좋아!', '멋져!', '대단해!', '최고야!', '완벽해!', '굉장해!', '전설이야!'];
const REF_LINES = {
  ready: ['준비됐어?', '벽이 온다!', '집중!'],
  pass: ['통과!', '나이스!', '깔끔해!', '좋았어!'],
  splash: ['풍덩~!', '앗 차가워!', '괜찮아, 다시!', '아깝다!'],
  fever: ['피버 타임!', '불타오른다!', '멈추지 마!']
};

let W = null;
const root = () => document.getElementById('app');
const $ = id => document.getElementById(id);
let REDUCED = null;
const reduced = () => (REDUCED ||= matchMedia('(prefers-reduced-motion: reduce)')).matches;
const sfx = (key, opts) => { if (soundOn()) playSound(key, opts); };
const buzz = p => { try { if (soundOn()) navigator.vibrate?.(p); } catch {} };
const pickOne = list => list[Math.floor(Math.random() * list.length)];
function later(fn, ms) { const cur = W; const t = setTimeout(() => { if (W === cur && !cur.closing) fn(); }, ms); cur.timers.push(t); }
const wait = ms => new Promise(res => later(res, reduced() ? Math.min(ms, 250) : ms));
const restart = (el, cls) => { if (!el) return; el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); };
const art = name => `/assets/wall/${name}.webp`;
const img = (name, cls = '', extra = '') => `<img class="${cls}" src="${art(name)}" alt="" draggable="false" decoding="async"${extra}>`;

// 헷갈린 단어는 이 폰에 기억했다가 다음 판에 먼저 낸다(서버가 판을 만들 때 먼저 넣는다).
const MISS_KEY = () => `sumus-wall-missed:${W?.A?.data?.profile?.id || ''}`;
const loadMissed = () => { try { return JSON.parse(localStorage.getItem(MISS_KEY()) || '[]').slice(0, WALL.MISSED_MAX); } catch { return []; } };
const saveMissed = ids => { try { localStorage.setItem(MISS_KEY(), JSON.stringify([...new Set(ids.map(String))].slice(0, WALL.MISSED_MAX))); } catch {} };

// opts: { words: 고른 범위의 단어들, codes: 범위 번호, label: '24~25번' }
export function openWallGame(A, exit, opts = {}) {
  closeAll();
  W = { A, exit, timers: [], words: opts.words || [], codes: opts.codes || [], label: opts.label || '', view: A.data.rewards?.wall || null };
  A.screen = 'wall';
  root().innerHTML = `<div class="session-app wl-app" id="wl-app">
    <div class="wl-stage" id="wl-stage">
      <img class="wl-bg on" id="wl-bg-a" src="${art('bg-1')}" alt="" draggable="false"><img class="wl-bg" id="wl-bg-b" alt="" draggable="false">
      <div class="wl-lights" aria-hidden="true">${img('fx-light', 'l1')}${img('fx-light', 'l2')}</div>
      <div class="wl-wallbox" id="wl-wallbox" aria-hidden="true"></div>
      <div class="wl-pet" id="wl-pet"><span class="wl-tube back">${img('tube-back')}</span><span class="wl-pet-art" id="wl-pet-art"></span><span class="wl-water">${img('water-front')}</span><span class="wl-tube front">${img('tube-front')}</span></div>
      <div class="wl-ref" id="wl-ref" aria-hidden="true">${img('ref-ready', '', ' id="wl-ref-img"')}<span class="wl-bubble" id="wl-ref-say"></span></div>
      <div class="wl-fx" id="wl-fx" aria-hidden="true"></div>
    </div>
    <div class="wl-edge" aria-hidden="true"></div><div class="wl-flash" id="wl-flash" aria-hidden="true"></div>
    <header class="wl-top"><button type="button" class="yb-back" data-wl="exit" aria-label="나가기">${icon('back')}</button><strong>벽 통과</strong><span class="wl-hud" id="wl-hud"></span><span class="wl-wallet">${coin()}<b id="wl-coins">${num(A.data.stats?.points_balance || 0)}</b></span></header>
    <main class="wl-main" id="wl-main"></main>
  </div>`;
  root().onclick = onClick;
  root().onpointerdown = onPointer;
  W.keys = onKey;
  W.vis = onVisibility;
  document.addEventListener('keydown', W.keys);
  document.addEventListener('visibilitychange', W.vis);
  window.scrollTo(0, 0);
  preloadSound(['tm-count', 'tm-go', 'swoosh', 'clear', 'combo-10', 'reel-splash', 'fail', 'warn-beep', 'boss-slam', 'ult-riser', 'stamp', 'fanfare-basic', 'fanfare-epic', 'tm-record', 'coins', 'type-ok', 'crit']);
  // 그림은 처음에 다 받아 둔다(벽이 다가오는 중에 그림이 늦게 뜨지 않게).
  W.preload = ['bg-2', 'bg-3', 'wall-1', 'wall-2', 'wall-3', 'fx-splash', 'fx-ripple', 'fx-drops', 'fx-pass', 'fx-combo', 'fx-impact', 'fx-dust', 'heart', 'heart-broken', 'badge-stage', 'ribbon-record', 'siren', 'ref-pass', 'ref-splash', 'ref-fever', 'fx-confetti', 'fx-sparkle', 'podium']
    .map(n => { const i = new Image(); i.decoding = 'async'; i.src = art(n); return i; });
  setPet('normal');
  intro();
}
function closeAll() {
  if (!W) return;
  W.closing = true;
  W.timers.forEach(clearTimeout);
  cancelAnimationFrame(W.raf);
  if (W.keys) document.removeEventListener('keydown', W.keys);
  if (W.vis) document.removeEventListener('visibilitychange', W.vis);
}
async function leave() {
  const exit = W?.exit;
  closeAll();
  root().onclick = null; root().onpointerdown = null;
  W = null;
  await exit?.();
}
const main = html => { const el = $('wl-main'); if (el) el.innerHTML = html; };
const app = () => $('wl-app');

/* ---------- 입력 ---------- */
// 구멍은 손가락이 닿는 순간(pointerdown) 고른다. 키보드는 1 · 2 · 3 · 4, Enter · Space는 click(detail 0).
function onPointer(event) {
  const b = event.target.closest('[data-wl="pick"]');
  if (!b || !W || event.button > 0) return;
  unlockSound();
  choose(Number(b.dataset.i));
}
function onKey(event) {
  if (!W?.asking) return;
  const i = KEYS.indexOf(event.key);
  if (i >= 0) { event.preventDefault(); choose(i); }
}
function onClick(event) {
  const b = event.target.closest('[data-wl]');
  if (!b || b.disabled || !W) return;
  unlockSound();
  const act = b.dataset.wl;
  if (act === 'pick') { if (event.detail === 0) choose(Number(b.dataset.i)); return; }
  if (act === 'exit') return W.playing ? confirmQuit() : leave();
  if (act === 'start') return start(b);
  if (act === 'again') return intro(true);
  if (act === 'quit-yes') return leave();
  if (act === 'quit-no') { document.querySelector('.wl-quit')?.remove(); resume(); return; }
}
function confirmQuit() {
  if (document.querySelector('.wl-quit')) return;
  pause();
  const box = document.createElement('div');
  box.className = 'wl-quit';
  box.innerHTML = '<div><b>그만할까요?</b><p>이번 판은 기록되지 않아요.</p><button type="button" class="btn" data-wl="quit-no">계속하기</button><button type="button" class="btn primary" data-wl="quit-yes">그만하기</button></div>';
  app()?.appendChild(box);
}

/* ---------- 펫 · 심판 ---------- */
const myPet = () => W.A.data.stats?.pet || null;
function setPet(expression = 'normal') {
  const el = $('wl-pet-art'), p = myPet();
  if (!el || el.dataset.expr === expression) return;
  el.dataset.expr = expression;
  el.innerHTML = p ? avatar(p.key, { form: Math.max(1, p.form ?? 1), expression }) : '<i class="wl-pet-dot"></i>';
}
function refSay(kind, text = pickOne(REF_LINES[kind])) {
  const im = $('wl-ref-img'), say = $('wl-ref-say');
  if (!im || !say) return;
  im.src = art(`ref-${kind}`);
  say.textContent = text;
  restart($('wl-ref'), 'talk');
  clearTimeout(W.refT);
  W.refT = setTimeout(() => { $('wl-ref')?.classList.remove('talk'); }, 1500);
}

/* ---------- 시작 화면 ---------- */
function intro(again = false) {
  W.playing = false; W.asking = false;
  cancelAnimationFrame(W.raf);
  W.g = geo();
  const a = app(); a?.classList.remove('fever', 'playing', 'stage-2', 'stage-3');
  setBg(0, true);
  $('wl-wallbox').innerHTML = '';
  $('wl-fx').innerHTML = '';
  placePet('stand'); setPet('cheer');
  $('wl-hud').innerHTML = '';
  const v = W.view || {};
  const ok = dealWalls(W.words).length > 0;
  refSay('ready', again ? '한 판 더?' : '준비됐어?');
  main(`<section class="wl-intro${again ? ' again' : ''}">
    <div class="wl-title"><small>단어 게임쇼</small><h1>벽 통과</h1></div>
    <div class="wl-card">
      <ul class="wl-rules">
        <li><b>1</b><span>벽이 다가와요. <em>맞는 단어</em> 구멍을 눌러요</span></li>
        <li><b>2</b><span>맞히면 펫이 쏙 <em>통과</em>, 틀리면 <em>풍덩!</em> (목숨 ${WALL.LIVES}개)</span></li>
        <li><b>3</b><span>벽 ${WALL.WALLS}장 · ${WALL.STAGE_EVERY}장마다 <em>더 빨라져요</em> · 연속으로 맞히면 점수 UP</span></li>
      </ul>
      <div class="wl-recs"><div><small>내 최고</small><b>${v.best ? num(v.best) : '—'}</b></div><div><small>오늘 코인 판</small><b>${num(v.left ?? WALL.DAILY)}<small> / ${num(WALL.DAILY)}</small></b></div><div><small>3별</small><b>${coin()}${WALL.COINS[3]}</b></div></div>
      <p class="wl-words">게임 단어 · <b>${esc(W.label || '고른 범위')}</b></p>
      <button type="button" class="yl-cta wl-go" data-wl="start" ${ok ? '' : 'disabled'}>${ok ? '시작!' : '뜻이 서로 다른 단어가 부족해요'}</button>
    </div>
  </section>`);
}

async function start(button) {
  if (!dealWalls(W.words).length) return toast('뜻이 서로 다른 단어가 부족해요. 범위를 더 골라 주세요.');
  buttonBusy(button);
  W.id = null;
  let walls = null;
  try {
    const r = await api('/games/wall/start', { range_codes: W.codes, missed: loadMissed() });
    if (!W) return;
    W.id = r.id; walls = r.walls;
    W.view = { ...W.view, best: r.best, left: r.left };
  } catch (err) {
    if (!W) return;
    buttonBusy(button, false);
    if (!err.transient) return toast(err.message);
    walls = dealWalls(W.words, { missed: loadMissed() }); // 연결이 안 되면 이 폰에서 만든 판으로 기록 없이 연습
    toast('연결이 불안정해서 이번 판은 기록 없이 해요.');
  }
  if (!walls?.length) return toast('판을 만들지 못했어요. 다시 해 주세요.');
  W.prevBest = W.view?.best || 0;
  play(walls);
}

/* ---------- 게임 ---------- */
async function play(walls) {
  Object.assign(W, { walls, i: 0, picks: [], lives: WALL.LIVES, combo: 0, best: 0, score: 0, passes: 0, playing: true, asking: false, t0: Date.now() });
  app()?.classList.add('playing');
  main('<div class="wl-play" id="wl-play"></div>');
  hud();
  // 3 · 2 · 1
  for (const n of ['3', '2', '1']) {
    countdown(n); sfx('tm-count');
    await wait(1000);
    if (!W?.playing) return;
  }
  countdown('GO!'); sfx('tm-go');
  refSay('ready', '벽이 온다!');
  await wait(450);
  next();
}
function countdown(text) {
  const el = document.createElement('div');
  el.className = 'wl-count'; el.textContent = text;
  $('wl-fx')?.appendChild(el);
  later(() => el.remove(), 950);
}
function hud() {
  const hearts = Array.from({ length: WALL.LIVES }, (_, i) => `<img class="wl-heart${i < W.lives ? '' : ' lost'}" src="${art(i < W.lives ? 'heart' : 'heart-broken')}" alt="" draggable="false">`).join('');
  $('wl-hud').innerHTML = `<span class="wl-hearts" aria-label="목숨 ${W.lives}개">${hearts}</span><span class="wl-count-w">벽 <b>${Math.min((W.cur ?? W.i) + 1, WALL.WALLS)}</b>/${WALL.WALLS}</span><span class="wl-score"><b id="wl-score">${num(W.score)}</b>점</span>`;
}
function setBg(stage, now = false) {
  const a = $('wl-bg-a'), b = $('wl-bg-b');
  if (!a || !b) return;
  const want = art(`bg-${stage + 1}`), on = a.classList.contains('on') ? a : b, off = on === a ? b : a;
  if (on.src.endsWith(want)) return;
  if (now) { on.src = want; return; }
  off.src = want; off.classList.add('on'); on.classList.remove('on');
}

// 무대 크기 · 벽이 닿는 자리(px).
function geo() {
  const s = $('wl-stage').getBoundingClientRect();
  const floor = s.height * STAGE.FLOOR / 100, arch = s.height * STAGE.ARCH / 100;
  const size = Math.min(s.width * 0.94, s.height * 0.5, 470);
  return { w: s.width, h: s.height, floor, arch, size, left: (s.width - size) / 2, top: floor - size * 0.975,
    // 원근: 화면 위 지평선(벽 크기가 0이 되는 곳). 처음 크기에서 벽 밑이 아치 밑에 오도록.
    horizon: (arch - floor * START_SCALE) / (1 - START_SCALE) };
}
// 진행(0~1)에 따른 벽 크기: 원근(1/거리, 끝에 확 커짐)과 고르게 커지는 것을 반씩 섞는다.
// 원근만 쓰면 처음 절반은 벽이 너무 작아 단어 판이 안 보이고 끝에 갑자기 덮친다.
const scaleAt = t => {
  const k = Math.max(0, Math.min(1, t));
  const far = 1 / (1 / START_SCALE + (1 - 1 / START_SCALE) * k), even = START_SCALE + (1 - START_SCALE) * k;
  return far * .45 + even * .55;
};
function wallTransform(g, s) {
  const bottom = g.horizon + (g.floor - g.horizon) * s;
  return `translate3d(0, ${(bottom - g.floor).toFixed(1)}px, 0) scale(${s.toFixed(4)})`;
}

function next() {
  if (!W?.playing) return;
  if (W.lives <= 0 || W.i >= WALL.WALLS) return finish();
  const i = W.i, stage = stageOf(i);
  if (i > 0 && i % WALL.STAGE_EVERY === 0 && !W.stageShown?.[stage]) return stageUp(stage);
  W.cur = i;
  const wall = W.walls[i], g = W.g = geo();
  hud();
  const box = $('wl-wallbox');
  box.style.cssText = `left:${g.left}px;top:${g.top}px;width:${g.size}px;height:${g.size}px;--ws:${g.size}px`;
  box.className = `wl-wallbox s${stage + 1}`;
  box.innerHTML = `<div class="wl-wall" id="wl-wall" style="transform:${wallTransform(g, START_SCALE)}">
    <img class="wl-wall-img" src="${art(`wall-${stage + 1}`)}" alt="" draggable="false">
    ${wall.options.map((o, k) => `<span class="wl-plate${o.length > 9 ? ' long' : ''}${o.length > 13 ? ' xlong' : ''}" style="left:${PLATES[k].x}%;top:${PLATES[k].y}%;width:${PLATE_W}%">${esc(o)}</span>`).join('')}
    ${HOLES.map((h, k) => `<span class="wl-hole" data-wl="pick" data-i="${k}" style="left:${h.x}%;top:${h.y}%;width:${h.w}%;height:${h.h}%"></span>`).join('')}
    ${img('fx-dust', 'wl-dust')}
  </div>`;
  const kind = WALL_KINDS[wall.kind] || WALL_KINDS.mean2en;
  $('wl-play').innerHTML = `<div class="wl-q ${wall.kind}" id="wl-q"><small>${kind.label}</small><b class="${wall.prompt.length > 12 ? 'long' : ''}">${esc(wall.prompt)}</b><i class="wl-timebar"><i id="wl-time"></i></i></div>
    <div class="wl-picks" id="wl-picks" role="group" aria-label="구멍 고르기">${wall.options.map((o, k) => `<button type="button" class="wl-pick p${k}" data-wl="pick" data-i="${k}" aria-label="${k + 1}번 ${esc(o)}"><i class="wl-pos" aria-hidden="true"><s></s><s></s><s></s><s></s></i><span class="${o.length > 11 ? 'long' : ''}">${esc(o)}</span></button>`).join('')}</div>`;
  placePet('stand'); setPet('normal');
  restart($('wl-q'), 'in');
  Object.assign(W, { asking: true, lit: false, warned: false, wallStart: performance.now(), pausedAt: null, wallMs: wall.ms });
  sfx('swoosh', { rate: .7, gain: .5 });
  // '그만할까요?' 창이 떠 있는 동안 다음 벽이 나오면 멈춘 채 기다린다(계속하기를 누르면 resume).
  if (document.querySelector('.wl-quit')) { W.pausedAt = performance.now(); return; }
  tick();
}
function tick() {
  cancelAnimationFrame(W.raf);
  const step = now => {
    if (!W?.asking || W.pausedAt != null) return;
    const el = now - W.wallStart, t = el / W.wallMs;
    const wallEl = $('wl-wall');
    if (wallEl) wallEl.style.transform = wallTransform(W.g, scaleAt(t));
    const bar = $('wl-time'); if (bar) bar.style.transform = `scaleX(${Math.max(0, 1 - t).toFixed(3)})`;
    if (!W.lit && el >= WALL.MIN_PICK_MS) { W.lit = true; $('wl-picks')?.classList.add('lit'); $('wl-wallbox')?.classList.add('lit'); }
    if (!W.warned && W.wallMs - el <= 1000) { W.warned = true; sfx('warn-beep'); $('wl-q')?.classList.add('hurry'); }
    if (t >= 1) return choose(-1, W.wallMs);
    W.raf = requestAnimationFrame(step);
  };
  W.raf = requestAnimationFrame(step);
}
function pause() {
  if (!W?.asking || W.pausedAt != null) return;
  W.pausedAt = performance.now();
  cancelAnimationFrame(W.raf);
}
function resume() {
  if (!W?.asking || W.pausedAt == null) return;
  W.wallStart += performance.now() - W.pausedAt;
  W.pausedAt = null;
  tick();
}
// 다른 앱으로 나가면 벽이 멈추고, 돌아오면 3 · 2 · 1 뒤 이어서.
function onVisibility() {
  if (!W?.asking) return;
  if (document.hidden) return pause();
  if (document.querySelector('.wl-quit')) return;
  const cur = W;
  countdown('3');
  setTimeout(() => { if (W === cur) countdown('2'); }, 1000);
  setTimeout(() => { if (W === cur) countdown('1'); }, 2000);
  setTimeout(() => { if (W === cur && !document.hidden) resume(); }, 3000);
}

// 고르기(k: 0~3, -1 = 시간 끝).
async function choose(k, forcedMs = null) {
  if (!W?.asking || W.pausedAt != null) return;
  const el = forcedMs ?? Math.round(performance.now() - W.wallStart);
  if (k >= 0 && el < WALL.MIN_PICK_MS) return; // 구멍이 켜지기 전
  W.asking = false;
  cancelAnimationFrame(W.raf);
  const i = W.i, wall = W.walls[i], ok = k === wall.answer;
  W.picks.push([k, Math.min(W.wallMs, el)]);
  const t = el / W.wallMs;
  $('wl-picks')?.classList.add('done');
  document.querySelector(`.wl-pick.p${k}`)?.classList.add(ok ? 'right' : 'wrong');
  if (!ok) document.querySelector(`.wl-pick.p${wall.answer}`)?.classList.add('answer');
  if (k >= 0) { sfx('swoosh'); buzz(12); }
  // 점수 · 콤보(서버와 같은 셈).
  if (ok) {
    W.combo++; W.best = Math.max(W.best, W.combo); W.passes++;
    const pts = passPoints(el, W.wallMs, W.combo);
    W.score += pts; W.lastPts = pts;
  } else { W.combo = 0; W.lives--; }
  W.i++;
  await rush(k, t);
  $('wl-picks')?.classList.add('away'); // 펫이 풀장(화면 아래)으로 날아가므로 버튼을 내린다
  if (!W?.playing) return;
  if (ok) await passScene(k); else await splashScene(k, wall);
  if (!W?.playing) return;
  next();
}

// 남은 거리를 짧게 몰아 벽이 펫에게 닿는다. 펫은 고른 구멍 쪽으로 뛰어오른다.
function rush(k, t0) {
  return new Promise(resolve => {
    const g = W.g, wallEl = $('wl-wall'), start = performance.now(), ms = reduced() ? 120 : RUSH_MS * Math.max(.35, 1 - t0);
    if (k >= 0) { setPet('attack'); placePet('hole', k, ms * .9); } else { setPet('hurt'); }
    const step = now => {
      if (!W) return resolve();
      const p = Math.min(1, (now - start) / ms), t = t0 + (1 - t0) * p * p;
      if (wallEl) wallEl.style.transform = wallTransform(g, scaleAt(t));
      if (p < 1) W.raf = requestAnimationFrame(step); else resolve();
    };
    W.raf = requestAnimationFrame(step);
  });
}

// 펫 자리: 'stand'(무대 가운데), 'hole'(벽이 닿았을 때 그 구멍 안), 'pool'(풀장).
function placePet(where, k = 0, ms = 0) {
  const pet = $('wl-pet'), s = $('wl-stage');
  if (!pet || !s) return;
  const g = W?.g || geo(), base = g.size * 0.29;
  let x = g.w / 2, y = g.floor, scale = 1;
  if (where === 'hole') {
    const h = HOLES[k];
    x = g.left + g.size * h.x / 100;
    y = g.top + g.size * (h.y + h.h * 0.46) / 100; // 펫은 발(아래 가운데)을 기준으로 줄어든다(CSS transform-origin)
    scale = Math.min(1, (g.size * h.w * 0.92 / 100) / base);
  } else if (where === 'pool') {
    x = g.w / 2; y = g.h * STAGE.POOL / 100; scale = 1.25;
  }
  pet.style.transition = ms ? `transform ${ms}ms cubic-bezier(.3,.7,.4,1)` : 'none';
  pet.style.width = pet.style.height = `${base}px`;
  pet.style.transform = `translate3d(${(x - base / 2).toFixed(1)}px, ${(y - base).toFixed(1)}px, 0) scale(${scale.toFixed(3)})`;
  pet.dataset.at = where;
}
function fx(name, x, y, size, cls = '', life = 900) {
  const el = document.createElement('img');
  el.src = art(name); el.alt = ''; el.className = `wl-fxi ${cls}`; el.draggable = false;
  el.style.cssText = `left:${x - size / 2}px;top:${y - size / 2}px;width:${size}px;height:${size}px`;
  $('wl-fx')?.appendChild(el);
  later(() => el.remove(), life);
  return el;
}
function popText(text, x, y, cls = '') {
  const el = document.createElement('div');
  el.className = `wl-pop ${cls}`; el.innerHTML = text;
  el.style.left = `${x}px`; el.style.top = `${y}px`;
  $('wl-fx')?.appendChild(el);
  later(() => el.remove(), 1200);
}
const petCenter = () => { const r = $('wl-pet').getBoundingClientRect(), s = $('wl-stage').getBoundingClientRect(); return [r.left - s.left + r.width / 2, r.top - s.top + r.height / 2, r.width]; };

// 통과: 펫이 구멍 안에 들어간 채로 벽이 그 구멍을 중심으로 커지며 카메라 쪽으로 지나간다.
async function passScene(k) {
  const g = W.g, wallEl = $('wl-wall'), h = HOLES[k];
  $('wl-wallbox').classList.add('behind'); // 이제 벽이 펫 앞
  setPet('happy');
  sfx('clear', { rate: 1 + Math.min(W.combo, 10) * 0.04 }); buzz(18);
  const [px, py, pw] = petCenter();
  fx('fx-pass', px, py, pw * 1.9, 'ring', 800);
  fx('fx-sparkle', px, py, pw * 1.6, 'spark', 900);
  if (wallEl) {
    wallEl.style.transformOrigin = `${h.x}% ${h.y + h.h * 0.1}%`;
    wallEl.style.transition = `transform ${reduced() ? 150 : 520}ms cubic-bezier(.5,0,.9,.4), opacity ${reduced() ? 150 : 520}ms ease-in`;
    void wallEl.offsetWidth;
    wallEl.style.transform = 'scale(3.4)'; wallEl.style.opacity = '0';
  }
  const mult = comboMult(W.combo);
  popText(`+${W.lastPts}${mult > 1 ? `<small>×${mult}</small>` : ''}`, px, py - pw * .7, 'pts');
  const sc = $('wl-score'); if (sc) { sc.textContent = num(W.score); restart(sc.parentElement, 'bump'); }
  if (W.combo >= 3) {
    later(() => {
      popText(`${W.combo} 콤보!${CHEERS[Math.min(W.combo, CHEERS.length - 1)] ? `<small>${CHEERS[Math.min(W.combo, CHEERS.length - 1)]}</small>` : ''}`, g.w / 2, g.h * 0.36, 'combo');
      fx('fx-combo', g.w / 2, g.h * 0.36 - 10, 120, 'flame', 900);
      if (W.combo % 5 === 0) sfx('combo-10');
    }, 160);
  }
  if (W.combo === WALL.FEVER_AT) { app()?.classList.add('fever'); refSay('fever'); sfx('crit'); restart($('wl-flash'), 'go'); }
  else refSay(W.combo >= WALL.FEVER_AT ? 'fever' : 'pass', W.combo >= 3 ? CHEERS[Math.min(W.combo, CHEERS.length - 1)] || undefined : undefined);
  await wait(420);
  // 지나간 뒤 펫이 무대로 내려선다.
  $('wl-wallbox').innerHTML = ''; $('wl-wallbox').classList.remove('behind', 'lit');
  placePet('stand', 0, 280);
  if (W.combo >= 3) fx('fx-confetti', g.w / 2, g.h * 0.42, g.w * .8, 'confetti', 1100);
  await wait(560);
}

// 풍덩: 벽에 쾅 → 펫이 화면 아래(풀장)로 날아가 물보라 → 오리 튜브로 둥둥 → 정답 보여 주기 → 무대로 돌아온다.
async function splashScene(k, wall) {
  const g = W.g, wallEl = $('wl-wall');
  app()?.classList.remove('fever');
  setPet('hurt');
  const [px, py, pw] = petCenter();
  fx('fx-impact', px, py, pw * 1.5, 'impact', 600);
  sfx('boss-slam', { gain: .8 }); buzz([30, 40, 60]);
  restart(app(), 'shake');
  hud();
  const hearts = document.querySelectorAll('.wl-heart'); restart(hearts[W.lives], 'break');
  // 벽이 계속 밀고 와서 지나간다.
  if (wallEl) {
    wallEl.style.transition = `transform ${reduced() ? 150 : 600}ms cubic-bezier(.5,0,.9,.5), opacity 600ms ease-in`;
    void wallEl.offsetWidth;
    wallEl.style.transform = `translate3d(0, ${g.h * 0.5}px, 0) scale(2.6)`; wallEl.style.opacity = '0';
  }
  await wait(140);
  // 날아가기: 큰 포물선(위로 살짝 → 카메라 쪽 아래로), 빙글.
  const pet = $('wl-pet');
  pet.classList.add('fly');
  placePet('pool', 0, reduced() ? 120 : 640);
  sfx('fail', { gain: .6 });
  await wait(600);
  pet.classList.remove('fly'); pet.classList.add('swim');
  $('wl-wallbox').innerHTML = ''; $('wl-wallbox').classList.remove('lit');
  const sx = g.w / 2, sy = g.h * STAGE.POOL / 100;
  fx('fx-splash', sx, sy - g.size * .18, g.size * .9, 'splash', 1100);
  fx('fx-drops', sx, sy - g.size * .3, g.size * .8, 'drops', 1000);
  fx('fx-ripple', sx, sy + g.size * .06, g.size * .95, 'ripple', 1600);
  sfx('reel-splash'); buzz(40);
  setPet('sad');
  refSay('splash');
  // 정답 보여 주기(학습): 문제 → 정답.
  const right = wall.options[wall.answer];
  const q = $('wl-q');
  if (q) { q.classList.add('reveal'); q.innerHTML = `<small>${k < 0 ? '시간 끝! 정답은' : '정답은'}</small><b>${esc(wall.kind === 'mean2en' ? right : wall.prompt)} <em>=</em> ${esc(wall.kind === 'mean2en' ? wall.prompt : right)}</b>`; }
  await wait(1500);
  if (W.lives <= 0) { await wait(300); return; }
  // 무대로 돌아오기.
  pet.classList.add('climb');
  await wait(260);
  pet.classList.remove('swim', 'climb');
  placePet('stand'); setPet('normal');
  restart(pet, 'pop');
  await wait(380);
}

async function stageUp(stage) {
  (W.stageShown ||= {})[stage] = true;
  setBg(stage);
  app()?.classList.remove('stage-2', 'stage-3');
  app()?.classList.add(`stage-${stage + 1}`);
  $('wl-play').innerHTML = '';
  const g = geo();
  const el = document.createElement('div');
  el.className = `wl-stageup s${stage + 1}`;
  el.innerHTML = `${img('badge-stage', 'badge')}<b>${stage + 1}단계!</b><small>${stage === WALL.SPEEDS.length - 1 ? '피버 무대 · 가장 빨라요' : '벽이 더 빨라져요'}</small>${stage === WALL.SPEEDS.length - 1 ? `${img('siren', 'siren l')}${img('siren', 'siren r')}` : ''}`;
  $('wl-fx')?.appendChild(el);
  sfx('ult-riser'); buzz([20, 30, 50]);
  refSay(stage === 2 ? 'fever' : 'ready', stage === 2 ? '최고 속도!' : '빨라진다!');
  fx('fx-light', g.w * .25, g.h * .3, g.h * .5, 'beam', 1500);
  fx('fx-light', g.w * .75, g.h * .3, g.h * .5, 'beam', 1500);
  await wait(1500);
  el.remove();
  next();
}

/* ---------- 결과 ---------- */
async function finish() {
  W.playing = false; W.asking = false;
  cancelAnimationFrame(W.raf);
  app()?.classList.remove('fever', 'playing');
  const local = gradeWalls(W.walls.map(x => x.answer), W.picks);
  const missedIds = W.walls.slice(0, W.picks.length).filter((x, n) => !local.marks[n]).map(x => x.id);
  const passedIds = new Set(W.walls.slice(0, W.picks.length).filter((x, n) => local.marks[n]).map(x => x.id));
  saveMissed([...missedIds, ...loadMissed().filter(id => !passedIds.has(String(id)))]);
  main('<div class="wl-saving">기록하는 중…</div>');
  let res = null;
  if (W.id) {
    try { res = await api('/games/wall/finish', { id: W.id, picks: W.picks }); }
    catch (err) { res = { paid: false, reason: 'error', error: err.message }; }
    if (!W) return;
    if (res?.stats) Object.assign(W.A.data.stats, res.stats);
    if (typeof res?.points_balance === 'number') W.A.data.stats.points_balance = res.points_balance;
    W.view = { ...W.view, best: res?.best ?? W.view?.best, left: res?.left ?? W.view?.left };
    W.A.data.rewards ||= {}; W.A.data.rewards.wall = W.view;
  }
  result(local, res, missedIds);
}
function result(local, res, missedIds) {
  const stars = res?.stars ?? local.stars, passes = res?.passes ?? local.passes, score = res?.score ?? local.score;
  const record = !!res?.record, coins = Number(res?.coins || 0), xp = Number(res?.xp || 0);
  const why = !W.id ? '연결이 안 돼서 기록 없이 했어요.' : res?.reason === 'daily' ? `오늘 코인 판(${WALL.DAILY}판)을 다 썼어요. 기록은 남아요!` : res?.reason === 'error' ? esc(res.error || '저장하지 못했어요.') : res?.reason ? '이번 판은 기록하지 못했어요.' : '';
  const missed = W.walls.filter(x => missedIds.includes(x.id)).filter((x, n, list) => list.findIndex(y => y.id === x.id) === n);
  const face = x => x.kind === 'mean2en' ? [x.options[x.answer], x.prompt] : [x.prompt, x.options[x.answer]];
  const line = stars === 3 ? '퍼펙트! 벽 15장 전부 통과!' : stars === 2 ? '거의 다 왔어! 다음엔 퍼펙트!' : stars === 1 ? '좋았어! 조금만 더!' : '괜찮아, 다시 해 보자!';
  setPet(stars >= 2 ? 'happy' : stars === 1 ? 'cheer' : 'sad');
  placePet('stand');
  $('wl-pet')?.classList.remove('swim', 'fly');
  refSay(stars >= 2 ? 'pass' : 'splash', line);
  main(`<section class="wl-result s${stars}">
    <div class="wl-res-card">
      ${record ? img('ribbon-record', 'wl-ribbon') : ''}
      <div class="wl-res-stars" aria-label="별 ${stars}개">${[0, 1, 2].map(n => `<i class="${n < stars ? 'on' : ''}" style="--d:${n * 180 + 250}ms">★</i>`).join('')}</div>
      <h2>${record ? '신기록!' : stars === 3 ? '퍼펙트!' : '결과'}</h2>
      <div class="wl-res-score"><b id="wl-res-score">0</b><small>점</small></div>
      <div class="wl-res-rows"><span><small>통과</small><b>${passes}<small>/${WALL.WALLS}</small></b></span><span><small>최고 콤보</small><b>${res?.combo ?? local.combo}</b></span><span><small>내 최고</small><b>${num(Math.max(score, W.view?.best || 0, W.prevBest || 0))}</b></span></div>
      ${coins || xp ? `<div class="wl-res-gain">${coins ? `<span class="r coin">${coin()}<b>+${num(coins)}</b>${res?.record_coins ? `<small>신기록 +${res.record_coins} 포함</small>` : ''}</span>` : ''}${xp ? `<span class="r xp"><b>+${xp}</b><small>경험치</small></span>` : ''}</div>` : ''}
      ${why ? `<p class="wl-why">${why}</p>` : ''}
      ${missed.length ? `<div class="wl-review"><h3>헷갈린 단어 <small>다음 판에 먼저 나와요</small></h3><div>${missed.map((x, n) => { const [en, ko] = face(x); return `<span style="--i:${n}"><b>${esc(en)}</b><em>${esc(ko)}</em></span>`; }).join('')}</div></div>` : ''}
      <div class="wl-res-btns"><button type="button" class="yl-cta" data-wl="again">한 판 더</button><button type="button" class="btn full" data-wl="exit">놀이터로</button></div>
    </div>
  </section>`);
  const sc = $('wl-res-score');
  countUp(sc, score, 1100);
  [0, 1, 2].slice(0, stars).forEach(n => later(() => { sfx('stamp', { rate: 1 + n * .08 }); buzz(25); }, n * 180 + 300));
  later(() => {
    if (record) sfx('tm-record'); else if (stars === 3) sfx('fanfare-epic'); else if (stars) sfx('fanfare-basic');
    if (coins) { sfx('coins'); coinShower(app(), 22); const b = $('wl-coins'); if (b) countUp(b, Number(W.A.data.stats?.points_balance || 0), 900); }
    if (stars === 3 || record) fx('fx-confetti', W.g?.w / 2 || 180, (W.g?.h || 600) * .3, (W.g?.w || 360) * .9, 'confetti', 1600);
  }, stars * 180 + 450);
}
