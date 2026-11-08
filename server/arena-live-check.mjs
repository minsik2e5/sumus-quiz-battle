// V13.230 검사: 펫 아레나 실시간 1:1 친구 대전(구성안 1장 · ③단계). server/arena-check.mjs가 부른다(npm run check).
//   ① 두 학생 조작 기록으로 서버가 다시 돌린 결과 = 방 = 두 화면(지연 · 흔들림 · 순서 지킴, 롤백)
//   ② 끊김(3초 → 컴퓨터가 대신, 다시 들어오면 이어서) · 시간 초과(대기실 5분 · 방이 잠들어도 판 끝까지 · 보고 재시도)
//   ③ 같은 학년만 초대 · 방 번호로 들어가기 · 끝 보고 때도 확인 ④ 농사 막기(같은 친구 하루 2판 · 져 주기 · 컴퓨터가 절반 넘게)
//   ⑤ 렉 방지: 판 도중 조작은 방 객체만(메인 상태 객체 · 자동 새로고침 없음), 새 데이터 묶음 예산
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { ARENA, INPUT, fighter, cleanInputs, runArena, createArena, arenaHash } from '../public/modules/arena-rules.js';
import { LIVE, LiveSim, toCanon, flipDir, flipAim, mirror, replaySim } from '../public/modules/arena-live.js';
import { createLive, joinLive, lobbySet, startLive, acceptInputs, flushLive, finishLate, liveSim, liveReport, emoteLive, lobbyView, leaveLive, unpackTeam } from './arena-live.mjs';
import { liveMatch } from './arena-live-sim.mjs';
import { ARENA_LIVE, arenaLiveCreate, arenaLiveJoin, arenaLiveFriends, arenaLiveInviteFor, arenaLiveDecline, settleArenaLive, arenaLivePending, arenaLiveReceipts, aiTicksOf, sameArenaGrade, tidyArenaLive, undoArenaLive, arenaView } from './arena.mjs';
import { ArenaRoom, arenaReportKey, ARENA_SAVE_EVERY_MS } from '../cloudflare/arena-room.mjs';
import { STATE_BUDGET_KB, POLL_MIN_MS } from './perf-budget.mjs';

const source = path => readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8');
const fails = (fn, word) => { try { fn(); return false; } catch (err) { return !word || String(err.message).includes(word); } };
const pets = keys => keys.map((key, i) => ({ key, form: 2, level: 12 - i, active: i === 0 }));
const DAY0 = Date.UTC(2026, 10, 9, 3);

