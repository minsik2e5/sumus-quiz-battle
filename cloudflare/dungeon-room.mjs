// V13.128 던전 방: 파티 하나에 Durable Object 하나(docs/dungeon-design.md 9번). 파티원 폰이 WebSocket으로
// 들어오고, 방이 server/dungeon-engine.mjs를 돌린다. 문제 시간 초과 · 휴식 끝 · 끊긴 펫의 자동 공격 · 보스
// 채점과 핵은 알람으로 깨워서 처리한다. 하이버네이션 API를 쓰므로 바뀔 때마다 저장한 뒤에 답한다
// (cloudflare/battle-room.mjs 방식). 결과는 판이 끝날 때(또는 시작하지 못하고 닫힐 때) 메인 상태 객체에
// 한 번 보고한다. 보고가 실패하면 점점 길게 쉬며 다시 보내고, 메인은 report_id로 두 번 처리하지 않는다.
// 빈자리 봇 동료는 battle-bot.js의 '보통' 로보처럼 정해진 확률과 시간으로 방이 대신 답한다.
import { createDungeon, join, ready, leave, answer, letter, settle, tick, nextWake, view, disconnect, reconnect, DUNGEON } from '../server/dungeon-engine.mjs';
import { BOT_LEVELS } from '../public/modules/battle-bot.js';
import { reportRetryMs } from './battle-room.mjs';

const MESSAGE_TYPES = new Set(['sync', 'ping', 'ready', 'answer', 'letter', 'emote']);
const MESSAGE_MAX = 1024;
const CLOSE_AFTER_MS = 60000; // 끝난 방은 늦게 돌아온 폰에 결과를 보여 줄 만큼만 남긴다
// 응원 이모트: 정해진 것만(자유 글 없음), 3초에 하나, 한 판에 40개까지. 기절한 학생도 보낼 수 있다.
export const DUNGEON_EMOTES = ['cheer', 'help', 'nice', 'gg'];
const EMOTE_GAP_MS = 3000, EMOTE_MAX = 40;
// 봇 동료: battle-bot.js '보통' 로보의 정답률과 답하는 시간.
export const DUNGEON_BOT = BOT_LEVELS.normal;

// 던전 방만 결과를 보고할 수 있게 방과 메인이 같은 키를 만든다(야차전 키와는 다르다).
export async function dungeonReportKey(env) {
  const bytes = new TextEncoder().encode(`${env.VOCA_STATE_SECRET}:dungeon-report`);
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(b => b.toString(16).padStart(2, '0')).join('');
}

// 봇의 다음 답: 언제(문제가 열린 뒤 min~max), 맞힐지(정답률). 제한 시간 안에 못 하면 시간 초과로 둔다.
// V13.130 영어 쓰기 문제는 글자를 하나씩 누르는 만큼 오래(×1.8) 걸린다.
export const BOT_SPELL_SLOW = 1.8;
export function planBot(q, random = Math.random, level = DUNGEON_BOT) {
  const delay = (level.min + random() * (level.max - level.min)) * (q.kind === 'spell' ? BOT_SPELL_SLOW : 1);
  const at = q.started_at + delay;
  return { n: q.n, at: at < q.deadline - 150 ? Math.round(at) : null, right: random() < level.accuracy };
}

