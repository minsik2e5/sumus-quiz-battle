// V13.205 야바위(놀이터, 타짜풍). 딜러 '곽 사장'(직접 그린 캐릭터)이 빨간 컵 밑에 공을 보여 주고 섞는다.
// 판(공 자리 · 맞바꾸는 순서 · 밑장빼기)과 판정은 서버(server/yabawi.mjs)가 한다. 이 파일은 놀이터 카드와 한 판의 연출만 그린다.
// - 등장: 조명 아래 곽 사장이 들어와 손가락을 든다("어이 젊은 친구, 신사답게 행동해.")
// - 공 보여 주기 → 섞기(판마다 컵 3 · 4 · 6개, 점점 빠르게) → 밑장빼기(가끔, 눈썰미가 좋으면 보인다) → '동작 그만!'
// - 고르기("확실하지 않으면 승부를 걸지 마라.") → 공개 → 받기 또는 '묻고 더블로 가!'(게임 단어 한 문제를 맞혀야 간다)
// V13.207: 운영에도 켰다(YABAWI_LIVE). 끄면 테스트 앱(sumus-voca-test.*) · 로컬에서만 놀이터에 나온다.
import { api, esc, num, toast } from './ui.js';
import { coin } from './emblems.js';
import { sfxTone as tone, sfxBuzz as buzz, unlockSound } from './lucky.js';
import { TEST_HOST } from './claw-physics.js';
import { arcadeWords } from './arcade-games.js';
import { YABAWI, ballAt, caughtCheat, isFake, slotXY, stepPairs } from './yabawi-rules.js';
import { YABAWI_ART } from './yabawi-art.js';

export const YABAWI_LIVE = true;
export function yabawiOn(loc = globalThis.location) {
  if (YABAWI_LIVE) return true;
  const host = String(loc?.hostname || '');
  return TEST_HOST.test(host) || /^(localhost|127\.0\.0\.1)$/.test(host);
}

const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const pickOne = list => list[Math.floor(Math.random() * list.length)];
const SFX = {
  swish: i => tone([520 + (i % 3) * 70], { type: 'sawtooth', len: .07, vol: .014, slide: -260 }),
  lift: () => tone([392, 523], { type: 'triangle', len: .1, gap: .05, vol: .035 }),
  thud: () => { tone([110, 82], { type: 'square', len: .09, gap: .02, vol: .045 }); buzz(14); },
  sneak: () => tone([1480, 1760], { type: 'sine', len: .05, gap: .03, vol: .02 }),
  alarm: () => { tone([988, 740, 988, 740], { type: 'square', len: .09, gap: .02, vol: .04 }); buzz([40, 30, 40]); },
  win: () => { tone([659, 784, 988, 1319], { type: 'triangle', gap: .08, len: .2, vol: .05 }); buzz([30, 40, 30]); },
  lose: () => { tone([392, 330, 262, 196], { type: 'triangle', gap: .14, len: .3, vol: .045 }); buzz([90]); },
  cash: () => tone([1568, 2093, 1760, 2349, 2637], { type: 'triangle', gap: .05, len: .1, vol: .035 }),
  jackpot: () => { tone([523, 659, 784, 1047, 1319, 1568, 2093], { type: 'square', gap: .085, len: .26, vol: .03 }); buzz([40, 50, 40, 50, 160]); },
  heart: () => { tone([62, 52], { type: 'sine', len: .12, gap: .14, vol: .09 }); buzz([14, 120, 10]); }
};

// 곽 사장의 말. 영화 대사를 짧게 비튼 것과 우리 말투.
const TALK = {
  intro: ['어이 젊은 친구, 신사답게 행동해.'],
  show: ['잘 봐라잉. 공은 여기 있다.', '눈 크게 떠라. 손은 눈보다 빠르니께.', '공은 하나, 컵은 여럿. 간다잉.'],
  pick: ['확실하지 않으면 승부를 걸지 마라.'],
  streak: ['아야, 슬슬 오함마 준비해야 쓰겄다.', '허허… 이 친구 보통이 아니네.'],
  final: ['마지막 판이다. 신사답게 가자.', '여기서 따면… 니가 타짜다.'],
  win: ['허허… 눈 좋네?', '그 눈이면 이 바닥에서 밥은 먹겠다.', '운이 좋았을 뿐이여.'],
  lose: ['눈보다 손이 빠르다니께.', '인생은 한 방이여. 근데 오늘은 아니여.', '또 와라, 젊은 친구.'],
  caught: ['…허허, 들켰네. 이번 판은 니가 먹어라.', '눈치 하나는 빠르구만.'],
  falseFirst: ['첫 판부터 장난질이냐?'],
  falseCall: ['생사람 잡지 마라잉.', '밑장은 무슨, 손 깨끗하다잉.'],
  cash: ['현명하네. 확실하지 않으면 승부를 걸지 말랬제?', '챙겨 갈 줄도 아네. 마음에 든다.'],
  quizWrong: ['공부부터 하고 와라. 판돈은 챙겨 가고.'],
  quizRight: ['좋아. 묻고 더블로 가!'],
  jackpot: ['내가… 졌다. 오늘은 니가 타짜다.']
};

