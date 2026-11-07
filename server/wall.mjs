// V13.221 벽 통과(놀이터 미니게임). 판(벽 15장)은 서버가 만들고(dealWalls), 끝나면 서버가 저장해 둔 정답으로 다시 채점해 보상한다.
//   p.games.wall { day, plays, best, best_at, record_day, games, live{ id, at, a: '0213…' }, done[영수증] }
//   live에는 정답 자리만 문자열로 둔다(벽 15장이면 15글자). 끝나면 지운다. 영수증은 rewards.mjs keepReceipt(최근 10개 · 7일).
// 화면이 보낸 점수 · 별은 믿지 않는다. 고른 자리와 걸린 시간만 받고, 사람 속도(MIN_PICK_MS)와 서버가 잰 시간으로 거른다.
import { dayKey } from '../public/modules/core.js';
import { WALL, dealWalls, gradeWalls } from '../public/modules/wall-rules.js';
import { addBonus, findReceipt, keepReceipt, secureRandom } from './rewards.mjs';

const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };
const games = p => p.games ||= {};

export function wallView(p, now = Date.now()) {
  const w = p.games?.wall || {}; // 읽기만
  const plays = w.day === dayKey(now) ? Number(w.plays || 0) : 0;
  return { best: Number(w.best || 0) || null, left: Math.max(0, WALL.DAILY - plays), daily: WALL.DAILY, games: Number(w.games || 0) };
}

// 판 받기: 단어(내 학교 · 학년의 고른 범위)로 벽 15장. 하던 판이 있으면 버리고 새로(코인은 끝낼 때만 오가므로 잃을 것이 없다).
export function wallStart(p, { id, words, missed = [], now = Date.now(), random = secureRandom }) {
  const walls = dealWalls(words, { missed, random });
  if (!walls.length) fail('뜻이 서로 다른 단어가 부족해요. 범위를 더 골라 주세요.', 409);
  const w = games(p).wall ||= {};
  w.live = { id, at: now, a: walls.map(x => x.answer).join('') };
  return { id, walls, ...wallView(p, now) };
}

// 끝내기: picks [[고른 자리(-1 = 시간 끝), ms], …]. 같은 끝내기를 다시 보내면 영수증으로 같은 답.
export function wallFinish(p, { id, picks, pet = null, now = Date.now() }) {
  const g = games(p), w = g.wall ||= {};
  const seen = findReceipt(g, 'wall', id);
  if (seen) return { ...seen.r, again: true, ...wallView(p, now) };
  const live = w.live;
  if (!id || !live || live.id !== id) fail('벽 통과 판을 찾지 못했어요.', 404);
  delete w.live;
  return { ...keepReceipt(g, 'wall', id, wallSettle(p, w, live, { picks, pet, now }), now), ...wallView(p, now) };
}

export function wallPicks(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, WALL.WALLS).map(x => Array.isArray(x) ? [Number.isInteger(x[0]) && x[0] >= -1 && x[0] <= 3 ? x[0] : -1, Math.max(0, Math.min(60000, Math.round(Number(x[1]) || 0)))] : [-1, 0]);
}

function wallSettle(p, w, live, { picks, pet, now }) {
  const answers = [...String(live.a || '')].map(Number);
  const r = gradeWalls(answers, wallPicks(picks));
  const base = { passes: r.passes, lives: r.lives, combo: r.combo, score: r.score, stars: r.stars, played: r.played, marks: r.marks };
  if (now - live.at > WALL.STALE_MS) return { ...base, paid: false, reason: 'stale' };
  // 끝까지 하지 않은 판(중간에 나감)은 기록 · 코인 없이.
  if (!r.over) return { ...base, paid: false, reason: 'quit' };
  // 서버가 잰 시간(시작 ~ 끝)이 카운트다운 + 벽마다 걸린 시간보다 짧으면 화면 시간을 고친 것.
  if (now - live.at + WALL.SLACK_MS < WALL.COUNTDOWN_MS + r.playedMs) return { ...base, paid: false, reason: 'short' };
  const today = dayKey(now);
  if (w.day !== today) { w.day = today; w.plays = 0; }
  w.games = Number(w.games || 0) + 1;
  const record = r.score > 0 && r.score > Number(w.best || 0);
  if (record) { w.best = r.score; w.best_at = now; }
  const out = { ...base, record };
  if (Number(w.plays || 0) >= WALL.DAILY) return { ...out, paid: false, reason: 'daily' };
  w.plays = Number(w.plays || 0) + 1;
  const recordCoins = record && w.record_day !== today ? WALL.RECORD_COINS : 0;
  if (recordCoins) w.record_day = today;
  const coins = WALL.COINS[r.stars] + recordCoins;
  addBonus(p, { xp: WALL.XP, coins, pet, now });
  return { ...out, paid: true, coins, record_coins: recordCoins, xp: WALL.XP };
}

export const wallLine = res => `벽 통과 ${res.passes}/${WALL.WALLS}${res.record ? ' · 신기록' : ''}${res.paid ? ` · ${res.coins}코인` : ''}`;
