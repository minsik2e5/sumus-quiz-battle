// Planner rules shared by the planner page, the widget and the checks. The saved document keeps
// the shape of the ChatGPT Sites planner (v14) so its backup files load as they are.

export const WD = ['일', '월', '화', '수', '목', '금', '토'];
export const DISPLAY_NAME = '김정수 선생님';
export const todayKst = (now = Date.now()) => new Date(now + 9 * 3600000).toISOString().slice(0, 10);
export const nowHM = (now = Date.now()) => new Date(now + 9 * 3600000).toISOString().slice(11, 16);
export const parseKst = d => new Date(`${d}T00:00:00+09:00`);
const dow = d => new Date(parseKst(d).getTime() + 9 * 3600000).getUTCDay();
export const addDays = (d, n) => new Date(parseKst(d).getTime() + n * 86400000 + 9 * 3600000).toISOString().slice(0, 10);
export const daysBetween = (a, b) => Math.round((parseKst(b) - parseKst(a)) / 86400000);
const mdParts = d => { const [, m, day] = d.split('-').map(Number); return [m, day]; };
export const fmtLong = d => { const [m, day] = mdParts(d); return `${m}월 ${day}일 ${WD[dow(d)]}요일`; };
export const fmtMd = d => { const [m, day] = mdParts(d); return `${m}.${String(day).padStart(2, '0')}`; };
export const fmtMdDow = d => `${fmtMd(d)} (${WD[dow(d)]})`;
export const weekday = d => dow(d);
export const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
export const mondayOf = d => addDays(d, -((dow(d) + 6) % 7));

export const WEEK_SCHEDULE = {
  1: ['중3', '중3', '고1B', '고1B'],
  2: ['중2', '중2', '고1A', '고1A'],
  3: ['중3', '중3', '고1B', '고1B'],
  4: ['중2', '중2', '고1A', '고1A'],
  5: ['중3', '중2', '고1B', '고1A']
};
export const SLOT_TIMES = [['16:30', '17:30'], ['17:30', '18:30'], ['18:30', '19:40'], ['19:40', '21:00']];
export const CLASS_GROUP_LABEL = { 고1A: '단원고 A · 강서고', 고1B: '단원고 B · 선부고' };
const DANWON_ITEMS = [
  { id: 'text-1', label: '본문 1과' }, { id: 'text-2', label: '본문 2과' },
  { id: 'listen-2', label: '듣기 2번' }, { id: 'listen-5', label: '듣기 5번' },
  ...[24, 29, 31, 32, 33, 34, 36, 39, 40, 41, 42].map(n => ({ id: `read-${n}`, label: `독해 ${n}번` }))
];
export const COHORTS = [
  { id: 'danwon-a', label: '단원고 A', short: '단원고 A', className: '고1A', tone: 'blue', items: DANWON_ITEMS },
  { id: 'gangseo', label: '강서고', short: '강서고', className: '고1A', tone: 'sky', items: [
    { id: 'text-1', label: '본문 1과' }, { id: 'text-2', label: '본문 2과' },
    ...[21, 23, 29, 30, 31, 32, 33, 34, 36, 37, 38, 39, 40].map(n => ({ id: `mock-${n}`, label: `모의고사 ${n}번` }))] },
  { id: 'danwon-b', label: '단원고 B', short: '단원고 B', className: '고1B', tone: 'navy', items: DANWON_ITEMS },
  { id: 'seonbu', label: '선부고', short: '선부고', className: '고1B', tone: 'violet', items: [
    { id: 'text-1', label: '본문 1과' }, { id: 'text-3', label: '본문 3과' },
    { id: 'further-1', label: '1과 Further Reading p.24' }, { id: 'further-3', label: '3과 Further Reading p.72' },
    ...[35, 36, 37, 38, 39, 40, 41, 42, 43, 44].map(n => ({ id: `external-${n}`, label: `외부지문 ${n}번` }))] },
  { id: 'wonil3', label: '원일중3', short: '원일중3', className: '중3', tone: 'green', lessonSplit: false, items: [] },
  { id: 'wonil2', label: '원일중2', short: '원일중2', className: '중2', tone: 'amber', lessonSplit: false, items: [] }
];
export const DEFAULT_EXAMS = [
  { id: 'danwon', school: '단원고', label: '중간고사', start: '2026-09-28', end: '2026-10-01', color: 'red',
    scope: ['교과서 본문 1과 · 2과', '듣기 2번 · 5번', '독해 24, 29, 31, 32, 33, 34, 36, 39, 40, 41~42번', '2025년 9월 고1 인천광역시교육청 학력평가', '단어장: 독해 범위 10세트'],
    cohortIds: ['danwon-a', 'danwon-b'] },
  { id: 'seonbu', school: '선부고', label: '중간고사', start: '2026-09-29', end: '2026-10-02', color: 'violet',
    scope: ['교과서 본문 1과 · 3과', '1과 Further Reading p.24', '3과 Further Reading p.72', '부교재 외부지문 35~44번'], cohortIds: ['seonbu'] },
  { id: 'gangseo', school: '강서고', label: '중간고사', start: '2026-10-12', end: '2026-10-14', color: 'blue',
    scope: ['교과서 본문 1과 · 2과', '모의고사 21, 23, 29, 30, 31, 32, 33, 34, 36, 37, 38, 39, 40번', '2026년 6월 고1 부산광역시교육청 학력평가'], cohortIds: ['gangseo'] },
  { id: 'wonil3', school: '원일중3', label: '기말고사', start: '2026-11-10', end: '2026-11-12', color: 'green', cohortIds: ['wonil3'] },
  { id: 'wonil2', school: '원일중2', label: '기말고사', start: '2026-12-08', end: '2026-12-10', color: 'amber', cohortIds: ['wonil2'] }
];
export const EXAM_COLORS = [['red', '빨강'], ['blue', '파랑'], ['violet', '보라'], ['green', '초록'], ['amber', '주황']];
export const TASK_CATEGORIES = ['개인', '업무', '건강', '수업 준비'];
export const OVERRIDE_CLASS_OPTIONS = ['중2', '중3', '고1A', '고1B'];

