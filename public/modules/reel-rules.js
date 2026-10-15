import { FISH, FISH_KEYS, LURES, RARITY_KEYS, seeded } from './fishing-rules.js';

// V13.150 손맛 낚시(놀이터): 단어 없이 던지기 · 입질 · 파이팅으로 낚는 미니게임. 미끼는 공부로 번다.
// 물고기는 던질 때 서버가 정하고(reelRoll), 파이팅을 이기면 어망에 들어간다. 어망 물고기는 진주로 팔고, 진주로 코인 · 알 · 바다 펫을 바꾼다.
// 화면은 reel.js, 서버는 server/reel.mjs.

export const REEL = {
  BAIT_DAILY: 5,          // 하루에 벌 수 있는 미끼
  BAIT_MAX: 10,           // 들고 있을 수 있는 미끼
  BAIT_MIN_PRACTICE: 10,  // 이만큼 끝까지 푼 연습이 미끼 1개
  PEARLS: { common: 10, uncommon: 25, rare: 60, epic: 150, legend: 400, golden: 0 },
  COIN_DAILY: 100,        // 진주 → 코인(1:1) 하루 한도
  EGG: 600, EGG_DAILY: 1,
  EPIC_EGG: 2000, EPIC_WEEKLY: 1,
  SEA_PET: 4000,
  SEA_READY: false,       // 바다 펫 그림(주문서 28)이 들어와 core.js CHARACTERS에 등록되면 true(그 전에는 교환소에서 잠김)
  GOLDEN_EGG: 3,          // 황금 알 물고기 3마리 → 랜덤 알 선물
  LIVE_MS: 10 * 60000     // 던진 뒤 이 시간 안에 끝내지 않으면 놓친 것으로
};
// 교환소 한정 바다 펫(그림 주문서 28). 영웅급 · 물 속성 · 야차전 특기 있음(battle-engine.js PET_SKILLS, pet-sim 승률 49~53%).
// 그림이 들어오면 아래 char를 core.js CHARACTERS에 { ...char, sea: true }로 넣고 REEL.SEA_READY를 true로 바꾼다.
export const SEA_PETS = [
  { key: 'dolphin', ko: '퐁당', kind: '돌고래', char: { name: 'PONGDANG', ko: '퐁당', type: '아기 돌고래', color: '#3B9BD8', light: '#B8E1F7', soft: '#EEF8FE' } },
  { key: 'seahorse', ko: '살랑', kind: '해마', char: { name: 'SALLANG', ko: '살랑', type: '아기 해마', color: '#E58BB0', light: '#F8CFE0', soft: '#FFF2F7' } },
  { key: 'hermitcrab', ko: '집게', kind: '소라게', char: { name: 'JIPGE', ko: '집게', type: '소라게', color: '#E07A4F', light: '#F6C6AE', soft: '#FFF3EC' } }
];
export const CAST_TIERS = ['ok', 'good', 'perfect'];
// 파이팅 세기(등급마다): 체력(hp, 예전 판 호환) · 당기는 힘 · 행동 간격(ms) · 최소 파이팅 시간(서버가 확인) · 그림자 크기
// V13.150 1인칭 손맛: 처음 거리(m) · 행동 간격(dash, ms) · 행동 가중치.
//   탈출 연타(mash): 좌우 버튼을 번갈아 taps번(2.6초 안). 리듬(rhythm): 내려오는 노트 notes개를 beat(ms) 박자로 맞춰 누르기.
//   날뜀(thrash): 손 떼기. 잠수(dive): 꾹 버티기.
export const FIGHT = {
  common: { hp: 100, pull: .55, dash: [2400, 3800], min: 4000, size: 1, dist: 14, moves: { mash: 3, rhythm: 2, thrash: 1, dive: 1 }, taps: 10, notes: 6, beat: 520 },
  uncommon: { hp: 140, pull: .75, dash: [2200, 3500], min: 5500, size: 1.25, dist: 18, moves: { mash: 3, rhythm: 3, thrash: 2, dive: 1 }, taps: 12, notes: 7, beat: 480 },
  rare: { hp: 190, pull: .95, dash: [2000, 3200], min: 7000, size: 1.55, dist: 24, moves: { mash: 3, rhythm: 3, thrash: 2, dive: 2 }, taps: 14, notes: 8, beat: 440 },
  epic: { hp: 250, pull: 1.2, dash: [1800, 2900], min: 9000, size: 1.9, dist: 30, moves: { mash: 3, rhythm: 3, thrash: 2, dive: 2 }, taps: 16, notes: 9, beat: 400 },
  legend: { hp: 320, pull: 1.45, dash: [1600, 2600], min: 11000, size: 2.3, dist: 38, moves: { mash: 3, rhythm: 4, thrash: 3, dive: 2 }, taps: 18, notes: 10, beat: 360 },
  golden: { hp: 190, pull: 1, dash: [2000, 3200], min: 7000, size: 1.5, dist: 24, moves: { mash: 3, rhythm: 3, thrash: 2, dive: 1 }, taps: 14, notes: 8, beat: 420 }
};
// 마무리: 물고기가 물 위로 뛰어오를 때 맞춰 탭하면 퍼펙트(무게 +8%, 기록용). 무게는 서버가 곱한다.
export const FINISH = { PERFECT_KG: 1.08, KINDS: ['perfect', 'good', 'miss'] };
export const stars = rarity => ({ common: 1, uncommon: 2, rare: 3, epic: 4, legend: 5, golden: 5 })[rarity] || 1;
export const pearlsOf = key => REEL.PEARLS[FISH[key]?.rarity] || 0;

// 던질 때 정해지는 물고기: 퍼펙트면 미끼 두 단계, 좋음이면 한 단계 좋게 굴린다. 물 속성 펫은 희귀 이상이 조금 더.
export function reelRoll(seed, cast = 'ok', { water = false } = {}) {
  const rnd = seeded(Number(seed) >>> 0);
  const L = LURES[Math.max(0, CAST_TIERS.indexOf(cast))];
  if (rnd() * 100 < L.golden) return { key: 'goldenegg', kg: FISH.goldenegg.kg[0], rarity: 'golden' };
  const odds = RARITY_KEYS.map(k => [k, L.odds[k] * (water && !['common', 'uncommon'].includes(k) ? 1.2 : 1)]);
  let roll = rnd() * odds.reduce((n, [, w]) => n + w, 0), rarity = 'common';
  for (const [k, w] of odds) { if ((roll -= w) <= 0) { rarity = k; break; } }
  const keys = FISH_KEYS.filter(k => FISH[k].rarity === rarity);
  const key = keys[Math.min(keys.length - 1, Math.floor(rnd() * keys.length))];
  const [lo, hi] = FISH[key].kg, curve = cast === 'perfect' ? .6 : cast === 'good' ? .85 : 1.2;
  return { key, rarity, kg: Math.round((lo + (hi - lo) * Math.pow(rnd(), curve)) * 100) / 100 };
}
// 한 주(월요일 시작, 한국 시간) 번호: 영웅 알 교환 한도.
export const weekNum = ts => Math.floor((Number(ts) + 9 * 3600000 + 3 * 86400000) / (7 * 86400000));
