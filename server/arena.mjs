// V13.225 펫 아레나 2(놀이터): 직접 조종하는 3:3 펫 대전. 판(씨앗 · 두 팀)은 서버가 만들고, 끝나면 서버가 학생의 조작 기록
// ([틱, 코드])으로 같은 전투(arena-rules.js runArena)를 다시 돌려 승패 · 보상을 정한다. 화면이 보낸 승패는 믿지 않는다.
//   p.games.arena { day, plays, tk(코인 판 입장권), tk_day, tk_src{오늘 받은 곳: 수}, games, wins, streak, best_streak, lost,
//                   team[[key, form, level, s2] ×3], live{ id, at, seed, me, foe, fl, foe_name, bot }, done[영수증],
//                   s2{ 펫 키: 0 | 1 } V13.229 스킬 ② 고르기(속성 스킬 2개 중 하나, 무료로 바꿈. 내 펫만 · S2_MAX개 상한)
//                     V13.231부터는 '기본 스킬 ②'(스킬트리 2층 B '그대로')로 그대로 쓴다. 새로 쓰지는 않고 읽기만.
//                   tr{ 펫 키: '011' } V13.231 스킬트리 가지(층마다 0 A · 1 B, 무료로 바꿈. 내 펫만 · TR_MAX개 상한, 펫마다 약 14바이트) }
//   state.arenaTeams: 친구들이 상대로 만나는 팀 목록(학교 · 반마다 최근 PER_CLASS개, 전체 MAX개, 30일 지나면 뺀다).
//                   렉 방지: 시작 요청이 전체 학생을 훑지 않고 이 작은 목록만 본다.
import { dayKey, STANDARD_PET_KEYS } from '../public/modules/core.js';
import { ARENA, TREE, fighter, teamPower, cleanInputs, cleanPicks, cleanTrees, runArena } from '../public/modules/arena-rules.js';
import { addBonus, findReceipt, keepReceipt, secureRandom } from './rewards.mjs';
import { applyRank, rankView } from './arena-rank.mjs';

export const ARENA_POOL = { PER_CLASS: 20, MAX: 600, KEEP_MS: 30 * 86400000 };
const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };
const games = p => p.games ||= {};
export const S2_MAX = 40, TR_MAX = TREE.MAX;
// 판 기록 · 친구 팀: [key, form, level, s2, tr]. 예전 기록(s2 없음)은 스킬 ② A(0), V13.231 전 기록(tr 없음)은 기본 가지(TREE.DEF).
const pack = team => team.map(f => [f.key, f.form, f.level, f.s2 ? 1 : 0, f.tr]);
export const unpackTeam = list => (list || []).map(([key, form, level, s2, tr]) => fighter({ key, form, level, s2: s2 ? 1 : 0, tr }));
const unpack = unpackTeam;
const brief = f => ({ key: f.key, form: f.form, level: f.level, s2: f.s2, tr: f.tr, hp: f.hp, atk: f.atk, el: f.el, shape: f.shape, rank: f.rank, skill: f.skill, ult: f.ult });
const playsToday = (a, now) => a.day === dayKey(now) ? Number(a.plays || 0) : 0;

export function arenaView(p, now = Date.now()) {
  const a = p.games?.arena || {}; // 읽기만
  const left = Math.max(0, ARENA.DAILY - playsToday(a, now)), tickets = Math.min(ARENA.TICKETS_MAX, Number(a.tk || 0));
  return { left, tickets, coin_play: left > 0 && tickets > 0, daily: ARENA.DAILY, s2: cleanPicks(a.s2, S2_MAX), tr: cleanTrees(a.tr, TR_MAX), games: Number(a.games || 0), wins: Number(a.wins || 0), streak: Number(a.streak || 0), best_streak: Number(a.best_streak || 0), rank: rankView(p, now) };
}

// 코인 판 입장권: 끝까지 푼 연습(ARENA.TICKET_PRACTICE문제 이상)마다 1장(하루 3장), 출석 1장. 보관 TICKETS_MAX장.
const TICKET_SOURCES = { practice: 3, attend: 1 };
export function grantArenaTicket(p, source, now = Date.now()) {
  if (!TICKET_SOURCES[source] || p?.role !== 'student') return false;
  const a = games(p).arena ||= {}, today = dayKey(now);
  if (a.tk_day !== today) { a.tk_day = today; a.tk_src = {}; }
  const got = Number(a.tk_src?.[source] || 0);
  if (got >= TICKET_SOURCES[source] || Number(a.tk || 0) >= ARENA.TICKETS_MAX) return false;
  a.tk_src = { ...(a.tk_src || {}), [source]: got + 1 };
  a.tk = Number(a.tk || 0) + 1;
  return true;
}

// 싸울 수 있는 펫(알이 아닌 펫)을 레벨 순으로. pets: petProgress()의 결과.
export const readyPets = pets => (pets || []).filter(x => Number(x.form) >= 1).sort((a, b) => b.level - a.level || (b.active ? 1 : 0) - (a.active ? 1 : 0));

