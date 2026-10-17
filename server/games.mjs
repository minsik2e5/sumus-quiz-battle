import { dayKey } from '../public/modules/core.js';
import { MATCH, matchStars, RUSH, rushBounds, rushCoins } from '../public/modules/match-rules.js';
import { FISH } from '../public/modules/fishing-rules.js';
import { addBonus, findReceipt, keepReceipt } from './rewards.mjs';
import { grantBait } from './reel.mjs';

// V13.149 혼자 하는 단어 게임: 짝 맞추기 타임어택(학생 기록 p.games). V13.150: 혼자 단어 낚시는 놀이터 손맛 낚시(server/reel.mjs)로 바뀌었다.
//   games.match { live{id, at, codes}, best, week{key, best, at, splits}, day, plays, record_day }
//   splits: 짝을 하나씩 지울 때마다의 시간(+1초 포함, 6개, 마지막이 기록). 반 친구 고스트가 이 시간대로 달린다.
//   V13.150 러시: games.match.rush { best, week{key, best, at}, record_day } (지운 짝 수가 클수록 좋다). 하루 코인 판(plays)은 빠른 한 판과 함께 센다.
//   games.fish  { book{key: {n, kg}}, golden }  물고기 도감(손맛 낚시 · 반 전체 낚시가 함께 쓴다)
// 시작할 때 서버에 등록하고(live) 끝날 때 서버가 시간을 보고 보상한다(몬스터전과 같다). 같은 끝내기를 다시 보내면
// 영수증(keepReceipt)으로 같은 답을 준다.

const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };
const SLACK_MS = 2500;
const games = p => p.games ||= {};

