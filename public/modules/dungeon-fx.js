import { ELEMENTS } from './battle-fx.js';

// V13.130 던전 전투 효과(캔버스 한 장): 펫 속성별 발사체, 맞는 순간(빛 · 고리 · 불꽃 · 속성 조각),
// 몬스터 내려찍기 먼지와 파편, 부활 빛, 클리어 꽃가루, 보스방 불티. 좌표는 무대의 논리 크기
// (가로 844×390, 세로 390×844)이고 화면 배율은 resize(scale)로 받는다.
// 효과 조각은 MAX_PARTS개까지만 그린다(오래된 폰에서도 버벅이지 않게). 움직임 줄이기면 아무것도 그리지 않는다.
// V13.133 렉 줄이기: 폰(화면 배율 3)에서 캔버스를 화면 해상도 그대로(약 300만 픽셀) 매 프레임 다시 그려서
// 전투 15초 중 10초를 이 파일이 썼다. 캔버스 배율은 1.5배까지(빛 효과라 차이가 거의 안 보인다),
// 조각은 180개까지, 발사체 꼬리는 1초에 30개씩, 불티만 남았을 때는 1초에 30번만 그린다.
// V13.146 렉 줄이기 3(사람 2~3명일 때 끊김): 빛(방사형 그라디언트)은 색마다 한 번 그려 둔 그림을 찍고(매 프레임
// 그라디언트를 새로 만들지 않는다), 조각마다 save/restore 대신 변환을 바로 넣고, 같은 색 · 섞기는 다시 넣지 않는다.
// 모양은 그대로다. 동료 공격은 lite(조각 절반, 꼬리 1초에 15개)로 가볍게 그린다(dungeon.js가 고른다).
// 불티는 캔버스 대신 CSS 점(.dgs-embers, v13146.css)으로 띄운다: 맞는 효과가 없으면 캔버스는 쉬고(다시 그리지도 올리지도 않는다),
// 불티는 화면 합성기가 움직인다. 색 · 크기 · 오르는 속도 · 흔들림 · 깜빡임은 캔버스 때와 같다.

export const MAX_PARTS = 180;
export const FX_PIXEL_RATIO_MAX = 1.5;
const TRAIL_EVERY = 1 / 30, TRAIL_EVERY_LITE = 1 / 15;
export const EMBER_MAX = 12;
// 빛 그림: 반지름 GLOW_R인 원에 방사형 그라디언트를 한 번 그려 둔다(색 · 모양별). 그릴 때는 크기만 바꿔 찍는다.
const GLOW_R = 96;
const glowCache = new Map();
function glowSprite(color, mid, center = '#fff') {
  const key = `${color}|${mid}|${center}`;
  let c = glowCache.get(key);
  if (c) return c;
  c = document.createElement('canvas'); c.width = c.height = GLOW_R * 2;
  const g2 = c.getContext('2d'), g = g2.createRadialGradient(GLOW_R, GLOW_R, 0, GLOW_R, GLOW_R, GLOW_R);
  g.addColorStop(0, center); g.addColorStop(mid, color); g.addColorStop(1, 'rgba(0,0,0,0)');
  g2.fillStyle = g; g2.fillRect(0, 0, GLOW_R * 2, GLOW_R * 2);
  glowCache.set(key, c);
  return c;
}
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = list => list[Math.floor(Math.random() * list.length)];
// 속성별 발사체 모양: star 별, leaf 잎, wind 소용돌이, flame 불덩이, ice 얼음 조각, water 물방울, earth 돌, toxic 거품.
const SHAPE = { star: 'star', leaf: 'leaf', wind: 'swirl', flame: 'orb', ice: 'shard', water: 'drop', earth: 'rock', toxic: 'bubble' };
const colorsOf = el => { const e = ELEMENTS[el] || ELEMENTS.star; return [e.c2, e.c1, e.c3]; };

