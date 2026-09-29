import { api, esc, num, icon, toast, modal } from './ui.js';
import { avatar } from './character.js';
import { GACHA_ITEMS, GACHA_KEYS, GACHA_TIERS, GACHA_TIER_KEYS, GACHA_KINDS, ownedDecorations, LUCKY_BETS, LUCKY_DAILY, LUCKY_ODDS, LUCKY_TICKET_BET, CHANCE_BETS, CHANCE_STEPS, CHANCE_DAILY } from './rewards.js';
import { titleEmblem, coin } from './emblems.js';
import { TITLES } from './titles.js';
import { titleState } from './titles-ui.js';
import { CHARACTERS, EGG_PRICE } from './core.js';

// 놀이터: the coin capsule (코인 뽑기, V13.68) and the word double chance (더블 찬스), plus the
// decorations kept from the retired V13.67 capsule machine (모은 꾸미기, under 나). The server
// decides everything (server/rewards.mjs); this module draws `[data-arcade]` and keeps it up to
// date without redrawing the whole app.

const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const KEY_ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'];
// Capsules piled in the dome (left, bottom in px).
const BALL_SPOTS = [[6, 2], [30, 1], [54, 3], [78, 2], [16, 22], [42, 24], [66, 21], [28, 44], [54, 45]];
const rewards = A => A.data.rewards ||= { attendance: null, gacha: { items: {}, tickets: 0 }, lucky: null, chance: null };
const luckyState = A => rewards(A).lucky || { bets: LUCKY_BETS, daily: LUCKY_DAILY, left: LUCKY_DAILY, odds: LUCKY_ODDS, tickets: Number(rewards(A).gacha?.tickets || 0) };
// Each result has the color of a tier: 꽝 grey, 본전 green, 2배 blue, 3배 gold.
const MULT_CLASS = { 0: 't-miss', 1: 't-common', 2: 't-rare', 3: 't-legendary' };
const byTier = keys => [...keys].sort((a, b) => GACHA_TIER_KEYS.indexOf(GACHA_ITEMS[b].tier) - GACHA_TIER_KEYS.indexOf(GACHA_ITEMS[a].tier) || GACHA_KEYS.indexOf(a) - GACHA_KEYS.indexOf(b));

// The coin chip in the header follows every change here.
function setBalance(A, balance) {
  if (typeof balance !== 'number') return;
  A.data.stats.points_balance = balance;
  document.querySelectorAll('.coin-chip-v1366 b').forEach(b => { b.textContent = num(balance); });
  const wallet = document.getElementById('ga-balance'); if (wallet) wallet.textContent = num(balance);
}

// What a decoration looks like: an aura on the student's own pet, or the title's medal.
export function capsuleArt(A, key, size = 'md') {
  const item = GACHA_ITEMS[key];
  if (!item) return '';
  if (item.kind === 'aura') {
    const pet = A.data.stats?.pet;
    return `<span class="ga-art aura ${size}">${avatar(pet?.key || 'dog', { form: Math.max(1, pet?.form ?? 1), frame: item.wear, size: size === 'sm' ? 'mini' : '' })}</span>`;
  }
  return `<span class="ga-art title ${size}">${titleEmblem(item.title, { size: size === 'lg' ? 'lg' : 'md' })}</span>`;
}
const tierTag = tier => `<span class="ga-tier t-${tier}">${GACHA_TIERS[tier].name}</span>`;

