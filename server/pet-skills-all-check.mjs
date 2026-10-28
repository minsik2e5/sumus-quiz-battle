// V13.185 검사: 모든 펫에 야차전 특기(선생님 결정). 전설 · 신화 · 한정 17종 모두 특기 있음, 설명 숫자 = 코드 숫자,
// 등급 세기(합계 가치: 전설 > 영웅 평균, 신화 > 전설), pet-sim 승률(빠른 판 수), 도감 · 대결 화면에 "특기 없음"이 남지 않음,
// 봇(몽이) · 몬스터 특기와 섞이지 않음, 실제 대결에서 전설 펫 특기가 발동. 표: docs/pet-skills-balance.md
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { PET_SKILLS, PET_SKILL_TIERS, MONSTER_SKILLS, petSkill, createBattle, connect, answer, tick } from '../public/modules/battle-engine.js';
import { CHARACTERS, STANDARD_PET_KEYS, EPIC_PET_KEYS, LEGENDARY_PET_KEYS, MYTHIC_PET_KEYS, LIMITED_PET_KEYS } from '../public/modules/core.js';
import { tierField, groupRate } from './pet-sim.mjs';

const source = path => readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8');
const KINDS = ['name', 'desc', 'burst', 'boost', 'guard', 'heal', 'poison', 'turns', 'need'];
export const skillValue = s => (s.burst || 0) + (s.boost || []).reduce((a, b) => a + b, 0) + (s.guard || []).reduce((a, b) => a + b, 0) + (s.heal || 0) + (s.poison || 0) * (s.turns || 0);
// The numbers a skill's text must show: every amount, how many times (2번 · 3번) and how many words (3문제).
const codeNumbers = s => new Set([s.burst, s.heal, s.poison, s.turns, ...(s.boost || []), ...(s.guard || []), s.boost?.length > 1 && s.boost.length, s.guard?.length > 1 && s.guard.length, s.need && s.need !== 3 && s.need].filter(Boolean));
const descNumbers = desc => new Set((desc.match(/\d+/g) || []).map(Number));
const avg = keys => keys.reduce((a, k) => a + skillValue(PET_SKILLS[k]), 0) / keys.length;