/* ---------- 그림: 에셋이 있으면 그림, 없으면 직접 그린 SVG · CSS ---------- */
// 에셋 요청서(public/assets/yabawi): 곽 사장 8포즈 · 컵 · 공 · 테이블 · 배경 · 전등 · 연기 · 칩 · 지폐 · 카드 그림.
const ART = name => YABAWI_ART.has(name) ? `/assets/yabawi/${name}.webp` : '';
export const POSES = ['idle', 'point', 'shuffle', 'sneak', 'grin', 'shock', 'hammer', 'sweep'];
const dealerArt = () => POSES.every(p => YABAWI_ART.has(`dealer-${p}`));
// SVG 곽 사장에 없는 포즈는 가까운 것으로.
const SVG_POSE = { shuffle: 'deal', sneak: 'deal', hammer: 'point', sweep: 'grin' };
// 배경 · 테이블 같은 큰 그림은 CSS 변수로 넘기고 has-<이름> 클래스로 켠다.
const SCENE = ['bg-room', 'lamp', 'smoke', 'table', 'ball', 'cup-shadow', 'chip-red', 'chip-gold', 'chip-black', 'bill', 'spark', 'chips-stack', 'hwatu-fan', 'money-bundle', 'hammer', 'card-hero'];
const sceneArt = () => {
  const on = SCENE.filter(n => YABAWI_ART.has(n));
  return { cls: on.map(n => ` has-${n}`).join(''), style: on.map(n => `--yw-${n}:url(${ART(n)})`).join(';') };
};
export function dealerHtml(pose = 'idle', cls = '') {
  if (!dealerArt()) return dealerSvg(SVG_POSE[pose] || pose, cls).replace('class="yw-dealer', `data-pose="${pose}" class="yw-dealer`);
  return `<span class="yw-dealer art p-${pose}${cls ? ` ${cls}` : ''}" data-pose="${pose}" aria-hidden="true"><img src="${ART(`dealer-${pose}`)}" alt="" draggable="false"></span>`;
}
const cupHtml = () => ART('cup') ? `<img src="${ART('cup')}" alt="" draggable="false">` : cupSvg();

/* ---------- 직접 그린 그림: 곽 사장 · 컵 · 공 ---------- */
// 직접 그린 타짜풍 딜러(배우 얼굴이 아니다): 올백 머리, 파란 셔츠, 금목걸이. 표정 · 팔은 .p-<pose> 클래스로 바꾼다.
export function dealerSvg(pose = 'idle', cls = '') {
  return `<span class="yw-dealer p-${pose}${cls ? ` ${cls}` : ''}" aria-hidden="true"><svg viewBox="0 0 220 260" role="presentation">
    <defs>
      <linearGradient id="yw-shirt" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3566b8"/><stop offset="1" stop-color="#1d3f7a"/></linearGradient>
      <linearGradient id="yw-skin" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f0c39b"/><stop offset="1" stop-color="#d99d72"/></linearGradient>
      <linearGradient id="yw-hair" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2b2b2e"/><stop offset="1" stop-color="#0b0b0c"/></linearGradient>
    </defs>
    <g class="body">
      <path d="M22 260 C26 205 52 184 110 180 C168 184 194 205 198 260 Z" fill="url(#yw-shirt)"/>
      <path d="M86 182 L110 226 L134 182 Z" fill="url(#yw-skin)"/>
      <path d="M78 180 L110 228 L94 236 L64 192 Z M142 180 L110 228 L126 236 L156 192 Z" fill="#2c5aa6" stroke="#173468" stroke-width="2"/>
      <path class="chain" d="M90 188 Q110 232 130 188" fill="none" stroke="#e8b830" stroke-width="4" stroke-dasharray="5 3" stroke-linecap="round"/>
      <circle cx="110" cy="214" r="5" fill="#ffd34d" stroke="#b9861a" stroke-width="1.5"/>
      <path d="M52 214 Q58 240 56 260 M168 214 Q162 240 164 260" stroke="#173468" stroke-width="3" fill="none" opacity=".5"/>
    </g>
    <g class="arm-down"><path d="M30 236 Q24 250 26 260 L52 260 Q50 246 56 232 Z" fill="#1d3f7a"/></g>
    <g class="arm-up">
      <path d="M170 210 Q196 180 192 132 L176 130 Q174 170 152 196 Z" fill="url(#yw-shirt)" stroke="#173468" stroke-width="2"/>
      <g class="hand"><rect x="174" y="108" width="22" height="26" rx="9" fill="url(#yw-skin)"/><rect class="finger" x="183" y="74" width="9" height="40" rx="4.5" fill="url(#yw-skin)"/><path d="M175 118 q-6 4 -3 12" stroke="#c48a60" stroke-width="2" fill="none"/></g>
    </g>
    <g class="head">
      <rect x="96" y="150" width="28" height="36" rx="10" fill="#d99d72"/>
      <ellipse cx="62" cy="108" rx="9" ry="14" fill="#e3ad84"/><ellipse cx="158" cy="108" rx="9" ry="14" fill="#e3ad84"/>
      <path d="M62 92 C60 140 80 170 110 172 C140 170 160 140 158 92 C156 62 136 44 110 44 C84 44 64 62 62 92 Z" fill="url(#yw-skin)"/>
      <path class="hair" d="M58 98 C52 56 78 30 112 30 C146 30 170 52 162 98 C158 80 150 70 140 66 C124 58 96 58 80 66 C70 72 62 82 58 98 Z" fill="url(#yw-hair)"/>
      <path d="M80 50 C96 40 128 38 146 50" stroke="#5b5b62" stroke-width="3" fill="none" stroke-linecap="round" opacity=".8"/>
      <path d="M86 42 C100 36 120 35 134 40" stroke="#8d8d96" stroke-width="2" fill="none" stroke-linecap="round" opacity=".7"/>
      <path d="M60 96 C61 86 64 80 68 76 M160 96 C159 86 156 80 152 76" stroke="#9a9aa3" stroke-width="3" fill="none"/>
      <path class="brow l" d="M76 92 L100 88" stroke="#1a1a1a" stroke-width="6" stroke-linecap="round"/>
      <path class="brow r" d="M120 88 L144 92" stroke="#1a1a1a" stroke-width="6" stroke-linecap="round"/>
      <g class="eyes-sly"><path d="M80 104 Q89 99 98 104" stroke="#1a1a1a" stroke-width="4" fill="none" stroke-linecap="round"/><path d="M122 104 Q131 99 140 104" stroke="#1a1a1a" stroke-width="4" fill="none" stroke-linecap="round"/></g>
      <g class="eyes-wide"><circle cx="89" cy="104" r="7" fill="#fff"/><circle cx="131" cy="104" r="7" fill="#fff"/><circle cx="89" cy="105" r="3.2" fill="#1a1a1a"/><circle cx="131" cy="105" r="3.2" fill="#1a1a1a"/></g>
      <path d="M108 108 L104 128 Q110 132 116 128" stroke="#b97e55" stroke-width="3" fill="none" stroke-linecap="round"/>
      <path d="M90 126 Q86 140 92 150 M130 126 Q134 140 128 150" stroke="#c48a60" stroke-width="2" fill="none" opacity=".7"/>
      <path class="mouth smirk" d="M94 146 Q110 152 128 140" stroke="#6b3420" stroke-width="4" fill="none" stroke-linecap="round"/>
      <path class="mouth grin" d="M92 142 Q110 158 130 142 Q110 150 92 142 Z" fill="#fff" stroke="#6b3420" stroke-width="3" stroke-linejoin="round"/>
      <ellipse class="mouth oh" cx="110" cy="147" rx="7" ry="9" fill="#5a2516"/>
      <path class="sweat" d="M152 78 q6 10 0 16 q-6 -6 0 -16 Z" fill="#8fd3ff"/>
    </g>
  </svg></span>`;
}
// 뒤집힌 빨간 파티 컵(밑이 위, 흰 테두리가 아래).
const cupSvg = () => `<svg viewBox="0 0 100 112" aria-hidden="true"><defs><linearGradient id="yw-cup" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#a8101a"/><stop offset=".35" stop-color="#ef2a2f"/><stop offset=".6" stop-color="#d81c23"/><stop offset="1" stop-color="#8e0b14"/></linearGradient></defs>
  <path d="M20 6 Q50 0 80 6 L94 96 L6 96 Z" fill="url(#yw-cup)"/>
  <path d="M15 40 L85 40 M12 62 L88 62" stroke="#8e0b14" stroke-width="2" opacity=".55"/>
  <path d="M30 10 L24 92" stroke="#ff8a8a" stroke-width="5" stroke-linecap="round" opacity=".45"/>
  <path d="M4 94 Q50 102 96 94 L97 104 Q50 113 3 104 Z" fill="#f4f1ea"/><path d="M4 94 Q50 102 96 94" stroke="#cfcac0" stroke-width="1.5" fill="none"/></svg>`;
