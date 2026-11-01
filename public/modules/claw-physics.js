// V13.203 인형뽑기 물리(#232 시험의 다음 단계). 화면 연출만 한다: 어느 인형이 어디 있는지 · 잡힘 · 놓침은 늘 서버 값(server/claw.mjs).
// 인형마다 "집"(서버 판 배치 자리)이 있고 스프링으로 묶여 있다: 집게가 닿으면 출렁, 기계가 흔들리면 들썩, 놓친 인형은 중력으로 떨어져
//   더미에 부딪고 · 튀고 · 굴러서 결국 제자리에 앉는다. 그래서 조준 반짝임 · 서버 판정과 보이는 자리가 어긋나지 않는다.
// 더미 인형끼리는 부딪지 않는다(판 배치가 원래 겹쳐 있다). 떨어지는 인형만 같은 깊이 줄(앞 · 가운데 · 뒤)의 인형과 부딪는다.
// 단위: 기계 그림 너비 600 · 높이 900(그림 2:3, % × 6 · × 9). 한 걸음 1/60초 고정. matter-js는 쓸 때만 받는다(public/vendor/matter.js).
export const W = 600, H = 900, STEP = 1000 / 60;
const DT2 = STEP * STEP;
const G = 0.36;                          // 중력(한 걸음² 당 px)
const SPRING = { k: 0.022, c: 0.13 };     // 집으로 당기는 힘 · 멈추는 힘(조금 출렁이다 멈춘다)
const SPIN = { k: 0.035, c: 0.16 };       // 기울기를 되돌리는 힘
const FREE = 0x10, BAND = [0x2, 0x4, 0x8];
// 도미노(V13.204): 맞은 인형 둘레 reach × 반지름 안에서 fan개까지, delay걸음마다 한 번 더(hops번까지), 번질 때마다 세기 × fade.
export const CHAIN = { reach: 2.4, fan: 2, hops: 2, delay: 5, fade: 0.55, gain: 0.32, max: 3.2, minSpeed: 2.5 };
const FREE_MAX = 150;                     // 떨어지는 상태 최대 걸음(2.5초)
const bandOf = y => y < 0.33 ? 0 : y < 0.66 ? 1 : 2;

// 스위치: 테스트 앱(sumus-voca-test.*)에서만 켠다. 운영(sumus-voca)은 꺼짐 = 예전 연출 그대로(matter-js도 받지 않음).
//   로컬(localhost)에서 볼 때만 주소 뒤 ?claw-physics=1로 켤 수 있다. 운영에서 다 켜려면 이 함수만 바꾼다.
export const TEST_HOST = /^sumus-voca-test\./;
export function physicsOn(loc = globalThis.location) {
  const host = String(loc?.hostname || '');
  if (TEST_HOST.test(host)) return true;
  return /^(localhost|127\.0\.0\.1)$/.test(host) && new URLSearchParams(loc?.search || '').get('claw-physics') === '1';
}

let matter = null;
export const loadMatter = () => matter ||= import('/vendor/matter.js').then(m => m.default).catch(() => { matter = null; return null; });

