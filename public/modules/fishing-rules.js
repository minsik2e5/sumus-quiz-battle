// V13.149 물고기 · 미끼 · 등급 규칙. 물고기 24종(V13.185 심해 8종은 따로, DEEP_KEYS)과 낚는 확률(rollCast)은 반 전체 낚시(server/party-engine.mjs)와
// V13.150 놀이터 손맛 낚시(reel-rules.js reelRoll)가 같이 쓴다. 같은 seed면 화면과 서버가 같은 물고기를 얻는다.

export const FISHING = {
  FAST_MS: 3000,          // 반 전체 낚시: 이 안에 맞히면 '빠름'(큰 물고기)
  OK_MS: 6000             // 이 안이면 '보통'
};
export const RARITY = {
  common: { name: '흔함', color: '#64748b' },
  uncommon: { name: '보통', color: '#16a34a' },
  rare: { name: '희귀', color: '#2563eb' },
  epic: { name: '영웅', color: '#9333ea' },
  legend: { name: '전설', color: '#f59e0b' },
  golden: { name: '특별', color: '#eab308' }
};
export const RARITY_KEYS = ['common', 'uncommon', 'rare', 'epic', 'legend'];
// 물고기: 이름 · 등급 · 무게(kg) 범위 · 그림 모양(fishing-art.js). 모양은 코드 그림이고, 그림 주문서 26이 오면 그림으로 바뀐다.
export const FISH = {
  minnow: { name: '송사리', rarity: 'common', kg: [0.05, 0.2], art: { body: 'slim', c1: '#9fb7c9', c2: '#e8f1f7', fin: '#7d97ab', mark: 'line' } },
  chub: { name: '피라미', rarity: 'common', kg: [0.1, 0.4], art: { body: 'slim', c1: '#7aa6c2', c2: '#f1f6fa', fin: '#e46a5a', mark: 'bars' } },
  crucian: { name: '붕어', rarity: 'common', kg: [0.2, 1.1], art: { body: 'round', c1: '#a68a4c', c2: '#efe2b7', fin: '#8a7038', mark: 'scales' } },
  sardine: { name: '정어리', rarity: 'common', kg: [0.1, 0.3], art: { body: 'slim', c1: '#3e6f9a', c2: '#e6eef5', fin: '#5d84a7', mark: 'dots' } },
  mackerel: { name: '고등어', rarity: 'common', kg: [0.3, 1.2], art: { body: 'torpedo', c1: '#2f7d78', c2: '#eef5f2', fin: '#4b8f89', mark: 'waves' } },
  saury: { name: '꽁치', rarity: 'common', kg: [0.1, 0.4], art: { body: 'needle', c1: '#38598a', c2: '#e9eef6', fin: '#e5b53a', mark: 'line' } },
  carp: { name: '잉어', rarity: 'uncommon', kg: [1, 6], art: { body: 'round', c1: '#d9822b', c2: '#fbe3c3', fin: '#c4561d', mark: 'scales', whisker: true } },
  flounder: { name: '광어', rarity: 'uncommon', kg: [1, 5], art: { body: 'flat', c1: '#8c7a5b', c2: '#efe6d3', fin: '#76654a', mark: 'dots' } },
  rockfish: { name: '우럭', rarity: 'uncommon', kg: [0.5, 3], art: { body: 'round', c1: '#4b4f5c', c2: '#c9ccd6', fin: '#3a3d48', mark: 'bars', spiky: true } },
  salmon: { name: '연어', rarity: 'uncommon', kg: [2, 8], art: { body: 'torpedo', c1: '#7c8fa3', c2: '#ffb3a1', fin: '#6c7f92', mark: 'dots' } },
  catfish: { name: '메기', rarity: 'uncommon', kg: [1, 7], art: { body: 'long', c1: '#5d5a52', c2: '#d7d2c4', fin: '#4a4740', mark: 'none', whisker: true } },
  puffer: { name: '복어', rarity: 'uncommon', kg: [0.5, 2], art: { body: 'ball', c1: '#d9b44a', c2: '#fff6d6', fin: '#b8902c', mark: 'dots', spiky: true } },
  tuna: { name: '참치', rarity: 'rare', kg: [10, 60], art: { body: 'torpedo', c1: '#1e3a6e', c2: '#dbe4f0', fin: '#f2c230', mark: 'finlets' } },
  ray: { name: '가오리', rarity: 'rare', kg: [5, 30], art: { body: 'ray', c1: '#5b6b8c', c2: '#e3e7f0', fin: '#46546f', mark: 'dots' } },
  cod: { name: '대구', rarity: 'rare', kg: [5, 20], art: { body: 'long', c1: '#8b7d62', c2: '#efe8d8', fin: '#776a51', mark: 'dots', whisker: true } },
  lionfish: { name: '쏠배감펭', rarity: 'rare', kg: [3, 9], art: { body: 'round', c1: '#c2412d', c2: '#fde3d8', fin: '#e8826f', mark: 'bars', spiky: true } },
  swordfish: { name: '황새치', rarity: 'epic', kg: [40, 150], art: { body: 'sword', c1: '#2b3f66', c2: '#d6dde9', fin: '#22324f', mark: 'none' } },
  sunfish: { name: '개복치', rarity: 'epic', kg: [80, 250], art: { body: 'moon', c1: '#8796ad', c2: '#e6eaf1', fin: '#6f7d93', mark: 'none' } },
  shark: { name: '상어', rarity: 'epic', kg: [100, 300], art: { body: 'shark', c1: '#5f738c', c2: '#eef2f6', fin: '#4d5f75', mark: 'none' } },
  squid: { name: '대왕오징어', rarity: 'epic', kg: [50, 200], art: { body: 'squid', c1: '#d0566a', c2: '#ffd9df', fin: '#b23e52', mark: 'dots' } },
  whaleshark: { name: '고래상어', rarity: 'legend', kg: [500, 2000], art: { body: 'shark', c1: '#3b5b86', c2: '#e8eef6', fin: '#2f4b70', mark: 'stars' } },
  goldcarp: { name: '황금 잉어', rarity: 'legend', kg: [30, 80], art: { body: 'round', c1: '#f2b705', c2: '#fff1b8', fin: '#e08a00', mark: 'scales', whisker: true, shine: true } },
  coelacanth: { name: '실러캔스', rarity: 'legend', kg: [40, 90], art: { body: 'long', c1: '#2f4f7a', c2: '#b9c9de', fin: '#20395c', mark: 'stars', lobed: true } },
  goldenegg: { name: '황금 알 물고기', rarity: 'golden', kg: [7.7, 7.7], art: { body: 'ball', c1: '#f5c400', c2: '#fff7cc', fin: '#e39b00', mark: 'egg', shine: true } },
  // V13.185 심해 물고기 8종(deep): 놀이터 손맛 낚시의 '깊은 바다'(낚싯대 3단계부터, reel-rules.js DEEP)에서만 나온다.
  //   그림(/assets/fish/<key>.webp · -hang · -hang-s, 그림 주문서 53)이 다 들어온 것만 나온다(fish-art.js FISH_READY).
  //   반 전체 낚시 · 바닷가 낚시(FISH_KEYS)에는 들어가지 않는다. art는 도감 실루엣(fishShadow)용이다.
  anglerfish: { name: '아귀', rarity: 'rare', deep: true, kg: [2, 15], art: { body: 'round', c1: '#5b4636', c2: '#c9b49a', fin: '#3f3026', mark: 'dots', spiky: true } },
  blobfish: { name: '블롭피시', rarity: 'rare', deep: true, kg: [1, 4], art: { body: 'ball', c1: '#e8a3b0', c2: '#fbe4e8', fin: '#c97b8a', mark: 'none' } },
  fireflysquid: { name: '반딧불오징어', rarity: 'rare', deep: true, kg: [0.02, 0.1], art: { body: 'squid', c1: '#3b5bdb', c2: '#a5d8ff', fin: '#1c3faa', mark: 'stars' } },
  oarfish: { name: '산갈치', rarity: 'epic', deep: true, kg: [50, 270], art: { body: 'needle', c1: '#c0c7d2', c2: '#f4f6f9', fin: '#e03131', mark: 'line' } },
  toothfish: { name: '이빨고기', rarity: 'epic', deep: true, kg: [10, 100], art: { body: 'long', c1: '#3d4451', c2: '#aeb6c2', fin: '#2b3039', mark: 'dots' } },
  vampiresquid: { name: '흡혈오징어', rarity: 'epic', deep: true, kg: [0.5, 6], art: { body: 'squid', c1: '#7a1f2b', c2: '#e599a4', fin: '#4a0f18', mark: 'dots' } },
  manta: { name: '대왕쥐가오리', rarity: 'legend', deep: true, kg: [500, 2000], art: { body: 'ray', c1: '#1f2a44', c2: '#e6ebf5', fin: '#141c30', mark: 'stars' } },
  frilledshark: { name: '주름상어', rarity: 'legend', deep: true, kg: [20, 60], art: { body: 'shark', c1: '#4a3f35', c2: '#b5a898', fin: '#352c24', mark: 'stars', lobed: true } }
};
// 바닷가 물고기(24종). 반 전체 낚시(rollCast) · 바닷가 손맛 낚시(reelRoll)는 이것만 굴린다. 심해 물고기는 DEEP_KEYS.
export const FISH_KEYS = Object.keys(FISH).filter(k => !FISH[k].deep);
export const DEEP_KEYS = Object.keys(FISH).filter(k => FISH[k].deep);
export const LURES = [
  { name: '지렁이', odds: { common: 70, uncommon: 24, rare: 5, epic: 0.9, legend: 0.1 }, golden: 0 },
  { name: '새우', odds: { common: 55, uncommon: 32, rare: 10, epic: 2.5, legend: 0.5 }, golden: 0 },
  { name: '반짝이 루어', odds: { common: 40, uncommon: 35, rare: 17, epic: 6, legend: 2 }, golden: 0.3 },
  { name: '황금 미끼', odds: { common: 25, uncommon: 35, rare: 24, epic: 11, legend: 5 }, golden: 0.8 }
];

