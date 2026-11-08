import { api, esc, num, icon, toast, buttonBusy } from './ui.js';
import { CHARACTERS } from './core.js';
import { petKey, expressionSrc } from './character.js';
import { coin } from './emblems.js';
import { playSound, unlockSound, soundOn, preloadSound } from './sound.js';
import { coinShower, countUp } from './celebrate.js';
import { ELEMENTS, fxImpact, fxSkillCutIn, fxPunch, fxSpeedLines, fxRecoil, fxLite } from './battle-fx.js';
import { ARENA, BEATS, INPUT, ROLE, createArena, fighter, dirCode } from './arena-rules.js';

// V13.225 펫 아레나 2(놀이터): 전체 화면. 위에서 비스듬히 내려다보는 경기장에서 내 펫을 직접 조종해 상대 펫과 싸운다.
//   왼쪽 아래 조이스틱으로 움직이고, 오른쪽 버튼: 공격(누르고 있으면 계속) · 스킬 1 · 스킬 2(펫마다 다르다) · 필살기(게이지) · 회피 · 교체.
//   컴퓨터(키보드): 방향키 · WASD 움직이기, J 공격, K 스킬 1, I 스킬 2, L 필살기, 스페이스 회피, Q 교체.
// V13.226 렉 방지: 기본 공격 맞힘은 가벼운 불꽃 하나(스킬 · 필살기만 큰 효과), 자세 그림은 미리 받아 두고, 긴 프레임이 이어지는 폰은
//   자동으로 가벼운 연출(.ar-lite, 7일 기억)로 간다. 펫 · 효과는 바뀔 때만 다시 쓴다.
// 전투 계산은 arena-rules.js(서버와 같은 함수), 판 · 확인 · 보상은 서버(server/arena.mjs). 화면은 조작 기록 [틱, 코드]만 보낸다. 클래스는 ar-.
// 그림: 주문서 65(public/assets/arena/) 경기장 · VS · 승패 배너 · 필살기 아이콘 · 쓰러짐 별. 경기장 그림이 없으면 지금 있는 전투 광장(battle/bg-arena), 작은 그림이 없으면 그 자리를 비운다.

const BG = { plaza: ['arena/bg-plaza', 'battle/bg-arena'], forest: ['arena/bg-forest', 'battle/bg-forest'], night: ['arena/bg-night', 'battle/bg-boss'] };
const KIND_KO = { burst: '공격', boost: '강화', poison: '중독', guard: '지키기' };
const SHOTS_MAX = 14, WARN_MAX = 6, MINE_MAX = 2, FX_MAX = 40;
const S2_ICON = { blink: '🌀', nova: '💥', barrage: '🎯', trap: '🪤', rain: '☄️', rush: '🐾', pull: '🪝', heal: '💚' };
const LITE_KEY = 'sumus-arena-lite', LITE_LONG_MS = 50, LITE_WINDOW_MS = 3000, LITE_LONG_COUNT = 8, LITE_DAYS = 7;
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
const pal = el => ELEMENTS[el] || ELEMENTS.star;

const TEAM_KEY = () => `sumus-arena-team:${R?.A?.data?.profile?.id || ''}`;
const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k) || 'null') ?? d; } catch { return d; } };
const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

// 싸울 수 있는 내 펫(알이 아닌 펫): 레벨 순.
const readyPets = A => (A.data.stats?.pets || []).filter(x => Number(x.form) >= 1).sort((a, b) => b.level - a.level || (b.active ? 1 : 0) - (a.active ? 1 : 0));

export function openArena(A, exit) {
  closeAll();
  R = { A, exit, timers: [], view: A.data.rewards?.arena || null };
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
  R.keys = onKey; R.keysUp = onKeyUp; R.vis = onVisibility;
  document.addEventListener('keydown', R.keys);
  document.addEventListener('keyup', R.keysUp);
  document.addEventListener('visibilitychange', R.vis);
  window.scrollTo(0, 0);
  preloadSound(['tm-count', 'tm-go', 'hit', 'hit-star', 'hit-leaf', 'hit-wind', 'atk-star', 'atk-leaf', 'atk-wind', 'skill', 'ult-riser', 'ult-impact', 'faint', 'combo', 'crit', 'fanfare-epic', 'fail', 'coins', 'smash', 'swoosh', 'tap']);
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
  if (R.keysUp) document.removeEventListener('keyup', R.keysUp);
  if (R.vis) document.removeEventListener('visibilitychange', R.vis);
  if (R.resize) window.removeEventListener('resize', R.resize);
}
async function leave() {
  const exit = R?.exit;
  closeAll();
  root().onclick = null;
  R = null;
  await exit?.();
}
const main = html => { const el = $('ar-main'); if (el) el.innerHTML = html; };
const app = () => $('ar-app');

