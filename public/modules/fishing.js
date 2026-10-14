import { api, esc, num, icon, toast, buttonBusy } from './ui.js';
import { avatar } from './character.js';
import { coin } from './emblems.js';
import { playSound, unlockSound, soundOn, preloadSound } from './sound.js';
import { coinShower } from './celebrate.js';
import { battleQuestions } from './battle-questions.js';
import { FISHING, FISH, FISH_KEYS, LURES, RARITY, rollCast, replayFishing, kgText } from './fishing-rules.js';
import { fishPic, fishShadow } from './fishing-art.js';

// V13.149 단어 낚시(혼자): 전체 화면 연못. 던지기 → 찌가 떨어져 출렁 → 입질! → 뜻 4지선다 → 낚음/놓침.
// 어떤 물고기인지는 서버가 준 seed로 정한다(fishing-rules.js rollCast). 끝나면 답 목록을 보내 서버가 다시 굴려 보상한다.

let F = null;
const root = () => document.getElementById('app');
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)');
const reduced = () => REDUCED.matches;
const sfx = (key, opts) => { if (soundOn()) playSound(key, opts); };
const buzz = p => { try { if (soundOn()) navigator.vibrate?.(p); } catch {} };
function later(fn, ms) { const cur = F; const t = setTimeout(() => { if (F === cur && !cur.closing) fn(); }, ms); cur.timers.push(t); return t; }

export function openFishing(A, exit, opts = {}) {
  closeAll();
  F = { A, exit, timers: [], words: opts.words || [], codes: opts.codes || [], label: opts.label || '', view: A.data.rewards?.fish || null };
  A.screen = 'fishing';
  root().innerHTML = `<div class="session-app fs-app"><header class="fs-top"><button type="button" class="yb-back" data-fs="exit" aria-label="나가기">${icon('back')}</button><strong>단어 낚시</strong><span class="fs-top-note">${esc(F.label)}</span><button type="button" class="fs-book-btn" data-fs="book" aria-label="어항 도감">🐟 도감</button></header><main id="fs-main" class="fs-main"></main></div>`;
  root().onclick = onClick;
  window.scrollTo(0, 0);
  preloadSound(['clear', 'fanfare-basic', 'fanfare-epic', 'fanfare-legend']);
  intro();
}
function closeAll() { if (!F) return; F.closing = true; F.timers.forEach(clearTimeout); cancelAnimationFrame(F.raf); }
async function leave() { const exit = F?.exit; closeAll(); root().onclick = null; F = null; await exit?.(); }
const main = html => { const el = document.getElementById('fs-main'); if (el) el.innerHTML = html; };

function onClick(event) {
  const b = event.target.closest('[data-fs]');
  if (!b || b.disabled || !F) return;
  unlockSound();
  const act = b.dataset.fs;
  if (act === 'exit') return F.playing ? confirmQuit() : leave();
  if (act === 'start') return start(b);
  if (act === 'cast') return cast();
  if (act === 'pick') return answer(Number(b.dataset.i), b);
  if (act === 'next') return nextCast();
  if (act === 'again') return intro();
  if (act === 'book') return book();
  if (act === 'book-close') { document.querySelector('.fs-bookwrap')?.remove(); return; }
  if (act === 'quit-yes') return leave();
  if (act === 'quit-no') { document.querySelector('.mg-quit')?.remove(); return; }
}
function confirmQuit() {
  if (document.querySelector('.mg-quit')) return;
  const box = document.createElement('div');
  box.className = 'mg-quit';
  box.innerHTML = '<div><b>낚시를 그만할까요?</b><p>이번 판에 낚은 물고기는 기록되지 않아요.</p><button type="button" class="btn" data-fs="quit-no">계속하기</button><button type="button" class="btn primary" data-fs="quit-yes">그만하기</button></div>';
  root().querySelector('.fs-app')?.appendChild(box);
}

