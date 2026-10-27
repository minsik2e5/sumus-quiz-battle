import { api, esc, num, icon, toast } from './ui.js';
import { coin } from './emblems.js';
import { avatar } from './character.js';
import { openSheet } from './sheet.js';
import { playSound, unlockSound, soundOn, preloadSound } from './sound.js';
import { coinShower, countUp } from './celebrate.js';
import { TIMING, LEVEL_NAMES, LEVEL_HINTS, GRADE_NAMES, GRADE_MARKS, CHEERS, secText, errText, errWord, ledDigits } from './timing-rules.js';

// V13.180 10초 맞추기(놀이터). 선생님: "참고보다 퀄리티를 훨씬 더 높여서".
// 어두운 무대 · 빨간 7-세그먼트 LED 숫자판(꺼진 세그먼트 잔광 · 켜진 세그먼트 글로우 · 약한 깜빡임 · 콜론 1초 깜빡) ·
// 입체 큰 빨간 버튼(받침 · 옆면 · 윗면 · 반사광 · 안쪽 그림자, 누르면 깊이 들어갔다 튕겨 오름, 아래로 빛 번짐, 진동).
// 시작 → 3 · 2 · 1 → 숫자가 처음 N초만 보이고 꺼진 LED(● ● : ● ●)로 숨는다 → 누르면(터치 · 마우스 · 스페이스) 멈추고
// 눌린 순간 0.5초를 늘려(슬로모션) 숫자를 공개 → 눈금자 위 10.00초 기준선과 내 위치 → 등급 · 보상 · 기록 갱신 · 연속 완벽.
// 시간은 performance.now()(누른 이벤트의 timeStamp)로 재고, 화면이 가려지면(visibilitychange) 그 판은 무효.
// 판정 · 보상 · 기록은 서버(server/timing.mjs)가 한다: 화면이 잰 시간은 서버가 잰 시간과 비교해 믿을 때만 쓴다.

const SFX = ['tm-count', 'tm-go', 'tm-hide', 'tm-tick', 'tm-press', 'tm-reveal', 'tm-perfect', 'tm-great', 'tm-good', 'tm-miss', 'tm-record', 'coins'];
const LEVEL_KEY = 'sumus-timing-level', TICK_KEY = 'sumus-timing-tick';
const readPref = (key, fallback) => { try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; } };
const writePref = (key, value) => { try { localStorage.setItem(key, value); } catch {} };

