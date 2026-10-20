// V13.149 교실 게임 방(보물 사냥 · 반 전체 낚시): 판 하나에 Durable Object 하나. 선생님 TV와 학생 폰(최대 40명)이 WebSocket으로
// 들어오고, 방이 server/party-engine.mjs를 돌린다.
// 쓰기 한도(cloudflare/cf-limits.mjs, 하루 10만 줄)를 아끼려고 답할 때마다 저장하지 않는다: 바뀐 것은 메모리에 두고
// 5초마다 한 번 저장한다(SAVE_EVERY_MS). 판 도중 방이 꺼지면 마지막 저장(최대 5초 전)부터 이어진다. 10분 판 ≈ 120번 저장.
// 화면도 답할 때마다 모두에게 보내지 않는다: 답한 학생(과 훔침을 당한 학생)에게 바로, 나머지 학생과 TV는 0.8초마다 바뀐 것만.
// 끝나면 메인 상태 객체에 결과를 한 번 보고한다(던전과 같다: 실패하면 다시, 메인은 같은 판을 두 번 처리하지 않는다).
import { createParty, joinParty, startParty, endParty, answer, pick, target, alarmAnswer, peek, useItem, tick, tvView, playerView, partyReport, PARTY } from '../server/party-engine.mjs';
import { reportRetryMs } from './battle-room.mjs';

const MESSAGE_TYPES = new Set(['sync', 'ping', 'answer', 'pick', 'target', 'alarm', 'peek', 'item', 'start', 'end']);
const MESSAGE_MAX = 512;
export const PARTY_SAVE_EVERY_MS = 5000;
export const PARTY_PULSE_MS = 800;
const CLOSE_AFTER_MS = 10 * 60000; // 끝난 방은 결과 화면을 볼 만큼 남긴다
const TV = 'tv';

export async function partyReportKey(env) {
  const bytes = new TextEncoder().encode(`${env.VOCA_STATE_SECRET}:party-report`);
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(b => b.toString(16).padStart(2, '0')).join('');
}
const viewKey = v => JSON.stringify({ ...v, now: 0 });

export class PartyRoom {
  constructor(ctx, env, { timers = true } = {}) {
    this.ctx = ctx;
    this.env = env;
    this.random = Math.random;
    this.timers = timers;
    this.sent = new WeakMap();
    this.dirty = false;
    this.savedAt = 0;
    this.ready = ctx.blockConcurrencyWhile(async () => { this.room = (await ctx.storage.get('room')) || null; });
  }

  async save() {
    if (!this.room) return;
    await this.ctx.storage.put('room', this.room);
    this.dirty = false; this.savedAt = Date.now();
  }
  touch() { this.dirty = true; this.startPulse(); }

  // 판 도중 0.8초마다: 바뀐 화면만 보내고, 5초가 지났으면 저장하고, 시간이 다 됐으면 끝낸다.
  startPulse() {
    if (!this.timers || this.pulseTimer || !this.room || this.room.ended) return;
    this.pulseTimer = setInterval(() => { this.pulse().catch(error => console.error('[party-pulse]', error?.message)); }, PARTY_PULSE_MS);
  }
  stopPulse() { clearInterval(this.pulseTimer); this.pulseTimer = null; }
  async pulse(now = Date.now()) {
    const r = this.room;
    if (!r) return this.stopPulse();
    if (!r.ended) {
      const t = tick(r.state, now);
      if (t.events.length) { this.dirty = true; this.notify(t.events); }
    }
    this.pushViews(now);
    if (this.dirty && (now - this.savedAt >= PARTY_SAVE_EVERY_MS || r.state.phase === 'ended')) await this.save();
    if (r.state.phase === 'ended') { this.stopPulse(); await this.afterChange(); }
    else if (!this.ctx.getWebSockets().length) this.stopPulse(); // 아무도 없으면 쉰다(알람이 시간을 지킨다)
  }

  // 알람도 쓰기 한도에 들어간다: 로비 마감 · 판 끝 · 보고 재시도 · 방 지우기만 걸고, 같은 시각이면 다시 걸지 않는다.
  // (표적 고르기 12초 같은 짧은 시간은 판 도중 맥박이 지킨다.)
  async schedule() {
    const r = this.room;
    if (!r) return;
    const s = r.state, times = [];
    if (!r.ended) times.push(s.phase === 'lobby' ? s.created_at + PARTY.LOBBY_MS : s.end_at);
    if (r.ended && !r.reported) times.push(r.report_retry_at || Date.now() + 5000);
    if (r.ended && r.reported) times.push((r.closed_at || Date.now()) + CLOSE_AFTER_MS);
    const at = times.filter(Number.isFinite).length ? Math.max(Date.now() + 10, Math.min(...times.filter(Number.isFinite))) : null;
    if (at === null || at === this.alarmAt) return;
    this.alarmAt = at;
    await this.ctx.storage.setAlarm(at);
  }

