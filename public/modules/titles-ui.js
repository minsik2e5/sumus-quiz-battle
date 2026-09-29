import { $, api, esc, num, toast, icon, modal, buttonBusy } from './ui.js';
import { TITLES, TITLE_TIERS, TITLE_GROUPS, TITLE_KEYS, LEAGUE_TIERS, titleProgress } from './titles.js';
import { titleEmblem, titleBadge } from './emblems.js';

// V13.66 title collection (칭호 도감): the page, one title's card, and the moment a new title
// is won. The server decides what is unlocked (bootstrap `titles`); this module only draws it.

const TIER_ORDER = ['common', 'rare', 'epic', 'legendary', 'limited'];
const byTier = keys => [...keys].sort((a, b) => TITLE_TIERS[TITLES[a].tier].order - TITLE_TIERS[TITLES[b].tier].order || TITLE_KEYS.indexOf(a) - TITLE_KEYS.indexOf(b));
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
export const titleState = A => A.data?.titles || { equipped: 'rookie', unlocked: ['rookie'], stats: {}, fresh: [], intro: false };
export const titleCount = A => `${titleState(A).unlocked.length}/${TITLE_KEYS.length}`;

// "333 / 500", or for the league title the best tier so far.
const progressText = (key, prog) => TITLES[key].stat === 'league_best' ? `최고 ${LEAGUE_TIERS[prog[0]]?.name || '브론즈'}` : `${num(prog[0])} / ${num(prog[1])}`;
function titleCard(key, t, have) {
  const item = TITLES[key], on = have.has(key), equipped = t.equipped === key;
  const prog = on ? null : titleProgress(key, t.stats);
  const pct = prog ? Math.round(prog[0] / prog[1] * 100) : 0;
  const foot = prog
    ? `<span class="tt-prog" aria-hidden="true"><i style="width:${pct}%"></i></span><span class="tt-prog-num">${progressText(key, prog)}</span>`
    : equipped ? '<span class="tt-tier-tag equipped">장착 중</span>' : `<span class="tt-tier-tag tier-${item.tier}">${TITLE_TIERS[item.tier].name}</span>`;
  return `<button type="button" class="tt-card tier-${item.tier}${on ? ' is-on' : ''}${equipped ? ' is-equipped' : ''}" data-title-open="${key}" aria-label="${esc(item.name)} · ${TITLE_TIERS[item.tier].name} 칭호 · ${equipped ? '달고 있어요' : on ? '얻었어요' : '아직 잠겨 있어요'}">
    ${titleEmblem(key, { size: 'md', locked: !on })}
    <b>${esc(item.name)}</b>
    <small>${esc(item.how)}</small>
    ${foot}
  </button>`;
}

export function titlesPage(A) {
  const t = titleState(A), have = new Set(t.unlocked);
  const filter = TITLE_GROUPS[A.titleFilter] ? A.titleFilter : 'all';
  const keys = byTier(TITLE_KEYS).filter(key => filter === 'all' || TITLES[key].group === filter);
  const eq = TITLES[t.equipped] || TITLES.rookie;
  const pct = Math.round(have.size / TITLE_KEYS.length * 100);
  const chips = TIER_ORDER.map(tier => {
    const all = TITLE_KEYS.filter(key => TITLES[key].tier === tier);
    return `<span class="tt-tier-chip tier-${tier}"><span><i aria-hidden="true"></i>${TITLE_TIERS[tier].name}</span><b>${all.filter(key => have.has(key)).length}/${all.length}</b></span>`;
  }).join('');
  return `<div class="study-subhead"><button class="study-back" data-go="home">${icon('back')} 홈</button><span class="pill green">TITLES</span></div>
    <div class="page-heading tt-page-head"><span class="premium-eyebrow">TITLE COLLECTION</span><h1>칭호 도감</h1><p>칭호를 달면 랭킹·야차전·도전장에서 친구들에게 보여요.</p></div>
    <section class="tt-hero tier-${eq.tier}">
      <button type="button" class="tt-hero-medal" data-title-open="${t.equipped}" aria-label="달고 있는 칭호 ${esc(eq.name)} 자세히 보기">${titleEmblem(t.equipped, { size: 'lg' })}</button>
      <div class="tt-hero-copy"><small>지금 달고 있는 칭호</small>${titleBadge(t.equipped, { size: 'md' })}<span>${esc(eq.desc)}</span></div>
      <div class="tt-hero-count" role="img" aria-label="칭호 ${have.size}개 모음, 전체 ${TITLE_KEYS.length}개" style="--p:${pct}"><b>${have.size}</b><span>/${TITLE_KEYS.length}</span></div>
    </section>
    <div class="tt-tier-row">${chips}</div>
    <div class="segment tt-filter" role="group" aria-label="칭호 종류">${[['all', '전체'], ...Object.entries(TITLE_GROUPS)].map(([key, label]) => `<button type="button" data-title-filter="${key}" class="${filter === key ? 'selected' : ''}" aria-pressed="${filter === key}">${label}</button>`).join('')}</div>
    <div class="tt-grid">${keys.map(key => titleCard(key, t, have)).join('')}</div>
    <p class="quiet-note">야차전 승리는 같은 친구에게 하루 3번까지만 칭호·리그에 세어요. 한정 칭호는 지난주 기록으로 받아서 이번 주 일요일 밤까지만 달 수 있어요.</p>`;
}

