// V13.82 가위바위보 against 로보 (놀이터, after the coin capsule). The server picks 로보's hand
// and keeps the pot (server/rewards.mjs rpsPlay/rpsCash); this module draws the card and the
// match: both hands shake to "가위! 바위! 보!", clash, and a win can be taken or played again
// for double (×2 → ×4 → ×8). A tie is thrown again for free.
import { api, esc, num, toast } from './ui.js';
import { avatar } from './character.js';
import { coin } from './emblems.js';
import { RPS_BETS, RPS_DAILY, RPS_MAX_WINS, RPS_HANDS, RPS_KEYS } from './rewards.js';
import { sfxTone as tone, sfxBuzz as buzz, unlockSound } from './lucky.js';

const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const SFX = {
  drum: n => { tone([150 + n * 40, 75 + n * 20], { type: 'square', len: .1, gap: .015, vol: .045 }); buzz(12 + n * 6); },
  clash: () => { tone([880, 220], { type: 'sawtooth', len: .22, gap: .02, vol: .05, slide: -120 }); buzz([40]); },
  win: () => { tone([659, 784, 988, 1319], { type: 'triangle', gap: .08, len: .2, vol: .05 }); buzz([30, 40, 30]); },
  tie: () => tone([523, 523], { type: 'triangle', gap: .12, len: .14, vol: .04 }),
  lose: () => { tone([392, 330, 262, 196], { type: 'triangle', gap: .14, len: .3, vol: .045 }); buzz([90]); },
  cash: () => tone([1568, 2093, 1760, 2349, 2637], { type: 'triangle', gap: .05, len: .1, vol: .035 }),
  jackpot: () => { tone([523, 659, 784, 1047, 1319, 1568, 2093], { type: 'square', gap: .085, len: .26, vol: .03 }); buzz([40, 50, 40, 50, 160]); }
};
const ladder = (wins, bet) => Array.from({ length: RPS_MAX_WINS }, (_, i) => `<span class="rps-step${wins > i ? ' on' : ''}${wins === i ? ' next' : ''}"><b>×${2 ** (i + 1)}</b><small>${num(bet * 2 ** (i + 1))}</small></span>`).join('');

/* ---------- the card in 놀이터 ---------- */
export function rpsCard(state, bet, balance) {
  const s = state || { bets: RPS_BETS, daily: RPS_DAILY, left: RPS_DAILY, max_wins: RPS_MAX_WINS };
  const left = Number(s.left ?? RPS_DAILY), live = s.live;
  const can = live || (left > 0 && balance >= bet);
  const recent = (s.recent || []).slice(0, 5);
  return `<section class="rps-card" id="rps-card">
    <div class="rps-card-head"><div><small>ROBO RPS</small><h2>가위바위보</h2></div><span class="lk-left" aria-label="오늘 남은 판 ${left}번">${Array.from({ length: s.daily || RPS_DAILY }, (_, i) => `<i class="${i < left ? 'on' : ''}"></i>`).join('')}</span></div>
    <div class="rps-card-stage" aria-hidden="true">
      <span class="rps-card-pet robot">${avatar('robot', { form: 3, size: 'mini' })}</span>
      <span class="rps-card-hands">${RPS_KEYS.map((k, i) => `<i style="--i:${i}">${RPS_HANDS[k].emoji}</i>`).join('')}</span>
      <span class="rps-card-vs">VS</span>
    </div>
    <div class="rps-card-ladder">${ladder(-1, bet)}</div>
    ${live ? '' : `<div class="lk-bets" role="group" aria-label="걸 코인">${(s.bets || RPS_BETS).map(b => `<button type="button" class="lk-bet ${bet === b ? 'on' : ''}" data-rps="bet" data-bet="${b}" aria-pressed="${bet === b}"><span>${coin()}${b}</span></button>`).join('')}</div>`}
    <button type="button" class="rps-go" data-rps="${live ? 'resume' : 'play'}" ${can ? '' : 'disabled'}>${live ? `<span>하던 판 이어서</span><em>${coin()}${num(live.pot)}</em>` : left > 0 ? (balance >= bet ? `<span>로보에게 도전!</span><em>${coin()}${bet}</em>` : '<span>코인이 부족해요</span>') : '<span>오늘 판을 다 했어요</span>'}</button>
    ${recent.length ? `<div class="lk-recent"><span>최근</span>${recent.map(r => `<i class="${r.paid ? 'up' : 'down'}">${r.paid ? `+${num(r.paid - r.bet)}` : `−${num(r.bet)}`}</i>`).join('')}</div>` : ''}
    <p class="lk-note">하루 ${s.daily || RPS_DAILY}판 · 이기면 2배, 계속 이기면 ×4 · ×8 · 비기면 한 번 더 · 로보는 무작위로 내요</p>
  </section>`;
}

