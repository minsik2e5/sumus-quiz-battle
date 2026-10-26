// V13.174 검사: 몬스터전 지역 + 겹치지 않는 레벨 줄(레벨 1~70은 그림 있는 70종이 한 번씩, 새 18종 그림이 들어오면 71~88). docs/monster-level-design.md A · B.
// 레벨 1 암기 모찌, 보스 자리 등급, 그림 게이트(없을 때 / 있을 때), 한 바퀴 뒤 "+1", 학생 기록 · 보상은 그대로.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { HUNT_MONSTERS } from '../public/modules/hunt-rules.js';
import { MONSTER_ART } from '../public/modules/monster-art.js';
import { MONSTERS, monsterInfo, stageMonster, stageLevel } from '../public/modules/monsters.js';
import { REGIONS, NEW_MONSTERS, MONSTER_TEXT, ALL_MONSTER_KEYS, tierOf, track, cycleLength, stageMonsterKey, stageRegion } from '../public/modules/monster-regions.js';
import { monsterStart, monsterFinish, monsterView } from './rewards.mjs';
import { NEW_MONSTERS as ORDERED } from '../docs/asset-requests/runner/build-39.mjs';

const source = path => readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8');
// 그림이 하나도 없는 새 몬스터 / 전부 있는 경우(진짜 그림 폴더와 상관없이 같은 결과를 얼린다).
const NONE = new Set(ALL_MONSTER_KEYS.filter(k => !NEW_MONSTERS[k])), ALL = new Set(ALL_MONSTER_KEYS);
const FROZEN_BASE = [
  'mochi cheatninja nightzombie redpenghost homeworkogre wrongmummy testspider bagturtle proctor finalking',
  'wordsquirrel spellshroom markerfly pencilworm bearprincipal dictpecker vocabvine verbbeetle sentdryad lexitreant',
  'eraserbunny cliphopper postitfly scarecrow sportsrhino wordgoose alarmwolf millgolem busbull stormbird',
  'commacrab quizconch pencilgull dotocto testkraken adjstar tripshark bookray cramwizard leviathan',
  'snackcoon sleeppillow tutorsquito sleepcloud moongrader wolf2am mutecat nightmare batking reportdragon',
  'slime nightbat forgetghost mimic pianofang phone sandwitch golem pirate mockhydra',
  'clock scrollgoblin blinkjelly labskeleton gatehound chalkangler owlnight omrreaper killergolem dictdragon'
];
const FROZEN_NEW = [
  'bookmarkbat dustbookworm postitghost librarianowl libshadow dictspider forbiddenmimic indexgolem shelfdragon yearendlord',
  'latebell lunchslime timetablefairy staffroomguard examsetter classrobot examoctopus barbargiant'
];
const rows = list => list.map(row => row.split(' ')).flat();