export async function equipTitle(A, key) {
  await api('/profile/title', { key });
  if (A.data?.titles) A.data.titles.equipped = key;
  if (A.data?.profile) A.data.profile.avatar_title = key;
}

// One title up close: how to get it, progress, how friends see it, and equipping it.
export function openTitleDetail(A, key, onChanged) {
  const item = TITLES[key];
  if (!item) return;
  const t = titleState(A), on = t.unlocked.includes(key), equipped = t.equipped === key;
  const prog = on ? null : titleProgress(key, t.stats);
  const close = modal(`<div class="tt-detail tier-${item.tier}${on ? '' : ' is-locked'}">
      <div class="tt-detail-stage">${on ? '<span class="tt-rays" aria-hidden="true"></span>' : ''}${titleEmblem(key, { size: 'xl', preview: !on })}</div>
      <span class="tt-ribbon tier-${item.tier}">${TITLE_TIERS[item.tier].name} 칭호</span>
      <h2>${esc(item.name)}</h2>
      <p class="tt-detail-desc">${esc(item.desc)}</p>
      <div class="tt-detail-how ${on ? 'done' : ''}">${icon(on ? 'check' : 'lock')}<span>${esc(item.how)}</span></div>
      ${prog ? `<div class="tt-detail-prog"><span class="tt-prog"><i style="width:${Math.round(prog[0] / prog[1] * 100)}%"></i></span><b>${progressText(key, prog)}</b></div>` : ''}
      ${item.tier === 'limited' ? `<p class="tt-detail-note">${on ? '이번 주 일요일 밤까지 달 수 있어요.' : '지난주 기록으로 주어지는 한정 칭호예요. 이번 주에 도전하면 다음 주에 받을 수 있어요.'}</p>` : ''}
      <div class="tt-detail-preview"><small>친구에게는 이렇게 보여요</small>${titleBadge(key, { size: 'md' })}</div>
      <button type="button" class="btn primary full" id="tt-equip" ${!on || equipped ? 'disabled' : ''}>${equipped ? '지금 달고 있어요' : on ? '이 칭호 달기' : '아직 얻지 못했어요'}</button>
    </div>`, `${item.name} 칭호`);
  $('#tt-equip').onclick = async event => {
    const button = event.currentTarget;
    buttonBusy(button);
    try { await equipTitle(A, key); close(); toast(`'${item.name}' 칭호를 달았어요!`); onChanged?.(); }
    catch (err) { toast(err.message); buttonBusy(button, false); }
  };
}

/* ---------- the moment a title is won ---------- */
let momentOpen = false, waiting = null;
function sparkles(box, count = 22) {
  const colors = ['#ffd85a', '#fff4b8', '#12b886', '#ff9fd0', '#8fd3ff', '#b98bff'];
  box.innerHTML = Array.from({ length: count }, (_, i) => {
    const a = i / count * Math.PI * 2 + Math.random() * .4, d = 90 + Math.random() * 80;
    return `<i style="--c:${colors[i % colors.length]};--dx:${Math.cos(a) * d}px;--dy:${Math.sin(a) * d}px;--s:${6 + Math.random() * 9}px;--r:${Math.random() * 360}deg;--t:${Math.random() * 120}ms"></i>`;
  }).join('');
}
function overlay(label, tier) {
  $('#modal-root').innerHTML = `<div class="modal-backdrop tt-moment-backdrop"><section class="modal tt-moment tier-${tier}" role="dialog" aria-modal="true" aria-label="${esc(label)}"><button type="button" class="icon-button modal-close" data-tt-close aria-label="닫기">${icon('close')}</button><div class="tt-moment-body"></div></section></div>`;
  $('.tt-moment').onkeydown = event => { if (event.key === 'Escape') $('[data-tt-close]')?.click(); };
  return $('.tt-moment-body');
}
function closeOverlay() { $('#modal-root').innerHTML = ''; momentOpen = false; }
function markSeen(A, body) {
  api('/titles/seen', body).catch(() => {});
  const t = A.data?.titles;
  if (!t) return;
  if (body.all) { t.intro = false; t.fresh = []; }
  else t.fresh = (t.fresh || []).filter(key => !body.keys.includes(key));
}

