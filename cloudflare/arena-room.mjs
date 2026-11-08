// V13.230 펫 아레나 실시간 1:1 방: 판 하나에 Durable Object 하나(BattleRoom · PartyRoom과 같은 모양). 두 폰이 WebSocket으로 들어온다.
//   규칙은 server/arena-live.mjs(대기실 · 조작 받기 · 확정 묶음 · 끊김), 전투는 public/modules/arena-rules.js(화면과 같은 함수).
// 렉 방지(docs/performance-rules.md 6): 1초에 여러 번 오가는 조작은 이 방에서만 다루고, 메인 상태 객체는 방 만들기 · 들어가기 ·
//   끝 보고에만 쓴다. 쓰기 한도(cloudflare/cf-limits.mjs)를 아끼려고 조작마다 저장하지 않는다: 메모리에 두고 5초마다 한 번
//   (판 하나 ≈ 30번). 방이 꺼지면 마지막 저장(최대 5초 전)부터 이어지고, 폰은 상태 요약이 다르면 처음부터 다시 받는다.
import { LIVE, createLive, joinLive, leaveLive, lobbySet, startLive, acceptInputs, touchLive, flushLive, finishLate, liveSim, liveReport, emoteLive, lobbyView } from '../server/arena-live.mjs';
import { reportRetryMs } from './battle-room.mjs';
import { ARENA } from '../public/modules/arena-rules.js';

const MESSAGE_TYPES = new Set(['sync', 'ping', 'set', 'start', 'leave', 'in', 'emote']);
export const ARENA_SAVE_EVERY_MS = 5000;
const CLOSE_AFTER_MS = 10 * 60000; // 끝난 방은 결과 · 다시 보기를 받을 만큼 남긴다
const PLAY_SLACK_MS = 15000;

export async function arenaReportKey(env) {
  const bytes = new TextEncoder().encode(`${env.VOCA_STATE_SECRET}:arena-live-report`);
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(b => b.toString(16).padStart(2, '0')).join('');
}
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

export class ArenaRoom {
  constructor(ctx, env, { timers = true } = {}) {
    this.ctx = ctx;
    this.env = env;
    this.timers = timers;
    this.random = () => crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296;
    this.dirty = false; this.savedAt = 0;
    this.ready = ctx.blockConcurrencyWhile(async () => { this.room = (await ctx.storage.get('room')) || null; });
  }
  async save() { if (!this.room) return; await this.ctx.storage.put('room', this.room); this.dirty = false; this.savedAt = Date.now(); }
  sim() { const r = this.room; if (!this.A && r?.phase === 'play') this.A = liveSim(r); return this.A; }

  send(ws, message) { try { ws.send(JSON.stringify({ ...message, now: Date.now() })); } catch {} }
  each(fn) { for (const ws of this.ctx.getWebSockets()) { const idx = Number(this.ctx.getTags(ws)[0]?.slice(1)); if (idx === 0 || idx === 1) fn(ws, idx); } }
  pushLobby() { const now = Date.now(); this.each((ws, idx) => this.send(ws, { type: 'lobby', view: lobbyView(this.room, idx, now) })); }
  goMsg(idx) { const r = this.room; return { type: 'go', seed: r.seed, teams: r.teams, start_at: r.start_at, side: idx, names: r.players.map(p => p.name), ids: r.players.map(p => p.id) }; }

  // 판 도중 0.1초마다: 확정 묶음을 두 폰에 보내고, 5초가 지났으면 저장하고, 끝났으면 보고한다.
  startPulse() {
    if (!this.timers || this.pulseTimer || this.room?.phase !== 'play') return;
    this.pulseTimer = setInterval(() => { this.pulse().catch(error => console.error('[arena-pulse]', error?.message)); }, LIVE.PULSE_MS);
  }
  stopPulse() { clearInterval(this.pulseTimer); this.pulseTimer = null; }
  async pulse(now = Date.now()) {
    const r = this.room;
    if (!r || r.phase !== 'play') return this.stopPulse();
    const batch = flushLive(r, this.sim(), now);
    if (batch) { this.dirty = true; this.each(ws => this.send(ws, { type: 'b', ...batch })); }
    // 컴퓨터가 대신 조종을 시작 · 끝냈으면(끊김 · 다시 들어옴) 두 폰에 알린다.
    const ai = r.ai.join();
    if (ai !== (this.aiSent ?? 'false,false')) { this.aiSent = ai; this.each(ws => this.send(ws, { type: 'net', ai: r.ai })); }
    if (r.phase === 'ended') { this.stopPulse(); await this.afterEnd(); return; }
    if (this.dirty && now - this.savedAt >= ARENA_SAVE_EVERY_MS) await this.save();
  }

