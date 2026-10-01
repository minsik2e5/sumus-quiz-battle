// V13.82 문법 증권거래소: pretend shares named after grammar terms, bought and sold with coins.
// Prices move every hour on the hour (server/market.mjs draws them from a secret seed, so nobody
// can work out the next price). Shared by the server (which decides) and the app (which draws).
//   base   the price the share keeps coming back to
//   vol    how much it moves in an hour (0.03 = about 3%)
//   tip    the grammar point behind the name, shown on the share's page
export const STOCKS = [
  { key: 'POS8', name: '8품사홀딩스', short: '8품사', base: 150, vol: 0.025, color: '#2f6fed', tip: '명사·대명사·동사·형용사·부사·전치사·접속사·감탄사. 모든 문법의 기초 대장주!' },
  { key: 'REL', name: '관대전자', short: '관계대명사', base: 120, vol: 0.04, color: '#e8590c', tip: 'who·which·that·whose·whom. 앞의 명사를 꾸미는 절을 이끌어요. 뒤는 불완전한 문장!' },
  { key: 'RADV', name: '관부건설', short: '관계부사', base: 90, vol: 0.045, color: '#0ca678', tip: 'when·where·why·how. 뒤에 완전한 문장이 와요. 관계부사 = 전치사 + which.' },
  { key: 'PART', name: '분사화학', short: '분사', base: 80, vol: 0.05, color: '#ae3ec9', tip: '-ing는 능동·진행, p.p.는 수동·완료. 감정동사는 사람이 느끼면 p.p.!' },
  { key: 'GER', name: '동명사식품', short: '동명사', base: 60, vol: 0.035, color: '#f59f00', tip: 'enjoy·finish·mind·avoid 뒤에는 -ing. 동사인데 명사처럼 써요.' },
  { key: 'INF', name: '투부정모터스', short: 'to부정사', base: 100, vol: 0.04, color: '#1098ad', tip: 'want·hope·decide 뒤에는 to부정사. 명사·형용사·부사 역할을 다 해요.' },
  { key: 'SUBJ', name: '가정법엔터', short: '가정법', base: 70, vol: 0.07, color: '#d6336c', tip: 'If + 과거, 주어 + would + 동사원형: 현재 사실의 반대. 변동성 최고 테마주!' },
  { key: 'PASS', name: '수동태물산', short: '수동태', base: 110, vol: 0.03, color: '#5c7cfa', tip: 'be + p.p. (+ by 행위자). 목적어가 주어 자리로 와요.' },
  { key: 'PERF', name: '완료시제항공', short: '완료시제', base: 130, vol: 0.03, color: '#20c997', tip: 'have + p.p.: 과거에 시작해 지금까지. 명백한 과거 표현(yesterday, ago)과는 못 써요.' },
  { key: 'CONJ', name: '접속사통신', short: '접속사', base: 50, vol: 0.055, color: '#868e96', tip: 'and·but·or·so, because·although·while. 문장과 문장을 이어 줘요.' }
];
export const STOCK_KEYS = STOCKS.map(s => s.key);
export const stockOf = key => typeof key === 'string' ? STOCKS.find(s => s.key === key) || null : null;
export const MARKET = {
  fee: 0.01,          // 수수료 1% (rounded up, at least 1 coin) on every buy and sell
  max_qty: 50,        // shares in one order
  max_hold: 100,      // shares of one stock a student may hold
  daily_trades: 30,   // orders a day
  history: 48,        // hourly prices shown on the chart
  revert: 0.06,       // how strongly a price is pulled back toward its base each hour
  news_rate: 0.04,    // chance of a news jump in an hour
  min_x: 0.3,         // a price stays between 0.3× and 3× its base
  max_x: 3
};
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