  send(ws, message) { try { ws.send(JSON.stringify({ ...message, now: Date.now() })); } catch {} }
  viewOf(tag, now) { return tag === TV ? tvView(this.room.state, now) : playerView(this.room.state, tag, now); }
  sendView(ws, now = Date.now(), force = false) {
    const tag = this.ctx.getTags(ws)[0];
    if (!tag || !this.room) return;
    const v = this.viewOf(tag, now);
    if (!v) return;
    const key = viewKey(v);
    if (!force && this.sent.get(ws) === key) return;
    this.sent.set(ws, key);
    this.send(ws, { type: 'view', view: v });
  }
  pushViews(now = Date.now(), only = null) {
    for (const ws of this.ctx.getWebSockets()) {
      const tag = this.ctx.getTags(ws)[0];
      if (!only || only.has(tag)) this.sendView(ws, now);
    }
  }
  // 소식(훔치기 · 막기 · 대박 · 물고기 떼 …)은 TV와, 그 소식의 두 학생에게 바로 보낸다.
  notify(events, me = null) {
    if (!events.length && !me) return;
    for (const ws of this.ctx.getWebSockets()) {
      const tag = this.ctx.getTags(ws)[0];
      const mine = tag === TV ? events : events.filter(e => e.pid === tag || e.vid === tag || e.kind === 'frenzy' || e.kind === 'event' || e.kind === 'end' || e.kind === 'start');
      const out = me && me.pid === tag ? [...mine, me] : mine;
      if (out.length) this.send(ws, { type: 'events', events: out });
    }
  }

  async fetch(request) {
    await this.ready;
    const url = new URL(request.url);
    if (url.pathname === '/admin' && request.method === 'POST') return this.admin(await request.json());
    if (request.headers.get('Upgrade') === 'websocket') return this.accept(url);
    return new Response('not found', { status: 404 });
  }

  // 메인 상태 객체가 보내는 것: 방 만들기(init), 학생 참가(join), 선생님이 닫기(close).
  async admin(msg) {
    const now = Date.now();
    const fail = (error, status = 409) => new Response(JSON.stringify({ error }), { status, headers: { 'Content-Type': 'application/json' } });
    if (msg.action === 'init') {
      if (this.room) return fail('이미 있는 방이에요.');
      this.room = { id: msg.id, tickets: { [TV]: msg.tv_ticket }, state: createParty({ ...msg.party, id: msg.id, now }), ended: false, reported: false };
    } else {
      const r = this.room;
      if (!r || r.ended) return fail('게임이 끝났거나 없는 방이에요.', 404);
      if (msg.action === 'join') {
        const res = joinParty(r.state, msg.player, now);
        if (res.error) return fail(res.error);
        r.tickets[msg.player.id] = msg.ticket;
      } else if (msg.action === 'close') {
        const res = endParty(r.state, now);
        this.notify(res.events);
      } else return fail('알 수 없는 요청이에요.', 400);
    }
    await this.save();
    this.pushViews(now);
    await this.afterChange();
    return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
  }

