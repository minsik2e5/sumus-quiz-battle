import { api, esc, num, icon, toast, buttonBusy } from './ui.js';
import { avatar } from './character.js';
import { coin } from './emblems.js';
import { playSound, unlockSound, soundOn, preloadSound } from './sound.js';
import { coinShower } from './celebrate.js';
import { buyEgg } from './pet-moments.js';
import { FISH, FISH_KEYS, RARITY, kgText } from './fishing-rules.js';
import { REEL, SEA_PETS, stars, pearlsOf } from './reel-rules.js';
import { fishPic, fishShadow } from './fishing-art.js';

// V13.150 손맛 낚시(놀이터): 단어 없이 던지기 · 입질 · 파이팅. 미끼는 공부로 번다(server/reel.mjs).
// 그림(주문서 26 · 27)이 들어오면 FISHING_ART에 이름을 넣어 코드 그림 대신 쓴다.
// V13.149 그림 27(public/assets/fishing · fish/<key>-hang.webp)이 들어왔다.
export const FISHING_ART = new Set([
  'bait-can', 'bg-entry', 'bg-sea', 'bg-under', 'bobber', 'bobber-bite', 'btn-cast', 'btn-left', 'btn-reel', 'btn-right', 'fx-perfect', 'fx-ripple', 'fx-splash', 'fx-star', 'hook', 'line-snap', 'lure-gold', 'lure-shrimp', 'lure-spinner', 'lure-worm', 'net', 'pearl', 'power', 'reel', 'rod', 'rod-bend1', 'rod-bend2', 'shop', 'skill-empty', 'skill-full', 'tension',
  ...FISH_KEYS.map(k => `hang-${k}`)
]);
const art = (name, fallback) => FISHING_ART.has(name) ? `<img class="rl-art rl-art-${name}" src="/assets/fishing/${name}.webp" alt="" draggable="false">` : fallback;

let R = null;
const root = () => document.getElementById('app');
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)');
const reduced = () => REDUCED.matches;
const sfx = (key, opts) => { if (soundOn()) playSound(key, opts); };
const buzz = p => { try { if (soundOn()) navigator.vibrate?.(p); } catch {} };
function later(fn, ms) { const cur = R; const t = setTimeout(() => { if (R === cur && !cur.closing) fn(); }, ms); cur.timers.push(t); return t; }
const STAR = n => `<span class="rl-stars" aria-label="별 ${n}개">${'★'.repeat(n)}<s>${'★'.repeat(5 - n)}</s></span>`;

export function openReel(A, exit) {
  closeAll();
  R = { A, exit, timers: [], v: A.data.rewards?.reel || null, phase: 'dock' };
  A.screen = 'reel';
  root().innerHTML = `<div class="session-app rl-app"><header class="rl-top"><button type="button" class="yb-back" data-rl="exit" aria-label="나가기">${icon('back')}</button><strong>낚시터</strong>
    <span class="rl-chip bait" id="rl-bait" aria-label="미끼">🪱 <b>0</b></span><span class="rl-chip pearl" id="rl-pearl" aria-label="진주">${art('pearl', '<i class="rl-pearl-ico"></i>')}<b>0</b></span><button type="button" class="rl-q" data-rl="guide" aria-label="낚시터 안내">?</button></header>
    <main id="rl-main" class="rl-main"></main></div>`;
  root().onclick = onClick;
  window.scrollTo(0, 0);
  preloadSound(['fanfare-basic', 'fanfare-epic', 'fanfare-legend', 'crit', 'coins', 'fail']);
  chips();
  dock();
  if (R.v && !R.v.guide) later(() => guide(true), 300);
}
function closeAll() { if (!R) return; R.closing = true; R.timers.forEach(clearTimeout); cancelAnimationFrame(R.raf); clearInterval(R.osc); }
async function leave() {
  if (R?.phase === 'fight' || R?.phase === 'wait') { if (!confirm('낚시를 그만둘까요? 던진 미끼는 사라져요.')) return; await land('lost', true); }
  const exit = R?.exit; closeAll(); root().onclick = null; R = null; await exit?.();
}
const main = html => { const el = document.getElementById('rl-main'); if (el) el.innerHTML = html; };
function chips() {
  const v = R.v || {};
  const b = document.querySelector('#rl-bait b'), p = document.querySelector('#rl-pearl b');
  if (b) b.textContent = num(v.bait || 0);
  if (p) p.textContent = num(v.pearls || 0);
}
const setView = v => { if (!v || !R) return; R.v = v; R.A.data.rewards ||= {}; R.A.data.rewards.reel = v; chips(); };

