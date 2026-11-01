// V13.205 야바위(놀이터, 타짜풍). 딜러 곽 사장이 컵 밑에 공을 보여 주고 섞는다. 학생은 공이 든 컵을 끝까지 눈으로 따라가 고른다.
// 판은 서버가 만든다(server/yabawi.mjs): 처음 공 자리 · 맞바꾸는 순서 · 밑장빼기(가끔 공을 몰래 옮김)까지. 화면은 그대로 보여 주기만 한다.
// 판돈은 가위바위보와 같다: 맞히면 ×2, 받거나 '묻고 더블로 가'(다음 판은 더 어렵다) → ×4 → ×8에서 끝.
// 밑장빼기를 본 순간 '동작 그만!'을 누르면 그 판은 바로 이긴다. 없을 때 누르면 그 판엔 다시 못 누른다(코인은 안 잃는다).
export const YABAWI = {
  BETS: [10, 20, 30],
  DAILY: 5,
  MAX_WINS: 3,
  STALE_MS: 10 * 60000,
  // 판마다(이긴 수 0 · 1 · 2): 컵 수, 맞바꾸는 횟수, 한 번 맞바꾸는 시간(ms), 밑장빼기 확률.
  ROUNDS: [
    { cups: 3, swaps: 6, ms: 560, cheat: 0 },
    { cups: 4, swaps: 9, ms: 430, cheat: 0.35 },
    { cups: 6, swaps: 13, ms: 340, cheat: 0.55 }
  ],
  SHOW_MS: 1600,       // 섞기 전에 공을 보여 주고 덮는 시간
  CHEAT_MS: 420,       // 밑장빼기 장면(맞바꾸기 사이에 끼어든다)
  CATCH_STEPS: 2,      // 밑장빼기 뒤 맞바꾸기 2번이 끝나기 전까지 '동작 그만'이 통한다
  MIN_SHARE: 0.6       // 섞는 시간의 이 비율보다 빨리 고르면 받지 않는다(화면을 건너뛴 요청)
};

// 판 하나의 섞는 시간(공 보여 주기 + 맞바꾸기 + 밑장빼기 장면).
export function roundMs(round) {
  return YABAWI.SHOW_MS + round.swaps.length * round.ms + (round.cheat ? YABAWI.CHEAT_MS : 0);
}
// 밑장빼기 장면이 나오는 때(판 시작부터 ms).
export function cheatMs(round) {
  return round.cheat ? YABAWI.SHOW_MS + (round.cheat.at + 1) * round.ms : Infinity;
}
// 맞바꾸기가 `done`번 끝났을 때 공이 있는 자리. 밑장빼기는 맞바꾸기 cheat.at이 끝난 바로 뒤에 공을 cheat.to로 옮긴다.
export function ballAt(round, done = round.swaps.length) {
  let b = round.start;
  for (let i = 0; i < Math.min(done, round.swaps.length); i++) {
    const [x, y] = round.swaps[i];
    if (b === x) b = y; else if (b === y) b = x;
    if (round.cheat && i === round.cheat.at) b = round.cheat.to;
  }
  return b;
}
// '동작 그만'이 밑장빼기를 잡았는지: 맞바꾸기가 `stop`번 끝났을 때 눌렀다.
export function caughtCheat(round, stop) {
  if (!round?.cheat || !Number.isInteger(stop)) return false;
  return stop >= round.cheat.at + 1 && stop <= round.cheat.at + YABAWI.CATCH_STEPS;
}
// 컵 자리(가로 %, 세로 %). 3 · 4개는 한 줄, 6개는 2 × 3(보낸 그림처럼).
export function slotXY(cups, i) {
  if (cups <= 4) return { x: (i + 0.5) / cups * 100, y: 50 };
  const row = Math.floor(i / 3), col = i % 3;
  return { x: (col + 0.5) / 3 * 100, y: row ? 74 : 26 };
}
