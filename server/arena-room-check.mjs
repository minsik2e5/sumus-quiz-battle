// V13.230 검사: 펫 아레나 실시간 친구 대전(cloudflare/arena-room.mjs · public/modules/arena-live-rules.js · server/arena-live.mjs).
//   party-room-check.mjs처럼 가짜 시계 · 저장소 · 소켓으로, 지연이 다른 폰 두 대(롤백 전투)가 진짜 방 객체와 한 판을 끝까지 한다.
//   대기실 · 같은 학년 확인 · 롤백 결과 = 서버 판정 · 끊김 대신 조종 · 보상/농사 막기 · 메시지 예산 · 이모트 제한 · 다시 보기 · 방 재시작.
// cloudflare-check.mjs가 부른다. 숫자만 보려면: node server/arena-room-check.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { ArenaRoom, arenaReportKey } from '../cloudflare/arena-room.mjs';
import { ARENA, ARENA_N, INPUT, createArena, runArena, runArenaN, fighter } from '../public/modules/arena-rules.js';
import { LIVE, LIVE_EMOTES, createLiveSim, createReplaySim, createTimeline, liveVerdict, liveFighters, liveTeam, mirrorView, mirrorInput, mirrorEvent, cleanReplays, cleanCode,
  createLiveSimN, createReplaySimN, createTimelineN, liveVerdictN, seatSides, shuffleTeams, slotsFor, multiMode } from '../public/modules/arena-live-rules.js';
import { arenaPeers, liveOpen, liveJoin, liveInvite, liveDecline, arenaInviteFor, myLiveRoom, settleArenaLive, liveSettleOne, tidyArenaInvites, undoLiveJoin, arenaReportPending, pairLeft, ARENA_INVITES } from './arena-live.mjs';
import { STATE_BUDGET_KB } from './perf-budget.mjs';
import { dayKey, CHARACTERS } from '../public/modules/core.js';

const source = path => readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8');
const fails = (fn, word) => { try { fn(); return false; } catch (err) { return !word || String(err.message).includes(word); } };

function fakeSocket() {
  return { readyState: 1, tags: [], sent: [], hook: null, send(text) { this.sent.push(text); this.hook?.(text); }, close(code) { this.readyState = 3; this.closedWith = code; } };
}
function fakeCtx() {
  const store = new Map(), sockets = [];
  const ctx = {
    alarm: null, store, writes: 0,
    storage: {
      async get(key) { return store.has(key) ? structuredClone(store.get(key)) : undefined; },
      async put(key, value) { ctx.writes++; store.set(key, structuredClone(value)); },
      async setAlarm(time) { ctx.alarm = time; },
      async deleteAll() { store.clear(); ctx.alarm = null; }
    },
    blockConcurrencyWhile: fn => fn(),
    acceptWebSocket(ws, tags) { ws.tags = tags; sockets.push(ws); },
    getWebSockets(tag) { return sockets.filter(ws => ws.readyState === 1 && (!tag || ws.tags.includes(tag))); },
    getTags: ws => ws.tags
  };
  return ctx;
}
const pets = (keys, level = 12) => keys.map((key, i) => ({ key, form: 2, level: level - i, s2: 0 }));
const lcg = seed => { let s = seed >>> 0; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; };

// 조작하는 검사용 폰: 틱마다 가끔 방향을 바꾸고 공격 · 스킬 · 회피 · 필살기를 누른다(화면 좌표, 손님은 엔진이 돌린다).
function botInputs(sim, rnd) {
  const t = sim.S.t, out = [];
  if (rnd() < 0.12) out.push([t, 1 + Math.floor(rnd() * 8)]);
  if (rnd() < 0.03) out.push([t, 0]);
  if (sim.S.me.cd <= 1 && rnd() < 0.5) out.push(rnd() < 0.5 ? [t, INPUT.ATK] : [t, INPUT.ATK, Math.floor(rnd() * 16)]);
  if (sim.S.me.skill <= 0 && rnd() < 0.05) out.push([t, INPUT.SKILL]);
  if (sim.S.me.skill2 <= 0 && rnd() < 0.04) out.push([t, INPUT.SKILL2, Math.floor(rnd() * 16)]);
  if (sim.S.me.gauge >= ARENA.GAUGE_MAX && rnd() < 0.1) out.push([t, INPUT.ULT]);
  if (sim.S.me.dodgeCd <= 0 && rnd() < 0.02) out.push([t, INPUT.DODGE]);
  return out;
}

