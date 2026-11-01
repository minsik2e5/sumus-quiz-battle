// V13.206 · V13.208 검사: 놀이터 메뉴(public/modules/playground-menu.js).
//   V13.208: 위쪽 탭 4개(미니게임 · 코인 승부 · 상점 · 기록)를 누르면 게임 카드가 바로 나온다(큰 카드 단계 없음). 게임 카드는 지금 쓰는 그대로.
//   운영에도 켜져 있다(V13.207). 마지막 탭은 localStorage에 기억(예전 '게임' 탭 기록은 옮기고, 막혀 있어도 안 깨진다).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { PG_MENU_LIVE, pgMenuOn, pgRead, pgWrite, playgroundHtml, menuIcon, todayLeft, bestRows, PG_TABS } from '../public/modules/playground-menu.js';

const source = path => readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8');
const memStore = () => { const m = new Map(); return { getItem: k => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)) }; };
const brokenStore = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };

export async function runPlaygroundMenuChecks(assert) {
  // 1) 켜지는 곳: V13.207부터 운영에도(PG_MENU_LIVE). 스위치를 끄면 테스트 앱 · 로컬만(코드에 그대로 남아 있다).
  assert(PG_MENU_LIVE === true && pgMenuOn({ hostname: 'sumus-voca.minsik2e5.workers.dev' }) && pgMenuOn({ hostname: 'sumus-voca-test.minsik2e5.workers.dev' }) && pgMenuOn(undefined)
    && source('../public/modules/playground-menu.js').includes('if (PG_MENU_LIVE) return true;') && source('../public/modules/playground-menu.js').includes('TEST_HOST.test(host)'),
    'V13.207 놀이터 메뉴는 운영에도 켠다(PG_MENU_LIVE, 끄면 테스트 앱 · 로컬만)');

  // 2) 기억: 탭을 저장하고 다시 읽는다. V13.206 기록({ tab: 'game', sub })은 미니게임 · 코인 승부로 옮기고, 이상한 값 · 막힌 저장소는 미니게임 탭.
  {
    const s = memStore();
    pgWrite({ tab: 'tajja' }, s);
    const a = pgRead(s);
    pgWrite({ tab: 'records' }, s);
    const b = pgRead(s);
    s.setItem('sumus-pg-menu', '{oops');
    const c = pgRead(s);
    s.setItem('sumus-pg-menu', JSON.stringify({ tab: 'hack' }));
    const d = pgRead(s);
    const old = sub => { s.setItem('sumus-pg-menu', JSON.stringify({ tab: 'game', sub })); return pgRead(s).tab; };
    let threw = false; try { pgWrite({ tab: 'shop' }, brokenStore); } catch { threw = true; }
    assert(a.tab === 'tajja' && b.tab === 'records' && c.tab === 'arcade' && d.tab === 'arcade' && pgRead(brokenStore).tab === 'arcade' && !threw && pgRead(null).tab === 'arcade'
      && old('tajja') === 'tajja' && old('market') === 'tajja' && old('arcade') === 'arcade' && old('hub') === 'arcade' && s.getItem('sumus-pg-menu') !== null,
      'V13.208 마지막 탭은 localStorage(try/catch)로 기억하고, 예전 게임 탭 기록은 미니게임 · 코인 승부로 옮긴다');
  }

  // 3) 화면: 위쪽 탭 4개(남은 판 수) · PLAYGROUND · 코인 지갑 · 탭 요약 카드 · 게임 카드 바로 · 교실 게임 참가는 모든 탭.
  {
    const A = rewards => ({ data: { rewards, stats: { points_balance: 1200 } } });
    const o = (extra = {}) => ({ balance: 1200, yabawi: true, art: new Set(), games: () => '<i id="GAMES"></i>', party: () => '<i id="PARTY"></i>', tajja: () => '<i id="TAJJA"></i>',
      market: () => '<i id="MARKET"></i>', shop: () => '<i id="SHOP"></i>', collection: () => '<i id="BOOK"></i>', ...extra });
    const r = { match: { left: 4, best: 23456 }, timing: { left: 2, best: 40, streak_best: 3 }, lucky: { left: 7 }, rps: { left: 5, best: 2 }, yabawi: { left: 5, best: 1 }, market_open: false };
    const view = (tab, rr = r, extra) => playgroundHtml(A(rr), { tab }, o(extra));
    const arcade = view('arcade'), tajja = view('tajja'), shop = view('shop'), rec = view('records');
    assert(PG_TABS.map(([, label]) => label).join() === '미니게임,코인 승부,상점,기록'
      && [arcade, tajja, shop, rec].every(h => h.includes('study-tabs-v1368 pg-tabs') && h.includes('PLAYGROUND') && h.includes('<h1>놀이터</h1>') && h.includes('data-action="coins"') && h.endsWith('<i id="PARTY"></i>') && !h.includes('data-pg="') && !h.includes('study-hub-card'))
      && arcade.includes('data-pg-tab="arcade" class="selected" aria-pressed="true"') && arcade.includes('aria-label="남은 판 6">6<') && arcade.includes('aria-label="남은 판 10">10<') && arcade.includes('aria-label="남은 판 7">7<'),
      'V13.208 위쪽 탭 4개(미니게임 · 코인 승부 · 상점 · 기록, 탭 옆 남은 판 수), 모든 탭에 PLAYGROUND · 코인 지갑 · 교실 게임 참가, 큰 카드 단계 없음');
    assert(arcade.includes('id="GAMES"') && arcade.includes('오늘의 미니게임') && arcade.includes('오늘 남은 판 6판') && arcade.includes('짝 맞추기 4 · 10초 맞추기 2') && !arcade.includes('id="TAJJA"')
      && tajja.includes('id="TAJJA"') && tajja.includes('오늘 남은 판 10판') && tajja.includes('가위바위보 5 · 야바위 5 · 증권거래소 닫힘') && !tajja.includes('id="MARKET"')
      && view('tajja', { ...r, market_open: true }).includes('id="MARKET"') && view('tajja', { ...r, market_open: true }).includes('증권거래소 열림')
      && !view('tajja', r, { yabawi: false }).includes('야바위') && todayLeft(r, false, 'tajja').length === 1 && todayLeft({}, false, 'arcade').length === 2 && todayLeft(r, true).length === 5,
      'V13.208 탭을 누르면 그 탭 게임 카드가 바로, 요약 카드는 그 탭 게임만 센다(증권거래소는 열릴 때 코인 승부에, 야바위는 yabawiOn()일 때만)');
    assert(shop.includes('id="SHOP"') && shop.includes('오늘의 상점') && shop.includes('코인 뽑기 7') && rec.includes('id="BOOK"') && rec.includes('게임별 최고 기록') && rec.includes('±0.04초') && rec.includes('2연승')
      && bestRows(r, true).length === 8 && bestRows({}, false).length === 7 && view('arcade', { match: { left: 0 }, timing: { left: 0 } }).includes('오늘 판을 다 했어요!'),
      'V13.208 상점 탭(코인 뽑기 · 알 상점) · 기록 탭(게임별 최고 기록 + 도감)');
    assert(view('tajja', r, { art: new Set(['menu-tajja']) }).includes('/assets/yabawi/menu-tajja.webp') && menuIcon('menu-tajja', '🃏', new Set()).includes('🃏') && !menuIcon('menu-arcade', '🎮', new Set()).includes('<img'),
      'V13.208 탭 요약 카드 아이콘은 그림이 있을 때만(없으면 이모지)');
  }

  // 4) 연결: 운영 화면 줄은 그대로 두고, 테스트 호스트만 메뉴로 그린다. CSS 묶음 · 번호.
  {
    const arcade = source('../public/modules/arcade.js'), build = source('./build-assets.mjs'), css = source('../public/v13206.css'), pkg = JSON.parse(source('../package.json'));
    assert(arcade.includes(`if (pgMenuOn()) return '<div data-arcade data-arcade-view="menu" data-arcade-menu="1"></div>';`) && arcade.includes('if (current.el.dataset.arcadeMenu) { current.el.innerHTML = menuHtml(current.A); return; }')
      && arcade.includes('${machineHtml(current.A)}${shopHtml(current.A)}${rpsCard(') && arcade.includes('${gamesSection(A, { fishing: FISHING_ART, match: MATCH_ART, hunt: HUNT_ART, claw: CLAW_ART })}')
      && arcade.includes('pgWrite(pg);') && arcade.includes("event.target.closest('[data-pg-tab]')") && arcade.includes("pg = { tab: t.dataset.pgTab };"),
      'V13.206 운영 놀이터(예전 화면)는 그대로, 테스트 호스트만 메뉴');
    assert(build.includes('"v13206.css"') && css.includes('.pg-tabs{grid-template-columns:repeat(4,1fr)!important}') && css.includes('.pg-tab-left') && !css.includes('.pg-hub') && css.includes('.pg-best') && Number(pkg.version.split('.')[1]) >= 208, 'V13.208 CSS(탭 4칸 · 남은 판 · 큰 카드 스타일 지움)와 버전');
  }
}
