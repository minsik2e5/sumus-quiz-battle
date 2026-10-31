// V13.203 검사: 인형뽑기 물리(public/modules/claw-physics.js · #232 시험의 다음 단계).
//   물리는 연출만: 서버 판정 · 판 배치는 그대로, 인형은 늘 제자리(서버 자리)로 돌아와 조준 반짝임과 어긋나지 않는다.
//   matter-js는 쓸 때만 받고(미리 받기 제외), 동작 줄이기면 받지 않는다.
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const source = path => readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8');

export async function runClawPhysicsChecks(assert) {
  const { default: M } = await import('../public/vendor/matter.js');
  const { makePile, loadMatter, W, H } = await import('../public/modules/claw-physics.js');
  assert(M?.version === '0.19.0' && typeof loadMatter === 'function' && W === 600 && H === 900, 'V13.203 matter-js 0.19(ES 모듈로 감쌈)와 물리 단위(기계 그림 600 × 900)');
  const settle = (P, max = 1500) => { let n = 0; while (!P.still() && n < max) { P.step(); n++; } return n; };
  const near = (b, h, e = 0.6) => Math.hypot(b.position.x - h.x, b.position.y - h.y) <= e && Math.abs(b.angle) < 0.02;

  // 1) 겹친 더미는 서로 밀어내지 않는다(판 배치가 원래 겹쳐 있다): 그대로 제자리.
  {
    const P = makePile(M), a = { x: 300, y: 500 }, b = { x: 320, y: 505 };
    P.add(0, a, 30, 0.5); P.add(1, b, 30, 0.5);
    for (let i = 0; i < 120; i++) P.step();
    assert(near(P.bodies.get(0), a) && near(P.bodies.get(1), b), 'V13.203 더미 인형끼리는 부딪지 않아 겹친 판 배치 그대로 제자리');
  }
  // 2) 놓친 인형: 위에서 떨어져 같은 줄 인형에 부딪고 튀고 굴러도, 결국 자기 자리로 돌아와 멈춘다(조준 · 판정과 같은 자리).
  {
    const P = makePile(M), homes = [{ x: 300, y: 500 }, { x: 330, y: 498 }, { x: 260, y: 520 }];
    homes.forEach((h, i) => P.add(i, h, 28, 0.5));
    const seen = [];
    P.drop(0, { x: 200, y: 260 }, { x: 2, y: 0 }, 0.1, (kind, v) => seen.push(kind));
    const n = settle(P);
    assert(seen[0] === 'touch' && seen.at(-1) === 'rest' && n < 400 && homes.every((h, i) => near(P.bodies.get(i), h)),
      `V13.203 떨어진 인형은 닿음 → 다시 묶임 순서로 알리고 ${n}걸음(약 ${(n / 60).toFixed(1)}초) 안에 모두 제자리`);
    const other = P.bodies.get(1);
    assert(other.plugin.free === false && P.bodies.get(0).plugin.free === false, 'V13.203 내려앉은 인형은 다시 스프링에 묶인다(떨어지는 상태가 남지 않음)');
  }
  // 3) 툭 침 · 기계 흔들림 · 집 옮기기(뽑힌 자리로 내려앉기): 출렁이다가 (새) 제자리에 멈춘다.
  {
    const P = makePile(M), h = { x: 300, y: 500 };
    P.add(0, h, 30, 0.2); P.add(1, { x: 400, y: 600 }, 30, 0.9);
    P.kick(0, 3, 2, 0.05); P.jolt(3, () => 0.7);
    let moved = false; for (let i = 0; i < 20; i++) { P.step(); moved ||= !near(P.bodies.get(0), h, 2); }
    settle(P);
    assert(moved && near(P.bodies.get(0), h) && near(P.bodies.get(1), { x: 400, y: 600 }), 'V13.203 툭 치거나 흔들면 출렁인 뒤 제자리');
    const to = { x: 280, y: 505 }; P.home(0, to); settle(P);
    assert(near(P.bodies.get(0), to), 'V13.203 뽑힌 자리로 둘레 인형이 내려앉을 때는 새 자리(서버 nudge)로 간다');
    P.remove(0); P.clear();
    assert(P.bodies.size === 0, 'V13.203 뽑힌 인형 · 판 바꿈에는 물리 몸을 지운다');
  }

  // 4) 화면 연결: 연출만, 판정은 그대로.
  const claw = source('../public/modules/claw.js'), phys = source('../public/modules/claw-physics.js');
  assert(claw.includes("if (physicsOn() && !reduced()) loadMatter().then(M => { if (!C || !M) return; C.P = makePile(M); syncPile(); });") && (claw.match(/loadMatter\(\)/g) || []).length === 1, 'V13.203 물리는 스위치가 켜졌을 때 인형뽑기를 열 때만 받고, 동작 줄이기면 받지 않는다(예전 연출 그대로)');
  // 스위치: 테스트 앱에서만 켜지고 운영은 꺼짐.
  const { physicsOn } = await import('../public/modules/claw-physics.js');
  const at = (hostname, search = '') => physicsOn({ hostname, search });
  assert(at('sumus-voca-test.minsik2e5.workers.dev') && at('localhost', '?claw-physics=1') && at('127.0.0.1', '?x=1&claw-physics=1'), 'V13.203 물리 스위치: 테스트 앱(sumus-voca-test)에서 켜짐, 로컬은 ?claw-physics=1일 때만');
  assert(!at('sumus-voca.minsik2e5.workers.dev') && !at('sumus-voca.minsik2e5.workers.dev', '?claw-physics=1') && !at('localhost') && !at('evil.sumus-voca-test.example') && !at('') && !physicsOn(undefined), 'V13.203 물리 스위치: 운영(sumus-voca)은 주소에 무엇을 붙여도 꺼짐(예전 연출 그대로)');
  assert(claw.includes('function homeOf(d) { const p = floorAt(d.x, d.y);') && claw.includes('C.P.home(d.i, homeOf(d))'), 'V13.203 물리 자리는 서버 판 배치(d.x · d.y · d.z)와 서버 nudge에서만 온다');
  assert(claw.includes('body = { id: C.dropId, round: C.round.id, n: C.round.n, x: Math.round(k.x * 1000) / 1000, y: Math.round(k.y * 1000) / 1000 };'), 'V13.203 서버로 보내는 값은 집게 위치뿐(물리 상태를 보내지 않는다)');
  assert(!source('./claw.mjs').includes('physics') && !source('../public/modules/claw-rules.js').includes('physics'), 'V13.203 서버 판정(claw.mjs · claw-rules.js)은 물리를 보지 않는다');
  assert(claw.includes('if (C.P?.bodies.has(doll.i)) return physTumble(') && claw.includes('physPause(plan.hitStop)') && claw.includes('C.physScale = slow.slow'), 'V13.203 놓침 연출(멈춤 · 슬로모션)이 물리 시간에도 걸린다');
  assert(claw.includes('function refill()') && claw.includes('if (!resumed) refill();') &&claw.includes('const home = homeOf(d), up = 70 + d.z * 70') && claw.includes('top = (CEIL.back + 6) * H / 100'), 'V13.203 새 판은 인형이 유리 안에서 쏟아져 쌓인다(이어 하기는 그대로)');
  assert(claw.includes('cancelAnimationFrame(C.physRaf)') && claw.includes("if (scale > 0 && C.P.still()) {"), 'V13.203 물리 루프는 화면을 닫으면 멈추고, 다 멈추면 쉰다(배터리)');
  assert(phys.includes("import('/vendor/matter.js')") && !source('../public/sw.js').includes('"/vendor/matter.js"'), 'V13.203 matter-js(약 80KB)는 미리 받기에서 빼고 인형뽑기를 열 때만 받는다');
  assert(!existsSync(fileURLToPath(new URL('../public/proto/claw-physics.html', import.meta.url))), 'V13.203 #232 시험 페이지는 앱에 들이지 않는다');
}
