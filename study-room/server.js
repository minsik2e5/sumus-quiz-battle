'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { WebSocketServer } = require('ws');
const { Store } = require('./lib/store');
const { Academy, AcademyError, ALL } = require('./lib/academy');

const PUBLIC_DIR = path.join(__dirname, 'public');
// 얼굴 인식 엔진(MediaPipe)은 npm 패키지에서 바로 내보낸다
const MEDIAPIPE_DIR = path.join(__dirname, 'node_modules', '@mediapipe', 'tasks-vision');
const VENDOR_FILES = new Map([
  ['/vendor/mediapipe/vision_bundle.mjs', 'vision_bundle.mjs'],
  ...['vision_wasm_internal.js', 'vision_wasm_internal.wasm', 'vision_wasm_nosimd_internal.js', 'vision_wasm_nosimd_internal.wasm']
    .map((f) => [`/vendor/mediapipe/wasm/${f}`, `wasm/${f}`])
]);
const TICK_MS = 15 * 1000;
const MAX_BODY_BYTES = 16 * 1024;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_FAILS = 8;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.wasm': 'application/wasm',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon'
};

function log(...args) {
  console.log(new Date().toISOString(), ...args);
}

function safeEqual(a, b) {
  const A = Buffer.from(String(a));
  const B = Buffer.from(String(b));
  return A.length === B.length && crypto.timingSafeEqual(A, B);
}

function sameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return true;
  try {
    return new URL(origin).host.toLowerCase() === String(req.headers.host || '').toLowerCase();
  } catch {
    return false;
  }
}

function clientIp(req) {
  return String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress || 'unknown';
}