// 인형 하나: i(자리 번호), home {x, y}(가운데 px), r(반지름 px), depth(0 뒤 ~ 1 앞).
export function makePile(M) {
  const { Engine, Bodies, Body, Composite, Events, Sleeping } = M;
  const engine = Engine.create({ enableSleeping: true });
  engine.gravity.scale = 0;
  const bodies = new Map(), landed = new Map();
  const push = (b, ax, ay) => { b.force.x += b.mass * ax / DT2; b.force.y += b.mass * ay / DT2; };
  Events.on(engine, 'beforeUpdate', () => {
    for (const b of bodies.values()) {
      if (b.isSleeping) continue;
      const p = b.plugin;
      if (p.free) { push(b, 0, G); continue; }
      push(b, -SPRING.k * (b.position.x - p.home.x) - SPRING.c * b.velocity.x, -SPRING.k * (b.position.y - p.home.y) - SPRING.c * b.velocity.y);
      b.torque += b.inertia * (-SPIN.k * b.angle - SPIN.c * b.angularVelocity) / DT2;
    }
  });
  // 떨어지는 인형이 집 높이에 닿으면 튀고, 충분히 느려지면 다시 스프링에 묶인다.
  Events.on(engine, 'afterUpdate', () => {
    for (const [i, b] of bodies) {
      const p = b.plugin;
      // V13.204 이웃 인형 위에 얹혀 집 높이까지 못 내려오면(멈췄거나 너무 오래 떨어짐) 스프링에 다시 묶어 제자리로 데려간다.
      if (p.free && ((p.freeSteps = (p.freeSteps || 0) + 1) > FREE_MAX || (p.freeSteps > 20 && b.speed < 0.25))) {
        if (!p.touched) { p.touched = true; landed.get(i)?.('touch', b.speed); }
        p.free = false; b.collisionFilter = { category: BAND[p.band], mask: FREE }; landed.get(i)?.('rest'); landed.delete(i); continue;
      }
      if (!p.free || b.position.y < p.home.y || b.velocity.y <= 0) continue;
      Body.setPosition(b, { x: b.position.x, y: p.home.y });
      const vy = b.velocity.y;
      Body.setVelocity(b, { x: b.velocity.x * 0.55, y: vy > 2.4 ? -vy * 0.34 : 0 });
      Body.setAngularVelocity(b, b.angularVelocity * 0.5 + b.velocity.x * 0.012);
      p.bounces = (p.bounces || 0) + 1;
      if (!p.touched) { p.touched = true; landed.get(i)?.('touch', vy); }
      if (vy <= 2.4 || p.bounces >= 3) { p.free = false; b.collisionFilter = { category: BAND[p.band], mask: FREE }; landed.get(i)?.('rest'); landed.delete(i); }
    }
  });
  // V13.204 도미노: 떨어지는 인형이 더미 인형을 치면, 맞은 인형 둘레(집 거리 CHAIN.reach × 반지름 안)로 밀림이 한 박자씩 번진다.
  //   더미끼리는 여전히 부딪지 않는다(겹친 판 배치): 번짐은 걸음 수로 정한 툭 치기라서 늘 같은 결과(재현)이고, 다들 제자리로 돌아온다.
  let steps = 0, onBump = null;
  const queue = [], hitThisDrop = new Set();
  const spread = (i, dir, power, hop) => {
    const a = bodies.get(i); if (!a || hop > CHAIN.hops) return;
    const next = [...bodies].filter(([j, b]) => j !== i && !b.plugin.free && !hitThisDrop.has(j) && Math.hypot(b.plugin.home.x - a.plugin.home.x, b.plugin.home.y - a.plugin.home.y) <= CHAIN.reach * a.plugin.r)
      .sort((x, y) => Math.abs(x[1].plugin.home.x - a.plugin.home.x) - Math.abs(y[1].plugin.home.x - a.plugin.home.x)).slice(0, CHAIN.fan);
    for (const [j, b] of next) {
      hitThisDrop.add(j);
      const side = Math.sign(b.plugin.home.x - a.plugin.home.x) || dir;
      queue.push({ at: steps + CHAIN.delay * hop, i: j, vx: side * power, vy: -power * 0.55, spin: side * power * 0.018, power, hop });
    }
  };
  Events.on(engine, 'collisionStart', ev => {
    for (const { bodyA, bodyB } of ev.pairs) {
      const free = bodyA.plugin?.free ? bodyA : bodyB.plugin?.free ? bodyB : null, hit = free === bodyA ? bodyB : bodyA;
      if (!free || hit.plugin?.free || !hit.plugin?.home) continue;
      const i = [...bodies].find(([, b]) => b === hit)?.[0]; if (i == null || hitThisDrop.has(i)) continue;
      const v = Math.hypot(free.velocity.x, free.velocity.y); if (v < CHAIN.minSpeed) continue;
      hitThisDrop.add(i);
      const dir = Math.sign(hit.position.x - free.position.x) || Math.sign(free.velocity.x) || 1, power = Math.min(CHAIN.max, v * CHAIN.gain);
      onBump?.(i, power, 0);
      spread(i, dir, power * CHAIN.fade, 1);
    }
  });
  Events.on(engine, 'afterUpdate', () => {
    steps++;
    for (let n = queue.length - 1; n >= 0; n--) {
      const q = queue[n]; if (q.at > steps) continue;
      queue.splice(n, 1);
      const b = bodies.get(q.i); if (!b) continue;
      wake(b); Body.setVelocity(b, { x: b.velocity.x + q.vx, y: b.velocity.y + q.vy }); Body.setAngularVelocity(b, b.angularVelocity + q.spin);
      onBump?.(q.i, q.power, q.hop);
      spread(q.i, Math.sign(q.vx) || 1, q.power * CHAIN.fade, q.hop + 1);
    }
  });
  const wake = b => Sleeping.set(b, false);
  return {
    engine, bodies,
    // 도미노로 인형이 밀릴 때마다 (i, 세기, 몇 번째 번짐) 알림(눌림 · 톡 소리용).
    set onBump(fn) { onBump = fn; },
    get pending() { return queue.length; },
    add(i, home, r, depth) {
      const band = bandOf(depth);
      const b = Bodies.circle(home.x, home.y, r, { friction: 0.6, frictionAir: 0.02, restitution: 0.25, density: 0.0012, collisionFilter: { category: BAND[band], mask: FREE } });
      b.plugin = { home: { ...home }, band, r, free: false };
      bodies.set(i, b); Composite.add(engine.world, b);
      return b;
    },
    remove(i) { const b = bodies.get(i); if (!b) return; Composite.remove(engine.world, b); bodies.delete(i); landed.get(i)?.('rest'); landed.delete(i); },
    clear() { for (const i of [...bodies.keys()]) this.remove(i); },
    // 집을 옮긴다(뽑힌 자리로 둘레 인형이 내려앉을 때). 스프링이 데려간다.
    home(i, at) { const b = bodies.get(i); if (!b) return; b.plugin.home = { ...at }; wake(b); },
    // 툭 친다(속도 px/걸음 · 회전).
    kick(i, vx, vy, spin = 0) { const b = bodies.get(i); if (!b) return; wake(b); Body.setVelocity(b, { x: b.velocity.x + vx, y: b.velocity.y + vy }); Body.setAngularVelocity(b, b.angularVelocity + spin); },
    // at에서 놓는다: 중력으로 떨어져 같은 줄 인형과 부딪고 집 높이에서 튄다. onLand('touch' 첫 닿음 · 'rest' 다시 묶임).
    drop(i, at, vel = { x: 0, y: 0 }, spin = 0, onLand = null) {
      const b = bodies.get(i); if (!b) { onLand?.('rest'); return; }
      const p = b.plugin;
      p.free = true; p.bounces = 0; p.touched = false; p.freeSteps = 0;
      b.collisionFilter = { category: FREE, mask: BAND[p.band] };
      wake(b); Body.setPosition(b, at); Body.setAngle(b, 0); Body.setVelocity(b, vel); Body.setAngularVelocity(b, spin);
      if (onLand) landed.set(i, onLand);
      hitThisDrop.clear(); hitThisDrop.add(i);
    },
    // 기계 전체가 들썩(집게권 넣을 때 · 크게 흔들릴 때).
    jolt(power, rand = Math.random) { for (const i of bodies.keys()) this.kick(i, (rand() - 0.5) * power, -power * (0.6 + rand() * 0.5), (rand() - 0.5) * power * 0.02); },
    step() { Engine.update(engine, STEP); },
    still() { if (queue.length) return false; for (const b of bodies.values()) if (!b.isSleeping && (b.plugin.free || b.speed > 0.02 || Math.abs(b.angularVelocity) > 0.0005 || Math.hypot(b.position.x - b.plugin.home.x, b.position.y - b.plugin.home.y) > 0.3)) return false; return true; }
  };
}