/* ---------- page ---------- */
export function arcadePage(A) {
  return `<div class="page-heading arcade-head"><span class="premium-eyebrow">COIN ARCADE</span><h1>놀이터</h1><p>모은 코인으로 코인 뽑기·더블 찬스·알 상점을 즐겨요.</p></div>
    <button type="button" class="arcade-wallet" data-action="coins" aria-label="코인 지갑 열기"><span>${coin()}<b id="ga-balance">${num(A.data.stats?.points_balance || 0)}</b> 코인</span><small>코인 지갑 ${icon('chevron')}</small></button>
    <div data-arcade></div>`;
}
// V13.68: decorations pulled from the retired capsule machine, under 나 (only for their owners).
export function gachaBookPage() {
  return `<button type="button" class="page-back-v1368" data-go="me">${icon('back')}나</button>
    <div class="page-heading arcade-head"><span class="premium-eyebrow">MY COLLECTION</span><h1>모은 꾸미기</h1><p>예전 뽑기 머신에서 모은 오라와 칭호예요. 눌러서 착용해요.</p></div>
    <div data-arcade data-arcade-view="book"></div>`;
}
// The pet egg shop, below the games.
function shopHtml(A) {
  const g = A.data.stats || {}, owned = (g.pets || []).length, total = Object.keys(CHARACTERS).length;
  return `<section class="ga-card ga-shop">
    <button type="button" class="ga-shop-row" data-action="egg-shop"><span class="ga-egg" aria-hidden="true">?</span><span><b>랜덤 알 상점</b><small>${owned < total ? `아직 못 만난 친구 ${total - owned}마리` : '모든 친구를 모았어요!'}</small></span><em>${coin()}${num(EGG_PRICE)}</em></button>
  </section>`;
}
// V13.68 coin capsule: pick a bet, turn the knob; the capsule says how many times it comes back.
let luckyBet = LUCKY_BETS[0];
function machineHtml(A) {
  const l = luckyState(A), tickets = Number(l.tickets || 0);
  const balance = Number(A.data.stats?.points_balance || 0);
  const balls = ['#ff8fb1', '#7cc7ff', '#ffd166', '#8ee6b8', '#b69cff', '#ff9f6b', '#6ee7d6', '#ffc1d9', '#9ad0ff'];
  const can = l.left > 0 && balance >= luckyBet;
  return `<section class="ga-card">
    <div class="ga-top">
      <div class="ga-machine" id="ga-machine" aria-hidden="true">
        <div class="ga-dome">${balls.map((c, i) => `<i style="--c:${c};left:${BALL_SPOTS[i][0]}px;bottom:${BALL_SPOTS[i][1]}px;transform:rotate(${i * 37}deg)"></i>`).join('')}<span class="ga-shine"></span></div>
        <div class="ga-body"><span class="ga-brand">SUMUS</span><span class="ga-knob"><i></i></span><span class="ga-slot"></span></div>
      </div>
      <div class="ga-side">
        <h2>코인 뽑기</h2>
        <p>코인을 걸고 캡슐을 뽑아요. <b>최대 3배</b>로 돌아와요!</p>
        <div class="lk-bets" role="group" aria-label="걸 코인">${(l.bets || LUCKY_BETS).map(b => `<button type="button" class="lk-bet ${luckyBet === b ? 'on' : ''}" data-ga="bet" data-bet="${b}" aria-pressed="${luckyBet === b}">${coin()}${b}</button>`).join('')}</div>
        <button type="button" class="btn primary full ga-pull" data-ga="pull" ${can ? '' : 'disabled'}>${l.left > 0 ? `뽑기 <span>${coin()}${luckyBet}</span>` : '오늘 뽑기 끝! 내일 또 만나요'}</button>
        ${tickets ? `<button type="button" class="btn full ga-ticket" data-ga="ticket">뽑기권 쓰기 <span>${tickets}장 · ${coin()}${LUCKY_TICKET_BET} 공짜</span></button>` : ''}
      </div>
    </div>
    <div class="lk-odds">${LUCKY_ODDS.map(o => `<span class="${MULT_CLASS[o.mult]}"><b>${o.mult ? `×${o.mult}` : '꽝'}</b>${o.rate}%</span>`).join('')}</div>
    <p class="ga-note">오늘 남은 뽑기 <b>${l.left}/${l.daily || LUCKY_DAILY}</b> · 확률은 매번 같아요 <button type="button" class="lk-odds-more" data-ga="odds">자세히</button> · 뽑기권은 출석 7번째 도장에서 받아요.</p>
  </section>`;
}
// Decorations the student pulled from the V13.67 machine (the page shows only those).
function collectionHtml(A) {
  const items = rewards(A).gacha.items || {};
  const have = ownedDecorations(items);
  const p = A.data.profile;
  const worn = key => { const item = GACHA_ITEMS[key]; return item.kind === 'aura' ? p.avatar_frame === item.wear : titleState(A).equipped === item.title; };
  if (!have.length) return '<section class="ga-card ga-book"><p class="ga-note">모은 꾸미기가 없어요.</p></section>';
  return `<section class="ga-card ga-book">
    <div class="ga-book-head"><h2>모은 꾸미기</h2><b>${have.length}<small>개</small></b></div>
    <div class="ga-grid">${byTier(have).map(key => {
      const item = GACHA_ITEMS[key];
      return `<button type="button" class="ga-item on t-${item.tier}${worn(key) ? ' worn' : ''}" data-ga="item" data-key="${key}" aria-label="${esc(item.name)} · ${GACHA_TIERS[item.tier].name} ${GACHA_KINDS[item.kind]}">
        ${capsuleArt(A, key, 'sm')}
        <b>${esc(item.name)}</b><small>${GACHA_TIERS[item.tier].name} ${GACHA_KINDS[item.kind]}</small>
        ${worn(key) ? '<i class="ga-worn">착용 중</i>' : ''}
      </button>`;
    }).join('')}</div>
  </section>`;
}

