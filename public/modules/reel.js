import { api, esc, num, icon, toast, buttonBusy } from './ui.js';
import { avatar } from './character.js';
import { coin } from './emblems.js';
import { playSound, unlockSound, soundOn, preloadSound, loopSound } from './sound.js';
import { coinShower } from './celebrate.js';
import { buyEgg } from './pet-moments.js';
import { FISH, FISH_KEYS, RARITY, kgText } from './fishing-rules.js';
import { REEL, SEA_PETS, FIGHT, ROD, DEEP, stars, pearlsOf, rodLevel, rodOf, rodPerks, deepReady } from './reel-rules.js';
import { fishPic, fishShadow } from './fishing-art.js';

// V13.150 손맛 낚시(놀이터), 1인칭 판. 단어 없이 던지기 · 입질 · 파이팅 · 마무리 점프. 미끼는 공부로 번다(server/reel.mjs).
//   던지기: 릴 버튼을 꾹 눌러 반원 게이지의 금색 칸에서 떼기 → 낚싯대가 뒤로 젖혀졌다가 휙.
//   입질: 찌가 톡톡(가짜) 하다가 쑥 들어가면 탭(챔질). 일찍 두 번 누르면 놓친다.
//   파이팅: 꾹 누르면 감기(거리 ↓, 텐션 ↑), 떼면 풀기. 물고기 성격(등급마다 FIGHT.moves):
//     돌진 run → 반대쪽으로 스와이프(누른 채 끌어도 된다), 날뜀 thrash → 손 떼기, 잠수 dive → 꾹 버티기.
//     텐션이 빨간 칸 끝에 오래 있으면 줄이 끊기고, 오래 느슨하면 빠져나간다. 펫 특기 구슬이 차면 위로 쓸어 올려 한 번에 끌어온다.
//   마무리: 거리가 0이 되면 물고기가 뛰어오른다(슬로모션). 고리가 맞을 때 탭하면 퍼펙트(무게 +8%, 서버가 곱한다).
// 낚싯대는 코드로 그린다(휘는 정도 · 방향이 매 프레임 바뀐다). 그림(주문서 26 · 27 · 29)은 FISHING_ART에 이름이 있으면 쓴다.
// V13.150 그림 29(1인칭 배경 · 수조 · 공개 · 효과 · 아이콘)가 들어왔다. 1인칭 낚싯대 그림(pov-rod*)은 휘는 코드 낚싯대가 손맛에 더 좋아 쓰지 않는다.
// V13.185 낚싯대가 단계마다 똑같아 보여서(선생님 피드백), 단계마다 모양이 다른 낚싯대를 그린다(ROD_LOOK). V13.186 그림을 늘여 붙였더니
//   폰에서 4배로 커져 흐릿해서, 낚싯대 몸통은 다시 코드(벡터, 늘 선명)로 그리고 단계별 그림의 모양(마디 · 고리 · 손잡이 끝 · 빛)을 따라 그린다.
export const FISHING_ART = new Set([
  'bait-can', 'bait-open', 'bg-entry', 'bg-pov', 'bg-reveal', 'bg-sea', 'bg-tank', 'bg-under', 'bobber', 'bobber-bite',
  'bobber-nibble', 'bobber-sink', 'btn-cast', 'btn-left', 'btn-reel', 'btn-right', 'btn-special', 'fx-bubbles', 'fx-drops', 'fx-halo',
  'fx-impact', 'fx-jump', 'fx-perfect', 'fx-rays', 'fx-ripple', 'fx-speed', 'fx-splash', 'fx-star', 'fx-strike', 'gauge-cast',
  'gauge-distance', 'hint-hand', 'hook', 'icon-book', 'icon-net', 'icon-shop', 'line-snap', 'lure-gold', 'lure-shrimp', 'lure-spinner',
  'lure-worm', 'net', 'pearl', 'pearl-burst', 'pearl-clam', 'pearl-pile', 'pearl-trail', 'pov-crank', 'pov-reel', 'pov-reel-gold',
  'pov-reel-hot', 'pov-rod', 'pov-rod-deep', 'pov-rod-left', 'pov-rod-right', 'power', 'reel', 'ribbon-record', 'rod', 'rod-bend1',
  'rod-bend2', 'shop', 'skill-empty', 'skill-full', 'stamp-new', 'tank-chest', 'tank-coral', 'tank-rock', 'tank-weed', 'tension',
  // V13.154 그림 31(낚싯대 강화): 단계별 낚싯대 · 릴(강화 창에서 크게), 아이콘 1~5, 강화 연출, 작업대 배경.
  ...[2, 3, 4, 5].flatMap(t => [`pov-rod-t${t}`, `pov-rod-left-t${t}`, `pov-rod-right-t${t}`, `pov-rod-deep-t${t}`, `pov-reel-t${t}`]),
  ...[1, 2, 3, 4, 5].map(t => `icon-rod-${t}`), 'fx-upgrade', 'fx-hammer', 'stamp-tier', 'bg-forge',
  ...FISH_KEYS.map(k => `hang-${k}`)
]);
const has = name => FISHING_ART.has(name);
const art = (name, fallback, cls = '') => has(name) ? `<img class="rl-art rl-art-${name} ${cls}" src="/assets/fishing/${name}.webp" alt="" draggable="false">` : fallback;
const pearlIco = () => art('pearl', '<i class="rl-pearl-ico"></i>');

let R = null;
const root = () => document.getElementById('app');
// V13.158 놀이터(arcade.js)가 FISHING_ART를 부르므로 불러올 때 브라우저 기능을 쓰지 않는다(서버 검사도 이 파일을 부른다).
let REDUCED = null;
const reduced = () => (REDUCED ||= matchMedia('(prefers-reduced-motion: reduce)')).matches;
const sfx = (key, opts) => { if (soundOn()) playSound(key, opts); };
const buzz = p => { try { if (soundOn()) navigator.vibrate?.(p); } catch {} };
// V13.164 낚시 전용 소리(docs/sound/reel-synth.mjs). 들어올 때 미리 받는다.
const REEL_SFX = ['reel-cast', 'reel-plop', 'reel-nibble', 'reel-bite', 'reel-hook', 'reel-click', 'reel-strain', 'reel-creak', 'reel-snap', 'reel-run', 'reel-jump', 'reel-splash', 'reel-sparkle'];
// V13.164 손맛 진동(안드로이드): 진동 세기는 정할 수 없어서 켜는 길이 · 간격으로 세기를 낸다.
//   입질은 짧게 톡, 챔질은 길고 묵직하게, 돌진 · 잠수는 길게 드르륵, 파이팅 중에는 텐션만큼 길고 잦게(tensionFeel).
// 아이폰(사파리)은 진동이 없다(navigator.vibrate 없음): 같은 순간 화면을 흔들고(KICK px), 텐션이 높으면 화면이 떨리고,
//   손맛 소리(릴 딸깍 · 입질 · 줄 텐션)를 조금 크게 내서 대신한다.
// 진동은 소리 설정을 따른다(소리를 끄면 진동도 꺼진다). 화면 흔들림은 보이는 연출이라 '동작 줄이기'만 따른다.
const canBuzz = () => typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
const HAPTIC = {
  tick: [8], cast: [18], plop: [12], nibble: [9, 75, 6], early: [30], bite: [18, 40, 34],
  hook: [150, 40, 70], hookFast: [190, 30, 90], run: [260, 30, 200, 30, 160, 30, 120], dive: [420, 60, 260],
  thrash: [30, 25, 45, 25, 30, 25, 45], rhythm: [20, 60, 20], tap: [10], tap2: [18], ok: [20, 30, 60], bad: [50, 30, 50],
  ready: [30], skill: [30, 30, 140], snap: [25, 30, 220, 60, 50], slack: [60, 50, 30], jump: [70, 40, 40],
  perfect: [20, 20, 120], good: [60], caught: [30, 30, 60], big: [40, 40, 40, 40, 160]
};
const KICK = { cast: 2, plop: 1.5, nibble: 1.5, early: 2, bite: 4, hook: 9, hookFast: 11, run: 6, dive: 7, thrash: 5, bad: 4, ok: 3, skill: 8, snap: 12, slack: 3, jump: 6, perfect: 6, good: 4, big: 6 };
const LONG = { run: 900, dive: 800, thrash: 650 };
const FEEL = () => canBuzz() ? 1 : 1.2;
let hapticUntil = 0;
function feel(kind) {
  const p = HAPTIC[kind];
  if (!p || !R) return;
  if (canBuzz()) {
    if (!soundOn()) return;
    try { navigator.vibrate(p); hapticUntil = performance.now() + p.reduce((a, b) => a + b, 0); } catch {}
  } else if (KICK[kind]) R.kick = { px: KICK[kind], ms: LONG[kind] || 280, until: performance.now() + (LONG[kind] || 280) };
}
// 파이팅 진동(안드로이드): 감는 동안 · 빨간 칸에서 텐션만큼 길고 잦게. 빨간 칸은 거의 쉬지 않고 드르르.
function tensionFeel(t, f, zone) {
  if (!canBuzz() || !soundOn() || performance.now() < hapticUntil || (!f.holding && zone !== 'red')) return;
  const k = f.tension / 100, every = zone === 'red' ? 110 : lerp(300, 130, k);
  if (t - f.buzzAt < every) return;
  f.buzzAt = t;
  try { navigator.vibrate(zone === 'red' ? 95 : Math.round(lerp(4, 38, k ** 1.6))); } catch {}
}
// 화면 흔들림(아이폰 진동 대신): 한 번 흔들림(R.kick)은 점점 잦아들고, 텐션이 55를 넘으면 텐션만큼 떨린다.
function quake(t) {
  const w = $('rl-world');
  if (!w) return;
  let a = 0;
  if (R.kick && t < R.kick.until) a += R.kick.px * ((R.kick.until - t) / R.kick.ms) ** 1.5;
  if (R.phase === 'fight' && R.f && !canBuzz()) a += Math.max(0, R.f.tension - 55) / 45 * 2.4;
  if (reduced()) a = 0;
  if (a < .1) { if (R.quaking) { w.style.translate = ''; R.quaking = false; } return; }
  R.quaking = true;
  w.style.translate = `${((Math.random() * 2 - 1) * a).toFixed(1)}px ${((Math.random() * 2 - 1) * a).toFixed(1)}px`;
}
const stopStrain = () => { R?.strain?.stop(); if (R) R.strain = null; };
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
  // 길게 눌러도 사진 저장 · 복사 메뉴가 뜨지 않게(아이폰 · 안드로이드).
  root().querySelector('.rl-app').addEventListener('contextmenu', e => e.preventDefault());
  lockZoom(root().querySelector('.rl-app'));
  window.scrollTo(0, 0);
  preloadSound(['fanfare-basic', 'fanfare-epic', 'fanfare-legend', 'coins', 'fail', 'stamp', ...REEL_SFX]);
  scene();
  chips();
  dock();
  R.raf = requestAnimationFrame(frame);
  R.onResize = () => R && sizeRig();
  addEventListener('resize', R.onResize);
  if (R.v && !R.v.guide) later(() => guide(true), 400);
}
// V13.150.1 빠르게 연타하면 아이폰이 '두 번 탭 = 확대'로 알아듣고 화면을 키웠다(손으로도 안 돌아옴: 낚시 화면은 손가락 확대를 막아 두어서).
// 낚시터에 있는 동안은 확대를 막고(viewport maximum-scale=1 · 두 번 탭 · 두 손가락), 이미 확대돼 있으면 원래 크기로 되돌린다.
let viewportBefore = null;
function lockZoom(app) {
  const meta = document.querySelector('meta[name="viewport"]');
  if (meta && viewportBefore === null) { viewportBefore = meta.content; meta.content = `${viewportBefore.replace(/,\s*(maximum-scale|user-scalable)=[^,]*/g, '')},maximum-scale=1,user-scalable=no`; }
  let lastEnd = 0;
  app.addEventListener('touchend', e => { const now = e.timeStamp || Date.now(); if (now - lastEnd < 350 && e.cancelable) e.preventDefault(); lastEnd = now; }, { passive: false });
  app.addEventListener('dblclick', e => e.preventDefault());
  for (const g of ['gesturestart', 'gesturechange']) app.addEventListener(g, e => e.preventDefault(), { passive: false });
  const vv = window.visualViewport;
  if (vv && R) {
    R.onZoom = () => { if (vv.scale > 1.01) resetZoom(); };
    vv.addEventListener('resize', R.onZoom);
    R.onZoom();
  }
}
function resetZoom() {
  const meta = document.querySelector('meta[name="viewport"]');
  if (!meta) return;
  const c = meta.content;
  meta.content = `${c.replace(/,\s*initial-scale=[^,]*/g, '')},initial-scale=1`;
  setTimeout(() => { meta.content = c; window.scrollTo(0, 0); }, 60);
}
function unlockZoom() {
  const meta = document.querySelector('meta[name="viewport"]');
  if (meta && viewportBefore !== null) meta.content = viewportBefore;
  viewportBefore = null;
  if (R?.onZoom) window.visualViewport?.removeEventListener('resize', R.onZoom);
}
function closeAll() {
  if (!R) return;
  unlockZoom();
  R.closing = true; R.timers.forEach(clearTimeout); cancelAnimationFrame(R.raf); stopStrain();
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
  if (act === 'rod') return rodSheet();
  if (act === 'spot') return pickSpot(b.dataset.spot);
  if (act === 'rod-up') return rodUp(b);
  if (act === 'practice') { closeSheet(); return practice(); }
}