// V13.204 잡힌 인형 진자: 집게에 매달린 인형이 집게가 움직이고 멈출 때 휘청인다. 쥔 힘(서버 grip)이 약할수록 크게 · 오래 흔들린다.
//   각도(도)만 돌려준다: 화면의 k.sway(집게 기울기)로 쓴다. 판정 · 결과에는 쓰지 않는다.
//   θ'' = -(g/L)·sinθ - c·θ' - (a/L)·cosθ (a: 집게 가로 가속도 px/s²). 시간 단위는 초.
export const PEND = { L: 90, g: 2200, damp: 3.2, looseDamp: 1.8, drive: 0.14, looseDrive: 0.34, max: 22, kick: 1.1 };
export function makePendulum(grip = 50) {
  const loose = 1 - Math.max(0, Math.min(100, Number(grip) || 0)) / 100;
  const c = PEND.damp - (PEND.damp - PEND.looseDamp) * loose, gain = PEND.drive + (PEND.looseDrive - PEND.drive) * loose;
  let a = 0, w = 0, lastX = null, lastV = 0;
  return {
    loose,
    // 들어 올리는 순간 휘청(약하게 쥘수록 크게). dir: 1 오른쪽 · -1 왼쪽.
    kick(dir = 1, power = 1) { w += dir * PEND.kick * power * (0.6 + loose); },
    // dt(ms) 동안 집게가 x(px)에 있었다. 각도(도)를 돌려준다.
    step(dtMs, x) {
      const dt = Math.min(0.05, Math.max(0.001, dtMs / 1000));
      const v = lastX == null ? 0 : (x - lastX) / dt, acc = lastX == null ? 0 : (v - lastV) / dt;
      lastX = x; lastV = v;
      for (let n = 0; n < 4; n++) {
        const h = dt / 4, alpha = -(PEND.g / PEND.L) * Math.sin(a) - c * w - gain * (acc / PEND.L) * Math.cos(a);
        w += alpha * h; a += w * h;
      }
      const lim = PEND.max * Math.PI / 180;
      if (Math.abs(a) > lim) { a = Math.sign(a) * lim; w *= -0.3; }
      return this.deg;
    },
    get deg() { return a * 180 / Math.PI; },
    get still() { return Math.abs(a) < 0.004 && Math.abs(w) < 0.02; }
  };
}

