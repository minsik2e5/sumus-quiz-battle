// 2×2 시트 한 장(로보 · 가위바위보 · UI 아이콘 · 트로피)을 4칸으로 나눠 public/assets/ 아래에 넣어요.
//   node docs/asset-requests/runner/fit-assets.mjs <sheet.png> <왼쪽위> <오른쪽위> <왼쪽아래> <오른쪽아래> [--base pets/robot-3] [--size 256] [--trim] [--stand | --stand-same] [--preview out.png]
//   예) node docs/asset-requests/runner/fit-assets.mjs out/043.png ui/care-feed ui/care-pet ui/care-warm ui/notice
//       node docs/asset-requests/runner/fit-assets.mjs out/001.png rps/robot-rock rps/robot-scissors rps/robot-paper rps/robot-ready --base pets/robot-3
// - 칸 이름은 public/assets/ 아래 경로(확장자 없이). "-"인 칸은 버려요.
// - 펫 표정용 fit-sheets.mjs처럼, 붙어 있는 그림 덩어리의 중심이 어느 칸에 있는지로 나눠요.
// - --base가 있으면 그 그림(public/assets/<base>.webp)과 키·가운데·발 위치를 맞춰요(같은 시트는 같은 배율).
//   없으면 정사각형(--size, 기본 256px) 가운데에 여백을 두고 넣어요.
// - --stand면 펫 그림처럼 칸마다 따로 512px 캔버스 바닥(발 491px)에 세워요(키 20~491px, 양옆 12px). 새 펫의 기본 그림용.
// - --stand-same은 --stand와 같지만 시트 4칸을 같은 배율로 세워요(가장 큰 칸이 488 × 471px에 맞게).
//   포즈를 바꿔 끼워도 크기가 튀지 않아야 하는 그림용. 예) 몬스터 기본 · 공격 · 맞음 · 쓰러짐(10-monsters)
//       node docs/asset-requests/runner/fit-assets.mjs 10-1.png monsters/slime monsters/slime-attack monsters/slime-hurt monsters/slime-down --stand-same
//   포즈가 두 시트에 나뉜 몬스터(22-던전)는 --scale-max로 두 시트를 같은 배율에 맞춰요: 각 시트를 한 번 자르면 "scale 0.xxxx"가 출력돼요.
//   두 값 중 작은 값을 큰 쪽 시트에 --scale-max 0.xxxx로 줘서 그 시트를 다시 잘라요.
// - --trim이면 정사각형에 넣지 않고 그림 테두리에 딱 맞게 잘라요(같은 시트는 같은 배율, 가장 넓은 칸이 --size px).
//   예) 캡슐 위·아래 반쪽처럼 앱에서 위아래로 맞붙여 쓰는 그림.
// - --fit-each면 칸마다 따로 같은 크기(가장 긴 쪽이 --size의 88%)로 맞춰 정사각형 가운데에 넣어요.
//   칭호 메달처럼 시트마다 크기가 달라 보이면 안 되는 그림용. 예) 칭호 메달(11-titles)
// - --union이면 시트 4칸을 같은 창(4칸을 합친 가장 큰 범위)으로 잘라요. 가운데 높이와 팔 쪽 끝이 4장 모두 같아서
//   포즈를 바꿔 끼워도 몸이 안 움직여요. 가로가 --size보다 길면 줄여요. 예) 가위바위보 팔(05-rps-arms)
// - --small 96이면 작은 그림(<이름>-s.webp, 96px)도 같이 만들어요. 작게 여러 개 보이는 그림용.
//   예) 칭호 메달(11-titles): node docs/asset-requests/runner/fit-assets.mjs 11-1.png titles/rookie titles/focus titles/words100 titles/streak3 --small 96
import sharp from 'sharp';
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const ASSETS = fileURLToPath(new URL('../../../public/assets/', import.meta.url));
const args = process.argv.slice(2);
const opt = name => { const i = args.indexOf(name); return i >= 0 ? args.splice(i, 2)[1] : null; };
const ti = args.indexOf('--trim'), trim = ti >= 0 && !!args.splice(ti, 1);
const fei = args.indexOf('--fit-each'), fitEach = fei >= 0 && !!args.splice(fei, 1);
const uni = args.indexOf('--union'), union = uni >= 0 && !!args.splice(uni, 1);
const ssi = args.indexOf('--stand-same'), standSame = ssi >= 0 && !!args.splice(ssi, 1);
const si = args.indexOf('--stand'), stand = standSame || (si >= 0 && !!args.splice(si, 1));
const preview = opt('--preview'), baseName = opt('--base'), size = Number(opt('--size') || 256), small = Number(opt('--small') || 0), scaleMax = Number(opt('--scale-max') || 0);
const [sheet, ...names] = args;
if (!sheet || names.length !== 4) {
  console.error('사용법: node fit-assets.mjs <sheet.png> <TL> <TR> <BL> <BR> [--base pets/robot-3] [--size 256] [--preview out.png]');
  process.exit(1);
}

