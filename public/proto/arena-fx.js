// 펫 아레나 캔버스 연출 시험 2판(측정용, 앱과 연결하지 않음). docs/arena-battle-reboot-plan.md · docs/arena-fx-perf.mjs.
// 무엇을 보나: 전투 장면만 Canvas 2D로 그렸을 때 번개 · 광선 · 지진(바닥 금 누적) · 물대포 · 바람 · 필살 컷인 · 소리가
//   폰에서 부드럽게(CPU 4× · 품질 자동 56fps 안팎) 도는지.
// 구조(실제 앱으로 옮길 때도 같은 모양):
//   - 고정 틱 20Hz(50ms, arena-rules.js ARENA.TICK_MS와 같은 간격)로 펫 위치를 움직이고, 그리기는 화면 주사율로 앞뒤 틱 사이를 보간한다.
//   - 연출은 그리기 쪽 시간만 쓴다. 히트스톱 · 느린 동작은 연출 시간만 멈추거나 늦추고 틱(=규칙)은 그대로.
//   - 바닥 자국은 "경기장 그림 한 장"에 구워 넣는다 → 자국이 몇 개 쌓여도 매 프레임 비용은 그림 1장. 상한이 넘으면 아문다.
//   - 2판 재료 칸(MATS): 연기 · 불티 · 번개 · 금 … 28칸. 그림 71(public/assets/arena/mat-<이름>.webp)이 들어오면
//     build:assets가 ARENA_ART에 적고, 이 페이지가 같은 칸의 코드 그림 대신 그 그림을 쓴다(코드 고칠 것 없음).
//   - 빛 번짐은 미리 번지게 그린 빛 그림(glow)으로만 낸다. 프레임마다 ctx.filter blur는 쓰지 않는다(사파리 · 느림).
//   - 화면 가장자리 어둡게 · 속성 색 · 반전 섬광은 캔버스가 아니라 위에 얹은 DOM 막(투명도 · CSS filter)으로 → 합성기가 처리, 캔버스 칠하기 0.
//   - 품질 4단계(해상도 · 파편 수 · 빛 겹 · 잔상 · 컷인 속도선 수)를 프레임 시간을 보고 자동으로 내린다.
// 주소 옵션: ?q=auto|3|2|1|0(높음 · 중간 · 낮음 · 최저) &pets=2|4 &clean=1 &seed=숫자 &fx=0(효과 끄기) &decal=0(자국 굽기 끄기)
import { ARENA_ART } from '/modules/arena-art.js';
import { sfx, unlockSound, setMuted, soundState } from '/proto/arena-fx-sound.js?v=2.1';
const PROTO_V = '2.1';
// 옛 서비스 워커가 이 페이지를 캐시에서 주던 폰: 기다리는 새 워커가 있으면 바로 넘어가게 하고(SKIP_WAITING), 넘어가면 한 번만 새로 고친다.
//   새 sw.js는 /proto/를 거치지 않으므로 그다음부터는 늘 서버의 새 파일이다. 앱의 pwa.js는 이 페이지에 없어서 직접 한다.
try {
  const sw = navigator.serviceWorker;
  if (sw) {
    sw.getRegistration().then(r => { const w = r?.waiting; if (w) w.postMessage({ type: 'SKIP_WAITING' }); r?.update?.().catch(() => {}); }).catch(() => {});
    sw.addEventListener('controllerchange', () => { try { if (sessionStorage.getItem('arena-fx-reloaded') === PROTO_V) return; sessionStorage.setItem('arena-fx-reloaded', PROTO_V); } catch {} location.reload(); });
  }
} catch {}

const P = new URLSearchParams(location.search);
const $ = s => document.querySelector(s);
const cvs = $('#stage');
const ctx = cvs.getContext('2d', { alpha: false, desynchronized: true });

/* ---------- 품질 단계 ---------- */
const TIERS = [
  // 최저: CSS 픽셀보다 낮은 해상도로 그리고 화면에 늘려 보인다(조금 흐리지만 칠하는 넓이가 절반) — GPU 캔버스가 없는 느린 폰용
  { name: '최저', scale: .75, debris: 70, smoke: 20, sparks: 70, glows: 60, mult: .35, glow: false, trail: false, cutLines: 4, fieldPx: 3 },
  { name: '낮음', scale: 1, debris: 90, smoke: 28, sparks: 90, glows: 90, mult: .4, glow: false, trail: false, cutLines: 6, fieldPx: 4 },
  { name: '중간', scale: 1.5, debris: 200, smoke: 56, sparks: 180, glows: 180, mult: .7, glow: true, trail: true, cutLines: 10, fieldPx: 6 },
  { name: '높음', scale: 2, debris: 400, smoke: 96, sparks: 320, glows: 300, mult: 1, glow: true, trail: true, cutLines: 14, fieldPx: 8 }
];
const qArg = P.get('q') || 'auto';
let auto = qArg === 'auto';
let tier = auto ? 3 : Math.max(0, Math.min(3, Number(qArg) | 0));
let T = TIERS[tier];
let PETS_N = P.get('pets') === '2' ? 2 : 4;
if (P.get('clean') === '1') document.body.classList.add('clean');
const FX_ON = P.get('fx') !== '0';

/* ---------- 씨앗 고정 난수(같은 장면을 매번 같게 → 고치기 전 · 후 비교) ---------- */
let seed = Number(P.get('seed')) || 20261109;
const rnd = () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const rr = (a, b) => a + rnd() * (b - a);
const TAU = Math.PI * 2;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const easeOut = t => 1 - (1 - t) * (1 - t) * (1 - t);
const mk = (w, h) => { const c = document.createElement('canvas'); c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h)); return c; };

/* ---------- 경기장(월드 단위) · 카메라 ---------- */
const WW = 120, WH = 190;             // 경기장 크기(단위). 화면 폭 = 80단위(줌 1) → 펫 14단위 ≈ 화면 폭 17%
const VIEW_W = 80;
const PET_U = 14;
let cssW = 390, cssH = 844, S = 2;
let ppu = cssW / VIEW_W;
const cam = { x: WW / 2, y: WH / 2, z: 1, tz: 1, punch: 0, trauma: 0 };

function resize() {
  cssW = innerWidth; cssH = innerHeight;
  S = T.scale < 1 ? T.scale : Math.min(devicePixelRatio || 1, T.scale);
  cvs.width = Math.round(cssW * S); cvs.height = Math.round(cssH * S);
  ppu = cssW / VIEW_W;
  buildSprites();
}

