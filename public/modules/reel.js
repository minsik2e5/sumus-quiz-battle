import { api, esc, num, icon, toast, buttonBusy } from './ui.js';
import { avatar } from './character.js';
import { coin } from './emblems.js';
import { playSound, unlockSound, soundOn, preloadSound } from './sound.js';
import { coinShower } from './celebrate.js';
import { buyEgg } from './pet-moments.js';
import { FISH, FISH_KEYS, RARITY, kgText } from './fishing-rules.js';
import { REEL, SEA_PETS, stars, pearlsOf } from './reel-rules.js';
import { fishPic, fishShadow } from './fishing-art.js';

// V13.150 손맛 낚시(놀이터), 1인칭 판. 단어 없이 던지기 · 입질 · 파이팅 · 마무리 점프. 미끼는 공부로 번다(server/reel.mjs).
//   던지기: 릴 버튼을 꾹 눌러 반원 게이지의 금색 칸에서 떼기 → 낚싯대가 뒤로 젖혀졌다가 휙.
//   입질: 찌가 톡톡(가짜) 하다가 쑥 들어가면 탭(챔질). 일찍 두 번 누르면 놓친다.
//   파이팅: 꾹 누르면 감기(거리 ↓, 텐션 ↑), 떼면 풀기. 물고기 성격(등급마다 FIGHT.moves):
//     돌진 run → 반대쪽으로 스와이프(누른 채 끌어도 된다), 날뜀 thrash → 손 떼기, 잠수 dive → 꾹 버티기.
//     텐션이 빨간 칸 끝에 오래 있으면 줄이 끊기고, 오래 느슨하면 빠져나간다. 펫 특기 구슬이 차면 위로 쓸어 올려 한 번에 끌어온다.
//   마무리: 거리가 0이 되면 물고기가 뛰어오른다(슬로모션). 고리가 맞을 때 탭하면 퍼펙트(무게 +8%, 서버가 곱한다).
// 낚싯대는 코드로 그린다(휘는 정도 · 방향이 매 프레임 바뀐다). 그림(주문서 26 · 27 · 29)은 FISHING_ART에 이름이 있으면 쓴다.
export const FISHING_ART = new Set([
  'bait-can', 'bg-entry', 'bg-sea', 'bg-under', 'bobber', 'bobber-bite', 'btn-cast', 'btn-left', 'btn-reel', 'btn-right', 'fx-perfect', 'fx-ripple', 'fx-splash', 'fx-star', 'hook', 'line-snap', 'lure-gold', 'lure-shrimp', 'lure-spinner', 'lure-worm', 'net', 'pearl', 'power', 'reel', 'rod', 'rod-bend1', 'rod-bend2', 'shop', 'skill-empty', 'skill-full', 'tension',
  ...FISH_KEYS.map(k => `hang-${k}`)
]);
const has = name => FISHING_ART.has(name);
const art = (name, fallback, cls = '') => has(name) ? `<img class="rl-art rl-art-${name} ${cls}" src="/assets/fishing/${name}.webp" alt="" draggable="false">` : fallback;
const pearlIco = () => art('pearl', '<i class="rl-pearl-ico"></i>');

let R = null;
const root = () => document.getElementById('app');
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)');
const reduced = () => REDUCED.matches;
const sfx = (key, opts) => { if (soundOn()) playSound(key, opts); };
const buzz = p => { try { if (soundOn()) navigator.vibrate?.(p); } catch {} };
function later(fn, ms) { const cur = R; const t = setTimeout(() => { if (R === cur && !cur.closing) fn(); }, ms); cur.timers.push(t); return t; }
const wait = ms => new Promise(r => later(r, ms));
const STAR = n => `<span class="rl-stars" aria-label="별 ${n}개">${'★'.repeat(n)}<s>${'★'.repeat(5 - n)}</s></span>`;
const $ = id => document.getElementById(id);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, k) => a + (b - a) * k;
const rnd = ([a, b]) => a + Math.random() * (b - a);
const RARITY_GLOW = { common: '#94a3b8', uncommon: '#4ade80', rare: '#60a5fa', epic: '#c084fc', legend: '#fbbf24', golden: '#facc15' };

export function openReel(A, exit) {
  closeAll();
  R = { A, exit, timers: [], v: A.data.rewards?.reel || null, phase: 'dock', rig: newRig(), bob: null };
  A.screen = 'reel';
  root().innerHTML = `<div class="session-app rl-app rl2"><header class="rl-top"><button type="button" class="yb-back" data-rl="exit" aria-label="나가기">${icon('back')}</button><strong>낚시터</strong>
    <button type="button" class="rl-chip bait" id="rl-bait" data-rl="bait" aria-label="미끼">${art('bait-can', '<i class="rl-can-ico"></i>')}<b>0</b></button><span class="rl-chip pearl" id="rl-pearl" aria-label="진주">${pearlIco()}<b>0</b></span><button type="button" class="rl-q" data-rl="guide" aria-label="낚시터 안내">?</button></header>
    <main id="rl-main" class="rl-main"></main></div>`;
  root().onclick = onClick;
  window.scrollTo(0, 0);
  preloadSound(['fanfare-basic', 'fanfare-epic', 'fanfare-legend', 'crit', 'coins', 'fail', 'wiggle', 'crack', 'burst', 'ult-impact', 'ult-riser']);
  scene();
  chips();
  dock();
  R.raf = requestAnimationFrame(frame);
  R.onResize = () => R && sizeRig();
  addEventListener('resize', R.onResize);
  if (R.v && !R.v.guide) later(() => guide(true), 400);
}
function closeAll() {
  if (!R) return;
  R.closing = true; R.timers.forEach(clearTimeout); cancelAnimationFrame(R.raf);
  if (R.onResize) removeEventListener('resize', R.onResize);
}
async function leave() {
  if (['fight', 'wait', 'bite', 'cast', 'finish'].includes(R?.phase)) { if (!confirm('낚시를 그만둘까요? 던진 미끼는 사라져요.')) return; await land('lost', null, true); }
  const exit = R?.exit; closeAll(); root().onclick = null; R = null; await exit?.();
}
function chips() {
  const v = R.v || {};
  const b = document.querySelector('#rl-bait b'), p = document.querySelector('#rl-pearl b');
  if (b) b.textContent = num(v.bait || 0);
  if (p) p.textContent = num(v.pearls || 0);
  const n = Object.values(v.net || {}).reduce((a, x) => a + x, 0), badge = $('rl-net-n');
  if (badge) { badge.textContent = n ? num(n) : ''; badge.hidden = !n; }
}
const setView = v => { if (!v || !R) return; R.v = v; R.A.data.rewards ||= {}; R.A.data.rewards.reel = v; chips(); };

function onClick(event) {
  const b = event.target.closest('[data-rl]');
  if (!b || b.disabled || !R) return;
  unlockSound();
  const act = b.dataset.rl;
  if (act === 'exit') return leave();
  if (act === 'guide') return guide(false);
  if (act === 'bait') return baitInfo();
  if (act === 'net') return tank();
  if (act === 'shop') return shop();
  if (act === 'book') return book();
  if (act === 'dock') { closeSheet(); closeTank(); return dock(); }
  if (act === 'close-sheet') return closeSheet();
  if (act === 'close-tank') return closeTank();
  if (act === 'sell-all') return sell(null, b);
  if (act === 'sell') return sell(b.dataset.key, b);
  if (act === 'coins') return exchangeCoins(Number(b.dataset.n), b);
  if (act === 'egg') return exchangeEgg(b.dataset.item, b);
  if (act === 'sea') return exchangeSea(b.dataset.key, b);
  if (act === 'skill') return useSkill();
}