/* ---------- 장면 ---------- */
// 하늘 · 해 · 섬 · 물결 세 겹 · 배(내 펫) · 낚싯줄 · 찌.
function scene(inner = '') {
  const pet = F.A.data.stats?.pet;
  return `<div class="fs-scene" id="fs-scene">
    <div class="fs-sky"><i class="fs-sun"></i><i class="fs-cloud c1"></i><i class="fs-cloud c2"></i><i class="fs-isle"></i></div>
    <div class="fs-water"><i class="fs-wave w1"></i><i class="fs-wave w2"></i><i class="fs-wave w3"></i><div class="fs-deep" id="fs-deep"></div></div>
    <div class="fs-boat" id="fs-boat"><div class="fs-pet" id="fs-pet">${pet ? avatar(pet.key, { form: Math.max(1, pet.form ?? 1) }) : ''}</div><svg class="fs-hull" viewBox="0 0 160 60" aria-hidden="true"><defs><linearGradient id="fsh" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c0784a"/><stop offset="1" stop-color="#7c4526"/></linearGradient></defs><path d="M6 14h148l-18 38H24z" fill="url(#fsh)" stroke="#5a3019" stroke-width="3" stroke-linejoin="round"/><path d="M14 24h132" stroke="#e7b48a" stroke-width="3" opacity=".7"/><circle cx="40" cy="34" r="4" fill="#f6e3c8"/><circle cx="120" cy="34" r="4" fill="#f6e3c8"/></svg><i class="fs-rod"></i></div>
    <svg class="fs-line" id="fs-line" aria-hidden="true"><path id="fs-line-path" d="" /></svg>
    <div class="fs-bob" id="fs-bob" aria-hidden="true"><i></i></div>
    ${inner}
  </div>`;
}
function hud() {
  const lure = LURES[F.lure];
  return `<div class="fs-hud">
    <div class="fs-hud-casts"><small>던지기</small><b id="fs-n">${num(F.i)}</b><small>/ ${FISHING.CASTS}</small></div>
    <div class="fs-hud-kg"><small>총 무게</small><b id="fs-kg">${kgText(F.kg)}</b></div>
    <div class="fs-hud-lure l${F.lure}" id="fs-lure"><small>미끼</small><b>${esc(lure.name)}</b><span class="fs-run">${Array.from({ length: FISHING.LURE_UP }, (_, i) => `<i class="${i < F.run ? 'on' : ''}"></i>`).join('')}</span></div>
  </div>`;
}

/* ---------- 시작 화면 ---------- */
function intro() {
  F.playing = false;
  const v = F.view || {};
  const q = battleQuestions(F.words, 'speed', 60);
  const ok = q.length >= 8;
  main(`${scene(`<section class="fs-intro">
    <h1>단어 낚시</h1>
    <p>줄을 던지고 <b>입질!</b>이 오면 뜻을 골라요. <b>빨리 맞힐수록 큰 물고기</b>, 3연속 정답이면 미끼가 좋아져요.</p>
    <ul class="fs-lures">${LURES.map((l, i) => `<li class="l${i}"><i></i><b>${esc(l.name)}</b></li>`).join('<li class="arrow">›</li>')}</ul>
    <div class="mg-records"><div><small>어항 도감</small><b>${num(v.kinds || 0)}<small> / ${FISH_KEYS.length}</small></b></div><div><small>최고 무게</small><b>${v.best_kg ? kgText(v.best_kg) : '—'}</b></div><div><small>오늘 코인 판</small><b>${num(v.left ?? FISHING.DAILY)}<small> / ${FISHING.DAILY}</small></b></div></div>
    ${v.golden ? `<p class="fs-golden-note">🥚 황금 알 물고기 ${num(v.golden)} / ${FISHING.GOLDEN_EGG} · 다 모으면 알 선물!</p>` : ''}
    <button type="button" class="yl-cta" data-fs="start" ${ok ? '' : 'disabled'}>${ok ? '낚시 시작!' : '뜻이 서로 다른 단어가 8개 이상 필요해요'}</button>
  </section>`)}`);
  idleFish();
}
// 물속에 헤엄치는 그림자(장식).
function idleFish() {
  const deep = document.getElementById('fs-deep');
  if (!deep || reduced()) return;
  deep.innerHTML = Array.from({ length: 5 }, (_, i) => `<i class="fs-swim s${i}" style="--y:${20 + i * 14}%;--d:${9 + i * 2.5}s;--delay:${-i * 2.1}s;--sc:${.6 + (i % 3) * .25}"></i>`).join('');
}

