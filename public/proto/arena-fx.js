// 펫 아레나 캔버스 연출 시험(측정용, 앱과 연결하지 않음). docs/arena-battle-reboot-plan.md · docs/arena-fx-perf.mjs.
// 무엇을 보나: DOM/CSS 대신 전투 장면만 Canvas 2D로 그렸을 때, 번개 · 광선 · 지진(바닥 금 누적) · 파편 200개 · 연기 · 충격파 ·
//   데미지 숫자 · 쓰러짐 배너가 폰에서 부드럽게 도는지.
// 구조(실제 앱으로 옮길 때도 같은 모양):
//   - 고정 틱 20Hz(50ms, arena-rules.js ARENA.TICK_MS와 같은 간격)로 펫 위치를 움직이고, 그리기는 화면 주사율로 앞뒤 틱 사이를 보간한다.
//   - 연출(파편 · 연기 · 글자)은 그리기 쪽 시간만 쓴다. 히트스톱은 연출 시간만 멈추고 틱(=규칙)은 멈추지 않는다.
//   - 바닥 자국은 그때그때 그리지 않고 "경기장 그림 한 장"에 구워 넣는다 → 자국이 몇 개가 쌓여도 매 프레임 비용은 그림 1장.
//   - 큰 그림(펫 · 연기 · 빛 · 돌 · 숫자 · 글자)은 처음에 작은 캔버스로 한 번 만들어 두고 drawImage만 한다(매 프레임 그라디언트 · 글자 만들기 없음).
//   - 저사양 단계 3개(해상도 · 파편 수 · 빛 겹 수)를 프레임 시간을 보고 자동으로 내린다.
// 주소 옵션: ?q=auto|2|1|0(품질) &pets=2|4 &clean=1(버튼 · 측정 글자 숨김) &seed=숫자

const P = new URLSearchParams(location.search);
const $ = s => document.querySelector(s);
const cvs = $('#stage');
const ctx = cvs.getContext('2d', { alpha: false, desynchronized: true });

/* ---------- 품질 단계 ---------- */
const TIERS = [
  { name: '낮음', scale: 1, debris: 90, smoke: 28, sparks: 90, mult: 0.4, glow: false, fieldPx: 4 },
  { name: '중간', scale: 1.5, debris: 200, smoke: 56, sparks: 180, mult: 0.7, glow: true, fieldPx: 6 },
  { name: '높음', scale: 2, debris: 400, smoke: 96, sparks: 320, mult: 1, glow: true, fieldPx: 8 }
];
const qArg = P.get('q') || 'auto';
let auto = qArg === 'auto';
let tier = auto ? 2 : Math.max(0, Math.min(2, Number(qArg) | 0));
let T = TIERS[tier];
let PETS_N = P.get('pets') === '2' ? 2 : 4;
if (P.get('clean') === '1') document.body.classList.add('clean');
const FX_ON = P.get('fx') !== '0';   // ?fx=0: 효과 없이 바닥 · 펫만(바탕 비용 재기)

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
let cssW = 390, cssH = 844, S = 2;     // 화면 크기 · 그리기 배율(기기 배율 × 품질)
let ppu = cssW / VIEW_W;
const cam = { x: WW / 2, y: WH / 2, z: 1, tz: 1, punch: 0, trauma: 0 };

function resize() {
  cssW = innerWidth; cssH = innerHeight;
  S = Math.min(devicePixelRatio || 1, T.scale);
  cvs.width = Math.round(cssW * S); cvs.height = Math.round(cssH * S);
  ppu = cssW / VIEW_W;
  buildSprites();
}