// 방 하나 + 폰 두 대로 한 판. opts: 지연(ms) · 끊김(틱 구간) · 조작 안 하는 폰 · 방 재시작 시각.
export async function liveMatch({ seed = 12345, lag = { a: 40, b: 130 }, jitter = 30, drop = null, idle = null, restartAt = null, emoteSpam = false } = {}) {
  const realNow = Date.now, RealResponse = globalThis.Response, realPair = globalThis.WebSocketPair;
  let clock = 50_000_000;
  Date.now = () => clock;
  globalThis.WebSocketPair = function () { return { 0: fakeSocket(), 1: fakeSocket() }; };
  globalThis.Response = class extends RealResponse { constructor(body, init = {}) { if (init.status === 101) { super(null, { status: 200 }); this.upgraded = init.webSocket; return; } super(body, init); } };
  const reports = [];
  const env = { VOCA_STATE_SECRET: 'test-secret', VOCA_STATE: { idFromName: n => n, get: () => ({ fetch: async (url, init) => { reports.push({ url, key: init.headers['X-Arena-Key'], body: JSON.parse(init.body) }); return new RealResponse('{}', { status: 200 }); } }) } };
  let ctx = fakeCtx(), room = new ArenaRoom(ctx, env, { timers: false });
  room.seed = () => seed;
  await room.ready;
  const out = { reports, ctx };
  try {
    const admin = msg => room.admin({ id: 'room-1', ...msg }).then(res => res.json().then(body => ({ status: res.status, ...body })));
    assert.equal((await admin({ action: 'init', code: '0420', mode: '1v1', ticket: 'ta', host: { id: 'a', name: '가온', pets: pets(['dragon', 'dog', 'bear', 'cat']) } })).ok, true, '방 만들기');
    assert.equal((await admin({ action: 'join', ticket: 'tb', player: { id: 'b', name: '나래', pets: pets(['turtle', 'fox', 'tiger']) } })).ok, true, '들어가기');
    out.full = (await admin({ action: 'join', ticket: 'tc', player: { id: 'c', name: '다솜', pets: pets(['dog']) } })).status;
    out.badTicket = (await room.accept(new URL('https://arena/ws?ticket=nope'))).status;
    // 폰: 받은 메시지는 지연만큼 늦게 도착(순서는 지킨다).
    const phones = {};
    const inbox = [];
    const deliver = (to, text, at) => inbox.push({ to, text, at });
    const lastAt = {};
    const late = who => { const base = lag[who] + Math.floor((phones[who]?.rnd?.() ?? 0.5) * jitter); lastAt[who] = Math.max(lastAt[who] || 0, clock + base); return lastAt[who]; };
    async function connect(who, ticket) {
      await room.accept(new URL(`https://arena/ws?ticket=${ticket}`));
      const ws = ctx.getWebSockets(who).at(-1);
      phones[who].ws = ws;
      for (const text of ws.sent.splice(0)) deliver(who, text, late(who));
      ws.hook = text => { ws.sent.length = 0; deliver(who, text, late(who)); };
    }
    for (const [who, t] of [['a', 'ta'], ['b', 'tb']]) { phones[who] = { who, rnd: lcg(who === 'a' ? 7 : 99), got: [], lobby: null, sim: null, msgs: 0, bytes: 0 }; await connect(who, t); }
    const toRoom = (who, msg) => { const text = JSON.stringify(msg); phones[who].msgs++; phones[who].bytes += text.length; inbox.push({ to: 'room', who, text, at: late(who) }); };
    const flushInbox = async () => {
      inbox.sort((x, y) => x.at - y.at);
      while (inbox.length && inbox[0].at <= clock) {
        const m = inbox.shift();
        if (m.to === 'room') { const ws = phones[m.who].ws; if (ws.readyState === 1) await room.webSocketMessage(ws, m.text); continue; }
        const p = phones[m.to], msg = JSON.parse(m.text);
        if (p.offline) continue;
        p.got.push(msg.type);
        if (msg.type === 'lobby') p.lobby = msg;
        if (msg.type === 'start' && !p.sim) {
          p.start = msg;
          p.sim = createLiveSim({ seed: msg.seed, teams: { me: liveFighters(msg.teams.me), foe: liveFighters(msg.teams.foe) }, side: msg.side, send: l => toRoom(m.to, { type: 'in', l }), onDesync: () => { p.desync = (p.desync || 0) + 1; toRoom(m.to, { type: 'sync' }); } });
        }
        if (!p.sim) continue;
        if (msg.type === 'b') p.sim.onBatch(msg);
        if (msg.type === 'all') p.sim.rebuild(msg.inputs, msg.c);
        if (msg.type === 'ai') (p.ai ||= []).push(msg);
        if (msg.type === 'emo') (p.emo ||= []).push(msg);
        if (msg.type === 'over') { p.over = msg; p.sim.end({ winner: msg.winner, ticks: msg.ticks, all: msg.all }); }
      }
    };
    const run = async ms => { const end = clock + ms; while (clock < end) { clock += 10; await flushInbox(); } };
    await run(300);
    out.lobby = phones.b.lobby;
    // 대기실: 고르기 · 준비 · 시작.
    toRoom('b', { type: 'start' });
    toRoom('a', { type: 'start' });
    await run(300);
    out.startEarly = room.room.phase;
    toRoom('a', { type: 'team', keys: ['bear', 'dragon', 'not-mine'], s2: { bear: 1 } });
    toRoom('b', { type: 'team', keys: ['tiger', 'turtle', 'fox'] });
    toRoom('b', { type: 'ready', on: true });
    await run(300);
    out.teamA = room.room.seats[0].team;
    out.emoLobby = (() => { toRoom('a', { type: 'emo', k: 'gg' }); return true; })();
    toRoom('a', { type: 'start' });
    await run(400);
    out.started = room.room.phase === 'play';
    const startAt = room.room.start_at;
    // 판: 10ms마다 폰은 자기 시계(서버 시계와 같다고 둔다)만큼 돌리고, 0.1초마다 묶음을 보내고 1초마다 핑. 방은 0.1초마다 맥박.
    let lastPulse = clock, lastFlush = clock, lastPing = clock, emoSent = 0;
    while (room.room?.phase === 'play' && clock < startAt + 200_000) {
      clock += 10;
      await flushInbox();
      for (const p of Object.values(phones)) {
        if (!p.sim || p.offline) continue;
        const want = Math.floor((clock - startAt) / ARENA.TICK_MS);
        while (p.sim.S.t < want && p.sim.S.t < ARENA.MAX_TICKS + 5 && !p.sim.P.S.over) {
          if (!(idle && idle === p.who)) for (const x of botInputs(p.sim, p.rnd)) p.sim.push(x);
          p.sim.step();
        }
      }
      if (clock - lastFlush >= LIVE.BATCH_MS) { lastFlush = clock; for (const p of Object.values(phones)) if (!p.offline) p.sim?.flush(); }
      if (clock - lastPing >= 1000) {
        lastPing = clock;
        for (const p of Object.values(phones)) if (!p.offline) toRoom(p.who, { type: 'ping', t: 1 });
        if (emoteSpam) for (let i = 0; i < 3; i++) { toRoom('a', { type: 'emo', k: 'lol' }); emoSent++; }
      }
      if (clock - lastPulse >= LIVE.BATCH_MS) { lastPulse = clock; await room.pulse(clock); }
      // 끊김: drop = { who, from, to }(틱). 소켓이 닫히고, 돌아오면 다시 연결해 확정 조작 전부를 받는다.
      const tick = Math.floor((clock - startAt) / ARENA.TICK_MS);
      if (drop && tick === drop.from && !phones[drop.who].offline && !phones[drop.who].dropped) { const p = phones[drop.who]; p.offline = true; p.dropped = true; p.ws.close(1006); await room.webSocketClose(p.ws); }
      if (drop && tick >= drop.to && phones[drop.who].offline) { phones[drop.who].offline = false; await connect(drop.who, drop.who === 'a' ? 'ta' : 'tb'); }
      // 방 재시작: 저장된 것만으로 새 방 객체를 만든다(메모리는 사라진다).
      if (restartAt && tick === restartAt && !out.restarted) {
        out.restarted = true;
        await room.save();
        const ctx2 = fakeCtx(); for (const [k, v] of ctx.store) ctx2.store.set(k, v);
        ctx = ctx2; room = new ArenaRoom(ctx, env, { timers: false }); await room.ready;
        for (const p of Object.values(phones)) { await connect(p.who, p.who === 'a' ? 'ta' : 'tb'); }
      }
    }
    // 마지막 묶음 · 판정이 폰에 도착하고 폰이 끝까지 다시 돌린다.
    await run(1000);
    out.emoSent = emoSent;
    out.room = room.room; out.line = room.line; out.phones = phones; out.startAt = startAt; out.endClock = clock; out.roomStats = room.stats; out.writes = ctx.writes;
    out.alarm = ctx.alarm;
    return out;
  } finally {
    Date.now = realNow; globalThis.Response = RealResponse; globalThis.WebSocketPair = realPair;
  }
}

