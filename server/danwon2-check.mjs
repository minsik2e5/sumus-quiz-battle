// V13.247 새 학교 단원고2(단원고 2학년, 반은 고2 한 반) + 기말고사 단어장(2026년 9월 고2 모의고사 15지문 572단어) 검사.
// - 학교: 새 state · 옛 state(운영)에 단원고2가 더해지고, 선생님이 고를 수 있다. 학생 데이터는 옮기지 않는다.
// - 책: 572단어 · 문항별 수 · 단어표와 같음 · id가 기존과 겹치지 않음.
// - 단원고2 학생은 이 책만, 단원고 · 선부고 · 강서고 · 원일중 학생은 전(V13.246.0)과 똑같은 책 · 범위 · 단어 id.
// - 반 목록: 단원고2만 고2, 다른 학교는 그대로(가입 코드 · 등록 · 반 옮기기 · 미리보기 · 시험 · 과제 · 대회 · 교실 게임).
// - 단원고2 학생끼리 야차전 범위가 잡히고, 고1과는 학년이 달라 붙지 않는다.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { emptyState, migrateState, DEFAULT_SCHOOLS } from './state.mjs';
import { passwordHash } from './auth.mjs';
import { service, allBooks, scopedWords, settleBattle } from './service.mjs';
import { selfSignup, signupCodeRows } from './signup.mjs';
import { rankGrade, gradeOf, sameGradeBand } from './competition.mjs';
import { danwon2SepMockBook, DANWON2_SEP_MOCK_BOOK_ID, DANWON2_SEP_MOCK_COUNTS } from './danwon2-sep-mock.mjs';
import { schoolClasses, schoolGrades, gradeTargets } from '../public/modules/school-classes.js';

const source = path => readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8');
const COUNTS = { 21: 39, 22: 29, 23: 34, 24: 43, 29: 30, 30: 36, 32: 38, 33: 47, 34: 39, 35: 42, 36: 39, 37: 44, 38: 38, 39: 30, 40: 44 };
// 단원고2를 넣기 전(V13.246.0) 학생 화면 책 · 범위 · 단어 수. 바뀌면 안 된다.
const BEFORE = [['danwon-high', '고1A', 6, 27, 1273], ['danwon-high', '고1B', 6, 27, 1273], ['seonbu-high', '고1A', 5, 28, 1059], ['gangseo-high', '고1B', 6, 26, 1131], ['wonil-middle', '중2', 3, 3, 194], ['wonil-middle', '중3', 3, 3, 212]];

