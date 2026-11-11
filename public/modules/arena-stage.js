// V13.238 펫 아레나 캔버스 무대(전투 장면 그리기 전용). 구성안 docs/arena-battle-reboot-plan.md 2장 · 5장 · 7장 ①단계 · 부록 B.
//   전투 계산(arena-rules.js) · 서버 판정 · 친구 대전 되감기(arena-live.js)는 그대로이고, 펫 · 효과 · 숫자 · 글자만 이 캔버스 한 장에 그린다.
//   버튼 · 위 막대(HUD) · 조준 표시 · 필살기 컷인 · 물들이기 · 배너는 DOM 그대로(arena.js).
// 구조(시험 페이지 arena-fx.js의 엔진을 옮겨 씀, 앱과 연결하지 않은 측정용):
//   - 카메라: 흔들림 · 줌 펀치(지금 #ar-field 흔들림 · 줌 애니메이션과 같은 모양) — 캔버스 안에서만, DOM 스타일 계산 없음.
//   - 오브젝트 풀: 조각(bits) · 불꽃 줄(sparks) · 빛 알갱이(glows) · 연기(smoke) · 파편(debris)은 정해진 크기의 Float32Array,
//     큰 효과 · 고리 · 숫자 · 글자는 상한이 있는 목록. 판이 길어져도 메모리가 늘지 않는다.
//   - 바닥 굽기: 금 · 그을음 자국은 바닥 캔버스 한 장에 구워 넣고(매 프레임 비용 = 그림 1장), 상한(SCAR_CAP)이 넘으면 아문다.
//     경기장 바닥 그림 자체는 지금 그림(#ar-bg · 꾸미기 장면) 그대로이고, 캔버스는 투명하게 그 위에 겹친다.
//   - 펫 보간 그리기: 앞 틱 ↔ 지금 틱을 frac으로 섞는다(지금 place(frac)와 같은 규칙). 512px 그림은 보일 크기로 한 번 줄여 두고,
//     흰 번쩍 · 팀 색 테두리 · 상태 색도 처음 한 번 만들어 찍기만 한다(filter 없음).
//   - 숫자 아틀라스: 0~9를 모양(보통 · 스킬 · 급소 · 필살 · 독)마다 한 장에 그려 두고 잘라 찍는다. 글자도 처음 한 번 그림으로 만든다.
//   - 품질 자동 4단계(최저 · 낮음 · 중간 · 높음): 2초마다 20ms 넘은 프레임이 15% 넘으면 한 단계, 50% 넘으면 두 단계 내린다(올리지 않음).
//     내려간 단계는 이 폰에 7일 기억해 다음 판은 그 단계로 시작한다.
//   - 연출 시간: 히트스톱은 연출 시간만 멈추고(틱 · 규칙은 그대로), 마지막 한 방 느린 동작은 연출만 0.35배.
import { ELEMENTS } from './battle-fx.js';
import { ARENA_ART } from './arena-art.js';

/* ---------- 품질 단계 · 상한 ---------- */
export const TIERS = [
  // 최저: CSS 픽셀보다 낮게 그려 늘린다(조금 흐림, 칠하는 넓이 절반) — 캔버스를 CPU로 그리는 느린 폰용
  { name: '최저', scale: .75, bits: 48, sparks: 70, glows: 60, smoke: 20, debris: 70, per: 4, mult: .35, glow: false, bob: false, fx: 16 },
  { name: '낮음', scale: 1, bits: 64, sparks: 90, glows: 90, smoke: 28, debris: 90, per: 4, mult: .4, glow: false, bob: false, fx: 20 },
  { name: '중간', scale: 1.5, bits: 120, sparks: 180, glows: 180, smoke: 56, debris: 200, per: 8, mult: .7, glow: true, bob: true, fx: 24 },
  { name: '높음', scale: 2, bits: 160, sparks: 320, glows: 300, smoke: 96, debris: 400, per: 8, mult: 1, glow: true, bob: true, fx: 24 }
];
export const POOL_MAX = { bits: 160, sparks: 320, glows: 300, smoke: 96, debris: 400 };
// 큰 효과 24(저사양 20) · 고리 18 · 숫자 24 · 글자 12 · 잔상 8 — 구성안 7-1 렉 예산 안(넘으면 가장 오래된 것부터 버림).
export const LIST_MAX = { fx: 24, rings: 18, nums: 24, texts: 12, ghosts: 8 };
export const SCAR_CAP = 36;
const TIER_KEY = 'sumus-arena-tier', TIER_DAYS = 7, TIER_CHECK_MS = 2000, SLOW_MS = 20;
// 캔버스는 경기장(#ar-field)보다 조금 크게 둔다: 위쪽 펫 머리 · 체력 막대 · 떠오르는 숫자가 잘리지 않게(예전 DOM도 넘쳐 보였다).
const PAD = { l: 40, t: 110, r: 40, b: 30 };

const TAU = Math.PI * 2;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const easeOut = t => 1 - (1 - t) * (1 - t) * (1 - t);
const easeIn = t => t * t * t;
const rnd = Math.random, rr = (a, b) => a + rnd() * (b - a);
const mk = (w, h) => { const c = document.createElement('canvas'); c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h)); return c; };
const EL_KEYS = ['flame', 'ice', 'water', 'leaf', 'earth', 'wind', 'toxic', 'star'];
const elIdx = el => Math.max(0, EL_KEYS.indexOf(el in ELEMENTS ? el : 'star'));
const pal = el => ELEMENTS[el] || ELEMENTS.star;
const hexRgb = hex => { const n = parseInt(String(hex).slice(1), 16); return `${n >> 16},${n >> 8 & 255},${n & 255}`; };
const RGB = Object.fromEntries(EL_KEYS.map(k => [k, hexRgb(ELEMENTS[k].c1)]));
const lite = () => T.glow === false;
let T = TIERS[3];

// 이 폰에서 기억한 단계(7일). 예전 가벼운 연출(sumus-arena-lite)이 켜진 폰은 낮음부터.
function startTier(liteOn) {
  let t = 3;
  try { const v = JSON.parse(localStorage.getItem(TIER_KEY) || 'null'); if (v && Date.now() - v.at < TIER_DAYS * 864e5) t = clamp(v.t | 0, 0, 3); } catch {}
  return liteOn ? Math.min(t, 1) : t;
}

/* ---------- 재료(그림 71 칸 이름): 그림이 있으면 그림, 없으면 코드 그림 ---------- */
const radial = (g, x, y, r, stops) => { const gr = g.createRadialGradient(x, y, 0, x, y, r); for (const [o, c] of stops) gr.addColorStop(o, c); g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); };
const MATS = {
  glow: ['add', 128, g => radial(g, 64, 64, 64, [[0, '#fff'], [.25, 'rgba(255,255,255,.75)'], [.6, 'rgba(255,255,255,.18)'], [1, 'rgba(255,255,255,0)']])],
  smoke: ['luma', 128, g => { for (let i = 0; i < 7; i++) { const a = i / 7 * TAU; radial(g, 64 + Math.cos(a) * 16 * rr(.3, 1), 64 + Math.sin(a) * 16 * rr(.3, 1), 38, [[0, 'rgba(255,255,255,.55)'], [.7, 'rgba(235,235,235,.25)'], [1, 'rgba(220,220,220,0)']]); } }],
  'rock-a': ['key', 64, g => { const n = 7, pts = []; for (let i = 0; i < n; i++) { const a = i / n * TAU + rr(-.3, .3), d = 32 * rr(.55, .9); pts.push([32 + Math.cos(a) * d, 32 + Math.sin(a) * d]); } g.beginPath(); pts.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.closePath(); const gr = g.createLinearGradient(0, 0, 64, 64); gr.addColorStop(0, '#b8a892'); gr.addColorStop(.55, '#8a7a66'); gr.addColorStop(1, '#5a4a36'); g.fillStyle = gr; g.fill(); g.lineWidth = 2; g.strokeStyle = '#3a2a1c'; g.stroke(); }],
  'crack-star': ['mul', 128, g => { g.translate(64, 64); g.scale(2.3, 2.3); drawCracks(g, growCracks(0, 0, 26, 8)); }],
  scorch: ['mul', 128, g => { for (let i = 0; i < 6; i++) radial(g, 64 + rr(-15, 15), 64 + rr(-15, 15), rr(28, 50), [[0, 'rgba(30,20,14,.6)'], [1, 'rgba(30,20,14,0)']]); }]
};
function growCracks(x, y, R, n) {
  const segs = [];
  const walk = (sx, sy, a, len, w, depth) => {
    let cx = sx, cy = sy;
    while (len > 0) { const st = rr(1.2, 2.6); a += rr(-.38, .38); const nx = cx + Math.cos(a) * st, ny = cy + Math.sin(a) * st; segs.push([cx, cy, nx, ny, w]); cx = nx; cy = ny; len -= st; w *= .93; if (depth < 1 && rnd() < .1) walk(cx, cy, a + rr(-.9, .9), len * .45, w * .7, depth + 1); }
  };
  for (let i = 0; i < n; i++) walk(x, y, i / n * TAU + rr(-.2, .2), R * rr(.55, 1), rr(.55, .85), 0);
  return segs;
}
function drawCracks(g, segs) { g.lineCap = 'round'; g.strokeStyle = 'rgba(58,38,22,.85)'; for (const s of segs) { g.lineWidth = s[4]; g.beginPath(); g.moveTo(s[0], s[1]); g.lineTo(s[2], s[3]); g.stroke(); } }

// 속성 조각 모양(battle-fx.js SHAPES와 같은 SVG 경로, 24×24) — 맞는 순간 조각(fxImpact)을 캔버스로 옮긴 것.
const SHAPE_PATHS = {
  flame: ['M12 1c1.2 4.6 6.4 6.2 6.4 12.4a6.4 6.4 0 0 1-12.8 0c0-3.2 2.1-4.6 3.2-7.4 1.1 1 1.9 2.2 2 4 1.3-2.7 1.5-5.6 1.2-9z', 'M12 11c.7 2 3 2.9 3 5.6a3 3 0 0 1-6 0c0-1.6 1.3-2.4 3-5.6z'],
  ice: ['M12 1l5.2 11L12 23 6.8 12z', 'M12 4l2.2 8L12 20'],
  water: ['M12 1.5c4.2 6 7.2 9.3 7.2 13.3a7.2 7.2 0 0 1-14.4 0c0-4 3-7.3 7.2-13.3z', 'M7.5 12a1.8 3 18 1 0 3 5a1.8 3 18 1 0-3-5z'],
  leaf: ['M3 21C3 10 10 3 21.5 3 21.5 14 15 21 3 21z', 'M5.5 18.5C10 13 14 9 18.5 6'],
  earth: ['M3.5 16.5l3.2-9.4 8-3.4 6 7.6-3 9.2-9.8 1z', 'M6.7 7.1l5.3 4.2 8.7.4M12 11.3l-1 8.4'],
  wind: ['M2 21C8 7 16.5 3 22.5 4 15.5 8.5 11 14.5 2 21z', 'M5 17.5C10 10 15 6.5 20 5.2'],
  toxic: ['M21.5 12a9.5 9.5 0 1 1-19 0a9.5 9.5 0 1 1 19 0z', 'M6 8a2.6 1.6-35 1 0 5 0a2.6 1.6-35 1 0-5 0z'],
  star: ['M12 1l2.9 8.1L23 12l-8.1 2.9L12 23l-2.9-8.1L1 12l8.1-2.9z', '']
};
const STAR5 = [[50, 0], [61, 35], [98, 35], [68, 57], [79, 91], [50, 70], [21, 91], [32, 57], [2, 35], [39, 35]];

