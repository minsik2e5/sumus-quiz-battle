// 공용 계산 (서버 없이): public/bk-common.js 골키퍼·공, public/jr-common.js 줄 움직임
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const BK = require('../public/bk-common.js');

// jr-common.js 는 window.JR 로만 내보내므로 가짜 window 에서 실행
function loadJR() {
  const win = {};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'public', 'jr-common.js'), 'utf8'), { window: win, Math });
  return win.JR;
}

// 무작위 입력 기록 만들기 (DT 배수가 아닌 시각 포함)
function randomPresses(seed, t0, n) {
  let s = seed; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const out = []; let t = t0;
  for (let i = 0; i < n; i++) { t += Math.floor(rnd() * 180) + 1; out.push({ t, dir: [-1, 0, 1][Math.floor(rnd() * 3)] }); }
  return out;
}

module.exports = [
  { name: 'BK constants and UMD export', fn() {
    assert.equal(typeof BK.Goalie, 'function');
    assert.equal(BK.REACH, BK.GW + BK.BR);
    assert.equal(BK.DT, 10);
    assert.equal(BK.LEVELS.length, 5);
    assert.equal(BK.levelOf(0), 0); assert.equal(BK.levelOf(0.39), 1); assert.equal(BK.levelOf(0.4), 2); assert.equal(BK.levelOf(1), 4);
  } },

  { name: 'Goalie press/at: accelerates to V, clamps at XMAX, slides to stop', fn() {
    const g = new BK.Goalie(); g.reset(1000);
    assert.deepEqual(g.at(1000), { t: 1000, x: 0, v: 0, dir: 0 });
    g.press(1, 1000);
    const a = g.at(1050), b = g.at(1200);
    assert.ok(a.v > 0 && a.v < BK.V, 'still accelerating at 50ms: ' + a.v);
    assert.ok(Math.abs(b.v - BK.V) < 1e-9, 'top speed after ~107ms: ' + b.v);
    assert.ok(b.x > a.x && a.x > 0);
    // 같은 시각을 두 번 물어도 같은 값 (상태를 바꾸지 않음)
    assert.deepEqual(g.at(1200), b);
    const far = g.at(4000);
    assert.equal(far.x, BK.XMAX); assert.equal(far.v, 0);
    // 떼면 미끄러지다 멈춤 (ACC=14 → 1.5/14 ≈ 0.107s)
    const h = new BK.Goalie(); h.reset(0); h.press(1, 0); h.press(0, 300);
    const s1 = h.at(300), s2 = h.at(600);
    assert.ok(s1.v > 1.4);
    assert.equal(s2.v, 0);
    const slide = s2.x - s1.x, expect = (BK.V * BK.V) / (2 * BK.ACC);
    assert.ok(Math.abs(slide - expect) < 0.02, 'slide ' + slide + ' ≈ ' + expect);
    // 왼쪽은 대칭
    const l = new BK.Goalie(); l.reset(0); l.press(-1, 0); l.press(0, 300);
    assert.ok(Math.abs(l.at(600).x + s2.x) < 1e-9);
  } },

  { name: 'Goalie press: late (out-of-order) signal does not go back in time', fn() {
    const g = new BK.Goalie(); g.reset(1000);
    g.press(1, 1500); g.press(0, 1400); // 늦게 온 신호
    assert.equal(g.ev[1].t, 1500);
    g.press(-1, 900); // reset 이전 시각도 base.t 이후로
    assert.equal(g.ev[2].t, 1500);
    const h = new BK.Goalie(); h.reset(1000); h.press(1, 500);
    assert.equal(h.ev[0].t, 1000);
  } },

  { name: 'Goalie compact keeps results identical to uncompacted sim', fn() {
    for (let seed = 1; seed <= 30; seed++) {
      const ev = randomPresses(seed, 5003, 60);
      const ref = new BK.Goalie(); ref.reset(5003);
      const cmp = new BK.Goalie(); cmp.reset(5003);
      let k = 0;
      // 서버처럼 25ms 마다 compact(now, 3000), 폰처럼 다른 keep 값으로도
      for (let now = 5003; now < ev[ev.length - 1].t + 4000; now += 25 + (seed % 7)) {
        while (k < ev.length && ev[k].t <= now) { ref.press(ev[k].dir, ev[k].t); cmp.press(ev[k].dir, ev[k].t); k++; }
        cmp.compact(now, seed % 2 ? 3000 : 137);
        const t = now + 3;
        const A = ref.at(t), B = cmp.at(t);
        assert.ok(Math.abs(A.x - B.x) < 1e-9 && Math.abs(A.v - B.v) < 1e-9 && A.dir === B.dir, 'seed ' + seed + ' t ' + t + ': ' + JSON.stringify(A) + ' vs ' + JSON.stringify(B));
      }
    }
  } },

  { name: 'Goalie compact keeps events with t > tb - DT (last step not yet applied)', fn() {
    // compact(now, keep) → tb = floor((now-keep)/DT)*DT. 입력이 (tb-DT, tb] 안에 있으면 base 에 아직 반영되지 않으므로 남아 있어야 함
    const g = new BK.Goalie(); g.reset(0);
    g.press(1, 995);           // tb=1000 이면 tb-DT=990 < 995 ≤ 1000
    g.press(0, 1000);          // 정확히 tb 인 입력도 남아야 함
    g.compact(3000, 2000);     // tb = 1000
    assert.equal(g.base.t, 1000);
    assert.deepEqual(g.ev.map(e => e.t), [995, 1000]);
    const ref = new BK.Goalie(); ref.reset(0); ref.press(1, 995); ref.press(0, 1000);
    assert.deepEqual(g.at(1500), ref.at(1500));
    // tb-DT 이하의 입력은 이미 반영됐으니 버림
    const h = new BK.Goalie(); h.reset(0); h.press(1, 990); h.press(-1, 1005); h.compact(3000, 2000);
    assert.deepEqual(h.ev.map(e => e.t), [1005]);
    const href = new BK.Goalie(); href.reset(0); href.press(1, 990); href.press(-1, 1005);
    assert.deepEqual(h.at(1300), href.at(1300));
    // 너무 이른 compact 는 아무것도 안 함
    const z = new BK.Goalie(); z.reset(5000); z.press(1, 5100); z.compact(5200, 3000);
    assert.equal(z.base.t, 5000); assert.equal(z.ev.length, 1);
  } },

  { name: 'ballAt and judge', fn() {
    const s = { t0: 1000, t1: 2600, x0: 0.1, x1: -0.7, A: 0.2, dx: 0, s: 0.7, lob: 0.3 };
    assert.ok(Math.abs(BK.ballAt(s, 1000).x - 0.1) < 1e-9);
    assert.ok(Math.abs(BK.ballAt(s, 2600).x + 0.7) < 1e-9);
    assert.ok(Math.abs(BK.ballAt(s, 9999).x + 0.7) < 1e-9); // 도착 뒤는 도착 위치
    assert.equal(BK.ballAt(s, 1800).flying, true); assert.equal(BK.ballAt(s, 2700).flying, false);
    // 바나나 곡선: 중간에서 직선보다 A 만큼 휨
    assert.ok(Math.abs(BK.ballAt(s, 1800).x - ((0.1 - 0.7) / 2 + 0.2)) < 1e-9);
    assert.equal(BK.judge(0, 0.06), 2); assert.equal(BK.judge(0, 0.061), 1);
    assert.equal(BK.judge(0, BK.REACH), 1); assert.equal(BK.judge(0, BK.REACH + 0.001), 0);
    assert.equal(BK.judge(0.5, 0.3), 1);
  } },

  { name: 'JR swing: one full turn per hit interval, idle outside', fn() {
    const JR = loadJR();
    const plan = { start: 1000, hits: [2000, 3000, 3500], ease: 0 };
    assert.equal(JR.swing(plan, 900).idle, true);
    assert.equal(JR.swing(plan, 900).hitIn, 1100);
    assert.equal(JR.swing(plan, 4000).idle, true);
    const mid = JR.swing(plan, 1500);
    assert.equal(mid.k, 0); assert.ok(Math.abs(mid.theta - Math.PI) < 1e-9);
    const m2 = JR.swing(plan, 3250);
    assert.equal(m2.k, 2); assert.ok(Math.abs(m2.u - 0.5) < 1e-9); assert.equal(m2.swingMs, 500);
    // ease 가 있어도 반 바퀴 지점(u=0.5)은 정점
    assert.ok(Math.abs(JR.swing({ ...plan, ease: 0.6 }, 1500).theta - Math.PI) < 1e-9);
    assert.equal(JR.ropeInFront(Math.PI * 1.5), true); assert.equal(JR.ropeInFront(Math.PI * 0.5), false);
    assert.equal(JR.jumpH(0, 0.5, 250), 1); assert.equal(JR.jumpH(0, 0.5, 600), 0);
    assert.equal(JR.squash(0, 0.5, 0.2, 400), 0); assert.ok(JR.squash(0, 0.5, 0.2, 600) > 0.99);
  } },
];
