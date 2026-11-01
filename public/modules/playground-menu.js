// V13.206 놀이터 메뉴: 게임이 많아져서 학습 탭처럼 묶는다.
// V13.208: 큰 카드를 한 번 더 누르던 단계를 없애고, 위쪽 탭 4개(미니게임 · 코인 승부 · 상점 · 기록)를 누르면 그 게임 카드가 바로 나온다.
//   탭 이름 옆에 오늘 남은 판 수, 탭마다 그 탭 게임만 세는 요약 카드, 맨 아래 교실 게임 참가는 모든 탭 공통.
// V13.207: 운영에도 켰다(PG_MENU_LIVE). 끄면 테스트 앱(sumus-voca-test.*) · 로컬에서만 켜지고 운영은 arcade.js의 예전 화면.
// 마지막 탭은 localStorage(sumus-pg-menu)에 기억한다(예전 '게임' 탭 기록은 미니게임 · 코인 승부로 옮긴다). 저장이 막혀 있으면 미니게임 탭.
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

export const PG_TABS = [['arcade', '미니게임'], ['tajja', '코인 승부'], ['shop', '상점'], ['records', '기록']];
const PG_KEY = 'sumus-pg-menu';
export function pgRead(store = globalThis.localStorage) {
  let saved = {};
  try { saved = JSON.parse(store?.getItem(PG_KEY) || '{}') || {}; } catch {}
  if (PG_TABS.some(([key]) => key === saved.tab)) return { tab: saved.tab };
  // V13.206 기록({ tab: 'game', sub }): 코인 승부 · 증권거래소에 있었으면 코인 승부, 나머지는 미니게임.
  if (saved.tab === 'game') return { tab: saved.sub === 'tajja' || saved.sub === 'market' ? 'tajja' : 'arcade' };
  return { tab: 'arcade' };
}
export function pgWrite(state, store = globalThis.localStorage) {
  try { store?.setItem(PG_KEY, JSON.stringify({ tab: state.tab })); } catch {}
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

function tabs(state, r, yabawi) {
  return `<div class="segment study-tabs-v1368 pg-tabs" role="group" aria-label="놀이터 메뉴">${PG_TABS.map(([tab, label]) => {
    const left = tab === 'records' ? 0 : total(todayLeft(r, yabawi, tab));
    return `<button type="button" data-pg-tab="${tab}" class="${state.tab === tab ? 'selected' : ''}" aria-pressed="${state.tab === tab}">${label}${left ? `<i class="pg-tab-left" aria-label="남은 판 ${num(left)}">${num(left)}</i>` : ''}</button>`;
  }).join('')}</div>`;
}
const heading = (eyebrow, title) => `<div class="page-heading study-simple-heading premium-page-heading pg-heading"><span class="premium-eyebrow">${eyebrow}</span><h1>${title}</h1></div>`;
const wallet = balance => `<button type="button" class="arcade-wallet" data-action="coins" aria-label="코인 지갑 열기"><span>${coin()}<b id="ga-balance">${num(balance)}</b> 코인</span><small>코인 지갑 ${icon('chevron')}</small></button>`;

// 탭 요약 카드: 학습의 '오늘의 추천 학습' 자리. 왼쪽에 탭 아이콘, 그 탭 게임만 센 남은 판.
const SUMMARY = { arcade: ['menu-arcade', '🎮', '오늘의 미니게임'], tajja: ['menu-tajja', '🃏', '오늘의 코인 승부'], shop: ['menu-shop', '🛍️', '오늘의 상점'] };
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

// o: { balance, yabawi, art, games(), party(), tajja(), market(), shop(), collection() } — 게임 카드는 arcade.js가 넘긴다.
export function playgroundHtml(A, state, o) {
  const r = A.data.rewards || {}, tab = PG_TABS.some(([key]) => key === state.tab) ? state.tab : 'arcade';
  const top = `${tabs({ tab }, r, o.yabawi)}${heading('PLAYGROUND', '놀이터')}${wallet(o.balance)}`;
  let body;
  if (tab === 'tajja') body = `${summary('tajja', r, o)}<section class="ag-group pg-games" aria-label="코인 승부">${o.tajja()}${r.market_open ? o.market() : ''}</section>`;
  else if (tab === 'shop') body = `${summary('shop', r, o)}${o.shop()}`;
  else if (tab === 'records') body = records(A, o);
  else body = `${summary('arcade', r, o)}<section class="ag-group pg-games" aria-label="미니게임">${o.games()}</section>`;
  return `${top}${body}${o.party()}`;
}
