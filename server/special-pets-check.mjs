// V13.207 검사: 특별 한정(영웅 한정) 펫 3마리 — 하치와레 · 우사기 · 치이카와.
// 파는 알이 없고, 기간(SEASONS.special) 동안 영웅 결과(영웅 알 · 코인 뽑기 영웅 알)의 `rate`%가 아직 없는 특별 펫이다.
import { existsSync, readFileSync } from 'node:fs';
import { CHARACTERS, SEASONS, LIMITED_PET_KEYS, STANDARD_PET_KEYS, EPIC_PET_KEYS, ACTIVE_PET_KEYS, seasonKeys, seasonOnSale, seasonsInEpic, petTier, petReady } from '../public/modules/core.js';
import { PET_ART, PET_FIGHT } from '../public/modules/pet-art.js';
import { PET_SKILLS, PET_SKILL_TIERS, petSkill } from '../public/modules/battle-engine.js';
import { limitedFromEpic, openEgg } from './rewards.mjs';
import { elementOf } from '../public/modules/battle-fx.js';
import { TEST_APP } from './test-seed.mjs';

const TRIO = ['hachiware', 'usagi', 'chiikawa'];
const source = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const asset = name => new URL(`../public/assets/${name}.webp`, import.meta.url);

export async function runSpecialPetsChecks(assert) {
  const S = SEASONS.special, kst = t => Date.parse(t + '+09:00');
  assert(seasonKeys('special').join() === TRIO.join() && TRIO.every(k => CHARACTERS[k].limited === 'special' && petTier(k) === 'limited' && petReady(k) && LIMITED_PET_KEYS.includes(k) && ACTIVE_PET_KEYS.includes(k) && !STANDARD_PET_KEYS.includes(k) && !EPIC_PET_KEYS.includes(k))
    && ['하치와레', '우사기', '치이카와'].join() === TRIO.map(k => CHARACTERS[k].ko).join(),
    'V13.207 특별 한정 펫 3마리(하치와레 · 우사기 · 치이카와)는 한정 등급이고 기본 · 영웅 알 목록에 섞이지 않는다');

  /* ---------- 그림 ---------- */
  const files = TRIO.flatMap(k => [
    ...[0, 1, 2, 3].flatMap(f => [`${k}-${f}`, `${k}-${f}-s`]),
    `${k}-0-happy`, `${k}-0-eat`,
    ...[1, 2, 3].flatMap(f => ['happy', 'eat', 'sad', 'cheer', 'attack', 'hurt'].map(e => `${k}-${f}-${e}`))
  ]);
  assert(files.length === 84 && files.every(f => existsSync(asset(`pets/${f}`))) && TRIO.every(k => PET_ART.has(k) && PET_FIGHT.has(k)),
    'V13.207 특별 펫 그림 84장(기본 · 작은 그림 · 표정 · 알 반응 · 공격 · 맞음)이 있고 PET_ART · PET_FIGHT에 들어간다');

  /* ---------- 얻는 법 ---------- */
  assert(S.epic_only && !S.egg && !S.price && S.start === '2026-11-04' && S.end === '2026-12-31' && S.rate === 10 && S.after_rate === 5 && /12월 31일/.test(S.until)
    && seasonOnSale(kst('2026-11-10T12:00:00'))?.id !== 'special' && seasonOnSale(kst('2027-01-10T12:00:00')) === null,
    'V13.207 특별 시즌은 자기 알이 없다(V13.213부터 이벤트 알에 함께 들어 있다)');
  const rateOf = t => seasonsInEpic(kst(t)).find(x => x.id === 'special')?.rate ?? null;
  // V13.213(선생님 결정): 이벤트 알에 들어가도 영웅 결과 10% 경로는 그대로, 그 뒤에는 지난 시즌처럼 5%.
  assert(!S.sold_in && rateOf('2026-11-03T23:59:00') === null && rateOf('2026-11-04T00:00:00') === 10 && rateOf('2026-12-31T23:59:00') === 10 && rateOf('2027-01-01T00:00:00') === 5,
    'V13.213 특별 펫은 11/4~12/31 영웅 결과의 10%(이벤트 알 판매 중에도 유지), 그 뒤에는 지난 시즌처럼 5%');
  const during = kst('2026-11-20T12:00:00'), after = kst('2027-01-10T12:00:00');
  const kid = (...keys) => ({ pets: [{ key: 'dog' }, ...keys.map(key => ({ key }))] });
  const seq = list => () => list.length ? list.shift() : 0;
  assert(TRIO.includes(limitedFromEpic(kid(), () => 0, during)) && limitedFromEpic(kid(), seq([0.0999, 0.99]), during) === 'chiikawa' && limitedFromEpic(kid(), () => 0.1, during) === null && limitedFromEpic(kid(...TRIO), () => 0, during) === null && seasonKeys('autumn').includes(limitedFromEpic(kid(), () => 0, after)) && TRIO.includes(limitedFromEpic(kid(...seasonKeys('autumn')), () => 0, after))
    && TRIO.includes(limitedFromEpic(kid(), seq([0.5, 0.0499, 0]), after)) && limitedFromEpic(kid(), () => 0.05, after) === null && limitedFromEpic(kid(...LIMITED_PET_KEYS), () => 0, after) === null,
    'V13.213 기간 중 영웅 결과는 10%로 아직 없는 특별 펫(가을 펫은 안 나옴), 1/1부터는 시즌마다 5%씩 따로 굴린다(가을 → 특별, 다 모으면 안 나온다)');
  const egg = kid(); const opened = openEgg(egg, { epic: true, missing: ['capybara'], price: 800, random: seq([0.5, 0.05, 0.4]), now: during });
  assert(opened.limited && TRIO.includes(opened.key) && egg.pets.some(p => p.key === opened.key && p.limited) && egg.purchases[0].item === 'epic_egg' && egg.purchases[0].limited,
    'V13.213 판매 기간 중에도 영웅 알에서 특별 펫이 10%로 나올 수 있다(한정 표시로 저장)');
  const egg3 = kid(); const late = openEgg(egg3, { epic: true, missing: ['capybara'], price: 800, random: seq([0.5, 0.5, 0.01, 0.4]), now: after });
  assert(late.limited && TRIO.includes(late.key) && egg3.pets.some(p => p.key === late.key && p.limited) && egg3.purchases[0].limited,
    'V13.213 판매가 끝난 뒤 영웅 알에서 특별 펫이 5%로 나올 수 있다(한정 표시로 저장)');
  const egg2 = kid(); const basic = openEgg(egg2, { epic: false, missing: ['cat'], price: 400, random: () => 0.5, now: during });
  assert(!TRIO.includes(basic.key), 'V13.207 랜덤(기본) 알에서는 특별 펫이 나오지 않는다');

  /* ---------- 야차전 특기 ---------- */
  const value = s => (s.burst || 0) + (s.heal || 0) + (s.guard || []).reduce((a, b) => a + b, 0) + (s.boost || []).reduce((a, b) => a + b, 0) + (s.poison || 0) * (s.turns || 0);
  assert(TRIO.every(k => PET_SKILL_TIERS.limited.includes(k) && petSkill({ key: k }).key === k && value(PET_SKILLS[k]) >= 15 && value(PET_SKILLS[k]) <= 16)
    && PET_SKILLS.hachiware.name === '찰칵 플래시' && PET_SKILLS.usagi.name === '야하 돌진' && PET_SKILLS.chiikawa.name === '토벌봉 한 방',
    'V13.207 특별 펫 특기는 한정 세기(기본 정도, 합계 가치 15~16): 찰칵 플래시 · 야하 돌진 · 토벌봉 한 방');

  assert(elementOf('hachiware') === 'ice' && elementOf('usagi') === 'toxic' && elementOf('chiikawa') === 'star', 'V13.207 특별 펫 공격 속성: 하치와레 얼음 · 우사기 독 · 치이카와 별빛');

  assert(TEST_APP.GIFTS['special-ts3']?.ts3?.join() === TRIO.join(), 'V13.207 테스트 앱 ts3에게 특별 펫 3마리를 한 번 선물한다(확인용)');

  /* ---------- 화면 ---------- */
  const book = source('../public/modules/petbook.js'), lucky = source('../public/modules/lucky.js'), arcade = source('../public/modules/arcade.js'), css = source('../public/v13107.css');
  assert(book.includes("season.mark || '★'") && !book.includes('🎃 ${esc(season.name)}') && book.includes('seasonsInEpic().find(x => x.id === c.limited && season.epic_only') && book.includes('seasonOnSale()?.keys.includes(key)') && SEASONS.autumn.mark === '🎃' && S.mark === '🎁',
    'V13.207 도감 한정 표시는 시즌마다 다른 표시(가을 🎃 · 특별 🎁)와 특별 펫의 얻는 법(영웅 알 10% · 12/31까지)');
  assert(lucky.includes('seasonsInEpic().find(x => x.id === c.limited)?.rate ?? season.after_rate') && arcade.includes('egg-slot-legend special') && css.includes('.egg-slot-legend.special'),
    'V13.207 획득 연출은 지금 확률로 말하고, 알 상점 영웅 알에 특별 한정 찬스 표시가 있다');
}
