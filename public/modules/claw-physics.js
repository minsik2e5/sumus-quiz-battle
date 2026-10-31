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
const bandOf = y => y < 0.33 ? 0 : y < 0.66 ? 1 : 2;

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
  const wake = b => Sleeping.set(b, false);
  return {
    engine, bodies,
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
      p.free = true; p.bounces = 0; p.touched = false;
      b.collisionFilter = { category: FREE, mask: BAND[p.band] };
      wake(b); Body.setPosition(b, at); Body.setAngle(b, 0); Body.setVelocity(b, vel); Body.setAngularVelocity(b, spin);
      if (onLand) landed.set(i, onLand);
    },
    // 기계 전체가 들썩(집게권 넣을 때 · 크게 흔들릴 때).
    jolt(power, rand = Math.random) { for (const i of bodies.keys()) this.kick(i, (rand() - 0.5) * power, -power * (0.6 + rand() * 0.5), (rand() - 0.5) * power * 0.02); },
    step() { Engine.update(engine, STEP); },
    still() { for (const b of bodies.values()) if (!b.isSleeping && (b.plugin.free || b.speed > 0.02 || Math.abs(b.angularVelocity) > 0.0005 || Math.hypot(b.position.x - b.plugin.home.x, b.position.y - b.plugin.home.y) > 0.3)) return false; return true; }
  };
}
