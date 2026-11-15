// 펫 대행진(크라우드 러너) 연출 시험 1판(측정용, 앱과 연결하지 않음). 구성안 docs/pet-runner-plan.md · 측정 docs/runner-fx-perf.mjs.
// 무엇을 보나: 무리 뒤에서 비스듬히 내려다보는 원근 길 위에서 정령 300마리 무리(그리는 수 최대 150, 나머지는 숫자) ·
//   숫자 문(불어나기 · 날아가기) · 숫자 바위 사격(파편) · 톱날 · 망치 · 펫 구출 컷인 · 공성전(쏟아붓기 · 성 붕괴)이
//   폰에서 부드럽게(CPU 4× · 품질 자동 55fps 안팎)도는지.
// 구조(실제 앱으로 옮길 때도 같은 모양, 아레나 시험 페이지 arena-fx.js · 무대 arena-stage.js의 엔진을 옮겨 씀):
//   - 규칙(sim*)은 고정 틱 20Hz(50ms)로 돈다. 무리는 "숫자 하나(N)"와 가운데 위치(cx)뿐이다 → 서버가 조종 기록으로 같은 판을 다시 돌린다.
//     규칙 쪽 난수는 판 씨앗(simRnd)만 쓰고, 연출 쪽 난수(rnd)와 섞지 않는다(연출이 달라도 결과는 같다).
//   - 정령 하나하나는 연출이다: 그리는 칸(슬롯)은 품질 단계마다 상한(T.draw ≤ 150)이 있고, 나머지는 머리 위 숫자로만 보인다.
//   - 효과 저장소(파편 · 연기 · 불꽃 · 빛 · 날아가는 정령 · 탄)는 정해진 크기의 Float32Array 풀(3D 좌표) → 판이 길어져도 메모리 일정.
//   - 효과 재료는 아레나와 같은 칸 이름(그림 71: public/assets/arena/mat-<이름>.webp)을 쓰고, 그림이 없으면 같은 코드 그림.
//   - 빛 번짐은 미리 번지게 그린 그림으로만(ctx.filter blur 없음). 화면 색 · 흰 번쩍 · 가장자리 어둡게는 DOM 막(합성기 처리).
//   - 품질 4단계(해상도 · 그리는 정령 수 · 파편 수 · 빛 겹 · 컷인 속도선)를 프레임 시간을 보고 자동으로 내린다(올리지 않음).
// 주소 옵션: ?q=auto|3|2|1|0(높음 · 중간 · 낮음 · 최저) &clean=1 &seed=숫자 &fx=0(바탕만) &auto=0(자동 조종 끄기)
import { ARENA_ART } from '/modules/arena-art.js';
import { sfx, unlockSound, setMuted, soundState } from '/proto/runner-fx-sound.js?v=1.0';
const PROTO_V = '1.0';
// 옛 서비스 워커가 남은 폰: 기다리는 새 워커를 바로 넘기고(SKIP_WAITING), 넘어가면 한 번만 새로 고친다(arena-fx.js와 같은 방법).
try {
  const sw = navigator.serviceWorker;
  if (sw) {
    sw.getRegistration().then(r => { const w = r?.waiting; if (w) w.postMessage({ type: 'SKIP_WAITING' }); r?.update?.().catch(() => {}); }).catch(() => {});
    sw.addEventListener('controllerchange', () => { try { if (sessionStorage.getItem('runner-fx-reloaded') === PROTO_V) return; sessionStorage.setItem('runner-fx-reloaded', PROTO_V); } catch {} location.reload(); });
  }
} catch {}

const P = new URLSearchParams(location.search);
const $ = s => document.querySelector(s);
const cvs = $('#stage');
const ctx = cvs.getContext('2d', { alpha: false, desynchronized: true });

/* ---------- 품질 단계 ---------- */
// draw: 그리는 정령 수 상한(나머지는 숫자). 정령 그림 1장 = drawImage 1번이라 150마리도 가볍지만, CPU로 그리는 폰은 칠하는 넓이가 문제라 줄인다.
const TIERS = [
  { name: '최저', scale: .75, draw: 40, debris: 70, smoke: 18, sparks: 70, glows: 60, fly: 30, shots: 20, mult: .35, glow: false, shadow: false, cutLines: 4, posts: 6 },
  { name: '낮음', scale: 1, draw: 70, debris: 90, smoke: 26, sparks: 90, glows: 90, fly: 40, shots: 28, mult: .45, glow: false, shadow: false, cutLines: 6, posts: 8 },
  { name: '중간', scale: 1.5, draw: 110, debris: 200, smoke: 48, sparks: 180, glows: 160, fly: 70, shots: 44, mult: .7, glow: true, shadow: false, cutLines: 10, posts: 12 },
  { name: '높음', scale: 2, draw: 150, debris: 300, smoke: 72, sparks: 260, glows: 240, fly: 100, shots: 60, mult: 1, glow: true, shadow: true, cutLines: 14, posts: 16 }
];
const qArg = P.get('q') || 'auto';
let auto = qArg === 'auto';
let tier = auto ? 3 : Math.max(0, Math.min(3, Number(qArg) | 0));
let T = TIERS[tier];
if (P.get('clean') === '1') document.body.classList.add('clean');
const FX_ON = P.get('fx') !== '0';
let autoSteer = P.get('auto') !== '0';

/* ---------- 난수: 규칙 쪽(판 씨앗) · 연출 쪽을 따로 ---------- */
const mulberry = s => () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const SEED = Number(P.get('seed')) || 20261115;
let simRnd = mulberry(SEED);           // 규칙(서버도 같은 씨앗으로 같은 값)
const rnd = mulberry(SEED ^ 0x5bd1e995); // 연출만
const rr = (a, b) => a + rnd() * (b - a);
const TAU = Math.PI * 2;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const easeOut = t => 1 - (1 - t) * (1 - t) * (1 - t);
const mk = (w, h) => { const c = document.createElement('canvas'); c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h)); return c; };

/* ---------- 원근 카메라: 무리 뒤 · 위에서 길 앞쪽을 내려다본다 ---------- */
// 월드: x = 좌우(길 폭 ±ROAD), y = 높이, z = 앞으로 간 거리. 화면 = 소실점(HZ) + 높이차 × F / 거리.
const ROAD = 4;
let cssW = 390, cssH = 844, S = 2, F = 400, CX = 195, HZ = 200;
const cam = { z: -8.5, x: 0, h: 8, zoom: 1, back: 8.5, trauma: 0, punch: 0 };
let PX = 0, PY = 0, PS = 0;                // proj() 결과(캔버스 픽셀): 위치 · 1단위 = PS픽셀
function proj(x, y, z) { const dz = z - cam.z; if (dz < .7) return false; const f = F * (cam.zoom + cam.punch) / dz; PX = CX + (x - cam.x) * f; PY = HZ + (cam.h - y) * f; PS = f; return true; }

function resize() {
  cssW = innerWidth; cssH = innerHeight;
  S = T.scale < 1 ? T.scale : Math.min(devicePixelRatio || 1, T.scale);
  cvs.width = Math.round(cssW * S); cvs.height = Math.round(cssH * S);
  F = Math.min(cssW * 1.05, cssH * .62) * S; CX = cvs.width / 2; HZ = cvs.height * .25;
  buildSky(); buildSprites();
}

/* ---------- 재료 칸: 아레나 그림 71과 같은 이름 · 같은 처리(그림이 오면 그림, 없으면 코드 그림) ---------- */
const MATS = {
  glow: ['add', 256, g => radial(g, 128, [[0, '#fff'], [.25, 'rgba(255,255,255,.75)'], [.6, 'rgba(255,255,255,.18)'], [1, 'rgba(255,255,255,0)']])],
  ring: ['add', 256, g => { for (const [w, a] of [[16, .18], [9, .35], [4, .9]]) { g.strokeStyle = `rgba(255,255,255,${a})`; g.lineWidth = w; g.beginPath(); g.arc(128, 128, 104, 0, TAU); g.stroke(); } }],
  burst: ['add', 256, g => { radial(g, 128, [[0, '#fff'], [.18, 'rgba(255,240,190,.8)'], [.45, 'rgba(255,220,140,0)']]); g.fillStyle = 'rgba(255,245,210,.95)'; for (let i = 0; i < 14; i++) { const a = i / 14 * TAU + rr(-.1, .1), L = rr(70, 122), w = rr(.04, .08); g.beginPath(); g.moveTo(128 + Math.cos(a - w) * 18, 128 + Math.sin(a - w) * 18); g.lineTo(128 + Math.cos(a) * L, 128 + Math.sin(a) * L); g.lineTo(128 + Math.cos(a + w) * 18, 128 + Math.sin(a + w) * 18); g.fill(); } }],
  flame: ['add', 256, g => { for (const [s, c] of [[1, 'rgba(200,40,10,.85)'], [.75, 'rgba(255,130,30,.9)'], [.48, 'rgba(255,220,110,.95)'], [.25, '#fff']]) { g.fillStyle = c; g.beginPath(); g.moveTo(128, 128 - 115 * s - 6); g.bezierCurveTo(128 + 70 * s, 128 - 30 * s, 128 + 62 * s, 128 + 90 * s, 128, 128 + 100 * s); g.bezierCurveTo(128 - 62 * s, 128 + 90 * s, 128 - 70 * s, 128 - 30 * s, 128, 128 - 115 * s - 6); g.fill(); } }],
  ember: ['add', 128, g => radial(g, 64, [[0, '#fff'], [.15, 'rgba(255,220,120,.95)'], [.4, 'rgba(255,120,30,.45)'], [1, 'rgba(255,80,20,0)']])],
  star: ['add', 256, g => { radial(g, 128, [[0, '#fff'], [.08, 'rgba(255,255,255,.8)'], [.2, 'rgba(190,220,255,0)']]); for (const [w, h, a] of [[230, 7, 0], [7, 230, 0], [120, 5, .785], [120, 5, -.785]]) { g.save(); g.translate(128, 128); g.rotate(a); const lg = g.createLinearGradient(-w / 2, 0, w / 2, 0); lg.addColorStop(0, 'rgba(200,225,255,0)'); lg.addColorStop(.5, '#fff'); lg.addColorStop(1, 'rgba(200,225,255,0)'); g.fillStyle = lg; g.beginPath(); g.ellipse(0, 0, w / 2, h / 2, 0, 0, TAU); g.fill(); g.restore(); } }],
  stardust: ['add', 256, g => { for (let i = 0; i < 13; i++) { const x = rr(50, 206), y = rr(50, 206), r = rr(6, 20); g.save(); g.translate(x, y); radial(g, 0, [[0, '#fff'], [.3, 'rgba(255,230,140,.8)'], [1, 'rgba(255,210,90,0)']], r); g.fillStyle = '#fff8d8'; g.fillRect(-r, -.8, r * 2, 1.6); g.fillRect(-.8, -r, 1.6, r * 2); g.restore(); } }],
  speed: ['luma', 512, g => { for (let i = 0; i < 11; i++) { const y = rr(40, 173), x0 = rr(10, 160), L = rr(180, 330), h = rr(2, 7); const lg = g.createLinearGradient(x0, 0, x0 + L, 0); lg.addColorStop(0, '#fff'); lg.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = lg; g.fillRect(x0, y - h / 2, L, h); } }, 213],
  'rock-a': ['key', 128, g => rock(g, 128, '#8a7a66')],
  'rock-b': ['key', 128, g => rock(g, 128, '#7d7a72', .55)],
  shard: ['key', 128, g => { g.translate(64, 64); g.rotate(-.75); const gr = g.createLinearGradient(-40, -10, 40, 10); gr.addColorStop(0, '#e9fbff'); gr.addColorStop(.5, '#8fd6f5'); gr.addColorStop(1, '#3c8fc8'); g.fillStyle = gr; g.strokeStyle = '#1d4f86'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(-50, 0); g.lineTo(-8, -13); g.lineTo(54, -2); g.lineTo(-4, 14); g.closePath(); g.fill(); g.stroke(); }],
  smoke: ['luma', 256, g => puff(g, 256, 7)],
  dust: ['luma', 256, g => { g.setTransform(1, 0, 0, .58, 0, 54); puff(g, 256, 9); }]
};
const MAT_KEYS = Object.keys(MATS);
const mat = {}, matFromArt = new Set(), tintCache = new Map();
function radial(g, r0, stops, R, cx, cy) { const c = cx ?? (r0 || 0), cy2 = cy ?? (r0 || 0), rad = R ?? r0; const gr = g.createRadialGradient(c, cy2, 0, c, cy2, rad); for (const [o, col] of stops) gr.addColorStop(o, col); g.fillStyle = gr; g.beginPath(); g.arc(c, cy2, rad, 0, TAU); g.fill(); }
function rock(g, size, base, flat = 1) {
  const r = size / 2, n = 7 + (rnd() * 3 | 0), pts = [];
  for (let i = 0; i < n; i++) { const a = i / n * TAU + rr(-.3, .3), d = r * rr(.6, .9); pts.push([r + Math.cos(a) * d, r + Math.sin(a) * d * flat]); }
  g.beginPath(); pts.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.closePath();
  const gr = g.createLinearGradient(0, 0, size, size); gr.addColorStop(0, shade(base, 45)); gr.addColorStop(.55, base); gr.addColorStop(1, shade(base, -50));
  g.fillStyle = gr; g.fill(); g.lineWidth = Math.max(1.5, size / 30); g.strokeStyle = '#3a2a1c'; g.stroke();
  g.fillStyle = 'rgba(255,255,255,.3)'; g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); g.lineTo(r, r); g.lineTo(pts[n - 1][0], pts[n - 1][1]); g.closePath(); g.fill();
}
function puff(g, size, n) { const r = size / 2; for (let i = 0; i < n; i++) { const a = i / n * TAU, d = r * .26, x = r + Math.cos(a) * d * rr(.3, 1), y = r + Math.sin(a) * d * rr(.3, 1); radial(g, 0, [[0, 'rgba(255,255,255,.55)'], [.7, 'rgba(235,235,235,.25)'], [1, 'rgba(220,220,220,0)']], r * .6, x, y); } }
function shade(hex, amt) { const n = parseInt(hex.slice(1), 16), f = v => clamp(v + amt, 0, 255); return `rgb(${f(n >> 16)},${f(n >> 8 & 255)},${f(n & 255)})`; }
function buildMats() { for (const k of MAT_KEYS) { if (matFromArt.has(k)) continue; const [, size, draw, h] = MATS[k]; const c = mk(size, h || size); draw(c.getContext('2d')); mat[k] = c; } }
// 그림 71이 들어온 재료만 불러온다(ARENA_ART에 이름이 있을 때만 → 없는 그림을 묻지 않음)
function loadMatArt() {
  return Promise.all(MAT_KEYS.filter(k => ARENA_ART.has('mat-' + k)).map(k => new Promise(res => {
    const im = new Image(); im.decoding = 'async';
    im.onload = () => { const c = mk(im.width, im.height); c.getContext('2d').drawImage(im, 0, 0); mat[k] = c; matFromArt.add(k); res(); };
    im.onerror = res; im.src = `/assets/arena/mat-${k}.webp`;
  })));
}
function tint(k, rgb) {
  const key = k + '|' + rgb; let c = tintCache.get(key); if (c) return c;
  const src = mat[k]; c = mk(src.width, src.height); const g = c.getContext('2d');
  g.drawImage(src, 0, 0);
  if (MATS[k][0] === 'luma') { g.globalCompositeOperation = 'source-in'; g.fillStyle = `rgb(${rgb})`; g.fillRect(0, 0, c.width, c.height); }
  else { g.globalCompositeOperation = 'saturation'; g.fillStyle = '#808080'; g.fillRect(0, 0, c.width, c.height); if (rgb !== '255,255,255') { g.globalCompositeOperation = 'multiply'; g.fillStyle = `rgb(${rgb})`; g.fillRect(0, 0, c.width, c.height); } g.globalCompositeOperation = 'destination-in'; g.drawImage(src, 0, 0); }
  tintCache.set(key, c); return c;
}
const ART_ADJ = { glow: [.55, .8], burst: [.8, .9], ring: [.85, 1], ember: [1, 3.2], stardust: [.9, 1.3], star: [.85, 1] };
const adj = k => matFromArt.has(k) ? ART_ADJ[k] || [1, 1] : [1, 1];
const EL_RGB = { star: '255,226,90', flame: '255,130,50', ice: '140,215,255', toxic: '200,110,255', water: '80,180,255', leaf: '140,230,90', spirit: '120,220,255' };

