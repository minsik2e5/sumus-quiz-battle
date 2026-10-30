// V13.200 검사: 신화는 학생당 1마리, 학생 관리 창 계정 관리를 위로, 시리즈 펫의 보이는 등급(잠긴 그림 · 야차전 연출),
// 곤충 · 공룡 알 전용 그림 주문서 62(들어오면 build:assets가 알아서 쓴다).
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { CHARACTERS, MYTHIC_PET_KEYS, lookTier, petTier } from '../public/modules/core.js';
import { tierOf } from '../public/modules/battle-fx.js';
import { SERIES_EGG_ART } from '../public/modules/pet-art.js';
import { mythicRoll, hasMythicPet, setMythicRandom, giftEggPick } from './rewards.mjs';

const source = path => readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8');

export async function runPolish200Checks(assert) {
  // ---- 1. 신화는 학생당 1마리
  setMythicRandom(() => 0); // 굴렸다면 반드시 신화가 나오는 운
  try {
    const none = { pets: [{ key: 'dog' }] }, one = { pets: [{ key: 'dog' }, { key: MYTHIC_PET_KEYS[0], mythic: true }] };
    assert(!hasMythicPet(none) && hasMythicPet(one) && mythicRoll(none, 'basic') === MYTHIC_PET_KEYS[0] && ['basic', 'epic', 'gift', 'capsule'].every(src => mythicRoll(one, src) === null),
      'V13.200 신화는 학생당 1마리: 신화가 있으면 랜덤 알 · 영웅 알 · 선물 알 · 코인 뽑기 어디서도 신화를 굴리지 않는다');
    assert(giftEggPick(one, () => .5).tier !== 'mythic' && giftEggPick(none, () => .5).tier === 'mythic', 'V13.200 선생님 선물 알도 신화가 있으면 신화가 나오지 않는다');
  } finally { setMythicRandom(null); }
  const book = source('../public/modules/petbook.js');
  assert(book.includes('신화 펫 <small>전설보다 위 · 모든 알에서 아주 낮은 확률 · 학생마다 1마리</small>') && book.includes('· 뽑기 확정은 없어요 · 학생마다 1마리'), 'V13.200 도감에 "학생마다 1마리" 안내');

  // ---- 5. 학생 관리 창: 계정 관리(이름 · 반 · 비밀번호)가 활동 기록보다 위
  const te = source('../public/teacher-enhancements.js');
  assert(te.indexOf('<h3>계정 관리</h3>') > 0 && te.indexOf('<h3>계정 관리</h3>') < te.indexOf('<h3>시험범위 정복</h3>') && te.indexOf('<h3>계정 관리</h3>') < te.indexOf('<h3>오늘 뭘 했나</h3>'),
    'V13.200 학생 관리 창의 계정 관리(이름 칸 포함)는 시험범위 · 활동 기록보다 위에 있다');

  // ---- 6. 시리즈 펫의 보이는 등급
  assert(lookTier('tyranno') === 'legendary' && lookTier('ptera') === 'epic' && lookTier('ladybug') === 'basic' && petTier('tyranno') === 'basic' && lookTier('haechi') === 'legendary' && lookTier('capybara') === 'epic',
    'V13.200 보이는 등급: 렉스는 전설, 시리즈 영웅은 영웅(전역 등급 셈 petTier는 그대로 기본)');
  assert(tierOf(CHARACTERS.tyranno) === 2 && tierOf(CHARACTERS.rhinobeetle) === 1 && tierOf(CHARACTERS.bee) === 0 && tierOf(CHARACTERS.haechi) === 2,
    'V13.200 야차전 특기 연출: 렉스는 전설 연출, 시리즈 영웅은 영웅 연출');
  assert(source('../public/modules/student.js').includes("['legendary', 'mythic'].includes(lookTier(key)) ? 'pet-legend-locked' : lookTier(key) === 'epic' ? 'pet-epic-locked'"), 'V13.200 내 펫 화면의 못 만난 펫 칸도 시리즈 등급 그림(영웅 · 전설 잠금)');

  // ---- 7. 곤충 · 공룡 알 전용 그림 주문서 62
  const R = '../docs/asset-requests/runner/';
  const order = source(R + '62-series-egg.txt'), codex = source(R + 'CODEX_PROMPT_62.md'), map = source(R + 'slice-map.csv').split('\n').filter(l => l.startsWith('"62-series-egg.txt"'));
  assert(order.includes('STYLE REFERENCE — before drawing, open') && order.includes('Google Drive folder "SUMUS 테마 알 · 칭호 56 (Runner용)"') && order.includes('into the folder "SUMUS 곤충 · 공룡 알 62 (Runner용)", named exactly "62-1.png"'),
    'V13.200 주문서 62: Drive의 기존 그림을 열어 그림체를 맞추고, 정해진 Drive 폴더에 정확한 이름(62-1.png)으로 저장하라는 말');
  assert(map.length === 4 && map[0].endsWith('"public/assets/ui/series-egg.webp"') && codex.includes('**새 파일만 추가**') && codex.includes('SERIES_EGG_ART'), 'V13.200 주문서 62: 칸 4개(왼쪽 위가 ui/series-egg), Codex 지시문');
  const art = existsSync(fileURLToPath(new URL('../public/assets/ui/series-egg.webp', import.meta.url)));
  assert(SERIES_EGG_ART === (art ? 'series-egg' : 'bugdino-egg') && ['arcade.js', 'pet-moments.js', 'petbook.js'].every(f => source('../public/modules/' + f).includes('SERIES_EGG_ART') && !source('../public/modules/' + f).includes("'bugdino-egg'")),
    'V13.200 알 그림은 SERIES_EGG_ART(전용 그림이 들어오면 series-egg, 아니면 합친 bugdino-egg)');
}
