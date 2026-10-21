import { api, esc, num, icon, toast } from './ui.js';
import { CHARACTERS } from './core.js';
import { coin } from './emblems.js';
import { playSound, unlockSound, soundOn, preloadSound } from './sound.js';
import { coinShower, countUp } from './celebrate.js';
import { huntPetShow, petJosa, buyEgg } from './pet-moments.js';
import { arcadeWords } from './arcade-games.js';
import { HUNT, BERRIES, BALL_NAMES, THROW_NAMES, TIER_NAMES, HUNT_MONSTERS, MONSTER_KEYS, MONSTER_TIERS, catchChance, huntSlot, tierLabel, tierStars } from './hunt-rules.js';

// V13.162 몬스터 사냥(놀이터, 처음 이름 펫 사냥). 포켓몬 고처럼: 그림 지도 위 야생 몬스터를 눌러 만나고(하얀 번쩍임 → "야생의 ○○이 나타났다!"),
// 잡기 화면에서 공을 위로 밀어 던진다. 줄어드는 원이 작을 때 원 안에 맞히면 나이스 · 그레이트 · 엑설런트.
// 흔들림 1~3번 → 딸깍 + 별(잡았다) / 빠져나옴 / 도망 연기. 잡은 몬스터는 가방 · 도감 → 팔아서 별조각 → 교환소(코인 · 알).
// 가끔 나오는 펫(아직 못 만난)은 알 상점과 같은 펫 공개 연출(pet-moments.js huntPetShow).
// 만남 · 잡힘 · 도망은 서버가 정한다(server/hunt.mjs). 빗나간 공(펫에 안 닿음)은 서버에 보내지 않고 손에 돌아온다.
// 그림(주문서 34)은 HUNT_ART에 이름이 있으면 쓰고, 없으면 코드 그림 · 이모지로 그린다(reel.js FISHING_ART와 같은 방식).
export const HUNT_ART = new Set(['bg-forest-day', 'bg-forest-night', 'bg-field-day', 'bg-field-night', 'bg-beach-day', 'bg-beach-night', 'bg-catch', 'entry', 'ball-basic', 'ball-good', 'ball-gold', 'ball-open', 'ball-spin', 'ball-tilt-l', 'ball-tilt-r', 'ball-lock', 'fx-sparkle', 'fx-star', 'fx-burst', 'fx-smoke', 'ring-green', 'ring-yellow', 'ring-red', 'fx-mystery', 'berry-razz', 'berry-pinap', 'berry-nanab', 'bag']);
const has = name => HUNT_ART.has(name);
const art = (name, fallback, cls = '') => has(name) ? `<img class="hn-art hn-art-${name} ${cls}" src="/assets/hunt/${name}.webp" alt="" draggable="false">` : fallback;
const ballPic = (kind, cls = '') => art(`ball-${kind}`, `<i class="hn-ball k-${kind} ${cls}"><b></b></i>`, cls);
const berryPic = key => art(`berry-${key}`, `<i class="hn-emoji">${BERRIES[key].emoji}</i>`);
const petSrc = (key, form, small = false) => `/assets/pets/${key}-${form}${small ? '-s' : ''}.webp`;
// V13.162 몬스터 위주(선생님 결정): 몬스터 그림은 몬스터전 · 던전 그림을 그대로(기본 · attack · hurt · down).
const monSrc = (key, pose = '') => `/assets/monsters/${key}${pose ? `-${pose}` : ''}.webp`;
const isPet = m => m?.kind === 'pet';
const spriteOf = (m, pose = '') => isPet(m) ? petSrc(m.key, m.form || 1) : monSrc(m.key, pose);
const petName = key => HUNT_MONSTERS[key]?.ko || CHARACTERS[key]?.ko || '친구';
const STAR = '<i class="hn-star-ico" aria-hidden="true">✦</i>';

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
  root().innerHTML = `<div class="session-app hn-app"><header class="hn-top"><button type="button" class="yb-back" data-hn="exit" aria-label="나가기">${icon('back')}</button><strong>몬스터 사냥</strong>
    <span class="hn-chips" id="hn-chips" aria-label="내 공"></span><button type="button" class="hn-q" data-hn="guide" aria-label="몬스터 사냥 안내">?</button></header>
    <main id="hn-main" class="hn-main"></main><div id="hn-layer" class="hn-layer"></div></div>`;
  root().onclick = onClick;
  root().querySelector('.hn-app').addEventListener('contextmenu', e => e.preventDefault());
  window.scrollTo(0, 0);
  preloadSound(['swoosh', 'wiggle', 'pop', 'stamp', 'fanfare-basic', 'coins', 'fail', 'correct', 'wrong', 'tap', 'hit', 'step', 'burst', 'crit', 'combo']);
  chips();
  mapScreen(true);
  api('/hunt/home', {}).then(res => { if (!H) return; setView(res.hunt); if (H.phase === 'map') mapScreen(); if (!H.v?.guide) later(() => guide(true), 500); })
    .catch(err => { if (H) { toast(err.message); mapScreen(); } });
}
function closeAll() {
  if (!H) return;
  H.closing = true; H.timers.forEach(clearTimeout); cancelAnimationFrame(H.raf);
  if (H.onResize) removeEventListener('resize', H.onResize);
  stopMotion(); stopTilt();
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
  if (act === 'phone') return togglePhone();
  if (act === 'bagmon') return monsterBag();
  if (act === 'book') return monsterBook();
  if (act === 'shop') return shop();
  if (act === 'sell') return sell(b.dataset.key || null, b);
  if (act === 'coins') return exchangeCoins(Number(b.dataset.n), b);
  if (act === 'egg') return exchangeEgg(b.dataset.item, b);
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
// V13.162 고퀄: 가운데 내 파트너(레이더 물결), 바스락거리는 풀숲, 흘러가는 구름 그림자, 방향을 바꿔 걷는 펫.
// 펫을 누르면 그 자리로 카메라가 확 다가가고(줌) 하얀 번쩍임 뒤 잡기 화면.
const AREAS = { forest: '숲', field: '들판', beach: '바닷가' };
// 그림이 오기 전 지도: 곳마다 가장자리에 나무 · 꽃 · 야자수(이모지), 가운데는 비워 둔다.
const DECO = {
  forest: [['🌳', 4, 10, 54], ['🌲', 80, 6, 58], ['🌳', 88, 40, 50], ['🌲', 2, 52, 52], ['🍄', 14, 86, 26], ['🌿', 70, 88, 30], ['🌳', 6, 92, 48], ['🌲', 84, 82, 54], ['🍄', 90, 64, 22], ['🪨', 46, 6, 30]],
  field: [['🌳', 82, 8, 58], ['🌼', 8, 18, 26], ['🌷', 88, 48, 26], ['🌾', 4, 50, 34], ['🌼', 18, 90, 26], ['🌷', 72, 90, 28], ['🌾', 92, 84, 34], ['🌻', 6, 76, 30], ['🌼', 50, 4, 22], ['🌸', 40, 92, 24]],
  beach: [['🌴', 2, 30, 58], ['🌴', 84, 46, 60], ['🐚', 14, 86, 24], ['⭐', 76, 88, 22], ['🪨', 90, 76, 34], ['🐚', 46, 92, 20], ['🌴', 6, 74, 50], ['🪸', 86, 24, 30]]
};
const RUSTLE = [[22, 22], [74, 18], [12, 46], [86, 38], [30, 64], [66, 58], [48, 30]];
function mapBg(v) {
  const name = `bg-${v.area || 'forest'}-${v.night ? 'night' : 'day'}`;
  const life = `<div class="hn-clouds" aria-hidden="true"><i></i><i></i></div><div class="hn-rustles" aria-hidden="true">${RUSTLE.map(([x, y], i) => `<i style="left:${x}%;top:${y}%;--d:${(i * 1.7) % 5}s"><b></b><b></b><b></b></i>`).join('')}</div>${v.night ? `<div class="hn-flies">${'<i></i>'.repeat(12)}</div>` : ''}`;
  if (has(name)) return `<img class="hn-map-bg" src="/assets/hunt/${name}.webp" alt="" draggable="false">${life}`;
  const deco = (DECO[v.area] || DECO.forest).map(([e, x, y, s], i) => `<i style="left:${x}%;top:${y}%;font-size:${s}px;--d:${i * .37}s">${e}</i>`).join('');
  return `<div class="hn-map-bg code a-${v.area || 'forest'}">${v.area === 'beach' ? '<span class="hn-sea"><i></i></span>' : ''}<span class="hn-path"></span><div class="hn-deco">${deco}</div></div>${life}`;
}
function spotHtml(s, i) {
  const style = `left:${s.x}%;top:${s.y}%;--i:${i};--dx:${(i % 2 ? -1 : 1) * (14 + (i * 7) % 12)}px;--wt:${6 + (i * 1.3) % 3}s`;
  if (s.kind === 'pet') return `<button type="button" class="hn-spot fresh" data-hn="spot" data-spot="${esc(s.id)}" style="${style}" aria-label="반짝이는 펫 만나기"><span class="hn-walk"><span class="hn-shadow"></span><span class="hn-mystery">${art('fx-mystery', '<i class="hn-sparks"><i></i><i></i><i></i><i></i></i>')}<b>?</b></span></span><em>펫?!</em></button>`;
  return `<button type="button" class="hn-spot mon t-${s.tier}" data-hn="spot" data-spot="${esc(s.id)}" style="${style}" aria-label="${esc(petName(s.key))}(${tierLabel(s.tier)}) 만나기"><span class="hn-walk"><span class="hn-shadow"></span><span class="hn-face"><img src="${monSrc(s.key)}" alt="" draggable="false" loading="lazy"></span></span><em class="tier t-${s.tier}">${tierStars(s.tier)}</em></button>`;
}
function nextChange() {
  const ms = (huntSlot(Date.now()) + 1) * HUNT.SLOT_HOURS * 3600000 - 9 * 3600000 - Date.now();
  const h = Math.floor(ms / 3600000), m = Math.max(1, Math.ceil(ms % 3600000 / 60000));
  return h ? `${h}시간 ${m}분` : `${m}분`;
}
function myPet() {
  const pet = H.A.data.stats?.pet;
  return pet?.key ? { key: pet.key, form: Math.max(1, Number(pet.form || 1)) } : { key: H.A.data.profile?.avatar_key || 'dog', form: 1 };
}
function mapScreen(loading = false) {
  stopCatch();
  H.phase = 'map'; H.meet = null; H.berry = null; H.berryTicket = null; H.berryTried = false;
  const v = H.v || {}, spots = v.spots || [], got = v.got || {};
  const empty = !balls(), me = myPet();
  $('hn-main').innerHTML = `<section class="hn-map${v.night ? ' night' : ''}" id="hn-map">
    <div class="hn-map-world" id="hn-world">
      ${mapBg(v)}
      <div class="hn-me" aria-hidden="true"><i class="hn-radar"></i><i class="hn-radar r2"></i><span class="hn-me-shadow"></span><img src="${petSrc(me.key, me.form, true)}" alt="" draggable="false"></div>
      <div class="hn-spots">${spots.map(spotHtml).join('')}</div>
    </div>
    <div class="hn-map-tag"><i aria-hidden="true">${v.night ? '🌙' : '☀️'}</i><b>${AREAS[v.area] || '숲'}${v.night ? ' · 밤' : ''}</b><small>${loading && !v.spots ? '사냥터를 둘러보는 중…' : `${nextChange()} 뒤에 펫이 바뀌어요`}</small></div>
    ${!loading && !spots.length ? '<p class="hn-quiet">지금은 조용해요. 조금 뒤에 다시 와요!</p>' : ''}
  </section>
  <section class="hn-dock${empty ? ' empty' : ''}">
    <div class="hn-dock-btns"><button type="button" data-hn="bagmon"><i class="hn-dock-ico">🎒</i><b>가방</b><small>${num(Object.values(v.bag || {}).reduce((a, n) => a + n, 0))}마리</small></button><button type="button" data-hn="book"><i class="hn-dock-ico">📖</i><b>도감</b><small>${num(v.kinds || 0)} / ${num(v.all || MONSTER_KEYS.length)}</small></button><button type="button" data-hn="shop"><i class="hn-dock-ico">✦</i><b>교환소</b><small>${num(v.stars || 0)}</small></button></div>
    ${empty ? '<p class="hn-dock-lead"><b>공이 없어요.</b> 공부하면 공을 받아요!</p>' : '<p class="hn-dock-lead">몬스터를 눌러 잡아요. 가끔 <b>반짝이는 ?</b>는 아직 못 만난 펫!</p>'}
    <ul class="hn-today" aria-label="오늘 받은 공">
      ${[['practice', '연습 끝내기', '10문제 이상'], ['attend', '출석', '하루 한 번'], ['match', '짝 맞추기', '별 3개']].map(([k, t, s]) => `<li class="${got[k] ? 'on' : ''}"><i>${got[k] ? '✓' : ''}</i><b>${t}</b><small>${s}</small></li>`).join('')}
    </ul>
    <p class="hn-gold-line">${ballPic('gold', 'sm')}<span>황금 공까지 출석 도장판 <b>${num(v.cards || 0)} / ${num(v.gold_cards || HUNT.GOLD_CARDS)}</b>장</span></p>
  </section>`;
  // 가끔 풀숲이 크게 흔들리고 폰이 살짝 떨린다(포켓몬 고의 '근처에 뭔가 있다').
  if (!loading && spots.length) later(() => { const r = document.querySelectorAll('.hn-rustles i'); const one = r[Math.floor(Math.random() * r.length)]; one?.classList.add('big'); }, 1200);
}

/* ---------- 만남 ---------- */
async function meet(spotId) {
  if (H.phase !== 'map' || H.busy) return;
  const btn = document.querySelector(`[data-spot="${CSS.escape(spotId)}"]`);
  H.busy = true; btn?.classList.add('picked'); sfx('tap'); buzz(15);
  const zoom = btn && !reduced() ? zoomTo(btn) : null;
  let res;
  try { res = await api('/hunt/meet', { spot: spotId }); }
  catch (err) { H.busy = false; toast(err.message); try { setView((await api('/hunt/home', {})).hunt); } catch {} return mapScreen(); }
  H.busy = false;
  if (!H) return;
  setView(res.hunt);
  H.meet = res; H.throws = 0;
  H.ball = Number(H.v.basic || 0) ? 'basic' : Number(H.v.good || 0) ? 'good' : 'basic';
  if (!isPet(res)) for (const pz of ['attack', 'hurt']) new Image().src = monSrc(res.key, pz);
  H.phase = 'intro';
  await zoom;
  // 하얀 번쩍임 → "야생의 ○○이(가) 나타났다!"
  const flash = document.createElement('div'); flash.className = 'hn-flash'; $('hn-main').appendChild(flash);
  sfx('swoosh', { rate: .8 }); buzz([20, 40, 30]);
  await wait(260);
  catchScreen(true);
  const name = petName(res.key);
  const banner = document.createElement('div'); banner.className = `hn-appear t-${res.tier}${isPet(res) ? ' fresh' : ''}`;
  banner.innerHTML = `<span>${isPet(res) ? '✨ 펫이다! ' : ['epic', 'legend'].includes(res.tier) ? `⚡ ${tierLabel(res.tier)} 몬스터! ` : ''}야생의 <b>${esc(petJosa(name, '이', '가'))}</b> 나타났다!</span>`;
  $('hn-main').appendChild(banner);
  later(() => { sfx(isPet(res) ? 'fanfare-basic' : res.tier === 'legend' ? 'boss' : ['epic', 'rare'].includes(res.tier) ? 'boss-roar' : 'pop', { gain: .6 }); buzz(isPet(res) || res.tier === 'legend' ? [30, 40, 60] : 25); }, 520);
  await wait(1700);
  banner.classList.add('bye');
  later(() => banner.remove(), 400);
  if (H.phase === 'intro') H.phase = 'catch';
}
// 지도 카메라가 누른 펫 쪽으로 확 다가간다.
function zoomTo(btn) {
  const world = $('hn-world'), map = $('hn-map');
  if (!world || !map) return null;
  const m = map.getBoundingClientRect(), b = btn.getBoundingClientRect();
  const ox = (b.left + b.width / 2 - m.left) / m.width * 100, oy = (b.top + b.height / 2 - m.top) / m.height * 100;
  world.style.transformOrigin = `${ox}% ${oy}%`;
  return world.animate([{ transform: 'scale(1)', filter: 'none' }, { transform: 'scale(2.6)', filter: 'blur(2px) brightness(1.4)' }], { duration: 460, easing: 'cubic-bezier(.5,0,.8,.4)', fill: 'forwards' }).finished.catch(() => {});
}

/* ---------- 잡기 화면: 3D 손맛 ---------- */
// 화면은 바닥이 멀어지는 원근(가까운 손 → 먼 펫). 공은 손가락이 민 세기 · 방향으로 포물선을 그리며 날아가 작아지고,
//   너무 약하면 펫 앞에 떨어져 굴러 돌아오고, 너무 세면 펫 위로 넘어간다(이때는 공을 쓰지 않는다).
// 공을 쥐고 손가락으로 원을 그리면 반짝이는 커브볼(옆으로 휘어 들어간다. 잡힐 확률은 그대로: 선생님 규칙).
// 펫은 숨 쉬다가 가끔 덤비거나(공격) 옆으로 폴짝 피한다(영웅은 더 자주). 그때 맞히면 튕겨 나간다(공을 쓰지 않는다). 🍌는 느리게.
// 📱 폰으로 던지기: 공을 한 번 누르고 폰을 앞으로 휙 털면 던진다(가속도계). 폰을 기울이면 배경 · 펫이 살짝 움직인다(자이로).
const ringColor = () => { const p = catchChance(H.meet.tier, { ball: H.ball, berry: H.berry }); return p >= 1 ? 'gold' : p >= .3 ? 'green' : p >= .15 ? 'yellow' : 'red'; };
const RING_HEX = { green: '#22c55e', yellow: '#f59e0b', red: '#ef4444', gold: '#facc15' };
function catchScreen(intro = false) {
  const m = H.meet, name = petName(m.key);
  const bg = has('bg-catch') ? '<img class="hn-catch-bg" src="/assets/hunt/bg-catch.webp" alt="" draggable="false">' : '<div class="hn-catch-bg code"><i class="hill h1"></i><i class="hill h2"></i><i class="grass"></i><i class="tuft t1">🌿</i><i class="tuft t2">🌼</i><i class="tuft t3">🌿</i></div>';
  $('hn-main').innerHTML = `<section class="hn-catch${intro ? ' intro' : ''}" id="hn-catch">
    <div class="hn-scene" id="hn-scene">${bg}<div class="hn-leaves" aria-hidden="true">${'<i></i>'.repeat(6)}</div></div>
    <div class="hn-petbox${isPet(m) ? ' pet' : ' mon'}" id="hn-petbox"><span class="hn-pet-shadow" id="hn-pshadow"></span><img class="hn-pet" id="hn-pet" src="${spriteOf(m)}" alt="${esc(name)}" draggable="false"></div>
    <svg class="hn-rings" id="hn-rings" viewBox="-100 -100 200 200" aria-hidden="true"><circle class="o" r="92"/><circle class="i" id="hn-ring-i" r="92"/></svg>
    <div class="hn-fx" id="hn-fx"></div>
    <button type="button" class="hn-run" data-hn="run" aria-label="도망가기">🏃<small>도망</small></button>
    <button type="button" class="hn-phone${H.phoneOn ? ' on' : ''}" data-hn="phone" aria-pressed="${!!H.phoneOn}" aria-label="폰으로 던지기">📱<small>${H.phoneOn ? '폰 던지기 켬' : '폰 던지기'}</small></button>
    <div class="hn-name t-${m.tier}"><span class="hn-tier t-${m.tier}${isPet(m) ? ' fresh' : ''}">${isPet(m) ? `✨ 아직 못 만난 ${TIER_NAMES[m.tier]}` : `<i>${tierStars(m.tier)}</i>${TIER_NAMES[m.tier]}`}</span><b>${esc(name)}</b></div>
    <p class="hn-say" id="hn-say" aria-live="polite"></p>
    <div class="hn-hud" id="hn-hud"></div>
    <div class="hn-flyer" id="hn-flyer" hidden></div>
  </section>`;
  const box = $('hn-catch');
  H.c = { t0: performance.now(), act: null, nextAct: performance.now() + 2600 + Math.random() * 2000, tilt: { x: 0, y: 0, tx: 0, ty: 0 }, flight: null, held: null };
  layoutCatch();
  catchHud();
  bindThrow(box);
  if (intro && !reduced()) { const pb = $('hn-petbox'); pb.classList.add('drop'); later(() => { pb.classList.remove('drop'); dust(H.c.petX, H.c.groundY, 8); sfx('step', { gain: .7 }); }, 560); }
  H.onResize = () => H?.c && layoutCatch();
  addEventListener('resize', H.onResize);
  startTilt();
  cancelAnimationFrame(H.raf);
  H.raf = requestAnimationFrame(tick);
}
// 장면 크기에 맞춰 펫 · 원 · 손 자리를 잡는다(390×844 기준, 작은 폰도).
function layoutCatch() {
  const box = $('hn-catch'); if (!box) return;
  const r = box.getBoundingClientRect(), c = H.c;
  c.W = r.width; c.H = r.height;
  c.size = Math.min(c.W * .6, c.H * .32, 250);
  c.petX = c.W / 2; c.groundY = c.H * .6; c.petY = c.groundY - c.size * .46;
  c.handX = c.W / 2; c.handY = c.H - Math.max(118, c.H * .14);
  const pb = $('hn-petbox'); if (pb) Object.assign(pb.style, { width: `${c.size}px`, height: `${c.size}px`, left: `${c.petX - c.size / 2}px`, top: `${c.groundY - c.size}px` });
  const rg = $('hn-rings'); if (rg) Object.assign(rg.style, { width: `${c.size * .96}px`, height: `${c.size * .96}px`, left: `${c.petX - c.size * .48}px`, top: `${c.petY - c.size * .48}px` });
}
function catchHud() {
  const v = H.v || {}, hud = $('hn-hud');
  if (!hud) return;
  if (!Number(v[H.ball] || 0)) H.ball = ['basic', 'good', 'gold'].find(k => k !== 'gold' && Number(v[k] || 0)) || (Number(v.gold || 0) ? H.ball : 'basic');
  const n = Number(v[H.ball] || 0), words = arcadeWords(H.A).ok;
  const hint = !n ? '이 공이 없어요' : H.phoneOn ? '공을 누르고 폰을 앞으로 휙!' : H.throws ? '' : '위로 쓱 밀어 던져요 · 빙글빙글 돌리면 커브볼!';
  hud.innerHTML = `<button type="button" class="hn-side berry${H.berry ? ' on' : ''}" data-hn="berry" ${H.berryTried && !H.berry ? 'disabled' : ''} aria-label="열매">${H.berry ? berryPic(H.berry) : art('berry-razz', '<i class="hn-emoji">🍓</i>')}<small>${H.berry ? `${BERRIES[H.berry].name} 사용 중` : H.berryTried ? '다음 공에' : words ? '열매' : '단어 필요'}</small></button>
    <div class="hn-ball-slot${n ? '' : ' none'}" id="hn-slot">
      <span class="hn-ball-hand" id="hn-hand" role="button" tabindex="0" aria-label="${BALL_NAMES[H.ball]} 위로 밀어 던지기"><span class="hn-hand-in" id="hn-hand-in">${ballPic(H.ball, 'big')}</span>${n ? `<em class="hn-ball-badge">×${num(n)}</em>` : ''}</span>
      <b class="hn-ball-n k-${H.ball}">${BALL_NAMES[H.ball]}</b>
      <small class="hn-hint">${hint}</small>
    </div>
    <button type="button" class="hn-side bag" data-hn="bag" aria-label="가방">${art('bag', '<i class="hn-emoji">🎒</i>')}<small>가방</small></button>`;
  const ring = $('hn-rings');
  if (ring) { ring.dataset.c = ringColor(); ring.style.setProperty('--rc', RING_HEX[ring.dataset.c]); }
}
// 원 크기(1 → 0.3 → 1, 바나나면 천천히).
function ringScale(t) {
  const period = H.berry === 'nanab' ? 2600 : 1700;
  const k = (t % period) / period;
  return .3 + .7 * (1 - Math.sin(k * Math.PI));
}
// 몬스터 자세 그림 바꾸기(공격 · 맞음). 펫은 자세 그림이 없어서 그대로.
function pose(name, ms) {
  const img = $('hn-pet'); if (!img || isPet(H.meet)) return;
  img.src = monSrc(H.meet.key, name);
  clearTimeout(H.poseT); H.poseT = later(() => { const i = $('hn-pet'); if (i && !i.classList.contains('lit')) i.src = monSrc(H.meet.key); }, ms);
}
function petSway(t) {
  const amp = ['epic', 'legend', 'petEpic'].includes(H.meet?.tier) ? 26 : 10, w = H.berry === 'nanab' ? .0011 : .0021;
  return amp * Math.sin(t * w);
}
// 펫 행동: 가끔 덤비기(attack) · 폴짝 피하기(dodge) · 콩 뛰기(hop). 덤비거나 피하는 동안에는 원이 사라지고 공이 튕겨 나간다.
function petAct(now) {
  const c = H.c, slow = H.berry === 'nanab' ? 1.9 : 1;
  if (c.act && now > c.act.end) { c.act = null; c.nextAct = now + (2400 + Math.random() * 2600) * slow; }
  if (!c.act && now > c.nextAct && H.phase === 'catch' && !c.flight) {
    const r = Math.random(), epic = ['epic', 'legend', 'pet', 'petEpic'].includes(H.meet?.tier);
    const kind = r < (epic ? .4 : .28) ? 'attack' : r < (epic ? .75 : .45) ? 'dodge' : 'hop';
    const dur = (kind === 'attack' ? 900 : kind === 'dodge' ? 760 : 520) * (slow > 1 ? 1.3 : 1);
    c.act = { kind, start: now, end: now + dur, dir: Math.random() < .5 ? -1 : 1 };
    if (kind === 'attack') { sfx(isPet(H.meet) ? 'swoosh' : 'hit', { rate: 1.3, gain: .5 }); later(() => buzz(30), dur * .45); pose('attack', dur); }
    if (kind === 'dodge') sfx('step', { gain: .5 });
  }
  if (!c.act) return { dx: 0, dy: 0, sc: 1, busy: false };
  const k = clamp((now - c.act.start) / (c.act.end - c.act.start), 0, 1), bell = Math.sin(k * Math.PI);
  if (c.act.kind === 'attack') return { dx: 0, dy: bell * 22, sc: 1 + bell * .16, busy: k > .15 && k < .9, attack: bell > .5 };
  if (c.act.kind === 'dodge') return { dx: c.act.dir * bell * c.size * .34, dy: -bell * 30, sc: 1, busy: k > .1 && k < .9 };
  return { dx: 0, dy: -bell * 26, sc: 1 + bell * .04, busy: false };
}
function tick(now) {
  if (!H || !H.c || H.phase === 'map') return;
  const c = H.c, t = now - c.t0;
  // 자이로 기울기(부드럽게 따라감).
  c.tilt.x += (c.tilt.tx - c.tilt.x) * .12; c.tilt.y += (c.tilt.ty - c.tilt.y) * .12;
  const scene = $('hn-scene');
  if (scene) scene.style.transform = `translate(${-c.tilt.x * 14}px, ${-c.tilt.y * 10}px) scale(1.06)`;
  if (['catch', 'intro', 'flying'].includes(H.phase)) {
    const a = petAct(now);
    c.rs = ringScale(t); c.sx = petSway(t) + a.dx + c.tilt.x * 6; c.busy = a.busy;
    c.dy = a.dy;
    const pb = $('hn-petbox'), rg = $('hn-rings'), ri = $('hn-ring-i'), sh = $('hn-pshadow');
    if (pb && !pb.classList.contains('drop')) pb.style.transform = `translate(${c.sx}px, ${a.dy + c.tilt.y * 4}px) scale(${a.sc})`;
    if (sh) sh.style.transform = `translateX(-50%) translateY(${-a.dy}px) scale(${1 - Math.max(0, -a.dy) / 90})`;
    if (rg) { rg.style.transform = `translate(${c.sx}px, ${a.dy + c.tilt.y * 4}px)`; rg.classList.toggle('hide', a.busy || H.phase === 'intro'); }
    if (ri) ri.setAttribute('r', String(92 * c.rs));
    $('hn-catch')?.classList.toggle('attack', !!a.attack);
  }
  if (c.flight) flightStep(now);
  H.raf = requestAnimationFrame(tick);
}

/* ---------- 던지기 ---------- */
function say(text, cls = '') { const s = $('hn-say'); if (!s) return; s.className = `hn-say show ${cls}`; s.innerHTML = text; clearTimeout(H.sayT); H.sayT = later(() => s.classList.remove('show'), 1600); }
function bindThrow(box) {
  let drag = null;
  box.addEventListener('pointerdown', e => {
    const hand = e.target.closest('#hn-hand');
    if (!hand || H.phase !== 'catch' || H.c.flight || !Number(H.v?.[H.ball] || 0)) return;
    e.preventDefault();
    if (H.phoneOn) { armPhone(); return; }
    hand.setPointerCapture?.(e.pointerId);
    const r = hand.getBoundingClientRect();
    drag = { id: e.pointerId, hand, cx: r.left + r.width / 2, cy: r.top + r.height / 2, sx: e.clientX, sy: e.clientY, pts: [{ x: e.clientX, y: e.clientY, t: e.timeStamp }], ang: null, spin: 0 };
    hand.classList.add('held'); buzz(8);
  });
  box.addEventListener('pointermove', e => {
    if (!drag || e.pointerId !== drag.id) return;
    drag.pts.push({ x: e.clientX, y: e.clientY, t: e.timeStamp }); if (drag.pts.length > 10) drag.pts.shift();
    const dx = e.clientX - drag.sx, dy = e.clientY - drag.sy;
    // 손가락으로 원 그리기 → 커브볼(한 바퀴 넘게 돌리면 반짝).
    const ang = Math.atan2(e.clientY - drag.cy, e.clientX - drag.cx), far = Math.hypot(e.clientX - drag.cx, e.clientY - drag.cy) > 14;
    if (far && drag.ang !== null) { let d = ang - drag.ang; if (d > Math.PI) d -= 2 * Math.PI; if (d < -Math.PI) d += 2 * Math.PI; drag.spin += d; }
    if (far) drag.ang = ang;
    const curve = Math.abs(drag.spin) > Math.PI * 2;
    if (curve && !drag.curve) { drag.curve = true; drag.hand.classList.add('curve'); sfx('combo', { gain: .5 }); buzz(12); }
    const inner = drag.hand.querySelector('.hn-hand-in');
    if (inner) inner.style.transform = `rotate(${drag.spin * 57}deg)`;
    drag.hand.style.transform = `translate(${dx}px, ${Math.min(40, dy)}px) scale(${1 + Math.min(.12, Math.max(0, -dy) / 600)})`;
  });
  const end = e => {
    if (!drag || e.pointerId !== drag.id) return;
    const d = drag; drag = null;
    d.hand.classList.remove('held');
    // 마지막 0.1초의 손가락 속도로 던진다.
    const last = d.pts[d.pts.length - 1], first = d.pts.find(p => last.t - p.t <= 110) || d.pts[0], dt = Math.max(16, last.t - first.t);
    const vy = (first.y - last.y) / dt, vx = (last.x - first.x) / dt, lift = d.sy - last.y;
    if (vy < .45 || lift < 30) {
      d.hand.style.transform = ''; d.hand.classList.remove('curve');
      const inner = d.hand.querySelector('.hn-hand-in'); if (inner) inner.style.transform = '';
      if (lift > 8) say('조금 더 세게 위로 밀어요!');
      return;
    }
    const r = d.hand.getBoundingClientRect();
    launch({ power: vy, side: vx, x: r.left + r.width / 2, y: r.top + r.height / 2, curve: d.curve ? Math.sign(d.spin) : 0 });
  };
  box.addEventListener('pointerup', end);
  box.addEventListener('pointercancel', e => { if (drag && e.pointerId === drag.id) { drag.hand.style.transform = ''; drag.hand.classList.remove('held', 'curve'); drag = null; } });
  // 키보드: Enter · 스페이스로 알맞은 세기로 가운데로 던지기.
  box.addEventListener('keydown', e => { if (e.target.id === 'hn-hand' && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); if (H.phase === 'catch' && !H.c.flight) { const r = e.target.getBoundingClientRect(); launch({ power: 2.2, side: 0, x: r.left + r.width / 2, y: r.top + r.height / 2, curve: 0 }); } } });
}
// 세기(px/ms) → 날아가는 거리(펫까지 1). 약 1.4~3.4이면 펫에 닿는다.
const reachOf = power => clamp(.62 + power * .27, .3, 2.4);
function launch({ power, side, x, y, curve }) {
  const c = H.c, box = $('hn-catch').getBoundingClientRect(), flyer = $('hn-flyer'), hand = $('hn-hand');
  if (!flyer || !hand || H.phase !== 'catch') return;
  H.phase = 'flying';
  const zEnd = reachOf(power), x0 = x - box.left, y0 = y - box.top;
  c.flight = { t0: performance.now(), T: 720 * Math.sqrt(zEnd), zEnd, x0, y0, xAt: x0 + side * 240, Hm: 210 * zEnd * zEnd, curve, rs: c.rs, done: false, crossed: false };
  hand.style.visibility = 'hidden'; hand.style.transform = ''; hand.classList.remove('curve');
  flyer.hidden = false;
  flyer.className = `hn-flyer${curve ? ' curve' : ''}`;
  flyer.innerHTML = `<span class="hn-fly-in">${art('ball-spin', ballPic(H.ball, 'big spin'), 'big')}</span>`;
  // 공 그림자: 바닥을 따라가며 공이 높을수록 작고 흐리게(원근감).
  $('hn-fx')?.insertAdjacentHTML('beforeend', '<i class="hn-bshadow" id="hn-bshadow"></i>');
  sfx('swoosh'); buzz(14);
  if (curve) say('<b class="q-curve">커브볼!</b>', 'quality');
}
// 원근: 깊이 z(손 0 → 펫 1)에서 크기.
const scaleAt = z => 1 / (1 + 1.1 * Math.max(0, z));
function flightStep(now) {
  const c = H.c, f = c.flight, el = $('hn-flyer');
  if (!f || f.done || !el) return;
  const k = clamp((now - f.t0) / f.T, 0, 1), z = f.zEnd * k;
  const x = f.x0 + (f.xAt - f.x0) * z + f.curve * 80 * Math.sin(Math.PI * k);
  const s = scaleAt(z), h = f.Hm * 4 * k * (1 - k);
  // 바닥 높이: 손(z 0)에서 펫 발(z 1)까지 멀어질수록 천천히, 펫 뒤로는 더 멀리.
  const gY = z <= 1 ? f.y0 + (c.groundY - f.y0) * (1 - Math.pow(1 - z, 1.6)) : c.groundY - (z - 1) * c.H * .25;
  const y = gY - h * s;
  const sh = $('hn-bshadow');
  if (sh) { const lift = f.Hm ? h / f.Hm : 0; sh.style.transform = `translate(${x}px, ${gY + 30 * s}px) translate(-50%, -50%) scale(${s * (1 - lift * .55)})`; sh.style.opacity = String(.55 - lift * .35); }
  el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%) scale(${s})`;
  el.querySelector('.hn-fly-in').style.transform = `rotate(${k * (f.curve ? 1400 : 900) * (f.curve || 1)}deg)`;
  if (f.curve && Math.random() < .6) sparkle(x, y, s);
  if (!f.crossed && z >= .92) {
    f.crossed = true;
    const px = c.petX + c.sx, top = c.groundY + c.dy - c.size * .88, bottom = c.groundY + c.dy - c.size * .04;
    const ballR = 28 * s, inX = Math.abs(x - px) < c.size * .32 + ballR, inY = y > top - ballR && y < bottom + ballR;
    if (inX && inY) {
      f.done = true;
      if (c.busy) return deflect(x, y, s, c.act?.kind);
      // 원 안에 들어갔나: 원 가운데(펫 몸 가운데)와의 거리 < 원 반지름.
      const ringR = c.size * .48 * .92 * f.rs, d = Math.hypot(x - px, y - (c.petY + c.dy));
      const rs = f.rs;
      const quality = d < ringR + ballR * .5 ? (rs < .45 ? 'excellent' : rs < .7 ? 'great' : rs < .95 ? 'nice' : null) : null;
      return hit(x, y, s, quality);
    }
    f.side = !inX;
  }
  if (k >= 1) { f.done = true; missed(x, y, s, f.zEnd < .92 ? 'short' : f.side ? 'side' : 'over'); }
}
function sparkle(x, y, s) {
  const fx = $('hn-fx'); if (!fx) return;
  const i = document.createElement('i'); i.className = 'hn-trail';
  i.style.cssText = `left:${x + (Math.random() - .5) * 30 * s}px;top:${y + (Math.random() - .5) * 30 * s}px`;
  fx.appendChild(i); setTimeout(() => i.remove(), 600);
}
function dust(x, y, n = 6) {
  const fx = $('hn-fx'); if (!fx || reduced()) return;
  for (let k = 0; k < n; k++) {
    const d = document.createElement('i'); d.className = 'hn-dust';
    d.style.cssText = `left:${x}px;top:${y}px;--dx:${(k / (n - 1) - .5) * 120}px;--dy:${-10 - Math.random() * 18}px;--s:${.6 + Math.random() * .7}`;
    fx.appendChild(d); setTimeout(() => d.remove(), 800);
  }
}
async function backToHand(msg) {
  $('hn-bshadow')?.remove();
  say(msg, 'miss');
  await wait(420);
  const flyer = $('hn-flyer'), hand = $('hn-hand');
  if (flyer) { flyer.hidden = true; flyer.getAnimations().forEach(a => a.cancel()); }
  if (hand) { hand.style.visibility = ''; hand.animate?.([{ transform: 'translateY(60px) scale(.6)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 300, easing: 'cubic-bezier(.3,1.5,.5,1)' }); }
  H.c.flight = null;
  H.phase = 'catch';
}
// 빗나감: 약하면 펫 앞에 떨어져 통통 튀고, 세면 펫 위로 넘어간다. 공은 손에 돌아온다(공을 안 쓴다).
async function missed(x, y, s, why) {
  const el = $('hn-flyer');
  if (why === 'short') {
    sfx('tap', { rate: .7 }); dust(x, y + 20 * s, 4);
    await el.animate([{ transform: `translate(${x}px, ${y}px) translate(-50%, -50%) scale(${s})` }, { transform: `translate(${x}px, ${y - 40 * s}px) translate(-50%, -50%) scale(${s})`, offset: .4 }, { transform: `translate(${x}px, ${y}px) translate(-50%, -50%) scale(${s})`, offset: .7 }, { transform: `translate(${x + 10}px, ${y - 10 * s}px) translate(-50%, -50%) scale(${s})` }], { duration: reduced() ? 1 : 520, fill: 'forwards' }).finished.catch(() => {});
    return backToHand('조금 약했어요! 더 세게 휙');
  }
  await el.animate([{ opacity: 1 }, { opacity: 0, transform: `translate(${x}px, ${y - 60}px) translate(-50%, -50%) scale(${s * .5})` }], { duration: reduced() ? 1 : 300, fill: 'forwards' }).finished.catch(() => {});
  backToHand(why === 'over' ? '너무 세게 던졌어요! 펫을 넘어갔어요' : '옆으로 빗나갔어요! 펫 쪽으로 곧게');
}
// 덤비는 중 · 피하는 중에 맞으면 튕겨 나간다(공을 안 쓴다).
async function deflect(x, y, s, kind) {
  const el = $('hn-flyer'), dir = x < H.c.petX ? -1 : 1;
  sfx(kind === 'attack' ? 'hit' : 'swoosh', { gain: .7 }); buzz([20, 30]);
  if (kind === 'attack') { const fx = $('hn-fx'); fx?.insertAdjacentHTML('beforeend', `<span class="hn-bonk" style="left:${x}px;top:${y}px"></span>`); later(() => fx?.querySelector('.hn-bonk')?.remove(), 500); }
  await el.animate([{ transform: `translate(${x}px, ${y}px) translate(-50%, -50%) scale(${s})` }, { transform: `translate(${x + dir * 160}px, ${y + 120}px) translate(-50%, -50%) scale(${s * 1.3}) rotate(${dir * 400}deg)`, opacity: 0 }], { duration: reduced() ? 1 : 520, easing: 'cubic-bezier(.2,.7,.4,1)', fill: 'forwards' }).finished.catch(() => {});
  backToHand(kind === 'attack' ? '앗, 펫이 공을 튕겨 냈어요! 덤빌 때는 피해서' : '폴짝 피했어요! 원이 보일 때 던져요');
}

/* ---------- 맞힘 → 빨려 들어감 → 흔들림 ---------- */
async function hit(x, y, s, quality) {
  const c = H.c, m = H.meet, fx = $('hn-fx'), el = $('hn-flyer'), pet = $('hn-pet'), pb = $('hn-petbox');
  H.phase = 'shaking';
  $('hn-bshadow')?.remove();
  const sway = c.sx;
  const id = throwId(), body = { id, spot: m.spot, ball: H.ball, quality, berry: H.berry, berry_ticket: H.berry ? H.berryTicket : null };
  const req = sendThrow(body);
  if (quality) { say(`<b class="q-${quality}">${THROW_NAMES[quality]}!</b>`, 'quality'); sfx(quality === 'excellent' ? 'crit' : 'combo', { rate: quality === 'excellent' ? 1 : quality === 'great' ? 1.15 : 1 }); }
  sfx('hit', { gain: .6 }); buzz(25);
  $('hn-rings')?.classList.add('hide', 'gone');
  // 1) 머리에 맞고 위로 통 튀어 멈춤
  const topY = c.petY - c.size * .55 + c.dy, bx = c.petX + sway;
  await el.animate([{ transform: `translate(${x}px, ${y}px) translate(-50%, -50%) scale(${s})` }, { transform: `translate(${bx}px, ${topY}px) translate(-50%, -50%) scale(.74)` }], { duration: reduced() ? 1 : 260, easing: 'cubic-bezier(.2,.8,.3,1)', fill: 'forwards' }).finished.catch(() => {});
  if (!H) return;
  // 2) 공이 열리고 펫이 빛이 되어 빨려 들어감
  el.querySelector('.hn-fly-in').style.transform = '';
  el.querySelector('.hn-fly-in').innerHTML = art('ball-open', ballPic(H.ball, 'big open'), 'big');
  fx.insertAdjacentHTML('beforeend', `<span class="hn-beam" style="left:${bx}px;top:${topY}px;height:${c.groundY - topY - c.size * .2}px"></span>`);
  pet.classList.add('lit'); sfx('pop', { rate: 1.3, gain: .6 }); buzz(18);
  pb.style.transition = 'transform .38s cubic-bezier(.6,0,.9,.4), opacity .38s';
  pb.style.transform = `translate(${sway}px, ${topY - c.groundY + c.size * .5}px) scale(.04)`; pb.style.opacity = '0';
  await wait(420);
  fx.querySelector('.hn-beam')?.remove();
  // 3) 공이 닫히고 바닥으로 툭, 통통
  el.querySelector('.hn-fly-in').innerHTML = ballPic(H.ball, 'big');
  const gy = c.groundY - 26;
  await el.animate([
    { transform: `translate(${bx}px, ${topY}px) translate(-50%, -50%) scale(.74)` },
    { transform: `translate(${bx}px, ${gy}px) translate(-50%, -50%) scale(.74)`, offset: .55, easing: 'ease-out' },
    { transform: `translate(${bx}px, ${gy - 26}px) translate(-50%, -50%) scale(.74)`, offset: .75, easing: 'ease-in' },
    { transform: `translate(${bx}px, ${gy}px) translate(-50%, -50%) scale(.74)` }
  ], { duration: reduced() ? 1 : 620, fill: 'forwards' }).finished.catch(() => {});
  if (!H) return;
  dust(bx, gy + 20, 7); sfx('step', { gain: .8 }); buzz(20);
  const res = await req;
  if (!H) return;
  if (!res) {
    say('연결이 끊겼어요. 지도에서 다시 확인할게요.', 'miss');
    await wait(1200);
    try { setView((await api('/hunt/home', {})).hunt); } catch {}
    return mapScreen();
  }
  setView(res.hunt);
  if (res.points_balance != null) H.A.data.stats.points_balance = res.points_balance;
  if (res.profile) H.A.data.profile = res.profile;
  if (res.stats) H.A.data.stats = res.stats;
  H.throws = (H.throws || 0) + 1;
  H.berry = null; H.berryTicket = null; H.berryTried = false;
  catchHud();
  $('hn-hand').style.visibility = 'hidden';
  // 4) 흔들림(서버가 정한 수). 흔들 때마다 단추가 빨갛게.
  const ball = document.createElement('div'); ball.className = 'hn-ground-ball';
  ball.style.cssText = `left:${bx}px;top:${gy}px`;
  ball.innerHTML = `<span class="hn-gb-in">${ballPic(res.ball, 'big')}</span><i class="hn-gb-glow"></i>`;
  fx.appendChild(ball); el.hidden = true; el.getAnimations().forEach(a => a.cancel());
  const shakes = res.caught ? 3 : res.shakes;
  await wait(380);
  for (let i = 0; i < shakes; i++) {
    ball.classList.remove('wob-l', 'wob-r'); void ball.offsetWidth;
    ball.classList.add(i % 2 ? 'wob-r' : 'wob-l');
    if (has('ball-tilt-l')) ball.querySelector('.hn-gb-in').innerHTML = art(i % 2 ? 'ball-tilt-r' : 'ball-tilt-l', '', 'big');
    sfx('wiggle', { rate: 1 + i * .12 }); buzz(i === 2 ? [15, 40, 15] : 12);
    await wait(i === 2 ? 1100 : 950);
    if (has('ball-tilt-l')) ball.querySelector('.hn-gb-in').innerHTML = ballPic(res.ball, 'big');
  }
  if (res.caught) return caught(res, ball, bx, gy);
  // 빠져나옴: 번쩍 + 펫이 튀어나옴
  ball.querySelector('.hn-gb-in').innerHTML = art('ball-open', ballPic(res.ball, 'big open'), 'big');
  fx.insertAdjacentHTML('beforeend', `<span class="hn-burst" style="left:${bx}px;top:${gy}px">${art('fx-burst', '<i></i><i></i><i></i><i></i><i></i><i></i>')}</span>`);
  sfx('burst'); buzz([30, 30, 30]);
  pb.style.transition = 'transform .42s cubic-bezier(.3,1.6,.5,1), opacity .2s'; pb.style.opacity = '1'; pb.style.transform = `translate(${sway}px, 0) scale(1)`;
  pet.classList.remove('lit'); pet.classList.add('angry'); pose('hurt', 1100);
  later(() => ball.remove(), 260);
  later(() => fx.querySelector('.hn-burst')?.remove(), 700);
  await wait(500);
  pb.style.transition = '';
  if (res.fled) {
    say('앗, 빠져나왔어요!', 'miss');
    await wait(700);
    fx.insertAdjacentHTML('beforeend', `<span class="hn-smoke" style="left:${bx}px;top:${c.groundY - c.size * .4}px">${art('fx-smoke', '<i></i><i></i><i></i><i></i><i></i>')}</span>`);
    pet.classList.add('fled'); sfx('fail'); clearTimeout(H.poseT);
    say(`${esc(petJosa(petName(m.key), '이', '가'))} 도망쳤어요…`, 'miss');
    await wait(1500);
    return result({ title: '도망쳤어요', key: m.key, tier: m.tier, fled: true });
  }
  say('앗, 빠져나왔어요! 한 번 더!', 'miss');
  await wait(600);
  pet.classList.remove('angry');
  $('hn-rings')?.classList.remove('hide', 'gone');
  H.c.flight = null; H.c.nextAct = performance.now() + 1500;
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
async function caught(res, ball, bx, gy) {
  const fx = $('hn-fx');
  ball.querySelector('.hn-gb-in').innerHTML = art('ball-lock', ballPic(res.ball, 'big'), 'big');
  ball.classList.add('locked');
  fx.insertAdjacentHTML('beforeend', `<span class="hn-sparkle" style="left:${bx}px;top:${gy}px">${art('fx-sparkle', '<i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i>')}</span><span class="hn-stars" style="left:${bx}px;top:${gy}px">${[0, 1, 2].map(i => `<i style="--i:${i}">${art('fx-star', '★')}</i>`).join('')}</span>`);
  sfx('stamp'); later(() => sfx('coins', { gain: .5 }), 300); buzz([40, 60, 80]);
  say('<b>잡았다!</b>', 'got');
  await wait(1500);
  if (res.new_pet) {
    // 펫: 알 상점과 같은 공개 연출(영웅은 영웅 연출).
    await huntPetShow(res.key, res.tier === 'petEpic' ? 'epic' : 'basic');
    return result({ title: '새 친구가 됐어요!', key: res.key, pet: true, tier: res.tier });
  }
  return result({ title: `${esc(petJosa(petName(res.key), '을', '를'))} 잡았어요!`, key: res.key, tier: res.tier, n: res.n || 1, stars: res.stars || 0, xp: res.xp || 0, isNew: !!res.fresh, double: res.berry === 'pinap' });
}
function result({ title, key, fled = false, pet = false, tier, n = 1, stars = 0, xp = 0, isNew = false, double = false }) {
  H.phase = 'result';
  const name = petName(key), m = H.meet || {};
  const lines = fled ? `<p>공 ${num(H.throws || 0)}개를 던졌어요. 지도에는 다른 몬스터가 기다려요!</p>`
    : pet ? `<p><b>${esc(petJosa(name, '이', '가'))}</b> 내 펫이 됐어요${tier === 'petEpic' ? ' (영웅)' : ''}. 함께 공부해 Lv.3이 되면 알에서 깨어나요.</p>`
    : `${isNew ? '<p class="hn-new">📖 도감에 새로 올랐어요!</p>' : ''}<div class="hn-rewards"><span>🎒<b>+<i data-count="${n}">0</i></b><small>가방</small></span><span>${STAR}<b><i data-count="${stars}">0</i></b><small>팔면 별조각</small></span><span><b>+<i data-count="${xp}">0</i></b><small>파트너 경험치</small></span></div>${double ? '<p class="hn-double">🍍 파인애플 덕분에 2마리!</p>' : ''}`;
  const pic = pet ? petSrc(key, 0) : isPet(m) ? petSrc(key, m.form || 1) : monSrc(key, fled ? 'hurt' : '');
  layer(`<div class="hn-result${fled ? ' fled' : ' got'}" role="dialog" aria-modal="true" aria-label="${fled ? '도망' : '잡음'}">
    <div class="hn-result-card">
      ${fled ? '' : '<i class="hn-rays" aria-hidden="true"></i>'}
      <div class="hn-res-ribbon t-${tier || m.tier}">${fled ? '도망' : pet ? `✨ ${TIER_NAMES[tier]}` : tierLabel(tier || m.tier)}</div>
      <div class="hn-result-pet t-${tier || m.tier}"><img src="${pic}" alt="" draggable="false"${fled ? ' class="gone"' : ''}>${fled ? art('fx-smoke', '<span class="hn-res-smoke">💨</span>') : art('fx-sparkle', '<span class="hn-res-spark">✨</span>')}</div>
      <h2>${title}</h2>
      ${lines}
      <button type="button" class="yl-cta" data-hn="to-map">지도로 돌아가기</button>
    </div>
  </div>`);
  document.querySelectorAll('.hn-rewards [data-count]').forEach((el, i) => later(() => countUp(el, Number(el.dataset.count), 800), 250 + i * 200));
  if (stars && !reduced()) { const card = document.querySelector('.hn-result-card'); if (card && ['rare', 'epic', 'legend'].includes(tier)) coinShower(card, 16); sfx('coins', { gain: .6 }); }
  H.throws = 0;
}
async function runAway() {
  if (H.phase !== 'catch' && H.phase !== 'intro') return;
  sfx('swoosh', { rate: 1.3 });
  say('안전하게 도망쳤어요');
  await wait(260);
  mapScreen();
}
function stopCatch() {
  cancelAnimationFrame(H.raf);
  if (H.onResize) removeEventListener('resize', H.onResize);
  H.onResize = null;
  H.c = null; H.armed = false;
}

/* ---------- 📱 폰으로 던지기 · 기울이면 움직이는 배경 ---------- */
// 공을 한 번 누르면(준비) 4초 안에 폰을 앞으로 휙 털어서 던진다. 털어 낸 세기가 던지는 세기, 옆으로 턴 만큼 옆으로.
// 아이폰은 처음 켤 때 '동작과 방향' 허락을 묻는다. 폰은 꼭 쥐고 손목만 살짝(놓치지 않게 안내).
async function togglePhone() {
  if (H.phoneOn) { H.phoneOn = false; stopMotion(); catchScreenHudOnly(); return; }
  if (typeof DeviceMotionEvent === 'undefined') return say('이 기기는 폰 던지기를 못 써요', 'miss');
  try {
    if (typeof DeviceMotionEvent.requestPermission === 'function' && (await DeviceMotionEvent.requestPermission()) !== 'granted') return say('동작 허락이 필요해요', 'miss');
    if (typeof DeviceOrientationEvent?.requestPermission === 'function') await DeviceOrientationEvent.requestPermission().catch(() => {});
  } catch { return say('동작 허락이 필요해요', 'miss'); }
  H.phoneOn = true;
  startMotion(); startTilt(true);
  catchScreenHudOnly();
  layer(`<div class="hn-sheet" role="dialog" aria-modal="true" aria-label="폰으로 던지기"><div class="hn-sheet-box hn-confirm"><span class="hn-phone-demo" aria-hidden="true">📱</span><h3>폰으로 던지기</h3>
    <p>공을 한 번 누르고, <b>폰을 앞으로 휙</b> 털면 던져요.<br>세게 털수록 멀리, 옆으로 털면 옆으로 가요.<br><b>폰을 두 손으로 꼭 쥐고 손목만 살짝!</b> 놓치지 않게 조심해요.</p>
    <button type="button" class="yl-cta" data-hn="close-layer">알겠어요</button></div></div>`);
}
function catchScreenHudOnly() {
  const btn = document.querySelector('[data-hn="phone"]');
  if (btn) { btn.classList.toggle('on', !!H.phoneOn); btn.setAttribute('aria-pressed', String(!!H.phoneOn)); btn.querySelector('small').textContent = H.phoneOn ? '폰 던지기 켬' : '폰 던지기'; }
  catchHud();
}
function armPhone() {
  if (H.phase !== 'catch') return;
  H.armed = performance.now();
  $('hn-hand')?.classList.add('armed');
  say('지금 폰을 앞으로 휙!', 'good'); buzz(20);
  later(() => { if (H.armed && performance.now() - H.armed >= 3900) { H.armed = false; $('hn-hand')?.classList.remove('armed'); } }, 4000);
}
let motionOn = false, tiltOn = false;
function onMotion(e) {
  if (!H || !H.phoneOn || !H.armed || H.phase !== 'catch' || !H.c) return;
  const a = e.acceleration?.x != null ? e.acceleration : null, r = e.rotationRate || {};
  const mag = a ? Math.hypot(a.x || 0, a.y || 0, a.z || 0) : Math.hypot(r.alpha || 0, r.beta || 0, r.gamma || 0) / 28;
  if (mag < 13) return;
  H.armed = false;
  $('hn-hand')?.classList.remove('armed');
  const hand = $('hn-hand').getBoundingClientRect();
  // 세기 13~40 → 펫까지 알맞은 거리(조금 도와준다). 아주 세면 넘어간다.
  const power = clamp(1.5 + (mag - 13) / 27 * 1.4, 1.3, 3.4);
  const side = clamp(-(a?.x || 0) / 30 + (r.gamma || 0) / 900, -.5, .5);
  launch({ power, side, x: hand.left + hand.width / 2, y: hand.top + hand.height / 2, curve: 0 });
}
function onTilt(e) {
  if (!H?.c || e.gamma == null) return;
  H.c.tilt.tx = clamp(e.gamma / 25, -1, 1);
  H.c.tilt.ty = clamp(((e.beta || 45) - 45) / 30, -1, 1);
}
function startMotion() { if (!motionOn) { addEventListener('devicemotion', onMotion); motionOn = true; } }
function stopMotion() { if (motionOn) { removeEventListener('devicemotion', onMotion); motionOn = false; } }
// 안드로이드는 허락 없이 기울기를 준다. 아이폰은 폰 던지기를 켜며 허락받은 뒤부터.
function startTilt(force = false) {
  if (tiltOn || typeof DeviceOrientationEvent === 'undefined') return;
  if (!force && typeof DeviceOrientationEvent.requestPermission === 'function') return;
  addEventListener('deviceorientation', onTilt); tiltOn = true;
}
function stopTilt() { if (tiltOn) { removeEventListener('deviceorientation', onTilt); tiltOn = false; } }

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
      <p>황금 공은 <b>무조건 잡혀요.</b> 한 달에 하나만 받는 귀한 공이에요.${isPet(H.meet) ? '<br>아직 못 만난 <b>펫</b>이에요!' : `<br>이 몬스터는 <b>${tierLabel(H.meet?.tier) || ''}</b> 등급이에요.`}</p>
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
// V13.167 문제는 서버가 내고(정답은 안 옴) 서버가 채점한다. 맞히면 받은 열매 표(ticket)를 던질 때 보낸다.
async function quiz(berry) {
  if (H.quizBusy || !H.meet) return;
  H.quizBusy = true;
  let q = null;
  try { q = await api('/hunt/berry', { spot: H.meet.spot, berry, range_codes: arcadeWords(H.A).picked }); }
  catch (err) { toast(err.message); if (err.status === 409) { H.berryTried = true; closeLayer(); catchHud(); } }
  finally { H.quizBusy = false; }
  if (!q || H.phase !== 'catch') return q || closeLayer();
  H.quiz = { id: q.id, berry: q.berry || berry, en: q.en };
  layer(`<div class="hn-sheet" role="dialog" aria-modal="true" aria-label="열매 문제"><div class="hn-sheet-box hn-quiz">${berryPic(H.quiz.berry)}<small>뜻을 골라요</small><h3 class="hn-q-word">${esc(q.en)}</h3>
    <div class="hn-choices">${q.choices.map(c => `<button type="button" class="hn-choice" data-hn="answer" data-ko="${esc(c)}">${esc(c)}</button>`).join('')}</div></div></div>`);
}
async function answer(b) {
  const q = H.quiz; if (!q) return;
  H.quiz = null;
  document.querySelectorAll('.hn-choice').forEach(x => { x.disabled = true; });
  let res = null;
  for (let i = 0; i < 2 && !res; i++) {
    try { res = await api('/hunt/berry/answer', { id: q.id, choice: b.dataset.ko }); }
    catch (err) { if (err.status && err.status < 500) { toast(err.message); break; } await new Promise(r => setTimeout(r, 400)); }
  }
  if (!res) { H.berryTried = true; return later(() => { closeLayer(); catchHud(); }, 300); }
  const ok = !!res.ok;
  document.querySelectorAll('.hn-choice').forEach(x => { if (x.dataset.ko === res.answer) x.classList.add('right'); });
  if (!ok) b.classList.add('wrong');
  sfx(ok ? 'correct' : 'wrong'); buzz(ok ? 15 : [20, 40, 20]);
  H.berryTried = true;
  if (ok) { H.berry = q.berry; H.berryTicket = res.ticket; }
  later(() => { closeLayer(); catchHud(); say(ok ? `${BERRIES[q.berry].emoji} ${BERRIES[q.berry].name} 열매를 줬어요! ${BERRIES[q.berry].note}` : `아쉬워요! <b>${esc(q.en)}</b> = ${esc(res.answer)}`, ok ? 'good' : 'miss'); }, 700);
}

/* ---------- 몬스터 가방 · 도감 · 교환소 ---------- */
// 잡은 몬스터는 가방에 모였다가 팔면 별조각(등급마다 값). 별조각은 교환소에서 코인(하루 한도) · 랜덤 알 · 영웅 알로.
const tierRank = k => MONSTER_TIERS.indexOf(HUNT_MONSTERS[k]?.tier);
function sheetBox(title, body, cls = '') {
  return `<div class="hn-sheet" role="dialog" aria-modal="true" aria-label="${esc(title)}"><div class="hn-sheet-box ${cls}"><h3>${title}</h3>${body}<button type="button" class="btn full" data-hn="close-layer">닫기</button></div></div>`;
}
function monsterBag() {
  const v = H.v || {}, bag = v.bag || {};
  const keys = Object.keys(bag).sort((a, b) => tierRank(b) - tierRank(a) || a.localeCompare(b));
  const body = keys.length ? `<p class="hn-sheet-note">가방 몬스터 ${num(keys.reduce((n, k) => n + bag[k], 0))}마리 · 모두 팔면 ${STAR}<b>${num(v.bag_stars || 0)}</b></p>
    <div class="hn-monlist">${keys.map(k => { const m = HUNT_MONSTERS[k]; return `<div class="hn-monrow t-${m.tier}"><img src="${monSrc(k)}" alt="" loading="lazy"><span><b>${esc(m.ko)}</b><small class="t-${m.tier}">${tierLabel(m.tier)} · ${STAR}${num(HUNT.STARS[m.tier])}</small></span><em>×${num(bag[k])}</em><button type="button" class="btn small" data-hn="sell" data-key="${k}">팔기</button></div>`; }).join('')}</div>
    <button type="button" class="yl-cta hn-sellall" data-hn="sell">모두 팔기 · ${STAR}${num(v.bag_stars || 0)}</button>`
    : '<p class="hn-empty">아직 잡은 몬스터가 없어요. 지도에서 몬스터를 잡아 보세요!</p>';
  layer(sheetBox('🎒 몬스터 가방', body, 'hn-bagsheet'));
}
async function sell(key, b) {
  if (b) b.disabled = true;
  try {
    const res = await api('/hunt/sell', key ? { key } : {});
    setView(res.hunt); sfx('coins'); buzz(15);
    toast(`${num(res.sold)}마리를 팔아 별조각 ${num(res.stars)}개를 받았어요!`);
    monsterBag(); if (H.phase === 'map') redrawDock();
  } catch (err) { toast(err.message); if (b) b.disabled = false; }
}
function monsterBook() {
  const v = H.v || {}, book = v.book || {};
  const body = `<p class="hn-sheet-note">잡은 몬스터 ${num(v.kinds || 0)} / ${num(v.all || MONSTER_KEYS.length)}종. 아직 못 잡은 몬스터는 그림자로 보여요.</p>
    ${MONSTER_TIERS.map(t => `<h4 class="hn-book-tier t-${t}">${tierLabel(t)}</h4><div class="hn-book">${MONSTER_KEYS.filter(k => HUNT_MONSTERS[k].tier === t).map(k => book[k]?.n
      ? `<div class="hn-book-cell on t-${t}"><img src="${monSrc(k)}" alt="" loading="lazy"><b>${esc(HUNT_MONSTERS[k].ko)}</b><small>${num(book[k].n)}마리</small></div>`
      : `<div class="hn-book-cell t-${t}"><img class="shadow" src="${monSrc(k)}" alt="" loading="lazy"><b>???</b><small>&nbsp;</small></div>`).join('')}</div>`).join('')}`;
  layer(sheetBox('📖 몬스터 도감', body, 'hn-booksheet'));
}
function shop() {
  const v = H.v || {}, stars = Number(v.stars || 0), left = Number(v.coin_left ?? HUNT.COIN_DAILY);
  const coinBtn = n => `<button type="button" class="hn-shop-coin" data-hn="coins" data-n="${n}" ${stars >= n && left >= n ? '' : 'disabled'}>${coin()}<b>${num(n)}</b><small>${STAR}${num(n)}</small></button>`;
  const egg = (item, name, price, ok) => `<div class="hn-shop-egg ${item}"><span class="hn-shop-egg-art">${item === 'epic_egg' ? '★' : '?'}</span><b>${name}</b><small>${STAR}${num(price)} · 하루 1개</small>
    <button type="button" class="yl-cta" data-hn="egg" data-item="${item}" ${ok && stars >= price ? '' : 'disabled'}>${!ok ? '내일 또' : stars >= price ? '바꾸기' : `${num(price - stars)}개 부족`}</button></div>`;
  const body = `<div class="hn-shop-top">${STAR}<b>${num(stars)}</b><small>별조각</small>${v.bag_stars ? `<button type="button" class="btn small" data-hn="bagmon">가방 몬스터 팔기 (${STAR}${num(v.bag_stars)})</button>` : ''}</div>
    <h4>코인으로 바꾸기 <small>오늘 ${num(left)}코인 남음 (1:1, 하루 ${num(HUNT.COIN_DAILY)})</small></h4>
    <div class="hn-shop-coins">${[10, 30, HUNT.COIN_DAILY].map(coinBtn).join('')}</div>
    <h4>알로 바꾸기 <small>아직 못 만난 펫의 알이 나와요</small></h4>
    <div class="hn-shop-eggs">${egg('egg', '랜덤 알', HUNT.EGG, v.egg_left !== 0)}${egg('epic_egg', '영웅 알', HUNT.EPIC_EGG, v.epic_left !== 0)}</div>`;
  layer(sheetBox(`${STAR} 별조각 교환소`, body, 'hn-shopsheet'));
}
async function exchangeCoins(n, b) {
  if (b) b.disabled = true;
  try {
    const res = await api('/hunt/exchange', { item: 'coins', amount: n });
    setView(res.hunt);
    if (typeof res.points_balance === 'number') H.A.data.stats.points_balance = res.points_balance;
    sfx('coins'); toast(`${num(res.coins)}코인으로 바꿨어요!`);
    shop(); if (H.phase === 'map') redrawDock();
  } catch (err) { toast(err.message); if (b) b.disabled = false; }
}
async function exchangeEgg(item, b) {
  if (b) b.disabled = true;
  closeLayer();
  try {
    const res = await buyEgg(H.A, null, item === 'epic_egg' ? 'epic' : 'basic', { path: '/hunt/exchange', body: { item } });
    if (res?.hunt) setView(res.hunt);
    if (res?.profile) H.A.data.profile = res.profile;
    if (res?.stats) H.A.data.stats = res.stats;
    if (H.phase === 'map') redrawDock();
  } catch (err) { toast(err.message); }
}
function redrawDock() { if (H.phase === 'map') mapScreen(); }

/* ---------- 안내 ---------- */
function guide(first) {
  layer(`<div class="hn-sheet" role="dialog" aria-modal="true" aria-label="몬스터 사냥 안내"><div class="hn-sheet-box hn-guide"><h3>몬스터 사냥 안내</h3>
    <ol>
      <li><b>지도</b>에서 돌아다니는 몬스터를 눌러 만나요. ★ 꼬마 · ★★ 보통 · ★★★ 희귀 · ★★★★ 대장 · ★★★★★ 보스, 별이 많을수록 잘 도망치고 비싸요. 가끔 <b>반짝이는 ?</b>는 아직 못 만난 <b>펫</b>(잘 도망쳐요!)이에요.</li>
      <li>공을 <b>위로 휙 밀어</b> 던져요. 약하면 앞에 떨어지고 세면 넘어가요. 줄어드는 원이 <b>작을 때</b> 원 안에 맞히면 나이스 · 그레이트 · 엑설런트로 더 잘 잡혀요. 공을 빙글빙글 돌리면 커브볼!</li>
      <li>몬스터가 <b>덤비거나 폴짝 피할 때</b>(원이 사라질 때)는 공이 튕겨 나가요. 원이 다시 보일 때 던져요.</li>
      <li><b>📱 폰 던지기</b>를 켜면 공을 누르고 폰을 앞으로 휙 털어서 던져요(폰은 두 손으로 꼭!).</li>
      <li><b>열매</b>: 단어 문제를 맞히면 🍓 잡기 ×1.5 · 🍍 몬스터 2마리 · 🍌 원과 몬스터가 천천히.</li>
      <li>잡은 몬스터는 <b>가방</b>에 모이고 <b>도감</b>에 올라요. 팔면 <b>별조각</b>, 교환소에서 코인 · 랜덤 알 · 영웅 알로 바꿔요. 잡을 때마다 파트너 펫이 경험치를 받아요.</li>
      <li><b>공은 공부로만</b>: 연습 끝내기(10문제 이상) · 출석 · 짝 맞추기 별 3, 곳마다 하루 1개. 만점 · 별 3이면 가끔 좋은 공, 출석 도장판 ${HUNT.GOLD_CARDS}장이면 황금 공!</li>
    </ol>
    <button type="button" class="yl-cta" data-hn="close-layer">${first ? '사냥 시작!' : '알겠어요'}</button></div></div>`);
  if (first) api('/hunt/guide', {}).then(res => setView(res.hunt)).catch(() => {});
}
