import { randomBytes } from 'node:crypto';
import { dayKey } from '../public/modules/core.js';
import { MATCH, matchStars } from '../public/modules/match-rules.js';
import { FISHING, FISH, FISH_KEYS, replayFishing, fishingCoins } from '../public/modules/fishing-rules.js';
import { addBonus, findReceipt, keepReceipt, giveGift } from './rewards.mjs';

// V13.149 혼자 하는 단어 게임: 짝 맞추기 타임어택 · 단어 낚시. 모두 학생 기록 p.games에 산다.
//   games.match { live{id, at, codes}, best, week{key, best}, day, plays, record_day }
//   games.fish  { live{id, at, seed, water}, day, plays, best_kg, book{key: {n, kg}}, golden, total }
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
  if (Number(m.plays || 0) >= MATCH.DAILY) return { ...base, paid: false, reason: 'daily' };
  m.plays = Number(m.plays || 0) + 1;
  const recordCoins = record && m.record_day !== today ? MATCH.RECORD_COINS : 0;
  if (recordCoins) m.record_day = today;
  const coins = MATCH.COINS[stars] + recordCoins;
  addBonus(p, { xp: MATCH.XP, coins, pet, now });
  return { ...base, paid: true, coins, record_coins: recordCoins, xp: MATCH.XP };
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

/* ---------- 단어 낚시 ---------- */
export function fishView(p, now = Date.now()) {
  const f = p.games?.fish || {};
  const plays = f.day === dayKey(now) ? Number(f.plays || 0) : 0;
  return {
    left: Math.max(0, FISHING.DAILY - plays), daily: FISHING.DAILY, best_kg: Number(f.best_kg || 0),
    book: f.book || {}, kinds: Object.keys(f.book || {}).length, all: FISH_KEYS.length,
    golden: Number(f.golden || 0) % FISHING.GOLDEN_EGG, total: Number(f.total || 0)
  };
}
export function fishStart(p, { id, water = false, now = Date.now(), seed = randomBytes(4).readUInt32BE(0) }) {
  const f = games(p).fish ||= {};
  f.live = { id, at: now, seed, water: !!water };
  return { id, seed, water: !!water, ...fishView(p, now) };
}
export function fishFinish(p, { id, answers, pet = null, now = Date.now(), giftId }) {
  const g = games(p), f = g.fish ||= {};
  const seen = findReceipt(g, 'fish', id);
  if (seen) return { ...seen.r, again: true, ...fishView(p, now) };
  const live = f.live;
  if (!id || !live || live.id !== id) fail('낚시 판을 찾지 못했어요.', 404);
  delete f.live;
  const list = (Array.isArray(answers) ? answers : []).slice(0, FISHING.CASTS).map(a => ({ ok: a?.ok === true, ms: Number(a?.ms) }));
  const run = replayFishing(live.seed, list, { water: live.water });
  return { ...keepReceipt(g, 'fish', id, fishSettle(p, f, live, run, { pet, now, giftId }), now), ...fishView(p, now) };
}
function fishSettle(p, f, live, run, { pet, now, giftId }) {
  const used = run.casts.reduce((n, c) => n + c.ms, 0) + run.casts.length * FISHING.MIN_CAST_MS;
  const base = { casts: run.casts, kg: run.kg, right: run.right };
  if (!run.casts.length) return { ...base, paid: false, reason: 'few' };
  if (now - live.at + SLACK_MS < used) return { ...base, paid: false, reason: 'short' };
  // 도감 · 최고 무게는 보상 횟수와 상관없이 남는다.
  const book = f.book ||= {}, fresh = [];
  let golden = 0;
  for (const c of run.casts.filter(c => c.ok)) {
    const b = book[c.key] ||= { n: 0, kg: 0 };
    if (!b.n) fresh.push(c.key);
    b.n += 1; b.kg = Math.max(Number(b.kg || 0), c.kg);
    if (c.key === 'goldenegg') golden++;
  }
  f.total = Number(f.total || 0) + run.right;
  const record = run.kg > Number(f.best_kg || 0);
  if (record) f.best_kg = run.kg;
  // 황금 알 물고기 3마리마다 랜덤 알 하나(선생님 알 선물과 같은 선물 상자로 온다).
  let egg = false;
  if (golden) {
    const before = Math.floor(Number(f.golden || 0) / FISHING.GOLDEN_EGG);
    f.golden = Number(f.golden || 0) + golden;
    if (Math.floor(f.golden / FISHING.GOLDEN_EGG) > before && giftId) { giveGift(p, { kind: 'egg', note: `황금 알 물고기 ${FISHING.GOLDEN_EGG}마리를 모았어요!`, from: 'fishing', fromName: '단어 낚시', now, id: giftId }); egg = true; }
  }
  const out = { ...base, fresh, record, egg };
  const today = dayKey(now);
  if (f.day !== today) { f.day = today; f.plays = 0; }
  if (Number(f.plays || 0) >= FISHING.DAILY) return { ...out, paid: false, reason: 'daily' };
  f.plays = Number(f.plays || 0) + 1;
  const coins = fishingCoins(run.casts), xp = run.right * FISHING.XP_PER_RIGHT;
  addBonus(p, { xp, coins, pet, now });
  return { ...out, paid: coins > 0 || xp > 0, coins, xp };
}
export const fishName = key => FISH[key]?.name || '';
