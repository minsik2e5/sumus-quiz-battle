import { api, esc, num, icon, toast, buttonBusy } from './ui.js';
import { avatar } from './character.js';
import { coin } from './emblems.js';
import { playSound, unlockSound, soundOn } from './sound.js';
import { coinShower, countUp } from './celebrate.js';
import { MATCH, matchPick, matchStars, matchTime } from './match-rules.js';

// V13.149 짝 맞추기 타임어택: 전체 화면. 영어 6장 + 뜻 6장, 짝을 맞히면 두 장이 날아가 부딪히며 사라지고,
// 틀리면 흔들리며 1초가 더해진다. 시작 · 끝은 서버에 등록(server/games.mjs)해 기록과 코인을 남긴다.

let M = null;
const root = () => document.getElementById('app');
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)');
const reduced = () => REDUCED.matches;
const sfx = (key, opts) => { if (soundOn()) playSound(key, opts); };
const buzz = p => { try { if (soundOn()) navigator.vibrate?.(p); } catch {} };
function later(fn, ms) { const cur = M; const t = setTimeout(() => { if (M === cur && !cur.closing) fn(); }, ms); cur.timers.push(t); }

// opts: { words: 고른 범위의 단어들, codes: 범위 번호, label: '24~25번' }
export function openMatchGame(A, exit, opts = {}) {
  closeAll();
  M = { A, exit, timers: [], words: opts.words || [], codes: opts.codes || [], label: opts.label || '', view: A.data.rewards?.match || null };
  A.screen = 'match';
  root().innerHTML = `<div class="session-app mg-app"><header class="mg-top"><button type="button" class="yb-back" data-mg="exit" aria-label="나가기">${icon('back')}</button><strong>짝 맞추기</strong><span class="mg-top-note">${esc(M.label)}</span></header><main id="mg-main" class="mg-main"></main></div>`;
  root().onclick = onClick;
  window.scrollTo(0, 0);
  intro();
}
function closeAll() {
  if (!M) return;
  M.closing = true;
  M.timers.forEach(clearTimeout);
  cancelAnimationFrame(M.raf);
}
async function leave() {
  const exit = M?.exit;
  closeAll();
  root().onclick = null;
  M = null;
  await exit?.();
}
const main = html => { const el = document.getElementById('mg-main'); if (el) el.innerHTML = html; };

function onClick(event) {
  const b = event.target.closest('[data-mg]');
  if (!b || b.disabled || !M) return;
  unlockSound();
  const act = b.dataset.mg;
  if (act === 'exit') return M.playing ? confirmQuit() : leave();
  if (act === 'start') return start(b);
  if (act === 'again') return intro(true);
  if (act === 'board') return board();
  if (act === 'card') return pick(b);
  if (act === 'quit-yes') return leave();
  if (act === 'quit-no') { document.querySelector('.mg-quit')?.remove(); return; }
}
function confirmQuit() {
  if (document.querySelector('.mg-quit')) return;
  const box = document.createElement('div');
  box.className = 'mg-quit';
  box.innerHTML = '<div><b>그만할까요?</b><p>이번 판은 기록되지 않아요.</p><button type="button" class="btn" data-mg="quit-no">계속하기</button><button type="button" class="btn primary" data-mg="quit-yes">그만하기</button></div>';
  root().querySelector('.mg-app')?.appendChild(box);
}

/* ---------- 시작 화면 ---------- */
function intro(again = false) {
  M.playing = false;
  const v = M.view || {}, pet = M.A.data.stats?.pet;
  const ok = matchPick(M.words).length >= MATCH.PAIRS;
  main(`<section class="mg-intro${again ? ' again' : ''}">
    <div class="mg-intro-cards" aria-hidden="true"><span class="c en">apple</span><span class="c ko">사과</span><span class="c en">brave</span><span class="c ko">용감한</span></div>
    <div class="mg-intro-pet">${pet ? avatar(pet.key, { form: Math.max(1, pet.form ?? 1), expression: 'cheer' }) : ''}</div>
    <h1>짝 맞추기 <em>타임어택</em></h1>
    <p>영어 카드와 뜻 카드를 짝지어 <b>모두 지우는 시간</b>을 재요. 틀리면 <b>+1초</b>!</p>
    <div class="mg-stars-rule"><span>${starRow(3)}<small>${matchTime(MATCH.STARS[0]).replace('.00', '')} 안</small></span><span>${starRow(2)}<small>${matchTime(MATCH.STARS[1]).replace('.00', '')} 안</small></span><span>${starRow(1)}<small>다 지우면</small></span></div>
    <div class="mg-records"><div><small>내 최고 기록</small><b>${v.best ? matchTime(v.best) : '—'}</b></div><div><small>이번 주 기록</small><b>${v.week_best ? matchTime(v.week_best) : '—'}</b></div><div><small>오늘 코인 판</small><b>${num(v.left ?? MATCH.DAILY)}<small> / ${num(MATCH.DAILY)}</small></b></div></div>
    <button type="button" class="yl-cta mg-go" data-mg="start" ${ok ? '' : 'disabled'}>${ok ? '시작!' : '뜻이 서로 다른 단어가 부족해요'}</button>
    <button type="button" class="btn full mg-board-btn" data-mg="board">🏆 이번 주 우리 반 순위</button>
  </section>`);
}
const starRow = n => `<i class="mg-starrow">${'★'.repeat(n)}<s>${'★'.repeat(3 - n)}</s></i>`;

