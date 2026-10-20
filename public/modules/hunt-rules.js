import { seeded } from './fishing-rules.js';

// V13.162 펫 사냥(놀이터): 포켓몬 고처럼 그림 지도 위의 야생 펫을 눌러 만나고, 공을 위로 밀어 던져 잡는다.
// 공은 공부로만 받는다(연습 끝 · 출석 · 짝 맞추기 별 3). 만남(어떤 펫) · 잡힘 · 도망은 서버가 정한다(server/hunt.mjs).
// 화면은 hunt.js. 밸런스 목표(선생님 결정): 하루 가치 ≈ 낚시 하루(열심 약 90코인어치 · 보통 약 30코인어치).
//   알 상점(랜덤 알 400 · 영웅 알 800)이 쓸모없어지지 않게, 새 친구는 만남의 20%만.

export const HUNT = {
  BALL_MAX: 6,                 // 들고 있을 수 있는 기본 · 좋은 공(합)
  SOURCES: ['practice', 'attend', 'match'], // 하루에 곳마다 1개(연습 끝내기 10문제 이상 · 출석 · 짝 맞추기 별 3) → 하루 최대 3개
  MIN_PRACTICE: 10,            // 낚시 미끼와 같은 조건
  GOOD_CHANCE: 35,             // 만점 연습 · 짝 맞추기 별 3에서 받는 공이 좋은 공일 확률(%)
  GOOD_DAILY: 1,               // 좋은 공은 하루 1개까지(받는 공 3개 안에서 바뀌는 것: 하루 공 수는 그대로)
  GOLD_CARDS: 4,               // 출석 도장판(7칸) 4장을 채우면 황금 공 1개(한 달에 1개)
  GOLD_MAX: 2,
  FRESH: 20,                   // 만남을 끝낼(잡거나 도망) 때마다 다음 자리에 '새 친구'가 나올 확률(%)
  FRESH_EPIC: 15,              // 새 친구 중 영웅(나머지는 기본). 전설 · 신화 · 한정 · 바다 펫은 안 나온다
  CATCH: { basic: 25, epic: 10 }, // 기본 공 하나로 잡힐 확률(%)
  FLEE: { basic: 25, epic: 30 },  // 빠져나온 뒤 도망칠 확률(%)
  BALLS: { basic: 1, good: 1.5, gold: 0 }, // 잡힘 배수(황금 공은 무조건 잡힘)
  THROWS: { nice: 1.1, great: 1.25, excellent: 1.6 }, // 원이 작을 때 던지면
  BERRY_CATCH: 1.5,            // 🍓 잡기 ×1.5
  BERRY_REWARD: 2,             // 🍍 잡으면 보상 ×2(가진 펫: 코인 · 경험치)
  DUP_COINS: 10, DUP_XP: 5,    // 이미 가진 펫을 잡으면
  SPOTS: [3, 5],               // 지도 위 펫 수
  SLOT_HOURS: 4,               // 이 시간마다 지도의 펫이 바뀐다(만나는 중인 펫 · 새 친구 자리는 그대로)
  PREVIEW: { BALLS: 6, GOOD: 3, GOLD: 1 } // 교사 미리보기 계정: 들어올 때마다 채운다
};
export const BALL_KINDS = ['basic', 'good', 'gold'];
export const BERRIES = {
  razz: { emoji: '🍓', name: '딸기', note: '잡기 ×1.5' },
  pinap: { emoji: '🍍', name: '파인애플', note: '잡으면 보상 ×2' },
  nanab: { emoji: '🍌', name: '바나나', note: '원 · 펫이 천천히' }
};
export const THROW_NAMES = { nice: '나이스', great: '그레이트', excellent: '엑설런트' };
export const BALL_NAMES = { basic: '기본 공', good: '좋은 공', gold: '황금 공' };
export const TIER_NAMES = { basic: '기본', epic: '영웅' };

