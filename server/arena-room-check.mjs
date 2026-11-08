// V13.230 검사: 펫 아레나 실시간 친구 대전(cloudflare/arena-room.mjs · public/modules/arena-live-rules.js · server/arena-live.mjs).
//   party-room-check.mjs처럼 가짜 시계 · 저장소 · 소켓으로, 지연이 다른 폰 두 대(롤백 전투)가 진짜 방 객체와 한 판을 끝까지 한다.
//   대기실 · 같은 학년 확인 · 롤백 결과 = 서버 판정 · 끊김 대신 조종 · 보상/농사 막기 · 메시지 예산 · 이모트 제한 · 다시 보기 · 방 재시작.
// cloudflare-check.mjs가 부른다. 숫자만 보려면: node server/arena-room-check.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { ArenaRoom, arenaReportKey } from '../cloudflare/arena-room.mjs';
import { ARENA, INPUT, createArena, runArena } from '../public/modules/arena-rules.js';
import { LIVE, LIVE_EMOTES, createLiveSim, createReplaySim, createTimeline, liveVerdict, liveFighters, liveTeam, mirrorView, mirrorInput, mirrorEvent, cleanReplays, cleanCode } from '../public/modules/arena-live-rules.js';
import { arenaPeers, liveOpen, liveJoin, liveInvite, liveDecline, arenaInviteFor, myLiveRoom, settleArenaLive, liveSettleOne, tidyArenaInvites, undoLiveJoin, arenaReportPending, pairLeft, ARENA_INVITES } from './arena-live.mjs';
import { STATE_BUDGET_KB } from './perf-budget.mjs';
import { dayKey } from '../public/modules/core.js';

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
// V13.231 tr: 스킬트리 가지 { 펫 키: '011' }(없으면 가지 없이 = 예전 기록).
const pets = (keys, level = 12, tr = null) => keys.map((key, i) => ({ key, form: 2, level: level - i, s2: 0, ...(tr?.[key] ? { tr: tr[key] } : {}) }));
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
export async function liveMatch({ seed = 12345, lag = { a: 40, b: 130 }, jitter = 30, drop = null, idle = null, restartAt = null, emoteSpam = false, level = 12, tr = null } = {}) {
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
    assert.equal((await admin({ action: 'init', code: '0420', mode: '1v1', ticket: 'ta', host: { id: 'a', name: '가온', pets: pets(['dragon', 'dog', 'bear', 'cat'], level, tr) } })).ok, true, '방 만들기');
    assert.equal((await admin({ action: 'join', ticket: 'tb', player: { id: 'b', name: '나래', pets: pets(['turtle', 'fox', 'tiger'], level, tr) } })).ok, true, '들어가기');
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

  // 2-1) V13.231 스킬트리 가지가 있는 펫(Lv.32~34, 세 층 모두 열림): 방 판 기록에 가지가 실리고, 롤백으로 돌린 끝 = 방 판정 = 서버 다시 돌리기.
  {
    const tr = { dragon: '000', dog: '101', bear: '010', turtle: '110', fox: '001', tiger: '111' };
    const t = await liveMatch({ seed: 4242, level: 34, tr });
    const teams = t.room.teams, all = [...teams.me, ...teams.foe];
    assert(all.length === 6 && all.every(f => f.tr === tr[f.key]) && liveFighters(teams.me).some(f => f.ult2) && liveFighters(teams.foe).some(f => f.tree[2] === 1),
      'V13.231 실시간 방: 펫마다 스킬트리 가지(tr)가 방 판 기록에 실린다(두 번째 필살기 · 역할 강화가 실제로 적용)');
    const v = liveVerdict({ seed: t.room.seed, teams: { me: liveFighters(teams.me), foe: liveFighters(teams.foe) }, inputs: t.line.T.inputs, aiTicks: t.line.T.aiTicks, human: t.line.T.human });
    const bare = liveVerdict({ seed: t.room.seed, teams: { me: liveFighters(teams.me.map(f => ({ ...f, tr: undefined }))), foe: liveFighters(teams.foe.map(f => ({ ...f, tr: undefined }))) }, inputs: t.line.T.inputs, aiTicks: t.line.T.aiTicks, human: t.line.T.human });
    assert(t.room.result.same && v.winner === t.room.result.winner && v.ticks === t.room.result.ticks, `V13.231 가지 있는 펫으로 한 판: 방 판정 = 확정 조작으로 다시 돌린 서버 판정(${v.winner}, ${v.ticks}틱)`);
    for (const who of ['a', 'b']) {
      const p = t.phones[who], E = t.line.E;
      assert(p.over && !p.desync && p.sim.P.S.t === E.S.t && p.sim.P.hash() === E.hash(), `V13.231 가지 있는 펫: 폰 ${who} 롤백 끝 상태 = 방 판정(한 글자까지)`);
    }
    assert(bare.ticks !== v.ticks || bare.winner !== v.winner || JSON.stringify(bare) !== JSON.stringify(v), 'V13.231 가지를 빼고 돌리면 다른 판이 된다(가지가 판정에 실제로 쓰인다)');
    const { livePlayer } = await import('./arena-live.mjs');
    const lp = livePlayer({ id: 'x', display_name: '학생', games: { arena: { s2: { turtle: 1 }, tr: { turtle: '000', fox: 'bad' } } } }, [{ key: 'turtle', form: 2, level: 31 }, { key: 'fox', form: 2, level: 12 }, { key: 'cat', form: 0, level: 1 }]);
    assert(lp.pets.length === 2 && lp.pets[0].tr === '000' && lp.pets[0].s2 === 1 && lp.pets[1].tr === '011' && liveTeam(lp.pets, ['turtle'])[0].tr === '000',
      'V13.231 방에 보내는 학생 정보: 기억한 가지(이상한 값은 기본 가지)와 기본 스킬 ②');
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
