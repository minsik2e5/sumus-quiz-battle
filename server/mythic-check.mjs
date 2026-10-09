// Release checks for V13.118 신화 (mythic) pets: the five mythic pets + 천마 (legendary), 불새 retired, the tiny chance from
// every kind of egg (no pity), the school news, the reveal show and the dex.
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { CHARACTERS, ACTIVE_PET_KEYS, STANDARD_PET_KEYS, EPIC_PET_KEYS, LEGENDARY_PET_KEYS, MYTHIC_PET_KEYS, LIMITED_PET_KEYS, petTier } from '../public/modules/core.js';
import { MYTHIC_RATE } from '../public/modules/rewards.js';
import { petSkill } from '../public/modules/battle-engine.js';
import { mythicRoll, setMythicRandom, openEgg, pullLucky, giftEggPick, openGifts } from './rewards.mjs';

const here = path => fileURLToPath(new URL(path, import.meta.url));
const source = path => readFileSync(here(path), 'utf8');

export function runMythicChecks(assert) {
  const MYTHIC = ['gumiho', 'cheongryong', 'baekho', 'jujak', 'hyeonmu'];
  assert(MYTHIC_PET_KEYS.join() === MYTHIC.join() && MYTHIC.every(key => petTier(key) === 'mythic' && !STANDARD_PET_KEYS.includes(key) && !EPIC_PET_KEYS.includes(key) && !LEGENDARY_PET_KEYS.includes(key) && !LIMITED_PET_KEYS.includes(key)),
    'V13.118 신화 펫은 구미호·청룡·백호·주작·현무 5종이고 기본·영웅·전설·한정과 섞이지 않는다');
  assert(LEGENDARY_PET_KEYS.join() === 'haechi,whale,qilin,cheonma' && petTier('cheonma') === 'legendary' && CHARACTERS.phoenix.retired && ![...STANDARD_PET_KEYS, ...EPIC_PET_KEYS, ...LEGENDARY_PET_KEYS, ...MYTHIC_PET_KEYS, ...LIMITED_PET_KEYS].includes('phoenix') && !ACTIVE_PET_KEYS.includes('phoenix'),
    'V13.118 천마는 전설이고 불새는 숨겨져서 알·뽑기·도감·개수에 나오지 않는다(옛 기록이 있어도 그림은 그려진다)');
  assert(ACTIVE_PET_KEYS.length === STANDARD_PET_KEYS.length + EPIC_PET_KEYS.length + LEGENDARY_PET_KEYS.length + MYTHIC_PET_KEYS.length + LIMITED_PET_KEYS.length && ACTIVE_PET_KEYS.length === Object.keys(CHARACTERS).length - 1,
    'V13.118 학생이 만날 수 있는 펫은 기본 16 · 영웅 16 · 전설 4 · 신화 5 · 한정 5 = 46종이다');
  assert([...MYTHIC, 'cheonma'].every(key => petSkill({ key }).key === 'none') && petSkill({ key: 'jujak' }).desc.includes('신화'), 'V13.118 신화 펫과 천마에는 야차전 특기가 없다');

  const rate = MYTHIC_RATE, sources = Object.keys(rate);
  assert(sources.join() === 'basic,epic,gift,capsule' && sources.every(key => rate[key] > 0 && rate[key] <= .5) && rate.capsule < rate.basic && rate.basic <= rate.epic, 'V13.118 신화 확률은 랜덤 알 0.1% · 영웅 알 0.2% · 선생님 알 0.1% · 코인 뽑기 0.03%이고 모두 0.5% 이하다(싼 뽑기일수록 낮다)');
  const src = ['./rewards.mjs', '../public/modules/rewards.js', '../public/modules/core.js'].map(source).join('\n');
  assert(!/MYTHIC_PITY|mythic_pulls|mythic_pity/.test(src), 'V13.118 신화에는 천장(확정)이 없다');

  // ---- the roll
  const none = { pets: [{ key: 'dog' }] }, all = { pets: MYTHIC.map(key => ({ key })) };
  try {
    setMythicRandom(() => 0); assert(mythicRoll(none, 'basic') === 'gumiho' && mythicRoll({ pets: [{ key: 'gumiho' }] }, 'basic') === 'cheongryong' && mythicRoll(all, 'basic') === null, 'V13.118 신화는 아직 없는 신화 펫 중에서 나오고, 다 가진 학생에게는 안 나온다');
    setMythicRandom(() => .999); assert(sources.every(key => mythicRoll(none, key) === null), 'V13.118 보통의 운에서는 신화가 나오지 않는다');
    setMythicRandom(() => .0015); // 0.15%: above basic 0.1 and gift 0.1 and capsule 0.03, below epic 0.2
    assert(mythicRoll(none, 'epic') !== null && mythicRoll(none, 'basic') === null && mythicRoll(none, 'gift') === null && mythicRoll(none, 'capsule') === null, 'V13.118 같은 운이어도 영웅 알이 랜덤 알·선물·코인 뽑기보다 신화가 잘 나온다');

    // ---- shop eggs
    setMythicRandom(() => 0);
    const egg = { pets: [{ key: 'dog' }] }, opened = openEgg(egg, { epic: false, missing: ['pig'], price: 400, random: () => .5 });
    assert(opened.mythic && MYTHIC.includes(opened.key) && !opened.legendary && !opened.limited && egg.pets.at(-1).mythic && egg.pets.at(-1).key === opened.key && egg.points_spent === 400 && egg.purchases[0].item === 'egg' && egg.purchases[0].mythic && egg.avatar_key === opened.key,
      'V13.118 랜덤 알이 신화 펫으로 열리면 신화 펫이 생기고 코인이 나가며 구매 기록에 신화로 남는다');
    const egg2 = { pets: [{ key: 'dog' }] }, opened2 = openEgg(egg2, { epic: true, missing: ['capybara'], price: 800, random: () => .5 });
    assert(opened2.mythic && egg2.purchases[0].item === 'epic_egg' && egg2.points_spent === 800, 'V13.118 영웅 알도 신화로 열릴 수 있다');
    const egg3 = { pets: [{ key: 'dog' }] }, opened3 = openEgg(egg3, { season: 'autumn', missing: ['ghost'], price: 600, random: () => 0, now: Date.parse('2026-10-20T12:00:00+09:00') });
    assert(!opened3.mythic && opened3.key === 'ghost' && opened3.limited, 'V13.118 가을 이벤트 알(한정 알)에서는 신화가 나오지 않는다');
    const four = { pets: [{ key: 'dog' }, ...MYTHIC.slice(0, 4).map(key => ({ key }))] }, last = openEgg(four, { epic: false, missing: ['pig'], price: 400, random: () => .5 });
    assert(last.key === 'hyeonmu' && openEgg({ pets: [...four.pets, { key: 'hyeonmu' }] }, { epic: false, missing: ['pig'], price: 400, random: () => .5 }).mythic === undefined, 'V13.118 신화를 다 모으면 더는 신화가 나오지 않고 평소 알로 열린다');

    // ---- coin capsule
    const cap = { pets: [{ key: 'dog' }], lucky: {} }, pulled = pullLucky(cap, 10, 1000, { random: () => .5, now: Date.now() });
    assert(pulled.mythic && MYTHIC.includes(pulled.mythic.key) && !pulled.legendary && !pulled.epic && cap.pets.at(-1).mythic && cap.avatar_key === pulled.mythic.key && !cap.lucky.legend_pulls && cap.lucky.log.at(-1).mythic === pulled.mythic.key,
      'V13.118 코인 뽑기에서 신화가 나오면 전설·영웅 굴림은 건너뛰고(뽑기 횟수 천장에도 안 세고) 신화 펫과 기록이 남는다');

    // ---- teacher gift egg
    const gift = giftEggPick({ pets: [{ key: 'dog' }] }, () => .5);
    assert(gift.tier === 'mythic' && MYTHIC.includes(gift.key), 'V13.118 선생님 알도 신화로 열릴 수 있다');
    const box = { pets: [{ key: 'dog' }], gift_box: { total: 0, log: [{ id: 'g1', kind: 'egg', amount: 0, at: 1 }] } };
    const openedGifts = openGifts(box, Date.now(), () => .5);
    assert(openedGifts[0].egg.tier === 'mythic' && box.pets.at(-1).mythic && box.pets.at(-1).gift, 'V13.118 선물로 받은 신화 펫이 내 펫에 들어간다');
  } finally { setMythicRandom(() => .999); }

  // ---- school news and the shop answer
  const service = source('./service.mjs'), notify = source('./notify.mjs');
  assert(service.includes("function announceLegend(state, p, key, where, rank = '전설')") && service.includes("title: '✨ 신화 소식'") && service.includes("announceLegend(state, p, result.mythic.key, '행운 뽑기', '신화')") && service.includes("announceLegend(state, p, key, epic ? '영웅 알' : '랜덤 알', '신화')") && service.includes("announceLegend(state, p, mythic.egg.key, '선생님 알 선물', '신화')") && notify.includes("title = '🌟 전설 소식'"),
    'V13.118 신화가 나오면 전교에 "신화 펫" 소식이 가고(랜덤 알·영웅 알·코인 뽑기·선생님 알), 전설 소식은 그대로다');

  // ---- the reveal, the dex and the art
  const lucky = source('../public/modules/lucky.js'), moments = source('../public/modules/pet-moments.js'), arcade = source('../public/modules/arcade.js'), petbook = source('../public/modules/petbook.js'), css = source('../public/v13118.css'), build = source('./build-assets.mjs'), student = source('../public/modules/student.js'), celebrate = source('../public/modules/celebrate.js');
  assert(lucky.includes('export function mythicShow(') && lucky.includes('if (res.mythic) return mythicShow(res, { again, againLabel });') && lucky.includes('/assets/reveal/bg-${key}.webp') && lucky.includes('/assets/pets/${key}-reveal.webp') && ['mythic-crack-1', 'mythic-crack-2', 'mythic-crack-3', 'mythic-crack-4', 'mythic-rays', 'mythic-ring', 'mythic-stars', 'mythic-aurora'].every(name => lucky.includes(`/assets/fx/${name}.webp`)) && ['mythic-egg', 'mythic-banner', 'mythic-badge', 'mythic-aura', 'mythic-sparkles'].every(name => lucky.includes(`/assets/ui/${name}.webp`)),
    'V13.118 신화 연출은 펫의 장면 배경, 알·균열 4단계·빛·링·별·오로라, 이름 컷, 등장 포즈를 모두 쓴다');
  assert(/function mythicShow[\s\S]{0,6000}if \(reduced\(\)\) return showResult\(\);/.test(lucky) && lucky.includes("SFX.mythic()") && lucky.includes("snd('fanfare-mythic'") && lucky.includes('건너뛰기') && css.includes('@media (prefers-reduced-motion:reduce)'),
    'V13.118 신화 연출은 움직임 줄이기를 지키고(바로 결과), 눌러서 건너뛸 수 있고, 신화 팡파르 소리가 난다');
  assert(moments.includes('if (res.mythic) { await mythicShow(res); return true; }') && moments.includes('if (res.mythic || res.legendary || res.epic || res.limited) { onChanged?.()') && arcade.includes('if (res.mythic || res.legendary || res.epic) {') && celebrate.includes("tier === 'mythic'") && celebrate.includes("mythic: '신화'"),
    'V13.118 알 상점·코인 뽑기·선생님 알 선물이 신화 결과를 연출/카드로 보여 준다');
  assert(petbook.includes('MYTHIC_PET_KEYS.map') && petbook.includes('pb-section mythic') && petbook.includes('MYTHIC_RATE.basic') && petbook.includes("['신화 펫', '모든 알에서 아주 낮은 확률', MYTHIC_PET_KEYS, ' mythic']") && student.includes('ACTIVE_PET_KEYS') && !student.includes('Object.keys(CHARACTERS)') && student.includes('CHARACTERS[key].legendary || CHARACTERS[key].mythic'),
    'V13.118 도감(학생·선생님)에 신화 펫 칸과 얻는 법이 있고, 내 펫 개수는 숨긴 불새를 빼고 센다');
  assert(css.includes('.mx-bg{') && css.includes('.mx.p4 .mx-flash') && css.includes('.pb-card.mythic') && build.includes('"v13118.css"'), 'V13.118 신화 연출·도감 CSS(v13118.css)가 빌드에 들어간다');
  const asset = (dir, name, ext = 'webp') => existsSync(here(`../public/assets/${dir}/${name}.${ext}`));
  assert(MYTHIC.every(key => asset('reveal', `bg-${key}`) && asset('pets', `${key}-reveal`)) && asset('pets', 'cheonma-reveal') && ['mythic-crack-1', 'mythic-crack-2', 'mythic-crack-3', 'mythic-crack-4', 'mythic-rays', 'mythic-ring', 'mythic-stars', 'mythic-aurora'].every(name => asset('fx', name)) && ['mythic-egg', 'mythic-banner', 'mythic-badge', 'mythic-aura', 'mythic-sparkles', 'mythic-frame'].every(name => asset('ui', name)) && asset('sfx', 'fanfare-mythic', 'mp3')
    && [...MYTHIC, 'cheonma'].every(key => [0, 1, 2, 3].every(f => asset('pets', `${key}-${f}`) && asset('pets', `${key}-${f}-s`)) && [1, 2, 3].every(f => ['happy', 'eat', 'sad', 'cheer'].every(e => asset('pets', `${key}-${f}-${e}`))) && asset('pets', `${key}-0-happy`) && asset('pets', `${key}-0-eat`)),
    'V13.118 신화 5종·천마의 그림(알·4단계·표정·알 반응·등장 포즈·장면 배경)과 연출 그림·팡파르 소리가 모두 있다');
}
