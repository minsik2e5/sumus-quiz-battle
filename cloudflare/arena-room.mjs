// V13.230 펫 아레나 실시간 친구 대전 방(구성안 docs/pet-arena-v2-plan.md 1-3장). 판 하나에 Durable Object 하나.
// 폰은 WebSocket으로 들어온다. 메인 상태 객체는 방 열기 · 들어가기(admin)와 끝 결과(report) 한 번씩만 만난다(렉 방지 규칙 6).
//   대기실: 자리(1:1은 2칸) · 펫 3마리 고르기 · 준비 · 방장이 시작 · 5분이 지나면 닫힘.
//   판: 폰이 보낸 조작에 틱을 확정해(public/modules/arena-live-rules.js createTimeline) 0.1초마다 모두에게 보낸다.
//       방도 확정한 만큼 같은 전투를 돌려 1초마다 상태 요약(해시)을 보낸다(폰과 비교). 끊긴 지 3초면 컴퓨터가 대신 조종.
//   끝: 확정된 모든 조작으로 runArena를 처음부터 다시 돌려(liveVerdict) 승패를 정하고, 메인에 한 번 보고(실패하면 다시).
// 쓰기 한도: 조작마다 저장하지 않는다. 메모리에 두고 5초마다 한 번 저장(2분 판 ≈ 30번). 끝나고 10분 뒤 지운다.
import { LIVE, LIVE_EMOTES, SIDES, liveTeam, liveFighters, createTimeline, liveVerdict } from '../public/modules/arena-live-rules.js';
import { ARENA } from '../public/modules/arena-rules.js';
import { reportRetryMs } from './battle-room.mjs';

const MESSAGE_TYPES = new Set(['sync', 'ping', 'team', 'ready', 'start', 'leave', 'in', 'emo']);
export const ARENA_PULSE_MS = LIVE.BATCH_MS;
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

export async function arenaReportKey(env) {
  const bytes = new TextEncoder().encode(`${env.VOCA_STATE_SECRET}:arena-report`);
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(b => b.toString(16).padStart(2, '0')).join('');
}
const randomSeed = () => { const a = new Uint32Array(1); crypto.getRandomValues(a); return (a[0] % 2147483646) + 1; };

export class ArenaRoom {
  constructor(ctx, env, { timers = true } = {}) {
    this.ctx = ctx;
    this.env = env;
    this.timers = timers;
    this.seed = randomSeed;
    this.dirty = false;
    this.savedAt = 0;
    this.seen = new Map();   // 학생 → 마지막 메시지 시각(메모리만)
    this.rate = new Map();   // 학생 → { sec, n, inN } 메시지 수 제한
    this.stats = { in_msgs: 0, out_msgs: 0, dropped: 0, saves: 0 };
    this.ready = ctx.blockConcurrencyWhile(async () => {
      this.room = (await ctx.storage.get('room')) || null;
      if (this.room?.phase === 'play') this.line = this.restoreLine(this.room);
    });
  }

  /* ---------- 저장 · 알람 ---------- */
  async save() {
    if (!this.room) return;
    const r = this.room;
    if (this.line) r.line = this.line.T;
    await this.ctx.storage.put('room', r);
    this.stats.saves++;
    this.dirty = false; this.savedAt = Date.now();
  }
  // 방이 꺼졌다 켜지면: 확정된 조작으로 전투를 다시 만든다(같은 결과).
  restoreLine(r) {
    const L = createTimeline({ seed: r.seed, teams: { me: liveFighters(r.teams.me), foe: liveFighters(r.teams.foe) } });
    const saved = r.line;
    if (saved) {
      for (const side of SIDES) L.T.pending[side] = [...saved.inputs[side], ...saved.pending[side]];
      L.confirm(saved.confirmed);
      Object.assign(L.T, { last: saved.last, human: saved.human, aiOn: saved.aiOn, aiTicks: saved.aiTicks });
    }
    return L;
  }
  async schedule() {
    const r = this.room;
    if (!r) return;
    const times = [];
    if (r.phase === 'lobby') times.push(r.created_at + LIVE.LOBBY_MS);
    if (r.phase === 'play') times.push(r.start_at + LIVE.MODES[r.mode].ms + 30000); // 판이 멈췄을 때 안전장치
    if (r.phase === 'over' && !r.reported) times.push(r.report_retry_at || Date.now() + 5000);
    if ((r.phase === 'over' && r.reported) || r.phase === 'closed') times.push((r.closed_at || Date.now()) + LIVE.CLOSE_AFTER_MS);
    const at = times.length ? Math.max(Date.now() + 10, Math.min(...times)) : null;
    if (at === null || at === this.alarmAt) return;
    this.alarmAt = at;
    await this.ctx.storage.setAlarm(at);
  }

