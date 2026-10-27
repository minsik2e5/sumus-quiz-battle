import { dayKey } from '../public/modules/core.js';
import { MATCH, matchStars } from '../public/modules/match-rules.js';
import { FISH } from '../public/modules/fishing-rules.js';
import { addBonus, findReceipt, keepReceipt } from './rewards.mjs';
import { grantBait } from './reel.mjs';
import { grantBall } from './hunt.mjs';
import { grantClaw } from './claw.mjs';

// V13.149 혼자 하는 단어 게임: 짝 맞추기 타임어택(학생 기록 p.games). V13.150: 혼자 단어 낚시는 놀이터 손맛 낚시(server/reel.mjs)로 바뀌었다.
//   games.match { live{id, at, codes}, r3{best, at, splits, week{key, best, at, splits}}, day, plays, record_day } (best · week는 예전 6쌍 기록)
//   splits: 짝을 하나씩 지울 때마다의 시간(+1초 포함, 18개, 마지막이 기록). 고스트가 이 시간대로 달린다.
//   games.fish  { book{key: {n, kg}}, golden }  물고기 도감(손맛 낚시 · 반 전체 낚시가 함께 쓴다)
// 시작할 때 서버에 등록하고(live) 끝날 때 서버가 시간을 보고 보상한다(몬스터전과 같다). 같은 끝내기를 다시 보내면
// 영수증(keepReceipt)으로 같은 답을 준다.

const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };
const SLACK_MS = 2500;
const games = p => p.games ||= {};