/* ---------- 짝 맞추기 ---------- */
export function matchView(p, now = Date.now(), weekKey = '') {
  const m = p.games?.match || {}; // 읽기만(보기에서 기록을 만들지 않는다)
  const plays = m.day === dayKey(now) ? Number(m.plays || 0) : 0;
  const r = m.rush || {};
  return { best: m.best || null, week_best: m.week?.key === weekKey ? m.week.best : null, left: Math.max(0, MATCH.DAILY - plays), daily: MATCH.DAILY, rush_best: r.best || null, rush_week_best: r.week?.key === weekKey ? r.week.best : null };
}
export function matchStart(p, { id, codes = [], mode = 'classic', now = Date.now(), weekKey = '' }) {
  const m = games(p).match ||= {};
  m.live = { id, at: now, codes: codes.map(String).slice(0, 60), mode: mode === 'rush' ? 'rush' : 'classic' };
  return { id, ...matchView(p, now, weekKey) };
}
export function matchFinish(p, { id, ms, misses, splits = null, pairs = 0, pet = null, now = Date.now(), weekKey = '' }) {
  const g = games(p), m = g.match ||= {};
  const seen = findReceipt(g, 'match', id);
  if (seen) return { ...seen.r, again: true, ...matchView(p, now, weekKey) };
  const live = m.live;
  if (!id || !live || live.id !== id) fail('짝 맞추기 판을 찾지 못했어요.', 404);
  delete m.live;
  const settled = live.mode === 'rush' ? rushSettle(p, m, live, { ms, misses, pairs, pet, now, weekKey }) : matchSettle(p, m, live, { ms, misses, splits, pet, now, weekKey });
  return { ...keepReceipt(g, 'match', id, settled, now), ...matchView(p, now, weekKey) };
}
// 고스트용 짝마다의 시간: 6개, 점점 커지고, 한 쌍에 0.45초보다 빠르지 않고, 마지막이 기록과 같아야 한다. 아니면 버린다(기록은 그대로).
export function matchSplits(raw, time) {
  if (!Array.isArray(raw) || raw.length !== MATCH.PAIRS) return null;
  const out = raw.map(v => Math.round(Number(v)));
  if (!out.every((v, i) => Number.isFinite(v) && v - (i ? out[i - 1] : 0) >= MATCH.MIN_MS_PER_PAIR)) return null;
  if (Math.abs(out[out.length - 1] - time) > 50) return null;
  out[out.length - 1] = time;
  return out;
}
function matchSettle(p, m, live, { ms, misses, splits, pet, now, weekKey }) {
  const time = Math.round(Number(ms)), miss = Math.max(0, Math.min(99, Math.floor(Number(misses) || 0)));
  // 한 쌍에 0.45초보다 빠를 수 없고, 서버가 잰 시간(카운트다운 포함)보다 길 수 없다.
  if (!Number.isFinite(time) || time < MATCH.PAIRS * MATCH.MIN_MS_PER_PAIR + miss * MATCH.PENALTY_MS || time > 600000) return { paid: false, reason: 'bad' };
  if (now - live.at + SLACK_MS < MATCH.COUNTDOWN_MS + time - miss * MATCH.PENALTY_MS) return { paid: false, reason: 'short' };
  const stars = matchStars(time), record = !m.best || time < m.best;
  const weekRecord = m.week?.key !== weekKey || !m.week.best || time < m.week.best;
  if (record) m.best = time;
  if (weekRecord) m.week = { key: weekKey, best: time, at: now, splits: matchSplits(splits, time) };
  const today = dayKey(now);
  if (m.day !== today) { m.day = today; m.plays = 0; }
  const base = { ms: time, stars, record, week_record: weekRecord };
  if (Number(m.plays || 0) >= MATCH.DAILY) return { ...base, paid: false, reason: 'daily', bait: stars === 3 && grantBait(p, now) };
  m.plays = Number(m.plays || 0) + 1;
  const recordCoins = record && m.record_day !== today ? MATCH.RECORD_COINS : 0;
  if (recordCoins) m.record_day = today;
  const coins = MATCH.COINS[stars] + recordCoins;
  addBonus(p, { xp: MATCH.XP, coins, pet, now });
  // V13.150: 별 3개면 낚시 미끼 1개(하루 미끼 한도 안에서).
  const bait = stars === 3 && grantBait(p, now);
  return { ...base, paid: true, coins, record_coins: recordCoins, xp: MATCH.XP, bait };
}
// V13.150 러시: 지운 짝 수를 짝 수 · 틀린 수로 계산한 시간 범위(rushBounds)와 서버가 잰 시간으로 확인한다.
function rushSettle(p, m, live, { ms, misses, pairs, pet, now, weekKey }) {
  const time = Math.round(Number(ms)), miss = Math.max(0, Math.min(99, Math.floor(Number(misses) || 0))), n = Math.max(0, Math.min(400, Math.floor(Number(pairs) || 0)));
  if (!Number.isFinite(time) || time > 900000 || n * MATCH.MIN_MS_PER_PAIR > time) return { mode: 'rush', paid: false, reason: 'bad' };
  const b = rushBounds(n, miss);
  if (time < b.min - 1500 || time > b.max + 1500) return { mode: 'rush', paid: false, reason: 'bad' };
  if (now - live.at + SLACK_MS < MATCH.COUNTDOWN_MS + time) return { mode: 'rush', paid: false, reason: 'short' };
  const r = m.rush ||= {};
  const record = n > 0 && (!r.best || n > r.best), weekRecord = n > 0 && (r.week?.key !== weekKey || !r.week.best || n > r.week.best);
  if (record) r.best = n;
  if (weekRecord) r.week = { key: weekKey, best: n, at: now };
  const today = dayKey(now);
  if (m.day !== today) { m.day = today; m.plays = 0; }
  const base = { mode: 'rush', pairs: n, ms: time, record, week_record: weekRecord };
  if (Number(m.plays || 0) >= MATCH.DAILY) return { ...base, paid: false, reason: 'daily', bait: n >= RUSH.BAIT_AT && grantBait(p, now) };
  m.plays = Number(m.plays || 0) + 1;
  const recordCoins = record && r.record_day !== today ? RUSH.RECORD_COINS : 0;
  if (recordCoins) r.record_day = today;
  const coins = rushCoins(n) + recordCoins;
  addBonus(p, { xp: RUSH.XP, coins, pet, now });
  const bait = n >= RUSH.BAIT_AT && grantBait(p, now);
  return { ...base, paid: true, coins, record_coins: recordCoins, xp: RUSH.XP, bait };
}
// 이번 주 같은 반 러시 순위(지운 짝이 많은 순서).
export function matchRushBoard(profiles, p, weekKey, { hidden = () => false } = {}) {
  const rows = profiles.filter(x => x.role === 'student' && x.active !== false && x.school_id === p.school_id && x.class_name === p.class_name && x.games?.match?.rush?.week?.key === weekKey && x.games.match.rush.week.best)
    .map(x => { const veil = x.id !== p.id && hidden(x); return { id: x.id, me: x.id === p.id, name: veil ? '비공개 학생' : x.display_name, pet: veil ? 'lumi' : (x.avatar_key || 'lumi'), pairs: x.games.match.rush.week.best }; })
    .sort((a, b) => b.pairs - a.pairs);
  rows.forEach((r, i) => { r.rank = i + 1; });
  const top = rows.slice(0, 10), mine = rows.find(r => r.me);
  return { mode: 'rush', rows: mine && !top.includes(mine) ? [...top, mine] : top, total: rows.length };
}
// 이번 주 같은 반 짝 맞추기 기록(가장 빠른 순서). 순위와 고스트가 같이 쓴다.
function weekRows(profiles, p, weekKey, hidden) {
  const rows = profiles.filter(x => x.role === 'student' && x.active !== false && x.school_id === p.school_id && x.class_name === p.class_name && x.games?.match?.week?.key === weekKey && x.games.match.week.best)
    .map(x => { const veil = x.id !== p.id && hidden(x); return { id: x.id, me: x.id === p.id, name: veil ? '비공개 학생' : x.display_name, pet: veil ? 'lumi' : (x.avatar_key || 'lumi'), ms: x.games.match.week.best, splits: x.games.match.week.splits || null }; })
    .sort((a, b) => a.ms - b.ms);
  rows.forEach((r, i) => { r.rank = i + 1; });
  return rows;
}
// 이번 주 같은 반 짝 맞추기 순위(가장 빠른 기록). 화면은 1~3등을 시상대에 올리고, 내 줄은 10등 밖이어도 붙인다.
export function matchBoard(profiles, p, weekKey, { hidden = () => false } = {}) {
  const rows = weekRows(profiles, p, weekKey, hidden).map(({ splits, ...r }) => r);
  const top = rows.slice(0, 10);
  const mine = rows.find(r => r.me);
  return { rows: mine && !top.includes(mine) ? [...top, mine] : top, total: rows.length };
}
// V13.149 반 친구 고스트: 바로 위 순위 친구(내가 1등이면 이번 주의 나, 내 기록이 없으면 반에서 가장 느린 기록).
// 짝마다의 시간이 없는 옛 기록은 고르게 나눈다. 판을 시작할 때(이미 쓰는 요청) 함께 보내서 쓰기가 늘지 않는다.
export function matchGhost(profiles, p, weekKey, { hidden = () => false } = {}) {
  const rows = weekRows(profiles, p, weekKey, hidden);
  if (!rows.length) return null;
  const i = rows.findIndex(r => r.me);
  const g = i > 0 ? rows[i - 1] : i === 0 ? rows[0] : rows[rows.length - 1];
  const splits = g.splits?.length === MATCH.PAIRS ? g.splits : Array.from({ length: MATCH.PAIRS }, (_, k) => Math.round(g.ms * (k + 1) / MATCH.PAIRS));
  return { self: g.me, name: g.me ? '이번 주의 나' : g.name, pet: g.pet, rank: g.rank, ms: g.ms, splits };
}

export const fishName = key => FISH[key]?.name || '';