async function start(button) {
  buttonBusy(button);
  try {
    const r = await api('/games/fish/start', { range_codes: F.codes });
    if (!F) return;
    Object.assign(F, { id: r.id, seed: r.seed, water: !!r.water });
    F.view = { ...F.view, ...r };
  } catch (err) {
    if (!F) return;
    buttonBusy(button, false);
    if (!err.transient) return toast(err.message);
    Object.assign(F, { id: null, seed: Math.floor(Math.random() * 2 ** 31) });
    toast('연결이 불안정해서 이번 판은 기록 없이 해요.');
  }
  F.questions = battleQuestions(F.words, 'speed', 60);
  F.qi = 0; F.i = 0; F.lure = 0; F.run = 0; F.kg = 0; F.answers = []; F.casts = []; F.playing = true;
  main(`${scene(`${hud()}<div class="fs-panel" id="fs-panel"></div><div class="fs-toast" id="fs-toast" aria-live="polite"></div>`)}`);
  idleFish();
  setLine('rest');
  ready();
}
function ready() {
  F.phase = 'ready';
  panel(`<button type="button" class="fs-cast-btn" data-fs="cast"><span>던지기!</span><small>${FISHING.CASTS - F.i}번 남음</small></button>`);
}
const panel = html => { const el = document.getElementById('fs-panel'); if (el) el.innerHTML = html; };

