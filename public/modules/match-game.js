import { api, esc, num, icon, toast, buttonBusy } from './ui.js';
import { avatar } from './character.js';
import { coin } from './emblems.js';
import { playSound, unlockSound, soundOn, preloadSound } from './sound.js';
import { coinShower, countUp } from './celebrate.js';
import { MATCH, matchPick, matchStars, matchTime } from './match-rules.js';

// V13.149 짝 맞추기 타임어택: 전체 화면. 영어 6장 + 뜻 6장, 짝을 맞히면 두 장이 날아가 부딪히며 터지고,
// 틀리면 흔들리며 1초가 시계로 날아간다. 시작 · 끝은 서버에 등록(server/games.mjs)해 기록과 코인을 남긴다.
// 고퀄 업그레이드: 카드 딜링 · 물결 뒤집기, 시간 링(별 기준선이 지나면 별이 떨어짐), 콤보 단계 · 피버 타임,
// 고스트(시작할 때 서버가 이번 주 전체 학생 중 바로 위 학생의 짝마다 시간을 줌), 마지막 한 쌍 슬로모션,
// 결과(별 도장 · 신기록 도장 · 코인이 지갑으로 날아감 · 틀린 단어 복습), 이번 주 반 시상대, 펫 반응.
// 클래스는 mt-(단어 미니게임의 mg-와 겹치지 않게).

// 그림(주문서 30)이 들어오면 이름을 넣는다. 없으면 코드 그림(CSS)으로 나온다.
// 'entry'(주문서 32)는 놀이터 짝 맞추기 카드 그림(public/assets/match/entry.webp, arcade-games.js matchCard).
export const MATCH_ART = new Set(['entry']);
const ART_NAMES = ['bg', 'card-en', 'card-ko', 'card-back', 'star', 'ribbon', 'stamp', 'podium', 'fever'];
const artStyle = () => ART_NAMES.filter(n => MATCH_ART.has(n)).map(n => `--art-${n}:url(/assets/match/${n}.webp)`).join(';');
const artClass = () => ART_NAMES.filter(n => MATCH_ART.has(n)).map(n => ` mt-art-${n}`).join('');

export const FEVER_AT = 3;                 // 연속 3쌍이면 피버 타임(연출만, 시간 규칙은 그대로)
const CHEERS = ['', '', '좋아!', '멋져!', '대단해!', '최고야!', '완벽해!'];
const SCALE = [0, 2, 4, 5, 7, 9, 11, 12];  // 콤보마다 정답음이 도레미로 올라간다
const WARN_MS = 3000;                      // 별 기준선 3초 전부터 링이 깜빡이고 삑삑

let M = null;
const root = () => document.getElementById('app');
// V13.158 놀이터(arcade.js)가 MATCH_ART를 부르므로 불러올 때 브라우저 기능을 쓰지 않는다.
let REDUCED = null;
const reduced = () => (REDUCED ||= matchMedia('(prefers-reduced-motion: reduce)')).matches;
const LITE = (navigator.hardwareConcurrency || 8) <= 4; // 저사양 폰은 조각을 줄인다
const sfx = (key, opts) => { if (soundOn()) playSound(key, opts); };
const buzz = p => { try { if (soundOn()) navigator.vibrate?.(p); } catch {} };
const VIBE = { hit: 15, miss: [30, 40, 30], fever: [20, 30, 60], star: 25, finale: [30, 40, 90] };
function later(fn, ms) { const cur = M; const t = setTimeout(() => { if (M === cur && !cur.closing) fn(); }, ms); cur.timers.push(t); }
const $ = id => document.getElementById(id);
const restart = (el, cls) => { if (!el) return; el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); };
const center = el => { const r = el.getBoundingClientRect(); return [(r.left + r.right) / 2, (r.top + r.bottom) / 2]; };

// 틀린 단어는 이 폰에 기억했다가 다음 판에 먼저 낸다(matchPick의 복습).
const MISS_KEY = () => `sumus-match-missed:${M?.A?.data?.profile?.id || ''}`;
const loadMissed = () => { try { return JSON.parse(localStorage.getItem(MISS_KEY()) || '[]').slice(0, 12); } catch { return []; } };
const saveMissed = ids => { try { localStorage.setItem(MISS_KEY(), JSON.stringify([...new Set(ids.map(String))].slice(0, 12))); } catch {} };

// opts: { words: 고른 범위의 단어들, codes: 범위 번호, label: '24~25번' }
export function openMatchGame(A, exit, opts = {}) {
  closeAll();
  M = { A, exit, timers: [], words: opts.words || [], codes: opts.codes || [], label: opts.label || '', view: A.data.rewards?.match || null };
  A.screen = 'match';
  root().innerHTML = `<div class="session-app mt-app${artClass()}" style="${artStyle()}"><div class="mt-bg" aria-hidden="true"><i></i><i></i><i></i></div><div class="mt-fever-edge" aria-hidden="true"></div><div class="mt-flash" id="mt-flash" aria-hidden="true"></div>
    <header class="mt-top"><button type="button" class="yb-back" data-mt="exit" aria-label="나가기">${icon('back')}</button><strong>짝 맞추기</strong><span class="mt-top-note">${esc(M.label)}</span><span class="mt-wallet" id="mt-wallet">${coin()}<b>${num(A.data.stats?.points_balance || 0)}</b></span></header><main id="mt-main" class="mt-main"></main></div>`;
  root().onclick = onClick;
  root().onpointerdown = onPointer;
  window.scrollTo(0, 0);
  preloadSound(['card-flip', 'swoosh', 'stamp', 'clear', 'crit', 'ult-riser', 'warn-beep', 'dmg-tick', 'type-wrong', 'type-ok', 'fail', 'fanfare-basic', 'fanfare-epic', 'coins']);
  intro();
}
function closeAll() {
  if (!M) return;
  M.closing = true;
  M.timers.forEach(clearTimeout);
  clearTimeout(M.petT);
  cancelAnimationFrame(M.raf);
  document.querySelectorAll('.mt-burst,.mt-fly').forEach(el => el.remove());
}
async function leave() {
  const exit = M?.exit;
  closeAll();
  root().onclick = null; root().onpointerdown = null;
  M = null;
  await exit?.();
}
const main = html => { const el = $('mt-main'); if (el) el.innerHTML = html; };
const app = () => root().querySelector('.mt-app');