/* ---------- 1인칭 장면: 배경 · 펫 · 찌 · 물고기 그림자 · 낚싯대(코드 그림) · 줄 ---------- */
function scene() {
  const pet = R.A.data.stats?.pet;
  const bg = has('bg-pov') ? art('bg-pov', '') : has('bg-sea') ? art('bg-sea', '') : '';
  $('rl-main').innerHTML = `<div class="rl-pov${bg ? ' art' : ''}" id="rl-pov" data-phase="dock" data-spot="${R.spot === 'deep' ? 'deep' : 'shore'}">
    <div class="rl-world" id="rl-world">
      <div class="rl-bg">${bg || '<div class="rl-sky"><i class="rl-sun"></i><i class="rl-cloud a"></i><i class="rl-cloud b"></i><i class="rl-isle"></i></div><div class="rl-water"><i class="rl-wave w1"></i><i class="rl-wave w2"></i><i class="rl-wave w3"></i></div>'}</div>
      <i class="rl-glint a"></i><i class="rl-glint b"></i><i class="rl-glint c"></i>
      <div class="rl-deep" aria-hidden="true">${'<i></i>'.repeat(9)}</div>
      <div class="rl-shadow" id="rl-shadow" hidden><i></i></div>
      <div class="rl-bob" id="rl-bob">${art('bobber', '<i class="rl-bob-code"></i>')}${has('bobber-sink') ? art('bobber-sink', '', 'bite') : has('bobber-bite') ? art('bobber-bite', '', 'bite') : ''}${has('bobber-nibble') ? art('bobber-nibble', '', 'nib') : ''}</div>
      <div class="rl-fxl" id="rl-fx"></div>
    </div>
    <svg class="rl-rig" id="rl-rig" data-rod="${myRod().level}" aria-hidden="true">
      <defs>
        ${rodGradients()}
        <linearGradient id="rl-corkg" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stop-color="#92400e"/><stop offset=".5" stop-color="#d6a46a"/><stop offset="1" stop-color="#a16207"/></linearGradient>
      </defs>
      <path class="rl-line2" id="rl-line2" d=""/>
      <g class="rl-rodv" id="rl-rodv"></g>
      <g class="rl-reel-g" id="rl-reelg"><image class="rl-reel-art" id="rl-reelimg" width="1" height="1"/><circle class="spool" r="1"/><circle class="cap" r="1"/><g id="rl-crank"><rect class="arm"/><circle class="knob" r="1"/></g></g>
    </svg>
    <div class="rl-pet" id="rl-pet">${pet ? avatar(pet.key, { form: Math.max(1, pet.form ?? 1) }) : ''}<span class="rl-say" id="rl-say" hidden></span></div>
    <div class="rl-spotbox" id="rl-spotbox"></div>
    <nav class="rl-side-menu" aria-label="낚시터 메뉴">
      <button type="button" class="rl-ico" data-rl="rod" aria-label="낚싯대 강화"><span id="rl-rod-ico">${art(`icon-rod-${myRod().level}`, '<i class="rl-ico-rod"></i>')}</span><small>낚싯대</small></button>
      <button type="button" class="rl-ico" data-rl="net" aria-label="수조(어망)">${art('icon-net', art('net', '<i class="rl-ico-net"></i>'))}<i class="rl-badge" id="rl-net-n" hidden></i><small>수조</small></button>
      <button type="button" class="rl-ico" data-rl="shop" aria-label="교환소">${art('icon-shop', art('shop', '<i class="rl-ico-shop"></i>'))}<small>교환소</small></button>
      <button type="button" class="rl-ico" data-rl="book" aria-label="도감">${art('icon-book', '<i class="rl-ico-book"></i>')}<small>도감</small></button>
    </nav>
    <div class="rl-cue" id="rl-cue" aria-live="assertive"></div>
    <div class="rl-hud" id="rl-hud"></div>
  </div>`;
  sizeRig();
  paintRod();
}
// V13.154 낚싯대 단계: 코드로 그리는 1인칭 낚싯대 · 릴 색이 단계마다 바뀐다(4 · 5단계는 은은하게 빛난다).
const myRod = () => rodOf(R?.v?.rod);
function rodGradients() {
  const r = myRod(), [a, b, c, d] = r.colors, [e, f, g] = r.reelc;
  return `<linearGradient id="rl-rodg" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stop-color="${a}"/><stop offset=".45" stop-color="${b}"/><stop offset=".6" stop-color="${c}"/><stop offset="1" stop-color="${d}"/></linearGradient>
        <radialGradient id="rl-reelgrad" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="${e}"/><stop offset=".5" stop-color="${f}"/><stop offset="1" stop-color="${g}"/></radialGradient>`;
}
// V13.186 단계별 낚싯대 모양(그림 31 icon-rod · pov-rod를 보고 맞춘 벡터). shaft: 몸통 색(가장자리 · 가운데 · 빛 · 반대 가장자리),
//   wrap: 마디 감개(색 · 테두리), ring: 고리(밝은 · 진한), guide: 고리 모양(ring 동그라미 · gem 보석 · star 별), butt: 손잡이 끝(ball 구슬 · cap 은 마개 ·
//   gold 금 마개 + 에메랄드 · gem 큰 보석 · star 별), glow: 낚싯대 둘레 빛, sparkle: 반짝이. 릴은 단계별 릴 그림(pov-reel · -t2~t5)이다.
export const ROD_LOOK = [
  { level: 1, shaft: ['#94a3b8', '#ffffff', '#ffffff', '#cbd5e1'], wrap: ['#34d399', '#047857'], ring: ['#fde68a', '#b45309'], guide: 'ring', butt: 'ball', buttc: ['#d1fae5', '#10b981', '#065f46'], wraps: [.3, .4, .5, .6, .7, .8, .89], glow: null },
  { level: 2, shaft: ['#475569', '#cbd5e1', '#ffffff', '#64748b'], wrap: ['#38bdf8', '#0369a1'], ring: ['#f8fafc', '#475569'], guide: 'ring', butt: 'cap', buttc: ['#ffffff', '#94a3b8', '#334155'], wraps: [.31, .45, .59, .73, .86], glow: null },
  { level: 3, shaft: ['#92400e', '#f59e0b', '#fef3c7', '#b45309'], wrap: ['#10b981', '#065f46'], ring: ['#fde68a', '#92400e'], guide: 'ring', butt: 'gold', buttc: ['#fef3c7', '#f59e0b', '#92400e'], wraps: [.31, .45, .59, .73, .86], glow: null },
  { level: 4, shaft: ['#1e1b4b', '#6366f1', '#e0e7ff', '#6d28d9'], wrap: ['#38bdf8', '#1e3a8a'], ring: ['#e9d5ff', '#5b21b6'], guide: 'gem', butt: 'gem', buttc: ['#e0f2fe', '#38bdf8', '#1d4ed8'], wraps: [.31, .43, .55, .67, .79, .9], glow: 'rgba(167,139,250,.55)' },
  { level: 5, shaft: ['#b7791f', '#fef3c7', '#ffffff', '#f6c453'], wrap: ['#fbbf24', '#92400e'], ring: ['#fef08a', '#a16207'], guide: 'star', butt: 'star', buttc: ['#d1fae5', '#10b981', '#065f46'], wraps: [.31, .45, .59, .73, .86], glow: 'rgba(253,224,71,.6)', sparkle: true }
];
export const rodLook = lv => ROD_LOOK[rodLevel(lv) - 1];
const reelArt = lv => { const l = rodLevel(lv), name = l > 1 ? `pov-reel-t${l}` : 'pov-reel'; return has(name) ? name : null; };
// 단계 색 정의: 몸통(가로 그라데이션 = 둥근 막대 빛), 금속 띠, 손잡이 끝, 코르크 점무늬.
function lookDefs(L) {
  const [a, b, c, d] = L.shaft, [e, f, g] = L.buttc;
  return `<linearGradient id="rl-rv-shaft" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stop-color="${a}"/><stop offset=".32" stop-color="${b}"/><stop offset=".5" stop-color="${c}"/><stop offset="1" stop-color="${d}"/></linearGradient>
        <linearGradient id="rl-rv-metal" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stop-color="${L.ring[1]}"/><stop offset=".45" stop-color="${L.ring[0]}"/><stop offset=".6" stop-color="#ffffff"/><stop offset="1" stop-color="${L.ring[1]}"/></linearGradient>
        <radialGradient id="rl-rv-butt" cx=".35" cy=".3" r=".75"><stop offset="0" stop-color="${e}"/><stop offset=".55" stop-color="${f}"/><stop offset="1" stop-color="${g}"/></radialGradient>
        <pattern id="rl-rv-cork" width="7" height="7" patternUnits="userSpaceOnUse"><circle cx="1.5" cy="2" r=".9" fill="#7c4a1e" opacity=".45"/><circle cx="5" cy="5.5" r=".7" fill="#7c4a1e" opacity=".35"/></pattern>`;
}
function paintRod() {
  const svg = $('rl-rig'), defs = svg?.querySelector('defs');
  if (!defs) return;
  const L = rodLook(myRod().level), reel = $('rl-reelimg'), art = reelArt(L.level);
  for (const id of ['rl-rodg', 'rl-reelgrad', 'rl-rv-shaft', 'rl-rv-metal', 'rl-rv-butt', 'rl-rv-cork']) defs.querySelector(`#${id}`)?.remove();
  defs.insertAdjacentHTML('afterbegin', rodGradients() + lookDefs(L));
  svg.dataset.rod = L.level;
  svg.dataset.look = `${L.guide}-${L.butt}`;
  svg.classList.toggle('img-reel', !!art);
  if (reel && art) reel.setAttribute('href', `/assets/fishing/${art}.webp`); else reel?.removeAttribute('href');
  const arm = svg.querySelector('#rl-crank .arm'), knob = svg.querySelector('#rl-crank .knob');
  if (arm) { arm.style.fill = L.ring[0]; arm.style.stroke = L.ring[1]; }
  if (knob) knob.style.stroke = L.ring[1];
  R.look = L; R.reelArt = art;
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
const star = (x, y, r, inner = .42) => `M${Array.from({ length: 10 }, (_, i) => { const a = -Math.PI / 2 + i * Math.PI / 5, k = i % 2 ? r * inner : r; return `${(x + Math.cos(a) * k).toFixed(1)},${(y + Math.sin(a) * k).toFixed(1)}`; }).join('L')}Z`;
// 몸통 굵기(t: 곡선 위치) · 몸통 옆 점(o > 0이면 고리가 달린 쪽).
export const ROD_SHAPE = { BUTT: .085, CORK: [.11, .25], FERRULE: [.247, .275], SHAFT: .27, GUIDES: [.36, .5, .62, .73, .83, .91, .97] };
// 낚싯대 한 장(벡터): 빛 → 손잡이 끝 → 코르크 → 금속 띠 → 몸통 · 빛줄 → 마디 → 고리 → 끝 고리 → 반짝이. 끝 고리 = at(1) = 줄 끝.
export function rodSvg(g, L, now = 0) {
  const s = g.s, S = ROD_SHAPE, w = t => lerp(21, 4.4, clamp((t - S.SHAFT) / (1 - S.SHAFT), 0, 1)) * s;
  const side = (t, o) => { const [x, y] = g.at(t), [tx, ty] = g.tan(t); return [x - ty * o, y + tx * o]; };
  const f = n => n.toFixed(1), out = [];
  if (L.glow) out.push(`<path class="rl-rv-glow" d="${strip(g, S.SHAFT, 1, w(S.SHAFT) + 18 * s, w(1) + 12 * s, 20)}" fill="${L.glow}"/>`);
  // 손잡이 끝
  const [bx, by] = g.at(S.BUTT), [btx, bty] = g.tan(S.BUTT);
  if (L.butt === 'ball' || L.butt === 'star') out.push(`<circle cx="${f(bx)}" cy="${f(by)}" r="${f(19 * s)}" fill="url(#rl-rv-butt)" stroke="${L.buttc[2]}" stroke-width="${f(1.4 * s)}"/>`);
  if (L.butt === 'star') out.push(`<path d="${star(bx, by, 15 * s)}" fill="#fde047" stroke="#a16207" stroke-width="${f(1.4 * s)}"/>`);
  if (L.butt === 'cap' || L.butt === 'gold') out.push(`<path d="${strip(g, S.BUTT - .03, S.CORK[0] + .006, 37 * s, 35 * s, 3)}" fill="url(#rl-rv-butt)" stroke="${L.buttc[2]}" stroke-width="${f(1.4 * s)}"/>`);
  if (L.butt === 'gold') out.push(`<circle cx="${f(bx)}" cy="${f(by)}" r="${f(7 * s)}" fill="#10b981" stroke="#fef3c7" stroke-width="${f(2 * s)}"/>`);
  if (L.butt === 'gem') { const h = 26 * s, r = 17 * s; out.push(`<path d="M${f(bx + btx * h * .5)},${f(by + bty * h * .5)}L${f(bx - bty * r)},${f(by + btx * r)}L${f(bx - btx * h)},${f(by - bty * h)}L${f(bx + bty * r)},${f(by - btx * r)}Z" fill="url(#rl-rv-butt)" stroke="#ffffff" stroke-width="${f(1.6 * s)}"/><path d="M${f(bx)},${f(by)}L${f(bx - bty * r * .9)},${f(by + btx * r * .9)}" stroke="#ffffff" stroke-width="${f(1.2 * s)}" opacity=".7"/>`); }
  // 코르크 · 금속 띠
  const cork = strip(g, S.CORK[0], S.CORK[1], 34 * s, 28 * s, 8);
  out.push(`<path d="${strip(g, S.CORK[0] - .012, S.CORK[0] + .006, 36 * s, 36 * s, 2)}" fill="url(#rl-rv-metal)"/>`);
  out.push(`<path class="rl-rv-cork" d="${cork}" fill="url(#rl-corkg)"/><path d="${cork}" fill="url(#rl-rv-cork)"/>`);
  out.push(`<path d="${strip(g, S.FERRULE[0], S.FERRULE[1], 31 * s, 26 * s, 3)}" fill="url(#rl-rv-metal)" stroke="${L.ring[1]}" stroke-width="${f(.8 * s)}"/>`);
  // 몸통 + 빛줄
  out.push(`<path class="rl-rv-shaft" d="${strip(g, S.SHAFT, 1, w(S.SHAFT), w(1), 24)}" fill="url(#rl-rv-shaft)" stroke="${L.shaft[0]}" stroke-width="${f(.9 * s)}"/>`);
  out.push(`<path d="M${Array.from({ length: 14 }, (_, i) => { const t = lerp(S.SHAFT + .02, .985, i / 13); return side(t, -w(t) * .2).map(f).join(','); }).join('L')}" fill="none" stroke="#ffffff" stroke-width="${f(1.6 * s)}" stroke-linecap="round" opacity=".7"/>`);
  // 마디 감개(가운데 색 + 양쪽 금속 테)
  for (const t of L.wraps) {
    const ww = w(t) + 2.6 * s;
    out.push(`<path class="rl-rv-wrap" d="${strip(g, t, t + .026, ww, ww * .96, 2)}" fill="${L.wrap[0]}" stroke="${L.wrap[1]}" stroke-width="${f(.8 * s)}"/><path d="${strip(g, t - .005, t, ww, ww, 1)}" fill="${L.ring[0]}"/><path d="${strip(g, t + .026, t + .031, ww * .96, ww * .96, 1)}" fill="${L.ring[0]}"/>`);
  }
  // 고리: 몸통 옆에 다리로 붙는다.
  S.GUIDES.forEach((t, i) => {
    const r = lerp(8.5, 3.4, i / (S.GUIDES.length - 1)) * s, base = side(t, w(t) / 2), c = side(t, w(t) / 2 + r * 1.15), sw = Math.max(1.4 * s, r * .34);
    out.push(`<path d="M${base.map(f).join(',')}L${c.map(f).join(',')}" stroke="${L.ring[1]}" stroke-width="${f(sw)}" stroke-linecap="round"/>`);
    if (L.guide === 'star') out.push(`<path d="${star(c[0], c[1], r * 1.55, .5)}" fill="${L.ring[0]}" stroke="${L.ring[1]}" stroke-width="${f(1.1 * s)}"/><circle cx="${f(c[0])}" cy="${f(c[1])}" r="${f(r * .45)}" fill="#fffbeb" stroke="${L.ring[1]}" stroke-width="${f(.9 * s)}"/>`);
    else out.push(`<circle cx="${f(c[0])}" cy="${f(c[1])}" r="${f(r)}" fill="none" stroke="${L.ring[1]}" stroke-width="${f(sw + 1.4 * s)}"/><circle cx="${f(c[0])}" cy="${f(c[1])}" r="${f(r)}" fill="none" stroke="${L.ring[0]}" stroke-width="${f(sw)}"/>`);
    if (L.guide === 'gem') out.push(`<path d="M${f(base[0])},${f(base[1] - r * .9)}L${f(base[0] + r * .6)},${f(base[1])}L${f(base[0])},${f(base[1] + r * .9)}L${f(base[0] - r * .6)},${f(base[1])}Z" fill="#a78bfa" stroke="#ffffff" stroke-width="${f(.8 * s)}"/>`);
  });
  // 끝 고리(줄이 나오는 곳)
  out.push(`<circle class="rl-rv-tip" cx="${f(g.tip[0])}" cy="${f(g.tip[1])}" r="${f(2.8 * s)}" fill="${L.ring[0]}" stroke="${L.ring[1]}" stroke-width="${f(1.2 * s)}"/>`);
  if (L.sparkle) for (let i = 0; i < 5; i++) {
    const t = .36 + i * .13, k = (Math.sin(now / 320 + i * 1.7) + 1) / 2, [x, y] = side(Math.min(.98, t), (i % 2 ? 1 : -1) * (w(t) + 11 * s));
    out.push(`<path d="${star(x, y, (2.5 + k * 3.5) * s, .3)}" fill="#fffbeb" opacity="${(.35 + k * .65).toFixed(2)}"/>`);
  }
  return out.join('');
}
function drawRig(target) {
  if (!R.W) return;
  const g = rodGeom(), s = g.s;
  $('rl-rodv').innerHTML = rodSvg(g, R.look || rodLook(1), reduced() ? 0 : performance.now());
  // 릴: 손잡이 위, 낚싯대 오른쪽 아래에 붙는다.
  const [rx, ry] = g.at(.2), [tx, ty] = g.tan(.2), cx = rx - ty * -30 * s, cy = ry + tx * -30 * s;
  const reel = $('rl-reelg');
  reel.setAttribute('transform', `translate(${cx.toFixed(1)},${cy.toFixed(1)})`);
  reel.querySelector('.spool').setAttribute('r', 27 * s);
  if (R.reelArt) { const img = $('rl-reelimg'), z = 92 * s; img.setAttribute('x', -z / 2); img.setAttribute('y', -z / 2); img.setAttribute('width', z); img.setAttribute('height', z); }
  reel.querySelector('.cap').setAttribute('r', 9 * s);
  const arm = reel.querySelector('.arm'); arm.setAttribute('x', 0); const thin = R.reelArt ? .7 : 1; arm.setAttribute('y', -4 * s * thin); arm.setAttribute('width', 34 * s * thin); arm.setAttribute('height', 8 * s * thin); arm.setAttribute('rx', 4 * s * thin);
  const knob = reel.querySelector('.knob'); knob.setAttribute('cx', 34 * s * thin); knob.setAttribute('r', 8.5 * s * thin);
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
  quake(t);
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
  const v = R.v || {}, can = R.practice || Number(v.bait || 0) > 0;
  if (R.spot === 'deep' && (R.practice || !v.deep?.open)) setSpot('shore');
  const spot = $('rl-spotbox'); if (spot) spot.innerHTML = spotSwitch();
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
      <p class="rl-cast-tip">${R.practice ? '<b>연습 판</b> · 미끼를 쓰지 않아요' : can ? '<b>꾹</b> 누르고 <b>금색</b>에서 떼기' : '미끼가 없어요'}</p>
    </div>`, 'dockhud');
  // 이어 하기: 끊긴 던지기(pendingCast)나 서버에 남아 있는 던지기(live)가 있으면 버튼이 '이어서 던지기'.
  const resume = !R.practice && (R.pendingCast?.id || R.v?.live?.id);
  if (resume) { const b = $('rl-cast'); if (b) { b.disabled = false; b.dataset.resume = resume; } const tip = document.querySelector('.rl-cast-tip'); if (tip) tip.innerHTML = '<b>던져 둔 낚싯대</b>가 있어요 · 눌러서 이어 하기'; say('아까 던진 낚싯대가 있어! 이어서 하자', 2600); }
  else if (!can) say('미끼는 공부하면 받아요!', 3000);
  else if (!R.greeted) { R.greeted = true; later(() => say(['오늘은 큰 게 올 것 같아!', '준비됐어? 던져 보자!', '반짝이는 물결을 노려 봐!'][Math.floor(Math.random() * 3)]), 500); }
  bindCast();
}
// V13.185 낚시 장소: 바닷가 · 깊은 바다(낚싯대 DEEP.MIN_ROD단계부터, 심해 물고기 그림이 들어온 뒤에만 보인다 · 서버가 다시 확인한다).
function spotSwitch() {
  const d = R.v?.deep;
  if (!d?.ready || R.practice) return '';
  const deep = R.spot === 'deep';
  return `<div class="rl-spot" role="group" aria-label="낚시 장소"><button type="button" class="${deep ? '' : 'on'}" data-rl="spot" data-spot="shore" aria-pressed="${!deep}">🏝️ 바닷가</button><button type="button" class="${deep ? 'on' : ''}${d.open ? '' : ' locked'}" data-rl="spot" data-spot="deep" aria-pressed="${deep}">🌊 깊은 바다${d.open ? '' : `<small>🔒 낚싯대 ${num(d.min_rod)}단계</small>`}</button></div>`;
}
function setSpot(spot) {
  R.spot = spot === 'deep' ? 'deep' : 'shore';
  const pov = $('rl-pov'); if (pov) pov.dataset.spot = R.spot;
}
function pickSpot(spot) {
  if (R.phase !== 'dock') return;
  if (spot === 'deep' && !R.v?.deep?.open) { toast(`깊은 바다는 낚싯대 ${num(R.v?.deep?.min_rod || DEEP.MIN_ROD)}단계부터 갈 수 있어요. 진주로 낚싯대를 강화해요!`); return; }
  if (spot === R.spot || (spot === 'shore' && R.spot !== 'deep')) return;
  setSpot(spot);
  sfx('reel-plop', { gain: .6 });
  say(spot === 'deep' ? '깊은 바다야… 반짝이는 게 보여!' : '다시 바닷가로!', 1800);
  dock();
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
  if (btn.dataset.resume) { btn.onpointerdown = e => { e.preventDefault(); btn.onpointerdown = null; unlockSound(); cast(.7, btn.dataset.resume); }; return; }
  let t0 = 0, holding = false, raf = 0, lastZone = '';
  const level = () => (1 - Math.cos((performance.now() - t0) / 1150 * Math.PI * 2)) / 2;
  const loop = () => {
    if (!holding || !R) return;
    const k = level(), z = zoneOf(k);
    const nd = $('rl-needle'); if (nd) nd.style.transform = `rotate(${(-90 + k * 180).toFixed(1)}deg)`;
    const fill = $('rl-arcfill'); if (fill) fill.style.strokeDasharray = `${k.toFixed(3)} 1`;
    arc.dataset.zone = z;
    R.rig.tBack = .35 + k * .65; R.rig.tBend = .12 + k * .1;
    if (z === 'perfect' && lastZone !== 'perfect') { sfx('reel-click', { rate: 1.5, gain: .9 }); feel('tick'); }
    lastZone = z;
    raf = requestAnimationFrame(loop);
  };
  btn.onpointerdown = e => { e.preventDefault(); if (holding) return; holding = true; t0 = performance.now(); arc.classList.add('on'); btn.classList.add('hold'); sfx('reel-creak', { gain: .45, rate: .8 }); loop(); };
  const release = e => { if (!holding) return; e?.preventDefault?.(); holding = false; cancelAnimationFrame(raf); btn.classList.remove('hold'); cast(level()); };
  btn.onpointerup = release; btn.onpointerleave = release; btn.onpointercancel = release;
}
// V13.150.1 던지기 번호: 연결이 끊겨 다시 보내도 서버가 한 번만 처리한다(미끼가 두 번 빠지지 않는다).
const newCastId = () => `c${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
// 서버에 던지기를 보낸다. 느리면 같은 번호로 두 번 더(그동안 '연결이 느려요'). 끝내 안 되면 null(번호는 남겨 두어 이어 하기).
async function sendCast(id, tier) {
  for (let i = 0; i < 3; i++) {
    try { return await api('/reel/cast', { id, cast: tier, ...(R.spot === 'deep' ? { spot: 'deep' } : {}) }); }
    catch (err) {
      if (!R) return null;
      if (!err.transient) { R.pendingCast = null; toast(err.message); return null; }
      if (i < 2) { cue('<span class="rl-cue-soft">연결이 느려요… <b>다시 보내는 중</b></span>'); await new Promise(r => setTimeout(r, 900 + i * 900)); }
    }
  }
  return null;
}
async function cast(k, resumeId = null) {
  const tier = resumeId ? 'ok' : zoneOf(k);
  $('rl-cast') && ($('rl-cast').disabled = true);
  setPhase('cast');
  // 휙: 젖혔던 낚싯대가 앞으로(용수철이 넘어가며 출렁인다).
  Object.assign(R.rig, { tBack: -.12, tBend: .02 });
  R.rig.vb = -6;
  later(() => { R.rig.tBack = 0; }, 260);
  sfx('reel-cast', { rate: lerp(.92, 1.08, k), gain: lerp(.75, 1, k) }); feel('cast');
  let res;
  if (R.practice) res = { id: 'practice', fight: { ...FIGHT.uncommon, min: 0 } };
  else {
    const id = resumeId || newCastId();
    R.pendingCast = { id };
    res = await sendCast(id, tier);
    if (!R) return;
    if (!res) {
      // 끝내 답이 없으면: 미끼가 쓰였는지 모르니 번호를 남겨 두고, 다음 던지기에서 같은 번호로 이어 한다.
      if (R.pendingCast) toast('연결이 불안정해요. 다시 던지면 방금 던진 낚싯대를 그대로 이어서 해요(미끼는 한 번만 써요).');
      return dock();
    }
    R.pendingCast = null;
    setView(res.reel);
    if (res.again) cue('<span class="rl-cue-soft">아까 던진 낚싯대예요. <b>이어서 해요!</b></span>', '', 1800);
  }
  // 이어 하기: 서버가 던진 시각부터 센다(최소 파이팅 시간).
  const ago = res.again && res.at ? Math.max(0, Date.now() - res.at) : 0;
  R.live = { id: res.id, fight: res.fight, tier, at: performance.now() - ago, minMs: Number(res.fight.min || 0) };
  hud('', 'empty');
  if (tier === 'perfect') { pop('퍼펙트 캐스팅!', 'perfect'); sfx('reel-sparkle', { at: .3 }); feel('perfect'); say('완벽해!'); }
  else if (tier === 'good') pop('좋은 캐스팅!', 'good');
  const g = rodGeom();
  R.bob = { x: R.W * (.42 + Math.random() * .22), y: R.H * lerp(.66, .45, k), state: 'fly', fly: { t0: performance.now(), ms: reduced() ? 80 : 640, x0: g.tip[0], y0: g.tip[1] } };
  R.bob.landed = () => { const b = $('rl-bob'); b?.classList.add('on'); fx('splash', R.bob.x, R.bob.y, 'small'); fx('ripple', R.bob.x, R.bob.y); sfx('reel-plop', { vary: .05 }); feel('plop'); R.bob.state = 'float'; waitBite(); };
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
      fx('ripple', R.bob.x, R.bob.y, 'tiny'); sfx('reel-nibble', { vary: .08, gain: FEEL() }); feel('nibble');
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
    pop('아직이에요!', 'warn'); sfx('wrong', { gain: .35 }); feel('early'); say('톡톡은 가짜야! 쑥 들어갈 때!');
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
  sfx('reel-bite'); feel('bite');
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
  flash(); pop(fast ? '번개 챔질!' : '챔질 성공!', 'strike'); sfx('reel-hook', { rate: fast ? 1.06 : 1 }); feel(fast ? 'hookFast' : 'hook');
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
  result(`<div class="rl-miss-art">${fishShadow('carp')}</div><h2>놓쳤어요!</h2><p>${esc(msg)}</p><small>${R.practice ? '연습이라 미끼는 그대로예요. 다시 해 봐요!' : '미끼는 사라졌어요.'}</small>`, 'miss');
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
  stopStrain(); R.strain = loopSound('reel-strain');
  const pet = R.A.data.stats?.pet;
  hud(`<div class="rl-dist" aria-label="남은 거리"><span><i id="rl-dist-fill"></i>${art('gauge-distance', '')}</span><b id="rl-dist-n">${Math.ceil(dist)}m</b></div>
    <div class="rl-reelwrap">
      <svg class="rl-tring" viewBox="0 0 140 140" aria-hidden="true"><circle class="bg" cx="70" cy="70" r="62"/><circle class="v" id="rl-tring" cx="70" cy="70" r="62"/><circle class="red" cx="70" cy="70" r="62"/></svg>
      <button type="button" class="rl-reelbtn" id="rl-reel" aria-label="꾹 눌러 감기">${art('btn-reel', '<span class="rl-reelbtn-code"><i id="rl-reel-crank"></i></span>')}</button>
      <small class="rl-reel-tip" id="rl-reel-tip">꾹 눌러 감기</small>
    </div>
    <button type="button" class="rl-sidebtn l" id="rl-sl" data-side="-1" aria-label="왼쪽">${art('btn-left', '<span class="rl-sidebtn-code"><i></i></span>')}</button>
    <button type="button" class="rl-sidebtn r" id="rl-sr" data-side="1" aria-label="오른쪽">${art('btn-right', '<span class="rl-sidebtn-code"><i></i></span>')}</button>
    <div class="rl-qte" id="rl-qte" aria-live="polite"></div>
    <button type="button" class="rl-skill" id="rl-skill" data-rl="skill" disabled aria-label="펫 특기">${pet ? avatar(pet.key, { form: Math.max(1, pet.form ?? 1), size: 'mini' }) : ''}<svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="18"/><circle class="v" id="rl-skill-ring" cx="20" cy="20" r="18"/></svg><em>위로 쓸기!</em></button>`, 'fighthud');
  const reel = $('rl-reel'), pov = $('rl-pov');
  const down = e => { e.preventDefault(); R.f.holding = true; reel.classList.add('hold'); R.f.swipeX = e.clientX; R.f.swipeY = e.clientY; R.f.swipeAt = performance.now(); };
  const up = e => { e?.preventDefault?.(); if (R?.f) R.f.holding = false; reel.classList.remove('hold'); };
  reel.onpointerdown = down; reel.onpointerup = up; reel.onpointercancel = up;
  reel.onpointerleave = e => { if (e.pointerType === 'mouse') up(e); };
  for (const b of [$('rl-sl'), $('rl-sr')]) b.onpointerdown = e => { e.preventDefault(); e.stopPropagation(); side(Number(b.dataset.side), b); };
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
  // V13.150 첫 손맛 연습: 처음 한 판(또는 안내의 '연습 판')은 단계마다 손가락 안내가 나오고 줄이 끊기거나 빠지지 않는다.
  R.tut = R.practice || !R.v?.tut ? { step: -1, t: 0 } : null;
  if (R.tut) { $('rl-pov').insertAdjacentHTML('beforeend', '<i class="rl-tuthand" id="rl-tuthand" hidden></i>'); later(tutNext, 700); }
}
const TUT = [
  { id: 'hold', cue: '릴 버튼을 <b>꾹</b> 눌러 감아요', hand: 'hold' },
  { id: 'red', cue: '계속 감으면 고리가 <b>빨개져요</b>.<br>빨간색이 되면 <b>손을 떼요!</b>', hand: 'hold' },
  { id: 'mash', cue: '', hand: 'mash' },
  { id: 'rhythm', cue: '', hand: '' },
  { id: 'thrash', cue: '', hand: 'off' },
  { id: 'skill', cue: '펫 특기 구슬이 가득!<br>화면을 <b>위로 쓸어 올려요</b>', hand: 'up' },
  { id: 'free', cue: '좋아요! 이제 <b>끝까지</b> 감아요', hand: '' }
];
function tutNext() {
  const t = R.tut, f = R.f;
  if (!t || !f) return;
  t.step++; t.t = 0; t.sawRed = false;
  const S = TUT[t.step];
  if (!S) return;
  const hand = $('rl-tuthand');
  if (hand) { hand.hidden = !S.hand; hand.className = `rl-tuthand ${S.hand}`; }
  if (S.id === 'mash' || S.id === 'rhythm' || S.id === 'thrash') startMove(performance.now(), S.id);
  else cue(`<span class="rl-cue-tut"><small>손맛 연습 ${t.step + 1} / ${TUT.length}</small><span>${S.cue}</span></span>`, 'tut', S.id === 'free' ? 2200 : 0);
  if (S.id === 'skill') f.skill = 100;
  if (S.id === 'free') { later(() => { if ($('rl-tuthand')) $('rl-tuthand').hidden = true; }, 200); f.next = performance.now() + 2500; }
  sfx('tick', { rate: 1.3, gain: .5 });
}
// 연습 판의 단계 진행(fightStep에서 매 프레임).
function tutStep(dt, zone) {
  const t = R.tut, f = R.f, S = TUT[t.step], m = f.move;
  if (!S) return;
  if (S.id === 'hold' && f.holding && (t.t += dt) > 1.2) tutNext();
  else if (S.id === 'red') {
    if (f.holding) f.tension += 40 * dt;
    if (zone === 'red' && !t.sawRed) { t.sawRed = true; cue('<span class="rl-cue-big thrash">지금! <b>손 떼기!</b></span>', 'thrash'); const h = $('rl-tuthand'); if (h) h.className = 'rl-tuthand off'; }
    if (t.sawRed === true && !f.holding && f.tension < 72) { cue('<span class="rl-cue-big ok">잘했어요!</span>', 'ok', 700); later(tutNext, 800); t.sawRed = 'done'; }
  } else if (S.id === 'thrash' && m?.kind === 'thrash' && !f.holding && (m.free = (m.free || 0) + dt) > 1) endMove(true);
}
function offSwipe() {
  const pov = $('rl-pov');
  if (R?.swipe) { pov?.removeEventListener('pointerdown', R.swipe.down); pov?.removeEventListener('pointermove', R.swipe.move); removeEventListener('pointerup', R.swipe.up); R.swipe = null; }
}
function pickMove() {
  const m = R.live.fight.moves || { mash: 1 }, total = Object.values(m).reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (const [k, w] of Object.entries(m)) if ((r -= w) <= 0) return k;
  return 'mash';
}
function startMove(t, forced = null) {
  const f = R.f, kind = forced || pickMove(), F = R.live.fight;
  if (kind === 'mash') {
    // 탈출 시도: 좌우 버튼을 번갈아 연타(같은 쪽을 두 번은 안 쳐요).
    f.move = { kind, until: t + 2600, need: F.taps || 10, got: 0, last: 0 };
    cue(`<span class="rl-cue-big mash">탈출 시도!<small>◀ ▶ 번갈아 연타!</small></span>`, 'mash');
    qte(`<div class="rl-mash"><span><i id="rl-mash-fill"></i></span><b id="rl-mash-n">0 / ${f.move.need}</b></div>`);
    sfx('reel-run'); sfx('reel-creak', { gain: .6, rate: 1.1, at: .1 }); feel('run'); say('도망가려고 해! 연타!', 1500);
  } else if (kind === 'rhythm') {
    // 리듬: 위에서 내려오는 노트가 동그라미에 닿을 때 그쪽 버튼.
    const n = F.notes || 6, beat = F.beat || 500, t0 = t + 1100;
    const notes = []; let at = t0;
    for (let k = 0; k < n; k++) { notes.push({ side: Math.random() < .5 ? -1 : 1, at, done: '' }); at += beat * (k % 4 === 3 ? 1.5 : 1); }
    f.move = { kind, until: at + 600, notes, hit: 0, perfect: 0, combo: 0 };
    cue(`<span class="rl-cue-big rhythm">리듬을 타요!<small>노트가 동그라미에 닿을 때 톡!</small></span>`, 'rhythm', 1100);
    qte(`<div class="rl-lanes"><div class="rl-lane l"><i class="rl-hitring"></i></div><div class="rl-lane r"><i class="rl-hitring"></i></div><div class="rl-notes" id="rl-notes">${notes.map((x, k) => `<i class="rl-note ${x.side < 0 ? 'l' : 'r'}" data-k="${k}" data-at="${x.at.toFixed(0)}"></i>`).join('')}</div><b class="rl-combo" id="rl-combo"></b><em class="rl-judge" id="rl-judge"></em></div>`);
    sfx('reel-run', { dur: .6, rate: 1.15, gain: .6 }); feel('rhythm'); say('리듬 타자!', 1200);
  } else if (kind === 'thrash') {
    f.move = { kind, until: t + 1300, held: 0 };
    cue('<span class="rl-cue-big thrash">날뛴다! <b>손 떼기!</b></span>', 'thrash');
    fx('splash', f.x, R.H * .5 + f.depth, 'big'); sfx('reel-jump', { gain: .75, rate: 1.1 }); sfx('reel-creak', { gain: .5, rate: 1.25 }); feel('thrash'); say('놓아! 놓아!', 1200);
  } else {
    f.move = { kind, until: t + 1900 };
    cue('<span class="rl-cue-big dive">잠수! <b>꾹 버티기!</b></span>', 'dive');
    sfx('reel-run', { rate: .8, gain: .85 }); feel('dive'); say('꽉 잡아!', 1200);
  }
  if (forced && kind !== 'rhythm') f.move.until = t + 1e9; // 연습: 해낼 때까지 기다린다(리듬은 노트가 끝나면)
  $('rl-pov').dataset.move = kind;
}
const qte = html => { const el = $('rl-qte'); if (el) { el.innerHTML = html; el.classList.toggle('on', !!html); } };
const MOVE_OK = { mash: '빠져나가지 못했어요!', rhythm: '리듬 성공!', thrash: '잘 풀어 줬어요!', dive: '버텼다!' };
const MOVE_BAD = { mash: '끌려갔어요…', rhythm: '박자를 놓쳤어요…', thrash: '줄이 출렁!', dive: '깊이 들어갔어요…' };
function endMove(ok) {
  const f = R.f, m = f.move;
  if (!m) return;
  f.move = null;
  $('rl-pov').dataset.move = '';
  qte('');
  if (R.tut && m.kind === 'rhythm') ok = true; // 연습에서는 끝까지 하면 성공
  if (ok) {
    const big = m.kind === 'mash' || m.kind === 'rhythm';
    f.skill = Math.min(100, f.skill + (big ? 24 : 16)); f.dist = Math.max(0, f.dist - (big ? 3 : 1.5));
    const extra = m.kind === 'rhythm' && m.perfect ? `<small>퍼펙트 ${m.perfect} · 콤보 최대 ${m.best || m.combo}</small>` : '';
    cue(`<span class="rl-cue-big ok">${MOVE_OK[m.kind]}${extra}</span>`, 'ok', 900);
    sfx('reel-sparkle', { gain: big ? .85 : .55 }); if (big) { sfx('reel-splash', { gain: .5, dur: 1 }); flash(); R.rig.vb = 6; } feel(big ? 'ok' : 'tap2');
  } else {
    f.dist = Math.min(f.max * 1.2, f.dist + (m.kind === 'dive' ? 2 : 3)); f.tension = Math.min(100, f.tension + 12);
    cue(`<span class="rl-cue-big bad">${MOVE_BAD[m.kind]}</span>`, 'bad', 800);
    sfx('reel-creak', { rate: .85, gain: .8 }); feel('bad');
  }
  f.next = performance.now() + rnd(R.live.fight.dash);
  if (ok && R.tut && ['mash', 'rhythm', 'thrash'].includes(TUT[R.tut.step]?.id)) later(tutNext, 900);
}
// 좌우 버튼(또는 좌우 쓸기): 탈출 연타 · 리듬 노트.
function side(dir, b = null) {
  const f = R?.f, m = f?.move;
  if (!f || R.phase !== 'fight') return;
  b = b || $(dir < 0 ? 'rl-sl' : 'rl-sr');
  b?.classList.remove('tap'); void b?.offsetWidth; b?.classList.add('tap');
  R.rig.vd += dir * 5;
  if (m?.kind === 'mash') {
    if (dir === m.last) { pop('번갈아!', 'warn'); sfx('wrong', { gain: .25 }); return; }
    m.last = dir; m.got++;
    f.tension = Math.max(25, f.tension - 3);
    sfx('reel-click', { rate: .9 + Math.min(1, m.got / m.need) * .8, gain: 1.1 * FEEL(), vary: .03 }); feel('tap');
    fx('pull', R.fishPx?.[0] ?? R.W / 2, R.fishPx?.[1] ?? R.H * .55);
    const k = Math.min(1, m.got / m.need);
    const fill = $('rl-mash-fill'); if (fill) fill.style.transform = `scaleX(${k.toFixed(3)})`;
    const n = $('rl-mash-n'); if (n) n.textContent = `${Math.min(m.got, m.need)} / ${m.need}`;
    $('rl-qte')?.classList.toggle('hot', k > .7);
    if (m.got >= m.need) endMove(true);
    return;
  }
  if (m?.kind === 'rhythm') {
    const now = performance.now();
    const note = m.notes.find(x => !x.done && x.side === dir && Math.abs(x.at - now) <= 190);
    if (!note) { f.tension = Math.min(100, f.tension + 3); judge('빗나감', 'miss', dir); m.combo = 0; return; }
    const d = Math.abs(note.at - now), kind = d <= 85 ? 'perfect' : 'good';
    note.done = kind; m.hit++; m.combo++; m.best = Math.max(m.best || 0, m.combo); if (kind === 'perfect') m.perfect++;
    f.dist = Math.max(f.max * (R.tut ? .35 : 0), f.dist - (kind === 'perfect' ? 1 : .6)); f.skill = Math.min(100, f.skill + 3);
    sfx('reel-click', { rate: (kind === 'perfect' ? 1.3 : 1) + Math.min(8, m.combo) * .06, gain: 1.1 * FEEL() }); if (kind === 'perfect') sfx('reel-nibble', { rate: 1.1 + Math.min(8, m.combo) * .05, gain: .5 }); feel(kind === 'perfect' ? 'tap2' : 'tap');
    judge(kind === 'perfect' ? 'PERFECT' : 'GOOD', kind, dir);
    document.querySelector(`.rl-note[data-k="${m.notes.indexOf(note)}"]`)?.classList.add('hit', kind);
    return;
  }
  f.tension = Math.max(0, f.tension - 1.5);
}
function judge(text, kind, dir) {
  const el = $('rl-judge'), c = $('rl-combo'), m = R.f?.move;
  if (el) { el.textContent = text; el.className = `rl-judge ${kind} ${dir < 0 ? 'l' : 'r'}`; void el.offsetWidth; el.classList.add('show'); }
  if (c && m) { c.textContent = m.combo > 1 ? `${m.combo} 콤보` : ''; c.classList.remove('bump'); void c.offsetWidth; c.classList.add('bump'); }
}
function swipe(dir) {
  const f = R?.f;
  if (!f || R.phase !== 'fight') return;
  if (f.move && (f.move.kind === 'mash' || f.move.kind === 'rhythm')) return side(dir);
  R.rig.vd += dir * 4;
  f.tension = Math.max(0, f.tension - 2);
}
function fightStep(t, dt) {
  const f = R.f, F = R.live.fight, pull = F.pull || 1, rod = myRod();
  const m = f.move;
  // 텐션: 감으면 오르고 풀면 내린다. 물고기 힘이 출렁인다.
  // 탈출 연타 · 리듬 중에는 감기보다 버튼이 중요: 텐션은 가운데로 모인다.
  if (m?.kind === 'mash' || m?.kind === 'rhythm') f.tension += (58 - f.tension) * Math.min(1, dt * 2.5);
  else {
    f.tension += f.holding ? (40 + pull * 22) * rod.tension * dt : -48 * dt;
    f.tension += pull * (Math.sin(t / 330) * 8 + Math.sin(t / 97) * 4) * dt;
  }
  if (m?.kind === 'thrash' && f.holding) { f.tension += 95 * dt; m.held += dt; }
  if (m?.kind === 'dive') f.tension += (f.holding ? 26 : 8) * pull * dt;
  f.tension = clamp(f.tension, 0, 100);
  const zone = f.tension >= 80 ? 'red' : f.tension >= 22 ? 'green' : 'blue';
  f.zone = zone;
  // 거리: 초록 칸에서 감을 때 가장 빨리 줄어든다. 손을 떼면 물고기가 조금 끌고 간다.
  f.reelV = f.holding ? (zone === 'green' ? 2.5 : zone === 'blue' ? 1 : .55) / Math.pow(pull, .35) * rod.reel : 0; // 감는 속도(m/초)
  if (f.holding) f.dist -= f.reelV * dt;
  else f.dist += .55 * pull * dt;
  if (m?.kind === 'dive' && !f.holding) f.dist += 2.2 * dt;
  if (m?.kind === 'mash') f.dist += 1.4 * pull * dt;
  if (m?.kind === 'rhythm') {
    // 지나간 노트는 놓침
    for (const [k, x] of m.notes.entries()) if (!x.done && t - x.at > 190) { x.done = 'miss'; m.combo = 0; f.dist = Math.min(f.max * 1.2, f.dist + .8); f.tension = Math.min(100, f.tension + 5); judge('MISS', 'miss', x.side); document.querySelector(`.rl-note[data-k="${k}"]`)?.classList.add('gone'); sfx('wrong', { gain: .25 }); }
    const lane = $('rl-notes'), H = lane?.clientHeight || 220;
    if (lane) for (const el of lane.children) { const at = Number(el.dataset.at), k = 1 - (at - t) / 1100; el.style.transform = `translateY(${(clamp(k, -.1, 1.2) * H).toFixed(1)}px)`; el.style.opacity = k < -.05 ? 0 : 1; }
    if (m.notes.every(x => x.done)) { endMove(m.hit / m.notes.length >= .6); }
  }
  f.dist = clamp(f.dist, 0, f.max * 1.25);
  if (zone === 'green' && f.holding) f.skill = Math.min(100, f.skill + 7 * rod.skill * dt);
  // 연습: 줄이 끊기거나 빠지지 않고, 마지막 단계 전에는 끝까지 오지 않는다.
  if (R.tut) {
    f.tension = Math.min(f.tension, 96); f.slackFor = 0;
    if (R.tut.step < TUT.length - 1) f.dist = Math.max(f.dist, f.max * .35);
    tutStep(dt, zone);
  }
  // 끝나는 조건
  f.redFor = f.tension >= 98 ? f.redFor + dt : 0;
  f.slackFor = f.tension <= 2 ? f.slackFor + dt : 0;
  if (f.redFor > rod.snap) return lose('줄이 끊어졌어요! 빨간색이면 손을 떼요', 'snap');
  if (f.slackFor > 3.5) return lose('줄이 느슨해져서 물고기가 빠져나갔어요', 'slack');
  if (f.move && t > f.move.until) endMove(m.kind === 'thrash' ? m.held < .35 : m.kind === 'dive' ? f.dist < f.max * 1.2 && f.redFor === 0 : m.kind === 'rhythm' ? m.hit / m.notes.length >= .6 : false);
  else if (!m && t > f.next && (!R.tut || R.tut.step >= TUT.length - 1)) startMove(t);
  if (f.dist <= 0) return finish();
  // 물고기 위치: 멀면 수평선 가까이(작게), 가까우면 아래로(크게).
  const near = 1 - f.dist / f.max;
  const tx = m?.kind === 'mash' ? R.W * (.5 + Math.sin(t / 160) * .3) : R.W * (.5 + Math.sin(t / 1100) * .22);
  f.x += (tx - f.x) * Math.min(1, dt * (m?.kind === 'mash' ? 6 : 1.1));
  f.depth = m?.kind === 'dive' ? Math.min(1, (f.depth || 0) + dt * 2) : Math.max(0, (f.depth || 0) - dt * 2);
  const y = R.H * lerp(.47, .7, clamp(near, 0, 1)) + Math.sin(t / 380) * 4;
  R.fishPx = [f.x, y];
  const sh = $('rl-shadow');
  sh.style.transform = `translate(${f.x.toFixed(1)}px,${y.toFixed(1)}px) scale(${(lerp(.55, 1.25, clamp(near, 0, 1)) * (1 - f.depth * .35)).toFixed(3)})`;
  sh.classList.toggle('flip', (m?.kind === 'mash' ? Math.cos(t / 160) : Math.cos(t / 1100)) < 0);
  sh.classList.toggle('deep', f.depth > .3);
  sh.classList.toggle('thrash', m?.kind === 'thrash' || m?.kind === 'mash');
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
  if (f.skill >= 100 && skill.disabled) { skill.disabled = false; skill.classList.add('full'); sfx('skill'); feel('ready'); say('특기 준비! 위로 쓸어!', 1600); }
  $('rl-world').classList.toggle('shake', zone === 'red' && !reduced());
  // V13.164 손맛: 릴 딸깍은 감는 속도만큼 잦고 높게(초록 칸에서 빨리 감으면 촤르르), 줄 텐션 끼익은 텐션만큼 크고 높게,
  // 빨간 칸에 들어가면(그 뒤로 0.9초마다) 낚싯대가 끼익, 낚싯대는 텐션만큼 부르르 떨고, 진동은 텐션만큼 길고 잦게.
  const speed = clamp(f.reelV / (2.5 * rod.reel), 0, 1);
  if (speed > 0 && t - f.clickAt > lerp(210, 55, speed)) { f.clickAt = t; sfx('reel-click', { rate: .75 + speed * .35 + f.tension / 500, gain: (.55 + speed * .5) * FEEL(), vary: .04 }); }
  const strain = clamp((f.tension - 30) / 60, 0, 1);
  R.strain?.set(strain ** 1.4 * (f.holding ? 1 : .6) * FEEL(), .8 + f.tension / 100 * .55 + (zone === 'red' ? Math.sin(t / 60) * .03 : 0));
  if (zone === 'red' && t - (f.creakAt || 0) > 900) { f.creakAt = t; sfx('reel-creak', { rate: 1 + Math.random() * .15, gain: .85 }); }
  if (strain > 0 && !reduced()) R.rig.vbe += (Math.random() - .5) * strain * (canBuzz() ? 3 : 7);
  tensionFeel(t, f, zone);
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
  flash(); sfx('reel-hook', { rate: .9 }); sfx('reel-splash', { gain: .6, dur: 1.2, at: .15 }); feel('skill');
  if (R.tut && TUT[R.tut.step]?.id === 'skill') later(tutNext, 1000);
}
async function lose(msg, why) {
  offSwipe(); qte('');
  $('rl-tuthand')?.remove(); R.tut = null;
  setPhase('lost');
  R.rig.spin = 0; stopStrain();
  if (why === 'snap') { Object.assign(R.rig, { tBend: 0, tDir: 0 }); R.rig.vbe = -14; fx('snap', ...rodGeom().tip); sfx('reel-snap'); }
  else sfx('reel-plop', { rate: .75, gain: .6 });
  sfx('fail', { gain: .6, at: .35 }); feel(why === 'snap' ? 'snap' : 'slack'); petFace('sad');
  $('rl-world')?.classList.remove('zoom', 'shake');
  $('rl-shadow').classList.add('flee');
  cue('');
  R.fishPx = null;
  await land('lost');
  if (!R) return;
  later(() => {
    $('rl-shadow').hidden = true; $('rl-shadow').classList.remove('flee'); $('rl-world').classList.remove('zoom', 'shake');
    result(`<div class="rl-miss-art">${fishShadow('tuna')}</div><h2>${why === 'snap' ? '줄이 끊어졌어요!' : '놓쳤어요!'}</h2><p>${esc(msg)}</p><small>${R.practice ? '연습이라 미끼는 그대로예요. 다시 해 봐요!' : '미끼는 사라졌어요. 다음엔 꼭!'}</small>`, 'miss');
  }, 700);
}

// 안내의 '연습 판': 미끼를 쓰지 않고 서버에도 기록하지 않는다(물고기도 받지 않는다).
function practice() {
  closeTank();
  R.practice = true;
  dock();
  cue('<span class="rl-cue-tut"><small>연습 판</small><span>미끼를 쓰지 않아요. 아래 버튼을 <b>꾹</b> 눌렀다 떼서 던져요!</span></span>', 'tut', 3500);
}

/* ---------- ④ 마무리: 물고기가 뛰어오른다(슬로모션) → 고리가 맞을 때 탭 ---------- */
function finish() {
  offSwipe(); qte('');
  setPhase('finish');
  R.rig.spin = 0; R.rig.tBend = .9; stopStrain();
  const f = R.f, [x, y] = R.fishPx;
  $('rl-shadow').hidden = true;
  $('rl-world').classList.remove('shake');
  hud('', 'empty');
  cue('');
  const pov = $('rl-pov');
  fx('jump', x, y); sfx('reel-jump'); feel('jump');
  // 아직 어떤 물고기인지 모른다: 큰 실루엣이 뛰어오른다.
  pov.insertAdjacentHTML('beforeend', `<div class="rl-leap" id="rl-leap" style="--x:${x}px;--y:${y}px;--s:${R.live.fight.size || 1}"><div class="rl-leap-fish">${fishShadow('salmon')}</div><i class="rl-ring" id="rl-ring"></i></div>${reduced() ? '' : has('fx-speed') ? `<i class="rl-speed art">${art('fx-speed', '')}</i>` : '<i class="rl-speed"></i>'}`);
  pov.classList.add('slowmo');
  sfx('reel-creak', { rate: .7, gain: .5, at: .15 });
  $('rl-tuthand')?.remove();
  cue(R.tut ? '<span class="rl-cue-tut"><small>마지막!</small><span>노란 고리가 작아져 <b>물고기에 딱 맞을 때 탭!</b></span></span>' : '<span class="rl-cue-big now">고리가 맞을 때 <b>탭!</b></span>', R.tut ? 'tut' : 'now');
  const t0 = performance.now(), dur = R.tut ? 2000 : reduced() ? 1400 : 1250;
  if (R.tut && !R.practice && !R.v?.tut) { api('/reel/guide', { tutorial: true }).then(res => setView(res.reel)).catch(() => {}); }
  R.tut = null;
  let done = false;
  const end = kind => {
    if (done) return; done = true;
    pov.removeEventListener('pointerdown', tap);
    pov.classList.remove('slowmo');
    document.querySelector('.rl-speed')?.remove();
    cue('');
    const leap = $('rl-leap'); leap?.classList.add(kind);
    if (kind === 'perfect') { pop('퍼펙트!', 'perfect'); flash(); sfx('reel-hook', { gain: .7, rate: 1.1 }); sfx('reel-sparkle', { at: .05 }); feel('perfect'); }
    else if (kind === 'good') { pop('좋아요!', 'good'); sfx('reel-hook', { gain: .75 }); feel('good'); }
    else sfx('reel-plop', { rate: .85 });
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
  if (res?.practice) return later(() => { document.querySelector('.rl-leap')?.remove(); R.practice = false; result(`<h2>연습 끝! ${kind === 'perfect' ? '퍼펙트까지 완벽해요' : '잘했어요'}</h2><p>이제 진짜 미끼로 낚아 봐요. 첫 판은 이렇게 안내가 함께해요.</p>`, 'practice'); petFace('happy'); }, 500);
  later(() => { document.querySelector('.rl-leap')?.remove(); reveal(res, kind); }, reduced() ? 60 : 650);
}
async function land(result, finishKind = null, quiet = false) {
  if (!R?.live) return null;
  if (R.live.id === 'practice') { R.live = null; return { practice: true, result }; }
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
      <div class="rl-rev-top">${STAR(n)}<span class="fs-rarity">${esc(RARITY[res.rarity].name)}</span>${f.deep ? '<span class="rl-deep-chip">깊은 바다</span>' : ''}${res.perfect ? '<span class="rl-perfect-chip">퍼펙트 +8%</span>' : ''}</div>
      <h2>${esc(f.name)}</h2>
      <p class="rl-kg"><b id="rl-kg">0</b>${res.record ? `<span class="rl-ribbon">${art('ribbon-record', '')}<em>최고 무게!</em></span>` : ''}</p>
      ${res.key === 'goldenegg' ? `<p class="rl-gold">황금 알 물고기 ${res.egg ? `${REEL.GOLDEN_EGG}마리! 선물 상자에 알이 도착했어요!` : `${num(res.golden)} / ${REEL.GOLDEN_EGG} · 다 모으면 알 선물`}</p>` : `<p class="rl-pearls">${pearlIco()}진주 <b>${num(res.pearls)}</b>개 가치 · 수조에 넣었어요</p>`}
      ${againButtons()}
    </section>`;
  $('rl-pov').appendChild(box);
  hud('', 'empty');
  sfx('reel-splash', { rate: big ? .9 : 1 });
  sfx(res.rarity === 'legend' || res.rarity === 'golden' ? 'fanfare-legend' : res.rarity === 'epic' ? 'fanfare-epic' : res.rarity === 'rare' ? 'fanfare-basic' : 'correct', { at: .12 });
  feel(n >= 4 ? 'big' : 'caught');
  // 무게: 0에서 올라간다.
  const kgEl = box.querySelector('#rl-kg'), t0 = performance.now(), dur = reduced() ? 1 : 900;
  const tick = t => { if (!R || !kgEl.isConnected) return; const k = Math.min(1, (t - t0) / dur); kgEl.textContent = kgText(res.kg * (1 - (1 - k) ** 3)); if (k < 1) requestAnimationFrame(tick); else { kgEl.classList.add('done'); if (res.record) sfx('levelup', { gain: .5 }); } };
  later(() => requestAnimationFrame(tick), reduced() ? 0 : 700);
  if (res.fresh) later(() => { sfx('stamp', { gain: .8 }); feel('good'); }, reduced() ? 0 : 1300);
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
        p.className = 'rl-fly-pearl'; p.innerHTML = has('pearl-trail') ? art('pearl-trail', '') : pearlIco();
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
        <button type="button" class="rl-egg epic" data-rl="egg" data-item="epic_egg" ${v.epic_left && p >= REEL.EPIC_EGG ? '' : 'disabled'}><span class="rl-epic-egg"></span><b>영웅 알</b><small>${pearlIco()}${num(REEL.EPIC_EGG)} · ${v.epic_left ? '오늘 1개' : '내일 또'}</small></button>
      </div></div>
    <div class="rl-shop-block sea"><h3>바다 펫 <small>교환소에서만 만나요</small></h3>
      <div class="rl-sea-pets">${(v.sea || SEA_PETS).map(x => !REEL.SEA_READY
        ? `<div class="rl-sea-pet locked"><span class="rl-sea-silhouette ${x.key}"></span><b>${esc(x.ko)}</b><small>${esc(x.kind)} · ${pearlIco()}${num(REEL.SEA_PET)}</small><em>곧 만나요</em></div>`
        : `<button type="button" class="rl-sea-pet${x.owned ? ' owned' : ''}" data-rl="sea" data-key="${x.key}" ${x.owned || p < REEL.SEA_PET ? 'disabled' : ''}><img src="/assets/pets/${x.key}-1.webp" alt="" width="56" height="56"><b>${esc(x.ko)}</b><small>${esc(x.kind)} · ${pearlIco()}${num(REEL.SEA_PET)}</small>${x.owned ? '<em>함께하는 중</em>' : ''}</button>`).join('')}</div>
      <p class="rl-sheet-note">${REEL.SEA_READY ? '바다 펫은 교환소에서만 만날 수 있어요. 야차전 특기도 있어요!' : '바다 펫은 그림이 완성되면 열려요. 그때까지 진주를 모아 두세요!'}</p></div>`, 'shop');
}
// V13.154 낚싯대 강화 창: 지금 단계의 낚싯대 그림 · 5단계 줄 · 강화하면 좋아지는 것(지금 → 다음) · 진주로 강화.
function rodSheet() {
  closeTank();
  const v = R.v || {}, lv = rodLevel(v.rod), r = rodOf(lv), p = Number(v.pearls || 0), max = lv >= ROD.MAX, cost = ROD.COST[lv + 1], next = max ? null : rodOf(lv + 1);
  const show = art(lv > 1 ? `pov-rod-t${lv}` : 'pov-rod', art(`icon-rod-${lv}`, '<i class="rl-ico-rod big"></i>'), 'rl-rod-big');
  sheet(`${sheetHead(`${art(`icon-rod-${lv}`, '')} 낚싯대 강화`, `<span class="rl-sheet-pearl">${pearlIco()}${num(p)}</span>`)}
    <div class="rl-rod-card${has('bg-forge') ? ' art' : ''}" data-rod="${lv}">
      <div class="rl-rod-show">${show}<span class="rl-rod-stamp">${art('stamp-tier', '')}<b>${lv}</b></span></div>
      <h3>${esc(r.name)} <small>${lv} / ${ROD.MAX}단계</small></h3>
      <ol class="rl-rod-steps" aria-label="낚싯대 단계">${ROD.LEVELS.map(x => `<li class="${x.level < lv ? 'done' : x.level === lv ? 'now' : ''}">${art(`icon-rod-${x.level}`, `<i class="rl-ico-rod t${x.level}"></i>`)}<small>${x.level}</small></li>`).join('')}</ol>
    </div>
    <div class="rl-shop-block"><h3>강화하면 좋아지는 것 <small>${max ? '모두 최고예요' : `${esc(next.name)}이 되면`}</small></h3>
      <ul class="rl-perks">${rodPerks(lv).map(x => `<li><span>${x.label}</span><b>${x.now}</b>${x.next ? `<i aria-hidden="true">→</i><em>${x.next}</em>` : ''}</li>`).join('')}${v.deep?.ready ? `<li class="deep"><span>🌊 깊은 바다</span><b>${lv >= DEEP.MIN_ROD ? '열림' : `${num(DEEP.MIN_ROD)}단계에서 열려요`}</b></li>` : ''}</ul>
      <p class="rl-sheet-note">손맛은 그대로, 물고기를 끌어올리기가 조금씩 쉬워져요. 잡히는 물고기 등급은 바뀌지 않아요. 반 전체 낚시(교실 게임)는 모두 같은 낚싯대로 해요.</p>
      ${max ? '<p class="rl-rod-max">최고 단계 낚싯대예요! ✨</p>' : `<button type="button" class="yl-cta rl-rod-up" data-rl="rod-up" ${p >= cost ? '' : 'disabled'}>${pearlIco()} ${num(cost)} 진주로 강화하기</button>${p < cost ? `<p class="rl-sheet-note">진주 ${num(cost - p)}개를 더 모아요. 어망 물고기를 팔면 진주가 생겨요.</p>` : ''}`}
    </div>`, 'rod');
}
async function rodUp(b) {
  buttonBusy(b);
  try {
    const res = await api('/reel/rod', { from: myRod().level });
    setView(res.reel);
    paintRod();
    const sw = document.querySelector('.rl-spot'); if (sw) sw.outerHTML = spotSwitch();
    if (res.rod === DEEP.MIN_ROD && res.reel?.deep?.open) later(() => say('깊은 바다가 열렸어! 🌊', 2600), reduced() ? 900 : 2700);
    const ico = $('rl-rod-ico'); if (ico) ico.innerHTML = art(`icon-rod-${res.rod}`, '<i class="rl-ico-rod"></i>');
    // 강화 순간: 망치가 내려치고 → 빛이 터지며 새 낚싯대 · 단계 도장.
    const box = document.createElement('div');
    box.className = 'rl-rodup';
    box.innerHTML = `<div class="rl-rodup-in">${art('fx-upgrade', '<i class="rl-rodup-rays"></i>', 'rays')}${art(`icon-rod-${res.rod}`, '', 'rod')}<span class="rl-rodup-hammer">${art('fx-hammer', '🔨')}</span><span class="rl-rodup-stamp">${art('stamp-tier', '')}<b>${res.rod}</b></span><strong>${esc(res.name)}!</strong><small>${rodPerks(res.rod).slice(0, 2).map(x => `${x.label} ${x.now}`).join(' · ')}</small></div>`;
    (document.querySelector('.rl-sheet') || $('rl-pov'))?.appendChild(box);
    sfx('smash'); buzz(25);
    later(() => { sfx('levelup'); box.classList.add('lit'); }, reduced() ? 0 : 520);
    later(() => { box.remove(); rodSheet(); }, reduced() ? 900 : 2600);
  } catch (err) {
    toast(err.message); buttonBusy(b, false);
    // V13.157 이미 강화됐으면(응답을 못 받고 다시 누름) 지금 단계로 창을 다시 그린다.
    if (err.status === 409) api('/reel/guide', {}).then(res => { setView(res.reel); paintRod(); const ico = $('rl-rod-ico'); if (ico) ico.innerHTML = art(`icon-rod-${myRod().level}`, '<i class="rl-ico-rod"></i>'); rodSheet(); }).catch(() => {});
  }
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
  const byRarity = list => [...list].sort((a, b) => order.indexOf(FISH[a].rarity) - order.indexOf(FISH[b].rarity));
  // V13.185 심해 물고기는 그림이 들어온 것만 도감에 나온다(깊은 바다 칸으로 따로).
  const shore = byRarity(FISH_KEYS), deep = byRarity(deepReady()), keys = [...shore, ...deep];
  const got = keys.filter(k => mine[k]?.n).length;
  const slot = k => { const m = mine[k], f = FISH[k];
    return m?.n ? `<div class="fs-slot r-${f.rarity}">${STAR(stars(f.rarity))}${fishPic(k)}<b>${esc(f.name)}</b><small>최고 ${kgText(m.kg)} · ${num(m.n)}마리</small></div>`
      : `<div class="fs-slot unknown r-${f.rarity}">${STAR(stars(f.rarity))}${fishShadow(k)}<b>???</b><small>${esc(RARITY[f.rarity].name)}</small></div>`; };
  sheet(`${sheetHead(`물고기 도감 <small>${num(got)} / ${keys.length}</small>`)}
    <div class="fs-book-bar"><i style="width:${Math.round(got / keys.length * 100)}%"></i></div>
    <div class="fs-tank">${shore.map(slot).join('')}</div>
    ${deep.length ? `<h3 class="rl-book-deep">🌊 깊은 바다 <small>${num(deep.filter(k => mine[k]?.n).length)} / ${num(deep.length)} · 낚싯대 ${num(DEEP.MIN_ROD)}단계부터</small></h3><div class="fs-tank deep">${deep.map(slot).join('')}</div>` : ''}`, 'book');
}
// 처음 들어오면 한 번(그 뒤에는 ? 버튼).
function guide(first) {
  sheet(`${sheetHead('낚시터에 온 걸 환영해요!')}
    <ol class="rl-guide">
      <li><b>미끼로 낚아요</b><p>공부하면 미끼를 받아요 <em>(하루 최대 ${REEL.BAIT_DAILY}개)</em>. 연습을 끝까지 풀면(10문제 이상) 1개, 짝 맞추기 별 3개면 1개, 출석하면 1개. 미끼 1개로 한 번 던져요. 놓치면 미끼는 사라져요.</p></li>
      <li><b>던지고 · 챔질</b><p>아래 버튼을 <b>꾹</b> 눌러 반원 게이지가 <b>금색</b>일 때 떼면 퍼펙트(귀한 물고기가 더 잘 와요). 찌가 <b>톡톡</b>하는 건 가짜! <b>쑥</b> 들어가면 바로 탭!</p></li>
      <li><b>손맛 파이팅</b><p>릴 버튼을 <b>꾹</b> 누르면 감겨요. 고리가 <b>빨간색</b>이면 손을 떼요(줄이 끊어져요).
        <span class="rl-guide-moves"><span><b>탈출 시도</b>◀ ▶ 번갈아 연타</span><span><b>리듬</b>노트 맞춰 톡</span><span><b>날뜀</b>손 떼기</span><span><b>잠수</b>꾹 버티기</span></span>
        펫 특기 구슬이 차면 <b>위로 쓸어 올려</b> 한 번에 끌어와요. 물고기가 뛰어오르면 고리가 맞을 때 탭 → 퍼펙트(무게 +8%)!</p></li>
      <li><b>물고기를 진주로</b><p>낚은 물고기는 <b>수조</b>에서 헤엄쳐요. 팔면 진주가 돼요. 팔아도 도감 기록은 남아요.</p>
        <div class="rl-guide-table">${['common', 'uncommon', 'rare', 'epic', 'legend'].map(r => `<span>${STAR(stars(r))}<b>${esc(RARITY[r].name)}</b><em>${num(REEL.PEARLS[r])}</em></span>`).join('')}</div></li>
      ${R.v?.deep?.ready ? `<li><b>🌊 깊은 바다</b><p>낚싯대를 <b>${num(DEEP.MIN_ROD)}단계</b>로 강화하면 깊은 바다에서 낚을 수 있어요. 희귀 · 영웅 · 전설 물고기가 <b>심해 물고기</b>로 바뀌어요(진주 값은 같아요).</p></li>` : ''}
      <li><b>진주로 바꿀 수 있는 것</b>
        <ul><li>${coin()} <b>코인</b>: 진주 1개 = 1코인 (하루 ${num(REEL.COIN_DAILY)}코인까지)</li><li><b>랜덤 알</b>: 진주 ${num(REEL.EGG)}개 (하루 1개)</li><li><b>영웅 알</b>: 진주 ${num(REEL.EPIC_EGG)}개 (하루 1개)</li><li><b>바다 펫</b>: 진주 ${num(REEL.SEA_PET)}개 · 교환소에서만 만나요!</li><li><b>황금 알 물고기</b>는 팔지 않고 모아요. ${REEL.GOLDEN_EGG}마리면 알 선물!</li></ul></li>
    </ol>
    <button type="button" class="yl-cta" data-rl="close-sheet">알겠어요!</button>
    <button type="button" class="btn full rl-practice-btn" data-rl="practice">미끼 없이 연습 판 해 보기</button>`, 'guide');
  if (first) api('/reel/guide', {}).then(res => setView(res.reel)).catch(() => {});
}
