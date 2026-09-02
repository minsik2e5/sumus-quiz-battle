'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');
const zlib = require('zlib');
const { validateMessage, normalizeCode, normalizeId, CACHEABLE_TYPES } = require('./lib/protocol');
const { RoomRegistry } = require('./lib/room-registry');

const PORT = Number(process.env.PORT || 8787);
const HOST = process.env.HOST || '0.0.0.0';
const TEACHER_KEY = String(process.env.SUMUS_TEACHER_KEY || '');
const MAX_CONNECTIONS = Number(process.env.MAX_CONNECTIONS || 250);
const MAX_CONNECTIONS_PER_IP = Number(process.env.MAX_CONNECTIONS_PER_IP || 40);
const MAX_MESSAGE_BYTES = Number(process.env.MAX_MESSAGE_BYTES || 2097152);
const PUBLIC_DIR = path.join(__dirname, 'public');
const ASSET_DIR = path.join(__dirname, 'assets');
const EMBEDDED_INDEX_PATH = path.join(__dirname, 'index.html.gz.b64');
let EMBEDDED_INDEX = null;
try { EMBEDDED_INDEX = zlib.gunzipSync(Buffer.from(fs.readFileSync(EMBEDDED_INDEX_PATH, 'utf8').trim(), 'base64')); } catch (err) { console.error('Failed to load embedded index:', err.message); }
const WS_GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
const BUILD = 'V0.9.1';
const COMMIT = String(process.env.RENDER_GIT_COMMIT || process.env.SUMUS_COMMIT || 'local-build').slice(0, 7);
const ROOM_TTL_MS = Number(process.env.ROOM_TTL_MS || 6 * 60 * 60 * 1000);

const clientsById = new Map();
const metaBySocket = new Map();
const teachersByCode = new Map();
const teachersByBattleId = new Map();
const studentsByBattleId = new Map();
const connectionsByIp = new Map();
const roomRegistry = new RoomRegistry({ ttlMs: ROOM_TTL_MS });

function now() { return Date.now(); }
function log(...args) { console.log(new Date().toISOString(), ...args); }

function clientIp(req) {
  const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return forwarded || req.socket.remoteAddress || 'unknown';
}

function safeEqual(a, b) {
  const A = Buffer.from(String(a));
  const B = Buffer.from(String(b));
  if (A.length !== B.length) return false;
  return crypto.timingSafeEqual(A, B);
}

function sameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return true;
  try {
    const originUrl = new URL(origin);
    const host = String(req.headers.host || '').toLowerCase();
    return originUrl.host.toLowerCase() === host;
  } catch {
    return false;
  }
}

function rejectUpgrade(socket, status = 403, text = 'Forbidden') {
  try {
    socket.write(`HTTP/1.1 ${status} ${text}\r\nConnection: close\r\nContent-Type: text/plain; charset=utf-8\r\nContent-Length: ${Buffer.byteLength(text)}\r\n\r\n${text}`);
  } catch {}
  try { socket.destroy(); } catch {}
}

function safeJsonParse(text) {
  try { return JSON.parse(text); } catch { return null; }
}

function contentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon'
  }[ext] || 'application/octet-stream';
}