let T = null;
const root = () => document.getElementById('app');
const $ = id => document.getElementById(id);
let REDUCED = null;
const reduced = () => (REDUCED ||= matchMedia('(prefers-reduced-motion: reduce)')).matches;
const sfx = (key, opts) => { if (soundOn()) playSound(key, opts); };
const buzz = p => { try { if (soundOn()) navigator.vibrate?.(p); } catch {} };
const tickOn = () => readPref(TICK_KEY, 'on') === 'on';
function later(fn, ms) { const cur = T; const t = setTimeout(() => { if (T === cur && !cur.closing) fn(); }, ms); cur.timers.push(t); return t; }
const wait = ms => new Promise(r => later(r, ms));
const playId = () => `tm-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
const pick = list => list[Math.floor(Math.random() * list.length)];

/* ---------- LED 숫자판(7-세그먼트 SVG) ---------- */
// 한 칸 56 × 100, 세그먼트 굵기 10. a 위 · b 오른쪽 위 · c 오른쪽 아래 · d 아래 · e 왼쪽 아래 · f 왼쪽 위 · g 가운데.
const W = 56, H = 100, S = 10, G = 2;
const hSeg = (yc, x0 = S / 2 + G, x1 = W - S / 2 - G) => `${x0},${yc} ${x0 + S / 2},${yc - S / 2} ${x1 - S / 2},${yc - S / 2} ${x1},${yc} ${x1 - S / 2},${yc + S / 2} ${x0 + S / 2},${yc + S / 2}`;
const vSeg = (xc, y0, y1) => `${xc},${y0} ${xc + S / 2},${y0 + S / 2} ${xc + S / 2},${y1 - S / 2} ${xc},${y1} ${xc - S / 2},${y1 - S / 2} ${xc - S / 2},${y0 + S / 2}`;
const SEGS = {
  a: hSeg(S / 2), g: hSeg(H / 2), d: hSeg(H - S / 2),
  f: vSeg(S / 2, S / 2 + G, H / 2 - G), b: vSeg(W - S / 2, S / 2 + G, H / 2 - G),
  e: vSeg(S / 2, H / 2 + G, H - S / 2 - G), c: vSeg(W - S / 2, H / 2 + G, H - S / 2 - G)
};
const DIGIT = { 0: 'abcdef', 1: 'bc', 2: 'abged', 3: 'abgcd', 4: 'fgbc', 5: 'afgcd', 6: 'afgedc', 7: 'abc', 8: 'abcdefg', 9: 'abcdfg', '-': 'g', ' ': '' };
const DX = [0, 66, 160, 226]; // 칸 자리(가운데 콜론 자리를 비운다)
function ledSvg() {
  const digit = (x, i) => `<g class="tm-dg" data-i="${i}" transform="translate(${x} 0) skewX(-6)">${Object.entries(SEGS).map(([k, pts]) => `<polygon class="sg" data-s="${k}" points="${pts}"/>`).join('')}<circle class="hd" cx="${W / 2 + 4}" cy="${H / 2}" r="7"/></g>`;
  return `<svg class="tm-led-svg" viewBox="-16 -12 314 124" role="img" aria-label="시간" preserveAspectRatio="xMidYMid meet">
    <defs><filter id="tm-glow" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="2.6" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
    <g class="tm-led-on" filter="url(#tm-glow)">${DX.map(digit).join('')}<g class="tm-colon" transform="skewX(-6)"><circle cx="141" cy="30" r="6.5"/><circle cx="141" cy="70" r="6.5"/></g></g>
  </svg>`;
}
// 숫자를 켠다(chars: 4글자). hidden이면 모두 끄고 가운데 점만.
function setLed(chars, { hidden = false, colon = true } = {}) {
  const led = $('tm-led');
  if (!led) return;
  led.classList.toggle('hid', hidden);
  led.querySelectorAll('.tm-dg').forEach((g, i) => {
    const on = hidden ? '' : DIGIT[chars[i]] ?? '';
    g.querySelectorAll('.sg').forEach(p => p.classList.toggle('on', on.includes(p.dataset.s)));
  });
  led.querySelector('.tm-colon')?.classList.toggle('on', !!colon);
  const label = hidden ? '숨겨진 시간' : `${chars.slice(0, 2).join('')}.${chars.slice(2).join('')}초`;
  led.setAttribute('aria-label', label);
}
const showMs = (ms, colon = true) => setLed(ledDigits(ms), { colon });

/* ---------- 큰 버튼 ---------- */
function buttonHtml() {
  return `<div class="tm-press-zone">
    <span class="tm-spill" aria-hidden="true"></span>
    <button type="button" class="tm-btn" id="tm-btn" aria-label="버튼 누르기(스페이스 키)">
      <span class="tm-btn-base" aria-hidden="true"><i class="tm-bolt b1"></i><i class="tm-bolt b2"></i><i class="tm-bolt b3"></i><i class="tm-bolt b4"></i></span>
      <span class="tm-btn-well" aria-hidden="true"></span>
      <span class="tm-btn-cap" aria-hidden="true"><span class="tm-btn-side"></span><span class="tm-btn-top"><i class="tm-btn-shine"></i><i class="tm-btn-rim"></i><b>SPACE</b></span></span>
    </button>
  </div>`;
}

/* ---------- 열기 · 닫기 ---------- */
export function openTiming(A, exit) {
  closeAll();
  const saved = readPref(LEVEL_KEY, 'normal');
  T = { A, exit, timers: [], v: A.data.rewards?.timing || null, phase: 'lobby', level: TIMING.LEVELS.includes(saved) ? saved : 'normal', play: null, busy: false };
  A.screen = 'timing';
  root().innerHTML = `<div class="session-app tm-app" id="tm-app"><header class="tm-top"><button type="button" class="yb-back" data-tm="exit" aria-label="나가기">${icon('back')}</button><strong>10초 맞추기</strong>
    <span class="tm-chip" id="tm-left" aria-live="polite"></span><button type="button" class="tm-ico" id="tm-tickbtn" data-tm="tick" aria-pressed="${tickOn()}" aria-label="째깍 소리"></button><button type="button" class="tm-ico" data-tm="board" aria-label="순위">🏆</button><button type="button" class="tm-ico" data-tm="guide" aria-label="10초 맞추기 안내">?</button></header>
    <main class="tm-main" id="tm-main">
      <div class="tm-stage" id="tm-stage">
        <div class="tm-bg" aria-hidden="true"><i class="tm-ray"></i><i class="tm-grid"></i><i class="tm-vig"></i></div>
        <h1 class="tm-goal" id="tm-goal"><b>${secText(TIMING.TARGET)}</b>초를 맞춰라</h1>
        <div class="tm-panel"><span class="tm-screw s1"></span><span class="tm-screw s2"></span><span class="tm-screw s3"></span><span class="tm-screw s4"></span>
          <div class="tm-led" id="tm-led" aria-live="off">${ledSvg()}<i class="tm-glass" aria-hidden="true"></i><span class="tm-count" id="tm-count" aria-live="assertive"></span></div>
          <div class="tm-panel-foot"><span id="tm-state">READY</span><span class="tm-lvtag" id="tm-lvtag"></span></div>
        </div>
        ${buttonHtml()}
        <p class="tm-hint" id="tm-hint"></p>
      </div>
      <section class="tm-dock" id="tm-dock"></section>
    </main><div class="tm-layer" id="tm-layer"></div></div>`;
  root().onclick = onClick;
  const app = $('tm-app');
  app.addEventListener('contextmenu', e => e.preventDefault());
  const btn = $('tm-btn');
  btn.addEventListener('pointerdown', onPointerDown);
  for (const type of ['pointerup', 'pointercancel', 'pointerleave']) btn.addEventListener(type, release);
  T.onKey = onKey; T.onKeyUp = onKeyUp; T.onVis = onVisibility;
  addEventListener('keydown', T.onKey); addEventListener('keyup', T.onKeyUp);
  document.addEventListener('visibilitychange', T.onVis);
  addEventListener('pagehide', T.onVis);
  window.scrollTo(0, 0);
  preloadSound(SFX);
  tickButton();
  chips();
  showMs(TIMING.TARGET);
  T.idle = true; idleBlink();
  lobby();
  // 새 숫자(출석 · 연습으로 판이 늘었을 수 있다).
  api('/rewards').then(res => { if (T && res?.timing) { setView(res.timing); if (T.phase === 'lobby') lobby(); } }).catch(() => {});
  if (!readPref('sumus-timing-guide', '')) later(() => guide(true), 500);
}
function closeAll() {
  if (!T) return;
  T.closing = true; T.timers.forEach(clearTimeout); cancelAnimationFrame(T.raf);
  removeEventListener('keydown', T.onKey); removeEventListener('keyup', T.onKeyUp);
  document.removeEventListener('visibilitychange', T.onVis); removeEventListener('pagehide', T.onVis);
}
async function leave() {
  if (T?.phase === 'count' || T?.phase === 'run') voidPlay('나가서 이번 판은 무효예요.');
  const exit = T?.exit; closeAll(); root().onclick = null; T = null; await exit?.();
}
const setView = v => { if (!v || !T) return; T.v = v; T.A.data.rewards ||= {}; T.A.data.rewards.timing = v; chips(); };
function chips() {
  const v = T.v || {}, box = $('tm-left');
  if (box) box.innerHTML = `<i aria-hidden="true">⏱</i><b>${num(v.left ?? TIMING.FREE_DAILY)}</b><small>/${num(v.plays ?? TIMING.FREE_DAILY)}판</small>`;
}
function tickButton() { const b = $('tm-tickbtn'); if (b) { b.textContent = tickOn() ? '🔉' : '🔇'; b.setAttribute('aria-pressed', String(tickOn())); b.title = tickOn() ? '째깍 소리 켜짐' : '째깍 소리 꺼짐'; } }

function onClick(event) {
  const b = event.target.closest('[data-tm]');
  if (!b || b.disabled || !T) return;
  unlockSound();
  const act = b.dataset.tm;
  if (act === 'exit') return leave();
  if (act === 'guide') return guide(false);
  if (act === 'board') return board();
  if (act === 'tick') { writePref(TICK_KEY, tickOn() ? 'off' : 'on'); tickButton(); return toast(tickOn() ? '숨김 중 째깍 소리를 켰어요.' : '째깍 소리를 껐어요.'); }
  if (act === 'level') { if (T.phase !== 'lobby') return; T.level = b.dataset.level; writePref(LEVEL_KEY, T.level); return lobby(); }
  if (act === 'start') return start();
  if (act === 'again') { closeLayer(); return lobby(); }
  if (act === 'close-layer') return closeLayer();
}
const layer = html => { const l = $('tm-layer'); if (!l) return; l.innerHTML = html; l.classList.toggle('on', !!html); };
const closeLayer = () => layer('');
const hint = text => { const h = $('tm-hint'); if (h) h.innerHTML = text; };
const stateText = text => { const s = $('tm-state'); if (s) s.textContent = text; };

/* ---------- 대기(로비) ---------- */
// 숫자판은 '10:00'을 은은하게 깜빡이며 기다린다(콜론만 1초마다).
function idleBlink() {
  if (!T || !T.idle) return;
  const k = Math.floor(performance.now() / 1000) % 2 === 0;
  showMs(TIMING.TARGET, k);
  later(idleBlink, 500);
}
function lobby() {
  T.phase = 'lobby'; T.play = null;
  if (!T.idle) { T.idle = true; idleBlink(); }
  $('tm-stage')?.classList.remove('run', 'veil', 'done', 'slowmo', 'g-perfect', 'g-great', 'g-good', 'g-miss', 'g-early');
  const v = T.v || {}, left = v.left ?? TIMING.FREE_DAILY, lv = T.level;
  const wk = v.week?.[lv], best = v.best?.[lv];
  stateText('READY');
  $('tm-lvtag').textContent = LEVEL_NAMES[lv];
  hint(left ? `<b>큰 버튼</b>이나 <kbd>스페이스</kbd>를 눌러 시작` : '오늘 판을 다 했어요. 공부하면 한 판 더!');
  $('tm-btn').disabled = !left;
  $('tm-btn').classList.toggle('off', !left);
  const got = v.got || {};
  $('tm-dock').innerHTML = `
    <div class="tm-levels" role="radiogroup" aria-label="난이도">${TIMING.LEVELS.map(k => `<button type="button" role="radio" aria-checked="${k === lv}" class="tm-lv l-${k}${k === lv ? ' on' : ''}" data-tm="level" data-level="${k}"><b>${LEVEL_NAMES[k]}</b><small>${LEVEL_HINTS[k]}</small></button>`).join('')}</div>
    <ul class="tm-stats" aria-label="내 기록 · ${LEVEL_NAMES[lv]}">
      <li><small>내 최고</small><b>${best == null ? '—' : `±${secText(best)}`}</b></li>
      <li><small>이번 주 평균</small><b>${wk ? `±${secText(wk.avg)}` : '—'}</b><em>${wk ? `${num(wk.n)}판` : ''}</em></li>
      <li><small>연속 완벽</small><b>${num(v.streak || 0)}</b><em>최고 ${num(v.streak_best || 0)}</em></li>
    </ul>
    <div class="tm-plays">
      <span class="tm-pl-main"><b>오늘 ${num(left)}판 남음</b><small>무료 ${TIMING.FREE_DAILY}판 · 코인 ${num(v.coin_left ?? TIMING.COIN_DAILY)}/${TIMING.COIN_DAILY} 남음</small></span>
      <span class="tm-pl-src${got.practice ? ' ok' : ''}">${got.practice ? '✓' : '+1'} 연습 끝내기</span><span class="tm-pl-src${got.attend ? ' ok' : ''}">${got.attend ? '✓' : '+1'} 출석</span>
    </div>
    <button type="button" class="yl-cta tm-go" data-tm="start" ${left ? '' : 'disabled'}>${left ? `${LEVEL_NAMES[lv]} 시작` : '내일 또 만나요'}</button>`;
}

/* ---------- 판: 시작 → 카운트다운 → 달리기 ---------- */
async function start() {
  if (!T || T.busy || T.phase !== 'lobby') return;
  if (!(T.v?.left ?? 1)) return toast('오늘 판을 다 했어요. 연습을 끝내거나 출석하면 한 판 더!');
  T.busy = true; T.idle = false;
  // 무대가 보이게 맨 위로(시작 버튼이 아래에 있어 조작판 쪽으로 내려가 있을 수 있다).
  $('tm-main').scrollTop = 0; $('tm-app').scrollTop = 0; window.scrollTo(0, 0);
  const id = playId(), level = T.level;
  T.phase = 'count';
  $('tm-dock').innerHTML = `<p class="tm-dock-note">${LEVEL_NAMES[level]} · ${LEVEL_HINTS[level]}</p>`;
  hint('준비…');
  stateText('SYNC');
  setLed([' ', ' ', ' ', ' '], { colon: false });
  try {
    // 쓰기 없는 ping으로 서버 시각을 받아 곧바로 돌려보낸다(서버가 그 사이를 왕복 시간으로 잰다).
    const ping = await api('/timing/ping', {});
    const res = await api('/timing/start', { id, level, target: TIMING.TARGET, echo: ping.echo });
    const at = performance.now();
    if (!T || T.phase !== 'count') return;
    setView(res.timing);
    T.play = { id, level, target: res.target, show: res.show_ms, at, t0: at + res.countdown_ms, done: false, lastSec: -1, hidden: false };
    countdown();
  } catch (err) {
    if (!T) return;
    T.busy = false; toast(err.message); lobby();
  }
}
function countdown() {
  const P = T.play, el = $('tm-count');
  const step = n => {
    if (!T || T.play !== P || T.phase !== 'count') return;
    if (n === 0) { el.textContent = ''; el.className = 'tm-count'; return go(); }
    el.textContent = String(n); el.className = 'tm-count pop'; void el.offsetWidth; el.className = 'tm-count pop on';
    sfx('tm-count', { rate: n === 1 ? 1.12 : 1 });
    buzz(12);
    stateText(`READY ${n}`);
  };
  const tickAt = n => { const ms = P.t0 - (n * 1000) - performance.now(); later(() => step(n), Math.max(0, ms)); };
  [3, 2, 1, 0].forEach(tickAt);
}
function go() {
  const P = T.play;
  T.phase = 'run'; T.busy = false;
  $('tm-stage').classList.add('run');
  sfx('tm-go'); buzz(30);
  stateText('RUN');
  hint(P.show ? `숫자가 <b>${P.show / 1000}초</b> 뒤 사라져요. 속으로 세다가 <b>딱 ${secText(P.target)}초</b>에 누르기!` : '숫자는 처음부터 가려져요. 속으로 세다가 <b>딱 10초</b>에 누르기!');
  if (!P.show) hide();
  const frame = () => {
    if (!T || T.play !== P || T.phase !== 'run') return;
    const el = performance.now() - P.t0;
    if (!P.hidden && el >= P.show) hide();
    const sec = Math.floor(el / 1000);
    if (P.hidden) {
      // 숨김: 꺼진 LED에 점이 숨 쉬듯, 콜론은 1초마다 깜빡. 째깍은 아주 작게(설정으로 끈다).
      if (sec !== P.lastSec) { P.lastSec = sec; setLed([' ', ' ', ' ', ' '], { hidden: true, colon: true }); if (tickOn() && sec > 0) sfx('tm-tick', { gain: .55 }); later(() => { if (T?.play === P && T.phase === 'run') setLed([' ', ' ', ' ', ' '], { hidden: true, colon: false }); }, 500); }
    } else showMs(el, el % 1000 < 500);
    if (el >= P.target * TIMING.MAX_FACTOR) return press(null, 'timeout');
    T.raf = requestAnimationFrame(frame);
  };
  T.raf = requestAnimationFrame(frame);
}
function hide() {
  const P = T.play;
  P.hidden = true;
  $('tm-stage').classList.add('veil');
  $('tm-led').classList.add('fade');
  later(() => $('tm-led')?.classList.remove('fade'), 420);
  if (P.show) sfx('tm-hide');
  stateText('HIDDEN');
  setLed([' ', ' ', ' ', ' '], { hidden: true, colon: true });
}

/* ---------- 누르기(터치 · 마우스 · 스페이스) ---------- */
// 누른 순간은 이벤트의 timeStamp(같은 시계, 손가락이 닿은 때)로 잰다.
const stampOf = e => { const now = performance.now(), ts = Number(e?.timeStamp); return Number.isFinite(ts) && ts > 0 && ts <= now && now - ts < 250 ? ts : now; };
function onPointerDown(e) {
  if (!T || e.button > 0) return;
  e.preventDefault();
  unlockSound();
  try { e.currentTarget.setPointerCapture?.(e.pointerId); } catch {}
  down(stampOf(e));
}
function onKey(e) {
  if (!T || !(e.code === 'Space' || e.key === ' ' || e.code === 'Enter' || e.code === 'NumpadEnter')) return;
  if (document.querySelector('#modal-root .modal') || $('tm-layer')?.classList.contains('on')) return;
  if (e.target?.closest?.('input, textarea')) return;
  e.preventDefault();
  if (e.repeat) return;
  down(stampOf(e));
}
function onKeyUp(e) { if (T && (e.code === 'Space' || e.key === ' ' || e.code === 'Enter' || e.code === 'NumpadEnter')) release(); }
function down(stamp) {
  const btn = $('tm-btn');
  if (!btn || btn.disabled) return;
  btn.classList.remove('up'); btn.classList.add('down');
  $('tm-stage').classList.add('pressing');
  if (T.phase === 'lobby') { sfx('tm-press', { rate: 1.1, gain: .7 }); buzz(18); return start(); }
  if (T.phase === 'run') return press(stamp, 'press');
}
function release() {
  const btn = $('tm-btn');
  if (!btn || !btn.classList.contains('down')) return;
  btn.classList.remove('down'); void btn.offsetWidth; btn.classList.add('up');
  $('tm-stage')?.classList.remove('pressing');
  later(() => btn.classList.remove('up'), 520);
}

async function press(stamp, result) {
  const P = T.play;
  if (!P || P.done) return;
  P.done = true;
  cancelAnimationFrame(T.raf);
  T.phase = 'reveal';
  const ms = Math.round((stamp ?? performance.now()) - P.t0);
  if (result === 'press') {
    sfx('tm-press'); buzz([28, 18, 10]);
    const spill = document.querySelector('.tm-spill');
    if (spill) { spill.classList.remove('on'); void spill.offsetWidth; spill.classList.add('on'); }
  }
  $('tm-btn').disabled = true;
  $('tm-stage').classList.remove('veil');
  stateText('STOP');
  hint('');
  // 서버에 보내기와 숫자 공개를 함께 한다.
  const send = finish(P, result, ms);
  await reveal(ms);
  let res;
  try { res = await send; } catch (err) { toast(err.message); res = null; }
  if (!T || T.play !== P) return;
  if (!res) { T.busy = false; $('tm-btn').disabled = false; return lobby(); }
  if (res.ms != null && res.ms !== ms) showMs(res.ms);
  result_(res);
}
// 끝 신호: 끊기면 같은 id로 한 번 더(서버는 영수증으로 같은 답).
async function finish(P, result, ms) {
  const body = { id: P.id, result, ms };
  try { return await api('/timing/finish', body); }
  catch (err) { if (!err.transient) throw err; await wait(400); return api('/timing/finish', body); }
}
// 화면이 가려지거나 나가면 그 판은 무효(시간이 멈추거나 늦어지는 환경).
function onVisibility(e) {
  if (!T) return;
  if ((document.hidden || e?.type === 'pagehide') && (T.phase === 'count' || T.phase === 'run')) voidPlay('화면이 가려져서 이번 판은 무효예요. 판은 하나 썼어요.');
}
function voidPlay(message) {
  const P = T.play;
  if (!P || P.done) { T.phase = 'lobby'; T.busy = false; return; }
  P.done = true; cancelAnimationFrame(T.raf);
  api('/timing/finish', { id: P.id, result: 'void' }).then(res => { if (T && res?.timing) { setView(res.timing); if (T.phase === 'lobby') lobby(); } }).catch(() => {});
  T.busy = false;
  $('tm-count').textContent = ''; $('tm-btn').disabled = false;
  toast(message);
  lobby();
}

/* ---------- 공개(슬로모션) ---------- */
// 눌린 순간 앞 0.5초를 1.4초로 늘려서 숫자가 굴러가다 멈춘다(움직임 줄이기면 바로).
function reveal(ms) {
  return new Promise(done => {
    const stage = $('tm-stage');
    if (reduced()) { showMs(ms); sfx('tm-reveal'); return done(); }
    stage.classList.add('slowmo');
    const from = Math.max(0, ms - 500), dur = 1400, t0 = performance.now();
    let lastC = -1;
    const step = t => {
      if (!T) return done();
      const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 2.4), cur = from + (ms - from) * e;
      showMs(cur);
      const c = Math.floor(cur / 50);
      if (c !== lastC && k < 1) { lastC = c; sfx('tm-tick', { gain: .25, rate: 1.4 + k * .6 }); }
      if (k < 1) { T.raf = requestAnimationFrame(step); return; }
      showMs(ms);
      $('tm-led').classList.add('flash');
      later(() => $('tm-led')?.classList.remove('flash'), 700);
      stage.classList.remove('slowmo');
      sfx('tm-reveal');
      done();
    };
    T.raf = requestAnimationFrame(step);
  });
}

/* ---------- 결과 ---------- */
// 눈금자: 목표 ±1초, 등급 구간 띠(완벽 · 훌륭 · 좋음)와 10.00초 기준선, 내 위치가 떨어지며 미끄러져 멈춘다.
function ruler(res) {
  const span = 1000, pos = ms => 50 + Math.max(-1, Math.min(1, (ms - res.target) / span)) * 46;
  const band = (k, cls) => `<i class="tm-band ${cls}" style="left:${pos(res.target - TIMING.GRADES[k])}%;width:${pos(res.target + TIMING.GRADES[k]) - pos(res.target - TIMING.GRADES[k])}%"></i>`;
  const off = Math.abs(res.err) > span;
  return `<div class="tm-ruler" role="img" aria-label="목표 ${secText(res.target)}초, 내 기록 ${secText(res.ms)}초, ${errText(res.err)}">
    <div class="tm-track">${band('good', 'b-good')}${band('great', 'b-great')}${band('perfect', 'b-perfect')}
      ${Array.from({ length: 21 }, (_, i) => `<i class="tm-tick${i % 5 ? '' : ' big'}" style="left:${4 + i * 4.6}%"></i>`).join('')}
      <i class="tm-target"><b>${secText(res.target)}</b></i>
      <i class="tm-mark g-${res.grade}${off ? ' off' : ''}" style="--to:${pos(res.ms)}%"><b>${off ? (res.err > 0 ? '▶' : '◀') : ''}${secText(res.ms)}</b></i>
    </div>
    <div class="tm-ruler-scale"><span>${secText(res.target - span)}</span><span>빠름 ◀</span><span>▶ 늦음</span><span>${secText(res.target + span)}</span></div>
  </div>`;
}
const LED_WORD = { perfect: 'PERFECT', great: 'GREAT', good: 'GOOD', miss: 'MISS', early: 'EARLY' };
function result_(res) {
  T.phase = 'done'; T.busy = false;
  if (res.timing) setView(res.timing);
  if (typeof res.points_balance === 'number') { T.A.data.stats ||= {}; T.A.data.stats.points_balance = res.points_balance; }
  const stage = $('tm-stage');
  if (!res.valid) { toast(res.reason === 'expired' ? '시간이 너무 지나서 이번 판은 무효예요.' : '이번 판은 무효예요.'); return lobby(); }
  const g = res.grade;
  stage.classList.add('done', `g-${g}`);
  stateText(LED_WORD[g]);
  if (g === 'perfect') perfectShow();
  else if (g === 'great') { sfx('tm-great'); buzz([20, 40, 20]); burst(14, false); }
  else if (g === 'good') sfx('tm-good');
  else sfx('tm-miss');
  if (res.record) later(() => { sfx('tm-record'); buzz([30, 30, 60]); }, g === 'perfect' ? 1500 : 700);
  const pet = T.A.data.stats?.pet, petKey = pet?.key || T.A.data.profile?.avatar_key || 'dog';
  const streak = Number(res.streak || 0);
  const lines = [];
  if (res.checked === 'server') lines.push(`<p class="tm-note">연결이 흔들려서 <b>서버가 잰 시간</b>으로 판정했어요(순위에는 안 들어가요).</p>`);
  if (res.capped) lines.push(`<p class="tm-note">오늘 받을 수 있는 코인(${TIMING.COIN_DAILY})을 다 받았어요. 경험치는 그대로!</p>`);
  const early = g === 'early';
  layer(`<div class="tm-result g-${g}" role="dialog" aria-label="결과">
    ${res.record ? '<div class="tm-ribbon"><span>NEW BEST</span><b>내 최고 기록 갱신!</b></div>' : res.week_record ? '<div class="tm-ribbon week"><b>이번 주 최고 기록!</b></div>' : ''}
    <div class="tm-grade"><i class="tm-gmark" aria-hidden="true">${GRADE_MARKS[g]}</i><b>${GRADE_NAMES[g]}</b></div>
    <p class="tm-err">${early ? `<b>${secText(res.ms)}초</b>에 눌렀어요` : `<b>${errText(res.err)}</b> <span>${errWord(res.err)}</span>`}</p>
    ${early ? '' : ruler(res)}
    ${streak >= 2 ? `<div class="tm-combo"><span>🔥</span><b>연속 완벽 ×${streak}</b></div>` : ''}
    <div class="tm-cheer"><span class="tm-pet">${avatar(petKey, { form: Math.max(1, Number(pet?.form || 1)), size: 'mini' })}</span><p>${esc(pick(CHEERS[g] || CHEERS.miss))}</p></div>
    <div class="tm-gain">${res.coins ? `<span class="tm-coins">${coin()}<b>+<span data-count="${res.coins}">0</span></b></span>` : ''}${res.xp ? `<span class="tm-xp">경험치 <b>+${res.xp}</b></span>` : ''}${!res.coins && !res.xp ? '<span class="tm-xp">보상 없음</span>' : ''}</div>
    ${lines.join('')}
    <div class="tm-actions"><button type="button" class="btn" data-tm="board">순위</button><button type="button" class="yl-cta" data-tm="again">${T.v?.left ? `한 판 더 (${num(T.v.left)})` : '확인'}</button></div>
  </div>`);
  const c = document.querySelector('.tm-coins [data-count]');
  if (c) later(() => { countUp(c, res.coins, 700); if (res.coins >= 3) sfx('coins', { gain: .7 }); }, 600);
  if (res.record && !reduced()) later(() => coinShower(document.querySelector('.tm-result'), 18), 900);
  // 순위 버튼 · 다시 하기 버튼만 먼저 받는다(스페이스로 다시 시작하지 않게 포커스).
  later(() => document.querySelector('.tm-result [data-tm="again"]')?.focus(), 400);
}
// 완벽: 화면 번쩍 + 색종이 · 별 + 흔들림(움직임 줄이기면 번쩍 없이 은은하게).
function perfectShow() {
  sfx('tm-perfect'); buzz([40, 30, 40, 30, 90]);
  const app = $('tm-app');
  if (!reduced()) {
    const f = document.createElement('i'); f.className = 'tm-flash'; app.appendChild(f); later(() => f.remove(), 900);
    app.classList.add('tm-shake'); later(() => app.classList.remove('tm-shake'), 500);
  }
  burst(46, true);
}
function burst(n, stars) {
  if (reduced()) return;
  const box = document.createElement('div');
  box.className = 'tm-confetti'; box.setAttribute('aria-hidden', 'true');
  const colors = ['#ff3b3b', '#ffd23f', '#3be8b0', '#5aa9ff', '#ff7ad9', '#ffffff'];
  box.innerHTML = Array.from({ length: n }, (_, i) => {
    const star = stars && i % 3 === 0, x = 50 + (Math.random() - .5) * 30, dx = (Math.random() - .5) * 420, dy = -(160 + Math.random() * 260), r = Math.random() * 900 - 450;
    return `<i class="${star ? 'st' : 'cf'}" style="--x:${x}%;--dx:${dx}px;--dy:${dy}px;--r:${r}deg;--c:${colors[i % colors.length]};--d:${Math.random() * 180}ms;--t:${1100 + Math.random() * 900}ms">${star ? '★' : ''}</i>`;
  }).join('');
  $('tm-app').appendChild(box);
  later(() => box.remove(), 2400);
}

/* ---------- 순위 ---------- */
async function board(level = T.level, kind = 'best') {
  const draw = (r, loading = false) => `<div class="tm-board">
    <div class="ya-seg" role="group" aria-label="난이도">${TIMING.LEVELS.map(k => `<button type="button" data-tb-level="${k}" class="${k === level ? 'on' : ''}" aria-pressed="${k === level}">${LEVEL_NAMES[k]}</button>`).join('')}</div>
    <div class="ya-seg" role="group" aria-label="순위 기준"><button type="button" data-tb-kind="best" class="${kind === 'best' ? 'on' : ''}" aria-pressed="${kind === 'best'}">최고 기록</button><button type="button" data-tb-kind="avg" class="${kind === 'avg' ? 'on' : ''}" aria-pressed="${kind === 'avg'}">평균 오차</button></div>
    <p class="tm-board-note">이번 주 · 같은 학년 · 오차가 작을수록 위${kind === 'avg' ? ` · ${TIMING.AVG_MIN}판 이상` : ''}</p>
    ${loading ? '<p class="tm-board-empty">불러오는 중…</p>' : !r?.rows?.length ? '<p class="tm-board-empty">아직 기록이 없어요. 첫 기록의 주인공이 되어 보세요!</p>'
      : `<ol class="tm-rows">${r.rows.map(x => `<li class="${x.me ? 'me' : ''}${x.rank <= 3 ? ` top r${x.rank}` : ''}"><span class="tm-rank">${x.rank <= 3 ? ['🥇', '🥈', '🥉'][x.rank - 1] : x.rank}</span><span class="tm-who">${avatar(x.pet || 'lumi', { size: 'mini' })}<b>${esc(x.name)}</b>${x.school ? `<small>${esc(x.school)}</small>` : ''}</span><span class="tm-val"><b>±${secText(x.err)}</b><small>${num(x.n)}판</small></span></li>`).join('')}</ol>`}
  </div>`;
  const sheet = openSheet(draw(null, true), '10초 맞추기 순위', { className: 'tm-board-sheet' });
  const load = async () => {
    let r = null;
    try { r = await api(`/timing/board?level=${level}&kind=${kind}`); } catch (err) { toast(err.message); }
    sheet.set(draw(r));
  };
  sheet.box.addEventListener('click', e => {
    const l = e.target.closest('[data-tb-level]'), k = e.target.closest('[data-tb-kind]');
    if (l) { level = l.dataset.tbLevel; sheet.set(draw(null, true)); load(); }
    if (k) { kind = k.dataset.tbKind; sheet.set(draw(null, true)); load(); }
  });
  load();
}

/* ---------- 안내 ---------- */
function guide(first) {
  if (first) writePref('sumus-timing-guide', '1');
  const G = TIMING.GRADES;
  const sheet = openSheet(`<div class="tm-guide">
    <h2>⏱ 10초 맞추기</h2>
    <ol><li>시작하면 3 · 2 · 1 뒤에 숫자판이 <b>0.00</b>부터 올라가요.</li><li>숫자는 잠깐만 보이고 꺼져요(이지 3초 · 노말 1초 · 하드는 처음부터).</li><li>속으로 세다가 <b>딱 10.00초</b>라고 생각할 때 큰 버튼(또는 스페이스)을 눌러요.</li></ol>
    <table><thead><tr><th>등급</th><th>오차</th><th>코인(이지 · 노말 · 하드)</th></tr></thead><tbody>
      ${['perfect', 'great', 'good', 'miss'].map(k => `<tr><td>${GRADE_MARKS[k]} ${GRADE_NAMES[k]}</td><td>${k === 'miss' ? `±${secText(G.good)}초 밖` : `±${secText(G[k])}초 안`}</td><td>${TIMING.LEVELS.map(lv => TIMING.COINS[lv][k]).join(' · ')}</td></tr>`).join('')}
    </tbody></table>
    <p>하루 <b>${TIMING.FREE_DAILY}판</b> 무료, 연습 끝내기(${TIMING.MIN_PRACTICE}문제 이상) · 출석마다 <b>+1판</b>. 코인은 하루 ${TIMING.COIN_DAILY}개까지, 경험치는 판마다.</p>
    <p>순위는 이번 주 같은 학년끼리, 난이도마다 <b>최고 기록</b>과 <b>평균 오차</b>(${TIMING.AVG_MIN}판 이상)로 봐요.</p>
    <p class="tm-small">화면을 내리거나 다른 앱으로 가면 그 판은 무효예요. 시간은 서버도 함께 재서 너무 다르면 서버가 잰 시간으로 판정해요.</p>
    <button type="button" class="yl-cta" data-close>알겠어요!</button></div>`, '10초 맞추기 안내', { className: 'tm-guide-sheet' });
  sheet.box.querySelector('[data-close]')?.addEventListener('click', () => sheet.close());
}
