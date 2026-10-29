// 오늘의 리그 (순위 점수 10/8/6/상위30% 4/참가 2, 멈춘 판 기본 미반영) + 봇 + SUMUS RECORD 알림(rec:new → rec:news)
const { assert, connect, ask, waitFor, expectNone, sleep, createSession, hostFor, phone, phaseOf, lastOf, COLORS } = require('./lib');

const pts = (rank, n) => (rank === 1 ? 10 : rank === 2 ? 8 : rank === 3 ? 6 : rank <= Math.ceil(n * 0.3) ? 4 : 2);
const ONE = [{ text: 'Q', options: [{ text: 'a' }, { text: 'b' }], answer: 0, time: 5 }];

// 퀴즈 한 판 빨리 끝내기: 문제 → 바로 공개 → 끝 (stop=true 면 문제 도중 host:finish)
async function quizRound(h, watcher, stop) {
  const q = phaseOf(watcher, 'quiz', (p) => p.phase === 'question'); h.emit('host:next'); await q;
  const upd = waitFor(watcher, 'league:update', () => true);
  const end = phaseOf(watcher, 'quiz', (p) => p.phase === 'end');
  if (stop) h.emit('host:finish'); else { const rv = phaseOf(watcher, 'quiz', (p) => p.phase === 'reveal'); h.emit('host:next'); await rv; h.emit('host:next'); }
  const res = (await end).result;
  const lg = await upd;
  const lob = phaseOf(watcher, 'quiz', (p) => p.phase === 'lobby'); h.emit('host:reset'); await lob;
  return { res, lg };
}

