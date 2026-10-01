import { esc, num } from './ui.js';
import { coin } from './emblems.js';
import { LUCKY_BETS, LUCKY_DAILY, LUCKY_ODDS, LUCKY_TICKET_BET } from './rewards.js';

// V13.68 코인 뽑기: the machine on the 놀이터 page and the show when a capsule comes out.
// The server has already decided the result (server/rewards.mjs pullLucky); this module only
// builds up to it: coin in, dial, the capsule drops, shakes (more for better results), glows,
// bursts open, and the coins count up. A tap skips to the result; reduced motion shows it at once.

export const MULT_CLASS = { 0: 't-miss', 1: 't-common', 2: 't-rare', 3: 't-legendary' };
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const BALLS = ['#ff8fb1', '#7cc7ff', '#ffd166', '#8ee6b8', '#b69cff', '#ff9f6b', '#6ee7d6', '#ffc1d9', '#9ad0ff', '#ffe08a', '#a0e7b8', '#f7a8ff'];
const BALL_SPOTS = [[8, 4], [36, 2], [64, 5], [92, 3], [120, 6], [20, 28], [50, 30], [80, 27], [108, 30], [34, 54], [66, 56], [96, 52]];

/* ---------- sound and vibration (the yacha sound switch applies here too) ---------- */
const soundOn = () => { try { return (localStorage.getItem('sumus-yacha-sound') ?? 'on') === 'on'; } catch { return true; } };
let audio = null;
export function unlockSound() {
  if (!soundOn()) return;
  // iOS suspends the sound after the app was in the background or a call: wake it on the next tap.
  if (audio) { if (audio.state !== 'running') audio.resume?.().catch(() => {}); return; }
  try { audio = new (window.AudioContext || window.webkitAudioContext)(); } catch { audio = null; }
}
function tone(freqs, { type = 'sine', len = .12, gap = .07, vol = .05, slide = 0 } = {}) {
  if (!audio || !soundOn()) return;
  const t0 = audio.currentTime + .01;
  freqs.forEach((f, i) => {
    const osc = audio.createOscillator(), gain = audio.createGain(), t = t0 + i * gap;
    osc.type = type;
    osc.frequency.setValueAtTime(f, t);
    if (slide) osc.frequency.linearRampToValueAtTime(Math.max(40, f + slide), t + len);
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(vol, t + .01);
    gain.gain.exponentialRampToValueAtTime(.0001, t + len);
    osc.connect(gain).connect(audio.destination);
    osc.start(t); osc.stop(t + len + .02);
  });
}
const buzz = pattern => { try { if (soundOn()) navigator.vibrate?.(pattern); } catch {} };
const SFX = {
  clink: () => tone([1568, 2349], { type: 'triangle', len: .07, gap: .06, vol: .04 }),
  tick: () => tone([1100], { type: 'square', len: .025, vol: .02 }),
  thud: () => { tone([170], { len: .2, slide: -90, vol: .09 }); buzz(18); },
  wobble: n => tone([520 + n * 90], { type: 'triangle', len: .08, vol: .035 }),
  pop: () => tone([380], { type: 'triangle', len: .16, slide: 700, vol: .06 }),
  coins: n => tone(Array.from({ length: Math.min(8, 2 + n) }, (_, i) => 1760 + (i % 3) * 330), { type: 'triangle', len: .09, gap: .055, vol: .03 }),
  even: () => tone([587, 698], { type: 'triangle', gap: .1, len: .18, vol: .04 }),
  win: () => { tone([659, 784, 988, 1319], { type: 'triangle', gap: .08, len: .2, vol: .045 }); buzz([30, 40, 30]); },
  jackpot: () => { tone([523, 659, 784, 1047, 1319, 1568], { type: 'square', gap: .09, len: .24, vol: .03 }); buzz([40, 50, 40, 50, 120]); },
  miss: () => tone([392, 330, 262], { type: 'triangle', gap: .15, len: .28, vol: .04 })
};

