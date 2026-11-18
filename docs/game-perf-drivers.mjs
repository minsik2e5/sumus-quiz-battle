// V13.245 docs/game-perf.mjs가 쓰는 게임별 자동 조종(검사에는 넣지 않는다).
// 게임마다: open(놀이터에서 열기) · start(판 시작) · playing(판이 도는 표시, 페이지 안에서 평가) · done(판 끝 표시) · act(판 중 조작) · again(다음 판 준비) · exit(나가기)
export function register(driver, { vis, tapIf, sleep }) {
  const arcade = async (page, pg = 'arcade') => {
    for (let i = 0; i < 4 && !(await page.$('.pg-hub')); i++) { await page.click('nav.bottom-nav [data-go="arcade"]', { force: true, timeout: 8000 }).catch(() => {}); await sleep(1200); }   // 첫 누름이 다시 그리기에 묻힐 때가 있다
    await tapIf(page, `.pg-hub [data-pg="${pg}"]`); await sleep(700);
  };
  const open = (sel, pg) => async page => { await arcade(page, pg); await page.evaluate(s => document.querySelector(s)?.scrollIntoView({ block: 'center' }), sel); await sleep(300); await page.click(sel); await sleep(1500); };
  const center = async (page, sel) => { const b = await page.$(sel).then(e => e?.boundingBox()).catch(() => null); return b ? { x: b.x + b.width / 2, y: b.y + b.height / 2 } : null; };
  const post = (page, path, body = {}) => page.evaluate(([p, b]) => fetch('/api' + p, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b), credentials: 'same-origin' }).then(r => r.status).catch(() => 0), [path, body]);

  /* 짝 맞추기: 같은 짝(en · ko) 두 장을 차례로 누른다 */
  driver('match', {
    open: open('[data-action="arcade-match"]'),
    start: async (page, r) => { if (!(await tapIf(page, '[data-mt="again"]'))) await page.click('[data-mt="start"]', { force: true, timeout: 8000 }); if (r) { await sleep(600); await tapIf(page, '[data-mt="start"]'); } },
    playing: () => !!document.querySelector('.mt-card') && !document.querySelector('.mt-result'),
    done: () => !!document.querySelector('.mt-result'),
    every: 350,
    act: async page => {
      const pts = await page.evaluate(() => {
        const live = [...document.querySelectorAll('.mt-card:not(.hit):not(.gone)')], a = live.find(c => c.dataset.side === 'en'); if (!a) return null;
        const b = live.find(c => c.dataset.side === 'ko' && c.dataset.pair === a.dataset.pair); if (!b) return null;
        return [a, b].map(e => { const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
      });
      if (!pts) return;
      for (const p of pts) { await page.touchscreen.tap(p.x, p.y); await sleep(120); }
    },
    again: async () => { await sleep(1200); },
    exit: async page => { await tapIf(page, '[data-mt="exit"]'); await sleep(400); await tapIf(page, '[data-mt="quit-yes"]'); }
  });

  /* 벽 통과: 시작 응답의 정답을 가로채 대부분 맞힌다(판을 끝까지 보려고) */
  let wallAns = [];
  driver('wall', {
    open: async page => { page.on('response', async res => { if (/\/games\/wall\/start/.test(res.url())) { try { wallAns = (await res.json()).walls.map(w => w.answer); } catch {} } }); await open('[data-action="wall-open"]')(page); },
    start: async page => { if (!(await tapIf(page, '[data-wl="again"]'))) await page.click('[data-wl="start"]', { force: true, timeout: 8000 }); },
    playing: () => !!document.querySelector('#wl-app.playing #wl-wall') && !document.querySelector('.wl-result'),
    done: () => !!document.querySelector('.wl-result'),
    every: 300,
    act: async (page, n) => {
      if (n % 5 !== 4) return;   // 벽마다 1.5초쯤 본 뒤 고른다
      const i = await page.evaluate(() => { const h = document.getElementById('wl-hud')?.textContent || ''; const m = h.match(/(\d+)\s*\/\s*\d+/); return m ? Number(m[1]) - 1 : -1; });
      const k = wallAns[i] ?? 0, p = await center(page, `.wl-pick.p${k}`);
      if (p) await page.touchscreen.tap(p.x, p.y);
    },
    again: async () => { await sleep(1500); },
    exit: async page => { await tapIf(page, '.wl-result [data-wl="exit"]') || await tapIf(page, '[data-wl="exit"]'); await sleep(400); await tapIf(page, '[data-wl="quit-yes"]'); }
  });

  /* 10초 맞추기: 시작 뒤 10초쯤에 누른다(하루 3판) */
  let tmAt = 0;
  driver('timing', {
    init: () => { try { localStorage.setItem('sumus-timing-guide', '1'); } catch {} },
    open: open('[data-action="timing-open"]'),
    start: async page => { if (!(await tapIf(page, '.tm-result [data-tm="again"]'))) await page.click('[data-tm="start"]', { force: true, timeout: 8000 }); tmAt = 0; },
    playing: () => !!document.querySelector('#tm-stage.run'),
    done: () => !!document.querySelector('#tm-layer .tm-result'),
    act: async page => { tmAt ||= Date.now(); if (Date.now() - tmAt > 9800 && tmAt > 0) { const p = await center(page, '#tm-btn'); if (p) await page.touchscreen.tap(p.x, p.y); tmAt = -1; } },
    again: async () => { await sleep(1500); },
    exit: async page => { await tapIf(page, '[data-tm="close-layer"]'); await tapIf(page, '[data-tm="exit"]'); }
  });

  /* 낚시: 던지기(누르고 있기) → 입질에 누르기 → 텐션 초록 · 파랑이면 감고 빨강이면 놓기 → 마무리 탭 */
  let reelDown = false, finAt = 0;
  driver('fishing', {
    open: async page => { await post(page, '/reel/guide', {}); await post(page, '/reel/guide', { tutorial: true }); await open('[data-action="reel-open"]')(page); await sleep(800); await tapIf(page, '[data-rl="close-sheet"]'); await sleep(500); },
    start: async page => {
      reelDown = false; finAt = 0;
      for (let i = 0; i < 4; i++) { if (await tapIf(page, '.rl-res button.yl-cta, .rl-rev button, [data-rl="again"], [data-rl="close-layer"]')) await sleep(900); }
      const p = await center(page, '#rl-cast'); if (!p) throw Error('던지기 버튼이 없어요');
      await page.mouse.move(p.x, p.y); await page.mouse.down(); await sleep(520); await page.mouse.up();
    },
    playing: () => ['wait', 'bite', 'fight', 'finish'].includes(document.getElementById('rl-pov')?.dataset.phase),
    done: () => ['reveal', 'result'].includes(document.getElementById('rl-pov')?.dataset.phase) || !!document.querySelector('.rl-res, .rl-rev'),
    every: 70,
    act: async page => {
      const s = await page.evaluate(() => { const p = document.getElementById('rl-pov'); return p ? { phase: p.dataset.phase, zone: p.dataset.zone, move: p.dataset.move } : null; });
      if (!s) return;
      const pov = { x: 195, y: 330 };
      if (s.phase === 'bite') { await page.mouse.move(pov.x, pov.y); await page.mouse.down(); await page.mouse.up(); return; }
      if (s.phase === 'fight') {
        if (s.move === 'mash') { if (reelDown) { await page.mouse.up(); reelDown = false; } for (const b of ['#rl-sl', '#rl-sr']) { const p = await center(page, b); if (p) await page.touchscreen.tap(p.x, p.y); } return; }
        const want = s.move !== 'thrash' && s.zone !== 'red';
        if (want && !reelDown) { const p = await center(page, '#rl-reel'); if (p) { await page.mouse.move(p.x, p.y); await page.mouse.down(); reelDown = true; } }
        else if (!want && reelDown) { await page.mouse.up(); reelDown = false; }
        return;
      }
      if (reelDown) { await page.mouse.up(); reelDown = false; }
      if (s.phase === 'finish') { finAt ||= Date.now(); if (Date.now() - finAt > 1050) { await page.mouse.move(pov.x, pov.y); await page.mouse.down(); await page.mouse.up(); finAt = Date.now() + 400; } }
    },
    again: async page => { if (reelDown) { await page.mouse.up(); reelDown = false; } await sleep(3500); },
    exit: async page => { for (let i = 0; i < 3; i++) { await tapIf(page, '.rl-res button, .rl-rev button'); await sleep(500); } await tapIf(page, '[data-rl="exit"], .rl-app .yb-back'); }
  });

  /* 인형뽑기: 방향키로 조금 움직이고 내리기(한 판에 집게 3번) */
  driver('claw', {
    open: async page => { await post(page, '/claw/home', { guide: true }); await open('[data-action="claw-open"]')(page); await tapIf(page, '[data-cw="close-layer"]'); },
    start: async page => { if (!(await tapIf(page, '[data-cw="again"]'))) await page.click('[data-cw="start"]', { force: true, timeout: 8000 }); },
    playing: () => !!document.querySelector('.cw-app.live'),
    done: () => !!document.querySelector('#cw-layer .cw-result'),
    every: 300,
    act: async (page, n) => {
      const m = n % 14;
      if (m === 0) await page.keyboard.down(n % 28 ? 'ArrowLeft' : 'ArrowRight');
      if (m === 3) { await page.keyboard.up('ArrowLeft'); await page.keyboard.up('ArrowRight'); await page.keyboard.down('ArrowUp'); }
      if (m === 5) await page.keyboard.up('ArrowUp');
      if (m === 6) await page.keyboard.press('Space');
    },
    again: async () => { await sleep(1500); },
    exit: async page => { await tapIf(page, '#cw-layer [data-cw="close-layer"]'); await sleep(300); await tapIf(page, '[data-cw="exit"]'); }
  });

  /* 가위바위보: 인트로 넘기고 한 번씩 낸다. 이기면 받는다(하루 5판) */
  driver('rps', {
    open: async page => { await arcade(page, 'tajja'); await tapIf(page, '[data-pg="rps"]'); await sleep(800); },
    start: async page => { if (!(await tapIf(page, '[data-r="again"]'))) { await tapIf(page, '[data-rps="bet"][data-bet="10"]'); await sleep(200); await page.click('[data-rps="play"]', { force: true, timeout: 8000 }); } },
    playing: () => !!document.querySelector('.rps-show'),
    done: () => !!document.querySelector('#rps-controls [data-r="again"]'),
    every: 400,
    act: async (page, n) => {
      if (n < 2) { const p = await center(page, '.rps-show'); if (p) await page.touchscreen.tap(p.x, p.y * .5); return; }
      await tapIf(page, '[data-r="cash"]') || await tapIf(page, `[data-r="pick"][data-hand="${['rock', 'paper', 'scissors'][n % 3]}"]`);
    },
    again: async () => { await sleep(800); },
    exit: async page => { await tapIf(page, '#rps-controls [data-r="close"]'); }
  });

  /* 야바위: 인트로 → 시작 → 섞기 끝나면 컵 하나 고르고 확인(하루 5판) */
  driver('yabawi', {
    open: async page => { await arcade(page, 'tajja'); await tapIf(page, '[data-pg="yabawi"]'); await sleep(800); },
    start: async page => { if (!(await tapIf(page, '[data-y="again"]'))) { await tapIf(page, '[data-yw="bet"]'); await sleep(200); await page.click('[data-yw="play"]', { force: true, timeout: 8000 }); } },
    playing: () => !!document.querySelector('[data-y="cup"]'),
    done: () => !!document.querySelector('#yw-controls [data-y="again"]'),
    every: 400,
    act: async (page, n) => {
      if (n < 2) { await page.touchscreen.tap(195, 300); return; }
      if (await tapIf(page, '[data-y="start"]:not([disabled])')) return;
      if (await tapIf(page, '[data-y="confirm"]:not([disabled])')) return;
      if (await tapIf(page, '[data-y="cash"]:not([disabled])')) return;
      const cups = await page.locator('[data-y="cup"]:not([disabled])').elementHandles(); if (cups.length) await cups[n % cups.length].click({ timeout: 800, force: true }).catch(() => {});
    },
    again: async () => { await sleep(800); },
    exit: async page => { await tapIf(page, '#yw-controls [data-y="close"]'); }
  });

  /* 몬스터 사냥: 지도 → 몬스터 누름 → 공 던지기(Enter) 반복 */
  driver('hunt', {
    open: async page => { await post(page, '/hunt/guide', {}); await open('[data-action="hunt-open"]')(page); await tapIf(page, '[data-hn="close-layer"]'); },
    start: async page => { await tapIf(page, '[data-hn="to-map"]'); await sleep(700); await page.click('.hn-spot[data-hn="spot"]', { force: true, timeout: 8000 }); },
    playing: () => !!document.getElementById('hn-catch') && !document.querySelector('#hn-layer .hn-result'),
    done: () => !!document.querySelector('#hn-layer .hn-result'),
    every: 400,
    act: async (page, n) => { if (n % 8 === 3) { await page.evaluate(() => document.getElementById('hn-hand')?.focus()); await page.keyboard.press('Enter'); } },
    again: async () => { await sleep(1200); },
    exit: async page => { await tapIf(page, '[data-hn="to-map"]'); await sleep(600); await tapIf(page, '[data-hn="exit"]'); }
  });

  /* 야차전 봇 대결(스피드전) · 몬스터(이지): 보기 4개 중 하나를 누른다. 브라우저 안 엔진이라 방(WebSocket)이 필요 없다 */
  const yachaAct = async (page, n) => {
    if (await tapIf(page, '[data-mg="skip"]') || await tapIf(page, '[data-mg="next"]')) return;
    if (n % 3 === 0) { const b = await page.$$('.yb-answer:not([disabled])'); if (b.length) await b[n % b.length].click({ timeout: 800 }).catch(() => {}); }
  };
  const yachaOpen = tab => async page => { for (let i = 0; i < 4 && !(await page.$('[data-yb="bot"]')); i++) { await page.click('nav.bottom-nav [data-go="yacha"]', { force: true, timeout: 8000 }); await sleep(1500); } if (tab) { await tapIf(page, `[data-yb="tab"][data-tab="${tab}"]`); await sleep(700); } };
  driver('yacha', {
    init: () => { try { localStorage.removeItem('sumus-yacha-lite'); } catch {} },
    open: yachaOpen(''),
    start: async page => { await tapIf(page, '.yb-result [data-yb="lobby"], .yb-result .btn'); await sleep(600); await tapIf(page, '[data-yb="mode"][data-mode="speed"]'); await sleep(200); await page.click('[data-yb="bot"]', { force: true, timeout: 8000 }); },
    playing: () => !!document.getElementById('yb-arena') && !!document.querySelector('.yb-answer') && !document.querySelector('.yb-result'),
    done: () => !!document.querySelector('.yb-result'),
    act: yachaAct, again: async () => { await sleep(1500); },
    exit: async page => { await tapIf(page, '.yb-result [data-yb="lobby"], .yb-result .btn'); await sleep(500); await page.click('nav.bottom-nav [data-go="home"]', { force: true, timeout: 8000 }).catch(() => {}); }
  });
  driver('monster', {
    init: () => { try { localStorage.removeItem('sumus-yacha-lite'); } catch {} },
    open: yachaOpen('monster'),
    start: async page => { await tapIf(page, '.mh-result .btn, .mh-result button'); await sleep(600); await tapIf(page, '[data-yb="tab"][data-tab="monster"]'); await sleep(400); await page.click('[data-yb="monster-go"][data-level="easy"]', { force: true, timeout: 8000 }); await sleep(400); await tapIf(page, '[data-confirm="yes"]'); },
    playing: () => !!document.getElementById('yb-arena') && !!document.querySelector('.yb-answer') && !document.querySelector('.mh-result'),
    done: () => !!document.querySelector('.mh-result'),
    act: yachaAct, again: async () => { await sleep(1500); },
    exit: async page => { await tapIf(page, '.mh-result .btn, .mh-result button'); await sleep(500); await page.click('nav.bottom-nav [data-go="home"]', { force: true, timeout: 8000 }).catch(() => {}); }
  });
}