const bboxOf = (data, W, H) => {
  let x0 = W, y0 = H, x1 = -1, y1 = -1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (data[(y * W + x) * 4 + 3] > 24) {
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  return x1 < 0 ? null : { x0, y0, x1, y1, w: x1 - x0 + 1, h: y1 - y0 + 1 };
};

const { data, info } = await sharp(sheet).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const W = info.width, H = info.height, N = W * H;
let corner = 0;
for (const [x, y] of [[2, 2], [W - 3, 2], [2, H - 3], [W - 3, H - 3]]) corner = Math.max(corner, data[(y * W + x) * 4 + 3]);
if (corner > 10) { console.error(`배경이 투명하지 않아요(모서리 alpha ${corner}). 다시 만들어 주세요.`); process.exit(2); }

// 붙어 있는 그림 덩어리 찾기. 희미한 빛(alpha 24 이하)은 덩어리를 잇지 않아요: 옆 칸 그림의 빛이 닿아도 한 덩어리가 되지 않게요.
// 희미한 픽셀은 덩어리 대신 자기 자리가 있는 칸으로 가요.
const SOLID = 24;
const label = new Int32Array(N).fill(-1), comps = [], stack = new Int32Array(N);
for (let i = 0; i < N; i++) {
  if (label[i] !== -1 || data[i * 4 + 3] <= SOLID) continue;
  const id = comps.length; let sp = 0, n = 0, sx = 0, sy = 0;
  stack[sp++] = i; label[i] = id;
  while (sp) {
    const p = stack[--sp], x = p % W, y = (p / W) | 0; n++; sx += x; sy += y;
    if (x > 0 && label[p - 1] === -1 && data[(p - 1) * 4 + 3] > SOLID) { label[p - 1] = id; stack[sp++] = p - 1; }
    if (x < W - 1 && label[p + 1] === -1 && data[(p + 1) * 4 + 3] > SOLID) { label[p + 1] = id; stack[sp++] = p + 1; }
    if (y > 0 && label[p - W] === -1 && data[(p - W) * 4 + 3] > SOLID) { label[p - W] = id; stack[sp++] = p - W; }
    if (y < H - 1 && label[p + W] === -1 && data[(p + W) * 4 + 3] > SOLID) { label[p + W] = id; stack[sp++] = p + W; }
  }
  comps.push({ n, cx: sx / n, cy: sy / n });
}
const quad = comps.map(c => (c.cy >= H / 2 ? 2 : 0) + (c.cx >= W / 2 ? 1 : 0));

let base = null;
if (baseName) {
  const b = await sharp(`${ASSETS}${baseName}.webp`).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  base = { ...bboxOf(b.data, b.info.width, b.info.height), W: b.info.width, H: b.info.height };
}

const cells = [];
for (let q = 0; q < 4; q++) {
  if (names[q] === '-') continue;
  const buf = Buffer.alloc(N * 4);
  for (let i = 0; i < N; i++) {
    const own = label[i] >= 0 ? quad[label[i]] : data[i * 4 + 3] > 8 ? (((i / W) | 0) >= H / 2 ? 2 : 0) + (i % W >= W / 2 ? 1 : 0) : -1;
    if (own === q) data.copy(buf, i * 4, i * 4, i * 4 + 4);
  }
  const b = bboxOf(buf, W, H);
  if (!b) { console.error(`${names[q]}: 칸이 비어 있어요.`); process.exit(3); }
  cells.push({ buf, b, name: names[q], q });
}

// 같은 시트 = 같은 배율. --base면 그 그림의 키에, 아니면 가장 큰 칸이 정사각형의 88%를 채우게.
let k;
if (base) {
  const ratio = cells.map(c => base.h / c.b.h).sort((a, b) => a - b)[Math.floor((cells.length - 1) / 2)];
  k = ratio;
  for (const c of cells) k = Math.min(k, (base.W - 12) / c.b.w, (base.y1 + 1 - 6) / c.b.h);
} else if (trim) {
  k = Math.min(...cells.map(c => size / Math.max(c.b.w, c.b.h)));
} else {
  k = Math.min(...cells.map(c => size * .88 / Math.max(c.b.w, c.b.h)));
}

// --union: one window for the four cells, in cell-local coordinates. Its middle line is the median
// of the cells' own middles (the arm), so a flag or sparkles above do not push the arm down.
let win = null;
if (union) {
  const hw = W / 2, hh = H / 2, loc = cells.map(c => ({ x0: c.b.x0 - (c.q % 2) * hw, x1: c.b.x1 - (c.q % 2) * hw, y0: c.b.y0 - (c.q >> 1) * hh, y1: c.b.y1 - (c.q >> 1) * hh }));
  const mids = loc.map(l => (l.y0 + l.y1) / 2).sort((a, b) => a - b), axis = (mids[1] + mids[2]) / 2;
  const half = Math.ceil(Math.max(...loc.map(l => Math.max(axis - l.y0, l.y1 - axis))));
  const x0 = Math.min(...loc.map(l => l.x0)), x1 = Math.max(...loc.map(l => l.x1));
  win = { x0, w: x1 - x0 + 1, y0: Math.max(0, Math.round(axis) - half), h: Math.min(hh, 2 * half + 1) };
  win.h = Math.min(win.h, hh - win.y0);
  win.k = Math.min(1, size / win.w);
}
const tiles = [];
// --stand-same: one scale for the sheet, so the largest cell fits 488 × 471 px.
const kSame = Math.min(scaleMax || Infinity, ...cells.map(c => Math.min(488 / c.b.w, 471 / c.b.h)));
if (standSame) console.log(`scale ${kSame.toFixed(4)}`);
for (const c of cells) {
  mkdirSync(dirname(`${ASSETS}${c.name}.webp`), { recursive: true });
  if (stand) {
    // Each picture on its own: as big as fits 488 × 471 px, centred, feet on y = 491.
    const ks = standSame ? kSame : Math.min(488 / c.b.w, 471 / c.b.h), w = Math.round(c.b.w * ks), h = Math.round(c.b.h * ks);
    const crop = await sharp(c.buf, { raw: { width: W, height: H, channels: 4 } }).extract({ left: c.b.x0, top: c.b.y0, width: c.b.w, height: c.b.h }).png().toBuffer();
    const img = await sharp(crop).resize(w, h).toBuffer();
    const out = await sharp({ create: { width: 512, height: 512, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
      .composite([{ input: img, left: Math.round((512 - w) / 2), top: 492 - h }]).webp({ quality: 82, alphaQuality: 90, effort: 6 }).toBuffer();
    await sharp(out).toFile(`${ASSETS}${c.name}.webp`);
    tiles.push({ name: c.name, out });
    console.log(`saved public/assets/${c.name}.webp`);
    continue;
  }
  if (union) {
    const left = (c.q % 2) * (W / 2) + win.x0, top = (c.q >> 1) * (H / 2) + win.y0;
    const out = await sharp(c.buf, { raw: { width: W, height: H, channels: 4 } }).extract({ left, top, width: win.w, height: win.h })
      .resize(Math.round(win.w * win.k), Math.round(win.h * win.k)).webp({ quality: 82, alphaQuality: 90, effort: 6 }).toBuffer();
    await sharp(out).toFile(`${ASSETS}${c.name}.webp`);
    tiles.push({ name: c.name, out });
    console.log(`saved public/assets/${c.name}.webp (${Math.round(win.w * win.k)} × ${Math.round(win.h * win.k)})`);
    continue;
  }
  const crop = await sharp(c.buf, { raw: { width: W, height: H, channels: 4 } }).extract({ left: c.b.x0, top: c.b.y0, width: c.b.w, height: c.b.h }).png().toBuffer();
  const kc = fitEach ? size * .88 / Math.max(c.b.w, c.b.h) : k;
  const w = Math.round(c.b.w * kc), h = Math.round(c.b.h * kc);
  const img = await sharp(crop).resize(w, h).toBuffer();
  const CW = base ? base.W : trim ? w : size, CH = base ? base.H : trim ? h : size;
  const left = base ? Math.max(6, Math.min(CW - w - 6, Math.round((base.x0 + base.x1) / 2 - w / 2))) : Math.round((CW - w) / 2);
  const top = base ? Math.max(0, base.y1 + 1 - h) : Math.round((CH - h) / 2);
  const out = await sharp({ create: { width: CW, height: CH, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: img, left, top }]).webp({ quality: 82, alphaQuality: 90, effort: 6 }).toBuffer();
  await sharp(out).toFile(`${ASSETS}${c.name}.webp`);
  tiles.push({ name: c.name, out });
  console.log(`saved public/assets/${c.name}.webp`);
}
// --small: the same picture again at small × small px (<name>-s.webp).
if (small) for (const t of tiles) {
  await sharp(t.out).resize(small, small, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).webp({ quality: 84, alphaQuality: 90, effort: 6 }).toFile(`${ASSETS}${t.name}-s.webp`);
  console.log(`saved public/assets/${t.name}-s.webp`);
}

// 확인용: (--base면 맨 왼쪽에 기준 그림) 새 그림들 (어두운 배경)
if (preview) {
  const T = 256, bg = { r: 40, g: 42, b: 60, alpha: 1 };
  const list = [...(baseName ? [`${ASSETS}${baseName}.webp`] : []), ...tiles.map(t => t.out)];
  const imgs = await Promise.all(list.map(x => sharp(x).resize(T, T).toBuffer()));
  await sharp({ create: { width: T * imgs.length, height: T, channels: 4, background: bg } })
    .composite(imgs.map((input, i) => ({ input, left: i * T, top: 0 }))).png().toFile(preview);
  console.log(`preview ${preview}`);
}
