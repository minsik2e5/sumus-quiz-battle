import { seeded } from './fishing-rules.js';
import { MONSTER_ART } from './monster-art.js';

// V13.162 몬스터 사냥(놀이터, 처음 이름 '펫 사냥'): 포켓몬 고처럼 그림 지도 위의 야생 몬스터를 눌러 만나고, 공을 위로 밀어 던져 잡는다.
// 선생님 결정(V13.162 테스트 뒤): 펫을 사냥으로 많이 얻으면 알을 안 사므로 '몬스터 위주'. 잡은 몬스터는 가방에 모아
//   팔아서 별조각을 받고, 교환소에서 코인(하루 한도) · 랜덤 알 · 영웅 알로 바꾼다(낚시 진주와 같은 구조).
//   펫(아직 못 만난 기본 · 영웅)은 낮은 확률로만 나오고 더 잘 도망친다. 잡으면 파트너 펫이 경험치를 받는다.
// 공은 공부로만 받는다(연습 끝 · 출석 · 짝 맞추기 별 3). 만남 · 잡힘 · 도망은 서버가 정한다(server/hunt.mjs). 화면은 hunt.js.
// 밸런스 목표: 하루 가치 ≈ 낚시 하루(열심 약 90 · 보통 약 30코인어치, 랜덤 알 400 · 영웅 알 800 코인으로 계산).