const server = http.createServer((req, res) => {
  try {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405, { Allow: 'GET, HEAD' });
      res.end('Method Not Allowed');
      return;
    }
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    if (url.pathname === '/health') {
      const body = JSON.stringify({
        ok: true,
        build: BUILD,
        commit: COMMIT,
        now: now(),
        clients: clientsById.size,
        teachers: teachersByBattleId.size,
        publicMode: true,
        teacherKeyConfigured: !!TEACHER_KEY,
        battles: roomRegistry.summary().map(room => ({ ...room, students: studentsByBattleId.get(room.battleId)?.size || 0 }))
      });
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(body);
      return;
    }

    let pathname = decodeURIComponent(url.pathname);
    while (pathname.startsWith('//')) pathname = pathname.slice(1);
    if (pathname === '/' || pathname === '/index.html' || (!path.extname(pathname) && !pathname.startsWith('/assets/'))) {
      if (!EMBEDDED_INDEX) {
        res.writeHead(503, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('App bundle unavailable');
        return;
      }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(EMBEDDED_INDEX);
      return;
    }
    const isAsset = pathname === '/assets' || pathname.startsWith('/assets/');
    const staticRoot = isAsset ? ASSET_DIR : PUBLIC_DIR;
    const staticPath = isAsset ? pathname.slice('/assets'.length) || '/' : pathname;
    const filePath = path.resolve(staticRoot, `.${staticPath}`);
    const relativePath = path.relative(staticRoot, filePath);
    if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
      res.writeHead(403); res.end('Forbidden'); return;
    }
    fs.stat(filePath, (err, stat) => {
      if (err || !stat.isFile()) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Not Found');
        return;
      }
      res.writeHead(200, {
        'Content-Type': contentType(filePath),
        'Cache-Control': filePath.endsWith('.html') ? 'no-store' : 'public, max-age=300'
      });
      fs.createReadStream(filePath).pipe(res);
    });
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Server error');
  }
});

function addStudentToBattle(socket, battleId) {
  if (!battleId) return;
  const meta = metaBySocket.get(socket);
  if (!meta) return;
  if (meta.battleId && meta.battleId !== battleId) {
    const prev = studentsByBattleId.get(meta.battleId);
    prev?.delete(socket);
    if (prev && prev.size === 0) studentsByBattleId.delete(meta.battleId);
  }
  meta.battleId = battleId;
  let set = studentsByBattleId.get(battleId);
  if (!set) studentsByBattleId.set(battleId, set = new Set());
  set.add(socket);
}

function unregisterTeacher(socket) {
  const meta = metaBySocket.get(socket);
  if (!meta || meta.role !== 'teacher') return;
  if (meta.code && teachersByCode.get(meta.code) === socket) teachersByCode.delete(meta.code);
  if (meta.battleId && teachersByBattleId.get(meta.battleId) === socket) teachersByBattleId.delete(meta.battleId);
}

function registerTeacher(socket, battleId, code) {
  const meta = metaBySocket.get(socket);
  if (!meta) return { ok: false, reason: 'missing_meta' };
  battleId = normalizeId(battleId);
  code = normalizeCode(code);
  if (!battleId || !code) return { ok: false, reason: 'invalid_room_identity' };
  const registered = roomRegistry.register({ battleId, code, teacherSocket: socket, build: meta.build, commit: meta.commit });
  if (!registered.ok) return registered;
  unregisterTeacher(socket);
  meta.role = 'teacher';
  meta.battleId = battleId;
  meta.code = code;
  if (meta.battleId) teachersByBattleId.set(meta.battleId, socket);
  if (meta.code) teachersByCode.set(meta.code, socket);
  return registered;
}

function frameText(text) {
  const payload = Buffer.from(String(text));
  let header;
  if (payload.length < 126) {
    header = Buffer.alloc(2);
    header[0] = 0x81;
    header[1] = payload.length;
  } else if (payload.length <= 0xffff) {
    header = Buffer.alloc(4);
    header[0] = 0x81;
    header[1] = 126;
    header.writeUInt16BE(payload.length, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x81;
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(payload.length), 2);
  }
  return Buffer.concat([header, payload]);
}

function frameControl(opcode, payload = Buffer.alloc(0)) {
  if (!Buffer.isBuffer(payload)) payload = Buffer.from(payload);
  if (payload.length > 125) payload = payload.subarray(0, 125);
  const header = Buffer.from([0x80 | opcode, payload.length]);
  return Buffer.concat([header, payload]);
}

function sendJson(socket, message) {
  if (!socket || socket.destroyed || !socket.writable) return false;
  try {
    socket.write(frameText(JSON.stringify(message)));
    return true;
  } catch {
    return false;
  }
}

function systemMessage(type, payload = {}, targetClientId = '') {
  return {
    id: `server-${now()}-${Math.random().toString(36).slice(2, 7)}`,
    type,
    payload: { timestamp: now(), targetClientId, ...payload },
    senderId: 'server',
    timestamp: now()
  };
}