module.exports = [
  { name: 'bots: add/clear in all 4 games, bot flags and colors', async fn() {
    const s = await createSession({ first: 'quiz', quiz: { questions: ONE } });
    const kinds = [['quiz', 'host', 'roster'], ['mg', 'mg', 'mg:roster'], ['jr', 'jr', 'jr:roster'], ['bk', 'bk', 'bk:roster']];
    let h = await hostFor(s, 'quiz');
    for (const [k, pre, rosterEv] of kinds) {
      if (k !== 'quiz') { await ask(h, 'sess:switch', k); h = await hostFor(s, k); }
      const add = waitFor(h, rosterEv, (r) => r.length === 5);
      h.emit(pre + ':bots', 5);
      const r = await add;
      assert.ok(r.every(p => p.bot && p.connected && /\(봇\)$/.test(p.name) && COLORS.includes(p.color)), k + ' bots');
      const capped = waitFor(h, rosterEv, (x) => x.length === 35);
      h.emit(pre + ':bots', 999); await capped; // 한 번에 최대 30명
      const clr = waitFor(h, rosterEv, (x) => x.length === 0);
      h.emit(pre + ':clearbots'); await clr;
    }
  } },

  { name: 'league: rank points 10/8/6/top30% 4/participation 2, stopped round not counted, toggle/get', timeout: 20000, async fn() {
    const s = await createSession({ first: 'quiz', quiz: { questions: ONE, mode: 'score', gather: false, auto: false } });
    const h = await hostFor(s, 'quiz');
    const a = await phone('quiz', s.pin, '사람', COLORS[0]);
    const bots = waitFor(h, 'roster', (r) => r.length === 15);
    h.emit('host:bots', 14); await bots;

    const r1 = await quizRound(h, a, false);
    assert.equal(r1.res.ranking.length, 15);
    assert.equal(r1.lg.rounds.length, 1);
    const rd = r1.lg.rounds[0];
    assert.equal(rd.kind, 'quiz'); assert.equal(rd.name, 'PART 1 퀴즈쇼'); assert.equal(rd.label, '점수전'); assert.equal(rd.counted, true); assert.equal(rd.why, 'done');
    assert.deepEqual(rd.entries.map(e => e.rank), Array.from({ length: 15 }, (_, i) => i + 1));
    assert.deepEqual(rd.entries.map(e => e.pts), [10, 8, 6, 4, 4, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2]); // ceil(15*0.3)=5
    assert.deepEqual(rd.entries.map(e => e.id), r1.res.ranking.map(e => e.id));
    assert.equal(rd.entries.filter(e => e.bot).length, 14);

    const r2 = await quizRound(h, a, true); // 중간에 멈춘 판
    assert.equal(r2.res.why, 'stop');
    const rd2 = r2.lg.rounds[1];
    assert.equal(rd2.counted, false); assert.equal(rd2.why, 'stop');
    const me = (lg) => lg.standings.find(x => x.id === a.pid);
    const p1 = rd.entries.find(e => e.id === a.pid).pts, p2 = rd2.entries.find(e => e.id === a.pid).pts;
    assert.equal(me(r2.lg).total, p1, 'stopped round not added');
    assert.equal(me(r2.lg).played, 1);
    // 선생님이 멈춘 판도 반영하기로 바꿈
    const t = waitFor(a, 'league:update', (m) => m.rounds[1].counted === true);
    h.emit('league:toggle', { id: rd2.id, counted: true });
    const lt = await t;
    assert.equal(me(lt).total, p1 + p2); assert.equal(me(lt).played, 2);
    assert.equal(me(lt).by[rd.id], p1); assert.equal(me(lt).by[rd2.id], p2);
    // standings 는 total 내림차순, 총점 합 = 반영된 판의 점수 합
    for (let i = 1; i < lt.standings.length; i++) assert.ok(lt.standings[i - 1].total >= lt.standings[i].total);
    const sum = (arr) => arr.reduce((n, x) => n + x, 0);
    assert.equal(sum(lt.standings.map(x => x.total)), sum(rd.entries.map(e => e.pts)) + sum(rd2.entries.map(e => e.pts)));
    const golds = lt.standings.reduce((n, x) => n + x.golds, 0); assert.equal(golds, 2);
    const g = await ask(h, 'league:get', null);
    assert.equal(g.ok, true); assert.deepEqual(g.standings, lt.standings);
    // 학생·수업 방 밖 사람은 리그를 볼 수 없음
    assert.equal((await ask(a, 'league:get', null)).ok, false);
    assert.equal((await ask(await connect(), 'league:get', null)).ok, false);
  } },

  { name: 'league: points table for small rooms (n=1..4, 10, 11)', fn() {
    // 서버의 leaguePts 와 같은 규칙인지는 위 테스트의 entries 로 확인, 여기서는 경계값 표
    const table = (n) => Array.from({ length: n }, (_, i) => pts(i + 1, n));
    assert.deepEqual(table(1), [10]);
    assert.deepEqual(table(4), [10, 8, 6, 2]);
    assert.deepEqual(table(10), [10, 8, 6, 2, 2, 2, 2, 2, 2, 2]);
    assert.deepEqual(table(11), [10, 8, 6, 4, 2, 2, 2, 2, 2, 2, 2]);
  } },

  { name: 'league: 11-player round entries match the points rule (server side)', timeout: 15000, async fn() {
    const s = await createSession({ first: 'quiz', quiz: { questions: ONE, mode: 'score', gather: false, auto: false } });
    const h = await hostFor(s, 'quiz');
    const a = await phone('quiz', s.pin, '하나');
    const bots = waitFor(h, 'roster', (r) => r.length === 11); h.emit('host:bots', 10); await bots;
    const { lg } = await quizRound(h, a, false);
    assert.deepEqual(lg.rounds[0].entries.map(e => e.pts), [10, 8, 6, 4, 2, 2, 2, 2, 2, 2, 2]);
  } },

  { name: 'league: reset / restore (only when empty) / final → phones get league:final', timeout: 15000, async fn() {
    const s = await createSession({ first: 'quiz', quiz: { questions: ONE, mode: 'score', gather: false, auto: false } });
    const h = await hostFor(s, 'quiz');
    const a = await phone('quiz', s.pin, '정산', COLORS[6]);
    const b = await phone('quiz', s.pin, '친구', COLORS[7]);
    const { lg } = await quizRound(h, a, false);
    const saved = JSON.parse(JSON.stringify(lg.rounds)); // 선생님 브라우저의 사본
    // reset
    const rz = waitFor(a, 'league:update', (m) => m.rounds.length === 0);
    h.emit('league:reset'); const z = await rz; assert.deepEqual(z.standings, []);
    // restore (빈 리그 → 되살림), 이상한 값은 정리
    const bad = JSON.parse(JSON.stringify(saved)); bad[0].entries[0].pts = 99; bad[0].entries[0].color = 'red'; bad[0].entries[0].name = '아주아주긴이름입니다';
    const rr = await ask(h, 'league:restore', { rounds: bad });
    assert.equal(rr.ok, true); assert.equal(rr.rounds.length, 1);
    assert.equal(rr.rounds[0].entries[0].pts, 10); assert.equal(rr.rounds[0].entries[0].color, COLORS[0]); assert.equal(rr.rounds[0].entries[0].name.length, 8);
    assert.equal(rr.standings.length, 2);
    // 이미 기록이 있으면 restore 는 무시
    const rr2 = await ask(h, 'league:restore', { rounds: [{ id: 50, kind: 'mg', counted: true, entries: [{ id: 'x', name: 'x', rank: 1, pts: 10 }] }] });
    assert.equal(rr2.rounds.length, 1); assert.equal(rr2.rounds[0].kind, 'quiz');
    assert.equal((await ask(h, 'league:restore', null)).ok, false);
    // 다음 판 id 는 되살린 기록 다음 번호부터
    const { lg: lg2 } = await quizRound(h, a, false);
    assert.equal(lg2.rounds[1].id, saved[0].id + 1);
    // 최종 정산 → 모든 폰에 league:final
    const fa = waitFor(a, 'league:final'), fb = waitFor(b, 'league:final');
    h.emit('league:final');
    const [ma, mb] = await Promise.all([fa, fb]);
    assert.equal(ma.rounds.length, 2); assert.deepEqual(ma.standings, mb.standings);
    assert.deepEqual(ma.standings.map(x => x.id).sort(), [a.pid, b.pid].sort());
    // 학생이 보낸 league:final / reset 은 무시
    const nf = expectNone(b, 'league:final', () => true, 300); a.emit('league:final'); a.emit('league:reset'); await nf;
    assert.equal((await ask(h, 'league:get', null)).rounds.length, 2);
  } },

  { name: 'non-session room (host:create without session key) records no league', timeout: 10000, async fn() {
    const h = await connect();
    const r = await ask(h, 'host:create', { questions: ONE, mode: 'score', auto: false, gather: false });
    assert.equal(r.ok, true);
    const a = await phone('quiz', r.pin, '혼자');
    const q = phaseOf(a, 'quiz', (p) => p.phase === 'question'); h.emit('host:next'); await q;
    const rv = phaseOf(a, 'quiz', (p) => p.phase === 'reveal'); h.emit('host:next'); await rv;
    const none = expectNone(a, 'league:update', () => true, 300);
    const end = phaseOf(a, 'quiz', (p) => p.phase === 'end'); h.emit('host:next'); await end; await none;
    assert.equal((await ask(h, 'league:get', null)).ok, false);
    assert.equal((await ask(h, 'sess:switch', 'mg')).ok, false);
  } },

  { name: 'rec:new from host → rec:news on phones and other game screens (sanitized); ignored from phones', async fn() {
    const s = await createSession({ first: 'quiz', quiz: { questions: ONE } });
    const h = await hostFor(s, 'quiz');
    const mh = await hostFor(s, 'mg'); // 같은 수업 방의 다른 게임 화면
    const a = await phone('quiz', s.pin, '기록왕');
    const na = waitFor(a, 'rec:news'), nm = waitFor(mh, 'rec:news');
    h.emit('rec:new', { kind: 'jr', label: '최고 단계', value: '6단계', prev: '5단계 (지난주)', name: '아주아주긴이름입니다', id: a.pid, extra: 'x' });
    const [ma, mm] = await Promise.all([na, nm]);
    assert.deepEqual(ma, { kind: 'jr', label: '최고 단계', value: '6단계', prev: '5단계 (지난주)', name: '아주아주긴이름입', id: a.pid });
    assert.deepEqual(mm, ma);
    const none = expectNone(a, 'rec:news', () => true, 300);
    a.emit('rec:new', { kind: 'quiz', value: 'fake' });
    h.emit('rec:new', null);
    await none;
  } },
];
