// V13.168 검사: 새 펫 14종(12지 기본 6 · 영웅 6 · 신화 2). release-check가 부른다.
// 그림이 다 들어온 펫만 알 · 선물 · 사냥 · 낚시 교환소 · 뽑기 · 도감에 나온다(public/modules/pet-art.js → core.js petReady).
// 특기(기본 · 영웅 12종은 기존 계열 안에서, 다른 특기보다 세지 않게), 신화 2종의 특기는 V13.185(server/pet-skills-all-check.mjs), 칭호 '12지 수호자', 도감 '곧 만나요',
// 그림 주문서 36 · 37 · 38(Drive 그림체 맞추기 · 정해진 폴더와 파일 이름, slice-map, CODEX_PROMPT).
import { readFileSync, readdirSync, existsSync, mkdtempSync, writeFileSync, copyFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { CHARACTERS, STANDARD_PET_KEYS, EPIC_PET_KEYS, LEGENDARY_PET_KEYS, MYTHIC_PET_KEYS, ACTIVE_PET_KEYS, SOON_PET_KEYS, ZODIAC_PET_KEYS, EGG_PRICE, EPIC_EGG_PRICE, petReady, petTier } from '../public/modules/core.js';
import { PET_ART, PET_FIGHT, PET_REVEAL, PET_TITLE_ART } from '../public/modules/pet-art.js';
import { PET_SKILLS, petSkill } from '../public/modules/battle-engine.js';
import { elementOf, SIGNATURE_KEYS } from '../public/modules/battle-fx.js';
import { expressionSrc } from '../public/modules/character.js';
import { TITLES, TITLE_COINS, titleCoins, titleUnlocked, titleProgress } from '../public/modules/titles.js';
import { TITLE_ART } from '../public/modules/emblems.js';
import { createCompetition } from './competition.mjs';
import { openEgg, giftEggPick, mythicRoll, setMythicRandom } from './rewards.mjs';
import { field as petField, baseSkillPets } from './pet-sim.mjs';
import { sheets36, codexPrompt, FILES_36, DRIVE_36, PETS_36, PAIRS_36 } from '../docs/asset-requests/runner/build-36.mjs';

const here = path => fileURLToPath(new URL(path, import.meta.url));
const source = path => readFileSync(here(path), 'utf8');
export const ZODIAC_168 = ['mouse', 'calf', 'tiger', 'pony', 'monkey', 'rooster'];
export const EPIC_168 = ['flamingo', 'quokka', 'chameleon', 'polarbear', 'snowleopard', 'hummingbird'];
export const MYTHIC_168 = ['hwangryong', 'samjogo'];
const NEW = [...ZODIAC_168, ...EPIC_168, ...MYTHIC_168];
const SKILLED = [...ZODIAC_168, ...EPIC_168];
// 특기 세기(단순 합): 바로 피해 + 공격 보너스 + 막기 + 회복 + 독 × 문제 수.
const budget = s => (s.burst || 0) + (s.boost || []).reduce((a, b) => a + b, 0) + (s.guard || []).reduce((a, b) => a + b, 0) + (s.heal || 0) + (s.poison || 0) * (s.turns || 0);

export async function runNewPets168Checks(assert) {
  /* ---------- 등록 ---------- */
  assert(NEW.every(key => CHARACTERS[key]?.ko && CHARACTERS[key].type && /^#[0-9A-F]{6}$/.test(CHARACTERS[key].color) && /^#[0-9A-F]{6}$/.test(CHARACTERS[key].light) && /^#[0-9A-F]{6}$/.test(CHARACTERS[key].soft) && CHARACTERS[key].artOrder)
    && ZODIAC_168.every(key => petTier(key) === 'basic' && CHARACTERS[key].artOrder === 36) && EPIC_168.every(key => petTier(key) === 'epic' && CHARACTERS[key].artOrder === 37)
    && MYTHIC_168.every(key => petTier(key) === 'mythic' && CHARACTERS[key].artOrder === 38) && NEW.every(key => !CHARACTERS[key].legendary && !CHARACTERS[key].limited && !CHARACTERS[key].sea),
    'V13.168 새 펫 14종: 12지 기본 6(찍찍이 · 음매 · 어흥 · 다그닥 · 끼끼 · 꼬꼬) · 영웅 6(밍고 · 방긋 · 카멜 · 눈곰 · 설표 · 윙윙) · 신화 2(황룡 · 삼족오)');
  const names = Object.values(CHARACTERS).map(c => c.ko);
  assert(new Set(names).size === names.length && !NEW.some(key => ['핑키', '핑크'].includes(CHARACTERS[key].ko)) && CHARACTERS.flamingo.ko === '밍고',
    'V13.168 펫 이름은 겹치지 않는다(플라밍고 시안 "핑크"는 돼지 "핑키"와 헷갈려서 "밍고")');
  assert(ZODIAC_PET_KEYS.length === 12 && new Set(ZODIAC_PET_KEYS).size === 12 && ZODIAC_PET_KEYS.every(key => CHARACTERS[key] && petTier(key) === 'basic' && !CHARACTERS[key].retired)
    && ['rabbit', 'dragon', 'snake', 'sheep', 'dog', 'pig', ...ZODIAC_168].every(key => ZODIAC_PET_KEYS.includes(key)),
    'V13.168 12지 12마리는 모두 기본 펫이다(기존 토끼 · 용 · 뱀 · 양 · 개 · 돼지 + 새 쥐 · 소 · 호랑이 · 말 · 원숭이 · 닭)');

  /* ---------- 그림이 들어온 펫만 ---------- */
  const files = new Set(readdirSync(here('../public/assets/pets'))), reveal = new Set(readdirSync(here('../public/assets/reveal'))), has = name => files.has(`${name}.webp`);
  const artOf = key => [0, 1, 2, 3].every(f => has(`${key}-${f}`) && has(`${key}-${f}-s`) && (f ? ['happy', 'eat', 'sad', 'cheer'] : ['happy', 'eat']).every(e => has(`${key}-${f}-${e}`)));
  const allKeys = [...new Set([...files].map(f => f.match(/^([a-z]+)-0\.webp$/)?.[1]).filter(Boolean))];
  assert(allKeys.every(key => artOf(key) === PET_ART.has(key)) && [...PET_ART].every(artOf)
    && allKeys.every(key => [1, 2, 3].every(f => has(`${key}-${f}-attack`) && has(`${key}-${f}-hurt`)) === PET_FIGHT.has(key))
    && allKeys.every(key => (has(`${key}-reveal`) && reveal.has(`bg-${key}.webp`)) === PET_REVEAL.has(key))
    && source('./build-assets.mjs').includes("public/modules/pet-art.js"),
    'V13.168 pet-art.js는 그림 폴더와 같다(build:assets가 만든다): 기본 · 작은 그림 · 표정 · 알 반응이 다 있는 펫, 공격 · 맞음, 신화 등장 포즈 · 배경');
  const ready = NEW.filter(petReady), waiting = NEW.filter(key => !petReady(key));
  assert(waiting.every(key => ![...STANDARD_PET_KEYS, ...EPIC_PET_KEYS, ...LEGENDARY_PET_KEYS, ...MYTHIC_PET_KEYS, ...ACTIVE_PET_KEYS].includes(key)) && SOON_PET_KEYS.join() === waiting.join()
    && ready.every(key => ACTIVE_PET_KEYS.includes(key) && (petTier(key) === 'basic' ? STANDARD_PET_KEYS : petTier(key) === 'epic' ? EPIC_PET_KEYS : MYTHIC_PET_KEYS).includes(key))
    && NEW.every(key => petReady(key) === (PET_ART.has(key) && (petTier(key) !== 'mythic' || PET_REVEAL.has(key))))
    && Object.keys(CHARACTERS).filter(key => !CHARACTERS[key].artOrder).every(petReady),
    `V13.168 그림이 다 들어온 새 펫만 알 · 도감 목록에 들어간다(지금 준비 ${ready.length} · 그림 기다림 ${waiting.length}), 기존 펫은 그대로`);
  // 그림이 들어오면: 같은 core.js에 그림 목록만 바꿔 끼워 본다(새 펫 14종이 모두 목록에 들어간다).
  {
    const dir = mkdtempSync(join(tmpdir(), 'pet-art-'));
    try {
      copyFileSync(here('../public/modules/core.js'), join(dir, 'core.js'));
      copyFileSync(here('../public/modules/rewards.js'), join(dir, 'rewards.js'));
      writeFileSync(join(dir, 'pet-art.js'), `export const PET_ART = new Set(${JSON.stringify([...PET_ART, ...NEW])});\nexport const PET_FIGHT = new Set();\nexport const PET_REVEAL = new Set(${JSON.stringify([...PET_REVEAL, ...MYTHIC_168])});\nexport const PET_TITLE_ART = new Set();\n`);
      const full = await import(pathToFileURL(join(dir, 'core.js')).href + '?art');
      assert(ZODIAC_168.every(key => full.STANDARD_PET_KEYS.includes(key)) && EPIC_168.every(key => full.EPIC_PET_KEYS.includes(key)) && MYTHIC_168.every(key => full.MYTHIC_PET_KEYS.includes(key))
        && full.SOON_PET_KEYS.length === 0 && full.STANDARD_PET_KEYS.length === STANDARD_PET_KEYS.length + ZODIAC_168.filter(k => !petReady(k)).length && full.ACTIVE_PET_KEYS.length === ACTIVE_PET_KEYS.length + waiting.length && full.petReady('hwangryong'),
        'V13.168 그림이 들어오면(build:assets) 앱 코드를 고치지 않아도 새 펫이 랜덤 알 · 영웅 알 · 신화 목록에 들어간다');
      // 같은 파일은 다시 읽히지 않으므로(모듈 캐시) 신화 등장 그림이 없는 목록은 다른 이름으로 둔다.
      writeFileSync(join(dir, 'pet-art2.js'), `export const PET_ART = new Set(${JSON.stringify([...PET_ART, ...NEW])});\nexport const PET_FIGHT = new Set();\nexport const PET_REVEAL = new Set(${JSON.stringify([...PET_REVEAL].filter(key => !MYTHIC_168.includes(key)))});\nexport const PET_TITLE_ART = new Set();\n`);
      writeFileSync(join(dir, 'core2.js'), readFileSync(join(dir, 'core.js'), 'utf8').replace("from './pet-art.js'", "from './pet-art2.js'"));
      const noShow = await import(pathToFileURL(join(dir, 'core2.js')).href);
      assert(!noShow.petReady('hwangryong') && !noShow.MYTHIC_PET_KEYS.includes('samjogo') && noShow.SOON_PET_KEYS.join() === MYTHIC_168.join(), 'V13.168 신화 펫은 등장 포즈 · 등장 배경까지 있어야 나온다(연출이 깨지지 않게)');
    } finally { rmSync(dir, { recursive: true, force: true }); }
  }
  // 서버 경로: 상점 알 · 영웅 알 · 선생님 선물 알 · 신화 · 사냥 '?' 펫 · 낚시 · 사냥 교환소 알은 모두 core.js 목록을 쓴다.
  const service = source('./service.mjs'), rewards = source('./rewards.mjs'), hunt = source('./hunt.mjs');
  assert((service.match(/\(epic \? EPIC_PET_KEYS : STANDARD_PET_KEYS\)\.filter\(key => !p\.pets\.some/g) || []).length >= 2 && service.includes('(season ? season.keys : epic ? EPIC_PET_KEYS : STANDARD_PET_KEYS)')
    && rewards.includes('const left = { basic: STANDARD_PET_KEYS.filter(k => !has(k)), epic: EPIC_PET_KEYS.filter(k => !has(k)) };') && rewards.includes('const left = MYTHIC_PET_KEYS.filter(')
    && hunt.includes("const missing = p => ({ basic: STANDARD_PET_KEYS.filter(k => !has(p, k)), epic: EPIC_PET_KEYS.filter(k => !has(p, k)) });"),
    'V13.168 상점 알 · 영웅 알 · 낚시 · 사냥 교환소 알 · 선생님 선물 알 · 신화 · 몬스터 사냥 펫 "?"은 모두 core.js 목록(그림이 있는 펫)에서 고른다');
  const everyone = { pets: [...STANDARD_PET_KEYS, ...EPIC_PET_KEYS, ...LEGENDARY_PET_KEYS.slice(0, 1)].map(key => ({ key })) };
  setMythicRandom(() => 0);
  try {
    const mythicLeft = mythicRoll({ pets: MYTHIC_PET_KEYS.map(key => ({ key })) }, 'basic');
    const egg = openEgg({ pets: [{ key: 'dog' }] }, { epic: false, missing: STANDARD_PET_KEYS.filter(k => k !== 'dog'), price: EGG_PRICE, random: () => 0 });
    assert(mythicLeft === null && egg.key && (egg.mythic ? MYTHIC_PET_KEYS : STANDARD_PET_KEYS).includes(egg.key) && waiting.every(key => egg.key !== key),
      'V13.168 신화 확률 · 연출은 그대로이고, 그림을 기다리는 신화 펫은 나오지 않는다');
  } finally { setMythicRandom(null); }
  assert(giftEggPick(everyone, () => .5) === null && waiting.every(key => ![0, .2, .5, .9, .999].some(r => giftEggPick({ pets: [{ key: 'dog' }] }, () => r)?.key === key)),
    'V13.168 선생님 선물 알도 그림이 있는 펫만(그림을 기다리는 펫이 없으면 모든 펫을 모은 학생은 코인을 받는다)');

  /* ---------- 그림 · 표정 ---------- */
  assert(NEW.every(key => [1, 2, 3].every(f => expressionSrc(key, f, 'happy') === `/assets/pets/${key}-${f}-happy.webp` && expressionSrc(key, f, 'cheer') === `/assets/pets/${key}-${f}-cheer.webp`
    && expressionSrc(key, f, 'attack') === (PET_FIGHT.has(key) ? `/assets/pets/${key}-${f}-attack.webp` : `/assets/pets/${key}-${f}-cheer.webp`)) && expressionSrc(key, 0, 'eat') === `/assets/pets/${key}-0-eat.webp`),
    'V13.168 새 펫 표정 · 알 반응이 연결되고, 공격 · 맞음 그림은 다 들어왔을 때만 쓴다(없으면 응원 · 시무룩)');

  /* ---------- 야차전 특기 ---------- */
  const old = baseSkillPets().filter(key => !NEW.includes(key));
  const maxBudget = need => Math.max(...old.filter(key => (PET_SKILLS[key].need || 3) === need).map(key => budget(PET_SKILLS[key])));
  const KINDS = ['burst', 'boost', 'guard', 'heal', 'poison', 'turns', 'need', 'name', 'desc'];
  assert(SKILLED.every(key => PET_SKILLS[key]?.name && PET_SKILLS[key].desc && petSkill({ key }).key === key && Object.keys(PET_SKILLS[key]).every(k => KINDS.includes(k)) && budget(PET_SKILLS[key]) <= maxBudget(PET_SKILLS[key].need || 3))
    && new Set(Object.values(PET_SKILLS).map(s => s.name)).size === Object.keys(PET_SKILLS).length,
    'V13.168 새 기본 · 영웅 12종은 특기가 하나씩 있고, 기존 계열(바로 피해 · 공격 보너스 · 막기 · 회복 · 독) 안에서 기존 특기보다 세지 않다(같은 연속 조건의 기존 최대 세기 이하)');
  assert(MYTHIC_168.every(key => petSkill({ key }).key === key) && LEGENDARY_PET_KEYS.every(key => petSkill({ key }).key === key),
    'V13.185 신화 황룡 · 삼족오와 전설 펫에도 특기가 있다(V13.168에는 없었다. 세기는 server/pet-skills-all-check.mjs)');
  const r = petField(baseSkillPets(), { n: 6, seed: 9 });
  const top = mode => Math.max(...old.map(key => r[mode][key]));
  const off = SKILLED.filter(key => !['speed', 'skill'].every(mode => r[mode][key] > .42 && r[mode][key] < .58 && r[mode][key] <= top(mode) + .005));
  assert(!off.length, `V13.168 새 12종은 두 야차전 모드에서 전체 펫 상대 승률 42~58% 안이고 기존 가장 센 펫보다 높지 않다(조정은 47~54%로 맞춤)${off.length ? ': ' + off.join(' ') : ''}`);
  assert(NEW.every(key => elementOf(key) && (key === 'hummingbird' || key === 'hwangryong' || elementOf(key) !== 'star')) && MYTHIC_168.every(key => SIGNATURE_KEYS.includes(key)),
    'V13.168 새 펫마다 공격 속성이 있고, 신화 2종은 필살 연출(황룡 오방색 구슬 · 삼족오 태양)을 가진다');

  /* ---------- 칭호 12지 수호자 ---------- */
  const t = TITLES.zodiac12;
  assert(t && t.name === '12지 수호자' && t.tier === 'legendary' && t.group === 'collect' && t.stat === 'zodiac_pets' && t.goal === 12 && titleCoins('zodiac12') === TITLE_COINS.legendary && TITLES.pets20.tier === 'legendary'
    && titleProgress('zodiac12', { zodiac_pets: 11 })?.[0] === 11 && !titleUnlocked('zodiac12', { zodiac_pets: 11 }) && titleUnlocked('zodiac12', { zodiac_pets: 12 }),
    'V13.168 칭호 "12지 수호자": 12지 펫 12마리를 모두 만나면(전설 등급, 펫 박물관 · 살아있는 도감과 같은 120코인)');
  const kid = { id: 'qa-z', role: 'student', school_id: 'a', school: 'A고', class_name: '고1A', pets: [...ZODIAC_PET_KEYS, 'cat'].map(key => ({ key })) };
  const kid2 = { ...kid, id: 'qa-z2', pets: ZODIAC_PET_KEYS.slice(1).map(key => ({ key })) };
  const comp = createCompetition({ profiles: [kid, kid2], sessions: [], battles: [], mastery: {}, examAttempts: [], schools: [], tournaments: [] }, Date.now());
  const s1 = comp.titleStats(kid), s2 = comp.titleStats(kid2);
  assert(s1.zodiac_pets === 12 && titleUnlocked('zodiac12', s1) && s2.zodiac_pets === 11 && !titleUnlocked('zodiac12', s2), 'V13.168 12지 펫 수를 학생 펫에서 바로 센다(12마리면 칭호, 11마리면 아직)');
  assert(PET_TITLE_ART.has('zodiac12') === (existsSync(here('../public/assets/titles/zodiac12.webp')) && existsSync(here('../public/assets/titles/zodiac12-s.webp'))) && TITLE_ART.has('zodiac12') === PET_TITLE_ART.has('zodiac12'),
    'V13.168 12지 수호자 메달 그림(그림 36d)이 들어오면 자동으로 쓰고, 그 전에는 그려진 메달');

  /* ---------- 도감 · 화면 ---------- */
  const petbook = source('../public/modules/petbook.js'), battle = source('../public/modules/battle.js'), css = source('../public/v13168.css'), build = source('./build-assets.mjs');
  assert(petbook.includes('function soonCard(key)') && petbook.includes('SOON_PET_KEYS.map(soonCard)') && petbook.includes('곧 만나요') && (petbook.match(/\$\{soonSection\(\)\}/g) || []).length === 2 && !/soonCard[^\n]*c\.ko/.test(petbook)
    && css.includes('.pb-card.pb-soon') && build.includes('"v13168.css"') && battle.includes('Object.entries(PET_SKILLS).filter(([key]) => petReady(key))'),
    'V13.168 도감(학생 · 선생님)에 그림을 기다리는 펫이 이름 없이 "곧 만나요" 그림자로 나오고, 야차전 "모든 펫의 특기"에는 나오지 않는다');

  /* ---------- 그림 주문서 36 · 37 · 38 ---------- */
  const list = sheets36(), R = '../docs/asset-requests/runner/';
  assert(list.length === 88 && list.filter(s => s.series === 36).length === 37 && list.filter(s => s.series === 37).length === 36 && list.filter(s => s.series === 38).length === 15
    && Object.keys(PETS_36).join() === NEW.join() && Object.values(PAIRS_36).flat(2).sort().join() === [...NEW].sort().join(),
    'V13.168 그림 주문서 88시트: 36(12지 37) · 37(영웅 36) · 38(신화 15)');
  assert(list.every(s => s.text.includes('STYLE REFERENCE — before drawing, open') && s.text.includes('Google Drive') && s.text.includes(`into the folder "${DRIVE_36[s.series]}", named exactly "${s.name}.png"`)),
    'V13.168 모든 시트에 "Drive의 기존 그림을 열어 그림체를 맞추라"와 "정해진 Drive 폴더에 정확한 파일 이름으로 저장하라"가 들어 있다');
  const outs = new Set(list.flatMap(s => s.cells.map(c => c.out)));
  const need = key => [0, 1, 2, 3].flatMap(f => [`${key}-${f}`, ...(f ? ['happy', 'eat', 'sad', 'cheer', 'attack', 'hurt'] : ['happy', 'eat']).map(e => `${key}-${f}-${e}`)]).map(n => `public/assets/pets/${n}.webp`);
  assert(NEW.every(key => need(key).every(o => outs.has(o))) && MYTHIC_168.every(key => outs.has(`public/assets/pets/${key}-reveal.webp`) && outs.has(`public/assets/reveal/bg-${key}.webp`)) && outs.has('public/assets/titles/zodiac12.webp'),
    'V13.168 주문서가 펫마다 앱이 읽는 그림(알 · 아기 · 성장 · 최종, 표정, 알 반응, 공격 · 맞음, 신화 등장 포즈 · 배경)과 12지 수호자 메달을 모두 주문한다');
  const map = source(R + 'slice-map.csv').split('\n').filter(line => /^"3[678][a-e]-/.test(line));
  assert(map.length === list.reduce((n, s) => n + s.cells.length, 0) && Object.values(FILES_36).every(file => source(R + file) === list.filter(s => s.file === file).map(s => s.text).join('\n---\n') + '\n')
    && list.every(s => existsSync(here(`${R}split/${s.name} ${s.title.replace(/[\\/:*?"<>|()]/g, '').replace(/\s+/g, ' ').trim()}.txt`))),
    'V13.168 주문서 파일 · split/ 시트별 파일 · slice-map.csv가 build-36.mjs와 같다(이름은 core.js에서 읽는다)');
  assert([36, 37, 38].every(series => source(`${R}CODEX_PROMPT_${series}.md`) === codexPrompt(series, list) && codexPrompt(series, list).includes(DRIVE_36[series]) && codexPrompt(series, list).includes('머지하지 않는다')
    && codexPrompt(series, list).includes('pet-art.js')) && source(R + 'README.md').includes('CODEX_PROMPT_36.md') && source(R + 'README.md').includes('CODEX_PROMPT_38.md'),
    'V13.168 CODEX_PROMPT_36 · 37 · 38.md(자르기 명령 · 참고 그림 · 그림이 다 들어온 펫만 자동으로 나옴)와 README');
}