/* ---------- 낚싯줄 · 찌 ---------- */
// 찌 위치(장면 기준 %)를 정하고 낚싯대 끝에서 찌까지 줄을 그린다.
function setLine(state, x = F.bobX || 62, y = F.bobY || 64) {
  const sc = document.getElementById('fs-scene'), path = document.getElementById('fs-line-path'), bob = document.getElementById('fs-bob'), rod = document.querySelector('.fs-rod');
  if (!sc || !path || !bob || !rod) return;
  const S = sc.getBoundingClientRect(), R = rod.getBoundingClientRect();
  const tipX = R.right - S.left, tipY = R.top - S.top;
  const bx = S.width * x / 100, by = S.height * y / 100;
  bob.className = `fs-bob ${state}`;
  bob.style.left = `${bx}px`; bob.style.top = `${by}px`;
  if (state === 'rest' || state === 'gone') { path.setAttribute('d', `M${tipX},${tipY} q4,40 2,${S.height * .12}`); return; }
  const sag = state === 'tight' ? 4 : 40;
  path.setAttribute('d', `M${tipX},${tipY} Q${(tipX + bx) / 2},${Math.max(tipY, by) + sag} ${bx},${by}`);
}
function cast() {
  if (F.phase !== 'ready') return;
  F.phase = 'cast';
  panel('<div class="fs-wait"><b>기다리는 중…</b><small>찌가 쏙 들어가면 입질이에요!</small></div>');
  F.bobX = 52 + Math.random() * 30; F.bobY = 60 + Math.random() * 16;
  sfx('slash', { rate: 1.3, gain: .6 });
  document.getElementById('fs-pet')?.classList.add('casting');
  later(() => document.getElementById('fs-pet')?.classList.remove('casting'), 600);
  setLine('fly');
  later(() => { setLine('float'); splash(F.bobX, F.bobY, 'small'); sfx('pop', { rate: .7, gain: .5 }); }, reduced() ? 50 : 520);
  const wait = 1100 + Math.random() * 1300;
  F.castAt = performance.now();
  later(bite, wait + 520);
}
function bite() {
  F.phase = 'bite';
  setLine('bite');
  splash(F.bobX, F.bobY, 'bite');
  sfx('warn-beep', { rate: 1.4 }); buzz([60, 40, 60]);
  const q = F.questions[F.qi++ % F.questions.length];
  F.q = q;
  const n = FISHING.ANSWER_MS / 1000;
  panel(`<div class="fs-q">
    <div class="fs-q-head"><span class="fs-bite">입질!</span><svg class="fs-ring" viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="17"/><circle class="t" id="fs-ring" cx="20" cy="20" r="17" style="--d:${FISHING.ANSWER_MS}ms"/></svg><span class="fs-q-sec" id="fs-sec">${n}</span></div>
    <h2 class="fs-q-word">${esc(q.prompt)}</h2>
    <div class="fs-opts">${q.options.map((o, i) => `<button type="button" class="fs-opt" data-fs="pick" data-i="${i}">${esc(o)}</button>`).join('')}</div>
  </div>`);
  F.qAt = performance.now();
  const ring = document.getElementById('fs-ring'); requestAnimationFrame(() => ring?.classList.add('go'));
  const tick = () => {
    if (!F || F.phase !== 'bite') return;
    const left = FISHING.ANSWER_MS - (performance.now() - F.qAt), sec = document.getElementById('fs-sec');
    if (sec) sec.textContent = Math.max(0, Math.ceil(left / 1000));
    if (left <= 0) return answer(-1);
    F.raf = requestAnimationFrame(tick);
  };
  F.raf = requestAnimationFrame(tick);
}
function answer(i, button) {
  if (F.phase !== 'bite') return;
  F.phase = 'reel';
  cancelAnimationFrame(F.raf);
  const ms = Math.min(FISHING.ANSWER_MS, Math.round(performance.now() - F.qAt));
  const ok = i === F.q.answer;
  F.answers.push({ ok, ms });
  document.querySelectorAll('.fs-opt').forEach((b, k) => { b.disabled = true; if (k === F.q.answer) b.classList.add('right'); else if (k === i) b.classList.add('wrong'); });
  const used = F.lure;
  if (ok) {
    const fish = rollCast(F.seed, F.i, used, ms, { water: F.water });
    F.casts.push({ ok: true, ...fish });
    F.kg = Math.round((F.kg + fish.kg) * 100) / 100;
    F.run++;
    let up = false;
    if (F.run >= FISHING.LURE_UP) { F.run = 0; if (F.lure < LURES.length - 1) { F.lure++; up = true; } }
    later(() => reel(fish, ms, up), 380);
  } else {
    F.casts.push({ ok: false });
    F.run = 0;
    const down = F.lure > 0;
    F.lure = Math.max(0, F.lure - 1);
    later(() => snap(i < 0, down), 420);
  }
  F.i++;
}
function reel(fish, ms, up) {
  setLine('tight');
  sfx(fish.rarity === 'legend' || fish.rarity === 'golden' ? 'boss-charge' : 'type-ok', { gain: .7 });
  buzz(fish.rarity === 'legend' ? [80, 40, 120] : 30);
  // 물고기가 물 위로 튀어 오른다.
  const sc = document.getElementById('fs-scene');
  const jump = document.createElement('div');
  jump.className = `fs-jump r-${fish.rarity}`;
  jump.style.left = `${F.bobX}%`; jump.style.top = `${F.bobY}%`;
  jump.innerHTML = fishPic(fish.key);
  sc?.appendChild(jump);
  splash(F.bobX, F.bobY, 'big');
  later(() => { jump.remove(); catchCard(fish, ms, up); }, reduced() ? 100 : 900);
}
function catchCard(fish, ms, up) {
  const f = FISH[fish.key], fresh = !(F.view?.book || {})[fish.key] && !F.casts.slice(0, -1).some(c => c.key === fish.key);
  const speed = ms <= FISHING.FAST_MS ? '번개 같은 손! 큰 놈이에요' : ms <= FISHING.OK_MS ? '' : '조금 느렸어요';
  const big = fish.rarity === 'legend' || fish.rarity === 'golden' || fish.rarity === 'epic';
  panel(`<div class="fs-catch r-${fish.rarity}${big ? ' big' : ''}">
    ${big ? '<i class="fs-rays" aria-hidden="true"></i>' : ''}
    <span class="fs-rarity">${esc(RARITY[fish.rarity].name)}</span>${fresh ? '<span class="fs-new">새로 발견!</span>' : ''}
    <div class="fs-catch-art">${fishPic(fish.key, { cls: 'pop' })}</div>
    <h3>${esc(f.name)}</h3>
    <p class="fs-catch-kg"><b>${kgText(fish.kg)}</b>${speed ? `<small>${speed}</small>` : ''}</p>
    ${fish.key === 'goldenegg' ? '<p class="fs-golden-note">🥚 황금 알 물고기! 3마리를 모으면 알 선물이 와요.</p>' : ''}
    <button type="button" class="yl-cta" data-fs="next">${F.i >= FISHING.CASTS ? '결과 보기' : '다음 던지기'}</button>
  </div>`);
  sfx(fish.rarity === 'legend' || fish.rarity === 'golden' ? 'fanfare-legend' : fish.rarity === 'epic' ? 'fanfare-epic' : fish.rarity === 'rare' ? 'fanfare-basic' : 'correct');
  if (big) coinShower(document.querySelector('.fs-catch'), fish.rarity === 'epic' ? 10 : 18);
  updateHud(up);
  setLine('rest');
  if (up) toastLine(`미끼 업! <b>${esc(LURES[F.lure].name)}</b> · 더 크고 귀한 물고기가 와요`, 'up');
}
function snap(timeout, down) {
  setLine('gone');
  splash(F.bobX, F.bobY, 'small');
  sfx('fail', { gain: .7 }); buzz([40, 30, 40]);
  document.getElementById('fs-pet')?.classList.add('sad');
  later(() => document.getElementById('fs-pet')?.classList.remove('sad'), 1200);
  const answerText = F.q.options[F.q.answer];
  panel(`<div class="fs-miss">${fishShadow('carp')}<h3>${timeout ? '시간이 지나 놓쳤어요' : '줄이 끊어졌어요!'}</h3><p><b>${esc(F.q.prompt)}</b> = ${esc(answerText)}</p>${down ? `<small>미끼가 한 단계 내려갔어요 (${esc(LURES[F.lure].name)})</small>` : ''}<button type="button" class="yl-cta" data-fs="next">${F.i >= FISHING.CASTS ? '결과 보기' : '다시 던지기'}</button></div>`);
  updateHud(false);
}
function nextCast() {
  if (F.phase === 'cast' || F.phase === 'bite') return;
  if (F.i >= FISHING.CASTS) return finish();
  ready();
}
function updateHud(up) {
  const n = document.getElementById('fs-n'); if (n) n.textContent = num(F.i);
  const kg = document.getElementById('fs-kg'); if (kg) { kg.textContent = kgText(F.kg); kg.classList.remove('bump'); void kg.offsetWidth; kg.classList.add('bump'); }
  const lure = document.getElementById('fs-lure');
  if (lure) { lure.className = `fs-hud-lure l${F.lure}${up ? ' up' : ''}`; lure.querySelector('b').textContent = LURES[F.lure].name; lure.querySelectorAll('.fs-run i').forEach((x, k) => x.classList.toggle('on', k < F.run)); }
}
function toastLine(html, cls = '') {
  const el = document.getElementById('fs-toast');
  if (!el) return;
  el.innerHTML = `<span class="${cls}">${html}</span>`;
  later(() => { if (el.isConnected) el.innerHTML = ''; }, 2400);
}
function splash(x, y, size) {
  const sc = document.getElementById('fs-scene');
  if (!sc || reduced()) return;
  const s = document.createElement('div');
  s.className = `fs-splash ${size}`;
  s.style.left = `${x}%`; s.style.top = `${y}%`;
  s.innerHTML = '<i></i><i></i><i></i>' + Array.from({ length: size === 'big' ? 10 : 5 }, (_, k) => `<b style="--a:${-160 + k * (140 / (size === 'big' ? 9 : 4))}deg;--r:${size === 'big' ? 46 : 24}px"></b>`).join('');
  sc.appendChild(s);
  setTimeout(() => s.remove(), 1100);
}

