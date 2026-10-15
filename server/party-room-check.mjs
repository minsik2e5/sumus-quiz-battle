// V13.149 교실 게임 방(cloudflare/party-room.mjs) 검사. dungeon-room-check.mjs처럼 가짜 시계 · 저장소 · 소켓으로 판을 끝까지 돌린다.
// cloudflare-check.mjs가 부른다.
import assert from 'node:assert/strict';
import { PartyRoom, partyReportKey, PARTY_SAVE_EVERY_MS } from '../cloudflare/party-room.mjs';
import { PARTY } from './party-engine.mjs';

function fakeSocket() {
  return { readyState: 1, tags: [], sent: [], send(text) { this.sent.push(JSON.parse(text)); }, close(code) { this.readyState = 3; this.closedWith = code; } };
}
function fakeCtx() {
  const store = new Map(), sockets = [];
  const ctx = {
    alarm: null, store, writes: 0, alarms: 0,
    storage: {
      async get(key) { return store.has(key) ? structuredClone(store.get(key)) : undefined; },
      async put(key, value) { ctx.writes++; store.set(key, structuredClone(value)); },
      async setAlarm(time) { ctx.alarm = time; ctx.alarms = (ctx.alarms || 0) + 1; },
      async deleteAll() { store.clear(); ctx.alarm = null; }
    },
    blockConcurrencyWhile: fn => fn(),
    acceptWebSocket(ws, tags) { ws.tags = tags; sockets.push(ws); },
    getWebSockets(tag) { return sockets.filter(ws => ws.readyState === 1 && (!tag || ws.tags.includes(tag))); },
    getTags: ws => ws.tags
  };
  return ctx;
}
const questions = Array.from({ length: 30 }, (_, i) => ({ word_id: 'w' + i, prompt: 'word' + i, options: ['가', '나', '다', '라'], answer: i % 4 }));