/* ---------- 바닥: 처음 한 번 그린 땅(ground) + 자국이 구워지는 경기장(field) ---------- */
let ground, field, fctx, FPX = 8, scars = 0;
const SCAR_CAP = 36;                  // 자국 도장이 이만큼 넘으면 경기장을 25%씩 "아물게" 한다(아래 healField)
function buildGround() {
  FPX = T.fieldPx;
  ground = mk(WW * FPX, WH * FPX);
  const g = ground.getContext('2d');
  g.scale(FPX, FPX);
  // 바깥(경기장 밖): 짙은 숲 바닥
  g.fillStyle = '#2f4a2a'; g.fillRect(0, 0, WW, WH);
  // 경기장 판: 밝은 풀밭 + 얼룩
  const r0 = 8;
  g.save(); roundRect(g, 4, 4, WW - 8, WH - 8, r0); g.clip();
  const lg = g.createLinearGradient(0, 0, 0, WH); lg.addColorStop(0, '#8cbf62'); lg.addColorStop(1, '#73a650'); g.fillStyle = lg; g.fillRect(0, 0, WW, WH);
  for (let i = 0; i < 520; i++) { const x = rr(0, WW), y = rr(0, WH), r = rr(2, 9); g.fillStyle = `hsla(${rr(82, 108)},${rr(30, 48)}%,${rr(38, 56)}%,${rr(.08, .22)})`; g.beginPath(); g.ellipse(x, y, r, r * rr(.5, 1), rr(0, TAU), 0, TAU); g.fill(); }
  // 흙길 자국
  for (let i = 0; i < 26; i++) { const x = rr(10, WW - 10), y = rr(10, WH - 10), r = rr(4, 11); g.fillStyle = `rgba(176,146,98,${rr(.18, .35)})`; g.beginPath(); g.ellipse(x, y, r, r * rr(.4, .8), rr(0, TAU), 0, TAU); g.fill(); }
  // 풀잎 · 꽃 · 작은 돌
  g.lineCap = 'round';
  for (let i = 0; i < 900; i++) { const x = rr(0, WW), y = rr(0, WH); g.strokeStyle = `hsla(${rr(85, 115)},45%,${rr(26, 40)}%,.55)`; g.lineWidth = .28; g.beginPath(); g.moveTo(x, y); g.lineTo(x + rr(-.6, .6), y - rr(.8, 1.8)); g.stroke(); }
  for (let i = 0; i < 70; i++) { const x = rr(6, WW - 6), y = rr(6, WH - 6); g.fillStyle = ['#fff6d8', '#ffd1e3', '#ffe680'][i % 3]; g.beginPath(); g.arc(x, y, rr(.35, .6), 0, TAU); g.fill(); }
  for (let i = 0; i < 40; i++) { const x = rr(6, WW - 6), y = rr(6, WH - 6), r = rr(.5, 1.2); g.fillStyle = 'rgba(0,0,0,.18)'; g.beginPath(); g.ellipse(x + .3, y + .3, r, r * .7, 0, 0, TAU); g.fill(); g.fillStyle = '#b9b4a6'; g.beginPath(); g.ellipse(x, y, r, r * .7, 0, 0, TAU); g.fill(); }
  // 가운데 원 · 선(경기장 느낌)
  g.strokeStyle = 'rgba(255,255,255,.22)'; g.lineWidth = .7;
  g.beginPath(); g.arc(WW / 2, WH / 2, 18, 0, TAU); g.stroke();
  g.beginPath(); g.moveTo(10, WH / 2); g.lineTo(WW - 10, WH / 2); g.stroke();
  g.restore();
  // 테두리: 돌 턱
  g.lineWidth = 2.4; g.strokeStyle = '#d8cfb8'; roundRect(g, 4, 4, WW - 8, WH - 8, r0); g.stroke();
  g.lineWidth = .6; g.strokeStyle = 'rgba(70,55,40,.6)'; roundRect(g, 2.9, 2.9, WW - 5.8, WH - 5.8, r0 + 1); g.stroke();
  for (let i = 0; i < 70; i++) { const t = i / 70, p = edgePoint(t); g.fillStyle = 'rgba(90,75,55,.35)'; g.fillRect(p[0] - .15, p[1] - .15, .3, .3); }
  resetField();
}
function edgePoint(t) { const per = 2 * (WW - 8) + 2 * (WH - 8); let d = t * per; if (d < WW - 8) return [4 + d, 4]; d -= WW - 8; if (d < WH - 8) return [WW - 4, 4 + d]; d -= WH - 8; if (d < WW - 8) return [WW - 4 - d, WH - 4]; d -= WW - 8; return [4, WH - 4 - d]; }
function resetField() { field = mk(ground.width, ground.height); fctx = field.getContext('2d'); fctx.drawImage(ground, 0, 0); fctx.setTransform(FPX, 0, 0, FPX, 0, 0); scars = 0; }
function roundRect(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
function scar(n = 1) { scars += n; if (scars > SCAR_CAP) healField(); }
// 자국 상한: 땅 그림을 25% 덮어 오래된 자국부터 옅어진다(개별 자국 목록을 들고 있지 않음 → 메모리 일정)
function healField() { fctx.save(); fctx.setTransform(1, 0, 0, 1, 0, 0); fctx.globalAlpha = .25; fctx.drawImage(ground, 0, 0); fctx.restore(); scars = Math.round(scars * .75); stats.heals++; }

/* ---------- 미리 만든 작은 그림(스프라이트) ---------- */
const SPR = {};
const PET_KEYS = ['tiger', 'gumiho', 'dragon', 'bear'];
const PET_NAME = { tiger: '호랑이', gumiho: '구미호', dragon: '드래곤', bear: '곰' };
const PET_EL = { tiger: 'star', gumiho: 'toxic', dragon: 'flame', bear: 'earth' };
const petImg = {};
function loadPets() {
  return Promise.all(PET_KEYS.map(k => new Promise(res => { const im = new Image(); im.decoding = 'async'; im.onload = () => { petImg[k] = im; res(); }; im.onerror = res; im.src = `/assets/pets/${k}-3.webp`; })));
}
function glowSprite(color, size = 64) {
  const c = mk(size, size), g = c.getContext('2d'), r = size / 2;
  const gr = g.createRadialGradient(r, r, 0, r, r, r); gr.addColorStop(0, color); gr.addColorStop(.35, color.replace(/[\d.]+\)$/, '.45)')); gr.addColorStop(1, color.replace(/[\d.]+\)$/, '0)'));
  g.fillStyle = gr; g.fillRect(0, 0, size, size); return c;
}
function puffSprite(rgb, size = 64) {
  const c = mk(size, size), g = c.getContext('2d'), r = size / 2;
  for (let i = 0; i < 7; i++) { const a = i / 7 * TAU, d = r * .28, x = r + Math.cos(a) * d * rnd(), y = r + Math.sin(a) * d * rnd(); const gr = g.createRadialGradient(x, y, 0, x, y, r * .62); gr.addColorStop(0, `rgba(${rgb},.55)`); gr.addColorStop(1, `rgba(${rgb},0)`); g.fillStyle = gr; g.fillRect(0, 0, size, size); }
  return c;
}
function rockSprite(base, size = 24, ice = false) {
  const c = mk(size, size), g = c.getContext('2d'), r = size / 2, n = 6 + (rnd() * 3 | 0), pts = [];
  for (let i = 0; i < n; i++) { const a = i / n * TAU + rr(-.3, .3), d = r * rr(.55, .95); pts.push([r + Math.cos(a) * d, r + Math.sin(a) * d]); }
  g.beginPath(); pts.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.closePath();
  const gr = g.createLinearGradient(0, 0, size, size); gr.addColorStop(0, ice ? '#f2fbff' : shade(base, 40)); gr.addColorStop(.55, base); gr.addColorStop(1, shade(base, -45));
  g.fillStyle = gr; g.fill(); g.lineWidth = Math.max(1, size / 18); g.strokeStyle = ice ? 'rgba(80,140,200,.8)' : 'rgba(30,22,16,.75)'; g.stroke();
  g.fillStyle = 'rgba(255,255,255,.35)'; g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); g.lineTo(r, r); g.lineTo(pts[n - 1][0], pts[n - 1][1]); g.closePath(); g.fill();
  return c;
}
function shade(hex, amt) { const n = parseInt(hex.slice(1), 16), f = v => clamp(v + amt, 0, 255); return `rgb(${f(n >> 16)},${f(n >> 8 & 255)},${f(n & 255)})`; }
function petSprites(k) {
  const im = petImg[k]; if (!im) return null;
  const px = Math.round(PET_U * ppu * S);
  // 512px → 절반씩 줄여 부드럽게(매 프레임 큰 그림을 줄이지 않는다)
  let src = im, w = im.width;
  while (w / 2 > px * 1.2) { const c = mk(w / 2, w / 2); c.getContext('2d').drawImage(src, 0, 0, w / 2, w / 2); src = c; w /= 2; }
  const body = mk(px, px); body.getContext('2d').drawImage(src, 0, 0, px, px);
  const white = mk(px, px), wg = white.getContext('2d'); wg.drawImage(body, 0, 0); wg.globalCompositeOperation = 'source-in'; wg.fillStyle = '#fff'; wg.fillRect(0, 0, px, px);
  return { body, white, px };
}
function buildSprites() {
  const u = ppu * S;
  SPR.glowW = glowSprite('rgba(255,255,255,1)', 96);
  SPR.glowY = glowSprite('rgba(255,214,90,1)', 96);
  SPR.glowO = glowSprite('rgba(255,120,40,1)', 96);
  SPR.glowB = glowSprite('rgba(110,190,255,1)', 96);
  SPR.glowP = glowSprite('rgba(190,90,255,1)', 96);
  SPR.puff = { dust: puffSprite('170,140,100'), smoke: puffSprite('70,70,78'), steam: puffSprite('235,240,255'), poison: puffSprite('150,70,190') };
  const rs = Math.max(12, Math.round(2.2 * u));
  SPR.rock = [rockSprite('#8a7a66', rs), rockSprite('#7b6c5a', rs), rockSprite('#9a8c78', rs), rockSprite('#6e5f4f', rs)];
  SPR.ice = [rockSprite('#9fd6f5', rs, true), rockSprite('#bde6ff', rs, true)];
  SPR.dirt = [rockSprite('#8f6b45', rs), rockSprite('#a07b52', rs)];
  const sh = mk(64, 32), sg = sh.getContext('2d'), gr = sg.createRadialGradient(32, 16, 0, 32, 16, 32); gr.addColorStop(0, 'rgba(0,0,0,.42)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); sg.setTransform(1, 0, 0, .5, 0, 8); sg.fillStyle = gr; sg.fillRect(0, -16, 64, 64); SPR.shadow = sh;
  SPR.pets = {}; for (const k of PET_KEYS) SPR.pets[k] = petSprites(k);
  SPR.text = new Map(); buildDigits();
}

/* ---------- 글자: 숫자 아틀라스 + 한국어 글자 그림(한 번 만들고 다시 씀) ---------- */
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
// kind: pill(기술 이름표) · shout(크고 기울어진 외침) · status(상태 글자) · banner(쓰러짐 배너 글자)
const PILL_COLOR = { star: '#ffd84a', flame: '#ff7a3a', earth: '#c99a5b', toxic: '#c06cff', ice: '#7fd4ff' };
function textSprite(text, kind, el = 'star') {
  const key = kind + '|' + el + '|' + text; let s = SPR.text.get(key); if (s) return s;
  const fs = { pill: 15, shout: 34, status: 17, banner: 40 }[kind] * S;
  const m = mk(4, 4).getContext('2d'); m.font = `${fs}px Jua, system-ui, sans-serif`; const tw = m.measureText(text).width;
  const padX = kind === 'pill' ? 12 * S : 10 * S, w = Math.ceil(tw + padX * 2), h = Math.ceil(fs * 1.7);
  const c = mk(w, h), g = c.getContext('2d'); g.font = m.font; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
  if (kind === 'pill') {
    roundRect(g, 2 * S, 3 * S, w - 4 * S, h - 6 * S, (h - 6 * S) / 2); g.fillStyle = 'rgba(16,20,40,.88)'; g.fill(); g.lineWidth = 2 * S; g.strokeStyle = PILL_COLOR[el] || '#fff'; g.stroke();
    g.fillStyle = '#fff'; g.fillText(text, w / 2, h / 2 + S);
  } else if (kind === 'shout') {
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
    return { k, team, el: PET_EL[k], x, y, px: x, py: y, tx: x, ty: y, hp: 100, max: 100, alive: true, back: 0, flash: 0, kx: 0, ky: 0, squash: 0, bob: rnd() * TAU, dead: 0 };
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
const DMAX = 400, SMAX = 96, KMAX = 320;
// 파편(돌 · 얼음 · 흙): 높이 z로 튀어 올랐다 떨어져 굴러 멈춘다
const D = { x: new Float32Array(DMAX), y: new Float32Array(DMAX), z: new Float32Array(DMAX), vx: new Float32Array(DMAX), vy: new Float32Array(DMAX), vz: new Float32Array(DMAX), rot: new Float32Array(DMAX), vr: new Float32Array(DMAX), life: new Float32Array(DMAX), max: new Float32Array(DMAX), size: new Float32Array(DMAX), kind: new Uint8Array(DMAX), n: 0 };
// 연기 · 흙먼지
const M = { x: new Float32Array(SMAX), y: new Float32Array(SMAX), r: new Float32Array(SMAX), vr: new Float32Array(SMAX), vx: new Float32Array(SMAX), vy: new Float32Array(SMAX), life: new Float32Array(SMAX), max: new Float32Array(SMAX), a: new Float32Array(SMAX), kind: new Uint8Array(SMAX), n: 0 };
// 불꽃 줄(더하기 합성, 색마다 한 번에 그림)
const K = { x: new Float32Array(KMAX), y: new Float32Array(KMAX), vx: new Float32Array(KMAX), vy: new Float32Array(KMAX), life: new Float32Array(KMAX), max: new Float32Array(KMAX), len: new Float32Array(KMAX), col: new Uint8Array(KMAX), drag: new Float32Array(KMAX), n: 0 };
const SPARK_COL = ['#ffffff', '#ffe066', '#ff8a3a', '#8fd8ff', '#d68cff', '#e8d2a8'];
const PUFF_KIND = ['dust', 'smoke', 'steam', 'poison'];
const ROCK_KIND = ['rock', 'ice', 'dirt'];

function addDebris(x, y, n, kind = 0, power = 1, up = 1) {
  n = Math.round(n * T.mult);
  for (let i = 0; i < n; i++) {
    if (D.n >= T.debris) return; const j = D.n++;
    const a = rnd() * TAU, sp = rr(.15, 1) * 34 * power;
    D.x[j] = x + rr(-1, 1); D.y[j] = y + rr(-1, 1); D.z[j] = rr(0, 2);
    D.vx[j] = Math.cos(a) * sp; D.vy[j] = Math.sin(a) * sp * .8; D.vz[j] = rr(12, 42) * up * power;
    D.rot[j] = rnd() * TAU; D.vr[j] = rr(-12, 12); D.max[j] = D.life[j] = rr(1.6, 2.8); D.size[j] = rr(.45, 1.35); D.kind[j] = kind;
  }
}
function addSmoke(x, y, n, kind = 0, r = 4, spread = 6) {
  n = Math.max(1, Math.round(n * T.mult));
  for (let i = 0; i < n; i++) {
    if (M.n >= T.smoke) return; const j = M.n++, a = rnd() * TAU, d = rr(0, spread);
    M.x[j] = x + Math.cos(a) * d; M.y[j] = y + Math.sin(a) * d; M.r[j] = r * rr(.6, 1.2); M.vr[j] = r * rr(.8, 1.6);
    M.vx[j] = Math.cos(a) * rr(2, 7); M.vy[j] = Math.sin(a) * rr(2, 6) - rr(1, 3); M.max[j] = M.life[j] = rr(1.1, 2.2); M.a[j] = rr(.55, .9); M.kind[j] = kind;
  }
}
function addSparks(x, y, n, col = 0, speed = 60, len = 1.6, dir = null, spread = TAU) {
  n = Math.round(n * T.mult);
  for (let i = 0; i < n; i++) {
    if (K.n >= T.sparks) return; const j = K.n++, a = dir == null ? rnd() * TAU : dir + rr(-spread / 2, spread / 2), sp = speed * rr(.35, 1);
    K.x[j] = x; K.y[j] = y; K.vx[j] = Math.cos(a) * sp; K.vy[j] = Math.sin(a) * sp; K.max[j] = K.life[j] = rr(.18, .45); K.len[j] = len * rr(.6, 1.3); K.col[j] = col; K.drag[j] = 3.5;
  }
}
// 모이는 불꽃(예비 동작): 둘레에서 가운데로 빨려 든다
function addGather(x, y, n, col, r = 10, dur = .35) {
  n = Math.round(n * T.mult);
  for (let i = 0; i < n; i++) {
    if (K.n >= T.sparks) return; const j = K.n++, a = rnd() * TAU, d = r * rr(.6, 1.2), t = dur * rr(.6, 1);
    K.x[j] = x + Math.cos(a) * d; K.y[j] = y + Math.sin(a) * d; K.vx[j] = -Math.cos(a) * d / t; K.vy[j] = -Math.sin(a) * d / t; K.max[j] = K.life[j] = t; K.len[j] = 1.2; K.col[j] = col; K.drag[j] = 0;
  }
}
function swapOut(A, j, last, keys) { for (const k of keys) A[k][j] = A[k][last]; }
const DKEYS = ['x', 'y', 'z', 'vx', 'vy', 'vz', 'rot', 'vr', 'life', 'max', 'size', 'kind'];
const MKEYS = ['x', 'y', 'r', 'vr', 'vx', 'vy', 'life', 'max', 'a', 'kind'];
const KKEYS = ['x', 'y', 'vx', 'vy', 'life', 'max', 'len', 'col', 'drag'];

/* ---------- 큰 효과(번개 · 광선 · 지진 · 얼음 · 독 · 필살) ---------- */
let fx = [];      // 살아 있는 큰 효과(그리기 함수 + 끝나는 시각)
let rings = [], flashes = [], texts = [], nums = [], banner = null;
let screenFlash = 0, dim = 0, hitstop = 0;
const MAX_FX = 14, MAX_RINGS = 18, MAX_NUMS = 24, MAX_TEXTS = 10;

function ring(x, y, r1, dur, color, w = 1.6, delay = 0) { if (rings.length < MAX_RINGS) rings.push({ x, y, r1, dur, color, w, t: -delay }); }
function flash(x, y, r, dur, spr, delay = 0) { if (flashes.length < 24) flashes.push({ x, y, r, dur, spr, t: -delay }); }
function shake(v) { cam.trauma = Math.min(1, cam.trauma + v); }
function stop(ms) { hitstop = Math.max(hitstop, ms / 1000); }

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

function lightning(target, from) {
  const x = target.x, y = target.y; let b = makeBolt(x, y), age = 0;
  pill(from, '번개 낙하', 'star');
  fx.push({ dur: .55, t: 0, draw(dt) {
    age += dt; if (age > .09) { age = 0; b = makeBolt(x, y); }
    const fade = 1 - this.t / this.dur, k = fade * (this.t < .06 ? 1.4 : 1);
    ctx.globalCompositeOperation = 'lighter'; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.lineJoin = 'miter';
    if (T.glow) { ctx.strokeStyle = `rgba(140,120,255,${.25 * k})`; ctx.lineWidth = 9; strokePts(b.pts); }
    ctx.strokeStyle = `rgba(170,200,255,${.6 * k})`; ctx.lineWidth = 3.6; strokePts(b.pts); ctx.lineWidth = 1.6; for (const br of b.branches) strokePts(br);
    ctx.strokeStyle = `rgba(255,255,255,${k})`; ctx.lineWidth = 1.5; strokePts(b.pts); ctx.lineWidth = .6; for (const br of b.branches) strokePts(br);
    ctx.globalCompositeOperation = 'source-over';
  } });
  later(.05, () => {
    flash(x, y, 26, .3, SPR.glowW); flash(x, y, 40, .45, SPR.glowB);
    ring(x, y, 22, .45, '255,255,255', 2.2); ring(x, y, 32, .6, '150,200,255', 1.4, .06); ring(x, y, 42, .75, '150,200,255', .8, .12);
    radial(x, y, 14, 6, 30, '255,255,255', .25);
    addDebris(x, y, 26, 2, .8); addSmoke(x, y, 6, 1, 4, 3); addSparks(x, y, 30, 3, 70, 2.2);
    screenFlash = Math.max(screenFlash, .55); shake(.55); stop(70); cam.punch = .05;
    scorch(x, y, 7); crackStar(x, y, 9, 5);
    hit(target, 18 + (rnd() * 8 | 0), rnd() < .35 ? 'crit' : 'hit', from); status(target, '감전!');
  });
}
function radial(x, y, n, r0, r1, rgb, dur) {
  const angs = Array.from({ length: n }, () => rnd() * TAU);
  fx.push({ dur, t: 0, draw() {
    const p = this.t / this.dur, a = 1 - p, ra = r0 + (r1 - r0) * easeOut(p), rb = ra + (r1 - r0) * .35 * a;
    ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = `rgba(${rgb},${a})`; ctx.lineWidth = .9 * a + .2; ctx.beginPath();
    for (const g of angs) { const c = Math.cos(g), s = Math.sin(g); ctx.moveTo(x + c * ra, y + s * ra); ctx.lineTo(x + c * rb, y + s * rb); }
    ctx.stroke(); ctx.globalCompositeOperation = 'source-over';
  } });
}
function beam(from, target) {
  const ang = Math.atan2(target.y - from.y, target.x - from.x), c = Math.cos(ang), s = Math.sin(ang), L = 150;
  pill(from, '화염 광선', 'flame');
  const ox = from.x + c * 5, oy = from.y + s * 5 - 3;
  addGather(ox, oy, 36, 2, 13, .4); flash(ox, oy, 10, .45, SPR.glowO);
  range(from, 0, .45, '255,140,60', ang, L);
  later(.42, () => {
    shake(.35); stop(50); scorchLine(ox, oy, ox + c * L, oy + s * L);
    for (let i = 1; i <= 4; i++) later(i * .12, () => { for (const p of pets) if (p.alive && p.team !== from.team && distToRay(p, ox, oy, c, s, L) < 7) { hit(p, 6 + (rnd() * 4 | 0), i === 4 && rnd() < .5 ? 'super' : 'hit', from); addSparks(p.x, p.y - 3, 10, 2, 60, 1.8); } });
    fx.push({ dur: .78, t: 0, draw() {
      const p = this.t / this.dur, wpx = (p < .12 ? p / .12 : p > .8 ? (1 - p) / .2 : 1) * (1 + .12 * Math.sin(this.t * 60));
      ctx.save(); ctx.translate(ox, oy); ctx.rotate(ang); ctx.globalCompositeOperation = 'lighter';
      const layers = T.glow ? [[7.5, 'rgba(255,90,30,.35)', 1.6], [4.6, 'rgba(255,150,50,.7)', 1], [2.4, 'rgba(255,230,140,.95)', .6], [1, 'rgba(255,255,255,1)', .2]] : [[4.6, 'rgba(255,130,40,.8)', 1], [1.6, 'rgba(255,250,220,1)', .3]];
      for (const [w, col, wob] of layers) {
        const hw = w * wpx; ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(0, -hw * .5);
        for (let x = 0; x <= L; x += 6) ctx.lineTo(x, -hw - Math.sin(x * .35 - this.t * 38) * wob - Math.sin(x * .9 + this.t * 21) * wob * .5);
        for (let x = L; x >= 0; x -= 6) ctx.lineTo(x, hw + Math.sin(x * .31 - this.t * 41 + 1) * wob + Math.sin(x * .8 - this.t * 17) * wob * .5);
        ctx.lineTo(0, hw * .5); ctx.closePath(); ctx.fill();
      }
      ctx.restore(); ctx.globalCompositeOperation = 'source-over';
      if (rnd() < .6) addSparks(ox + c * rr(10, 60), oy + s * rr(10, 60), 3, 1, 50, 1.4, ang, .9);
      if (rnd() < .3) addSmoke(ox + c * rr(20, 80), oy + s * rr(20, 80), 1, 1, 3, 2);
    } });
    flash(ox, oy, 16, .8, SPR.glowY); flash(ox, oy, 24, .8, SPR.glowO);
  });
}
function distToRay(p, ox, oy, c, s, L) { const dx = p.x - ox, dy = p.y - oy, t = clamp(dx * c + dy * s, 0, L); return Math.hypot(dx - c * t, dy - s * t); }
function range(who, r, dur, rgb, ang = null, len = 0) {
  fx.push({ dur, t: 0, layer: 'ground', draw() {
    const a = Math.min(1, this.t / .12) * (1 - Math.max(0, this.t - dur + .12) / .12), x = who.rx ?? who.x, y = who.ry ?? who.y;
    ctx.fillStyle = `rgba(${rgb},${.13 * a})`; ctx.strokeStyle = `rgba(${rgb},${.7 * a})`; ctx.lineWidth = .5;
    if (ang == null) { ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); ctx.stroke(); }
    else { ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.fillRect(0, -3.5, len, 7); ctx.strokeRect(0, -3.5, len, 7); ctx.restore(); }
  } });
}
function quake(from) {
  pill(from, '대지 붕괴', 'earth');
  const R = 30; range(from, R, .5, '255,210,120');
  later(.45, () => {
    const x = from.x, y = from.y + 3;
    shake(.9); stop(110); cam.punch = .08; screenFlash = Math.max(screenFlash, .25);
    ring(x, y, R * .9, .5, '255,235,190', 2.6); ring(x, y, R * 1.25, .7, '200,170,120', 1.6, .08);
    const cracks = growCracks(x, y, R * 1.05, 9);
    fx.push({ dur: .35, t: 0, layer: 'ground', cracks, draw() { drawCracks(ctx, this.cracks, this.t / this.dur); }, end() { bakeCracks(this.cracks); } });
    crater(x, y, 9);
    spikes(x, y, R * .8, 12);
    addDebris(x, y, 110, 0, 1.15); addDebris(x, y, 30, 2, .9);
    addSmoke(x, y, 22, 0, 6, R * .7);
    for (const p of pets) if (p.alive && p.team !== from.team && Math.hypot(p.x - x, p.y - y) < R + 4) { hit(p, 22 + (rnd() * 10 | 0), 'super', from); status(p, '기절!'); }
    shout(from, '효과 굉장!', 'earth');
  });
}
// 갈라진 금: 가운데에서 뻗고 가끔 갈래가 난다(삼각함수 없이도 되지만 여기선 연출만)
function growCracks(x, y, R, n) {
  const segs = [];
  const walk = (sx, sy, a, len, w, depth) => {
    let cx = sx, cy = sy;
    while (len > 0) { const st = rr(1.2, 2.6); a += rr(-.38, .38); const nx = cx + Math.cos(a) * st, ny = cy + Math.sin(a) * st; segs.push([cx, cy, nx, ny, w, Math.hypot(nx - x, ny - y) / R]); cx = nx; cy = ny; len -= st; w *= .93; if (depth < 1 && rnd() < .1) walk(cx, cy, a + rr(-.9, .9), len * .45, w * .7, depth + 1); }
  };
  for (let i = 0; i < n; i++) walk(x, y, i / n * TAU + rr(-.2, .2), R * rr(.55, 1), rr(.55, .85), 0);
  return segs;
}
function drawCracks(g, segs, p) {
  g.lineCap = 'round';
  g.strokeStyle = 'rgba(58,38,22,.85)';
  for (const s of segs) if (s[5] <= p * 1.05) { g.lineWidth = s[4]; g.beginPath(); g.moveTo(s[0], s[1]); g.lineTo(s[2], s[3]); g.stroke(); }
  g.strokeStyle = 'rgba(255,240,200,.4)';
  for (const s of segs) if (s[5] <= p * 1.05) { g.lineWidth = s[4] * .35; g.beginPath(); g.moveTo(s[0] + .35, s[1] + .35); g.lineTo(s[2] + .35, s[3] + .35); g.stroke(); }
}
function bakeCracks(segs) { drawCracks(fctx, segs, 1); scar(3); }
function crater(x, y, r) {
  const g = fctx, gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(50,34,20,.65)'); gr.addColorStop(.6, 'rgba(90,64,38,.4)'); gr.addColorStop(1, 'rgba(90,64,38,0)');
  g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
  g.strokeStyle = 'rgba(230,210,170,.35)'; g.lineWidth = .5; g.beginPath(); g.arc(x - .3, y - .3, r * .55, Math.PI * .9, Math.PI * 1.9); g.stroke(); scar(1);
}
function scorch(x, y, r) {
  const g = fctx;
  for (let i = 0; i < 4; i++) { const ox = x + rr(-r * .3, r * .3), oy = y + rr(-r * .3, r * .3), rad = r * rr(.5, 1); const gr = g.createRadialGradient(ox, oy, 0, ox, oy, rad); gr.addColorStop(0, 'rgba(20,14,10,.5)'); gr.addColorStop(1, 'rgba(20,14,10,0)'); g.fillStyle = gr; g.beginPath(); g.arc(ox, oy, rad, 0, TAU); g.fill(); }
  scar(1);
}
function crackStar(x, y, R, n) { bakeCracks(growCracks(x, y, R, n)); }
function scorchLine(x0, y0, x1, y1) {
  const g = fctx; g.lineCap = 'round';
  g.strokeStyle = 'rgba(30,18,10,.16)'; g.lineWidth = 7; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
  g.strokeStyle = 'rgba(25,12,6,.3)'; g.lineWidth = 2.6; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
  g.strokeStyle = 'rgba(255,140,60,.18)'; g.lineWidth = 1; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); scar(2);
}
// 솟는 바위: 바닥에서 뾰족하게 솟았다가 부서져 파편이 된다
function spikes(cx, cy, R, n) {
  const list = Array.from({ length: n }, (_, i) => { const a = i / n * TAU + rr(-.2, .2), d = R * rr(.45, 1); return { x: cx + Math.cos(a) * d, y: cy + Math.sin(a) * d * .9, h: rr(6, 11), w: rr(2.2, 3.6), lean: rr(-.25, .25), delay: d / R * .12 }; });
  list.sort((a, b) => a.y - b.y);
  fx.push({ dur: 1.15, t: 0, layer: 'world', draw() {
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
    flash(x, y, 20, .35, SPR.glowB); ring(x, y, 18, .4, '200,240,255', 1.6); addDebris(x, y, 26, 1, .7); addSmoke(x, y, 6, 2, 4, 3); addSparks(x, y, 18, 3, 50, 1.5);
    const g = fctx; const gr = g.createRadialGradient(x, y, 0, x, y, 10); gr.addColorStop(0, 'rgba(225,245,255,.7)'); gr.addColorStop(1, 'rgba(200,235,255,0)'); g.fillStyle = gr; g.beginPath(); g.arc(x, y, 10, 0, TAU); g.fill();
    g.strokeStyle = 'rgba(255,255,255,.65)'; g.lineWidth = .35; g.beginPath(); for (let i = 0; i < 8; i++) { const a = i / 8 * TAU + rr(-.1, .1), d = rr(6, 10); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * d, y + Math.sin(a) * d); } g.stroke(); scar(1);
    shake(.25); stop(50); hit(target, 12 + (rnd() * 6 | 0), 'hit', from); status(target, '얼어붙음!');
  });
}
function poison(target, from) {
  pill(from, '맹독 웅덩이', 'toxic');
  const x = target.x + rr(-4, 4), y = target.y + rr(-2, 4), blob = Array.from({ length: 14 }, () => rr(.75, 1.15));
  const bub = Array.from({ length: 7 }, () => ({ a: rnd() * TAU, d: rnd(), t: rnd() }));
  addSmoke(x, y, 6, 3, 4, 5);
  fx.push({ dur: 3.2, t: 0, layer: 'ground', draw(dt) {
    const p = this.t / this.dur, grow = Math.min(1, this.t / .25), fade = p > .8 ? (1 - p) / .2 : 1, R = 10 * grow;
    ctx.globalAlpha = fade; ctx.fillStyle = 'rgba(120,40,170,.55)'; ctx.beginPath();
    blob.forEach((k, i) => { const a = i / blob.length * TAU, rx = x + Math.cos(a) * R * k, ry = y + Math.sin(a) * R * k * .7; i ? ctx.lineTo(rx, ry) : ctx.moveTo(rx, ry); }); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(220,150,255,.35)'; ctx.beginPath(); ctx.ellipse(x - R * .25, y - R * .2, R * .35, R * .14, -.3, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(240,200,255,.8)'; ctx.lineWidth = .3;
    for (const b of bub) { b.t += dt * 1.4; if (b.t > 1) { b.t = 0; b.a = rnd() * TAU; b.d = rnd(); } const bx = x + Math.cos(b.a) * R * .7 * b.d, by = y + Math.sin(b.a) * R * .5 * b.d; ctx.beginPath(); ctx.arc(bx, by, .4 + b.t * 1.1, 0, TAU); ctx.stroke(); }
    ctx.globalAlpha = 1;
    if (rnd() < .05) addSmoke(x, y, 1, 3, 3, R * .6);
  }, end() { const g = fctx, gr = g.createRadialGradient(x, y, 0, x, y, 10); gr.addColorStop(0, 'rgba(110,40,140,.28)'); gr.addColorStop(1, 'rgba(110,40,140,0)'); g.fillStyle = gr; g.beginPath(); g.ellipse(x, y, 10, 7, 0, 0, TAU); g.fill(); scar(1); } });
  later(.3, () => { hit(target, 8, 'hit', from); status(target, '중독!'); });
}
// 필살기: 화면이 어두워지고(주변만) 큰 원 폭발 + 파편 200개
function ultimate(from) {
  const enemies = pets.filter(p => p.alive && p.team !== from.team); if (!enemies.length) return;
  const tgt = enemies[0], x = tgt.x, y = tgt.y;
  shout(from, '은하 폭발!', 'star'); dim = 1;
  range({ x, y }, 26, .7, '255,230,120');
  addGather(x, y, 60, 1, 30, .65); flash(x, y, 18, .7, SPR.glowY);
  later(.7, () => {
    stop(140); shake(1); cam.punch = .12; screenFlash = .85;
    flash(x, y, 46, .5, SPR.glowW); flash(x, y, 70, .9, SPR.glowY);
    for (let i = 0; i < 3; i++) ring(x, y, 30 + i * 14, .55 + i * .15, i ? '255,220,120' : '255,255,255', 3 - i * .8, i * .07);
    radial(x, y, 20, 8, 50, '255,240,190', .35);
    addDebris(x, y, 160, 0, 1.4, 1.2); addDebris(x, y, 40, 2, 1.1);
    addSmoke(x, y, 26, 1, 7, 18); addSmoke(x, y, 10, 0, 6, 10); addSparks(x, y, 60, 1, 110, 2.6);
    scorch(x, y, 16); crater(x, y, 12); crackStar(x, y, 26, 12);
    for (const p of enemies) if (Math.hypot(p.x - x, p.y - y) < 32) hit(p, 34 + (rnd() * 10 | 0), 'crit', from);
  });
}

/* ---------- 맞음 · 숫자 · 글자 ---------- */
function hit(p, dmg, style, from) {
  if (!p.alive) return;
  p.hp = Math.max(0, p.hp - dmg); hudDirty = true;
  const dx = p.x - (from?.x ?? p.x), dy = p.y - (from?.y ?? p.y - 1), d = Math.hypot(dx, dy) || 1;
  p.kx = dx / d * 2.6; p.ky = dy / d * 2.6; p.flash = .09; p.squash = 1;
  // 숫자 겹침 줄이기: 같은 펫에 0.4초 안에 뜬 숫자가 있으면 옆으로 비켜 쌓는다
  const recent = nums.filter(n => n.p === p && n.t < .4).length;
  if (nums.length >= MAX_NUMS) nums.shift();
  nums.push({ p, v: dmg, style, t: 0, ox: (recent % 2 ? 1 : -1) * Math.ceil(recent / 2) * 5, oy: -recent * 2.5 });
  if (style === 'crit') { shout(p, '급소!', 'star'); stop(90); shake(.3); }
  if (p.hp <= 0) faint(p);
}
function pill(p, text, el) { pushText({ kind: 'pill', p, text, el, t: 0, dur: 1.1 }); }
function shout(p, text, el) { if (texts.some(t => t.kind === 'shout' && t.t < .5)) return; pushText({ kind: 'shout', p, text, el, t: 0, dur: .9 }); }
function status(p, text) { if (texts.some(t => t.kind === 'status' && t.p === p && t.t < .6)) return; pushText({ kind: 'status', p, text, el: 'star', t: 0, dur: 1 }); }
function pushText(o) { for (let i = texts.length - 1; i >= 0; i--) if (texts[i].p === o.p && texts[i].kind === o.kind) texts.splice(i, 1); if (texts.length >= MAX_TEXTS) texts.shift(); texts.push(o); }
function faint(p) {
  p.alive = false; p.back = 60; p.dead = 0.0001; hudDirty = true;
  banner = { text: `${PET_NAME[p.k]} 쓰러짐!`, t: 0, dur: 1.7, team: p.team };
  stop(150); shake(.6); addSmoke(p.x, p.y, 10, 0, 5, 4); addSparks(p.x, p.y - 4, 30, 0, 80, 2);
}

/* ---------- 시간표: 자동으로 반복하는 시연 ---------- */
let clock = 0, timers = [];
function later(s, fn) { timers.push({ at: clock + s, fn }); }
function pick(team) { const l = pets.filter(p => p.alive && p.team === team); return l[(rnd() * l.length) | 0]; }
const SCRIPT = [
  [0, () => { const a = pick(0), b = pick(1); a && b && lightning(b, a); }],
  [1.5, () => { const a = pick(1), b = pick(0); a && b && beam(a, b); }],
  [3.3, () => { const a = pick(0); a && quake(a); }],
  [5.0, () => { const a = pick(1), b = pick(0); a && b && frost(b, a); }],
  [5.6, () => { const a = pick(0), b = pick(1); a && b && poison(b, a); }],
  [6.6, () => { const a = pick(1), b = pick(0); if (a && b) { lightning(b, a); later(.25, () => { const c = pick(0); c && lightning(c, a); }); } }],
  [8.0, () => { const a = pick(0); a && ultimate(a); }]
];
const CYCLE = 10;
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
const stats = { frames: 0, debrisMax: 0, smokeMax: 0, sparksMax: 0, fxMax: 0, heals: 0, cycles: 0, tierDrops: 0, tierLog: [] };
window.__fx = stats;
function world(k, ox, oy) { ctx.setTransform(k, 0, 0, k, ox, oy); }

function render(dt, alpha) {
  const fdt = hitstop > 0 ? 0 : dt;   // 히트스톱: 연출 시간만 멈춘다
  // 카메라: 살아 있는 펫들을 감싸게 따라가고(부드럽게), 줌 · 흔들림
  const live = pets.filter(p => p.alive);
  let minX = WW, maxX = 0, minY = WH, maxY = 0;
  for (const p of pets) { p.rx = lerp(p.px, p.x, alpha); p.ry = lerp(p.py, p.y, alpha); }
  for (const p of live.length ? live : pets) { minX = Math.min(minX, p.rx); maxX = Math.max(maxX, p.rx); minY = Math.min(minY, p.ry); maxY = Math.max(maxY, p.ry); }
  const viewH = cssH / ppu;
  cam.tz = clamp(Math.min(VIEW_W / (maxX - minX + 40), (viewH - 30) / (maxY - minY + 60)), .9, 1.18);
  const follow = 1 - Math.exp(-dt * 3.2);
  cam.z += (cam.tz - cam.z) * follow;
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
  // 바닥 그림이 화면을 다 덮으면 바탕 칠하기를 건너뛴다(화면 전체 칠하기 1번 아끼기)
  if (ox + x0 * k > 0 || oy + y0 * k > 0 || ox + x1 * k < cvs.width || oy + y1 * k < cvs.height) { ctx.fillStyle = '#2f4a2a'; ctx.fillRect(0, 0, cvs.width, cvs.height); }
  if (x1 > x0 && y1 > y0) ctx.drawImage(field, x0 * FPX, y0 * FPX, (x1 - x0) * FPX, (y1 - y0) * FPX, ox + x0 * k, oy + y0 * k, (x1 - x0) * k, (y1 - y0) * k);
  world(k, ox, oy);
  // 2) 바닥에 붙는 효과(독 웅덩이 · 사거리)
  for (const f of fx) if (f.layer === 'ground') f.draw(fdt);
  // 필살기 동안 주변 어둡게(효과는 밝게 남는다)
  if (dim > 0) { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = `rgba(8,6,24,${.45 * Math.min(1, dim)})`; ctx.fillRect(0, 0, cvs.width, cvs.height); world(k, ox, oy); dim = Math.max(0, dim - fdt * .9); }
  // 3) 연기(바닥 쪽) · 파편 그림자
  drawSmoke(k, ox, oy, fdt);
  // 4) 펫 + 솟는 바위 + 파편: y 순서
  drawPets(k, ox, oy, fdt);
  for (const f of fx) if (f.layer === 'world') f.draw(fdt);
  drawDebris(k, ox, oy, fdt);
  // 5) 하늘 쪽 효과(번개 · 광선 · 충격파 · 빛)
  for (const f of fx) if (!f.layer) f.draw(fdt);
  drawRings(fdt); drawFlashes(fdt); drawSparks(fdt);
  // 6) 글자(화면 단위)
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  drawNums(k, ox, oy, fdt); drawTexts(k, ox, oy, fdt); drawBanner(dt);
  if (screenFlash > 0) { ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = `rgba(255,250,235,${screenFlash * .55})`; ctx.fillRect(0, 0, cvs.width, cvs.height); ctx.globalCompositeOperation = 'source-over'; screenFlash = Math.max(0, screenFlash - dt * 4); }

  // 큰 효과 수명
  for (let i = fx.length - 1; i >= 0; i--) { const f = fx[i]; f.t += fdt; if (f.t >= f.dur) { f.end?.(); fx.splice(i, 1); } }
  hitstop = Math.max(0, hitstop - dt);
  stats.debrisMax = Math.max(stats.debrisMax, D.n); stats.smokeMax = Math.max(stats.smokeMax, M.n); stats.sparksMax = Math.max(stats.sparksMax, K.n); stats.fxMax = Math.max(stats.fxMax, fx.length);
}
function drawPets(k, ox, oy, dt) {
  const order = [...pets].sort((a, b) => a.ry - b.ry);
  for (const p of order) {
    const s = SPR.pets[p.k]; if (!s) continue;
    p.bob += dt * 5; p.flash = Math.max(0, p.flash - dt); p.squash = Math.max(0, p.squash - dt * 6);
    p.kx *= Math.exp(-dt * 12); p.ky *= Math.exp(-dt * 12);
    let a = 1, drop = 0;
    if (!p.alive) { p.dead += dt; a = Math.max(0, 1 - p.dead / .6); drop = p.dead * 6; if (a <= 0) continue; }
    const x = p.rx + p.kx, y = p.ry + p.ky, size = PET_U * (1 + p.squash * .08), hgt = size * (1 - p.squash * .1);
    // 그림자
    ctx.globalAlpha = .9 * a; ctx.drawImage(SPR.shadow, x - size * .45, y - size * .12, size * .9, size * .3);
    const bob = p.alive ? Math.sin(p.bob) * .4 : 0;
    ctx.globalAlpha = a; ctx.drawImage(s.body, x - size / 2, y - hgt + bob + drop - 1, size, hgt);
    if (p.flash > 0) { ctx.globalAlpha = Math.min(1, p.flash / .09); ctx.drawImage(s.white, x - size / 2, y - hgt + bob - 1, size, hgt); }
    ctx.globalAlpha = 1;
    // 팀 표시: 발밑 얇은 고리
    ctx.strokeStyle = p.team ? 'rgba(255,90,90,.85)' : 'rgba(74,168,255,.85)'; ctx.lineWidth = .45; ctx.beginPath(); ctx.ellipse(x, y, size * .42, size * .14, 0, 0, TAU); ctx.stroke();
  }
}
function drawDebris(k, ox, oy, dt) {
  const n0 = D.n;
  for (let j = D.n - 1; j >= 0; j--) {
    D.life[j] -= dt; if (D.life[j] <= 0) { swapOut(D, j, --D.n, DKEYS); continue; }
    if (dt) {
      D.vz[j] -= 120 * dt; D.z[j] += D.vz[j] * dt; D.x[j] += D.vx[j] * dt; D.y[j] += D.vy[j] * dt; D.rot[j] += D.vr[j] * dt;
      if (D.z[j] < 0) { D.z[j] = 0; D.vz[j] *= -.32; D.vx[j] *= .55; D.vy[j] *= .55; D.vr[j] *= .5; if (Math.abs(D.vz[j]) < 3) D.vz[j] = 0; }
    }
  }
  if (!D.n) return;
  // 그림자(높을 때만, 높음 단계)
  if (tier === 2) { ctx.globalAlpha = .35; for (let j = 0; j < D.n; j++) if (D.z[j] > 1.5) { const s = D.size[j] * 1.6; ctx.drawImage(SPR.shadow, D.x[j] - s / 2, D.y[j] - s * .2, s, s * .4); } ctx.globalAlpha = 1; }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  for (let j = 0; j < D.n; j++) {
    const set = SPR[ROCK_KIND[D.kind[j]]], img = set[j % set.length], s = D.size[j] * 2.2 * k, c = Math.cos(D.rot[j]), sn = Math.sin(D.rot[j]);
    const fade = Math.min(1, D.life[j] / .4); ctx.globalAlpha = fade;
    ctx.setTransform(c * s / img.width, sn * s / img.width, -sn * s / img.width, c * s / img.width, ox + D.x[j] * k, oy + (D.y[j] - D.z[j]) * k);
    ctx.drawImage(img, -img.width / 2, -img.height / 2);
  }
  ctx.globalAlpha = 1; world(k, ox, oy);
  void n0;
}
function drawSmoke(k, ox, oy, dt) {
  for (let j = M.n - 1; j >= 0; j--) {
    M.life[j] -= dt; if (M.life[j] <= 0) { swapOut(M, j, --M.n, MKEYS); continue; }
    M.x[j] += M.vx[j] * dt; M.y[j] += M.vy[j] * dt; M.vx[j] *= 1 - dt * 1.5; M.vy[j] *= 1 - dt * 1.5; M.r[j] += M.vr[j] * dt; M.vr[j] *= 1 - dt * .8;
  }
  for (let j = 0; j < M.n; j++) {
    const p = 1 - M.life[j] / M.max[j], a = M.a[j] * (p < .15 ? p / .15 : 1 - (p - .15) / .85), r = M.r[j];
    ctx.globalAlpha = a; ctx.drawImage(SPR.puff[PUFF_KIND[M.kind[j]]], M.x[j] - r, M.y[j] - r, r * 2, r * 2);
  }
  ctx.globalAlpha = 1;
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
function drawRings(dt) {
  ctx.globalCompositeOperation = 'lighter';
  for (let i = rings.length - 1; i >= 0; i--) {
    const r = rings[i]; r.t += dt; if (r.t >= r.dur) { rings.splice(i, 1); continue; } if (r.t < 0) continue;
    const p = r.t / r.dur, a = (1 - p) * (1 - p);
    ctx.strokeStyle = `rgba(${r.color},${a})`; ctx.lineWidth = r.w * (1 - p * .6); ctx.beginPath(); ctx.ellipse(r.x, r.y, r.r1 * easeOut(p), r.r1 * easeOut(p) * .88, 0, 0, TAU); ctx.stroke();
  }
  ctx.globalCompositeOperation = 'source-over';
}
function drawFlashes(dt) {
  ctx.globalCompositeOperation = 'lighter';
  for (let i = flashes.length - 1; i >= 0; i--) {
    const f = flashes[i]; f.t += dt; if (f.t >= f.dur) { flashes.splice(i, 1); continue; } if (f.t < 0) continue;
    const p = f.t / f.dur, a = p < .1 ? 1 : 1 - (p - .1) / .9, r = f.r * (.6 + .4 * easeOut(p));
    ctx.globalAlpha = a; ctx.drawImage(f.spr, f.x - r, f.y - r, r * 2, r * 2);
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
    // 화면 밖으로 나가지 않게
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

/* ---------- 고리: 고정 틱 + 보간, 자동 품질 ---------- */
let last = 0, acc = 0, paused = false, frameLog = [], lastTierCheck = 0, hudTimer = 0;
function frame(now) {
  requestAnimationFrame(frame);
  if (!last) { last = now; return; }
  let dt = (now - last) / 1000; last = now;
  if (paused) return;
  frameLog.push(dt * 1000);
  dt = Math.min(dt, .1);
  acc += dt * 1000;
  let steps = 0; while (acc >= TICK && steps < 5) { tickSim(); acc -= TICK; steps++; }
  if (steps === 5) acc = 0;
  const fdt = hitstop > 0 ? 0 : dt;
  clock += fdt;
  for (let i = timers.length - 1; i >= 0; i--) if (clock >= timers[i].at) { const f = timers[i].fn; timers.splice(i, 1); f(); }
  if (FX_ON) runScript();
  render(dt, acc / TICK);
  stats.frames++;
  hudTimer += dt; if (hudTimer > 1) { hudTimer = 0; timeLeft = timeLeft > 0 ? timeLeft - 1 : 120; $('#timer').textContent = `${Math.floor(timeLeft / 60)}:${String(timeLeft % 60).padStart(2, '0')}`; }
  if (hudDirty) updateHud();
  if (now - lastTierCheck > 2000) { lastTierCheck = now; autoTier(); showDbg(); }
}
// 자동 품질: 2초 동안 20ms 넘은 프레임이 15% 넘으면 한 단계 내린다(올리지는 않음 → 들쭉날쭉 방지)
function autoTier() {
  const log = frameLog; frameLog = [];
  if (!log.length) return;
  const slow = log.filter(d => d > 20).length / log.length, avg = log.reduce((a, b) => a + b, 0) / log.length;
  stats.lastAvg = Math.round(avg * 10) / 10; stats.lastSlow = Math.round(slow * 100);
  // 아주 느리면(절반 넘게 20ms↑) 두 단계를 한 번에 내린다
  if (auto && slow > .15 && tier > 0 && stats.frames > 90) { setTier(Math.max(0, tier - (slow > .5 ? 2 : 1))); stats.tierDrops++; stats.tierLog.push(`${(performance.now() / 1000).toFixed(0)}s→${tier}`); }
}
function setTier(t) { tier = t; T = TIERS[t]; D.n = Math.min(D.n, T.debris); M.n = Math.min(M.n, T.smoke); K.n = Math.min(K.n, T.sparks); resize(); const old = field; buildGroundKeep(old); stats.tier = t; markButtons(); }
function buildGroundKeep(old) { const sc = scars; buildGround(); fctx.save(); fctx.setTransform(1, 0, 0, 1, 0, 0); fctx.drawImage(old, 0, 0, field.width, field.height); fctx.restore(); scars = sc; }
function showDbg() {
  const mem = performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) + 'MB' : '-';
  $('#dbg').textContent = `fps ${stats.lastAvg ? Math.round(1000 / stats.lastAvg) : '-'} · 느린 ${stats.lastSlow ?? '-'}%\n품질 ${T.name}${auto ? '(자동)' : ''} ×${S}\n파편 ${D.n} 연기 ${M.n} 불꽃 ${K.n}\n자국 ${scars}/${SCAR_CAP} 힙 ${mem}`;
}
function markButtons() { for (const b of document.querySelectorAll('#bar button')) b.classList.toggle('on', b.dataset.q === (auto ? 'auto' : String(tier)) || b.dataset.pets === String(PETS_N) || (b.dataset.act === 'pause' && paused)); }
$('#bar').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.dataset.q) { auto = b.dataset.q === 'auto'; setTier(auto ? 2 : Number(b.dataset.q)); }
  if (b.dataset.pets) { PETS_N = Number(b.dataset.pets); makePets(); resetField(); }
  if (b.dataset.act === 'pause') paused = !paused;
  if (b.dataset.act === 'clean') document.body.classList.add('clean');
  markButtons();
});
cvs.addEventListener('click', () => document.body.classList.remove('clean'));
addEventListener('resize', () => { resize(); });

await Promise.all([loadPets(), document.fonts.load('20px Jua', '0123 쓰러짐번개'), document.fonts.load('20px Jua', '0123')]).catch(() => {});
resize(); buildGround(); makePets(); markButtons(); stats.tier = tier;
stats.canvasMB = () => Math.round([cvs, field, ground].reduce((a, c) => a + c.width * c.height * 4, 0) / 1048576 * 10) / 10;
requestAnimationFrame(frame);