// 테이블 소품: 왼쪽 위 화투 세 장, 오른쪽 위 칩 더미(그림이 오면 그림).
const hwatuSvg = () => `<svg viewBox="0 0 120 90" aria-hidden="true">${[-18, 0, 18].map((r, i) => `<g transform="rotate(${r} 60 88)"><rect x="44" y="${12 - i}" width="32" height="50" rx="4" fill="#b3121b" stroke="#3a0408" stroke-width="2"/><rect x="48" y="${16 - i}" width="24" height="42" rx="2" fill="none" stroke="#f3c64a" stroke-width="1.5" opacity=".8"/><circle cx="60" cy="${37 - i}" r="6" fill="#f3c64a" opacity=".85"/></g>`).join('')}</svg>`;
const chipsSvg = () => `<svg viewBox="0 0 90 90" aria-hidden="true">${[['#c81d25', 62], ['#151515', 52], ['#d9a520', 42], ['#c81d25', 32]].map(([c, y], i) => `<g><ellipse cx="${36 + (i % 2) * 4}" cy="${y + 8}" rx="24" ry="9" fill="#000" opacity=".25"/><ellipse cx="${36 + (i % 2) * 4}" cy="${y + 4}" rx="24" ry="9" fill="${c}"/><ellipse cx="${36 + (i % 2) * 4}" cy="${y}" rx="24" ry="9" fill="${c}" stroke="#fff" stroke-width="2.5" stroke-dasharray="6 5"/></g>`).join('')}<ellipse cx="70" cy="76" rx="14" ry="6" fill="#d9a520" stroke="#fff" stroke-width="2" stroke-dasharray="5 4"/></svg>`;
const PROPS = `<i class="yw-prop hwatu">${ART('hwatu-fan') ? `<img src="${ART('hwatu-fan')}" alt="">` : hwatuSvg()}</i><i class="yw-prop chips">${ART('chips-stack') ? `<img src="${ART('chips-stack')}" alt="">` : chipsSvg()}</i>`;
const ladder = (wins, bet) => Array.from({ length: YABAWI.MAX_WINS }, (_, i) => `<span class="yw-step${wins > i ? ' on' : ''}${wins === i ? ' next' : ''}"><b>×${2 ** (i + 1)}</b><small>${num(bet * 2 ** (i + 1))}</small></span>`).join('');