export function createDefaultState(today) {
  return {
    tasks: [
      { id: uid(), date: today, start: '12:00', end: '12:30', title: '씻기 · 식사 · 준비', category: '개인', done: false },
      { id: uid(), date: today, start: '12:30', end: '13:00', title: '오늘 계획 확인', category: '업무', done: false },
      { id: uid(), date: today, start: '16:00', end: '16:30', title: '수업 준비', category: '수업 준비', done: false },
      { id: uid(), date: today, start: '21:00', end: '22:00', title: '수업 뒷정리', category: '업무', done: false }
    ],
    classDone: {},
    examProgress: { danwon: 35, seonbu: 28, gangseo: 12, wonil3: 0, wonil2: 0 },
    lessonRecords: {}, cohortLessonRecords: {},
    lessonTemplates: [
      { id: 'template-text', name: '본문 수업', content: '본문 해석 · 핵심 어법 · 내용 확인' },
      { id: 'template-mock', name: '모의고사', content: '지문 분석 · 핵심 문장 · 문제 풀이' },
      { id: 'template-review', name: '시험 복습', content: '오답 확인 · 핵심 범위 복습 · 미니 테스트' }
    ],
    quickMemos: [], resourceLinks: [], weeklyReviews: {}, attendance: {}, monthlyPlans: {},
    routineItems: [
      { id: 'wake', title: '기상' }, { id: 'ready', title: '씻기 · 식사 · 준비' }, { id: 'plan', title: '오늘 계획 확인' },
      { id: 'class-prep', title: '수업 준비' }, { id: 'cleanup', title: '수업 뒷정리' }
    ],
    routineChecks: {}, rangeChecks: {},
    rangeItems: Object.fromEntries(COHORTS.map(c => [c.id, c.items])),
    monthlyClassPlans: {}, scheduleOverrides: {},
    exams: DEFAULT_EXAMS.map(x => ({ ...x })),
    examHistory: {},
    notes: []
  };
}