// 카드는 손가락이 닿는 순간(pointerdown) 고른다. 키보드(Enter · Space)는 click으로 온다(detail 0).
function onPointer(event) {
  const b = event.target.closest('[data-mt="card"]');
  if (!b || !M || event.button > 0) return;
  unlockSound();
  pick(b);
}
function onClick(event) {
  const b = event.target.closest('[data-mt]');
  if (!b || b.disabled || !M) return;
  unlockSound();
  const act = b.dataset.mt;
  if (act === 'card') { if (event.detail === 0) pick(b); return; }
  if (act === 'exit') return M.playing ? confirmQuit() : leave();
  if (act === 'start') return start(b);
  if (act === 'again') return intro(true);
  if (act === 'board') return board(b.dataset.scope || M.boardScope || 'all', b.dataset.period || M.boardPeriod || 'week');
  if (act === 'quit-yes') return leave();
  if (act === 'quit-no') { document.querySelector('.mt-quit')?.remove(); return; }
}
function confirmQuit() {
  if (document.querySelector('.mt-quit')) return;
  const box = document.createElement('div');
  box.className = 'mt-quit';
  box.innerHTML = '<div><b>그만할까요?</b><p>이번 판은 기록되지 않아요.</p><button type="button" class="btn" data-mt="quit-no">계속하기</button><button type="button" class="btn primary" data-mt="quit-yes">그만하기</button></div>';
  app()?.appendChild(box);
}
const myPet = () => M.A.data.stats?.pet || null;
const petArt = (expression = 'normal', size = '') => { const p = myPet(); return p ? avatar(p.key, { form: Math.max(1, p.form ?? 1), expression, size }) : ''; };
const starRow = n => `<i class="mt-starrow">${'★'.repeat(n)}<s>${'★'.repeat(3 - n)}</s></i>`;
const sec = ms => matchTime(ms).replace('.00', '');

/* ---------- 시작 화면 ---------- */
function intro(again = false) {
  M.playing = false;
  app()?.classList.remove('fever');
  const v = M.view || {};
  const ok = matchPick(M.words).length >= MATCH.PAIRS;
  main(`<section class="mt-intro${again ? ' again' : ''}">
    <div class="mt-demo" aria-hidden="true">
      <span class="c en d1">apple</span><span class="c ko d2">사과</span><span class="c en d3">brave</span><span class="c ko d4">용감한</span><i class="boom"></i>
    </div>
    <div class="mt-intro-pet">${petArt('cheer')}<span class="mt-bubble show">같이 달려요!</span></div>
    <h1>짝 맞추기 <em>타임어택</em></h1>
    <p><b>${MATCH.ROUNDS}라운드</b> 동안 영어 카드와 뜻 카드를 짝지어 <b>모두 지우는 시간</b>을 재요. 틀리면 <b>+1초</b>! 연속 ${FEVER_AT}쌍이면 <b>피버 타임</b>.</p>
    <div class="mt-rule-ring">
      <div class="mt-ring mini">${ringSvg(v.best)}<div class="mt-clock"><b>${v.best ? (v.best / 1000).toFixed(2) : '—'}</b><small>내 최고</small></div></div>
      <div class="mt-stars-rule"><span>${starRow(3)}<small>${sec(MATCH.STARS[0])} 안</small></span><span>${starRow(2)}<small>${sec(MATCH.STARS[1])} 안</small></span><span>${starRow(1)}<small>다 지우면</small></span></div>
    </div>
    <div class="mt-records"><div><small>이번 주 기록</small><b>${v.week_best ? matchTime(v.week_best) : '—'}</b></div><div><small>오늘 코인 판</small><b>${num(v.left ?? MATCH.DAILY)}<small> / ${num(MATCH.DAILY)}</small></b></div><div><small>함께 달리기</small><b class="g">바로 위 친구 고스트</b></div></div>${v.old_best ? `<p class="mt-old">예전 6쌍 기록 ${matchTime(v.old_best)} · ${MATCH.ROUNDS}라운드로 바뀌어 새로 시작해요</p>` : ''}
    <button type="button" class="yl-cta mt-go" data-mt="start" ${ok ? '' : 'disabled'}>${ok ? '시작!' : '뜻이 서로 다른 단어가 부족해요'}</button>
    <button type="button" class="btn full mt-board-btn" data-mt="board">🏆 짝 맞추기 순위</button>
  </section>`);
}
// 시간 링: 한 바퀴 = 2별 기준(28초). 3별 기준선(18초)과 2별 기준선(맨 위)에 별 눈금.
const ring3 = MATCH.STARS[0] / MATCH.STARS[1];
const ringOffset = ms => String(Math.round(1000 * (1 - Math.min(1, ms / MATCH.STARS[1]))));
const ringSvg = (ms = 0) => `<svg viewBox="0 0 100 100" aria-hidden="true"><circle class="track" cx="50" cy="50" r="44"/><circle class="fill" cx="50" cy="50" r="44" pathLength="1000" stroke-dasharray="1000" stroke-dashoffset="${ringOffset(ms || 0)}"/></svg><span class="mt-mark s3" style="--a:${(ring3 * 360).toFixed(1)}deg"><i>★</i></span><span class="mt-mark s2" style="--a:360deg"><i>★</i></span>`;