/* ---------- 1인칭 장면: 배경 · 펫 · 찌 · 물고기 그림자 · 낚싯대(코드 그림) · 줄 ---------- */
function scene() {
  const pet = R.A.data.stats?.pet;
  const bg = has('bg-pov') ? art('bg-pov', '') : has('bg-sea') ? art('bg-sea', '') : '';
  $('rl-main').innerHTML = `<div class="rl-pov${bg ? ' art' : ''}" id="rl-pov" data-phase="dock">
    <div class="rl-world" id="rl-world">
      <div class="rl-bg">${bg || '<div class="rl-sky"><i class="rl-sun"></i><i class="rl-cloud a"></i><i class="rl-cloud b"></i><i class="rl-isle"></i></div><div class="rl-water"><i class="rl-wave w1"></i><i class="rl-wave w2"></i><i class="rl-wave w3"></i></div>'}</div>
      <i class="rl-glint a"></i><i class="rl-glint b"></i><i class="rl-glint c"></i>
      <div class="rl-shadow" id="rl-shadow" hidden><i></i></div>
      <div class="rl-bob" id="rl-bob">${art('bobber', '<i class="rl-bob-code"></i>')}${has('bobber-bite') ? art('bobber-bite', '', 'bite') : ''}</div>
      <div class="rl-fxl" id="rl-fx"></div>
    </div>
    <svg class="rl-rig" id="rl-rig" aria-hidden="true">
      <defs>
        <linearGradient id="rl-rodg" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stop-color="#0f766e"/><stop offset=".45" stop-color="#5eead4"/><stop offset=".6" stop-color="#ecfeff"/><stop offset="1" stop-color="#14b8a6"/></linearGradient>
        <linearGradient id="rl-corkg" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stop-color="#92400e"/><stop offset=".5" stop-color="#d6a46a"/><stop offset="1" stop-color="#a16207"/></linearGradient>
        <radialGradient id="rl-reelgrad" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#ecfdf5"/><stop offset=".5" stop-color="#34d399"/><stop offset="1" stop-color="#047857"/></radialGradient>
      </defs>
      <path class="rl-line2" id="rl-line2" d=""/>
      <path class="rl-rod-body" id="rl-rod" d=""/>
      <path class="rl-rod-cork" id="rl-cork" d=""/>
      <g id="rl-guides"></g>
      <g class="rl-reel-g" id="rl-reelg"><circle class="spool" r="1"/><circle class="cap" r="1"/><g id="rl-crank"><rect class="arm"/><circle class="knob" r="1"/></g></g>
    </svg>
    <div class="rl-pet" id="rl-pet">${pet ? avatar(pet.key, { form: Math.max(1, pet.form ?? 1) }) : ''}<span class="rl-say" id="rl-say" hidden></span></div>
    <nav class="rl-side-menu" aria-label="낚시터 메뉴">
      <button type="button" class="rl-ico" data-rl="net" aria-label="수조(어망)">${art('icon-net', art('net', '<i class="rl-ico-net"></i>'))}<i class="rl-badge" id="rl-net-n" hidden></i><small>수조</small></button>
      <button type="button" class="rl-ico" data-rl="shop" aria-label="교환소">${art('icon-shop', art('shop', '<i class="rl-ico-shop"></i>'))}<small>교환소</small></button>
      <button type="button" class="rl-ico" data-rl="book" aria-label="도감">${art('icon-book', '<i class="rl-ico-book"></i>')}<small>도감</small></button>
    </nav>
    <div class="rl-cue" id="rl-cue" aria-live="assertive"></div>
    <div class="rl-hud" id="rl-hud"></div>
  </div>`;
  sizeRig();
}
function sizeRig() {
  const pov = $('rl-pov'), svg = $('rl-rig');
  if (!pov || !svg) return;
  const r = pov.getBoundingClientRect();
  R.W = r.width; R.H = r.height;
  svg.setAttribute('viewBox', `0 0 ${r.width} ${r.height}`);
}
const say = (text, ms = 2200) => {
  const el = $('rl-say');
  if (!el) return;
  el.textContent = text; el.hidden = false; el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop');
  clearTimeout(R.sayT); R.sayT = later(() => { el.hidden = true; }, ms);
};
function petFace(expression) {
  const pet = R.A.data.stats?.pet, el = $('rl-pet');
  if (!pet || !el || el.dataset.face === expression) return;
  el.dataset.face = expression;
  el.firstElementChild?.remove();
  el.insertAdjacentHTML('afterbegin', avatar(pet.key, { form: Math.max(1, pet.form ?? 1), expression: expression === 'idle' ? undefined : expression }));
}

/* 낚싯대: 손잡이(아래)에서 끝까지 2차 곡선. back(던지기 전 젖힘) · bend(휨) · dir(휘는 방향)을 용수철처럼 따라간다. */
const newRig = () => ({ back: 0, bend: 0, dir: 0, vb: 0, vbe: 0, vd: 0, tBack: 0, tBend: .04, tDir: 0, crank: 0, spin: 0 });
function springTo(rig, dt) {
  const k = 170, d = 13;
  for (const [x, v, t] of [['back', 'vb', 'tBack'], ['bend', 'vbe', 'tBend'], ['dir', 'vd', 'tDir']]) {
    rig[v] += ((rig[t] - rig[x]) * k - rig[v] * d) * dt;
    rig[x] += rig[v] * dt;
  }
  rig.crank += rig.spin * dt;
}
function rodGeom() {
  const { W, H, rig } = R, s = W / 390;
  const B = [W * .6, H * 1.03];
  const rest = [W * .67, H * .43], up = [W * .83, H * .17];
  const straight = [lerp(rest[0], up[0], rig.back), lerp(rest[1], up[1], rig.back)];
  const bend = clamp(rig.bend, 0, 1.15);
  const tip = [straight[0] + rig.dir * bend * W * .26, straight[1] + bend * H * .19];
  const C = [B[0] + (straight[0] - B[0]) * .64, B[1] + (straight[1] - B[1]) * .64];
  const at = t => [(1 - t) ** 2 * B[0] + 2 * (1 - t) * t * C[0] + t * t * tip[0], (1 - t) ** 2 * B[1] + 2 * (1 - t) * t * C[1] + t * t * tip[1]];
  const tan = t => { const x = 2 * (1 - t) * (C[0] - B[0]) + 2 * t * (tip[0] - C[0]), y = 2 * (1 - t) * (C[1] - B[1]) + 2 * t * (tip[1] - C[1]); const l = Math.hypot(x, y) || 1; return [x / l, y / l]; };
  return { s, B, tip, at, tan };
}
function strip(g, t0, t1, w0, w1, n = 16) {
  const L = [], Rr = [];
  for (let i = 0; i <= n; i++) {
    const t = t0 + (t1 - t0) * i / n, [x, y] = g.at(t), [tx, ty] = g.tan(t), w = lerp(w0, w1, i / n) / 2;
    L.push(`${(x - ty * w).toFixed(1)},${(y + tx * w).toFixed(1)}`); Rr.push(`${(x + ty * w).toFixed(1)},${(y - tx * w).toFixed(1)}`);
  }
  return `M${L.join('L')}L${Rr.reverse().join('L')}Z`;
}
function drawRig(target) {
  if (!R.W) return;
  const g = rodGeom(), s = g.s;
  $('rl-rod').setAttribute('d', strip(g, .2, 1, 20 * s, 3.4 * s));
  $('rl-cork').setAttribute('d', strip(g, 0, .25, 32 * s, 24 * s, 6));
  $('rl-guides').innerHTML = [.42, .6, .75, .88, .97].map(t => { const [x, y] = g.at(t), [tx, ty] = g.tan(t); return `<circle cx="${(x + ty * 5 * s * (1 - t)).toFixed(1)}" cy="${(y - tx * 5 * s * (1 - t)).toFixed(1)}" r="${((5.2 - t * 2.6) * s).toFixed(1)}"/>`; }).join('');
  // 릴: 손잡이 위, 낚싯대 오른쪽 아래에 붙는다.
  const [rx, ry] = g.at(.2), [tx, ty] = g.tan(.2), cx = rx - ty * -30 * s, cy = ry + tx * -30 * s;
  const reel = $('rl-reelg');
  reel.setAttribute('transform', `translate(${cx.toFixed(1)},${cy.toFixed(1)})`);
  reel.querySelector('.spool').setAttribute('r', 27 * s);
  reel.querySelector('.cap').setAttribute('r', 9 * s);
  const arm = reel.querySelector('.arm'); arm.setAttribute('x', 0); arm.setAttribute('y', -4 * s); arm.setAttribute('width', 34 * s); arm.setAttribute('height', 8 * s); arm.setAttribute('rx', 4 * s);
  const knob = reel.querySelector('.knob'); knob.setAttribute('cx', 34 * s); knob.setAttribute('r', 8.5 * s);
  $('rl-crank').setAttribute('transform', `rotate(${(R.rig.crank % 360).toFixed(1)})`);
  // 줄: 낚싯대 끝 → 찌 또는 물고기. 팽팽할수록 덜 처진다.
  const line = $('rl-line2');
  if (!target) { line.setAttribute('d', `M${g.tip[0]},${g.tip[1]} l0,${46 * s}`); return; }
  const [ex, ey] = target.p, sag = target.sag ?? 40;
  line.setAttribute('d', `M${g.tip[0].toFixed(1)},${g.tip[1].toFixed(1)} Q${((g.tip[0] + ex) / 2).toFixed(1)},${(Math.max(g.tip[1], ey) + sag).toFixed(1)} ${ex.toFixed(1)},${ey.toFixed(1)}`);
  line.setAttribute('class', `rl-line2 ${target.zone || ''}`);
}
// 찌 위치(px). 날아가는 동안은 포물선.
function bobPos(t) {
  const b = R.bob;
  if (!b) return null;
  if (b.fly) {
    const k = clamp((t - b.fly.t0) / b.fly.ms, 0, 1), e = 1 - (1 - k) ** 2;
    const x = lerp(b.fly.x0, b.x, e), y = lerp(b.fly.y0, b.y, e) - Math.sin(k * Math.PI) * R.H * .18;
    if (k >= 1) { b.fly = null; b.landed?.(); }
    return [x, y];
  }
  const wob = b.state === 'sink' ? 10 : b.state === 'nibble' ? 4 : 0;
  return [b.x, b.y + Math.sin(t / 520) * 2 + wob];
}
let lastT = 0;
function frame(t) {
  if (!R || R.closing) return;
  const dt = Math.min(.05, (t - (lastT || t)) / 1000); lastT = t;
  springTo(R.rig, dt);
  if (R.phase === 'fight') fightStep(t, dt);
  let target = null;
  const bob = $('rl-bob');
  if (R.phase === 'fight' || R.phase === 'finish') target = R.fishPx ? { p: R.fishPx, sag: R.f ? (1 - R.f.tension / 100) * 70 : 20, zone: R.f?.zone } : null;
  else if (R.bob) {
    const p = bobPos(t);
    if (p && bob) { bob.style.transform = `translate(${p[0].toFixed(1)}px,${p[1].toFixed(1)}px)`; target = { p: [p[0], p[1] - 10], sag: R.bob.fly ? 10 : R.bob.state === 'sink' ? 4 : 30 }; }
  }
  drawRig(target);
  R.raf = requestAnimationFrame(frame);
}