function onClick(event) {
  const b = event.target.closest('[data-rl]');
  if (!b || b.disabled || !R) return;
  unlockSound();
  const act = b.dataset.rl;
  if (act === 'exit') return leave();
  if (act === 'guide') return guide(false);
  if (act === 'net') return net();
  if (act === 'shop') return shop();
  if (act === 'book') return book();
  if (act === 'dock') { closeSheet(); return dock(); }
  if (act === 'close-sheet') return closeSheet();
  if (act === 'sell-all') return sell(null, b);
  if (act === 'sell') return sell(b.dataset.key, b);
  if (act === 'coins') return exchangeCoins(Number(b.dataset.n), b);
  if (act === 'egg') return exchangeEgg(b.dataset.item, b);
  if (act === 'skill') return useSkill();
}

/* ---------- 바다 장면 ---------- */
function seaScene(inner = '') {
  const pet = R.A.data.stats?.pet;
  return `<div class="rl-sea${FISHING_ART.has('bg-sea') ? ' art' : ''}" id="rl-sea">
    ${art('bg-sea', '<div class="rl-sky"><i class="rl-sun"></i><i class="rl-cloud a"></i><i class="rl-cloud b"></i><i class="rl-isle"></i></div><div class="rl-water"><i class="rl-wave w1"></i><i class="rl-wave w2"></i><i class="rl-wave w3"></i></div>')}
    <div class="rl-pier"><div class="rl-pet" id="rl-pet">${pet ? avatar(pet.key, { form: Math.max(1, pet.form ?? 1) }) : ''}</div><i class="rl-plank"></i>${art('rod', '<i class="rl-rod" id="rl-rod"></i>')}</div>
    <svg class="rl-line" aria-hidden="true"><path id="rl-line-path" d=""/></svg>
    <div class="rl-bob" id="rl-bob">${art('bobber', '<i></i>')}</div>
    ${inner}
  </div>`;
}
function dock() {
  R.phase = 'dock';
  const v = R.v || {};
  const can = Number(v.bait || 0) > 0;
  main(`${seaScene(`<section class="rl-panel rl-dock">
    <div class="rl-dock-bait"><b>🪱 미끼 ${num(v.bait || 0)}개</b><small>오늘 받은 미끼 ${num(v.bait_today || 0)} / ${num(v.bait_daily || REEL.BAIT_DAILY)}</small></div>
    ${can ? '<p class="rl-hint">버튼을 <b>꾹 누르고</b> 게이지가 <b>금색 칸</b>일 때 떼면 퍼펙트!</p>' : '<p class="rl-hint">미끼가 없어요. <b>연습을 끝까지 풀거나(10문제+), 짝 맞추기 별 3개, 출석</b>하면 미끼를 받아요.</p>'}
    <div class="rl-cast-wrap"><button type="button" class="rl-cast" id="rl-cast" ${can ? '' : 'disabled'}>${art('btn-cast', '<span class="rl-cast-ico">🎣</span>')}<span>${can ? '꾹 눌러 던지기' : '미끼가 없어요'}</span></button>
      <div class="rl-power" id="rl-power" aria-hidden="true">${art('power', '')}<i class="perfect"></i><i class="needle" id="rl-needle"></i></div></div>
    <div class="rl-dock-row">
      <button type="button" class="rl-tile" data-rl="net">${art('net', '<span>🧺</span>')}<b>어망</b><small>${num(Object.values(v.net || {}).reduce((a, b) => a + b, 0))}마리 · 진주 ${num(v.net_pearls || 0)}</small></button>
      <button type="button" class="rl-tile" data-rl="shop">${art('shop', '<span>🏪</span>')}<b>교환소</b><small>코인 · 알 · 바다 펫</small></button>
      <button type="button" class="rl-tile" data-rl="book">${art('book', '<span>📖</span>')}<b>도감</b><small>${num(v.kinds || 0)} / ${num(v.all || FISH_KEYS.length)}</small></button>
    </div>
  </section>`)}`);
  setLine('rest');
  bindCast();
}

