// PART 4 바나나킥 — 서버·선생님 화면·학생 폰이 똑같이 쓰는 계산 (공 궤적, 골키퍼 움직임)
// 브라우저에서는 window.BK, 서버(Node)에서는 require('./public/bk-common.js')
// 모든 시각(t)은 서버 시계(ms). 좌표 x: 골대 입구가 -1 ~ +1, 화면 왼쪽이 -1 (선생님 화면·폰 모두 같은 방향).
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(); else root.BK = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  // ── 골키퍼 ──
  const GW = 0.17;         // 골키퍼 몸+장갑의 절반 폭
  const BR = 0.05;         // 공 반지름
  const REACH = GW + BR;   // |골키퍼 x - 공 x| 가 이 값 이하이면 선방
  const PERFECT = 0.06;    // 정중앙으로 받으면 WOW!
  const V = 1.5;           // 골키퍼 최고 속도 (골대 폭 2.0 을 약 1.3초에 건넘)
  const ACC = 14;          // 가속·감속 (초당 속도 변화) → 버튼을 누르고 떼도 약 0.1초 동안 미끄러짐
  const XMAX = 0.92;       // 골키퍼가 갈 수 있는 끝
  const DT = 10;           // 시뮬레이션 간격(ms) — 서버와 폰이 완전히 같은 값이어야 결과가 일치

  // 상태 st = {t, x, v, dir}, 입력 ev = [{t, dir}] (t 오름차순, dir = -1 왼쪽 / 0 멈춤 / 1 오른쪽).
  // t 시각까지 진행한 새 상태를 돌려줌 (st 는 바꾸지 않음)
  function simulate(st, ev, tEnd) {
    let t = st.t, x = st.x, v = st.v, dir = st.dir, i = 0;
    if (tEnd - t > 30000) t = tEnd - 30000; // 안전장치: 기준 시각이 너무 오래됐으면 건너뜀
    while (i < ev.length && ev[i].t <= t) dir = ev[i++].dir;
    while (t < tEnd) {
      // 걸음은 항상 절대 시각의 DT 배수 경계에 맞춤 → 서버와 폰이 기록을 접는 시점이 달라도 결과가 똑같음
      const step = Math.min((Math.floor(t / DT) + 1) * DT, tEnd) - t;
      while (i < ev.length && ev[i].t <= t) dir = ev[i++].dir;
      const dv = dir * V - v, mx = ACC * step / 1000;
      v += Math.abs(dv) <= mx ? dv : (dv > 0 ? mx : -mx);
      x += v * step / 1000;
      if (x > XMAX) { x = XMAX; if (v > 0) v = 0; } else if (x < -XMAX) { x = -XMAX; if (v < 0) v = 0; }
      t += step;
    }
    return { t, x, v, dir };
  }

  // 한 골키퍼의 입력 기록 + 위치 계산. press(dir, t): 버튼 상태가 바뀐 시각, at(t): 그 시각의 {x,v,dir}
  class Goalie {
    constructor() { this.base = { t: 0, x: 0, v: 0, dir: 0 }; this.ev = []; }
    reset(t) { this.base = { t: t || 0, x: 0, v: 0, dir: 0 }; this.ev = []; }
    press(dir, t) {
      dir = dir < 0 ? -1 : dir > 0 ? 1 : 0;
      const last = this.ev.length ? this.ev[this.ev.length - 1].t : this.base.t;
      if (t < last) t = last;                 // 늦게 온 신호가 순서를 뒤집지 않게
      this.ev.push({ t, dir });
    }
    at(t) { return simulate(this.base, this.ev, t); }
    // 오래된 기록을 접어서 계산량을 일정하게 유지 (keepMs 이전은 확정)
    compact(now, keepMs) {
      const tb = Math.floor((now - (keepMs || 2500)) / DT) * DT;
      if (tb <= this.base.t) return;
      this.base = simulate(this.base, this.ev, tb);
      this.ev = this.ev.filter(e => e.t > tb - DT); // 마지막 한 걸음(DT) 안의 입력은 아직 적용 전이므로 남겨 둠
    }
  }

  // ── 공 ──
  // shot = {id, t0 차는 시각, t1 골대 도착 시각, x0 출발 x, x1 도착 x, A 휘는 정도(부호=방향), dx 막판 꺾임(너클), s 꺾이기 시작하는 비율}
  const sstep = (a) => { a = Math.max(0, Math.min(1, a)); return a * a * (3 - 2 * a); };
  function ballAt(s, t) {
    const u = Math.max(0, Math.min(1, (t - s.t0) / (s.t1 - s.t0)));
    const dx = s.dx || 0, A = s.A || 0, sw = s.s || 0.7;
    // 출발점 → (꺾이기 전 목표) 직선 + 바나나 곡선(중간에 가장 크게 휘고 도착점에서 0) + 막판 꺾임
    const x = s.x0 + (s.x1 - dx - s.x0) * u + A * Math.sin(Math.PI * u) + dx * sstep((u - sw) / (1 - sw));
    return { x, u, h: Math.sin(Math.PI * Math.min(1, u * 1.15)) * (s.lob || 0.35), flying: t >= s.t0 && t <= s.t1 };
  }
  // 도착 시각 t1 에 이 골키퍼 x 로 막을 수 있는가: 0 실점 / 1 선방 / 2 정중앙 선방(WOW)
  function judge(gx, bx) {
    const d = Math.abs(gx - bx);
    return d <= PERFECT ? 2 : d <= REACH ? 1 : 0;
  }

  // 난이도 d(0~1) 에 따른 이름표 (선생님 화면 배너용)
  const LEVELS = [
    { at: 0.0, name: '워밍업' }, { at: 0.2, name: '코너 노리기' }, { at: 0.4, name: '바나나킥!' },
    { at: 0.6, name: '연속 슛' }, { at: 0.8, name: '너클볼 FINAL' },
  ];
  const levelOf = (d) => { let n = 0; for (let i = 0; i < LEVELS.length; i++) if (d >= LEVELS[i].at) n = i; return n; };

  return { GW, BR, REACH, PERFECT, V, ACC, XMAX, DT, simulate, Goalie, ballAt, judge, LEVELS, levelOf };
});
