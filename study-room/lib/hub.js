'use strict';

// 실행 환경(Node 서버, Cloudflare Durable Object)과 상관없는 공부방 서버 로직.
// 연결(conn)은 { send(text), close(code, reason), meta } 모양이면 된다.

const crypto = require('crypto');
const { Academy, AcademyError, ALL } = require('./academy');

const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_FAILS = 8;
const MAX_BODY_CHARS = 16 * 1024;
const MAX_MESSAGE_CHARS = 4096;
const IDLE_CONN_MS = 90 * 1000; // 학생 화면은 30초마다 ping을 보낸다
const STATUS = { bad_request: 400, unauthorized: 401, not_found: 404, conflict: 409, limit: 429 };

function safeEqual(a, b) {
  const A = String(a);
  const B = String(b);
  let diff = A.length ^ B.length;
  for (let i = 0; i < Math.max(A.length, B.length); i += 1) diff |= (A.charCodeAt(i) || 0) ^ (B.charCodeAt(i) || 0);
  return diff === 0;
}

function sameOrigin(origin, host) {
  if (!origin) return true;
  try {
    return new URL(origin).host.toLowerCase() === String(host || '').toLowerCase();
  } catch {
    return false;
  }
}

// 선생님 키: 비밀 값(teacherKey) 또는 공개 저장소에 둘 수 있는 SHA-256 해시(teacherKeyHash) 중 하나와 맞으면 통과
function teacherKeyMatches(given, teacherKey, teacherKeyHash) {
  if (!given) return false;
  if (teacherKey && safeEqual(given, teacherKey)) return true;
  if (teacherKeyHash) return safeEqual(crypto.createHash('sha256').update(given).digest('hex'), String(teacherKeyHash).toLowerCase());
  return false;
}

