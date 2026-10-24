import { HUNT_MONSTERS } from './hunt-rules.js';
import { MONSTER_ART } from './monster-art.js';

// V13.174 몬스터전 지역(챕터): 10레벨 = 1지역, 지역 8개(80레벨)가 한 바퀴이고 그 뒤는 처음부터 다시 돈다("+1", "+2").
// 서버(rewards.mjs의 몬스터 시작)와 화면(battle.js 몬스터 탭)이 같이 쓴다. 학생 기록(stage · best · clear)은 건드리지 않고,
// 레벨 N에서 만나는 몬스터 · 이름 · 배경만 이 표가 정한다. 설계: docs/monster-level-design.md A · B.
//
// 한 지역의 10칸(등급은 hunt-rules.js HUNT_MONSTERS의 tier): 1~3 ★1 · 4 ★2 · 5 대장(★4) · 6 ★2 · 7~9 ★3 · 10 보스(★5).
//   (구성안의 "1~4는 ★1~★2, 6~9는 ★2~★3"을 이 칸 수로 정했다: 지역마다 ★1 3 · ★2 2 · ★3 3 · ★4 1 · ★5 1.)
// 몬스터가 칸에 들어오는 규칙(그림 게이트 포함, 같은 그림 목록이면 늘 같은 표):
//   1) 그림이 있는 몬스터(MONSTER_ART)만 나온다. 새 몬스터는 그림이 들어오면 코드 변경 없이 자기 지역 칸에 들어간다.
//   2) 그 지역의 몬스터(REGIONS[].own)를 적힌 차례대로 먼저 쓴다.
//   3) 모자라거나 그림이 없는 칸은 같은 등급의 그림 있는 몬스터로 채운다: 어느 지역에도 안 묶인 기본 몬스터 → 다른 지역 몬스터 순이고,
//      지역 번호만큼 시작을 돌려서(지역마다 다르게) 같은 지역에서는 겹치지 않는다.
//   4) 두 바퀴째부터(레벨 81~)는 같은 지역 · 같은 칸 등급에서 후보 줄을 칸 수만큼 밀어서 한 바퀴째에 못 나온 몬스터가 차례로 나온다
//      (대장 ★4는 13종인데 지역은 8곳이라 한 바퀴에 다 나올 수 없다).
export const REGION_SIZE = 10;
export const REGION_SLOTS = ['common', 'common', 'common', 'uncommon', 'epic', 'uncommon', 'rare', 'rare', 'rare', 'legend'];

// 새 몬스터 18종(그림 주문서 39 · 40, docs/asset-requests/runner/build-39.mjs NEW_MONSTERS와 key · 이름 · 등급이 같다: 검사가 확인한다).
// 그림(public/assets/monsters/<key>{,-attack,-hurt,-down}.webp)이 들어와 MONSTER_ART에 키가 생기기 전에는 나오지 않는다.
export const NEW_MONSTERS = {
  bookmarkbat: { ko: '읽다 만 박쥐', tier: 'common', region: 'library' }, dustbookworm: { ko: '책먹방 애벌레', tier: 'common', region: 'library' }, postitghost: { ko: '깜빡잇 유령', tier: 'common', region: 'library' },
  librarianowl: { ko: '연체료 올빼미', tier: 'uncommon', region: 'library' }, dictspider: { ko: '뜻 뭐더라 거미', tier: 'uncommon', region: 'library' },
  forbiddenmimic: { ko: '열지 마 미믹', tier: 'rare', region: 'library' }, indexgolem: { ko: '찾아보기 골렘', tier: 'rare', region: 'library' },
  libshadow: { ko: '쉿 관장님', tier: 'epic', region: 'library' }, shelfdragon: { ko: '안 읽은 책탑 용', tier: 'legend', region: 'library' },
  latebell: { ko: '헐레벌떡 종', tier: 'common', region: 'school' }, lunchslime: { ko: '잔반 슬라임', tier: 'common', region: 'school' }, timetablefairy: { ko: '체육 실종 요정', tier: 'common', region: 'school' },
  staffroomguard: { ko: '노크 문지기', tier: 'uncommon', region: 'school' }, classrobot: { ko: '떠든애 로봇', tier: 'uncommon', region: 'school' },
  examoctopus: { ko: '찍신 문어', tier: 'rare', region: 'school' }, barbargiant: { ko: '턱걸이 거인', tier: 'rare', region: 'school' },
  examsetter: { ko: '교과서 밖 마법사', tier: 'epic', region: 'school' }, yearendlord: { ko: '생기부 대마왕', tier: 'legend', region: 'school' }
};

