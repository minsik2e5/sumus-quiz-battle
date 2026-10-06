// PART 4 바나나킥 — 선생님(프로젝터) 화면 그림 모음 (bk-host.html 이 불러 씀) → window.BKART
// 밤 경기장 배경, 네온 골대·그물, 축구공, 골키퍼 스프라이트, 마스코트 슈터 4종(문어·꽃게·바다거북·복어), 응원하는 바다 친구들
// 외부 이미지 없이 캔버스로만 그림. 움직이지 않는 것은 미리 오프스크린 캔버스에 그려 둠(프레임당 비용 최소화).
(function () {
  'use strict';
  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, u) => a + (b - a) * u;
  const sstep = (u) => { u = clamp(u, 0, 1); return u * u * (3 - 2 * u); };
  function mulberry(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  const mk = (w, h) => { const c = document.createElement('canvas'); c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h)); return c; };
  const shade = (hex, k) => IQ.shade(hex, k);
  const rr = (g, x, y, w, h, r) => IQ.roundRect(g, x, y, w, h, r);
  const FONT = "Pretendard, 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif";

  // ═════════ 원근 (L = 화면 배치, bk-host.html 이 계산해서 setLayout) ═════════
  // 깊이 u: 0 = 슈터 발 앞(화면 아래), 1 = 골라인, 1 넘으면 골대 안쪽. z = 1 + (Z-1)u, 화면 크기 ∝ 1/z.
  let L = null;
  const zOf = (u) => 1 + (L.Z - 1) * u;
  const gy = (u) => L.yH + (L.yB - L.yH) / zOf(u);        // 바닥 높이(화면 y)
  const sc = (u) => L.Z / zOf(u);                           // 골라인 = 1
  const latK = (u) => u <= 1 ? 1 + L.LAT * Math.pow(1 - u, 1.5) : sc(u);
  const px = (X, u) => L.GX + X * L.GWp * sc(u);            // 바닥 선(진짜 원근)
  const bxs = (X, u) => L.GX + X * L.GWp * latK(u);         // 공 가로 위치(가까운 쪽은 덜 벌려서 화면 안에)
  const gp = (X, u, h) => [L.GX + X * L.GWp * sc(u), gy(u) - h * L.GHp * sc(u)]; // 골대 3D 점 (h: 크로스바 높이 = 1)
  function setLayout(l) { L = l; NET = null; }

  // ═════════ 배경 (정적) ═════════
  function palm(g, x, y, h, lean, R) {
    const tx = x + lean * h * 0.22, ty = y - h;
    g.strokeStyle = '#0a2a26'; g.lineWidth = h * 0.06; g.lineCap = 'round';
    g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x, y - h * 0.6, tx, ty); g.stroke();
    g.strokeStyle = 'rgba(90,230,255,.22)'; g.lineWidth = h * 0.015; g.beginPath(); g.moveTo(x - lean * h * 0.025, y); g.quadraticCurveTo(x - lean * h * 0.025, y - h * 0.6, tx - lean * h * 0.02, ty); g.stroke();
    for (let i = 0; i < 8; i++) {
      const a = -Math.PI / 2 + (i - 3.5) * 0.5 + (R() - 0.5) * 0.15, len = h * (0.42 + R() * 0.12);
      g.fillStyle = i % 2 ? '#0c3a2c' : '#0f4a35';
      g.beginPath(); g.moveTo(tx, ty);
      g.quadraticCurveTo(tx + Math.cos(a) * len * 0.6, ty + Math.sin(a) * len * 0.6 - len * 0.2, tx + Math.cos(a) * len, ty + Math.sin(a) * len * 0.5 + len * 0.35);
      g.quadraticCurveTo(tx + Math.cos(a) * len * 0.4, ty + Math.sin(a) * len * 0.3, tx, ty); g.fill();
    }
    g.fillStyle = '#3a2a1a'; for (const [dx, dy] of [[-0.03, 0.02], [0.02, 0.03], [0, -0.01]]) { g.beginPath(); g.arc(tx + dx * h, ty + dy * h + h * 0.02, h * 0.025, 0, TAU); g.fill(); }
  }
  function buildBg(DPR) {
    const W = L.W, H = L.H, M = L.M, full = W + 2 * M, x0 = -M, x1 = W + M;
    const c = mk(full * DPR, H * DPR), g = c.getContext('2d');
    g.setTransform(DPR, 0, 0, DPR, M * DPR, 0);
    const R = mulberry(20261007);
    // 밤하늘
    let gr = g.createLinearGradient(0, 0, 0, L.boardBot);
    gr.addColorStop(0, '#02060f'); gr.addColorStop(0.5, '#061633'); gr.addColorStop(1, '#0d3155');
    g.fillStyle = gr; g.fillRect(x0, 0, full, L.boardBot + 1);
    for (let i = 0; i < 170; i++) { const x = x0 + R() * full, y = R() * L.standTop * 0.9; g.fillStyle = `rgba(215,232,255,${0.2 + R() * 0.7})`; g.beginPath(); g.arc(x, y, (0.4 + R() * 1.1) * Math.max(1, W / 1600), 0, TAU); g.fill(); }
    // 달
    { const mx = L.GX - L.GWp * 0.5, my = Math.max(H * 0.045, L.standTop * 0.42), mr = H * 0.03;
      const mg = g.createRadialGradient(mx, my, mr * 0.8, mx, my, mr * 4); mg.addColorStop(0, 'rgba(200,230,255,.25)'); mg.addColorStop(1, 'rgba(200,230,255,0)');
      g.fillStyle = mg; g.fillRect(mx - mr * 4, my - mr * 4, mr * 8, mr * 8);
      g.fillStyle = '#f4f1dc'; g.beginPath(); g.arc(mx, my, mr, 0, TAU); g.fill();
      g.fillStyle = 'rgba(170,160,130,.35)'; for (const [a, b, r] of [[-0.3, -0.2, 0.22], [0.25, 0.15, 0.18], [-0.05, 0.4, 0.12]]) { g.beginPath(); g.arc(mx + a * mr, my + b * mr, r * mr, 0, TAU); g.fill(); } }
    // 관중석 (가운데가 낮고 양옆이 높은 그릇 모양)
    const sTop = (x) => L.standTop - Math.pow(Math.abs(x - L.GX) / (W * 0.62), 2) * H * 0.08;
    const edge = (f, k) => { for (let x = x0; x <= x1 + 20; x += 20) { const y = f(x); x === x0 ? g.moveTo(x, y) : g.lineTo(x, y); } };
    g.fillStyle = '#030a16'; g.beginPath(); edge((x) => sTop(x) - H * 0.035); for (let x = x1 + 20; x >= x0; x -= 20) g.lineTo(x, sTop(x)); g.closePath(); g.fill();
    for (let x = x0 + 6; x < x1; x += W * 0.022) { g.fillStyle = 'rgba(190,240,255,.8)'; g.beginPath(); g.arc(x, sTop(x) - H * 0.013, Math.max(1.2, H * 0.0024), 0, TAU); g.fill(); }
    gr = g.createLinearGradient(0, L.standTop - H * 0.08, 0, L.boardTop);
    gr.addColorStop(0, '#0a1b35'); gr.addColorStop(1, '#16395f');
    g.fillStyle = gr; g.beginPath(); edge(sTop); g.lineTo(x1 + 20, L.boardTop); g.lineTo(x0, L.boardTop); g.closePath(); g.fill();
    const CROWD = ['#e86a6a', '#f2c14e', '#5fb3ff', '#7ee0a0', '#c79bff', '#ff9f5a', '#f5f5f5', '#ff7ab6', '#4fe3ff'];
    const tiers = 8;
    for (let i = 0; i < tiers; i++) {
      const k = i / tiers;
      g.strokeStyle = 'rgba(120,190,255,.13)'; g.lineWidth = 1; g.beginPath(); edge((x) => lerp(sTop(x), L.boardTop, k)); g.stroke();
      const k2 = (i + 0.6) / tiers, dr = Math.max(1.3, H * 0.0042 * (0.7 + k2 * 0.7));
      for (let x = x0 + R() * 8; x < x1; x += dr * (2.1 + R() * 1.9)) {
        const y = lerp(sTop(x), L.boardTop, k2) + (R() - 0.5) * dr;
        g.fillStyle = CROWD[(R() * CROWD.length) | 0]; g.globalAlpha = 0.28 + R() * 0.35;
        g.beginPath(); g.arc(x, y - dr * 0.7, dr * 0.68, 0, TAU); g.fill(); g.fillRect(x - dr * 0.75, y, dr * 1.5, dr * 1.1);
      }
      g.globalAlpha = 1;
    }
    // 조명탑
    for (const side of [-1, 1]) {
      const tx = L.GX + side * W * 0.455, ty = Math.max(H * 0.13, L.standTop - H * 0.01), pw = W * 0.06, ph = H * 0.048;
      g.strokeStyle = '#0d1a2e'; g.lineWidth = Math.max(3, W * 0.004); g.beginPath(); g.moveTo(tx, L.boardTop); g.lineTo(tx, ty); g.stroke();
      g.lineWidth = 1; g.strokeStyle = 'rgba(40,70,110,.8)';
      for (let y = ty + ph; y < L.boardTop; y += H * 0.025) { g.beginPath(); g.moveTo(tx - W * 0.004, y); g.lineTo(tx + W * 0.004, y + H * 0.012); g.stroke(); }
      g.save(); g.globalCompositeOperation = 'lighter';
      const lg = g.createRadialGradient(tx, ty, 0, tx, ty, W * 0.17); lg.addColorStop(0, 'rgba(210,240,255,.5)'); lg.addColorStop(0.2, 'rgba(140,200,255,.13)'); lg.addColorStop(1, 'rgba(120,180,255,0)');
      g.fillStyle = lg; g.fillRect(tx - W * 0.17, ty - W * 0.17, W * 0.34, W * 0.34);
      const bg2 = g.createLinearGradient(tx, ty, L.GX - side * W * 0.1, L.yB); bg2.addColorStop(0, 'rgba(190,230,255,.12)'); bg2.addColorStop(1, 'rgba(190,230,255,0)');
      g.fillStyle = bg2; g.beginPath(); g.moveTo(tx - pw * 0.3, ty); g.lineTo(tx + pw * 0.3, ty); g.lineTo(L.GX - side * L.GWp * 0.2, L.yB); g.lineTo(L.GX - side * L.GWp * 1.4, L.yB); g.closePath(); g.fill();
      g.restore();
      g.fillStyle = '#0b1628'; rr(g, tx - pw / 2, ty - ph / 2, pw, ph, 4); g.fill();
      for (let i = 0; i < 5; i++) for (let j = 0; j < 2; j++) {
        const lx = tx - pw * 0.4 + i * pw * 0.2, ly = ty - ph * 0.22 + j * ph * 0.44;
        g.fillStyle = '#eaf8ff'; g.beginPath(); g.arc(lx, ly, ph * 0.17, 0, TAU); g.fill();
      }
    }
    // LED 광고판
    { const bh = L.boardBot - L.boardTop;
      g.fillStyle = '#040b17'; g.fillRect(x0, L.boardTop, full, bh);
      const msgs = [['SUMUS ISLAND', '#4fe3ff'], ['바나나킥 SOCCER', '#ffe14d'], ['PART 4', '#ff5fa2'], ['GOALKEEPER CUP', '#7dff9a']];
      const pw = Math.max(160, W * 0.19); let i = 0;
      g.font = `900 ${bh * 0.56}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
      for (let x = L.GX - pw * 0.5 - pw * Math.ceil((L.GX - x0) / pw); x < x1; x += pw, i++) {
        const [txt, col] = msgs[((i % 4) + 4) % 4];
        g.fillStyle = '#081a33'; g.fillRect(x + 2, L.boardTop + 2, pw - 4, bh - 4);
        g.save(); g.shadowColor = col; g.shadowBlur = bh * 0.5; g.fillStyle = col; g.fillText(txt, x + pw / 2, L.boardTop + bh * 0.54); g.restore();
      }
      g.fillStyle = 'rgba(120,220,255,.35)'; g.fillRect(x0, L.boardTop, full, 1.5); }
    // 잔디
    gr = g.createLinearGradient(0, L.boardBot, 0, H); gr.addColorStop(0, '#08302f'); gr.addColorStop(0.35, '#0c4441'); gr.addColorStop(1, '#0f5a4c');
    g.fillStyle = gr; g.fillRect(x0, L.boardBot, full, H - L.boardBot);
    { const uMin = -((L.yB - L.yH) / (H - L.yH) - 1) / (L.Z - 1) - 0.02; let k = 0;
      for (let u = 2.4; u > uMin; u -= 0.16, k++) if (k % 2) { const ya = gy(u), yb = Math.min(H, gy(Math.max(uMin, u - 0.16))); g.fillStyle = 'rgba(150,255,220,.04)'; g.fillRect(x0, ya, full, yb - ya); } }
    // 골대 앞 네온 빛
    g.save(); g.globalCompositeOperation = 'lighter';
    { const ry = (gy(0.6) - L.yG) * 1.1, rx = L.GWp * 1.6; g.translate(L.GX, L.yG); g.scale(1, ry / rx);
      const pg = g.createRadialGradient(0, 0, 0, 0, 0, rx); pg.addColorStop(0, 'rgba(60,210,255,.16)'); pg.addColorStop(1, 'rgba(60,210,255,0)');
      g.fillStyle = pg; g.beginPath(); g.arc(0, 0, rx, 0, TAU); g.fill(); }
    g.restore();
    // 흰 선
    const LW = Math.max(1.3, L.GWp * 0.006), d = LW / L.GWp / 2;
    g.fillStyle = 'rgba(230,250,255,.8)';
    const hline = (Xa, Xb, u) => { const y = gy(u), w = LW * sc(u); g.fillRect(px(Xa, u), y - w / 2, px(Xb, u) - px(Xa, u), w); };
    const vline = (X, ua, ub) => { g.beginPath(); g.moveTo(px(X - d, ua), gy(ua)); g.lineTo(px(X + d, ua), gy(ua)); g.lineTo(px(X + d, ub), gy(ub)); g.lineTo(px(X - d, ub), gy(ub)); g.closePath(); g.fill(); };
    hline(-30, 30, 1);
    vline(-2.5, 0.775, 1); vline(2.5, 0.775, 1); hline(-2.5, 2.5, 0.775);
    vline(-5.5, 0.325, 1); vline(5.5, 0.325, 1); hline(-5.5, 5.5, 0.325);
    { const u = 0.55, r = LW * 1.6 * sc(u); g.beginPath(); g.ellipse(L.GX, gy(u), r * 1.4, r * 0.55, 0, 0, TAU); g.fill(); }
    g.strokeStyle = 'rgba(230,250,255,.8)'; g.lineCap = 'butt';
    { let prev = null; for (let i = 0; i <= 60; i++) { const a = i / 60 * Math.PI, X = 2.5 * Math.cos(a), u = 0.55 - 0.375 * Math.sin(a);
        if (u < 0.325 && prev) { g.lineWidth = LW * sc(u); g.beginPath(); g.moveTo(prev[0], prev[1]); g.lineTo(px(X, u), gy(u)); g.stroke(); }
        prev = u < 0.325 ? [px(X, u), gy(u)] : null; } }
    // 야자수
    const pr = mulberry(99);
    for (const [xx, hh, lean] of [[x0 + M * 0.35, 0.5, 1], [W * 0.015, 0.42, 1], [W * 0.985, 0.44, -1], [x1 - M * 0.35, 0.52, -1]]) palm(g, xx, L.boardBot + H * 0.02, H * hh, lean, pr);
    // 아래쪽 어둡게 (슈터가 돋보이게)
    gr = g.createLinearGradient(0, H * 0.78, 0, H); gr.addColorStop(0, 'rgba(0,10,20,0)'); gr.addColorStop(1, 'rgba(0,10,20,.35)');
    g.fillStyle = gr; g.fillRect(x0, H * 0.78, full, H * 0.22);
    return c;
  }

  // ═════════ 그물 (출렁임) ═════════
  let NET = null;
  function netGeom() {
    const uB = L.uB, hb = L.hb, lines = [];
    const seg = (a, b, n) => { const o = []; for (let i = 0; i <= n; i++) { const k = i / n; o.push([lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)]); } return o; };
    for (let i = 0; i <= 16; i++) { const X = -1 + i / 8; lines.push(seg([X, uB, 0], [X, uB, hb], 8)); lines.push(seg([X, 1, 1], [X, uB, hb], 6)); }
    for (let j = 1; j <= 6; j++) { const h = hb * j / 6.4; lines.push(seg([-1, uB, h], [1, uB, h], 16)); }
    for (let j = 1; j <= 3; j++) { const k = j / 4; lines.push(seg([-1, lerp(1, uB, k), lerp(1, hb, k)], [1, lerp(1, uB, k), lerp(1, hb, k)], 16)); }
    for (const s of [-1, 1]) {
      for (let j = 1; j <= 4; j++) { const k = j / 5; lines.push(seg([s, lerp(1, uB, k), 0], [s, lerp(1, uB, k), lerp(1, hb, k)], 6)); }
      for (let j = 1; j <= 5; j++) { const k = j / 6; lines.push(seg([s, 1, k], [s, uB, hb * k], 6)); }
    }
    return lines;
  }
  // ripples = [{X, h, t0, amp}] (t0 = performance.now ms)
  function drawNet(g, ripples, pn) {
    if (!NET) NET = netGeom();
    const uB = L.uB, hb = L.hb;
    const act = [];
    if (ripples) for (const r of ripples) { const age = (pn - r.t0) / 1000; if (age >= 0 && age < 1.3) { const c = gp(r.X, uB, r.h); act.push([c[0], c[1], age, r.amp]); } }
    const P = (X, u, h) => {
      const p = gp(X, u, h);
      for (const [cx, cy, age, amp] of act) {
        const dx = p[0] - cx, dy = p[1] - cy, dd = Math.hypot(dx, dy) || 1, R0 = L.GWp * 0.32;
        const w = amp * Math.sin(dd / R0 * 6 - age * 20) * Math.exp(-dd / R0) * Math.exp(-age * 3.2) * Math.min(1, age * 12);
        p[0] += dx / dd * w; p[1] += dy / dd * w * 0.8;
      }
      return p;
    };
    const quad = (a, b, c2, d, fill) => { g.fillStyle = fill; g.beginPath(); g.moveTo(...P(...a)); g.lineTo(...P(...b)); g.lineTo(...P(...c2)); g.lineTo(...P(...d)); g.closePath(); g.fill(); };
    quad([-1, uB, 0], [1, uB, 0], [1, uB, hb], [-1, uB, hb], 'rgba(1,8,20,.62)');
    quad([-1, 1, 1], [1, 1, 1], [1, uB, hb], [-1, uB, hb], 'rgba(1,8,20,.42)');
    for (const s of [-1, 1]) quad([s, 1, 0], [s, uB, 0], [s, uB, hb], [s, 1, 1], 'rgba(1,8,20,.36)');
    g.strokeStyle = 'rgba(200,240,255,.3)'; g.lineWidth = Math.max(1, L.GWp * 0.0022); g.lineJoin = 'round';
    g.beginPath();
    for (const ln of NET) { for (let i = 0; i < ln.length; i++) { const p = P(ln[i][0], ln[i][1], ln[i][2]); i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]); } }
    g.stroke();
    // 뒤쪽 받침대
    g.strokeStyle = 'rgba(150,200,235,.55)'; g.lineWidth = Math.max(1.5, L.GWp * 0.006); g.beginPath();
    for (const [a, b] of [[[-1, uB, 0], [1, uB, 0]], [[-1, 1, 0], [-1, uB, 0]], [[1, 1, 0], [1, uB, 0]], [[-1, uB, 0], [-1, uB, hb]], [[1, uB, 0], [1, uB, hb]], [[-1, uB, hb], [1, uB, hb]], [[-1, 1, 1], [-1, uB, hb]], [[1, 1, 1], [1, uB, hb]]]) { g.moveTo(...P(...a)); g.lineTo(...P(...b)); }
    g.stroke();
  }
  function netBox() { const pad = L.GWp * 0.12; return { x: L.GX - L.GWp - pad, y: L.yG - L.GHp - pad, w: L.GWp * 2 + pad * 2, h: L.GHp + pad * 2 }; }
  function buildNet(DPR) {
    const b = netBox(), c = mk(b.w * DPR, b.h * DPR), g = c.getContext('2d');
    g.setTransform(DPR, 0, 0, DPR, -b.x * DPR, -b.y * DPR); drawNet(g, null, 0);
    return { c, x: b.x, y: b.y, w: b.w, h: b.h };
  }
  // 네온 골대 (앞쪽 기둥 + 크로스바)
  function buildFrame(DPR) {
    const pt = Math.max(3, L.GWp * 0.022), pad = pt * 6;
    const x = L.GX - L.GWp - pad, y = L.yG - L.GHp - pad, w = L.GWp * 2 + pad * 2, h = L.GHp + pad * 2;
    const c = mk(w * DPR, h * DPR), g = c.getContext('2d');
    g.setTransform(DPR, 0, 0, DPR, -x * DPR, -y * DPR);
    const path = () => { g.beginPath(); g.moveTo(L.GX - L.GWp, L.yG); g.lineTo(L.GX - L.GWp, L.yG - L.GHp); g.lineTo(L.GX + L.GWp, L.yG - L.GHp); g.lineTo(L.GX + L.GWp, L.yG); };
    g.lineCap = 'round'; g.lineJoin = 'round';
    g.save(); g.shadowColor = '#25d4ff'; g.shadowBlur = pt * 5; g.strokeStyle = 'rgba(40,190,255,.6)'; g.lineWidth = pt * 2.4; path(); g.stroke(); g.restore();
    g.save(); g.shadowColor = '#7febff'; g.shadowBlur = pt * 2; g.strokeStyle = '#71e6ff'; g.lineWidth = pt * 1.3; path(); g.stroke(); g.restore();
    g.strokeStyle = '#f2fdff'; g.lineWidth = pt * 0.55; path(); g.stroke();
    // 기둥 밑 바닥 빛
    for (const s of [-1, 1]) { const gx = L.GX + s * L.GWp, rg = g.createRadialGradient(gx, L.yG, 0, gx, L.yG, pt * 5); rg.addColorStop(0, 'rgba(120,230,255,.6)'); rg.addColorStop(1, 'rgba(120,230,255,0)'); g.fillStyle = rg; g.beginPath(); g.ellipse(gx, L.yG, pt * 5, pt * 1.6, 0, 0, TAU); g.fill(); }
    return { c, x, y, w, h };
  }

  // ═════════ 공 ═════════
  function buildBall() {
    const S = 128, c = mk(S, S), g = c.getContext('2d'), R = S / 2 - 2;
    g.translate(S / 2, S / 2);
    g.fillStyle = '#f7f9fc'; g.beginPath(); g.arc(0, 0, R, 0, TAU); g.fill();
    g.save(); g.beginPath(); g.arc(0, 0, R, 0, TAU); g.clip();
    const pent = (x, y, r, a) => { g.beginPath(); for (let i = 0; i < 5; i++) { const b = a + i * TAU / 5; g.lineTo(x + Math.cos(b) * r, y + Math.sin(b) * r); } g.closePath(); g.fill(); };
    g.fillStyle = '#1b2433'; pent(0, 0, R * 0.3, -Math.PI / 2);
    g.strokeStyle = 'rgba(40,50,70,.6)'; g.lineWidth = R * 0.04;
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + i * TAU / 5, b = a + Math.PI / 5;
      g.beginPath(); g.moveTo(Math.cos(a) * R * 0.3, Math.sin(a) * R * 0.3); g.lineTo(Math.cos(a) * R * 0.62, Math.sin(a) * R * 0.62); g.stroke();
      pent(Math.cos(b) * R * 0.92, Math.sin(b) * R * 0.92, R * 0.3, b);
    }
    g.restore();
    const sh = mk(S, S), q = sh.getContext('2d'); q.translate(S / 2, S / 2);
    let gr = q.createRadialGradient(-R * 0.35, -R * 0.4, R * 0.05, 0, 0, R);
    gr.addColorStop(0, 'rgba(255,255,255,.55)'); gr.addColorStop(0.35, 'rgba(255,255,255,0)'); gr.addColorStop(0.75, 'rgba(10,30,60,.12)'); gr.addColorStop(1, 'rgba(10,30,60,.5)');
    q.fillStyle = gr; q.beginPath(); q.arc(0, 0, R, 0, TAU); q.fill();
    q.strokeStyle = 'rgba(10,20,40,.55)'; q.lineWidth = R * 0.05; q.beginPath(); q.arc(0, 0, R - R * 0.025, 0, TAU); q.stroke();
    const shd = mk(64, 64), w = shd.getContext('2d');
    gr = w.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(0,12,20,.55)'); gr.addColorStop(0.6, 'rgba(0,12,20,.25)'); gr.addColorStop(1, 'rgba(0,12,20,0)');
    w.fillStyle = gr; w.fillRect(0, 0, 64, 64);
    return { ball: c, shade: sh, shadow: shd };
  }

  // ═════════ 공용 작은 그림 ═════════
  function star(g, x, y, r, c) { g.fillStyle = c; g.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, q = i % 2 ? r * 0.45 : r; g.lineTo(x + Math.cos(a) * q, y + Math.sin(a) * q); } g.closePath(); g.fill(); }
  function crown(g, x, y, s) {
    g.fillStyle = '#f2c14e'; g.strokeStyle = '#8a5a00'; g.lineWidth = Math.max(1, s * 0.06);
    g.beginPath(); g.moveTo(x - s * 0.5, y + s * 0.22); g.lineTo(x - s * 0.55, y - s * 0.25); g.lineTo(x - s * 0.25, y); g.lineTo(x, y - s * 0.38); g.lineTo(x + s * 0.25, y); g.lineTo(x + s * 0.55, y - s * 0.25); g.lineTo(x + s * 0.5, y + s * 0.22); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = '#ff4d6d'; g.beginPath(); g.arc(x, y + s * 0.06, s * 0.08, 0, TAU); g.fill();
  }
  function textSprite(text, fill, stroke, fs, DPR) {
    const t = mk(1, 1).getContext('2d'); t.font = `900 ${fs}px ${FONT}`;
    const w = t.measureText(text).width + fs * 0.6, h = fs * 1.35;
    const c = mk(w * DPR, h * DPR), g = c.getContext('2d'); g.scale(DPR, DPR);
    g.font = `900 ${fs}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
    g.lineWidth = fs * 0.2; g.strokeStyle = stroke; g.strokeText(text, w / 2, h / 2 + fs * 0.04);
    g.fillStyle = fill; g.fillText(text, w / 2, h / 2 + fs * 0.04);
    return { c, w, h };
  }
  function taper(g, pts, w0, w1, fill, stroke, lw) {
    const n = pts.length / 2, A = [], B = [];
    for (let i = 0; i < n; i++) {
      const a = Math.max(0, i - 1), b = Math.min(n - 1, i + 1), dx = pts[b * 2] - pts[a * 2], dy = pts[b * 2 + 1] - pts[a * 2 + 1], d = Math.hypot(dx, dy) || 1;
      const w = lerp(w0, w1, i / (n - 1)) / 2, nx = -dy / d * w, ny = dx / d * w;
      A.push(pts[i * 2] + nx, pts[i * 2 + 1] + ny); B.push(pts[i * 2] - nx, pts[i * 2 + 1] - ny);
    }
    g.beginPath(); g.moveTo(A[0], A[1]); for (let i = 1; i < n; i++) g.lineTo(A[i * 2], A[i * 2 + 1]);
    g.arc(pts[(n - 1) * 2], pts[(n - 1) * 2 + 1], w1 / 2, 0, TAU);
    for (let i = n - 1; i >= 0; i--) g.lineTo(B[i * 2], B[i * 2 + 1]);
    g.closePath(); g.fillStyle = fill; g.fill(); if (stroke) { g.strokeStyle = stroke; g.lineWidth = lw; g.stroke(); }
  }
  function bez(x0, y0, x1, y1, x2, y2, x3, y3, n) { const o = []; for (let i = 0; i <= n; i++) { const u = i / n, v = 1 - u; o.push(v * v * v * x0 + 3 * v * v * u * x1 + 3 * v * u * u * x2 + u * u * u * x3, v * v * v * y0 + 3 * v * v * u * y1 + 3 * v * u * u * y2 + u * u * u * y3); } return o; }

  // ═════════ 골키퍼 (학생 캐릭터, 정면, 팔 벌리고 장갑) ═════════
  // 스프라이트 = 윗몸(반바지·몸통·팔·장갑·머리). 다리는 매 프레임 따로(종종걸음). 원점 = 발, 단위 s.
  const HAIR = ['#2a1b12', '#4a2e1b', '#16161d', '#7b4a22', '#3b2a4a'];
  const OL = 'rgba(30,20,20,.6)';
  const GL_POS = { ready: [0.98, -1.3], yay: [0.6, -2.26], sad: [0.58, -0.6] };
  function glove(g, x, y, k, pose) {
    g.save(); g.translate(x, y); g.rotate(pose === 'yay' ? k * 0.2 : pose === 'sad' ? k * 2.9 : k * 0.55);
    g.fillStyle = '#16233a'; rr(g, -0.14, 0.07, 0.28, 0.13, 0.05); g.fill();
    g.fillStyle = '#c8ff3c'; g.strokeStyle = 'rgba(20,40,10,.75)'; g.lineWidth = 0.05;
    g.beginPath(); g.ellipse(0, -0.06, 0.2, 0.21, 0, 0, TAU); g.fill(); g.stroke();
    g.fillStyle = '#c8ff3c'; g.beginPath(); g.ellipse(-k * 0.18, 0.03, 0.075, 0.11, -k * 0.6, 0, TAU); g.fill(); g.stroke();
    g.strokeStyle = 'rgba(40,90,20,.55)'; g.lineWidth = 0.035;
    for (const fx of [-0.07, 0, 0.07]) { g.beginPath(); g.moveTo(fx, -0.23); g.lineTo(fx, -0.09); g.stroke(); }
    g.fillStyle = 'rgba(255,255,255,.55)'; g.beginPath(); g.ellipse(0.05, -0.15, 0.06, 0.035, -0.5, 0, TAU); g.fill();
    g.restore();
  }
  function goalieSprite(color, seed, pose, s, DPR) {
    const X0 = 1.42, Y0 = 2.66, Y1 = 0.26, w = 2 * X0 * s, h = (Y0 - Y1) * s;
    const c = mk(w * DPR, h * DPR), g = c.getContext('2d');
    g.setTransform(DPR * s, 0, 0, DPR * s, X0 * s * DPR, Y0 * s * DPR);
    g.lineJoin = 'round'; g.lineCap = 'round';
    const style = seed % 4, hair = HAIR[(seed >>> 3) % HAIR.length], gl = GL_POS[pose] || GL_POS.ready;
    // 팔 (몸 뒤)
    for (const k of [-1, 1]) {
      const sx = k * 0.36, sy = -1.02, ex = k * gl[0], ey = gl[1];
      const mx = (sx + ex) / 2 + k * (pose === 'ready' ? 0.02 : 0.12), my = (sy + ey) / 2 + (pose === 'ready' ? 0.13 : 0);
      g.strokeStyle = OL; g.lineWidth = 0.27; g.beginPath(); g.moveTo(sx, sy); g.quadraticCurveTo(mx, my, ex, ey); g.stroke();
      g.strokeStyle = shade(color, -0.12); g.lineWidth = 0.19; g.stroke();
    }
    // 반바지
    g.fillStyle = '#1d2a44'; g.strokeStyle = OL; g.lineWidth = 0.06; rr(g, -0.39, -0.56, 0.78, 0.27, 0.09); g.fill(); g.stroke();
    // 유니폼
    const bg = g.createLinearGradient(-0.4, -1.22, 0.4, -0.4); bg.addColorStop(0, shade(color, 0.3)); bg.addColorStop(1, shade(color, -0.15));
    g.fillStyle = bg; rr(g, -0.44, -1.22, 0.88, 0.8, 0.28); g.fill(); g.stroke();
    g.strokeStyle = 'rgba(255,255,255,.3)'; g.lineWidth = 0.08;
    for (const yy of [-0.86, -0.67]) { g.beginPath(); g.moveTo(-0.33, yy - 0.1); g.lineTo(0, yy + 0.04); g.lineTo(0.33, yy - 0.1); g.stroke(); }
    g.fillStyle = '#ffffff'; g.beginPath(); g.moveTo(-0.17, -1.2); g.lineTo(0, -1.05); g.lineTo(0.17, -1.2); g.closePath(); g.fill();
    for (const k of [-1, 1]) glove(g, k * gl[0], gl[1], k, pose);
    // 머리 (IQ.drawChar 스타일)
    const hx = 0, hy = -1.7 + (pose === 'sad' ? 0.06 : 0), hr = 0.58, face = 1;
    g.strokeStyle = OL; g.lineWidth = 0.06;
    if (style === 2) { g.fillStyle = hair; g.beginPath(); g.ellipse(hx - hr * 0.78, hy + hr * 0.25, hr * 0.3, hr * 0.5, -0.3, 0, TAU); g.fill(); g.beginPath(); g.ellipse(hx + hr * 0.78, hy + hr * 0.25, hr * 0.3, hr * 0.5, 0.3, 0, TAU); g.fill(); }
    const hg = g.createRadialGradient(hx - hr * 0.3, hy - hr * 0.3, hr * 0.1, hx, hy, hr); hg.addColorStop(0, '#ffe8d2'); hg.addColorStop(1, '#f6c9a2');
    g.fillStyle = hg; g.beginPath(); g.arc(hx, hy, hr, 0, TAU); g.fill(); g.stroke();
    g.fillStyle = style === 3 ? shade(color, -0.25) : hair; g.beginPath();
    if (style === 1) {
      g.moveTo(hx - hr * 1.02, hy - hr * 0.05);
      for (let k = 0; k <= 6; k++) { const a = Math.PI + k / 6 * Math.PI, q = k % 2 ? hr * 1.28 : hr * 1.02; g.lineTo(hx + Math.cos(a) * q, hy + Math.sin(a) * q * 0.95 - hr * 0.05); }
      g.quadraticCurveTo(hx, hy - hr * 0.35, hx - hr * 1.02, hy - hr * 0.05);
    } else if (style === 3) {
      g.arc(hx, hy - hr * 0.08, hr * 1.04, Math.PI * 1.02, Math.PI * 1.98); g.closePath(); g.fill(); g.stroke();
      g.beginPath(); g.ellipse(hx, hy - hr * 0.12, hr * 0.75, hr * 0.15, 0, 0, TAU);
    } else {
      g.arc(hx, hy - hr * 0.05, hr * 1.06, Math.PI * 0.98, Math.PI * 2.02);
      g.quadraticCurveTo(hx + face * hr * 0.4, hy - hr * 0.2, hx - face * hr * 0.1, hy - hr * 0.42);
      g.quadraticCurveTo(hx - face * hr * 0.6, hy - hr * 0.1, hx - hr * 1.04, hy + hr * 0.15);
    }
    g.closePath(); g.fill(); g.stroke();
    // 얼굴
    for (const k of [-1, 1]) {
      const ex = hx + k * hr * 0.3, ey = hy + hr * 0.18;
      g.fillStyle = '#1d1d24'; g.strokeStyle = '#1d1d24';
      if (pose === 'yay') { g.lineWidth = 0.065; g.beginPath(); g.arc(ex, ey + 0.05, 0.08, Math.PI * 1.1, Math.PI * 1.9); g.stroke(); continue; }
      g.beginPath(); g.ellipse(ex, ey + (pose === 'sad' ? 0.03 : 0), hr * 0.11, hr * 0.16, 0, 0, TAU); g.fill();
      g.fillStyle = '#fff'; g.beginPath(); g.arc(ex + hr * 0.04, ey - hr * 0.06, hr * 0.045, 0, TAU); g.fill();
      g.strokeStyle = '#3a2418'; g.lineWidth = 0.05; g.beginPath();
      if (pose === 'sad') { g.moveTo(ex - k * hr * 0.17, ey - hr * 0.36); g.lineTo(ex + k * hr * 0.15, ey - hr * 0.28); }
      else { g.moveTo(ex + k * hr * 0.17, ey - hr * 0.36); g.lineTo(ex - k * hr * 0.13, ey - hr * 0.28); }
      g.stroke();
    }
    g.fillStyle = 'rgba(255,110,120,.38)'; for (const k of [-1, 1]) { g.beginPath(); g.ellipse(hx + k * hr * 0.55, hy + hr * 0.45, hr * 0.14, hr * 0.08, 0, 0, TAU); g.fill(); }
    g.strokeStyle = '#7a3b2a'; g.lineWidth = 0.05;
    if (pose === 'yay') { g.fillStyle = '#7a3b2a'; g.beginPath(); g.arc(hx, hy + hr * 0.4, hr * 0.2, 0, Math.PI); g.closePath(); g.fill(); g.fillStyle = '#ff8a8a'; g.beginPath(); g.arc(hx, hy + hr * 0.52, hr * 0.08, 0, Math.PI); g.fill(); }
    else if (pose === 'sad') { g.beginPath(); g.arc(hx, hy + hr * 0.6, hr * 0.14, 1.15 * Math.PI, 1.85 * Math.PI); g.stroke(); g.fillStyle = '#8fd8ff'; g.beginPath(); g.ellipse(hx + hr * 0.33, hy + hr * 0.42, hr * 0.06, hr * 0.1, 0, 0, TAU); g.fill(); }
    else { g.beginPath(); g.arc(hx, hy + hr * 0.4, hr * 0.13, 0.2 * Math.PI, 0.8 * Math.PI); g.stroke(); }
    return { c, ox: X0 * s, oy: Y0 * s, w, h };
  }

  // ═════════ 마스코트 슈터 ═════════
  // o = {sx(돌아서기 0..1), mir(±1 좌우반전), back(뒤 모습), mood('idle'|'focus'|'happy'|'sad'), boot:[x,y](화면 좌표, 차는 발), lean, puff(0..1 복어 부풀기), hop}
  function eyeF(g, x, y, r, mood, look) {
    if (mood === 'happy') { g.strokeStyle = '#2a1830'; g.lineWidth = r * 0.3; g.lineCap = 'round'; g.beginPath(); g.arc(x, y + r * 0.35, r * 0.65, Math.PI * 1.15, Math.PI * 1.85); g.stroke(); return; }
    g.fillStyle = '#fff'; g.beginPath(); g.ellipse(x, y, r, r * 1.1, 0, 0, TAU); g.fill();
    g.strokeStyle = 'rgba(60,20,30,.35)'; g.lineWidth = r * 0.08; g.stroke();
    const qx = x + (look || 0) * r * 0.35, qy = y + (mood === 'sad' ? r * 0.3 : r * 0.08);
    g.fillStyle = '#1b1b24'; g.beginPath(); g.ellipse(qx, qy, r * 0.5, r * 0.58, 0, 0, TAU); g.fill();
    g.fillStyle = '#fff'; g.beginPath(); g.arc(qx + r * 0.17, qy - r * 0.2, r * 0.17, 0, TAU); g.fill();
  }
  function brow(g, x, y, r, mood, k, col) { // k: -1 왼눈, 1 오른눈
    if (mood !== 'focus' && mood !== 'sad') return;
    const io = -k; g.strokeStyle = col; g.lineWidth = r * 0.24; g.lineCap = 'round'; g.beginPath();
    if (mood === 'focus') { g.moveTo(x - io * r * 0.9, y - r * 1.5); g.lineTo(x + io * r * 0.6, y - r * 1.12); }
    else { g.moveTo(x - io * r * 0.9, y - r * 1.12); g.lineTo(x + io * r * 0.6, y - r * 1.5); }
    g.stroke();
  }
  function mouth(g, x, y, r, mood, col) {
    g.strokeStyle = col; g.fillStyle = col; g.lineWidth = r * 0.14; g.lineCap = 'round';
    if (mood === 'happy') { g.beginPath(); g.arc(x, y, r * 0.55, 0, Math.PI); g.closePath(); g.fill(); g.fillStyle = '#ff8f8f'; g.beginPath(); g.arc(x, y + r * 0.28, r * 0.22, 0, Math.PI); g.fill(); }
    else if (mood === 'sad') { g.beginPath(); g.arc(x, y + r * 0.45, r * 0.4, 1.15 * Math.PI, 1.85 * Math.PI); g.stroke(); }
    else if (mood === 'focus') { g.beginPath(); g.moveTo(x - r * 0.3, y + r * 0.1); g.lineTo(x + r * 0.3, y + r * 0.02); g.stroke(); }
    else { g.beginPath(); g.arc(x, y, r * 0.4, 0.15 * Math.PI, 0.85 * Math.PI); g.stroke(); }
  }
  function boot(g, x, y, s, ang, col, stripe) {
    g.save(); g.translate(x, y); g.rotate(ang);
    g.fillStyle = col; g.strokeStyle = 'rgba(5,8,20,.7)'; g.lineWidth = s * 0.07; g.lineJoin = 'round';
    g.beginPath(); g.moveTo(-s * 0.42, -s * 0.3); g.quadraticCurveTo(-s * 0.52, s * 0.12, -s * 0.3, s * 0.2); g.lineTo(s * 0.4, s * 0.2);
    g.quadraticCurveTo(s * 0.62, s * 0.14, s * 0.5, -s * 0.03); g.quadraticCurveTo(s * 0.18, -s * 0.1, s * 0.02, -s * 0.32); g.closePath(); g.fill(); g.stroke();
    g.strokeStyle = stripe; g.lineWidth = s * 0.07; g.lineCap = 'round';
    for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(-s * 0.16 + i * s * 0.13, -s * 0.18 + i * s * 0.03); g.lineTo(-s * 0.06 + i * s * 0.13, s * 0.1); g.stroke(); }
    g.fillStyle = '#e9edf3'; g.fillRect(-s * 0.36, s * 0.17, s * 0.82, s * 0.07);
    g.fillStyle = '#9aa3b0'; for (let i = 0; i < 3; i++) g.fillRect(-s * 0.28 + i * s * 0.28, s * 0.24, s * 0.08, s * 0.06);
    g.restore();
  }
  const angTo = (ax, ay, bx, by) => Math.atan2(by - ay, bx - ax);
  function limb2(g, hx, hy, fx, fy, bendK, lw, col, ol) { // 무릎 있는 다리
    const mx = (hx + fx) / 2, my = (hy + fy) / 2, dx = fx - hx, dy = fy - hy, d = Math.hypot(dx, dy) || 1;
    const kx = mx + (-dy / d) * d * bendK, ky = my + (dx / d) * d * bendK;
    g.lineCap = 'round'; g.lineJoin = 'round';
    if (ol) { g.strokeStyle = ol; g.lineWidth = lw * 1.35; g.beginPath(); g.moveTo(hx, hy); g.lineTo(kx, ky); g.lineTo(fx, fy); g.stroke(); }
    g.strokeStyle = col; g.lineWidth = lw; g.beginPath(); g.moveTo(hx, hy); g.lineTo(kx, ky); g.lineTo(fx, fy); g.stroke();
    return [kx, ky];
  }
  function shadowE(g, G, k) { g.fillStyle = 'rgba(0,12,22,.4)'; g.beginPath(); g.ellipse(0, 0, G * 0.5 * (k || 1), G * 0.085 * (k || 1), 0, 0, TAU); g.fill(); }

  function octo(g, G, t, o, kx, ky) {
    const R = G * 0.36, hy = -G * 0.68, back = o.back, m = o.mood;
    shadowE(g, G);
    for (let i = 0; i < 7; i++) {
      const a = (i / 6 - 0.5) * 2.2, sw = Math.sin(t * 2.2 + i) * 0.1;
      const x0 = Math.sin(a) * R * 0.7, y0 = hy + R * 0.6, x1 = Math.sin(a) * R * 1.45, y1 = -G * 0.01;
      const pts = bez(x0, y0, x0 + (x1 - x0) * (0.2 + sw), (y0 + y1) / 2, x1, y1 - G * 0.06, x1 + Math.sign(Math.sin(a) || 1) * G * 0.08, y1 - G * 0.1, 10);
      taper(g, pts, G * 0.11, G * 0.03, i % 2 ? '#d84f45' : '#e05a4e');
    }
    // 쉬는 발 (축구화)
    boot(g, -R * 1.02, -G * 0.04, G * 0.17, 0.1, '#1d2a4a', '#ff5a4e');
    const kick = () => {
      const x0 = R * 0.42, y0 = hy + R * 0.72;
      const pts = bez(x0, y0, x0 + G * 0.12, y0 + G * 0.16, kx - G * 0.14, ky + G * 0.02, kx, ky, 14);
      taper(g, pts, G * 0.12, G * 0.06, '#e8665a', 'rgba(90,20,20,.35)', G * 0.008);
      if (!back) { g.fillStyle = '#ffc2b8'; for (let i = 3; i < 13; i += 2) { g.beginPath(); g.arc(pts[i * 2], pts[i * 2 + 1], G * 0.011, 0, TAU); g.fill(); } }
      boot(g, kx, ky, G * 0.19, angTo(pts[20], pts[21], kx, ky) * 0.35, '#1d2a4a', '#ff5a4e');
    };
    if (back) kick();
    const grd = g.createRadialGradient(-R * 0.35, hy - R * 0.45, R * 0.1, 0, hy, R * 1.15); grd.addColorStop(0, '#ffa596'); grd.addColorStop(1, '#d64c40');
    const head = () => { g.beginPath(); g.ellipse(0, hy, R, R * 1.05, 0, 0, TAU); };
    g.fillStyle = grd; g.strokeStyle = 'rgba(90,20,20,.45)'; g.lineWidth = G * 0.012; head(); g.fill(); g.stroke();
    g.save(); head(); g.clip(); g.fillStyle = '#ffffff'; g.fillRect(-R * 1.1, hy - R * 0.66, R * 2.2, R * 0.26); g.fillStyle = '#2f7bff'; g.fillRect(-R * 1.1, hy - R * 0.57, R * 2.2, R * 0.08); g.restore();
    if (back) {
      g.fillStyle = 'rgba(160,40,40,.25)';
      for (const [x, y, r] of [[-0.4, -0.05, 0.12], [0.3, -0.2, 0.09], [0.1, 0.25, 0.14], [-0.2, 0.55, 0.08], [0.45, 0.35, 0.1]]) { g.beginPath(); g.arc(x * R, hy + y * R, r * R, 0, TAU); g.fill(); }
      const wv = Math.sin(t * 7) * G * 0.02; g.fillStyle = '#ffffff';
      for (const k of [-1, 1]) { g.beginPath(); g.moveTo(0, hy - R * 0.55); g.quadraticCurveTo(k * R * 0.2, hy - R * 0.3 + wv, k * R * 0.32, hy - R * 0.05 - wv); g.lineTo(k * R * 0.2, hy - R * 0.1); g.closePath(); g.fill(); }
    } else {
      for (const k of [-1, 1]) { eyeF(g, k * R * 0.38, hy + R * 0.08, R * 0.25, m, o.look); brow(g, k * R * 0.38, hy + R * 0.08, R * 0.25, m, k, '#7a2420'); }
      g.fillStyle = 'rgba(255,120,130,.45)'; for (const k of [-1, 1]) { g.beginPath(); g.ellipse(k * R * 0.64, hy + R * 0.45, R * 0.13, R * 0.07, 0, 0, TAU); g.fill(); }
      mouth(g, 0, hy + R * 0.5, R * 0.28, m, '#7a2420');
      kick();
    }
  }
  function claw(g, x, y, G, ang, open) {
    g.save(); g.translate(x, y); g.rotate(ang);
    g.fillStyle = '#e8532f'; g.strokeStyle = 'rgba(90,20,10,.45)'; g.lineWidth = G * 0.012;
    g.beginPath(); g.ellipse(-G * 0.02, 0, G * 0.1, G * 0.075, 0, 0, TAU); g.fill(); g.stroke();
    for (const k of [-1, 1]) { g.save(); g.rotate(k * open); g.beginPath(); g.moveTo(G * 0.04, k * G * 0.01); g.quadraticCurveTo(G * 0.14, k * G * 0.07, G * 0.2, k * G * 0.01); g.quadraticCurveTo(G * 0.12, k * G * 0.02, G * 0.05, -k * G * 0.02); g.closePath(); g.fillStyle = k < 0 ? '#ff7a52' : '#e8532f'; g.fill(); g.stroke(); g.restore(); }
    g.restore();
  }
  function crab(g, G, t, o, kx, ky) {
    const back = o.back, m = o.mood, bY = -G * 0.42;
    shadowE(g, G, 1.1);
    g.lineCap = 'round'; g.lineJoin = 'round';
    for (const k of [-1, 1]) for (let i = 0; i < 3; i++) {
      if (k === 1 && i === 2) continue;
      const sx = k * G * 0.24, sy = bY + G * 0.06 + i * G * 0.03, qx = k * G * (0.42 + i * 0.07), qy = bY - G * (0.06 - i * 0.03) + Math.sin(t * 3 + i + k) * G * 0.01, fx = k * G * (0.5 + i * 0.08), fy = -G * 0.005;
      g.strokeStyle = '#c4381e'; g.lineWidth = G * 0.045; g.beginPath(); g.moveTo(sx, sy); g.lineTo(qx, qy); g.lineTo(fx, fy); g.stroke();
      if (k === -1 && i === 2) boot(g, fx - G * 0.02, fy - G * 0.03, G * 0.15, 0, '#202a3c', '#ffd23f');
    }
    const kick = () => { limb2(g, G * 0.26, bY + G * 0.12, kx, ky, -0.35, G * 0.05, '#c4381e'); boot(g, kx, ky, G * 0.17, 0, '#202a3c', '#ffd23f'); };
    if (back) kick();
    // 집게
    const up = m === 'happy', sn = up ? Math.sin(t * 14) : Math.sin(t * 1.3) * 0.2;
    for (const k of [-1, 1]) {
      const sx = k * G * 0.33, sy = bY - G * 0.02, ex = sx + k * G * 0.14, ey = up ? bY - G * 0.5 : bY - G * 0.14;
      g.strokeStyle = '#d4441f'; g.lineWidth = G * 0.06; g.beginPath(); g.moveTo(sx, sy); g.lineTo(sx + k * G * 0.12, (sy + ey) / 2 + G * 0.05); g.lineTo(ex, ey); g.stroke();
      claw(g, ex, ey - G * 0.06, G * 0.8, k > 0 ? (up ? -1.6 : -1.1) : (up ? -1.55 : -2.05), 0.25 + 0.2 * sn * k);
    }
    const body = () => { g.beginPath(); g.ellipse(0, bY, G * 0.38, G * 0.24, 0, 0, TAU); };
    const grd = g.createRadialGradient(-G * 0.1, bY - G * 0.12, G * 0.05, 0, bY, G * 0.45); grd.addColorStop(0, '#ff9566'); grd.addColorStop(1, '#cc3a1b');
    g.fillStyle = grd; g.strokeStyle = 'rgba(90,20,10,.4)'; g.lineWidth = G * 0.012; body(); g.fill(); g.stroke();
    g.save(); body(); g.clip(); g.fillStyle = '#ffffff'; g.fillRect(-G * 0.4, bY - G * 0.2, G * 0.8, G * 0.06); g.fillStyle = '#ffd23f'; g.fillRect(-G * 0.4, bY - G * 0.18, G * 0.8, G * 0.02); g.restore();
    if (back) { g.fillStyle = 'rgba(150,30,10,.3)'; for (let i = -2; i <= 2; i++) { g.beginPath(); g.arc(i * G * 0.11, bY + G * 0.02 + Math.abs(i) * G * 0.015, G * 0.03, 0, TAU); g.fill(); } }
    for (const k of [-1, 1]) {
      const ex = k * G * 0.12 + (up ? Math.sin(t * 10 + k) * G * 0.015 : 0), ey = bY - G * 0.38;
      g.strokeStyle = '#c4381e'; g.lineWidth = G * 0.045; g.beginPath(); g.moveTo(k * G * 0.08, bY - G * 0.15); g.lineTo(ex, ey + G * 0.04); g.stroke();
      if (back) { g.fillStyle = '#f4f4f4'; g.beginPath(); g.arc(ex, ey, G * 0.075, 0, TAU); g.fill(); g.strokeStyle = 'rgba(60,20,20,.35)'; g.lineWidth = G * 0.01; g.stroke(); }
      else { eyeF(g, ex, ey, G * 0.075, m, o.look); brow(g, ex, ey, G * 0.075, m, k, '#6a1a0c'); }
    }
    if (!back) {
      mouth(g, 0, bY - G * 0.04, G * 0.1, m, '#6a1a0c');
      g.fillStyle = 'rgba(255,140,130,.5)'; for (const k of [-1, 1]) { g.beginPath(); g.ellipse(k * G * 0.17, bY + G * 0.01, G * 0.04, G * 0.022, 0, 0, TAU); g.fill(); }
      kick();
    }
  }
  function turtle(g, G, t, o, kx, ky) {
    const back = o.back, m = o.mood, sy = -G * 0.56, sr = G * 0.33, hy = sy - sr * 1.12 - G * 0.1, hr = G * 0.2;
    shadowE(g, G, 0.9);
    const SK = '#6dbb58', SK2 = '#4f9a42';
    // 쉬는 다리
    limb2(g, -G * 0.15, -G * 0.3, -G * 0.2, -G * 0.06, 0.1, G * 0.13, SK, 'rgba(20,50,20,.5)');
    boot(g, -G * 0.2, -G * 0.04, G * 0.18, 0, '#1b2236', '#4fe3ff');
    const kick = () => { limb2(g, G * 0.15, -G * 0.3, kx, ky, -0.12, G * 0.13, SK, 'rgba(20,50,20,.5)'); boot(g, kx, ky, G * 0.19, 0, '#1b2236', '#4fe3ff'); };
    if (back) kick();
    // 팔
    const up = m === 'happy';
    for (const k of [-1, 1]) {
      const ax = k * sr * 0.92, ay = sy - sr * 0.45, ex = k * G * (up ? 0.36 : 0.46), ey = up ? sy - sr * 1.6 + Math.sin(t * 12 + k) * G * 0.03 : sy + G * 0.04;
      g.strokeStyle = 'rgba(20,50,20,.5)'; g.lineWidth = G * 0.13; g.lineCap = 'round'; g.beginPath(); g.moveTo(ax, ay); g.lineTo(ex, ey); g.stroke();
      g.strokeStyle = SK; g.lineWidth = G * 0.1; g.stroke();
    }
    // 등껍질 / 배
    const shell = () => { g.beginPath(); g.ellipse(0, sy, sr, sr * 1.15, 0, 0, TAU); };
    if (back) {
      const grd = g.createRadialGradient(-sr * 0.3, sy - sr * 0.4, sr * 0.1, 0, sy, sr * 1.2); grd.addColorStop(0, '#5f9e4c'); grd.addColorStop(1, '#2d5f2a');
      g.fillStyle = grd; g.strokeStyle = '#1f4220'; g.lineWidth = G * 0.02; shell(); g.fill(); g.stroke();
      g.save(); shell(); g.clip(); g.strokeStyle = '#a7d977'; g.lineWidth = G * 0.014;
      const hex = (cx, cy, r) => { g.beginPath(); for (let i = 0; i < 6; i++) { const a = i * TAU / 6 + Math.PI / 6; g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r * 1.1); } g.closePath(); g.stroke(); };
      hex(0, sy, sr * 0.34); for (let i = 0; i < 6; i++) { const a = i * TAU / 6; hex(Math.cos(a) * sr * 0.66, sy + Math.sin(a) * sr * 0.74, sr * 0.3); }
      g.restore();
      g.strokeStyle = '#c9a25a'; g.lineWidth = G * 0.03; shell(); g.stroke();
    } else {
      g.fillStyle = '#3e7a36'; shell(); g.fill();
      g.fillStyle = '#f3dd8c'; g.strokeStyle = '#b89a4a'; g.lineWidth = G * 0.012; g.beginPath(); g.ellipse(0, sy + sr * 0.05, sr * 0.78, sr * 1.0, 0, 0, TAU); g.fill(); g.stroke();
      for (let i = -2; i <= 2; i++) { const yy = sy + i * sr * 0.32, w = sr * 0.78 * Math.sqrt(Math.max(0, 1 - Math.pow(i * 0.32 / 1.0, 2))); g.beginPath(); g.moveTo(-w * 0.85, yy); g.lineTo(w * 0.85, yy); g.stroke(); }
    }
    // 머리
    g.fillStyle = SK; g.strokeStyle = 'rgba(20,50,20,.55)'; g.lineWidth = G * 0.012;
    g.beginPath(); g.ellipse(0, hy, hr * 1.05, hr, 0, 0, TAU); g.fill(); g.stroke();
    g.fillStyle = '#e2364f'; g.save(); g.beginPath(); g.ellipse(0, hy, hr * 1.05, hr, 0, 0, TAU); g.clip(); g.fillRect(-hr * 1.2, hy - hr * 0.62, hr * 2.4, hr * 0.28); g.restore();
    if (back) { const wv = Math.sin(t * 7) * G * 0.015; g.fillStyle = '#e2364f'; for (const k of [-1, 1]) { g.beginPath(); g.moveTo(0, hy - hr * 0.5); g.quadraticCurveTo(k * hr * 0.3, hy - hr * 0.1 + wv, k * hr * 0.5, hy + hr * 0.2 - wv); g.lineTo(k * hr * 0.32, hy + hr * 0.12); g.closePath(); g.fill(); } }
    else {
      for (const k of [-1, 1]) { eyeF(g, k * hr * 0.42, hy + hr * 0.05, hr * 0.27, m, o.look); brow(g, k * hr * 0.42, hy + hr * 0.05, hr * 0.27, m, k, '#24461d'); }
      g.fillStyle = 'rgba(255,130,130,.45)'; for (const k of [-1, 1]) { g.beginPath(); g.ellipse(k * hr * 0.72, hy + hr * 0.45, hr * 0.14, hr * 0.08, 0, 0, TAU); g.fill(); }
      mouth(g, 0, hy + hr * 0.5, hr * 0.32, m, '#24461d');
      kick();
    }
  }
  function puffer(g, G, t, o, kx, ky) {
    const back = o.back, m = o.mood, p = o.puff || 0, R = G * 0.33 * (1 + 0.22 * p), cy = -G * 0.62 + Math.sin(t * 3) * G * 0.025;
    shadowE(g, G, 0.75);
    // 지느러미 다리 (축구화)
    const finLeg = (x0, y0, x1, y1) => { const pts = bez(x0, y0, x0, y0 + G * 0.1, x1, y1 - G * 0.12, x1, y1, 10); taper(g, pts, G * 0.09, G * 0.05, '#f0a020', 'rgba(110,60,0,.4)', G * 0.008); return pts; };
    finLeg(-R * 0.42, cy + R * 0.8, -G * 0.2, -G * 0.06); boot(g, -G * 0.2, -G * 0.04, G * 0.16, 0, '#2a1f48', '#ff8ad8');
    const kick = () => { finLeg(R * 0.42, cy + R * 0.8, kx, ky); boot(g, kx, ky, G * 0.17, 0, '#2a1f48', '#ff8ad8'); };
    if (back) kick();
    // 가시
    g.fillStyle = '#c98a14';
    for (let i = 0; i < 20; i++) { const a = i / 20 * TAU + 0.1, l = G * (0.05 + 0.07 * p); g.beginPath(); g.moveTo(Math.cos(a - 0.09) * R * 0.96, cy + Math.sin(a - 0.09) * R * 0.96); g.lineTo(Math.cos(a) * (R + l), cy + Math.sin(a) * (R + l)); g.lineTo(Math.cos(a + 0.09) * R * 0.96, cy + Math.sin(a + 0.09) * R * 0.96); g.fill(); }
    // 옆지느러미
    const fl = Math.sin(t * 9) * 0.35;
    for (const k of [-1, 1]) { g.save(); g.translate(k * R * 0.97, cy + R * 0.05); g.rotate(k * (0.4 + fl)); g.fillStyle = 'rgba(255,170,60,.9)'; g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(k * G * 0.12, -G * 0.08, k * G * 0.14, G * 0.02); g.quadraticCurveTo(k * G * 0.08, G * 0.06, 0, 0); g.fill(); g.restore(); }
    const grd = g.createRadialGradient(-R * 0.35, cy - R * 0.4, R * 0.1, 0, cy, R * 1.1); grd.addColorStop(0, '#fff09a'); grd.addColorStop(1, '#f2a91c');
    g.fillStyle = grd; g.strokeStyle = 'rgba(120,70,0,.45)'; g.lineWidth = G * 0.012; g.beginPath(); g.arc(0, cy, R, 0, TAU); g.fill(); g.stroke();
    g.save(); g.beginPath(); g.arc(0, cy, R, 0, TAU); g.clip(); g.fillStyle = '#ffffff'; g.fillRect(-R, cy - R * 0.78, R * 2, R * 0.22); g.fillStyle = '#7a3cff'; g.fillRect(-R, cy - R * 0.7, R * 2, R * 0.06);
    if (!back) { g.fillStyle = 'rgba(255,250,220,.7)'; g.beginPath(); g.ellipse(0, cy + R * 0.55, R * 0.7, R * 0.45, 0, 0, TAU); g.fill(); }
    g.restore();
    g.fillStyle = 'rgba(140,80,10,.35)'; for (const [x, y, r] of back ? [[-0.4, -0.2, 0.08], [0.3, -0.3, 0.07], [0.1, 0.1, 0.09], [-0.25, 0.35, 0.07], [0.45, 0.2, 0.06]] : [[-0.6, -0.35, 0.06], [0.62, -0.3, 0.05], [0.7, 0.15, 0.05]]) { g.beginPath(); g.arc(x * R, cy + y * R, r * R, 0, TAU); g.fill(); }
    if (back) {
      g.save(); g.translate(0, cy + R * 0.15); const tw = Math.sin(t * 6) * 0.15; g.rotate(tw);
      g.fillStyle = 'rgba(80,190,255,.92)'; g.beginPath(); g.moveTo(0, -R * 0.05); g.quadraticCurveTo(-R * 0.5, R * 0.25, -R * 0.4, R * 0.55); g.quadraticCurveTo(0, R * 0.35, R * 0.4, R * 0.55); g.quadraticCurveTo(R * 0.5, R * 0.25, 0, -R * 0.05); g.fill();
      g.strokeStyle = 'rgba(255,255,255,.6)'; g.lineWidth = G * 0.008; for (const k of [-0.5, 0, 0.5]) { g.beginPath(); g.moveTo(0, 0); g.lineTo(k * R * 0.6, R * 0.48); g.stroke(); }
      g.restore();
    } else {
      for (const k of [-1, 1]) { eyeF(g, k * R * 0.4, cy - R * 0.12, R * 0.27, m, o.look); brow(g, k * R * 0.4, cy - R * 0.12, R * 0.27, m, k, '#7a4a00'); }
      g.fillStyle = 'rgba(255,120,130,.5)'; for (const k of [-1, 1]) { g.beginPath(); g.ellipse(k * R * 0.66, cy + R * 0.22, R * 0.13, R * 0.07, 0, 0, TAU); g.fill(); }
      if (m === 'happy' || m === 'sad') mouth(g, 0, cy + R * 0.35, R * 0.3, m, '#8a3a20');
      else { g.fillStyle = '#ff7a8a'; g.strokeStyle = '#a03040'; g.lineWidth = G * 0.01; g.beginPath(); g.ellipse(0, cy + R * 0.38, R * 0.12 * (1 + p * 0.4), R * 0.09, 0, 0, TAU); g.fill(); g.stroke(); }
      kick();
    }
  }
  const SPECIES = { octo, crab, turtle, puffer };
  function drawStriker(g, kind, x, y, G, t, o) {
    const fn = SPECIES[kind] || octo, mir = o.mir || 1, sx = Math.max(0.06, o.sx == null ? 1 : o.sx), lean = o.lean || 0, hop = o.hop || 0;
    const yy = y - hop;
    let kx, ky;
    if (o.boot) { const dx = o.boot[0] - x, dy = o.boot[1] - yy, c = Math.cos(-lean), s = Math.sin(-lean); kx = (dx * c - dy * s) / (sx * mir); ky = dx * s + dy * c; }
    else { kx = G * 0.3; ky = -G * 0.03; }
    g.save(); g.translate(x, yy); if (lean) g.rotate(lean); g.scale(sx * mir, 1);
    if (o.alpha != null) g.globalAlpha = o.alpha;
    fn(g, G, t, o, kx, ky);
    g.restore();
  }

  // ═════════ 응원하는 바다 친구들 ═════════
  // f = {kind, color, x, y, s, flag, seed}, st = {cheer 0..1, gasp 0..1}
  function drawFan(g, f, t, st) {
    const s = f.s, ph = t * 2 + f.seed;
    const jump = st.cheer ? Math.abs(Math.sin(t * 10 + f.seed)) * s * 0.55 * st.cheer : Math.abs(Math.sin(ph)) * s * 0.05;
    const shrink = 1 - 0.12 * (st.gasp || 0);
    const x = f.x, y = f.y - jump;
    g.save(); g.translate(x, y); g.scale(shrink, shrink);
    g.fillStyle = 'rgba(0,10,20,.35)'; g.beginPath(); g.ellipse(0, jump / shrink, s * 0.45, s * 0.1, 0, 0, TAU); g.fill();
    const happy = st.cheer > 0.05, gasp = st.gasp > 0.05;
    const armUp = happy ? -1 : gasp ? -0.6 : Math.sin(ph * 1.3) * 0.2;
    const face = (ex, ey, er) => {
      g.fillStyle = '#16161e';
      for (const k of [-1, 1]) { if (happy) { g.strokeStyle = '#16161e'; g.lineWidth = er * 0.5; g.lineCap = 'round'; g.beginPath(); g.arc(ex + k * er * 2.2, ey + er * 0.4, er, Math.PI * 1.15, Math.PI * 1.85); g.stroke(); } else { g.beginPath(); g.arc(ex + k * er * 2.2, ey, er * (gasp ? 1.25 : 1), 0, TAU); g.fill(); } }
      if (gasp) { g.fillStyle = '#5a1020'; g.beginPath(); g.ellipse(ex, ey + er * 2.6, er * 0.9, er * 1.3, 0, 0, TAU); g.fill(); }
      else { g.strokeStyle = '#5a1020'; g.lineWidth = er * 0.5; g.beginPath(); g.arc(ex, ey + er * 1.6, er * (happy ? 1.3 : 0.9), 0.15 * Math.PI, 0.85 * Math.PI); g.stroke(); }
    };
    if (f.kind === 'fish') {
      g.fillStyle = shade(f.color, -0.15); g.beginPath(); g.moveTo(s * 0.35, -s * 0.5); g.lineTo(s * 0.62, -s * 0.78 + Math.sin(ph * 4) * s * 0.06); g.lineTo(s * 0.62, -s * 0.22); g.closePath(); g.fill();
      g.fillStyle = f.color; g.beginPath(); g.ellipse(0, -s * 0.5, s * 0.42, s * 0.34, 0, 0, TAU); g.fill();
      g.fillStyle = 'rgba(255,255,255,.35)'; g.beginPath(); g.ellipse(-s * 0.05, -s * 0.38, s * 0.28, s * 0.12, 0, 0, TAU); g.fill();
      face(-s * 0.12, -s * 0.56, s * 0.055);
      g.fillStyle = shade(f.color, -0.25); for (const k of [-1, 1]) { g.beginPath(); g.ellipse(k * s * 0.4, -s * 0.45 + armUp * s * 0.25, s * 0.08, s * 0.16, k * (0.6 - armUp), 0, TAU); g.fill(); }
    } else if (f.kind === 'star') {
      g.save(); g.translate(0, -s * 0.48); g.rotate(Math.sin(ph) * 0.12 + (happy ? Math.sin(t * 12) * 0.15 : 0));
      g.fillStyle = f.color; g.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, q = (i % 2 ? s * 0.2 : s * 0.48) * (i === 2 || i === 8 ? 1 + 0.15 * -armUp : 1); g.lineTo(Math.cos(a) * q, Math.sin(a) * q); } g.closePath(); g.fill();
      g.fillStyle = 'rgba(255,255,255,.4)'; for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + i * TAU / 5; g.beginPath(); g.arc(Math.cos(a) * s * 0.28, Math.sin(a) * s * 0.28, s * 0.03, 0, TAU); g.fill(); }
      face(0, -s * 0.02, s * 0.05); g.restore();
    } else if (f.kind === 'jelly') {
      g.strokeStyle = shade(f.color, -0.1); g.lineWidth = s * 0.05; g.lineCap = 'round';
      for (let i = 0; i < 4; i++) { const xx = (i - 1.5) * s * 0.16; g.beginPath(); g.moveTo(xx, -s * 0.4); g.quadraticCurveTo(xx + Math.sin(ph * 3 + i) * s * 0.1, -s * 0.2, xx, -s * 0.02); g.stroke(); }
      g.fillStyle = f.color; g.globalAlpha = 0.92; g.beginPath(); g.ellipse(0, -s * 0.45, s * 0.38, s * 0.32, 0, Math.PI, 0); g.closePath(); g.fill(); g.globalAlpha = 1;
      face(0, -s * 0.55, s * 0.05);
    } else { // seal
      g.fillStyle = f.color; g.beginPath(); g.ellipse(0, -s * 0.4, s * 0.34, s * 0.42, 0, 0, TAU); g.fill();
      g.fillStyle = 'rgba(255,255,255,.3)'; g.beginPath(); g.ellipse(0, -s * 0.3, s * 0.22, s * 0.26, 0, 0, TAU); g.fill();
      g.fillStyle = shade(f.color, -0.2); for (const k of [-1, 1]) { g.beginPath(); g.ellipse(k * s * 0.32, -s * 0.38 + armUp * s * 0.3, s * 0.08, s * 0.18, k * (0.5 - armUp * 0.8), 0, TAU); g.fill(); }
      face(0, -s * 0.6, s * 0.05);
      g.fillStyle = '#16161e'; g.beginPath(); g.arc(0, -s * 0.52, s * 0.035, 0, TAU); g.fill();
    }
    if (f.flag) {
      const hx = s * 0.42, hy = -s * 0.55 - (happy ? s * 0.25 : 0), top = hy - s * 0.95;
      g.strokeStyle = '#d9d2c0'; g.lineWidth = Math.max(1.5, s * 0.04); g.beginPath(); g.moveTo(hx, hy); g.lineTo(hx, top); g.stroke();
      const wv = Math.sin(t * (happy ? 12 : 4) + f.seed) * s * 0.06, fw = s * 0.95, fh = s * 0.42;
      g.fillStyle = f.flagColor || '#ffe14d'; g.beginPath(); g.moveTo(hx, top); g.quadraticCurveTo(hx + fw * 0.5, top - wv, hx + fw, top + wv * 0.6); g.lineTo(hx + fw, top + fh + wv * 0.6); g.quadraticCurveTo(hx + fw * 0.5, top + fh - wv, hx, top + fh); g.closePath(); g.fill();
      g.fillStyle = '#0b2a4a'; g.font = `900 ${Math.round(fh * 0.6)}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(f.flag, hx + fw * 0.5, top + fh * 0.5);
    }
    g.restore();
  }

  window.BKART = { setLayout, zOf, gy, sc, latK, px, bxs, gp, sstep, buildBg, buildNet, buildFrame, drawNet, buildBall, goalieSprite, drawStriker, drawFan, star, crown, textSprite, boot };
})();
