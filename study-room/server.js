'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { WebSocketServer } = require('ws');
const { Store } = require('./lib/store');
const { createHub, sameOrigin } = require('./lib/hub');

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
  '.webp': 'image/webp',
  '.ico': 'image/x-icon'
};

function log(...args) {
  console.log(new Date().toISOString(), ...args);
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

  const hub = createHub({ store, teacherKey, now, log: say });
  const { academy } = hub;

  function readBody(req) {
    return new Promise((resolve, reject) => {
      let size = 0;
      const chunks = [];
      req.on('data', (chunk) => {
        size += chunk.length;
        if (size > MAX_BODY_BYTES) {
          resolve('x'.repeat(MAX_BODY_BYTES + 1));
          req.destroy();
        } else chunks.push(chunk);
      });
      req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
      req.on('error', reject);
    });
  }

  function reply(res, out) {
    res.writeHead(out.status, out.headers);
    res.end(out.body);
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
    if (pathname === '/board') pathname = '/board.html';
    const filePath = path.normalize(path.join(PUBLIC_DIR, pathname));
    if (!filePath.startsWith(PUBLIC_DIR + path.sep)) {
      res.writeHead(403);
      return res.end('Forbidden');
    }
    serveFile(res, filePath, path.extname(filePath).toLowerCase() === '.html' ? 'no-store' : 'no-cache');
  }

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url || '/', 'http://localhost');
    if (url.pathname === '/health') return reply(res, hub.health());
    if (url.pathname.startsWith('/api/')) {
      return reply(res, await hub.api({
        method: req.method,
        path: url.pathname,
        query: url.searchParams,
        header: (name) => req.headers[name.toLowerCase()],
        bodyText: req.method === 'GET' ? '' : await readBody(req),
        ip: clientIp(req),
        origin: req.headers.origin,
        host: req.headers.host
      }));
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405);
      return res.end();
    }
    serveStatic(req, res, url);
  });

  // ---------- WebSocket ----------

  const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 4096, verifyClient: ({ req }) => sameOrigin(req.headers.origin, req.headers.host) });

  wss.on('connection', (ws) => {
    const conn = {
      send: (text) => { if (ws.readyState === ws.OPEN) ws.send(text); },
      close: (code, reason) => ws.close(code, reason)
    };
    ws.alive = true;
    ws.on('pong', () => { ws.alive = true; });
    hub.connect(conn);
    ws.on('message', (raw) => hub.message(conn, raw.toString('utf8')));
    ws.on('close', () => hub.disconnect(conn));
  });

  const tickTimer = setInterval(() => hub.tick(), TICK_MS);
  const pingTimer = setInterval(() => {
    for (const ws of wss.clients) {
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
    for (const ws of wss.clients) ws.terminate();
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
