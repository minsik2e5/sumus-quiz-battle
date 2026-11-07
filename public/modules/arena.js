import { api, esc, num, icon, toast, buttonBusy } from './ui.js';
import { CHARACTERS } from './core.js';
import { petKey, expressionSrc } from './character.js';
import { coin } from './emblems.js';
import { playSound, unlockSound, soundOn, preloadSound } from './sound.js';
import { coinShower, countUp } from './celebrate.js';
import { ELEMENTS, fxShot, fxImpact, fxSkillCutIn, fxPunch, fxSpeedLines, fxRecoil } from './battle-fx.js';
import { ARENA, BEATS, createArena, fighter } from './arena-rules.js';
import { WALL_KINDS, dealWalls } from './wall-rules.js';

// V13.223 펫 아레나(놀이터): 전체 화면. 위에서 비스듬히 내려다보는 경기장에서 내 펫과 상대 펫이 알아서 움직이며 싸운다.
// 화면 아래 단어 문제를 맞히면 필살기 게이지가 차고(꽉 차면 컷인과 함께 필살기), 틀리면 내 펫이 잠깐 멈칫.
// 전투 계산은 arena-rules.js(서버와 같은 함수), 판 · 채점 · 보상은 서버(server/arena.mjs). 클래스는 ar-.
// 그림: 주문서 65(public/assets/arena/) 경기장 · VS · 승패 배너 · 필살기 아이콘 · 쓰러짐 별. 경기장 그림이 없으면 지금 있는 전투 광장(battle/bg-arena), 작은 그림이 없으면 그 자리를 비운다.

const KEYS = ['1', '2', '3', '4'];
const SHAPE_KO = { beam: '빔', orb: '구슬', quake: '지진', dash: '돌진' };
const BG = { plaza: ['arena/bg-plaza', 'battle/bg-arena'], forest: ['arena/bg-forest', 'battle/bg-forest'], night: ['arena/bg-night', 'battle/bg-boss'] };
let R = null;
const root = () => document.getElementById('app');
const $ = id => document.getElementById(id);
let REDUCED = null;
const reduced = () => (REDUCED ||= matchMedia('(prefers-reduced-motion: reduce)')).matches;
const sfx = (key, opts) => { if (soundOn()) playSound(key, opts); };
const buzz = p => { try { if (soundOn()) navigator.vibrate?.(p); } catch {} };
function later(fn, ms) { const cur = R; const t = setTimeout(() => { if (R === cur && !cur.closing) fn(); }, ms); cur.timers.push(t); }
const wait = ms => new Promise(res => later(res, reduced() ? Math.min(ms, 250) : ms));
const petName = key => CHARACTERS[key]?.ko || key;
const petSrc = (key, form) => `/assets/pets/${petKey(key)}-${Math.max(1, Math.min(3, form))}.webp`;
const petImg = (key, form, cls = '') => `<img class="${cls}" src="${petSrc(key, form)}" alt="${esc(petName(key))}" draggable="false" decoding="async">`;
const elTag = el => `<i class="ar-el" style="--c1:${ELEMENTS[el]?.c1};--c2:${ELEMENTS[el]?.c2}">${esc(ELEMENTS[el]?.name || '')}</i>`;

const MISS_KEY = () => `sumus-arena-missed:${R?.A?.data?.profile?.id || ''}`;
const TEAM_KEY = () => `sumus-arena-team:${R?.A?.data?.profile?.id || ''}`;
const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k) || 'null') ?? d; } catch { return d; } };
const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

// 싸울 수 있는 내 펫(알이 아닌 펫): 레벨 순.
const readyPets = A => (A.data.stats?.pets || []).filter(x => Number(x.form) >= 1).sort((a, b) => b.level - a.level || (b.active ? 1 : 0) - (a.active ? 1 : 0));

