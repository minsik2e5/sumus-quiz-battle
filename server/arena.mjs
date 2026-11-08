// V13.225 펫 아레나 2(놀이터): 직접 조종하는 3:3 펫 대전. 판(씨앗 · 두 팀)은 서버가 만들고, 끝나면 서버가 학생의 조작 기록
// ([틱, 코드])으로 같은 전투(arena-rules.js runArena)를 다시 돌려 승패 · 보상을 정한다. 화면이 보낸 승패는 믿지 않는다.
//   p.games.arena { day, plays, tk(코인 판 입장권), tk_day, tk_src{오늘 받은 곳: 수}, games, wins, streak, best_streak, lost,
//                   team[[key, form, level, s2] ×3], live{ id, at, seed, me, foe, fl, foe_name, bot }, done[영수증],
//                   s2{ 펫 키: 0 | 1 } V13.229 스킬 ② 고르기(속성 스킬 2개 중 하나, 무료로 바꿈. 내 펫만 · S2_MAX개 상한) }
//   state.arenaTeams: 친구들이 상대로 만나는 팀 목록(학교 · 반마다 최근 PER_CLASS개, 전체 MAX개, 30일 지나면 뺀다).
//                   렉 방지: 시작 요청이 전체 학생을 훑지 않고 이 작은 목록만 본다.
import { dayKey, STANDARD_PET_KEYS } from '../public/modules/core.js';
import { ARENA, INPUT, fighter, teamPower, cleanInputs, cleanPicks, runArena } from '../public/modules/arena-rules.js';
import { addBonus, findReceipt, keepReceipt, secureRandom } from './rewards.mjs';

export const ARENA_POOL = { PER_CLASS: 20, MAX: 600, KEEP_MS: 30 * 86400000 };
const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };
const games = p => p.games ||= {};
export const S2_MAX = 40;
// 판 기록 · 친구 팀: [key, form, level, s2]. 예전 기록(s2 없음)은 스킬 ② A(0).
const pack = team => team.map(f => [f.key, f.form, f.level, f.s2 ? 1 : 0]);
const unpack = list => (list || []).map(([key, form, level, s2]) => fighter({ key, form, level, s2 }));
const brief = f => ({ key: f.key, form: f.form, level: f.level, s2: f.s2, hp: f.hp, atk: f.atk, el: f.el, shape: f.shape, rank: f.rank, skill: f.skill, ult: f.ult });
const playsToday = (a, now) => a.day === dayKey(now) ? Number(a.plays || 0) : 0;

