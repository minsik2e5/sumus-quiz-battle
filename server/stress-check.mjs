import { performance } from 'node:perf_hooks';
import { emptyState } from './state.mjs';
import { passwordHash } from './auth.mjs';
import { allBooks, service } from './service.mjs';
import { createMutationCoordinator } from './mutation-coordinator.mjs';

const STUDENTS = 20;
const QUESTIONS = 30;
const PASSWORD = 'LoadStudent123!';

const assert = (condition, message) => {
  if (!condition) throw new Error('[stress-check] FAIL · ' + message);
};

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

export async function runStressCheck() {
  const state = emptyState();
  const sharedHash = await passwordHash(PASSWORD);
  const school = state.schools.find(item => item.id === 'danwon-high');
  assert(school, '단원고 school exists');

  for (let index = 0; index < STUDENTS; index++) {
    state.profiles.push({
      id: 'load-student-' + index,
      username: 'load_student_' + index,
      display_name: 'LOAD ' + (index + 1),
      class_name: '고1A',
      role: 'student',
      division: 'high',
      school_id: school.id,
      school: school.name,
      active: true,
      avatar_key: 'dog',
      ranking_public: false,
      share_profile: false,
      password_hash: sharedHash,
      created_at: Date.now()
    });
  }

  const words = allBooks({ extraBooks: [] })
    .filter(book => book.school_id === school.id && (!book.grade || book.grade === '고1A'))
    .flatMap(book => book.words || []);
  const byRange = new Map();
  for (const word of words) {
    const code = String(word.range_code || '');
    if (!code) continue;
    if (!byRange.has(code)) byRange.set(code, new Set());
    byRange.get(code).add(word.id);
  }
  const rangeCodes = [];
  let scopedCount = 0;
  for (const [code, ids] of [...byRange.entries()].sort((a, b) => b[1].size - a[1].size)) {
    rangeCodes.push(code);
    scopedCount += ids.size;
    if (scopedCount >= QUESTIONS) break;
  }
  assert(scopedCount >= QUESTIONS, '30문제 이상 단어 범위를 확보');

  let persisted = structuredClone(state);
  let revision = 0;
  let writes = 0;
  const repo = {
    async read() { return { state: structuredClone(persisted), revision }; },
    async commit(nextState, expectedRevision) {
      await sleep(20);
      if (expectedRevision !== revision) throw Object.assign(new Error('revision conflict'), { status: 409 });
      persisted = structuredClone(nextState);
      revision += 1;
      writes += 1;
    }
  };

  const coordinator = createMutationCoordinator(repo, { state: structuredClone(state), revision: 0 }, {
    flushDelay: 120,
    retryDelay: 250
  });

  const loginStarted = performance.now();
  const logins = await Promise.all(Array.from({ length: STUDENTS }, (_, index) =>
    coordinator.durable(nextState => service(nextState, 'POST', '/login', {
      username: 'load_student_' + index,
      password: PASSWORD,
      role: 'student',
      division: 'high'
    }, null))
  ));
  const loginMs = Math.round(performance.now() - loginStarted);
  const tokens = logins.map(item => item._cookie);
  assert(tokens.every(Boolean), '20명 동시 로그인 토큰 발급');

  const startStarted = performance.now();
  let views = await Promise.all(tokens.map(token =>
    coordinator.durable(nextState => service(nextState, 'POST', '/practice/start', {
      school: '단원고',
      range_codes: rangeCodes,
      mode: 'eng2mean',
      target: QUESTIONS,
      run_mode: 'practice',
      exam_style: true
    }, token))
  ));
  const startMs = Math.round(performance.now() - startStarted);
  assert(views.length === STUDENTS && views.every(view => view.target === QUESTIONS && !view.finished), '20명 30문제 시험 동시 시작');

  const answerStarted = performance.now();
  for (let round = 0; round < QUESTIONS; round++) {
    const responses = await Promise.all(views.map((view, index) => {
      assert(view && !view.finished && view.question_id, `${round + 1}번째 라운드 질문 상태 유효`);
      const answer = Array.isArray(view.question?.options) && view.question.options.length ? view.question.options[0] : '__load_answer__';
      return coordinator.fast(nextState => service(nextState, 'POST', `/practice/${view.id}/answer`, {
        question_id: view.question_id,
        answer,
        prefetch_next: true
      }, tokens[index]));
    }));
    views = responses.map(response => response.prefetched_next || response);
  }
  const answerMs = Math.round(performance.now() - answerStarted);

  assert(views.every(view => view.finished === true && Number(view.score_total) === QUESTIONS), '20명 모두 30문제에서 정확히 완료');
  await coordinator.flush();

  const finalState = coordinator.current().state;
  const sessions = finalState.sessions.filter(item => String(item.student_id || '').startsWith('load-student-'));
  assert(sessions.length === STUDENTS, '20명 결과 세션 모두 저장');
  assert(sessions.every(item => Number(item.total) === QUESTIONS && Number(item.score_total || item.total) === QUESTIONS), '모든 결과가 30문제로 저장');
  assert(sessions.every(item => Array.isArray(item.answer_records) && item.answer_records.length === QUESTIONS), '모든 학생의 30개 답안 기록 저장');
  assert(finalState.profiles.filter(item => String(item.id).startsWith('load-student-')).length === STUDENTS, '20명 계정 유지');
  assert(finalState.tokens.filter(item => String(item.user_id).startsWith('load-student-')).length === STUDENTS, '20명 로그인 세션 유지');
  assert(finalState.practices.filter(item => String(item.student_id).startsWith('load-student-') && !item.finished).length === 0, '완료 후 진행 중 시험이 남지 않음');

  const totalMs = loginMs + startMs + answerMs;
  const answers = STUDENTS * QUESTIONS;
  const answersPerSecond = Math.round(answers / Math.max(0.001, answerMs / 1000));
  console.log(`[stress-check] PASS · students=${STUDENTS} questions=${QUESTIONS} answers=${answers} login=${loginMs}ms start=${startMs}ms answers=${answerMs}ms total=${totalMs}ms throughput≈${answersPerSecond}/s writes=${writes}`);
  await coordinator.close();
  return { ok: true, students: STUDENTS, questions: QUESTIONS, answers, loginMs, startMs, answerMs, totalMs, answersPerSecond, writes };
}

if (import.meta.url === new URL(process.argv[1], 'file:').href) {
  runStressCheck().catch(error => {
    console.error(error);
    process.exitCode = 1;
  });
}