/* ---------- double chance ---------- */
const DC = { bet: CHANCE_BETS[0], typed: [], timer: null, result: null, busy: false, receivedAt: Date.now() };
function ladder(live) {
  return `<ol class="dc-ladder">${CHANCE_STEPS.map((s, i) => `<li class="${live && i < live.step + (live.status === 'decide' ? 1 : 0) ? 'done' : ''}${live && i === live.step && live.status === 'question' ? ' now' : ''}"><b>×${s.mult}</b><span>${esc(s.name)}</span></li>`).join('<li class="dc-arrow" aria-hidden="true">›</li>')}</ol>`;
}
function chanceHtml(A) {
  const c = rewards(A).chance || { bets: CHANCE_BETS, left: CHANCE_DAILY, daily: CHANCE_DAILY, wins: 0, best: 0, live: null };
  const live = c.live, r = DC.result;
  let body;
  if (live?.status === 'question') body = questionHtml(live);
  else if (live?.status === 'decide') body = `<div class="dc-decide">
      <div class="dc-burst">정답!</div>
      <p>지금 <b>${coin()}${num(live.pot)}</b> 확보! 다음 단어를 맞히면 <b>${coin()}${num(live.next_pot)}</b>, 틀리면 모두 잃어요.</p>
      <div class="dc-choice"><button type="button" class="btn full" data-dc="keep">여기서 받기 <span>${coin()}${num(live.pot)}</span></button><button type="button" class="btn primary full" data-dc="go">한 번 더! <span>${coin()}${num(live.next_pot)}</span></button></div>
      ${r?.reveal ? `<p class="dc-reveal">${esc(revealText(r.reveal))}</p>` : ''}
    </div>`;
  else body = `${r ? resultHtml(r) : ''}
    <div class="dc-bets" role="group" aria-label="걸 코인">${(c.bets || CHANCE_BETS).map(b => `<button type="button" class="dc-bet ${DC.bet === b ? 'on' : ''}" data-dc="bet" data-bet="${b}" aria-pressed="${DC.bet === b}">${coin()}${b}</button>`).join('')}</div>
    <button type="button" class="btn primary full dc-start" data-dc="start" ${c.left > 0 && Number(A.data.stats?.points_balance || 0) >= DC.bet ? '' : 'disabled'}>${c.left > 0 ? `${r ? '다시 ' : ''}도전하기` : '오늘 도전 끝! 내일 또 만나요'}</button>
    <p class="dc-meta">오늘 남은 도전 <b>${c.left}/${c.daily || CHANCE_DAILY}</b> · 성공 ${num(c.wins || 0)}번${c.best ? ` · 최고 ${c.best}단계` : ''}</p>`;
  return `<section class="ga-card dc-card" id="dc-card">
    <div class="dc-head"><div><h2>단어 더블 찬스</h2><p>공부한 단어로 도전! 맞힐 때마다 코인이 2배, 3번까지.</p></div><span class="dc-pot-tag">${live ? `${coin()}${num(live.pot)}` : ''}</span></div>
    ${ladder(live)}
    ${body}
  </section>`;
}
const revealText = rv => rv.meaning ? `정답: ${rv.word} = ${rv.meaning}` : `정답: ${rv.word}`;
function resultHtml(r) {
  if (r.paid && r.done) return `<div class="dc-result win big"><b>×8 대성공!</b><span>${coin()}+${num(r.paid)}</span><small>${esc(revealText(r.reveal))}</small></div>`;
  if (r.paid) return `<div class="dc-result win"><b>코인을 받았어요</b><span>${coin()}+${num(r.paid)}</span></div>`;
  return `<div class="dc-result lose"><b>${r.late ? '시간이 끝났어요' : '아쉬워요!'}</b><span>${coin()}−${num(r.lost || 0)}</span><small>${esc(revealText(r.reveal || {}))}</small></div>`;
}
function questionHtml(live) {
  const q = live.question;
  const head = `<div class="dc-q-head"><span>${live.step + 1}단계 · ${esc(CHANCE_STEPS[live.step].name)}</span><span class="dc-time" id="dc-time"></span></div><div class="dc-timebar"><i id="dc-timebar"></i></div>`;
  if (q.kind === 'spell') {
    return `${head}<div class="dc-prompt meaning">${esc(q.prompt)}</div><div class="yb-spell dc-spell" id="dc-spell">
      <div class="yb-spell-slots" id="dc-slots">${slotsHtml(q)}</div>
      <div class="yb-kb">${KEY_ROWS.map((row, r) => `<div class="yb-kb-row">${r === 2 ? '<button type="button" class="yb-key wide" data-dc="key" data-key="back" aria-label="지우기">⌫</button>' : ''}${[...row].map(k => `<button type="button" class="yb-key" data-dc="key" data-key="${k}">${k}</button>`).join('')}${r === 2 ? `<button type="button" class="yb-key go" data-dc="spell-go" id="dc-go" ${DC.typed.length === blanks(q) ? '' : 'disabled'}>확인</button>` : ''}</div>`).join('')}</div></div>`;
  }
  return `${head}<div class="dc-prompt${q.dir === 'mean2eng' ? ' meaning' : ''}">${esc(q.prompt)}</div><p class="dc-ask">${q.dir === 'mean2eng' ? '알맞은 영어 단어는?' : '이 단어의 뜻은?'}</p>
    <div class="dc-options">${q.options.map((o, i) => `<button type="button" class="dc-opt" data-dc="pick" data-choice="${i}"><b>${i + 1}</b>${esc(o)}</button>`).join('')}</div>`;
}
const blanks = q => [...q.hint].filter(ch => ch === '_').length;
function spelled(q) { let i = 0; return [...q.hint].map(ch => ch === '_' ? (DC.typed[i++] || '') : ch).join(''); }
function slotsHtml(q) {
  let i = 0;
  return [...q.hint].map(ch => {
    if (ch === ' ') return '<span class="yb-slot gap"></span>';
    if (ch !== '_') return `<span class="yb-slot fixed">${esc(ch)}</span>`;
    const typed = DC.typed[i++];
    return `<span class="yb-slot ${typed ? 'typed' : i - 1 === DC.typed.length ? 'next' : ''}">${esc(typed || '')}</span>`;
  }).join('');
}