/* ---------- 대기(부두): 미끼 통 · 릴 버튼 · 반원 게이지 ---------- */
function hud(html, cls = '') { const el = $('rl-hud'); if (el) { el.className = `rl-hud ${cls}`; el.innerHTML = html; } }
function cue(html, cls = '', ms = 0) {
  const el = $('rl-cue');
  if (!el) return;
  el.className = `rl-cue ${cls}`; el.innerHTML = html;
  if (html) { el.classList.remove('in'); void el.offsetWidth; el.classList.add('in'); }
  clearTimeout(R.cueT);
  if (ms) R.cueT = later(() => { if ($('rl-cue')) $('rl-cue').innerHTML = ''; }, ms);
}
function setPhase(p) { R.phase = p; const pov = $('rl-pov'); if (pov) pov.dataset.phase = p; }
function dock() {
  if (!$('rl-pov')) scene();
  clearOverlays();
  setPhase('dock');
  R.f = null; R.fishPx = null; R.live = null;
  Object.assign(R.rig, { tBack: 0, tBend: .04, tDir: 0, spin: 0 });
  R.bob = null; $('rl-bob')?.classList.remove('on', 'nibble', 'sink');
  $('rl-shadow').hidden = true;
  $('rl-world')?.classList.remove('zoom');
  petFace('idle');
  cue('');
  const v = R.v || {}, can = Number(v.bait || 0) > 0;
  hud(`<div class="rl-bait-can" data-rl="bait" role="button" tabindex="0" aria-label="미끼 ${num(v.bait || 0)}개">${art('bait-open', art('bait-can', '<i class="rl-can-ico big"></i>'))}<b>${num(v.bait || 0)}</b><small>오늘 ${num(v.bait_today || 0)}/${num(v.bait_daily || REEL.BAIT_DAILY)}</small></div>
    <div class="rl-castbox">
      <svg class="rl-arc" id="rl-arc" viewBox="0 0 200 110" aria-hidden="true">
        <defs><linearGradient id="rl-arcg" x1="0" x2="1"><stop offset="0" stop-color="#34d399"/><stop offset=".6" stop-color="#fde047"/><stop offset="1" stop-color="#fb923c"/></linearGradient></defs>
        <path class="track" d="M14,100 A86,86 0 0 1 186,100"/>
        <path class="fill" id="rl-arcfill" pathLength="1" d="M14,100 A86,86 0 0 1 186,100"/>
        <path class="gold" d="${arcPath(.86, .97)}"/>
        <g id="rl-needle"><line x1="100" y1="100" x2="100" y2="24"/><circle cx="100" cy="100" r="7"/></g>
      </svg>
      <button type="button" class="rl-castbtn" id="rl-cast" ${can ? '' : 'disabled'} aria-label="꾹 눌러 던지기">${art('btn-cast', '<span class="rl-castbtn-code"><i></i></span>')}</button>
      <p class="rl-cast-tip">${can ? '<b>꾹</b> 누르고 <b>금색</b>에서 떼기' : '미끼가 없어요'}</p>
    </div>`, 'dockhud');
  if (!can) say('미끼는 공부하면 받아요!', 3000);
  else if (!R.greeted) { R.greeted = true; later(() => say(['오늘은 큰 게 올 것 같아!', '준비됐어? 던져 보자!', '반짝이는 물결을 노려 봐!'][Math.floor(Math.random() * 3)]), 500); }
  bindCast();
}
// 반원 게이지 위 k(0~1) 구간 호
function arcPath(a, b) {
  const pt = k => { const ang = Math.PI * (1 - k); return [100 + 86 * Math.cos(ang), 100 - 86 * Math.sin(ang)]; };
  const [x0, y0] = pt(a), [x1, y1] = pt(b);
  return `M${x0.toFixed(1)},${y0.toFixed(1)} A86,86 0 0 1 ${x1.toFixed(1)},${y1.toFixed(1)}`;
}
function baitInfo() {
  const v = R.v || {};
  sheet(`${sheetHead(`${art('bait-can', '🪱')} 미끼 ${num(v.bait || 0)}개`)}
    <p class="rl-sheet-note">미끼 1개로 한 번 던져요. 놓치면 미끼는 사라져요. 들고 있을 수 있는 미끼는 ${num(v.bait_max || REEL.BAIT_MAX)}개까지예요.</p>
    <ul class="rl-bait-how"><li><b>연습을 끝까지</b> 풀기(10문제 이상)</li><li><b>짝 맞추기</b> 별 3개</li><li><b>출석</b>하기</li></ul>
    <div class="rl-bait-today"><span>오늘 받은 미끼</span><b>${num(v.bait_today || 0)} / ${num(v.bait_daily || REEL.BAIT_DAILY)}</b></div>`, 'bait');
}

/* ---------- ① 던지기 ---------- */
const zoneOf = k => k >= .86 && k <= .97 ? 'perfect' : k >= .62 ? 'good' : 'ok';
function bindCast() {
  const btn = $('rl-cast'), arc = $('rl-arc');
  if (!btn || btn.disabled) return;
  let t0 = 0, holding = false, raf = 0, lastZone = '';
  const level = () => (1 - Math.cos((performance.now() - t0) / 1150 * Math.PI * 2)) / 2;
  const loop = () => {
    if (!holding || !R) return;
    const k = level(), z = zoneOf(k);
    const nd = $('rl-needle'); if (nd) nd.style.transform = `rotate(${(-90 + k * 180).toFixed(1)}deg)`;
    const fill = $('rl-arcfill'); if (fill) fill.style.strokeDasharray = `${k.toFixed(3)} 1`;
    arc.dataset.zone = z;
    R.rig.tBack = .35 + k * .65; R.rig.tBend = .12 + k * .1;
    if (z === 'perfect' && lastZone !== 'perfect') { sfx('tick', { rate: 1.6, gain: .5 }); buzz(8); }
    lastZone = z;
    raf = requestAnimationFrame(loop);
  };
  btn.onpointerdown = e => { e.preventDefault(); if (holding) return; holding = true; t0 = performance.now(); arc.classList.add('on'); btn.classList.add('hold'); sfx('ult-riser', { gain: .35, rate: 1.4 }); loop(); };
  const release = e => { if (!holding) return; e?.preventDefault?.(); holding = false; cancelAnimationFrame(raf); btn.classList.remove('hold'); cast(level()); };
  btn.onpointerup = release; btn.onpointerleave = release; btn.onpointercancel = release;
}
async function cast(k) {
  const tier = zoneOf(k);
  $('rl-cast') && ($('rl-cast').disabled = true);
  setPhase('cast');
  // 휙: 젖혔던 낚싯대가 앞으로(용수철이 넘어가며 출렁인다).
  Object.assign(R.rig, { tBack: -.12, tBend: .02 });
  R.rig.vb = -6;
  later(() => { R.rig.tBack = 0; }, 260);
  sfx('slash', { rate: 1.25, gain: .7 }); buzz(18);
  let res;
  try { res = await api('/reel/cast', { cast: tier }); }
  catch (err) { toast(err.message); if (R) dock(); return; }
  if (!R) return;
  setView(res.reel);
  R.live = { id: res.id, fight: res.fight, tier, at: performance.now(), minMs: Number(res.fight.min || 0) };
  hud('', 'empty');
  if (tier === 'perfect') { pop('퍼펙트 캐스팅!', 'perfect'); sfx('crit', { rate: 1.2 }); buzz([20, 30, 40]); say('완벽해!'); }
  else if (tier === 'good') pop('좋은 캐스팅!', 'good');
  const g = rodGeom();
  R.bob = { x: R.W * (.42 + Math.random() * .22), y: R.H * lerp(.66, .45, k), state: 'fly', fly: { t0: performance.now(), ms: reduced() ? 80 : 640, x0: g.tip[0], y0: g.tip[1] } };
  R.bob.landed = () => { const b = $('rl-bob'); b?.classList.add('on'); fx('splash', R.bob.x, R.bob.y, 'small'); fx('ripple', R.bob.x, R.bob.y); sfx('pop', { rate: .7, gain: .55 }); R.bob.state = 'float'; waitBite(); };
}