/* ---------- the machine ---------- */
export function luckyCard(state, bet, balance) {
  const l = state, tickets = Number(l.tickets || 0), left = Number(l.left ?? LUCKY_DAILY);
  const can = left > 0 && balance >= bet;
  const recent = (l.recent || []).slice(0, 5);
  const todayNet = (l.recent || []).filter(r => sameDay(r.at)).reduce((n, r) => n + (r.ticket ? r.bet * r.mult : r.bet * r.mult - r.bet), 0);
  return `<section class="lk-card" id="lk-card">
    <div class="lk-head"><div><small>COIN CAPSULE</small><h2>코인 뽑기</h2></div><span class="lk-left" aria-label="오늘 남은 뽑기 ${left}번">${Array.from({ length: l.daily || LUCKY_DAILY }, (_, i) => `<i class="${i < left ? 'on' : ''}"></i>`).join('')}<b>${left}/${l.daily || LUCKY_DAILY}</b></span></div>
    <div class="lk-stagebox">
      <div class="lk-machine" id="lk-machine" aria-hidden="true">
        <span class="lk-bulbs">${Array.from({ length: 9 }, (_, i) => `<i style="--i:${i}"></i>`).join('')}</span>
        <div class="lk-glass">${BALLS.map((c, i) => `<i style="--c:${c};--i:${i};left:${BALL_SPOTS[i][0]}px;bottom:${BALL_SPOTS[i][1]}px"></i>`).join('')}<span class="lk-glare"></span></div>
        <div class="lk-base">
          <span class="lk-marquee">×3 · ×2 · ×1</span>
          <span class="lk-slot"><i class="lk-coin-in"></i></span>
          <span class="lk-dial"><i></i></span>
          <span class="lk-chute"><i class="lk-drop"></i></span>
        </div>
      </div>
      <div class="lk-odds" aria-label="확률">${LUCKY_ODDS.slice().reverse().map(o => `<span class="${MULT_CLASS[o.mult]}"><b>${o.mult ? `×${o.mult}` : '꽝'}</b><em>${o.rate}%</em></span>`).join('')}</div>
    </div>
    <div class="lk-bets" role="group" aria-label="걸 코인">${(l.bets || LUCKY_BETS).map(b => `<button type="button" class="lk-bet ${bet === b ? 'on' : ''}" data-ga="bet" data-bet="${b}" aria-pressed="${bet === b}"><span class="lk-stack" aria-hidden="true">${'<i></i>'.repeat(b / 10)}</span><b>${b}</b></button>`).join('')}</div>
    <button type="button" class="lk-go" data-ga="pull" ${can ? '' : 'disabled'}>${left > 0 ? (balance >= bet ? `<span>뽑기!</span><em>${coin()}${bet}</em>` : '<span>코인이 부족해요</span>') : '<span>오늘 뽑기 끝! 내일 또 만나요</span>'}</button>
    ${tickets ? `<button type="button" class="lk-ticket" data-ga="ticket"><b>🎟</b> 뽑기권 ${tickets}장 · ${coin()}${LUCKY_TICKET_BET} 공짜 뽑기</button>` : ''}
    ${recent.length ? `<div class="lk-recent"><span>최근</span>${recent.map(r => `<i class="${MULT_CLASS[r.mult]}">${r.mult ? `×${r.mult}` : '꽝'}</i>`).join('')}${todayNet ? `<em class="${todayNet > 0 ? 'up' : 'down'}">오늘 ${todayNet > 0 ? '+' : '−'}${num(Math.abs(todayNet))}</em>` : ''}</div>` : ''}
    <p class="lk-note">하루 ${l.daily || LUCKY_DAILY}번 · 확률은 매번 같아요 <button type="button" class="lk-odds-more" data-ga="odds">자세히</button> · 뽑기권은 출석 7번째 도장에서 받아요</p>
  </section>`;
}
const dayOf = at => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' }).format(new Date(at));
const sameDay = at => dayOf(at) === dayOf(Date.now());

// Coin in, dial turns and the capsules rattle while the server answers.
export async function machineSpin(machine) {
  if (!machine || reduced()) return;
  machine.classList.add('coin');
  SFX.clink();
  await wait(380);
  machine.classList.add('spin');
  for (let i = 0; i < 6; i++) { SFX.tick(); await wait(140); }
}
export async function machineDrop(machine) {
  if (!machine || reduced()) return;
  machine.classList.add('drop');
  SFX.thud();
  await wait(420);
  machine.classList.remove('coin', 'spin', 'drop');
}

