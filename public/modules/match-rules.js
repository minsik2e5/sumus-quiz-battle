import { shuffle, displayEnglish } from './core.js';

// V13.149 짝 맞추기 타임어택(Quizlet 매치 방식): 영어 카드 6장과 뜻 카드 6장을 짝지어 모두 지우는 시간.
// 틀리면 1초를 더한다. 화면은 match-game.js, 보상 · 기록은 server/games.mjs.
// V13.152 한 판이 너무 빨리 끝나서(10~30초) 3라운드(라운드마다 6쌍, 모두 18쌍)로 늘렸다. 시간은 라운드 사이에도 흐른다.
// 기록은 새 칸(games.match.r3)에 둔다. 예전 6쌍 기록은 비교할 수 없어서 '예전 기록'으로만 보여 준다.
export const MATCH = {
  PAIRS: 6,                // 한 라운드의 짝
  ROUNDS: 3,
  TOTAL_PAIRS: 18,         // PAIRS × ROUNDS
  ROUND_GAP_MS: 700,       // 라운드가 바뀌는 연출(시간은 계속 흐른다)
  PENALTY_MS: 1000,
  STARS: [56000, 86000],   // 3별: 56초 안, 2별: 86초 안, 1별: 다 지우면 (예전 6쌍 18 · 28초 × 3 + 라운드 연출)
  COUNTDOWN_MS: 3000,
  MIN_MS_PER_PAIR: 450,    // 사람 손으로 한 쌍에 이보다 빠를 수 없다(서버가 거른다)
  DAILY: 5,                // 하루에 코인을 받는 판
  COINS: { 3: 12, 2: 8, 1: 4 }, // V13.154 3라운드로 한 판이 3배 길어져서 2배로(선생님 결정, 예전 6 · 4 · 2)
  RECORD_COINS: 5,         // 내 최고 기록을 깨면(하루 한 번)
  XP: 6
};
export const matchStars = ms => ms <= MATCH.STARS[0] ? 3 : ms <= MATCH.STARS[1] ? 2 : 1;
// 카드에는 뜻의 첫 갈래만(긴 뜻은 카드에 다 들어가지 않는다).
export const cardMeaning = meaning => String(meaning || '').split(/[,;·/]|\s\(/)[0].replace(/[()]/g, '').trim();

// 짝 6개(한 라운드): 영어도 뜻도 서로 다른 단어로. `missed`(틀린 단어 id)를 먼저 넣는다(복습).
export function matchPick(words, { missed = [], random = Math.random, pairs = MATCH.PAIRS, skip = [] } = {}) {
  const miss = new Set(missed.map(String)), used = new Set(skip.map(String));
  // V13.152 skip: 앞 라운드에 나온 단어는 단어가 넉넉하면 다시 내지 않는다.
  const fresh = (words || []).filter(w => !used.has(String(w.id))), list = fresh.length >= pairs ? fresh : (words || []);
  const pool = [...shuffle(list.filter(w => miss.has(String(w.id))), random), ...shuffle(list.filter(w => !miss.has(String(w.id))), random)];
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