// opts: { words, codes, label }
export function openArena(A, exit, opts = {}) {
  closeAll();
  R = { A, exit, timers: [], words: opts.words || [], codes: opts.codes || [], label: opts.label || '', view: A.data.rewards?.arena || null };
  A.screen = 'arena';
  const ready = readyPets(A).map(x => x.key);
  const saved = load(TEAM_KEY(), []).filter(k => ready.includes(k));
  R.team = (saved.length ? saved : ready).slice(0, ARENA.TEAM);
  root().innerHTML = `<div class="session-app ar-app" id="ar-app">
    <div class="ar-stage" id="ar-stage"><img class="ar-bg" id="ar-bg" alt="" draggable="false"><div class="ar-shade"></div></div>
    <header class="ar-top"><button type="button" class="yb-back" data-ar="exit" aria-label="나가기">${icon('back')}</button><strong>펫 아레나</strong><span class="ar-wallet">${coin()}<b id="ar-coins">${num(A.data.stats?.points_balance || 0)}</b></span></header>
    <main class="ar-main" id="ar-main"></main>
  </div>`;
  setBg('plaza');
  root().onclick = onClick;
  root().onpointerdown = onPointer;
  R.keys = onKey; R.vis = onVisibility;
  document.addEventListener('keydown', R.keys);
  document.addEventListener('visibilitychange', R.vis);
  window.scrollTo(0, 0);
  preloadSound(['tm-count', 'tm-go', 'hit', 'hit-star', 'hit-leaf', 'hit-wind', 'atk-star', 'atk-leaf', 'atk-wind', 'skill', 'ult-riser', 'ult-impact', 'faint', 'combo', 'combo-10', 'correct', 'wrong', 'crit', 'fanfare-epic', 'fanfare-basic', 'fail', 'coins', 'stamp', 'smash', 'swoosh']);
  lobby();
}
function setBg(name) {
  const el = $('ar-bg'); if (!el) return;
  const [want, backup] = BG[name] || BG.plaza;
  const stage = $('ar-stage');
  el.onload = () => stage?.classList.toggle('art', el.src.includes('/assets/arena/'));
  el.onerror = () => { el.onerror = null; stage?.classList.remove('art'); el.src = `/assets/${backup}.webp`; };
  el.src = `/assets/${want}.webp`;
}
const artImg = (name, cls) => `<img class="${cls}" data-ar-art src="/assets/arena/${name}.webp" alt="" draggable="false" decoding="async">`;
function artGuard() { root()?.querySelectorAll('img[data-ar-art]').forEach(img => { img.removeAttribute('data-ar-art'); img.onerror = () => img.remove(); if (img.complete && !img.naturalWidth) img.remove(); }); }
function closeAll() {
  if (!R) return;
  R.closing = true;
  R.timers.forEach(clearTimeout);
  cancelAnimationFrame(R.raf);
  if (R.keys) document.removeEventListener('keydown', R.keys);
  if (R.vis) document.removeEventListener('visibilitychange', R.vis);
}
async function leave() {
  const exit = R?.exit;
  closeAll();
  root().onclick = null; root().onpointerdown = null;
  R = null;
  await exit?.();
}
const main = html => { const el = $('ar-main'); if (el) el.innerHTML = html; };
const app = () => $('ar-app');

/* ---------- 입력 ---------- */
function onPointer(event) {
  const b = event.target.closest('[data-ar="pick"]');
  if (!b || !R || event.button > 0) return;
  unlockSound();
  choose(Number(b.dataset.i));
}
function onKey(event) {
  if (!R?.asking) return;
  const i = KEYS.indexOf(event.key);
  if (i >= 0) { event.preventDefault(); choose(i); }
}
function onClick(event) {
  const b = event.target.closest('[data-ar]');
  if (!b || b.disabled || !R) return;
  unlockSound();
  const act = b.dataset.ar;
  if (act === 'pick') { if (event.detail === 0) choose(Number(b.dataset.i)); return; }
  if (act === 'exit') return R.playing ? confirmQuit() : leave();
  if (act === 'pet') return togglePet(b.dataset.key);
  if (act === 'start') return start(b);
  if (act === 'again') return lobby(true);
  if (act === 'quit-yes') return leave();
  if (act === 'quit-no') { document.querySelector('.ar-quit')?.remove(); resume(); return; }
}
function confirmQuit() {
  if (document.querySelector('.ar-quit')) return;
  pause();
  const box = document.createElement('div');
  box.className = 'ar-quit';
  box.innerHTML = '<div><b>그만할까요?</b><p>이번 대전은 기록되지 않아요.</p><button type="button" class="btn" data-ar="quit-no">계속하기</button><button type="button" class="btn primary" data-ar="quit-yes">그만하기</button></div>';
  app()?.appendChild(box);
}