export const HUNT = {
  BALL_MAX: 6,                 // 들고 있을 수 있는 기본 · 좋은 공(합)
  SOURCES: ['practice', 'attend', 'match'], // 하루에 곳마다 1개(연습 끝내기 10문제 이상 · 출석 · 짝 맞추기 별 3) → 하루 최대 3개
  MIN_PRACTICE: 10,            // 낚시 미끼와 같은 조건
  GOOD_CHANCE: 35,             // 만점 연습 · 짝 맞추기 별 3에서 받는 공이 좋은 공일 확률(%)
  GOOD_DAILY: 1,               // 좋은 공은 하루 1개까지(받는 공 3개 안에서 바뀌는 것: 하루 공 수는 그대로)
  GOLD_CARDS: 4,               // 출석 도장판(7칸) 4장을 채우면 황금 공 1개(한 달에 1개)
  GOLD_MAX: 2,
  // 몬스터 등급이 나올 확률(%, 지도에 자리가 생길 때)
  SPAWN: { common: 42, uncommon: 28, rare: 17, epic: 9, legend: 4 },
  PET: 7,                      // 만남을 끝낼(잡거나 도망) 때마다 다음 자리에 아직 못 만난 펫이 나올 확률(%)
  PET_EPIC: 15,                // 펫 중 영웅(나머지는 기본). 전설 · 신화 · 한정 · 바다 펫은 안 나온다
  // 기본 공 하나로 잡힐 확률 · 빠져나온 뒤 도망칠 확률(%). 펫은 몬스터보다 어렵게(선생님 결정).
  CATCH: { common: 40, uncommon: 30, rare: 22, epic: 14, legend: 8, pet: 12, petEpic: 6 },
  FLEE: { common: 15, uncommon: 20, rare: 25, epic: 30, legend: 35, pet: 30, petEpic: 35 },
  BALLS: { basic: 1, good: 1.5, gold: 0 }, // 잡힘 배수(황금 공은 무조건 잡힘)
  THROWS: { nice: 1.1, great: 1.25, excellent: 1.6 }, // 원이 작을 때 던지면
  BERRY_CATCH: 1.5,            // 🍓 잡기 ×1.5
  BERRY_REWARD: 2,             // 🍍 잡으면 보상 ×2(몬스터 2마리)
  STARS: { common: 22, uncommon: 48, rare: 110, epic: 240, legend: 560 }, // 몬스터 한 마리를 팔면 받는 별조각
  XP: { common: 3, uncommon: 4, rare: 6, epic: 9, legend: 14 },           // 잡으면 파트너 펫 경험치
  COIN_DAILY: 60,              // 별조각 → 코인(1:1) 하루 한도
  EGG: 600, EPIC_EGG: 800,     // 교환소 알(각각 하루 1개, 낚시 진주 교환소와 같은 값)
  SPOTS: [3, 5],               // 지도 위 몬스터 수
  SLOT_HOURS: 4,               // 이 시간마다 지도의 몬스터가 바뀐다(만나는 중 · 펫 자리는 그대로)
  PREVIEW: { BALLS: 6, GOOD: 3, GOLD: 1 }, // 교사 미리보기 계정: 들어올 때마다 채운다
  // V13.167 던지기 품질은 화면이 재므로 서버가 대략 확인한다(진짜 손맛은 그대로):
  //   최근 WINDOW번(공을 쓴 던지기) 중 엑설런트가 EXCELLENT 비율 이상이면 이번 엑설런트는 그레이트로,
  //   그레이트 이상이 TOP 비율 이상이면 이번 그레이트 · 엑설런트는 나이스로. MIN번 던지기 전에는 보지 않는다.
  //   만나거나 앞 던지기 뒤 GAP_MS보다 빨리 온 던지기는 품질 없이(공이 날아가는 데만 0.8초 넘게 걸린다).
  //   보통 학생(엑설런트 약 10% · 그레이트 이상 약 30%)과 아주 잘하는 학생(엑설런트 25%)은 거의 걸리지 않는다(검사).
  QUALITY_GUARD: { WINDOW: 20, MIN: 8, EXCELLENT: .55, TOP: .85, GAP_MS: 800 },
  BERRY_QUIZ_MIN: 4             // 열매 문제는 서버가 낸다: 범위에서 뜻이 다른 단어가 이만큼은 있어야 4지선다
};
export const MONSTER_TIERS = ['common', 'uncommon', 'rare', 'epic', 'legend'];
// 몬스터 등급은 별(★1~5)과 이름(꼬마 · 보통 · 희귀 · 대장 · 보스)으로 쓴다: 펫 등급(기본 · 영웅 · 전설)과 헷갈리지 않게(선생님 결정).
export const TIER_NAMES = { common: '꼬마', uncommon: '보통', rare: '희귀', epic: '대장', legend: '보스', pet: '기본 펫', petEpic: '영웅 펫' };
export const TIER_STARS = { common: 1, uncommon: 2, rare: 3, epic: 4, legend: 5 };
export const tierStars = t => '★'.repeat(TIER_STARS[t] || 0);
export const tierLabel = t => TIER_STARS[t] ? `${tierStars(t)} ${TIER_NAMES[t]}` : TIER_NAMES[t];
// 사냥 몬스터(그림은 몬스터전 · 던전 그림 public/assets/monsters/{key}{,-attack,-hurt,-down}.webp를 그대로 쓴다).
export const HUNT_MONSTERS = {
  slime: { ko: '스펠링 슬라임', tier: 'common' }, mochi: { ko: '암기 모찌', tier: 'common' }, pencilworm: { ko: '샤프 벌레', tier: 'common' },
  nightbat: { ko: '야자 박쥐', tier: 'common' }, sleepcloud: { ko: '졸음 구름', tier: 'common' }, forgetghost: { ko: '까먹귀', tier: 'common' },
  cheatninja: { ko: '커닝 닌자', tier: 'common' }, nightzombie: { ko: '밤샘 좀비', tier: 'common' },
  mimic: { ko: '노트 미믹', tier: 'uncommon' }, clock: { ko: '째깍 도둑', tier: 'uncommon' }, alarmwolf: { ko: '알람 늑대', tier: 'uncommon' },
  scrollgoblin: { ko: '무한 스크롤 도깨비', tier: 'uncommon' }, redpenghost: { ko: '빨간펜 귀신', tier: 'uncommon' }, wrongmummy: { ko: '오답노트 미라', tier: 'uncommon' },
  blinkjelly: { ko: '깜빡 해파리', tier: 'uncommon' }, labskeleton: { ko: '과학실 해골', tier: 'uncommon' },
  phone: { ko: '폰마왕', tier: 'rare' }, testspider: { ko: '시험지 거미', tier: 'rare' }, sandwitch: { ko: '모래시계 마녀', tier: 'rare' },
  bagturtle: { ko: '책가방 거북', tier: 'rare' }, chalkangler: { ko: '칠판 아귀', tier: 'rare' }, proctor: { ko: '감독 기사', tier: 'rare' },
  cramwizard: { ko: '벼락치기 마법사', tier: 'rare' },
  golem: { ko: '문법 골렘', tier: 'epic' }, pirate: { ko: '오답 해적 선장', tier: 'epic' }, owlnight: { ko: '밤샘 부엉 대장', tier: 'epic' },
  omrreaper: { ko: 'OMR 사신', tier: 'epic' }, pianofang: { ko: '피아노 마귀', tier: 'epic' }, homeworkogre: { ko: '수행평가 오거', tier: 'epic' },
  gatehound: { ko: '교문 불독', tier: 'epic' },
  mockhydra: { ko: '모의고사 히드라', tier: 'legend' }, dictdragon: { ko: '딕셔너리 드래곤', tier: 'legend' }, finalking: { ko: '수능 대마왕', tier: 'legend' },
  killergolem: { ko: '킬러 골렘', tier: 'legend' },
  // V13.166 장소 몬스터 36종(선생님 확정): 숲 · 들판 · 바닷가 · 밤마다 9종(★1 3 · ★2 2 · ★3 2 · ★4 1 · ★5 1). 그 지도 · 시간에만 나온다.
  //   그림(주문서 35)이 들어오기 전에는 나오지 않는다(MONSTER_ART: build:assets가 그림 폴더를 보고 만든다).
  wordsquirrel: { ko: '단어 다람쥐', tier: 'common', place: 'forest' }, spellshroom: { ko: '철자 버섯', tier: 'common', place: 'forest' }, markerfly: { ko: '형광펜 반딧불', tier: 'common', place: 'forest' },
  dictpecker: { ko: '받아쓰기 딱따구리', tier: 'uncommon', place: 'forest' }, vocabvine: { ko: '영단어 덩굴', tier: 'uncommon', place: 'forest' },
  verbbeetle: { ko: '동사 사슴벌레', tier: 'rare', place: 'forest' }, sentdryad: { ko: '문장 나무정령', tier: 'rare', place: 'forest' },
  bearprincipal: { ko: '숲속 교장 곰', tier: 'epic', place: 'forest' }, lexitreant: { ko: '고대 사전 트렌트', tier: 'legend', place: 'forest' },
  eraserbunny: { ko: '지우개 토끼', tier: 'common', place: 'field' }, cliphopper: { ko: '클립 메뚜기', tier: 'common', place: 'field' }, postitfly: { ko: '포스트잇 나비', tier: 'common', place: 'field' },
  scarecrow: { ko: '숙제 허수아비', tier: 'uncommon', place: 'field' }, wordgoose: { ko: '단어장 거위', tier: 'uncommon', place: 'field' },
  millgolem: { ko: '복습 풍차 골렘', tier: 'rare', place: 'field' }, busbull: { ko: '학원버스 황소', tier: 'rare', place: 'field' },
  sportsrhino: { ko: '체육대회 코뿔소', tier: 'epic', place: 'field' }, stormbird: { ko: '방학 끝 폭풍새', tier: 'legend', place: 'field' },
  commacrab: { ko: '쉼표 꽃게', tier: 'common', place: 'beach' }, quizconch: { ko: '물음표 고둥', tier: 'common', place: 'beach' }, pencilgull: { ko: '연필 갈매기', tier: 'common', place: 'beach' },
  dotocto: { ko: '마침표 먹물문어', tier: 'uncommon', place: 'beach' }, adjstar: { ko: '형용사 불가사리', tier: 'uncommon', place: 'beach' },
  tripshark: { ko: '수학여행 상어', tier: 'rare', place: 'beach' }, bookray: { ko: '교과서 가오리', tier: 'rare', place: 'beach' },
  testkraken: { ko: '시험지 크라켄', tier: 'epic', place: 'beach' }, leviathan: { ko: '문법 리바이어던', tier: 'legend', place: 'beach' },
  snackcoon: { ko: '야식 너구리', tier: 'common', place: 'night' }, sleeppillow: { ko: '잠꼬대 베개', tier: 'common', place: 'night' }, tutorsquito: { ko: '과외 모기', tier: 'common', place: 'night' },
  wolf2am: { ko: '새벽 두 시 늑대인간', tier: 'uncommon', place: 'night' }, mutecat: { ko: '알림 끈 유령고양이', tier: 'uncommon', place: 'night' },
  nightmare: { ko: '시험 전날 악몽', tier: 'rare', place: 'night' }, batking: { ko: '졸음 박쥐왕', tier: 'rare', place: 'night' },
  moongrader: { ko: '달빛 채점관', tier: 'epic', place: 'night' }, reportdragon: { ko: '한밤의 성적표 드래곤', tier: 'legend', place: 'night' }
};
export const MONSTER_KEYS = Object.keys(HUNT_MONSTERS);
export const monstersOf = tier => MONSTER_KEYS.filter(k => HUNT_MONSTERS[k].tier === tier);
// V13.166 장소: 숲 · 들판 · 바닷가는 그 지도(낮 · 밤 모두), 밤 몬스터는 어느 지도든 밤(19시 ~ 6시)에만. place가 없으면 어디서나.
export const HUNT_PLACES = { forest: '숲', field: '들판', beach: '바닷가', night: '밤' };
export const PLACE_EMOJI = { forest: '🌲', field: '🌾', beach: '🏖️', night: '🌙' };
export const monsterReady = k => !HUNT_MONSTERS[k]?.place || MONSTER_ART.has(k);
export const fitsPlace = (k, { area, night } = {}) => { const at = HUNT_MONSTERS[k]?.place; return !at || at === area || (at === 'night' && !!night); };
// 지금 지도에 나올 수 있는 그 등급 몬스터(그림이 있고 장소가 맞는 것). 기존 34종이 늘 있어서 비지 않는다.
export const spawnPool = (tier, where, ready = monsterReady) => monstersOf(tier).filter(k => ready(k) && fitsPlace(k, where));
export const placeHint = k => { const at = HUNT_MONSTERS[k]?.place; return at === 'night' ? '밤(저녁 7시 ~ 아침 6시)에 나와요' : at ? `${HUNT_PLACES[at]}에서 나와요` : '어디서나 나와요'; };
export const BALL_KINDS = ['basic', 'good', 'gold'];
export const BERRIES = {
  razz: { emoji: '🍓', name: '딸기', note: '잡기 ×1.5' },
  pinap: { emoji: '🍍', name: '파인애플', note: '몬스터를 잡으면 2마리' },
  nanab: { emoji: '🍌', name: '바나나', note: '원 · 몬스터가 천천히' }
};
export const THROW_NAMES = { nice: '나이스', great: '그레이트', excellent: '엑설런트' };
export const BALL_NAMES = { basic: '기본 공', good: '좋은 공', gold: '황금 공' };

