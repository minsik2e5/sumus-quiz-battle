// V13.234 펫 아레나 랭크 시즌(규칙 public/modules/arena-rank-rules.js · 구성안 docs/pet-arena-v2-plan.md 6장).
//   p.games.arena.rank { s 시즌 번호, rp, b 이번 시즌 최고 RP, g 랭크 판 수, w 이긴 판, st 연승,
//                        h[{ s, rp, b, g, c 보상 받음 0|1 }] 지난 시즌 기록 최근 RANK.HIST(4)개, bt 받은 시즌 최고 티어(1 브론즈 … 5 다이아), dc 다이아 시즌 수 }
//     한 학생 약 0.2KB. 끝없이 쌓이지 않는다(지난 시즌 4개만).
//   시즌이 바뀌면 다음 쓰기(랭크 판 끝 · 보상 받기) 때 그 학생 것만 넘긴다. 보기(GET)는 넘긴 모습을 계산만 하고 저장하지 않는다.
//   랭킹(같은 학교 · 같은 학년)은 GET에서만 만들고 1분 캐시한다. 쓰기 요청 안에서는 다른 학생을 훑지 않는다.
import { RANK, tierOf, tierIndex, seasonOf, softReset, rpDelta, rpRatio, seasonCoins } from '../public/modules/arena-rank-rules.js';
import { addBonus } from './rewards.mjs';

const n0 = v => Math.max(0, Math.round(Number(v) || 0));
const GRADE = /^(중|고)[1-3]$/;
// server/competition.mjs gradeOf와 같다(서로 불러오는 고리를 만들지 않으려고 여기 둔다).
const gradeOf = c => String(c || '').match(/^(중[1-3]|고[1-3])/)?.[1] || String(c || '');

// 시즌을 넘긴 모습(복사본). 원본은 바꾸지 않는다. 지난 시즌마다 한 티어씩 내려가고(최대 3번), 판을 했던 시즌만 기록에 남긴다.
export function rolledRank(r, now = Date.now()) {
  const cur = seasonOf(now).no;
  const base = r && typeof r === 'object' ? r : {};
  let s = Number(base.s) || cur, rp = n0(base.rp), h = Array.isArray(base.h) ? base.h.slice(-RANK.HIST) : [];
  const out = { s, rp, b: Math.max(rp, n0(base.b)), g: n0(base.g), w: n0(base.w), st: n0(base.st), h, bt: n0(base.bt), dc: n0(base.dc) };
  if (s >= cur) return out;
  if (out.g > 0) h = [...h, { s, rp, b: out.b, g: out.g, c: 0 }].slice(-RANK.HIST);
  for (let k = 0; k < Math.min(3, cur - s); k++) rp = softReset(rp);
  return { s: cur, rp, b: rp, g: 0, w: 0, st: 0, h, bt: out.bt, dc: out.dc };
}
const rankOf = p => p?.games?.arena?.rank;
// 쓰기 쪽: 그 학생 것만 넘겨 저장한다.
function liveRank(p, now) {
  const a = (p.games ||= {}).arena ||= {};
  a.rank = rolledRank(a.rank, now);
  return a.rank;
}

// 화면에 보내는 내 랭크(아레나 입구 · 판 끝 · 첫 화면). 읽기만.
export function rankView(p, now = Date.now()) {
  const r = rolledRank(rankOf(p), now), season = seasonOf(now), t = tierOf(r.rp);
  const pending = r.h.filter(x => !x.c && x.g >= RANK.MIN_GAMES).map(x => ({ s: x.s, best: tierOf(x.b).label, key: tierOf(x.b).key, coins: seasonCoins(x.b) }));
  return { season: season.no, days_left: season.days_left, end: season.end, rp: r.rp, best: r.b, games: r.g, wins: r.w, streak: r.st, tier: t.key, label: t.label, step: t.step, floor: t.floor, next: t.next, pct: t.pct,
    pending, history: r.h.map(x => ({ s: x.s, best: tierOf(x.b).key, label: tierOf(x.b).label, rp: x.rp, games: x.g })) };
}

// 칭호(server/competition.mjs titleStats): 받은 시즌 최고 티어(1 브론즈 … 5 다이아) · 다이아 시즌 수.
export const rankTitleStats = p => ({ arena_season_best: n0(rankOf(p)?.bt), arena_diamond_seasons: n0(rankOf(p)?.dc) });

