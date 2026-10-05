// PART 3 — 단체 줄넘기 (서버)
// 줄이 땅을 스치는 순간(hit)마다 모든 학생이 동시에 뛰어넘어야 함. 단계가 오를수록 빠르고 박자가 어려워짐.
// 판정은 전부 서버 시계 기준: 폰이 "눌렀을 때의 서버 시각 추정값(ts)"을 보내고, 서버가 hit 시각과 비교.
module.exports = function createJR(ctx) {
  const { io, uid, rand, COLORS, linked, inactive, carryFrom, activeRedirect, removeFromPeers } = ctx;
  const rooms = new Map();

  const REST = 180;        // 착지 후 다시 뛰려면 쉬어야 하는 시간(ms) — 연타로 항상 공중에 떠 있는 꼼수 방지
  const JUDGE_DELAY = 260; // 늦게 도착하는 점프 신호를 기다린 뒤 판정(ms)
  const MARGIN = 25;       // 발이 땅에서 충분히 떨어져 있어야 하는 앞뒤 여유(ms)
  const STAGE_GAP = 3600;  // 단계 사이 쉬는 시간(ms)

  // 박자 만들기 도구
  const rep = (n, v) => Array(n).fill(v);
  const pattern = (seq, n) => Array.from({ length: n }, (_, i) => seq[i % seq.length]);
  const ramp = (n, a, b) => Array.from({ length: n }, (_, i) => +(a + (b - a) * (i / (n - 1))).toFixed(3));
  const groups = (sets, n, first) => {
    const out = first ? first.slice() : [];
    while (out.length < n) out.push(...sets[Math.floor(Math.random() * sets.length)]);
    return out.slice(0, n);
  };
  // 단계표: n=뛰는 횟수, air=체공 시간(초), ease=정점에서 줄이 느려지는 정도(0~1, 뜸 들이기 연출)
  const STAGES = [null,
    { name: '워밍업', n: 8, air: 0.56, ease: 0.0, gen: () => rep(8, 1.35) },
    { name: '박자 맞추기', n: 10, air: 0.54, ease: 0.1, gen: () => rep(10, 1.15) },
    { name: '따-따-다', n: 12, air: 0.52, ease: 0.2, gen: () => pattern([1.1, 1.1, 0.8], 12) },
    { name: '점점 빨라져요', n: 12, air: 0.5, ease: 0.28, gen: () => ramp(12, 1.15, 0.78) },
    { name: '뜸 들이기', n: 14, air: 0.48, ease: 0.5, gen: () => groups([[0.82, 0.82, 1.35], [0.78, 0.78, 0.78, 1.5], [1.05, 0.8, 1.05, 0.8], [0.8, 1.45]], 14, [1.1, 1.1]) },
    { name: 'FINAL', n: 16, air: 0.46, ease: 0.6, gen: () => groups([[0.76, 0.76, 0.76, 0.76, 1.4], [0.8, 1.5, 0.76, 0.76], [0.74, 0.74, 1.3, 0.74, 0.74, 1.6], [0.95, 0.78, 0.78, 1.2]], 16, [1.0, 0.9]) },
  ];
  const LAST = STAGES.length - 1;
  const lives = (r) => (r.mode === 'life' ? 3 : 1);
  const airMs = (r) => STAGES[Math.max(1, r.stage || 1)].air * 1000;
  const room = (r) => 'jr' + r.pin;

  function newRoom(pin, cfg) {
    cfg = cfg || {};
    return { pin, kind: 'jr', hostKey: uid(), players: new Map(), mode: cfg.mode === 'life' ? 'life' : 'out', startLevel: Math.max(1, Math.min(5, Number(cfg.level) || 1)),
      phase: 'lobby', stage: 0, hits: [], hi: 0, planMsg: null, readyAt: 0, nextStage: 0, endAt: 0, startN: 0, slotN: 0, jq: [], result: null, touched: Date.now() };
  }
  function pub(p) {
    return { id: p.id, name: p.name, color: p.color, state: p.state, hearts: p.hearts, score: p.score, combo: p.combo, best: p.best, jumps: p.jumps, perfect: p.perfect,
      slot: p.slot, connected: p.connected || p.bot, bot: !!p.bot };
  }
  const rosterOf = (r) => [...r.players.values()].map(pub);
  const emitRoster = (r) => io.to(room(r)).emit('jr:roster', rosterOf(r));
  function phaseMsg(r) {
    return { phase: r.phase, mode: r.mode, startLevel: r.startLevel, stage: r.stage, stages: LAST, readyRemain: r.readyAt ? Math.max(0, r.readyAt - Date.now()) : 0,
      serverT: Date.now(), result: r.phase === 'end' ? r.result : null };
  }
  const emitPhase = (r) => io.to(room(r)).emit('jr:phase', phaseMsg(r));
  function resetStats(r, p) {
    Object.assign(p, { state: 'in', hearts: lives(r), score: 0, combo: 0, best: 0, jumps: 0, perfect: 0, jl: [], inv: 0, outStage: 0, bJump: null, bk: 0 });
  }

  function reset(r) {
    r.phase = 'lobby'; r.stage = 0; r.hits = []; r.hi = 0; r.planMsg = null; r.readyAt = 0; r.nextStage = 0; r.endAt = 0; r.result = null; r.jq = [];
    for (const p of r.players.values()) resetStats(r, p);
    emitPhase(r); emitRoster(r);
  }

  function startStage(r, stage, startAt) {
    const S = STAGES[stage], iv = S.gen();
    let t = startAt; const hits = [];
    iv.forEach((d, i) => { t += d * 1000; hits.push({ t: Math.round(t), i, stage }); });
    r.stage = stage; r.hits = hits; r.hi = 0; r.nextStage = 0; r.stageDone = false;
    r.planMsg = { stage, stages: LAST, name: S.name, n: iv.length, air: S.air, ease: S.ease, rest: REST / 1000, start: Math.round(startAt), hits: hits.map(h => h.t), final: stage === LAST };
    io.to(room(r)).emit('jr:plan', r.planMsg);
  }

  function register(r, p, ts) { // 점프 한 번 기록
    const last = p.jl[p.jl.length - 1];
    if (last != null && ts < last + airMs(r) + REST - 40) return false; // 아직 공중이거나 착지 직후
    p.jl.push(ts); if (p.jl.length > 4) p.jl.shift();
    r.jq.push(p.id, ts);
    return true;
  }

  function judge(r, h) {
    const A = STAGES[h.stage].air * 1000, res = [];
    for (const p of r.players.values()) {
      if (p.state !== 'in') continue;
      let ok = false, perfect = false;
      for (const ts of p.jl) if (ts + MARGIN <= h.t && h.t <= ts + A - MARGIN) { ok = true; perfect = Math.abs(h.t - (ts + A / 2)) <= 80; break; }
      if (ok) {
        p.jumps++; p.combo++; p.best = Math.max(p.best, p.combo); if (perfect) p.perfect++;
        p.score += 100 + (perfect ? 50 : 0) + Math.min(p.combo, 10) * 5;
        res.push([p.id, perfect ? 2 : 1]);
      } else if (p.inv > h.t) { // 하트 모드: 방금 걸린 뒤 잠깐은 보호
        res.push([p.id, 3]);
      } else {
        p.combo = 0;
        if (r.mode === 'life') { p.hearts--; p.inv = h.t + 1800; }
        else p.hearts = 0;
        if (p.hearts <= 0) { p.state = 'out'; p.outStage = h.stage; p.outAt = h.t; res.push([p.id, 0, 1]); } else res.push([p.id, 0, 0]);
      }
    }
    io.to(room(r)).emit('jr:hit', { t: h.t, stage: h.stage, i: h.i, n: STAGES[h.stage].n, res });
    emitRoster(r);
  }

  function finish(r, why) {
    const ps = [...r.players.values()];
    const rank = ps.slice().sort((a, b) => (b.state === 'in') - (a.state === 'in') || (b.outStage || 0) - (a.outStage || 0) || b.score - a.score);
    r.result = { why, stage: r.stage, stages: LAST, mode: r.mode, ranking: rank.map(p => ({ id: p.id, name: p.name, color: p.color, alive: p.state === 'in', hearts: p.hearts, score: p.score, jumps: p.jumps, perfect: p.perfect, best: p.best, outStage: p.outStage || 0 })) };
    r.phase = 'end'; r.endAt = 0; r.nextStage = 0;
    emitPhase(r); emitRoster(r);
  }

  function botAct(r, now) {
    const h = r.hits[r.hi];
    for (const p of r.players.values()) {
      if (!p.bot || p.state !== 'in') continue;
      if (h && p.bk !== h.t && now > h.t - 1500) { // 다음 줄에 대한 계획
        p.bk = h.t; p.bJump = null;
        const A = STAGES[h.stage].air * 1000, miss = (1 - (p.skill || 0.93)) * (0.5 + h.stage * 0.4);
        if (Math.random() >= miss) {
          const g = (Math.random() + Math.random() + Math.random() - 1.5) * 2 * (50 + h.stage * 12); // 대략 정규분포 오차
          p.bJump = h.t - A / 2 + g;
        } else if (Math.random() < 0.5) p.bJump = h.t + rand(-A * 0.9, -A * 0.75) - 40; // 너무 일찍 뜀
      }
      if (p.bJump != null && now >= p.bJump) { register(r, p, Math.round(p.bJump)); p.bJump = null; }
    }
  }

  function tick(now, tickN) {
    for (const r of rooms.values()) {
      if (r.phase === 'ready' && now >= r.readyAt) {
        r.phase = 'play'; r.readyAt = 0; r.startN = r.players.size;
        for (const p of r.players.values()) if (p.state === 'in') p.jl = [];
        startStage(r, r.startLevel, now + 700); emitPhase(r);
      }
      if (r.phase === 'play') {
        botAct(r, now);
        while (r.hi < r.hits.length && r.hits[r.hi].t + JUDGE_DELAY <= now) judge(r, r.hits[r.hi++]);
        if (r.hi >= r.hits.length && !r.stageDone) {
          r.stageDone = true;
          const cleared = r.stage, lastT = r.hits[r.hits.length - 1].t;
          if (cleared >= LAST) r.endAt = lastT + 2200;
          else startStage(r, cleared + 1, lastT + STAGE_GAP);
          io.to(room(r)).emit('jr:stage', { cleared, t: lastT, final: cleared >= LAST });
        }
        const alive = [...r.players.values()].filter(p => p.state === 'in').length;
        if (!r.endAt && r.players.size && (alive === 0 || (r.startN >= 2 && alive <= 1))) r.endAt = now + 2200;
        if (r.endAt && now >= r.endAt) finish(r, alive === 0 ? 'out' : r.stage >= LAST && r.hi >= r.hits.length ? 'clear' : 'last');
      }
      if (r.jq.length && tickN % 2 === 0) { io.to(room(r)).emit('jr:j', r.jq); r.jq = []; }
    }
  }

  function setup(socket, on) {
    const hostRoom = () => { const d = socket.data || {}; if (d.role !== 'jrhost') return null; const r = rooms.get(d.pin); if (!r || inactive(r, 'jr')) return null; r.touched = Date.now(); return r; };
    const sendAll = (r) => { socket.emit('jr:phase', phaseMsg(r)); socket.emit('jr:roster', rosterOf(r)); if (r.planMsg) socket.emit('jr:plan', r.planMsg); };
    const joinHost = (r) => { socket.join(room(r)); socket.data = { role: 'jrhost', pin: r.pin }; sendAll(r); };

    on('jr:create', (cfg, ack) => { // 서버가 다시 켜진 뒤 같은 번호로 방을 복구할 때 (수업 방 키 필요)
      cfg = cfg || {};
      const pin = ctx.claimPin('jr', cfg.pin, cfg.sk, socket);
      if (!pin) return ack && ack(ctx.FULL);
      const r = newRoom(pin, cfg); if (cfg.sk && pin === String(cfg.pin)) { r.sk = cfg.sk; ctx.linkSession(pin, cfg.sk, 'jr'); }
      ctx.adoptOrphans('jr', pin, linked(r)); rooms.set(pin, r); joinHost(r); ack && ack({ ok: true, pin, hostKey: r.hostKey });
    });
    on('jr:resume', (d, ack) => { const { pin, hostKey } = d || {}; const r = rooms.get(String(pin)); if (!r || !hostKey || r.hostKey !== hostKey) return ack && ack({ ok: false }); joinHost(r); ack && ack({ ok: true, pin: r.pin }); });
    on('jr:config', (cfg) => {
      const r = hostRoom(); if (!r || r.phase !== 'lobby') return; cfg = cfg || {};
      if (cfg.mode) r.mode = cfg.mode === 'life' ? 'life' : 'out';
      if (cfg.level) r.startLevel = Math.max(1, Math.min(5, Number(cfg.level) || 1));
      for (const p of r.players.values()) p.hearts = lives(r);
      emitPhase(r); emitRoster(r);
    });
    on('jr:start', () => {
      const r = hostRoom(); if (!r || r.phase !== 'lobby' || !r.players.size) return;
      for (const p of r.players.values()) resetStats(r, p);
      r.phase = 'ready'; r.readyAt = Date.now() + 4200; r.stage = r.startLevel; emitPhase(r); emitRoster(r);
    });
    on('jr:stop', () => { const r = hostRoom(); if (r && (r.phase === 'play' || r.phase === 'ready')) finish(r, 'stop'); });
    on('jr:reset', () => { const r = hostRoom(); if (r) reset(r); });
    on('jr:kick', (id) => {
      const r = hostRoom(); if (!r) return; const p = r.players.get(id); if (!p) return;
      removeFromPeers(r, id, 'jr'); emitRoster(r);
    });
    on('jr:bots', (n) => {
      const r = hostRoom(); if (!r) return;
      const names = ['민준', '서연', '도윤', '하은', '시우', '지유', '예준', '수아', '주원', '지호', '서윤', '하준', '지안', '은우', '채원'];
      for (let i = 0; i < Math.min(30, n | 0); i++) {
        const id = 'bot_' + uid(), p = { id, bot: true, skill: rand(0.82, 0.995), name: names[Math.floor(Math.random() * names.length)] + '(봇)', color: COLORS[r.players.size % COLORS.length], slot: r.slotN++ };
        resetStats(r, p); if (r.phase === 'play' || r.phase === 'end') p.state = 'out';
        r.players.set(id, p);
      }
      emitRoster(r);
    });
    on('jr:clearbots', () => { const r = hostRoom(); if (!r) return; for (const [id, p] of r.players) if (p.bot) r.players.delete(id); emitRoster(r); });

    on('jr:join', (d, ack) => {
      let { pin, name, pid, color } = d || {}; pin = String(pin || '').trim();
      const r = rooms.get(pin);
      const go = activeRedirect('jr', pin);
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
        resetStats(r, p); if (r.phase === 'play' || r.phase === 'end') p.state = 'out';
        r.players.set(p.id, p);
      } else { if (name) p.name = name; if (COLORS.includes(color)) p.color = color; }
      p.socketId = socket.id; p.connected = true; r.touched = Date.now();
      socket.join(room(r)); socket.data = { role: 'jrplayer', pin: r.pin, pid: p.id };
      console.log('[jr-join]', r.pin, p.name, 'players=' + r.players.size);
      ack && ack({ ok: true, pid: p.id, me: pub(p) });
      sendAll(r); emitRoster(r);
    });
    on('jr:jump', (v) => {
      const d = socket.data || {}; if (d.role !== 'jrplayer') return;
      const r = rooms.get(d.pin), p = r && r.players.get(d.pid);
      if (!r || !p || r.phase !== 'play' || p.state !== 'in') return;
      const now = Date.now(); let ts = Number(v && v.ts); if (!isFinite(ts)) ts = now;
      ts = Math.round(Math.max(now - 450, Math.min(now, ts))); // 시계를 속여도 최근 0.45초 안으로만 인정
      register(r, p, ts);
    });
    on('disconnect', () => {
      const d = socket.data || {}; if (d.role !== 'jrplayer') return;
      const r = rooms.get(d.pin), p = r && r.players.get(d.pid);
      if (p && p.socketId === socket.id) { p.connected = false; emitRoster(r); }
    });
  }

  return { rooms, newRoom, setup, tick, reset, emitRoster, STAGES };
};
