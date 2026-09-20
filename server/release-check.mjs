import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { emptyState } from './repository.mjs';
import { passwordHash } from './auth.mjs';
import { allBooks, service, sweep } from './service.mjs';
import { createMutationCoordinator } from './mutation-coordinator.mjs';
import { EXAM_TYPES, PRACTICE_TYPES, grade, displayEnglish } from '../public/modules/core.js';
import { runContentValidation } from './content-validation.mjs';
import { openGrammarChoiceSample } from '../public/grammar-choice-sample.js';

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
    runContentValidation();
    checks.push('school content validation passes');
    assert(typeof openGrammarChoiceSample === 'function', 'grammar learning module parses as a browser module');
    const runtimeBooks = allBooks({ extraBooks: [] });
    const allWords = runtimeBooks.flatMap(book => book.words || []);
    const bySchool = school => runtimeBooks.filter(book => book.school === school).flatMap(book => book.words || []);
    assert(bySchool('단원고').length === 362, '단원고 vocabulary = 362');
    const gangseoWords = bySchool('강서고');
    assert(gangseoWords.length === 354, '강서고 vocabulary = 354');
    assert(bySchool('선부고').filter(word => String(word.range_code) === '44').length === 49, '선부고 외부 44 vocabulary = 49');
    assert(new Set(allWords.map(word => word.id)).size === allWords.length, 'vocabulary ids are unique');
    assert(Object.keys(EXAM_TYPES).join(',') === 'eng2mean_mc,mean2eng_mc,write_en,write_meaning', 'exactly four exam types');
    const practiceTypes = ['write_meaning', 'eng2mean', 'mean2eng', 'spell', 'listen', 'scramble', 'vowelblank', 'initial'];
    assert(practiceTypes.every(type => PRACTICE_TYPES[type]), 'all eight practice types exist');

    assert(grade('write_en', 'PROSTHETIC', { word: '*prosthetic', meaning: '의족의' }), 'English writing ignores case and source marker');
    assert(grade('write_en', 'phenomena', { word: 'phenomenon(pl.phenomena)', meaning: '현상' }), 'plural annotation accepted');
    assert(grade('write_en', 'contribute to', { word: 'contribute to ~', meaning: '기여하다' }), 'source tilde ignored');
    assert(grade('write_meaning', '필요로 하다', { word: 'require', meaning: '요구하다, 필요로 하다' }), 'one listed Korean meaning accepted');
    assert(grade('write_meaning', '감소', { word: 'decline', meaning: '감소하다' }), 'safe Korean noun/verb variation accepted');
    assert(grade('write_meaning', '인식하다', { word: 'recognize', meaning: '알아보다', accepted_meanings: ['인식하다'] }), 'teacher-approved Korean meaning alias accepted');

    const state = emptyState();
    state.profiles.push({
      id: 'qa-teacher', role: 'teacher', username: 'qa_teacher', password_hash: await passwordHash('QaTeacher123!'),
      display_name: 'QA 선생님', class_name: '고1A', school: '단원고', active: true, created_at: Date.now()
    });

    const teacherLogin = await service(state, 'POST', '/login', { username: 'qa_teacher', password: 'QaTeacher123!', role: 'teacher', division: 'high' }, null);
    const teacherToken = teacherLogin._cookie;
    assert(Boolean(teacherToken), 'teacher login succeeds');
    let teacherBootstrap = await service(state, 'GET', '/bootstrap', {}, teacherToken);
    assert(teacherBootstrap.profile.active_division === 'high' && teacherBootstrap.schools.every(school => school.division === 'high'), 'teacher starts in isolated high-school division');

    await service(state, 'PATCH', '/teacher/division', { division: 'middle' }, teacherToken);
    const middleTeacherBootstrap = await service(state, 'GET', '/bootstrap', {}, teacherToken);
    assert(middleTeacherBootstrap.profile.active_division === 'middle' && middleTeacherBootstrap.profile.active_school_id === 'wonil-middle', 'teacher can switch to middle-school division');
    assert(middleTeacherBootstrap.schools.length === 1 && middleTeacherBootstrap.schools[0].id === 'wonil-middle', 'middle division exposes only middle schools');
    const middleStudent = await service(state, 'POST', '/students', {
      username: 'qa_middle', password: 'QaMiddle123!', display_name: 'QA 중3학생', class_name: '중3', school_id: 'wonil-middle'
    }, teacherToken);
    const middleStudent2 = await service(state, 'POST', '/students', {
      username: 'qa_middle2', password: 'QaMiddle223!', display_name: 'QA 중2학생', class_name: '중2', school_id: 'wonil-middle'
    }, teacherToken);
    assert(middleStudent.division === 'middle' && middleStudent.class_name === '중3' && middleStudent2.class_name === '중2', 'teacher can create middle-school students by grade');
    const middleLogin = await service(state, 'POST', '/login', { username: 'qa_middle', password: 'QaMiddle123!', role: 'student', division: 'middle' }, null);
    assert(Boolean(middleLogin._cookie), 'middle student logs into middle division');
    await expectStatus(403, () => service(state, 'POST', '/login', { username: 'qa_middle', password: 'QaMiddle123!', role: 'student', division: 'high' }, null), 'middle account is rejected by high-school login');
    await service(state, 'PATCH', '/teacher/division', { division: 'high' }, teacherToken);
    teacherBootstrap = await service(state, 'GET', '/bootstrap', {}, teacherToken);
    assert(teacherBootstrap.profile.active_division === 'high' && teacherBootstrap.profile.active_school_id === 'danwon-high', 'teacher returns to high-school division');

    const student = await service(state, 'POST', '/students', {
      username: 'qa_student', password: 'QaStudent123!', display_name: 'QA 학생', class_name: '고1A', school: '단원고'
    }, teacherToken);
    assert(student.role === 'student' && student.class_name === '고1A', 'teacher can create student');

    const studentLogin = await service(state, 'POST', '/login', { username: 'qa_student', password: 'QaStudent123!', role: 'student', division: 'high' }, null);
    const studentToken = studentLogin._cookie;
    assert(Boolean(studentToken), 'student login succeeds');
    await expectStatus(403, () => service(state, 'POST', '/login', { username: 'qa_student', password: 'QaStudent123!', role: 'student', division: 'middle' }, null), 'high-school account is rejected by middle login');
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
    const editableExam = state.exams.find(item => item.id === examIds[0]);
    const editedExam = await service(state, 'PATCH', '/exams/' + editableExam.id, {
      title: 'QA edited exam', class_name: '고1A', range_codes: [rangeCode], exam_type: editableExam.exam_type,
      question_count: 4, duration_sec: 360, passing_score: 75, max_attempts: 2,
      available_at: now - 500, due_at: now + 7200000, release_result: false, active: true
    }, teacherToken);
    assert(editedExam.title === 'QA edited exam' && editedExam.duration_sec === 360, 'unattempted exam can be fully edited');

    const allWordsExam = await service(state, 'POST', '/exams', {
      title: 'QA 전체 단어', class_name: '고1A', school: '단원고', range_codes: [rangeCode], exam_type: 'eng2mean_mc',
      question_count: 'all', duration_sec: 300, passing_score: 70, max_attempts: 1,
      available_at: now - 1000, due_at: now + 3600000, release_result: true
    }, teacherToken);
    const scopedRangeCount = danwonWords.filter(word => String(word.range_code) === rangeCode).length;
    assert(allWordsExam.class_name === '고1A' && allWordsExam.question_count === scopedRangeCount, 'exam supports selectable class and all scoped words');

    const bootstrap = await service(state, 'GET', '/bootstrap', {}, studentToken);
    assert(bootstrap.exams.length === 4 && bootstrap.assignments.length === 1, 'student receives assigned exam and practice task');
    assert(bootstrap.books.length > 0 && bootstrap.books.every(book => book.school === '단원고'), 'student bootstrap only includes own-school vocabulary');
    assert(bootstrap.schools.length === 1 && bootstrap.schools[0].id === 'danwon-high', 'student bootstrap exposes only assigned school');
    assert(bootstrap.profile.division === 'high' && bootstrap.divisions.length === 1 && bootstrap.divisions[0] === 'high', 'student bootstrap is locked to assigned division');
    assert(bootstrap.ranking.some(item => item.grade === '중2') && bootstrap.ranking.some(item => item.grade === '중3') && bootstrap.ranking.some(item => item.grade === '고1'), 'student ranking includes middle2 middle3 and high1 across division boundaries');
    await expectStatus(403, () => service(state, 'PATCH', '/profile/school', { school_id: 'seonbu-high' }, studentToken), 'student cannot change own school');

    const aliasWord = danwonWords[0];
    const aliasResult = await service(state, 'POST', '/meaning-aliases/' + encodeURIComponent(aliasWord.id), { alias: '교사용 허용 뜻' }, teacherToken);
    assert(aliasResult.aliases.includes('교사용 허용 뜻'), 'teacher can add accepted meaning alias');
    const aliasBootstrap = await service(state, 'GET', '/bootstrap', {}, teacherToken);
    assert(aliasBootstrap.meaning_aliases[aliasWord.id]?.includes('교사용 허용 뜻'), 'teacher bootstrap exposes accepted meaning aliases');

    const grammarProgress = await service(state, 'PATCH', '/grammar-progress/qa-passage-21', {
      sentence_count: 6, choice_count: 16, completed_sentences: 2, active_sentence_index: 2,
      graded_sentences: [0, 1], answers: { '0:1': 'is', '1:2': 'them' }, wrong_keys: ['1:2'],
      first_wrong: 1, first_rate: null, recall_attempts: 0, mastered: false
    }, studentToken);
    assert(grammarProgress.completed_sentences === 2 && state.grammarProgress[student.id]['qa-passage-21'], 'grammar progress persists on server');
    const grammarBootstrap = await service(state, 'GET', '/bootstrap', {}, studentToken);
    assert(grammarBootstrap.grammar_progress['qa-passage-21']?.active_sentence_index === 2, 'student bootstrap restores grammar progress');

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
    await expectStatus(409, () => service(state, 'PATCH', '/exams/' + examIds[0], {
      question_count: 2
    }, teacherToken), 'attempted exam blocks structural edits');
    const clonedExam = await service(state, 'POST', '/exams/' + examIds[0] + '/clone', {}, teacherToken);
    assert(clonedExam.id !== examIds[0] && clonedExam.active === false && clonedExam.title.includes('수정본'), 'attempted exam can be cloned as editable revision');

    const disputeExam = await service(state, 'POST', '/exams', {
      title: 'QA meaning dispute', class_name: '고1A', school: '단원고', range_codes: [rangeCode], exam_type: 'write_meaning',
      question_count: 2, duration_sec: 300, passing_score: 70, max_attempts: 1,
      available_at: now - 1000, due_at: now + 3600000, release_result: true
    }, teacherToken);
    const disputeExamStarted = await service(state, 'POST', '/exams/start', { exam_id: disputeExam.id }, studentToken);
    const disputeAttempt = state.examAttempts.find(item => item.id === disputeExamStarted.attempt.id);
    const disputeExamAnswers = {
      0: '이번만인정표현',
      1: disputeAttempt.keys[1].meaning
    };
    const disputeExamSubmitted = await service(state, 'POST', '/attempts/' + disputeAttempt.id + '/submit', {
      lease: disputeAttempt.lease, revision: disputeAttempt.revision, answers: disputeExamAnswers
    }, studentToken);
    assert(disputeExamSubmitted.attempt.score === 50, 'wrong meaning-writing exam answer is initially graded wrong');
    const examDispute = await service(state, 'POST', '/meaning-disputes', {
      source_type: 'exam', source_id: disputeAttempt.id, question_index: 0
    }, studentToken);
    assert(examDispute.status === 'pending' && examDispute.answer === '이번만인정표현', 'student can dispute only a wrong meaning-writing exam answer');
    const onceResolution = await service(state, 'PATCH', '/meaning-disputes/' + examDispute.id + '/resolve', { action: 'approve_once' }, teacherToken);
    const regradedAttempt = state.examAttempts.find(item => item.id === disputeAttempt.id);
    assert(onceResolution.regraded === 1 && regradedAttempt.score === 100, 'approve-once automatically regrades the student exam score');
    assert(!(state.meaningAliases[disputeAttempt.keys[0].id] || []).includes('이번만인정표현'), 'approve-once does not change the global accepted-meaning DB');

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

    const meaningPractice = await service(state, 'POST', '/practice/start', {
      school: '단원고', range_codes: [rangeCode], mode: 'write_meaning', target: 5
    }, studentToken);
    const disputedPracticeWord = allWords.find(item => item.id === meaningPractice.question.word_id);
    const meaningQuestionId = meaningPractice.question_id;
    const meaningWrong = await service(state, 'POST', `/practice/${meaningPractice.id}/answer`, {
      question_id: meaningQuestionId, answer: '새로운허용뜻'
    }, studentToken);
    assert(meaningWrong.feedback?.ok === false && meaningWrong.feedback?.can_dispute === true, 'only wrong meaning-writing practice answers expose dispute eligibility');
    await service(state, 'POST', `/practice/${meaningPractice.id}/finish`, {}, studentToken);
    const practiceDispute = await service(state, 'POST', '/meaning-disputes', {
      source_type: 'practice', source_id: meaningPractice.id, question_id: meaningQuestionId
    }, studentToken);
    assert(practiceDispute.status === 'pending' && practiceDispute.word_id === disputedPracticeWord.id, 'student can submit a meaning-writing practice dispute');
    const pendingBootstrap = await service(state, 'GET', '/bootstrap', {}, teacherToken);
    assert(pendingBootstrap.meaning_disputes.some(item => item.id === practiceDispute.id && item.status === 'pending'), 'teacher sees pending meaning disputes in current school');
    const globalResolution = await service(state, 'PATCH', '/meaning-disputes/' + practiceDispute.id + '/resolve', { action: 'approve_global' }, teacherToken);
    const regradedSession = state.sessions.find(item => item.id === meaningPractice.id);
    assert(globalResolution.regraded === 1 && globalResolution.aliases.includes('새로운허용뜻'), 'global approval saves the alternate meaning and regrades matching disputes');
    assert(regradedSession?.correct === 1, 'approved practice dispute automatically corrects the saved practice result');
    assert((state.meaningAliases[disputedPracticeWord.id] || []).includes('새로운허용뜻'), 'approved alternate meaning persists separately from source vocabulary');

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
    const masteryBootstrap = await service(state, 'GET', '/bootstrap', {}, studentToken);
    assert(masteryBootstrap.word_mastery?.ranges?.[rangeCode]?.attempted === scopedRangeCount, 'word mastery tracks full-range coverage');
    assert(['master','perfect','conquering','needs_work'].includes(masteryBootstrap.word_mastery.ranges[rangeCode].status), 'word mastery returns a quest status');

    const movedStudent = await service(state, 'PATCH', `/students/${student.id}`, {
      school_id: 'gangseo-high', class_name: '고1B', active: true
    }, teacherToken);
    assert(movedStudent.school_id === 'gangseo-high' && movedStudent.school === '강서고' && movedStudent.class_name === '고1B' && movedStudent.division === 'high', 'teacher can change student school and class');
    const danwonAfterMove = await service(state, 'GET', '/bootstrap', {}, teacherToken);
    assert(!danwonAfterMove.profiles.some(profile => profile.id === student.id), 'moved student leaves the previous school roster');
    await service(state, 'PATCH', '/teacher/school', { school_id: 'gangseo-high' }, teacherToken);
    const gangseoAfterMove = await service(state, 'GET', '/bootstrap', {}, teacherToken);
    assert(gangseoAfterMove.profiles.some(profile => profile.id === student.id), 'moved student appears in the new school roster');
    assert(gangseoAfterMove.sessions.every(session => session.school_id === 'gangseo-high'), 'historical sessions from other schools never leak into active school view');
    assert(state.sessions.some(session => session.student_id === student.id && session.school_id === 'danwon-high'), 'historical school records remain preserved after school move');

    await service(state, 'PATCH', `/students/${student.id}`, { password: '12345678' }, teacherToken);
    const resetLogin = await service(state, 'POST', '/login', { username: 'qa_student', password: '12345678', role: 'student', division: 'high' }, null);
    assert(Boolean(resetLogin._cookie), 'teacher can reset a student password to the default');
    await service(state, 'PATCH', '/profile/password', { current_password: 'QaTeacher123!', new_password: 'QaTeacher456!' }, teacherToken);
    const changedTeacherLogin = await service(state, 'POST', '/login', { username: 'qa_teacher', password: 'QaTeacher456!', role: 'teacher', division: 'high' }, null);
    assert(Boolean(changedTeacherLogin._cookie), 'teacher can change own password');

    await service(state, 'DELETE', `/students/${student.id}`, {}, teacherToken);
    assert(!state.profiles.some(profile => profile.id === student.id), 'teacher can delete a student account');
    assert(!state.sessions.some(session => session.student_id === student.id), 'student deletion removes practice history');
    assert(!state.examAttempts.some(attempt => attempt.student_id === student.id), 'student deletion removes exam history');
    assert(!state.grammarProgress[student.id], 'student deletion removes grammar progress');
    await service(state, 'PATCH', '/teacher/division', { division: 'middle' }, teacherToken);
    await service(state, 'DELETE', '/students/' + middleStudent.id, {}, teacherToken);
    await service(state, 'DELETE', '/students/' + middleStudent2.id, {}, teacherToken);
    assert(!state.profiles.some(profile => profile.id === middleStudent.id || profile.id === middleStudent2.id), 'middle-school QA students can be cleaned up inside middle division');

    const serialized = JSON.stringify(state);
    const restored = JSON.parse(serialized);
    assert(restored.profiles.length === state.profiles.length && restored.examAttempts.length === state.examAttempts.length, 'state survives JSON persistence round-trip');

    const publicRoot = fileURLToPath(new URL('../public/', import.meta.url));
    const manifest = JSON.parse(readFileSync(publicRoot + 'manifest.webmanifest', 'utf8'));
    const sw = readFileSync(publicRoot + 'sw.js', 'utf8');
    const teacherEnhancements = readFileSync(publicRoot + 'teacher-enhancements.js', 'utf8');
    const teacherModule = readFileSync(publicRoot + 'modules/teacher.js', 'utf8');
    const indexHtml = readFileSync(publicRoot + 'index.html', 'utf8');
    const dashboardCss = readFileSync(publicRoot + 'teacher-dashboard-v136.css', 'utf8');
    const v137Css = readFileSync(publicRoot + 'v137.css', 'utf8');
    const v138Css = readFileSync(publicRoot + 'v138.css', 'utf8');
    const v139Css = readFileSync(publicRoot + 'v139.css', 'utf8');
    const v1310Css = readFileSync(publicRoot + 'v1310.css', 'utf8');
    const studentModule = readFileSync(publicRoot + 'modules/student.js', 'utf8');
    const sessionsModule = readFileSync(publicRoot + 'modules/sessions.js', 'utf8');
    const appJs = readFileSync(publicRoot + 'app.js', 'utf8');
    assert(manifest.display === 'standalone' && manifest.start_url === '/', 'PWA manifest is installable');
    assert(teacherModule.includes('TODAY CONTROL') && teacherModule.includes('오늘 확인 필요') && teacherModule.includes('많이 틀린 어법 포인트'), 'V13.6 teacher operations dashboard is present');
    assert(teacherModule.includes('grammar_progress') && teacherModule.includes('시험 미제출'), 'teacher dashboard reads grammar and exam attention data');
    assert(indexHtml.includes('teacher-dashboard-v136.css') && !indexHtml.includes('teacher-dashboard.js'), 'dashboard stylesheet is loaded and stale missing module is removed');
    assert(dashboardCss.includes('.v136-dashboard-grid') && dashboardCss.includes('@media(max-width:760px)'), 'teacher dashboard has responsive styles');
    assert(indexHtml.includes('v137.css') && v137Css.includes('.exam-ops-table') && v137Css.includes('.word-conquest-card'), 'V13.7 teacher proportions and word quest styles are loaded');
    assert(teacherModule.includes('data-exam-edit') && teacherModule.includes('data-exam-status') && teacherModule.includes('data-exam-menu'), 'teacher exam list exposes edit status and operations');
    assert(teacherModule.includes('data-meaning-alias') && appJs.includes('meaningAliasModal'), 'teacher can manage accepted meaning aliases');
    assert(studentModule.includes('깨야 할 퀘스트') && studentModule.includes('WORD MASTER') && studentModule.includes('PERFECT MASTER'), 'student word mastery quest labels are present');
    assert(!appJs.includes("id=\"account-school\"") && studentModule.includes('선생님 관리'), 'student self-service school change is removed');
    assert(indexHtml.includes('v138.css') && v138Css.includes('.division-segment') && v138Css.includes('.dispute-card'), 'V13.8 division and dispute styles are loaded');
    assert(appJs.includes('data-division="middle"') && appJs.includes('/teacher/division'), 'login and teacher controls separate middle and high divisions');
    assert(teacherModule.includes('뜻 이의제기') && teacherModule.includes('data-dispute-global') && teacherModule.includes('data-dispute-once'), 'teacher meaning-dispute inbox is present');
    assert(sessionsModule.includes('이 답도 맞는 것 같아요') && sessionsModule.includes('/meaning-disputes'), 'meaning-writing student dispute buttons are present');
    assert(indexHtml.includes('v139.css') && v139Css.includes('.rank-scope') && v139Css.includes('.my-rank-card'), 'V13.9 academy ranking styles are loaded');
    assert(studentModule.includes("['all','전체']") && studentModule.includes("['중2','중2']") && studentModule.includes("['중3','중3']") && studentModule.includes("['고1','고1']"), 'student ranking exposes overall middle2 middle3 and high1 filters');
    assert(appJs.includes('d.rankScope') && studentModule.includes('SUMUS 랭킹'), 'V13.9 ranking interactions remain active');
    assert(indexHtml.includes('v1310.css') && v1310Css.includes('.today-word-quest') && v1310Css.includes('.today-word-start'), 'V13.10 simplified home styles are loaded');
    assert(studentModule.includes('오늘의 단어 퀘스트') && studentModule.includes('data-quick-practice') && !studentModule.includes('<h2>오늘의 한 걸음</h2>'), 'V13.10 merges duplicate vocabulary home cards');
    assert(appJs.includes('d.quickPractice') && appJs.includes("A.mode = 'write_meaning'") && appJs.includes('A.target = 20'), 'V13.10 home starts a 20-question meaning-writing quest directly');
    assert(indexHtml.includes('/app.js?v=13.10.0') && sw.includes('sumus-voca-v13.10.0-simplified-home'), 'V13.10 cache versions are active');
    assert(sw.includes("url.pathname.startsWith('/api/')"), 'service worker never caches API data');
    assert(teacherEnhancements.includes('name="school_id"') && teacherEnhancements.includes('school_id: values.school_id'), 'teacher student modal submits school changes');
    assert(teacherEnhancements.includes('student-reset-password') && teacherEnhancements.includes('12345678'), 'teacher can reset student password from the modal');
    assert(teacherEnhancements.includes('student-delete-account') && teacherEnhancements.includes("'DELETE'"), 'teacher can delete a student account from the modal');

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
