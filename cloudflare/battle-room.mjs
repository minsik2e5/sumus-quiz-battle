// Yacha battle room: one Durable Object per match. Both phones connect over a
// WebSocket; the room runs server/battle-engine.mjs, wakes itself with alarms for word
// timeouts, and reports the result to the main state object when the match ends.
// Uses the hibernation API, so every change is written to storage before replying.
import { createBattle, connect, disconnect, forfeit, answer, tick, nextWake, battleView } from '../server/battle-engine.mjs';

// V13.99: a failed result report is retried with a growing pause (5 s, 10 s, … at most 60 s).
const REPORT_RETRY_MS = 5000, REPORT_RETRY_MAX_MS = 60000;
export const reportRetryMs = failures => Math.min(REPORT_RETRY_MAX_MS, REPORT_RETRY_MS * 2 ** Math.max(0, failures - 1));
// V13.99: what a phone may send; anything else (or anything bigger) is dropped unread.
const MESSAGE_TYPES = new Set(['sync', 'ping', 'emote', 'answer', 'leave']);
const MESSAGE_MAX = 2048;
const CONNECT_MS = 120000;    // after the guest joins, both phones must connect within this
const CLOSE_AFTER_MS = 60000; // keep a finished room around briefly for late reconnects
// Emotes: a fixed set only (no free text), one every 3 seconds, at most 20 per match.
export const EMOTES = ['lol', 'come', 'gg', 'nice'];
const EMOTE_GAP_MS = 3000, EMOTE_MAX = 20;

// Shared by the room and the main object so only rooms can report results.
export async function battleReportKey(env) {
  const bytes = new TextEncoder().encode(`${env.VOCA_STATE_SECRET}:yacha-battle-report`);
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(b => b.toString(16).padStart(2, '0')).join('');
}

