import { api, esc, num } from './ui.js';

// V13.173 선생님 전용: 학생 활동 기록(시간순)과 인기 · 현황. 데이터는 선생님만 받는 GET(/teacher/activity)에서 오고,
// 이 파일은 그리기만 한다. 길게 보는 화면이라 대시보드에서는 접어 두고, 펼칠 때 한 번 받는다.
export const ACT_NOTE = '이 기능이 켜진 뒤부터 쌓여요';
export const ACT_MODES = {
  practice: ['📝', '연습'], test: ['🎯', '실전시험'], exam: ['🧪', '선생님 시험'], yacha: ['⚔️', '야차전'], robot: ['🤖', '로보 연습전'],
  monster: ['👹', '몬스터전'], hunt: ['🐾', '몬스터 사냥'], claw: ['🧸', '인형뽑기'], blank: ['✍️', '빈칸영작'], fish: ['🎣', '낚시'], match: ['🃏', '짝 맞추기'], timing: ['⏱️', '10초 맞추기'], dungeon: ['🏰', '던전'],
  treasure: ['💰', '보물 사냥'], classfish: ['🐟', '반 낚시'], attend: ['📅', '출석'], rps: ['✌️', '가위바위보'], lucky: ['🎰', '행운 뽑기'], market: ['📈', '증권거래소'], egg: ['🥚', '곤충 · 공룡 알']
};
const KST = 'Asia/Seoul', STALE_MS = 60000;
const hhmm = at => new Date(at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: KST });
const dayKey = at => new Date(at).toLocaleDateString('sv-SE', { timeZone: KST });
const dayLabel = (at, now) => {
  const k = dayKey(at);
  if (k === dayKey(now)) return '오늘';
  if (k === dayKey(now - 86400000)) return '어제';
  return new Date(at).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short', timeZone: KST });
};

// 한 학생: 오늘 뭘 했나가 시간순(오래된 것이 위)으로, 이전 날은 그 아래에 날짜별로.
export function timelineHtml(rows, now = Date.now()) {
  if (!rows?.length) return `<p class="act-empty">아직 기록이 없어요 · ${ACT_NOTE}</p>`;
  const days = new Map();
  for (const r of rows) { const k = dayKey(r.at); if (!days.has(k)) days.set(k, []); days.get(k).push(r); }
  const todayKey = dayKey(now);
  const html = [...days.entries()].map(([k, list]) => {
    const items = [...list].sort((a, b) => a.at - b.at).map(r => `<li><time>${hhmm(r.at)}</time><span class="act-ico" aria-hidden="true">${(ACT_MODES[r.k] || ['•'])[0]}</span><b>${esc(r.t)}</b></li>`).join('');
    return `<section class="act-day"><h4>${esc(dayLabel(list[0].at, now))}<small>${list.length}개</small></h4><ol class="act-line">${items}</ol></section>`;
  });
  const hasToday = days.has(todayKey);
  return `${hasToday ? '' : '<p class="act-empty">오늘은 아직 기록이 없어요.</p>'}${html.join('')}<p class="act-note">최근 30개만 보여요 · ${ACT_NOTE}</p>`;
}
export async function loadStudentActivity(id, box) {
  try {
    box.innerHTML = '<p class="act-empty">불러오는 중…</p>';
    const { activity, server_time } = await api('/teacher/activity/' + encodeURIComponent(id));
    box.innerHTML = timelineHtml(activity, server_time || Date.now());
  } catch (err) { box.innerHTML = `<p class="act-empty">${esc(err.message)}</p>`; }
}