/* ---------- ② 입질: 톡톡(가짜) … 쑥(진짜) → 탭(챔질) ---------- */
function waitBite() {
  setPhase('wait');
  cue('<span class="rl-cue-soft">찌를 잘 보세요… <b>쑥!</b> 들어가면 탭!</span>');
  R.early = 0;
  const nibbles = 1 + Math.floor(Math.random() * 3);
  let at = 900;
  for (let i = 0; i < nibbles; i++) {
    at += 700 + Math.random() * 1000;
    later(() => {
      if (R.phase !== 'wait') return;
      R.bob.state = 'nibble'; const b = $('rl-bob'); b?.classList.add('nibble');
      fx('ripple', R.bob.x, R.bob.y, 'tiny'); sfx('tick', { gain: .3, rate: 1.5 }); buzz(6);
      R.rig.tBend = .1;
      later(() => { if (R.phase !== 'wait') return; R.bob.state = 'float'; b?.classList.remove('nibble'); R.rig.tBend = .04; }, 300);
    }, at);
  }
  at += 900 + Math.random() * 1500;
  later(bite, at);
  const pov = $('rl-pov');
  R.tap = e => {
    if (e.target.closest('button, .rl-hud, .rl-side-menu, .rl-sheetwrap, .rl-tankwrap')) return;
    e.preventDefault();
    if (R.phase === 'bite') return hooked();
    if (R.phase !== 'wait') return;
    R.early++;
    if (R.early >= 2) return missed('너무 일찍 당겨서 물고기가 놀라 도망갔어요');
    pop('아직이에요!', 'warn'); sfx('warn-beep', { gain: .45 }); buzz(30); say('톡톡은 가짜야! 쑥 들어갈 때!');
  };
  pov.addEventListener('pointerdown', R.tap);
}
function offTap() { if (R?.tap) $('rl-pov')?.removeEventListener('pointerdown', R.tap); R && (R.tap = null); }
function bite() {
  if (R.phase !== 'wait') return;
  setPhase('bite');
  R.bob.state = 'sink'; $('rl-bob')?.classList.add('sink');
  fx('splash', R.bob.x, R.bob.y, 'big'); fx('ripple', R.bob.x, R.bob.y); fx('strike', R.bob.x, R.bob.y - R.H * .08);
  R.rig.tBend = .32; R.rig.tDir = (Math.random() - .5) * .4;
  sfx('warn-beep', { rate: 1.6 }); sfx('wiggle', { gain: .6 }); buzz([70, 30, 90]);
  cue('<span class="rl-cue-big now">지금! <b>탭!</b></span><i class="rl-hand"></i>', 'now');
  R.biteAt = performance.now();
  later(() => { if (R.phase === 'bite') missed('입질을 놓쳤어요. 쑥 들어가면 바로!'); }, 850);
}
function hooked() {
  offTap();
  setPhase('hooked');
  const fast = performance.now() - R.biteAt < 330;
  Object.assign(R.rig, { tBack: .45, tBend: .5 }); R.rig.vb = 8;
  later(() => { R.rig.tBack = 0; }, 220);
  flash(); pop(fast ? '번개 챔질!' : '챔질 성공!', 'strike'); sfx('hit', { rate: 1.05 }); sfx('crack', { gain: .5 }); buzz(fast ? [40, 30, 110] : [80]);
  petFace('cheer'); say(fast ? '빠르다! 걸렸어!' : '걸렸어! 감아!');
  cue('');
  later(fight, reduced() ? 80 : 520);
}
async function missed(msg) {
  offTap();
  setPhase('missed');
  R.bob && (R.bob.state = 'float'); $('rl-bob')?.classList.remove('sink', 'nibble');
  R.rig.tBend = .02; sfx('fail', { gain: .6 }); petFace('sad'); cue('');
  await land('lost');
  if (!R) return;
  $('rl-bob')?.classList.remove('on'); R.bob = null;
  result(`<div class="rl-miss-art">${fishShadow('carp')}</div><h2>놓쳤어요!</h2><p>${esc(msg)}</p><small>미끼는 사라졌어요.</small>`, 'miss');
}

