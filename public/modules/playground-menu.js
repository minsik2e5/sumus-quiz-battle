// V13.206 놀이터 메뉴: 게임이 많아져서 학습 탭처럼 위쪽 탭(게임 · 상점 · 기록) + 큰 카드(미니게임 · 코인 승부 · 증권거래소)로 묶는다.
// 큰 카드를 누르면 지금 쓰는 게임 카드가 그대로 나오고(카드 · 로직은 그대로) '놀이터'로 돌아가는 버튼이 있다.
// V13.207: 운영에도 켰다(PG_MENU_LIVE). 끄면 테스트 앱(sumus-voca-test.*) · 로컬에서만 켜지고 운영은 arcade.js의 예전 화면.
// 마지막 탭 · 하위 화면은 localStorage(sumus-pg-menu)에 기억한다. 저장이 막혀 있으면 게임 탭 첫 화면.
import { esc, num, icon } from './ui.js';
import { coin } from './emblems.js';
import { TEST_HOST } from './claw-physics.js';
import { YABAWI_ART } from './yabawi-art.js';
import { matchTime } from './match-rules.js';
import { rodOf } from './reel-rules.js';

export const PG_MENU_LIVE = true;
export function pgMenuOn(loc = globalThis.location) {
  if (PG_MENU_LIVE) return true;
  const host = String(loc?.hostname || '');
  return TEST_HOST.test(host) || /^(localhost|127\.0\.0\.1)$/.test(host);
}

export const PG_TABS = [['game', '게임'], ['shop', '상점'], ['records', '기록']];
export const PG_SUBS = ['hub', 'arcade', 'tajja', 'market'];
const PG_KEY = 'sumus-pg-menu';
export function pgRead(store = globalThis.localStorage) {
  let saved = {};
  try { saved = JSON.parse(store?.getItem(PG_KEY) || '{}') || {}; } catch {}
  const tab = PG_TABS.some(([key]) => key === saved.tab) ? saved.tab : 'game';
  const sub = tab === 'game' && PG_SUBS.includes(saved.sub) ? saved.sub : 'hub';
  return { tab, sub };
}
export function pgWrite(state, store = globalThis.localStorage) {
  try { store?.setItem(PG_KEY, JSON.stringify({ tab: state.tab, sub: state.sub })); } catch {}
}

// 메뉴 아이콘: 그림(public/assets/yabawi/menu-*.webp)이 있으면 쓰고, 없으면 이모지(그림 게이트는 build-assets.mjs가 만든 YABAWI_ART).
export function menuIcon(name, fallback, art = YABAWI_ART) {
  return art.has(name) ? `<img class="pg-ico" src="/assets/yabawi/${name}.webp" alt="" width="68" height="68" draggable="false" decoding="async">` : `<i class="pg-emoji">${fallback}</i>`;
}

function tabs(state) {
  return `<div class="segment study-tabs-v1368 pg-tabs" role="group" aria-label="놀이터 메뉴">${PG_TABS.map(([tab, label]) => `<button type="button" data-pg-tab="${tab}" class="${state.tab === tab ? 'selected' : ''}" aria-pressed="${state.tab === tab}">${label}</button>`).join('')}</div>`;
}
const heading = (eyebrow, title) => `<div class="page-heading study-simple-heading premium-page-heading pg-heading"><span class="premium-eyebrow">${eyebrow}</span><h1>${title}</h1></div>`;
const wallet = balance => `<button type="button" class="arcade-wallet" data-action="coins" aria-label="코인 지갑 열기"><span>${coin()}<b id="ga-balance">${num(balance)}</b> 코인</span><small>코인 지갑 ${icon('chevron')}</small></button>`;
const subhead = (pill, title) => `<div class="study-subhead"><button type="button" class="study-back" data-pg="hub">${icon('back')} 놀이터</button><span class="pill green">${pill}</span></div>
  <div class="page-heading grammar-heading pg-heading"><h1>${title}</h1></div>`;

// 오늘 남은 판: 학습의 '오늘의 추천 학습' 자리. 누르면 미니게임으로 간다.
export function todayLeft(r, yabawi) {
  const rows = [
    ['짝 맞추기', r.match?.left ?? 5],
    ['10초 맞추기', r.timing?.left ?? 3],
    ['코인 뽑기', r.lucky?.left],
    ['가위바위보', r.rps?.left],
  ];
  if (yabawi) rows.push(['야바위', r.yabawi?.left]);
  return rows.filter(([, left]) => left != null).map(([name, left]) => [name, Math.max(0, Number(left) || 0)]);
}
function todayCard(r, yabawi) {
  const rows = todayLeft(r, yabawi), total = rows.reduce((n, [, left]) => n + left, 0);
  return `<button type="button" class="home-next-v1358 study-daily-v1371 pg-today${total ? '' : ' is-done-v1363'}" data-pg="arcade"><span><small>오늘의 놀이터</small><strong>${total ? `오늘 남은 판 ${num(total)}판` : '오늘 판을 다 했어요!'}</strong><em>${rows.map(([name, left]) => `${name} ${num(left)}`).join(' · ')}</em></span><b>${total ? '놀러 가기' : '구경하기'} ${icon('arrow')}</b></button>`;
}

