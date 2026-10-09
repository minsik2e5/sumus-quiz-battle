// Release checks for V13.124 고등 단어 고르기 (V13.127: 카드·구간 칸·고정 바로 다듬음): 단어 학습의 "오늘 외울 단어"(빠른 버튼 1~20 … · 전체, 접는 체크 목록)와
// 연습·실전시험의 단어 고르기(과마다 고른 단어를 합쳐 word_ids로 시작, 최대 200개). 서버는 바꾸지 않았다:
// 중학교와 같은 '/practice/start' word_ids 길을 쓰고, 범위 코드는 고른 단어에서 만들어진다.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { emptyState } from './state.mjs';
import { passwordHash } from './auth.mjs';
import { service } from './service.mjs';
import { highLessonPick, highExamSelection, memorizeDeck, toggleHighChunk, HIGH_PICK_DEFAULT, HIGH_PICK_CHUNK, HIGH_EXAM_MAX } from '../public/modules/student.js';

const source = path => readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8');

export async function runHighPickChecks(assert) {
  /* ---------- 서버: 강서고 고1A 학생이 두 과의 word_ids로 시험을 시작 ---------- */
  const state = emptyState(), now = Date.now(), hash = await passwordHash('QaPick1!');
  state.profiles.push({ id: 'qa-hp', username: 'qa-hp', display_name: '고르기', role: 'student', active: true, class_name: '고1A', school_id: 'gangseo-high', school: '강서고', division: 'high', password_hash: hash, pets: [{ key: 'dog', first: true, acquired_at: now - 9e8 }], avatar_key: 'dog', created_at: now - 9e8 });
  const token = (await service(state, 'POST', '/login', { username: 'qa-hp', password: 'QaPick1!', division: 'high' }, null))._cookie;
  const boot = await service(state, 'GET', '/bootstrap', {}, token);
  const lesson = code => boot.books.flatMap(book => book.words || []).filter(word => word.range_code === code);
  const l3 = lesson('L3'), l4 = lesson('L4');
  assert(l3.length === 114 && l4.length === 154, 'V13.124 강서고 학생은 기말고사 3과 114개 · 4과 154개를 받는다');
  // 실전시험은 다 풀어야 끝나니, 다음 시작을 위해 기록만 끝난 것으로 둔다.
  const finish = async id => { state.practices.find(x => x.id === id).finished = true; };
  const start = body => service(state, 'POST', '/practice/start', { school: '강서고', mode: 'write_meaning', cover_all: true, exam_style: true, ...body }, token);

  const picked = [...l3.slice(0, 20), ...l4.slice(20, 35)].map(word => word.id);
  const practice = await start({ word_ids: picked, run_mode: 'practice' });
  const px = state.practices.find(x => x.id === practice.id);
  assert(px.run_mode === 'practice' && px.exam_style === true && px.manual_selection === true && px.target === 35 && px.words.length === 35 && px.words.every(id => picked.includes(id)) && [...px.range_codes].sort().join() === 'L3,L4', 'V13.124 연습시험: 3과 20 + 4과 15 = 35개 word_ids로 시작하면 고른 35개만 나오고 범위 코드(L3·L4)는 단어에서 만들어진다');
  await finish(practice.id);

  const few = [l3[0].id, l3[1].id, l4[0].id];
  const test = await start({ word_ids: few, run_mode: 'test' });
  const tx = state.practices.find(x => x.id === test.id);
  assert(tx.run_mode === 'test' && tx.target === 3 && tx.words.length === 3 && tx.timer_mode === 'session' && tx.deadline > now && [...tx.range_codes].sort().join() === 'L3,L4', 'V13.124 실전시험: 5개 미만(3개)도 target 없이 word_ids로 시작되고 3문제만 나온다(서버 target 최소 5에 걸리지 않음)');
  await finish(test.id);

  const one = await start({ word_ids: [l4[100].id], run_mode: 'test' });
  const ox = state.practices.find(x => x.id === one.id);
  assert(ox.target === 1 && ox.words.length === 1 && ox.range_codes.join() === 'L4', 'V13.124 실전시험: 단어 1개만 골라도 시작된다');
  await finish(one.id);

  const many = await start({ word_ids: [...l3, ...l4].slice(0, HIGH_EXAM_MAX + 30).map(word => word.id), run_mode: 'practice' });
  assert(state.practices.find(x => x.id === many.id).target === HIGH_EXAM_MAX, 'V13.124 서버는 word_ids를 200개까지만 받는다(화면도 200개 넘으면 막는다)');
  await finish(many.id);

  /* ---------- 화면 상태: 과마다 선택, 앞 20개, 시험은 단어 학습 선택을 한 번 복사 ---------- */
  const A = { data: { books: boot.books, profile: { ...boot.profile, division: 'high', id: 'qa-hp' } }, school: '강서고', ranges: {}, highRangeType: 'textbook', memStars: [l3[50].id], memorizeFilter: 'all', memorizeRange: 'L3' };
  assert(highLessonPick(A, 'memo', 'L3', l3).join() === l3.slice(0, HIGH_PICK_DEFAULT).map(w => w.id).join() && HIGH_PICK_CHUNK === 20, 'V13.124 단어 학습: 처음 연 과는 앞 20개가 선택된다');
  const tiny = l3.slice(0, 7);
  assert(highLessonPick({}, 'memo', 'T', tiny).length === 7, 'V13.124 20개 이하인 과는 전부 선택된다');
  A.highWordIds.L3 = l3.slice(40, 60).map(w => w.id);
  const deck = memorizeDeck(A);
  assert(deck.words.length === 20 && deck.words[0].id === l3[40].id, 'V13.124 카드로 외우기는 고른 단어만(20장)');
  A.memorizeFilter = 'starred';
  assert(memorizeDeck(A).words.map(w => w.id).join() === l3[50].id, 'V13.124 ★ 어려운 단어 보기는 그 과의 별표 전체');
  A.memStars = [l3[100].id];
  assert(memorizeDeck(A).words.map(w => w.id).join() === l3[100].id, 'V13.124 ★ 보기는 고르지 않은 단어의 별표도 보여 준다');
  A.memorizeFilter = 'all';
  assert(highLessonPick(A, 'exam', 'L3', l3).join() === l3.slice(40, 60).map(w => w.id).join(), 'V13.124 시험에서 과를 처음 열면 단어 학습에서 고른 단어를 처음 값으로 가져온다');
  A.highWordIds.L3 = l3.slice(0, 5).map(w => w.id);
  assert(highLessonPick(A, 'exam', 'L3', l3).length === 20, 'V13.124 복사는 한 번만: 이후 단어 학습 선택이 바뀌어도 시험 선택은 따로 간다');
  assert(highLessonPick(A, 'exam', 'L4', l4).join() === l4.slice(0, 20).map(w => w.id).join(), 'V13.124 단어 학습에서 고른 적 없는 과는 앞 20개');
  A.highExamWordIds.L4 = l4.slice(0, 15).map(w => w.id);
  const sel = highExamSelection(A);
  assert(sel.wordIds.length === 35 && sel.parts.map(p => `${p.code}:${p.picked.length}`).join() === 'L3:20,L4:15', 'V13.124 시험: 여러 과에서 고른 단어가 합쳐진다(3과 20 + 4과 15 = 35개)');
  A.highExamWordIds.L4 = ['not-a-word', ...l4.slice(0, 3).map(w => w.id)];
  assert(highLessonPick(A, 'exam', 'L4', l4).length === 3, 'V13.124 없는 단어 id는 지운다');

  /* ---------- V13.127 구간 칸: 눌러서 더하고 빼기 ---------- */
  const ids20 = l3.slice(0, 20).map(w => w.id);
  const plus = toggleHighChunk(l3, ids20, 40);
  assert(plus.length === 40 && plus[20] === l3[40].id && plus.includes(l3[0].id), 'V13.127 1~20을 고른 채 41~60을 누르면 두 구간이 같이 골라진다(40개, 번호 순)');
  assert(toggleHighChunk(l3, plus, 0).join() === l3.slice(40, 60).map(w => w.id).join(), 'V13.127 다 찬 칸을 다시 누르면 그 20개만 빠진다');
  const partial = l3.slice(0, 5).map(w => w.id);
  assert(toggleHighChunk(l3, partial, 0).length === 20, 'V13.127 일부만 고른 칸을 누르면 그 칸을 다 채운다');
  assert(toggleHighChunk(l3, [], 100).length === 14 && toggleHighChunk(l3, undefined, 0).length === 20, 'V13.127 마지막 칸(101~114)은 남은 14개, 빈 선택에서도 동작');

  /* ---------- 화면 코드 ---------- */
  const studentUi = source('../public/modules/student.js'), appUi = source('../public/app.js'), css = source('../public/v13127.css'), build = source('./build-assets.mjs'), design = source('../docs/dungeon-design.md');
  assert(studentUi.includes('오늘 외울 단어') && studentUi.includes('data-high-chunk="${from}"') && studentUi.includes('${from + 1}~${from + slice.length}') && !studentUi.includes('data-high-chunk="all"') && studentUi.includes('직접 고르기') && studentUi.includes('data-high-pick-toggle=') && studentUi.includes('data-high-all="true"') && studentUi.includes('data-high-all="false"') && studentUi.includes('middle-direct-word-v1343'), 'V13.127 단어 학습(고등): 과 칩 아래 카드 — 20개씩 구간 칸, 전체/비우기, 접는 체크 목록(중학교 CSS 재사용)');
  assert(studentUi.includes('function highPickCard(') && studentUi.includes('function highLessonChip(') && studentUi.includes('hp-tile-fill') && studentUi.includes('hp-tile-known') && studentUi.includes("' 외 ${k - 3}개'".replace(/'/g, '`')) && studentUi.includes("'범위 · 오늘 외울 단어'") && !studentUi.includes('high-today-v13124') && !studentUi.includes('function highWordPicker('), 'V13.127 카드 하나로: 큰 개수 · 진행 막대 · 칸마다 채움(일부만 고른 칸도 보임) · 단어 학습은 ✓외운 수 · 접힌 직접 고르기에 미리보기, 01과 02 사이 빈칸 없음');
  assert(studentUi.includes('hp-dock-v13127') && studentUi.includes('id="high-exam-total"') && !studentUi.includes('high-exam-total-v13124') && appUi.includes('toggleHighChunk(lessonWords, A[HIGH_PICK_STORES[d.highScope]]?.[d.highCode], from)') && appUi.includes('A.highPickLast = { scope, code: String(code), chunk, count:') && appUi.includes('A.highPickLast = null;'), 'V13.127 시험은 아래 고정 바에 합계·안내·시작 버튼, 칸은 눌러서 더하고 빼며 방금 누른 칸만 연출');
  assert(!studentUi.includes('examTargetGrid') && !studentUi.includes('문항 수') && !studentUi.includes("${middle ? '02' : '03'}") && studentUi.includes('<span>02</span>시험 방식') && studentUi.includes('data-high-exam-lesson=') && studentUi.includes(".join(' + ')} = ${count}개`"), 'V13.124 시험(고등): 문항 수 단계 없이 01 범위 · 02 시험 방식, 과 칩을 누르면 그 과를 고르고 요약은 "3과 20 + 4과 15 = 35개"');
  assert(studentUi.includes('HIGH_EXAM_MAX = 200') && studentUi.includes('한 번에 최대 ${HIGH_EXAM_MAX}개') && studentUi.includes("${count && !over ? '' : 'disabled'}") && studentUi.includes('시험 볼 단어를 먼저 선택해주세요'), 'V13.124 200개가 넘거나 하나도 안 고르면 시작 버튼이 꺼지고 안내가 나온다');
  assert(studentUi.includes('시험 볼 단어 직접 선택') && studentUi.includes('data-middle-word=') && studentUi.includes('data-middle-lesson='), 'V13.124 중학교 시험 화면은 그대로');
  assert(appUi.includes("await startPractice({ wordIds, target: 'all', mode: A.mode, runMode, examStyle: true, confirmed: true });") && appUi.includes('wordIds.length > HIGH_EXAM_MAX') && appUi.includes('highWordIds: A.highWordIds || {}, highExamWordIds: A.highExamWordIds || {}') && appUi.includes('A.highWordIds = pickMap(v.highWordIds);') && appUi.includes('input.dataset.highWord !== undefined') && appUi.includes('function renderKeepPick('), 'V13.124 시작은 고른 단어 wordIds로(target 없이), 과마다 선택은 폰(prefs)에 저장, 체크해도 목록 스크롤 유지');
  assert(css.includes('.hp-list-v13127{max-height:min(44vh,360px)}') && css.includes('.hp-tiles-v13127{grid-template-columns:repeat(4,minmax(0,1fr))') && css.includes('repeat(auto-fill,minmax(72px,1fr))') && css.includes('.exam-start-inline.hp-dock-v13127{position:sticky') && css.includes('.memorize-range-strip.hp-strip-v13127{background:none!important') && css.includes('@media (prefers-reduced-motion:reduce)') && build.includes('"v13127.css"'), 'V13.127 체크 목록은 높이 제한, 칸은 390폭 4칸·넓은 화면은 자동, 과 칩 오른쪽 그라데이션 제거, 고정 바, 동작 줄이기 존중');
  assert(design.includes('**진행(13.124.0)**: 고등학생도 단어를 하나씩 골라') && !design.includes('**보류**: 고등학생도'), 'V13.124 결정 기록: 보류 → 진행(13.124.0)');
}
