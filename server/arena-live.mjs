// V13.230 펫 아레나 실시간 1:1 — 방(cloudflare/arena-room.mjs)이 돌리는 판의 규칙. 화면 · 저장소 · 소켓은 없다(검사가 Node에서 돌린다).
//   대기실: 방장 + 친구 1명. 각자 팀(3마리) · 스킬 ② · 조준 방식을 고르고 '준비' → 방장이 시작.
//   판: 두 학생이 보낸 조작에 방이 틱 번호를 정하고(너무 늦으면 다음 틱 · 너무 미래면 지금 틱), 0.1초마다 확정 묶음을 보낸다.
//   방도 같은 전투(arena-rules.js)를 확정된 만큼 돌려 1초마다 상태 요약을 보내고(어긋남 찾기), 끝나면 승패를 안다.
//   끊김: 3초 소식이 없으면 그 틱부터 컴퓨터가 대신 조종(조작 기록에 19), 다시 들어오면 돌려준다(20). 그래서 모든 폰이 같은 결과.
//   메인 상태 객체는 방 만들기 · 들어가기 · 끝 보고에만 쓴다(렉 방지 규칙 6). 끝 보고를 받은 메인이 두 조작 기록으로 다시 돌려
//   승패 · 보상을 정한다(server/arena.mjs settleArenaLive). 화면이나 방이 말한 승패는 믿지 않는다.
import { ARENA, INPUT, AIMABLE, createArena, fighter, cleanPicks } from '../public/modules/arena-rules.js';
import { LIVE } from '../public/modules/arena-live.js';

export { LIVE };
const AIM_CODE = { free: null, easy: INPUT.AIM_EASY, auto: INPUT.AIM_AUTO };
const PETS_MAX = 40;

// 메인이 보낸 학생: { id, name, ticket, pets: [[key, form, level] …], s2 { key: 0 | 1 }, team: [key …] }.
export function livePlayer(raw) {
  const pets = (Array.isArray(raw?.pets) ? raw.pets : []).slice(0, PETS_MAX)
    .map(([key, form, level]) => [String(key).slice(0, 40), Math.max(1, Math.min(3, Number(form) || 1)), Math.max(1, Math.min(99, Number(level) || 1))])
    .filter(([key]) => key);
  const keys = new Set(pets.map(x => x[0]));
  const team = (Array.isArray(raw?.team) ? raw.team : []).map(String).filter(k => keys.has(k)).slice(0, ARENA.TEAM);
  for (const [k] of pets) if (team.length < ARENA.TEAM && !team.includes(k)) team.push(k);
  return { id: String(raw?.id || ''), name: String(raw?.name || '친구').slice(0, 20), ticket: String(raw?.ticket || ''), pets, s2: cleanPicks(raw?.s2, PETS_MAX), team, aim: 'free', ready: false };
}

export function createLive({ id, code, host, invite = null, now }) {
  return { id, code, invite, phase: 'lobby', created_at: now, players: [livePlayer(host), null], emoteAt: [0, 0] };
}
export function joinLive(r, guest, now) {
  if (r.phase !== 'lobby') return { error: '이미 시작한 방이에요.' };
  const p = livePlayer(guest);
  if (r.players[0]?.id === p.id) return { error: '내가 만든 방이에요.' };
  if (r.players[1] && r.players[1].id !== p.id) return { error: '방이 가득 찼어요.' };
  // 다시 들어오면 고른 것을 그대로 둔다(입장표만 새로).
  r.players[1] = r.players[1]?.id === p.id ? { ...r.players[1], ticket: p.ticket } : p;
  r.joined_at = now;
  return { ok: true };
}
export function leaveLive(r, idx) {
  if (r.phase !== 'lobby') return { error: '판이 시작됐어요.' };
  if (idx === 0) { r.phase = 'closed'; r.reason = 'host_left'; return { ok: true, closed: true }; }
  r.players[1] = null;
  if (r.players[0]) r.players[0].ready = false;
  return { ok: true };
}
// 대기실에서 고르기: 팀 · 스킬 ② · 조준 · 준비. 고른 것이 바뀌면 준비가 풀린다.
export function lobbySet(r, idx, msg) {
  const p = r.players[idx];
  if (!p || r.phase !== 'lobby') return false;
  const keys = new Set(p.pets.map(x => x[0]));
  if (Array.isArray(msg.team)) {
    const team = [...new Set(msg.team.map(String))].filter(k => keys.has(k)).slice(0, ARENA.TEAM);
    if (team.length) { p.team = team; p.ready = false; }
  }
  if (msg.s2 && typeof msg.s2 === 'object') { p.s2 = Object.fromEntries(Object.entries({ ...p.s2, ...cleanPicks(msg.s2, PETS_MAX) }).filter(([k]) => keys.has(k))); p.ready = false; }
  if (typeof msg.aim === 'string' && msg.aim in AIM_CODE) p.aim = msg.aim;
  if (typeof msg.ready === 'boolean') p.ready = msg.ready && p.team.length > 0;
  return true;
}
const teamOf = p => p.team.map(key => { const [, form, level] = p.pets.find(x => x[0] === key); return [key, form, level, p.s2[key] === 1 ? 1 : 0]; });
export const unpackTeam = list => list.map(([key, form, level, s2]) => fighter({ key, form, level, s2 }));

