// Turns a sheet drawn on a white background into a transparent PNG.
// Usage: node remove-white-bg.mjs <in> <out.png>
//
// Only the white area connected to the image border is removed (flood fill through light
// pixels), so white fur enclosed by the character's outline stays opaque. Inside that area
// white is converted to alpha, which keeps soft glows and shadows as translucent colour.
import sharp from 'sharp';

const [input, output] = process.argv.slice(2);
const LIGHT = 222;   // min(r,g,b) at or above this counts as "background-ish" for the flood
const EDGE = 188;    // anti-aliased rim pixels next to the background, softened too

const { data, info } = await sharp(input).removeAlpha().raw().toBuffer({ resolveWithObject: true });
const { width: W, height: H } = info;
const N = W * H;
const minC = new Uint8Array(N);
for (let i = 0; i < N; i++) minC[i] = Math.min(data[i * 3], data[i * 3 + 1], data[i * 3 + 2]);

// Flood fill from every border pixel through light pixels.
const bg = new Uint8Array(N), queue = new Int32Array(N);
let head = 0, tail = 0;
const seed = i => { if (!bg[i] && minC[i] >= LIGHT) { bg[i] = 1; queue[tail++] = i; } };
for (let x = 0; x < W; x++) { seed(x); seed((H - 1) * W + x); }
for (let y = 0; y < H; y++) { seed(y * W); seed(y * W + W - 1); }
while (head < tail) {
  const p = queue[head++], x = p % W, y = (p / W) | 0;
  if (x > 0) seed(p - 1); if (x < W - 1) seed(p + 1);
  if (y > 0) seed(p - W); if (y < H - 1) seed(p + W);
}
// One-pixel rim: light-ish pixels touching the background are blended edges.
const rim = new Uint8Array(N);
for (let p = 0; p < N; p++) {
  if (bg[p] || minC[p] < EDGE) continue;
  const x = p % W, y = (p / W) | 0;
  if ((x > 0 && bg[p - 1]) || (x < W - 1 && bg[p + 1]) || (y > 0 && bg[p - W]) || (y < H - 1 && bg[p + W])) rim[p] = 1;
}

const out = Buffer.alloc(N * 4);
for (let p = 0; p < N; p++) {
  let r = data[p * 3], g = data[p * 3 + 1], b = data[p * 3 + 2], a = 255;
  if (bg[p] || rim[p]) {
    // Colour-to-alpha against white: the most "non-white" channel sets the opacity.
    const k = Math.max(255 - r, 255 - g, 255 - b) / 255;
    const alpha = bg[p] ? Math.min(1, k * 2.2) : Math.min(1, k * 3);
    if (alpha < 0.03) { r = g = b = 0; a = 0; }
    else {
      const un = c => Math.max(0, Math.min(255, Math.round(255 - (255 - c) / alpha)));
      r = un(r); g = un(g); b = un(b); a = Math.round(alpha * 255);
    }
  }
  out[p * 4] = r; out[p * 4 + 1] = g; out[p * 4 + 2] = b; out[p * 4 + 3] = a;
}
await sharp(out, { raw: { width: W, height: H, channels: 4 } }).png().toFile(output);
console.log('transparent sheet', output);