function createHub({ store, teacherKey, teacherKeyHash, now = () => Date.now(), log = () => {} }) {
  const conns = new Set();
  const loginFails = new Map();

  function send(conn, msg) {
    try {
      conn.send(JSON.stringify(msg));
    } catch {
      // 이미 끊긴 연결
    }
  }

  // 우리 반 보기면 같은 반 학생만, 학원 전체 보기면 접속 중인 학생 모두를 받는다.
  function sees(conn, member) {
    if (conn.meta.view === 'all') return true;
    return conn.meta.classCode === member.classCode;
  }

  function each(fn) {
    for (const conn of conns) if (conn.meta.studentId) fn(conn);
  }

  const academy = new Academy(store, {
    now,
    onMember(member) {
      each((conn) => {
        if (conn.meta.studentId === member.id) send(conn, { t: 'me', me: academy.me(member.id) });
        if (conn.meta.view === 'all' && member.status === 'offline') send(conn, { t: 'remove', id: member.id });
        else if (sees(conn, member)) send(conn, { t: 'member', m: member });
      });
    },
    onRemove(id, classCode, deleted) {
      each((conn) => {
        if (conn.meta.studentId === id) {
          if (deleted) {
            send(conn, { t: 'kicked' });
            conn.close(4001, 'removed');
          } else {
            conn.meta.classCode = academy.data.students[id].classCode;
            sendWelcome(conn);
          }
        } else if (conn.meta.classCode === classCode || conn.meta.view === 'all') {
          send(conn, { t: 'remove', id });
        }
      });
    },
    onCheer(event) {
      const target = academy.data.students[event.to];
      each((conn) => {
        if (conn.meta.studentId === event.to || (target && sees(conn, target))) send(conn, { t: 'cheer', ...event });
      });
    },
    onCamStopped(id) {
      each((conn) => { if (conn.meta.studentId === id) send(conn, { t: 'cam_stopped' }); });
    },
    onCheckMissed(id) {
      each((conn) => { if (conn.meta.studentId === id) send(conn, { t: 'check_missed' }); });
    },
    onNotice() {
      each((conn) => send(conn, { t: 'notices', notices: academy.noticesFor(conn.meta.classCode) }));
    }
  });

  function sendWelcome(conn) {
    const id = conn.meta.studentId;
    const s = academy.data.students[id];
    const cls = academy.getClass(s.classCode);
    send(conn, {
      t: 'welcome',
      serverNow: now(),
      view: conn.meta.view,
      me: academy.me(id),
      className: cls ? cls.name : '',
      members: academy.roomMembers(conn.meta.view, s.classCode),
      notices: academy.noticesFor(s.classCode)
    });
  }

  // ---------- WebSocket ----------

  function connect(conn) {
    conn.meta = { studentId: null, classCode: null, view: 'class', lastMsg: now() };
    conns.add(conn);
  }

  function disconnect(conn) {
    if (!conns.delete(conn)) return;
    if (conn.meta.studentId) academy.detach(conn.meta.studentId);
  }

  function message(conn, text) {
    conn.meta.lastMsg = now();
    if (typeof text !== 'string' || text.length > MAX_MESSAGE_CHARS) return;
    let msg;
    try {
      msg = JSON.parse(text);
    } catch {
      return;
    }
    try {
      handle(conn, msg);
    } catch (err) {
      if (err instanceof AcademyError) send(conn, { t: 'error', msg: err.message, code: err.code });
      else log('ws error', err);
    }
  }

  function handle(conn, msg) {
    if (msg.t === 'ping') return send(conn, { t: 'pong', serverNow: now() });
    if (msg.t === 'auth') {
      if (conn.meta.studentId) return;
      const student = academy.auth(String(msg.token || ''));
      if (!student) {
        send(conn, { t: 'auth_failed' });
        return conn.close(4001, 'auth');
      }
      conn.meta.studentId = student.id;
      conn.meta.classCode = student.classCode;
      conn.meta.view = msg.view === 'all' ? 'all' : 'class';
      academy.attach(student.id);
      return sendWelcome(conn);
    }
    const id = conn.meta.studentId;
    if (!id) return;
    if (msg.t === 'view') {
      conn.meta.view = msg.view === 'all' ? 'all' : 'class';
      return sendWelcome(conn);
    }
    if (msg.t === 'study') return academy.setStudy(id, msg.on === true);
    if (msg.t === 'bubble') return academy.postBubble(id, msg.text);
    if (msg.t === 'cheer') return academy.cheer(id, String(msg.to || ''));
    if (msg.t === 'avatar') return academy.setAvatar(id, msg.avatar);
    if (msg.t === 'check_ok') return academy.confirmCheck(id);
    if (msg.t === 'cam') return academy.setCam(id, msg.on === true, String(msg.pose || ''));
  }

  // 주기적으로 호출: 공부 시간 저장, 확인/자리비움 처리, 응답 없는 연결 정리
  function tick() {
    academy.tick();
    const t = now();
    for (const conn of Array.from(conns)) {
      if (t - conn.meta.lastMsg > IDLE_CONN_MS) {
        try { conn.close(4000, 'idle'); } catch { /* 무시 */ }
        disconnect(conn);
      }
    }
  }

  // 아무도 없고 공부 중인 학생도 없으면 쉬어도 된다
  function active() {
    if (conns.size) return true;
    for (const l of academy.live.values()) if (l.since != null) return true;
    return false;
  }

  // ---------- HTTP API ----------
  // req: { method, path, query(URLSearchParams), header(name), bodyText, ip, origin, host }
  // 반환: { status, headers, body(string) }

  function json(status, body) {
    return { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }, body: JSON.stringify(body) };
  }

  function parseBody(req) {
    const text = req.bodyText || '';
    if (text.length > MAX_BODY_CHARS) throw new AcademyError('요청이 너무 커요.');
    if (!text) return {};
    try {
      return JSON.parse(text);
    } catch {
      throw new AcademyError('JSON 형식이 올바르지 않아요.');
    }
  }

  function bearer(req) {
    const m = /^Bearer\s+(.+)$/i.exec(String(req.header('authorization') || ''));
    return m ? m[1].trim() : '';
  }

  function checkLoginLimit(key) {
    const entry = loginFails.get(key);
    if (entry && now() - entry.first < LOGIN_WINDOW_MS && entry.count >= LOGIN_MAX_FAILS) {
      throw new AcademyError('여러 번 틀려서 잠시 잠겼어요. 15분 뒤에 다시 하거나 선생님께 PIN 재설정을 부탁하세요.', 'limit');
    }
  }

  function noteLoginFail(key) {
    const entry = loginFails.get(key);
    if (!entry || now() - entry.first >= LOGIN_WINDOW_MS) loginFails.set(key, { first: now(), count: 1 });
    else entry.count += 1;
  }

  async function api(req) {
    if (req.method !== 'GET' && !sameOrigin(req.origin, req.host)) return json(403, { error: '다른 사이트에서 온 요청은 받을 수 없어요.' });
    try {
      return route(req);
    } catch (err) {
      if (err instanceof AcademyError) return json(STATUS[err.code] || 400, { error: err.message });
      log('api error', err);
      return json(500, { error: '서버에 문제가 생겼어요. 잠시 후 다시 해 주세요.' });
    }
  }

  function route(req) {
    const p = req.path;
    const method = req.method;
    const q = req.query;

    if (p === '/api/class' && method === 'GET') {
      const cls = academy.getClass(q.get('code'));
      if (!cls) throw new AcademyError('반 코드를 다시 확인해 주세요.', 'not_found');
      return json(200, { code: cls.code, name: cls.name });
    }
    if (p === '/api/register' && method === 'POST') {
      const { student, token } = academy.register(parseBody(req));
      return json(200, { token, me: academy.me(student.id) });
    }
    if (p === '/api/login' && method === 'POST') {
      const body = parseBody(req);
      const key = `${req.ip}|${String(body.classCode || '').trim()}|${String(body.name || '').trim()}`;
      checkLoginLimit(key);
      try {
        const { student, token } = academy.login(body);
        loginFails.delete(key);
        return json(200, { token, me: academy.me(student.id) });
      } catch (err) {
        noteLoginFail(key);
        throw err;
      }
    }
    if (p.startsWith('/api/me')) {
      const student = academy.auth(bearer(req));
      if (!student) throw new AcademyError('다시 로그인해 주세요.', 'unauthorized');
      if (p === '/api/me' && method === 'GET') return json(200, { me: academy.me(student.id) });
      if (p === '/api/me/stats' && method === 'GET') return json(200, academy.stats(student.id));
      if (p === '/api/me/avatar' && method === 'POST') {
        academy.setAvatar(student.id, parseBody(req).avatar);
        return json(200, { me: academy.me(student.id) });
      }
      if (p === '/api/me/logout' && method === 'POST') {
        academy.logout(bearer(req));
        return json(200, { ok: true });
      }
    }

    if (p.startsWith('/api/teacher')) {
      if (!teacherKeyMatches(String(req.header('x-teacher-key') || ''), teacherKey, teacherKeyHash)) {
        throw new AcademyError('선생님 키가 올바르지 않아요.', 'unauthorized');
      }
      if (p === '/api/teacher/classes' && method === 'GET') return json(200, { classes: academy.listClasses(), today: academy.today() });
      if (p === '/api/teacher/classes' && method === 'POST') return json(200, { class: academy.createClass(parseBody(req).name) });
      let m = /^\/api\/teacher\/classes\/(\d+)$/.exec(p);
      if (m && method === 'PATCH') return json(200, { class: academy.renameClass(m[1], parseBody(req).name) });
      if (m && method === 'DELETE') {
        academy.deleteClass(m[1]);
        return json(200, { ok: true });
      }
      m = /^\/api\/teacher\/classes\/(\d+)\/students$/.exec(p);
      if (m && method === 'POST') return json(200, { results: academy.addStudents(m[1], parseBody(req).names) });
      if (p === '/api/teacher/overview' && method === 'GET') {
        return json(200, academy.overview(q.get('target') || ALL, q.get('day') || academy.today()));
      }
      if (p === '/api/teacher/notice' && method === 'POST') {
        const body = parseBody(req);
        academy.setNotice(String(body.target || ALL), body.text);
        return json(200, { ok: true });
      }
      if (p === '/api/teacher/export.csv' && method === 'GET') {
        return {
          status: 200,
          headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Cache-Control': 'no-store', 'Content-Disposition': 'attachment; filename="study-records.csv"' },
          body: academy.exportCsv(q.get('target') || ALL, q.get('from'), q.get('to'))
        };
      }
      m = /^\/api\/teacher\/students\/([0-9a-f]+)\/(pin|bubble|move)$/.exec(p);
      if (m && method === 'POST') {
        const body = parseBody(req);
        if (m[2] === 'pin') academy.resetPin(m[1], body.pin);
        else if (m[2] === 'bubble') academy.clearBubble(m[1]);
        else academy.moveStudent(m[1], String(body.classCode || ''));
        return json(200, { ok: true });
      }
      m = /^\/api\/teacher\/students\/([0-9a-f]+)$/.exec(p);
      if (m && method === 'DELETE') {
        academy.removeStudent(m[1]);
        return json(200, { ok: true });
      }
    }
    throw new AcademyError('없는 주소예요.', 'not_found');
  }

  function health() {
    return json(200, { ok: true, storage: store.kind, sockets: conns.size });
  }

  return { academy, conns, connect, disconnect, message, tick, active, api, health, sameOrigin };
}

module.exports = { createHub, sameOrigin };