/* ---------- 대기실: 팀 고르기 ---------- */
function togglePet(key) {
  const i = R.team.indexOf(key);
  if (i >= 0) { if (R.team.length > 1) R.team.splice(i, 1); }
  else if (R.team.length < ARENA.TEAM) R.team.push(key);
  else { R.team.shift(); R.team.push(key); }
  save(TEAM_KEY(), R.team);
  sfx('tap');
  lobby(false, true);
}
function lobby(again = false, keep = false) {
  R.playing = false; R.asking = false;
  cancelAnimationFrame(R.raf);
  app()?.classList.remove('playing');
  setBg('plaza');
  const v = R.view || {}, pets = readyPets(R.A);
  const ok = dealWalls(R.words).length > 0;
  const slot = n => { const key = R.team[n], p = pets.find(x => x.key === key); return p ? `<span class="ar-slot on"><b>${n + 1}</b>${petImg(p.key, p.form)}<small>${esc(p.name || petName(p.key))}</small><em>Lv.${p.level}</em></span>` : `<span class="ar-slot"><b>${n + 1}</b><i>?</i><small>비어 있음</small></span>`; };
  main(`<section class="ar-lobby${again ? ' again' : ''}${keep ? ' keep' : ''}">
    <div class="ar-title"><small>3 대 3 펫 대전</small><h1>펫 아레나</h1></div>
    <div class="ar-card">
      <ul class="ar-rules">
        <li><b>1</b><span>내 펫 <em>3마리</em>가 차례로 나가 <em>알아서 싸워요</em></span></li>
        <li><b>2</b><span>아래 단어를 맞히면 <em>필살기 게이지</em>가 차요. 꽉 차면 필살기!</span></li>
        <li><b>3</b><span>틀리면 내 펫이 <em>멈칫</em>해요. 속성 상성도 중요해요</span></li>
      </ul>
      <h3 class="ar-sub">내 팀 <small>순서대로 나가요 · 눌러서 바꾸기</small></h3>
      <div class="ar-slots">${[0, 1, 2].map(slot).join('')}</div>
      ${pets.length ? `<div class="ar-pets">${pets.map(p => `<button type="button" class="ar-pet-pick${R.team.includes(p.key) ? ' on' : ''}" data-ar="pet" data-key="${esc(p.key)}" aria-pressed="${R.team.includes(p.key)}">${petImg(p.key, p.form)}<small>Lv.${p.level}</small>${R.team.includes(p.key) ? `<b>${R.team.indexOf(p.key) + 1}</b>` : ''}</button>`).join('')}</div>`
        : '<p class="ar-why">알에서 깬 펫이 없어요. 공부해서 펫을 키우면 싸울 수 있어요!</p>'}
      <div class="ar-recs"><div><small>승리</small><b>${num(v.wins || 0)}</b></div><div><small>연승</small><b>${num(v.streak || 0)}<small> / 최고 ${num(v.best_streak || 0)}</small></b></div><div><small>오늘 코인 판</small><b>${num(v.left ?? ARENA.DAILY)}<small> / ${num(ARENA.DAILY)}</small></b></div></div>
      <p class="ar-words">게임 단어 · <b>${esc(R.label || '고른 범위')}</b> · 이기면 ${coin()}${ARENA.COINS.win}</p>
      <button type="button" class="yl-cta ar-go" data-ar="start" ${ok && pets.length ? '' : 'disabled'}>${!pets.length ? '펫을 먼저 키워 주세요' : ok ? '대전 시작!' : '뜻이 서로 다른 단어가 부족해요'}</button>
    </div>
  </section>`);
}

async function start(button) {
  buttonBusy(button);
  let r;
  try { r = await api('/games/arena/start', { range_codes: R.codes, missed: load(MISS_KEY(), []).slice(0, ARENA.MISSED_MAX), team: R.team }); }
  catch (err) { if (!R) return; buttonBusy(button, false); return toast(err.message || '대전을 시작하지 못했어요.'); }
  if (!R) return;
  R.view = { ...R.view, left: r.left, wins: r.wins, streak: r.streak, best_streak: r.best_streak };
  await vs(r);
  if (R) play(r);
}

/* ---------- VS ---------- */
async function vs(r) {
  setBg(['plaza', 'forest', 'night'][r.seed % 3]);
  const side = (who, name, team) => `<div class="ar-vs-side ${who}"><b>${esc(name)}</b><div>${team.map((f, n) => `<span style="--i:${n}">${petImg(f.key, f.form)}<small>Lv.${f.level}</small>${elTag(f.el)}</span>`).join('')}</div></div>`;
  main(`<section class="ar-vs" id="ar-vs"><div class="ar-vs-bg"></div><div class="ar-vs-art"></div>
    ${side('foe', r.foe.name + (r.foe.bot ? '' : '의 팀'), r.foe.team)}
    <div class="ar-vs-mark">VS</div>
    ${side('me', '내 팀', r.me)}
  </section>`);
  sfx('swoosh'); later(() => { sfx('smash'); buzz(30); }, 450);
  await wait(2300);
}