// 한 줄 설명 · 색. 몬스터전 첫 18종(monsters.js MONSTERS)은 거기에 있고, 나머지(기본 16 · 장소 36 · 새 18)는 여기에 있다.
export const MONSTER_TEXT = {
  // 기본 몬스터 중 몬스터전 순서에 없던 16종
  nightbat: ['야자 시간만 되면 교실 천장에 매달려 졸아 버리는 박쥐', '#5b5a9e'], cheatninja: ['커닝 페이퍼를 소매에 숨겼다가 들켜서 연기처럼 사라지는 닌자', '#3f4a5e'],
  nightzombie: ['밤새 공부했다더니 눈이 풀려 단어를 중얼거리며 걷는 좀비', '#7a9a62'], blinkjelly: ['외운 단어가 깜빡 하고 꺼지게 만드는 말랑 해파리', '#6ec6e8'],
  labskeleton: ['과학실에서 탈출해 뼈 소리로 딸깍딸깍 시험 범위를 읊는 해골', '#c9c4b0'], redpenghost: ['틀린 곳마다 빨간 동그라미를 치고 다니는 깐깐한 귀신', '#e5484d'],
  wrongmummy: ['오답노트를 붕대처럼 둘둘 감은, 같은 실수를 사랑하는 미라', '#c8b58a'], bagturtle: ['책가방이 너무 무거워 느리지만 한번 물면 안 놓는 거북', '#8a9a4c'],
  chalkangler: ['칠판 속에 숨어 분필 가루 불빛으로 학생을 유혹하는 아귀', '#2f6f5e'], sandwitch: ['모래시계를 뒤집어 시험 시간을 줄여 버리는 마녀', '#d9a441'],
  testspider: ['시험지 그물을 쳐 놓고 헷갈리는 보기만 골라 걸리게 하는 거미', '#b8a98a'], gatehound: ['지각생만 보면 교문에서 컹컹 짖는 덩치 큰 불독', '#7d5a3c'],
  homeworkogre: ['수행평가를 산더미처럼 안겨 주고 흐뭇해하는 오거', '#6b8e3d'], omrreaper: ['마킹 한 칸만 밀려도 낫을 휘두르는 OMR 사신', '#4b4570'],
  pianofang: ['학원 가는 길에 피아노 소리로 발목을 잡는 송곳니 마귀', '#8b3a62'], killergolem: ['킬러 문항만 모아 만든, 아무도 못 푼다는 골렘', '#6e7480'],
  // 숲
  wordsquirrel: ['도토리 대신 단어를 볼에 가득 모아 두는 다람쥐', '#b9803c'], spellshroom: ['철자를 하나 틀릴 때마다 포자를 뿜는 버섯', '#c9553d'], markerfly: ['형광펜 꽁무니로 중요한 곳에 밑줄을 쳐 주는 반딧불', '#d8e04a'],
  dictpecker: ['받아쓰기를 하듯 나무를 딱딱딱 쪼는 딱따구리', '#a85d3b'], vocabvine: ['영단어 잎을 틔우며 발목을 칭칭 감는 덩굴', '#4f9a45'],
  verbbeetle: ['동사 변화를 외치며 뿔로 들이받는 사슴벌레', '#6f4e37'], sentdryad: ['문장 가지를 쭉쭉 뻗는 숲속 나무정령', '#3f8f6a'],
  bearprincipal: ['숲속 전교 조회를 열고 한 시간째 훈화 중인 교장 곰', '#8c5a2b'], lexitreant: ['뿌리마다 사전을 품은 아주 오래된 트렌트', '#2f6b3a'],
  // 들판
  eraserbunny: ['귀로 틀린 글자를 쓱쓱 지우고 다니는 토끼', '#f0a8b8'], cliphopper: ['클립처럼 철컥 튀어 올라 종이를 집어 가는 메뚜기', '#9aa5b8'], postitfly: ['날개마다 할 일 쪽지가 붙어 팔랑이는 나비', '#f4d03f'],
  scarecrow: ['숙제를 안 한 학생만 쫓아다니는 허수아비', '#c9a24b'], wordgoose: ['단어장을 물고 꽥꽥 외우라고 재촉하는 거위', '#e8e2d0'],
  millgolem: ['복습! 복습! 하며 날개를 돌리는 풍차 골렘', '#b08968'], busbull: ['학원버스처럼 시간표대로 돌진하는 황소', '#e0a030'],
  sportsrhino: ['체육대회 날만 되면 눈빛이 변하는 코뿔소', '#4f86c6'], stormbird: ['방학이 끝나는 날 폭풍을 몰고 오는 거대한 새', '#5a6fb5'],
  // 바닷가
  commacrab: ['집게 대신 쉼표를 들고 옆으로 걷는 꽃게', '#e8704a'], quizconch: ['귀에 대면 물음표만 들리는 고둥', '#e9a0c8'], pencilgull: ['부리에 연필을 꽂고 끼룩끼룩 받아쓰는 갈매기', '#e8d27a'],
  dotocto: ['문장 끝마다 먹물로 마침표를 콕 찍는 문어', '#5b4a8c'], adjstar: ['반짝반짝 형용사를 팔 끝마다 달고 다니는 불가사리', '#f08a5d'],
  tripshark: ['수학여행 버스에서 내리자마자 따라붙는 상어', '#4a86a8'], bookray: ['교과서 책장처럼 납작하게 헤엄치는 가오리', '#6aa5c8'],
  testkraken: ['시험지 다리 열 개로 배를 통째로 휘감는 크라켄', '#3a5a8c'], leviathan: ['모든 문법 규칙을 삼켜 버렸다는 바다의 리바이어던', '#2b4c8f'],
  // 밤
  snackcoon: ['공부하다 말고 야식만 훔쳐 가는 너구리', '#8a7a68'], sleeppillow: ['베고 눕는 순간 잠꼬대로 정답을 날려 버리는 베개', '#a9a0d8'], tutorsquito: ['귓가에서 윙윙 과외 설명을 늘어놓는 모기', '#7a5a5a'],
  wolf2am: ['새벽 두 시만 되면 달을 보고 단어를 외치는 늑대인간', '#4a4f7a'], mutecat: ['알림을 끄고 슬금슬금 다니는 유령고양이', '#9aa0c8'],
  nightmare: ['시험 전날 밤마다 백지 답안지를 들고 찾아오는 악몽', '#3b2f5e'], batking: ['졸음 박쥐 떼를 이끌고 눈꺼풀을 내리는 박쥐왕', '#4b3f7a'],
  moongrader: ['달빛 아래서 빨간 불을 켜고 채점하는 채점관', '#7f7fcf'], reportdragon: ['한밤중 현관 앞에 성적표를 물고 나타나는 용', '#5a3f8f'],
  // 새 몬스터: 한밤의 도서관
  bookmarkbat: ['읽다 만 책 페이지로 날개를 접었다 폈다 하는 박쥐', '#2f8f8f'], dustbookworm: ['먼지 쌓인 책만 골라 야금야금 먹는 애벌레', '#a08a4c'], postitghost: ['떼었다 붙였다, 깜빡 잊을 때마다 나타나는 포스트잇 유령', '#f2c94c'],
  librarianowl: ['대출 기한을 하루만 넘겨도 연체료 도장을 쾅 찍는 올빼미', '#2c3e7a'], dictspider: ['뜻이 뭐였더라 하는 순간 사전 거미줄에 걸리게 하는 거미', '#9b2f3a'],
  forbiddenmimic: ['열지 말라고 쓰여 있는데 꼭 열고 싶어지는 책 미믹', '#5b3a8c'], indexgolem: ['찾아보기 서랍마다 카드가 가득, 찾는 건 절대 안 주는 골렘', '#a8743a'],
  libshadow: ['쉿! 한마디에 도서관 전체를 조용하게 만드는 관장님 그림자', '#4a2f7a'], shelfdragon: ['아직 안 읽은 책을 비늘 삼아 똬리를 튼 책탑 용', '#c9922f'],
  // 새 몬스터: 기말고사 학교
  latebell: ['종 치기 직전 헐레벌떡 달려오며 땡땡 울리는 종', '#e0b030'], lunchslime: ['식판에 남은 잔반이 뭉쳐 일어난 주황빛 슬라임', '#ef9a3c'], timetablefairy: ['체육 시간표만 몰래 지워 버리고 도망가는 요정', '#6fbf8a'],
  staffroomguard: ['교무실 문은 노크 먼저! 열쇠 꾸러미를 흔드는 문지기', '#8a6a3c'], classrobot: ['떠든 사람 이름을 칠판에 적는 임무에 충실한 반장 로봇', '#2f3f6b'],
  examoctopus: ['모르는 문제는 일단 다리 여덟 개로 찍고 보는 문어', '#d8d0b8'], barbargiant: ['턱걸이 철봉을 어깨에 메고 다니는 체육 거인', '#c06a3a'],
  examsetter: ['교과서에 없는 문제만 골라 내는 연필 모자 마법사', '#7a3f9a'], yearendlord: ['생활기록부 도장을 쾅쾅 찍는 학교의 대마왕', '#8f1d2c']
};