/* ---------- mount and actions ---------- */
let current = null;
export function mountArcade(el, A) {
  if (!el || el.dataset.mounted) return;
  el.dataset.mounted = '1';
  current = { el, A };
  DC.result = null; DC.typed = []; DC.receivedAt = A.loadedAt || Date.now();
  draw();
  // Fresh numbers (attendance may have given a ticket since the app loaded).
  api('/rewards').then(res => {
    if (current?.el !== el || DC.busy || current.busy) return;
    const r = rewards(A);
    r.attendance = res.attendance; r.gacha = res.gacha; r.lucky = res.lucky; r.chance = res.chance;
    A.data.stats.gacha = res.gacha.items;
    DC.receivedAt = Date.now();
    setBalance(A, res.points_balance);
    draw();
  }).catch(() => {});
  el.addEventListener('click', event => {
    const g = event.target.closest('[data-ga]'), d = event.target.closest('[data-dc]');
    if (g && !g.disabled) {
      if (g.dataset.ga === 'bet') { luckyBet = Number(g.dataset.bet); return draw(); }
      if (g.dataset.ga === 'pull') return pull(A, false, g);
      if (g.dataset.ga === 'ticket') return pull(A, true, g);
      if (g.dataset.ga === 'odds') return oddsModal();
      if (g.dataset.ga === 'item') return itemModal(A, g.dataset.key);
    }
    if (d && !d.disabled) {
      const act = d.dataset.dc;
      if (act === 'bet') { DC.bet = Number(d.dataset.bet); DC.result = null; return drawChance(); }
      if (act === 'start') return startChance(A, d);
      if (act === 'pick') return answerChance(A, Number(d.dataset.choice), d);
      if (act === 'key') return spellKey(d.dataset.key);
      if (act === 'spell-go') return spellSubmit(A);
      if (act === 'keep' || act === 'go') return decideChance(A, act === 'go', d);
    }
  });
  hookKeys();
}
function draw() {
  if (!current?.el.isConnected) return;
  current.el.innerHTML = current.el.dataset.arcadeView === 'book' ? collectionHtml(current.A) : `${machineHtml(current.A)}${chanceHtml(current.A)}${shopHtml(current.A)}`;
  runTimer();
}
function drawChance() {
  const card = document.getElementById('dc-card');
  if (!card) return draw();
  card.outerHTML = chanceHtml(current.A);
  runTimer();
}