function sendToClientId(clientId, message) {
  const target = clientsById.get(clientId);
  return target ? sendJson(target, message) : false;
}

function broadcastStudents(battleId, message, exceptSocket = null) {
  const set = studentsByBattleId.get(battleId);
  if (!set) return 0;
  let count = 0;
  for (const socket of set) {
    if (socket === exceptSocket) continue;
    if (sendJson(socket, message)) count++;
  }
  return count;
}

function forwardToTeacher(battleId, message) {
  const teacher = teachersByBattleId.get(battleId);
  if (!teacher) return false;
  return sendJson(teacher, message);
}

function handleAppMessage(socket, message) {
  const meta = metaBySocket.get(socket);
  if (!meta) return;
  const checked = validateMessage(meta.role, message);
  if (!checked.ok) {
    meta.invalidMessages = (meta.invalidMessages || 0) + 1;
    log('WS invalid message', meta.role, meta.clientId, message?.type || '-', checked.reason, meta.invalidMessages);
    if (meta.invalidMessages >= 5) try { socket.destroy(); } catch {}
    return;
  }
  meta.lastSeen = now();
  if (!meta.msgWindowStart || now() - meta.msgWindowStart > 10000) { meta.msgWindowStart = now(); meta.msgCount = 0; }
  meta.msgCount = (meta.msgCount || 0) + 1;
  // A 24-player answer wave legitimately produces assignment, result, progress,
  // rank and snapshot traffic from the authenticated teacher. Students retain the
  // tighter abuse ceiling; teachers get a bounded classroom-sized burst budget.
  const messageLimit = meta.role === 'teacher' ? 800 : 120;
  if (meta.msgCount > messageLimit) { try { socket.destroy(); } catch {} return; }
  const payload = checked.payload;

  if (message.type === 'SERVER_REGISTER_BATTLE' && meta.role === 'teacher') {
    meta.build = String(payload.build || '').slice(0, 32);
    meta.commit = String(payload.commit || '').slice(0, 40);
    const registration = registerTeacher(socket, payload.battleId, payload.battleCode);
    if (!registration.ok) {
      sendJson(socket, systemMessage('SERVER_CODE_CONFLICT', { reason: registration.reason, battleCode: payload.battleCode }, meta.clientId));
      return;
    }
    sendJson(socket, systemMessage('SERVER_REGISTERED', {
      battleId: payload.battleId,
      battleCode: payload.battleCode,
      status: 'live'
    }, meta.clientId));
    if (registration.room.snapshot || registration.room.teacherState) {
      sendJson(socket, systemMessage('SERVER_ROOM_STATE', {
        battleId: registration.room.battleId,
        battleCode: registration.room.code,
        state: registration.room.teacherState || null,
        snapshot: registration.room.snapshot ? (registration.room.snapshot.payload || registration.room.snapshot) : null,
        cachedAt: registration.room.updatedAt
      }, meta.clientId));
    }
    return;
  }

  if (message.type === 'SERVER_SAVE_TEACHER_STATE' && meta.role === 'teacher') {
    const battleId = normalizeId(payload.battleId || meta.battleId || '');
    const code = normalizeCode(payload.battleCode || meta.code || '');
    if (!battleId || !code || battleId !== meta.battleId || code !== meta.code) return;
    if (!payload.state || typeof payload.state !== 'object' || Array.isArray(payload.state)) return;
    const serialized = JSON.stringify(payload.state);
    if (Buffer.byteLength(serialized) > MAX_MESSAGE_BYTES) return;
    roomRegistry.cacheTeacherState(battleId, payload.state);
    return;
  }

  if (meta.role === 'student' && message.type === 'BATTLE_LOOKUP') {
    const code = normalizeCode(payload.code);
    if (!code) return;
    const room = roomRegistry.byCode(code);
    const teacher = room?.teacherSocket || teachersByCode.get(code);
    meta.code = code;

    // Resolve the room immediately from the server's cached authoritative snapshot.
    // This removes a fragile student -> server -> teacher -> server -> student round trip
    // from the initial join path. If the teacher is live we still forward the lookup so
    // a fresh snapshot can follow, but the student no longer waits on that response.
    if (room?.snapshot) {
      addStudentToBattle(socket, room.battleId);
      const snapshotPayload = room.snapshot.payload || room.snapshot;
      sendJson(socket, {
        ...room.snapshot,
        payload: { ...snapshotPayload, targetClientId: meta.clientId, cached: true }
      });
      log('BATTLE_LOOKUP cache-hit', meta.clientId, code, room.battleId, teacher ? 'teacher-live' : 'teacher-offline');
      if (teacher) sendJson(teacher, message);
      return;
    }

    if (teacher) {
      log('BATTLE_LOOKUP teacher-forward', meta.clientId, code, room?.battleId || '-');
      sendJson(teacher, message);
      return;
    }

    log('BATTLE_LOOKUP miss', meta.clientId, code);
    sendJson(socket, systemMessage('BATTLE_NOT_FOUND', { code }, meta.clientId));
    return;
  }

  if (meta.role === 'teacher') {
    const battleId = normalizeId(payload.battleId || meta.battleId || '');
    const code = normalizeCode(payload.battleCode || meta.code || '');
    if (!battleId || !code || (meta.battleId && meta.battleId !== battleId)) return;
    const registration = registerTeacher(socket, battleId, code);
    if (!registration.ok) return;
    if (CACHEABLE_TYPES.has(message.type)) roomRegistry.cache(battleId, message.type, message);

    const targetClientId = payload.targetClientId || '';
    if (targetClientId) {
      const targetSocket = clientsById.get(targetClientId);
      const targetMeta = targetSocket && metaBySocket.get(targetSocket);
      if (!targetMeta || targetMeta.role !== 'student') return;
      if (targetMeta.battleId && targetMeta.battleId !== battleId) return;
      addStudentToBattle(targetSocket, battleId);
      if (message.type === 'PLAYER_JOIN_ACCEPTED') {
        targetMeta.playerId = normalizeId(payload.playerId);
        targetMeta.reconnectToken = String(payload.reconnectToken || '').slice(0, 256);
      }
      sendJson(targetSocket, message);
      return;
    }

    if (battleId) broadcastStudents(battleId, message);
    return;
  }

  if (meta.role === 'student') {
    const battleId = normalizeId(payload.battleId || meta.battleId || '');
    if (!battleId) return;
    if (meta.battleId && meta.battleId !== battleId) return;
    const payloadPlayerId = normalizeId(payload.playerId);
    if (meta.playerId && payloadPlayerId && meta.playerId !== payloadPlayerId) return;
    if (!meta.playerId && payloadPlayerId && message.type !== 'PLAYER_JOIN_REQUEST') meta.playerId = payloadPlayerId;
    if (battleId) addStudentToBattle(socket, battleId);
    if (battleId) {
      if (!forwardToTeacher(battleId, message)) {
        sendJson(socket, systemMessage('TRANSPORT_STATUS', {
          battleId,
          status: 'reconnecting',
          reason: 'teacher_offline'
        }, meta.clientId));
      }
    }
  }
}

