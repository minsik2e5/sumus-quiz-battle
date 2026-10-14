// V13.149 단어 낚시(Blooket 낚시 대소동 방식). 줄을 던지면 입질 → 뜻 4지선다 → 맞히면 낚고 틀리면 놓친다.
// 빨리 맞힐수록 큰 물고기, 3연속 정답이면 미끼가 한 단계 좋아지고 틀리면 한 단계 내려간다.
// 어떤 물고기가 나오는지는 판마다 서버가 준 seed로 정해진다(rollCast): 화면과 서버가 같은 답으로 같은 물고기를 얻는다.
// 그래서 서버는 '맞힘 · 걸린 시간' 목록만 받아 다시 굴려 보고 보상한다(server/games.mjs fishFinish).

export const FISHING = {
  CASTS: 12,              // 혼자 낚시 한 판
  ANSWER_MS: 10000,       // 입질 뒤 답할 시간
  FAST_MS: 3000,          // 이 안에 맞히면 '빠름'(큰 물고기)
  OK_MS: 6000,            // 이 안이면 '보통'
  LURE_UP: 3,             // 연속 정답 수
  MIN_CAST_MS: 1600,      // 던지기 + 입질 기다림(서버가 시간 확인에 쓴다)
  DAILY: 4,               // 하루에 코인을 받는 판
  XP_PER_RIGHT: 1,
  GOLDEN_EGG: 3           // 황금 알 물고기 3마리 → 랜덤 알 하나
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
  goldenegg: { name: '황금 알 물고기', rarity: 'golden', kg: [7.7, 7.7], art: { body: 'ball', c1: '#f5c400', c2: '#fff7cc', fin: '#e39b00', mark: 'egg', shine: true } }
};
export const FISH_KEYS = Object.keys(FISH);
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

// 한 판 다시 보기: answers [{ ok, ms }] → 던질 때마다 미끼 · 낚은 것.
export function replayFishing(seed, answers, opts = {}) {
  let lure = 0, run = 0;
  const casts = [];
  for (let i = 0; i < Math.min(answers.length, FISHING.CASTS); i++) {
    const a = answers[i] || {}, ms = Math.max(0, Math.min(FISHING.ANSWER_MS, Number(a.ms) || FISHING.ANSWER_MS));
    const ok = a.ok === true && ms < FISHING.ANSWER_MS;
    const used = lure;
    if (ok) {
      casts.push({ ok: true, lure: used, ms, ...rollCast(seed, i, used, ms, opts) });
      run++;
      if (run >= FISHING.LURE_UP) { run = 0; lure = Math.min(LURES.length - 1, lure + 1); }
    } else {
      casts.push({ ok: false, lure: used, ms });
      run = 0; lure = Math.max(0, lure - 1);
    }
  }
  const caught = casts.filter(c => c.ok);
  return { casts, lure, right: caught.length, kg: Math.round(caught.reduce((n, c) => n + c.kg, 0) * 100) / 100 };
}
// 낚시 코인: 기본 2 + 맞힌 수 절반(최대 8) + 영웅 1마리마다 2 · 전설 5 · 황금 알 3.
export function fishingCoins(casts) {
  const right = casts.filter(c => c.ok).length;
  const extra = casts.reduce((n, c) => n + (c.rarity === 'epic' ? 2 : c.rarity === 'legend' ? 5 : c.rarity === 'golden' ? 3 : 0), 0);
  return right ? 2 + Math.min(8, Math.floor(right / 2)) + extra : 0;
}
export const kgText = kg => kg >= 100 ? `${Math.round(kg).toLocaleString('ko-KR')}kg` : kg >= 10 ? `${kg.toFixed(1)}kg` : `${kg.toFixed(2)}kg`;
