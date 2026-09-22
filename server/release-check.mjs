import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { emptyState } from './repository.mjs';
import { passwordHash } from './auth.mjs';
import { allBooks, service, sweep } from './service.mjs';
import { createMutationCoordinator } from './mutation-coordinator.mjs';
import { EXAM_TYPES, PRACTICE_TYPES, PRACTICE_SECONDS_PER_QUESTION, grade, displayEnglish, meaningAccepted } from '../public/modules/core.js';
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
  if (type === 'write_meaning') return meaningAccepted(word.meaning, word.accepted_meanings)[0] || word.meaning;
  return word.meaning;
};

export async function runReleaseCheck() {
  const priorAuthProvider = process.env.AUTH_PROVIDER;
  delete process.env.AUTH_PROVIDER;
  try {
    runContentValidation();
    checks.push('school content validation passes');
    const sessionUiSource = readFileSync(fileURLToPath(new URL('../public/modules/sessions.js', import.meta.url)), 'utf8');
    const studentUiSource = readFileSync(fileURLToPath(new URL('../public/modules/student.js', import.meta.url)), 'utf8');
    const indexSource = readFileSync(fileURLToPath(new URL('../public/index.html', import.meta.url)), 'utf8');
    assert(sessionUiSource.includes(String.fromCharCode(36, 36) + "('[data-practice-choice],#practice-confirm').forEach"), 'practice answer controls disable through the multi-node selector');
    assert(sessionUiSource.includes('practiceAdvanceTimer = setTimeout'), 'practice correct-answer auto advance is wired');
    assert(studentUiSource.includes('data-memorize-range='), 'vocabulary range numbers are interactive');
    assert(indexSource.includes('/v1325.css?v=13.27.0') && indexSource.includes('/v1326.css?v=13.27.0'), 'V13.27 learning style layers are connected');
    assert(typeof openGrammarChoiceSample === 'function', 'grammar learning module parses as a browser module');
    const runtimeBooks = allBooks({ extraBooks: [] });
    const allWords = runtimeBooks.flatMap(book => book.words || []);
    const bySchool = school => runtimeBooks.filter(book => book.school === school).flatMap(book => book.words || []);
    assert(bySchool('단원고').length === 362, '단원고 vocabulary = 362');
    const gangseoWords = bySchool('강서고');
    assert(gangseoWords.length === 354, '강서고 vocabulary = 354');
    assert(bySchool('선부고').filter(word => String(word.range_code) === '44').length === 49, '선부고 외부 44 vocabulary = 49');
    assert(new Set(allWords.map(word => word.id)).size === allWords.length, 'vocabulary ids are unique');
    assert(Object.keys(EXAM_TYPES).join(',') === 'write_meaning,write_en,eng2mean_mc,mean2eng_mc', 'exactly four exam types with writing modes first');
    const practiceTypes = ['write_meaning', 'eng2mean', 'mean2eng', 'spell', 'listen', 'scramble', 'vowelblank', 'initial'];
    assert(practiceTypes.every(type => PRACTICE_TYPES[type]), 'all eight practice types exist');

    assert(grade('write_en', 'PROSTHETIC', { word: '*prosthetic', meaning: '의족의' }), 'English writing ignores case and source marker');
    assert(grade('write_en', 'phenomena', { word: 'phenomenon(pl.phenomena)', meaning: '현상' }), 'plural annotation accepted');
    assert(grade('write_en', 'contribute to', { word: 'contribute to ~', meaning: '기여하다' }), 'source tilde ignored');
    assert(grade('write_meaning', '필요로 하다', { word: 'require', meaning: '요구하다, 필요로 하다' }), 'one listed Korean meaning accepted');
    assert(!grade('write_meaning', '감소', { word: 'decline', meaning: '감소하다' }), 'noun/verb part-of-speech change is rejected');
    assert(grade('write_meaning', '인식하다', { word: 'recognize', meaning: '알아보다', accepted_meanings: ['인식하다'] }), 'teacher-approved Korean meaning alias accepted');
    assert(grade('write_meaning', '만족하는', { word: 'satisfied', meaning: '만족한' }), 'Korean adjective form 만족한/만족하는 accepted');
    assert(grade('write_meaning', '만족하다', { word: 'satisfied', meaning: '만족한' }), 'Korean adjective dictionary form accepted');
    assert(!grade('write_meaning', '만족한 것', { word: 'satisfied', meaning: '만족한' }), 'nominalized 것-form is rejected under strict part-of-speech grading');
    assert(grade('write_meaning', '필요하다', { word: 'necessary', meaning: '필요한' }), 'Korean 하다 adjective form accepted');
    assert(grade('write_meaning', '형성되다', { word: 'formed', meaning: '형성된' }), 'Korean 되다 predicate form accepted');
    assert(grade('write_meaning', '효과적이다', { word: 'effective', meaning: '효과적인' }), 'Korean 적이다 adjective form accepted');
    assert(grade('write_meaning', '인식하다', { word: 'recognize', meaning: '알아보다' }), 'conservative built-in synonym accepted');
    assert(grade('write_meaning', '줄어들다', { word: 'decline', meaning: '감소하다' }), 'conservative decrease synonym accepted');
    assert(!grade('write_meaning', '즐거운', { word: 'satisfied', meaning: '만족한' }), 'different Korean meaning is rejected');
    assert(!grade('write_meaning', '가능한', { word: 'necessary', meaning: '필요한' }), 'related but different Korean adjective is rejected');
    assert(!grade('write_meaning', '만족', { word: 'satisfied', meaning: '만족한' }), 'adjective-to-noun shortening is rejected');
    assert(!grade('write_meaning', '감소하다', { word: 'decrease', meaning: '감소' }), 'noun-to-verb expansion is rejected');
    assert(!grade('write_meaning', '형성', { word: 'formed', meaning: '형성된' }), 'verb-participle-to-noun shortening is rejected');
    assert(!grade('write_meaning', '효과적', { word: 'effective', meaning: '효과적인' }), 'adjective-to-bare nominal form is rejected');
    assert(grade('write_meaning', '감소', { word: 'decline', meaning: '감소하다', accepted_meanings: ['감소'] }), 'teacher-approved cross-part-of-speech exception remains valid');

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

    const middle2Rows = Array.from({ length: 8 }, (_, index) => ({ range_code: index < 4 ? 'DAY1' : 'DAY2', word: 'm2word' + index, meaning: '중2뜻' + index }));
    const middle3Rows = Array.from({ length: 8 }, (_, index) => ({ range_code: index < 4 ? 'DAY1' : 'DAY2', word: 'm3word' + index, meaning: '중3뜻' + index }));
    const importPreview = await service(state, 'POST', '/vocab-import/preview', {
      grade: '중2',
      rows: [...middle2Rows, { ...middle2Rows[0] }, { range_code: '', word: 'invalid', meaning: '누락' }]
    }, teacherToken);
    assert(importPreview.valid === 8 && importPreview.skipped === 2 && importPreview.ranges.length === 2, 'middle vocab import preview validates rows and duplicates');
    const middle2Import = await service(state, 'POST', '/vocab-import/commit', { grade: '중2', rows: middle2Rows }, teacherToken);
    const middle3Import = await service(state, 'POST', '/vocab-import/commit', { grade: '중3', rows: middle3Rows }, teacherToken);
    assert(middle2Import.count === 8 && middle3Import.count === 8 && state.extraBooks.filter(book => book.school_id === 'wonil-middle').length === 2, 'teacher can register separate middle2 and middle3 vocabulary');
    const middle2Login = await service(state, 'POST', '/login', { username: 'qa_middle2', password: 'QaMiddle223!', role: 'student', division: 'middle' }, null);
    const middle3Bootstrap = await service(state, 'GET', '/bootstrap', {}, middleLogin._cookie);
    const middle2Bootstrap = await service(state, 'GET', '/bootstrap', {}, middle2Login._cookie);
    const middle3StaticBooks = middle3Bootstrap.books.filter(book => book.source === 'teacher_source_pages_1_2');
    const middle3ImportedBook = middle3Bootstrap.books.find(book => book.source === 'teacher_import');
    assert(middle3StaticBooks.length === 3 && middle3StaticBooks.every(book => book.grade === '중3' && book.words.every(word => word.grade === '중3')), 'middle3 student receives the built-in lesson 5 6 7 vocabulary only for middle3');
    const lesson5Book = middle3StaticBooks.find(book => book.id.endsWith('lesson5'));
    const lesson6Book = middle3StaticBooks.find(book => book.id.endsWith('lesson6'));
    const lesson7Book = middle3StaticBooks.find(book => book.id.endsWith('lesson7'));
    assert(lesson5Book?.words.length === 64 && lesson6Book?.words.length === 67 && lesson7Book?.words.length === 81, 'middle3 source lesson counts are 64 67 and 81');
    assert(lesson5Book.words[0].word === 'once' && lesson5Book.words.at(-1).word === 'put up', 'middle3 lesson5 preserves source order');
    assert(lesson6Book.words[0].word === 'elect' && lesson6Book.words.at(-1).word === 'come back', 'middle3 lesson6 preserves source order');
    assert(lesson7Book.words[0].word === 'add' && lesson7Book.words.at(-1).word === 'play a role', 'middle3 lesson7 preserves source order across pages 1 and 2');
    assert(middle3ImportedBook?.words.length === 8 && middle3ImportedBook.words.every(word => word.grade === '중3'), 'middle3 teacher import remains separate from built-in lessons');
    const middle2Lesson5 = middle2Bootstrap.books.find(book => book.id === 'middle:ybm-park:grade2:lesson5');
    const middle2Lesson6 = middle2Bootstrap.books.find(book => book.id === 'middle:ybm-park:grade2:lesson6');
    const middle2ImportedBook = middle2Bootstrap.books.find(book => book.source === 'teacher_import');
    assert(middle2Lesson5?.words.length === 69 && middle2Lesson6?.words.length === 66, 'middle2 YBM Park lesson5 and lesson6 source counts are 69 and 66');
    assert(middle2Lesson5.words[0].word === 'be interested in ~' && middle2Lesson5.words.at(-1).word === 'explore', 'middle2 YBM lesson5 preserves source order');
    assert(middle2Lesson6.words[0].word === 'throw' && middle2Lesson6.words.at(-1).word === 'take time', 'middle2 YBM lesson6 preserves source order');
    assert(middle2ImportedBook?.words.length === 8 && middle2ImportedBook.words.every(word => word.grade === '중2'), 'middle2 teacher import remains separate from built-in lessons');
    assert(middle2ImportedBook.words[0].id.startsWith('import:wonil-middle:중2:'), 'middle import uses deterministic grade-scoped word ids');
    const binWord = middle2Lesson6.words.find(word => word.word === 'bin');
    const careWord = middle2Lesson5.words.find(word => word.word === 'take care of ~');
    assert(grade('write_meaning', '휴지통', binWord), 'middle2 built-in accepted meaning allows safe synonym 휴지통');
    assert(grade('write_meaning', '돌보다', careWord), 'middle2 lesson5 accepted meaning allows safe synonym 돌보다');
    assert(middle3Bootstrap.daily_quest === null && middle2Bootstrap.daily_quest === null, 'middle students do not receive the high-school adaptive daily quest');

    const middle3Words = lesson5Book.words;
    const pickedMiddle3Ids = [middle3Words[4].id, middle3Words[0].id, middle3Words[2].id];
    const middleManualPractice = await service(state, 'POST', '/practice/start', {
      mode: 'write_meaning', word_ids: pickedMiddle3Ids, cover_all: true
    }, middleLogin._cookie);
    const middleManualInternal = state.practices.find(item => item.id === middleManualPractice.id);
    assert(middleManualPractice.manual_selection === true && middleManualPractice.target === 3, 'middle student can start a test with any personally checked word count');
    assert(JSON.stringify(middleManualInternal.words) === JSON.stringify([middle3Words[0].id, middle3Words[2].id, middle3Words[4].id]), 'checked middle words are normalized back to source lesson order');
    assert(middleManualPractice.question.word_id === middle3Words[0].id, 'middle manual test begins with the first checked word in lesson order');
    let middleManualView = middleManualPractice;
    const middleSeen = [];
    while (!middleManualView.finished && middleSeen.length < 8) {
      middleSeen.push(middleManualView.question.word_id);
      const current = middle3Words.find(word => word.id === middleManualView.question.word_id);
      middleManualView = await service(state, 'POST', '/practice/' + middleManualPractice.id + '/answer', {
        question_id: middleManualView.question_id, answer: current.meaning
      }, middleLogin._cookie);
      middleManualView = await service(state, 'POST', '/practice/' + middleManualPractice.id + '/next', {}, middleLogin._cookie);
    }
    assert(JSON.stringify(middleSeen.slice(0, 3)) === JSON.stringify([middle3Words[0].id, middle3Words[2].id, middle3Words[4].id]), 'middle manual test presents checked words sequentially');
    await expectStatus(409, () => service(state, 'POST', '/practice/start', {
      mode: 'write_meaning', word_ids: [middle2Bootstrap.books[0].words[0].id], cover_all: true
    }, middleLogin._cookie), 'middle3 student cannot select middle2 vocabulary');

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
    const autoRoleLogin = await service(state, 'POST', '/login', { username: 'qa_student', password: 'QaStudent123!', role: 'teacher', division: 'high' }, null);
    assert(autoRoleLogin.profile.role === 'student', 'login auto-detects the real account role even when the wrong role tab is selected');

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
    assert(bootstrap.exams.length === 5 && bootstrap.assignments.length === 1, 'student receives assigned exams and practice task');
    assert(bootstrap.books.length > 0 && bootstrap.books.every(book => book.school === '단원고'), 'student bootstrap only includes own-school vocabulary');
    assert(bootstrap.schools.length === 1 && bootstrap.schools[0].id === 'danwon-high', 'student bootstrap exposes only assigned school');
    assert(bootstrap.profile.division === 'high' && bootstrap.divisions.length === 1 && bootstrap.divisions[0] === 'high', 'student bootstrap is locked to assigned division');
    assert(bootstrap.ranking.some(item => item.grade === '중2') && bootstrap.ranking.some(item => item.grade === '중3') && bootstrap.ranking.some(item => item.grade === '고1'), 'student ranking includes middle2 middle3 and high1 across division boundaries');
    assert(bootstrap.ranking_period?.start < bootstrap.ranking_period?.end && bootstrap.ranking_period?.label && bootstrap.ranking_period?.range, 'ranking exposes Monday-Sunday calendar week metadata');

    const highBStudent = await service(state, 'POST', '/students', {
      username: 'qa_student_b', password: 'QaStudentB123!', display_name: 'QA B학생', class_name: '고1B', school: '단원고'
    }, teacherToken);
    const highBLogin = await service(state, 'POST', '/login', { username: 'qa_student_b', password: 'QaStudentB123!', role: 'student', division: 'high' }, null);
    const schoolWideExam = await service(state, 'POST', '/exams', {
      title: 'QA 학교 전체', class_name: '__ALL__', school: '단원고', range_codes: [rangeCode], exam_type: 'eng2mean_mc',
      question_count: 4, duration_sec: 300, passing_score: 70, max_attempts: 1,
      available_at: now - 1000, due_at: now + 3600000, release_result: true
    }, teacherToken);
    const highABootstrap = await service(state, 'GET', '/bootstrap', {}, studentToken);
    const highBBootstrap = await service(state, 'GET', '/bootstrap', {}, highBLogin._cookie);
    assert(highBStudent.class_name === '고1B' && highABootstrap.exams.some(item => item.id === schoolWideExam.id) && highBBootstrap.exams.some(item => item.id === schoolWideExam.id), 'school-wide exam reaches both high-school classes');
    await expectStatus(403, () => service(state, 'PATCH', '/profile/school', { school_id: 'seonbu-high' }, studentToken), 'student cannot change own school');

    const aliasWord = danwonWords[0];
    const aliasResult = await service(state, 'POST', '/meaning-aliases/' + encodeURIComponent(aliasWord.id), { alias: '교사용 허용 뜻' }, teacherToken);
    assert(aliasResult.aliases.includes('교사용 허용 뜻'), 'teacher can add accepted meaning alias');
    assert(aliasResult.meta.some(item => item.value === '교사용 허용 뜻' && item.source === 'teacher'), 'manual accepted meaning records teacher provenance');
    await service(state, 'POST', '/meaning-aliases/' + encodeURIComponent(aliasWord.id), { alias: '두번째 허용 뜻' }, teacherToken);
    const oneAliasDeleted = await service(state, 'DELETE', '/meaning-aliases/' + encodeURIComponent(aliasWord.id) + '/' + encodeURIComponent('교사용 허용 뜻'), {}, teacherToken);
    assert(!oneAliasDeleted.aliases.includes('교사용 허용 뜻') && oneAliasDeleted.aliases.includes('두번째 허용 뜻'), 'teacher can delete one accepted meaning without clearing the others');
    const aliasBootstrap = await service(state, 'GET', '/bootstrap', {}, teacherToken);
    assert(aliasBootstrap.meaning_aliases[aliasWord.id]?.includes('두번째 허용 뜻') && aliasBootstrap.meaning_alias_meta[aliasWord.id]?.some(item => item.source === 'teacher'), 'teacher bootstrap exposes accepted meaning provenance');
    const autoDispute = {
      id: 'qa-auto-valid', student_id: student.id, division: 'high', school_id: 'danwon-high', school: '단원고',
      class_name: '고1A', source_type: 'legacy', source_id: 'legacy-answer', source_key: '0',
      word_id: aliasWord.id, word: displayEnglish(aliasWord.word), meaning: aliasWord.meaning, answer: aliasWord.meaning,
      answer_normalized: aliasWord.meaning, status: 'pending', created_at: Date.now()
    };
    state.meaningDisputes.push(autoDispute);
    sweep(state);
    assert(autoDispute.status === 'approved_auto' && autoDispute.resolved_by === 'system', 'new valid-answer rules auto-resolve old pending disputes');

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
      const gradedInternal = state.examAttempts.find(item => item.id === internal.id);
      assert(submitted.attempt.status === 'submitted' && gradedInternal?.score === 100, `${exam.exam_type} grades correct answers at 100`);
      if (!exam.release_result) assert(submitted.attempt.result_visibility === 'withheld' && submitted.attempt.score === undefined, `${exam.exam_type} respects withheld student results after grading`);
    }
    const hiddenExam = await service(state, 'POST', '/exams', {
      title: 'QA hidden result', class_name: '고1A', school: '단원고', range_codes: [rangeCode], exam_type: 'write_meaning',
      question_count: 2, duration_sec: 300, passing_score: 70, max_attempts: 1,
      available_at: now - 1000, due_at: now + 3600000, release_result: false
    }, teacherToken);
    const hiddenStarted = await service(state, 'POST', '/exams/start', { exam_id: hiddenExam.id }, studentToken);
    const hiddenInternal = state.examAttempts.find(item => item.id === hiddenStarted.attempt.id);
    const hiddenAnswers = Object.fromEntries(hiddenInternal.keys.map((word, index) => [index, word.meaning]));
    await service(state, 'POST', `/attempts/${hiddenInternal.id}/submit`, {
      lease: hiddenInternal.lease, revision: hiddenInternal.revision, answers: hiddenAnswers
    }, studentToken);
    const hiddenStudentBootstrap = await service(state, 'GET', '/bootstrap', {}, studentToken);
    const hiddenStudentAttempt = hiddenStudentBootstrap.attempts.find(item => item.id === hiddenInternal.id);
    assert(hiddenStudentAttempt.result_visibility === 'withheld' && hiddenStudentAttempt.grading_status === 'final' && hiddenStudentAttempt.score === undefined, 'withheld exam score is not exposed as zero to student');
    const hiddenTeacherBootstrap = await service(state, 'GET', '/bootstrap', {}, teacherToken);
    const hiddenTeacherAttempt = hiddenTeacherBootstrap.attempts.find(item => item.id === hiddenInternal.id);
    assert(hiddenTeacherAttempt.result_visibility === 'visible' && hiddenTeacherAttempt.score === 100, 'teacher still sees withheld exam score for operations');

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
      assert(started.timer_mode === 'none' && started.question_duration_sec === 0 && !started.question_deadline && !started.deadline, `${practiceType} starts without a countdown timer`);
      const word = allWords.find(item => item.id === started.question.word_id);
      const result = await service(state, 'POST', `/practice/${started.id}/answer`, {
        question_id: started.question_id, answer: answerFor(practiceType, word), prefetch_next: true
      }, studentToken);
      assert(result.feedback?.ok === true, `${practiceType} accepts correct answer`);
      assert(result.prefetched_next?.question_id && !result.prefetched_next.question_deadline, `${practiceType} can prefetch the next question without starting a timer`);
      const repeated = await service(state, 'POST', `/practice/${started.id}/answer`, {
        question_id: started.question_id, answer: answerFor(practiceType, word)
      }, studentToken);
      assert(repeated.total === result.total, `${practiceType} duplicate submission is idempotent`);
      const next = await service(state, 'POST', `/practice/${started.id}/next`, {}, studentToken);
      assert(next.question_id !== started.question_id && next.timer_mode === 'none' && !next.question_deadline, `${practiceType} advances without a countdown timer`);
      const finished = await service(state, 'POST', `/practice/${started.id}/finish`, {}, studentToken);
      assert(finished.finished === true, `${practiceType} practice can finish and save`);
    }
    assert(state.sessions.filter(session => session.student_id === student.id).length >= 8, 'all eight high-school practice modes are recorded for the student');

    const testStarted = await service(state, 'POST', '/practice/start', {
      school: '단원고', range_codes: [rangeCode], mode: 'write_meaning', target: 5, run_mode: 'test'
    }, studentToken);
    assert(testStarted.run_mode === 'test' && testStarted.feedback === null && testStarted.score === null, 'test mode hides correctness until final submit');
    const testInternal = state.practices.find(item => item.id === testStarted.id);
    assert(new Set(testInternal.words).size === testStarted.target, 'test mode selects unique words without repeats');
    await expectStatus(409, () => service(state, 'POST', `/practice/${testStarted.id}/finish`, {}, studentToken), 'test mode blocks early manual finish');
    const testWrongQuestionId = testStarted.question_id;
    const testWrongWordId = testStarted.question.word_id;
    let testView = testStarted;
    let testAnswered = 0;
    while (!testView.finished && testAnswered < 8) {
      const currentWord = allWords.find(item => item.id === testView.question.word_id);
      const answer = testAnswered === 0 ? '__wrong_test_answer__' : answerFor('write_meaning', currentWord);
      testView = await service(state, 'POST', `/practice/${testStarted.id}/answer`, { question_id: testView.question_id, answer }, studentToken);
      testAnswered += 1;
      if (!testView.finished) assert(testView.feedback === null && testView.score === null, 'test mode advances without revealing grading');
    }
    const testSession = state.sessions.find(item => item.id === testStarted.id);
    assert(testView.finished === true && testView.score === 80 && testSession?.run_mode === 'test' && testSession?.score === 80, 'test mode grades all five answers together at the end');
    assert(testSession?.answer_records?.length === 5 && testSession?.wrong_count === 1 && testSession?.unanswered_count === 0 && testSession?.perfect === false, 'test mode stores durable first-pass answers and explicit wrong/unanswered counts');
    assert(testSession?.wrong_details?.length === 1, 'test mode keeps backward-compatible wrong-answer detail');
    const durableTestDispute = await service(state, 'POST', '/meaning-disputes', {
      source_type: 'practice', source_id: testStarted.id, question_id: testWrongQuestionId
    }, studentToken);
    assert(durableTestDispute.word_id === testWrongWordId && durableTestDispute.status === 'pending', 'completed test-mode meaning answer can be disputed from durable first-pass record after response-cache churn');
    await service(state, 'PATCH', '/meaning-disputes/' + durableTestDispute.id + '/resolve', { action: 'reject' }, teacherToken);
    const sharedTest = await service(state, 'POST', `/practice/${testStarted.id}/share`, {}, studentToken);
    assert(sharedTest.shared_to_teacher_at > 0, 'student can share a completed self-test with the teacher');
    const sharedStored = state.sessions.find(item => item.id === testStarted.id);
    assert(sharedStored?.shared_to_teacher_at === sharedTest.shared_to_teacher_at, 'shared self-test timestamp persists in the saved session');
    const teacherAfterShare = await service(state, 'GET', '/bootstrap', {}, teacherToken);
    assert(teacherAfterShare.sessions.some(item => item.id === testStarted.id && item.shared_to_teacher_at), 'teacher bootstrap receives student-shared self-test results');

    const practiceExam = await service(state, 'POST', '/practice/start', {
      school: '단원고', range_codes: [rangeCode], mode: 'write_meaning', target: 5, run_mode: 'practice', exam_style: true
    }, studentToken);
    const practiceExamInternal = state.practices.find(item => item.id === practiceExam.id);
    assert(practiceExam.exam_style === true && practiceExam.target === 5 && new Set(practiceExamInternal.words).size === 5, 'practice exam style selects a unique first-pass pool just like the real exam');
    await service(state, 'POST', `/practice/${practiceExam.id}/finish`, {}, studentToken);

    const wrongPractice = await service(state, 'POST', '/practice/start', {
      school: '단원고', range_codes: [rangeCode], mode: 'spell', target: 5
    }, studentToken);
    const wrongResult = await service(state, 'POST', `/practice/${wrongPractice.id}/answer`, {
      question_id: wrongPractice.question_id, answer: '__definitely_wrong__'
    }, studentToken);
    assert(wrongResult.feedback?.ok === false && wrongResult.retry_count === 1, 'wrong practice answer enters retry queue');
    const wrongFinished = await service(state, 'POST', `/practice/${wrongPractice.id}/finish`, {}, studentToken);
    const wrongSession = state.sessions.find(item => item.id === wrongPractice.id);
    assert(wrongFinished.score === 0 && wrongSession?.score === 0 && wrongSession?.wrong_details?.length === 1, 'practice finish stores a 100-point score and wrong-answer detail');
    assert(wrongPractice.timer_mode === 'none' && wrongPractice.deadline === null && !wrongPractice.question_deadline && wrongPractice.question_duration_sec === 0, 'practice keeps question timing disabled');

    const noTimerPractice = await service(state, 'POST', '/practice/start', {
      school: '단원고', range_codes: [rangeCode], mode: 'write_meaning', target: 5, run_mode: 'practice', exam_style: true
    }, studentToken);
    const noTimerInternal = state.practices.find(item => item.id === noTimerPractice.id);
    assert(noTimerInternal.timer_mode === 'none' && noTimerInternal.question_deadline === null, 'exam-style practice has no per-question countdown');
    const noTimerWrong = await service(state, 'POST', `/practice/${noTimerPractice.id}/answer`, {
      question_id: noTimerPractice.question_id, answer: '__wrong__'
    }, studentToken);
    assert(noTimerWrong.feedback?.timed_out === false, 'slow or manual answers are never converted into timeout answers');
    await service(state, 'POST', `/practice/${noTimerPractice.id}/finish`, {}, studentToken);
    const noTimerSession = state.sessions.find(item => item.id === noTimerPractice.id);
    assert(noTimerSession?.word_ids?.length === 5 && noTimerSession.unanswered_count === 4, 'early-finished practice stores the full word pool for complete review');

    const activeOriginal = await service(state, 'POST', '/practice/start', {
      school: '단원고', range_codes: [rangeCode], mode: 'write_meaning', target: 5
    }, studentToken);
    const activeSummaryBootstrap = await service(state, 'GET', '/bootstrap', {}, studentToken);
    assert(activeSummaryBootstrap.active_practice_summary?.id === activeOriginal.id && activeSummaryBootstrap.active_practice_summary?.mode === 'write_meaning' && activeSummaryBootstrap.active_practice_summary?.timer_mode === 'none', 'bootstrap exposes the active untimed practice for action-first home');
    const resumedDifferentRequest = await service(state, 'POST', '/practice/start', {
      school: '단원고', range_codes: [rangeCode], mode: 'spell', target: 5
    }, studentToken);
    assert(resumedDifferentRequest.id === activeOriginal.id && resumedDifferentRequest.resumed_existing === true && resumedDifferentRequest.mode === 'write_meaning', 'server marks an existing active practice instead of pretending new settings started');
    await service(state, 'POST', `/practice/${activeOriginal.id}/finish`, {}, studentToken);

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
    assert(regradedSession?.correct === 1 && regradedSession?.score === 20 && regradedSession?.wrong_details?.some(item => item.regraded), 'approved practice dispute automatically corrects the saved first-pass practice score and detail');
    assert((state.meaningAliases[disputedPracticeWord.id] || []).includes('새로운허용뜻'), 'approved alternate meaning persists separately from source vocabulary');
    assert(state.meaningAliasMeta[disputedPracticeWord.id]?.some(item => item.value === '새로운허용뜻' && item.source === 'appeal'), 'appeal-approved meaning records student-appeal provenance');

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

    const rangeWordsForRecent = danwonWords.filter(word => String(word.range_code) === rangeCode);
    state.mastery[student.id] ??= {};
    for (const word of rangeWordsForRecent) {
      state.mastery[student.id][word.id] = {
        mastery: 50, correct: 1, wrong: 9, streak: 0,
        last_seen: now - 3600000, last_wrong_at: now - 7200000, recent_results: []
      };
    }
    const recentRequired = Math.min(20, rangeWordsForRecent.length);
    const recentCorrect = recentRequired >= 20 ? recentRequired - 1 : recentRequired;
    rangeWordsForRecent.slice(0, recentRequired).forEach((word, index) => {
      state.mastery[student.id][word.id].recent_results = [{ ok: index < recentCorrect, at: now + index }];
    });
    const recentMasteryBootstrap = await service(state, 'GET', '/bootstrap', {}, studentToken);
    const recentRange = recentMasteryBootstrap.word_mastery.ranges[rangeCode];
    assert(recentRange.coverage === 100 && recentRange.accuracy === 10, 'word mastery keeps cumulative history for reporting');
    assert(recentRange.recent_accuracy >= 95 && recentRange.achievement_source === 'recent30' && ['master','perfect'].includes(recentRange.status), 'full coverage plus at least 95 percent recent achievement earns WORD MASTER despite early mistakes');

    const reviewSeed = danwonWords.filter(word => String(word.range_code) !== rangeCode).slice(0, 6);
    reviewSeed.forEach((word, index) => {
      state.mastery[student.id][word.id] = {
        mastery: 100, correct: 3, wrong: 0, streak: 3,
        last_seen: now - (20 + index) * 86400000,
        recent_results: [{ ok: true, at: now - (20 + index) * 86400000 }]
      };
    });
    const dailyBootstrap = await service(state, 'GET', '/bootstrap', {}, studentToken);
    assert(dailyBootstrap.daily_quest.target === 20, 'daily quest automatically selects twenty words when enough vocabulary exists');
    assert(dailyBootstrap.daily_quest.mix.wrong === 8 && dailyBootstrap.daily_quest.mix.review === 6 && dailyBootstrap.daily_quest.mix.new === 6, 'daily quest mixes eight wrong six stale and six new words');
    const dailyPractice = await service(state, 'POST', '/practice/start', { mode: 'write_meaning', daily_quest: true }, studentToken);
    const dailyInternal = state.practices.find(item => item.id === dailyPractice.id);
    assert(dailyPractice.daily_quest === true && dailyPractice.target === 20 && new Set(dailyInternal.words).size === 20, 'daily quest starts as one twenty-word adaptive practice');
    await service(state, 'POST', '/practice/' + dailyPractice.id + '/finish', {}, studentToken);

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
    const v1311Css = readFileSync(publicRoot + 'v1311.css', 'utf8');
    const v1313Css = readFileSync(publicRoot + 'v1313.css', 'utf8');
    const v1315Css = readFileSync(publicRoot + 'v1315.css', 'utf8');
    const v1317Css = readFileSync(publicRoot + 'v1317.css', 'utf8');
    const v1320Css = readFileSync(publicRoot + 'v1320.css', 'utf8');
    const v1321Css = readFileSync(publicRoot + 'v1321.css', 'utf8');
    const v1322Css = readFileSync(publicRoot + 'v1322.css', 'utf8');
    const v1323Css = readFileSync(publicRoot + 'v1323.css', 'utf8');
    const v1325Css = readFileSync(publicRoot + 'v1325.css', 'utf8');
    const v1326Css = readFileSync(publicRoot + 'v1326.css', 'utf8');
    const v1327Css = readFileSync(publicRoot + 'v1327.css', 'utf8');
    const uiModule = readFileSync(publicRoot + 'modules/ui.js', 'utf8');
    const studentModule = readFileSync(publicRoot + 'modules/student.js', 'utf8');
    const sessionsModule = readFileSync(publicRoot + 'modules/sessions.js', 'utf8');
    const practiceEnhancements = readFileSync(publicRoot + 'practice-enhancements.js', 'utf8');
    const appJs = readFileSync(publicRoot + 'app.js', 'utf8');
    assert(manifest.display === 'standalone' && manifest.start_url === '/', 'PWA manifest is installable');
    assert(teacherModule.includes('TODAY CONTROL') && teacherModule.includes('오늘 확인 필요') && teacherModule.includes('많이 틀린 어법 포인트'), 'V13.6 teacher operations dashboard is present');
    assert(teacherModule.includes('grammar_progress') && teacherModule.includes('학생이 보낸 실전 결과'), 'teacher dashboard combines grammar progress with student-shared self-test results');
    assert(indexHtml.includes('teacher-dashboard-v136.css') && !indexHtml.includes('teacher-dashboard.js'), 'dashboard stylesheet is loaded and stale missing module is removed');
    assert(dashboardCss.includes('.v136-dashboard-grid') && dashboardCss.includes('@media(max-width:760px)'), 'teacher dashboard has responsive styles');
    assert(indexHtml.includes('v137.css') && v137Css.includes('.exam-ops-table') && v137Css.includes('.word-conquest-card'), 'V13.7 teacher proportions and word quest styles are loaded');
    assert(teacherModule.includes('data-exam-edit') && teacherModule.includes('data-exam-status') && teacherModule.includes('data-exam-menu'), 'teacher exam list exposes edit status and operations');
    assert(teacherModule.includes('data-meaning-alias') && appJs.includes('meaningAliasModal'), 'teacher can manage accepted meaning aliases');
    assert(studentModule.includes('깨야 할 퀘스트') && studentModule.includes('WORD MASTER') && studentModule.includes('PERFECT MASTER'), 'student word mastery quest labels are present');
    assert(!appJs.includes("id=\"account-school\"") && studentModule.includes('선생님 관리'), 'student self-service school change is removed');
    assert(indexHtml.includes('v138.css') && v138Css.includes('.division-segment') && v138Css.includes('.dispute-card'), 'V13.8 division and dispute styles are loaded');
    assert(appJs.includes('data-division="middle"') && appJs.includes('/teacher/division') && appJs.includes('login.profile?.role'), 'login auto-detects role while teacher controls separate middle and high divisions');
    assert(teacherModule.includes('뜻 이의제기') && teacherModule.includes('data-dispute-global') && teacherModule.includes('data-dispute-once'), 'teacher meaning-dispute inbox is present');
    assert(sessionsModule.includes('이 답도 맞는 것 같아요') && sessionsModule.includes('/meaning-disputes'), 'meaning-writing student dispute buttons are present');
    assert(indexHtml.includes('v139.css') && v139Css.includes('.rank-scope') && v139Css.includes('.my-rank-card'), 'V13.9 academy ranking styles are loaded');
    assert(studentModule.includes("['all','전체']") && studentModule.includes("['중2','중2']") && studentModule.includes("['중3','중3']") && studentModule.includes("['고1','고1']"), 'student ranking exposes overall middle2 middle3 and high1 filters');
    assert(appJs.includes('d.rankScope') && studentModule.includes('SUMUS 랭킹'), 'V13.9 ranking interactions remain active');
    assert(indexHtml.includes('v1310.css') && v1310Css.includes('.today-word-quest') && v1310Css.includes('.today-word-start'), 'V13.10 simplified home styles are loaded');
    assert(studentModule.includes('오늘의 단어 퀘스트') && studentModule.includes('data-quick-practice') && !studentModule.includes('<h2>오늘의 한 걸음</h2>'), 'V13.10 merges duplicate vocabulary home cards');
    assert(appJs.includes('d.quickPractice') && appJs.includes("A.mode = 'write_meaning'") && appJs.includes('A.target = 20'), 'V13.10 home starts a 20-question meaning-writing quest directly');
    assert(studentModule.includes('오늘의 단어 퀘스트') && studentModule.includes('data-quick-practice') && !studentModule.includes('<h2>오늘의 한 걸음</h2>'), 'V13.10 simplified home remains active');
    assert(indexHtml.includes('v1311.css') && v1311Css.includes('.meaning-alias.auto'), 'V13.11 valid-answer teacher styles are loaded');
    assert(teacherModule.includes('기본 유효답과 승인된 허용 뜻의 출처') && teacherModule.includes('approved_auto'), 'teacher UI keeps part-of-speech safe valid-answer workflow');
    assert(indexHtml.includes('v1313.css') && v1313Css.includes('.meaning-alias-row') && v1313Css.includes('.vocab-import-preview'), 'V13.13 vocabulary management styles are loaded');
    assert(studentModule.includes('최근 성취') && studentModule.includes('daily_quest') && studentModule.includes('오답 ${mix.wrong'), 'V13.13 student UI exposes recent mastery and adaptive daily mix');
    assert(sessionsModule.includes('daily_quest: true') && appJs.includes('d.quickPractice'), 'adaptive daily quest still starts through the practice session flow');
    assert(teacherModule.includes('단어 파일 등록') && teacherModule.includes('meaning_alias_meta') && teacherModule.includes('학생 이의제기'), 'V13.13 teacher vocabulary UI exposes import and alias provenance');
    assert(appJs.includes('/vocab-import/preview') && appJs.includes('/vocab-import/commit') && appJs.includes('data-alias-remove'), 'V13.13 teacher UI supports previewed import and single-alias deletion');
    assert(practiceEnhancements.includes('sumusCalmFeedback') && !practiceEnhancements.includes('floatGain(feedback); celebrateCorrect(session, feedback)'), 'calm practice feedback layer remains active');
    assert(indexHtml.includes('/app.js?v=13.27.0') && indexHtml.includes('/practice-enhancements.js?v=13.27.0') && indexHtml.includes('/v1325.css?v=13.27.0') && indexHtml.includes('/v1326.css?v=13.27.0') && indexHtml.includes('/v1327.css?v=13.27.0') && sw.includes('sumus-voca-v13.27.0-student-ux-finish'), 'V13.27 cache versions are active');
    assert(v1325Css.includes('--sumus-primary') && v1325Css.includes('grid-template-columns:repeat(5') && v1325Css.includes('memorize-flip-in'), 'V13.25 green design system, balanced bottom navigation, and memorization motion are loaded');
    assert(v1326Css.includes('.home-focus-v1326') && v1326Css.includes('.rank-filter-bar') && v1326Css.includes('.pwa-install-hint'), 'V13.27 home, ranking, and PWA polish styles are loaded');
    assert(v1327Css.includes('.home-pet-hero') && v1327Css.includes('.record-summary-v1327') && v1327Css.includes('.auth-card-v1327'), 'V13.27 student home, records, and login polish styles are loaded');
    assert(studentModule.includes('home-pet-hero') && studentModule.includes('home-week-days') && studentModule.includes('data-rank-scope-select') && !studentModule.includes('같이 올라가면 더 재밌다.'), 'V13.27 home is pet-and-growth focused and ranking filters are compact');
    assert(appJs.includes('rankScopeSelect') && appJs.includes('missingCount') && appJs.includes('session.word_ids'), 'V13.27 compact rank filters and complete review flow are wired');

    assert(studentModule.includes('home-metrics') && studentModule.includes('포인트') && studentModule.includes('XP ') && sessionsModule.includes('result-reward-card'), 'V13.27 separates XP, reward points, and achievements in the student UX');
    assert(appJs.includes('memorize-flip-out') && appJs.includes('memorize-flip-in'), 'V13.25 vocabulary tap uses a short flip and fade transition');
    assert(v1315Css.includes('.primary-mode-grid') && studentModule.includes('영어 직접 쓰기') && studentModule.includes('data-practice-record'), 'meaning and English writing remain first-class scored modes');
    assert(studentModule.includes('recentRecordCard') && studentModule.includes('이번 주 평균') && !sessionsModule.includes('${timerHtml}'), 'student home and record summaries remain available while visible question timer is removed');
    assert(teacherModule.includes('학생별 연습 기록') && teacherModule.includes('학생이 보낸 실전 결과') && teacherModule.includes('data-practice-record') && appJs.includes('openPracticeRecord'), 'teacher can inspect practice history and student-shared real-test results');
    assert(studentModule.includes('첫 100점') && studentModule.includes('3회 연속 90점+') && studentModule.includes('영어쓰기 100점') && studentModule.includes('achievementSection'), 'student achievement badges remain present');
    assert(studentModule.includes("result_visibility === 'visible'") && studentModule.includes("filter(Number.isFinite)") && studentModule.includes("'공개 대기'"), 'legacy assigned-exam visibility remains safe in historical records');
    assert(teacherModule.includes('sharedSelfTests') && teacherModule.includes('shared_to_teacher_at') && teacherModule.includes('학생이 보낸 실전 결과'), 'teacher dashboard is centered on student-shared real-test results');
    assert(uiModule.includes('recordRangeLabel') && studentModule.includes('recordRangeLabel(s, code)') && sessionsModule.includes('recordRangeLabel'), 'middle and high range labels stay consistent');
    assert(sessionsModule.includes('미응답') && sessionsModule.includes('data-finish-practice-dispute'), 'saved exam results separate unanswered answers and keep meaning disputes');
    assert(sessionsModule.includes('이미 진행 중인 학습이 있어요') && sessionsModule.includes('기존 연습 저장 후 새 설정 시작'), 'active session mismatch still warns before reuse');
    assert(appJs.includes('examFormDirty') && appJs.includes('contextGeneration') && appJs.includes('작성 취소 후 전환'), 'teacher context switch still protects dirty forms and stale responses');
    assert(studentModule.includes('homePrimaryAction') && studentModule.includes('home-focus-card') && studentModule.includes('오늘 학습'), 'student home keeps one action-first CTA');
    assert(v1320Css.includes('.home-focus-card') && v1320Css.includes('.setup-start-summary') && v1320Css.includes('.result-page-v1320'), 'base responsive student UX styles remain loaded');

    const studyHubSource = studentModule.slice(studentModule.indexOf('function studyHub'), studentModule.indexOf('function grammarCards'));
    assert(studyHubSource.includes('단어 학습') && studyHubSource.includes('어법·어휘') && studyHubSource.includes('study-hub-simple') && !studyHubSource.includes('추천 학습 흐름') && !studyHubSource.includes('영어↔뜻, 철자'), 'V13.22 learning home contains only clean vocabulary and grammar choices');
    const memorizationSource = studentModule.slice(studentModule.indexOf('function memorizationPanel'), studentModule.indexOf('function durationText'));
    assert(memorizationSource.includes('data-memorize-word') && memorizationSource.includes('data-memorize-star') && memorizationSource.includes('data-memorize-speak') && memorizationSource.includes('front = show ? word.meaning : word.word'), 'V13.22 vocabulary rows swap English and meaning in place and expose pronunciation');
    assert(appJs.includes('SpeechSynthesisUtterance') && appJs.includes('d.memorizeSpeak'), 'V13.22 memorization has one-tap English pronunciation');
    assert(studentModule.includes("['exam', '시험'") && studentModule.includes('data-exam-kind="practice"') && studentModule.includes('data-exam-kind="test"') && studentModule.includes('연습시험') && studentModule.includes('실전시험'), 'V13.22 bottom Exam menu lets students choose practice or real exam');
    assert(studentModule.includes('data-action="start-exam-run"') && !studentModule.includes('다음 문제마다 시간이 다시 시작돼요') && appJs.includes('examStyle: true'), 'V13.27 both exam modes share the same untimed exam-style word pool');
    assert(!studentModule.includes('function middleVocabQuiz') && !studentModule.includes('function vocabQuiz') && !studentModule.includes('function practiceModePicker'), 'V13.22 removes the old duplicate vocabulary quiz path from Learning');
    assert(sessionsModule.includes("const modeLabel = testMode ? '실전시험' : '연습시험'") && !sessionsModule.includes('${timerHtml}') && sessionsModule.includes('keyboard-focus'), 'V13.27 practice and real exams share one focused untimed question screen with keyboard handling');
    assert(sessionsModule.includes('answer-impact-compact') && sessionsModule.includes('result-reward-top') && sessionsModule.includes('missingWordIds'), 'V13.27 keeps calm answer feedback and complete result review');
    assert(!teacherModule.match(/const tabs = .*assignments/) && !teacherModule.match(/const tabs = .*exams/), 'teacher navigation keeps assignment and teacher-created exam operations removed');
    assert(teacherModule.includes('학생이 보낸 실전 결과') && teacherModule.includes('shared_to_teacher_at'), 'teacher results focus on student-shared real exams');
    assert(sessionsModule.includes('/share') && sessionsModule.includes('선생님께 결과 보내기') && sessionsModule.includes('animateTestResult'), 'real exam result can be shared and keeps result impact');
    assert(sessionsModule.includes('answerImpact') && v1321Css.includes('.answer-impact-check') && v1321Css.includes('.perfect-impact'), 'practice correct answers and perfect real exams keep short impact effects');
    assert(v1322Css.includes('.study-hub-simple') && v1322Css.includes('.memorize-sound') && v1322Css.includes('.exam-kind-grid') && v1322Css.includes('.question-timer.danger'), 'V13.22 final learning, pronunciation, exam selector, and tension timer styles are loaded');
    assert(v1323Css.includes('.study-hub-simple .study-hub-card') && v1323Css.includes('.memorize-list') && v1323Css.includes('.exam-kind-card') && v1323Css.includes('.exam-question-area') && v1323Css.includes('.result-page-v1320'), 'V13.23 premium mobile visual system covers learning, memorization, exam, and result screens');
    assert(v1323Css.includes('grid-template-columns:1fr!important') && v1323Css.includes('min-height:184px') && v1323Css.includes('border-radius:34px 34px 0 0'), 'V13.23 uses large vertical entry cards and rounded exam sheets');
    assert(studentModule.includes('premium-page-heading') && !studentModule.includes('grammar-set-meta"><span>'), 'V13.23 reduces secondary text and strengthens screen hierarchy');
    assert(appJs.includes("$$('#teacher-division,#teacher-school')"), 'teacher context selectors use the multi-element helper');
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
