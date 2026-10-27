// V13.180 10초 맞추기(놀이터): 숫자판이 잠깐 보이다가 숨겨지고, 속으로 세어 정확히 10.00초라고 생각할 때 버튼을 누른다.
// 오차(눌린 시간 − 목표)로 등급을 정한다. 서버(server/timing.mjs)가 판을 열고 · 시간을 확인하고 · 보상한다. 화면은 timing.js.
// 도전권은 코인을 쓰지 않는다: 하루 무료 판 + 공부(연습 끝내기 · 출석)로 받는 추가 판. 인형뽑기 집게권과는 따로 센다(SOURCES만 같은 결).

export const TIMING = {
  TARGET: 10000,            // 기본 목표(ms)
  TARGETS: [10000],         // 다음에 5 · 7 · 15초를 넣을 자리(서버는 이 목록에 있는 것만 받는다)
  LEVELS: ['easy', 'normal', 'hard'],
  SHOW_MS: { easy: 3000, normal: 1000, hard: 0 }, // 숫자가 보이는 처음 시간(그 뒤 숨김)
  COUNTDOWN_MS: 3000,       // 시작 응답을 받은 뒤 3 · 2 · 1(서버도 이만큼을 빼고 잰다)
  FREE_DAILY: 5,            // 하루 무료 판
  SOURCES: ['practice', 'attend'], // 하루에 곳마다 추가 1판(연습 끝내기 10문제 이상 · 출석) → 하루 최대 7판
  MIN_PRACTICE: 10,
  // 등급(오차 절댓값, ms 이하). 숫자판 한 칸이 0.01초라 0.05초 = 다섯 칸.
  GRADES: { perfect: 50, great: 150, good: 400 },
  // 등급 · 난이도마다 코인(하루 COIN_DAILY까지) · 경험치(난이도와 상관없이)
  COINS: { easy: { perfect: 3, great: 2, good: 1, miss: 0 }, normal: { perfect: 5, great: 3, good: 2, miss: 1 }, hard: { perfect: 7, great: 5, good: 3, miss: 1 } },
  XP: { perfect: 4, great: 3, good: 2, miss: 1 },
  COIN_DAILY: 30,
  MIN_MS: 2000,             // 이보다 빨리 누르면 실수(기록 · 보상 없음, 판은 쓴다)
  MAX_FACTOR: 2,            // 목표의 2배가 지나면 화면이 스스로 멈춘다(아쉬움)
  LIVE_MS: 60000,           // 시작 뒤 이 시간 안에 끝 신호가 없으면 무효
  // 서버 시간 확인: 서버가 잰 경과(시작 도착 ~ 끝 도착) − 카운트다운 − 화면이 잰 시간 = 남는 시간(왕복 지연 하나쯤).
  // 시작 직전 ping으로 서버가 잰 왕복(RTT, RTT_MAX까지)을 기준으로 ±(JITTER + RTT × JITTER_RATE) 안이면 화면 시간을 믿는다.
  GUARD: { RTT_MAX: 800, JITTER: 150, JITTER_RATE: .5, FLOOR: -40 },
  AVG_MIN: 5,               // 이번 주 평균 오차 순위에 들려면 그 난이도에서 이만큼 판
  BOARD_TOP: 20,
  PREVIEW_PLAYS: 30         // 교사 미리보기 계정: 하루 판을 이만큼(순위 · 활동 기록에서는 빠진 계정)
};
export const LEVEL_NAMES = { easy: '이지', normal: '노말', hard: '하드' };
export const LEVEL_HINTS = { easy: '숫자 3초 보임', normal: '숫자 1초 보임', hard: '처음부터 숨김' };
export const GRADE_KEYS = ['perfect', 'great', 'good', 'miss'];
export const GRADE_NAMES = { perfect: '완벽', great: '훌륭', good: '좋음', miss: '아쉬움', early: '너무 빨라요' };
// 색만으로 구분하지 않게 등급마다 기호도 붙인다.
export const GRADE_MARKS = { perfect: '◎', great: '○', good: '△', miss: '·', early: '!' };

export const gradeOf = errMs => {
  const a = Math.abs(Number(errMs));
  if (!Number.isFinite(a)) return 'miss';
  return a <= TIMING.GRADES.perfect ? 'perfect' : a <= TIMING.GRADES.great ? 'great' : a <= TIMING.GRADES.good ? 'good' : 'miss';
};
// 0.01초 단위로 내림하지 않고 반올림(화면 숫자와 서버 기록이 같다).
export const centi = ms => Math.round(Number(ms) / 10);
export const secText = ms => (Math.max(0, centi(ms)) / 100).toFixed(2);
export const errText = ms => { const c = centi(ms); return `${c > 0 ? '+' : c < 0 ? '−' : '±'}${(Math.abs(c) / 100).toFixed(2)}초`; };
export const errWord = ms => centi(ms) > 0 ? '늦음' : centi(ms) < 0 ? '빠름' : '딱!';
// 숫자판: 초 두 자리 : 1/100초 두 자리(99.99초까지).
export const ledDigits = ms => { const c = Math.max(0, Math.min(9999, centi(ms))); return String(c).padStart(4, '0').split(''); };
export const levelOk = lv => TIMING.LEVELS.includes(lv);
export const targetOk = t => TIMING.TARGETS.includes(Number(t));
// 오늘 할 수 있는 판(무료 + 공부로 받은 추가).
export const dailyPlays = (bonus = 0) => TIMING.FREE_DAILY + Math.max(0, Math.min(TIMING.SOURCES.length, Number(bonus) || 0));
// 허용 오차(ms): 서버가 잰 RTT로 정한다.
export function guardWindow(rtt) {
  const G = TIMING.GUARD, r = Math.max(0, Math.min(G.RTT_MAX, Number(rtt) || 0)), tol = G.JITTER + r * G.JITTER_RATE;
  return { rtt: r, lo: Math.max(G.FLOOR, r - tol), hi: r + tol };
}
// 낮은 등급도 격려하는 한 줄.
export const CHEERS = {
  perfect: ['몸속에 시계가 있나 봐요!', '소름 돋는 정확도!', '이건 인간 초시계예요!'],
  great: ['거의 다 왔어요! 한 끗 차이!', '박자 감각이 살아 있어요!', '조금만 더 하면 완벽!'],
  good: ['감 잡았어요! 다음엔 더 가까이!', '좋은 리듬이에요!', '숫자를 떠올리며 세어 봐요!'],
  miss: ['처음엔 다 그래요. 한 번 더!', '1초에 "하나-둘" 박자로 세어 봐요!', '눈 감고 세면 더 잘 돼요!'],
  early: ['너무 빨랐어요! 숨 한 번 고르고 다시!']
};
