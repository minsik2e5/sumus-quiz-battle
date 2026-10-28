import { FISH, FISH_KEYS, DEEP_KEYS, LURES, RARITY_KEYS, seeded } from './fishing-rules.js';
import { FISH_READY } from './fish-art.js';

// V13.150 손맛 낚시(놀이터): 단어 없이 던지기 · 입질 · 파이팅으로 낚는 미니게임. 미끼는 공부로 번다.
// 물고기는 던질 때 서버가 정하고(reelRoll), 파이팅을 이기면 어망에 들어간다. 어망 물고기는 진주로 팔고, 진주로 코인 · 알 · 바다 펫을 바꾼다.
// 화면은 reel.js, 서버는 server/reel.mjs.

export const REEL = {
  BAIT_DAILY: 5,          // 하루에 벌 수 있는 미끼
  BAIT_MAX: 10,           // 들고 있을 수 있는 미끼
  BAIT_MIN_PRACTICE: 10,  // 이만큼 끝까지 푼 연습이 미끼 1개
  PREVIEW: { BAIT: 99, PEARLS: 50000 }, // V13.156 교사 미리보기 계정: 들어올 때마다 이만큼 채운다(순위 · 대결에서 빠진 계정)
  PEARLS: { common: 10, uncommon: 25, rare: 60, epic: 150, legend: 400, golden: 0 },
  COIN_DAILY: 100,        // 진주 → 코인(1:1) 하루 한도
  EGG: 600, EGG_DAILY: 1,
  EPIC_EGG: 800, EPIC_DAILY: 1, // V13.160 영웅 알: 진주 2,000 · 주 1개 → 800 · 하루 1개(선생님 결정)
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
// V13.154 낚싯대 강화(1~5단계, 진주로). 손맛은 그대로 두고 조금씩 쉬워진다. 물고기 등급 확률은 바꾸지 않는다.
//   reel: 감는 속도 · tension: 감을 때 텐션 오르는 속도 · snap: 빨간 칸(98 이상)에서 줄이 버티는 시간(초) · skill: 특기 게이지 차는 속도
//   반 전체 낚시(교실 게임)에는 쓰지 않는다(모두 같은 조건). 서버는 감는 속도만큼 최소 파이팅 시간을 줄여서 본다.
export const ROD = {
  MAX: 5,
  COST: { 2: 200, 3: 500, 4: 1200, 5: 2400 },   // 그 단계로 올리는 진주(합계 4,300 · 미끼 하루 5개로 약 한 달)
  LEVELS: [
    { level: 1, name: '새싹 낚싯대', reel: 1, tension: 1, snap: .75, skill: 1, colors: ['#0f766e', '#5eead4', '#ecfeff', '#14b8a6'], reelc: ['#ecfdf5', '#34d399', '#047857'] },
    { level: 2, name: '은빛 낚싯대', reel: 1.06, tension: .96, snap: .85, skill: 1.07, colors: ['#475569', '#cbd5e1', '#f8fafc', '#94a3b8'], reelc: ['#f8fafc', '#cbd5e1', '#64748b'] },
    { level: 3, name: '황금 낚싯대', reel: 1.12, tension: .92, snap: .95, skill: 1.15, colors: ['#92400e', '#fbbf24', '#fffbeb', '#d97706'], reelc: ['#fffbeb', '#fbbf24', '#b45309'] },
    { level: 4, name: '보석 낚싯대', reel: 1.18, tension: .88, snap: 1.05, skill: 1.22, colors: ['#312e81', '#818cf8', '#e0e7ff', '#7c3aed'], reelc: ['#eef2ff', '#818cf8', '#4338ca'] },
    { level: 5, name: '전설 낚싯대', reel: 1.25, tension: .85, snap: 1.2, skill: 1.3, colors: ['#be185d', '#fde68a', '#ffffff', '#38bdf8'], reelc: ['#fff7ed', '#fbcfe8', '#a855f7'] }
  ]
};
export const rodLevel = lv => Math.max(1, Math.min(ROD.MAX, Math.floor(Number(lv) || 1)));
export const rodOf = lv => ROD.LEVELS[rodLevel(lv) - 1];
// 강화하면 좋아지는 것(지금 → 다음). 화면의 설명 줄.
export function rodPerks(lv) {
  const a = rodOf(lv), b = lv < ROD.MAX ? rodOf(lv + 1) : null;
  const up = x => x === 1 ? '기본' : `+${Math.round((x - 1) * 100)}%`, down = x => x === 1 ? '기본' : `-${Math.round((1 - x) * 100)}%`;
  return [
    { key: 'reel', label: '감는 속도', now: up(a.reel), next: b && up(b.reel) },
    { key: 'snap', label: '빨간 칸 버티기', now: `${a.snap.toFixed(2)}초`, next: b && `${b.snap.toFixed(2)}초` },
    { key: 'tension', label: '텐션 오르는 속도', now: down(a.tension), next: b && down(b.tension) },
    { key: 'skill', label: '특기 게이지', now: up(a.skill), next: b && up(b.skill) }
  ];
}
// 마무리: 물고기가 물 위로 뛰어오를 때 맞춰 탭하면 퍼펙트(무게 +8%, 기록용). 무게는 서버가 곱한다.
export const FINISH = { PERFECT_KG: 1.08, KINDS: ['perfect', 'good', 'miss'] };
export const stars = rarity => ({ common: 1, uncommon: 2, rare: 3, epic: 4, legend: 5, golden: 5 })[rarity] || 1;
export const pearlsOf = key => REEL.PEARLS[FISH[key]?.rarity] || 0;

// V13.185 깊은 바다(심해 낚시터): 낚싯대 MIN_ROD단계부터 열린다(V13.189부터 1단계 = 처음부터, 진주를 따로 쓰지 않는다). 등급 확률 · 진주 값은 바닷가와 같고,
//   희귀 · 영웅 · 전설이 나오면 그 등급의 심해 물고기 중에서 고른다(흔함 · 보통 · 황금 알 물고기는 바닷가와 같은 물고기).
//   그림이 다 들어온 심해 물고기만 나온다(FISH_READY). 한 마리도 없으면 깊은 바다는 열리지 않는다.
// V13.189 BOOST: 깊은 바다에서는 희귀 · 영웅 · 전설이 나올 확률(= 심해 물고기가 나올 확률)이 바닷가의 BOOST배. 모자란 만큼은 흔함 · 보통에서 덜어 낸다.
export const DEEP = { MIN_ROD: 1, BOOST: 2, RARITIES: ['rare', 'epic', 'legend'] };
export const deepReady = (ready = FISH_READY) => DEEP_KEYS.filter(k => ready.has(k));
export const deepOpen = (rod, ready = FISH_READY) => rodLevel(rod) >= DEEP.MIN_ROD && deepReady(ready).length > 0;

// 던질 때 정해지는 물고기: 퍼펙트면 미끼 두 단계, 좋음이면 한 단계 좋게 굴린다. 물 속성 펫은 희귀 이상이 조금 더.
// V13.185 deep: 깊은 바다에서 던졌으면 true(ready: 그림이 있는 물고기, 검사용). 난수 순서는 바닷가와 같다. V13.189: 깊은 바다는 희귀 이상 확률 BOOST배.
export function reelRoll(seed, cast = 'ok', { water = false, deep = false, ready = FISH_READY } = {}) {
  const rnd = seeded(Number(seed) >>> 0);
  const L = LURES[Math.max(0, CAST_TIERS.indexOf(cast))];
  if (rnd() * 100 < L.golden) return { key: 'goldenegg', kg: FISH.goldenegg.kg[0], rarity: 'golden' };
  let odds = RARITY_KEYS.map(k => [k, L.odds[k] * (water && !['common', 'uncommon'].includes(k) ? 1.2 : 1)]);
  if (deep && deepReady(ready).length) {
    const T = odds.reduce((n, [, w]) => n + w, 0), S = odds.reduce((n, [k, w]) => n + (DEEP.RARITIES.includes(k) ? w : 0), 0);
    const f = Math.max(0, (T - DEEP.BOOST * S) / (T - S));
    odds = odds.map(([k, w]) => [k, DEEP.RARITIES.includes(k) ? w * DEEP.BOOST : w * f]);
  }
  let roll = rnd() * odds.reduce((n, [, w]) => n + w, 0), rarity = 'common';
  for (const [k, w] of odds) { if ((roll -= w) <= 0) { rarity = k; break; } }
  const sea = deep ? deepReady(ready).filter(k => FISH[k].rarity === rarity) : [];
  const keys = sea.length ? sea : FISH_KEYS.filter(k => FISH[k].rarity === rarity);
  const key = keys[Math.min(keys.length - 1, Math.floor(rnd() * keys.length))];
  const [lo, hi] = FISH[key].kg, curve = cast === 'perfect' ? .6 : cast === 'good' ? .85 : 1.2;
  return { key, rarity, kg: Math.round((lo + (hi - lo) * Math.pow(rnd(), curve)) * 100) / 100 };
}
// 한 주(월요일 시작, 한국 시간) 번호: 영웅 알 교환 한도.
export const weekNum = ts => Math.floor((Number(ts) + 9 * 3600000 + 3 * 86400000) / (7 * 86400000));