/* ---------- the show ---------- */
const HEAD = { 0: '아쉬워요!', 1: '본전!', 2: '2배 당첨!', 3: 'JACKPOT! 3배!' };
const COIN_BURST = { 0: 0, 1: 8, 2: 18, 3: 32 };
function particles(mult) {
  if (!mult) return Array.from({ length: 12 }, (_, i) => { const a = i / 12 * Math.PI * 2; return `<i class="lk-p puff" style="--dx:${Math.cos(a) * 70}px;--dy:${Math.sin(a) * 50}px;--d:${.5 + (i % 3) * .1}s"></i>`; }).join('');
  return Array.from({ length: COIN_BURST[mult] }, (_, i) => {
    const a = (i / COIN_BURST[mult]) * Math.PI * 2 + (i % 2) * .3, r = 90 + (i * 37) % 90;
    return `<i class="lk-p coin" style="--dx:${Math.round(Math.cos(a) * r)}px;--dy:${Math.round(Math.sin(a) * r - 60)}px;--r:${(i * 83) % 540 - 270}deg;--d:${(.7 + (i % 5) * .08).toFixed(2)}s"></i>`;
  }).join('');
}
function confetti() {
  const colors = ['#ffd35a', '#ff6b8a', '#5ac8fa', '#6ee7a8', '#a78bfa', '#ff9f43'];
  return Array.from({ length: 46 }, (_, i) => `<i class="lk-conf" style="left:${(i * 53) % 100}%;--c:${colors[i % colors.length]};--d:${(1.6 + (i % 7) * .22).toFixed(2)}s;--delay:${((i % 9) * .07).toFixed(2)}s;--r:${(i * 47) % 360}deg"></i>`).join('');
}
// Resolves when the student closes it: true for "한 번 더" (offered when `again`).
export function luckyShow(res, { again = false, againLabel = '' } = {}) {
  return new Promise(resolve => {
    const cls = MULT_CLASS[res.mult] || 't-miss';
    const box = document.createElement('div');
    box.className = `lk-show ${cls}`;
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-modal', 'true');
    box.setAttribute('aria-label', `코인 뽑기 결과: ${HEAD[res.mult]}`);
    box.innerHTML = `<div class="lk-spot"></div>
      <div class="lk-cap" id="lk-cap"><i class="top"></i><i class="bot"></i><span class="lk-cap-band"></span><span class="lk-cap-shine"></span></div>
      <div class="lk-burst" id="lk-burst"></div>
      <div class="lk-result" id="lk-result" hidden>
        ${res.mult === 3 ? '<div class="lk-ribbon">JACKPOT</div>' : ''}
        <span class="lk-big ${cls}">${res.mult ? `×${res.mult}` : '꽝'}</span>
        <h2>${HEAD[res.mult]}</h2>
        <p class="lk-pay">${res.mult ? `${coin('big')}<b id="lk-count">0</b><span>코인</span>` : `<span class="lk-lost">${coin()}${num(res.bet)}코인이 사라졌어요</span>`}</p>
        <p class="lk-sub">${res.ticket ? '뽑기권으로 공짜 뽑기!' : `${num(res.bet)}코인 걸고 ${res.mult ? `${num(res.paid)}코인 받았어요` : '다음엔 꼭!'} · 오늘 남은 뽑기 ${res.lucky.left}번`}</p>
        <div class="lk-actions">${again ? `<button type="button" class="lk-again" data-lk="again">한 번 더 <em>${againLabel}</em></button>` : ''}<button type="button" class="lk-ok" data-lk="ok">확인</button></div>
      </div>
      <button type="button" class="lk-skip" data-lk="skip">건너뛰기</button>`;
    document.body.appendChild(box);
    const cap = box.querySelector('#lk-cap'), burst = box.querySelector('#lk-burst'), result = box.querySelector('#lk-result');
    let skipped = false, shown = false;
    const close = go => { box.classList.add('bye'); setTimeout(() => box.remove(), 180); resolve(!!go); };
    const showResult = () => {
      if (shown) return;
      shown = true;
      box.classList.add('opened');
      box.querySelector('.lk-skip')?.remove();
      result.hidden = false;
      if (res.mult === 3) { box.insertAdjacentHTML('beforeend', `<div class="lk-confetti" aria-hidden="true">${confetti()}</div>`); SFX.jackpot(); }
      else if (res.mult === 2) SFX.win();
      else if (res.mult === 1) SFX.even();
      else SFX.miss();
      const count = box.querySelector('#lk-count');
      if (count) {
        if (reduced() || skipped) count.textContent = num(res.paid);
        else {
          const start = performance.now(), dur = 520 + res.mult * 180;
          const step = t => { const k = Math.min(1, (t - start) / dur); count.textContent = num(Math.round(res.paid * (1 - Math.pow(1 - k, 3)))); if (k < 1 && box.isConnected) requestAnimationFrame(step); };
          requestAnimationFrame(step);
        }
      }
      (box.querySelector('.lk-again') || box.querySelector('.lk-ok')).focus({ preventScroll: true });
    };
    box.addEventListener('click', e => {
      const b = e.target.closest('[data-lk]');
      if (!shown) { skipped = true; return showResult(); }
      if (b?.dataset.lk === 'again') return close(true);
      if (b?.dataset.lk === 'ok') return close(false);
    });
    box.addEventListener('keydown', e => { if (e.key === 'Escape' && shown) close(false); });
    (async () => {
      requestAnimationFrame(() => box.classList.add('open'));
      if (reduced()) return showResult();
      await wait(80);
      cap.classList.add('fall');
      await wait(620);
      if (skipped) return;
      SFX.thud();
      // Better results shake more; the last shake shows the result's color.
      const shakes = res.mult === 0 ? 1 : res.mult === 1 ? 2 : 3;
      for (let i = 0; i < shakes; i++) {
        if (skipped) return;
        if (i === shakes - 1) cap.dataset.glow = cls;
        cap.classList.remove('wob'); void cap.offsetWidth; cap.classList.add('wob');
        SFX.wobble(i);
        await wait(res.mult === 3 && i === shakes - 1 ? 760 : 470);
      }
      if (skipped) return;
      cap.classList.add('pop');
      SFX.pop();
      burst.innerHTML = particles(res.mult);
      if (res.mult) setTimeout(() => SFX.coins(res.mult * 2), 120);
      box.classList.add('flash');
      await wait(360);
      showResult();
    })();
  });
}

// V13.82: the same little synth and vibration for 가위바위보 (rps.js).
export { tone as sfxTone, buzz as sfxBuzz };
