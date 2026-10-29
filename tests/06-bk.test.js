// PART 4 바나나킥: 서버와 폰이 같은 골키퍼 계산을 하는지(폰의 예측 = 서버 판정), 탈락전·점수전 흐름
const { assert, ask, waitFor, sleep, lastOf, createSession, hostFor, phone, phaseOf, COLORS } = require('./lib');
const BK = require('../public/bk-common.js');

// 폰 흉내: 서버와 같은 BK.Goalie 를 들고, 버튼 상태가 바뀐 시각(ts)을 그대로 보냄
// mode 'save' = 다음 공 도착 위치로 가서 멈춤, 'dodge' = 공 반대쪽 끝으로 가서 계속 누르고 있음(반드시 실점)
function keeper(p, mode) {
  const g = new BK.Goalie(); const shots = []; let dir = 0, timer = null; const judged = [];
  const press = (d) => { const t = Date.now(); if (d === dir) return; dir = d; g.press(d, t); p.emit('bk:in', { dir: d, ts: t }); };
  p.on('bk:phase', (ph) => { if (ph.phase === 'ready' || ph.phase === 'lobby') { g.reset(ph.resetAt); dir = 0; shots.length = 0; } });
  p.on('bk:shots', (m) => { for (const s of m.list) if (!shots.some(x => x.id === s.id)) shots.push(s); });
  p.on('bk:res', (r) => {
    const s = shots.find(x => x.id === r.id); if (!s) return;
    const mine = r.res.find(x => x[0] === p.pid); if (!mine) return; // 이미 탈락했으면 판정 대상 아님
    // 폰이 도착 순간 자기 위치로 미리 판정한 값
    const predicted = BK.judge(g.at(s.t1).x, BK.ballAt(s, s.t1).x);
    judged.push({ id: r.id, server: mine[1], out: mine[2], predicted, bx: r.bx, x1: s.x1 });
  });
  timer = setInterval(() => {
    const now = Date.now();
    const s = shots.filter(x => x.t1 > now).sort((a, b) => a.t1 - b.t1)[0];
    if (!s) return;
    const target = BK.ballAt(s, s.t1).x, st = g.at(now);
    if (mode === 'dodge') { press(target > 0 ? -1 : 1); return; }
    const diff = target - st.x, stopDist = (st.v * st.v) / (2 * BK.ACC) + Math.abs(st.v) * 0.012;
    if (dir !== 0) { if (Math.sign(diff) !== dir || Math.abs(diff) <= stopDist) press(0); }
    else if (Math.abs(diff) > 0.04 && Math.abs(st.v) < 0.05) press(diff > 0 ? 1 : -1);
  }, 4);
  return { g, shots, judged, stop: () => clearInterval(timer) };
}