/* ---------- 버튼 · 키보드 ---------- */
function onClick(event) {
  const b = event.target.closest('[data-ar]');
  if (!b || b.disabled || !R) return;
  unlockSound();
  const act = b.dataset.ar;
  if (act === 'exit') return R.playing ? confirmQuit() : leave();
  if (act === 'pet') return togglePet(b.dataset.key);
  if (act === 'start') return start(b);
  if (act === 'again') return lobby(true);
  if (act === 'quit-yes') return leave();
  if (act === 'quit-no') { document.querySelector('.ar-quit')?.remove(); resume(); return; }
}
const KEY_DIR = { ArrowUp: [0, -1], KeyW: [0, -1], ArrowDown: [0, 1], KeyS: [0, 1], ArrowLeft: [-1, 0], KeyA: [-1, 0], ArrowRight: [1, 0], KeyD: [1, 0] };
const KEY_BTN = { KeyJ: 'atk', KeyK: 'skill', KeyI: 'skill2', KeyL: 'ult', Space: 'dodge', KeyQ: 'swap' };
function onKey(event) {
  if (!R?.playing || event.repeat) { if (R?.playing && (KEY_DIR[event.code] || KEY_BTN[event.code])) event.preventDefault(); return; }
  if (KEY_DIR[event.code]) { event.preventDefault(); R.keyDown.add(event.code); keyDir(); }
  else if (KEY_BTN[event.code]) { event.preventDefault(); press(KEY_BTN[event.code], true); }
}
function onKeyUp(event) {
  if (!R?.playing) return;
  if (KEY_DIR[event.code]) { R.keyDown.delete(event.code); keyDir(); }
  if (KEY_BTN[event.code] === 'atk') press('atk', false);
}
function keyDir() {
  let x = 0, y = 0;
  for (const k of R.keyDown) { x += KEY_DIR[k][0]; y += KEY_DIR[k][1]; }
  R.dir = dirCode(x, y, 0.1);
  drawStick(x * 0.7, y * 0.7);
}
// 버튼 누르기: 다음 틱에 조작 기록으로 들어간다. 공격은 누르고 있는 동안 쿨타임마다 계속.
function press(btn, down = true) {
  if (!R?.playing || R.paused) return;
  if (btn === 'atk') { R.holdAtk = down; if (down) R.queue.push(INPUT.ATK); return; }
  if (!down) return;
  R.queue.push({ skill: INPUT.SKILL, skill2: INPUT.SKILL2, ult: INPUT.ULT, dodge: INPUT.DODGE, swap: INPUT.SWAP }[btn]);
  if (btn === 'ult' && R.cur.me.gauge < ARENA.GAUGE_MAX) toastOnce('필살기 게이지가 아직 다 안 찼어요');
  buzz(8);
}
function toastOnce(text) { const now = performance.now(); if (now - (R.toastAt || 0) > 2000) { R.toastAt = now; pop(text, 50, 92, 'hint'); } }
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
function skillLine(key, form, level) {
  const f = fighter({ key, form, level }), k = f.skill, k2 = f.skill2, r = ROLE[f.role];
  return `<span class="ar-skill" style="--c1:${pal(f.el).c1};--c2:${pal(f.el).c2}"><i class="ar-role">${esc(r.name)} · ${f.melee ? '근접' : '원거리'}<small>${esc(r.desc)}</small></i><b>① ${esc(k.name)}</b><small>${esc(KIND_KO[k.kind])} · ${esc(k.desc)}</small><b>② ${esc(k2.name)}</b><small>${esc(k2.desc)}</small><em>필살기 ${esc(f.ult)}</em></span>`;
}
function lobby(again = false, keep = false) {
  R.playing = false;
  cancelAnimationFrame(R.raf);
  app()?.classList.remove('playing');
  setBg('plaza');
  const v = R.view || {}, pets = readyPets(R.A);
  const tickets = Number(v.tickets || 0), left = Number(v.left ?? ARENA.DAILY), paid = tickets > 0 && left > 0;
  const slot = n => { const key = R.team[n], p = pets.find(x => x.key === key); return p ? `<span class="ar-slot on"><b>${n + 1}</b>${petImg(p.key, p.form)}<div><small>${esc(p.name || petName(p.key))} · Lv.${p.level}</small>${skillLine(p.key, p.form, p.level)}</div></span>` : `<span class="ar-slot"><b>${n + 1}</b><i>?</i><div><small>비어 있음</small></div></span>`; };
  main(`<section class="ar-lobby${again ? ' again' : ''}${keep ? ' keep' : ''}">
    <div class="ar-title"><small>3 대 3 펫 대전</small><h1>펫 아레나</h1></div>
    <div class="ar-card">
      <ul class="ar-rules">
        <li><b>🕹️</b><span>왼쪽 <em>조이스틱</em>으로 움직이고, 오른쪽 버튼으로 <em>공격 · 스킬 ① ②</em></span></li>
        <li><b>💨</b><span>날아오는 공격은 <em>회피</em>로 피해요(잠깐 무적). 바닥에 빨간 표시가 뜨면 피하기!</span></li>
        <li><b>🔥</b><span>때리고 맞으면 <em>필살기 게이지</em>가 차요. 꽉 차면 필살기! 위험하면 <em>교체</em></span></li>
      </ul>
      <h3 class="ar-sub">내 팀 <small>순서대로 나가요 · 펫마다 특징 · 스킬 2개가 달라요</small></h3>
      <div class="ar-slots">${[0, 1, 2].map(slot).join('')}</div>
      ${pets.length ? `<div class="ar-pets">${pets.map(p => `<button type="button" class="ar-pet-pick${R.team.includes(p.key) ? ' on' : ''}" data-ar="pet" data-key="${esc(p.key)}" aria-pressed="${R.team.includes(p.key)}">${petImg(p.key, p.form)}<small>Lv.${p.level}</small>${R.team.includes(p.key) ? `<b>${R.team.indexOf(p.key) + 1}</b>` : ''}</button>`).join('')}</div>`
        : '<p class="ar-why">알에서 깬 펫이 없어요. 공부해서 펫을 키우면 싸울 수 있어요!</p>'}
      <div class="ar-recs"><div><small>승리</small><b>${num(v.wins || 0)}</b></div><div><small>연승</small><b>${num(v.streak || 0)}<small> / 최고 ${num(v.best_streak || 0)}</small></b></div><div><small>입장권</small><b>🎟️ ${num(tickets)}<small> / ${num(ARENA.TICKETS_MAX)}</small></b></div></div>
      <p class="ar-words">${paid ? `코인 판 · 이기면 ${coin()}${ARENA.COINS.win} · 오늘 ${num(left)}판 남음 · 입장권 1장을 써요` : left <= 0 ? `오늘 코인 판(${ARENA.DAILY}판)을 다 썼어요. 연습 판은 계속 할 수 있어요` : `입장권이 없어서 연습 판이에요(코인 없음). <b>단어 연습을 끝까지 풀면 입장권</b>을 받아요`}</p>
      <button type="button" class="yl-cta ar-go" data-ar="start" ${pets.length ? '' : 'disabled'}>${!pets.length ? '펫을 먼저 키워 주세요' : paid ? '대전 시작!' : '연습 판 시작'}</button>
    </div>
  </section>`);
}