// 내 팀: 고른 펫(최대 3, 내 펫이고 알이 아닌 것) → 모자라면 레벨 높은 펫으로 채운다. picks: 스킬 ② 고르기 { 키: 0 | 1 }(없으면 이름에서),
//   trees: V13.231 스킬트리 { 키: '011' }(없으면 TREE.DEF).
export function pickTeam(pets, keys = [], picks = {}, trees = {}) {
  const ready = readyPets(pets), byKey = new Map(ready.map(x => [x.key, x]));
  const team = [];
  for (const k of (Array.isArray(keys) ? keys : []).map(String)) if (byKey.has(k) && !team.includes(byKey.get(k)) && team.length < ARENA.TEAM) team.push(byKey.get(k));
  for (const x of ready) if (team.length < ARENA.TEAM && !team.includes(x)) team.push(x);
  return team.map(x => fighter({ ...x, s2: picks[x.key] === 0 || picks[x.key] === 1 ? picks[x.key] : null, tr: trees[x.key] }));
}

// 친구 팀 목록(state.arenaTeams): { k 학교|반, p 학생, n 이름, t 팀, at }.
const poolKey = (school, cls) => `${school}|${cls || ''}`;
export function arenaPoolFor(state, p, schoolId, now = Date.now()) {
  const k = poolKey(schoolId, p.class_name);
  return (Array.isArray(state.arenaTeams) ? state.arenaTeams : [])
    .filter(x => x.k === k && x.p !== p.id && now - x.at < ARENA_POOL.KEEP_MS)
    .map(x => ({ name: x.n, team: x.t }));
}
export function arenaPoolPut(state, p, schoolId, team, now = Date.now()) {
  const k = poolKey(schoolId, p.class_name), all = Array.isArray(state.arenaTeams) ? state.arenaTeams : [];
  const keep = all.filter(x => x.p !== p.id && now - x.at < ARENA_POOL.KEEP_MS);
  const same = keep.filter(x => x.k === k);
  const drop = new Set(same.slice(0, Math.max(0, same.length - ARENA_POOL.PER_CLASS + 1)));
  state.arenaTeams = [...keep.filter(x => !drop.has(x)), { k, p: p.id, n: String(p.display_name || '친구').slice(0, 20), t: team, at: now }].slice(-ARENA_POOL.MAX);
}

// 상대: 같은 반 친구가 남긴 팀(friends: [{ name, team: [[key, form, level], …] }]) 중 힘이 내 팀과 가장 비슷한 몇 팀에서 하나.
// 없으면 연습 상대(내 팀과 같은 단계의 일반 펫).
export function pickFoe(mine, friends = [], random = secureRandom) {
  const power = teamPower(mine);
  const cands = friends.map(f => ({ name: f.name, team: unpack(f.team).slice(0, ARENA.TEAM) })).filter(f => f.team.length >= Math.min(ARENA.TEAM, mine.length))
    .map(f => ({ ...f, gap: Math.abs(teamPower(f.team) - power) / Math.max(1, power) }))
    .filter(f => f.gap <= 0.45).sort((a, b) => a.gap - b.gap).slice(0, 4);
  if (cands.length) { const c = cands[Math.floor(random() * cands.length)]; return { name: c.name, bot: false, team: c.team }; }
  const keys = STANDARD_PET_KEYS.filter(k => !mine.some(f => f.key === k));
  const team = mine.map(f => { const key = keys.splice(Math.floor(random() * keys.length), 1)[0] || 'dog'; return fighter({ key, form: f.form, level: f.level }); });
  return { name: '연습 상대', bot: true, team };
}

// 상대 솜씨: 처음 3판 · 2연패부터 쉬움, 3연승부터 어려움, 나머지 보통.
export const foeLevelOf = a => Number(a?.streak || 0) >= 3 ? 2 : Number(a?.games || 0) < 3 || Number(a?.lost || 0) >= 2 ? 0 : 1;