// 지역 8곳. own: 이 지역에 어울리는 몬스터(적힌 차례대로 먼저 쓴다), bg: 그림 배경이 없을 때 쓰는 임시 CSS 배경.
//   숲 · 들판 · 바닷가 · 밤은 hunt-rules.js의 place 값(36종), 한밤의 도서관 · 기말고사 학교는 새 몬스터, 야자 교실은 학교 · 공부 소재 기본 몬스터.
//   온 세상 보스 모음은 어느 지역에도 안 묶인 나머지 기본 몬스터가 모이는 마지막 지역이다(own 없음).
const place = at => Object.keys(HUNT_MONSTERS).filter(k => HUNT_MONSTERS[k].place === at);
const newOf = at => Object.keys(NEW_MONSTERS).filter(k => NEW_MONSTERS[k].region === at);
export const REGIONS = [
  { key: 'yaja', name: '야자 교실', icon: '🏫', bg: 'linear-gradient(180deg,#2c2455 0%,#6a3f7a 46%,#e58a46 100%)',
    own: ['nightbat', 'cheatninja', 'nightzombie', 'redpenghost', 'wrongmummy', 'testspider', 'bagturtle', 'proctor', 'homeworkogre', 'finalking'] },
  { key: 'forest', name: '숲', icon: '🌲', bg: 'linear-gradient(180deg,#bfe8c4 0%,#6dbb6f 52%,#2f7a4a 100%)', own: place('forest') },
  { key: 'field', name: '들판', icon: '🌾', bg: 'linear-gradient(180deg,#bfe3ff 0%,#e7e29a 55%,#a8c85a 100%)', own: place('field') },
  { key: 'beach', name: '바닷가', icon: '🏖️', bg: 'linear-gradient(180deg,#a9e3ff 0%,#6fc4e8 48%,#f3e2b0 100%)', own: place('beach') },
  { key: 'night', name: '밤', icon: '🌙', bg: 'linear-gradient(180deg,#0f1840 0%,#2c2f7a 55%,#5a4a9a 100%)', own: place('night') },
  { key: 'library', name: '한밤의 도서관', icon: '📚', bg: 'linear-gradient(180deg,#1d1740 0%,#4a2f6a 52%,#b0833a 100%)', own: newOf('library') },
  { key: 'school', name: '기말고사 학교', icon: '📝', bg: 'linear-gradient(180deg,#8fb8e8 0%,#c9d8ea 50%,#e8c46a 100%)', own: newOf('school') },
  { key: 'world', name: '온 세상 보스 모음', icon: '👑', bg: 'linear-gradient(180deg,#2a0f2f 0%,#8f1d3a 55%,#e0a030 100%)', own: [] }
];
export const REGION_COUNT = REGIONS.length;
export const CYCLE_LEVELS = REGION_COUNT * REGION_SIZE;

