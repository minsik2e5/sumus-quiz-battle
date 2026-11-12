// V13.234 펫 아레나 랭크 시즌 화면 조각(아레나 입구 카드 · 판 끝 RP 연출 · 랭킹 탭 · 시즌 보상 받기). 클래스는 ark-.
//   규칙은 arena-rank-rules.js(서버와 같은 함수). 그림 69(public/assets/arena/tier-<티어>.webp)가 오면 배지가 그림으로 바뀌고,
//   그 전에는 CSS 배지(티어 색 방패 + 보석 + 단계 숫자)로 완성되어 보인다.
//   렉 방지: 움직임은 transform · opacity만(막대는 scaleX), 효과 조각은 상한(RAYS_MAX), 랭킹은 GET 한 번(1분 안에는 다시 묻지 않음).
import { esc, num } from './ui.js';
import { coin } from './emblems.js';
import { TITLES } from './titles.js';
import { ARENA_ART } from './arena-art.js';
import { RANK, RANK_TIERS, SEASON_COINS, tierOf } from './arena-rank-rules.js';

const RAYS_MAX = 12, SPARKS_MAX = 14;
const STEP_KO = ['III', 'II', 'I'];
const tierName = key => RANK_TIERS.find(t => t.key === key)?.name || '브론즈';

// 배지: size 'sm' | 'md' | 'lg' | 'xl'. step 0 III · 1 II · 2 I(없으면 숫자 없이).
export function rankBadge(key = 'bronze', step = null, size = 'md') {
  const k = RANK_TIERS.some(t => t.key === key) ? key : 'bronze';
  const art = ARENA_ART.has(`tier-${k}`);
  const div = step == null ? '' : `<b class="ark-div">${STEP_KO[step] || ''}</b>`;
  return `<span class="ark-badge ark-${k} ark-${size}${art ? ' has-art' : ''}" role="img" aria-label="${esc(tierName(k))}${step == null ? '' : ` ${STEP_KO[step]}`}">${art
    ? `<img src="/assets/arena/tier-${k}.webp" alt="" width="256" height="256" decoding="async" draggable="false">`
    : '<i class="ark-wing l"></i><i class="ark-wing r"></i><i class="ark-shield"></i><i class="ark-gem"></i><i class="ark-shine"></i>'}${div}</span>`;
}

const bar = (pct, id = '') => `<span class="ark-bar"${id ? ` id="${id}"` : ''}><i style="transform:scaleX(${Math.max(0, Math.min(100, pct)) / 100})"></i></span>`;

// 아레나 입구 카드: 내 티어 배지 · RP 막대 · 남은 시즌 일수 · 랭킹 · 보상 받기.
export function rankCard(v) {
  if (!v) return '';
  const t = tierOf(v.rp), pend = Array.isArray(v.pending) ? v.pending : [];
  return `<div class="ark-card ark-t-${t.key}">
    <button type="button" class="ark-me" data-ar="rank" aria-label="랭킹 보기">${rankBadge(t.key, t.step, 'lg')}
      <span class="ark-info"><small>시즌 ${num(v.season)} · ${v.days_left <= 1 ? '<em>오늘 끝나요!</em>' : `${num(v.days_left)}일 남음`}</small><b>${esc(t.label)}</b>
        ${bar(t.pct)}<small class="ark-rp"><b>${num(v.rp)}</b> RP${t.next ? ` · 다음 단계까지 ${num(t.next - v.rp)}` : ' · 최고 단계!'}</small></span>
      <span class="ark-go">랭킹 ›</span></button>
    ${pend.length ? `<button type="button" class="yl-cta ark-claim" data-ar="rank-claim">시즌 ${pend.map(x => num(x.s)).join(' · ')} 보상 받기 <small>${esc(pend[pend.length - 1].best)}</small></button>` : ''}
    <p class="ark-note">코인 판 승패로 RP가 오르내려요 · 연습 판 · 연습 상대 · 컴퓨터 빈자리 판은 빼요</p>
  </div>`;
}