// 한 번 던졌을 때 잡힐 확률(0~1). 황금 공은 1.
export function catchChance(tier, { ball = 'basic', quality = null, berry = null } = {}) {
  if (ball === 'gold') return 1;
  const base = (HUNT.CATCH[tier] ?? HUNT.CATCH.common) / 100;
  return Math.min(1, base * (HUNT.BALLS[ball] || 1) * (HUNT.THROWS[quality] || 1) * (berry === 'razz' ? HUNT.BERRY_CATCH : 1));
}
// 던지기 결과. r1 · r2는 0~1 난수(서버가 만든다). shakes: 흔들림 수(잡히면 3, 빠져나오면 1~3).
export function rollThrow(tier, opts, r1, r2) {
  const p = catchChance(tier, opts);
  if (r1 < p) return { caught: true, fled: false, shakes: 3 };
  const close = p > 0 ? Math.min(1, p / Math.max(r1, 1e-9)) : 0;
  const shakes = close > .7 ? 3 : close > .35 ? 2 : 1;
  return { caught: false, fled: r2 < (HUNT.FLEE[tier] ?? HUNT.FLEE.common) / 100, shakes };
}
// V13.167 던지기 품질 확인. log: 최근 던지기에서 화면이 보낸 품질(null · 'nice' · 'great' · 'excellent'), gap: 앞 일(만나기 · 던지기) 뒤 ms.
export function guardQuality(quality, log = [], gap = Infinity) {
  const G = HUNT.QUALITY_GUARD;
  if (!quality) return null;
  if (gap < G.GAP_MS) return null;
  const recent = log.slice(-G.WINDOW);
  if (recent.length < G.MIN) return quality;
  const share = test => recent.filter(test).length / recent.length;
  let q = quality;
  if (q === 'excellent' && share(x => x === 'excellent') >= G.EXCELLENT) q = 'great';
  if ((q === 'great' || q === 'excellent') && share(x => x === 'great' || x === 'excellent') >= G.TOP) q = 'nice';
  return q;
}
// 몬스터 등급 뽑기(r: 0~1).
export function spawnTier(r) {
  let acc = 0;
  for (const t of MONSTER_TIERS) { acc += HUNT.SPAWN[t]; if (r * 100 < acc) return t; }
  return 'common';
}
// 펫 등급(기본 85% · 영웅 15%). 한쪽을 다 모았으면 다른 쪽. 둘 다 다 모았으면 null. 돌려주는 값은 잡기 등급('pet' | 'petEpic').
export function petTier(r, left) {
  let tier = r * 100 < HUNT.PET_EPIC ? 'petEpic' : 'pet';
  const n = t => t === 'pet' ? left.basic : left.epic;
  if (!n(tier)) tier = tier === 'pet' ? 'petEpic' : 'pet';
  return n(tier) ? tier : null;
}
// 지도 슬롯(몇 시간마다 바뀜). KST 기준.
export const huntSlot = now => Math.floor((Number(now) + 9 * 3600000) / (HUNT.SLOT_HOURS * 3600000));

