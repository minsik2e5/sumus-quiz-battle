// V13.230 펫 아레나 실시간 친구 대전 — 메인 상태 쪽(구성안 docs/pet-arena-v2-plan.md 1장).
// 메인 상태 객체는 판 시작(방 열기 · 들어가기)과 끝(결과 한 번)에만 일한다. 판 자체는 방 객체(cloudflare/arena-room.mjs)가 돌린다.
//   state.arenaInvites: 열린 방 목록 [{ id, code, mode, s 학교, d 학교급, g 학년, c 반, h 방장, hn 방장 이름, inv[초대한 학생], m[들어온 학생], t{학생: 입장표}, at, st }]
//     렉 방지(server/perf-budget.mjs 20KB): 대기 5분 · 시작한 방 30분 지나면 지우고, 최대 120개.
//   p.games.arena.pairs { day, m{ 친구 id: 오늘 코인 판 수 } }: 같은 친구와 코인 판 하루 2판(오늘 것만, 10줄).
//   p.games.arena.live_at: 방 만들기 1분에 1번. live_games · live_wins: 친구 대전 기록.
//   결과 영수증은 혼자 판과 같은 g.done(kind 'arena', id 'live:<방>')에 남는다(같은 보고를 두 번 받아도 한 번만 준다).
import { randomBytes } from 'node:crypto';
import { dayKey } from '../public/modules/core.js';
import { ARENA, baseS2, cleanTree } from '../public/modules/arena-rules.js';
import { LIVE, cleanCode } from '../public/modules/arena-live-rules.js';
import { gradeOf } from './competition.mjs';
import { addBonus, findReceipt, keepReceipt } from './rewards.mjs';
import { bumpCoinWin, decoOf } from './arena-deco.mjs';

export const ARENA_INVITES = { MAX: 120, STARTED_KEEP_MS: 30 * 60000 };
const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };
const games = p => p.games ||= {};
const GRADE = /^(중|고)[1-3]$/;

// 같은 학년끼리(선생님 결정 Q4): 같은 학교 · 같은 학교급 · 같은 학년(반은 달라도 된다). 학년을 모르는 반이면 같은 반만.
//   school: schoolForProfile 결과({ id, division }). 서버가 초대 · 방 코드 입장 · 끝 보고 때 모두 이것으로 확인한다.
export function arenaPeers(a, sa, b, sb) {
  if (!a || !b || a.id === b.id || !sa || !sb || sa.id !== sb.id) return false;
  const ga = gradeOf(a.class_name), gb = gradeOf(b.class_name);
  if (GRADE.test(ga) && GRADE.test(gb)) return ga === gb && (sa.division || '') === (sb.division || '');
  return !!a.class_name && a.class_name === b.class_name;
}
const bandOf = (p, school) => ({ s: school.id, d: school.division || '', g: GRADE.test(gradeOf(p.class_name)) ? gradeOf(p.class_name) : '', c: p.class_name || '' });
// 방(목록의 한 줄)에 이 학생이 들어갈 수 있나: 방장과 같은 학년.
const entryFits = (x, p, school) => {
  if (!school || school.id !== x.s) return false;
  const g = gradeOf(p.class_name);
  return x.g ? GRADE.test(g) && g === x.g && (school.division || '') === x.d : (p.class_name || '') === x.c;
};

// 읽기(GET)는 상태를 바꾸지 않는다: 목록이 없으면 빈 목록만 돌려준다(쓰는 쪽이 state.arenaInvites를 만든다).
const list = state => Array.isArray(state.arenaInvites) ? state.arenaInvites : [];
export const liveTicket = () => randomBytes(18).toString('base64url');
const openEntry = (x, now) => x.st === 'open' && now - x.at < LIVE.LOBBY_MS;
export function tidyArenaInvites(state, now = Date.now()) {
  const all = list(state);
  // 사람이 다 찬 방은 판이 끝나 보고가 올 때까지(30분) 남긴다. 들어가기 · 초대는 5분 안의 방만(openEntry).
  const keep = all.filter(x => x.st === 'open' && (now - x.at < LIVE.LOBBY_MS || (x.m.length >= 2 && now - x.at < ARENA_INVITES.STARTED_KEEP_MS))).slice(-ARENA_INVITES.MAX);
  if (keep.length !== all.length) state.arenaInvites = keep;
  return keep;
}
function newCode(state, now) {
  const used = new Set(list(state).filter(x => openEntry(x, now)).map(x => x.code));
  for (let i = 0; i < 50; i++) { const c = String(randomBytes(2).readUInt16BE(0) % 10000).padStart(LIVE.CODE_LEN, '0'); if (!used.has(c)) return c; }
  fail('방이 너무 많아요. 잠시 뒤에 다시 만들어 주세요.', 409);
}