/* ---------- ③ 파이팅 ---------- */
function fight() {
  setPhase('fight');
  const F = R.live.fight, now = performance.now();
  const dist = Number(F.dist || 14);
  R.f = { dist, max: dist, tension: 38, x: R.bob?.x ?? R.W * .5, depth: 0, holding: false, move: null, next: now + 1600, redFor: 0, slackFor: 0, skill: 0, zone: 'green', clickAt: 0, buzzAt: 0, start: now, swipeX: null };
  $('rl-bob')?.classList.remove('on', 'sink'); R.bob = null;
  const sh = $('rl-shadow'); sh.hidden = false; sh.style.setProperty('--s', F.size || 1);
  $('rl-world').classList.add('zoom');
  const pet = R.A.data.stats?.pet;
  hud(`<div class="rl-dist" aria-label="남은 거리"><span><i id="rl-dist-fill"></i>${art('gauge-distance', '')}</span><b id="rl-dist-n">${Math.ceil(dist)}m</b></div>
    <div class="rl-reelwrap">
      <svg class="rl-tring" viewBox="0 0 140 140" aria-hidden="true"><circle class="bg" cx="70" cy="70" r="62"/><circle class="v" id="rl-tring" cx="70" cy="70" r="62"/><circle class="red" cx="70" cy="70" r="62"/></svg>
      <button type="button" class="rl-reelbtn" id="rl-reel" aria-label="꾹 눌러 감기">${art('btn-reel', '<span class="rl-reelbtn-code"><i id="rl-reel-crank"></i></span>')}</button>
      <small class="rl-reel-tip" id="rl-reel-tip">꾹 눌러 감기</small>
    </div>
    <button type="button" class="rl-skill" id="rl-skill" data-rl="skill" disabled aria-label="펫 특기">${pet ? avatar(pet.key, { form: Math.max(1, pet.form ?? 1), size: 'mini' }) : ''}<svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="18"/><circle class="v" id="rl-skill-ring" cx="20" cy="20" r="18"/></svg><em>위로 쓸기!</em></button>`, 'fighthud');
  const reel = $('rl-reel'), pov = $('rl-pov');
  const down = e => { e.preventDefault(); R.f.holding = true; reel.classList.add('hold'); R.f.swipeX = e.clientX; R.f.swipeY = e.clientY; R.f.swipeAt = performance.now(); };
  const up = e => { e?.preventDefault?.(); if (R?.f) R.f.holding = false; reel.classList.remove('hold'); };
  reel.onpointerdown = down; reel.onpointerup = up; reel.onpointercancel = up;
  reel.onpointerleave = e => { if (e.pointerType === 'mouse') up(e); };
  // 스와이프: 누른 채 끌거나, 화면 어디서든 쓸기. 좌우 = 반대로 당기기, 위 = 펫 특기.
  R.swipe = { down: e => { if (e.target.closest('.rl-reelbtn')) return; R.f && Object.assign(R.f, { gx: e.clientX, gy: e.clientY, gAt: performance.now() }); },
    move: e => {
      const f = R?.f; if (!f) return;
      const ox = f.holding && f.swipeX !== null ? f.swipeX : f.gx, oy = f.holding && f.swipeX !== null ? f.swipeY : f.gy;
      if (ox === undefined || ox === null) return;
      const dx = e.clientX - ox, dy = e.clientY - oy;
      if (Math.abs(dx) > 34 && Math.abs(dx) > Math.abs(dy)) { swipe(dx < 0 ? -1 : 1); if (f.holding) { f.swipeX = e.clientX; f.swipeY = e.clientY; } else f.gx = e.clientX; }
      else if (dy < -60 && Math.abs(dy) > Math.abs(dx) * 1.4) { if (f.skill >= 100) useSkill(); if (f.holding) f.swipeY = e.clientY; else f.gy = e.clientY; }
    },
    up: () => { if (R?.f) { R.f.gx = null; R.f.gy = null; } } };
  pov.addEventListener('pointerdown', R.swipe.down); pov.addEventListener('pointermove', R.swipe.move); addEventListener('pointerup', R.swipe.up);
  if (!R.v?.fought) cue('<span class="rl-cue-soft"><b>꾹</b> 눌러 감고, 빨간색이면 <b>손 떼기</b>!</span>', '', 2600);
}
function offSwipe() {
  const pov = $('rl-pov');
  if (R?.swipe) { pov?.removeEventListener('pointerdown', R.swipe.down); pov?.removeEventListener('pointermove', R.swipe.move); removeEventListener('pointerup', R.swipe.up); R.swipe = null; }
}
function pickMove() {
  const m = R.live.fight.moves || { run: 1 }, total = Object.values(m).reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (const [k, w] of Object.entries(m)) if ((r -= w) <= 0) return k;
  return 'run';
}
function startMove(t) {
  const f = R.f, kind = pickMove(), F = R.live.fight;
  if (kind === 'run') {
    const dir = f.x < R.W * .35 ? 1 : f.x > R.W * .65 ? -1 : Math.random() < .5 ? -1 : 1;
    f.move = { kind, dir, until: t + 2100, need: F.swipes || 2, done: 0 };
    cue(`<span class="rl-cue-big run ${dir < 0 ? 'to-r' : 'to-l'}"><i class="rl-arrow"></i>반대로 당겨!<small>${dir < 0 ? '오른쪽' : '왼쪽'}으로 쓸기 · ${f.move.need}번</small></span>`, 'run');
    sfx('slash', { rate: .75, gain: .8 }); buzz([60, 40, 60]); say(dir < 0 ? '왼쪽으로 도망가!' : '오른쪽으로 도망가!', 1500);
  } else if (kind === 'thrash') {
    f.move = { kind, until: t + 1300, held: 0 };
    cue('<span class="rl-cue-big thrash">날뛴다! <b>손 떼기!</b></span>', 'thrash');
    fx('splash', f.x, R.H * .5 + f.depth, 'big'); sfx('wiggle', { gain: .8, rate: 1.2 }); buzz([30, 20, 30, 20, 30]); say('놓아! 놓아!', 1200);
  } else {
    f.move = { kind, until: t + 1900 };
    cue('<span class="rl-cue-big dive">잠수! <b>꾹 버티기!</b></span>', 'dive');
    sfx('boss-charge', { gain: .5, rate: 1.3 }); buzz(120); say('꽉 잡아!', 1200);
  }
  $('rl-pov').dataset.move = kind;
}
function endMove(ok) {
  const f = R.f, m = f.move;
  if (!m) return;
  f.move = null;
  $('rl-pov').dataset.move = '';
  if (ok) {
    f.skill = Math.min(100, f.skill + (m.kind === 'run' ? 22 : 16)); f.dist = Math.max(0, f.dist - 1.5);
    cue(`<span class="rl-cue-big ok">${m.kind === 'run' ? '버텼다!' : m.kind === 'thrash' ? '잘 풀어 줬어요!' : '버텼다!'}</span>`, 'ok', 700);
    sfx('shield-block', { gain: .6 }); buzz(20);
  } else {
    f.dist = Math.min(f.max * 1.2, f.dist + (m.kind === 'dive' ? 2 : 3)); f.tension = Math.min(100, f.tension + 12);
    cue(`<span class="rl-cue-big bad">${m.kind === 'run' ? '끌려갔어요…' : m.kind === 'thrash' ? '줄이 출렁!' : '깊이 들어갔어요…'}</span>`, 'bad', 700);
    sfx('type-wrong', { gain: .5 });
  }
  f.next = performance.now() + rnd(R.live.fight.dash);
}
function swipe(dir) {
  const f = R?.f;
  if (!f || R.phase !== 'fight') return;
  R.rig.vd += dir * 4;
  if (!f.move || f.move.kind !== 'run') { f.tension = Math.max(0, f.tension - 2); return; }
  if (dir === -f.move.dir) {
    f.move.done++; f.tension = Math.max(0, f.tension - 13);
    fx('pull', R.W * (dir < 0 ? .3 : .7), R.H * .55);
    sfx('type-ok', { rate: 1 + f.move.done * .12, gain: .6 }); buzz(14);
    if (f.move.done >= f.move.need) endMove(true);
  } else { f.tension += 8; sfx('type-wrong', { gain: .4 }); buzz(30); }
}
function fightStep(t, dt) {
  const f = R.f, F = R.live.fight, pull = F.pull || 1;
  const m = f.move;
  // 텐션: 감으면 오르고 풀면 내린다. 물고기 힘이 출렁인다.
  f.tension += f.holding ? (40 + pull * 22) * dt : -48 * dt;
  f.tension += pull * (Math.sin(t / 330) * 8 + Math.sin(t / 97) * 4) * dt;
  if (m?.kind === 'run') f.tension += pull * 42 * dt;
  if (m?.kind === 'thrash' && f.holding) { f.tension += 95 * dt; m.held += dt; }
  if (m?.kind === 'dive') f.tension += (f.holding ? 26 : 8) * pull * dt;
  f.tension = clamp(f.tension, 0, 100);
  const zone = f.tension >= 80 ? 'red' : f.tension >= 22 ? 'green' : 'blue';
  f.zone = zone;
  // 거리: 초록 칸에서 감을 때 가장 빨리 줄어든다. 손을 떼면 물고기가 조금 끌고 간다.
  if (f.holding) f.dist -= (zone === 'green' ? 2.5 : zone === 'blue' ? 1 : .55) / Math.pow(pull, .35) * dt;
  else f.dist += .55 * pull * dt;
  if (m?.kind === 'dive' && !f.holding) f.dist += 2.2 * dt;
  if (m?.kind === 'run') f.dist += .8 * dt;
  f.dist = clamp(f.dist, 0, f.max * 1.25);
  if (zone === 'green' && f.holding) f.skill = Math.min(100, f.skill + 7 * dt);
  // 끝나는 조건
  f.redFor = f.tension >= 98 ? f.redFor + dt : 0;
  f.slackFor = f.tension <= 2 ? f.slackFor + dt : 0;
  if (f.redFor > .75) return lose('줄이 끊어졌어요! 빨간색이면 손을 떼요', 'snap');
  if (f.slackFor > 3.5) return lose('줄이 느슨해져서 물고기가 빠져나갔어요', 'slack');
  if (m && t > m.until) endMove(m.kind === 'thrash' ? m.held < .35 : m.kind === 'dive' ? f.dist < f.max * 1.2 && f.redFor === 0 : false);
  else if (!m && t > f.next) startMove(t);
  if (f.dist <= 0) return finish();
  // 물고기 위치: 멀면 수평선 가까이(작게), 가까우면 아래로(크게).
  const near = 1 - f.dist / f.max;
  const tx = m?.kind === 'run' ? R.W * (m.dir < 0 ? .12 : .88) : R.W * (.5 + Math.sin(t / 1100) * .22);
  f.x += (tx - f.x) * Math.min(1, dt * (m?.kind === 'run' ? 2.6 : 1.1));
  f.depth = m?.kind === 'dive' ? Math.min(1, (f.depth || 0) + dt * 2) : Math.max(0, (f.depth || 0) - dt * 2);
  const y = R.H * lerp(.47, .7, clamp(near, 0, 1)) + Math.sin(t / 380) * 4;
  R.fishPx = [f.x, y];
  const sh = $('rl-shadow');
  sh.style.transform = `translate(${f.x.toFixed(1)}px,${y.toFixed(1)}px) scale(${(lerp(.55, 1.25, clamp(near, 0, 1)) * (1 - f.depth * .35)).toFixed(3)})`;
  sh.classList.toggle('flip', (m?.kind === 'run' ? m.dir : Math.cos(t / 1100)) < 0);
  sh.classList.toggle('deep', f.depth > .3);
  sh.classList.toggle('thrash', m?.kind === 'thrash');
  // 낚싯대: 텐션만큼 휘고 물고기 쪽으로 기운다.
  R.rig.tBend = .18 + f.tension / 100 * .85 + (m?.kind === 'thrash' ? Math.sin(t / 45) * .08 : 0);
  R.rig.tDir = clamp((f.x - R.W * .62) / (R.W * .45), -1, 1);
  R.rig.spin = f.holding ? 520 + f.tension * 4 : 0;
  // HUD
  $('rl-dist-n').textContent = `${Math.max(0, Math.ceil(f.dist))}m`;
  $('rl-dist-fill').style.transform = `scaleY(${clamp(f.dist / f.max, 0, 1).toFixed(3)})`;
  const ring = $('rl-tring'); ring.style.strokeDashoffset = `${(390 * (1 - f.tension / 100)).toFixed(1)}`;
  $('rl-pov').dataset.zone = zone;
  const crank = $('rl-reel-crank'); if (crank) crank.style.transform = `rotate(${(R.rig.crank % 360).toFixed(0)}deg)`;
  const skill = $('rl-skill');
  $('rl-skill-ring').style.strokeDashoffset = `${(113 * (1 - f.skill / 100)).toFixed(1)}`;
  if (f.skill >= 100 && skill.disabled) { skill.disabled = false; skill.classList.add('full'); sfx('skill'); buzz(30); say('특기 준비! 위로 쓸어!', 1600); }
  $('rl-world').classList.toggle('shake', zone === 'red' && !reduced());
  // 손맛: 감는 소리 · 진동
  if (f.holding && t - f.clickAt > 120 - Math.min(70, f.tension * .6)) { f.clickAt = t; sfx('type-key', { rate: .75 + f.tension / 110, gain: .3 }); }
  const every = zone === 'red' ? 160 : f.holding ? 260 : 0;
  if (every && t - f.buzzAt > every) { f.buzzAt = t; buzz(zone === 'red' ? 28 : 7); }
}
function useSkill() {
  const f = R?.f;
  if (!f || f.skill < 100 || R.phase !== 'fight') return;
  f.skill = 0; f.dist = Math.max(0, f.dist - f.max * .32); f.tension = 50;
  if (f.move) endMove(true);
  const skill = $('rl-skill'); skill.disabled = true; skill.classList.remove('full');
  const pet = R.A.data.stats?.pet;
  $('rl-pov').insertAdjacentHTML('beforeend', `<div class="rl-cutin">${pet ? avatar(pet.key, { form: Math.max(1, pet.form ?? 1), expression: 'cheer' }) : ''}<b>펫 특기!</b><span>한 번에 끌어오기</span></div>`);
  later(() => document.querySelector('.rl-cutin')?.remove(), 1200);
  Object.assign(R.rig, { tBack: .5 }); R.rig.vb = 10; later(() => { R.rig.tBack = 0; }, 300);
  flash(); sfx('ult-impact'); buzz([30, 30, 140]);
}
async function lose(msg, why) {
  offSwipe();
  setPhase('lost');
  R.rig.spin = 0;
  if (why === 'snap') { Object.assign(R.rig, { tBend: 0, tDir: 0 }); R.rig.vbe = -14; fx('snap', ...rodGeom().tip); sfx('crack'); }
  sfx('fail'); buzz([80, 40, 80]); petFace('sad');
  $('rl-shadow').classList.add('flee');
  cue('');
  R.fishPx = null;
  await land('lost');
  if (!R) return;
  later(() => {
    $('rl-shadow').hidden = true; $('rl-shadow').classList.remove('flee'); $('rl-world').classList.remove('zoom', 'shake');
    result(`<div class="rl-miss-art">${fishShadow('tuna')}</div><h2>${why === 'snap' ? '줄이 끊어졌어요!' : '놓쳤어요!'}</h2><p>${esc(msg)}</p><small>미끼는 사라졌어요. 다음엔 꼭!</small>`, 'miss');
  }, 700);
}