/* ---------- 끝 ---------- */
async function finish() {
  F.playing = false; F.phase = 'done';
  panel('<div class="fs-wait"><b>어망을 정리하는 중…</b></div>');
  let res = null;
  const local = replayFishing(F.seed, F.answers, { water: F.water });
  if (F.id) {
    try { res = await api('/games/fish/finish', { id: F.id, answers: F.answers }); }
    catch (err) { res = { paid: false, reason: 'error', error: err.message }; }
    if (!F) return;
    if (res?.stats) Object.assign(F.A.data.stats, res.stats);
    if (typeof res?.points_balance === 'number') F.A.data.stats.points_balance = res.points_balance;
    if (res?.gifts) F.A.data.gifts = res.gifts;
    const keep = ['left', 'daily', 'best_kg', 'book', 'kinds', 'all', 'golden', 'total'];
    if (res && res.book) F.view = { ...F.view, ...Object.fromEntries(keep.filter(k => k in res).map(k => [k, res[k]])) };
    F.A.data.rewards ||= {}; F.A.data.rewards.fish = F.view;
  }
  result(res?.casts ? res : { ...local, casts: local.casts }, res);
}
function result(run, res) {
  const caught = run.casts.filter(c => c.ok);
  const best = [...caught].sort((a, b) => b.kg - a.kg)[0];
  const coins = Number(res?.coins || 0);
  const why = !F.id ? '연결이 안 돼서 기록 없이 했어요.' : res?.reason === 'daily' ? `오늘 코인 판(${FISHING.DAILY}판)을 다 썼어요. 도감과 기록은 남아요!` : res?.reason === 'error' ? esc(res.error || '저장하지 못했어요.') : res?.reason === 'short' ? '너무 빨리 끝나서 기록하지 못했어요.' : '';
  main(`<section class="fs-result">
    <div class="fs-result-top">${res?.record ? '<span class="mg-record-ribbon">최고 무게!</span>' : ''}<small>오늘의 어획량</small><b>${kgText(run.kg)}</b><span>${num(caught.length)}마리 / ${FISHING.CASTS}번</span></div>
    ${best ? `<div class="fs-best r-${best.rarity}"><span class="fs-rarity">${esc(RARITY[best.rarity].name)}</span><div class="fs-catch-art">${fishPic(best.key)}</div><b>${esc(FISH[best.key].name)}</b><small>${kgText(best.kg)} · 오늘의 대어</small></div>` : '<p class="yb-muted">이번 판은 한 마리도 못 낚았어요. 다음엔 꼭!</p>'}
    ${res?.fresh?.length ? `<p class="fs-fresh">📖 도감에 새로 올라간 물고기: ${res.fresh.map(k => `<b>${esc(FISH[k].name)}</b>`).join(' · ')}</p>` : ''}
    ${res?.egg ? '<p class="fs-golden-note big">🥚 황금 알 물고기 3마리! 선물 상자에 알이 도착했어요. 홈에서 열어 봐요!</p>' : ''}
    <div class="fs-net">${caught.map(c => `<span class="r-${c.rarity}">${fishPic(c.key)}<small>${kgText(c.kg)}</small></span>`).join('')}</div>
    ${coins ? `<div class="mg-result-coins">${coin()}<b>+${num(coins)}</b><small>경험치 +${num(res.xp || 0)}</small></div>` : why ? `<p class="mg-result-why">${why}</p>` : ''}
    <div class="mg-result-actions"><button type="button" class="yl-cta" data-fs="again">한 판 더!</button><button type="button" class="btn full" data-fs="book">🐟 어항 도감</button><button type="button" class="btn full" data-fs="exit">나가기</button></div>
  </section>`);
  if (coins) later(() => sfx('coins'), 600);
  if (res?.record || res?.egg) later(() => { sfx('fanfare-basic'); coinShower(document.querySelector('.fs-result'), 22); }, 400);
}

