// SUMUS TODAY — the desktop widget page (/widget), opened by the widget EXE (and the planner).
// Same saved document as the planner; the layout is the original widget's, plus one row for
// 출근 · 퇴근 · 기상 · 취침.
import { createStore } from './sync.js';
import { ensureSignedIn, pinChecking } from './auth.js';
import { icon, esc, isEnter, input, checkbox, isChecked, toast } from './ui.js';
import * as C from './core.js';

const root = document.getElementById('app');
const inExe = navigator.userAgent.includes('SUMUSWidget/');
const ATT = [['clockIn', '출근'], ['clockOut', '퇴근'], ['wake', '기상'], ['sleep', '취침']];
let today = C.todayKst(), store = null, status = 'loading';
const S = () => store.data;
const change = (fn, opts) => store.change(fn, opts);

async function boot() {
  root.innerHTML = pinChecking('안전하게 확인하는 중…', true);
  try { await ensureSignedIn(root); } catch { root.innerHTML = pinChecking('연결을 기다리는 중이에요…'); setTimeout(boot, 3000); return; }
  root.innerHTML = pinChecking('불러오는 중…');
  store = createStore({ normalize: st => C.normalizeState(st, C.todayKst()), onChange: draw, onStatus: st => { status = st.state === 'dirty' ? 'saving' : st.state; drawStatus(); } });
  for (let a = 0; ; a++) {
    try { await store.load(); break; }
    catch (err) { if (err.status === 401) { location.reload(); return; } root.innerHTML = pinChecking('연결을 기다리는 중이에요…'); await new Promise(r => setTimeout(r, Math.min(30000, 2000 * (a + 1)))); }
  }
  draw();
  setInterval(refresh, 30000);
  addEventListener('focus', refresh);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') refresh(); });
}
async function refresh() {
  today = C.todayKst();
  if (!(await store.refresh())) draw();
}