export class BattleRoom {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
    this.ready = ctx.blockConcurrencyWhile(async () => { this.room = (await ctx.storage.get('room')) || null; });
  }

  async save() { await this.ctx.storage.put('room', this.room); }

  // Next alarm: the engine's next deadline, a pending report retry, or room expiry.
  async schedule() {
    const r = this.room;
    if (!r) return;
    const times = [];
    if (r.battle) {
      const wake = nextWake(r.battle); if (wake !== null) times.push(wake);
      if (r.battle.phase === 'waiting') times.push(r.connect_deadline);
    }
    else if (!r.closed) times.push(r.expires_at);
    const finished = r.battle?.phase === 'finished';
    if (finished && !r.reported) times.push(r.report_retry_at || Date.now() + REPORT_RETRY_MS);
    // V13.99: the room is deleted only once the result is reported. Before, a report still
    // failing after closed_at + 60 s put the alarm in the past and the room retried every 10 ms.
    if (r.closed || (finished && r.reported)) times.push((r.closed_at || Date.now()) + CLOSE_AFTER_MS);
    if (times.length) await this.ctx.storage.setAlarm(Math.max(Date.now() + 10, Math.min(...times)));
  }

  // Every message carries the room's clock so phones can correct their own for timers.
  send(ws, message) { try { ws.send(JSON.stringify({ ...message, now: Date.now() })); } catch {} }
  broadcast(events, except = null) {
    if (!events.length) return;
    for (const ws of this.ctx.getWebSockets()) if (ws !== except) this.send(ws, { type: 'events', events });
  }

  async fetch(request) {
    await this.ready;
    const url = new URL(request.url);
    if (url.pathname === '/admin' && request.method === 'POST') return this.admin(await request.json());
    if (request.headers.get('Upgrade') === 'websocket') return this.accept(url);
    return new Response('not found', { status: 404 });
  }

  // Messages from the main object: create the room, add the guest, or cancel.
  async admin(msg) {
    const now = Date.now();
    if (msg.action === 'init') {
      this.room = { id: msg.id, stake: msg.stake, label: msg.label || null, mode: msg.mode || 'speed', host: msg.host, guest: null, questions: msg.questions, tickets: msg.tickets, expires_at: msg.expires_at, battle: null, reported: false, closed: false };
    } else if (msg.action === 'join' && this.room && !this.room.closed && !this.room.battle) {
      this.room.guest = msg.guest;
      this.room.tickets = msg.tickets;
      // V13.94: `own` when the two players study different ranges (each gets their own words).
      const own = msg.own && msg.own[this.room.host.id]?.length && msg.own[msg.guest.id]?.length ? msg.own : null;
      this.room.battle = createBattle({ id: this.room.id, players: [this.room.host, msg.guest], questions: own ? own[this.room.host.id] : this.room.questions, own, stake: this.room.stake, label: this.room.label, mode: this.room.mode, now });
      this.room.connect_deadline = now + CONNECT_MS;
      // The host may already be waiting on a socket.
      for (const ws of this.ctx.getWebSockets(this.room.host.id)) {
        connect(this.room.battle, this.room.host.id, now);
        this.send(ws, { type: 'view', view: battleView(this.room.battle, this.room.host.id) });
      }
    } else if (msg.action === 'cancel' && this.room && !this.room.battle) {
      this.room.closed = true; this.room.closed_at = now; this.room.reported = true;
      for (const ws of this.ctx.getWebSockets()) { this.send(ws, { type: 'cancelled', reason: msg.reason || null }); ws.close(1000, 'cancelled'); }
    } else {
      return Response.json({ ok: false }, { status: 409 });
    }
    await this.save();
    await this.schedule();
    return Response.json({ ok: true });
  }

  async accept(url) {
    const r = this.room;
    const ticket = url.searchParams.get('ticket') || '';
    const pid = r && Object.keys(r.tickets || {}).find(id => r.tickets[id] === ticket);
    if (!r || !pid || r.closed) return new Response('대결 방에 들어갈 수 없어요.', { status: 403 });
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    // One socket per player: a new tab or reconnect replaces the old one.
    for (const old of this.ctx.getWebSockets(pid)) old.close(4000, 'replaced');
    this.ctx.acceptWebSocket(server, [pid]);
    if (r.battle) {
      // V13.99: timers first (word deadlines, the end of the match, a grace period that ran out),
      // so coming back after RECONNECT_MS is still a disconnect loss.
      const now = Date.now();
      const events = tick(r.battle, now);
      // A finished match only shows its result to the phone.
      if (r.battle.phase !== 'finished') events.push(...connect(r.battle, pid, now));
      await this.save();
      // The new socket gets the whole view; the other player gets the events.
      this.send(server, { type: 'view', view: battleView(r.battle, pid) });
      this.broadcast(events, server);
      await this.afterChange();
    } else {
      this.send(server, { type: 'lobby', expires_at: r.expires_at, stake: r.stake });
    }
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws, data) {
    await this.ready;
    const r = this.room, pid = this.ctx.getTags(ws)[0];
    if (!r?.battle || !pid) return;
    // V13.99: text only, at most 2 KB, a JSON object of a known type (null or [] used to throw).
    if (typeof data !== 'string' || data.length > MESSAGE_MAX) return;
    let msg; try { msg = JSON.parse(data); } catch { return; }
    if (!msg || typeof msg !== 'object' || Array.isArray(msg) || !MESSAGE_TYPES.has(msg.type)) return;
    const now = Date.now();
    if (msg.type === 'sync') return this.send(ws, { type: 'view', view: battleView(r.battle, pid) });
    if (msg.type === 'ping') return this.send(ws, { type: 'pong' });
    if (msg.type === 'emote') return this.emote(pid, String(msg.emote), now);
    // Timers may have passed while the room slept: apply them before the player's action,
    // so a late answer cannot count and events keep their order.
    const events = tick(r.battle, now);
    // V13.72: pet skills fire by themselves; a 'skill' message from an old screen is ignored.
    // V13.99 `idx`: the word the answer is for (an older app sends none). A bad number never
    // matches the open word, so the answer is ignored.
    if (msg.type === 'answer') events.push(...answer(r.battle, pid, typeof msg.choice === 'string' ? msg.choice.slice(0, 60) : Number(msg.choice), now, msg.idx === undefined ? undefined : Number.isInteger(msg.idx) ? msg.idx : -2));
    else if (msg.type === 'leave') events.push(...forfeit(r.battle, pid, now));
    if (!events.length) return;
    await this.save();
    this.broadcast(events);
    await this.afterChange();
  }

  async emote(pid, emote, now) {
    const r = this.room;
    if (!EMOTES.includes(emote) || !['countdown', 'question', 'reveal'].includes(r.battle.phase)) return;
    r.emotes ||= {};
    const mine = r.emotes[pid] ||= { at: 0, count: 0 };
    if (now - mine.at < EMOTE_GAP_MS || mine.count >= EMOTE_MAX) return;
    Object.assign(mine, { at: now, count: mine.count + 1 });
    await this.save();
    // Not a match event: no sequence number, nothing to replay after a reconnect.
    this.broadcast([{ type: 'emote', player: pid, emote }]);
  }

  async webSocketClose(ws) {
    await this.ready;
    const r = this.room, pid = this.ctx.getTags(ws)[0];
    if (!r?.battle || !pid) return;
    // Ignore a socket that another connection from the same player replaced.
    if (this.ctx.getWebSockets(pid).some(other => other !== ws && other.readyState === 1)) return;
    const events = disconnect(r.battle, pid, Date.now());
    if (!events.length) return;
    await this.save();
    this.broadcast(events);
    await this.schedule();
  }
  async webSocketError(ws) { return this.webSocketClose(ws); }

  async alarm() {
    await this.ready;
    const r = this.room;
    if (!r) return;
    const now = Date.now();
    if (!r.battle && !r.closed && now >= r.expires_at) {
      r.closed = true; r.closed_at = now; r.reported = true;
      for (const ws of this.ctx.getWebSockets()) { this.send(ws, { type: 'expired' }); ws.close(1000, 'expired'); }
      await this.save();
      return this.schedule();
    }
    if ((r.closed || r.battle?.phase === 'finished') && r.reported && now >= (r.closed_at || 0) + CLOSE_AFTER_MS) {
      for (const ws of this.ctx.getWebSockets()) ws.close(1000, 'done');
      await this.ctx.storage.deleteAll();
      this.room = null;
      return;
    }
    if (r.battle) {
      // Someone never connected: call the match off without a winner.
      const events = r.battle.phase === 'waiting' && now >= r.connect_deadline
        ? forfeit(r.battle, r.battle.order.find(id => !r.battle.players[id].connected) || r.battle.order[1], now)
        : tick(r.battle, now);
      if (events.length) { await this.save(); this.broadcast(events); }
    }
    await this.afterChange();
  }

  async afterChange() {
    const r = this.room;
    if (r.battle?.phase === 'finished' && !r.reported) {
      const now = Date.now();
      r.closed_at ||= now;
      // V13.99: wait for the retry time (an alarm or message can come earlier).
      if (r.report_retry_at && now < r.report_retry_at) return this.schedule();
      try {
        await this.report();
        r.reported = true; r.report_retry_at = null;
      } catch (error) {
        r.report_failures = (r.report_failures || 0) + 1;
        r.report_retry_at = Date.now() + reportRetryMs(r.report_failures);
        console.error('[battle-report]', error?.message, { failures: r.report_failures });
      }
      await this.save();
    }
    await this.schedule();
  }

  async report() {
    const stub = this.env.VOCA_STATE.get(this.env.VOCA_STATE.idFromName('main'));
    const response = await stub.fetch('https://internal/api/internal/battle-result', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Battle-Key': await battleReportKey(this.env) },
      body: JSON.stringify({ id: this.room.id, ...this.room.battle.result })
    });
    if (!response.ok) throw Error(`report ${response.status}`);
  }
}
