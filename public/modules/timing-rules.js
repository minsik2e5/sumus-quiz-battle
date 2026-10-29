// V13.180 10초 맞추기(놀이터): 숫자판이 처음 3초만 보이다가 숨겨지고, 속으로 세어 정확히 10.00초라고 생각할 때 버튼을 누른다.
// 오차(눌린 시간 − 목표)로 등급을 정한다. 서버(server/timing.mjs)가 판을 열고 · 시간을 확인하고 · 보상한다. 화면은 timing.js.
// 선생님 결정(2판): 난이도는 이지 하나(숫자 3초), 하루 기본 3판 + 공부(연습 끝내기 · 출석)로 최대 5판, ±1초 안부터 보상, 딱 10.00은 100코인.
// 도전권은 코인을 쓰지 않는다. 인형뽑기 집게권과는 따로 센다(SOURCES만 같은 결).

export const TIMING = {
  TARGET: 10000,            // 목표(ms)
  TARGETS: [10000],         // 다음에 5 · 7 · 15초를 넣을 자리(서버는 이 목록에 있는 것만 받는다)
  SHOW_MS: 3000,            // 숫자가 보이는 처음 시간(그 뒤 숨김)
  COUNTDOWN_MS: 3000,       // 시작 응답을 받은 뒤 3 · 2 · 1(서버도 이만큼을 빼고 잰다)
  FREE_DAILY: 3,            // 하루 기본 판
  SOURCES: ['practice', 'attend'], // 하루에 곳마다 1판 더(연습 끝내기 10문제 이상 · 출석) → 하루 최대 5판
  MIN_PRACTICE: 10,
  // 등급(오차 절댓값, ms 이하). ten은 숫자판이 정확히 10.00(0.01초 칸으로 반올림해 0).
  GRADES: { ten: 4, perfect: 50, great: 150, good: 400, close: 1000 },
  COINS: { ten: 100, perfect: 30, great: 15, good: 8, close: 4, miss: 0 },
  XP: { ten: 8, perfect: 6, great: 5, good: 4, close: 3, miss: 1 },
  TEN_DAILY: 1,             // 딱 10.00의 100코인은 하루 한 번(그 뒤 딱 10.00은 완벽 코인)
  COIN_DAILY: 150,          // 하루 코인 상한(딱 10.00 하루 한 번 + 완벽 하나 남짓: 허용 오차 안의 부정이 새는 양의 상한)
  // 운 감시: 최근 WINDOW판(서버가 시간을 믿은 판) 중 완벽 이상이 MAX판을 넘으면 이번 판은 코인을 '좋음'까지만, 순위 · 칭호 제외.
  //   사람은 완벽이 약 10 ~ 15%라 10판 중 5판을 넘는 일은 거의 없다(허용 오차 안에서 시간을 고쳐 보내는 부정을 막는다).
  LUCK_GUARD: { WINDOW: 10, MAX: 4 },
  MIN_MS: 2000,             // 이보다 빨리 누르면 실수(기록 · 보상 없음, 판은 쓴다)
  MAX_FACTOR: 2,            // 목표의 2배가 지나면 화면이 스스로 멈춘다(꽝)
  LIVE_MS: 60000,           // 시작 뒤 이 시간 안에 끝 신호가 없으면 무효
  // 서버 시간 확인: 서버가 잰 경과(시작 도착 ~ 끝 도착) − 카운트다운 − 화면이 잰 시간 = 남는 시간(왕복 지연 하나쯤).
  // 시작 직전 ping으로 서버가 잰 왕복(RTT, RTT_MAX까지)을 기준으로 ±(JITTER + RTT × JITTER_RATE) 안이면 화면 시간을 믿는다.
  GUARD: { RTT_MAX: 800, JITTER: 150, JITTER_RATE: .5, FLOOR: -40 },
  // V13.191 누른 순간: 이벤트 시각(e.timeStamp)이 처리 시각보다 이만큼 안쪽이면 믿는다(폰이 잠깐 버벅여 처리가 늦어도 누른 때로).
  STAMP_LAG: 1000,
  REVEAL_MS: 1400,          // 공개 연출 길이(숫자는 처음부터 멈춘 값 그대로, 빛만 켜진다)
  AVG_MIN: 5,               // 이번 주 평균 오차 순위에 들려면 이만큼 판
  BOARD_TOP: 20,
  PREVIEW_PLAYS: 30,        // 교사 미리보기 계정: 하루 판을 이만큼(순위 · 활동 기록에서는 빠진 계정)
  // V13.192 오늘의 챌린지: 하루 하나의 목표 시간으로 같은 학년대가 겨룬다. 선생님이 날짜별로 정하고, 안 정한 날은 자동(날짜 시드).
  //   목표 0.5 ~ 30초(0.01초 단위), 숫자 보임 0 · 1 · 2 · 3 · 5초(목표보다 짧게), 한 줄 메시지 30자. 오늘부터 13일 뒤까지 정할 수 있고 지난 14일만 남긴다.
  //   하루 1판(기본 판과 따로), 참여 보너스 8코인(하루 한 번, 하루 코인 상한 밖), 등급 코인은 기존 표 · 기존 하루 상한 안.
  DAILY: { MIN: 500, MAX: 30000, AUTO_MIN: 5000, AUTO_MAX: 15000, SHOWS: [0, 1000, 2000, 3000, 5000], AUTO_SHOW: 3000, AHEAD: 13, KEEP: 14, MSG: 30, PLAYS: 1, BONUS: 8, CHAMPS: 3 },
  GHOST_RECENT: 1           // 고스트: 가장 최근 판 하나(어제 기록이 없을 때 비교)
};
export const GRADE_KEYS = ['ten', 'perfect', 'great', 'good', 'close', 'miss'];
export const GRADE_NAMES = { ten: '딱 10.00!', perfect: '완벽', great: '훌륭', good: '좋음', close: '아쉬움', miss: '꽝', early: '너무 빨라요' };
// 색만으로 구분하지 않게 등급마다 기호도 붙인다.
export const GRADE_MARKS = { ten: '★', perfect: '◎', great: '○', good: '△', close: '▽', miss: '·', early: '!' };
export const TOP_GRADES = ['ten', 'perfect']; // 완벽 이상(칭호 · 연속 · 운 감시)