export async function runPetSkillsAllChecks(assert) {
  const { legendary, mythic, limited } = PET_SKILL_TIERS, ALL = [...legendary, ...mythic, ...limited];

  /* ---------- 17종 모두 특기 ---------- */
  assert(ALL.length === 17 && legendary.every(k => CHARACTERS[k]?.legendary) && mythic.every(k => CHARACTERS[k]?.mythic) && limited.every(k => CHARACTERS[k]?.limited)
    && LEGENDARY_PET_KEYS.every(k => legendary.includes(k)) && legendary.includes('phoenix') && MYTHIC_PET_KEYS.every(k => mythic.includes(k)) && ['hwangryong', 'samjogo'].every(k => mythic.includes(k)) && LIMITED_PET_KEYS.every(k => limited.includes(k)),
    'V13.185 전설 5(은퇴한 불새 포함) · 신화 7(그림을 기다리는 황룡 · 삼족오 포함) · 한정 5, 17종이 특기 등급 표에 있다');
  assert(Object.keys(CHARACTERS).filter(k => CHARACTERS[k].legendary || CHARACTERS[k].mythic || CHARACTERS[k].limited || CHARACTERS[k].epic || STANDARD_PET_KEYS.includes(k)).every(k => PET_SKILLS[k] && petSkill({ key: k }).key === k) && ALL.every(k => petSkill({ key: k }).need === 3),
    'V13.185 기본 · 영웅 · 전설 · 신화 · 한정 펫 모두 야차전 특기가 있다(게이지 3칸)');
  assert(ALL.every(k => Object.keys(PET_SKILLS[k]).every(x => KINDS.includes(x)) && PET_SKILLS[k].name && !PET_SKILLS[k].need) && new Set(Object.values(PET_SKILLS).map(s => s.name)).size === Object.keys(PET_SKILLS).length,
    'V13.185 새 특기 17종은 기존 계열(바로 피해 · 공격 보너스 · 막기 · 회복 · 독)의 조합만 쓰고, 이름이 겹치지 않는다');
  const wrong = ALL.filter(k => { const a = codeNumbers(PET_SKILLS[k]), b = descNumbers(PET_SKILLS[k].desc); return a.size !== b.size || [...a].some(x => !b.has(x)); });
  assert(!wrong.length, `V13.185 새 특기 설명의 숫자가 코드의 숫자와 같다${wrong.length ? ': ' + wrong.join(' ') : ''}`);

  /* ---------- 등급 세기(합계 가치) ---------- */
  const H = avg(EPIC_PET_KEYS), L = avg(legendary), M = avg(mythic), B = avg(STANDARD_PET_KEYS), X = avg(limited);
  assert(L / H >= 1.03 && L / H <= 1.11 && M / L >= 1.03 && M / L <= 1.11 && legendary.every(k => skillValue(PET_SKILLS[k]) >= 15 && skillValue(PET_SKILLS[k]) <= 18) && mythic.every(k => skillValue(PET_SKILLS[k]) >= 17 && skillValue(PET_SKILLS[k]) <= 18),
    `V13.185 합계 가치: 전설 평균이 영웅 평균보다, 신화 평균이 전설 평균보다 약 6%(3~11%) 크다 (영웅 ${H.toFixed(1)} · 전설 ${L.toFixed(1)} · 신화 ${M.toFixed(1)})`);
  assert(X >= B && X <= L && limited.every(k => skillValue(PET_SKILLS[k]) <= 17), `V13.185 한정 펫 특기는 기본 펫 정도(합계 가치 기본 ${B.toFixed(1)} · 한정 ${X.toFixed(1)}, 전설보다 작다)`);

  /* ---------- pet-sim 승률(빠른 판 수, 표는 n=300) ---------- */
  const rate = {};
  // 상대가 5마리뿐인 신화 vs 전설은 판을 더 돌린다(그래도 2초 안팎).
  for (const [pets, groups, n] of [[legendary, ['H'], 8], [mythic, ['L'], 30], [mythic, ['H'], 8], [limited, ['B'], 8]]) {
    const r = tierField(pets, { n, groups, seed: 31 });
    for (const m of ['speed', 'skill']) for (const g of groups) rate[`${pets === legendary ? 'L' : pets === mythic ? 'M' : 'X'}${g}.${m}`] = groupRate(r, m, pets, g);
  }
  const off = Object.entries(rate).filter(([k, v]) => !({ LH: [.51, .58], ML: [.505, .58], MH: [.53, .61], XB: [.46, .54] })[k.split('.')[0]].every((x, i) => i ? v <= x : v >= x));
  assert(!off.length && ['speed', 'skill'].every(m => rate['MH.' + m] > rate['LH.' + m]),
    `V13.185 시뮬레이션 승률(두 모드): 전설 vs 영웅 51~58% · 신화 vs 전설 50.5~58% · 신화 vs 영웅 53~61%(신화 > 전설) · 한정 vs 기본 46~54% (n=300 표는 53~55 · 53~54 · 56~59 · 47~53)${off.length ? ': ' + off.map(([k, v]) => `${k} ${(v * 100).toFixed(1)}`).join(' ') : ''}`);

  /* ---------- 봇 · 몬스터와 섞이지 않음 ---------- */
  assert(petSkill(null).key === 'dog' && petSkill({ key: 'robot' }).key === 'dog' && petSkill({ key: 'haechi', skill: 'roar' }).key === 'roar' && Object.keys(MONSTER_SKILLS).every(k => !PET_SKILLS[k]),
    'V13.185 연습 로봇 · 펫 없음은 몽이 특기, 몬스터는 몬스터 특기 그대로');

  /* ---------- 실제 대결에서 발동 ---------- */
  for (const key of ['haechi', 'hwangryong', 'riceball']) {
    const q = Array.from({ length: 12 }, (_, i) => ({ word_id: 'w' + i, prompt: 'w' + i, options: ['a', 'b', 'c', 'd'], answer: 0 }));
    const s = createBattle({ id: 'q', players: [{ id: 'A', name: 'A', pet: { key, form: 2 } }, { id: 'B', name: 'B', pet: { key: 'dog', form: 1 } }], questions: q, now: 0 });
    connect(s, 'A', 0); connect(s, 'B', 0);
    let now = 0, events = [];
    for (let i = 0; i < 3; i++) {
      now = s.deadline; tick(s, now);
      if (s.phase !== 'question') { now = s.deadline; tick(s, now); }
      events.push(...answer(s, 'A', 0, now + 3000, s.idx), ...answer(s, 'B', 1, now + 3100, s.idx));
    }
    const fired = events.find(e => e.type === 'petskill');
    assert(fired?.skill === key && fired.name === PET_SKILLS[key].name && s.players.A.skills_used === 1, `V13.185 ${CHARACTERS[key].ko} 특기가 3연속 정답에 실제 대결에서 발동한다`);
  }

  /* ---------- 화면 · 규칙 문서 ---------- */
  const engine = source('../public/modules/battle-engine.js'), battle = source('../public/modules/battle.js'), petbook = source('../public/modules/petbook.js'), rules = source('../CLAUDE.md');
  assert(!/NO_SKILL_PETS|SKILLESS|특기를 사용하지/.test(engine) && !/특기 없음|펫 특기가 없어요|펫 특기 없이|key === 'none'/.test(battle) && !/특기 대신/.test(petbook) && petbook.includes("pb-skill${season ? ' limited' : mythic ? ' mythic' : legend ? ' gold' : ''}"),
    'V13.185 엔진 · 대결 화면 · 펫 도감에 "특기 없음" 문구가 남지 않고, 도감 특기 줄은 등급 색(전설 금 · 신화 보라 · 한정)으로 나온다');
  assert(!rules.includes('전설 펫에는 야차전 특기가 없다') && rules.includes('전설 · 신화 · 한정 펫에도 야차전 특기가 있다'), 'V13.185 CLAUDE.md 규칙이 "모든 펫에 특기"로 바뀌었다');
}
