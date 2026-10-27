// V13.151 메뉴 정리 검사(V13.158: 게임 카드는 그림 카드, 교실 게임 참가는 맨 아래 한 줄): 야차전은 겨루기(대결 · 몬스터 · 던전 · 기록), 놀이터는 '게임'(낚시터 · 짝 맞추기 · 교실 게임 참가)과
// '상점 · 뽑기'(코인 뽑기 · 알 상점 · 가위바위보). 게임 단어는 야차전 '단어 범위'와 같은 저장값을 쓴다.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import { arcadeWords, GAME_WORDS_MIN, gamesSection, partyRow } from '../public/modules/arcade-games.js';
import { FISHING_ART } from '../public/modules/reel.js';
import { MATCH_ART } from '../public/modules/match-game.js';

const source = path => readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8');

export function runMenuChecks(assert) {
  const battle = source('../public/modules/battle.js'), arcade = source('../public/modules/arcade.js'), games = source('../public/modules/arcade-games.js'), app = source('../public/app.js'), css = source('../public/v13151.css');
  assert(!/\['games', '게임'/.test(battle) && !battle.includes('function gamesTab(') && !battle.includes('놀이터로 이사했어요') && !battle.includes("from './match-game.js'"), 'V13.151 야차전에 게임 탭 · 낚시 이사 안내가 없다');
  // V13.158 순서: 코인 지갑 → 게임(낚시터 → 짝 맞추기 → V13.162 펫 사냥 → V13.180 인형뽑기) → 상점 · 뽑기 → 교실 게임 참가(맨 아래).
  const page = arcade.slice(arcade.indexOf('export function arcadePage('), arcade.indexOf('export function gachaBookPage('));
  const at = text => page.indexOf(text);
  assert(at('arcade-wallet') > 0 && at('arcade-wallet') < at('${gamesSection(A, { fishing: FISHING_ART, match: MATCH_ART, hunt: HUNT_ART, claw: CLAW_ART })}') && at('${gamesSection(') < at('<div data-arcade></div>') && at('<div data-arcade></div>') < at('${partyRow()}'),
    'V13.158 놀이터 순서: 코인 지갑 → 게임 → 상점 · 뽑기 → 교실 게임 참가(맨 아래)');
  assert(games.indexOf('${huntCard(A, art)}') > 0 && games.indexOf('${huntCard(A, art)}') < games.indexOf('${clawCard(A, art)}'), 'V13.180 인형뽑기 카드는 몬스터 사냥 다음');
  assert(games.includes('<h2 class="ag-head">게임</h2>') && games.includes('<h2 class="ag-head">상점 · 뽑기</h2>') && games.indexOf('${reelCard(A, art)}') < games.indexOf('${matchCard(A, art)}') && !games.slice(games.indexOf('export function gamesSection('), games.indexOf('export function partyRow(')).includes('arcade-party'),
    'V13.158 게임 묶음은 낚시터 → 짝 맞추기, 교실 게임 참가는 게임 묶음 밖');
  assert(app.includes("if (d.action === 'arcade-words') return openWordsSheet(A,") && app.includes("return openMatchGame(A, back,") && app.includes("return openPartyJoin(A, back, { code });") && app.includes("A.tab = 'arcade';"), 'V13.151 놀이터에서 연 짝 맞추기 · 교실 게임은 끝나면 놀이터로 돌아온다');
  assert(games.includes('const rangesKey = A => `sumus-yacha-ranges:${A.data.profile.id}`;') && battle.includes('const rangesKey = () => `sumus-yacha-ranges:${B.A.data.profile.id}`;'), 'V13.151 게임 단어는 야차전 단어 범위와 같은 저장값');
  assert(css.includes('.yl-tabs{grid-template-columns:repeat(4,minmax(0,1fr))}'), 'V13.151 야차전 탭은 다시 4칸');
  // 게임 단어 고르기: 저장값이 없으면 8단어가 넘는 첫 과.
  const words = Array.from({ length: 30 }, (_, i) => ({ id: 'w' + i, range_code: i < 5 ? 'A' : 'B' }));
  const A = { school: 's', ranges: {}, data: { profile: { id: 'p', school: 's', class_name: '고1A' }, books: [{ words }] } };
  const w = arcadeWords(A);
  assert(GAME_WORDS_MIN === 8 && w.ok && w.picked.length >= 1 && w.n >= 8 && w.list.every(x => w.picked.includes(String(x.range_code))), 'V13.151 게임 단어는 8단어 이상인 범위로 고른다');

  // V13.158 그림 카드: 낚시터는 bg-entry 배경 + 미끼 · 낚싯대 단계 아이콘 · 진주, 짝 맞추기는 그림이 있으면 entry, 없으면 코드 카드(brave · 용감한).
  A.data.rewards = { reel: { bait: 7, rod: 3, pearls: 1234 }, match: { best: 41230, left: 2 } };
  const full = gamesSection(A, { fishing: FISHING_ART, match: new Set(['entry']) }), bare = gamesSection(A, { fishing: new Set(), match: new Set() });
  assert(full.includes('src="/assets/fishing/bg-entry.webp"') && full.includes('src="/assets/fishing/icon-rod-3.webp"') && full.includes('src="/assets/fishing/bait-can.webp"') && full.includes('src="/assets/fishing/pearl.webp"')
    && full.includes('<b>7</b><small>미끼</small>') && full.includes('<b>3단계</b><small>낚싯대</small>') && full.includes('<b>1,234</b><small>진주</small>') && full.includes('data-action="reel-open"') && full.includes('>들어가기</button>'),
    'V13.158 낚시터 카드: 입구 그림 배경, 미끼 · 낚싯대 단계 아이콘 · 진주, 들어가기');
  assert(full.includes('src="/assets/match/entry.webp"') && !full.includes('gm-mini') && bare.includes('<span class="gm-mini en">brave</span><span class="gm-mini ko">용감한</span>') && !bare.includes('/assets/match/entry.webp') && !bare.includes('<img'),
    'V13.158 짝 맞추기 카드: 그림(entry)이 있으면 쓰고, 없으면 코드 카드. 그림이 없으면 이미지 태그도 없다');
  for (const html of [full, bare]) assert(html.includes('<small>내 최고</small>') && html.includes('<small>오늘 코인 판</small>') && html.includes('data-action="arcade-words"') && html.includes('data-action="arcade-match"') && html.indexOf('data-action="reel-open"') < html.indexOf('data-action="arcade-match"'),
    'V13.158 짝 맞추기 카드: 내 최고 · 오늘 코인 판 · 게임 단어(바꾸기) · 시작');
  const party = partyRow();
  assert(party.includes('id="gm-code"') && party.includes('maxlength="4"') && party.includes('data-action="arcade-party"') && party.includes('>들어가기</button>') && !party.includes('<p>'), 'V13.158 교실 게임 참가는 한 줄(번호 4자리 + 들어가기)');
  const matchArt = [...source('../public/modules/match-game.js').match(/MATCH_ART = new Set\(\[([^\]]*)\]\)/)[1].matchAll(/'([a-z-]+)'/g)].map(m => m[1]);
  assert(MATCH_ART.size === matchArt.length && matchArt.every(n => existsSync(fileURLToPath(new URL(`../public/assets/match/${n}.webp`, import.meta.url)))) && existsSync(fileURLToPath(new URL('../public/assets/fishing/bg-entry.webp', import.meta.url))), 'V13.158 카드 그림은 파일이 있을 때만 목록에 있다');
  const runner = source('../docs/asset-requests/runner/32-match-entry.txt'), codex = source('../docs/asset-requests/runner/CODEX_PROMPT_32.md');
  assert(/before drawing, open these pictures in Google Drive/.test(runner) && runner.includes('"27a-3.png"') && runner.includes('into the folder "SUMUS 짝 맞추기 32 (Runner용)", named exactly "32-1.png"') && runner.includes('No text, no letters')
    && codex.includes('**그리기 전에 Drive의 기존 그림을 열어 그림체를 맞춘다.**') && codex.includes('**결과는 정해진 Drive 폴더 "SUMUS 짝 맞추기 32 (Runner용)"에 정확한 파일 이름 `32-1.png`로 저장한다.**') && codex.includes("MATCH_ART = new Set(['entry'])") && codex.includes('`sumus-voca-prod-deploy`로 PR을 만들지 않는다'),
    'V13.158 그림 주문서 32: Drive 기존 그림체 맞추기 · 정해진 폴더에 정확한 이름으로 저장 · 운영 브랜치로 PR 금지');
}