function createFrameParser(socket) {
  let buffer = Buffer.alloc(0);
  let fragmentedOpcode = null;
  let fragments = [];

  return chunk => {
    buffer = Buffer.concat([buffer, chunk]);
    while (buffer.length >= 2) {
      const b0 = buffer[0];
      const b1 = buffer[1];
      const fin = !!(b0 & 0x80);
      const opcode = b0 & 0x0f;
      const masked = !!(b1 & 0x80);
      let length = b1 & 0x7f;
      let offset = 2;

      if (length === 126) {
        if (buffer.length < 4) return;
        length = buffer.readUInt16BE(2);
        offset = 4;
      } else if (length === 127) {
        if (buffer.length < 10) return;
        const big = buffer.readBigUInt64BE(2);
        if (big > BigInt(MAX_MESSAGE_BYTES)) {
          socket.destroy(); return;
        }
        length = Number(big);
        offset = 10;
      }

      if (length > MAX_MESSAGE_BYTES) { socket.destroy(); return; }
      const maskLength = masked ? 4 : 0;
      if (buffer.length < offset + maskLength + length) return;
      let payload = buffer.subarray(offset + maskLength, offset + maskLength + length);
      if (masked) {
        const mask = buffer.subarray(offset, offset + 4);
        const decoded = Buffer.alloc(payload.length);
        for (let i = 0; i < payload.length; i++) decoded[i] = payload[i] ^ mask[i % 4];
        payload = decoded;
      }
      buffer = buffer.subarray(offset + maskLength + length);

      if (opcode === 0x8) {
        try { socket.write(frameControl(0x8, payload)); } catch {}
        socket.end();
        return;
      }
      if (opcode === 0x9) {
        try { socket.write(frameControl(0xA, payload)); } catch {}
        continue;
      }
      if (opcode === 0xA) {
        const meta = metaBySocket.get(socket);
        if (meta) meta.lastPong = now();
        continue;
      }

      if (opcode === 0x0) {
        if (fragmentedOpcode == null) continue;
        fragments.push(payload);
        if (fin) {
          const complete = Buffer.concat(fragments);
          const activeOpcode = fragmentedOpcode;
          fragmentedOpcode = null;
          fragments = [];
          if (activeOpcode === 0x1) {
            const message = safeJsonParse(complete.toString('utf8'));
            if (message) handleAppMessage(socket, message);
          }
        }
        continue;
      }

      if (!fin && (opcode === 0x1 || opcode === 0x2)) {
        fragmentedOpcode = opcode;
        fragments = [payload];
        continue;
      }

      if (opcode === 0x1) {
        const message = safeJsonParse(payload.toString('utf8'));
        if (message) handleAppMessage(socket, message);
      }
    }
  };
}

