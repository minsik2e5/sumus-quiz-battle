// 테스트 공용 도구: 실제 socket.io-client 연결로 선생님 화면·학생 폰을 흉내 냄
const { io } = require('socket.io-client');
const assert = require('node:assert/strict');

const URL = () => process.env.SUMUS_TEST_URL;
const COLORS = ['#ff4d6d', '#3d7bff', '#22c55e', '#ffb020', '#a855f7', '#14b8a6', '#f97316', '#ec4899', '#64748b', '#0ea5e9'];
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// 한 테스트 안에서 연 소켓을 끝날 때 모두 닫기 위한 목록
const open = new Set();
function closeAll() { for (const s of open) { try { s.disconnect(); } catch (_) {} } open.clear(); }

// 접속 (폰 한 대 또는 선생님 화면 한 장 = 소켓 하나)
function connect() {
  return new Promise((resolve, reject) => {
    const s = io(URL(), { transports: ['websocket'], forceNew: true, reconnection: false, timeout: 5000 });
    open.add(s);
    // 받은 이벤트를 모두 기록 (나중에 "이 이벤트가 왔었는지" 확인용)
    s.log = [];
    s.onAny((ev, ...args) => { s.log.push({ ev, args, at: Date.now() }); if (s.log.length > 4000) s.log.splice(0, 1000); });
    const t = setTimeout(() => reject(new Error('connect timeout')), 6000);
    s.once('connect', () => { clearTimeout(t); resolve(s); });
    s.once('connect_error', (e) => { clearTimeout(t); reject(e); });
  });
}

// ack 가 있는 emit
function ask(s, ev, data, ms = 4000) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('ack timeout: ' + ev)), ms);
    s.emit(ev, data, (res) => { clearTimeout(t); resolve(res); });
  });
}

// 조건에 맞는 이벤트가 올 때까지 기다림 (먼저 걸어 두고 나서 동작을 일으킬 것)
function waitFor(s, ev, pred = () => true, ms = 5000) {
  return new Promise((resolve, reject) => {
    const fn = (...args) => { let ok = false; try { ok = pred(...args); } catch (_) {} if (ok) { clearTimeout(t); s.off(ev, fn); resolve(args[0]); } };
    const t = setTimeout(() => { s.off(ev, fn); reject(new Error('timeout waiting for ' + ev + ' (' + ms + 'ms)')); }, ms);
    s.on(ev, fn);
  });
}

// 일정 시간 동안 해당 이벤트가 오지 않아야 함
async function expectNone(s, ev, pred = () => true, ms = 400) {
  let got = null;
  const fn = (...a) => { if (pred(...a)) got = a[0]; };
  s.on(ev, fn); await sleep(ms); s.off(ev, fn);
  assert.equal(got, null, 'unexpected ' + ev + ': ' + JSON.stringify(got));
}

const KIND = {
  quiz: { join: 'player:join', resume: 'host:resume', phase: 'phase', roster: 'roster', path: '/play' },
  mg: { join: 'mg:join', resume: 'mg:resume', phase: 'mg:phase', roster: 'mg:roster', path: '/m' },
  jr: { join: 'jr:join', resume: 'jr:resume', phase: 'jr:phase', roster: 'jr:roster', path: '/j' },
  bk: { join: 'bk:join', resume: 'bk:resume', phase: 'bk:phase', roster: 'bk:roster', path: '/b' },
};

// 수업 방 만들기 (홈 화면 역할)
async function createSession(cfg) {
  const home = await connect();
  const r = await ask(home, 'sess:create', cfg || {});
  assert.equal(r.ok, true, 'sess:create failed: ' + JSON.stringify(r));
  home.disconnect(); open.delete(home);
  return r;
}

// 게임별 선생님 화면 (홈이 넘겨 준 열쇠로 resume)
async function hostFor(sess, kind) {
  const h = await connect();
  const ph = waitFor(h, KIND[kind].phase, () => true, 3000); // resume 직후 서버가 보내 주는 현재 상태
  const res = await ask(h, KIND[kind].resume, { pin: sess.pin, hostKey: sess[kind].hostKey });
  assert.equal(res.ok, true, kind + ' resume failed');
  h.phase0 = await ph;
  return h;
}

// 학생 폰 입장
async function phone(kind, pin, name, color, pid) {
  const s = await connect();
  s.ep = 0; s.on('tp', (d) => { s.ep = d.ep; });
  const ph = waitFor(s, KIND[kind].phase, () => true, 3000).catch(() => null); // 입장 직후 받는 현재 상태
  const res = await ask(s, KIND[kind].join, { pin, name, color, pid });
  s.join = res;
  if (res.ok) { s.pid = res.pid; s.ep = (res.pos && res.pos.ep) | 0; s.phase0 = await ph; }
  return s;
}

// 지금까지 받은 이벤트 중 마지막 것 (resume/join 직후 서버가 바로 보내 주는 상태 확인용)
function lastOf(s, ev) { for (let i = s.log.length - 1; i >= 0; i--) if (s.log[i].ev === ev) return s.log[i].args[0]; return undefined; }
// 다음에 오는 phase (조건 충족)
const phaseOf = (s, kind, pred, ms) => waitFor(s, KIND[kind].phase, pred, ms);

module.exports = { assert, connect, ask, waitFor, expectNone, sleep, closeAll, createSession, hostFor, phone, phaseOf, lastOf, KIND, COLORS, URL };
