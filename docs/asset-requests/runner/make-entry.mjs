// V13.243 펫 대행진 놀이터 입구 그림(임시): 그림 74(bg-sky · road-sky · post-sky · castle-sky · cloud-isle · gate-good · gate-bad · spirit-run)를
// 합성해 public/assets/runner/entry.webp(1280×853)를 만든다. 선생님이 GPT로 만든 입구 그림이 오면 그 파일로 바꾸면 된다(build:assets가 ENTRY_ART에 적음).
// 사용: node docs/asset-requests/runner/make-entry.mjs   (미리 깔린 크로뮴의 캔버스로 원근 길을 그린다. 한 번만 돌리면 됨)
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url), root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const pw = require('playwright'), keys = ['bg-sky', 'road-sky', 'post-sky', 'castle-sky', 'cloud-isle', 'gate-good', 'gate-bad', 'spirit-run'];
const imgs = Object.fromEntries(keys.map(k => [k, 'data:image/webp;base64,' + readFileSync(resolve(root, `public/assets/runner/${k}.webp`)).toString('base64')]));
const browser = await pw.chromium.launch(), page = await browser.newPage();
const url = await page.evaluate(async imgs => {
  const load = src => new Promise(r => { const i = new Image(); i.onload = () => r(i); i.src = src; });
  const I = {}; for (const [k, v] of Object.entries(imgs)) I[k] = await load(v);
  const W = 1280, H = 853, c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d');
  const cover = (im, dx, dy, dw, dh) => { const s = Math.max(dw / im.width, dh / im.height); x.drawImage(im, dx + (dw - im.width * s) / 2, dy + (dh - im.height * s) / 2, im.width * s, im.height * s); };
  cover(I['bg-sky'], 0, 0, W, H);
  // 원근: 카메라 높이 h, 초점 F, 지평선 HZ. 길 폭 ±4, 타일 한 장 = 4단위
  const HZ = 300, F = 760, h = 8.6, cx = W / 2, proj = (wx, wy, z) => [cx + wx * F / z, HZ + (h - wy) * F / z, F / z];
  for (const [sd, z, f] of [[-1, 60, .2], [1, 45, .7], [-1, 30, .5], [1, 90, .1]]) { const [px, py, s] = proj(sd * (9 + f * 8), -3, z), w = 5 * s, hh = w * I['cloud-isle'].height / I['cloud-isle'].width; x.drawImage(I['cloud-isle'], px - w / 2, py - hh * .5, w, hh); }
  const zFar = 95, yTop = HZ + h * F / zFar, road = I['road-sky'];
  for (let y = yTop; y < H; y += 3) { const z = h * F / (y + 1.5 - HZ), half = 4 * F / z, za = h * F / (y - HZ), zb = h * F / (y + 3 - HZ), ra = (1 - ((za / 4) % 1)) * road.height, rb = (1 - ((zb / 4) % 1)) * road.height;
    x.fillStyle = '#f6d36a'; x.fillRect(cx - half * 1.09, y, half * 2.18, 3.5); x.drawImage(road, 0, Math.min(ra, rb), road.width, Math.max(1, Math.abs(rb - ra)), cx - half, y, half * 2, 3.5); }
  { const fog = x.createLinearGradient(0, yTop, 0, yTop + 70), [lx] = proj(-4.4, 0, 60); fog.addColorStop(0, 'rgba(226,238,255,.85)'); fog.addColorStop(1, 'rgba(226,238,255,0)'); x.fillStyle = fog; x.fillRect(lx, yTop, (cx - lx) * 2, 70); }
  { const [px, py, s] = proj(0, 0, 52), w = 11 * s; x.drawImage(I['castle-sky'], px - w / 2, py - w, w, w); }
  for (let z = 84; z >= 9; z -= 6) for (const sd of [-1, 1]) { const [px, py, s] = proj(sd * 4.3, 0, z), w = .5 * s, hh = 1.35 * s; x.drawImage(I['post-sky'], px - w / 2, py - hh, w, hh); }
  // 숫자 문 한 쌍(×2 · −5): 검은 바탕 빛 그림 → 더하기 섞기 + 숫자
  const z0 = 19;
  for (const [sd, key, txt, col] of [[-1, 'gate-good', '×2', '#062a63'], [1, 'gate-bad', '−5', '#55060f']]) {
    const [ax, ay] = proj(sd < 0 ? -3.85 : .15, 2.6, z0), [bx, by] = proj(sd < 0 ? -.15 : 3.85, 0, z0);
    const gw = bx - ax, gh = by - ay, gr = x.createLinearGradient(0, ay, 0, by); gr.addColorStop(0, sd < 0 ? 'rgba(70,170,255,.78)' : 'rgba(255,90,100,.78)'); gr.addColorStop(1, sd < 0 ? 'rgba(30,100,230,.62)' : 'rgba(210,30,60,.62)');
    x.fillStyle = gr; x.beginPath(); x.roundRect(ax, ay, gw, gh, 14); x.fill(); x.lineWidth = 7; x.strokeStyle = sd < 0 ? '#bfe6ff' : '#ffc4c4'; x.stroke();
    x.globalCompositeOperation = 'lighter'; x.globalAlpha = .55; x.drawImage(I[key], ax, ay, gw, gh); x.globalAlpha = 1; x.globalCompositeOperation = 'source-over';
    x.font = `900 ${Math.round((by - ay) * .55)}px system-ui, sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.lineJoin = 'round';
    x.lineWidth = 12; x.strokeStyle = col; x.strokeText(txt, (ax + bx) / 2, (ay + by) / 2); x.fillStyle = '#fff'; x.fillText(txt, (ax + bx) / 2, (ay + by) / 2);
  }
  { const [px, py, s] = proj(0, 0, z0), fh = 3 * s; x.fillStyle = 'rgba(242,246,255,.9)'; x.fillRect(px - .1 * s, py - fh, .2 * s, fh); }
  // 정령 무리(해바라기 배치, 뒤부터)
  const sp = I['spirit-run'], list = [];
  for (let i = 0; i < 60; i++) { const r = .3 * Math.sqrt(i + .5), a = i * 2.39996; list.push([Math.cos(a) * r, Math.sin(a) * r * .8]); }
  list.sort((a, b) => b[1] - a[1]);
  for (const [ox, oz] of list) { const [px, py, s] = proj(ox, Math.abs(Math.sin(ox * 7 + oz * 5)) * .25, 13.5 + oz), w = .9 * s; x.globalAlpha = .35; x.fillStyle = '#28305a'; x.beginPath(); x.ellipse(px, proj(ox, 0, 13.5 + oz)[1], w * .4, w * .12, 0, 0, 7); x.fill(); x.globalAlpha = 1; x.drawImage(sp, px - w / 2, py - w, w, w); }
  const v = x.createRadialGradient(W / 2, H / 2, H * .45, W / 2, H / 2, H * .95); v.addColorStop(0, 'rgba(10,16,40,0)'); v.addColorStop(1, 'rgba(10,16,40,.35)'); x.fillStyle = v; x.fillRect(0, 0, W, H);
  return c.toDataURL('image/webp', .86);
}, imgs);
writeFileSync(resolve(root, 'public/assets/runner/entry.webp'), Buffer.from(url.split(',')[1], 'base64'));
console.log('entry.webp', Math.round(Buffer.from(url.split(',')[1], 'base64').length / 1024) + 'KB');
await browser.close();
