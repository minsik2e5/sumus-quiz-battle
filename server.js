// SUMUS ISLAND QUIZ — 실시간 이동형 퀴즈 서버
const express = require('express');
const http = require('http');
const os = require('os');
const path = require('path');
const fs = require('fs');
const QRCode = require('qrcode');
const { Server } = require('socket.io');

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

// 환경변수(F_*)에 들어 있으면 그걸, 없으면 public 폴더 파일을 사용
const fileOr = (env, file) => process.env[env] || fs.readFileSync(path.join(__dirname, 'public', file), 'utf8');
app.get('/host', (_, res) => {
  let html = fileOr('F_HOST', 'host.html');
  if (!html.includes('host-remote.js')) html = html.replace('</body>', '<script src="/host-remote.js"></script>\n</body>');
  res.type('html').send(html);
});
app.get('/control', (_, res) => res.type('html').send(fileOr('F_CONTROL', 'control.html')));
app.get('/mg', (_, res) => res.type('html').send(fileOr('F_MGHOST', 'mg-host.html')));
app.get('/m', (_, res) => res.type('html').send(fileOr('F_MGPLAY', 'mg-play.html')));
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
const TICK = 50;            // 20Hz 물리
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

function newPin() {
  let p;
  do { p = String(Math.floor(1000 + Math.random() * 9000)); } while (rooms.has(p) || mgRooms.has(p) || sessions.has(p));
  return p;
}

// ───────── 수업 방(세션): 퀴즈쇼와 무궁화가 같은 방 번호를 함께 씀 ─────────
const sessions = new Map(); // pin → { key, active: 'quiz' | 'mg' }
const mgRooms = new Map();
// 다른 게임이 이 번호를 쓰고 있어도 같은 수업 방 키를 가졌으면 함께 쓸 수 있음
function pinFree(pin, other, sk) { if (!other.has(pin)) return true; const s = sessions.get(pin); return !!(sk && s && s.key === sk); }
// 서버가 다시 켜져 세션이 사라졌으면 호스트가 가진 키로 다시 묶음
function linkSession(pin, sk, kind) { if (sk && !sessions.has(pin)) sessions.set(pin, { key: sk, active: kind }); }
const linked = (r) => { const s = r && sessions.get(r.pin); return !!(s && r.sk === s.key); };

function spawnPos(room) {
  const zs = room.zones || [];
  for (let k = 0; k < 40; k++) {
    const a = rand(0, Math.PI * 2), d = Math.sqrt(Math.random()) * 0.22;
    const x = Math.cos(a) * d, y = Math.sin(a) * d * 0.9 + (room.n === 3 ? -0.1 : 0);
    if (!zs.some(z => Math.hypot(x - z.x, y - z.y) < z.r)) return { x, y };
  }
  return { x: rand(-0.1, 0.1), y: rand(-0.1, 0.1) };
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
    if (p.alive && room.gather) Object.assign(p, spawnPos(room));
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
  for (const p of room.players.values()) { p.alive = true; p.score = 0; p.streak = 0; Object.assign(p, spawnPos(room)); }
  emitPhase(room); emitRoster(room);
}

