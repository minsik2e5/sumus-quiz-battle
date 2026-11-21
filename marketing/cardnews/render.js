// cards.html의 카드를 한 장씩 1080x1350 PNG로 저장한다.
// 사용법: node render.js [html 파일] [출력 폴더]
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

(async () => {
  const src = path.resolve(process.argv[2] || 'cards.html');
  const out = path.resolve(process.argv[3] || 'out');
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1080, height: 1350 } });
  await page.goto('file://' + src);
  await page.evaluate(() => document.fonts.ready);
  const cards = await page.$$('.card');
  for (let i = 0; i < cards.length; i++) {
    const file = path.join(out, 'card-' + String(i + 1).padStart(2, '0') + '.png');
    await cards[i].screenshot({ path: file });
    console.log(file);
  }
  await browser.close();
})();
