// Release checks for V13.112: 기말고사 단어 (YBM 김은형 공통영어2 3·4과 본문, 단원고·강서고) and the 중간고사 /
// 기말고사 split of the range pickers. Data: server/high-vocab-ybm-kim-final.mjs; the split is the
// `exam_period` of a book (service.mjs allBooks) and the folders in student.js.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { emptyState } from './state.mjs';
import { passwordHash } from './auth.mjs';
import { service, allBooks } from './service.mjs';
import { ybmKimFinalBooks, YBM_KIM_FINAL_COUNTS } from './high-vocab-ybm-kim-final.mjs';
import { ybmParkSeonbuBooks, YBM_PARK_SEONBU_COUNTS } from './high-vocab-ybm-park-seonbu.mjs';

const source = path => readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8');

export async function runFinalWordsChecks(assert) {
  /* ---------- the words ---------- */
  const byBook = id => ybmKimFinalBooks.find(book => book.id === id);
  const danwon = ['3', '4'].map(n => byBook(`high:ybm-kim:final:common2:lesson${n}`)), gangseo = ['3', '4'].map(n => byBook(`high:ybm-kim:gangseo:final:common2:lesson${n}`));
  assert(danwon[0].words.length === 114 && danwon[1].words.length === 154 && YBM_KIM_FINAL_COUNTS.L3 === 114 && YBM_KIM_FINAL_COUNTS.L4 === 154 && gangseo[0].words.length === 114 && gangseo[1].words.length === 154, 'V13.112 기말고사 단어: 3과 본문 114개 · 4과 본문 154개, 단원고와 강서고에 각각');
  assert(danwon.every(book => book.school_id === 'danwon-high' && book.school === '단원고' && book.division === 'high' && !book.grade) && gangseo.every(book => book.school_id === 'gangseo-high' && book.school === '강서고' && book.division === 'high' && !book.grade), 'V13.112 기말고사 책은 단원고·강서고 것이고 반으로 나누지 않아 모든 반이 본다');
  assert(ybmKimFinalBooks.every(book => book.exam_period === 'final' && book.words.every(word => word.exam_period === 'final' && /^L[34]$/.test(word.range_code) && word.range_code === `L${book.id.slice(-1)}`)), 'V13.112 기말고사 책과 단어는 모두 exam_period final이고 범위 코드는 L3·L4');
  const books = allBooks({ extraBooks: [] }), allWords = books.flatMap(book => book.words || []);
  assert(new Set(allWords.map(word => word.id)).size === allWords.length, 'V13.112 단어 id는 모든 책에서 겹치지 않는다 (기말고사 id는 기존 1~2과 id와 접두어가 다르다)');
  assert(danwon.every((book, i) => book.words.every((word, k) => word.word === gangseo[i].words[k].word && word.meaning === gangseo[i].words[k].meaning && word.part_of_speech === gangseo[i].words[k].part_of_speech)) && danwon.every(book => book.words.every(word => !word.id.includes('gangseo'))), 'V13.112 강서고 기말고사 단어는 단원고와 같은 교과서라 같은 단어·뜻·순서다');
  const words3 = danwon[0].words, words4 = danwon[1].words, text = list => list.map(word => word.word.toLowerCase());
  assert(words3.every(word => word.word.trim() && word.meaning.trim() && /^(n|v|a|adv|prep|phrase)(\.|$)/.test(word.part_of_speech) || ['n./v.', 'v./n.', 'n./a.'].includes(word.part_of_speech)) && words4.every(word => word.word.trim() && word.meaning.trim() && word.part_of_speech) && [...words3, ...words4].every(word => !/부정사|동명사|완전한 절/.test(word.word)), 'V13.112 모든 단어에 뜻과 품사가 있고, 영어 철자로 쓸 수 없는 한글 문법 표기(to부정사 등)는 영어 표기로 바꿨다');
  assert(new Set(text(words3)).size === words3.length && new Set(text(words4)).size === words4.length, 'V13.112 한 과 안에서 같은 단어는 한 줄로 합쳤다');
  assert(words3.find(w => w.word === 'path').meaning === '경로; (목표 성취 등을 위한) 길' && words3.find(w => w.word === 'refer to ~').meaning.includes('~을 일컫다') && words3.find(w => w.word === 'refer to ~').meaning.includes('~을 부르다') && words4.find(w => w.word === 'power').part_of_speech === 'v./n.' && words4.some(w => w.word === 'come to-v' && w.meaning === '~하게 되다') && words4.some(w => w.word === 'seem to-v') && words4.some(w => w.word === 'do a good job of v-ing'), 'V13.112 뜻이 둘인 단어(path, refer to, power)는 합치고, 한글 문법 표기는 come to-v 처럼 영어로 쓴다');
  const only = (list, ...names) => names.every(name => list.includes(name));
  assert(only(text(words3), 'prodigy', 'trajectory', 'legacy', 'segregated') && only(text(words4), 'artificial', 'heart', 'mysterious', 'pray') && !['inspiring', 'boycott', 'racial', 'inclusive', 'gender-neutral', 'exclusion'].some(name => text(words3).includes(name)) && !['genre', 'recommendation', 'ethical', 'gene-editing', 'incurable', 'modify'].some(name => text(words4).includes(name)), 'V13.112 본문(READING)만 들어 있다: 대화문(CONVERSATION)과 \'본문 외 지문\' 단어는 없다');

  /* ---------- 중간고사 / 기말고사 ---------- */
  const finals = books.filter(book => book.exam_period === 'final');
  assert(finals.length === 7 && finals.every(book => book.id.includes(':final:')) && books.every(book => book.exam_period === 'final' || book.exam_period === 'midterm'), 'V13.112 모든 책은 중간고사(midterm) 또는 기말고사(final)이고, 기말고사는 3·4과 책 4권(단원고·강서고)과 선부고 2·4과 2권(V13.138·V13.139)과 선부고 외부지문 45~60 1권(V13.171)이다');
  const midterm = books.filter(book => book.exam_period === 'midterm');
  assert(midterm.some(book => book.school_id === 'danwon-high' && book.words.some(w => w.range_code === '24')) && midterm.some(book => book.school_id === 'danwon-high' && book.id === 'high:ybm-kim:common2:lesson1') && midterm.some(book => book.id === 'high:ybm-kim:gangseo:common2:lesson2') && midterm.some(book => book.school_id === 'seonbu-high') && midterm.some(book => book.division === 'middle'), 'V13.112 지금까지 있던 책(모의고사 번호 범위, 교과서 1~2과, 선부고, 중등부)은 모두 중간고사로 묶인다');
  assert(!finals.some(book => book.division === 'middle') && finals.filter(book => book.school_id === 'seonbu-high').map(book => book.id).join() === 'seonbu:final:external-45-60-2026,high:ybm-park:seonbu:final:common2:lesson2,high:ybm-park:seonbu:final:common2:lesson4', 'V13.112 중등부는 아직 기말고사 단어가 없고, 선부고 기말고사는 2과(V13.138)·4과(V13.139)·외부지문 45~60(V13.171)이다');
  const extra = allBooks({ extraBooks: [{ id: 'x', school_id: 'danwon-high', school: '단원고', division: 'high', words: [] }, { id: 'y', school_id: 'danwon-high', school: '단원고', division: 'high', exam_period: 'final', words: [] }] });
  assert(extra.find(book => book.id === 'x').exam_period === 'midterm' && extra.find(book => book.id === 'y').exam_period === 'final', 'V13.112 선생님이 올린 책도 exam_period가 없으면 중간고사다');

  /* ---------- what students see ---------- */
  const state = emptyState(), now = Date.now(), hash = await passwordHash('QaFinal1!');
  const student = (id, name, extra = {}) => ({ id, username: id, display_name: name, role: 'student', active: true, class_name: '고1A', school_id: 'danwon-high', school: '단원고', division: 'high', password_hash: hash, pets: [{ key: 'dog', first: true, acquired_at: now - 9e8 }], avatar_key: 'dog', created_at: now - 9e8, ...extra });
  state.profiles.push(student('qa-fw-d', '단원'), student('qa-fw-g', '강서', { school_id: 'gangseo-high', school: '강서고' }), student('qa-fw-s', '선부', { school_id: 'seonbu-high', school: '선부고' }));
  const tokens = {};
  for (const id of ['qa-fw-d', 'qa-fw-g', 'qa-fw-s']) tokens[id] = (await service(state, 'POST', '/login', { username: id, password: 'QaFinal1!', division: 'high' }, null))._cookie;
  const boot = Object.fromEntries(await Promise.all(Object.keys(tokens).map(async id => [id, await service(state, 'GET', '/bootstrap', {}, tokens[id])])));
  const rangesOf = (id, period) => [...new Set(boot[id].books.filter(book => book.exam_period === period).flatMap(book => book.words.map(w => w.range_code)))].sort().join();
  assert(rangesOf('qa-fw-d', 'final') === 'L3,L4' && rangesOf('qa-fw-g', 'final') === 'L3,L4' && rangesOf('qa-fw-s', 'final') === [...'L2,L4'.split(','), ...Array.from({ length: 16 }, (_, i) => String(45 + i))].sort().join() && rangesOf('qa-fw-d', 'midterm').includes('L1') && rangesOf('qa-fw-d', 'midterm').includes('24') && !rangesOf('qa-fw-d', 'midterm').includes('L3') && boot['qa-fw-s'].books.every(book => book.exam_period === 'midterm' || book.id.startsWith('high:ybm-park:seonbu:final:') || book.id === 'seonbu:final:external-45-60-2026'), 'V13.112 단원고·강서고 학생은 기말고사 L3·L4와 중간고사 범위를 따로 받고, 선부고 학생은 중간고사와 기말고사 2·4과(V13.138·V13.139)·외부 45~60(V13.171)을 받는다');
  const own = id => boot[id].books.flatMap(book => book.words).filter(w => /^L[34]$/.test(w.range_code) && !w.id.includes('ybm-park'));
  assert(own('qa-fw-d').length === 268 && own('qa-fw-d').every(w => w.school_id === 'danwon-high') && own('qa-fw-g').length === 268 && own('qa-fw-g').every(w => w.school_id === 'gangseo-high') && own('qa-fw-s').length === 0, 'V13.112 기말고사 단어 268개는 자기 학교 것만 보인다');
  for (const [id, school] of [['qa-fw-d', '단원고'], ['qa-fw-g', '강서고']]) {
    const started = await service(state, 'POST', '/practice/start', { school, range_codes: ['L3', 'L4'], mode: 'write_meaning', target: 10, run_mode: 'practice', exam_style: true }, tokens[id]);
    const practice = state.practices.find(x => x.id === started.id);
    assert(practice.words.length >= 10 && practice.words.every(wordId => wordId.includes(':final:')) && ['L3', 'L4'].every(code => practice.range_codes.includes(code)), `V13.112 ${school} 학생이 기말고사 범위(L3·L4)로 연습을 시작하면 기말고사 단어만 나온다`);
  }

  /* ---------- V13.138 선부고 YBM(박준언) 2과 본문 · 본문 외 지문 ---------- */
  {
    const [sb] = ybmParkSeonbuBooks, words = sb.words, reading = words.filter(w => w.section === '본문'), further = words.filter(w => w.section === '본문 외 지문');
    assert(ybmParkSeonbuBooks.length === 2 && sb.school_id === 'seonbu-high' && sb.school === '선부고' && sb.division === 'high' && sb.exam_period === 'final' && words.length === 80 && reading.length === 67 && further.length === 13 && YBM_PARK_SEONBU_COUNTS.reading === 67 && YBM_PARK_SEONBU_COUNTS.further === 13, 'V13.138 선부고 2과: 본문 67 + 본문 외 지문 13 = 80개, 기말고사');
    assert(words.every((w, i) => w.range_code === 'L2' && w.school_id === 'seonbu-high' && w.exam_period === 'final' && w.order === i + 1 && w.id === `high:ybm-park:seonbu:final:common2:lesson2:${String(i + 1).padStart(3, '0')}` && w.word.trim() && w.meaning.trim() && !/Answer Key|공통영어2|- \d+ -/.test(w.meaning) && /^(n|v|a|adv|prep|int|phrase)(\.|$)/.test(w.part_of_speech)), 'V13.138 선부고 2과 단어는 모두 L2·기말고사·순서 id·뜻·품사가 있고, PDF 머리글이 뜻에 섞이지 않았다');
    assert(reading[0].word === 'tap' && reading.at(-1).word === 'agriculture' && further[0].word === 'known as ~' && further.at(-1).word === 'predict' && words.findIndex(w => w.section === '본문 외 지문') === 67, 'V13.138 순서는 어휘 목록 그대로(본문 → 본문 외 지문)');
    const find = word => words.find(w => w.word === word)?.meaning;
    assert(find('drought') === '가뭄' && find('Black Friday').startsWith('추수감사절 다음 금요일') && find('hardship') === '어려움[곤란]' && find('try one\'s luck') === '운을 걸고 해보다' && new Set(words.map(w => w.word.toLowerCase())).size === 80, 'V13.138 뜻은 정답지(TEST 1) 그대로, 같은 단어는 없다');
    const sb4 = ybmParkSeonbuBooks[1], w4 = sb4.words, r4 = w4.filter(w => w.section === '본문'), f4 = w4.filter(w => w.section === '본문 외 지문');
    assert(sb4.id === 'high:ybm-park:seonbu:final:common2:lesson4' && sb4.exam_period === 'final' && w4.length === 166 && r4.length === 146 && f4.length === 20 && YBM_PARK_SEONBU_COUNTS.L4.reading === 146 && YBM_PARK_SEONBU_COUNTS.L4.further === 20 && w4.findIndex(w => w.section === '본문 외 지문') === 146, 'V13.139 선부고 4과: 본문 146 + 본문 외 지문 20 = 166개, 기말고사');
    assert(w4.every((w, i) => w.range_code === 'L4' && w.school_id === 'seonbu-high' && w.order === i + 1 && w.id === `high:ybm-park:seonbu:final:common2:lesson4:${String(i + 1).padStart(3, '0')}` && w.word.trim() && w.meaning.trim() && !/Answer Key|공통영어2|- \d+ -/.test(w.meaning) && /^(n|v|a|adv|prep|int|phrase)(\.|$)/.test(w.part_of_speech)) && new Set(w4.map(w => w.word.toLowerCase())).size === 166, 'V13.139 선부고 4과 단어는 모두 L4·순서 id·뜻·품사가 있고 겹치지 않는다');
    const find4 = word => w4.find(w => w.word === word)?.meaning;
    assert(r4[0].word === 'microscope' && find4('microscope') === '현미경' && find4('attempt') === '시도[도전]' && find4('access') === '~에 접근하다' && find4('access to ~') === '~로의 접근 (기회)' && f4.at(-1).word === 'global', 'V13.139 4과 뜻은 정답지(TEST 1) 그대로, 대화문과 겹치는 단어는 본문 뜻');
    const seonbuOwn = boot['qa-fw-s'].books.flatMap(book => book.words).filter(w => w.range_code === 'L2');
    assert(boot['qa-fw-s'].books.flatMap(book => book.words).filter(w => w.range_code === 'L4').length === 166 && seonbuOwn.length === 80 && !boot['qa-fw-d'].books.some(book => book.id.includes('ybm-park')) && !boot['qa-fw-g'].books.some(book => book.id.includes('ybm-park')), 'V13.138 선부고 학생만 2과 80개를 받고, 단원고·강서고에는 안 보인다');
    const started = await service(state, 'POST', '/practice/start', { school: '선부고', range_codes: ['L2'], mode: 'write_meaning', target: 10, run_mode: 'practice', exam_style: true }, tokens['qa-fw-s']);
    const practice = state.practices.find(x => x.id === started.id);
    assert(practice.words.length >= 10 && practice.words.every(wordId => wordId.startsWith('high:ybm-park:seonbu:final:common2:lesson2:')), 'V13.138 선부고 학생이 2과로 연습을 시작하면 2과 단어만 나온다');
  }

  /* ---------- screens ---------- */
  const studentUi = source('../public/modules/student.js'), battleUi = source('../public/modules/battle.js'), appUi = source('../public/app.js'), teacherUi = source('../public/modules/teacher.js');
  const css = source('../public/v13112.css'), build = source('./build-assets.mjs'), serviceSource = source('./service.mjs');
  assert(studentUi.includes('export function periodFolders(') && studentUi.includes("book.exam_period === 'final' ? 'final' : 'midterm'") && studentUi.includes("{ final: '기말고사', midterm: '중간고사' }") && studentUi.includes("['final', 'midterm'].map(period") && studentUi.includes('return groups.length > 1 ? groups :'), 'V13.112 범위 폴더는 책의 exam_period로 기말고사·중간고사를 나누고, 한 가지뿐인 학교는 폴더 없이 예전 그대로다');
  // (student.js: the definition and the 범위 picker of the teacher's student view)
  assert((studentUi.match(/periodFolders\(A,/g) || []).length === 2 && (battleUi.match(/periodFolders\(A,/g) || []).length === 1 && battleUi.includes('periodGroups(A, codes)') && (appUi.match(/periodFolders\(A,/g) || []).length === 3 && teacherUi.includes('periodGroups(A,') && /import \{[^}]*periodFolders[^}]*\} from '\.\/student\.js'/.test(battleUi) && /import \{[^}]*periodFolders[^}]*\} from '\.\/modules\/student\.js'/.test(appUi), 'V13.112 범위 고르기 폴더: 학습 범위 선택, 몬스터 범위 칩(1곳)과 야차전 단어 범위 창(V13.132: 같은 기말고사·중간고사 묶음을 탭으로), 선생님 시험 수정·연습 과제·대회 범위(3곳)와 선생님 단어장 칩이 기말고사·중간고사로 나뉜다');
  // 단어 학습 · 시험 설정 · 연습 시작 already had 모의고사 / 교과서 tabs: they get 기말고사 / 중간고사 tabs above them.
  assert(studentUi.includes('export function activePeriod(') && studentUi.includes('export function periodTabs(') && studentUi.includes("periodTabs(A, state.codes, 'data-memorize-period')") && studentUi.includes("periodTabs(A, state.codes, 'data-high-period')") && (studentUi.match(/inPeriod\(A, period, code\)/g) || []).length === 2 && appUi.includes('if (d.memorizePeriod || d.highPeriod) {') && appUi.includes('inPeriod(A, period, code) && (d.memorizeRangeType') && appUi.includes('inPeriod(A, period, code) && (d.highRangeType') && source('../public/modules/sessions.js').includes('.filter(code => inPeriod(A, shownPeriod, code))'), 'V13.112 단어 학습·시험 설정에는 기말고사 / 중간고사 탭이 모의고사 / 교과서 탭 위에 붙고, 연습을 시작할 때는 화면에 보이는 시험 구분의 범위만 쓴다');
  assert(studentUi.includes("const finalCodes = codes.filter(code => periodOfCode(A, code) === 'final');") && studentUi.includes('A.ranges[key] ??= (finalCodes.length ? finalCodes : codes).slice(0, 2);'), 'V13.112 아직 범위를 고르지 않은 학생은 기말고사 범위로 시작한다 (기말고사 단어가 없는 학교는 예전처럼 앞의 두 범위)');
  assert(css.includes('.range-folder.final>summary') && css.includes('.range-folder.midterm>summary') && css.includes('.range-folders{display:grid') && css.includes('min-height:48px') && css.includes('@media (prefers-reduced-motion:reduce)') && build.includes('"v13112.css"') && serviceSource.includes("exam_period === 'midterm' ? book : { ...book, exam_period: 'midterm' }") && serviceSource.includes('...ybmKimFinalBooks'), 'V13.112 폴더 CSS(손가락으로 누르기 좋은 높이, 움직임 줄이기)가 묶음에 들어 있고 서버가 중간고사 기본값과 기말고사 책을 책 목록에 넣는다');
}
