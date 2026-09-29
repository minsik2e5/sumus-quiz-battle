import { api, esc, num, icon, toast, modal } from './ui.js';
import { avatar, GACHA_BADGE_ICONS } from './character.js';
import { GACHA_ITEMS, GACHA_KEYS, GACHA_TIERS, GACHA_TIER_KEYS, GACHA_PRICE, GACHA_PITY, GACHA_KINDS, CHANCE_BETS, CHANCE_STEPS, CHANCE_DAILY } from './rewards.js';
import { titleEmblem, coin } from './emblems.js';
import { TITLES } from './titles.js';
import { titleState } from './titles-ui.js';
import { CHARACTERS, EGG_PRICE } from './core.js';

// V13.67 코인 놀이터: the capsule machine (뽑기), its collection and the word double chance
// (더블 찬스). The server decides everything (server/rewards.mjs); this module draws the page in
// `[data-arcade]` and keeps it up to date without redrawing the whole app.

const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const KEY_ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'];
// Capsules piled in the dome (left, bottom in px).
const BALL_SPOTS = [[6, 2], [30, 1], [54, 3], [78, 2], [16, 22], [42, 24], [66, 21], [28, 44], [54, 45]];
const rewards = A => A.data.rewards ||= { attendance: null, gacha: { items: {}, pulls: 0, tickets: 0, since_rare: 0 }, chance: null };
const byTier = keys => [...keys].sort((a, b) => GACHA_TIER_KEYS.indexOf(GACHA_ITEMS[b].tier) - GACHA_TIER_KEYS.indexOf(GACHA_ITEMS[a].tier) || GACHA_KEYS.indexOf(a) - GACHA_KEYS.indexOf(b));

// The coin chip in the header follows every change here.
function setBalance(A, balance) {
  if (typeof balance !== 'number') return;
  A.data.stats.points_balance = balance;
  document.querySelectorAll('.coin-chip-v1366 b').forEach(b => { b.textContent = num(balance); });
  const wallet = document.getElementById('ga-balance'); if (wallet) wallet.textContent = num(balance);
}

// What a capsule looks like: an aura on the student's own pet, a badge, or the title's medal.
export function capsuleArt(A, key, size = 'md') {
  const item = GACHA_ITEMS[key];
  if (!item) return '';
  if (item.kind === 'aura') {
    const pet = A.data.stats?.pet;
    return `<span class="ga-art aura ${size}">${avatar(pet?.key || 'dog', { form: Math.max(1, pet?.form ?? 1), frame: item.wear, size: size === 'sm' ? 'mini' : '' })}</span>`;
  }
  if (item.kind === 'badge') return `<span class="ga-art badge ${size} gb-${item.wear}"><svg viewBox="0 0 24 24">${GACHA_BADGE_ICONS[item.wear] || ''}</svg></span>`;
  return `<span class="ga-art title ${size}">${titleEmblem(item.title, { size: size === 'lg' ? 'lg' : 'md' })}</span>`;
}
const tierTag = tier => `<span class="ga-tier t-${tier}">${GACHA_TIERS[tier].name}</span>`;