async function start(button) {
  buttonBusy(button);
  let r;
  try { r = await api('/games/arena/start', { team: R.team }); }
  catch (err) { if (!R) return; buttonBusy(button, false); return toast(err.message || '대전을 시작하지 못했어요.'); }
  if (!R) return;
  R.view = { ...R.view, left: r.left, tickets: r.tickets, wins: r.wins, streak: r.streak, best_streak: r.best_streak };
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
    <p class="ar-vs-lv">${['쉬움', '보통', '어려움'][r.foe_level] || '보통'} 상대${r.coin_play ? '' : ' · 연습 판'}</p>
  </section>`);
  sfx('swoosh'); later(() => { sfx('smash'); buzz(30); }, 450);
  await wait(2300);
}

/* ---------- 전투 화면 ---------- */
function field() {
  const shots = Array.from({ length: SHOTS_MAX }, (_, i) => `<i class="ar-shot" id="ar-shot-${i}"></i>`).join('');
  const warns = Array.from({ length: WARN_MAX }, (_, i) => `<i class="ar-warn" id="ar-warn-${i}"></i>`).join('') + Array.from({ length: MINE_MAX }, (_, i) => `<i class="ar-mine" id="ar-mine-${i}"></i>`).join('');
  return `<section class="ar-play" id="ar-play">
    <div class="ar-hud">
      <div class="ar-bar foe" id="ar-hud-foe"></div>
      <div class="ar-bar me" id="ar-hud-me"></div>
      <span class="ar-clock" id="ar-clock">2:00</span>
    </div>
    <div class="ar-field yb-arena" id="ar-field">
      <div class="ar-ring" aria-hidden="true"></div>
      ${warns}${shots}
      <div class="ar-mon foe" id="ar-foe"><span class="ar-shadow"></span><span class="ar-aura"></span><span class="ar-body" id="ar-foe-body"></span><span class="ar-hp"><i id="ar-foe-hp"></i><b id="ar-foe-sh"></b></span></div>
      <div class="ar-mon me" id="ar-me"><span class="ar-shadow"></span><span class="ar-aura"></span><span class="ar-body" id="ar-me-body"></span><span class="ar-hp"><i id="ar-me-hp"></i><b id="ar-me-sh"></b></span><span class="ar-arrow"></span></div>
    </div>
    <div class="ar-pad" id="ar-pad">
      <div class="ar-stick" id="ar-stick" aria-label="움직이기"><i id="ar-knob"></i></div>
      <div class="ar-btns">
        <button type="button" class="ar-btn swap" data-btn="swap" aria-label="교체"><b>🔄</b><small>교체</small><i class="cd" id="ar-cd-swap"></i></button>
        <button type="button" class="ar-btn dodge" data-btn="dodge" aria-label="회피"><b>💨</b><small>회피</small><i class="cd" id="ar-cd-dodge"></i></button>
        <button type="button" class="ar-btn ult" data-btn="ult" id="ar-ult" aria-label="필살기">${artImg('ult-icon', 'ar-ult-ico')}<b class="ar-ult-txt">필살</b><svg viewBox="0 0 36 36" aria-hidden="true"><circle cx="18" cy="18" r="16" pathLength="100" id="ar-ult-ring"/></svg></button>
        <button type="button" class="ar-btn skill2" data-btn="skill2" id="ar-skill2" aria-label="스킬 2"><b id="ar-skill2-ico">🌀</b><small id="ar-skill2-name">스킬 2</small><i class="cd" id="ar-cd-skill2"></i></button>
        <button type="button" class="ar-btn skill" data-btn="skill" id="ar-skill" aria-label="스킬 1"><b id="ar-skill-ico">✨</b><small id="ar-skill-name">스킬</small><i class="cd" id="ar-cd-skill"></i></button>
        <button type="button" class="ar-btn atk" data-btn="atk" aria-label="공격"><b>👊</b><small>공격</small></button>
      </div>
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
  R.teams = { me: fighters(r.me), foe: fighters(r.foe.team) };
  R.sim = createArena({ seed: r.seed, me: R.teams.me, foe: R.teams.foe, foeLevel: r.foe_level });
  Object.assign(R, { inputs: [], queue: [], dir: 0, sentDir: 0, holdAtk: false, keyDown: new Set(), playing: true, paused: false, pausedMs: 0, started: false });
  app()?.classList.add('playing');
  main(field()); artGuard();
  preloadPoses();
  applyLite();
  R.fxN = 0; R.lag = { last: 0, longs: [] };
  R.geo = null;
  R.resize = () => { R.geo = null; };
  window.addEventListener('resize', R.resize);
  bindPad();
  R.prev = R.sim.view(); R.cur = R.prev;
  drawMon('me'); drawMon('foe'); drawHud(); drawPad();
  place(0);
  countIn();
}
async function countIn() {
  for (const n of ['3', '2', '1']) { pop(n, 50, 45, 'count'); sfx('tm-count'); await wait(1000); if (!R?.playing) return; }
  pop('FIGHT!', 50, 45, 'count go'); sfx('tm-go'); buzz(40);
  R.t0 = performance.now(); R.started = true;
  R.raf = requestAnimationFrame(loop);
}