// 시작(방장만, 둘 다 준비). seed는 방이 정한다.
export function startLive(r, idx, now, seed) {
  if (r.phase !== 'lobby') return { error: '이미 시작했어요.' };
  if (idx !== 0) return { error: '방장이 시작해요.' };
  if (!r.players[1]) return { error: '친구가 아직 안 들어왔어요.' };
  if (!r.players.every(p => p.ready)) return { error: '둘 다 준비를 눌러야 시작해요.' };
  Object.assign(r, {
    phase: 'play', seed, start_at: now + LIVE.VS_MS, teams: r.players.map(teamOf),
    inputs: [[], []], buf: [[], []], seq: [0, 0], lastT: [0, 0], upto: -1, seen: [now + LIVE.VS_MS, now + LIVE.VS_MS], ai: [false, false], ai_since: [null, null], ai_ticks: [0, 0], acks: [0, 0]
  });
  // 조준 방식(대기실에서 고른 것)은 첫 틱 조작으로(혼자 판과 같다).
  r.players.forEach((p, i) => { const c = AIM_CODE[p.aim]; if (c) r.buf[i].push([0, c]); });
  return { ok: true };
}
export const roomTick = (r, now) => Math.floor((now - r.start_at) / ARENA.TICK_MS);

// 학생이 보낸 조작 { s: 첫 순번, l: [[틱, 코드, 조준?] …] }. 늦거나 앞선 틱은 고쳐 받는다. 받은 개수를 돌려준다.
export function acceptInputs(r, idx, seq0, list, now) {
  if (r.phase !== 'play' || !Array.isArray(list)) return 0;
  r.seen[idx] = now;
  backFromAway(r, idx);
  const tick = roomTick(r, now);
  let n = 0;
  for (let j = 0; j < Math.min(list.length, LIVE.BATCH_MAX); j++) {
    const x = list[j], seq = Number(seq0) + j;
    if (!Number.isInteger(seq) || seq <= r.seq[idx]) continue;
    if (!Array.isArray(x)) break;
    const c = Math.round(Number(x[1])), a = x.length > 2 && x[2] != null ? Math.round(Number(x[2])) : null;
    if (!((c >= 0 && c <= 8) || (c >= 10 && c <= 18))) break;
    if (a !== null && (!AIMABLE.includes(c) || !(a >= 0 && a <= 15))) break;
    if (r.inputs[idx].length + r.buf[idx].length >= ARENA.INPUT_MAX - 4) break;
    let t = Math.round(Number(x[0]));
    if (!Number.isFinite(t)) break;
    t = Math.min(Math.max(t, r.upto + 1, r.lastT[idx]), Math.max(r.upto + 1, tick + LIVE.AHEAD));
    if (t > ARENA.MAX_TICKS) break;
    r.lastT[idx] = t; r.seq[idx] = seq;
    r.buf[idx].push(a === null ? [t, c, null, seq] : [t, c, a, seq]);
    n++;
  }
  return n;
}
export function touchLive(r, idx, now) { if (r.phase === 'play') { r.seen[idx] = now; backFromAway(r, idx); } }
function backFromAway(r, idx) {
  if (!r.ai[idx]) return;
  const t = Math.max(r.upto + 1, r.lastT[idx]);
  r.buf[idx].push([t, INPUT.AI_OFF]); r.lastT[idx] = t;
  r.ai[idx] = false; r.ai_ticks[idx] += t - r.ai_since[idx]; r.ai_since[idx] = null;
}

// 방의 전투(확정된 만큼). 방이 잠들었다 깨면 저장된 조작 기록으로 다시 만든다.
export function liveSim(r) {
  const A = createArena({ seed: r.seed, me: unpackTeam(r.teams[0]), foe: unpackTeam(r.teams[1]), foeHuman: true });
  for (const x of r.inputs[0]) A.push(x);
  for (const x of r.inputs[1]) A.push2(x);
  while (!A.S.over && A.S.t <= r.upto) A.step();
  return A;
}

