import { CHARACTERS } from './core.js';
import { elementOf } from './battle-fx.js';
import { PET_SKILLS } from './battle-engine.js';

// V13.225 펫 아레나 2(놀이터): 내가 직접 조종하는 3:3 펫 대전. V13.226: 펫마다 역할(특징) · 스킬 2개, 근접 펫 보강. 한 번에 한 마리씩 나와 1:1로 싸우고, 쓰러지면 다음 펫.
//   조이스틱으로 움직이고 · 공격 · 스킬 1 · 스킬 2(펫마다 다르다) · 필살기(게이지) · 회피(잠깐 무적) · 교체(쿨타임) 버튼을 누른다.
//   상대는 친구가 남긴 팀(없으면 연습 상대)을 컴퓨터가 조종한다. 단어 문제는 없다(코인 판 입장권은 단어 연습으로 받는다).
// 전투는 씨앗(seed)과 '몇 번째 틱에 무엇을 눌렀나'만으로 정해진다: 화면(arena.js)이 그 자리에서 돌리고, 끝나면
// 서버(server/arena.mjs)가 같은 함수로 다시 돌려 승패 · 보상을 정한다. 그래서 이 파일에는 화면도 무작위 함수도 없고,
// 브라우저마다 결과가 다를 수 있는 삼각함수(sin · cos · atan2)도 쓰지 않는다(+ − × ÷ · sqrt · floor · round만).
export const ARENA = {
  TEAM: 3,
  TICK_MS: 50,               // 전투 한 틱
  MAX_TICKS: 2400,           // 2분이 지나면 남은 체력 비율로 승패
  COUNTDOWN_MS: 3000,
  BODY: 4.5,                 // 펫 몸 반지름(경기장 %)
  SPEED: 1.15,               // 걷는 빠르기(틱마다 %, × 펫 빠르기)
  ATK_TICKS: 10,             // 기본 공격 간격 0.5초(× 1 / 펫 빠르기)
  SKILL_TICKS: 120,          // 스킬 1: 6초
  SKILL2_TICKS: 170,         // 스킬 2: 8.5초
  MELEE_LUNGE: 5,           // 근접 공격: 닿지 않으면 이만큼 달려들며 친다
  DODGE_TICKS: 7,            // 회피 구르기 0.35초(그동안 무적)
  DODGE_CD: 40,              // 회피 2초
  DODGE_SPEED: 3.2,
  SWAP_CD: 200,              // 교체 10초
  ENTER_TICKS: 24,           // 쓰러지거나 교체하고 다음 펫이 나오기까지(그동안 맞지 않는다)
  GAUGE_MAX: 100,
  GAUGE_DEAL: 7,             // 때린 피해(공격력 1번만큼)마다 +7
  GAUGE_TAKE: 4,             // 맞은 피해(상대 공격력 1번만큼)마다 +4
  ULT_FREEZE_TICKS: 24,      // 필살기 컷인 동안 경기장이 멈춘다(1.2초)
  ULT_POWER: 5,
  STUN_TICKS: 12,
  SLOW_TICKS: 50,
  FIELD: { minX: 8, maxX: 92, minY: 14, maxY: 86 }, // 경기장 바닥(%)
  INPUT_MAX: 4000,           // 한 판 조작 기록 상한
  // V13.228 조준: 움직이는 방향 = 바라보는 방향. 톡 누르면 바라보는 쪽 ±25°(쉬운 조준 ±40°) 안의 상대에게 맞춘다(cos 값, 삼각함수 없이).
  AIM_ASSIST: 0.9063,        // cos 25°
  AIM_EASY: 0.766,           // cos 40°
  AIM_DRAG: 0.978,           // 끌어서 조준: 16방향 한 칸의 반(≈12°) 안이면 상대에게 맞춘다(방향 칸 오차만 메운다)
  MELEE_ARC: 0.342,          // 근접 공격은 앞쪽 ±70° 안만 맞는다
  ULT_ARC: 0.8192,           // 필살기 부채꼴 ±35°
  QUAKE_RANGE: 40,           // 지진 · 소나기를 바라보는 쪽으로 놓을 때 가장 먼 거리
  // V13.228 넉백(맞으면 뒤로 밀림, 3틱에 나눠서): 종류마다 거리(경기장 %).
  KNOCK: { atk: 1.2, skill: 4, skill2: 3, ult: 7 },
  KNOCK_TICKS: 3,
  // V13.228 크리티컬: 상대 뒤에서(상대가 바라보는 쪽의 반대 ±45°) 또는 기절한 상대를 때리면 1.5배. 무작위가 아니라 규칙으로 정한다.
  CRIT: 1.5,
  BACK: -0.7071,             // cos 135°
  FACE_LOCK: 6,              // 공격 · 스킬을 쓰고 0.3초 동안은 쏜 쪽을 바라본다(그동안 움직여도 몸을 돌리지 않는다)
  DAILY: 5,                  // 하루에 코인을 받는 판
  TICKETS_MAX: 5,            // 코인 판 입장권 보관 상한
  TICKET_PRACTICE: 10,       // 이만큼 이상 푼 연습을 끝까지 하면 입장권 1장
  COINS: { win: 12, lose: 4 },
  STREAK_COINS: 3,           // 3연승마다 +3
  XP: 6,
  STALE_MS: 10 * 60000,
  SLACK_MS: 3000
};

// 조작 기록 [틱, 코드]: 0 멈춤 · 1~8 방향(위부터 시계 방향) · 10 공격 · 11 스킬 1 · 12 필살기 · 13 회피 · 14 교체 · 15 스킬 2.
// V13.228 [틱, 코드, 조준]: 공격 · 스킬 · 필살기에 조준 방향(0~15, 위부터 시계 방향 16방향)을 붙일 수 있다(버튼을 끌어서 조준).
//   조준이 없으면 바라보는 방향(+ 보정). 16 쉬운 조준(보정 ±40°) · 17 자동 조준(늘 상대 쪽, 예전 방식) · 18 직접 조준(±25°, 처음 값).
export const INPUT = { STOP: 0, ATK: 10, SKILL: 11, ULT: 12, DODGE: 13, SWAP: 14, SKILL2: 15, AIM_EASY: 16, AIM_AUTO: 17, AIM_FREE: 18 };
export const AIMABLE = [10, 11, 12, 15];
// 16방향 단위 벡터(0 = 위, 시계 방향 22.5°마다). sin 값을 미리 적은 표라 브라우저마다 같다.
const S16 = [0, 0.3827, 0.7071, 0.9239, 1, 0.9239, 0.7071, 0.3827, 0, -0.3827, -0.7071, -0.9239, -1, -0.9239, -0.7071, -0.3827];
export const DIR16 = S16.map((x, i) => [x, -S16[(i + 4) % 16]]);
// (dx, dy) → 가장 가까운 16방향(내적이 가장 큰 칸). 길이가 0이면 -1.
export function aimCode(dx, dy) {
  if (!dx && !dy) return -1;
  let best = 0, bv = -Infinity;
  for (let i = 0; i < 16; i++) { const v = DIR16[i][0] * dx + DIR16[i][1] * dy; if (v > bv) { bv = v; best = i; } }
  return best;
}
const D = 0.7071;
export const DIRS = [[0, 0], [0, -1], [D, -D], [1, 0], [D, D], [0, 1], [-D, D], [-1, 0], [-D, -D]];
// 조이스틱 (dx, dy) → 방향 코드(삼각함수 없이: tan 22.5° ≈ 0.4142).
export function dirCode(dx, dy, dead = 0.25) {
  const ax = Math.abs(dx), ay = Math.abs(dy);
  if (Math.sqrt(dx * dx + dy * dy) < dead) return 0;
  if (ax <= ay * 0.4142) return dy < 0 ? 1 : 5;
  if (ay <= ax * 0.4142) return dx > 0 ? 3 : 7;
  return dx > 0 ? (dy < 0 ? 2 : 4) : (dy < 0 ? 8 : 6);
}