function hubCard(sub, pill, title, line, ico) {
  return `<button type="button" class="study-hub-card pg-card pg-${sub}" data-pg="${sub}">
      <span class="study-hub-icon">${ico}</span>
      <div><span class="pill${sub === 'arcade' ? ' green' : ''}">${pill}</span><h2>${title}</h2><small class="pg-card-sub">${line}</small></div>
      <span class="study-hub-arrow">${icon('arrow')}</span>
    </button>`;
}
function hub(A, o) {
  const r = A.data.rewards || {};
  return `${heading('PLAYGROUND', '놀이터')}
  ${wallet(o.balance)}
  ${todayCard(r, o.yabawi)}
  <div class="study-hub-grid study-hub-simple pg-hub">
    ${hubCard('arcade', 'ARCADE', '미니게임', '낚시 · 짝 맞추기 · 몬스터 사냥 · 인형뽑기 · 10초 맞추기', menuIcon('menu-arcade', '🎮', o.art))}
    ${hubCard('tajja', 'TAJJA', '코인 승부', o.yabawi ? '가위바위보 · 야바위' : '가위바위보', menuIcon('menu-tajja', '🃏', o.art))}
    ${r.market_open ? hubCard('market', 'MARKET', '증권거래소', '문법 주식을 사고팔아요', '<i class="pg-emoji">📈</i>') : ''}
  </div>
  ${o.party()}`;
}

// 기록 탭: 게임별 최고 기록 + 도감(모은 꾸미기).
export function bestRows(r, yabawi) {
  const m = r.match || {}, t = r.timing || {}, h = r.hunt || {}, c = r.claw || {}, f = r.reel || {};
  const rows = [
    ['🃏', '짝 맞추기', '내 최고', m.best ? matchTime(m.best) : '—'],
    ['🎯', '10초 맞추기', '내 최고', t.best == null ? '—' : `±${(t.best / 1000).toFixed(2)}초`],
    ['🔥', '10초 맞추기', '연속 완벽', `${num(t.streak_best || 0)}번`],
    ['📖', '몬스터 사냥', '도감', `${num(h.kinds || 0)}/${num(h.all || 34)}`],
    ['🧸', '인형뽑기', '도감', `${num(c.kinds || 0)}/${num(c.all || 12)}`],
    ['🎣', '낚시터', '낚싯대', `${rodOf(f.rod).level}단계`],
    ['✊', '가위바위보', '최고 연승', `${num(r.rps?.best || 0)}연승`],
  ];
  if (yabawi) rows.push(['🥤', '야바위', '최고 연승', `${num(r.yabawi?.best || 0)}연승`]);
  return rows;
}
function records(A, o) {
  return `${heading('MY RECORD', '놀이터 기록')}
  <section class="ga-card pg-best"><div class="ga-book-head"><h2>게임별 최고 기록</h2></div>
    <ul>${bestRows(A.data.rewards || {}, o.yabawi).map(([ico, game, what, value]) => `<li><i aria-hidden="true">${ico}</i><span><b>${esc(game)}</b><small>${esc(what)}</small></span><strong>${esc(value)}</strong></li>`).join('')}</ul>
  </section>
  <h2 class="ag-head">도감</h2>
  ${o.collection()}`;
}

// o: { balance, yabawi, art, games(), party(), tajja(), market(), shop(), collection() } — 게임 카드는 arcade.js가 넘긴다.
export function playgroundHtml(A, state, o) {
  const marketOpen = !!A.data.rewards?.market_open;
  if (state.tab === 'shop') return `${tabs(state)}${heading('SHOP', '상점')}${wallet(o.balance)}${o.art.has('menu-shop') ? `<div class="pg-shop-art" aria-hidden="true">${menuIcon('menu-shop', '', o.art)}</div>` : ''}${o.shop()}`;
  if (state.tab === 'records') return `${tabs(state)}${records(A, o)}`;
  if (state.sub === 'arcade') return `${subhead('ARCADE', '미니게임')}<section class="ag-group pg-games" aria-label="미니게임">${o.games()}</section>`;
  if (state.sub === 'tajja') return `${subhead('TAJJA', '코인 승부')}${o.tajja()}`;
  if (state.sub === 'market') return `${subhead('MARKET', '증권거래소')}${marketOpen ? o.market() : '<section class="ga-card"><p class="ga-note">지금은 증권거래소가 닫혀 있어요.</p></section>'}`;
  return `${tabs(state)}${hub(A, o)}`;
}