/* ---------- 재료 칸(MATS): 그림 71이 오면 그림, 없으면 코드 그림 ---------- */
// kind: add(검은 배경 · 더하기) · luma(흰 + 알파, 색 입힘) · key(투명 배경 물체) · mul(흰 배경 · 곱하기로 바닥에 굽기)
// 이름은 docs/asset-requests/runner/build-71.mjs의 칸 이름과 1:1(public/assets/arena/mat-<이름>.webp).
const MATS = {
  glow: ['add', 256, g => radial(g, 128, [[0, '#fff'], [.25, 'rgba(255,255,255,.75)'], [.6, 'rgba(255,255,255,.18)'], [1, 'rgba(255,255,255,0)']])],
  star: ['add', 256, g => { radial(g, 128, [[0, '#fff'], [.08, 'rgba(255,255,255,.8)'], [.2, 'rgba(190,220,255,0)']]); g.fillStyle = '#fff'; for (const [w, h, a] of [[230, 7, 0], [7, 230, 0], [120, 5, .785], [120, 5, -.785]]) { g.save(); g.translate(128, 128); g.rotate(a); const lg = g.createLinearGradient(-w / 2, 0, w / 2, 0); lg.addColorStop(0, 'rgba(200,225,255,0)'); lg.addColorStop(.5, '#fff'); lg.addColorStop(1, 'rgba(200,225,255,0)'); g.fillStyle = lg; g.beginPath(); g.ellipse(0, 0, w / 2, h / 2, 0, 0, TAU); g.fill(); g.restore(); } }],
  ring: ['add', 256, g => { for (const [w, a] of [[16, .18], [9, .35], [4, .9]]) { g.strokeStyle = `rgba(255,255,255,${a})`; g.lineWidth = w; g.beginPath(); g.arc(128, 128, 104, 0, TAU); g.stroke(); } }],
  burst: ['add', 256, g => { radial(g, 128, [[0, '#fff'], [.18, 'rgba(255,240,190,.8)'], [.45, 'rgba(255,220,140,0)']]); g.fillStyle = 'rgba(255,245,210,.95)'; for (let i = 0; i < 14; i++) { const a = i / 14 * TAU + rr(-.1, .1), L = rr(70, 122), w = rr(.04, .08); g.beginPath(); g.moveTo(128 + Math.cos(a - w) * 18, 128 + Math.sin(a - w) * 18); g.lineTo(128 + Math.cos(a) * L, 128 + Math.sin(a) * L); g.lineTo(128 + Math.cos(a + w) * 18, 128 + Math.sin(a + w) * 18); g.fill(); } }],
  flame: ['add', 256, g => { for (const [s, c] of [[1, 'rgba(200,40,10,.85)'], [.75, 'rgba(255,130,30,.9)'], [.48, 'rgba(255,220,110,.95)'], [.25, '#fff']]) { g.fillStyle = c; g.beginPath(); g.moveTo(128, 128 - 115 * s - 6); g.bezierCurveTo(128 + 70 * s, 128 - 30 * s, 128 + 62 * s, 128 + 90 * s, 128, 128 + 100 * s); g.bezierCurveTo(128 - 62 * s, 128 + 90 * s, 128 - 70 * s, 128 - 30 * s, 128, 128 - 115 * s - 6); g.fill(); } }],
  ember: ['add', 128, g => radial(g, 64, [[0, '#fff'], [.15, 'rgba(255,220,120,.95)'], [.4, 'rgba(255,120,30,.45)'], [1, 'rgba(255,80,20,0)']])],
  bolt: ['add', 512, g => { const pts = [[16, 106]]; let x = 16; while (x < 490) { x += rr(26, 48); pts.push([Math.min(496, x), 106 + rr(-34, 34)]); } for (const [w, c] of [[16, 'rgba(120,110,255,.3)'], [7, 'rgba(170,200,255,.75)'], [2.5, '#fff']]) { g.strokeStyle = c; g.lineWidth = w; g.lineJoin = 'miter'; g.beginPath(); pts.forEach(([a, b], i) => i ? g.lineTo(a, b) : g.moveTo(a, b)); g.stroke(); } }, 213],
  streak: ['add', 256, g => { const lg = g.createLinearGradient(20, 0, 236, 0); lg.addColorStop(0, 'rgba(255,200,90,0)'); lg.addColorStop(.75, 'rgba(255,240,180,.9)'); lg.addColorStop(1, '#fff'); g.fillStyle = lg; g.beginPath(); g.moveTo(20, 53); g.lineTo(236, 47); g.quadraticCurveTo(250, 53, 236, 59); g.closePath(); g.fill(); }, 107],
  drop: ['key', 128, g => { const gr = g.createRadialGradient(54, 56, 4, 64, 72, 44); gr.addColorStop(0, '#e9fbff'); gr.addColorStop(.35, '#5fd0ff'); gr.addColorStop(1, '#1b5fa8'); g.fillStyle = gr; g.beginPath(); g.moveTo(64, 14); g.bezierCurveTo(96, 56, 104, 80, 92, 98); g.arc(64, 88, 32, .3, Math.PI - .3); g.bezierCurveTo(24, 80, 32, 56, 64, 14); g.fill(); g.fillStyle = 'rgba(255,255,255,.85)'; g.beginPath(); g.ellipse(52, 70, 7, 12, -.4, 0, TAU); g.fill(); }],
  splash: ['key', 256, g => { for (let i = 0; i < 14; i++) { const a = i / 14 * TAU, L = rr(70, 112), w = .16; const gr = g.createLinearGradient(128, 128, 128 + Math.cos(a) * L, 128 + Math.sin(a) * L); gr.addColorStop(0, 'rgba(60,170,240,.0)'); gr.addColorStop(.45, '#3fb6f0'); gr.addColorStop(1, '#e8fbff'); g.fillStyle = gr; g.beginPath(); g.moveTo(128 + Math.cos(a - w) * 52, 128 + Math.sin(a - w) * 52); g.lineTo(128 + Math.cos(a) * L, 128 + Math.sin(a) * L); g.lineTo(128 + Math.cos(a + w) * 52, 128 + Math.sin(a + w) * 52); g.fill(); g.fillStyle = '#d8f6ff'; g.beginPath(); g.arc(128 + Math.cos(a + .2) * (L + 8), 128 + Math.sin(a + .2) * (L + 8), rr(3, 6), 0, TAU); g.fill(); } }],
  shard: ['key', 128, g => { g.translate(64, 64); g.rotate(-.75); const gr = g.createLinearGradient(-40, -10, 40, 10); gr.addColorStop(0, '#e9fbff'); gr.addColorStop(.5, '#8fd6f5'); gr.addColorStop(1, '#3c8fc8'); g.fillStyle = gr; g.strokeStyle = '#1d4f86'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(-50, 0); g.lineTo(-8, -13); g.lineTo(54, -2); g.lineTo(-4, 14); g.closePath(); g.fill(); g.stroke(); g.fillStyle = 'rgba(255,255,255,.7)'; g.beginPath(); g.moveTo(-40, -1); g.lineTo(-8, -10); g.lineTo(40, -2); g.closePath(); g.fill(); }],
  frost: ['add', 256, g => { radial(g, 128, [[0, '#fff'], [.12, 'rgba(210,240,255,.8)'], [.3, 'rgba(160,220,255,0)']]); g.strokeStyle = 'rgba(225,245,255,.95)'; g.lineCap = 'round'; for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; g.lineWidth = 5; g.beginPath(); g.moveTo(128, 128); g.lineTo(128 + Math.cos(a) * 100, 128 + Math.sin(a) * 100); g.stroke(); g.lineWidth = 3; for (const d of [45, 70]) { const bx = 128 + Math.cos(a) * d, by = 128 + Math.sin(a) * d; for (const s of [-1, 1]) { g.beginPath(); g.moveTo(bx, by); g.lineTo(bx + Math.cos(a + s * .7) * 20, by + Math.sin(a + s * .7) * 20); g.stroke(); } } } }],
  'rock-a': ['key', 128, g => rock(g, 128, '#8a7a66')],
  'rock-b': ['key', 128, g => rock(g, 128, '#7d7a72', .55)],
  clod: ['key', 128, g => rock(g, 128, '#8f6b45', .85, true)],
  pebbles: ['key', 256, g => { for (let i = 0; i < 7; i++) { g.save(); g.translate(rr(50, 150), rr(60, 150)); rock(g, rr(40, 70), ['#9a8c78', '#7b6c5a', '#a49a8a'][i % 3], .9, false, true); g.restore(); } }],
  smoke: ['luma', 256, g => puff(g, 256, 7)],
  dust: ['luma', 256, g => { g.setTransform(1, 0, 0, .58, 0, 54); puff(g, 256, 9); }],
  speed: ['luma', 512, g => { for (let i = 0; i < 11; i++) { const y = rr(40, 173), x0 = rr(10, 160), L = rr(180, 330), h = rr(2, 7); const lg = g.createLinearGradient(x0, 0, x0 + L, 0); lg.addColorStop(0, '#fff'); lg.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = lg; g.fillRect(x0, y - h / 2, L, h); } }, 213],
  swirl: ['luma', 256, g => { g.lineCap = 'round'; for (let i = 0; i < 3; i++) { const a0 = i / 3 * TAU; g.strokeStyle = `rgba(255,255,255,${.95 - i * .2})`; g.lineWidth = 12 - i * 2; g.beginPath(); for (let t = 0; t <= 1; t += .05) { const a = a0 + t * 2.4, r = 30 + t * 80; t ? g.lineTo(128 + Math.cos(a) * r, 128 + Math.sin(a) * r) : g.moveTo(128 + Math.cos(a) * r, 128 + Math.sin(a) * r); } g.stroke(); } }],
  leaf: ['key', 128, g => { g.translate(64, 64); g.rotate(-.6); const gr = g.createLinearGradient(0, -20, 0, 20); gr.addColorStop(0, '#b8ef5a'); gr.addColorStop(1, '#3f9c2c'); g.fillStyle = gr; g.strokeStyle = '#1f5a1a'; g.lineWidth = 3; g.beginPath(); g.moveTo(-48, 0); g.quadraticCurveTo(0, -34, 50, 0); g.quadraticCurveTo(0, 34, -48, 0); g.fill(); g.stroke(); g.strokeStyle = 'rgba(240,255,200,.8)'; g.lineWidth = 2; g.beginPath(); g.moveTo(-40, 0); g.lineTo(44, 0); g.stroke(); }],
  petal: ['key', 128, g => { g.translate(64, 64); g.rotate(.5); const gr = g.createRadialGradient(-8, -6, 2, 0, 0, 40); gr.addColorStop(0, '#fff2f7'); gr.addColorStop(1, '#f58bb7'); g.fillStyle = gr; g.strokeStyle = '#c24c80'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(0, 38); g.bezierCurveTo(-36, 18, -30, -30, -6, -36); g.lineTo(0, -28); g.lineTo(6, -36); g.bezierCurveTo(30, -30, 36, 18, 0, 38); g.fill(); g.stroke(); }],
  bubble: ['key', 128, g => { const gr = g.createRadialGradient(50, 48, 4, 64, 64, 46); gr.addColorStop(0, '#f2b6ff'); gr.addColorStop(.6, '#b24cd6'); gr.addColorStop(1, '#5e1d84'); g.fillStyle = gr; g.beginPath(); g.arc(64, 64, 44, 0, TAU); g.fill(); g.strokeStyle = '#9dff6a'; g.lineWidth = 3; g.beginPath(); g.arc(64, 64, 41, .4, 2.6); g.stroke(); g.fillStyle = 'rgba(255,255,255,.85)'; g.beginPath(); g.ellipse(48, 46, 12, 8, -.6, 0, TAU); g.fill(); }],
  stardust: ['add', 256, g => { for (let i = 0; i < 13; i++) { const x = rr(50, 206), y = rr(50, 206), r = rr(6, 20); g.save(); g.translate(x, y); radial(g, 0, [[0, '#fff'], [.3, 'rgba(255,230,140,.8)'], [1, 'rgba(255,210,90,0)']], r); g.fillStyle = '#fff8d8'; g.fillRect(-r, -.8, r * 2, 1.6); g.fillRect(-.8, -r, 1.6, r * 2); g.restore(); } }],
  'crack-star': ['mul', 256, g => { g.translate(128, 128); g.scale(4.6, 4.6); drawCracks(g, growCracks(0, 0, 26, 8), 1, true); }],
  'crack-line': ['mul', 512, g => { g.translate(20, 106); g.scale(4.4, 4.4); drawCracks(g, crackLine(105), 1, true); }, 213],
  scorch: ['mul', 256, g => { for (let i = 0; i < 6; i++) { const x = 128 + rr(-30, 30), y = 128 + rr(-30, 30); radial(g, 0, [[0, 'rgba(30,20,14,.6)'], [1, 'rgba(30,20,14,0)']], rr(55, 100), x, y); } }],
  crater: ['mul', 256, g => { radial(g, 0, [[0, 'rgba(60,40,24,.7)'], [.55, 'rgba(90,64,38,.45)'], [.8, 'rgba(70,48,28,.55)'], [1, 'rgba(90,64,38,0)']], 110, 128, 128); }]
};
const MAT_KEYS = Object.keys(MATS);
const mat = {};             // 이름 → 그릴 캔버스(그림 또는 코드 그림, 기기 배율과 무관한 고정 크기)
const matFromArt = new Set();
const tintCache = new Map();
function radial(g, r0, stops, R, cx, cy) { const c = cx ?? (r0 || 0), cy2 = cy ?? (r0 || 0), rad = R ?? r0; const gr = g.createRadialGradient(c, cy2, 0, c, cy2, rad); for (const [o, col] of stops) gr.addColorStop(o, col); g.fillStyle = gr; g.beginPath(); g.arc(c, cy2, rad, 0, TAU); g.fill(); }
function rock(g, size, base, flat = 1, dirt = false, small = false) {
  const r = size / 2, n = 6 + (rnd() * 3 | 0), pts = [], cx = small ? 0 : r, cy = small ? 0 : r;
  for (let i = 0; i < n; i++) { const a = i / n * TAU + rr(-.3, .3), d = r * rr(.55, .9); pts.push([cx + Math.cos(a) * d, cy + Math.sin(a) * d * flat]); }
  g.beginPath(); pts.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.closePath();
  const gr = g.createLinearGradient(cx - r, cy - r, cx + r, cy + r); gr.addColorStop(0, shade(base, 45)); gr.addColorStop(.55, base); gr.addColorStop(1, shade(base, -50));
  g.fillStyle = gr; g.fill(); g.lineWidth = Math.max(1.5, size / 30); g.strokeStyle = '#3a2a1c'; g.stroke();
  g.fillStyle = 'rgba(255,255,255,.3)'; g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); g.lineTo(cx, cy); g.lineTo(pts[n - 1][0], pts[n - 1][1]); g.closePath(); g.fill();
  if (dirt) { g.strokeStyle = '#6fb04a'; g.lineWidth = 2; for (let i = 0; i < 4; i++) { const x = cx + rr(-r * .4, r * .4), y = cy - r * .4 * flat; g.beginPath(); g.moveTo(x, y); g.lineTo(x + rr(-4, 4), y - rr(6, 12)); g.stroke(); } }
}
function puff(g, size, n) { const r = size / 2; for (let i = 0; i < n; i++) { const a = i / n * TAU, d = r * .26, x = r + Math.cos(a) * d * rr(.3, 1), y = r + Math.sin(a) * d * rr(.3, 1); radial(g, 0, [[0, 'rgba(255,255,255,.55)'], [.7, 'rgba(235,235,235,.25)'], [1, 'rgba(220,220,220,0)']], r * .6, x, y); } }
function shade(hex, amt) { const n = parseInt(hex.slice(1), 16), f = v => clamp(v + amt, 0, 255); return `rgb(${f(n >> 16)},${f(n >> 8 & 255)},${f(n & 255)})`; }
function buildMats() {
  for (const k of MAT_KEYS) {
    if (mat[k] && matFromArt.has(k)) continue;
    const [, size, draw, h] = MATS[k]; const c = mk(size, h || size), g = c.getContext('2d'); draw(g); mat[k] = c;
  }
}
// 그림 71이 들어온 재료만 불러온다(ARENA_ART에 이름이 있을 때만 요청 → 없는 그림을 묻지 않아 404 · 콘솔 오류 없음)
function loadMatArt() {
  return Promise.all(MAT_KEYS.filter(k => ARENA_ART.has('mat-' + k)).map(k => new Promise(res => {
    const im = new Image(); im.decoding = 'async';
    im.onload = () => { const c = mk(im.width, im.height); c.getContext('2d').drawImage(im, 0, 0); mat[k] = c; matFromArt.add(k); res(); };
    im.onerror = res; im.src = `/assets/arena/mat-${k}.webp`;
  })));
}
// 색 입히기(한 번 만들어 둠): add는 곱하기로 흰색 → 색(검정은 그대로), luma는 모양 그대로 색 채우기.
function tint(k, rgb) {
  const key = k + '|' + rgb; let c = tintCache.get(key); if (c) return c;
  const src = mat[k]; c = mk(src.width, src.height); const g = c.getContext('2d');
  g.drawImage(src, 0, 0);
  if (MATS[k][0] === 'luma') { g.globalCompositeOperation = 'source-in'; g.fillStyle = `rgb(${rgb})`; g.fillRect(0, 0, c.width, c.height); }
  // add 재료: 먼저 색을 빼(채도 0, 밝기만 남김) 흰 빛으로 만든 뒤 곱하기로 색을 입힌다 → 그림 71의 빛이 주황 · 파랑으로 그려져 있어도 어떤 속성 색이든 맑게 나온다
  else { g.globalCompositeOperation = 'saturation'; g.fillStyle = '#808080'; g.fillRect(0, 0, c.width, c.height); if (rgb !== '255,255,255') { g.globalCompositeOperation = 'multiply'; g.fillStyle = `rgb(${rgb})`; g.fillRect(0, 0, c.width, c.height); } g.globalCompositeOperation = 'destination-in'; g.drawImage(src, 0, 0); }
  tintCache.set(key, c); return c;
}
// 그림 71이 들어온 재료만 세기 · 크기를 맞춘다(그린 빛은 코드 빛보다 진하고, 불티 점은 칸에 비해 작다). [투명도 배율, 크기 배율]
const ART_ADJ = { glow: [.55, .8], burst: [.8, .9], ring: [.85, 1], ember: [1, 3.2], stardust: [.9, 1.3], frost: [.8, 1], star: [.85, 1], scorch: [.55, .9], crater: [.75, 1], 'crack-star': [.85, 1], 'crack-line': [.8, 1] };
const adj = k => matFromArt.has(k) ? ART_ADJ[k] || [1, 1] : [1, 1];
const EL_RGB = { star: '255,226,90', flame: '255,130,50', earth: '214,170,110', ice: '140,215,255', toxic: '200,110,255', water: '80,180,255', wind: '170,255,220', leaf: '140,230,90' };