// 공격 · 맞는 자세 그림을 미리 받아 둔다(처음 바뀔 때 끊기지 않게). 없는 자세는 expressionSrc가 null.
function preloadPoses() {
  R.poses = new Map();
  for (const who of ['me', 'foe']) R.teams[who].forEach((f, i) => {
    for (const pose of ['attack', 'hurt']) {
      const src = expressionSrc(f.key, R.forms[who][i], pose); if (!src) continue;
      const img = new Image(); img.decoding = 'async'; img.src = src;
      img.decode?.().then(() => R?.poses?.set(src, true)).catch(() => {});
    }
  });
}
const poseReady = src => !!src && R.poses?.get(src) === true;
// 저사양 자동 단계(야차전과 같은 기준): 3초 안에 50ms 넘는 프레임이 8번을 넘으면 가벼운 연출로, 7일 기억.
const pref = (k, d) => { try { return localStorage.getItem(k) ?? d; } catch { return d; } };
const liteOn = () => { const at = Number(pref(LITE_KEY, 0)); return at > 0 && Date.now() - at < LITE_DAYS * 86400000; };
function applyLite() { const on = liteOn(); app()?.classList.toggle('ar-lite', on); fxLite(on); }
function lagWatch(t) {
  const L = R.lag;
  if (L.last && !document.hidden) {
    const d = t - L.last;
    if (d > LITE_LONG_MS && d < 1000) {
      L.longs.push(t);
      while (L.longs[0] < t - LITE_WINDOW_MS) L.longs.shift();
      if (L.longs.length > LITE_LONG_COUNT && pref(LITE_KEY, '') !== 'off' && !liteOn()) { try { localStorage.setItem(LITE_KEY, String(Date.now())); } catch {} applyLite(); }
    }
  }
  L.last = t;
}

/* 조이스틱 · 버튼(누르는 순간 반응하도록 pointerdown) */
function bindPad() {
  const stick = $('ar-stick'), pad = $('ar-pad');
  if (!stick || !pad) return;
  let id = null, cx = 0, cy = 0, rad = 50;
  const move = e => {
    const dx = (e.clientX - cx) / rad, dy = (e.clientY - cy) / rad, l = Math.sqrt(dx * dx + dy * dy), k = l > 1 ? 1 / l : 1;
    R.dir = dirCode(dx, dy, 0.28);
    drawStick(dx * k, dy * k);
  };
  stick.addEventListener('pointerdown', e => {
    if (!R?.playing) return;
    e.preventDefault(); unlockSound();
    const b = stick.getBoundingClientRect(); cx = b.left + b.width / 2; cy = b.top + b.height / 2; rad = b.width * 0.42;
    id = e.pointerId; try { stick.setPointerCapture(id); } catch {}
    move(e);
  });
  stick.addEventListener('pointermove', e => { if (e.pointerId === id) move(e); });
  const up = e => { if (e.pointerId !== id) return; id = null; R.dir = 0; drawStick(0, 0); };
  stick.addEventListener('pointerup', up); stick.addEventListener('pointercancel', up);
  pad.addEventListener('pointerdown', e => {
    const b = e.target.closest('[data-btn]'); if (!b) return;
    e.preventDefault(); unlockSound();
    b.classList.add('down');
    try { b.setPointerCapture(e.pointerId); } catch {}
    press(b.dataset.btn, true);
  });
  const release = e => { const b = e.target.closest('[data-btn]'); if (!b) return; b.classList.remove('down'); if (b.dataset.btn === 'atk') press('atk', false); };
  pad.addEventListener('pointerup', release); pad.addEventListener('pointercancel', release);
  pad.addEventListener('contextmenu', e => e.preventDefault());
}
function drawStick(x, y) {
  const k = $('ar-knob'); if (k) k.style.transform = `translate(${x * 34}px, ${y * 34}px)`;
}

