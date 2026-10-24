// V13.174 검사: 몬스터전 지역(10레벨 = 1지역, 8지역 = 80레벨이 한 바퀴). docs/monster-level-design.md A · B.
// 레벨마다 몬스터가 나오고, 지역마다 10칸 · 보스 5 · 10 등급 · 중복 없음, 그림이 있는 몬스터는 모두 나오고(그림 게이트), 학생 기록 · 보상은 그대로.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { HUNT_MONSTERS, TIER_STARS } from '../public/modules/hunt-rules.js';
import { MONSTER_ART } from '../public/modules/monster-art.js';
import { MONSTERS, monsterInfo, stageMonster, stageLevel } from '../public/modules/monsters.js';
import { REGIONS, REGION_SLOTS, REGION_SIZE, REGION_COUNT, CYCLE_LEVELS, NEW_MONSTERS, MONSTER_TEXT, ALL_MONSTER_KEYS, tierOf, regionKeys, stageMonsterKey, stageRegion } from '../public/modules/monster-regions.js';
import { monsterStart, monsterFinish, monsterView } from './rewards.mjs';
import { NEW_MONSTERS as ORDERED } from '../docs/asset-requests/runner/build-39.mjs';

const source = path => readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8');
// 그림이 하나도 없는 새 몬스터 / 전부 있는 경우(진짜 그림 폴더와 상관없이 같은 결과를 얼린다).
const NONE = new Set(ALL_MONSTER_KEYS.filter(k => !NEW_MONSTERS[k])), ALL = new Set(ALL_MONSTER_KEYS);
const FROZEN_NONE = [
  'nightbat cheatninja nightzombie redpenghost homeworkogre wrongmummy testspider bagturtle proctor finalking',
  'wordsquirrel spellshroom markerfly dictpecker bearprincipal vocabvine verbbeetle sentdryad cramwizard lexitreant',
  'eraserbunny cliphopper postitfly scarecrow sportsrhino wordgoose millgolem busbull chalkangler stormbird',
  'commacrab quizconch pencilgull dotocto testkraken adjstar tripshark bookray sandwitch leviathan',
  'snackcoon sleeppillow tutorsquito wolf2am moongrader mutecat nightmare batking phone reportdragon',
  'slime mochi pencilworm blinkjelly gatehound labskeleton cramwizard phone sandwitch killergolem',
  'sleepcloud forgetghost slime mimic golem clock chalkangler cramwizard phone mockhydra',
  'mochi pencilworm sleepcloud alarmwolf pirate scrollgoblin sandwitch chalkangler cramwizard dictdragon'
];
const FROZEN_ALL = [
  ...FROZEN_NONE.slice(0, 5),
  'bookmarkbat dustbookworm postitghost librarianowl libshadow dictspider forbiddenmimic indexgolem cramwizard shelfdragon',
  'latebell lunchslime timetablefairy staffroomguard examsetter classrobot examoctopus barbargiant chalkangler yearendlord',
  FROZEN_NONE[7]
];
const table = (art, lap = 0) => Array.from({ length: REGION_COUNT }, (_, r) => regionKeys(r, lap, art).join(' '));

