// V13.128 던전 방(cloudflare/dungeon-room.mjs) 검사. battle-room-check.mjs처럼 Durable Object 자리에 가짜 시계 ·
// 저장소 · 알람 · 소켓을 두고 방을 끝까지 돌린다. cloudflare-check.mjs가 부른다.
import assert from 'node:assert/strict';
import { DungeonRoom, planBot, DUNGEON_BOT, BOT_SPELL_SLOW } from '../cloudflare/dungeon-room.mjs';
import { DUNGEON } from './dungeon-engine.mjs';
import { settleDungeon, undoDungeon } from './service.mjs';

function fakeSocket() {
  return { readyState: 1, tags: [], sent: [], send(text) { this.sent.push(JSON.parse(text)); }, close() { this.readyState = 3; } };
}
function fakeCtx() {
  const store = new Map(), sockets = [];
  const ctx = {
    alarm: null, store,
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
// 120단어 문제 풀(오답 5개씩).
const questions = Array.from({ length: 130 }, (_, i) => ({ word_id: 'w' + i, prompt: 'word' + i, meaning: '뜻' + i, wrong: [1, 2, 3, 4, 5].map(k => `오답${i}-${k}`) }));
const player = (id, extra = {}) => ({ id, name: id, grade: '고1', pet: { key: 'dog', form: 1 }, questions, cleared: [], ...extra });

export async function runDungeonRoomChecks() {
  const realNow = Date.now, RealResponse = globalThis.Response, realPair = globalThis.WebSocketPair;
  let clock = 5_000_000;
  Date.now = () => clock;
  globalThis.WebSocketPair = function () { return { 0: fakeSocket(), 1: fakeSocket() }; };
  globalThis.Response = class extends RealResponse {
    constructor(body, init = {}) {
      if (init.status === 101) { super(null, { status: 200 }); this.upgraded = init.webSocket; return; }
      super(body, init);
    }
  };
  let reportOk = true;
  const reports = [];
  const env = {
    VOCA_STATE_SECRET: 'test-secret',
    VOCA_STATE: { idFromName: name => name, get: () => ({ fetch: async (url, init) => { reports.push({ url, key: init.headers['X-Dungeon-Key'], body: JSON.parse(init.body) }); return new RealResponse('{}', { status: reportOk ? 200 : 503 }); } }) }
  };
  let seq = 0;
  async function openRoom({ bots = 1, guests = ['b'], words = questions } = {}) {
    const ctx = fakeCtx(), room = new DungeonRoom(ctx, env);
    let r = 0; room.random = () => { r = (r * 9301 + 49297) % 233280; return r / 233280; };
    await room.ready;
    const id = `room-${++seq}`;
    const admin = msg => room.admin({ id, ...msg }).then(res => res.json().then(body => ({ status: res.status, ...body })));
    assert.equal((await admin({ action: 'init', cut: 'c3', grade: '고1', host: player('a', { questions: words }), ticket: 't-a', seed: 7, lobby_until: clock + 15 * 60000 })).ok, true, '방 만들기');
    for (const g of guests) assert.equal((await admin({ action: 'join', player: player(g, { questions: words }), ticket: 't-' + g })).ok, true, '참가');
    for (let i = 1; i <= bots; i++) assert.equal((await admin({ action: 'bot', player: player(`bot-${i}`, { name: `봇 동료 ${i}`, bot: true, questions: words }) })).ok, true, '봇 동료');
    const sockets = {};
    const connect = async pid => { await room.accept(new URL(`https://dungeon/ws?ticket=t-${pid}`)); sockets[pid] = ctx.getWebSockets(pid).at(-1); return sockets[pid]; };
    for (const pid of ['a', ...guests]) await connect(pid);
    return { ctx, room, admin, sockets, connect, id };
  }
  const send = (room, ws, payload) => room.webSocketMessage(ws, typeof payload === 'string' ? payload : JSON.stringify(payload));
  const lastView = ws => ws.sent.filter(m => m.type === 'view').at(-1)?.view;
  const failures = [];
  const check = async (name, fn) => { try { await fn(); } catch (error) { failures.push(`${name}: ${error.message}`); } };

  try {
    /* ---------- 1. 로비 → 준비 → 입장 연출 → 1층, 정답 번호는 폰에 가지 않는다 ---------- */
    await check('1 로비와 시작', async () => {
      const { room, sockets } = await openRoom();
      const s = () => room.room.state;
      assert.equal(s().order.length, 3, '방장 + 친구 + 봇 = 3명');
      assert(s().players['bot-1'].ready && !s().players.a.ready, '봇은 처음부터 준비, 학생은 준비를 눌러야 한다');
      await send(room, sockets.a, { type: 'ready' });
      assert.equal(s().phase, 'lobby', '한 명이라도 준비 전이면 시작하지 않는다');
      await send(room, sockets.b, { type: 'ready' });
      assert.equal(s().phase, 'intro', '모두 준비하면 입장 연출');
      assert(room.ctx.alarm <= clock + DUNGEON.INTRO_MS, '입장 연출 끝에 알람');
      clock += DUNGEON.INTRO_MS; await room.alarm();
      assert(s().phase === 'fight' && s().floor === 1, '1층 시작');
      const v = lastView(sockets.a);
      assert(v.question && v.question.options.length === 4 && v.question.answer === undefined, '1층 보기 4개, 정답 번호는 보내지 않는다');
      assert(!JSON.stringify(sockets.a.sent).includes('"src"'), '문제 원본(정답 뜻)을 폰에 보내지 않는다');
      assert(v.players.every(p => p.questions === undefined), '다른 학생의 문제 목록을 보내지 않는다');
    });

    /* ---------- 2. 끝까지: 봇은 알람으로 답하고, 결과는 한 번만 보고한다 ---------- */
    await check('2 한 판과 보고', async () => {
      reports.length = 0; reportOk = true;
      const { room, sockets, ctx } = await openRoom();
      const s = () => room.room.state;
      await send(room, sockets.a, { type: 'ready' }); await send(room, sockets.b, { type: 'ready' });
      let guard = 0, answered = 0;
      // 학생 두 명은 문제가 열리고 1초 뒤 정답을 누른다. 정답 번호는 방 상태에서만 본다(검사용).
      while (s().phase !== 'finished' && guard++ < 20000) {
        const due = ['a', 'b'].map(pid => s().players[pid].q).filter(Boolean).map(q => q.started_at + 1000);
        const next = Math.min(ctx.alarm ?? Infinity, ...due);
        assert(Number.isFinite(next), '할 일이 없는데 판이 멈추면 안 된다');
        clock = Math.max(clock, next);
        let acted = false;
        for (const pid of ['a', 'b']) {
          const q = s().players[pid].q;
          if (q && clock >= q.started_at + 1000) { await send(room, sockets[pid], { type: 'answer', choice: q.answer, n: q.n }); answered++; acted = true; }
        }
        if (!acted) await room.alarm();
      }
      assert.equal(s().phase, 'finished', `판이 끝나야 한다 (${s().phase}, 층 ${s().floor})`);
      assert(s().result.cleared && s().players['bot-1'].answered > 20, `봇 동료도 알람으로 답한다 (봇 답 ${s().players['bot-1'].answered})`);
      assert.equal(reports.length, 1, '결과는 한 번 보고한다');
      const rep = reports[0];
      assert(rep.url.endsWith('/api/internal/dungeon-result') && rep.key?.length === 64 && rep.body.report_id === s().result.report_id && rep.body.result.cleared, '보고: 던전 키, report_id, 결과');
      assert.equal(rep.body.result.record, false, '봇이 낀 파티는 기록 제외');
      // 늦게 깬 알람과 다시 들어온 폰이 다시 보고하지 않는다.
      await room.alarm(); await room.accept(new URL('https://dungeon/ws?ticket=t-b'));
      assert.equal(reports.length, 1, '보고는 한 번뿐');
      assert(lastView(ctx.getWebSockets('b').at(-1)).result?.cleared, '끝난 뒤 들어온 폰은 결과를 본다');
      // 메인 상태: 같은 보고가 두 번 와도 한 번만 처리한다.
      const state = { profiles: [{ id: 'a' }, { id: 'b' }], dungeons: [{ id: room.room.id, status: 'open', cut: 'c3', members: ['a', 'b'], created_at: clock - 600000 }] };
      assert.equal(settleDungeon(state, rep.body), true);
      assert.equal(settleDungeon(state, rep.body), false, '같은 report_id는 두 번 처리하지 않는다');
      const d = state.dungeons[0];
      assert(d.status === 'finished' && d.result.players.find(x => x.id === 'bot-1')?.reward === false && d.result.players.find(x => x.id === 'a')?.reward === true, '봇은 보상 대상이 아니다');
      assert.deepEqual(state.profiles.find(x => x.id === 'a').dungeon_cleared, ['c3'], '깬 등급컷이 다음 단계를 연다');
      // 방은 보고 뒤 잠시 있다가 지워진다.
      clock = ctx.alarm; await room.alarm();
      assert(room.room === null && ctx.store.size === 0, '보고가 끝난 방은 지워진다');
      void answered;
    });

    /* ---------- 3. 로비가 닫히면 '취소'를 한 번 보고한다, 방장이 나가도 ---------- */
    await check('3 로비 마감 · 방장 나감', async () => {
      reports.length = 0;
      const one = await openRoom({ bots: 0 });
      clock += 15 * 60000; await one.room.alarm();
      assert(one.room.room.closed && reports.length === 1 && reports[0].body.cancelled === true, '15분 안에 시작하지 않으면 닫히고 취소를 보고한다');
      assert(one.sockets.a.sent.some(m => m.type === 'expired') && one.sockets.a.readyState === 3, '폰에 알리고 연결을 닫는다');
      const two = await openRoom({ bots: 0 });
      await two.admin({ action: 'leave', pid: 'a' });
      assert(two.room.room.closed && reports.length === 2 && reports[1].body.reason === 'host-left', '방장이 로비에서 나가면 방이 닫힌다');
      const three = await openRoom({ bots: 0 });
      await three.admin({ action: 'leave', pid: 'b' });
      assert(!three.room.room.closed && three.room.room.state.order.join() === 'a' && !three.room.room.tickets.b, '친구가 나가면 자리만 빈다(입장표도 지운다)');
      const st = { dungeons: [{ id: 'x', status: 'open' }] };
      assert(settleDungeon(st, { id: 'x', report_id: 'dungeon:x:closed', cancelled: true }) && st.dungeons[0].status === 'cancelled', '메인은 닫힌 방을 취소로 정리한다');
    });

    /* ---------- 4. 시작한 뒤 참가 · 가득 찬 방은 거절, 메인은 되돌린다 ---------- */
    await check('4 참가 거절', async () => {
      const { room, admin, sockets } = await openRoom({ bots: 1 });
      const full = await admin({ action: 'join', player: player('c'), ticket: 't-c' });
      assert(full.status === 409 && /3명/.test(full.error), `가득 찬 방은 거절한다 (${full.error})`);
      await send(room, sockets.a, { type: 'ready' }); await send(room, sockets.b, { type: 'ready' });
      const late = await admin({ action: 'bot', player: player('bot-2', { bot: true }) });
      assert(late.status === 409 && /시작/.test(late.error), '시작한 방에는 들어갈 수 없다');
      const st = { dungeons: [{ id: 'y', status: 'open', members: ['a', 'c'], left: [], tickets: { a: 1, c: 2 }, bots: 1 }] };
      undoDungeon(st, { id: 'y', action: 'join', player: { id: 'c' } }); undoDungeon(st, { id: 'y', action: 'bot' });
      assert(st.dungeons[0].members.join() === 'a' && !st.dungeons[0].tickets.c && st.dungeons[0].bots === 0, '방이 거절하면 메인 상태를 되돌린다');
      const bad = await openRoom({ bots: 0 }).then(x => x.room.accept(new URL('https://dungeon/ws?ticket=nope')));
      assert.equal(bad.status, 403, '입장표가 없으면 들어갈 수 없다');
    });

    /* ---------- 5. 지난 문제 번호 · 잘못된 메시지는 무시 ---------- */
    await check('5 메시지 검사', async () => {
      const { room, sockets } = await openRoom({ bots: 0 });
      await send(room, sockets.a, { type: 'ready' }); await send(room, sockets.b, { type: 'ready' });
      clock += DUNGEON.INTRO_MS; await room.alarm();
      const s = room.room.state, q = s.players.a.q, seqBefore = s.seq;
      for (const bad of ['null', '[]', '7', '{"type":"hack"}', JSON.stringify({ type: 'answer', choice: q.answer, n: q.n, pad: 'x'.repeat(2000) }), JSON.stringify({ type: 'answer', choice: q.answer }), JSON.stringify({ type: 'answer', choice: q.answer, n: q.n - 1 }), JSON.stringify({ type: 'answer', choice: '0', n: q.n })]) {
        await assert.doesNotReject(send(room, sockets.a, bad));
      }
      assert(room.room.state.seq === seqBefore && room.room.state.players.a.answered === 0, '번호 없는 답, 지난 번호의 답, 숫자가 아닌 보기, 큰 메시지는 채점하지 않는다');
      await send(room, sockets.a, { type: 'emote', emote: 'cheer' }); await send(room, sockets.a, { type: 'emote', emote: 'cheer' });
      assert.equal(sockets.b.sent.filter(m => m.type === 'events' && m.events.some(e => e.type === 'emote')).length, 1, '응원 이모트는 3초에 하나');
    });

    /* ---------- 6. 끊김: 펫이 자동 공격, 다시 오면 문제가 이어진다 ---------- */
    await check('6 끊김과 다시 연결', async () => {
      const { room, sockets, connect } = await openRoom({ bots: 0 });
      await send(room, sockets.a, { type: 'ready' }); await send(room, sockets.b, { type: 'ready' });
      clock += DUNGEON.INTRO_MS; await room.alarm();
      sockets.b.close(); await room.webSocketClose(sockets.b);
      const s = room.room.state;
      assert(!s.players.b.connected && !s.players.b.q, '끊기면 그 학생의 문제는 멈춘다');
      const hp = s.monster.hp;
      clock += DUNGEON.AUTO_MS; await room.alarm();
      assert(room.room.state.monster.hp < hp, '끊긴 학생의 펫이 자동으로 공격한다');
      const back = await connect('b');
      assert(room.room.state.players.b.connected && lastView(back).question, '다시 오면 문제를 받는다');
    });

    /* ---------- 7. 보고 실패: 점점 길게 다시 보내고, 보고 전에는 방을 지우지 않는다 ---------- */
    await check('7 보고 재시도', async () => {
      reports.length = 0; reportOk = false;
      const { room, ctx } = await openRoom({ bots: 0 });
      clock += 15 * 60000; await room.alarm();
      const gaps = [];
      for (let i = 0; i < 6; i++) { gaps.push(ctx.alarm - clock); clock = ctx.alarm; await room.alarm(); }
      assert(gaps.every(g => g >= 5000) && gaps.at(-1) === 60000 && ctx.store.has('room'), `보고 실패 중에는 5초부터 최대 60초 간격 (${gaps.join(', ')})`);
      reportOk = true; clock = ctx.alarm; await room.alarm();
      assert(room.room.reported, '보고가 되면 끝');
    });

    /* ---------- 8. 봇 동료: 보통 로보의 정답률과 시간, 제한 시간을 넘기면 시간 초과 ---------- */
    await check('8 봇 계획', async () => {
      const q = { n: 3, started_at: 1000, deadline: 1000 + 3000 };
      assert.equal(planBot(q, () => 0).at, 1000 + DUNGEON_BOT.min, '가장 빠르면 min 뒤');
      assert.equal(planBot(q, () => 0.99).at, null, '제한 시간 안에 못 하면 답하지 않는다(시간 초과)');
      assert(planBot(q, () => 0.5).right && !planBot(q, () => 0.99).right, `정답률 ${DUNGEON_BOT.accuracy}`);
      assert.equal(planBot({ ...q, kind: 'spell', deadline: 1000 + 16000 }, () => 0).at, 1000 + Math.round(DUNGEON_BOT.min * BOT_SPELL_SLOW), 'V13.130 영어 쓰기 문제는 봇도 ×1.8 오래 걸린다');
    });

    /* ---------- 9. V13.130 영어 쓰기: 폰은 글자 하나와 문제 번호만, 방이 채점 ---------- */
    await check('9 영어 쓰기 글자', async () => {
      const spellWords = Array.from({ length: 130 }, (_, i) => ({ word_id: 's' + i, prompt: 'abcdefghij'.slice(0, 4 + (i % 4)) + 'xyz'[i % 3], meaning: '뜻' + i, wrong: [1, 2, 3, 4, 5].map(k => `오답${i}-${k}`), wrong_en: [1, 2, 3, 4, 5].map(k => `word${i}${k}`) }));
      const { room, sockets } = await openRoom({ bots: 1, guests: [], words: spellWords });
      await send(room, sockets.a, { type: 'ready' });
      clock += DUNGEON.INTRO_MS; await room.alarm();
      const s = room.room.state;
      for (let i = 0; i < 12 && s.players.a.q?.kind !== 'spell'; i++) {
        const q = s.players.a.q;
        if (q) await send(room, sockets.a, { type: 'answer', choice: q.answer, n: q.n });
        clock += DUNGEON.REVEAL_MS + 10; await room.alarm();
      }
      const q = s.players.a.q;
      assert(q?.kind === 'spell', '네 번째 문제는 영어 쓰기');
      const v = lastView(sockets.a).question;
      assert(v.kind === 'spell' && v.tiles.length >= 10 && !JSON.stringify(v).includes(`"${q.word}"`), '폰이 받은 쓰기 문제에는 정답 철자가 없다');
      const seq = s.seq;
      for (const bad of [{ type: 'letter', ch: 7, n: q.n }, { type: 'letter', ch: q.word[0] }, { type: 'letter', ch: q.word[0], n: q.n - 1 }, { type: 'answer', choice: 0, n: q.n }]) await send(room, sockets.a, bad);
      assert(room.room.state.seq === seq && room.room.state.players.a.q.pos === 0, '글자가 아닌 것 · 번호 없는 글자 · 지난 번호 · 보기 번호 답은 무시한다');
      sockets.a.sent.length = 0;
      for (const ch of q.word) await send(room, sockets.a, { type: 'letter', ch, n: q.n });
      const events = sockets.a.sent.filter(m => m.type === 'events').flatMap(m => m.events);
      const letters = events.filter(e => e.type === 'letter'), done = events.find(e => e.type === 'answered' && e.pid === 'a');
      assert(letters.length === q.word.length && letters.every((e, i) => e.ok && e.pos === i + 1 && !('ch' in e)) && done?.right && done.word === q.word && events.some(e => e.type === 'hit' && e.kind === 'spell'), '글자마다 몇 칸인지만 알리고, 다 쓰면 정답 · 쓰기 피해');
    });

    if (failures.length) throw Error(`[dungeon-room-check] FAIL\n  - ${failures.join('\n  - ')}`);
    console.log('[dungeon-room-check] PASS lobby/ready · full run with bot · one report · lobby close · join refused · messages · reconnect · report backoff · bot plan · spelling letters');
  } finally {
    Date.now = realNow;
    globalThis.Response = RealResponse;
    if (realPair) globalThis.WebSocketPair = realPair; else delete globalThis.WebSocketPair;
  }
}
