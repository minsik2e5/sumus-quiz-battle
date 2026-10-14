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