/* ---------- ④ 마무리: 물고기가 뛰어오른다(슬로모션) → 고리가 맞을 때 탭 ---------- */
function finish() {
  offSwipe();
  setPhase('finish');
  R.rig.spin = 0; R.rig.tBend = .9;
  const f = R.f, [x, y] = R.fishPx;
  $('rl-shadow').hidden = true;
  $('rl-world').classList.remove('shake');
  hud('', 'empty');
  cue('');
  const pov = $('rl-pov');
  fx('jump', x, y); sfx('burst', { gain: .7 }); buzz([40, 30, 40]);
  // 아직 어떤 물고기인지 모른다: 큰 실루엣이 뛰어오른다.
  pov.insertAdjacentHTML('beforeend', `<div class="rl-leap" id="rl-leap" style="--x:${x}px;--y:${y}px;--s:${R.live.fight.size || 1}"><div class="rl-leap-fish">${fishShadow('salmon')}</div><i class="rl-ring" id="rl-ring"></i></div>${reduced() ? '' : '<i class="rl-speed"></i>'}`);
  pov.classList.add('slowmo');
  sfx('ult-riser', { gain: .5 });
  cue('<span class="rl-cue-big now">고리가 맞을 때 <b>탭!</b></span>', 'now');
  const t0 = performance.now(), dur = reduced() ? 1400 : 1250;
  let done = false;
  const end = kind => {
    if (done) return; done = true;
    pov.removeEventListener('pointerdown', tap);
    pov.classList.remove('slowmo');
    document.querySelector('.rl-speed')?.remove();
    cue('');
    const leap = $('rl-leap'); leap?.classList.add(kind);
    if (kind === 'perfect') { pop('퍼펙트!', 'perfect'); flash(); sfx('crit', { rate: 1.1 }); buzz([20, 20, 120]); }
    else if (kind === 'good') { pop('좋아요!', 'good'); sfx('hit'); buzz(60); }
    else sfx('pop');
    landFish(kind);
  };
  const tap = e => {
    if (e.target.closest('button')) return;
    e.preventDefault();
    const k = (performance.now() - t0) / dur; // 고리: 1 → 0(맞는 곳 .82~.98)
    end(k >= .8 && k <= 1.02 ? 'perfect' : k >= .6 && k <= 1.15 ? 'good' : 'miss');
  };
  pov.addEventListener('pointerdown', tap);
  $('rl-ring').style.animationDuration = `${dur}ms`;
  later(() => end('miss'), dur * 1.25);
}
async function landFish(kind) {
  // 서버가 보는 최소 파이팅 시간보다 빨리 끝났으면 기다렸다가 보낸다.
  const left = Math.max(0, (R.live.minMs || 0) - (performance.now() - R.live.at));
  if (left) await wait(left);
  const res = await land('caught', kind);
  if (!R) return;
  later(() => { document.querySelector('.rl-leap')?.remove(); reveal(res, kind); }, reduced() ? 60 : 650);
}
async function land(result, finishKind = null, quiet = false) {
  if (!R?.live) return null;
  const id = R.live.id;
  for (let i = 0; i < 3; i++) {
    try {
      const res = await api('/reel/land', { id, result, ...(finishKind ? { finish: finishKind } : {}) });
      if (!R) return res;
      setView(res.reel); if (res.gifts) R.A.data.gifts = res.gifts; R.live = null; R.v.fought = true; return res;
    } catch (err) { if (!err.transient || i === 2) { if (!quiet) toast(err.message); return null; } await new Promise(r => setTimeout(r, 600)); }
  }
  return null;
}

/* ---------- ⑤ 공개: 수면에서 물고기가 튀어 올라 등장 ---------- */
function reveal(res, kind) {
  setPhase('reveal');
  $('rl-world').classList.remove('zoom');
  R.fishPx = null; R.f = null;
  Object.assign(R.rig, { tBend: .04, tDir: 0 });
  if (!res?.caught) return result(`<h2>아슬아슬하게 놓쳤어요</h2><p>${res?.reason === 'short' ? '너무 빨리 끌어올려서 줄이 풀렸어요.' : '연결을 확인해 주세요.'}</p>`, 'miss');
  petFace('happy');
  const f = FISH[res.key], n = stars(res.rarity), big = n >= 3, glow = RARITY_GLOW[res.rarity] || '#fff';
  const box = document.createElement('div');
  box.className = `rl-rev r-${res.rarity}${big ? ' big' : ''}${has('bg-reveal') ? ' art' : ''}`;
  box.style.setProperty('--glow', glow);
  box.innerHTML = `${art('bg-reveal', '<div class="rl-rev-sky"><i class="sun"></i></div><div class="rl-rev-sea"><i></i><i></i></div>')}
    ${big ? `<i class="rl-rev-rays">${art('fx-rays', '')}</i>` : ''}
    <i class="rl-rev-halo">${art('fx-halo', '')}</i>
    <div class="rl-rev-fish"><div class="rl-rev-jump">${fishPic(res.key)}</div></div>
    <div class="rl-rev-splash">${art('fx-jump', '<i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i>')}</div>
    ${res.fresh ? `<div class="rl-stamp">${art('stamp-new', '')}<span>새로<br>발견!</span></div>` : ''}
    <section class="rl-rev-card">
      <div class="rl-rev-top">${STAR(n)}<span class="fs-rarity">${esc(RARITY[res.rarity].name)}</span>${res.perfect ? '<span class="rl-perfect-chip">퍼펙트 +8%</span>' : ''}</div>
      <h2>${esc(f.name)}</h2>
      <p class="rl-kg"><b id="rl-kg">0</b>${res.record ? `<span class="rl-ribbon">${art('ribbon-record', '')}<em>최고 무게!</em></span>` : ''}</p>
      ${res.key === 'goldenegg' ? `<p class="rl-gold">황금 알 물고기 ${res.egg ? `${REEL.GOLDEN_EGG}마리! 선물 상자에 알이 도착했어요!` : `${num(res.golden)} / ${REEL.GOLDEN_EGG} · 다 모으면 알 선물`}</p>` : `<p class="rl-pearls">${pearlIco()}진주 <b>${num(res.pearls)}</b>개 가치 · 수조에 넣었어요</p>`}
      ${againButtons()}
    </section>`;
  $('rl-pov').appendChild(box);
  hud('', 'empty');
  sfx(res.rarity === 'legend' || res.rarity === 'golden' ? 'fanfare-legend' : res.rarity === 'epic' ? 'fanfare-epic' : res.rarity === 'rare' ? 'fanfare-basic' : 'correct');
  buzz(n >= 4 ? [40, 40, 40, 40, 160] : [30, 30, 60]);
  // 무게: 0에서 올라간다.
  const kgEl = box.querySelector('#rl-kg'), t0 = performance.now(), dur = reduced() ? 1 : 900;
  const tick = t => { if (!R || !kgEl.isConnected) return; const k = Math.min(1, (t - t0) / dur); kgEl.textContent = kgText(res.kg * (1 - (1 - k) ** 3)); if (k < 1) requestAnimationFrame(tick); else { kgEl.classList.add('done'); if (res.record) sfx('levelup', { gain: .5 }); } };
  later(() => requestAnimationFrame(tick), reduced() ? 0 : 700);
  if (res.fresh) later(() => { sfx('smash', { gain: .5 }); buzz(50); }, reduced() ? 0 : 1300);
  if (n >= 4) later(() => coinShower(box, n >= 5 ? 26 : 14), 600);
  say(n >= 4 ? '우와!! 대박이다!' : n >= 3 ? '귀한 물고기야!' : res.fresh ? '처음 보는 물고기야!' : '잡았다!', 2400);
}
function result(inner, cls) {
  setPhase('result');
  hud('', 'empty');
  const box = document.createElement('div');
  box.className = `rl-res ${cls}`;
  box.innerHTML = `<section class="rl-rev-card">${inner}${againButtons()}</section>`;
  $('rl-pov').appendChild(box);
}
const againButtons = () => `<div class="rl-again"><button type="button" class="yl-cta" data-rl="dock">${(R.v?.bait || 0) > 0 ? `다시 던지기 · 미끼 ${num(R.v.bait)}` : '낚시터로'}</button><button type="button" class="btn full" data-rl="net">수조 보기</button></div>`;
const clearOverlays = () => document.querySelectorAll('.rl-rev, .rl-res, .rl-leap, .rl-cutin').forEach(x => x.remove());