/* ---------- ① 던지기: 꾹 누르면 게이지가 오르내리고, 떼는 순간의 힘 ---------- */
function bindCast() {
  const btn = document.getElementById('rl-cast'), needle = document.getElementById('rl-needle'), power = document.getElementById('rl-power');
  if (!btn || btn.disabled) return;
  let t0 = 0, holding = false;
  const level = () => (1 - Math.cos((performance.now() - t0) / 1100 * Math.PI * 2)) / 2; // 0 → 1 → 0, 1.1초에 한 번
  const loop = () => { if (!holding || !R) return; const k = level(); needle.style.transform = `translateY(${(1 - k) * 100}%)`; power.dataset.zone = zoneOf(k); R.raf = requestAnimationFrame(loop); };
  btn.onpointerdown = e => { e.preventDefault(); if (holding) return; holding = true; t0 = performance.now(); power.classList.add('on'); btn.classList.add('hold'); sfx('tick', { gain: .4 }); loop(); };
  const release = e => { if (!holding) return; e?.preventDefault?.(); holding = false; cancelAnimationFrame(R.raf); btn.classList.remove('hold'); cast(level()); };
  btn.onpointerup = release; btn.onpointerleave = release; btn.onpointercancel = release;
}
const zoneOf = k => k >= .86 && k <= .97 ? 'perfect' : k >= .62 ? 'good' : 'ok';
async function cast(k) {
  const tier = zoneOf(k), btn = document.getElementById('rl-cast');
  if (btn) btn.disabled = true;
  R.phase = 'cast';
  let res;
  try { res = await api('/reel/cast', { cast: tier }); }
  catch (err) { toast(err.message); if (R) dock(); return; }
  if (!R) return;
  setView(res.reel);
  R.live = { id: res.id, fight: res.fight, tier, at: performance.now(), minMs: Number(res.fight.min || 0) };
  if (tier === 'perfect') { burst('퍼펙트!', 'perfect'); sfx('crit', { rate: 1.2 }); buzz(40); }
  else if (tier === 'good') burst('좋아요!', 'good');
  document.getElementById('rl-pet')?.classList.add('casting');
  sfx('slash', { rate: 1.3, gain: .6 });
  const dist = .35 + k * .5;
  R.bob = { x: 30 + dist * 60, y: 50 + (1 - k) * 18 };
  setLine('fly');
  document.querySelector('.rl-dock')?.classList.add('away');
  later(() => { setLine('float'); splash(R.bob.x, R.bob.y, 'small'); sfx('pop', { rate: .7, gain: .5 }); document.getElementById('rl-pet')?.classList.remove('casting'); waitBite(); }, reduced() ? 60 : 560);
}

/* ---------- ② 입질: 가짜 톡톡 몇 번 뒤 진짜 쏙! 0.8초 안에 탭 ---------- */
function waitBite() {
  R.phase = 'wait';
  const sea = document.getElementById('rl-sea');
  sea.insertAdjacentHTML('beforeend', '<div class="rl-tap-layer" id="rl-tap"><p class="rl-wait-msg">찌를 잘 보세요… <b>쏙!</b> 들어가면 화면을 탭!</p></div>');
  const layer = document.getElementById('rl-tap');
  R.early = 0;
  const nibbles = 1 + Math.floor(Math.random() * 3);
  let at = 900;
  for (let i = 0; i < nibbles; i++) { at += 700 + Math.random() * 900; later(() => { if (R.phase !== 'wait') return; setLine('nibble'); sfx('tick', { gain: .25, rate: 1.4 }); later(() => R.phase === 'wait' && setLine('float'), 260); }, at); }
  at += 900 + Math.random() * 1400;
  later(bite, at);
  layer.onpointerdown = e => {
    e.preventDefault();
    if (R.phase === 'bite') return hooked();
    if (R.phase !== 'wait') return;
    R.early++;
    if (R.early >= 2) return missed('너무 일찍 당겨서 물고기가 놀라 도망갔어요');
    burst('아직이에요!', 'warn'); sfx('warn-beep', { gain: .5 });
  };
}
function bite() {
  if (R.phase !== 'wait') return;
  R.phase = 'bite';
  setLine('bite'); splash(R.bob.x, R.bob.y, 'bite');
  sfx('warn-beep', { rate: 1.5 }); buzz([70, 30, 70]);
  document.querySelector('.rl-wait-msg')?.replaceWith(Object.assign(document.createElement('p'), { className: 'rl-bite-msg', innerHTML: '<b>지금!</b> 탭!' }));
  R.biteAt = performance.now();
  later(() => { if (R.phase === 'bite') missed('입질을 놓쳤어요. 조금 더 빨리!'); }, 800);
}
function hooked() {
  R.phase = 'hooked';
  const fast = performance.now() - R.biteAt < 350;
  burst(fast ? '훅 성공! 번개 같아요' : '훅 성공!', 'good'); sfx('hit', { rate: 1.1 }); buzz(fast ? [40, 30, 90] : 60);
  later(fight, reduced() ? 100 : 650);
}
async function missed(msg) {
  R.phase = 'missed';
  setLine('gone'); sfx('fail', { gain: .6 });
  await land('lost');
  if (!R) return;
  const sea = document.getElementById('rl-sea');
  document.getElementById('rl-tap')?.remove();
  sea?.insertAdjacentHTML('beforeend', `<section class="rl-panel rl-result miss"><div class="rl-miss-art">${fishShadow('carp')}</div><h2>놓쳤어요!</h2><p>${esc(msg)}</p><small>미끼는 사라졌어요.</small>${againButtons()}</section>`);
}

/* ---------- ③ 파이팅: 꾹 누르면 감고(텐션↑), 떼면 풀고(텐션↓). 초록 칸에서 감을 때 물고기 체력이 준다.
   물고기가 한쪽으로 돌진하면 반대쪽 버튼 연타! 잘 버티면 펫 특기 구슬이 차서 한 번에 끌어올린다. ---------- */
