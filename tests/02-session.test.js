// 수업 방(세션): 만들기·정보·입장·게임 전환(goto)·이름/색 이어받기, HTTP 주소
const http = require('node:http');
const { assert, connect, ask, waitFor, expectNone, createSession, hostFor, phone, phaseOf, lastOf, COLORS, URL } = require('./lib');

const get = (p) => new Promise((resolve, reject) => {
  http.get(URL() + p, (res) => { let b = ''; res.setEncoding('utf8'); res.on('data', d => (b += d)); res.on('end', () => resolve({ status: res.statusCode, type: res.headers['content-type'] || '', body: b })); }).on('error', reject);
});

module.exports = [
  { name: 'HTTP pages and /api/info respond', async fn() {
    for (const p of ['/', '/host', '/play', '/mg', '/m', '/jr', '/j', '/bk', '/b', '/control', '/bk-common.js', '/jr-common.js']) {
      const r = await get(p);
      assert.equal(r.status, 200, p + ' → ' + r.status);
    }
    assert.match((await get('/host')).body, /host-remote\.js/);
    const info = JSON.parse((await get('/api/info')).body);
    assert.ok(Array.isArray(info.ips));
    assert.equal(String(info.port), URL().split(':').pop());
    const qr = await get('/api/qr?text=hello');
    assert.equal(qr.status, 200); assert.match(qr.type, /image\/png/);
  } },

  { name: 'sess:create returns pin/key/creds for all 4 games; sess:info', async fn() {
    const s = await createSession({ first: 'jr', jr: { mode: 'life', level: 2 }, quiz: { questions: [{ text: 'Q', options: [{ text: 'a' }, { text: 'b' }], answer: 1 }] } });
    assert.match(s.pin, /^\d{4}$/);
    assert.equal(typeof s.key, 'string');
    assert.equal(s.active, 'jr');
    for (const k of ['quiz', 'mg', 'jr', 'bk']) { assert.equal(s[k].ok, true); assert.equal(s[k].pin, s.pin); assert.equal(typeof s[k].hostKey, 'string'); }
    const c = await connect();
    assert.deepEqual(await ask(c, 'sess:info', { pin: s.pin, key: s.key }), { ok: true, active: 'jr' });
    assert.deepEqual(await ask(c, 'sess:info', { pin: s.pin, key: 'nope' }), { ok: false });
    assert.deepEqual(await ask(c, 'sess:info', { pin: '0000', key: s.key }), { ok: false });
    // 세션 설정이 각 게임 방에 반영
    const jh = await hostFor(s, 'jr');
    const ph = lastOf(jh, 'jr:phase');
    assert.equal(ph.mode, 'life'); assert.equal(ph.startLevel, 2);
    // 잘못된 열쇠로는 resume 불가
    const bad = await connect();
    assert.deepEqual(await ask(bad, 'jr:resume', { pin: s.pin, hostKey: 'x' }), { ok: false });
  } },

  { name: 'student joins with name/color; errors for bad pin / empty name; redirect to active game', async fn() {
    const s = await createSession({ first: 'quiz' });
    const p = await phone('quiz', s.pin, '  김철수가아주긴이름  ', COLORS[3]);
    assert.equal(p.join.ok, true);
    assert.equal(p.join.me.name, '김철수가아주긴이'); // 8자로 자름
    assert.equal(p.join.me.color, COLORS[3]);
    assert.deepEqual(p.join.colors, COLORS);
    // 이상한 색이면 서버가 정해 줌
    const q = await phone('quiz', s.pin, '영희', '#000000');
    assert.ok(COLORS.includes(q.join.me.color));
    const e1 = await phone('quiz', s.pin, '   ', COLORS[0]);
    assert.equal(e1.join.ok, false); assert.ok(e1.join.error);
    const e2 = await phone('quiz', '99999', '누구');
    assert.equal(e2.join.ok, false); assert.ok(e2.join.error);
    // 지금 퀴즈를 하는 중이면 다른 게임 주소로 들어와도 /play 로 안내
    for (const k of ['mg', 'jr', 'bk']) {
      const r = await phone(k, s.pin, '민수');
      assert.equal(r.join.ok, false);
      assert.equal(r.join.redirect, '/play?pin=' + s.pin + '&auto=1');
    }
    // 같은 pid 로 다시 들어오면 같은 학생(이름 바꾸기 가능)
    const again = await phone('quiz', s.pin, '철수', '', p.pid);
    assert.equal(again.join.pid, p.pid); assert.equal(again.join.me.name, '철수'); assert.equal(again.join.me.color, COLORS[3]);
    const host = await hostFor(s, 'quiz');
    const roster = await new Promise(res => { host.emit('host:reset'); waitFor(host, 'roster').then(res); });
    assert.equal(roster.length, 2);
  } },

  { name: 'sess:switch through quiz→mg→jr→bk: phones get goto, name/color carried, in-progress game reset', timeout: 20000, async fn() {
    const s = await createSession({ first: 'quiz', mg: { dist: 2 }, quiz: { questions: [{ text: 'Q', options: [{ text: 'a' }, { text: 'b' }], answer: 0 }] } });
    const qh = await hostFor(s, 'quiz');
    const p = await phone('quiz', s.pin, '하늘', COLORS[5]);
    const pid = p.pid;

    // 학생이 아니라 다른 사람이 전환하려 하면 거절
    const stranger = await connect();
    assert.equal((await ask(stranger, 'sess:switch', 'mg')).ok, false);
    assert.equal((await ask(p, 'sess:switch', 'mg')).ok, false);

    let curHost = qh, curPhone = p;
    const order = [['quiz', 'mg'], ['mg', 'jr'], ['jr', 'bk'], ['bk', 'quiz']];
    for (const [from, to] of order) {
      const g = waitFor(curPhone, 'goto', () => true, 3000);
      const ack = await ask(curHost, 'sess:switch', to);
      assert.equal(ack.ok, true); assert.equal(ack.active, to);
      for (const k of ['quiz', 'mg', 'jr', 'bk']) assert.equal(ack[k].hostKey, s[k].hostKey, 'creds kept for ' + k);
      const KP = { quiz: '/play', mg: '/m', jr: '/j', bk: '/b' };
      assert.equal(await g, KP[to] + '?pin=' + s.pin + '&auto=1');
      const info = await ask(stranger, 'sess:info', { pin: s.pin, key: s.key });
      assert.equal(info.active, to);
      // 폰이 새 주소로 넘어가 이름 없이 pid 만으로 입장 → 이름·색 그대로
      curPhone.disconnect();
      curPhone = await phone(to, s.pin, '', '', pid);
      assert.equal(curPhone.join.ok, true, from + '→' + to + ' join: ' + JSON.stringify(curPhone.join));
      assert.equal(curPhone.join.pid, pid);
      assert.equal(curPhone.join.me.name, '하늘'); assert.equal(curPhone.join.me.color, COLORS[5]);
      curHost = await hostFor(s, to);
      // 지금 게임이 아닌 쪽 선생님 화면의 조작은 무시됨 (예: 퀴즈 화면이 뒤에서 진행시키지 않음)
      if (to !== 'quiz') { const none = expectNone(qh, 'phase', (ph) => ph.phase === 'question', 300); qh.emit('host:next'); await none; }
    }

    // 진행 중인 게임에서 다른 게임으로 바꾸면 그 게임은 대기실로 돌아감
    await ask(curHost, 'sess:switch', 'mg');
    const mh = await hostFor(s, 'mg');
    const mp = await phone('mg', s.pin, '', '', pid);
    assert.equal(mp.join.ok, true);
    const ready = phaseOf(mh, 'mg', (ph) => ph.phase === 'ready');
    mh.emit('mg:start');
    assert.equal((await ready).dist, 2);
    const lobby = phaseOf(mh, 'mg', (ph) => ph.phase === 'lobby');
    assert.equal((await ask(mh, 'sess:switch', 'jr')).ok, true);
    await lobby;
  } },
];
