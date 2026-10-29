// PART 1 퀴즈쇼: 문제 → 구역으로 이동 → 정답 공개 → 결과(순위)
const { assert, ask, waitFor, sleep, createSession, hostFor, phone, phaseOf, lastOf, COLORS } = require('./lib');

const Q = (text, answer, n = 2) => ({ text, options: Array.from({ length: n }, (_, i) => ({ text: 'opt' + i })), answer, time: 5 });

// 폰이 직접 계산한 위치를 보고 (서버는 최대 속도로만 따라옴)
async function walkTo(p, x, y, ms = 900) {
  const end = Date.now() + ms;
  while (Date.now() < end) { p.emit('p', [x, y, 1, 1, p.ep]); await sleep(25); }
  p.emit('p', [x, y, 1, 0, p.ep]);
}

module.exports = [
  { name: 'survival: wrong answer eliminated, last survivor wins, ranking + hostinfo', timeout: 15000, async fn() {
    const s = await createSession({ first: 'quiz', quiz: { questions: [Q('Q1', 1), Q('Q2', 0)], mode: 'survival', gather: false, auto: false } });
    const h = await hostFor(s, 'quiz');
    const a = await phone('quiz', s.pin, '에이', COLORS[0]);
    const b = await phone('quiz', s.pin, '비', COLORS[1]);
    assert.equal(lastOf(a, 'phase').phase, 'lobby');
    assert.equal(lastOf(a, 'phase').total, 2);

    const info = waitFor(h, 'hostinfo', (i) => i.answer === 1);
    const q1 = phaseOf(a, 'quiz', (ph) => ph.phase === 'question');
    h.emit('host:next');
    const ph1 = await q1;
    assert.equal(ph1.qIndex, 0); assert.equal(ph1.q.text, 'Q1'); assert.equal(ph1.q.options.length, 2);
    assert.equal(ph1.zones.length, 2); assert.ok(ph1.remain > 3000 && ph1.remain <= 5000);
    assert.equal(ph1.q.answer, undefined, 'answer must not be sent to phones');
    const hi = await info; assert.equal(hi.next.text, 'Q2'); assert.equal(hi.left, 1);

    const [zA, zB] = [ph1.zones[1], ph1.zones[0]];
    await Promise.all([walkTo(a, zA.x, zA.y), walkTo(b, zB.x, zB.y)]);

    const rev = phaseOf(b, 'quiz', (ph) => ph.phase === 'reveal');
    h.emit('host:next'); // 시간 전에 정답 공개
    const r = (await rev).reveal;
    assert.equal(r.correct, 1);
    assert.deepEqual(r.counts, [1, 1]);
    assert.deepEqual(r.eliminated, [b.pid]);
    assert.equal(r.saved, false);

    const end = phaseOf(a, 'quiz', (ph) => ph.phase === 'end');
    h.emit('host:next'); // 1명만 남았으므로 끝
    const res = (await end).result;
    assert.equal(res.why, 'done'); assert.equal(res.mode, 'survival');
    assert.deepEqual(res.survivors, [a.pid]);
    assert.deepEqual(res.ranking.map(e => e.id), [a.pid, b.pid]);
    assert.equal(res.ranking[0].score, 100); assert.equal(res.ranking[0].correct, 1); assert.equal(res.ranking[0].alive, true);
    assert.equal(res.ranking[1].alive, false); assert.equal(res.ranking[0].name, '에이');
  } },

  { name: 'survival: everyone wrong → everyone saved', timeout: 15000, async fn() {
    const s = await createSession({ first: 'quiz', quiz: { questions: [Q('Q1', 0), Q('Q2', 0)], gather: false, auto: false } });
    const h = await hostFor(s, 'quiz');
    const a = await phone('quiz', s.pin, '가'), b = await phone('quiz', s.pin, '나');
    const q1 = phaseOf(a, 'quiz', (ph) => ph.phase === 'question'); h.emit('host:next'); const ph = await q1;
    await Promise.all([walkTo(a, ph.zones[1].x, ph.zones[1].y), walkTo(b, ph.zones[1].x, ph.zones[1].y)]);
    const rev = phaseOf(a, 'quiz', (p) => p.phase === 'reveal'); h.emit('host:next');
    const r = (await rev).reveal;
    assert.equal(r.saved, true); assert.deepEqual(r.eliminated, []); assert.equal((await rev).alive, 2);
  } },

  { name: 'score mode with 3 questions + auto timer off; ranking by score; reset back to lobby', timeout: 20000, async fn() {
    const s = await createSession({ first: 'quiz', quiz: { questions: [Q('Q1', 0, 4), Q('Q2', 3, 4), Q('Q3', 2, 3)], mode: 'score', gather: true, auto: false } });
    const h = await hostFor(s, 'quiz');
    const a = await phone('quiz', s.pin, 'A'), b = await phone('quiz', s.pin, 'B');
    // a 는 모두 맞힘, b 는 첫 문제만 맞힘
    const plan = [[0, 0], [3, 0], [2, 0]];
    for (let i = 0; i < 3; i++) {
      const tp = waitFor(a, 'tp'); // gather=true → 출발 위치로 모음(ep 증가)
      const q = phaseOf(a, 'quiz', (ph) => ph.phase === 'question' && ph.qIndex === i); h.emit('host:next');
      const ph = await q; await tp;
      assert.equal(ph.zones.length, i === 2 ? 3 : 4);
      const za = ph.zones[plan[i][0]], zb = ph.zones[plan[i][1]];
      await Promise.all([walkTo(a, za.x, za.y), walkTo(b, zb.x, zb.y)]);
      const rv = phaseOf(a, 'quiz', (p) => p.phase === 'reveal'); h.emit('host:next');
      const r = (await rv).reveal;
      assert.deepEqual(r.eliminated, [], 'score mode never eliminates');
      assert.equal(r.correct, plan[i][0]);
      assert.equal((await rv).autoRemain, 0);
    }
    const end = phaseOf(a, 'quiz', (ph) => ph.phase === 'end'); h.emit('host:next');
    const res = (await end).result;
    assert.equal(res.mode, 'score');
    assert.deepEqual(res.ranking.map(e => [e.id, e.score]), [[a.pid, 300], [b.pid, 100]]);
    const lobby = phaseOf(a, 'quiz', (ph) => ph.phase === 'lobby'); h.emit('host:reset');
    assert.equal((await lobby).qIndex, -1);
  } },

  { name: 'host:live inserts an instant question; host:finish stops early', timeout: 15000, async fn() {
    const s = await createSession({ first: 'quiz', quiz: { questions: [], auto: false, gather: false } });
    const h = await hostFor(s, 'quiz');
    const a = await phone('quiz', s.pin, 'A');
    assert.equal((await ask(h, 'host:live', { text: '', options: [{ text: 'x' }] })).ok, false);
    const q = phaseOf(a, 'quiz', (ph) => ph.phase === 'question');
    assert.equal((await ask(h, 'host:live', { text: '', options: [{ text: 'O' }, { text: 'X' }], answer: 1, time: 5 })).ok, true);
    const ph = await q; assert.equal(ph.total, 1); assert.equal(ph.q.options[1].text, 'X');
    assert.equal((await ask(h, 'host:live', { text: 'again', options: [{ text: 'O' }, { text: 'X' }] })).ok, false); // 진행 중엔 불가
    const end = phaseOf(a, 'quiz', (p) => p.phase === 'end'); h.emit('host:finish');
    assert.equal((await end).result.why, 'stop');
    h.emit('host:finish'); // 결과 화면에서 한 번 더 눌러도 리그에 두 번 쌓이면 안 됨
    assert.equal((await ask(h, 'league:get', null)).rounds.length, 1);
  } },
];