// 작은 seed 난수(mulberry32). 같은 seed면 화면과 서버가 같은 수를 얻는다.
export function seeded(seed) {
  let a = (Number(seed) >>> 0) || 1;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export const speedTier = ms => ms <= FISHING.FAST_MS ? 'fast' : ms <= FISHING.OK_MS ? 'ok' : 'slow';

// i번째 던지기에서 낚는 물고기. 빠르게 맞히면 미끼가 한 단계 좋은 것처럼 굴리고 무게도 위쪽으로.
// water: 물 속성 펫이면 희귀 이상이 조금 더 잘 나온다.
export function rollCast(seed, i, lure, ms, { water = false } = {}) {
  const rnd = seeded((Number(seed) >>> 0) ^ Math.imul(i + 1, 0x9E3779B1));
  const tier = speedTier(ms);
  const L = LURES[Math.max(0, Math.min(LURES.length - 1, lure + (tier === 'fast' ? 1 : 0)))];
  const r0 = rnd() * 100;
  if (r0 < L.golden) return { key: 'goldenegg', kg: FISH.goldenegg.kg[0], rarity: 'golden' };
  const odds = RARITY_KEYS.map(k => [k, L.odds[k] * (water && k !== 'common' && k !== 'uncommon' ? 1.2 : 1)]);
  let roll = rnd() * odds.reduce((n, [, w]) => n + w, 0), rarity = 'common';
  for (const [k, w] of odds) { if ((roll -= w) <= 0) { rarity = k; break; } }
  const keys = FISH_KEYS.filter(k => FISH[k].rarity === rarity);
  const key = keys[Math.min(keys.length - 1, Math.floor(rnd() * keys.length))];
  const [lo, hi] = FISH[key].kg, curve = tier === 'fast' ? 0.55 : tier === 'ok' ? 1 : 1.8;
  const kg = Math.round((lo + (hi - lo) * Math.pow(rnd(), curve)) * 100) / 100;
  return { key, kg, rarity };
}

export const kgText = kg => kg >= 100 ? `${Math.round(kg).toLocaleString('ko-KR')}kg` : kg >= 10 ? `${kg.toFixed(1)}kg` : `${kg.toFixed(2)}kg`;
