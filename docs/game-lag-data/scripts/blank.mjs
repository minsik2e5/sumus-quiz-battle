// 빈 화면(일 없는 rAF 루프)의 fps: 이 환경의 CPU N배 측정 바닥(게임과 무관한 손실)을 본다
import { createRequire } from 'node:module'; const require = createRequire(import.meta.url); const pw = require('playwright');
const b = await pw.chromium.launch(); const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true }); const page = await ctx.newPage();
await page.setContent('<canvas id=c width=265 height=574 style="width:390px;height:844px"></canvas>');
const cdp = await ctx.newCDPSession(page);
for (const work of [0, 1]) for (const cpu of [1, 4, 6]) {
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu });
  const r = await page.evaluate(work => new Promise(res => { const f = []; let last = 0, t0 = performance.now(); const x = document.getElementById('c').getContext('2d'); const loop = t => { if (last) f.push(t - last); last = t; if (work) { x.fillStyle = `hsl(${t % 360},50%,50%)`; x.fillRect(0, 0, 265, 574); } if (performance.now() - t0 < 8000) requestAnimationFrame(loop); else res({ fps: Math.round(f.length / (f.reduce((a, b) => a + b, 0) / 1000) * 10) / 10, o33: f.filter(d => d > 33.4).length, o50: f.filter(d => d > 50).length }); }; requestAnimationFrame(loop); }), work);
  console.log(work ? '캔버스 한 번 칠하기' : '빈 루프', 'cpu' + cpu, JSON.stringify(r));
}
await b.close();