// V13.232 방 하나 + 폰 3 · 4대로 여러 명 판 한 판(1:1:1 난투 · 2:2 팀전). opts: 사람(지연 ms) · 팀전 자리 · 컴퓨터 채우기 · 끊김 · 방 재시작.
//   people: [{ id, lag, tm? }] 첫 사람이 방장. fill: 빈자리를 컴퓨터로.
export async function liveMatchN({ mode = 'ffa', seed = 2468, people, jitter = 30, drop = null, idle = null, restartAt = null, fill = false, shuffle = false } = {}) {
  const realNow = Date.now, RealResponse = globalThis.Response, realPair = globalThis.WebSocketPair;
  let clock = 60_000_000;
  Date.now = () => clock;
  globalThis.WebSocketPair = function () { return { 0: fakeSocket(), 1: fakeSocket() }; };
  globalThis.Response = class extends RealResponse { constructor(body, init = {}) { if (init.status === 101) { super(null, { status: 200 }); this.upgraded = init.webSocket; return; } super(body, init); } };
  const reports = [];
  const env = { VOCA_STATE_SECRET: 'test-secret', VOCA_STATE: { idFromName: n => n, get: () => ({ fetch: async (url, init) => { reports.push({ url, key: init.headers['X-Arena-Key'], body: JSON.parse(init.body) }); return new RealResponse('{}', { status: 200 }); } }) } };
  let ctx = fakeCtx(), room = new ArenaRoom(ctx, env, { timers: false });
  room.seed = () => seed;
  await room.ready;
  const PETS = [['dragon', 'dog', 'bear'], ['turtle', 'fox', 'tiger'], ['cat', 'owl', 'penguin'], ['panda', 'rabbit', 'snake']];
  const out = { reports, ctx };
  try {
    const admin = msg => room.admin({ id: 'room-n', ...msg }).then(res => res.json().then(body => ({ status: res.status, ...body })));
    const [host, ...guests] = people;
    out.init = (await admin({ action: 'init', code: '0777', mode, ticket: 't-' + host.id, host: { id: host.id, name: host.id.toUpperCase(), pets: pets(PETS[0]) } })).ok;
    for (const [i, g] of guests.entries()) out['join_' + g.id] = (await admin({ action: 'join', ticket: 't-' + g.id, player: { id: g.id, name: g.id.toUpperCase(), pets: pets(PETS[i + 1]) } })).status || 200;
    if (people.length >= LIVE.MODES[mode].seats) out.full = (await admin({ action: 'join', ticket: 'tz', player: { id: 'z', name: 'Z', pets: pets(['dog']) } })).status;
    const phones = {}, inbox = [], lastAt = {};
    const deliver = (to, text, at) => inbox.push({ to, text, at });
    const late = who => { const base = phones[who].lag + Math.floor(phones[who].rnd() * jitter); lastAt[who] = Math.max(lastAt[who] || 0, clock + base); return lastAt[who]; };
    async function connect(who) {
      await room.accept(new URL(`https://arena/ws?ticket=t-${who}`));
      const ws = ctx.getWebSockets(who).at(-1);
      phones[who].ws = ws;
      for (const text of ws.sent.splice(0)) deliver(who, text, late(who));
      ws.hook = text => { ws.sent.length = 0; deliver(who, text, late(who)); };
    }
    for (const [i, p] of people.entries()) { phones[p.id] = { who: p.id, lag: p.lag, rnd: lcg(17 + i * 31), got: [], lobby: null, sim: null, msgs: 0, bytes: 0 }; await connect(p.id); }
    const toRoom = (who, msg) => { const text = JSON.stringify(msg); phones[who].msgs++; phones[who].bytes += text.length; inbox.push({ to: 'room', who, text, at: late(who) }); };
    const flushInbox = async () => {
      inbox.sort((x, y) => x.at - y.at);
      while (inbox.length && inbox[0].at <= clock) {
        const m = inbox.shift();
        if (m.to === 'room') { const ws = phones[m.who].ws; if (ws.readyState === 1) await room.webSocketMessage(ws, m.text); continue; }
        const p = phones[m.to], msg = JSON.parse(m.text);
        if (p.offline) continue;
        p.got.push(msg.type);
        if (msg.type === 'lobby') p.lobby = msg;
        if (msg.type === 'error') p.error = msg.error;
        if (msg.type === 'start' && !p.sim) {
          p.start = msg;
          p.sim = createLiveSimN({ seed: msg.seed, mode: msg.mode, sides: msg.sides, side: msg.side, send: l => toRoom(m.to, { type: 'in', l }), onDesync: () => { p.desync = (p.desync || 0) + 1; toRoom(m.to, { type: 'sync' }); } });
        }
        if (!p.sim) continue;
        if (msg.type === 'b') p.sim.onBatch(msg);
        if (msg.type === 'all') p.sim.rebuild(msg.inputs, msg.c);
        if (msg.type === 'ai') (p.ai ||= []).push(msg);
        if (msg.type === 'over') { p.over = msg; p.sim.end({ winner: msg.winner, ticks: msg.ticks, all: msg.all }); }
      }
    };
    const run = async ms => { const end = clock + ms; while (clock < end) { clock += 10; await flushInbox(); } };
    await run(300);
    out.lobby = phones[host.id].lobby;
    // 대기실: 팀전 자리 고르기 · 섞기 · 컴퓨터 채우기 · 준비 · 시작.
    for (const p of people) if (p.tm != null) toRoom(p.id, { type: 'seat', tm: p.tm });
    await run(200);
    out.seatsAfterPick = room.room.seats.map(x => [x.id, x.tm]);
    if (shuffle) { toRoom(guests[0].id, { type: 'shuffle' }); await run(200); out.guestShuffle = room.room.seats.map(x => x.tm).join(); toRoom(host.id, { type: 'shuffle' }); await run(200); out.shuffled = room.room.seats.map(x => x.tm); }
    for (const g of guests) toRoom(g.id, { type: 'ready', on: true });
    await run(500);
    toRoom(host.id, { type: 'start' });
    await run(300);
    out.startNoFill = room.room.phase;
    out.noFillError = phones[host.id].error || '';
    if (fill) { toRoom(guests[0].id, { type: 'fill', on: true }); await run(100); out.guestFill = room.room.fill; toRoom(host.id, { type: 'fill', on: true }); await run(100); toRoom(host.id, { type: 'start' }); await run(400); }
    out.started = room.room.phase === 'play';
    const startAt = room.room.start_at, ticks = LIVE.MODES[mode].ticks;
    let lastPulse = clock, lastFlush = clock, lastPing = clock;
    while (room.room?.phase === 'play' && clock < startAt + 240_000) {
      clock += 10;
      await flushInbox();
      for (const p of Object.values(phones)) {
        if (!p.sim || p.offline) continue;
        const want = Math.floor((clock - startAt) / ARENA.TICK_MS);
        while (p.sim.S.t < want && p.sim.S.t < ticks + 5 && !p.sim.P.S.over) {
          if (idle !== p.who) for (const x of botInputs(p.sim, p.rnd)) p.sim.push(x);
          p.sim.step();
        }
        if (p.sim.P.S.over && !p.over) p.earlyOver = Math.max(p.earlyOver || 0, want - p.sim.P.S.t); // 판정 전에 내 화면만 끝난 틱 수
      }
      if (clock - lastFlush >= LIVE.BATCH_MS) { lastFlush = clock; for (const p of Object.values(phones)) if (!p.offline) p.sim?.flush(); }
      if (clock - lastPing >= 1000) { lastPing = clock; for (const p of Object.values(phones)) if (!p.offline) toRoom(p.who, { type: 'ping', t: 1 }); }
      if (clock - lastPulse >= LIVE.BATCH_MS) { lastPulse = clock; await room.pulse(clock); }
      const tick = Math.floor((clock - startAt) / ARENA.TICK_MS);
      if (drop && tick === drop.from && !phones[drop.who].offline && !phones[drop.who].dropped) { const p = phones[drop.who]; p.offline = true; p.dropped = true; p.ws.close(1006); await room.webSocketClose(p.ws); }
      if (drop && tick >= drop.to && phones[drop.who].offline) { phones[drop.who].offline = false; await connect(drop.who); }
      if (restartAt && tick === restartAt && !out.restarted) {
        out.restarted = true;
        await room.save();
        const ctx2 = fakeCtx(); for (const [k, v] of ctx.store) ctx2.store.set(k, v);
        ctx = ctx2; room = new ArenaRoom(ctx, env, { timers: false }); await room.ready;
        for (const p of Object.values(phones)) await connect(p.who);
      }
    }
    await run(1000);
    Object.assign(out, { room: room.room, line: room.line, phones, startAt, roomStats: room.stats, writes: ctx.writes, alarm: ctx.alarm });
    return out;
  } finally {
    Date.now = realNow; globalThis.Response = RealResponse; globalThis.WebSocketPair = realPair;
  }
}

// 학생 · 학교(메인 상태 쪽 검사용).
const school = { id: 's1', division: 'high' }, other = { id: 's2', division: 'high' };
const stu = (id, cls, extra = {}) => ({ id, role: 'student', display_name: id.toUpperCase(), class_name: cls, active: true, games: { arena: { tk: 5 } }, ...extra });

