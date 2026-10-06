// SUMUS ISLAND QUIZ — 실시간 이동형 퀴즈 서버
const express = require('express');
const http = require('http');
const os = require('os');
const path = require('path');
const fs = require('fs');
const QRCode = require('qrcode');
const { Server } = require('socket.io');
const createJR = require('./jr');
const createBK = require('./bk');

const PORT = process.env.PORT || 3000;
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  maxHttpBufferSize: 20e6, pingInterval: 10000, pingTimeout: 20000,
  connectionStateRecovery: { maxDisconnectionDuration: 2 * 60 * 1000, skipMiddlewares: true }, // 폰이 잠깐 끊겨도 그대로 이어짐
});
// 어떤 오류가 나도 서버가 죽지 않게
process.on('uncaughtException', (e) => console.error('[uncaught]', e));
process.on('unhandledRejection', (e) => console.error('[unhandled]', e));

// public 폴더의 파일만 사용 (예전 배포에서 쓰던 F_* 환경변수가 남아 있어도 무시 — 옛 화면이 섞여 나오지 않게)
const fileOr = (_env, file) => fs.readFileSync(path.join(__dirname, 'public', file), 'utf8');
app.get('/host', (_, res) => {
  let html = fileOr('F_HOST', 'host.html');
  if (!html.includes('host-remote.js')) html = html.replace('</body>', '<script src="/host-remote.js"></script>\n</body>');
  res.type('html').send(html);
});
app.get('/control', (_, res) => res.type('html').send(fileOr('F_CONTROL', 'control.html')));
app.get('/mg', (_, res) => res.type('html').send(fileOr('F_MGHOST', 'mg-host.html')));
app.get('/m', (_, res) => res.type('html').send(fileOr('F_MGPLAY', 'mg-play.html')));
app.get('/jr', (_, res) => res.type('html').send(fileOr('', 'jr-host.html')));
app.get('/j', (_, res) => res.type('html').send(fileOr('', 'jr-play.html')));
app.get('/bk', (_, res) => res.type('html').send(fileOr('', 'bk-host.html')));
app.get('/b', (_, res) => res.type('html').send(fileOr('', 'bk-play.html')));
app.get('/host-remote.js', (_, res) => res.type('js').send(fileOr('F_HOSTREMOTE', 'host-remote.js')));
app.use(express.static(path.join(__dirname, 'public')));
app.get('/', (_, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/play', (_, res) => res.sendFile(path.join(__dirname, 'public', 'play.html')));

function lanIPs() {
  const out = [];
  for (const list of Object.values(os.networkInterfaces())) {
    for (const n of list || []) if (n.family === 'IPv4' && !n.internal) out.push(n.address);
  }
  // 사설망 대역 우선
  return out.sort((a, b) => (/^192\.168\./.test(b) ? 1 : 0) - (/^192\.168\./.test(a) ? 1 : 0));
}
app.get('/api/info', (_, res) => res.json({ ips: lanIPs(), port: PORT }));
app.get('/api/qr', async (req, res) => {
  try {
    const buf = await QRCode.toBuffer(String(req.query.text || ''), { margin: 1, width: 480, color: { dark: '#0b2a4a', light: '#ffffff' } });
    res.type('png').send(buf);
  } catch (e) { res.status(400).end(); }
});

// ───────── 게임 상수 ─────────
const TICK = 25;            // 40Hz 물리 (위치 전송은 2틱마다 = 20Hz, 화면에서 보간)
const SPEED = 0.92;         // 섬 반지름(1) 기준 초당 이동량
const AUTO_MS = 5000;       // 자동 진행: 정답 공개 후 다음 단계까지
const P_R = 0.04;           // 캐릭터 충돌 반경
const ISLAND_R = 0.93;
const COLORS = ['#ff4d6d', '#3d7bff', '#22c55e', '#ffb020', '#a855f7', '#14b8a6', '#f97316', '#ec4899', '#64748b', '#0ea5e9'];

function zonesFor(n) {
  if (n === 2) return [{ x: -0.45, y: 0.02, r: 0.33 }, { x: 0.45, y: 0.02, r: 0.33 }];
  if (n === 3) return [{ x: -0.52, y: -0.18, r: 0.28 }, { x: 0.52, y: -0.18, r: 0.28 }, { x: 0, y: 0.5, r: 0.28 }];
  return [{ x: -0.42, y: -0.4, r: 0.27 }, { x: 0.42, y: -0.4, r: 0.27 }, { x: -0.42, y: 0.42, r: 0.27 }, { x: 0.42, y: 0.42, r: 0.27 }];
}

const rooms = new Map();
const rand = (a, b) => a + Math.random() * (b - a);
const uid = () => Math.random().toString(36).slice(2, 10);

const MAX_ROOMS = 300; // 장난으로 방을 끝없이 만들어 서버가 멈추지 않게
const FULL = { ok: false, error: '지금은 방을 더 열 수 없습니다. 잠시 후 다시 시도해 주세요.' };

// ───────── 수업 방(세션): 한 방 번호에 PART 1·2·3 방이 함께 묶여 있음 ─────────
const mgRooms = new Map();
const sessions = new Map(); // pin → { key, active: 'quiz'|'mg'|'jr', cfgs: { quiz, mg, jr } }
const KINDS = {};           // 게임 종류별 정보 (아래에서 채움)
const kindList = () => Object.keys(KINDS);
function newPin() {
  if (kindList().reduce((n, k) => n + KINDS[k].rooms.size, 0) >= MAX_ROOMS) return null;
  for (let k = 0; k < 500; k++) {
    const p = String(Math.floor(1000 + Math.random() * 9000));
    if (!sessions.has(p) && !kindList().some(kk => KINDS[kk].rooms.has(p))) return p;
  }
  return null;
}
// 다른 게임이 이 번호를 쓰고 있어도 같은 수업 방 키를 가졌으면 함께 쓸 수 있음 (서버 재시작 직후 학생이 먼저 만든 빈 퀴즈 방(orphan)은 비어 있는 것으로 봄)
function pinFreeFor(kind, pin, sk) {
  for (const k of kindList()) {
    if (k === kind) continue;
    const o = KINDS[k].rooms.get(pin);
    if (o && !o.orphan) { const s = sessions.get(pin); if (!(sk && s && s.key === sk)) return false; }
  }
  return true;
}
// 지정한 번호로 만들 수 있으면 그 번호, 아니면 새 번호
function claimPin(kind, want, sk, socket) {
  if (socket && !socket.canCreate()) return null;
  want = /^\d{4}$/.test(String(want || '')) ? String(want) : null;
  if (want && !KINDS[kind].rooms.has(want) && pinFreeFor(kind, want, sk)) return want;
  return newPin();
}
// 서버가 다시 켜져 세션이 사라졌으면 호스트가 가진 키로 다시 묶음
function linkSession(pin, sk, kind) { if (sk && !sessions.has(pin)) sessions.set(pin, { key: sk, active: kind, cfgs: {} }); }
const linked = (r) => { const s = r && sessions.get(r.pin); return !!(s && r.sk === s.key); };
// 수업 방에서 지금 진행하지 않는 쪽 게임인지 (듀얼 모니터 조작 창 등이 뒤에서 진행시키지 않게)
const inactive = (r, kind) => { const s = linked(r) && sessions.get(r.pin); return !!(s && s.active !== kind); };
// 같은 수업 방의 다른 게임 방들
function peersOf(r) {
  if (!linked(r)) return [];
  return kindList().filter(k => k !== r.kind).map(k => [k, KINDS[k].rooms.get(r.pin)]).filter(([, o]) => o && linked(o));
}
const lastTouched = (r) => Math.max(r.touched, ...peersOf(r).map(([, o]) => o.touched));
// 다른 게임에서 넘어온 학생이면 이름·색·번호를 그대로 이어받기
function carryFrom(r, pid) { for (const [, o] of peersOf(r)) { const p = o.players.get(pid); if (p && !p.bot) return p; } return null; }
// 지금 진행 중인 게임이 다른 것이면 그쪽 학생 주소를 알려 줌
function activeRedirect(kind, pin) {
  const s = sessions.get(pin);
  if (s && s.active !== kind && KINDS[s.active] && KINDS[s.active].rooms.has(pin)) return KINDS[s.active].path + '?pin=' + pin + '&auto=1';
  return null;
}
// 수업 방이 아닌데 다른 게임 방이 그 번호를 쓰고 있으면 그쪽으로 안내
function otherKindRedirect(kind, pin) {
  for (const k of kindList()) if (k !== kind && KINDS[k].rooms.has(pin)) return KINDS[k].path + '?pin=' + pin + '&auto=1';
  return null;
}
// 한 게임에서 내보내면 같은 수업 방의 다른 게임에서도 빠짐
function removeFromPeers(r, id, kind) {
  const all = [[kind, r], ...peersOf(r)];
  for (const [k, o] of all) {
    const p = o.players.get(id); if (!p) continue;
    o.players.delete(id);
    if (p.socketId) { io.to(p.socketId).emit(KINDS[k].kicked); io.in(p.socketId).socketsLeave(kindList().map(kk => KINDS[kk].sockRoom(r.pin))); }
    KINDS[k].emitRoster(o);
  }
}
// 서버 재시작 직후 /play 쪽 빈 방에서 기다리던 학생들을 새로 열린 게임으로 데려옴
function adoptOrphans(kind, pin, isLinked) {
  const o = KINDS.quiz.rooms.get(pin);
  if (!o || !o.orphan || kind === 'quiz') return;
  if (!isLinked) KINDS.quiz.rooms.delete(pin); else sessions.get(pin).active = kind;
  io.to(pin).emit('goto', KINDS[kind].path + '?pin=' + pin + '&auto=1');
}
const gameCtx = { io, uid, rand, COLORS, linked, inactive, carryFrom, activeRedirect, removeFromPeers, claimPin, linkSession, adoptOrphans, FULL };
const jr = createJR(gameCtx);
const bk = createBK(gameCtx);

function spawnPos(room) {
  const zs = room.zones || [];
  for (let k = 0; k < 40; k++) {
    const a = rand(0, Math.PI * 2), d = Math.sqrt(Math.random()) * 0.22;
    const x = Math.cos(a) * d, y = Math.sin(a) * d * 0.9 + (room.n === 3 ? -0.1 : 0);
    if (!zs.some(z => Math.hypot(x - z.x, y - z.y) < z.r)) return { x, y };
  }
  return { x: rand(-0.1, 0.1), y: rand(-0.1, 0.1) };
}

// 위치를 서버가 강제로 옮길 때(출발 위치 모으기·부활 등): 폰이 자기 위치를 따라오게 알려 줌
function teleport(p, pos) {
  Object.assign(p, pos); p.ep = (p.ep || 0) + 1; p.cAt = 0;
  if (p.socketId) io.to(p.socketId).emit('tp', { x: p.x, y: p.y, ep: p.ep });
}
function publicPlayer(p) {
  return { id: p.id, name: p.name, color: p.color, alive: p.alive, score: p.score, connected: p.connected || p.bot, bot: !!p.bot };
}
function roster(room) { return [...room.players.values()].map(publicPlayer); }

function phasePayload(room) {
  const q = room.questions[room.qIndex];
  const base = {
    phase: room.phase, mode: room.mode, qIndex: room.qIndex, total: room.questions.length,
    alive: [...room.players.values()].filter(p => p.alive).length,
    remain: room.endsAt ? Math.max(0, room.endsAt - Date.now()) : 0,
    timeLimit: q ? q.time : 0,
  };
  if (q && (room.phase === 'question' || room.phase === 'reveal')) {
    base.q = { text: q.text, image: q.image || null, options: q.options.map(o => ({ text: o.text, image: o.image || null })) };
    base.zones = room.zones;
  }
  if (room.phase === 'reveal') base.reveal = room.lastReveal;
  base.auto = !!room.auto;
  base.autoRemain = room.autoAt ? Math.max(0, room.autoAt - Date.now()) : 0;
  if (room.phase === 'end') base.result = room.result;
  return base;
}

function hostInfo(room) {
  const q = room.questions[room.qIndex], nq = room.questions[room.qIndex + 1];
  return { answer: q ? q.answer : null, next: nq ? { text: nq.text, options: nq.options.map(o => o.text) } : null, left: Math.max(0, room.questions.length - room.qIndex - 1) };
}
function emitPhase(room) { io.to(room.pin).emit('phase', phasePayload(room)); io.to(room.pin + '#h').emit('hostinfo', hostInfo(room)); }
function emitRoster(room) { io.to(room.pin).emit('roster', roster(room)); }

function zoneOf(room, p) {
  if (!room.zones) return -1;
  for (let i = 0; i < room.zones.length; i++) {
    const z = room.zones[i];
    if (Math.hypot(p.x - z.x, p.y - z.y) <= z.r) return i;
  }
  return -1;
}

function startQuestion(room) {
  clearTimeout(room.autoTimer); room.autoAt = 0;
  const q = room.questions[room.qIndex];
  room.n = q.options.length;
  room.zones = zonesFor(room.n);
  room.phase = 'question';
  room.endsAt = Date.now() + q.time * 1000;
  for (const p of room.players.values()) {
    if (p.alive && room.gather) teleport(p, spawnPos(room));
    if (p.bot) p.botTarget = Math.random() < 0.85 ? Math.floor(Math.random() * room.n) : -1, p.botDelay = rand(0.5, q.time * 0.8);
  }
  clearTimeout(room.timer);
  room.timer = setTimeout(() => reveal(room), q.time * 1000 + 80);
  emitPhase(room);
}

function reveal(room) {
  if (room.phase !== 'question') return;
  clearTimeout(room.timer);
  const q = room.questions[room.qIndex];
  const counts = new Array(room.n).fill(0);
  const alivePlayers = [...room.players.values()].filter(p => p.alive);
  const wrong = [];
  for (const p of alivePlayers) {
    const z = zoneOf(room, p);
    if (z >= 0) counts[z]++;
    if (z === q.answer) p.score += 100, p.streak = (p.streak || 0) + 1;
    else wrong.push(p), p.streak = 0;
  }
  let saved = false;
  let eliminated = [];
  if (room.mode === 'survival') {
    if (wrong.length === alivePlayers.length && alivePlayers.length > 0) saved = true; // 전원 오답 → 모두 생존
    else { eliminated = wrong.map(p => p.id); wrong.forEach(p => { p.alive = false; p.ix = 0; p.iy = 0; }); }
  }
  room.lastReveal = { correct: q.answer, counts, eliminated, wrong: wrong.map(p => p.id), saved, at: Date.now() };
  room.phase = 'reveal';
  room.endsAt = 0;
  scheduleAuto(room);
  emitPhase(room);
  emitRoster(room);
}

function finish(room) {
  clearTimeout(room.timer); clearTimeout(room.autoTimer); room.autoAt = 0;
  const ps = [...room.players.values()];
  const survivors = ps.filter(p => p.alive);
  const ranking = ps.slice().sort((a, b) => (b.alive - a.alive) * (room.mode === 'survival' ? 1 : 0) || b.score - a.score)
    .map(p => ({ id: p.id, name: p.name, color: p.color, score: p.score, alive: p.alive }));
  room.result = { mode: room.mode, survivors: survivors.map(p => p.id), ranking };
  room.phase = 'end';
  emitPhase(room);
}

// 서바이벌: 2명 이상으로 시작했는데 1명만 남으면 종료 (혼자 테스트할 땐 계속 진행)
function shouldFinish(room) {
  const last = room.qIndex >= room.questions.length - 1;
  const ps = [...room.players.values()], aliveN = ps.filter(p => p.alive).length;
  return last || (room.mode === 'survival' && ps.length >= 2 && aliveN <= 1);
}
function scheduleAuto(room) {
  clearTimeout(room.autoTimer); room.autoAt = 0;
  if (!room.auto || room.phase !== 'reveal') return;
  // 준비된 문제가 남았거나 게임이 끝나는 경우에만 자동 진행 (즉석 문제만 낼 땐 기다림)
  if (room.qIndex >= room.questions.length - 1 && !shouldFinish(room)) return;
  room.autoAt = Date.now() + AUTO_MS;
  room.autoTimer = setTimeout(() => { room.autoAt = 0; if (room.phase === 'reveal') next(room); }, AUTO_MS);
}
function next(room) {
  clearTimeout(room.autoTimer); room.autoAt = 0;
  if (room.phase === 'question') return reveal(room);
  if (room.phase === 'reveal' && shouldFinish(room)) return finish(room);
  if (room.phase === 'lobby' && !room.questions.length) return;
  if ((room.phase === 'lobby' || room.phase === 'reveal') && room.qIndex < room.questions.length - 1) { room.qIndex++; startQuestion(room); }
}

function resetRoom(room) {
  clearTimeout(room.timer); clearTimeout(room.autoTimer); room.autoAt = 0;
  room.phase = 'lobby'; room.qIndex = -1; room.zones = null; room.endsAt = 0; room.result = null; room.lastReveal = null;
  for (const p of room.players.values()) { p.alive = true; p.score = 0; p.streak = 0; teleport(p, spawnPos(room)); }
  emitPhase(room); emitRoster(room);
}

// ───────── 물리 루프 ─────────
let tickN = 0;
setInterval(() => {
  tickN++;
  try { tickRooms(); } catch (e) { console.error('[tick]', e); }
  try { mgTick(); } catch (e) { console.error('[mgtick]', e); }
  try { jr.tick(Date.now(), tickN); } catch (e) { console.error('[jrtick]', e); }
  try { bk.tick(Date.now(), tickN); } catch (e) { console.error('[bktick]', e); }
}, TICK);
function tickRooms() {
  const dt = TICK / 1000;
  for (const room of rooms.values()) try {
    const movable = room.phase === 'lobby' || room.phase === 'question';
    const list = [...room.players.values()].filter(p => p.alive);
    if (movable) {
      const nowMs = Date.now();
      for (const p of list) {
        if (!p.bot && p.cAt && nowMs - p.cAt < 700) {
          // 폰이 직접 계산해 보낸 위치를 따라감 — 최대 속도를 넘는 순간이동은 막음
          let dx = p.cx - p.x, dy = p.cy - p.y; const d = Math.hypot(dx, dy), maxStep = SPEED * 1.4 * dt + 0.004;
          if (d > maxStep) { dx *= maxStep / d; dy *= maxStep / d; }
          p.x += dx; p.y += dy; p.moving = !!p.cmv; p.face = p.cface || p.face;
          continue;
        }
        if (p.bot) botThink(room, p);
        let ix = p.ix || 0, iy = p.iy || 0;
        const m = Math.hypot(ix, iy); if (m > 1) { ix /= m; iy /= m; }
        // 봇은 가속·감속을 주어 사람처럼 부드럽게
        p.vx = (p.vx || 0) + (ix * SPEED - (p.vx || 0)) * Math.min(1, dt * 12); p.vy = (p.vy || 0) + (iy * SPEED - (p.vy || 0)) * Math.min(1, dt * 12);
        p.x += p.vx * dt; p.y += p.vy * dt;
        if (Math.abs(p.vx) > 0.05) p.face = p.vx < 0 ? -1 : 1;
        p.moving = Math.hypot(p.vx, p.vy) > 0.08;
      }
      for (const p of list) {
        const d = Math.hypot(p.x, p.y);
        if (d > ISLAND_R) { p.x *= ISLAND_R / d; p.y *= ISLAND_R / d; }
      }
    } else for (const p of list) p.moving = false;

    if (tickN % 2 === 0 && room.players.size) {
      const arr = [];
      for (const p of room.players.values()) arr.push(p.id, Math.round(p.x * 1000), Math.round(p.y * 1000), (p.alive ? 1 : 0) | (p.moving ? 2 : 0) | (p.face === -1 ? 4 : 0));
      io.to(room.pin).volatile.emit('s', arr, Date.now());
    }
  } catch (e) { console.error('[tick-room]', room.pin, e); }
}

function botThink(room, p) {
  if (room.phase === 'question') {
    if (p.botTarget === undefined) { p.botTarget = Math.random() < 0.85 ? Math.floor(Math.random() * room.n) : -1; p.botDelay = rand(0.5, room.questions[room.qIndex].time * 0.8); } // 문제 도중에 추가된 봇
    const elapsed = (room.questions[room.qIndex].time * 1000 - (room.endsAt - Date.now())) / 1000;
    if (elapsed < p.botDelay || p.botTarget < 0) { p.ix = Math.sin(Date.now() / 700 + p.seed) * 0.4; p.iy = Math.cos(Date.now() / 900 + p.seed) * 0.4; return; }
    const z = room.zones[p.botTarget];
    const tx = z.x + Math.cos(p.seed) * z.r * 0.5, ty = z.y + Math.sin(p.seed) * z.r * 0.5;
    const dx = tx - p.x, dy = ty - p.y, d = Math.hypot(dx, dy);
    if (d < 0.03) { p.ix = p.iy = 0; } else { p.ix = dx / d; p.iy = dy / d; }
  } else {
    if (!p.wander || Date.now() > p.wanderUntil) {
      p.wander = Math.random() < 0.5 ? [0, 0] : [rand(-1, 1), rand(-1, 1)];
      p.wanderUntil = Date.now() + rand(600, 2200);
    }
    [p.ix, p.iy] = p.wander;
  }
}

// ───────── 소켓 ─────────
function newRoom(pin, extra) {
  return Object.assign({ pin, kind: 'quiz', hostKey: null, players: new Map(), questions: [], mode: 'survival', gather: true, auto: true,
    phase: 'lobby', qIndex: -1, zones: null, n: 0, endsAt: 0, touched: Date.now() }, extra);
}
io.on('connection', (socket) => {
  // 잘못된 데이터가 와도 서버가 죽지 않도록 모든 이벤트를 감쌈
  const on = (ev, fn) => socket.on(ev, (...a) => { try { fn(...a); } catch (e) { console.error('[' + ev + ']', e); } });
  // 방 만들기는 한 연결에서 1분에 10번까지
  let made = [];
  socket.canCreate = () => { const now = Date.now(); made = made.filter(t => now - t < 60e3); if (made.length >= 10) return false; made.push(now); return true; };
  setup(socket, on);
  setupMG(socket, on);
  jr.setup(socket, on);
  bk.setup(socket, on);
  setupSession(socket, on);
});
function setup(socket, on) {
  on('host:create', (cfg, ack) => {
    cfg = cfg || {};
    if (!socket.canCreate()) return ack && ack(FULL);
    const qs = sanitizeQuestions(cfg.questions);
    // 서버 재시작 후 같은 방 번호로 다시 열기: 학생들이 먼저 재접속해 만들어 둔 빈 방을 이어받음
    const want = /^\d{4}$/.test(String(cfg.pin || '')) ? String(cfg.pin) : null;
    let room = want && rooms.get(want);
    const sk = typeof cfg.sk === 'string' ? cfg.sk : null;
    const settings = { hostKey: uid(), hostSocket: socket.id, questions: qs, mode: cfg.mode === 'score' ? 'score' : 'survival', gather: cfg.gather !== false, auto: cfg.auto !== false, orphan: false, touched: Date.now() };
    if (room && room.orphan) Object.assign(room, settings);
    else {
      const pin = want && !rooms.has(want) && pinFreeFor('quiz', want, sk) ? want : newPin();
      if (!pin) return ack && ack(FULL);
      room = newRoom(pin, settings); rooms.set(pin, room);
    }
    const pin = room.pin;
    if (sk && pin === want) { linkSession(pin, sk, 'quiz'); room.sk = sk; }
    console.log('[room]', pin, 'opened', qs.length + ' questions', want ? '(asked ' + want + ')' : '');
    socket.join(pin); socket.join(pin + '#h'); socket.data = { role: 'host', pin };
    ack && ack({ ok: true, pin, hostKey: room.hostKey });
    emitPhase(room); emitRoster(room);
  });

  on('host:resume', (d, ack) => {
    const { pin, hostKey } = d || {};
    const room = rooms.get(String(pin));
    if (!room || !hostKey || room.hostKey !== hostKey) return ack && ack({ ok: false });
    room.hostSocket = socket.id; socket.join(room.pin); socket.join(room.pin + '#h'); socket.data = { role: 'host', pin: room.pin };
    ack && ack({ ok: true, pin: room.pin, mode: room.mode });
    socket.emit('phase', phasePayload(room)); socket.emit('roster', roster(room)); socket.emit('hostinfo', hostInfo(room));
  });

  const hostRoom = () => {
    const d = socket.data || {};
    if (d.role !== 'host') return null;
    const r = rooms.get(d.pin); if (!r || inactive(r, 'quiz')) return null;
    r.touched = Date.now(); return r;
  };
  on('host:next', () => { const r = hostRoom(); if (r) next(r); });
  on('host:finish', () => { const r = hostRoom(); if (r && r.phase !== 'lobby') finish(r); });
  on('host:reset', () => { const r = hostRoom(); if (r) resetRoom(r); });
  on('host:config', (cfg) => {
    const r = hostRoom(); if (!r || r.phase !== 'lobby') return;
    if (cfg.mode) r.mode = cfg.mode === 'score' ? 'score' : 'survival';
    if (typeof cfg.gather === 'boolean') r.gather = cfg.gather;
    if (cfg.questions) { const qs = sanitizeQuestions(cfg.questions); if (qs.length) r.questions = qs; }
    emitPhase(r);
  });
  // 즉석 문제: 지금 바로 다음 문제로 끼워 넣고 시작
  on('host:live', (q, ack) => {
    const r = hostRoom(); if (!r) return ack && ack({ ok: false, error: '방이 없습니다.' });
    if (r.phase === 'question') return ack && ack({ ok: false, error: '문제 진행 중에는 낼 수 없습니다.' });
    const [one] = sanitizeQuestions([q], true);
    if (!one) return ack && ack({ ok: false, error: '보기를 2개 이상 입력하세요.' });
    if (r.phase === 'end') { // 결과 화면에서 내면 이어서 진행
      r.result = null;
    }
    r.questions.splice(r.qIndex + 1, 0, one);
    r.qIndex++;
    startQuestion(r);
    ack && ack({ ok: true });
  });
  on('host:auto', (v) => {
    const r = hostRoom(); if (!r) return;
    r.auto = !!v; scheduleAuto(r); emitPhase(r);
  });
  on('host:kick', (id) => {
    const r = hostRoom(); if (!r) return;
    if (!r.players.has(id)) return;
    removeFromPeers(r, id, 'quiz');
  });
  on('host:revive', (id) => {
    const r = hostRoom(); if (!r) return;
    const p = r.players.get(id); if (!p || p.alive) return;
    p.alive = true; teleport(p, spawnPos(r)); emitRoster(r);
  });
  on('host:bots', (n) => {
    const r = hostRoom(); if (!r) return;
    const names = ['민준', '서연', '도윤', '하은', '시우', '지유', '예준', '수아', '주원', '지호', '서윤', '하준', '지안', '은우', '채원'];
    for (let i = 0; i < Math.min(30, n | 0); i++) {
      const id = 'bot_' + uid();
      r.players.set(id, { id, bot: true, seed: rand(0, 6.28), name: names[Math.floor(Math.random() * names.length)] + '(봇)', color: COLORS[r.players.size % COLORS.length], alive: r.phase === 'lobby' || r.mode === 'score', score: 0, ix: 0, iy: 0, face: 1, ...spawnPos(r) });
    }
    emitRoster(r);
  });
  on('host:clearbots', () => {
    const r = hostRoom(); if (!r) return;
    for (const [id, p] of r.players) if (p.bot) r.players.delete(id);
    emitRoster(r);
  });

  on('player:join', (d, ack) => {
    let { pin, name, pid, color } = d || {};
    pin = String(pin || '').trim();
    let room = rooms.get(pin);
    const go = activeRedirect('quiz', pin);
    if (go) return ack && ack({ ok: false, redirect: go });
    // 서버가 다시 켜진 직후: 전에 들어와 있던 학생이면 같은 번호의 빈 방을 만들어 기다림
    // (서버가 켜진 지 10분 이내일 때만 — 오래된 방 번호로 유령 방이 생기지 않게)
    const other = !room && otherKindRedirect('quiz', pin);
    if (other) return ack && ack({ ok: false, redirect: other });
    if (!room && pid && /^\d{4}$/.test(pin) && process.uptime() < 600) { room = newRoom(pin, { orphan: true }); rooms.set(pin, room); }
    if (!room) { console.log('[join-fail] no room', pin); return ack && ack({ ok: false, error: '방 번호를 확인해 주세요. 선생님 화면의 번호가 바뀌었을 수 있어요.' }); }
    name = String(name || '').trim().slice(0, 8);
    let p = pid && room.players.get(pid);
    // 같은 수업 방의 다른 게임에서 넘어온 학생: 이름·색·번호 그대로
    const carry = !p && pid && carryFrom(room, pid);
    if (carry) { name = name || carry.name; if (!COLORS.includes(color)) color = carry.color; }
    if (!p) {
      if (!name) return ack && ack({ ok: false, error: '이름을 입력해 주세요.' });
      if (room.players.size >= 60) return ack && ack({ ok: false, error: '방이 가득 찼습니다.' });
      const id = carry ? pid : uid();
      p = { id, name, color: COLORS.includes(color) ? color : COLORS[room.players.size % COLORS.length], score: 0, streak: 0, ix: 0, iy: 0, face: 1,
        alive: room.phase === 'lobby' || room.mode === 'score', ...spawnPos(room) };
      room.players.set(id, p);
    } else {
      if (name) p.name = name;
      if (COLORS.includes(color)) p.color = color;
    }
    p.socketId = socket.id; p.connected = true;
    socket.join(room.pin); socket.data = { role: 'player', pin: room.pin, pid: p.id };
    room.touched = Date.now();
    console.log('[join]', room.pin, p.name, room.orphan ? '(waiting host)' : '', 'players=' + room.players.size);
    ack && ack({ ok: true, pid: p.id, me: publicPlayer(p), colors: COLORS, pos: { x: p.x, y: p.y, ep: p.ep | 0 } });
    socket.emit('phase', phasePayload(room));
    emitRoster(room);
  });

  let logs = 0;
  on('clientlog', (d) => { if (++logs > 20) return; d = d || {}; console.log('[client]', String(d.pin || ''), String(d.msg || '').slice(0, 300), '|', String(d.ua || '').slice(0, 160)); });
  // 폰이 직접 움직인 위치 보고 [x, y, face, moving, epoch]
  on('p', (v) => {
    const d = socket.data || {};
    if (d.role !== 'player' || !Array.isArray(v)) return;
    const room = rooms.get(d.pin); const p = room && room.players.get(d.pid);
    if (!p || !p.alive || (v[4] | 0) !== (p.ep | 0)) return;
    let x = Number(v[0]), y = Number(v[1]); if (!isFinite(x) || !isFinite(y)) return;
    const r = Math.hypot(x, y); if (r > ISLAND_R) { x *= ISLAND_R / r; y *= ISLAND_R / r; }
    p.cx = x; p.cy = y; p.cface = v[2] < 0 ? -1 : 1; p.cmv = !!v[3]; p.cAt = Date.now();
  });
  on('time', (_, ack) => { typeof ack === 'function' && ack(Date.now()); });
  on('i', (v) => {
    const d = socket.data || {};
    if (d.role !== 'player') return;
    const room = rooms.get(d.pin); const p = room && room.players.get(d.pid);
    if (!p || !p.alive || !Array.isArray(v)) return;
    const x = Number(v[0]) || 0, y = Number(v[1]) || 0;
    p.ix = Math.max(-1, Math.min(1, x)); p.iy = Math.max(-1, Math.min(1, y));
  });

  on('disconnect', () => {
    const d = socket.data || {};
    const room = rooms.get(d.pin); if (!room) return;
    if (d.role === 'player') {
      const p = room.players.get(d.pid);
      if (p && p.socketId === socket.id) { p.connected = false; p.ix = p.iy = 0; emitRoster(room); }
    }
  });
}

function sanitizeQuestions(qs, allowBlank) {
  if (!Array.isArray(qs)) return [];
  return qs.map(q => {
    const options = (q.options || []).slice(0, 4).map(o => ({
      text: String((o && o.text) || '').slice(0, 60),
      image: typeof (o && o.image) === 'string' && o.image.startsWith('data:image/') ? o.image : null,
    })).filter(o => o.text || o.image);
    const answer = Math.max(0, Math.min(options.length - 1, Number(q.answer) || 0));
    return {
      text: String(q.text || '').slice(0, 140),
      image: typeof q.image === 'string' && q.image.startsWith('data:image/') ? q.image : null,
      options, answer, time: Math.max(5, Math.min(60, Number(q.time) || 10)),
    };
  }).filter(q => (allowBlank || q.text || q.image) && q.options.length >= 2);
}

// ═══════════════════════════════════════════════════════════════
// PART 2 — 무궁화 꽃이 피었습니다 (술래가 볼 때 움직이면 잡힘)
// ═══════════════════════════════════════════════════════════════
const MG_SYL = ['무', '궁', '화', '꽃', '이', '피', '었', '습', '니', '다'];
const MG_SPEED = 0.062;   // 트랙 길이 1 → 계속 달리면 약 16초 (5~6바퀴 걸려 난이도가 끝까지 올라감)
// 레벨별 난이도: 음절 간격, 흔들림, 막판 가속 확률, 중간 멈춤(속임) 확률, 반응 유예, 보는 시간, 두 번 돌아보기, 꽃게 술래 등장 확률
const MG_LV = [null,
  { syl: 0.42, jit: 0.05, accel: 0.0, fake: 0.0, grace: 0.75, look: [1.8, 2.2], dbl: 0.0, crab: 0.0 },
  { syl: 0.35, jit: 0.10, accel: 0.3, fake: 0.15, grace: 0.62, look: [1.8, 2.6], dbl: 0.0, crab: 0.0 },
  { syl: 0.30, jit: 0.15, accel: 0.45, fake: 0.3, grace: 0.52, look: [2.0, 3.0], dbl: 0.2, crab: 0.4 },
  { syl: 0.25, jit: 0.20, accel: 0.55, fake: 0.45, grace: 0.46, look: [2.0, 3.2], dbl: 0.35, crab: 0.55 },
  { syl: 0.21, jit: 0.25, accel: 0.65, fake: 0.55, grace: 0.42, look: [2.2, 3.5], dbl: 0.5, crab: 0.7 },
];
function mgNewRoom(pin, cfg) {
  cfg = cfg || {};
  const lv = Math.max(1, Math.min(5, Number(cfg.level) || 1));
  return { pin, kind: 'mg', hostKey: uid(), players: new Map(), mode: cfg.mode === 'back' ? 'back' : 'out', time: Math.max(30, Math.min(300, Number(cfg.time) || 120)),
    startLevel: lv, level: lv, phase: 'lobby', cycle: 0, main: 'back', crab: 'off', syl: 0, finN: 0, touched: Date.now() };
}

function mgPublic(p) { return { id: p.id, name: p.name, color: p.color, state: p.state, order: p.order || 0, backs: p.backs || 0, connected: p.connected || p.bot, bot: !!p.bot }; }
function mgRoster(r) { return [...r.players.values()].map(mgPublic); }
function mgPhaseMsg(r) {
  return { phase: r.phase, mode: r.mode, level: r.level, timeLimit: r.time, remain: r.endsAt ? Math.max(0, r.endsAt - Date.now()) : 0,
    readyRemain: r.readyAt ? Math.max(0, r.readyAt - Date.now()) : 0, result: r.phase === 'end' ? r.result : null, startLevel: r.startLevel };
}
function mgWatch(r) { return { main: r.main, syl: r.syl, crab: r.crab, level: r.level, cycle: r.cycle, crabOn: r.level >= 3 && MG_LV[r.level].crab > 0 }; }
const mgEmitPhase = (r) => io.to('mg' + r.pin).emit('mg:phase', mgPhaseMsg(r));
const mgEmitWatch = (r) => io.to('mg' + r.pin).emit('mg:w', mgWatch(r));
const mgEmitRoster = (r) => io.to('mg' + r.pin).emit('mg:roster', mgRoster(r));

function mgLane(r) { const i = r.laneN = (r.laneN || 0) + 1; return ((i * 0.6180339) % 1) * 1.6 - 0.8; }

// 한 바퀴(외치기 → 돌아보기) 일정표 만들기
function mgPlanCycle(r) {
  const L = MG_LV[r.level], ev = []; let t = 0.5;
  const accel = Math.random() < L.accel, fakeAt = Math.random() < L.fake ? 3 + Math.floor(Math.random() * 5) : -1;
  for (let i = 0; i < 10; i++) {
    let d = L.syl * rand(1 - L.jit, 1 + L.jit);
    if (accel && i >= 6) d *= 0.45;                 // 막판에 갑자기 빨라짐
    if (i === fakeAt) t += rand(0.9, 1.7);          // 중간에 뜸 들이기 (돌아보지는 않음)
    ev.push({ at: t, type: 'syl', n: i + 1 }); t += d;
  }
  const chantEnd = t;
  // 꽃게 술래: 외치는 도중 경고 후 힐끔 (경고 0.8초 → 보기 1.2초)
  if (r.level >= 3 && Math.random() < L.crab && chantEnd > 3.2) {
    const w = rand(0.8, chantEnd - 2.3);
    ev.push({ at: w, type: 'crab', s: 'warn' }, { at: w + 0.8, type: 'crab', s: 'look' }, { at: w + 2.0, type: 'crab', s: 'idle' });
  }
  ev.push({ at: chantEnd + 0.05, type: 'main', s: 'turn' });
  let lt = chantEnd + 0.4; ev.push({ at: lt, type: 'main', s: 'look' });
  lt += rand(L.look[0], L.look[1]);
  if (Math.random() < L.dbl) { // 두 번 돌아보기: 잠깐 등을 돌렸다가 다시 홱
    ev.push({ at: lt, type: 'main', s: 'back' }); lt += rand(0.45, 0.8);
    ev.push({ at: lt, type: 'main', s: 'turn' }); lt += 0.22;
    ev.push({ at: lt, type: 'main', s: 'look' }); lt += rand(1.0, 1.6);
  }
  ev.push({ at: lt, type: 'main', s: 'back' }, { at: lt + 0.6, type: 'next' });
  ev.sort((a, b) => a.at - b.at);
  r.plan = ev; r.planStart = Date.now(); r.syl = 0; r.main = 'back'; r.crab = r.level >= 3 && L.crab > 0 ? 'idle' : 'off';
  mgEmitWatch(r);
}
function mgDanger(r) { return r.main === 'turn' || r.main === 'look' || r.crab === 'warn' || r.crab === 'look'; }

function mgCatch(r, p, now) {
  if (r.mode === 'back') { p.z = 0; p.backs = (p.backs || 0) + 1; p.run = false; p.immuneUntil = now + 800; }
  else { p.state = 'out'; p.run = false; }
  io.to('mg' + r.pin).emit('mg:caught', { id: p.id, back: r.mode === 'back' });
  mgEmitRoster(r);
}
function mgFinish(r, why) {
  const ps = [...r.players.values()];
  for (const p of ps) if (p.state === 'run') { p.state = 'out'; p.timeout = true; }
  const fin = ps.filter(p => p.state === 'fin').sort((a, b) => a.order - b.order);
  const rest = ps.filter(p => p.state !== 'fin').sort((a, b) => b.z - a.z);
  r.result = { why, ranking: [...fin, ...rest].map(p => ({ id: p.id, name: p.name, color: p.color, fin: p.state === 'fin', order: p.order || 0, z: Math.round(p.z * 100), backs: p.backs || 0, timeout: !!p.timeout })) };
  r.phase = 'end'; r.endsAt = 0; r.main = 'back'; r.crab = 'off';
  mgEmitPhase(r); mgEmitWatch(r); mgEmitRoster(r);
}
function mgReset(r) {
  r.phase = 'lobby'; r.endsAt = 0; r.readyAt = 0; r.cycle = 0; r.level = r.startLevel; r.main = 'back'; r.crab = 'off'; r.syl = 0; r.plan = null; r.result = null; r.finN = 0;
  for (const p of r.players.values()) Object.assign(p, { z: 0, state: 'run', run: false, order: 0, backs: 0, timeout: false });
  mgEmitPhase(r); mgEmitWatch(r); mgEmitRoster(r);
}

function mgTick() {
  const now = Date.now(), dt = TICK / 1000;
  for (const r of mgRooms.values()) {
    if (r.phase === 'ready' && now >= r.readyAt) { r.phase = 'play'; r.readyAt = 0; r.endsAt = now + r.time * 1000; mgPlanCycle(r); mgEmitPhase(r); }
    if (r.phase === 'play') {
      // 일정표 진행
      const el = (now - r.planStart) / 1000;
      while (r.plan && r.plan.length && r.plan[0].at <= el) {
        const e = r.plan.shift();
        if (e.type === 'syl') r.syl = e.n;
        else if (e.type === 'main') { r.main = e.s; if (e.s === 'look') r.mainLookAt = now; }
        else if (e.type === 'crab') { r.crab = e.s; if (e.s === 'look') r.crabLookAt = now; }
        else if (e.type === 'next') { r.cycle++; const lv = Math.min(5, r.startLevel + Math.floor(r.cycle / 2)); if (lv !== r.level) { r.level = lv; mgEmitPhase(r); } mgPlanCycle(r); break; }
        mgEmitWatch(r);
      }
      // 봇: 위험하면 반응 시간 뒤 멈추고, 안전해지면 다시 달림
      const danger = mgDanger(r);
      if (danger && !r.dangerSince) { r.dangerSince = now; for (const p of r.players.values()) if (p.bot) p.react = rand(150, 950); }
      if (!danger && r.dangerSince) { r.dangerSince = 0; for (const p of r.players.values()) if (p.bot) p.resumeAt = now + rand(150, 700); }
      for (const p of r.players.values()) if (p.bot && p.state === 'run') p.run = danger ? now - r.dangerSince < p.react : now >= (p.resumeAt || 0) && Math.random() > 0.02;
      // 잡기 판정
      const L = MG_LV[r.level];
      const watching = (r.main === 'look' && now - r.mainLookAt >= L.grace * 1000) || (r.crab === 'look' && now - r.crabLookAt >= L.grace * 1000);
      for (const p of r.players.values()) {
        if (p.state !== 'run') continue;
        if (watching && p.run && !(p.immuneUntil > now)) { mgCatch(r, p, now); continue; }
        if (p.run) { p.z += MG_SPEED * dt; if (p.z >= 1) { p.z = 1; p.state = 'fin'; p.order = ++r.finN; p.run = false; io.to('mg' + r.pin).emit('mg:fin', { id: p.id, order: p.order }); mgEmitRoster(r); } }
      }
      const active = [...r.players.values()].filter(p => p.state === 'run').length;
      if (now >= r.endsAt) mgFinish(r, 'time');
      else if (r.players.size && !active) mgFinish(r, 'done');
    }
    if (r.players.size && tickN % 2 === 0) {
      const arr = [];
      for (const p of r.players.values()) arr.push(p.id, Math.round(p.z * 1000), Math.round(p.x * 1000), (p.run ? 1 : 0) | (p.state === 'out' ? 2 : 0) | (p.state === 'fin' ? 4 : 0));
      io.to('mg' + r.pin).volatile.emit('mg:s', arr, Date.now());
    }
  }
}

function setupMG(socket, on) {
  const hostRoom = () => { const d = socket.data || {}; if (d.role !== 'mghost') return null; const r = mgRooms.get(d.pin); if (!r || inactive(r, 'mg')) return null; r.touched = Date.now(); return r; };
  const joinHost = (r) => { socket.join('mg' + r.pin); socket.data = { role: 'mghost', pin: r.pin }; socket.emit('mg:phase', mgPhaseMsg(r)); socket.emit('mg:w', mgWatch(r)); socket.emit('mg:roster', mgRoster(r)); };
  on('mg:create', (cfg, ack) => {
    cfg = cfg || {};
    const want = /^\d{4}$/.test(String(cfg.pin || '')) ? String(cfg.pin) : null;
    if (!socket.canCreate()) return ack && ack(FULL);
    const sk = typeof cfg.sk === 'string' ? cfg.sk : null;
    const pin = want && !mgRooms.has(want) && pinFreeFor('mg', want, sk) ? want : newPin();
    if (!pin) return ack && ack(FULL);
    const r = mgNewRoom(pin, cfg);
    if (sk && pin === want) { linkSession(pin, sk, 'mg'); r.sk = sk; }
    adoptOrphans('mg', pin, linked(r));
    mgRooms.set(pin, r); console.log('[mg-room]', pin, r.mode, r.time + 's', 'L' + r.level);
    joinHost(r); ack && ack({ ok: true, pin, hostKey: r.hostKey });
  });
  on('mg:resume', (d, ack) => { const { pin, hostKey } = d || {}; const r = mgRooms.get(String(pin)); if (!r || !hostKey || r.hostKey !== hostKey) return ack && ack({ ok: false }); joinHost(r); ack && ack({ ok: true, pin: r.pin }); });
  on('mg:config', (cfg) => { const r = hostRoom(); if (!r || r.phase !== 'lobby') return; cfg = cfg || {};
    if (cfg.mode) r.mode = cfg.mode === 'back' ? 'back' : 'out'; if (cfg.time) r.time = Math.max(30, Math.min(300, Number(cfg.time) || 120));
    if (cfg.level) r.startLevel = r.level = Math.max(1, Math.min(5, Number(cfg.level) || 1)); mgEmitPhase(r); mgEmitWatch(r); });
  on('mg:start', () => { const r = hostRoom(); if (!r || r.phase !== 'lobby' || !r.players.size) return; r.phase = 'ready'; r.readyAt = Date.now() + 3500; r.level = r.startLevel; mgEmitPhase(r); mgEmitWatch(r); });
  on('mg:stop', () => { const r = hostRoom(); if (r && r.phase === 'play') mgFinish(r, 'stop'); });
  on('mg:reset', () => { const r = hostRoom(); if (r) mgReset(r); });
  on('mg:kick', (id) => { const r = hostRoom(); if (!r) return; const p = r.players.get(id); if (!p) return; removeFromPeers(r, id, 'mg'); });
  on('mg:bots', (n) => { const r = hostRoom(); if (!r) return;
    const names = ['민준', '서연', '도윤', '하은', '시우', '지유', '예준', '수아', '주원', '지호', '서윤', '하준', '지안', '은우', '채원'];
    for (let i = 0; i < Math.min(30, n | 0); i++) { const id = 'bot_' + uid(); r.players.set(id, { id, bot: true, name: names[Math.floor(Math.random() * names.length)] + '(봇)', color: COLORS[r.players.size % COLORS.length], x: mgLane(r), z: 0, state: r.phase === 'lobby' ? 'run' : 'out', run: false }); }
    mgEmitRoster(r); });
  on('mg:clearbots', () => { const r = hostRoom(); if (!r) return; for (const [id, p] of r.players) if (p.bot) r.players.delete(id); mgEmitRoster(r); });
  on('mg:join', (d, ack) => {
    let { pin, name, pid, color } = d || {}; pin = String(pin || '').trim();
    const r = mgRooms.get(pin);
    const go = activeRedirect('mg', pin) || (!r && otherKindRedirect('mg', pin));
    if (go) return ack && ack({ ok: false, redirect: go });
    if (!r) { console.log('[mg-join-fail]', pin); return ack && ack({ ok: false, error: '방 번호를 확인해 주세요.' }); }
    name = String(name || '').trim().slice(0, 8);
    let p = pid && r.players.get(pid);
    // 같은 수업 방의 다른 게임에서 넘어온 학생: 이름·색·번호 그대로
    const carry = !p && pid && carryFrom(r, pid);
    if (carry) { name = name || carry.name; if (!COLORS.includes(color)) color = carry.color; }
    if (!p) {
      if (!name) return ack && ack({ ok: false, error: '이름을 입력해 주세요.' });
      if (r.players.size >= 60) return ack && ack({ ok: false, error: '방이 가득 찼습니다.' });
      p = { id: carry ? pid : uid(), name, color: COLORS.includes(color) ? color : COLORS[r.players.size % COLORS.length], x: mgLane(r), z: 0, state: r.phase === 'lobby' || r.phase === 'ready' ? 'run' : 'out', run: false };
      r.players.set(p.id, p);
    } else { if (name) p.name = name; if (COLORS.includes(color)) p.color = color; }
    p.socketId = socket.id; p.connected = true; r.touched = Date.now();
    socket.join('mg' + r.pin); socket.data = { role: 'mgplayer', pin: r.pin, pid: p.id };
    console.log('[mg-join]', r.pin, p.name, 'players=' + r.players.size);
    ack && ack({ ok: true, pid: p.id, me: mgPublic(p) });
    socket.emit('mg:phase', mgPhaseMsg(r)); socket.emit('mg:w', mgWatch(r)); mgEmitRoster(r);
  });
  on('mg:run', (v) => {
    const d = socket.data || {}; if (d.role !== 'mgplayer') return;
    const r = mgRooms.get(d.pin), p = r && r.players.get(d.pid);
    if (!p || p.state !== 'run') return;
    p.run = !!v && (r.phase === 'play');
  });
  on('disconnect', () => {
    const d = socket.data || {}; if (d.role !== 'mgplayer') return;
    const r = mgRooms.get(d.pin), p = r && r.players.get(d.pid);
    if (p && p.socketId === socket.id) { p.connected = false; p.run = false; mgEmitRoster(r); }
  });
}
// 오래된 방 정리 (3시간 무활동 — 수업 방이면 짝이 되는 방들이 쓰인 시각도 함께 봄)
setInterval(() => {
  const now = Date.now();
  for (const k of kindList()) for (const [pin, r] of KINDS[k].rooms) {
    const idle = now - lastTouched(r), empty = ![...r.players.values()].some(p => p.connected);
    if (idle > 3 * 3600e3 || (r.orphan && empty && idle > 10 * 60e3)) { clearTimeout(r.timer); clearTimeout(r.autoTimer); KINDS[k].rooms.delete(pin); }
  }
  for (const pin of sessions.keys()) if (!kindList().some(k => KINDS[k].rooms.has(pin))) sessions.delete(pin);
}, 60e3);

// ═══════════════════════════════════════════════════════════════
// 수업 방 — 홈에서 설정하고 한 번호로 PART 1·2·3 을 오가기
// ═══════════════════════════════════════════════════════════════
KINDS.quiz = { rooms, path: '/play', host: '/host', kicked: 'kicked', role: 'host', emitRoster, sockRoom: (pin) => pin,
  make: (pin, cfg, key) => newRoom(pin, { hostKey: uid(), sk: key, ...cfg, questions: (cfg.questions || []).slice() }),
  reset: (r) => { if (r.phase !== 'lobby') resetRoom(r); } };
KINDS.mg = { rooms: mgRooms, path: '/m', host: '/mg', kicked: 'mg:kicked', role: 'mghost', emitRoster: mgEmitRoster, sockRoom: (pin) => 'mg' + pin,
  make: (pin, cfg, key) => Object.assign(mgNewRoom(pin, cfg), { sk: key }),
  reset: (r) => { if (r.phase !== 'lobby') mgReset(r); } };
KINDS.jr = { rooms: jr.rooms, path: '/j', host: '/jr', kicked: 'jr:kicked', role: 'jrhost', emitRoster: jr.emitRoster, sockRoom: (pin) => 'jr' + pin,
  make: (pin, cfg, key) => Object.assign(jr.newRoom(pin, cfg), { sk: key }),
  reset: (r) => { if (r.phase !== 'lobby') jr.reset(r); } };
KINDS.bk = { rooms: bk.rooms, path: '/b', host: '/bk', kicked: 'bk:kicked', role: 'bkhost', emitRoster: bk.emitRoster, sockRoom: (pin) => 'bk' + pin,
  make: (pin, cfg, key) => Object.assign(bk.newRoom(pin, cfg), { sk: key }),
  reset: (r) => { if (r.phase !== 'lobby') bk.reset(r); } };
const roleKind = { host: 'quiz', mghost: 'mg', jrhost: 'jr', bkhost: 'bk' };
const credsOf = (pin) => Object.fromEntries(kindList().map(k => [k, { ok: true, pin, hostKey: KINDS[k].rooms.get(pin).hostKey }]));

function setupSession(socket, on) {
  on('sess:create', (cfg, ack) => {
    cfg = cfg || {}; const q = cfg.quiz || {};
    if (!socket.canCreate()) return ack && ack(FULL);
    const pin = newPin(); if (!pin) return ack && ack(FULL);
    const key = uid(), active = KINDS[cfg.first] ? cfg.first : 'quiz';
    // 한쪽 방이 사라져 다시 만들 때 쓰도록 홈 설정을 함께 보관
    const cfgs = { quiz: { questions: sanitizeQuestions(q.questions), mode: q.mode === 'score' ? 'score' : 'survival', gather: q.gather !== false, auto: q.auto !== false }, mg: cfg.mg || {}, jr: cfg.jr || {}, bk: cfg.bk || {} };
    sessions.set(pin, { key, active, cfgs });
    for (const k of kindList()) KINDS[k].rooms.set(pin, KINDS[k].make(pin, cfgs[k], key));
    console.log('[session]', pin, 'opened', cfgs.quiz.questions.length + ' questions', 'first=' + active);
    ack && ack({ ok: true, pin, key, active, ...credsOf(pin) });
  });
  on('sess:info', (d, ack) => {
    const { pin, key } = d || {}; const s = sessions.get(String(pin));
    ack && ack(s && s.key === key ? { ok: true, active: s.active } : { ok: false });
  });
  // 선생님이 게임을 바꾸면 학생 화면도 따라 넘어감
  on('sess:switch', (to, ack) => {
    const d = socket.data || {}, kind = roleKind[d.role], r = kind && KINDS[kind].rooms.get(d.pin);
    if (!linked(r)) return ack && ack({ ok: false, error: '수업 방이 아닙니다. 홈에서 수업 방을 열어 주세요.' });
    const pin = r.pin, s = sessions.get(pin);
    to = KINDS[to] ? to : 'quiz';
    // 서버 재시작 등으로 한쪽 방이 없으면 홈에서 정한 설정으로 새로 만듦
    for (const k of kindList()) {
      const old = KINDS[k].rooms.get(pin);
      if (old && !old.orphan) continue;
      const nr = KINDS[k].make(pin, (s.cfgs && s.cfgs[k]) || {}, s.key);
      if (old) nr.players = old.players; // 서버 재시작 후 먼저 들어와 기다리던 학생은 그대로
      KINDS[k].rooms.set(pin, nr);
    }
    // 진행 중이던 게임은 정리하고, 학생들을 새 게임으로 보냄
    for (const k of kindList()) if (k !== to) KINDS[k].reset(KINDS[k].rooms.get(pin));
    s.active = to;
    for (const k of kindList()) KINDS[k].rooms.get(pin).touched = Date.now();
    console.log('[session]', pin, '→', to);
    for (const k of kindList()) if (k !== to) io.to(KINDS[k].sockRoom(pin)).emit('goto', KINDS[to].path + '?pin=' + pin + '&auto=1');
    ack && ack({ ok: true, active: to, ...credsOf(pin) });
  });
}

server.listen(PORT, () => {
  console.log('\n  SUMUS ISLAND QUIZ 서버 실행 중');
  console.log(`  ▶ 선생님 PC:  http://localhost:${PORT}/   (홈에서 수업 방 열기)`);
  for (const ip of lanIPs()) console.log(`  ▶ 학생 폰:    http://${ip}:${PORT}/play   (같은 와이파이)`);
  console.log('');
});