  // 알람(쓰기 한도에 들어간다): 대기실 마감 · 판 끝 안전장치 · 보고 재시도 · 방 지우기만.
  async schedule() {
    const r = this.room;
    if (!r) return;
    const times = [];
    if (r.phase === 'lobby') times.push(r.created_at + LIVE.LOBBY_MS);
    if (r.phase === 'play') times.push(r.start_at + (ARENA.MAX_TICKS + LIVE.DELAY + 2) * ARENA.TICK_MS + PLAY_SLACK_MS);
    if ((r.phase === 'ended' || r.phase === 'closed') && !r.reported) times.push(r.report_retry_at || Date.now() + 5000);
    if ((r.phase === 'ended' || r.phase === 'closed') && r.reported) times.push((r.closed_at || Date.now()) + CLOSE_AFTER_MS);
    const at = Math.max(Date.now() + 10, Math.min(...times));
    if (!times.length || at === this.alarmAt) return;
    this.alarmAt = at;
    await this.ctx.storage.setAlarm(at);
  }

  async fetch(request) {
    await this.ready;
    const url = new URL(request.url);
    if (url.pathname === '/admin' && request.method === 'POST') return this.admin(await request.json());
    if (request.headers.get('Upgrade') === 'websocket') return this.accept(url);
    return new Response('not found', { status: 404 });
  }

  // 메인 상태 객체가 보내는 것: 방 만들기(init) · 친구 들어오기(join) · 닫기(close).
  async admin(msg) {
    const now = Date.now();
    if (msg.action === 'init') {
      if (this.room) return json({ error: '이미 있는 방이에요.' }, 409);
      this.room = createLive({ id: msg.id, code: msg.code, host: msg.host, invite: msg.invite || null, now });
    } else {
      const r = this.room;
      if (!r) return json({ error: '방을 찾지 못했어요.' }, 404);
      if (msg.action === 'join') {
        const res = joinLive(r, msg.player, now);
        if (res.error) return json({ error: res.error }, 409);
      } else if (msg.action === 'close') {
        if (r.phase === 'lobby') { r.phase = 'closed'; r.reason = msg.reason || 'closed'; r.closed_at = now; }
      } else return json({ error: '알 수 없는 요청이에요.' }, 400);
    }
    await this.save();
    this.pushLobby();
    await this.afterChange();
    return json({ ok: true });
  }

  async accept(url) {
    const r = this.room, ticket = url.searchParams.get('ticket') || '';
    const idx = r ? r.players.findIndex(p => p && ticket && p.ticket === ticket) : -1;
    if (!r || idx < 0) return new Response('아레나 방에 들어갈 수 없어요.', { status: 403 });
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    const tag = `p${idx}`;
    // 한 사람에 연결 하나: 새로 연 화면이 예전 것을 바꾼다.
    for (const old of this.ctx.getWebSockets(tag)) old.close(4000, 'replaced');
    this.ctx.acceptWebSocket(server, [tag]);
    const now = Date.now();
    this.send(server, { type: 'lobby', view: lobbyView(r, idx, now) });
    if (r.phase === 'play' || r.phase === 'ended') {
      // 다시 들어옴: 씨앗 + 확정 조작 전체를 주면 폰이 빠르게 다시 계산하고 이어서 조종한다.
      touchLive(r, idx, now);
      this.send(server, this.goMsg(idx));
      this.send(server, { type: 'full', u: r.upto, ia: r.inputs[0], ib: r.inputs[1], ai: r.ai || [false, false] });
    }
    if (r.phase === 'ended') this.send(server, { type: 'end', result: r.result, ...(r.results ? { res: r.results[r.players[idx].id] || null } : {}) });
    if (r.phase === 'play') this.startPulse();
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws, data) {
    await this.ready;
    const r = this.room, idx = Number(this.ctx.getTags(ws)[0]?.slice(1));
    if (!r || !(idx === 0 || idx === 1) || !r.players[idx]) return;
    if (typeof data !== 'string' || data.length > LIVE.MSG_MAX) return;
    let msg; try { msg = JSON.parse(data); } catch { return; }
    if (!msg || typeof msg !== 'object' || Array.isArray(msg) || !MESSAGE_TYPES.has(msg.type)) return;
    const now = Date.now();
    if (msg.type === 'ping') { touchLive(r, idx, now); return this.send(ws, { type: 'pong', c: Number(msg.c) || 0 }); }
    if (msg.type === 'sync') {
      if (r.phase === 'play' || r.phase === 'ended') { touchLive(r, idx, now); this.send(ws, this.goMsg(idx)); return this.send(ws, { type: 'full', u: r.upto, ia: r.inputs[0], ib: r.inputs[1], ai: r.ai || [false, false] }); }
      return this.send(ws, { type: 'lobby', view: lobbyView(r, idx, now) });
    }
    if (msg.type === 'in') { if (acceptInputs(r, idx, msg.s, msg.l, now)) this.dirty = true; this.startPulse(); return; }
    if (msg.type === 'emote') {
      if (!emoteLive(r, idx, msg.i, now)) return;
      return this.each(other => this.send(other, { type: 'emote', side: idx, i: msg.i }));
    }
    if (r.phase !== 'lobby') return;
    if (msg.type === 'set') { if (!lobbySet(r, idx, msg)) return; }
    else if (msg.type === 'leave') {
      const res = leaveLive(r, idx);
      if (res.error) return;
      if (res.closed) r.closed_at = now;
      ws.close(1000, 'left');
      // 친구가 나가면 메인에 알려 다른 친구를 받을 수 있게(방장이 나가면 방이 닫힌다 → 보고).
      if (!res.closed) this.leftGuest = true;
    } else if (msg.type === 'start') {
      const res = startLive(r, idx, now, Math.floor(this.random() * 2147483646) + 1);
      if (res.error) return this.send(ws, { type: 'error', error: res.error });
      this.A = null;
      this.each((sock, i) => this.send(sock, this.goMsg(i)));
      this.startPulse();
    }
    await this.save();
    this.pushLobby();
    await this.afterChange();
  }