function fight() {
  R.phase = 'fight';
  const F = R.live.fight;
  R.f = { hp: F.hp, max: F.hp, tension: 40, x: 50, dir: 1, dash: null, nextDash: performance.now() + rnd(F.dash), redFor: 0, slackFor: 0, skill: 0, holding: false, last: performance.now(), start: performance.now(), clickAt: 0 };
  const pet = R.A.data.stats?.pet;
  main(`<div class="rl-under${FISHING_ART.has('bg-under') ? ' art' : ''}" id="rl-under">
    ${art('bg-under', '<i class="rl-rays"></i><i class="rl-sand"></i><i class="rl-coral a"></i><i class="rl-coral b"></i>')}
    <div class="rl-bubbles" aria-hidden="true">${Array.from({ length: 10 }, (_, i) => `<i style="--x:${5 + i * 9.5}%;--d:${3 + (i % 4)}s;--delay:${-i * .7}s"></i>`).join('')}</div>
    <svg class="rl-fline" aria-hidden="true"><line id="rl-fline" x1="50%" y1="0" x2="50%" y2="50%"/></svg>
    <div class="rl-fish" id="rl-fish" style="--s:${F.size}">${fishShadow('tuna')}</div>
    <div class="rl-dash" id="rl-dash" aria-live="assertive"></div>
    <div class="rl-hud">
      <div class="rl-hp"><small>물고기 힘</small><span><i id="rl-hp"></i></span></div>
      <div class="rl-tension" id="rl-tension-box">${art('tension', '')}<small>줄 텐션</small><span><b class="z blue"></b><b class="z green"></b><b class="z red"></b><i id="rl-tension"></i></span></div>
    </div>
    <button type="button" class="rl-skill" id="rl-skill" data-rl="skill" disabled aria-label="펫 특기">${pet ? avatar(pet.key, { form: Math.max(1, pet.form ?? 1), size: 'mini' }) : ''}<svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="18"/><circle class="v" id="rl-skill-ring" cx="20" cy="20" r="18"/></svg></button>
    <div class="rl-controls">
      <button type="button" class="rl-side left" id="rl-left" aria-label="왼쪽으로 버티기">${art('btn-left', '◀')}</button>
      <button type="button" class="rl-reel" id="rl-reel" aria-label="꾹 눌러 감기">${art('btn-reel', '<span class="rl-reel-ico"></span>')}<small>꾹 눌러 감기</small></button>
      <button type="button" class="rl-side right" id="rl-right" aria-label="오른쪽으로 버티기">${art('btn-right', '▶')}</button>
    </div>
  </div>`);
  const reel = document.getElementById('rl-reel');
  reel.onpointerdown = e => { e.preventDefault(); R.f.holding = true; reel.classList.add('hold'); };
  const up = e => { e?.preventDefault?.(); if (R?.f) R.f.holding = false; reel.classList.remove('hold'); };
  reel.onpointerup = up; reel.onpointerleave = up; reel.onpointercancel = up;
  for (const side of ['left', 'right']) {
    const b = document.getElementById('rl-' + side);
    b.onpointerdown = e => { e.preventDefault(); mash(side, b); };
  }
  R.raf = requestAnimationFrame(step);
}
const rnd = ([a, b]) => a + Math.random() * (b - a);
function step(t) {
  const f = R?.f;
  if (!f || R.phase !== 'fight') return;
  const dt = Math.min(.05, (t - f.last) / 1000); f.last = t;
  const F = R.live.fight;
  // 텐션
  f.tension += f.holding ? (52 + F.pull * 22) * dt : -46 * dt;
  f.tension += F.pull * (Math.sin(t / 340) * 9 + Math.sin(t / 97) * 5) * dt;
  if (f.dash) {
    f.tension += F.pull * 40 * dt;
    if (t > f.dash.until) endDash(false);
  } else if (t > f.nextDash) startDash(t);
  f.tension = Math.max(0, Math.min(100, f.tension));
  const zone = f.tension >= 80 ? 'red' : f.tension >= 25 ? 'green' : 'blue';
  // 체력 · 특기
  if (f.holding) f.hp -= (zone === 'green' ? 26 : zone === 'blue' ? 8 : 0) * dt;
  if (zone === 'green' && f.holding) f.skill = Math.min(100, f.skill + 9 * dt);
  // 실패 조건
  f.redFor = f.tension >= 99 ? f.redFor + dt : 0;
  f.slackFor = f.tension <= 3 ? f.slackFor + dt : 0;
  if (f.redFor > 1.0) return lose('줄이 끊어졌어요! 빨간 칸에서는 손을 떼요');
  if (f.slackFor > 3) return lose('줄이 느슨해져서 물고기가 빠져나갔어요');
  // 물고기 움직임
  const target = f.dash ? (f.dash.dir < 0 ? 12 : 88) : 50 + Math.sin(t / 900) * 22;
  f.x += (target - f.x) * Math.min(1, dt * (f.dash ? 3.5 : 1.2));
  draw(t, zone);
  // 손맛: 감는 소리 · 빨간 칸 진동
  if (f.holding && t - f.clickAt > 110 - Math.min(60, f.tension * .5)) { f.clickAt = t; sfx('type-key', { rate: .8 + f.tension / 120, gain: .35 }); }
  if (zone === 'red' && Math.floor(t / 280) !== f.buzzTick) { f.buzzTick = Math.floor(t / 280); buzz(35); }
  if (f.hp <= 0) return win();
  R.raf = requestAnimationFrame(step);
}
function draw(t, zone) {
  const f = R.f;
  const fish = document.getElementById('rl-fish'), line = document.getElementById('rl-fline');
  const y = 46 + Math.sin(t / 420) * 4;
  fish.style.left = `${f.x}%`; fish.style.top = `${y}%`;
  fish.classList.toggle('flip', (f.dash ? f.dash.dir : Math.cos(t / 900)) < 0);
  line.setAttribute('x2', `${f.x}%`); line.setAttribute('y2', `${y}%`); line.setAttribute('class', zone);
  document.getElementById('rl-tension').style.left = `${f.tension}%`;
  document.getElementById('rl-tension-box').dataset.zone = zone;
  document.getElementById('rl-hp').style.transform = `scaleX(${Math.max(0, f.hp / f.max)})`;
  const ring = document.getElementById('rl-skill-ring'), skill = document.getElementById('rl-skill');
  ring.style.strokeDashoffset = `${113 * (1 - f.skill / 100)}`;
  if (f.skill >= 100 && skill.disabled) { skill.disabled = false; skill.classList.add('full'); sfx('skill'); buzz(30); }
  document.getElementById('rl-under').classList.toggle('shake', zone === 'red' && !reduced());
}
function startDash(t) {
  const dir = Math.random() < .5 ? -1 : 1;
  R.f.dash = { dir, until: t + 1700, taps: 0 };
  const box = document.getElementById('rl-dash');
  box.innerHTML = `<span class="${dir < 0 ? 'l' : 'r'}">${dir < 0 ? '◀◀ 왼쪽으로 돌진!' : '돌진! ▶▶'}<small>${dir < 0 ? '오른쪽' : '왼쪽'} 버튼 연타!</small></span>`;
  document.getElementById(dir < 0 ? 'rl-right' : 'rl-left')?.classList.add('need');
  sfx('slash', { rate: .8, gain: .7 }); buzz([50, 40, 50]);
}
function mash(side, b) {
  const f = R?.f;
  if (!f || R.phase !== 'fight') return;
  b.classList.remove('tap'); void b.offsetWidth; b.classList.add('tap');
  if (!f.dash) { f.tension = Math.max(0, f.tension - 1.5); return; }
  const right = (f.dash.dir < 0 && side === 'right') || (f.dash.dir > 0 && side === 'left');
  if (!right) { f.tension += 4; sfx('type-wrong', { gain: .4 }); return; }
  f.dash.taps++; f.tension = Math.max(0, f.tension - 7); f.hp -= 2;
  sfx('type-ok', { rate: 1 + f.dash.taps * .06, gain: .5 }); buzz(12);
  if (f.dash.taps >= 6) endDash(true);
}
function endDash(blocked) {
  const f = R.f;
  document.querySelectorAll('.rl-side.need').forEach(x => x.classList.remove('need'));
  const box = document.getElementById('rl-dash');
  if (box) box.innerHTML = blocked ? '<span class="ok">버텼다! 특기 +</span>' : '';
  if (blocked) { f.skill = Math.min(100, f.skill + 18); f.hp -= 8; sfx('shield-block', { gain: .6 }); }
  later(() => { const b2 = document.getElementById('rl-dash'); if (b2 && !R.f?.dash) b2.innerHTML = ''; }, 700);
  f.dash = null;
  f.nextDash = performance.now() + rnd(R.live.fight.dash);
}
function useSkill() {
  const f = R?.f;
  if (!f || f.skill < 100 || R.phase !== 'fight') return;
  f.skill = 0; f.hp -= f.max * .3; f.tension = 50;
  const skill = document.getElementById('rl-skill'); skill.disabled = true; skill.classList.remove('full');
  const under = document.getElementById('rl-under');
  under.insertAdjacentHTML('beforeend', '<div class="rl-cutin"><b>펫 특기!</b><span>한 번에 끌어올리기</span></div>');
  later(() => under.querySelector('.rl-cutin')?.remove(), 1100);
  sfx('crit'); buzz([30, 30, 120]);
}
async function lose(msg) {
  R.phase = 'lost';
  cancelAnimationFrame(R.raf);
  sfx('fail'); buzz([80, 40, 80]);
  document.getElementById('rl-fish')?.classList.add('flee');
  await land('lost');
  if (!R) return;
  later(() => { main(`${seaScene(`<section class="rl-panel rl-result miss"><div class="rl-miss-art">${fishShadow('tuna')}</div><h2>놓쳤어요!</h2><p>${esc(msg)}</p><small>미끼는 사라졌어요. 다음엔 꼭!</small>${againButtons()}</section>`)}`); setLine('gone'); }, 700);
}
async function win() {
  R.phase = 'landing';
  cancelAnimationFrame(R.raf);
  sfx('combo'); buzz([40, 30, 40, 30, 120]);
  document.getElementById('rl-under')?.insertAdjacentHTML('beforeend', '<div class="rl-cutin up"><b>끌어올려!</b></div>');
  // 서버가 보는 최소 파이팅 시간보다 빨리 끝났으면 끌어올리는 연출로 채운다.
  const wait = Math.max(0, (R.live.minMs || 0) - (performance.now() - R.live.at));
  const res = await land('caught');
  if (!R) return;
  later(() => reveal(res), Math.max(reduced() ? 100 : 900, wait));
}
async function land(result, quiet = false) {
  if (!R?.live) return null;
  const id = R.live.id;
  for (let i = 0; i < 3; i++) {
    try { const res = await api('/reel/land', { id, result }); if (!R) return res; setView(res.reel); if (res.gifts) R.A.data.gifts = res.gifts; R.live = null; return res; }
    catch (err) { if (!err.transient || i === 2) { if (!quiet) toast(err.message); return null; } await new Promise(r => setTimeout(r, 600)); }
  }
  return null;
}