export async function runPartyRoomChecks() {
  const realNow = Date.now, RealResponse = globalThis.Response, realPair = globalThis.WebSocketPair;
  let clock = 9_000_000;
  Date.now = () => clock;
  globalThis.WebSocketPair = function () { return { 0: fakeSocket(), 1: fakeSocket() }; };
  globalThis.Response = class extends RealResponse {
    constructor(body, init = {}) {
      if (init.status === 101) { super(null, { status: 200 }); this.upgraded = init.webSocket; return; }
      super(body, init);
    }
  };
  let reportOk = false;
  const reports = [];
  const env = { VOCA_STATE_SECRET: 'test-secret', VOCA_STATE: { idFromName: n => n, get: () => ({ fetch: async (url, init) => { reports.push({ url, key: init.headers['X-Party-Key'], body: JSON.parse(init.body) }); return new RealResponse('{}', { status: reportOk ? 200 : 503 }); } }) } };
  try {
    const ctx = fakeCtx(), room = new PartyRoom(ctx, env, { timers: false });
    let r = 0; room.random = () => { r = (r * 9301 + 49297) % 233280; return r / 233280; };
    await room.ready;
    const admin = msg => room.admin({ id: 'party-1', ...msg }).then(res => res.json().then(body => ({ status: res.status, ...body })));
    assert.equal((await admin({ action: 'init', tv_ticket: 'tv-t', party: { code: '4321', kind: 'treasure', minutes: 5, steal: true, questions, host: { id: 'teacher' }, seed: 3, label: '고1A' } })).ok, true, '방 만들기');
    for (const id of ['a', 'b', 'c']) assert.equal((await admin({ action: 'join', ticket: 't-' + id, player: { id, name: id.toUpperCase(), pet: { key: 'dog', form: 1 } } })).ok, true, '참가');
    assert.equal((await admin({ action: 'init', tv_ticket: 'x', party: {} })).status, 409, '같은 방을 두 번 만들 수 없다');
    const bad = await room.accept(new URL('https://party/ws?ticket=nope'));
    assert.equal(bad.status, 403, '입장표가 틀리면 들어갈 수 없다');
    const ws = {};
    for (const tag of ['tv', 'a', 'b', 'c']) { await room.accept(new URL(`https://party/ws?ticket=${tag === 'tv' ? 'tv-t' : 't-' + tag}`)); ws[tag] = ctx.getWebSockets(tag).at(-1); }
    const send = (who, msg) => room.webSocketMessage(ws[who], JSON.stringify(msg));
    const lastView = who => ws[who].sent.filter(m => m.type === 'view').at(-1)?.view;
    assert(lastView('tv').phase === 'lobby' && lastView('tv').lobby.length === 3 && lastView('a').players === 3, 'V13.149 TV는 들어온 학생을, 학생은 인원을 본다');
    await send('a', { type: 'start' });
    assert.equal(room.room.state.phase, 'lobby', 'V13.149 학생은 게임을 시작할 수 없다(선생님 TV만)');
    await send('tv', { type: 'start' });
    assert(room.room.state.phase === 'play' && lastView('a').q && !('answer' in lastView('a').q), 'V13.149 TV가 시작하면 학생에게 문제가 간다(정답 번호 없이)');
    // 답할 때마다 저장하지 않는다: 메모리에 두고 5초마다 한 번.
    const writes0 = ctx.writes, alarms0 = ctx.alarms;
    const answerRight = async who => { const pl = room.room.state.players[who], q = questions[pl.qi % questions.length]; await send(who, { type: 'answer', choice: q.answer }); };
    await answerRight('a');
    const chestsTo = who => ws[who].sent.some(m => m.type === 'events' && m.events.some(e => e.kind === 'chests'));
    assert(chestsTo('a') && !chestsTo('b') && !chestsTo('tv') && lastView('a').offer && !lastView('a').q, 'V13.149 맞히면 상자 3개는 그 학생에게만');
    await send('a', { type: 'pick', i: 1 });
    for (let k = 0; k < 6; k++) { await answerRight('b'); await send('b', { type: 'pick', i: 0 }); clock += 300; }
    assert(ctx.writes === writes0 && ctx.alarms === alarms0, 'V13.149 판 도중 답 · 상자는 저장도 알람도 하지 않는다(쓰기 한도)');
    clock += PARTY_SAVE_EVERY_MS;
    await room.pulse(clock);
    assert(ctx.writes === writes0 + 1 && ctx.store.get('room').state.players.b.right === 6, 'V13.149 5초마다 한 번 저장한다(바뀐 것이 있을 때)');
    await room.pulse(clock + 100);
    assert.equal(ctx.writes, writes0 + 1, 'V13.149 바뀐 것이 없으면 저장하지 않는다');
    // 맥박: 순위가 바뀐 학생 · TV에만 화면을 다시 보낸다.
    const tvBefore = ws.tv.sent.length;
    await room.pulse(clock + 200);
    assert.equal(ws.tv.sent.length, tvBefore, 'V13.149 같은 화면은 다시 보내지 않는다');
    // 메시지 검사: 모르는 type · 너무 긴 글은 무시.
    const sentA = ws.a.sent.length;
    await room.webSocketMessage(ws.a, JSON.stringify({ type: 'hack' }));
    await room.webSocketMessage(ws.a, 'x'.repeat(2000));
    await room.webSocketMessage(ws.a, '{bad');
    assert.equal(ws.a.sent.length, sentA, 'V13.149 모르는 메시지 · 큰 메시지는 무시한다');
    // 다른 화면에서 같은 학생이 들어오면 예전 연결은 닫힌다.
    const old = ws.c;
    await room.accept(new URL('https://party/ws?ticket=t-c'));
    ws.c = ctx.getWebSockets('c').at(-1);
    assert(old.closedWith === 4000 && ws.c !== old, 'V13.149 한 학생에 연결 하나(새 화면이 예전 것을 바꾼다)');
    // 끝: 시간이 다 되면 끝나고 한 번 보고(실패하면 다시).
    clock = room.room.state.end_at + 10;
    await room.pulse(clock);
    assert(room.room.state.phase === 'ended' && room.room.ended && reports.length === 1 && reports[0].key === await partyReportKey(env) && reports[0].body.result.players.length === 3 && !room.room.reported, 'V13.149 시간이 다 되면 끝나고 메인에 결과를 보고한다(키 확인)');
    assert(lastView('a').phase === 'ended' && lastView('a').result.rank >= 1 && lastView('tv').awards.length >= 1, 'V13.149 끝나면 학생은 내 순위 · 코인, TV는 시상대 · 재미 상');
    reportOk = true;
    clock = room.room.report_retry_at + 1;
    await room.alarm();
    assert(room.room.reported && reports.length === 2 && reports[1].body.report_id === 'party:party-1', 'V13.149 보고가 실패하면 다시 보낸다(같은 report_id)');
    await room.alarm();
    assert.equal(reports.length, 2, 'V13.149 보고는 한 번만 성공하면 끝');
    // 시작하지 않은 방은 30분 뒤 닫힌다.
    const ctx2 = fakeCtx(), lonely = new PartyRoom(ctx2, env, { timers: false });
    await lonely.ready;
    await lonely.admin({ id: 'party-2', action: 'init', tv_ticket: 'tv2', party: { code: '1111', kind: 'fish', minutes: 5, questions, host: { id: 't' }, seed: 1 } });
    clock += PARTY.LOBBY_MS + 1;
    await lonely.alarm();
    assert(lonely.room.state.phase === 'ended' && lonely.room.ended, 'V13.149 시작하지 않은 방은 30분 뒤 닫힌다');
    console.log('[party-room-check] PASS lobby · start (TV only) · chests to one · save every 5 s · no resend · message validation · one socket · end report + retry · lobby close');
  } finally {
    Date.now = realNow; globalThis.Response = RealResponse; globalThis.WebSocketPair = realPair;
  }
}
