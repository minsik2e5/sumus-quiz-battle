// 2×2 표정 시트 한 장을 4칸으로 나눠 앱의 펫 그림 자리에 맞춰 넣어요.
//   npm i --no-save sharp   (처음 한 번)
//   node docs/asset-requests/runner/fit-sheets.mjs <sheet.png> <왼쪽위> <오른쪽위> <왼쪽아래> <오른쪽아래> [--preview out.png]
//   예) node docs/asset-requests/runner/fit-sheets.mjs out/cat-2.png cat-2-happy cat-2-eat cat-2-sad cat-2-cheer
//       node docs/asset-requests/runner/fit-sheets.mjs out/pig-sad.png pig-1-sad pig-2-sad pig-3-sad -
// - 칸 이름은 <펫>-<단계>-<표정>. "-"인 칸은 버려요.
// - 줄을 그어 자르지 않고, 붙어 있는 그림 덩어리의 중심이 어느 칸에 있는지로 나눠요
//   (날개·꼬리가 칸 경계를 넘어도 잘리지 않아요).
// - 같은 시트의 칸은 같은 배율로 줄이고, 지금 앱의 펫 그림(public/assets/pets/<펫>-<단계>.webp)과
//   키·가운데·발 위치를 맞춰 public/assets/pets/<이름>.webp로 저장해요(512px, 투명, webp).
import sharp from 'sharp';
import { fileURLToPath } from 'node:url';

const PETS = fileURLToPath(new URL('../../../public/assets/pets/', import.meta.url));
const args = process.argv.slice(2);
const pi = args.indexOf('--preview');
const preview = pi >= 0 ? args.splice(pi, 2)[1] : null;
const [sheet, ...names] = args;
if (!sheet || names.length !== 4) {
  console.error('사용법: node fit-sheets.mjs <sheet.png> <TL> <TR> <BL> <BR> [--preview out.png]');
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

const cells = [];
for (let q = 0; q < 4; q++) {
  if (names[q] === '-') { cells.push(null); continue; }
  const buf = Buffer.alloc(N * 4);
  for (let i = 0; i < N; i++) if (label[i] >= 0 && quad[label[i]] === q) data.copy(buf, i * 4, i * 4, i * 4 + 4);
  const b = bboxOf(buf, W, H);
  if (!b) { console.error(`${names[q]}: 칸이 비어 있어요.`); process.exit(3); }
  const m = /^([a-z]+)-(\d)-([a-z]+)$/.exec(names[q]);
  if (!m) { console.error(`이름 형식이 <펫>-<단계>-<표정>이 아니에요: ${names[q]}`); process.exit(1); }
  const base = await sharp(`${PETS}${m[1]}-${m[2]}.webp`).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  cells.push({ buf, b, name: names[q], base: { ...bboxOf(base.data, base.info.width, base.info.height), W: base.info.width, H: base.info.height } });
}

// 같은 시트 = 같은 배율. 지금 그림의 키에 맞추되, 하트·반짝이까지 캔버스 안에 들어가게.
const used = cells.filter(Boolean);
const ratio = used.map(c => c.base.h / c.b.h).sort((a, b) => a - b)[Math.floor((used.length - 1) / 2)];
let k = ratio;
for (const c of used) k = Math.min(k, (c.base.W - 12) / c.b.w, (c.base.y1 + 1 - 6) / c.b.h);

const tiles = [];
for (const c of used) {
  const crop = await sharp(c.buf, { raw: { width: W, height: H, channels: 4 } }).extract({ left: c.b.x0, top: c.b.y0, width: c.b.w, height: c.b.h }).png().toBuffer();
  const w = Math.round(c.b.w * k), h = Math.round(c.b.h * k);
  const img = await sharp(crop).resize(w, h).toBuffer();
  const cx = (c.base.x0 + c.base.x1) / 2;
  const left = Math.max(6, Math.min(c.base.W - w - 6, Math.round(cx - w / 2))), top = Math.max(0, c.base.y1 + 1 - h);
  const out = await sharp({ create: { width: c.base.W, height: c.base.H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: img, left, top }]).webp({ quality: 82, alphaQuality: 90, effort: 6 }).toBuffer();
  await sharp(out).toFile(`${PETS}${c.name}.webp`);
  tiles.push({ name: c.name, out, base: `${PETS}${c.name.replace(/-[a-z]+$/, '')}.webp` });
  console.log(`saved public/assets/pets/${c.name}.webp`);
}

// 확인용: 왼쪽 지금 그림, 오른쪽 새 표정들 (어두운 배경)
if (preview) {
  const T = 256, bg = { r: 40, g: 42, b: 60, alpha: 1 };
  const imgs = [await sharp(tiles[0].base).resize(T, T).toBuffer(), ...await Promise.all(tiles.map(t => sharp(t.out).resize(T, T).toBuffer()))];
  await sharp({ create: { width: T * imgs.length, height: T, channels: 4, background: bg } })
    .composite(imgs.map((input, i) => ({ input, left: i * T, top: 0 }))).png().toFile(preview);
  console.log(`preview ${preview}`);
}
