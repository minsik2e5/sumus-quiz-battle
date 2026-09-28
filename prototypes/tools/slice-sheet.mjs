// Slices an evolution sheet (transparent background) into separate sprites.
// Usage: node slice-sheet.mjs <sheet> <outDir> <name1,name2,...> [layout=3x2] [size=512]
//
// Figures are found as connected shapes (not by straight cuts), so tails, glows and
// sparkles that overlap a neighbour's row or column still land on the right sprite.
// Each sprite is fitted to its own square canvas and sits bottom-centred so feet line
// up; stage size differences are applied later, gently, by the renderer.
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const [sheet, outDir, namesArg, layoutArg = '3x2', sizeArg] = process.argv.slice(2);
const names = namesArg.split(',');
const [COLS, ROWS] = layoutArg.split('x').map(Number);
const SIZE = Number(sizeArg) || 512;
const CORE_ALPHA = Number(process.env.SLICE_ALPHA) || 140; // solid body pixels
const STEP = 2;          // analysis grid (full-res pixels per cell)
const REACH = 14;        // cells a faint glow/sparkle may sit away from its figure

const { data, info } = await sharp(sheet).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const { width: W, height: H } = info;
const GW = Math.ceil(W / STEP), GH = Math.ceil(H / STEP);

// 1. Solid mask on the coarse grid and its connected components.
const solid = new Uint8Array(GW * GH), any = new Uint8Array(GW * GH);
for (let gy = 0; gy < GH; gy++) for (let gx = 0; gx < GW; gx++) {
  let m = 0;
  for (let dy = 0; dy < STEP; dy++) for (let dx = 0; dx < STEP; dx++) {
    const x = gx * STEP + dx, y = gy * STEP + dy;
    if (x < W && y < H) m = Math.max(m, data[(y * W + x) * 4 + 3]);
  }
  if (m >= CORE_ALPHA) solid[gy * GW + gx] = 1;
  if (m > 8) any[gy * GW + gx] = 1;
}
const label = new Int32Array(GW * GH).fill(-1);
const comps = [];
const queue = new Int32Array(GW * GH);
for (let i = 0; i < GW * GH; i++) {
  if (!solid[i] || label[i] >= 0) continue;
  const id = comps.length, c = { id, area: 0, x0: 1e9, y0: 1e9, x1: -1, y1: -1 };
  let head = 0, tail = 0; queue[tail++] = i; label[i] = id;
  while (head < tail) {
    const p = queue[head++], px = p % GW, py = (p / GW) | 0;
    c.area++; c.x0 = Math.min(c.x0, px); c.x1 = Math.max(c.x1, px); c.y0 = Math.min(c.y0, py); c.y1 = Math.max(c.y1, py);
    for (const [nx, ny] of [[px + 1, py], [px - 1, py], [px, py + 1], [px, py - 1]]) {
      if (nx < 0 || ny < 0 || nx >= GW || ny >= GH) continue;
      const n = ny * GW + nx;
      if (solid[n] && label[n] < 0) { label[n] = id; queue[tail++] = n; }
    }
  }
  comps.push(c);
}

// 2. Merge small pieces (sparkles, stray fur) into the nearest big one until N remain.
const parent = comps.map(c => c.id);
const root = i => (parent[i] === i ? i : (parent[i] = root(parent[i])));
const boxDist = (a, b) => Math.hypot(Math.max(0, a.x0 - b.x1, b.x0 - a.x1), Math.max(0, a.y0 - b.y1, b.y0 - a.y1));
let groups = comps.map(c => ({ ...c, members: [c.id] }));
while (groups.length > names.length) {
  groups.sort((a, b) => a.area - b.area);
  const small = groups.shift();
  let best = groups[0];
  for (const g of groups) if (boxDist(small, g) < boxDist(small, best)) best = g;
  best.members.push(...small.members); best.area += small.area;
  best.x0 = Math.min(best.x0, small.x0); best.x1 = Math.max(best.x1, small.x1);
  best.y0 = Math.min(best.y0, small.y0); best.y1 = Math.max(best.y1, small.y1);
  for (const m of small.members) parent[m] = best.members[0];
}
if (groups.length !== names.length) throw new Error(`found ${groups.length} figures, expected ${names.length}`);
const figOf = new Int32Array(comps.length);
groups.forEach((g, gi) => g.members.forEach(m => { figOf[m] = gi; }));

