// V13.82 문법 증권거래소: pretend shares named after grammar terms, bought and sold with coins.
// Prices move every 10 minutes (V13.87; server/market.mjs draws them from a secret seed, so
// nobody can work out the next price). Shared by the server (which decides) and the app (which draws).
//   base   the price the share keeps coming back to
//   vol    how much it moves in an hour (0.03 = about 3%; a 10-minute step moves less)
//   tip    the grammar point behind the name, shown on the share's page
//   ex     an example sentence, with the point in [brackets]
//   trap   the mistake students make most with it
// V13.87 open (원장님 확인): real coins. The quiz for 내부 정보 lives on the server only
// (server/market-quiz.mjs), so the answers never reach a browser.
export const MARKET_OPEN = true;
export const STOCKS = [
  { key: 'POS8', name: '8품사홀딩스', short: '8품사', base: 150, vol: 0.025, color: '#2f6fed', tip: '명사·대명사·동사·형용사·부사·전치사·접속사·감탄사. 모든 문법의 기초 대장주!', ex: 'She [quickly] [ran] [to] the [park].', trap: '부사(quickly)·동사(ran)·전치사(to)·명사(park). 같은 단어도 문장 속 역할에 따라 품사가 바뀌어요(a fast car / run fast).' },
  { key: 'REL', name: '관대전자', short: '관계대명사', base: 120, vol: 0.04, color: '#e8590c', tip: 'who·which·that·whose·whom. 앞의 명사를 꾸미는 절을 이끌어요. 뒤는 불완전한 문장!', ex: 'I have a friend [who] lives in Busan.', trap: '관계대명사 뒤에는 주어나 목적어가 빠진 불완전한 문장이 와요. what은 앞에 꾸밀 명사(선행사)가 없을 때만!' },
  { key: 'RADV', name: '관부건설', short: '관계부사', base: 90, vol: 0.045, color: '#0ca678', tip: 'when·where·why·how. 뒤에 완전한 문장이 와요. 관계부사 = 전치사 + which.', ex: 'This is the town [where] I was born.', trap: '관계부사 뒤에는 완전한 문장이 와요. the way how는 함께 못 써요(the way 또는 how 하나만).' },
  { key: 'PART', name: '분사화학', short: '분사', base: 80, vol: 0.05, color: '#ae3ec9', tip: '-ing는 능동·진행, p.p.는 수동·완료. 감정동사는 사람이 느끼면 p.p.!', ex: 'The movie was [boring], so I was [bored].', trap: '감정동사: 감정을 주면 -ing(boring), 감정을 느끼면 p.p.(bored). 꾸미는 명사와 능동·수동 관계를 따져요.' },
  { key: 'GER', name: '동명사식품', short: '동명사', base: 60, vol: 0.035, color: '#f59f00', tip: 'enjoy·finish·mind·avoid 뒤에는 -ing. 동사인데 명사처럼 써요.', ex: 'I enjoy [playing] soccer after school.', trap: 'enjoy·finish·mind·avoid·give up 뒤에는 to부정사가 아니라 -ing! 전치사 뒤에도 동명사(be good at swimming).' },
  { key: 'INF', name: '투부정모터스', short: 'to부정사', base: 100, vol: 0.04, color: '#1098ad', tip: 'want·hope·decide 뒤에는 to부정사. 명사·형용사·부사 역할을 다 해요.', ex: 'I decided [to study] English every day.', trap: 'want·hope·decide·plan 뒤에는 to부정사. stop to ~(~하려고 멈추다)와 stop -ing(~을 그만두다)는 뜻이 달라요.' },
  { key: 'SUBJ', name: '가정법엔터', short: '가정법', base: 70, vol: 0.07, color: '#d6336c', tip: 'If + 과거, 주어 + would + 동사원형: 현재 사실의 반대. 변동성 최고 테마주!', ex: 'If I [were] a bird, I [could fly] to you.', trap: '현재 사실의 반대는 If + 과거(be동사는 were), 주절은 would/could + 동사원형. 시제가 하나 뒤로 가요.' },
  { key: 'PASS', name: '수동태물산', short: '수동태', base: 110, vol: 0.03, color: '#5c7cfa', tip: 'be + p.p. (+ by 행위자). 목적어가 주어 자리로 와요.', ex: 'The window [was broken] by Tom.', trap: 'be동사 + p.p.! 목적어가 없는 동사(happen, arrive, disappear)는 수동태로 못 써요.' },
  { key: 'PERF', name: '완료시제항공', short: '완료시제', base: 130, vol: 0.03, color: '#20c997', tip: 'have + p.p.: 과거에 시작해 지금까지. 명백한 과거 표현(yesterday, ago)과는 못 써요.', ex: 'I [have lived] here for three years.', trap: '현재완료는 yesterday·last week·ago 같은 분명한 과거 표현과 같이 못 써요. for(기간)·since(시작 시점)와 잘 어울려요.' },
  { key: 'CONJ', name: '접속사통신', short: '접속사', base: 50, vol: 0.055, color: '#868e96', tip: 'and·but·or·so, because·although·while. 문장과 문장을 이어 줘요.', ex: 'I stayed home [because] it rained.', trap: 'because 뒤에는 문장(주어+동사), because of 뒤에는 명사구. although(비록 ~지만)는 but과 함께 쓰지 않아요.' }
];
export const STOCK_KEYS = STOCKS.map(s => s.key);
export const stockOf = key => typeof key === 'string' ? STOCKS.find(s => s.key === key) || null : null;
export const MARKET = {
  tick_min: 10,       // V13.87 prices move every 10 minutes
  fee: 0.005,         // 수수료 0.5% (V13.87; rounded up, at least 1 coin) on every buy and sell
  max_qty: 50,        // shares in one order
  max_hold: 100,      // shares of one stock a student may hold
  daily_trades: 30,   // orders a day
  history: 48,        // prices shown on the chart (48 × 10 minutes = 8 hours)
  tick_vol: 0.6,      // a 10-minute step moves this much of a share's hourly `vol`
  revert: 0.02,       // how strongly a price is pulled back toward its base each step
  news_rate: 0.012,   // chance of a news jump in a step
  min_x: 0.3,         // a price stays between 0.3× and 3× its base
  max_x: 3,
  hints_daily: 3,     // V13.87 내부 정보: grammar quizzes a day, each a hint on the price ahead
  hint_ticks: 6,      // the hint is about the price an hour (6 steps) later: a 10-minute move is
                      // often smaller than the 2% a buy and a sell cost, an hour's is not
  hint_acc: 0.75      // a hint is right 3 times in 4. Simulated: following an 'up' hint for an
                      // hour gains on 2 trades in 3; buying without one loses a little (fees)
};
export const TICK_MS = MARKET.tick_min * 60000;
export const tradeFee = amount => amount > 0 ? Math.max(1, Math.ceil(amount * MARKET.fee)) : 0;
// News lines for an hour with a jump (`pick` chooses the line).
const NEWS_UP = ['{n}, 이번 학평 출제 1순위 소식!', '“{s}{는} 꼭 나온다” 선생님 발언에 매수세 폭발', '{s} 문제 맞힌 학생 급증!', '{n}, 교과서 비중 확대 발표', '{s} 문제집 품절 대란'];
const NEWS_DOWN = ['{n}, 헷갈린다는 학생 속출', '{s} 오답률 상승 소식에 약세', '{n}, 이번 시험 범위에서 빠질 듯', '{s} 단원 진도 연기 소식', '“{s} 너무 어려워요” 민원 폭주'];
export function newsText(item) {
  const s = stockOf(item?.key);
  if (!s) return '';
  const list = item.up ? NEWS_UP : NEWS_DOWN;
  // 은/는 by the last letter of the term (가정법은, 분사는).
  const last = s.short.charCodeAt(s.short.length - 1), batchim = last >= 0xac00 && last <= 0xd7a3 && (last - 0xac00) % 28 > 0;
  return list[Math.abs(Number(item.pick) || 0) % list.length].replace('{n}', s.name).replace('{s}', s.short).replace('{는}', batchim ? '은' : '는');
}