/* ---------- 효과 ---------- */
function fx(kind, x, y, size = '') {
  const host = $('rl-fx') || $('rl-pov');
  if (!host || (reduced() && kind !== 'snap')) return;
  const el = document.createElement('div');
  el.className = `rl-fx ${kind} ${size}`;
  el.style.left = `${x}px`; el.style.top = `${y}px`;
  const drops = n => Array.from({ length: n }, (_, k) => `<b style="--a:${-170 + k * (160 / (n - 1))}deg;--r:${size === 'small' || size === 'tiny' ? 26 : 52}px;--d:${k % 3 * 40}ms"></b>`).join('');
  el.innerHTML = kind === 'splash' ? art('fx-splash', '<i class="crown"></i>') + drops(size === 'small' ? 6 : 11)
    : kind === 'ripple' ? art('fx-ripple', '<i></i><i></i>')
    : kind === 'strike' ? `${art('fx-strike', '<i class="burst"></i>')}<b class="mark">!</b>`
    : kind === 'jump' ? art('fx-jump', '<i class="crown"></i>') + drops(14)
    : kind === 'snap' ? art('line-snap', '<i class="snap"></i>')
    : kind === 'pull' ? '<i></i>' : '';
  host.appendChild(el);
  setTimeout(() => el.remove(), kind === 'ripple' ? 1600 : 1200);
}
function pop(text, cls) {
  const host = $('rl-pov');
  if (!host) return;
  const el = document.createElement('div');
  el.className = `rl-pop ${cls}`;
  el.innerHTML = `${cls === 'perfect' ? art('fx-perfect', '<i class="rays"></i>') : ''}<b>${esc(text)}</b>`;
  host.appendChild(el);
  setTimeout(() => el.remove(), 1200);
}
function flash() { if (reduced()) return; const el = document.createElement('i'); el.className = 'rl-flash'; $('rl-pov')?.appendChild(el); setTimeout(() => el.remove(), 450); }

/* ---------- 수조(어망): 잡은 물고기가 헤엄친다. 누르면 정보 · 팔기 ---------- */
function tank() {
  closeSheet(); closeTank();
  const v = R.v || {}, entries = Object.entries(v.net || {}).sort((a, b) => pearlsOf(b[0]) - pearlsOf(a[0]));
  const total = entries.reduce((a, [, n]) => a + n, 0);
  const swimmers = entries.flatMap(([k, n]) => Array.from({ length: Math.min(3, n) }, (_, i) => [k, i])).slice(0, 26);
  const box = document.createElement('div');
  box.className = 'rl-tankwrap';
  box.innerHTML = `<section class="rl-tank${has('bg-tank') ? ' art' : ''}" role="dialog" aria-modal="true" aria-label="수조">
    <header class="rl-tank-head"><h2>수조 <small>${num(total)}마리</small></h2><span class="rl-sheet-pearl" id="rl-tank-pearl">${pearlIco()}<b>${num(v.pearls || 0)}</b></span><button type="button" class="icon-button" data-rl="close-tank" aria-label="닫기">${icon('close')}</button></header>
    <div class="rl-tank-water" id="rl-tank-water">
      ${art('bg-tank', '<i class="caustic a"></i><i class="caustic b"></i><i class="rays"></i>')}
      <div class="rl-tank-deco">${tankDeco()}</div>
      <div class="rl-tank-bubbles" aria-hidden="true">${Array.from({ length: 9 }, (_, i) => `<i style="--x:${6 + i * 11}%;--d:${4 + (i % 3)}s;--delay:${-i * .8}s"></i>`).join('')}</div>
      ${swimmers.map(([k, i], j) => { const sz = { common: 54, uncommon: 64, rare: 76, epic: 92, legend: 104, golden: 70 }[FISH[k].rarity] || 60;
        return `<button type="button" class="rl-swim r-${FISH[k].rarity}" data-key="${k}" style="--y:${10 + ((j * 37) % 62)}%;--w:${sz}px;--dur:${(9 + ((j * 13) % 9) + sz / 30).toFixed(1)}s;--delay:${(-j * 2.3).toFixed(1)}s" aria-label="${esc(FISH[k].name)}"><span>${fishPic(k)}</span></button>`; }).join('')}
      ${entries.length ? '' : '<p class="rl-tank-empty">수조가 비었어요.<br>낚시하러 가요!</p>'}
      <div class="rl-tank-info" id="rl-tank-info" hidden></div>
    </div>
    <footer class="rl-tank-foot">
      ${entries.length ? `<p>물고기를 누르면 자세히 볼 수 있어요. 팔면 진주가 돼요(도감 기록은 남아요).</p><button type="button" class="yl-cta" data-rl="sell-all">모두 팔기 · 진주 +${num(v.net_pearls || 0)}</button>` : ''}
      <div class="rl-tank-row"><button type="button" class="btn" data-rl="shop">교환소</button><button type="button" class="btn" data-rl="dock">낚시하기</button></div>
    </footer>
  </section>`;
  root().querySelector('.rl-app')?.appendChild(box);
  box.querySelector('#rl-tank-water').onclick = e => {
    const fish = e.target.closest('.rl-swim');
    const info = $('rl-tank-info');
    if (!fish) { if (!e.target.closest('.rl-tank-info')) info.hidden = true; return; }
    const k = fish.dataset.key, f = FISH[k], cnt = Number(v.net?.[k] || 0), best = v.book?.[k]?.kg;
    info.hidden = false;
    info.innerHTML = `<span class="rl-tank-pic">${fishPic(k)}</span><div><b>${esc(f.name)}</b>${STAR(stars(f.rarity))}<small>${esc(RARITY[f.rarity].name)} · ${num(cnt)}마리${best ? ` · 최고 ${kgText(best)}` : ''}</small></div><button type="button" class="btn small" data-rl="sell" data-key="${k}">팔기 ${pearlIco()}${num(pearlsOf(k) * cnt)}</button>`;
    sfx('pop', { rate: 1.3, gain: .4 });
  };
}
function tankDeco() {
  if (has('tank-chest')) return ['tank-weed', 'tank-coral', 'tank-rock', 'tank-chest', 'tank-weed'].map((k, i) => art(k, '', `d${i}`)).join('');
  return `<svg class="d-weed a" viewBox="0 0 60 160"><path d="M30 160 C10 120 50 90 28 50 C18 30 34 14 30 0"/><path d="M38 160 C56 124 22 96 44 62"/></svg>
    <svg class="d-coral" viewBox="0 0 120 100"><path d="M60 100 V60 M60 70 L36 40 M36 40 V18 M36 52 L20 34 M60 64 L86 34 M86 34 V12 M86 46 L104 30"/></svg>
    <svg class="d-chest" viewBox="0 0 100 80"><rect x="10" y="34" width="80" height="42" rx="6"/><path d="M10 34 Q50 -6 90 34 Z" class="lid"/><circle cx="38" cy="34" r="7" class="pearl"/><circle cx="56" cy="30" r="6" class="pearl"/><circle cx="70" cy="35" r="5" class="pearl"/></svg>
    <svg class="d-rock" viewBox="0 0 120 70"><path d="M4 70 Q10 20 50 18 Q96 10 116 70 Z"/></svg>
    <svg class="d-weed b" viewBox="0 0 60 160"><path d="M30 160 C50 120 10 90 32 50 C42 30 26 14 30 0"/></svg>`;
}
function closeTank() { document.querySelector('.rl-tankwrap')?.remove(); }
async function sell(key, b) {
  buttonBusy(b);
  const tankOpen = !!document.querySelector('.rl-tankwrap');
  const from = tankOpen ? [...document.querySelectorAll(key ? `.rl-swim[data-key="${key}"]` : '.rl-swim')] : [];
  try {
    const res = await api('/reel/sell', key ? { key } : {});
    sfx('coins'); buzz([20, 30, 20]);
    if (tankOpen && !reduced()) {
      // 물고기가 진주가 되어 위쪽 진주 칸으로 날아간다.
      const to = $('rl-tank-pearl')?.getBoundingClientRect();
      from.forEach((el, i) => {
        const r = el.getBoundingClientRect(), p = document.createElement('i');
        p.className = 'rl-fly-pearl'; p.innerHTML = pearlIco();
        p.style.left = `${r.left + r.width / 2}px`; p.style.top = `${r.top + r.height / 2}px`;
        p.style.setProperty('--dx', `${(to?.left ?? 0) + 12 - (r.left + r.width / 2)}px`); p.style.setProperty('--dy', `${(to?.top ?? 0) + 10 - (r.top + r.height / 2)}px`); p.style.animationDelay = `${i * 60}ms`;
        el.classList.add('gone');
        document.body.appendChild(p); setTimeout(() => p.remove(), 1100 + i * 60);
      });
      await wait(Math.min(1300, 750 + from.length * 60));
    }
    setView(res.reel);
    toast(`물고기 ${num(res.sold)}마리를 팔아 진주 ${num(res.pearls)}개!`);
    if (tankOpen) tank();
  } catch (err) { toast(err.message); buttonBusy(b, false); }
}

