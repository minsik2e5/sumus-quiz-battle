// V13.191 인형뽑기 "2.5D 물리" 시험(docs/claw-3d-feasibility.md). 앱에 연결하지 않은 단독 페이지, 머지 대상 아님.
// 지금 그림(12지 봉제 인형 -s 128px · 기계 · 집게) 그대로, 2D 강체 물리(matter-js 0.19, gzip 25KB)를 깊이 줄 3장(뒤 · 가운데 · 앞)에 따로 돌린다:
//   같은 줄 인형끼리만 부딪고(충돌 분류), 줄마다 바닥 높이 · 좌우 벽 · 크기가 원근을 따른다(지금 화면의 floorAt과 같은 숫자).
// "결정된 물리": 판 id → 같은 시작(서버 roundLayout), 고정 시간 간격(1/60초) · 씨앗 난수 → 같은 기기에서는 같은 장면.
//   잡힘 · 놓침은 서버 값(여기서는 버튼 · 차례로 흉내)이고, 물리는 그 결과를 연출만 한다: 잡힘이면 배출구 위에서 놓고,
//   놓침이면 정해진 순간에 연결을 끊는다. 마지막 순간 보정: 놓친 인형이 배출구로 들어가려 하면 옆으로 민다(결과가 서버와 어긋나지 않게).
// 그리기: 기계 · 유리 반사는 움직이지 않으니 <img> 층(한 번만 그림), 캔버스에는 인형 · 집게만 매 프레임 그린다.
// 주소 옵션: ?n=20(인형 수) &dpr=1(해상도, 상한 1.5) &auto=0(자동 끔) &seed=판id
import { roundLayout } from '/modules/claw-rules.js';

const M = window.Matter;
const { Engine, Bodies, Body, Composite, Constraint, Common, Sleeping } = M;
const q = new URLSearchParams(location.search);
const N = Math.max(1, Math.min(40, Number(q.get('n')) || 20));
const DPR = Math.min(Number(q.get('dpr')) || devicePixelRatio || 1, 1.5); // 해상도 상한 1.5(저사양 폰 채우기 비용)
const AUTO = q.get('auto') !== '0';
const SEED = q.get('seed') || 'r-proto-0001';
const W = 600, H = 900, STEP = 1000 / 60;
const FLOOR = { back: 50, front: 55.5, l0: 26, r0: 74, l1: 17, r1: 83 };
const RAIL = H * 0.215;
const ROWS = [0.12, 0.45, 0.8];
const CAT = [0x2, 0x4, 0x8];
const CHUTE = 0.34;                       // 앞 두 줄의 왼쪽(0 ~ 0.34)은 배출구
const floorY = y => H * (FLOOR.back + (FLOOR.front - FLOOR.back) * y) / 100;
const lx = y => W * (FLOOR.l0 + (FLOOR.l1 - FLOOR.l0) * y) / 100;
const rx = y => W * (FLOOR.r0 + (FLOOR.r1 - FLOOR.r0) * y) / 100;
const atX = (row, f) => lx(ROWS[row]) + (rx(ROWS[row]) - lx(ROWS[row])) * f;
const scaleOf = y => 0.78 + 0.22 * y;
const rowOf = y => y < 0.3 ? 0 : y < 0.62 ? 1 : 2;

// 씨앗 난수(mulberry32): Math.random을 쓰지 않는다.
const seedOf = s => { let h = 2166136261; for (const ch of String(s)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return h >>> 0; };
const rng = seed => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };

/* ---------- 세계 만들기(그리기와 따로: 재현 검사도 같은 함수를 쓴다) ---------- */
export function makeWorld(seed = SEED, n = N) {
  Common._seed = seedOf(seed) % 233280;
  const rand = rng(seedOf(seed));
  const engine = Engine.create({ enableSleeping: true }); // 멈춘 인형은 계산을 쉰다
  engine.gravity.y = 1.15;
  engine.positionIterations = 6; engine.velocityIterations = 4;
  const statics = [];
  ROWS.forEach((y, row) => {
    const f = floorY(y), l = lx(y), r = rx(y), mask = { category: 0x1, mask: CAT[row] };
    const chuteEdge = row ? atX(row, CHUTE) : l;
    statics.push(Bodies.rectangle((chuteEdge + r) / 2, f + 30, r - chuteEdge + 40, 60, { isStatic: true, collisionFilter: mask, friction: 0.9 }));
    statics.push(Bodies.rectangle(l - 15, f - 300, 30, 700, { isStatic: true, collisionFilter: mask }));
    statics.push(Bodies.rectangle(r + 15, f - 300, 30, 700, { isStatic: true, collisionFilter: mask }));
    if (row) statics.push(Bodies.rectangle(chuteEdge - 6, f - 22, 12, 56, { isStatic: true, collisionFilter: mask, chamfer: { radius: 5 } })); // 배출구 칸막이(낮다)
  });
  Composite.add(engine.world, statics);
  // 인형: 서버 판 배치(roundLayout)의 종류 · 자리 · 층으로 시작해 위에서 떨어뜨려 쌓는다.
  const layout = roundLayout(seed);
  const dolls = [];
  for (let i = 0; i < n; i++) {
    const d = layout[i % layout.length], row = rowOf(d.y), s = scaleOf(ROWS[row]) * d.s;
    let fx = row ? CHUTE + 0.06 + (1 - CHUTE - 0.12) * ((d.x - 0.34) / 0.66 + (rand() - 0.5) * 0.1) : 0.08 + d.x * 0.84;
    fx = Math.min(0.92, Math.max(row ? CHUTE + 0.08 : 0.08, fx));
    const r = 132 * s * 0.31;
    const body = Bodies.circle(atX(row, fx), floorY(ROWS[row]) - r - d.z * r * 1.7 - i * 6, r, {
      friction: 0.7, frictionStatic: 0.9, restitution: 0.12, density: 0.0012, frictionAir: 0.012,
      collisionFilter: { category: CAT[row], mask: 0x1 | CAT[row] }, angle: (d.r * Math.PI) / 180
    });
    body.plugin = { k: d.k, g: d.g, row, s, r };
    dolls.push(body);
  }
  Composite.add(engine.world, dolls);
  return { engine, dolls, rand };
}
const stepWorld = w => Engine.update(w.engine, STEP);
// 재현 검사: 같은 판 id · 같은 걸음 수 → 같은 자리(소수 셋째 자리까지)인지 글자로 돌려준다.
export function replay(seed = SEED, steps = 240, n = N) {
  const w = makeWorld(seed, n);
  for (let i = 0; i < steps; i++) stepWorld(w);
  return w.dolls.map(b => `${b.position.x.toFixed(3)},${b.position.y.toFixed(3)},${b.angle.toFixed(3)}`).join(';');
}

/* ---------- 그림 ---------- */
const pics = new Map();
const pic = src => { if (!pics.has(src)) { const im = new Image(); im.decoding = 'async'; im.src = src; pics.set(src, im); } return pics.get(src); };
const dollPic = (k, pose = '') => pic(`/assets/claw/doll-${k}${pose ? `-${pose}` : ''}-s.webp`);
['claw-open', 'claw-closed'].forEach(n => pic(`/assets/claw/${n}.webp`));

const canvas = document.getElementById('pp-canvas'), ctx = canvas.getContext('2d');
const stage = document.getElementById('pp-stage');
function fit() { const r = stage.getBoundingClientRect(); canvas.width = Math.round(r.width * DPR); canvas.height = Math.round(r.height * DPR); }
addEventListener('resize', fit); fit();

let world = makeWorld();
const claw = { x: atX(2, 0.15), y: RAIL + 20, row: 2, open: false, held: null, link: null };

