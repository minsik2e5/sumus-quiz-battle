import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { emptyState } from './repository.mjs';
import { passwordHash } from './auth.mjs';
import { selfSignup } from './signup.mjs';
import { allBooks, service, sweep, scopedWords, settleBattle, tidyBattles, APP_VERSION, STALE_PRACTICE_MS, COMPACT_SESSION_AFTER_MS } from './service.mjs';
import { createMutationCoordinator } from './mutation-coordinator.mjs';
import { EXAM_TYPES, PRACTICE_TYPES, PRACTICE_SECONDS_PER_QUESTION, CHARACTERS, PET_FORM_LEVELS, petForm, levelInfo, grade, displayEnglish, meaningAccepted } from '../public/modules/core.js';
import { runContentValidation } from './content-validation.mjs';
import { runBattleChecks } from './battle-check.mjs';
import { compactSession, migrateState, stateSizeReport } from './state.mjs';
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
// Views no longer expose question.word_id to students; tests read it from server state.
const wordIdOf = (state, view, practiceId = view?.id) => {
  const practice = state.practices.find(item => item.id === practiceId);
  if (!practice || !view) return undefined;
  if (practice.question_id === view.question_id) return practice.question?.word_id;
  if (practice.next_preview?.question_id === view.question_id) return practice.next_preview.question?.word_id;
  return undefined;
};
const answerFor = (type, word) => {
  if (['mean2eng_mc', 'mean2eng', 'write_en', 'spell', 'scramble', 'vowelblank', 'initial'].includes(type)) return displayEnglish(word.word);
  if (type === 'write_meaning') return meaningAccepted(word.meaning, word.accepted_meanings)[0] || word.meaning;
  return word.meaning;
};