export class DungeonRoom {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
    this.random = Math.random;
    this.ready = ctx.blockConcurrencyWhile(async () => { this.room = (await ctx.storage.get('room')) || null; });
  }

  async save() { await this.ctx.storage.put('room', this.room); }

  // 다음 알람: 엔진의 다음 시각, 봇의 답, 로비 마감, 보고 재시도, 방 지우기 중 가장 이른 것.
  async schedule() {
    const r = this.room;
    if (!r) return;
    const times = [];
    const s = r.state;
    if (!r.closed && s.phase === 'lobby') times.push(r.lobby_until);
    const wake = nextWake(s); if (wake !== null) times.push(wake);
    for (const plan of Object.values(r.bots || {})) if (plan?.at) times.push(plan.at);
    if (r.ended && !r.reported) times.push(r.report_retry_at || Date.now() + 5000);
    if (r.ended && r.reported) times.push((r.closed_at || Date.now()) + CLOSE_AFTER_MS);
    if (times.length) await this.ctx.storage.setAlarm(Math.max(Date.now() + 10, Math.min(...times)));
  }

  // 모든 메시지에 방 시계를 붙여서 폰이 자기 시계를 맞춘다(제한 시간 막대).
  send(ws, message) { try { ws.send(JSON.stringify({ ...message, now: Date.now() })); } catch {} }
  broadcast(events, except = null) {
    if (!events.length) return;
    for (const ws of this.ctx.getWebSockets()) if (ws !== except) this.send(ws, { type: 'events', events });
  }
  // 이벤트 뒤에는 각자 자기 화면(내 문제 포함)을 받는다. 정답 번호와 남의 문제는 view에 없다.
  pushViews(except = null) {
    const now = Date.now();
    for (const ws of this.ctx.getWebSockets()) if (ws !== except) { const pid = this.ctx.getTags(ws)[0]; if (pid) this.send(ws, { type: 'view', view: view(this.room.state, pid, now) }); }
  }

  async fetch(request) {
    await this.ready;
    const url = new URL(request.url);
    if (url.pathname === '/admin' && request.method === 'POST') return this.admin(await request.json());
    if (request.headers.get('Upgrade') === 'websocket') return this.accept(url);
    return new Response('not found', { status: 404 });
  }

  // 메인 상태 객체가 보내는 것: 방 만들기, 참가, 봇 동료, 나가기, 취소.
  async admin(msg) {
    const now = Date.now(), r = this.room;
    const refuse = (error, status = 409) => Response.json({ ok: false, error }, { status });
    try {
      if (msg.action === 'init') {
        if (r) return refuse('이미 있는 방이에요.');
        const state = createDungeon({ id: msg.id, cut: msg.cut, grade: msg.grade, host: msg.host?.id, seed: Number(msg.seed) >>> 0 || 1, now });
        join(state, msg.host, now);
        // 방장은 아직 연결하지 않았다(폰이 WebSocket으로 들어오면 연결).
        disconnect(state, msg.host.id, now);
        this.room = { id: msg.id, state, tickets: { [msg.host.id]: msg.ticket }, bots: {}, lobby_until: msg.lobby_until || now + 15 * 60000, ended: false, reported: false, closed: false };
      } else if (!r || r.closed || r.ended) {
        if (msg.action === 'leave' || msg.action === 'cancel') return Response.json({ ok: true });
        return refuse('던전 방이 닫혔어요.');
      } else if (msg.action === 'join' || msg.action === 'bot') {
        if (r.state.phase !== 'lobby') return refuse('이미 시작한 던전이에요.');
        const events = join(r.state, msg.player, now);
        if (msg.action === 'join') {
          r.tickets[msg.player.id] = msg.ticket;
          // 아직 폰이 연결되지 않았다.
          if (!this.ctx.getWebSockets(msg.player.id).length) disconnect(r.state, msg.player.id, now);
        }
        this.broadcast(events);
        this.pushViews();
      } else if (msg.action === 'leave') {
        const pid = String(msg.pid || '');
        delete r.tickets[pid];
        for (const ws of this.ctx.getWebSockets(pid)) ws.close(1000, 'left');
        if (r.state.phase === 'lobby' && (pid === r.state.host || !r.state.order.some(id => id !== pid && !r.state.players[id].bot))) {
          // 방장이 나가거나 사람이 아무도 남지 않으면 로비가 닫힌다.
          this.end('closed', 'host-left');
        } else {
          const events = r.state.phase === 'lobby' ? leave(r.state, pid, now) : disconnect(r.state, pid, now);
          this.broadcast(events);
          this.pushViews();
        }
      } else if (msg.action === 'cancel') {
        this.end('closed', 'cancelled');
        r.reported = true; // 메인이 시작한 취소: 다시 보고할 것이 없다
      } else {
        return refuse('알 수 없는 요청이에요.', 400);
      }
    } catch (error) {
      return refuse(String(error?.message || '던전 방에 들어가지 못했어요.').slice(0, 120));
    }
    this.planBots();
    await this.save();
    await this.afterChange();
    return Response.json({ ok: true });
  }

  // 판 없이 닫기(로비 마감 · 방장 나감 · 취소). 폰에 알리고 연결을 끊는다.
  end(kind, reason) {
    const r = this.room;
    r.closed = true; r.ended = true; r.closed_at = Date.now(); r.end_reason = reason;
    for (const ws of this.ctx.getWebSockets()) { this.send(ws, { type: kind, reason }); ws.close(1000, reason); }
  }

  async accept(url) {
    const r = this.room;
    const ticket = url.searchParams.get('ticket') || '';
    const pid = r && Object.keys(r.tickets || {}).find(id => ticket && r.tickets[id] === ticket);
    if (!r || !pid || r.closed) return new Response('던전 방에 들어갈 수 없어요.', { status: 403 });
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    // 학생 한 명에 연결 하나: 새 탭이나 다시 연결이 예전 것을 바꾼다.
    for (const old of this.ctx.getWebSockets(pid)) old.close(4000, 'replaced');
    this.ctx.acceptWebSocket(server, [pid]);
    const now = Date.now();
    // 잠든 사이 지난 시간(시간 초과, 90초 포기)을 먼저 처리한다. 끝난 판이면 결과만 보여 준다.
    const events = tick(r.state, now);
    if (r.state.phase !== 'finished') events.push(...reconnect(r.state, pid, now));
    this.planBots();
    await this.save();
    this.send(server, { type: 'view', view: view(r.state, pid, now) });
    this.broadcast(events, server);
    if (events.length) this.pushViews(server);
    await this.afterChange();
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws, data) {
    await this.ready;
    const r = this.room, pid = this.ctx.getTags(ws)[0];
    if (!r || r.closed || !pid || !r.tickets[pid]) return;
    // 글자만, 1KB까지, 아는 type의 JSON 객체만 받는다(battle-room.mjs와 같다).
    if (typeof data !== 'string' || data.length > MESSAGE_MAX) return;
    let msg; try { msg = JSON.parse(data); } catch { return; }
    if (!msg || typeof msg !== 'object' || Array.isArray(msg) || !MESSAGE_TYPES.has(msg.type)) return;
    const now = Date.now();
    if (msg.type === 'sync') return this.send(ws, { type: 'view', view: view(r.state, pid, now) });
    if (msg.type === 'ping') return this.send(ws, { type: 'pong' });
    if (msg.type === 'emote') return this.emote(pid, String(msg.emote), now);
    // 방이 잠든 사이 지난 시계를 먼저: 늦은 답은 세지 않고 이벤트 순서가 지켜진다.
    const events = tick(r.state, now);
    if (msg.type === 'ready') events.push(...ready(r.state, pid, now, msg.on !== false));
    // 폰은 선택 번호와 문제 번호(n)만 보낸다. 판정은 엔진이 한다.
    else if (msg.type === 'answer') events.push(...answer(r.state, pid, Number.isInteger(msg.choice) ? msg.choice : -1, now, Number.isInteger(msg.n) ? msg.n : -1));
    // V13.130 영어 쓰기: 누른 글자 하나와 문제 번호만. 맞는지는 엔진이 정답 철자와 비교한다.
    else if (msg.type === 'letter') events.push(...letter(r.state, pid, typeof msg.ch === 'string' ? msg.ch.slice(0, 1) : '', now, Number.isInteger(msg.n) ? msg.n : -1));
    if (!events.length) return;
    this.planBots();
    await this.save();
    this.broadcast(events);
    this.pushViews();
    await this.afterChange();
  }

  async emote(pid, emote, now) {
    const r = this.room;
    if (!DUNGEON_EMOTES.includes(emote) || ['finished'].includes(r.state.phase)) return;
    r.emotes ||= {};
    const mine = r.emotes[pid] ||= { at: 0, count: 0 };
    if (now - mine.at < EMOTE_GAP_MS || mine.count >= EMOTE_MAX) return;
    Object.assign(mine, { at: now, count: mine.count + 1 });
    await this.save();
    // 판 이벤트가 아니다(번호 없음, 다시 연결해도 다시 보내지 않는다).
    this.broadcast([{ type: 'emote', pid, emote }]);
  }

  async webSocketClose(ws) {
    await this.ready;
    const r = this.room, pid = this.ctx.getTags(ws)[0];
    if (!r || r.closed || !pid) return;
    // 같은 학생의 다른 연결이 이 연결을 바꾼 것이면 무시한다.
    if (this.ctx.getWebSockets(pid).some(other => other !== ws && other.readyState === 1)) return;
    const events = disconnect(r.state, pid, Date.now());
    if (!events.length) return;
    this.planBots();
    await this.save();
    this.broadcast(events);
    this.pushViews();
    await this.schedule();
  }
  async webSocketError(ws) { return this.webSocketClose(ws); }

  async alarm() {
    await this.ready;
    const r = this.room;
    if (!r) return;
    const now = Date.now();
    // 보고가 끝난 방은 잠시 뒤 지운다.
    if (r.ended && r.reported && now >= (r.closed_at || 0) + CLOSE_AFTER_MS) {
      for (const ws of this.ctx.getWebSockets()) ws.close(1000, 'done');
      await this.ctx.storage.deleteAll();
      this.room = null;
      return;
    }
    if (!r.ended && r.state.phase === 'lobby' && now >= r.lobby_until) {
      this.end('expired', 'lobby-expired');
      await this.save();
      return this.afterChange();
    }
    if (!r.ended) {
      const events = tick(r.state, now);
      events.push(...this.botAnswers(now));
      if (events.length) { this.planBots(); await this.save(); this.broadcast(events); this.pushViews(); }
    }
    await this.afterChange();
  }

  // 봇 동료: 새 문제가 열렸으면 답할 계획을 세운다. 계획은 방에 저장되어 잠들어도 이어진다.
  planBots() {
    const r = this.room, s = r?.state;
    if (!s) return;
    r.bots ||= {};
    for (const id of s.order) {
      const p = s.players[id];
      if (!p.bot) continue;
      if (!p.q || s.phase !== 'fight') { r.bots[id] = null; continue; }
      if (r.bots[id]?.n !== p.q.n) r.bots[id] = planBot(p.q, this.random);
    }
  }
  botAnswers(now) {
    const r = this.room, s = r.state, out = [];
    for (const id of s.order) {
      const plan = r.bots?.[id], p = s.players[id];
      if (!plan?.at || now < plan.at || !p?.q || p.q.n !== plan.n || s.phase !== 'fight') continue;
      plan.at = null;
      // 봇은 문제 종류(고르기 · 쓰기)와 상관없이 계획한 대로 맞히거나 틀린다.
      out.push(...settle(s, id, plan.right, now, p.q.n));
      this.planBots();
    }
    return out;
  }

  // 판이 끝났으면(또는 판 없이 닫혔으면) 결과를 한 번 보고한다.
  async afterChange() {
    const r = this.room;
    if (!r) return;
    if (!r.ended && r.state.phase === 'finished') { r.ended = true; r.closed_at = Date.now(); await this.save(); }
    if (r.ended && !r.reported) {
      const now = Date.now();
      if (r.report_retry_at && now < r.report_retry_at) return this.schedule();
      try {
        await this.report();
        r.reported = true; r.report_retry_at = null;
      } catch (error) {
        r.report_failures = (r.report_failures || 0) + 1;
        r.report_retry_at = Date.now() + reportRetryMs(r.report_failures);
        console.error('[dungeon-report]', error?.message, { failures: r.report_failures });
      }
      await this.save();
    }
    await this.schedule();
  }

  async report() {
    const r = this.room, s = r.state;
    const body = s.phase === 'finished' && s.result
      ? { id: r.id, report_id: s.result.report_id, result: s.result }
      : { id: r.id, report_id: `dungeon:${r.id}:closed`, cancelled: true, reason: r.end_reason || 'closed' };
    const stub = this.env.VOCA_STATE.get(this.env.VOCA_STATE.idFromName('main'));
    const response = await stub.fetch('https://internal/api/internal/dungeon-result', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Dungeon-Key': await dungeonReportKey(this.env) },
      body: JSON.stringify(body)
    });
    if (!response.ok) throw Error(`report ${response.status}`);
  }
}