// V13.204 배출구 턱 흔들흔들: 서버가 "배출구 쪽에서 놓침(chute · 심쿵)"으로 정한 판에만, 인형이 배출구 턱에 걸쳐 흔들리다 바깥(더미 쪽)으로 넘어간다.
//   결과(놓침)는 이미 서버가 정했다. 여기서는 넘어가는 방향이 늘 바깥(+1)이고, TEETER.ms 안에 반드시 넘어간다.
//   θ'' = -k(θ - 치우침(t)) - c·θ'. 치우침이 처음엔 0(안쪽 · 바깥 오락가락)이다가 점점 바깥으로 커져 θ가 fall을 넘으면 넘어간다.
export const TEETER = { ms: 1000, k: 150, c: 2.2, start: 0.22, fall: 0.5, lean: 0.9 };
export function makeTeeter(seed = 0) {
  let a = -TEETER.start * (seed % 2 ? 0.8 : 1), w = 0, t = 0, done = false;
  return {
    step(dtMs) {
      if (done) return { deg: a * 180 / Math.PI, done };
      const dt = Math.min(0.05, Math.max(0.001, dtMs / 1000)); t += dt;
      const u = Math.min(1, t * 1000 / TEETER.ms), bias = TEETER.lean * u * u * u;
      for (let n = 0; n < 4; n++) { const h = dt / 4; w += (-TEETER.k * (a - bias) - TEETER.c * w) * h; a += w * h; }
      if (a >= TEETER.fall || u >= 1) { done = true; a = Math.max(a, TEETER.fall); }
      return { deg: a * 180 / Math.PI, done };
    },
    get t() { return t * 1000; }
  };
}
