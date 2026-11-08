// V13.230 실시간 1:1 흉내(검사용, server/arena-check.mjs): 방(server/arena-live.mjs) + 두 폰(public/modules/arena-live.js LiveSim)을
//   지연 · 끊김과 함께 한 판 끝까지 돌린다. 방 · 두 폰 · 서버가 다시 돌린 결과가 같은지 본다.
import { ARENA, INPUT, fighter, runArena, rng } from '../public/modules/arena-rules.js';
import { LiveSim, LIVE } from '../public/modules/arena-live.js';
import { createLive, joinLive, lobbySet, startLive, acceptInputs, touchLive, flushLive, liveSim, unpackTeam } from './arena-live.mjs';

const pets = keys => keys.map((k, i) => [k, 2, 10 + i]);
// 흉내 학생: 몇 틱마다 방향을 바꾸고 공격 · 스킬 · 회피를 누른다(씨앗대로).
function botInput(rand, t) {
  const out = [];
  if (t % 9 === 0) out.push([t, 1 + Math.floor(rand() * 8)]);
  if (rand() < 0.18) out.push([t, INPUT.ATK]);
  if (rand() < 0.02) out.push([t, INPUT.SKILL, Math.floor(rand() * 16)]);
  if (rand() < 0.015) out.push([t, INPUT.SKILL2]);
  if (rand() < 0.01) out.push([t, INPUT.DODGE]);
  if (rand() < 0.01) out.push([t, INPUT.ULT, Math.floor(rand() * 16)]);
  return out;
}

// lag: 폰마다 편도 지연(ms), jitter: 흔들림, away: { side, from, to } 그 사이 그 폰은 끊김(보내지도 받지도 않음).
export function liveMatch({ seed = 7, lag = [60, 140], jitter = 40, away = null, idle = [false, false], teams = [['dog', 'bear', 'dragon'], ['cat', 'pig', 'owl']] } = {}) {
  let now = 1_000_000;
  const r = createLive({ id: 'live-1', code: '1234', host: { id: 'h', name: '방장', ticket: 't0', pets: pets(teams[0]) }, now });
  joinLive(r, { id: 'g', name: '친구', ticket: 't1', pets: pets(teams[1]) }, now);
  lobbySet(r, 0, { ready: true }); lobbySet(r, 1, { aim: 'easy', ready: true });
  startLive(r, 0, now, seed);
  const sim = liveSim(r);
  const fs = list => list.map(([key, form, level, s2]) => fighter({ key, form, level, s2 }));
  const cl = [0, 1].map(side => ({ side, ls: new LiveSim({ seed: r.seed, a: fs(r.teams[0]), b: fs(r.teams[1]), side }), next: 1, rand: rng(seed * 31 + side), inbox: [] }));
  const net = rng(seed * 7 + 3), toRoom = [];
  // 웹소켓은 순서를 지킨다: 흔들려도 먼저 보낸 것이 먼저 닿는다.
  const lastAt = { up: [0, 0], down: [0, 0] };
  const delay = (side, way = 'down') => { const at = Math.max(now + lag[side] + Math.floor(net() * jitter), lastAt[way][side]); lastAt[way][side] = at; return at - now; };
  const off = side => away && away.side === side && now >= away.from && now < away.to;
  let pulseAt = now, sendAt = now, wasAway = false, maxRewind = 0;
  while (r.phase === 'play' && now < r.start_at + (ARENA.MAX_TICKS + 40) * ARENA.TICK_MS) {
    now += 10;
    // 방으로 가는 조작
    for (let i = toRoom.length - 1; i >= 0; i--) if (toRoom[i].at <= now) { const m = toRoom.splice(i, 1)[0]; acceptInputs(r, m.side, m.s, m.l, now); }
    // 폰: 받은 묶음 → 확정, 내 틱까지 앞서 돌리기
    for (const c of cl) {
      if (off(c.side)) continue;
      if (away && away.side === c.side && wasAway && now >= away.to) { wasAway = false; touchLive(r, c.side, now); c.ls.full({ u: r.upto, ia: r.inputs[0], ib: r.inputs[1] }); c.inbox = []; c.next = c.ls.pending[0]?.[0] || c.ls.seq + 1; }
      for (let i = 0; i < c.inbox.length;) { if (c.inbox[i].at <= now) c.ls.confirm(c.inbox.splice(i, 1)[0].b); else i++; }
      const want = Math.floor((now - r.start_at) / ARENA.TICK_MS);
      while (c.ls.pred.S.t < want && c.ls.canStep()) {
        if (!idle[c.side]) for (const x of botInput(c.rand, c.ls.pred.S.t)) c.ls.local(x);
        c.ls.step();
      }
      maxRewind = Math.max(maxRewind, c.ls.maxRewind);
    }
    if (away && now >= away.from && now < away.to) wasAway = true;
    if (now - sendAt >= LIVE.SEND_MS) {
      sendAt = now;
      for (const c of cl) {
        if (off(c.side)) continue;
        const list = c.ls.pending.filter(([s]) => s >= c.next).slice(0, LIVE.BATCH_MAX);
        if (list.length) { toRoom.push({ side: c.side, s: list[0][0], l: list.map(([, x]) => x), at: now + delay(c.side, 'up') }); c.next = list.at(-1)[0] + 1; }
        else if (now % 1000 < 10) toRoom.push({ side: c.side, s: c.ls.seq + 1, l: [], at: now + delay(c.side, 'up') }); // 핑
      }
    }
    if (now - pulseAt >= LIVE.PULSE_MS) {
      pulseAt = now;
      const b = flushLive(r, sim, now);
      if (b) for (const c of cl) if (!off(c.side)) c.inbox.push({ at: now + delay(c.side), b: JSON.parse(JSON.stringify(b)) });
    }
  }
  // 남은 묶음을 다 받는다.
  for (const c of cl) { for (const m of c.inbox) c.ls.confirm(m.b); }
  const server = runArena({ seed: r.seed, me: unpackTeam(r.teams[0]), foe: unpackTeam(r.teams[1]), inputs: r.inputs[0], foeInputs: r.inputs[1] });
  return { r, server, room: r.result, phones: cl.map(c => ({ over: c.ls.conf.S.over, winner: c.ls.conf.S.winner, hash: c.ls.conf.hash(), view: c.ls.S, mine: c.ls.mine() })), maxRewind, bad: cl.some(c => c.ls.bad) };
}