// 속성 상성: 이기는 속성에 1.3배, 지는 속성에 0.8배. 별빛은 모두와 보통.
export const BEATS = {
  flame: ['leaf', 'ice'], water: ['flame', 'earth'], leaf: ['water', 'earth'], earth: ['flame', 'toxic'],
  wind: ['toxic', 'leaf'], ice: ['wind', 'water'], toxic: ['wind', 'ice'], star: []
};
export const matchup = (a, b) => BEATS[a]?.includes(b) ? 1.3 : BEATS[b]?.includes(a) ? 0.8 : 1;
// 속성마다 공격 모양. 빔: 빠르고 굵은 광선 · 구슬: 느린 구슬 세 갈래 · 지진: 상대 발밑에 표시 뒤 터진다 · 돌진: 몸통 박치기.
export const SHAPE = { flame: 'beam', ice: 'beam', star: 'beam', water: 'orb', toxic: 'orb', earth: 'quake', leaf: 'dash', wind: 'dash' };
// 기본 공격: 원거리(구슬 하나) · 근접(돌진 · 지진 펫은 앞을 할퀸다).
export const SHOT = { beam: { v: 3.6, r: 2.6, life: 14 }, orb: { v: 2.4, r: 3, life: 20 }, quake: { melee: 13 }, dash: { melee: 13 } };
// 속성마다 필살기 이름(펫 스킬과 별개).
export const ULT_NAME = { flame: '화염 폭풍', water: '대해일', leaf: '숲의 분노', earth: '대지 붕괴', wind: '태풍 돌격', ice: '절대 영도', toxic: '맹독 안개', star: '별똥별 낙하' };
// 속성마다 스킬에 붙는 덤: 얼음 느려짐 · 바위 기절 · 바람 밀쳐내기 · 독 중독.
const EXTRA = { ice: 'slow', earth: 'stun', wind: 'knock', toxic: 'poison' };
const EXTRA_KO = { slow: '느려짐', stun: '기절', knock: '밀쳐내기', poison: '중독' };

// 펫별 스킬: 이름은 펫 스킬표(PET_SKILLS)와 같고, 아레나에서 하는 일은 그 스킬 종류에서 정한다.
//   burst(바로 피해) → 속성 모양 큰 공격 · boost(다음 공격 +) → 6초 강화(공격 빠르고 세게) · poison → 중독 구슬
//   guard(받는 피해 −) · heal → 보호막 · 회복. 스킬표에 없는 펫은 속성 모양 공격 스킬.
export function petSkill(key) {
  const s = PET_SKILLS[key] || {}, el = elementOf(key), shape = SHAPE[el] || 'beam';
  const sum = list => (list || []).reduce((n, x) => n + Number(x || 0), 0);
  const out = { name: s.name || `${ULT_NAME[el] ? ULT_NAME[el].slice(0, 2) : '별빛'} 일격`, desc: '', kind: 'burst', power: 2.3, extra: EXTRA[el] || null, heal: 0, shield: 0, boost: 0, dot: 0 };
  if (s.heal || s.guard) {
    out.kind = 'guard';
    out.heal = s.heal ? Math.min(0.24, Number(s.heal) * 0.016) : 0;          // 13 → 체력 21%
    out.shield = s.guard ? Math.min(2.4, sum(s.guard) * 0.1) : 0;           // 16 → 공격력 × 1.6 × 2.5 막기
    out.desc = [out.heal ? `체력 ${Math.round(out.heal * 100)}% 회복` : '', out.shield ? '보호막' : ''].filter(Boolean).join(' · ');
  } else if (s.boost) {
    out.kind = 'boost';
    out.boost = Math.min(0.8, sum(s.boost) * 0.03);                        // 16 → 공격 +48%
    out.desc = `6초 동안 공격 +${Math.round(out.boost * 100)}% · 빠르게`;
  } else if (s.poison) {
    out.kind = 'poison';
    out.dot = Number(s.poison) * Number(s.turns || 3) * 0.1;                // 5 × 3 → 공격력 × 1.5를 4초에 나눠
    out.power = 1.3;
    out.desc = `${{ beam: '빔', orb: '구슬 세 갈래', quake: '발밑 폭발', dash: '돌진' }[shape]} · 맞으면 4초 동안 중독`;
  } else {
    out.power = 1.7 + Math.min(1.2, Number(s.burst || 10) * 0.05);         // 13 → 공격력 × 2.35
    out.desc = `${{ beam: '굵은 빔', orb: '구슬 세 갈래', quake: '발밑 폭발', dash: '돌진' }[shape]} · 공격력 ×${out.power.toFixed(1)}`;
    if (out.extra) out.desc += ` · ${EXTRA_KO[out.extra]}`;
  }
  return out;
}

// V13.226 펫마다 역할(특징): 같은 속성이어도 몸집 · 빠르기 · 공격이 다르다. 펫 이름에서 고정으로 정한다(같은 펫은 늘 같다).
export const ROLE = {
  tank: { name: '튼튼', desc: '체력 +24% · 조금 느림', hp: 1.24, atk: 0.92, spd: 0.9 },
  swift: { name: '날쌘', desc: '빠르기 +20% · 회피 자주', hp: 0.95, atk: 1, spd: 1.2, dodge: 0.7 },
  power: { name: '한방', desc: '공격 +17% · 공격 간격 조금 김', hp: 1, atk: 1.17, spd: 1, atkTicks: 1.15 },
  rapid: { name: '연타', desc: '공격 간격 −22%', hp: 0.95, atk: 0.9, spd: 1.05, atkTicks: 0.78 },
  smart: { name: '꾀돌이', desc: '스킬 쿨타임 −20%', hp: 0.95, atk: 1, spd: 1, skill: 0.8 }
};
const ROLE_KEYS = Object.keys(ROLE);
export const petRole = key => ROLE_KEYS[(keyHash(key) >> 2) % ROLE_KEYS.length];