// 판 끝 RP 연출 칸(result 안에 넣고, 그린 뒤 playRankGain).
export function rankGain(rp) {
  if (!rp || typeof rp.d !== 'number') return '';
  const from = tierOf(rp.from), to = tierOf(rp.rp), d = rp.d;
  return `<div class="ark-gain ark-t-${to.key} ${d > 0 ? 'up' : d < 0 ? 'down' : 'same'}${rp.up ? ` promo-${rp.up}` : ''}" id="ark-gain" data-from="${from.pct}" data-to="${to.pct}" data-up="${rp.up || ''}" data-down="${rp.down ? 1 : ''}">
    <span class="ark-gain-badge" id="ark-gain-badge">${rankBadge(from.key, from.step, 'md')}</span>
    <span class="ark-gain-body"><small id="ark-gain-label">${esc(from.label)}</small>${bar(from.pct, 'ark-gain-bar')}
      <b class="ark-gain-num"><span id="ark-gain-d">${d > 0 ? '+' : d < 0 ? '−' : '±'}0</span> RP${rp.streak >= 2 && d > 0 ? ` <em>${num(rp.streak)}연승</em>` : ''}</b></span>
    <span class="ark-gain-promo" id="ark-gain-promo" aria-live="polite"></span>
  </div>`;
}
// 연출: 숫자 세기 → 막대 채우기 → 승급이면 배지 바꾸며 빛살 · 큰 글씨. later: 화면이 닫히면 멈추는 setTimeout(arena.js), sfx: 소리.
export function playRankGain(rp, { later, sfx, reduced = false } = {}) {
  const box = document.getElementById('ark-gain');
  if (!box || !rp) return;
  const to = tierOf(rp.rp), d = rp.d, abs = Math.abs(d);
  const numEl = document.getElementById('ark-gain-d'), fill = document.querySelector('#ark-gain-bar > i');
  const sign = d > 0 ? '+' : d < 0 ? '−' : '±';
  const swap = () => {
    const b = document.getElementById('ark-gain-badge'), l = document.getElementById('ark-gain-label');
    if (b) b.innerHTML = rankBadge(to.key, to.step, 'md');
    if (l) l.textContent = to.label;
  };
  if (reduced) { if (numEl) numEl.textContent = `${sign}${abs}`; swap(); if (fill) fill.style.transform = `scaleX(${to.pct / 100})`; box.classList.add('shown'); promo(); return; }
  box.classList.add('shown');
  const steps = Math.min(12, Math.max(1, abs));
  for (let i = 1; i <= steps; i++) later(() => { if (numEl) numEl.textContent = `${sign}${Math.round(abs * i / steps)}`; if (i === steps) sfx?.(d > 0 ? 'coins' : 'tap'); }, 300 + i * 45);
  const t0 = 300 + steps * 45 + 120;
  if (rp.up || rp.down) {
    // 단계가 바뀌면: 끝까지(또는 0까지) 갔다가 새 단계에서 다시.
    later(() => { if (fill) fill.style.transform = `scaleX(${rp.up ? 1 : 0})`; }, t0);
    later(() => { swap(); if (fill) { fill.style.transition = 'none'; fill.style.transform = `scaleX(${rp.up ? 0 : 1})`; } }, t0 + 520);
    later(() => { if (fill) { fill.style.transition = ''; fill.style.transform = `scaleX(${to.pct / 100})`; } promo(); }, t0 + 600);
  } else later(() => { if (fill) fill.style.transform = `scaleX(${to.pct / 100})`; }, t0);
  function promo() {
    const el = document.getElementById('ark-gain-promo');
    if (!el || !(rp.up || rp.down)) return;
    const big = rp.up === 'tier';
    el.innerHTML = rp.up ? `${big ? `<span class="ark-rays">${Array.from({ length: RAYS_MAX }, (_, i) => `<i style="--a:${i * 360 / RAYS_MAX}deg"></i>`).join('')}</span>` : ''}<b>${big ? `${esc(to.name)} 승급!` : '단계 상승!'}</b><small>${esc(to.label)}</small>`
      : `<b>단계 하락</b><small>${esc(to.label)} · 다시 올라가요!</small>`;
    el.className = `ark-gain-promo on ${rp.up ? (big ? 'tier' : 'div') : 'down'}`;
    if (rp.up) sfx?.(big ? 'fanfare-epic' : 'combo');
  }
}

