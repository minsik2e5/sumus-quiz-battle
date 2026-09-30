// SUMUS TODAY — the desktop widget page (/widget), opened by the widget EXE (and the planner).
// Same saved document as the planner; small, quick actions only.
import { createStore } from './sync.js';
import { ensureSignedIn } from './auth.js';
import { icon, esc, isEnter, toast } from './ui.js';
import * as C from './core.js';

const root = document.getElementById('app');
const inExe = navigator.userAgent.includes('SUMUSWidget/');
let today = C.todayKst(), store = null, adding = false;
const S = () => store.data;
const change = fn => store.change(fn);

async function boot() {
  root.innerHTML = '<main class="gate compact"><div class="gate-card"><div class="spinner"></div><p>불러오는 중…</p></div></main>';
  try { await ensureSignedIn(root, { compact: true }); } catch { setTimeout(boot, 3000); return; }
  store = createStore({ normalize: st => C.normalizeState(st, C.todayKst()), onChange: draw, onStatus: drawStatus });
  for (let a = 0; ; a++) {
    try { await store.load(); break; }
    catch (err) { if (err.status === 401) { location.reload(); return; } root.innerHTML = '<main class="gate compact"><div class="gate-card"><div class="spinner"></div><p>연결을 기다리는 중이에요…</p></div></main>'; await new Promise(r => setTimeout(r, Math.min(30000, 2000 * (a + 1)))); }
  }
  draw();
  setInterval(refresh, 30000);
  addEventListener('focus', refresh);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') refresh(); });
}
async function refresh() {
  const now = C.todayKst();
  if (now !== today) today = now;
  if (!(await store.refresh())) draw();
}