/* coin capsule */
async function pull(A, ticket, button) {
  if (current?.busy) return;
  current.busy = true;
  button.disabled = true;
  const machine = document.getElementById('ga-machine');
  machine?.classList.add('spinning');
  const wait = new Promise(resolve => setTimeout(resolve, reduced() ? 0 : 1100));
  try {
    const [res] = await Promise.all([api('/lucky/pull', ticket ? { ticket: true } : { bet: luckyBet }), wait]);
    rewards(A).lucky = res.lucky;
    if (rewards(A).gacha) rewards(A).gacha.tickets = res.lucky.tickets;
    setBalance(A, res.points_balance);
    machine?.classList.remove('spinning');
    machine?.classList.add('drop');
    await new Promise(resolve => setTimeout(resolve, reduced() ? 0 : 450));
    reveal(res);
  } catch (err) { toast(err.message); }
  finally { current.busy = false; machine?.classList.remove('spinning', 'drop'); draw(); }
}
function reveal(res) {
  const cls = MULT_CLASS[res.mult] || 't-miss';
  const head = res.mult === 3 ? '대박! 3배!' : res.mult === 2 ? '2배 당첨!' : res.mult === 1 ? '본전!' : '아쉬워요!';
  const line = res.mult ? `${coin()}${num(res.bet)} → <b>${coin()}${num(res.paid)}</b>` : `${coin()}${num(res.bet)}코인을 잃었어요. 다음엔 꼭!`;
  const box = document.createElement('div');
  box.className = `ga-reveal ${cls}${reduced() ? ' still' : ''}`;
  box.innerHTML = `<div class="ga-reveal-card" role="dialog" aria-modal="true" aria-label="코인 뽑기 결과 ${esc(head)}">
    <div class="ga-capsule" aria-hidden="true"><i class="top"></i><i class="bottom"></i></div>
    <div class="ga-reveal-body">
      <div class="ga-rays" aria-hidden="true"></div>
      <span class="lk-mult ${cls}">${res.mult ? `×${res.mult}` : '꽝'}</span>
      <h2>${head}</h2>
      <p class="lk-line">${line}</p>
      ${res.ticket ? '<p class="ga-new">뽑기권으로 공짜 뽑기!</p>' : `<p>오늘 남은 뽑기 ${res.lucky.left}번</p>`}
      <div class="ga-reveal-actions"><button type="button" class="btn primary full" data-rv="close">확인</button></div>
    </div>
  </div>`;
  box.onclick = e => { if (e.target.closest('[data-rv]') || e.target === box) box.remove(); };
  document.body.appendChild(box);
  requestAnimationFrame(() => box.classList.add('open'));
  box.querySelector('[data-rv="close"]').focus({ preventScroll: true });
}
// Aura -> frame (saved with the rest of the pet style), title -> equipped.
async function wear(A, key) {
  const item = GACHA_ITEMS[key], p = A.data.profile;
  if (item.kind === 'title') {
    await api('/profile/title', { key: item.title });
    if (A.data.titles) A.data.titles.equipped = item.title;
    p.avatar_title = item.title;
    return;
  }
  const style = { avatar_key: p.avatar_key, avatar_accessory: p.avatar_accessory || 'none', avatar_frame: p.avatar_frame || 'basic', avatar_title: titleState(A).equipped };
  style.avatar_frame = item.wear;
  const saved = await api('/profile/style', style);
  Object.assign(p, { avatar_accessory: saved.avatar_accessory, avatar_frame: saved.avatar_frame });
}
function oddsModal() {
  const avg = LUCKY_ODDS.reduce((n, o) => n + o.mult * o.rate, 0);
  modal(`<h2>코인 뽑기 확률</h2><p>뽑을 때마다 아래 확률로 나와요. 앞에 뽑은 결과와 상관없이 매번 같아요.</p>
    <ul class="ga-odds-list">${LUCKY_ODDS.map(o => `<li><span>${o.mult === 1 ? '본전 (1배)' : o.mult ? `${o.mult}배` : '꽝'} <small>${o.mult ? `건 코인의 ${o.mult}배를 받아요` : '건 코인을 잃어요'}</small></span><b>${o.rate}%</b></li>`).join('')}</ul>
    <p class="ga-note">100코인을 걸면 평균 ${num(avg)}코인이 돌아와요. 코인은 공부로 모으는 게 가장 좋아요! 하루 ${LUCKY_DAILY}번까지 뽑을 수 있어요.</p>`, '코인 뽑기 확률');
}
function itemModal(A, key) {
  const item = GACHA_ITEMS[key], owned = Number(rewards(A).gacha.items?.[key] || 0);
  if (!owned) return;
  const close = modal(`<div class="ga-item-modal">${capsuleArt(A, key, 'lg')}${tierTag(item.tier)}<h2>${esc(item.name)}</h2><p>${esc(item.desc)}</p><small>${GACHA_KINDS[item.kind]}</small><button type="button" class="btn primary full" id="ga-wear">${item.kind === 'title' ? '칭호 달기' : '착용하기'}</button></div>`, '모은 꾸미기');
  document.getElementById('ga-wear').onclick = async e => {
    e.currentTarget.disabled = true;
    try { await wear(A, key); close(); toast(`${item.name}을(를) ${item.kind === 'title' ? '달았어요' : '착용했어요'}!`); draw(); }
    catch (err) { toast(err.message); }
  };
}

