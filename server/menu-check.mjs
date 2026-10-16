// V13.151 메뉴 정리 검사: 야차전은 겨루기(대결 · 몬스터 · 던전 · 기록), 놀이터는 '게임'(낚시터 · 짝 맞추기 · 교실 게임 참가)과
// '상점 · 뽑기'(코인 뽑기 · 알 상점 · 가위바위보). 게임 단어는 야차전 '단어 범위'와 같은 저장값을 쓴다.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { arcadeWords, GAME_WORDS_MIN } from '../public/modules/arcade-games.js';

const source = path => readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8');

export function runMenuChecks(assert) {
  const battle = source('../public/modules/battle.js'), arcade = source('../public/modules/arcade.js'), games = source('../public/modules/arcade-games.js'), app = source('../public/app.js'), css = source('../public/v13151.css');
  assert(!/\['games', '게임'/.test(battle) && !battle.includes('function gamesTab(') && !battle.includes('놀이터로 이사했어요') && !battle.includes("from './match-game.js'"), 'V13.151 야차전에 게임 탭 · 낚시 이사 안내가 없다');
  assert(arcade.includes('${gamesSection(A, reelEntry(A))}') && games.includes('<h2 class="ag-head">게임</h2>') && games.includes('<h2 class="ag-head">상점 · 뽑기</h2>') && games.indexOf('data-action="arcade-match"') < games.indexOf('data-action="arcade-party"'), 'V13.151 놀이터: 게임(낚시터 → 짝 맞추기 → 교실 게임) 묶음이 위, 상점 · 뽑기가 아래');
  assert(app.includes("if (d.action === 'arcade-words') return openWordsSheet(A,") && app.includes("return openMatchGame(A, back,") && app.includes("return openPartyJoin(A, back, { code });") && app.includes("A.tab = 'arcade';"), 'V13.151 놀이터에서 연 짝 맞추기 · 교실 게임은 끝나면 놀이터로 돌아온다');
  assert(games.includes('const rangesKey = A => `sumus-yacha-ranges:${A.data.profile.id}`;') && battle.includes('const rangesKey = () => `sumus-yacha-ranges:${B.A.data.profile.id}`;'), 'V13.151 게임 단어는 야차전 단어 범위와 같은 저장값');
  assert(css.includes('.yl-tabs{grid-template-columns:repeat(4,minmax(0,1fr))}'), 'V13.151 야차전 탭은 다시 4칸');
  // 게임 단어 고르기: 저장값이 없으면 8단어가 넘는 첫 과.
  const words = Array.from({ length: 30 }, (_, i) => ({ id: 'w' + i, range_code: i < 5 ? 'A' : 'B' }));
  const A = { school: 's', ranges: {}, data: { profile: { id: 'p', school: 's', class_name: '고1A' }, books: [{ words }] } };
  const w = arcadeWords(A);
  assert(GAME_WORDS_MIN === 8 && w.ok && w.picked.length >= 1 && w.n >= 8 && w.list.every(x => w.picked.includes(String(x.range_code))), 'V13.151 게임 단어는 8단어 이상인 범위로 고른다');
}