/* ---------- ④ 공개: 물고기가 줄에 매달려 올라온다 ---------- */
function reveal(res) {
  R.phase = 'reveal';
  if (!res?.caught) return main(`${seaScene(`<section class="rl-panel rl-result miss"><h2>아슬아슬하게 놓쳤어요</h2><p>${res?.reason === 'short' ? '너무 빨리 끌어올려서 줄이 풀렸어요.' : '연결을 확인해 주세요.'}</p>${againButtons()}</section>`)}`);
  const f = FISH[res.key], n = stars(res.rarity), big = n >= 4;
  const hang = FISHING_ART.has(`hang-${res.key}`) ? `<img class="rl-hang-img" src="/assets/fish/${res.key}-hang.webp" alt="${esc(f.name)}">` : `<span class="rl-hang-svg">${fishPic(res.key)}</span>`;
  main(`<div class="rl-reveal r-${res.rarity}${big ? ' big' : ''}">
    ${big ? '<i class="rl-rays-out" aria-hidden="true"></i>' : ''}
    <div class="rl-hang"><i class="rl-hang-line"></i>${hang}<i class="rl-drops"></i></div>
    <section class="rl-panel rl-card">
      ${STAR(n)}<span class="fs-rarity">${esc(RARITY[res.rarity].name)}</span>${res.fresh ? '<span class="fs-new">새로 발견!</span>' : ''}${res.record ? '<span class="fs-new">최고 무게!</span>' : ''}
      <h2>${esc(f.name)}</h2>
      <p class="rl-kg">${kgText(res.kg)}</p>
      ${res.key === 'goldenegg' ? `<p class="rl-gold">🥚 황금 알 물고기 ${res.egg ? '3마리! 선물 상자에 알이 도착했어요!' : `${num(res.golden)} / ${REEL.GOLDEN_EGG} · 다 모으면 알 선물`}</p>` : `<p class="rl-pearls">${art('pearl', '<i class="rl-pearl-ico"></i>')}진주 <b>${num(res.pearls)}</b>개 가치 · 어망에 넣었어요</p>`}
      ${againButtons()}
    </section>
  </div>`);
  sfx(res.rarity === 'legend' || res.rarity === 'golden' ? 'fanfare-legend' : res.rarity === 'epic' ? 'fanfare-epic' : res.rarity === 'rare' ? 'fanfare-basic' : 'correct');
  if (big) coinShower(document.querySelector('.rl-reveal'), res.rarity === 'epic' ? 12 : 24);
}
const againButtons = () => `<div class="rl-again"><button type="button" class="yl-cta" data-rl="dock" ${(R.v?.bait || 0) > 0 ? '' : ''}>${(R.v?.bait || 0) > 0 ? `다시 던지기 · 미끼 ${num(R.v.bait)}` : '낚시터로'}</button><button type="button" class="btn full" data-rl="net">어망 보기</button></div>`;

