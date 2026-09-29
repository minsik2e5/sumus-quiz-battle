import { api, esc, num } from './ui.js';
import { trophy } from './emblems.js';

// V13.74 반 대항전 on the classroom TV: this week's 경험치 of each class as a race of bars,
// with each class's top three. Opened by the teacher (logged in) or from a TV link (no login),
// in the same frame as the 교실 TV 대진표. It reloads every 30 seconds.

const POLL_MS = 30000;
let TV = null;

export function openClassTv(A, exit, { token = null } = {}) {
  closeClassTv();
  const root = document.getElementById('app');
  TV = { exit, token, timer: null, league: null };
  root.innerHTML = `<div class="btv ctv" id="btv">
    <header class="btv-top">
      <div class="btv-title"><small>SUMUS 반 대항전 · 이번 주 경험치</small><h1 id="ctv-name">순위를 불러오고 있어요…</h1><p id="ctv-meta"></p></div>
      <div class="btv-tools"><span class="btv-live"><i></i>실시간</span><button type="button" data-ctv="full">전체 화면</button><button type="button" data-ctv="exit">나가기</button></div>
    </header>
    <main class="ctv-stage" id="ctv-board"></main>
  </div>`;
  root.onclick = event => {
    const b = event.target.closest('[data-ctv]');
    if (b?.dataset.ctv === 'exit') leave();
    if (b?.dataset.ctv === 'full') { const el = document.getElementById('btv'); if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {}); else el?.requestFullscreen?.().catch(() => {}); }
  };
  load();
  TV.timer = setInterval(load, POLL_MS);
}
function closeClassTv() { if (TV) { clearInterval(TV.timer); TV = null; } }
function leave() {
  const exit = TV?.exit;
  if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
  document.getElementById('app').onclick = null;
  closeClassTv();
  exit?.();
}
async function load() {
  const cur = TV;
  if (!cur || (document.visibilityState === 'hidden' && cur.league)) return;
  try {
    const { league } = await api(cur.token ? `/tv/classes?token=${encodeURIComponent(cur.token)}` : '/teacher/class-league');
    if (TV !== cur) return;
    cur.league = league;
    draw(league);
  } catch (err) {
    if (TV !== cur) return;
    document.getElementById('ctv-board').innerHTML = `<p class="ctv-empty">${esc(err.message || '순위를 불러오지 못했어요.')}</p>`;
  }
}
const day = ts => { const d = new Date(ts + 9 * 3600000); return `${d.getUTCMonth() + 1}/${d.getUTCDate()}`; };
function draw(league) {
  document.getElementById('ctv-name').textContent = `${league.school} 반 대항전`;
  document.getElementById('ctv-meta').textContent = `${day(league.week.start)} ~ ${day(league.week.end - 1)} · 공부·로보 대결·시험 경험치 합계 · 일요일 밤 마감`;
  const max = Math.max(1, ...league.classes.map(c => c.xp));
  document.getElementById('ctv-board').innerHTML = league.classes.length ? league.classes.map((c, i) => `
    <section class="ctv-row rank-${i + 1}" style="--w:${Math.max(4, Math.round(c.xp / max * 100))}%;--i:${i}">
      <div class="ctv-rank">${i === 0 && c.xp ? trophy('lg') : `<b>${i + 1}</b>`}</div>
      <div class="ctv-main">
        <div class="ctv-head"><h2>${esc(c.name)}</h2><span>참여 ${num(c.active)} / ${num(c.students)}명 · 1인 평균 ${num(c.avg)}</span></div>
        <div class="ctv-bar"><i></i><strong>${num(c.xp)}<small>XP</small></strong></div>
        <div class="ctv-top">${c.top.length ? c.top.map((s, k) => `<span><em>${k + 1}</em>${esc(s.name)} <small>${num(s.xp)}</small></span>`).join('') : '<span class="ctv-none">이번 주 첫 공부의 주인공은 누구?</span>'}</div>
      </div>
    </section>`).join('') : '<p class="ctv-empty">아직 반에 배정된 학생이 없어요.</p>';
}