/* ---------- 놀이터 카드 ---------- */
export function yabawiCard(state, bet, balance) {
  const s = state || { bets: YABAWI.BETS, daily: YABAWI.DAILY, left: YABAWI.DAILY };
  const left = Number(s.left ?? YABAWI.DAILY), live = s.live, st = s.stats || {};
  const can = live || (left > 0 && balance >= bet);
  const played = Number(st.wins || 0) + Number(st.losses || 0);
  const recent = (s.recent || []).slice(0, 5);
  const sc = sceneArt();
  return `<section class="yw-card${sc.cls}" id="yw-card" style="${sc.style}">
    <div class="yw-card-head"><div><small>TAJJA SHELL GAME</small><h2>야바위</h2></div><span class="lk-left" aria-label="오늘 남은 판 ${left}번">${Array.from({ length: s.daily || YABAWI.DAILY }, (_, i) => `<i class="${i < left ? 'on' : ''}"></i>`).join('')}</span></div>
    <div class="yw-card-stage" aria-hidden="true">
      <i class="yw-spot"></i>
      ${dealerHtml('point', 'mini')}
      <span class="yw-card-bubble">확실하지 않으면 승부를 걸지 마라.</span>
      <span class="yw-card-cups">${[0, 1, 2].map(i => `<i class="yw-mini-cup" style="--i:${i}">${cupHtml()}</i>`).join('')}<i class="yw-mini-ball"></i></span>
    </div>
    <div class="yw-card-ladder">${ladder(-1, bet)}</div>
    ${live ? '' : `<div class="lk-bets" role="group" aria-label="걸 코인">${(s.bets || YABAWI.BETS).map(b => `<button type="button" class="lk-bet ${bet === b ? 'on' : ''}" data-yw="bet" data-bet="${b}" aria-pressed="${bet === b}"><span>${coin()}${b}</span></button>`).join('')}</div>`}
    <button type="button" class="yw-go" data-yw="${live ? 'resume' : 'play'}" ${can ? '' : 'disabled'}>${live ? `<span>하던 판 이어서</span><em>${coin()}${num(live.pot)}</em>` : left > 0 ? (balance >= bet ? `<span>곽 사장에게 도전!</span><em>${coin()}${bet}</em>` : '<span>코인이 부족해요</span>') : '<span>오늘 판을 다 했어요</span>'}</button>
    ${played ? `<div class="rps-stats"><span><b>${num(st.wins)}</b>번 맞힘</span><span><b>${num(st.losses)}</b>번 놓침</span><span>최고 <b>${num(s.best || 0)}</b>연승</span>${st.caught ? `<span>밑장빼기 적발 <b>${num(st.caught)}</b>번</span>` : ''}${st.jackpots ? `<span class="jack">×8 <b>${num(st.jackpots)}</b>번</span>` : ''}</div>` : ''}
    ${recent.length ? `<div class="lk-recent"><span>최근</span>${recent.map(r => `<i class="${r.paid ? 'up' : 'down'}">${r.paid ? `+${num(r.paid - r.bet)}` : `−${num(r.bet)}`}</i>`).join('')}</div>` : ''}
    <p class="lk-note">하루 ${s.daily || YABAWI.DAILY}판 · 공이 든 컵을 맞히면 2배, 묻고 더블로 가면 ×4 · ×8 · 판이 갈수록 컵이 늘고 빨라져요 · 곽 사장은 가끔 밑장을 빼요. 보이면 '동작 그만!'</p>
  </section>`;
}