async function createApp({
  port = Number(process.env.PORT || 8790),
  host = process.env.HOST || '0.0.0.0',
  teacherKey = process.env.STUDY_TEACHER_KEY || '',
  databaseUrl = process.env.DATABASE_URL || '',
  dataFile = process.env.STUDY_DATA_FILE || path.join(__dirname, 'data', 'study-room.json'),
  now = () => Date.now(),
  quiet = false
} = {}) {
  const say = quiet ? () => {} : log;
  if (!teacherKey) {
    teacherKey = crypto.randomBytes(6).toString('hex');
    say(`STUDY_TEACHER_KEY가 없어서 임시 선생님 키를 만들었어요: ${teacherKey}`);
  }

  const store = new Store({ file: dataFile || null, databaseUrl: databaseUrl || null, log: say });
  await store.load();
  say(`storage: ${store.kind}`);

  const sockets = new Set();
  const loginFails = new Map();

  function send(ws, msg) {
    if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg));
  }

  // 학생 화면: 우리 반 보기면 같은 반 학생만, 학원 전체 보기면 접속 중인 학생 모두를 받는다.
  function sees(ws, member) {
    if (ws.meta.view === 'all') return true;
    return ws.meta.classCode === member.classCode;
  }

  const academy = new Academy(store, {
    now,
    onMember(member) {
      for (const ws of sockets) {
        if (!ws.meta.studentId) continue;
        if (ws.meta.studentId === member.id) send(ws, { t: 'me', me: academy.me(member.id) });
        if (ws.meta.view === 'all' && member.status === 'offline') send(ws, { t: 'remove', id: member.id });
        else if (sees(ws, member)) send(ws, { t: 'member', m: member });
      }
    },
    onRemove(id, classCode, deleted) {
      for (const ws of sockets) {
        if (ws.meta.studentId === id) {
          if (deleted) {
            send(ws, { t: 'kicked' });
            ws.close(4001, 'removed');
          } else {
            const s = academy.data.students[id];
            ws.meta.classCode = s.classCode;
            sendWelcome(ws);
          }
        } else if (ws.meta.classCode === classCode || ws.meta.view === 'all') {
          send(ws, { t: 'remove', id });
        }
      }
    },
    onCheer(event) {
      for (const ws of sockets) {
        if (!ws.meta.studentId) continue;
        const target = academy.data.students[event.to];
        if (ws.meta.studentId === event.to || (target && sees(ws, target))) send(ws, { t: 'cheer', ...event });
      }
    },
    onCamStopped(id) {
      for (const ws of sockets) if (ws.meta.studentId === id) send(ws, { t: 'cam_stopped' });
    },
    onCheckMissed(id) {
      for (const ws of sockets) if (ws.meta.studentId === id) send(ws, { t: 'check_missed' });
    },
    onNotice() {
      for (const ws of sockets) {
        if (ws.meta.studentId) send(ws, { t: 'notices', notices: academy.noticesFor(ws.meta.classCode) });
      }
    }
  });

  function sendWelcome(ws) {
    const id = ws.meta.studentId;
    const s = academy.data.students[id];
    const cls = academy.getClass(s.classCode);
    send(ws, {
      t: 'welcome',
      serverNow: now(),
      view: ws.meta.view,
      me: academy.me(id),
      className: cls ? cls.name : '',
      members: academy.roomMembers(ws.meta.view, s.classCode),
      notices: academy.noticesFor(s.classCode)
    });
  }

  // ---------- HTTP ----------

  function json(res, status, body) {
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify(body));
  }

  function readBody(req) {
    return new Promise((resolve, reject) => {
      let size = 0;
      const chunks = [];
      req.on('data', (chunk) => {
        size += chunk.length;
        if (size > MAX_BODY_BYTES) {
          reject(new AcademyError('요청이 너무 커요.'));
          req.destroy();
        } else chunks.push(chunk);
      });
      req.on('end', () => {
        if (!chunks.length) return resolve({});
        try {
          resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
        } catch {
          reject(new AcademyError('JSON 형식이 올바르지 않아요.'));
        }
      });
      req.on('error', reject);
    });
  }

  function bearer(req) {
    const m = /^Bearer\s+(.+)$/i.exec(String(req.headers.authorization || ''));
    return m ? m[1].trim() : '';
  }

  function isTeacher(req) {
    return safeEqual(String(req.headers['x-teacher-key'] || ''), teacherKey);
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

  const STATUS = { bad_request: 400, unauthorized: 401, not_found: 404, conflict: 409, limit: 429 };

  async function api(req, res, url) {
    const p = url.pathname;
    const method = req.method;

    if (p === '/api/class' && method === 'GET') {
      const cls = academy.getClass(url.searchParams.get('code'));
      if (!cls) throw new AcademyError('반 코드를 다시 확인해 주세요.', 'not_found');
      return json(res, 200, { code: cls.code, name: cls.name });
    }
    if (p === '/api/register' && method === 'POST') {
      const body = await readBody(req);
      const { student, token } = academy.register(body);
      return json(res, 200, { token, me: academy.me(student.id) });
    }
    if (p === '/api/login' && method === 'POST') {
      const body = await readBody(req);
      const key = `${clientIp(req)}|${String(body.classCode || '').trim()}|${String(body.name || '').trim()}`;
      checkLoginLimit(key);
      try {
        const { student, token } = academy.login(body);
        loginFails.delete(key);
        return json(res, 200, { token, me: academy.me(student.id) });
      } catch (err) {
        noteLoginFail(key);
        throw err;
      }
    }
    if (p.startsWith('/api/me')) {
      const student = academy.auth(bearer(req));
      if (!student) throw new AcademyError('다시 로그인해 주세요.', 'unauthorized');
      if (p === '/api/me' && method === 'GET') return json(res, 200, { me: academy.me(student.id) });
      if (p === '/api/me/stats' && method === 'GET') return json(res, 200, academy.stats(student.id));
      if (p === '/api/me/avatar' && method === 'POST') {
        academy.setAvatar(student.id, (await readBody(req)).avatar);
        return json(res, 200, { me: academy.me(student.id) });
      }
      if (p === '/api/me/logout' && method === 'POST') {
        academy.logout(bearer(req));
        return json(res, 200, { ok: true });
      }
    }

    if (p.startsWith('/api/teacher')) {
      if (!isTeacher(req)) throw new AcademyError('선생님 키가 올바르지 않아요.', 'unauthorized');
      if (p === '/api/teacher/classes' && method === 'GET') return json(res, 200, { classes: academy.listClasses(), today: academy.today() });
      if (p === '/api/teacher/classes' && method === 'POST') return json(res, 200, { class: academy.createClass((await readBody(req)).name) });
      let m = /^\/api\/teacher\/classes\/(\d+)$/.exec(p);
      if (m && method === 'PATCH') return json(res, 200, { class: academy.renameClass(m[1], (await readBody(req)).name) });
      if (m && method === 'DELETE') {
        academy.deleteClass(m[1]);
        return json(res, 200, { ok: true });
      }
      if (p === '/api/teacher/overview' && method === 'GET') {
        return json(res, 200, academy.overview(url.searchParams.get('target') || ALL, url.searchParams.get('day') || academy.today()));
      }
      if (p === '/api/teacher/notice' && method === 'POST') {
        const body = await readBody(req);
        academy.setNotice(String(body.target || ALL), body.text);
        return json(res, 200, { ok: true });
      }
      if (p === '/api/teacher/export.csv' && method === 'GET') {
        const csv = academy.exportCsv(url.searchParams.get('target') || ALL, url.searchParams.get('from'), url.searchParams.get('to'));
        res.writeHead(200, { 'Content-Type': 'text/csv; charset=utf-8', 'Cache-Control': 'no-store', 'Content-Disposition': 'attachment; filename="study-records.csv"' });
        return res.end(csv);
      }
      m = /^\/api\/teacher\/students\/([0-9a-f]+)\/(pin|bubble|move)$/.exec(p);
      if (m && method === 'POST') {
        const body = await readBody(req);
        if (m[2] === 'pin') academy.resetPin(m[1], body.pin);
        else if (m[2] === 'bubble') academy.clearBubble(m[1]);
        else academy.moveStudent(m[1], String(body.classCode || ''));
        return json(res, 200, { ok: true });
      }
      m = /^\/api\/teacher\/students\/([0-9a-f]+)$/.exec(p);
      if (m && method === 'DELETE') {
        academy.removeStudent(m[1]);
        return json(res, 200, { ok: true });
      }
    }
    throw new AcademyError('없는 주소예요.', 'not_found');
  }

  function serveFile(res, filePath, cacheControl) {
    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        return res.end('Not found');
      }
      res.writeHead(200, {
        'Content-Type': TYPES[path.extname(filePath).toLowerCase()] || 'application/octet-stream',
        'Cache-Control': cacheControl,
        'X-Content-Type-Options': 'nosniff'
      });
      res.end(data);
    });
  }

  function serveStatic(req, res, url) {
    const vendor = VENDOR_FILES.get(url.pathname);
    if (vendor) return serveFile(res, path.join(MEDIAPIPE_DIR, vendor), 'public, max-age=604800');
    let pathname = decodeURIComponent(url.pathname);
    if (pathname === '/') pathname = '/index.html';
    if (pathname === '/teacher') pathname = '/teacher.html';
    const filePath = path.normalize(path.join(PUBLIC_DIR, pathname));
    if (!filePath.startsWith(PUBLIC_DIR + path.sep)) {
      res.writeHead(403);
      return res.end('Forbidden');
    }
    serveFile(res, filePath, path.extname(filePath).toLowerCase() === '.html' ? 'no-store' : 'no-cache');
  }

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url || '/', 'http://localhost');
    if (url.pathname === '/health') return json(res, 200, { ok: true, storage: store.kind, sockets: sockets.size });
    if (url.pathname.startsWith('/api/')) {
      if (req.method !== 'GET' && !sameOrigin(req)) return json(res, 403, { error: '다른 사이트에서 온 요청은 받을 수 없어요.' });
      try {
        await api(req, res, url);
      } catch (err) {
        if (err instanceof AcademyError) return json(res, STATUS[err.code] || 400, { error: err.message });
        say('api error', err);
        return json(res, 500, { error: '서버에 문제가 생겼어요. 잠시 후 다시 해 주세요.' });
      }
      return;
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405);
      return res.end();
    }
    serveStatic(req, res, url);
  });

  // ---------- WebSocket ----------

  const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 4096, verifyClient: ({ req }) => sameOrigin(req) });

  wss.on('connection', (ws) => {
    ws.meta = { studentId: null, classCode: null, view: 'class' };
    ws.alive = true;
    sockets.add(ws);
    ws.on('pong', () => { ws.alive = true; });

    ws.on('message', (raw) => {
      let msg;
      try {
        msg = JSON.parse(raw.toString('utf8'));
      } catch {
        return;
      }
      try {
        handle(ws, msg);
      } catch (err) {
        if (err instanceof AcademyError) send(ws, { t: 'error', msg: err.message, code: err.code });
        else say('ws error', err);
      }
    });

    ws.on('close', () => {
      sockets.delete(ws);
      if (ws.meta.studentId) academy.detach(ws.meta.studentId);
    });
  });

  function handle(ws, msg) {
    if (msg.t === 'ping') return send(ws, { t: 'pong', serverNow: now() });
    if (msg.t === 'auth') {
      if (ws.meta.studentId) return;
      const student = academy.auth(String(msg.token || ''));
      if (!student) {
        send(ws, { t: 'auth_failed' });
        return ws.close(4001, 'auth');
      }
      ws.meta.studentId = student.id;
      ws.meta.classCode = student.classCode;
      ws.meta.view = msg.view === 'all' ? 'all' : 'class';
      academy.attach(student.id);
      return sendWelcome(ws);
    }
    const id = ws.meta.studentId;
    if (!id) return;
    if (msg.t === 'view') {
      ws.meta.view = msg.view === 'all' ? 'all' : 'class';
      return sendWelcome(ws);
    }
    if (msg.t === 'study') return academy.setStudy(id, msg.on === true);
    if (msg.t === 'bubble') return academy.postBubble(id, msg.text);
    if (msg.t === 'cheer') return academy.cheer(id, String(msg.to || ''));
    if (msg.t === 'avatar') return academy.setAvatar(id, msg.avatar);
    if (msg.t === 'check_ok') return academy.confirmCheck(id);
    if (msg.t === 'cam') return academy.setCam(id, msg.on === true, String(msg.pose || ''));
  }

  const tickTimer = setInterval(() => academy.tick(), TICK_MS);
  const pingTimer = setInterval(() => {
    for (const ws of sockets) {
      if (!ws.alive) {
        ws.terminate();
        continue;
      }
      ws.alive = false;
      ws.ping();
    }
  }, 30 * 1000);

  await new Promise((resolve) => server.listen(port, host, resolve));
  say(`SUMUS 공부방 listening on http://${host}:${server.address().port}`);

  async function close() {
    clearInterval(tickTimer);
    clearInterval(pingTimer);
    for (const ws of sockets) ws.terminate();
    for (const [id, l] of academy.live) if (l.since != null) academy.commit(id, now());
    await new Promise((resolve) => wss.close(resolve));
    await new Promise((resolve) => server.close(resolve));
    await store.close();
  }

  return { server, academy, store, teacherKey, port: server.address().port, close };
}

if (require.main === module) {
  createApp().then((app) => {
    const shutdown = (signal) => {
      log(`${signal}: 기록 저장 후 종료합니다`);
      app.close().then(() => process.exit(0), (err) => {
        log('shutdown failed', err);
        process.exit(1);
      });
    };
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  }).catch((err) => {
    log('failed to start', err);
    process.exit(1);
  });
}

module.exports = { createApp };
