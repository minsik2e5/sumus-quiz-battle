import { shuffle, displayEnglish } from './core.js';

// V13.149 짝 맞추기 타임어택(Quizlet 매치 방식): 영어 카드 6장과 뜻 카드 6장을 짝지어 모두 지우는 시간.
// 틀리면 1초를 더한다. 화면은 match-game.js, 보상 · 기록은 server/games.mjs.
export const MATCH = {
  PAIRS: 6,
  PENALTY_MS: 1000,
  STARS: [18000, 28000],   // 3별: 18초 안, 2별: 28초 안, 1별: 다 지우면
  COUNTDOWN_MS: 3000,
  MIN_MS_PER_PAIR: 450,    // 사람 손으로 한 쌍에 이보다 빠를 수 없다(서버가 거른다)
  DAILY: 5,                // 하루에 코인을 받는 판
  COINS: { 3: 6, 2: 4, 1: 2 },
  RECORD_COINS: 5,         // 내 최고 기록을 깨면(하루 한 번)
  XP: 6
};
export const matchStars = ms => ms <= MATCH.STARS[0] ? 3 : ms <= MATCH.STARS[1] ? 2 : 1;
// 카드에는 뜻의 첫 갈래만(긴 뜻은 카드에 다 들어가지 않는다).
export const cardMeaning = meaning => String(meaning || '').split(/[,;·/]|\s\(/)[0].replace(/[()]/g, '').trim();

// 짝 6개: 영어도 뜻도 서로 다른 단어로. `missed`(틀린 단어 id)를 먼저 넣는다(복습).
export function matchPick(words, { missed = [], random = Math.random, pairs = MATCH.PAIRS } = {}) {
  const miss = new Set(missed.map(String));
  const pool = [...shuffle((words || []).filter(w => miss.has(String(w.id))), random), ...shuffle((words || []).filter(w => !miss.has(String(w.id))), random)];
  const out = [], seenEn = new Set(), seenKo = new Set();
  for (const w of pool) {
    const en = displayEnglish(w.word || '').trim(), ko = cardMeaning(w.meaning);
    if (!en || !ko || en.length > 22 || ko.length > 16) continue;
    if (seenEn.has(en.toLowerCase()) || seenKo.has(ko)) continue;
    seenEn.add(en.toLowerCase()); seenKo.add(ko);
    out.push({ id: w.id, en, ko });
    if (out.length >= pairs) break;
  }
  return out;
}
// 시간 글: 12.34초
export const matchTime = ms => `${(Math.max(0, ms) / 1000).toFixed(2)}초`;

// V13.150 러시 모드: 60초에서 시작해 짝을 지울 때마다 시간이 늘고(짝이 쌓일수록 조금씩 덜), 틀리면 줄어든다.
// 보드에는 늘 5쌍, 지우면 새 단어가 채워진다. 시간이 0이 되면 끝, 점수는 지운 짝 수.
// 서버는 짝 수 · 틀린 수로 판이 가질 수 있는 시간 범위(rushBounds)를 정확히 계산해 부정 기록을 거른다.
export const RUSH = {
  START_MS: 60000,
  BOARD: 5,                // 늘 보이는 짝
  HIT_MS: 2000,            // 첫 짝의 보너스 시간
  DECAY_MS: 40,            // 짝마다 보너스가 이만큼 준다
  MIN_HIT_MS: 800,         // 보너스는 이보다 작아지지 않는다
  COMBO_AT: 3,             // 연속 3쌍부터 콤보 보너스
  COMBO_MS: 700,
  MISS_MS: 3000,
  CHECKS: [[10, 2], [20, 4], [30, 6], [40, 8]], // 체크포인트(짝 수, 코인)
  RECORD_COINS: 5,
  BAIT_AT: 30,             // 30쌍 이상이면 낚시 미끼
  XP: 6
};
// i번째(0부터) 짝을 지웠을 때 늘어나는 기본 시간.
export const rushGain = i => Math.max(RUSH.MIN_HIT_MS, RUSH.HIT_MS - i * RUSH.DECAY_MS);
// 콤보까지 계산한 보너스(combo는 이 짝을 지운 뒤의 연속 수).
export const rushHitMs = (i, combo) => rushGain(i) + (combo >= RUSH.COMBO_AT ? RUSH.COMBO_MS : 0);
// 짝 수 · 틀린 수로 끝날 때의 시간(판 길이)이 될 수 있는 범위: 콤보가 하나도 없을 때 ~ 모두 콤보일 때.
export function rushBounds(pairs, misses) {
  let base = 0;
  for (let i = 0; i < pairs; i++) base += rushGain(i);
  const combo = Math.max(0, pairs - (RUSH.COMBO_AT - 1)) * RUSH.COMBO_MS;
  return { min: RUSH.START_MS + base - misses * RUSH.MISS_MS, max: RUSH.START_MS + base + combo - misses * RUSH.MISS_MS };
}
export const rushCoins = pairs => RUSH.CHECKS.reduce((c, [n, v]) => pairs >= n ? v : c, 0);
export const rushNext = pairs => RUSH.CHECKS.find(([n]) => pairs < n)?.[0] || null;
