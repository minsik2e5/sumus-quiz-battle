// 그림 71(효과 재료) 자르기: 2×2 시트 한 장을 칸 4개로 잘라 public/assets/arena/mat-<이름>.webp로 넣는다.
//   node docs/asset-requests/runner/slice-71.mjs /tmp/art/71-1.png        (시트 번호는 파일 이름에서 읽는다)
//   node docs/asset-requests/runner/slice-71.mjs /tmp/art/71-3.png --preview /tmp/art/71-3-check.png
// 칸 · 이름 · 처리 방법(kind) · 크기는 build-71.mjs의 SHEETS를 그대로 쓴다(손으로 적지 않는다).
// fit-assets.mjs는 투명 배경에서 그림 덩어리를 찾는 방식이라 검은 · 흰 배경 시트에는 맞지 않는다 → 칸을 격자로 자른다.
// 처리(자를 때 한 번만, 게임은 픽셀 계산을 하지 않는다):
//   add  — 검은 배경 그대로(투명 없음). 게임이 더하기 섞기로 그린다.
//   luma — 밝기를 투명도로: 흰색(255,255,255) + 알파 = 밝기. 게임이 속성 색을 입힌다.
//   key  — 거의 검정인 배경만 투명으로(가장 밝은 채널이 18 아래 → 투명, 18~48 사이는 부드럽게). 물체 색은 그대로.
//   mul  — 흰 배경 그대로(투명 없음). 게임이 곱하기 섞기로 바닥에 굽는다.
// 모양: 이름이 bolt · streak · speed · crack-line이면 가로 띠(가운데 480×200을 잘라 크기 × 크기/2.4), 나머지는 정사각형(가운데 464×464).
// 용량 목표: 재료 한 장 20KB 이하(넘으면 quality를 낮춘다). 28장 합계 350KB 이하.
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { basename } from 'node:path';
import { SHEETS } from './build-71.mjs';

const ASSETS = fileURLToPath(new URL('../../../public/assets/arena/', import.meta.url));
const args = process.argv.slice(2);
const pi = args.indexOf('--preview'), preview = pi >= 0 ? args.splice(pi, 2)[1] : '';
const qi = args.indexOf('--quality'), quality = qi >= 0 ? Number(args.splice(qi, 2)[1]) : 82;
const file = args[0];
const no = basename(file || '').match(/71-\d/)?.[0];
const sheet = SHEETS.find(s => s.no === no);
if (!sheet) { console.error('사용법: node slice-71.mjs <71-N.png> [--preview out.png] [--quality 82]'); process.exit(1); }
const WIDE = new Set(['bolt', 'streak', 'speed', 'crack-line']);
const CELL_XY = { 'TOP-LEFT': [0, 0], 'TOP-RIGHT': [1, 0], 'BOTTOM-LEFT': [0, 1], 'BOTTOM-RIGHT': [1, 1] };

const src = sharp(file).removeAlpha();
const meta = await src.metadata();
if (meta.width !== meta.height) console.warn(`[71] ${no}: 정사각형이 아니에요(${meta.width}×${meta.height}). 1024×1024로 맞춰 자릅니다.`);
const full = await sharp(file).removeAlpha().resize(1024, 1024, { fit: 'fill' }).raw().toBuffer({ resolveWithObject: true });
mkdirSync(ASSETS, { recursive: true });
const outs = [];
for (const [cell, key, name, kind, size] of sheet.cells) {
  const [cx, cy] = CELL_XY[cell], wide = WIDE.has(key);
  const cw = wide ? 480 : 464, ch = wide ? 200 : 464;
  const left = cx * 512 + (512 - cw) / 2, top = cy * 512 + (512 - ch) / 2;
  const w = size, h = wide ? Math.round(size / 2.4) : size;
  let img = sharp(full.data, { raw: full.info }).extract({ left, top, width: cw, height: ch }).resize(w, h);
  // 칸 가장자리에 이웃 칸이 묻어 왔는지: 테두리 4px의 평균 밝기(검은 배경은 0 근처, 흰 배경은 255 근처여야 한다)
  const { data } = await img.clone().raw().toBuffer({ resolveWithObject: true });
  let edge = 0, n = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (x < 4 || y < 4 || x >= w - 4 || y >= h - 4) { const i = (y * w + x) * 3; edge += (data[i] + data[i + 1] + data[i + 2]) / 3; n++; }
  edge /= n;
  const bgOk = kind === 'mul' ? edge > 235 : edge < 20;
  if (kind === 'luma' || kind === 'key') {
    const rgba = Buffer.alloc(w * h * 4);
    for (let p = 0; p < w * h; p++) {
      const r = data[p * 3], g = data[p * 3 + 1], b = data[p * 3 + 2], mx = Math.max(r, g, b);
      if (kind === 'luma') { const l = Math.round(0.299 * r + 0.587 * g + 0.114 * b); rgba.set([255, 255, 255, l], p * 4); }
      else { const a = mx < 18 ? 0 : mx > 48 ? 255 : Math.round((mx - 18) / 30 * 255); rgba.set([r, g, b, a], p * 4); }
    }
    img = sharp(rgba, { raw: { width: w, height: h, channels: 4 } });
  }
  const out = `${ASSETS}mat-${key}.webp`;
  const info = await img.webp({ quality, alphaQuality: 90 }).toFile(out);
  outs.push({ key, kind, w, h, kb: Math.round(info.size / 102.4) / 10, bgOk, edge: Math.round(edge) });
  console.log(`[71] ${no} ${cell} → arena/mat-${key}.webp ${w}×${h} ${kind} ${Math.round(info.size / 102.4) / 10}KB${bgOk ? '' : ` ⚠️ 칸 가장자리 밝기 ${Math.round(edge)} — 배경이 ${kind === 'mul' ? '흰색' : '검정'}이 아니거나 이웃 칸이 묻었어요. 다시 그려야 해요`}${info.size > 20480 ? ' ⚠️ 20KB 넘음 → --quality 70' : ''}`);
}
// --preview: 잘린 4장을 회색 바닥 위에 처리 방법대로 올려 본다(add=더하기 · mul=곱하기 · 나머지=보통)
if (preview) {
  const tiles = await Promise.all(outs.map(async o => {
    const base = sharp({ create: { width: 300, height: 300, channels: 3, background: '#7a9a5a' } });
    const top = await sharp(`${ASSETS}mat-${o.key}.webp`).resize(260, 260, { fit: 'inside' }).toBuffer();
    return base.composite([{ input: top, blend: o.kind === 'add' ? 'add' : o.kind === 'mul' ? 'multiply' : 'over' }]).png().toBuffer();
  }));
  await sharp({ create: { width: 1200, height: 300, channels: 3, background: '#000' } }).composite(tiles.map((input, i) => ({ input, left: i * 300, top: 0 }))).png().toFile(preview);
  console.log(`[71] 미리보기 ${preview}`);
}
if (outs.some(o => !o.bgOk)) process.exitCode = 2;