/* ---------- 낚싯줄 · 찌 · 효과 ---------- */
function setLine(state) {
  const sea = document.getElementById('rl-sea'), path = document.getElementById('rl-line-path'), bob = document.getElementById('rl-bob'), rod = document.getElementById('rl-rod') || sea?.querySelector('.rl-art-rod');
  if (!sea || !path || !bob || !rod) return;
  const S = sea.getBoundingClientRect(), Rr = rod.getBoundingClientRect();
  const tx = Rr.right - S.left, ty = Rr.top - S.top;
  const b = R.bob || { x: 60, y: 60 };
  const bx = S.width * b.x / 100, by = S.height * b.y / 100;
  bob.className = `rl-bob ${state}`;
  bob.style.left = `${bx}px`; bob.style.top = `${by}px`;
  if (state === 'rest' || state === 'gone') { path.setAttribute('d', `M${tx},${ty} q3,40 1,${S.height * .1}`); return; }
  const sag = state === 'bite' ? 6 : 38;
  path.setAttribute('d', `M${tx},${ty} Q${(tx + bx) / 2},${Math.max(ty, by) + sag} ${bx},${by}`);
}
function splash(x, y, size) {
  const sea = document.getElementById('rl-sea');
  if (!sea || reduced()) return;
  const s = document.createElement('div');
  s.className = `fs-splash ${size === 'bite' ? 'big' : size}`;
  s.style.left = `${x}%`; s.style.top = `${y}%`;
  s.innerHTML = '<i></i><i></i><i></i>' + Array.from({ length: size === 'small' ? 5 : 9 }, (_, k) => `<b style="--a:${-160 + k * 18}deg;--r:${size === 'small' ? 22 : 40}px"></b>`).join('');
  sea.appendChild(s);
  setTimeout(() => s.remove(), 1100);
}
function burst(text, cls) {
  const host = document.querySelector('#rl-sea, #rl-under');
  if (!host) return;
  const el = document.createElement('div');
  el.className = `rl-burst ${cls}`;
  el.innerHTML = `${cls === 'perfect' ? art('fx-perfect', '') : ''}<b>${esc(text)}</b>`;
  host.appendChild(el);
  setTimeout(() => el.remove(), 1100);
}