function draw() {
  const k = canvas.width / W;
  ctx.setTransform(k, 0, 0, k, 0, 0);
  ctx.clearRect(0, 0, W, H);
  // 뒤 줄 → 앞 줄 순서(줄 안에서는 위에 있는 인형을 나중에).
  for (let row = 0; row < 3; row++) {
    const list = world.dolls.filter(b => b.plugin.row === row && !b.plugin.gone).sort((a, b) => b.position.y - a.position.y);
    for (const b of list) {
      const { k: key, s } = b.plugin, size = 132 * s, im = dollPic(key, b === claw.held ? 'grab' : b.plugin.fall ? 'fall' : '');
      if (!im.complete) continue;
      ctx.save(); ctx.translate(b.position.x, b.position.y); ctx.rotate(b.angle);
      ctx.drawImage(im, -size / 2, -size * 0.58, size, size);
      ctx.restore();
    }
    if (row === claw.row) drawClaw();
  }
}
function drawClaw() {
  const s = scaleOf(ROWS[claw.row]), w = 126 * s, h = w * 362 / 384;
  ctx.strokeStyle = '#e5e7eb'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(claw.x, RAIL); ctx.lineTo(claw.x, claw.y + 4); ctx.stroke();
  const im = pics.get(`/assets/claw/claw-${claw.open ? 'open' : 'closed'}.webp`);
  if (im?.complete) { ctx.save(); ctx.translate(claw.x, claw.y); ctx.rotate(claw.sway || 0); ctx.drawImage(im, -w / 2, 0, w, h); ctx.restore(); }
}
const gripPoint = () => ({ x: claw.x, y: claw.y + 126 * scaleOf(ROWS[claw.row]) * 0.62 });

/* ---------- 집게 연출: 서버 결과를 흉내 낸 차례 ---------- */
const queue = ['lift', 'win', 'chute'];
let nextPick = null, plan = [], planT = 0;
const ease = t => t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
const lerp = (a, b, t) => a + (b - a) * t;
function moveTo(ms, to, during) { const from = { x: claw.x, y: claw.y }; return { ms, fn: t => { const e = ease(t); if (to.x != null) claw.x = lerp(from.x, to.x, e); if (to.y != null) claw.y = lerp(from.y, to.y, e); during?.(t); } }; }
const once = fn => ({ ms: 0, fn: (t, first) => first && fn() });
function grab(b) {
  claw.held = b; b.plugin.fall = false; Sleeping.set(b, false);
  claw.link = Constraint.create({ pointA: gripPoint(), bodyB: b, pointB: { x: 0, y: -b.plugin.r * 0.55 }, length: 0, stiffness: 0.09, damping: 0.12 });
  Composite.add(world.engine.world, claw.link);
}
function release(fix = null) {
  if (!claw.link) return;
  Composite.remove(world.engine.world, claw.link); const b = claw.held; claw.link = null; claw.held = null; claw.open = true;
  if (b) { b.plugin.fall = true; fix?.(b); }
}
function nextRound() {
  const result = nextPick || queue[Math.floor(world.rand() * queue.length)];
  nextPick = null;
  const alive = world.dolls.filter(b => !b.plugin.gone && b.plugin.row > 0);
  const target = alive.sort((a, b) => a.position.y - b.position.y)[0] || world.dolls[0];
  claw.row = target.plugin.row;
  const top = target.position.y - target.plugin.r * 1.1 - 126 * scaleOf(ROWS[claw.row]) * 0.62 + target.plugin.r * 0.6;
  const chuteX = atX(2, 0.15), edgeX = atX(2, CHUTE);
  document.getElementById('pp-note').textContent = `서버 결과(흉내): ${result === 'win' ? '잡힘' : result === 'lift' ? '올라가다 놓침' : '배출구 앞에서 놓침'} → 물리는 이 결과에 맞춰 연출만`;
  plan = [
    once(() => { claw.open = true; }),
    moveTo(800, { x: target.position.x }),
    moveTo(900, { y: top }),
    once(() => { claw.open = false; grab(target); }),
    { ms: 320, fn: () => {} },
    moveTo(result === 'lift' ? 520 : 900, { y: result === 'lift' ? lerp(top, RAIL + 20, 0.45) : RAIL + 20 }),
    ...(result === 'lift' ? [once(() => release())] : []),
    ...(result === 'win' ? [moveTo(900, { x: chuteX }), once(() => release(b => { Body.setPosition(b, { x: chuteX, y: b.position.y }); Body.setVelocity(b, { x: 0, y: 2 }); b.plugin.row = 2; b.collisionFilter = { category: CAT[2], mask: 0x1 | CAT[2] }; }))] : []),
    // 마지막 순간 보정: 놓침인데 배출구 쪽이면 칸막이 오른쪽으로 민다(서버 결과와 어긋나지 않게).
    ...(result === 'chute' ? [moveTo(700, { x: lerp(claw.x, chuteX, 0.6) }), once(() => release(b => { const minX = edgeX + b.plugin.r + 6; if (b.position.x < minX) Body.setPosition(b, { x: minX, y: b.position.y }); Body.setVelocity(b, { x: 2.2, y: 0 }); }))] : []),
    { ms: 600, fn: () => {} },
    moveTo(900, { x: atX(2, 0.15), y: RAIL + 20 }),
    once(() => { claw.open = false; claw.row = 2; }),
    { ms: 700, fn: () => {} }
  ];
  planT = 0;
}
function runPlan(dt) {
  if (!plan.length) { if (AUTO) nextRound(); return; }
  const cur = plan[0], first = planT === 0;
  planT += dt;
  const t = cur.ms ? Math.min(1, planT / cur.ms) : 1;
  cur.fn(t, first);
  if (t >= 1) { plan.shift(); planT = 0; }
}
// 배출구로 들어간 인형은 사라졌다가 맨 위에서 다시 떨어진다(시험이 계속 돌게).
function recycle() {
  for (const b of world.dolls) {
    if (b.plugin.gone || b.position.y < H * 0.62) continue;
    b.plugin.gone = true; Body.setStatic(b, true);
    setTimeout(() => { const row = 1 + Math.floor(world.rand() * 2); b.plugin = { ...b.plugin, row, gone: false, fall: false }; b.collisionFilter = { category: CAT[row], mask: 0x1 | CAT[row] }; Body.setStatic(b, false); Body.setPosition(b, { x: atX(row, 0.55 + world.rand() * 0.3), y: RAIL + 40 }); Body.setVelocity(b, { x: 0, y: 0 }); }, 900);
  }
}