// 3. Give faint pixels (glow, soft fur edges) to the nearest figure within REACH cells.
const owner = new Int32Array(GW * GH).fill(-1), dist = new Int32Array(GW * GH).fill(1e9);
let head = 0, tail = 0;
for (let i = 0; i < GW * GH; i++) if (label[i] >= 0) { owner[i] = figOf[label[i]]; dist[i] = 0; queue[tail++] = i; }
while (head < tail) {
  const p = queue[head++], px = p % GW, py = (p / GW) | 0;
  if (dist[p] >= REACH) continue;
  for (const [nx, ny] of [[px + 1, py], [px - 1, py], [px, py + 1], [px, py - 1]]) {
    if (nx < 0 || ny < 0 || nx >= GW || ny >= GH) continue;
    const n = ny * GW + nx;
    if (any[n] && owner[n] < 0) { owner[n] = owner[p]; dist[n] = dist[p] + 1; queue[tail++] = n; }
  }
}

// 4. Order figures in reading order: split into rows by vertical centre, then left to right.
const figs = groups.map((g, gi) => ({ gi, cx: (g.x0 + g.x1) / 2, cy: (g.y0 + g.y1) / 2 }));
figs.sort((a, b) => a.cy - b.cy);
const ordered = [];
for (let r = 0; r < ROWS; r++) ordered.push(...figs.slice(r * COLS, (r + 1) * COLS).sort((a, b) => a.cx - b.cx));

// 5. Cut each figure out with only its own pixels, fit, and place bottom-centred.
const PAD = Math.round(SIZE * 0.04);
mkdirSync(outDir, { recursive: true });
for (const [i, { gi }] of ordered.entries()) {
  let x0 = W, y0 = H, x1 = -1, y1 = -1;
  for (let gy = 0; gy < GH; gy++) for (let gx = 0; gx < GW; gx++) if (owner[gy * GW + gx] === gi) {
    x0 = Math.min(x0, gx * STEP); y0 = Math.min(y0, gy * STEP);
    x1 = Math.max(x1, Math.min(W - 1, gx * STEP + STEP - 1)); y1 = Math.max(y1, Math.min(H - 1, gy * STEP + STEP - 1));
  }
  const bw = x1 - x0 + 1, bh = y1 - y0 + 1, buf = Buffer.alloc(bw * bh * 4);
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    if (owner[((y / STEP) | 0) * GW + ((x / STEP) | 0)] !== gi) continue;
    data.copy(buf, ((y - y0) * bw + (x - x0)) * 4, (y * W + x) * 4, (y * W + x) * 4 + 4);
  }
  const scale = (SIZE - PAD * 2) / Math.max(bw, bh);
  const w = Math.max(1, Math.round(bw * scale)), h = Math.max(1, Math.round(bh * scale));
  const sprite = await sharp(buf, { raw: { width: bw, height: bh, channels: 4 } }).resize(w, h).png().toBuffer();
  const out = join(outDir, `${names[i]}.webp`);
  await sharp({ create: { width: SIZE, height: SIZE, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: sprite, left: Math.round((SIZE - w) / 2), top: SIZE - PAD - h }])
    .webp({ quality: 88, alphaQuality: 90, effort: 5 })
    .toFile(out);
  console.log(names[i].padEnd(14), `src ${bw}x${bh} @(${x0},${y0}) -> ${w}x${h}`, out);
}
