// V13.99 checks for the yacha battle room (cloudflare/battle-room.mjs) with a stand-in for the
// Durable Object context: a fake clock, storage, alarms and sockets. Run by cloudflare-check.mjs.
import assert from 'node:assert/strict';
import { BattleRoom } from '../cloudflare/battle-room.mjs';
import { BATTLE } from './battle-engine.mjs';

function fakeSocket() {
  return { readyState: 1, tags: [], sent: [], send(text) { this.sent.push(JSON.parse(text)); }, close() { this.readyState = 3; } };
}
function fakeCtx() {
  const store = new Map(), sockets = [];
  const ctx = {
    alarm: null,
    store,
    storage: {
      async get(key) { return store.has(key) ? structuredClone(store.get(key)) : undefined; },
      async put(key, value) { store.set(key, structuredClone(value)); },
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

const questions = Array.from({ length: 6 }, (_, i) => ({ word_id: 'w' + i, prompt: 'word' + i, options: ['a', 'b', 'c', 'd'], answer: i % 4 }));
const host = { id: 'host', name: '호스트', pet: { key: 'dog', form: 1 } }, guest = { id: 'guest', name: '게스트', pet: { key: 'cat', form: 1 } };
const tickets = { host: 't-host', guest: 't-guest' };

export async function runBattleRoomChecks() {
  const realNow = Date.now, RealResponse = globalThis.Response, realPair = globalThis.WebSocketPair;
  let clock = 1_000_000;
  Date.now = () => clock;
  // Node's Response has no 101 and there is no WebSocketPair: stand-ins for accept().
  globalThis.WebSocketPair = function () { return { 0: fakeSocket(), 1: fakeSocket() }; };
  globalThis.Response = class extends RealResponse {
    constructor(body, init = {}) {
      if (init.status === 101) { super(null, { status: 200 }); this.upgraded = init.webSocket; return; }
      super(body, init);
    }
  };
  let reports = 0, reportOk = false;
  const env = {
    VOCA_STATE_SECRET: 'test-secret',
    VOCA_STATE: { idFromName: name => name, get: () => ({ fetch: async () => { reports++; return new RealResponse('{}', { status: reportOk ? 200 : 503 }); } }) }
  };
  // A room with both players joined; `sockets` has the server side of each player's socket.
  async function openRoom() {
    const ctx = fakeCtx(), room = new BattleRoom(ctx, env);
    await room.ready;
    await room.admin({ action: 'init', id: 'r1', stake: 10, host, questions, tickets: { host: tickets.host }, expires_at: clock + 600000 });
    await room.admin({ action: 'join', guest, tickets });
    const sockets = {};
    const join = async pid => {
      await room.accept(new URL(`https://battle/ws?ticket=${tickets[pid]}`));
      sockets[pid] = ctx.getWebSockets(pid).at(-1);
      return sockets[pid];
    };
    await join('host'); await join('guest');
    return { ctx, room, sockets, join };
  }
  const failures = [];
  // Every check runs even when an earlier one fails, so one run shows every problem.
  const check = async (name, fn) => { try { await fn(); } catch (error) { failures.push(`${name}: ${error.message}`); } };
  const message = (room, ws, payload) => room.webSocketMessage(ws, typeof payload === 'string' || payload instanceof ArrayBuffer ? payload : JSON.stringify(payload));

  try {
    /* ---------- 1. a report that keeps failing must not wake the room every 10 ms ---------- */
    await check('1 보고 재시도', async () => {
      reports = 0; reportOk = false;
      const { ctx, room, sockets } = await openRoom();
      await message(room, sockets.host, { type: 'leave' });
      assert.equal(room.room.battle.phase, 'finished');
      assert.equal(room.room.reported, false, '보고가 실패하면 reported는 false로 남아야 합니다.');
      const closedAt = room.room.closed_at;
      // Wake up long after closed_at + 60 s, report still failing.
      clock = closedAt + 70000;
      const gaps = [];
      for (let i = 0; i < 7; i++) {
        await room.alarm();
        gaps.push(ctx.alarm - clock);
        clock = ctx.alarm;
      }
      assert(gaps.every(gap => gap >= 5000), `V13.99 보고 실패 중에는 최소 5초 뒤에 다시 시도해야 합니다 (간격 ${gaps.join(', ')} ms)`);
      assert(gaps.at(-1) === 60000 && gaps.at(-2) === 60000 && gaps[1] > gaps[0], `V13.99 보고 재시도는 지수 백오프, 최대 60초 (간격 ${gaps.join(', ')} ms)`);
      assert(room.room.report_failures >= 7 && ctx.store.get('room').report_failures === room.room.report_failures, 'V13.99 보고 실패 횟수를 방에 저장해야 합니다.');
      assert(ctx.store.has('room'), '보고하기 전에는 방을 지우면 안 됩니다.');
      // An alarm before the retry time does not report again.
      const before = reports;
      clock = ctx.alarm - 1000;
      await room.alarm();
      assert.equal(reports, before, 'V13.99 재시도 시각 전에 깬 알람은 보고를 다시 보내지 않아야 합니다.');
      // The report goes through: the room is deleted CLOSE_AFTER_MS after closing.
      reportOk = true;
      clock = ctx.alarm;
      await room.alarm();
      assert.equal(room.room.reported, true);
      assert(ctx.alarm > clock, '보고가 끝나면 방 삭제 알람을 예약해야 합니다.');
      clock = Math.max(clock, ctx.alarm);
      await room.alarm();
      assert.equal(room.room, null, '보고가 끝난 방은 지워져야 합니다.');
      assert.equal(ctx.store.size, 0);
    });

    /* ---------- 4. coming back after the grace period is still a disconnect loss ---------- */
    await check('4 재접속', async () => {
      reportOk = true;
      const { ctx, room, sockets, join } = await openRoom();
      clock += BATTLE.COUNTDOWN_MS; await room.alarm(); // first word opens
      assert.equal(room.room.battle.phase, 'question');
      sockets.guest.close();
      await room.webSocketClose(sockets.guest);
      // The alarm is late (or the room reconnects first): the guest comes back after the grace.
      clock += BATTLE.RECONNECT_MS + 3000;
      const back = await join('guest');
      const b = room.room.battle;
      assert(b.phase === 'finished' && b.result.reason === 'disconnect' && b.result.loser === 'guest', `V13.99 유예시간이 지난 뒤 다시 들어와도 연결 끊김 패배여야 합니다 (${b.phase} ${b.result?.reason})`);
      assert(back.sent.some(m => m.type === 'view' && m.view.phase === 'finished' && m.view.result?.loser === 'guest'), 'V13.99 이미 끝난 경기면 결과 화면을 보내야 합니다.');
      assert(!b.players.guest.connected, 'V13.99 끝난 경기에는 다시 연결 처리하지 않아야 합니다.');
      assert(sockets.host.sent.some(m => m.type === 'events' && m.events.some(e => e.type === 'end')), '상대에게도 경기 종료를 알려야 합니다.');
      assert(room.room.reported, '끝난 경기는 바로 보고해야 합니다.');
      // Within the grace period a reconnect still works.
      const second = await openRoom();
      clock += BATTLE.COUNTDOWN_MS; await second.room.alarm();
      second.sockets.guest.close(); await second.room.webSocketClose(second.sockets.guest);
      clock += BATTLE.RECONNECT_MS - 2000;
      await second.join('guest');
      assert(second.room.room.battle.phase !== 'finished' && second.room.room.battle.players.guest.connected, '유예시간 안에 돌아오면 경기가 이어져야 합니다.');
      void ctx;
    });

    /* ---------- 3. the answer of the previous word must not hit the next word ---------- */
    await check('3 문제 번호', async () => {
      const { room, sockets } = await openRoom();
      clock += BATTLE.COUNTDOWN_MS; await room.alarm();
      const b = () => room.room.battle;
      const q0 = b().idx;
      assert(sockets.host.sent.some(m => m.type === 'events' && m.events.some(e => e.type === 'question' && e.idx === q0)), 'V13.99 question 이벤트에 문제 번호(idx)가 있어야 합니다.');
      // The word times out and the next one opens; then the host's tap on the old word arrives.
      clock += BATTLE.TURN_MS; await room.alarm();
      clock += BATTLE.REVEAL_MS; await room.alarm();
      clock += 200;
      const right = b().questions[(q0 + 1) % questions.length].answer;
      await message(room, sockets.host, { type: 'answer', choice: right, idx: q0 });
      assert(b().idx === q0 + 1 && !b().turn.locked.host && b().players.host.correct === 0, 'V13.99 지난 문제 번호로 보낸 답은 다음 문제에 채점하지 않아야 합니다.');
      await message(room, sockets.host, { type: 'answer', choice: right, idx: b().idx });
      await message(room, sockets.guest, { type: 'answer', choice: right }); // older app: no number
      assert(b().players.host.correct === 1 && b().players.guest.correct === 1, 'V13.99 현재 문제 번호의 답과 번호 없는 예전 앱의 답은 채점해야 합니다.');
    });

    /* ---------- 6. malformed messages are ignored ---------- */
    await check('6 메시지 검사', async () => {
      const { room, sockets } = await openRoom();
      clock += BATTLE.COUNTDOWN_MS; await room.alarm();
      const seq = room.room.battle.seq, sent = sockets.host.sent.length;
      for (const bad of ['null', '[]', '"answer"', '7', 'true', '{"type":"hack"}', '{"type":["answer"]}', JSON.stringify({ type: 'answer', choice: 0, pad: 'x'.repeat(3000) }), new ArrayBuffer(16)]) {
        await assert.doesNotReject(message(room, sockets.host, bad), `V13.99 잘못된 메시지에서 오류가 나면 안 됩니다: ${String(bad).slice(0, 30)}`);
      }
      assert(room.room.battle.seq === seq && sockets.host.sent.length === sent && !room.room.battle.turn.locked.host, 'V13.99 객체가 아니거나, 허용되지 않은 type이거나, 2KB가 넘는 메시지는 무시해야 합니다.');
      await message(room, sockets.host, { type: 'ping' });
      assert.equal(sockets.host.sent.at(-1).type, 'pong', '정상 메시지는 그대로 처리해야 합니다.');
    });
    if (failures.length) throw Error(`[battle-room-check] FAIL\n  - ${failures.join('\n  - ')}`);
    console.log('[battle-room-check] PASS report backoff · reconnect after grace · word number · message validation');
  } finally {
    Date.now = realNow;
    globalThis.Response = RealResponse;
    if (realPair) globalThis.WebSocketPair = realPair; else delete globalThis.WebSocketPair;
  }
}
