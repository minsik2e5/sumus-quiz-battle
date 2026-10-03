// V13.82 가위바위보 against 로보 (놀이터, after the coin capsule). The server picks 로보's hand
// and keeps the pot (server/rewards.mjs rpsPlay/rpsCash); this module draws the card and the
// match:
// - an entrance (both fighters slide in, VS slams down),
// - 로보 talks: taunts, reactions, and sometimes says what it will throw (it may lie: it does
//   not know, the server picks at random),
// - both hands pump to "가위! 바위! 보!", fly together and clash with a shockwave and a stamp,
// - a win can be taken or played again for double (×2 → ×4 → ×8). From the second round the
//   screen gets tense (heartbeat, red edges); the third is "운명의 한 판".
// A tie is thrown again for free.
// V13.85 drawn art (/assets/rps/): the three hand medals, the clash, and 로보's poses — it pumps
// its fist, throws its hand, then reacts (gloats, gets dizzy, glitches at ×8, thinks on a tie).
// V13.86 a comic panel: the screen splits along a lightning bolt (로보's half, my half) with a VS
// burst in the middle, and two arms reach in from the screen edges, pump, and smash together.
// V13.97 the arm pictures (05-rps-arms, /assets/rps/arm-<robot|me>-<hand>.webp) are in; before
// that the arms were drawn sleeves ending in the hand medals (ARM_ART = false still does that).
import { api, esc, num, toast } from './ui.js';
import { avatar } from './character.js';
import { coin } from './emblems.js';
import { RPS_BETS, RPS_DAILY, RPS_MAX_WINS, RPS_HANDS, RPS_KEYS } from './rewards.js';
import { sfxTone as tone, sfxBuzz as buzz, unlockSound } from './lucky.js';

const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const pickOne = list => list[Math.floor(Math.random() * list.length)];
const SFX = {
  whoosh: () => tone([300], { type: 'sawtooth', len: .18, vol: .025, slide: 500 }),
  slam: () => { tone([90, 60], { type: 'square', len: .22, gap: .03, vol: .06 }); buzz(30); },
  drum: n => { tone([150 + n * 40, 75 + n * 20], { type: 'square', len: .1, gap: .015, vol: .045 }); buzz(12 + n * 6); },
  heart: () => { tone([62, 52], { type: 'sine', len: .12, gap: .14, vol: .09 }); buzz([14, 120, 10]); },
  clash: () => { tone([880, 220], { type: 'sawtooth', len: .22, gap: .02, vol: .05, slide: -120 }); buzz([40]); },
  win: () => { tone([659, 784, 988, 1319], { type: 'triangle', gap: .08, len: .2, vol: .05 }); buzz([30, 40, 30]); },
  tie: () => tone([523, 523], { type: 'triangle', gap: .12, len: .14, vol: .04 }),
  lose: () => { tone([392, 330, 262, 196], { type: 'triangle', gap: .14, len: .3, vol: .045 }); buzz([90]); },
  cash: () => tone([1568, 2093, 1760, 2349, 2637], { type: 'triangle', gap: .05, len: .1, vol: .035 }),
  jackpot: () => { tone([523, 659, 784, 1047, 1319, 1568, 2093], { type: 'square', gap: .085, len: .26, vol: .03 }); buzz([40, 50, 40, 50, 160]); }
};
const ART = '/assets/rps/';
const ROBOT_STILL = '/assets/pets/robot-3.webp';
const ROBOT_POSES = ['ready', 'rock', 'scissors', 'paper', 'win', 'lose', 'shock', 'think'];
const ARM_ART = true;
const handArt = (hand, px = 256) => `<img src="${ART}hand-${hand}.webp" alt="" width="${px}" height="${px}" decoding="async" draggable="false">`;
const ladder = (wins, bet) => Array.from({ length: RPS_MAX_WINS }, (_, i) => `<span class="rps-step${wins > i ? ' on' : ''}${wins === i ? ' next' : ''}"><b>×${2 ** (i + 1)}</b><small>${num(bet * 2 ** (i + 1))}</small></span>`).join('');
const medal = (hand, cls = '') => `<span class="rps-medal art${hand ? ` h-${hand}` : ' idle'}${cls ? ` ${cls}` : ''}">${handArt(hand || 'rock')}</span>`;
// The hand at the end of an arm: the drawn arm, or (until it is drawn) the hand medal.
const fist = (side, hand, cls = '') => ARM_ART
  ? `<img class="rps-arm-art${hand ? ` h-${hand}` : ' idle'}${cls ? ` ${cls}` : ''}" src="${ART}arm-${side}-${hand || 'rock'}.webp" alt="" decoding="async" draggable="false">`
  : medal(hand, cls);