/* ---------- 어항 도감 ---------- */
function book() {
  document.querySelector('.fs-bookwrap')?.remove();
  const mine = F.view?.book || {};
  const order = ['common', 'uncommon', 'rare', 'epic', 'legend', 'golden'];
  const keys = [...FISH_KEYS].sort((a, b) => order.indexOf(FISH[a].rarity) - order.indexOf(FISH[b].rarity));
  const got = keys.filter(k => mine[k]?.n).length;
  const box = document.createElement('div');
  box.className = 'fs-bookwrap';
  box.innerHTML = `<section class="fs-book" role="dialog" aria-modal="true" aria-label="어항 도감">
    <header><h2>🐟 어항 도감</h2><span>${num(got)} / ${keys.length}</span><button type="button" class="icon-button" data-fs="book-close" aria-label="닫기">${icon('close')}</button></header>
    <div class="fs-book-bar"><i style="width:${Math.round(got / keys.length * 100)}%"></i></div>
    <div class="fs-tank">${keys.map(k => {
      const m = mine[k], f = FISH[k];
      return m?.n ? `<div class="fs-slot r-${f.rarity}"><span class="fs-rarity">${esc(RARITY[f.rarity].name)}</span>${fishPic(k)}<b>${esc(f.name)}</b><small>최고 ${kgText(m.kg)} · ${num(m.n)}마리</small></div>`
        : `<div class="fs-slot unknown r-${f.rarity}"><span class="fs-rarity">${esc(RARITY[f.rarity].name)}</span>${fishShadow(k)}<b>???</b><small>${f.rarity === 'golden' ? '아주 드물게 나와요' : `${esc(RARITY[f.rarity].name)} 물고기`}</small></div>`;
    }).join('')}</div>
  </section>`;
  box.onclick = e => { if (e.target === box) box.remove(); };
  root().querySelector('.fs-app')?.appendChild(box);
}
