import { api, esc, num } from './ui.js';
import { LEAGUE_TIERS, LEAGUE_POINTS, LEAGUE_PAIR_DAY_CAP } from './titles.js';
import { tierEmblem, titleBadge } from './emblems.js';
import { avatar } from './character.js';

// V13.66 weekly yacha league board: my tier card and the table of my school + grade, shown in
// the ranking tab (야차 리그) and in the yacha lobby. The data is loaded when a board appears.

const cache = new Map();
export async function loadLeague(period = 'week', force = false) {
  const hit = cache.get(period);
  if (!force && hit && Date.now() - hit.at < 20000) return hit.data;
  const data = await api(`/battle/league?period=${period === 'all' ? 'all' : 'week'}`);
  cache.set(period, { at: Date.now(), data });
  return data;
}
export function clearLeagueCache() { cache.clear(); }

const untilReset = end => {
  const days = Math.ceil((Number(end) - Date.now()) / 86400000);
  return days <= 1 ? '오늘 밤 12시에 새 시즌' : `${days}일 뒤 새 시즌`;
};
export function leagueCard(me) {
  if (!me?.tier) return '';
  const tier = me.tier, next = tier.next;
  const pct = next ? Math.max(4, Math.min(100, Math.round((me.points - tier.min) / (next.min - tier.min) * 100))) : 100;
  return `<section class="lg-card lg-${tier.key}" aria-label="이번 주 야차 리그 ${tier.name}, 승점 ${me.points}점">
    <div class="lg-card-medal">${tierEmblem(tier.key, { size: 'lg' })}</div>
    <div class="lg-card-copy">
      <small>이번 주 야차 리그</small>
      <strong>${tier.name}<span>승점 <b>${num(me.points)}</b></span></strong>
      <em>${me.rank ? `우리 학년 ${num(me.size)}명 중 <b>${me.rank}위</b>` : '대결을 이기면 순위가 생겨요'}</em>
    </div>
    <div class="lg-card-next"><span>${next ? `${next.name}까지 <b>${next.need}점</b>` : '최고 티어 다이아!'}</span><span class="lg-bar"><i style="width:${pct}%"></i></span></div>
    <p class="lg-card-foot">${num(me.wins)}승 ${num(me.losses)}패${me.draws ? ` ${num(me.draws)}무` : ''}${me.win_rate !== null && me.win_rate !== undefined ? ` · 승률 ${me.win_rate}%` : ''} · ${untilReset(me.week_end)}</p>
  </section>`;
}
const record = row => `${num(row.wins)}승 ${num(row.losses)}패${row.draws ? ` ${num(row.draws)}무` : ''}`;
// A title is shown next to a name once it is more than the starting 첫걸음.
export const shownTitle = key => key && key !== 'rookie' ? key : null;
function leagueRow(row, period, index) {
  const top = row.rank && row.rank <= 3 ? ` top-${row.rank}` : '';
  const line = row.played ? `${record(row)}${row.win_rate !== null && row.win_rate !== undefined ? ` · 승률 ${row.win_rate}%` : ''}${period === 'all' && row.best_streak >= 2 ? ` · 최고 ${row.best_streak}연승` : ''}` : '아직 대결 전';
  const score = period === 'all'
    ? `<span class="lg-score"><b>${num(row.wins)}</b><small>승</small></span>`
    : `<span class="lg-score"><b>${num(row.points)}</b><small>점</small></span>`;
  const title = shownTitle(row.title);
  return `<div class="lg-row${row.is_me ? ' me' : ''}${top}" style="--i:${index}">
    <span class="lg-rank">${row.rank ?? '—'}</span>
    <span class="lg-pet">${row.pet ? avatar(row.pet.key, { size: 'mini', form: Math.max(1, row.pet.form) }) : '<span class="lg-pet-empty">?</span>'}</span>
    <span class="lg-name"><b>${esc(row.name)}${row.is_me ? '<i class="lg-me">나</i>' : ''}</b><small>${line}</small>${title ? titleBadge(title, { size: 'xs' }) : ''}</span>
    ${period === 'all' ? '' : `<span class="lg-tier">${tierEmblem(row.tier || 'bronze', { size: 'sm' })}</span>`}
    ${score}
  </div>`;
}
export function leagueRules() {
  return `<details class="lg-rules"><summary>리그 규칙 보기</summary><ul>
    <li>이기면 <b>${LEAGUE_POINTS.win}점</b>, 비기면 <b>${LEAGUE_POINTS.draw}점</b>, 져도 점수는 줄지 않아요.</li>
    <li>같은 친구와는 하루 <b>${LEAGUE_PAIR_DAY_CAP}판</b>까지만 승점이 쌓여요. 여러 친구와 붙어요!</li>
    <li>${LEAGUE_TIERS.slice(1).map(t => `${t.name} ${t.min}점`).join(' · ')}</li>
    <li>매주 월요일 00시에 새 시즌이 시작돼요. 지난주 1위는 <b>‘주간 야차왕’</b> 한정 칭호를 달아요.</li>
    <li>같은 학교·학년 친구들끼리의 리그예요.</li></ul></details>`;
}
function boardHtml(period, data) {
  const tabs = `<div class="segment lg-period" role="group" aria-label="리그 기간">${[['week', '이번 주 리그'], ['all', '통합 전적']].map(([key, label]) => `<button type="button" data-league-period="${key}" class="${period === key ? 'selected' : ''}" aria-pressed="${period === key}">${label}</button>`).join('')}</div>`;
  if (!data) return `${tabs}<div class="lg-loading" role="status">리그 순위를 불러오고 있어요…</div>`;
  const rows = data.rows || [];
  const table = rows.length > 1 || rows.some(row => row.played)
    ? `<div class="lg-table">${rows.map((row, i) => leagueRow(row, period, i)).join('')}</div>`
    : '<div class="lg-empty">같은 학교·학년 친구들과 대결하면 순위가 생겨요.</div>';
  return `${tabs}${period === 'week' ? leagueCard(data.me) : ''}
    <p class="lg-caption">${period === 'week' ? `${esc(data.week?.label || '이번 주')} · ${esc(data.week?.range || '')}` : '지금까지의 모든 야차전 · 이긴 횟수 순'}</p>
    ${table}${leagueRules()}`;
}
// Fills a `[data-league-board]` element and keeps its period tabs working.
export function mountLeagueBoard(el, onPeriod) {
  if (!el || el.dataset.mounted) return;
  el.dataset.mounted = '1';
  const draw = async (period, force = false) => {
    el.dataset.period = period;
    el.innerHTML = boardHtml(period, cache.get(period)?.data || null);
    try {
      const data = await loadLeague(period, force);
      if (el.isConnected && el.dataset.period === period) el.innerHTML = boardHtml(period, data);
    } catch (err) {
      const box = el.querySelector('.lg-loading');
      if (box) { box.textContent = err.message || '리그 순위를 불러오지 못했어요.'; box.classList.add('error'); }
    }
  };
  el.addEventListener('click', event => {
    const b = event.target.closest('[data-league-period]');
    if (!b || b.dataset.leaguePeriod === el.dataset.period) return;
    onPeriod?.(b.dataset.leaguePeriod);
    draw(b.dataset.leaguePeriod);
  });
  draw(el.dataset.period === 'all' ? 'all' : 'week', el.dataset.fresh === '1');
}
