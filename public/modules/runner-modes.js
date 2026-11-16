import { RUNNER, PET_SKILL, makeMap, baseStart } from './runner-rules.js';
import { MONSTER_ART, monsterInfo } from './monsters.js';

// V13.243 펫 대행진 ③단계: 오늘의 도전 맵 · 주간 반 보스(서버 · 화면이 같이 쓰는 파일).
// runner-rules.js의 판 규칙 · 맵 생성기 본체는 고치지 않고, "모드(daily · raid)" 정보만 여기서 받아 맵 · 시작 옵션을 만든다.
//   - 일반 판: makeMap(스테이지) 그대로, 시작 정령 = 응원 · 강화 포함(runner.mjs가 정함).
//   - 오늘의 도전: 날짜(한국 시간) + 묶음(같은 학교 · 같은 학년대)으로 정한 씨앗 · 스테이지 · 속성. 강화 · 응원 · 펫 등급 세기를 끈다(공정).
// 규칙 쪽 난수는 씨앗만 쓰고(Math.random · Date 없음), 엔진마다 끝자리가 다를 수 있는 수학도 쓰지 않는다.

export const DAILY = {
  // 난도 중상: 하늘 다리 12~25 중 보스 성(20) · 쉬어 가기(21)를 뺀 곳(처음 도전 깸 약 68%, 별 3 약 34%). 열린 스테이지가 늘어도 이 표는 그대로.
  STAGES: [12, 13, 14, 15, 16, 17, 18, 19, 22, 23, 24, 25],
  ELS: Object.keys(PET_SKILL),
  TOP: 10, CACHE_MS: 60000
};
export const RAID = {
  HP_PER: 1200,          // 묶음 학생 한 명당 보스 HP(공성전 피해 합계). 한 판 피해 ≈ 성 HP(1~25스테이지 100~650).
  MIN_SIZE: 5, MAX_SIZE: 60, GUESS_SIZE: 20,
  COINS: RUNNER.RAID_COINS,   // 격파하면 그 주에 한 판이라도 한 학생에게 30코인(하루 상한과 따로)
  TOP: 5, CACHE_MS: 60000, GROUPS_MAX: 60,   // 묶음 60개 × 약 0.22KB ≈ 13KB(perf-budget runnerRaid 16KB 안)
  // 기존 던전 몬스터 그림(큰 몬스터)만. 그림이 있는 것만 쓴다.
  BOSSES: ['dictdragon', 'finalking', 'mockhydra', 'leviathan', 'killergolem', 'homeworkogre', 'nightmare', 'reportdragon', 'testkraken', 'omrreaper', 'batking', 'sportsrhino', 'golem', 'pirate', 'cramwizard', 'bearprincipal']
};

// 문자열 → 32비트 씨앗(FNV-1a, Math.imul만).
export function hash32(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

// 오늘의 도전: 같은 날 · 같은 묶음 → 같은 씨앗 · 같은 스테이지 · 같은 속성(저장하지 않는다).
export function dailySpec(day, group) {
  const h = hash32(`daily|${day}|${group}`), stages = DAILY.STAGES.filter(s => s <= RUNNER.STAGES);
  const stage = stages.length ? stages[(h >>> 13) % stages.length] : Math.min(RUNNER.STAGES, 15);
  return { mode: 'daily', day, stage, seed: hash32(`map|${h}`) || 1, el: DAILY.ELS[(h >>> 8) % DAILY.ELS.length] };
}

// 모드에 맞는 맵. 오늘의 도전은 같은 스테이지 난도 표에 씨앗만 바꾸고, 성 HP는 원래 맵 대비 기대 무리 비율로 맞춘다(씨앗 운으로 너무 쉽거나 어렵지 않게).
const mapCache = new Map();
export function modeMap(o) {
  if (o?.mode !== 'daily') return makeMap(o.stage);
  const key = `${o.stage}|${o.seed}`;
  let m = mapCache.get(key);
  if (!m) {
    const base = makeMap(o.stage), map = makeMap(o.stage, { seed: o.seed }), k = Math.max(0.7, Math.min(1.4, map.expect / Math.max(1, base.expect)));
    m = { ...map, mode: 'daily', castle: { ...map.castle, hp: Math.max(10, Math.round(base.castle.hp * k)) } };
    if (mapCache.size > 20) mapCache.clear();
    mapCache.set(key, m);
  }
  return m;
}
// 시작 옵션. 오늘의 도전은 강화 · 응원을 끄고, 펫 필살기는 오늘의 속성 · 세기 1(누구나 같게).
export function modeOpts(o, { start, pet } = {}) {
  if (o?.mode === 'daily') return { start: baseStart(o.stage), pet: { el: o.el, mul: 1 } };
  return { start, pet };
}

// 오늘의 도전 순위: 깸 → 남은 정령 많이 → 시간(틱) 짧게 → 먼저 세운 기록.
const dailyScore = (a, b) => (b.s > 0) - (a.s > 0) || b.l - a.l || a.t - b.t;
export const dailyCompare = (a, b) => dailyScore(a, b) || a.a - b.a;
export const dailyBetter = (a, b) => !b || dailyScore(a, b) < 0;   // 같은 점수면 먼저 세운 기록이 남는다

// 주간 반 보스.
export const raidSize = n => Math.max(RAID.MIN_SIZE, Math.min(RAID.MAX_SIZE, Math.round(Number(n) || RAID.GUESS_SIZE)));
export const raidHp = n => RAID.HP_PER * raidSize(n);
export function raidBoss(week, group) {
  const pool = RAID.BOSSES.filter(k => MONSTER_ART.has(k));
  const list = pool.length ? pool : RAID.BOSSES;
  return list[hash32(`raid|${week}|${group}`) % list.length];
}
export function bossInfo(key) {
  const m = monsterInfo(key);
  return { key, name: m.name || '보스', color: m.color || '#8b5cf6', img: MONSTER_ART.has(key) ? `/assets/monsters/${key}.webp` : null, hurt: MONSTER_ART.has(key) ? `/assets/monsters/${key}-hurt.webp` : null };
}