/* ---------- 한 판 ---------- */
// 닫으면 마지막 잔액으로 끝난다. onBalance는 잔액이 바뀔 때마다.
export function yabawiGame(A, { bet, live = null, onBalance }) {
  unlockSound();
  return new Promise(resolve => {
    const state = A.data.rewards?.yabawi || {};
    const g = { bet: live?.bet || bet, pot: live?.pot || bet, wins: live?.wins || 0, phase: live?.await === 'choice' ? 'choice' : live ? 'resume' : 'ready',
      balance: Number(A.data.stats?.points_balance || 0), left: Number(state.left ?? YABAWI.DAILY), busy: false, round: null, cups: [], done: 0, stopUsed: false, aborted: false, picked: null, heart: null };
    const box = document.createElement('div');
    const sc = sceneArt();
    box.className = `yw-show${sc.cls}`;
    if (sc.style) box.setAttribute('style', sc.style);
    // 그림은 야바위를 열 때만 받는다(첫 화면 로딩에는 안 들어감).
    [...YABAWI_ART].forEach(n => { const img = new Image(); img.src = ART(n); });
    box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true'); box.setAttribute('aria-label', '야바위');
    box.innerHTML = `<div class="yw-bg" aria-hidden="true"><i class="yw-room"></i><i class="yw-lamp"></i><i class="yw-smoke s1"></i><i class="yw-smoke s2"></i></div><div class="yw-vignette" aria-hidden="true"></div>
      <div class="yw-top">
        <div class="yw-pot"><small>판돈</small><b>${coin()}<span id="yw-pot">${num(g.pot)}</span></b></div>
        <div class="yw-ladder" id="yw-ladder">${ladder(g.wins, g.bet)}</div>
        <button type="button" class="yw-x" data-y="close" aria-label="닫기">✕</button>
      </div>
      <div class="yw-stage intro" id="yw-stage">
        <div class="yw-host">${dealerHtml('point')}<span class="yw-name">곽 사장</span><span class="yw-talk" id="yw-talk" aria-live="polite"></span></div>
        <div class="yw-title" aria-hidden="true"><b>야바위</b><span>게임</span></div>
        <div class="yw-table" id="yw-table"><i class="yw-felt" aria-hidden="true"></i><i class="yw-cone" aria-hidden="true"></i>${PROPS}<div class="yw-cups" id="yw-cups"></div><div class="yw-sweep" id="yw-sweep" aria-hidden="true"></div></div>
        <button type="button" class="yw-stop" id="yw-stop" data-y="stop" hidden>동작 그만!<small>밑장 빼기냐?</small></button>
        <div class="yw-burst" id="yw-burst"></div>
        <div class="yw-stamp" id="yw-stamp"></div>
      </div>
      <div class="yw-banner" id="yw-banner" aria-live="assertive"></div>
      <div class="yw-controls" id="yw-controls"></div>`;
    document.body.appendChild(box);
    const $ = sel => box.querySelector(sel);
    requestAnimationFrame(() => box.classList.add('open'));

    const setBalance = value => { if (typeof value === 'number') { g.balance = value; onBalance?.(value); } };
    const pose = name => {
      const d = $('.yw-host .yw-dealer'); if (!d || d.dataset.pose === name) return;
      d.dataset.pose = name;
      if (d.classList.contains('art')) { d.className = `yw-dealer art p-${name}`; d.querySelector('img').src = ART(`dealer-${name}`); }
      else d.className = `yw-dealer p-${SVG_POSE[name] || name}`;
    };
    let talkTimer = null;
    const talk = (text, hold = 2800) => {
      const t = $('#yw-talk'); if (!t) return;
      clearTimeout(talkTimer);
      t.textContent = text; t.classList.remove('on'); void t.offsetWidth; t.classList.add('on');
      if (hold) talkTimer = setTimeout(() => t.classList.remove('on'), hold);
    };
    const banner = (text, cls = '') => { const b = $('#yw-banner'); b.className = `yw-banner ${cls}`; b.textContent = text; void b.offsetWidth; if (text) b.classList.add('pop'); };
    const stamp = (text, cls) => { const s = $('#yw-stamp'); s.className = `yw-stamp ${cls}`; s.textContent = text; void s.offsetWidth; s.classList.add('on'); };
    const burst = (kind, n) => {
      if (reduced()) return;
      $('#yw-burst').innerHTML = Array.from({ length: n }, (_, i) => { const a = i / n * Math.PI * 2, r = 70 + (i * 41) % 120; return `<i class="yw-p ${kind}" style="--dx:${Math.round(Math.cos(a) * r)}px;--dy:${Math.round(Math.sin(a) * r - 40)}px;--d:${(.6 + (i % 5) * .09).toFixed(2)}s"></i>`; }).join('');
    };
    // 진 판: 판돈 칩 더미가 곽 사장 쪽으로 쓸려 간다.
    const sweep = () => {
      if (reduced()) return;
      const el = $('#yw-sweep'); el.innerHTML = Array.from({ length: Math.min(9, 3 + g.wins * 2) }, (_, i) => `<i class="yw-chip c${i % 3}" style="--x:${(i % 3 - 1) * 14}px;--y:${-Math.floor(i / 3) * 6}px"></i>`).join('');
      el.className = 'yw-sweep'; void el.offsetWidth; el.classList.add('go');
    };
    // ×8: 지폐가 위에서 흩날린다.
    const rain = () => {
      if (reduced()) return;
      const r = document.createElement('div'); r.className = 'yw-rain'; r.setAttribute('aria-hidden', 'true');
      r.innerHTML = Array.from({ length: 26 }, (_, i) => `<i style="--l:${(i * 37) % 100}%;--d:${1.6 + (i % 5) * .25}s;--w:${(i * 53) % 360}deg;--s:${(i % 7) * .12}s"></i>`).join('');
      box.appendChild(r); setTimeout(() => r.remove(), 3200);
    };
    const potTo = value => {
      const el = $('#yw-pot'), from = g.pot;
      g.pot = value;
      if (reduced()) { el.textContent = num(value); return; }
      const start = performance.now(), dur = 650;
      const step = t => { const k = Math.min(1, (t - start) / dur); el.textContent = num(Math.round(from + (value - from) * (1 - Math.pow(1 - k, 3)))); if (k < 1 && box.isConnected) requestAnimationFrame(step); };
      requestAnimationFrame(step);
    };
    const tension = on => {
      clearInterval(g.heart); g.heart = null;
      box.classList.toggle('tense', on && g.wins > 0); box.classList.toggle('final', on && g.wins >= YABAWI.MAX_WINS - 1);
      if (on && g.wins > 0 && !reduced()) { SFX.heart(); g.heart = setInterval(() => { if (!box.isConnected) return clearInterval(g.heart); SFX.heart(); }, g.wins >= YABAWI.MAX_WINS - 1 ? 700 : 950); }
    };

    /* 컵 놓기 · 옮기기 */
    const place = (el, slot, n) => { const { x, y } = slotXY(n, slot); el.style.left = `${x}%`; el.style.top = `${y}%`; el.dataset.slot = slot; };
    function layCups(n) {
      const wrap = $('#yw-cups');
      wrap.className = `yw-cups n${n}`;
      wrap.innerHTML = `<i class="yw-ball" id="yw-ball"></i><i class="yw-streak" id="yw-streak"></i>${Array.from({ length: n }, (_, i) => `<button type="button" class="yw-cup" data-y="cup" disabled aria-label="${i + 1}번 컵"><i class="yw-cup-shadow"></i>${cupHtml()}</button>`).join('')}`;
      g.cups = [...wrap.querySelectorAll('.yw-cup')];
      g.cups.forEach((el, i) => place(el, i, n));
    }
    const ballTo = (slot, n, show) => { const b = $('#yw-ball'); if (!b) return; const { x, y } = slotXY(n, slot); b.style.left = `${x}%`; b.style.top = `${y}%`; b.classList.toggle('on', show); };
    const lift = (slot, up = true) => { const el = g.cups[slot]; if (el) el.classList.toggle('up', up); };
    // 시작 전 판: 컵 3개, 가운데 컵을 들어 공을 보여 둔다.
    const idleTable = () => { const n = YABAWI.ROUNDS[0].cups, mid = Math.floor(n / 2); layCups(n); ballTo(mid, n, true); lift(mid); };
    // 한 걸음: 겹치지 않는 쌍들이 한꺼번에 자리를 바꾼다(하나는 위로, 하나는 아래로 둥글게).
    // 페이크면 가다 멈칫하고 제자리로 돌아온다(공은 그대로).
    function stepAnim(step, n, ms, fake) {
      const opts = { duration: ms, easing: fake ? 'ease-in-out' : 'cubic-bezier(.45,.05,.35,1)' };
      const runs = [], moved = [];
      stepPairs(step).forEach(([a, b], k) => {
        const A1 = g.cups[a], B1 = g.cups[b], pa = slotXY(n, a), pb = slotXY(n, b);
        const dx = pb.x - pa.x, dy = pb.y - pa.y, len = Math.hypot(dx, dy) || 1, bend = Math.min(26, 10 + len * .18) * (k % 2 ? -1 : 1);
        const off = { x: -dy / len * bend, y: dx / len * bend * .55 };
        const at = (from, to, t, s) => ({ x: from.x + (to.x - from.x) * t + off.x * s * Math.sin(Math.PI * t), y: from.y + (to.y - from.y) * t + off.y * s * Math.sin(Math.PI * t) });
        const run = (el, from, to, s) => {
          const frames = fake
            ? [0, .42, .5, 0].map((t, i) => { const p = at(from, to, t, s); return { left: `${p.x}%`, top: `${p.y}%`, offset: [0, .45, .6, 1][i] }; })
            : [0, .5, 1].map(t => { const p = at(from, to, t, s); return { left: `${p.x}%`, top: `${p.y}%` }; });
          return el.animate(frames, opts).finished.catch(() => {});
        };
        runs.push(run(A1, pa, pb, 1), run(B1, pb, pa, -1));
        if (!fake) moved.push([a, b, A1, B1]);
      });
      for (const [a, b, A1, B1] of moved) { g.cups[a] = B1; g.cups[b] = A1; place(A1, b, n); place(B1, a, n); }
      return Promise.all(runs);
    }
    // 밑장빼기: 두 컵이 살짝 들리고, 공이 바닥으로 휙 미끄러진다(빠르지만 보인다).
    async function cheatAnim(cheat, n) {
      pose('sneak'); SFX.sneak();
      const s = $('#yw-streak'), pa = slotXY(n, cheat.from), pb = slotXY(n, cheat.to);
      g.cups[cheat.from]?.classList.add('peek'); g.cups[cheat.to]?.classList.add('peek');
      s.style.left = `${pa.x}%`; s.style.top = `${pa.y}%`;
      s.classList.add('on');
      await s.animate([{ left: `${pa.x}%`, top: `${pa.y}%`, opacity: 1 }, { left: `${pb.x}%`, top: `${pb.y}%`, opacity: 1 }], { duration: YABAWI.CHEAT_MS * .6, easing: 'ease-in' }).finished.catch(() => {});
      s.classList.remove('on');
      await wait(YABAWI.CHEAT_MS * .4);
      g.cups[cheat.from]?.classList.remove('peek'); g.cups[cheat.to]?.classList.remove('peek');
      pose('shuffle');
    }

    /* 판 돌리기 */
    async function deal(body) {
      if (g.busy) return;
      g.busy = true;
      $('#yw-controls').innerHTML = '';
      banner('');
      $('#yw-stamp').className = 'yw-stamp';
      let res;
      try { res = await api('/yabawi/deal', body); }
      catch (err) { toast(err.message); g.busy = false; g.phase = g.phase === 'choice' ? 'choice' : 'end'; return controls(); }
      setBalance(res.points_balance);
      if (A.data.rewards) A.data.rewards.yabawi = res.yabawi;
      g.left = Number(res.yabawi?.left ?? g.left);
      if (res.settled) {
        toast(res.paid ? `오래 둔 판을 정리했어요. ${num(res.paid)}코인을 받았어요!` : '오래 둔 판을 정리했어요.');
        g.phase = 'end'; g.busy = false; g.wins = 0; return controls();
      }
      Object.assign(g, { bet: res.bet, pot: res.pot, wins: res.wins, round: res.round, done: 0, stopUsed: false, aborted: false, picked: null });
      $('#yw-ladder').innerHTML = ladder(g.wins, g.bet); $('#yw-pot').textContent = num(g.pot);
      await shuffle(res.round);
    }
    async function shuffle(round) {
      const n = round.cups;
      layCups(n);
      tension(true);
      banner(g.wins >= YABAWI.MAX_WINS - 1 ? '운명의 한 판' : `ROUND ${g.wins + 1} · 컵 ${n}개`, g.wins >= YABAWI.MAX_WINS - 1 ? 'final' : 'call');
      talk(g.wins >= YABAWI.MAX_WINS - 1 ? pickOne(TALK.final) : g.wins ? pickOne(TALK.streak) : pickOne(TALK.show), 0);
      pose(g.wins >= YABAWI.MAX_WINS - 1 ? 'hammer' : 'point');
      // 공 보여 주기: 컵을 들어 공을 보이고 덮는다.
      ballTo(round.start, n, true);
      await wait(250); lift(round.start); SFX.lift();
      await wait(YABAWI.SHOW_MS - 650);
      lift(round.start, false); await wait(260); SFX.thud();
      $('#yw-ball').classList.remove('on');
      await wait(140);
      pose('shuffle');
      const stop = $('#yw-stop'); stop.hidden = false; stop.disabled = false;
      for (let i = 0; i < round.swaps.length; i++) {
        if (g.aborted || !box.isConnected) return;
        SFX.swish(i);
        await stepAnim(round.swaps[i], n, round.ms, isFake(round, i));
        g.done = i + 1;
        if (g.aborted || !box.isConnected) return;
        if (round.cheat && i === round.cheat.at) await cheatAnim(round.cheat, n);
      }
      if (g.aborted) return;
      stop.hidden = true;
      // 고르기
      g.phase = 'pick'; g.busy = false;
      pose('point'); talk(pickOne(TALK.pick), 0);
      banner('공은 어디에?', 'call');
      g.cups.forEach(el => { el.disabled = false; });
      controls();
    }
    async function pick(body) {
      if (g.busy && !body.stop) return;
      g.busy = true;
      g.cups.forEach(el => { el.disabled = true; el.classList.remove('sel'); });
      $('#yw-stop').hidden = true;
      $('#yw-controls').innerHTML = '';
      tension(false);
      let res;
      try { res = await api('/yabawi/pick', body); }
      catch (err) {
        toast(err.message);
        if (body.stop != null) { g.aborted = false; } // 잡기가 거절되면(드문 경우) 그대로 고르기로 간다
        g.phase = 'pick'; g.busy = false; g.cups.forEach(el => { el.disabled = false; }); return controls();
      }
      setBalance(res.points_balance);
      if (A.data.rewards) A.data.rewards.yabawi = res.yabawi;
      g.left = Number(res.yabawi?.left ?? g.left);
      // 잡았으면 섞다 멈춘 그 자리(밑장빼기로 옮긴 컵)를 연다. 서버 res.ball은 끝까지 섞었을 때 자리다.
      const n = g.round.cups, ballSlot = res.caught ? ballAt(g.round, g.done) : res.ball;
      // 공개: 고른 컵부터, 틀렸으면 공이 든 컵을 이어서.
      if (res.caught) {
        stamp('동작 그만!', 'caught'); SFX.alarm(); pose('shock'); talk(pickOne(TALK.caught));
        box.classList.add('flash');
        await wait(reduced() ? 0 : 700); box.classList.remove('flash');
        ballTo(ballSlot, n, true); lift(ballSlot); SFX.lift();
      } else {
        ballTo(ballSlot, n, ballSlot === res.slot);
        lift(res.slot); SFX.lift();
        await wait(reduced() ? 0 : 700);
        if (res.result === 'lose') { ballTo(ballSlot, n, true); lift(ballSlot); g.cups[ballSlot]?.classList.add('answer'); await wait(reduced() ? 0 : 450); }
      }
      if (res.result === 'lose') {
        stamp('LOSE', 'lose'); pose('sweep'); talk(pickOne(TALK.lose)); SFX.lose();
        banner(g.wins ? `${g.wins}연승에서 멈췄어요…` : '곽 사장 승!', 'lose');
        sweep(); potTo(0); burst('puff', 14);
        setTimeout(() => pose('grin'), reduced() ? 0 : 1100);
        g.wins = 0; g.phase = 'end';
      } else {
        g.wins = res.wins;
        $('#yw-ladder').innerHTML = ladder(g.wins, g.bet);
        potTo(res.pot);
        burst('chip', 10 + g.wins * 8);
        if (res.done) {
          stamp('×8!', 'jackpot'); SFX.jackpot(); pose('shock'); talk(pickOne(TALK.jackpot), 0);
          banner(`${YABAWI.MAX_WINS}연승! 오늘은 니가 타짜다`, 'jackpot'); box.classList.add('gold');
          rain();
          toast(`${num(res.paid)}코인을 받았어요!`);
          g.phase = 'end';
        } else {
          if (!res.caught) { stamp('WIN!', 'win'); pose('shock'); talk(pickOne(TALK.win)); }
          SFX.win();
          banner(res.caught ? '밑장빼기 적발! 이번 판은 내 거!' : g.wins === 1 ? '맞혔다!' : `${g.wins}연승!`, 'win');
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
        const res = await api('/yabawi/cash', {});
        if (A.data.rewards) A.data.rewards.yabawi = res.yabawi;
        g.left = Number(res.yabawi?.left ?? g.left);
        setBalance(res.points_balance);
        banner(`+${num(res.paid)}코인 챙겼다!`, 'win'); SFX.cash(); pose('point'); talk(pickOne(TALK.cash));
        burst('chip', 26);
        g.phase = 'end'; g.wins = 0;
      } catch (err) { toast(err.message); }
      g.busy = false;
      controls();
    }
    // '묻고 더블로 가': 게임 단어 한 문제. 맞히면 더블, 틀리면 판돈을 챙겨 끝낸다. 단어가 모자라면 바로 더블.
    function quiz() {
      const list = arcadeWords(A).list.filter(w => w.word && w.meaning);
      const meanings = [...new Set(list.map(w => String(w.meaning)))];
      if (list.length < 4 || meanings.length < 4) return goDouble();
      const q = pickOne(list), wrong = meanings.filter(m => m !== String(q.meaning)).sort(() => Math.random() - .5).slice(0, 3);
      const choices = [String(q.meaning), ...wrong].sort(() => Math.random() - .5);
      g.phase = 'quiz'; g.quiz = String(q.meaning);
      pose('point'); talk('묻고 더블로 가려면… 이거부터 맞혀 봐.', 0);
      $('#yw-controls').innerHTML = `<div class="yw-quiz"><p class="yw-hint">더블 조건! 뜻을 골라요</p><b class="yw-word">${esc(q.word)}</b><div class="yw-quiz-choices">${choices.map(m => `<button type="button" class="yw-qa" data-y="qa" data-m="${esc(m)}">${esc(m)}</button>`).join('')}</div></div>`;
      $('#yw-controls').querySelector('button')?.focus({ preventScroll: true });
    }
    async function answer(btn) {
      if (g.phase !== 'quiz' || g.busy) return;
      const right = btn.dataset.m === g.quiz;
      $('#yw-controls').querySelectorAll('.yw-qa').forEach(b => { b.disabled = true; if (b.dataset.m === g.quiz) b.classList.add('right'); });
      if (!right) btn.classList.add('wrong');
      await wait(reduced() ? 200 : 750);
      if (right) { talk(pickOne(TALK.quizRight)); return goDouble(); }
      talk(pickOne(TALK.quizWrong)); g.phase = 'choice';
      return cash();
    }
    function goDouble() {
      banner('묻고 더블로 가!', 'double'); stamp('DOUBLE', 'double');
      if (!reduced()) SFX.alarm();
      g.phase = 'deal';
      setTimeout(() => deal({ double: true }), reduced() ? 0 : 900);
    }

    const controls = () => {
      const c = $('#yw-controls');
      if (g.phase === 'ready') {
        c.innerHTML = `<button type="button" class="yw-start" data-y="start">START<small>${coin()}${num(g.bet)} 걸고 시작</small></button>`;
      } else if (g.phase === 'resume') {
        c.innerHTML = `<button type="button" class="yw-start" data-y="resume">하던 판 다시 보기<small>같은 판을 처음부터 섞어요</small></button>`;
      } else if (g.phase === 'pick') {
        c.innerHTML = `<p class="yw-hint">${g.picked == null ? '공이 든 컵을 눌러요' : `${g.picked + 1}번 컵? 확실하면 승부!`}</p><button type="button" class="yw-confirm" data-y="confirm" ${g.picked == null ? 'disabled' : ''}>이 컵이다!</button>`;
      } else if (g.phase === 'choice') {
        const next = g.pot * 2, final = g.wins >= YABAWI.MAX_WINS - 1;
        c.innerHTML = `<p class="yw-hint">${g.wins}연승! 챙길까, <b>${num(next)}코인</b>에 걸까?</p><div class="yw-choice"><button type="button" class="yw-cash" data-y="cash">받기<em>${coin()}${num(g.pot)}</em></button><button type="button" class="yw-double" data-y="double">${final ? '마지막 판, 묻고 더블로 가!' : '묻고 더블로 가!'}<em>×${2 ** (g.wins + 1)} · ${coin()}${num(next)}</em></button></div>`;
      } else if (g.phase === 'end') {
        const again = g.left > 0 && g.balance >= g.bet;
        c.innerHTML = `<div class="yw-choice">${again ? `<button type="button" class="yw-double" data-y="again">한 판 더<em>${coin()}${num(g.bet)} · 오늘 ${g.left}판 남음</em></button>` : ''}<button type="button" class="yw-cash" data-y="close">닫기</button></div>`;
      } else c.innerHTML = '';
      c.querySelector('button:not([disabled])')?.focus({ preventScroll: true });
    };
    const close = () => { g.aborted = true; clearInterval(g.heart); clearTimeout(talkTimer); box.classList.add('bye'); setTimeout(() => box.remove(), 200); resolve(g.balance); };

    box.addEventListener('click', e => {
      if ($('#yw-stage').classList.contains('intro')) return skipIntro();
      const b = e.target.closest('[data-y]');
      if (!b || b.disabled) return;
      const y = b.dataset.y;
      if (y === 'close') {
        if (g.phase === 'choice') toast(`${num(g.pot)}코인은 다음에 이어서 받을 수 있어요.`);
        return close();
      }
      if (y === 'stop') {
        if (g.stopUsed || !g.round) return;
        if (caughtCheat(g.round, g.done)) { g.aborted = true; return pick({ stop: g.done }); }
        g.stopUsed = true; b.disabled = true;
        pose('grin'); talk(pickOne(g.wins ? TALK.falseCall : TALK.falseFirst));
        b.classList.add('nope');
        return;
      }
      if (g.busy) return;
      if (y === 'start') return deal({ bet: g.bet });
      if (y === 'resume') return deal({});
      if (y === 'cup' && g.phase === 'pick') {
        g.picked = Number(b.dataset.slot);
        g.cups.forEach(el => el.classList.toggle('sel', el === b));
        return controls();
      }
      if (y === 'confirm' && g.phase === 'pick' && g.picked != null) return pick({ slot: g.picked });
      if (y === 'cash') return cash();
      if (y === 'double') return quiz();
      if (y === 'qa') return answer(b);
      if (y === 'again') {
        Object.assign(g, { pot: g.bet, wins: 0, phase: 'ready', round: null });
        box.classList.remove('gold');
        $('#yw-pot').textContent = num(g.bet); $('#yw-ladder').innerHTML = ladder(0, g.bet);
        idleTable(); banner(''); $('#yw-stamp').className = 'yw-stamp'; pose('point');
        return deal({ bet: g.bet });
      }
    });
    box.addEventListener('keydown', e => { if (e.key === 'Escape' && !g.busy) close(); });

    // 등장: 조명이 켜지고 곽 사장이 걸어 들어와 손가락을 든다(누르면 건너뛴다).
    let introDone = false;
    function skipIntro() {
      if (introDone) return;
      introDone = true;
      $('#yw-stage').classList.remove('intro');
      if (g.phase === 'choice') { banner(`${g.wins}연승 중!`, 'call'); talk('어디 보자, 챙길 텨, 더블로 갈 텨?', 0); }
      controls();
    }
    idleTable();
    talk(TALK.intro[0], 0);
    if (reduced()) skipIntro();
    else { SFX.thud(); setTimeout(skipIntro, 2300); }
  });
}