export const gradeOf = errMs => {
  const a = Math.abs(Number(errMs));
  if (!Number.isFinite(a)) return 'miss';
  return GRADE_KEYS.find(k => k !== 'miss' && a <= TIMING.GRADES[k]) || 'miss';
};
// 0.01초 단위로 반올림(화면 숫자와 서버 기록이 같다).
export const centi = ms => Math.round(Number(ms) / 10);
export const secText = ms => (Math.max(0, centi(ms)) / 100).toFixed(2);
export const errText = ms => { const c = centi(ms); return `${c > 0 ? '+' : c < 0 ? '−' : '±'}${(Math.abs(c) / 100).toFixed(2)}초`; };
export const errWord = ms => centi(ms) > 0 ? '늦음' : centi(ms) < 0 ? '빠름' : '딱!';
// 숫자판: 초 두 자리 : 1/100초 두 자리(99.99초까지).
export const ledDigits = ms => { const c = Math.max(0, Math.min(9999, centi(ms))); return String(c).padStart(4, '0').split(''); };
export const targetOk = t => TIMING.TARGETS.includes(Number(t));
// 오늘 할 수 있는 판(기본 + 공부로 받은 추가).
export const dailyPlays = (bonus = 0) => TIMING.FREE_DAILY + Math.max(0, Math.min(TIMING.SOURCES.length, Number(bonus) || 0));
// 허용 오차(ms): 서버가 잰 RTT로 정한다.
export function guardWindow(rtt) {
  const G = TIMING.GUARD, r = Math.max(0, Math.min(G.RTT_MAX, Number(rtt) || 0)), tol = G.JITTER + r * G.JITTER_RATE;
  return { rtt: r, lo: Math.max(G.FLOOR, r - tol), hi: r + tol };
}
// V13.191 누른 순간의 시각: 이벤트 시각이 같은 시계(0 < ts ≤ now)이고 STAMP_LAG 안이면 그것, 아니면 처리 시각.
export const pressStamp = (ts, now) => { ts = Number(ts); return Number.isFinite(ts) && ts > 0 && ts <= now && now - ts < TIMING.STAMP_LAG ? ts : now; };
// V13.191 공개 연출(선생님: "눌렀을 때 몇 초 더 갔다가 멈추는 현상"). 숫자는 누른 순간 그 값으로 바로 멈추고,
// 슬로모션 느낌은 빛으로만: 네온이 켜지듯 깜빡(켜짐 · 꺼짐 반복) → 점점 밝아짐. t(ms)마다 { ms: 보이는 숫자(언제나 멈춘 값), lit: 밝기 0~1, tick: 이 칸 시작에 째깍 }.
export const REVEAL_STEPS = [[0, 1, 1], [70, .12, 0], [150, 1, 1], [220, .18, 0], [330, 1, 1], [400, .3, 0], [520, 1, 1], [640, .55, 0], [760, 1, 1]];
export function revealAt(ms, t) {
  const step = [...REVEAL_STEPS].reverse().find(([at]) => t >= at) || REVEAL_STEPS[0];
  return { ms, lit: t >= TIMING.REVEAL_MS ? 1 : step[1], tick: !!step[2] };
}
// V13.192 오늘의 챌린지 ---------------------------------------------------------------
// 안 정한 날의 목표: 날짜 문자열 해시로 5.00 ~ 15.00초(0.01초 단위). 숨긴 값이 아니다(선생님 화면에서 미리 보인다).
export function autoDailyTarget(day) {
  let h = 2166136261;
  for (const ch of `sumus-daily-${day}`) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; }
  const D = TIMING.DAILY, steps = (D.AUTO_MAX - D.AUTO_MIN) / 10 + 1;
  return D.AUTO_MIN + (h % steps) * 10;
}
// 선생님이 넣은 값 검사(서버 · 화면 같이 쓴다). 맞으면 { t, s, m }, 아니면 오류 문구.
export function dailyCheck({ target_ms, show_ms, msg = '' } = {}) {
  const D = TIMING.DAILY, t = Number(target_ms), sh = Number(show_ms ?? D.AUTO_SHOW), m = String(msg ?? '').replace(/\s+/g, ' ').trim();
  if (!Number.isInteger(t) || t % 10 || t < D.MIN || t > D.MAX) return { error: `목표 시간은 ${secText(D.MIN)} ~ ${secText(D.MAX)}초, 소수 둘째 자리까지예요.` };
  if (!D.SHOWS.includes(sh)) return { error: '숫자 보이는 시간을 골라 주세요.' };
  if (sh && sh >= t) return { error: '숫자는 목표 시간보다 먼저 사라져야 해요.' };
  if ([...m].length > D.MSG) return { error: `메시지는 ${D.MSG}자까지예요.` };
  return { t, s: sh, m };
}
// 등급 이름: 목표가 10초가 아니면 '딱 7.77!'.
export const gradeName = (g, target = TIMING.TARGET) => g === 'ten' && Number(target) !== TIMING.TARGET ? `딱 ${secText(target)}!` : GRADE_NAMES[g];
// 고스트 비교 한 줄. prev: { k: 'yesterday' | 'last' | 'daily' | 'daily_old', e: 그때 오차(ms, 부호) }. 0.01초 단위로 비교한다.
const GHOST_WHO = { yesterday: ['어제', '어제와'], last: ['지난 판', '지난 판과'], daily: ['어제 챌린지', '어제 챌린지와'], daily_old: ['지난 챌린지', '지난 챌린지와'] };
export function ghostLine(err, prev) {
  if (!prev || prev.e == null || err == null || !Number.isFinite(Number(prev.e)) || !Number.isFinite(Number(err))) return '';
  const [who, withWho] = GHOST_WHO[prev.k] || GHOST_WHO.last, d = Math.abs(centi(prev.e)) - Math.abs(centi(err));
  if (d > 0) return `${who}보다 ${(d / 100).toFixed(2)}초 가까워졌어요`;
  if (!d) return `${withWho} 똑같은 오차예요`;
  return `${who}보다 ${(-d / 100).toFixed(2)}초 멀어졌어요. 다시 해 봐요!`;
}
// 낮은 등급도 격려하는 한 줄.
export const CHEERS = {
  ten: ['딱 10.00초! 오늘의 주인공!', '이건 전설이에요! 정확히 10.00!'],
  perfect: ['몸속에 시계가 있나 봐요!', '소름 돋는 정확도!', '이건 인간 초시계예요!'],
  great: ['거의 다 왔어요! 한 끗 차이!', '박자 감각이 살아 있어요!', '조금만 더 하면 완벽!'],
  good: ['감 잡았어요! 다음엔 더 가까이!', '좋은 리듬이에요!', '숫자를 떠올리며 세어 봐요!'],
  close: ['1초 안! 코인 받았어요. 다음엔 더 가까이!', '"하나-둘" 박자로 세어 봐요!'],
  miss: ['처음엔 다 그래요. 한 번 더!', '눈 감고 세면 더 잘 돼요!'],
  early: ['너무 빨랐어요! 숨 한 번 고르고 다시!']
};