export async function runMonsterRegionsChecks(assert) {
  const base = track(NONE), full = track(ALL);
  // 레벨 줄: 70종이 한 번씩, 새 18종이 들어오면 88레벨, 얼려 둔 표와 같다. 레벨 1은 암기 모찌.
  assert(base.length === 70 && new Set(base).size === 70 && base.join() === rows(FROZEN_BASE).join() && full.length === 88 && new Set(full).size === 88 && full.slice(0, 70).join() === base.join() && full.slice(70).join() === rows(FROZEN_NEW).join()
    && base[0] === 'mochi' && stageMonsterKey(1, NONE) === 'mochi' && stageMonsterKey(1, ALL) === 'mochi' && cycleLength(NONE) === 70 && cycleLength(ALL) === 88,
    'V13.174 레벨 1은 암기 모찌, 레벨 1~70은 그림 있는 70종이 한 번씩(겹침 없음), 새 18종 그림이 오면 71~88이 새 몬스터(겹침 없음 88레벨)이고 1~70은 안 바뀐다(얼린 표와 같다)');
  // 그림 있는 몬스터 전부가 한 번씩, 새 몬스터는 71~88에만.
  assert([...NONE].every(k => base.includes(k)) && [...ALL].every(k => full.includes(k)) && base.every(k => !NEW_MONSTERS[k]) && Object.keys(NEW_MONSTERS).every(k => full.indexOf(k) >= 70),
    'V13.174 그림이 있는 몬스터는 빠짐없이 한 번씩 나오고, 새 몬스터는 71~88에만 있다');
  // 보스 자리 등급: 5 · 15 · … · 65 대장, 10 · 20 · … · 70 보스, 71~88은 75 · 85 새 대장, 80 새 보스. 남는 대장 4 · 보스 1은 51~70의 6~9번째 칸.
  const bossOk = list => list.every((k, i) => (i + 1) % 5 ? true : tierOf(k) === ((i + 1) % 10 === 5 ? 'epic' : 'legend'));
  const spare = base.map((k, i) => ({ k, level: i + 1 })).filter(x => (x.level % 5) && ['epic', 'legend'].includes(tierOf(x.k)));
  assert(bossOk(base) && bossOk(full) && spare.length === 5 && spare.every(x => x.level > 50 && [6, 7, 8, 9].includes(((x.level - 1) % 10) + 1)) && tierOf(full[78]) === 'legend' && full[78] === 'shelfdragon'
    && [74, 79, 84].map(i => full[i]).join() === 'libshadow,yearendlord,examsetter'
    && base.slice(0, 50).every((k, i) => (i % 10 < 4 ? ['common', 'uncommon'] : (i % 10 > 4 && i % 10 < 9) ? ['uncommon', 'rare'] : ['epic', 'legend']).includes(tierOf(k))),
    'V13.174 5레벨마다 보스(5 · 15 … 대장 ★4, 10 · 20 … 보스 ★5), 1~4는 ★1~★2, 6~9는 ★2~★3(51~70에는 남는 대장 4 · 보스 1이 섞임), 75 · 85 새 대장, 80 새 보스(안 읽은 책탑 용은 79)');
  // 새 몬스터 18종은 그림 주문서 39 · 40(build-39.mjs)과 key · 이름 · 등급 · 지역이 같고, 기본 몬스터와 key가 안 겹친다. 모든 몬스터에 한 줄 설명 · 색이 있다.
  assert(Object.keys(NEW_MONSTERS).length === 18 && Object.keys(ORDERED).length === 18
    && Object.entries(ORDERED).every(([k, m]) => NEW_MONSTERS[k] && NEW_MONSTERS[k].ko === m.ko && NEW_MONSTERS[k].tier === m.tier && NEW_MONSTERS[k].region === m.set)
    && Object.keys(NEW_MONSTERS).every(k => !HUNT_MONSTERS[k] && !MONSTERS.some(m => m.key === k)) && new Set(ALL_MONSTER_KEYS).size === 88,
    'V13.174 새 몬스터 18종은 그림 주문서 39 · 40과 같은 key · 이름 · 등급 · 지역이고 기본 몬스터와 안 겹친다(전체 88종)');
  const lineless = ALL_MONSTER_KEYS.filter(k => !MONSTERS.some(m => m.key === k) && !(MONSTER_TEXT[k]?.[0]?.length >= 8 && /^#[0-9a-f]{6}$/i.test(MONSTER_TEXT[k][1])));
  assert(!lineless.length && Object.keys(MONSTER_TEXT).length === 70 && ALL_MONSTER_KEYS.every(k => { const m = monsterInfo(k); return m.key === k && m.name && m.line && m.color && m.temp?.pet; }),
    `V13.174 모든 몬스터 88종에 이름 · 한 줄 설명 · 색이 있다(설명 없음: ${lineless.join(', ') || '없음'})`);
  // 지역: 10레벨씩(도서관 71~79 · 학교 80~88)이 레벨 1~88을 빈틈없이 덮고, 장소 몬스터 9종은 자기 구간에.
  const covered = REGIONS.flatMap(r => Array.from({ length: r.to - r.from + 1 }, (_, i) => r.from + i));
  const inRange = (r, list) => list.slice(r.from - 1, r.to);
  assert(REGIONS.map(r => r.name).join('|') === '야자 교실|숲|들판|바닷가|밤|온 세상 보스 모음 Ⅰ|온 세상 보스 모음 Ⅱ|한밤의 도서관|기말고사 학교' && covered.join() === Array.from({ length: 88 }, (_, i) => i + 1).join()
    && REGIONS.every(r => r.bg.startsWith('linear-gradient') && r.icon) && REGIONS.slice(1, 5).every(r => Object.keys(HUNT_MONSTERS).filter(k => HUNT_MONSTERS[k].place === r.key).every(k => inRange(r, full).includes(k)))
    && inRange(REGIONS[7], full).every(k => NEW_MONSTERS[k].region === 'library') && inRange(REGIONS[8], full).every(k => NEW_MONSTERS[k].region === 'school'),
    'V13.174 지역 9곳(야자 교실 · 숲 · 들판 · 바닷가 · 밤 · 온 세상 보스 모음 Ⅰ · Ⅱ · 한밤의 도서관 71~79 · 기말고사 학교 80~88)이 레벨 1~88을 빈틈없이 덮고, 장소 몬스터 9종은 자기 지역 구간에 있다');
  // 레벨 1 ~ 9999: 모든 레벨에서 몬스터가 나오고(그림 있는 것만), 한 바퀴 뒤는 "+N".
  let bad = 0;
  const cyc = cycleLength();
  for (let s = 1; s <= 9999; s++) {
    const m = stageMonster(s), at = stageRegion(s);
    if (!m.key || !MONSTER_ART.has(m.key) || !m.name || !m.line || !m.color || m.round !== Math.floor((s - 1) / cyc) || !m.region.name || at.first !== (m.region.slot === 0)
      || m.title !== (m.round ? `${m.name} +${m.round}` : m.name) || m.key !== stageMonsterKey(s)) bad++;
  }
  assert(!bad && stageMonster(0).key === stageMonster(1).key && stageMonster(-5).key === stageMonster(1).key && stageMonster('abc').key === stageMonster(1).key && stageMonster(10000).key === stageMonster(9999).key,
    `V13.174 레벨 1 ~ 9999 모두 그림 있는 몬스터가 나오고(이름 · 설명 · 색 · 지역 · "+N" 맞음, 틀린 곳 ${bad}개), 이상한 값은 레벨 1로 본다`);
  const wrap = (art, n) => [1, n, n + 1, n + 2, 2 * n + 1, 2 * n + 88].map(s => [s, stageMonsterKey(s, art), stageRegion(s, art)]);
  assert(wrap(NONE, 70).every(([s, k, r]) => k === base[(s - 1) % 70] && r.lap === Math.floor((s - 1) / 70)) && wrap(ALL, 88).every(([s, k, r]) => k === full[(s - 1) % 88] && r.lap === Math.floor((s - 1) / 88))
    && stageRegion(71, NONE).name === '야자 교실' && stageRegion(71, NONE).number === 8 && stageRegion(71, ALL).name === '한밤의 도서관' && stageRegion(89, ALL).name === '야자 교실' && stageRegion(89, ALL).number === 10 && stageRegion(89, ALL).first,
    'V13.174 한 바퀴(그림이 없을 때 70레벨 · 전부 있을 때 88레벨)가 끝나면 처음부터 다시 돌고 "+1", "+2"가 붙는다(지역 번호도 이어서 센다)');
  // 그림 게이트: 새 몬스터 그림이 없으면 71 이후에 새 몬스터가 안 나오고, 한 마리만 있어도 한 바퀴가 88레벨이 되며 그 자리에 들어가고 나머지는 같은 등급의 기본 몬스터가 대신한다.
  const one = new Set(NONE); one.add('libshadow');
  const part = track(one);
  assert(Array.from({ length: 300 }, (_, i) => stageMonsterKey(i + 1, NONE)).every(k => !NEW_MONSTERS[k]) && part.length === 88 && part[74] === 'libshadow' && part.slice(0, 70).join() === base.join()
    && part.slice(70).every((k, i) => k === full[70 + i] ? k === 'libshadow' : tierOf(k) === tierOf(full[70 + i]) && !NEW_MONSTERS[k]) && part.every(k => one.has(k)) && track(one).join() === track(new Set([...one])).join(),
    'V13.174 그림 게이트: 그림 없는 새 몬스터는 안 나오고, 그림이 들어오면 코드 변경 없이 자기 칸(71~88)에 들어가며 1~70은 안 바뀐다, 아직 그림 없는 새 칸은 같은 등급 기본 몬스터가 정해진 차례로 대신한다');
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
    assert([75, 79, 80, 85].map(s => stageMonster(s).key).join() === 'libshadow,shelfdragon,yearendlord,examsetter' && stageMonster(89).key === 'mochi' && stageMonster(89).round === 1,
      'V13.174 (그림이 전부 들어왔다고 보면) 레벨 75 · 85는 새 대장, 80은 새 보스, 89는 암기 모찌 +1이다');
    const t0 = Date.parse('2026-10-24T03:00:00Z');
    const tester = { id: 'qa-new', pets: [{ key: 'dog' }], bonus: { monster: { stage: 75, best: 74, clear: {} } } };
    const go = (stage, level, at, who = tester) => { const r = monsterStart(who, { stage, level, codes: ['1'], id: 'n-' + at, now: at }); const out = monsterFinish(who, { id: r.id, result: 'win', right: 14, now: at + 60000 }); return { r, out }; };
    const a = go(75, 'easy', t0), b = go(75, 'normal', t0 + 70000), c = go(75, 'hard', t0 + 140000);
    assert(a.r.monster === 'libshadow' && a.out.paid && a.out.first && b.out.first && c.out.first && c.out.stage_up === 76 && monsterView(tester, t0 + 300000).stage === 76 && monsterView(tester, t0 + 300000).best === 75
      && go(80, 'easy', t0 + 400000, { id: 'qa-new2', pets: [{ key: 'dog' }], bonus: { monster: { stage: 80, best: 79, clear: {} } } }).r.monster === 'yearendlord', 'V13.174 서버: 새 몬스터 key로 전투를 시작하고 끝낼 수 있고, 하드를 깨면 다음 레벨이 열린다(기록 · 보상 규칙 그대로)');
  } finally { for (const k of added) MONSTER_ART.delete(k); }
  // 화면: 지역 이름 · 새 지역 안내 · 임시 배경, 서버/화면이 같은 표를 쓴다.
  const battle = source('../public/modules/battle.js'), rewards = source('./rewards.mjs'), css = source('../public/v13174.css'), build = source('./build-assets.mjs'), sw = source('../public/sw.js');
  assert(battle.includes('newRegionNotice') && battle.includes('새 지역!') && battle.includes('ms-region-chip') && battle.includes('monsterInfo') && !battle.includes('MONSTERS.find')
    && css.includes('.ms-newregion') && css.includes('.ms-region-chip') && css.includes('prefers-reduced-motion') && build.includes('"v13174.css"') && sw.includes('/modules/monster-regions.js') && rewards.includes('stageMonster(s).key'),
    'V13.174 몬스터 탭: 지역 이름 칩 · "새 지역!" 안내(한 번) · 임시 배경, 서버(rewards.mjs)와 화면이 같은 stageMonster 표를 쓰고 새 파일이 앱 캐시에 있다');
  const guide = source('../docs/monster-level-design.md');
  assert(guide.includes('세션 2') && source('../CHANGES_v13.178.0.md').includes('지역'), 'V13.174 구성안 문서와 변경 기록(CHANGES_v13.178.0.md)이 있다');
}