// 방에 보내는 학생 정보: 싸울 수 있는 펫(알이 아닌 것, 레벨 순 40마리까지)과 기본 스킬 ②(고른 기록, 없으면 이름에서) · V13.231 스킬트리 가지.
export function livePlayer(p, pets) {
  const s2 = p.games?.arena?.s2 || {}, tr = p.games?.arena?.tr || {};
  const ready = (pets || []).filter(x => Number(x.form) >= 1).sort((a, b) => b.level - a.level).slice(0, 40);
  return { id: p.id, name: String(p.display_name || '친구').slice(0, 20), cls: String(p.class_name || '').slice(0, 20), pets: ready.map(x => ({ key: x.key, form: Number(x.form), level: Number(x.level), s2: baseS2(x.key, s2[x.key]), tr: cleanTree(tr[x.key]) })), dc: decoOf(p.games?.arena) }; // V13.235 꾸미기(방장 경기장 · 링, 사람마다 입장 효과)
}
const roomView = (x, p) => ({ id: x.id, code: x.code, mode: x.mode, host: x.hn, ticket: x.t[p.id], is_host: x.h === p.id });

// 지금 내가 들어가 있는(대기 중인) 방.
export const myLiveRoom = (state, p, now = Date.now()) => list(state).filter(x => openEntry(x, now) && x.m.includes(p.id)).sort((a, b) => b.at - a.at)[0] || null;
// 받은 초대(첫 화면이 이미 20초마다 묻는 /battle/invite GET에 같이 싣는다 — 새 자동 새로고침 없음).
export function arenaInviteFor(state, p, school, now = Date.now()) {
  if (p?.role !== 'student') return null;
  const x = list(state).filter(e => openEntry(e, now) && e.inv.includes(p.id) && !e.m.includes(p.id) && entryFits(e, p, school)).sort((a, b) => b.at - a.at)[0];
  return x ? { id: x.id, code: x.code, host: x.hn, mode: x.mode, expires_at: x.at + LIVE.LOBBY_MS } : null;
}

// 방 만들기(방장). 하던 대기 방이 있으면 닫는다. 1분에 1번.
export function liveOpen(state, p, school, pets, { id, now = Date.now(), mode = '1v1' }) {
  if (!school) fail('학생 학교 설정을 확인해주세요.', 409);
  if (!LIVE.MODES[mode]) fail('1:1 · 1:1:1 난투 · 2:2 팀전 중에서 골라 주세요.');
  const player = livePlayer(p, pets);
  if (!player.pets.length) fail('알에서 깬 펫이 있어야 싸울 수 있어요. 공부해서 펫을 키워 주세요!', 409);
  const a = games(p).arena ||= {};
  if (now - Number(a.live_at || 0) < LIVE.OPEN_GAP_MS) fail(`방은 1분에 한 번 만들 수 있어요. ${Math.ceil((LIVE.OPEN_GAP_MS - (now - a.live_at)) / 1000)}초 뒤에 다시 해 주세요.`, 429);
  tidyArenaInvites(state, now);
  // 아직 친구가 안 들어온 내 방만 닫는다(사람이 찬 방은 판 중이거나 결과 보고를 기다릴 수 있다).
  const closing = list(state).filter(x => x.st === 'open' && x.h === p.id && x.m.length < 2);
  for (const x of closing) x.st = 'closed';
  for (const x of list(state)) if (x.st === 'open' && x.h !== p.id && x.m.includes(p.id)) x.m = x.m.filter(m => m !== p.id);
  state.arenaInvites = list(state).filter(x => x.st !== 'closed');
  a.live_at = now;
  const ticket = liveTicket();
  const x = { id, code: newCode(state, now), mode, ...bandOf(p, school), h: p.id, hn: player.name, inv: [], m: [p.id], t: { [p.id]: ticket }, at: now, st: 'open' };
  state.arenaInvites = [...list(state), x].slice(-ARENA_INVITES.MAX);
  return { room: roomView(x, p), _arenas: [...closing.map(c => ({ action: 'close', id: c.id })), { action: 'init', id, code: x.code, mode, ticket, host: player }] };
}

