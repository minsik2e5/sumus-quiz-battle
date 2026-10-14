import { dayKey } from '../public/modules/core.js';
import { MATCH, matchStars } from '../public/modules/match-rules.js';
import { FISH } from '../public/modules/fishing-rules.js';
import { addBonus, findReceipt, keepReceipt } from './rewards.mjs';
import { grantBait } from './reel.mjs';

// V13.149 혼자 하는 단어 게임: 짝 맞추기 타임어택(학생 기록 p.games). V13.150: 혼자 단어 낚시는 놀이터 손맛 낚시(server/reel.mjs)로 바뀌었다.
//   games.match { live{id, at, codes}, best, week{key, best}, day, plays, record_day }
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
  return { best: m.best || null, week_best: m.week?.key === weekKey ? m.week.best : null, left: Math.max(0, MATCH.DAILY - plays), daily: MATCH.DAILY };
}
export function matchStart(p, { id, codes = [], now = Date.now(), weekKey = '' }) {
  const m = games(p).match ||= {};
  m.live = { id, at: now, codes: codes.map(String).slice(0, 60) };
  return { id, ...matchView(p, now, weekKey) };
}
export function matchFinish(p, { id, ms, misses, pet = null, now = Date.now(), weekKey = '' }) {
  const g = games(p), m = g.match ||= {};
  const seen = findReceipt(g, 'match', id);
  if (seen) return { ...seen.r, again: true, ...matchView(p, now, weekKey) };
  const live = m.live;
  if (!id || !live || live.id !== id) fail('짝 맞추기 판을 찾지 못했어요.', 404);
  delete m.live;
  return { ...keepReceipt(g, 'match', id, matchSettle(p, m, live, { ms, misses, pet, now, weekKey }), now), ...matchView(p, now, weekKey) };
}
function matchSettle(p, m, live, { ms, misses, pet, now, weekKey }) {
  const time = Math.round(Number(ms)), miss = Math.max(0, Math.min(99, Math.floor(Number(misses) || 0)));
  // 한 쌍에 0.45초보다 빠를 수 없고, 서버가 잰 시간(카운트다운 포함)보다 길 수 없다.
  if (!Number.isFinite(time) || time < MATCH.PAIRS * MATCH.MIN_MS_PER_PAIR + miss * MATCH.PENALTY_MS || time > 600000) return { paid: false, reason: 'bad' };
  if (now - live.at + SLACK_MS < MATCH.COUNTDOWN_MS + time - miss * MATCH.PENALTY_MS) return { paid: false, reason: 'short' };
  const stars = matchStars(time), record = !m.best || time < m.best;
  const weekRecord = m.week?.key !== weekKey || !m.week.best || time < m.week.best;
  if (record) m.best = time;
  if (weekRecord) m.week = { key: weekKey, best: time, at: now };
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
// 이번 주 같은 반 짝 맞추기 순위(가장 빠른 기록).
export function matchBoard(profiles, p, weekKey, { hidden = () => false } = {}) {
  const rows = profiles.filter(x => x.role === 'student' && x.active !== false && x.school_id === p.school_id && x.class_name === p.class_name && x.games?.match?.week?.key === weekKey && x.games.match.week.best)
    .map(x => ({ id: x.id, me: x.id === p.id, name: x.id !== p.id && hidden(x) ? '비공개 학생' : x.display_name, pet: x.id !== p.id && hidden(x) ? 'lumi' : (x.avatar_key || 'lumi'), ms: x.games.match.week.best }))
    .sort((a, b) => a.ms - b.ms);
  rows.forEach((r, i) => { r.rank = i + 1; });
  const top = rows.slice(0, 10);
  const mine = rows.find(r => r.me);
  return { rows: mine && !top.includes(mine) ? [...top, mine] : top, total: rows.length };
}

export const fishName = key => FISH[key]?.name || '';
