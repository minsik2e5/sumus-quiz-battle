// V13.215 선생님 첫 화면 줄이기 검사(npm run check). 운영 크기 상태(server/tournament-load.mjs prodLikeState: 연습 기록 약 9MB ·
// 숙련도 약 2.4MB · 학생 44명)에서
//   1. 선생님 /bootstrap이 예산(server/perf-budget.mjs RESPONSE_BUDGET_KB) 아래이고, 연습 기록 전체 · 단어 숙련도 · 큰 프로필 칸이 빠졌다.
//   2. 대시보드 · 학생 관리 · 이번 주 요약이 쓰는 학생별 숫자(session_digest)가 전체 기록으로 센 예전 값과 같다.
//   3. 결과 분석(GET /teacher/records) · 학생 기록 창(GET /teacher/student-detail/:id)이 작은 쪽으로 같은 값을 준다.
//   4. 권한: 선생님만 · 맡은 학교 · 부서만 · 미리보기 계정 제외 · GET만 · 상태를 바꾸지 않는다.
//   5. 화면이 그 탭 · 창을 열 때 새 GET으로 받는다(소스 검사).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';
import { prodLikeState } from './tournament-load.mjs';
import { service } from './service.mjs';
import { hashToken } from './auth.mjs';
import { dayKey } from '../public/modules/core.js';
import { RESPONSE_BUDGET_KB } from './perf-budget.mjs';
import { teacherWeekStart, TEACHER_STAT_KEYS } from './teacher-home.mjs';

const source = path => readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8');
const kb = value => JSON.stringify(value).length / 1024;
const DAY = 86400000;
const score = s => Number(s.score ?? (s.total ? Math.round(s.correct / s.total * 100) : 0));

// 운영 크기 상태 + 오늘 학습(학생마다 3판, 그중 일부는 실전시험) + 다른 학교 학생 · 미리보기 계정 기록.
export function teacherHomeState(now = Date.now()) {
  const state = prodLikeState({ now });
  const dayStart = now - ((now + 9 * 3600000) % DAY);
  state.profiles.forEach((p, i) => { p.self_signup = i % 7 === 0; p.created_at = now - (i % 10) * DAY; });
  state.profiles.push(
    { id: 'th-t', username: 'th_t', display_name: '선생님', role: 'teacher', active: true, password_hash: 'x', school_ids: ['gangseo-high'], division_ids: ['high'], active_division: 'high', active_school_id: 'gangseo-high', created_at: now },
    { id: 'th-t2', username: 'th_t2', display_name: '다른 학교 선생님', role: 'teacher', active: true, password_hash: 'x', school_ids: ['danwon-high'], division_ids: ['high'], active_division: 'high', active_school_id: 'danwon-high', created_at: now },
    { id: 'th-other', username: 'th_other', display_name: '단원 학생', role: 'student', active: true, password_hash: 'x', class_name: '고1A', school_id: 'danwon-high', school: '단원고', division: 'high', created_at: now },
    { id: 'th-pv', username: 'th_pv', display_name: '미리보기', role: 'student', active: true, password_hash: 'x', class_name: '고1A', school_id: 'gangseo-high', school: '강서고', division: 'high', preview_owner_id: 'th-t', created_at: now }
  );
  for (const [id, token] of [['th-t', 'th-t-token'], ['th-t2', 'th-t2-token'], ['sl-0', 'th-s-token']]) state.tokens.push({ hash: hashToken(token), user_id: id, expires_at: now + DAY });
  const base = { division: 'high', school_id: 'gangseo-high', school: '강서고', total: 20, correct: 15, xp: 20, range_codes: ['24'], mode: 'write_meaning' };
  for (let i = 0; i < 44 * 3; i++) {
    const t = Math.round(dayStart + (now - dayStart) * (i + 1) / (44 * 3 + 1));
    state.sessions.push({ ...base, id: 'th-today-' + i, student_id: `sl-${i % 44}`, created_at: t, score: 75, ...(i % 10 === 0 ? { run_mode: 'test', ended_at: t + 60000 } : {}) });
  }
  for (let i = 0; i < 40; i++) state.sessions.push({ ...base, id: 'th-test-' + i, student_id: `sl-${i % 44}`, created_at: now - (2 + i) * DAY, run_mode: 'test', ended_at: now - (2 + i) * DAY + 90000, score: 60 + (i % 40) });
  state.sessions.push({ ...base, id: 'th-pv-s', student_id: 'th-pv', created_at: now - 1000 }, { ...base, id: 'th-pv-t', student_id: 'th-pv', created_at: now - 1000, run_mode: 'test' });
  state.sessions.push({ ...base, id: 'th-other-s', student_id: 'th-other', school_id: 'danwon-high', school: '단원고', created_at: now - 1000 });
  return state;
}