// V13.226 스킬 2(펫마다 하나): 속성 말 + 종류. 근접 펫과 원거리 펫이 고를 수 있는 종류가 다르다.
//   blink 순간이동(상대 반대쪽으로 비켜서 다음 공격 2배) · nova 내 주변 폭발(밀쳐내기) · barrage 연발(다섯 갈래)
//   trap 함정(밟으면 기절) · rain 쏟아지기(상대 둘레 세 군데) · rush 긴 돌격(무적) · pull 끌어당기기(느려짐) · heal 치유(상태 이상도 지움)
export const SKILL2 = {
  blink: { word: '순간이동', desc: '휙 비켜서고 다음 공격 2배' },
  nova: { word: '폭발', desc: '내 주변 폭발 · 밀쳐내기' },
  barrage: { word: '연발', desc: '다섯 갈래로 발사' },
  trap: { word: '함정', desc: '밟으면 터지고 기절' },
  rain: { word: '소나기', desc: '상대 둘레 세 군데에 떨어진다' },
  rush: { word: '돌격', desc: '길게 달려들며 무적' },
  pull: { word: '갈고리', desc: '맞으면 끌려오고 느려짐' },
  heal: { word: '치유', desc: '체력 15% 회복 · 상태 이상 지움' }
};
const EL_WORD = { flame: '불꽃', water: '물보라', leaf: '꽃잎', earth: '바위', wind: '회오리', ice: '얼음', toxic: '독안개', star: '별빛' };
const MELEE_S2 = ['rush', 'nova', 'pull', 'blink', 'heal'], RANGED_S2 = ['barrage', 'rain', 'trap', 'blink', 'nova', 'heal'];
export function petSkill2(key) {
  const el = elementOf(key), melee = !!SHOT[SHAPE[el] || 'beam'].melee, pool = melee ? MELEE_S2 : RANGED_S2;
  const first = petSkill(key).kind;
  let kind = pool[keyHash(key) % pool.length];
  if (kind === 'heal' && first === 'guard') kind = pool[(keyHash(key) + 1) % pool.length]; // 지키기 펫은 치유를 또 받지 않는다
  return { kind, name: `${EL_WORD[el] || '별빛'} ${SKILL2[kind].word}`, desc: SKILL2[kind].desc };
}

// 등급: 일반 0 · 영웅 1 · 전설 · 한정 · 시리즈 2 · 신화 3.
export function petRank(key) {
  const c = CHARACTERS[key] || {};
  return c.mythic ? 3 : c.legendary || c.limited || c.series || c.rank === 'legendary' ? 2 : c.epic || c.rank === 'epic' ? 1 : 0;
}
// V13.228 등급 배수(펫 등급 세기 규칙: 기본 ≈ 영웅 < 전설(+약 6%) < 신화(+약 6%), 한정 ≈ 기본). 승률은 server/arena-sim.mjs tiers로 본다.
export function petTier(key) {
  const c = CHARACTERS[key] || {};
  return c.mythic ? 'mythic' : c.limited ? 'limited' : c.legendary || c.series || c.rank === 'legendary' ? 'legend' : c.epic || c.rank === 'epic' ? 'epic' : 'normal';
}
// 시작 값(일반 1 · 영웅 1 · 전설 · 시리즈 1.06 · 한정 1 · 신화 1.12)에서 승률을 보고 고친 값: 펫 무리마다 속성 · 근접/원거리 섞임이 달라서
//   같은 배수여도 승률이 다르다(예: 한정 펫은 원거리가 많아 1.00이면 약 45%). 4000판씩: 영웅 49.7 · 전설 54.3 · 신화 대 전설 54.8 · 한정 49.4%. 목표: 일반 대 영웅 50 ± 3 · 전설 대 일반 ≈ 55 · 신화 대 전설 ≈ 55 · 한정 대 일반 50 ± 3.
export const TIER_MUL = { normal: 1, epic: 1.005, legend: 1.035, limited: 1.02, mythic: 1.105 };
const FORM_HP = [0, 300, 420, 560], FORM_ATK = [0, 12, 16, 20];
// 펫 이름에서 고정으로 정한 작은 차이(같은 펫은 늘 같다): 빠르기 0.9~1.1.
const keyHash = key => [...String(key)].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) % 9973, 7);
// 근접 · 원거리 보정(서로 이길 수 있게 맞춘 값, 검사가 본다).
export const REACH_MUL = { melee: { hp: 1.07, atk: 1.08, spd: 1.05 }, ranged: { hp: 1, atk: 0.96, spd: 1 } };
// 싸우는 펫 하나: { key, form(1~3), level } → 능력치. 알(form 0)은 싸우지 않는다.
export function fighter(pet) {
  const key = String(pet?.key || 'dog'), form = Math.max(1, Math.min(3, Math.round(Number(pet?.form) || 1)));
  const level = Math.max(1, Math.min(60, Math.round(Number(pet?.level) || 1))), rank = petRank(key), el = elementOf(key);
  const tier = petTier(key), mul = TIER_MUL[tier] * (1 + Math.min(30, level) * 0.01);
  const role = petRole(key), R = ROLE[role], shape = SHAPE[el] || 'beam', melee = !!SHOT[shape].melee;
  const spd = (0.9 + (keyHash(key) % 21) / 100) * R.spd;
  // 근접 펫은 다가가야 하니 더 튼튼하고 세고 조금 빠르다(원거리와 승률을 맞춘 값, 검사가 본다).
  const M = melee ? REACH_MUL.melee : REACH_MUL.ranged;
  return {
    key, form, level, rank, tier, el, shape, role, melee,
    hp: Math.round(FORM_HP[form] * mul * R.hp * M.hp), atk: Math.round(FORM_ATK[form] * mul * R.atk * M.atk),
    spd, atkTicks: Math.round(ARENA.ATK_TICKS / spd * (R.atkTicks || 1)), move: ARENA.SPEED * spd * M.spd,
    dodgeCd: Math.round(ARENA.DODGE_CD * (R.dodge || 1)), skillCd: Math.round(ARENA.SKILL_TICKS * (R.skill || 1)), skill2Cd: Math.round(ARENA.SKILL2_TICKS * (R.skill || 1)),
    skill: petSkill(key), skill2: petSkill2(key), ult: ULT_NAME[el] || '필살기'
  };
}
export const teamPower = team => (team || []).reduce((n, f) => n + f.hp / 10 + f.atk * 3, 0);

// 같은 씨앗이면 어디서나 같은 수(mulberry32).
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 조작 기록 정리: [[틱, 코드], …] → 틱이 0 이상 · 한도 안 · 앞뒤 순서대로 · 알려진 코드만. 어긋나면 거기서 멈춘다.
export function cleanInputs(raw, maxTick = ARENA.MAX_TICKS + 400) {
  const out = [];
  let last = 0;
  for (const x of Array.isArray(raw) ? raw.slice(0, ARENA.INPUT_MAX) : []) {
    const t = Math.round(Number(x?.[0])), c = Math.round(Number(x?.[1]));
    if (!Number.isFinite(t) || t < last || t > maxTick) break;
    if (!((c >= 0 && c <= 8) || (c >= 10 && c <= 18))) break;
    if (x.length > 2 && x[2] != null) {
      const a = Math.round(Number(x[2]));
      if (!AIMABLE.includes(c) || !(a >= 0 && a <= 15)) break;
      out.push([t, c, a]);
    } else out.push([t, c]);
    last = t;
  }
  return out;
}