// Fills missing fields; stored values always win (range lists, exams, everything).
export function normalizeState(st, today) {
  const n = createDefaultState(today);
  if (!st || typeof st !== 'object') return n;
  return {
    ...n, ...st,
    lessonRecords: st.lessonRecords ?? {}, cohortLessonRecords: st.cohortLessonRecords ?? {},
    lessonTemplates: st.lessonTemplates?.length ? st.lessonTemplates : n.lessonTemplates,
    quickMemos: st.quickMemos ?? [], resourceLinks: st.resourceLinks ?? [], weeklyReviews: st.weeklyReviews ?? {},
    attendance: st.attendance ?? {}, monthlyPlans: st.monthlyPlans ?? {},
    routineItems: st.routineItems?.length ? st.routineItems : n.routineItems,
    routineChecks: st.routineChecks ?? {}, rangeChecks: st.rangeChecks ?? {},
    rangeItems: { ...n.rangeItems, ...(st.rangeItems ?? {}) },
    monthlyClassPlans: st.monthlyClassPlans ?? {}, scheduleOverrides: st.scheduleOverrides ?? {},
    exams: st.exams?.length ? st.exams : n.exams,
    examHistory: st.examHistory ?? {},
    notes: Array.isArray(st.notes) ? st.notes : []
  };
}

export const classesOn = (date, s) => s.scheduleOverrides?.[date]?.classes ?? WEEK_SCHEDULE[dow(date)] ?? [];
export const splitCohorts = cls => COHORTS.filter(c => c.className === cls && c.lessonSplit !== false);
export const cohortKey = (date, slot, cohortId) => `${date}-${slot}-${cohortId}`;
export const examsOf = s => s?.exams?.length ? s.exams : DEFAULT_EXAMS;
// Exams without dates (날짜 미정, after moving on to the next exam) sort last.
export const sortExams = list => [...list].sort((a, b) => (a.start || '9999').localeCompare(b.start || '9999'));
export const examUndated = x => !x.start || !x.end;
export const examUpcoming = (x, today) => examUndated(x) || x.end >= today;
export function examForCohort(cohortId, s, today) {
  const linked = sortExams(examsOf(s).filter(x => x.cohortIds ? x.cohortIds.includes(cohortId) : x.id === (cohortId.startsWith('danwon') ? 'danwon' : cohortId)));
  return linked.find(x => examUpcoming(x, today)) ?? linked[linked.length - 1];
}
export function examStatus(x, today) {
  if (examUndated(x)) return '날짜 미정';
  if (x.end < today) return '종료';
  const d = daysBetween(today, x.start);
  return d <= 0 ? '시험 중' : `D-${d}`;
}
export const itemsOf = (s, cohortId) => s.rangeItems?.[cohortId] ?? COHORTS.find(c => c.id === cohortId)?.items ?? [];
export function rangeStats(s, cohortId) {
  const items = itemsOf(s, cohortId), checked = items.filter(i => s.rangeChecks[`${cohortId}-${i.id}`]).length;
  return { items, checked, pct: items.length ? Math.round(checked / items.length * 100) : 0 };
}
export function remainingClasses(today, cohortId, s) {
  const cohort = COHORTS.find(c => c.id === cohortId), exam = examForCohort(cohortId, s, today);
  if (!cohort || !exam || examUndated(exam) || exam.start < today) return 0;
  let count = 0;
  for (let d = today; d < exam.start; d = addDays(d, 1)) count += classesOn(d, s).filter(c => c === cohort.className).length;
  return count;
}
export function pace(s, cohortId, today) {
  const { items, checked } = rangeStats(s, cohortId);
  const lessons = remainingClasses(today, cohortId, s), remaining = Math.max(0, items.length - checked);
  const perLesson = lessons ? Math.ceil(remaining / lessons * 10) / 10 : remaining;
  const ex = examForCohort(cohortId, s, today);
  const state = !ex || (!examUndated(ex) && ex.end < today) ? '종료' : examUndated(ex) || !items.length ? '준비' : remaining ? (lessons === 0 || perLesson > 2 ? '지연' : perLesson > 1 ? '주의' : '여유') : '완료';
  return { lessons, remaining, perLesson, state };
}
export function workMinutes(a, b) {
  if (!a || !b) return null;
  const [h1, m1] = a.split(':').map(Number), [h2, m2] = b.split(':').map(Number);
  let m = h2 * 60 + m2 - (h1 * 60 + m1);
  if (m < 0) m += 1440;
  return m;
}
export const fmtDuration = m => m == null ? '' : `${Math.floor(m / 60)}시간${m % 60 ? ` ${m % 60}분` : ''}`;
export const workDuration = (a, b) => fmtDuration(workMinutes(a, b));
// 취침 before 5 a.m. belongs to the day before (the night of that day).
export function sleepDay(now = Date.now()) {
  const hm = nowHM(now), today = todayKst(now);
  return hm < '05:00' ? addDays(today, -1) : today;
}

