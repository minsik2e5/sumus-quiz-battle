import { api, esc, num, icon, toast } from './ui.js';
import { CHARACTERS, shuffle, displayEnglish } from './core.js';
import { coin } from './emblems.js';
import { playSound, unlockSound, soundOn, preloadSound } from './sound.js';
import { coinShower } from './celebrate.js';
import { huntPetShow, petJosa } from './pet-moments.js';
import { arcadeWords } from './arcade-games.js';
import { cardMeaning } from './match-rules.js';
import { HUNT, BERRIES, BALL_NAMES, THROW_NAMES, TIER_NAMES, catchChance, huntSlot } from './hunt-rules.js';

// V13.162 펫 사냥(놀이터). 포켓몬 고처럼: 그림 지도 위 야생 펫을 눌러 만나고(하얀 번쩍임 → "야생의 ○○이 나타났다!"),
// 잡기 화면에서 공을 위로 밀어 던진다. 줄어드는 원이 작을 때 원 안에 맞히면 나이스 · 그레이트 · 엑설런트.
// 흔들림 1~3번 → 딸깍 + 별(잡았다) / 빠져나옴 / 도망 연기. 새 친구는 알 상점과 같은 펫 공개 연출(pet-moments.js huntPetShow).
// 만남 · 잡힘 · 도망은 서버가 정한다(server/hunt.mjs). 빗나간 공(펫에 안 닿음)은 서버에 보내지 않고 손에 돌아온다.
// 그림(주문서 34)은 HUNT_ART에 이름이 있으면 쓰고, 없으면 코드 그림 · 이모지로 그린다(reel.js FISHING_ART와 같은 방식).
export const HUNT_ART = new Set([]);
const has = name => HUNT_ART.has(name);
const art = (name, fallback, cls = '') => has(name) ? `<img class="hn-art hn-art-${name} ${cls}" src="/assets/hunt/${name}.webp" alt="" draggable="false">` : fallback;
const ballPic = (kind, cls = '') => art(`ball-${kind}`, `<i class="hn-ball k-${kind} ${cls}"><b></b></i>`, cls);
const berryPic = key => art(`berry-${key}`, `<i class="hn-emoji">${BERRIES[key].emoji}</i>`);
const petSrc = (key, form, small = false) => `/assets/pets/${key}-${form}${small ? '-s' : ''}.webp`;
const petName = key => CHARACTERS[key]?.ko || '친구';

