// Release checks for V13.248: 원일중 중2 YBM(박준언) 8과 — 기말고사 단어 (대화문 18 + 본문 34 = 52).
// Data: server/middle-vocab-grade2.mjs (middleGrade2FinalBooks). 기존 5·6·7과(중간고사)는 그대로다.
import { emptyState } from './state.mjs';
import { passwordHash } from './auth.mjs';
import { service, allBooks } from './service.mjs';
import { middleGrade2Books, middleGrade2FinalBooks } from './middle-vocab-grade2.mjs';
import { grade } from '../public/modules/core.js';

export async function runMiddleGrade2FinalChecks(assert) {
  /* ---------- the words ---------- */
  const [book] = middleGrade2FinalBooks, words = book.words, list = words.map(w => w.word);
  assert(middleGrade2FinalBooks.length === 1 && book.id === 'middle:ybm-park:grade2:final:lesson8' && book.exam_period === 'final' && book.school_id === 'wonil-middle' && book.school === '원일중' && book.division === 'middle' && book.grade === '중2' && book.title === '중2 YBM(박준언) 8과 (기말고사)', 'V13.248 원일중 중2 8과는 기말고사 책 한 권이다 (id에 :final:)');
  assert(words.length === 52 && list.indexOf('mix') === 17 && list.indexOf('difference') === 18 && list[0] === 'print' && list.at(-1) === 'popular' && new Set(list).size === 52, 'V13.248 8과는 대화문 18 + 본문 34 = 52개, 사진의 어휘 목록 순서다');
  assert(words.every((w, i) => w.id === `${book.id}:${String(i + 1).padStart(3, '0')}` && w.book_id === book.id && w.order === i + 1 && w.range_code === '8' && w.grade === '중2' && w.school_id === 'wonil-middle' && w.division === 'middle' && w.exam_period === 'final' && w.meaning.trim()), 'V13.248 8과 단어는 모두 범위 8 · 중2 · 원일중 · 기말고사이고 id는 순서 번호다');
  const find = name => words.find(w => w.word === name);
  assert(['scissors', 'laser', 'projector', 'cube', 'take part in ~', 'name A B after C', 'flop', 'come up with ~', 'although', "do one's best"].every(name => find(name)) && find('flop').meaning === '(높이뛰기에서) 등을 젖혀 뛰는 방식' && find('final').meaning === '결승전', 'V13.248 대화문(3D 프린터 등)과 본문(높이뛰기) 단어가 함께 들어 있다');
  assert(words.every(w => !/[a-z]+-[a-z]+-[a-z]+/.test(w.meaning)) && find('shoot').meaning === '~을 쏘다' && find('fall').meaning === '떨어지다' && find('lose').meaning === '(경기 등에서) 지다, 패배하다' && find('fly').meaning === '날다, 날아오르다', 'V13.248 활용형 괄호(shoot-shot-shot 등)는 뜻에 넣지 않는다');
  assert(grade('write_meaning', '가열하다', find('heat')) && grade('write_meaning', '데우다', find('heat')) && grade('write_meaning', '낯선', find('strange')) && grade('write_meaning', '패배하다', find('lose')) && grade('write_meaning', '흉부', find('chest')) && grade('write_meaning', '생각해 내다', find('come up with ~')) && !grade('write_meaning', '가위', find('heat')), 'V13.248 뜻이 둘 이상이면 어느 쪽을 써도 정답이다');

  /* ---------- 5·6·7과는 그대로 ---------- */
  assert(middleGrade2Books.map(b => `${b.id}:${b.words.length}:${b.exam_period || ''}`).join() === 'middle:ybm-park:grade2:lesson5:69:,middle:ybm-park:grade2:lesson6:66:,middle:ybm-park:grade2:lesson7:59:' && middleGrade2Books.some(b => b.words.some(w => w.word === "do one's best")), 'V13.248 기존 5·6·7과(69·66·59, 중간고사) id와 묶음은 그대로이고, 5과에도 있는 do one\'s best는 과마다 그대로 둔다');
  const books = allBooks({ extraBooks: [] }), byId = id => books.find(b => b.id === id);
  assert(['5', '6', '7'].every(n => byId(`middle:ybm-park:grade2:lesson${n}`).exam_period === 'midterm') && byId(book.id).exam_period === 'final', 'V13.248 5·6·7과는 중간고사, 8과는 기말고사로 묶인다');
  const all = books.flatMap(b => b.words || []);
  assert(new Set(all.map(w => w.id)).size === all.length, 'V13.248 8과 단어 id는 다른 책과 겹치지 않는다');

  /* ---------- 중2 학생만 본다 ---------- */
  const state = emptyState(), hash = await passwordHash('QaG2Final1!');
  const student = (id, extra) => ({ id, username: id, display_name: id, role: 'student', active: true, password_hash: hash, pets: [], created_at: new Date().toISOString(), ...extra });
  state.profiles.push(
    student('qa-g2f-2', { class_name: '중2', school_id: 'wonil-middle', school: '원일중', division: 'middle' }),
    student('qa-g2f-3', { class_name: '중3', school_id: 'wonil-middle', school: '원일중', division: 'middle' }),
    student('qa-g2f-h', { class_name: '고1A', school_id: 'danwon-high', school: '단원고', division: 'high' })
  );
  const boot = {};
  for (const [id, division] of [['qa-g2f-2', 'middle'], ['qa-g2f-3', 'middle'], ['qa-g2f-h', 'high']]) {
    const token = (await service(state, 'POST', '/login', { username: id, password: 'QaG2Final1!', division }, null))._cookie;
    boot[id] = await service(state, 'GET', '/bootstrap', {}, token);
  }
  const seen = id => boot[id].books.find(b => b.id === book.id);
  assert(seen('qa-g2f-2')?.words.length === 52 && seen('qa-g2f-2').exam_period === 'final' && ['5', '6', '7'].every(n => boot['qa-g2f-2'].books.find(b => b.id === `middle:ybm-park:grade2:lesson${n}`)?.exam_period === 'midterm'), 'V13.248 원일중 중2 학생은 8과(기말고사)와 5·6·7과(중간고사)를 함께 본다');
  assert(!seen('qa-g2f-3') && !seen('qa-g2f-h') && !boot['qa-g2f-3'].books.some(b => b.words.some(w => w.range_code === '8' && w.grade === '중2')), 'V13.248 8과는 중3과 고등부 학생에게 보이지 않는다');
}