// Same review list as the record screen's "다시 풀기" (public/app.js, reviewPractice).
function reviewWordIds(session) {
  const records = Array.isArray(session.answer_records) ? session.answer_records : [];
  const answered = new Set(records.map(item => item.word_id).filter(Boolean));
  const wrongIds = records.length
    ? records.filter(item => item.correct === false && !item.regraded).map(item => item.word_id).filter(Boolean)
    : (session.wrong_details || []).filter(item => !item.regraded).map(item => item.word_id).filter(Boolean);
  const timedOutCount = records.filter(item => item.timed_out && !item.regraded).length;
  const missingCount = Math.max(0, Number(session.unanswered_count || 0) - timedOutCount);
  const missingIds = (session.word_ids || []).filter(id => !answered.has(id)).slice(0, missingCount);
  return [...new Set([...wrongIds, ...missingIds])];
}
export async function runReleaseCheck() {
  const priorAuthProvider = process.env.AUTH_PROVIDER;
  delete process.env.AUTH_PROVIDER;
  try {
    runContentValidation();
    checks.push('school content validation passes');
    const sessionUiSource = readFileSync(fileURLToPath(new URL('../public/modules/sessions.js', import.meta.url)), 'utf8');
    const studentUiSource = readFileSync(fileURLToPath(new URL('../public/modules/student.js', import.meta.url)), 'utf8');
    const indexSource = readFileSync(fileURLToPath(new URL('../public/index.html', import.meta.url)), 'utf8');
    const bundleCss = readFileSync(fileURLToPath(new URL('../public/app.bundle.css', import.meta.url)), 'utf8');
    assert(sessionUiSource.includes(String.fromCharCode(36, 36) + "('[data-practice-choice],#practice-confirm').forEach"), 'practice answer controls disable through the multi-node selector');
    assert(sessionUiSource.includes('practiceAdvanceTimer = setTimeout'), 'practice correct-answer auto advance is wired');
    assert(studentUiSource.includes('data-memorize-range='), 'vocabulary range numbers are interactive');
    assert(studentUiSource.includes('data-middle-word=') && studentUiSource.includes('시험 볼 단어 직접 선택'), 'middle-school test setup uses direct word selection');
    assert(!studentUiSource.includes('data-middle-start-picker=') && !studentUiSource.includes('data-middle-chunk-size=') && !studentUiSource.includes('data-middle-range-move='), 'middle-school start/chunk/range navigation UI is removed');
    assert(indexSource.includes('/app.bundle.css?v=13.62.0') && bundleCss.includes('--sumus-primary') && bundleCss.includes('.home-focus-v1326') && bundleCss.includes('.practice-saving-v1345'), 'V13.46 production CSS bundle contains feedback styles');
    assert(typeof openGrammarChoiceSample === 'function', 'grammar learning module parses as a browser module');
    const runtimeBooks = allBooks({ extraBooks: [] });
    const allWords = runtimeBooks.flatMap(book => book.words || []);
    const bySchool = school => runtimeBooks.filter(book => book.school === school).flatMap(book => book.words || []);
    assert(bySchool('단원고').length === 542, '단원고 vocabulary = 542 (existing 362 + YBM Kim READING DB 68 + 112)');
    {
      const ybm = bySchool('단원고').filter(word => word.id.startsWith('high:ybm-kim:common2:'));
      const byId = id => ybm.find(word => word.id === id);
      assert(ybm.filter(word => word.range_code === 'L1').length === 68 && ybm.filter(word => word.range_code === 'L2').length === 112, 'YBM Kim lessons match the READING DB (68 + 112)');
      // Ids are what student mastery and answer records point at: existing words keep theirs.
      assert(byId('high:ybm-kim:common2:lesson1:001')?.word === 'accountable' && byId('high:ybm-kim:common2:lesson2:001')?.word === 'deliver', 'existing YBM Kim word ids keep pointing at the same words');
      assert(grade('write_meaning', '책임이 있는', byId('high:ybm-kim:common2:lesson1:001')) && grade('write_meaning', '책임감 있는', byId('high:ybm-kim:common2:lesson1:001')), 'reworded meanings accept both the READING DB meaning and the previous one');
      assert(byId('high:ybm-kim:common2:lesson1:r001')?.word === 'shape', 'words new in the READING DB get r-prefixed ids that cannot collide with existing ones');
      assert(new Set(ybm.map(word => word.id)).size === ybm.length, 'YBM Kim word ids are unique');
      const charged = ybm.find(word => word.word.startsWith('be charged with'));
      assert(displayEnglish(charged.word) === 'be charged with' && grade('write_en', 'be charged with', charged), 'grammar note (+동명사) is not part of the expected English answer');
    }
    const gangseoWords = bySchool('강서고');
    assert(gangseoWords.length === 354 + 180, '강서고 vocabulary = 354 mock-exam words + 180 YBM textbook words (same textbook as 단원고)');
    {
      const danwonYbm = bySchool('단원고').filter(word => word.id.startsWith('high:ybm-kim:common2:'));
      const gangseoYbm = gangseoWords.filter(word => word.id.startsWith('high:ybm-kim:gangseo:common2:'));
      assert(gangseoYbm.length === 180 && gangseoYbm.every((word, i) => word.word === danwonYbm[i].word && word.meaning === danwonYbm[i].meaning && word.range_code === danwonYbm[i].range_code && word.school_id === 'gangseo-high'), 'V13.56.1 강서고 gets the same textbook words as 단원고 (its own ids, 단원고 ids unchanged)');
      assert(runtimeBooks.filter(book => book.id.startsWith('high:ybm-kim:')).every(book => !book.grade), 'V13.56.1 the textbook class split (고1A/고1B) is switched off for now');
      const probe = { extraBooks: [], schools: [{ id: 'gangseo-high', name: '강서고', full_name: '강서고등학교', division: 'high' }] };
      assert(scopedWords(probe, 'gangseo-high', ['L1'], '고1B').length === 68 && scopedWords(probe, 'gangseo-high', ['L2'], '고1A').length === 112, 'V13.56.1 강서고 고1A/고1B students can practice textbook lessons 1-2');
      const appSource = readFileSync(fileURLToPath(new URL('../public/app.js', import.meta.url)), 'utf8');
      const teacherSource = readFileSync(fileURLToPath(new URL('../public/modules/teacher.js', import.meta.url)), 'utf8');
      const gangseoLoader = appSource.slice(appSource.indexOf("school === '강서고'"), appSource.indexOf("school === '강서고'") + 400);
      assert(gangseoLoader.includes('danwongo-textbook-grammar-data.js') && teacherSource.slice(teacherSource.indexOf("'강서고':")).slice(0, 300).includes('danwongo-textbook-grammar-data.js'), 'V13.56.1 강서고 students and teachers load the textbook grammar sets');
    }
    assert(bySchool('단원고').some(word => word.id.startsWith('high:ybm-kim:common2:lesson1:')), 'YBM Kim lesson 1 vocabulary is loaded');
    assert(bySchool('단원고').some(word => word.id.startsWith('high:ybm-kim:common2:lesson2:')), 'YBM Kim lesson 2 vocabulary is loaded');
    assert(studentUiSource.includes("['eng2mean','뜻 4지선다'") && studentUiSource.includes("['mean2eng','영어 4지선다'"), 'middle/high self-test exposes both four-choice modes');
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
    const selfSigned = await selfSignup(state, {
      username: 'qa_signup', password: 'QaSignup123!', display_name: '가입테스트', class_name: '중3',
      school_id: 'wonil-middle', division: 'middle'
    });
    assert(selfSigned.ok === true && selfSigned.division === 'middle' && selfSigned.class_name === '중3', 'student self-signup creates a middle-school account');
    const selfSignupLogin = await service(state, 'POST', '/login', {
      username: 'qa_signup', password: 'QaSignup123!', role: 'student', division: 'middle'
    }, null);
    assert(Boolean(selfSignupLogin._cookie) && selfSignupLogin.profile.username === 'qa_signup', 'self-signup student can immediately log in with the same password');
    const selfSignupBootstrap = await service(state, 'GET', '/bootstrap', {}, selfSignupLogin._cookie);
    assert(selfSignupBootstrap.profile.school_id === 'wonil-middle' && selfSignupBootstrap.profile.class_name === '중3', 'self-signup account keeps the selected school and class');
    await expectStatus(409, () => selfSignup(state, {
      username: 'qa_signup', password: 'QaSignup123!', display_name: '중복가입', class_name: '중3',
      school_id: 'wonil-middle', division: 'middle'
    }), 'duplicate self-signup username is rejected');
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
    assert(wordIdOf(state, middleManualPractice) === middle3Words[0].id, 'middle manual test begins with the first checked word in lesson order');
    let middleManualView = middleManualPractice;
    const middleSeen = [];
    while (!middleManualView.finished && middleSeen.length < 8) {
      middleSeen.push(wordIdOf(state, middleManualView));
      const current = middle3Words.find(word => word.id === wordIdOf(state, middleManualView));
      middleManualView = await service(state, 'POST', '/practice/' + middleManualPractice.id + '/answer', {
        question_id: middleManualView.question_id, answer: current.meaning
      }, middleLogin._cookie);
      middleManualView = await service(state, 'POST', '/practice/' + middleManualPractice.id + '/next', {}, middleLogin._cookie);
    }
    assert(JSON.stringify(middleSeen.slice(0, 3)) === JSON.stringify([middle3Words[0].id, middle3Words[2].id, middle3Words[4].id]), 'middle manual test presents checked words sequentially');
    assert(middleManualView.finished === true && middleManualView.score_total === 3 && middleManualView.answer_records?.length === 3, 'middle manual test finishes exactly at the selected word count');
    assert(state.sessions.some(session => session.id === middleManualPractice.id && session.total === 3), 'middle manual completion is durably recorded');
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
    {
      // V13.56.1: the YBM textbook words reach both Danwon classes, not only 고1A.
      const bWords = highBBootstrap.books.flatMap(book => book.words || []);
      const aWords = (await service(state, 'GET', '/bootstrap', {}, studentToken)).books.flatMap(book => book.words || []);
      const ybmOf = list => list.filter(word => word.id.startsWith('high:ybm-kim:common2:')).length;
      assert(ybmOf(bWords) === 180 && ybmOf(aWords) === 180, 'V13.56.1 고1A and 고1B students both see the 180 YBM textbook words');
      const bPractice = await service(state, 'POST', '/practice/start', { school: '단원고', range_codes: ['L1'], mode: 'write_meaning', target: 5 }, highBLogin._cookie);
      assert(bPractice.id && bPractice.word_ids.length === 68, 'V13.56.1 a 고1B student can practice textbook lesson 1');
      await service(state, 'POST', `/practice/${bPractice.id}/finish`, {}, highBLogin._cookie);
    }
    await expectStatus(403, () => service(state, 'PATCH', '/profile/school', { school_id: 'seonbu-high' }, studentToken), 'student cannot change own school');

    // Pets: first pick once, names per pet, random eggs from the shop, separate growth.
    const petStudent = state.profiles.find(x => x.username === 'qa_student');
    const beforePick = await service(state, 'GET', '/bootstrap', {}, studentToken);
    assert(beforePick.stats.needs_pet_pick === true && !beforePick.stats.pets.length, 'V13.53 existing students are asked to pick their first pet');
    await expectStatus(409, () => service(state, 'POST', '/profile/pet-name', { pet_name: '콩이' }, studentToken), 'V13.53 naming waits for the first pet');
    await expectStatus(409, () => service(state, 'POST', '/shop/egg', {}, studentToken), 'V13.53 the egg shop waits for the first pet');
    await service(state, 'POST', '/pets/choose', { key: 'fox' }, studentToken);
    await expectStatus(409, () => service(state, 'POST', '/pets/choose', { key: 'cat' }, studentToken), 'V13.53 the first pet cannot be chosen again');
    await expectStatus(403, () => service(state, 'POST', '/pets/choose', { key: 'cat' }, teacherToken), 'V13.53 teachers cannot pick a student pet');
    await expectStatus(403, () => service(state, 'POST', '/profile/style', { avatar_key: 'cat', avatar_accessory: 'none', avatar_frame: 'basic', avatar_title: 'rookie' }, studentToken), 'V13.53 students cannot switch to a pet they do not own');
    await expectStatus(403, () => service(state, 'POST', '/pets/active', { key: 'cat' }, studentToken), 'V13.53 an unowned pet cannot become the partner');
    const namedPet = await service(state, 'POST', '/profile/pet-name', { pet_name: '  콩  이  ' }, studentToken);
    assert(namedPet.pets[0].name === '콩 이', 'V13.53 student names the partner pet (spaces tidied)');
    await expectStatus(400, () => service(state, 'POST', '/profile/pet-name', { pet_name: '가나다라마바사아자' }, studentToken), 'V13.53 pet names longer than 8 characters are rejected');
    await expectStatus(400, () => service(state, 'POST', '/profile/pet-name', { pet_name: '<b>콩</b>' }, studentToken), 'V13.53 pet names with markup characters are rejected');
    await expectStatus(403, () => service(state, 'POST', '/profile/pet-name', { pet_name: '콩이' }, teacherToken), 'V13.53 teachers cannot name a student pet');
    const legacyXp = state.sessions.filter(s => s.student_id === petStudent.id).reduce((n, s) => n + Number(s.xp || 0), 0);
    const picked = await service(state, 'GET', '/bootstrap', {}, studentToken);
    assert(!picked.stats.needs_pet_pick && picked.stats.pet.key === 'fox' && picked.stats.pet.name === '콩 이' && picked.stats.pet.xp === legacyXp && picked.stats.pet.form === petForm(picked.stats.pet.level), 'V13.53 the first pet starts with the XP the student already earned');
    const shortBalance = picked.stats.points_balance;
    if (shortBalance < 800) await expectStatus(400, () => service(state, 'POST', '/shop/egg', {}, studentToken), 'V13.53 an egg needs 800 points');
    const shopRecord = { id: 'qa-shop-points', student_id: petStudent.id, division: petStudent.division, school_id: petStudent.school_id, school: petStudent.school, total: 1, correct: 1, xp: 0, reward_points: 800 * 8, created_at: Date.now() - 60000 };
    state.sessions.push(shopRecord);
    const egg = await service(state, 'POST', '/shop/egg', {}, studentToken);
    const afterEgg = await service(state, 'GET', '/bootstrap', {}, studentToken);
    assert(egg.key !== 'fox' && afterEgg.stats.pets.length === 2 && afterEgg.stats.pet.key === egg.key && afterEgg.stats.pet.xp === 0 && afterEgg.stats.pet.form === 0 && afterEgg.stats.points_spent === 800 && afterEgg.stats.points_balance === afterEgg.stats.reward_points - 800, 'V13.53 a random egg brings a new pet as an egg partner and spends 800 points');
    const grownRecord = { id: 'qa-egg-growth', student_id: petStudent.id, division: petStudent.division, school_id: petStudent.school_id, school: petStudent.school, total: 1, correct: 1, xp: 500, pet_key: egg.key, reward_points: 0, created_at: Date.now() - 30000 };
    state.sessions.push(grownRecord);
    const grown = await service(state, 'GET', '/bootstrap', {}, studentToken);
    assert(grown.stats.pet.xp === 500 && grown.stats.pet.form === 1 && grown.stats.pets.find(x => x.key === 'fox').xp === legacyXp, 'V13.53 each pet grows only with the XP earned while it is the partner');
    await service(state, 'POST', '/pets/active', { key: 'fox' }, studentToken);
    for (let i = 2; i < Object.keys(CHARACTERS).length; i++) await service(state, 'POST', '/shop/egg', {}, studentToken);
    const collected = await service(state, 'GET', '/bootstrap', {}, studentToken);
    assert(new Set(collected.stats.pets.map(x => x.key)).size === Object.keys(CHARACTERS).length, 'V13.53 eggs only bring pets the student does not have yet');
    await expectStatus(409, () => service(state, 'POST', '/shop/egg', {}, studentToken), 'V13.53 the shop stops once every pet is collected');
    state.sessions = state.sessions.filter(s => s !== shopRecord && s !== grownRecord);
    const clearedPet = await service(state, 'POST', '/profile/pet-name', { pet_name: '' }, studentToken);
    assert(!('name' in clearedPet.pets.find(x => x.key === clearedPet.avatar_key)), 'V13.53 an empty pet name returns to the default name');

    // Yacha battle rooms: same school and grade, stakes, one open battle, settlement.
    const guestStudent = state.profiles.find(x => x.username === 'qa_student_b');
    const guestToken = highBLogin._cookie;
    const pointsRecord = student => ({ id: 'qa-battle-points-' + student.id, student_id: student.id, division: student.division, school_id: student.school_id, school: student.school, total: 1, correct: 1, xp: 0, reward_points: 1000 + Number(student.points_spent || 0), created_at: Date.now() - 120000 });
    const battlePointRecords = [pointsRecord(petStudent), pointsRecord(guestStudent)];
    state.sessions.push(...battlePointRecords);
    const battleSchool = state.schools.find(s => s.id === petStudent.school_id);
    const battleRange = [...new Set(danwonWords.map(w => String(w.range_code)))].find(code => { try { return scopedWords(state, battleSchool.id, [code], petStudent.class_name).length >= 8; } catch { return false; } });
    assert(battleRange, 'V13.54 release check found a danwon range with enough words for a battle');
    const baseHost = (await service(state, 'GET', '/bootstrap', {}, studentToken)).stats.points_balance;
    const baseGuest = (await service(state, 'GET', '/bootstrap', {}, guestToken)).stats.points_balance;
    await expectStatus(400, () => service(state, 'POST', '/battle/rooms', { stake: 20, range_codes: [battleRange] }, studentToken), 'V13.54 battle stakes are 10, 30 or 50 points');
    await expectStatus(400, () => service(state, 'POST', '/battle/rooms', { stake: 30, range_codes: [] }, studentToken), 'V13.54 a battle needs a word range');
    const room = await service(state, 'POST', '/battle/rooms', { stake: 30, range_codes: [battleRange] }, studentToken);
    assert(/^\d{6}$/.test(room.code) && room.ticket && room._battle?.action === 'init' && room._battle.questions.length >= 8 && room._battle.questions.every(q => q.options.length === 4 && q.answer >= 0 && q.answer < 4 && q.options[q.answer]), 'V13.54 a host opens a room with a 6-digit code and four-choice words');
    await expectStatus(409, () => service(state, 'POST', '/battle/rooms', { stake: 10, range_codes: [battleRange] }, studentToken), 'V13.54 a student has one open battle at a time');
    await expectStatus(409, () => service(state, 'POST', '/battle/join', { code: room.code }, studentToken), 'V13.54 a host cannot join their own room');
    await expectStatus(409, () => service(state, 'POST', '/battle/join', { code: room.code }, guestToken), 'V13.54 joining needs a first pet');
    await service(state, 'POST', '/pets/choose', { key: 'cat' }, guestToken);
    await expectStatus(404, () => service(state, 'POST', '/battle/join', { code: room.code === '999999' ? '999998' : '999999' }, guestToken), 'V13.54 a wrong room code is rejected');
    await expectStatus(404, () => service(state, 'POST', '/battle/join', { code: room.code }, middleLogin._cookie), 'V13.54 only the same school and grade can join, and other rooms look missing');
    await expectStatus(404, () => service(state, 'GET', '/battle/preview', { code: room.code }, middleLogin._cookie), 'V13.54.1 room previews are hidden from other schools and grades');
    const preview = await service(state, 'GET', '/battle/preview', { code: room.code }, guestToken);
    assert(preview.stake === 30 && preview.host === petStudent.display_name && !('ticket' in preview), 'V13.54.1 a classmate sees the stake and host before joining');
    await expectStatus(409, () => service(state, 'POST', '/battle/join', { code: room.code, stake: 10 }, guestToken), 'V13.54.1 joining with a stake the room does not have is refused');
    const joined = await service(state, 'POST', '/battle/join', { code: room.code, stake: 30 }, guestToken);
    assert(joined.id === room.id && joined.ticket && joined.ticket !== room.ticket && joined._battle?.action === 'join' && joined._battle.guest.id === guestStudent.id && joined._battle.guest.pet?.key === 'cat', 'V13.54 a classmate joins with the code and gets their own ticket');
    const current = await service(state, 'GET', '/battle/current', {}, studentToken);
    assert(current.battle?.id === room.id && current.battle.status === 'active' && current.battle.ticket === room.ticket, 'V13.54 a player can find the open battle again after reloading');
    await expectStatus(409, () => service(state, 'POST', '/shop/egg', {}, guestToken), 'V13.54 the egg shop waits until the battle ends');
    const heldHost = (await service(state, 'GET', '/bootstrap', {}, studentToken)).stats;
    const heldGuest = (await service(state, 'GET', '/bootstrap', {}, guestToken)).stats;
    assert(heldHost.points_balance === baseHost - 30 && heldGuest.points_balance === baseGuest - 30 && heldHost.battle.held === 30, 'V13.54.1 both stakes are held while the match is open');
    assert(settleBattle(state, { id: room.id, winner: petStudent.id, loser: guestStudent.id, reason: 'end', hp: {} }) && !settleBattle(state, { id: room.id, winner: guestStudent.id, reason: 'end' }), 'V13.54 a finished match is settled once');
    const afterHost = await service(state, 'GET', '/bootstrap', {}, studentToken);
    const afterGuest = await service(state, 'GET', '/bootstrap', {}, guestToken);
    assert(afterHost.stats.points_balance === baseHost + 30 && afterGuest.stats.points_balance === baseGuest - 30 && afterHost.stats.battle.held === 0 && afterHost.stats.battle.wins === 1 && afterGuest.stats.battle.losses === 1, 'V13.54 the winner takes the stake from the loser');
    const history = await service(state, 'GET', '/battle/history', {}, guestToken);
    assert(history.battles[0]?.outcome === 'lose' && history.lost_today === 30 && history.record.losses === 1, 'V13.54 battle history shows the result and today\'s losses');
    {
      // V13.56 rematch: asked within two minutes, only for the other player, stake shown again.
      const before = state.battles.length;
      const asked = await service(state, 'POST', '/battle/rematch', { battle_id: room.id }, guestToken);
      const rematchRow = state.battles.find(b => b.id === asked.id);
      assert(asked.rematch && /^\d{6}$/.test(asked.code) && rematchRow.invite_id === petStudent.id && rematchRow.rematch_of === room.id && rematchRow.stake === 30 && asked._battle?.action === 'init', 'V13.56 the loser can ask for a rematch with the same stake and words');
      assert((await service(state, 'POST', '/battle/rematch', { battle_id: room.id }, guestToken)).id === asked.id, 'V13.56 asking again returns the same rematch room');
      await expectStatus(409, () => service(state, 'POST', '/battle/rematch', { battle_id: room.id }, studentToken), 'V13.56 the other player accepts the rematch already asked instead of opening a second one');
      const offer = await service(state, 'GET', '/battle/rematch-offer', { battle_id: room.id }, studentToken);
      assert(offer.offer?.code === asked.code && offer.offer.stake === 30 && offer.offer.host === guestStudent.display_name, 'V13.56 the invited player sees the rematch offer with its stake');
      assert((await service(state, 'GET', '/battle/rematch-offer', { battle_id: room.id }, guestToken)).offer === null, 'V13.56 the player who asked sees no offer of their own');
      rematchRow.invite_id = 'qa-someone-else';
      await expectStatus(404, () => service(state, 'POST', '/battle/join', { code: asked.code, stake: 30 }, studentToken), 'V13.56 a rematch room is closed to everyone but the invited player');
      rematchRow.invite_id = petStudent.id;
      const declined = await service(state, 'POST', '/battle/rematch/decline', { battle_id: room.id }, studentToken);
      assert(declined._battle?.action === 'cancel' && declined._battle.reason === 'declined' && rematchRow.status === 'cancelled' && (await service(state, 'GET', '/battle/rematch-offer', { battle_id: room.id }, studentToken)).offer === null, 'V13.56 declining closes the rematch room and tells the room why');
      const again = await service(state, 'POST', '/battle/rematch', { battle_id: room.id }, guestToken);
      const accepted = await service(state, 'POST', '/battle/join', { code: again.code, stake: 30 }, studentToken);
      assert(accepted.id === again.id && state.battles.find(b => b.id === again.id).status === 'active', 'V13.56 the invited player joins the rematch through the normal join (stake checked)');
      settleBattle(state, { id: again.id, winner: petStudent.id, loser: guestStudent.id, reason: 'end', hp: {} });
      const pairRows = [0, 1].map(i => ({ id: 'qa-rematch-' + i, status: 'finished', rematch_of: room.id, host_id: guestStudent.id, invite_id: petStudent.id, guest_id: petStudent.id, winner: petStudent.id, loser: guestStudent.id, stake: 10, created_at: Date.now(), finished_at: Date.now() }));
      state.battles.push(pairRows[0]);
      await expectStatus(409, () => service(state, 'POST', '/battle/rematch', { battle_id: again.id }, guestToken), 'V13.56 the same two students get two rematches a day');
      const expiredRow = state.battles.find(b => b.id === again.id);
      expiredRow.finished_at = Date.now() - 3 * 60000;
      await expectStatus(409, () => service(state, 'POST', '/battle/rematch', { battle_id: again.id }, studentToken), 'V13.56 a rematch can only be asked within two minutes of the end');

      // V13.56 win streaks: wins over the same friend on the same day count once.
      const streakBefore = (await service(state, 'GET', '/battle/history', {}, studentToken)).record;
      assert(streakBefore.streak === 1 && streakBefore.best_streak === 1, 'V13.56 repeated wins over the same friend on one day are one streak win');
      const win = (id, opponent, at) => ({ id, status: 'finished', host_id: petStudent.id, guest_id: opponent, winner: petStudent.id, loser: opponent, stake: 10, created_at: at, finished_at: at });
      state.battles.push(win('qa-win-x', 'qa-opp-x', Date.now() + 1000), win('qa-win-y', 'qa-opp-y', Date.now() + 2000));
      const streaked = await service(state, 'GET', '/battle/history', {}, studentToken);
      assert(streaked.record.streak === 3 && streaked.record.best_streak === 3, 'V13.56 wins over different friends build the streak');
      const styled = await service(state, 'GET', '/bootstrap', {}, studentToken);
      const style = { avatar_key: styled.profile.avatar_key, avatar_accessory: 'none', avatar_frame: 'basic' };
      assert((await service(state, 'POST', '/profile/style', { ...style, avatar_title: 'yacha3' }, studentToken)).avatar_title === 'yacha3', 'V13.56 three streak wins unlock the "야차 3연승" title');
      await expectStatus(400, () => service(state, 'POST', '/profile/style', { ...style, avatar_title: 'yachaking' }, studentToken), 'V13.56 "야차왕" needs a five-win streak');
      state.battles.push({ ...win('qa-loss-z', 'qa-opp-z', Date.now() + 3000), winner: 'qa-opp-z', loser: petStudent.id });
      const broken = (await service(state, 'GET', '/battle/history', {}, studentToken)).record;
      assert(broken.streak === 0 && broken.best_streak === 3, 'V13.56 a loss ends the streak but keeps the best');
      assert(asked._battle.host.streak === 0 && (await service(state, 'POST', '/profile/style', { ...style, avatar_title: 'rookie' }, studentToken)), 'V13.56 the room shows each player\'s current streak');
      const added = new Set([asked.id, again.id, ...pairRows.map(r => r.id), 'qa-win-x', 'qa-win-y', 'qa-loss-z']);
      state.battles = state.battles.filter(b => !added.has(b.id));

      // V13.61 challenges: a room for one classmate, shown on their home screen.
      const friendsOfHost = (await service(state, 'GET', '/battle/friends', {}, studentToken)).friends;
      const middleStudent = state.profiles.find(x => x.role === 'student' && x.division === 'middle');
      assert(friendsOfHost.some(f => f.id === guestStudent.id && !f.busy && f.pet?.key) && !friendsOfHost.some(f => f.id === petStudent.id || f.id === middleStudent?.id) && friendsOfHost.every(f => !('username' in f) && !('password_hash' in f)), 'V13.61 the friend list has only classmates of the same school and grade, without login details');
      await expectStatus(404, () => service(state, 'POST', '/battle/challenge', { friend_id: middleStudent?.id || 'qa-nobody', stake: 10, range_codes: [battleRange] }, studentToken), 'V13.61 a challenge goes only to a classmate of the same school and grade');
      const challenge = await service(state, 'POST', '/battle/challenge', { friend_id: guestStudent.id, stake: 10, range_codes: [battleRange] }, studentToken);
      const challengeRow = state.battles.find(b => b.id === challenge.id);
      assert(challenge.challenge && challenge.friend === guestStudent.display_name && challenge._battle?.action === 'init' && challengeRow.invite_id === guestStudent.id && challengeRow.challenge, 'V13.61 a challenge opens a room for that friend only');
      const invite = (await service(state, 'GET', '/battle/invite', {}, guestToken)).invite;
      const guestBoot = await service(state, 'GET', '/bootstrap', {}, guestToken);
      assert(invite?.id === challenge.id && invite.code === challenge.code && invite.stake === 10 && invite.host === petStudent.display_name && guestBoot.battle_invite?.id === challenge.id, 'V13.61 the friend sees the challenge (poll and home data)');
      assert((await service(state, 'GET', '/battle/invite', {}, studentToken)).invite === null && (await service(state, 'GET', '/battle/current', {}, studentToken)).battle?.friend === guestStudent.display_name, 'V13.61 the sender sees no invite of their own and finds the waiting room with the friend\'s name');
      const refused = await service(state, 'POST', '/battle/invite/decline', { id: challenge.id }, guestToken);
      assert(refused._battle?.action === 'cancel' && refused._battle.reason === 'declined' && challengeRow.status === 'cancelled' && (await service(state, 'GET', '/battle/invite', {}, guestToken)).invite === null, 'V13.61 declining closes the room and tells the sender');
      const second = await service(state, 'POST', '/battle/challenge', { friend_id: guestStudent.id, stake: 10, range_codes: [battleRange] }, studentToken);
      const took = await service(state, 'POST', '/battle/join', { code: second.code, stake: 10 }, guestToken);
      assert(took.id === second.id && state.battles.find(b => b.id === second.id).status === 'active', 'V13.61 accepting a challenge is a normal join with the stake checked');
      settleBattle(state, { id: second.id, reason: 'cancelled' });
      const cappedRows = [0, 1, 2, 3].map(i => ({ id: 'qa-challenge-' + i, status: 'cancelled', challenge: true, host_id: petStudent.id, invite_id: guestStudent.id, guest_id: null, stake: 10, created_at: Date.now() - 1000, finished_at: Date.now() - 500 }));
      state.battles.push(...cappedRows);
      await expectStatus(409, () => service(state, 'POST', '/battle/challenge', { friend_id: guestStudent.id, stake: 10, range_codes: [battleRange] }, studentToken), 'V13.61 one student sends the same friend at most five challenges a day');
      const challengeIds = new Set([challenge.id, second.id, ...cappedRows.map(r => r.id)]);
      state.battles = state.battles.filter(b => !challengeIds.has(b.id));
      assert(state.battles.length === before, 'V13.56 rematch checks leave the battle list as they found it');
    }
    state.battles.push({ id: 'qa-loss-1', status: 'finished', host_id: guestStudent.id, guest_id: petStudent.id, winner: petStudent.id, loser: guestStudent.id, stake: 50, finished_at: Date.now() }, { id: 'qa-loss-2', status: 'finished', host_id: guestStudent.id, guest_id: petStudent.id, winner: petStudent.id, loser: guestStudent.id, stake: 50, finished_at: Date.now() });
    await expectStatus(400, () => service(state, 'POST', '/battle/rooms', { stake: 30, range_codes: [battleRange] }, guestToken), 'V13.54 battles stop once today\'s losses would pass 150 points');
    const cancelRoom = await service(state, 'POST', '/battle/rooms', { stake: 10, range_codes: [battleRange] }, studentToken);
    const cancelled = await service(state, 'POST', `/battle/rooms/${cancelRoom.id}/cancel`, {}, studentToken);
    const afterCancel = await service(state, 'GET', '/battle/current', {}, studentToken);
    assert(cancelled._battle?.action === 'cancel' && afterCancel.battle === null, 'V13.54 a host can cancel a room nobody joined');
    const tidyNow = Date.now();
    state.battles.push(
      { id: 'qa-stale-wait', code: '000001', status: 'waiting', host_id: petStudent.id, guest_id: null, stake: 10, tickets: { x: 'y' }, range_codes: ['1'], created_at: tidyNow - 11 * 60000 },
      { id: 'qa-stale-active', code: '000002', status: 'active', host_id: petStudent.id, guest_id: guestStudent.id, stake: 10, tickets: { x: 'y' }, range_codes: ['1'], created_at: tidyNow - 3 * 3600000, joined_at: tidyNow - 3 * 3600000 },
      { id: 'qa-old-cancel', status: 'cancelled', host_id: petStudent.id, guest_id: null, stake: 10, created_at: tidyNow - 9 * 86400000, finished_at: tidyNow - 8 * 86400000 });
    assert(tidyBattles(state, tidyNow) && state.battles.find(b => b.id === 'qa-stale-wait').status === 'cancelled' && state.battles.find(b => b.id === 'qa-stale-active').status === 'cancelled' && !state.battles.some(b => b.id === 'qa-old-cancel') && state.battles.every(b => ['waiting', 'active'].includes(b.status) || (!b.tickets && (!b.range_codes || (b.status === 'finished' && tidyNow - b.finished_at < 2 * 60000)))), 'V13.54.1 expired rooms close, abandoned matches are called off and finished rows drop tickets (V13.56: ranges stay for the 2-minute rematch window)');
    {
      const later = structuredClone(state.battles);
      tidyBattles({ battles: later }, tidyNow + 3 * 60000);
      assert(later.every(b => ['waiting', 'active'].includes(b.status) || !b.range_codes), 'V13.56 finished rows drop their ranges once the rematch window closes');
    }
    state.battles = state.battles.filter(b => ![room.id, cancelRoom.id, 'qa-loss-1', 'qa-loss-2', 'qa-stale-wait', 'qa-stale-active'].includes(b.id));
    state.sessions = state.sessions.filter(s => !battlePointRecords.includes(s));

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
    {
      const { DANWONGO_TEXTBOOK_PASSAGES } = await import('../public/danwongo-textbook-grammar-data.js');
      const textbookPassage = DANWONGO_TEXTBOOK_PASSAGES[0];
      const saved = await service(state, 'PATCH', '/grammar-progress/' + encodeURIComponent(textbookPassage.id), {
        sentence_count: textbookPassage.sentences.length, choice_count: 23, completed_sentences: 1, active_sentence_index: 1,
        graded_sentences: [0], answers: { '0:1': 'that' }, wrong_keys: [], first_wrong: 0, first_rate: null, recall_attempts: 0, mastered: false
      }, studentToken);
      assert(saved.passage_id === textbookPassage.id && state.grammarProgress[student.id][textbookPassage.id], '단원고 textbook grammar progress saves under its passage id');
    }
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
    await expectStatus(403, () => service(state, 'POST', '/meaning-disputes', {
      source_type: 'exam', source_id: hiddenInternal.id, question_index: 0
    }, studentToken), 'withheld exam cannot be disputed (would reveal grading and the correct meaning)');

    const leakExam = await service(state, 'POST', '/exams', {
      title: 'QA answer leak', class_name: '고1A', school: '단원고', range_codes: [rangeCode], exam_type: 'write_meaning',
      question_count: 2, duration_sec: 300, passing_score: 70, max_attempts: 1,
      available_at: now - 1000, due_at: now + 3600000, release_result: true
    }, teacherToken);
    const leakStarted = await service(state, 'POST', '/exams/start', { exam_id: leakExam.id }, studentToken);
    assert(leakStarted.attempt.questions.every(question => !('word_id' in question)), 'active exam questions do not expose word ids to students');
    const leakInternal = state.examAttempts.find(item => item.id === leakStarted.attempt.id);
    await expectStatus(400, () => service(state, 'POST', `/attempts/${leakInternal.id}/draft`, {
      lease: leakInternal.lease, revision: leakInternal.revision, answers: { '01': 'x' }
    }, studentToken), 'exam draft rejects non-canonical answer keys');
    assert(Object.keys(leakInternal.answers).every(key => String(Number(key)) === key), 'exam answers are stored under canonical keys only');
    await service(state, 'POST', `/attempts/${leakInternal.id}/submit`, {
      lease: leakInternal.lease, revision: leakInternal.revision, answers: {}
    }, studentToken);

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
      const word = allWords.find(item => item.id === wordIdOf(state, started));
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

    // Instant practice: prepared next question + on-device grading data.
    const instant = await service(state, 'POST', '/practice/start', {
      school: '단원고', range_codes: [rangeCode], mode: 'write_meaning', target: 12
    }, studentToken);
    assert(instant.local_check?.meaning && instant.next_preview?.question_id && instant.next_preview.local_check?.meaning, 'practice mode sends on-device grading data and a prepared next question');
    assert(!('word_id' in instant.next_preview.question), 'prepared next question does not expose its word id');
    let instantView = instant;
    let sawRetryPreview = false;
    for (let step = 0; step < 8 && !instantView.finished; step++) {
      const internal = state.practices.find(item => item.id === instant.id);
      const word = allWords.find(item => item.id === internal.question.word_id);
      const wrong = step === 0;
      const answer = wrong ? '__instant_wrong__' : answerFor(instantView.question.type, word);
      assert(grade(instantView.question.type, answer, instantView.local_check) === !wrong, 'on-device grading with local_check matches the server key');
      const expectedNext = instantView.next_preview?.question_id;
      if (instantView.next_preview?.is_retry) sawRetryPreview = true;
      const result = await service(state, 'POST', `/practice/${instant.id}/answer`, { question_id: instantView.question_id, answer, prefetch_next: true }, studentToken);
      assert(result.feedback.ok === !wrong, 'server grading agrees with on-device grading');
      if (expectedNext && !result.prefetched_next.finished) assert(result.prefetched_next.question_id === expectedNext, 'server advances to exactly the prepared next question');
      instantView = result.prefetched_next;
    }
    assert(sawRetryPreview, 'a wrong practice answer comes back as a prepared retry question');
    const instantInternal = state.practices.find(item => item.id === instant.id);
    assert(!instantInternal.retry.some(item => item.id === instantInternal.question.word_id && instantInternal.question_is_retry), 'a retry shown from the prepared question is removed from the retry queue');
    await service(state, 'POST', `/practice/${instant.id}/finish`, {}, studentToken);

    {
      // A word removed from its book while a practice is showing it must still grade.
      const { ybmKimRetiredWords } = await import('./high-vocab-ybm-kim.mjs');
      const retiredPractice = await service(state, 'POST', '/practice/start', { school: '단원고', range_codes: [rangeCode], mode: 'write_meaning', target: 5 }, studentToken);
      const retiredInternal = state.practices.find(item => item.id === retiredPractice.id);
      retiredInternal.question = { ...retiredInternal.question, word_id: ybmKimRetiredWords[0].id };
      const retiredAnswer = await service(state, 'POST', `/practice/${retiredPractice.id}/answer`, { question_id: retiredPractice.question_id, answer: ybmKimRetiredWords[0].meaning }, studentToken);
      assert(retiredAnswer.feedback?.ok === true, 'a practice question whose word was retired from the book can still be answered and graded');
      await service(state, 'POST', `/practice/${retiredPractice.id}/finish`, {}, studentToken);
    }

    const emptyPractice = await service(state, 'POST', '/practice/start', {
      school: '단원고', range_codes: [rangeCode], mode: 'write_meaning', target: 30
    }, studentToken);
    assert(!('word_id' in emptyPractice.question), 'practice question does not expose its word id');
    await expectStatus(405, () => service(state, 'GET', `/practice/${emptyPractice.id}/answer`, { question_id: emptyPractice.question_id, answer: 'x' }, studentToken), 'GET cannot submit a practice answer outside the durable queue');
    await expectStatus(405, () => service(state, 'GET', `/practice/${emptyPractice.id}/finish`, {}, studentToken), 'GET cannot finish a practice outside the durable queue');
    await expectStatus(405, () => service(state, 'GET', '/logout', {}, studentToken), 'GET cannot log out (token removal must be persisted)');
    const emptyFinished = await service(state, 'POST', `/practice/${emptyPractice.id}/finish`, {}, studentToken);
    const emptySession = state.sessions.find(item => item.id === emptyPractice.id);
    assert(emptyFinished.reward_points === 0 && emptySession?.answered_count === 0, 'finishing a practice without answering earns no reward points');

    const testStarted = await service(state, 'POST', '/practice/start', {
      school: '단원고', range_codes: [rangeCode], mode: 'write_meaning', target: 5, run_mode: 'test'
    }, studentToken);
    assert(testStarted.run_mode === 'test' && testStarted.feedback === null && testStarted.score === null, 'test mode hides correctness until final submit');
    assert(testStarted.local_check === undefined && !testStarted.next_preview?.local_check, 'test mode never sends grading data to the device');
    assert(testStarted.next_preview?.question_id && wordIdOf(state, testStarted.next_preview, testStarted.id) !== wordIdOf(state, testStarted), 'test mode prepares a distinct next question before saving the current answer');
    const testInternal = state.practices.find(item => item.id === testStarted.id);
    assert(new Set(testInternal.words).size === testStarted.target, 'test mode selects unique words without repeats');
    await expectStatus(409, () => service(state, 'POST', `/practice/${testStarted.id}/finish`, {}, studentToken), 'test mode blocks early manual finish');
    const testWrongQuestionId = testStarted.question_id;
    const testWrongWordId = wordIdOf(state, testStarted);
    let testView = testStarted;
    let testAnswered = 0;
    while (!testView.finished && testAnswered < 8) {
      const currentWord = allWords.find(item => item.id === wordIdOf(state, testView));
      const answer = testAnswered === 0 ? '__wrong_test_answer__' : answerFor('write_meaning', currentWord);
      const preparedQuestionId = testView.next_preview?.question_id;
      testView = await service(state, 'POST', `/practice/${testStarted.id}/answer`, { question_id: testView.question_id, answer }, studentToken);
      testAnswered += 1;
      if (!testView.finished) assert(testView.question_id === preparedQuestionId, 'test mode returns the exact question shown while the previous answer was saving');
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

    const choiceTest = await service(state, 'POST', '/practice/start', {
      school: '단원고', range_codes: [rangeCode], mode: 'eng2mean', target: 5, run_mode: 'test'
    }, studentToken);
    assert(choiceTest.run_mode === 'test' && choiceTest.mode === 'eng2mean' && choiceTest.feedback === null, 'four-choice can start in real test mode');
    let choiceTestView = choiceTest;
    let choiceAnswered = 0;
    while (!choiceTestView.finished && choiceAnswered < 6) {
      const currentWord = allWords.find(item => item.id === wordIdOf(state, choiceTestView));
      choiceTestView = await service(state, 'POST', `/practice/${choiceTest.id}/answer`, {
        question_id: choiceTestView.question_id, answer: answerFor('eng2mean', currentWord)
      }, studentToken);
      choiceAnswered += 1;
    }
    assert(choiceTestView.finished === true && choiceAnswered === 5 && choiceTestView.score === 100, 'four-choice real test finishes at the requested question count');

    const practiceExam = await service(state, 'POST', '/practice/start', {
      school: '단원고', range_codes: [rangeCode], mode: 'write_meaning', target: 5, run_mode: 'practice', exam_style: true
    }, studentToken);
    const practiceExamInternal = state.practices.find(item => item.id === practiceExam.id);
    assert(practiceExam.exam_style === true && practiceExam.target === 5 && new Set(practiceExamInternal.words).size === 5, 'practice exam style selects a unique first-pass pool just like the real exam');
    let practiceExamView = practiceExam;
    let practiceExamAnswered = 0;
    while (!practiceExamView.finished && practiceExamAnswered < 7) {
      const currentWord = allWords.find(item => item.id === wordIdOf(state, practiceExamView));
      practiceExamView = await service(state, 'POST', `/practice/${practiceExam.id}/answer`, {
        question_id: practiceExamView.question_id,
        answer: practiceExamAnswered === 0 ? '__wrong_exam_style__' : answerFor('write_meaning', currentWord),
        prefetch_next: false
      }, studentToken);
      practiceExamAnswered += 1;
      if (!practiceExamView.finished) practiceExamView = await service(state, 'POST', `/practice/${practiceExam.id}/next`, {}, studentToken);
    }
    const practiceExamSession = state.sessions.find(item => item.id === practiceExam.id);
    assert(practiceExamView.finished === true && practiceExamAnswered === 5, 'exam-style practice finishes exactly at the selected question count even with a wrong answer');
    assert(practiceExamSession?.answer_records?.length === 5 && practiceExamSession?.unanswered_count === 0, 'exam-style practice completion saves all first-pass answers without hidden retry questions');

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
    const noTimerPool = state.practices.find(item => item.id === noTimerPractice.id).words;
    const noTimerReview = reviewWordIds(noTimerSession);
    assert(noTimerSession?.unanswered_count === 4 && noTimerSession.word_ids.length === 4 && noTimerReview.length === 5 && noTimerPool.every(id => noTimerReview.includes(id)), 'early-finished practice keeps every unanswered word so review still covers the whole pool');
    {
      // Records saved before v13.54.2 carry the whole range in word_ids. Trimming them must not
      // change anything a student or teacher sees.
      const range = danwonWords.filter(word => String(word.range_code) === rangeCode).map(word => word.id);
      const answered = range.slice(0, 3);
      const records = answered.map((wordId, index) => ({ question_id: 'q' + index, word_id: wordId, word: 'w', meaning: 'm', answer: index ? 'm' : 'x', timed_out: false, type: 'write_meaning', correct: index > 0, at: 1, regraded: false }));
      const legacy = { id: 'legacy-session', student_id: 'legacy-student', score: 20, total: 10, correct: 2, xp: 55, reward_points: 12, pet_key: 'fox', wrong_count: 1, unanswered_count: 7, answer_records: records, wrong_details: [{ ...records[0] }], word_ids: [...range] };
      const before = structuredClone(legacy);
      assert(range.length > 10 && compactSession(legacy) === true && legacy.word_ids.length === 7, 'old session word_ids shrink to the unanswered words only');
      assert(JSON.stringify(reviewWordIds(legacy)) === JSON.stringify(reviewWordIds(before)), 'trimmed word_ids give the same review list');
      for (const key of ['score', 'total', 'correct', 'xp', 'reward_points', 'pet_key', 'wrong_count', 'unanswered_count', 'answer_records', 'wrong_details']) assert(JSON.stringify(legacy[key]) === JSON.stringify(before[key]), `session compaction keeps ${key}`);
      assert(compactSession(legacy) === false, 'session compaction is idempotent');
      const noRecords = { id: 'older', unanswered_count: 0, word_ids: [...range] };
      const noCount = { id: 'older2', answer_records: [], word_ids: [...range] };
      assert(compactSession(noRecords) === false && compactSession(noCount) === false && noRecords.word_ids.length === range.length && noCount.word_ids.length === range.length, 'sessions without answer_records or counts are left as they are');
      const booted = { ...emptyState(), sessions: [structuredClone(before)] };
      assert(migrateState(booted) === true && booted.sessions[0].word_ids.length === 7, 'boot migration trims existing session word_ids');
      const report = stateSizeReport(state);
      assert(report.keys_kb.sessions > 0 && report.sessions.count === state.sessions.length && report.sessions.word_ids_kb >= 0 && Number.isInteger(report.practices.active), 'health size report lists sizes per state key');
      assert(!JSON.stringify(report).includes(state.profiles.find(item => item.role === 'student').username), 'health size report contains sizes and counts only, never content');
    }
    {
      // v13.55.0 housekeeping runs on a copy so the rest of the check keeps its state.
      const canonical = value => JSON.stringify(value, (key, item) => item && typeof item === 'object' && !Array.isArray(item) ? Object.fromEntries(Object.keys(item).sort().map(k => [k, item[k]])) : item);
      const health = await service(state, 'GET', '/health', {}, null);
      assert(health.version === APP_VERSION && APP_VERSION === JSON.parse(readFileSync(fileURLToPath(new URL('../package.json', import.meta.url)), 'utf8')).version, 'health reports the package version');

      const old = structuredClone(state);
      const now = Date.now();
      const student = old.profiles.find(item => item.username === 'qa_student');
      const mine = old.sessions.filter(item => item.student_id === student.id && Array.isArray(item.answer_records) && item.answer_records.length);
      assert(mine.length > 0, 'the check has saved practice records to compact');
      for (const session of mine) session.created_at = now - COMPACT_SESSION_AFTER_MS - 60000;
      const before = structuredClone(await service(old, 'GET', '/bootstrap', {}, studentToken));
      const sizeBefore = JSON.stringify(old.sessions).length;
      assert(sweep(old, now) === true && JSON.stringify(old.sessions).length < sizeBefore, 'old session answer records are compacted');
      assert(mine.every(session => session.answer_records.every(record => !('regraded' in record && record.regraded === false))), 'false flags are dropped from old records');
      const compacted = JSON.stringify(old.sessions);
      sweep(old, now);
      assert(JSON.stringify(old.sessions) === compacted, 'record compaction is idempotent');
      const after = await service(old, 'GET', '/bootstrap', {}, studentToken);
      assert(canonical(after.sessions) === canonical(before.sessions), 'bootstrap returns the same records after compaction');
      const recent = old.sessions.find(item => item.student_id === student.id && !mine.includes(item) && Array.isArray(item.answer_records) && item.answer_records.length);
      assert(!recent || recent.answer_records.every(record => 'word' in record), 'recent records are left as stored');

      const stale = structuredClone(state);
      const staleStudent = stale.profiles.find(item => item.username === 'qa_student');
      let active = stale.practices.find(item => item.student_id === staleStudent.id && !item.finished);
      if (!active) {
        const started = await service(stale, 'POST', '/practice/start', { school: '단원고', range_codes: [rangeCode], mode: 'write_meaning', target: 5 }, studentToken);
        active = stale.practices.find(item => item.id === started.id);
      }
      if (!active.total) await service(stale, 'POST', `/practice/${active.id}/answer`, { question_id: active.question_id, answer: '__stale__' }, studentToken);
      active = stale.practices.find(item => item.id === active.id);
      const long = now - STALE_PRACTICE_MS - 60000;
      active.started_at = long;
      for (const record of active.answer_records) record.at = long;
      stale.practices.push({ ...structuredClone(active), id: 'qa-stale-empty', total: 0, answer_records: [], wrong_details: [], responses: {} });
      const fresh = { ...structuredClone(active), id: 'qa-fresh-empty', total: 0, answer_records: [], started_at: now - 3600000 };
      stale.practices.push(fresh);
      const pointsBefore = (await service(stale, 'GET', '/battle/history', {}, studentToken)).points_balance;
      assert(sweep(stale, now) === true, 'sweep closes practices untouched for three days');
      assert(stale.practices.find(item => item.id === active.id)?.finished === true && stale.sessions.some(item => item.id === active.id), 'a stale practice with answers is finished into a record');
      assert(!stale.practices.some(item => item.id === 'qa-stale-empty') && !stale.sessions.some(item => item.id === 'qa-stale-empty'), 'a stale practice with no answers is removed without a record');
      assert(stale.practices.some(item => item.id === 'qa-fresh-empty' && !item.finished), 'a practice used within three days is kept');
      assert(Number.isFinite(pointsBefore) && (await service(stale, 'GET', '/battle/history', {}, studentToken)).points_balance >= pointsBefore, 'closing a stale practice never takes points away');
    }

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
    const disputedPracticeWord = allWords.find(item => item.id === wordIdOf(state, meaningPractice));
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
      coveredIds.add(wordIdOf(state, coverView));
      const word = allWords.find(item => item.id === wordIdOf(state, coverView));
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
    const v1328Css = readFileSync(publicRoot + 'v1328.css', 'utf8');
    const v1329Css = readFileSync(publicRoot + 'v1329.css', 'utf8');
    const v1330Css = readFileSync(publicRoot + 'v1330.css', 'utf8');
    const uiModule = readFileSync(publicRoot + 'modules/ui.js', 'utf8');
    const studentModule = readFileSync(publicRoot + 'modules/student.js', 'utf8');
    const coreModule = readFileSync(publicRoot + 'modules/core.js', 'utf8');
    const sessionsModule = readFileSync(publicRoot + 'modules/sessions.js', 'utf8');
    const practiceEnhancements = readFileSync(publicRoot + 'practice-enhancements.js', 'utf8');
    const appJs = readFileSync(publicRoot + 'app.js', 'utf8');
    assert(appJs.includes('if (d.middleWordAll)') && appJs.includes("input.dataset.middleWord !== undefined"), 'middle-school direct selection supports individual and all/clear controls');
    assert(!appJs.includes('if (d.middleStartPicker)') && !appJs.includes('if (d.middleChunkSize)') && !appJs.includes('if (d.middleRangeMove)'), 'legacy middle-school range handlers are removed');
    const bootSource = readFileSync(fileURLToPath(new URL('./boot.mjs', import.meta.url)), 'utf8');
    const buildAssetsSource = readFileSync(fileURLToPath(new URL('./build-assets.mjs', import.meta.url)), 'utf8');
    const serverIndexSource = readFileSync(fileURLToPath(new URL('./index.mjs', import.meta.url)), 'utf8');
    assert(manifest.display === 'standalone' && manifest.start_url === '/', 'PWA manifest is installable');
    assert(teacherModule.includes('TODAY CONTROL') && teacherModule.includes('오늘 확인 필요') && teacherModule.includes('많이 틀린 어법 포인트'), 'V13.6 teacher operations dashboard is present');
    assert(teacherModule.includes('grammar_progress') && teacherModule.includes('학생이 보낸 실전 결과'), 'teacher dashboard combines grammar progress with student-shared self-test results');
    assert(bundleCss.includes('.v136-dashboard-grid') && !indexHtml.includes('teacher-dashboard.js'), 'dashboard styles are bundled and stale missing module is removed');
    assert(dashboardCss.includes('.v136-dashboard-grid') && dashboardCss.includes('@media(max-width:760px)'), 'teacher dashboard has responsive styles');
    assert(v137Css.includes('.exam-ops-table') && v137Css.includes('.word-conquest-card') && bundleCss.includes('.exam-ops-table'), 'V13.7 teacher proportions and word quest styles are bundled');
    assert(teacherModule.includes('data-exam-edit') && teacherModule.includes('data-exam-status') && teacherModule.includes('data-exam-menu'), 'teacher exam list exposes edit status and operations');
    assert(teacherModule.includes('data-meaning-alias') && appJs.includes('meaningAliasModal'), 'teacher can manage accepted meaning aliases');
    assert(studentModule.includes('깨야 할 퀘스트') && studentModule.includes('WORD MASTER') && studentModule.includes('PERFECT MASTER'), 'student word mastery quest labels are present');
    assert(!appJs.includes("id=\"account-school\"") && studentModule.includes('선생님 관리'), 'student self-service school change is removed');
    assert(v138Css.includes('.division-segment') && v138Css.includes('.dispute-card') && bundleCss.includes('.division-segment'), 'V13.8 division and dispute styles are bundled');
    assert(appJs.includes('data-division="middle"') && appJs.includes('/teacher/division') && appJs.includes('login.profile?.role'), 'login auto-detects role while teacher controls separate middle and high divisions');
    assert(appJs.includes("$('[data-signup-division]').forEach"), 'signup division buttons use the multi-node helper so the signup form remains interactive');
    assert(teacherModule.includes('뜻 이의제기') && teacherModule.includes('data-dispute-global') && teacherModule.includes('data-dispute-once'), 'teacher meaning-dispute inbox is present');
    assert(sessionsModule.includes('이 답도 맞는 것 같아요') && sessionsModule.includes('/meaning-disputes'), 'meaning-writing student dispute buttons are present');
    assert(v139Css.includes('.rank-scope') && v139Css.includes('.my-rank-card') && bundleCss.includes('.rank-scope'), 'V13.9 academy ranking styles are bundled');
    assert(studentModule.includes("['all','전체']") && studentModule.includes("['중2','중2']") && studentModule.includes("['중3','중3']") && studentModule.includes("['고1','고1']"), 'student ranking exposes overall middle2 middle3 and high1 filters');
    assert(appJs.includes('d.rankScope') && studentModule.includes('SUMUS 랭킹'), 'V13.9 ranking interactions remain active');
    assert(v1310Css.includes('.today-word-quest') && v1310Css.includes('.today-word-start') && bundleCss.includes('.today-word-quest'), 'V13.10 simplified home styles are bundled');
    assert(studentModule.includes('오늘의 단어 퀘스트') && studentModule.includes('data-quick-practice') && !studentModule.includes('<h2>오늘의 한 걸음</h2>'), 'V13.10 merges duplicate vocabulary home cards');
    assert(appJs.includes('d.quickPractice') && appJs.includes("A.mode = 'write_meaning'") && appJs.includes('A.target = 20'), 'V13.10 home starts a 20-question meaning-writing quest directly');
    assert(studentModule.includes('오늘의 단어 퀘스트') && studentModule.includes('data-quick-practice') && !studentModule.includes('<h2>오늘의 한 걸음</h2>'), 'V13.10 simplified home remains active');
    assert(v1311Css.includes('.meaning-alias.auto') && bundleCss.includes('.meaning-alias.auto'), 'V13.11 valid-answer teacher styles are bundled');
    assert(teacherModule.includes('기본 유효답과 승인된 허용 뜻의 출처') && teacherModule.includes('approved_auto'), 'teacher UI keeps part-of-speech safe valid-answer workflow');
    assert(v1313Css.includes('.meaning-alias-row') && v1313Css.includes('.vocab-import-preview') && bundleCss.includes('.vocab-import-preview'), 'V13.13 vocabulary management styles are bundled');
    assert(studentModule.includes('최근 성취') && studentModule.includes('daily_quest') && studentModule.includes('오답 ${mix.wrong'), 'V13.13 student UI exposes recent mastery and adaptive daily mix');
    assert(sessionsModule.includes('daily_quest: true') && appJs.includes('d.quickPractice'), 'adaptive daily quest still starts through the practice session flow');
    assert(teacherModule.includes('단어 파일 등록') && teacherModule.includes('meaning_alias_meta') && teacherModule.includes('학생 이의제기'), 'V13.13 teacher vocabulary UI exposes import and alias provenance');
    assert(appJs.includes('/vocab-import/preview') && appJs.includes('/vocab-import/commit') && appJs.includes('data-alias-remove'), 'V13.13 teacher UI supports previewed import and single-alias deletion');
    assert(practiceEnhancements.includes('sumusCalmFeedback') && !practiceEnhancements.includes('floatGain(feedback); celebrateCorrect(session, feedback)'), 'calm practice feedback layer remains active');
    assert(indexHtml.includes('/app.js?v=13.62.0') && indexHtml.includes('/app.bundle.css?v=13.62.0') && sw.includes('"/app.bundle.css"') && /const ASSET_HASH = '[0-9a-f]{16}';/.test(sw), 'V13.50 page version and a build-generated service worker asset hash are active');
    {
      const precache = JSON.parse(sw.match(/const PRECACHE = (\[.*\]);/)[1]);
      assert(precache.includes('/') && !precache.includes('/index.html') && sw.includes("caches.match('/', { cacheName: CACHE })") && sw.includes('!cached.redirected'), 'page is precached as / (Cloudflare redirects /index.html; a redirected response cannot answer a navigation)');
      const staticModules = ['/', '/app.js', '/pwa.js', '/boot-guard.js', '/app.bundle.css', ...readdirSync(publicRoot + 'modules').filter(name => name.endsWith('.js')).map(name => '/modules/' + name)];
      assert(staticModules.every(url => precache.includes(url)), 'service worker precaches every file needed to open the app: ' + staticModules.filter(url => !precache.includes(url)).join(', '));
      assert(!/self\.skipWaiting\(\);\s*\}\)\(\)\)/.test(sw) && sw.includes("event.data?.type === 'SKIP_WAITING'"), 'a new service worker waits until the page decides it is safe to switch');
    }
    assert(!appJs.includes("await api('/session')"), 'app start fetches bootstrap directly instead of a separate /session round trip');
    assert(!indexHtml.includes('/teacher-enhancements.js') && !indexHtml.includes('/exam-ops.js') && !indexHtml.includes('/student-enhancements.js') && !indexHtml.includes('/practice-enhancements.js') && !indexHtml.includes('/signup-ui.js'), 'noncritical role modules are removed from eager boot');
    assert(!/<script(?![^>]*\bsrc=)[^>]*>/.test(indexHtml) && !/\son[a-z]+=/.test(indexHtml) && indexHtml.includes('/boot-guard.js'), 'index.html has no inline scripts or handlers (CSP script-src self would block them)');
    assert(appJs.includes("import('./teacher-enhancements.js')") && appJs.includes("import('./student-enhancements.js')") && appJs.includes("ensureRoleEnhancements"), 'teacher and student enhancements load only for the active role');
    assert(!studentModule.includes('danwongo-grammar-data.js') && !studentModule.includes('seonbu-grammar-data.js') && appJs.includes('ensureGrammarData') && !/^import [^;]*grammar-data\.js/m.test(teacherModule), 'large grammar datasets are lazy-loaded (no static import in student or teacher modules)');
    {
      const { readdirSync } = await import('node:fs');
      const walk = dir => readdirSync(dir, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? walk(dir + entry.name + '/') : entry.name.endsWith('.js') ? [dir + entry.name] : []);
      const versioned = walk(publicRoot).filter(file => /(?:from\s*|import\()\s*['"]\.{1,2}\/[^'"]+\?v=/.test(readFileSync(file, 'utf8')));
      assert(versioned.length === 0, 'internal module imports have one URL each (no ?v= query that loads a module twice): ' + versioned.join(', '));
    }
    assert(!sw.includes('"/danwongo-grammar-data.js"') && !sw.includes('"/teacher-enhancements.js"') && !sw.includes('"/exam-ops.js"'), 'service worker precache excludes teacher tools and grammar data (cached on first use)');
    assert(sessionsModule.includes("prefetch_next: x.run_mode !== 'test'"), 'practice answers prefetch the next question for faster transitions');
    assert(indexHtml.match(/rel="stylesheet"/g)?.length === 1 && indexHtml.includes('/app.bundle.css?v=13.62.0'), 'browser loads one production stylesheet instead of layered CSS requests');
    assert(sw.includes('"/app.bundle.css"') && !sw.includes('"/v1341.css"'), 'service worker precaches the CSS bundle instead of legacy style layers');
    assert(uiModule.includes("const attempts = requestMethod === 'GET' ? 2 : 1"), 'transient GET requests retry once for reconnect stability');
    assert(sessionsModule.includes('if (!firstError?.transient) throw firstError') && sessionsModule.includes('await new Promise(resolve => setTimeout(resolve, 260))'), 'practice answer retries once after a transient network failure');
    assert(bootSource.includes("RUN_RELEASE_CHECK_ON_BOOT === 'true'") && !bootSource.includes('await runReleaseCheck();\nawait import'), 'normal server startup does not execute the full release suite');
    assert(buildAssetsSource.includes("process.env.NODE_ENV !== 'production'") && buildAssetsSource.includes('production runtime validation skipped'), 'production cold start skips redundant syntax validation while still building assets');
    assert(serverIndexSource.includes('hasExpiredExam') && serverIndexSource.includes('maintenanceTimer') && serverIndexSource.includes('60000'), 'background sweep avoids full-state cloning every five seconds when idle');
    assert(sessionsModule.includes('selectedHighRanges') && sessionsModule.includes("A.highRangeType === 'textbook'"), 'high-school self-tests isolate mock-exam and textbook ranges');
    assert(appJs.includes("const liveTabs = A.data.profile.role === 'teacher'") && !appJs.includes("['home', 'exam', 'ranking', 'dashboard', 'exams', 'results']"), 'background polling no longer rerenders the student exam setup');
    assert(!appJs.includes("if (!['write_meaning','spell'].includes(A.mode)) A.practiceRunMode = 'practice'"), 'four-choice selection no longer downgrades real test mode');
    assert(v1325Css.includes('--sumus-primary') && v1325Css.includes('grid-template-columns:repeat(5') && v1325Css.includes('memorize-flip-in'), 'V13.25 green design system, balanced bottom navigation, and memorization motion are loaded');
    assert(v1326Css.includes('.home-focus-v1326') && v1326Css.includes('.rank-filter-bar') && v1326Css.includes('.pwa-install-hint'), 'V13.30 home, ranking, and PWA polish styles are loaded');
    assert(v1327Css.includes('.home-pet-hero') && v1327Css.includes('.record-summary-v1327') && v1327Css.includes('.auth-card-v1327'), 'V13.30 student home, records, and login polish styles are loaded');
    assert(v1328Css.includes('.home-pet-art .avatar') && v1328Css.includes('.exam-question-area') && v1328Css.includes('.teacher-division-switch'), 'V13.30 mobile ratio and teacher division switch styles are loaded');
    assert(v1329Css.includes('.auth-v1327') && v1329Css.includes('box-sizing:border-box') && indexSource.includes('/sumus-logo-green.svg'), 'V13.30 green login shell and logo are loaded');
    assert(v1330Css.includes('.pet-choice-grid') && v1330Css.includes('.auth-hero-v1330'), 'V13.30 cute pet onboarding styles are loaded');
    assert(coreModule.includes("dog:") && coreModule.includes("pig:") && coreModule.includes("cat:") && coreModule.includes("dragon:") && coreModule.includes("panda:") && coreModule.includes("snake:"), 'V13.30 six pet partners are registered');
    const petFile = name => existsSync(fileURLToPath(new URL('../public/assets/pets/' + name, import.meta.url)));
    const missingPetArt = Object.keys(CHARACTERS).flatMap(key => [0, 1, 2, 3].flatMap(form => [`${key}-${form}.webp`, `${key}-${form}-s.webp`])).filter(name => !petFile(name));
    assert(!missingPetArt.length, `V13.53 every pet has egg and three evolution sprites plus small copies${missingPetArt.length ? ' (missing: ' + missingPetArt.join(', ') + ')' : ''}`);
    assert(PET_FORM_LEVELS.join() === '1,3,10,20' && levelInfo(0).form === 0 && petForm(3) === 1 && petForm(10) === 2 && petForm(20) === 3 && levelInfo(0).stage === 1, 'V13.53 pet hatches at Lv.3, grows at Lv.10 and reaches its final form at Lv.20 (legacy stage kept)');
    assert(!sw.includes('/assets/pets/') && sw.includes('"/modules/pet-moments.js"'), 'V13.53 pet images are cached on first use, not precached, and the moments module is precached');
    assert(studentModule.includes('partner-card-v1358') && studentModule.includes('home-week-days') && studentModule.includes('data-rank-scope-select') && !studentModule.includes('같이 올라가면 더 재밌다.'), 'V13.30 home is pet-and-growth focused and ranking filters are compact');
    assert(appJs.includes('rankScopeSelect') && appJs.includes('missingCount') && appJs.includes('session.word_ids'), 'V13.30 compact rank filters and complete review flow are wired');

    assert(studentModule.includes('partner-shop') && studentModule.includes('포인트') && studentModule.includes('XP ') && sessionsModule.includes('result-reward-card'), 'V13.30 separates XP, reward points, and achievements in the student UX');
    assert(appJs.includes('memorize-flip-out') && appJs.includes('memorize-flip-in'), 'V13.25 vocabulary tap uses a short flip and fade transition');
    assert(v1315Css.includes('.primary-mode-grid') && studentModule.includes('영어 직접 쓰기') && studentModule.includes('data-practice-record'), 'meaning and English writing remain first-class scored modes');
    assert(studentModule.includes('function records(A)') && studentModule.includes('이번 주 평균') && !sessionsModule.includes('${timerHtml}'), 'student home and record summaries remain available while visible question timer is removed');
    assert(teacherModule.includes('학생별 연습 기록') && teacherModule.includes('학생이 보낸 실전 결과') && teacherModule.includes('data-practice-record') && appJs.includes('openPracticeRecord'), 'teacher can inspect practice history and student-shared real-test results');
    assert(studentModule.includes('첫 100점') && studentModule.includes('3회 연속 90점+') && studentModule.includes('영어쓰기 100점') && studentModule.includes('achievementSection'), 'student achievement badges remain present');
    assert(studentModule.includes("result_visibility === 'visible'") && studentModule.includes("filter(Number.isFinite)") && studentModule.includes("'공개 대기'"), 'legacy assigned-exam visibility remains safe in historical records');
    assert(teacherModule.includes('sharedSelfTests') && teacherModule.includes('shared_to_teacher_at') && teacherModule.includes('학생이 보낸 실전 결과'), 'teacher dashboard is centered on student-shared real-test results');
    assert(uiModule.includes('recordRangeLabel') && studentModule.includes('recordRangeLabel(s, code)') && sessionsModule.includes('recordRangeLabel'), 'middle and high range labels stay consistent');
    assert(sessionsModule.includes('미응답') && sessionsModule.includes('data-finish-practice-dispute'), 'saved exam results separate unanswered answers and keep meaning disputes');
    assert(sessionsModule.includes('이미 진행 중인 학습이 있어요') && sessionsModule.includes('기존 연습 저장 후 새 설정 시작'), 'active session mismatch still warns before reuse');
    assert(appJs.includes('examFormDirty') && appJs.includes('contextGeneration') && appJs.includes('작성 취소 후 전환'), 'teacher context switch still protects dirty forms and stale responses');
    assert(studentModule.includes('partner-card-v1358') && studentModule.includes('partner-shop') && studentModule.includes('home-week-card'), 'student home centers pet, points, and weekly attendance');
    {
      const home = studentModule.slice(studentModule.indexOf('const CARD_FINISH'), studentModule.indexOf('function homeSchedule('));
      const appSource = readFileSync(fileURLToPath(new URL('../public/app.js', import.meta.url)), 'utf8');
      const cardCss = readFileSync(fileURLToPath(new URL('../public/v1358.css', import.meta.url)), 'utf8');
      assert(home.includes("['plain', 'plain', 'silver', 'holo']") && cardCss.includes('.finish-silver .partner-sheen') && cardCss.includes('.finish-holo .partner-sheen'), 'V13.58 the partner card finish follows growth (plain, silver, holo)');
      assert(home.includes('data-action="partner-flip"') && appSource.includes("d.action === 'partner-flip'") && home.includes('야차전 기록') && home.includes('best_streak'), 'V13.58 tapping the partner card flips it to the yacha record');
      assert(['data-action="egg-shop"', 'data-go="studio"', 'data-action="pet-name"'].every(entry => home.includes(entry)), 'V13.58 the home keeps the egg shop, my pets and pet name entries');
      {
        const growth = studentModule.slice(studentModule.indexOf('function compactGrowth('), studentModule.indexOf('function homeSchedule('));
        const tabs = studentModule.slice(studentModule.indexOf('export const studentTabs'), studentModule.indexOf('export function shell('));
        assert(!growth.includes('home-trio-v1358') && !growth.includes('home-metrics-v1358') && !studentModule.includes('recentRecordCard') && growth.includes('home-next-v1358') && growth.includes('home-week-v1358') && growth.includes('today_xp'), 'V13.59 the home shows only the card, the next-step button and the week (no repeated shortcuts)');
        assert(tabs.includes("['home', '홈', 'home'], ['practice', '학습', 'practice'], ['exam', '시험', 'exam'], ['ranking', '랭킹', 'ranking'], ['records', '기록', 'records']") && !studentModule.includes('battleTab'), 'V13.60 the bottom menu is back to home, study, exams, ranking, records');
        assert(growth.includes('${yachaBanner(A)}') && studentModule.includes('class="home-yacha-v1360" data-action="battle"') && growth.indexOf('home-next-v1358') < growth.indexOf('${yachaBanner(A)}'), 'V13.60 the home has a big yacha banner under the next-step button');
        const css1360 = readFileSync(fileURLToPath(new URL('../public/v1360.css', import.meta.url)), 'utf8');
        assert(growth.includes('home-stack-v1360') && css1360.includes('.home-stack-v1360{display:flex;flex-direction:column;gap:16px}') && css1360.includes('env(safe-area-inset-bottom'), 'V13.60 home sections are spaced and the last one clears the bottom menu and home bar');
        const battleUi = readFileSync(fileURLToPath(new URL('../public/modules/battle.js', import.meta.url)), 'utf8');
        const appUi = readFileSync(fileURLToPath(new URL('../public/app.js', import.meta.url)), 'utf8');
        assert(battleUi.includes('data-yb="challenge"') && battleUi.includes("api('/battle/challenge'") && battleUi.includes('function acceptChallenge(') && battleUi.includes('B.room.challenge'), 'V13.61 the yacha lobby sends a challenge to a picked friend and waits for them');
        assert(studentModule.includes('data-action="battle-accept"') && studentModule.includes('data-action="battle-decline"') && appUi.includes("api('/battle/invite')") && appUi.includes('}, 20000);') && appUi.includes('openBattle(A, leaveBattle, { accept: invite })'), 'V13.61 a challenge shows on the home banner (checked every 20 seconds) and opens the stake check when accepted');
        const css1362 = readFileSync(fileURLToPath(new URL('../public/v1362.css', import.meta.url)), 'utf8');
        assert(['.partner-art .avatar-art img', '.studio-preview .avatar-art img', '.yb-hero-pet .avatar-art img', '.yb-pet .avatar-art img'].every(sel => css1362.includes(sel)) && css1362.includes('@keyframes petBreath') && css1362.includes('@keyframes petHop') && !/@keyframes pet(Breath|Hop)\{[^@]*transform:/.test(css1362), 'V13.62 pets breathe and hop on the home card, My pets and yacha, using scale/translate so card and arena transforms still apply');
        assert(appUi.includes("event.target.closest('.partner-art')") && appUi.includes('function pokePet(') && css1362.includes('.partner-art.poke') && css1362.includes('prefers-reduced-motion'), 'V13.62 tapping the pet on the card makes it jump with hearts (off with reduced motion); the rest of the card still flips');
      }
      assert(cardCss.includes('prefers-reduced-motion') && appSource.includes("matchMedia('(prefers-reduced-motion: reduce)')"), 'V13.58 the card does not tilt when reduced motion is on');
      {
        const { rangeLabel, scope } = await import('../public/modules/ui.js');
        assert(rangeLabel('단원고', 'L1') === '1과' && rangeLabel('강서고', 'L12') === '12과' && rangeLabel('단원고', '5') === '5번' && rangeLabel('선부고', '3') === '외부 3' && scope({ school: '단원고', division: 'high', range_codes: ['L1', 'L2'] }) === '1과 · 2과', 'V13.62.0 textbook lesson ranges read "1과", not "L1번"');
        assert(studentModule.includes('rangeLabel(A.school, next.range_code)') && !studentModule.includes('${next.range_code}번'), 'V13.62.0 the home word quest uses the same range label');
      }
    }
    assert(v1320Css.includes('.home-focus-card') && v1320Css.includes('.setup-start-summary') && v1320Css.includes('.result-page-v1320'), 'base responsive student UX styles remain loaded');

    const studyHubSource = studentModule.slice(studentModule.indexOf('function studyHub'), studentModule.indexOf('function grammarCards'));
    assert(studyHubSource.includes('단어 학습') && studyHubSource.includes('어법·어휘') && studyHubSource.includes('study-hub-simple') && !studyHubSource.includes('추천 학습 흐름') && !studyHubSource.includes('영어↔뜻, 철자'), 'V13.22 learning home contains only clean vocabulary and grammar choices');
    const memorizationSource = studentModule.slice(studentModule.indexOf('function memorizationPanel'), studentModule.indexOf('function durationText'));
    assert(memorizationSource.includes('data-memorize-word') && memorizationSource.includes('data-memorize-star') && memorizationSource.includes('data-memorize-speak') && memorizationSource.includes('front = show ? word.meaning : word.word'), 'V13.22 vocabulary rows swap English and meaning in place and expose pronunciation');
    assert(appJs.includes('SpeechSynthesisUtterance') && appJs.includes('d.memorizeSpeak'), 'V13.22 memorization has one-tap English pronunciation');
    assert(studentModule.includes("['exam', '시험'") && studentModule.includes('data-exam-kind="practice"') && studentModule.includes('data-exam-kind="test"') && studentModule.includes('연습시험') && studentModule.includes('실전시험'), 'V13.22 bottom Exam menu lets students choose practice or real exam');
    assert(studentModule.includes('data-action="start-exam-run"') && !studentModule.includes('다음 문제마다 시간이 다시 시작돼요') && appJs.includes('examStyle: true'), 'V13.30 both exam modes share the same untimed exam-style word pool');
    assert(!studentModule.includes('function middleVocabQuiz') && !studentModule.includes('function vocabQuiz') && !studentModule.includes('function practiceModePicker'), 'V13.22 removes the old duplicate vocabulary quiz path from Learning');
    assert(sessionsModule.includes("const modeLabel = testMode ? '실전시험' : '연습시험'") && !sessionsModule.includes('${timerHtml}') && sessionsModule.includes('keyboard-focus'), 'V13.30 practice and real exams share one focused untimed question screen with keyboard handling');
    assert(sessionsModule.includes('answer-impact-compact') && sessionsModule.includes('result-reward-top') && sessionsModule.includes('missingWordIds'), 'V13.30 keeps calm answer feedback and complete result review');
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

    let loadRevision = 0;
    let loadWrites = 0;
    let loadState = structuredClone(state);
    const loadRepository = {
      async read() { return { state: structuredClone(loadState), revision: loadRevision }; },
      async commit(nextState, revision) {
        if (revision !== loadRevision) throw Object.assign(Error('revision conflict'), { status: 409 });
        loadState = structuredClone(nextState);
        loadRevision += 1;
        loadWrites += 1;
      }
    };
    const loadCoordinator = createMutationCoordinator(loadRepository, { state: structuredClone(state), revision: 0 }, { flushDelay: 500 });
    const loadResults = await Promise.all(Array.from({ length: 20 }, (_, index) => loadCoordinator.fast(nextState => {
      nextState.mastery ??= {};
      nextState.mastery['qa-load-' + index] = { marker: index, recent_results: [{ ok: true, at: Date.now() }] };
      return index;
    })));
    assert(loadResults.length === 20 && loadResults.every((value, index) => value === index), '20 concurrent student-like mutations complete without dropped responses');
    await loadCoordinator.flush();
    assert(Array.from({ length: 20 }, (_, index) => loadState.mastery?.['qa-load-' + index]?.marker).every((value, index) => value === index), '20 concurrent student-like mutations are preserved in durable state');
    assert(loadWrites === 1, '20 concurrent student-like mutations batch into one persistence checkpoint');
    await loadCoordinator.close();

    let recoveryState = { counter: 0 };
    let recoveryRevision = 0;
    let rejectCheckpoint = true;
    const recoveryRepository = {
      async read() { return { state: structuredClone(recoveryState), revision: recoveryRevision }; },
      async refresh() { return this.read(); },
      async commit(nextState, revision) {
        await new Promise(resolve => setTimeout(resolve, 20));
        if (rejectCheckpoint) {
          rejectCheckpoint = false;
          throw Object.assign(Error('temporary save failure'), { status: 503 });
        }
        assert(revision === recoveryRevision, 'recovered checkpoint uses the current revision');
        recoveryState = structuredClone(nextState);
        recoveryRevision += 1;
      }
    };
    const recovering = createMutationCoordinator(recoveryRepository, { state: { counter: 0 }, revision: 0 }, { rollbackOnFailure: true });
    const failedBatch = await Promise.allSettled(Array.from({ length: 20 }, () => recovering.durable(nextState => ++nextState.counter)));
    assert(failedBatch.every(item => item.status === 'rejected'), 'failed checkpoint rejects every concurrent save response');
    assert(recovering.current().state.counter === 0 && recoveryState.counter === 0, 'failed concurrent mutations roll back from memory and storage');
    const recoveredBatch = await Promise.all(Array.from({ length: 20 }, () => recovering.durable(nextState => ++nextState.counter)));
    assert(recoveredBatch.at(-1) === 20 && recovering.current().state.counter === 20 && recoveryState.counter === 20, '20 concurrent retries persist once after recovery');
    await recovering.close();

    runBattleChecks(assert);

    console.log(`[release-check] PASS ${checks.length}/${checks.length}`);
    return { ok: true, count: checks.length };
  } finally {
    if (priorAuthProvider === undefined) delete process.env.AUTH_PROVIDER;
    else process.env.AUTH_PROVIDER = priorAuthProvider;
  }
}
