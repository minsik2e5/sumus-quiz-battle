// V13.206 놀이터 메뉴: 게임이 많아져서 학습 탭처럼 묶는다.
// V13.208: 위쪽 탭 4개로 바꿨다가, V13.209: 쌤 요청대로 다시 큰 카드(학습 탭 카드 모양) 4개: 미니게임 · 코인 승부 · 상점 · 기록(+ 증권거래소는 열릴 때).
//   카드마다 오늘 남은 판, 카드를 누르면 '← 놀이터'가 있는 화면(요약 카드 + 게임 카드). 교실 게임 참가는 카드 화면 · 미니게임 맨 아래.
// V13.207: 운영에도 켰다(PG_MENU_LIVE). 끄면 테스트 앱(sumus-voca-test.*) · 로컬에서만 켜지고 운영은 arcade.js의 예전 화면.
// 마지막 화면은 localStorage(sumus-pg-menu)에 기억한다(예전 탭 기록도 옮긴다). 저장이 막혀 있으면 카드 화면.
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

// V13.209 큰 카드 4개(미니게임 · 코인 승부 · 상점 · 기록)와 증권거래소(열릴 때). 위쪽 탭은 없다(학습 탭의 단어 학습 · 어법·어휘 카드와 같은 모양).
export const PG_VIEWS = [['arcade', '미니게임'], ['tajja', '코인 승부'], ['shop', '상점'], ['records', '기록'], ['market', '증권거래소']];
const PG_KEY = 'sumus-pg-menu';
const isView = v => v === 'hub' || PG_VIEWS.some(([key]) => key === v);
export function pgRead(store = globalThis.localStorage) {
  let saved = {};
  try { saved = JSON.parse(store?.getItem(PG_KEY) || '{}') || {}; } catch {}
  if (isView(saved.view)) return { view: saved.view };
  // 예전 기록: V13.208 { tab }(위쪽 탭) · V13.206 { tab: 'game', sub }은 그 화면으로 옮기고, 나머지는 카드 화면.
  if (saved.tab === 'game') return { view: isView(saved.sub) ? saved.sub : 'hub' };
  if (isView(saved.tab)) return { view: saved.tab };
  return { view: 'hub' };
}
export function pgWrite(state, store = globalThis.localStorage) {
  try { store?.setItem(PG_KEY, JSON.stringify({ view: state.view })); } catch {}
}

// 메뉴 아이콘: 그림(public/assets/yabawi/menu-*.webp)이 있으면 쓰고, 없으면 이모지(그림 게이트는 build-assets.mjs가 만든 YABAWI_ART).
export function menuIcon(name, fallback, art = YABAWI_ART) {
  return art.has(name) ? `<img class="pg-ico" src="/assets/yabawi/${name}.webp" alt="" width="68" height="68" draggable="false" decoding="async">` : `<i class="pg-emoji">${fallback}</i>`;
}

// 오늘 남은 판: 탭마다 그 탭 게임만 센다(기록 탭은 없음). tab 'all'은 전체.
export function todayLeft(r, yabawi, tab = 'all') {
  const rows = {
    arcade: [['짝 맞추기', r.match?.left ?? 5], ['10초 맞추기', r.timing?.left ?? 3]],
    tajja: [['가위바위보', r.rps?.left], ...(yabawi ? [['야바위', r.yabawi?.left]] : [])],
    shop: [['코인 뽑기', r.lucky?.left]],
    records: []
  };
  const pick = tab === 'all' ? [...rows.arcade, ...rows.shop, ...rows.tajja] : rows[tab] || [];
  return pick.filter(([, left]) => left != null).map(([name, left]) => [name, Math.max(0, Number(left) || 0)]);
}
const total = rows => rows.reduce((n, [, left]) => n + left, 0);

const heading = (eyebrow, title) => `<div class="page-heading study-simple-heading premium-page-heading pg-heading"><span class="premium-eyebrow">${eyebrow}</span><h1>${title}</h1></div>`;
const wallet = balance => `<button type="button" class="arcade-wallet" data-action="coins" aria-label="코인 지갑 열기"><span>${coin()}<b id="ga-balance">${num(balance)}</b> 코인</span><small>코인 지갑 ${icon('chevron')}</small></button>`;

