'use strict';

// public/ 과 얼굴 인식 엔진(MediaPipe) 파일을 cloudflare/dist 로 모은다. (wrangler가 배포 전에 실행)
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const dist = path.join(__dirname, 'dist');
const mediapipe = path.join(root, 'node_modules', '@mediapipe', 'tasks-vision');

fs.rmSync(dist, { recursive: true, force: true });
fs.cpSync(path.join(root, 'public'), dist, { recursive: true });
const vendor = path.join(dist, 'vendor', 'mediapipe');
fs.mkdirSync(path.join(vendor, 'wasm'), { recursive: true });
fs.copyFileSync(path.join(mediapipe, 'vision_bundle.mjs'), path.join(vendor, 'vision_bundle.mjs'));
for (const f of ['vision_wasm_internal.js', 'vision_wasm_internal.wasm', 'vision_wasm_nosimd_internal.js', 'vision_wasm_nosimd_internal.wasm']) {
  fs.copyFileSync(path.join(mediapipe, 'wasm', f), path.join(vendor, 'wasm', f));
}
console.log('cloudflare/dist ready');
