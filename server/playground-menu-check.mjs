// V13.206 검사: 놀이터 메뉴(public/modules/playground-menu.js).
//   학습 탭처럼 위쪽 탭(게임 · 상점 · 기록) + 큰 카드(미니게임 · 코인 승부 · 증권거래소). 큰 카드 안은 지금 쓰는 게임 카드 그대로.
//   테스트 앱 · 로컬에서만 켜고 운영 놀이터는 예전 화면 그대로. 마지막 탭 · 하위 화면은 localStorage에 기억(막혀 있어도 안 깨진다).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { pgMenuOn, pgRead, pgWrite, playgroundHtml, menuIcon, todayLeft, bestRows, PG_TABS } from '../public/modules/playground-menu.js';

const source = path => readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8');
const memStore = () => { const m = new Map(); return { getItem: k => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)) }; };
const brokenStore = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };

export async function runPlaygroundMenuChecks(assert) {
  // 1) 켜지는 곳: 테스트 앱 · 로컬만. 운영(sumus-voca.*) · 다른 곳은 예전 놀이터.
  assert(pgMenuOn({ hostname: 'sumus-voca-test.minsik2e5.workers.dev' }) && pgMenuOn({ hostname: 'localhost' }) && pgMenuOn({ hostname: '127.0.0.1' })
    && !pgMenuOn({ hostname: 'sumus-voca.minsik2e5.workers.dev' }) && !pgMenuOn({ hostname: 'sumus.example.com' }) && !pgMenuOn(undefined),
    'V13.206 놀이터 메뉴는 테스트 앱 · 로컬에서만 켠다');

  // 2) 기억: 탭 · 하위 화면을 저장하고 다시 읽는다. 이상한 값 · 막힌 저장소는 게임 탭 첫 화면.
  {
    const s = memStore();
    pgWrite({ tab: 'game', sub: 'tajja' }, s);
    const a = pgRead(s);
    pgWrite({ tab: 'records', sub: 'tajja' }, s);
    const b = pgRead(s);
    s.setItem('sumus-pg-menu', '{oops');
    const c = pgRead(s);
    s.setItem('sumus-pg-menu', JSON.stringify({ tab: 'hack', sub: 'x' }));
    const d = pgRead(s);
    let threw = false; try { pgWrite({ tab: 'shop', sub: 'hub' }, brokenStore); } catch { threw = true; }
    assert(a.tab === 'game' && a.sub === 'tajja' && b.tab === 'records' && b.sub === 'hub' && c.tab === 'game' && c.sub === 'hub'
      && d.tab === 'game' && d.sub === 'hub' && pgRead(brokenStore).tab === 'game' && !threw && pgRead(null).sub === 'hub',
      'V13.206 마지막 탭 · 하위 화면은 localStorage(try/catch)로 기억한다');
  }

  // 3) 화면: 학습 탭과 같은 틀(study-tabs-v1368 · study-hub-card · study-daily-v1371 · study-back).
  {
    const A = rewards => ({ data: { rewards, stats: { points_balance: 1200 } } });
    const o = (extra = {}) => ({ balance: 1200, yabawi: true, art: new Set(), games: () => '<i id="GAMES"></i>', party: () => '<i id="PARTY"></i>', tajja: () => '<i id="TAJJA"></i>',
      market: () => '<i id="MARKET"></i>', shop: () => '<i id="SHOP"></i>', collection: () => '<i id="BOOK"></i>', ...extra });
    const r = { match: { left: 4, best: 23456 }, timing: { left: 2, best: 40, streak_best: 3 }, lucky: { left: 7 }, rps: { left: 5, best: 2 }, yabawi: { left: 5, best: 1 }, market_open: false };
    const hub = playgroundHtml(A(r), { tab: 'game', sub: 'hub' }, o());
    assert(PG_TABS.map(([, label]) => label).join() === '게임,상점,기록' && hub.includes('study-tabs-v1368') && hub.includes('data-pg-tab="game" class="selected" aria-pressed="true"')
      && hub.includes('PLAYGROUND') && hub.includes('<h1>놀이터</h1>') && hub.includes('study-daily-v1371') && hub.includes('오늘 남은 판 23판')
      && hub.includes('data-pg="arcade"') && hub.includes('>ARCADE<') && hub.includes('낚시 · 짝 맞추기 · 몬스터 사냥 · 인형뽑기 · 10초 맞추기')
      && hub.includes('data-pg="tajja"') && hub.includes('>TAJJA<') && hub.includes('가위바위보 · 야바위') && !hub.includes('data-pg="market"')
      && hub.includes('id="PARTY"') && hub.includes('data-action="coins"') && !hub.includes('id="GAMES"'),
      'V13.206 게임 탭 첫 화면: 위쪽 탭 · PLAYGROUND · 오늘 남은 판 · 미니게임 · 코인 승부 카드 · 교실 게임 참가');
    const open = playgroundHtml(A({ ...r, market_open: true }), { tab: 'game', sub: 'hub' }, o({ yabawi: false }));
    assert(open.includes('data-pg="market"') && open.includes('>MARKET<') && !open.includes('가위바위보 · 야바위') && !open.includes('야바위 5') && todayLeft(r, false).length === 4 && todayLeft({}, false).length === 2,
      'V13.206 증권거래소 카드는 열릴 때만, 야바위는 yabawiOn()일 때만');
    const games = playgroundHtml(A(r), { tab: 'game', sub: 'arcade' }, o()), tajja = playgroundHtml(A(r), { tab: 'game', sub: 'tajja' }, o());
    const market = playgroundHtml(A({ ...r, market_open: true }), { tab: 'game', sub: 'market' }, o()), closed = playgroundHtml(A(r), { tab: 'game', sub: 'market' }, o());
    assert([games, tajja, market, closed].every(h => h.includes('class="study-back" data-pg="hub"') && h.includes(' 놀이터</button>') && !h.includes('study-tabs-v1368'))
      && games.includes('id="GAMES"') && tajja.includes('id="TAJJA"') && market.includes('id="MARKET"') && !closed.includes('id="MARKET"') && closed.includes('닫혀 있어요'),
      'V13.206 큰 카드 안은 지금 쓰는 게임 카드 그대로 + 놀이터로 돌아가기');
    const shop = playgroundHtml(A(r), { tab: 'shop', sub: 'hub' }, o()), rec = playgroundHtml(A(r), { tab: 'records', sub: 'hub' }, o());
    assert(shop.includes('id="SHOP"') && shop.includes('data-pg-tab="shop" class="selected"') && !shop.includes('pg-shop-art')
      && playgroundHtml(A(r), { tab: 'shop', sub: 'hub' }, o({ art: new Set(['menu-shop']) })).includes('/assets/yabawi/menu-shop.webp')
      && rec.includes('id="BOOK"') && rec.includes('게임별 최고 기록') && rec.includes('±0.04초') && rec.includes('2연승') && bestRows(r, true).length === 8 && bestRows({}, false).length === 7,
      'V13.206 상점 탭(코인 뽑기 · 알 상점) · 기록 탭(게임별 최고 기록 + 도감)');
    assert(menuIcon('menu-tajja', '🃏', new Set(['menu-tajja'])).includes('src="/assets/yabawi/menu-tajja.webp"') && menuIcon('menu-tajja', '🃏', new Set()).includes('🃏') && !menuIcon('menu-arcade', '🎮', new Set()).includes('<img'),
      'V13.206 메뉴 아이콘은 그림이 있을 때만(없으면 이모지)');
  }

  // 4) 연결: 운영 화면 줄은 그대로 두고, 테스트 호스트만 메뉴로 그린다. CSS 묶음 · 번호.
  {
    const arcade = source('../public/modules/arcade.js'), build = source('./build-assets.mjs'), css = source('../public/v13206.css'), pkg = JSON.parse(source('../package.json'));
    assert(arcade.includes(`if (pgMenuOn()) return '<div data-arcade data-arcade-view="menu" data-arcade-menu="1"></div>';`) && arcade.includes('if (current.el.dataset.arcadeMenu) { current.el.innerHTML = menuHtml(current.A); return; }')
      && arcade.includes('${machineHtml(current.A)}${shopHtml(current.A)}${rpsCard(') && arcade.includes('${gamesSection(A, { fishing: FISHING_ART, match: MATCH_ART, hunt: HUNT_ART, claw: CLAW_ART })}')
      && arcade.includes('pgWrite(pg);') && arcade.includes("event.target.closest('[data-pg-tab], [data-pg]')"),
      'V13.206 운영 놀이터(예전 화면)는 그대로, 테스트 호스트만 메뉴');
    assert(build.includes('"v13206.css"') && css.includes('.pg-hub') && css.includes('.pg-best') && pkg.version.split('.').map(Number)[1] >= 206, 'V13.206 CSS 묶음과 버전');
  }
}