async function start(button) {
  const pairs = matchPick(M.words, { missed: loadMissed() });
  if (pairs.length < MATCH.PAIRS) return toast('뜻이 서로 다른 단어가 부족해요. 범위를 더 골라 주세요.');
  buttonBusy(button);
  M.ghost = null;
  try {
    const { ghost, ...r } = await api('/games/match/start', { range_codes: M.codes });
    if (!M) return;
    M.id = r.id;
    M.ghost = ghost?.splits?.length === MATCH.TOTAL_PAIRS ? ghost : null;
    M.view = { ...M.view, ...r };
  } catch (err) {
    if (!M) return;
    buttonBusy(button, false);
    if (!err.transient) return toast(err.message);
    M.id = null; // 연결이 안 되면 기록 없이 연습
    toast('연결이 불안정해서 이번 판은 기록 없이 해요.');
  }
  M.prevBest = M.view?.best || null;
  M.balance0 = Number(M.A.data.stats?.points_balance || 0);
  play(pairs);
}

/* ---------- 게임 ---------- */
function play(pairs) {
  M.playing = true;
  Object.assign(M, { pairs, round: 1, cleared: 0, used: pairs.map(x => String(x.id)), left: pairs.length, misses: 0, combo: 0, best: 0, sel: null, lock: false, start: 0, done: false, fever: false, splits: [], missed: new Set(), lost: 0, warned: -1, gapPrev: null, laneW: 0, race: true });
  const cards = shuffleCards(pairs), g = M.ghost, pet = myPet();
  main(`<section class="mt-play" id="mt-play">
    <div class="mt-hud">
      <div class="mt-ring gold" id="mt-ring">${ringSvg()}<div class="mt-clock" id="mt-clock"><b>0.00</b><small>초</small></div></div>
      <div class="mt-hud-side">
        <div class="mt-starnow" id="mt-starnow" aria-label="지금 별"><i>★</i><i>★</i><i>★</i></div>
        <div class="mt-round" id="mt-round" aria-label="라운드"><b>1</b>/${MATCH.ROUNDS} 라운드</div>
        <div class="mt-dots" aria-label="남은 짝">${pairs.map(() => '<i></i>').join('')}</div>
        <div class="mt-miss" id="mt-miss" aria-label="틀린 수">✕ <b>0</b></div>
      </div>
    </div>
    ${g ? `<div class="mt-race" id="mt-race" aria-hidden="true">
      <div class="mt-lane ghost"><span class="mt-runner" id="mt-ghost">${avatar(g.pet, { size: 'mini', form: 1 })}</span><em>${esc(g.name)}${g.self ? '' : ` · ${num(g.rank)}등`} · ${matchTime(g.ms)}</em><i class="goal">🏁</i></div>
      <div class="mt-lane me"><span class="mt-runner" id="mt-me">${pet ? avatar(pet.key, { size: 'mini', form: Math.max(1, pet.form ?? 1) }) : '<i class="dot"></i>'}</span><em>나</em><i class="goal">🏁</i></div>
      <b class="mt-gap" id="mt-gap"></b>
    </div>` : ''}
    <div class="mt-combo" id="mt-combo" aria-live="polite"></div>
    <div class="mt-grid back" id="mt-grid">${cardsHtml(cards)}</div>
    <div class="mt-count" id="mt-count" aria-live="assertive"></div>
    ${g ? `<div class="mt-vs" id="mt-vs">${avatar(g.pet, { size: 'mini', form: 1 })}<b>VS ${esc(g.name)}</b><small>${g.self ? '이번 주 내 기록을 넘어 봐요' : `${num(g.rank)}등 · ${matchTime(g.ms)}`}</small></div>` : ''}
    <div class="mt-pet" id="mt-pet"><div class="mt-pet-art" data-expr="normal">${petArt()}</div><span class="mt-bubble" id="mt-bubble"></span></div>
  </section>`);
  fitText();
  // 카운트다운 3 · 2 · 1 동안 카드가 뒷면으로 날아와 깔리고(딜링), GO에 물결처럼 뒤집힌다.
  const count = $('mt-count'), grid = $('mt-grid');
  if (!reduced()) { grid.classList.add('deal'); [0, 1, 2, 3].forEach(k => sfx('card-flip', { at: .05 + k * .12, rate: .75 + k * .05, gain: .6 })); }
  const steps = ['3', '2', '1', 'GO!'], step = reduced() ? 600 : 750;
  steps.forEach((t, i) => later(() => {
    count.innerHTML = `<b class="${i === 3 ? 'go' : ''}">${t}</b>`;
    sfx(i === 3 ? 'combo' : 'tick', { rate: i === 3 ? 1.2 : 1 + i * .06 });
    if (i < 3) buzz(10);
    if (i === 3) {
      grid.classList.remove('back', 'deal'); grid.classList.add('reveal');
      $('mt-vs')?.classList.add('out');
      if (!reduced()) [0, 1, 2, 3, 4].forEach(k => sfx('card-flip', { at: k * .06, rate: 1 + k * .05, gain: .55 }));
      M.start = performance.now();
      tick();
      later(() => { count.innerHTML = ''; }, 500);
    }
  }, i * step));
}
// 긴 글자: 글자 수로 먼저 줄이고(2줄까지), 그래도 넘치면 한 단계 더(fit).
const len = c => { const n = c.text.length, k = c.side === 'ko' ? [6, 9, 12] : [9, 13, 17]; return n > k[2] ? 'l3' : n > k[1] ? 'l2' : n > k[0] ? 'l1' : ''; };
function fitText() {
  for (const b of document.querySelectorAll('.mt-face b')) if (b.scrollHeight > b.clientHeight + 1 || b.scrollWidth > b.clientWidth + 1) b.classList.add('fit');
}
const cardsHtml = cards => cards.map((c, i) => `<button type="button" class="mt-card ${c.side}" data-mt="card" data-pair="${c.pair}" data-side="${c.side}" style="--i:${i};--r:${((i * 37) % 9) - 4}deg" aria-label="${esc(c.text)}"><span class="mt-back" aria-hidden="true"></span><span class="mt-face"><b class="${len(c)}">${esc(c.text)}</b></span></button>`).join('');
function shuffleCards(pairs) {
  const list = pairs.flatMap((p, i) => [{ pair: i, side: 'en', text: p.en }, { pair: i, side: 'ko', text: p.ko }]);
  for (let i = list.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [list[i], list[j]] = [list[j], list[i]]; }
  return list;
}
const elapsed = () => M.start ? performance.now() - M.start + M.misses * MATCH.PENALTY_MS : 0;
function tick() {
  if (!M || M.done || M.closing) return;
  const t = elapsed();
  const el = document.querySelector('#mt-clock b');
  if (el) el.textContent = (t / 1000).toFixed(2);
  hud(t);
  M.raf = requestAnimationFrame(tick);
}
// 시간 링 · 별 기준선 · 고스트.
function hud(t) {
  const ringEl = $('mt-ring');
  if (!ringEl) return;
  ringEl.querySelector('.fill')?.setAttribute('stroke-dashoffset', ringOffset(t));
  const lost = t > MATCH.STARS[1] ? 2 : t > MATCH.STARS[0] ? 1 : 0;
  if (lost > M.lost) { // 별 하나가 링에서 떨어져 나간다
    M.lost = lost;
    ringEl.classList.remove('gold', 'silver', 'warn'); ringEl.classList.add(lost === 1 ? 'silver' : 'bronze');
    ringEl.querySelector(lost === 1 ? '.s3' : '.s2')?.classList.add('lost');
    $('mt-starnow')?.children[3 - lost]?.classList.add('lost');
    sfx('dmg-tick', { rate: .6 }); buzz(15);
    petSay('sad', lost === 1 ? '별 하나 떨어졌어!' : '끝까지 가자!');
  }
  const next = MATCH.STARS[M.lost];
  if (next && t > next - WARN_MS) {
    const s = Math.floor((t - next + WARN_MS) / 1000);
    if (s !== M.warned) { M.warned = s; sfx('warn-beep', { gain: .7 }); ringEl.classList.add('warn'); }
  } else if (M.warned !== -1) { M.warned = -1; ringEl.classList.remove('warn'); }
  if (M.ghost && M.race) ghostRun(t);
}
function ghostRun(t) {
  const el = $('mt-ghost'), lane = el?.parentElement;
  if (!lane) { M.race = false; return; }
  M.laneW ||= lane.clientWidth - el.offsetWidth - 22;
  const s = M.ghost.splits;
  let k = 0; while (k < s.length && s[k] <= t) k++;
  const prev = k ? s[k - 1] : 0, p = k >= s.length ? 1 : (k + (t - prev) / Math.max(1, s[k] - prev)) / s.length;
  el.style.transform = `translateX(${(p * M.laneW).toFixed(1)}px)`;
  if (k >= s.length) { lane.classList.add('done'); M.race = false; }
}
function meRun() {
  const el = $('mt-me'), lane = el?.parentElement;
  if (!lane) return;
  const w = lane.clientWidth - el.offsetWidth - 22;
  el.style.transform = `translateX(${(M.cleared / MATCH.TOTAL_PAIRS * w).toFixed(1)}px)`;
}