export async function runTeacherHomeChecks(assert, expectStatus) {
  const now = Date.now();
  const state = teacherHomeState(now);
  const before = JSON.stringify(state).length;
  const t0 = performance.now();
  const boot = await service(state, 'GET', '/bootstrap', {}, 'th-t-token');
  const bootMs = performance.now() - t0;
  const bootKb = kb(boot);

  // 1. 크기 예산과 빠진 것.
  assert(bootKb <= RESPONSE_BUDGET_KB.teacher_bootstrap, `V13.215 선생님 첫 화면(운영 크기)이 ${RESPONSE_BUDGET_KB.teacher_bootstrap}KB 아래다 (${Math.round(bootKb)}KB, 예전 약 1,340KB)`);
  assert(boot.word_mastery === null && boot.sessions_scope === 'home', 'V13.215 선생님 첫 화면에 학생별 단어 숙련도(word_mastery)를 싣지 않는다');
  const mine = state.sessions.filter(s => s.school_id === 'gangseo-high' && s.student_id.startsWith('sl-'));
  const todays = mine.filter(s => dayKey(s.created_at) === dayKey(now));
  const ids = new Set(boot.sessions.map(s => s.id));
  assert(todays.every(s => ids.has(s.id)) && boot.sessions.length < todays.length + 7 && boot.sessions.every(s => s.details_omitted && !s.answer_records && !s.word_ids),
    `V13.215 첫 화면의 연습 기록은 오늘 것 전부 + 최근 실전시험 몇 개만, 답안 목록 없이 (${boot.sessions.length}개 / 전체 ${mine.length}개)`);
  const tests = mine.filter(s => s.run_mode === 'test').sort((a, b) => (b.ended_at || b.created_at) - (a.ended_at || a.created_at)).slice(0, 6);
  assert(tests.every(s => ids.has(s.id)), 'V13.215 대시보드 실전시험 결과 칸(최근 6개)은 오늘이 아니어도 그대로 보인다');
  const row = boot.profiles.find(p => p.id === 'sl-0');
  assert(boot.profiles.length === 44 && row && !('titles_seen' in row) && !('activity' in row) && !('reel' in row) && !('hunt' in row) && row.pets.every(pet => Object.keys(pet).join() === 'key'),
    'V13.215 선생님 학생 목록은 화면이 쓰는 칸만(본 칭호 · 놀이터 기록 · 펫 상세 없음, 펫은 종류만)');
  assert(['id', 'username', 'display_name', 'class_name', 'active', 'avatar_key', 'created_at', 'school_id'].every(k => k in row) && row.self_signup === true && ['level', 'today_total', 'accuracy', 'practice_count', 'weak'].every(k => k in row.stats) && Object.keys(row.stats).every(k => TEACHER_STAT_KEYS.includes(k)),
    'V13.215 학생 목록에 학생 관리 · 대시보드 · 학생 기록 창이 쓰는 칸(이름 · 반 · 가입 · 레벨 · 오늘 · 정답률 · 취약 단어)은 그대로 있다');

  // 2. 학생별 숫자 = 전체 기록으로 센 예전 화면 값(public/modules/teacher.js weekWork · lastActivityMap).
  const start = teacherWeekStart(now), prev = start - 7 * DAY;
  let digestOk = Object.keys(boot.session_digest.students).length === 44 && boot.session_digest.week_start === start;
  for (let i = 0; i < 44; i++) {
    const own = mine.filter(s => s.student_id === `sl-${i}`), d = boot.session_digest.students[`sl-${i}`] || {};
    const week = own.filter(s => s.created_at >= start), last = Math.max(0, ...own.map(s => s.created_at));
    const prevTotal = own.filter(s => s.created_at >= prev && s.created_at < start).reduce((n, s) => n + s.total, 0);
    if (d.last !== last || d.week_count !== week.length || d.week_total !== week.reduce((n, s) => n + s.total, 0) || d.week_scores !== week.reduce((n, s) => n + score(s), 0) || d.prev_total !== prevTotal) digestOk = false;
  }
  assert(digestOk, 'V13.215 학생별 마지막 학습 · 이번 주 · 지난주 숫자(session_digest)가 전체 기록으로 센 값과 같다(대시보드 · 학생 관리 · 이번 주 요약)');

  // 3. 결과 분석 쪽 · 학생 기록 창.
  const t1 = performance.now();
  const page = await service(state, 'GET', '/teacher/records', { view: 'practice' }, 'th-t-token');
  const pageMs = performance.now() - t1;
  const practices = mine.filter(s => s.run_mode !== 'test').sort((a, b) => b.created_at - a.created_at);
  const avg = list => Math.round(list.reduce((n, s) => n + score(s), 0) / list.length);
  const allTests = mine.filter(s => s.run_mode === 'test');
  assert(page.rows.length === 30 && page.total === practices.length && page.rows.map(s => s.id).join() === practices.slice(0, 30).map(s => s.id).join() && page.rows.every(s => s.details_omitted && !s.answer_records),
    `V13.215 결과 분석 연습 기록은 최신순 30개씩, 답안 목록 없이 (${page.rows.length}/${page.total})`);
  assert(page.metrics.practices === practices.length && page.metrics.tests === allTests.length && page.metrics.practice_avg === avg(practices) && page.metrics.test_avg === avg(allTests) && page.metrics.questions === mine.reduce((n, s) => n + s.total, 0),
    'V13.215 결과 분석 숫자 칸(실전시험 · 평균 · 누적 문제)은 서버가 전체 기록으로 센 값');
  const next = await service(state, 'GET', '/teacher/records', { view: 'practice', offset: '30', limit: '30' }, 'th-t-token');
  assert(next.rows.map(s => s.id).join() === practices.slice(30, 60).map(s => s.id).join(), 'V13.215 더 보기는 다음 30개(offset)');
  const big = await service(state, 'GET', '/teacher/records', { view: 'practice', limit: '5000' }, 'th-t-token');
  assert(big.rows.length === 100 && kb(big) < RESPONSE_BUDGET_KB.teacher_records * 4, 'V13.215 한 번에 최대 100개까지만 준다');
  const sent = await service(state, 'GET', '/teacher/records', { view: 'sent' }, 'th-t-token');
  const sentOrder = [...allTests].sort((a, b) => (b.ended_at || b.created_at) - (a.ended_at || a.created_at));
  assert(sent.total === allTests.length && sent.rows.map(s => s.id).join() === sentOrder.slice(0, 30).map(s => s.id).join(), 'V13.215 실전시험 결과는 끝난 시간 최신순');
  const named = await service(state, 'GET', '/teacher/records', { view: 'practice', q: '저장1', class: '고1A' }, 'th-t-token');
  const nameHit = new Set(state.profiles.filter(p => p.id.startsWith('sl-') && p.display_name.includes('저장1')).map(p => p.id));
  assert(named.total === practices.filter(s => nameHit.has(s.student_id)).length && named.rows.every(s => nameHit.has(s.student_id)), 'V13.215 결과 분석 이름 · 반 거르기는 서버가 한다(받는 양이 준다)');
  const none = await service(state, 'GET', '/teacher/records', { view: 'practice', class: '고1B' }, 'th-t-token');
  assert(none.total === 0 && none.rows.length === 0, 'V13.215 다른 반으로 거르면 빈 쪽');
  assert(kb(page) <= RESPONSE_BUDGET_KB.teacher_records, `V13.215 결과 분석 한 쪽이 ${RESPONSE_BUDGET_KB.teacher_records}KB 아래 (${kb(page).toFixed(1)}KB)`);
  const detail = await service(state, 'GET', '/teacher/student-detail/sl-3', {}, 'th-t-token');
  const own3 = mine.filter(s => s.student_id === 'sl-3').sort((a, b) => b.created_at - a.created_at);
  assert(detail.recent.length === 5 && detail.recent.map(s => s.id).join() === own3.slice(0, 5).map(s => s.id).join() && detail.last_session_at === own3[0].created_at && detail.word_mastery?.ranges && 'conquest' in detail.word_mastery,
    'V13.215 학생 기록 창: 최근 연습 5개 · 마지막 학습 · 시험범위 정복(단어 숙련도)을 창을 열 때 받는다');
  assert(kb(detail) <= RESPONSE_BUDGET_KB.teacher_student_detail, `V13.215 학생 기록 창 답이 ${RESPONSE_BUDGET_KB.teacher_student_detail}KB 아래 (${kb(detail).toFixed(1)}KB)`);

  // 4. 권한 · 미리보기 · 다른 학교 · 읽기 전용.
  assert(!page.rows.some(s => s.student_id === 'th-pv' || s.student_id === 'th-other') && !sent.rows.some(s => s.student_id === 'th-pv') && !boot.sessions.some(s => s.student_id === 'th-pv' || s.student_id === 'th-other'),
    'V13.215 결과 분석 · 첫 화면에 미리보기 계정 · 다른 학교 학생의 기록이 없다');
  await expectStatus(404, () => service(state, 'GET', '/teacher/student-detail/th-pv', {}, 'th-t-token'), 'V13.215 미리보기 계정은 학생 기록 창으로 열 수 없다');
  await expectStatus(404, () => service(state, 'GET', '/teacher/student-detail/th-other', {}, 'th-t-token'), 'V13.215 다른 학교 학생의 기록 창은 열 수 없다');
  const other = await service(state, 'GET', '/teacher/records', { view: 'practice' }, 'th-t2-token');
  assert(other.total === 1 && other.rows[0].id === 'th-other-s', 'V13.215 다른 학교 선생님은 그 학교 기록만 받는다');
  await expectStatus(404, () => service(state, 'GET', '/teacher/student-detail/sl-3', {}, 'th-t2-token'), 'V13.215 다른 학교 선생님은 우리 학교 학생 기록 창을 열 수 없다');
  await expectStatus(403, () => service(state, 'GET', '/teacher/records', { view: 'practice' }, 'th-s-token'), 'V13.215 학생은 결과 분석 기록을 받을 수 없다');
  await expectStatus(403, () => service(state, 'GET', '/teacher/student-detail/sl-0', {}, 'th-s-token'), 'V13.215 학생은 학생 기록 창을 받을 수 없다');
  await expectStatus(405, () => service(state, 'POST', '/teacher/records', {}, 'th-t-token'), 'V13.215 결과 분석 기록은 GET만(보기)');
  await expectStatus(401, () => service(state, 'GET', '/teacher/records', {}, null), 'V13.215 로그인하지 않으면 받을 수 없다');
  assert(JSON.stringify(state).length === before, 'V13.215 첫 화면 · 결과 분석 · 학생 기록 창은 상태를 바꾸지 않는다(읽기 전용)');
  const studentBoot = await service(state, 'GET', '/bootstrap', {}, 'th-s-token');
  assert(Array.isArray(studentBoot.sessions) && studentBoot.sessions.length === mine.filter(s => s.student_id === 'sl-0').length && studentBoot.word_mastery?.ranges && studentBoot.session_digest === null,
    'V13.215 학생 첫 화면은 그대로(자기 연습 기록 전부 · 단어 숙련도)');

  // 5. 화면 소스: 그 탭 · 창을 열 때 새 GET으로 받는다.
  const teacher = source('../public/modules/teacher.js'), records = source('../public/modules/teacher-records.js');
  const enh = source('../public/teacher-enhancements.js'), app = source('../public/app.js'), sessions = source('../public/modules/sessions.js');
  const resultsFn = teacher.slice(teacher.indexOf('function results(A)'), teacher.indexOf('function trimPanel(A)'));
  assert(resultsFn.includes('teacherRecords({') && !resultsFn.includes('A.data.sessions'), 'V13.215 결과 분석 탭은 GET /teacher/records(teacherRecords)로 받고 첫 화면 기록을 훑지 않는다');
  assert(records.includes("api('/teacher/records?") && records.includes("api('/teacher/student-detail/") && !/setInterval/.test(records) && /FRESH_MS = 60000/.test(records),
    'V13.215 새 GET은 탭을 열 때만 묻고(자동 반복 없음) 1분 동안 같은 조건을 다시 묻지 않는다(캐시)');
  assert(/session_digest\?\.students/.test(teacher.slice(teacher.indexOf('function lastActivityMap'), teacher.indexOf('export function agoLabel'))) && /session_digest\?\.students/.test(teacher.slice(teacher.indexOf('function weekWork'), teacher.indexOf('function careGroups'))),
    'V13.215 대시보드 · 학생 관리 · 이번 주 요약은 session_digest로 센다');
  assert(enh.includes('await teacherStudentDetail(id)') && enh.includes('detail?.word_mastery') && enh.includes('detail?.recent') && app.includes('await teacherStudentDetail(id)'),
    'V13.215 학생 기록 창은 열 때 GET /teacher/student-detail/:id로 최근 연습 · 시험범위 정복을 받는다');
  assert(sessions.includes('findTeacherRecord(sessionId)') && /if \(!session \|\| session\.details_omitted\)|if \(session && !session\.details_omitted\) return session;/.test(sessions) /* v13.216부터 두 번째 모양 */, 'V13.215 결과 분석 탭의 기록도 답안 보기가 열린다(없으면 GET /sessions/:id)');
  assert(/markTeacherRecordsStale\(\)/.test(app.slice(app.indexOf('async function refresh()'), app.indexOf('async function refresh()') + 600)) && /clearTeacherRecords\(\);\s*await refresh\(\);/.test(app),
    'V13.215 첫 화면을 다시 받으면(재채점 · 학생 정보 변경) 결과 분석 기록도 다시 받고, 학교 · 부서를 바꾸면 비운다');

  return { bootKb: Math.round(bootKb), bootMs: Math.round(bootMs), pageKb: +kb(page).toFixed(1), pageMs: Math.round(pageMs), detailKb: +kb(detail).toFixed(1), studentKb: Math.round(kb(studentBoot)) };
}