// 랭킹 탭(GET /games/arena/rank). d: { top, place, total, me }.
export function rankBoardHtml(d) {
  const me = d?.me, t = tierOf(me?.rp || 0), top = Array.isArray(d?.top) ? d.top : [];
  const row = x => `<li class="${x.mine ? 'mine' : ''}${x.place <= 3 ? ` top${x.place}` : ''}"><i class="ark-place">${num(x.place)}</i>${rankBadge(x.tier, tierOf(x.rp).step, 'sm')}<span class="ark-who"><b>${esc(x.name)}</b><small>${esc(x.cls)} · ${esc(x.label)}</small></span><b class="ark-pts">${num(x.rp)}<small>RP</small></b></li>`;
  const mine = top.some(x => x.mine);
  return `<section class="ark-board">
    <div class="ar-title"><small>시즌 ${num(me?.season || 1)} · ${num(me?.days_left || 0)}일 남음</small><h1>아레나 랭킹</h1></div>
    <div class="ar-card">
      <div class="ark-board-me">${rankBadge(t.key, t.step, 'xl')}<div><small>내 순위 · 같은 학교 · 같은 학년</small><b>${d?.place ? `${num(d.place)}위` : '아직 순위 없음'}<small>${d?.total ? ` / ${num(d.total)}명` : ''}</small></b><span>${esc(t.label)} · ${num(me?.rp || 0)} RP · ${num(me?.wins || 0)}승</span></div></div>
      ${top.length ? `<ol class="ark-list">${top.map(row).join('')}</ol>` : '<p class="ar-why">이번 시즌 랭크 판을 한 친구가 아직 없어요. 코인 판으로 첫 순위를 차지해 보세요!</p>'}
      ${d?.place && !mine ? `<ol class="ark-list ark-list-me">${row({ place: d.place, mine: true, name: '나', cls: '', label: t.label, rp: me.rp, tier: t.key })}</ol>` : ''}
      <p class="ark-note">순위는 1분마다 새로 계산해요 · 이번 시즌 랭크 판을 한 학생만</p>
      ${seasonRewardsHtml(me)}
      <button type="button" class="btn full" data-ar="rank-back">아레나로</button>
    </div>
  </section>`;
}
// 시즌 보상 표 + 지난 시즌 기록.
function seasonRewardsHtml(me) {
  const titles = { silver: 'arena-silver', gold: 'arena-gold', platinum: 'arena-plat', diamond: 'arena-diamond' };
  const hist = Array.isArray(me?.history) ? me.history : [];
  return `<h3 class="ar-sub">시즌 끝 보상 <small>시즌 최고 티어 · ${RANK.MIN_GAMES}판 이상</small></h3>
    <ul class="ark-rewards">${RANK_TIERS.map((x, i) => `<li>${rankBadge(x.key, null, 'sm')}<b>${esc(x.name)}</b><span>${coin()}${SEASON_COINS[i]}${titles[x.key] ? ` · <em>${esc(TITLES[titles[x.key]]?.name || '')}</em>` : ''}</span></li>`).join('')}</ul>
    ${hist.length ? `<h3 class="ar-sub">지난 시즌</h3><div class="ark-hist">${hist.map(h => `<span>${rankBadge(h.best, null, 'sm')}<small>시즌 ${num(h.s)}</small><b>${esc(h.label)}</b></span>`).join('')}</div>` : ''}`;
}

// 시즌 보상 받기 연출(겹쳐 띄우는 판). r: claim 답 { got[{ s, tier, label, coins }], coins }.
export function rankClaimHtml(r) {
  const got = Array.isArray(r?.got) ? r.got : [];
  const best = got.reduce((m, x) => (RANK_TIERS.findIndex(t => t.key === x.tier) > RANK_TIERS.findIndex(t => t.key === m.tier) ? x : m), got[0] || { tier: 'bronze', label: '브론즈' });
  const titleKey = { silver: 'arena-silver', gold: 'arena-gold', platinum: 'arena-plat', diamond: 'arena-diamond' }[best.tier];
  return `<div class="ark-claim-pop ark-t-${best.tier}" role="dialog" aria-label="시즌 보상">
    <div class="ark-claim-card">
      <span class="ark-rays big">${Array.from({ length: RAYS_MAX }, (_, i) => `<i style="--a:${i * 360 / RAYS_MAX}deg"></i>`).join('')}</span>
      <span class="ark-sparks">${Array.from({ length: SPARKS_MAX }, (_, i) => `<i style="--a:${i * 360 / SPARKS_MAX}deg;--d:${i % 3}"></i>`).join('')}</span>
      <div class="ark-claim-badge">${rankBadge(best.tier, null, 'xl')}</div>
      <small>${got.length ? got.map(x => `시즌 ${num(x.s)}`).join(' · ') : '지난 시즌'} 결과</small>
      <h2>${esc(best.label || '시즌 완주')}</h2>
      ${r?.coins ? `<p class="ark-claim-coins">${coin()}<b>+${num(r.coins)}</b></p>` : '<p class="ark-claim-coins">이번에는 판이 모자라 기록만 남아요</p>'}
      ${titleKey ? `<p class="ark-claim-title">칭호 <b>${esc(TITLES[titleKey]?.name || '')}</b>가 열렸어요!</p>` : ''}
      <p class="ark-note">새 시즌은 한 티어 내려서 시작해요. 다시 올라가 볼까요?</p>
      <button type="button" class="yl-cta" data-ar="rank-claim-ok">좋아요!</button>
    </div>
  </div>`;
}