module.exports = [
  { name: 'out mode: phone prediction == server judgement; saver wins "last", dodger out', timeout: 30000, async fn() {
    const s = await createSession({ first: 'bk', bk: { mode: 'out', time: 120 } });
    const h = await hostFor(s, 'bk');
    assert.equal(h.phase0.mode, 'out'); assert.equal(h.phase0.levels.length, 5);
    const a = await phone('bk', s.pin, '수문장', COLORS[0]);
    const b = await phone('bk', s.pin, '구멍', COLORS[1]);
    const ka = keeper(a, 'save'), kb = keeper(b, 'dodge');
    try {
      const ready = phaseOf(a, 'bk', (p) => p.phase === 'ready');
      const play = phaseOf(a, 'bk', (p) => p.phase === 'play', 7000);
      h.emit('bk:start');
      const rp = await ready; assert.ok(rp.readyRemain > 3500 && rp.resetAt > 0);
      const pp = await play; assert.equal(pp.playAt, rp.resetAt + 4200); assert.equal(pp.endsAt, 0);
      const shot = await waitFor(a, 'bk:shots', () => true, 5000);
      const s0 = shot.list[0];
      assert.ok(['octo', 'crab', 'turtle', 'puffer'].includes(s0.shooter));
      assert.ok(s0.t0 >= pp.playAt + 2600 && Math.abs(s0.t1 - s0.t0 - 1600) < 60, 'first kick timing');
      assert.ok(Math.abs(s0.x1) <= 0.88 && ['banana', 'straight'].includes(s0.kind));
      assert.equal(s0.judged, undefined);
      const end = await phaseOf(a, 'bk', (p) => p.phase === 'end', 15000);
      const res = end.result;
      assert.ok(ka.judged.length >= 1 && kb.judged.length >= 1);
      for (const j of [...ka.judged, ...kb.judged]) {
        assert.equal(j.server, j.predicted, 'server judgement must match phone sim: ' + JSON.stringify(j));
        assert.ok(Math.abs(j.bx - j.x1) < 0.0015);
      }
      assert.deepEqual([kb.judged[0].server, kb.judged[0].out], [0, 1]);
      const aSavedAll = ka.judged.every(j => j.server > 0);
      assert.ok(ka.judged[0].server > 0, 'saver should save the first shot: ' + JSON.stringify(ka.judged[0]));
      assert.equal(res.why, aSavedAll ? 'last' : 'out');
      assert.equal(res.mode, 'out');
      assert.deepEqual(res.ranking.map(e => e.id), [a.pid, b.pid]);
      assert.equal(res.ranking[1].goals, 1); assert.equal(res.ranking[1].alive, false);
      assert.ok(res.ranking[0].saves >= 1 && res.ranking[0].score >= 105);
      const L = await ask(h, 'league:get', null);
      assert.equal(L.rounds[0].kind, 'bk'); assert.equal(L.rounds[0].label, '탈락'); assert.equal(L.rounds[0].counted, true);
      assert.deepEqual(L.standings.map(x => [x.id, x.total]), [[a.pid, 10], [b.pid, 8]]);
    } finally { ka.stop(); kb.stop(); }
  } },

  { name: 'score mode: config time 60/120/180 only, goals do not eliminate, bots judged, stop → not counted', timeout: 30000, async fn() {
    const s = await createSession({ first: 'bk', bk: { mode: 'score', time: 60 } });
    const h = await hostFor(s, 'bk');
    assert.equal(h.phase0.mode, 'score'); assert.equal(h.phase0.time, 60);
    const c90 = waitFor(h, 'bk:phase', () => true); h.emit('bk:config', { time: 90 }); assert.equal((await c90).time, 60);
    const c180 = waitFor(h, 'bk:phase', () => true); h.emit('bk:config', { time: 180 }); assert.equal((await c180).time, 180);
    const c60 = waitFor(h, 'bk:phase', () => true); h.emit('bk:config', { time: 60, mode: 'score' }); assert.equal((await c60).time, 60);
    const a = await phone('bk', s.pin, '막기'), b = await phone('bk', s.pin, '놓침');
    const bots = waitFor(h, 'bk:roster', (r) => r.filter(p => p.bot).length === 3);
    h.emit('bk:bots', 3); await bots;
    const ka = keeper(a, 'save'), kb = keeper(b, 'dodge');
    try {
      const play = phaseOf(a, 'bk', (p) => p.phase === 'play', 7000);
      h.emit('bk:start');
      const pp = await play; assert.equal(pp.endsAt, pp.playAt + 60000);
      const r1 = await waitFor(a, 'bk:res', () => true, 8000);
      assert.equal(r1.res.length, 5, 'all 5 keepers judged (2 phones + 3 bots)');
      const rb = r1.res.find(x => x[0] === b.pid);
      assert.deepEqual(rb, [b.pid, 0, 0], 'score mode: goal but not out');
      await sleep(150); const ro = lastOf(a, 'bk:roster');
      assert.ok(ro.every(p => p.state === 'in'));
      const end = phaseOf(a, 'bk', (p) => p.phase === 'end');
      h.emit('bk:stop');
      const res = (await end).result;
      assert.equal(res.why, 'stop'); assert.equal(res.mode, 'score'); assert.equal(res.time, 60);
      for (let i = 1; i < res.ranking.length; i++) assert.ok(res.ranking[i - 1].score >= res.ranking[i].score, 'sorted by score');
      assert.equal(res.ranking.find(e => e.id === b.pid).score, 0);
      for (const j of [...ka.judged, ...kb.judged]) assert.equal(j.server, j.predicted, JSON.stringify(j));
      const L = await ask(h, 'league:get', null);
      assert.equal(L.rounds[0].label, '점수전 1분'); assert.equal(L.rounds[0].counted, false);
      assert.equal(L.rounds[0].entries.length, 5);
      // reset → 대기실로, 골키퍼 위치도 되돌림
      const lob = phaseOf(a, 'bk', (p) => p.phase === 'lobby'); h.emit('bk:reset'); assert.ok((await lob).resetAt > pp.playAt);
    } finally { ka.stop(); kb.stop(); }
  } },
];
