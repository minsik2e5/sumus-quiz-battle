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
// v13.242 규칙 2판: 씨앗이 바뀌면 벽 · 적 무리 자리가 달라져 날마다 난도가 크게 흔들렸다(봇 깸 5~98%). 그래서 도전 맵은
//   미리 맞춘 표(DAILY_TABLE: 스테이지마다 맵 씨앗 8개 × [씨앗, 성 HP, 별 3 %, 위험 세기 %], node server/runner-sim.mjs daily)에서 고른다.
//   런타임 계산 없음(서버 · 화면 같은 표), 날마다 처음 도전 봇 깸 약 65%.
export function dailySpec(day, group) {
  const h = hash32(`daily|${day}|${group}`), stages = DAILY.STAGES.filter(s => s <= RUNNER.STAGES && DAILY_TABLE[s]?.length);
  const stage = stages.length ? stages[(h >>> 13) % stages.length] : Math.min(RUNNER.STAGES, 15), rows = DAILY_TABLE[stage] || [];
  const seed = rows.length ? rows[(h >>> 3) % rows.length][0] : hash32(`map|${h}`) || 1;
  return { mode: 'daily', day, stage, seed, el: DAILY.ELS[(h >>> 8) % DAILY.ELS.length] };
}
export const DAILY_SEED = (stage, i) => hash32(`dmap|${stage}|${i}`) || 1;
export const DAILY_TABLE = {"12":[[1696408590,493,36,100],[1713186209,492,38,100],[1662853352,353,38,55],[1679630971,638,36,85],[1763519066,414,51,55],[1780296685,480,41,55],[1729963828,480,36,70],[1746741447,339,37,85]],"13":[[1403002833,588,34,100],[1386225214,425,43,85],[1369447595,553,48,100],[1352669976,631,44,100],[1470113309,389,31,85],[1453335690,10,90,24],[1436558071,474,36,42],[1419780452,548,50,100]],"14":[[3412397068,444,31,100],[3429174687,507,48,100],[3445952306,516,39,100],[3462729925,528,38,85],[3345286592,478,47,100],[3362064211,532,39,85],[3378841830,545,43,70],[3395619449,536,45,100]],"15":[[1241281079,292,34,55],[1224503460,472,36,32],[1274836317,416,44,55],[1258058698,400,23,42],[1174170603,486,34,85],[1157392984,364,36,70],[1207725841,424,39,100],[1190948222,414,34,85]],"16":[[3095410554,475,21,42],[3112188173,752,42,70],[3061855316,444,38,55],[3078632935,497,33,70],[3028300078,448,30,70],[3045077697,486,33,85],[2994744840,533,25,42],[3011522459,608,33,85]],"17":[[654572733,565,30,55],[637795114,601,35,55],[621017495,434,50,55],[604239876,482,36,70],[587462257,379,34,55],[570684638,273,38,55],[553907019,384,39,70],[537129400,558,38,55]],"18":[[1858130344,554,37,85],[1874907963,536,29,85],[1891685582,471,45,55],[1908463201,306,42,70],[1925240820,396,38,70],[1942018439,655,41,70],[1958796058,539,26,42],[1975573677,402,61,100]],"19":[[3445097843,513,30,42],[3428320224,471,21,42],[3478653081,629,41,70],[3461875462,380,42,55],[3512208319,788,42,55],[3495430700,554,22,42],[3545763557,572,30,55],[3528985938,632,21,55]],"22":[[2716671721,721,35,100],[2699894102,606,48,70],[2683116483,692,37,42],[2666338864,685,55,85],[2783782197,556,45,70],[2767004578,424,46,42],[2750226959,395,48,85],[2733449340,308,44,70]],"23":[[862542246,618,25,55],[879319865,460,35,70],[828987008,611,49,70],[845764627,562,38,85],[929652722,567,37,70],[946430341,480,35,42],[896097484,515,37,70],[912875103,739,40,85]],"24":[[2554949967,561,36,85],[2538172348,666,54,100],[2588505205,516,37,85],[2571727586,596,34,70],[2487839491,474,40,70],[2471061872,664,61,100],[2521394729,453,60,100],[2504617110,654,29,70]],"25":[[967982468,664,28,55],[984760087,567,23,24],[1001537706,882,47,85],[1018315325,676,37,55],[900871992,608,51,100],[917649611,1223,72,100],[934427230,512,41,85],[951204849,707,33,100]]};

// 모드에 맞는 맵. 오늘의 도전은 같은 스테이지 난도 표에 씨앗만 바꾸고, 성 HP는 원래 맵 대비 기대 무리 비율로 맞춘다(씨앗 운으로 너무 쉽거나 어렵지 않게).
const mapCache = new Map();
export function modeMap(o) {
  if (o?.mode !== 'daily') return makeMap(o.stage);
  const key = `${o.stage}|${o.seed}`;
  let m = mapCache.get(key);
  if (!m) {
    const row = (DAILY_TABLE[o.stage] || []).find(r => r[0] === o.seed);
    if (row) { const map = makeMap(o.stage, { seed: o.seed, hz: row[3] / 100 }); m = { ...map, mode: 'daily', r3: row[2] / 100, castle: { ...map.castle, hp: row[1] } }; }
    else { const base = makeMap(o.stage), map = makeMap(o.stage, { seed: o.seed }), k = Math.max(0.7, Math.min(1.4, map.expect / Math.max(1, base.expect))); m = { ...map, mode: 'daily', castle: { ...map.castle, hp: Math.max(10, Math.round(base.castle.hp * k)) } }; }
    if (mapCache.size > 20) mapCache.clear();
    mapCache.set(key, m);
  }
  return m;
}
// 시작 옵션(서버 runnerStart · finish와 화면이 같이 씀). 오늘의 도전은 강화 · 응원을 끄고, 펫 필살기는 오늘의 속성 · 세기 1(누구나 같게).
// v13.242 정령 강화(up)도 여기서: 일반 판은 그대로, 오늘의 도전은 강화 없음(up null → 단계 0).
export function modeOpts(o, { start, pet, up = null } = {}) {
  if (o?.mode === 'daily') return { start: baseStart(o.stage), pet: { el: o.el, mul: 1 }, up: null };
  return { start, pet, up };
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