// 컴퓨터 상대의 솜씨(쉬움 · 보통 · 어려움): 날아오는 공격을 피할 확률 · 공격 간격 배수 · 스킬 쓰는 정도 · 공격 누르는 정도 ·
//   V13.228 조준 정확도(acc: 정확히 상대 쪽으로 끌 확률, 아니면 16방향 한두 칸 빗나감). 컴퓨터도 사람과 같은 조준 규칙을 따른다.
export const AI = [
  { dodge: 0.1, slow: 1.56, skill: 0.05, aim: 0.6, acc: 0.4 },
  { dodge: 0.25, slow: 1.36, skill: 0.08, aim: 0.85, acc: 0.5 },
  { dodge: 0.36, slow: 1.27, skill: 0.1, aim: 0.9, acc: 0.57 }
];
const wantNone = () => ({ atk: false, skill: false, skill2: false, ult: false, dodge: false, swap: false, atkA: -1, skillA: -1, skill2A: -1, ultA: -1 });

// 전투. me · foe: fighter() 3개씩. 내 조작은 push([틱, 코드])로(틱 순서대로) 넣고 한 틱씩 step()으로 돌린다.
// 화면은 step()이 돌려주는 사건(ev)으로 그리고, 서버는 끝까지 돌려 결과만 본다.
//   meAi: 검사 · 미리 보기용으로 내 쪽도 컴퓨터가 조종(0~2). 실제 판에서는 쓰지 않는다.
//   foeIdle: 검사용으로 상대가 가만히 서 있다(조준 · 넉백 · 크리티컬 규칙 확인).
export function createArena({ seed, me, foe, foeLevel = 1, meAi = null, foeIdle = false }) {
  const random = rng(seed), brain = { foe: foeIdle ? null : AI[Math.max(0, Math.min(2, foeLevel))], me: meAi == null ? null : AI[Math.max(0, Math.min(2, meAi))] };
  const side = (team, who) => ({
    who, team: team.map(f => ({ ...f, cur: f.hp })), idx: 0, gauge: 0,
    x: 50, y: who === 'me' ? 72 : 28, fx: 0, fy: who === 'me' ? -1 : 1, dir: 0,
    cd: 14, skill: 50, skill2: 80, power2: 0, dodgeCd: 0, swapCd: 60, enter: 0, stun: 0, slow: 0, boost: 0, shield: 0, poison: 0, poisonDmg: 0,
    dash: 0, dvx: 0, dvy: 0, dashHit: false, dashPow: 0, dashKind: '', dashExtra: null, inv: 0, kb: 0, kbx: 0, kby: 0, lock: 0, aimMode: 0, combo: 0, comboAt: -99,
    want: wantNone(), strafe: random() < 0.5 ? 1 : -1, think: 0
  });
  const S = { t: 0, freeze: 0, over: false, winner: null, me: side(me, 'me'), foe: side(foe, 'foe'), shots: [], quakes: [], mines: [], inputs: [], ip: 0, ults: { me: 0, foe: 0 }, pendingUlt: null, ultAim: null, dealt: { me: 0, foe: 0 }, ko: { me: 0, foe: 0 } };
  const active = s => s.team[s.idx];
  const other = s => s === S.me ? S.foe : S.me;
  const alive = s => s.team.some(f => f.cur > 0);
  const clampX = x => Math.max(ARENA.FIELD.minX, Math.min(ARENA.FIELD.maxX, x));
  const clampY = y => Math.max(ARENA.FIELD.minY, Math.min(ARENA.FIELD.maxY, y));
  const gap = (a, b) => { const dx = b.x - a.x, dy = b.y - a.y; return Math.sqrt(dx * dx + dy * dy); };
  const hittable = s => s.enter <= 0 && s.inv <= 0 && active(s)?.cur > 0;
  // 상대 쪽 단위 벡터(겹쳐 있으면 바라보는 쪽).
  const aimAt = (s, o) => { const dx = o.x - s.x, dy = o.y - s.y, d = Math.sqrt(dx * dx + dy * dy); return d > 0.01 ? [dx / d, dy / d, d] : [s.fx, s.fy, 0]; };
  const face = (s, nx, ny) => { s.fx = nx; s.fy = ny; s.lock = ARENA.FACE_LOCK; };
  // V13.228 조준: 이번 공격 방향 [x, y, 상대에게 맞췄나]. 자동 조준이면 늘 상대 쪽. 끌어서 조준(code 0~15)이면 그 방향(한 칸 반 안이면 상대 쪽).
  //   톡 누르면 바라보는 방향, 그 ±25°(쉬운 조준 ±40°) 안에 상대가 있으면 상대 쪽으로 맞춘다.
  function aimVec(s, code = -1) {
    const o = other(s), [tx, ty, d] = aimAt(s, o), seen = active(o)?.cur > 0 && o.enter <= 0 && d > 0.01;
    if (s.aimMode === 2) return [tx, ty, seen];
    const [ax, ay] = code >= 0 ? DIR16[code] : [s.fx, s.fy];
    const cone = code >= 0 ? ARENA.AIM_DRAG : s.aimMode === 1 ? ARENA.AIM_EASY : ARENA.AIM_ASSIST;
    if (seen && ax * tx + ay * ty >= cone) return [tx, ty, true];
    const l = Math.sqrt(ax * ax + ay * ay) || 1;
    return [ax / l, ay / l, false];
  }

  // 피해 주기: 상성 · 작은 흔들림 · 보호막 · 게이지 · 덤 효과.
  function damage(from, to, power, kind, ev, extra = null) {
    const a = active(from), d = active(to);
    if (!a || !d || !hittable(to)) return false;
    const m = matchup(a.el, d.el), spread = 0.9 + random() * 0.2;
    const twice = kind === 'atk' && from.power2 > 0 ? (from.power2 = 0, 2) : 1;
    // 크리티컬: 상대 등 뒤에서(상대가 바라보는 쪽과 내 쪽이 135° 넘게 벌어짐) 또는 기절한 상대.
    const [bx, by] = aimAt(to, from), crit = to.stun > 0 || to.fx * bx + to.fy * by <= ARENA.BACK;
    let dmg = Math.max(1, Math.round(a.atk * power * m * spread * twice * (crit ? ARENA.CRIT : 1) * (kind === 'atk' && from.boost > 0 ? 1 + a.skill.boost : 1)));
    let blocked = 0;
    if (to.shield > 0) { blocked = Math.min(to.shield, dmg); to.shield -= blocked; dmg -= blocked; }
    d.cur = Math.max(0, d.cur - dmg);
    S.dealt[from.who] += dmg;
    if (kind !== 'ult') from.gauge = Math.min(ARENA.GAUGE_MAX, from.gauge + (dmg + blocked) / a.atk * ARENA.GAUGE_DEAL);
    to.gauge = Math.min(ARENA.GAUGE_MAX, to.gauge + dmg / Math.max(1, a.atk) * ARENA.GAUGE_TAKE);
    // 콤보: 2초(40틱) 안에 이어서 맞히면 +1.
    from.combo = S.t - from.comboAt <= 40 ? from.combo + 1 : 1; from.comboAt = S.t;
    ev.push({ e: 'dmg', who: to.who, dmg, blocked, kind, m, crit, combo: from.combo, hp: d.cur, max: d.hp, x: to.x, y: to.y, el: a.el, last: d.cur <= 0 && !to.team.some(f => f.cur > 0) });
    if (d.cur <= 0) return faint(to, ev), true;
    // 넉백: 때린 쪽에서 맞은 쪽으로 밀린다(3틱에 나눠서).
    const kb = ARENA.KNOCK[kind] || 0;
    if (kb > 0) { const [kx, ky] = aimAt(from, to); to.kb = ARENA.KNOCK_TICKS; to.kbx = kx * kb / ARENA.KNOCK_TICKS; to.kby = ky * kb / ARENA.KNOCK_TICKS; }
    if (extra === 'slow') { to.slow = ARENA.SLOW_TICKS; ev.push({ e: 'slow', who: to.who }); }
    if (extra === 'stun') { to.stun = Math.max(to.stun, ARENA.STUN_TICKS); ev.push({ e: 'stun', who: to.who }); }
    if (extra === 'knock') { const [nx, ny] = aimAt(from, to); to.x = clampX(to.x + nx * 9); to.y = clampY(to.y + ny * 9); ev.push({ e: 'knock', who: to.who }); }
    if (extra === 'pull') { const [nx, ny] = aimAt(to, from); to.x = clampX(to.x + nx * 14); to.y = clampY(to.y + ny * 14); to.slow = ARENA.SLOW_TICKS; ev.push({ e: 'pull', who: to.who }); }
    if (extra === 'poison') { to.poison = 80; to.poisonDmg = a.atk * (a.skill.dot || 1.2) / 8; ev.push({ e: 'poison', who: to.who }); }
    return true;
  }
  function faint(s, ev) {
    const d = active(s);
    S.ko[other(s).who]++;
    ev.push({ e: 'faint', who: s.who, idx: s.idx, key: d.key, x: s.x, y: s.y });
    const next = s.team.findIndex(f => f.cur > 0);
    if (next >= 0) bringIn(s, next, ev);
  }
  function bringIn(s, next, ev) {
    s.idx = next; s.enter = ARENA.ENTER_TICKS; s.stun = 0; s.slow = 0; s.boost = 0; s.shield = 0; s.poison = 0; s.dash = 0; s.inv = 0; s.kb = 0; s.want = wantNone();
    s.x = 50; s.y = s.who === 'me' ? 78 : 22; s.cd = 10; s.skill = Math.max(s.skill, 40); s.skill2 = Math.max(s.skill2, 60); s.power2 = 0;
    ev.push({ e: 'swap', who: s.who, idx: next, key: active(s).key });
  }

  // 공격 · 스킬 · 필살기.
  function shoot(s, power, kind, ev, { r, v, life, extra = null, spread = 0 }, code = -1) {
    const [nx, ny] = aimVec(s, code);
    face(s, nx, ny);
    // 세 갈래: 옆으로 비킨 방향(수직 벡터)을 더한다.
    const dirs = spread ? [[nx, ny], [nx - ny * spread, ny + nx * spread], [nx + ny * spread, ny - nx * spread]] : [[nx, ny]];
    for (const [dx, dy] of dirs) {
      const l = Math.sqrt(dx * dx + dy * dy) || 1;
      S.shots.push({ from: s.who, x: s.x + dx / l * 4, y: s.y + dy / l * 4, vx: dx / l * v, vy: dy / l * v, r, life, power, kind, extra, el: active(s).el });
    }
    ev.push({ e: kind, who: s.who, shape: dirs.length > 1 ? 'orb3' : 'shot', el: active(s).el, x: s.x, y: s.y, nx, ny });
  }
  function melee(s, power, kind, ev, code = -1) {
    const o = other(s), [nx, ny, locked] = aimVec(s, code), d = gap(s, o), reach = SHOT[active(s).shape].melee + ARENA.BODY;
    face(s, nx, ny);
    // 조금 멀면 달려들며 친다(근접 펫이 원거리 펫을 따라잡게). 상대 쪽을 보고 있을 때만.
    if (locked && d > reach && d <= reach + ARENA.MELEE_LUNGE) { const step = d - reach + 2; s.x = clampX(s.x + nx * step); s.y = clampY(s.y + ny * step); ev.push({ e: 'lunge', who: s.who }); }
    ev.push({ e: kind, who: s.who, shape: 'claw', el: active(s).el, x: s.x, y: s.y, nx, ny });
    // 앞쪽 ±70° 안(몸이 닿아 있으면 어디든)만 맞는다.
    const [ux, uy, dd] = aimAt(s, o);
    if (dd <= reach && (dd <= ARENA.BODY * 1.5 || ux * nx + uy * ny >= ARENA.MELEE_ARC)) damage(s, o, power, kind, ev);
  }
  function dashAt(s, power, kind, ev, extra = null, code = -1) {
    const [nx, ny] = aimVec(s, code);
    face(s, nx, ny);
    const long = kind === 'skill2';
    s.dash = long ? 13 : 9; s.dvx = nx * 3.4; s.dvy = ny * 3.4; s.dashHit = false; s.dashPow = power; s.dashKind = kind; s.dashExtra = extra; s.inv = s.dash;
    ev.push({ e: kind, who: s.who, shape: 'dash', el: active(s).el, x: s.x, y: s.y, nx, ny });
  }
  // 지진 · 소나기 자리: 상대에게 맞췄으면 상대 발밑, 아니면 조준 방향으로 상대 거리만큼(12~40).
  function spot(s, code) {
    const o = other(s), [nx, ny, locked] = aimVec(s, code);
    face(s, nx, ny);
    if (locked) return [o.x, o.y];
    const d = Math.max(12, Math.min(ARENA.QUAKE_RANGE, gap(s, o)));
    return [clampX(s.x + nx * d), clampY(s.y + ny * d)];
  }
  function quakeAt(s, power, kind, ev, extra = null, at = null, r = 12) {
    const [x, y] = at || spot(s, -1);
    S.quakes.push({ from: s.who, x, y, r, at: S.t + 14, power, kind, extra });
    ev.push({ e: kind, who: s.who, shape: 'quake', el: active(s).el, x: s.x, y: s.y, tx: x, ty: y, warn: 14 });
  }
  function basic(s, ev, code = -1) {
    const a = active(s), sh = SHOT[a.shape], b = brain[s.who];
    s.cd = Math.round(a.atkTicks * (s.boost > 0 ? 0.7 : 1) * (s.slow > 0 ? 1.3 : 1) * (b ? b.slow : 1) * (a.melee ? 1.1 : 1));
    if (sh.melee) return melee(s, 1, 'atk', ev, code);
    shoot(s, 1, 'atk', ev, sh, code);
  }
  function skill(s, ev, code = -1) {
    const a = active(s), k = a.skill;
    s.skill = a.skillCd || ARENA.SKILL_TICKS;
    if (k.kind === 'guard') {
      if (k.heal) a.cur = Math.min(a.hp, a.cur + Math.round(a.hp * k.heal));
      if (k.shield) s.shield = Math.round(a.atk * k.shield * 2.5);
      return ev.push({ e: 'buff', who: s.who, kind: 'guard', name: k.name, el: a.el, heal: !!k.heal, shield: s.shield, hp: a.cur, max: a.hp });
    }
    if (k.kind === 'boost') { s.boost = 120; s.cd = 0; return ev.push({ e: 'buff', who: s.who, kind: 'boost', name: k.name, el: a.el }); }
    ev.push({ e: 'skillname', who: s.who, name: k.name, el: a.el });
    const extra = k.kind === 'poison' ? 'poison' : k.extra;
    if (a.shape === 'beam') return shoot(s, k.power, 'skill', ev, { v: 5.2, r: 5, life: 14, extra }, code);
    if (a.shape === 'orb') return shoot(s, k.power / 1.6, 'skill', ev, { v: 2.8, r: 3.6, life: 22, extra, spread: 0.32 }, code);
    if (a.shape === 'quake') return quakeAt(s, k.power, 'skill', ev, extra, spot(s, code));
    return dashAt(s, k.power, 'skill', ev, extra, code);
  }
  function skill2(s, ev, code = -1) {
    const a = active(s), k = a.skill2, o = other(s), aims = !['blink', 'nova', 'trap', 'heal'].includes(k.kind), [nx, ny] = aims ? aimVec(s, code) : aimAt(s, o);
    if (aims && k.kind !== 'rain') { face(s, nx, ny); }
    s.skill2 = a.skill2Cd || ARENA.SKILL2_TICKS;
    ev.push({ e: 'skillname', who: s.who, name: k.name, el: a.el, two: true });
    if (k.kind === 'blink') {
      // 상대 반대쪽(조이스틱 방향이 있으면 그쪽)으로 비켜서고, 다음 공격 2배.
      let [dx, dy] = DIRS[s.dir] || [0, 0];
      if (!dx && !dy) { dx = -nx; dy = -ny; }
      ev.push({ e: 'blink', who: s.who, x: s.x, y: s.y });
      s.x = clampX(s.x + dx * 22); s.y = clampY(s.y + dy * 22); s.inv = 6; s.power2 = 1;
      return ev.push({ e: 'blinked', who: s.who, x: s.x, y: s.y });
    }
    if (k.kind === 'nova') { S.quakes.push({ from: s.who, x: s.x, y: s.y, r: 17, at: S.t + 5, power: 1.9, kind: 'skill2', extra: 'knock', self: true }); return ev.push({ e: 'skill2', who: s.who, shape: 'nova', el: a.el, x: s.x, y: s.y, warn: 5 }); }
    if (k.kind === 'barrage') { for (const sp of [-0.5, -0.25, 0, 0.25, 0.5]) { const dx = nx - ny * sp, dy = ny + nx * sp, l = Math.sqrt(dx * dx + dy * dy) || 1; S.shots.push({ from: s.who, x: s.x + dx / l * 4, y: s.y + dy / l * 4, vx: dx / l * 3, vy: dy / l * 3, r: 2.6, life: 18, power: 0.7, kind: 'skill2', extra: null, el: a.el }); } return ev.push({ e: 'skill2', who: s.who, shape: 'barrage', el: a.el, x: s.x, y: s.y, nx, ny }); }
    if (k.kind === 'trap') { S.mines = [...S.mines.filter(m => m.from !== s.who), { from: s.who, x: s.x, y: s.y, until: S.t + 240, el: a.el }]; return ev.push({ e: 'skill2', who: s.who, shape: 'trap', el: a.el, x: s.x, y: s.y }); }
    if (k.kind === 'rain') { const [cx, cy] = spot(s, code); for (const [ox, oy] of [[0, 0], [-10, 5], [10, 5]]) quakeAt(s, 1.25, 'skill2', ev, null, [clampX(cx + ox), clampY(cy + oy)], 8); return; }
    if (k.kind === 'rush') return dashAt(s, 2.1, 'skill2', ev, 'knock', code);
    if (k.kind === 'pull') { S.shots.push({ from: s.who, x: s.x + nx * 4, y: s.y + ny * 4, vx: nx * 4.2, vy: ny * 4.2, r: 3.4, life: 12, power: 1, kind: 'skill2', extra: 'pull', el: a.el, hook: true }); return ev.push({ e: 'skill2', who: s.who, shape: 'hook', el: a.el, x: s.x, y: s.y, nx, ny }); }
    // heal
    a.cur = Math.min(a.hp, a.cur + Math.round(a.hp * 0.15)); s.slow = 0; s.poison = 0; s.stun = 0;
    return ev.push({ e: 'buff', who: s.who, kind: 'heal', name: k.name, el: a.el, heal: true, shield: s.shield, hp: a.cur, max: a.hp });
  }
  function ult(s, ev, code = -1) {
    const a = active(s), o = other(s), [nx, ny] = aimVec(s, code);
    s.gauge = 0; S.ults[s.who]++;
    face(s, nx, ny);
    S.freeze = ARENA.ULT_FREEZE_TICKS;
    S.pendingUlt = s.who; S.ultAim = [nx, ny];
    ev.push({ e: 'cutin', who: s.who, key: a.key, form: a.form, el: a.el, name: a.ult, rank: a.rank, tx: o.x, ty: o.y, nx, ny });
  }
  // 컷인이 끝나면 터진다: 조준한 쪽 부채꼴(±35°) 안에 있고, 그 순간 회피 중(무적)이 아니면 맞는다.
  function ultLand(ev) {
    const s = S[S.pendingUlt], [nx, ny] = S.ultAim || [0, 0]; S.pendingUlt = null; S.ultAim = null;
    if (!s) return;
    const o = other(s), [tx, ty, d] = aimAt(s, o), inside = d <= ARENA.BODY * 2 || tx * nx + ty * ny >= ARENA.ULT_ARC;
    const far = Math.max(30, Math.min(60, d));
    ev.push({ e: 'ult', who: s.who, el: active(s).el, x: s.x, y: s.y, tx: inside ? o.x : clampX(s.x + nx * far), ty: inside ? o.y : clampY(s.y + ny * far), hit: inside, nx, ny });
    if (inside) damage(s, o, ARENA.ULT_POWER, 'ult', ev, active(s).skill.extra === 'knock' ? 'knock' : null);
  }
  function dodge(s, ev) {
    let [dx, dy] = DIRS[s.dir] || [0, 0];
    if (!dx && !dy) { const [nx, ny] = aimAt(s, other(s)); dx = -ny; dy = nx; } // 방향이 없으면 옆으로
    s.dash = ARENA.DODGE_TICKS; s.dvx = dx * ARENA.DODGE_SPEED; s.dvy = dy * ARENA.DODGE_SPEED; s.dashHit = true; s.dashKind = 'dodge';
    s.inv = ARENA.DODGE_TICKS + 1; s.dodgeCd = active(s).dodgeCd || ARENA.DODGE_CD;
    ev.push({ e: 'dodge', who: s.who, x: s.x, y: s.y, dx, dy });
  }
  function swap(s, ev) {
    const next = [1, 2].map(n => (s.idx + n) % s.team.length).find(i => s.team[i]?.cur > 0);
    if (next == null || next === s.idx) return false;
    s.swapCd = ARENA.SWAP_CD;
    bringIn(s, next, ev);
    return true;
  }

  // 한 쪽의 한 틱: 상태 시간 줄이기 → 버튼 → 움직이기.
  function tickSide(s, ev) {
    const a = active(s), o = other(s);
    if (!a || a.cur <= 0) return;
    if (s.dodgeCd > 0) s.dodgeCd--;
    if (s.swapCd > 0) s.swapCd--;
    if (s.inv > 0) s.inv--;
    if (s.slow > 0) s.slow--;
    if (s.boost > 0) s.boost--;
    if (s.poison > 0 && s.enter <= 0) {
      s.poison--;
      if (s.poison % 10 === 0) {
        const dmg = Math.max(1, Math.round(s.poisonDmg));
        a.cur = Math.max(0, a.cur - dmg);
        ev.push({ e: 'dmg', who: s.who, dmg, blocked: 0, kind: 'poison', m: 1, hp: a.cur, max: a.hp, x: s.x, y: s.y, el: 'toxic' });
        if (a.cur <= 0) return faint(s, ev);
      }
    }
    if (s.lock > 0) s.lock--;
    if (s.kb > 0) { s.kb--; s.x = clampX(s.x + s.kbx); s.y = clampY(s.y + s.kby); }
    if (s.enter > 0) { s.enter--; if (!s.enter) ev.push({ e: 'enter', who: s.who, idx: s.idx, key: a.key }); return; }
    if (s.cd > 0) s.cd--;
    if (s.skill > 0) s.skill--;
    if (s.skill2 > 0) s.skill2--;
    if (s.stun > 0) { s.stun--; return; }
    if (s.dash > 0) {
      s.dash--;
      s.x = clampX(s.x + s.dvx); s.y = clampY(s.y + s.dvy);
      if (!s.dashHit && gap(s, o) <= ARENA.BODY * 2 + 2) { s.dashHit = true; damage(s, o, s.dashPow, s.dashKind, ev, s.dashExtra); }
      return;
    }
    const w = s.want;
    if (w.swap) { w.swap = false; if (s.swapCd <= 0 && swap(s, ev)) return; }
    if (w.ult) { w.ult = false; const c = w.ultA; w.ultA = -1; if (s.gauge >= ARENA.GAUGE_MAX && o.enter <= 0) return ult(s, ev, c); }
    if (w.dodge) { w.dodge = false; if (s.dodgeCd <= 0) return dodge(s, ev); }
    if (w.skill && s.skill <= 0 && o.enter <= 0) { w.skill = false; const c = w.skillA; w.skillA = -1; return skill(s, ev, c); }
    if (w.skill2 && s.skill2 <= 0 && o.enter <= 0) { w.skill2 = false; const c = w.skill2A; w.skill2A = -1; return skill2(s, ev, c); }
    if (w.atk && s.cd <= 0 && o.enter <= 0) { w.atk = false; const c = w.atkA; w.atkA = -1; basic(s, ev, c); }
    const [dx, dy] = DIRS[s.dir] || [0, 0];
    if (dx || dy) {
      const v = a.move * (s.slow > 0 ? 0.6 : 1);
      s.x = clampX(s.x + dx * v); s.y = clampY(s.y + dy * v);
      // V13.228 움직이는 방향 = 바라보는 방향(서 있으면 마지막 방향을 그대로). 방금 공격했으면 잠깐 쏜 쪽을 본다.
      if (s.lock <= 0) { s.fx = dx; s.fy = dy; }
    }
    // 두 펫이 겹치지 않게 살짝 밀어낸다.
    const d = gap(s, o);
    if (d < ARENA.BODY * 2 && o.enter <= 0) { const [nx, ny] = aimAt(s, o); const push = (ARENA.BODY * 2 - d) / 2; s.x = clampX(s.x - nx * push); s.y = clampY(s.y - ny * push); }
  }

  // 컴퓨터 조종: 사거리에 맞춰 다가가거나 물러나고, 옆으로 돌며 공격 · 스킬. 날아오는 공격은 가끔 피한다.
  function think(s) {
    const b = brain[s.who];
    if (!b) return;
    const a = active(s), o = other(s), w = s.want;
    if (!a || s.enter > 0) return;
    const [nx, ny, d] = aimAt(s, o);
    const melee = !!SHOT[a.shape].melee, want = melee ? 9 : 30;
    if (s.dodgeCd <= 0 && s.dash <= 0) {
      const danger = S.shots.some(x => x.from !== s.who && Math.abs(x.x - s.x) < 14 && Math.abs(x.y - s.y) < 14 && (x.vx * (s.x - x.x) + x.vy * (s.y - x.y)) > 0)
        || S.quakes.some(q => q.from !== s.who && q.at - S.t <= 8 && Math.abs(q.x - s.x) < q.r + 3 && Math.abs(q.y - s.y) < q.r + 3);
      if (danger && random() < b.dodge) w.dodge = true;
    }
    if (s.think-- <= 0) { s.think = 8 + Math.floor(random() * 10); if (random() < 0.25) s.strafe = -s.strafe; }
    const toward = d > want + 4 ? 1 : d < want - 5 ? -1 : 0;
    const mx = nx * toward - ny * s.strafe * 0.8, my = ny * toward + nx * s.strafe * 0.8;
    // 가장자리에 몰리면 가운데 쪽으로.
    const cx = s.x < 18 ? 0.7 : s.x > 82 ? -0.7 : 0, cy = s.y < 20 ? 0.7 : s.y > 80 ? -0.7 : 0;
    s.dir = dirCode(mx + cx, my + cy, 0.2);
    // 컴퓨터도 버튼을 끌어서 조준한다: 솜씨(acc)만큼 정확히, 아니면 16방향 한두 칸 빗나간다.
    const aim = () => { const c = aimCode(nx, ny), r = random(); return r < b.acc ? c : (c + 16 + (r < (1 + b.acc) / 2 ? 1 : -1) * (random() < 0.7 ? 1 : 2)) % 16; };
    if (s.gauge >= ARENA.GAUGE_MAX && o.enter <= 0 && o.inv <= 0 && !w.ult) { w.ult = true; w.ultA = aim(); }
    if (s.skill <= 0 && d < want + 14 && !w.skill && random() < b.skill) { w.skill = true; w.skillA = aim(); }
    if (s.skill2 <= 0 && d < want + 18 && !w.skill2 && random() < b.skill * 0.8) { w.skill2 = true; w.skill2A = aim(); }
    if (s.cd <= 0 && d < (melee ? 15 : 44) && random() < b.aim) { w.atk = true; w.atkA = aim(); }
    // 내 펫이 거의 쓰러질 것 같고 교체할 수 있으면 가끔 바꾼다.
    if (s.swapCd <= 0 && a.cur < a.hp * 0.2 && random() < 0.02) w.swap = true;
  }

  function input() {
    while (S.ip < S.inputs.length && S.inputs[S.ip][0] <= S.t) {
      const [, c, a] = S.inputs[S.ip++], w = S.me.want, code = a == null ? -1 : a;
      if (c <= 8) S.me.dir = c;
      else if (c === INPUT.ATK) { w.atk = true; w.atkA = code; }
      else if (c === INPUT.SKILL) { w.skill = true; w.skillA = code; }
      else if (c === INPUT.ULT) { w.ult = true; w.ultA = code; }
      else if (c === INPUT.DODGE) w.dodge = true;
      else if (c === INPUT.SWAP) w.swap = true;
      else if (c === INPUT.SKILL2) { w.skill2 = true; w.skill2A = code; }
      else if (c === INPUT.AIM_EASY) S.me.aimMode = 1;
      else if (c === INPUT.AIM_AUTO) S.me.aimMode = 2;
      else if (c === INPUT.AIM_FREE) S.me.aimMode = 0;
    }
  }
  // 날아가는 공격 · 지진.
  function fly(ev) {
    for (const x of S.shots) {
      x.x += x.vx; x.y += x.vy; x.life--;
      const s = S[x.from], o = other(s);
      if (x.life <= 0 || x.x < 2 || x.x > 98 || x.y < 6 || x.y > 94) { x.dead = true; continue; }
      if (hittable(o) && gap(x, o) <= x.r + ARENA.BODY) { x.dead = true; ev.push({ e: 'pop', x: x.x, y: x.y, el: x.el, kind: x.kind }); damage(s, o, x.power, x.kind, ev, x.extra); }
    }
    S.shots = S.shots.filter(x => !x.dead);
    for (const q of S.quakes) {
      if (q.at > S.t) continue;
      q.dead = true;
      const s = S[q.from], o = other(s);
      const at = q.self ? { x: s.x, y: s.y } : q;
      ev.push({ e: 'boom', x: at.x, y: at.y, r: q.r, el: active(s)?.el || 'earth', kind: q.kind });
      if (gap(at, o) <= q.r + ARENA.BODY * 0.5) damage(s, o, q.power, q.kind, ev, q.extra);
    }
    S.quakes = S.quakes.filter(q => !q.dead);
    for (const m of S.mines) {
      const s = S[m.from], o = other(s);
      if (S.t > m.until) { m.dead = true; continue; }
      if (hittable(o) && gap(m, o) <= 8) { m.dead = true; ev.push({ e: 'boom', x: m.x, y: m.y, r: 9, el: m.el, kind: 'skill2' }); damage(s, o, 2.2, 'skill2', ev, 'stun'); }
    }
    S.mines = S.mines.filter(m => !m.dead);
  }
  function finish(ev) {
    if (S.over) return;
    const meAlive = alive(S.me), foeAlive = alive(S.foe);
    let winner = null;
    if (!foeAlive && meAlive) winner = 'me';
    else if (!meAlive && foeAlive) winner = 'foe';
    else if (!meAlive && !foeAlive) winner = 'draw';
    else if (S.t >= ARENA.MAX_TICKS) {
      const left = s => s.team.reduce((n, f) => n + f.cur / f.hp, 0);
      const a = left(S.me), b = left(S.foe);
      winner = Math.abs(a - b) < 1e-9 ? 'draw' : a > b ? 'me' : 'foe';
    }
    if (winner) { S.over = true; S.winner = winner; S.shots = []; S.quakes = []; S.mines = []; ev.push({ e: 'over', winner }); }
  }
  function step() {
    const ev = [];
    if (S.over) return ev;
    input();
    if (S.freeze > 0) { S.freeze--; if (!S.freeze) ultLand(ev); S.t++; finish(ev); return ev; }
    think(S.me);
    think(S.foe);
    tickSide(S.me, ev);
    if (!S.freeze) tickSide(S.foe, ev);
    if (!S.freeze) fly(ev);
    S.t++;
    finish(ev);
    return ev;
  }
  const sideView = s => ({ x: s.x, y: s.y, fx: s.fx, fy: s.fy, aimMode: s.aimMode, combo: s.combo, idx: s.idx, gauge: s.gauge, enter: s.enter, stun: s.stun, slow: s.slow, boost: s.boost, shield: s.shield, poison: s.poison, inv: s.inv, dash: s.dash,
    cd: s.cd, skill: s.skill, skill2: s.skill2, power2: s.power2, dodgeCd: s.dodgeCd, swapCd: s.swapCd, team: s.team.map(f => ({ key: f.key, cur: f.cur, hp: f.hp })) });
  return {
    S, step,
    push: x => { S.inputs.push(x); },
    view: () => ({ t: S.t, freeze: S.freeze, me: sideView(S.me), foe: sideView(S.foe), shots: S.shots.map(x => ({ x: x.x, y: x.y, r: x.r, el: x.el, kind: x.kind, from: x.from })), quakes: S.quakes.map(q => ({ x: q.self ? S[q.from].x : q.x, y: q.self ? S[q.from].y : q.y, r: q.r, left: q.at - S.t, from: q.from })), mines: S.mines.map(m => ({ x: m.x, y: m.y, from: m.from, el: m.el })), over: S.over, winner: S.winner })
  };
}

// 끝까지 한 번에(서버 · 검사): 결과 { winner, ticks, ults, left, ko, dealt }.
export function runArena({ seed, me, foe, foeLevel, inputs, meAi = null }) {
  const A = createArena({ seed, me, foe, foeLevel, meAi });
  for (const x of inputs || []) A.push(x);
  let guard = 0;
  while (!A.S.over && guard++ < ARENA.MAX_TICKS + 2000) A.step();
  const left = s => s.team.filter(f => f.cur > 0).length;
  return { winner: A.S.winner || 'draw', ticks: A.S.t, ults: { ...A.S.ults }, left: { me: left(A.S.me), foe: left(A.S.foe) }, ko: { ...A.S.ko }, dealt: { ...A.S.dealt } };
}