/* ---------- 바닥: 처음 한 번 그린 땅(ground) + 자국이 구워지는 경기장(field) ---------- */
let ground, field, fctx, FPX = 8, scars = 0;
const SCAR_CAP = 36;
function buildGround() {
  FPX = T.fieldPx;
  ground = mk(WW * FPX, WH * FPX);
  const g = ground.getContext('2d');
  g.scale(FPX, FPX);
  g.fillStyle = '#2f4a2a'; g.fillRect(0, 0, WW, WH);
  const r0 = 8; const s0 = seed; seed = 99;
  g.save(); roundRect(g, 4, 4, WW - 8, WH - 8, r0); g.clip();
  const lg = g.createLinearGradient(0, 0, 0, WH); lg.addColorStop(0, '#8cbf62'); lg.addColorStop(1, '#73a650'); g.fillStyle = lg; g.fillRect(0, 0, WW, WH);
  for (let i = 0; i < 520; i++) { const x = rr(0, WW), y = rr(0, WH), r = rr(2, 9); g.fillStyle = `hsla(${rr(82, 108)},${rr(30, 48)}%,${rr(38, 56)}%,${rr(.08, .22)})`; g.beginPath(); g.ellipse(x, y, r, r * rr(.5, 1), rr(0, TAU), 0, TAU); g.fill(); }
  for (let i = 0; i < 26; i++) { const x = rr(10, WW - 10), y = rr(10, WH - 10), r = rr(4, 11); g.fillStyle = `rgba(176,146,98,${rr(.18, .35)})`; g.beginPath(); g.ellipse(x, y, r, r * rr(.4, .8), rr(0, TAU), 0, TAU); g.fill(); }
  g.lineCap = 'round';
  for (let i = 0; i < 900; i++) { const x = rr(0, WW), y = rr(0, WH); g.strokeStyle = `hsla(${rr(85, 115)},45%,${rr(26, 40)}%,.55)`; g.lineWidth = .28; g.beginPath(); g.moveTo(x, y); g.lineTo(x + rr(-.6, .6), y - rr(.8, 1.8)); g.stroke(); }
  for (let i = 0; i < 70; i++) { const x = rr(6, WW - 6), y = rr(6, WH - 6); g.fillStyle = ['#fff6d8', '#ffd1e3', '#ffe680'][i % 3]; g.beginPath(); g.arc(x, y, rr(.35, .6), 0, TAU); g.fill(); }
  for (let i = 0; i < 40; i++) { const x = rr(6, WW - 6), y = rr(6, WH - 6), r = rr(.5, 1.2); g.fillStyle = 'rgba(0,0,0,.18)'; g.beginPath(); g.ellipse(x + .3, y + .3, r, r * .7, 0, 0, TAU); g.fill(); g.fillStyle = '#b9b4a6'; g.beginPath(); g.ellipse(x, y, r, r * .7, 0, 0, TAU); g.fill(); }
  g.strokeStyle = 'rgba(255,255,255,.22)'; g.lineWidth = .7;
  g.beginPath(); g.arc(WW / 2, WH / 2, 18, 0, TAU); g.stroke();
  g.beginPath(); g.moveTo(10, WH / 2); g.lineTo(WW - 10, WH / 2); g.stroke();
  g.restore();
  g.lineWidth = 2.4; g.strokeStyle = '#d8cfb8'; roundRect(g, 4, 4, WW - 8, WH - 8, r0); g.stroke();
  g.lineWidth = .6; g.strokeStyle = 'rgba(70,55,40,.6)'; roundRect(g, 2.9, 2.9, WW - 5.8, WH - 5.8, r0 + 1); g.stroke();
  seed = s0;
  resetField();
}
function resetField() { field = mk(ground.width, ground.height); fctx = field.getContext('2d'); fctx.drawImage(ground, 0, 0); fctx.setTransform(FPX, 0, 0, FPX, 0, 0); scars = 0; if (P.get('decal') === '0') { fctx = mk(8, 8).getContext('2d'); fctx.setTransform(FPX, 0, 0, FPX, 0, 0); } }
function roundRect(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
function scar(n = 1) { scars += n; if (scars > SCAR_CAP) healField(); }
function healField() { fctx.save(); fctx.setTransform(1, 0, 0, 1, 0, 0); fctx.globalAlpha = .25; fctx.drawImage(ground, 0, 0); fctx.restore(); scars = Math.round(scars * .75); stats.heals++; }
// 자국 도장: 재료(mul)를 곱하기로 바닥에 굽는다. 그림 71-7이 오면 그 그림, 없으면 코드 그림.
function stamp(k, x, y, w, h = w, rot = 0, alpha = 1, n = 1) {
  const [ga, gs] = adj(k); w *= gs; h *= gs;
  const g = fctx; g.save(); g.translate(x, y); if (rot) g.rotate(rot); g.globalAlpha = alpha * ga; g.globalCompositeOperation = 'multiply';
  g.drawImage(mat[k], -w / 2, -h / 2, w, h); g.restore(); scar(n);
}

/* ---------- 펫 · 글자 그림 ---------- */
const SPR = {};
const PET_KEYS = ['tiger', 'gumiho', 'dragon', 'bear'];
const PET_NAME = { tiger: '호랑이', gumiho: '구미호', dragon: '드래곤', bear: '곰' };
const PET_EL = { tiger: 'star', gumiho: 'toxic', dragon: 'flame', bear: 'earth' };
const petImg = {};
function loadPets() { return Promise.all(PET_KEYS.map(k => new Promise(res => { const im = new Image(); im.decoding = 'async'; im.onload = () => { petImg[k] = im; res(); }; im.onerror = res; im.src = `/assets/pets/${k}-3.webp`; }))); }
function shrink(im, px) { let src = im, w = im.width; while (w / 2 > px * 1.2) { const c = mk(w / 2, w / 2); c.getContext('2d').drawImage(src, 0, 0, w / 2, w / 2); src = c; w /= 2; } const out = mk(px, px); out.getContext('2d').drawImage(src, 0, 0, px, px); return out; }
function petSprites(k) {
  const im = petImg[k]; if (!im) return null;
  const px = Math.round(PET_U * ppu * S), body = shrink(im, px);
  const white = mk(px, px), wg = white.getContext('2d'); wg.drawImage(body, 0, 0); wg.globalCompositeOperation = 'source-in'; wg.fillStyle = '#fff'; wg.fillRect(0, 0, px, px);
  const big = shrink(im, Math.round(Math.min(cssW * .8, 300) * S));   // 필살 컷인용 큰 얼굴
  return { body, white, big, px };
}
function buildSprites() {
  const sh = mk(64, 32), sg = sh.getContext('2d'), gr = sg.createRadialGradient(32, 16, 0, 32, 16, 32); gr.addColorStop(0, 'rgba(0,0,0,.42)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); sg.setTransform(1, 0, 0, .5, 0, 8); sg.fillStyle = gr; sg.fillRect(0, -16, 64, 64); SPR.shadow = sh;
  SPR.pets = {}; for (const k of PET_KEYS) SPR.pets[k] = petSprites(k);
  SPR.text = new Map(); buildDigits();
}
const NUM_STYLES = {
  hit: { size: 26, fill: ['#ffffff', '#e7eefc'], stroke: '#1b2140', lw: 5 },
  crit: { size: 40, fill: ['#fff3a6', '#ffb02e'], stroke: '#5a2300', lw: 7 },
  super: { size: 32, fill: ['#ffd6a8', '#ff7a2e'], stroke: '#4a1400', lw: 6 },
  heal: { size: 24, fill: ['#d6ffd6', '#59e06a'], stroke: '#0f3a16', lw: 5 }
};
function buildDigits() {
  SPR.digits = {};
  for (const [k, st] of Object.entries(NUM_STYLES)) {
    const fs = st.size * S, cw = Math.ceil(fs * .72), ch = Math.ceil(fs * 1.3), c = mk(cw * 10, ch), g = c.getContext('2d');
    g.font = `${fs}px Jua, system-ui, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
    const gr = g.createLinearGradient(0, ch * .2, 0, ch * .8); gr.addColorStop(0, st.fill[0]); gr.addColorStop(1, st.fill[1]);
    for (let d = 0; d < 10; d++) { const x = d * cw + cw / 2, y = ch / 2; g.lineWidth = st.lw * S; g.strokeStyle = st.stroke; g.strokeText(String(d), x, y); g.fillStyle = gr; g.fillText(String(d), x, y); }
    SPR.digits[k] = { c, cw, ch, adv: cw * .78 };
  }
}
const PILL_COLOR = { star: '#ffd84a', flame: '#ff7a3a', earth: '#c99a5b', toxic: '#c06cff', ice: '#7fd4ff', water: '#5fc0ff', wind: '#8ff0c8' };
function textSprite(text, kind, el = 'star') {
  const key = kind + '|' + el + '|' + text; let s = SPR.text.get(key); if (s) return s;
  const fs = { pill: 15, shout: 34, status: 17, banner: 40, cut: 46 }[kind] * S;
  const m = mk(4, 4).getContext('2d'); m.font = `${fs}px Jua, system-ui, sans-serif`; const tw = m.measureText(text).width;
  const padX = kind === 'pill' ? 12 * S : 10 * S, w = Math.ceil(tw + padX * 2), h = Math.ceil(fs * 1.7);
  const c = mk(w, h), g = c.getContext('2d'); g.font = m.font; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
  if (kind === 'pill') {
    roundRect(g, 2 * S, 3 * S, w - 4 * S, h - 6 * S, (h - 6 * S) / 2); g.fillStyle = 'rgba(16,20,40,.88)'; g.fill(); g.lineWidth = 2 * S; g.strokeStyle = PILL_COLOR[el] || '#fff'; g.stroke();
    g.fillStyle = '#fff'; g.fillText(text, w / 2, h / 2 + S);
  } else if (kind === 'shout' || kind === 'cut') {
    const gr = g.createLinearGradient(0, h * .2, 0, h * .8); gr.addColorStop(0, '#ffffff'); gr.addColorStop(1, PILL_COLOR[el] || '#ffd84a');
    g.lineWidth = 9 * S; g.strokeStyle = '#141a33'; g.strokeText(text, w / 2, h / 2); g.fillStyle = gr; g.fillText(text, w / 2, h / 2);
  } else if (kind === 'status') {
    g.lineWidth = 5 * S; g.strokeStyle = '#2a1d00'; g.strokeText(text, w / 2, h / 2); g.fillStyle = '#ffe14a'; g.fillText(text, w / 2, h / 2);
  } else {
    g.lineWidth = 8 * S; g.strokeStyle = '#120c1c'; g.strokeText(text, w / 2, h / 2); g.fillStyle = '#fff'; g.fillText(text, w / 2, h / 2);
  }
  s = { c, w, h }; SPR.text.set(key, s); return s;
}

/* ---------- 펫(규칙 쪽 흉내: 고정 틱 20Hz) ---------- */
const TICK = 50;
let pets = [];
function makePets() {
  const keys = PETS_N === 2 ? ['tiger', 'dragon'] : PET_KEYS;
  pets = keys.map((k, i) => {
    const team = PETS_N === 2 ? i : (i < 2 ? 0 : 1), x = PETS_N === 2 ? WW / 2 : (i % 2 ? WW * .66 : WW * .34), y = team ? WH * .36 : WH * .64;
    return { k, team, el: PET_EL[k], x, y, px: x, py: y, tx: x, ty: y, hp: 100, max: 100, alive: true, back: 0, flash: 0, kx: 0, ky: 0, sq: 0, sv: 0, bob: rnd() * TAU, dead: 0, trail: [], trailT: 0 };
  });
  buildHud();
}
function tickSim() {
  for (const p of pets) {
    p.px = p.x; p.py = p.y;
    if (!p.alive) { if (--p.back <= 0) { p.alive = true; p.hp = p.max; p.dead = 0; hudDirty = true; } continue; }
    if (Math.hypot(p.tx - p.x, p.ty - p.y) < 2) { p.tx = rr(18, WW - 18); p.ty = p.team ? rr(30, WH * .5) : rr(WH * .5, WH - 30); }
    const dx = p.tx - p.x, dy = p.ty - p.y, d = Math.hypot(dx, dy) || 1, v = .75;
    p.x += dx / d * v; p.y += dy / d * v;
    for (const q of pets) if (q !== p && q.alive) { const ex = p.x - q.x, ey = p.y - q.y, e = Math.hypot(ex, ey); if (e < PET_U && e > 0) { p.x += ex / e * .6; p.y += ey / e * .6; } }
    p.x = clamp(p.x, 12, WW - 12); p.y = clamp(p.y, 16, WH - 12);
  }
}

/* ---------- 효과 저장소: 정해진 크기의 배열(풀) — 판이 길어져도 메모리 일정 ---------- */
const DMAX = 400, SMAX = 96, KMAX = 320, GMAX = 300;
// 파편(돌 · 얼음 · 흙 · 잎 · 꽃잎 · 물방울 · 독 거품): 높이 z로 튀어 올랐다 떨어져 굴러 멈춘다(key 재료)
const D = { x: new Float32Array(DMAX), y: new Float32Array(DMAX), z: new Float32Array(DMAX), vx: new Float32Array(DMAX), vy: new Float32Array(DMAX), vz: new Float32Array(DMAX), rot: new Float32Array(DMAX), vr: new Float32Array(DMAX), life: new Float32Array(DMAX), max: new Float32Array(DMAX), size: new Float32Array(DMAX), kind: new Uint8Array(DMAX), n: 0 };
const DEB_MAT = [['rock-a', 'rock-b'], ['shard'], ['clod'], ['leaf'], ['petal'], ['drop'], ['bubble']];
const DEB_FLOAT = [0, 0, 0, 1, 1, 0, 0];          // 잎 · 꽃잎은 천천히 팔랑이며 떨어진다
// 연기 · 흙먼지(luma 재료에 색)
const M = { x: new Float32Array(SMAX), y: new Float32Array(SMAX), r: new Float32Array(SMAX), vr: new Float32Array(SMAX), vx: new Float32Array(SMAX), vy: new Float32Array(SMAX), life: new Float32Array(SMAX), max: new Float32Array(SMAX), a: new Float32Array(SMAX), rot: new Float32Array(SMAX), kind: new Uint8Array(SMAX), n: 0 };
const PUFF = [['smoke', '90,88,96'], ['dust', '190,160,115'], ['smoke', '235,242,255'], ['smoke', '160,80,200'], ['dust', '225,235,225']];
// 불꽃 줄(선, 색마다 한 번에 그림)
const K = { x: new Float32Array(KMAX), y: new Float32Array(KMAX), vx: new Float32Array(KMAX), vy: new Float32Array(KMAX), life: new Float32Array(KMAX), max: new Float32Array(KMAX), len: new Float32Array(KMAX), col: new Uint8Array(KMAX), drag: new Float32Array(KMAX), n: 0 };
const SPARK_COL = ['#ffffff', '#ffe066', '#ff8a3a', '#8fd8ff', '#d68cff', '#e8d2a8'];
// 빛 알갱이(add 재료: 불티 · 불꽃 혀 · 별가루 · 서리 · 별빛) — 더하기로 그림
const G = { x: new Float32Array(GMAX), y: new Float32Array(GMAX), vx: new Float32Array(GMAX), vy: new Float32Array(GMAX), life: new Float32Array(GMAX), max: new Float32Array(GMAX), size: new Float32Array(GMAX), rot: new Float32Array(GMAX), vr: new Float32Array(GMAX), kind: new Uint8Array(GMAX), up: new Float32Array(GMAX), n: 0 };
const GLOW_MAT = [['ember', '255,190,90'], ['flame', '255,255,255'], ['stardust', '255,255,255'], ['frost', '255,255,255'], ['star', '255,255,255'], ['ember', '120,200,255'], ['ember', '210,120,255']];

function addDebris(x, y, n, kind = 0, power = 1, up = 1) {
  n = Math.round(n * T.mult);
  for (let i = 0; i < n; i++) {
    if (D.n >= T.debris) return; const j = D.n++;
    const a = rnd() * TAU, sp = rr(.15, 1) * 34 * power;
    D.x[j] = x + rr(-1, 1); D.y[j] = y + rr(-1, 1); D.z[j] = rr(0, 2);
    D.vx[j] = Math.cos(a) * sp; D.vy[j] = Math.sin(a) * sp * .8; D.vz[j] = rr(12, 42) * up * power;
    D.rot[j] = rnd() * TAU; D.vr[j] = rr(-12, 12); D.max[j] = D.life[j] = rr(1.6, 2.8); D.size[j] = rr(.45, 1.35) * (kind >= 3 ? .8 : 1); D.kind[j] = kind;
  }
}
function addSmoke(x, y, n, kind = 0, r = 4, spread = 6) {
  n = Math.max(1, Math.round(n * T.mult));
  for (let i = 0; i < n; i++) {
    if (M.n >= T.smoke) return; const j = M.n++, a = rnd() * TAU, d = rr(0, spread);
    M.x[j] = x + Math.cos(a) * d; M.y[j] = y + Math.sin(a) * d; M.r[j] = r * rr(.6, 1.2); M.vr[j] = r * rr(.8, 1.6);
    M.vx[j] = Math.cos(a) * rr(2, 7); M.vy[j] = Math.sin(a) * rr(2, 6) - rr(1, 3); M.max[j] = M.life[j] = rr(1.1, 2.2); M.a[j] = rr(.55, .9); M.rot[j] = rnd() * TAU; M.kind[j] = kind;
  }
}
function addSparks(x, y, n, col = 0, speed = 60, len = 1.6, dir = null, spread = TAU) {
  n = Math.round(n * T.mult);
  for (let i = 0; i < n; i++) {
    if (K.n >= T.sparks) return; const j = K.n++, a = dir == null ? rnd() * TAU : dir + rr(-spread / 2, spread / 2), sp = speed * rr(.35, 1);
    K.x[j] = x; K.y[j] = y; K.vx[j] = Math.cos(a) * sp; K.vy[j] = Math.sin(a) * sp; K.max[j] = K.life[j] = rr(.18, .45); K.len[j] = len * rr(.6, 1.3); K.col[j] = col; K.drag[j] = 3.5;
  }
}
function addGather(x, y, n, col, r = 10, dur = .35) {
  n = Math.round(n * T.mult);
  for (let i = 0; i < n; i++) {
    if (K.n >= T.sparks) return; const j = K.n++, a = rnd() * TAU, d = r * rr(.6, 1.2), t = dur * rr(.6, 1);
    K.x[j] = x + Math.cos(a) * d; K.y[j] = y + Math.sin(a) * d; K.vx[j] = -Math.cos(a) * d / t; K.vy[j] = -Math.sin(a) * d / t; K.max[j] = K.life[j] = t; K.len[j] = 1.2; K.col[j] = col; K.drag[j] = 0;
  }
}
// 빛 알갱이: kind는 GLOW_MAT 번호, dir이 있으면 그 방향 부채꼴로, up은 위로 떠오르는 힘(불티 · 불꽃)
function addGlow(x, y, n, kind, speed = 20, size = 2, life = .6, dir = null, spread = TAU, up = 0) {
  n = Math.max(1, Math.round(n * T.mult));
  for (let i = 0; i < n; i++) {
    if (G.n >= T.glows) return; const j = G.n++, a = dir == null ? rnd() * TAU : dir + rr(-spread / 2, spread / 2), sp = speed * rr(.4, 1);
    G.x[j] = x + rr(-.6, .6); G.y[j] = y + rr(-.6, .6); G.vx[j] = Math.cos(a) * sp; G.vy[j] = Math.sin(a) * sp; G.max[j] = G.life[j] = life * rr(.6, 1.2);
    G.size[j] = size * rr(.6, 1.3); G.rot[j] = kind === 1 ? a + Math.PI / 2 : rnd() * TAU; G.vr[j] = kind === 1 ? 0 : rr(-3, 3); G.kind[j] = kind; G.up[j] = up;
  }
}
function swapOut(A, j, last, keys) { for (const k of keys) A[k][j] = A[k][last]; }
const DKEYS = ['x', 'y', 'z', 'vx', 'vy', 'vz', 'rot', 'vr', 'life', 'max', 'size', 'kind'];
const MKEYS = ['x', 'y', 'r', 'vr', 'vx', 'vy', 'life', 'max', 'a', 'rot', 'kind'];
const KKEYS = ['x', 'y', 'vx', 'vy', 'life', 'max', 'len', 'col', 'drag'];
const GKEYS = ['x', 'y', 'vx', 'vy', 'life', 'max', 'size', 'rot', 'vr', 'kind', 'up'];

/* ---------- 큰 효과 ---------- */
let fx = [], rings = [], flashes = [], texts = [], nums = [], banner = null, cutin = null;
let dim = 0, hitstop = 0, slowmo = 0;
const MAX_FX = 16, MAX_RINGS = 18, MAX_NUMS = 24, MAX_TEXTS = 10;
function pushFx(f) { if (fx.length >= MAX_FX) { fx[0].end?.(); fx.shift(); } fx.push(f); }
function ring(x, y, r1, dur, rgb, w = 1.6, delay = 0) { if (rings.length < MAX_RINGS) rings.push({ x, y, r1, dur, rgb, w, t: -delay }); }
// 빛 번짐: glow 재료(미리 번지게 그린 그림)에 색을 입혀 더하기로 — blur 없음
function flash(x, y, r, dur, rgb = '255,255,255', delay = 0, k = 'glow') { if (flashes.length < 24) flashes.push({ x, y, r, dur, img: rgb === '255,255,255' && k !== 'glow' ? mat[k] : tint(k, rgb), t: -delay, k }); }
function shake(v) { cam.trauma = Math.min(1, cam.trauma + v); }
function stop(ms) { hitstop = Math.max(hitstop, ms / 1000); }
// DOM 막: 속성 색(잠깐 화면에 색) · 반전 섬광 · 가장자리 어둡게(필살 때 진하게)
const tintEl = $('#tint'), vigEl = $('#vig');
let tintT = 0;
function screenTint(el, a = .16) { tintEl.style.background = `rgb(${EL_RGB[el] || '255,255,255'})`; tintEl.style.transition = 'none'; tintEl.style.opacity = a; tintT = .12; }
function whiteFlash(a) { flashEl.style.transition = 'none'; flashEl.style.opacity = Math.min(.85, a); requestAnimationFrame(() => { flashEl.style.transition = 'opacity .28s ease-out'; flashEl.style.opacity = 0; }); }
const flashEl = $('#flash');
function invertFlash() { cvs.classList.add('inv'); setTimeout(() => cvs.classList.remove('inv'), 70); setTimeout(() => { cvs.classList.add('inv'); setTimeout(() => cvs.classList.remove('inv'), 45); }, 120); }

function bolt(x0, y0, x1, y1, rough, depth, out) {
  if (depth === 0) { out.push(x1, y1); return; }
  const mx = (x0 + x1) / 2 + rr(-rough, rough), my = (y0 + y1) / 2 + rr(-rough, rough) * .4;
  bolt(x0, y0, mx, my, rough / 2, depth - 1, out); bolt(mx, my, x1, y1, rough / 2, depth - 1, out);
}
function makeBolt(x, y) {
  const top = y - 95, pts = [x + rr(-10, 10), top]; bolt(pts[0], top, x, y, 30, 4, pts);
  const branches = [];
  for (let b = 0; b < 3; b++) { const i = 2 * (3 + (rnd() * 10 | 0)), bx = pts[i], by = pts[i + 1], br = [bx, by]; bolt(bx, by, bx + rr(-20, 20), by + rr(12, 26), 10, 3, br); branches.push(br); }
  return { pts, branches };
}
function strokePts(pts) { ctx.beginPath(); ctx.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]); ctx.stroke(); }
// 재료 한 장을 월드 좌표에 돌려 그리기(가로 재료는 왼쪽 끝 기준)
function drawMat(img, x, y, w, h, rot = 0, alpha = 1, leftAnchor = false) { ctx.globalAlpha = alpha; ctx.save(); ctx.translate(x, y); if (rot) ctx.rotate(rot); ctx.drawImage(img, leftAnchor ? 0 : -w / 2, -h / 2, w, h); ctx.restore(); ctx.globalAlpha = 1; }

// 박자: ① 기 모으기(사거리 · 빛 모임 · 이름표 · 소리) → ② 발사 → ③ 맞음(0.06초 멈춤 · 흰 번쩍 · 찌그러짐 · 밀림 · 숫자) → ④ 자국
function lightning(target, from) {
  const x = target.x, y = target.y; let b = makeBolt(x, y), age = 0;
  pill(from, '번개 낙하', 'star'); sfx('charge', .6);
  flash(x, y - 2, 12, .3, EL_RGB.star); addGather(x, y, 20, 1, 12, .28);
  later(.28, () => {
    sfx('thunder'); screenTint('star', .14);
    pushFx({ dur: .55, t: 0, draw(dt) {
      age += dt; if (age > .09) { age = 0; b = makeBolt(x, y); }
      const fade = 1 - this.t / this.dur, k = fade * (this.t < .06 ? 1.4 : 1);
      ctx.globalCompositeOperation = 'lighter'; ctx.lineJoin = 'miter'; ctx.lineCap = 'round';
      if (T.glow) { ctx.strokeStyle = `rgba(140,120,255,${.25 * k})`; ctx.lineWidth = 9; strokePts(b.pts); }
      ctx.strokeStyle = `rgba(170,200,255,${.6 * k})`; ctx.lineWidth = 3.6; strokePts(b.pts); ctx.lineWidth = 1.6; for (const br of b.branches) strokePts(br);
      ctx.strokeStyle = `rgba(255,255,255,${k})`; ctx.lineWidth = 1.5; strokePts(b.pts); ctx.lineWidth = .6; for (const br of b.branches) strokePts(br);
      // 땅에 튀는 작은 번개(재료 bolt) 3줄이 깜빡임
      if (this.t > .04) for (let i = 0; i < 3; i++) if (rnd() < .6) drawMat(mat.bolt, x, y, rr(10, 16), rr(3, 5), rnd() * TAU, k * .9, true);
      ctx.globalCompositeOperation = 'source-over';
    } });
    later(.05, () => {
      flash(x, y, 26, .3); flash(x, y, 40, .45, '150,190,255'); flash(x, y, 18, .25, '255,255,255', 0, 'burst');
      ring(x, y, 22, .45, '255,255,255', 2.2); ring(x, y, 32, .6, '150,200,255', 1.4, .06); ring(x, y, 42, .75, '150,200,255', .8, .12);
      radial2(x, y, 12, 6, 32, EL_RGB.star, .28);
      addDebris(x, y, 26, 2, .8); addSmoke(x, y, 6, 0, 4, 3); addSparks(x, y, 30, 3, 70, 2.2); addGlow(x, y, 10, 4, 18, 2.4, .35);
      whiteFlash(.5); shake(.55); cam.punch += .05;
      stamp('scorch', x, y, 16, 16, rnd() * TAU, .9); stamp('crack-star', x, y, 18, 18, rnd() * TAU, .85, 2);
      hit(target, 18 + (rnd() * 8 | 0), rnd() < .35 ? 'crit' : 'hit', from); status(target, '감전!');
    });
  });
}
// 방사선: 불꽃 줄 재료(streak)를 바깥으로
function radial2(x, y, n, r0, r1, rgb, dur) {
  const angs = Array.from({ length: n }, () => [rnd() * TAU, rr(.7, 1.2)]), img = tint('streak', rgb);
  pushFx({ dur, t: 0, draw() {
    const p = this.t / this.dur, a = 1 - p, ra = r0 + (r1 - r0) * easeOut(p);
    ctx.globalCompositeOperation = 'lighter';
    for (const [g, s] of angs) drawMat(img, x + Math.cos(g) * ra * .5, y + Math.sin(g) * ra * .5, ra * .9 * s, 2.2 * a + .4, g, a, true);
    ctx.globalCompositeOperation = 'source-over';
  } });
}
// 굵은 광선(불 · 물): 가장자리가 물결치는 띠 4겹 + 재료(불꽃 혀 · 물방울)
function beam(from, target, el = 'flame') {
  const ang = Math.atan2(target.y - from.y, target.x - from.x), c = Math.cos(ang), s = Math.sin(ang), L = 150, water = el === 'water';
  pill(from, water ? '물대포' : '화염 광선', el); sfx('charge', .7);
  const ox = from.x + c * 5, oy = from.y + s * 5 - 3;
  addGather(ox, oy, 36, water ? 3 : 2, 13, .4); flash(ox, oy, 10, .45, EL_RGB[el]);
  range(from, 0, .45, EL_RGB[el], ang, L);
  later(.42, () => {
    sfx(water ? 'water' : 'fire'); screenTint(el, .12);
    shake(.35); cam.punch += .03;
    if (water) stamp('crack-line', ox + c * 40, oy + s * 40, 70, 12, ang, .25, 1); else { stamp('scorch', ox + c * 30, oy + s * 30, 30, 8, ang, .45); stamp('scorch', ox + c * 75, oy + s * 75, 34, 9, ang, .38, 1); }
    for (let i = 1; i <= 4; i++) later(i * .12, () => { for (const p of pets) if (p.alive && p.team !== from.team && distToRay(p, ox, oy, c, s, L) < 7) { hit(p, 6 + (rnd() * 4 | 0), i === 4 && rnd() < .5 ? 'super' : 'hit', from, ang); if (water) { addDebris(p.x, p.y - 2, 6, 5, .6); addSmoke(p.x, p.y, 2, 2, 3, 2); } else addGlow(p.x, p.y - 3, 8, 0, 22, 1.6, .5, null, TAU, 8); } });
    const layers = water
      ? (T.glow ? [[7, 'rgba(40,120,255,.35)', 1.6], [4.6, 'rgba(80,190,255,.75)', 1], [2.4, 'rgba(200,245,255,.95)', .6], [1, 'rgba(255,255,255,1)', .2]] : [[4.6, 'rgba(70,170,255,.8)', 1], [1.6, 'rgba(230,250,255,1)', .3]])
      : (T.glow ? [[7.5, 'rgba(255,90,30,.35)', 1.6], [4.6, 'rgba(255,150,50,.7)', 1], [2.4, 'rgba(255,230,140,.95)', .6], [1, 'rgba(255,255,255,1)', .2]] : [[4.6, 'rgba(255,130,40,.8)', 1], [1.6, 'rgba(255,250,220,1)', .3]]);
    pushFx({ dur: .78, t: 0, draw() {
      const p = this.t / this.dur, wpx = (p < .12 ? p / .12 : p > .8 ? (1 - p) / .2 : 1) * (1 + .12 * Math.sin(this.t * 60));
      ctx.save(); ctx.translate(ox, oy); ctx.rotate(ang); ctx.globalCompositeOperation = 'lighter';
      for (const [w, col, wob] of layers) {
        const hw = w * wpx; ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(0, -hw * .5);
        for (let x = 0; x <= L; x += 6) ctx.lineTo(x, -hw - Math.sin(x * .35 - this.t * 38) * wob - Math.sin(x * .9 + this.t * 21) * wob * .5);
        for (let x = L; x >= 0; x -= 6) ctx.lineTo(x, hw + Math.sin(x * .31 - this.t * 41 + 1) * wob + Math.sin(x * .8 - this.t * 17) * wob * .5);
        ctx.lineTo(0, hw * .5); ctx.closePath(); ctx.fill();
      }
      ctx.restore(); ctx.globalCompositeOperation = 'source-over';
      if (water) { if (rnd() < .7) addDebris(ox + c * rr(10, 90), oy + s * rr(10, 90), 1, 5, .3, .4); }
      else if (rnd() < .8) addGlow(ox + c * rr(4, 30), oy + s * rr(4, 30), 2, 1, 36, 3.2, .35, ang, .5);
      if (rnd() < .3) addSmoke(ox + c * rr(20, 80), oy + s * rr(20, 80), 1, water ? 2 : 0, 3, 2);
    } });
    flash(ox, oy, 16, .8, water ? '200,240,255' : '255,220,120'); flash(ox, oy, 24, .8, EL_RGB[el]);
  });
}
function distToRay(p, ox, oy, c, s, L) { const dx = p.x - ox, dy = p.y - oy, t = clamp(dx * c + dy * s, 0, L); return Math.hypot(dx - c * t, dy - s * t); }
function range(who, r, dur, rgb, ang = null, len = 0) {
  pushFx({ dur, t: 0, layer: 'ground', draw() {
    const a = Math.min(1, this.t / .12) * (1 - Math.max(0, this.t - dur + .12) / .12), x = who.rx ?? who.x, y = who.ry ?? who.y;
    ctx.fillStyle = `rgba(${rgb},${.13 * a})`; ctx.strokeStyle = `rgba(${rgb},${.7 * a})`; ctx.lineWidth = .5;
    if (ang == null) { ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); ctx.stroke(); }
    else { ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.fillRect(0, -3.5, len, 7); ctx.strokeRect(0, -3.5, len, 7); ctx.restore(); }
  } });
}
function quake(from) {
  pill(from, '대지 붕괴', 'earth'); sfx('charge', .5);
  const R = 30; range(from, R, .5, '255,210,120');
  later(.45, () => {
    const x = from.x, y = from.y + 3;
    sfx('boom'); screenTint('earth', .14);
    shake(.9); cam.punch += .08; whiteFlash(.22);
    ring(x, y, R * .9, .5, '255,235,190', 2.6); ring(x, y, R * 1.25, .7, '200,170,120', 1.6, .08);
    const cracks = growCracks(x, y, R * 1.05, 9);
    pushFx({ dur: .35, t: 0, layer: 'ground', cracks, draw() { drawCracks(ctx, this.cracks, this.t / this.dur); }, end() { drawCracks(fctx, this.cracks, 1); scar(3); } });
    stamp('crater', x, y, 22, 20, 0, .9);
    spikes(x, y, R * .8, 12);
    addDebris(x, y, 90, 0, 1.15); addDebris(x, y, 30, 2, .9);
    addSmoke(x, y, 22, 1, 6, R * .7);
    for (const p of pets) if (p.alive && p.team !== from.team && Math.hypot(p.x - x, p.y - y) < R + 4) { hit(p, 22 + (rnd() * 10 | 0), 'super', from); status(p, '기절!'); }
    shout(from, '효과 굉장!', 'earth');
  });
}
function growCracks(x, y, R, n) {
  const segs = [];
  const walk = (sx, sy, a, len, w, depth) => {
    let cx = sx, cy = sy;
    while (len > 0) { const st = rr(1.2, 2.6); a += rr(-.38, .38); const nx = cx + Math.cos(a) * st, ny = cy + Math.sin(a) * st; segs.push([cx, cy, nx, ny, w, Math.hypot(nx - x, ny - y) / R]); cx = nx; cy = ny; len -= st; w *= .93; if (depth < 1 && rnd() < .1) walk(cx, cy, a + rr(-.9, .9), len * .45, w * .7, depth + 1); }
  };
  for (let i = 0; i < n; i++) walk(x, y, i / n * TAU + rr(-.2, .2), R * rr(.55, 1), rr(.55, .85), 0);
  return segs;
}
function crackLine(L) { const segs = []; let x = 0, y = 0, a = 0, w = .5; while (x < L) { const st = rr(1.6, 3); a = clamp(a + rr(-.5, .5), -.5, .5); const nx = x + Math.cos(a) * st, ny = y + Math.sin(a) * st; segs.push([x, y, nx, ny, w * (1 - Math.abs(x / L - .5)) * 2, 0]); if (rnd() < .12) segs.push([nx, ny, nx + rr(-3, 3), ny + rr(-3, 3), w * .5, 0]); x = nx; y = ny; } return segs; }
function drawCracks(g, segs, p, flat = false) {
  g.lineCap = 'round';
  g.strokeStyle = 'rgba(58,38,22,.85)';
  for (const s of segs) if (s[5] <= p * 1.05) { g.lineWidth = s[4]; g.beginPath(); g.moveTo(s[0], s[1]); g.lineTo(s[2], s[3]); g.stroke(); }
  if (flat) return;
  g.strokeStyle = 'rgba(255,240,200,.4)';
  for (const s of segs) if (s[5] <= p * 1.05) { g.lineWidth = s[4] * .35; g.beginPath(); g.moveTo(s[0] + .35, s[1] + .35); g.lineTo(s[2] + .35, s[3] + .35); g.stroke(); }
}
function spikes(cx, cy, R, n) {
  const list = Array.from({ length: n }, (_, i) => { const a = i / n * TAU + rr(-.2, .2), d = R * rr(.45, 1); return { x: cx + Math.cos(a) * d, y: cy + Math.sin(a) * d * .9, h: rr(6, 11), w: rr(2.2, 3.6), lean: rr(-.25, .25), delay: d / R * .12 }; });
  list.sort((a, b) => a.y - b.y);
  pushFx({ dur: 1.15, t: 0, layer: 'world', draw() {
    for (const s of list) {
      const t = this.t - s.delay; if (t < 0) continue;
      const up = t < .12 ? easeOut(t / .12) : t > .85 ? Math.max(0, 1 - (t - .85) / .2) : 1, h = s.h * up;
      if (h <= .1) continue;
      const tipX = s.x + s.lean * h, tipY = s.y - h;
      ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(s.x, s.y, s.w * 1.1, s.w * .45, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#8c7a62'; ctx.beginPath(); ctx.moveTo(s.x - s.w, s.y); ctx.lineTo(tipX, tipY); ctx.lineTo(s.x, s.y + s.w * .3); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#5e5040'; ctx.beginPath(); ctx.moveTo(s.x + s.w, s.y); ctx.lineTo(tipX, tipY); ctx.lineTo(s.x, s.y + s.w * .3); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(30,22,14,.8)'; ctx.lineWidth = .3; ctx.beginPath(); ctx.moveTo(s.x - s.w, s.y); ctx.lineTo(tipX, tipY); ctx.lineTo(s.x + s.w, s.y); ctx.stroke();
    }
  }, end() { for (const s of list) addDebris(s.x, s.y - 2, 3, 0, .35, .5); } });
}
function frost(target, from) {
  pill(from, '얼음 창', 'ice');
  const x = target.x, y = target.y;
  later(.2, () => {
    sfx('ice'); screenTint('ice', .12);
    flash(x, y, 20, .35, EL_RGB.ice); flash(x, y, 14, .5, '255,255,255', 0, 'frost'); ring(x, y, 18, .4, '200,240,255', 1.6);
    addDebris(x, y, 26, 1, .7); addSmoke(x, y, 6, 2, 4, 3); addGlow(x, y, 8, 3, 14, 2.6, .6);
    const g = fctx; const gr = g.createRadialGradient(x, y, 0, x, y, 10); gr.addColorStop(0, 'rgba(225,245,255,.7)'); gr.addColorStop(1, 'rgba(200,235,255,0)'); g.fillStyle = gr; g.beginPath(); g.arc(x, y, 10, 0, TAU); g.fill();
    g.save(); g.globalAlpha = .22; g.globalCompositeOperation = 'lighter'; g.drawImage(mat.frost, x - 8, y - 8, 16, 16); g.restore(); scar(1);
    shake(.25); hit(target, 12 + (rnd() * 6 | 0), 'hit', from); status(target, '얼어붙음!');
  });
}
function poison(target, from) {
  pill(from, '맹독 웅덩이', 'toxic'); sfx('water', .5);
  const x = target.x + rr(-4, 4), y = target.y + rr(-2, 4), blob = Array.from({ length: 14 }, () => rr(.75, 1.15));
  const bub = Array.from({ length: 5 }, () => ({ a: rnd() * TAU, d: rnd(), t: rnd() }));
  addSmoke(x, y, 6, 3, 4, 5); screenTint('toxic', .1);
  pushFx({ dur: 3.2, t: 0, layer: 'ground', draw(dt) {
    const p = this.t / this.dur, grow = Math.min(1, this.t / .25), fade = p > .8 ? (1 - p) / .2 : 1, R = 10 * grow;
    ctx.globalAlpha = fade; ctx.fillStyle = 'rgba(120,40,170,.55)'; ctx.beginPath();
    blob.forEach((k, i) => { const a = i / blob.length * TAU, rx = x + Math.cos(a) * R * k, ry = y + Math.sin(a) * R * k * .7; i ? ctx.lineTo(rx, ry) : ctx.moveTo(rx, ry); }); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(220,150,255,.35)'; ctx.beginPath(); ctx.ellipse(x - R * .25, y - R * .2, R * .35, R * .14, -.3, 0, TAU); ctx.fill();
    for (const b of bub) { b.t += dt * 1.2; if (b.t > 1) { b.t = 0; b.a = rnd() * TAU; b.d = rnd(); } const bx = x + Math.cos(b.a) * R * .7 * b.d, by = y + Math.sin(b.a) * R * .5 * b.d, s = .8 + b.t * 2.2; ctx.globalAlpha = fade * (b.t < .85 ? 1 : (1 - b.t) / .15); ctx.drawImage(mat.bubble, bx - s / 2, by - s / 2, s, s); }
    ctx.globalAlpha = 1;
    if (rnd() < .05) addSmoke(x, y, 1, 3, 3, R * .6);
  }, end() { const g = fctx, gr = g.createRadialGradient(x, y, 0, x, y, 10); gr.addColorStop(0, 'rgba(110,40,140,.28)'); gr.addColorStop(1, 'rgba(110,40,140,0)'); g.fillStyle = gr; g.beginPath(); g.ellipse(x, y, 10, 7, 0, 0, TAU); g.fill(); scar(1); } });
  later(.3, () => { addDebris(x, y, 10, 6, .5, .6); hit(target, 8, 'hit', from); status(target, '중독!'); });
}
// 바람 · 풀: 속도선과 함께 돌진해 베고, 잎 · 꽃잎이 흩날린다
function gale(from, target) {
  pill(from, '질풍 베기', 'wind'); sfx('wind');
  const ang = Math.atan2(target.y - from.y, target.x - from.x);
  addGlow(from.x, from.y, 4, 4, 4, 2, .3);
  pushFx({ dur: .45, t: 0, draw() {
    const p = this.t / this.dur, a = p < .2 ? p / .2 : 1 - (p - .2) / .8, x = lerp(from.rx ?? from.x, target.rx ?? target.x, Math.min(1, p * 1.6)), y = lerp(from.ry ?? from.y, target.ry ?? target.y, Math.min(1, p * 1.6));
    ctx.globalCompositeOperation = 'lighter';
    drawMat(tint('speed', EL_RGB.wind), x, y - 4, 26, 9, ang + Math.PI, a * .9, true);
    drawMat(tint('swirl', EL_RGB.wind), x, y - 3, 16 + p * 10, 16 + p * 10, this.t * 9, a * .8);
    ctx.globalCompositeOperation = 'source-over';
  } });
  later(.25, () => {
    for (let i = 0; i < 3; i++) later(i * .08, () => { if (!target.alive) return; hit(target, 5 + (rnd() * 3 | 0), 'hit', from, ang); addSparks(target.x, target.y - 4, 8, 0, 80, 2.4, ang + rr(-.6, .6), .5); });
    addDebris(target.x, target.y, 14, 3, .6, .7); addDebris(target.x, target.y, 10, 4, .6, .7); addSmoke(target.x, target.y, 3, 4, 4, 3);
    screenTint('wind', .1); shake(.25);
  });
}
// 필살기: 컷인(펫 얼굴 + 속도선이 화면을 가로지름) → 주변 어둡게 → 반전 섬광 → 큰 폭발 · 파편 200개
function ultimate(from) {
  const enemies = pets.filter(p => p.alive && p.team !== from.team); if (!enemies.length) return;
  const tgt = enemies[0];
  cutin = { pet: from, t: 0, dur: .8, name: '은하 폭발!', el: 'star' }; sfx('ult'); dim = 1; vigEl.classList.add('ult');
  later(.8, () => {
    const x = tgt.x, y = tgt.y;
    range({ x, y }, 26, .7, '255,230,120');
    addGather(x, y, 60, 1, 30, .65); flash(x, y, 18, .7, '255,214,90'); addGlow(x, y, 20, 2, 14, 3, .7);
    later(.7, () => {
      sfx('boom', 1.2); invertFlash(); stop(140); shake(1); cam.punch += .12; whiteFlash(.75); screenTint('star', .22);
      flash(x, y, 46, .5); flash(x, y, 70, .9, '255,214,90'); flash(x, y, 30, .45, '255,255,255', 0, 'burst');
      for (let i = 0; i < 3; i++) ring(x, y, 30 + i * 14, .55 + i * .15, i ? '255,220,120' : '255,255,255', 3 - i * .8, i * .07);
      radial2(x, y, 18, 8, 52, '255,240,190', .4);
      addDebris(x, y, 160, 0, 1.4, 1.2); addDebris(x, y, 40, 2, 1.1);
      addSmoke(x, y, 26, 0, 7, 18); addSmoke(x, y, 10, 1, 6, 10); addSparks(x, y, 60, 1, 110, 2.6); addGlow(x, y, 40, 2, 40, 3, 1.1, null, TAU, -4); addGlow(x, y, 6, 4, 30, 4, .5);
      stamp('scorch', x, y, 34, 34, rnd() * TAU, 1); stamp('crater', x, y, 26, 24, 0, .9); stamp('crack-star', x, y, 42, 42, rnd() * TAU, 1, 3);
      for (const p of enemies) if (Math.hypot(p.x - x, p.y - y) < 32) hit(p, 34 + (rnd() * 10 | 0), 'crit', from);
      setTimeout(() => vigEl.classList.remove('ult'), 500);
    });
  });
}

/* ---------- 맞음 · 숫자 · 글자 ---------- */
function hit(p, dmg, style, from, dirAng) {
  if (!p.alive) return;
  p.hp = Math.max(0, p.hp - dmg); hudDirty = true;
  const dx = dirAng != null ? Math.cos(dirAng) : p.x - (from?.x ?? p.x), dy = dirAng != null ? Math.sin(dirAng) : p.y - (from?.y ?? p.y - 1), d = Math.hypot(dx, dy) || 1;
  // 맞는 순간 0.06초 멈춤 → 밀려남 · 흰 번쩍 · 찌그러졌다 펴짐(스프링) · 잔상
  stop(style === 'crit' ? 110 : 60);
  p.kx = dx / d * 3.2; p.ky = dy / d * 3.2; p.flash = .1; p.sq = -.28; p.sv = 0; p.trailT = .25;
  cam.punch += style === 'crit' ? .05 : .015;
  sfx('hit', style === 'crit' ? 1.3 : .8);
  const recent = nums.filter(n => n.p === p && n.t < .4).length;
  if (nums.length >= MAX_NUMS) nums.shift();
  nums.push({ p, v: dmg, style, t: 0, ox: (recent % 2 ? 1 : -1) * Math.ceil(recent / 2) * 5, oy: -recent * 2.5 });
  if (style === 'crit') { shout(p, '급소!', 'star'); shake(.3); flash(p.x, p.y - 5, 10, .3, '255,255,255', 0, 'star'); }
  if (p.hp <= 0) faint(p);
}
function pill(p, text, el) { pushText({ kind: 'pill', p, text, el, t: 0, dur: 1.1 }); }
function shout(p, text, el) { if (texts.some(t => t.kind === 'shout' && t.t < .5)) return; pushText({ kind: 'shout', p, text, el, t: 0, dur: .9 }); }
function status(p, text) { if (texts.some(t => t.kind === 'status' && t.p === p && t.t < .6)) return; pushText({ kind: 'status', p, text, el: 'star', t: 0, dur: 1 }); }
function pushText(o) { for (let i = texts.length - 1; i >= 0; i--) if (texts[i].p === o.p && texts[i].kind === o.kind) texts.splice(i, 1); if (texts.length >= MAX_TEXTS) texts.shift(); texts.push(o); }
function faint(p) {
  p.alive = false; p.back = 60; p.dead = 0.0001; hudDirty = true;
  banner = { text: `${PET_NAME[p.k]} 쓰러짐!`, t: 0, dur: 1.7, team: p.team };
  sfx('faint'); stop(150); shake(.6); slowmo = .7; cam.punch += .06;
  addSmoke(p.x, p.y, 10, 0, 5, 4); addSparks(p.x, p.y - 4, 30, 0, 80, 2); addGlow(p.x, p.y - 4, 10, 4, 20, 2.5, .6);
}

/* ---------- 시간표: 자동으로 반복하는 시연(13초) ---------- */
let clock = 0, timers = [];
function later(s, fn) { timers.push({ at: clock + s, fn }); }
function pick(team) { const l = pets.filter(p => p.alive && p.team === team); return l[(rnd() * l.length) | 0]; }
const SCRIPT = [
  [0, () => { const a = pick(0), b = pick(1); a && b && lightning(b, a); }],
  [1.5, () => { const a = pick(1), b = pick(0); a && b && beam(a, b, 'flame'); }],
  [3.3, () => { const a = pick(0); a && quake(a); }],
  [5.0, () => { const a = pick(1), b = pick(0); a && b && frost(b, a); }],
  [5.6, () => { const a = pick(0), b = pick(1); a && b && poison(b, a); }],
  [6.6, () => { const a = pick(0), b = pick(1); a && b && beam(a, b, 'water'); }],
  [8.1, () => { const a = pick(1), b = pick(0); a && b && gale(a, b); }],
  [9.2, () => { const a = pick(1), b = pick(0); if (a && b) { lightning(b, a); later(.25, () => { const c = pick(0); c && lightning(c, a); }); } }],
  [10.6, () => { const a = pick(0); a && ultimate(a); }]
];
const CYCLE = 13;
let cycleStart = 0, scriptI = 0;
function runScript() {
  while (scriptI < SCRIPT.length && clock - cycleStart >= SCRIPT[scriptI][0]) SCRIPT[scriptI++][1]();
  if (clock - cycleStart >= CYCLE) { cycleStart = clock; scriptI = 0; stats.cycles++; }
}

/* ---------- HUD(DOM, 바뀔 때만 고침) ---------- */
let hudDirty = true, timeLeft = 120;
function buildHud() {
  for (const team of [0, 1]) $(team ? '#team-b' : '#team-a').innerHTML = pets.filter(p => p.team === team).map(p => `<div class="mon" data-k="${p.k}"><i class="face" style="background-image:url(/assets/pets/${p.k}-3-s.webp)"></i><div class="bar"><i></i></div></div>`).join('');
  hudDirty = true;
}
function updateHud() {
  for (const p of pets) {
    const el = document.querySelector(`.mon[data-k="${p.k}"]`); if (!el) continue;
    const r = p.hp / p.max, bar = el.querySelector('.bar i');
    bar.style.transform = `scaleX(${r})`; bar.className = r < .3 ? 'low' : r < .6 ? 'mid' : '';
    el.classList.toggle('out', !p.alive);
  }
  hudDirty = false;
}

/* ---------- 그리기 ---------- */
const stats = { frames: 0, debrisMax: 0, smokeMax: 0, sparksMax: 0, glowsMax: 0, fxMax: 0, heals: 0, cycles: 0, tierDrops: 0, tierLog: [], matArt: 0, cutins: 0 };
window.__fx = stats;
function world(k, ox, oy) { ctx.setTransform(k, 0, 0, k, ox, oy); }

function render(dt, alpha) {
  // 연출 시간: 히트스톱이면 0, 쓰러짐 느린 동작이면 0.35배
  const fdt = hitstop > 0 ? 0 : slowmo > 0 ? dt * .35 : dt;
  const live = pets.filter(p => p.alive);
  let minX = WW, maxX = 0, minY = WH, maxY = 0;
  for (const p of pets) { p.rx = lerp(p.px, p.x, alpha); p.ry = lerp(p.py, p.y, alpha); }
  for (const p of live.length ? live : pets) { minX = Math.min(minX, p.rx); maxX = Math.max(maxX, p.rx); minY = Math.min(minY, p.ry); maxY = Math.max(maxY, p.ry); }
  const viewH = cssH / ppu;
  cam.tz = clamp(Math.min(VIEW_W / (maxX - minX + 40), (viewH - 30) / (maxY - minY + 60)), .9, 1.18);
  const follow = 1 - Math.exp(-dt * 3.2);
  cam.z += (cam.tz - cam.z) * follow;
  cam.punch = Math.min(cam.punch, .2);
  const vz = cam.z + cam.punch, vw = VIEW_W / vz, vh = viewH / vz;
  cam.x += ((minX + maxX) / 2 - cam.x) * follow; cam.y += ((minY + maxY) / 2 + 4 - cam.y) * follow;
  cam.x = clamp(cam.x, vw / 2 - 6, WW - vw / 2 + 6); cam.y = clamp(cam.y, vh / 2 - 26, WH - vh / 2 + 10);
  cam.punch *= Math.exp(-dt * 7); cam.trauma = Math.max(0, cam.trauma - dt * 1.6);
  const sh = cam.trauma * cam.trauma * 2.2, tt = performance.now() / 1000;
  const sx = sh * (Math.sin(tt * 71) + Math.sin(tt * 113) * .5), sy = sh * (Math.sin(tt * 89 + 1) + Math.sin(tt * 127) * .5);
  const k = ppu * vz * S, ox = cvs.width / 2 - (cam.x + sx) * k, oy = cvs.height / 2 - (cam.y + sy) * k;

  // 1) 바닥(땅 + 구워진 자국) — 보이는 부분만 잘라 그림 1장
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  const x0 = clamp(-ox / k, 0, WW), y0 = clamp(-oy / k, 0, WH), x1 = clamp((cvs.width - ox) / k, 0, WW), y1 = clamp((cvs.height - oy) / k, 0, WH);
  if (ox + x0 * k > 0 || oy + y0 * k > 0 || ox + x1 * k < cvs.width || oy + y1 * k < cvs.height) { ctx.fillStyle = '#2f4a2a'; ctx.fillRect(0, 0, cvs.width, cvs.height); }
  if (x1 > x0 && y1 > y0) ctx.drawImage(field, x0 * FPX, y0 * FPX, (x1 - x0) * FPX, (y1 - y0) * FPX, ox + x0 * k, oy + y0 * k, (x1 - x0) * k, (y1 - y0) * k);
  world(k, ox, oy);
  for (const f of fx) if (f.layer === 'ground') f.draw(fdt);
  if (dim > 0) { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = `rgba(8,6,24,${.5 * Math.min(1, dim)})`; ctx.fillRect(0, 0, cvs.width, cvs.height); world(k, ox, oy); dim = Math.max(0, dim - fdt * .75); }
  drawSmoke(fdt);
  drawPets(fdt);
  for (const f of fx) if (f.layer === 'world') f.draw(fdt);
  drawDebris(k, ox, oy, fdt);
  for (const f of fx) if (!f.layer) f.draw(fdt);
  drawRings(fdt); drawFlashes(fdt); drawGlows(k, ox, oy, fdt); drawSparks(fdt);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  drawNums(k, ox, oy, fdt); drawTexts(k, ox, oy, fdt); drawBanner(dt); drawCutin(dt);

  for (let i = fx.length - 1; i >= 0; i--) { const f = fx[i]; f.t += fdt; if (f.t >= f.dur) { f.end?.(); fx.splice(i, 1); } }
  hitstop = Math.max(0, hitstop - dt); slowmo = Math.max(0, slowmo - dt);
  if (tintT > 0) { tintT -= dt; if (tintT <= 0) { tintEl.style.transition = 'opacity .5s ease-out'; tintEl.style.opacity = 0; } }
  stats.debrisMax = Math.max(stats.debrisMax, D.n); stats.smokeMax = Math.max(stats.smokeMax, M.n); stats.sparksMax = Math.max(stats.sparksMax, K.n); stats.glowsMax = Math.max(stats.glowsMax, G.n); stats.fxMax = Math.max(stats.fxMax, fx.length);
}
function drawPets(dt) {
  const order = [...pets].sort((a, b) => a.ry - b.ry);
  for (const p of order) {
    const s = SPR.pets[p.k]; if (!s) continue;
    p.bob += dt * 5; p.flash = Math.max(0, p.flash - dt);
    // 찌그러짐 스프링(맞으면 납작 → 길쭉 → 제자리, 0.35초)
    if (dt) { const acc = -260 * p.sq - 14 * p.sv; p.sv += acc * dt; p.sq += p.sv * dt; }
    p.kx *= Math.exp(-dt * 10); p.ky *= Math.exp(-dt * 10);
    let a = 1, drop = 0;
    if (!p.alive) { p.dead += dt; a = Math.max(0, 1 - p.dead / .6); drop = p.dead * 6; if (a <= 0) continue; }
    const x = p.rx + p.kx, y = p.ry + p.ky, wq = PET_U * (1 - p.sq * .9), hq = PET_U * (1 + p.sq);
    // 잔상: 밀려나는 동안 지나온 자리에 옅은 그림 3장(중간 이상 품질)
    if (T.trail) {
      p.trailT = Math.max(0, p.trailT - dt);
      if (p.trailT > 0 && dt) { p.trail.unshift([x, y]); if (p.trail.length > 4) p.trail.pop(); } else if (!p.trailT) p.trail.length = 0;
      for (let i = 1; i < p.trail.length; i++) { ctx.globalAlpha = .28 * (1 - i / 4) * a; ctx.drawImage(s.white, p.trail[i][0] - PET_U / 2, p.trail[i][1] - PET_U - 1, PET_U, PET_U); }
    }
    ctx.globalAlpha = .9 * a; ctx.drawImage(SPR.shadow, x - wq * .45, y - PET_U * .12, wq * .9, PET_U * .3);
    const bob = p.alive ? Math.sin(p.bob) * .4 : 0;
    ctx.globalAlpha = a; ctx.drawImage(s.body, x - wq / 2, y - hq + bob + drop - 1, wq, hq);
    if (p.flash > 0) { ctx.globalAlpha = Math.min(1, p.flash / .1); ctx.drawImage(s.white, x - wq / 2, y - hq + bob - 1, wq, hq); }
    ctx.globalAlpha = 1;
    ctx.strokeStyle = p.team ? 'rgba(255,90,90,.85)' : 'rgba(74,168,255,.85)'; ctx.lineWidth = .45; ctx.beginPath(); ctx.ellipse(x, y, PET_U * .42, PET_U * .14, 0, 0, TAU); ctx.stroke();
  }
}
function drawDebris(k, ox, oy, dt) {
  for (let j = D.n - 1; j >= 0; j--) {
    D.life[j] -= dt; if (D.life[j] <= 0) { swapOut(D, j, --D.n, DKEYS); continue; }
    if (dt) {
      const fl = DEB_FLOAT[D.kind[j]];
      D.vz[j] -= (fl ? 35 : 120) * dt; if (fl && D.vz[j] < -6) D.vz[j] = -6;
      D.z[j] += D.vz[j] * dt; D.x[j] += D.vx[j] * dt + (fl ? Math.sin(D.life[j] * 6 + j) * 4 * dt : 0); D.y[j] += D.vy[j] * dt; D.rot[j] += D.vr[j] * dt;
      if (D.z[j] < 0) { D.z[j] = 0; D.vz[j] *= -.32; D.vx[j] *= .55; D.vy[j] *= .55; D.vr[j] *= .5; if (Math.abs(D.vz[j]) < 3) D.vz[j] = 0; }
    }
  }
  if (!D.n) return;
  if (tier === 3) { ctx.globalAlpha = .35; for (let j = 0; j < D.n; j++) if (D.z[j] > 1.5) { const s = D.size[j] * 1.6; ctx.drawImage(SPR.shadow, D.x[j] - s / 2, D.y[j] - s * .2, s, s * .4); } ctx.globalAlpha = 1; }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  for (let j = 0; j < D.n; j++) {
    const set = DEB_MAT[D.kind[j]], img = mat[set[j % set.length]], s = D.size[j] * 2.2 * k, c = Math.cos(D.rot[j]), sn = Math.sin(D.rot[j]), iw = s / img.width;
    ctx.globalAlpha = Math.min(1, D.life[j] / .4);
    ctx.setTransform(c * iw, sn * iw, -sn * iw, c * iw, ox + D.x[j] * k, oy + (D.y[j] - D.z[j]) * k);
    ctx.drawImage(img, -img.width / 2, -img.height / 2);
  }
  ctx.globalAlpha = 1; world(k, ox, oy);
}
function drawSmoke(dt) {
  for (let j = M.n - 1; j >= 0; j--) {
    M.life[j] -= dt; if (M.life[j] <= 0) { swapOut(M, j, --M.n, MKEYS); continue; }
    M.x[j] += M.vx[j] * dt; M.y[j] += M.vy[j] * dt; M.vx[j] *= 1 - dt * 1.5; M.vy[j] *= 1 - dt * 1.5; M.r[j] += M.vr[j] * dt; M.vr[j] *= 1 - dt * .8; M.rot[j] += dt * .4;
  }
  for (let j = 0; j < M.n; j++) {
    const p = 1 - M.life[j] / M.max[j], a = M.a[j] * (p < .15 ? p / .15 : 1 - (p - .15) / .85), r = M.r[j], [mk2, rgb] = PUFF[M.kind[j]];
    ctx.globalAlpha = a; ctx.drawImage(tint(mk2, rgb), M.x[j] - r, M.y[j] - r, r * 2, r * 2);
  }
  ctx.globalAlpha = 1;
}
function drawGlows(k, ox, oy, dt) {
  for (let j = G.n - 1; j >= 0; j--) {
    G.life[j] -= dt; if (G.life[j] <= 0) { swapOut(G, j, --G.n, GKEYS); continue; }
    G.x[j] += G.vx[j] * dt; G.y[j] += G.vy[j] * dt - G.up[j] * dt; G.vx[j] *= 1 - dt * 2; G.vy[j] *= 1 - dt * 2; G.rot[j] += G.vr[j] * dt;
  }
  if (!G.n) return;
  ctx.globalCompositeOperation = 'lighter'; ctx.setTransform(1, 0, 0, 1, 0, 0);
  for (let j = 0; j < G.n; j++) {
    const [mk2, rgb] = GLOW_MAT[G.kind[j]], img = rgb === '255,255,255' ? mat[mk2] : tint(mk2, rgb), p = G.life[j] / G.max[j], [ga, gs] = adj(mk2);
    const s = G.size[j] * gs * k * (G.kind[j] === 1 ? .6 + p * .6 : 1), iw = s / img.width, c = Math.cos(G.rot[j]), sn = Math.sin(G.rot[j]);
    ctx.globalAlpha = Math.min(1, p * 2) * ga;
    ctx.setTransform(c * iw, sn * iw, -sn * iw, c * iw, ox + G.x[j] * k, oy + G.y[j] * k);
    ctx.drawImage(img, -img.width / 2, -img.height / 2);
  }
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; world(k, ox, oy);
}
function drawSparks(dt) {
  for (let j = K.n - 1; j >= 0; j--) {
    K.life[j] -= dt; if (K.life[j] <= 0) { swapOut(K, j, --K.n, KKEYS); continue; }
    K.x[j] += K.vx[j] * dt; K.y[j] += K.vy[j] * dt; const d = 1 - K.drag[j] * dt; K.vx[j] *= d; K.vy[j] *= d;
  }
  if (!K.n) return;
  ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round'; ctx.lineWidth = .45;
  for (let c = 0; c < SPARK_COL.length; c++) {
    let any = false; ctx.beginPath();
    for (let j = 0; j < K.n; j++) { if (K.col[j] !== c) continue; any = true; const sp = Math.hypot(K.vx[j], K.vy[j]) || 1, l = K.len[j] * (K.life[j] / K.max[j]); ctx.moveTo(K.x[j], K.y[j]); ctx.lineTo(K.x[j] - K.vx[j] / sp * l, K.y[j] - K.vy[j] / sp * l); }
    if (any) { ctx.strokeStyle = SPARK_COL[c]; ctx.stroke(); }
  }
  ctx.globalCompositeOperation = 'source-over';
}
// 충격파 고리: 재료(ring)를 키우며 그린다(높음 · 중간), 낮은 단계는 선 하나
function drawRings(dt) {
  ctx.globalCompositeOperation = 'lighter';
  for (let i = rings.length - 1; i >= 0; i--) {
    const r = rings[i]; r.t += dt; if (r.t >= r.dur) { rings.splice(i, 1); continue; } if (r.t < 0) continue;
    const p = r.t / r.dur, a = (1 - p) * (1 - p), R = r.r1 * easeOut(p);
    if (T.glow) { const [ga] = adj('ring'); ctx.globalAlpha = a * ga; const img = tint('ring', r.rgb), s = R * 2 * (256 / 208); ctx.drawImage(img, r.x - s / 2, r.y - s * .44, s, s * .88); ctx.globalAlpha = 1; }
    else { ctx.strokeStyle = `rgba(${r.rgb},${a})`; ctx.lineWidth = r.w * (1 - p * .6); ctx.beginPath(); ctx.ellipse(r.x, r.y, R, R * .88, 0, 0, TAU); ctx.stroke(); }
  }
  ctx.globalCompositeOperation = 'source-over';
}
function drawFlashes(dt) {
  ctx.globalCompositeOperation = 'lighter';
  for (let i = flashes.length - 1; i >= 0; i--) {
    const f = flashes[i]; f.t += dt; if (f.t >= f.dur) { flashes.splice(i, 1); continue; } if (f.t < 0) continue;
    const [ga, gs] = adj(f.k), p = f.t / f.dur, a = (p < .1 ? 1 : 1 - (p - .1) / .9) * ga, r = f.r * gs * (.6 + .4 * easeOut(p));
    ctx.globalAlpha = a; ctx.drawImage(f.img, f.x - r, f.y - r, r * 2, r * 2);
  }
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
}
function drawNums(k, ox, oy, dt) {
  for (let i = nums.length - 1; i >= 0; i--) {
    const n = nums[i]; n.t += dt; if (n.t > 1) { nums.splice(i, 1); continue; }
    const A = SPR.digits[n.style], str = String(n.v), t = n.t;
    const pop = t < .1 ? 1.7 - 7 * t : t < .16 ? 1 + (.16 - t) * 2 : 1, rise = easeOut(Math.min(1, t / .55)) * 7, a = t > .75 ? (1 - t) / .25 : 1;
    const x = ox + (n.p.rx + n.ox) * k, y = oy + (n.p.ry - PET_U - 2 - rise + n.oy) * k;
    const sc = pop * (n.style === 'crit' ? 1 : .92), w = A.adv * str.length * sc;
    ctx.globalAlpha = a;
    if (n.style === 'crit') { ctx.save(); ctx.translate(x, y); ctx.rotate(-.12); ctx.translate(-x, -y); }
    for (let d = 0; d < str.length; d++) { const v = str.charCodeAt(d) - 48; ctx.drawImage(A.c, v * A.cw, 0, A.cw, A.ch, x - w / 2 + d * A.adv * sc - (A.cw - A.adv) * sc / 2, y - A.ch * sc / 2, A.cw * sc, A.ch * sc); }
    if (n.style === 'crit') ctx.restore();
  }
  ctx.globalAlpha = 1;
}
function drawTexts(k, ox, oy, dt) {
  for (let i = texts.length - 1; i >= 0; i--) {
    const o = texts[i]; o.t += dt; if (o.t > o.dur) { texts.splice(i, 1); continue; }
    const s = textSprite(o.text, o.kind, o.el), t = o.t, a = t > o.dur - .2 ? (o.dur - t) / .2 : 1;
    const px = ox + (o.p.rx ?? o.p.x) * k, py = oy + (o.p.ry ?? o.p.y) * k;
    let x = px, y = py, sc = 1, rot = 0;
    if (o.kind === 'pill') { y = py + 6 * k; sc = t < .12 ? .6 + t / .12 * .4 : 1; }
    else if (o.kind === 'shout') { y = py - (PET_U + 9) * k; sc = t < .1 ? 2 - t * 10 : 1; rot = -.14; }
    else { y = py - PET_U * .45 * k - easeOut(Math.min(1, t / .4)) * 2 * k; x = px + PET_U * .75 * k; }
    x = clamp(x, s.w * sc / 2 + 4, cvs.width - s.w * sc / 2 - 4); y = clamp(y, 90 * S, cvs.height - 70 * S);
    ctx.globalAlpha = a; ctx.save(); ctx.translate(x, y); if (rot) ctx.rotate(rot); ctx.drawImage(s.c, -s.w * sc / 2, -s.h * sc / 2, s.w * sc, s.h * sc); ctx.restore();
  }
  ctx.globalAlpha = 1;
}
function drawBanner(dt) {
  if (!banner) return;
  banner.t += dt; const b = banner, t = b.t; if (t > b.dur) { banner = null; return; }
  const W = cvs.width, H = cvs.height, cy = H * .42, bh = 64 * S;
  const inP = easeOut(Math.min(1, t / .22)), outP = t > b.dur - .25 ? (t - (b.dur - .25)) / .25 : 0, x = (1 - inP) * -W + outP * W;
  ctx.save(); ctx.translate(x, 0);
  const gr = ctx.createLinearGradient(0, 0, W, 0); gr.addColorStop(0, 'rgba(10,8,22,0)'); gr.addColorStop(.18, 'rgba(10,8,22,.86)'); gr.addColorStop(.82, 'rgba(10,8,22,.86)'); gr.addColorStop(1, 'rgba(10,8,22,0)');
  ctx.fillStyle = gr; ctx.fillRect(0, cy - bh / 2, W, bh);
  ctx.fillStyle = b.team ? '#ff5a5a' : '#4aa8ff'; ctx.fillRect(W * .12, cy - bh / 2, W * .76, 3 * S); ctx.fillRect(W * .12, cy + bh / 2 - 3 * S, W * .76, 3 * S);
  const s = textSprite(b.text, 'banner'), sc = t < .3 ? 1.25 - (t / .3) * .25 : 1;
  ctx.drawImage(s.c, W / 2 - s.w * sc / 2, cy - s.h * sc / 2, s.w * sc, s.h * sc);
  ctx.restore();
}
// 필살 컷인: 비스듬한 띠 + 속도선(재료 speed, 속성 색) + 펫 얼굴이 오른쪽에서 들어와 가운데서 잠깐 멈췄다 왼쪽으로 빠짐 + 기술 이름
function drawCutin(dt) {
  if (!cutin) return;
  const c = cutin; c.t += dt; if (c.t > c.dur) { cutin = null; stats.cutins++; return; }
  const W = cvs.width, H = cvs.height, t = c.t / c.dur, cy = H * .38, bh = Math.min(H * .26, 240 * S);
  const open = t < .15 ? easeOut(t / .15) : t > .85 ? 1 - (t - .85) / .15 : 1;
  ctx.save(); ctx.translate(W / 2, cy); ctx.rotate(-.12); ctx.scale(1, open);
  ctx.fillStyle = 'rgba(12,10,30,.92)'; ctx.fillRect(-W, -bh / 2, W * 2, bh);
  ctx.fillStyle = `rgb(${EL_RGB[c.el]})`; ctx.fillRect(-W, -bh / 2, W * 2, 4 * S); ctx.fillRect(-W, bh / 2 - 4 * S, W * 2, 4 * S);
  ctx.globalCompositeOperation = 'lighter';
  const sp = tint('speed', EL_RGB[c.el]), n = T.cutLines;
  for (let i = 0; i < n; i++) { const yy = (-.45 + .9 * ((i * 0.618) % 1)) * bh, len = W * (.5 + ((i * .37) % .5)), xx = W * .9 - ((c.t * 2.6 * W + i * 97 * S) % (W * 2.2)); ctx.globalAlpha = .55; ctx.drawImage(sp, xx, yy - 10 * S, len, 22 * S); }
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  const big = SPR.pets[c.pet.k]?.big;
  if (big) { const bw = big.width, slide = t < .3 ? 1 - easeOut(t / .3) : t > .7 ? -easeOut((t - .7) / .3) : 0, bx = slide * W * .9 - bw * .2; ctx.drawImage(big, bx - bw / 2, -bw * .55, bw, bw); }
  const s = textSprite(c.name, 'cut', c.el), sc = t < .25 ? 1.6 - t / .25 * .6 : 1;
  ctx.drawImage(s.c, W * .12 - s.w * sc / 2 + (t < .25 ? (1 - t / .25) * -W * .3 : 0), bh * .18 - s.h * sc / 2, s.w * sc, s.h * sc);
  ctx.restore();
}

/* ---------- 고리: 고정 틱 + 보간, 자동 품질 ---------- */
let last = 0, acc = 0, paused = false, frameLog = [], lastTierCheck = 0, hudTimer = 0;
function frame(now) {
  requestAnimationFrame(frame);
  if (!last) { last = now; return; }
  let dt = (now - last) / 1000; last = now;
  if (paused) return;
  frameLog.push(dt * 1000);
  if (dt > .2) (stats.stalls ||= []).push(`${(clock - cycleStart).toFixed(1)}s/${Math.round(dt * 1000)}ms/fx${fx.length}/d${D.n}`);
  dt = Math.min(dt, .1);
  acc += dt * 1000;
  let steps = 0; while (acc >= TICK && steps < 5) { tickSim(); acc -= TICK; steps++; }
  if (steps === 5) acc = 0;
  const fdt = hitstop > 0 ? 0 : slowmo > 0 ? dt * .35 : dt;
  clock += fdt; stats.t = clock;
  for (let i = timers.length - 1; i >= 0; i--) if (clock >= timers[i].at) { const f = timers[i].fn; timers.splice(i, 1); f(); }
  if (FX_ON) runScript();
  render(dt, acc / TICK);
  stats.frames++;
  hudTimer += dt; if (hudTimer > 1) { hudTimer = 0; timeLeft = timeLeft > 0 ? timeLeft - 1 : 120; $('#timer').textContent = `${Math.floor(timeLeft / 60)}:${String(timeLeft % 60).padStart(2, '0')}`; }
  if (hudDirty) updateHud();
  if (now - lastTierCheck > 2000) { lastTierCheck = now; autoTier(); showDbg(); }
}
// 자동 품질: 2초 동안 20ms 넘은 프레임이 15% 넘으면 한 단계, 50% 넘으면 두 단계 내린다(올리지는 않음 → 들쭉날쭉 방지)
function autoTier() {
  const log = frameLog; frameLog = [];
  if (!log.length) return;
  const slow = log.filter(d => d > 20).length / log.length, avg = log.reduce((a, b) => a + b, 0) / log.length;
  stats.lastAvg = Math.round(avg * 10) / 10; stats.lastSlow = Math.round(slow * 100);
  if (auto && slow > .15 && tier > 0 && stats.frames > 90) { setTier(Math.max(0, tier - (slow > .5 ? 2 : 1))); stats.tierDrops++; stats.tierLog.push(`${(performance.now() / 1000).toFixed(0)}s→${tier}`); }
}
function setTier(t) { tier = t; T = TIERS[t]; D.n = Math.min(D.n, T.debris); M.n = Math.min(M.n, T.smoke); K.n = Math.min(K.n, T.sparks); G.n = Math.min(G.n, T.glows); resize(); const old = field; buildGroundKeep(old); stats.tier = t; markButtons(); }
function buildGroundKeep(old) { const sc = scars; buildGround(); fctx.save(); fctx.setTransform(1, 0, 0, 1, 0, 0); fctx.drawImage(old, 0, 0, field.width, field.height); fctx.restore(); scars = sc; }
function showDbg() {
  const mem = performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) + 'MB' : '-', snd = soundState();
  $('#dbg').textContent = `fps ${stats.lastAvg ? Math.round(1000 / stats.lastAvg) : '-'} · 느린 ${stats.lastSlow ?? '-'}%\n품질 ${T.name}${auto ? '(자동)' : ''} ×${S}\n파편 ${D.n} 연기 ${M.n} 빛 ${G.n} 불꽃 ${K.n}\n자국 ${scars}/${SCAR_CAP} 힙 ${mem}\n재료 그림 ${matFromArt.size}/${MAT_KEYS.length} · 소리 ${snd.on ? (snd.muted ? '끔' : '켬') : '탭하면 켜짐'}`;
}
function markButtons() { for (const b of document.querySelectorAll('#bar button')) b.classList.toggle('on', b.dataset.q === (auto ? 'auto' : String(tier)) || b.dataset.pets === String(PETS_N) || (b.dataset.act === 'pause' && paused) || (b.dataset.act === 'mute' && soundState().muted)); }
$('#bar').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.dataset.q) { auto = b.dataset.q === 'auto'; setTier(auto ? 3 : Number(b.dataset.q)); }
  if (b.dataset.pets) { PETS_N = Number(b.dataset.pets); makePets(); resetField(); }
  if (b.dataset.act === 'pause') paused = !paused;
  if (b.dataset.act === 'clean') document.body.classList.add('clean');
  if (b.dataset.act === 'mute') { setMuted(!soundState().muted); b.textContent = soundState().muted ? '소리 켜기' : '소리 끄기'; }
  markButtons(); showDbg();
});
// 소리는 첫 터치 뒤에만(브라우저 규칙). 터치마다 한 번 깨워 둔다(가벼움).
addEventListener('pointerdown', unlockSound, { passive: true });
addEventListener('keydown', unlockSound);
cvs.addEventListener('click', () => document.body.classList.remove('clean'));
addEventListener('resize', () => { resize(); });

await Promise.all([loadPets(), loadMatArt(), document.fonts.load('20px Jua', '0123 쓰러짐번개'), document.fonts.load('20px Jua', '0123')]).catch(() => {});
buildMats(); stats.matArt = matFromArt.size;
resize(); buildGround(); makePets(); markButtons(); stats.tier = tier;
stats.canvasMB = () => Math.round([cvs, field, ground].reduce((a, c) => a + c.width * c.height * 4, 0) / 1048576 * 10) / 10;
requestAnimationFrame(frame);