// 밸런스 시뮬레이션(검사가 부른다: server/hunt-check.mjs). 한 학생이 days일 동안 받은 공을 다 쓴다고 본다.
//   daily: 하루 공 수(열심 3 · 보통 1), goodRolls: 좋은 공 기회(열심: 만점 연습 · 별 3 → 2번), 출석은 매일(28일에 황금 공 1개, 펫에게 쓴다).
//   던지기 품질: 원 밖 40% · 나이스 30% · 그레이트 20% · 엑설런트 10%. 열매는 던지기의 30%(berries)에 쓴다(펫 · 영웅 이상에 🍓, 나머지 🍍).
//   공이 떨어지면 만나는 중인 몬스터는 다음 날 이어서 잡는다. 지도에서는 가장 높은 등급부터 만난다고 본다(욕심쟁이).
export function huntSim({ days = 30, daily = 3, goodRolls = 0, berries = .3, start = { basic: 3, epic: 0 }, total = { basic: 21, epic: 21 }, seed = 1 } = {}) {
  const rand = seeded(seed);
  const have = { ...start }, out = { basic: 0, epic: 0, stars: 0, xp: 0, meets: 0, throws: 0, caught: 0, legend: 0 };
  let basic = 0, good = 0, gold = 0, pet = null, live = null;
  const spots = () => Array.from({ length: 3 + Math.floor(rand() * 3) }, () => spawnTier(rand()));
  let map = spots(), mapDay = 0;
  const quality = () => { const r = rand(); return r < .4 ? null : r < .7 ? 'nice' : r < .9 ? 'great' : 'excellent'; };
  for (let day = 1; day <= days; day++) {
    let goodToday = 0;
    for (let i = 0; i < daily; i++) {
      if (basic + good >= HUNT.BALL_MAX) break;
      if (i < goodRolls && goodToday < HUNT.GOOD_DAILY && rand() * 100 < HUNT.GOOD_CHANCE) { good++; goodToday++; } else basic++;
    }
    if (day % (7 * HUNT.GOLD_CARDS) === 0 && gold < HUNT.GOLD_MAX) gold++;
    if (day !== mapDay) { map = spots(); mapDay = day; }
    while (basic + good + gold > 0) {
      if (!live) {
        if (pet) { live = { tier: pet, pet: true }; pet = null; }
        else { if (!map.length) map = spots(); map.sort((a, b) => MONSTER_TIERS.indexOf(b) - MONSTER_TIERS.indexOf(a)); live = { tier: map.shift(), pet: false }; }
        out.meets++;
      }
      const big = live.pet || live.tier === 'epic' || live.tier === 'legend';
      const ball = live.pet ? (gold ? 'gold' : good ? 'good' : 'basic') : big ? (good ? 'good' : basic ? 'basic' : 'gold') : (basic ? 'basic' : good ? 'good' : 'gold');
      if (ball === 'gold') gold--; else if (ball === 'good') good--; else basic--;
      out.throws++;
      const berry = rand() < berries ? (big ? 'razz' : 'pinap') : null;
      const res = rollThrow(live.tier, { ball, quality: quality(), berry }, rand(), rand());
      if (!res.caught && !res.fled) continue;
      if (res.caught && live.pet) { const t = live.tier === 'petEpic' ? 'epic' : 'basic'; have[t]++; out[t]++; }
      else if (res.caught) { const n = berry === 'pinap' ? HUNT.BERRY_REWARD : 1; out.stars += HUNT.STARS[live.tier] * n; out.xp += HUNT.XP[live.tier]; out.caught += n; if (live.tier === 'legend') out.legend++; }
      live = null;
      if (!pet && rand() * 100 < HUNT.PET) pet = petTier(rand(), { basic: total.basic - have.basic, epic: total.epic - have.epic });
    }
  }
  return out;
}
export function huntSimAverage(opts, runs = 3000) {
  const sum = { basic: 0, epic: 0, stars: 0, meets: 0, throws: 0, caught: 0, legend: 0 };
  for (let s = 1; s <= runs; s++) { const r = huntSim({ ...opts, seed: s * 7919 }); for (const k of Object.keys(sum)) sum[k] += r[k]; }
  return Object.fromEntries(Object.entries(sum).map(([k, v]) => [k, Math.round(v / runs * 100) / 100]));
}
// 하루 가치(코인어치): 별조각은 알 값(600개 = 랜덤 알 400코인)으로, 펫은 알 값(기본 400 · 영웅 800)으로.
export const dayValue = (r, days = 30) => Math.round((r.stars * 400 / HUNT.EGG + r.basic * 400 + r.epic * 800) / days);