export async function runMonsterRegionsChecks(assert) {
  // 지역 구조: 8지역 × 10칸, 등급 순서 ★1 ★1 ★1 ★2 ★4 ★2 ★3 ★3 ★3 ★5.
  assert(REGION_COUNT === 8 && REGION_SIZE === 10 && CYCLE_LEVELS === 80 && REGIONS.map(r => r.name).join('|') === '야자 교실|숲|들판|바닷가|밤|한밤의 도서관|기말고사 학교|온 세상 보스 모음'
    && REGIONS.every(r => r.bg.startsWith('linear-gradient') && r.icon) && REGION_SLOTS.length === 10 && REGION_SLOTS[4] === 'epic' && REGION_SLOTS[9] === 'legend'
    && REGION_SLOTS.slice(0, 4).every(t => TIER_STARS[t] <= 2) && REGION_SLOTS.slice(5, 9).every(t => TIER_STARS[t] >= 2 && TIER_STARS[t] <= 3),
    'V13.174 지역 8곳(야자 교실 · 숲 · 들판 · 바닷가 · 밤 · 한밤의 도서관 · 기말고사 학교 · 온 세상 보스 모음) × 10칸, 레벨 5는 대장(★4) · 10은 보스(★5), 1~4는 ★1~★2, 6~9는 ★2~★3');
  // 새 몬스터 18종은 그림 주문서 39 · 40(build-39.mjs)과 key · 이름 · 등급 · 지역이 같고, 기본 몬스터와 key가 안 겹친다. 모든 몬스터에 한 줄 설명 · 색이 있다.
  assert(Object.keys(NEW_MONSTERS).length === 18 && Object.keys(ORDERED).length === 18
    && Object.entries(ORDERED).every(([k, m]) => NEW_MONSTERS[k] && NEW_MONSTERS[k].ko === m.ko && NEW_MONSTERS[k].tier === m.tier && NEW_MONSTERS[k].region === m.set)
    && Object.keys(NEW_MONSTERS).every(k => !HUNT_MONSTERS[k] && !MONSTERS.some(m => m.key === k)) && new Set(ALL_MONSTER_KEYS).size === 88,
    'V13.174 새 몬스터 18종은 그림 주문서 39 · 40과 같은 key · 이름 · 등급 · 지역이고 기본 몬스터와 안 겹친다(전체 88종)');
  const lineless = ALL_MONSTER_KEYS.filter(k => !MONSTERS.some(m => m.key === k) && !(MONSTER_TEXT[k]?.[0]?.length >= 8 && /^#[0-9a-f]{6}$/i.test(MONSTER_TEXT[k][1])));
  assert(!lineless.length && Object.keys(MONSTER_TEXT).length === 70 && ALL_MONSTER_KEYS.every(k => { const m = monsterInfo(k); return m.key === k && m.name && m.line && m.color && m.temp?.pet; }),
    `V13.174 모든 몬스터 88종에 이름 · 한 줄 설명 · 색이 있다(설명 없음: ${lineless.join(', ') || '없음'})`);
  // 레벨 1 ~ 9999: 모든 레벨에서 몬스터가 나오고(그림이 있는 것만), 지역 정보가 맞다.
  let bad = 0;
  for (let s = 1; s <= 9999; s++) {
    const m = stageMonster(s), at = stageRegion(s);
    if (!m.key || !MONSTER_ART.has(m.key) || !m.name || !m.line || !m.color || m.round !== Math.floor((s - 1) / 80) || m.region.name !== REGIONS[Math.floor(((s - 1) % 80) / 10)].name
      || at.first !== ((s - 1) % 10 === 0) || m.title !== (m.round ? `${m.name} +${m.round}` : m.name)) bad++;
  }
  assert(!bad && stageMonster(0).key === stageMonster(1).key && stageMonster(-5).key === stageMonster(1).key && stageMonster('abc').key === stageMonster(1).key && stageMonster(10000).key === stageMonster(9999).key,
    `V13.174 레벨 1 ~ 9999 모두 그림 있는 몬스터가 나오고(이름 · 설명 · 색 · 지역 · "+N" 맞음, 틀린 곳 ${bad}개), 이상한 값은 레벨 1로 본다`);
  // 지역마다 10칸 · 보스 등급 · 같은 지역 중복 없음 — 그림 두 경우, 세 바퀴.
  for (const [name, art] of [['새 몬스터 그림 없음', NONE], ['새 몬스터 그림 전부', ALL], ['지금 그림 폴더', MONSTER_ART]]) {
    let wrong = 0;
    for (let lap = 0; lap < 3; lap++) for (let r = 0; r < REGION_COUNT; r++) {
      const keys = regionKeys(r, lap, art);
      if (keys.length !== 10 || new Set(keys).size !== 10 || keys.some((k, i) => !art.has(k) || tierOf(k) !== REGION_SLOTS[i])) wrong++;
    }
    assert(!wrong, `V13.174 (${name}) 지역 8곳 × 3바퀴 모두 10칸 · 중복 없음 · 칸 등급(★1 ★1 ★1 ★2 ★4 ★2 ★3 ★3 ★3 ★5)이 맞고 그림 있는 몬스터만 나온다(틀린 곳 ${wrong}개)`);
  }
  // 그림 게이트 + 표 얼리기.
  assert(table(NONE).join('|') === FROZEN_NONE.join('|'), 'V13.174 새 몬스터 그림이 하나도 없을 때의 지역 표(레벨 1 ~ 80)는 얼려 둔 표와 같다 — 그림 없는 칸은 같은 등급의 그림 있는 몬스터가 정해진 차례로 대신한다');
  assert(table(ALL).join('|') === FROZEN_ALL.join('|'), 'V13.174 새 몬스터 그림이 전부 있을 때의 지역 표(레벨 1 ~ 80)는 얼려 둔 표와 같다 — 한밤의 도서관 · 기말고사 학교 칸에 새 몬스터가 자기 등급 자리에 들어간다');
  const noNew = [...Array(3 * CYCLE_LEVELS)].map((_, i) => stageMonsterKey(i + 1, NONE)), withNew = [...Array(CYCLE_LEVELS)].map((_, i) => stageMonsterKey(i + 1, ALL));
  assert(noNew.every(k => !NEW_MONSTERS[k]) && Object.keys(NEW_MONSTERS).every(k => withNew.includes(k)) && JSON.stringify(table(NONE)) === JSON.stringify(table(new Set([...NONE]))),
    'V13.174 그림 게이트: 그림 없는 새 몬스터는 어느 레벨에도 안 나오고, 그림이 들어오면 한 바퀴(80레벨) 안에 18종이 모두 나오며, 같은 그림 목록이면 표가 늘 같다');
  // 새 몬스터 한 마리씩 그림이 들어와도 그 칸에만 들어오고 다른 지역 표는 그대로, 코드 변경 없이 쓴다.
  const one = new Set(NONE); one.add('libshadow');
  assert(regionKeys(5, 0, one)[4] === 'libshadow' && regionKeys(5, 0, NONE)[4] !== 'libshadow' && [0, 1, 2, 3, 4, 6].every(r => regionKeys(r, 0, one).join() === regionKeys(r, 0, NONE).join() || regionKeys(r, 0, one).includes('libshadow') === false)
    && regionKeys(7, 0, one)[4] === 'pirate', 'V13.174 새 몬스터 한 마리의 그림이 들어오면(코드 변경 없이) 자기 지역 자기 등급 칸에 들어가고 같은 지역에서 중복이 없다');
  // 그림 있는 몬스터는 빠짐없이 나온다: 한 바퀴째에 대부분, 세 바퀴(레벨 240) 안에 전부(대장 ★4는 13종인데 지역이 8곳이라 두 번째 바퀴까지 걸린다).
  for (const [name, art] of [['새 그림 없음 70종', NONE], ['전부 88종', ALL], ['지금 그림 폴더', MONSTER_ART]]) {
    const first = new Set(), later = new Set();
    for (let lap = 0; lap < 3; lap++) for (let r = 0; r < REGION_COUNT; r++) regionKeys(r, lap, art).forEach(k => (lap ? later : first).add(k));
    const missing = [...art].filter(k => !first.has(k) && !later.has(k));
    assert(!missing.length && first.size >= (art.size === 88 ? 70 : 60), `V13.174 (${name}) 그림 있는 몬스터는 빠짐없이 나온다(240레벨 안, 빠진 몬스터: ${missing.join(', ') || '없음'}, 첫 바퀴에 ${first.size}종)`);
  }
  // 어울리는 몬스터가 먼저: 숲 · 들판 · 바닷가 · 밤은 place 값이 같은 몬스터 9종이 자기 지역 첫 바퀴에 모두 있다. 야자 교실은 학교 · 공부 소재 기본 몬스터.
  const mine = REGIONS.slice(1, 5).every((r, i) => { const keys = regionKeys(i + 1, 0, MONSTER_ART); return Object.keys(HUNT_MONSTERS).filter(k => HUNT_MONSTERS[k].place === r.key).every(k => keys.includes(k)); });
  assert(mine && regionKeys(0, 0, MONSTER_ART).every(k => !HUNT_MONSTERS[k].place) && regionKeys(0, 0, MONSTER_ART).includes('finalking'), 'V13.174 숲 · 들판 · 바닷가 · 밤은 자기 장소 몬스터 9종이 모두 첫 바퀴에 나오고, 야자 교실은 학교 · 공부 소재 기본 몬스터로 채운다');
  // 학생 기록은 그대로: stage · best · clear · 보상 계산은 몬스터 표와 상관이 없다.
  const kid = { id: 'qa-region', pets: [{ key: 'dog' }], bonus: { monster: { stage: 47, best: 46, clear: { easy: 111 }, wins: 9, hard_wins: 3 } } };
  const before = JSON.stringify(monsterView(kid, 1e12));
  const view = monsterView(kid, 1e12);
  assert(view.stage === 47 && view.best === 46 && view.wins === 9 && view.hard_wins === 3 && view.clear.easy === 111 && before === JSON.stringify(monsterView(kid, 1e12)) && JSON.stringify(kid.bonus.monster) === '{"stage":47,"best":46,"clear":{"easy":111},"wins":9,"hard_wins":3}',
    'V13.174 기존 학생의 monster.stage · best · clear · wins는 그대로 읽힌다(지역 표는 기록을 안 건드린다)');
  const L10 = stageLevel(10, 'hard'), L26 = stageLevel(26, 'normal');
  assert(!('monster' in L10) && !('region' in L10) && L10.first.coins === 141 && L10.first.xp === 749 && L26.first.coins > 0 && L10.boss && !stageLevel(11, 'hard').boss && stageLevel(5, 'easy').boss,
    'V13.174 레벨의 세기 · 보상 · 보스(5레벨마다)는 그대로고 몬스터 표와 상관없다(레벨 10 하드 첫 처치 141코인 · 749경험치, 이 값은 v13.173.0과 같다)');
  // 서버: 새 몬스터(그림이 들어온 경우) 레벨도 문제없이 시작하고 끝난다.
  const added = Object.keys(NEW_MONSTERS).filter(k => !MONSTER_ART.has(k));
  for (const k of added) MONSTER_ART.add(k);
  try {
    const stages = [51, 55, 60, 61, 65, 70];
    const kinds = stages.map(s => stageMonster(s).key);
    assert(kinds.every(k => NEW_MONSTERS[k]) && stageMonster(55).key === 'libshadow' && stageMonster(60).key === 'shelfdragon' && stageMonster(70).key === 'yearendlord' && stageMonster(65).key === 'examsetter',
      'V13.174 (그림이 전부 들어왔다고 보면) 도서관 · 학교 지역의 레벨 5 · 10은 새 대장 · 보스다');
    const t0 = Date.parse('2026-10-24T03:00:00Z');
    const tester = { id: 'qa-new', pets: [{ key: 'dog' }], bonus: { monster: { stage: 55, best: 54, clear: {} } } };
    const go = (stage, level, at, who = tester) => { const r = monsterStart(who, { stage, level, codes: ['1'], id: 'n-' + at, now: at }); const out = monsterFinish(who, { id: r.id, result: 'win', right: 14, now: at + 60000 }); return { r, out }; };
    const a = go(55, 'easy', t0), b = go(55, 'normal', t0 + 70000), c = go(55, 'hard', t0 + 140000);
    assert(a.r.monster === 'libshadow' && a.out.paid && a.out.first && b.out.first && c.out.first && c.out.stage_up === 56 && monsterView(tester, t0 + 300000).stage === 56 && monsterView(tester, t0 + 300000).best === 55
      && go(60, 'easy', t0 + 400000, { id: 'qa-new2', pets: [{ key: 'dog' }], bonus: { monster: { stage: 60, best: 59, clear: {} } } }).r.monster === 'shelfdragon', 'V13.174 서버: 새 몬스터 key로 전투를 시작하고 끝낼 수 있고, 하드를 깨면 다음 레벨이 열린다(기록 · 보상 규칙 그대로)');
  } finally { for (const k of added) MONSTER_ART.delete(k); }
  // 화면: 지역 이름 · 새 지역 안내 · 임시 배경, 서버/화면이 같은 표를 쓴다.
  const battle = source('../public/modules/battle.js'), rewards = source('./rewards.mjs'), css = source('../public/v13174.css'), build = source('./build-assets.mjs'), sw = source('../public/sw.js');
  assert(battle.includes('newRegionNotice') && battle.includes('새 지역!') && battle.includes('ms-region-chip') && battle.includes('monsterInfo') && !battle.includes('MONSTERS.find')
    && css.includes('.ms-newregion') && css.includes('.ms-region-chip') && css.includes('prefers-reduced-motion') && build.includes('"v13174.css"') && sw.includes('/modules/monster-regions.js') && rewards.includes('stageMonster(s).key'),
    'V13.174 몬스터 탭: 지역 이름 칩 · "새 지역!" 안내(한 번) · 임시 배경, 서버(rewards.mjs)와 화면이 같은 stageMonster 표를 쓰고 새 파일이 앱 캐시에 있다');
  const guide = source('../docs/monster-level-design.md');
  assert(guide.includes('세션 2') && source('../CHANGES_v13.174.0.md').includes('지역'), 'V13.174 구성안 문서와 변경 기록(CHANGES_v13.174.0.md)이 있다');
}