function pick(card) {
  if (!M?.start || M.done || M.lock || card.classList.contains('hit') || card.classList.contains('gone')) return;
  if (M.sel === card) { card.classList.remove('sel'); M.sel = null; return; }
  sfx('tap', { rate: card.dataset.side === 'ko' ? 1.12 : 1, vary: .05 });
  if (!M.sel || M.sel.dataset.side === card.dataset.side) {
    M.sel?.classList.remove('sel');
    M.sel = card; card.classList.add('sel');
    return;
  }
  const a = M.sel, b = card;
  M.sel = null;
  if (a.dataset.pair === b.dataset.pair) return hit(a, b);
  miss(a, b);
}
function hit(a, b) {
  const split = Math.round(elapsed());
  M.splits.push(split);
  M.left--; M.cleared++; M.combo++; M.best = Math.max(M.best, M.combo);
  // V13.152 라운드의 마지막 짝이면 다음 라운드로, 3라운드의 마지막 짝이면 끝.
  const roundEnd = !M.left, last = roundEnd && M.round >= MATCH.ROUNDS;
  if (last) {
    M.done = true; M.playing = false; cancelAnimationFrame(M.raf);
    const el = document.querySelector('#mt-clock b'); if (el) el.textContent = (split / 1000).toFixed(2);
    $('mt-ring')?.classList.remove('warn');
  }
  // 두 카드가 가운데로 날아가 부딪힌다(마지막 한 쌍은 슬로모션).
  const [ax, ay] = center(a), [bx, by] = center(b), mx = (ax + bx) / 2, my = (ay + by) / 2;
  for (const [el, x, y] of [[a, ax, ay], [b, bx, by]]) {
    el.style.setProperty('--tx', `${mx - x}px`); el.style.setProperty('--ty', `${my - y}px`);
    el.classList.remove('sel'); el.classList.add('hit');
    if (last) el.classList.add('slow');
  }
  const crash = reduced() ? 40 : last ? 640 : 230;
  sfx('correct', { rate: 2 ** (SCALE[Math.min(M.combo - 1, SCALE.length - 1)] / 12) });
  if (!reduced()) sfx('swoosh', { gain: last ? .8 : .45, rate: last ? .7 : 1.1 });
  buzz(VIBE.hit);
  document.querySelectorAll('.mt-dots i')[M.pairs.length - M.left - 1]?.classList.add('on');
  const pair = M.pairs[Number(a.dataset.pair)], fever = M.fever, combo = M.combo;
  later(() => {
    burst(mx, my, combo, { big: last, fever, chip: `${pair.en} = ${pair.ko}` });
    sfx('pop', { rate: 1 + Math.min(.5, combo * .07), gain: .7 });
    if (fever) sfx('combo', { gain: .45, rate: 1.1 });
    a.classList.add('gone'); b.classList.add('gone');
  }, crash);
  comboText();
  if (M.combo === FEVER_AT && !last) feverOn();
  else if (M.combo >= 2) petSay(M.fever ? 'happy' : 'cheer', CHEERS[Math.min(M.combo, CHEERS.length - 1)]);
  meRun(); ghostGap(split);
  if (last) finale(mx, my, split);
  else if (roundEnd) nextRound();
}
function comboText() {
  const combo = $('mt-combo');
  if (!combo) return;
  const n = M.combo, lv = n > FEVER_AT ? 4 : n === FEVER_AT ? 3 : n;
  combo.innerHTML = n >= 2 ? `<span class="pop c${lv}"><b>${n}</b> 콤보 <em>${CHEERS[Math.min(n, CHEERS.length - 1)]}</em></span>` : '';
}
function feverOn() {
  M.fever = true;
  app()?.classList.add('fever');
  const playEl = $('mt-play');
  if (playEl && !reduced()) { const f = document.createElement('div'); f.className = 'mt-fever-banner'; f.innerHTML = '<b>FEVER</b><small>피버 타임!</small>'; playEl.appendChild(f); later(() => f.remove(), 1400); }
  sfx('ult-riser', { dur: .9, gain: .7 }); sfx('combo', { at: .35, rate: 1.25 });
  buzz(VIBE.fever);
  petSay('happy', '피버다!');
}
function feverOff() {
  if (!M.fever) return;
  M.fever = false;
  app()?.classList.remove('fever');
  sfx('fail', { dur: .5, gain: .45 });
}
// 고스트와 같은 짝 수일 때의 시간 차이(초록: 앞섬, 빨강: 뒤짐). 뒤지다가 앞서면 추월!
function ghostGap(split) {
  const g = M.ghost, el = $('mt-gap');
  if (!g || !el) return;
  const i = M.splits.length - 1, d = split - g.splits[i];
  el.className = `mt-gap ${d < 0 ? 'ahead' : 'behind'}`;
  el.textContent = `${d < 0 ? '−' : '+'}${(Math.abs(d) / 1000).toFixed(2)}초`;
  restart(el, 'bump');
  if (d < 0 && M.gapPrev !== null && M.gapPrev >= 0) {
    const race = $('mt-race');
    restart(race, 'pass');
    sfx('type-ok', { at: .1 });
    const tag = document.createElement('span'); tag.className = 'mt-pass'; tag.textContent = '추월!'; race?.appendChild(tag); later(() => tag.remove(), 1000);
  }
  M.gapPrev = d;
}
function miss(a, b) {
  const wasFever = M.fever;
  M.misses++; M.combo = 0; M.lock = true;
  M.missed.add(String(M.pairs[Number(a.dataset.pair)].id)); M.missed.add(String(M.pairs[Number(b.dataset.pair)].id));
  for (const el of [a, b]) { el.classList.remove('sel'); el.classList.add('wrong'); }
  sfx('wrong'); sfx('type-wrong', { gain: .6 }); buzz(VIBE.miss);
  restart($('mt-flash'), 'on');
  if (!reduced()) restart($('mt-grid'), 'shake');
  if (wasFever) feverOff();
  const clock = $('mt-clock');
  restart(clock, 'pen');
  const m = document.querySelector('#mt-miss b'); if (m) m.textContent = M.misses;
  const combo = $('mt-combo'); if (combo) combo.innerHTML = '';
  // +1초가 틀린 카드에서 시계로 날아가 박힌다.
  const [ax, ay] = center(a), [bx, by] = center(b), x = (ax + bx) / 2, y = (ay + by) / 2, [cx, cy] = clock ? center(clock) : [x, y];
  const plus = document.createElement('span');
  plus.className = 'mt-fly mt-plus'; plus.textContent = '+1초';
  plus.style.left = `${x}px`; plus.style.top = `${y}px`;
  plus.style.setProperty('--tx', `${cx - x}px`); plus.style.setProperty('--ty', `${cy - y}px`);
  document.body.appendChild(plus);
  if (!reduced()) sfx('swoosh', { gain: .35, rate: 1.4, at: .05 });
  setTimeout(() => plus.remove(), 700);
  later(() => { sfx('dmg-tick', { rate: .9 }); restart(clock, 'pen'); }, reduced() ? 0 : 480);
  petSay('sad', ['앗!', '괜찮아!', '다시!'][M.misses % 3]);
  later(() => { a.classList.remove('wrong'); b.classList.remove('wrong'); M.lock = false; }, 420);
}
// 맞힐 때 터지는 별 조각 + 고리 + 하얀 번쩍 + 맞힌 짝 글자(콤보 · 피버일수록 많이).
function burst(x, y, combo, { big = false, fever = false, chip = '' } = {}) {
  if (reduced()) return;
  const layer = document.createElement('div');
  layer.className = `mt-burst${big ? ' big' : ''}${fever ? ' fever' : ''}`;
  layer.style.left = `${x}px`; layer.style.top = `${y}px`;
  let n = big ? 30 : Math.min(24, 8 + combo * 2 + (fever ? 8 : 0));
  if (LITE) n = Math.ceil(n / 2);
  const spread = big ? 120 : 46;
  layer.innerHTML = Array.from({ length: n }, (_, i) => {
    const ang = (i / n) * Math.PI * 2 + Math.random() * .4, dist = spread * .8 + Math.random() * spread;
    return `<i class="${i % 3 ? '' : 'st'}" style="--dx:${(Math.cos(ang) * dist).toFixed(1)}px;--dy:${(Math.sin(ang) * dist).toFixed(1)}px;--h:${fever ? 20 + (i * 9) % 40 : (combo * 40 + i * 12) % 360};--s:${(4 + Math.random() * 6).toFixed(1)}px"></i>`;
  }).join('') + '<b></b><u></u>' + (chip ? `<em>${esc(chip)}</em>` : '');
  document.body.appendChild(layer);
  setTimeout(() => layer.remove(), big ? 1400 : 900);
}
// 펫 표정 + 말풍선(1.2초 뒤 원래대로).
function petSay(expression, text) {
  const box = $('mt-pet'), art = box?.querySelector('.mt-pet-art'), bubble = $('mt-bubble');
  if (!box || !art || !myPet()) return;
  if (art.dataset.expr !== expression) { art.innerHTML = petArt(expression); art.dataset.expr = expression; }
  restart(box, expression === 'sad' ? 'flinch' : 'jump');
  if (bubble && text) { bubble.textContent = text; restart(bubble, 'show'); }
  clearTimeout(M.petT);
  M.petT = setTimeout(() => { if (!M || !art.isConnected) return; art.innerHTML = petArt(); art.dataset.expr = 'normal'; bubble?.classList.remove('show'); }, 1200);
}