async function start(button) {
  const pairs = matchPick(M.words);
  if (pairs.length < MATCH.PAIRS) return toast('뜻이 서로 다른 단어가 부족해요. 범위를 더 골라 주세요.');
  buttonBusy(button);
  try {
    const r = await api('/games/match/start', { range_codes: M.codes });
    if (!M) return;
    M.id = r.id;
    M.view = { ...M.view, ...r };
  } catch (err) {
    if (!M) return;
    buttonBusy(button, false);
    if (!err.transient) return toast(err.message);
    M.id = null; // 연결이 안 되면 기록 없이 연습
    toast('연결이 불안정해서 이번 판은 기록 없이 해요.');
  }
  play(pairs);
}

/* ---------- 게임 ---------- */
function play(pairs) {
  M.playing = true;
  M.pairs = pairs; M.left = pairs.length; M.misses = 0; M.combo = 0; M.best = 0; M.sel = null; M.lock = false; M.start = 0; M.done = false;
  const cards = shuffleCards(pairs);
  main(`<section class="mg-play">
    <div class="mg-hud">
      <div class="mg-clock" id="mg-clock"><b>0.00</b><small>초</small></div>
      <div class="mg-dots" aria-label="남은 짝">${pairs.map(() => '<i></i>').join('')}</div>
      <div class="mg-miss" id="mg-miss" aria-label="틀린 수">✕ <b>0</b></div>
    </div>
    <div class="mg-combo" id="mg-combo" aria-live="polite"></div>
    <div class="mg-grid" id="mg-grid">${cards.map((c, i) => `<button type="button" class="mg-card ${c.side}" data-mg="card" data-pair="${c.pair}" data-side="${c.side}" style="--i:${i}" aria-label="${esc(c.text)}"><span class="mg-face"><b class="${c.text.length > 9 ? 'long' : ''}${c.text.length > 13 ? ' xl' : ''}">${esc(c.text)}</b></span></button>`).join('')}</div>
    <div class="mg-count" id="mg-count" aria-live="assertive"></div>
  </section>`);
  // 카운트다운 3 · 2 · 1 · 시작(카드는 뒤집힌 채로 깔리고, 시작에 한꺼번에 앞면).
  const count = document.getElementById('mg-count'), grid = document.getElementById('mg-grid');
  grid.classList.add('hidden');
  const steps = ['3', '2', '1', 'GO!'];
  steps.forEach((t, i) => later(() => {
    count.innerHTML = `<b class="${i === 3 ? 'go' : ''}">${t}</b>`;
    sfx(i === 3 ? 'combo' : 'tick', { rate: i === 3 ? 1.2 : 1 });
    if (i === 3) {
      grid.classList.remove('hidden'); grid.classList.add('reveal');
      M.start = performance.now();
      tick();
      later(() => { count.innerHTML = ''; }, 500);
    }
  }, reduced() ? i * 600 : i * 750));
}
function shuffleCards(pairs) {
  const list = pairs.flatMap((p, i) => [{ pair: i, side: 'en', text: p.en }, { pair: i, side: 'ko', text: p.ko }]);
  for (let i = list.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [list[i], list[j]] = [list[j], list[i]]; }
  return list;
}
const elapsed = () => M.start ? performance.now() - M.start + M.misses * MATCH.PENALTY_MS : 0;
function tick() {
  if (!M || M.done || M.closing) return;
  const el = document.querySelector('#mg-clock b');
  if (el) el.textContent = (elapsed() / 1000).toFixed(2);
  M.raf = requestAnimationFrame(tick);
}

