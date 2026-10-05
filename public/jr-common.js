// PART 3 줄넘기 — 선생님 화면과 학생 폰이 같이 쓰는 계산 (줄 각도, 점프 높이 등)
// 서버가 보내 준 "줄이 땅을 스치는 시각(hits)"만으로 두 화면이 똑같은 줄 움직임을 그리게 하는 것이 핵심.
// 모든 시각(t)은 서버 시계(ms) 기준 — IQ.makeClock(socket).now() 로 얻음.
window.JR = (() => {
  const TAU = Math.PI * 2;

  // 줄의 한 바퀴: 직전 hit(또는 단계 시작 start) → 이번 hit 까지가 정확히 360°.
  // theta: 0 = 땅(발밑)을 스치는 순간, π = 머리 위 정점. 0→π 구간은 줄이 학생 "뒤쪽"으로 올라가고, π→2π 구간은 "앞쪽"으로 내려옴.
  // plan.ease(0~1): 클수록 정점에서 느려졌다가 땅 근처에서 휙 내려옴 (뜸 들이기)
  function swing(plan, t) {
    const idle = { theta: 0, u: 0, k: -1, idle: true, hitIn: Infinity };
    if (!plan || !plan.hits || !plan.hits.length) return idle;
    const h = plan.hits;
    if (t <= plan.start) return { ...idle, k: -1, hitIn: h[0] - t };
    if (t >= h[h.length - 1]) return { ...idle, k: h.length - 1 };
    let k = 0; while (k < h.length - 1 && t >= h[k]) k++;
    const a = k === 0 ? plan.start : h[k - 1], b = h[k], u = (t - a) / (b - a), e = plan.ease || 0;
    return { theta: TAU * u + e * Math.sin(TAU * u), u, k, idle: false, hitIn: b - t, swingMs: b - a };
  }

  // 줄 모양: s=0..1 (왼쪽 잡은 사람 → 오른쪽 잡은 사람). 가운데는 넓게 평평, 양 끝은 손 높이로 모임
  const shape = (s) => 1 - Math.pow(Math.abs(2 * s - 1), 6);
  // 줄 위 한 점: dy = -1(머리 위 정점) ~ +1(땅), depth <0 이면 학생 뒤, >0 이면 학생 앞
  function ropePoint(theta, s) {
    const sh = shape(s);
    return { dy: sh * Math.cos(theta), depth: -sh * Math.sin(theta), sh };
  }
  // 줄 전체가 지금 학생 앞쪽(카메라 쪽)에 있는지 — 그리는 순서(학생 뒤/앞) 결정용
  const ropeInFront = (theta) => Math.sin(theta) < 0; // π<θ<2π

  // 점프 높이 0..1 (포물선). ts=누른 시각, air=체공(초), t=지금
  function jumpH(ts, air, t) {
    const u = (t - ts) / (air * 1000);
    return u < 0 || u > 1 ? 0 : 4 * u * (1 - u);
  }
  // 착지 후 웅크림 0..1 (rest 초 동안 1→0)
  function squash(ts, air, rest, t) {
    const a = (t - ts - air * 1000) / (rest * 1000);
    return a < 0 || a > 1 ? 0 : Math.sin(a * Math.PI) ;
  }

  // 판정 결과 코드 (서버 jr:hit 의 res 항목 [id, code, out])
  const FAIL = 0, PASS = 1, PERFECT = 2, SHIELD = 3;

  const STAGE_COLORS = ['#7dd3fc', '#4ade80', '#fde047', '#fb923c', '#f472b6', '#c084fc', '#f87171'];
  const stageColor = (n) => STAGE_COLORS[Math.max(0, Math.min(STAGE_COLORS.length - 1, n))];

  return { TAU, swing, shape, ropePoint, ropeInFront, jumpH, squash, FAIL, PASS, PERFECT, SHIELD, stageColor };
})();