// 친구 초대(방장만). 친구는 같은 학년이어야 한다.
export function liveInvite(state, p, school, friend, friendSchool, now = Date.now()) {
  const x = list(state).find(e => openEntry(e, now) && e.h === p.id);
  if (!x) fail('열린 방이 없어요. 방을 먼저 만들어 주세요.', 404);
  if (!friend || friend.role !== 'student' || friend.active === false || !arenaPeers(p, school, friend, friendSchool)) fail('같은 학년 친구만 초대할 수 있어요.', 403);
  if (x.m.includes(friend.id)) return { ok: true, already: true };
  if (!x.inv.includes(friend.id)) {
    if (x.inv.length >= LIVE.INVITES_MAX) fail(`초대는 한 방에 ${LIVE.INVITES_MAX}명까지예요.`, 409);
    x.inv.push(friend.id);
  }
  return { ok: true, friend: String(friend.display_name || '').slice(0, 20) };
}

// 들어가기: 방 코드 4자리(code) 또는 받은 초대(id). 같은 학년만.
export function liveJoin(state, p, school, pets, { code, id, now = Date.now() }) {
  tidyArenaInvites(state, now);
  const c = cleanCode(code);
  const x = list(state).find(e => openEntry(e, now) && (id ? e.id === id : c && e.code === c && e.s === school?.id));
  if (!x) fail(id ? '초대한 방이 닫혔어요.' : '그 번호의 방을 찾지 못했어요. 번호를 다시 확인해 주세요.', 404);
  if (x.h === p.id || x.m.includes(p.id)) return { room: roomView(x, p) };
  if (!entryFits(x, p, school)) fail('같은 학년 친구 방에만 들어갈 수 있어요.', 403);
  // 꽉 찼는지는 방이 정한다(대기실에서 나간 친구 자리는 비어 있다). 방이 받지 못하면 undoLiveJoin으로 되돌린다.
  if (x.m.length >= 8) fail('방이 꽉 찼어요.', 409);
  const player = livePlayer(p, pets);
  if (!player.pets.length) fail('알에서 깬 펫이 있어야 싸울 수 있어요. 공부해서 펫을 키워 주세요!', 409);
  // 다른 대기 방에 들어가 있었으면 거기서 빠진다(방장인 방은 닫는다).
  const closing = [];
  for (const e of list(state)) if (e !== x && e.st === 'open') {
    if (e.h === p.id && e.m.length < 2) { e.st = 'closed'; closing.push(e); }
    else if (e.m.includes(p.id) && e.h !== p.id) e.m = e.m.filter(m => m !== p.id);
  }
  if (closing.length) state.arenaInvites = list(state).filter(e => e.st !== 'closed');
  const ticket = x.t[p.id] ||= liveTicket();
  x.m.push(p.id);
  x.inv = x.inv.filter(i => i !== p.id);
  return { room: roomView(x, p), _arenas: [...closing.map(c => ({ action: 'close', id: c.id })), { action: 'join', id: x.id, ticket, player }] };
}
// 방이 받지 못했으면(꽉 참 · 이미 시작) 메인 상태를 되돌린다(cloudflare/worker.mjs).
export function undoLiveJoin(state, message) {
  const x = list(state).find(e => e.id === message?.id);
  if (!x) return false;
  if (message.action === 'init') { x.st = 'closed'; state.arenaInvites = list(state).filter(e => e.st !== 'closed'); return true; }
  const pid = message.player?.id;
  x.m = x.m.filter(m => m !== pid); delete x.t[pid];
  return true;
}
export function liveDecline(state, p, id) {
  const x = list(state).find(e => e.id === id && e.inv.includes(p.id));
  if (!x) return false;
  x.inv = x.inv.filter(i => i !== p.id);
  return true;
}

// 방이 보낸 결과(cloudflare/worker.mjs /api/internal/arena-result). 아직 정산 안 한 방인지(상태 복사 없이).
export const arenaReportPending = (state, body) => list(state).some(x => x.id === body?.id && x.st === 'open');