function pick(card) {
  if (!M.start || M.done || M.lock || card.classList.contains('gone')) return;
  if (M.sel === card) { card.classList.remove('sel'); M.sel = null; return; }
  sfx('tap', { vary: .08 });
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
  M.left--; M.combo++; M.best = Math.max(M.best, M.combo);
  b.classList.add('sel');
  // 두 카드가 가운데로 날아가 부딪힌다.
  const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
  const mx = (ra.left + ra.right + rb.left + rb.right) / 4, my = (ra.top + ra.bottom + rb.top + rb.bottom) / 4;
  for (const [el, r] of [[a, ra], [b, rb]]) {
    el.style.setProperty('--tx', `${mx - (r.left + r.right) / 2}px`);
    el.style.setProperty('--ty', `${my - (r.top + r.bottom) / 2}px`);
    el.classList.remove('sel'); el.classList.add('hit');
  }
  burst(mx, my, M.combo);
  sfx(M.combo >= 3 ? 'combo' : 'correct', { rate: 1 + Math.min(.4, M.combo * .06) });
  buzz(18);
  const dots = document.querySelectorAll('.mg-dots i');
  dots[M.pairs.length - M.left - 1]?.classList.add('on');
  const combo = document.getElementById('mg-combo');
  if (combo) combo.innerHTML = M.combo >= 2 ? `<span class="pop" key="${M.combo}">${M.combo} 콤보!</span>` : '';
  later(() => { a.classList.add('gone'); b.classList.add('gone'); }, reduced() ? 60 : 330);
  if (!M.left) finish();
}
function miss(a, b) {
  M.misses++; M.combo = 0; M.lock = true;
  for (const el of [a, b]) { el.classList.remove('sel'); el.classList.add('wrong'); }
  sfx('wrong'); buzz([30, 40, 30]);
  const clock = document.getElementById('mg-clock');
  clock?.classList.remove('pen'); void clock?.offsetWidth; clock?.classList.add('pen');
  const plus = document.createElement('span');
  plus.className = 'mg-plus'; plus.textContent = '+1초';
  clock?.appendChild(plus);
  const m = document.querySelector('#mg-miss b'); if (m) m.textContent = M.misses;
  const combo = document.getElementById('mg-combo'); if (combo) combo.innerHTML = '';
  later(() => { a.classList.remove('wrong'); b.classList.remove('wrong'); M.lock = false; plus.remove(); }, 420);
}
// 맞힐 때 터지는 별 조각(콤보가 클수록 많이).
function burst(x, y, combo) {
  if (reduced()) return;
  const layer = document.createElement('div');
  layer.className = 'mg-burst';
  layer.style.left = `${x}px`; layer.style.top = `${y}px`;
  const n = Math.min(18, 8 + combo * 2);
  layer.innerHTML = Array.from({ length: n }, (_, i) => {
    const ang = (i / n) * Math.PI * 2 + Math.random() * .4, dist = 40 + Math.random() * 46;
    return `<i style="--dx:${Math.cos(ang) * dist}px;--dy:${Math.sin(ang) * dist}px;--h:${(combo * 40 + i * 12) % 360};--s:${4 + Math.random() * 6}px"></i>`;
  }).join('') + '<b></b>';
  document.body.appendChild(layer);
  setTimeout(() => layer.remove(), 800);
}