export function arenaView(p, now = Date.now()) {
  const a = p.games?.arena || {}; // 읽기만
  const left = Math.max(0, ARENA.DAILY - playsToday(a, now)), tickets = Math.min(ARENA.TICKETS_MAX, Number(a.tk || 0));
  const pairs = a.pairs?.day === dayKey(now) ? a.pairs.n || {} : {};
  return { left, tickets, coin_play: left > 0 && tickets > 0, daily: ARENA.DAILY, s2: cleanPicks(a.s2, S2_MAX), games: Number(a.games || 0), wins: Number(a.wins || 0), streak: Number(a.streak || 0), best_streak: Number(a.best_streak || 0),
    live_games: Number(a.lg || 0), live_wins: Number(a.lw || 0), pairs, live_room: a.live_room && now - a.live_room.at < 15 * 60000 ? a.live_room.id : null };
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

// 내 팀: 고른 펫(최대 3, 내 펫이고 알이 아닌 것) → 모자라면 레벨 높은 펫으로 채운다. picks: 스킬 ② 고르기 { 키: 0 | 1 }.
export function pickTeam(pets, keys = [], picks = {}) {
  const ready = readyPets(pets), byKey = new Map(ready.map(x => [x.key, x]));
  const team = [];
  for (const k of (Array.isArray(keys) ? keys : []).map(String)) if (byKey.has(k) && !team.includes(byKey.get(k)) && team.length < ARENA.TEAM) team.push(byKey.get(k));
  for (const x of ready) if (team.length < ARENA.TEAM && !team.includes(x)) team.push(x);
  return team.map(x => fighter({ ...x, s2: picks[x.key] === 1 ? 1 : 0 }));
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
export function arenaStart(p, { id, pets, team: keys, picks = null, friends = [], now = Date.now(), random = secureRandom }) {
  const a = games(p).arena ||= {};
  const mine = new Set(readyPets(pets).map(x => x.key)), saved = cleanPicks(a.s2, S2_MAX);
  if (picks) {
    const merged = { ...saved, ...cleanPicks(picks, S2_MAX) };
    a.s2 = Object.fromEntries(Object.entries(merged).filter(([k]) => mine.has(k)).slice(-S2_MAX));
  }
  const me = pickTeam(pets, keys, a.s2 || {});
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
  return { ...out, paid: true, coins, streak_coins: streakCoins, xp: ARENA.XP };
}

export const arenaLine = res => `펫 아레나 ${res.win ? '승리' : res.winner === 'draw' ? '무승부' : '패배'} · 쓰러뜨림 ${res.ko || 0}${res.paid && res.coins ? ` · ${res.coins}코인` : ''}`;

// ---------------------------------------------------------------------------------------------
// V13.230 실시간 1:1(구성안 1장 · ③단계). 방 객체(cloudflare/arena-room.mjs)가 판을 돌리고, 메인은 방 만들기 · 들어가기 · 끝 보고만.
//   state.arenaInvites: 열린 방 [{ id, code, host_id, guest_id, invite_id, school_id, grade, tickets{학생: 입장표}, at }]
//                      (server/perf-budget.mjs 20KB: 15분 지나면 지움 · 최대 200개).
//   p.games.arena.live_room { id, at }: 내 방(1개, 15분). p.games.arena.pairs { day, n{상대: 오늘 코인 판 수} }(오늘 것만 · 10줄).
//   p.games.arena.lg · lw: 친구 대전 판 수 · 이긴 수.
// 초대 범위(선생님 결정 2026-11-08): 같은 학교 · 같은 학년(gradeOf: 고1A → 고1, 반은 달라도 된다). 학년을 알 수 없는 반 이름이면
//   gradeOf가 반 이름을 그대로 돌려줘서 같은 반끼리만. 서버가 초대 · 방 코드 · 끝 보고 때 모두 확인한다.
export const ARENA_LIVE = { ROOM_TTL_MS: 15 * 60000, MAX: 200, PAIR_DAILY: 2, PAIRS_MAX: 10, MIN_INPUTS: 20, MAKE_GAP_MS: 60000, FRIENDS_MAX: 60, PETS: 40 };
const liveList = state => (state.arenaInvites = (Array.isArray(state.arenaInvites) ? state.arenaInvites : []));
export function tidyArenaLive(state, now = Date.now()) {
  const list = liveList(state), keep = list.filter(x => now - x.at < ARENA_LIVE.ROOM_TTL_MS);
  if (keep.length !== list.length) state.arenaInvites = keep;
  return state.arenaInvites;
}
const liveTicket = () => [...crypto.getRandomValues(new Uint8Array(18))].map(b => b.toString(16).padStart(2, '0')).join('');
// 같은 학교 · 같은 학년인지. who(x) = { school_id, grade }.
export const sameArenaGrade = (a, b) => !!a.school_id && a.school_id === b.school_id && !!a.grade && a.grade === b.grade;
export const liveRoomOf = (state, pid, now = Date.now()) => (Array.isArray(state.arenaInvites) ? state.arenaInvites : []).find(x => (x.host_id === pid || x.guest_id === pid) && now - x.at < ARENA_LIVE.ROOM_TTL_MS) || null;
// 방에 보낼 내 펫(알이 아닌 펫, 레벨 순 40마리) [key, form, level].
const livePets = pets => readyPets(pets).slice(0, ARENA_LIVE.PETS).map(x => [x.key, Number(x.form), Number(x.level)]);
const liveHost = (p, pets, ticket) => { const a = p.games?.arena || {}; return { id: p.id, name: p.display_name, ticket, pets: livePets(pets), s2: cleanPicks(a.s2, S2_MAX), team: (a.team || []).map(x => x[0]) }; };

// 초대할 수 있는 친구(같은 학교 · 같은 학년, 펫이 있는 학생). GET에서만 부른다.
export function arenaLiveFriends(state, p, who, now = Date.now()) {
  const me = who(p), busy = new Set(tidyArenaLiveRead(state, now).flatMap(x => [x.host_id, x.guest_id]));
  return state.profiles
    .filter(x => x.id !== p.id && x.role === 'student' && x.active !== false && !x.preview_owner_id && x.pets?.length && sameArenaGrade(me, who(x)))
    .map(x => ({ id: x.id, name: x.display_name, class_name: x.class_name || '', same_class: x.class_name === p.class_name, busy: busy.has(x.id) }))
    .sort((a, b) => Number(b.same_class) - Number(a.same_class) || a.name.localeCompare(b.name, 'ko'))
    .slice(0, ARENA_LIVE.FRIENDS_MAX);
}
const tidyArenaLiveRead = (state, now) => (Array.isArray(state.arenaInvites) ? state.arenaInvites : []).filter(x => now - x.at < ARENA_LIVE.ROOM_TTL_MS);

// 방 만들기(친구 초대가 있으면 그 친구만 들어올 수 있다는 표시도). 1분에 1번(판을 끝낸 뒤 다시 만드는 것은 바로 된다).
export function arenaLiveCreate(state, p, { who, pets, friend = null, roomId, code, now = Date.now() }) {
  tidyArenaLive(state, now);
  const a = games(p).arena ||= {};
  if (!readyPets(pets).length) fail('알에서 깬 펫이 있어야 싸울 수 있어요. 공부해서 펫을 키워 주세요!', 409);
  const mine = liveRoomOf(state, p.id, now);
  if (mine) {
    if (mine.host_id !== p.id || mine.guest_id) fail('이미 들어가 있는 친구 대전이 있어요.', 409);
    // 아직 아무도 안 들어온 내 방: 닫고 새로(초대할 친구를 바꿀 때).
    state.arenaInvites = state.arenaInvites.filter(x => x !== mine);
  }
  if (!mine && a.live_made && now - a.live_made < ARENA_LIVE.MAKE_GAP_MS) fail('방은 1분에 한 번 만들 수 있어요. 잠깐 뒤에 다시 해 주세요.', 429);
  if (friend) {
    if (!sameArenaGrade(who(p), who(friend))) fail('같은 학년 친구만 초대할 수 있어요.', 409);
    if (liveRoomOf(state, friend.id, now)) fail(`${friend.display_name}이(가) 지금 다른 친구 대전 중이에요.`, 409);
  }
  const ticket = liveTicket(), me = who(p);
  const room = { id: roomId, code, host_id: p.id, guest_id: null, invite_id: friend?.id || null, school_id: me.school_id, grade: me.grade, tickets: { [p.id]: ticket }, at: now };
  state.arenaInvites.push(room);
  state.arenaInvites = state.arenaInvites.slice(-ARENA_LIVE.MAX);
  a.live_room = { id: roomId, at: now }; a.live_made = now;
  return { room: { id: roomId, code, ticket, host: true, friend: friend?.display_name || null }, closing: mine ? [{ action: 'close', id: mine.id, reason: 'replaced' }] : [], message: { action: 'init', id: roomId, code, invite: friend?.id || null, host: liveHost(p, pets, ticket) } };
}
// 4자리 방 코드(열린 방끼리 겹치지 않게).
export function newArenaCode(state, random = secureRandom) {
  const used = new Set(tidyArenaLiveRead(state, Date.now()).map(x => x.code));
  for (let i = 0; i < 50; i++) { const c = String(1000 + Math.floor(random() * 9000)); if (!used.has(c)) return c; }
  fail('방이 너무 많아요. 잠깐 뒤에 다시 해 주세요.', 429);
}

// 들어가기: 방 코드 또는 초대(id). 같은 학년만.
export function arenaLiveJoin(state, p, { who, pets, code = '', id = '', now = Date.now() }) {
  tidyArenaLive(state, now);
  const room = state.arenaInvites.find(x => (id ? x.id === id : x.code === code));
  if (!room) fail(id ? '친구 대전 초대가 끝났어요.' : '그 번호의 친구 대전 방을 찾지 못했어요. 번호를 다시 확인해 주세요.', 404);
  if (room.host_id === p.id) fail('내가 만든 방이에요. 친구에게 번호를 알려 주세요.', 409);
  if (!sameArenaGrade(who(p), room)) fail('같은 학년 친구 방에만 들어갈 수 있어요.', 409);
  if (room.guest_id && room.guest_id !== p.id) fail('방이 가득 찼어요.', 409);
  if (room.invite_id && room.invite_id !== p.id && !code) fail('나에게 온 초대가 아니에요.', 403);
  const other = liveRoomOf(state, p.id, now);
  if (other && other.id !== room.id) fail('이미 들어가 있는 친구 대전이 있어요.', 409);
  if (!readyPets(pets).length) fail('알에서 깬 펫이 있어야 싸울 수 있어요. 공부해서 펫을 키워 주세요!', 409);
  const ticket = room.tickets[p.id] || liveTicket();
  room.tickets[p.id] = ticket; room.guest_id = p.id;
  (games(p).arena ||= {}).live_room = { id: room.id, at: now };
  return { room: { id: room.id, code: room.code, ticket, host: false }, message: { action: 'join', id: room.id, player: liveHost(p, pets, ticket) } };
}
// 방이 받지 못했을 때 되돌리기.
export function undoArenaLive(state, message) {
  if (message.action === 'init') state.arenaInvites = liveList(state).filter(x => x.id !== message.id);
  if (message.action === 'join') { const r = liveList(state).find(x => x.id === message.id); if (r && r.guest_id === message.player?.id) { r.guest_id = null; delete r.tickets[message.player.id]; } }
  return true;
}
// 홈 화면 20초 확인(/battle/invite)에 같이 싣는 초대.
export function arenaLiveInviteFor(state, p, now = Date.now()) {
  const r = tidyArenaLiveRead(state, now).find(x => x.invite_id === p.id && !x.guest_id && !x.declined);
  if (!r) return null;
  const host = state.profiles.find(x => x.id === r.host_id);
  return { id: r.id, host: host?.display_name || '친구', expires_at: r.at + ARENA_LIVE.ROOM_TTL_MS };
}
export function arenaLiveDecline(state, p, id) {
  const r = liveList(state).find(x => x.id === id && x.invite_id === p.id && !x.guest_id);
  if (r) r.declined = true;
  return !!r;
}
// 내 방(다시 들어가기용 입장표).
export function arenaLiveCurrent(state, p, now = Date.now()) {
  const r = liveRoomOf(state, p.id, now);
  return r && r.tickets[p.id] ? { id: r.id, code: r.code, ticket: r.tickets[p.id], host: r.host_id === p.id } : null;
}

// 방이 보낸 보고: kind 'result'(끝난 판) · 'cancel'(시작 못 하고 닫힘) · 'left'(친구가 대기실에서 나감).
export const arenaLivePending = (state, body) => body?.kind === 'left' || liveList(state).some(x => x.id === body?.id);
// 내 쪽(0 방장 · 1 친구)이 컴퓨터에게 맡긴 틱 수(조작 기록의 19 → 20).
export function aiTicksOf(list, end) {
  let on = null, n = 0;
  for (const [t, c] of list) {
    if (c === INPUT.AI_ON && on === null) on = t;
    else if (c === INPUT.AI_OFF && on !== null) { n += t - on; on = null; }
  }
  return on === null ? n : n + Math.max(0, end - on);
}
const humanInputs = list => list.filter(([, c]) => c !== INPUT.AI_ON && c !== INPUT.AI_OFF && !(c >= INPUT.AIM_EASY && c <= INPUT.AIM_FREE)).length;

// 끝난 판 정산: 두 조작 기록으로 같은 전투를 다시 돌려 승패를 정한다(방 · 화면이 말한 승패는 믿지 않는다).
//   profileOf(id) · who(p) · petKey(id)는 service.mjs가 준다. 돌려주는 값: { results: { 학생 id: 결과 } }.
export function settleArenaLive(state, body, { profileOf, who, petKey = () => null, log = () => {}, now = Date.now() }) {
  const list = liveList(state), room = list.find(x => x.id === body?.id);
  if (body?.kind === 'left') { if (room && room.guest_id) { room.guest_id = null; } return { ok: true }; }
  if (!room) return null;
  state.arenaInvites = list.filter(x => x !== room);
  const ids = [room.host_id, room.guest_id].filter(Boolean);
  for (const id of ids) { const a = profileOf(id)?.games?.arena; if (a?.live_room?.id === room.id) delete a.live_room; }
  if (body.kind !== 'result' || !room.guest_id || body.players?.[0] !== room.host_id || body.players?.[1] !== room.guest_id) return { ok: true, results: {} };
  const teams = (body.teams || []).map(t => (Array.isArray(t) ? t : []).slice(0, ARENA.TEAM).map(([key, form, level, s2]) => fighter({ key: String(key), form, level, s2 })));
  if (teams.length !== 2 || !teams[0].length || !teams[1].length) return { ok: true, results: {} };
  const ia = cleanInputs(body.inputs?.[0], ARENA.MAX_TICKS + 400, true), ib = cleanInputs(body.inputs?.[1], ARENA.MAX_TICKS + 400, true);
  const r = runArena({ seed: Number(body.seed) || 1, me: teams[0], foe: teams[1], inputs: ia, foeInputs: ib });
  const sides = ['me', 'foe'], host = profileOf(room.host_id), guest = profileOf(room.guest_id);
  // 져 주기 막기: 한쪽이라도 거의 조작하지 않았거나(20개 미만) 준 피해가 0이면 둘 다 보상 없음.
  const idle = humanInputs(ia) < ARENA_LIVE.MIN_INPUTS || humanInputs(ib) < ARENA_LIVE.MIN_INPUTS || !r.dealt.me || !r.dealt.foe;
  const grade = host && guest && sameArenaGrade(who(host), who(guest));
  const results = {};
  [host, guest].forEach((p, i) => {
    if (!p) return;
    const other = i ? host : guest, mySide = sides[i], foeSide = sides[1 - i];
    const away = aiTicksOf(i ? ib : ia, r.ticks) * 2 > r.ticks;
    const res = liveSettleOne(p, {
      id: room.id, other: other?.id || '', foe_name: String(other?.display_name || '친구').slice(0, 20),
      win: r.winner === mySide, draw: r.winner === 'draw', ko: r.ko[mySide], dealt: r.dealt[mySide], ults: r.ults[mySide], left: r.left[mySide], foe_left: r.left[foeSide],
      unpaid: !grade ? 'grade' : idle ? 'idle' : away ? 'away' : null, pet: petKey(p.id), now
    });
    log(p, res);
    results[p.id] = res;
  });
  return { ok: true, results, hash: r.hash, winner: r.winner, ticks: r.ticks };
}
function liveSettleOne(p, { id, other, foe_name, win, draw, ko, dealt, ults, left, foe_left, unpaid, pet, now }) {
  const g = games(p), a = g.arena ||= {};
  const seen = findReceipt(g, 'arena', id);
  if (seen) return seen.r;
  const today = dayKey(now);
  if (a.day !== today) { a.day = today; a.plays = 0; }
  if (a.pairs?.day !== today) a.pairs = { day: today, n: {} };
  a.lg = Number(a.lg || 0) + 1;
  if (win) a.lw = Number(a.lw || 0) + 1;
  delete a.live_made; // 판을 끝냈으면 바로 새 방을 만들 수 있다(같은 친구와 한 판 더)
  const base = { live: true, winner: win ? 'me' : draw ? 'draw' : 'foe', win, ko, dealt, ults, left, foe_left, foe_name, lw: a.lw, lg: a.lg };
  const pairN = Number(a.pairs.n[other] || 0);
  let out;
  if (unpaid) out = { ...base, paid: false, reason: unpaid };
  else if (pairN >= ARENA_LIVE.PAIR_DAILY) out = { ...base, paid: false, reason: 'pair' };
  else if (Number(a.plays || 0) >= ARENA.DAILY) out = { ...base, paid: false, reason: 'daily' };
  else if (Number(a.tk || 0) <= 0) out = { ...base, paid: false, reason: 'ticket' };
  else {
    const coins = win ? ARENA.COINS.win : ko >= 1 ? ARENA.COINS.lose : 0;
    a.plays = Number(a.plays || 0) + 1;
    a.tk = Number(a.tk || 0) - 1;
    const n = { ...a.pairs.n, [other]: pairN + 1 };
    a.pairs.n = Object.fromEntries(Object.entries(n).slice(-ARENA_LIVE.PAIRS_MAX));
    addBonus(p, { xp: ARENA.XP, coins, pet, now });
    out = { ...base, paid: true, coins, xp: ARENA.XP };
  }
  return { ...keepReceipt(g, 'arena', id, out, now), ...arenaView(p, now) };
}
export const arenaLiveLine = (res, name) => `친구 대전 ${res.win ? '승리' : res.winner === 'draw' ? '무승부' : '패배'}${name ? ` · ${String(name).slice(0, 10)}` : ''}${res.paid && res.coins ? ` · ${res.coins}코인` : ''}`;
// 이미 정산한 판의 보고를 방이 다시 보냈을 때(응답을 못 받음): 영수증으로 같은 결과.
export function arenaLiveReceipts(state, body) {
  const results = {};
  for (const pid of Array.isArray(body?.players) ? body.players.slice(0, 2) : []) {
    const p = state.profiles.find(x => x.id === pid), seen = p && findReceipt(p.games || {}, 'arena', body.id);
    if (seen) results[pid] = { ...seen.r, again: true };
  }
  return { ok: true, results };
}