/* ---------- 어망 · 교환소 · 도감 · 안내 (아래에서 올라오는 창) ---------- */
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
function net() {
  const v = R.v || {}, entries = Object.entries(v.net || {}).sort((a, b) => pearlsOf(b[0]) - pearlsOf(a[0]));
  sheet(`${sheetHead('🧺 어망', `<span class="rl-sheet-pearl">${art('pearl', '<i class="rl-pearl-ico"></i>')}${num(v.pearls || 0)}</span>`)}
    <p class="rl-sheet-note">물고기를 팔면 진주가 돼요. 팔아도 도감 기록은 남아요.</p>
    ${entries.length ? `<div class="rl-net">${entries.map(([k, n]) => `<div class="rl-net-row r-${FISH[k].rarity}"><span class="rl-net-pic">${fishPic(k)}</span><span class="rl-net-name"><b>${esc(FISH[k].name)}</b><small>${STAR(stars(FISH[k].rarity))} · ×${num(n)}</small></span><button type="button" class="btn small" data-rl="sell" data-key="${k}">팔기 ${art('pearl', '<i class="rl-pearl-ico"></i>')}${num(pearlsOf(k) * n)}</button></div>`).join('')}</div>
      <button type="button" class="yl-cta" data-rl="sell-all">모두 팔기 · 진주 +${num(v.net_pearls || 0)}</button>` : '<p class="yb-muted rl-empty">어망이 비었어요. 낚시하러 가요!</p>'}
    <button type="button" class="btn full" data-rl="shop">교환소 가기</button>`, 'net');
}
async function sell(key, b) {
  buttonBusy(b);
  try {
    const res = await api('/reel/sell', key ? { key } : {});
    setView(res.reel); sfx('coins'); toast(`물고기 ${num(res.sold)}마리를 팔아 진주 ${num(res.pearls)}개!`);
    net();
  } catch (err) { toast(err.message); buttonBusy(b, false); }
}
function shop() {
  const v = R.v || {}, p = Number(v.pearls || 0), left = Number(v.coin_left ?? REEL.COIN_DAILY);
  const coinBtn = n => `<button type="button" class="rl-coin-btn" data-rl="coins" data-n="${n}" ${n <= left && n <= p ? '' : 'disabled'}>${art('pearl', '<i class="rl-pearl-ico"></i>')}${num(n)} → ${coin()}${num(n)}</button>`;
  const maxN = Math.min(left, p);
  sheet(`${sheetHead('🏪 진주 교환소', `<span class="rl-sheet-pearl">${art('pearl', '<i class="rl-pearl-ico"></i>')}${num(p)}</span>`)}
    <div class="rl-shop-block"><h3>${coin()} 코인으로 바꾸기 <small>진주 1개 = 1코인 · 오늘 ${num(left)}코인 더</small></h3>
      <div class="rl-coin-row">${[10, 50].map(coinBtn).join('')}${maxN > 0 && ![10, 50].includes(maxN) ? coinBtn(maxN) : ''}</div></div>
    <div class="rl-shop-block"><h3>🥚 알로 바꾸기</h3>
      <div class="rl-egg-row">
        <button type="button" class="rl-egg" data-rl="egg" data-item="egg" ${v.egg_left && p >= REEL.EGG ? '' : 'disabled'}><img src="/assets/pets/dog-0.webp" alt="" width="64" height="64"><b>랜덤 알</b><small>${art('pearl', '<i class="rl-pearl-ico"></i>')}${num(REEL.EGG)} · ${v.egg_left ? '오늘 1개' : '내일 또'}</small></button>
        <button type="button" class="rl-egg epic" data-rl="egg" data-item="epic_egg" ${v.epic_left && p >= REEL.EPIC_EGG ? '' : 'disabled'}><span class="rl-epic-egg"></span><b>영웅 알</b><small>${art('pearl', '<i class="rl-pearl-ico"></i>')}${num(REEL.EPIC_EGG)} · ${v.epic_left ? '이번 주 1개' : '다음 주에'}</small></button>
      </div></div>
    <div class="rl-shop-block sea"><h3>🐬 바다 펫 <small>교환소에서만 만나요</small></h3>
      <div class="rl-sea-pets">${(v.sea || SEA_PETS).map(x => `<div class="rl-sea-pet locked"><span class="rl-sea-silhouette ${x.key}"></span><b>${esc(x.ko)}</b><small>${esc(x.kind)} · ${art('pearl', '<i class="rl-pearl-ico"></i>')}${num(REEL.SEA_PET)}</small><em>곧 만나요</em></div>`).join('')}</div>
      <p class="rl-sheet-note">바다 펫은 그림이 완성되면 열려요. 그때까지 진주를 모아 두세요!</p></div>`, 'shop');
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
function book() {
  const mine = R.v?.book || {}, order = ['common', 'uncommon', 'rare', 'epic', 'legend', 'golden'];
  const keys = [...FISH_KEYS].sort((a, b) => order.indexOf(FISH[a].rarity) - order.indexOf(FISH[b].rarity));
  const got = keys.filter(k => mine[k]?.n).length;
  sheet(`${sheetHead(`📖 물고기 도감 <small>${num(got)} / ${keys.length}</small>`)}
    <div class="fs-book-bar"><i style="width:${Math.round(got / keys.length * 100)}%"></i></div>
    <div class="fs-tank">${keys.map(k => { const m = mine[k], f = FISH[k];
      return m?.n ? `<div class="fs-slot r-${f.rarity}">${STAR(stars(f.rarity))}${fishPic(k)}<b>${esc(f.name)}</b><small>최고 ${kgText(m.kg)} · ${num(m.n)}마리</small></div>`
        : `<div class="fs-slot unknown r-${f.rarity}">${STAR(stars(f.rarity))}${fishShadow(k)}<b>???</b><small>${esc(RARITY[f.rarity].name)}</small></div>`; }).join('')}</div>`, 'book');
}
// 처음 들어오면 한 번(그 뒤에는 ? 버튼).
function guide(first) {
  sheet(`${sheetHead('🎣 낚시터에 온 걸 환영해요!')}
    <ol class="rl-guide">
      <li><b>미끼로 낚아요</b><p>공부하면 미끼를 받아요 <em>(하루 최대 ${REEL.BAIT_DAILY}개)</em>. 연습을 끝까지 풀면(10문제 이상) 1개, 짝 맞추기 별 3개면 1개, 출석하면 1개. 미끼 1개로 한 번 던져요. 놓치면 미끼는 사라져요.</p></li>
      <li><b>손맛으로 낚아요</b><p>던지기 버튼을 <b>꾹 눌렀다가</b> 게이지가 <b>금색 칸</b>일 때 떼면 퍼펙트(귀한 물고기가 더 잘 와요). 찌가 <b>쏙</b> 들어가면 탭! 물고기가 걸리면 가운데 버튼을 <b>꾹 눌러 감고</b>, 줄 텐션이 <b>빨간색</b>이면 손을 떼요. 물고기가 한쪽으로 <b>돌진</b>하면 <b>반대쪽 버튼을 연타</b>! 펫 특기 구슬이 차면 눌러서 한 번에 끌어올려요.</p></li>
      <li><b>물고기를 진주로 바꿔요</b><p>낚은 물고기는 <b>어망</b>에 모여요. 팔면 진주가 돼요. 팔아도 도감 기록은 남아요.</p>
        <div class="rl-guide-table">${['common', 'uncommon', 'rare', 'epic', 'legend'].map(r => `<span>${STAR(stars(r))}<b>${esc(RARITY[r].name)}</b><em>${num(REEL.PEARLS[r])}</em></span>`).join('')}</div></li>
      <li><b>진주로 바꿀 수 있는 것</b>
        <ul><li>${coin()} <b>코인</b>: 진주 1개 = 1코인 (하루 ${num(REEL.COIN_DAILY)}코인까지)</li><li>🥚 <b>랜덤 알</b>: 진주 ${num(REEL.EGG)}개 (하루 1개)</li><li>🥚 <b>영웅 알</b>: 진주 ${num(REEL.EPIC_EGG)}개 (일주일 1개)</li><li>🐬 <b>바다 펫</b>: 진주 ${num(REEL.SEA_PET)}개 · 교환소에서만 만나요!</li><li>✨ <b>황금 알 물고기</b>는 팔지 않고 모아요. ${REEL.GOLDEN_EGG}마리면 알 선물!</li></ul></li>
    </ol>
    <button type="button" class="yl-cta" data-rl="close-sheet">알겠어요!</button>`, 'guide');
  if (first) api('/reel/guide', {}).then(res => setView(res.reel)).catch(() => {});
}
