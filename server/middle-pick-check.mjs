// V13.149 중학생 단어 고르기를 고등학생과 똑같이: 단어 학습의 "오늘 외울 단어"와 연습 · 실전시험의 단어 고르기가
// 같은 카드(20개씩 칸 · 전체/비우기 · 직접 고르기 · 고른 개수)와 같은 저장(highWordIds · highExamWordIds)을 쓴다.
// 중학생은 시험 구분 · 모의고사/교과서 탭 없이 모든 과가 칩으로 나오고, 과 이름은 'N과'다.
// 예전 중학생 시험 화면에서 고른 단어(middleWordIds)는 그 과의 시험 선택으로 한 번 이어받는다.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { emptyState } from './state.mjs';
import { passwordHash } from './auth.mjs';
import { service } from './service.mjs';
import { highLessonPick, highExamSelection, memorizeDeck, HIGH_PICK_DEFAULT } from '../public/modules/student.js';

const source = path => readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8');

export async function runMiddlePickChecks(assert) {
  /* ---------- 서버: 원일중 중3 학생이 두 과의 word_ids로 시험을 시작 ---------- */
  const state = emptyState(), now = Date.now(), hash = await passwordHash('QaMid1!');
  state.profiles.push({ id: 'qa-mp', username: 'qa-mp', display_name: '중학 고르기', role: 'student', active: true, class_name: '중3', school_id: 'wonil-middle', school: '원일중', division: 'middle', password_hash: hash, pets: [{ key: 'dog', first: true, acquired_at: now - 9e8 }], avatar_key: 'dog', created_at: now - 9e8 });
  const token = (await service(state, 'POST', '/login', { username: 'qa-mp', password: 'QaMid1!', role: 'student', division: 'middle' }, null))._cookie;
  const boot = await service(state, 'GET', '/bootstrap', {}, token);
  const all = boot.books.flatMap(book => book.words || []);
  const codes = [...new Set(all.map(word => String(word.range_code)))];
  const lesson = code => all.filter(word => String(word.range_code) === code);
  const [c1, c2] = codes, l1 = lesson(c1), l2 = lesson(c2);
  assert(codes.length >= 2 && l1.length > 40 && l2.length > 40, `V13.149 중3 학생은 과 여러 개를 받는다 (${codes.join(', ')})`);
  const picked = [...l1.slice(0, 20), ...l2.slice(0, 15)].map(word => word.id);
  const practice = await service(state, 'POST', '/practice/start', { school: boot.profile.school || '원일중', mode: 'write_meaning', cover_all: true, exam_style: true, word_ids: picked, run_mode: 'practice' }, token);
  const px = state.practices.find(x => x.id === practice.id);
  assert(px && px.manual_selection === true && px.target === 35 && px.words.every(id => picked.includes(id)) && [...px.range_codes].sort().join() === [c1, c2].sort().join(), 'V13.149 중학생도 두 과에서 고른 단어를 합쳐 시험을 시작한다(서버는 그대로)');

  /* ---------- 화면 함수: 고등학생과 같은 고르기 ---------- */
  const A = { school: boot.profile.school || '원일중', ranges: {}, data: { profile: { id: 'qa-mp', division: 'middle' }, books: boot.books }, middleRange: c2, middleWordIds: l2.slice(0, 3).map(word => word.id) };
  const deck = memorizeDeck(A);
  assert(A.memorizeRange === c2 && deck.title === `${c2}과 · 고른 단어` && deck.words.length === HIGH_PICK_DEFAULT, 'V13.149 중학생 단어 학습: 마지막으로 본 과부터, 처음에는 앞 20개, 과 이름은 N과');
  const sel = highExamSelection(A);
  assert(sel.availableTypes.length === 0 && sel.lessons.map(lesson => lesson.code).join() === codes.join() && sel.wordIds.length === 0, 'V13.149 중학생 시험: 탭 없이 모든 과가 칩, 아직 연 과가 없으면 0개');
  const legacy = highLessonPick(A, 'exam', c2, l2);
  assert(legacy.length === 3 && legacy.every(id => A.middleWordIds.includes(id)), 'V13.149 예전 중학생 시험 선택(middleWordIds)을 그 과의 시험 선택으로 이어받는다');
  const fresh = highLessonPick(A, 'exam', c1, l1);
  assert(fresh.join() === l1.slice(0, HIGH_PICK_DEFAULT).map(word => word.id).join(), 'V13.149 다른 과는 고등학생처럼 단어 학습에서 고른 단어(없으면 앞 20개)로 시작');
  assert(highExamSelection(A).wordIds.length === 3 + HIGH_PICK_DEFAULT, 'V13.149 여러 과에서 고른 단어가 합쳐진다');

  /* ---------- 화면 코드 ---------- */
  const studentUi = source('../public/modules/student.js'), appUi = source('../public/app.js'), sessionsUi = source('../public/modules/sessions.js');
  assert(!studentUi.includes('data-middle-word=') && !studentUi.includes('시험 볼 단어 직접 선택') && !studentUi.includes('function middleLessonState(') && !studentUi.includes('data-middle-lesson='), 'V13.149 예전 중학생 체크 목록 · 과 버튼은 없다');
  assert(studentUi.includes("const lessonLabel = (A, code) => A.data.profile.division === 'middle' ? `${code}과` : rangeLabel(A.school, code);") && studentUi.includes("const pickUi = (() => {") && studentUi.includes('<span>01</span>범위 · 오늘 외울 단어</div>') && studentUi.includes("scopeUi = middle ? chips + picker :"), 'V13.149 중학생 단어 학습 · 시험도 고르기 카드, 과 이름은 N과');
  assert(!appUi.includes('if (d.middleWordAll)') && !appUi.includes('input.dataset.middleWord !== undefined') && !appUi.includes('if (d.middleLesson)') && appUi.includes("// V13.124: 고른 단어만 출제한다(개수 = 고른 단어 수, 서버 한도 200개). V13.149 중학생도 같다."), 'V13.149 시험 시작은 중학생 · 고등학생 같은 길(highExamSelection)');
  assert(appUi.includes("if (A.data.profile.division === 'middle') A.middleRange = d.memorizeRange;") && appUi.includes("A.highWordIds = { ...(A.highWordIds || {}), [code]: highPickWords(code)") && sessionsUi.includes("A.highWordIds = { ...(A.highWordIds || {}), [code]: lessonWords.filter(word => ids.has(word.id))"), 'V13.149 다시 하기는 그 기록의 단어를 단어 학습에서 골라 둔다');
}