export function findPrevLesson(date, cls, s, slot = 0) {
  const same = classesOn(date, s);
  for (let j = slot - 1; j >= 0; j--) { const r = s.lessonRecords[`${date}-${j}`]; if (same[j] === cls && (r?.actual || r?.plan)) return { date, record: r }; }
  for (let k = 1; k <= 60; k++) {
    const d = addDays(date, -k), cl = classesOn(d, s);
    for (let j = cl.length - 1; j >= 0; j--) { const r = s.lessonRecords[`${d}-${j}`]; if (cl[j] === cls && (r?.actual || r?.plan)) return { date: d, record: r }; }
  }
  return null;
}
export function findPrevCohortLesson(date, cls, cohortId, s, slot = 0) {
  const same = classesOn(date, s);
  for (let j = slot - 1; j >= 0; j--) { const r = s.cohortLessonRecords[cohortKey(date, j, cohortId)]; if (same[j] === cls && (r?.actual || r?.plan)) return { date, record: r }; }
  for (let k = 1; k <= 90; k++) {
    const d = addDays(date, -k), cl = classesOn(d, s);
    for (let j = cl.length - 1; j >= 0; j--) { const r = s.cohortLessonRecords[cohortKey(d, j, cohortId)]; if (cl[j] === cls && (r?.actual || r?.plan)) return { date: d, record: r }; }
  }
  return null;
}
export function dayProgress(s, date) {
  const tasks = (s.tasks || []).filter(t => t.date === date), classes = classesOn(date, s);
  const completed = tasks.filter(t => t.done).length + classes.filter((c, i) => c && s.classDone[`${date}-${i}`]).length + s.routineItems.filter(r => s.routineChecks[`${date}-${r.id}`]).length;
  const total = tasks.length + classes.filter(Boolean).length + s.routineItems.length;
  return { completed, total, pct: total ? Math.round(completed / total * 100) : 0 };
}

// 2차: when an exam is over, its range and checks are kept in examHistory and the cards start
// empty for the next exam (중간고사 -> 기말고사 -> 다음 학기 중간고사, dates to be set).
export const nextExamLabel = label => /중간/.test(label) ? '기말고사' : /기말/.test(label) ? '중간고사' : '다음 시험';
export function rollExam(s, examId, now = Date.now()) {
  const exam = examsOf(s).find(x => x.id === examId);
  if (!exam) return false;
  s.exams = examsOf(s).map(x => ({ ...x }));
  const target = s.exams.find(x => x.id === examId);
  const key = `${examId}-${exam.label}-${exam.end || 'undated'}`;
  for (const cohortId of exam.cohortIds || []) {
    const items = itemsOf(s, cohortId);
    const checks = Object.fromEntries(items.filter(i => s.rangeChecks[`${cohortId}-${i.id}`]).map(i => [i.id, true]));
    const list = (s.examHistory[cohortId] ||= []);
    if (!list.some(h => h.id === key)) list.push({ id: key, school: exam.school, label: exam.label, start: exam.start || '', end: exam.end || '', items, checks, closedAt: new Date(now).toISOString() });
    for (const k of Object.keys(s.rangeChecks)) if (k.startsWith(`${cohortId}-`)) delete s.rangeChecks[k];
    s.rangeItems[cohortId] = [];
  }
  Object.assign(target, { label: nextExamLabel(exam.label), start: '', end: '', scope: [] });
  return true;
}
// Exams whose last day has passed move on by themselves (every device agrees: the same key).
export function autoRollExams(s, today, now = Date.now()) {
  const done = [];
  for (const x of examsOf(s)) if (!examUndated(x) && x.end < today && x.cohortIds?.length) { if (rollExam(s, x.id, now)) done.push(x.school); }
  return done;
}
// One-off (2026-10-01, 원장님 요청): 단원고·선부고 go to 기말고사 now.
export function applyMigrations(s, now = Date.now()) {
  s.migrations ||= {};
  if (!s.migrations['2026-10-01-final']) {
    for (const id of ['danwon', 'seonbu']) { const x = examsOf(s).find(e => e.id === id); if (x && /중간/.test(x.label)) rollExam(s, id, now); }
    s.migrations['2026-10-01-final'] = true;
  }
}