function drawMon(who) {
  const s = R.cur[who], f = s.team[s.idx], el = $(`ar-${who}-body`);
  if (el) el.innerHTML = petImg(f.key, R.forms[who][s.idx], 'ar-pet-img');
  $(`ar-${who}`)?.classList.remove('down');
  if (who === 'me') {
    const k = R.teams.me[s.idx].skill, n = $('ar-skill-name'), ico = $('ar-skill-ico');
    if (n) n.textContent = k.name;
    if (ico) ico.textContent = { burst: '✨', boost: '💪', poison: '☠️', guard: '🛡️' }[k.kind] || '✨';
    $('ar-skill')?.style.setProperty('--c1', pal(R.teams.me[s.idx].el).c1);
    const k2 = R.teams.me[s.idx].skill2, n2 = $('ar-skill2-name'), i2 = $('ar-skill2-ico');
    if (n2) n2.textContent = k2.name;
    if (i2) i2.textContent = S2_ICON[k2.kind] || '🌀';
    $('ar-skill2')?.style.setProperty('--c1', pal(R.teams.me[s.idx].el).c2);
  }
}
function drawHud() {
  const v = R.cur;
  const a = $('ar-hud-foe'), b = $('ar-hud-me');
  if (a) a.innerHTML = hudHtml('foe', R.r.foe.name, v.foe.team, v.foe.idx);
  if (b) b.innerHTML = hudHtml('me', '나', v.me.team, v.me.idx);
  drawHp();
}
function drawHp() {
  for (const who of ['me', 'foe']) {
    const s = R.cur[who], f = s.team[s.idx], el = $(`ar-${who}-hp`), sh = $(`ar-${who}-sh`);
    if (el) { const p = Math.max(0, f.cur / f.hp); el.style.transform = `scaleX(${p})`; el.classList.toggle('low', p < .3); }
    if (sh) sh.style.transform = `scaleX(${Math.min(1, s.shield / f.hp * 2)})`;
  }
}
// 버튼 쿨타임 · 필살기 링(바뀔 때만 쓴다).
function drawPad() {
  const m = R.cur.me, set = (id, frac) => { const el = $(id); if (!el) return; const v = Math.round(frac * 100); if (el._v !== v) { el._v = v; el.style.transform = `scaleY(${frac})`; el.parentElement?.classList.toggle('wait', frac > 0); } };
  const f = R.teams.me[m.idx];
  set('ar-cd-skill', Math.max(0, m.skill) / (f.skillCd || ARENA.SKILL_TICKS));
  set('ar-cd-skill2', Math.max(0, m.skill2) / (f.skill2Cd || ARENA.SKILL2_TICKS));
  set('ar-cd-dodge', Math.max(0, m.dodgeCd) / (f.dodgeCd || ARENA.DODGE_CD));
  const alive = m.team.filter((f, i) => f.cur > 0 && i !== m.idx).length;
  set('ar-cd-swap', alive ? Math.max(0, m.swapCd) / ARENA.SWAP_CD : 1);
  const g = Math.floor(m.gauge), ring = $('ar-ult-ring');
  if (ring && ring._g !== g) { ring._g = g; ring.style.strokeDashoffset = String(100 - g); $('ar-ult')?.classList.toggle('full', g >= ARENA.GAUGE_MAX); }
}
// 경기장 좌표(%) → 픽셀(화면 크기가 바뀔 때만 다시 잰다).
const geo = () => R.geo ||= (() => { const el = $('ar-field'); return el ? { w: el.clientWidth, h: el.clientHeight } : { w: 360, h: 400 }; })();
const px = (x, y) => { const g = geo(); return { x: x / 100 * g.w, y: y / 100 * g.h }; };
function place(frac) {
  for (const who of ['me', 'foe']) {
    const a = R.prev[who], b = R.cur[who], el = $(`ar-${who}`); if (!el) continue;
    const jump = a.idx !== b.idx || Math.abs(b.x - a.x) > 12; // 교체 · 밀쳐내기는 한 번에
    const x = jump ? b.x : a.x + (b.x - a.x) * frac, y = jump ? b.y : a.y + (b.y - a.y) * frac;
    const p = px(x, y);
    el.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%, -80%)`;
    el.style.zIndex = String(10 + Math.round(y));
    const flags = [b.fx < -0.1 || (Math.abs(b.fx) <= 0.1 && R.cur[who === 'me' ? 'foe' : 'me'].x < x) ? 'flip' : '', b.enter > 0 ? 'hidden' : '', b.stun > 0 ? 'stun' : '', b.slow > 0 ? 'slow' : '',
      b.boost > 0 ? 'boost' : '', b.shield > 0 ? 'shield' : '', b.poison > 0 ? 'poison' : '', b.inv > 0 && b.dash > 0 ? 'inv' : '', b.power2 > 0 ? 'charged' : ''].join(' ');
    if (el._flags !== flags) {
      el._flags = flags;
      const cls = el.classList;
      for (const [k, on] of [['flip', flags.includes('flip')], ['hidden', b.enter > 0], ['stun', b.stun > 0], ['slow', b.slow > 0], ['boost', b.boost > 0], ['shield', b.shield > 0], ['poison', b.poison > 0], ['inv', b.inv > 0 && b.dash > 0], ['charged', b.power2 > 0]]) cls.toggle(k, on);
    }
  }
  // 날아가는 공격 · 지진 표시(정해진 개수의 칸을 다시 쓴다).
  const shots = R.cur.shots;
  for (let i = 0; i < SHOTS_MAX; i++) {
    const el = $(`ar-shot-${i}`), s = shots[i]; if (!el) continue;
    if (!s) { if (el._on) { el._on = false; el.style.opacity = '0'; } continue; }
    const p = px(s.x, s.y), P = pal(s.el), key = `${s.el}${s.kind}${s.r}`;
    if (el._key !== key) { el._key = key; el.style.setProperty('--c1', P.c1); el.style.setProperty('--c2', P.c2); el.style.setProperty('--sz', `${Math.round(s.r * 2 / 100 * geo().w + 6)}px`); el.className = `ar-shot ${s.kind} ${s.from}`; }
    el._on = true; el.style.opacity = '1';
    el.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%, -50%)`;
  }
  const qs = R.cur.quakes;
  for (let i = 0; i < WARN_MAX; i++) {
    const el = $(`ar-warn-${i}`), q = qs[i]; if (!el) continue;
    if (!q) { if (el._on) { el._on = false; el.style.opacity = '0'; } continue; }
    const p = px(q.x, q.y), w = q.r * 2 / 100 * geo().w;
    el._on = true; el.style.opacity = '1';
    if (el._from !== q.from) { el._from = q.from; el.className = `ar-warn ${q.from}`; }
    el.style.width = `${w}px`; el.style.height = `${w * 0.55}px`;
    el.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%, -50%) scale(${(1.15 - Math.max(0, q.left) / 14 * 0.3).toFixed(3)})`;
  }
  const ms = R.cur.mines || [];
  for (let i = 0; i < MINE_MAX; i++) {
    const el = $(`ar-mine-${i}`), m = ms[i]; if (!el) continue;
    if (!m) { if (el._on) { el._on = false; el.style.opacity = '0'; } continue; }
    const p = px(m.x, m.y);
    if (!el._on) { el._on = true; el.style.opacity = '1'; el.className = `ar-mine ${m.from}`; el.style.setProperty('--c1', pal(m.el).c1); }
    el.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%, -50%)`;
  }
}
function loop(now) {
  if (!R?.playing) return;
  lagWatch(now);
  if (R.paused) { R.raf = requestAnimationFrame(loop); return; }
  const want = Math.floor((now - R.t0 - R.pausedMs) / ARENA.TICK_MS);
  let n = 0;
  const behind = want - R.sim.S.t > 12; // 많이 밀렸으면(다른 탭) 효과 없이 따라잡는다
  while (R.sim.S.t < want && !R.sim.S.over && n++ < 60) tickOnce(!behind);
  if (R.sim.S.over) return end();
  const frac = Math.max(0, Math.min(1, (now - R.t0 - R.pausedMs) / ARENA.TICK_MS - R.sim.S.t + 1));
  place(frac);
  drawPad();
  clock();
  R.raf = requestAnimationFrame(loop);
}
function clock() {
  const s = Math.max(0, Math.ceil((ARENA.MAX_TICKS - R.sim.S.t) * ARENA.TICK_MS / 1000)), el = $('ar-clock');
  if (el && el._s !== s) { el._s = s; el.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; el.classList.toggle('low', s <= 15); }
}
// 한 틱: 이번 틱의 조작을 기록 · 전투에 넣고 → 한 걸음 → 사건 그리기.
function tickOnce(show) {
  const t = R.sim.S.t, add = c => { const x = [t, c]; R.inputs.push(x); R.sim.push(x); };
  if (R.dir !== R.sentDir) { R.sentDir = R.dir; add(R.dir); }
  const q = R.queue.splice(0);
  if (R.holdAtk && R.cur.me.cd <= 1 && !q.includes(INPUT.ATK)) q.push(INPUT.ATK);
  for (const c of q) if (R.inputs.length < ARENA.INPUT_MAX - 2) add(c);
  R.prev = R.cur;
  const ev = R.sim.step();
  R.cur = R.sim.view();
  for (const e of ev) onEvent(e, show);
}
function onEvent(e, show) {
  if (e.e === 'enter') { if (show) { const s = R.cur[e.who]; pop(`${petName(e.key)} 등장!`, s.x, s.y - 12, 'enter'); sfx('swoosh'); } return; }
  if (e.e === 'swap') { R.prev = R.cur; drawMon(e.who); drawHud(); if (show && !R.fainted?.[e.who]) { pop('교체!', 50, e.who === 'me' ? 80 : 20, 'enter'); sfx('swoosh'); } if (R.fainted) R.fainted[e.who] = false; return; }
  if (e.e === 'faint') { const el = $(`ar-${e.who}`); (R.fainted ||= {})[e.who] = true; drawHud(); if (show) { faintFx(e); banner(e.who === 'me' ? `${petName(e.key)} 쓰러짐…` : `${petName(e.key)} 쓰러뜨렸다!`, e.who); sfx('faint'); buzz([40, 30, 40]); } el?.classList.remove('down'); return; }
  if (e.e === 'over') return;
  if (e.e === 'dmg') { drawHp(); if (show) hurt(e); return; }
  if (e.e === 'buff') { drawHp(); if (show) { pop(e.name, R.cur[e.who].x, R.cur[e.who].y - 20, `skill ${e.who}`); sfx('skill'); aura(e.who, e.el); } return; }
  if (!show) return;
  if (e.e === 'cutin') return cutin(e);
  if (e.e === 'ult') return ultFx(e);
  if (e.e === 'skillname') { pop(e.name, R.cur[e.who].x, R.cur[e.who].y - 20, `skill ${e.who}`); sfx('skill'); return; }
  if (e.e === 'atk' || e.e === 'skill' || e.e === 'skill2') return attack(e);
  if (e.e === 'pop') { if (e.kind === 'atk') spark(px(e.x, e.y), e.el); else fxImpact($('ar-field'), px(e.x, e.y), e.el, 2); return; }
  if (e.e === 'blink') { afterimage(e.who); sfx('swoosh', { rate: 1.5 }); return; }
  if (e.e === 'blinked') { R.prev = R.cur; pop('다음 공격 2배!', e.x, e.y - 22, `skill ${e.who}`); return; }
  if (e.e === 'pull') return void pop('끌려옴!', R.cur[e.who].x, R.cur[e.who].y - 22, 'stun');
  if (e.e === 'boom') { quake(px(e.x, e.y), e.el, e.kind !== 'atk'); sfx('smash'); if (R.cur.me && Math.abs(R.cur.me.x - e.x) < e.r + 5 && Math.abs(R.cur.me.y - e.y) < e.r + 5) buzz(25); return; }
  if (e.e === 'dodge') { afterimage(e.who); sfx('swoosh', { rate: 1.3 }); return; }
  if (e.e === 'stun') return void pop('기절!', R.cur[e.who].x, R.cur[e.who].y - 22, 'stun');
  if (e.e === 'slow') return void pop('느려짐', R.cur[e.who].x, R.cur[e.who].y - 22, 'stun');
  if (e.e === 'poison') return void pop('중독!', R.cur[e.who].x, R.cur[e.who].y - 22, 'stun');
  if (e.e === 'knock') return void pop('밀려남!', R.cur[e.who].x, R.cur[e.who].y - 22, 'stun');
}
function cutin(e) {
  const fieldEl = $('ar-field');
  fxSkillCutIn(fieldEl, { side: e.who, portrait: petImg(e.key, e.form), name: e.name, petName: petName(e.key), el: e.el, rank: e.rank });
  sfx('ult-riser'); buzz(60);
  app()?.classList.add('ult');
  later(() => app()?.classList.remove('ult'), ARENA.ULT_FREEZE_TICKS * ARENA.TICK_MS);
  if (e.who === 'foe') later(() => pop('회피하면 피할 수 있어요!', 50, 92, 'hint'), 200);
}
function ultFx(e) {
  const fieldEl = $('ar-field'), to = px(e.tx, e.ty), from = px(e.x, e.y);
  beam(from, to, e.el, true);
  quake(to, e.el, true);
  fxImpact(fieldEl, to, e.el, 3);
  fxPunch(app(), .06); app()?.classList.add('shake'); later(() => app()?.classList.remove('shake'), 420);
  sfx('ult-impact');
}
function attack(e) {
  const fieldEl = $('ar-field'), from = px(e.x, e.y);
  const s = R.cur[e.who], f = s.team[s.idx];
  const src = expressionSrc(f.key, R.forms[e.who][s.idx], 'attack');
  if (poseReady(src)) swapPose($(`ar-${e.who}-body`), src, 300);
  if (e.shape === 'claw') { slash(from, e.nx, e.ny, e.el); sfx(atkSfx(e.el), { rate: 1.15 }); return; }
  if (e.shape === 'dash') { fxSpeedLines(fieldEl, from, e.el); sfx('swoosh'); return; }
  if (e.shape === 'quake' || e.shape === 'nova') { sfx('smash', { rate: 1.3 }); return; }
  if (e.shape === 'trap') { sfx('stamp'); return; }
  if (e.shape === 'hook') { sfx('swoosh', { rate: .8 }); return; }
  sfx(atkSfx(e.el), { rate: e.e === 'skill' ? .85 : 1.1 });
}
const atkSfx = el => el === 'leaf' ? 'atk-leaf' : el === 'wind' ? 'atk-wind' : 'atk-star';
function hurt(e) {
  if (e.kind !== 'poison') {
    fxRecoil($(`ar-${e.who}-body`), e.who === 'me' ? 1 : -1);
    const s = R.cur[e.who], f = s.team[s.idx];
    if (f) { const src = expressionSrc(f.key, R.forms[e.who][s.idx], 'hurt'); if (poseReady(src)) swapPose($(`ar-${e.who}-body`), src, 300); }
  }
  pop(e.blocked && !e.dmg ? '막음!' : String(e.dmg), e.x + (Math.random() * 8 - 4), e.y - 16, `dmg ${e.kind}${e.who === 'me' ? ' me' : ''}`);
  if (e.m > 1 && e.kind !== 'atk' && e.kind !== 'poison') pop('효과가 굉장해!', e.x, e.y - 27, 'eff');
  else if (e.m < 1 && e.kind !== 'atk' && e.kind !== 'poison') pop('효과가 별로…', e.x, e.y - 27, 'eff weak');
  if (e.kind !== 'poison') sfx(e.kind === 'ult' ? 'crit' : 'hit', { rate: e.kind === 'atk' ? 1.1 : .9 });
  if (e.who === 'me' && e.kind !== 'atk' && e.kind !== 'poison') buzz(30);
}
function spark(at, el) {
  const P = pal(el);
  fxEl('spark', { left: `${at.x}px`, top: `${at.y}px`, '--c1': P.c1, '--c2': P.c2 }, 320);
}
function swapPose(body, src, ms) {
  const img = body?.querySelector('img'); if (!img || !src) return;
  const still = img._still ||= img.getAttribute('src');
  if (img.getAttribute('src') !== src) img.setAttribute('src', src);
  clearTimeout(img._t);
  img._t = setTimeout(() => img.setAttribute('src', still), ms);
  img.onerror = () => { img.onerror = null; img.setAttribute('src', still); };
}
function fxEl(cls, css, ms, html = '') {
  const f = $('ar-field'); if (!f) return null;
  if (R.fxN >= FX_MAX) return null; // 효과 조각 상한(렉 방지)
  R.fxN++;
  const el = document.createElement('div');
  el.className = `ar-fx ${cls}`;
  for (const [k, v] of Object.entries(css)) k.startsWith('--') ? el.style.setProperty(k, v) : (el.style[k] = v);
  el.innerHTML = html;
  f.appendChild(el);
  const cur = R;
  setTimeout(() => { el.remove(); if (cur.fxN > 0) cur.fxN--; }, ms);
  return el;
}
function beam(from, to, el, big) {
  const dx = to.x - from.x, dy = to.y - from.y, len = Math.sqrt(dx * dx + dy * dy), ang = Math.atan2(dy, dx) * 180 / Math.PI, P = pal(el);
  fxEl(`beam${big ? ' big' : ''}`, { left: `${from.x}px`, top: `${from.y}px`, width: `${len}px`, transform: `rotate(${ang}deg)`, '--c1': P.c1, '--c2': P.c2, '--c3': P.c3 }, big ? 700 : 380);
}
function slash(at, nx, ny, el) {
  const P = pal(el), ang = Math.atan2(ny, nx) * 180 / Math.PI;
  fxEl('claw', { left: `${at.x + nx * 30}px`, top: `${at.y + ny * 24 - 20}px`, transform: `translate(-50%,-50%) rotate(${ang}deg)`, '--c1': P.c1, '--c2': P.c2 }, 300);
}
function quake(at, el, big) {
  const P = pal(el);
  fxEl(`quake${big ? ' big' : ''}`, { left: `${at.x}px`, top: `${at.y}px`, '--c1': P.c1, '--c2': P.c2 }, 700);
  fxEl('crack', { left: `${at.x}px`, top: `${at.y}px` }, 900);
}
function afterimage(who) {
  const mon = $(`ar-${who}`); if (!mon) return;
  const ghost = mon.cloneNode(true);
  ghost.removeAttribute('id'); ghost.querySelectorAll('[id]').forEach(x => x.removeAttribute('id'));
  ghost.classList.add('ghost');
  mon.parentElement?.appendChild(ghost);
  setTimeout(() => ghost.remove(), 320);
}
function aura(who, el) {
  const mon = $(`ar-${who}`); if (!mon) return;
  mon.style.setProperty('--c1', pal(el).c1);
  mon.classList.remove('buffing'); requestAnimationFrame(() => mon.classList.add('buffing'));
}
function pop(text, x, y, cls = '') {
  return fxEl(`pop ${cls}`, { left: `${x}%`, top: `${y}%` }, cls.includes('count') ? 950 : cls.includes('hint') ? 1800 : 1000, esc(text));
}
function faintFx(e) {
  const fieldEl = $('ar-field'); if (!fieldEl) return;
  const p = px(e.x, e.y);
  const ghost = document.createElement('div');
  ghost.className = 'ar-fx ar-down-ghost';
  ghost.style.left = `${p.x}px`; ghost.style.top = `${p.y}px`;
  ghost.innerHTML = petImg(e.key, R.forms[e.who][e.idx], 'ar-pet-img');
  fieldEl.appendChild(ghost); setTimeout(() => ghost.remove(), 1000);
  const img = document.createElement('img');
  img.className = 'ar-faint'; img.src = '/assets/arena/fx-faint.webp'; img.alt = ''; img.onerror = () => img.remove();
  img.style.left = `${p.x}px`; img.style.top = `${p.y}px`;
  fieldEl.appendChild(img); later(() => img.remove(), 1400);
}
function banner(text, who) {
  const el = document.createElement('div');
  el.className = `ar-banner ${who}`; el.textContent = text;
  $('ar-play')?.appendChild(el);
  later(() => el.remove(), 1500);
}