// 0.1초마다: 끊긴 학생은 컴퓨터로, 지금 틱 − 8까지 확정해서 묶음을 만든다. 끝났으면 result를 채운다.
export function flushLive(r, sim, now) {
  if (r.phase !== 'play') return null;
  const tick = roomTick(r, now), u = Math.min(tick - LIVE.DELAY, ARENA.MAX_TICKS + 1);
  if (u <= r.upto) return null;
  for (const idx of [0, 1]) {
    if (!r.ai[idx] && now - r.seen[idx] > LIVE.AWAY_MS && tick >= 0) {
      const t = Math.max(r.upto + 1, r.lastT[idx]);
      r.buf[idx].push([t, INPUT.AI_ON]); r.lastT[idx] = t;
      r.ai[idx] = true; r.ai_since[idx] = t;
    }
  }
  const out = [], acks = [...r.acks];
  for (const idx of [0, 1]) {
    let k = 0;
    while (k < r.buf[idx].length && r.buf[idx][k][0] <= u) {
      const [t, c, a, seq] = r.buf[idx][k++], x = a == null ? [t, c] : [t, c, a];
      r.inputs[idx].push(x);
      out.push([idx, ...x]);
      if (seq) acks[idx] = seq;
      idx ? sim.push2(x) : sim.push(x);
    }
    r.buf[idx].splice(0, k);
  }
  r.acks = acks;
  while (!sim.S.over && sim.S.t <= u) sim.step();
  r.upto = u;
  const batch = { u, i: out, k: acks };
  if (sim.S.t % LIVE.HASH_EVERY === 0 || sim.S.over) batch.h = { t: sim.S.t, v: sim.hash() };
  if (sim.S.over || u >= ARENA.MAX_TICKS) endLive(r, sim);
  return batch;
}
function endLive(r, sim) {
  for (const idx of [0, 1]) if (r.ai[idx]) r.ai_ticks[idx] += sim.S.t - r.ai_since[idx];
  r.phase = 'ended';
  r.result = { winner: sim.S.winner || 'draw', ticks: sim.S.t, ko: { ...sim.S.ko }, dealt: { ...sim.S.dealt }, hash: sim.hash() };
  delete r.buf;
}

// 방이 오래 잠들어 있었을 때(두 폰 모두 꺼짐 등): 판 끝 시각이 지났으면 남은 시간을 끝까지 돌린다. 연결이 없는 쪽은 컴퓨터가.
export function finishLate(r, sim, now) {
  if (r.phase !== 'play') return null;
  const endAt = r.start_at + (ARENA.MAX_TICKS + LIVE.DELAY + 2) * ARENA.TICK_MS;
  if (now < endAt) return null;
  return flushLive(r, sim, endAt);
}

// 메인에 보낼 끝 보고(두 조작 기록 그대로. 메인이 다시 돌려 승패 · 보상을 정한다).
export function liveReport(r) {
  if (r.phase === 'ended') return { id: r.id, kind: 'result', report_id: `arena-live:${r.id}`, seed: r.seed, players: r.players.map(p => p.id), teams: r.teams, inputs: r.inputs, room: r.result };
  return { id: r.id, kind: 'cancel', report_id: `arena-live:${r.id}`, players: r.players.filter(Boolean).map(p => p.id), reason: r.reason || 'closed' };
}

// 이모트: 8개 중 하나, 학생마다 1.5초에 1번.
export function emoteLive(r, idx, i, now) {
  if (!Number.isInteger(i) || i < 0 || i >= LIVE.EMOTES.length) return false;
  if (now - (r.emoteAt?.[idx] || 0) < LIVE.EMOTE_GAP_MS) return false;
  (r.emoteAt ||= [0, 0])[idx] = now;
  return true;
}

// 대기실 화면(학생마다): 친구 펫 목록은 보내지 않고, 고른 팀만.
export function lobbyView(r, idx, now) {
  const seat = (p, i) => p ? { name: p.name, me: i === idx, host: i === 0, ready: p.ready, aim: p.aim, team: teamOf(p), ...(i === idx ? { pets: p.pets, s2: p.s2 } : {}) } : null;
  return { phase: r.phase, code: r.code, side: idx, seats: r.players.map(seat), expires_at: r.created_at + LIVE.LOBBY_MS, now, reason: r.reason || null };
}
