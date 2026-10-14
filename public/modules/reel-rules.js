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
  GOLDEN_EGG: 3,          // 황금 알 물고기 3마리 → 랜덤 알 선물
  LIVE_MS: 10 * 60000     // 던진 뒤 이 시간 안에 끝내지 않으면 놓친 것으로
};
// 교환소 한정 바다 펫(그림 주문서 28). 그림이 들어와 펫으로 등록되기 전에는 '곧 만나요'로 잠겨 있다.
export const SEA_PETS = [
  { key: 'dolphin', ko: '퐁당', kind: '돌고래' },
  { key: 'seahorse', ko: '살랑', kind: '해마' },
  { key: 'hermitcrab', ko: '집게', kind: '소라게' }
];
export const CAST_TIERS = ['ok', 'good', 'perfect'];
// 파이팅 세기(등급마다): 체력 · 당기는 힘 · 돌진 간격(ms) · 최소 파이팅 시간(서버가 확인) · 그림자 크기.
export const FIGHT = {
  common: { hp: 100, pull: .55, dash: [5200, 8000], min: 4000, size: 1 },
  uncommon: { hp: 140, pull: .75, dash: [4200, 6600], min: 5500, size: 1.25 },
  rare: { hp: 190, pull: .95, dash: [3400, 5400], min: 7000, size: 1.55 },
  epic: { hp: 250, pull: 1.2, dash: [2800, 4400], min: 9000, size: 1.9 },
  legend: { hp: 320, pull: 1.45, dash: [2300, 3700], min: 11000, size: 2.3 },
  golden: { hp: 190, pull: 1, dash: [3200, 5200], min: 7000, size: 1.5 }
};
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