function draw() {
  if (!store?.data) return;
  // Do not redraw under the cursor (a memo being typed, a time being changed).
  const ae = document.activeElement;
  if (ae && root.contains(ae) && ((ae.id === 'w-memo' && ae.value) || ae.dataset.time)) { drawStatus(); return; }
  const s = S(), d = C.parseKst(today), ov = s.scheduleOverrides[today], classes = C.classesOn(today, s), p = C.dayProgress(s, today);
  const tasks = s.tasks.filter(t => t.date === today).sort((a, b) => (a.start ?? '').localeCompare(b.start ?? ''));
  const routines = s.routineItems, doneTasks = tasks.filter(t => t.done).length, doneRoutines = routines.filter(r => s.routineChecks[`${today}-${r.id}`]).length;
  const at = s.attendance[today] || {}, mins = C.workMinutes(at.clockIn, at.clockOut);
  // For the widget EXE's character (수무): today's classes, read without guessing from the page text.
  window.sumusClasses = classes.map((c, i) => c ? { start: C.SLOT_TIMES[i]?.[0] || '', label: c } : null).filter(x => x && x.start);
  root.innerHTML = `<main class="desktop-widget-page"><section class="desktop-widget-card">
    <header class="desktop-widget-head"><div class="desktop-widget-logo">S</div><div><strong>SUMUS TODAY</strong><span>${C.fmtLong(today)}</span></div><i id="w-dot"></i><button type="button" data-act="refresh" aria-label="새로고침">${icon('refresh-cw')}</button></header>
    <div class="desktop-widget-progress"><div>${icon('sparkles')}<strong>오늘 ${p.completed}/${p.total || 0} 완료</strong></div><span><b style="width: ${p.total ? Math.round(p.completed / p.total * 100) : 0}%;"></b></span></div>
    <section class="desktop-widget-section"><div class="desktop-widget-title">${icon('clock-3')}<strong>출퇴근 · 생활</strong>${mins != null ? `<em>${C.fmtDuration(mins)} 근무</em>` : ''}</div>
      <div class="desktop-time-list">${ATT.map(([k, l]) => `<div><span>${l}</span>${at[k] ? input(`type="time" value="${esc(at[k])}" data-time="${k}" aria-label="${l} 시간"`) : `<button type="button" data-now="${k}">지금</button>`}</div>`).join('')}</div></section>
    <section class="desktop-widget-section"><div class="desktop-widget-title">${icon('book-open-check')}<strong>오늘 수업</strong>${ov ? `<em>${esc(ov.label)}</em>` : ''}</div>
      <div class="desktop-class-list">${classes.length ? classes.map((c, i) => { if (!c) return ''; const key = `${today}-${i}`, done = !!s.classDone[key], [st, en] = C.SLOT_TIMES[i] || ['보강', '']; return `<label class="${done ? 'done' : ''}">${checkbox(done, `data-class="${key}"`)}<span><b>${i + 1}</b><strong>${esc(c)}</strong><small>${st}–${en}</small></span></label>`; }).join('') : '<p>오늘은 수업이 없어요.</p>'}</div></section>
    <section class="desktop-widget-section"><div class="desktop-widget-title">${icon('plus')}<strong>일정 메모</strong></div>
      <div class="desktop-memo-add">${input('id="w-memo" maxlength="80" placeholder="할 일을 빠르게 적어보세요" autocomplete="off"')}<button type="button" data-act="memo" disabled aria-label="메모 추가">${icon('plus')}</button></div></section>
    <section class="desktop-widget-section"><div class="desktop-widget-title">${icon('list-checks')}<strong>오늘 체크리스트</strong><em>${doneTasks + doneRoutines}/${tasks.length + routines.length}</em></div>
      <div class="desktop-check-list">${tasks.map(t => `<label class="${t.done ? 'done' : ''}">${checkbox(t.done, `data-task="${esc(t.id)}"`)}<span><strong>${esc(t.title)}</strong><small>${!t.start || t.start === t.end ? '일정 메모' : `${esc(t.start)}–${esc(t.end)}`}</small></span></label>`).join('')}${routines.map(r => { const on = !!s.routineChecks[`${today}-${r.id}`]; return `<label class="${on ? 'done' : ''}">${checkbox(on, `data-routine="${esc(r.id)}"`)}<span><strong>${esc(r.title)}</strong><small>매일 루틴</small></span></label>`; }).join('')}${!tasks.length && !routines.length ? '<p>체크할 항목이 없어요.</p>' : ''}</div></section>
    <footer><div>${inExe ? '' : '<a href="/SUMUS_Widget_Installer.zip" download>Windows 설치</a>'}<button type="button" data-act="planner">${icon('external-link')} 전체 플래너</button></div><span id="w-status"></span></footer>
  </section></main>`;
  drawStatus();
}
function drawStatus() {
  const dot = document.getElementById('w-dot'), el = document.getElementById('w-status');
  if (dot) { dot.className = status === 'loading' ? '' : status; dot.title = status === 'saved' ? '저장됨' : status === 'saving' ? '저장 중' : '연결 상태'; }
  if (el) el.innerHTML = status === 'saving' ? '저장 중…' : status === 'error' ? '연결 오류' : `${icon('check')} 자동 저장`;
}
let adding = false;
function addMemo() {
  const box = document.getElementById('w-memo'), title = box?.value.trim();
  if (!title || adding) return;
  adding = true; box.value = '';
  const now = C.nowHM();
  change(s => { s.tasks.push({ id: `w${Date.now()}`, date: today, start: now, end: now, title, category: '업무', done: false }); });
  adding = false;
}
// After typing a time: only the work line changes; the input keeps the cursor.
function patchWork() {
  const title = root.querySelector('.desktop-time-list')?.previousElementSibling; if (!title) return;
  const at = S().attendance[today] || {}, mins = C.workMinutes(at.clockIn, at.clockOut);
  title.querySelector('em')?.remove();
  if (mins != null) title.insertAdjacentHTML('beforeend', `<em>${C.fmtDuration(mins)} 근무</em>`);
}

root.addEventListener('click', e => {
  if (!store?.data) return;
  const cb = e.target.closest('[role=checkbox]');
  if (cb) {
    const on = !isChecked(cb), d = cb.dataset;
    if (d.class) change(s => { s.classDone[d.class] = on; });
    else if (d.task) change(s => { const x = s.tasks.find(y => y.id === d.task); if (x) x.done = on; });
    else if (d.routine) change(s => { s.routineChecks[`${today}-${d.routine}`] = on; });
    return;
  }
  const b = e.target.closest('button'); if (!b) return;
  const d = b.dataset;
  if (d.now) {
    const key = d.now, day = key === 'sleep' ? C.sleepDay() : today;
    change(s => { (s.attendance[day] ||= { clockIn: '', clockOut: '' })[key] = C.nowHM(); if (key === 'wake') s.routineChecks[`${day}-wake`] = true; });
    if (day !== today) toast(`${C.fmtMd(day)} 밤 취침으로 기록했어요.`);
    return;
  }
  if (d.act === 'refresh') store.refresh().then(ch => ch || draw());
  if (d.act === 'memo') addMemo();
  if (d.act === 'planner') window.open('/', '_blank');
});
root.addEventListener('change', e => {
  const t = e.target;
  if (t.dataset.time) { change(s => { (s.attendance[today] ||= { clockIn: '', clockOut: '' })[t.dataset.time] = t.value; }, { render: false }); patchWork(); }
});
root.addEventListener('input', e => { if (e.target.id === 'w-memo') root.querySelector('[data-act=memo]').disabled = !e.target.value.trim(); });
root.addEventListener('keydown', e => { if (e.target.id === 'w-memo' && isEnter(e)) { e.preventDefault(); addMemo(); } });

boot();