/* ---------- 전투 ---------- */
function field() {
  return `<section class="ar-play" id="ar-play">
    <div class="ar-hud">
      <div class="ar-bar foe" id="ar-hud-foe"></div>
      <div class="ar-bar me" id="ar-hud-me"></div>
    </div>
    <div class="ar-field yb-arena" id="ar-field">
      <div class="ar-ring" aria-hidden="true"></div>
      <div class="ar-mon foe" id="ar-foe"><span class="ar-shadow"></span><span class="ar-body" id="ar-foe-body"></span><span class="ar-hp"><i id="ar-foe-hp"></i></span></div>
      <div class="ar-mon me" id="ar-me"><span class="ar-shadow"></span><span class="ar-body" id="ar-me-body"></span><span class="ar-hp"><i id="ar-me-hp"></i></span></div>
    </div>
    <div class="ar-quiz" id="ar-quiz">
      <div class="ar-gauge" id="ar-gauge">${artImg('ult-icon', 'ar-ult-ico')}<span><i id="ar-gauge-fill"></i></span><b id="ar-gauge-txt">필살기 0%</b><em id="ar-combo"></em></div>
      <div class="ar-q" id="ar-q"></div>
    </div>
  </section>`;
}
function hudHtml(who, name, team, idx) {
  return `<b>${esc(name)}</b><span class="ar-dots">${team.map((f, n) => `<i class="${f.cur <= 0 ? 'down' : n === idx ? 'now' : ''}">${petImg(f.key, R.forms[who][n])}</i>`).join('')}</span>`;
}
function play(r) {
  // 서버와 똑같이 key · form · level로 능력치를 다시 만든다(server/arena.mjs unpack과 같다).
  const fighters = list => list.map(f => fighter({ key: f.key, form: f.form, level: f.level }));
  R.r = r;
  R.forms = { me: r.me.map(f => f.form), foe: r.foe.team.map(f => f.form) };
  R.sim = createArena({ seed: r.seed, me: fighters(r.me), foe: fighters(r.foe.team), foeLevel: r.foe_level });
  Object.assign(R, { questions: r.questions, qi: 0, shown: 0, picks: [], asking: false, playing: true, paused: false, pausedMs: 0, okN: 0, badN: 0, missed: [] });
  app()?.classList.add('playing');
  main(field()); artGuard();
  R.prev = R.sim.view(); R.cur = R.prev;
  drawMon('me'); drawMon('foe'); drawHud(); drawGauge();
  place(0);
  countIn();
}
async function countIn() {
  for (const n of ['3', '2', '1']) { pop(n, 50, 45, 'count'); sfx('tm-count'); await wait(1000); if (!R?.playing) return; }
  pop('FIGHT!', 50, 45, 'count go'); sfx('tm-go'); buzz(40);
  R.t0 = performance.now();
  ask();
  R.raf = requestAnimationFrame(loop);
}
function drawMon(who) {
  const s = R.cur[who], f = s.team[s.idx], el = $(`ar-${who}-body`);
  if (el) el.innerHTML = petImg(f.key, R.forms[who][s.idx], 'ar-pet-img');
  $(`ar-${who}`)?.classList.remove('down');
}
function drawHud() {
  const v = R.cur;
  const a = $('ar-hud-foe'), b = $('ar-hud-me');
  if (a) a.innerHTML = hudHtml('foe', R.r.foe.name, v.foe.team, v.foe.idx);
  if (b) b.innerHTML = hudHtml('me', '나', v.me.team, v.me.idx);
  for (const who of ['me', 'foe']) { const s = v[who], f = s.team[s.idx], el = $(`ar-${who}-hp`); if (el) { const p = Math.max(0, f.cur / f.hp); el.style.width = `${p * 100}%`; el.classList.toggle('low', p < .3); } }
}
function drawGauge() {
  const g = R.cur.me.gauge, el = $('ar-gauge-fill'), t = $('ar-gauge-txt');
  if (el) el.style.width = `${g}%`;
  if (t) t.textContent = g >= ARENA.GAUGE_MAX ? '필살기 준비!' : `필살기 ${Math.floor(g)}%`;
  $('ar-gauge')?.classList.toggle('full', g >= ARENA.GAUGE_MAX);
  const c = $('ar-combo'); if (c) c.textContent = R.cur.me.combo >= 2 ? `${R.cur.me.combo} 콤보` : '';
}
// 경기장 좌표(%) → 픽셀.
const geo = () => { const el = $('ar-field'); return el ? { w: el.clientWidth, h: el.clientHeight } : { w: 360, h: 400 }; };
const px = (x, y) => { const g = geo(); return { x: x / 100 * g.w, y: y / 100 * g.h }; };
function place(frac) {
  for (const who of ['me', 'foe']) {
    const a = R.prev[who], b = R.cur[who], el = $(`ar-${who}`); if (!el) continue;
    const x = a.x + (b.x - a.x) * frac, y = a.y + (b.y - a.y) * frac, o = R.cur[who === 'me' ? 'foe' : 'me'];
    el.style.left = `${x}%`; el.style.top = `${y}%`;
    el.style.zIndex = String(10 + Math.round(y));
    el.classList.toggle('flip', o.x < x);
    el.classList.toggle('hidden', b.enter > 0);
    el.classList.toggle('stun', who === 'me' && b.stun > 0);
  }
}
function loop(now) {
  if (!R?.playing) return;
  if (R.paused) { R.raf = requestAnimationFrame(loop); return; }
  const want = Math.floor((now - R.t0 - R.pausedMs) / ARENA.TICK_MS);
  let n = 0;
  const behind = want - R.sim.S.t > 12; // 많이 밀렸으면(다른 탭) 효과 없이 따라잡는다
  while (R.sim.S.t < want && !R.sim.S.over && n++ < 60) tickOnce(!behind);
  if (R.sim.S.over) return end();
  const frac = Math.max(0, Math.min(1, (now - R.t0 - R.pausedMs) / ARENA.TICK_MS - R.sim.S.t + 1));
  place(frac);
  timerBar();
  R.raf = requestAnimationFrame(loop);
}
// 한 틱: 문제 시간 끝 → 전투 한 걸음 → 사건 그리기.
function tickOnce(show) {
  const t = R.sim.S.t;
  if (R.asking && t >= R.shown + ARENA.Q_LIMIT_TICKS) answer(-1, R.shown + ARENA.Q_LIMIT_TICKS);
  if (!R.asking && R.nextAt != null && t >= R.nextAt) ask();
  R.prev = R.cur;
  const ev = R.sim.step();
  R.cur = R.sim.view();
  for (const e of ev) onEvent(e, show);
}
function onEvent(e, show) {
  if (e.e === 'ok' || e.e === 'bad') { drawGauge(); return; }
  if (e.e === 'enter') { drawMon(e.who); drawHud(); if (show) { const s = R.cur[e.who]; pop(`${petName(e.key)} 등장!`, s.x, s.y - 12, 'enter'); sfx('swoosh'); } return; }
  if (e.e === 'faint') { const el = $(`ar-${e.who}`); el?.classList.add('down'); drawHud(); if (show) { faintFx(el); banner(e.who === 'me' ? `${petName(e.key)} 쓰러짐…` : `${petName(e.key)} 쓰러뜨렸다!`, e.who); sfx('faint'); buzz([40, 30, 40]); } return; }
  if (e.e === 'over') return;
  if (!show) { if (e.e === 'dmg') drawHud(); return; }
  if (e.e === 'cutin') return cutin(e);
  if (e.e === 'atk' || e.e === 'skill' || e.e === 'ult') return attack(e);
  if (e.e === 'dmg') return damage(e);
}
function cutin(e) {
  const fieldEl = $('ar-field');
  fxSkillCutIn(fieldEl, { side: e.who, portrait: petImg(e.key, e.form), name: e.name, petName: petName(e.key), el: e.el, rank: e.rank });
  sfx('ult-riser'); buzz(60);
  app()?.classList.add('ult');
  later(() => app()?.classList.remove('ult'), ARENA.ULT_FREEZE_TICKS * ARENA.TICK_MS);
  drawGauge();
}
function attack(e) {
  const fieldEl = $('ar-field'), from = px(e.fx, e.fy), to = px(e.tx, e.ty), ms = Math.max(90, e.travel * ARENA.TICK_MS);
  const body = $(`ar-${e.who}-body`);
  const pose = expressionSrc(R.cur[e.who].team[R.cur[e.who].idx].key, R.forms[e.who][R.cur[e.who].idx], 'attack');
  swap(body, pose, 420);
  const big = e.e !== 'atk';
  if (e.e === 'skill') { pop(`${SHAPE_KO[e.shape]}!`, e.fx, e.fy - 14, 'skill'); sfx('skill'); }
  if (e.shape === 'orb') { fxShot(fieldEl, from, to, e.el, { big, ms }); sfx(atkSfx(e.el)); }
  else if (e.shape === 'beam') { beam(from, to, e.el, big || e.e === 'ult'); sfx(e.e === 'ult' ? 'ult-impact' : atkSfx(e.el)); }
  else if (e.shape === 'quake') { quake(to, e.el, big); sfx('smash'); }
  else { dash(e.who, from, to); fxSpeedLines(fieldEl, to, e.el); sfx('swoosh'); }
  if (e.e === 'ult') { fxPunch(app(), .06); app()?.classList.add('shake'); later(() => app()?.classList.remove('shake'), 420); }
}
const atkSfx = el => el === 'leaf' ? 'atk-leaf' : el === 'wind' ? 'atk-wind' : 'atk-star';
function damage(e) {
  const fieldEl = $('ar-field'), at = px(e.x, e.y - 6), attacker = e.who === 'me' ? 'foe' : 'me';
  const el = R.cur[attacker].team[R.cur[attacker].idx]?.el || 'star';
  fxImpact(fieldEl, at, el, e.kind === 'ult' ? 3 : e.kind === 'skill' ? 2 : 1);
  fxRecoil($(`ar-${e.who}-body`), e.who === 'me' ? 1 : -1);
  const pose = expressionSrc(R.cur[e.who].team[R.cur[e.who].idx].key, R.forms[e.who][R.cur[e.who].idx], 'hurt');
  swap($(`ar-${e.who}-body`), pose, 360);
  pop(String(e.dmg), e.x + (Math.random() * 8 - 4), e.y - 16, `dmg ${e.kind}${e.who === 'me' ? ' me' : ''}`);
  if (e.m > 1 && e.kind !== 'atk') pop('효과가 굉장해!', e.x, e.y - 26, 'eff');
  else if (e.m < 1 && e.kind !== 'atk') pop('효과가 별로…', e.x, e.y - 26, 'eff weak');
  sfx(e.kind === 'ult' ? 'crit' : 'hit', { rate: e.kind === 'atk' ? 1.1 : .9 });
  if (e.who === 'me') buzz(e.kind === 'atk' ? 12 : 30);
  drawHud();
}
function swap(body, src, ms) {
  const img = body?.querySelector('img'); if (!img || !src) return;
  const still = img._still ||= img.getAttribute('src');
  img.setAttribute('src', src);
  clearTimeout(img._t);
  img._t = setTimeout(() => img.setAttribute('src', still), ms);
}
function fxEl(cls, css, ms, html = '') {
  const f = $('ar-field'); if (!f) return null;
  const el = document.createElement('div');
  el.className = `ar-fx ${cls}`;
  for (const [k, v] of Object.entries(css)) k.startsWith('--') ? el.style.setProperty(k, v) : (el.style[k] = v);
  el.innerHTML = html;
  f.appendChild(el);
  setTimeout(() => el.remove(), ms);
  return el;
}
function beam(from, to, el, big) {
  const dx = to.x - from.x, dy = to.y - from.y, len = Math.sqrt(dx * dx + dy * dy), ang = Math.atan2(dy, dx) * 180 / Math.PI, P = ELEMENTS[el] || ELEMENTS.star;
  fxEl(`beam${big ? ' big' : ''}`, { left: `${from.x}px`, top: `${from.y}px`, width: `${len}px`, transform: `rotate(${ang}deg)`, '--c1': P.c1, '--c2': P.c2, '--c3': P.c3 }, big ? 700 : 380);
}
function quake(at, el, big) {
  const P = ELEMENTS[el] || ELEMENTS.earth;
  fxEl(`quake${big ? ' big' : ''}`, { left: `${at.x}px`, top: `${at.y}px`, '--c1': P.c1, '--c2': P.c2 }, 700);
  fxEl('crack', { left: `${at.x}px`, top: `${at.y}px` }, 900);
}
function dash(who, from, to) {
  const el = $(`ar-${who}-body`); if (!el) return;
  try { el.animate([{ translate: '0 0' }, { translate: `${(to.x - from.x) * .7}px ${(to.y - from.y) * .7}px`, offset: .45 }, { translate: '0 0' }], { duration: 260, easing: 'ease-out' }); } catch {}
}
function pop(text, x, y, cls = '') {
  const el = fxEl(`pop ${cls}`, { left: `${x}%`, top: `${y}%` }, cls.includes('count') ? 950 : 1000, esc(text));
  return el;
}
function faintFx(mon) {
  const fieldEl = $('ar-field'); if (!fieldEl || !mon) return;
  const img = document.createElement('img');
  img.className = 'ar-faint'; img.src = '/assets/arena/fx-faint.webp'; img.alt = ''; img.onerror = () => img.remove();
  img.style.left = mon.style.left; img.style.top = mon.style.top;
  fieldEl.appendChild(img); later(() => img.remove(), 1400);
}
function banner(text, who) {
  const el = document.createElement('div');
  el.className = `ar-banner ${who}`; el.textContent = text;
  $('ar-play')?.appendChild(el);
  later(() => el.remove(), 1500);
}