  async webSocketClose() { /* 판 도중 끊기면 3초 뒤 컴퓨터가 대신 조종한다(맥박이 본다). 다시 들어오면 이어서 */ }
  async webSocketError() {}

  async alarm() {
    await this.ready;
    const r = this.room;
    if (!r) return;
    const now = Date.now();
    this.alarmAt = null;
    if ((r.phase === 'ended' || r.phase === 'closed') && r.reported && now >= (r.closed_at || 0) + CLOSE_AFTER_MS) {
      for (const ws of this.ctx.getWebSockets()) ws.close(1000, 'done');
      this.stopPulse();
      await this.ctx.storage.deleteAll();
      this.room = null; this.A = null;
      return;
    }
    if (r.phase === 'lobby' && now >= r.created_at + LIVE.LOBBY_MS) { r.phase = 'closed'; r.reason = 'timeout'; r.closed_at = now; this.pushLobby(); }
    // 두 폰이 모두 꺼져 방이 잠들었다: 판 끝 시각이 지났으면 끝까지 돌린다(소식 없는 쪽은 컴퓨터).
    if (r.phase === 'play') { const batch = finishLate(r, this.sim(), now); if (batch) this.each(ws => this.send(ws, { type: 'b', ...batch })); }
    await this.save();
    await this.afterChange();
  }

  async afterEnd() {
    const r = this.room;
    r.closed_at = Date.now();
    await this.save();
    this.each(ws => this.send(ws, { type: 'end', result: r.result }));
    await this.afterChange();
  }

  async afterChange() {
    const r = this.room;
    if (!r) return;
    if ((r.phase === 'ended' || r.phase === 'closed') && !r.reported) {
      const now = Date.now();
      if (r.report_retry_at && now < r.report_retry_at) return this.schedule();
      try {
        const out = await this.report();
        r.reported = true; r.report_retry_at = null; r.results = out?.results || null;
        if (r.results) this.each((ws, idx) => this.send(ws, { type: 'done', res: r.results[r.players[idx].id] || null }));
      } catch (error) {
        r.report_failures = (r.report_failures || 0) + 1;
        r.report_retry_at = Date.now() + reportRetryMs(r.report_failures);
        console.error('[arena-report]', error?.message, { failures: r.report_failures });
      }
      await this.save();
    } else if (this.leftGuest) {
      this.leftGuest = false;
      await this.post({ id: r.id, kind: 'left' }).catch(() => {});
    }
    await this.schedule();
  }

  async post(body) {
    const stub = this.env.VOCA_STATE.get(this.env.VOCA_STATE.idFromName('main'));
    const response = await stub.fetch('https://internal/api/internal/arena-result', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Arena-Key': await arenaReportKey(this.env) },
      body: JSON.stringify(body)
    });
    if (!response.ok) throw Error(`report ${response.status}`);
    return response.json().catch(() => null);
  }
  report() { return this.post(liveReport(this.room)); }
}