/* double chance */
function applyChance(A, res) {
  rewards(A).chance = res.chance;
  DC.receivedAt = Date.now();
  setBalance(A, res.points_balance);
}
async function startChance(A, button) {
  button.disabled = true;
  try {
    const res = await api('/chance/start', { bet: DC.bet });
    DC.result = null; DC.typed = [];
    applyChance(A, res);
  } catch (err) { toast(err.message); }
  drawChance();
}
async function answerChance(A, answer, button) {
  if (DC.busy) return;
  DC.busy = true;
  clearInterval(DC.timer);
  document.querySelectorAll('#dc-card .dc-opt, #dc-card .yb-key').forEach(b => { b.disabled = true; });
  if (button) button.classList.add('picked');
  try {
    const res = await api('/chance/answer', { answer });
    applyChance(A, res);
    DC.result = res; DC.typed = [];
    if (button && typeof answer === 'number') {
      button.classList.add(res.right ? 'right' : 'wrong');
      if (!res.right && Number.isInteger(res.reveal?.right_option)) document.querySelector(`#dc-card .dc-opt[data-choice="${res.reveal.right_option}"]`)?.classList.add('right');
      await new Promise(resolve => setTimeout(resolve, reduced() ? 0 : 750));
    }
  } catch (err) { toast(err.message); }
  DC.busy = false;
  drawChance();
}
async function decideChance(A, go, button) {
  button.disabled = true;
  try {
    const res = await api('/chance/decide', { go });
    applyChance(A, res);
    DC.result = go ? null : res; DC.typed = [];
  } catch (err) { toast(err.message); }
  drawChance();
}
function runTimer() {
  clearInterval(DC.timer);
  const live = rewards(current.A).chance?.live;
  if (live?.status !== 'question') return;
  // The server sends the time left when it answered; count down from then.
  const q = live.question, ends = DC.receivedAt + Math.min(q.ms, Number(q.left ?? q.ms));
  const total = q.ms;
  const tickTime = () => {
    const left = Math.max(0, ends - Date.now());
    const t = document.getElementById('dc-time'), bar = document.getElementById('dc-timebar');
    if (!t) return clearInterval(DC.timer);
    t.textContent = `${Math.ceil(left / 1000)}초`;
    bar.style.transform = `scaleX(${Math.min(1, left / total)})`;
    bar.parentElement.classList.toggle('warn', left < 4000);
    if (left <= 0) { clearInterval(DC.timer); answerChance(current.A, q.kind === 'spell' ? '-' : -1, null); }
  };
  tickTime();
  DC.timer = setInterval(tickTime, 200);
}
function spellKey(key) {
  const q = rewards(current.A).chance?.live?.question;
  if (!q || q.kind !== 'spell' || DC.busy) return;
  if (key === 'back') DC.typed.pop();
  else if (/^[a-z]$/.test(key) && DC.typed.length < blanks(q)) DC.typed.push(key);
  else return;
  const slots = document.getElementById('dc-slots'); if (slots) slots.innerHTML = slotsHtml(q);
  const go = document.getElementById('dc-go'); if (go) go.disabled = DC.typed.length !== blanks(q);
}
function spellSubmit(A) {
  const q = rewards(A).chance?.live?.question;
  if (!q || q.kind !== 'spell' || DC.typed.length !== blanks(q)) return;
  answerChance(A, spelled(q), null);
}
let keysHooked = false;
function hookKeys() {
  if (keysHooked) return;
  keysHooked = true;
  window.addEventListener('keydown', event => {
    if (!document.getElementById('dc-spell') || event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.key === 'Enter') { event.preventDefault(); return spellSubmit(current.A); }
    const key = event.key === 'Backspace' ? 'back' : event.key.toLowerCase();
    if (key === 'back' || /^[a-z]$/.test(key)) { event.preventDefault(); spellKey(key); }
  });
}

