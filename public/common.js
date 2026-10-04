// 공용 렌더링 도구 v2 — 실제 바다 + 모래섬 + 캐릭터 업그레이드
window.IQ = (() => {
  const ZONE = [
    { fill: '#ef4565', dark: '#b8213f', light: '#ff9aae', label: '1' },
    { fill: '#3b6cf6', dark: '#1f45c0', light: '#9bb6ff', label: '2' },
    { fill: '#1fb36b', dark: '#0f8049', light: '#7fe3b0', label: '3' },
    { fill: '#f5a524', dark: '#c27806', light: '#ffd98a', label: '4' },
  ];
  const ISLAND_RATIO = 0.52;
  let NOW = 0; // 마지막 그리기 시각(초)
  const now = () => NOW || performance.now() / 1000;

  function hash(str) { let h = 2166136261; for (const c of String(str)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
  function rng(seed) { let s = seed || 1; return () => (s = (s * 16807) % 2147483647) / 2147483647; }

  // ── 반복되는 부드러운 노이즈 타일 (물결·모래 질감) ──
  function noiseTile(size, octaves, seed, base) {
    const c = document.createElement('canvas'); c.width = c.height = size;
    const g = c.getContext('2d'); const img = g.createImageData(size, size);
    const r = rng(seed); const val = [];
    let grid = base;
    const layers = [];
    for (let o = 0; o < octaves; o++) {
      const n = grid, arr = new Float32Array(n * n); for (let i = 0; i < n * n; i++) arr[i] = r();
      layers.push({ n, arr, amp: Math.pow(0.55, o) }); grid *= 2;
    }
    const sm = (t) => t * t * (3 - 2 * t);
    let min = 9, max = -9;
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      let v = 0;
      for (const L of layers) {
        const fx = x / size * L.n, fy = y / size * L.n; const x0 = Math.floor(fx), y0 = Math.floor(fy);
        const tx = sm(fx - x0), ty = sm(fy - y0); const g2 = (i, j) => L.arr[((j % L.n + L.n) % L.n) * L.n + ((i % L.n + L.n) % L.n)];
        const a = g2(x0, y0) + (g2(x0 + 1, y0) - g2(x0, y0)) * tx, b = g2(x0, y0 + 1) + (g2(x0 + 1, y0 + 1) - g2(x0, y0 + 1)) * tx;
        v += (a + (b - a) * ty) * L.amp;
      }
      val.push(v); if (v < min) min = v; if (v > max) max = v;
    }
    for (let i = 0; i < val.length; i++) { const v = (val[i] - min) / (max - min); img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v * 255; img.data[i * 4 + 3] = 255; }
    g.putImageData(img, 0, 0); return c;
  }
  // 얕은 물 바닥에 비치는 빛 무늬(보로노이 경계)
  function causticTile(size, cells, seed) {
    const c = document.createElement('canvas'); c.width = c.height = size;
    const g = c.getContext('2d'); const img = g.createImageData(size, size); const r = rng(seed);
    const pts = []; for (let i = 0; i < cells; i++) pts.push([r() * size, r() * size]);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      let d1 = 1e9, d2 = 1e9;
      for (const [px, py] of pts) for (let ox = -1; ox <= 1; ox++) for (let oy = -1; oy <= 1; oy++) {
        const dx = x - (px + ox * size), dy = y - (py + oy * size), d = dx * dx + dy * dy;
        if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d;
      }
      const e = Math.sqrt(d2) - Math.sqrt(d1), a = Math.max(0, 1 - e / 4);
      const i = (y * size + x) * 4; img.data[i] = img.data[i + 1] = img.data[i + 2] = 255; img.data[i + 3] = Math.pow(a, 2) * 200;
    }
    g.putImageData(img, 0, 0); return c;
  }
  let T = null;
  function tiles() {
    if (!T) T = { wave: noiseTile(256, 4, 7, 4), wave2: noiseTile(256, 3, 99, 6), sand: noiseTile(128, 3, 31, 16), caus: causticTile(256, 18, 5) };
    return T;
  }

  // ── 바다 ──
  const glints = (() => { const r = rng(12345); return Array.from({ length: 170 }, () => ({ x: r(), y: r(), p: r() * 6.28, sp: 0.6 + r() * 1.6, w: 0.5 + r() })); })();
  // 바다는 부드러운 그림이라 절반 해상도로 그린 뒤 확대 (저사양 PC 대비)
  let off = null;
  function drawWater(ctx, W, H, t) {
    NOW = t;
    const k = 0.5, w = Math.max(1, Math.round(W * k)), h = Math.max(1, Math.round(H * k));
    if (!off || off.width !== w || off.height !== h) { off = document.createElement('canvas'); off.width = w; off.height = h; }
    const o = off.getContext('2d'); o.setTransform(k, 0, 0, k, 0, 0);
    waterRaw(o, W, H, t);
    ctx.save(); ctx.imageSmoothingEnabled = true; ctx.drawImage(off, 0, 0, W, H); ctx.restore();
  }
  function waterRaw(ctx, W, H, t) {
    const tl = tiles();
    const gr = ctx.createLinearGradient(0, 0, 0, H);
    gr.addColorStop(0, '#0a3d66'); gr.addColorStop(0.45, '#0f5e93'); gr.addColorStop(1, '#1479ad');
    ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H);
    // 물결: 두 겹의 노이즈를 반대 방향으로 흘림
    const sc = Math.max(1.2, Math.min(W, H) / 300);
    const layer = (tile, sx, sy, k, alpha, op) => {
      const pat = ctx.createPattern(tile, 'repeat');
      ctx.save(); ctx.globalAlpha = alpha; ctx.globalCompositeOperation = op;
      ctx.scale(sc * k, sc * k * 0.55);
      const ox = ((t * sx) % 256 + 256) % 256, oy = ((t * sy) % 256 + 256) % 256;
      ctx.translate(ox, oy); ctx.fillStyle = pat;
      ctx.fillRect(-ox - 256, -oy - 256, W / (sc * k) + 512, H / (sc * k * 0.55) + 512);
      ctx.restore();
    };
    layer(tl.wave, 6, 3, 1.4, 0.55, 'overlay');
    layer(tl.wave2, -4, 5, 0.9, 0.35, 'soft-light');
    // 햇빛 반짝임
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (const g of glints) {
      const a = Math.pow(Math.max(0, Math.sin(t * g.sp + g.p)), 10);
      if (a < 0.03) continue;
      const y = g.y * H, persp = 0.45 + 0.75 * (y / H);
      const x = ((g.x * W + t * 8 * persp) % W + W) % W;
      ctx.fillStyle = `rgba(255,255,240,${a * 0.75})`;
      ctx.beginPath(); ctx.ellipse(x, y, 7 * g.w * persp, 1.4 * persp, 0, 0, 7); ctx.fill();
    }
    ctx.restore();
    // 가장자리 어둡게
    const vg = ctx.createRadialGradient(W / 2, H * 0.6, Math.min(W, H) * 0.35, W / 2, H * 0.6, Math.max(W, H) * 0.8);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,20,40,.35)');
    ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
  }

  function geom(cx, cy, rx) { return { cx, cy, rx, ry: rx * ISLAND_RATIO, th: rx * ISLAND_RATIO * 0.16 }; }
  function proj(G, x, y) { return [G.cx + x * G.rx, G.cy + y * G.ry]; }

  function palm(ctx, x, y, h, t, flip) {
    ctx.save();
    ctx.fillStyle = 'rgba(60,40,10,.18)'; ctx.beginPath(); ctx.ellipse(x + h * 0.25, y + h * 0.02, h * 0.38, h * 0.08, 0, 0, 7); ctx.fill();
    const lean = flip ? -1 : 1, sway = Math.sin(t * 0.9 + x) * h * 0.015;
    const tx = x + lean * h * 0.22 + sway, ty = y - h;
    ctx.strokeStyle = '#8a6236'; ctx.lineWidth = h * 0.07; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + lean * h * 0.02, y - h * 0.6, tx, ty); ctx.stroke();
    ctx.strokeStyle = 'rgba(70,45,20,.5)'; ctx.lineWidth = h * 0.012;
    for (let i = 1; i < 8; i++) { const u = i / 8, px = x + (tx - x) * u * u + lean * h * 0.02 * u, py = y + (ty - y) * u; ctx.beginPath(); ctx.moveTo(px - h * 0.03, py); ctx.lineTo(px + h * 0.03, py - h * 0.01); ctx.stroke(); }
    for (let i = 0; i < 7; i++) {
      const a = -Math.PI / 2 + (i - 3) * 0.5 + Math.sin(t * 1.2 + i) * 0.04, len = h * (0.42 + (i % 2) * 0.08);
      const ex = tx + Math.cos(a) * len, ey = ty + Math.sin(a) * len * 0.55 + len * 0.35;
      ctx.fillStyle = i % 2 ? '#2f8f3a' : '#3fa548';
      ctx.beginPath(); ctx.moveTo(tx, ty);
      ctx.quadraticCurveTo(tx + Math.cos(a) * len * 0.6, ty + Math.sin(a) * len * 0.6 - len * 0.18, ex, ey);
      ctx.quadraticCurveTo(tx + Math.cos(a) * len * 0.45, ty + Math.sin(a) * len * 0.3, tx, ty); ctx.fill();
    }
    ctx.fillStyle = '#6b4a22'; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(tx + (i - 1) * h * 0.035, ty + h * 0.03, h * 0.03, 0, 7); ctx.fill(); }
    ctx.restore();
  }

  function drawIsland(ctx, G, simple) {
    const { cx, cy, rx, ry, th } = G; const t = now(); const tl = tiles();
    if (!simple) {
      // 얕은 바다(석호) + 바닥 빛무늬
      ctx.save();
      ctx.beginPath(); ctx.ellipse(cx, cy + th * 0.6, rx * 1.38, ry * 1.5, 0, 0, 7); ctx.clip();
      const lg = ctx.createRadialGradient(cx, cy + th * 0.6, rx * 0.9, cx, cy + th * 0.6, rx * 1.38);
      lg.addColorStop(0, 'rgba(70,215,215,.95)'); lg.addColorStop(0.5, 'rgba(40,170,200,.55)'); lg.addColorStop(1, 'rgba(20,120,170,0)');
      ctx.fillStyle = lg; ctx.fillRect(cx - rx * 1.4, cy - ry * 1.6, rx * 2.8, ry * 3.4);
      const pat = ctx.createPattern(tl.caus, 'repeat'); const ks = rx / 380;
      ctx.globalAlpha = 0.35; ctx.globalCompositeOperation = 'lighter';
      ctx.translate(cx, cy); ctx.scale(ks, ks * 0.55); ctx.translate((t * 9) % 256, (t * 5) % 256);
      ctx.fillStyle = pat; ctx.fillRect(-rx / ks * 2, -rx / ks * 2, rx / ks * 4, rx / ks * 4);
      ctx.restore();
      // 섬 그림자
      ctx.fillStyle = 'rgba(0,50,70,.22)';
      ctx.beginPath(); ctx.ellipse(cx + rx * 0.02, cy + th * 1.2, rx * 1.01, ry * 1.04, 0, 0, 7); ctx.fill();
      // 해안 파도 거품 (두 겹, 밀려왔다 빠짐)
      for (let k = 0; k < 2; k++) {
        const ph = t * 0.8 + k * Math.PI, push = (Math.sin(ph) + 1) / 2;
        const rr = 1.03 + 0.06 * push + k * 0.05;
        ctx.save(); ctx.strokeStyle = `rgba(255,255,255,${0.55 - k * 0.2 - push * 0.2})`; ctx.lineCap = 'round';
        for (let i = 0; i < 64; i++) {
          const a0 = i / 64 * Math.PI * 2, a1 = a0 + 0.07 + 0.04 * Math.sin(i * 3.1);
          const wob = 1 + 0.015 * Math.sin(i * 2.3 + t * 2);
          ctx.lineWidth = Math.max(1.5, rx * 0.009 * (1 + Math.sin(i * 1.7 + t) * 0.5));
          ctx.beginPath(); ctx.ellipse(cx, cy + th * 0.7, rx * rr * wob, ry * rr * wob, 0, a0, a1); ctx.stroke();
        }
        ctx.restore();
      }
    }
    // 옆면 (젖은 모래 절벽)
    const sg = ctx.createLinearGradient(cx - rx, 0, cx + rx, 0);
    sg.addColorStop(0, '#b38a52'); sg.addColorStop(0.45, '#d9b679'); sg.addColorStop(1, '#a57d46');
    ctx.fillStyle = sg;
    ctx.beginPath(); ctx.ellipse(cx, cy + th, rx, ry, 0, 0, Math.PI); ctx.lineTo(cx - rx, cy); ctx.ellipse(cx, cy, rx, ry, 0, Math.PI, 0, true); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(80,55,25,.25)';
    ctx.beginPath(); ctx.ellipse(cx, cy + th, rx, ry, 0, 0, Math.PI); ctx.lineTo(cx - rx, cy + th * 0.6); ctx.ellipse(cx, cy + th * 0.6, rx, ry, 0, Math.PI, 0, true); ctx.closePath(); ctx.fill();
    // 윗면 모래
    const tg = ctx.createRadialGradient(cx - rx * 0.15, cy - ry * 0.3, rx * 0.05, cx, cy, rx);
    tg.addColorStop(0, '#fbf0d3'); tg.addColorStop(0.75, '#f1dcab'); tg.addColorStop(1, '#e2c387');
    ctx.fillStyle = tg; ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, 7); ctx.fill();
    ctx.save(); ctx.clip();
    ctx.globalAlpha = simple ? 0.12 : 0.18; ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = ctx.createPattern(tl.sand, 'repeat'); ctx.fillRect(cx - rx, cy - ry, rx * 2, ry * 2);
    ctx.restore();
    ctx.strokeStyle = 'rgba(190,150,90,.6)'; ctx.lineWidth = Math.max(1.5, rx * 0.012);
    ctx.beginPath(); ctx.ellipse(cx, cy, rx * 0.985, ry * 0.97, 0, 0, 7); ctx.stroke();
    if (!simple) {
      // 야자수와 바위 (구역과 겹치지 않는 뒤쪽 가장자리)
      const [p1x, p1y] = proj(G, -0.8, -0.45), [p2x, p2y] = proj(G, 0.82, -0.38);
      palm(ctx, p1x, p1y, rx * 0.3, t, false); palm(ctx, p2x, p2y, rx * 0.24, t, true);
      for (const [wx, wy, k] of [[-0.9, 0.25, 1], [0.93, 0.12, 0.8], [0.62, -0.72, 0.6]]) {
        const [bx, by] = proj(G, wx, wy), r = rx * 0.035 * k;
        ctx.fillStyle = '#8c8f94'; ctx.beginPath(); ctx.ellipse(bx, by, r * 1.4, r, 0, 0, 7); ctx.fill();
        ctx.fillStyle = '#b4b8bd'; ctx.beginPath(); ctx.ellipse(bx - r * 0.3, by - r * 0.3, r * 0.8, r * 0.5, 0, 0, 7); ctx.fill();
      }
    }
  }

  // state: 'question' | 'correct' | 'wrong'
  function drawZone(ctx, G, z, i, state, t) {
    const c = ZONE[i]; const [x, y] = proj(G, z.x, z.y);
    const zx = z.r * G.rx, zy = z.r * G.ry;
    ctx.save();
    if (state === 'wrong') ctx.globalAlpha = 0.25;
    if (state === 'correct') {
      const pulse = 1 + Math.sin(t * 6) * 0.04;
      ctx.shadowColor = c.light; ctx.shadowBlur = G.rx * 0.1;
      ctx.fillStyle = c.light; ctx.beginPath(); ctx.ellipse(x, y, zx * 1.12 * pulse, zy * 1.12 * pulse, 0, 0, 7); ctx.fill();
      ctx.shadowBlur = 0;
    }
    ctx.fillStyle = 'rgba(255,255,255,.9)'; ctx.beginPath(); ctx.ellipse(x, y, zx * 1.04, zy * 1.06, 0, 0, 7); ctx.fill();
    ctx.fillStyle = c.dark; ctx.beginPath(); ctx.ellipse(x, y + zy * 0.05, zx * 0.98, zy * 0.98, 0, 0, 7); ctx.fill();
    const gr = ctx.createRadialGradient(x - zx * 0.3, y - zy * 0.45, zx * 0.05, x, y, zx);
    gr.addColorStop(0, c.light); gr.addColorStop(0.7, c.fill); gr.addColorStop(1, c.dark);
    ctx.fillStyle = gr; ctx.beginPath(); ctx.ellipse(x, y, zx * 0.95, zy * 0.92, 0, 0, 7); ctx.fill();
    if (state === 'question') {
      const u = (t * 0.6) % 1;
      ctx.strokeStyle = `rgba(255,255,255,${0.5 * (1 - u)})`; ctx.lineWidth = Math.max(2, G.rx * 0.008);
      ctx.beginPath(); ctx.ellipse(x, y, zx * (0.5 + u * 0.45), zy * (0.5 + u * 0.42), 0, 0, 7); ctx.stroke();
    }
    ctx.fillStyle = 'rgba(255,255,255,.28)';
    ctx.font = `900 ${zy * 1.1}px Pretendard, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.save(); ctx.translate(x, y); ctx.scale(1, 0.62); ctx.fillText(c.label, 0, zy * 0.08); ctx.restore();
    ctx.restore();
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  function shade(hex, k) { // k>0 밝게, k<0 어둡게
    const n = parseInt(hex.slice(1), 16); let r = n >> 16, g = n >> 8 & 255, b = n & 255;
    const f = (v) => Math.round(k > 0 ? v + (255 - v) * k : v * (1 + k));
    return `rgb(${f(r)},${f(g)},${f(b)})`;
  }
  const HAIR = ['#2a1b12', '#4a2e1b', '#16161d', '#7b4a22', '#3b2a4a'];

  // 캐릭터: (x,y)=발 위치, s=크기
  function drawChar(ctx, x, y, s, color, t, moving, face, name, opts = {}) {
    const h = hash(opts.seed != null ? opts.seed : (name || color));
    const style = h % 4, hair = HAIR[(h >> 3) % HAIR.length];
    const run = moving ? t * 15 : 0;
    const bob = moving ? -Math.abs(Math.sin(run)) * s * 0.16 : Math.sin(t * 2.4 + h) * s * 0.025;
    const sw = moving ? Math.sin(run) : 0;
    const OL = 'rgba(30,20,20,.55)', lw = Math.max(1, s * 0.07);
    ctx.save();
    if (opts.alpha != null) ctx.globalAlpha = opts.alpha;
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    // 그림자 + 표시 고리
    ctx.fillStyle = 'rgba(70,45,10,.28)';
    ctx.beginPath(); ctx.ellipse(x, y, s * 0.55 * (moving ? 0.9 + Math.abs(sw) * 0.1 : 1), s * 0.18, 0, 0, 7); ctx.fill();
    if (opts.ring) { ctx.strokeStyle = opts.ring; ctx.lineWidth = s * 0.13; ctx.beginPath(); ctx.ellipse(x, y, s * 0.85, s * 0.32, 0, 0, 7); ctx.stroke(); }
    // 달릴 때 모래 먼지
    if (moving) for (let k = 0; k < 2; k++) {
      const u = ((t * 2.2 + k * 0.5 + (h % 7) * 0.1) % 1);
      ctx.fillStyle = `rgba(235,215,170,${0.6 * (1 - u)})`;
      ctx.beginPath(); ctx.arc(x - face * s * (0.35 + u * 0.6), y - s * (0.05 + u * 0.2), s * (0.1 + u * 0.12), 0, 7); ctx.fill();
    }
    const by = y + bob;
    // 다리 + 신발
    for (const k of [-1, 1]) {
      const off = sw * k * s * 0.2, lx = x + k * s * 0.17 + off * 0.5;
      ctx.fillStyle = '#2c3446'; ctx.strokeStyle = OL; ctx.lineWidth = lw;
      roundRect(ctx, lx - s * 0.1, by - s * 0.48, s * 0.2, s * 0.38, s * 0.08); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.ellipse(lx + face * s * 0.04 + off * 0.3, by - s * 0.08, s * 0.15, s * 0.09, 0, 0, 7); ctx.fill(); ctx.stroke();
    }
    // 팔 (뒤)
    const arm = (k) => {
      const ax = x + k * s * 0.43, ay = by - s * 0.98, ang = (moving ? -sw * k * 0.9 : 0.15 * k);
      ctx.save(); ctx.translate(ax, ay); ctx.rotate(ang);
      ctx.fillStyle = shade(color, -0.15); ctx.strokeStyle = OL; ctx.lineWidth = lw;
      roundRect(ctx, -s * 0.09, 0, s * 0.18, s * 0.4, s * 0.09); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#ffd9bb'; ctx.beginPath(); ctx.arc(0, s * 0.42, s * 0.09, 0, 7); ctx.fill(); ctx.stroke();
      ctx.restore();
    };
    arm(-face);
    // 몸통
    const bg = ctx.createLinearGradient(x - s * 0.4, by - s * 1.15, x + s * 0.4, by - s * 0.4);
    bg.addColorStop(0, shade(color, 0.28)); bg.addColorStop(1, shade(color, -0.12));
    ctx.fillStyle = bg; ctx.strokeStyle = OL; ctx.lineWidth = lw;
    roundRect(ctx, x - s * 0.4, by - s * 1.12, s * 0.8, s * 0.72, s * 0.26); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.font = `900 ${s * 0.3}px Pretendard, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.globalAlpha *= 0.6; ctx.fillText('S', x, by - s * 0.76); ctx.globalAlpha = opts.alpha != null ? opts.alpha : 1;
    arm(face);
    // 머리
    const hx = x + face * s * 0.02, hy = by - s * 1.62, hr = s * 0.6;
    if (style === 2) { ctx.fillStyle = hair; ctx.beginPath(); ctx.ellipse(hx - face * hr * 0.75, hy + hr * 0.25, hr * 0.32, hr * 0.5, -face * 0.3, 0, 7); ctx.fill(); }
    const hg = ctx.createRadialGradient(hx - hr * 0.3, hy - hr * 0.3, hr * 0.1, hx, hy, hr);
    hg.addColorStop(0, '#ffe8d2'); hg.addColorStop(1, '#f6c9a2');
    ctx.fillStyle = hg; ctx.strokeStyle = OL; ctx.lineWidth = lw;
    ctx.beginPath(); ctx.arc(hx, hy, hr, 0, 7); ctx.fill(); ctx.stroke();
    // 머리카락 스타일
    ctx.fillStyle = style === 3 ? shade(color, -0.25) : hair;
    ctx.beginPath();
    if (style === 1) { // 뾰족
      ctx.moveTo(hx - hr * 1.02, hy - hr * 0.05);
      for (let k = 0; k <= 6; k++) { const a = Math.PI + k / 6 * Math.PI; const rr = k % 2 ? hr * 1.28 : hr * 1.02; ctx.lineTo(hx + Math.cos(a) * rr, hy + Math.sin(a) * rr * 0.95 - hr * 0.05); }
      ctx.quadraticCurveTo(hx, hy - hr * 0.35, hx - hr * 1.02, hy - hr * 0.05);
    } else if (style === 3) { // 모자
      ctx.arc(hx, hy - hr * 0.08, hr * 1.04, Math.PI * 1.02, Math.PI * 1.98);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(hx + face * hr * 0.55, hy - hr * 0.12, hr * 0.62, hr * 0.15, 0, 0, 7);
    } else { // 단발/긴머리
      ctx.arc(hx, hy - hr * 0.05, hr * 1.06, Math.PI * 0.98, Math.PI * 2.02);
      ctx.quadraticCurveTo(hx + face * hr * 0.4, hy - hr * 0.2, hx - face * hr * 0.1, hy - hr * 0.42);
      ctx.quadraticCurveTo(hx - face * hr * 0.6, hy - hr * 0.1, hx - hr * 1.04, hy + hr * (style === 2 ? 0.5 : 0.15));
    }
    ctx.closePath(); ctx.fill(); ctx.stroke();
    // 얼굴
    const ex = face * hr * 0.2, blink = ((t + (h % 50) / 10) % 4.2) < 0.12;
    for (const k of [-1, 1]) {
      const exx = hx + k * hr * 0.3 + ex, eyy = hy + hr * 0.15;
      ctx.fillStyle = '#1d1d24';
      if (blink) { ctx.fillRect(exx - hr * 0.1, eyy, hr * 0.2, hr * 0.04); continue; }
      ctx.beginPath(); ctx.ellipse(exx, eyy, hr * 0.11, hr * 0.16, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(exx + hr * 0.04, eyy - hr * 0.06, hr * 0.045, 0, 7); ctx.fill();
    }
    ctx.fillStyle = 'rgba(255,110,120,.35)';
    for (const k of [-1, 1]) { ctx.beginPath(); ctx.ellipse(hx + k * hr * 0.52 + ex, hy + hr * 0.42, hr * 0.14, hr * 0.08, 0, 0, 7); ctx.fill(); }
    ctx.strokeStyle = '#7a3b2a'; ctx.lineWidth = Math.max(1, s * 0.05);
    ctx.beginPath();
    if (opts.scared) ctx.ellipse(hx + ex, hy + hr * 0.5, hr * 0.09, hr * 0.12, 0, 0, 7);
    else ctx.arc(hx + ex, hy + hr * 0.38, hr * 0.14, 0.2 * Math.PI, 0.8 * Math.PI);
    ctx.stroke();
    // 이름표
    if (name) {
      const fs = Math.max(11, s * 0.48);
      ctx.font = `800 ${fs}px Pretendard, 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif`;
      const tw = ctx.measureText(name).width + fs * 1.0, th2 = fs * 1.5;
      const ty = hy - hr * 1.3 - th2 - s * 0.08;
      ctx.fillStyle = 'rgba(0,0,0,.18)'; roundRect(ctx, hx - tw / 2, ty + s * 0.06, tw, th2, th2 / 2); ctx.fill();
      ctx.fillStyle = opts.me ? '#0b2a4a' : '#ffffff';
      roundRect(ctx, hx - tw / 2, ty, tw, th2, th2 / 2); ctx.fill();
      ctx.strokeStyle = opts.me ? '#ffe15a' : color; ctx.lineWidth = Math.max(1.5, fs * 0.14); ctx.stroke();
      ctx.fillStyle = opts.me ? '#ffe15a' : '#1b2433'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(name, hx, ty + th2 / 2 + fs * 0.05);
    }
    ctx.restore();
  }

  function zoneOf(zones, x, y) {
    if (!zones) return -1;
    for (let i = 0; i < zones.length; i++) if (Math.hypot(x - zones[i].x, y - zones[i].y) <= zones[i].r) return i;
    return -1;
  }

  // 서버 상태 → 보간용 맵
  function applyState(map, arr, nowMs) {
    const seen = new Set();
    for (let i = 0; i < arr.length; i += 4) {
      const id = arr[i], x = arr[i + 1] / 1000, y = arr[i + 2] / 1000, f = arr[i + 3];
      seen.add(id);
      let e = map.get(id);
      if (!e) { e = { x, y, tx: x, ty: y }; map.set(id, e); }
      e.tx = x; e.ty = y; e.alive = !!(f & 1); e.moving = !!(f & 2); e.face = f & 4 ? -1 : 1; e.seen = nowMs;
    }
    for (const id of [...map.keys()]) if (!seen.has(id)) map.delete(id);
  }
  function stepInterp(map, dt) {
    const k = 1 - Math.exp(-dt * 16);
    for (const e of map.values()) { e.x += (e.tx - e.x) * k; e.y += (e.ty - e.y) * k; }
  }

  return { ZONE, hash, drawWater, geom, proj, drawIsland, drawZone, drawChar, roundRect, zoneOf, applyState, stepInterp };
})();
