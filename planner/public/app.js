// SUMUS 수업관리 플래너 — the planner page (/). The screens use the markup and class names of the
// original SUMUS Planner (ChatGPT Sites build) so it looks as it did; saving/merging, the 1차 fixes
// and the 2차 additions (기상/취침, 시험이 끝나면 다음 시험 준비, 지난 시험 기록) are kept.
import { createStore, api } from './sync.js';
import { ensureSignedIn, signOut, pinChecking } from './auth.js';
import { icon, esc, isEnter, $, $$, dialog, undoBar, toast, button, input, textarea, checkbox, isChecked, setCheckbox, progress, select } from './ui.js';
import * as C from './core.js';

const root = document.getElementById('app');
const A = { today: C.todayKst(), sel: C.todayKst(), tab: 'today', monthCursor: C.todayKst().slice(0, 8) + '01', monthFilter: 'all', status: { state: 'loading' }, linkCohort: 'all', pinMsg: '' };
let store = null;
const S = () => store.data;
const change = (fn, opts) => store.change(fn, opts);

const TABS = [['today', '오늘', 'layout-dashboard'], ['lessons', '수업 계획 · 진도', 'book-open-check'], ['week', '주간 계획', 'clock-3'], ['month', '월간 · 시험', 'calendar-days'], ['hub', '메모 · 자료', 'sticky-note']];
const HEADLINE = { today: '오늘을 가장 선명하게', lessons: '계획한 수업과 실제 진도를 연결해요', week: '이번 주 흐름을 확인해요', month: '시험까지의 계획을 한눈에', hub: '생각과 자료를 놓치지 않게' };
// 출근·퇴근 (original) + 기상·취침 (2차), shown 2 x 2.
const ATT = [['clockIn', '출근'], ['clockOut', '퇴근'], ['wake', '기상'], ['sleep', '취침']];

/* ---------------------------------------------------------------- boot */
async function boot() {
  root.innerHTML = pinChecking('안전하게 확인하는 중…', true);
  try { await ensureSignedIn(root); } catch { root.innerHTML = pinChecking('서버에 연결하는 중이에요. 자동으로 다시 시도해요…'); setTimeout(boot, 3000); return; }
  root.innerHTML = pinChecking('플래너를 불러오는 중…');
  store = createStore({
    normalize: st => C.normalizeState(st, C.todayKst()),
    onChange: () => render(),
    onStatus: st => { A.status = st; drawStatus(); }
  });
  for (let attempt = 0; ; attempt++) {
    try { await store.load(); break; }
    catch (err) {
      if (err.status === 401) { location.reload(); return; }
      root.innerHTML = pinChecking('서버에 연결하는 중이에요. 자동으로 다시 시도해요…');
      await new Promise(r => setTimeout(r, Math.min(30000, 2000 * (attempt + 1))));
    }
  }
  housekeeping();
  render();
  setInterval(tick, 30000);
  setInterval(() => { if (document.visibilityState === 'visible') store.refresh().then(ch => ch && housekeeping()); }, 60000);
  addEventListener('focus', () => store.refresh().then(ch => ch && housekeeping()));
  addEventListener('beforeunload', e => { if (store.dirty) { store.save(); e.preventDefault(); e.returnValue = ''; } });
}
// Exams that ended move on to the next one (and the one-off move of 단원고·선부고).
function housekeeping() {
  const probe = JSON.parse(JSON.stringify(S()));
  C.applyMigrations(probe); const rolled = C.autoRollExams(probe, A.today);
  if (JSON.stringify(probe) === JSON.stringify(S())) return;
  change(s => { C.applyMigrations(s); C.autoRollExams(s, A.today); });
  if (rolled.length) toast(`${rolled.join(', ')} 시험이 끝나서 다음 시험 준비로 넘어갔어요.`);
}
// Midnight (KST): today moves on, and the selected day with it if it was today.
function tick() {
  const now = C.todayKst();
  if (now !== A.today) { if (A.sel === A.today) A.sel = now; A.today = now; housekeeping(); render(); }
}