  /* ---------- 보내기 ---------- */
  send(ws, message) { try { ws.send(JSON.stringify(message)); this.stats.out_msgs++; } catch {} }
  broadcast(message) { const text = JSON.stringify(message); for (const ws of this.ctx.getWebSockets()) { try { ws.send(text); this.stats.out_msgs++; } catch {} } }
  seatOf(id) { return this.room?.seats.find(s => s.id === id) || null; }
  lobbyView(forId) {
    const r = this.room;
    return { type: 'lobby', code: r.code, mode: r.mode, phase: r.phase, closes_at: r.created_at + LIVE.LOBBY_MS, seats: LIVE.MODES[r.mode].seats,
      players: r.seats.map(s => ({ id: s.id, name: s.name, host: s.id === r.host, ready: !!s.ready, team: s.team, online: this.ctx.getWebSockets(s.id).length > 0 })),
      ...(forId && this.seatOf(forId) ? { you: forId, pets: this.seatOf(forId).pets } : {}), now: Date.now() };
  }
  pushLobby() { for (const ws of this.ctx.getWebSockets()) this.send(ws, this.lobbyView(this.ctx.getTags(ws)[0])); }
  startView(id) {
    const r = this.room, s = this.seatOf(id);
    return { type: 'start', seed: r.seed, start_at: r.start_at, side: s?.side || null, teams: r.teams, names: r.names, over: r.phase === 'over', now: Date.now() };
  }
  allView() { const T = this.line.T; return { type: 'all', c: T.confirmed, inputs: T.inputs, now: Date.now() }; }

  /* ---------- 요청 ---------- */
  async fetch(request) {
    await this.ready;
    const url = new URL(request.url);
    if (url.pathname === '/admin' && request.method === 'POST') return this.admin(await request.json());
    if (request.headers.get('Upgrade') === 'websocket') return this.accept(url);
    return new Response('not found', { status: 404 });
  }

  // 메인 상태 객체: 방 만들기(init) · 들어가기(join) · 닫기(close, 방장이 새 방을 만들 때).
  async admin(msg) {
    const now = Date.now();
    if (msg.action === 'init') {
      if (this.room) return json({ error: '이미 있는 방이에요.' }, 409);
      const host = msg.host;
      this.room = { id: msg.id, code: msg.code, mode: LIVE.MODES[msg.mode] ? msg.mode : '1v1', host: host.id, created_at: now, phase: 'lobby',
        tickets: { [host.id]: msg.ticket }, seats: [{ id: host.id, name: host.name, pets: host.pets, team: liveTeam(host.pets, []), ready: false }], emotes: {}, reported: false };
    } else {
      const r = this.room;
      if (!r || r.phase !== 'lobby') return json({ error: r ? '이미 시작한 방이에요.' : '방이 닫혔어요.' }, r ? 409 : 404);
      if (msg.action === 'join') {
        const p = msg.player;
        if (!this.seatOf(p.id)) {
          if (r.seats.length >= LIVE.MODES[r.mode].seats) return json({ error: '방이 꽉 찼어요.' }, 409);
          r.seats.push({ id: p.id, name: p.name, pets: p.pets, team: liveTeam(p.pets, []), ready: false });
        }
        r.tickets[p.id] = msg.ticket;
      } else if (msg.action === 'close') {
        this.close('방장이 방을 닫았어요.');
      } else return json({ error: '알 수 없는 요청이에요.' }, 400);
    }
    await this.save();
    if (this.room.phase === 'lobby') this.pushLobby();
    await this.schedule();
    return json({ ok: true });
  }
  close(why) {
    const r = this.room;
    r.phase = 'closed'; r.closed_at = Date.now();
    this.broadcast({ type: 'closed', why });
  }