/* ---------- 끝 ---------- */
async function finish() {
  M.done = true; M.playing = false;
  cancelAnimationFrame(M.raf);
  const ms = Math.round(elapsed()), stars = matchStars(ms);
  const el = document.querySelector('#mg-clock b'); if (el) el.textContent = (ms / 1000).toFixed(2);
  sfx('clear');
  let res = null;
  if (M.id) {
    try { res = await api('/games/match/finish', { id: M.id, ms, misses: M.misses }); }
    catch (err) { res = { paid: false, reason: 'error', error: err.message }; }
    if (!M) return;
    if (res?.stats) Object.assign(M.A.data.stats, res.stats);
    if (typeof res?.points_balance === 'number') M.A.data.stats.points_balance = res.points_balance;
    M.view = { ...M.view, best: res?.best ?? M.view?.best, week_best: res?.week_best ?? M.view?.week_best, left: res?.left ?? M.view?.left };
    M.A.data.rewards ||= {}; M.A.data.rewards.match = M.view;
  }
  later(() => result(ms, stars, res), reduced() ? 200 : 650);
}
function result(ms, stars, res) {
  const record = !!res?.record, coins = Number(res?.coins || 0);
  const why = !M.id ? '연결이 안 돼서 기록 없이 했어요.' : res?.reason === 'daily' ? `오늘 코인 판(${MATCH.DAILY}판)을 다 썼어요. 기록은 남아요!` : res?.reason === 'error' ? esc(res.error || '저장하지 못했어요.') : res?.reason ? '이번 판은 기록하지 못했어요.' : '';
  main(`<section class="mg-result s${stars}${record ? ' record' : ''}">
    ${record ? '<div class="mg-record-ribbon">신기록!</div>' : ''}
    <div class="mg-result-stars" aria-label="별 ${stars}개">${[1, 2, 3].map(i => `<i class="${i <= stars ? 'on' : ''}" style="--d:${i * 180}ms">★</i>`).join('')}</div>
    <div class="mg-result-time"><b id="mg-final">0.00</b><small>초</small></div>
    <div class="mg-result-facts"><span>틀림 <b>${num(M.misses)}</b></span><span>최고 콤보 <b>${num(M.best)}</b></span>${M.view?.best ? `<span>내 최고 <b>${matchTime(M.view.best)}</b></span>` : ''}</div>
    ${coins ? `<div class="mg-result-coins">${coin()}<b>+${num(coins)}</b><small>${res.record_coins ? `신기록 보너스 +${num(res.record_coins)} 포함 · ` : ''}경험치 +${num(res.xp || 0)}</small></div>` : why ? `<p class="mg-result-why">${why}</p>` : ''}
    <div class="mg-words">${M.pairs.map(p => `<span><b>${esc(p.en)}</b>${esc(p.ko)}</span>`).join('')}</div>
    <div class="mg-result-actions"><button type="button" class="yl-cta" data-mg="again">한 판 더!</button><button type="button" class="btn full" data-mg="board">🏆 우리 반 순위</button><button type="button" class="btn full" data-mg="exit">나가기</button></div>
  </section>`);
  const box = document.querySelector('.mg-result');
  const final = document.getElementById('mg-final');
  if (reduced()) final.textContent = (ms / 1000).toFixed(2);
  else {
    const t0 = performance.now(), dur = 900;
    const step = t => { const k = Math.min(1, (t - t0) / dur); final.textContent = (ms / 1000 * (1 - Math.pow(1 - k, 3))).toFixed(2); if (k < 1 && M) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  }
  [1, 2, 3].forEach(i => { if (i <= stars) later(() => sfx('pop', { rate: 1 + i * .12 }), 180 * i + 500); });
  if (record) { later(() => { sfx('fanfare-basic'); coinShower(box, 20); buzz([40, 50, 80]); }, 1100); }
  else if (coins) later(() => sfx('coins'), 1100);
  const coinsEl = box.querySelector('.mg-result-coins b');
  if (coinsEl && coins) { coinsEl.innerHTML = '+<span>0</span>'; later(() => countUp(coinsEl.querySelector('span'), coins, 700), 1000); }
}

/* ---------- 이번 주 우리 반 순위 ---------- */
async function board() {
  main('<div class="yb-loading">순위를 불러오는 중…</div>');
  let r;
  try { r = await api('/games/match/board'); }
  catch (err) { if (M) { toast(err.message); intro(); } return; }
  if (!M) return;
  main(`<section class="mg-board">
    <h2>🏆 이번 주 짝 맞추기 · 우리 반</h2>
    <p class="mg-board-note">가장 빠른 기록 순서예요. 월요일에 새로 시작해요.</p>
    ${r.rows.length ? `<ol>${r.rows.map(x => `<li class="${x.me ? 'me' : ''}${x.rank <= 3 ? ` top${x.rank}` : ''}"><i>${x.rank <= 3 ? ['🥇', '🥈', '🥉'][x.rank - 1] : num(x.rank)}</i>${avatar(x.pet, { size: 'mini', form: 1 })}<b>${esc(x.name)}</b><em>${matchTime(x.ms)}</em></li>`).join('')}</ol>` : '<p class="yb-muted">아직 이번 주 기록이 없어요. 첫 기록의 주인공이 되어 봐요!</p>'}
    <button type="button" class="yl-cta" data-mg="again">도전하기</button>
  </section>`);
}