const mineRow = hands => hands.length ? `<span class="rps-robot-log">${hands.slice(0, 8).map((h, i) => `<i class="h-${h}${i === 0 ? ' new' : ''}">${handArt(h, 64)}</i>`).join('')}</span>` : '<span class="rps-bar-empty">아직 없어요</span>';
const robotRow = hands => (hands || []).length ? `<span class="rps-robot-log" aria-label="로보가 최근에 낸 손"><small>로보 최근</small>${hands.slice(0, 8).map((h, i) => RPS_HANDS[h] ? `<i class="h-${h}${i === 0 ? ' new' : ''}">${handArt(h, 64)}</i>` : '').join('')}</span>` : '';

// What 로보 says. The "tell" is only talk: the server has not picked yet and never asks 로보.
const TALK = {
  start: ['가위바위보는 실력이지! 삐빅!', '내 손을 읽을 수 있을까?', '삐빅… 계산 중…', '오늘은 봐주지 않을 거야!', '준비됐어? 나는 됐어!'],
  streak: w => [`벌써 ${w}연승?! 이번엔 안 봐줘!`, `${w}연승이라고? 삐빅, 경고 모드!`, '이번 판은 진짜 이긴다!'],
  final: ['운명의 한 판… 삐…삐빅…', '이번에 지면 내 회로가 타버려!', '마지막이야. 각오해!'],
  tell: h => [`이번엔 ${RPS_HANDS[h].name} 낼 거야~`, `${RPS_HANDS[h].name}! …라고 하면 믿을래?`, `힌트: ${RPS_HANDS[h].name}. 진짜일까?`],
  lose: ['으악! 다시 해!', '삐…삐빅… 오류 발생!', '운이 좋았을 뿐이야!', '내 손이 왜 그랬지?!'],
  win: ['역시 나야! 삐빅!', '로보 승리! 히히', '한 판 더 할래?', '내 계산이 맞았어!'],
  tie: ['어? 똑같네!', '생각이 통했나 봐!', '다시! 다시!', '따라 하지 마~'],
  jackpot: ['말도 안 돼… ×8이라니!', '삐…삐…빅… 시스템 다운…'],
  cash: ['도망가는 거야? 다음엔 안 놓쳐!', '현명한 선택이네… 쳇!']
};

