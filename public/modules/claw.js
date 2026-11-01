import { api, esc, num, icon, toast } from './ui.js';
import { coin } from './emblems.js';
import { playSound, unlockSound, soundOn, preloadSound } from './sound.js';
import { coinShower, countUp } from './celebrate.js';
import { CLAW, DOLL_KEYS, DOLLS, dollName, roundLayout } from './claw-rules.js';
import { CLAW_ART } from './claw-art.js';
import { TITLES } from './titles.js';
import { missPlan } from './claw-fx.js';
import { loadMatter, makePile, makePendulum, makeTeeter, physicsOn, W, H, STEP } from './claw-physics.js';

// V13.180 인형뽑기(놀이터). 구성안 docs/claw-machine-design.md. 그림은 주문서 42 ~ 45(public/assets/claw).
// 3D 라이브러리 없이 그림 층 + 2.5D: 기계(속 빈 그림) → 인형 더미(깊이 순서) → 집게 뒤 발톱 → 잡힌 인형 → 앞 발톱 · 줄 · 레일 → 유리 반사 → 버튼.
// 판 배치 · 잡힘 · 놓침은 서버가 정한다(server/claw.mjs): 화면은 집게권 넣기 → 내린 위치 → 서버 결과 순서로 연출만 한다.
// 조작: 폰은 왼쪽 아래 조이스틱 + 오른쪽 아래 DROP, 키보드는 방향키 · WASD + 스페이스 · 엔터(Z 확대).
// 기계 그림 위 자리(그림 높이 · 너비의 %, 주문서 43-1을 재서 정했다): 바닥 뒤 50% · 앞 55.5%, 배출구는 앞 왼쪽.
const FLOOR = { back: 50, front: 55.5, l0: 26, r0: 74, l1: 17, r1: 83 };
const CEIL = { back: 23, front: 20.5 };
const HOME = { x: 0.15, y: 0.56 };            // 배출구 위(집게가 쉬는 곳)
const DOLL_W = 22;                            // 인형 너비(기계 너비 %, 앞줄 기준). V13.183 16.5 → 22: 유리 안이 비어 보여서
const CLAW_W = 21;
const LIFT = 5;                               // 층 하나 높이(기계 높이 %)
const DOOR = { left: 21, top: 75.5, w: 29, h: 17 }; // 아래 왼쪽 상품 문
// V13.204 배출구 오른쪽 턱(기계 그림 %, 배출구 구멍 그림의 오른쪽 끝을 화면에서 재서 정함): 심쿵 놓침에서 인형이 걸쳐 흔들리는 자리.
const LIP = { left: 31, top: 49.6 };
const SWING_HOLD_MS = 320;                    // V13.204 배출구 위에서 놓기 전 대롱대롱 기다림(물리 켬일 때만)

const has = name => CLAW_ART.has(name);
const src = name => `/assets/claw/${name}.webp`;
const dollSrc = (k, pose = '', small = false) => `/assets/claw/doll-${k}${pose ? `-${pose}` : ''}${small ? '-s' : ''}.webp`;
const img = (name, cls = '', fallback = '') => has(name) ? `<img class="${cls}" src="${src(name)}" alt="" draggable="false">` : fallback;

