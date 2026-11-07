// V13.206 · V13.208 검사: 놀이터 메뉴(public/modules/playground-menu.js).
//   V13.209: 위쪽 탭(V13.208)을 없애고 큰 카드 4개(미니게임 · 코인 승부 · 상점 · 기록, 학습 탭 카드 모양) + 증권거래소(열릴 때).
//   카드를 누르면 '← 놀이터'가 있는 화면. 게임 카드는 지금 쓰는 그대로. 마지막 화면은 localStorage에 기억(예전 탭 기록도 옮긴다).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { PG_MENU_LIVE, pgMenuOn, pgRead, pgWrite, playgroundHtml, menuIcon, todayLeft, bestRows, PG_VIEWS, rpsEntry, yabawiEntry } from '../public/modules/playground-menu.js';

const source = path => readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8');
const memStore = () => { const m = new Map(); return { getItem: k => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)) }; };
const brokenStore = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };

export async function runPlaygroundMenuChecks(assert) {
  // 1) 켜지는 곳: V13.207부터 운영에도(PG_MENU_LIVE). 스위치를 끄면 테스트 앱 · 로컬만(코드에 그대로 남아 있다).
  assert(PG_MENU_LIVE === true && pgMenuOn({ hostname: 'sumus-voca.minsik2e5.workers.dev' }) && pgMenuOn({ hostname: 'sumus-voca-test.minsik2e5.workers.dev' }) && pgMenuOn(undefined)
    && source('../public/modules/playground-menu.js').includes('if (PG_MENU_LIVE) return true;') && source('../public/modules/playground-menu.js').includes('TEST_HOST.test(host)'),
    'V13.207 놀이터 메뉴는 운영에도 켠다(PG_MENU_LIVE, 끄면 테스트 앱 · 로컬만)');

  // 2) 기억: 화면을 저장하고 다시 읽는다. 예전 기록(V13.208 { tab } · V13.206 { tab: 'game', sub })은 그 화면으로, 이상한 값 · 막힌 저장소는 카드 화면.
  {
    const s = memStore();
    pgWrite({ view: 'tajja' }, s);
    const a = pgRead(s);
    pgWrite({ view: 'hub' }, s);
    const b = pgRead(s);
    s.setItem('sumus-pg-menu', '{oops');
    const c = pgRead(s);
    s.setItem('sumus-pg-menu', JSON.stringify({ view: 'hack' }));
    const d = pgRead(s);
    const old = v => { s.setItem('sumus-pg-menu', JSON.stringify(v)); return pgRead(s).view; };
    let threw = false; try { pgWrite({ view: 'shop' }, brokenStore); } catch { threw = true; }
    assert(a.view === 'tajja' && b.view === 'hub' && c.view === 'hub' && d.view === 'hub' && pgRead(brokenStore).view === 'hub' && !threw && pgRead(null).view === 'hub'
      && old({ tab: 'records' }) === 'records' && old({ tab: 'game', sub: 'market' }) === 'market' && old({ tab: 'game', sub: 'hub' }) === 'hub' && old({ tab: 'game', sub: 'x' }) === 'hub',
      'V13.209 마지막 화면은 localStorage(try/catch)로 기억하고, 예전 탭 기록은 그 화면으로 옮긴다(이상하면 카드 화면)');
  }

  // 3) 화면: 큰 카드 4개 + 증권거래소(열릴 때), 카드를 누르면 '← 놀이터' 화면.
  {
    const A = rewards => ({ data: { rewards, stats: { points_balance: 1200 } } });
    const o = (extra = {}) => ({ balance: 1200, yabawi: true, art: new Set(), games: () => '<i id="GAMES"></i>', party: () => '<i id="PARTY"></i>', tajja: () => '<i id="TAJJA"></i>',
      market: () => '<i id="MARKET"></i>', shop: () => '<i id="SHOP"></i>', collection: () => '<i id="BOOK"></i>', rps: () => '<i id="RPS"></i>', yabawiGame: () => '<i id="YW"></i>', ...extra });
    const r = { match: { left: 4, best: 23456 }, timing: { left: 2, best: 40, streak_best: 3 }, lucky: { left: 7 }, rps: { left: 5, best: 2 }, yabawi: { left: 5, best: 1 }, market_open: false };
    const view = (v, rr = r, extra) => playgroundHtml(A(rr), { view: v }, o(extra));
    const hub = view('hub'), arcade = view('arcade'), tajja = view('tajja'), shop = view('shop'), rec = view('records');
    const cards = [...hub.matchAll(/class="study-hub-card pg-card pg-(\w+)" data-pg="(\w+)"/g)].map(m => m[1]);
    assert(cards.join() === 'arcade,tajja,shop,records' && hub.includes('study-hub-grid study-hub-simple pg-hub') && hub.includes('PLAYGROUND') && hub.includes('<h1>놀이터</h1>') && hub.includes('data-action="coins"')
      && hub.includes('<h2>미니게임</h2>') && hub.includes('<h2>코인 승부</h2>') && hub.includes('<h2>상점</h2>') && hub.includes('<h2>기록</h2>') && hub.includes('오늘의 놀이터') && hub.includes('오늘 남은 판 23판')
      && hub.includes('오늘 6판 남음') && hub.includes('오늘 10판 남음') && hub.includes('오늘 7판 남음') && hub.includes('/assets/ui/me-records.webp') && hub.endsWith('<i id="PARTY"></i>')
      && !hub.includes('pg-tabs') && !hub.includes('data-pg-tab') && PG_VIEWS.map(([k]) => k).join() === 'arcade,tajja,shop,records,market,rps,yabawi',
      'V13.209 놀이터 첫 화면은 큰 카드 4개(미니게임 · 코인 승부 · 상점 · 기록, 카드마다 오늘 남은 판), 위쪽 탭 없음');
    const mk = view('hub', { ...r, market_open: true });
    assert(mk.includes('data-pg="market"') && !hub.includes('data-pg="market"') && view('market', { ...r, market_open: true }).includes('id="MARKET"') && view('market').includes('닫혀 있어요'),
      'V13.209 증권거래소 카드는 열릴 때만');
    assert([arcade, tajja, shop, rec].every(h => h.includes('class="study-back" data-pg="hub"') && h.includes('놀이터') && h.includes('data-action="coins"'))
      && arcade.includes('id="GAMES"') && arcade.includes('오늘의 미니게임') && arcade.includes('짝 맞추기 4 · 10초 맞추기 2') && !arcade.includes('id="TAJJA"') && arcade.includes('id="PARTY"')
      && tajja.includes('class="ag-big ag-rps"') && tajja.includes('class="ag-big ag-yabawi"') && tajja.includes('가위바위보 5 · 야바위 5') && !view('tajja', r, { yabawi: false }).includes('ag-yabawi')
      && shop.includes('id="SHOP"') && shop.includes('코인 뽑기 7') && rec.includes('id="BOOK"') && rec.includes('게임별 최고 기록') && rec.includes('±0.04초')
      && bestRows(r, true).length === 9 && bestRows({}, false).length === 8 && /* V13.222 벽 통과 줄 추가 */ todayLeft(r, false, 'tajja').length === 1 && todayLeft(r, true).length === 5,
      "V13.209 카드를 누르면 '← 놀이터' 화면: 미니게임 · 코인 승부(야바위는 켜졌을 때만) · 상점 · 기록(최고 기록 + 도감)");
    assert(view('hub', r, { art: new Set(['menu-tajja']) }).includes('/assets/yabawi/menu-tajja.webp') && menuIcon('menu-tajja', '🃏', new Set()).includes('🃏') && !menuIcon('menu-arcade', '🎮', new Set()).includes('<img'),
      'V13.209 카드 그림은 있을 때만(없으면 이모지)');
  }

  // V13.210 코인 승부도 미니게임처럼 큰 입구 카드(그림 + 제목 + 내 기록 3칸 + 들어가기), 들어가면 지금 게임 카드 그대로('← 코인 승부').
  {
    const r = { rps: { left: 3, daily: 5, best: 4, stats: { wins: 9 }, live: null }, yabawi: { left: 2, daily: 5, best: 1, stats: { wins: 6 }, live: { pot: 20 } } };
    const A = { data: { rewards: r, stats: { points_balance: 500 } } };
    const o = { balance: 500, yabawi: true, art: new Set(), games: () => '', party: () => '', market: () => '', shop: () => '', collection: () => '', rps: () => '<i id="RPS"></i>', yabawiGame: () => '<i id="YW"></i>' };
    const tajja = playgroundHtml(A, { view: 'tajja' }, o), rps = playgroundHtml(A, { view: 'rps' }, o), yw = playgroundHtml(A, { view: 'yabawi' }, o);
    const re = rpsEntry(r.rps, new Set()), ye = yabawiEntry(r.yabawi, new Set(), new Set(['card-hero']));
    assert(tajja.includes('data-pg="rps"') && tajja.includes('data-pg="yabawi"') && !tajja.includes('id="RPS"') && !tajja.includes('id="YW"')
      && re.includes('<strong>가위바위보</strong>') && re.includes('4연승') && re.includes('<b>9</b>') && re.includes('/assets/rps/robot-ready.webp') && re.includes('>들어가기<')
      && ye.includes('<strong>야바위</strong>') && ye.includes('/assets/yabawi/card-hero.webp') && ye.includes('하던 판 이어서') && ye.includes('aria-label="오늘 남은 판 2번"')
      && rps.includes('id="RPS"') && rps.includes('class="study-back" data-pg="tajja"') && rps.includes('코인 승부') && yw.includes('id="YW"') && yw.includes('data-pg="tajja"')
      && !playgroundHtml(A, { view: 'yabawi' }, { ...o, yabawi: false }).includes('id="YW"'),
      'V13.210 코인 승부: 가위바위보 · 야바위 큰 입구 카드(그림 · 제목 · 오늘 판 · 최고 연승 · 이긴 판 · 들어가기), 들어가면 게임 카드와 \'← 코인 승부\'');
    assert(rpsEntry({}, new Set(['rps'])).includes('/assets/rps/entry.webp') && yabawiEntry({}, new Set(['yabawi']), new Set()).includes('/assets/yabawi/entry.webp') && !yabawiEntry({}, new Set(), new Set()).includes('<img'),
      'V13.210 그림 63(입구 그림)이 들어오면 그 그림, 없으면 지금 그림(로봇 · 곽 사장 카드 그림)');
    const games = source('../public/modules/arcade-games.js'), build = source('./build-assets.mjs'), css = source('../public/v13210.css'), R = '../docs/asset-requests/runner/';
    assert(games.includes("art?.entry?.has('timing') ? '<img class=\"ag-big-bg\" src=\"/assets/timing/entry.webp\"") && source('../public/modules/arcade.js').includes('claw: CLAW_ART, entry: ENTRY_ART }') && build.includes("['timing', 'rps', 'yabawi', 'wall'].filter(g => existsSync(resolve(root, `public/assets/${g}/entry.webp`)))") && build.includes('"v13209.css",\n  "v13210.css"'),
      'V13.210 입구 그림 게이트(ENTRY_ART): 10초 맞추기 · 가위바위보 · 야바위');
    assert(css.includes('.ag-timing{background:') && css.includes('.has-card-hero .yw-card-stage{height:auto;aspect-ratio:9/5;max-height:360px') && css.includes('.ag-yw-pic{object-position:center 22%}'),
      'V13.210 10초 맞추기 카드 아래가 어두운 배경(흰 글씨가 보이게), 야바위 그림은 그림 비율대로(얼굴이 안 잘리게)');
    const order = source(R + '63-playground-entries.txt'), codex = source(R + 'CODEX_PROMPT_63.md'), map = source(R + 'slice-map.csv'), readme = source(R + 'README.md');
    assert((order.match(/^STYLE REFERENCE — before drawing, open these pictures already in Google Drive/gm) || []).length === 3 && (order.match(/into the folder "SUMUS 놀이터 입구 63 \(Runner용\)", named exactly "63-[123]\.png"/g) || []).length === 3
      && order.includes('WHOLE HEAD AND FACE fully inside the picture') && map.includes('"63-playground-entries.txt","790"') && map.includes('public/assets/timing/entry.webp') && map.includes('public/assets/rps/entry.webp') && map.includes('public/assets/yabawi/entry.webp')
      && codex.includes('PR까지만 만든다. 머지하지 않는다.') && codex.includes('Google Drive는 쓰지 않는다') && readme.includes('19. **놀이터 입구 카드(63)**'),
      'V13.210 그림 주문 63: Drive의 기존 입구 그림을 열어 그림체를 맞추고, Drive 폴더 "SUMUS 놀이터 입구 63 (Runner용)"에 정확한 이름(63-1~3.png)으로 저장. Codex 지시서 · 자리표 · README');
  }

  // 4) 연결 · CSS · 번호.
  {
    const arcade = source('../public/modules/arcade.js'), build = source('./build-assets.mjs'), css = source('../public/v13209.css'), pkg = JSON.parse(source('../package.json'));
    assert(arcade.includes(`if (pgMenuOn()) return '<div data-arcade data-arcade-view="menu" data-arcade-menu="1"></div>';`) && arcade.includes('if (current.el.dataset.arcadeMenu) { current.el.innerHTML = menuHtml(current.A); return; }')
      && arcade.includes("event.target.closest('[data-pg]')") && arcade.includes('pg = { view: t.dataset.pg };') && arcade.includes('pgWrite(pg);') && !arcade.includes('data-pg-tab'),
      'V13.209 놀이터 카드 · 뒤로 가기는 data-pg 하나로');
    assert(build.includes('"v13206.css",\n  "v13209.css"') && css.includes('.pg-hub .pg-shop:before') && css.includes('.pg-hub .pg-records:before') && css.includes('.pg-hub .pg-market{grid-column:1/-1')
      && !source('../public/v13206.css').includes('.pg-tabs') && Number(pkg.version.split('.')[1]) >= 209, 'V13.209 카드 CSS(4색 + 증권거래소 한 줄), 탭 CSS 지움');
  }
}
