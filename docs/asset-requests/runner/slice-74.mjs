// 그림 74(펫 대행진) 자르기: 시트 한 장을 칸대로 잘라 public/assets/runner/<이름>.webp로 넣는다.
//   node docs/asset-requests/runner/slice-74.mjs /tmp/art/74-1.png        (시트 번호는 파일 이름에서 읽는다)
//   node docs/asset-requests/runner/slice-74.mjs /tmp/art/74-7.png --preview /tmp/art/74-7-check.png
// 칸 · 이름 · 처리 방법(kind) · 크기는 build-74.mjs의 SHEETS를 그대로 쓴다(손으로 적지 않는다).
// 배경은 시트마다 스스로 알아낸다(시트 바깥 테두리 8px):
//   투명 — 진짜 알파를 그대로 쓴다.
//   흰색 · 검정 — 투명을 못 만든 그림. 칸 가장자리에서 이어진 배경색만 투명으로 뺀다(물체 안의 흰 빛 · 검은 눈은 남는다).
//          hollow 칸(수정 감옥)은 안쪽 구멍도 빼야 하므로 칸 전체에서 배경색을 뺀다.
// 처리:
//   cut  — 배경을 빼고 그림 덩어리만 잘라(여백 4%) 정해진 크기 안에 가운데 맞춤(투명 webp).
//   add  — 검은 배경 그대로(투명 없음). 빛 덩어리만 잘라 검은 바탕에 가운데 맞춤. 게임이 더하기 섞기로 그린다.
//   tile — 칸 가운데 판의 안쪽 80%를 잘라 정사각형으로, 위 · 아래 이음매를 섞어 세로로 이어지게 한다(투명 없음).
//   bg   — 세로 한 장을 720×1080으로(투명 없음).
// 용량 목표: 배경 150KB · 성 80KB · 나머지 40KB 이하(넘으면 --quality 70). 44장 합계 1.8MB 이하.
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { basename } from 'node:path';
import { SHEETS, isBg } from './build-74.mjs';

const ASSETS = fileURLToPath(new URL('../../../public/assets/runner/', import.meta.url));
const args = process.argv.slice(2);
const pi = args.indexOf('--preview'), preview = pi >= 0 ? args.splice(pi, 2)[1] : '';
const qi = args.indexOf('--quality'), quality = qi >= 0 ? Number(args.splice(qi, 2)[1]) : 82;
const file = args[0];
const no = basename(file || '').match(/74-\d+/)?.[0];
const sheet = SHEETS.find(s => s.no === no);
if (!sheet) { console.error('사용법: node slice-74.mjs <74-N.png> [--preview out.png] [--quality 82]'); process.exit(1); }
mkdirSync(ASSETS, { recursive: true });
const CELL_XY = { 'TOP-LEFT': [0, 0], 'TOP-RIGHT': [1, 0], 'BOTTOM-LEFT': [0, 1], 'BOTTOM-RIGHT': [1, 1] };
const LIMIT = key => key.startsWith('bg-') ? 150 : key.startsWith('castle-') && !key.includes('chunk') ? 80 : 40;
const outs = [];
let bad = false;
const save = async (img, key, kind, w, h) => {
  const out = `${ASSETS}${key}.webp`;
  const info = await img.webp({ quality, alphaQuality: 90 }).toFile(out);
  const kb = Math.round(info.size / 102.4) / 10, over = kb > LIMIT(key);
  outs.push({ key, kind, w, h, kb });
  return `${w}×${h} ${kind} ${kb}KB${over ? ` ⚠️ ${LIMIT(key)}KB 넘음 → --quality 70` : ''}`;
};

