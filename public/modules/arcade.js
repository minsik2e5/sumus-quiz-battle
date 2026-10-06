import { api, esc, num, icon, toast, modal } from './ui.js';
import { avatar } from './character.js';
import { GACHA_ITEMS, GACHA_KEYS, GACHA_TIERS, GACHA_TIER_KEYS, GACHA_KINDS, ownedDecorations, LUCKY_BETS, LUCKY_DAILY, LUCKY_ODDS, LUCKY_TICKET_BET, LEGENDARY_RATE, LEGENDARY_PITY } from './rewards.js';
import { titleEmblem, coin, uiArt, artOr, ART_READY } from './emblems.js';
import { TITLES } from './titles.js';
import { titleState } from './titles-ui.js';
import { CHARACTERS, STANDARD_PET_KEYS, EPIC_PET_KEYS, EGG_PRICE, EPIC_EGG_PRICE } from './core.js';
import { luckyCard, luckyShow, machineSpin, machineDrop, unlockSound } from './lucky.js';
import { rpsCard, rpsMatch } from './rps.js';
import { stocksCard, loadMarket, openStock, startStockClock } from './stocks.js';
import { RPS_BETS } from './rewards.js';

// 놀이터: the coin capsule (코인 뽑기, V13.68) and the egg shop, plus the decorations kept from the retired V13.67 capsule machine (모은 꾸미기, under 나). The server
// decides everything (server/rewards.mjs); this module draws `[data-arcade]` and keeps it up to
// date without redrawing the whole app.