// ───────── 물리 루프 ─────────
let tickN = 0;
setInterval(() => { try { tickRooms(); } catch (e) { console.error('[tick]', e); } }, TICK);
function tickRooms() {
  tickN++;
  const dt = TICK / 1000;
  for (const room of rooms.values()) {
    const movable = room.phase === 'lobby' || room.phase === 'question';
    const list = [...room.players.values()].filter(p => p.alive);
    if (movable) {
      for (const p of list) {
        if (p.bot) botThink(room, p);
        let ix = p.ix || 0, iy = p.iy || 0;
        const m = Math.hypot(ix, iy); if (m > 1) { ix /= m; iy /= m; }
        p.x += ix * SPEED * dt; p.y += iy * SPEED * dt;
        if (ix || iy) p.face = ix < -0.05 ? -1 : ix > 0.05 ? 1 : p.face;
        p.moving = m > 0.05;
      }
      // 겹침 밀어내기
      for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
        const a = list[i], b = list[j];
        let dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy);
        if (d < P_R * 2) {
          if (d < 1e-6) { dx = rand(-1, 1); dy = rand(-1, 1); d = Math.hypot(dx, dy); }
          const push = (P_R * 2 - d) / 2; dx /= d; dy /= d;
          a.x -= dx * push; a.y -= dy * push; b.x += dx * push; b.y += dy * push;
        }
      }
      for (const p of list) {
        const d = Math.hypot(p.x, p.y);
        if (d > ISLAND_R) { p.x *= ISLAND_R / d; p.y *= ISLAND_R / d; }
      }
    } else for (const p of list) p.moving = false;

    if (tickN % 2 === 0 && room.players.size) {
      const arr = [];
      for (const p of room.players.values()) arr.push(p.id, Math.round(p.x * 1000), Math.round(p.y * 1000), (p.alive ? 1 : 0) | (p.moving ? 2 : 0) | (p.face === -1 ? 4 : 0));
      io.to(room.pin).volatile.emit('s', arr);
    }
  }
}

function botThink(room, p) {
  if (room.phase === 'question') {
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
  return Object.assign({ pin, hostKey: null, players: new Map(), questions: [], mode: 'survival', gather: true, auto: true,
    phase: 'lobby', qIndex: -1, zones: null, n: 0, endsAt: 0, touched: Date.now() }, extra);
}
io.on('connection', (socket) => {
  // 잘못된 데이터가 와도 서버가 죽지 않도록 모든 이벤트를 감쌈
  const on = (ev, fn) => socket.on(ev, (...a) => { try { fn(...a); } catch (e) { console.error('[' + ev + ']', e); } });
  setup(socket, on);
  setupMG(socket, on);
  setupSession(socket, on);
});
function setup(socket, on) {
  on('host:create', (cfg, ack) => {
    cfg = cfg || {};
    const qs = sanitizeQuestions(cfg.questions);
    // 서버 재시작 후 같은 방 번호로 다시 열기: 학생들이 먼저 재접속해 만들어 둔 빈 방을 이어받음
    const want = /^\d{4}$/.test(String(cfg.pin || '')) ? String(cfg.pin) : null;
    let room = want && rooms.get(want);
    const sk = typeof cfg.sk === 'string' ? cfg.sk : null;
    const settings = { hostKey: uid(), hostSocket: socket.id, questions: qs, mode: cfg.mode === 'score' ? 'score' : 'survival', gather: cfg.gather !== false, auto: cfg.auto !== false, orphan: false, touched: Date.now() };
    if (room && room.orphan) Object.assign(room, settings);
    else { const pin = want && !rooms.has(want) && pinFree(want, mgRooms, sk) ? want : newPin(); room = newRoom(pin, settings); rooms.set(pin, room); }
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
    if (!room || room.hostKey !== hostKey) return ack && ack({ ok: false });
    room.hostSocket = socket.id; socket.join(room.pin); socket.join(room.pin + '#h'); socket.data = { role: 'host', pin: room.pin };
    ack && ack({ ok: true, pin: room.pin, mode: room.mode });
    socket.emit('phase', phasePayload(room)); socket.emit('roster', roster(room)); socket.emit('hostinfo', hostInfo(room));
  });

  const hostRoom = () => {
    const d = socket.data || {};
    if (d.role !== 'host') return null;
    const r = rooms.get(d.pin); if (r) r.touched = Date.now(); return r;
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
    const p = r.players.get(id); if (!p) return;
    r.players.delete(id);
    if (p.socketId) io.to(p.socketId).emit('kicked');
    emitRoster(r);
    const o = linked(r) && mgRooms.get(r.pin); if (o && o.players.delete(id)) mgEmitRoster(o);
  });
  on('host:revive', (id) => {
    const r = hostRoom(); if (!r) return;
    const p = r.players.get(id); if (!p || p.alive) return;
    p.alive = true; Object.assign(p, spawnPos(r)); emitRoster(r);
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
    const sess = sessions.get(pin);
    if (sess && sess.active === 'mg' && mgRooms.has(pin)) return ack && ack({ ok: false, redirect: '/m?pin=' + pin });
    // 서버가 다시 켜진 직후: 전에 들어와 있던 학생이면 같은 번호의 빈 방을 만들어 기다림
    // (서버가 켜진 지 10분 이내일 때만 — 오래된 방 번호로 유령 방이 생기지 않게)
    if (!room && pid && /^\d{4}$/.test(pin) && process.uptime() < 600) { room = newRoom(pin, { orphan: true }); rooms.set(pin, room); }
    if (!room && mgRooms.has(pin)) return ack && ack({ ok: false, redirect: '/m?pin=' + pin });
    if (!room) { console.log('[join-fail] no room', pin); return ack && ack({ ok: false, error: '방 번호를 확인해 주세요. 선생님 화면의 번호가 바뀌었을 수 있어요.' }); }
    name = String(name || '').trim().slice(0, 8);
    let p = pid && room.players.get(pid);
    // 같은 수업 방의 무궁화에서 넘어온 학생: 이름·색·번호 그대로
    const mr = !p && pid && linked(room) && mgRooms.get(room.pin), carry = mr && mr.players.get(pid);
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
    ack && ack({ ok: true, pid: p.id, me: publicPlayer(p), colors: COLORS });
    socket.emit('phase', phasePayload(room));
    emitRoster(room);
  });

  let logs = 0;
  on('clientlog', (d) => { if (++logs > 20) return; d = d || {}; console.log('[client]', String(d.pin || ''), String(d.msg || '').slice(0, 300), '|', String(d.ua || '').slice(0, 160)); });
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

// 오래된 방 정리 (3시간 무활동)
setInterval(() => {
  const now = Date.now();
  for (const [pin, r] of rooms) {
    const idle = now - r.touched, empty = ![...r.players.values()].some(p => p.connected);
    if (idle > 3 * 3600e3 || (r.orphan && empty && idle > 10 * 60e3)) { clearTimeout(r.timer); clearTimeout(r.autoTimer); rooms.delete(pin); }
  }
}, 60e3);

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
  return { pin, hostKey: uid(), players: new Map(), mode: cfg.mode === 'back' ? 'back' : 'out', time: Math.max(30, Math.min(300, Number(cfg.time) || 120)),
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
      io.to('mg' + r.pin).volatile.emit('mg:s', arr);
    }
  }
}
setInterval(() => { try { mgTick(); } catch (e) { console.error('[mgtick]', e); } }, TICK);