/* ---------- 인기 · 현황(대시보드의 접는 카드) ---------- */
let cache = null, cacheAt = 0, open = false, range = 'today', profiles = [];
const bar = (label, value, max, text, extra = '') => `<div class="act-bar ${extra}"><span class="act-bar-label">${label}</span><span class="act-bar-track"><i style="width:${max ? Math.max(value ? 3 : 0, Math.round(value / max * 100)) : 0}%"></i></span><span class="act-bar-val">${text}</span></div>`;
function popularHtml(o) {
  const key = range === 'week' ? 'week' : 'today';
  const rows = o.popularity.filter(r => r[key] > 0).sort((a, b) => b[key] - a[key] || b[`${key}_players`] - a[`${key}_players`]);
  const max = rows[0]?.[key] || 0;
  return `<div class="act-tabs" role="tablist">${[['today', '오늘'], ['week', '이번 주']].map(([k, label]) => `<button type="button" role="tab" aria-selected="${k === key}" class="${k === key ? 'on' : ''}" data-act-range="${k}">${label}</button>`).join('')}</div>
    ${rows.length ? rows.map((r, i) => bar(`<span class="act-ico" aria-hidden="true">${esc(r.icon)}</span>${esc(r.label)}`, r[key], max, `${num(r[key])}회 <small>${num(r[`${key}_players`])}명</small>`, i === 0 ? 'top' : '')).join('') : `<p class="act-empty">${key === 'today' ? '오늘' : '이번 주'} 기록된 활동이 아직 없어요 · ${ACT_NOTE}</p>`}`;
}
function levelsHtml() {
  const list = profiles.filter(p => p.active && p.stats).map(p => Math.max(1, Number(p.stats.level || 1)));
  if (!list.length) return '<p class="act-empty">활성 학생이 없어요.</p>';
  const top = Math.max(...list), size = top > 60 ? 10 : 5, bins = new Map();
  for (const lv of list) { const b = Math.floor((lv - 1) / size); bins.set(b, (bins.get(b) || 0) + 1); }
  const last = Math.floor((top - 1) / size), max = Math.max(...bins.values());
  const cols = Array.from({ length: last + 1 }, (_, b) => bins.get(b) || 0);
  return `<div class="act-cols" style="--n:${cols.length}">${cols.map((c, b) => `<div><em>${c || ''}</em><i style="height:${c ? Math.max(6, Math.round(c / max * 100)) : 0}%"></i><span>${b * size + 1}${size > 1 ? `~` : ''}</span></div>`).join('')}</div>`;
}
function monstersHtml(o) {
  if (!o.monsters.length) return '<p class="act-empty">아직 몬스터전을 한 학생이 없어요.</p>';
  const max = Math.max(...o.monsters.map(x => x.count));
  return o.monsters.map(x => bar(x.stage ? `레벨 ${x.stage}` : '아직 안 함', x.count, max, `${num(x.count)}명`)).join('');
}
function hoursHtml(o) {
  const max = Math.max(1, ...o.hours);
  return `<div class="act-hours" role="img" aria-label="접속 시간대">${o.hours.map((c, h) => `<div title="${h}시 ${c}번"><i style="height:${c ? Math.max(5, Math.round(c / max * 100)) : 0}%"></i>${h % 6 === 0 ? `<span>${h}</span>` : ''}</div>`).join('')}</div>
    <p class="act-note">기록에 남은 활동의 시각으로 센 거예요(학생당 최근 30개) · ${ACT_NOTE}</p>`;
}
function bodyHtml() {
  if (!cache) return '<p class="act-empty">불러오는 중…</p>';
  const o = cache;
  return `<div class="act-grid">
    <section class="act-card act-wide"><h3>많이 하는 활동<small>모드별 플레이 횟수 · 하는 학생 수</small></h3>${popularHtml(o)}</section>
    <section class="act-card"><h3>학생 레벨 분포<small>레벨 구간별 학생 수</small></h3>${levelsHtml()}</section>
    <section class="act-card"><h3>몬스터전 레벨 분포<small>지금 도전 중인 레벨</small></h3>${monstersHtml(o)}</section>
    <section class="act-card act-wide"><h3>접속 시간대<small>몇 시에 많이 하나(한국 시간)</small></h3>${hoursHtml(o)}</section>
  </div>`;
}
const paint = () => { const el = document.querySelector('.act-fold-v13173 .act-body'); if (el) el.innerHTML = bodyHtml(); };
async function refresh(force = false) {
  if (!force && cache && Date.now() - cacheAt < STALE_MS) return paint();
  try { cache = (await api('/teacher/activity')).overview; cacheAt = Date.now(); paint(); }
  catch (err) { const el = document.querySelector('.act-fold-v13173 .act-body'); if (el) el.innerHTML = `<p class="act-empty">${esc(err.message)}</p>`; }
}
export function activityFold(d) {
  profiles = d?.profiles || [];
  const today = cache?.popularity.filter(r => r.today > 0).sort((a, b) => b.today - a.today)[0];
  const sub = !cache ? '눌러서 보기 · 인기 · 레벨 · 접속 시간대' : today ? `오늘 가장 많이 한 것: ${today.label} ${num(today.today)}회` : `오늘은 아직 기록이 없어요 · ${ACT_NOTE}`;
  return `<details class="panel act-fold-v13173" ${open ? 'open' : ''}><summary><span><b>학생 활동 · 인기</b><small>${esc(sub)}</small></span><i aria-hidden="true">⌄</i></summary><div class="act-body">${bodyHtml()}</div></details>`;
}
document.addEventListener('toggle', event => {
  const el = event.target;
  if (!el?.classList?.contains('act-fold-v13173')) return;
  open = el.open;
  if (open) refresh();
}, true);
document.addEventListener('click', event => {
  const button = event.target.closest?.('[data-act-range]');
  if (!button) return;
  range = button.dataset.actRange;
  paint();
});