// 랭크 판 하나 반영. ratio: 상대 힘 ÷ 내 힘. 돌려주는 rp 기록은 판 영수증에 같이 남는다(같은 보고를 두 번 받아도 한 번만).
export function applyRank(p, { win, draw = false, ratio = 1, place = 0, now = Date.now() }) {
  const r = liveRank(p, now), from = r.rp, fromTier = tierOf(from);
  const streak = win ? r.st + 1 : 0;
  const d = rpDelta({ win, draw, rp: from, ratio, streak, place });
  r.rp = Math.max(0, from + d); r.b = Math.max(r.b, r.rp); r.g += 1; if (win) r.w += 1; r.st = draw ? r.st : streak;
  const to = tierOf(r.rp);
  return { d, from, rp: r.rp, label: to.label, tier: to.key, pct: to.pct, up: to.i > fromTier.i ? 'tier' : to.floor > fromTier.floor ? 'div' : '', down: to.floor < fromTier.floor, streak: r.st, season: r.s };
}

// 친구 판 상대 힘: 다른 사람들의 지금 RP(넘긴 모습)로.
export const liveRatio = (p, others, now = Date.now()) => rpRatio(rolledRank(rankOf(p), now).rp, others.map(o => rolledRank(rankOf(o), now).rp));

// 시즌 보상 받기(POST, 그 학생 것만). 보상 안 받은 지난 시즌마다 한 번만: 코인 + 칭호 기록(bt · dc). 판이 모자란 시즌은 받은 것으로만 표시.
export function claimRank(p, { pet = null, now = Date.now() } = {}) {
  const r = liveRank(p, now);
  const got = [];
  let coins = 0;
  for (const x of r.h) {
    if (x.c) continue;
    x.c = 1;
    if (x.g < RANK.MIN_GAMES) continue;
    const t = tierOf(x.b), c = seasonCoins(x.b);
    coins += c;
    r.bt = Math.max(r.bt, t.i + 1);
    if (t.key === 'diamond') r.dc += 1;
    got.push({ s: x.s, tier: t.key, label: t.label, coins: c });
  }
  if (coins) addBonus(p, { coins, pet, now });
  return { got, coins };
}

// ---------- 랭킹(GET + 1분 캐시) ----------
export const RANK_CACHE_MS = 60000, RANK_CACHE_MAX = 200;
const cache = new Map();
export const clearRankCache = () => cache.clear();
// 같은 학교 · 같은 학교급 · 같은 학년(학년을 모르는 반이면 같은 반). 친구 대전(arenaPeers)과 같은 묶음.
export const rankBand = (p, school) => !school || !p ? '' : `${school.id}|${GRADE.test(gradeOf(p.class_name)) ? `${school.division || ''}|${gradeOf(p.class_name)}` : `c:${p.class_name || ''}`}`;

// profiles: state.profiles, schoolOf: 학생 → 학교. 이번 시즌 랭크 판을 한 학생만, RP 높은 순.
export function rankBoard(profiles, p, schoolOf, now = Date.now()) {
  const season = seasonOf(now).no, band = rankBand(p, schoolOf(p));
  if (!band) return { band: '', rows: [], at: now };
  const key = `${season}|${band}`, hit = cache.get(key);
  if (hit && now - hit.at < RANK_CACHE_MS) return hit;
  const rows = [];
  for (const x of profiles || []) {
    const r = rankOf(x);
    if (x?.role !== 'student' || x.active === false || x.preview_owner_id || !r || Number(r.s) !== season || !(Number(r.g) > 0)) continue;
    if (rankBand(x, schoolOf(x)) !== band) continue;
    rows.push({ id: x.id, name: String(x.display_name || '친구').slice(0, 20), cls: String(x.class_name || '').slice(0, 20), pet: x.avatar_key || null, rp: n0(r.rp), w: n0(r.w), g: n0(r.g) });
  }
  rows.sort((a, b) => b.rp - a.rp || b.w - a.w || a.g - b.g || a.name.localeCompare(b.name, 'ko'));
  const out = { band, rows, at: now };
  cache.set(key, out);
  if (cache.size > RANK_CACHE_MAX) cache.delete(cache.keys().next().value);
  return out;
}
// 랭킹 탭 답: 상위 20명 + 내 순위(캐시 기준, 내 RP는 지금 값).
export function rankBoardView(profiles, p, schoolOf, now = Date.now()) {
  const board = rankBoard(profiles, p, schoolOf, now);
  const place = board.rows.findIndex(x => x.id === p.id) + 1;
  const row = x => ({ name: x.name, cls: x.cls, pet: x.pet, rp: x.rp, tier: tierOf(x.rp).key, label: tierOf(x.rp).label, wins: x.w, mine: x.id === p.id });
  return { top: board.rows.slice(0, RANK.TOP).map((x, i) => ({ place: i + 1, ...row(x) })), place: place || null, total: board.rows.length, cached_at: board.at, me: rankView(p, now) };
}
export { tierIndex };
