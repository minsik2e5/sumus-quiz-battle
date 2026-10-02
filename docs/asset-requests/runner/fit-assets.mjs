// 2×2 시트 한 장(로보 · 가위바위보 · UI 아이콘 · 트로피)을 4칸으로 나눠 public/assets/ 아래에 넣어요.
//   node docs/asset-requests/runner/fit-assets.mjs <sheet.png> <왼쪽위> <오른쪽위> <왼쪽아래> <오른쪽아래> [--base pets/robot-3] [--size 256] [--preview out.png]
//   예) node docs/asset-requests/runner/fit-assets.mjs out/043.png ui/care-feed ui/care-pet ui/care-warm ui/notice
//       node docs/asset-requests/runner/fit-assets.mjs out/001.png rps/robot-rock rps/robot-scissors rps/robot-paper rps/robot-ready --base pets/robot-3
// - 칸 이름은 public/assets/ 아래 경로(확장자 없이). "-"인 칸은 버려요.
// - 펫 표정용 fit-sheets.mjs처럼, 붙어 있는 그림 덩어리의 중심이 어느 칸에 있는지로 나눠요.
// - --base가 있으면 그 그림(public/assets/<base>.webp)과 키·가운데·발 위치를 맞춰요(같은 시트는 같은 배율).
//   없으면 정사각형(--size, 기본 256px) 가운데에 여백을 두고 넣어요.
import sharp from 'sharp';
import { fileURLToPath } from 'node:url';

const ASSETS = fileURLToPath(new URL('../../../public/assets/', import.meta.url));
const args = process.argv.slice(2);
const opt = name => { const i = args.indexOf(name); return i >= 0 ? args.splice(i, 2)[1] : null; };
const preview = opt('--preview'), baseName = opt('--base'), size = Number(opt('--size') || 256);
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

// 붙어 있는 그림 덩어리 찾기
const label = new Int32Array(N).fill(-1), comps = [], stack = new Int32Array(N);
for (let i = 0; i < N; i++) {
  if (label[i] !== -1 || data[i * 4 + 3] <= 8) continue;
  const id = comps.length; let sp = 0, n = 0, sx = 0, sy = 0;
  stack[sp++] = i; label[i] = id;
  while (sp) {
    const p = stack[--sp], x = p % W, y = (p / W) | 0; n++; sx += x; sy += y;
    if (x > 0 && label[p - 1] === -1 && data[(p - 1) * 4 + 3] > 8) { label[p - 1] = id; stack[sp++] = p - 1; }
    if (x < W - 1 && label[p + 1] === -1 && data[(p + 1) * 4 + 3] > 8) { label[p + 1] = id; stack[sp++] = p + 1; }
    if (y > 0 && label[p - W] === -1 && data[(p - W) * 4 + 3] > 8) { label[p - W] = id; stack[sp++] = p - W; }
    if (y < H - 1 && label[p + W] === -1 && data[(p + W) * 4 + 3] > 8) { label[p + W] = id; stack[sp++] = p + W; }
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
  for (let i = 0; i < N; i++) if (label[i] >= 0 && quad[label[i]] === q) data.copy(buf, i * 4, i * 4, i * 4 + 4);
  const b = bboxOf(buf, W, H);
  if (!b) { console.error(`${names[q]}: 칸이 비어 있어요.`); process.exit(3); }
  cells.push({ buf, b, name: names[q] });
}

// 같은 시트 = 같은 배율. --base면 그 그림의 키에, 아니면 가장 큰 칸이 정사각형의 88%를 채우게.
let k;
if (base) {
  const ratio = cells.map(c => base.h / c.b.h).sort((a, b) => a - b)[Math.floor((cells.length - 1) / 2)];
  k = ratio;
  for (const c of cells) k = Math.min(k, (base.W - 12) / c.b.w, (base.y1 + 1 - 6) / c.b.h);
} else {
  k = Math.min(...cells.map(c => size * .88 / Math.max(c.b.w, c.b.h)));
}

const tiles = [];
for (const c of cells) {
  const crop = await sharp(c.buf, { raw: { width: W, height: H, channels: 4 } }).extract({ left: c.b.x0, top: c.b.y0, width: c.b.w, height: c.b.h }).png().toBuffer();
  const w = Math.round(c.b.w * k), h = Math.round(c.b.h * k);
  const img = await sharp(crop).resize(w, h).toBuffer();
  const CW = base ? base.W : size, CH = base ? base.H : size;
  const left = base ? Math.max(6, Math.min(CW - w - 6, Math.round((base.x0 + base.x1) / 2 - w / 2))) : Math.round((CW - w) / 2);
  const top = base ? Math.max(0, base.y1 + 1 - h) : Math.round((CH - h) / 2);
  const out = await sharp({ create: { width: CW, height: CH, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: img, left, top }]).webp({ quality: 82, alphaQuality: 90, effort: 6 }).toBuffer();
  await sharp(out).toFile(`${ASSETS}${c.name}.webp`);
  tiles.push({ name: c.name, out });
  console.log(`saved public/assets/${c.name}.webp`);
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