/* ---------- 짝 맞추기 ---------- */
// V13.152 3라운드(18쌍) 기록은 games.match.r3 { best, at, splits, week{key, best, at, splits} }에 둔다.
// 예전 6쌍 기록(games.match.best · week)은 비교할 수 없어서 old_best로만 보여 주고 순위에 넣지 않는다.
const r3Of = m => m?.r3 || null;
export function matchView(p, now = Date.now(), weekKey = '') {
  const m = p.games?.match || {}; // 읽기만(보기에서 기록을 만들지 않는다)
  const r3 = r3Of(m), plays = m.day === dayKey(now) ? Number(m.plays || 0) : 0;
  // V13.167 내 화면에는 의심 기록(r3.sus)도 내 기록으로 보여 준다(순위에는 안 들어감).
  const own = (a, b) => a && b ? Math.min(a, b) : a || b || null;
  return { best: own(r3?.best, r3?.sus?.best), week_best: own(r3?.week?.key === weekKey ? r3.week.best : null, r3?.sus?.week?.key === weekKey ? r3.sus.week.best : null), old_best: m.best || null, left: Math.max(0, MATCH.DAILY - plays), daily: MATCH.DAILY, rounds: MATCH.ROUNDS, pairs: MATCH.PAIRS };
}
export function matchStart(p, { id, codes = [], now = Date.now(), weekKey = '' }) {
  const m = games(p).match ||= {};
  m.live = { id, at: now, codes: codes.map(String).slice(0, 60) };
  return { id, ...matchView(p, now, weekKey) };
}
export function matchFinish(p, { id, ms, misses, splits = null, pet = null, now = Date.now(), weekKey = '' }) {
  const g = games(p), m = g.match ||= {};
  const seen = findReceipt(g, 'match', id);
  if (seen) return { ...seen.r, again: true, ...matchView(p, now, weekKey) };
  const live = m.live;
  if (!id || !live || live.id !== id) fail('짝 맞추기 판을 찾지 못했어요.', 404);
  delete m.live;
  return { ...keepReceipt(g, 'match', id, matchSettle(p, m, live, { ms, misses, splits, pet, now, weekKey }), now), ...matchView(p, now, weekKey) };
}
// 고스트용 짝마다의 시간: 18개, 점점 커지고, 한 쌍에 0.45초보다 빠르지 않고, 마지막이 기록과 같아야 한다. 아니면 버린다(기록은 그대로).
export function matchSplits(raw, time) {
  if (!Array.isArray(raw) || raw.length !== MATCH.TOTAL_PAIRS) return null;
  const out = raw.map(v => Math.round(Number(v)));
  if (!out.every((v, i) => Number.isFinite(v) && v - (i ? out[i - 1] : 0) >= MATCH.MIN_MS_PER_PAIR)) return null;
  if (Math.abs(out[out.length - 1] - time) > 50) return null;
  out[out.length - 1] = time;
  return out;
}
// V13.167 의심 기록(선생님: 진행). 고정 최소 시간(9.5초)은 올리지 않고(진짜 빠른 학생이 막힘), 사람이 낼 수 없는 모양만 거른다.
//   짝마다 시간(splits)이 없거나 위조(18개가 아님 · 마지막이 기록과 다름 · 줄어듦), 0.3초보다 빠른 짝이 4번 이상,
//   라운드 안 짝 간격의 가운데 값이 0.6초보다 빠름(사람은 카드 12장에서 짝을 찾아 두 번 눌러야 한다),
//   너무 고름(변동 8% 미만 또는 10번 이상이 가운데 값 ±20ms),
//   라운드가 바뀌는 두 짝이 모두 0.5초보다 빠름(카드가 사라지고 새로 깔리는 동안은 누를 카드가 없다. 움직임 줄이기 설정은 0.16초),
//   서버가 잰 시간이 기록(틀림 벌점 뺀)보다 30초 넘게 김(시계를 멈추고 보낸 기록).
// 의심 기록은 그 학생 화면(내 기록 · 내 순위 줄)에는 남지만 전체 · 학교 · 반 순위와 고스트에서는 빠지고, 신기록 코인이 없다(보통 판 코인은 그대로).
export const MATCH_GUARD = { FAST_MS: 300, FAST_N: 4, MEDIAN_MS: 600, EVEN_CV: .08, EVEN_MS: 20, EVEN_N: 10, ROUND_MS: 500, CLOCK_MS: 30000 };
export function matchSuspect(raw, time, { misses = 0, elapsed = null } = {}) {
  const G = MATCH_GUARD, n = MATCH.TOTAL_PAIRS;
  if (Number.isFinite(elapsed) && elapsed - (time - misses * MATCH.PENALTY_MS) > G.CLOCK_MS) return 'clock';
  if (!Array.isArray(raw) || raw.length !== n) return 'splits';
  const at = raw.map(v => Math.round(Number(v)));
  if (!at.every(Number.isFinite) || Math.abs(at[n - 1] - time) > 50) return 'splits';
  const gaps = at.map((v, i) => v - (i ? at[i - 1] : 0));
  if (gaps.some(g => g < 0)) return 'splits';
  if (gaps.filter(g => g < G.FAST_MS).length >= G.FAST_N) return 'fast';
  // 라운드가 바뀌는 짝(7번째 · 13번째)과 첫 짝(카드를 처음 보는 시간)은 빼고 본다. 틀림 벌점(1초)이 든 간격은 고름 계산에서 뺀다.
  const turns = Array.from({ length: MATCH.ROUNDS - 1 }, (_, r) => (r + 1) * MATCH.PAIRS);
  if (turns.every(i => gaps[i] < G.ROUND_MS)) return 'round';
  const inside = gaps.filter((g, i) => i > 0 && !turns.includes(i)), sorted = [...inside].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  if (median < G.MEDIAN_MS) return 'fast';
  const calm = misses ? sorted.slice(0, Math.max(4, sorted.length - misses)) : sorted;
  const mean = calm.reduce((a, b) => a + b, 0) / calm.length, sd = Math.sqrt(calm.reduce((a, b) => a + (b - mean) ** 2, 0) / calm.length);
  if (sd / mean < G.EVEN_CV || inside.filter(g => Math.abs(g - median) <= G.EVEN_MS).length >= G.EVEN_N) return 'even';
  return null;
}
function matchSettle(p, m, live, { ms, misses, splits, pet, now, weekKey }) {
  const time = Math.round(Number(ms)), miss = Math.max(0, Math.min(99, Math.floor(Number(misses) || 0)));
  // 한 쌍에 0.45초보다 빠를 수 없고(라운드 연출 시간도 더한다), 서버가 잰 시간(카운트다운 포함)보다 길 수 없다.
  const floor = MATCH.TOTAL_PAIRS * MATCH.MIN_MS_PER_PAIR + (MATCH.ROUNDS - 1) * MATCH.ROUND_GAP_MS + miss * MATCH.PENALTY_MS;
  if (!Number.isFinite(time) || time < floor || time > 900000) return { paid: false, reason: 'bad' };
  if (now - live.at + SLACK_MS < MATCH.COUNTDOWN_MS + time - miss * MATCH.PENALTY_MS) return { paid: false, reason: 'short' };
  const r3 = m.r3 ||= {};
  const stars = matchStars(time), sus = matchSuspect(splits, time, { misses: miss, elapsed: now - live.at - MATCH.COUNTDOWN_MS });
  const today = dayKey(now);
  if (m.day !== today) { m.day = today; m.plays = 0; }
  let record = false, weekRecord = false;
  if (sus) {
    // 의심 기록은 r3.sus에만(순위 · 고스트는 r3.best · r3.week만 본다). 내 화면에는 더 빠른 쪽을 보여 준다.
    const own = r3.sus ||= {};
    if (!own.best || time < own.best) Object.assign(own, { best: time, at: now, reason: sus });
    if (own.week?.key !== weekKey || !own.week.best || time < own.week.best) own.week = { key: weekKey, best: time, at: now, reason: sus };
    own.n = Number(own.n || 0) + 1;
  } else {
    record = !r3.best || time < r3.best;
    weekRecord = r3.week?.key !== weekKey || !r3.week.best || time < r3.week.best;
    const clean = matchSplits(splits, time);
    if (record) Object.assign(r3, { best: time, at: now, splits: clean });
    if (weekRecord) r3.week = { key: weekKey, best: time, at: now, splits: clean };
  }
  const base = { ms: time, stars, record, week_record: weekRecord, ...(sus ? { unranked: true } : {}) };
  // V13.162: 별 3개면 펫 사냥 공 1개(하루 1번, 가끔 좋은 공). 코인 판을 다 써도 받는다(미끼와 같다).
  const ball = stars === 3 ? grantBall(p, 'match', { lucky: true, now }) : null;
  // V13.180: 별 3개면 인형뽑기 집게권 1장(하루 1장).
  const clawTicket = stars === 3 && grantClaw(p, 'match', { now });
  if (Number(m.plays || 0) >= MATCH.DAILY) return { ...base, paid: false, reason: 'daily', bait: stars === 3 && grantBait(p, now), ball, claw_ticket: clawTicket };
  m.plays = Number(m.plays || 0) + 1;
  const recordCoins = record && m.record_day !== today ? MATCH.RECORD_COINS : 0;
  if (recordCoins) m.record_day = today;
  const coins = MATCH.COINS[stars] + recordCoins;
  addBonus(p, { xp: MATCH.XP, coins, pet, now });
  // V13.150: 별 3개면 낚시 미끼 1개(하루 미끼 한도 안에서).
  const bait = stars === 3 && grantBait(p, now);
  return { ...base, paid: true, coins, record_coins: recordCoins, xp: MATCH.XP, bait, ball, claw_ticket: clawTicket };
}
// V13.152 순위 범위 · 기간. 처음 화면은 전체 학생 · 이번 주(선생님 결정). 반만 보이던 것을 넓혔다.
export const MATCH_SCOPES = ['all', 'school', 'class'];
export const MATCH_PERIODS = ['week', 'all'];
const inScope = (x, p, scope) => scope === 'class' ? x.school_id === p.school_id && x.class_name === p.class_name : scope === 'school' ? x.school_id === p.school_id : true;
const recordOf = (x, period, weekKey) => { const r3 = r3Of(x.games?.match); if (!r3) return null; return period === 'all' ? (r3.best ? r3 : null) : (r3.week?.key === weekKey && r3.week.best ? r3.week : null); };
// V13.167 내 줄만: 의심 기록이 더 빠르면 그것을 보여 준다(다른 학생 화면 · 고스트에는 안 나온다).
const ownRecordOf = (x, period, weekKey) => {
  const clean = recordOf(x, period, weekKey), sus = r3Of(x.games?.match)?.sus;
  const s = period === 'all' ? (sus?.best ? sus : null) : (sus?.week?.key === weekKey && sus.week.best ? sus.week : null);
  return s && (!clean || s.best < clean.best) ? { best: s.best, splits: null } : clean;
};
function boardRows(profiles, p, weekKey, { hidden = () => false, scope = 'all', period = 'week', ghost = false } = {}) {
  // V13.157 교사 미리보기 계정은 순위 · 고스트에서 뺀다(자기 줄만 보인다).
  const rec = x => x.id === p.id && !ghost ? ownRecordOf(x, period, weekKey) : recordOf(x, period, weekKey);
  const rows = profiles.filter(x => x.role === 'student' && x.active !== false && (!x.preview_owner_id || x.id === p.id) && inScope(x, p, scope) && rec(x))
    .map(x => {
      const r = rec(x), veil = x.id !== p.id && hidden(x);
      return { id: veil ? null : x.id, me: x.id === p.id, name: veil ? '비공개 학생' : x.display_name, pet: veil ? 'lumi' : (x.avatar_key || 'lumi'), school: veil ? '' : (x.school || ''), class_name: veil ? '' : (x.class_name || ''), ms: r.best, splits: r.splits || null };
    })
    .sort((a, b) => a.ms - b.ms);
  rows.forEach((r, i) => { r.rank = i + 1; });
  return rows;
}
// 짝 맞추기 순위(가장 빠른 기록). 화면은 1~3등을 시상대에 올리고, 내 줄은 20등 밖이어도 붙인다.
export function matchBoard(profiles, p, weekKey, { hidden = () => false, scope = 'all', period = 'week' } = {}) {
  scope = MATCH_SCOPES.includes(scope) ? scope : 'all'; period = MATCH_PERIODS.includes(period) ? period : 'week';
  const rows = boardRows(profiles, p, weekKey, { hidden, scope, period }).map(({ splits, ...r }) => r);
  const top = rows.slice(0, 20);
  const mine = rows.find(r => r.me);
  return { scope, period, rows: mine && !top.includes(mine) ? [...top, mine] : top, total: rows.length };
}
// 고스트: 이번 주 전체 학생 순위에서 바로 위 학생(내가 1등이면 이번 주의 나, 내 기록이 없으면 가장 느린 기록).
// 짝마다의 시간이 없는 기록은 고르게 나눈다. 판을 시작할 때(이미 쓰는 요청) 함께 보내서 쓰기가 늘지 않는다.
export function matchGhost(profiles, p, weekKey, { hidden = () => false } = {}) {
  const rows = boardRows(profiles, p, weekKey, { hidden, scope: 'all', period: 'week', ghost: true });
  if (!rows.length) return null;
  const i = rows.findIndex(r => r.me);
  const g = i > 0 ? rows[i - 1] : i === 0 ? rows[0] : rows[rows.length - 1];
  const splits = g.splits?.length === MATCH.TOTAL_PAIRS ? g.splits : Array.from({ length: MATCH.TOTAL_PAIRS }, (_, k) => Math.round(g.ms * (k + 1) / MATCH.TOTAL_PAIRS));
  return { self: g.me, name: g.me ? '이번 주의 나' : g.name, pet: g.pet, rank: g.rank, ms: g.ms, splits };
}

export const fishName = key => FISH[key]?.name || '';