/* ---------- 하늘 다리 테마: 하늘 · 구름 바다는 화면 크기마다 한 번 그린 그림 1장 ---------- */
let sky;
const THEME = { skyTop: '#3f7fe0', skyMid: '#8cc3ff', horizon: '#e9f3ff', sea: '#f4f0ff', seaDeep: '#b9b4ef', roadA: [236, 205, 150], roadB: [222, 186, 124], rail: '#f6d36a', railDark: '#b8862d', fog: [226, 238, 255] };
function buildSky() {
  sky = mk(cvs.width, cvs.height); const g = sky.getContext('2d'), W = sky.width, H = sky.height;
  let lg = g.createLinearGradient(0, 0, 0, HZ); lg.addColorStop(0, THEME.skyTop); lg.addColorStop(.7, THEME.skyMid); lg.addColorStop(1, THEME.horizon); g.fillStyle = lg; g.fillRect(0, 0, W, HZ + 1);
  radial(g, 0, [[0, 'rgba(255,252,230,1)'], [.15, 'rgba(255,240,190,.7)'], [1, 'rgba(255,240,190,0)']], W * .45, W * .72, HZ * .5);
  lg = g.createLinearGradient(0, HZ, 0, H); lg.addColorStop(0, THEME.horizon); lg.addColorStop(.25, THEME.sea); lg.addColorStop(1, THEME.seaDeep); g.fillStyle = lg; g.fillRect(0, HZ, W, H - HZ);
  const s0 = rnd;
  // 먼 구름 띠(소실점 근처) + 구름 바다 무늬(아래로 갈수록 크게)
  for (let i = 0; i < 26; i++) { const x = rr(-.1, 1.1) * W, y = HZ - rr(0, HZ * .35), r = rr(.04, .1) * W; radial(g, 0, [[0, 'rgba(255,255,255,.85)'], [1, 'rgba(255,255,255,0)']], r, x, y); }
  for (let i = 0; i < 46; i++) { const t = rr(0, 1), y = HZ + t * t * (H - HZ), x = rr(-.1, 1.1) * W, r = (.03 + t * .16) * W; radial(g, 0, [[0, 'rgba(255,255,255,.7)'], [.6, 'rgba(248,246,255,.35)'], [1, 'rgba(240,238,255,0)']], r, x, y); }
  void s0;
}