  async accept(url) {
    const r = this.room, ticket = url.searchParams.get('ticket') || '';
    const tag = r && Object.keys(r.tickets || {}).find(id => ticket && r.tickets[id] === ticket);
    if (!r || !tag || (r.phase === 'lobby' && !this.seatOf(tag))) return new Response('방에 들어갈 수 없어요.', { status: 403 });
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    for (const old of this.ctx.getWebSockets(tag)) old.close(4000, 'replaced'); // 한 사람에 연결 하나
    this.ctx.acceptWebSocket(server, [tag]);
    this.seen.set(tag, Date.now());
    if (r.phase === 'lobby') this.pushLobby();
    else if (r.phase === 'play') { this.send(server, this.startView(tag)); this.send(server, this.allView()); this.back(tag); this.startPulse(); }
    else if (r.phase === 'over') { this.send(server, this.startView(tag)); this.send(server, this.overView()); }
    else this.send(server, { type: 'closed', why: '방이 닫혔어요.' });
    return new Response(null, { status: 101, webSocket: client });
  }

  // 메시지 수 제한: 1초에 20개(조작 묶음은 12개)까지, 넘으면 읽지 않고 버린다.
  allowed(tag, type, now) {
    const sec = Math.floor(now / 1000), x = this.rate.get(tag) || { sec, n: 0, inN: 0 };
    if (x.sec !== sec) Object.assign(x, { sec, n: 0, inN: 0 });
    x.n++; if (type === 'in') x.inN++;
    this.rate.set(tag, x);
    return x.n <= 20 && (type !== 'in' || x.inN <= LIVE.IN_PER_SEC);
  }

  async webSocketMessage(ws, data) {
    await this.ready;
    const r = this.room, tag = this.ctx.getTags(ws)[0];
    if (!r || !tag || !r.tickets[tag]) return;
    this.stats.in_msgs++;
    if (typeof data !== 'string' || data.length > LIVE.MSG_MAX) { this.stats.dropped++; return; }
    let msg; try { msg = JSON.parse(data); } catch { return; }
    if (!msg || typeof msg !== 'object' || Array.isArray(msg) || !MESSAGE_TYPES.has(msg.type)) return;
    const now = Date.now();
    if (!this.allowed(tag, msg.type, now)) { this.stats.dropped++; return; }
    this.seen.set(tag, now);
    if (msg.type === 'ping') return this.send(ws, { type: 'pong', now, t: Number(msg.t) || 0 });
    if (r.phase === 'lobby') return this.lobbyMessage(ws, tag, msg, now);
    if (r.phase === 'play') {
      this.back(tag);
      if (msg.type === 'sync') { this.send(ws, this.startView(tag)); return this.send(ws, this.allView()); }
      if (msg.type === 'in') {
        const s = this.seatOf(tag);
        if (s && Array.isArray(msg.l)) { this.line.accept(s.side, msg.l, this.roomTick(now)); this.dirty = true; }
        return;
      }
      if (msg.type === 'emo') return this.emote(tag, msg.k, now);
      if (msg.type === 'leave') { this.left(tag); return; }
    }
    if (msg.type === 'sync') { this.send(ws, this.startView(tag)); if (r.phase === 'over') this.send(ws, this.overView()); }
  }

  async lobbyMessage(ws, tag, msg, now) {
    const r = this.room, s = this.seatOf(tag);
    if (!s) return;
    if (msg.type === 'sync') return this.send(ws, this.lobbyView(tag));
    if (msg.type === 'team') {
      if (s.ready) return;
      // 스킬 ② 고르기(s2)는 내 펫에만 덮어쓴다.
      const picks = msg.s2 && typeof msg.s2 === 'object' ? msg.s2 : {};
      const pets = s.pets.map(p => (p.key in picks ? { ...p, s2: picks[p.key] === 1 ? 1 : 0 } : p));
      s.team = liveTeam(pets, Array.isArray(msg.keys) ? msg.keys.slice(0, 6) : []);
    } else if (msg.type === 'ready') s.ready = !!msg.on && s.team.length > 0;
    else if (msg.type === 'emo') return this.emote(tag, msg.k, now);
    else if (msg.type === 'leave') {
      if (tag === r.host) { this.close('방장이 나갔어요.'); await this.save(); await this.schedule(); return; }
      r.seats = r.seats.filter(x => x.id !== tag);
      delete r.tickets[tag];
      for (const w of this.ctx.getWebSockets(tag)) w.close(1000, 'left');
    } else if (msg.type === 'start') {
      if (tag !== r.host) return;
      const err = r.seats.length < LIVE.MODES[r.mode].seats ? '친구가 아직 안 들어왔어요.' : r.seats.some(x => !x.ready && x.id !== r.host) ? '친구가 아직 준비하지 않았어요.' : '';
      if (err) return this.send(ws, { type: 'error', error: err });
      return this.begin(now);
    } else return;
    await this.save();
    this.pushLobby();
  }