if (isBg(sheet)) {
  const [, key, , kind, [w, h]] = sheet.cells[0];
  const meta = await sharp(file).metadata();
  if (Math.abs(meta.width / meta.height - 2 / 3) > .03) console.warn(`[74] ${no}: 세로 2:3이 아니에요(${meta.width}×${meta.height}). 가운데를 잘라 맞춥니다.`);
  console.log(`[74] ${no} → runner/${key}.webp ${await save(sharp(file).removeAlpha().resize(w, h, { fit: 'cover' }), key, kind, w, h)}`);
} else {
  const { data: px } = await sharp(file).ensureAlpha().resize(1024, 1024, { fit: 'fill' }).raw().toBuffer({ resolveWithObject: true });
  const at = (x, y) => (y * 1024 + x) * 4;
  // 시트 배경 알아내기: 바깥 테두리 8px의 평균 알파 · 밝기
  let A = 0, L = 0, n = 0;
  for (let y = 0; y < 1024; y++) for (let x = 0; x < 1024; x++) if (x < 8 || y < 8 || x >= 1016 || y >= 1016) { const i = at(x, y); A += px[i + 3]; L += (px[i] + px[i + 1] + px[i + 2]) / 3; n++; }
  A /= n; L /= n;
  const mode = A < 30 ? 'alpha' : L > 235 ? 'white' : L < 20 ? 'black' : '';
  if (!mode) { console.error(`[74] ${no}: 배경이 투명 · 순수 흰색 · 순수 검정 중 무엇도 아니에요(테두리 알파 ${Math.round(A)} · 밝기 ${Math.round(L)}). 다시 그려야 해요.`); process.exit(2); }
  const bgRGB = mode === 'white' ? [255, 255, 255] : [0, 0, 0];
  const dist = i => Math.max(Math.abs(px[i] - bgRGB[0]), Math.abs(px[i + 1] - bgRGB[1]), Math.abs(px[i + 2] - bgRGB[2]));
  console.log(`[74] ${no}: 배경 ${mode === 'alpha' ? '투명' : mode === 'white' ? '흰색' : '검정'}`);
  for (const [cell, key, , kind, [w, h], , opt] of sheet.cells) {
    const [cx, cy] = CELL_XY[cell], X0 = cx * 512, Y0 = cy * 512, S = 512;
    if (kind === 'add' && mode !== 'black') { console.log(`[74] ${no} ${cell} ${key} ⚠️ 빛(add) 칸인데 배경이 검정이 아니에요. 다시 그려야 해요`); bad = true; continue; }
    // 칸 하나를 RGBA로 꺼내며 배경을 투명으로(알파 0) 만든다.
    const rgba = Buffer.alloc(S * S * 4);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) px.copy(rgba, (y * S + x) * 4, at(X0 + x, Y0 + y), at(X0 + x, Y0 + y) + 4);
    const di = (x, y) => dist(at(X0 + x, Y0 + y));
    if (mode !== 'alpha' && kind !== 'add') {
      const isBgPx = (x, y) => di(x, y) < 40;
      const clear = new Uint8Array(S * S);
      if (opt?.hollow) { for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) if (isBgPx(x, y)) clear[y * S + x] = 1; }
      else {
        const stack = [];
        for (let k = 0; k < S; k++) stack.push([k, 0], [k, S - 1], [0, k], [S - 1, k]);
        while (stack.length) { const [x, y] = stack.pop(); if (x < 0 || y < 0 || x >= S || y >= S || clear[y * S + x] || !isBgPx(x, y)) continue; clear[y * S + x] = 1; stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]); }
      }
      for (let p = 0; p < S * S; p++) {
        if (clear[p]) { rgba[p * 4 + 3] = 0; continue; }
        // 지운 곳 바로 옆의 배경에 가까운 픽셀은 부드럽게(가장자리 흰 · 검은 테 없애기)
        const x = p % S, y = (p / S) | 0, d = di(x, y);
        if (d < 70 && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => clear[(y + b) * S + x + a])) rgba[p * 4 + 3] = Math.round(Math.max(0, d - 40) / 30 * 255);
      }
    }
    // 그림 덩어리 찾기: add는 밝기, 나머지는 알파
    let x0 = S, y0 = S, x1 = -1, y1 = -1;
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { const i = (y * S + x) * 4, on = kind === 'add' ? Math.max(rgba[i], rgba[i + 1], rgba[i + 2]) > 14 : rgba[i + 3] > 12; if (on) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; } }
    if (x1 < 0) { console.log(`[74] ${no} ${cell} ${key} ⚠️ 빈 칸이에요. 다시 그려야 해요`); bad = true; continue; }
    const touches = x0 < 3 || y0 < 3 || x1 > S - 4 || y1 > S - 4;
    let img, warn = touches ? ' ⚠️ 그림이 칸 가장자리에 닿아요(잘렸거나 이웃 칸이 묻음) — 미리보기를 보고 필요하면 다시 그려요' : '';
    if (touches) bad = true;
    const cellImg = () => sharp(rgba, { raw: { width: S, height: S, channels: 4 } });
    if (kind === 'tile') {
      // 판 안쪽 80%(이음매용으로 아래로 18% 더) → w×h, 위 18%는 아래쪽 이어지는 줄과 섞는다.
      const bw = x1 - x0 + 1, bh = y1 - y0 + 1, iw = Math.round(bw * .8), ih = Math.round(bh * .8 / 1.18);
      const B = Math.round(ih * .18), left = x0 + Math.round((bw - iw) / 2), top = y0 + Math.round((bh - ih - B) / 2);
      const rows = Math.round(h * (ih + B) / ih), Bh = rows - h;
      const { data: t } = await cellImg().extract({ left, top, width: iw, height: ih + B }).removeAlpha().resize(w, rows, { fit: 'fill' }).raw().toBuffer({ resolveWithObject: true });
      const outBuf = Buffer.alloc(w * h * 3);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) for (let c = 0; c < 3; c++) {
        const a = t[(y * w + x) * 3 + c];
        outBuf[(y * w + x) * 3 + c] = y < Bh ? Math.round(t[((y + h) * w + x) * 3 + c] * (1 - y / Bh) + a * (y / Bh)) : a;
      }
      img = sharp(outBuf, { raw: { width: w, height: h, channels: 3 } });
      if (x1 - x0 < 300 || y1 - y0 < 300) warn += ' ⚠️ 길 판이 작아요(300px 아래) — 칸을 가득 채우게 다시 그려요';
    } else {
      const pad = Math.round(Math.max(x1 - x0, y1 - y0) * .04);
      const left = Math.max(0, x0 - pad), top = Math.max(0, y0 - pad), width = Math.min(S, x1 + pad + 1) - left, height = Math.min(S, y1 + pad + 1) - top;
      const piece = cellImg().extract({ left, top, width, height }).resize(w, h, { fit: 'contain', background: kind === 'add' ? '#000000' : { r: 0, g: 0, b: 0, alpha: 0 } });
      img = kind === 'add' ? sharp(await piece.flatten({ background: '#000000' }).png().toBuffer()).removeAlpha() : piece;
    }
    console.log(`[74] ${no} ${cell} → runner/${key}.webp ${await save(img, key, kind, w, h)}${warn}`);
  }
}

// --preview: 잘린 그림을 길 색 바닥 위에 처리 방법대로 올려 본다(add = 더하기 · tile = 세로로 두 번 이어 붙여 이음매 확인)
if (preview && outs.length) {
  const T = 300;
  const tiles = await Promise.all(outs.map(async o => {
    const base = sharp({ create: { width: T, height: T, channels: 3, background: '#c9a46a' } });
    if (o.kind === 'tile') { const one = await sharp(`${ASSETS}${o.key}.webp`).resize(T / 2, T / 2).toBuffer(); return base.composite([{ input: one, left: T / 4, top: 0 }, { input: one, left: T / 4, top: T / 2 }]).png().toBuffer(); }
    const top = await sharp(`${ASSETS}${o.key}.webp`).resize(T - 40, T - 40, { fit: 'inside' }).toBuffer();
    return base.composite([{ input: top, blend: o.kind === 'add' ? 'add' : 'over' }]).png().toBuffer();
  }));
  await sharp({ create: { width: T * tiles.length, height: T, channels: 3, background: '#000' } }).composite(tiles.map((input, i) => ({ input, left: i * T, top: 0 }))).png().toFile(preview);
  console.log(`[74] 미리보기 ${preview}`);
}
if (bad) process.exitCode = 2;
