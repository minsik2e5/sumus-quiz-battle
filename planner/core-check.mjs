// Checks of the planner rules (public/core.js).
import { createDefaultState, normalizeState, classesOn, rangeStats, pace, remainingClasses, examForCohort, examStatus, rollExam, autoRollExams, applyMigrations, workDuration, sleepDay, findPrevCohortLesson, addDays, fmtLong, dayProgress } from './public/core.js';

export async function runCoreChecks(assert) {
  let n = 0; const ok = (c, l) => { n++; assert(c, l); };
  ok(fmtLong('2026-10-01') === '10월 1일 목요일' && addDays('2026-09-30', 2) === '2026-10-02', 'KST dates');
  ok(classesOn('2026-10-01', createDefaultState('2026-10-01')).join() === '중2,중2,고1A,고1A', 'Thursday timetable');
  // an old backup (no exams / examHistory) loads with the defaults and keeps its own lists
  const old = { tasks: [], rangeItems: { gangseo: [{ id: 'x', label: '모의고사 99번' }] }, rangeChecks: { 'gangseo-x': true } };
  const s = normalizeState(old, '2026-10-01');
  ok(s.exams.length === 5 && s.exams.find(x => x.id === 'seonbu').end === '2026-10-02' && s.rangeItems.gangseo.length === 1 && s.rangeItems['danwon-a'].length === 15 && rangeStats(s, 'gangseo').pct === 100, 'normalize keeps stored lists, adds exams');
  ok(examStatus(examForCohort('gangseo', s, '2026-10-01'), '2026-10-01') === 'D-11' && remainingClasses('2026-10-01', 'gangseo', s) > 0, 'exam status and remaining lessons');
  // the one-off move of 단원고·선부고 to 기말고사
  const t = normalizeState({ tasks: [], rangeChecks: { 'danwon-a-text-1': true, 'seonbu-text-3': true, 'gangseo-text-1': true } }, '2026-10-01');
  applyMigrations(t, Date.parse('2026-10-01T05:00:00Z'));
  const dw = t.exams.find(x => x.id === 'danwon'), sb = t.exams.find(x => x.id === 'seonbu');
  ok(dw.label === '기말고사' && dw.start === '' && sb.label === '기말고사' && t.rangeItems['danwon-a'].length === 0 && t.rangeItems['danwon-b'].length === 0 && t.rangeItems.seonbu.length === 0, '단원고·선부고 move to 기말고사 with empty ranges');
  ok(!t.rangeChecks['danwon-a-text-1'] && t.rangeChecks['gangseo-text-1'] && t.examHistory['danwon-a'][0].checks['text-1'] === true && t.examHistory['danwon-a'][0].items.length === 15 && t.examHistory.seonbu[0].label === '중간고사', 'the old range and checks are kept in history; 강서고 untouched');
  applyMigrations(t);
  ok(t.examHistory['danwon-a'].length === 1, 'the migration runs once');
  ok(examStatus(dw, '2026-10-02') === '날짜 미정' && pace(t, 'danwon-a', '2026-10-02').state === '준비', 'an undated exam shows 날짜 미정');
  // 강서고 moves on by itself after its last day, once
  ok(autoRollExams(t, '2026-10-14').length === 0, 'nothing moves during the exam');
  ok(autoRollExams(t, '2026-10-15').includes('강서고') && t.exams.find(x => x.id === 'gangseo').label === '기말고사' && t.examHistory.gangseo[0].checks['text-1'] === true, '강서고 moves on the day after');
  ok(autoRollExams(t, '2026-10-16').length === 0 && t.examHistory.gangseo.length === 1, 'and only once');
  ok(workDuration('09:10', '18:15') === '9시간 5분' && workDuration('22:00', '01:00') === '3시간', 'work time');
  ok(sleepDay(Date.parse('2026-10-01T15:40:00Z')) === '2026-10-01' && sleepDay(Date.parse('2026-10-01T13:00:00Z')) === '2026-10-01', 'sleep after midnight counts for the night before');
  const r = normalizeState({ tasks: [], cohortLessonRecords: { '2026-09-29-2-gangseo': { plan: 'p', actual: '본문 1과' } } }, '2026-10-01');
  ok(findPrevCohortLesson('2026-10-01', '고1A', 'gangseo', r, 2)?.record.actual === '본문 1과', 'previous lesson of the same school');
  ok(dayProgress(createDefaultState('2026-10-01'), '2026-10-01').total === 4 + 4 + 5, 'day progress counts tasks, classes and routines');
  return n;
}