let C = null;
const root = () => document.getElementById('app');
const $ = id => document.getElementById(id);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
let REDUCED = null;
const reduced = () => (REDUCED ||= matchMedia('(prefers-reduced-motion: reduce)')).matches;
const sfx = (key, opts) => { if (soundOn()) playSound(key, opts); };
const buzz = p => { try { if (soundOn()) navigator.vibrate?.(p); } catch {} };
const newId = p => `${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
function later(fn, ms) { const cur = C; const t = setTimeout(() => { if (C === cur && !cur.closing) fn(); }, ms); cur.timers.push(t); return t; }
const wait = ms => new Promise(r => later(r, reduced() ? Math.min(ms, 140) : ms));
const ease = t => t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
// ms 동안 fn(0~1)을 부른다(화면이 닫히면 멈춤).
function tween(ms, fn, easing = ease) {
  const cur = C;
  return new Promise(res => {
    if (reduced()) ms = Math.min(ms, 160);
    const t0 = performance.now();
    const step = now => {
      if (C !== cur || cur.closing) return res();
      const t = Math.min(1, (now - t0) / ms);
      fn(easing(t), t);
      if (t < 1) requestAnimationFrame(step); else res();
    };
    requestAnimationFrame(step);
  });
}
// 바닥 좌표(x 0~1 왼→오, y 0~1 뒤→앞) → 기계 그림 위 %.
function floorAt(x, y) {
  const top = FLOOR.back + (FLOOR.front - FLOOR.back) * y;
  const l = FLOOR.l0 + (FLOOR.l1 - FLOOR.l0) * y, r = FLOOR.r0 + (FLOOR.r1 - FLOOR.r0) * y;
  return { left: l + (r - l) * x, top, s: 0.78 + 0.22 * y };
}
const railTop = y => CEIL.back + (CEIL.front - CEIL.back) * y;
const depthZ = (y, z = 0) => 10 + Math.round(y * 100) * 4 + z;

export function openClaw(A, exit) {
  closeAll();
  C = { A, exit, timers: [], v: A.data.rewards?.claw || null, phase: 'idle', round: null, dolls: [], won: 0, got: [], claw: { x: HOME.x, y: HOME.y, drop: 0, open: false, sway: 0 },
    stick: { x: 0, y: 0 }, keys: new Set(), time: CLAW.TIME, zoom: false, lastSend: 0, startAt: 0, held: null };
  A.screen = 'claw';
  const night = (() => { const h = new Date(Date.now() + 9 * 3600000).getUTCHours(); return h >= 19 || h < 6; })();
  const bg = night ? 'bg-neon' : Math.floor(Date.now() / 86400000) % 2 ? 'bg-mint' : 'bg-galaxy';
  root().innerHTML = `<div class="session-app cw-app">
    <div class="cw-bg" id="cw-bg">${img(bg, 'cw-bg-img')}<i class="cw-glitter"></i></div>
    <header class="cw-top"><button type="button" class="yb-back" data-cw="exit" aria-label="나가기">${icon('back')}</button><strong>인형뽑기</strong>
      <span class="cw-chip" id="cw-tickets" aria-label="집게권"></span><button type="button" class="cw-round-btn" data-cw="book" aria-label="인형 도감">📖</button><button type="button" class="cw-round-btn" data-cw="guide" aria-label="인형뽑기 안내">?</button></header>
    <div class="cw-news" id="cw-news" role="status" aria-live="polite" hidden></div>
    <div class="cw-hud" id="cw-hud" aria-live="polite"></div>
    <main class="cw-main"><div class="cw-stage" id="cw-stage"><div class="cw-zoom" id="cw-zoom">
      ${img('machine', 'cw-machine', '<span class="cw-machine cw-machine-css"></span>')}
      <div class="cw-backlight"></div>
      <div class="cw-pile" id="cw-pile"></div>
      <div class="cw-rail" id="cw-rail">${img('rail-x', 'cw-rail-img', '<i class="cw-rail-css"></i>')}</div>
      <div class="cw-carriage" id="cw-carriage">${img('carriage', 'cw-carriage-img', '<i class="cw-carriage-css"></i>')}</div>
      <i class="cw-cable" id="cw-cable"></i>
      <i class="cw-shadow" id="cw-shadow"></i>
      <div class="cw-claw" id="cw-claw"></div>
      <div class="cw-chute" id="cw-chute">${img('chute-glow', 'cw-chute-glow')}</div>
      ${img('glass-glare', 'cw-glare')}
      <div class="cw-door" id="cw-door"></div>
      <div class="cw-readout" id="cw-readout">READY</div>
      <div class="cw-knob-mini" id="cw-knob-mini">${img('stick-knob', '', '<i></i>')}</div>
      <div class="cw-btn-mini" id="cw-btn-mini">${img('btn-drop', 'up')}${img('btn-drop-down', 'down')}</div>
      <div class="cw-fx" id="cw-fx"></div>
    </div></div></main>
    <footer class="cw-ctrl" id="cw-ctrl">
      <div class="cw-stick" id="cw-stick" aria-label="조이스틱">${img('stick-base', 'cw-stick-base', '<i class="cw-stick-base cw-css-base"></i>')}<span class="cw-knob" id="cw-knob">${img('stick-knob', '', '<i class="cw-css-knob"></i>')}</span></div>
      <div class="cw-mid" id="cw-mid"></div>
      <button type="button" class="cw-drop" id="cw-drop" data-cw="drop" aria-label="집게 내리기">${img('btn-drop', 'up', '<i class="cw-css-drop"></i>')}${img('btn-drop-down', 'down')}<b>DROP</b></button>
    </footer>
    <div id="cw-layer" class="cw-layer"></div></div>`;
  root().onclick = onClick;
  root().querySelector('.cw-app').addEventListener('contextmenu', e => e.preventDefault());
  C.onKey = e => onKey(e, true); C.onKeyUp = e => onKey(e, false);
  addEventListener('keydown', C.onKey); addEventListener('keyup', C.onKeyUp);
  bindStick();
  window.scrollTo(0, 0);
  preloadSound(['coin', 'swoosh', 'wiggle', 'pop', 'stamp', 'fanfare-basic', 'fanfare-epic', 'fanfare-legend', 'coins', 'reel-plop', 'reel-click', 'tick', 'tap', 'fail', 'claw-strain', 'claw-slip', 'claw-aww']);
  idle();
  // V13.203 물리(claw-physics.js): 테스트 앱에서만 켠다(운영은 예전 연출 그대로). 받아지면 더미를 물리로 바꾼다. 동작 줄이기면 받지 않는다.
  if (physicsOn() && !reduced()) loadMatter().then(M => { if (!C || !M) return; C.P = makePile(M); C.P.onBump = chainBump; syncPile(); });
  if (physicsOn()) preloadSound(['fish-thump']); // V13.204 배출구 턱 심장 소리(테스트 앱에서만)
  api('/claw/home', {}).then(res => {
    if (!C) return; setView(res.claw); news(res.news);
    if (res.claw?.live) return resume(res.claw.live);
    idle();
    if (!C.v?.guide) later(() => guide(true), 600);
  }).catch(err => { if (C) toast(err.message); });
}
function closeAll() {
  if (!C) return;
  C.closing = true; C.timers.forEach(clearTimeout); cancelAnimationFrame(C.raf); cancelAnimationFrame(C.physRaf);
  removeEventListener('keydown', C.onKey); removeEventListener('keyup', C.onKeyUp);
}
async function leave() { const exit = C?.exit; closeAll(); root().onclick = null; C = null; await exit?.(); }
function setView(v) {
  if (!v || !C) return;
  C.v = v; C.A.data.rewards ||= {}; C.A.data.rewards.claw = v;
  const t = $('cw-tickets');
  if (t) t.innerHTML = `${img('icon-ticket', 'cw-chip-ico', '🎟️')}<b>${num(v.tickets)}</b><small>/${v.max}</small>`;
}

function onClick(event) {
  const b = event.target.closest('[data-cw]');
  if (!b || b.disabled || !C) return;
  unlockSound();
  const act = b.dataset.cw;
  if (act === 'exit') return leave();
  if (act === 'guide') return guide(false);
  if (act === 'book') return book();
  if (act === 'start') return start();
  if (act === 'drop') return drop();
  if (act === 'zoom') return toggleZoom();
  if (act === 'again') { layer(''); return start(); }
  if (act === 'close-layer') return layer('');
}
const layer = html => { const l = $('cw-layer'); if (!l) return; l.innerHTML = html; l.classList.toggle('on', !!html); };

/* ---------- 그리기 ---------- */
function hud() {
  const box = $('cw-hud'); if (!box || !C) return;
  const v = C.v || {}, live = !!C.round, n = live ? C.round.n : 0, left = live ? CLAW.DROPS - n : CLAW.DROPS;
  const dots = Array.from({ length: CLAW.DROPS }, (_, i) => `<i class="${i < left ? 'on' : ''}"></i>`).join('');
  const tl = Math.ceil(C.time);
  box.innerHTML = `<span class="cw-h"><small>뽑은 인형</small><b>${num(C.got.length)}</b></span>
    <span class="cw-h"><small>남은 집게</small><span class="cw-dots">${dots}</span></span>
    <span class="cw-h"><small>도감</small><b>${num(v.kinds || 0)}/${num(v.all || 12)}</b></span>
    <span class="cw-h cw-time ${live && tl <= 5 ? 'warn' : ''}">${img('timer-ring', 'cw-ring')}<b id="cw-time">${live ? tl : CLAW.TIME}</b><small>TIME</small></span>`;
}
function mid() {
  const box = $('cw-mid'); if (!box || !C) return;
  const v = C.v || {};
  if (C.phase === 'idle') {
    const can = Number(v.tickets || 0) > 0 && v.open !== false;
    box.innerHTML = `<button type="button" class="cw-start" data-cw="start" ${can ? '' : 'disabled'}>${img('icon-ticket', 'cw-start-ico', '🎟️')}<b>${can ? '집게권 넣기' : v.open === false ? '곧 열려요' : '집게권 0장'}</b><small>${can ? `30초 · 집게 ${CLAW.DROPS}번` : '공부하면 받아요'}</small></button>`;
  } else {
    box.innerHTML = `<button type="button" class="cw-zoom-btn ${C.zoom ? 'on' : ''}" data-cw="zoom" aria-pressed="${C.zoom}">🔍<small>확대</small></button>`;
  }
  const d = $('cw-drop'); if (d) d.disabled = C.phase !== 'aim';
}
function dollEl(d) {
  const el = document.createElement('div');
  el.className = `cw-doll${d.g ? ' gold' : ''}`;
  el.dataset.i = d.i;
  el.innerHTML = `${d.g && has('gold-aura') ? `<img class="cw-aura" src="${src('gold-aura')}" alt="" draggable="false">` : ''}<span class="cw-doll-in" style="--r:${d.r}deg;--dl:${(d.i * 0.37) % 2.2}s"><img class="cw-doll-img" src="${dollSrc(d.k, '', true)}" alt="" draggable="false"></span>${d.g && has('gold-ribbon') ? `<img class="cw-gribbon" src="${src('gold-ribbon')}" alt="" draggable="false">` : ''}`;
  placeDoll(el, d);
  return el;
}
function placeDoll(el, d) {
  const p = floorAt(d.x, d.y), w = DOLL_W * p.s * d.s;
  el.style.left = `${p.left}%`;
  el.style.top = `${p.top - d.z * LIFT * p.s}%`;
  el.style.width = `${w}%`;
  el.style.zIndex = depthZ(d.y, d.z);
}
function drawPile() {
  const pile = $('cw-pile'); if (!pile || !C) return;
  pile.innerHTML = '';
  for (const d of C.dolls) if (!((C.won >> d.i) & 1)) pile.appendChild(dollEl(d));
  syncPile();
}
const dollNode = i => $('cw-pile')?.querySelector(`.cw-doll[data-i="${i}"]`);

/* ---------- 물리(V13.203) ---------- */
// 인형 그림은 정사각: 너비(px) = 높이. 물리 몸 가운데 = 발끝(.cw-doll의 left · top) 위로 그림 높이의 0.46.
const dollSize = d => DOLL_W * floorAt(d.x, d.y).s * d.s * W / 100;
function homeOf(d) { const p = floorAt(d.x, d.y); return { x: p.left * W / 100, y: (p.top - d.z * LIFT * p.s) * H / 100 - dollSize(d) * 0.46 }; }
function syncPile() {
  if (!C?.P) return;
  C.P.clear();
  for (const d of C.dolls) {
    if ((C.won >> d.i) & 1) continue;
    C.P.add(d.i, homeOf(d), dollSize(d) * 0.34, d.y);
    const n = dollNode(d.i); if (n) n.style.transformOrigin = '50% 96%';
  }
  physRun();
}
// 움직이는 인형이 있을 때만 돈다(다 멈추면 쉰다). physScale: 0 멈춤(hit-stop) · 1 보통 · 0.5 슬로모션.
function physRun() {
  if (!C?.P || C.physOn) return;
  C.physOn = true; C.physLast = performance.now(); C.physAcc = 0;
  C.physRaf = requestAnimationFrame(physFrame);
}
function physFrame(now) {
  if (!C?.P || C.closing) return;
  C.physAcc += Math.min(100, now - C.physLast); C.physLast = now;
  const scale = C.physScale ?? 1;
  let n = 0;
  while (C.physAcc >= STEP && n < 4) { if (scale > 0) { C.P.engine.timing.timeScale = scale; C.P.step(); } C.physAcc -= STEP; n++; }
  if (n === 4) C.physAcc = 0;
  for (const [i, b] of C.P.bodies) if (!b.isSleeping && i !== C.pin) dollAt(i, b);
  if (scale > 0 && C.P.still()) { for (const [i, b] of C.P.bodies) if (i !== C.pin) dollAt(i, b); C.physOn = false; return; }
  C.physRaf = requestAnimationFrame(physFrame);
}
// 물리 몸 → 인형 자리: 발끝 = 가운데 + 회전된 (0, 0.46 높이), 기울기는 발끝을 축으로.
function dollAt(i, b) {
  const n = dollNode(i), d = C.dolls.find(x => x.i === i); if (!n || !d) return;
  const h = dollSize(d) * 0.46, a = b.angle;
  n.style.left = `${(b.position.x - Math.sin(a) * h) / W * 100}%`;
  n.style.top = `${(b.position.y + Math.cos(a) * h) / H * 100}%`;
  n.style.transform = Math.abs(a) > 0.002 ? `translate(-50%, -96%) rotate(${a.toFixed(3)}rad)` : '';
}
// V13.204 도미노: 떨어진 인형에 맞은 인형 · 그 둘레로 번질 때마다 눌림 + 톡(번질수록 높고 작게, 너무 잦으면 소리는 건너뜀).
function chainBump(i, power, hop) {
  if (!C) return;
  squash(i);
  const now = performance.now();
  if (now - (C.bumpAt || 0) > 70) { C.bumpAt = now; sfx('reel-plop', { gain: Math.min(0.35, 0.12 + power * 0.06), rate: 1.15 + hop * 0.12 }); }
}
// V13.204 잡힌 인형 진자(claw-physics.js makePendulum): 물리가 켜졌을 때만. 켜져 있으면 집게 기울기(k.sway)를 진자가 정한다.
//   k.wob: 버팀(strain)의 덜덜 떨림을 진자 위에 더한다.
function pendOn(grip) { if (!C?.P) return; C.pend = makePendulum(grip); C.pendAt = null; C.claw.wob = 0; C.pend.kick(Math.random() < 0.5 ? -1 : 1); }
function pendOff() { if (!C) return; C.pend = null; C.claw.wob = 0; }
function swingStep() {
  const k = C.claw, now = performance.now(), dt = C.pendAt == null ? 0 : now - C.pendAt;
  C.pendAt = now;
  if (dt > 0) k.sway = C.pend.step(dt, floorAt(k.x, k.y).left * W / 100) + (k.wob || 0);
}
const physPause = ms => { if (!C?.P) return; C.physScale = 0; physRun(); later(() => { C.physScale = 1; }, ms); };
// 집게 · 줄 · 받침 · 레일 · 그림자를 지금 상태로.
function drawClaw() {
  if (!C) return;
  if (C.pend) swingStep();
  const k = C.claw, p = floorAt(k.x, k.y), rt = railTop(k.y);
  const restTop = rt + 3.2, bottom = k.bottom ?? (p.top - 7 * p.s);
  const top = restTop + (bottom - restTop) * k.drop;
  const w = CLAW_W * p.s;
  const rail = $('cw-rail'), car = $('cw-carriage'), cable = $('cw-cable'), claw = $('cw-claw'), sh = $('cw-shadow');
  if (!claw) return;
  rail.style.top = `${rt}%`;
  car.style.left = `${p.left}%`; car.style.top = `${rt}%`; car.style.width = `${w * 0.9}%`;
  cable.style.left = `${p.left}%`; cable.style.top = `${rt + 1.2}%`; cable.style.height = `${Math.max(0.5, top - rt - 1)}%`;
  claw.style.left = `${p.left}%`; claw.style.top = `${top}%`; claw.style.width = `${w}%`;
  claw.style.transform = `translate(-50%, 0) rotate(${k.sway || 0}deg)`;
  claw.style.zIndex = k.held ? 600 : depthZ(k.y, 3);
  const near = clamp(k.drop, 0, 1);
  sh.style.left = `${p.left}%`; sh.style.top = `${p.top}%`; sh.style.width = `${w * (1.1 - near * 0.45)}%`; sh.style.opacity = String(0.18 + near * 0.4); sh.style.zIndex = depthZ(k.y, 0) - 1;
  const ro = $('cw-readout');
  if (ro && C.phase === 'aim') ro.textContent = `X ${String(Math.round(k.x * 99)).padStart(2, '0')}  Y ${String(Math.round(k.y * 99)).padStart(2, '0')}`;
}
// 집게 그림: open · closed · grip(뒤 발톱 → 잡힌 인형 → 앞 발톱).
function clawPic(state, doll = null) {
  const claw = $('cw-claw'); if (!claw) return;
  if (state === 'grip' && doll) {
    claw.innerHTML = `${img('claw-grip-back', 'cw-cl back', '')}<span class="cw-held${doll.g ? ' gold' : ''}"><img src="${dollSrc(doll.k, 'grab')}" alt="" draggable="false"></span>${img('claw-grip-front', 'cw-cl front', '')}`;
  } else {
    claw.innerHTML = img(state === 'open' ? 'claw-open' : 'claw-closed', 'cw-cl', `<i class="cw-css-claw ${state}"></i>`);
  }
}

/* ---------- 대기 · 시작 ---------- */
function idle() {
  if (!C) return;
  C.phase = 'idle'; C.round = null; C.got = []; C.time = CLAW.TIME;
  // 대기 중 진열: 오늘 날짜로 정한 보기용 더미(판과 상관없음).
  C.dolls = roundLayout(`show-${Math.floor(Date.now() / 86400000)}`, (C.v?.ready?.length ? C.v.ready : DOLL_KEYS)); C.won = 0;
  drawPile(); C.claw = { x: HOME.x, y: HOME.y, drop: 0, sway: 0 }; clawPic('closed'); drawClaw();
  $('cw-readout').textContent = 'READY';
  hud(); mid();
  root().querySelector('.cw-app')?.classList.remove('live');
}
async function start() {
  if (!C || C.phase !== 'idle') return;
  C.phase = 'starting'; mid();
  const id = newId('r');
  let res;
  try { res = await api('/claw/start', { id }); } catch (err) { if (C) { toast(err.message); C.phase = 'idle'; mid(); } return; }
  if (!C) return;
  setView(res.claw);
  sfx('coin'); buzz([15]);
  // 집게권이 기계로 쏙 → 불빛 한 바퀴.
  const fx = $('cw-fx');
  if (fx && has('icon-ticket')) { fx.insertAdjacentHTML('beforeend', `<img class="cw-ticket-fly" src="${src('icon-ticket')}" alt="">`); later(() => fx.querySelector('.cw-ticket-fly')?.remove(), 900); }
  root().querySelector('.cw-app')?.classList.add('flash');
  later(() => root().querySelector('.cw-app')?.classList.remove('flash'), 900);
  if (C.P) later(() => { C.P?.jolt(2.6); physRun(); }, 260); // 집게권이 들어가면 기계가 덜컹: 더미가 들썩
  await wait(650);
  begin(res.round);
}
function resume(live) { toast('하던 판을 이어서 해요!'); begin(live, true); }
function begin(round, resumed = false) {
  if (!C) return;
  C.round = { ...round };
  C.dolls = round.dolls.map(d => ({ ...d }));
  C.won = Number(round.won || 0);
  C.got = C.dolls.filter(d => (C.won >> d.i) & 1).map(d => ({ k: d.k, g: d.g }));
  C.time = resumed ? Math.max(5, Number(round.aim_left || 0)) : CLAW.TIME;
  C.startAt = performance.now(); C.lastSend = resumed ? performance.now() - CLAW.GAP_MS : 0;
  drawPile();
  if (!resumed) refill();
  root().querySelector('.cw-app')?.classList.add('live');
  aim();
}
// V13.203 새 판: 인형들이 위에서 쏟아져 제자리에 쌓인다(위층일수록 높이서). 첫 집게까지 1.2초 안에 거의 끝난다.
function refill() {
  if (!C?.P) return;
  let last = 0;
  for (const d of C.dolls) {
    if ((C.won >> d.i) & 1) continue;
    // 유리 안(천장 아래)에서만 떨어진다: 간판 위로 삐져나오지 않게.
    const home = homeOf(d), up = 70 + d.z * 70 + ((d.i * 37) % 11) * 9, top = (CEIL.back + 6) * H / 100 + dollSize(d) * 0.5;
    C.P.drop(d.i, { x: home.x + ((d.i * 53) % 9 - 4) * 3, y: Math.max(top, home.y - up) }, { x: 0, y: 0 }, ((d.i * 29) % 7 - 3) * 0.01, kind => {
      if (kind !== 'touch') return;
      const now = performance.now();
      if (now - last > 90) { last = now; sfx('reel-plop', { gain: 0.16, rate: 1.1 + (d.i % 5) * 0.08 }); }
      squash(d.i);
    });
  }
  physRun();
}
const squash = i => { const n = dollNode(i); if (n) { n.classList.remove('bump'); void n.offsetWidth; n.classList.add('bump'); } };
function aim() {
  if (!C) return;
  pendOff();
  C.phase = 'aim'; C.dropId ||= newId('d');
  hud(); mid();
  clawPic('closed');
  C.lastFrame = performance.now(); C.lastTick = 0; C.lastMotor = 0;
  cancelAnimationFrame(C.raf);
  C.raf = requestAnimationFrame(loop);
}
// 조준 중: 조이스틱 · 키보드로 집게를 움직이고 시간을 센다.
function loop(now) {
  if (!C || C.phase !== 'aim') return;
  const dt = Math.min(0.05, (now - C.lastFrame) / 1000); C.lastFrame = now;
  let ix = C.stick.x, iy = C.stick.y;
  if (C.keys.size) {
    ix = (C.keys.has('right') ? 1 : 0) - (C.keys.has('left') ? 1 : 0);
    iy = (C.keys.has('down') ? 1 : 0) - (C.keys.has('up') ? 1 : 0);
  }
  const k = C.claw, speed = 0.62;
  k.vx = (k.vx || 0) + (ix * speed - (k.vx || 0)) * Math.min(1, dt * 9);
  k.vy = (k.vy || 0) + (iy * speed - (k.vy || 0)) * Math.min(1, dt * 9);
  const moving = Math.hypot(k.vx, k.vy) > 0.04;
  k.x = clamp(k.x + k.vx * dt, 0.02, 0.98); k.y = clamp(k.y + k.vy * dt, 0.02, 0.98);
  k.sway = clamp(-k.vx * 9, -5, 5);
  drawClaw(); aimHint();
  const knob = $('cw-knob-mini'); if (knob) knob.style.transform = `translate(-50%, -100%) rotate(${clamp(ix * 22, -22, 22)}deg)`;
  const bg = $('cw-bg'); if (bg) bg.style.transform = `translate(${(k.x - 0.5) * -14}px, ${(k.y - 0.5) * -6}px) scale(1.04)`;
  if (moving && now - C.lastMotor > 150) { C.lastMotor = now; sfx('reel-click', { gain: 0.22, rate: 0.7 + Math.hypot(k.vx, k.vy) }); }
  if (C.zoom) zoomTo();
  const before = Math.ceil(C.time);
  C.time = Math.max(0, C.time - dt);
  const after = Math.ceil(C.time);
  if (after !== before) { const t = $('cw-time'); if (t) t.textContent = after; if (after <= 5 && after > 0) { sfx('tick'); root().querySelector('.cw-time')?.classList.add('warn'); } }
  const d = $('cw-drop'); if (d) d.classList.toggle('wait', !canSend());
  if (C.time <= 0 && canSend()) { toast(C.round.n < CLAW.DROPS - 1 ? '시간 끝! 그 자리에서 내려요. 남은 집게는 5초씩!' : '시간 끝! 그 자리에서 내려요.'); return drop(true); }
  C.raf = requestAnimationFrame(loop);
}
const canSend = () => C && performance.now() - C.lastSend >= (C.round?.n ? CLAW.GAP_MS + 150 : 0) && performance.now() - C.startAt >= CLAW.FIRST_MS + 100;
// 그림자 아래 인형 테두리가 살짝 밝아진다(조준 도움). 판정은 서버가 한다.
function aimHint() {
  const k = C.claw; let best = null;
  for (const d of C.dolls) {
    if ((C.won >> d.i) & 1) continue;
    const dist = Math.hypot(k.x - d.x, k.y - d.y) / (CLAW.R * d.s);
    if (dist <= 1 && (!best || d.z > best.d.z || (d.z === best.d.z && dist < best.dist))) best = { d, dist };
  }
  const id = best ? best.d.i : null;
  if (id === C.hint) return;
  dollNode(C.hint)?.classList.remove('aimed');
  C.hint = id;
  dollNode(id)?.classList.add('aimed');
}

/* ---------- 집게 하나 ---------- */
async function drop(auto = false) {
  if (!C || C.phase !== 'aim' || !canSend()) return;
  C.phase = 'busy'; cancelAnimationFrame(C.raf); mid();
  dollNode(C.hint)?.classList.remove('aimed'); C.hint = null;
  const k = C.claw, body = { id: C.dropId, round: C.round.id, n: C.round.n, x: Math.round(k.x * 1000) / 1000, y: Math.round(k.y * 1000) / 1000 };
  C.lastSend = performance.now();
  pressMini();
  const call = api('/claw/drop', body).then(r => ({ ok: r }), err => ({ err }));
  // 1) 열고 내려간다(줄이 풀리고 그림자가 진해진다). 결과를 기다리는 동안 연출이 이어진다.
  sfx('swoosh', { rate: 0.8 }); buzz([12]);
  clawPic('open');
  if (C.zoom || !reduced()) zoomTo(true);
  const target = pickVisual(k.x, k.y);
  const p = floorAt(k.x, k.y);
  k.bottom = clawBottom(target, p);
  await tween(1050, t => { k.drop = t; k.sway *= 0.9; drawClaw(); }, t => t);
  const got = await call;
  if (!C) return;
  if (got.err) {
    toast(got.err.message);
    await tween(600, t => { k.drop = 1 - t; drawClaw(); });
    k.bottom = null; clawPic('closed');
    if (got.err.status === 409) { await refreshHome(); return; }
    C.phase = 'aim'; C.time = Math.max(C.time, 5); return aim();
  }
  const res = got.ok;
  C.dropId = null;
  setView(res.claw);
  if (res.news) later(() => news(res.news), 2600);
  C.round.n = res.n + 1;
  // 2) 바닥에 닿음: 주변 인형이 출렁, 먼지 반짝.
  bumpAround(k.x, k.y);
  const doll = res.target != null ? C.dolls.find(d => d.i === res.target) : null;
  // 3) 쥔다.
  sfx('wiggle'); buzz([20, 40, 20]);
  gripCount(res.grip);
  if (doll && res.result !== 'miss') { clawPic('grip', doll); dollNode(doll.i)?.classList.add('lifted'); } else clawPic('closed');
  await wait(380);
  // V13.191 놓침 연출은 서버 결과(result · slip · grip · aim)로만 정한다(claw-fx.js). 잡힘이면 plan은 null.
  const plan = missPlan(res, { reduced: reduced() });
  if (res.result === 'win') await winLift(res, doll);
  else if (plan.held && doll) await slipLift(res, doll, plan);
  else await airLift(plan);
  k.bottom = null; k.drop = 0;
  if (!C) return;
  zoomTo(false);
  hud();
  if (res.end) return roundEnd(res);
  if (auto || C.time <= 0) C.time = 5;
  // 다음 집게는 서버 최소 간격 뒤에(연출이 거의 그만큼 걸린다).
  const gap = CLAW.GAP_MS + 200 - (performance.now() - C.lastSend);
  if (gap > 0) await wait(gap);
  aim();
}
// 화면에서 닿을 인형(내려갈 깊이만 정한다. 판정은 서버).
function pickVisual(x, y) {
  let best = null;
  for (const d of C.dolls) {
    if ((C.won >> d.i) & 1) continue;
    const dist = Math.hypot(x - d.x, y - d.y) / (CLAW.R * d.s);
    if (dist <= 1 && (!best || d.z > best.d.z || (d.z === best.d.z && dist < best.dist))) best = { d, dist };
  }
  return best?.d || null;
}
function bumpAround(x, y) {
  for (const d of C.dolls) {
    if ((C.won >> d.i) & 1) continue;
    const dist = Math.hypot(x - d.x, y - d.y), reach = CLAW.R * 2.2;
    if (dist > reach) continue;
    // V13.203 물리: 집게가 닿은 자리에서 둘레 인형이 눌렸다가 바깥으로 출렁(가까울수록 세게).
    if (C.P) { const f = 1 - dist / reach, side = Math.sign(d.x - x) || (d.i % 2 ? 1 : -1); C.P.kick(d.i, side * 2.2 * f, 1.8 * f, side * 0.03 * f); }
    squash(d.i);
  }
  physRun();
  const p = floorAt(x, y);
  spark(p.left, p.top - 4, 3);
}
function gripCount(to) {
  const ro = $('cw-readout'); if (!ro) return;
  let g = 0; const step = () => { if (!C) return; g = Math.min(to, g + Math.max(3, Math.round(to / 8))); ro.textContent = `GRIP ${String(g).padStart(2, '0')}`; if (g < to) later(step, 40); };
  ro.textContent = 'GRIP 00'; step();
}
function pressMini() {
  const b = $('cw-btn-mini'), d = $('cw-drop');
  b?.classList.add('down'); d?.classList.add('down');
  later(() => { b?.classList.remove('down'); d?.classList.remove('down'); }, 260);
}
// 뽑힘: 들어 올려(진자) → 배출구 위로 → 놓으면 인형이 굴러 구멍으로 → 아래 상품 문이 열리며 튀어나옴.
async function winLift(res, doll) {
  const k = C.claw;
  dollNode(doll.i)?.remove(); C.P?.remove(doll.i);
  k.held = true; pendOn(res.grip);
  await tween(1050, t => { k.drop = 1 - t; k.sway = Math.sin(t * 7) * 4 * (1 - t * 0.6); drawClaw(); });
  const from = { x: k.x, y: k.y };
  sfx('reel-click', { gain: 0.3, rate: 0.6 });
  await tween(900, t => { k.x = from.x + (HOME.x - from.x) * t; k.y = from.y + (HOME.y - from.y) * t; k.sway = Math.sin(t * 6) * 3; drawClaw(); });
  // V13.204 물리: 멈춘 뒤 인형이 대롱대롱 흔들리는 걸 잠깐 보여 주고 놓는다.
  if (C.pend) await tween(SWING_HOLD_MS, () => drawClaw(), t => t);
  // 놓는다.
  clawPic('open'); k.held = false; drawClaw();
  await fallIntoChute(doll);
  if (res.extra) { const b = C.dolls.find(d => d.i === res.extra.i); dollNode(res.extra.i)?.remove(); C.P?.remove(res.extra.i); if (b) await fallIntoChute(b, true); }
  C.won |= 1 << doll.i; if (res.extra) C.won |= 1 << res.extra.i;
  // 둘레 인형이 빈자리로 살짝 내려앉는다.
  // 물리면 집을 옮겨 스프링이 데려간다(살짝 넘쳤다 앉는다). 아니면 예전처럼 CSS로 미끄러진다.
  for (const n of res.nudge || []) { const d = C.dolls.find(x => x.i === n.i); if (!d) continue; d.x += n.dx; d.y += n.dy; const el = dollNode(d.i); if (C.P?.bodies.has(d.i)) { C.P.home(d.i, homeOf(d)); C.P.kick(d.i, 0, -1.2); } else if (el) { el.classList.add('settle'); placeDoll(el, d); } }
  physRun();
  const prizes = [{ k: doll.k, g: doll.g }, ...(res.extra ? [{ k: res.extra.k, g: res.extra.g }] : [])];
  C.got.push(...prizes);
  await prizeOut(prizes, res);
  clawPic('closed');
}
async function fallIntoChute(doll, second = false) {
  const p = floorAt(HOME.x, HOME.y), k = C.claw, fx = $('cw-fx');
  const start = { top: railTop(k.y) + 3.2 + 6 };
  const el = document.createElement('div');
  el.className = `cw-falling${doll.g ? ' gold' : ''}`;
  el.innerHTML = `<img src="${dollSrc(doll.k, 'fall')}" alt="" draggable="false">`;
  el.style.left = `${p.left}%`; el.style.width = `${DOLL_W * p.s}%`;
  fx.appendChild(el);
  sfx('swoosh', { rate: 1.2 });
  await tween(second ? 420 : 560, t => { el.style.top = `${start.top + (p.top - 3 - start.top) * t}%`; el.style.transform = `translate(-50%, -50%) rotate(${t * 220}deg) scale(${1 - t * 0.35})`; el.style.opacity = String(t > 0.82 ? 1 - (t - 0.82) * 5 : 1); }, t => t * t);
  el.remove();
  sfx('pop'); buzz([25, 30, 25]);
  const glow = $('cw-chute'); glow?.classList.remove('glow'); void glow?.offsetWidth; glow?.classList.add('glow');
}
// 아래 상품 문이 열리고 인형이 기쁨 자세로 튀어나온다 → 위 띠로 날아간다.
async function prizeOut(prizes, res) {
  const door = $('cw-door'); if (!door) return;
  const gold = prizes.some(p => p.g), big = gold || prizes.length > 1;
  door.innerHTML = `${img('prize-door', 'cw-door-img', '<i class="cw-door-css"></i>')}${prizes.map((p, i) => `<span class="cw-pop${p.g ? ' gold' : ''}" style="--i:${i}">${p.g && has('gold-aura') ? `<img class="cw-pop-aura" src="${src('gold-aura')}" alt="">` : ''}<img src="${dollSrc(p.k, 'joy')}" alt="" draggable="false"></span>`).join('')}`;
  door.className = 'cw-door open';
  if (big) { sfx('fanfare-epic'); buzz([40, 60, 40, 60, 40, 60, 160]); flash(gold ? 'gold' : 'jackpot'); } else { sfx('fanfare-basic'); buzz([30, 50, 30, 50, 80]); }
  confetti(DOOR.left + DOOR.w / 2, DOOR.top + 4, big ? 18 : 10);
  const name = prizes.map(p => dollName(p.k, !!p.g)).join(' + ');
  say(`${prizes.length > 1 ? '대박! 두 개! ' : ''}<b>${esc(name)}</b> 인형!${res.fresh ? ' <em>NEW</em>' : ''}${res.coins ? ` ${coin()}+${res.coins}` : ''}`, big ? 'big' : '');
  if (res.fresh) later(() => sfx('stamp'), 500);
  if (res.coins) { later(() => { sfx('coins'); coinShower(root().querySelector('.cw-app'), Math.min(24, 6 + res.coins), 1); }, 700); }
  if (res.complete) later(() => complete(), 1400);
  hud();
  await wait(1500);
  door.className = 'cw-door';
  later(() => { if (door.className === 'cw-door') door.innerHTML = ''; }, 500);
}
// 놓침: lift(올라가다 미끄러짐) · chute(배출구 쪽으로 가다 떨어짐) · loose(쥐다 빠짐). 인형은 제자리로 굴러 돌아온다.
// V13.191 near-miss: 버팀(인형이 발톱에서 흔들림 · 끼익) → 미끄러지는 순간 멈춤(hit-stop) · 툭 · 솜털 → 짧은 흔들림 →
//   슬로모션으로 떨어지기 시작 → 한 박자 늦은 "아깝다!" 문구 · 소리 · 진동. 세기는 plan(claw-fx.js: 조준이 가까울수록 더 아슬아슬).
async function slipLift(res, doll, plan) {
  const k = C.claw, node = dollNode(doll.i), from = { x: k.x, y: k.y };
  if (res.slip === 'loose') {
    await tween(300, t => { k.drop = 1 - t * plan.lift; drawClaw(); });
    clawPic('closed'); node?.classList.remove('lifted');
    await slipMoment(plan, slipPoint(node, plan.lift));
    tumbleBack(node, doll, plan.lift);
    await tween(850, t => { k.drop = (1 - plan.lift) * (1 - t); k.sway = Math.sin(t * 10) * 4 * (1 - t); drawClaw(); });
    return;
  }
  if (node) node.style.visibility = 'hidden';
  k.held = true; pendOn(res.grip);
  // V13.204 물리: 배출구 쪽 놓침은 배출구 턱 위까지 가서(0.6 → 0.9) 턱에 걸쳐 흔들리다 넘어간다.
  const teeter = res.slip === 'chute' && !!C.P && !!node, reach = teeter ? 0.9 : 0.6;
  await tween(res.slip === 'lift' ? 620 : 1000, t => { k.drop = 1 - t * plan.lift; k.sway = Math.sin(t * 9) * (3 + t * 4); drawClaw(); });
  if (res.slip === 'chute') await tween(700, t => { k.x = from.x + (HOME.x - from.x) * t * reach; k.y = from.y + (HOME.y - from.y) * t * reach; k.sway = Math.sin(t * 12) * 6; drawClaw(); });
  await strain(plan);
  // 미끄러진다.
  clawPic('closed'); k.held = false; drawClaw();
  if (node) node.style.visibility = '';
  node?.classList.remove('lifted');
  if (teeter) await chuteTeeter(node, doll, plan);
  else {
    await slipMoment(plan, slipPoint(node, 1 - k.drop, { x: k.x, y: k.y }));
    await tumbleBack(node, doll, 1 - k.drop, { x: k.x, y: k.y }, plan);
  }
  const back = { x: k.x, y: k.y };
  await tween(700, t => { k.drop = Math.max(0, k.drop - t * k.drop); if (res.slip === 'chute') { k.x = back.x; k.y = back.y; } k.sway = Math.sin(t * 8) * 3 * (1 - t); drawClaw(); });
}
// 허공: 인형을 들지 않는다. 바닥 먼지가 살짝 일고, 한 박자 뒤 짧은 문구.
async function airLift(plan) {
  const k = C.claw, p = floorAt(k.x, k.y);
  puff(p.left, p.top - 2, plan.particles, 'dust');
  buzz(plan.buzz);
  later(() => say(esc(plan.text), 'sad air'), plan.delay);
  await tween(1000, t => { k.drop = 1 - t; k.sway = Math.sin(t * 9) * 3 * (1 - t); drawClaw(); });
}
// 버팀: 들린 인형이 발톱에서 흔들흔들(쥔 힘이 셀수록 오래) · 집게 끼익 · GRIP 숫자가 떨린다.
async function strain(plan) {
  if (!plan.strain) return;
  const k = C.claw, claw = $('cw-claw'), ro = $('cw-readout'), base = k.sway;
  sfx('claw-strain'); buzz([12, 50, 12]);
  claw?.classList.add('strain'); ro?.classList.add('strain');
  const swings = Math.max(1, Math.round(plan.strain / 210));
  await tween(plan.strain, (e, t) => { const w = Math.sin(t * Math.PI * 2 * swings) * (2 + t * 6); if (C.pend) k.wob = w; else k.sway = base * (1 - t) + w; drawClaw(); }, t => t);
  k.wob = 0;
  claw?.classList.remove('strain'); ro?.classList.remove('strain');
}
// 인형이 빠지는 자리(기계 그림 %): 집게 아래 인형 높이.
function slipPoint(node, height, at = null) {
  const doll = node ? { left: parseFloat(node.style.left), top: parseFloat(node.style.top) } : null;
  const p = at ? floorAt(at.x, at.y) : doll || floorAt(C.claw.x, C.claw.y);
  return { left: p.left, top: (doll?.top ?? p.top) - height * 22 };
}
// 미끄러지는 순간: 멈춤(hit-stop) → 툭 소리 · 진동 · 솜털 · 짧은 흔들림, 그리고 한 박자 늦게 "아깝다!".
async function slipMoment(plan, at) {
  const stage = $('cw-stage'), ro = $('cw-readout');
  if (plan.hitStop) {
    stage?.classList.add('hitstop'); physPause(plan.hitStop);
    await new Promise(r => later(r, plan.hitStop));
    stage?.classList.remove('hitstop');
  }
  if (plan.sounds.includes('claw-slip')) sfx('claw-slip'); else sfx('reel-plop');
  buzz(plan.buzz);
  puff(at.left, at.top, plan.particles, plan.level);
  if (plan.shake) shake(plan.shake);
  if (ro && plan.level !== 'graze') { ro.textContent = 'SLIP!'; ro.classList.add('slip'); later(() => ro.classList.remove('slip'), 900); }
  later(() => {
    say(`${plan.badge ? `<b class="cw-near-badge">${esc(plan.badge)}</b>` : ''}${esc(plan.text)}`, `sad near ${plan.level}`);
    if (plan.sounds.includes('claw-aww')) sfx('claw-aww');
  }, plan.delay);
}
// V13.204 배출구 턱 흔들흔들(물리 켬 · 서버가 chute 놓침으로 정한 판만): 인형이 턱에 툭 걸침 → 심장 소리와 함께 안 · 밖으로 흔들흔들
//   (느리게) → 늘 바깥(더미 쪽)으로 넘어감 → 멈칫 · SLIP! · "아깝다!!" → 물리로 굴러 제자리. 결과(놓침)는 바뀌지 않는다.
async function chuteTeeter(node, doll, plan) {
  const k = C.claw, img0 = node.querySelector('.cw-doll-img'), z0 = node.style.zIndex, stage = $('cw-stage'), ro = $('cw-readout');
  const from = slipPoint(node, 1 - k.drop, { x: k.x, y: k.y });
  C.pin = doll.i;
  if (img0) img0.src = dollSrc(doll.k, 'fall');
  node.style.zIndex = 999; node.classList.add('teeter');
  await tween(220, t => { node.style.left = `${from.left + (LIP.left - from.left) * t}%`; node.style.top = `${from.top + (LIP.top - from.top) * t}%`; node.style.transform = `translate(-50%, -96%) rotate(${(-14 * t).toFixed(1)}deg)`; }, t => t * t);
  sfx('reel-plop', { gain: 0.5, rate: 0.8 }); buzz([30]);
  stage?.classList.add('slowmo');
  if (ro) { ro.textContent = '!!'; ro.classList.add('strain'); }
  const tt = makeTeeter(doll.i), t0 = performance.now();
  let last = t0, beats = 0;
  await new Promise(res => {
    const f = now => {
      if (C?.pin !== doll.i || C.closing) return res();
      const r = tt.step(now - last); last = now;
      node.style.transform = `translate(-50%, -96%) rotate(${r.deg.toFixed(2)}deg)`;
      if (now - t0 >= beats * 430) { heartbeat(); beats++; }
      if (r.done) res(); else requestAnimationFrame(f);
    };
    requestAnimationFrame(f);
  });
  stage?.classList.remove('slowmo'); ro?.classList.remove('strain');
  if (!C) return;
  C.pin = null;
  await slipMoment(plan, { left: LIP.left, top: LIP.top - 6 });
  node.classList.remove('teeter'); node.style.zIndex = z0;
  return physTumble(doll, img0, { x: LIP.left * W / 100 + 6, y: LIP.top * H / 100 - dollSize(doll) * 0.46 }, null);
}
// 쿵쿵(심장): 낮은 쿵 두 번 · 진동 · 화면이 살짝 두근.
function heartbeat() {
  sfx('fish-thump', { gain: 0.5, rate: 0.62 }); later(() => sfx('fish-thump', { gain: 0.35, rate: 0.7 }), 150);
  buzz([35, 110, 25]);
  const s = $('cw-stage'); if (s) { s.classList.remove('beat'); void s.offsetWidth; s.classList.add('beat'); }
}
// 인형이 집게 높이에서 떨어져 뒹굴며 제자리에 앉는다.
async function tumbleBack(node, doll, height, at = null, plan = null) {
  if (!node) return;
  const img0 = node.querySelector('.cw-doll-img');
  if (img0) img0.src = dollSrc(doll.k, 'fall');
  const home = floorAt(doll.x, doll.y), sp = at ? floorAt(at.x, at.y) : home;
  const fromTop = parseFloat(placeTop(doll)) - height * 22, fromLeft = sp.left;
  if (C.P?.bodies.has(doll.i)) return physTumble(doll, img0, { x: fromLeft * W / 100, y: fromTop * H / 100 - dollSize(doll) * 0.46 }, plan);
  // V13.191 슬로모션: 떨어지기 시작 plan.slowMs(보통 시간)를 plan.slow 배로 느리게, 나머지는 보통 속도.
  const slow = plan && plan.slow < 1 ? plan : null, fall = 520, real = slow ? fall - slow.slowMs + slow.slowMs / slow.slow : fall;
  const warp = slow ? t => { const r = t * real, n = r < slow.slowMs / slow.slow ? r * slow.slow : slow.slowMs + r - slow.slowMs / slow.slow, u = n / fall; return u * u; } : t => t * t;
  if (slow) { $('cw-stage')?.classList.add('slowmo'); later(() => $('cw-stage')?.classList.remove('slowmo'), slow.slowMs / slow.slow); }
  await tween(real, t => { node.style.top = `${fromTop + (parseFloat(placeTop(doll)) - fromTop) * t}%`; node.style.left = `${fromLeft + (home.left - fromLeft) * t}%`; node.style.transform = `rotate(${(1 - t) * 160}deg)`; }, warp);
  node.style.transform = '';
  if (img0) img0.src = dollSrc(doll.k, '', true);
  node.classList.remove('bump'); void node.offsetWidth; node.classList.add('bump');
}
// V13.203 물리로 떨어지기: 집으로 가는 가로 속도를 주고 놓으면, 같은 줄 인형에 부딪고 튀고 굴러 제자리에 앉는다.
//   슬로모션은 물리 시간 자체를 늦춘다. 첫 닿음에서 다음 연출로 넘어가고(늦어도 1.6초), 튀기 · 구르기는 그 뒤로도 이어진다.
function physTumble(doll, img0, from, plan) {
  const home = homeOf(doll), steps = Math.sqrt(2 * Math.max(20, home.y - from.y) / 0.36);
  const slow = plan && plan.slow < 1 ? plan : null;
  if (slow) {
    C.physScale = slow.slow; $('cw-stage')?.classList.add('slowmo');
    later(() => { C.physScale = 1; $('cw-stage')?.classList.remove('slowmo'); }, slow.slowMs / slow.slow);
  }
  const sway = (C.claw.sway || 0) * 0.12, spin = (Math.sign(home.x - from.x) || 1) * (0.06 + Math.random() * 0.08);
  return new Promise(res => {
    let done = false;
    const fin = () => { if (!done) { done = true; res(); } };
    C.P.drop(doll.i, from, { x: (home.x - from.x) / steps + sway + (Math.random() - 0.5) * 0.8, y: -0.4 }, spin, (kind, v) => {
      if (kind === 'touch') { squash(doll.i); if (v > 4) sfx('reel-plop', { gain: 0.4 }); fin(); }
      if (kind === 'rest' && img0) img0.src = dollSrc(doll.k, '', true);
    });
    physRun();
    later(fin, 1600);
    later(() => { if (img0) img0.src = dollSrc(doll.k, '', true); }, 2400);
  });
}
// 내려간 집게 위치(집게 그림 윗변 %): 인형이 있으면 발톱이 인형 위쪽 1/3을 감싸게, 없으면 바닥까지.
function clawBottom(target, p) {
  const clawH = CLAW_W * p.s * (2 / 3) * 0.94;
  if (!target) return p.top - clawH - 0.4;
  const tp = floorAt(target.x, target.y), dollH = DOLL_W * tp.s * target.s * (2 / 3) * 0.86;
  const feet = tp.top - target.z * LIFT * tp.s;
  return feet - dollH + dollH * 0.42 - clawH;
}
const placeTop = d => { const p = floorAt(d.x, d.y); return `${p.top - d.z * LIFT * p.s}%`; };

/* ---------- 판 끝 ---------- */
async function roundEnd(res) {
  C.phase = 'result'; mid();
  await wait(500);
  const sum = res.summary || { won: C.got, coins: 0 };
  const won = sum.won || [];
  const v = C.v || {};
  const cards = won.map((d, i) => `<span class="cw-r-doll${d.g ? ' gold' : ''}" style="--i:${i}">${d.g && has('gold-aura') ? `<img class="cw-pop-aura" src="${src('gold-aura')}" alt="">` : ''}<img src="${dollSrc(d.k, 'joy')}" alt=""><b>${esc(dollName(d.k, !!d.g))}</b></span>`).join('');
  const can = Number(v.tickets || 0) > 0;
  layer(`<div class="cw-sheet cw-result ${won.length ? 'win' : 'lose'}" role="dialog" aria-label="이번 판 결과">
    <h2>${won.length ? `인형 ${won.length}개를 뽑았어요!` : '아깝다! 이번 판은 꽝'}</h2>
    ${won.length ? `<div class="cw-r-row">${cards}</div>` : `<p class="cw-r-sad">${img('icon-box', 'cw-r-box', '🎁')}<span>놓칠수록 다음 집게가 조금씩 더 잘 잡혀요${v.pity ? ` (지금 +${v.pity}%)` : ''}.</span></p>`}
    ${sum.coins ? `<p class="cw-r-coins">${coin()}<b id="cw-r-coin">0</b> 코인</p>` : won.length ? `<p class="cw-r-note">오늘 인형 코인(${CLAW.COIN_DAILY})을 다 받았어요. 도감은 계속 채워져요!</p>` : ''}
    <p class="cw-r-book">도감 <b>${num(v.kinds || 0)}/${num(v.all || 12)}</b> · 황금 <b>${num(v.gold_kinds || 0)}/12</b></p>
    <div class="cw-r-btns">
      <button type="button" class="yl-cta" data-cw="again" ${can ? '' : 'disabled'}>${can ? `한 판 더 (집게권 ${num(v.tickets)}장)` : '집게권 0장'}</button>
      <button type="button" class="btn" data-cw="book">📖 도감</button>
      <button type="button" class="btn" data-cw="close-layer">닫기</button>
    </div></div>`);
  if (sum.coins) later(() => countUp($('cw-r-coin'), sum.coins, 700), 300);
  if (won.length) { sfx('stamp'); confetti(50, 30, 16, true); } else sfx('fail', { gain: 0.6 });
  idle();
}
async function refreshHome() {
  try { const res = await api('/claw/home', {}); if (!C) return; setView(res.claw); if (res.claw.live) return begin(res.claw.live, true); } catch {}
  idle();
}
function complete() {
  sfx('fanfare-legend'); buzz([80, 60, 80, 60, 200]); flash('gold');
  say(`<b>도감 완성!</b> 열두 띠 인형을 다 모았어요 ${coin()}+${CLAW.BOOK_BONUS}`, 'big');
  confetti(50, 40, 28, true);
}

/* ---------- 반 소식 ---------- */
// V13.191 같은 학교 · 학년 친구의 황금 인형 · 대박 · 도감 소식 한 줄(server/claw-news.mjs, 최근 하루 3개). 여럿이면 5초마다 넘긴다.
function news(list) {
  if (!C || !Array.isArray(list)) return;
  C.news = list.slice(0, 3); C.newsAt = 0;
  showNews();
}
const ago = at => { const m = Math.max(0, Math.round((Date.now() - at) / 60000)); return m < 1 ? '방금' : m < 60 ? `${m}분 전` : `${Math.floor(m / 60)}시간 전`; };
function showNews() {
  const box = $('cw-news'); if (!box || !C) return;
  clearTimeout(C.newsTimer);
  const n = C.news?.length ? C.news[C.newsAt % C.news.length] : null;
  box.hidden = !n;
  if (!n) { box.innerHTML = ''; return; }
  box.innerHTML = `<span class="cw-news-tag"><span aria-hidden="true">📣</span>반 소식</span><p class="cw-news-text">${esc(n.text)}</p><small>${ago(n.at)}</small>`;
  if (C.news.length > 1 && !reduced()) C.newsTimer = later(() => { C.newsAt++; showNews(); }, 5000);
}

/* ---------- 효과 ---------- */
function say(html, cls = '') {
  const fx = $('cw-fx'); if (!fx) return;
  fx.querySelector('.cw-say')?.remove();
  fx.insertAdjacentHTML('beforeend', `<div class="cw-say ${cls}">${html}</div>`);
  const el = fx.querySelector('.cw-say');
  later(() => el?.classList.add('out'), 1900); later(() => el?.remove(), 2400);
}
function spark(left, top, n = 3) {
  const fx = $('cw-fx'); if (!fx) return;
  for (let i = 0; i < n; i++) {
    const s = document.createElement('span'); s.className = 'cw-spark';
    s.style.left = `${left + (Math.random() - 0.5) * 8}%`; s.style.top = `${top + (Math.random() - 0.5) * 4}%`; s.style.animationDelay = `${i * 60}ms`;
    s.innerHTML = img('fx-sparkle', '', '✦'); fx.appendChild(s); later(() => s.remove(), 900);
  }
}
function confetti(left, top, n = 12, wide = false) {
  const fx = $('cw-fx'); if (!fx || reduced()) return;
  const pics = ['fx-confetti', 'fx-star', 'fx-ribbon', 'fx-sparkle'].filter(has);
  for (let i = 0; i < n; i++) {
    const s = document.createElement('span'); s.className = 'cw-conf';
    const a = Math.random() * Math.PI * 2, r = (wide ? 30 : 16) + Math.random() * 14;
    s.style.left = `${left}%`; s.style.top = `${top}%`;
    s.style.setProperty('--dx', `${Math.cos(a) * r}vmin`); s.style.setProperty('--dy', `${Math.sin(a) * r - 10}vmin`); s.style.setProperty('--rot', `${Math.random() * 720 - 360}deg`);
    s.style.animationDelay = `${i * 22}ms`;
    s.innerHTML = pics.length ? `<img src="${src(pics[i % pics.length])}" alt="">` : ['🎀', '⭐', '✨', '💖'][i % 4];
    fx.appendChild(s); later(() => s.remove(), 1600);
  }
}
function flash(kind) {
  const fx = $('cw-fx'); if (!fx) return;
  fx.insertAdjacentHTML('beforeend', `<div class="cw-flash ${kind}">${img('fx-jackpot', 'cw-flash-burst')}</div>`);
  later(() => fx.querySelector('.cw-flash')?.remove(), 1400);
  const app = root().querySelector('.cw-app'); app?.classList.add('party'); later(() => app?.classList.remove('party'), 1600);
}
function shake(o = null) {
  const s = $('cw-stage'); if (!s) return;
  if (o) { s.style.setProperty('--shake-px', `${o.px}px`); s.style.setProperty('--shake-ms', `${o.ms}ms`); }
  else { s.style.removeProperty('--shake-px'); s.style.removeProperty('--shake-ms'); }
  s.classList.remove('shake'); void s.offsetWidth; s.classList.add('shake');
  if (C?.P && o) { C.P.jolt(o.px * 0.45); physRun(); }
}
// 놓침 솜털 · 반짝이(heart가 가장 많고 멀리), 허공은 바닥 먼지. 빨리 사라진다.
function puff(left, top, n, kind) {
  const fx = $('cw-fx'); if (!fx || !n) return;
  const far = kind === 'heart' ? 9 : kind === 'slip' ? 7 : 4;
  for (let i = 0; i < n; i++) {
    const s = document.createElement('span'); s.className = `cw-puff ${kind}`;
    const a = (i / n) * Math.PI * 2 + Math.random() * 0.5, r = far * (0.6 + Math.random() * 0.6);
    s.style.left = `${left}%`; s.style.top = `${top}%`;
    s.style.setProperty('--dx', `${Math.cos(a) * r}vmin`); s.style.setProperty('--dy', `${Math.sin(a) * r * 0.7 - (kind === 'dust' ? 2 : 0)}vmin`);
    s.style.animationDelay = `${i * 12}ms`;
    if (kind !== 'dust' && i % 3 === 0 && has('fx-sparkle')) s.innerHTML = img('fx-sparkle');
    fx.appendChild(s); later(() => s.remove(), 760);
  }
}
// 확대: 집게 둘레로 부드럽게(조준 중 버튼, 내릴 때 자동).
function toggleZoom() { C.zoom = !C.zoom; zoomTo(); mid(); }
function zoomTo(auto = null) {
  const z = $('cw-zoom'); if (!z || !C) return;
  const on = auto === true ? true : auto === false ? C.zoom : C.zoom;
  const scale = auto === true && !C.zoom ? 1.25 : on ? 1.6 : 1;
  const p = floorAt(C.claw.x, C.claw.y);
  z.style.transformOrigin = `${p.left}% ${p.top - 6}%`;
  z.style.transform = scale > 1 ? `scale(${scale})` : '';
}

/* ---------- 조이스틱 · 키보드 ---------- */
function bindStick() {
  const box = $('cw-stick'), knob = $('cw-knob'); if (!box) return;
  let id = null;
  const move = e => {
    const r = box.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2, max = r.width * 0.32;
    let dx = e.clientX - cx, dy = e.clientY - cy; const d = Math.hypot(dx, dy);
    if (d > max) { dx *= max / d; dy *= max / d; }
    knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
    const m = Math.hypot(dx, dy) / max;
    C.stick = m < 0.12 ? { x: 0, y: 0 } : { x: dx / max, y: dy / max };
  };
  box.addEventListener('pointerdown', e => { if (!C) return; unlockSound(); id = e.pointerId; box.setPointerCapture(id); box.classList.add('held'); move(e); if (C.phase === 'aim') buzz([6]); });
  box.addEventListener('pointermove', e => { if (C && e.pointerId === id) move(e); });
  const up = e => { if (!C || e.pointerId !== id) return; id = null; C.stick = { x: 0, y: 0 }; knob.style.transform = ''; box.classList.remove('held'); };
  box.addEventListener('pointerup', up); box.addEventListener('pointercancel', up);
}
const KEYS = { ArrowLeft: 'left', a: 'left', A: 'left', ArrowRight: 'right', d: 'right', D: 'right', ArrowUp: 'up', w: 'up', W: 'up', ArrowDown: 'down', s: 'down', S: 'down' };
function onKey(e, down) {
  if (!C || e.target?.closest?.('input, textarea')) return;
  if (KEYS[e.key]) { e.preventDefault(); if (down) C.keys.add(KEYS[e.key]); else C.keys.delete(KEYS[e.key]); return; }
  if (!down) return;
  if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); unlockSound(); if (C.phase === 'aim') drop(); else if (C.phase === 'idle' && !$('cw-layer')?.classList.contains('on')) start(); return; }
  if (e.key === 'z' || e.key === 'Z') { if (C.phase === 'aim') toggleZoom(); return; }
  if (e.key === 'Escape') layer('');
}

/* ---------- 도감 · 안내 ---------- */
function book() {
  const v = C.v || {}, b = v.book || [], gold = Number(v.gold || 0);
  const card = (k, i) => {
    const n = Number(b[i] || 0), d = DOLLS[k];
    return `<li class="cw-card ${n ? 'have' : 'none'}">${img('card', 'cw-card-frame')}<span class="cw-card-pic"><img class="${n ? '' : 'sil'}" src="${dollSrc(k, n ? 'joy' : '', !n)}" alt=""></span>
      <b>${n ? esc(d.ko) : '???'}</b><small>${n ? `${num(n)}번 뽑음` : `${esc(d.animal)} 인형`}</small></li>`;
  };
  const goldCard = (k, i) => { const on = (gold >> i) & 1; return `<li class="cw-gcard ${on ? 'have' : ''}" title="${esc(dollName(k, true))}">${img('card-gold', 'cw-card-frame')}<img class="cw-gpic ${on ? '' : 'sil'}" src="${dollSrc(k, '', true)}" alt=""></li>`; };
  const titles = ['claw1', 'claw6', 'claw12', 'clawgold', 'claw100'].map(key => {
    const t = TITLES[key], have = t.stat === 'claw_dolls' ? v.n : t.stat === 'claw_kinds' ? v.kinds : v.ng;
    const done = Number(have || 0) >= t.goal;
    return `<li class="${done ? 'done' : ''}"><b>${esc(t.name)}</b><small>${esc(t.how)}</small><span>${done ? '✓' : `${num(Math.min(have || 0, t.goal))}/${num(t.goal)}`}</span></li>`;
  }).join('');
  layer(`<div class="cw-sheet cw-book" role="dialog" aria-label="인형 도감">
    <header><h2>${img('badge-complete', 'cw-book-badge', '📖')} 인형 도감 <b>${num(v.kinds || 0)}/12</b></h2><button type="button" class="cw-x" data-cw="close-layer" aria-label="닫기">✕</button></header>
    <ul class="cw-cards">${DOLL_KEYS.map(card).join('')}</ul>
    <h3>✨ 황금 인형 <b>${num(v.gold_kinds || 0)}/12</b></h3>
    <ul class="cw-gcards">${DOLL_KEYS.map(goldCard).join('')}</ul>
    <h3>🏅 칭호</h3><ul class="cw-titles">${titles}</ul>
    <p class="cw-book-note">12종을 다 모으면 ${coin()}${CLAW.BOOK_BONUS}코인 · 인형 하나 ${CLAW.COIN}코인 · 황금 인형 ${CLAW.GOLD_COIN}코인(하루 ${CLAW.COIN_DAILY}코인까지)</p>
  </div>`);
}
function guide(first) {
  const v = C.v || {}, got = v.got || {};
  const row = (k, label) => `<li class="${got[k] ? 'done' : ''}"><span>${got[k] ? '✓' : '○'}</span>${label}</li>`;
  layer(`<div class="cw-sheet cw-guide" role="dialog" aria-label="인형뽑기 안내">
    <header><h2>🧸 인형뽑기</h2><button type="button" class="cw-x" data-cw="close-layer" aria-label="닫기">✕</button></header>
    <ol class="cw-steps"><li><b>집게권 넣기</b> 한 판 = 집게권 1장, 30초 동안 집게 ${CLAW.DROPS}번</li>
      <li><b>움직이기</b> 왼쪽 조이스틱(키보드: 방향키 · WASD). 바닥 그림자 아래 인형이 반짝이면 그 위예요</li>
      <li><b>DROP</b> 오른쪽 버튼(키보드: 스페이스). 인형 한가운데일수록 잘 잡혀요. 놓칠수록 다음 집게가 조금씩 더 세져요</li></ol>
    <h3>오늘 집게권 받기 (하루 최대 3장 · ${CLAW.TICKET_MAX}장까지 모아요)</h3>
    <ul class="cw-got">${row('practice', '연습 끝내기(10문제 이상)')}${row('attend', '출석 도장')}${row('match', '짝 맞추기 별 3개')}</ul>
    <p class="cw-book-note">인형 하나 ${coin()}${CLAW.COIN} · 황금 인형 ${coin()}${CLAW.GOLD_COIN} · 하루 ${CLAW.COIN_DAILY}코인까지. 열두 띠 인형을 다 모으면 ${CLAW.BOOK_BONUS}코인과 칭호!</p>
    <button type="button" class="yl-cta" data-cw="close-layer">좋아요!</button></div>`);
  if (first) api('/claw/home', { guide: true }).then(res => setView(res.claw)).catch(() => {});
}