/* ---------- 교환소 · 도감 · 안내 (아래에서 올라오는 창) ---------- */
function sheet(html, cls = '') {
  closeSheet();
  const box = document.createElement('div');
  box.className = 'rl-sheetwrap';
  box.innerHTML = `<section class="rl-sheet ${cls}" role="dialog" aria-modal="true">${html}</section>`;
  box.addEventListener('click', e => { if (e.target === box) closeSheet(); });
  root().querySelector('.rl-app')?.appendChild(box);
}
function closeSheet() { document.querySelector('.rl-sheetwrap')?.remove(); }
const sheetHead = (title, extra = '') => `<header class="rl-sheet-head"><h2>${title}</h2>${extra}<button type="button" class="icon-button" data-rl="close-sheet" aria-label="닫기">${icon('close')}</button></header>`;
function shop() {
  closeTank();
  const v = R.v || {}, p = Number(v.pearls || 0), left = Number(v.coin_left ?? REEL.COIN_DAILY);
  const coinBtn = n => `<button type="button" class="rl-coin-btn" data-rl="coins" data-n="${n}" ${n <= left && n <= p ? '' : 'disabled'}>${pearlIco()}${num(n)} → ${coin()}${num(n)}</button>`;
  const maxN = Math.min(left, p);
  sheet(`${sheetHead(`${art('shop', '')} 진주 교환소`, `<span class="rl-sheet-pearl">${pearlIco()}${num(p)}</span>`)}
    <div class="rl-shop-block"><h3>${coin()} 코인으로 바꾸기 <small>진주 1개 = 1코인 · 오늘 ${num(left)}코인 더</small></h3>
      <div class="rl-coin-row">${[10, 50].map(coinBtn).join('')}${maxN > 0 && ![10, 50].includes(maxN) ? coinBtn(maxN) : ''}</div></div>
    <div class="rl-shop-block"><h3>알로 바꾸기</h3>
      <div class="rl-egg-row">
        <button type="button" class="rl-egg" data-rl="egg" data-item="egg" ${v.egg_left && p >= REEL.EGG ? '' : 'disabled'}><img src="/assets/pets/dog-0.webp" alt="" width="64" height="64"><b>랜덤 알</b><small>${pearlIco()}${num(REEL.EGG)} · ${v.egg_left ? '오늘 1개' : '내일 또'}</small></button>
        <button type="button" class="rl-egg epic" data-rl="egg" data-item="epic_egg" ${v.epic_left && p >= REEL.EPIC_EGG ? '' : 'disabled'}><span class="rl-epic-egg"></span><b>영웅 알</b><small>${pearlIco()}${num(REEL.EPIC_EGG)} · ${v.epic_left ? '이번 주 1개' : '다음 주에'}</small></button>
      </div></div>
    <div class="rl-shop-block sea"><h3>바다 펫 <small>교환소에서만 만나요</small></h3>
      <div class="rl-sea-pets">${(v.sea || SEA_PETS).map(x => !REEL.SEA_READY
        ? `<div class="rl-sea-pet locked"><span class="rl-sea-silhouette ${x.key}"></span><b>${esc(x.ko)}</b><small>${esc(x.kind)} · ${pearlIco()}${num(REEL.SEA_PET)}</small><em>곧 만나요</em></div>`
        : `<button type="button" class="rl-sea-pet${x.owned ? ' owned' : ''}" data-rl="sea" data-key="${x.key}" ${x.owned || p < REEL.SEA_PET ? 'disabled' : ''}><img src="/assets/pets/${x.key}-1.webp" alt="" width="56" height="56"><b>${esc(x.ko)}</b><small>${esc(x.kind)} · ${pearlIco()}${num(REEL.SEA_PET)}</small>${x.owned ? '<em>함께하는 중</em>' : ''}</button>`).join('')}</div>
      <p class="rl-sheet-note">${REEL.SEA_READY ? '바다 펫은 교환소에서만 만날 수 있어요. 야차전 특기도 있어요!' : '바다 펫은 그림이 완성되면 열려요. 그때까지 진주를 모아 두세요!'}</p></div>`, 'shop');
}
async function exchangeCoins(n, b) {
  buttonBusy(b);
  try {
    const res = await api('/reel/exchange', { item: 'coins', amount: n });
    setView(res.reel);
    if (typeof res.points_balance === 'number') R.A.data.stats.points_balance = res.points_balance;
    sfx('coins'); coinShower(document.querySelector('.rl-sheet'), 14);
    toast(`진주 ${num(res.coins)}개를 ${num(res.coins)}코인으로 바꿨어요!`);
    shop();
  } catch (err) { toast(err.message); buttonBusy(b, false); }
}
async function exchangeEgg(item, b) {
  if (!b.classList.contains('confirm')) { b.classList.add('confirm'); later(() => b.classList.remove('confirm'), 3000); return toast('한 번 더 누르면 바꿔요!'); }
  buttonBusy(b);
  closeSheet();
  try {
    const res = await buyEgg(R.A, null, item === 'epic_egg' ? 'epic' : 'basic', { path: '/reel/exchange', body: { item } });
    if (res?.reel) setView(res.reel);
    if (!res) toast('잠시 후 다시 눌러 주세요.');
  } catch (err) { toast(err.message); }
}
// 바다 펫(REEL.SEA_READY일 때만 버튼이 열린다): 두 번 눌러 확인, 영웅 펫과 같은 공개 연출.
async function exchangeSea(key, b) {
  if (!b.classList.contains('confirm')) { b.classList.add('confirm'); later(() => b.classList.remove('confirm'), 3000); return toast('한 번 더 누르면 바꿔요!'); }
  buttonBusy(b);
  closeSheet();
  try {
    const res = await buyEgg(R.A, null, 'epic', { path: '/reel/exchange', body: { item: 'sea_pet', key } });
    if (res?.reel) setView(res.reel);
    if (!res) toast('잠시 후 다시 눌러 주세요.');
  } catch (err) { toast(err.message); }
}
function book() {
  closeTank();
  const mine = R.v?.book || {}, order = ['common', 'uncommon', 'rare', 'epic', 'legend', 'golden'];
  const keys = [...FISH_KEYS].sort((a, b) => order.indexOf(FISH[a].rarity) - order.indexOf(FISH[b].rarity));
  const got = keys.filter(k => mine[k]?.n).length;
  sheet(`${sheetHead(`물고기 도감 <small>${num(got)} / ${keys.length}</small>`)}
    <div class="fs-book-bar"><i style="width:${Math.round(got / keys.length * 100)}%"></i></div>
    <div class="fs-tank">${keys.map(k => { const m = mine[k], f = FISH[k];
      return m?.n ? `<div class="fs-slot r-${f.rarity}">${STAR(stars(f.rarity))}${fishPic(k)}<b>${esc(f.name)}</b><small>최고 ${kgText(m.kg)} · ${num(m.n)}마리</small></div>`
        : `<div class="fs-slot unknown r-${f.rarity}">${STAR(stars(f.rarity))}${fishShadow(k)}<b>???</b><small>${esc(RARITY[f.rarity].name)}</small></div>`; }).join('')}</div>`, 'book');
}
// 처음 들어오면 한 번(그 뒤에는 ? 버튼).
function guide(first) {
  sheet(`${sheetHead('낚시터에 온 걸 환영해요!')}
    <ol class="rl-guide">
      <li><b>미끼로 낚아요</b><p>공부하면 미끼를 받아요 <em>(하루 최대 ${REEL.BAIT_DAILY}개)</em>. 연습을 끝까지 풀면(10문제 이상) 1개, 짝 맞추기 별 3개면 1개, 출석하면 1개. 미끼 1개로 한 번 던져요. 놓치면 미끼는 사라져요.</p></li>
      <li><b>던지고 · 챔질</b><p>아래 버튼을 <b>꾹</b> 눌러 반원 게이지가 <b>금색</b>일 때 떼면 퍼펙트(귀한 물고기가 더 잘 와요). 찌가 <b>톡톡</b>하는 건 가짜! <b>쑥</b> 들어가면 바로 탭!</p></li>
      <li><b>손맛 파이팅</b><p>릴 버튼을 <b>꾹</b> 누르면 감겨요. 고리가 <b>빨간색</b>이면 손을 떼요(줄이 끊어져요).
        <span class="rl-guide-moves"><span><b>돌진</b>반대쪽으로 쓸기</span><span><b>날뜀</b>손 떼기</span><span><b>잠수</b>꾹 버티기</span></span>
        펫 특기 구슬이 차면 <b>위로 쓸어 올려</b> 한 번에 끌어와요. 물고기가 뛰어오르면 고리가 맞을 때 탭 → 퍼펙트(무게 +8%)!</p></li>
      <li><b>물고기를 진주로</b><p>낚은 물고기는 <b>수조</b>에서 헤엄쳐요. 팔면 진주가 돼요. 팔아도 도감 기록은 남아요.</p>
        <div class="rl-guide-table">${['common', 'uncommon', 'rare', 'epic', 'legend'].map(r => `<span>${STAR(stars(r))}<b>${esc(RARITY[r].name)}</b><em>${num(REEL.PEARLS[r])}</em></span>`).join('')}</div></li>
      <li><b>진주로 바꿀 수 있는 것</b>
        <ul><li>${coin()} <b>코인</b>: 진주 1개 = 1코인 (하루 ${num(REEL.COIN_DAILY)}코인까지)</li><li><b>랜덤 알</b>: 진주 ${num(REEL.EGG)}개 (하루 1개)</li><li><b>영웅 알</b>: 진주 ${num(REEL.EPIC_EGG)}개 (일주일 1개)</li><li><b>바다 펫</b>: 진주 ${num(REEL.SEA_PET)}개 · 교환소에서만 만나요!</li><li><b>황금 알 물고기</b>는 팔지 않고 모아요. ${REEL.GOLDEN_EGG}마리면 알 선물!</li></ul></li>
    </ol>
    <button type="button" class="yl-cta" data-rl="close-sheet">알겠어요!</button>`, 'guide');
  if (first) api('/reel/guide', {}).then(res => setView(res.reel)).catch(() => {});
}
