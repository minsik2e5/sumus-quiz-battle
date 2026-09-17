import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { emptyState } from './repository.mjs';
import { passwordHash } from './auth.mjs';
import { builtinBooks, service, sweep } from './service.mjs';
import { createMutationCoordinator } from './mutation-coordinator.mjs';
import { EXAM_TYPES, PRACTICE_TYPES, grade, displayEnglish } from '../public/modules/core.js';

const checks = [];
const assert = (condition, label) => {
  if (!condition) throw new Error(`[release-check] FAIL · ${label}`);
  checks.push(label);
};
const expectStatus = async (status, fn, label) => {
  try { await fn(); }
  catch (error) {
    assert(error?.status === status, label);
    return;
  }
  throw new Error(`[release-check] FAIL · ${label}`);
};
const answerFor = (type, word) => {
  if (['mean2eng_mc', 'mean2eng', 'write_en', 'spell', 'scramble', 'vowelblank', 'initial'].includes(type)) return displayEnglish(word.word);
  return word.meaning;
};

export async function runReleaseCheck() {
  const priorAuthProvider = process.env.AUTH_PROVIDER;
  delete process.env.AUTH_PROVIDER;
  try {
    const allWords = builtinBooks.flatMap(book => book.words || []);
    const bySchool = school => builtinBooks.filter(book => book.school === school).flatMap(book => book.words || []);
    assert(allWords.length === 1046, 'vocabulary total = 1046');
    assert(bySchool('단원고').length === 362, '단원고 vocabulary = 362');
    assert(bySchool('선부고').length === 330, '선부고 vocabulary = 330');
    const gangseoWords = bySchool('강서고');
    assert(gangseoWords.length === 354, '강서고 vocabulary = 354');
    const expectedGangseoRanges = { 21: 31, 23: 21, 29: 41, 30: 31, 31: 32, 32: 26, 33: 22, 34: 27, 36: 32, 37: 22, 38: 25, 39: 25, 40: 19 };
    assert(Object.entries(expectedGangseoRanges).every(([range, count]) => gangseoWords.filter(word => String(word.range_code) === range).length === count), '강서고 range counts match source');
    assert(new Set(allWords.map(word => word.id)).size === allWords.length, 'vocabulary ids are unique');
    assert(Object.keys(EXAM_TYPES).join(',') === 'eng2mean_mc,mean2eng_mc,write_en,write_meaning', 'exactly four exam types');
    const practiceTypes = ['write_meaning', 'eng2mean', 'mean2eng', 'spell', 'listen', 'scramble', 'vowelblank', 'initial'];
    assert(practiceTypes.every(type => PRACTICE_TYPES[type]), 'all eight practice types exist');

    assert(grade('write_en', 'PROSTHETIC', { word: '*prosthetic', meaning: '의족의' }), 'English writing ignores case and source marker');
    assert(grade('write_en', 'phenomena', { word: 'phenomenon(pl.phenomena)', meaning: '현상' }), 'plural annotation accepted');
    assert(grade('write_en', 'contribute to', { word: 'contribute to ~', meaning: '기여하다' }), 'source tilde ignored');
    assert(grade('write_meaning', '필요로 하다', { word: 'require', meaning: '요구하다, 필요로 하다' }), 'one listed Korean meaning accepted');

    const state = emptyState();
    state.profiles.push({
      id: 'qa-teacher', role: 'teacher', username: 'qa_teacher', password_hash: await passwordHash('QaTeacher123!'),
      display_name: 'QA 선생님', class_name: '고1A', school: '단원고', active: true, created_at: Date.now()
    });

    const teacherLogin = await service(state, 'POST', '/login', { username: 'qa_teacher', password: 'QaTeacher123!', role: 'teacher' }, null);
    const teacherToken = teacherLogin._cookie;
    assert(Boolean(teacherToken), 'teacher login succeeds');

    const student = await service(state, 'POST', '/students', {
      username: 'qa_student', password: 'QaStudent123!', display_name: 'QA 학생', class_name: '고1A', school: '단원고'
    }, teacherToken);
    assert(student.role === 'student' && student.class_name === '고1A', 'teacher can create student');

    const studentLogin = await service(state, 'POST', '/login', { username: 'qa_student', password: 'QaStudent123!', role: 'student' }, null);
    const studentToken = studentLogin._cookie;
    assert(Boolean(studentToken), 'student login succeeds');
    await expectStatus(403, () => service(state, 'POST', '/login', { username: 'qa_student', password: 'QaStudent123!', role: 'teacher' }, null), 'role mismatch is rejected');

    const danwonWords = bySchool('단원고');
    const rangeCode = String(danwonWords[0].range_code);
    const now = Date.now();
    await service(state, 'POST', '/assignments', {
      title: 'QA 연습 과제', class_name: '고1A', school: '단원고', range_codes: [rangeCode], target_questions: 10, due_at: now + 3600000
    }, teacherToken);
    assert(state.assignments.length === 1, 'teacher can create assignment');

    const examIds = [];
    for (const examType of Object.keys(EXAM_TYPES)) {
      const exam = await service(state, 'POST', '/exams', {
        title: `QA ${examType}`, class_name: '고1A', school: '단원고', range_codes: [rangeCode], exam_type: examType,
        question_count: 4, duration_sec: 300, passing_score: 70, max_attempts: 2,
        available_at: now - 1000, due_at: now + 3600000, release_result: true
      }, teacherToken);
      examIds.push(exam.id);
    }
    assert(state.exams.length === 4, 'teacher can create all four exam types');

    const allWordsExam = await service(state, 'POST', '/exams', {
      title: 'QA 중3 전체 단어', class_name: '중3', school: '단원고', range_codes: [rangeCode], exam_type: 'eng2mean_mc',
      question_count: 'all', duration_sec: 300, passing_score: 70, max_attempts: 1,
      available_at: now - 1000, due_at: now + 3600000, release_result: true
    }, teacherToken);
    const scopedRangeCount = danwonWords.filter(word => String(word.range_code) === rangeCode).length;
    assert(allWordsExam.class_name === '중3' && allWordsExam.question_count === scopedRangeCount, 'exam supports selectable class and all scoped words');

    const bootstrap = await service(state, 'GET', '/bootstrap', {}, studentToken);
    assert(bootstrap.exams.length === 4 && bootstrap.assignments.length === 1, 'student receives assigned exam and practice task');
    assert(bootstrap.books.length > 0 && bootstrap.books.every(book => book.school === '단원고'), 'student bootstrap only includes own-school vocabulary');

    for (const examId of examIds) {
      const exam = state.exams.find(item => item.id === examId);
      const started = await service(state, 'POST', '/exams/start', { exam_id: examId }, studentToken);
      assert(started.attempt.questions.length === 4, `${exam.exam_type} starts with requested question count`);
      assert(started.attempt.questions.every(question => question.type === exam.exam_type), `${exam.exam_type} never mixes question types`);
      const internal = state.examAttempts.find(item => item.id === started.attempt.id);
      const answers = Object.fromEntries(internal.keys.map((word, index) => [index, answerFor(exam.exam_type, word)]));
      const submitted = await service(state, 'POST', `/attempts/${internal.id}/submit`, {
        lease: internal.lease, revision: internal.revision, answers
      }, studentToken);
      assert(submitted.attempt.status === 'submitted' && submitted.attempt.score === 100, `${exam.exam_type} grades correct answers at 100`);
    }

    const leaseExam = await service(state, 'POST', '/exams', {
      title: 'QA reconnect', class_name: '고1A', school: '단원고', range_codes: [rangeCode], exam_type: 'eng2mean_mc',
      question_count: 2, duration_sec: 300, passing_score: 70, max_attempts: 1,
      available_at: now - 1000, due_at: now + 3600000, release_result: true
    }, teacherToken);
    const firstOpen = await service(state, 'POST', '/exams/start', { exam_id: leaseExam.id }, studentToken);
    const oldLease = firstOpen.attempt.lease;
    const secondOpen = await service(state, 'POST', '/exams/start', { exam_id: leaseExam.id }, studentToken);
    assert(oldLease !== secondOpen.attempt.lease, 'reconnect replaces active exam lease');
    await expectStatus(409, () => service(state, 'POST', `/attempts/${secondOpen.attempt.id}/draft`, {
      lease: oldLease, revision: secondOpen.attempt.revision, answers: { 0: '' }
    }, studentToken), 'stale tab/device lease is rejected');
    const leaseInternal = state.examAttempts.find(item => item.id === secondOpen.attempt.id);
    const leaseAnswers = Object.fromEntries(leaseInternal.keys.map((word, index) => [index, word.meaning]));
    await service(state, 'POST', `/attempts/${leaseInternal.id}/submit`, {
      lease: leaseInternal.lease, revision: leaseInternal.revision, answers: leaseAnswers
    }, studentToken);

    const autoExam = await service(state, 'POST', '/exams', {
      title: 'QA timeout', class_name: '고1A', school: '단원고', range_codes: [rangeCode], exam_type: 'write_en',
      question_count: 2, duration_sec: 5, passing_score: 70, max_attempts: 1,
      available_at: now - 1000, due_at: now + 3600000, release_result: true
    }, teacherToken);
    const autoStarted = await service(state, 'POST', '/exams/start', { exam_id: autoExam.id }, studentToken);
    const autoInternal = state.examAttempts.find(item => item.id === autoStarted.attempt.id);
    autoInternal.deadline = Date.now() - 1;
    sweep(state);
    assert(autoInternal.status === 'submitted' && autoInternal.auto_submitted === true, 'expired exam auto-submits');

    for (const practiceType of practiceTypes) {
      const started = await service(state, 'POST', '/practice/start', {
        school: '단원고', range_codes: [rangeCode], mode: practiceType, target: 5
      }, studentToken);
      assert(started.question.type === practiceType, `${practiceType} practice starts correctly`);
      const word = allWords.find(item => item.id === started.question.word_id);
      const result = await service(state, 'POST', `/practice/${started.id}/answer`, {
        question_id: started.question_id, answer: answerFor(practiceType, word), prefetch_next: true
      }, studentToken);
      assert(result.feedback?.ok === true, `${practiceType} accepts correct answer`);
      assert(result.prefetched_next?.question_id !== started.question_id, `${practiceType} prepares the next question in one request`);
      const repeated = await service(state, 'POST', `/practice/${started.id}/answer`, {
        question_id: started.question_id, answer: answerFor(practiceType, word)
      }, studentToken);
      assert(repeated.total === result.total, `${practiceType} duplicate submission is idempotent`);
      const finished = await service(state, 'POST', `/practice/${started.id}/finish`, {}, studentToken);
      assert(finished.finished === true, `${practiceType} practice can finish and save`);
    }
    assert(state.sessions.length === 8, 'all eight practice sessions are recorded');

    const wrongPractice = await service(state, 'POST', '/practice/start', {
      school: '단원고', range_codes: [rangeCode], mode: 'spell', target: 5
    }, studentToken);
    const wrongResult = await service(state, 'POST', `/practice/${wrongPractice.id}/answer`, {
      question_id: wrongPractice.question_id, answer: '__definitely_wrong__'
    }, studentToken);
    assert(wrongResult.feedback?.ok === false && wrongResult.retry_count === 1, 'wrong practice answer enters retry queue');
    await service(state, 'POST', `/practice/${wrongPractice.id}/finish`, {}, studentToken);

    const coverAll = await service(state, 'POST', '/practice/start', {
      school: '단원고', range_codes: [rangeCode], mode: 'write_meaning', cover_all: true
    }, studentToken);
    const coveredIds = new Set();
    let coverView = coverAll;
    for (let guard = 0; !coverView.finished && guard < coverAll.target + 20; guard++) {
      coveredIds.add(coverView.question.word_id);
      const word = allWords.find(item => item.id === coverView.question.word_id);
      coverView = await service(state, 'POST', `/practice/${coverAll.id}/answer`, {
        question_id: coverView.question_id, answer: word.meaning
      }, studentToken);
      coverView = await service(state, 'POST', `/practice/${coverAll.id}/next`, {}, studentToken);
    }
    assert(coverView.finished && coveredIds.size === coverAll.target, 'cover-all practice shows every scoped word once before finishing');

    const serialized = JSON.stringify(state);
    const restored = JSON.parse(serialized);
    assert(restored.profiles.length === state.profiles.length && restored.examAttempts.length === state.examAttempts.length, 'state survives JSON persistence round-trip');

    const publicRoot = fileURLToPath(new URL('../public/', import.meta.url));
    const manifest = JSON.parse(readFileSync(publicRoot + 'manifest.webmanifest', 'utf8'));
    const sw = readFileSync(publicRoot + 'sw.js', 'utf8');
    assert(manifest.display === 'standalone' && manifest.start_url === '/', 'PWA manifest is installable');
    assert(sw.includes("url.pathname.startsWith('/api/')"), 'service worker never caches API data');

    let storedCounter = 0;
    let storageRevision = 0;
    let storageWrites = 0;
    const delayedRepository = {
      async read() { return { state: { counter: storedCounter }, revision: storageRevision }; },
      async commit(nextState, revision) {
        await new Promise(resolve => setTimeout(resolve, 120));
        if (revision !== storageRevision) throw Object.assign(Error('revision conflict'), { status: 409 });
        storedCounter = nextState.counter;
        storageRevision += 1;
        storageWrites += 1;
      }
    };
    const coordinator = createMutationCoordinator(delayedRepository, {
      state: { counter: 0 }, revision: 0
    }, { flushDelay: 500 });
    const fastStartedAt = Date.now();
    const fastResults = await Promise.all(Array.from({ length: 200 }, () => coordinator.fast(nextState => {
      nextState.counter += 1;
      return nextState.counter;
    })));
    const fastElapsed = Date.now() - fastStartedAt;
    assert(fastResults.at(-1) === 200, 'concurrent practice mutations are applied in order');
    assert(fastElapsed < 200, 'practice response does not wait for remote persistence');
    await coordinator.flush();
    assert(storedCounter === 200 && storageWrites === 1, 'concurrent practice mutations persist in one checkpoint');
    const durableStartedAt = Date.now();
    await coordinator.durable(nextState => { nextState.counter += 1; return nextState.counter; });
    assert(Date.now() - durableStartedAt >= 100 && storedCounter === 201, 'durable mutations wait for persistence');
    await coordinator.close();

    console.log(`[release-check] PASS ${checks.length}/${checks.length}`);
    return { ok: true, count: checks.length };
  } finally {
    if (priorAuthProvider === undefined) delete process.env.AUTH_PROVIDER;
    else process.env.AUTH_PROVIDER = priorAuthProvider;
  }
}