// 한 번 던졌을 때 잡힐 확률(0~1). 황금 공은 1.
export function catchChance(tier, { ball = 'basic', quality = null, berry = null } = {}) {
  if (ball === 'gold') return 1;
  const base = (HUNT.CATCH[tier] ?? HUNT.CATCH.basic) / 100;
  return Math.min(1, base * (HUNT.BALLS[ball] || 1) * (HUNT.THROWS[quality] || 1) * (berry === 'razz' ? HUNT.BERRY_CATCH : 1));
}
// 던지기 결과. r1 · r2는 0~1 난수(서버가 만든다). shakes: 흔들림 수(잡히면 3, 빠져나오면 1~3).
export function rollThrow(tier, opts, r1, r2) {
  const p = catchChance(tier, opts);
  if (r1 < p) return { caught: true, fled: false, shakes: 3 };
  // 빠져나온 정도: 잡힐 확률에 가까울수록 많이 흔들린다.
  const close = p > 0 ? Math.min(1, p / Math.max(r1, 1e-9)) : 0;
  const shakes = close > .7 ? 3 : close > .35 ? 2 : 1;
  return { caught: false, fled: r2 < (HUNT.FLEE[tier] ?? HUNT.FLEE.basic) / 100, shakes };
}
// 새 친구 등급(기본 85% · 영웅 15%). 한쪽을 다 모았으면 다른 쪽. 둘 다 다 모았으면 null.
export function freshTier(r, left) {
  let tier = r * 100 < HUNT.FRESH_EPIC ? 'epic' : 'basic';
  if (!left[tier]) tier = tier === 'basic' ? 'epic' : 'basic';
  return left[tier] ? tier : null;
}
// 지도 슬롯(몇 시간마다 바뀜). KST 기준.
export const huntSlot = now => Math.floor((Number(now) + 9 * 3600000) / (HUNT.SLOT_HOURS * 3600000));

// 밸런스 시뮬레이션(검사가 부른다: server/hunt-check.mjs). 한 학생이 days일 동안 받은 공을 다 쓴다고 보고 새 친구 수를 센다.
//   daily: 하루 공 수(열심 3 · 보통 1), goodRolls: 좋은 공 기회(열심: 만점 연습 · 별 3 → 2번), 출석은 매일(28일에 황금 공 1개).
//   던지기 품질: 원 밖 40% · 나이스 30% · 그레이트 20% · 엑설런트 10%. 열매는 던지기의 30%(berries)에 쓴다(새 친구에게 🍓, 가진 펫에게 🍍).
//   공은 새 친구에게 황금 · 좋은 공부터, 가진 펫에게 기본 공부터.
//   공이 떨어지면 만나는 중인 펫은 다음 날 이어서 잡는다(도망 화면을 나가도 지도에 남는 것과 같다).
export function huntSim({ days = 30, daily = 3, goodRolls = 0, berries = .3, start = { basic: 3, epic: 0 }, total = { basic: 21, epic: 21 }, seed = 1 } = {}) {
  const rand = seeded(seed);
  const have = { ...start }, out = { basic: 0, epic: 0, coins: 0, xp: 0, meets: 0, throws: 0, gold: 0 };
  let basic = 0, good = 0, gold = 0, fresh = null, live = null;
  const qualities = () => { const r = rand(); return r < .4 ? null : r < .7 ? 'nice' : r < .9 ? 'great' : 'excellent'; };
  for (let day = 1; day <= days; day++) {
    let goodToday = 0;
    for (let i = 0; i < daily; i++) {
      if (basic + good >= HUNT.BALL_MAX) break;
      if (i < goodRolls && goodToday < HUNT.GOOD_DAILY && rand() * 100 < HUNT.GOOD_CHANCE) { good++; goodToday++; } else basic++;
    }
    if (day % (7 * HUNT.GOLD_CARDS) === 0 && gold < HUNT.GOLD_MAX) gold++;
    while (basic + good + gold > 0) {
      if (!live) { live = fresh ? { tier: fresh, fresh: true } : { tier: 'basic', fresh: false }; fresh = null; out.meets++; }
      const ball = live.fresh ? (gold ? 'gold' : good ? 'good' : 'basic') : (basic ? 'basic' : good ? 'good' : 'gold');
      if (ball === 'gold') { gold--; out.gold++; } else if (ball === 'good') good--; else basic--;
      out.throws++;
      const berry = rand() < berries ? (live.fresh ? 'razz' : 'pinap') : null;
      const res = rollThrow(live.tier, { ball, quality: qualities(), berry }, rand(), rand());
      if (!res.caught && !res.fled) continue;
      if (res.caught && live.fresh) { have[live.tier]++; out[live.tier]++; }
      else if (res.caught) { const k = berry === 'pinap' ? HUNT.BERRY_REWARD : 1; out.coins += HUNT.DUP_COINS * k; out.xp += HUNT.DUP_XP * k; }
      live = null;
      if (rand() * 100 < HUNT.FRESH) fresh = freshTier(rand(), { basic: total.basic - have.basic, epic: total.epic - have.epic });
    }
  }
  return out;
}
export function huntSimAverage(opts, runs = 4000) {
  const sum = { basic: 0, epic: 0, coins: 0, meets: 0, throws: 0, gold: 0 };
  for (let s = 1; s <= runs; s++) { const r = huntSim({ ...opts, seed: s * 7919 }); for (const k of Object.keys(sum)) sum[k] += r[k]; }
  return Object.fromEntries(Object.entries(sum).map(([k, v]) => [k, Math.round(v / runs * 100) / 100]));
}