/* ---------- page ---------- */
export function arcadePage(A) {
  return `<div class="page-heading arcade-head"><span class="premium-eyebrow">COIN ARCADE</span><h1>놀이터</h1><p>모은 코인으로 뽑기·더블 찬스·알 상점을 즐겨요.</p></div>
    <button type="button" class="arcade-wallet" data-action="coins" aria-label="코인 지갑 열기"><span>${coin()}<b id="ga-balance">${num(A.data.stats?.points_balance || 0)}</b> 코인</span><small>코인 지갑 ${icon('chevron')}</small></button>
    <div data-arcade></div>`;
}
// V13.68: the capsule collection lives under 나.
export function gachaBookPage() {
  return `<button type="button" class="page-back-v1368" data-go="me">${icon('back')}나</button>
    <div class="page-heading arcade-head"><span class="premium-eyebrow">CAPSULE BOOK</span><h1>뽑기 도감</h1><p>뽑기 머신에서만 나오는 오라·배지·칭호예요. 눌러서 착용해요.</p></div>
    <div data-arcade data-arcade-view="book"></div>`;
}
// The pet egg shop and the way to the capsule book, below the games.
function shopHtml(A) {
  const g = A.data.stats || {}, owned = (g.pets || []).length, total = Object.keys(CHARACTERS).length;
  const items = rewards(A).gacha.items || {}, have = GACHA_KEYS.filter(key => items[key] > 0).length;
  return `<section class="ga-card ga-shop">
    <button type="button" class="ga-shop-row" data-action="egg-shop"><span class="ga-egg" aria-hidden="true">?</span><span><b>랜덤 알 상점</b><small>${owned < total ? `아직 못 만난 친구 ${total - owned}마리` : '모든 친구를 모았어요!'}</small></span><em>${coin()}${num(EGG_PRICE)}</em></button>
    <button type="button" class="ga-shop-row" data-go="gachabook"><span class="ga-book-ico" aria-hidden="true">${icon('arcade')}</span><span><b>뽑기 도감</b><small>모은 캡슐 ${have}/${GACHA_KEYS.length}</small></span>${icon('chevron')}</button>
  </section>`;
}
function machineHtml(A) {
  const g = rewards(A).gacha, tickets = Number(g.tickets || 0), since = Number(g.since_rare || 0);
  const balance = Number(A.data.stats?.points_balance || 0);
  const balls = ['#ff8fb1', '#7cc7ff', '#ffd166', '#8ee6b8', '#b69cff', '#ff9f6b', '#6ee7d6', '#ffc1d9', '#9ad0ff'];
  return `<section class="ga-card">
    <div class="ga-top">
      <div class="ga-machine" id="ga-machine" aria-hidden="true">
        <div class="ga-dome">${balls.map((c, i) => `<i style="--c:${c};left:${BALL_SPOTS[i][0]}px;bottom:${BALL_SPOTS[i][1]}px;transform:rotate(${i * 37}deg)"></i>`).join('')}<span class="ga-shine"></span></div>
        <div class="ga-body"><span class="ga-brand">SUMUS</span><span class="ga-knob"><i></i></span><span class="ga-slot"></span></div>
      </div>
      <div class="ga-side">
        <h2>뽑기 머신</h2>
        <p>뽑기에서만 나오는 <b>오라·배지·칭호</b>를 모아요.</p>
        <button type="button" class="btn primary full ga-pull" data-ga="pull" ${balance < GACHA_PRICE ? 'disabled' : ''}>뽑기 1회 <span>${coin()}${GACHA_PRICE}</span></button>
        <button type="button" class="btn full ga-ticket" data-ga="ticket" ${tickets ? '' : 'disabled'}>뽑기권 쓰기 <span>${tickets}장</span></button>
      </div>
    </div>
    <div class="ga-odds">${GACHA_TIER_KEYS.map(tier => `<span class="t-${tier}"><i></i>${GACHA_TIERS[tier].name} ${GACHA_TIERS[tier].rate}%</span>`).join('')}<button type="button" data-ga="odds">확률 자세히</button></div>
    <div class="ga-pity"><span>희귀 이상 보장까지</span><span class="ga-pity-bar"><i style="width:${Math.round(Math.min(since, GACHA_PITY - 1) / (GACHA_PITY - 1) * 100)}%"></i></span><b>${Math.max(1, GACHA_PITY - since)}번</b></div>
    <p class="ga-note">같은 걸 또 뽑으면 코인을 돌려받아요 (일반 ${GACHA_TIERS.common.refund} · 희귀 ${GACHA_TIERS.rare.refund} · 영웅 ${GACHA_TIERS.epic.refund} · 전설 ${GACHA_TIERS.legendary.refund}). 뽑기권은 출석 7번째 도장에서 받아요.</p>
  </section>`;
}
function collectionHtml(A) {
  const items = rewards(A).gacha.items || {};
  const have = GACHA_KEYS.filter(key => items[key] > 0).length;
  const p = A.data.profile;
  const worn = key => { const item = GACHA_ITEMS[key]; return item.kind === 'aura' ? p.avatar_frame === item.wear : item.kind === 'badge' ? p.avatar_accessory === item.wear : titleState(A).equipped === item.title; };
  return `<section class="ga-card ga-book">
    <div class="ga-book-head"><h2>뽑기 도감</h2><b>${have}<small>/${GACHA_KEYS.length}</small></b></div>
    <div class="ga-grid">${byTier(GACHA_KEYS).map(key => {
      const item = GACHA_ITEMS[key], on = items[key] > 0;
      return `<button type="button" class="ga-item t-${item.tier}${on ? ' on' : ''}${on && worn(key) ? ' worn' : ''}" data-ga="item" data-key="${key}" aria-label="${esc(on ? item.name : '아직 못 뽑은 캡슐')} · ${GACHA_TIERS[item.tier].name} ${GACHA_KINDS[item.kind]}">
        ${on ? capsuleArt(A, key, 'sm') : '<span class="ga-art locked sm">?</span>'}
        <b>${on ? esc(item.name) : '???'}</b><small>${GACHA_TIERS[item.tier].name} ${GACHA_KINDS[item.kind]}${on && items[key] > 1 ? ` ×${items[key]}` : ''}</small>
        ${on && worn(key) ? '<i class="ga-worn">착용 중</i>' : ''}
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
    r.attendance = res.attendance; r.gacha = res.gacha; r.chance = res.chance;
    A.data.stats.gacha = res.gacha.items;
    DC.receivedAt = Date.now();
    setBalance(A, res.points_balance);
    draw();
  }).catch(() => {});
  el.addEventListener('click', event => {
    const g = event.target.closest('[data-ga]'), d = event.target.closest('[data-dc]');
    if (g && !g.disabled) {
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

/* capsule machine */
async function pull(A, ticket, button) {
  if (current?.busy) return;
  current.busy = true;
  button.disabled = true;
  const machine = document.getElementById('ga-machine');
  machine?.classList.add('spinning');
  const wait = new Promise(resolve => setTimeout(resolve, reduced() ? 0 : 1100));
  try {
    const [res] = await Promise.all([api('/gacha/pull', { ticket }), wait]);
    rewards(A).gacha = res.gacha;
    A.data.stats.gacha = res.gacha.items;
    setBalance(A, res.points_balance);
    if (res.item.kind === 'title') {
      const t = A.data.titles;
      if (t && !t.unlocked.includes(res.item.title)) t.unlocked.push(res.item.title);
      api('/titles/seen', { keys: [res.item.title] }).catch(() => {});
    }
    machine?.classList.remove('spinning');
    machine?.classList.add('drop');
    await new Promise(resolve => setTimeout(resolve, reduced() ? 0 : 450));
    reveal(A, res);
  } catch (err) { toast(err.message); }
  finally { current.busy = false; machine?.classList.remove('spinning', 'drop'); draw(); }
}
function reveal(A, res) {
  const item = res.item, tier = res.tier;
  const box = document.createElement('div');
  box.className = `ga-reveal t-${tier}${reduced() ? ' still' : ''}`;
  box.innerHTML = `<div class="ga-reveal-card" role="dialog" aria-modal="true" aria-label="${esc(item.name)} 뽑음">
    <div class="ga-capsule" aria-hidden="true"><i class="top"></i><i class="bottom"></i></div>
    <div class="ga-reveal-body">
      <div class="ga-rays" aria-hidden="true"></div>
      ${capsuleArt(A, res.key, 'lg')}
      ${tierTag(tier)}
      <h2>${esc(item.name)}</h2>
      <p>${esc(item.desc)}</p>
      ${res.dup ? `<p class="ga-dup">이미 가진 캡슐이라 ${coin()}${num(res.refund)}을 돌려받았어요.</p>` : res.pity ? '<p class="ga-dup">10번째 보장! 희귀 이상이 나왔어요.</p>' : '<p class="ga-new">NEW! 뽑기 도감에 모였어요.</p>'}
      <div class="ga-reveal-actions">
        <button type="button" class="btn primary full" data-rv="wear">${item.kind === 'title' ? '칭호 달기' : '바로 착용'}</button>
        <button type="button" class="btn full" data-rv="close">확인</button>
      </div>
    </div>
  </div>`;
  const close = () => box.remove();
  box.onclick = async e => {
    const b = e.target.closest('[data-rv]'); if (!b) { if (e.target === box) close(); return; }
    if (b.dataset.rv === 'close') return close();
    b.disabled = true;
    try { await wear(A, res.key); toast(`${item.name}을(를) ${item.kind === 'title' ? '달았어요' : '착용했어요'}!`); close(); draw(); }
    catch (err) { toast(err.message); b.disabled = false; }
  };
  document.body.appendChild(box);
  requestAnimationFrame(() => box.classList.add('open'));
  box.querySelector('[data-rv="close"]').focus({ preventScroll: true });
}
// Aura -> frame, badge -> accessory (saved with the rest of the pet style), title -> equipped.
async function wear(A, key) {
  const item = GACHA_ITEMS[key], p = A.data.profile;
  if (item.kind === 'title') {
    await api('/profile/title', { key: item.title });
    if (A.data.titles) A.data.titles.equipped = item.title;
    p.avatar_title = item.title;
    return;
  }
  const style = { avatar_key: p.avatar_key, avatar_accessory: p.avatar_accessory || 'none', avatar_frame: p.avatar_frame || 'basic', avatar_title: titleState(A).equipped };
  if (item.kind === 'aura') style.avatar_frame = item.wear; else style.avatar_accessory = item.wear;
  const saved = await api('/profile/style', style);
  Object.assign(p, { avatar_accessory: saved.avatar_accessory, avatar_frame: saved.avatar_frame });
}
function oddsModal() {
  const rows = GACHA_TIER_KEYS.map(tier => {
    const keys = GACHA_KEYS.filter(key => GACHA_ITEMS[key].tier === tier), each = GACHA_TIERS[tier].rate / keys.length;
    return `<h3 class="ga-odds-h t-${tier}">${GACHA_TIERS[tier].name} ${GACHA_TIERS[tier].rate}%</h3><ul class="ga-odds-list">${keys.map(key => `<li><span>${esc(GACHA_ITEMS[key].name)} <small>${GACHA_KINDS[GACHA_ITEMS[key].kind]}</small></span><b>${each.toFixed(2)}%</b></li>`).join('')}</ul>`;
  }).join('');
  modal(`<h2>뽑기 확률</h2><p>캡슐 하나마다 아래 확률로 나와요. 같은 등급 안에서는 모두 똑같은 확률이에요. 희귀 이상이 ${GACHA_PITY - 1}번 연속 안 나오면 ${GACHA_PITY}번째는 희귀 이상이 나와요.</p>${rows}`, '뽑기 확률');
}
function itemModal(A, key) {
  const item = GACHA_ITEMS[key], owned = Number(rewards(A).gacha.items?.[key] || 0);
  if (!owned) return modal(`<div class="ga-item-modal"><span class="ga-art locked lg">?</span>${tierTag(item.tier)}<h2>아직 못 뽑은 캡슐</h2><p>${GACHA_TIERS[item.tier].name} ${GACHA_KINDS[item.kind]} · 뽑기 머신에서 나와요.</p></div>`, '뽑기 도감');
  const close = modal(`<div class="ga-item-modal">${capsuleArt(A, key, 'lg')}${tierTag(item.tier)}<h2>${esc(item.name)}</h2><p>${esc(item.desc)}</p><small>${GACHA_KINDS[item.kind]} · ${owned}개 가지고 있어요</small><button type="button" class="btn primary full" id="ga-wear">${item.kind === 'title' ? '칭호 달기' : '착용하기'}</button></div>`, '뽑기 도감');
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
