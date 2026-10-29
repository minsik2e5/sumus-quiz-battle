// PART 2 무궁화: 설정(dist) → 카운트다운 → 달리다 술래에게 잡힘 → 결과
const { assert, ask, waitFor, createSession, hostFor, phone, phaseOf, COLORS } = require('./lib');

module.exports = [
  { name: 'dist setting from session cfg and mg:config (1 / 1.5 / 2, invalid → 1.5)', async fn() {
    const s = await createSession({ first: 'mg', mg: { dist: 2, level: 1, mode: 'out', time: 30 } });
    const h = await hostFor(s, 'mg');
    assert.equal(h.phase0.dist, 2); assert.equal(h.phase0.timeLimit, 30); assert.equal(h.phase0.mode, 'out');
    for (const [v, want] of [[1, 1], [1.5, 1.5], [7, 1.5], [2, 2]]) {
      const ph = phaseOf(h, 'mg', (p) => p.dist === want);
      h.emit('mg:config', { dist: v });
      assert.equal((await ph).dist, want);
    }
    const ph = phaseOf(h, 'mg', (p) => p.mode === 'back' && p.timeLimit === 300 && p.startLevel === 5);
    h.emit('mg:config', { mode: 'back', time: 999, level: 9 });
    await ph;
    // 아무도 없으면 시작 안 됨
    h.emit('mg:start');
    const none = await Promise.race([phaseOf(h, 'mg', (p) => p.phase === 'ready', 400).then(() => 'started'), new Promise(r => setTimeout(() => r('none'), 450))]).catch(() => 'none');
    assert.equal(none, 'none');
  } },

  { name: 'out mode: both runners caught when tagger looks → end "done", z scaled by dist 2', timeout: 25000, async fn() {
    const s = await createSession({ first: 'mg', mg: { dist: 2, level: 1, mode: 'out', time: 30 } });
    const h = await hostFor(s, 'mg');
    const a = await phone('mg', s.pin, '달리기', COLORS[2]);
    const b = await phone('mg', s.pin, '빨라', COLORS[4]);
    assert.equal(a.join.me.state, 'run');
    const ready = phaseOf(a, 'mg', (p) => p.phase === 'ready');
    const play = phaseOf(a, 'mg', (p) => p.phase === 'play', 6000);
    h.emit('mg:start');
    const rp = await ready; assert.ok(rp.readyRemain > 3000 && rp.readyRemain <= 3500);
    a.emit('mg:run', true); // 카운트다운 중에는 무시됨
    const pp = await play; assert.equal(pp.dist, 2); assert.equal(pp.remain > 28000, true);
    a.emit('mg:run', true); b.emit('mg:run', true);
    const caught = [];
    a.on('mg:caught', (c) => caught.push(c));
    const watch = waitFor(a, 'mg:w', (w) => w.main === 'look', 9000);
    const end = phaseOf(a, 'mg', (p) => p.phase === 'end', 12000);
    await watch;
    const res = (await end).result;
    assert.equal(res.why, 'done'); assert.equal(res.dist, 2);
    assert.deepEqual(caught.map(c => c.id).sort(), [a.pid, b.pid].sort());
    assert.ok(caught.every(c => c.back === false));
    assert.equal(res.ranking.length, 2);
    for (const e of res.ranking) {
      assert.equal(e.fin, false);
      // 레벨 1 은 약 5.6~6.1초 뒤 잡힘. 거리 2 → 0.031/초 → 약 17~19 (거리 1 이면 약 35)
      assert.ok(e.z >= 12 && e.z <= 24, 'z=' + e.z);
    }
    // 수업 방 리그에 반영 (정상 종료 → counted)
    const L = await ask(h, 'league:get', null);
    assert.equal(L.ok, true); assert.equal(L.rounds.length, 1);
    assert.equal(L.rounds[0].kind, 'mg'); assert.equal(L.rounds[0].label, '거리 아주 길게'); assert.equal(L.rounds[0].counted, true);
    // reset → 대기실, 모두 다시 달릴 수 있는 상태
    const lob = waitFor(a, 'mg:roster', (r) => r.every(p => p.state === 'run'));
    h.emit('mg:reset'); await lob;
  } },

  { name: 'stop mid-game → why "stop", league round not counted', timeout: 15000, async fn() {
    const s = await createSession({ first: 'mg', mg: { dist: 1, mode: 'back', time: 30 } });
    const h = await hostFor(s, 'mg');
    const a = await phone('mg', s.pin, '멈춰');
    const play = phaseOf(a, 'mg', (p) => p.phase === 'play', 6000);
    h.emit('mg:start'); await play;
    const end = phaseOf(a, 'mg', (p) => p.phase === 'end');
    h.emit('mg:stop');
    const res = (await end).result;
    assert.equal(res.why, 'stop');
    assert.equal(res.ranking[0].timeout, true); // 아직 달리는 중이던 학생은 시간초과 처리
    const L = await ask(h, 'league:get', null);
    assert.equal(L.rounds[0].counted, false); assert.equal(L.rounds[0].label, '거리 보통');
    assert.deepEqual(L.standings, []);
  } },
];