/* ---------- 고정 시간 간격 루프 + 측정 ---------- */
const S = { frames: [], phys: [], draw: [], steps: 0 };
window.__statsReset = () => { S.frames = []; S.phys = []; S.draw = []; S.steps = 0; };
const pct = (a, p) => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(s.length * p))]; };
const avg = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;
window.__stats = () => ({ frames: S.frames.length, avgFrame: avg(S.frames), p95Frame: pct(S.frames, 0.95), avgPhys: avg(S.phys), p95Phys: pct(S.phys, 0.95), avgDraw: avg(S.draw), p95Draw: pct(S.draw, 0.95), long: S.frames.filter(f => f > 25).length, dolls: world.dolls.length, dpr: DPR, canvas: [canvas.width, canvas.height] });
window.__proto = { replay, makeWorld };
let last = performance.now(), acc = 0, shown = 0;
function frame(now) {
  window.__firstFrame ||= performance.now();
  const dt = Math.min(100, now - last); last = now; S.frames.push(dt); acc += dt;
  const p0 = performance.now();
  let n = 0;
  while (acc >= STEP && n < 4) {
    runPlan(STEP);
    if (claw.link) claw.link.pointA = gripPoint();
    stepWorld(world); acc -= STEP; n++; S.steps++;
  }
  if (n === 4) acc = 0;
  recycle();
  const p1 = performance.now();
  draw();
  const p2 = performance.now();
  S.phys.push(p1 - p0); S.draw.push(p2 - p1);
  if (now - shown > 500) {
    shown = now;
    const recent = S.frames.slice(-30);
    document.getElementById('pp-fps').textContent = `${Math.round(1000 / Math.max(1, avg(recent)))} fps`;
    const st = window.__stats();
    document.getElementById('pp-stats').textContent = `인형 ${st.dolls} · 해상도 ${st.canvas.join('×')} (dpr ${DPR})\n프레임 평균 ${st.avgFrame.toFixed(1)}ms · 95% ${st.p95Frame.toFixed(1)}ms\n물리 평균 ${st.avgPhys.toFixed(2)}ms · 그리기 평균 ${st.avgDraw.toFixed(2)}ms`;
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

document.getElementById('pp-win').onclick = () => { nextPick = 'win'; };
document.getElementById('pp-lift').onclick = () => { nextPick = 'lift'; };
document.getElementById('pp-chute').onclick = () => { nextPick = 'chute'; };
document.getElementById('pp-shake').onclick = () => { for (const b of world.dolls) if (!b.plugin.gone) { Sleeping.set(b, false); Body.applyForce(b, b.position, { x: (world.rand() - 0.5) * 0.04 * b.mass, y: -0.03 * b.mass }); } };
