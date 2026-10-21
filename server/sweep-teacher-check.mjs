// V13.168 선생님 화면 점검(sweep): 미리보기 계정이 선생님 화면(학생 관리 · 결과 분석 · 시험 명단)에 섞이지 않는지,
// 학교 · 부서를 바꿀 때 예전 거르기가 남지 않는지, 로컬 Node 서버가 Cloudflare와 같게 요청을 받는지.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { emptyState } from './state.mjs';
import { passwordHash } from './auth.mjs';
import { service } from './service.mjs';
import { examAdmin } from './exam-admin.mjs';

const source = path => readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8');
const DAY = 86400000;
// 시각을 고정한다(요일 · 시간에 따라 결과가 바뀌지 않게).
const T0 = Date.UTC(2026, 9, 21, 3, 0, 0);

export async function runSweepTeacherChecks(assert, expectStatus) {
  const state = emptyState(), hash = await passwordHash('QaSweepT1!');
  const student = (id, name, extra = {}) => ({ id, username: id, display_name: name, role: 'student', active: true, class_name: '고1A', school_id: 'danwon-high', school: '단원고', division: 'high', password_hash: hash, pets: [{ key: 'dog', first: true, acquired_at: T0 - 9 * DAY }], avatar_key: 'dog', created_at: T0 - 9 * DAY, ...extra });
  state.profiles.push(
    { id: 'qa-sw-t', username: 'qa_sw_t', display_name: '선생님', role: 'teacher', active: true, password_hash: hash, school_ids: ['danwon-high'], division_ids: ['high'], active_division: 'high', active_school_id: 'danwon-high', created_at: T0 - 9 * DAY },
    student('qa-sw-a', '가람'), student('qa-sw-b', '나무')
  );
  const teacher = (await service(state, 'POST', '/login', { username: 'qa_sw_t', password: 'QaSweepT1!', role: 'teacher', division: 'high' }, null))._cookie;
  const preview = await service(state, 'POST', '/teacher/student-preview', { school_id: 'danwon-high', grade: '고1A' }, teacher);
  const pid = preview.profile.id;
  // 미리보기 계정이 연습 한 판 · 실전시험 한 번을 한 기록(실제 흐름이 남기는 모양 그대로).
  const session = (id, sid) => ({ id, student_id: sid, created_at: T0 - DAY, total: 20, correct: 18, answered_count: 20, xp: 120, reward_points: 60, range_codes: ['24'], mode: 'eng2mean', score: 90, division: 'high', school_id: 'danwon-high', school: '단원고', grade: '고1A' });
  state.sessions.push(session('qa-sw-s-pv', pid), session('qa-sw-s-a', 'qa-sw-a'));
  state.exams.push({ id: 'qa-sw-e', title: 'QA', division: 'high', school_id: 'danwon-high', school: '단원고', class_name: '고1A', active: true, available_at: T0 - DAY, due_at: T0 + 30 * DAY, max_attempts: 1, range_codes: ['24'], question_count: 5, duration_sec: 600, exam_type: 'eng2mean_mc', passing_score: 60 });
  const attempt = (id, sid) => ({ id, exam_id: 'qa-sw-e', student_id: sid, status: 'submitted', started_at: T0 - DAY, submitted_at: T0 - DAY + 60000, score: 80, correct: 4, total: 5, questions: [], answers: {}, details: [] });
  state.examAttempts.push(attempt('qa-sw-at-pv', pid), attempt('qa-sw-at-a', 'qa-sw-a'));

  const boot = await service(state, 'GET', '/bootstrap', {}, teacher);
  assert(!boot.profiles.some(x => x.id === pid) && boot.profiles.length === 2, 'V13.168 선생님 학생 목록(대시보드 · 학생 관리 · 결과 분석 · 내보내기)에 미리보기 계정이 나오지 않는다');
  assert(!boot.sessions.some(s => s.student_id === pid) && boot.sessions.some(s => s.student_id === 'qa-sw-a'), 'V13.168 선생님 결과 분석에 미리보기 계정의 연습 기록이 섞이지 않는다(진짜 학생 기록은 그대로)');
  assert(!boot.attempts.some(a => a.student_id === pid) && boot.attempts.some(a => a.student_id === 'qa-sw-a'), 'V13.168 선생님 시험 현황에 미리보기 계정의 응시 기록이 섞이지 않는다');
  assert(!(pid in (boot.word_mastery || {})) && !(pid in (boot.grammar_progress || {})), 'V13.168 선생님 단어 · 어법 진도표에도 미리보기 계정이 없다');

  const roster = await examAdmin(state, 'GET', '/admin/exams/qa-sw-e/roster', {}, teacher);
  assert(!roster.students.some(s => s.id === pid) && roster.counts.total === 2 && roster.counts.not_started === 1, 'V13.168 실전시험 명단 · 미응시 수에 미리보기 계정이 들어가지 않는다');

  // 미리보기 계정 자신은 자기 기록을 그대로 본다.
  const own = await service(state, 'GET', '/bootstrap', {}, preview._cookie);
  assert(own.sessions.some(s => s.student_id === pid) && own.profile.id === pid, 'V13.168 미리보기 계정 자신은 자기 연습 기록을 그대로 본다');
  // 미리보기 계정은 선생님 기능에 들어갈 수 없고, 나가면 선생님 화면으로 돌아간다.
  await expectStatus(403, () => examAdmin(state, 'GET', '/admin/exams/qa-sw-e/roster', {}, preview._cookie), 'V13.168 미리보기 계정 토큰으로는 시험 명단을 볼 수 없다');
  const back = await service(state, 'POST', '/student-preview/exit', {}, preview._cookie);
  assert(back.profile.id === 'qa-sw-t', 'V13.168 미리보기에서 나가면 선생님 계정으로 돌아간다');

  // 학교 · 부서를 바꾸면 결과 분석 반 거르기 · 단어 범위 거르기가 처음으로 돌아간다(예전 반이 남아 빈 표).
  const app = source('../public/app.js');
  const sw = app.slice(app.indexOf('async function performTeacherContextSwitch'), app.indexOf('await refresh();', app.indexOf('async function performTeacherContextSwitch')));
  assert(sw.includes("A.resultsClass = ''") && sw.includes("A.vocabRange = ''"), 'V13.168 학교 · 부서 바꾸기에서 결과 분석 반 · 단어 범위 거르기를 지운다');

  // 로컬 Node 서버(server/index.mjs)도 Cloudflare처럼 DELETE(학생 삭제)와 GET ?token=(교실 TV 링크)을 받는다.
  const index = source('./index.mjs');
  assert(/\['GET', 'POST', 'PATCH', 'DELETE'\]\.includes\(req\.method\)/.test(index), 'V13.168 로컬 서버가 학생 계정 삭제(DELETE)를 받는다');
  assert(index.includes("req.method === 'GET' ? Object.fromEntries(url.searchParams)"), 'V13.168 로컬 서버가 GET 주소의 값(교실 TV ?token=)을 넘긴다');
  // 그 값으로 실제 교실 TV 링크가 열린다.
  const { token } = await service(state, 'POST', '/teacher/class-league/tv', {}, (await service(state, 'POST', '/login', { username: 'qa_sw_t', password: 'QaSweepT1!', role: 'teacher', division: 'high' }, null))._cookie);
  const tv = await service(state, 'GET', '/tv/classes', Object.fromEntries(new URLSearchParams(`token=${encodeURIComponent(token)}`)), null);
  assert(tv.league?.school === '단원고' && tv.league.classes.every(c => c.students === 2), 'V13.168 교실 TV 링크(반 대항전)가 열리고 미리보기 계정은 반 인원에 없다');
}