export async function runDanwon2Checks(assert, expectStatus) {
  /* ---------- 책 ---------- */
  const book = danwon2SepMockBook, words = book.words;
  assert(book.id === DANWON2_SEP_MOCK_BOOK_ID && book.id === 'danwon2:final:mock-sep-2026' && book.school_id === 'danwon-high-2' && book.school === '단원고2' && book.division === 'high' && book.grade === '고2' && book.exam_period === 'final' && book.mock === true,
    'V13.247 단원고2 9월 모의고사 책: 단원고2 · 고등부 · 기말고사 · 모의고사 · 학년 고2');
  assert(words.length === 572 && Object.values(COUNTS).reduce((a, b) => a + b, 0) === 572, 'V13.247 단원고2 9월 고2 모의고사 572단어');
  assert(Object.entries(COUNTS).every(([q, n]) => words.filter(w => w.range_code === `9월 ${q}` && w.source_question === `${q}번`).length === n) && new Set(words.map(w => w.range_code)).size === 15
    && Object.entries(COUNTS).every(([q, n]) => DANWON2_SEP_MOCK_COUNTS[q] === n), 'V13.247 15지문(21~24 · 29 · 30 · 32~40번) 문항별 단어 수가 단어표와 같다');
  assert(words.every(w => /^dw2_sep_\d{2}_\d{2}$/.test(w.id) && w.book_id === book.id && w.word && w.meaning && w.source === '2026년 9월 고2 모의고사' && w.grade === '고2'), 'V13.247 단원고2 단어는 모두 id(dw2_sep_) · 단어 · 뜻 · 출처 · 문항이 있다');
  const runtime = allBooks({ extraBooks: [] });
  const otherIds = new Set(runtime.filter(b => b.id !== book.id).flatMap(b => b.words || []).map(w => w.id));
  assert(new Set(words.map(w => w.id)).size === 572 && words.every(w => !otherIds.has(w.id)) && runtime.filter(b => b.id === book.id).length === 1 && runtime.filter(b => b.school_id === 'danwon-high-2').length === 1,
    'V13.247 단원고2 단어 id는 서로 · 기존 책과 겹치지 않고, 단원고2 책은 이 한 권');
  const tsv = source('../docs/word-sources/danwon-g2-final-sep-mock.tsv').trim().split('\n').slice(1).map(line => line.split('\t'));
  assert(tsv.length === 572 && tsv.every(([q, word, meaning], i) => words[i].word === word && words[i].meaning === meaning && words[i].source_question === `${q}번`), 'V13.247 단어 · 뜻은 단어표(docs/word-sources)와 한 글자도 다르지 않다');

  /* ---------- 학교 ---------- */
  const d2 = DEFAULT_SCHOOLS.find(s => s.id === 'danwon-high-2');
  assert(d2?.name === '단원고2' && d2.full_name === '단원고등학교 2학년' && d2.division === 'high' && d2.active && DEFAULT_SCHOOLS.map(s => s.id).join() === 'wonil-middle,danwon-high,danwon-high-2,seonbu-high,gangseo-high', 'V13.247 학교 단원고2(danwon-high-2)가 단원고 바로 다음에 있다');
  const old = emptyState();
  old.schools = old.schools.filter(s => s.id !== 'danwon-high-2');
  old.signupCodes = old.signupCodes.filter(r => r.school_id !== 'danwon-high-2');
  old.profiles.push({ id: 'old-teacher', role: 'teacher', username: 'old_teacher', display_name: '선생님', active: true, school_ids: ['wonil-middle', 'danwon-high', 'seonbu-high', 'gangseo-high'], active_division: 'high', active_school_id: 'danwon-high' },
    { id: 'old-g1', role: 'student', username: 'old_g1', display_name: '고1', active: true, class_name: '고1A', school_id: 'danwon-high', school: '단원고', division: 'high' });
  const codesBefore = JSON.stringify(old.signupCodes);
  migrateState(old);
  const oldTeacher = old.profiles.find(p => p.id === 'old-teacher'), oldStudent = old.profiles.find(p => p.id === 'old-g1');
  assert(old.schools.some(s => s.id === 'danwon-high-2') && oldTeacher.school_ids.includes('danwon-high-2') && oldTeacher.active_school_id === 'danwon-high', 'V13.247 운영 state에도 단원고2가 더해지고 선생님 담당 학교에 들어간다(지금 고른 학교는 그대로)');
  assert(oldStudent.school_id === 'danwon-high' && oldStudent.school === '단원고' && oldStudent.class_name === '고1A' && JSON.stringify(old.signupCodes) === codesBefore, 'V13.247 기존 학생 · 가입 코드는 옮기거나 바꾸지 않는다');
  assert(signupCodeRows(old, old.schools).some(r => r.school_id === 'danwon-high-2' && r.class_name === '고2' && !r.code && !r.active), 'V13.247 운영 화면에는 단원고2 고2 가입 코드 줄이 "코드 없음"으로 보인다(선생님이 새 코드를 만든다)');

  /* ---------- 반 목록: 단원고2만 고2 ---------- */
  const state = emptyState();
  const school = id => state.schools.find(s => s.id === id);
  assert(schoolClasses(school('danwon-high-2')).join() === '고2' && schoolClasses(school('danwon-high')).join() === '고1A,고1B' && schoolClasses(school('seonbu-high')).join() === '고1A,고1B' && schoolClasses(school('gangseo-high')).join() === '고1A,고1B' && schoolClasses(school('wonil-middle')).join() === '중2,중3',
    'V13.247 반 목록: 단원고2 고2, 단원고 · 선부고 · 강서고 고1A · 고1B 그대로, 원일중 중2 · 중3');
  assert(schoolGrades(school('danwon-high-2')).join() === '고2' && schoolGrades(school('gangseo-high')).join() === '고1' && JSON.stringify(gradeTargets(school('danwon-high-2'))) === '[["고2","고2"]]' && JSON.stringify(gradeTargets(school('danwon-high'))) === '[["고1","고1 전체"],["고1A","고1A"],["고1B","고1B"]]' && JSON.stringify(gradeTargets(school('wonil-middle'))) === '[["중2","중2"],["중3","중3"]]',
    'V13.247 대회 · 교실 게임 대상: 단원고2 고2, 다른 고등학교 고1 전체 · 고1A · 고1B, 원일중 중2 · 중3');
  assert(gradeOf('고2') === '고2' && rankGrade({ class_name: '고2', division: 'high' }) === '고2' && rankGrade({ class_name: '고1A', division: 'high' }) === '고1' && !sameGradeBand({ division: 'high', class_name: '고2' }, { division: 'high', class_name: '고1A' }), 'V13.247 고2는 순위 · 야차전 학년이 고1과 따로(고2)');
  const codeRows = signupCodeRows(state, state.schools);
  assert(codeRows.some(r => r.school_id === 'danwon-high-2' && r.class_name === '고2' && r.code && r.active) && codeRows.filter(r => r.school_id === 'danwon-high-2').length === 1 && !codeRows.some(r => r.school_id !== 'danwon-high-2' && r.class_name === '고2'), 'V13.247 새 state는 단원고2 고2 가입 코드를 하나 만들고, 다른 학교에는 고2 줄이 없다');
  const code = state.signupCodes.find(r => r.school_id === 'danwon-high-2').code;
  await selfSignup(state, { username: 'qa_d2_join', password: 'QaD2Join123!', display_name: '고2가입', code });
  const joined = state.profiles.find(p => p.username === 'qa_d2_join');
  assert(joined?.class_name === '고2' && joined.school_id === 'danwon-high-2' && joined.school === '단원고2' && joined.division === 'high', 'V13.247 단원고2 코드로 가입하면 단원고2 · 고2 학생이 된다');

  /* ---------- 학생들 ---------- */
  const hash = await passwordHash('QaD2pass1!');
  const SCHOOLS = { 'danwon-high': '단원고', 'danwon-high-2': '단원고2', 'seonbu-high': '선부고', 'gangseo-high': '강서고', 'wonil-middle': '원일중' };
  const student = (id, schoolId, cls) => ({ id, username: id, display_name: id, role: 'student', active: true, class_name: cls, school_id: schoolId, school: SCHOOLS[schoolId], division: schoolId.endsWith('middle') ? 'middle' : 'high', password_hash: hash, created_at: Date.now() - 86400000, pets: [{ key: 'dog', first: true, acquired_at: 1 }], avatar_key: 'dog' });
  state.profiles.push(
    { id: 'qa-d2-teacher', username: 'qa_d2_teacher', display_name: '단원고2 선생님', role: 'teacher', active: true, password_hash: hash, school_ids: [], division_ids: ['middle', 'high'], active_division: 'high', active_school_id: 'danwon-high' },
    student('qa-d2-a', 'danwon-high-2', '고2'), student('qa-d2-b', 'danwon-high-2', '고2'), student('qa-d2-1a', 'danwon-high', '고1A'), student('qa-d2-1b', 'danwon-high', '고1B'),
    student('qa-d2-sb', 'seonbu-high', '고1A'), student('qa-d2-gs', 'gangseo-high', '고1B'), student('qa-d2-m2', 'wonil-middle', '중2'), student('qa-d2-m3', 'wonil-middle', '중3')
  );
  for (const p of state.profiles.filter(x => x.role === 'student')) state.sessions.push({ id: 'qa-d2-coins-' + p.id, student_id: p.id, division: p.division, school_id: p.school_id, school: p.school, total: 1, correct: 1, xp: 0, reward_points: 1000, created_at: Date.now() - 3600000, range_codes: [] });
  migrateState(state);
  const t = {};
  for (const p of state.profiles.filter(x => x.id.startsWith('qa-d2-'))) t[p.id] = (await service(state, 'POST', '/login', { username: p.username, password: 'QaD2pass1!', division: p.division || 'high', role: p.role === 'teacher' ? 'teacher' : undefined }, null))._cookie;
  const boot = id => service(state, 'GET', '/bootstrap', {}, t[id]);
  const tt = t['qa-d2-teacher'];

  /* ---------- 선생님이 단원고2를 고른다 ---------- */
  const teacherHigh = await boot('qa-d2-teacher');
  assert(teacherHigh.schools.some(s => s.id === 'danwon-high-2' && s.name === '단원고2') && teacherHigh.signup_codes.some(r => r.school_id === 'danwon-high-2' && r.class_name === '고2'), 'V13.247 선생님 학교 목록 · 가입 코드 표에 단원고2(고2)가 있다');
  state.profiles.find(p => p.id === 'qa-d2-teacher').active_school_id = 'danwon-high-2';
  const teacherD2 = await boot('qa-d2-teacher');
  assert(teacherD2.profile.active_school_id === 'danwon-high-2' && teacherD2.books.length === 1 && teacherD2.books[0].id === book.id && teacherD2.profiles.some(p => p.id === 'qa-d2-a') && !teacherD2.profiles.some(p => p.id === 'qa-d2-1a'),
    'V13.247 선생님이 단원고2를 고르면 단원고2 책 · 학생만 보인다');

  /* ---------- 단원고2는 이 책만, 다른 학교는 전과 같음 ---------- */
  const d2Boot = await boot('qa-d2-a');
  assert(d2Boot.books.length === 1 && d2Boot.books[0].id === book.id && d2Boot.books[0].words.length === 572, 'V13.247 단원고2 학생 화면에는 고2 9월 모의고사 책 하나(572단어)만, 단원고 책은 없다');
  const ids = list => list.flatMap(b => b.words || []).map(w => w.id).sort().join();
  const who = { 'danwon-high|고1A': 'qa-d2-1a', 'danwon-high|고1B': 'qa-d2-1b', 'seonbu-high|고1A': 'qa-d2-sb', 'gangseo-high|고1B': 'qa-d2-gs', 'wonil-middle|중2': 'qa-d2-m2', 'wonil-middle|중3': 'qa-d2-m3' };
  for (const [schoolId, cls, nBooks, nRanges, nWords] of BEFORE) {
    const b = (await boot(who[`${schoolId}|${cls}`])).books;
    const before = runtime.filter(x => x.school_id === schoolId && (!x.grade || x.grade === cls));
    const w = b.flatMap(x => x.words || []);
    assert(b.length === nBooks && new Set(w.map(x => x.range_code)).size === nRanges && w.length === nWords && ids(b) === ids(before) && !b.some(x => x.id === book.id),
      `V13.247 ${SCHOOLS[schoolId]} ${cls} 학생 책 ${nBooks}권 · 범위 ${nRanges}개 · 단어 ${nWords}개 · 단어 id가 전(V13.246.0)과 같고 단원고2 책은 안 보인다`);
  }
  const d1 = new Set(scopedWords(state, 'danwon-high', ['9월 21'], '고1A').map(w => w.id)), d2w = scopedWords(state, 'danwon-high-2', ['9월 21'], '고2');
  assert(d1.size === 29 && d2w.length === 39 && d2w.every(w => !d1.has(w.id) && w.id.startsWith('dw2_')), 'V13.247 같은 범위 이름(9월 21)이라도 단원고는 고1 29개, 단원고2는 고2 39개로 학교마다 갈린다');

  /* ---------- 선생님: 등록 · 반 옮기기 · 미리보기 ---------- */
  const made = await service(state, 'POST', '/students', { username: 'qa_d2_made', password: 'QaD2Made123!', display_name: '고2등록', class_name: '고2', school_id: 'danwon-high-2' }, tt);
  assert(made.class_name === '고2' && made.school_id === 'danwon-high-2', 'V13.247 선생님이 단원고2 고2 학생을 등록한다');
  await expectStatus(400, () => service(state, 'POST', '/students', { username: 'qa_d2_bad', password: 'QaD2Made123!', display_name: '고1A2', class_name: '고1A', school_id: 'danwon-high-2' }, tt), 'V13.247 단원고2에는 고1A 반이 없다');
  await expectStatus(400, () => service(state, 'POST', '/students', { username: 'qa_d2_bad2', password: 'QaD2Made123!', display_name: '단원고2반', class_name: '고2', school_id: 'danwon-high' }, tt), 'V13.247 단원고(고1)에는 고2 반이 없다');
  state.profiles.find(p => p.id === 'qa-d2-teacher').active_school_id = 'danwon-high';
  const moved = await service(state, 'PATCH', '/students/qa-d2-1b', { school_id: 'danwon-high-2', class_name: '고2' }, tt);
  assert(moved.school_id === 'danwon-high-2' && moved.school === '단원고2' && moved.class_name === '고2', 'V13.247 선생님이 단원고에 가입한 학생을 단원고2 · 고2로 옮긴다(선생님만, 자동으로 옮기지 않는다)');
  await expectStatus(400, () => service(state, 'PATCH', '/students/qa-d2-1a', { school_id: 'danwon-high-2' }, tt), 'V13.247 반을 고2로 같이 바꾸지 않으면 단원고2로 옮길 수 없다');
  state.profiles.find(p => p.id === 'qa-d2-teacher').active_school_id = 'danwon-high-2';
  await service(state, 'POST', '/teacher/student-preview', { school_id: 'danwon-high-2', grade: '고2' }, tt);
  assert(state.profiles.find(p => p.id === 'teacher-preview:qa-d2-teacher:danwon-high-2:고2')?.class_name === '고2', 'V13.247 선생님 미리보기에서 단원고2 고2 학생 화면을 본다');
  await expectStatus(400, () => service(state, 'POST', '/teacher/student-preview', { school_id: 'danwon-high-2', grade: '고1A' }, tt), 'V13.247 단원고2 고1A 미리보기는 없다');

  /* ---------- 시험 · 과제 대상 ---------- */
  const now = Date.now();
  const examBody = (class_name, range_codes) => ({ title: 'QA 단원고2 시험', class_name, school: '단원고2', range_codes, exam_type: 'eng2mean_mc', question_count: 4, duration_sec: 300, passing_score: 70, max_attempts: 1, available_at: now - 1000, due_at: now + 3600000, release_result: true });
  const classExam = await service(state, 'POST', '/exams', examBody('고2', ['9월 21']), tt);
  const allExam = await service(state, 'POST', '/exams', examBody('__ALL__', ['9월 22']), tt);
  assert(new Set(state.exams.find(e => e.id === classExam.id)?.word_ids || scopedWords(state, 'danwon-high-2', ['9월 21'], '고2').map(w => w.id)).size > 0, 'V13.247 단원고2 고2 시험을 낸다');
  const [b2, b1] = [await boot('qa-d2-a'), await boot('qa-d2-1a')];
  assert(b2.exams.some(e => e.id === classExam.id) && b2.exams.some(e => e.id === allExam.id) && !b1.exams.some(e => e.id === classExam.id || e.id === allExam.id), 'V13.247 단원고2 시험(고2 · 학교 전체)은 단원고2 학생에게만 간다');
  await expectStatus(400, () => service(state, 'POST', '/exams', examBody('고1A', ['9월 21']), tt), 'V13.247 단원고2 고1A 시험 대상은 없다');
  const assignment = await service(state, 'POST', '/assignments', { title: 'QA 단원고2 과제', class_name: '고2', school_id: 'danwon-high-2', range_codes: ['9월 22'], target_questions: 20, due_at: now + 86400000 }, tt);
  assert(assignment?.id, 'V13.247 단원고2 고2 연습 과제를 낼 수 있다');

  /* ---------- 단원고2 학생끼리 야차전 ---------- */
  const ch = await service(state, 'POST', '/battle/challenge', { friend_id: 'qa-d2-b', stake: 10, range_codes: ['9월 21'] }, t['qa-d2-a']);
  const row = state.battles.find(b => b.id === ch.id);
  assert(ch.challenge && row?.grade === '고2' && row.school_id === 'danwon-high-2', 'V13.247 단원고2 학생끼리 고2 범위로 야차전 도전이 잡힌다');
  await expectStatus(404, () => service(state, 'POST', '/battle/challenge', { friend_id: 'qa-d2-1a', stake: 10, range_codes: ['9월 21'] }, t['qa-d2-b']), 'V13.247 단원고2(고2)와 단원고 고1은 학년이 달라 야차전 도전이 안 된다');
  const friends = (await service(state, 'GET', '/battle/friends', {}, t['qa-d2-a'])).friends.map(f => f.id);
  assert(friends.includes('qa-d2-b') && !friends.some(id => ['qa-d2-1a', 'qa-d2-sb', 'qa-d2-gs'].includes(id)), 'V13.247 단원고2 학생의 야차전 친구 목록에는 고2만');
  for (const b of state.battles) if (['waiting', 'active'].includes(b.status)) settleBattle(state, { id: b.id, reason: 'cancelled' });

  /* ---------- 대회 · 교실 게임 ---------- */
  const pool = await service(state, 'GET', '/teacher/tournament-pool', { grade: '고2' }, tt);
  const dw = pool.schools.find(s => s.id === 'danwon-high-2');
  assert(pool.schools.length === 1 && dw && dw.students.some(s => s.id === 'qa-d2-a') && dw.ranges.length === 15 && dw.ranges.every(r => r.period === 'final'), 'V13.247 대회 만들기: 고2는 단원고2 학생과 범위 15개(기말)만');
  const pool1 = await service(state, 'GET', '/teacher/tournament-pool', { grade: '고1' }, tt);
  assert(!pool1.schools.some(s => s.id === 'danwon-high-2') && pool1.schools.some(s => s.id === 'danwon-high'), 'V13.247 고1 대회 학교 묶음에 단원고2는 들어가지 않는다');
  const party = await service(state, 'POST', '/teacher/party', { kind: 'treasure', class_name: '고2', minutes: 8, range_codes: ['9월 23'] }, tt);
  assert(/^\d{4}$/.test(party?.party?.code || ''), 'V13.247 교실 게임을 단원고2 고2 대상으로 연다');

  /* ---------- 화면 ---------- */
  const app = source('../public/app.js'), teacher = source('../public/modules/teacher.js'), enh = source('../public/teacher-enhancements.js'), partyTv = source('../public/modules/party-tv.js'), studentUi = source('../public/modules/student.js');
  assert(!/\['고1A',\s*'고1B'\]/.test(app + teacher + enh + partyTv) && !/\['고1A','고1B'\]/.test(app + teacher + enh + partyTv), 'V13.247 화면의 반 목록은 고1A · 고1B를 박아 두지 않고 학교별 목록(school-classes.js)을 쓴다');
  assert(app.includes('schoolClasses(activeSchoolRef())') && teacher.includes('schoolClasses(activeSchoolRef(A)).map(c =>') && enh.includes('schoolClasses({ id: p.school_id') && partyTv.includes('gradeTargets({ id: A.data.profile.active_school_id') && app.includes('tournamentTargets(activeSchoolRef())'),
    'V13.247 학생 등록 · 반 옮기기 · 미리보기 · 시험 대상 · 대회 · 교실 게임 대상이 학교별 반 목록을 쓴다');
  assert(studentUi.includes("['고2','고2']"), 'V13.247 순위 학년에 고2');
}
