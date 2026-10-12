// YBM(박준언) 공통영어2 2과 어휘 — 선부고 2학기 기말고사 범위.
// 기준: EXAM4YOU 「2022 개정 | YBM(박준언) 공통영어2 Lesson 2 WORD TEST」의 교과서 어휘 목록 중
// READING | 본문(67개)과 FURTHER READING | 본문 외 지문(13개). 대화문(CONVERSATION)은 넣지 않는다.
// 뜻은 같은 PDF의 Answer Key(TEST 1), 품사는 어휘 목록 표기를 따른다. 순서는 어휘 목록 순서(본문 → 본문 외 지문).
//
// 두 묶음 모두 범위 코드 L2(학생 화면 "2과", 교과서 탭)에 들어가고, 단어마다 section으로 구분한다.
// 기말고사 책이라 exam_period: 'final'(service.mjs allBooks, student.js periodGroups).
// id는 이 순서 번호(001…)이고 다시 매기지 않는다. 다른 학교 책과 접두어가 달라 id가 겹치지 않는다.
const PLACE = { school_id: 'seonbu-high', school: '선부고', division: 'high' };
const PREFIX = 'high:ybm-park:seonbu:final:common2';
export const YBM_PARK_FINAL_PERIOD = 'final';

const reading = [
  ["tap", "(수도·가스 등의) 꼭지", "n."],
  ["cough", "기침을 하다", "v."],
  ["spit", "침을 뱉다", "v."],
  ["shout ~ out", "(갑자기) (~을) 크게 외치다", "phrase"],
  ["shush", "(조용히 하라고 명령할 때) 쉿, 조용히", "int."],
  ["anchor", "(뉴스의) 앵커, 진행자", "n."],
  ["flow", "(액체·기체·전기 등의) 흐름", "n."],
  ["crisis", "위기", "n."],
  ["drought", "가뭄", "n."],
  ["tired of ~", "~에 싫증이 난, ~이 지겨운", "phrase"],
  ["running water", "수돗물", "phrase"],
  ["pull into ~", "~에 차를 대다", "phrase"],
  ["parking lot", "주차장", "n."],
  ["Black Friday", "추수감사절 다음 금요일(상점들이 크리스마스 쇼핑객을 위해 할인하는 날)", "n."],
  ["after ~", "~을 찾고 있는", "prep."],
  ["checkout", "계산대", "n."],
  ["essentials", "필수적인 것", "n."],
  ["look", "표정", "n."],
  ["impatience", "조급함", "n."],
  ["hostility", "적대심", "n."],
  ["thin", "거의 없는 수준의, 미약한", "a."],
  ["layer", "층, 겹", "n."],
  ["politeness", "정중함", "n."],
  ["stretch", "~을 늘이다", "v."],
  ["approach", "~에 접근하다", "v."],
  ["empty", "빈; 비우다", "a./v."],
  ["manage", "(어떻게든) ~하다[해내다]", "v."],
  ["try one's luck", "운을 걸고 해보다", "v."],
  ["place", "~을 놓다[두다]", "v."],
  ["unwanted", "원하지[필요하지] 않는", "a."],
  ["abandon", "(물건·장소를) 버리고 떠나다", "v."],
  ["commodity", "(유용한) 것", "n."],
  ["reach for ~", "(~을 잡으려) 손을 뻗다", "phrase"],
  ["stack", "쌓다", "v."],
  ["recognize", "알아보다", "v."],
  ["lean", "몸을 기울이다", "v."],
  ["return the favor", "은혜를 갚다", "phrase"],
  ["deep", "(색깔이) 짙은", "a."],
  ["flush", "홍조", "n."],
  ["aisle", "통로", "n."],
  ["remind", "상기시키다", "v."],
  ["pile", "쌓다", "v."],
  ["take notice", "알아차리다, 주목하다", "phrase"],
  ["ridiculously", "터무니없이, 말도 안 되게", "adv."],
  ["come up", "다가오다[가다]", "phrase"],
  ["grab", "~을 잡아채다, ~을 확 움켜쥐다", "v."],
  ["return", "(미소·인사 등)에 (똑같이) 답하다", "v."],
  ["bring out the best in ~", "~의 장점을 이끌어내다", "phrase"],
  ["favor", "호의", "n."],
  ["deserve", "~을 받을만하다", "v."],
  ["fade", "점차 사라지다, 희미해지다", "v."],
  ["scare", "겁주다", "v."],
  ["firmly", "단단히", "adv."],
  ["lock", "고정시키다", "v."],
  ["prove", "입증[증명]하다", "v."],
  ["bitter", "분한, 억울해 하는", "a."],
  ["shorten", "짧게 하다", "v."],
  ["version", "버전, 판(版)", "n."],
  ["tough", "어려운, 힘든", "a."],
  ["disastrous", "끔찍한, 재앙과도 같은", "a."],
  ["resume", "재개되다", "v."],
  ["provided (that) ~", "만약 ~라면", "phrase"],
  ["contribute to ~", "~의 요인이 되다", "phrase"],
  ["shortage", "부족", "n."],
  ["address", "~을 다루다, ~에 대처하다", "v."],
  ["population", "인구", "n."],
  ["agriculture", "농업", "n."],
];
const further = [
  ["known as ~", "~으로 알려진", "phrase"],
  ["water level", "수위", "n."],
  ["retreat", "멀어져 가다, 물러가다", "v."],
  ["visible", "(눈에) 보이는", "a."],
  ["significant", "중요한", "a."],
  ["bear", "~을 지니다", "v."],
  ["severe", "극심한", "a."],
  ["harvest", "수확량, 작황", "n."],
  ["hardship", "어려움[곤란]", "n."],
  ["urge", "촉구[권고]하다", "v."],
  ["occasional", "때때로의, 가끔씩의", "a."],
  ["persist", "~이 계속되다, 지속되다", "v."],
  ["predict", "예측하다", "v."],
];

const makeBook = (lesson, sections) => {
  const bookId = `${PREFIX}:lesson${lesson}`;
  const tags = { ...PLACE, exam_period: YBM_PARK_FINAL_PERIOD };
  const entries = sections.flatMap(([section, list]) => list.map(entry => [...entry, section]));
  return {
    id: bookId, ...tags,
    title: `공통영어2 YBM(박준언) ${lesson}과 본문·본문 외 지문 (기말고사)`, source: 'exam4you_word_test_2026_10',
    words: entries.map(([word, meaning, part_of_speech, section], index) => ({
      id: `${bookId}:${String(index + 1).padStart(3, '0')}`, book_id: bookId, ...tags,
      range_code: `L${lesson}`, order: index + 1, word, meaning, part_of_speech, section
    }))
  };
};

export const ybmParkSeonbuBooks = [makeBook(2, [['본문', reading], ['본문 외 지문', further]])];
export const YBM_PARK_SEONBU_COUNTS = { reading: reading.length, further: further.length };