function phase(i) {
  const now = C.nowHM(), [st, en] = C.SLOT_TIMES[i] || [];
  if (!st) return { cls: '', text: '' };
  const mins = t => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
  if (now >= st && now < en) return { cls: 'now', text: `수업 중 · ${mins(en) - mins(now)}분 남음` };
  if (now >= en) return { cls: 'past', text: '' };
  const left = mins(st) - mins(now);
  return { cls: left <= 60 ? 'soon' : '', text: left <= 180 ? (left >= 60 ? `${Math.floor(left / 60)}시간 ${left % 60 ? `${left % 60}분 ` : ''}뒤 시작` : `${left}분 뒤 시작`) : '' };
}
function draw() {
  if (!store?.data) return;
  if (root.contains(document.activeElement) && document.activeElement.id === 'w-memo' && document.activeElement.value) { drawStatus(); return; }
  const s = S(), ov = s.scheduleOverrides[today], classes = C.classesOn(today, s), p = C.dayProgress(s, today);
  const tasks = s.tasks.filter(t => t.date === today).sort((a, b) => (a.start ?? '').localeCompare(b.start ?? ''));
  const at = s.attendance[today] || {};
  // For the widget EXE's character (수무): today's classes, read without guessing from the page text.
  window.sumusClasses = classes.map((c, i) => c ? { start: C.SLOT_TIMES[i]?.[0] || '', label: c } : null).filter(x => x && x.start);
  const slot = (key, label, ic, value) => `<div class="w-slot ${value ? 'has' : ''}">${icon(ic)}<small>${label}</small>${value ? `<input type="time" value="${esc(value)}" data-time="${key}" aria-label="${label}">` : `<button type="button" data-now="${key}">${label}</button>`}</div>`;
  const mins = C.workMinutes(at.clockIn, at.clockOut);
  root.innerHTML = `<main class="w">
    <header class="w-head"><span class="brand-mark">S</span><div><b>SUMUS TODAY</b><small>${C.fmtLong(today)}</small></div>
      <div class="w-ring" style="--p:${p.pct}" title="오늘 ${p.completed}/${p.total} 완료"><span>${p.completed}/${p.total}</span></div>
      <button type="button" class="icon-btn" data-act="refresh" aria-label="새로고침">${icon('refresh')}</button></header>
    <section class="w-card"><div class="w-title">${icon('bag')}<b>근무 · 생활</b><small>${mins != null ? `오늘 ${C.fmtDuration(mins)} 근무` : ''}</small></div>
      <div class="w-slots">${slot('clockIn', '출근', 'bag', at.clockIn)}${slot('clockOut', '퇴근', 'bag', at.clockOut)}${slot('wake', '기상', 'sun', at.wake)}${slot('sleep', '취침', 'moon', at.sleep)}</div></section>
    <section class="w-card"><div class="w-title">${icon('book')}<b>오늘 수업</b>${ov ? `<em>${esc(ov.label)}</em>` : ''}</div>
      ${classes.some(Boolean) ? `<ul class="w-classes">${classes.map((c, i) => { if (!c) return ''; const key = `${today}-${i}`, done = !!s.classDone[key], ph = phase(i), [st, en] = C.SLOT_TIMES[i] || ['보강', '']; return `<li class="${done ? 'done' : ''} ${ph.cls}"><label class="check"><input type="checkbox" data-class="${key}" ${done ? 'checked' : ''} aria-label="${esc(c)} 수업 완료"><i></i></label><span class="wc-time">${st}<small>${en}</small></span><span class="wc-name"><b>${esc(c)}</b>${C.CLASS_GROUP_LABEL[c] ? `<small>${C.CLASS_GROUP_LABEL[c]}</small>` : ''}</span>${ph.text && !done ? `<em>${ph.text}</em>` : ''}</li>`; }).join('')}</ul>` : '<p class="w-empty">오늘은 수업이 없어요.</p>'}</section>
    <section class="w-card"><div class="w-title">${icon('plus')}<b>일정 메모</b></div>
      <div class="w-add"><input id="w-memo" maxlength="80" placeholder="할 일을 빠르게 적어보세요" autocomplete="off"><button type="button" class="btn primary sm" data-act="memo" aria-label="메모 추가">${icon('plus')}</button></div></section>
    <section class="w-card"><div class="w-title">${icon('list')}<b>오늘 체크리스트</b><small>${tasks.filter(t => t.done).length + s.routineItems.filter(r => s.routineChecks[`${today}-${r.id}`]).length}/${tasks.length + s.routineItems.length}</small></div>
      <ul class="w-checks">${tasks.map(t => `<li class="${t.done ? 'done' : ''}"><label class="check"><input type="checkbox" data-task="${esc(t.id)}" ${t.done ? 'checked' : ''}><i></i></label><span>${esc(t.title)}</span><small>${!t.start || t.start === t.end ? '메모' : `${esc(t.start)}–${esc(t.end)}`}</small></li>`).join('')}
        ${s.routineItems.map(r => `<li class="${s.routineChecks[`${today}-${r.id}`] ? 'done' : ''}"><label class="check"><input type="checkbox" data-routine="${esc(r.id)}" ${s.routineChecks[`${today}-${r.id}`] ? 'checked' : ''}><i></i></label><span>${esc(r.title)}</span></li>`).join('')}</ul></section>
    <footer class="w-foot">${inExe ? '' : '<a href="/SUMUS_Widget_Installer.zip" download>Windows 설치</a>'}<button type="button" data-act="planner">${icon('external')}전체 플래너</button><span id="w-status"></span></footer>
  </main>`;
  drawStatus();
}
function drawStatus(st = null) {
  const el = document.getElementById('w-status'); if (!el) return;
  const state = (st || {}).state;
  el.className = `w-status ${state || ''}`;
  el.innerHTML = state === 'error' ? '연결 오류' : state === 'saving' || state === 'dirty' ? '저장 중…' : `${icon('check')}자동 저장`;
}
function addMemo() {
  const input = document.getElementById('w-memo'), title = input?.value.trim();
  if (!title || adding) return;
  adding = true; input.value = '';
  const now = C.nowHM();
  change(s => { s.tasks.push({ id: `w${Date.now()}`, date: today, start: now, end: now, title, category: '업무', done: false }); });
  adding = false;
  toast('메모를 추가했어요.');
}

root.addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b || !store?.data) return;
  const d = b.dataset;
  if (d.now) { const key = d.now, day = key === 'sleep' ? C.sleepDay() : today; change(s => { (s.attendance[day] ||= { clockIn: '', clockOut: '' })[key] = C.nowHM(); if (key === 'wake') s.routineChecks[`${day}-wake`] = true; }); return; }
  if (d.act === 'refresh') store.refresh().then(ch => ch || draw());
  if (d.act === 'memo') addMemo();
  if (d.act === 'planner') window.open('/', '_blank');
});
root.addEventListener('change', e => {
  const t = e.target, d = t.dataset;
  if (d.class) change(s => { s.classDone[d.class] = t.checked; });
  else if (d.task) change(s => { const x = s.tasks.find(y => y.id === d.task); if (x) x.done = t.checked; });
  else if (d.routine) change(s => { s.routineChecks[`${today}-${d.routine}`] = t.checked; });
  else if (d.time) change(s => { (s.attendance[today] ||= { clockIn: '', clockOut: '' })[d.time] = t.value; });
});
root.addEventListener('keydown', e => { if (e.target.id === 'w-memo' && isEnter(e)) { e.preventDefault(); addMemo(); } });

boot();