// 정산: 그 판 사람들(1:1이면 2명) 프로필만 고친다. profiles: id → 프로필, schools: id → 학교. activePet: id → 펫 키(경험치).
export function settleArenaLive(state, body, { profileOf, schoolOf, activePet = () => null, log = () => {}, now = Date.now() }) {
  const x = list(state).find(e => e.id === body?.id);
  if (!x || x.st !== 'open') return false;
  x.st = 'done';
  state.arenaInvites = list(state).filter(e => e.st !== 'done');
  // V13.232 컴퓨터 자리(bot)는 보상 계산에서 뺀다(방이 bot 표시 · 학생 id가 아닌 'bot:n'을 보낸다).
  const res = body.result || {}, seats = (Array.isArray(res.seats) ? res.seats.slice(0, LIVE.MODES[x.mode]?.seats || 2) : []).filter(s => !s.bot).map(s => ({ ...s, mode: x.mode }));
  // 자리는 방이 보낸 것(방 열쇠로만 오는 보고)을 믿는다.
  const people = seats.map(s => ({ s, p: typeof s.id === 'string' ? profileOf(s.id) : null }));
  for (const { s, p } of people) {
    if (!p || p.role !== 'student') continue;
    const others = people.filter(o => o.p && o.p !== p);
    // 끝 보고 때도 같은 학년인지 다시 본다(그 사이 반이 바뀌었으면 기록만).
    const peers = others.every(o => arenaPeers(p, schoolOf(p), o.p, schoolOf(o.p)));
    const out = liveSettleOne(p, { id: x.id, seat: s, others: others.map(o => o.p), winner: res.winner, idle: !!res.idle, peers, pet: activePet(p.id), now });
    log(p, `펫 아레나 ${x.mode === 'ffa' ? '난투' : x.mode === '2v2' ? '팀전' : '친구 대전'} ${out.win ? '승리' : res.winner === 'draw' ? '무승부' : '패배'}${others[0] ? ` · ${String(others[0].p.display_name || '').slice(0, 10)}` : ''}${out.paid && out.coins ? ` · ${out.coins}코인` : ''}`, now);
  }
  return true;
}

// 한 사람 정산: 보상은 혼자 판과 같은 크기 · 하루 5판 합산 · 입장권도 같이. 같은 친구 코인 판 하루 2판.
export function liveSettleOne(p, { id, seat, others, winner, idle, peers = true, pet = null, now = Date.now() }) {
  const g = games(p), a = g.arena ||= {}, rid = `live:${id}`;
  const seen = findReceipt(g, 'arena', rid);
  if (seen) return seen.r;
  const today = dayKey(now);
  if (a.day !== today) { a.day = today; a.plays = 0; }
  if (a.pairs?.day !== today) a.pairs = { day: today, m: {} };
  // V13.232 여러 명 판은 방이 사람마다 이겼는지(seat.win: 난투 1등 · 팀전 이긴 팀)를 보낸다.
  const win = seat.win != null ? !!seat.win : winner === seat.side, pairKey = others.map(o => o.id).sort().join('+');
  a.live_games = Number(a.live_games || 0) + 1;
  if (win) a.live_wins = Number(a.live_wins || 0) + 1;
  const base = { live: true, mode: LIVE.MODES[seat.mode] ? seat.mode : '1v1', place: Number(seat.place || 0) || null, winner: winner === 'draw' ? 'draw' : win ? 'me' : 'foe', win, ko: Number(seat.ko || 0), dealt: Number(seat.dealt || 0), ults: Number(seat.ults || 0), foe_name: others.map(o => String(o.display_name || '')).join(', ').slice(0, 30) };
  const why = !peers ? 'grade' : idle || seat.idle ? 'idle' : seat.ai_half ? 'ai' : Number(a.pairs.m[pairKey] || 0) >= LIVE.PAIR_DAILY ? 'pair'
    : Number(a.plays || 0) >= ARENA.DAILY ? 'daily' : Number(a.tk || 0) <= 0 ? 'ticket' : '';
  let out;
  if (why) out = { ...base, paid: false, reason: why };
  else {
    const coins = win ? ARENA.COINS.win : base.ko >= 1 ? ARENA.COINS.lose : 0;
    a.plays = Number(a.plays || 0) + 1;
    a.tk = Number(a.tk || 0) - 1;
    if (win) bumpCoinWin(a); // V13.235 꾸미기 열림: 코인 판 승리만 센다
    a.pairs.m = Object.fromEntries([...Object.entries(a.pairs.m), [pairKey, Number(a.pairs.m[pairKey] || 0) + 1]].slice(-10));
    addBonus(p, { xp: ARENA.XP, coins, pet, now });
    out = { ...base, paid: true, coins, xp: ARENA.XP };
  }
  return keepReceipt(g, 'arena', rid, out, now);
}
// 화면이 결과를 읽는다(GET): 영수증 한 줄.
export const liveResult = (p, id) => findReceipt(p.games || {}, 'arena', `live:${String(id || '').slice(0, 80)}`)?.r || null;
// 오늘 이 친구와 코인 판 몇 판 남았나(친구 목록에 보여 준다).
export const pairLeft = (p, friendId, now = Date.now()) => { const m = p.games?.arena?.pairs; return Math.max(0, LIVE.PAIR_DAILY - (m?.day === dayKey(now) ? Number(m.m?.[friendId] || 0) : 0)); };