// 탭 요약 카드: 학습의 '오늘의 추천 학습' 자리. 왼쪽에 탭 아이콘, 그 탭 게임만 센 남은 판.
const SUMMARY = { all: ['menu-arcade', '🎮', '오늘의 놀이터'], arcade: ['menu-arcade', '🎮', '오늘의 미니게임'], tajja: ['menu-tajja', '🃏', '오늘의 코인 승부'], shop: ['menu-shop', '🛍️', '오늘의 상점'] };
function summary(tab, r, o) {
  const rows = todayLeft(r, o.yabawi, tab), n = total(rows), [art, emoji, label] = SUMMARY[tab];
  const extra = tab === 'tajja' ? [r.market_open ? '증권거래소 열림' : '증권거래소 닫힘'] : [];
  const line = [...rows.map(([name, left]) => `${name} ${num(left)}`), ...extra].join(' · ');
  return `<div class="home-next-v1358 study-daily-v1371 pg-today pg-today-${tab}${n ? '' : ' is-done-v1363'}"><span class="pg-today-ico" aria-hidden="true">${menuIcon(art, emoji, o.art)}</span><span><small>${label}</small><strong>${n ? `오늘 남은 판 ${num(n)}판` : '오늘 판을 다 했어요!'}</strong>${line ? `<em>${line}</em>` : ''}</span></div>`;
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
  return `<section class="ga-card pg-best"><div class="ga-book-head"><h2>게임별 최고 기록</h2></div>
    <ul>${bestRows(A.data.rewards || {}, o.yabawi).map(([ico, game, what, value]) => `<li><i aria-hidden="true">${ico}</i><span><b>${esc(game)}</b><small>${esc(what)}</small></span><strong>${esc(value)}</strong></li>`).join('')}</ul>
  </section>
  <h2 class="ag-head">도감</h2>
  ${o.collection()}`;
}

// 큰 카드(학습의 study-hub-card): 왼쪽 그림, 영어 꼬리표, 제목, 한 줄 설명, 오늘 남은 판, 오른쪽 화살표.
function card(view, pill, title, line, ico, left) {
  return `<button type="button" class="study-hub-card pg-card pg-${view}" data-pg="${view}">
      <span class="study-hub-icon">${ico}</span>
      <div><span class="pill">${pill}</span><h2>${title}</h2><small class="pg-card-sub">${line}</small>${left ? `<em class="pg-card-left">오늘 ${num(left)}판 남음</em>` : ''}</div>
      <span class="study-hub-arrow">${icon('arrow')}</span>
    </button>`;
}
const recordIcon = () => `<img class="pg-ico" src="/assets/ui/me-records.webp" alt="" width="68" height="68" draggable="false" decoding="async">`;
function hub(A, o) {
  const r = A.data.rewards || {}, left = tab => total(todayLeft(r, o.yabawi, tab));
  return `${heading('PLAYGROUND', '놀이터')}${wallet(o.balance)}${summary('all', r, o)}
  <div class="study-hub-grid study-hub-simple pg-hub">
    ${card('arcade', 'ARCADE', '미니게임', '낚시 · 짝 맞추기 · 몬스터 사냥 · 인형뽑기 · 10초 맞추기', menuIcon('menu-arcade', '🎮', o.art), left('arcade'))}
    ${card('tajja', 'TAJJA', '코인 승부', o.yabawi ? '가위바위보 · 야바위' : '가위바위보', menuIcon('menu-tajja', '🃏', o.art), left('tajja'))}
    ${card('shop', 'SHOP', '상점', '코인 뽑기 · 알 상점', menuIcon('menu-shop', '🛍️', o.art), left('shop'))}
    ${card('records', 'RECORD', '기록', '게임별 최고 기록 · 도감', recordIcon(), 0)}
    ${r.market_open ? card('market', 'MARKET', '증권거래소', '지금 열렸어요! 문법 주식을 사고팔아요', '<i class="pg-emoji">📈</i>', 0) : ''}
  </div>`;
}
// 카드를 누른 화면: 위에 '← 놀이터'(학습의 '← 학습'과 같은 모양)와 코인 지갑.
const subhead = (pill, title) => `<div class="study-subhead"><button type="button" class="study-back" data-pg="hub">${icon('back')} 놀이터</button><span class="pill green">${pill}</span></div>
  <div class="page-heading grammar-heading pg-heading"><h1>${title}</h1></div>`;

// o: { balance, yabawi, art, games(), party(), tajja(), market(), shop(), collection() } — 게임 카드는 arcade.js가 넘긴다.
export function playgroundHtml(A, state, o) {
  const r = A.data.rewards || {}, view = isView(state.view) ? state.view : 'hub';
  const top = (pill, title) => `${subhead(pill, title)}${wallet(o.balance)}`;
  if (view === 'arcade') return `${top('ARCADE', '미니게임')}${summary('arcade', r, o)}<section class="ag-group pg-games" aria-label="미니게임">${o.games()}</section>${o.party()}`;
  if (view === 'tajja') return `${top('TAJJA', '코인 승부')}${summary('tajja', r, o)}<section class="ag-group pg-games" aria-label="코인 승부">${o.tajja()}</section>`;
  if (view === 'shop') return `${top('SHOP', '상점')}${summary('shop', r, o)}${o.shop()}`;
  if (view === 'records') return `${top('RECORD', '기록')}${records(A, o)}`;
  if (view === 'market') return `${top('MARKET', '증권거래소')}${r.market_open ? o.market() : '<section class="ga-card"><p class="ga-note">지금은 증권거래소가 닫혀 있어요.</p></section>'}`;
  return `${hub(A, o)}${o.party()}`;
}