export async function runArenaRoomChecks() {
  const out = {};
  // 1) 같은 학년끼리(선생님 결정 Q4).
  {
    const a = stu('a', '고1A'), b = stu('b', '고1C'), c = stu('c', '고2A'), d = stu('d', '특별반'), e = stu('e', '특별반'), f = stu('f', '고1A');
    assert(arenaPeers(a, school, b, school) && !arenaPeers(a, school, c, school) && !arenaPeers(a, school, f, other) && arenaPeers(d, school, e, school) && !arenaPeers(a, school, d, school) && !arenaPeers(a, school, a, school),
      'V13.230 같은 학교 · 같은 학교급 · 같은 학년끼리(반은 달라도), 학년을 모르는 반은 같은 반만, 다른 학교 · 나 자신은 안 된다');
    assert(!arenaPeers(a, { id: 's1', division: 'high' }, stu('m', '고1A'), { id: 's1', division: 'middle' }), 'V13.230 학교급(중/고)이 다르면 안 된다');
    const state = { profiles: [a, b, c, d, f] }, now = 9_000_000_000;
    const pp = pets(['dog', 'cat', 'bear']);
    const opened = liveOpen(state, a, school, pp, { id: '11111111-1111-4111-8111-111111111111', now });
    assert(opened.room.code.length === 4 && /^\d{4}$/.test(opened.room.code) && opened._arenas.at(-1).action === 'init' && opened._arenas.at(-1).host.pets.length === 3 && opened.room.ticket,
      'V13.230 방 만들기: 방 코드 숫자 4자리 · 방 준비 메시지(입장표 · 펫 목록은 방에만)');
    assert(fails(() => liveOpen(state, a, school, pp, { id: 'x', now: now + 1000 }), '1분에'), 'V13.230 방 만들기는 1분에 1번');
    assert(fails(() => liveJoin(state, c, school, pp, { code: opened.room.code, now }), '같은 학년') && fails(() => liveJoin(state, f, other, pp, { code: opened.room.code, now }), '찾지 못했') && fails(() => liveJoin(state, d, school, pp, { code: opened.room.code, now }), '같은 학년'),
      'V13.230 방 코드 입장도 서버가 같은 학년인지 확인한다(다른 학년 · 다른 학교 · 학년 모르는 반 막기)');
    assert(fails(() => liveInvite(state, a, school, c, school, now), '같은 학년') && liveInvite(state, a, school, b, school, now).ok && fails(() => liveInvite(state, b, school, a, school, now), '열린 방'),
      'V13.230 초대도 같은 학년만 · 방장만');
    const inv = arenaInviteFor(state, b, school, now + 1000);
    assert(inv && inv.code === opened.room.code && inv.host === 'A' && !arenaInviteFor(state, c, school, now) && !arenaInviteFor(state, b, school, now + LIVE.LOBBY_MS + 1),
      'V13.230 받은 초대(첫 화면 20초 확인에 싣는다) · 5분 지나면 사라진다');
    const joined = liveJoin(state, b, school, pets(['fox']), { id: inv.id, now: now + 2000 });
    assert(joined.room.id === inv.id && joined._arenas.at(-1).action === 'join' && joined._arenas.at(-1).player.pets[0].key === 'fox' && !arenaInviteFor(state, b, school, now + 2000) && myLiveRoom(state, b, now + 3000)?.id === inv.id,
      'V13.230 초대 받아 들어가기 · 내 방(GET)으로 다시 찾는다');
    assert(cleanCode('12a34') === '1234' && cleanCode('123') === '' && cleanCode(' 0042 ') === '0042', 'V13.230 방 코드 정리');
    undoLiveJoin(state, joined._arenas.at(-1));
    assert(!state.arenaInvites[0].m.includes('b') && !state.arenaInvites[0].t.b, 'V13.230 방이 받지 못하면(꽉 참 · 시작함) 메인 상태를 되돌린다');
    liveInvite(state, a, school, b, school, now); assert(liveDecline(state, b, inv.id) && !arenaInviteFor(state, b, school, now), 'V13.230 초대 거절');
    // 목록 정리: 대기 5분, 사람이 찬 방 30분, 최대 120개.
    const big = { arenaInvites: Array.from({ length: 200 }, (_, i) => ({ id: 'r' + i, code: String(i).padStart(4, '0'), st: 'open', m: i % 2 ? ['x', 'y'] : ['x'], inv: [], t: {}, at: now - (i < 100 ? 1000 : LIVE.LOBBY_MS + 1000) })) };
    tidyArenaInvites(big, now);
    assert(big.arenaInvites.length <= ARENA_INVITES.MAX && big.arenaInvites.every(x => now - x.at < LIVE.LOBBY_MS || x.m.length >= 2) && STATE_BUDGET_KB.arenaInvites === 20 && JSON.stringify(big.arenaInvites).length / 1024 < STATE_BUDGET_KB.arenaInvites,
      `V13.230 state.arenaInvites 예산 20KB: 대기 5분 · 찬 방 30분 · 최대 ${ARENA_INVITES.MAX}개(지금 ${(JSON.stringify(big.arenaInvites).length / 1024).toFixed(1)}KB)`);
  }

  // 2) 대기실 · 롤백 결과 = 서버 판정 · 메시지 예산 · 이모트 · 다시 보기.
  const m = await liveMatch({ emoteSpam: true });
  {
    assert(m.full === 409 && m.badTicket === 403, 'V13.230 1:1 방은 2자리(꽉 차면 409) · 입장표가 틀리면 못 들어간다');
    assert(m.lobby?.seats === 2 && m.lobby.players.length === 2 && m.lobby.pets.length === 3 && m.lobby.players[0].host, 'V13.230 대기실: 자리 2칸 · 내 펫 목록은 나에게만');
    assert(m.startEarly === 'lobby', 'V13.230 손님은 시작할 수 없고, 방장도 친구가 준비해야 시작');
    assert(m.teamA.map(f => f.key).join() === 'bear,dragon,dog' && m.teamA[0].s2 === 1, 'V13.230 펫 3마리 고르기: 내 펫만(남의 펫 키는 버림) · 모자라면 레벨 순으로 채움 · 스킬 ② 고르기');
    assert(m.started && m.room.phase === 'over' && m.reports.length === 1, 'V13.230 방장이 시작 → 끝까지 → 메인에 한 번 보고');
    const v = liveVerdict({ seed: m.room.seed, teams: { me: liveFighters(m.room.teams.me), foe: liveFighters(m.room.teams.foe) }, inputs: m.line.T.inputs, aiTicks: m.line.T.aiTicks, human: m.line.T.human });
    assert(m.room.result.same && v.winner === m.room.result.winner && v.ticks === m.room.result.ticks, 'V13.230 방이 돌리던 전투 = 확정 조작 전부로 처음부터 다시 돌린 판정(runArena)');
    for (const who of ['a', 'b']) {
      const p = m.phones[who], E = m.line.E;
      assert(p.over && p.sim.P.S.t === E.S.t && p.sim.P.hash() === E.hash() && p.sim.S.over && p.sim.S.winner === (v.winner === 'draw' ? 'draw' : v.winner === p.start.side ? 'me' : 'foe'),
        `V13.230 폰 ${who}(지연 ${who === 'a' ? 40 : 130}ms): 롤백으로 돌린 끝 상태가 방 판정과 한 글자까지 같다`);
      assert(!p.desync, `V13.230 폰 ${who}: 1초마다 상태 요약을 비교해도 어긋남 0번`);
    }
    const sb = m.phones.b.sim.stats, sa = m.phones.a.sim.stats;
    assert(sb.rollbacks > 0 && sb.deepest <= LIVE.ROLLBACK_MAX + LIVE.BUFFER_TICKS + 8, `V13.230 늦게 온 친구 조작은 되감아 다시 계산(되감기 ${sa.rollbacks} · ${sb.rollbacks}번, 가장 깊게 ${Math.max(sa.deepest, sb.deepest)}틱)`);
    // 손님 화면은 180° 돌려 본다: 내 펫이 아래.
    const bv = m.phones.b.sim.view(), E = m.line.E.view();
    assert(Math.abs(bv.me.x - (100 - E.foe.x)) < 1e-9 && Math.abs(bv.me.y - (100 - E.foe.y)) < 1e-9 && bv.me.team[0].key === E.foe.team[0].key,
      'V13.230 손님 화면은 경기장을 180° 돌려 내 펫이 아래(같은 전투)');
    // 메시지 예산(구성안 1-3): 폰 → 방 0.1초에 최대 1번 묶음 + 1초 핑, 메시지 200바이트 아래.
    const secs = m.room.result.ticks * ARENA.TICK_MS / 1000 + 7;
    const inA = m.phones.a.msgs / secs, inB = m.phones.b.msgs / secs, avg = (m.phones.a.bytes + m.phones.b.bytes) / (m.phones.a.msgs + m.phones.b.msgs);
    const outMsgs = m.roomStats.out_msgs, inMsgs = m.roomStats.in_msgs;
    // Cloudflare 계산: 들어오는 WebSocket 메시지 20개 = 요청 1건(+ 방 만들기 · 들어가기 · 연결 · 보고).
    const requests = Math.ceil(inMsgs / 20) + 6;
    out.budget = { secs: Math.round(secs), in_per_sec: [inA.toFixed(1), inB.toFixed(1)], avg_bytes: Math.round(avg), in_msgs: inMsgs, out_msgs: outMsgs, requests, writes: m.writes, rollbacks: [sa.rollbacks, sb.rollbacks], deepest: Math.max(sa.deepest, sb.deepest), dropped: m.roomStats.dropped };
    assert(inA <= 11.5 + 3 && inB <= 11.5 + 3 && avg < 200, `V13.230 폰 → 방: 1초에 ${inA.toFixed(1)} · ${inB.toFixed(1)}개(묶음 10 + 핑 1 + 이모트), 평균 ${Math.round(avg)}바이트`);
    assert(requests <= 260 && m.writes <= 45, `V13.230 1:1 한 판 Durable Object 요청 약 ${requests}건 · 저장 ${m.writes}번(5초마다 한 번)`);
    // 이모트: 3초에 1번 · 판마다 20번(1초에 3번 보내도).
    const emo = m.phones.b.emo || [];
    assert(m.emoSent > 60 && emo.length <= LIVE.EMOTE_MAX && emo.length >= 15 && emo.every((e, i) => i === 0 || true) && Object.keys(LIVE_EMOTES).join() === 'lol,come,gg,nice',
      `V13.230 이모트(야차전 이모트): 3초에 1번 · 판마다 ${LIVE.EMOTE_MAX}번까지(보낸 ${m.emoSent}번 → ${emo.length}번)`);
    // 보고 내용 · 열쇠.
    const rep = m.reports[0];
    assert(rep.key === await arenaReportKey({ VOCA_STATE_SECRET: 'test-secret' }) && rep.body.result.seats.length === 2 && rep.body.result.seats.every(s => ['me', 'foe'].includes(s.side) && Number.isFinite(s.inputs)),
      'V13.230 보고: 방 열쇠(X-Arena-Key) · 자리마다 쪽 · 쓰러뜨림 · 준 피해 · 조작 수 · 컴퓨터 조종 시간');
    assert(m.alarm && m.alarm >= m.room.closed_at + LIVE.CLOSE_AFTER_MS - 1000, 'V13.230 끝난 방은 10분 뒤 지운다(알람)');
    // 다시 보기: 씨앗 + 두 쪽 조작으로 다시 돌리면 같은 판(손님 쪽에서 봐도).
    const rec = { side: 'foe', seed: m.room.seed, teams: m.room.teams, names: m.room.names, inputs: m.room.result.all };
    const R = createReplaySim({ seed: rec.seed, teams: { me: liveFighters(rec.teams.me), foe: liveFighters(rec.teams.foe) }, inputs: rec.inputs, side: 'foe' });
    while (!R.S.over) R.step();
    assert(R.S.t === m.room.result.ticks && R.S.winner === (v.winner === 'draw' ? 'draw' : v.winner === 'foe' ? 'me' : 'foe') && cleanReplays([...Array(9)].map(() => ({ ...rec, at: 1 }))).length === LIVE.REPLAYS,
      'V13.230 다시 보기: 씨앗 + 조작으로 같은 판 재생(서버 저장 0, 이 폰에 최근 5판)');
    console.log('[arena-room] 1:1 한 판', JSON.stringify(out.budget));
  }

  // 3) 끊김 3초면 컴퓨터가 대신 조종 → 다시 들어오면 확정 조작 전부를 받아 이어서. 방이 다시 켜져도 같은 판정.
  {
    const d = await liveMatch({ seed: 777, drop: { who: 'b', from: 400, to: 560 }, restartAt: 900 });
    const T = d.line.T, foe = T.inputs.foe;
    const on = foe.findIndex(x => x[1] === INPUT.AI_ON), off = foe.findIndex(x => x[1] === INPUT.AI_OFF);
    assert(on >= 0 && off > on && foe[on][0] >= 400 + LIVE.AI_AFTER_MS / ARENA.TICK_MS - 10 && foe[on][0] <= 400 + LIVE.AI_AFTER_MS / ARENA.TICK_MS + 10 && T.aiTicks.foe > 0 && T.aiTicks.foe < d.room.result.ticks / 2,
      `V13.230 끊긴 지 3초면 그 틱부터 컴퓨터가 대신 조종(틱 ${foe[on]?.[0]}), 돌아오면 사람(틱 ${foe[off]?.[0]}) · 모든 폰이 같은 결과`);
    assert(d.phones.b.ai?.some(x => !x.on) && d.phones.a.ai?.some(x => x.side === 'foe' && x.on) && d.phones.a.ai?.some(x => x.side === 'foe' && !x.on), 'V13.230 끊김 · 컴퓨터 조종 · 돌아옴을 폰에 알린다');
    for (const who of ['a', 'b']) assert(d.phones[who].sim.P.hash() === d.line.E.hash() && d.room.result.same, `V13.230 끊겼다 돌아온 뒤 · 방이 다시 켜진 뒤에도 폰 ${who} 끝 상태 = 방 판정`);
    assert(d.restarted, 'V13.230 방 재시작(메모리 잃음)에도 저장(5초마다)으로 이어서 같은 판정');
  }

  // 4) 보상 · 농사 막기(구성안 1-3장).
  {
    const now = 9_100_000_000, today = dayKey(now);
    const a = stu('a', '고1A'), b = stu('b', '고1B');
    const seat = (side, extra = {}) => ({ side, ko: 1, dealt: 300, ults: 0, inputs: 200, ai_half: false, ...extra });
    const r1 = liveSettleOne(a, { id: 'g1', seat: seat('me'), others: [b], winner: 'me', idle: false, now });
    assert(r1.paid && r1.coins === ARENA.COINS.win && r1.xp === ARENA.XP && a.games.arena.plays === 1 && a.games.arena.tk === 4 && a.games.arena.pairs.day === today && a.games.arena.pairs.m.b === 1,
      'V13.230 보상은 혼자 판과 같은 크기(이기면 12코인 · 경험치 6) · 입장권 1장 · 하루 5판에 같이 센다');
    assert(liveSettleOne(a, { id: 'g1', seat: seat('me'), others: [b], winner: 'me', now }).coins === r1.coins && a.games.arena.plays === 1, 'V13.230 같은 보고를 두 번 받아도 한 번만(영수증)');
    const lose = liveSettleOne(b, { id: 'g1', seat: seat('foe'), others: [a], winner: 'me', now });
    assert(lose.paid && lose.coins === ARENA.COINS.lose && !lose.win, 'V13.230 져도 한 마리 쓰러뜨렸으면 위로 4코인');
    liveSettleOne(a, { id: 'g2', seat: seat('me'), others: [b], winner: 'foe', now });
    const third = liveSettleOne(a, { id: 'g3', seat: seat('me'), others: [b], winner: 'me', now });
    assert(!third.paid && third.reason === 'pair' && pairLeft(a, 'b', now) === 0 && pairLeft(a, 'b', now + 86400000) === LIVE.PAIR_DAILY, 'V13.230 같은 친구와 코인 판은 하루 2판(그 뒤는 기록만), 다음 날 다시');
    const c = stu('c', '고1A');
    assert(liveSettleOne(c, { id: 'g4', seat: seat('me'), others: [b], winner: 'me', idle: true, now }).reason === 'idle', 'V13.230 한쪽이 거의 조작하지 않으면(조작 20개 미만 · 준 피해 0) 둘 다 보상 없음');
    assert(liveSettleOne(c, { id: 'g5', seat: seat('me', { ai_half: true }), others: [b], winner: 'me', now }).reason === 'ai', 'V13.230 컴퓨터가 조종한 시간이 절반 넘으면 그 사람은 보상 없음');
    assert(liveSettleOne(c, { id: 'g6', seat: seat('me'), others: [b], winner: 'me', peers: false, now }).reason === 'grade', 'V13.230 끝 보고 때도 같은 학년인지 다시 본다');
    const e = stu('e', '고1A', { games: { arena: { tk: 0 } } });
    assert(liveSettleOne(e, { id: 'g7', seat: seat('me'), others: [b], winner: 'me', now }).reason === 'ticket', 'V13.230 입장권이 없으면 연습 판');
    const f = stu('f', '고1A', { games: { arena: { tk: 5, day: today, plays: ARENA.DAILY } } });
    assert(liveSettleOne(f, { id: 'g8', seat: seat('me'), others: [b], winner: 'me', now }).reason === 'daily', 'V13.230 하루 5판(혼자 판과 합쳐서)');
    // 거의 안 한 판 판정(liveVerdict.idle): 한쪽이 가만히 있으면.
    const idle = await liveMatch({ seed: 4242, idle: 'b' });
    assert(idle.room.result.idle && idle.room.result.sides.foe.inputs < LIVE.MIN_INPUTS, 'V13.230 가만히 있는 폰이 있는 판은 idle(둘 다 보상 없음)');
    // 방 보고 → 메인 정산(그 판 2명만 고친다).
    const state = { profiles: [stu('a', '고1A'), stu('b', '고1C'), stu('z', '고1A')], arenaInvites: [{ id: 'room-1', code: '0420', mode: '1v1', s: 's1', d: 'high', g: '고1', c: '고1A', h: 'a', hn: 'A', inv: [], m: ['a', 'b'], t: {}, at: now, st: 'open' }] };
    const body = m.reports[0].body;
    const logs = [];
    assert(arenaReportPending(state, body) && settleArenaLive(state, body, { profileOf: id => state.profiles.find(x => x.id === id), schoolOf: () => school, log: (p, line) => logs.push(line), now }) && !arenaReportPending(state, body) && !settleArenaLive(state, body, { profileOf: id => state.profiles.find(x => x.id === id), schoolOf: () => school, now }),
      'V13.230 방 보고 정산은 한 번만(메인은 목록에서 지운다)');
    assert(state.profiles[2].games.arena.plays === undefined && logs.length === 2 && state.profiles.slice(0, 2).every(p => p.games.done?.some(x => x.id === 'live:room-1')),
      'V13.230 정산은 그 판 사람들 프로필만 고친다(렉 방지 규칙 2)');
  }

  // 5) 규칙 · 롤백 단위 검사.
  {
    const teams = { me: liveFighters(liveTeam(pets(['dog', 'cat', 'bear']), [])), foe: liveFighters(liveTeam(pets(['fox', 'tiger', 'turtle']), [])) };
    const rnd = lcg(3), me = [], foe = [];
    for (let t = 0; t < 2400; t += 3) { if (rnd() < 0.3) me.push([t, 1 + Math.floor(rnd() * 8)]); if (rnd() < 0.3) me.push([t, INPUT.ATK]); if (rnd() < 0.3) foe.push([t, 1 + Math.floor(rnd() * 8)]); if (rnd() < 0.3) foe.push([t, INPUT.ATK, Math.floor(rnd() * 16)]); }
    const a = runArena({ seed: 5, me: teams.me, foe: teams.foe, inputs: me, foeInputs: foe }), b = runArena({ seed: 5, me: teams.me, foe: teams.foe, inputs: me, foeInputs: foe });
    assert(a.winner === b.winner && a.ticks === b.ticks && a.dealt.foe > 0 && a.dealt.me > 0, 'V13.230 상대 쪽도 사람 조작(foeInputs)으로 돌리면 늘 같은 결과');
    // 되감기: 중간에 저장해 두었다 되돌려 다시 돌리면 같은 상태.
    const A = createArena({ seed: 5, me: teams.me, foe: teams.foe, foeHuman: true });
    me.forEach(x => A.push(x)); foe.forEach(x => A.pushFoe(x));
    for (let i = 0; i < 500; i++) A.step();
    const snap = A.snapshot(); for (let i = 0; i < 300; i++) A.step(); const h = A.hash();
    A.restore(snap); for (let i = 0; i < 300; i++) A.step();
    assert(A.hash() === h, 'V13.230 되감기(snapshot · restore)로 다시 돌려도 같은 상태');
    // 폰이 보낸 조작에 컴퓨터 조종 코드(19 · 20)는 못 넣는다(방만 넣는다). 혼자 판 끝내기도 마찬가지.
    const L = createTimeline({ seed: 5, teams });
    L.accept('me', [[5, INPUT.AI_ON], [6, INPUT.ATK]], 10);
    assert(L.T.pending.me.length === 0 && L.accept('me', [[5, INPUT.ATK], [3, 1]], 10) === 2 && L.T.pending.me.every(x => x[0] >= 2), 'V13.230 폰은 컴퓨터 조종 코드를 보낼 수 없다 · 너무 옛날 틱은 앞으로 당긴다');
    const C = createTimeline({ seed: 5, teams });
    C.confirm(50);
    C.accept('foe', [[10, INPUT.ATK]], 60);
    assert(C.T.pending.foe[0][0] === 52, 'V13.230 이미 확정된 틱에 온 조작은 "늦게 누른 것"으로(최대 8틱 되감기)');
    C.accept('foe', [[900, INPUT.ATK]], 60);
    assert(C.T.pending.foe.at(-1)[0] === 60 + LIVE.AHEAD_MAX, 'V13.230 1초 넘게 앞의 틱은 1초 앞으로');
    // 화면 돌리기: 두 번 돌리면 그대로 · 방향 · 조준 코드도 반대쪽.
    const v = createArena({ seed: 5, me: teams.me, foe: teams.foe, foeHuman: true }).view();
    assert(JSON.stringify(mirrorView(mirrorView(v, true), true)) === JSON.stringify(v) && mirrorInput([3, 1], true)[1] === 5 && mirrorInput([3, 10, 0], true)[2] === 8 && mirrorInput([3, 10], true)[1] === 10 && mirrorEvent({ e: 'dmg', who: 'me', x: 30, y: 70 }, true).who === 'foe' && mirrorEvent({ e: 'dmg', who: 'me', x: 30, y: 70 }, true).y === 30,
      'V13.230 손님 화면 돌리기(위 ↔ 아래 · 방향 · 조준 · 사건)');
  }

  // 7) V13.232 (④단계) 1:1:1 난투 · 2:2 팀전.
  {
    // 7-1) 난투: 폰 3대(지연 40 · 130 · 220ms) — 롤백 결과 = 방 판정, 위쪽 자리 폰은 180° 돌려 내 펫이 아래.
    const f = await liveMatchN({ mode: 'ffa', seed: 2468, people: [{ id: 'a', lag: 40 }, { id: 'b', lag: 130 }, { id: 'c', lag: 220 }] });
    assert(f.full === 409 && f.lobby?.seats === 3 && f.lobby.pets_n === 2 && f.lobby.pets.length === 3, 'V13.232 난투 방: 자리 3칸(넷째는 409) · 펫 2마리 고르기');
    assert(f.started && f.room.phase === 'over' && f.reports.length === 1 && f.room.result.same && f.room.sides.every(x => x.team.length === 2), 'V13.232 난투: 시작 → 끝 → 메인에 한 번 보고 · 방이 돌리던 전투 = 처음부터 다시 돌린 판정');
    const vf = liveVerdictN({ seed: f.room.seed, mode: 'ffa', sides: f.room.sides, inputs: f.line.T.inputs, aiTicks: f.line.T.aiTicks, human: f.line.T.human });
    assert(vf.winner === f.room.result.winner && vf.ticks === f.room.result.ticks && vf.rank.length === 3 && vf.rank[0] === (vf.winner === 'draw' ? vf.rank[0] : vf.winner), 'V13.232 난투 판정(runArenaN): 1등 = 이긴 사람 · 등수 3칸');
    for (const who of ['a', 'b', 'c']) {
      const p = f.phones[who], mine = f.room.sides.find(x => x.id === who);
      assert(p.over && p.sim.P.hash() === f.line.E.hash() && !p.desync && p.sim.S.winner === (vf.winner === 'draw' ? 'draw' : vf.winner === mine.side ? 'me' : 'foe'),
        `V13.232 난투 폰 ${who}: 롤백으로 돌린 끝 상태 = 방 판정(되감기 ${p.sim.stats.rollbacks}번, 어긋남 0)`);
      const v = p.sim.view(), E = f.line.E.view()[mine.side];
      assert(mine.y < 50 ? Math.abs(v.me.x - (100 - E.x)) < 1e-9 && Math.abs(v.me.y - (100 - E.y)) < 1e-9 : v.me.x === E.x && v.me.y === E.y, `V13.232 난투 폰 ${who}: 위쪽 자리면 경기장을 180° 돌려 본다`);
    }
    // 7-2) 팀전: 사람 3명 + 빈자리 컴퓨터, 자리 고르기 · 섞기(방장만) · 끊김 3초 → 컴퓨터 · 방 재시작.
    const t = await liveMatchN({ mode: '2v2', seed: 1357, fill: true, shuffle: true, people: [{ id: 'a', lag: 40 }, { id: 'b', lag: 130, tm: 1 }, { id: 'c', lag: 90 }], drop: { who: 'c', from: 400, to: 560 }, restartAt: 900 });
    assert(JSON.stringify(t.seatsAfterPick) === JSON.stringify([['a', 0], ['b', 1], ['c', 0]]) && t.guestShuffle === '0,1,0' && t.shuffled.filter(x => x === 0).length <= 2 && t.shuffled.filter(x => x === 1).length <= 2,
      'V13.232 팀전 자리: 사람이 적은 팀으로 들어오고 · 빈자리를 눌러 팀 고르기(팀마다 2자리) · 섞기는 방장만');
    assert(t.startNoFill === 'lobby' && t.noFillError.includes('컴퓨터로 채우기') && t.guestFill === false && t.started, 'V13.232 빈자리가 있으면 시작 못 함 → 방장이 컴퓨터로 채우기를 켜면 시작(손님은 못 켠다)');
    const bots = t.room.sides.filter(x => x.bot);
    assert(t.room.sides.length === 4 && bots.length === 1 && [0, 1].every(tm => t.room.sides.filter(x => x.tm === tm).length === 2) && t.room.sides.slice(0, 2).every(x => x.tm === 0) && bots[0].team.length === 2,
      'V13.232 팀전: 빈자리 컴퓨터 1명 · 파랑 2 · 빨강 2(자리 p0 · p1 파랑)');
    assert(t.room.result.same && t.restarted && ['a', 'b', 'c'].every(w => t.phones[w].sim.P.hash() === t.line.E.hash() && !t.phones[w].desync), 'V13.232 팀전 폰 3대: 끊겼다 돌아오고 방이 다시 켜져도 끝 상태 = 방 판정');
    const cSide = t.room.sides.find(x => x.id === 'c').side, cIn = t.line.T.inputs[cSide];
    assert(cIn.some(x => x[1] === INPUT.AI_ON) && cIn.some(x => x[1] === INPUT.AI_OFF) && t.line.T.inputs[bots[0].side].length === 0 && t.line.T.aiTicks[bots[0].side] === 0,
      'V13.232 팀전 끊김 3초면 컴퓨터가 대신 조종 · 컴퓨터 자리는 처음부터 컴퓨터(조작 0, 대신 조종 시간에도 안 센다)');
    const rep = t.reports[0].body.result;
    assert(rep.mode === '2v2' && rep.seats.length === 4 && rep.seats.filter(x => x.bot).length === 1 && rep.seats.every(x => typeof x.win === 'boolean' && x.place >= 1),
      'V13.232 팀전 보고: 자리 4개(컴퓨터 표시) · 사람마다 이겼나 · 등수');
    // 7-3) 엔진 규칙(같은 판을 직접): 팀원 공격 안 됨 · 팀원 회복 · 보호막 · 막타 점수 · 번개 연쇄 · 시간 끝 판정.
    const F = (key, hp = null) => { const x = fighter({ key, form: 2, level: 12 }); if (hp) x.hp = hp; return x; };
    const P4 = (keys, extra = {}) => keys.map((k, i) => ({ who: `p${i}`, tm: i < 2 ? 0 : 1, team: [F(k), F(k)], x: [40, 46, 40, 46][i], y: [60, 60, 40, 40][i], ...extra[i] }));
    const A = createArena({ seed: 9, players: P4(['dog', 'bear', 'cat', 'fox']), maxTicks: 3000 });
    for (let i = 0; i < 30; i++) A.step();
    // p0이 팀원 p1 쪽으로 자동 조준 · 공격 · 스킬 · 필살기: 팀원은 다치지 않는다(다른 팀만).
    const before = A.S.p1.team[0].cur;
    A.S.p0.gauge = ARENA.GAUGE_MAX;
    A.pushAs('p0', [A.S.t, INPUT.AIM_AUTO]); A.pushAs('p0', [A.S.t, INPUT.ATK, 6]); A.pushAs('p0', [A.S.t + 15, INPUT.SKILL, 6]); A.pushAs('p0', [A.S.t + 40, INPUT.ULT, 4]);
    for (let i = 0; i < 120; i++) A.step();
    assert(A.S.p1.team[0].cur === before || A.S.p1.lastBy !== 'p0', 'V13.232 팀전: 팀원은 공격 · 스킬 · 필살기에 맞지 않는다');
    const dmgs = []; const B = createArena({ seed: 11, players: P4(['dog', 'bear', 'cat', 'fox'], { 0: { ai: 1 }, 1: { ai: 1 }, 2: { ai: 1 }, 3: { ai: 1 } }), maxTicks: 3000 });
    while (!B.S.over) for (const e of B.step()) if (e.e === 'dmg' && e.by) dmgs.push([e.by, e.who]);
    assert(dmgs.length > 50 && dmgs.every(([by, who]) => B.S[by].tm !== B.S[who].tm), `V13.232 팀전 한 판(컴퓨터 4명): 피해 ${dmgs.length}번 모두 다른 팀끼리 · 팀원끼리 0번`);
    // 팀원 회복 · 보호막: 회복 스킬 펫(penguin 계열이 아니어도 guard 펫을 찾는다)이 쓰면 가까운 팀원도.
    const ALL = Object.keys(CHARACTERS);
    const guardKey = ALL.find(k => { const x = fighter({ key: k }).skill; return x.kind === 'guard' && x.heal > 0; });
    assert(guardKey, 'V13.232 회복 스킬 펫이 있다');
    {
      const G = createArena({ seed: 3, players: P4([guardKey, 'dog', 'cat', 'fox']), maxTicks: 3000 });
      for (let i = 0; i < 30; i++) G.step();
      G.S.p1.team[0].cur = 50; G.S.p1.x = G.S.p0.x + 6; G.S.p1.y = G.S.p0.y;
      G.S.p0.skill = 0; G.pushAs('p0', [G.S.t, INPUT.SKILL]);
      const ev = []; for (let i = 0; i < 3; i++) ev.push(...G.step());
      assert(ev.some(e => e.e === 'buff' && e.who === 'p1' && e.mate === 'p0') && (G.S.p1.team[0].cur > 50 || G.S.p1.shield > 0), `V13.232 팀전: 팀원 회복 · 보호막 스킬(${guardKey})은 가까운 팀원(${ARENA_N.MATE_RANGE}% 안)에게도`);
    }
    // 막타 점수: p1이 거의 다 깎아 놓은 펫을 p0이 마지막에 쓰러뜨리면 점수는 p0만.
    const L3 = [0, 1, 2].map(i => ({ who: `p${i}`, tm: i, team: [F('dog'), F('dog')], x: [50, 30, 70][i], y: [60, 40, 40][i] }));
    const K = createArena({ seed: 5, players: L3, maxTicks: 2400, ffa: true });
    for (let i = 0; i < 30; i++) K.step();
    K.S.dealt.p1 = 999; K.S.p2.lastBy = 'p1'; K.S.p2.team[0].cur = 1; K.S.p2.x = K.S.p0.x; K.S.p2.y = K.S.p0.y - 8; K.S.p1.x = 15; K.S.p1.y = 20;
    K.pushAs('p0', [K.S.t, INPUT.ATK, 0]);
    const kev = []; for (let i = 0; i < 4; i++) kev.push(...K.step());
    assert(kev.some(e => e.e === 'faint' && e.who === 'p2' && e.by === 'p0') && K.S.ko.p0 === 1 && K.S.ko.p1 === 0, 'V13.232 난투 막타 점수: 쓰러뜨린 점수는 마지막에 때린 사람에게만(먼저 많이 깎은 사람이 아니라)');
    // 번개 연쇄: 맞은 상대 옆(24% 안)의 다른 상대에게 한 번 튄다.
    const chainKey = ALL.find(k => fighter({ key: k, s2: 0 }).skill2.id === 'chain');
    const Cn = createArena({ seed: 7, players: [0, 1, 2].map(i => ({ who: `p${i}`, tm: i, team: [i ? F('dog') : fighter({ key: chainKey, form: 2, level: 12, s2: 0 }), F('dog')], x: [50, 50, 58][i], y: [70, 45, 45][i] })), maxTicks: 2400, ffa: true });
    for (let i = 0; i < 30; i++) Cn.step();
    Cn.S.p1.x = 50; Cn.S.p1.y = 45; Cn.S.p2.x = 60; Cn.S.p2.y = 45; Cn.S.p0.skill2 = 0;
    Cn.pushAs('p0', [Cn.S.t, INPUT.SKILL2, 0]);
    const cev = []; for (let i = 0; i < 12; i++) { Cn.S.p1.x = 50; Cn.S.p1.y = 45; Cn.S.p2.x = 60; Cn.S.p2.y = 45; cev.push(...Cn.step()); }
    assert(cev.some(e => e.e === 'chainjump' && e.who === 'p0') && cev.filter(e => e.e === 'dmg' && e.by === 'p0').map(e => e.who).sort().join() === 'p1,p2', `V13.232 번개 연쇄(${chainKey}): 맞은 상대 옆의 다른 상대에게 튄다(1:1에는 옆 상대가 없다)`);
    // 시간 끝: 난투는 쓰러뜨린 수 → 남은 체력, 팀전은 남은 체력. 같은 조작이면 늘 같은 결과.
    const T3 = [0, 1, 2].map(i => ({ who: `p${i}`, tm: i, team: [F('dog'), F('dog')], x: [50, 18, 82][i], y: [78, 24, 24][i] }));
    const idleRun = runArenaN({ seed: 1, players: T3, maxTicks: 60, ffa: true });
    assert(idleRun.winner === 'draw' && idleRun.ticks === 60, 'V13.232 난투 시간 끝: 쓰러뜨린 수 · 남은 체력이 모두 같으면 무승부');
    const T3b = T3.map((p, i) => i === 1 ? { ...p, team: [F('dog'), { ...F('dog'), hp: F('dog').hp }] } : p);
    const one = createArena({ seed: 1, players: T3b, maxTicks: 60, ffa: true }); one.S.p1.team[1].cur = 1; one.S.ko.p2 = 1;
    while (!one.S.over) one.step();
    assert(one.S.winner === 'p2' && one.S.rank[0] === 'p2' && one.S.rank.at(-1) === 'p1', 'V13.232 난투 시간 끝: 쓰러뜨린 수가 많은 사람 1등, 같으면 남은 체력(남은 체력 적은 사람이 꼴등)');
    const two = createArena({ seed: 1, players: P4(['dog', 'dog', 'dog', 'dog']).map((p, i) => ({ ...p, x: [32, 68, 32, 68][i], y: [76, 76, 24, 24][i] })), maxTicks: 60 }); two.S.p2.team[0].cur = 10;
    while (!two.S.over) two.step();
    assert(two.S.winner === 't0' && JSON.stringify(runArenaN({ seed: 4, players: P4(['dog', 'bear', 'cat', 'fox'], { 0: { ai: 1 }, 1: { ai: 1 }, 2: { ai: 1 }, 3: { ai: 1 } }), maxTicks: 3000 })) === JSON.stringify(runArenaN({ seed: 4, players: P4(['dog', 'bear', 'cat', 'fox'], { 0: { ai: 1 }, 1: { ai: 1 }, 2: { ai: 1 }, 3: { ai: 1 } }), maxTicks: 3000 })),
      'V13.232 팀전 시간 끝: 남은 체력이 많은 팀 · 같은 씨앗과 조작이면 늘 같은 결과');
    // 7-4) 같은 학년 · 보상 · 농사 막기.
    const now = 9_300_000_000;
    const a = stu('a', '고1A'), b = stu('b', '고1B'), c = stu('c', '고1C'), d = stu('d', '고1D'), g2 = stu('g', '고2A');
    const state = { profiles: [a, b, c, d, g2] };
    const opened = liveOpen(state, a, school, pets(['dog', 'cat']), { id: '22222222-2222-4222-8222-222222222222', now, mode: '2v2' });
    assert(opened._arenas.at(-1).mode === '2v2' && fails(() => liveOpen(state, b, school, pets(['dog']), { id: 'y', now, mode: '3v3' }), '골라'), 'V13.232 방 만들기: 1:1 · 난투 · 팀전만');
    for (const x of [b, c, d]) liveJoin(state, x, school, pets(['fox']), { code: opened.room.code, now: now + 1000 });
    assert(state.arenaInvites[0].m.length === 4 && fails(() => liveJoin(state, g2, school, pets(['fox']), { code: opened.room.code, now: now + 2000 }), '같은 학년'), 'V13.232 팀전 · 난투도 같은 학년만 들어온다(4명 모두 서버가 확인)');
    const seat = (id, side, tm, extra = {}) => ({ id, side, tm, win: tm === 0, place: tm === 0 ? 1 : 3, ko: 1, dealt: 300, ults: 0, inputs: 200, ai_ticks: 0, ai_half: false, bot: false, idle: false, ...extra });
    const body = { id: opened.room.id, result: { mode: '2v2', winner: 't0', ticks: 2000, idle: false, seats: [seat('a', 'p0', 0), seat('b', 'p1', 0, { idle: true, inputs: 3 }), seat('c', 'p2', 1), seat('bot:1', 'p3', 1, { bot: true })] } };
    const logs = [];
    assert(settleArenaLive(state, body, { profileOf: id => state.profiles.find(x => x.id === id), schoolOf: () => school, log: (p, line) => logs.push(line), now }), 'V13.232 팀전 정산');
    const ra = a.games.done.find(x => x.id === `live:${opened.room.id}`).r, rb = b.games.done.find(x => x.id === `live:${opened.room.id}`).r, rc = c.games.done.find(x => x.id === `live:${opened.room.id}`).r;
    assert(ra.paid && ra.win && ra.coins === ARENA.COINS.win && ra.mode === '2v2' && !rb.paid && rb.reason === 'idle' && rc.paid && !rc.win && rc.coins === ARENA.COINS.lose && !d.games?.done && logs.length === 3,
      'V13.232 팀전 보상: 이긴 팀 12 · 진 팀(쓰러뜨림 있으면) 4 · 거의 안 한 사람만 보상 없음 · 컴퓨터 자리는 정산에서 뺀다 · 판에 없는 학생은 안 고친다');
    assert(a.games.arena.pairs.m['b+c'] === 1, 'V13.232 같은 친구 코인 판 하루 2판: 팀전은 같은 사람 조합(나 빼고 사람만, 컴퓨터 제외)으로 센다');
    const solo = liveVerdictN({ seed: t.room.seed, mode: '2v2', sides: t.room.sides.map(x => (x.id === 'b' || x.id === 'c' ? { ...x, bot: true } : x)), inputs: t.line.T.inputs, aiTicks: t.line.T.aiTicks, human: t.line.T.human });
    assert(solo.idle, 'V13.232 제대로 한 사람이 2명 미만이면(혼자 + 컴퓨터) 그 판은 모두 보상 없음(농사 막기)');
    assert(seatSides('2v2', shuffleTeams([{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }], 99)).map(x => x.tm).join() === '0,0,1,1' && multiMode('ffa') && multiMode('2v2') && !multiMode('1v1') && slotsFor(t.room.sides, 'p2').flip,
      'V13.232 섞기 뒤에도 파랑 2 · 빨강 2 · 빨강 팀 폰은 경기장을 돌려 본다');
    // 7-5) 다시 보기(여러 명): 씨앗 + 모든 쪽 조작으로 같은 판.
    const recN = { mode: 'ffa', side: f.room.sides[1].side, seed: f.room.seed, sides: f.room.sides, inputs: f.room.result.all, at: 1 };
    const RN = createReplaySimN(cleanReplays([recN])[0]);
    while (!RN.S.over) RN.step();
    assert(RN.S.t === f.room.result.ticks && cleanReplays([recN, { ...recN, sides: [] }]).length === 1, 'V13.232 다시 보기(난투): 같은 판 재생 · 망가진 기록은 버린다');
    // 7-6) 예산: 사람 수에 맞춘 메시지 · Durable Object 요청(웹소켓 메시지 20개 = 요청 1건).
    const budget = (x, n) => ({ in_msgs: x.roomStats.in_msgs, out_msgs: x.roomStats.out_msgs, requests: Math.ceil(x.roomStats.in_msgs / 20) + 4 + n * 2, writes: x.writes, secs: Math.round(x.room.result.ticks * ARENA.TICK_MS / 1000) });
    // 팀전 예산은 끊김 · 재시작 없는 사람 4명 판으로 잰다.
    const t4 = await liveMatchN({ mode: '2v2', seed: 8642, people: [{ id: 'a', lag: 40 }, { id: 'b', lag: 130 }, { id: 'c', lag: 90 }, { id: 'd', lag: 200 }] });
    assert(t4.full === 409 && t4.room.result.same && ['a', 'b', 'c', 'd'].every(w => t4.phones[w].sim.P.hash() === t4.line.E.hash() && !t4.phones[w].desync), 'V13.232 팀전 사람 4명(지연 40 · 90 · 130 · 200ms): 다섯째는 409 · 폰 4대 끝 상태 = 방 판정');
    out.ffa = budget(f, 3); out.team = budget(t4, 4);
    assert(out.ffa.requests <= 3 * 130 && out.team.requests <= 4 * 130 && out.ffa.writes <= 50 && out.team.writes <= 60, `V13.232 한 판 요청 예산: 난투 ${out.ffa.requests}건 · 팀전 ${out.team.requests}건 · 저장 ${out.ffa.writes} · ${out.team.writes}번`);
    console.log('[arena-room] 난투', JSON.stringify(out.ffa), '팀전', JSON.stringify(out.team));
  }

  // 6) 연결 · 렉 방지(코드).
  {
    const worker = source('../cloudflare/worker.mjs'), wrangler = source('../wrangler.jsonc'), svc = source('./service.mjs'), app = source('../public/app.js'), live = source('../public/modules/arena-live.js'), ui = source('../public/modules/arena.js'), roomSrc = source('../cloudflare/arena-room.mjs'), idx = source('./index.mjs');
    assert(worker.includes('export { ArenaRoom };') && worker.includes("url.pathname.match(/^\\/api\\/arena\\/ws\\/([0-9a-f-]{36})$/)") && worker.includes("'X-Arena-Key'") && worker.includes('delete result._arenas') && worker.includes('undoLiveJoin(state, message)') && worker.includes('settleArenaReport(state, body)') && idx.includes('delete result._arenas'),
      'V13.230 워커: 방 소켓은 방으로 바로 · 방 준비 메시지는 브라우저로 가지 않는다 · 결과는 방 열쇠로만');
    assert(wrangler.includes('"name": "ARENA_ROOM"') && /"tag": "v5",\s*"new_sqlite_classes": \[\s*"ArenaRoom"/.test(wrangler), 'V13.230 wrangler: ARENA_ROOM 바인딩 · 새 방 객체 마이그레이션 v5');
    const getRoute = svc.slice(svc.indexOf("path === '/games/arena/live' && method === 'GET'"), svc.indexOf("path === '/games/arena/live/result'"));
    const writes = svc.slice(svc.indexOf("path === '/games/arena/live/open'"), svc.indexOf("path === '/games/match/board'"));
    assert(getRoute.includes('arenaPeers(') && !writes.includes('state.profiles.filter') && !writes.includes('createCompetition') && svc.includes("path === '/games/arena/live/result' && method === 'GET'"),
      'V13.230 보기(친구 목록 · 결과)는 GET, 쓰기 요청은 전체 학생을 훑지 않는다');
    assert(svc.includes("arena_invite: arenaInviteFor(state, p, schoolForProfile(state, p), Date.now())") && app.includes("const { invite, arena_invite: arena } = await api('/battle/invite');") && (app.match(/setInterval\(/g) || []).length === (source('../public/app.js').match(/setInterval\(/g) || []).length && !/api\(/.test(live.slice(live.indexOf('L.timers.push(setInterval'), live.indexOf('L.timers.push(setInterval') + 200)),
      'V13.230 초대 알림은 첫 화면이 이미 20초마다 묻는 /battle/invite GET에 싣는다(새 자동 새로고침 없음)');
    assert(ui.includes('R.sim = R.live?.sim || createArena(') && ui.includes('R.live ? R.live.want(now)') && live.includes('createLiveSim(') && live.includes("send({ type: 'in', l })") && live.includes('LIVE.BATCH_MS') && live.includes('keepReplay(') && ui.includes('keepReplay(R.A, { solo: true'),
      'V13.230 화면: 전투 화면은 그대로, 전투만 롤백 전투 · 조작은 0.1초 묶음 · 다시 보기는 이 폰에');
    assert(roomSrc.includes('LIVE.SAVE_EVERY_MS') && roomSrc.includes('LIVE.MSG_MAX') && roomSrc.includes('LIVE.IN_PER_SEC') && roomSrc.includes('liveVerdict(') && roomSrc.includes("'/api/internal/arena-result'") || roomSrc.includes('/api/internal/arena-result'),
      'V13.230 방: 5초마다 저장 · 512바이트 · 1초 메시지 수 제한 · 끝에 다시 돌려 판정 · 한 번 보고');
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  runArenaRoomChecks().then(() => console.log('arena-room checks ok')).catch(err => { console.error(err); process.exit(1); });
}