// The stamp moment after today's attendance: a big stamp, the coins, and the ticket on the 7th.
export function attendanceMoment(res, onArcade) {
  const box = document.createElement('div');
  box.className = `att-moment${reduced() ? ' still' : ''}`;
  box.innerHTML = `<div class="att-moment-card" role="dialog" aria-modal="true" aria-label="출석 완료">
    <div class="att-moment-stamp" aria-hidden="true"><span>출석</span><b>${res.stamp}</b></div>
    <h2>출석 완료!</h2>
    <p class="att-moment-coins">${coin()}+${num(res.coins)}</p>
    ${res.tickets ? `<p class="att-moment-ticket">7번째 도장 보너스 · <b>뽑기권 ${res.tickets}장</b>을 받았어요!</p>` : `<p>${res.attendance.streak >= 2 ? `${res.attendance.streak}일 연속 출석 중!` : '내일 또 도장을 찍어요.'} 내일은 ${coin()}${num(res.attendance.next)}</p>`}
    <div class="att-moment-actions">${res.tickets ? '<button type="button" class="btn primary full" data-att="arcade">뽑으러 가기</button>' : ''}<button type="button" class="btn full${res.tickets ? '' : ' primary'}" data-att="close">확인</button></div>
  </div>`;
  box.onclick = e => {
    const b = e.target.closest('[data-att]');
    if (!b && e.target !== box) return;
    box.remove();
    if (b?.dataset.att === 'arcade') onArcade?.();
  };
  document.body.appendChild(box);
  requestAnimationFrame(() => box.classList.add('open'));
  box.querySelector('[data-att]').focus({ preventScroll: true });
}