// 판 받기. 하던 판이 있으면 버리고 새로(코인 · 입장권은 끝낼 때만 오가므로 잃을 것이 없다).
// V13.229 picks: 대기실에서 고른 스킬 ②({ 키: 0 | 1 }). 내 펫(알이 아닌 것)만 남겨 a.s2에 합친다(새로 고른 것이 이긴다, S2_MAX개 상한).
// V13.231 tree: 스킬트리 가지({ 키: '011' }). 스킬 ② 고르기와 같은 방식으로 a.tr에 합친다(TR_MAX개 상한).
export function arenaStart(p, { id, pets, team: keys, picks = null, tree = null, friends = [], now = Date.now(), random = secureRandom }) {
  const a = games(p).arena ||= {};
  const mine = new Set(readyPets(pets).map(x => x.key)), saved = cleanPicks(a.s2, S2_MAX);
  if (picks) {
    const merged = { ...saved, ...cleanPicks(picks, S2_MAX) };
    a.s2 = Object.fromEntries(Object.entries(merged).filter(([k]) => mine.has(k)).slice(-S2_MAX));
  }
  if (tree) {
    const merged = { ...cleanTrees(a.tr, TR_MAX), ...cleanTrees(tree, TR_MAX) };
    a.tr = Object.fromEntries(Object.entries(merged).filter(([k]) => mine.has(k)).slice(-TR_MAX));
  }
  const me = pickTeam(pets, keys, a.s2 || {}, a.tr || {});
  if (!me.length) fail('알에서 깬 펫이 있어야 싸울 수 있어요. 공부해서 펫을 키워 주세요!', 409);
  const foe = pickFoe(me, friends, random);
  const seed = Math.floor(random() * 2147483647) + 1, fl = foeLevelOf(a);
  a.team = pack(me);
  a.live = { id, at: now, seed, me: pack(me), foe: pack(foe.team), fl, foe_name: foe.name, bot: foe.bot };
  return { id, seed, foe_level: fl, me: me.map(brief), foe: { name: foe.name, bot: foe.bot, team: foe.team.map(brief) }, team: a.team, ...arenaView(p, now) };
}

// 끝내기: inputs [[틱, 코드], …]. 같은 끝내기를 다시 보내면 영수증으로 같은 답.
export function arenaFinish(p, { id, inputs, pet = null, now = Date.now() }) {
  const g = games(p), a = g.arena ||= {};
  const seen = findReceipt(g, 'arena', id);
  if (seen) return { ...seen.r, again: true, ...arenaView(p, now) };
  const live = a.live;
  if (!id || !live || live.id !== id) fail('아레나 판을 찾지 못했어요.', 404);
  delete a.live;
  return { ...keepReceipt(g, 'arena', id, arenaSettle(p, a, live, { inputs, pet, now }), now), ...arenaView(p, now) };
}

function arenaSettle(p, a, live, { inputs, pet, now }) {
  const r = runArena({ seed: live.seed, me: unpack(live.me), foe: unpack(live.foe), foeLevel: live.fl, inputs: cleanInputs(inputs) });
  const base = { winner: r.winner, win: r.winner === 'me', ticks: r.ticks, ults: r.ults.me, left: r.left, ko: r.ko.me, dealt: r.dealt.me, foe_name: live.foe_name };
  if (now - live.at > ARENA.STALE_MS) return { ...base, paid: false, reason: 'stale' };
  // 서버가 잰 시간이 카운트다운 + 전투 시간보다 짧으면 끝까지 하지 않았거나(중간에 나감) 화면 시간을 고친 것.
  if (now - live.at + ARENA.SLACK_MS < ARENA.COUNTDOWN_MS + r.ticks * ARENA.TICK_MS) return { ...base, paid: false, reason: 'short' };
  const today = dayKey(now);
  if (a.day !== today) { a.day = today; a.plays = 0; }
  a.games = Number(a.games || 0) + 1;
  if (base.win) { a.wins = Number(a.wins || 0) + 1; a.streak = Number(a.streak || 0) + 1; a.best_streak = Math.max(Number(a.best_streak || 0), a.streak); a.lost = 0; }
  else { a.streak = 0; a.lost = Number(a.lost || 0) + 1; }
  const out = { ...base, streak: a.streak };
  if (Number(a.plays || 0) >= ARENA.DAILY) return { ...out, paid: false, reason: 'daily' };
  if (Number(a.tk || 0) <= 0) return { ...out, paid: false, reason: 'ticket' };
  const streakCoins = base.win && a.streak % 3 === 0 ? ARENA.STREAK_COINS : 0;
  // 져도 상대 펫을 한 마리 이상 쓰러뜨렸으면 위로 코인.
  const coins = base.win ? ARENA.COINS.win + streakCoins : base.ko >= 1 ? ARENA.COINS.lose : 0;
  a.plays = Number(a.plays || 0) + 1;
  a.tk = Number(a.tk || 0) - 1;
  addBonus(p, { xp: ARENA.XP, coins, pet, now });
  // V13.234 랭크: 코인 판만, 연습 상대(컴퓨터 팀, bot)는 빼고. 상대 힘 = 상대 팀 힘 ÷ 내 팀 힘.
  const rp = live.bot ? null : applyRank(p, { win: base.win, draw: r.winner === 'draw', ratio: teamPower(unpack(live.foe)) / Math.max(1, teamPower(unpack(live.me))), now });
  return { ...out, paid: true, coins, streak_coins: streakCoins, xp: ARENA.XP, ...(rp ? { rp } : {}) };
}

export const arenaLine = res => `펫 아레나 ${res.win ? '승리' : res.winner === 'draw' ? '무승부' : '패배'} · 쓰러뜨림 ${res.ko || 0}${res.paid && res.coins ? ` · ${res.coins}코인` : ''}`;