// First look at the V13.66 collection: one summary of everything already won.
function introMoment(A, onChanged) {
  const t = titleState(A);
  const best = byTier(t.unlocked).reverse().slice(0, 8);
  const body = overlay('칭호 도감', 'legendary');
  body.innerHTML = `<div class="tt-intro">
    <span class="tt-moment-kicker">NEW · 칭호 도감</span>
    <h2>칭호 도감이 열렸어요!</h2>
    <p>지금까지의 기록으로 <b>${t.unlocked.length}개</b>의 칭호를 모았어요.</p>
    <div class="tt-intro-grid">${best.map((key, i) => `<span style="--i:${i}">${titleEmblem(key, { size: 'md' })}<small>${esc(TITLES[key].name)}</small></span>`).join('')}</div>
    <p class="tt-intro-copy">모두 ${TITLE_KEYS.length}개! 칭호를 달면 랭킹·야차전·도전장에서 친구들에게 보여요.</p>
    <div class="pet-moment-actions"><button type="button" class="btn" data-tt-done>좋아요</button><button type="button" class="btn primary" data-tt-open>칭호 도감 보기</button></div>
  </div>`;
  const done = open => { markSeen(A, { all: true }); closeOverlay(); if (open) { A.tab = 'titles'; onChanged?.(true); } };
  $('[data-tt-close]').onclick = () => done(false);
  body.querySelector('[data-tt-done]').onclick = () => done(false);
  body.querySelector('[data-tt-open]').onclick = () => done(true);
  body.querySelector('[data-tt-open]').focus({ preventScroll: true });
}

function unlockMoment(A, keys, onChanged) {
  let index = 0, equippedNow = false;
  const finish = () => { markSeen(A, { keys }); closeOverlay(); if (equippedNow) onChanged?.(false); };
  const show = () => {
    const key = keys[index], item = TITLES[key], last = index === keys.length - 1;
    const body = overlay('새 칭호', item.tier);
    $('.tt-moment').className = `modal tt-moment tier-${item.tier}`;
    body.innerHTML = `<div class="tt-unlock" data-state="${reduced() ? 'shown' : 'enter'}">
      <div class="tt-moment-stage"><span class="tt-rays" aria-hidden="true"></span><span class="tt-glow" aria-hidden="true"></span><div class="tt-moment-medal">${titleEmblem(key, { size: 'xl' })}</div><div class="tt-bits" aria-hidden="true"></div></div>
      <span class="tt-moment-kicker">새 칭호 획득!</span>
      <span class="tt-ribbon tier-${item.tier}">${TITLE_TIERS[item.tier].name} 칭호</span>
      <h2>${esc(item.name)}</h2>
      <p>${esc(item.how)} 달성!</p>
      ${keys.length > 1 ? `<span class="tt-moment-count">${index + 1} / ${keys.length}</span>` : ''}
      <div class="pet-moment-actions"><button type="button" class="btn" data-tt-next>${last ? '닫기' : '다음 칭호'}</button><button type="button" class="btn primary" data-tt-equip>바로 달기</button></div>
    </div>`;
    const scene = body.querySelector('.tt-unlock');
    if (!reduced()) {
      requestAnimationFrame(() => requestAnimationFrame(() => { scene.dataset.state = 'shown'; sparkles(body.querySelector('.tt-bits')); }));
      try { navigator.vibrate?.(item.tier === 'legendary' || item.tier === 'limited' ? [40, 60, 90] : 40); } catch {}
    }
    const next = () => { if (last) finish(); else { index++; show(); } };
    $('[data-tt-close]').onclick = finish;
    body.querySelector('[data-tt-next]').onclick = next;
    const equip = body.querySelector('[data-tt-equip]');
    if (titleState(A).equipped === key) { equip.disabled = true; equip.textContent = '달고 있어요'; }
    equip.onclick = async () => {
      buttonBusy(equip);
      try { await equipTitle(A, key); equippedNow = true; toast(`'${item.name}' 칭호를 달았어요!`); next(); }
      catch (err) { toast(err.message); buttonBusy(equip, false); }
    };
    equip.focus({ preventScroll: true });
  };
  show();
}

// Called after each student render on the home tab. When another pop-up is open (a pet
// hatching, the wallet), it waits for it to close.
export function maybeTitleMoment(A, onChanged) {
  const t = A.data?.titles;
  if (!t || momentOpen || A.screen || A.tab !== 'home' || A.data.profile?.role !== 'student' || A.data.stats?.needs_pet_pick) return;
  const fresh = byTier((t.fresh || []).filter(key => TITLES[key] && t.unlocked.includes(key)));
  if (!t.intro && !fresh.length) return;
  const root = $('#modal-root');
  if (root.children.length) {
    if (waiting) return;
    waiting = new MutationObserver(() => {
      if (root.children.length) return;
      waiting.disconnect(); waiting = null;
      setTimeout(() => maybeTitleMoment(A, onChanged), 350);
    });
    waiting.observe(root, { childList: true });
    return;
  }
  momentOpen = true;
  if (t.intro) introMoment(A, onChanged);
  else unlockMoment(A, fresh.slice(0, 5), onChanged);
}