let H = null;
const root = () => document.getElementById('app');
let REDUCED = null;
const reduced = () => (REDUCED ||= matchMedia('(prefers-reduced-motion: reduce)')).matches;
const sfx = (key, opts) => { if (soundOn()) playSound(key, opts); };
const buzz = p => { try { if (soundOn()) navigator.vibrate?.(p); } catch {} };
function later(fn, ms) { const cur = H; const t = setTimeout(() => { if (H === cur && !cur.closing) fn(); }, ms); cur.timers.push(t); return t; }
const wait = ms => new Promise(r => later(r, reduced() ? Math.min(ms, 120) : ms));
const $ = id => document.getElementById(id);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const throwId = () => `t-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

export function openHunt(A, exit) {
  closeAll();
  H = { A, exit, timers: [], v: A.data.rewards?.hunt || null, phase: 'map', meet: null, ball: 'basic', berry: null, berryTried: false };
  A.screen = 'hunt';
  root().innerHTML = `<div class="session-app hn-app"><header class="hn-top"><button type="button" class="yb-back" data-hn="exit" aria-label="나가기">${icon('back')}</button><strong>펫 사냥</strong>
    <span class="hn-chips" id="hn-chips" aria-label="내 공"></span><button type="button" class="hn-q" data-hn="guide" aria-label="펫 사냥 안내">?</button></header>
    <main id="hn-main" class="hn-main"></main><div id="hn-layer" class="hn-layer"></div></div>`;
  root().onclick = onClick;
  root().querySelector('.hn-app').addEventListener('contextmenu', e => e.preventDefault());
  window.scrollTo(0, 0);
  preloadSound(['swoosh', 'wiggle', 'pop', 'stamp', 'fanfare-basic', 'coins', 'fail', 'correct', 'wrong', 'tap']);
  chips();
  mapScreen(true);
  api('/hunt/home', {}).then(res => { if (!H) return; setView(res.hunt); if (H.phase === 'map') mapScreen(); if (!H.v?.guide) later(() => guide(true), 500); })
    .catch(err => { if (H) { toast(err.message); mapScreen(); } });
}
function closeAll() {
  if (!H) return;
  H.closing = true; H.timers.forEach(clearTimeout); cancelAnimationFrame(H.raf);
}
async function leave() {
  const exit = H?.exit; closeAll(); root().onclick = null; H = null; await exit?.();
}
const setView = v => { if (!v || !H) return; H.v = v; H.A.data.rewards ||= {}; H.A.data.rewards.hunt = v; chips(); };
function chips() {
  const v = H.v || {}, box = $('hn-chips');
  if (box) box.innerHTML = ['basic', 'good', 'gold'].map(k => `<span class="hn-chip k-${k}" title="${BALL_NAMES[k]}">${ballPic(k, 'sm')}<b>${num(v[k] || 0)}</b></span>`).join('');
}
const balls = () => { const v = H.v || {}; return Number(v.basic || 0) + Number(v.good || 0) + Number(v.gold || 0); };

function onClick(event) {
  const b = event.target.closest('[data-hn]');
  if (!b || b.disabled || !H) return;
  unlockSound();
  const act = b.dataset.hn;
  if (act === 'exit') return H.phase === 'catch' ? runAway() : leave();
  if (act === 'guide') return guide(false);
  if (act === 'spot') return meet(b.dataset.spot);
  if (act === 'run') return runAway();
  if (act === 'bag') return bag();
  if (act === 'berry') return berries();
  if (act === 'pick-ball') return pickBall(b.dataset.ball);
  if (act === 'pick-berry') return quiz(b.dataset.berry);
  if (act === 'answer') return answer(b);
  if (act === 'close-layer') return closeLayer();
  if (act === 'gold-yes') { closeLayer(); H.ball = 'gold'; return catchHud(); }
  if (act === 'to-map') { closeLayer(); return mapScreen(); }
}
const layer = html => { const l = $('hn-layer'); l.innerHTML = html; l.classList.toggle('on', !!html); };
const closeLayer = () => layer('');

/* ---------- 사냥터 지도 ---------- */
const AREAS = { forest: '숲', field: '들판', beach: '바닷가' };
// 그림이 오기 전 지도: 곳마다 가장자리에 나무 · 꽃 · 야자수(이모지), 가운데는 비워 둔다.
const DECO = {
  forest: [['🌳', 4, 10, 54], ['🌲', 80, 6, 58], ['🌳', 88, 40, 50], ['🌲', 2, 52, 52], ['🍄', 14, 86, 26], ['🌿', 70, 88, 30], ['🌳', 6, 92, 48], ['🌲', 84, 82, 54], ['🍄', 90, 64, 22], ['🪨', 46, 6, 30]],
  field: [['🌳', 82, 8, 58], ['🌼', 8, 18, 26], ['🌷', 88, 48, 26], ['🌾', 4, 50, 34], ['🌼', 18, 90, 26], ['🌷', 72, 90, 28], ['🌾', 92, 84, 34], ['🌻', 6, 76, 30], ['🌼', 50, 4, 22], ['🌸', 40, 92, 24]],
  beach: [['🌴', 2, 30, 58], ['🌴', 84, 46, 60], ['🐚', 14, 86, 24], ['⭐', 76, 88, 22], ['🪨', 90, 76, 34], ['🐚', 46, 92, 20], ['🌴', 6, 74, 50], ['🪸', 86, 24, 30]]
};
function mapBg(v) {
  const name = `bg-${v.area || 'forest'}-${v.night ? 'night' : 'day'}`;
  if (has(name)) return `<img class="hn-map-bg" src="/assets/hunt/${name}.webp" alt="" draggable="false">`;
  const deco = (DECO[v.area] || DECO.forest).map(([e, x, y, s], i) => `<i style="left:${x}%;top:${y}%;font-size:${s}px;--d:${i * .37}s">${e}</i>`).join('');
  return `<div class="hn-map-bg code a-${v.area || 'forest'}">${v.area === 'beach' ? '<span class="hn-sea"><i></i></span>' : ''}<span class="hn-path"></span><div class="hn-deco">${deco}</div>${v.night ? `<div class="hn-flies">${'<i></i>'.repeat(12)}</div>` : ''}</div>`;
}
function spotHtml(s, i) {
  const style = `left:${s.x}%;top:${s.y}%;--i:${i};--dx:${(i % 2 ? -1 : 1) * (6 + (i * 5) % 9)}px`;
  if (s.fresh) return `<button type="button" class="hn-spot fresh" data-hn="spot" data-spot="${esc(s.id)}" style="${style}" aria-label="새 친구 만나기"><span class="hn-walk"><span class="hn-shadow"></span><span class="hn-mystery">${art('fx-mystery', '<i class="hn-sparks"><i></i><i></i><i></i><i></i></i>')}<b>?</b></span></span><em>새 친구</em></button>`;
  return `<button type="button" class="hn-spot t-${s.tier}" data-hn="spot" data-spot="${esc(s.id)}" style="${style}" aria-label="${esc(petName(s.key))} 만나기"><span class="hn-walk"><span class="hn-shadow"></span><img src="${petSrc(s.key, s.form || 1, true)}" alt="" draggable="false"></span>${s.tier === 'epic' ? '<em class="epic">★</em>' : ''}</button>`;
}
function nextChange() {
  const ms = (huntSlot(Date.now()) + 1) * HUNT.SLOT_HOURS * 3600000 - 9 * 3600000 - Date.now();
  const h = Math.floor(ms / 3600000), m = Math.max(1, Math.ceil(ms % 3600000 / 60000));
  return h ? `${h}시간 ${m}분` : `${m}분`;
}
function mapScreen(loading = false) {
  H.phase = 'map'; H.meet = null; H.berry = null; H.berryTried = false;
  cancelAnimationFrame(H.raf);
  const v = H.v || {}, spots = v.spots || [], got = v.got || {};
  const empty = !balls();
  $('hn-main').innerHTML = `<section class="hn-map${v.night ? ' night' : ''}">
    ${mapBg(v)}
    <div class="hn-map-tag"><b>${AREAS[v.area] || '숲'}${v.night ? ' · 밤' : ''}</b><small>${loading && !v.spots ? '사냥터를 둘러보는 중…' : `${nextChange()} 뒤에 펫이 바뀌어요`}</small></div>
    <div class="hn-spots">${spots.map(spotHtml).join('')}</div>
    ${!loading && !spots.length ? '<p class="hn-quiet">지금은 조용해요. 조금 뒤에 다시 와요!</p>' : ''}
  </section>
  <section class="hn-dock${empty ? ' empty' : ''}">
    ${empty ? '<p class="hn-dock-lead"><b>공이 없어요.</b> 공부하면 공을 받아요!</p>' : '<p class="hn-dock-lead">펫을 눌러 만나요. <b>반짝이는 ?</b>는 아직 못 만난 새 친구!</p>'}
    <ul class="hn-today" aria-label="오늘 받은 공">
      ${[['practice', '연습 끝내기', '10문제 이상'], ['attend', '출석', '하루 한 번'], ['match', '짝 맞추기', '별 3개']].map(([k, t, s]) => `<li class="${got[k] ? 'on' : ''}"><i>${got[k] ? '✓' : ''}</i><b>${t}</b><small>${s}</small></li>`).join('')}
    </ul>
    <p class="hn-gold-line">${ballPic('gold', 'sm')}<span>황금 공까지 출석 도장판 <b>${num(v.cards || 0)} / ${num(v.gold_cards || HUNT.GOLD_CARDS)}</b>장</span></p>
  </section>`;
}

/* ---------- 만남 ---------- */
async function meet(spotId) {
  if (H.phase !== 'map' || H.busy) return;
  const btn = document.querySelector(`[data-spot="${CSS.escape(spotId)}"]`);
  H.busy = true; btn?.classList.add('picked'); sfx('tap');
  let res;
  try { res = await api('/hunt/meet', { spot: spotId }); }
  catch (err) { H.busy = false; toast(err.message); try { setView((await api('/hunt/home', {})).hunt); } catch {} return mapScreen(); }
  H.busy = false;
  if (!H) return;
  setView(res.hunt);
  H.meet = res; H.throws = 0;
  H.ball = Number(H.v.basic || 0) ? 'basic' : Number(H.v.good || 0) ? 'good' : 'basic';
  H.phase = 'intro';
  // 하얀 번쩍임 → "야생의 ○○이(가) 나타났다!"
  const flash = document.createElement('div'); flash.className = 'hn-flash'; $('hn-main').appendChild(flash);
  sfx('swoosh', { rate: .8 }); buzz(20);
  await wait(380);
  catchScreen();
  const name = petName(res.key);
  const banner = document.createElement('div'); banner.className = `hn-appear${res.fresh ? ' fresh' : ''}`;
  banner.innerHTML = `<span>${res.fresh ? '✨ 새 친구! ' : ''}야생의 <b>${esc(petJosa(name, '이', '가'))}</b> 나타났다!</span>`;
  $('hn-main').appendChild(banner);
  sfx(res.fresh ? 'fanfare-basic' : 'pop', { gain: res.fresh ? .6 : .7 });
  await wait(1500);
  banner.classList.add('bye');
  later(() => banner.remove(), 400);
  H.phase = 'catch';
}

/* ---------- 잡기 화면 ---------- */
// 원 색(난이도): 지금 고른 공 · 열매로 한 번에 잡힐 확률. 30% 이상 초록, 15% 이상 노랑, 그 밑은 빨강.
const ringColor = () => { const p = catchChance(H.meet.tier, { ball: H.ball, berry: H.berry }); return p >= 1 ? 'gold' : p >= .3 ? 'green' : p >= .15 ? 'yellow' : 'red'; };
function catchScreen() {
  const m = H.meet, name = petName(m.key);
  const bg = has('bg-catch') ? '<img class="hn-catch-bg" src="/assets/hunt/bg-catch.webp" alt="" draggable="false">' : '<div class="hn-catch-bg code"><i class="hill h1"></i><i class="hill h2"></i><i class="grass"></i><i class="tuft t1">🌿</i><i class="tuft t2">🌼</i><i class="tuft t3">🌿</i></div>';
  $('hn-main').innerHTML = `<section class="hn-catch" id="hn-catch">
    ${bg}
    <button type="button" class="hn-run" data-hn="run" aria-label="도망가기">🏃<small>도망</small></button>
    <div class="hn-name"><b>${esc(name)}</b><span class="hn-tier t-${m.tier}${m.fresh ? ' fresh' : ''}">${m.fresh ? '★ 새 친구 · ' : ''}${TIER_NAMES[m.tier]}</span></div>
    <div class="hn-target" id="hn-target">
      <div class="hn-pet-wrap" id="hn-petwrap"><span class="hn-pet-shadow"></span><img class="hn-pet" id="hn-pet" src="${petSrc(m.key, m.form || 1)}" alt="${esc(name)}" draggable="false"></div>
      <div class="hn-ring-out"></div>
      <div class="hn-ring" id="hn-ring">${['green', 'yellow', 'red'].map(c => art(`ring-${c}`, '', `hn-ring-art c-${c}`)).join('')}</div>
      <div class="hn-fx" id="hn-fx"></div>
    </div>
    <p class="hn-say" id="hn-say" aria-live="polite"></p>
    <div class="hn-hud" id="hn-hud"></div>
    <div class="hn-flyer" id="hn-flyer" hidden></div>
  </section>`;
  catchHud();
  bindThrow();
  H.t0 = performance.now();
  H.raf = requestAnimationFrame(tick);
}
function catchHud() {
  const v = H.v || {}, hud = $('hn-hud');
  if (!hud) return;
  if (!Number(v[H.ball] || 0)) H.ball = ['basic', 'good', 'gold'].find(k => k !== 'gold' && Number(v[k] || 0)) || (Number(v.gold || 0) ? H.ball : 'basic');
  const n = Number(v[H.ball] || 0), words = arcadeWords(H.A).ok;
  hud.innerHTML = `<button type="button" class="hn-side berry${H.berry ? ' on' : ''}" data-hn="berry" ${H.berryTried && !H.berry ? 'disabled' : ''} aria-label="열매">${H.berry ? berryPic(H.berry) : art('berry-razz', '<i class="hn-emoji">🍓</i>')}<small>${H.berry ? `${BERRIES[H.berry].name} 사용 중` : H.berryTried ? '다음 공에' : words ? '열매' : '단어 필요'}</small></button>
    <div class="hn-ball-slot${n ? '' : ' none'}" id="hn-slot">
      <span class="hn-ball-hand" id="hn-hand" role="button" tabindex="0" aria-label="${BALL_NAMES[H.ball]} 위로 밀어 던지기">${ballPic(H.ball, 'big')}</span>
      <b class="hn-ball-n">${BALL_NAMES[H.ball]} ×${num(n)}</b>
      ${n ? `<small class="hn-hint">${H.throws ? '' : '위로 쓱 밀어 던져요!'}</small>` : '<small class="hn-hint">이 공이 없어요</small>'}
    </div>
    <button type="button" class="hn-side bag" data-hn="bag" aria-label="가방">${art('bag', '<i class="hn-emoji">🎒</i>')}<small>가방</small></button>`;
  const ring = $('hn-ring');
  if (ring) ring.dataset.c = ringColor();
}
// 원 크기(1 → 0.3 → 1, 바나나면 천천히)와 펫 움직임(영웅은 좌우로, 바나나면 천천히).
function ringScale(t) {
  const period = H.berry === 'nanab' ? 2600 : 1700;
  const k = (t % period) / period;
  return .3 + .7 * (1 - Math.sin(k * Math.PI));
}
function petSway(t) {
  const amp = H.meet?.tier === 'epic' ? 34 : 14, w = H.berry === 'nanab' ? .0011 : .0021;
  return amp * Math.sin(t * w);
}
function tick(now) {
  if (!H || H.phase === 'map') return;
  const t = now - H.t0;
  if (H.phase === 'catch' || H.phase === 'intro') {
    H.rs = ringScale(t); H.sx = petSway(t);
    const ring = $('hn-ring'), wrap = $('hn-petwrap'), out = document.querySelector('.hn-ring-out');
    if (ring) ring.style.transform = `translate(calc(-50% + ${H.sx}px), -50%) scale(${H.rs})`;
    if (out) out.style.transform = `translate(calc(-50% + ${H.sx}px), -50%)`;
    if (wrap) wrap.style.transform = `translateX(${H.sx}px)`;
  }
  H.raf = requestAnimationFrame(tick);
}

/* ---------- 던지기: 공을 위로 밀기 ---------- */
function bindThrow() {
  const box = $('hn-catch');
  let drag = null;
  box.addEventListener('pointerdown', e => {
    const hand = e.target.closest('#hn-hand');
    if (!hand || H.phase !== 'catch' || !Number(H.v?.[H.ball] || 0)) return;
    e.preventDefault();
    hand.setPointerCapture?.(e.pointerId);
    const r = hand.getBoundingClientRect();
    drag = { id: e.pointerId, hand, x0: r.left + r.width / 2, y0: r.top + r.height / 2, pts: [{ x: e.clientX, y: e.clientY, t: e.timeStamp }] };
    hand.classList.add('held');
  });
  box.addEventListener('pointermove', e => {
    if (!drag || e.pointerId !== drag.id) return;
    drag.pts.push({ x: e.clientX, y: e.clientY, t: e.timeStamp }); if (drag.pts.length > 8) drag.pts.shift();
    const p0 = drag.pts[0], dx = e.clientX - (drag.sx ??= p0.x), dy = e.clientY - (drag.sy ??= p0.y);
    drag.hand.style.transform = `translate(${dx}px, ${Math.min(30, dy)}px)`;
  });
  const end = e => {
    if (!drag || e.pointerId !== drag.id) return;
    const d = drag; drag = null;
    d.hand.classList.remove('held');
    const a = d.pts[0], b = d.pts[d.pts.length - 1], dt = Math.max(16, b.t - a.t);
    const vy = (a.y - b.y) / dt, vx = (b.x - a.x) / dt, lift = (d.sy ?? a.y) - b.y;
    d.hand.style.transform = '';
    if (vy < .45 || lift < 36) { if (lift > 8) say('조금 더 세게 위로 밀어요!'); return; }
    throwBall({ vx, vy, x: b.x });
  };
  box.addEventListener('pointerup', end);
  box.addEventListener('pointercancel', e => { if (drag && e.pointerId === drag.id) { drag.hand.style.transform = ''; drag.hand.classList.remove('held'); drag = null; } });
  // 키보드: Enter · 스페이스로 가운데로 던지기(원 크기는 그 순간).
  box.addEventListener('keydown', e => { if (e.target.id === 'hn-hand' && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); if (H.phase === 'catch') throwBall({ vx: 0, vy: 1.2, x: null }); } });
}
function say(text, cls = '') { const s = $('hn-say'); if (!s) return; s.className = `hn-say show ${cls}`; s.innerHTML = text; clearTimeout(H.sayT); H.sayT = later(() => s.classList.remove('show'), 1600); }
async function throwBall({ vx, vy, x }) {
  const target = $('hn-target'), hand = $('hn-hand'), flyer = $('hn-flyer');
  if (!target || !hand || H.phase !== 'catch') return;
  H.phase = 'flying';
  const tr = target.getBoundingClientRect(), hr = hand.getBoundingClientRect(), app = $('hn-catch').getBoundingClientRect();
  const rs = H.rs, sway = H.sx;
  // 옆으로 민 만큼 옆으로 간다(세게 던질수록 덜 휜다).
  const startX = hr.left + hr.width / 2, startY = hr.top + hr.height / 2;
  const endX = x === null ? tr.left + tr.width / 2 : clamp(startX + vx * 260, app.left + 10, app.right - 10);
  const endY = tr.top + tr.height * .5;
  const petX = tr.left + tr.width / 2 + petSway(performance.now() - H.t0 + 560);
  const off = Math.abs(endX - petX), petR = tr.width * .28, ringR = tr.width * .4 * rs;
  const hit = off < petR + 6;
  const quality = hit && off < ringR ? (rs < .45 ? 'excellent' : rs < .7 ? 'great' : rs < .95 ? 'nice' : null) : null;
  flyer.hidden = false;
  flyer.innerHTML = art('ball-spin', ballPic(H.ball, 'big spin'), 'big');
  const dur = reduced() ? 1 : 560;
  const sx = startX - app.left, sy = startY - app.top, ex = endX - app.left, ey = endY - app.top;
  hand.style.visibility = 'hidden';
  sfx('swoosh'); buzz(12);
  const anim = flyer.animate([
    { transform: `translate(${sx}px, ${sy}px) translate(-50%, -50%) scale(1) rotate(0deg)` },
    { transform: `translate(${(sx + ex) / 2}px, ${Math.min(sy, ey) - 120}px) translate(-50%, -50%) scale(.72) rotate(360deg)`, offset: .55 },
    { transform: `translate(${ex}px, ${hit ? ey : ey - 30}px) translate(-50%, -50%) scale(.5) rotate(720deg)` }
  ], { duration: dur, easing: 'cubic-bezier(.3,.6,.4,1)', fill: 'forwards' });
  await anim.finished.catch(() => {});
  if (!H) return;
  if (!hit) {
    // 빗나감: 공이 튕겨서 손에 돌아온다(공을 쓰지 않는다).
    flyer.animate([{ opacity: 1 }, { opacity: 0, transform: `translate(${ex + (endX > petX ? 60 : -60)}px, ${ey + 140}px) translate(-50%, -50%) scale(.4)` }], { duration: reduced() ? 1 : 420, fill: 'forwards' });
    say('빗나갔어요! 공이 돌아왔어요', 'miss'); sfx('tap', { rate: .7 });
    await wait(450);
    flyer.hidden = true; hand.style.visibility = '';
    H.phase = 'catch';
    return;
  }
  if (quality) { say(`<b class="q-${quality}">${THROW_NAMES[quality]}!</b>`, 'quality'); sfx('combo', { rate: quality === 'excellent' ? 1.3 : quality === 'great' ? 1.15 : 1 }); }
  await capture(quality, sway);
}
// 펫이 공에 빨려 들어가고, 서버가 정한 흔들림만큼 흔들린 뒤 딸깍 · 빠져나옴 · 도망.
async function capture(quality, sway) {
  const m = H.meet, fx = $('hn-fx'), wrap = $('hn-petwrap'), flyer = $('hn-flyer'), ring = $('hn-ring');
  H.phase = 'shaking';
  const id = throwId(), body = { id, spot: m.spot, ball: H.ball, quality, berry: H.berry };
  const req = sendThrow(body);
  // 빨려 들어가기
  wrap.classList.add('sucked'); ring.classList.add('hide'); document.querySelector('.hn-ring-out')?.classList.add('hide');
  fx.innerHTML = `<span class="hn-suck"></span>`;
  sfx('pop', { rate: 1.3, gain: .6 }); buzz(18);
  flyer.hidden = true;
  const ground = document.createElement('div'); ground.className = 'hn-ground-ball'; ground.style.setProperty('--sx', `${sway}px`);
  ground.innerHTML = ballPic(H.ball, 'big');
  fx.appendChild(ground);
  await wait(520);
  const res = await req;
  if (!H) return;
  if (!res) {
    // 연결 실패: 서버가 받았는지 모르니 화면을 다시 받고 지도로.
    ground.remove(); wrap.classList.remove('sucked');
    say('연결이 끊겼어요. 지도에서 다시 확인할게요.', 'miss');
    await wait(1200);
    try { setView((await api('/hunt/home', {})).hunt); } catch {}
    return mapScreen();
  }
  setView(res.hunt);
  if (res.points_balance != null) { H.A.data.stats.points_balance = res.points_balance; }
  if (res.profile) H.A.data.profile = res.profile;
  if (res.stats) H.A.data.stats = res.stats;
  H.throws = (H.throws || 0) + 1;
  H.berry = null; H.berryTried = false;
  catchHud();
  const shakes = res.caught ? 3 : res.shakes;
  for (let i = 0; i < shakes; i++) {
    ground.classList.remove('wob-l', 'wob-r'); void ground.offsetWidth;
    ground.classList.add(i % 2 ? 'wob-r' : 'wob-l');
    if (has('ball-tilt-l')) ground.innerHTML = art(i % 2 ? 'ball-tilt-r' : 'ball-tilt-l', '', 'big');
    sfx('wiggle', { rate: 1 + i * .1 }); buzz(10);
    await wait(880);
  }
  if (res.caught) return caught(res, ground);
  // 빠져나옴
  ground.innerHTML = art('ball-open', ballPic(res.ball, 'big open'), 'big');
  fx.insertAdjacentHTML('beforeend', `<span class="hn-burst">${art('fx-burst', '<i></i><i></i><i></i><i></i><i></i><i></i>')}</span>`);
  wrap.classList.remove('sucked'); wrap.classList.add('popout');
  sfx('pop'); buzz([20, 30, 20]);
  later(() => ground.remove(), 300);
  if (res.fled) {
    say(`앗, 빠져나왔어요!`, 'miss');
    await wait(900);
    fx.insertAdjacentHTML('beforeend', `<span class="hn-smoke">${art('fx-smoke', '<i></i><i></i><i></i><i></i><i></i>')}</span>`);
    wrap.classList.add('fled'); sfx('fail');
    say(`${esc(petJosa(petName(m.key), '이', '가'))} 도망쳤어요…`, 'miss');
    await wait(1500);
    return result({ title: '도망쳤어요', key: m.key, form: m.form, fled: true });
  }
  say('앗, 빠져나왔어요! 한 번 더!', 'miss');
  await wait(700);
  wrap.classList.remove('popout');
  ring.classList.remove('hide'); document.querySelector('.hn-ring-out')?.classList.remove('hide');
  fx.innerHTML = '';
  catchHud();
  H.phase = 'catch';
}
async function sendThrow(body) {
  for (let i = 0; i < 2; i++) {
    try { return await api('/hunt/throw', body); }
    catch (err) {
      if (err.status && err.status < 500) { toast(err.message); return null; }
      await new Promise(r => setTimeout(r, 500));
    }
  }
  return null;
}
async function caught(res, ground) {
  const fx = $('hn-fx'), name = petName(res.key);
  ground.innerHTML = art('ball-lock', ballPic(res.ball, 'big'), 'big');
  ground.classList.add('locked');
  fx.insertAdjacentHTML('beforeend', `<span class="hn-sparkle">${art('fx-sparkle', '<i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i>')}</span><span class="hn-stars">${[0, 1, 2].map(i => `<i style="--i:${i}">${art('fx-star', '★')}</i>`).join('')}</span>`);
  sfx('stamp'); buzz([30, 40, 60]);
  say(`<b>잡았다!</b>`, 'got');
  await wait(1400);
  if (res.new_pet) {
    // 새 친구: 알 상점과 같은 공개 연출(영웅은 영웅 연출).
    await huntPetShow(res.key, res.tier);
    return result({ title: '새 친구가 됐어요!', key: res.key, form: 1, fresh: true, tier: res.tier });
  }
  return result({ title: `${esc(petJosa(name, '을', '를'))} 잡았어요!`, key: res.key, form: H.meet?.form || 1, coins: res.coins, xp: res.xp, double: res.berry === 'pinap' });
}
function result({ title, key, form, fled = false, fresh = false, tier, coins = 0, xp = 0, double = false }) {
  H.phase = 'result';
  cancelAnimationFrame(H.raf);
  const name = petName(key);
  const lines = fled ? `<p>공 ${num(H.throws || 0)}개를 던졌어요. 지도에는 다른 친구가 기다려요!</p>`
    : fresh ? `<p><b>${esc(petJosa(name, '이', '가'))}</b> 내 펫이 됐어요${tier === 'epic' ? ' (영웅)' : ''}. 함께 공부해 Lv.3이 되면 알에서 깨어나요.</p>`
    : `<div class="hn-rewards"><span>${coin()}<b>+${num(coins)}</b><small>코인</small></span><span><b>+${num(xp)}</b><small>${esc(name)} 경험치</small></span></div>${double ? '<p class="hn-double">🍍 파인애플 덕분에 두 배!</p>' : ''}`;
  layer(`<div class="hn-result${fled ? ' fled' : ' got'}" role="dialog" aria-modal="true" aria-label="${fled ? '도망' : '잡음'}">
    <div class="hn-result-card">
      <div class="hn-result-pet"><img src="${petSrc(key, fresh ? 0 : form)}" alt="" draggable="false"${fled ? ' class="gone"' : ''}>${fled ? art('fx-smoke', '<span class="hn-res-smoke">💨</span>') : art('fx-sparkle', '<span class="hn-res-spark">✨</span>')}</div>
      <h2>${title}</h2>
      ${lines}
      <button type="button" class="yl-cta" data-hn="to-map">지도로 돌아가기</button>
    </div>
  </div>`);
  if (coins && !reduced()) { const card = document.querySelector('.hn-result-card'); if (card) coinShower(card, 14); sfx('coins'); }
  H.throws = 0;
}
async function runAway() {
  if (H.phase !== 'catch' && H.phase !== 'intro') return;
  sfx('swoosh', { rate: 1.3 });
  say('안전하게 도망쳤어요');
  await wait(260);
  mapScreen();
}

/* ---------- 가방 · 열매 ---------- */
function bag() {
  if (H.phase !== 'catch') return;
  const v = H.v || {};
  layer(`<div class="hn-sheet" role="dialog" aria-modal="true" aria-label="가방"><div class="hn-sheet-box"><h3>${art('bag', '🎒')} 가방</h3>
    <div class="hn-bag">${['basic', 'good', 'gold'].map(k => `<button type="button" class="hn-bag-item k-${k}${H.ball === k ? ' on' : ''}" data-hn="pick-ball" data-ball="${k}" ${Number(v[k] || 0) ? '' : 'disabled'}>${ballPic(k, 'mid')}<b>${BALL_NAMES[k]}</b><small>${k === 'gold' ? '무조건 잡혀요' : k === 'good' ? '잡기 ×1.5' : '기본'} · ${num(v[k] || 0)}개</small></button>`).join('')}</div>
    <p class="hn-sheet-note">공은 공부로만 받아요: 연습 끝내기 · 출석 · 짝 맞추기 별 3(곳마다 하루 1개, ${HUNT.BALL_MAX}개까지). 황금 공은 출석 도장판 ${HUNT.GOLD_CARDS}장마다.</p>
    <button type="button" class="btn full" data-hn="close-layer">닫기</button></div></div>`);
}
function pickBall(kind) {
  if (kind === 'gold') {
    return layer(`<div class="hn-sheet" role="dialog" aria-modal="true" aria-label="황금 공 확인"><div class="hn-sheet-box hn-confirm">${ballPic('gold', 'big')}<h3>정말 쓸까요?</h3>
      <p>황금 공은 <b>무조건 잡혀요.</b> 한 달에 하나만 받는 귀한 공이에요.${H.meet?.fresh ? '' : '<br>이 친구는 <b>이미 가진 펫</b>이에요.'}</p>
      <div class="hn-confirm-row"><button type="button" class="btn" data-hn="close-layer">아껴 둘래요</button><button type="button" class="yl-cta" data-hn="gold-yes">황금 공 쓰기</button></div></div></div>`);
  }
  H.ball = kind; closeLayer(); catchHud(); sfx('tap');
}
function berries() {
  if (H.phase !== 'catch' || H.berry || H.berryTried) return;
  if (!arcadeWords(H.A).ok) return say('놀이터에서 게임 단어를 골라 주세요');
  layer(`<div class="hn-sheet" role="dialog" aria-modal="true" aria-label="열매"><div class="hn-sheet-box"><h3>열매 고르기</h3>
    <p class="hn-sheet-note">단어 문제를 맞히면 열매를 줘요. 다음 공 하나에 써요.</p>
    <div class="hn-berries">${Object.entries(BERRIES).map(([k, b]) => `<button type="button" class="hn-berry" data-hn="pick-berry" data-berry="${k}">${berryPic(k)}<b>${b.name}</b><small>${b.note}</small></button>`).join('')}</div>
    <button type="button" class="btn full" data-hn="close-layer">닫기</button></div></div>`);
}
// 열매 문제: 게임 단어(학습 범위)에서 영어 → 뜻 4지선다. 한 공에 한 번.
function quiz(berry) {
  const list = arcadeWords(H.A).list.map(w => ({ id: w.id, en: displayEnglish(w.word || '').trim(), ko: cardMeaning(w.meaning) })).filter(w => w.en && w.ko);
  const pool = shuffle([...list]);
  const q = pool[0];
  if (!q) return closeLayer();
  const wrong = [...new Set(pool.slice(1).map(w => w.ko).filter(ko => ko !== q.ko))].slice(0, 3);
  const choices = shuffle([q.ko, ...wrong]);
  H.quiz = { berry, answer: q.ko, en: q.en };
  layer(`<div class="hn-sheet" role="dialog" aria-modal="true" aria-label="열매 문제"><div class="hn-sheet-box hn-quiz">${berryPic(berry)}<small>뜻을 골라요</small><h3 class="hn-q-word">${esc(q.en)}</h3>
    <div class="hn-choices">${choices.map(c => `<button type="button" class="hn-choice" data-hn="answer" data-ko="${esc(c)}">${esc(c)}</button>`).join('')}</div></div></div>`);
}
function answer(b) {
  const q = H.quiz; if (!q) return;
  H.quiz = null;
  const ok = b.dataset.ko === q.answer;
  document.querySelectorAll('.hn-choice').forEach(x => { x.disabled = true; if (x.dataset.ko === q.answer) x.classList.add('right'); });
  if (!ok) b.classList.add('wrong');
  sfx(ok ? 'correct' : 'wrong'); buzz(ok ? 15 : [20, 40, 20]);
  H.berryTried = true;
  if (ok) H.berry = q.berry;
  later(() => { closeLayer(); catchHud(); say(ok ? `${BERRIES[q.berry].emoji} ${BERRIES[q.berry].name} 열매를 줬어요! ${BERRIES[q.berry].note}` : `아쉬워요! <b>${esc(q.en)}</b> = ${esc(q.answer)}`, ok ? 'good' : 'miss'); }, 700);
}

/* ---------- 안내 ---------- */
function guide(first) {
  layer(`<div class="hn-sheet" role="dialog" aria-modal="true" aria-label="펫 사냥 안내"><div class="hn-sheet-box hn-guide"><h3>펫 사냥 안내</h3>
    <ol>
      <li><b>지도</b>에서 돌아다니는 펫을 눌러 만나요. <b>반짝이는 ?</b>는 아직 못 만난 새 친구예요(기본 · 영웅).</li>
      <li>공을 <b>위로 쓱 밀어</b> 던져요. 줄어드는 원이 <b>작을 때</b> 원 안에 맞히면 나이스 · 그레이트 · 엑설런트로 더 잘 잡혀요.</li>
      <li>원 색이 초록이면 쉽고, 노랑 · 빨강일수록 어려워요. 빠져나온 펫은 도망칠 수도 있어요.</li>
      <li><b>열매</b>: 단어 문제를 맞히면 🍓 잡기 ×1.5 · 🍍 보상 ×2 · 🍌 원과 펫이 천천히.</li>
      <li>가진 펫을 잡으면 <b>+${HUNT.DUP_COINS}코인</b>과 그 펫 경험치, 새 친구를 잡으면 <b>내 펫</b>이 돼요.</li>
      <li><b>공은 공부로만</b>: 연습 끝내기(10문제 이상) · 출석 · 짝 맞추기 별 3, 곳마다 하루 1개. 만점 · 별 3이면 가끔 좋은 공, 출석 도장판 ${HUNT.GOLD_CARDS}장이면 황금 공!</li>
    </ol>
    <button type="button" class="yl-cta" data-hn="close-layer">${first ? '사냥 시작!' : '알겠어요'}</button></div></div>`);
  if (first) api('/hunt/guide', {}).then(res => setView(res.hunt)).catch(() => {});
}