/* ---------- 마지막 한 쌍 · 끝 ---------- */
// V13.152 다음 라운드: 시간은 그대로 흐르고, 남은 카드가 사라진 뒤 새 카드 12장이 깔린다(앞 라운드 단어는 되도록 빼고).
function nextRound() {
  M.lock = true;
  const pairs = matchPick(M.words, { missed: [...M.missed], skip: M.used });
  later(() => {
    const grid = $('mt-grid'); if (!grid || M.done) return;
    M.round++; M.pairs = pairs; M.left = pairs.length; M.sel = null; M.used.push(...pairs.map(x => String(x.id)));
    const r = $('mt-round'); if (r) r.innerHTML = `<b>${M.round}</b>/${MATCH.ROUNDS} 라운드`;
    document.querySelectorAll('.mt-dots i').forEach(d => d.classList.remove('on'));
    const count = $('mt-count'); if (count) count.innerHTML = `<b class="go round">${M.round === MATCH.ROUNDS ? '마지막 라운드!' : `${M.round}라운드`}</b>`;
    grid.classList.remove('reveal'); grid.innerHTML = cardsHtml(shuffleCards(pairs)); fitText();
    void grid.offsetWidth; grid.classList.add('reveal');
    sfx('combo', { rate: 1.1, gain: .6 });
    if (!reduced()) [0, 1, 2].forEach(k => sfx('card-flip', { at: k * .06, rate: 1 + k * .05, gain: .5 }));
    later(() => { if (count) count.innerHTML = ''; }, 600);
    M.lock = false;
  }, reduced() ? 120 : MATCH.ROUND_GAP_MS);
}
function finale(mx, my, ms) {
  const playEl = $('mt-play'), grid = $('mt-grid');
  // 카드판만 확대한다(고정 위치인 카운트 · 펫 · 조각이 따라 움직이지 않게).
  if (!reduced() && grid) { const r = grid.getBoundingClientRect(); grid.style.setProperty('--ox', `${mx - r.left}px`); grid.style.setProperty('--oy', `${my - r.top}px`); grid.classList.add('finale'); }
  const send = save(ms);
  later(() => {
    sfx('crit'); sfx('clear', { at: .25 }); buzz(VIBE.finale);
    const t = document.createElement('div'); t.className = 'mt-clear'; t.innerHTML = '<b>CLEAR!</b>';
    playEl?.appendChild(t);
    petSay('happy', '해냈다!');
  }, reduced() ? 100 : 680);
  later(async () => { const res = await send; if (M) result(ms, matchStars(ms), res); }, reduced() ? 600 : 1700);
}
async function save(ms) {
  // 틀린 단어는 다음 판에 먼저(이번 판에 나왔는데 안 틀린 단어는 목록에서 뺀다).
  const shown = new Set(M.pairs.map(p => String(p.id)));
  saveMissed([...M.missed, ...loadMissed().filter(id => !shown.has(id))]);
  if (!M.id) return null;
  let res;
  try { res = await api('/games/match/finish', { id: M.id, ms, misses: M.misses, splits: M.splits }); }
  catch (err) { res = { paid: false, reason: 'error', error: err.message }; }
  if (!M) return res;
  if (res?.stats) Object.assign(M.A.data.stats, res.stats);
  if (typeof res?.points_balance === 'number') M.A.data.stats.points_balance = res.points_balance;
  M.view = { ...M.view, best: res?.best ?? M.view?.best, week_best: res?.week_best ?? M.view?.week_best, left: res?.left ?? M.view?.left };
  M.A.data.rewards ||= {}; M.A.data.rewards.match = M.view;
  return res;
}
function result(ms, stars, res) {
  app()?.classList.remove('fever');
  const record = !!res?.record, coins = Number(res?.coins || 0), xp = Number(res?.xp || 0), bait = !!res?.bait;
  const why = !M.id ? '연결이 안 돼서 기록 없이 했어요.' : res?.reason === 'daily' ? `오늘 코인 판(${MATCH.DAILY}판)을 다 썼어요. 기록은 남아요!` : res?.reason === 'error' ? esc(res.error || '저장하지 못했어요.') : res?.reason ? '이번 판은 기록하지 못했어요.' : '';
  const prev = M.prevBest;
  const diffLine = record && prev ? `내 최고보다 <b>${((prev - ms) / 1000).toFixed(2)}초</b> 빨라요!` : record ? '첫 기록이에요!' : prev ? `내 최고(${matchTime(prev)})까지 <b>${((ms - prev) / 1000).toFixed(2)}초</b>` : '';
  const g = M.ghost, beat = g && ms < g.ms;
  const ghostLine = !g ? '' : g.self ? (beat ? '이번 주의 나를 넘었어요!' : `이번 주의 나까지 <b>${((ms - g.ms) / 1000).toFixed(2)}초</b>`) : beat ? `<b>${esc(g.name)}</b> 고스트를 이겼어요!` : `<b>${esc(g.name)}</b>까지 <b>${((ms - g.ms) / 1000).toFixed(2)}초</b>`;
  const missed = M.pairs.filter(p => M.missed.has(String(p.id)));
  const petLine = stars === 3 ? '최고야! 별 세 개!' : stars === 2 ? '좋았어! 조금만 더!' : '다음엔 더 빨리!';
  main(`<section class="mt-result s${stars}${record ? ' record' : ''}">
    <div class="mt-res-head"><span>CLEAR</span></div>
    <div class="mt-res-stars" aria-label="별 ${stars}개">${[1, 2, 3].map(i => `<i class="${i <= stars ? 'on' : 'off'}">★</i>`).join('')}</div>
    <div class="mt-res-time"><b id="mt-final">0.00</b><small>초</small>${record ? '<span class="mt-stamp" id="mt-stamp">신기록</span>' : ''}</div>
    ${diffLine ? `<p class="mt-res-diff">${diffLine}</p>` : ''}
    ${ghostLine ? `<div class="mt-res-ghost${beat ? ' beat' : ''}">${avatar(g.pet, { size: 'mini', form: 1 })}<span>${ghostLine}</span></div>` : ''}
    <div class="mt-res-facts"><span>틀림 <b>${num(M.misses)}</b></span><span>최고 콤보 <b>${num(M.best)}</b></span>${M.view?.best ? `<span>내 최고 <b>${matchTime(M.view.best)}</b></span>` : ''}</div>
    ${coins ? `<div class="mt-rewards"><span class="r coin">${coin()}<b>+<i>0</i></b><small>${res.record_coins ? `신기록 +${num(res.record_coins)} 포함` : '코인'}</small></span><span class="r xp"><b>+${num(xp)}</b><small>경험치</small></span>${bait ? '<span class="r bait"><b>🪱 +1</b><small>낚시 미끼</small></span>' : ''}</div>`
      : `${bait ? '<div class="mt-rewards"><span class="r bait"><b>🪱 +1</b><small>낚시 미끼</small></span></div>' : ''}${why ? `<p class="mt-res-why">${why}</p>` : ''}`}
    ${missed.length ? `<div class="mt-review"><h3>헷갈린 단어 <small>다음 판에 먼저 나와요</small></h3><div>${missed.map((p, i) => `<span class="mt-rcard" style="--i:${i}"><b>${esc(p.en)}</b><em>${esc(p.ko)}</em></span>`).join('')}</div></div>` : ''}
    <div class="mt-words">${M.pairs.map(p => `<span class="${M.missed.has(String(p.id)) ? 'x' : ''}"><b>${esc(p.en)}</b>${esc(p.ko)}</span>`).join('')}</div>
    <div class="mt-res-pet">${petArt(stars === 3 ? 'happy' : stars === 2 ? 'cheer' : 'sad')}<span class="mt-bubble show">${petLine}</span></div>
    <div class="mt-result-actions"><button type="button" class="yl-cta" data-mt="again">한 판 더!</button><button type="button" class="btn full" data-mt="board">🏆 순위</button><button type="button" class="btn full" data-mt="exit">나가기</button></div>
  </section>`);
  const box = document.querySelector('.mt-result'), final = $('mt-final'), R = reduced();
  if (R) { final.textContent = (ms / 1000).toFixed(2); box.classList.add('calm'); }
  else {
    const t0 = performance.now() + 250, dur = 900;
    const step = t => { const k = Math.max(0, Math.min(1, (t - t0) / dur)); final.textContent = (ms / 1000 * (1 - Math.pow(1 - k, 3))).toFixed(2); if (k < 1 && M) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  }
  // 별이 하나씩 쾅쾅 찍힌다.
  [...box.querySelectorAll('.mt-res-stars i')].forEach((el, i) => later(() => {
    el.classList.add('in');
    if (el.classList.contains('on')) { sfx('stamp', { rate: 1 + i * .1, gain: .8 }); sfx('pop', { rate: 1.2 + i * .15, gain: .5 }); buzz(VIBE.star); restart(box, 'thump'); }
    else sfx('tap', { rate: .6 });
  }, R ? 0 : 500 + i * 320));
  const t1 = R ? 0 : 1500;
  if (record) later(() => { $('mt-stamp')?.classList.add('in'); sfx('stamp', { rate: .8 }); sfx('fanfare-epic', { at: .15 }); buzz([40, 50, 80]); coinShower(box, LITE ? 10 : 20); }, t1);
  later(() => box.querySelector('.mt-rewards')?.classList.add('in'), t1 + (record ? 500 : 0));
  const coinsEl = box.querySelector('.mt-rewards .coin b i');
  if (coinsEl && coins) later(() => { countUp(coinsEl, coins, 600); flyCoins(box.querySelector('.mt-rewards .coin'), coins); }, t1 + (record ? 700 : 200));
  later(() => box.querySelector('.mt-review')?.classList.add('in'), t1 + 1300);
}
// 코인이 보상 칸에서 위쪽 지갑으로 날아가 쌓인다.
function flyCoins(from, coins) {
  const wallet = $('mt-wallet'), b = wallet?.querySelector('b');
  if (!from || !wallet || !b) return;
  const to = Number(M.A.data.stats?.points_balance ?? M.balance0 + coins);
  if (reduced()) { b.textContent = num(to); return; }
  const [fx, fy] = center(from), [wx, wy] = center(wallet), n = Math.min(10, Math.max(3, coins));
  for (let i = 0; i < n; i++) {
    const c = document.createElement('span');
    c.className = 'mt-fly mt-coin'; c.innerHTML = coin();
    const x = fx + (Math.random() * 40 - 20), y = fy + (Math.random() * 16 - 8);
    c.style.left = `${x}px`; c.style.top = `${y}px`;
    c.style.setProperty('--tx', `${wx - x}px`); c.style.setProperty('--ty', `${wy - y}px`); c.style.animationDelay = `${i * 60}ms`;
    document.body.appendChild(c);
    setTimeout(() => c.remove(), 900 + i * 60);
    sfx('coin', { at: .55 + i * .06, vary: .1, gain: .6 });
  }
  later(() => { restart(wallet, 'bump'); b.textContent = num(to); sfx('coins', { gain: .7 }); }, 600 + n * 60);
}

/* ---------- 순위(시상대) ---------- */
// V13.152 순위: 범위(전체 학생 · 우리 학교 · 우리 반) × 기간(이번 주 · 통합). 처음은 전체 학생 · 이번 주.
const BOARD_SCOPES = [['all', '전체 학생'], ['school', '우리 학교'], ['class', '우리 반']];
const BOARD_PERIODS = [['week', '이번 주'], ['all', '통합']];
async function board(scope = M?.boardScope || 'all', period = M?.boardPeriod || 'week') {
  M.boardScope = scope; M.boardPeriod = period;
  main('<div class="yb-loading">순위를 불러오는 중…</div>');
  let r;
  try { r = await api(`/games/match/board?scope=${scope}&period=${period}`); }
  catch (err) { if (M) { toast(err.message); intro(); } return; }
  if (!M) return;
  const rows = r.rows || [], top = rows.filter(x => x.rank <= 3), rest = rows.filter(x => x.rank > 3);
  const me = rows.find(x => x.me), above = me && me.rank > 1 ? rows.find(x => x.rank === me.rank - 1) : null;
  const where = x => scope === 'class' || !x.school ? '' : `<small class="mt-where">${esc(scope === 'school' ? x.class_name : `${x.school} ${x.class_name}`)}</small>`;
  const scopeName = BOARD_SCOPES.find(([k]) => k === scope)[1], periodName = BOARD_PERIODS.find(([k]) => k === period)[1];
  const pod = rank => { const x = top.find(t => t.rank === rank); return x ? `<div class="mt-pod p${rank}${x.me ? ' me' : ''}"><div class="who">${rank === 1 ? '<i class="crown">👑</i>' : ''}${avatar(x.pet, { size: 'mini', form: 1 })}<b>${esc(x.name)}</b>${where(x)}<em>${matchTime(x.ms)}</em></div><div class="step"><span>${rank}</span></div></div>` : '<div class="mt-pod empty"></div>'; };
  const seg = (list, cur, attr) => `<div class="mt-seg" role="group">${list.map(([k, label]) => `<button type="button" data-mt="board" data-${attr}="${k}" class="${k === cur ? 'on' : ''}" aria-pressed="${k === cur}">${label}</button>`).join('')}</div>`;
  main(`<section class="mt-board">
    <h2>🏆 짝 맞추기 순위</h2>
    ${seg(BOARD_SCOPES, scope, 'scope')}${seg(BOARD_PERIODS, period, 'period')}
    <p class="mt-board-note">${scopeName} · ${periodName} · ${MATCH.ROUNDS}라운드 가장 빠른 기록 순서예요.${period === 'week' ? ' 월요일에 새로 시작해요.' : ''}${r.total ? ` 모두 ${num(r.total)}명` : ''}</p>
    ${rows.length ? `<div class="mt-podium">${pod(2)}${pod(1)}${pod(3)}</div>
      ${above ? `<p class="mt-chase"><b>${esc(above.name)}</b>까지 <em>${((me.ms - above.ms) / 1000).toFixed(2)}초</em>! 한 판 더?</p>` : me?.rank === 1 ? `<p class="mt-chase top">${scopeName} 1등이에요! 👑</p>` : ''}
      ${rest.length ? `<ol class="mt-list">${rest.map((x, i) => `<li class="${x.me ? 'me' : ''}" style="--i:${i}"><i>${num(x.rank)}</i>${avatar(x.pet, { size: 'mini', form: 1 })}<b>${esc(x.name)}${where(x)}</b><em>${matchTime(x.ms)}</em></li>`).join('')}</ol>` : ''}`
      : `<p class="yb-muted">${period === 'week' ? '아직 이번 주 기록이 없어요.' : '아직 기록이 없어요.'} 첫 기록의 주인공이 되어 봐요!</p>`}
    <button type="button" class="yl-cta" data-mt="again">도전하기</button>
  </section>`);
  if (!rows.length) return;
  const R = reduced();
  if (R) document.querySelector('.mt-board')?.classList.add('calm');
  // 단상은 3등 → 2등 → 1등 순서로 올라온다.
  [3, 2, 1].forEach((rank, i) => { if (top.some(x => x.rank === rank)) later(() => sfx('pop', { rate: 1 + i * .15 }), R ? 0 : 300 + i * 450); });
  later(() => sfx('fanfare-basic', { gain: .8 }), R ? 0 : 1300);
  const mine = document.querySelector('.mt-list li.me');
  if (mine) later(() => mine.scrollIntoView({ behavior: R ? 'auto' : 'smooth', block: 'center' }), R ? 0 : 1500);
}
