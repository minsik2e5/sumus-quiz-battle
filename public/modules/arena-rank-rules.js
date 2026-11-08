// V13.234 펫 아레나 랭크 시즌(구성안 docs/pet-arena-v2-plan.md 6장). 서버(server/arena-rank.mjs)와 화면이 같이 쓰는 규칙.
//   티어: 브론즈 · 실버 · 골드 · 플래티넘 · 다이아, 티어마다 III → II → I(100점씩). 점수는 RP(랭크 점수).
//   RP는 코인 판(혼자 판 · 친구 실시간 판)의 승패로만 오르내린다. 연습 판 · 연습 상대(컴퓨터 팀) · 컴퓨터 빈자리 판 · 같은 친구 하루 3판째부터는 빼고.
//   시즌: 월요일(한국 시간 0시)부터 4주. 번호 · 시작 · 끝은 날짜로만 계산한다(저장하지 않음). 끝나면 한 티어 내려서 다시 시작(소프트 리셋).
//   보상: 시즌 최고 티어에 따라 코인 조금 + 칭호(titles.js 'arena-*'). 새 재화는 없다.

export const RANK = {
  EPOCH: Date.UTC(2026, 10, 1, 15),  // 2026-11-02(월) 0시(한국 시간) = 시즌 1 시작
  SEASON_MS: 28 * 86400000,          // 4주
  DIV: 100,                          // 한 단계(III → II → I) 100점
  WIN: 20,                           // 이기면 기본 +20
  LOSE: 16,                          // 지면 기본 −16
  STRENGTH: [0.75, 1.3],             // 상대 힘 보정(센 상대를 이기면 더, 약한 상대에게 지면 더 깎임)
  STREAK_STEP: 2, STREAK_MAX: 3,     // 연승 보너스: 2연승 +2, 3연승 +4, 4연승부터 +6
  BRONZE_LOSS: 0.5,                  // 브론즈는 잘 안 떨어지게(깎이는 점수 절반)
  SECOND_LOSS: 0.5,                  // 난투 2등은 절반만 깎인다
  MIN_GAMES: 3,                      // 시즌 보상은 그 시즌 랭크 판 3판 이상
  HIST: 4,                           // 지난 시즌 기록은 최근 4개만(경기장 꾸미기가 읽을 '시즌 기록')
  TOP: 20                            // 랭킹 탭 상위 20명
};

export const RANK_TIERS = [
  { key: 'bronze', name: '브론즈', min: 0, color: '#c47a3c' },
  { key: 'silver', name: '실버', min: 300, color: '#aeb8c2' },
  { key: 'gold', name: '골드', min: 600, color: '#e9a800' },
  { key: 'platinum', name: '플래티넘', min: 900, color: '#3fd0b5' },
  { key: 'diamond', name: '다이아', min: 1200, color: '#6fb8ff' }
];
// 시즌 끝 최고 티어마다 코인(기존 코인, 소량). 칭호는 titles.js가 따로 준다.
export const SEASON_COINS = [10, 20, 30, 45, 60];
const DIV_KO = ['III', 'II', 'I'];

const n0 = v => Math.max(0, Math.round(Number(v) || 0));
export const tierIndex = rp => RANK_TIERS.reduce((i, t, k) => (n0(rp) >= t.min ? k : i), 0);
// tierOf(720) → { i: 2, key: 'gold', name: '골드', div: 'II', label: '골드 II', floor: 700, next: 800, pct: 20 }
export function tierOf(rp) {
  const v = n0(rp), i = tierIndex(v), t = RANK_TIERS[i];
  const step = Math.min(2, Math.floor((v - t.min) / RANK.DIV));
  const floor = t.min + step * RANK.DIV, top = i === RANK_TIERS.length - 1 && step === 2;
  const next = top ? null : floor + RANK.DIV;
  return { i, key: t.key, name: t.name, color: t.color, step, div: DIV_KO[step], label: `${t.name} ${DIV_KO[step]}`, floor, next, pct: next ? Math.round((v - floor) / RANK.DIV * 100) : 100 };
}

// 시즌: 2026-11-02(월)부터 4주씩. 그 전 시간도 시즌 1로 본다.
export function seasonOf(now = Date.now()) {
  const no = Math.max(0, Math.floor((Number(now) - RANK.EPOCH) / RANK.SEASON_MS)) + 1;
  const start = RANK.EPOCH + (no - 1) * RANK.SEASON_MS, end = start + RANK.SEASON_MS;
  return { no, start, end, days_left: Math.max(1, Math.ceil((end - Number(now)) / 86400000)) };
}

// 소프트 리셋: 한 티어 내려서 시작(골드 II 700 → 실버 II 400). 다이아는 플래티넘 III(900)부터, 브론즈는 0.
export const softReset = rp => n0(rp) >= RANK_TIERS[4].min ? RANK_TIERS[3].min : Math.max(0, Math.floor((n0(rp) - 300) / RANK.DIV) * RANK.DIV);

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
// RP 오르내림. ratio: 상대 힘 ÷ 내 힘(혼자 판: 팀 힘, 친구 판: 상대 RP로 만든 값). streak: 이번 판까지 연승(이기면 1부터).
//   place: 난투 등수(2등이면 덜 깎임). 무승부는 0.
export function rpDelta({ win, draw = false, rp = 0, ratio = 1, streak = 0, place = 0 }) {
  if (draw) return 0;
  const r = clamp(Number(ratio) || 1, RANK.STRENGTH[0], RANK.STRENGTH[1]);
  if (win) return Math.round(RANK.WIN * r) + Math.min(RANK.STREAK_MAX, Math.max(0, Number(streak) - 1)) * RANK.STREAK_STEP;
  let loss = RANK.LOSE * clamp(1 / r, RANK.STRENGTH[0], RANK.STRENGTH[1]);
  if (tierIndex(rp) === 0) loss *= RANK.BRONZE_LOSS;
  if (Number(place) === 2) loss *= RANK.SECOND_LOSS;
  return -Math.min(n0(rp), Math.max(1, Math.round(loss)));
}
// 친구 실시간 판의 상대 힘: 상대(들) 평균 RP와 내 RP 차이 1,000점이면 ±100%(위 STRENGTH 범위 안으로 잘린다).
export const rpRatio = (mine, others = []) => others.length ? 1 + (others.reduce((s, x) => s + n0(x), 0) / others.length - n0(mine)) / 1000 : 1;
export const seasonCoins = bestRp => SEASON_COINS[tierIndex(bestRp)] || 0;