export const tierOf = key => HUNT_MONSTERS[key]?.tier || NEW_MONSTERS[key]?.tier || null;
export const koOf = key => HUNT_MONSTERS[key]?.ko || NEW_MONSTERS[key]?.ko || '';
// 기본 몬스터가 먼저(HUNT_MONSTERS 순서), 새 몬스터가 뒤(NEW_MONSTERS 순서).
export const ALL_MONSTER_KEYS = [...Object.keys(HUNT_MONSTERS), ...Object.keys(NEW_MONSTERS)];

const SLOT_TIERS = [...new Set(REGION_SLOTS)];
const slotsOf = tier => REGION_SLOTS.map((t, i) => t === tier ? i : -1).filter(i => i >= 0);
const owned = new Set(REGIONS.flatMap(r => r.own));
const memo = new Map();
// 그림 목록(art)에서 만든 지역별 후보 줄: plan[지역][등급] = 후보 키(앞에서부터 쓴다).
function plan(art) {
  const sig = ALL_MONSTER_KEYS.filter(k => art.has(k)).join(',');
  if (memo.has(sig)) return memo.get(sig);
  const ready = ALL_MONSTER_KEYS.filter(k => art.has(k));
  const out = REGIONS.map((r, ri) => Object.fromEntries(SLOT_TIERS.map(tier => {
    const n = slotsOf(tier).length;
    const own = r.own.filter(k => art.has(k) && tierOf(k) === tier);
    const pool = ready.filter(k => tierOf(k) === tier && !own.includes(k));
    const free = pool.filter(k => !owned.has(k)), bound = pool.filter(k => owned.has(k));
    const turn = (list, by) => list.length ? [...list.slice(by % list.length), ...list.slice(0, by % list.length)] : list;
    const rest = [...turn(free, ri * n), ...turn(bound, ri * n)];
    return [tier, [...own, ...rest]];
  })));
  if (memo.size > 8) memo.clear();
  memo.set(sig, out);
  return out;
}
// 한 지역(번호 0부터, 몇 바퀴째인지 lap)의 10칸 몬스터 key 줄.
export function regionKeys(regionIndex, lap = 0, art = MONSTER_ART) {
  const cand = plan(art)[((regionIndex % REGION_COUNT) + REGION_COUNT) % REGION_COUNT];
  const keys = [];
  for (const tier of SLOT_TIERS) {
    const list = cand[tier], n = slotsOf(tier).length, start = (Math.max(0, lap) * n) % list.length;
    slotsOf(tier).forEach((slot, j) => { keys[slot] = list[(start + j) % list.length]; });
  }
  return keys;
}
// 레벨(1~9999) 하나의 위치: 몇 바퀴째(lap) · 몇 번째 지역(region) · 몇 번째 칸(slot, 0~9).
export function stagePlace(stage) {
  const i = Math.max(1, Math.min(9999, Math.floor(Number(stage) || 1))) - 1;
  return { lap: Math.floor(i / CYCLE_LEVELS), region: Math.floor((i % CYCLE_LEVELS) / REGION_SIZE), slot: i % REGION_SIZE, number: Math.floor(i / REGION_SIZE) + 1 };
}
// 레벨의 지역 정보: 화면의 지역 이름 · 배경 · 새 지역 안내가 쓴다(first: 이 레벨이 그 지역의 첫 레벨).
export function stageRegion(stage) {
  const p = stagePlace(stage), r = REGIONS[p.region];
  return { key: r.key, name: r.name, icon: r.icon, bg: r.bg, number: p.number, index: p.region, lap: p.lap, slot: p.slot, first: p.slot === 0 };
}
export function stageMonsterKey(stage, art = MONSTER_ART) {
  const p = stagePlace(stage);
  return regionKeys(p.region, p.lap, art)[p.slot];
}
