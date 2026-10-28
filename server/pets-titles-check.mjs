// V13.148 새 펫 3탄(그림 24) · 칭호 2탄(그림 25) 등록 검사. release-check가 부른다.
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { CHARACTERS, STANDARD_PET_KEYS, EPIC_PET_KEYS, EGG_PRICE, EPIC_EGG_PRICE } from '../public/modules/core.js';
import { TITLES, TITLE_COINS, titleUnlocked, titleProgress, weeklyTitle } from '../public/modules/titles.js';
import { TITLE_ART } from '../public/modules/emblems.js';
import { PET_SKILLS, petSkill } from '../public/modules/battle-engine.js';
import { elementOf } from '../public/modules/battle-fx.js';
import { expressionSrc } from '../public/modules/character.js';
import { createCompetition, REMATCH_MS } from './competition.mjs';
import { openEgg, pullLucky, monsterStart, monsterFinish } from './rewards.mjs';
import { field as petField, baseSkillPets } from './pet-sim.mjs';
import './service.mjs'; // '한 과 정복' 수를 세는 함수를 competition.mjs에 걸어 둔다

const here = path => fileURLToPath(new URL(path, import.meta.url));
const read = path => readFileSync(here(path), 'utf8');
export const NEW_BASIC_148 = ['elephant', 'meerkat', 'raccoondog', 'longtit', 'hippo'];
export const NEW_EPIC_148 = ['guineapig', 'axolotl', 'chinchilla', 'sloth', 'platypus'];
const TIER_KO = { 일반: 'common', 희귀: 'rare', 영웅: 'epic', 전설: 'legendary', 한정: 'limited' };

