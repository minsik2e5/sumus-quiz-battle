// 격자 시트(투명 배경)를 칸마다 잘라 public/assets/ 아래에 넣는다. 70-2(UI 아이콘 4×4)처럼 2×2가 아닌 시트용.
//   node docs/asset-requests/runner/slice-grid.mjs /tmp/art/70-2.png --grid 4 --size 128 arena/ui2-ico-attack arena/ui2-ico-ult … (칸 순서: 왼쪽 위부터 줄마다)
//   칸 이름을 주지 않으면 build-70.mjs의 70-2 칸 이름을 쓴다.
// 칸마다: 가운데 88%를 잘라 투명한 테두리를 걷어 내고(trim), 가장 긴 쪽이 --size의 88%가 되게 정사각형 가운데에 넣는다(fit-assets --fit-each와 같은 모양).
// 확인: 칸 가장자리(2px)에 불투명한 점이 있으면 ⚠️(이웃 칸이 묻었거나 그림이 칸을 넘음 → 다시 그린다).
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SHEETS } from './build-70.mjs';

const ASSETS = fileURLToPath(new URL('../../../public/assets/', import.meta.url));
const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args.splice(i, 2)[1] : d; };
const grid = Number(opt('--grid', 4)), size = Number(opt('--size', 128));
const [file, ...given] = args;
const names = given.length ? given : SHEETS.find(s => s.no === '70-2').cells.map(c => 'arena/' + c[1]);
if (!file || names.length !== grid * grid) { console.error(`사용법: node slice-grid.mjs <시트.png> --grid ${grid} --size 128 [칸 이름 ${grid * grid}개]`); process.exit(1); }
const W = 1024, cell = W / grid, inset = Math.round(cell * .06);
const full = await sharp(file).ensureAlpha().resize(W, W, { fit: 'fill' }).png().toBuffer();
let bad = 0;
for (let i = 0; i < names.length; i++) {
  const name = names[i]; if (name === '-') continue;
  const left = (i % grid) * cell + inset, top = Math.floor(i / grid) * cell + inset, w = cell - inset * 2;
  const crop = sharp(full).extract({ left, top, width: w, height: w });
  const { data, info } = await crop.clone().raw().toBuffer({ resolveWithObject: true });
  let edge = 0; for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) if ((x < 2 || y < 2 || x >= info.width - 2 || y >= info.height - 2) && data[(y * info.width + x) * 4 + 3] > 40) edge++;
  const fit = Math.round(size * .88);
  const icon = await sharp(await crop.png().toBuffer()).trim({ threshold: 1 }).resize(fit, fit, { fit: 'inside' }).toBuffer();
  const out = `${ASSETS}${name}.webp`; mkdirSync(dirname(out), { recursive: true });
  const meta = await sharp(icon).metadata();
  const info2 = await sharp({ create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).composite([{ input: icon, left: Math.round((size - meta.width) / 2), top: Math.round((size - meta.height) / 2) }]).webp({ quality: 86, alphaQuality: 90 }).toFile(out);
  if (edge > 6) bad++;
  console.log(`[grid] ${i + 1} → ${name}.webp ${size}×${size} ${Math.round(info2.size / 102.4) / 10}KB${edge > 6 ? ` ⚠️ 칸 가장자리에 그림 ${edge}점 — 칸을 넘었어요` : ''}`);
}
if (bad) process.exitCode = 2;
