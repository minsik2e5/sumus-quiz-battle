// cards.html 카드뉴스를 인스타 릴스용 세로 영상(1080x1920, 30fps MP4)으로 만든다.
// 사용법: node render-reel.js [html 파일] [출력 mp4]
// 카드 틀은 그대로 쓰고, 세로 배치와 등장 움직임만 덧씌운다. 음악은 인스타 앱에서 넣는다.
const { chromium } = require('playwright');
const { execFileSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const FPS = 30;
const W = 1080, H = 1920;
const DUR = [3.2, 3.8, 4.0, 3.8, 4.4, 4.2]; // 장마다 보여 줄 초
const TR = 0.45;                            // 옆으로 넘기는 시간

const REEL_CSS = `
  body { background: #000; }
  #deck { position: relative; width: ${W}px; height: ${H}px; overflow: hidden; }
  .card { position: absolute; left: 0; top: 0; height: ${H}px; padding: 170px 88px 300px; will-change: transform; }
  .body { gap: 44px; }
  .prog i { position: relative; overflow: hidden; }
  .prog i b { position: absolute; inset: 0 auto 0 0; width: 0; background: var(--blue); border-radius: 4px; }
  .cover .prog i b, .end .prog i b { background: #fff; }
  .giant { bottom: 380px; }
`;

const ANIM_JS = (DUR, TR, W) => {
  const ease = (x) => 1 - Math.pow(1 - Math.min(Math.max(x, 0), 1), 3);
  const inOut = (x) => x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
  const cards = Array.from(document.querySelectorAll('.card'));
  const starts = []; let acc = 0;
  DUR.forEach((d) => { starts.push(acc); acc += d; });
  const total = acc;

  // 장마다 등장할 요소와 시작 시각 정하기
  const items = cards.map((card, ci) => {
    const list = [];
    let t = ci === 0 ? 0.05 : TR + 0.05;
    card.querySelectorAll('.prog i').forEach((seg) => { if (!seg.querySelector('b')) seg.appendChild(document.createElement('b')); seg.classList.remove('on'); });
    Array.from(card.querySelector('.body').children).forEach((el) => {
      if (el.classList.contains('giant')) return;
      if (el.classList.contains('sticker')) { list.push({ el, t: (ci === 0 ? 0.9 : t), kind: 'pop', rot: 8 }); return; }
      const groups = el.matches('.list, .compare, .funnel, .pts') ? Array.from(el.children) : null;
      if (groups) { groups.forEach((g, gi) => list.push({ el: g, t: t + gi * 0.22, kind: 'up' })); t += groups.length * 0.22; return; }
      list.push({ el, t, kind: 'up' });
      const dots = el.querySelectorAll('.waffle i');
      if (dots.length) { dots.forEach((d, di) => list.push({ el: d, t: t + 0.3 + di * 0.014, kind: 'dot' })); t += 0.3 + dots.length * 0.014; }
      t += 0.2;
    });
    return list;
  });

  window.REEL_TOTAL = total;
  window.renderAt = (T) => {
    cards.forEach((card, ci) => {
      const s = starts[ci], d = DUR[ci];
      const enter = ci === 0 ? s : s - TR;       // 이전 장 끝에서 밀려 들어온다
      const local = T - enter;
      let x = W;
      if (T >= enter && T < s + d) x = ci === 0 || T >= s ? 0 : W * (1 - inOut((T - enter) / TR));
      if (ci < cards.length - 1 && T >= s + d - TR) x = -W * inOut((T - (s + d - TR)) / TR);
      if (T < enter) x = W;
      if (ci < cards.length - 1 && T >= s + d) x = -W;
      if (ci === cards.length - 1 && T >= s) x = 0;
      card.style.transform = 'translateX(' + x + 'px)';
      card.style.visibility = Math.abs(x) >= W ? 'hidden' : 'visible';

      items[ci].forEach((it) => {
        const p = ease((local - it.t) / (it.kind === 'dot' ? 0.18 : 0.45));
        if (it.kind === 'up') { it.el.style.opacity = p; it.el.style.transform = 'translateY(' + (1 - p) * 48 + 'px)'; }
        else if (it.kind === 'pop') { it.el.style.opacity = p; it.el.style.transform = 'rotate(' + it.rot + 'deg) scale(' + (0.4 + 0.6 * p) + ')'; }
        else { it.el.style.opacity = p; it.el.style.transform = 'scale(' + (0.3 + 0.7 * p) + ')'; }
      });

      // 진행 막대: 지난 장은 꽉, 지금 장은 시간만큼 채움
      const segs = card.querySelectorAll('.prog i b');
      segs.forEach((b, k) => {
        let fill = 0;
        if (k < ci) fill = 1;
        if (k === ci) fill = Math.min(Math.max((T - s) / d, 0), 1);
        if (ci === cards.length - 1 && k === ci && T >= s) fill = Math.min((T - s) / (d * 0.7), 1);
        b.style.width = fill * 100 + '%';
      });
    });
  };
};

(async () => {
  const src = path.resolve(process.argv[2] || 'cards.html');
  const out = path.resolve(process.argv[3] || 'reel.mp4');
  const frames = fs.mkdtempSync(path.join(path.dirname(out), 'frames-'));
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  await page.goto('file://' + src);
  await page.evaluate(() => document.fonts.ready);
  await page.addStyleTag({ content: REEL_CSS });
  await page.evaluate(`(${ANIM_JS.toString()})(${JSON.stringify(DUR)}, ${TR}, ${W})`);
  const total = await page.evaluate(() => window.REEL_TOTAL);
  const n = Math.round(total * FPS);
  for (let f = 0; f < n; f++) {
    await page.evaluate((t) => window.renderAt(t), f / FPS);
    await page.screenshot({ path: path.join(frames, String(f).padStart(4, '0') + '.png'), clip: { x: 0, y: 0, width: W, height: H } });
  }
  await browser.close();
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', path.join(frames, '%04d.png'),
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', '-preset', 'medium', '-movflags', '+faststart', out]);
  fs.rmSync(frames, { recursive: true, force: true });
  console.log(out, n + ' frames', total.toFixed(1) + 's');
})();