export function createDungeonFx(canvas, { width, height, reduced = () => false } = {}) {
  const ctx = canvas.getContext('2d');
  // W×H: 무대 논리 크기(불티 · 꽃가루 자리). CH: 캔버스 높이(아래가 가려지는 무대는 보이는 곳만, resize의 drawH).
  let W = width, H = height, CH = height, scale = 1, raf = 0, last = 0, alive = true, emberBox = null;
  const parts = [], shots = [];

  function resize(w, h, s, drawH = h) {
    W = w; H = h; CH = Math.min(h, drawH); scale = s * Math.min(FX_PIXEL_RATIO_MAX, window.devicePixelRatio || 1);
    canvas.width = Math.round(W * scale); canvas.height = Math.round(CH * scale);
    canvas.style.width = W + 'px'; canvas.style.height = CH + 'px';
  }
  function add(o) {
    if (reduced() || parts.length >= MAX_PARTS) return;
    parts.push(Object.assign({ x: 0, y: 0, vx: 0, vy: 0, g: 0, life: 0, max: .6, size: 4, rot: 0, vr: 0, color: '#fff', type: 'dot', drag: .94, blend: 'lighter' }, o));
    wake();
  }
  function sparks(x, y, el, n = 18, sp = 260) {
    const c = colorsOf(el);
    for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, v = rnd(sp * .35, sp); add({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, type: 'spark', size: rnd(1.5, 3.2), max: rnd(.3, .6), color: pick(c) }); }
  }
  const ring = (x, y, r0, r1, color, size = 6, max = .45) => add({ x, y, r0, r1, type: 'ring', size, max, color });
  const flare = (x, y, r, color, max = .3) => add({ x, y, r, type: 'flare', max, color });

  // 맞는 순간. big: 쓰기 정답 · 합동 필살 · 브레이크처럼 큰 한 방.
  // 빛(flare)은 겹치면 하얗게 쌓이므로 작고 짧게: 보통 46px · 0.22초, 큰 한 방 100px · 0.4초. glow:false면 빛 없이 조각만.
  // lite: 동료 공격. 빛 · 고리 · 모양은 같고 조각 수만 절반이다.
  function impact(el, x, y, big = false, glow = true, { lite = false } = {}) {
    if (reduced()) return;
    const c = colorsOf(el), shape = SHAPE[el] || 'star', n = k => lite ? Math.ceil(k / 2) : k;
    if (glow) flare(x, y, big ? 100 : 46, c[1], big ? .4 : .22);
    ring(x, y, 8, big ? 130 : 50, c[0], big ? 8 : 4, big ? .55 : .32);
    if (big) ring(x, y, 20, 180, c[2], 5, .7);
    sparks(x, y, el, n(big ? 30 : 12), big ? 460 : 240);
    if (shape === 'star' || shape === 'orb' || shape === 'shard') {
      if (big) for (let i = 0; i < 2; i++) add({ x, y, type: 'slash', L: rnd(110, 150), rot: (i ? -.7 : .55) + rnd(-.15, .15), size: 7, max: .32, color: c[1] });
      for (let i = 0; i < n(big ? 6 : 3); i++) { const a = Math.random() * 6.28, v = rnd(80, 220); add({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, type: shape === 'shard' ? 'shard' : 'star', size: rnd(5, 9), vr: rnd(-8, 8), max: rnd(.45, .7), color: pick(c) }); }
    } else if (shape === 'leaf' || shape === 'rock') {
      for (let i = 0; i < n(10); i++) { const a = Math.random() * 6.28, v = rnd(90, 240); add({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 60, g: 260, type: shape === 'rock' ? 'chunk' : 'leaf', size: rnd(5, 8), rot: Math.random() * 6, vr: rnd(-10, 10), max: rnd(.6, .9), color: pick(c), blend: 'source-over' }); }
    } else {
      for (let i = 0; i < n(3); i++) add({ x, y, type: shape === 'swirl' ? 'swirl' : 'bubble', r: rnd(26, 46), rot: Math.random() * 6, vr: rnd(9, 13) * (i % 2 ? -1 : 1), size: 4, max: .5, color: pick(c) });
      if (shape === 'drop' || shape === 'bubble') for (let i = 0; i < n(12); i++) { const a = -Math.PI / 2 + rnd(-1.2, 1.2), v = rnd(120, 300); add({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: 520, type: 'dot', size: rnd(2, 4), max: rnd(.5, .8), color: pick(c) }); }
    }
  }
  // 몬스터가 내려찍을 때 바닥 먼지와 파편.
  function dust(x0, x1, y, { lite = false } = {}) {
    for (let i = 0; i < (lite ? 9 : 18); i++) add({ x: rnd(x0, x1), y: y - 4 + rnd(-4, 4), vx: rnd(-90, 90), vy: rnd(-120, -30), g: 120, type: 'dust', size: rnd(6, 13), max: rnd(.45, .8), color: pick(['#8b6b5c', '#a1887f', '#6d4c41']), blend: 'source-over', drag: .92 });
    for (let i = 0; i < (lite ? 7 : 14); i++) add({ x: rnd(x0, x1), y, vx: rnd(-40, 40), vy: rnd(-320, -160), g: 600, type: 'chunk', size: rnd(3, 6), rot: Math.random() * 6, vr: rnd(-12, 12), max: rnd(.6, .9), color: pick(['#3f2a24', '#5b3a2e', '#b91c1c']), blend: 'source-over', drag: .99 });
  }
  function slash(x, y, color = '#fb7185') { for (let i = 0; i < 2; i++) add({ x, y, type: 'slash', L: rnd(100, 130), rot: rnd(-.4, .4) + (i ? 1.57 : 0), size: 7, max: .28, color }); flare(x, y, 60, color, .25); }
  function heal(x, y) { for (let k = 0; k < 24; k++) add({ x: x + rnd(-40, 40), y: y + rnd(0, 50), vy: rnd(-140, -60), type: 'dot', size: rnd(2, 4), max: rnd(.6, 1), color: pick(['#bbf7d0', '#4ade80', '#fef9c3']) }); ring(x, y, 10, 70, '#86efac', 4, .5); }
  function confetti() { for (let k = 0; k < 90; k++) add({ x: rnd(0, W), y: rnd(-30, 0), vx: rnd(-40, 40), vy: rnd(60, 220), g: 80, type: k % 3 ? 'star' : 'leaf', size: rnd(4, 8), rot: Math.random() * 6, vr: rnd(-6, 6), max: rnd(2, 3.4), color: pick(['#fde68a', '#f472b6', '#93c5fd', '#86efac', '#fff']), blend: 'source-over', drag: .995 }); }
  // 발사체: from → to, ms 동안. 도착하면 onHit. arc는 위로 휘는 정도(음수가 위).
  // lite: 동료 공격. 발사체 모양은 같고 꼬리 조각이 1초에 15개, 하나씩이다.
  function shoot(from, to, el, ms = 360, onHit = null, arc = null, { lite = false } = {}) {
    if (reduced()) { onHit?.(); return; }
    const shape = SHAPE[el] || 'star';
    shots.push({ x0: from.x, y0: from.y, x1: to.x, y1: to.y, t: 0, dur: ms / 1000, el, shape, arc: arc ?? (shape === 'leaf' ? -rnd(60, 110) : shape === 'swirl' ? -36 : -18), onHit, ph: Math.random() * 6, x: from.x, y: from.y, lite });
    wake();
  }
  // 불티 n개(최대 EMBER_MAX): 무대 아래쪽(높이의 40~100%)에서 1초에 10~26px씩 올라가고, 위로 나가면 높이 80%에서 다시 오른다.
  function setEmbers(n) {
    const count = reduced() ? 0 : Math.min(EMBER_MAX, n);
    if (!emberBox && canvas.parentNode) { emberBox = document.createElement('div'); emberBox.className = 'dgs-embers'; emberBox.setAttribute('aria-hidden', 'true'); canvas.parentNode.insertBefore(emberBox, canvas); }
    if (!emberBox || emberBox.childElementCount === count) return;
    const travel = Math.round(H * .8 + 10);
    emberBox.innerHTML = Array.from({ length: count }, () => {
      const v = rnd(10, 26), dur = travel / v;
      // 오르는 중간 아무 데서나 시작한다(음수 지연): 처음부터 화면 곳곳에 흩어져 있다.
      return `<i style="left:${rnd(0, W).toFixed(0)}px;height:${travel}px;--d:${(rnd(1, 2.6) * 2).toFixed(1)}px;--ph:-${rnd(0, 3.14).toFixed(2)}s;animation-duration:${dur.toFixed(1)}s;animation-delay:-${rnd(0, dur).toFixed(1)}s"></i>`;
    }).join('');
  }

  function starPath(r) { ctx.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * .45 : r; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } ctx.closePath(); }
  function step(dt) {
    for (let i = shots.length - 1; i >= 0; i--) {
      const p = shots[i]; p.t += dt;
      const k = Math.min(1, p.t / p.dur), e = k * k * (3 - 2 * k) * .35 + k * .65;
      const wob = p.shape === 'swirl' ? Math.sin(k * 14 + p.ph) * 16 * (1 - k) : 0;
      p.x = p.x0 + (p.x1 - p.x0) * e; p.y = p.y0 + (p.y1 - p.y0) * e + p.arc * Math.sin(Math.PI * k) + wob;
      const c = colorsOf(p.el);
      p.trail = (p.trail || 0) + dt;
      if (p.trail >= (p.lite ? TRAIL_EVERY_LITE : TRAIL_EVERY)) { p.trail = 0; for (let j = 0; j < (p.shape === 'star' && !p.lite ? 2 : 1); j++) add({ x: p.x + rnd(-3, 3), y: p.y + rnd(-3, 3), vx: rnd(-30, 30), vy: rnd(-30, 30), size: rnd(2, p.shape === 'star' ? 6 : 4), max: rnd(.2, .42), color: pick(c) }); }
      if (k >= 1) { shots.splice(i, 1); p.onHit?.(); }
    }
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i]; p.life += dt;
      if (p.life >= p.max) { parts.splice(i, 1); continue; }
      const d = Math.pow(p.drag, dt * 60); p.vx *= d; p.vy *= d; p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
    }
  }
  // 그리기 상태를 바뀔 때만 넣는다(조각마다 같은 색 · 섞기를 다시 넣지 않는다). rot(): save/restore 없이 회전 변환.
  let curOp = '', curColor = '', turned = false;
  const op = o => { if (o !== curOp) { ctx.globalCompositeOperation = curOp = o; } };
  const paint = c => { if (c !== curColor) { ctx.fillStyle = ctx.strokeStyle = curColor = c; } };
  const base = () => { if (turned) { ctx.setTransform(scale, 0, 0, scale, 0, 0); turned = false; } };
  const rot = (x, y, r) => { const c = Math.cos(r) * scale, s = Math.sin(r) * scale; ctx.setTransform(c, s, -s, c, x * scale, y * scale); turned = true; };
  function draw() {
    ctx.setTransform(scale, 0, 0, scale, 0, 0); ctx.clearRect(0, 0, W, CH);
    turned = false; curOp = ''; curColor = '';
    op('lighter');
    for (const p of parts) {
      const k = p.life / p.max, a = 1 - k;
      op(p.blend); ctx.globalAlpha = a;
      if (p.type !== 'flare' && p.type !== 'slash') paint(p.color);
      switch (p.type) {
        case 'dot': base(); ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (1 - k * .5), 0, 6.28); ctx.fill(); break;
        case 'spark': base(); ctx.lineWidth = p.size; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * .05, p.y - p.vy * .05); ctx.stroke(); break;
        case 'ring': { base(); const r = p.r0 + (p.r1 - p.r0) * (1 - Math.pow(1 - k, 3)); ctx.lineWidth = Math.max(.5, p.size * (1 - k)); ctx.beginPath(); ctx.ellipse(p.x, p.y, r, r * .78, 0, 0, 6.28); ctx.stroke(); break; }
        case 'flare': { base(); ctx.globalAlpha = a * .6; ctx.drawImage(glowSprite(p.color, .25, 'rgba(255,255,255,.9)'), p.x - p.r, p.y - p.r, p.r * 2, p.r * 2); break; }
        case 'slash': { rot(p.x, p.y, p.rot); const L = p.L * Math.min(1, k * 5); const g = ctx.createLinearGradient(-L / 2, 0, L / 2, 0); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(.5, '#fff'); g.addColorStop(1, 'rgba(255,255,255,0)'); ctx.strokeStyle = g; curColor = ''; ctx.lineWidth = p.size * (1 - k); ctx.beginPath(); ctx.moveTo(-L / 2, 0); ctx.lineTo(L / 2, 0); ctx.stroke(); paint(p.color); ctx.globalAlpha = a * .7; ctx.lineWidth = p.size * 2.2 * (1 - k); ctx.stroke(); break; }
        case 'star': rot(p.x, p.y, p.rot); starPath(p.size); ctx.fill(); break;
        case 'shard': rot(p.x, p.y, p.rot); ctx.beginPath(); ctx.moveTo(0, -p.size); ctx.lineTo(p.size * .45, 0); ctx.lineTo(0, p.size); ctx.lineTo(-p.size * .45, 0); ctx.closePath(); ctx.fill(); break;
        case 'leaf': rot(p.x, p.y, p.rot); ctx.beginPath(); ctx.ellipse(0, 0, p.size, p.size * .45, 0, 0, 6.28); ctx.fill(); break;
        case 'swirl': rot(p.x, p.y, p.rot); ctx.lineWidth = p.size * (1 - k) + .5; ctx.beginPath(); ctx.arc(0, 0, p.r * (.6 + k * .8), 0, 4.2); ctx.stroke(); break;
        case 'bubble': base(); ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(p.x + Math.cos(p.rot) * p.r * .5, p.y + Math.sin(p.rot) * p.r * .5, p.size * 2 * (1 - k * .4), 0, 6.28); ctx.stroke(); break;
        case 'dust': base(); ctx.globalAlpha = a * .32; ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (1 + k), 0, 6.28); ctx.fill(); break;
        case 'chunk': rot(p.x, p.y, p.rot); ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * .7); break;
      }
    }
    for (const p of shots) {
      const c = colorsOf(p.el), big = p.shape === 'star' || p.shape === 'orb';
      base(); op('lighter'); ctx.globalAlpha = 1;
      const r = big ? 26 : 16;
      ctx.drawImage(glowSprite(c[1], .35), p.x - r, p.y - r, r * 2, r * 2);
      paint(c[0]); rot(p.x, p.y, p.t * 12);
      if (p.shape === 'star') { starPath(11); ctx.fill(); }
      else if (p.shape === 'leaf') { op('source-over'); paint(c[1]); ctx.beginPath(); ctx.ellipse(0, 0, 9, 4, 0, 0, 6.28); ctx.fill(); }
      else if (p.shape === 'shard') { ctx.beginPath(); ctx.moveTo(0, -11); ctx.lineTo(5, 0); ctx.lineTo(0, 11); ctx.lineTo(-5, 0); ctx.closePath(); ctx.fill(); }
      else if (p.shape === 'rock') { op('source-over'); paint(c[2]); ctx.fillRect(-7, -6, 14, 12); }
      else if (p.shape === 'swirl') { ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, 9, 0, 4); ctx.stroke(); }
      else { ctx.beginPath(); ctx.arc(0, 0, 7, 0, 6.28); ctx.fill(); }
    }
    base(); ctx.globalAlpha = 1; op('source-over');
  }
  function frame(now) {
    raf = 0;
    if (!alive) return;
    const dt = Math.min(.05, (now - (last || now)) / 1000); last = now;
    step(dt); draw();
    if (parts.length || shots.length) raf = requestAnimationFrame(frame);
    else { last = 0; ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, canvas.width, canvas.height); }
  }
  function wake() { if (!raf && alive) raf = requestAnimationFrame(frame); }
  function stop() { alive = false; cancelAnimationFrame(raf); raf = 0; parts.length = 0; shots.length = 0; emberBox?.remove(); emberBox = null; }

  resize(W, H, 1);
  return { resize, shoot, impact, dust, slash, heal, confetti, sparks, setEmbers, stop };
}