/* ---------- the card in 놀이터 ---------- */
export function rpsCard(state, bet, balance) {
  const s = state || { bets: RPS_BETS, daily: RPS_DAILY, left: RPS_DAILY, max_wins: RPS_MAX_WINS };
  const left = Number(s.left ?? RPS_DAILY), live = s.live, st = s.stats || {};
  const can = live || (left > 0 && balance >= bet);
  const recent = (s.recent || []).slice(0, 5);
  const hall = s.hall || [];
  const played = Number(st.wins || 0) + Number(st.ties || 0) + Number(st.losses || 0);
  return `<section class="rps-card" id="rps-card">
    <div class="rps-card-head"><div><small>ROBO RPS</small><h2>가위바위보</h2></div><span class="lk-left" aria-label="오늘 남은 판 ${left}번">${Array.from({ length: s.daily || RPS_DAILY }, (_, i) => `<i class="${i < left ? 'on' : ''}"></i>`).join('')}</span></div>
    <div class="rps-card-stage" aria-hidden="true">
      <span class="rps-card-pet robot">${avatar('robot', { form: 3, size: 'mini' })}</span>
      <span class="rps-card-bubble">${esc(pickOne(TALK.start))}</span>
      <span class="rps-card-hands">${RPS_KEYS.map((k, i) => `<i class="h-${k}" style="--i:${i}">${handArt(k, 96)}</i>`).join('')}</span>
    </div>
    ${hall.length ? `<div class="rps-hall"><b>🏆 이번 주 ×8 명예의 전당</b><span>${hall.map(h => `<em class="${h.me ? 'me' : ''}">${esc(h.name)}${h.count > 1 ? ` ×${h.count}` : ''}</em>`).join('')}</span></div>` : ''}
    <div class="rps-card-ladder">${ladder(-1, bet)}</div>
    ${live ? '' : `<div class="lk-bets" role="group" aria-label="걸 코인">${(s.bets || RPS_BETS).map(b => `<button type="button" class="lk-bet ${bet === b ? 'on' : ''}" data-rps="bet" data-bet="${b}" aria-pressed="${bet === b}"><span>${coin()}${b}</span></button>`).join('')}</div>`}
    <button type="button" class="rps-go" data-rps="${live ? 'resume' : 'play'}" ${can ? '' : 'disabled'}>${live ? `<span>하던 판 이어서</span><em>${coin()}${num(live.pot)}</em>` : left > 0 ? (balance >= bet ? `<span>로보에게 도전!</span><em>${coin()}${bet}</em>` : '<span>코인이 부족해요</span>') : '<span>오늘 판을 다 했어요</span>'}</button>
    ${played ? `<div class="rps-stats"><span><b>${num(st.wins)}</b>승</span><span><b>${num(st.ties)}</b>무</span><span><b>${num(st.losses)}</b>패</span><span>최고 <b>${num(s.best || 0)}</b>연승</span><span>최대 <b>+${num(st.biggest || 0)}</b></span>${st.jackpots ? `<span class="jack">×8 <b>${num(st.jackpots)}</b>번</span>` : ''}</div>` : ''}
    ${recent.length ? `<div class="lk-recent"><span>최근</span>${recent.map(r => `<i class="${r.paid ? 'up' : 'down'}">${r.paid ? `+${num(r.paid - r.bet)}` : `−${num(r.bet)}`}</i>`).join('')}</div>` : ''}
    <p class="lk-note">하루 ${s.daily || RPS_DAILY}판 · 이기면 2배, 계속 이기면 ×4 · ×8 · 비기면 한 번 더 · 로보는 무작위로 내요(로보의 말은 믿거나 말거나!)</p>
  </section>`;
}

