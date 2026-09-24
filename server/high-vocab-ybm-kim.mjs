// YBM(김은형) 공통영어2 · 사용자 제공 교과서 본문 1~2페이지만 기준.
// 본문 외 지문은 제외한다. 학생 암기용 핵심 어휘를 문맥 뜻으로 정리한다.
const makeBook = (lesson, entries) => {
  const bookId = `high:ybm-kim:common2:lesson${lesson}`;
  return {
    id: bookId, school_id: 'danwon-high', school: '단원고', division: 'high', grade: '고1',
    title: `공통영어2 YBM(김은형) ${lesson}과 본문`, source: 'teacher_source_textbook_pages_1_2',
    words: entries.map(([word, meaning, accepted_meanings = []], index) => ({
      id: `${bookId}:${String(index + 1).padStart(3, '0')}`, book_id: bookId,
      school_id: 'danwon-high', school: '단원고', division: 'high', grade: '고1',
      range_code: `L${lesson}`, order: index + 1, word, meaning,
      ...(accepted_meanings.length ? { accepted_meanings } : {})
    }))
  };
};

const lesson1 = [
 ['accountable','책임감 있는'],['nonprofit','비영리의'],['be committed to','~에 전념하다',['전념하다']],
 ['solution','해결책'],['community','공동체'],['inspirational','영감을 주는'],['combat','맞서 싸우다'],
 ['cyberbullying','사이버 폭력'],['innovative','혁신적인'],['application','애플리케이션, 응용 프로그램'],
 ['virtual','가상의'],['artificial intelligence','인공 지능'],['detect','감지하다'],['potentially','잠재적으로'],
 ['hurtful','상처를 주는'],['prompt','촉구하다'],['pause','잠시 멈추다'],['reconsider','재고하다'],
 ['offensive','공격적인'],['tragic','비극적인'],['prevent','막다, 예방하다'],['worldwide','전 세계적으로'],
 ['raise awareness','인식을 높이다'],['adolescent','청소년'],['discarded','버려진'],['self-taught','독학한'],
 ['inventor','발명가'],['engineer','공학자'],['be fascinated with','~에 매료되다',['매료되다']],
 ['electronics','전자 기기'],['experiment','실험'],['invention','발명품'],['transmitter','송신기'],
 ['outbreak','발병'],['affect','영향을 미치다'],['invaluable','매우 귀중한'],['provide','제공하다'],['educational','교육의']
];

const lesson2 = [
 ['deliver','배달하다'],['delivery','배달'],['be limited to','~에 국한되다',['국한되다']],['unique','독특한'],
 ['industry','산업'],['rank','순위를 매기다'],['standard','기준'],['popularity','인기'],['delivery fee','배달료'],
 ['purchase','구매하다'],['literally','말 그대로'],['scholar','학자'],['diary entry','일기 기록'],
 ['public service entrance exam','관리 채용 시험'],['historical','역사적인'],['document','기록물'],
 ['indicate','나타내다, 보여주다'],['specialized','전문화된'],['for a fee','돈을 받고'],['residence','거주지'],
 ['determine','결정하다'],['colonial','식민지의'],['professional','전문가'],['messenger','배달원, 메신저'],
 ['contact','연락하다'],['pick up','가지러 가다, 수거하다'],['rare','드문'],['be charged with','~을 맡다',['맡다']],
 ['bundle','묶음'],['unfailingly','변함없이'],['accurate','정확한'],['mutual','상호 간의'],['trust','신뢰'],
 ['hunger for','~에 대한 갈망',['갈망']],['pave the way for','~의 토대를 마련하다',['토대를 마련하다']],
 ['liberation','해방'],['upheaval','격변'],['fall apart','무너지다'],['urbanization','도시화'],
 ['economic development','경제 발전'],['flock to','~로 모여들다',['모여들다']],['concentrate','집중시키다'],
 ['boost','촉진하다'],['demand','수요']
];

export const ybmKimHighBooks = [makeBook(1, lesson1), makeBook(2, lesson2)];