/* ---------- 그림: 정령 · 펫 · 바위 · 문 · 톱날 · 망치 · 수정 · 성 · 대포 ---------- */
const SPR = {};
const PET = { key: 'dragon', name: '드래곤', el: 'flame', skill: '화염 돌파!' };
const img = {};
function loadImg(k, src) { return new Promise(res => { const im = new Image(); im.decoding = 'async'; im.onload = () => { img[k] = im; res(); }; im.onerror = res; im.src = src; }); }
function shrink(im, px) { let src = im, w = im.width, h = im.height; while (w / 2 > px * 1.2) { const c = mk(w / 2, h / 2); c.getContext('2d').drawImage(src, 0, 0, w / 2, h / 2); src = c; w /= 2; h /= 2; } const out = mk(px, px * h / w); out.getContext('2d').drawImage(src, 0, 0, out.width, out.height); return out; }
function whiteOf(c) { const w = mk(c.width, c.height), g = w.getContext('2d'); g.drawImage(c, 0, 0); g.globalCompositeOperation = 'source-in'; g.fillStyle = '#fff'; g.fillRect(0, 0, w.width, w.height); return w; }
// 정령(임시 코드 그림): 물방울 몸 · 꼬리 불꽃 · 눈. 그림 74(spirit-*)가 오면 바꾼다.
function spiritSprite(px, body = ['#e8fbff', '#7fd8ff', '#2f86d8'], flame = '#bff3ff') {
  const c = mk(px, px), g = c.getContext('2d'), s = px / 64;
  g.scale(s, s);
  g.fillStyle = flame; g.beginPath(); g.moveTo(32, 3); g.bezierCurveTo(40, 14, 46, 22, 44, 30); g.lineTo(20, 30); g.bezierCurveTo(18, 22, 26, 14, 32, 3); g.fill();
  const gr = g.createRadialGradient(26, 30, 3, 32, 38, 26); gr.addColorStop(0, body[0]); gr.addColorStop(.55, body[1]); gr.addColorStop(1, body[2]);
  g.fillStyle = gr; g.strokeStyle = '#174a86'; g.lineWidth = 2.6; g.beginPath(); g.moveTo(32, 12); g.bezierCurveTo(50, 22, 56, 36, 54, 46); g.bezierCurveTo(52, 58, 12, 58, 10, 46); g.bezierCurveTo(8, 36, 14, 22, 32, 12); g.closePath(); g.fill(); g.stroke();
  g.fillStyle = 'rgba(255,255,255,.75)'; g.beginPath(); g.ellipse(22, 30, 5, 8, -.5, 0, TAU); g.fill();
  g.fillStyle = '#10213f'; for (const x of [25, 39]) { g.beginPath(); g.ellipse(x, 41, 3.4, 4.6, 0, 0, TAU); g.fill(); }
  g.fillStyle = '#fff'; for (const x of [26.2, 40.2]) { g.beginPath(); g.arc(x, 39.4, 1.3, 0, TAU); g.fill(); }
  g.fillStyle = 'rgba(255,120,160,.5)'; for (const x of [19, 45]) { g.beginPath(); g.ellipse(x, 47, 3.6, 2, 0, 0, TAU); g.fill(); }
  return c;
}
function buildSprites() {
  // 정령 그림은 화면에 보일 크기(가까운 줄 ≈ 30 CSS px)로 한 번 만들어 둔다: 큰 그림을 매번 줄여 찍으면 CPU 캔버스에서 무겁다.
  const sp = Math.round(30 * S);
  SPR.spirit = spiritSprite(sp); SPR.spiritW = whiteOf(SPR.spirit); SPR.spiritGold = spiritSprite(sp, ['#fff8d8', '#ffd25a', '#d38a12'], '#fff1a8');
  const sh = mk(64, 32), sg = sh.getContext('2d'), gr = sg.createRadialGradient(32, 16, 0, 32, 16, 32); gr.addColorStop(0, 'rgba(40,40,80,.4)'); gr.addColorStop(1, 'rgba(40,40,80,0)'); sg.setTransform(1, 0, 0, .5, 0, 8); sg.fillStyle = gr; sg.fillRect(0, -16, 64, 64); SPR.shadow = sh;
  SPR.pet = img.pet ? shrink(img.pet, Math.round(96 * S)) : null; SPR.petW = SPR.pet && whiteOf(SPR.pet);
  SPR.petBig = img.pet ? shrink(img.pet, Math.round(Math.min(cssW * .8, 300) * S)) : null;
  SPR.mon = img.mon ? shrink(img.mon, Math.round(64 * S)) : null;
  // 바위(숫자 장애물)
  SPR.rock = mk(160 * S, 150 * S); { const g = SPR.rock.getContext('2d'); g.scale(S * 160 / 128, S * 150 / 128); rock(g, 128, '#9b8b78', .92); g.fillStyle = 'rgba(255,240,200,.25)'; g.beginPath(); g.ellipse(46, 40, 20, 10, -.4, 0, TAU); g.fill(); }
  SPR.rockW = whiteOf(SPR.rock);
  // 문 판(좋은 문 파랑 · 나쁜 문 빨강)
  for (const [k, c1, c2, edge] of [['gateGood', 'rgba(70,170,255,.62)', 'rgba(40,120,240,.35)', '#bfe6ff'], ['gateBad', 'rgba(255,90,100,.62)', 'rgba(220,40,70,.35)', '#ffc4c4']]) {
    const w = 200, h = 150, c = mk(w, h), g = c.getContext('2d');
    const lg = g.createLinearGradient(0, 0, 0, h); lg.addColorStop(0, c1); lg.addColorStop(1, c2); g.fillStyle = lg; roundRect(g, 4, 4, w - 8, h - 8, 14); g.fill();
    g.lineWidth = 6; g.strokeStyle = edge; g.stroke();
    g.fillStyle = 'rgba(255,255,255,.28)'; roundRect(g, 14, 12, w - 28, 22, 10); g.fill();
    SPR[k] = c;
  }
  // 톱날
  SPR.saw = mk(128, 128); { const g = SPR.saw.getContext('2d'); g.translate(64, 64); g.fillStyle = '#d7dde6'; g.strokeStyle = '#3b4250'; g.lineWidth = 3; g.beginPath(); for (let i = 0; i < 16; i++) { const a = i / 16 * TAU; g.lineTo(Math.cos(a) * 60, Math.sin(a) * 60); g.lineTo(Math.cos(a + .2) * 46, Math.sin(a + .2) * 46); } g.closePath(); g.fill(); g.stroke(); const r2 = g.createRadialGradient(-10, -10, 4, 0, 0, 44); r2.addColorStop(0, '#ffffff'); r2.addColorStop(1, '#8b96a8'); g.fillStyle = r2; g.beginPath(); g.arc(0, 0, 40, 0, TAU); g.fill(); g.fillStyle = '#e04848'; g.beginPath(); g.arc(0, 0, 12, 0, TAU); g.fill(); g.stroke(); }
  // 망치 머리
  SPR.hammer = mk(160, 110); { const g = SPR.hammer.getContext('2d'); const lg = g.createLinearGradient(0, 0, 0, 110); lg.addColorStop(0, '#ffcf6b'); lg.addColorStop(1, '#a8621a'); g.fillStyle = lg; g.strokeStyle = '#4a2a08'; g.lineWidth = 5; roundRect(g, 6, 8, 148, 94, 18); g.fill(); g.stroke(); g.fillStyle = 'rgba(255,255,255,.35)'; roundRect(g, 18, 16, 124, 18, 9); g.fill(); g.fillStyle = '#7a4410'; for (const x of [40, 80, 120]) { g.beginPath(); g.arc(x, 66, 7, 0, TAU); g.fill(); } }
  // 난간 기둥
  SPR.post = mk(40, 120); { const g = SPR.post.getContext('2d'); const lg = g.createLinearGradient(0, 0, 40, 0); lg.addColorStop(0, '#fff3c2'); lg.addColorStop(.5, THEME.rail); lg.addColorStop(1, THEME.railDark); g.fillStyle = lg; g.fillRect(10, 20, 20, 100); g.beginPath(); g.arc(20, 18, 15, 0, TAU); g.fill(); g.fillStyle = 'rgba(255,255,255,.8)'; g.beginPath(); g.arc(15, 13, 5, 0, TAU); g.fill(); }
  // 떠 있는 구름 섬(길 양옆을 지나감)
  SPR.cloud = mk(256, 140); { const g = SPR.cloud.getContext('2d'); for (const [x, y, r] of [[70, 80, 50], [120, 62, 62], [180, 82, 48], [140, 96, 52], [92, 100, 44]]) radial(g, 0, [[0, '#ffffff'], [.75, 'rgba(250,248,255,.95)'], [1, 'rgba(235,232,255,0)']], r, x, y); }
  buildCrystal(); buildCastle(); buildCannon(); buildDigits();
  SPR.text = new Map();
}
function roundRect(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
// 수정 감옥(안에 내가 가진 펫). 펫 그림 위에 반투명 면 · 테두리 · 반짝
function buildCrystal() {
  const W = 200 * S, H = 240 * S, c = mk(W, H), g = c.getContext('2d');
  g.scale(S, S);
  const shape = [[100, 6], [176, 70], [160, 200], [100, 234], [40, 200], [24, 70]];
  const path = () => { g.beginPath(); shape.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.closePath(); };
  path(); g.fillStyle = 'rgba(120,210,255,.35)'; g.fill();
  if (img.pet) g.drawImage(img.pet, 40, 70, 120, 120 * img.pet.height / img.pet.width);
  path(); const lg = g.createLinearGradient(24, 0, 176, 240); lg.addColorStop(0, 'rgba(230,250,255,.55)'); lg.addColorStop(.5, 'rgba(120,200,255,.25)'); lg.addColorStop(1, 'rgba(60,120,220,.5)'); g.fillStyle = lg; g.fill();
  g.lineWidth = 5; g.strokeStyle = '#e8fbff'; g.stroke(); g.lineWidth = 2; g.strokeStyle = 'rgba(40,110,200,.8)';
  g.beginPath(); g.moveTo(100, 6); g.lineTo(100, 234); g.moveTo(24, 70); g.lineTo(100, 110); g.lineTo(176, 70); g.moveTo(40, 200); g.lineTo(100, 110); g.lineTo(160, 200); g.stroke();
  g.fillStyle = 'rgba(255,255,255,.6)'; g.beginPath(); g.moveTo(44, 74); g.lineTo(96, 18); g.lineTo(80, 96); g.closePath(); g.fill();
  SPR.crystal = c; SPR.crystalW = whiteOf(c);
}
// 성(공성전 목표): 탑 3개 · 성문 · 깃발. 피해에 따라 금을 성 그림에 구워 넣는다(그림 1장 그대로).
const CASTLE_PX = { w: 300, h: 300 };
let castleBase;
function buildCastle() {
  const W = CASTLE_PX.w * S, H = CASTLE_PX.h * S, c = mk(W, H), g = c.getContext('2d'); g.scale(S, S);
  const stone = (x, y, w, h, top) => { const lg = g.createLinearGradient(x, 0, x + w, 0); lg.addColorStop(0, '#d9d1c4'); lg.addColorStop(.5, '#bdb2a1'); lg.addColorStop(1, '#8f8474'); g.fillStyle = lg; g.fillRect(x, y, w, h); g.strokeStyle = '#4c4236'; g.lineWidth = 3; g.strokeRect(x, y, w, h); g.strokeStyle = 'rgba(76,66,54,.45)'; g.lineWidth = 1.5; for (let yy = y + 14; yy < y + h; yy += 14) { g.beginPath(); g.moveTo(x, yy); g.lineTo(x + w, yy); g.stroke(); for (let xx = x + ((yy / 14) % 2 ? 10 : 22); xx < x + w; xx += 24) { g.beginPath(); g.moveTo(xx, yy - 14); g.lineTo(xx, yy); g.stroke(); } } if (top) for (let xx = x; xx < x + w - 4; xx += 16) { g.fillStyle = '#c9bfae'; g.fillRect(xx, y - 12, 10, 12); g.strokeStyle = '#4c4236'; g.lineWidth = 2.5; g.strokeRect(xx, y - 12, 10, 12); } };
  stone(50, 110, 200, 180, true);
  stone(10, 60, 70, 230, true); stone(220, 60, 70, 230, true); stone(115, 30, 70, 120, true);
  for (const [x, y] of [[45, 40], [255, 40], [150, 10]]) { g.fillStyle = '#6b4b2a'; g.fillRect(x - 2, y - 40, 4, 44); g.fillStyle = '#ff5a6a'; g.beginPath(); g.moveTo(x + 2, y - 40); g.lineTo(x + 34, y - 30); g.lineTo(x + 2, y - 20); g.fill(); }
  g.fillStyle = '#3a2614'; g.beginPath(); g.moveTo(115, 290); g.lineTo(115, 215); g.arc(150, 215, 35, Math.PI, 0); g.lineTo(185, 290); g.fill();
  g.strokeStyle = '#8a6a3a'; g.lineWidth = 4; for (let x = 124; x < 182; x += 12) { g.beginPath(); g.moveTo(x, 290); g.lineTo(x, 196 + Math.abs(x - 150) * .6); g.stroke(); }
  for (const [x, y] of [[45, 120], [255, 120], [150, 70], [45, 200], [255, 200]]) { g.fillStyle = '#20263a'; g.beginPath(); g.moveTo(x - 7, y + 18); g.lineTo(x - 7, y); g.arc(x, y, 7, Math.PI, 0); g.lineTo(x + 7, y + 18); g.fill(); g.fillStyle = 'rgba(255,210,120,.8)'; g.fillRect(x - 3, y + 2, 6, 10); }
  castleBase = c; SPR.castle = mk(W, H); SPR.castle.getContext('2d').drawImage(c, 0, 0); SPR.castleW = whiteOf(c);
}
function crackCastle(level) {
  const g = SPR.castle.getContext('2d'); g.save(); g.scale(S, S); g.globalCompositeOperation = 'source-atop'; g.strokeStyle = 'rgba(40,28,18,.85)'; g.lineCap = 'round';
  for (let i = 0; i < 4 + level * 3; i++) { let x = rr(30, 270), y = rr(60, 270); g.lineWidth = rr(1.5, 3.5); g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 6; k++) { x += rr(-14, 14); y += rr(4, 16); g.lineTo(x, y); } g.stroke(); }
  g.restore();
}
function buildCannon() {
  const c = mk(140 * S, 120 * S), g = c.getContext('2d'); g.scale(S, S);
  g.save(); g.translate(70, 64); g.rotate(-.2); const lg = g.createLinearGradient(-22, 0, 22, 0); lg.addColorStop(0, '#5b6a8a'); lg.addColorStop(.45, '#a9b8d8'); lg.addColorStop(1, '#2f3a54'); g.fillStyle = lg; g.strokeStyle = '#141a2a'; g.lineWidth = 3; roundRect(g, -20, -58, 40, 72, 10); g.fill(); g.stroke(); g.fillStyle = '#ffd25a'; g.fillRect(-21, -50, 42, 7); g.fillStyle = '#141a2a'; g.beginPath(); g.ellipse(0, -58, 15, 6, 0, 0, TAU); g.fill(); g.restore();
  for (const x of [34, 106]) { const r = g.createRadialGradient(x - 4, 92, 2, x, 96, 22); r.addColorStop(0, '#e9b56a'); r.addColorStop(1, '#7a4a1a'); g.fillStyle = r; g.strokeStyle = '#3a2208'; g.lineWidth = 3; g.beginPath(); g.arc(x, 96, 20, 0, TAU); g.fill(); g.stroke(); g.fillStyle = '#3a2208'; g.beginPath(); g.arc(x, 96, 5, 0, TAU); g.fill(); }
  SPR.cannon = c;
}
// 숫자 아틀라스: 0~9를 모양마다 한 장(아레나 buildDigits와 같은 방식). +, ×, −는 10 · 11 · 12번 칸.
const NUM_STYLES = {
  count: { size: 30, fill: ['#ffffff', '#d8f3ff'], stroke: '#123a6b', lw: 6 },
  rock: { size: 30, fill: ['#ffffff', '#fff1d0'], stroke: '#3a2614', lw: 6 },
  good: { size: 44, fill: ['#ffffff', '#d6f1ff'], stroke: '#0d3f86', lw: 8 },
  bad: { size: 44, fill: ['#ffffff', '#ffe0e0'], stroke: '#7a1020', lw: 8 },
  pop: { size: 34, fill: ['#fff7b0', '#ffc53a'], stroke: '#5a2c00', lw: 7 },
  minus: { size: 30, fill: ['#ffe0e0', '#ff6a6a'], stroke: '#4a0a10', lw: 6 }
};
const GLYPHS = '0123456789+×−';
function buildDigits() {
  SPR.digits = {};
  for (const [k, st] of Object.entries(NUM_STYLES)) {
    const fs = st.size * S, cw = Math.ceil(fs * .78), ch = Math.ceil(fs * 1.3), c = mk(cw * GLYPHS.length, ch), g = c.getContext('2d');
    g.font = `${fs}px Jua, system-ui, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
    const gr = g.createLinearGradient(0, ch * .2, 0, ch * .8); gr.addColorStop(0, st.fill[0]); gr.addColorStop(1, st.fill[1]);
    for (let d = 0; d < GLYPHS.length; d++) { const x = d * cw + cw / 2, y = ch / 2; g.lineWidth = st.lw * S; g.strokeStyle = st.stroke; g.strokeText(GLYPHS[d], x, y); g.fillStyle = gr; g.fillText(GLYPHS[d], x, y); }
    SPR.digits[k] = { c, cw, ch, adv: cw * .74 };
  }
}
// 숫자 찍기(가운데 정렬, sc = 배율). str은 GLYPHS 글자만.
function drawNum(style, str, x, y, sc = 1, a = 1) {
  const A = SPR.digits[style], w = A.adv * str.length * sc; ctx.globalAlpha = a;
  for (let d = 0; d < str.length; d++) { const v = GLYPHS.indexOf(str[d]); if (v < 0) continue; ctx.drawImage(A.c, v * A.cw, 0, A.cw, A.ch, x - w / 2 + d * A.adv * sc - (A.cw - A.adv) * sc / 2, y - A.ch * sc / 2, A.cw * sc, A.ch * sc); }
  ctx.globalAlpha = 1;
}
const PILL_COLOR = { star: '#ffd84a', flame: '#ff7a3a', ice: '#7fd4ff', spirit: '#7fd8ff' };
function textSprite(text, kind, el = 'star') {
  const key = kind + '|' + el + '|' + text; let s = SPR.text.get(key); if (s) return s;
  const fs = { pill: 16, banner: 40, cut: 46, big: 54 }[kind] * S;
  const m = mk(4, 4).getContext('2d'); m.font = `${fs}px Jua, system-ui, sans-serif`; const tw = m.measureText(text).width;
  const padX = 12 * S, w = Math.ceil(tw + padX * 2), h = Math.ceil(fs * 1.7);
  const c = mk(w, h), g = c.getContext('2d'); g.font = m.font; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
  if (kind === 'pill') { roundRect(g, 2 * S, 3 * S, w - 4 * S, h - 6 * S, (h - 6 * S) / 2); g.fillStyle = 'rgba(16,20,40,.88)'; g.fill(); g.lineWidth = 2 * S; g.strokeStyle = PILL_COLOR[el] || '#fff'; g.stroke(); g.fillStyle = '#fff'; g.fillText(text, w / 2, h / 2 + S); }
  else { const gr = g.createLinearGradient(0, h * .2, 0, h * .8); gr.addColorStop(0, '#ffffff'); gr.addColorStop(1, PILL_COLOR[el] || '#ffd84a'); g.lineWidth = 9 * S; g.strokeStyle = '#141a33'; g.strokeText(text, w / 2, h / 2); g.fillStyle = gr; g.fillText(text, w / 2, h / 2); }
  s = { c, w, h }; SPR.text.set(key, s); return s;
}
function starSprite(px, on) {
  const c = mk(px, px), g = c.getContext('2d'); g.translate(px / 2, px / 2); g.beginPath();
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = (i % 2 ? .42 : 1) * px * .46; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); } g.closePath();
  const gr = g.createLinearGradient(0, -px / 2, 0, px / 2); if (on) { gr.addColorStop(0, '#fff6b0'); gr.addColorStop(1, '#ffae1a'); } else { gr.addColorStop(0, '#5a6080'); gr.addColorStop(1, '#2a2f48'); }
  g.fillStyle = gr; g.fill(); g.lineJoin = 'round'; g.lineWidth = px * .06; g.strokeStyle = on ? '#6a3a00' : '#141828'; g.stroke(); return c;
}

/* ---------- 규칙(판 씨앗으로 만든 맵 + 고정 틱 20Hz) — 서버가 조종 기록으로 똑같이 다시 돌리는 부분 ---------- */
// 무리 = 숫자 N 하나 + 가운데 cx. 정령 하나하나는 연출이라 규칙에 없다. 폭(반지름)은 N으로 정한다(그리는 수와 무관 → 품질이 달라도 결과 같음).
const TICK = 50, DT = TICK / 1000;
const RUN_SPEED = 10, STEER_SPEED = 10;
const crowdR = n => Math.min(3, .4 + .21 * Math.sqrt(Math.min(n, 150)));
const GATE_FN = { '+': (n, v) => n + v, '×': (n, v) => n * v, '−': (n, v) => Math.max(0, n - v) };
const good = op => op !== '−';
let S0 = null;              // 규칙 상태
let track = [];
function makeTrack() {
  // 시험용 고정 맵(스테이지 12 하늘 다리 정도). 실제 앱은 스테이지 번호 · 오늘의 도전 날짜로 맵 생성기가 만든다(구성안 4장).
  const t = [];
  const gate = (z, l, r) => t.push({ type: 'gate', z, l, r, done: false });
  const rockAt = (z, x, hp) => t.push({ type: 'rock', z, x, hp, max: hp, r: .95, done: false, hitT: 0 });
  const saw = (z, x0, amp, sp) => t.push({ type: 'saw', z, x0, amp, sp, x: x0, r: .8, hitCd: 0 });
  const hammer = (z, x, ph) => t.push({ type: 'hammer', z, x, ph, a: 0, prevA: 0 });
  gate(14, ['+', 10], ['×', 2]);
  rockAt(27, -1.6, 22); rockAt(29, 1.8, 28);
  saw(39, 0, 2.6, 1.6);
  gate(50, ['−', 6], ['×', 3]);
  t.push({ type: 'card', z: 58, cards: [['정령 +20', 'add', 20], ['사격 ×1.5', 'fire', 1.5], ['방패', 'shield', .5]], pick: 0, done: false });
  rockAt(68, -2.3, 40); rockAt(70, 0, 55); rockAt(68, 2.3, 40);
  hammer(80, -1.5, 0); hammer(84, 1.5, Math.PI);
  gate(94, ['+', 30], ['−', 20]);
  saw(104, 0, 2.8, 2.1);
  gate(114, ['×', 2], ['+', 15]);
  t.push({ type: 'card', z: 121, cards: [['정령 +30', 'add', 30], ['대포 위력 ×2', 'power', 2], ['사격 ×1.5', 'fire', 1.5]], pick: 1, done: false });
  rockAt(130, -1.8, 120); rockAt(132, 1.8, 90);
  t.push({ type: 'crystal', z: 144, x: 0, hp: 140, max: 140, r: 1.3, done: false, hitT: 0 });
  rockAt(154, -2, 260); rockAt(156, 0, 300); rockAt(154, 2, 260);
  gate(168, ['+', 50], ['×', 2]);
  t.push({ type: 'end', z: 180 });
  return t;
}
function resetSim() {
  simRnd = mulberry(SEED);
  track = makeTrack();
  S0 = { tick: 0, z: 0, pz: 0, cx: 0, pcx: 0, tx: 0, n: 12, phase: 'run', fire: 1, power: 1, shield: 1, pet: false, castle: { z: 204, hp: 420, max: 420, down: false }, startN: 0, pour: false, pourAcc: 0, stars: 0, holdT: 0 };
  resetCrowd();
}
// 한 틱(50ms). 입력은 목표 좌우(tx) · 대포 누름(pour)뿐 → 서버는 이 두 값을 틱마다 기록한 것으로 같은 결과를 낸다.
function simTick() {
  const s = S0; s.tick++; s.pz = s.z; s.pcx = s.cx;
  if (s.phase === 'run') {
    const R = crowdR(s.n);
    s.cx += clamp(s.tx - s.cx, -STEER_SPEED * DT, STEER_SPEED * DT); s.cx = clamp(s.cx, -ROAD + R * .6, ROAD - R * .6);
    const z0 = s.z; s.z += RUN_SPEED * DT;
    // 자동 사격: 앞 26단위 안, 무리 폭과 겹치는 가장 가까운 바위 · 수정에 틱마다 피해(사격 세기 = 무리 수에 비례)
    //   무리는 폭 전체로 쏘므로, 가장 가까운 줄(앞뒤 3단위 안)에서 무리 폭과 겹치는 것은 모두 같은 피해를 받는다.
    let near = 1e9;
    for (const o of track) if ((o.type === 'rock' || o.type === 'crystal') && !o.done && o.z > s.z && o.z < s.z + 26 && Math.abs(o.x - s.cx) < R + o.r) near = Math.min(near, o.z);
    if (near < 1e9) { const dmg = (.6 + Math.min(s.n, 400) * .028) * s.fire;
      for (const o of track) if ((o.type === 'rock' || o.type === 'crystal') && !o.done && o.z < near + 3 && o.z > s.z && Math.abs(o.x - s.cx) < R + o.r) { o.hp -= dmg; onShoot(o, dmg); if (o.hp <= 0) { o.done = true; o.hp = 0; o.type === 'crystal' ? onRescue(o) : onRockBreak(o); } } }
    for (const o of track) {
      if (o.type === 'gate' && !o.done && z0 < o.z && s.z >= o.z) { o.done = true; const side = s.cx < 0 ? o.l : o.r, before = s.n; s.n = GATE_FN[side[0]](s.n, side[1]); onGate(o, s.cx < 0 ? -1 : 1, side, before, s.n); }
      else if (o.type === 'rock' && !o.done && s.z + R * .6 >= o.z && Math.abs(o.x - s.cx) < R * .6 + o.r * .8) { const loss = Math.min(s.n, Math.ceil(o.hp)); o.done = true; s.n -= loss; onRockCrash(o, loss); }
      else if (o.type === 'crystal' && !o.done && s.z + R * .6 >= o.z && Math.abs(o.x - s.cx) < R * .6 + o.r * .8) { const loss = Math.min(s.n, Math.ceil(o.hp * .5)); o.done = true; s.n -= loss; onRockCrash(o, loss); }
      else if (o.type === 'saw') { o.x = o.x0 + Math.sin(s.tick * DT * o.sp) * o.amp; if (o.hitCd > 0) o.hitCd--; else if (Math.abs(o.z - s.z) < R * .7 + o.r && Math.abs(o.x - s.cx) < R * .8 + o.r) { const loss = Math.min(s.n, Math.ceil((1 + s.n * .03) * s.shield)); s.n -= loss; o.hitCd = 3; onHazard(o.x, o.z, loss, 'saw'); } }
      else if (o.type === 'hammer') { o.prevA = o.a; o.a = Math.sin(s.tick * DT * 2.4 + o.ph) * 1.25; if (Math.sign(o.a) !== Math.sign(o.prevA) && Math.abs(o.z - s.z) < R * .7 + .9 && Math.abs(o.x - s.cx) < R * .8 + .8) { const loss = Math.min(s.n, Math.ceil((2 + s.n * .08) * s.shield)); s.n -= loss; onHazard(o.x, o.z, loss, 'hammer'); } }
      else if (o.type === 'card' && !o.done && s.z >= o.z) { o.done = true; s.phase = 'card'; s.card = o; onCard(o); }
      else if (o.type === 'end' && s.z >= o.z) { s.phase = 'siege'; s.startN = s.n; onSiege(); }
    }
    if (s.n <= 0 && s.phase === 'run') { s.phase = 'result'; s.stars = 0; onResult(); }
  } else if (s.phase === 'siege') {
    const c = s.castle;
    if (s.pour && s.n > 0 && !c.down) {
      // 누르고 있는 동안 초당 (20 + N × 0.06)마리가 성으로. 한 마리 = 대포 위력만큼 성 HP를 깎는다(도착 시간은 연출).
      s.pourAcc += (20 + s.n * .06) * DT; let k = Math.min(s.n, s.pourAcc | 0); s.pourAcc -= k;
      if (k > 0) { s.n -= k; c.hp = Math.max(0, c.hp - k * s.power); onPour(k); s.holdT++; }
      if (c.hp <= 0) { c.down = true; const left = s.n / Math.max(1, s.startN); s.stars = left >= .25 ? 3 : left >= .1 ? 2 : 1; onCastleDown(); }
    }
    if (!c.down && s.n <= 0) { s.phase = 'result'; s.stars = 0; onResult(); }
  }
}
function applyCard(o, i) { const [, kind, v] = o.cards[i], s = S0; if (kind === 'add') { const b = s.n; s.n += v; onGain(b, s.n, 0, s.z + 2); } else if (kind === 'fire') s.fire *= v; else if (kind === 'power') s.power *= v; else if (kind === 'shield') s.shield = v; s.phase = 'run'; }

/* ---------- 무리 연출: 그리는 칸(슬롯) 상한 T.draw, 나머지는 숫자 ---------- */
const DRAW_MAX = 150;
const SOX = new Float32Array(DRAW_MAX), SOZ = new Float32Array(DRAW_MAX), TOX = new Float32Array(DRAW_MAX), TOZ = new Float32Array(DRAW_MAX), POP = new Float32Array(DRAW_MAX), PH = new Float32Array(DRAW_MAX);
for (let i = 0; i < DRAW_MAX; i++) { const r = .22 * Math.sqrt(i + .5), a = i * 2.39996; TOX[i] = Math.cos(a) * r; TOZ[i] = Math.sin(a) * r * .85; PH[i] = (i * 0.618 % 1) * TAU; }
const ORDER = Array.from({ length: DRAW_MAX }, (_, i) => i).sort((a, b) => TOZ[b] - TOZ[a]);   // 먼 것부터(뒤에서 앞으로)
let shown = 0;             // 지금 그리는 수
const visCount = () => Math.min(S0.n, T.draw);
function resetCrowd() { shown = 0; syncCrowd(0, 0); }
function syncCrowd(fromX, fromZ) {
  const want = visCount();
  if (want > shown) { for (let i = shown; i < want; i++) { SOX[i] = fromX; SOZ[i] = fromZ; POP[i] = 0; } }
  else if (want < shown) { for (let i = want; i < shown; i++) flyer(S0.cx + SOX[i], .4, S0.z + SOZ[i], 0); }
  shown = want;
}

/* ---------- 효과 저장소: 정해진 크기의 풀(3D) ---------- */
const DMAX = 300, SMAX = 72, KMAX = 260, GMAX = 240, FMAX = 100, BMAX = 60;
const pool = (n, keys) => { const o = { n: 0 }; for (const k of keys) o[k] = new Float32Array(n); return o; };
const DKEYS = ['x', 'y', 'z', 'vx', 'vy', 'vz', 'rot', 'vr', 'life', 'max', 'size', 'kind'];
const MKEYS = ['x', 'y', 'z', 'r', 'vr', 'vx', 'vy', 'vz', 'life', 'max', 'a', 'kind'];
const KKEYS = ['x', 'y', 'z', 'vx', 'vy', 'vz', 'life', 'max', 'len', 'col'];
const GKEYS = ['x', 'y', 'z', 'vx', 'vy', 'vz', 'life', 'max', 'size', 'kind', 'up', 'rot'];
const FKEYS = ['x', 'y', 'z', 'vx', 'vy', 'vz', 'life', 'max', 'rot', 'vr', 'kind'];
const BKEYS = ['x', 'y', 'z', 'vx', 'vy', 'vz', 'life'];
const D = pool(DMAX, DKEYS), M = pool(SMAX, MKEYS), K = pool(KMAX, KKEYS), G = pool(GMAX, GKEYS), FL = pool(FMAX, FKEYS), B = pool(BMAX, BKEYS);
const DEB_MAT = [['rock-a', 'rock-b'], ['shard']];
const PUFF = [['dust', '235,225,205'], ['smoke', '255,255,255'], ['dust', '200,185,160'], ['smoke', '120,110,130']];
const SPARK_COL = ['#ffffff', '#ffe066', '#ff8a3a', '#8fe0ff'];
const GLOW_MAT = [['ember', '255,190,90'], ['flame', '255,255,255'], ['stardust', '255,255,255'], ['star', '255,255,255'], ['ember', '120,220,255']];
function swapOut(A, j, last, keys) { for (const k of keys) A[k][j] = A[k][last]; }
function addDebris(x, y, z, n, kind = 0, power = 1) {
  n = Math.round(n * T.mult);
  for (let i = 0; i < n; i++) { if (D.n >= T.debris) return; const j = D.n++, a = rnd() * TAU, sp = rr(.2, 1) * 7 * power;
    D.x[j] = x + rr(-.3, .3); D.y[j] = y + rr(0, .4); D.z[j] = z + rr(-.3, .3); D.vx[j] = Math.cos(a) * sp; D.vz[j] = Math.sin(a) * sp * .8 - rr(0, 4) * power; D.vy[j] = rr(4, 11) * power;
    D.rot[j] = rnd() * TAU; D.vr[j] = rr(-12, 12); D.max[j] = D.life[j] = rr(1, 1.8); D.size[j] = rr(.18, .5); D.kind[j] = kind; }
}
function addSmoke(x, y, z, n, kind = 0, r = .8, spread = 1) {
  n = Math.max(1, Math.round(n * T.mult));
  for (let i = 0; i < n; i++) { if (M.n >= T.smoke) return; const j = M.n++, a = rnd() * TAU, d = rr(0, spread);
    M.x[j] = x + Math.cos(a) * d; M.y[j] = y + rr(0, .5); M.z[j] = z + Math.sin(a) * d; M.r[j] = r * rr(.6, 1.2); M.vr[j] = r * rr(.8, 1.6); M.vx[j] = Math.cos(a) * rr(.5, 2); M.vy[j] = rr(.3, 1.4); M.vz[j] = Math.sin(a) * rr(.5, 2); M.max[j] = M.life[j] = rr(.9, 1.8); M.a[j] = rr(.5, .85); M.kind[j] = kind; }
}
function addSparks(x, y, z, n, col = 0, speed = 12, len = .5) {
  n = Math.round(n * T.mult);
  for (let i = 0; i < n; i++) { if (K.n >= T.sparks) return; const j = K.n++, a = rnd() * TAU, b = rr(-.3, 1.2), sp = speed * rr(.35, 1);
    K.x[j] = x; K.y[j] = y; K.z[j] = z; K.vx[j] = Math.cos(a) * Math.cos(b) * sp; K.vz[j] = Math.sin(a) * Math.cos(b) * sp; K.vy[j] = Math.sin(b) * sp; K.max[j] = K.life[j] = rr(.2, .45); K.len[j] = len * rr(.6, 1.3); K.col[j] = col; }
}
function addGlow(x, y, z, n, kind, speed = 3, size = .6, life = .6, up = 0) {
  n = Math.max(1, Math.round(n * T.mult));
  for (let i = 0; i < n; i++) { if (G.n >= T.glows) return; const j = G.n++, a = rnd() * TAU, sp = speed * rr(.3, 1);
    G.x[j] = x + rr(-.2, .2); G.y[j] = y + rr(-.2, .2); G.z[j] = z; G.vx[j] = Math.cos(a) * sp; G.vz[j] = Math.sin(a) * sp; G.vy[j] = rr(-.5, 1) * sp * .5; G.max[j] = G.life[j] = life * rr(.6, 1.2); G.size[j] = size * rr(.6, 1.3); G.kind[j] = kind; G.up[j] = up; G.rot[j] = rnd() * TAU; }
}
// 날아가는 정령: kind 0 = 잃음(밖으로 튕겨 사라짐), 1 = 대포로 성까지(포물선, max초에 도착)
function flyer(x, y, z, kind, tx = 0, ty = 0, tz = 0, dur = .9) {
  if (FL.n >= T.fly) return; const j = FL.n++;
  FL.x[j] = x; FL.y[j] = y; FL.z[j] = z; FL.kind[j] = kind; FL.rot[j] = 0; FL.vr[j] = rr(-10, 10);
  if (kind) { FL.vx[j] = (tx - x) / dur; FL.vz[j] = (tz - z) / dur; FL.vy[j] = (ty - y) / dur + 9.8 * dur / 2 * 1.6; FL.max[j] = FL.life[j] = dur; }
  else { const a = rr(-.9, .9) + (x > S0.cx ? 0 : Math.PI); FL.vx[j] = Math.cos(a) * rr(3, 7); FL.vz[j] = rr(-3, 3); FL.vy[j] = rr(5, 9); FL.max[j] = FL.life[j] = rr(.7, 1); }
}
function shoot(x, z, tx, ty, tz) { if (B.n >= T.shots) return; const j = B.n++, d = Math.hypot(tx - x, tz - z) || 1, sp = 42; B.x[j] = x; B.y[j] = .7; B.z[j] = z; B.vx[j] = (tx - x) / d * sp; B.vz[j] = (tz - z) / d * sp; B.vy[j] = (ty - .7) / d * sp; B.life[j] = d / sp; }

/* ---------- 큰 효과 · 글자 ---------- */
let rings = [], flashes = [], texts = [], pops = [], fx = [], banner = null, cutin = null, pieces = [], stars = null;
const MAX_RINGS = 14, MAX_FLASH = 20, MAX_TEXTS = 8, MAX_POPS = 10, MAX_FX = 8;
let hitstop = 0;
function ring(x, y, z, r1, dur, rgb, delay = 0) { if (rings.length < MAX_RINGS) rings.push({ x, y, z, r1, dur, rgb, t: -delay }); }
function flash(x, y, z, r, dur, rgb = '255,255,255', k = 'glow', delay = 0) { if (flashes.length < MAX_FLASH) flashes.push({ x, y, z, r, dur, k, img: rgb === '255,255,255' && k !== 'glow' ? mat[k] : tint(k, rgb), t: -delay }); }
function popNum(style, str, x, y, z) { if (pops.length >= MAX_POPS) pops.shift(); pops.push({ style, str, x, y, z, t: 0 }); }
function pill(text, el = 'spirit', dur = 1.4) { if (texts.length >= MAX_TEXTS) texts.shift(); texts.push({ text, el, t: 0, dur }); }
function shake(v) { cam.trauma = Math.min(1, cam.trauma + v); }
const tintEl = $('#tint'), vigEl = $('#vig'), flashEl = $('#flash');
let tintT = 0;
function screenTint(el, a = .16) { tintEl.style.background = `rgb(${EL_RGB[el] || '255,255,255'})`; tintEl.style.transition = 'none'; tintEl.style.opacity = a; tintT = .12; }
function whiteFlash(a) { flashEl.style.transition = 'none'; flashEl.style.opacity = Math.min(.85, a); requestAnimationFrame(() => { flashEl.style.transition = 'opacity .3s ease-out'; flashEl.style.opacity = 0; }); }
function invertFlash() { cvs.classList.add('inv'); setTimeout(() => cvs.classList.remove('inv'), 70); }
let clock = 0, timers = [];
function later(s, fn) { timers.push({ at: clock + s, fn }); }

/* ---------- 규칙 사건 → 연출(소리 · 효과). 서버에는 없는 쪽 ---------- */
let shotT = 0;
function onShoot(tgt) {
  tgt.hitT = .08;
  if ((shotT -= DT) > 0) return; shotT = .05;
  const n = Math.min(3, 1 + (S0.n / 80 | 0));
  for (let i = 0; i < n; i++) { const k = (rnd() * Math.max(1, shown)) | 0; shoot(S0.cx + SOX[k], S0.z + SOZ[k] + .4, tgt.x + rr(-.4, .4), .9, tgt.z - .6); }
  sfx('shot', .7);
}
function onRockBreak(o) {
  sfx('boom', .55); shake(.18);
  addDebris(o.x, .5, o.z, 22, 0, 1.1); addSmoke(o.x, .2, o.z, 5, 0, .9, .8); addSparks(o.x, .8, o.z, 14, 1, 13); addGlow(o.x, .8, o.z, 6, 0, 4, .5, .5, 2);
  flash(o.x, .8, o.z, 2.2, .3); flash(o.x, .8, o.z, 1.6, .25, '255,255,255', 'burst'); ring(o.x, .2, o.z, 2.6, .4, '255,240,200');
}
function onRockCrash(o, loss) {
  log(`충돌 ${o.type} −${loss}`);
  sfx('boom', .8); sfx('down', .6); shake(.45); whiteFlash(.25);
  addDebris(o.x, .5, o.z, 26, o.type === 'crystal' ? 1 : 0, 1.2); addSmoke(o.x, .2, o.z, 8, 2, 1, 1);
  popNum('minus', '−' + loss, S0.cx, 2.4, S0.z + 1);
  for (let i = 0; i < Math.min(14, loss); i++) { const k = (rnd() * Math.max(1, shown)) | 0; flyer(S0.cx + SOX[k], .4, S0.z + SOZ[k], 0); }
  syncCrowd(0, 0);
}
function onHazard(x, z, loss, kind) {
  log(`${kind} −${loss}`);
  sfx(kind === 'saw' ? 'saw' : 'boom', kind === 'saw' ? 1 : .6); shake(kind === 'saw' ? .15 : .4);
  addSparks(x, .6, z, kind === 'saw' ? 12 : 8, 1, 14); if (kind === 'hammer') { addSmoke(x, 0, z, 6, 0, 1, 1.2); ring(x, .1, z, 2.4, .35, '255,240,210'); }
  popNum('minus', '−' + loss, x, 1.8, z);
  for (let i = 0; i < Math.min(10, loss); i++) { let best = 0, bd = 1e9; for (let t = 0; t < 4; t++) { const k = (rnd() * Math.max(1, shown)) | 0, d = Math.abs(S0.cx + SOX[k] - x); if (d < bd) { bd = d; best = k; } } flyer(S0.cx + SOX[best], .4, S0.z + SOZ[best], 0); }
  syncCrowd(0, 0);
}
function onGate(o, side, op, before, after) {
  log(`문 ${op[0]}${op[1]} ${before}→${after}`);
  const gx = side * ROAD / 2, ok = good(op[0]);
  o.passed = side; o.passT = 0;
  sfx(ok ? 'up' : 'down'); if (ok) screenTint('spirit', .12); else shake(.25);
  flash(gx, 1.2, o.z, 3.4, .35, ok ? '140,210,255' : '255,120,120'); ring(gx, .3, o.z, 3.2, .45, ok ? '170,230,255' : '255,150,150');
  addGlow(gx, 1.2, o.z, 14, ok ? 4 : 0, 4, .6, .7, 1.5);
  if (after > before) onGain(before, after, gx - S0.cx, 1); else { popNum('minus', '−' + (before - after), S0.cx, 2.4, S0.z + 1); for (let i = 0; i < Math.min(16, before - after); i++) { const k = (rnd() * Math.max(1, shown)) | 0; flyer(S0.cx + SOX[k], .4, S0.z + SOZ[k], 0); } syncCrowd(0, 0); }
}
function onGain(before, after, fromX, fromZ) {
  popNum('pop', '+' + (after - before), S0.cx, 2.6, S0.z + 1.5);
  syncCrowd(fromX, fromZ);
  for (let i = 0; i < 4; i++) later(i * .07, () => sfx('pop', .8));
  addGlow(S0.cx, 1, S0.z, 10, 2, 3, .5, .6, 1);
}
const cardsEl = $('#cards');
function onCard(o) {
  vigEl.classList.add('ult'); sfx('charge', .5);
  cardsEl.innerHTML = o.cards.map(([t], i) => `<button class="card" data-i="${i}"><b>${t}</b><small>${['정령', '강화', '보호', '대포'][['add', 'fire', 'shield', 'power'].indexOf(o.cards[i][1])] || ''}</small></button>`).join('');
  cardsEl.classList.add('on');
  if (autoSteer) later(1.3, () => pickCard(o.pick));
}
function pickCard(i) {
  if (S0.phase !== 'card') return;
  const b = cardsEl.querySelectorAll('.card')[i]; b?.classList.add('picked'); sfx('star', .7);
  setTimeout(() => { cardsEl.classList.remove('on'); vigEl.classList.remove('ult'); }, 260);
  applyCard(S0.card, i); pill(S0.card.cards[i][0] + '!', 'star', 1.2);
}
cardsEl.addEventListener('click', e => { const b = e.target.closest('.card'); if (b) pickCard(Number(b.dataset.i)); });
let rescueT = 0;
function onRescue(o) {
  log('구출');
  // 수정이 깨짐 → 컷인(규칙 시간 멈춤 1초) → 펫이 무리 앞에 합류 → 아레나 속성 필살기(화염 돌파: 앞 바위를 불길이 쓸어 감)
  sfx('ice', 1.2); sfx('boom', .7); shake(.6); whiteFlash(.5);
  addDebris(o.x, 1.2, o.z, 40, 1, 1.4); addGlow(o.x, 1.4, o.z, 16, 3, 5, .9, .7, 2); flash(o.x, 1.4, o.z, 4, .5, '160,230,255'); ring(o.x, .3, o.z, 4, .5, '200,240,255');
  S0.phase = 'rescue'; rescueT = 1.1;
  cutin = { t: 0, dur: 1.05, name: PET.name + ' 구출!', sub: PET.skill, el: PET.el }; sfx('ult'); vigEl.classList.add('ult');
  later(1.1, () => { vigEl.classList.remove('ult'); S0.pet = true; petSkill(); });
}
function petSkill() {
  // 규칙: 무리 앞 40단위 안의 바위를 모두 깬다(숫자 하나 → 서버도 같은 판정). 연출: 불길 벽이 앞으로 달려간다.
  sfx('fire', 1.2); screenTint('flame', .2); shake(.5);
  const z0 = S0.z + 1;
  for (const o of track) if (o.type === 'rock' && !o.done && o.z < z0 + 40) { o.done = true; const d = (o.z - z0) / 40; later(d * 1, () => onRockBreak(o)); }
  fx.push({ t: 0, dur: 1, z0, draw(dt) { const wz = this.z0 + this.t * 40; for (let i = 0; i < 3; i++) addGlow(rr(-ROAD, ROAD), rr(.2, 1.4), wz, 1, 1, 1.5, rr(1, 1.8), .45, 3); if (rnd() < .4) addSmoke(rr(-ROAD, ROAD), .3, wz - 1, 1, 3, 1, .5); } });
}
let siegeT = 0;
function onSiege() {
  siegeT = 0; sfx('charge', .8); pill('공성전! 누르고 있으면 정령 발사', 'star', 2.2);
  syncCrowd(0, 0);
  later(1, () => { if (S0.pet) { // 펫 필살기 한 방(성 HP의 15%)
    const c = S0.castle; sfx('fire', 1.2); sfx('boom', .9); screenTint('flame', .22); shake(.6); whiteFlash(.35);
    c.hp = Math.max(1, c.hp - Math.round(c.max * .15)); onCastleHit(c.max * .15, true);
    for (let i = 0; i < 8; i++) later(i * .04, () => addGlow(rr(-3, 3), rr(1, 6), c.z - 1, 2, 1, 3, rr(1.6, 2.4), .6, 2));
  } });
}
let castleCracks = 0, castleHitT = 0;
function onPour(k) {
  const c = S0.castle; sfx('cannon', .5); sfx('pop', .5);
  const vis = Math.min(3, k);
  for (let i = 0; i < vis; i++) flyer(S0.cx + rr(-.3, .3), 2, S0.z + crowdR(S0.n) + 1.2, 1, rr(-2.5, 2.5), rr(1.5, 5), c.z - 1, rr(.55, .75));
  cam.punch += .006;
  syncCrowd(0, 0);
}
function onCastleHit(dmg, big) {
  const c = S0.castle; castleHitT = .08;
  const level = c.hp / c.max < .33 ? 2 : c.hp / c.max < .66 ? 1 : 0; if (level > castleCracks) { castleCracks = level; crackCastle(level); addDebris(rr(-3, 3), 6, c.z, 12, 0, .8); sfx('boom', .6); shake(.3); }
  if (big) { flash(0, 4, c.z - 1, 7, .5, '255,180,90'); addDebris(0, 4, c.z - 1, 20, 0, 1); popNum('pop', '−' + Math.round(dmg), 0, 9, c.z); }
}
function onCastleDown() {
  const c = S0.castle;
  sfx('boom', 1.3); later(.18, () => sfx('boom', 1)); invertFlash(); whiteFlash(.8); shake(1); hitstop = .12; cam.punch += .08;
  flash(0, 4, c.z, 10, .7); flash(0, 4, c.z, 14, 1, '255,214,140');
  for (let i = 0; i < 3; i++) ring(0, .2, c.z, 7 + i * 3, .6 + i * .15, i ? '255,230,180' : '255,255,255', i * .08);
  addDebris(0, 3, c.z, 120, 0, 1.6); addSmoke(0, .5, c.z, 26, 0, 2.2, 5); addSmoke(0, 3, c.z, 10, 2, 2, 3); addSparks(0, 4, c.z, 40, 1, 18, .8); addGlow(0, 4, c.z, 30, 2, 8, 1, 1.2, 1);
  // 성 그림을 6×5 조각으로 나눠 무너뜨린다(조각 30개 고정)
  const cols = 6, rows = 5; pieces = [];
  for (let r = 0; r < rows; r++) for (let q = 0; q < cols; q++) pieces.push({ sx: q / cols, sy: r / rows, x: (q + .5) / cols * 10 - 5, y: 10 - (r + .5) / rows * 10, z: c.z, vx: rr(-2, 2) + ((q + .5) / cols - .5) * 4, vy: rr(1, 5) + (rows - r) * .4, vz: rr(-3, 1), rot: 0, vr: rr(-2, 2), t: 0 });
  if (SPR.mon) for (const mx of [-3.2, 3.2]) pieces.push({ mon: true, x: mx, y: 9, z: c.z - .4, vx: mx * .8, vy: 6, vz: -2, rot: 0, vr: rr(-6, 6), t: 0 });
  later(1.4, onResult);
}
let resultT = -1;
function onResult() {
  log(`끝 별${S0.stars} 남음${S0.n}`);
  S0.phase = 'result'; resultT = 0; const n = S0.stars;
  banner = { text: n ? '성 함락!' : '정령이 모두 쓰러졌어요', t: 0, dur: 3.2 };
  stars = { n, t: 0, left: S0.n };
  for (let i = 0; i < n; i++) later(.35 + i * .3, () => { sfx('star'); whiteFlash(.12); });
  later(3.6, restart);
}
function restart() {
  stats.cycles++; banner = null; stars = null; cutin = null; pieces = []; timers = []; fx = []; rings = []; flashes = []; pops = []; texts = [];
  D.n = M.n = K.n = G.n = FL.n = B.n = 0; castleCracks = 0; { const g = SPR.castle.getContext('2d'); g.clearRect(0, 0, SPR.castle.width, SPR.castle.height); g.drawImage(castleBase, 0, 0); }
  resetSim(); cam.back = 8.5; cam.z = S0.z - cam.back; cam.h = 8; cam.zoom = 1; resultT = -1; siegeT = 0;
}

/* ---------- 조종: 좌우로 끌기(자동 조종은 시연 · 측정용) ---------- */
let drag = null, manualT = 0;
cvs.addEventListener('pointerdown', e => {
  unlockSound();
  if (S0.phase === 'siege') { S0.pour = true; manualT = 6; return; }
  drag = { x: e.clientX, tx: S0.tx }; manualT = 6;
});
addEventListener('pointermove', e => { if (!drag) return; S0.tx = clamp(drag.tx + (e.clientX - drag.x) / cssW * ROAD * 2.4, -ROAD, ROAD); manualT = 6; });
addEventListener('pointerup', () => { drag = null; if (S0.phase === 'siege' && manualT > 0) S0.pour = false; });
function autoPilot(dt) {
  manualT -= dt; if (!autoSteer || manualT > 0) return;
  const s = S0;
  if (s.phase === 'siege') { s.pour = siegeT > 1.6; return; }
  if (s.phase !== 'run') return;
  let want = 0;
  for (const o of track) {
    if (o.z < s.z - .5 || o.z > s.z + 20) continue;
    if (o.type === 'gate' && !o.done) { const l = GATE_FN[o.l[0]](s.n, o.l[1]), r = GATE_FN[o.r[0]](s.n, o.r[1]); want = l > r ? -ROAD / 2 : ROAD / 2; break; }
    if ((o.type === 'rock' || o.type === 'crystal') && !o.done) { want = o.x; break; }
    if (o.type === 'saw') { want = o.x > 0 ? -2.4 : 2.4; break; }
    if (o.type === 'hammer') { want = o.x > 0 ? -2.6 : 2.6; if (Math.abs(o.z - s.z) > 6) continue; break; }
  }
  s.tx = want;
}

/* ---------- 그리기 ---------- */
const stats = { frames: 0, debrisMax: 0, smokeMax: 0, sparksMax: 0, glowsMax: 0, flyMax: 0, drawnMax: 0, crowdMax: 0, fxMax: 0, heals: 0, cycles: 0, tierDrops: 0, tierLog: [], matArt: 0, cutins: 0 };
window.__fx = stats;
// 사건 기록(최근 40개만, 측정 · 확인용)
function log(t) { const L = stats.events ||= []; L.push(`${clock.toFixed(1)}s ${t}`); if (L.length > 40) L.shift(); }
function render(dt, alpha) {
  const fdt = hitstop > 0 ? 0 : dt, s = S0;
  const z = lerp(s.pz, s.z, alpha), cx = lerp(s.pcx, s.cx, alpha);
  // 카메라: 달리기 = 무리 뒤 9단위 · 높이 7, 공성전 = 조금 뒤로 · 위로 · 당겨서 성까지 한 화면
  const siege = s.phase === 'siege' || (s.phase === 'result' && s.castle.down);
  const tb = siege ? 11 : 8.5, th = siege ? 9 : 8, tzm = siege ? 1.3 : 1, k = 1 - Math.exp(-dt * 2.5);
  cam.back += (tb - cam.back) * k; cam.h += (th - cam.h) * k; cam.zoom += (tzm - cam.zoom) * k;
  cam.z = z - cam.back; cam.x += (cx * .35 - cam.x) * (1 - Math.exp(-dt * 4));
  cam.punch = Math.min(cam.punch, .15) * Math.exp(-dt * 7); cam.trauma = Math.max(0, cam.trauma - dt * 1.6);
  const shk = cam.trauma * cam.trauma * .35, tt = performance.now() / 1000;
  const saveX = cam.x, saveH = cam.h; cam.x += shk * Math.sin(tt * 71); cam.h += shk * Math.sin(tt * 89 + 1) * .6;

  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  ctx.drawImage(sky, 0, 0);
  drawClouds();
  drawRoad();
  // 물체: 먼 것부터(화가 순서). 무리 · 펫 · 대포는 무리의 z에서 한 덩어리로.
  const objs = [];
  for (const o of track) if (o.z > cam.z + 1 && o.z < cam.z + 95 && o.type !== 'card' && o.type !== 'end') objs.push(o);
  if (siege || s.phase === 'siege') objs.push({ type: 'castle', z: s.castle.z });
  objs.push({ type: 'crowd', z: z + .01, cx });
  objs.sort((a, b) => b.z - a.z);
  for (const o of objs) drawObj(o, fdt, cx, z);
  drawSmoke(fdt); drawDebris(fdt); drawFlyers(fdt); drawBullets(fdt);
  drawRings(fdt); drawFlashes(fdt); drawGlows(fdt); drawSparks(fdt);
  for (let i = fx.length - 1; i >= 0; i--) { const f = fx[i]; f.draw(fdt); f.t += fdt; if (f.t >= f.dur) fx.splice(i, 1); }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  drawPops(fdt); drawTexts(dt); drawCutin(dt); drawBanner(dt); drawStars(dt);
  cam.x = saveX; cam.h = saveH;
  hitstop = Math.max(0, hitstop - dt);
  if (tintT > 0) { tintT -= dt; if (tintT <= 0) { tintEl.style.transition = 'opacity .5s ease-out'; tintEl.style.opacity = 0; } }
  stats.debrisMax = Math.max(stats.debrisMax, D.n); stats.smokeMax = Math.max(stats.smokeMax, M.n); stats.sparksMax = Math.max(stats.sparksMax, K.n); stats.glowsMax = Math.max(stats.glowsMax, G.n); stats.flyMax = Math.max(stats.flyMax, FL.n);
  stats.drawnMax = Math.max(stats.drawnMax, shown); stats.crowdMax = Math.max(stats.crowdMax, s.n); stats.fxMax = Math.max(stats.fxMax, fx.length + rings.length + flashes.length);
}
// 길 양옆 아래를 지나가는 구름 섬(z 15단위마다 하나, 위치는 번호로 정함 → 저장 없음)
function drawClouds() {
  const k0 = Math.floor((cam.z + 4) / 15), ord = [];
  for (let k = k0 + 7; k >= k0; k--) for (const sd of [-1, 1]) { const h = Math.sin(k * 12.9898 + sd * 78.233) * 43758.5453, f = h - Math.floor(h); ord.push([sd * (7 + f * 9), -2.5 - f * 2.5, k * 15 + f * 6, 3 + f * 3]); }
  ctx.globalAlpha = .95;
  for (const [x, y, zz, w] of ord) if (proj(x, y, zz)) { const ww = w * PS; ctx.drawImage(SPR.cloud, PX - ww / 2, PY - ww * .3, ww, ww * .55); }
  ctx.globalAlpha = 1;
}
// 다리 길: 3단위 판자 줄을 먼 것부터 사각형으로(줄무늬가 흘러 달리는 느낌). 멀수록 하늘색으로 흐려진다.
function drawRoad() {
  const z0 = Math.floor((cam.z + 1) / 3) * 3, far = 90, rail = .35;
  for (let zz = z0 + far; zz >= z0; zz -= 3) {
    const za = Math.max(zz, cam.z + .8), zb = zz + 3; if (zb <= za) continue;
    if (!proj(-ROAD - rail, 0, zb)) continue; const lxB = PX, yB = PY, sB = PS; proj(ROAD + rail, 0, zb); const rxB = PX;
    proj(-ROAD - rail, 0, za); const lxA = PX, yA = PY, sA = PS; proj(ROAD + rail, 0, za); const rxA = PX;
    const fog = clamp((zz - cam.z) / far, 0, 1) * .85, base = (Math.floor(zz / 3) & 1) ? THEME.roadA : THEME.roadB;
    const col = `rgb(${lerp(base[0], THEME.fog[0], fog) | 0},${lerp(base[1], THEME.fog[1], fog) | 0},${lerp(base[2], THEME.fog[2], fog) | 0})`;
    // 난간(금색 띠) → 길
    ctx.fillStyle = fog > .6 ? '#e8e2d0' : THEME.rail; ctx.beginPath(); ctx.moveTo(lxB, yB); ctx.lineTo(rxB, yB); ctx.lineTo(rxA, yA); ctx.lineTo(lxA, yA); ctx.fill();
    const iB = rail * sB, iA = rail * sA;
    ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(lxB + iB, yB); ctx.lineTo(rxB - iB, yB); ctx.lineTo(rxA - iA, yA); ctx.lineTo(lxA + iA, yA); ctx.fill();
    // 판자 이음새 한 줄
    ctx.fillStyle = `rgba(120,80,40,${.25 * (1 - fog)})`; ctx.fillRect(lxB + iB, yB, rxB - lxB - iB * 2, Math.max(1, .05 * sB));
  }
  // 다리 밑면(두께): 가장 가까운 줄 아래 짙은 띠
  // 난간 기둥(6단위마다, 품질별 개수)
  const p0 = Math.ceil((cam.z + 1.5) / 6) * 6;
  for (let i = T.posts - 1; i >= 0; i--) { const zz = p0 + i * 6; for (const sd of [-1, 1]) if (proj(sd * (ROAD + .18), 0, zz)) { const w = .45 * PS, h = 1.3 * PS; ctx.drawImage(SPR.post, PX - w / 2, PY - h, w, h); } }
}
function drawObj(o, dt, cx, z) {
  if (o.type === 'gate') return drawGate(o, dt);
  if (o.type === 'rock') return drawRock(o, dt);
  if (o.type === 'saw') { if (!proj(o.x, .75, o.z)) return; const r = o.r * PS; // 레일 + 톱날
    const y0 = PY; proj(-ROAD, .05, o.z); const lx = PX, ly = PY; proj(ROAD, .05, o.z); ctx.fillStyle = 'rgba(60,60,80,.55)'; ctx.fillRect(lx, ly - .06 * PS, PX - lx, .12 * PS); proj(o.x, .75, o.z);
    ctx.save(); ctx.translate(PX, y0); ctx.rotate(clock * 14); ctx.drawImage(SPR.saw, -r, -r, r * 2, r * 2); ctx.restore(); return; }
  if (o.type === 'hammer') { const L = 3, ang = lerp(o.prevA, o.a, .5); if (!proj(o.x, 4.2, o.z)) return; const px = PX, py = PY; proj(o.x + Math.sin(ang) * L, 4.2 - Math.cos(ang) * L, o.z); const hx = PX, hy = PY, s2 = PS;
    ctx.strokeStyle = '#6b4520'; ctx.lineWidth = .22 * s2; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(hx, hy); ctx.stroke();
    ctx.fillStyle = '#4a3a2a'; ctx.beginPath(); ctx.arc(px, py, .25 * s2, 0, TAU); ctx.fill();
    ctx.save(); ctx.translate(hx, hy); ctx.rotate(ang); const w = 1.8 * s2, h = 1.2 * s2; ctx.drawImage(SPR.hammer, -w / 2, -h / 2, w, h); ctx.restore(); return; }
  if (o.type === 'crystal') { if (o.done || !proj(o.x, 0, o.z)) return; const w = 2.6 * PS, h = w * 1.2, bob = Math.sin(clock * 2) * .1 * PS, wob = o.hitT > 0 ? rr(-.05, .05) * PS : 0;
    ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = .5 + .2 * Math.sin(clock * 4); const gl = tint('glow', '140,220,255'); ctx.drawImage(gl, PX - w, PY - h * 1.05, w * 2, w * 2); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(SPR.crystal, PX - w / 2 + wob, PY - h + bob, w, h);
    if (o.hitT > 0) { o.hitT -= dt; ctx.globalAlpha = .5; ctx.drawImage(SPR.crystalW, PX - w / 2 + wob, PY - h + bob, w, h); ctx.globalAlpha = 1; }
    drawNum('rock', String(Math.ceil(o.hp)), PX, PY - h - .3 * PS, Math.min(1.4, PS / 40)); return; }
  if (o.type === 'castle') return drawCastle(o, dt);
  if (o.type === 'crowd') return drawCrowd(dt, o.cx, z);
}
function drawGate(o, dt) {
  if (!proj(0, 0, o.z)) return;
  if (o.passed) { o.passT += dt; if (o.passT > .5) return; }
  const fade = o.passed ? 1 - o.passT / .5 : 1;
  for (const [side, val] of [[-1, o.l], [1, o.r]]) {
    const x0 = side < 0 ? -ROAD + .15 : .15, x1 = side < 0 ? -.15 : ROAD - .15;
    proj(x0, 2.6, o.z); const ax = PX, ay = PY; proj(x1, 0, o.z); const bx = PX, by = PY, sc = PS;
    const chosen = o.passed === side, a = (o.passed ? (chosen ? fade : fade * .4) : 1);
    const grow = chosen ? 1 + o.passT * .6 : 1, cxm = (ax + bx) / 2, cym = (ay + by) / 2, w = (bx - ax) * grow, h = (by - ay) * grow;
    ctx.globalAlpha = a; ctx.drawImage(good(val[0]) ? SPR.gateGood : SPR.gateBad, cxm - w / 2, cym - h / 2, w, h);
    drawNum(good(val[0]) ? 'good' : 'bad', val[0] + val[1], cxm, cym, Math.min(1.8, sc / 34) * grow, a);
    ctx.globalAlpha = 1;
  }
  // 가운데 기둥
  proj(0, 2.8, o.z); const tx = PX, ty = PY; proj(0, 0, o.z); ctx.fillStyle = '#f2f6ff'; ctx.fillRect(tx - .1 * PS, ty, .2 * PS, PY - ty);
}
function drawRock(o, dt) {
  if (o.done || !proj(o.x, 0, o.z)) return;
  const w = 2.1 * PS, h = w * 150 / 160, wob = o.hitT > 0 ? rr(-.06, .06) * PS : 0;
  ctx.globalAlpha = .5; ctx.drawImage(SPR.shadow, PX - w * .55, PY - w * .12, w * 1.1, w * .3); ctx.globalAlpha = 1;
  ctx.drawImage(SPR.rock, PX - w / 2 + wob, PY - h * .9, w, h);
  if (o.hitT > 0) { o.hitT -= dt; ctx.globalAlpha = .45; ctx.drawImage(SPR.rockW, PX - w / 2 + wob, PY - h * .9, w, h); ctx.globalAlpha = 1; }
  drawNum('rock', String(Math.ceil(o.hp)), PX, PY - h * .45, Math.min(1.5, PS / 34));
}
function drawCastle(o, dt) {
  const c = S0.castle; if (c.down) return drawPieces(dt);
  if (!proj(0, 0, c.z)) return; const w = 10 * PS, h = w, wob = castleHitT > 0 ? rr(-.05, .05) * PS : 0;
  ctx.drawImage(SPR.castle, PX - w / 2 + wob, PY - h, w, h);
  if (castleHitT > 0) { castleHitT -= dt; ctx.globalAlpha = .35; ctx.drawImage(SPR.castleW, PX - w / 2 + wob, PY - h, w, h); ctx.globalAlpha = 1; }
  if (SPR.mon) { const mw = 1.6 * PS; for (const mx of [-3.2, 3.2]) { proj(mx, 8.6, c.z - .4); ctx.drawImage(SPR.mon, PX - mw / 2, PY - mw + Math.sin(clock * 6 + mx) * .1 * PS, mw, mw); } proj(0, 0, c.z); }
  // HP 막대(성 위)
  proj(0, 11.4, c.z); const bw = 6 * PS, bh = .55 * PS, p = c.hp / c.max;
  ctx.fillStyle = 'rgba(16,20,40,.8)'; roundRect(ctx, PX - bw / 2 - 3, PY - 3, bw + 6, bh + 6, bh / 2 + 3); ctx.fill();
  ctx.fillStyle = p > .5 ? '#6dea7a' : p > .25 ? '#ffd257' : '#ff6262'; roundRect(ctx, PX - bw / 2, PY, Math.max(bh, bw * p), bh, bh / 2); ctx.fill();
  drawNum('count', String(Math.ceil(c.hp)), PX, PY + bh / 2, Math.min(1.1, PS / 30));
}
function drawPieces(dt) {
  const src = SPR.castle, cw = src.width / 6, ch = src.height / 5;
  for (const q of pieces) {
    if (dt) { q.t += dt; q.vy -= 14 * dt; q.x += q.vx * dt; q.y += q.vy * dt; q.z += q.vz * dt; q.rot += q.vr * dt; if (q.y < .6) { q.y = .6; q.vy *= -.25; q.vx *= .6; q.vr *= .5; } }
    const a = q.t > 2 ? Math.max(0, 1 - (q.t - 2) / .8) : 1; if (a <= 0 || !proj(q.x, q.y, q.z)) continue;
    ctx.globalAlpha = a; ctx.save(); ctx.translate(PX, PY); ctx.rotate(q.rot);
    if (q.mon) { const mw = 1.6 * PS; ctx.drawImage(SPR.mon, -mw / 2, -mw / 2, mw, mw); }
    else { const w = 10 / 6 * PS * 1.04, h = 10 / 5 * PS * 1.04; ctx.drawImage(src, q.sx * src.width, q.sy * src.height, cw, ch, -w / 2, -h / 2, w, h); }
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}
function drawCrowd(dt, cx, z) {
  const s = S0, siege = s.phase === 'siege' || (s.phase === 'result' && s.castle.down);
  // 대포(공성전)
  if (siege && proj(cx, 0, z + crowdR(s.n) + .8)) { const w = 2.6 * PS, h = w * 120 / 140; ctx.drawImage(SPR.cannon, PX - w / 2, PY - h * .92, w, h); }
  const run = s.phase === 'run', t = clock;
  const spring = 1 - Math.exp(-dt * 7);
  // 그림자(높음만, 정령 수만큼 그리지 않고 무리 전체 한 장)
  const R = crowdR(s.n);
  if (proj(cx, 0, z)) { const w = (R * 2 + .8) * PS; ctx.globalAlpha = .55; ctx.drawImage(SPR.shadow, PX - w / 2, PY - w * .14, w, w * .32); ctx.globalAlpha = 1; }
  const spr = SPR.spirit, scale = .52;
  for (let oi = 0; oi < DRAW_MAX; oi++) {
    const i = ORDER[oi]; if (i >= shown) continue;
    SOX[i] += (TOX[i] - SOX[i]) * spring; SOZ[i] += (TOZ[i] - SOZ[i]) * spring; if (POP[i] < 1) POP[i] = Math.min(1, POP[i] + dt * 3.5);
    const hop = run ? Math.abs(Math.sin(t * 11 + PH[i])) * .28 : Math.abs(Math.sin(t * 4 + PH[i])) * .1;
    if (!proj(cx + SOX[i], hop, z + SOZ[i])) continue;
    const pp = POP[i], sz = scale * PS * (pp < 1 ? easeOut(pp) * 1.15 : 1), sq = run ? 1 + Math.sin(t * 22 + PH[i]) * .06 : 1;
    ctx.drawImage(spr, PX - sz / 2, PY - sz * sq, sz, sz * sq);
  }
  // 구한 펫: 무리 맨 앞에서 달린다
  if (s.pet && SPR.pet && proj(cx + (siege ? -1.9 : R * .55), Math.abs(Math.sin(t * 8)) * .25, z + R * .5 + .6)) { const w = 2.5 * PS, h = w * SPR.pet.height / SPR.pet.width; ctx.drawImage(SPR.pet, PX - w / 2, PY - h, w, h); }
  // 머리 위 숫자(전체 N)
  if (proj(cx, 1.9 + R * .35, z + R * .3)) {
    const str = String(s.n), sc = Math.min(1.3, PS / 34), A = SPR.digits.count, w = A.adv * str.length * sc + 26 * S * sc, h = A.ch * sc * .9;
    ctx.fillStyle = 'rgba(16,40,90,.78)'; roundRect(ctx, PX - w / 2, PY - h / 2, w, h, h / 2); ctx.fill(); ctx.lineWidth = 2 * S; ctx.strokeStyle = '#9fe1ff'; ctx.stroke();
    ctx.drawImage(spr, PX - w / 2 + 4 * S * sc, PY - h * .42, h * .84, h * .84);
    drawNum('count', str, PX + 10 * S * sc, PY, sc);
  }
}
function drawDebris(dt) {
  for (let j = D.n - 1; j >= 0; j--) { D.life[j] -= dt; if (D.life[j] <= 0) { swapOut(D, j, --D.n, DKEYS); continue; }
    if (dt) { D.vy[j] -= 22 * dt; D.x[j] += D.vx[j] * dt; D.y[j] += D.vy[j] * dt; D.z[j] += D.vz[j] * dt; D.rot[j] += D.vr[j] * dt; if (D.y[j] < 0) { D.y[j] = 0; D.vy[j] *= -.3; D.vx[j] *= .6; D.vz[j] *= .6; D.vr[j] *= .5; } } }
  for (let j = 0; j < D.n; j++) { if (!proj(D.x[j], D.y[j], D.z[j])) continue; const set = DEB_MAT[D.kind[j]], im = mat[set[j % set.length]], s = D.size[j] * PS, c = Math.cos(D.rot[j]), sn = Math.sin(D.rot[j]), iw = s / im.width;
    ctx.globalAlpha = Math.min(1, D.life[j] / .3); ctx.setTransform(c * iw, sn * iw, -sn * iw, c * iw, PX, PY); ctx.drawImage(im, -im.width / 2, -im.height / 2); }
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1;
}
function drawSmoke(dt) {
  for (let j = M.n - 1; j >= 0; j--) { M.life[j] -= dt; if (M.life[j] <= 0) { swapOut(M, j, --M.n, MKEYS); continue; }
    M.x[j] += M.vx[j] * dt; M.y[j] += M.vy[j] * dt; M.z[j] += M.vz[j] * dt; M.vx[j] *= 1 - dt * 1.5; M.vz[j] *= 1 - dt * 1.5; M.r[j] += M.vr[j] * dt; M.vr[j] *= 1 - dt * .8; }
  for (let j = 0; j < M.n; j++) { if (!proj(M.x[j], M.y[j], M.z[j])) continue; const p = 1 - M.life[j] / M.max[j], a = M.a[j] * (p < .15 ? p / .15 : 1 - (p - .15) / .85), r = M.r[j] * PS, [mk2, rgb] = PUFF[M.kind[j]];
    ctx.globalAlpha = a; ctx.drawImage(tint(mk2, rgb), PX - r, PY - r, r * 2, r * 2); }
  ctx.globalAlpha = 1;
}
function drawFlyers(dt) {
  const c = S0.castle;
  for (let j = FL.n - 1; j >= 0; j--) { FL.life[j] -= dt;
    if (FL.life[j] <= 0) { if (FL.kind[j] && !c.down) { // 성에 도착: 작은 불꽃 · 먼지 · 맞음 번쩍
        castleHitT = .06; if (rnd() < .5) addSparks(FL.x[j], FL.y[j], FL.z[j], 3, 3, 8, .4); if (rnd() < .25) addSmoke(FL.x[j], FL.y[j], FL.z[j], 1, 1, .6, .3); if (rnd() < .3) sfx('hit', .5); onCastleHit(0, false); }
      swapOut(FL, j, --FL.n, FKEYS); continue; }
    if (dt) { FL.vy[j] -= (FL.kind[j] ? 15.7 : 18) * dt; FL.x[j] += FL.vx[j] * dt; FL.y[j] += FL.vy[j] * dt; FL.z[j] += FL.vz[j] * dt; FL.rot[j] += FL.vr[j] * dt; } }
  const spr = SPR.spirit;
  for (let j = 0; j < FL.n; j++) { if (!proj(FL.x[j], FL.y[j], FL.z[j])) continue; const sz = .52 * PS, a = FL.kind[j] ? 1 : Math.min(1, FL.life[j] / FL.max[j] * 1.5), c2 = Math.cos(FL.rot[j]), sn = Math.sin(FL.rot[j]), iw = sz / spr.width;
    ctx.globalAlpha = a; ctx.setTransform(c2 * iw, sn * iw, -sn * iw, c2 * iw, PX, PY); ctx.drawImage(FL.kind[j] ? spr : SPR.spiritW, -spr.width / 2, -spr.height / 2); }
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1;
}
function drawBullets(dt) {
  for (let j = B.n - 1; j >= 0; j--) { B.life[j] -= dt; if (B.life[j] <= 0) { addSparks(B.x[j], B.y[j], B.z[j], 2, 1, 7, .3); if (rnd() < .3) sfx('hit', .35); swapOut(B, j, --B.n, BKEYS); continue; }
    B.x[j] += B.vx[j] * dt; B.y[j] += B.vy[j] * dt; B.z[j] += B.vz[j] * dt; }
  if (!B.n) return;
  ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round'; ctx.strokeStyle = '#bff0ff'; ctx.lineWidth = 2.2 * S; ctx.beginPath();
  for (let j = 0; j < B.n; j++) { if (!proj(B.x[j], B.y[j], B.z[j])) continue; const x1 = PX, y1 = PY; if (!proj(B.x[j] - B.vx[j] * .035, B.y[j] - B.vy[j] * .035, B.z[j] - B.vz[j] * .035)) continue; ctx.moveTo(x1, y1); ctx.lineTo(PX, PY); }
  ctx.stroke(); ctx.globalCompositeOperation = 'source-over';
}
function drawGlows(dt) {
  for (let j = G.n - 1; j >= 0; j--) { G.life[j] -= dt; if (G.life[j] <= 0) { swapOut(G, j, --G.n, GKEYS); continue; }
    G.x[j] += G.vx[j] * dt; G.y[j] += G.vy[j] * dt + G.up[j] * dt; G.z[j] += G.vz[j] * dt; G.vx[j] *= 1 - dt * 2; G.vz[j] *= 1 - dt * 2; }
  if (!G.n) return;
  ctx.globalCompositeOperation = 'lighter';
  for (let j = 0; j < G.n; j++) { if (!proj(G.x[j], G.y[j], G.z[j])) continue; const [mk2, rgb] = GLOW_MAT[G.kind[j]], im = rgb === '255,255,255' ? mat[mk2] : tint(mk2, rgb), p = G.life[j] / G.max[j], [ga, gs] = adj(mk2), s = G.size[j] * gs * PS * (G.kind[j] === 1 ? .6 + p * .6 : 1);
    ctx.globalAlpha = Math.min(1, p * 2) * ga; ctx.drawImage(im, PX - s / 2, PY - s / 2, s, s); }
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
}
function drawSparks(dt) {
  for (let j = K.n - 1; j >= 0; j--) { K.life[j] -= dt; if (K.life[j] <= 0) { swapOut(K, j, --K.n, KKEYS); continue; }
    K.vy[j] -= 10 * dt; K.x[j] += K.vx[j] * dt; K.y[j] += K.vy[j] * dt; K.z[j] += K.vz[j] * dt; const d = 1 - 3 * dt; K.vx[j] *= d; K.vz[j] *= d; }
  if (!K.n) return;
  ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round'; ctx.lineWidth = 1.6 * S;
  for (let c = 0; c < SPARK_COL.length; c++) { let any = false; ctx.beginPath();
    for (let j = 0; j < K.n; j++) { if (K.col[j] !== c || !proj(K.x[j], K.y[j], K.z[j])) continue; const x1 = PX, y1 = PY, sp = Math.hypot(K.vx[j], K.vy[j], K.vz[j]) || 1, l = K.len[j] * K.life[j] / K.max[j];
      if (!proj(K.x[j] - K.vx[j] / sp * l, K.y[j] - K.vy[j] / sp * l, K.z[j] - K.vz[j] / sp * l)) continue; any = true; ctx.moveTo(x1, y1); ctx.lineTo(PX, PY); }
    if (any) { ctx.strokeStyle = SPARK_COL[c]; ctx.stroke(); } }
  ctx.globalCompositeOperation = 'source-over';
}
function drawRings(dt) {
  ctx.globalCompositeOperation = 'lighter';
  for (let i = rings.length - 1; i >= 0; i--) { const r = rings[i]; r.t += dt; if (r.t >= r.dur) { rings.splice(i, 1); continue; } if (r.t < 0 || !proj(r.x, r.y, r.z)) continue;
    const p = r.t / r.dur, a = (1 - p) * (1 - p), R = r.r1 * easeOut(p) * PS;
    if (T.glow) { ctx.globalAlpha = a * adj('ring')[0]; const im = tint('ring', r.rgb), s = R * 2 * (256 / 208); ctx.drawImage(im, PX - s / 2, PY - s * .2, s, s * .4); ctx.globalAlpha = 1; }
    else { ctx.strokeStyle = `rgba(${r.rgb},${a})`; ctx.lineWidth = 2 * S; ctx.beginPath(); ctx.ellipse(PX, PY, R, R * .35, 0, 0, TAU); ctx.stroke(); } }
  ctx.globalCompositeOperation = 'source-over';
}
function drawFlashes(dt) {
  ctx.globalCompositeOperation = 'lighter';
  for (let i = flashes.length - 1; i >= 0; i--) { const f = flashes[i]; f.t += dt; if (f.t >= f.dur) { flashes.splice(i, 1); continue; } if (f.t < 0 || !proj(f.x, f.y, f.z)) continue;
    const [ga, gs] = adj(f.k), p = f.t / f.dur, a = (p < .1 ? 1 : 1 - (p - .1) / .9) * ga, r = f.r * gs * (.6 + .4 * easeOut(p)) * PS;
    ctx.globalAlpha = a; ctx.drawImage(f.img, PX - r, PY - r, r * 2, r * 2); }
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
}
function drawPops(dt) {
  for (let i = pops.length - 1; i >= 0; i--) { const n = pops[i]; n.t += dt; if (n.t > 1.1) { pops.splice(i, 1); continue; } if (!proj(n.x, n.y + easeOut(Math.min(1, n.t / .6)) * 1.2, n.z)) continue;
    const t = n.t, pop = t < .1 ? 1.8 - 8 * t : 1, a = t > .8 ? (1.1 - t) / .3 : 1; drawNum(n.style, n.str, PX, PY, pop * Math.min(1.5, PS / 30 + .4), a); }
}
function drawTexts(dt) {
  let y = 118 * S;
  for (let i = texts.length - 1; i >= 0; i--) { const o = texts[i]; o.t += dt; if (o.t > o.dur) { texts.splice(i, 1); continue; }
    const s = textSprite(o.text, 'pill', o.el), a = o.t > o.dur - .2 ? (o.dur - o.t) / .2 : 1, sc = o.t < .12 ? .6 + o.t / .12 * .4 : 1;
    ctx.globalAlpha = a; ctx.drawImage(s.c, cvs.width / 2 - s.w * sc / 2, y - s.h * sc / 2, s.w * sc, s.h * sc); y += s.h; }
  ctx.globalAlpha = 1;
}
// 구출 컷인: 아레나 필살 컷인과 같은 모양(비스듬한 띠 · 속성 색 속도선 · 펫 얼굴이 들어와 멈췄다 빠짐 · 이름)
function drawCutin(dt) {
  if (!cutin) return;
  const c = cutin; c.t += dt; if (c.t > c.dur) { cutin = null; stats.cutins++; return; }
  const W = cvs.width, H = cvs.height, t = c.t / c.dur, cy = H * .4, bh = Math.min(H * .26, 240 * S);
  const open = t < .15 ? easeOut(t / .15) : t > .85 ? 1 - (t - .85) / .15 : 1;
  ctx.save(); ctx.translate(W / 2, cy); ctx.rotate(-.12); ctx.scale(1, open);
  ctx.fillStyle = 'rgba(12,10,30,.92)'; ctx.fillRect(-W, -bh / 2, W * 2, bh);
  ctx.fillStyle = `rgb(${EL_RGB[c.el]})`; ctx.fillRect(-W, -bh / 2, W * 2, 4 * S); ctx.fillRect(-W, bh / 2 - 4 * S, W * 2, 4 * S);
  ctx.globalCompositeOperation = 'lighter';
  const sp = tint('speed', EL_RGB[c.el]);
  for (let i = 0; i < T.cutLines; i++) { const yy = (-.45 + .9 * ((i * .618) % 1)) * bh, len = W * (.5 + ((i * .37) % .5)), xx = W * .9 - ((c.t * 2.6 * W + i * 97 * S) % (W * 2.2)); ctx.globalAlpha = .55; ctx.drawImage(sp, xx, yy - 10 * S, len, 22 * S); }
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  const big = SPR.petBig;
  if (big) { const bw = big.width, slide = t < .3 ? 1 - easeOut(t / .3) : t > .7 ? -easeOut((t - .7) / .3) : 0, bx = slide * W * .9 + bw * .15; ctx.drawImage(big, bx - bw / 2, -bw * .55, bw, bw * big.height / big.width); }
  const s1 = textSprite(c.name, 'cut', 'spirit'), s2 = textSprite(c.sub, 'cut', c.el), sc = t < .25 ? 1.6 - t / .25 * .6 : 1;
  ctx.drawImage(s1.c, -W * .2 - s1.w * sc / 2, -bh * .2 - s1.h * sc / 2, s1.w * sc, s1.h * sc);
  ctx.drawImage(s2.c, -W * .14 - s2.w * sc * .4, bh * .2 - s2.h * sc * .4, s2.w * sc * .8, s2.h * sc * .8);
  ctx.restore();
}
function drawBanner(dt) {
  if (!banner) return;
  banner.t += dt; const b = banner, t = b.t;
  const W = cvs.width, H = cvs.height, cy = H * .3, bh = 70 * S, inP = easeOut(Math.min(1, t / .22));
  ctx.save(); ctx.translate((1 - inP) * -W, 0);
  const gr = ctx.createLinearGradient(0, 0, W, 0); gr.addColorStop(0, 'rgba(10,8,22,0)'); gr.addColorStop(.18, 'rgba(10,8,22,.86)'); gr.addColorStop(.82, 'rgba(10,8,22,.86)'); gr.addColorStop(1, 'rgba(10,8,22,0)');
  ctx.fillStyle = gr; ctx.fillRect(0, cy - bh / 2, W, bh); ctx.fillStyle = '#ffd25a'; ctx.fillRect(W * .12, cy - bh / 2, W * .76, 3 * S); ctx.fillRect(W * .12, cy + bh / 2 - 3 * S, W * .76, 3 * S);
  const s = textSprite(b.text, 'banner'), sc = t < .3 ? 1.25 - (t / .3) * .25 : 1; ctx.drawImage(s.c, W / 2 - s.w * sc / 2, cy - s.h * sc / 2, s.w * sc, s.h * sc);
  ctx.restore();
}
let starOn, starOff;
function drawStars(dt) {
  if (!stars) return; stars.t += dt;
  const W = cvs.width, H = cvs.height, cy = H * .42, px = 72 * S;
  if (!starOn || starOn.width !== Math.ceil(px)) { starOn = starSprite(px, true); starOff = starSprite(px, false); }
  for (let i = 0; i < 3; i++) { const x = W / 2 + (i - 1) * px * 1.15, y = cy - (i === 1 ? 14 * S : 0), on = i < stars.n, at = .35 + i * .3, t = stars.t - at;
    ctx.drawImage(starOff, x - px / 2, y - px / 2, px, px);
    if (on && t > 0) { const sc = t < .15 ? 2 - t / .15 : 1; ctx.drawImage(starOn, x - px * sc / 2, y - px * sc / 2, px * sc, px * sc);
      if (t < .5) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 1 - t / .5; const g = mat.star, r = px * (1 + t * 2); ctx.drawImage(g, x - r, y - r, r * 2, r * 2); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; } } }
  if (stars.t > 1.3) { const s = textSprite(`남은 정령 ${stars.left}`, 'pill', 'spirit'); ctx.drawImage(s.c, W / 2 - s.w / 2, cy + px * .8); }
}

/* ---------- 고리: 고정 틱 + 보간, 자동 품질 ---------- */
let last = 0, acc = 0, paused = false, frameLog = [], lastTierCheck = 0;
function frame(now) {
  requestAnimationFrame(frame);
  if (!last) { last = now; return; }
  let dt = (now - last) / 1000; last = now;
  if (paused) return;
  frameLog.push(dt * 1000);
  if (dt > .2) (stats.stalls ||= []).push(`${clock.toFixed(1)}s/${Math.round(dt * 1000)}ms/${S0.phase}`);
  dt = Math.min(dt, .1);
  const fdt = hitstop > 0 ? 0 : dt;
  clock += fdt; stats.t = clock;
  for (let i = timers.length - 1; i >= 0; i--) if (clock >= timers[i].at) { const f = timers[i].fn; timers.splice(i, 1); f(); }
  if (FX_ON) autoPilot(dt);
  if (S0.phase === 'rescue') { rescueT -= dt; if (rescueT <= 0) S0.phase = 'run'; }
  if (S0.phase === 'siege') siegeT += dt;
  if (FX_ON && (S0.phase === 'run' || S0.phase === 'siege')) { acc += dt * 1000; let steps = 0; while (acc >= TICK && steps < 5) { simTick(); acc -= TICK; steps++; } if (steps === 5) acc = 0; }
  else { S0.pz = S0.z; S0.pcx = S0.cx; }
  render(dt, Math.min(1, acc / TICK));
  stats.frames++;
  if (now - lastTierCheck > 2000) { lastTierCheck = now; autoTier(); showDbg(); updateHud(); }
}
// 자동 품질: 2초 동안 20ms 넘은 프레임이 15% 넘으면 한 단계, 50% 넘으면 두 단계 내린다(올리지 않음 → 들쭉날쭉 방지). 아레나와 같은 기준.
function autoTier() {
  const log = frameLog; frameLog = []; if (!log.length) return;
  const slow = log.filter(d => d > 20).length / log.length, avg = log.reduce((a, b) => a + b, 0) / log.length;
  stats.lastAvg = Math.round(avg * 10) / 10; stats.lastSlow = Math.round(slow * 100);
  if (auto && slow > .15 && tier > 0 && stats.frames > 90) { setTier(Math.max(0, tier - (slow > .5 ? 2 : 1))); stats.tierDrops++; stats.tierLog.push(`${(performance.now() / 1000).toFixed(0)}s→${tier}`); }
}
function setTier(t) { tier = t; T = TIERS[t]; D.n = Math.min(D.n, T.debris); M.n = Math.min(M.n, T.smoke); K.n = Math.min(K.n, T.sparks); G.n = Math.min(G.n, T.glows); FL.n = Math.min(FL.n, T.fly); B.n = Math.min(B.n, T.shots); resize(); crackCastleRedo(); syncCrowd(0, 0); stats.tier = t; markButtons(); }
function crackCastleRedo() { for (let l = 1; l <= castleCracks; l++) crackCastle(l); }
function showDbg() {
  const mem = performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) + 'MB' : '-', snd = soundState();
  $('#dbg').textContent = `fps ${stats.lastAvg ? Math.round(1000 / stats.lastAvg) : '-'} · 느린 ${stats.lastSlow ?? '-'}%\n품질 ${T.name}${auto ? '(자동)' : ''} ×${S}\n정령 ${S0.n} (그림 ${shown}/${T.draw})\n파편 ${D.n} 연기 ${M.n} 빛 ${G.n} 불꽃 ${K.n} 날기 ${FL.n}\n힙 ${mem} · 재료 그림 ${matFromArt.size}/${MAT_KEYS.length} · 소리 ${snd.on ? (snd.muted ? '끔' : '켬') : '탭하면 켜짐'}`;
}
function updateHud() { const p = clamp(S0.z / 180, 0, 1); $('#prog i').style.transform = `scaleX(${p})`; }
function markButtons() { for (const b of document.querySelectorAll('#bar button')) b.classList.toggle('on', b.dataset.q === (auto ? 'auto' : String(tier)) || (b.dataset.act === 'pause' && paused) || (b.dataset.act === 'mute' && soundState().muted) || (b.dataset.act === 'auto' && autoSteer)); }
$('#bar').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.dataset.q) { auto = b.dataset.q === 'auto'; setTier(auto ? 3 : Number(b.dataset.q)); }
  if (b.dataset.act === 'pause') paused = !paused;
  if (b.dataset.act === 'restart') restart();
  if (b.dataset.act === 'auto') autoSteer = !autoSteer;
  if (b.dataset.act === 'clean') document.body.classList.add('clean');
  if (b.dataset.act === 'mute') { setMuted(!soundState().muted); b.textContent = soundState().muted ? '소리 켜기' : '소리 끄기'; }
  markButtons(); showDbg();
});
addEventListener('pointerdown', unlockSound, { passive: true });
addEventListener('keydown', unlockSound);
addEventListener('resize', () => { resize(); crackCastleRedo(); });

await Promise.all([loadImg('pet', `/assets/pets/${PET.key}-3.webp`), loadImg('mon', '/assets/monsters/alarmwolf.webp'), loadMatArt(), document.fonts.load('20px Jua', '0123 구출공성전'), document.fonts.load('20px Jua', '0123+×−')]).catch(() => {});
buildMats(); stats.matArt = matFromArt.size;
resetSim(); resize(); cam.z = S0.z - cam.back; markButtons(); stats.tier = tier;
stats.canvasMB = () => Math.round([cvs, sky, SPR.castle, castleBase, SPR.crystal].reduce((a, c) => a + c.width * c.height * 4, 0) / 1048576 * 10) / 10;
requestAnimationFrame(frame);