server.on('upgrade', (req, socket) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    if (url.pathname !== '/ws') { rejectUpgrade(socket, 404, 'Not Found'); return; }
    if (!sameOrigin(req)) { rejectUpgrade(socket, 403, 'Origin blocked'); return; }

    const ip = clientIp(req);
    if (clientsById.size >= MAX_CONNECTIONS) { rejectUpgrade(socket, 503, 'Server busy'); return; }
    const ipCount = connectionsByIp.get(ip) || 0;
    if (ipCount >= MAX_CONNECTIONS_PER_IP) { rejectUpgrade(socket, 429, 'Too Many Connections'); return; }

    const roleParam = url.searchParams.get('role');
    if (roleParam !== 'teacher' && roleParam !== 'student') { rejectUpgrade(socket, 400, 'Invalid role'); return; }
    const role = roleParam;
    if (role === 'teacher' && TEACHER_KEY) {
      const provided = url.searchParams.get('teacherKey') || '';
      if (!safeEqual(provided, TEACHER_KEY)) { rejectUpgrade(socket, 401, 'Unauthorized'); return; }
    }

    const key = req.headers['sec-websocket-key'];
    const version = req.headers['sec-websocket-version'];
    if (!key || version !== '13') {
      socket.write('HTTP/1.1 400 Bad Request\r\n\r\n');
      socket.destroy();
      return;
    }

    const accept = crypto.createHash('sha1').update(key + WS_GUID).digest('base64');
    socket.write([
      'HTTP/1.1 101 Switching Protocols',
      'Upgrade: websocket',
      'Connection: Upgrade',
      `Sec-WebSocket-Accept: ${accept}`,
      '\r\n'
    ].join('\r\n'));

    const clientId = normalizeId(url.searchParams.get('clientId')) || `ws-${crypto.randomBytes(5).toString('hex')}`;
    const battleId = normalizeId(url.searchParams.get('battleId'));
    const code = normalizeCode(url.searchParams.get('code'));
    const meta = { role, clientId, battleId, code, playerId: '', reconnectToken: '', ip, connectedAt: now(), lastSeen: now(), lastPong: now(), msgWindowStart: now(), msgCount: 0, invalidMessages: 0 };
    connectionsByIp.set(ip, ipCount + 1);

    const previous = clientsById.get(clientId);
    if (previous && previous !== socket) {
      try { previous.end(); } catch {}
    }
    clientsById.set(clientId, socket);
    metaBySocket.set(socket, meta);
    if (role === 'teacher' && battleId && code) {
      const registration = registerTeacher(socket, battleId, code);
      if (!registration.ok) {
        sendJson(socket, systemMessage('SERVER_CODE_CONFLICT', { reason: registration.reason, battleCode: code }, clientId));
        socket.end(frameControl(0x8));
        return;
      }
    }
    if (role === 'student' && battleId) addStudentToBattle(socket, battleId);

    socket.on('data', createFrameParser(socket));
    socket.on('error', err => log('WS error', clientId, err.message));
    socket.on('close', () => cleanupSocket(socket));
    socket.on('end', () => cleanupSocket(socket));

    sendJson(socket, systemMessage('SERVER_HELLO', {
      clientId,
      role,
      battleId,
      code,
      status: 'live',
      serverTime: now()
    }, clientId));

    if (role === 'teacher' && battleId) {
      broadcastStudents(battleId, systemMessage('TRANSPORT_STATUS', { battleId, status: 'live' }));
    }
    log('WS connected', role, clientId, battleId || '-', code || '-');
  } catch (err) {
    try { socket.destroy(); } catch {}
  }
});

