// PART 3 단체 줄넘기: 계획(plan) 받기 → hit 에 맞춰 점프 → 판정 → 결과
const { assert, ask, waitFor, createSession, hostFor, phone, phaseOf, COLORS } = require('./lib');

// 받은 plan 의 모든 hit 에 맞춰 정점(air/2)에서 줄이 지나가도록 점프 예약
function autoJumper(p) {
  const timers = [];
  p.on('jr:plan', (plan) => {
    for (const t of plan.hits) {
      const at = t - (plan.air * 1000) / 2;
      timers.push(setTimeout(() => p.emit('jr:jump', { ts: Date.now() }), Math.max(0, at - Date.now())));
    }
  });
  return () => timers.forEach(clearTimeout);
}

module.exports = [
  { name: 'out mode: jumper passes (PERFECT), non-jumper out at first hit → "last", ranking', timeout: 25000, async fn() {
    const s = await createSession({ first: 'jr', jr: { mode: 'out', level: 1 } });
    const h = await hostFor(s, 'jr');
    const a = await phone('jr', s.pin, '점프왕', COLORS[1]);
    const b = await phone('jr', s.pin, '가만히', COLORS[2]);
    assert.deepEqual([a.join.me.slot, b.join.me.slot], [0, 1]);
    assert.equal(a.join.me.hearts, 1);
    const stop = autoJumper(a);
    try {
      const ready = phaseOf(a, 'jr', (p) => p.phase === 'ready');
      const plan = waitFor(b, 'jr:plan', () => true, 7000);
      h.emit('jr:start');
      const rp = await ready; assert.equal(rp.stage, 1); assert.ok(rp.readyRemain > 3500);
      const pl = await plan;
      assert.equal(pl.stage, 1); assert.equal(pl.stages, 6); assert.equal(pl.n, 8); assert.equal(pl.hits.length, 8);
      assert.equal(pl.air, 0.56); assert.equal(pl.rest, 0.18); assert.equal(pl.final, false);
      assert.ok(pl.hits[0] - pl.start === 1350 && pl.hits[1] - pl.hits[0] === 1350);
      const hit = await waitFor(b, 'jr:hit', (x) => x.i === 0, 5000);
      const ra = hit.res.find(r => r[0] === a.pid), rb = hit.res.find(r => r[0] === b.pid);
      assert.ok(ra[1] === 2 || ra[1] === 1, 'a should pass: ' + JSON.stringify(ra));
      assert.deepEqual(rb, [b.pid, 0, 1]);
      // 다른 학생 점프 연출 묶음
      assert.ok(b.log.some(e => e.ev === 'jr:j' && e.args[0].includes(a.pid)));
      const end = await phaseOf(a, 'jr', (p) => p.phase === 'end', 6000);
      const res = end.result;
      assert.equal(res.why, 'last'); assert.equal(res.mode, 'out');
      assert.deepEqual(res.ranking.map(e => e.id), [a.pid, b.pid]);
      assert.equal(res.ranking[0].alive, true); assert.ok(res.ranking[0].jumps >= 1 && res.ranking[0].score >= 105);
      assert.equal(res.ranking[1].outStage, 1); assert.equal(res.ranking[1].score, 0);
      const L = await ask(h, 'league:get', null);
      assert.equal(L.rounds[0].kind, 'jr'); assert.equal(L.rounds[0].label, '탈락'); assert.equal(L.rounds[0].counted, true);
    } finally { stop(); }
  } },

  { name: 'life mode: 3 hearts, shield after a miss; stop → why "stop"', timeout: 25000, async fn() {
    const s = await createSession({ first: 'jr', jr: { mode: 'out', level: 1 } });
    const h = await hostFor(s, 'jr');
    const a = await phone('jr', s.pin, '하트');
    const cfg = waitFor(a, 'jr:roster', (r) => r[0] && r[0].hearts === 3);
    h.emit('jr:config', { mode: 'life', level: 1 }); await cfg;
    const p0 = waitFor(a, 'jr:plan', () => true, 7000);
    h.emit('jr:start'); await p0;
    // 점프 안 함 → 첫 hit 에서 하트 -1 (탈락 아님)
    const h1 = await waitFor(a, 'jr:hit', (x) => x.i === 0, 5000);
    assert.deepEqual(h1.res[0], [a.pid, 0, 0]);
    // 늦게 들어온 학생은 관전
    const late = await phone('jr', s.pin, '늦게');
    assert.equal(late.join.me.state, 'out');
    const end = phaseOf(a, 'jr', (p) => p.phase === 'end');
    h.emit('jr:stop');
    const res = (await end).result;
    assert.equal(res.why, 'stop'); assert.equal(res.mode, 'life');
    assert.equal(res.ranking.find(e => e.id === a.pid).hearts, 2);
    const L = await ask(h, 'league:get', null);
    assert.equal(L.rounds[0].label, '하트 3개'); assert.equal(L.rounds[0].counted, false);
  } },
];