/* ---------------------------------------------------------------- shell */
function render() {
  if (!store?.data) return;
  // Keep what is being typed, the focus and the open <details> across the redraw.
  const ae = document.activeElement, key = ae && root.contains(ae) ? ae.dataset.k : null;
  let range = null; if (key) try { range = [ae.selectionStart, ae.selectionEnd]; } catch {}
  const drafts = $$('[data-draft]', root).map(el => [el.dataset.k, el.value]);
  const open = $$('details[data-k][open]', root).map(el => el.dataset.k);
  const s = S(), ge = C.sortExams(C.examsOf(s)).find(x => !C.examUndated(x) && x.end >= A.today);
  root.innerHTML = `<div class="app-shell">
    <aside class="sidebar">
      <div class="brand"><span class="brand-mark">S</span><span>SUMUS<br><small>PLANNER</small></span></div>
      <nav>${TABS.map(([id, label, ic]) => `<button type="button" class="${A.tab === id ? 'nav-item active' : 'nav-item'}" data-tab="${id}">${icon(ic)}<span>${label}</span></button>`).join('')}</nav>
      <div class="sidebar-exam"><span>가장 가까운 시험</span><strong>${esc(ge?.school ?? '')}</strong><p>${ge ? `${esc(ge.label)} · ${C.examStatus(ge, A.today)}` : '예정된 시험 없음'}</p></div>
      <div class="profile"><div class="avatar">김</div><div><strong>${C.DISPLAY_NAME}</strong><span>썸어스학원</span></div>${icon('ellipsis')}</div>
    </aside>
    <main class="main">
      <header class="topbar"><div><p class="eyebrow">SUMUS ACADEMY</p><h1>${HEADLINE[A.tab]}</h1></div>
        <div class="top-actions"><div id="save-badge" class="save-badge"></div>
          <button type="button" data-act="widget" title="바탕화면 위젯">${icon('monitor-up')}</button>
          <button type="button" data-act="save-now" title="지금 저장">${icon('save')}</button>
          <button type="button" data-act="backup" title="백업 받기">${icon('download')}</button>
          <button type="button" data-act="restore" title="백업 복원">${icon('upload')}</button>
          <button type="button" data-act="lock" title="잠금">${icon('log-out')}</button>
          <input hidden type="file" accept="application/json" id="restore-file"></div></header>
      ${view()}
    </main>
    <button type="button" class="mobile-add" data-act="task-new" aria-label="일정 추가">${icon('plus')}</button>
  </div>`;
  for (const [k, v] of drafts) { const el = root.querySelector(`[data-k="${k}"]`); if (el) el.value = v; }
  for (const k of open) { const el = root.querySelector(`details[data-k="${k}"]`); if (el) el.open = true; }
  if (key) { const el = root.querySelector(`[data-k="${CSS.escape(key)}"]`); if (el) { el.focus({ preventScroll: true }); if (range) try { el.setSelectionRange(...range); } catch {} } }
  drawStatus();
}
function drawStatus() {
  const el = document.getElementById('save-badge'); if (!el) return;
  const st = A.status.state, cls = A.status.auth ? 'auth' : st === 'dirty' ? 'saving' : st;
  const time = A.status.updatedAt ? new Date(A.status.updatedAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Seoul' }) : '';
  const text = cls === 'loading' ? '불러오는 중' : cls === 'saving' ? '저장 중…' : cls === 'saved' ? `${time || '방금'} 저장됨` : cls === 'auth' ? '다시 로그인 필요' : cls === 'offline' ? '연결 대기 중' : '저장 재시도 필요';
  el.className = `save-badge ${cls}`;
  el.title = cls === 'error' ? A.status.message || '' : '';
  el.innerHTML = `${icon(cls === 'error' || cls === 'auth' ? 'cloud-off' : 'cloud')}<span>${text}</span>${cls === 'auth' ? '<button type="button" class="save-retry" data-act="relogin">로그인</button>' : ''}`;
}
function view() {
  if (A.tab === 'lessons') return lessonsView();
  if (A.tab === 'week') return weekView();
  if (A.tab === 'month') return monthView();
  if (A.tab === 'hub') return hubView();
  return todayView();
}
function dateRow() {
  const d = A.sel;
  return `<div class="date-row"><button type="button" data-act="day" data-d="-1" aria-label="이전 날짜">${icon('chevron-left')}</button><div><strong>${C.fmtLong(d)}</strong><span>${d}</span></div><button type="button" data-act="day" data-d="1" aria-label="다음 날짜">${icon('chevron-right')}</button><button type="button" class="today-chip" data-act="to-today">오늘</button><button type="button" class="schedule-chip" data-act="schedule">${esc(S().scheduleOverrides[d]?.label ?? '수업 변경')}</button></div>`;
}

/* ---------------------------------------------------------------- today */
function todayView() {
  const s = S(), d = A.sel, p = C.dayProgress(s, d);
  const tasks = s.tasks.filter(t => t.date === d).sort((a, b) => (a.start ?? '').localeCompare(b.start ?? ''));
  const classes = C.classesOn(d, s);
  return `<div class="dashboard-grid">
    <section class="content-column">
      ${dateRow()}
      <div class="focus-card"><div><span class="focus-kicker">${icon('sparkles')} 오늘의 흐름</span><h2>${p.pct < 50 ? '가볍게 하나씩 시작해요' : p.pct < 100 ? '좋아요, 리듬을 이어가요' : '오늘 계획을 모두 마쳤어요'}</h2><p>${p.completed}개 완료 · ${Math.max(0, p.total - p.completed)}개 남음</p></div>
        <div class="progress-ring" style="--progress: ${p.pct * 3.6}deg;"><span>${p.pct}%</span></div></div>
      <div class="section-heading"><div><h2>오늘 계획</h2><p>수정하면 바로 저장돼요</p></div>${button(`${icon('plus')} 일정 추가`, { attrs: 'data-act="task-new"' })}</div>
      <div class="timeline-card">${tasks.length ? tasks.map(taskRow).join('') : `<div class="empty-state">${icon('circle-plus')}<strong>아직 계획이 없어요</strong><button type="button" data-act="task-new">첫 일정 추가하기</button></div>`}</div>
      <div class="section-heading class-heading"><div><h2>오늘 수업</h2><p>요일별 고정 스케줄</p></div><span class="class-count">${classes.filter(Boolean).length}타임</span></div>
      <div class="class-list">${classes.filter(Boolean).length ? classes.map((cls, i) => cls ? classCard(d, cls, i) : '').join('') : '<div class="weekend-card">오늘은 정규 수업이 없어요.</div>'}</div>
    </section>
    <aside class="right-column">${routineCard(d)}${upcomingCard()}</aside>
  </div>`;
}
function taskRow(t) {
  const cat = t.category || '업무';
  return `<div class="timeline-item ${t.done ? 'done' : ''}"><div class="time"><strong>${esc(t.start || '메모')}</strong>${t.end && t.end !== t.start ? `<span>${esc(t.end)}</span>` : ''}</div><div class="line category-${esc(cat.replace(' ', '-'))}"></div>${checkbox(t.done, `data-task-done="${esc(t.id)}" aria-label="${esc(t.title)} 완료"`)}<button type="button" class="task-copy task-edit-target" data-task-edit="${esc(t.id)}"><strong>${esc(t.title)}</strong><span>${esc(cat)}</span></button><div class="task-actions"><button type="button" class="icon-button" data-task-edit="${esc(t.id)}" aria-label="일정 수정">${icon('pencil')}</button><button type="button" class="icon-button danger" data-task-del="${esc(t.id)}" aria-label="일정 삭제">${icon('trash-2')}</button></div></div>`;
}
function classCard(d, cls, i) {
  const s = S(), key = `${d}-${i}`, done = !!s.classDone[key], rec = s.lessonRecords[key], [st, en] = C.SLOT_TIMES[i] || ['보강', ''];
  const recs = C.splitCohorts(cls).map(c => [c, s.cohortLessonRecords[C.cohortKey(d, i, c.id)]]);
  let preview;
  if (recs.length) preview = recs.some(([, r]) => r?.plan || r?.actual) ? recs.map(([c, r]) => `<span><b>${esc(c.short)}</b>${esc(r?.plan || r?.actual || '미작성')}</span>`).join('') : '<span class="empty-preview">학교별 수업 계획을 작성해 주세요</span>';
  else preview = rec?.plan || rec?.actual ? `${rec.plan ? `<span><b>계획</b>${esc(rec.plan)}</span>` : ''}${rec.actual ? `<span><b>진도</b>${esc(rec.actual)}</span>` : ''}` : '<span class="empty-preview">작성한 수업 계획이 없어요</span>';
  const actual = recs.some(([, r]) => r?.actual) || rec?.actual, plan = recs.some(([, r]) => r?.plan) || rec?.plan;
  return `<div class="class-card ${done ? 'done' : ''}">
    <button type="button" class="class-main" data-tab="lessons"><span class="class-index">${i + 1}</span><div><strong>${esc(cls)}</strong><span>${st} – ${en}</span>${C.CLASS_GROUP_LABEL[cls] ? `<small>${C.CLASS_GROUP_LABEL[cls]}</small>` : ''}</div></button>
    <button type="button" class="class-preview" data-tab="lessons">${preview}</button>
    <div class="class-actions"><span class="record-chip ${actual ? 'filled' : ''}">${actual ? '진도 기록됨' : plan ? '계획 있음' : '계획 입력'}</span><button type="button" class="class-status" data-class-done="${key}">${done ? `${icon('check')} 완료` : '완료'}</button></div>
  </div>`;
}
function routineCard(d) {
  const s = S();
  return `<div class="mini-card routine-card">
    <div class="card-title"><span class="icon-tile purple">${icon('list-checks')}</span><div><strong>매일 루틴</strong><span>날짜별로 체크가 저장돼요</span></div></div>
    <div class="attendance-box" id="attendance-box">${attendanceBox(d)}</div>
    <div class="routine-list">${s.routineItems.map((r, i) => { const on = !!s.routineChecks[`${d}-${r.id}`]; return `<div class="${on ? 'routine-row checked' : 'routine-row'}">${checkbox(on, `data-routine="${esc(r.id)}"`)}<button type="button" class="routine-title" data-routine-edit="${esc(r.id)}">${esc(r.title)}</button><div class="routine-actions"><button type="button" data-routine-move="${i}" data-d="-1" ${i === 0 ? 'disabled' : ''} aria-label="위로 이동">${icon('arrow-up')}</button><button type="button" data-routine-move="${i}" data-d="1" ${i === s.routineItems.length - 1 ? 'disabled' : ''} aria-label="아래로 이동">${icon('arrow-down')}</button><button type="button" data-routine-edit="${esc(r.id)}" aria-label="루틴 수정">${icon('pencil')}</button><button type="button" data-routine-del="${esc(r.id)}" aria-label="루틴 삭제">${icon('trash-2')}</button></div></div>`; }).join('')}</div>
    <div class="routine-add">${input('data-k="routine-new" data-draft placeholder="새 루틴"')}<button type="button" data-act="routine-add" aria-label="루틴 추가">${icon('plus')}</button></div>
  </div>`;
}
// 출퇴근 · 기상 · 취침. An empty time has a "지금" button that writes the current time (KST).
function attendanceBox(d) {
  const at = S().attendance[d] || {}, line = attendanceLine(d);
  return `<div class="attendance-head"><strong>출퇴근 · 생활 기록</strong><button type="button" data-act="attendance">상세 보기</button></div>
    <div class="attendance-times">${ATT.map(([k, l]) => `<label for="att-${k}"><span>${l}${at[k] ? '' : nowButton(k)}</span>${input(`type="time" id="att-${k}" value="${esc(at[k] || '')}" data-time="${k}" data-k="time-${k}"`)}</label>`).join('')}</div>
    ${line ? `<small>${line}</small>` : ''}`;
}
const nowButton = k => `<button type="button" class="attendance-now" data-now="${k}">지금</button>`;
function attendanceLine(d) {
  const s = S(), at = s.attendance[d] || {}, mon = C.mondayOf(d), parts = [];
  let week = 0;
  for (let i = 0; i < 7; i++) { const r = s.attendance[C.addDays(mon, i)]; week += C.workMinutes(r?.clockIn, r?.clockOut) || 0; }
  if (at.clockIn || at.clockOut) parts.push(at.clockIn && at.clockOut ? `오늘 ${C.workDuration(at.clockIn, at.clockOut)} 근무` : '나머지 시간도 입력해 주세요');
  if (week) parts.push(`이번 주 ${C.fmtDuration(week)}`);
  return parts.join(' · ');
}
// After typing a time: update the line and the "지금" buttons without redrawing the input.
function patchAttendance() {
  const box = document.getElementById('attendance-box'); if (!box) return;
  const at = S().attendance[A.sel] || {};
  for (const [k] of ATT) {
    const span = box.querySelector(`label[for="att-${k}"] > span`), btn = span?.querySelector('[data-now]');
    if (at[k] && btn) btn.remove();
    if (!at[k] && span && !btn) span.insertAdjacentHTML('beforeend', nowButton(k));
  }
  const line = attendanceLine(A.sel);
  let small = box.querySelector(':scope > small');
  if (line) { if (!small) { small = document.createElement('small'); box.appendChild(small); } small.textContent = line; } else small?.remove();
}
function upcomingCard() {
  const s = S();
  return `<div class="mini-card">
    <div class="card-title"><span class="icon-tile blue">${icon('graduation-cap')}</span><div><strong>다가오는 시험</strong><span>체크한 범위로 자동 계산돼요</span></div></div>
    <div class="exam-mini-list">${C.COHORTS.map(c => {
      const ex = C.examForCohort(c.id, s, A.today);
      if (!ex || !C.examUpcoming(ex, A.today)) return '';
      const pct = C.rangeStats(s, c.id).pct;
      return `<div class="exam-mini"><div><span class="exam-dot ${ex.color}"></span><strong>${esc(c.label)}</strong><span${C.examUndated(ex) ? ' class="is-undated"' : ''}>${C.examStatus(ex, A.today)}</span></div>${progress(pct)}<small>${pct}% 완료</small></div>`;
    }).join('')}</div>
  </div>`;
}

/* ---------------------------------------------------------------- lessons */
function lessonsView() {
  const s = S(), d = A.sel, classes = C.classesOn(d, s);
  const cohorts = C.COHORTS.filter(c => classes.includes(c.className));
  return `<section class="lesson-section">
    <div class="lesson-toolbar">${dateRow()}<div class="lesson-guide">${icon('book-open-check')}<div><strong>계획하고, 수업 후 실제 진도만 적어두세요.</strong><span>다음 수업을 열면 이전 진도를 바로 확인할 수 있어요.</span></div></div></div>
    ${!classes.filter(Boolean).length ? `<div class="lesson-empty">${icon('book-open-check')}<h2>정규 수업이 없는 날이에요</h2><p>다른 날짜를 선택하면 수업 계획과 진도를 작성할 수 있어요.</p></div>` : `
    ${cohorts.length ? `<section class="range-section"><div class="range-section-head"><div><span class="eyebrow">SCHOOL RANGE</span><h2>학교별 시험 범위 체크</h2></div><p>체크한 진도는 날짜가 바뀌어도 그대로 저장돼요.</p></div>
      <div class="range-card-grid">${cohorts.map(rangeCard).join('')}</div></section>` : ''}
    <div class="lesson-records">${classes.map((cls, i) => cls ? lessonCard(d, cls, i) : '').join('')}</div>`}
  </section>`;
}
function rangeCard(c) {
  const s = S(), st = C.rangeStats(s, c.id), pc = C.pace(s, c.id, A.today), ex = C.examForCohort(c.id, s, A.today);
  return `<article class="range-card tone-${c.tone}">
    <div class="range-card-head"><div><span>${esc(c.className)}</span><strong>${esc(c.label)}</strong></div><div class="range-head-actions"><em>${st.checked}/${st.items.length} · ${st.pct}%</em><button type="button" data-range-add="${c.id}">${icon('plus')} 범위 추가</button></div></div>
    ${progress(st.pct)}
    <div class="pace-row"><span>${icon('gauge')} 남은 수업 <b>${pc.lessons}회</b></span><span>회당 <b>${pc.perLesson}개</b></span><em class="pace-${pc.state}">${pc.state}</em></div>
    ${st.items.length ? `<div class="range-items">${st.items.map(it => { const on = !!s.rangeChecks[`${c.id}-${it.id}`]; return `<div class="${on ? 'range-item checked' : 'range-item'}">${checkbox(on, `data-range-check="${c.id}|${esc(it.id)}"`)}<span title="${esc(it.label)}">${esc(it.label)}</span><div><button type="button" data-range-edit="${c.id}|${esc(it.id)}" aria-label="범위 수정">${icon('pencil')}</button><button type="button" data-range-del="${c.id}|${esc(it.id)}" aria-label="범위 삭제">${icon('trash-2')}</button></div></div>`; }).join('')}</div>`
      : `<p class="hub-empty range-empty">${esc(ex?.label || '시험')} 범위를 추가해 주세요</p>`}
  </article>`;
}
function lessonCard(d, cls, i) {
  const s = S(), [st, en] = C.SLOT_TIMES[i] || ['보강', ''], key = `${d}-${i}`, done = !!s.classDone[key], split = C.splitCohorts(cls);
  return `<article class="lesson-record-card">
    <div class="lesson-record-head"><div class="lesson-number">${String(i + 1).padStart(2, '0')}</div><div><span>${st} – ${en}</span><h2>${esc(cls)}</h2>${C.CLASS_GROUP_LABEL[cls] ? `<p class="lesson-group">${C.CLASS_GROUP_LABEL[cls]}</p>` : ''}</div>
      <button type="button" class="${done ? 'lesson-complete active' : 'lesson-complete'}" data-class-done="${key}">${done ? `${icon('check')} 수업 완료` : '완료 체크'}</button></div>
    ${split.length ? `<div class="school-lesson-grid">${split.map(c => cohortLesson(d, cls, i, c)).join('')}</div>` : plainLesson(d, cls, i)}
  </article>`;
}
function cohortLesson(d, cls, i, c) {
  const s = S(), k = C.cohortKey(d, i, c.id), rec = s.cohortLessonRecords[k] ?? { plan: '', actual: '' };
  const prev = C.findPrevCohortLesson(d, cls, c.id, s, i);
  const carry = prev?.record.plan && prev.record.plan !== prev.record.actual ? prev.record.plan : '';
  return `<section class="school-lesson tone-${c.tone}">
    <div class="school-lesson-head"><div><span>${esc(cls)}</span><strong>${esc(c.label)}</strong></div><div class="template-tools">${select({ placeholder: '템플릿', options: s.lessonTemplates.map(t => [t.id, t.name]), attrs: `data-template="${k}"` })}${rec.plan ? `<button type="button" data-save-template="${k}|${c.id}">현재 계획 저장</button>` : ''}</div></div>
    <div class="previous-progress"><span>${prev?.date === d ? '앞 타임' : '이전 진도'}</span><p>${esc(prev?.record.actual || '이전 진도 없음')}</p>${carry ? `<button type="button" data-carry="${k}|${c.id}" data-plan="${esc(carry)}">미완료 이월</button>` : ''}${prev?.record.plan ? `<button type="button" data-copy-plan="${k}" data-plan="${esc(prev.record.plan)}">${icon('copy')} 계획 복사</button>` : ''}</div>
    <div class="lesson-fields"><label><span><em>PLAN</em> 이번 수업 계획</span>${textarea(rec.plan, `data-k="p-${k}" data-rec="${k}|plan|cohort" placeholder="${esc(c.label)}에서 나갈 내용을 간단히 적으세요"`)}</label><label><span><em>DONE</em> 실제 진도</span>${textarea(rec.actual, `data-k="a-${k}" data-rec="${k}|actual|cohort" placeholder="실제로 마친 범위를 적으세요"`)}</label></div>
  </section>`;
}
function plainLesson(d, cls, i) {
  const s = S(), k = `${d}-${i}`, rec = s.lessonRecords[k] ?? { plan: '', actual: '' }, prev = C.findPrevLesson(d, cls, s, i);
  return `<div class="previous-progress"><span>${prev?.date === d ? '앞 타임 진도' : '이전 수업 진도'}</span><p>${esc(prev?.record.actual || '아직 기록된 이전 진도가 없어요.')}</p>${prev?.record.plan ? `<button type="button" data-copy-plan-plain="${k}" data-plan="${esc(prev.record.plan)}" data-from="${prev.date}">이전 계획 복사</button>` : ''}</div>
    <div class="lesson-fields"><label><span><em>PLAN</em> 이번 수업에서 할 것</span>${textarea(rec.plan, `data-k="p-${k}" data-rec="${k}|plan|plain" placeholder="이번 수업에서 나갈 내용을 적으세요"`)}</label><label><span><em>DONE</em> 실제로 나간 진도</span>${textarea(rec.actual, `data-k="a-${k}" data-rec="${k}|actual|plain" placeholder="실제로 마친 범위를 적으세요"`)}</label></div>`;
}

/* ---------------------------------------------------------------- week */
function weekView() {
  const s = S(), mon = C.mondayOf(A.sel), days = Array.from({ length: 7 }, (_, i) => C.addDays(mon, i));
  const taskSpan = t => `<span class="${t.done ? 'done' : ''}">${esc(t.start)} ${esc(t.title)}</span>`;
  return `<section class="wide-section">
    <div class="month-title"><div><p class="eyebrow">WEEK PLAN</p><h2>${C.fmtMd(days[0])} – ${C.fmtMd(days[6])}</h2></div><div class="month-nav"><button type="button" data-act="day" data-d="-7" aria-label="이전 주">${icon('chevron-left')}</button><button type="button" data-act="day" data-d="7" aria-label="다음 주">${icon('chevron-right')}</button></div></div>
    <div class="week-grid">${days.map(d => {
      const tasks = s.tasks.filter(t => t.date === d).sort((a, b) => (a.start ?? '').localeCompare(b.start ?? '')), classes = C.classesOn(d, s), ov = s.scheduleOverrides[d];
      return `<button type="button" class="week-day ${d === A.today ? 'is-today' : ''}" data-goto="${d}"><div class="week-date"><span>${C.WD[C.weekday(d)]}</span><strong>${Number(d.slice(8))}</strong></div><div class="week-stack">${tasks.filter(t => (t.start ?? '') < '16:30').map(taskSpan).join('')}${ov ? `<span class="exception-pill">${esc(ov.label)}</span>` : ''}${classes.map((c, i) => c ? `<span class="class-pill">${C.SLOT_TIMES[i]?.[0] ?? '보강'} ${esc(c)}</span>` : '').join('')}${tasks.filter(t => (t.start ?? '') >= '16:30').map(taskSpan).join('')}${!tasks.length && !classes.length ? '<em>일정 없음</em>' : ''}</div></button>`;
    }).join('')}</div>
    <div class="week-review"><div><span class="icon-tile purple">${icon('sparkles')}</span><div><strong>이번 주 마감</strong><p>잘된 점, 밀린 진도, 다음 주 우선순위를 짧게 남겨두세요.</p></div></div>${textarea(s.weeklyReviews[mon] ?? '', `data-k="weekly" data-weekly="${mon}" placeholder="예: 강서고 1과 마무리. 다음 주 단원고 모의고사 29~31번 우선."`)}</div>
  </section>`;
}

/* ---------------------------------------------------------------- month + exams */
function monthView() {
  const s = S(), first = A.monthCursor, [y, m] = first.split('-').map(Number), start = C.addDays(first, -C.weekday(first)), f = A.monthFilter;
  const days = Array.from({ length: 42 }, (_, i) => C.addDays(start, i)), exams = C.examsOf(s);
  const cohorts = f === 'all' ? C.COHORTS : C.COHORTS.filter(c => c.id === f);
  return `<section class="month-layout">
    <div class="calendar-panel">
      <div class="month-title"><div><p class="eyebrow">MONTH PLAN</p><h2>${y}년 ${m}월</h2><span class="month-help">반을 고른 뒤 날짜를 눌러, 나갈 진도를 한 줄로 적어보세요.</span></div><div class="month-nav"><button type="button" data-act="month" data-d="-1" aria-label="이전 달">${icon('chevron-left')}</button><button type="button" data-act="month" data-d="1" aria-label="다음 달">${icon('chevron-right')}</button></div></div>
      <div class="cohort-tabs"><button type="button" class="${f === 'all' ? 'active' : ''}" data-month-filter="all">전체</button>${C.COHORTS.map(c => `<button type="button" class="${f === c.id ? `active tone-${c.tone}` : ''}" data-month-filter="${c.id}">${esc(c.label)}</button>`).join('')}</div>
      <div class="calendar-weekdays">${C.WD.map(w => `<span>${w}</span>`).join('')}</div>
      <div class="calendar-grid">${days.map(d => {
        const ov = s.scheduleOverrides[d], ex = exams.filter(x => d >= x.start && d <= x.end);
        return `<button type="button" class="calendar-day ${d.slice(0, 7) === first.slice(0, 7) ? '' : 'outside'} ${d === A.today ? 'today' : ''}" data-month-day="${d}"><span class="day-number">${Number(d.slice(8))}</span><div class="day-events">${ov ? `<span class="schedule-event">${esc(ov.label)}</span>` : ''}${ex.map(x => `<span class="exam-event ${x.color}">${esc(x.school)}</span>`).join('')}${cohorts.map(c => { const t = s.monthlyClassPlans[c.id]?.[d]; return t ? `<small class="month-plan-note tone-${c.tone}"><b>${f === 'all' ? esc(c.short) : '계획'}</b>${esc(t)}</small>` : ''; }).join('')}</div></button>`;
      }).join('')}</div>
    </div>
    ${examBoard()}
  </section>`;
}
function examBoard() {
  const list = C.sortExams(C.examsOf(S())), up = list.filter(x => C.examUpcoming(x, A.today)), ended = list.filter(x => !C.examUpcoming(x, A.today)).reverse();
  return `<aside class="exam-board">
    <div class="exam-board-head"><span>학교별 시험 준비 현황</span><button type="button" class="exam-add" data-exam-edit="">${icon('plus')} 시험 추가</button></div>
    ${up.length ? '' : '<p class="hub-empty">예정된 시험이 없어요.</p>'}
    ${up.map(examCard).join('')}
    ${ended.length ? `<details class="exam-ended" data-k="exam-ended"><summary>끝난 시험 ${ended.length}개</summary>${ended.map(examCard).join('')}</details>` : ''}
  </aside>`;
}
function examCard(x) {
  const s = S(), linked = C.COHORTS.filter(c => (x.cohortIds ?? []).includes(c.id)), undated = C.examUndated(x), over = !undated && x.end < A.today;
  const hist = linked.flatMap(c => [...(s.examHistory?.[c.id] || [])].reverse().map(h => [c, h]));
  return `<article class="exam-card ${over ? 'is-ended' : ''}">
    <div class="exam-card-top"><span class="exam-dot ${x.color}"></span><div><strong>${esc(x.school)}</strong><span>${esc(x.label)} · ${undated ? '날짜 미정' : `${C.fmtMd(x.start)}–${C.fmtMd(x.end)}`}</span></div><em class="${undated ? 'is-undated' : ''}">${C.examStatus(x, A.today)}</em><button type="button" class="exam-edit" data-exam-edit="${esc(x.id)}" aria-label="시험 수정">${icon('pencil')}</button></div>
    ${undated ? `<button type="button" class="exam-date-cta" data-exam-edit="${esc(x.id)}">시험 날짜를 정해 주세요</button>` : ''}
    ${x.scope?.length ? `<details class="exam-scope" data-k="scope-${esc(x.id)}"><summary>시험 범위 보기</summary><ul>${x.scope.map(l => `<li>${esc(l)}</li>`).join('')}</ul></details>` : ''}
    ${linked.map(c => { const pct = C.rangeStats(s, c.id).pct; return `<div class="exam-cohort"><div class="exam-progress-row"><span>${linked.length > 1 ? esc(c.label) : '범위 완료율'}${!over && !undated ? ` · 남은 수업 ${C.remainingClasses(A.today, c.id, s)}회` : ''}</span><strong>${pct}%</strong></div>${progress(pct)}</div>`; }).join('')}
    ${!undated && linked.length && x.start <= A.today ? button(`${icon('archive')} 시험 끝 · 다음 시험 준비`, { variant: 'ghost', size: 'xs', cls: 'exam-roll', attrs: `data-exam-roll="${esc(x.id)}"` }) : ''}
    ${hist.length ? `<details class="exam-scope exam-history" data-k="hist-${esc(x.id)}"><summary>지난 시험 기록 ${hist.length}개</summary><div class="exam-history-list">${hist.map(([c, h]) => {
      const n = h.items.filter(i => h.checks[i.id]).length, pct = h.items.length ? Math.round(n / h.items.length * 100) : 0;
      return `<div class="exam-history-item"><div><strong>${linked.length > 1 ? `${esc(c.label)} · ` : ''}${esc(h.label)}</strong><span>${h.start ? `${C.fmtMd(h.start)}–${C.fmtMd(h.end)} · ` : ''}${n}/${h.items.length} · ${pct}%</span></div>${h.items.length ? `<p>${h.items.map(i => `<span class="${h.checks[i.id] ? 'checked' : ''}">${h.checks[i.id] ? icon('check') : ''}${esc(i.label)}</span>`).join('')}</p>` : ''}</div>`;
    }).join('')}</div></details>` : ''}
  </article>`;
}

/* ---------------------------------------------------------------- hub */
function hubView() {
  const s = S();
  return `<section class="hub-section">
    <div class="month-title"><div><p class="eyebrow">QUICK CAPTURE</p><h2>메모와 수업 자료</h2><span class="month-help">생각난 일과 자주 쓰는 PDF·Drive 링크를 한곳에 모아두세요.</span></div></div>
    <div class="hub-grid">
      <article class="hub-card"><div class="hub-card-title"><span class="icon-tile purple">${icon('sticky-note')}</span><div><strong>빠른 메모</strong><span>나중에 처리할 일을 바로 적어요</span></div></div>
        <div class="capture-row">${input('data-k="memo-new" data-draft placeholder="예: 중3 프린트 수정"')}${button(`${icon('plus')} 추가`, { attrs: 'data-act="memo-add"' })}</div>
        <div class="memo-list">${s.quickMemos.length ? '' : '<p class="hub-empty">메모가 없어요.</p>'}${s.quickMemos.map(m => `<div class="${m.done ? 'memo-item done' : 'memo-item'}">${checkbox(m.done, `data-memo-done="${esc(m.id)}"`)}<span>${esc(m.text)}</span><small>${new Date(m.createdAt).toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' })}</small><button type="button" data-memo-del="${esc(m.id)}" aria-label="메모 삭제">${icon('trash-2')}</button></div>`).join('')}</div></article>
      <article class="hub-card"><div class="hub-card-title"><span class="icon-tile blue">${icon('link-2')}</span><div><strong>수업 자료 링크</strong><span>PDF와 Drive 자료를 학교별로 정리해요</span></div></div>
        <div class="link-form">${input('data-k="link-label" data-draft placeholder="자료 이름"')}${input('data-k="link-url" data-draft placeholder="https://…"')}${select({ value: A.linkCohort, options: [['all', '공통 자료'], ...C.COHORTS.map(c => [c.id, c.label])], attrs: 'data-link-cohort' })}${button(`${icon('plus')} 링크 추가`, { attrs: 'data-act="link-add"' })}</div>
        <div class="resource-list">${s.resourceLinks.length ? '' : '<p class="hub-empty">저장한 자료가 없어요.</p>'}${s.resourceLinks.map(l => `<div class="resource-item"><a href="${esc(l.url)}" target="_blank" rel="noreferrer">${icon('link-2')}<span><strong>${esc(l.label)}</strong><small>${l.cohortId === 'all' ? '공통' : esc(C.COHORTS.find(c => c.id === l.cohortId)?.label ?? '')}</small></span></a><button type="button" data-link-del="${esc(l.id)}" aria-label="링크 삭제">${icon('x')}</button></div>`).join('')}</div></article>
    </div>
    <article class="template-manager"><div><strong>수업 템플릿</strong><span>수업 계획 화면에서 클릭 한 번으로 불러와요.</span></div><div>${s.lessonTemplates.map(t => `<span><b>${esc(t.name)}</b>${esc(t.content)}<button type="button" data-template-del="${esc(t.id)}" aria-label="템플릿 삭제">${icon('x')}</button></span>`).join('')}</div></article>
    <article class="pin-manager"><div><strong>접속 PIN 변경</strong><span>현재 PIN보다 추측하기 어려운 숫자를 사용하세요.</span></div>
      <div>${input('type="password" inputmode="numeric" data-k="pin-cur" data-draft placeholder="현재 PIN"')}${input('type="password" inputmode="numeric" data-k="pin-new" data-draft placeholder="새 PIN 4~8자리"')}${button('PIN 변경', { attrs: 'data-act="pin-change"' })}<small id="pin-msg" ${A.pinMsg ? '' : 'hidden'}>${esc(A.pinMsg)}</small></div></article>
  </section>`;
}

/* ---------------------------------------------------------------- dialogs */
const actions = (cancel, ok, extra = '') => `<div class="dialog-actions">${extra}${button(cancel, { variant: 'ghost', attrs: 'data-close' })}${ok}</div>`;
function taskDialog(task) {
  const t = task || { title: '', start: '13:00', end: '14:00', category: '업무' };
  const { el, close } = dialog(task ? '오늘 계획 수정' : '새 일정 추가', `<form>
    <label>일정 이름${input(`autofocus name="title" placeholder="예: 강서고 교재 제작" value="${esc(t.title)}"`)}</label>
    <div class="form-row"><label>시작${input(`type="time" name="start" value="${esc(t.start)}"`)}</label><label>종료${input(`type="time" name="end" value="${esc(t.end)}"`)}</label></div>
    <label>구분${select({ value: t.category, options: C.TASK_CATEGORIES.map(c => [c, c]), attrs: 'data-field="category"' })}</label>
    ${actions('취소', button(task ? '수정 완료' : '추가하기', { type: 'submit' }))}</form>`);
  $('form', el).onsubmit = e => {
    e.preventDefault();
    const f = e.target, title = f.title.value.trim();
    if (!title) return;
    const next = { id: task?.id ?? C.uid(), date: task?.date ?? A.sel, start: f.start.value, end: f.end.value, title, category: $('[data-field=category]', el).dataset.value || '업무', done: task?.done ?? false };
    change(st => { const i = st.tasks.findIndex(x => x.id === next.id); if (i >= 0) st.tasks[i] = next; else st.tasks.push(next); });
    close();
  };
}
// One text box + 취소/저장 (루틴 수정, 시험 범위 추가·수정).
function textDialog({ title, cls = 'task-dialog', desc = '', value = '', placeholder = '', ok, onSave }) {
  const { el, close } = dialog(esc(title), `${desc ? `<p class="dialog-description">${esc(desc)}</p>` : ''}${input(`autofocus value="${esc(value)}"${placeholder ? ` placeholder="${esc(placeholder)}"` : ''}`)}${actions('취소', button(ok, { attrs: 'data-ok' }))}`, { cls });
  const box = $('input', el), save = () => { const v = box.value.trim(); if (!v) return; onSave(v); close(); };
  $('[data-ok]', el).onclick = save;
  box.onkeydown = e => { if (isEnter(e)) { e.preventDefault(); save(); } };
}
function scheduleDialog() {
  const s = S(), d = A.sel, ov = s.scheduleOverrides[d];
  const slots = ov?.classes ?? C.WEEK_SCHEDULE[C.weekday(d)] ?? [];
  const ph = t => t === 'holiday' ? '예: 추석 연휴' : t === 'cancel' ? '예: 전체 휴강' : '예: 중3 보강';
  const type0 = ov?.type ?? 'normal';
  const { el, close } = dialog(`${C.fmtLong(d)} 수업 변경`, `<p>이 날짜에만 적용되며, 다른 요일의 기본 시간표는 바뀌지 않아요.</p>
    <label>일정 종류${select({ value: type0, options: [['normal', '기본 시간표'], ['cancel', '휴강'], ['holiday', '공휴일'], ['custom', '보강·수업 변경']], attrs: 'data-field="type"' })}</label>
    <label data-part="label" ${type0 === 'normal' ? 'hidden' : ''}>표시 이름${input(`data-field="label" value="${esc(ov?.label ?? '')}" placeholder="${ph(type0)}"`)}</label>
    <div class="override-slots" data-part="slots" ${type0 === 'custom' ? '' : 'hidden'}><span>수업 구성</span>${[0, 1, 2, 3].map(i => `<label><b>${i + 1}타임</b>${select({ value: slots[i] || 'none', options: [['none', '수업 없음'], ...C.OVERRIDE_CLASS_OPTIONS.map(o => [o, o])], attrs: `data-slot-no="${i}"` })}</label>`).join('')}</div>
    ${actions('취소', button('적용하기', { attrs: 'data-ok' }))}`, { cls: 'task-dialog schedule-dialog' });
  const typeSel = $('[data-field=type]', el);
  typeSel.addEventListener('selectchange', () => { const t = typeSel.dataset.value; $('[data-part=label]', el).hidden = t === 'normal'; $('[data-part=slots]', el).hidden = t !== 'custom'; $('[data-field=label]', el).placeholder = ph(t); });
  $('[data-ok]', el).onclick = () => {
    const t = typeSel.dataset.value || 'normal', prev = s.scheduleOverrides[d];
    const next = { type: t, label: $('[data-field=label]', el).value.trim() || (t === 'holiday' ? '공휴일' : t === 'cancel' ? '휴강' : '보강·변경'), classes: t === 'custom' ? $$('[data-slot-no]', el).map(x => x.dataset.value === 'none' ? '' : x.dataset.value) : [] };
    change(st => { if (t === 'normal') delete st.scheduleOverrides[d]; else st.scheduleOverrides[d] = next; });
    undoBar(`${C.fmtLong(d)} 수업을 변경했어요.`, () => change(st => { if (prev) st.scheduleOverrides[d] = prev; else delete st.scheduleOverrides[d]; }));
    close();
  };
}
function attendanceDialog() {
  const rows = Object.entries(S().attendance).filter(([, r]) => r && (r.clockIn || r.clockOut || r.wake || r.sleep)).sort((a, b) => b[0].localeCompare(a[0]));
  dialog('출퇴근 · 생활 기록', `<p>${rows.length ? `총 ${rows.length}일의 기록이에요.` : '아직 기록된 시간이 없어요.'}</p>
    ${rows.length ? `<div class="attendance-history"><div class="attendance-history-labels"><span>날짜</span><span>기상</span><span>출근</span><span>퇴근</span><span>취침</span><span>근무시간</span></div>${rows.map(([d, r]) => `<div class="attendance-history-row"><strong>${C.fmtMdDow(d)}</strong><span>${esc(r.wake || '—')}</span><span>${esc(r.clockIn || '—')}</span><span>${esc(r.clockOut || '—')}</span><span>${esc(r.sleep || '—')}</span><em>${r.clockIn && r.clockOut ? C.workDuration(r.clockIn, r.clockOut) : r.clockIn || r.clockOut ? '미완료' : '—'}</em></div>`).join('')}</div>` : ''}`, { cls: 'task-dialog attendance-dialog' });
}
function monthDialog(d) {
  const s = S(); let cohort = A.monthFilter === 'all' ? 'danwon-a' : A.monthFilter;
  const stored = () => s.monthlyClassPlans[cohort]?.[d] ?? '';
  const { el, close } = dialog(`${C.fmtLong(d)} 월간 계획`, `<p>세부 일정이 아니라 그날 나갈 수업 방향만 짧게 적어요.</p>
    <label>반 선택${select({ value: cohort, options: C.COHORTS.map(c => [c.id, `${c.className} · ${c.label}`]), attrs: 'data-field="cohort"' })}</label>
    ${input(`autofocus maxlength="80" placeholder="예: 고1 본문 1과 마무리" data-field="text" value="${esc(stored())}"`)}
    <div class="monthly-examples"><span>예시</span>${['본문 1과 마무리', '모의고사 29번', '시험 전 최종 복습'].map(x => `<button type="button" data-ex="${x}">${x}</button>`).join('')}</div>
    <div class="dialog-actions">${button('취소', { variant: 'ghost', attrs: 'data-close' })}${button('내용 지우기', { variant: 'ghost', attrs: `data-clear ${stored() ? '' : 'hidden'}` })}${button('저장', { attrs: 'data-ok' })}</div>`, { cls: 'task-dialog monthly-dialog' });
  const text = $('[data-field=text]', el), clear = $('[data-clear]', el);
  $('[data-field=cohort]', el).addEventListener('selectchange', e => { cohort = e.detail.value; text.value = stored(); clear.hidden = !stored(); });
  el.addEventListener('click', e => { const b = e.target.closest('[data-ex]'); if (b) text.value = b.dataset.ex; });
  const save = v => { change(st => { (st.monthlyClassPlans[cohort] ||= {})[d] = v; }); close(); };
  $('[data-ok]', el).onclick = () => save(text.value.trim());
  clear.onclick = () => save('');
  text.onkeydown = e => { if (isEnter(e)) { e.preventDefault(); save(text.value.trim()); } };
}
function examDialog(id) {
  const exam = C.examsOf(S()).find(x => x.id === id) || {}, isNew = !exam.id;
  const f = { school: exam.school ?? '', label: exam.label ?? '기말고사', start: exam.start || A.today, end: exam.end || exam.start || A.today, color: exam.color ?? 'blue', cohortIds: exam.cohortIds ?? [], scope: (exam.scope ?? []).join('\n') };
  const { el, close } = dialog(isNew ? '시험 추가' : '시험 수정', `<form>
    <div class="form-row"><label>학교${input(`${isNew ? 'autofocus ' : ''}data-field="school" value="${esc(f.school)}" placeholder="예: 단원고"`)}</label><label>시험 이름${input(`data-field="label" value="${esc(f.label)}" placeholder="예: 기말고사"`)}</label></div>
    <div class="form-row"><label>시작일${input(`type="date" data-field="start" value="${f.start}"`)}</label><label>종료일${input(`type="date" data-field="end" min="${f.start}" value="${f.end}"`)}</label></div>
    <div class="exam-field"><span>연결할 반</span><div class="exam-cohort-picks">${C.COHORTS.map(c => `<label class="exam-pick">${checkbox(f.cohortIds.includes(c.id), `data-pick="${c.id}"`)}<span>${esc(c.label)}</span></label>`).join('')}</div></div>
    <div class="exam-field"><span>색상</span><div class="exam-colors">${C.EXAM_COLORS.map(([c, n]) => `<button type="button" class="exam-color ${c} ${f.color === c ? 'active' : ''}" data-color="${c}" aria-label="${n}" title="${n}"></button>`).join('')}</div></div>
    <label>시험 범위 (한 줄에 하나씩)${textarea(f.scope, 'data-field="scope" placeholder="예: 교과서 본문 1과 · 2과&#10;모의고사 21, 23, 29번"')}</label>
    <small class="exam-note">번호별 체크리스트는 '수업 계획 · 진도' 화면의 '범위 추가'에서 관리해요.</small>
    ${actions('취소', button(isNew ? '추가하기' : '수정 완료', { type: 'submit', attrs: 'data-ok' }), isNew ? '' : button('삭제', { variant: 'ghost', cls: 'exam-delete', attrs: 'data-del' }))}</form>`, { cls: 'task-dialog exam-dialog' });
  const field = k => $(`[data-field=${k}]`, el);
  let color = f.color;
  const valid = () => field('school').value.trim() && field('start').value && field('end').value && field('end').value >= field('start').value;
  const sync = () => { $('[data-ok]', el).disabled = !valid(); };
  el.addEventListener('input', sync);
  field('start').addEventListener('change', () => { const v = field('start').value, end = field('end'); end.min = v; if (end.value < v) end.value = v; sync(); });
  el.addEventListener('click', e => {
    const cb = e.target.closest('[role=checkbox]'); if (cb) setCheckbox(cb, !isChecked(cb));
    const c = e.target.closest('[data-color]'); if (c) { color = c.dataset.color; $$('[data-color]', el).forEach(x => x.classList.toggle('active', x === c)); }
  });
  sync();
  $('form', el).onsubmit = e => {
    e.preventDefault();
    if (!valid()) return;
    const next = { ...exam, id: exam.id ?? `exam-${C.uid()}`, school: field('school').value.trim(), label: field('label').value.trim() || '시험', start: field('start').value, end: field('end').value, color, cohortIds: $$('[data-pick]', el).filter(isChecked).map(x => x.dataset.pick), scope: field('scope').value.split('\n').map(x => x.trim()).filter(Boolean) };
    change(st => { st.exams = C.examsOf(st).map(x => ({ ...x })); const i = st.exams.findIndex(x => x.id === next.id); if (i >= 0) st.exams[i] = next; else st.exams.push(next); });
    close();
  };
  $('[data-del]', el)?.addEventListener('click', () => {
    if (!confirm(`‘${exam.school} ${exam.label}’ 시험을 삭제할까요?`)) return;
    change(st => { st.exams = C.examsOf(st).filter(x => x.id !== exam.id); });
    close();
  });
}

/* ---------------------------------------------------------------- events */
root.addEventListener('click', async e => {
  if (!store?.data) return;
  const s = S();
  const cb = e.target.closest('[role=checkbox]');
  if (cb) {
    const on = !isChecked(cb), d = cb.dataset;
    if (d.taskDone) change(st => { const x = st.tasks.find(y => y.id === d.taskDone); if (x) x.done = on; });
    else if (d.routine) change(st => { st.routineChecks[`${A.sel}-${d.routine}`] = on; });
    else if (d.rangeCheck) change(st => { const [c, id] = d.rangeCheck.split('|'), k = `${c}-${id}`; if (on) st.rangeChecks[k] = true; else delete st.rangeChecks[k]; });
    else if (d.memoDone) change(st => { const m = st.quickMemos.find(x => x.id === d.memoDone); if (m) m.done = on; });
    return;
  }
  const b = e.target.closest('button');
  if (!b || b.dataset.slot === 'select-trigger') return;
  const d = b.dataset;
  if (d.tab) { A.tab = d.tab; render(); window.scrollTo(0, 0); return; }
  if (d.goto) { A.sel = d.goto; A.tab = 'today'; render(); window.scrollTo(0, 0); return; }
  if (d.now) {
    const key = d.now, day = key === 'sleep' ? C.sleepDay() : A.sel;
    change(st => { (st.attendance[day] ||= { clockIn: '', clockOut: '' })[key] = C.nowHM(); if (key === 'wake') st.routineChecks[`${day}-wake`] = true; });
    if (day !== A.sel) toast(`${C.fmtMd(day)} 밤 취침으로 기록했어요.`);
    return;
  }
  if (d.taskEdit) return taskDialog(s.tasks.find(t => t.id === d.taskEdit));
  if (d.taskDel) { const t = s.tasks.find(x => x.id === d.taskDel); if (!t) return; change(st => { st.tasks = st.tasks.filter(x => x.id !== t.id); }); undoBar(`‘${t.title}’ 일정을 삭제했어요.`, () => change(st => { st.tasks.push(t); })); return; }
  if (d.classDone) { change(st => { st.classDone[d.classDone] = !st.classDone[d.classDone]; }); return; }
  if (d.routineMove) { const i = Number(d.routineMove), j = i + Number(d.d); if (j < 0 || j >= s.routineItems.length) return; change(st => { const r = st.routineItems; [r[i], r[j]] = [r[j], r[i]]; }); return; }
  if (d.routineEdit) { const r = s.routineItems.find(x => x.id === d.routineEdit); textDialog({ title: '루틴 수정', value: r.title, ok: '수정 완료', onSave: v => change(st => { const x = st.routineItems.find(y => y.id === r.id); if (x) x.title = v; }) }); return; }
  if (d.routineDel) { const i = s.routineItems.findIndex(x => x.id === d.routineDel), r = s.routineItems[i]; change(st => { st.routineItems = st.routineItems.filter(x => x.id !== r.id); }); undoBar(`‘${r.title}’ 루틴을 삭제했어요.`, () => change(st => { st.routineItems.splice(i, 0, r); })); return; }
  if (d.rangeAdd) { const c = C.COHORTS.find(x => x.id === d.rangeAdd); textDialog({ title: '시험 범위 추가', desc: `${c.className} · ${c.label}`, placeholder: '예: 모의고사 28번', ok: '추가하기', onSave: v => change(st => { st.rangeItems[c.id] = [...(st.rangeItems[c.id] ?? []), { id: C.uid(), label: v }]; }) }); return; }
  if (d.rangeEdit) { const [cid, id] = d.rangeEdit.split('|'), c = C.COHORTS.find(x => x.id === cid), it = C.itemsOf(s, cid).find(x => x.id === id); textDialog({ title: '시험 범위 수정', desc: `${c.className} · ${c.label}`, value: it.label, placeholder: '예: 모의고사 28번', ok: '수정 완료', onSave: v => change(st => { st.rangeItems[cid] = C.itemsOf(st, cid).map(x => x.id === id ? { ...x, label: v } : x); }) }); return; }
  if (d.rangeDel) { const [cid, id] = d.rangeDel.split('|'), items = C.itemsOf(s, cid), i = items.findIndex(x => x.id === id), it = items[i]; change(st => { st.rangeItems[cid] = items.filter(x => x.id !== id); }); undoBar(`‘${it.label}’ 범위를 삭제했어요.`, () => change(st => { const l = [...C.itemsOf(st, cid)]; l.splice(i, 0, it); st.rangeItems[cid] = l; })); return; }
  if (d.carry) { const [k, cid] = d.carry.split('|'), plan = d.plan, old = s.cohortLessonRecords[k]?.plan ?? ''; change(st => { st.cohortLessonRecords[k] = { ...(st.cohortLessonRecords[k] ?? { plan: '', actual: '' }), plan }; }); undoBar(`${C.COHORTS.find(c => c.id === cid).label} 미완료 계획을 이월했어요.`, () => change(st => { st.cohortLessonRecords[k] = { ...(st.cohortLessonRecords[k] ?? { plan: '', actual: '' }), plan: old }; })); return; }
  if (d.copyPlan) { change(st => { st.cohortLessonRecords[d.copyPlan] = { ...(st.cohortLessonRecords[d.copyPlan] ?? { plan: '', actual: '' }), plan: d.plan }; }); return; }
  if (d.copyPlanPlain) { const k = d.copyPlanPlain, old = s.lessonRecords[k]?.plan ?? ''; change(st => { st.lessonRecords[k] = { ...(st.lessonRecords[k] ?? { plan: '', actual: '', homework: '', next: '' }), plan: d.plan }; }); undoBar(`${C.fmtMd(d.from)} 계획을 복사했어요.`, () => change(st => { st.lessonRecords[k] = { ...(st.lessonRecords[k] ?? { plan: '', actual: '', homework: '', next: '' }), plan: old }; })); return; }
  if (d.saveTemplate) { const [k, cid] = d.saveTemplate.split('|'); change(st => { st.lessonTemplates.push({ id: C.uid(), name: `${C.COHORTS.find(c => c.id === cid).short} 수업`, content: st.cohortLessonRecords[k].plan }); }); return; }
  if (d.monthFilter) { A.monthFilter = d.monthFilter; render(); return; }
  if (d.monthDay) return monthDialog(d.monthDay);
  if (d.examEdit !== undefined) return examDialog(d.examEdit || null);
  if (d.examRoll) {
    const x = C.examsOf(s).find(y => y.id === d.examRoll); if (!x) return;
    if (!confirm(`${x.school} ${x.label}을(를) 마치고 다음 시험을 준비할까요?\n지금 범위와 체크는 '지난 시험 기록'에 보관되고, 범위는 새로 비워져요.`)) return;
    change(st => C.rollExam(st, x.id));
    toast(`${x.school}: ${C.nextExamLabel(x.label)} 준비를 시작해요. 시험 날짜를 정해 주세요.`);
    return;
  }
  if (d.memoDel) { const m = s.quickMemos.find(x => x.id === d.memoDel); change(st => { st.quickMemos = st.quickMemos.filter(x => x.id !== m.id); }); undoBar('메모를 삭제했어요.', () => change(st => { st.quickMemos.unshift(m); })); return; }
  if (d.linkDel) { const l = s.resourceLinks.find(x => x.id === d.linkDel); change(st => { st.resourceLinks = st.resourceLinks.filter(x => x.id !== l.id); }); undoBar(`‘${l.label}’ 링크를 삭제했어요.`, () => change(st => { st.resourceLinks.push(l); })); return; }
  if (d.templateDel) { const t = s.lessonTemplates.find(x => x.id === d.templateDel); change(st => { st.lessonTemplates = st.lessonTemplates.filter(x => x.id !== t.id); }); undoBar(`‘${t.name}’ 템플릿을 삭제했어요.`, () => change(st => { st.lessonTemplates.push(t); })); return; }
  switch (d.act) {
    case 'day': A.sel = C.addDays(A.sel, Number(d.d)); render(); break;
    case 'to-today': A.sel = C.todayKst(); render(); break;
    case 'month': { const [y, m] = A.monthCursor.split('-').map(Number), n = new Date(Date.UTC(y, m - 1 + Number(d.d), 1)); A.monthCursor = n.toISOString().slice(0, 10); render(); break; }
    case 'schedule': scheduleDialog(); break;
    case 'task-new': taskDialog(null); break;
    case 'attendance': attendanceDialog(); break;
    case 'routine-add': addRoutine(); break;
    case 'memo-add': addMemo(); break;
    case 'link-add': addLink(); break;
    case 'pin-change': changePin(); break;
    case 'widget': window.open('/widget', 'sumus-widget', 'width=410,height=780,resizable=yes'); break;
    case 'save-now': store.save(); break;
    case 'backup': backup(); break;
    case 'restore': $('#restore-file', root)?.click(); break;
    case 'lock': await store.save(); signOut(); break;
    case 'relogin': location.reload(); break;
  }
});
root.addEventListener('selectchange', e => {
  const d = e.target.dataset;
  if (d.template) { const tpl = S().lessonTemplates.find(x => x.id === e.detail.value); if (tpl) change(st => { st.cohortLessonRecords[d.template] = { ...(st.cohortLessonRecords[d.template] ?? { plan: '', actual: '' }), plan: tpl.content }; }); }
  else if (d.linkCohort !== undefined) A.linkCohort = e.detail.value;
});
root.addEventListener('change', e => {
  const t = e.target, d = t.dataset;
  if (t.id === 'restore-file') { const file = t.files?.[0]; t.value = ''; if (file) restore(file); }
  else if (d.time) { const key = d.time, day = A.sel; change(st => { (st.attendance[day] ||= { clockIn: '', clockOut: '' })[key] = t.value; }, { render: false }); patchAttendance(); }
});
root.addEventListener('input', e => {
  const t = e.target, d = t.dataset;
  if (d.rec) {
    const [k, field, kind] = d.rec.split('|');
    change(st => { const box = kind === 'cohort' ? st.cohortLessonRecords : st.lessonRecords; box[k] = { ...(box[k] ?? (kind === 'cohort' ? { plan: '', actual: '' } : { plan: '', actual: '', homework: '', next: '' })), [field]: t.value }; }, { render: false });
  } else if (d.weekly) change(st => { st.weeklyReviews[d.weekly] = t.value; }, { render: false });
});
root.addEventListener('keydown', e => {
  if (!isEnter(e)) return;
  const k = e.target.dataset?.k;
  if (k === 'routine-new') { e.preventDefault(); addRoutine(); }
  if (k === 'memo-new') { e.preventDefault(); addMemo(); }
});
const field = k => root.querySelector(`[data-k="${k}"]`);
function addRoutine() { const i = field('routine-new'), v = i?.value.trim(); if (!v) return; i.value = ''; change(st => { st.routineItems.push({ id: C.uid(), title: v }); }); }
function addMemo() { const i = field('memo-new'), v = i?.value.trim(); if (!v) return; i.value = ''; change(st => { st.quickMemos.unshift({ id: C.uid(), text: v, done: false, createdAt: new Date().toISOString() }); }); }
function addLink() {
  const label = field('link-label').value.trim(), raw = field('link-url').value.trim(), cohortId = A.linkCohort;
  if (!label || !raw) return;
  field('link-label').value = ''; field('link-url').value = '';
  change(st => { st.resourceLinks.push({ id: C.uid(), label, url: /^https?:\/\//i.test(raw) ? raw : `https://${raw}`, cohortId }); });
}
function showPinMsg(text) { A.pinMsg = text; const el = document.getElementById('pin-msg'); if (el) { el.textContent = text; el.hidden = !text; } }
async function changePin() {
  showPinMsg('변경 중…');
  try {
    await api('/api/auth', { method: 'PATCH', body: JSON.stringify({ currentPin: field('pin-cur').value, newPin: field('pin-new').value }) });
    alert('PIN이 변경됐어요. 새 PIN으로 다시 들어와 주세요.'); location.reload();
  } catch (err) { showPinMsg(err.status ? err.message || 'PIN을 변경하지 못했어요.' : '연결을 확인하고 다시 시도해주세요.'); }
}
function backup() {
  const blob = new Blob([JSON.stringify(S(), null, 2)], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `SUMUS_Planner_${C.todayKst()}.json`; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
async function restore(file) {
  try {
    const data = JSON.parse(await file.text());
    if (!data || typeof data !== 'object' || !Array.isArray(data.tasks)) throw new Error('bad');
    if (!confirm('백업 파일로 현재 데이터를 덮어쓸까요?\n(서버에 저장된 내용도 바뀌어요. 먼저 \'백업 받기\'를 권장해요.)')) return;
    // The backup replaces everything (its own migrations flag included), then exams move on.
    change(st => { const next = C.normalizeState(data, C.todayKst()); Object.keys(st).forEach(k => delete st[k]); Object.assign(st, next); });
    housekeeping();
  } catch { alert('올바른 SUMUS Planner 백업 파일이 아니에요.'); }
}

boot();