function setupMG(socket, on) {
  const hostRoom = () => { const d = socket.data || {}; if (d.role !== 'mghost') return null; const r = mgRooms.get(d.pin); if (r) r.touched = Date.now(); return r; };
  const joinHost = (r) => { socket.join('mg' + r.pin); socket.data = { role: 'mghost', pin: r.pin }; socket.emit('mg:phase', mgPhaseMsg(r)); socket.emit('mg:w', mgWatch(r)); socket.emit('mg:roster', mgRoster(r)); };
  on('mg:create', (cfg, ack) => {
    cfg = cfg || {};
    const want = /^\d{4}$/.test(String(cfg.pin || '')) ? String(cfg.pin) : null;
    const sk = typeof cfg.sk === 'string' ? cfg.sk : null;
    const pin = want && !mgRooms.has(want) && pinFree(want, rooms, sk) ? want : newPin();
    const r = mgNewRoom(pin, cfg);
    if (sk && pin === want) { linkSession(pin, sk, 'mg'); r.sk = sk; }
    mgRooms.set(pin, r); console.log('[mg-room]', pin, r.mode, r.time + 's', 'L' + r.level);
    joinHost(r); ack && ack({ ok: true, pin, hostKey: r.hostKey });
  });
  on('mg:resume', (d, ack) => { const { pin, hostKey } = d || {}; const r = mgRooms.get(String(pin)); if (!r || r.hostKey !== hostKey) return ack && ack({ ok: false }); joinHost(r); ack && ack({ ok: true, pin: r.pin }); });
  on('mg:config', (cfg) => { const r = hostRoom(); if (!r || r.phase !== 'lobby') return; cfg = cfg || {};
    if (cfg.mode) r.mode = cfg.mode === 'back' ? 'back' : 'out'; if (cfg.time) r.time = Math.max(30, Math.min(300, Number(cfg.time) || 120));
    if (cfg.level) r.startLevel = r.level = Math.max(1, Math.min(5, Number(cfg.level) || 1)); mgEmitPhase(r); mgEmitWatch(r); });
  on('mg:start', () => { const r = hostRoom(); if (!r || r.phase !== 'lobby' || !r.players.size) return; r.phase = 'ready'; r.readyAt = Date.now() + 3500; r.level = r.startLevel; mgEmitPhase(r); mgEmitWatch(r); });
  on('mg:stop', () => { const r = hostRoom(); if (r && r.phase === 'play') mgFinish(r, 'stop'); });
  on('mg:reset', () => { const r = hostRoom(); if (r) mgReset(r); });
  on('mg:kick', (id) => { const r = hostRoom(); if (!r) return; const p = r.players.get(id); if (!p) return; r.players.delete(id); if (p.socketId) io.to(p.socketId).emit('mg:kicked'); mgEmitRoster(r);
    const o = linked(r) && rooms.get(r.pin); if (o && o.players.delete(id)) emitRoster(o); });
  on('mg:bots', (n) => { const r = hostRoom(); if (!r) return;
    const names = ['민준', '서연', '도윤', '하은', '시우', '지유', '예준', '수아', '주원', '지호', '서윤', '하준', '지안', '은우', '채원'];
    for (let i = 0; i < Math.min(30, n | 0); i++) { const id = 'bot_' + uid(); r.players.set(id, { id, bot: true, name: names[Math.floor(Math.random() * names.length)] + '(봇)', color: COLORS[r.players.size % COLORS.length], x: mgLane(r), z: 0, state: r.phase === 'lobby' ? 'run' : 'out', run: false }); }
    mgEmitRoster(r); });
  on('mg:clearbots', () => { const r = hostRoom(); if (!r) return; for (const [id, p] of r.players) if (p.bot) r.players.delete(id); mgEmitRoster(r); });
  on('mg:join', (d, ack) => {
    let { pin, name, pid, color } = d || {}; pin = String(pin || '').trim();
    const r = mgRooms.get(pin);
    const sess = sessions.get(pin);
    if (sess && sess.active === 'quiz' && rooms.has(pin)) return ack && ack({ ok: false, redirect: '/play?pin=' + pin });
    if (!r && rooms.has(pin)) return ack && ack({ ok: false, redirect: '/play?pin=' + pin });
    if (!r) { console.log('[mg-join-fail]', pin); return ack && ack({ ok: false, error: '방 번호를 확인해 주세요.' }); }
    name = String(name || '').trim().slice(0, 8);
    let p = pid && r.players.get(pid);
    // 같은 수업 방의 퀴즈쇼에서 넘어온 학생: 이름·색·번호 그대로
    const qr = !p && pid && linked(r) && rooms.get(r.pin), carry = qr && qr.players.get(pid);
    if (carry) { name = name || carry.name; if (!COLORS.includes(color)) color = carry.color; }
    if (!p) {
      if (!name) return ack && ack({ ok: false, error: '이름을 입력해 주세요.' });
      if (r.players.size >= 60) return ack && ack({ ok: false, error: '방이 가득 찼습니다.' });
      p = { id: carry ? pid : uid(), name, color: COLORS.includes(color) ? color : COLORS[r.players.size % COLORS.length], x: mgLane(r), z: 0, state: r.phase === 'lobby' ? 'run' : 'out', run: false };
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
setInterval(() => {
  const now = Date.now();
  for (const [pin, r] of mgRooms) if (now - r.touched > 3 * 3600e3) mgRooms.delete(pin);
  for (const pin of sessions.keys()) if (!rooms.has(pin) && !mgRooms.has(pin)) sessions.delete(pin);
}, 60e3);

// ═══════════════════════════════════════════════════════════════
// 수업 방 — 홈에서 설정하고 한 번호로 PART 1 ↔ PART 2 오가기
// ═══════════════════════════════════════════════════════════════
function setupSession(socket, on) {
  on('sess:create', (cfg, ack) => {
    cfg = cfg || {}; const q = cfg.quiz || {};
    const pin = newPin(), key = uid(), active = cfg.first === 'mg' ? 'mg' : 'quiz';
    sessions.set(pin, { key, active });
    const qr = newRoom(pin, { hostKey: uid(), sk: key, questions: sanitizeQuestions(q.questions), mode: q.mode === 'score' ? 'score' : 'survival', gather: q.gather !== false, auto: q.auto !== false });
    rooms.set(pin, qr);
    const mr = mgNewRoom(pin, cfg.mg); mr.sk = key; mgRooms.set(pin, mr);
    console.log('[session]', pin, 'opened', qr.questions.length + ' questions', 'first=' + active);
    ack && ack({ ok: true, pin, key, active, quiz: { ok: true, pin, hostKey: qr.hostKey }, mg: { ok: true, pin, hostKey: mr.hostKey } });
  });
  on('sess:info', (d, ack) => {
    const { pin, key } = d || {}; const s = sessions.get(String(pin));
    ack && ack(s && s.key === key ? { ok: true, active: s.active } : { ok: false });
  });
  // 선생님이 게임을 바꾸면 학생 화면도 따라 넘어감
  on('sess:switch', (to, ack) => {
    const d = socket.data || {};
    const r = d.role === 'host' ? rooms.get(d.pin) : d.role === 'mghost' ? mgRooms.get(d.pin) : null;
    if (!linked(r)) return ack && ack({ ok: false, error: '수업 방이 아닙니다. 홈에서 수업 방을 열어 주세요.' });
    const pin = r.pin, s = sessions.get(pin);
    to = to === 'mg' ? 'mg' : 'quiz';
    // 서버 재시작 등으로 한쪽 방이 없으면 새로 만듦
    if (!mgRooms.has(pin)) mgRooms.set(pin, Object.assign(mgNewRoom(pin), { sk: s.key }));
    if (!rooms.has(pin)) rooms.set(pin, newRoom(pin, { hostKey: uid(), sk: s.key }));
    const qr = rooms.get(pin), mr = mgRooms.get(pin);
    // 진행 중이던 게임은 정리
    if (to === 'quiz' && (mr.phase === 'ready' || mr.phase === 'play')) mgReset(mr);
    if (to === 'mg' && (qr.phase === 'question' || qr.phase === 'reveal')) finish(qr);
    s.active = to; qr.touched = mr.touched = Date.now();
    console.log('[session]', pin, '→', to);
    if (to === 'mg') io.to(pin).emit('goto', '/m?pin=' + pin);
    else io.to('mg' + pin).emit('goto', '/play?pin=' + pin);
    ack && ack({ ok: true, active: to, quiz: { ok: true, pin, hostKey: qr.hostKey }, mg: { ok: true, pin, hostKey: mr.hostKey } });
  });
}

server.listen(PORT, () => {
  console.log('\n  SUMUS ISLAND QUIZ 서버 실행 중');
  console.log(`  ▶ 선생님 PC:  http://localhost:${PORT}/host`);
  for (const ip of lanIPs()) console.log(`  ▶ 학생 폰:    http://${ip}:${PORT}/play   (같은 와이파이)`);
  console.log('');
});