export async function runArenaLiveChecks(assert) {
  // 1) 같은 전투를 두 쪽이 사람으로: 규칙 · 뒤집기 · 되감기.
  {
    assert(cleanInputs([[0, INPUT.AI_ON]]).length === 0 && cleanInputs([[0, INPUT.AI_ON], [5, INPUT.AI_OFF]], 3000, true).length === 2,
      'V13.230 컴퓨터 대신 조종(19 · 20)은 방만 넣는다: 학생이 보낸 혼자 판 기록에는 들어갈 수 없다');
    assert([1, 2, 3, 4, 5, 6, 7, 8, 0, 10].map(flipDir).join() === '5,6,7,8,1,2,3,4,0,10' && flipAim(0) === 8 && flipAim(12) === 4 && JSON.stringify(toCanon([7, 3, 2], 1)) === '[7,7,10]' && toCanon([7, 3], 0)[1] === 3,
      'V13.230 친구 화면은 뒤집혀 있다: 친구가 누른 방향 · 조준을 반 바퀴 돌려 같은 전투에 넣는다');
    const v = mirror({ me: { x: 30, y: 72, fx: 0, fy: -1 }, foe: { x: 50, y: 28 }, shots: [{ x: 10, y: 20, vx: 1, vy: -2, from: 'me' }], winner: 'foe' });
    assert(v.foe.x === 70 && v.foe.y === 28 && v.foe.fy === 1 && v.me.y === 72 && v.shots[0].x === 90 && v.shots[0].vx === -1 && v.shots[0].from === 'foe' && v.winner === 'me',
      'V13.230 친구 화면 보기: 자리(100 − x) · 방향(반대) · 누구(me ↔ foe)를 뒤집어 내 펫이 늘 아래');
    // 되감기: 저장 → 몇 틱 → 불러오기 → 같은 조작이면 같은 상태(무작위 수 상태까지 S 안에).
    const me = ['dog', 'bear', 'dragon'].map(key => fighter({ key, form: 2, level: 12 })), foe = ['cat', 'pig', 'owl'].map(key => fighter({ key, form: 2, level: 12 }));
    const A = createArena({ seed: 77, me, foe, foeHuman: true });
    for (let i = 0; i < 50; i++) A.step();
    const snap = A.save(), seq = [[50, 3], [52, INPUT.ATK], [60, INPUT.SKILL, 4]], seq2 = [[51, 7], [55, INPUT.ATK]];
    A.load(snap, seq, seq2); for (let i = 0; i < 80; i++) A.step(); const h1 = A.hash();
    A.load(snap, seq, seq2); for (let i = 0; i < 80; i++) A.step();
    assert(h1 === A.hash() && A.S.t === 130, 'V13.230 되감기: 저장한 틱으로 돌아가 같은 조작으로 다시 돌리면 같은 상태(무작위 수 상태도 S 안에)');
    const t0 = performance.now(); for (let i = 0; i < 200; i++) { A.load(snap, seq, seq2); for (let k = 0; k < 16; k++) A.step(); } const per = (performance.now() - t0) / 200;
    assert(per < 2, `V13.230 되감기 한 번(상태 복사 + 16틱 다시 계산) ${per.toFixed(3)}ms — 느린 폰(10배)에서도 0.1초 묶음마다 부담 없음`);
    // 혼자 판은 그대로: 무작위 수 상태를 S로 옮겨도 같은 씨앗이면 같은 결과(서버 = 화면).
    const solo = runArena({ seed: 9, me, foe, foeLevel: 1, inputs: [[0, 3], [10, INPUT.ATK]] }), again = runArena({ seed: 9, me, foe, foeLevel: 1, inputs: [[0, 3], [10, INPUT.ATK]] });
    assert(solo.hash === again.hash && solo.winner === again.winner, 'V13.230 혼자 판(컴퓨터 상대)은 바뀌지 않는다');
  }

  // 2) 두 학생 조작 기록으로 서버가 다시 돌린 결과 = 방 = 두 화면.
  {
    const cases = [{ seed: 11 }, { seed: 12, lag: [200, 350], jitter: 120 }, { seed: 13, lag: [300, 40], jitter: 200 }, { seed: 14, lag: [20, 20], jitter: 5 }];
    const out = cases.map(c => ({ c, x: liveMatch(c) }));
    for (const { c, x } of out) {
      const side1 = { me: 'foe', foe: 'me', draw: 'draw' }[x.server.winner];
      assert(x.r.phase === 'ended' && x.room.hash === x.server.hash && x.room.winner === x.server.winner && x.phones.every(p => p.over && p.hash === x.server.hash) && x.phones[0].view.winner === x.server.winner && x.phones[1].view.winner === side1 && !x.bad,
        `V13.230 서버가 두 조작 기록으로 다시 돌린 결과 = 방 = 두 화면(지연 ${c.lag || [60, 140]}ms ± ${c.jitter ?? 40}: ${x.server.winner}, ${x.server.ticks}틱, 되감기 최대 ${x.maxRewind}틱)`);
    }
    assert(out.every(({ x }) => x.maxRewind <= LIVE.DELAY + 10), `V13.230 되감기는 짧다(최대 ${Math.max(...out.map(({ x }) => x.maxRewind))}틱 ≈ 0.8초)`);
    // 상태가 어긋나면(버그 · 방이 꺼졌다 켜짐) 폰이 알아챈다 → 처음부터 다시 받는다.
    const x = out[0].x, fs = l => l.map(([key, form, level, s2]) => fighter({ key, form, level, s2 }));
    const ls = new LiveSim({ seed: x.r.seed + 1, a: fs(x.r.teams[0]), b: fs(x.r.teams[1]), side: 0 });
    const sim = createArena({ seed: x.r.seed, me: fs(x.r.teams[0]), foe: fs(x.r.teams[1]), foeHuman: true });
    for (let i = 0; i < 21; i++) sim.step();
    ls.confirm({ u: 20, i: [], k: [0, 0], h: { t: sim.S.t, v: sim.hash() } });
    assert(ls.bad, 'V13.230 1초마다 상태 요약(arenaHash)을 비교해 어긋나면 처음부터 다시 받는다');
    ls.reset(); ls.seed = x.r.seed; ls.reset();
    ls.full({ u: x.r.upto, ia: x.r.inputs[0], ib: x.r.inputs[1] });
    assert(ls.conf.S.over && ls.conf.hash() === x.server.hash, 'V13.230 다시 들어오면 씨앗 + 확정 조작 전체로 빠르게 다시 계산해 같은 결과');
    // 다시 보기: 씨앗 + 두 조작 기록으로 처음부터 → 같은 끝.
    const rep = replaySim({ seed: x.r.seed, a: fs(x.r.teams[0]), b: fs(x.r.teams[1]), ia: x.r.inputs[0], ib: x.r.inputs[1], side: 1 });
    while (rep.canStep()) rep.step();
    assert(rep.S.over && rep.S.winner === { me: 'foe', foe: 'me', draw: 'draw' }[x.server.winner], 'V13.230 다시 보기: 씨앗 + 두 조작 기록으로 처음부터 같은 판(친구 화면은 뒤집어서)');
  }

  // 3) 방 규칙: 대기실 · 조작 받기(늦음 · 미래 · 중복 · 모르는 코드) · 이모트.
  {
    let now = 5_000_000;
    const r = createLive({ id: 'r1', code: '1111', host: { id: 'h', name: 'H', ticket: 'th', pets: [['dog', 2, 10], ['bear', 2, 9]], team: ['bear'] }, now });
    assert(r.players[0].team.join() === 'bear,dog' && joinLive(r, { id: 'h', pets: [] }, now).error && !joinLive(r, { id: 'g', name: 'G', ticket: 'tg', pets: [['cat', 2, 10]] }, now).error && joinLive(r, { id: 'z', pets: [] }, now).error,
      'V13.230 방: 방장 + 친구 1명(방장이 다시 들어오거나 세 번째 학생은 못 들어온다)');
    lobbySet(r, 0, { team: ['dog', 'owl'], s2: { dog: 1, owl: 1 }, aim: 'auto', ready: true });
    assert(r.players[0].team.join() === 'dog' && r.players[0].s2.dog === 1 && r.players[0].s2.owl === undefined && r.players[0].aim === 'auto' && r.players[0].ready,
      'V13.230 대기실: 내 펫만 팀 · 스킬 ②로(없는 펫은 버린다), 조준 방식 · 준비');
    assert(startLive(r, 1, now, 5).error && startLive(r, 0, now, 5).error, 'V13.230 시작은 방장만, 둘 다 준비해야');
    lobbySet(r, 1, { ready: true });
    assert(startLive(r, 0, now, 5).ok && r.buf[0][0][1] === INPUT.AIM_AUTO && r.teams[0][0].join() === 'dog,2,10,1', 'V13.230 시작: 팀 [키, 단계, 레벨, 스킬 ②] · 조준 방식은 첫 틱 조작으로');
    const sim = liveSim(r);
    now = r.start_at + 40 * ARENA.TICK_MS; // 방 시계 40틱
    r.seen = [now, now];
    flushLive(r, sim, now);
    const upto = r.upto;
    acceptInputs(r, 1, 1, [[3, 3], [3, 19], [3, 10]], now);
    assert(r.buf[1].length === 1 && r.buf[1][0][0] === upto + 1, `V13.230 너무 늦은 조작은 다음 확정 틱(${upto + 1})으로, 모르는 코드(19)에서 멈춘다`);
    acceptInputs(r, 1, 1, [[3, 3]], now);
    assert(r.buf[1].length === 1, 'V13.230 같은 순번은 두 번 받지 않는다(다시 연결해서 다시 보내도)');
    acceptInputs(r, 1, 2, [[999, 5]], now);
    assert(r.buf[1][1][0] === 40 + LIVE.AHEAD, 'V13.230 너무 미래의 틱은 방 시계 + 4틱까지만');
    const b = flushLive(r, sim, now + 1000);
    assert(b.i.some(([sd, t, c]) => sd === 1 && c === 3) && b.k[1] === 2 && b.u === 60 - LIVE.DELAY + 0, `V13.230 확정 묶음: 지금 틱 − ${LIVE.DELAY}까지 · 받은 순번(ack) · 1초마다 상태 요약`);
    assert(emoteLive(r, 0, 2, now) && !emoteLive(r, 0, 3, now + 500) && emoteLive(r, 0, 3, now + 2000) && !emoteLive(r, 1, 9, now) && LIVE.EMOTES.length === 8,
      'V13.230 이모트 8개 중 하나 · 학생마다 1.5초에 1번(자유 글은 없다)');
    const lv = lobbyView({ ...r, phase: 'lobby' }, 1, now);
    assert(lv.seats[1].pets && !lv.seats[0].pets && lv.seats[0].team.length, 'V13.230 대기실 화면: 친구의 펫 목록은 보내지 않고 고른 팀만');
  }

  // 4) 끊김 · 시간 초과.
  {
    const base = 1_000_000;
    const away = liveMatch({ seed: 21, away: { side: 1, from: base + 20000, to: base + 40000 } });
    const aiT = aiTicksOf(away.r.inputs[1], away.server.ticks);
    assert(away.r.ai_ticks[1] > 250 && away.r.ai_ticks[1] < 400 && aiT === away.r.ai_ticks[1] && away.r.inputs[1].some(x => x[1] === INPUT.AI_ON) && away.r.inputs[1].some(x => x[1] === INPUT.AI_OFF)
      && away.phones.every(p => p.hash === away.server.hash),
      `V13.230 끊김 3초 → 그 틱부터 컴퓨터가 대신(조작 기록에 19), 다시 들어오면 돌려준다(20). 대신 싸운 ${away.r.ai_ticks[1]}틱, 두 화면 = 서버`);
    const gone = liveMatch({ seed: 22, away: { side: 0, from: base + 15000, to: base + 900000 } });
    assert(gone.r.phase === 'ended' && gone.room.hash === gone.server.hash && gone.phones[1].hash === gone.server.hash && aiTicksOf(gone.r.inputs[0], gone.server.ticks) * 2 > gone.server.ticks,
      'V13.230 끝까지 안 들어오면 판은 끝까지 간다(남은 시간은 컴퓨터가), 남은 친구 화면 = 서버');
    // 방이 잠들었다(두 폰 모두 꺼짐): 판 끝 시각이 지나면 한 번에 끝까지.
    let now = 7_000_000;
    const r = createLive({ id: 'r2', code: '2222', host: { id: 'h', ticket: 'a', pets: [['dog', 2, 10]] }, now });
    joinLive(r, { id: 'g', ticket: 'b', pets: [['cat', 2, 10]] }, now); lobbySet(r, 0, { ready: true }); lobbySet(r, 1, { ready: true }); startLive(r, 0, now, 9);
    const sim = liveSim(r);
    assert(!finishLate(r, sim, r.start_at + 60000) && r.phase === 'play', 'V13.230 판 도중에는 한 번에 끝내지 않는다');
    finishLate(r, sim, r.start_at + (ARENA.MAX_TICKS + 30) * ARENA.TICK_MS);
    assert(r.phase === 'ended' && r.ai.every(Boolean) && r.result.ticks <= ARENA.MAX_TICKS + 1 && r.result.hash === runArena({ seed: 9, me: unpackTeam(r.teams[0]), foe: unpackTeam(r.teams[1]), inputs: r.inputs[0], foeInputs: r.inputs[1] }).hash,
      'V13.230 시간 초과: 방이 잠들어 있어도 판 끝 시각이 지나면 끝까지(둘 다 컴퓨터) 돌리고 같은 결과를 보고한다');
    const lob = createLive({ id: 'r3', code: '3333', host: { id: 'h', ticket: 'a', pets: [['dog', 2, 10]] }, now });
    assert(leaveLive(lob, 0).closed && liveReport(lob).kind === 'cancel', 'V13.230 방장이 대기실에서 나가면 방이 닫히고 메인에 "취소"를 보고한다');
  }

  // 5) 방 객체(cloudflare/arena-room.mjs): 가짜 시계 · 저장소 · 소켓으로 대기실 → 판 → 끝 보고까지.
  await roomFlow(assert);

  // 6) 메인: 같은 학년만 초대 · 방 번호 · 끝 보고 정산(서버가 다시 돌림) · 농사 막기.
  {
    const S = (id, school, cls, extra = {}) => ({ id, role: 'student', active: true, display_name: id.toUpperCase(), school_id: school, class_name: cls, pets: [{ key: 'dog' }], games: { arena: { tk: 5 } }, ...extra });
    const state = { profiles: [S('a', 'g', '고1A'), S('b', 'g', '고1B'), S('c', 'g', '고2A'), S('d', 'd', '고1A'), S('e', 'g', '특별반'), S('f', 'g', '특별반'), S('h', 'g', '고1C', { preview_owner_id: 't' })], arenaInvites: [] };
    const who = x => ({ school_id: x.school_id, grade: (String(x.class_name).match(/^(중[1-3]|고[1-3])/) || [])[1] || x.class_name });
    const P = id => state.profiles.find(x => x.id === id), mine = pets(['dog', 'bear', 'cat']);
    assert(sameArenaGrade(who(P('a')), who(P('b'))) && !sameArenaGrade(who(P('a')), who(P('c'))) && !sameArenaGrade(who(P('a')), who(P('d'))) && sameArenaGrade(who(P('e')), who(P('f'))) && !sameArenaGrade(who(P('e')), who({ school_id: 'g', class_name: '특별반2' })),
      'V13.230 같은 학년: 같은 학교 · 같은 학년(반은 달라도 된다), 학년을 알 수 없는 반 이름이면 같은 반끼리만');
    const friends = arenaLiveFriends(state, P('a'), who, DAY0).map(x => x.id);
    assert(friends.join() === 'b', `V13.230 초대할 친구 목록은 같은 학교 · 같은 학년만(다른 학년 · 다른 학교 · 미리보기 계정 빼고): ${friends.join()}`);
    assert(fails(() => arenaLiveCreate(state, P('a'), { who, pets: mine, friend: P('c'), roomId: 'x1', code: '1000', now: DAY0 }), '같은 학년') && fails(() => arenaLiveCreate(state, P('a'), { who, pets: mine, friend: P('d'), roomId: 'x1', code: '1000', now: DAY0 }), '같은 학년'),
      'V13.230 다른 학년 · 다른 학교 친구는 초대할 수 없다(서버가 확인)');
    const made = arenaLiveCreate(state, P('a'), { who, pets: mine, friend: P('b'), roomId: 'room-1', code: '4321', now: DAY0 });
    assert(made.message.action === 'init' && made.message.host.pets.length === 3 && made.room.ticket && state.arenaInvites.length === 1 && arenaLiveInviteFor(state, P('b'), DAY0)?.id === 'room-1' && !arenaLiveInviteFor(state, P('c'), DAY0),
      'V13.230 방 만들기 → 방에 보낼 메시지(펫 목록 · 입장표) · 초대받은 친구의 20초 확인에 초대가 실린다');
    assert(fails(() => arenaLiveJoin(state, P('c'), { who, pets: mine, code: '4321', now: DAY0 }), '같은 학년') && fails(() => arenaLiveJoin(state, P('d'), { who, pets: mine, code: '4321', now: DAY0 }), '같은 학년') && fails(() => arenaLiveJoin(state, P('a'), { who, pets: mine, code: '4321', now: DAY0 }), '내가 만든'),
      'V13.230 방 번호로 들어가기도 같은 학년만(다른 학년 · 다른 학교 · 방장 자신은 안 된다)');
    const joined = arenaLiveJoin(state, P('b'), { who, pets: mine, code: '4321', now: DAY0 + 1000 });
    assert(joined.message.action === 'join' && state.arenaInvites[0].guest_id === 'b' && P('b').games.arena.live_room.id === 'room-1' && fails(() => arenaLiveCreate(state, P('a'), { who, pets: mine, roomId: 'x3', code: '6666', now: DAY0 + 2000 }), '이미'),
      'V13.230 친구가 들어오면 방이 찬다(그 사이 방장은 새 방을 만들 수 없다)');
    // 방이 받지 못하면 되돌린다.
    undoArenaLive(state, joined.message);
    assert(!state.arenaInvites[0].guest_id, 'V13.230 방이 들어오기를 받지 못하면 메인 기록을 되돌린다');
    arenaLiveJoin(state, P('b'), { who, pets: mine, id: 'room-1', now: DAY0 + 1000 });
    // 끝 보고: 방이 말한 승패가 아니라 두 조작 기록으로 다시 돌린 결과로 정산한다.
    const x = liveMatch({ seed: 31 });
    const body = { ...liveReport(x.r), id: 'room-1', players: ['a', 'b'], room: { ...x.r.result, winner: x.r.result.winner === 'me' ? 'foe' : 'me' } };
    assert(arenaLivePending(state, body), 'V13.230 아직 정산하지 않은 방의 보고만 처리한다');
    const logs = [];
    const out = settleArenaLive(state, body, { profileOf: P, who, log: (p, res) => logs.push(p.id), now: DAY0 + 200000 });
    const winA = x.server.winner === 'me';
    assert(out.hash === x.server.hash && out.results.a.win === winA && out.results.b.win === (x.server.winner === 'foe') && out.results.a.paid && out.results.b.paid && logs.join() === 'a,b' && !state.arenaInvites.length && !P('a').games.arena.live_room,
      `V13.230 끝 보고: 서버가 두 조작 기록으로 다시 돌려 승패 · 보상을 정한다(방이 말한 승패는 믿지 않음: ${x.server.winner})`);
    assert(out.results.a.coins === (winA ? ARENA.COINS.win : out.results.a.ko ? ARENA.COINS.lose : 0) && P('a').games.arena.tk === 4 && P('a').games.arena.plays === 1 && P('a').games.arena.pairs.n.b === 1,
      'V13.230 보상은 혼자 판과 같은 크기 · 입장권 · 하루 5판 합산, 같은 친구 판 수를 센다');
    assert(!arenaLivePending(state, body) && arenaLiveReceipts(state, body).results.a.again && settleArenaLive(state, body, { profileOf: P, who, now: DAY0 + 300000 }) === null,
      'V13.230 같은 판 보고를 다시 보내면(응답을 못 받음) 영수증으로 같은 결과, 두 번 정산하지 않는다');
    // 농사 막기: 같은 친구와는 하루 2판까지 코인.
    const settleAgain = (id, seed, extra = {}) => {
      state.arenaInvites.push({ id, code: '7' + seed, host_id: 'a', guest_id: 'b', school_id: 'g', grade: '고1', tickets: {}, at: DAY0 });
      const m = liveMatch({ seed, ...extra });
      return settleArenaLive(state, { ...liveReport(m.r), id, players: ['a', 'b'] }, { profileOf: P, who, now: DAY0 + 400000 + seed });
    };
    const second = settleAgain('room-2', 32), third = settleAgain('room-3', 33);
    assert(second.results.a.paid && !third.results.a.paid && third.results.a.reason === 'pair' && third.results.b.reason === 'pair' && P('a').games.arena.plays === 2,
      'V13.230 농사 막기: 같은 친구와 코인 판은 하루 2판까지, 그다음은 연습 판(기록만)');
    P('a').games.arena.pairs = { day: P('a').games.arena.pairs.day, n: {} }; P('b').games.arena.pairs = { ...P('a').games.arena.pairs, n: {} };
    const idle = settleAgain('room-4', 34, { idle: [false, true] });
    assert(!idle.results.a.paid && !idle.results.b.paid && idle.results.a.reason === 'idle', 'V13.230 져 주기 막기: 한쪽이 거의 조작하지 않으면(20개 미만 · 준 피해 0) 둘 다 보상 없음');
    const awayRes = settleAgain('room-5', 35, { away: { side: 1, from: 1_000_000 + 10000, to: 1_000_000 + 900000 } });
    assert(awayRes.results.b.reason === 'away' && awayRes.results.a.paid, 'V13.230 컴퓨터가 절반 넘게 대신 싸운 학생은 보상 없음(남은 친구는 정상)');
    P('b').class_name = '고2A';
    const graded = settleAgain('room-6', 36);
    assert(graded.results.a.reason === 'grade' && graded.results.b.reason === 'grade', 'V13.230 끝 보고 때도 같은 학년인지 다시 확인한다');
    P('b').class_name = '고1B';
    const cancel = { id: 'room-7', kind: 'cancel', players: ['a'] };
    state.arenaInvites.push({ id: 'room-7', code: '9999', host_id: 'a', guest_id: null, school_id: 'g', grade: '고1', tickets: {}, at: DAY0 });
    P('a').games.arena.live_room = { id: 'room-7', at: DAY0 };
    settleArenaLive(state, cancel, { profileOf: P, who, now: DAY0 });
    assert(!state.arenaInvites.length && !P('a').games.arena.live_room, 'V13.230 시작 못 하고 닫힌 방은 메인 기록 · 내 방 표시를 지운다');
    // 데이터 묶음 정리: 15분 지난 방은 지우고, 최대 200개.
    for (let i = 0; i < 250; i++) state.arenaInvites.push({ id: 'old' + i, code: String(1000 + i), host_id: 'z' + i, tickets: {}, at: DAY0 - (i < 100 ? 20 * 60000 : 0) });
    tidyArenaLive(state, DAY0);
    assert(state.arenaInvites.length === 150 && ARENA_LIVE.MAX === 200 && STATE_BUDGET_KB.arenaInvites === 20, 'V13.230 렉 방지: 열린 방 목록(arenaInvites)은 15분 지나면 지우고 최대 200개, 예산 20KB(perf-budget)');
    assert(arenaLiveDecline(state, P('b'), 'nope') === false && arenaView(P('a'), DAY0 + 500000).live_wins >= 0 && Object.keys(P('a').games.arena.pairs.n).length <= ARENA_LIVE.PAIRS_MAX,
      'V13.230 같은 친구 판 수는 오늘 것만 · 10줄까지(프로필 안)');
  }

  // 7) 렉 방지 · 연결 코드(정적).
  {
    const worker = source('../cloudflare/worker.mjs'), wrangler = source('../wrangler.jsonc'), svc = source('./service.mjs'), ui = source('../public/modules/arena.js'), app = source('../public/app.js'), room = source('../cloudflare/arena-room.mjs');
    assert(worker.includes("url.pathname.match(/^\\/api\\/arena\\/ws\\/([0-9a-f-]{36})$/)") && worker.includes('env.ARENA_ROOM.get(env.ARENA_ROOM.idFromName(arenaSocket[1])).fetch(request)') && worker.indexOf('arenaSocket') < worker.indexOf("const id = env.VOCA_STATE.idFromName('main');\n      // V13.144"),
      'V13.230 렉 방지 규칙 6: 판 도중 조작(WebSocket)은 방 객체로 바로 가고 메인 상태 객체를 거치지 않는다');
    assert(worker.includes('export { ArenaRoom };') && worker.includes("'X-Arena-Key'") && worker.includes('delete result._arena') && worker.includes('undoArenaLive(state, message)') && worker.includes('settleArenaReport(state, body)')
      && wrangler.includes('"name": "ARENA_ROOM"') && /"tag": "v5",\s*"new_sqlite_classes": \[\s*"ArenaRoom"/.test(wrangler) && (wrangler.match(/ARENA_ROOM/g) || []).length === 2,
      'V13.230 워커: 아레나 방 바인딩(운영 · 테스트 앱) · v5 마이그레이션 · 끝 보고는 키가 있어야 · 방이 거절하면 되돌림');
    assert(['/games/arena/live/friends', '/games/arena/live/current'].every(p => svc.includes(`path === '${p}' && method === 'GET'`)) && svc.includes("arena_invite: arenaLiveInviteFor(state, p, Date.now())") && !/setInterval\([^)]*api\('\/games\/arena\/live/.test(ui),
      'V13.230 보기는 GET(친구 목록 · 내 방), 초대는 기존 20초 확인(/battle/invite)에 싣는다(새 자동 새로고침 없음)');
    const liveTickFn = ui.slice(ui.indexOf('function liveTick('), ui.indexOf('function drawNet('));
    assert(ui.includes('}, 20000);') && ui.includes('L.invitePoll = setInterval(') && ui.includes("await api('/battle/invite')") && ui.includes('if (R?.live !== L || ++n > 9)') && !liveTickFn.includes('api(') && app.includes('arena_invite: arenaInvite'),
      'V13.230 결과 화면의 "한 판 더" 초대 확인도 20초 간격 GET(화면이 보일 때만, 3분까지)');
    assert(ARENA_SAVE_EVERY_MS === 5000 && room.includes('this.dirty && now - this.savedAt >= ARENA_SAVE_EVERY_MS') && !room.includes('arenaLive') && room.includes('LIVE.MSG_MAX'),
      'V13.230 방은 조작마다 저장하지 않는다(5초마다 한 번), 512바이트 넘는 메시지는 버린다');
  }
}

/* ---------- 방 객체 흐름 ---------- */
function fakeSocket() { return { readyState: 1, tags: [], sent: [], send(text) { this.sent.push(JSON.parse(text)); }, close(code) { this.readyState = 3; this.closedWith = code; } }; }
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
async function roomFlow(assert) {
  const realNow = Date.now, RealResponse = globalThis.Response, realPair = globalThis.WebSocketPair;
  let clock = 20_000_000;
  Date.now = () => clock;
  globalThis.WebSocketPair = function () { return { 0: fakeSocket(), 1: fakeSocket() }; };
  globalThis.Response = class extends RealResponse { constructor(body, init = {}) { if (init.status === 101) { super(null, { status: 200 }); this.upgraded = init.webSocket; return; } super(body, init); } };
  const reports = [];
  let reportOk = false;
  const env = { VOCA_STATE_SECRET: 'test-secret', VOCA_STATE: { idFromName: n => n, get: () => ({ fetch: async (url, init) => {
    const body = JSON.parse(init.body);
    reports.push({ url, key: init.headers['X-Arena-Key'], body });
    return new RealResponse(JSON.stringify({ ok: true, results: { h: { win: true, paid: true, coins: 12 }, g: { win: false, paid: true, coins: 4 } } }), { status: reportOk ? 200 : 503 });
  } }) } };
  try {
    const ctx = fakeCtx(), room = new ArenaRoom(ctx, env, { timers: false });
    room.random = () => 0.25;
    await room.ready;
    const admin = msg => room.admin({ id: 'arena-1', ...msg }).then(res => res.json().then(body => ({ status: res.status, ...body })));
    assert((await admin({ action: 'init', code: '4321', host: { id: 'h', name: '가온', ticket: 'th', pets: [['dog', 2, 12], ['bear', 2, 11], ['fox', 2, 10]] } })).ok, 'V13.230 방 객체: 메인이 방을 만든다');
    assert((await admin({ action: 'init', code: '1', host: {} })).status === 409 && (await admin({ action: 'join', player: { id: 'g', name: '나래', ticket: 'tg', pets: [['cat', 2, 12], ['owl', 2, 11]] } })).ok, 'V13.230 방 객체: 같은 방은 두 번 못 만들고, 친구가 들어온다');
    assert((await room.accept(new URL('https://arena/ws?ticket=nope'))).status === 403, 'V13.230 입장표가 틀리면 방에 들어갈 수 없다');
    await room.accept(new URL('https://arena/ws?ticket=th')); await room.accept(new URL('https://arena/ws?ticket=tg'));
    const ws = { h: ctx.getWebSockets('p0').at(-1), g: ctx.getWebSockets('p1').at(-1) };
    const send = (who, msg) => room.webSocketMessage(ws[who], typeof msg === 'string' ? msg : JSON.stringify(msg));
    const last = (who, type) => ws[who].sent.filter(m => m.type === type).at(-1);
    assert(last('h', 'lobby').view.seats[1]?.name === '나래' && last('g', 'lobby').view.side === 1, 'V13.230 대기실: 두 학생이 같은 방을 본다(내 자리 · 친구 자리)');
    await send('g', { type: 'set', team: ['owl', 'cat'], s2: { owl: 1 }, ready: true });
    await send('g', { type: 'start' });
    assert(room.room.phase === 'lobby' && last('g', 'error')?.error, 'V13.230 친구는 시작할 수 없다(방장만)');
    await send('h', { type: 'set', ready: true });
    await send('h', 'x'.repeat(LIVE.MSG_MAX + 1));
    await send('h', { type: 'start' });
    assert(room.room.phase === 'play' && last('h', 'go').side === 0 && last('g', 'go').side === 1 && last('g', 'go').teams[1][0][0] === 'owl' && last('g', 'go').teams[1][0][3] === 1 && last('h', 'go').seed === last('g', 'go').seed,
      'V13.230 시작: 두 폰에 같은 씨앗 · 두 팀(스킬 ② 포함) · 시작 시각 · 내 쪽을 보낸다');
    const writesAtStart = ctx.writes;
    // 판: 0.1초마다 맥박, 두 학생이 조작을 보낸다. 친구는 중간에 끊긴다.
    const start = room.room.start_at;
    let seq = { h: 1, g: 1 };
    for (clock = start; room.room.phase === 'play' && clock < start + 130000; clock += 100) {
      const t = Math.floor((clock - start) / ARENA.TICK_MS);
      if (t >= 0 && t % 4 === 0) {
        await send('h', { type: 'in', s: seq.h, l: [[t, 1 + (t >> 3) % 8], [t, INPUT.ATK]] }); seq.h += 2;
        if (clock < start + 30000 || clock > start + 50000) { await send('g', { type: 'in', s: seq.g, l: [[t, 1 + (t >> 4) % 8], [t, INPUT.ATK]] }); seq.g += 2; }
      }
      await room.pulse(clock);
    }
    const r = room.room;
    const net = ws.h.sent.filter(m => m.type === 'net');
    assert(r.phase === 'ended' && net.some(m => m.ai[1]) && net.some(m => !m.ai[1]) && r.ai_ticks[1] > 300 && r.inputs[1].some(x => x[1] === INPUT.AI_ON),
      `V13.230 방 객체: 친구가 3초 넘게 소식이 없으면 컴퓨터가 대신 · 다시 오면 돌려준다(${r.ai_ticks[1]}틱), 두 폰에 알린다`);
    const server = runArena({ seed: r.seed, me: unpackTeam(r.teams[0]), foe: unpackTeam(r.teams[1]), inputs: r.inputs[0], foeInputs: r.inputs[1] });
    const batches = ws.g.sent.filter(m => m.type === 'b');
    const phone = new LiveSim({ seed: r.seed, a: unpackTeam(r.teams[0]), b: unpackTeam(r.teams[1]), side: 1 });
    for (const b of batches) phone.confirm(b);
    assert(r.result.hash === server.hash && phone.conf.hash() === server.hash && !phone.bad && batches.every(b => JSON.stringify({ ...b, now: 0 }).length < 2000),
      `V13.230 방 객체: 확정 묶음만 받은 폰 = 방 = 서버(${server.winner}, ${server.ticks}틱, 묶음 ${batches.length}개)`);
    const writes = ctx.writes - writesAtStart;
    assert(writes <= Math.ceil(130000 / ARENA_SAVE_EVERY_MS) + 4, `V13.230 쓰기 한도: 한 판 저장 ${writes}번(조작마다가 아니라 5초마다)`);
    // 끝 보고: 실패하면 다시(점점 길게), 성공하면 두 폰에 정산 결과.
    assert(reports.length === 1 && reports[0].url.endsWith('/api/internal/arena-result') && reports[0].key === await arenaReportKey(env) && reports[0].body.kind === 'result' && reports[0].body.inputs.length === 2 && !r.reported && r.report_retry_at > clock,
      'V13.230 끝나면 두 조작 기록을 메인에 보고한다(키로 확인), 실패하면 다시 시도한다');
    reportOk = true; clock = r.report_retry_at + 1;
    await room.alarm();
    assert(room.room.reported && last('h', 'done').res.coins === 12 && last('g', 'done').res.coins === 4 && reports.length === 2, 'V13.230 보고가 되면 각 폰에 내 정산 결과(코인 · 이유)를 보낸다');
    clock += 10 * 60000 + 1; await room.alarm();
    assert(room.room === null && !ctx.store.size, 'V13.230 끝난 방은 10분 뒤 지운다');
    // 대기실 시간 초과: 5분 동안 시작하지 않으면 닫고 "취소"를 보고한다.
    const ctx2 = fakeCtx(), room2 = new ArenaRoom(ctx2, env, { timers: false });
    await room2.ready;
    await room2.admin({ id: 'arena-2', action: 'init', code: '1212', host: { id: 'h', name: '가온', ticket: 'x', pets: [['dog', 2, 1]] } });
    clock += LIVE.LOBBY_MS + 1; await room2.alarm();
    assert(room2.room.phase === 'closed' && room2.room.reason === 'timeout' && reports.at(-1).body.kind === 'cancel' && room2.room.reported, 'V13.230 시간 초과: 대기실 5분이 지나면 방을 닫고 메인에 알린다');
  } finally {
    Date.now = realNow; globalThis.Response = RealResponse; globalThis.WebSocketPair = realPair;
  }
}
