import { esc, num } from './ui.js';
import { coin, artOr } from './emblems.js';
import { CHARACTERS, EPIC_EGG_LEGENDARY_RATE, SEASONS } from './core.js';
import { LUCKY_BETS, LUCKY_DAILY, LUCKY_ODDS, LUCKY_TICKET_BET, LEGENDARY_RATE, LEGENDARY_PITY, EPIC_RATE } from './rewards.js';
import { playSound, unlockSound as unlockSoundFiles, preloadSound } from './sound.js';

// V13.68 코인 뽑기: the machine on the 놀이터 page and the show when a capsule comes out.
// The server has already decided the result (server/rewards.mjs pullLucky); this module only
// builds up to it: coin in, dial, the capsule drops, shakes (more for better results), glows,
// bursts open, and the coins count up. A tap skips to the result; reduced motion shows it at once.

export const MULT_CLASS = { 0: 't-miss', 1: 't-common', 2: 't-rare', 3: 't-legendary' };
// 기린과 / 해치와
const gwaWa = name => { const c = name.charCodeAt(name.length - 1) - 0xAC00; return name + (c >= 0 && c <= 11171 && c % 28 ? '과' : '와'); };
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

/* ---------- sound and vibration (the yacha sound switch applies here too) ---------- */
const soundOn = () => { try { return (localStorage.getItem('sumus-yacha-sound') ?? 'on') === 'on'; } catch { return true; } };
let audio = null;
export function unlockSound() {
  if (!soundOn()) return;
  unlockSoundFiles();
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
// V13.116: each moment plays its sound file first (sound.js); the tones are the fallback while the
// file is not downloaded yet.
const snd = (key, opts, fallback) => { if (!playSound(key, opts)) fallback(); };
const SFX = {
  clink: () => snd('coin', { gain: .8 }, () => tone([1568, 2349], { type: 'triangle', len: .07, gap: .06, vol: .04 })),
  tick: () => snd('tick', { gain: .8, vary: .03 }, () => tone([1100], { type: 'square', len: .025, vol: .02 })),
  thud: () => { snd('wiggle', { rate: .8 }, () => tone([170], { len: .2, slide: -90, vol: .09 })); buzz(18); },
  wobble: n => snd('wiggle', { rate: 1 + n * .12, gain: .8 }, () => tone([520 + n * 90], { type: 'triangle', len: .08, vol: .035 })),
  pop: () => snd('pop', {}, () => tone([380], { type: 'triangle', len: .16, slide: 700, vol: .06 })),
  coins: n => snd(n >= 4 ? 'coins' : 'coin', {}, () => tone(Array.from({ length: Math.min(8, 2 + n) }, (_, i) => 1760 + (i % 3) * 330), { type: 'triangle', len: .09, gap: .055, vol: .03 })),
  even: () => snd('coin', { rate: .9 }, () => tone([587, 698], { type: 'triangle', gap: .1, len: .18, vol: .04 })),
  win: () => { snd('levelup', {}, () => tone([659, 784, 988, 1319], { type: 'triangle', gap: .08, len: .2, vol: .045 })); buzz([30, 40, 30]); },
  epic: () => { snd('fanfare-epic', {}, () => tone([659, 784, 988, 1319], { type: 'triangle', gap: .08, len: .2, vol: .045 })); buzz([30, 40, 30]); },
  jackpot: () => { snd('fanfare-epic', {}, () => tone([523, 659, 784, 1047, 1319, 1568], { type: 'square', gap: .09, len: .24, vol: .03 })); buzz([40, 50, 40, 50, 120]); },
  miss: () => snd('fail', {}, () => tone([392, 330, 262], { type: 'triangle', gap: .15, len: .28, vol: .04 })),
  // V13.91 the legendary show (V13.116: the low drone of the boss sound, cut before its boom)
  rumble: () => { snd('boss', { dur: 1.5 }, () => tone([62, 58], { type: 'sawtooth', len: .9, gap: .25, vol: .05, slide: -12 })); buzz([60, 80, 60]); },
  rise: () => snd('combo', { rate: .75 }, () => tone([220, 330, 440, 587, 784], { type: 'sine', len: .32, gap: .16, vol: .035, slide: 60 })),
  beat: n => { snd('wiggle', { rate: .55 + n * .1, gain: 1.1 }, () => tone([70 + n * 10, 70 + n * 10], { type: 'sine', len: .14, gap: .16, vol: .09 + n * .02, slide: -30 })); buzz([35, 90, 45]); },
  crack: () => { snd('crack', {}, () => tone([1900, 1400, 2300, 1700], { type: 'square', len: .035, gap: .05, vol: .025 })); buzz(25); },
  boom: () => { snd('burst', {}, () => { tone([95], { type: 'sawtooth', len: .7, vol: .1, slide: -60 }); tone([2637, 3136], { type: 'triangle', len: .5, gap: .04, vol: .03, slide: -900 }); }); buzz([90, 40, 180]); },
  fanfare: () => snd('fanfare-legend', {}, () => { tone([523, 659, 784, 1047], { type: 'triangle', gap: .11, len: .22, vol: .05 }); setTimeout(() => tone([784, 1047, 1319, 1568, 2093], { type: 'square', gap: .09, len: .3, vol: .028 }), 520); setTimeout(() => tone([1047, 1319, 1568], { type: 'triangle', gap: 0, len: 1.1, vol: .035 }), 1050); })
};

/* ---------- the machine ---------- */
export function luckyCard(state, bet, balance) {
  const l = state, tickets = Number(l.tickets || 0), left = Number(l.left ?? LUCKY_DAILY);
  const legend = l.legend || { rate: LEGENDARY_RATE, pity: LEGENDARY_PITY, pulls: 0, remaining: LEGENDARY_PITY, owned: false, key: null };
  const can = left > 0 && balance >= bet;
  const recent = (l.recent || []).slice(0, 5);
  // V13.98: the server's count of the whole day (the recent list holds only the last six pulls).
  const todayNet = Number.isFinite(l.today_net) ? l.today_net : (l.recent || []).filter(r => sameDay(r.at)).reduce((n, r) => n + (r.ticket ? r.bet * r.mult : r.bet * r.mult - r.bet), 0);
  return `<section class="lk-card" id="lk-card">
    <div class="lk-head"><div><small>COIN CAPSULE</small><h2>코인 뽑기</h2></div><span class="lk-left" aria-label="오늘 남은 뽑기 ${left}번">${Array.from({ length: l.daily || LUCKY_DAILY }, (_, i) => `<i class="${i < left ? 'on' : ''}"></i>`).join('')}<b>${left}/${l.daily || LUCKY_DAILY}</b></span></div>
    <div class="lk-stagebox">
      <div class="lk-machine" id="lk-machine" aria-hidden="true">
        <img class="lk-machine-art" src="/assets/lucky/machine.webp" alt="" draggable="false">
        <img class="lk-machine-lit" src="/assets/lucky/machine-lit.webp" alt="" draggable="false">
        <i class="lk-coin-in"></i>
        <i class="lk-drop"></i>
      </div>
      <div class="lk-odds" aria-label="확률">${LUCKY_ODDS.slice().reverse().map(o => `<span class="${MULT_CLASS[o.mult]}"><b>${o.mult ? `×${o.mult}` : '꽝'}</b><em>${o.rate}%</em></span>`).join('')}</div>
    </div>
    <div class="lk-bets" role="group" aria-label="걸 코인">${(l.bets || LUCKY_BETS).map(b => `<button type="button" class="lk-bet ${bet === b ? 'on' : ''}" data-ga="bet" data-bet="${b}" aria-pressed="${bet === b}"><span class="lk-stack" aria-hidden="true">${'<i></i>'.repeat(b / 10)}</span><b>${b}</b></button>`).join('')}</div>
    <div class="lk-legend-status ${legend.owned ? 'owned' : ''}"><img src="/assets/lucky/legend-badge.webp" alt=""><span><b>${legend.owned ? `전설 펫 ${esc(gwaWa(CHARACTERS[legend.key]?.ko || ''))} 만났어요` : `전설 펫 ${legend.rate}%`}</b><small>${legend.owned ? '학생 한 명당 한 마리만 만날 수 있어요' : `행운 뽑기 전용 · ${num(legend.remaining)}회 안에 확정`}</small></span></div>
    ${l.epic?.left ? `<div class="lk-epic-status"><span aria-hidden="true">${artOr('epic-badge', '★', 'epic-badge-art')}</span><b>영웅 펫 ${l.epic.rate}%</b><small>전설이 아닐 때 · 아직 못 만난 영웅 ${num(l.epic.left)}마리 중 하나</small></div>` : ''}
    <button type="button" class="lk-go" data-ga="pull" ${can ? '' : 'disabled'}>${left > 0 ? (balance >= bet ? `<span>뽑기!</span><em>${coin()}${bet}</em>` : '<span>코인이 부족해요</span>') : '<span>오늘 뽑기 끝! 내일 또 만나요</span>'}</button>
    ${tickets ? `<button type="button" class="lk-ticket" data-ga="ticket"><img class="lk-ticket-art" src="/assets/lucky/ticket.webp" alt=""> 뽑기권 ${tickets}장 · ${coin()}${LUCKY_TICKET_BET} 공짜 뽑기</button>` : ''}
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
// V13.91 전설 연출: about six seconds, built so nobody can miss it. The screen goes dark and
// rumbles, the legendary egg rises, its heart beats three times, light cracks out of it, a white
// flash and shock rings, then rays turn behind the pet's egg with the shadow of what it grows
// into, the letters of LEGENDARY drop in and gold rains down. A tap jumps to the reveal;
// reduced motion shows the reveal at once.
function stars(n) {
  return Array.from({ length: n }, (_, i) => `<i class="lgx-star" style="left:${(i * 37) % 100}%;--d:${(2.2 + (i % 6) * .35).toFixed(2)}s;--delay:${((i % 11) * .18).toFixed(2)}s;--s:${.6 + (i % 4) * .25}"></i>`).join('');
}
function motes(n) {
  return Array.from({ length: n }, (_, i) => { const a = i / n * Math.PI * 2, r = 150 + (i * 53) % 120; return `<i class="lgx-mote" style="--x:${Math.round(Math.cos(a) * r)}px;--y:${Math.round(Math.sin(a) * r)}px;--d:${(.9 + (i % 5) * .12).toFixed(2)}s;--delay:${((i % 7) * .1).toFixed(2)}s"></i>`; }).join('');
}
export function legendaryShow(res, { again = false, againLabel = '' } = {}) {
  preloadSound(['boss', 'combo', 'wiggle', 'crack', 'burst', 'fanfare-legend']);
  return new Promise(resolve => {
    const key = res.legendary.key, c = CHARACTERS[key] || {}, name = c.ko || '전설 펫';
    const box = document.createElement('div');
    box.className = 'lk-show lk-legend-show lgx';
    box.style.setProperty('--lc', c.color || '#e9a23b');
    box.style.setProperty('--ll', c.light || '#ffe08a');
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-modal', 'true');
    box.setAttribute('aria-label', `전설 펫 ${name} 획득`);
    box.innerHTML = `<div class="lk-legend-sky" aria-hidden="true"></div>
      <div class="lgx-rays" aria-hidden="true"></div>
      <div class="lgx-omen" aria-hidden="true"><i></i><span>특별한 기운이 느껴져요…</span></div>
      <div class="lgx-motes" aria-hidden="true">${motes(28)}</div>
      <div class="lgx-stage" aria-hidden="true">
        <div class="lgx-aura"></div>
        <img class="lgx-glow" src="/assets/lucky/legend-egg-glow.webp" alt="">
        <img class="lgx-egg" src="/assets/lucky/legend-egg.webp" alt="">
        <img class="lgx-burst" src="/assets/lucky/legend-egg-burst.webp" alt="">
      </div>
      <div class="lgx-rings" aria-hidden="true"><i></i><i></i><i></i></div>
      <div class="lgx-flash" aria-hidden="true"></div>
      <div class="lgx-reveal" id="lgx-reveal" hidden>
        <div class="lgx-word" aria-hidden="true">${[...'LEGENDARY'].map((ch, i) => `<b style="--i:${i}">${ch}</b>`).join('')}</div>
        <div class="lgx-art">
          <img class="lgx-future" src="/assets/pets/${key}-3.webp" alt="" aria-hidden="true">
          <img class="lgx-pet" src="/assets/pets/${key}-0.webp" alt="${esc(name)}의 알">
          <img class="lgx-badge" src="/assets/lucky/legend-badge.webp" alt="전설">
        </div>
        <div class="lgx-card">
          <span class="lk-legend-kicker">LEGENDARY PET · ${esc(c.type || '')}</span><h2>전설 펫을 만났어요!</h2><h3>${esc(name)}의 알</h3>
          <p>${res.legendary.egg ? `영웅 알에서 ${EPIC_EGG_LEGENDARY_RATE}%의 행운으로 전설 펫이 나왔어요!` : res.legendary.guaranteed ? `${num(res.legendary.pull)}번째 뽑기 확정 보상이에요.` : `${LEGENDARY_RATE}%의 행운이 찾아왔어요!`} 뒤에 비치는 모습으로 자라요. 학교 친구들에게도 소식이 전해져요.</p>
          <small>${res.legendary.egg ? '알 상점 · 영웅 알' : `코인 뽑기 결과 · ${res.mult ? `${res.mult}배, ${num(res.paid)}코인` : '꽝'}`}</small>
          <div class="lk-actions">${again ? `<button type="button" class="lk-again" data-lk="again">한 번 더 <em>${againLabel}</em></button>` : ''}<button type="button" class="lk-ok" data-lk="ok">확인</button></div>
        </div>
      </div>
      <div class="lgx-rain" aria-hidden="true"></div>
      <button type="button" class="lk-skip" data-lk="skip">건너뛰기</button>`;
    document.body.appendChild(box);
    const reveal = box.querySelector('#lgx-reveal');
    let shown = false, ready = false;
    const close = go => { box.classList.add('bye'); setTimeout(() => box.remove(), 180); resolve(!!go); };
    const showResult = () => {
      if (shown) return;
      shown = true;
      box.classList.add('p4', 'p5', 'legend-opened');
      box.querySelector('.lk-skip')?.remove();
      reveal.hidden = false;
      box.querySelector('.lgx-rain').innerHTML = stars(36);
      box.insertAdjacentHTML('beforeend', `<div class="lk-confetti" aria-hidden="true">${confetti()}</div>`);
      SFX.fanfare();
      // The buttons wait a moment, so a tap meant to skip does not close the reveal.
      setTimeout(() => { ready = true; box.classList.add('ready'); (box.querySelector('.lk-again') || box.querySelector('.lk-ok'))?.focus({ preventScroll: true }); }, reduced() ? 0 : 900);
    };
    const flashThenShow = () => { if (shown) return; box.classList.add('p4'); SFX.boom(); setTimeout(showResult, reduced() ? 0 : 380); };
    box.addEventListener('click', e => {
      const b = e.target.closest('[data-lk]');
      if (!shown) return flashThenShow();
      if (!ready) return;
      if (b?.dataset.lk === 'again') return close(true);
      if (b?.dataset.lk === 'ok') return close(false);
    });
    box.addEventListener('keydown', e => { if (e.key === 'Escape' && ready) close(false); });
    requestAnimationFrame(() => box.classList.add('open'));
    if (reduced()) return showResult();
    const step = (ms, fn) => new Promise(r => setTimeout(() => { if (!shown) fn(); r(); }, ms));
    (async () => {
      await step(120, () => { box.classList.add('p0'); SFX.rumble(); });
      await step(900, () => { box.classList.add('p1'); SFX.rise(); });
      for (let n = 0; n < 3; n++) await step(n ? 520 : 900, () => { box.classList.remove('beat'); void box.offsetWidth; box.classList.add('p2', 'beat', `b${n + 1}`); SFX.beat(n); });
      await step(560, () => { box.classList.add('p3'); SFX.crack(); });
      await step(520, () => { box.classList.add('p4'); SFX.boom(); });
      await step(420, showResult);
    })();
  });
}
// V13.92 영웅 펫: the same show, shorter and in violet (about three and a half seconds): a
// violet omen, the pet's own egg rises, two heartbeats, one flash and ring, then the EPIC
// letters and the egg with the shadow of its final form. `res` is the coin capsule (with its
// "한 번 더"), or nothing when the egg came from the shop.
export function epicShow({ key, res = null, again = false, againLabel = '', from = '' }) {
  preloadSound(['combo', 'wiggle', 'pop', 'fanfare-epic']);
  return new Promise(resolve => {
    const c = CHARACTERS[key] || {}, name = c.ko || '영웅 펫';
    // V13.109: a season's limited pet (its egg in season, or a 영웅 egg after it) has its own words.
    const season = c.limited ? SEASONS[c.limited] : null;
    const box = document.createElement('div');
    box.className = `lk-show lk-legend-show lgx epic${season ? ' limited' : ''}`;
    box.style.setProperty('--lc', c.color || '#8b5cf6');
    box.style.setProperty('--ll', c.light || '#d8c8ff');
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-modal', 'true');
    box.setAttribute('aria-label', `${season ? '한정' : '영웅'} 펫 ${name} 획득`);
    box.innerHTML = `<div class="lk-legend-sky" aria-hidden="true"></div>
      <div class="lgx-rays" aria-hidden="true"></div>
      <div class="lgx-omen" aria-hidden="true"><i></i><span>반짝이는 기운이 느껴져요…</span></div>
      <div class="lgx-motes" aria-hidden="true">${motes(18)}</div>
      <div class="lgx-stage" aria-hidden="true">
        <div class="lgx-aura"></div>
        <img class="lgx-egg epic-egg" src="/assets/pets/${key}-0.webp" alt="">
      </div>
      <div class="lgx-rings" aria-hidden="true"><i></i></div>
      <div class="lgx-flash" aria-hidden="true"></div>
      <div class="lgx-reveal" id="lgx-reveal" hidden>
        <div class="lgx-word" aria-hidden="true">${[...(season ? 'LIMITED' : 'EPIC')].map((ch, i) => `<b style="--i:${i}">${ch}</b>`).join('')}</div>
        <div class="lgx-art">
          <img class="lgx-future" src="/assets/pets/${key}-3.webp" alt="" aria-hidden="true">
          <img class="lgx-pet" src="/assets/pets/${key}-0.webp" alt="${esc(name)}의 알">
          ${season ? `<img class="ui-art lgx-epic-badge-art" src="/assets/ui/limited-badge.webp" alt="" aria-hidden="true">` : artOr('epic-badge', '<span class="lgx-epic-badge" aria-hidden="true">★<small>영웅</small></span>', 'lgx-epic-badge-art')}
        </div>
        <div class="lgx-card">
          <span class="lk-legend-kicker">${season ? `${esc(season.name)} LIMITED` : 'EPIC'} PET · ${esc(c.type || '')}</span><h2>${season ? `${esc(season.name)} 한정 펫을 만났어요!` : '영웅 펫을 만났어요!'}</h2><h3>${esc(name)}의 알</h3>
          <p>${season ? `${from === 'season' ? `${esc(season.egg)}에서 나온 친구예요!` : `영웅 알에서 ${season.after_rate}%의 행운으로 ${esc(season.name)} 한정 펫이 나왔어요!`} 뒤에 비치는 모습으로 자라요. 한정 펫은 야차전 특기 대신 특별한 모습을 가졌어요.` : `${res ? `${EPIC_RATE}%의 행운으로 영웅 알이 나왔어요!` : '영웅 알에서 나온 친구예요!'} 뒤에 비치는 모습으로 자라고, 야차전에서 새 특기를 써요.`}</p>
          ${res ? `<small>코인 뽑기 결과 · ${res.mult ? `${res.mult}배, ${num(res.paid)}코인` : '꽝'}</small>` : ''}
          <div class="lk-actions">${again ? `<button type="button" class="lk-again" data-lk="again">한 번 더 <em>${againLabel}</em></button>` : ''}<button type="button" class="lk-ok" data-lk="ok">확인</button></div>
        </div>
      </div>
      <div class="lgx-rain" aria-hidden="true"></div>
      <button type="button" class="lk-skip" data-lk="skip">건너뛰기</button>`;
    document.body.appendChild(box);
    const reveal = box.querySelector('#lgx-reveal');
    let shown = false, ready = false;
    const close = go => { box.classList.add('bye'); setTimeout(() => box.remove(), 180); resolve(!!go); };
    const showResult = () => {
      if (shown) return;
      shown = true;
      box.classList.add('p4', 'p5', 'legend-opened');
      box.querySelector('.lk-skip')?.remove();
      reveal.hidden = false;
      box.querySelector('.lgx-rain').innerHTML = stars(18);
      box.insertAdjacentHTML('beforeend', `<div class="lk-confetti" aria-hidden="true">${confetti()}</div>`);
      SFX.epic();
      setTimeout(() => { ready = true; box.classList.add('ready'); (box.querySelector('.lk-again') || box.querySelector('.lk-ok'))?.focus({ preventScroll: true }); }, reduced() ? 0 : 700);
    };
    const flashThenShow = () => { if (shown) return; box.classList.add('p4'); SFX.pop(); setTimeout(showResult, reduced() ? 0 : 300); };
    box.addEventListener('click', e => {
      const b = e.target.closest('[data-lk]');
      if (!shown) return flashThenShow();
      if (!ready) return;
      if (b?.dataset.lk === 'again') return close(true);
      if (b?.dataset.lk === 'ok') return close(false);
    });
    box.addEventListener('keydown', e => { if (e.key === 'Escape' && ready) close(false); });
    requestAnimationFrame(() => box.classList.add('open'));
    if (reduced()) return showResult();
    const step = (ms, fn) => new Promise(r => setTimeout(() => { if (!shown) fn(); r(); }, ms));
    (async () => {
      await step(100, () => { box.classList.add('p0'); buzz(30); });
      await step(650, () => { box.classList.add('p1'); SFX.rise(); });
      for (let n = 0; n < 2; n++) await step(n ? 480 : 800, () => { box.classList.remove('beat'); void box.offsetWidth; box.classList.add('p2', 'beat', `b${n + 2}`); SFX.beat(n); });
      await step(480, () => { box.classList.add('p4'); SFX.pop(); buzz([60, 30, 90]); });
      await step(320, showResult);
    })();
  });
}
// Resolves when the student closes it: true for "한 번 더" (offered when `again`).
export function luckyShow(res, { again = false, againLabel = '' } = {}) {
  preloadSound(['wiggle', 'pop', 'coin', 'coins', 'levelup', 'fanfare-epic', 'fail']);
  if (res.legendary) return legendaryShow(res, { again, againLabel });
  if (res.epic) return epicShow({ key: res.epic.key, res, again, againLabel });
  return new Promise(resolve => {
    const cls = MULT_CLASS[res.mult] || 't-miss';
    const box = document.createElement('div');
    box.className = `lk-show ${cls}`;
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-modal', 'true');
    box.setAttribute('aria-label', `코인 뽑기 결과: ${HEAD[res.mult]}`);
    box.innerHTML = `<div class="lk-spot"></div>
      <div class="lk-cap" id="lk-cap"><img class="top" src="/assets/lucky/capsule-top.webp" alt=""><img class="bot" src="/assets/lucky/capsule-bottom.webp" alt=""></div>
      <div class="lk-burst" id="lk-burst"></div>
      <div class="lk-result" id="lk-result" hidden>
        ${res.mult === 3 ? '<div class="lk-ribbon">JACKPOT</div>' : ''}
        ${res.mult === 0 ? '<img class="lk-result-art" src="/assets/lucky/miss.webp" alt="">' : res.mult === 3 ? '<img class="lk-result-art" src="/assets/lucky/jackpot.webp" alt="">' : ''}
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
