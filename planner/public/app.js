// SUMUS 수업관리 플래너 — the planner page (/). Rebuilt 2026-10-01 from the ChatGPT Sites
// version (same saved data), with the 1차 fixes and the 2차 requests (근무·기상/취침 기록,
// 시험이 끝나면 다음 시험 준비, 디자인 정리).
import { createStore, api } from './sync.js';
import { ensureSignedIn, signOut } from './auth.js';
import { icon, esc, isEnter, $, $$, dialog, undoBar, toast } from './ui.js';
import * as C from './core.js';

const root = document.getElementById('app');
const A = { today: C.todayKst(), sel: C.todayKst(), tab: 'today', monthCursor: C.todayKst().slice(0, 8) + '01', monthFilter: 'all', status: { state: 'loading' } };
let store = null;
const S = () => store.data;
const change = (fn, opts) => store.change(fn, opts);

const TABS = [['today', '오늘', 'today'], ['lessons', '수업 · 진도', 'book'], ['week', '주간', 'week'], ['month', '월간 · 시험', 'month'], ['hub', '메모 · 자료', 'memo']];

/* ---------------------------------------------------------------- boot */
async function boot() {
  root.innerHTML = loading('플래너를 불러오는 중…');
  try { await ensureSignedIn(root); } catch { root.innerHTML = loading('서버에 연결하는 중이에요. 자동으로 다시 시도해요…'); setTimeout(boot, 3000); return; }
  store = createStore({
    normalize: st => C.normalizeState(st, C.todayKst()),
    onChange: () => render(),
    onStatus: st => { A.status = st; drawStatus(); }
  });
  for (let attempt = 0; ; attempt++) {
    try { await store.load(); break; }
    catch (err) {
      if (err.status === 401) { location.reload(); return; }
      root.innerHTML = loading('서버에 연결하는 중이에요. 자동으로 다시 시도해요…');
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
const loading = text => `<main class="gate"><div class="gate-card"><div class="spinner"></div><p>${esc(text)}</p></div></main>`;
// Exams that ended move on to the next one (and the one-off move of 단원고·선부고).
function housekeeping() {
  const probe = JSON.parse(JSON.stringify(S()));
  C.applyMigrations(probe); const rolled = C.autoRollExams(probe, A.today);
  if (JSON.stringify(probe) === JSON.stringify(S())) return;
  change(s => { C.applyMigrations(s); C.autoRollExams(s, A.today); });
  if (rolled.length) toast(`${rolled.join(', ')} 시험이 끝나서 다음 시험 준비로 넘어갔어요.`);
}
function tick() {
  const now = C.todayKst();
  if (now !== A.today) { if (A.sel === A.today) A.sel = now; A.today = now; housekeeping(); render(); }
  else if (A.tab === 'today') drawDayCard();
}

/* ---------------------------------------------------------------- shell */
function render() {
  if (!store?.data) return;
  const focus = document.activeElement?.dataset?.focus, sel = focus ? [document.activeElement.selectionStart, document.activeElement.selectionEnd] : null;
  const s = S(), ge = C.sortExams(C.examsOf(s)).find(x => C.examUpcoming(x, A.today) && !C.examUndated(x));
  root.innerHTML = `<div class="shell">
    <aside class="side">
      <div class="brand"><span class="brand-mark">S</span><div><b>SUMUS</b><small>PLANNER</small></div></div>
      <nav class="nav">${TABS.map(([id, label, ic]) => `<button type="button" class="nav-item ${A.tab === id ? 'on' : ''}" data-tab="${id}">${icon(ic)}<span>${label}</span></button>`).join('')}</nav>
      <div class="side-exam">${ge ? `<small>가장 가까운 시험</small><b>${esc(ge.school)} ${esc(ge.label)}</b><span class="pill tone-${ge.color}">${C.examStatus(ge, A.today)}</span>` : '<small>가장 가까운 시험</small><b>예정된 시험 없음</b>'}</div>
      <div class="profile"><span class="avatar">김</span><div><b>${C.DISPLAY_NAME}</b><small>썸어스학원</small></div></div>
    </aside>
    <main class="main">
      <header class="top">${topTitle()}<div class="top-actions"><div id="save-status"></div>
        <button type="button" class="icon-btn" data-act="widget" title="바탕화면 위젯">${icon('monitor')}</button>
        <div class="menu-wrap"><button type="button" class="icon-btn" data-act="menu" title="더 보기" aria-haspopup="true">${icon('more')}</button></div></div></header>
      <div class="view">${view()}</div>
    </main>
    <nav class="bottom-nav">${TABS.map(([id, label, ic]) => `<button type="button" class="${A.tab === id ? 'on' : ''}" data-tab="${id}">${icon(ic)}<span>${label.split(' · ')[0]}</span></button>`).join('')}</nav>
    ${['today', 'lessons'].includes(A.tab) ? `<button type="button" class="fab" data-act="task-new" aria-label="일정 추가">${icon('plus')}</button>` : ''}
  </div>`;
  drawStatus();
  if (focus) { const el = root.querySelector(`[data-focus="${focus}"]`); if (el) { el.focus(); try { el.setSelectionRange(...sel); } catch {} } }
}
function topTitle() {
  if (A.tab === 'today' || A.tab === 'lessons') {
    const ov = S().scheduleOverrides[A.sel];
    return `<div class="date-nav"><button type="button" class="icon-btn" data-act="day" data-d="-1" aria-label="이전 날짜">${icon('left')}</button>
      <div class="date-title"><h1>${C.fmtLong(A.sel)}</h1><small>${A.sel === A.today ? '오늘' : A.sel}</small></div>
      <button type="button" class="icon-btn" data-act="day" data-d="1" aria-label="다음 날짜">${icon('right')}</button>
      ${A.sel !== A.today ? '<button type="button" class="chip" data-act="to-today">오늘</button>' : ''}
      <button type="button" class="chip ${ov ? 'chip-warn' : ''}" data-act="schedule">${esc(ov?.label ?? '수업 변경')}</button></div>`;
  }
  if (A.tab === 'week') { const mon = C.mondayOf(A.sel); return `<div class="date-nav"><button type="button" class="icon-btn" data-act="day" data-d="-7" aria-label="이전 주">${icon('left')}</button><div class="date-title"><h1>${C.fmtMd(mon)} – ${C.fmtMd(C.addDays(mon, 6))}</h1><small>주간 계획</small></div><button type="button" class="icon-btn" data-act="day" data-d="7" aria-label="다음 주">${icon('right')}</button></div>`; }
  if (A.tab === 'month') { const [y, m] = A.monthCursor.split('-').map(Number); return `<div class="date-nav"><button type="button" class="icon-btn" data-act="month" data-d="-1" aria-label="이전 달">${icon('left')}</button><div class="date-title"><h1>${y}년 ${m}월</h1><small>월간 계획 · 시험</small></div><button type="button" class="icon-btn" data-act="month" data-d="1" aria-label="다음 달">${icon('right')}</button></div>`; }
  return '<div class="date-title"><h1>메모 · 자료</h1><small>생각난 일과 자주 쓰는 자료를 한곳에</small></div>';
}
function drawStatus() {
  const el = document.getElementById('save-status'); if (!el) return;
  const st = A.status.state;
  const time = A.status.updatedAt ? new Date(A.status.updatedAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Seoul' }) : '';
  const text = st === 'saving' || st === 'dirty' ? '저장 중…' : st === 'saved' ? `${time || '방금'} 저장됨` : st === 'loading' ? '불러오는 중' : (A.status.message || '저장 재시도 필요');
  el.className = `save-pill ${st}`;
  el.innerHTML = `${icon(st === 'error' ? 'cloudOff' : 'cloud')}<span>${esc(text)}</span>${st === 'error' ? '<button type="button" data-act="save-now">다시 저장</button>' : ''}`;
}
function view() {
  if (A.tab === 'lessons') return lessonsView();
  if (A.tab === 'week') return weekView();
  if (A.tab === 'month') return monthView();
  if (A.tab === 'hub') return hubView();
  return todayView();
}

/* ---------------------------------------------------------------- today */
function todayView() {
  const s = S(), d = A.sel, p = C.dayProgress(s, d);
  const tasks = s.tasks.filter(t => t.date === d).sort((a, b) => (a.start ?? '').localeCompare(b.start ?? ''));
  const classes = C.classesOn(d, s);
  const head = p.pct < 50 ? '가볍게 하나씩 시작해요' : p.pct < 100 ? '좋아요, 리듬을 이어가요' : '오늘 계획을 모두 마쳤어요';
  return `<div class="grid-2">
    <section class="col">
      <div id="day-card">${dayCard()}</div>
      <div class="card focus-card"><div><span class="kicker">${icon('spark')} 오늘의 흐름</span><h2>${head}</h2><p>${p.completed}개 완료 · ${Math.max(0, p.total - p.completed)}개 남음</p></div>
        <div class="ring" style="--p:${p.pct}"><span>${p.pct}%</span></div></div>
      <div class="card"><div class="card-head"><h2>오늘 계획</h2><button type="button" class="btn sm" data-act="task-new">${icon('plus')}일정 추가</button></div>
        ${tasks.length ? `<ul class="timeline">${tasks.map(taskRow).join('')}</ul>` : `<div class="empty"><b>아직 계획이 없어요</b><button type="button" class="btn sm" data-act="task-new">첫 일정 추가하기</button></div>`}</div>
      <div class="card"><div class="card-head"><h2>오늘 수업</h2><span class="muted">${classes.filter(Boolean).length}타임</span></div>
        ${classes.some(Boolean) ? `<ul class="class-list">${classes.map((cls, i) => cls ? classRow(d, cls, i) : '').join('')}</ul>` : '<div class="empty">오늘은 정규 수업이 없어요.</div>'}</div>
    </section>
    <aside class="col">
      ${routineCard(d)}
      ${upcomingCard()}
    </aside></div>`;
}
// 2차: 근무 · 기상/취침. Empty -> one tap records now; a value -> tap to change it.
function dayCard() {
  const s = S(), d = A.sel, at = s.attendance[d] || {};
  const slot = (key, label, ic, value) => `<div class="time-slot ${value ? 'has' : ''}">${icon(ic)}<div><small>${label}</small>${value
    ? `<input type="time" value="${esc(value)}" data-time="${key}" aria-label="${label} 시간">`
    : `<button type="button" class="now-btn" data-now="${key}">${label}</button>`}</div></div>`;
  const mins = C.workMinutes(at.clockIn, at.clockOut);
  let week = 0; const mon = C.mondayOf(d);
  for (let i = 0; i < 7; i++) { const r = s.attendance[C.addDays(mon, i)]; week += C.workMinutes(r?.clockIn, r?.clockOut) || 0; }
  return `<div class="card day-card"><div class="card-head"><h2>근무 · 생활</h2><button type="button" class="link-btn" data-act="attendance">기록 보기 ${icon('right')}</button></div>
    <div class="time-grid">${slot('clockIn', '출근', 'bag', at.clockIn)}${slot('clockOut', '퇴근', 'bag', at.clockOut)}${slot('wake', '기상', 'sun', at.wake)}${slot('sleep', '취침', 'moon', at.sleep)}</div>
    <p class="day-note">${mins != null ? `오늘 <b>${C.fmtDuration(mins)}</b> 근무` : at.clockIn ? '퇴근하면 근무 시간이 계산돼요' : '출근을 누르면 지금 시각이 기록돼요'}${week ? ` · 이번 주 ${C.fmtDuration(week)}` : ''}</p></div>`;
}
function drawDayCard() { const el = document.getElementById('day-card'); if (el && !el.contains(document.activeElement)) el.innerHTML = dayCard(); }
function taskRow(t) {
  const memo = !t.start || t.start === t.end;
  return `<li class="task ${t.done ? 'done' : ''}"><div class="t-time"><b>${esc(t.start || '메모')}</b>${!memo && t.end ? `<small>${esc(t.end)}</small>` : ''}</div>
    <span class="t-line cat-${esc((t.category || '업무').replace(' ', '-'))}"></span>
    <label class="check"><input type="checkbox" data-task-done="${esc(t.id)}" ${t.done ? 'checked' : ''} aria-label="${esc(t.title)} 완료"><i></i></label>
    <button type="button" class="t-body" data-task-edit="${esc(t.id)}"><b>${esc(t.title)}</b><small>${esc(t.category)}</small></button>
    <div class="row-tools"><button type="button" class="icon-btn sm" data-task-edit="${esc(t.id)}" aria-label="일정 수정">${icon('pencil')}</button><button type="button" class="icon-btn sm danger" data-task-del="${esc(t.id)}" aria-label="일정 삭제">${icon('trash')}</button></div></li>`;
}
function classPhase(d, i) {
  if (d !== A.today) return '';
  const now = C.nowHM(), [st, en] = C.SLOT_TIMES[i] || ['', ''];
  if (now >= st && now < en) return 'now';
  if (now >= en) return 'past';
  return '';
}
function classRow(d, cls, i) {
  const s = S(), key = `${d}-${i}`, done = !!s.classDone[key], [st, en] = C.SLOT_TIMES[i] || ['보강', ''];
  const split = C.splitCohorts(cls);
  let preview, filled = 'plan-none';
  if (split.length) {
    const recs = split.map(c => [c, s.cohortLessonRecords[C.cohortKey(d, i, c.id)]]);
    if (recs.some(([, r]) => r?.actual)) filled = 'plan-done'; else if (recs.some(([, r]) => r?.plan)) filled = 'plan-some';
    preview = recs.some(([, r]) => r?.plan || r?.actual) ? recs.map(([c, r]) => `<span><b>${esc(c.short)}</b>${esc(r?.plan || r?.actual || '미작성')}</span>`).join('') : '<span class="muted">학교별 수업 계획을 작성해 주세요</span>';
  } else {
    const r = s.lessonRecords[key];
    if (r?.actual) filled = 'plan-done'; else if (r?.plan) filled = 'plan-some';
    preview = r?.plan || r?.actual ? `${r.plan ? `<span><b>계획</b>${esc(r.plan)}</span>` : ''}${r.actual ? `<span><b>진도</b>${esc(r.actual)}</span>` : ''}` : '<span class="muted">작성한 수업 계획이 없어요</span>';
  }
  const phase = classPhase(d, i);
  const phaseText = phase === 'now' ? `<em class="phase now">수업 중</em>` : '';
  return `<li class="class-row ${done ? 'done' : ''} ${phase}">
    <button type="button" class="c-main" data-tab="lessons"><span class="c-time">${st}<small>${en}</small></span><span class="c-name"><b>${esc(cls)}</b>${C.CLASS_GROUP_LABEL[cls] ? `<small>${C.CLASS_GROUP_LABEL[cls]}</small>` : ''}</span>${phaseText}</button>
    <button type="button" class="c-preview" data-tab="lessons">${preview}</button>
    <div class="c-actions"><span class="rec ${filled}">${filled === 'plan-done' ? '진도 기록됨' : filled === 'plan-some' ? '계획 있음' : '계획 입력'}</span>
      <button type="button" class="toggle ${done ? 'on' : ''}" data-class-done="${key}">${done ? icon('check') + ' 완료' : '완료'}</button></div></li>`;
}
function routineCard(d) {
  const s = S();
  return `<div class="card"><div class="card-head"><h2>${icon('list')}매일 루틴</h2><span class="muted">${s.routineItems.filter(r => s.routineChecks[`${d}-${r.id}`]).length}/${s.routineItems.length}</span></div>
    <ul class="routines">${s.routineItems.map((r, i) => `<li class="${s.routineChecks[`${d}-${r.id}`] ? 'done' : ''}">
      <label class="check"><input type="checkbox" data-routine="${esc(r.id)}" ${s.routineChecks[`${d}-${r.id}`] ? 'checked' : ''} aria-label="${esc(r.title)}"><i></i></label>
      <span class="r-title">${esc(r.title)}</span>
      <div class="row-tools"><button type="button" class="icon-btn sm" data-routine-move="${i}" data-d="-1" ${i === 0 ? 'disabled' : ''} aria-label="위로 이동">${icon('up')}</button><button type="button" class="icon-btn sm" data-routine-move="${i}" data-d="1" ${i === s.routineItems.length - 1 ? 'disabled' : ''} aria-label="아래로 이동">${icon('down')}</button><button type="button" class="icon-btn sm" data-routine-edit="${esc(r.id)}" aria-label="루틴 수정">${icon('pencil')}</button><button type="button" class="icon-btn sm danger" data-routine-del="${esc(r.id)}" aria-label="루틴 삭제">${icon('trash')}</button></div></li>`).join('')}</ul>
    <div class="inline-add"><input placeholder="새 루틴" id="routine-new" data-focus="routine-new"><button type="button" class="icon-btn" data-act="routine-add" aria-label="루틴 추가">${icon('plus')}</button></div></div>`;
}
function upcomingCard() {
  const s = S();
  const rows = C.COHORTS.map(c => [c, C.examForCohort(c.id, s, A.today)]).filter(([, ex]) => ex && C.examUpcoming(ex, A.today));
  return `<div class="card"><div class="card-head"><h2>${icon('cap')}다가오는 시험</h2><span class="muted">체크한 범위로 계산</span></div>
    ${rows.length ? `<ul class="exam-mini">${rows.map(([c, ex]) => { const st = C.rangeStats(s, c.id); return `<li><span class="dot tone-${ex.color}"></span><b>${esc(c.label)}</b><span class="muted">${esc(ex.label)} · ${C.examStatus(ex, A.today)}</span><div class="bar"><i style="width:${st.pct}%"></i></div><small>${st.items.length ? `${st.checked}/${st.items.length} · ${st.pct}%` : '범위를 추가해 주세요'}</small></li>`; }).join('')}</ul>` : '<div class="empty">예정된 시험이 없어요.</div>'}</div>`;
}

/* ---------------------------------------------------------------- lessons */
const KIND = [['본문', /^본문|further/i], ['듣기', /^듣기/], ['독해', /^독해/], ['모의고사', /^모의고사/], ['외부지문', /^외부지문/]];
const kindOf = label => (KIND.find(([, rx]) => rx.test(label)) || ['기타'])[0];
function lessonsView() {
  const s = S(), d = A.sel, classes = C.classesOn(d, s);
  if (!classes.some(Boolean)) return `<div class="card empty big"><b>정규 수업이 없는 날이에요</b><p>다른 날짜를 선택하면 수업 계획과 진도를 작성할 수 있어요.</p></div>`;
  const cohorts = C.COHORTS.filter(c => classes.includes(c.className));
  return `${cohorts.length ? `<section class="range-section"><div class="sec-head"><h2>학교별 시험 범위</h2><p>체크한 진도는 날짜가 바뀌어도 그대로 저장돼요.</p></div>
      <div class="range-grid">${cohorts.map(rangeCard).join('')}</div></section>` : ''}
    <section class="lesson-list">${classes.map((cls, i) => cls ? lessonCard(d, cls, i) : '').join('')}</section>`;
}
function rangeCard(c) {
  const s = S(), st = C.rangeStats(s, c.id), pc = C.pace(s, c.id, A.today), ex = C.examForCohort(c.id, s, A.today);
  const groups = new Map();
  for (const it of st.items) { const k = kindOf(it.label); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(it); }
  return `<article class="card range-card tone-${c.tone}">
    <div class="rc-head"><div><b>${esc(c.label)}</b><span class="badge">${esc(c.className)}</span>${ex ? `<span class="muted">${esc(ex.label)} · ${C.examStatus(ex, A.today)}</span>` : ''}</div>
      <div class="rc-right"><span class="rc-pct">${st.checked}/${st.items.length} · ${st.pct}%</span><button type="button" class="btn sm ghost" data-range-add="${c.id}">${icon('plus')}범위 추가</button></div></div>
    <div class="bar"><i style="width:${st.pct}%"></i></div>
    <div class="pace"><span>${icon('gauge')}시험까지 수업 <b>${pc.lessons}회</b></span><span>남은 범위 <b>${pc.remaining}개</b></span>${pc.lessons ? `<span>회당 <b>${pc.perLesson}개</b></span>` : ''}<em class="pace-${pc.state}">${pc.state}</em></div>
    ${st.items.length ? [...groups].map(([k, items]) => `<div class="chip-group"><span class="cg-label">${k}</span><div class="chips">${items.map(it => { const on = !!s.rangeChecks[`${c.id}-${it.id}`]; return `<span class="rchip ${on ? 'on' : ''}"><button type="button" class="rc-toggle" data-range-check="${c.id}|${esc(it.id)}" aria-pressed="${on}" title="${esc(it.label)}">${on ? icon('check') : '<i class="box"></i>'}<span>${esc(it.label)}</span></button><button type="button" class="rc-edit" data-range-edit="${c.id}|${esc(it.id)}" aria-label="범위 수정">${icon('pencil')}</button><button type="button" class="rc-del" data-range-del="${c.id}|${esc(it.id)}" aria-label="범위 삭제">${icon('x')}</button></span>`; }).join('')}</div></div>`).join('') : `<div class="empty">${ex && C.examUndated(ex) ? `${esc(ex.label)} 범위를 추가해 주세요.` : '범위가 없어요.'} <button type="button" class="link-btn" data-range-add="${c.id}">+ 범위 추가</button></div>`}
  </article>`;
}
function lessonCard(d, cls, i) {
  const s = S(), [st, en] = C.SLOT_TIMES[i] || ['보강', ''], key = `${d}-${i}`, done = !!s.classDone[key], split = C.splitCohorts(cls);
  return `<article class="card lesson-card ${done ? 'done' : ''}">
    <div class="lc-head"><span class="lc-num">${i + 1}</span><div><b>${esc(cls)}</b><span class="muted">${st} – ${en}${C.CLASS_GROUP_LABEL[cls] ? ` · ${C.CLASS_GROUP_LABEL[cls]}` : ''}</span></div>
      <button type="button" class="toggle ${done ? 'on' : ''}" data-class-done="${key}">${done ? icon('check') + ' 수업 완료' : '완료 체크'}</button></div>
    ${split.length ? `<div class="school-grid">${split.map(c => cohortLesson(d, cls, i, c)).join('')}</div>` : plainLesson(d, cls, i)}
  </article>`;
}
function prevBox(label, prev, empty, buttons) {
  return `<div class="prev ${prev?.record.actual ? '' : 'none'}"><small>${label}${prev && prev.date !== A.sel ? ` · ${C.fmtMd(prev.date)}` : ''}</small><p>${esc(prev?.record.actual || empty)}</p>${buttons ? `<div class="prev-tools">${buttons}</div>` : ''}</div>`;
}
function cohortLesson(d, cls, i, c) {
  const s = S(), k = C.cohortKey(d, i, c.id), rec = s.cohortLessonRecords[k] ?? { plan: '', actual: '' };
  const prev = C.findPrevCohortLesson(d, cls, c.id, s, i);
  const carry = prev?.record.plan && prev.record.plan !== prev.record.actual ? prev.record.plan : '';
  const btns = `${carry ? `<button type="button" class="link-btn" data-carry="${k}|${c.id}">미완료 이월</button>` : ''}${prev?.record.plan ? `<button type="button" class="link-btn" data-copy-plan="${k}">${icon('copy')}계획 복사</button>` : ''}`;
  return `<section class="school tone-${c.tone}" data-prev-plan="${esc(prev?.record.plan || '')}" data-carry-plan="${esc(carry)}">
    <div class="school-head"><b>${esc(c.label)}</b><select data-template="${k}" aria-label="템플릿"><option value="">템플릿</option>${s.lessonTemplates.map(t => `<option value="${esc(t.id)}">${esc(t.name)}</option>`).join('')}</select>${rec.plan ? `<button type="button" class="link-btn" data-save-template="${k}|${c.id}">현재 계획 저장</button>` : ''}</div>
    ${prevBox(prev?.date === d ? '앞 타임' : '이전 진도', prev, '이전 진도 없음', btns)}
    <label class="field"><span><em>PLAN</em> 이번 수업 계획</span><textarea rows="2" data-focus="p-${k}" data-rec="${k}|plan|cohort" placeholder="${esc(c.label)}에서 나갈 내용을 간단히 적으세요">${esc(rec.plan)}</textarea></label>
    <label class="field"><span><em class="done">DONE</em> 실제 진도</span><textarea rows="2" data-focus="a-${k}" data-rec="${k}|actual|cohort" placeholder="실제로 마친 범위를 적으세요">${esc(rec.actual)}</textarea></label>
  </section>`;
}
function plainLesson(d, cls, i) {
  const s = S(), k = `${d}-${i}`, rec = s.lessonRecords[k] ?? { plan: '', actual: '' }, prev = C.findPrevLesson(d, cls, s, i);
  return `<section class="school single" data-prev-plan="${esc(prev?.record.plan || '')}" data-prev-date="${prev?.date || ''}">
    ${prevBox(prev?.date === d ? '앞 타임 진도' : '이전 수업 진도', prev, '아직 기록된 이전 진도가 없어요.', prev?.record.plan ? `<button type="button" class="link-btn" data-copy-plan-plain="${k}">${icon('copy')}이전 계획 복사</button>` : '')}
    <div class="two"><label class="field"><span><em>PLAN</em> 이번 수업에서 할 것</span><textarea rows="2" data-focus="p-${k}" data-rec="${k}|plan|plain" placeholder="이번 수업에서 나갈 내용을 적으세요">${esc(rec.plan)}</textarea></label>
    <label class="field"><span><em class="done">DONE</em> 실제로 나간 진도</span><textarea rows="2" data-focus="a-${k}" data-rec="${k}|actual|plain" placeholder="실제로 마친 범위를 적으세요">${esc(rec.actual)}</textarea></label></div>
  </section>`;
}

/* ---------------------------------------------------------------- week */
function weekView() {
  const s = S(), mon = C.mondayOf(A.sel);
  const days = Array.from({ length: 7 }, (_, i) => C.addDays(mon, i));
  return `<div class="week-grid">${days.map(d => {
    const tasks = s.tasks.filter(t => t.date === d).sort((a, b) => (a.start ?? '').localeCompare(b.start ?? ''));
    const ov = s.scheduleOverrides[d], classes = C.classesOn(d, s);
    const items = [...tasks.filter(t => (t.start ?? '') < '16:30').map(t => `<span class="w-task ${t.done ? 'done' : ''}">${esc(t.start || '')} ${esc(t.title)}</span>`),
      ...(ov ? [`<span class="w-ex">${esc(ov.label)}</span>`] : []),
      ...classes.map((c, i) => c ? `<span class="w-class">${C.SLOT_TIMES[i]?.[0] ?? '보강'} ${esc(c)}</span>` : ''),
      ...tasks.filter(t => (t.start ?? '') >= '16:30').map(t => `<span class="w-task ${t.done ? 'done' : ''}">${esc(t.start)} ${esc(t.title)}</span>`)].filter(Boolean);
    return `<button type="button" class="week-day ${d === A.today ? 'today' : ''}" data-goto="${d}"><div class="wd-head"><span>${C.WD[C.weekday(d)]}</span><b>${Number(d.slice(8))}</b></div><div class="wd-stack">${items.join('') || '<em class="muted">일정 없음</em>'}</div></button>`;
  }).join('')}</div>
  <div class="card"><div class="card-head"><h2>${icon('spark')}이번 주 마감</h2><span class="muted">잘된 점, 밀린 진도, 다음 주 우선순위</span></div>
    <textarea rows="3" data-focus="weekly" data-weekly="${mon}" placeholder="예: 강서고 1과 마무리. 다음 주 단원고 모의고사 29~31번 우선.">${esc(s.weeklyReviews[mon] || '')}</textarea></div>`;
}

/* ---------------------------------------------------------------- month + exams */
function monthView() {
  const s = S(), first = A.monthCursor, start = C.addDays(first, -C.weekday(first));
  const days = Array.from({ length: 42 }, (_, i) => C.addDays(start, i)), month = first.slice(0, 7), f = A.monthFilter;
  const exams = C.examsOf(s).filter(x => !C.examUndated(x));
  const cohorts = f === 'all' ? C.COHORTS : C.COHORTS.filter(c => c.id === f);
  return `<div class="grid-2 wide-left"><section class="card cal">
    <div class="tabs-row"><button type="button" class="seg ${f === 'all' ? 'on' : ''}" data-month-filter="all">전체</button>${C.COHORTS.map(c => `<button type="button" class="seg tone-${c.tone} ${f === c.id ? 'on' : ''}" data-month-filter="${c.id}">${esc(c.label)}</button>`).join('')}</div>
    <p class="muted small">반을 고른 뒤 날짜를 눌러, 그날 나갈 진도를 한 줄로 적어보세요.</p>
    <div class="cal-grid">${C.WD.map(w => `<span class="cal-wd">${w}</span>`).join('')}${days.map(d => {
      const ov = s.scheduleOverrides[d], ex = exams.filter(x => x.start <= d && d <= x.end);
      const notes = cohorts.filter(c => s.monthlyClassPlans[c.id]?.[d]).map(c => `<small class="m-note tone-${c.tone}"><b>${f === 'all' ? esc(c.short) : '계획'}</b>${esc(s.monthlyClassPlans[c.id][d])}</small>`);
      return `<button type="button" class="cal-day ${d.slice(0, 7) !== month ? 'out' : ''} ${d === A.today ? 'today' : ''}" data-month-day="${d}"><span class="dn">${Number(d.slice(8))}</span>${ov ? `<span class="m-ov">${esc(ov.label)}</span>` : ''}${ex.map(x => `<span class="m-exam tone-${x.color}">${esc(x.school)}</span>`).join('')}${notes.join('')}</button>`;
    }).join('')}</div></section>
    ${examBoard()}</div>`;
}
function examBoard() {
  const s = S(), list = C.sortExams(C.examsOf(s)), up = list.filter(x => C.examUpcoming(x, A.today)), ended = list.filter(x => !C.examUpcoming(x, A.today)).reverse();
  const card = x => {
    const linked = C.COHORTS.filter(c => (x.cohortIds || []).includes(c.id));
    const undated = C.examUndated(x), over = !undated && x.end < A.today;
    return `<article class="exam-card ${over ? 'ended' : ''}">
      <div class="ec-top"><span class="dot tone-${x.color}"></span><div><b>${esc(x.school)} ${esc(x.label)}</b><small>${undated ? '시험 날짜를 정해 주세요' : `${C.fmtMd(x.start)} – ${C.fmtMd(x.end)}`}</small></div><em class="${undated ? 'warn' : ''}">${C.examStatus(x, A.today)}</em><button type="button" class="icon-btn sm" data-exam-edit="${esc(x.id)}" aria-label="시험 수정">${icon('pencil')}</button></div>
      ${x.scope?.length ? `<details class="scope"><summary>시험 범위 보기</summary><ul>${x.scope.map(l => `<li>${esc(l)}</li>`).join('')}</ul></details>` : ''}
      ${linked.map(c => { const st = C.rangeStats(s, c.id); return `<div class="ec-row"><span>${linked.length > 1 ? esc(c.label) : '범위 완료율'}${!over && !undated ? ` · 남은 수업 ${C.remainingClasses(A.today, c.id, s)}회` : ''}</span><b>${st.pct}%</b></div><div class="bar"><i style="width:${st.pct}%"></i></div>`; }).join('')}
      ${!undated && linked.length ? `<button type="button" class="btn sm ghost next-exam" data-exam-roll="${esc(x.id)}">${icon('archive')}시험 끝 · 다음 시험 준비</button>` : ''}
      ${linked.map(c => historyOf(c)).join('')}
    </article>`;
  };
  return `<aside class="card exam-board"><div class="card-head"><h2>${icon('cap')}학교별 시험</h2><button type="button" class="btn sm" data-exam-edit="">${icon('plus')}시험 추가</button></div>
    ${up.length ? up.map(card).join('') : '<div class="empty">예정된 시험이 없어요.</div>'}
    ${ended.length ? `<details class="ended"><summary>끝난 시험 ${ended.length}개</summary>${ended.map(card).join('')}</details>` : ''}</aside>`;
}
function historyOf(c) {
  const list = S().examHistory?.[c.id] || [];
  if (!list.length) return '';
  return `<details class="history"><summary>${esc(c.label)} 지난 시험 기록 ${list.length}개</summary>${[...list].reverse().map(h => {
    const n = h.items.filter(i => h.checks[i.id]).length, pct = h.items.length ? Math.round(n / h.items.length * 100) : 0;
    return `<div class="hist"><div class="hist-head"><b>${esc(h.label)}</b><small>${h.start ? `${C.fmtMd(h.start)} – ${C.fmtMd(h.end)} · ` : ''}${n}/${h.items.length} · ${pct}%</small></div><div class="chips">${h.items.map(i => `<span class="rchip mini ${h.checks[i.id] ? 'on' : ''}">${h.checks[i.id] ? icon('check') : ''}<span>${esc(i.label)}</span></span>`).join('')}</div></div>`;
  }).join('')}</details>`;
}

/* ---------------------------------------------------------------- hub */
function hubView() {
  const s = S();
  return `<div class="grid-2">
    <section class="card"><div class="card-head"><h2>${icon('memo')}빠른 메모</h2><span class="muted">나중에 처리할 일을 바로 적어요</span></div>
      <div class="inline-add"><input id="memo-new" data-focus="memo-new" placeholder="예: 중3 프린트 수정"><button type="button" class="btn sm" data-act="memo-add">${icon('plus')}추가</button></div>
      ${s.quickMemos.length ? `<ul class="memos">${s.quickMemos.map(m => `<li class="${m.done ? 'done' : ''}"><label class="check"><input type="checkbox" data-memo-done="${esc(m.id)}" ${m.done ? 'checked' : ''}><i></i></label><span>${esc(m.text)}</span><small>${new Date(m.createdAt).toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' })}</small><button type="button" class="icon-btn sm danger" data-memo-del="${esc(m.id)}" aria-label="메모 삭제">${icon('trash')}</button></li>`).join('')}</ul>` : '<div class="empty">메모가 없어요.</div>'}</section>
    <section class="card"><div class="card-head"><h2>${icon('link')}수업 자료 링크</h2><span class="muted">PDF와 Drive 자료를 학교별로</span></div>
      <div class="link-form"><input id="link-label" placeholder="자료 이름"><input id="link-url" placeholder="https://…"><select id="link-cohort"><option value="all">공통 자료</option>${C.COHORTS.map(c => `<option value="${c.id}">${esc(c.label)}</option>`).join('')}</select><button type="button" class="btn sm" data-act="link-add">${icon('plus')}링크 추가</button></div>
      ${s.resourceLinks.length ? `<ul class="links">${s.resourceLinks.map(l => `<li><a href="${esc(l.url)}" target="_blank" rel="noreferrer">${icon('link')}<b>${esc(l.label)}</b><small>${l.cohortId === 'all' ? '공통' : esc(C.COHORTS.find(c => c.id === l.cohortId)?.label || '')}</small></a><button type="button" class="icon-btn sm danger" data-link-del="${esc(l.id)}" aria-label="링크 삭제">${icon('x')}</button></li>`).join('')}</ul>` : '<div class="empty">저장한 자료가 없어요.</div>'}</section>
    <section class="card"><div class="card-head"><h2>수업 템플릿</h2><span class="muted">수업 계획에서 한 번에 불러와요</span></div>
      <ul class="templates">${s.lessonTemplates.map(t => `<li><b>${esc(t.name)}</b><span>${esc(t.content)}</span><button type="button" class="icon-btn sm danger" data-template-del="${esc(t.id)}" aria-label="템플릿 삭제">${icon('x')}</button></li>`).join('')}</ul></section>
    <section class="card"><div class="card-head"><h2>${icon('lock')}접속 PIN 변경</h2><span class="muted">숫자 4~8자리</span></div>
      <div class="pin-form"><input id="pin-cur" type="password" inputmode="numeric" placeholder="현재 PIN"><input id="pin-new" type="password" inputmode="numeric" placeholder="새 PIN"><button type="button" class="btn sm" data-act="pin-change">PIN 변경</button></div><small id="pin-msg" class="muted"></small></section>
  </div>`;
}

/* ---------------------------------------------------------------- dialogs */
function taskDialog(task) {
  const t = task || { start: '13:00', end: '14:00', category: '업무', title: '' };
  const { el, close } = dialog(`<h2>${task ? '일정 수정' : '새 일정 추가'}</h2><form class="form" id="task-form">
    <label class="field"><span>일정 이름</span><input name="title" value="${esc(t.title)}" placeholder="예: 강서고 교재 제작" autofocus required></label>
    <div class="two"><label class="field"><span>시작</span><input type="time" name="start" value="${esc(t.start)}"></label><label class="field"><span>종료</span><input type="time" name="end" value="${esc(t.end)}"></label></div>
    <label class="field"><span>구분</span><select name="category">${C.TASK_CATEGORIES.map(c => `<option ${c === t.category ? 'selected' : ''}>${c}</option>`).join('')}</select></label>
    <div class="dlg-actions"><button type="button" class="btn ghost" data-close>취소</button><button class="btn primary">${task ? '수정 완료' : '추가하기'}</button></div></form>`);
  $('#task-form', el).onsubmit = e => {
    e.preventDefault();
    const f = new FormData(e.target), title = String(f.get('title')).trim();
    if (!title) return;
    const next = { id: task?.id ?? C.uid(), date: task?.date ?? A.sel, start: f.get('start'), end: f.get('end'), title, category: f.get('category'), done: task?.done ?? false };
    change(s => { const i = s.tasks.findIndex(x => x.id === next.id); if (i >= 0) s.tasks[i] = next; else s.tasks.push(next); });
    close();
  };
}
function textDialog({ title, sub = '', value = '', placeholder = '', ok = '저장', onSave, extra = '' }) {
  const { el, close } = dialog(`<h2>${esc(title)}</h2>${sub ? `<p class="muted">${esc(sub)}</p>` : ''}<div class="form"><input id="td-input" value="${esc(value)}" placeholder="${esc(placeholder)}" maxlength="80" autofocus>${extra}
    <div class="dlg-actions"><button type="button" class="btn ghost" data-close>취소</button><button type="button" class="btn primary" id="td-ok">${ok}</button></div></div>`);
  const input = $('#td-input', el);
  const save = () => { const v = input.value.trim(); if (!v) return; onSave(v); close(); };
  $('#td-ok', el).onclick = save;
  input.onkeydown = e => { if (isEnter(e)) { e.preventDefault(); save(); } };
  return { el, close, input };
}
function scheduleDialog() {
  const s = S(), d = A.sel, ov = s.scheduleOverrides[d];
  const def = C.WEEK_SCHEDULE[C.weekday(d)] ?? ['', '', '', ''];
  const slots = ov?.type === 'custom' ? [0, 1, 2, 3].map(i => ov.classes[i] || '') : [0, 1, 2, 3].map(i => def[i] || '');
  const { el, close } = dialog(`<h2>${C.fmtLong(d)} 수업 변경</h2><p class="muted">이 날짜에만 적용되며, 기본 시간표는 바뀌지 않아요.</p><div class="form">
    <label class="field"><span>일정 종류</span><select id="sd-type"><option value="normal">기본 시간표</option><option value="cancel">휴강</option><option value="holiday">공휴일</option><option value="custom">보강 · 수업 변경</option></select></label>
    <label class="field" id="sd-label-wrap"><span>표시 이름</span><input id="sd-label" value="${esc(ov?.label || '')}"></label>
    <div id="sd-slots" class="slots">${[0, 1, 2, 3].map(i => `<label><b>${i + 1}타임</b><select data-slot="${i}"><option value="">수업 없음</option>${C.OVERRIDE_CLASS_OPTIONS.map(o => `<option ${slots[i] === o ? 'selected' : ''}>${o}</option>`).join('')}</select></label>`).join('')}</div>
    <div class="dlg-actions"><button type="button" class="btn ghost" data-close>취소</button><button type="button" class="btn primary" id="sd-ok">적용하기</button></div></div>`);
  const type = $('#sd-type', el); type.value = ov?.type || 'normal';
  const sync = () => { const t = type.value; $('#sd-label-wrap', el).hidden = t === 'normal'; $('#sd-slots', el).hidden = t !== 'custom'; $('#sd-label', el).placeholder = t === 'holiday' ? '예: 추석 연휴' : t === 'cancel' ? '예: 전체 휴강' : '예: 중3 보강'; };
  type.onchange = sync; sync();
  $('#sd-ok', el).onclick = () => {
    const t = type.value, prev = s.scheduleOverrides[d];
    change(st => {
      if (t === 'normal') delete st.scheduleOverrides[d];
      else st.scheduleOverrides[d] = { type: t, label: $('#sd-label', el).value.trim() || (t === 'holiday' ? '공휴일' : t === 'cancel' ? '휴강' : '보강·변경'), classes: t === 'custom' ? $$('[data-slot]', el).map(x => x.value) : [] };
    });
    undoBar(`${C.fmtLong(d)} 수업을 변경했어요.`, () => change(st => { if (prev) st.scheduleOverrides[d] = prev; else delete st.scheduleOverrides[d]; }));
    close();
  };
}
function attendanceDialog() {
  const rows = Object.entries(S().attendance).filter(([, r]) => r.clockIn || r.clockOut || r.wake || r.sleep).sort((a, b) => b[0].localeCompare(a[0]));
  dialog(`<h2>근무 · 생활 기록</h2><p class="muted">${rows.length ? `총 ${rows.length}일의 기록이에요.` : '아직 기록이 없어요.'}</p>
    <div class="table-wrap"><table class="att"><thead><tr><th>날짜</th><th>출근</th><th>퇴근</th><th>근무</th><th>기상</th><th>취침</th></tr></thead><tbody>${rows.map(([d, r]) => `<tr><td>${C.fmtMdDow(d)}</td><td>${r.clockIn || '—'}</td><td>${r.clockOut || '—'}</td><td>${r.clockIn && r.clockOut ? C.workDuration(r.clockIn, r.clockOut) : '<span class="muted">미완료</span>'}</td><td>${r.wake || '—'}</td><td>${r.sleep || '—'}</td></tr>`).join('')}</tbody></table></div>`, { cls: 'wide' });
}
function monthDialog(d) {
  const s = S(); let cohort = A.monthFilter === 'all' ? 'danwon-a' : A.monthFilter;
  const { el, close } = dialog(`<h2>${C.fmtLong(d)} 월간 계획</h2><p class="muted">세부 일정이 아니라 그날 나갈 수업 방향만 짧게 적어요.</p><div class="form">
    <label class="field"><span>반 선택</span><select id="md-cohort">${C.COHORTS.map(c => `<option value="${c.id}" ${c.id === cohort ? 'selected' : ''}>${c.className} · ${esc(c.label)}</option>`).join('')}</select></label>
    <input id="md-text" maxlength="80" placeholder="예: 고1 본문 1과 마무리" autofocus>
    <div class="examples"><span class="muted">예시</span>${['본문 1과 마무리', '모의고사 29번', '시험 전 최종 복습'].map(x => `<button type="button" class="chip" data-ex="${x}">${x}</button>`).join('')}</div>
    <div class="dlg-actions"><button type="button" class="btn ghost" data-close>취소</button><button type="button" class="btn ghost danger" id="md-clear">내용 지우기</button><button type="button" class="btn primary" id="md-ok">저장</button></div></div>`);
  const input = $('#md-text', el), sel = $('#md-cohort', el), clear = $('#md-clear', el);
  const load = () => { input.value = s.monthlyClassPlans[cohort]?.[d] || ''; clear.hidden = !input.value; };
  load();
  sel.onchange = () => { cohort = sel.value; load(); };
  el.addEventListener('click', e => { const b = e.target.closest('[data-ex]'); if (b) input.value = b.dataset.ex; });
  const save = text => { change(st => { (st.monthlyClassPlans[cohort] ||= {})[d] = text; }); close(); };
  $('#md-ok', el).onclick = () => save(input.value.trim());
  clear.onclick = () => save('');
  input.onkeydown = e => { if (isEnter(e)) { e.preventDefault(); save(input.value.trim()); } };
}
function examDialog(id) {
  const s = S(), exam = C.examsOf(s).find(x => x.id === id) || {};
  const f = { school: exam.school ?? '', label: exam.label ?? '기말고사', start: exam.start || A.today, end: exam.end || exam.start || A.today, color: exam.color ?? 'blue', cohortIds: [...(exam.cohortIds ?? [])], scope: (exam.scope || []).join('\n') };
  const { el, close } = dialog(`<h2>${exam.id ? '시험 수정' : '시험 추가'}</h2><div class="form">
    <div class="two"><label class="field"><span>학교</span><input id="ex-school" value="${esc(f.school)}" placeholder="예: 단원고" ${exam.id ? '' : 'autofocus'}></label><label class="field"><span>시험 이름</span><input id="ex-label" value="${esc(f.label)}" placeholder="예: 기말고사"></label></div>
    <div class="two"><label class="field"><span>시작일</span><input type="date" id="ex-start" value="${f.start}"></label><label class="field"><span>종료일</span><input type="date" id="ex-end" value="${f.end}" min="${f.start}"></label></div>
    <div class="field"><span>연결할 반</span><div class="picks">${C.COHORTS.map(c => `<label class="pick"><input type="checkbox" value="${c.id}" ${f.cohortIds.includes(c.id) ? 'checked' : ''}>${esc(c.label)}</label>`).join('')}</div></div>
    <div class="field"><span>색상</span><div class="colors">${C.EXAM_COLORS.map(([c, n]) => `<button type="button" class="color tone-${c} ${c === f.color ? 'on' : ''}" data-color="${c}" title="${n}" aria-label="${n}"></button>`).join('')}</div></div>
    <label class="field"><span>시험 범위 (한 줄에 하나씩)</span><textarea id="ex-scope" rows="4" placeholder="예: 교과서 본문 1과 · 2과&#10;모의고사 21, 23, 29번">${esc(f.scope)}</textarea></label>
    <small class="muted">번호별 체크리스트는 '수업 · 진도' 화면의 '범위 추가'에서 관리해요.</small>
    <div class="dlg-actions">${exam.id ? '<button type="button" class="btn ghost danger" id="ex-del">삭제</button>' : ''}<button type="button" class="btn ghost" data-close>취소</button><button type="button" class="btn primary" id="ex-ok">${exam.id ? '수정 완료' : '추가하기'}</button></div></div>`);
  let color = f.color;
  el.addEventListener('click', e => { const b = e.target.closest('[data-color]'); if (b) { color = b.dataset.color; $$('[data-color]', el).forEach(x => x.classList.toggle('on', x === b)); } });
  $('#ex-start', el).onchange = e => { const end = $('#ex-end', el); end.min = e.target.value; if (end.value < e.target.value) end.value = e.target.value; };
  $('#ex-ok', el).onclick = () => {
    const school = $('#ex-school', el).value.trim(), start = $('#ex-start', el).value, end = $('#ex-end', el).value;
    if (!school || !start || !end || end < start) { toast('학교와 날짜를 확인해 주세요.'); return; }
    const next = { ...exam, id: exam.id ?? `exam-${C.uid()}`, school, label: $('#ex-label', el).value.trim() || '시험', start, end, color, cohortIds: $$('.picks input:checked', el).map(x => x.value), scope: $('#ex-scope', el).value.split('\n').map(x => x.trim()).filter(Boolean) };
    change(st => { st.exams = C.examsOf(st).map(x => ({ ...x })); const i = st.exams.findIndex(x => x.id === next.id); if (i >= 0) st.exams[i] = next; else st.exams.push(next); });
    close();
  };
  $('#ex-del', el)?.addEventListener('click', () => {
    if (!confirm(`‘${exam.school} ${exam.label}’ 시험을 삭제할까요?`)) return;
    change(st => { st.exams = C.examsOf(st).filter(x => x.id !== exam.id); });
    close();
  });
}
function menu(anchor) {
  document.querySelector('.menu')?.remove();
  const m = document.createElement('div');
  m.className = 'menu';
  m.innerHTML = `<button type="button" data-act="save-now">${icon('save')}지금 저장</button><button type="button" data-act="backup">${icon('download')}백업 받기</button><button type="button" data-act="restore">${icon('upload')}백업 복원</button><button type="button" data-act="widget">${icon('monitor')}바탕화면 위젯 열기</button><a href="/SUMUS_Widget_Installer.zip" download>${icon('download')}위젯 설치 파일 (Windows)</a><hr><button type="button" data-act="lock">${icon('lock')}잠금</button>`;
  anchor.closest('.menu-wrap').appendChild(m);
  setTimeout(() => document.addEventListener('click', function off(e) { if (!m.contains(e.target)) { m.remove(); document.removeEventListener('click', off); } }), 0);
}

/* ---------------------------------------------------------------- events */
root.addEventListener('click', async e => {
  const b = e.target.closest('button, [data-goto]');
  if (!b || !store?.data) return;
  const d = b.dataset, s = S();
  if (d.tab) { A.tab = d.tab; render(); window.scrollTo(0, 0); return; }
  if (d.goto) { A.sel = d.goto; A.tab = 'today'; render(); return; }
  if (d.now) { const key = d.now, day = key === 'sleep' ? C.sleepDay() : A.sel === A.today ? A.today : A.sel; change(st => { (st.attendance[day] ||= { clockIn: '', clockOut: '' })[key] = C.nowHM(); if (key === 'wake') st.routineChecks[`${day}-wake`] = true; }); if (key === 'sleep' && day !== A.sel) toast(`${C.fmtMd(day)} 취침으로 기록했어요.`); return; }
  if (d.taskDone) return;
  if (d.taskEdit) return taskDialog(s.tasks.find(t => t.id === d.taskEdit));
  if (d.taskDel) { const i = s.tasks.findIndex(t => t.id === d.taskDel), t = s.tasks[i]; change(st => { st.tasks = st.tasks.filter(x => x.id !== t.id); }); undoBar(`‘${t.title}’ 일정을 삭제했어요.`, () => change(st => { st.tasks.push(t); })); return; }
  if (d.classDone) { change(st => { st.classDone[d.classDone] = !st.classDone[d.classDone]; }); return; }
  if (d.routineMove) { const i = Number(d.routineMove), j = i + Number(d.d); change(st => { const r = st.routineItems; [r[i], r[j]] = [r[j], r[i]]; }); return; }
  if (d.routineEdit) { const r = s.routineItems.find(x => x.id === d.routineEdit); textDialog({ title: '루틴 수정', value: r.title, ok: '수정 완료', onSave: v => change(st => { st.routineItems.find(x => x.id === r.id).title = v; }) }); return; }
  if (d.routineDel) { const i = s.routineItems.findIndex(x => x.id === d.routineDel), r = s.routineItems[i]; change(st => { st.routineItems.splice(i, 1); }); undoBar(`‘${r.title}’ 루틴을 삭제했어요.`, () => change(st => { st.routineItems.splice(i, 0, r); })); return; }
  if (d.rangeCheck) { const [c, id] = d.rangeCheck.split('|'); change(st => { const k = `${c}-${id}`; if (st.rangeChecks[k]) delete st.rangeChecks[k]; else st.rangeChecks[k] = true; }); return; }
  if (d.rangeAdd) { const c = C.COHORTS.find(x => x.id === d.rangeAdd); textDialog({ title: '시험 범위 추가', sub: `${c.className} · ${c.label}`, placeholder: '예: 모의고사 28번', ok: '추가하기', onSave: v => change(st => { st.rangeItems[c.id] = [...C.itemsOf(st, c.id), { id: C.uid(), label: v }]; }) }); return; }
  if (d.rangeEdit) { const [cid, id] = d.rangeEdit.split('|'), c = C.COHORTS.find(x => x.id === cid), it = C.itemsOf(s, cid).find(x => x.id === id); textDialog({ title: '시험 범위 수정', sub: `${c.className} · ${c.label}`, value: it.label, ok: '수정 완료', onSave: v => change(st => { st.rangeItems[cid] = C.itemsOf(st, cid).map(x => x.id === id ? { ...x, label: v } : x); }) }); return; }
  if (d.rangeDel) { const [cid, id] = d.rangeDel.split('|'), items = C.itemsOf(s, cid), i = items.findIndex(x => x.id === id), it = items[i]; change(st => { st.rangeItems[cid] = items.filter(x => x.id !== id); }); undoBar(`‘${it.label}’ 범위를 삭제했어요.`, () => change(st => { const l = [...C.itemsOf(st, cid)]; l.splice(i, 0, it); st.rangeItems[cid] = l; })); return; }
  if (d.carry) { const [k, cid] = d.carry.split('|'), plan = b.closest('.school').dataset.carryPlan, old = s.cohortLessonRecords[k]?.plan || ''; change(st => { st.cohortLessonRecords[k] = { ...(st.cohortLessonRecords[k] ?? { plan: '', actual: '' }), plan }; }); undoBar(`${C.COHORTS.find(c => c.id === cid).label} 미완료 계획을 이월했어요.`, () => change(st => { st.cohortLessonRecords[k].plan = old; })); return; }
  if (d.copyPlan) { const plan = b.closest('.school').dataset.prevPlan; change(st => { st.cohortLessonRecords[d.copyPlan] = { ...(st.cohortLessonRecords[d.copyPlan] ?? { plan: '', actual: '' }), plan }; }); return; }
  if (d.copyPlanPlain) { const box = b.closest('.school'), k = d.copyPlanPlain, old = s.lessonRecords[k]?.plan || ''; change(st => { st.lessonRecords[k] = { ...(st.lessonRecords[k] ?? { plan: '', actual: '', homework: '', next: '' }), plan: box.dataset.prevPlan }; }); undoBar(`${C.fmtMd(box.dataset.prevDate)} 계획을 복사했어요.`, () => change(st => { st.lessonRecords[k].plan = old; })); return; }
  if (d.saveTemplate) { const [k, cid] = d.saveTemplate.split('|'); change(st => { st.lessonTemplates.push({ id: C.uid(), name: `${C.COHORTS.find(c => c.id === cid).short} 수업`, content: st.cohortLessonRecords[k].plan }); }); toast('템플릿으로 저장했어요.'); return; }
  if (d.monthFilter) { A.monthFilter = d.monthFilter; render(); return; }
  if (d.monthDay) return monthDialog(d.monthDay);
  if (d.examEdit !== undefined) return examDialog(d.examEdit || null);
  if (d.examRoll) { const x = C.examsOf(s).find(e => e.id === d.examRoll); if (!confirm(`${x.school} ${x.label}을(를) 마치고 다음 시험을 준비할까요?\n지금 범위와 체크는 '지난 시험 기록'에 보관되고, 범위는 새로 비워져요.`)) return; change(st => C.rollExam(st, x.id)); toast(`${x.school}: ${C.nextExamLabel(x.label)} 준비를 시작해요. 시험 날짜를 정해 주세요.`); return; }
  if (d.memoDel) { const i = s.quickMemos.findIndex(m => m.id === d.memoDel), m = s.quickMemos[i]; change(st => { st.quickMemos.splice(i, 1); }); undoBar('메모를 삭제했어요.', () => change(st => { st.quickMemos.unshift(m); })); return; }
  if (d.linkDel) { const l = s.resourceLinks.find(x => x.id === d.linkDel); change(st => { st.resourceLinks = st.resourceLinks.filter(x => x.id !== l.id); }); undoBar(`‘${l.label}’ 링크를 삭제했어요.`, () => change(st => { st.resourceLinks.push(l); })); return; }
  if (d.templateDel) { const t = s.lessonTemplates.find(x => x.id === d.templateDel); change(st => { st.lessonTemplates = st.lessonTemplates.filter(x => x.id !== t.id); }); undoBar(`‘${t.name}’ 템플릿을 삭제했어요.`, () => change(st => { st.lessonTemplates.push(t); })); return; }
  switch (d.act) {
    case 'day': A.sel = C.addDays(A.sel, Number(d.d)); render(); break;
    case 'to-today': A.sel = A.today; render(); break;
    case 'month': { const [y, m] = A.monthCursor.split('-').map(Number), n = new Date(Date.UTC(y, m - 1 + Number(d.d), 1)); A.monthCursor = n.toISOString().slice(0, 10); render(); break; }
    case 'schedule': scheduleDialog(); break;
    case 'task-new': taskDialog(null); break;
    case 'attendance': attendanceDialog(); break;
    case 'routine-add': addRoutine(); break;
    case 'memo-add': addMemo(); break;
    case 'link-add': addLink(); break;
    case 'pin-change': changePin(); break;
    case 'widget': window.open('/widget', 'sumus-widget', 'width=430,height=820,resizable=yes'); break;
    case 'menu': menu(b); break;
    case 'save-now': document.querySelector('.menu')?.remove(); store.save(); break;
    case 'backup': document.querySelector('.menu')?.remove(); backup(); break;
    case 'restore': document.querySelector('.menu')?.remove(); restore(); break;
    case 'lock': await store.save(); signOut(); break;
  }
});
root.addEventListener('change', e => {
  const t = e.target, d = t.dataset;
  if (d.taskDone) change(st => { const x = st.tasks.find(y => y.id === d.taskDone); if (x) x.done = t.checked; });
  else if (d.routine) change(st => { st.routineChecks[`${A.sel}-${d.routine}`] = t.checked; });
  else if (d.memoDone) change(st => { const m = st.quickMemos.find(x => x.id === d.memoDone); if (m) m.done = t.checked; });
  else if (d.time) { const key = d.time, day = A.sel; change(st => { (st.attendance[day] ||= { clockIn: '', clockOut: '' })[key] = t.value; }); }
  else if (d.template) { const tpl = S().lessonTemplates.find(x => x.id === t.value); if (tpl) change(st => { st.cohortLessonRecords[d.template] = { ...(st.cohortLessonRecords[d.template] ?? { plan: '', actual: '' }), plan: tpl.content }; }); }
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
  if (e.target.id === 'routine-new') { e.preventDefault(); addRoutine(); }
  if (e.target.id === 'memo-new') { e.preventDefault(); addMemo(); }
});
function addRoutine() { const i = $('#routine-new'), v = i?.value.trim(); if (!v) return; i.value = ''; change(st => { st.routineItems.push({ id: C.uid(), title: v }); }); }
function addMemo() { const i = $('#memo-new'), v = i?.value.trim(); if (!v) return; i.value = ''; change(st => { st.quickMemos.unshift({ id: C.uid(), text: v, done: false, createdAt: new Date().toISOString() }); }); }
function addLink() {
  const label = $('#link-label').value.trim(), raw = $('#link-url').value.trim(), cohortId = $('#link-cohort').value;
  if (!label || !raw) return toast('자료 이름과 주소를 적어 주세요.');
  change(st => { st.resourceLinks.push({ id: C.uid(), label, url: /^https?:\/\//i.test(raw) ? raw : `https://${raw}`, cohortId }); });
}
async function changePin() {
  const msg = $('#pin-msg'); msg.textContent = '변경 중…';
  try {
    await api('/api/auth', { method: 'PATCH', body: JSON.stringify({ currentPin: $('#pin-cur').value, newPin: $('#pin-new').value }) });
    alert('PIN이 변경됐어요. 새 PIN으로 다시 들어와 주세요.'); location.reload();
  } catch (err) { msg.textContent = err.status ? err.message : '연결을 확인하고 다시 시도해주세요.'; }
}
function backup() {
  const blob = new Blob([JSON.stringify(S(), null, 2)], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `SUMUS_Planner_${C.todayKst()}.json`; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
function restore() {
  const input = document.createElement('input'); input.type = 'file'; input.accept = 'application/json,.json';
  input.onchange = async () => {
    try {
      const data = JSON.parse(await input.files[0].text());
      if (!data || typeof data !== 'object' || !Array.isArray(data.tasks)) throw new Error('bad');
      if (!confirm('백업 파일로 현재 데이터를 덮어쓸까요?\n(서버에 저장된 내용도 바뀌어요. 먼저 \'백업 받기\'를 권장해요.)')) return;
      // The backup replaces everything (its own migrations flag included), then exams move on.
      change(st => { const next = C.normalizeState(data, C.todayKst()); Object.keys(st).forEach(k => delete st[k]); Object.assign(st, next); });
      housekeeping();
      toast('백업을 불러왔어요.');
    } catch { alert('올바른 SUMUS Planner 백업 파일이 아니에요.'); }
  };
  input.click();
}

boot();