  /* ---------- 판 ---------- */
  async begin(now = Date.now()) {
    const r = this.room;
    // 엔진 쪽 이름: 방장 'me'(아래) · 손님 'foe'(위). ④단계는 여기서 자리를 팀으로 나눈다.
    r.seats.forEach((s, i) => { s.side = SIDES[i]; });
    r.phase = 'play'; r.seed = this.seed(); r.start_at = now + LIVE.START_MS; // VS 화면 2.3초 + 3 · 2 · 1 + 여유
    r.teams = Object.fromEntries(r.seats.map(s => [s.side, s.team]));
    r.names = Object.fromEntries(r.seats.map(s => [s.side, s.name]));
    this.line = createTimeline({ seed: r.seed, teams: { me: liveFighters(r.teams.me), foe: liveFighters(r.teams.foe) } });
    for (const s of r.seats) this.seen.set(s.id, now);
    for (const ws of this.ctx.getWebSockets()) this.send(ws, this.startView(this.ctx.getTags(ws)[0]));
    await this.save();
    this.startPulse();
    await this.schedule();
  }
  roomTick(now = Date.now()) { return Math.floor((now - this.room.start_at) / ARENA.TICK_MS); }
  startPulse() {
    if (!this.timers || this.pulseTimer) return;
    this.pulseTimer = setInterval(() => { this.pulse().catch(error => console.error('[arena-pulse]', error?.message)); }, ARENA_PULSE_MS);
  }
  stopPulse() { clearInterval(this.pulseTimer); this.pulseTimer = null; }
  // 0.1초마다: 끊긴 사람은 컴퓨터가 조종 → (지금 틱 − 4)까지 확정 → 확정 묶음(+1초마다 상태 요약) 보내기 → 5초마다 저장 → 끝났으면 판정.
  async pulse(now = Date.now()) {
    const r = this.room;
    if (!r || r.phase !== 'play' || !this.line) return this.stopPulse();
    const tick = this.roomTick(now);
    for (const s of r.seats) {
      // 소켓이 닫혔어도 마지막 메시지에서 3초가 지나야 컴퓨터로(잠깐 끊겼다 바로 붙는 폰은 그대로 사람).
      const gone = now - (this.seen.get(s.id) || 0) >= LIVE.AI_AFTER_MS;
      if (gone && tick >= 0 && this.line.system(s.side, true)) { this.dirty = true; this.broadcast({ type: 'ai', side: s.side, on: true }); }
    }
    const before = this.line.T.confirmed;
    const upTo = Math.min(tick - LIVE.BUFFER_TICKS, ARENA.MAX_TICKS + 10);
    const l = upTo >= 0 ? this.line.confirm(upTo) : [];
    if (upTo > before) {
      const crossed = Math.floor((this.line.T.confirmed + 1) / LIVE.HASH_EVERY) > Math.floor((before + 1) / LIVE.HASH_EVERY);
      this.broadcast({ type: 'b', c: this.line.T.confirmed, l, ...(crossed || this.line.over ? { h: [this.line.tick - 1, this.line.hash()] } : {}) });
      if (l.length) this.dirty = true;
    }
    if (this.line.over) return this.finish(now);
    if (this.dirty && now - this.savedAt >= LIVE.SAVE_EVERY_MS) await this.save();
  }
  // 다시 들어왔으면 사람이 다시 조종.
  back(tag) {
    const s = this.seatOf(tag);
    if (s && this.line && this.line.system(s.side, false)) { this.dirty = true; this.broadcast({ type: 'ai', side: s.side, on: false }); }
  }
  left(tag) {
    const s = this.seatOf(tag);
    for (const w of this.ctx.getWebSockets(tag)) w.close(1000, 'left');
    if (s && this.line?.system(s.side, true)) { this.dirty = true; this.broadcast({ type: 'ai', side: s.side, on: true }); }
  }
  // 이모트: 3초에 1번 · 판마다 20번(야차전 이모트).
  emote(tag, k, now) {
    const r = this.room;
    if (!LIVE_EMOTES[k]) return;
    const e = r.emotes[tag] ||= { at: 0, n: 0 };
    if (now - e.at < LIVE.EMOTE_GAP_MS || e.n >= LIVE.EMOTE_MAX) return;
    e.at = now; e.n++;
    this.broadcast({ type: 'emo', from: tag, side: this.seatOf(tag)?.side || null, k });
  }
  overView() { const r = this.room; return { type: 'over', winner: r.result.winner, ticks: r.result.ticks, sides: r.result.sides, idle: r.result.idle, all: r.result.all, now: Date.now() }; }
  async finish(now = Date.now()) {
    const r = this.room;
    this.stopPulse();
    const T = this.line.T;
    // 확정 조작 전부로 처음부터 다시 돌린 결과가 판정(방이 돌리던 전투와 같아야 한다).
    const v = liveVerdict({ seed: r.seed, teams: { me: liveFighters(r.teams.me), foe: liveFighters(r.teams.foe) }, inputs: T.inputs, aiTicks: T.aiTicks, human: T.human });
    r.result = { ...v, same: v.winner === this.line.E.S.winner && v.ticks === this.line.tick, all: T.inputs };
    if (!r.result.same) console.error('[arena-verdict] mismatch', { id: r.id });
    r.phase = 'over'; r.closed_at = now;
    this.broadcast(this.overView());
    await this.save();
    await this.afterOver();
  }
  async afterOver() {
    const r = this.room;
    if (r.phase === 'over' && !r.reported) {
      const now = Date.now();
      if (!(r.report_retry_at && now < r.report_retry_at)) {
        try { await this.report(); r.reported = true; r.report_retry_at = null; this.broadcast({ type: 'reported' }); }
        catch (error) {
          r.report_failures = (r.report_failures || 0) + 1;
          r.report_retry_at = Date.now() + reportRetryMs(r.report_failures);
          console.error('[arena-report]', error?.message, { failures: r.report_failures });
        }
        await this.save();
      }
    }
    await this.schedule();
  }
  async report() {
    const r = this.room;
    const seats = r.seats.map(s => ({ id: s.id, side: s.side, ...r.result.sides[s.side] }));
    const body = { id: r.id, report_id: `arena:${r.id}`, result: { mode: r.mode, winner: r.result.winner, ticks: r.result.ticks, idle: r.result.idle, seats } };
    const stub = this.env.VOCA_STATE.get(this.env.VOCA_STATE.idFromName('main'));
    const response = await stub.fetch('https://internal/api/internal/arena-result', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Arena-Key': await arenaReportKey(this.env) }, body: JSON.stringify(body)
    });
    if (!response.ok) throw Error(`report ${response.status}`);
  }

  async webSocketClose(ws) {
    // 대기실에서 나가도 자리는 남는다(다시 들어오면 그대로). 판 도중이면 3초 뒤 컴퓨터가 조종(맥박이 본다).
    if (this.room?.phase === 'lobby') this.pushLobby();
  }
  async webSocketError() {}

  async alarm() {
    await this.ready;
    const r = this.room;
    if (!r) return;
    this.alarmAt = null;
    const now = Date.now();
    if ((r.phase === 'closed' || (r.phase === 'over' && r.reported)) && now >= (r.closed_at || 0) + LIVE.CLOSE_AFTER_MS) {
      for (const ws of this.ctx.getWebSockets()) ws.close(1000, 'done');
      this.stopPulse();
      await this.ctx.storage.deleteAll();
      this.room = null; this.line = null;
      return;
    }
    if (r.phase === 'lobby' && now >= r.created_at + LIVE.LOBBY_MS) { this.close('대기 시간 5분이 지나 방이 닫혔어요.'); await this.save(); }
    else if (r.phase === 'play') {
      // 맥박이 멈춰 있었다(방이 다시 켜짐): 남은 판은 지금까지 확정된 조작으로 끝까지 돌린다(끊긴 쪽은 컴퓨터).
      for (const s of r.seats) this.line.system(s.side, true);
      this.line.confirm(ARENA.MAX_TICKS + 10);
      if (this.line.over) return this.finish(now);
      this.startPulse();
    } else if (r.phase === 'over') return this.afterOver();
    await this.schedule();
  }
}