/* ---------- 잠깐 멈춤 ---------- */
function pause() { if (!R?.playing || R.paused) return; R.paused = true; R.pauseAt = performance.now(); R.holdAtk = false; R.dir = 0; drawStick(0, 0); }
function resume() { if (!R?.paused) return; R.pausedMs += performance.now() - R.pauseAt; R.paused = false; }
function onVisibility() { if (document.hidden) pause(); else if (!document.querySelector('.ar-quit')) resume(); }

/* ---------- 끝 ---------- */
async function end() {
  R.playing = false; R.holdAtk = false;
  cancelAnimationFrame(R.raf);
  place(1);
  const local = R.sim.S.winner;
  banner(local === 'me' ? '승리!' : local === 'draw' ? '무승부' : '패배…', local === 'me' ? 'me win' : 'foe');
  sfx(local === 'me' ? 'fanfare-epic' : 'fail');
  await wait(1400);
  if (!R) return;
  main('<div class="ar-saving">기록하는 중…</div>');
  let res = null;
  try { res = await api('/games/arena/finish', { id: R.r.id, inputs: R.inputs }); }
  catch (err) { res = { paid: false, reason: 'error', error: err.message }; }
  if (!R) return;
  if (res?.stats) Object.assign(R.A.data.stats, res.stats);
  if (typeof res?.points_balance === 'number') R.A.data.stats.points_balance = res.points_balance;
  R.view = { ...R.view, left: res?.left ?? R.view?.left, tickets: res?.tickets ?? R.view?.tickets, wins: res?.wins ?? R.view?.wins, streak: res?.streak ?? R.view?.streak, best_streak: res?.best_streak ?? R.view?.best_streak };
  R.A.data.rewards ||= {}; R.A.data.rewards.arena = R.view;
  result(local, res);
}
function result(local, res) {
  const winner = res?.winner || local, win = winner === 'me', coins = Number(res?.coins || 0), xp = Number(res?.xp || 0);
  const ko = res?.ko ?? R.sim.S.ko.me, dealt = res?.dealt ?? R.sim.S.dealt.me;
  const why = res?.reason === 'daily' ? `오늘 코인 판(${ARENA.DAILY}판)을 다 썼어요. 기록은 남아요!`
    : res?.reason === 'ticket' ? '입장권이 없어서 연습 판이었어요. 단어 연습을 끝까지 풀면 입장권을 받아요!'
    : res?.reason === 'error' ? esc(res.error || '저장하지 못했어요.')
    : res?.reason === 'short' || res?.reason === 'stale' ? '이번 대전은 기록되지 않았어요.'
    : !win && res?.paid && !coins ? '상대 펫을 한 마리라도 쓰러뜨리면 져도 코인을 받아요.' : '';
  const team = R.r.me;
  main(`<section class="ar-result ${win ? 'win' : 'lose'}">
    <div class="ar-res-card">
      <div class="ar-res-head">${winner === 'draw' ? '' : artImg(win ? 'banner-win' : 'banner-lose', 'ar-res-banner')}<h2>${win ? '승리!' : winner === 'draw' ? '무승부' : '아쉬운 패배'}</h2><p>vs ${esc(R.r.foe.name)}${res?.streak >= 2 && win ? ` · <b>${res.streak}연승!</b>` : ''}</p></div>
      <div class="ar-res-team">${team.map((f, n) => `<span style="--i:${n}" class="${R.sim.S.me.team[n].cur <= 0 ? 'down' : ''}">${petImg(f.key, f.form)}</span>`).join('')}</div>
      <div class="ar-res-rows"><span><small>쓰러뜨림</small><b>${num(ko)}</b></span><span><small>준 피해</small><b>${num(dealt)}</b></span><span><small>필살기</small><b>${res?.ults ?? R.sim.S.ults.me}</b></span></div>
      ${coins || xp ? `<div class="ar-res-gain">${coins ? `<span class="r coin">${coin()}<b>+${num(coins)}</b>${res?.streak_coins ? `<small>3연승 +${res.streak_coins} 포함</small>` : ''}</span>` : ''}${xp ? `<span class="r xp"><b>+${xp}</b><small>경험치</small></span>` : ''}</div>` : ''}
      ${why ? `<p class="ar-why">${why}</p>` : ''}
      <p class="ar-tip">${win ? '다음 판은 상대가 더 똑똑해질 수 있어요!' : '팁: 빨간 표시가 뜨면 회피! 상성이 좋은 펫으로 교체해 보세요.'}</p>
      <div class="ar-res-btns"><button type="button" class="yl-cta" data-ar="again">한 판 더</button><button type="button" class="btn full" data-ar="exit">놀이터로</button></div>
    </div>
  </section>`);
  artGuard();
  if (coins) { later(() => { sfx('coins'); coinShower(app(), 22); const b = $('ar-coins'); if (b) countUp(b, Number(R.A.data.stats?.points_balance || 0), 900); }, 500); }
}

// 상성표(도움말 · 검사용): '불꽃 → 풀 · 얼음'.
export const beatsText = () => Object.entries(BEATS).filter(([, v]) => v.length).map(([k, v]) => `${ELEMENTS[k].name} → ${v.map(x => ELEMENTS[x].name).join(' · ')}`);