/* ---------- the match ---------- */
// Resolves with the last balance when the student closes it. `onBalance` follows every change.
export function rpsMatch(A, { bet, live = null, onBalance }) {
  unlockSound();
  return new Promise(resolve => {
    const pet = A.data.stats?.pet || { key: A.data.profile?.avatar_key || 'dog', form: 1 };
    const g = { bet: live?.bet || bet, pot: live?.pot || bet, wins: live?.wins || 0, phase: live?.await === 'choice' ? 'choice' : 'pick', fresh: !live, busy: false, balance: Number(A.data.stats?.points_balance || 0), left: Number(A.data.rewards?.rps?.left ?? RPS_DAILY) };
    const box = document.createElement('div');
    box.className = 'rps-show';
    box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true'); box.setAttribute('aria-label', '가위바위보');
    box.innerHTML = `<div class="rps-bg" aria-hidden="true"><i></i><i></i><i></i></div>
      <div class="rps-top">
        <div class="rps-pot"><small>판돈</small><b>${coin()}<span id="rps-pot">${num(g.pot)}</span></b></div>
        <div class="rps-ladder" id="rps-ladder">${ladder(g.wins, g.bet)}</div>
        <button type="button" class="rps-x" data-r="close" aria-label="닫기">✕</button>
      </div>
      <div class="rps-arena" id="rps-arena">
        <div class="rps-side robot"><span class="rps-name">로보</span><span class="rps-avatar">${avatar('robot', { form: 3 })}</span><span class="rps-hand" id="rps-robot">✊</span></div>
        <div class="rps-mid"><span class="rps-vs">VS</span></div>
        <div class="rps-side me"><span class="rps-name">${esc(A.data.profile?.display_name || '나')}</span><span class="rps-avatar">${avatar(pet.key, { form: Math.max(1, pet.form ?? 1) })}</span><span class="rps-hand" id="rps-me">✊</span></div>
        <div class="rps-flash" id="rps-flash"></div>
        <div class="rps-burst" id="rps-burst"></div>
      </div>
      <div class="rps-banner" id="rps-banner" aria-live="assertive"></div>
      <div class="rps-controls" id="rps-controls"></div>`;
    document.body.appendChild(box);
    const $ = sel => box.querySelector(sel);
    requestAnimationFrame(() => box.classList.add('open'));

    const setBalance = value => { if (typeof value === 'number') { g.balance = value; onBalance?.(value); } };
    const banner = (text, cls = '') => { const b = $('#rps-banner'); b.className = `rps-banner ${cls}`; b.textContent = text; void b.offsetWidth; b.classList.add('pop'); };
    const potTo = value => {
      const el = $('#rps-pot'), from = g.pot;
      g.pot = value;
      if (reduced()) { el.textContent = num(value); return; }
      const start = performance.now(), dur = 600;
      const step = t => { const k = Math.min(1, (t - start) / dur); el.textContent = num(Math.round(from + (value - from) * (1 - Math.pow(1 - k, 3)))); if (k < 1 && box.isConnected) requestAnimationFrame(step); };
      requestAnimationFrame(step);
    };
    const controls = () => {
      const c = $('#rps-controls');
      if (g.phase === 'pick') {
        c.innerHTML = `<p class="rps-hint">${g.wins ? `${g.wins}연승 중! 지면 ${num(g.pot)}코인이 사라져요` : '무엇을 낼까요?'}</p><div class="rps-picks">${RPS_KEYS.map(k => `<button type="button" class="rps-pick" data-r="pick" data-hand="${k}"><span>${RPS_HANDS[k].emoji}</span><b>${RPS_HANDS[k].name}</b></button>`).join('')}</div>`;
      } else if (g.phase === 'choice') {
        const next = g.pot * 2;
        c.innerHTML = `<p class="rps-hint">${g.wins}연승! 여기서 받을까요, ${num(next)}코인에 도전할까요?</p><div class="rps-choice"><button type="button" class="rps-cash" data-r="cash">받기<em>${coin()}${num(g.pot)}</em></button><button type="button" class="rps-double" data-r="double">더블 도전!<em>×${2 ** (g.wins + 1)} · ${coin()}${num(next)}</em></button></div>`;
      } else {
        const again = g.left > 0 && g.balance >= g.bet;
        c.innerHTML = `<div class="rps-choice">${again ? `<button type="button" class="rps-double" data-r="again">한 판 더<em>${coin()}${num(g.bet)} · 오늘 ${g.left}판 남음</em></button>` : ''}<button type="button" class="rps-cash" data-r="close">닫기</button></div>`;
      }
      c.querySelector('button')?.focus({ preventScroll: true });
    };
    const close = () => { box.classList.add('bye'); setTimeout(() => box.remove(), 200); resolve(g.balance); };
    const burst = (kind, n) => {
      const el = $('#rps-burst');
      el.innerHTML = Array.from({ length: n }, (_, i) => { const a = i / n * Math.PI * 2, r = 80 + (i * 41) % 110; return `<i class="rps-p ${kind}" style="--dx:${Math.round(Math.cos(a) * r)}px;--dy:${Math.round(Math.sin(a) * r - 40)}px;--d:${(.6 + (i % 5) * .09).toFixed(2)}s"></i>`; }).join('');
    };
    const confetti = () => {
      const colors = ['#ffd35a', '#ff6b8a', '#5ac8fa', '#6ee7a8', '#a78bfa', '#ff9f43'];
      box.insertAdjacentHTML('beforeend', `<div class="lk-confetti" aria-hidden="true">${Array.from({ length: 50 }, (_, i) => `<i class="lk-conf" style="left:${(i * 53) % 100}%;--c:${colors[i % colors.length]};--d:${(1.6 + (i % 7) * .22).toFixed(2)}s;--delay:${((i % 9) * .07).toFixed(2)}s;--r:${(i * 47) % 360}deg"></i>`).join('')}</div>`);
    };

    async function throwHand(hand) {
      if (g.busy) return;
      g.busy = true;
      $('#rps-controls').innerHTML = '';
      const arena = $('#rps-arena'), robotHand = $('#rps-robot'), meHand = $('#rps-me');
      arena.classList.remove('win', 'lose', 'tie', 'clash');
      robotHand.textContent = '✊'; meHand.textContent = '✊';
      const body = g.phase === 'choice' ? { pick: hand, double: true } : g.fresh ? { bet: g.bet, pick: hand } : { pick: hand };
      const request = api('/rps/play', body);
      // 가위! 바위! 보! — the hands shake in time, a little faster each beat.
      if (!reduced()) {
        const words = ['가위!', '바위!', '보!'], beats = [430, 360, 300];
        for (let i = 0; i < 3; i++) {
          banner(words[i], 'call');
          arena.classList.remove('shake'); void arena.offsetWidth; arena.classList.add('shake');
          SFX.drum(i);
          await wait(beats[i]);
        }
      }
      let res;
      try { res = await request; }
      catch (err) { toast(err.message); g.busy = false; banner(''); controls(); return; }
      g.fresh = false;
      robotHand.textContent = RPS_HANDS[res.robot].emoji; meHand.textContent = RPS_HANDS[res.pick].emoji;
      arena.classList.remove('shake'); arena.classList.add('clash');
      SFX.clash();
      $('#rps-flash').classList.remove('go'); void $('#rps-flash').offsetWidth; $('#rps-flash').classList.add('go');
      g.left = Number(res.rps?.left ?? g.left);
      if (A.data.rewards) A.data.rewards.rps = res.rps;
      await wait(reduced() ? 0 : 420);
      if (res.result === 'draw') {
        arena.classList.add('tie'); banner('비겼다! 한 번 더!', 'tie'); SFX.tie();
        g.phase = 'pick';
        await wait(reduced() ? 0 : 700);
      } else if (res.result === 'lose') {
        arena.classList.add('lose'); banner(g.wins ? `${g.wins}연승에서 멈췄어요…` : '로보 승리…', 'lose'); SFX.lose();
        burst('puff', 14);
        potTo(0);
        g.wins = 0; g.phase = 'end';
        setBalance(res.points_balance);
      } else {
        arena.classList.add('win'); g.wins = res.wins;
        $('#rps-ladder').innerHTML = ladder(g.wins, g.bet);
        potTo(res.pot);
        burst('coin', 10 + g.wins * 8);
        if (res.done) {
          banner(`${RPS_MAX_WINS}연승! ×${2 ** RPS_MAX_WINS} 대박!`, 'jackpot'); SFX.jackpot(); confetti();
          g.phase = 'end';
          setBalance(res.points_balance);
          toast(`${num(res.paid)}코인을 받았어요!`);
        } else {
          banner(g.wins === 1 ? '승리!' : `${g.wins}연승!`, 'win'); SFX.win();
          g.phase = 'choice';
        }
      }
      g.busy = false;
      controls();
    }
    async function cash() {
      if (g.busy) return;
      g.busy = true;
      try {
        const res = await api('/rps/cash', {});
        if (A.data.rewards) A.data.rewards.rps = res.rps;
        g.left = Number(res.rps?.left ?? g.left);
        setBalance(res.points_balance);
        banner(`+${num(res.paid)}코인 획득!`, 'win'); SFX.cash();
        burst('coin', 26);
        g.phase = 'end';
      } catch (err) { toast(err.message); }
      g.busy = false;
      controls();
    }
    box.addEventListener('click', e => {
      const b = e.target.closest('[data-r]');
      if (!b || g.busy) return;
      const r = b.dataset.r;
      if (r === 'pick') return throwHand(b.dataset.hand);
      if (r === 'cash') return cash();
      if (r === 'double') { banner(`×${2 ** (g.wins + 1)} 도전! 무엇을 낼까요?`, 'call'); const c = $('#rps-controls'); c.innerHTML = `<p class="rps-hint">${num(g.pot * 2)}코인이 걸렸어요!</p><div class="rps-picks">${RPS_KEYS.map(k => `<button type="button" class="rps-pick hot" data-r="pick" data-hand="${k}"><span>${RPS_HANDS[k].emoji}</span><b>${RPS_HANDS[k].name}</b></button>`).join('')}</div>`; c.querySelector('button')?.focus({ preventScroll: true }); return; }
      if (r === 'again') {
        Object.assign(g, { pot: g.bet, wins: 0, phase: 'pick', fresh: true });
        $('#rps-pot').textContent = num(g.bet); $('#rps-ladder').innerHTML = ladder(0, g.bet);
        $('#rps-arena').classList.remove('win', 'lose', 'tie', 'clash'); $('#rps-robot').textContent = '✊'; $('#rps-me').textContent = '✊';
        banner('');
        return controls();
      }
      if (r === 'close') {
        // A won pot is kept on the server (taken on the next play, or after 10 minutes).
        if (g.phase === 'choice') toast(`${num(g.pot)}코인은 다음에 이어서 받을 수 있어요.`);
        return close();
      }
    });
    box.addEventListener('keydown', e => { if (e.key === 'Escape' && !g.busy) close(); });
    banner(live ? (live.await === 'choice' ? `${g.wins}연승 중!` : '하던 판을 이어서 해요') : '로보와 한 판!', 'call');
    controls();
  });
}
