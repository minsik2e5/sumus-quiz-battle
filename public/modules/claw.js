import { api, esc, num, icon, toast } from './ui.js';
import { coin } from './emblems.js';
import { playSound, unlockSound, soundOn, preloadSound } from './sound.js';
import { coinShower, countUp } from './celebrate.js';
import { CLAW, DOLL_KEYS, DOLLS, dollName, roundLayout } from './claw-rules.js';
import { CLAW_ART } from './claw-art.js';
import { TITLES } from './titles.js';

// V13.180 인형뽑기(놀이터). 구성안 docs/claw-machine-design.md. 그림은 주문서 42 ~ 45(public/assets/claw).
// 3D 라이브러리 없이 그림 층 + 2.5D: 기계(속 빈 그림) → 인형 더미(깊이 순서) → 집게 뒤 발톱 → 잡힌 인형 → 앞 발톱 · 줄 · 레일 → 유리 반사 → 버튼.
// 판 배치 · 잡힘 · 놓침은 서버가 정한다(server/claw.mjs): 화면은 집게권 넣기 → 내린 위치 → 서버 결과 순서로 연출만 한다.
// 조작: 폰은 왼쪽 아래 조이스틱 + 오른쪽 아래 DROP, 키보드는 방향키 · WASD + 스페이스 · 엔터(Z 확대).
// 기계 그림 위 자리(그림 높이 · 너비의 %, 주문서 43-1을 재서 정했다): 바닥 뒤 50% · 앞 55.5%, 배출구는 앞 왼쪽.
const FLOOR = { back: 50, front: 55.5, l0: 26, r0: 74, l1: 17, r1: 83 };
const CEIL = { back: 23, front: 20.5 };
const HOME = { x: 0.15, y: 0.56 };            // 배출구 위(집게가 쉬는 곳)
const DOLL_W = 22;                            // 인형 너비(기계 너비 %, 앞줄 기준). V13.182 16.5 → 22: 유리 안이 비어 보여서
const CLAW_W = 21;
const LIFT = 5;                               // 층 하나 높이(기계 높이 %)
const DOOR = { left: 21, top: 75.5, w: 29, h: 17 }; // 아래 왼쪽 상품 문

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
  preloadSound(['coin', 'swoosh', 'wiggle', 'pop', 'stamp', 'fanfare-basic', 'fanfare-epic', 'fanfare-legend', 'coins', 'reel-plop', 'reel-click', 'tick', 'tap', 'fail']);
  idle();
  api('/claw/home', {}).then(res => {
    if (!C) return; setView(res.claw);
    if (res.claw?.live) return resume(res.claw.live);
    idle();
    if (!C.v?.guide) later(() => guide(true), 600);
  }).catch(err => { if (C) toast(err.message); });
}
function closeAll() {
  if (!C) return;
  C.closing = true; C.timers.forEach(clearTimeout); cancelAnimationFrame(C.raf);
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
}
const dollNode = i => $('cw-pile')?.querySelector(`.cw-doll[data-i="${i}"]`);
// 집게 · 줄 · 받침 · 레일 · 그림자를 지금 상태로.
function drawClaw() {
  if (!C) return;
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
  root().querySelector('.cw-app')?.classList.add('live');
  aim();
}
function aim() {
  if (!C) return;
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
  C.round.n = res.n + 1;
  // 2) 바닥에 닿음: 주변 인형이 출렁, 먼지 반짝.
  bumpAround(k.x, k.y);
  const doll = res.target != null ? C.dolls.find(d => d.i === res.target) : null;
  // 3) 쥔다.
  sfx('wiggle'); buzz([20, 40, 20]);
  gripCount(res.grip);
  if (doll && res.result !== 'miss') { clawPic('grip', doll); dollNode(doll.i)?.classList.add('lifted'); } else clawPic('closed');
  await wait(380);
  if (res.result === 'win') await winLift(res, doll);
  else if (res.result === 'slip' && doll) await slipLift(res, doll);
  else await tween(1000, t => { k.drop = 1 - t; k.sway = Math.sin(t * 9) * 3 * (1 - t); drawClaw(); });
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
    if (Math.hypot(x - d.x, y - d.y) <= CLAW.R * 2.2) { const n = dollNode(d.i); if (n) { n.classList.remove('bump'); void n.offsetWidth; n.classList.add('bump'); } }
  }
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
  dollNode(doll.i)?.remove();
  k.held = true;
  await tween(1050, t => { k.drop = 1 - t; k.sway = Math.sin(t * 7) * 4 * (1 - t * 0.6); drawClaw(); });
  const from = { x: k.x, y: k.y };
  sfx('reel-click', { gain: 0.3, rate: 0.6 });
  await tween(900, t => { k.x = from.x + (HOME.x - from.x) * t; k.y = from.y + (HOME.y - from.y) * t; k.sway = Math.sin(t * 6) * 3; drawClaw(); });
  // 놓는다.
  clawPic('open'); k.held = false; drawClaw();
  await fallIntoChute(doll);
  if (res.extra) { const b = C.dolls.find(d => d.i === res.extra.i); dollNode(res.extra.i)?.remove(); if (b) await fallIntoChute(b, true); }
  C.won |= 1 << doll.i; if (res.extra) C.won |= 1 << res.extra.i;
  // 둘레 인형이 빈자리로 살짝 내려앉는다.
  for (const n of res.nudge || []) { const d = C.dolls.find(x => x.i === n.i); if (!d) continue; d.x += n.dx; d.y += n.dy; const el = dollNode(d.i); if (el) { el.classList.add('settle'); placeDoll(el, d); } }
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
async function slipLift(res, doll) {
  const k = C.claw, node = dollNode(doll.i), from = { x: k.x, y: k.y };
  if (res.slip === 'loose') {
    await tween(300, t => { k.drop = 1 - t * 0.12; drawClaw(); });
    clawPic('closed'); node?.classList.remove('lifted'); tumbleBack(node, doll, 0.12);
    await tween(850, t => { k.drop = 0.88 * (1 - t); k.sway = Math.sin(t * 10) * 4 * (1 - t); drawClaw(); });
    return;
  }
  if (node) node.style.visibility = 'hidden';
  k.held = true;
  const upTo = res.slip === 'lift' ? 0.45 : 1;
  await tween(res.slip === 'lift' ? 620 : 1000, t => { k.drop = 1 - t * upTo; k.sway = Math.sin(t * 9) * (3 + t * 4); drawClaw(); });
  if (res.slip === 'chute') await tween(700, t => { k.x = from.x + (HOME.x - from.x) * t * 0.6; k.y = from.y + (HOME.y - from.y) * t * 0.6; k.sway = Math.sin(t * 12) * 6; drawClaw(); });
  // 미끄러진다.
  clawPic('closed'); k.held = false; drawClaw();
  sfx('reel-plop'); buzz([60]);
  if (node) node.style.visibility = '';
  node?.classList.remove('lifted');
  shake();
  say(res.slip === 'chute' ? '아깝다! 거의 다 왔는데…' : '앗, 미끄러졌어요!', 'sad');
  await tumbleBack(node, doll, 1 - k.drop, { x: k.x, y: k.y });
  const back = { x: k.x, y: k.y };
  await tween(700, t => { k.drop = Math.max(0, k.drop - t * k.drop); if (res.slip === 'chute') { k.x = back.x; k.y = back.y; } k.sway = Math.sin(t * 8) * 3 * (1 - t); drawClaw(); });
}
// 인형이 집게 높이에서 떨어져 뒹굴며 제자리에 앉는다.
async function tumbleBack(node, doll, height, at = null) {
  if (!node) return;
  const img0 = node.querySelector('.cw-doll-img');
  if (img0) img0.src = dollSrc(doll.k, 'fall');
  const home = floorAt(doll.x, doll.y), sp = at ? floorAt(at.x, at.y) : home;
  const fromTop = parseFloat(node.style.top) - height * 22, fromLeft = sp.left;
  await tween(520, t => { node.style.top = `${fromTop + (parseFloat(placeTop(doll)) - fromTop) * t}%`; node.style.left = `${fromLeft + (home.left - fromLeft) * t}%`; node.style.transform = `rotate(${(1 - t) * 160}deg)`; }, t => t * t);
  node.style.transform = '';
  if (img0) img0.src = dollSrc(doll.k, '', true);
  node.classList.remove('bump'); void node.offsetWidth; node.classList.add('bump');
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
function shake() { const s = $('cw-stage'); s?.classList.remove('shake'); void s?.offsetWidth; s?.classList.add('shake'); }
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