/* ---------- 문제 ---------- */
function ask() {
  const q = R.questions[R.qi % R.questions.length];
  R.q = q; R.shown = R.sim.S.t; R.asking = true; R.nextAt = null;
  const box = $('ar-q'); if (!box) return;
  box.innerHTML = `<div class="ar-prompt"><small>${esc(WALL_KINDS[q.kind]?.label || '')}</small><b>${esc(q.prompt)}</b><span class="ar-timer"><i id="ar-timer"></i></span></div>
    <div class="ar-opts">${q.options.map((o, i) => `<button type="button" class="ar-opt" data-ar="pick" data-i="${i}" disabled><b>${i + 1}</b><span>${esc(o)}</span></button>`).join('')}</div>`;
  // 0.4초 동안은 고를 수 없다(읽지도 않고 누른 답은 놓친 것으로 친다).
  later(() => { if (R?.q === q) box.querySelectorAll('.ar-opt').forEach(b => { b.disabled = false; }); }, ARENA.MIN_PICK_TICKS * ARENA.TICK_MS + 30);
}
function timerBar() {
  const el = $('ar-timer'); if (!el || !R.asking) return;
  const left = 1 - (R.sim.S.t - R.shown) / ARENA.Q_LIMIT_TICKS;
  el.style.width = `${Math.max(0, left) * 100}%`;
  el.classList.toggle('low', left < .3);
}
function choose(k) {
  if (!R?.asking || !R.playing || R.paused) return;
  const t = R.sim.S.t;
  if (t - R.shown < ARENA.MIN_PICK_TICKS) return;
  answer(k, t);
}
function answer(k, t) {
  const q = R.q, ok = k >= 0 && k === q.answer;
  R.asking = false;
  R.picks.push([k, t]);
  R.sim.push({ t, ok });
  R.qi++;
  R.nextAt = t + ARENA.GAP_TICKS;
  const box = $('ar-q');
  box?.querySelectorAll('.ar-opt').forEach((b, i) => { b.disabled = true; b.classList.toggle('right', i === q.answer); b.classList.toggle('wrong', i === k && !ok); });
  if (ok) { R.okN++; sfx(R.cur.me.combo >= 4 ? 'combo' : 'correct', { rate: 1 + Math.min(8, R.cur.me.combo) * .03 }); buzz(15); }
  else { R.badN++; R.missed.push(q.id); sfx('wrong'); buzz([30, 30]); const s = R.cur.me; pop(k < 0 ? '시간 끝!' : '멈칫!', s.x, s.y - 14, 'stun'); }
}