  async accept(url) {
    const r = this.room;
    const ticket = url.searchParams.get('ticket') || '';
    const tag = r && Object.keys(r.tickets || {}).find(id => ticket && r.tickets[id] === ticket);
    if (!r || !tag) return new Response('게임 방에 들어갈 수 없어요.', { status: 403 });
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    // 한 사람(또는 TV)에 연결 하나: 새로 연 화면이 예전 것을 바꾼다.
    for (const old of this.ctx.getWebSockets(tag)) old.close(4000, 'replaced');
    this.ctx.acceptWebSocket(server, [tag]);
    const now = Date.now();
    if (!r.ended) { const t = tick(r.state, now); if (t.events.length) { this.dirty = true; this.notify(t.events); } }
    this.sendView(server, now, true);
    if (r.state.phase === 'play') this.startPulse();
    await this.afterChange();
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws, data) {
    await this.ready;
    const r = this.room, tag = this.ctx.getTags(ws)[0];
    if (!r || !tag || !r.tickets[tag]) return;
    if (typeof data !== 'string' || data.length > MESSAGE_MAX) return;
    let msg; try { msg = JSON.parse(data); } catch { return; }
    if (!msg || typeof msg !== 'object' || Array.isArray(msg) || !MESSAGE_TYPES.has(msg.type)) return;
    const now = Date.now(), s = r.state;
    if (msg.type === 'sync') return this.sendView(ws, now, true);
    if (msg.type === 'ping') return this.send(ws, { type: 'pong' });
    if (r.ended) return;
    const t = tick(s, now);
    if (t.events.length) this.notify(t.events);
    let res = null;
    // 선생님 TV: 시작 · 끝내기.
    if (tag === TV) {
      if (msg.type === 'start') res = startParty(s, now);
      else if (msg.type === 'end') res = endParty(s, now);
      if (!res) return;
      if (res.error) return this.send(ws, { type: 'error', error: res.error });
      this.notify(res.events);
      await this.save();
      this.pushViews(now);
      if (s.phase === 'play') this.startPulse();
      return this.afterChange();
    }
    // 학생: 고른 번호만 보낸다. 판정은 엔진이 한다.
    if (msg.type === 'answer') res = answer(s, tag, Number.isInteger(msg.choice) ? msg.choice : -1, now, this.random);
    else if (msg.type === 'pick') res = pick(s, tag, Number.isInteger(msg.i) ? msg.i : 0, now);
    else if (msg.type === 'target') res = target(s, tag, typeof msg.pid === 'string' ? msg.pid.slice(0, 80) : '', now);
    else if (msg.type === 'alarm') res = alarmAnswer(s, tag, Number.isInteger(msg.choice) ? msg.choice : -1, now);
    else if (msg.type === 'peek') res = peek(s, tag, now, this.random);
    else if (msg.type === 'item') res = useItem(s, tag, typeof msg.item === 'string' ? msg.item.slice(0, 20) : '', now);
    if (!res || (!res.events.length && !res.me)) return this.sendView(ws, now, true);
    this.notify(res.events, res.me);
    // 답한 학생과 훔침을 당한 학생은 바로, 나머지는 다음 맥박에.
    const touched = new Set([tag, ...res.events.map(e => e.vid).filter(Boolean)]);
    this.pushViews(now, touched);
    this.touch();
  }

  async webSocketClose() { /* 학생이 나가도 점수는 남는다(다시 들어오면 이어서) */ }
  async webSocketError() {}

  async alarm() {
    await this.ready;
    const r = this.room;
    if (!r) return;
    const now = Date.now();
    if (r.ended && r.reported && now >= (r.closed_at || 0) + CLOSE_AFTER_MS) {
      for (const ws of this.ctx.getWebSockets()) ws.close(1000, 'done');
      this.stopPulse();
      await this.ctx.storage.deleteAll();
      this.room = null;
      return;
    }
    if (!r.ended) {
      const s = r.state;
      // 시작하지 않은 방은 30분 뒤 닫는다.
      if (s.phase === 'lobby' && now >= s.created_at + PARTY.LOBBY_MS) { const res = endParty(s, now); this.notify(res.events); }
      else { const t = tick(s, now); this.notify(t.events); }
      await this.save();
      this.pushViews(now);
    }
    await this.afterChange();
  }

  async afterChange() {
    const r = this.room;
    if (!r) return;
    if (!r.ended && r.state.phase === 'ended') { r.ended = true; r.closed_at = Date.now(); this.stopPulse(); await this.save(); }
    if (r.ended && !r.reported) {
      const now = Date.now();
      if (r.report_retry_at && now < r.report_retry_at) return this.schedule();
      try { await this.report(); r.reported = true; r.report_retry_at = null; }
      catch (error) {
        r.report_failures = (r.report_failures || 0) + 1;
        r.report_retry_at = Date.now() + reportRetryMs(r.report_failures);
        console.error('[party-report]', error?.message, { failures: r.report_failures });
      }
      await this.save();
    }
    await this.schedule();
  }

  async report() {
    const r = this.room;
    const body = { id: r.id, report_id: `party:${r.id}`, result: partyReport(r.state) };
    const stub = this.env.VOCA_STATE.get(this.env.VOCA_STATE.idFromName('main'));
    const response = await stub.fetch('https://internal/api/internal/party-result', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Party-Key': await partyReportKey(this.env) },
      body: JSON.stringify(body)
    });
    if (!response.ok) throw Error(`report ${response.status}`);
  }
}