/* ---------- the match ---------- */
// Resolves with the last balance when the student closes it. `onBalance` follows every change.
export function rpsMatch(A, { bet, live = null, onBalance }) {
  unlockSound();
  return new Promise(resolve => {
    const pet = A.data.stats?.pet || { key: A.data.profile?.avatar_key || 'dog', form: 1 };
    const state = A.data.rewards?.rps || {};
    const g = { bet: live?.bet || bet, pot: live?.pot || bet, wins: live?.wins || 0, phase: live?.await === 'choice' ? 'choice' : 'pick', fresh: !live, busy: false, round: 1,
      balance: Number(A.data.stats?.points_balance || 0), left: Number(state.left ?? RPS_DAILY), robot: state.robot_recent || [], mine: [], heart: null };
    const box = document.createElement('div');
    box.className = 'rps-show';
    box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true'); box.setAttribute('aria-label', '가위바위보');
    box.innerHTML = `<div class="rps-bg" aria-hidden="true"><i></i><i></i><i></i></div><div class="rps-vignette" aria-hidden="true"></div>
      <div class="rps-top">
        <div class="rps-pot"><small>판돈</small><b>${coin()}<span id="rps-pot">${num(g.pot)}</span></b></div>
        <div class="rps-ladder" id="rps-ladder">${ladder(g.wins, g.bet)}</div>
        <button type="button" class="rps-x" data-r="close" aria-label="닫기">✕</button>
      </div>
      <div class="rps-arena comic intro" id="rps-arena">
        <div class="rps-comic" aria-hidden="true"><i class="half robot"></i><i class="half me"></i><i class="rays"></i><i class="bolt"></i></div>
        <div class="rps-side robot"><span class="rps-avatar">${avatar('robot', { form: 3 })}</span><span class="rps-name">로보</span><span class="rps-talk" id="rps-talk" aria-live="polite"></span></div>
        <div class="rps-side me"><span class="rps-avatar">${avatar(pet.key, { form: Math.max(1, pet.form ?? 1) })}</span><span class="rps-name">${esc(A.data.profile?.display_name || '나')}</span></div>
        <div class="rps-vsburst" aria-hidden="true"><b>VS</b></div>
        <span class="rps-stack" id="rps-stack" aria-hidden="true"></span>
        <div class="rps-arm robot${ARM_ART ? ' drawn' : ''}"><i class="rps-sleeve" aria-hidden="true"></i><span class="rps-hand" id="rps-robot">${fist('robot', null)}</span></div>
        <div class="rps-arm me${ARM_ART ? ' drawn' : ''}"><i class="rps-sleeve" aria-hidden="true"></i><span class="rps-hand" id="rps-me">${fist('me', null)}</span></div>
        <div class="rps-ring" id="rps-ring"></div>
        <div class="rps-flash" id="rps-flash"></div>
        <img class="rps-clash-art" id="rps-clash" src="${ART}clash.webp" alt="" width="256" height="256" decoding="async" draggable="false">
        <div class="rps-burst" id="rps-burst"></div>
        <div class="rps-stamp" id="rps-stamp"></div>
        <div class="rps-bars"><div class="rps-bar robot"><b>로보</b><span id="rps-log">${robotRow(g.robot)}</span></div><div class="rps-bar me"><b>나</b><span id="rps-mine">${mineRow(g.mine)}</span></div></div>
      </div>
      <div class="rps-banner" id="rps-banner" aria-live="assertive"></div>
      <div class="rps-controls" id="rps-controls"></div>`;
    document.body.appendChild(box);
    const $ = sel => box.querySelector(sel);
    requestAnimationFrame(() => box.classList.add('open'));
    // 로보's poses are loaded and decoded now, and a swap waits for its picture, so 로보 never
    // blinks out between poses.
    const posePics = new Map([ROBOT_STILL, ...ROBOT_POSES.map(p => `${ART}robot-${p}.webp`)].map(src => {
      const pic = new Image(); pic.src = src;
      return [src, pic.decode().catch(() => {})];
    }));
    let wantPose = ROBOT_STILL;
    const robotPose = pose => {
      const src = pose ? `${ART}robot-${pose}.webp` : ROBOT_STILL;
      wantPose = src;
      (posePics.get(src) || Promise.resolve()).then(() => {
        const img = $('.rps-side.robot .avatar-art img');
        if (img && wantPose === src) { img.decoding = 'sync'; img.setAttribute('src', src); }
      });
    };

    const setBalance = value => { if (typeof value === 'number') { g.balance = value; onBalance?.(value); } };
    const banner = (text, cls = '') => { const b = $('#rps-banner'); b.className = `rps-banner ${cls}`; b.textContent = text; void b.offsetWidth; b.classList.add('pop'); };
    let talkTimer = null;
    const talk = (text, hold = 2600) => {
      const t = $('#rps-talk'); if (!t) return;
      clearTimeout(talkTimer);
      t.textContent = text; t.classList.remove('on'); void t.offsetWidth; t.classList.add('on');
      if (hold) talkTimer = setTimeout(() => t.classList.remove('on'), hold);
    };
    const stack = () => {
      const n = Math.min(14, Math.max(1, Math.round(g.pot / Math.max(1, g.bet) * 2)));
      $('#rps-stack').innerHTML = Array.from({ length: n }, (_, i) => `<i style="--i:${i}"></i>`).join('');
    };
    const potTo = value => {
      const el = $('#rps-pot'), from = g.pot;
      g.pot = value; stack();
      if (reduced()) { el.textContent = num(value); return; }
      const start = performance.now(), dur = 650;
      const step = t => { const k = Math.min(1, (t - start) / dur); el.textContent = num(Math.round(from + (value - from) * (1 - Math.pow(1 - k, 3)))); if (k < 1 && box.isConnected) requestAnimationFrame(step); };
      requestAnimationFrame(step);
    };
    // From the second round on, the stakes show: red edges and a heartbeat while choosing.
    const tension = () => {
      const tense = g.phase === 'pick' && g.wins > 0, final = tense && g.wins >= RPS_MAX_WINS - 1;
      box.classList.toggle('tense', tense); box.classList.toggle('final', final);
      clearInterval(g.heart); g.heart = null;
      if (tense && !reduced()) { SFX.heart(); g.heart = setInterval(() => { if (!box.isConnected) return clearInterval(g.heart); SFX.heart(); }, final ? 700 : 950); }
    };
    const controls = () => {
      const c = $('#rps-controls');
      tension();
      if (g.phase === 'pick') {
        const hot = g.wins > 0;
        c.innerHTML = `<p class="rps-hint">${hot ? `${g.wins}연승 중! 이번 판에 <b>${num(g.pot * 2)}코인</b>이 걸렸어요` : '무엇을 낼까요?'}</p><div class="rps-picks">${RPS_KEYS.map(k => `<button type="button" class="rps-pick h-${k}${hot ? ' hot' : ''}" data-r="pick" data-hand="${k}"><span>${handArt(k, 128)}</span><b>${RPS_HANDS[k].name}</b></button>`).join('')}</div>`;
      } else if (g.phase === 'choice') {
        const next = g.pot * 2;
        c.innerHTML = `<p class="rps-hint">${g.wins}연승! 여기서 받을까요, <b>${num(next)}코인</b>에 도전할까요?</p><div class="rps-choice"><button type="button" class="rps-cash" data-r="cash">받기<em>${coin()}${num(g.pot)}</em></button><button type="button" class="rps-double" data-r="double">${g.wins >= RPS_MAX_WINS - 1 ? '운명의 한 판!' : '더블 도전!'}<em>×${2 ** (g.wins + 1)} · ${coin()}${num(next)}</em></button></div>`;
      } else {
        const again = g.left > 0 && g.balance >= g.bet;
        c.innerHTML = `<div class="rps-choice">${again ? `<button type="button" class="rps-double" data-r="again">한 판 더<em>${coin()}${num(g.bet)} · 오늘 ${g.left}판 남음</em></button>` : ''}<button type="button" class="rps-cash" data-r="close">닫기</button></div>`;
      }
      c.querySelector('button')?.focus({ preventScroll: true });
    };
    const close = () => { clearInterval(g.heart); clearTimeout(talkTimer); box.classList.add('bye'); setTimeout(() => box.remove(), 200); resolve(g.balance); };
    const burst = (kind, n) => {
      const el = $('#rps-burst');
      el.innerHTML = Array.from({ length: n }, (_, i) => { const a = i / n * Math.PI * 2, r = 80 + (i * 41) % 120; return `<i class="rps-p ${kind}" style="--dx:${Math.round(Math.cos(a) * r)}px;--dy:${Math.round(Math.sin(a) * r - 40)}px;--d:${(.6 + (i % 5) * .09).toFixed(2)}s"></i>`; }).join('');
    };
    const stamp = (text, cls) => { const s = $('#rps-stamp'); s.className = `rps-stamp ${cls}`; s.textContent = text; void s.offsetWidth; s.classList.add('on'); };
    const confetti = () => {
      const colors = ['#ffd35a', '#ff6b8a', '#5ac8fa', '#6ee7a8', '#a78bfa', '#ff9f43'];
      box.insertAdjacentHTML('beforeend', `<div class="lk-confetti" aria-hidden="true">${Array.from({ length: 60 }, (_, i) => `<i class="lk-conf" style="left:${(i * 53) % 100}%;--c:${colors[i % colors.length]};--d:${(1.6 + (i % 7) * .22).toFixed(2)}s;--delay:${((i % 9) * .07).toFixed(2)}s;--r:${(i * 47) % 360}deg"></i>`).join('')}</div>`);
    };
    const preRoundTalk = () => {
      if (g.wins >= RPS_MAX_WINS - 1) return talk(pickOne(TALK.final), 0);
      if (Math.random() < .35) { robotPose('think'); return talk(pickOne(TALK.tell(pickOne(RPS_KEYS))), 0); }
      talk(g.wins ? pickOne(TALK.streak(g.wins)) : pickOne(TALK.start), 0);
    };
    const resetHands = () => {
      $('#rps-arena').classList.remove('win', 'lose', 'tie', 'clash', 'fly');
      $('#rps-robot').innerHTML = fist('robot', null); $('#rps-me').innerHTML = fist('me', null);
      $('#rps-stamp').className = 'rps-stamp';
      $('#rps-clash').classList.remove('go');
      robotPose(null);
    };

    async function throwHand(hand) {
      if (g.busy) return;
      g.busy = true;
      clearInterval(g.heart); g.heart = null;
      $('#rps-controls').innerHTML = '';
      const arena = $('#rps-arena');
      resetHands();
      robotPose('ready');
      const body = g.phase === 'choice' ? { pick: hand, double: true } : g.fresh ? { bet: g.bet, pick: hand } : { pick: hand };
      const request = api('/rps/play', body);
      // 가위! 바위! 보! — the hands pump in time, faster each beat (slower and heavier on the
      // last round).
      if (!reduced()) {
        const words = ['가위!', '바위!', '보!'], final = g.wins >= RPS_MAX_WINS - 1;
        const beats = final ? [560, 470, 400] : [430, 360, 300];
        for (let i = 0; i < 3; i++) {
          banner(words[i], `call${i === 2 ? ' last' : ''}`);
          arena.classList.remove('shake'); void arena.offsetWidth; arena.classList.add('shake');
          SFX.drum(i);
          await wait(beats[i]);
        }
      }
      let res;
      try { res = await request; }
      catch (err) { toast(err.message); g.busy = false; banner(''); robotPose(null); controls(); return; }
      g.fresh = false;
      // Hands fly to the middle and clash.
      $('#rps-robot').innerHTML = fist('robot', res.robot, 'shown'); $('#rps-me').innerHTML = fist('me', res.pick, 'shown');
      g.mine = [res.pick, ...g.mine].slice(0, 8);
      robotPose(res.robot);
      arena.classList.remove('shake'); arena.classList.add('fly');
      if (!reduced()) { SFX.whoosh(); await wait(170); }
      arena.classList.add('clash');
      SFX.clash();
      $('#rps-ring').classList.remove('go'); void $('#rps-ring').offsetWidth; $('#rps-ring').classList.add('go');
      $('#rps-flash').classList.remove('go'); void $('#rps-flash').offsetWidth; $('#rps-flash').classList.add('go');
      $('#rps-clash').classList.remove('go'); void $('#rps-clash').offsetWidth; $('#rps-clash').classList.add('go');
      g.left = Number(res.rps?.left ?? g.left);
      g.robot = res.rps?.robot_recent || g.robot;
      if (A.data.rewards) A.data.rewards.rps = res.rps;
      if (!reduced()) await wait(140); // hit-stop
      $('#rps-log').innerHTML = robotRow(g.robot); $('#rps-mine').innerHTML = mineRow(g.mine);
      await wait(reduced() ? 0 : 300);
      if (res.result === 'draw') {
        arena.classList.add('tie'); robotPose('think'); stamp('DRAW', 'tie'); banner('비겼다! 한 번 더!', 'tie'); SFX.tie(); talk(pickOne(TALK.tie));
        g.phase = 'pick';
        await wait(reduced() ? 0 : 750);
        resetHands();
        preRoundTalk();
      } else if (res.result === 'lose') {
        arena.classList.add('lose'); robotPose('win'); stamp('LOSE', 'lose'); banner(g.wins ? `${g.wins}연승에서 멈췄어요…` : '로보 승리…', 'lose'); SFX.lose(); talk(pickOne(TALK.win));
        burst('puff', 14);
        potTo(0);
        g.wins = 0; g.phase = 'end';
        setBalance(res.points_balance);
      } else {
        arena.classList.add('win'); g.wins = res.wins;
        robotPose(res.done ? 'shock' : 'lose');
        stamp(res.done ? '×8!' : 'WIN!', res.done ? 'jackpot' : 'win');
        $('#rps-ladder').innerHTML = ladder(g.wins, g.bet);
        potTo(res.pot);
        burst('coin', 10 + g.wins * 8);
        if (res.done) {
          banner(`${RPS_MAX_WINS}연승! ×${2 ** RPS_MAX_WINS} 대박!`, 'jackpot'); SFX.jackpot(); confetti(); talk(pickOne(TALK.jackpot), 0);
          if (ARM_ART) setTimeout(() => { if (box.isConnected) $('#rps-robot').innerHTML = fist('robot', 'flag', 'shown'); }, 900);
          box.classList.add('gold');
          g.phase = 'end';
          setBalance(res.points_balance);
          toast(`${num(res.paid)}코인을 받았어요!`);
        } else {
          banner(g.wins === 1 ? '승리!' : `${g.wins}연승!`, 'win'); SFX.win(); talk(pickOne(TALK.lose));
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
        banner(`+${num(res.paid)}코인 획득!`, 'win'); SFX.cash(); talk(pickOne(TALK.cash)); robotPose('think');
        if (ARM_ART) $('#rps-me').innerHTML = fist('me', 'thumb', 'shown');
        burst('coin', 26);
        g.phase = 'end';
      } catch (err) { toast(err.message); }
      g.busy = false;
      controls();
    }
    box.addEventListener('click', e => {
      if (box.querySelector('.rps-arena.intro')) return skipIntro();
      const b = e.target.closest('[data-r]');
      if (!b || g.busy) return;
      const r = b.dataset.r;
      if (r === 'pick') return throwHand(b.dataset.hand);
      if (r === 'cash') return cash();
      if (r === 'double') {
        const final = g.wins >= RPS_MAX_WINS - 1;
        banner(final ? '운명의 한 판!' : `×${2 ** (g.wins + 1)} 도전!`, final ? 'final' : 'call');
        resetHands();
        preRoundTalk();
        // Pick the hand for the doubled pot (the server is told `double` with it).
        const wins = g.wins; g.phase = 'pick'; controls(); g.phase = 'choice'; g.wins = wins;
        box.classList.add('tense'); box.classList.toggle('final', final);
        return;
      }
      if (r === 'again') {
        Object.assign(g, { pot: g.bet, wins: 0, phase: 'pick', fresh: true, round: g.round + 1 });
        box.classList.remove('gold');
        $('#rps-pot').textContent = num(g.bet); $('#rps-ladder').innerHTML = ladder(0, g.bet); stack();
        resetHands(); banner(`ROUND ${g.round}`, 'call'); preRoundTalk();
        return controls();
      }
      if (r === 'close') {
        // A won pot is kept on the server (taken on the next play, or after 10 minutes).
        if (g.phase === 'choice') toast(`${num(g.pot)}코인은 다음에 이어서 받을 수 있어요.`);
        return close();
      }
    });
    box.addEventListener('keydown', e => { if (e.key === 'Escape' && !g.busy) close(); });
    // Entrance: the fighters slide in and VS slams down (a tap skips it).
    let introDone = false;
    function skipIntro() {
      if (introDone) return;
      introDone = true;
      $('#rps-arena').classList.remove('intro');
      banner(live ? (live.await === 'choice' ? `${g.wins}연승 중!` : '하던 판을 이어서 해요') : 'ROUND 1', 'call');
      preRoundTalk();
      controls();
    }
    stack();
    if (reduced()) skipIntro();
    else { SFX.whoosh(); setTimeout(() => { if (!introDone) SFX.slam(); }, 520); setTimeout(skipIntro, 1050); }
  });
}