/* ---------- 잠깐 멈춤 ---------- */
function pause() { if (!R?.playing || R.paused) return; R.paused = true; R.pauseAt = performance.now(); }
function resume() { if (!R?.paused) return; R.pausedMs += performance.now() - R.pauseAt; R.paused = false; }
function onVisibility() { if (document.hidden) pause(); else if (!document.querySelector('.ar-quit')) resume(); }

/* ---------- 끝 ---------- */
async function end() {
  R.playing = false; R.asking = false;
  cancelAnimationFrame(R.raf);
  place(1);
  const local = R.sim.S.winner;
  const passed = new Set(R.questions.slice(0, R.qi).map(q => q.id).filter(id => !R.missed.includes(id)));
  save(MISS_KEY(), [...new Set([...R.missed, ...load(MISS_KEY(), []).filter(id => !passed.has(String(id)))])].slice(0, ARENA.MISSED_MAX));
  banner(local === 'me' ? '승리!' : local === 'draw' ? '무승부' : '패배…', local === 'me' ? 'me win' : 'foe');
  sfx(local === 'me' ? 'fanfare-epic' : 'fail');
  await wait(1400);
  if (!R) return;
  main('<div class="ar-saving">기록하는 중…</div>');
  let res = null;
  try { res = await api('/games/arena/finish', { id: R.r.id, picks: R.picks }); }
  catch (err) { res = { paid: false, reason: 'error', error: err.message }; }
  if (!R) return;
  if (res?.stats) Object.assign(R.A.data.stats, res.stats);
  if (typeof res?.points_balance === 'number') R.A.data.stats.points_balance = res.points_balance;
  R.view = { ...R.view, left: res?.left ?? R.view?.left, wins: res?.wins ?? R.view?.wins, streak: res?.streak ?? R.view?.streak, best_streak: res?.best_streak ?? R.view?.best_streak };
  R.A.data.rewards ||= {}; R.A.data.rewards.arena = R.view;
  result(local, res);
}
function result(local, res) {
  const winner = res?.winner || local, win = winner === 'me', coins = Number(res?.coins || 0), xp = Number(res?.xp || 0);
  const correct = res?.correct ?? R.okN, wrong = res?.wrong ?? R.badN;
  const why = res?.reason === 'daily' ? `오늘 코인 판(${ARENA.DAILY}판)을 다 썼어요. 기록은 남아요!` : res?.reason === 'error' ? esc(res.error || '저장하지 못했어요.') : res?.reason === 'short' || res?.reason === 'stale' ? '이번 대전은 기록되지 않았어요.' : !win && res?.paid && !coins ? `${ARENA.LOSE_MIN_OK}문제 이상 맞히면 져도 코인을 받아요.` : '';
  const seen = new Set(), missed = R.questions.filter(q => R.missed.includes(q.id) && !seen.has(q.id) && seen.add(q.id));
  const face = x => x.kind === 'mean2en' ? [x.options[x.answer], x.prompt] : [x.prompt, x.options[x.answer]];
  const team = R.r.me;
  main(`<section class="ar-result ${win ? 'win' : 'lose'}">
    <div class="ar-res-card">
      <div class="ar-res-head">${winner === 'draw' ? '' : artImg(win ? 'banner-win' : 'banner-lose', 'ar-res-banner')}<h2>${win ? '승리!' : winner === 'draw' ? '무승부' : '아쉬운 패배'}</h2><p>vs ${esc(R.r.foe.name)}${res?.streak >= 2 && win ? ` · <b>${res.streak}연승!</b>` : ''}</p></div>
      <div class="ar-res-team">${team.map((f, n) => `<span style="--i:${n}">${petImg(f.key, f.form)}</span>`).join('')}</div>
      <div class="ar-res-rows"><span><small>맞힘</small><b>${correct}</b></span><span><small>틀림</small><b>${wrong}</b></span><span><small>필살기</small><b>${res?.ults ?? '—'}</b></span></div>
      ${coins || xp ? `<div class="ar-res-gain">${coins ? `<span class="r coin">${coin()}<b>+${num(coins)}</b>${res?.streak_coins ? `<small>3연승 +${res.streak_coins} 포함</small>` : ''}</span>` : ''}${xp ? `<span class="r xp"><b>+${xp}</b><small>경험치</small></span>` : ''}</div>` : ''}
      ${why ? `<p class="ar-why">${why}</p>` : ''}
      ${missed.length ? `<div class="ar-review"><h3>헷갈린 단어 <small>다음 판에 먼저 나와요</small></h3><div>${missed.map((x, n) => { const [en, ko] = face(x); return `<span style="--i:${n}"><b>${esc(en)}</b><em>${esc(ko)}</em></span>`; }).join('')}</div></div>` : ''}
      <div class="ar-res-btns"><button type="button" class="yl-cta" data-ar="again">한 판 더</button><button type="button" class="btn full" data-ar="exit">놀이터로</button></div>
    </div>
  </section>`);
  artGuard();
  if (coins) { later(() => { sfx('coins'); coinShower(app(), 22); const b = $('ar-coins'); if (b) countUp(b, Number(R.A.data.stats?.points_balance || 0), 900); }, 500); }
}

// 상성표(도움말 · 검사용): '불꽃 → 풀 · 얼음'.
export const beatsText = () => Object.entries(BEATS).filter(([, v]) => v.length).map(([k, v]) => `${ELEMENTS[k].name} → ${v.map(x => ELEMENTS[x].name).join(' · ')}`);