function cleanupSocket(socket) {
  const meta = metaBySocket.get(socket);
  if (!meta) return;
  const isCurrentClient = clientsById.get(meta.clientId) === socket;
  const isCurrentTeacher = meta.role === 'teacher' && teachersByBattleId.get(meta.battleId) === socket;
  metaBySocket.delete(socket);
  if (isCurrentClient) clientsById.delete(meta.clientId);
  if (meta.ip) {
    const n = Math.max(0, (connectionsByIp.get(meta.ip) || 1) - 1);
    if (n) connectionsByIp.set(meta.ip, n); else connectionsByIp.delete(meta.ip);
  }

  if (meta.role === 'teacher') {
    unregisterTeacher(socket);
    if (isCurrentTeacher) {
      roomRegistry.detachTeacher(socket);
      broadcastStudents(meta.battleId, systemMessage('TRANSPORT_STATUS', {
        battleId: meta.battleId,
        status: 'reconnecting',
        reason: 'teacher_offline'
      }));
    }
  } else {
    if (meta.battleId) {
      const set = studentsByBattleId.get(meta.battleId);
      set?.delete(socket);
      if (set && set.size === 0) studentsByBattleId.delete(meta.battleId);
      if (isCurrentClient && meta.playerId) {
        const teacher = teachersByBattleId.get(meta.battleId);
        if (teacher) {
          sendJson(teacher, systemMessage('PLAYER_DISCONNECTED', {
            battleId: meta.battleId,
            playerId: meta.playerId,
            reason: 'socket_closed'
          }));
        }
      }
    }
  }
  log('WS disconnected', meta.role, meta.clientId, meta.battleId || '-');
}

const heartbeat = setInterval(() => {
  const t = now();
  for (const [socket, meta] of metaBySocket) {
    if (socket.destroyed) continue;
    if (t - meta.lastPong > 45000) {
      try { socket.destroy(); } catch {}
      continue;
    }
    try { socket.write(frameControl(0x9, Buffer.from('hb'))); } catch {}
  }
}, 15000);
heartbeat.unref?.();

server.listen(PORT, HOST, () => {
  log(`SUMUS QUIZ BATTLE ${BUILD} PUBLIC (${COMMIT}) listening on http://localhost:${PORT}`);
  const nets = os.networkInterfaces();
  for (const entries of Object.values(nets)) {
    for (const entry of entries || []) {
      if (entry.family === 'IPv4' && !entry.internal) {
        console.log(`LAN URL (dev only): http://${entry.address}:${PORT}`);
      }
    }
  }
  console.log('PUBLIC SERVER READY');
  console.log('WebSocket endpoint ready: /ws');
  console.log('Teacher: open the public HTTPS URL with ?role=teacher.');
  console.log('Students: open the same public HTTPS URL from Wi-Fi or LTE/5G.');
  if (!TEACHER_KEY) console.warn('WARNING: SUMUS_TEACHER_KEY is not configured. Public deployment should set it.');
});