const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
// Capsules piled in the dome (left, bottom in px).
const rewards = A => A.data.rewards ||= { attendance: null, gacha: { items: {}, tickets: 0 }, lucky: null };
const luckyState = A => rewards(A).lucky || { bets: LUCKY_BETS, daily: LUCKY_DAILY, left: LUCKY_DAILY, odds: LUCKY_ODDS, tickets: Number(rewards(A).gacha?.tickets || 0) };

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
  return `<div class="page-heading arcade-head">${uiArt('arcade', 'arcade-head-art')}<span class="premium-eyebrow">COIN ARCADE</span><h1>놀이터</h1><p>모은 코인으로 코인 뽑기, 가위바위보, 알 상점을 즐겨요.</p></div>
    <button type="button" class="arcade-wallet" data-action="coins" aria-label="코인 지갑 열기"><span>${coin()}<b id="ga-balance">${num(A.data.stats?.points_balance || 0)}</b> 코인</span><small>코인 지갑 ${icon('chevron')}</small></button>
    <div data-arcade></div>`;
}
// V13.68: decorations pulled from the retired capsule machine, under 나 (only for their owners).
export function gachaBookPage() {
  return `<button type="button" class="page-back-v1368" data-go="me">${icon('back')}나</button>
    <div class="page-heading arcade-head"><span class="premium-eyebrow">MY COLLECTION</span><h1>모은 꾸미기</h1><p>예전 뽑기 머신에서 모은 오라와 칭호예요. 눌러서 착용해요.</p></div>
    <div data-arcade data-arcade-view="book"></div>`;
}
// V13.107 알 상점: a stand on the page like the capsule machine and 가위바위보, the two eggs side by
// side with their price and a buy button (a second tap buys; see app.js `egg-buy`).
function eggSlot(A, kind) {
  const g = A.data.stats || {}, has = key => (g.pets || []).some(pet => pet.key === key);
  const epic = kind === 'epic', price = epic ? EPIC_EGG_PRICE : EGG_PRICE;
  const missing = (epic ? EPIC_PET_KEYS : STANDARD_PET_KEYS).filter(key => !has(key)).length;
  const hasLegend = (g.pets || []).some(pet => CHARACTERS[pet.key]?.legendary);
  const short = Math.max(0, price - Number(g.points_balance || 0));
  const art = epic ? artOr('epic-egg', '<span class="egg-slot-plain epic">★</span>') : uiArt('egg-shop');
  const label = !missing ? '모두 모았어요' : short ? `<span>${coin()}${num(price)}</span><small>${num(short)}코인 부족</small>` : `<span>${coin()}${num(price)}</span><small>사기</small>`;
  return `<div class="egg-slot ${kind}${!missing ? ' done' : ''}">
    <span class="egg-slot-tag">${epic ? '★ 영웅' : '기본'}</span>
    <div class="egg-slot-art" aria-hidden="true">${art}</div>
    <b class="egg-slot-name">${epic ? '영웅 알' : '랜덤 알'}</b>
    <small class="egg-slot-sub">${missing ? `못 만난 친구 ${missing}마리` : (epic ? '영웅 펫을 다 모았어요' : '기본 펫을 다 모았어요')}</small>
    ${epic && missing && !hasLegend ? '<em class="egg-slot-legend">1% 전설 찬스</em>' : ''}
    <button type="button" class="egg-slot-buy" data-action="egg-buy" data-egg="${kind}" ${!missing || short ? 'disabled' : ''} aria-label="${epic ? '영웅 알' : '랜덤 알'} ${num(price)}코인${short ? `, ${num(short)}코인 부족` : ''}">${label}</button>
  </div>`;
}
function shopHtml(A) {
  return `<section class="egg-stand" id="egg-stand">
    <div class="egg-stand-head"><div><small>PET EGG SHOP</small><h2>알 상점</h2></div><span class="egg-stand-wallet">${coin()}<b>${num(A.data.stats?.points_balance || 0)}</b></span></div>
    <p class="egg-stand-lead">새 알은 바로 파트너가 되고, 함께 공부하면 <b>Lv.3</b>에 태어나요.</p>
    <div class="egg-stand-grid">${eggSlot(A, 'basic')}${eggSlot(A, 'epic')}</div>
    <p class="lk-note">랜덤 알은 아직 못 만난 기본 펫, 영웅 알은 아직 못 만난 영웅 펫이 나와요 · 사기 버튼을 한 번 더 누르면 사요</p>
  </section>`;
}
// V13.68 coin capsule: the machine and its show live in lucky.js.
let luckyBet = LUCKY_BETS[0];
function machineHtml(A) {
  return luckyCard(luckyState(A), luckyBet, Number(A.data.stats?.points_balance || 0));
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

/* ---------- mount and actions ---------- */
let current = null;
export function mountArcade(el, A) {
  if (!el || el.dataset.mounted) return;
  el.dataset.mounted = '1';
  current = { el, A };
  draw();
  // Fresh numbers (attendance may have given a ticket since the app loaded).
  api('/rewards').then(res => {
    if (current?.el !== el || current.busy) return;
    const r = rewards(A);
    r.attendance = res.attendance; r.gacha = res.gacha; r.lucky = res.lucky; r.rps = res.rps; r.market_open = res.market_open; r.bot = res.bot;
    A.data.stats.gacha = res.gacha.items;
    setBalance(A, res.points_balance);
    draw();
  }).catch(() => {});
  el.addEventListener('click', event => {
    const g = event.target.closest('[data-ga]');
    if (g && !g.disabled) {
      if (g.dataset.ga === 'bet') { luckyBet = Number(g.dataset.bet); return draw(); }
      if (g.dataset.ga === 'pull') return pull(A, false, g);
      if (g.dataset.ga === 'ticket') return pull(A, true, g);
      if (g.dataset.ga === 'odds') return oddsModal();
      if (g.dataset.ga === 'item') return itemModal(A, g.dataset.key);
    }
    // V13.82 가위바위보 and 문법 증권거래소.
    const r = event.target.closest('[data-rps]');
    if (r && !r.disabled && !current?.busy) {
      if (r.dataset.rps === 'bet') { rpsBet = Number(r.dataset.bet); return draw(); }
      return playRps(A, r.dataset.rps === 'resume');
    }
    const k = event.target.closest('[data-stk]');
    if (k) return openStock(k.dataset.key, { onBalance: value => setBalance(A, value), onChange: draw });
  });
  // A redraw waits while a capsule or a match is on screen (it would replace the machine).
  const quietDraw = () => { if (!current?.busy) draw(); };
  if (el.dataset.arcadeView !== 'book' && rewards(A).market_open) loadMarket().then(() => { quietDraw(); startStockClock(quietDraw); }).catch(() => {});
}
let rpsBet = RPS_BETS[0];
async function playRps(A, resume) {
  current.busy = true;
  const live = resume ? rewards(A).rps?.live : null;
  await rpsMatch(A, { bet: rpsBet, live, onBalance: value => setBalance(A, value) });
  current.busy = false;
  draw();
}
function draw() {
  if (!current?.el.isConnected) return;
  current.el.innerHTML = current.el.dataset.arcadeView === 'book' ? collectionHtml(current.A) : `${machineHtml(current.A)}${shopHtml(current.A)}${rpsCard(rewards(current.A).rps, rpsBet, Number(current.A.data.stats?.points_balance || 0))}${rewards(current.A).market_open ? stocksCard() : ''}`;
}

/* coin capsule */
async function pull(A, ticket, button) {
  if (current?.busy) return;
  current.busy = true;
  if (button) button.disabled = true;
  unlockSound();
  const machine = document.getElementById('lk-machine');
  try {
    const [res] = await Promise.all([api('/lucky/pull', ticket ? { ticket: true } : { bet: luckyBet }), machineSpin(machine)]);
    rewards(A).lucky = res.lucky;
    if (rewards(A).gacha) rewards(A).gacha.tickets = res.lucky.tickets;
    await machineDrop(machine);
    const balance = Number(res.points_balance);
    if (res.legendary || res.epic) {
      if (res.profile) Object.assign(A.data.profile, res.profile);
      if (res.stats) Object.assign(A.data.stats, res.stats);
    }
    const canAgain = !ticket && res.lucky.left > 0 && balance >= luckyBet;
    // The header coins change only after the show, so the result is not spoiled.
    const again = await luckyShow(res, { again: canAgain, againLabel: `${coin()}${luckyBet}` });
    setBalance(A, balance);
    current.busy = false;
    draw();
    if (again) pull(A, false, null);
    return;
  } catch (err) { toast(err.message); }
  current.busy = false;
  draw();
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
    <p class="ga-note"><b>전설 펫은 별도로 ${LEGENDARY_RATE}%</b> 확률로 나타나요. 아직 전설 펫이 없다면 ${LEGENDARY_PITY}번째 뽑기에는 반드시 만나며, 학생 한 명당 한 마리만 가질 수 있어요.</p>
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
