// PART 4 — 바나나킥 (서버)
// 모든 학생이 각자 골키퍼가 되어 같은 슛을 동시에 막는다. 좌우 버튼으로 골키퍼를 움직이고, 시간이 지날수록 슛이 빠르고 많이 휘어진다.
// 판정은 서버 시계 기준: 폰은 "버튼 상태가 바뀐 시각(ts)"만 보내고, 서버와 폰이 같은 계산(public/bk-common.js)으로 골키퍼 위치를 구한다.
const BK = require('./public/bk-common.js');

module.exports = function createBK(ctx) {
  const { io, uid, rand, COLORS, linked, inactive, carryFrom, activeRedirect, removeFromPeers } = ctx;
  const rooms = new Map();
  const room = (r) => 'bk' + r.pin;

  const JUDGE_DELAY = 320;    // 늦게 도착하는 버튼 신호를 기다린 뒤 판정(ms)
  const READY_MS = 4200;      // 카운트다운
  const FIRST_KICK = 2600;    // 시작 후 첫 슛까지(ms)
  const RAMP_OUT = 150;       // 탈락 모드: 이 시간(초) 뒤 최고 난이도
  const MAX_OUT = 420;        // 탈락 모드 최대 진행 시간(초)

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, k) => a + (b - a) * k;
  const gauss = () => (Math.random() + Math.random() + Math.random() - 1.5) / 0.75;

  function newRoom(pin, cfg) {
    cfg = cfg || {};
    return { pin, kind: 'bk', hostKey: uid(), players: new Map(), mode: cfg.mode === 'score' ? 'score' : 'out', time: [60, 120, 180].includes(Number(cfg.time)) ? Number(cfg.time) : 120,
      phase: 'lobby', readyAt: 0, resetAt: Date.now(), playAt: 0, endsAt: 0, endAt: 0, shots: [], shotN: 0, nextKick: 0, lastArr: null, level: 0, lastShooter: null, startN: 0, slotN: 0, result: null, touched: Date.now() };
  }
  function pub(p) {
    return { id: p.id, name: p.name, color: p.color, state: p.state, score: p.score, saves: p.saves, goals: p.goals, combo: p.combo, best: p.best, perfect: p.perfect, slot: p.slot, connected: p.connected || p.bot, bot: !!p.bot };
  }
  const rosterOf = (r) => [...r.players.values()].map(pub);
  const emitRoster = (r) => io.to(room(r)).emit('bk:roster', rosterOf(r));
  function diff(r, now) {
    if (r.phase !== 'play') return 0;
    const el = Math.max(0, (now - r.playAt) / 1000);
    return clamp(r.mode === 'score' ? el / r.time : el / RAMP_OUT, 0, 1);
  }
  function phaseMsg(r) {
    const now = Date.now();
    return { phase: r.phase, mode: r.mode, time: r.time, serverT: now, readyRemain: r.readyAt ? Math.max(0, r.readyAt - now) : 0, resetAt: r.resetAt, playAt: r.playAt, endsAt: r.endsAt,
      d: diff(r, now), level: r.level, levels: BK.LEVELS.map(l => l.name), result: r.phase === 'end' ? r.result : null };
  }
  const emitPhase = (r) => io.to(room(r)).emit('bk:phase', phaseMsg(r));
  function activeShots(r, now) { return r.shots.filter(s => s.t1 + 600 > now); }

  function resetStats(r, p, t) {
    Object.assign(p, { state: 'in', score: 0, saves: 0, goals: 0, combo: 0, best: 0, perfect: 0, outAt: 0, g: new BK.Goalie(), bs: 0, bdir: 0 });
    p.g.reset(t != null ? t : Date.now());
  }

  function reset(r) {
    const now = Date.now();
    r.phase = 'lobby'; r.readyAt = 0; r.playAt = 0; r.endsAt = 0; r.endAt = 0; r.shots = []; r.nextKick = 0; r.lastArr = null; r.level = 0; r.result = null; r.resetAt = now;
    for (const p of r.players.values()) resetStats(r, p, now);
    emitPhase(r); emitRoster(r);
  }

  // ── 슛 만들기 ──
  const volleyFor = (d) => { const u = Math.random(); const p3 = d > 0.62 ? lerp(0, 0.28, (d - 0.62) / 0.38) : 0, p2 = d > 0.28 ? lerp(0.05, 0.5, (d - 0.28) / 0.72) : 0; return u < p3 ? 3 : u < p3 + p2 ? 2 : 1; };
  // 이전 슛이 도착한 위치에서 이 시간 안에 닿을 수 있어야(= 이론상 막을 수 있어야) 공정함
  const reachable = (prev, x1, t1) => {
    if (!prev) return true;
    const dt = Math.max(0, (t1 - prev.t) / 1000), cover = 2 * BK.REACH * 0.8;
    return Math.abs(x1 - prev.x) <= BK.V * 0.82 * dt + cover;
  };
  // 슈터는 섬의 마스코트들이 랜덤으로 바뀜 (같은 슈터가 연달아 나오지 않게)
  const SHOOTERS = ['octo', 'crab', 'turtle', 'puffer'];
  function pickShooter(r) {
    const pool = SHOOTERS.filter(k => k !== r.lastShooter), k = pool[Math.floor(Math.random() * pool.length)];
    r.lastShooter = k; return k;
  }
  function makeVolley(r, d, tk) {
    const n = volleyFor(d), T = lerp(1.9, 0.85, d) * 1000, list = [];
    const stag = lerp(520, 330, d);
    for (let i = 0; i < n; i++) {
      const t0 = Math.round(tk + i * stag * rand(0.9, 1.1)), t1 = Math.round(t0 + T * rand(0.97, 1.03));
      let x1 = 0, ok = false;
      for (let k = 0; k < 14 && !ok; k++) { x1 = rand(-0.88, 0.88); ok = reachable(r.lastArr, x1, t1); }
      if (!ok) { const dir = x1 > r.lastArr.x ? 1 : -1; x1 = clamp(r.lastArr.x + dir * (BK.V * 0.82 * Math.max(0, (t1 - r.lastArr.t) / 1000) + 2 * BK.REACH * 0.8) * 0.9, -0.88, 0.88); }
      const straight = Math.random() < lerp(0.6, 0.05, d);
      const A = straight ? rand(-0.03, 0.03) : (Math.random() < 0.5 ? -1 : 1) * lerp(0.1, 0.5, d) * rand(0.7, 1);
      const knuckle = d > 0.45 && Math.random() < lerp(0.2, 0.6, (d - 0.45) / 0.55);
      const dx = knuckle ? (Math.random() < 0.5 ? -1 : 1) * lerp(0.12, 0.3, d) : 0;
      const s = { id: ++r.shotN, shooter: i === 0 || !r.lastShooter ? pickShooter(r) : r.lastShooter, t0, t1, x0: +rand(-0.8, 0.8).toFixed(3), x1: +x1.toFixed(3), A: +A.toFixed(3), dx: +dx.toFixed(3), s: +rand(0.58, 0.74).toFixed(3), lob: +rand(0.2, 0.5).toFixed(2),
        kind: knuckle ? 'knuckle' : straight ? 'straight' : 'banana', judged: false };
      list.push(s); r.shots.push(s); r.lastArr = { x: x1, t: t1 };
    }
    io.to(room(r)).emit('bk:shots', { d: +d.toFixed(3), list: list.map(({ judged, ...s }) => s) });
    return list;
  }

  // ── 판정 ──
  function judgeShot(r, s, now) {
    s.judged = true;
    const res = [], b = BK.ballAt(s, s.t1);
    for (const p of r.players.values()) {
      if (p.state !== 'in') continue;
      const gx = p.g.at(s.t1).x, code = BK.judge(gx, b.x);
      if (code > 0) {
        p.saves++; p.combo++; p.best = Math.max(p.best, p.combo); if (code === 2) p.perfect++;
        p.score += 100 + (code === 2 ? 50 : 0) + Math.min(p.combo, 10) * 5;
        res.push([p.id, code]);
      } else {
        p.goals++; p.combo = 0;
        if (r.mode === 'out') { p.state = 'out'; p.outAt = now; res.push([p.id, 0, 1]); } else res.push([p.id, 0, 0]);
      }
    }
    io.to(room(r)).emit('bk:res', { id: s.id, t1: s.t1, bx: +b.x.toFixed(3), res });
    emitRoster(r);
  }

  function finish(r, why) {
    const ps = [...r.players.values()], now = Date.now();
    const rank = ps.slice().sort((a, b) => r.mode === 'out'
      ? (b.state === 'in') - (a.state === 'in') || (b.outAt || 0) - (a.outAt || 0) || b.score - a.score
      : b.score - a.score || b.saves - a.saves || a.goals - b.goals);
    r.result = { why, mode: r.mode, time: r.time, ranking: rank.map(p => ({ id: p.id, name: p.name, color: p.color, alive: p.state === 'in', score: p.score, saves: p.saves, goals: p.goals, perfect: p.perfect, best: p.best,
      survived: Math.max(0, Math.round(((p.state === 'in' ? now : p.outAt) - r.playAt) / 1000)) })) };
    r.phase = 'end'; r.endAt = 0; emitPhase(r); emitRoster(r);
  }

  // ── 봇 ──
  function botAct(r, now) {
    const sh = r.shots.filter(s => !s.judged && s.t1 > now).sort((a, b) => a.t1 - b.t1);
    for (const p of r.players.values()) {
      if (!p.bot || p.state !== 'in') continue;
      const s = sh[0], st = p.g.at(now); let target = 0, active = false;
      if (s) {
        if (p.bs !== s.id) { // 이 슛에 대한 계획 (반응 시간, 눈대중 오차)
          const skill = p.skill || 0.85;
          p.bs = s.id; p.bDecide = s.t0 + rand(120, 420) * (1.35 - skill); p.bErr = gauss() * ((1 - skill) * 0.32 + 0.025);
        }
        if (now >= p.bDecide) {
          active = true; const T = s.t1 - s.t0;
          const seen = (s.dx && now < s.t0 + s.s * T) ? s.x1 - s.dx : s.x1; // 너클볼은 꺾인 뒤에야 알 수 있음
          target = clamp(seen + p.bErr, -0.9, 0.9);
        }
      }
      const pos = st.x + st.v * 0.09; // 멈추는 거리를 감안
      const dir = active ? (Math.abs(target - pos) < 0.035 ? 0 : target > pos ? 1 : -1) : (Math.abs(pos) < 0.06 ? 0 : pos > 0 ? -1 : 1);
      if (dir !== p.bdir) { p.g.press(dir, now); p.bdir = dir; }
    }
  }

  function tick(now, tickN) {
    for (const r of rooms.values()) {
      if (r.phase === 'ready' && now >= r.readyAt) {
        r.phase = 'play'; r.playAt = r.readyAt; r.endsAt = r.mode === 'score' ? r.playAt + r.time * 1000 : 0;
        r.nextKick = r.playAt + FIRST_KICK; r.startN = [...r.players.values()].filter(p => p.state === 'in').length; r.level = 0; emitPhase(r);
      }
      if (r.phase === 'play') {
        const d = diff(r, now);
        const lv = BK.levelOf(d);
        if (lv > r.level) { r.level = lv; io.to(room(r)).emit('bk:level', { n: lv, name: BK.LEVELS[lv].name, t: now }); }
        // 다음 슛 묶음을 약 1.4초 앞서 알려 줌
        while (!r.endAt && r.nextKick - now < 1400 && !(r.mode === 'score' && r.nextKick > r.endsAt - lerp(1.9, 0.85, d) * 1000)) {
          const list = makeVolley(r, diff(r, Math.max(now, r.nextKick)), Math.max(r.nextKick, now + 1100));
          const last = list[list.length - 1];
          r.nextKick = last.t0 + lerp(2600, 1150, d) * rand(0.88, 1.12);
        }
        botAct(r, now);
        for (const s of r.shots) if (!s.judged && s.t1 + JUDGE_DELAY <= now) judgeShot(r, s, now);
        r.shots = r.shots.filter(s => !s.judged || s.t1 + 3000 > now);
        const alive = [...r.players.values()].filter(p => p.state === 'in').length;
        const pending = r.shots.some(s => !s.judged);
        if (r.mode === 'out') {
          if (!r.endAt && r.players.size && (alive === 0 || (r.startN >= 2 && alive <= 1))) r.endAt = now + 2200;
          if (!r.endAt && (now - r.playAt) / 1000 > MAX_OUT) r.endAt = now + 500;
          if (r.endAt && now >= r.endAt) finish(r, alive === 0 ? 'out' : alive === 1 && r.startN >= 2 ? 'last' : 'time');
        } else if (now >= r.endsAt + JUDGE_DELAY && !pending) finish(r, 'time');
      }
      // 골키퍼 위치 (20Hz) — 대기실·카운트다운·진행 중 모두 (연습 가능)
      for (const p of r.players.values()) p.g.compact(now, 3000);
      if (tickN % 2 === 0 && r.players.size) {
        const arr = [];
        for (const p of r.players.values()) { const st = p.g.at(now); arr.push(p.id, Math.round(st.x * 1000), 0, (p.state === 'in' ? 1 : 0) | (Math.abs(st.v) > 0.06 ? 2 : 0) | (st.v < 0 ? 4 : 0)); }
        io.to(room(r)).volatile.emit('bk:s', arr, now);
      }
    }
  }

  function setup(socket, on) {
    const hostRoom = () => { const d = socket.data || {}; if (d.role !== 'bkhost') return null; const r = rooms.get(d.pin); if (!r || inactive(r, 'bk')) return null; r.touched = Date.now(); return r; };
    const sendAll = (r) => { socket.emit('bk:phase', phaseMsg(r)); socket.emit('bk:roster', rosterOf(r)); const sh = activeShots(r, Date.now()); if (sh.length) socket.emit('bk:shots', { d: diff(r, Date.now()), list: sh.map(({ judged, ...s }) => s) }); };
    const joinHost = (r) => { socket.join(room(r)); socket.data = { role: 'bkhost', pin: r.pin }; sendAll(r); };

    on('bk:create', (cfg, ack) => { // 서버가 다시 켜진 뒤 같은 번호로 방을 복구할 때 (수업 방 키 필요)
      cfg = cfg || {};
      const pin = ctx.claimPin('bk', cfg.pin, cfg.sk, socket);
      if (!pin) return ack && ack(ctx.FULL);
      const r = newRoom(pin, cfg); if (cfg.sk && pin === String(cfg.pin)) { r.sk = cfg.sk; ctx.linkSession(pin, cfg.sk, 'bk'); }
      ctx.adoptOrphans('bk', pin, linked(r)); rooms.set(pin, r); joinHost(r); ack && ack({ ok: true, pin, hostKey: r.hostKey });
    });
    on('bk:resume', (d, ack) => { const { pin, hostKey } = d || {}; const r = rooms.get(String(pin)); if (!r || !hostKey || r.hostKey !== hostKey) return ack && ack({ ok: false }); joinHost(r); ack && ack({ ok: true, pin: r.pin }); });
    on('bk:config', (cfg) => {
      const r = hostRoom(); if (!r || r.phase !== 'lobby') return; cfg = cfg || {};
      if (cfg.mode) r.mode = cfg.mode === 'score' ? 'score' : 'out';
      if ([60, 120, 180].includes(Number(cfg.time))) r.time = Number(cfg.time);
      emitPhase(r);
    });
    on('bk:start', () => {
      const r = hostRoom(); if (!r || r.phase !== 'lobby' || !r.players.size) return;
      const now = Date.now(); r.resetAt = now; r.shots = []; r.lastArr = null; r.shotN = 0; r.lastShooter = null;
      for (const p of r.players.values()) resetStats(r, p, now);
      r.phase = 'ready'; r.readyAt = now + READY_MS; emitPhase(r); emitRoster(r);
    });
    on('bk:stop', () => { const r = hostRoom(); if (r && (r.phase === 'play' || r.phase === 'ready')) finish(r, 'stop'); });
    on('bk:reset', () => { const r = hostRoom(); if (r) reset(r); });
    on('bk:kick', (id) => { const r = hostRoom(); if (!r || !r.players.has(id)) return; removeFromPeers(r, id, 'bk'); emitRoster(r); });
    on('bk:bots', (n) => {
      const r = hostRoom(); if (!r) return;
      const names = ['민준', '서연', '도윤', '하은', '시우', '지유', '예준', '수아', '주원', '지호', '서윤', '하준', '지안', '은우', '채원'];
      for (let i = 0; i < Math.min(30, n | 0); i++) {
        const id = 'bot_' + uid(), p = { id, bot: true, skill: rand(0.55, 0.98), name: names[Math.floor(Math.random() * names.length)] + '(봇)', color: COLORS[r.players.size % COLORS.length], slot: r.slotN++ };
        resetStats(r, p); if (r.phase === 'play' && r.mode === 'out') p.state = 'out';
        r.players.set(id, p);
      }
      emitRoster(r);
    });
    on('bk:clearbots', () => { const r = hostRoom(); if (!r) return; for (const [id, p] of r.players) if (p.bot) r.players.delete(id); emitRoster(r); });

    on('bk:join', (d, ack) => {
      let { pin, name, pid, color } = d || {}; pin = String(pin || '').trim();
      const r = rooms.get(pin);
      const go = activeRedirect('bk', pin);
      if (go) return ack && ack({ ok: false, redirect: go });
      if (!r) return ack && ack({ ok: false, error: '방 번호를 확인해 주세요.' });
      name = String(name || '').trim().slice(0, 8);
      let p = pid && r.players.get(pid);
      const carry = !p && pid && carryFrom(r, pid);
      if (carry) { name = name || carry.name; if (!COLORS.includes(color)) color = carry.color; }
      if (!p) {
        if (!name) return ack && ack({ ok: false, error: '이름을 입력해 주세요.' });
        if (r.players.size >= 60) return ack && ack({ ok: false, error: '방이 가득 찼습니다.' });
        p = { id: carry ? pid : uid(), name, color: COLORS.includes(color) ? color : COLORS[r.players.size % COLORS.length], slot: r.slotN++ };
        resetStats(r, p);
        if (r.phase === 'end' || (r.phase === 'play' && r.mode === 'out')) p.state = 'out'; // 탈락전 도중·종료 후 입장은 관전
        r.players.set(p.id, p);
      } else { if (name) p.name = name; if (COLORS.includes(color)) p.color = color; }
      p.socketId = socket.id; p.connected = true; r.touched = Date.now();
      socket.join(room(r)); socket.data = { role: 'bkplayer', pin: r.pin, pid: p.id };
      console.log('[bk-join]', r.pin, p.name, 'players=' + r.players.size);
      ack && ack({ ok: true, pid: p.id, me: pub(p) });
      sendAll(r); emitRoster(r);
    });
    // 좌우 버튼 상태가 바뀔 때: {dir:-1|0|1, ts} (ts = 누른 순간의 서버 시각 추정)
    on('bk:in', (v) => {
      const d = socket.data || {}; if (d.role !== 'bkplayer') return;
      const r = rooms.get(d.pin), p = r && r.players.get(d.pid);
      if (!r || !p || p.state !== 'in' || !v) return;
      const now = Date.now(); let ts = Number(v.ts); if (!isFinite(ts)) ts = now;
      ts = Math.round(clamp(ts, now - 450, now));
      p.g.press(Number(v.dir) || 0, ts);
    });
    on('disconnect', () => {
      const d = socket.data || {}; if (d.role !== 'bkplayer') return;
      const r = rooms.get(d.pin), p = r && r.players.get(d.pid);
      if (p && p.socketId === socket.id) { p.connected = false; p.g.press(0, Date.now()); emitRoster(r); }
    });
  }

  return { rooms, newRoom, setup, tick, reset, emitRoster };
};