export function createStage(field, host) {
  const cvs = field.querySelector('canvas.ar-cv');
  if (!cvs) return null;
  const ctx = cvs.getContext('2d');
  let tier = startTier(host.lite?.()), auto = true;
  // 측정 도구(docs/arena-perf.mjs --tier N)만 쓰는 고정 단계
  if (typeof window.__arenaTierFix === 'number') { tier = clamp(window.__arenaTierFix | 0, 0, 3); auto = false; }
  T = TIERS[tier];
  let W = 360, H = 400, S = 1, raf = 0, dead = false, last = 0, drawnAt = 0, frac = 1;
  const family = (() => { try { return getComputedStyle(field).fontFamily || 'system-ui, sans-serif'; } catch { return 'system-ui, sans-serif'; } })();
  const stats = { tier, tierLog: [], frames: 0, fxMax: 0, bitsMax: 0, sparksMax: 0, glowsMax: 0, smokeMax: 0, debrisMax: 0, ringsMax: 0, numsMax: 0, textsMax: 0, scars: 0, heals: 0, events: 0, fightAt: 0 };
  const reduced = () => !!host.reduced?.();

  /* ---------- 그림 불러오기(같은 주소는 한 번) ---------- */
  const imgs = new Map();
  function image(src) {
    if (!src) return null;
    let e = imgs.get(src);
    if (!e) {
      e = { img: new Image(), ok: false, wait: [] }; imgs.set(src, e);
      e.img.decoding = 'async';
      e.img.onload = () => { const done = () => { e.ok = true; for (const f of e.wait.splice(0)) f(); }; (e.img.decode ? e.img.decode().catch(() => {}) : Promise.resolve()).then(done); };
      e.img.onerror = () => { e.bad = true; e.wait.length = 0; };
      e.img.src = src;
    }
    return e;
  }
  const whenImg = (src, fn) => { const e = image(src); if (!e || e.bad) return; if (e.ok) fn(e.img); else e.wait.push(() => fn(e.img)); };
  // 그림 66 · 71 · 연습장 허수아비: ARENA_ART에 이름이 있을 때만 요청(없는 그림을 묻지 않는다).
  const artReady = name => { if (!ARENA_ART.has(name)) return null; const e = image(`/assets/arena/${name}.webp`); return e?.ok ? e.img : null; };

  /* ---------- 재료(코드 그림 + 그림 71) ---------- */
  const mat = {}, tintCache = new Map();
  for (const [k, [, size, draw]] of Object.entries(MATS)) { const c = mk(size, size); draw(c.getContext('2d')); mat[k] = c; }
  for (const k of Object.keys(MATS)) if (ARENA_ART.has('mat-' + k)) whenImg(`/assets/arena/mat-${k}.webp`, im => {
    const c = mk(im.width, im.height), g = c.getContext('2d'); g.drawImage(im, 0, 0);
    // 바닥 자국(mul, 흰 배경) 그림은 투명 캔버스에 굽기 위해 한 번만 "어두운 정도 → 투명도"로 바꾼다(그 뒤로는 픽셀 계산 없음).
    //   빛(add, 검은 배경) 그림은 "밝기 → 투명도"로: 캔버스가 투명이라(DOM 경기장 그림 위) 더하기로 그려도 검은 네모가 생기지 않게.
    const kind = MATS[k][0];
    if (kind === 'mul' || kind === 'add') try {
      const d = g.getImageData(0, 0, c.width, c.height), p = d.data;
      for (let i = 0; i < p.length; i += 4) {
        if (kind === 'mul') { const l = (p[i] + p[i + 1] + p[i + 2]) / 3; p[i + 3] = 255 - l; p[i] *= .5; p[i + 1] *= .5; p[i + 2] *= .5; }
        else { const a = Math.max(p[i], p[i + 1], p[i + 2]); p[i + 3] = a; if (a) { const f = 255 / a; p[i] *= f; p[i + 1] *= f; p[i + 2] *= f; } }
      }
      g.putImageData(d, 0, 0);
    } catch {}
    mat[k] = c; tintCache.clear();
  });
  function tint(k, rgb) {
    const key = k + '|' + rgb; let c = tintCache.get(key); if (c) return c;
    const src = mat[k]; c = mk(src.width, src.height); const g = c.getContext('2d');
    g.drawImage(src, 0, 0);
    if (MATS[k][0] === 'luma') { g.globalCompositeOperation = 'source-in'; g.fillStyle = `rgb(${rgb})`; g.fillRect(0, 0, c.width, c.height); }
    else { g.globalCompositeOperation = 'multiply'; g.fillStyle = `rgb(${rgb})`; g.fillRect(0, 0, c.width, c.height); g.globalCompositeOperation = 'destination-in'; g.drawImage(src, 0, 0); }
    if (tintCache.size > 60) tintCache.clear();
    tintCache.set(key, c); return c;
  }

  /* ---------- 크기 · 바닥(자국 굽기) ---------- */
  let floor = null, fctx = null, scars = 0;
  function resize() {
    W = Math.max(1, field.clientWidth || 360); H = Math.max(1, field.clientHeight || 400);
    S = T.scale < 1 ? T.scale : Math.min(window.devicePixelRatio || 1, T.scale);
    cvs.width = Math.round((W + PAD.l + PAD.r) * S); cvs.height = Math.round((H + PAD.t + PAD.b) * S);
    const fs = Math.min(1, S), old = floor;
    floor = mk(W * fs, H * fs); fctx = floor.getContext('2d'); fctx.setTransform(fs, 0, 0, fs, 0, 0);
    if (old) { fctx.save(); fctx.setTransform(1, 0, 0, 1, 0, 0); fctx.drawImage(old, 0, 0, floor.width, floor.height); fctx.restore(); }
    for (const p of pets.values()) build(p);
    digits.clear(); texts.clear(); bitSpr.clear(); orbSpr.clear();
  }
  function scar(n) { scars += n; stats.scars = scars; if (scars > SCAR_CAP) heal(); }
  // 아물기: 오래된 자국부터 옅어지게 25%씩 지운다(목록을 들고 있지 않으니 판이 길어져도 메모리 일정).
  function heal() { fctx.save(); fctx.setTransform(1, 0, 0, 1, 0, 0); fctx.globalCompositeOperation = 'destination-out'; fctx.fillStyle = 'rgba(0,0,0,.25)'; fctx.fillRect(0, 0, floor.width, floor.height); fctx.restore(); scars = Math.round(scars * .75); stats.heals++; }
  function stamp(k, x, y, w, h, rot = 0, alpha = 1, n = 1) {
    if (!fctx) return;
    fctx.save(); fctx.translate(x, y); if (rot) fctx.rotate(rot); fctx.globalAlpha = alpha;
    fctx.drawImage(mat[k], -w / 2, -h / 2, w, h); fctx.restore(); scar(n);
  }

  /* ---------- 펫 그림(보일 크기로 한 번 줄이기 + 흰 실루엣 · 팀 색 테두리) ---------- */
  const pets = new Map();
  const petSize = (who, multi) => { const short = (window.innerHeight || 800) <= 700; return who === 'me' ? (short ? 78 : 92) : multi && who !== 'foe' ? (short ? 72 : 80) : (short ? 72 : 86); };
  function shrink(im, px) {
    let src = im, w = im.naturalWidth || im.width, h = im.naturalHeight || im.height;
    while (w / 2 > px * 1.2) { const c = mk(w / 2, h / 2); c.getContext('2d').drawImage(src, 0, 0, w / 2, h / 2); src = c; w /= 2; h /= 2; }
    const out = mk(px, px), k = Math.min(px / w, px / h), dw = w * k, dh = h * k;
    out.getContext('2d').drawImage(src, (px - dw) / 2, (px - dh) / 2, dw, dh); return out;
  }
  const silhouette = (src, color) => { const c = mk(src.width, src.height), g = c.getContext('2d'); g.drawImage(src, 0, 0); g.globalCompositeOperation = 'source-in'; g.fillStyle = color; g.fillRect(0, 0, c.width, c.height); return c; };
  function outline(src, color) {
    const r = Math.max(2, Math.round(2.5 * S)), c = mk(src.width + r * 2, src.height + r * 2), g = c.getContext('2d'), sil = silhouette(src, color);
    for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; g.globalAlpha = .55; g.drawImage(sil, r + Math.cos(a) * r, r + Math.sin(a) * r); }
    return { c, r };
  }
  function sprites(im, px, color) { const body = shrink(im, px); return { body, white: silhouette(body, '#fff'), glow: color ? outline(body, color) : null, tints: {} }; }
  function build(p) {
    const px = Math.round(p.sz * S), color = p.team === 'enemy' || p.team === 'foe' ? 'rgba(251,113,133,1)' : 'rgba(96,165,250,1)';
    p.spr = p.img ? sprites(p.img, px, color) : null;
    if (p.dummy && !p.img) p.dummySpr = dummySprite(px);
    for (const k of Object.keys(p.poseImg)) p.poses[k] = sprites(p.poseImg[k], px, color);
  }
  function tinted(s, kind) {
    if (s.tints[kind]) return s.tints[kind];
    const c = mk(s.body.width, s.body.height), g = c.getContext('2d'); g.drawImage(s.body, 0, 0);
    if (kind === 'gray') { g.globalCompositeOperation = 'saturation'; g.fillStyle = '#808080'; g.fillRect(0, 0, c.width, c.height); g.globalCompositeOperation = 'destination-in'; g.drawImage(s.body, 0, 0); }
    else { g.globalCompositeOperation = 'source-atop'; g.fillStyle = kind === 'slow' ? 'rgba(125,211,252,.5)' : 'rgba(168,85,247,.45)'; g.fillRect(0, 0, c.width, c.height); }
    return (s.tints[kind] = c);
  }
  // 연습장 허수아비(그림 'dummy'가 있으면 그림, 없으면 코드로: 기둥 · 가로대 · 과녁 머리)
  function dummySprite(px) {
    const c = mk(px, px), g = c.getContext('2d'), u = px / 100;
    g.fillStyle = '#92400e'; g.fillRect(46 * u + 12 * u * .76, 30 * u, 8 * u * .76, 70 * u);
    g.fillStyle = '#d97706'; g.beginPath(); g.roundRect?.(12 * u + 10 * u, 40 * u, 56 * u, 12 * u * .9, 6 * u); g.fill();
    const hx = 50 * u, hy = 22 * u, hr = 18 * u;
    for (const [r, col] of [[1, '#fde68a'], [.62, '#ef4444'], [.47, '#fff'], [.3, '#ef4444'], [.15, '#fff']]) { g.fillStyle = col; g.beginPath(); g.arc(hx, hy, hr * r, 0, TAU); g.fill(); }
    return c;
  }

  /* ---------- 숫자 아틀라스 · 글자 그림 ---------- */
  const digits = new Map(), texts = new Map();
  // 지금 DOM 숫자(.ar-num)와 같은 모양: 보통 22 · 스킬 28(속성 색) · 급소 32 · 필살 42(급소 48) · 독 16 · 내가 맞음 분홍.
  const NUM = { atk: [22, '#fff', 'rgba(0,0,0,.6)', 1.2], me: [22, '#fecaca', 'rgba(0,0,0,.6)', 1.2], skill: [28, null, 'rgba(0,0,0,.6)', 1.2], crit: [32, '#fde047', '#b45309', 1.6], ult: [42, '#fde047', '#b45309', 1.8], ultcrit: [48, '#fde047', '#b45309', 1.8], poison: [16, '#d8b4fe', 'rgba(0,0,0,.6)', 1.2] };
  const mixWhite = (hex, k) => { const [r, g, b] = hexRgb(hex).split(',').map(Number); return `rgb(${Math.round(r * k + 255 * (1 - k))},${Math.round(g * k + 255 * (1 - k))},${Math.round(b * k + 255 * (1 - k))})`; };
  function atlas(style, el) {
    const key = style + (style === 'skill' ? el : ''); let a = digits.get(key); if (a) return a;
    const [size, fill, stroke, lw] = NUM[style], fs = size * S * 1.4, cw = Math.ceil(fs * .68), ch = Math.ceil(fs * 1.3), c = mk(cw * 10, ch), g = c.getContext('2d');
    g.font = `900 ${fs}px ${family}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
    for (let d = 0; d < 10; d++) {
      const x = d * cw + cw / 2, y = ch / 2;
      g.fillStyle = 'rgba(0,0,0,.5)'; g.fillText(String(d), x, y + 2 * S * 1.4);
      g.lineWidth = lw * 2 * S * 1.4; g.strokeStyle = stroke; g.strokeText(String(d), x, y);
      g.fillStyle = fill || mixWhite(pal(el).c1, .55); g.fillText(String(d), x, y);
    }
    a = { c, cw, ch, adv: cw * .82, k: 1 / 1.4 }; digits.set(key, a); return a;
  }
  // 글자 모양(지금 .ar-fx.pop 클래스와 같은 크기 · 색). bg가 있으면 알약 바탕.
  const POP = {
    base: [16, '#fff'], crit: [14, '#fde047', '#7c2d12', 1], eff: [13, '#fef08a'], weak: [13, '#cbd5e1'], enter: [15, '#fff'], heal: [14, '#86efac'], stun: [15, '#fca5a5'],
    skill: [16, '#fff', null, 0, 'rgba(0,0,0,.45)'], skillme: [16, '#fff', null, 0, 'rgba(30,64,175,.75)'], skillfoe: [16, '#fff', null, 0, 'rgba(127,29,29,.75)'],
    hint: [13, '#fff', null, 0, 'rgba(15,23,42,.8)'], count: [84, '#fff', '#1e3a8a', 2], go: [58, '#fde047', '#b91c1c', 2],
    emote: [17, '#17242f', null, 0, '#fff', true], emotefoe: [17, '#17242f', null, 0, '#ffe4e6', true], block: [22, '#fff', 'rgba(0,0,0,.6)', 1.2], tag: [10.5, '#fecdd3', null, 0, 'rgba(8,12,32,.62)'], tagme: [10.5, '#fde047', null, 0, 'rgba(8,12,32,.62)'], tagally: [10.5, '#bfdbfe', null, 0, 'rgba(8,12,32,.62)']
  };
  function textSprite(text, style) {
    const key = style + '|' + text; let s = texts.get(key); if (s) return s;
    const [size, fill, stroke, lw, bg, flat] = POP[style] || POP.base, fs = size * S, font = `900 ${fs}px ${family}`;
    const m = mk(4, 4).getContext('2d'); m.font = font;
    const tw = m.measureText(text).width, px = bg ? (style.startsWith('tag') ? 6 : style.startsWith('emote') ? 11 : 9) * S : 4 * S, w = Math.ceil(tw + px * 2 + (lw || 0) * 2 * S), h = Math.ceil(fs * (bg ? 1.55 : 1.45));
    const c = mk(w, h), g = c.getContext('2d'); g.font = font; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
    if (bg) { g.fillStyle = bg; g.beginPath(); const r = style.startsWith('emote') ? 14 * S : h / 2; if (g.roundRect) g.roundRect(0, 0, w, h, r); else g.rect(0, 0, w, h); g.fill(); }
    if (!flat) { g.fillStyle = 'rgba(0,0,0,.55)'; g.fillText(text, w / 2, h / 2 + 2 * S); }
    if (stroke) { g.lineWidth = lw * 2 * S; g.strokeStyle = stroke; g.strokeText(text, w / 2, h / 2); }
    g.fillStyle = fill; g.fillText(text, w / 2, h / 2 + (bg ? S * .5 : 0));
    s = { c, w: w / S, h: h / S };
    if (texts.size > 160) texts.clear();
    texts.set(key, s); return s;
  }
  // 카운트다운 동안 쓸 글자를 몇 개씩 미리 그림으로(첫 타격 프레임이 글꼴 그리기로 길어지지 않게).
  const warmQ = [];
  function warmStep() {
    for (let n = 0; n < 3 && warmQ.length; n++) { const [kind, a, b] = warmQ.shift(); if (kind === 'num') atlas(a, b); else textSprite(a, b); }
  }

  /* ---------- 조각 모양(작은 그림 한 번 만들기) ---------- */
  const bitSpr = new Map();
  // 0 기본 빛 · 1 물방울 · 2 불씨 · 3 돌 · 4 먼지 · 5 서리 · 6 독 연기 · 7 잎 · 8 꽃잎 · 9 별(속성 색) · 10 모으기 별 · 11~18 속성 조각(fxImpact)
  const BIT = { bit: 0, drop: 1, ember: 2, rock: 3, dust: 4, frost: 5, puff: 6, leafbit: 7, petalbit: 8, star: 9, spark: 9, charge: 10 };
  function bitSprite(kind, el) {
    const key = kind * 8 + elIdx(el); let c = bitSpr.get(key); if (c) return c;
    const P = pal(el), n = Math.ceil(24 * S); c = mk(n, n); const g = c.getContext('2d'); g.scale(n / 24, n / 24);
    const rad = (stops, rx = 12, ry = 12) => { g.save(); g.translate(12, 12); g.scale(rx / 12, ry / 12); radial(g, 0, 0, 12, stops); g.restore(); };
    if (kind === 0) rad([[0, '#fff'], [.5, P.c1], [.72, 'rgba(255,255,255,0)'], [1, 'rgba(255,255,255,0)']]);
    else if (kind === 1) { const gr = g.createRadialGradient(10, 9, 1, 12, 12, 9); gr.addColorStop(0, '#fff'); gr.addColorStop(.45, '#7dd3fc'); gr.addColorStop(1, '#0284c7'); g.fillStyle = gr; g.beginPath(); g.ellipse(12, 12, 4.5, 6, 0, 0, TAU); g.fill(); }
    else if (kind === 2) rad([[0, '#fff'], [.35, '#fde047'], [.65, '#f97316'], [.72, 'rgba(249,115,22,0)'], [1, 'rgba(0,0,0,0)']]);
    else if (kind === 3) { g.fillStyle = '#a8a29e'; g.beginPath(); g.moveTo(6, 10); g.lineTo(11, 7); g.lineTo(17, 9); g.lineTo(16, 15); g.lineTo(9, 16); g.closePath(); g.fill(); g.fillStyle = 'rgba(255,255,255,.35)'; g.beginPath(); g.moveTo(6, 10); g.lineTo(11, 7); g.lineTo(12, 11); g.fill(); }
    else if (kind === 4) rad([[0, 'rgba(214,211,209,.8)'], [.7, 'rgba(214,211,209,0)'], [1, 'rgba(0,0,0,0)']], 12, 8);
    else if (kind === 5) { g.fillStyle = '#e0f2fe'; g.beginPath(); for (const [x, y] of [[12, 3], [13.5, 10.5], [21, 12], [13.5, 13.5], [12, 21], [10.5, 13.5], [3, 12], [10.5, 10.5]]) g.lineTo(x, y); g.closePath(); g.fill(); }
    else if (kind === 6) rad([[0, 'rgba(216,180,254,.85)'], [.6, 'rgba(134,239,172,.4)'], [.72, 'rgba(134,239,172,0)'], [1, 'rgba(0,0,0,0)']], 12, 9);
    else if (kind === 7 || kind === 8) { const gr = g.createLinearGradient(6, 8, 18, 16); gr.addColorStop(0, kind === 7 ? '#bbf7d0' : '#fff'); gr.addColorStop(1, kind === 7 ? '#22c55e' : '#f9a8d4'); g.fillStyle = gr; g.beginPath(); g.moveTo(6, 16); g.quadraticCurveTo(6, 8, 18, 8); g.quadraticCurveTo(18, 16, 6, 16); g.fill(); }
    else if (kind === 9 || kind === 10) { g.beginPath(); for (const [x, y] of STAR5) g.lineTo(x * .24, y * .24); g.closePath(); g.save(); g.clip(); rad([[0, '#fff'], [.3, '#fff'], [.6, P.c1], [.7, P.c1], [1, 'rgba(0,0,0,0)']]); g.restore(); }
    else {
      const sh = SHAPE_PATHS[EL_KEYS[kind - 11]] || SHAPE_PATHS.star;
      try { g.fillStyle = P.c1; g.fill(new Path2D(sh[0])); if (sh[1]) { g.strokeStyle = P.c2; g.lineWidth = 1.3; g.lineCap = 'round'; g.stroke(new Path2D(sh[1])); if (kind === 11) { g.fillStyle = P.c2; g.fill(new Path2D(sh[1])); } } }
      catch { g.fillStyle = P.c1; g.beginPath(); g.arc(12, 12, 9, 0, TAU); g.fill(); }
    }
    bitSpr.set(key, c); return c;
  }
  const orbSpr = new Map();
  function orbSprite(el) {
    let c = orbSpr.get(el); if (c) return c;
    const P = pal(el), n = Math.ceil(48 * S); c = mk(n, n); const g = c.getContext('2d'); g.scale(n / 48, n / 48);
    radial(g, 24, 24, 24, [[0, `rgba(${hexRgb(P.c1)},.55)`], [.5, `rgba(${hexRgb(P.c2)},.25)`], [1, 'rgba(0,0,0,0)']]);
    const gr = g.createRadialGradient(21, 20, 0, 24, 24, 12); gr.addColorStop(0, '#fff'); gr.addColorStop(.45, P.c1); gr.addColorStop(.75, P.c2); gr.addColorStop(.77, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(24, 24, 12, 0, TAU); g.fill();
    orbSpr.set(el, c); return c;
  }

  /* ---------- 오브젝트 풀(정해진 크기, 지우기는 맨 끝과 바꾸기) ---------- */
  const F = n => new Float32Array(n), U = n => new Uint8Array(n);
  const swapOut = (A, j, last, keys) => { for (const k of keys) A[k][j] = A[k][last]; };
  // 조각(지금 DOM .ar-fx.bit · fxImpact 조각과 같은 움직임): 시작 → 중간(mo 시점) → 끝 세 점, 크기 · 회전 · 투명도도 세 점.
  const NB = POOL_MAX.bits, B = { x0: F(NB), y0: F(NB), x1: F(NB), y1: F(NB), x2: F(NB), y2: F(NB), mo: F(NB), s0: F(NB), s1: F(NB), s2: F(NB), r0: F(NB), r1: F(NB), r2: F(NB), a1: F(NB), t: F(NB), dur: F(NB), size: F(NB), kind: U(NB), el: U(NB), n: 0 };
  const BKEYS = ['x0', 'y0', 'x1', 'y1', 'x2', 'y2', 'mo', 's0', 's1', 's2', 'r0', 'r1', 'r2', 'a1', 't', 'dur', 'size', 'kind', 'el'];
  function addBit(kind, el, size, x0, y0, x1, y1, x2, y2, mo, s0, s1, s2, r0, r1, r2, dur, delay = 0, a1 = 1) {
    if (B.n >= T.bits) return; const j = B.n++;
    B.x0[j] = x0; B.y0[j] = y0; B.x1[j] = x1; B.y1[j] = y1; B.x2[j] = x2; B.y2[j] = y2; B.mo[j] = mo;
    B.s0[j] = s0; B.s1[j] = s1; B.s2[j] = s2; B.r0[j] = r0; B.r1[j] = r1; B.r2[j] = r2; B.a1[j] = a1;
    B.t[j] = -delay; B.dur[j] = dur; B.size[j] = size; B.kind[j] = kind; B.el[j] = elIdx(el);
  }
  // 불꽃 줄 · 빛 알갱이 · 연기 · 파편(시험 페이지 풀 그대로)
  const NK = POOL_MAX.sparks, K = { x: F(NK), y: F(NK), vx: F(NK), vy: F(NK), life: F(NK), max: F(NK), len: F(NK), col: U(NK), n: 0 };
  const KKEYS = ['x', 'y', 'vx', 'vy', 'life', 'max', 'len', 'col'];
  const NG = POOL_MAX.glows, G = { x: F(NG), y: F(NG), vx: F(NG), vy: F(NG), life: F(NG), max: F(NG), size: F(NG), el: U(NG), n: 0 };
  const GKEYS = ['x', 'y', 'vx', 'vy', 'life', 'max', 'size', 'el'];
  const NM = POOL_MAX.smoke, M = { x: F(NM), y: F(NM), r: F(NM), vr: F(NM), vx: F(NM), vy: F(NM), life: F(NM), max: F(NM), a: F(NM), col: U(NM), n: 0 };
  const MKEYS = ['x', 'y', 'r', 'vr', 'vx', 'vy', 'life', 'max', 'a', 'col'];
  const ND = POOL_MAX.debris, D = { x: F(ND), y: F(ND), z: F(ND), vx: F(ND), vy: F(ND), vz: F(ND), rot: F(ND), vr: F(ND), life: F(ND), max: F(ND), size: F(ND), n: 0 };
  const DKEYS = ['x', 'y', 'z', 'vx', 'vy', 'vz', 'rot', 'vr', 'life', 'max', 'size'];
  const SPARK_COL = ['#ffffff', ...EL_KEYS.map(k => ELEMENTS[k].c1)];
  const SMOKE_RGB = ['90,88,96', '214,211,209', '235,242,255', '200,150,255'];
  function addSparks(x, y, n, el, speed = 220, len = 9) {
    n = Math.round(n * T.mult);
    for (let i = 0; i < n; i++) { if (K.n >= T.sparks) return; const j = K.n++, a = rnd() * TAU, sp = speed * rr(.35, 1); K.x[j] = x; K.y[j] = y; K.vx[j] = Math.cos(a) * sp; K.vy[j] = Math.sin(a) * sp; K.max[j] = K.life[j] = rr(.18, .4); K.len[j] = len * rr(.6, 1.3); K.col[j] = el ? elIdx(el) + 1 : 0; }
  }
  function addGlow(x, y, n, el, speed = 60, size = 10, life = .5) {
    n = Math.max(1, Math.round(n * T.mult));
    for (let i = 0; i < n; i++) { if (G.n >= T.glows) return; const j = G.n++, a = rnd() * TAU, sp = speed * rr(.4, 1); G.x[j] = x; G.y[j] = y; G.vx[j] = Math.cos(a) * sp; G.vy[j] = Math.sin(a) * sp; G.max[j] = G.life[j] = life * rr(.6, 1.2); G.size[j] = size * rr(.6, 1.3); G.el[j] = elIdx(el); }
  }
  function addSmoke(x, y, n, col = 0, r = 14, spread = 14) {
    n = Math.max(1, Math.round(n * T.mult));
    for (let i = 0; i < n; i++) { if (M.n >= T.smoke) return; const j = M.n++, a = rnd() * TAU, d = rr(0, spread); M.x[j] = x + Math.cos(a) * d; M.y[j] = y + Math.sin(a) * d; M.r[j] = r * rr(.6, 1.2); M.vr[j] = r * rr(.8, 1.6); M.vx[j] = Math.cos(a) * rr(6, 20); M.vy[j] = Math.sin(a) * rr(6, 16) - rr(4, 10); M.max[j] = M.life[j] = rr(.8, 1.5); M.a[j] = rr(.45, .75); M.col[j] = col; }
  }
  function addDebris(x, y, n, power = 1) {
    n = Math.round(n * T.mult);
    for (let i = 0; i < n; i++) { if (D.n >= T.debris) return; const j = D.n++, a = rnd() * TAU, sp = rr(.15, 1) * 110 * power; D.x[j] = x + rr(-3, 3); D.y[j] = y + rr(-3, 3); D.z[j] = rr(0, 4); D.vx[j] = Math.cos(a) * sp; D.vy[j] = Math.sin(a) * sp * .6; D.vz[j] = rr(60, 160) * power; D.rot[j] = rnd() * TAU; D.vr[j] = rr(-12, 12); D.max[j] = D.life[j] = rr(.9, 1.5); D.size[j] = rr(5, 11); }
  }

  /* ---------- 큰 효과 · 고리 · 숫자 · 글자 목록(상한) ---------- */
  const fx = [], rings = [], nums = [], pops = [], ghosts = [];
  // layer 0: 바닥(펫 아래) · 1: 펫 위
  function addFx(dur, draw, layer = 1, delay = 0) {
    if (fx.length >= Math.min(LIST_MAX.fx, T.fx)) return null;
    const f = { t: -delay, dur, draw, layer }; fx.push(f); return f;
  }
  function addRing(x, y, rx0, ry0, rx1, ry1, w, color, dur, delay = 0, glow = 0) { if (rings.length < LIST_MAX.rings) rings.push({ x, y, rx0, ry0, rx1, ry1, w, color, dur, t: -delay, glow }); }

  /* ---------- 카메라: 흔들림 · 줌(연출만) ---------- */
  const cam = { shakes: [], zooms: [] };
  const SHAKE_KEYS = [[0, 0], [-1, .6], [1, -.7], [-.7, .4], [.5, -.3], [0, 0]];
  function shake(big) { if (reduced()) return; if (!big && lite()) return; cam.shakes.push({ a: big ? 6 : 3, t: 0, dur: big ? .42 : .22 }); if (cam.shakes.length > 4) cam.shakes.shift(); }
  function zoom(at, amount = .08, ms = 520, keys = [[0, 0], [.3, 1], [.7, .8], [1, 0]]) { if (reduced()) return; cam.zooms.push({ x: at.x, y: at.y, a: amount, t: 0, dur: ms / 1000, keys }); if (cam.zooms.length > 3) cam.zooms.shift(); }
  const keyAt = (keys, p) => { for (let i = 1; i < keys.length; i++) if (p <= keys[i][0]) { const [p0, v0] = keys[i - 1], [p1, v1] = keys[i]; return lerp(v0, v1, (p - p0) / (p1 - p0 || 1)); } return keys[keys.length - 1][1]; };

  /* ---------- 연출 시간 ---------- */
  let stopT = 0, slowT = 0, freezeT = 0;
  const stopFx = ms => { if (!reduced() && ms > 0) stopT = Math.max(stopT, ms / 1000); };

  /* ---------- 사건 연출(지금 DOM 효과 1:1) ---------- */
  const api = {
    stats, get tier() { return tier; },
    px: (x, y) => ({ x: x / 100 * W, y: y / 100 * H }),
    // 펫 칸: 그림이 바뀔 때만(교체 · 판 시작). team: me · foe · ally · enemy
    setPet(who, { key, form, src, poses = {}, team, name, multi = false, dummy = null }) {
      let p = pets.get(who);
      if (!p) { p = { who, poses: {}, poseImg: {}, flashT: 0, rec: null, poseK: '', poseT: 0, buffT: 0, entryT: 0, winT: 0, bobT: rnd() * 2 }; pets.set(who, p); }
      p.key = key; p.form = form; p.team = team; p.name = name; p.multi = multi; p.sz = petSize(who, multi); p.dummy = dummy;
      p.flashT = 0; p.rec = null; p.poseK = ''; p.poses = {}; p.poseImg = {};
      if (p.src !== src) { p.src = src; p.img = null; p.spr = null; }
      const want = src;
      // 허수아비: 주소를 바꿔 두어 먼저 시작한 펫 그림 받기가 늦게 끝나도 덮어쓰지 않게.
      if (dummy) { p.src = `dummy:${dummy}`; const art = artReady('dummy'); p.img = null; p.spr = null; p.dummySpr = art ? null : dummySprite(Math.round(p.sz * S)); if (ARENA_ART.has('dummy')) whenImg('/assets/arena/dummy.webp', im => { if (p.dummy && p.src === `dummy:${dummy}`) { p.img = im; build(p); } }); return; }
      p.dummySpr = null;
      whenImg(src, im => { if (p.src === want) { p.img = im; build(p); } });
      for (const [k, s] of Object.entries(poses)) if (s) whenImg(s, im => { if (p.src === want) { p.poseImg[k] = im; p.poses[k] = sprites(im, Math.round(p.sz * S), p.team === 'enemy' || p.team === 'foe' ? 'rgba(251,113,133,1)' : 'rgba(96,165,250,1)'); } });
    },
    resize, warm(list) { warmQ.push(...list); },
    // 그림 66 · 쓰러짐 별 · 허수아비를 카운트다운 동안 미리 받아 디코드(ARENA_ART에 있는 이름만)
    preload(names) { for (const n of names) if (ARENA_ART.has(n)) image(`/assets/arena/${n}.webp`); },
    // 공격 · 맞는 자세 그림을 ms 동안(미리 받아 둔 것만)
    pose(who, kind, ms) { const p = pets.get(who); if (p?.poses[kind]) { p.poseK = kind; p.poseT = ms / 1000; } },
    flash(who) { const p = pets.get(who); if (p) p.flashT = .11; },
    // 맞고 움찔(fxRecoil과 같은 박자 0.42초)
    recoil(who, dir) { const p = pets.get(who); if (p && !reduced()) p.rec = { t: 0, dir }; },
    aura(who, el) { const p = pets.get(who); if (p) { p.buffT = .6; p.buffEl = el; } },
    entry(who) { const p = pets.get(who); if (p && !reduced()) p.entryT = 1.2; },
    win(who) { const p = pets.get(who); if (p && !reduced()) p.winT = 1.4; },
    ultFreeze(ms) { freezeT = Math.max(freezeT, ms / 1000); },
    // 잔상: 지금 자리 · 방향의 펫 그림이 반투명 · 밝게 0.32초
    afterimage(who) { const p = pets.get(who), d = p?.drawn; if (!p?.spr || !d) return; if (ghosts.length >= LIST_MAX.ghosts) ghosts.shift(); ghosts.push({ spr: p.spr, x: d.x, y: d.y, sz: p.sz, flip: d.flip, t: 0, dur: .32, kind: 'after' }); },
    // 쓰러짐: 회색 펫이 떠올랐다 가라앉으며 사라짐(0.9초) + 쓰러짐 별(그림 fx-faint, 1.4초) + 연기 조금
    // pos: 경기장 좌표(%)
    faint(who, pos) {
      const p = pets.get(who), at = api.px(pos.x, pos.y);
      if (p?.spr) { if (ghosts.length >= LIST_MAX.ghosts) ghosts.shift(); ghosts.push({ spr: p.spr, gray: tinted(p.spr, 'gray'), x: pos.x, y: pos.y, sz: p.sz, flip: p.drawn?.flip, t: 0, dur: .9, kind: 'down' }); }
      const star = artReady('fx-faint');
      if (star) addFx(1.4, (t, q) => { const a = q < .2 ? q / .2 : 1 - (q - .2) / .8, s = q < .2 ? .4 + q / .2 * .6 : 1; ctx.globalAlpha = clamp(a, 0, 1); drawImg(star, at.x, at.y - 70, 84 * s, 84 * s, (1 - Math.min(1, q / .2)) * -.35); });
      addSmoke(at.x, at.y - 10, 5, 0, 12, 10);
    },
    hitStop: stopFx,
    slow(ms) { if (!reduced()) slowT = Math.max(slowT, ms / 1000); },
    shake, zoom,
    punch(amount = .045) { zoom({ x: W / 2, y: H / 2 }, amount, 260, [[0, 0], [.22, 1], [1, 0]]); },
    // 바닥에 굽기(보기만의 것, 판정과 무관 · 되감아도 지우지 않는다)
    stamp(kind, at, w, h, alpha = .5) { stamp(kind, at.x, at.y, w, h, rnd() * TAU, alpha, kind === 'crack-star' ? 2 : 1); },

    spark(at, el) {
      const P = pal(el), g = tint('glow', hexRgb(P.c1));
      addFx(.32, (t, q) => { const s = 30 * (.3 + q * 1.2); ctx.globalAlpha = 1 - q; ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(g, at.x - s / 2, at.y - s / 2, s, s); ctx.drawImage(mat.glow, at.x - s / 4, at.y - s / 4, s / 2, s / 2); ctx.globalCompositeOperation = 'source-over'; });
      addSparks(at.x, at.y, 4, el, 160, 7);
    },
    beam(from, to, el, big) {
      const P = pal(el), dx = to.x - from.x, dy = to.y - from.y, len = Math.hypot(dx, dy), ang = Math.atan2(dy, dx), h = big ? 30 : 14, dur = big ? .7 : .38;
      addFx(dur, (t, q) => {
        const sx = q < .25 ? easeOut(q / .25) : 1, a = q < .5 ? 1 : 1 - (q - .5) / .5;
        ctx.save(); ctx.translate(from.x, from.y); ctx.rotate(ang); ctx.scale(sx, 1); ctx.globalAlpha = a;
        if (!lite()) { ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(tint('glow', hexRgb(P.c1)), -h, -h * 1.4, len + h * 2, h * 2.8); ctx.globalCompositeOperation = 'source-over'; }
        const gr = ctx.createLinearGradient(0, -h / 2, 0, h / 2); gr.addColorStop(0, P.c3); gr.addColorStop(.3, P.c1); gr.addColorStop(.5, '#fff'); gr.addColorStop(.7, P.c1); gr.addColorStop(1, P.c3);
        ctx.fillStyle = gr; roundRect(0, -h / 2, len, h, h / 2); ctx.fill();
        if (q > .3) { ctx.globalAlpha = a * Math.min(1, (q - .3) / .2) * .7; ctx.fillStyle = '#fff'; roundRect(0, -h / 2, len, h, h / 2); ctx.fill(); }
        ctx.restore();
      });
    },
    claw(at, nx, ny, el) {
      const P = pal(el), x = at.x + nx * 30, y = at.y + ny * 24 - 20, ang = Math.atan2(ny, nx);
      addFx(.3, (t, q) => {
        const s = .5 + .6 * easeOut(Math.min(1, q / .5)), a = q < .2 ? q / .2 : 1 - (q - .2) / .8;
        ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.scale(s, s); ctx.globalAlpha = a; ctx.lineWidth = 5; ctx.lineCap = 'round';
        ctx.strokeStyle = P.c1; ctx.beginPath(); ctx.arc(0, 0, 26, -Math.PI * .75, -Math.PI * .25); ctx.stroke();
        ctx.strokeStyle = P.c2; ctx.beginPath(); ctx.arc(0, 0, 26, -Math.PI * .25, Math.PI * .25); ctx.stroke();
        ctx.restore();
      });
    },
    quake(at, el, big) {
      const P = pal(el), bw = big ? 7 : 4;
      addFx(.65, (t, q) => { const k = 1 + 4 * easeOut(q); ctx.globalAlpha = 1 - q; ctx.lineWidth = bw * k * .55; ctx.strokeStyle = P.c1; ctx.beginPath(); ctx.ellipse(at.x, at.y, 20 * k, 8 * k, 0, 0, TAU); ctx.stroke(); }, 0);
      addFx(.9, (t, q) => { ctx.globalAlpha = 1 - q; ctx.drawImage(darkEllipse(), at.x - 45, at.y - 17, 90, 34); }, 0);
      api.stamp('crack-star', at, big ? 64 : 44, big ? 30 : 20, big ? .55 : .35);
      if (big) addDebris(at.x, at.y, 14, .9);
    },
    // 작은 조각 n개를 둘레로(지금 bits: 미리 정한 고른 각도, 보통 8개 · 저사양 4개까지)
    bits(cls, at, n, dist, ms, el, seed = 0) {
      const kind = BIT[cls] ?? 0, k = Math.min(n, T.per), charge = cls === 'charge';
      for (let i = 0; i < k; i++) {
        const a = (i + seed) % 8 * 2.39996, d = dist * (.6 + (i % 3) * .2), dx = Math.cos(a) * d, dy = Math.sin(a) * d * .7;
        const size = cls === 'dust' ? 18 : cls === 'puff' ? 22 : 12;
        if (charge) addBit(kind, el, size, at.x + dx, at.y + dy, at.x + dx / 2, at.y + dy / 2, at.x, at.y, .5, .4, .7, 1, 0, 0, 0, ms / 1000, i * .03, 1);
        else addBit(kind, el, size, at.x, at.y, at.x + dx * .6, at.y + dy * .6, at.x + dx, at.y + dy, .5, 1.1, 1, .7, 0, rr(-2, 2), rr(-4, 4), ms / 1000, i * .03, 1);
      }
    },
    ring(at, el, r = 14) {
      const P = pal(el), R = r / 100 * W;
      addRing(at.x, at.y, R * .2, R * .11, R, R * .55, 5, P.c1, .6, 0, 1);
    },
    // 맞는 순간 조각(battle-fx fxImpact를 캔버스로): 속성 모양 조각 6 · 9 · 12개 + 속성 고리
    impact(at, el, tierN = 1) {
      const P = pal(el), n = Math.ceil((tierN >= 3 ? 12 : tierN === 2 ? 9 : 6) * (lite() ? .5 : 1)), kind = 11 + elIdx(el), X = at.x, Y = at.y;
      for (let i = 0; i < n; i++) {
        const a = TAU * i / n + rr(-.25, .25), d = rr(46, 66) + tierN * 14, s = (rr(13, 20) + tierN * 3) / 12, x = Math.cos(a) * d, y = Math.sin(a) * d;
        if (el === 'flame') addBit(kind, el, 12, X, Y, X + x * .8, Y + y * .8 - 26, X + x, Y + y - 58, .5, .4 * s, 1.1 * s, .2 * s, 0, 0, 0, .52);
        else if (el === 'ice') addBit(kind, el, 12, X, Y, X + x * 1.15, Y + y * 1.15, X + x * 1.3, Y + y * 1.3 + 12, .6, .3 * s, s, .6 * s, 0, rr(-3.8, 3.8), rr(-5.2, 5.2), .48);
        else if (el === 'water') addBit(kind, el, 12, X, Y, X + x * .7, Y - Math.abs(y) - 36, X + x * 1.1, Y + 34 + Math.abs(y) * .2, .45, .4 * s, s, .7 * s, 0, 0, 0, .64);
        else if (el === 'leaf') addBit(kind, el, 12, X, Y, X + Math.cos(a + .9) * d * .8, Y + Math.sin(a + .9) * d * .8, X + Math.cos(a + 1.6) * d * 1.1, Y + Math.sin(a + 1.6) * d * 1.1 + 18, .55, .4 * s, s, .5 * s, 0, rr(3.5, 5.2), rr(7, 9.8), .7);
        else if (el === 'earth') addBit(kind, el, 12, X, Y, X + x * .7, Y - Math.abs(y) - 40, X + x, Y + 30 + Math.abs(y) * .3, .4, .4 * s, s, .8 * s, 0, rr(-3, 3), rr(-6, 6), .62);
        else if (el === 'wind') addBit(kind, el, 12, X, Y, X + x * 1.2, Y + y * 1.2, X + x * 1.5, Y + y * 1.5, .55, .3 * s, s, .5 * s, a, a + 2.1, a + 3.8, .46);
        else if (el === 'toxic') addBit(kind, el, 12, X, Y, X + x * .8, Y + y * .5 - 30, X + x, Y + y * .3 - 70, .5, .3 * s, s, 1.3 * s, 0, 0, 0, .7, 0, .95);
        else addBit(kind, el, 12, X, Y, X + x, Y + y, X + x * 1.25, Y + y * 1.25, .6, .3 * s, s, .3 * s, 0, rr(-3, 3), 0, .52);
      }
      const ring = (size, ms, c = P.c1, squash = 1, delay = 0) => addRing(X, Y, size * .1, size * squash * .1, size / 2, size * squash / 2, 3, c, ms / 1000, delay / 1000, 1);
      if (el === 'ice') { ring(120 + tierN * 40, 480, '#ffffff'); addBit(kind, el, 12, X, Y, X, Y, X, Y, .4, .1 * (54 + tierN * 14) / 12, (54 + tierN * 14) / 12, 1.15 * (54 + tierN * 14) / 12, 0, 1, 1.6, .52, 0, .95); }
      else if (el === 'water') { ring(130 + tierN * 36, 560, P.c2, .42); ring(90 + tierN * 28, 560, P.c1, .42, 90); }
      else if (el === 'earth') { ring(140 + tierN * 44, 520, P.c2, .5); ring(100 + tierN * 30, 520, P.c1, .5, 70); }
      else if (el === 'wind') for (const rot of [-32, 28]) { const L = 150 + tierN * 40, r = rot * Math.PI / 180; addFx(.46, (t, q) => { const sx = q < .35 ? .1 + .9 * easeOut(q / .35) : 1.05, a = q < .35 ? 1 : 1 - (q - .35) / .65; ctx.save(); ctx.translate(X, Y); ctx.rotate(r); ctx.scale(sx, 1); ctx.globalAlpha = a; const gr = ctx.createLinearGradient(-L / 2, 0, L / 2, 0); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(.5, P.c2); gr.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = gr; ctx.fillRect(-L / 2, -2.5, L, 5); ctx.restore(); }); }
      else ring((el === 'toxic' || el === 'leaf' ? 110 + tierN * 36 : el === 'flame' ? 110 + tierN * 40 : 120 + tierN * 40), el === 'toxic' ? 560 : el === 'flame' ? 460 : 500, P.c2, el === 'toxic' ? .6 : 1);
      if (tierN >= 2) addSparks(X, Y, 6 + tierN * 3, el, 240, 10);
    },
    speedLines(at, el) {
      const P = pal(el);
      addFx(.48, (t, q) => {
        const s = .5 + .8 * q, a = q < .25 ? q / .25 * .95 : .95 * (1 - (q - .25) / .75);
        ctx.save(); ctx.translate(at.x, at.y); ctx.rotate(q * .17); ctx.scale(s, s); ctx.globalAlpha = a; ctx.strokeStyle = P.c2; ctx.lineCap = 'round';
        for (let i = 0; i < 14; i++) { const g = i / 14 * TAU; ctx.lineWidth = i % 2 ? 2 : 3.5; ctx.beginPath(); ctx.moveTo(Math.cos(g) * 46, Math.sin(g) * 46); ctx.lineTo(Math.cos(g) * 92, Math.sin(g) * 92); ctx.stroke(); }
        ctx.restore();
      });
    },
    crit(at) {
      const art = artReady('fx-crit');
      addFx(.5, (t, q) => {
        const s = .2 + 1.1 * easeOut(q), a = 1 - easeIn(q);
        ctx.save(); ctx.translate(at.x, at.y); ctx.rotate(q * 1.2); ctx.scale(s, s); ctx.globalAlpha = a;
        if (art) ctx.drawImage(art, -42, -42, 84, 84);
        else { for (let i = 0; i < 8; i++) { ctx.fillStyle = i % 2 ? '#fff' : '#fde047'; ctx.save(); ctx.rotate(i / 8 * TAU); ctx.beginPath(); ctx.moveTo(-3.5, -12); ctx.lineTo(0, -42); ctx.lineTo(3.5, -12); ctx.fill(); ctx.restore(); } ctx.fillStyle = '#fde047'; ctx.beginPath(); ctx.arc(0, 0, 14, 0, TAU); ctx.fill(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, 0, 8, 0, TAU); ctx.fill(); }
        ctx.restore();
      });
      addGlow(at.x, at.y, 4, 'star', 80, 14, .35);
    },
    scorch(at) { addFx(1.6, (t, q) => { ctx.globalAlpha = 1 - q; ctx.drawImage(darkEllipse(), at.x - 55, at.y - 22, 110, 44); }, 0); api.stamp('scorch', at, 90, 36, .35); },
    meteorfall(at, fallMs, mini = false) {
      const art = artReady('fx-meteor'), s = mini ? 40 : 64;
      addFx(fallMs / 1000, (t, q) => {
        const p = q * q * (.6 + .4 * q), x = at.x + 90 * (1 - p), y = at.y - 240 * (1 - p), k = .5 + .5 * p;
        ctx.globalAlpha = Math.min(1, q * 4);
        if (art) { drawImg(art, x, y, s * k, s * k, 0); return; }
        if (!lite()) { ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(tint('glow', '249,115,22'), x - s * k * .2, y - s * k * 1.2, s * k * 1.4, s * k * 1.4); ctx.globalCompositeOperation = 'source-over'; }
        ctx.drawImage(orbSprite('flame'), x - s * k, y - s * k, s * k * 2, s * k * 2);
      });
    },
    ultfx(at, el, kind, artName) {
      const P = pal(el), art = artName ? artReady(artName) : null, R = 100;
      addFx(1.1, (t, q) => {
        const s = .15 + 1.05 * easeOut(q), a = q < .5 ? 1 : 1 - (q - .5) / .5;
        ctx.save(); ctx.translate(at.x, at.y); ctx.rotate(q * 1.6); if (kind === 'cracks') ctx.scale(s, s * .55); else ctx.scale(s, s); ctx.globalAlpha = a;
        if (art) { ctx.drawImage(art, -R, -R, R * 2, R * 2); ctx.restore(); return; }
        if (!lite()) { ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(tint('glow', hexRgb(P.c1)), -R * 1.2, -R * 1.2, R * 2.4, R * 2.4); ctx.globalCompositeOperation = 'source-over'; }
        radial(ctx, 0, 0, R * .7, [[0, '#fff'], [.18, P.c2], [.45, P.c1], [1, `rgba(${hexRgb(P.c1)},0)`]]);
        ctx.strokeStyle = kind === 'vines' ? '#16a34a' : kind === 'cracks' ? '#fbbf24' : '#fff'; ctx.lineWidth = kind === 'cracks' ? 3 : 5; ctx.lineCap = 'round';
        const n = kind === 'frostburst' ? 8 : kind === 'cracks' ? 15 : 12;
        if (kind === 'wave' || kind === 'twister' || kind === 'miasma') { ctx.strokeStyle = kind === 'miasma' ? 'rgba(216,180,254,.9)' : 'rgba(255,255,255,.85)'; for (let i = 1; i <= 4; i++) { ctx.lineWidth = 6 - i; ctx.beginPath(); ctx.arc(0, 0, i * 18, i, i + 4); ctx.stroke(); } }
        else for (let i = 0; i < n; i++) { const g = i / n * TAU; ctx.beginPath(); ctx.moveTo(Math.cos(g) * 24, Math.sin(g) * 24); ctx.lineTo(Math.cos(g) * R * .95, Math.sin(g) * R * .95); ctx.stroke(); }
        ctx.restore();
      });
    },
    ult2ring(at, el, R) {
      const P = pal(el);
      addRing(at.x, at.y, R * .15, R * .15, R, R, 6, P.c1, .75, 0, 1);
      addRing(at.x, at.y, R * .15, R * .15, R, R, 3, P.c2, .75, .12, 1);
      addFx(.6, (t, q) => { const s = .2 + .8 * easeOut(q); ctx.globalAlpha = 1 - q; radial(ctx, at.x, at.y, R * s, [[0, '#fff'], [.22, P.c2], [.45, `rgba(${hexRgb(P.c1)},.6)`], [.7, `rgba(${hexRgb(P.c1)},0)`], [1, 'rgba(0,0,0,0)']]); });
    },
    ult2line(from, len, w, ang, el) {
      const P = pal(el);
      addFx(.8, (t, q) => {
        const sx = q < .3 ? easeOut(q / .3) : 1, sy = q < .3 ? 1.4 - .4 * q / .3 : 1 - (q - .3) * .6, a = q < .55 ? 1 : 1 - (q - .55) / .45;
        ctx.save(); ctx.translate(from.x, from.y); ctx.rotate(ang); ctx.scale(sx, sy); ctx.globalAlpha = a;
        const gr = ctx.createLinearGradient(0, -w / 2, 0, w / 2); gr.addColorStop(0, `rgba(${hexRgb(P.c1)},0)`); gr.addColorStop(.25, P.c1); gr.addColorStop(.5, '#fff'); gr.addColorStop(.75, P.c1); gr.addColorStop(1, `rgba(${hexRgb(P.c1)},0)`);
        ctx.fillStyle = gr; roundRect(0, -w / 2, len, w, w / 2); ctx.fill();
        ctx.globalAlpha = a * .6; ctx.fillStyle = P.c2; for (let x = 18 - (q * 26) % 26; x < len; x += 26) ctx.fillRect(x, -w / 2, 8, w);
        ctx.restore();
      });
    },
    // 굵은 줄기(물대포 · 덩굴 · 번개): 쏜 자리에서 조준 방향으로, 길이가 늘었다 줄며 사라짐
    stream(from, len, thick, ang, el, id, artName) {
      const art = artName ? artReady(artName) : null, dur = id === 'chain' ? .3 : .46;
      addFx(dur, (t, q) => {
        let sx, sy, a;
        if (q < .18) { const k = q / .18; sx = .1 + .9 * k; sy = 1 + .2 * k; a = k; } else if (q < .65) { const k = (q - .18) / .47; sx = 1; sy = 1.2 - .2 * k; a = 1; } else { const k = (q - .65) / .35; sx = 1; sy = 1 - .6 * k; a = 1 - k; }
        ctx.save(); ctx.translate(from.x, from.y); ctx.rotate(ang); ctx.scale(sx, sy); ctx.globalAlpha = a;
        const h = thick;
        if (art) ctx.drawImage(art, 0, -h * .9, len, h * 1.8);
        else if (id === 'jet') { const gr = ctx.createLinearGradient(0, -h / 2, 0, h / 2); gr.addColorStop(0, 'rgba(14,165,233,.2)'); gr.addColorStop(.25, '#38bdf8'); gr.addColorStop(.5, '#f0f9ff'); gr.addColorStop(.75, '#38bdf8'); gr.addColorStop(1, 'rgba(14,165,233,.2)'); ctx.fillStyle = gr; roundRect(0, -h / 2, len, h, h / 2); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,.9)'; for (let x = -(t * 100) % 18; x < len; x += 18) if (x >= 0) ctx.fillRect(x, -h * .28, 8, h * .56); }
        else if (id === 'vine') { ctx.fillStyle = '#15803d'; ctx.fillRect(0, -h / 4, len, h / 2); ctx.fillStyle = '#22c55e'; for (let x = 10; x < len; x += 20) ctx.fillRect(x, -h / 4, 6, h / 2); ctx.fillStyle = '#4ade80'; for (let x = -(t * 60) % 18 + 9; x < len; x += 18) { ctx.beginPath(); ctx.arc(x, 0, h * .3, 0, TAU); ctx.fill(); } }
        else { ctx.strokeStyle = 'rgba(196,181,253,.5)'; ctx.lineWidth = h * .8; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(len, 0); ctx.stroke(); ctx.strokeStyle = '#fef9c3'; ctx.lineWidth = Math.max(2, h * .2); ctx.lineJoin = 'miter'; ctx.beginPath(); ctx.moveTo(0, 0); for (let i = 1; i <= 12; i++) ctx.lineTo(len * i / 12, i === 12 ? 0 : (i % 2 ? -1 : 1) * h * .3 * rr(.5, 1)); ctx.stroke(); ctx.strokeStyle = '#fff'; ctx.lineWidth = Math.max(1, h * .08); ctx.stroke(); }
        ctx.restore();
      });
    },
    // 숫자: 미리 그린 아틀라스에서 잘라 찍는다. text가 있으면(막음!) 글자 그림.
    num(at, value, style, el, text = '') {
      if (nums.length >= LIST_MAX.nums) nums.shift();
      nums.push({ x: at.x, y: at.y, v: String(value), style, el, text, t: 0, dur: style === 'ult' || style === 'ultcrit' ? 1.15 : .9, k: style === 'ult' || style === 'ultcrit' ? 1.7 : style === 'crit' ? 1.6 : style === 'skill' ? 1.45 : 1.3 });
    },
    // 글자(cls는 지금 .ar-fx.pop 클래스 그대로: skill me · stun · count go · hint · emote foe …). 위치는 경기장 px.
    pop(text, at, cls = '') {
      const c = ` ${cls} `, style = c.includes(' count ') ? (c.includes(' go ') ? 'go' : 'count') : c.includes(' emote ') ? (c.includes(' foe ') || c.includes(' o2 ') || c.includes(' o3 ') ? 'emotefoe' : 'emote') : c.includes(' skill ') ? (c.includes(' me ') ? 'skillme' : c.includes(' foe ') ? 'skillfoe' : 'skill')
        : c.includes(' hint ') ? 'hint' : c.includes(' weak ') ? 'weak' : c.includes(' eff ') ? 'eff' : c.includes(' crit ') ? 'crit' : c.includes(' heal ') ? 'heal' : c.includes(' stun ') ? 'stun' : c.includes(' enter ') ? 'enter' : 'base';
      if (pops.length >= LIST_MAX.texts) pops.shift();
      pops.push({ text: String(text), x: at.x, y: at.y, style, t: 0, dur: style === 'count' || style === 'go' ? .95 : style === 'hint' || style.startsWith('emote') ? 1.8 : 1 });
      if (style === 'go') stats.fightAt = performance.now();
    },
    count: () => ({ fx: fx.length, bits: B.n, sparks: K.n, glows: G.n, smoke: M.n, debris: D.n, rings: rings.length, nums: nums.length, texts: pops.length, ghosts: ghosts.length, scars }),
    clear() { fx.length = rings.length = nums.length = pops.length = ghosts.length = 0; B.n = K.n = G.n = M.n = D.n = 0; cam.shakes.length = cam.zooms.length = 0; },
    render, destroy
  };

  let darkE = null;
  function darkEllipse() { if (darkE) return darkE; darkE = mk(90, 34); const g = darkE.getContext('2d'); g.save(); g.translate(45, 17); g.scale(1, 34 / 90); radial(g, 0, 0, 45, [[0, 'rgba(60,35,15,.55)'], [.65, 'rgba(60,35,15,0)'], [1, 'rgba(0,0,0,0)']]); g.restore(); return darkE; }
  function roundRect(x, y, w, h, r) { ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x, y, w, h, Math.min(r, h / 2, Math.abs(w) / 2)); else ctx.rect(x, y, w, h); }
  function drawImg(im, x, y, w, h, rot) { ctx.save(); ctx.translate(x, y); if (rot) ctx.rotate(rot); const k = Math.min(w / (im.naturalWidth || im.width), h / (im.naturalHeight || im.height)), dw = (im.naturalWidth || im.width) * k, dh = (im.naturalHeight || im.height) * k; ctx.drawImage(im, -dw / 2, -dh / 2, dw, dh); ctx.restore(); }

  /* ---------- 그리기 ---------- */
  let frameLog = [], lastTierCheck = 0;
  function render(now, f) {
    if (dead) return;
    if (!cvs.isConnected) return destroy();
    if (f != null) frac = f;
    drawnAt = now;
    const dt = last ? clamp((now - last) / 1000, 0, .1) : 0; last = now;
    if (dt) frameLog.push(dt * 1000);
    if (now - lastTierCheck > TIER_CHECK_MS) { lastTierCheck = now; autoTier(); }
    const fdt = stopT > 0 ? 0 : slowT > 0 ? dt * .35 : dt;
    stopT = Math.max(0, stopT - dt); slowT = Math.max(0, slowT - dt); freezeT = Math.max(0, freezeT - dt);
    stats.frames++;
    warmStep();
    const scene = host.scene?.();
    // 카메라(흔들림 · 줌): 경기장 좌표 → 캔버스
    let sx = 0, sy = 0, z = 1, zx = W / 2, zy = H / 2;
    for (let i = cam.shakes.length - 1; i >= 0; i--) { const s = cam.shakes[i]; s.t += dt; if (s.t >= s.dur) { cam.shakes.splice(i, 1); continue; } const p = s.t / s.dur * (SHAKE_KEYS.length - 1), k = p | 0, u = p - k, A = SHAKE_KEYS[k], Bk = SHAKE_KEYS[k + 1] || A; sx += lerp(A[0], Bk[0], u) * s.a; sy += lerp(A[1], Bk[1], u) * s.a; }
    for (let i = cam.zooms.length - 1; i >= 0; i--) { const q = cam.zooms[i]; q.t += slowT > 0 ? dt * .35 : dt; if (q.t >= q.dur) { cam.zooms.splice(i, 1); continue; } const v = q.a * keyAt(q.keys, q.t / q.dur); if (v > z - 1) { z = 1 + v; zx = q.x; zy = q.y; } }
    const base = (k = 1) => ctx.setTransform(S * z * k, 0, 0, S * z * k, S * (PAD.l + zx * (1 - z) + sx), S * (PAD.t + zy * (1 - z) + sy));
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, cvs.width, cvs.height);
    base();
    if (floor && scars) ctx.drawImage(floor, 0, 0, W, H);
    if (scene) drawGround(scene, now);
    drawList(0, fdt);
    if (scene) drawPets(scene, now, dt, fdt);
    drawDebris(fdt);
    if (scene) drawShots(scene, now);
    drawSmoke(fdt);
    drawList(1, fdt);
    drawRings(fdt); drawBits(fdt); drawGlows(fdt); drawSparks(fdt);
    drawNums(fdt); drawPops(dt);
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    stats.fxMax = Math.max(stats.fxMax, fx.length); stats.bitsMax = Math.max(stats.bitsMax, B.n); stats.sparksMax = Math.max(stats.sparksMax, K.n); stats.glowsMax = Math.max(stats.glowsMax, G.n);
    stats.smokeMax = Math.max(stats.smokeMax, M.n); stats.debrisMax = Math.max(stats.debrisMax, D.n); stats.ringsMax = Math.max(stats.ringsMax, rings.length); stats.numsMax = Math.max(stats.numsMax, nums.length); stats.textsMax = Math.max(stats.textsMax, pops.length);
  }
  function drawList(layer, fdt) {
    for (let i = fx.length - 1; i >= 0; i--) {
      const f = fx[i]; if (f.layer !== layer) continue;
      f.t += fdt; if (f.t >= f.dur) { fx.splice(i, 1); continue; } if (f.t < 0) continue;
      ctx.save(); f.draw(f.t, f.t / f.dur); ctx.restore();
    }
    ctx.globalAlpha = 1;
  }
  // 바닥 표시: 장판 · 경고 원 · 함정 · 줄기 표시(지금 .ar-zone · .ar-warn · .ar-mine · .ar-line과 같은 모양)
  const zoneBorn = new Map();
  function drawGround(sc, now) {
    const v = sc.cur, tt = now / 1000;
    for (const z of v.zones || []) {
      const P = pal(z.el), R = z.r / 100 * W, x = z.x / 100 * W, y = z.y / 100 * H;
      if (!zoneBorn.has(z.n)) { zoneBorn.set(z.n, now); if (zoneBorn.size > 12) zoneBorn.delete(zoneBorn.keys().next().value); }
      const age = (now - zoneBorn.get(z.n)) / 320, pop = age >= 1 || lite() ? 1 : age < .6 ? .3 + .78 * age / .6 : 1.08 - .08 * (age - .6) / .4;
      ctx.globalAlpha = z.left < 10 ? .45 : 1;
      const art = artReady({ petal: 'fx-petal-field', crack: 'fx-crack-field', icefield: 'fx-ice-field', cloud: 'fx-poison-cloud', tornado: 'fx-tornado' }[z.id]);
      ctx.save(); ctx.translate(x, y); ctx.scale(pop, pop);
      if (art) { if (z.id === 'tornado') drawImg(art, 0, -R * .55, R * 1.6, R * 2.8, 0); else drawImg(art, 0, 0, R * 2, R * 2, 0); ctx.restore(); continue; }
      ctx.scale(1, .55);
      const fill = z.id === 'petal' ? ['rgba(187,247,208,.55)', 'rgba(74,222,128,.28)', '#86efac'] : z.id === 'crack' ? ['rgba(120,53,15,.75)', 'rgba(146,64,14,.45)', '#f59e0b'] : z.id === 'icefield' ? ['rgba(240,249,255,.85)', 'rgba(125,211,252,.55)', '#e0f2fe'] : z.id === 'cloud' ? ['rgba(192,132,252,.7)', 'rgba(134,239,172,.4)', ''] : z.id === 'tornado' ? ['rgba(236,253,245,.6)', 'rgba(110,231,183,.3)', 'rgba(167,243,208,.9)'] : [`rgba(${hexRgb(P.c1)},.75)`, `rgba(${hexRgb(P.c2)},.5)`, P.c1];
      radial(ctx, 0, 0, R, [[0, fill[0]], [.55, fill[1]], [.72, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,0)']]);
      if (fill[2]) { ctx.strokeStyle = fill[2]; ctx.lineWidth = 4 * R / 50; ctx.beginPath(); ctx.arc(0, 0, R - 2 * R / 50, 0, TAU); ctx.stroke(); }
      if (z.from === 'foe') { ctx.strokeStyle = 'rgba(244,63,94,.55)'; ctx.lineWidth = 2 * R / 50; ctx.beginPath(); ctx.arc(0, 0, R + 2, 0, TAU); ctx.stroke(); }
      if (!lite()) {
        if (z.id === 'petal') { ctx.rotate(tt * TAU / 3); for (let i = 0; i < 4; i++) { ctx.fillStyle = ['#f9a8d4', '#fff', '#f472b6', '#fbcfe8'][i]; ctx.save(); ctx.rotate(i * TAU / 4); ctx.beginPath(); ctx.arc(R * .64, 0, R * .06, 0, TAU); ctx.fill(); ctx.restore(); } }
        else if (z.id === 'crack') { ctx.globalAlpha *= .55 + .45 * Math.abs(Math.sin(tt * Math.PI * 2)); ctx.strokeStyle = 'rgba(251,191,36,.95)'; ctx.lineWidth = R * .035; for (let i = 0; i < 12; i++) { const g = i / 12 * TAU + .17; ctx.beginPath(); ctx.moveTo(Math.cos(g) * R * .15, Math.sin(g) * R * .15); ctx.lineTo(Math.cos(g) * R * .65, Math.sin(g) * R * .65); ctx.stroke(); } }
        else if (z.id === 'icefield') { const k = (tt / 1.4) % 1; ctx.globalAlpha *= Math.sin(k * Math.PI); ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.fillRect((k - .5) * R * 1.4 - R * .08, -R * .6, R * .16, R * 1.2); }
        else if (z.id === 'cloud') { const k = 1 + .08 * Math.sin(tt * Math.PI / .8); for (const [cx, cy, r, col] of [[-.4, -.2, .28, 'rgba(216,180,254,.85)'], [.3, -.3, .24, 'rgba(167,243,208,.8)'], [0, .3, .32, 'rgba(192,132,252,.85)']]) { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(cx * R * k, cy * R * k, r * R, 0, TAU); ctx.fill(); } }
        else if (z.id === 'tornado') { ctx.scale(1, 1 / .55); ctx.translate(0, -R * .62); ctx.scale(.62, 1); ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = R * .08; for (let i = 0; i < 5; i++) { const yy = -R * .8 + i * R * .36 + (tt * R * 2) % (R * .36); ctx.beginPath(); ctx.ellipse(0, yy, R * (.35 + i * .12), R * .08, 0, 0, TAU); ctx.stroke(); } }
      }
      ctx.restore();
    }
    ctx.globalAlpha = 1;
    for (const q of v.quakes || []) {
      const x = q.x / 100 * W, y = q.y / 100 * H, R = q.r / 100 * W * (1.15 - Math.max(0, q.left) / (q.warn || 14) * .3), mine = q.from === 'me';
      const col = mine ? '96,165,250' : '244,63,94';
      ctx.save(); ctx.translate(x, y); ctx.scale(1, .55);
      if (q.id === 'meteor') radial(ctx, 0, 0, R, [[0, 'rgba(15,23,42,.55)'], [.55, 'rgba(239,68,68,.35)'], [.72, 'rgba(244,63,94,.12)'], [1, 'rgba(244,63,94,.05)']]);
      else radial(ctx, 0, 0, R, [[0, `rgba(${col},.38)`], [.7, `rgba(${col},.12)`], [1, `rgba(${col},.08)`]]);
      ctx.lineWidth = R * .08; ctx.strokeStyle = `rgba(${col},.9)`; ctx.beginPath(); ctx.arc(0, 0, R - R * .04, 0, TAU); ctx.stroke();
      if (!lite() && !reduced()) { ctx.globalAlpha = Math.abs(Math.sin(now / 1000 * Math.PI / .25)); ctx.strokeStyle = '#fff'; ctx.lineWidth = R * .06; ctx.beginPath(); ctx.arc(0, 0, R + R * .03, 0, TAU); ctx.stroke(); }
      ctx.restore();
    }
    for (const m of v.mines || []) {
      const x = m.x / 100 * W, y = m.y / 100 * H, P = pal(m.el);
      ctx.save(); ctx.translate(x, y); ctx.scale(1, 16 / 26);
      radial(ctx, 0, 0, 13, [[0, P.c1], [.7, 'rgba(0,0,0,.5)'], [1, 'rgba(0,0,0,0)']]);
      if (m.from === 'foe') { ctx.strokeStyle = 'rgba(244,63,94,.85)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, 13, 0, TAU); ctx.stroke(); }
      ctx.rotate(lite() ? 0 : now / 2500 * TAU); ctx.setLineDash([4, 4]); ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, 19, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
      ctx.restore();
    }
    for (const L of v.lines || []) {
      const x = L.x / 100 * W, y = L.y / 100 * H, len = L.len / 100 * W, h = 10 * Math.max(.4, L.w * 2 / 100 * W / 10), ang = Math.atan2(L.ny * H, L.nx * W), mine = L.from !== 'foe', P = pal(L.el);
      ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.globalAlpha = lite() ? 1 : .55 + .45 * Math.abs(Math.sin(now / 1000 * Math.PI / .12));
      const gr = ctx.createLinearGradient(0, 0, len, 0); gr.addColorStop(0, mine ? `rgba(${hexRgb(P.c1)},.7)` : 'rgba(244,63,94,.55)'); gr.addColorStop(1, mine ? `rgba(${hexRgb(P.c1)},.25)` : 'rgba(244,63,94,.15)');
      ctx.fillStyle = gr; roundRect(0, -h / 2, len, h, 6); ctx.fill();
      ctx.setLineDash([3, 3]); ctx.lineWidth = 1; ctx.strokeStyle = mine ? 'rgba(255,255,255,.75)' : 'rgba(254,202,202,.95)'; ctx.stroke(); ctx.setLineDash([]);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }
  // 펫 자리(앞 틱 ↔ 지금 틱 보간, 교체 · 밀쳐내기는 한 번에)
  const placeOf = (sc, who) => {
    const a = sc.prev[who] || sc.cur[who], b = sc.cur[who];
    const jump = a.idx !== b.idx || Math.abs(b.x - a.x) > 12, x = jump ? b.x : a.x + (b.x - a.x) * frac, y = jump ? b.y : a.y + (b.y - a.y) * frac;
    return { x, y };
  };
  const REC = [[0, 0, 0, 0, 1, 1], [.2, 16, -4, -9, .92, 1.08], [.5, 9, 0, -5, 1.04, .96], [1, 0, 0, 0, 1, 1]];
  const WIN = [[0, 0], [.25, -18], [.5, 0], [.75, -10], [1, 0]];
  function drawPets(sc, now, dt, fdt) {
    const v = sc.cur, list = [];
    for (const who of sc.slots) { const b = v[who]; if (!b) continue; const at = placeOf(sc, who); list.push({ who, b, at, y: at.y }); }
    for (const m of v.minions || []) list.push({ clone: m, y: m.y });
    list.sort((a, b) => a.y - b.y || (a.who === 'me' ? 1 : b.who === 'me' ? -1 : 0));
    // 잔상 · 쓰러짐 유령(펫 아래)
    for (let i = ghosts.length - 1; i >= 0; i--) {
      const g = ghosts[i]; g.t += fdt; if (g.t >= g.dur) { ghosts.splice(i, 1); continue; }
      const q = g.t / g.dur, sz = g.sz, x = g.x / 100 * W, y = g.y / 100 * H;
      ctx.save(); ctx.translate(x, y);
      if (g.kind === 'down') { const up = q < .3 ? -.14 * sz * q / .3 : -.14 * sz + .5 * sz * (q - .3) / .7, rot = (q < .3 ? q / .3 : 1) * -.21; ctx.translate(0, up); ctx.rotate(rot); ctx.globalAlpha = q < .3 ? 1 : 1 - (q - .3) / .7; if (g.flip) ctx.scale(-1, 1); ctx.drawImage(g.gray, -sz / 2, -sz * .8, sz, sz); }
      else { ctx.globalAlpha = q < .7 ? .35 : .35 * (1 - (q - .7) / .3); if (g.flip) ctx.scale(-1, 1); ctx.drawImage(g.spr.body, -sz / 2, -sz * .8, sz, sz); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha *= .35; ctx.drawImage(g.spr.white, -sz / 2, -sz * .8, sz, sz); }
      ctx.restore();
    }
    const tt = now / 1000;
    for (const it of list) {
      if (it.clone) { drawClone(sc, it.clone, tt); continue; }
      const { who, b, at } = it, p = pets.get(who); if (!p) continue;
      const x = at.x / 100 * W, y = at.y / 100 * H, sz = p.sz;
      p.flashT = Math.max(0, p.flashT - fdt); p.poseT = Math.max(0, p.poseT - fdt); p.buffT = Math.max(0, p.buffT - fdt); p.entryT = Math.max(0, p.entryT - dt); p.winT = Math.max(0, p.winT - dt);
      if (p.rec) { p.rec.t += fdt / .42; if (p.rec.t >= 1) p.rec = null; }
      const other = sc.cur[who === 'me' ? 'foe' : 'me'];
      const flip = b.fx < -0.1 || (Math.abs(b.fx) <= 0.1 && other && other.x < at.x);
      p.drawn = { x: at.x, y: at.y, flip };
      const out = b.out >= 0, hidden = b.enter > 0;
      p.goneA = out ? Math.max(0, (p.goneA ?? 1) - dt / .8) : 1;
      if (hidden || p.goneA <= 0) continue;
      let alpha = p.goneA * (b.inv > 0 && b.dash > 0 ? .55 : 1);
      // 그림자 · 팀 고리(발밑)
      ctx.globalAlpha = alpha;
      ctx.save(); ctx.translate(x, y - sz * .8 + sz * .98); ctx.scale(1, .16 / .72);
      radial(ctx, 0, 0, sz * .36, [[0, b.slide > 0 ? 'rgba(186,230,253,.8)' : 'rgba(0,0,0,.42)'], [.7, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,0)']]);
      ctx.restore();
      // 몸: 숨쉬기(1.1초) · 기절 흔들림 · 움찔 · 등장 · 승리 뛰기
      let ox = 0, oy = 0, rot = 0, kx = 1, ky = 1;
      const bobOn = T.bob && !reduced() && !p.dummy && !(b.chan > 0) && freezeT <= 0;
      if (b.stun > 0 && !reduced()) rot = Math.sin(tt * TAU / .5) * .14;
      else if (bobOn) { p.bobT += dt; const k = (1 - Math.cos(p.bobT / 1.1 * TAU)) / 2; oy = -.05 * sz * k; kx = 1 + .03 * k; ky = 1 - .03 * k; }
      if (p.rec) { const r = REC, q = p.rec.t; let i = 1; while (i < r.length - 1 && q > r[i][0]) i++; const [q0, ...a] = r[i - 1], [q1, ...c] = r[i], u = (q - q0) / (q1 - q0); ox += lerp(a[0], c[0], u) * p.rec.dir; oy += lerp(a[1], c[1], u); rot += lerp(a[2], c[2], u) * p.rec.dir * Math.PI / 180; kx *= lerp(a[3], c[3], u); ky *= lerp(a[4], c[4], u); }
      if (p.entryT > 0) { const q = 1 - p.entryT / 1.2, s = q < .4 ? easeOut(q / .4) * 1.12 : 1.12 - .12 * Math.min(1, (q - .4) / .3); kx *= s; ky *= s; alpha *= Math.min(1, q / .15); }
      if (p.winT > 0) oy += keyAt(WIN, 1 - p.winT / 1.4);
      const cx = x + ox, cy = y - sz * .3 + oy; // 몸 가운데(DOM 칸은 발 기준 -80%, 몸 가운데는 -30%)
      ctx.save(); ctx.translate(cx, cy); if (rot) ctx.rotate(rot); ctx.scale(kx, ky);
      // 상태 바깥 고리(강화 · 보호막 · 충전 · 방울 · 버프)
      drawAura(p, b, sz, tt);
      if (flip) ctx.scale(-1, 1);
      const s = p.poseT > 0 && p.poses[p.poseK] ? p.poses[p.poseK] : p.spr;
      ctx.globalAlpha = alpha;
      if (p.dummy) { const im = p.img; if (im) drawImg(im, 0, sz * .06, sz * .76, sz * .94, 0); else if (p.dummySpr) ctx.drawImage(p.dummySpr, -sz / 2, -sz / 2, sz, sz); }
      else if (s) {
        if (s.glow && T.glow) { const r = s.glow.r / S; ctx.drawImage(s.glow.c, -sz / 2 - r, -sz / 2 - r, sz + r * 2, sz + r * 2); }
        const tintK = b.poison > 0 ? 'poison' : b.slow > 0 ? 'slow' : '';
        ctx.drawImage(tintK ? tinted(s, tintK) : s.body, -sz / 2, -sz / 2, sz, sz);
        if (p.flashT > 0) { ctx.globalAlpha = alpha * .95 * Math.min(1, p.flashT / .055); ctx.drawImage(s.white, -sz / 2, -sz / 2, sz, sz); }
      }
      ctx.restore();
      ctx.globalAlpha = alpha;
      drawStatus(p, b, x + ox, y + oy, sz, tt);
      drawHp(sc, who, b, x, y - sz * .8, sz, p);
      if (who === 'me' && sc.face) drawFace(x, y, v.me);
      if (p.multi) { const s2 = textSprite(p.name || '', who === 'me' ? 'tagme' : sc.ally?.(who) ? 'tagally' : 'tag'); ctx.drawImage(s2.c, x - s2.w / 2, y - sz * .8 - sz * .24 - s2.h / 2, s2.w, s2.h); }
      ctx.globalAlpha = 1;
    }
    // 불 뿜기(부채꼴 지속)는 펫 위로
    for (const who of sc.slots) { const s = v[who]; if (s?.chan > 0) drawCone(sc, who, s, tt); }
  }
  function drawAura(p, b, sz, tt) {
    const rx = sz * .46, ry = sz * .48;
    if (b.boost > 0) { ctx.save(); if (!lite()) ctx.rotate(tt * TAU); ctx.lineWidth = sz * .1; ctx.strokeStyle = 'rgba(251,146,60,.5)'; ctx.beginPath(); ctx.ellipse(0, sz * .02, rx * .85, ry * .85, 0, 0, TAU); ctx.stroke(); ctx.restore(); }
    if (b.shield > 0) { ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(186,230,253,.9)'; ctx.beginPath(); ctx.ellipse(0, sz * .02, rx, ry, 0, 0, TAU); ctx.stroke(); }
    if (b.power2 > 0) { ctx.save(); if (!lite()) ctx.rotate(tt * TAU / 1.2); ctx.setLineDash([6, 5]); ctx.lineWidth = 3; ctx.strokeStyle = '#fde047'; ctx.beginPath(); ctx.ellipse(0, sz * .02, rx, ry, 0, 0, TAU); ctx.stroke(); ctx.setLineDash([]); ctx.restore(); }
    if (b.bubble > 0) { const k = lite() ? 1 : 1 + .03 * Math.sin(tt * Math.PI / 1.2); ctx.save(); ctx.scale(k, k); radial(ctx, 0, 0, sz * .64, [[0, 'rgba(0,0,0,0)'], [.78, 'rgba(0,0,0,0)'], [.92, 'rgba(125,211,252,.55)'], [.98, 'rgba(240,249,255,.85)'], [1, 'rgba(240,249,255,0)']]); ctx.fillStyle = 'rgba(255,255,255,.9)'; ctx.beginPath(); ctx.arc(-sz * .2, -sz * .26, sz * .06, 0, TAU); ctx.fill(); ctx.restore(); }
    if (p.buffT > 0) { const q = 1 - p.buffT / .6, P = pal(p.buffEl); ctx.save(); ctx.globalAlpha = 1 - q; ctx.scale(.4 + .9 * q, .4 + .9 * q); ctx.lineWidth = 6; ctx.strokeStyle = P.c1; ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, 0, TAU); ctx.stroke(); ctx.restore(); }
  }
  function drawStatus(p, b, x, y, sz, tt) {
    if (b.root > 0) { ctx.save(); ctx.translate(x, y); ctx.lineWidth = 4; ctx.lineCap = 'round'; for (let i = 0; i < 6; i++) { const bx = (-.5 + i / 5) * sz * .9; ctx.strokeStyle = i % 2 ? '#22c55e' : '#166534'; ctx.beginPath(); ctx.moveTo(bx, 0); ctx.quadraticCurveTo(bx + (i % 2 ? 8 : -8), -sz * .22, bx, -sz * .4); ctx.stroke(); } ctx.restore(); }
    if (b.burn > 0) { const k = lite() ? 1 : .92 + .08 * Math.sin(tt * Math.PI / .2); ctx.save(); ctx.translate(x, y - sz * .3); ctx.scale(k, k); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha *= .85; ctx.drawImage(tint('glow', '249,115,22'), -sz * .35, -sz * .45, sz * .7, sz * .55); ctx.restore(); }
    if (b.stun > 0) { ctx.save(); ctx.translate(x, y - sz * .94); for (let i = 0; i < 3; i++) { const a = tt * 4 + i * TAU / 3; ctx.drawImage(bitSprite(9, 'star'), Math.cos(a) * sz * .22 - 6, Math.sin(a) * sz * .07 - 6, 12, 12); } ctx.restore(); }
  }
  const HP_COL = { me: ['#22c55e', '#86efac'], foe: ['#f43f5e', '#fda4af'], ally: ['#3b82f6', '#93c5fd'], low: ['#f59e0b', '#fde047'] };
  function drawHp(sc, who, b, x, top, sz, p) {
    const f = b.team?.[b.idx]; if (!f) return;
    const w = sz * .76, h = 7, X = x - w / 2, Y = top - sz * .1, r = Math.max(0, f.cur / f.hp), sh = Math.min(1, b.shield / f.hp * 2);
    p.hpShow = p.hpShow == null || p.hpIdx !== b.idx ? r : p.hpShow + (r - p.hpShow) * Math.min(1, (1 / 60) / .08);
    p.hpIdx = b.idx;
    ctx.fillStyle = 'rgba(0,0,0,.5)'; roundRect(X, Y, w, h, 4.5); ctx.fill();
    ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.stroke();
    const col = r < .3 ? HP_COL.low : who === 'me' ? HP_COL.me : p.team === 'ally' ? HP_COL.ally : HP_COL.foe;
    if (p.hpShow > 0) { const gr = ctx.createLinearGradient(X, 0, X + w, 0); gr.addColorStop(0, col[0]); gr.addColorStop(1, col[1]); ctx.fillStyle = gr; roundRect(X, Y, w * clamp(p.hpShow, 0, 1), h, 4.5); ctx.fill(); }
    if (sh > 0) { ctx.fillStyle = 'rgba(214,240,255,.85)'; roundRect(X, Y, w * sh, h, 4.5); ctx.fill(); }
  }
  // 내 펫이 바라보는 쪽 화살표(발밑에서 50px)
  function drawFace(x, y, m) {
    if (!m) return; const a = Math.atan2(m.fy * H, m.fx * W), c = Math.cos(a), s = Math.sin(a);
    ctx.save(); ctx.translate(x + c * 44, y + s * 44); ctx.rotate(a + Math.PI / 2); ctx.fillStyle = '#60a5fa';
    ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(8, 6); ctx.lineTo(-8, 6); ctx.closePath(); ctx.fill(); ctx.restore();
  }
  function drawCone(sc, who, s, tt) {
    const at = placeOf(sc, who), x = at.x / 100 * W, y = at.y / 100 * H - 14, len = (sc.coneRange || 30) / 100 * W, ang = Math.atan2(s.cny * H, s.cnx * W), k = len / 200, art = artReady('fx-flame-breath');
    ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.scale(k, k);
    if (art) ctx.drawImage(art, 0, -58, 200, 116);
    else {
      const fl = lite() ? 1 : .92 + .08 * Math.abs(Math.sin(tt * Math.PI / .22));
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(200, -58 * fl); ctx.lineTo(200, 58 * fl); ctx.closePath(); ctx.save(); ctx.clip();
      ctx.scale(1, .58); radial(ctx, 0, 0, 200 * fl, [[0, '#fff'], [.14, '#fde047'], [.38, '#f97316'], [.62, 'rgba(220,38,38,.75)'], [.8, 'rgba(220,38,38,0)'], [1, 'rgba(0,0,0,0)']]);
      ctx.restore();
      if (!lite()) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = .5; ctx.drawImage(tint('glow', '249,115,22'), 10, -50, 190, 100); }
    }
    ctx.restore();
  }
  function drawClone(sc, m, tt) {
    const p = pets.get(m.from), x = m.x / 100 * W, y = m.y / 100 * H, sz = 62; if (!p?.spr) return;
    const opp = sc.cur[m.from === 'me' ? 'foe' : 'me'];
    ctx.save(); ctx.translate(x, y - sz * .3);
    ctx.save(); if (!lite()) ctx.rotate(tt * TAU / 1.6); ctx.lineWidth = 3; for (let i = 0; i < 3; i++) { ctx.strokeStyle = ['#fde68a', '#c4b5fd', '#fff'][i]; ctx.beginPath(); ctx.arc(0, 0, sz * .62, i * TAU / 3, i * TAU / 3 + .3); ctx.stroke(); } ctx.restore();
    if (opp && m.x > opp.x) ctx.scale(-1, 1);
    ctx.globalAlpha = .62; ctx.drawImage(p.spr.body, -sz / 2, -sz / 2, sz, sz);
    ctx.restore(); ctx.globalAlpha = 1;
  }
  const SHOT_ART = { boulder: 'fx-boulder', spear: 'fx-ice-spear', clone: 'fx-clone' };
  function drawShots(sc, now) {
    const tt = now / 1000;
    for (const s of sc.cur.shots || []) {
      const x = s.x / 100 * W, y = s.y / 100 * H, d = s.r * 2 / 100 * W + 6, ang = s.id ? Math.round(Math.atan2(s.vy * H, s.vx * W) * 180 / Math.PI / 5) * 5 * Math.PI / 180 : 0;
      const art = s.id ? artReady(SHOT_ART[s.id]) : null;
      ctx.save(); ctx.translate(x, y);
      if (art) { if (s.id !== 'boulder' && s.id !== 'clone') ctx.rotate(ang); drawImg(art, 0, 0, s.id === 'spear' ? d * 2.6 : d, d, 0); }
      else if (s.id === 'boulder') { ctx.rotate(tt * TAU / .4); ctx.drawImage(mat['rock-a'], -d / 2, -d / 2, d, d); }
      else if (s.id === 'spear') { ctx.rotate(ang); const L = d * 2.6, gr = ctx.createLinearGradient(-L / 2, 0, L / 2, 0); gr.addColorStop(0, 'rgba(186,230,253,0)'); gr.addColorStop(.3, '#bae6fd'); gr.addColorStop(.7, '#f0f9ff'); gr.addColorStop(1, '#fff'); ctx.fillStyle = gr; ctx.beginPath(); ctx.moveTo(-L / 2, -d * .15); ctx.lineTo(L * .25, -d * .3); ctx.lineTo(L / 2, 0); ctx.lineTo(L * .25, d * .3); ctx.lineTo(-L / 2, d * .15); ctx.closePath(); ctx.fill(); }
      else if (s.id === 'darts') { ctx.rotate(ang); const L = d * 2.2, h = d * .55, gr = ctx.createLinearGradient(-L / 2, 0, L / 2, 0); gr.addColorStop(0, 'rgba(192,132,252,0)'); gr.addColorStop(.4, '#a855f7'); gr.addColorStop(.85, '#bbf7d0'); gr.addColorStop(1, '#fff'); ctx.fillStyle = gr; roundRect(-L / 2, -h / 2, L, h, h / 2); ctx.fill(); }
      else if (s.id === 'clone') { ctx.drawImage(bitSprite(9, 'star'), -d / 2, -d / 2, d, d); }
      else {
        const o = orbSprite(s.el), k = s.kind === 'skill' && !lite() ? 2.4 : lite() ? 1.05 : 2;
        ctx.drawImage(o, -d * k / 2, -d * k / 2, d * k, d * k);
        if (s.from === 'foe') { ctx.strokeStyle = 'rgba(244,63,94,.65)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, d / 2 + 1.5, 0, TAU); ctx.stroke(); }
      }
      ctx.restore();
    }
  }
  function drawRings(fdt) {
    for (let i = rings.length - 1; i >= 0; i--) {
      const r = rings[i]; r.t += fdt; if (r.t >= r.dur) { rings.splice(i, 1); continue; } if (r.t < 0) continue;
      const q = easeOut(r.t / r.dur), a = 1 - r.t / r.dur;
      ctx.globalAlpha = a; ctx.strokeStyle = r.color; ctx.lineWidth = r.w;
      ctx.beginPath(); ctx.ellipse(r.x, r.y, Math.max(.1, lerp(r.rx0, r.rx1, q)), Math.max(.1, lerp(r.ry0, r.ry1, q)), 0, 0, TAU); ctx.stroke();
      if (r.glow && !lite()) { ctx.globalAlpha = a * .35; ctx.lineWidth = r.w * 3; ctx.stroke(); }
    }
    ctx.globalAlpha = 1;
  }
  function drawBits(fdt) {
    for (let j = B.n - 1; j >= 0; j--) { B.t[j] += fdt; if (B.t[j] >= B.dur[j]) swapOut(B, j, --B.n, BKEYS); }
    for (let j = 0; j < B.n; j++) {
      if (B.t[j] < 0) continue;
      const q = easeOut(B.t[j] / B.dur[j]), mo = B.mo[j], u = q < mo ? q / mo : (q - mo) / (1 - mo), first = q < mo;
      const x = first ? lerp(B.x0[j], B.x1[j], u) : lerp(B.x1[j], B.x2[j], u), y = first ? lerp(B.y0[j], B.y1[j], u) : lerp(B.y1[j], B.y2[j], u);
      const s = first ? lerp(B.s0[j], B.s1[j], u) : lerp(B.s1[j], B.s2[j], u), r = first ? lerp(B.r0[j], B.r1[j], u) : lerp(B.r1[j], B.r2[j], u);
      const a = first ? lerp(1, B.a1[j], u) : lerp(B.a1[j], 0, u), img = bitSprite(B.kind[j], EL_KEYS[B.el[j]]), w = B.size[j] * s * (B.kind[j] >= 11 ? 1.7 : 1);
      ctx.globalAlpha = clamp(a, 0, 1);
      if (r) { ctx.save(); ctx.translate(x, y); ctx.rotate(r); ctx.drawImage(img, -w / 2, -w / 2, w, w); ctx.restore(); }
      else ctx.drawImage(img, x - w / 2, y - w / 2, w, w);
    }
    ctx.globalAlpha = 1;
  }
  function drawSparks(fdt) {
    for (let j = K.n - 1; j >= 0; j--) { K.life[j] -= fdt; if (K.life[j] <= 0) { swapOut(K, j, --K.n, KKEYS); continue; } K.x[j] += K.vx[j] * fdt; K.y[j] += K.vy[j] * fdt; const d = 1 - 3.5 * fdt; K.vx[j] *= d; K.vy[j] *= d; }
    if (!K.n) return;
    ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round'; ctx.lineWidth = 2;
    for (let c = 0; c < SPARK_COL.length; c++) {
      let any = false; ctx.beginPath();
      for (let j = 0; j < K.n; j++) { if (K.col[j] !== c) continue; any = true; const sp = Math.hypot(K.vx[j], K.vy[j]) || 1, l = K.len[j] * (K.life[j] / K.max[j]); ctx.moveTo(K.x[j], K.y[j]); ctx.lineTo(K.x[j] - K.vx[j] / sp * l, K.y[j] - K.vy[j] / sp * l); }
      if (any) { ctx.strokeStyle = SPARK_COL[c]; ctx.stroke(); }
    }
    ctx.globalCompositeOperation = 'source-over';
  }
  function drawGlows(fdt) {
    for (let j = G.n - 1; j >= 0; j--) { G.life[j] -= fdt; if (G.life[j] <= 0) { swapOut(G, j, --G.n, GKEYS); continue; } G.x[j] += G.vx[j] * fdt; G.y[j] += G.vy[j] * fdt; G.vx[j] *= 1 - 2 * fdt; G.vy[j] *= 1 - 2 * fdt; }
    if (!G.n) return;
    ctx.globalCompositeOperation = 'lighter';
    for (let j = 0; j < G.n; j++) { const p = G.life[j] / G.max[j], s = G.size[j]; ctx.globalAlpha = Math.min(1, p * 2); ctx.drawImage(tint('glow', RGB[EL_KEYS[G.el[j]]]), G.x[j] - s / 2, G.y[j] - s / 2, s, s); }
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  }
  function drawSmoke(fdt) {
    for (let j = M.n - 1; j >= 0; j--) { M.life[j] -= fdt; if (M.life[j] <= 0) { swapOut(M, j, --M.n, MKEYS); continue; } M.x[j] += M.vx[j] * fdt; M.y[j] += M.vy[j] * fdt; M.vx[j] *= 1 - fdt * 1.5; M.vy[j] *= 1 - fdt * 1.5; M.r[j] += M.vr[j] * fdt; M.vr[j] *= 1 - fdt * .8; }
    for (let j = 0; j < M.n; j++) { const p = 1 - M.life[j] / M.max[j], r = M.r[j]; ctx.globalAlpha = M.a[j] * (p < .15 ? p / .15 : 1 - (p - .15) / .85); ctx.drawImage(tint('smoke', SMOKE_RGB[M.col[j]] || SMOKE_RGB[0]), M.x[j] - r, M.y[j] - r, r * 2, r * 2); }
    ctx.globalAlpha = 1;
  }
  function drawDebris(fdt) {
    for (let j = D.n - 1; j >= 0; j--) {
      D.life[j] -= fdt; if (D.life[j] <= 0) { swapOut(D, j, --D.n, DKEYS); continue; }
      D.vz[j] -= 420 * fdt; D.z[j] += D.vz[j] * fdt; D.x[j] += D.vx[j] * fdt; D.y[j] += D.vy[j] * fdt; D.rot[j] += D.vr[j] * fdt;
      if (D.z[j] < 0) { D.z[j] = 0; D.vz[j] *= -.32; D.vx[j] *= .55; D.vy[j] *= .55; D.vr[j] *= .5; if (Math.abs(D.vz[j]) < 10) D.vz[j] = 0; }
    }
    const img = mat['rock-a'];
    for (let j = 0; j < D.n; j++) { const s = D.size[j]; ctx.globalAlpha = Math.min(1, D.life[j] / .3); ctx.save(); ctx.translate(D.x[j], D.y[j] - D.z[j]); ctx.rotate(D.rot[j]); ctx.drawImage(img, -s / 2, -s / 2, s, s); ctx.restore(); }
    ctx.globalAlpha = 1;
  }
  function drawNums(fdt) {
    for (let i = nums.length - 1; i >= 0; i--) {
      const n = nums[i]; n.t += fdt; if (n.t >= n.dur) { nums.splice(i, 1); continue; }
      const q = n.t / n.dur;
      // 지금 .ar-num 애니메이션 박자: 0 작게 · 투명 → 0.14 크게(k) → 0.32 제 크기 → 0.7 그대로 → 끝 위로 떠오르며 사라짐
      let s, up, a;
      if (q < .14) { const u = q / .14; s = lerp(.4, n.k, u); up = lerp(.3, .7, u); a = u; } else if (q < .32) { const u = (q - .14) / .18; s = lerp(n.k, 1, u); up = lerp(.7, .8, u); a = 1; } else if (q < .7) { s = 1; up = .8; a = 1; } else { const u = (q - .7) / .3; s = lerp(1, .9, u); up = lerp(.8, 1.7, u); a = 1 - u; }
      ctx.globalAlpha = a;
      if (n.text) { const sp = textSprite(n.text, 'block'); ctx.drawImage(sp.c, n.x - sp.w * s / 2, n.y - sp.h * up * s - sp.h * s / 2 + sp.h / 2, sp.w * s, sp.h * s); continue; }
      const A = atlas(n.style, EL_KEYS[elIdx(n.el)]), k = A.k / S * s, cw = A.cw * k, ch = A.ch * k, adv = A.adv * k, w = adv * n.v.length;
      const y = n.y - ch * .55 * up * 1.4;
      for (let d = 0; d < n.v.length; d++) { const v = n.v.charCodeAt(d) - 48; if (v < 0 || v > 9) continue; ctx.drawImage(A.c, v * A.cw, 0, A.cw, A.ch, n.x - w / 2 + d * adv - (cw - adv) / 2, y - ch / 2, cw, ch); }
    }
    ctx.globalAlpha = 1;
  }
  function drawPops(dt) {
    for (let i = pops.length - 1; i >= 0; i--) {
      const o = pops[i]; o.t += dt; if (o.t >= o.dur) { pops.splice(i, 1); continue; }
      const sp = textSprite(o.text, o.style), q = o.t / o.dur;
      let s = 1, a = 1, up = 0;
      if (o.style === 'count' || o.style === 'go') { s = q < .3 ? lerp(2.2, 1, easeOut(q / .3)) : 1; a = q < .15 ? q / .15 : q > .75 ? 1 - (q - .75) / .25 : 1; }
      else if (o.style.startsWith('emote')) { s = q < .12 ? lerp(.6, 1.08, q / .12) : q < .2 ? lerp(1.08, 1, (q - .12) / .08) : 1; a = q < .1 ? q / .1 : q > .85 ? 1 - (q - .85) / .15 : 1; up = q * 10; }
      else { s = q < .12 ? lerp(.5, 1.1, q / .12) : q < .25 ? lerp(1.1, 1, (q - .12) / .13) : 1; a = q < .12 ? q / .12 : q > .7 ? 1 - (q - .7) / .3 : 1; up = q < .12 ? lerp(-.2, 0, q / .12) * sp.h : easeOut(Math.max(0, (q - .12) / .88)) * 18; }
      const w = sp.w * s, h = sp.h * s, x = clamp(o.x, w / 2 + 2 - PAD.l, W + PAD.r - w / 2 - 2);
      ctx.globalAlpha = clamp(a, 0, 1); ctx.drawImage(sp.c, x - w / 2, o.y - up - h / 2, w, h);
    }
    ctx.globalAlpha = 1;
  }

  /* ---------- 품질 자동 ---------- */
  function autoTier() {
    const log = frameLog; frameLog = [];
    if (!log.length || document.hidden) return;
    const slow = log.filter(d => d > SLOW_MS).length / log.length;
    stats.lastSlow = Math.round(slow * 100); stats.lastAvg = Math.round(log.reduce((a, b) => a + b, 0) / log.length * 10) / 10;
    if (auto && slow > .15 && tier > 0 && stats.frames > 90) setTier(Math.max(0, tier - (slow > .5 ? 2 : 1)));
  }
  function setTier(t) {
    tier = t; T = TIERS[t]; stats.tier = t; stats.tierLog.push(`${Math.round(performance.now() / 1000)}s→${t}`);
    B.n = Math.min(B.n, T.bits); K.n = Math.min(K.n, T.sparks); G.n = Math.min(G.n, T.glows); M.n = Math.min(M.n, T.smoke); D.n = Math.min(D.n, T.debris);
    try { localStorage.setItem(TIER_KEY, JSON.stringify({ t, at: Date.now() })); } catch {}
    resize(); host.onTier?.(t);
  }
  api.setTier = t => { auto = false; setTier(clamp(t | 0, 0, 3)); };

  /* ---------- 고리: 아레나 loop가 그리지 않는 동안(카운트다운 · 멈춤 · 끝)만 스스로 그린다 ---------- */
  function idle(now) {
    if (dead) return;
    raf = requestAnimationFrame(idle);
    if (now - drawnAt > 40) render(now);
  }
  function destroy() { if (dead) return; dead = true; cancelAnimationFrame(raf); removeEventListener('resize', onResize); pets.clear(); imgs.clear(); }
  const onResize = () => resize();
  addEventListener('resize', onResize);
  resize();
  host.onTier?.(tier);
  window.__arenaStage = stats; stats.count = api.count;
  raf = requestAnimationFrame(idle);
  return api;
}