export function runPetsTitlesChecks(assert) {
  /* ---------- 새 펫 10종 ---------- */
  const fresh = [...NEW_BASIC_148, ...NEW_EPIC_148];
  assert(NEW_BASIC_148.every(key => STANDARD_PET_KEYS.includes(key) && !CHARACTERS[key].epic) && NEW_EPIC_148.every(key => EPIC_PET_KEYS.includes(key) && CHARACTERS[key].epic)
    && fresh.every(key => CHARACTERS[key].ko && CHARACTERS[key].type && /^#[0-9A-F]{6}$/.test(CHARACTERS[key].color) && !CHARACTERS[key].legendary && !CHARACTERS[key].limited),
    'V13.148 새 펫 10종: 기본 5(코롱 · 쫑긋 · 너굴 · 포롱 · 하뭉)는 랜덤 알, 영웅 5(꾸이 · 우파 · 친친 · 늘보 · 납작)는 영웅 알에 들어간다');
  const basicEgg = openEgg({ pets: [{ key: 'dog' }] }, { epic: false, missing: NEW_BASIC_148, price: EGG_PRICE, random: () => 0 });
  const epicEgg = openEgg({ pets: [{ key: 'dog' }, { key: 'haechi' }] }, { epic: true, missing: NEW_EPIC_148, price: EPIC_EGG_PRICE, random: () => .999 });
  assert(basicEgg.key === 'elephant' && epicEgg.key === 'platypus', 'V13.148 알에서 새 펫이 나온다(아직 없는 펫 풀)');
  const asset = name => existsSync(here(`../public/assets/pets/${name}.webp`));
  assert(fresh.every(key => [0, 1, 2, 3].every(f => asset(`${key}-${f}`) && asset(`${key}-${f}-s`) && (f ? ['happy', 'eat', 'sad', 'cheer', 'attack', 'hurt'] : ['happy', 'eat']).every(e => expressionSrc(key, f, e) === `/assets/pets/${key}-${f}-${e}.webp` && asset(`${key}-${f}-${e}`)))),
    'V13.148 새 펫 10종의 그림(단계 · 작은 그림 · 표정 · 알 반응)과 야차전 · 던전 공격 · 맞음 그림이 모두 연결된다');
  assert(fresh.every(key => PET_SKILLS[key]?.name && PET_SKILLS[key].desc && petSkill({ key }).key === key && elementOf(key)), 'V13.148 새 펫마다 야차전 특기와 공격 속성이 있다');
  const r = petField(baseSkillPets(), { n: 10, seed: 5 });
  assert(fresh.every(key => ['speed', 'skill'].every(mode => r[mode][key] > .42 && r[mode][key] < .58)), 'V13.148 새 펫 10종은 두 야차전 모드에서 전체 펫 상대 승률 42~58% 안이다(조정은 47~54%로 맞춤)');

  /* ---------- 칭호 40개 ---------- */
  const rows = read('../docs/asset-requests/runner/slice-map.csv').split('\n').filter(line => line.startsWith('"25-titles-2.txt"'))
    .map(line => line.match(/"((?:[^"]|"")*)"/g).map(cell => cell.slice(1, -1)));
  const keys = rows.map(row => row[6].match(/titles\/([a-z0-9]+)\.webp$/)[1]);
  assert(keys.length === 40 && keys.every(key => TITLES[key] && TITLE_ART.has(key) && existsSync(here(`../public/assets/titles/${key}.webp`)) && existsSync(here(`../public/assets/titles/${key}-s.webp`))),
    'V13.148 칭호 2탄 40개가 모두 등록되고 메달 그림(256px · 96px)이 연결된다');
  assert(rows.every(row => { const key = row[6].match(/titles\/([a-z0-9]+)\.webp$/)[1], [, name, tier] = row[5].match(/^(.+) \((.+)\)$/); return TITLES[key].name === name && TITLES[key].tier === TIER_KO[tier]; }),
    'V13.148 칭호 이름과 등급이 그림 주문서 25(메달 테두리)와 같다');
  assert(keys.every(key => TITLES[key].how && TITLES[key].desc && TITLE_COINS[TITLES[key].tier] > 0) && TITLES.mythic1.once && !weeklyTitle('mythic1') && weeklyTitle('weekly1') && titleProgress('mythic1', { mythic_pets: 0 })?.[1] === 1,
    'V13.148 신화의 주인은 한정 테두리지만 주간 칭호가 아니다(한 번 받으면 계속, 코인도 한 번)');

  // 새 통계: 작은 상태 하나로 칭호마다 실제로 열리는지 본다.
  const DAY = 86400000, sat = Date.parse('2026-10-10T03:00:00Z'), morning = Date.parse('2026-10-12T22:30:00Z'); // 토요일 낮, 화요일 아침 7:30(한국)
  const me = {
    id: 'qa-t2', role: 'student', school_id: 'a', school: 'A고', class_name: '고1A',
    pets: [{ key: 'dog' }, { key: 'haechi' }, { key: 'gumiho' }, { key: 'pumpkincat' }, { key: 'ghost' }, { key: 'riceball' }],
    purchases: Array.from({ length: 5 }, (_, i) => ({ item: i % 2 ? 'epic_egg' : 'egg', at: i })),
    care: { total: 30 }, lucky: { big_best: 2 }, bonus: { monster: { boss_wins: 10, best: 0 } }
  };
  const friend = { id: 'qa-t2b', role: 'student', school_id: 'b', school: 'B고', class_name: '고1A' };
  const mate = { id: 'qa-t2c', role: 'student', school_id: 'a', school: 'A고', class_name: '고1A' };
  const study = (at, extra = {}) => ({ id: 's' + at, student_id: me.id, total: 10, correct: 10, answered_count: 10, created_at: at, duration_sec: 120, xp: 10, ...extra });
  const sessions = [
    ...Array.from({ length: 10 }, (_, i) => study(sat + i * 7 * DAY)), // 토요일 10번
    ...Array.from({ length: 30 }, (_, i) => study(morning + i * DAY)), // 아침 30번
    ...Array.from({ length: 10 }, (_, i) => study(morning + i * DAY + 3600000 * 6, { reward_event: { id: 'ev' } }))
  ];
  const match = (opp, at, start = at - 120000) => ({ id: `${opp}-${at}`, status: 'finished', host_id: me.id, guest_id: opp, winner: me.id, loser: opp, reason: 'end', hp: { [me.id]: 100 }, max_hp: 250, created_at: start, finished_at: at });
  const battles = [];
  // 다른 학교 친구에게 15승(하루 3판까지만 센다). 같은 날 3판은 앞 판이 끝나고 바로 다시 한 판이다.
  for (let d = 0; d < 5; d++) for (let k = 0; k < 3; k++) { const at = sat + d * DAY + k * 300000; battles.push(match(friend.id, at, at - 200000)); }
  battles.push(match(mate.id, sat + 9 * DAY));
  const mastery = { [me.id]: Object.fromEntries(Array.from({ length: 50 }, (_, i) => [`w${i}`, { correct: 2, wrong: 1, streak: 1 }]).concat([['wx', { correct: 0, wrong: 3, streak: 0 }]])) };
  const examAttempts = [1, 2, 3].map(i => ({ id: 'e' + i, student_id: me.id, status: 'submitted', score: 100 }));
  const state = { profiles: [me, friend, mate], sessions, battles, mastery, examAttempts, schools: [], tournaments: [] };
  const stats = createCompetition(state, sat + 30 * DAY).titleStats(me);
  const want = { weekend10: 'weekend_days', morning30: 'morning_studies', event10: 'event_studies', away10: 'away_wins', rematch10: 'rematches', legend1: 'legend_pets', mythic1: 'mythic_pets', seasonall: 'season_pets', egg10: 'eggs', petcare30: 'care', lucky2: 'lucky_best_day', boss10: 'boss_wins', fix50: 'fixes', finalclear: 'exam_perfect' };
  const missed = Object.entries(want).filter(([key, stat]) => TITLES[key].stat !== stat || !titleUnlocked(key, stats)).map(([key]) => key);
  assert(!missed.length && stats.weekend_days >= 10 && stats.morning_studies === 30 && stats.event_studies === 10 && stats.away_wins === 15 && stats.rematches === 10 && stats.fixes === 50 && stats.season_pets === 3 && stats.eggs === 5,
    `V13.148 새 칭호 통계가 기록에서 바로 나온다(${missed.join(' ')} 주말 ${stats.weekend_days} · 아침 ${stats.morning_studies} · 이벤트 ${stats.event_studies} · 원정 ${stats.away_wins} · 재대결 ${stats.rematches} · 오답 ${stats.fixes})`);
  assert(!titleUnlocked('egg50', stats) && !titleUnlocked('eventlover', stats) && REMATCH_MS === 600000 && typeof stats.units === 'number', 'V13.148 목표에 못 미친 칭호는 열리지 않는다');

  // 새로 세는 것: 코인 뽑기 3배(하루 최고) · 보스 몬스터 처치.
  const lucky = { lucky: {}, points_spent: 0 };
  const three = () => .95; // LUCKY_ODDS 마지막 칸(3배)
  for (let i = 0; i < 2; i++) pullLucky(lucky, 10, 999, { random: three, now: sat });
  pullLucky(lucky, 10, 999, { random: three, now: sat + DAY });
  assert(lucky.lucky.big_best === 2 && lucky.lucky.big_n === 1, 'V13.148 코인 뽑기 3배가 하루에 몇 번 나왔는지(가장 많았던 날)를 센다');
  const hunter = { pets: [{ key: 'dog' }], bonus: { monster: { stage: 5, clear: { easy: 1, normal: 1 }, best: 4 } } };
  monsterStart(hunter, { stage: 5, level: 'hard', id: 'boss', now: sat });
  monsterFinish(hunter, { id: 'boss', result: 'win', right: 20, now: sat + 120000 });
  assert(hunter.bonus.monster.boss_wins === 1, 'V13.148 보스 레벨(5레벨마다) 몬스터를 이기면 보스 처치를 센다');

  const service = read('./service.mjs'), ui = read('../public/modules/titles-ui.js');
  assert(service.includes('setUnitCounter((state, p) =>') && service.includes('wordRangeMastery(state, p.id, school, p.class_name).mastered') && service.includes('const titleSeenKey = (ctx, key) => weeklyTitle(key)') && ui.includes("weeklyTitle(key) ? ' (이긴 주마다)'"),
    'V13.148 한 과 정복은 학습 화면의 과 정복 수를 쓰고, 주마다 다시 주는 코인 · 안내는 주간 한정 칭호에만');
}
