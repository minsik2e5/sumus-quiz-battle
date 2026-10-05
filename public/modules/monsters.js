// V13.94 몬스터 잡기: the student's word ranges, in order, are grouped into parts (파트) of about
// 60 words; every part has a monster to beat at 이지, 노말 and 하드. V13.100: clears are kept per
// range, not per part (see partClears). Shared by the server (which
// checks the part, unlocks levels and pays) and the app (which runs the fight on the phone with
// the yacha engine, like the robot practice match).

// The nine monsters of the plan (docs/asset-requests 05-bosses). Until their pictures arrive
// (MONSTER_ART), each borrows a pet picture recoloured with a CSS filter (`temp`).
export const MONSTERS = [
  { key: 'slime', name: '스펠링 슬라임', line: '글자를 뒤죽박죽 섞어 버리는 말랑 슬라임', color: '#5fcf6a', temp: { pet: 'whale', form: 2, filter: 'hue-rotate(-95deg) saturate(1.5)' } },
  { key: 'forgetghost', name: '까먹귀', line: '외운 단어를 지우개로 지워 버리는 꼬마 유령', color: '#b9a3ff', temp: { pet: 'phoenix', form: 1, filter: 'hue-rotate(210deg) saturate(.7) brightness(1.15)' } },
  { key: 'clock', name: '째깍 도둑', line: '시험 시간을 훔쳐 가는 시계 괴물', color: '#e0a23a', temp: { pet: 'robot', form: 2, filter: 'hue-rotate(-140deg) saturate(1.6) brightness(.95)' } },
  { key: 'golem', name: '문법 골렘', line: '문법 블록과 문장부호로 만든 돌 골렘', color: '#8f9bab', temp: { pet: 'robot', form: 3, filter: 'grayscale(.75) brightness(.92) contrast(1.15)' } },
  { key: 'phone', name: '폰마왕', line: '알림으로 공부를 방해하는 스마트폰 마왕', color: '#8b5cf6', temp: { pet: 'robot', form: 1, filter: 'hue-rotate(95deg) saturate(1.7) brightness(.9)' } },
  { key: 'pirate', name: '오답 해적 선장', line: '틀린 답을 모아 배를 만든 해적 선장', color: '#e5484d', temp: { pet: 'shark', form: 3, filter: 'hue-rotate(150deg) saturate(1.5) brightness(.92)' } },
  { key: 'owlnight', name: '밤샘 부엉 대장', line: '밤새 공부를 방해하는 졸린 부엉이 장군', color: '#3b5bdb', temp: { pet: 'owl', form: 3, filter: 'hue-rotate(185deg) saturate(1.3) brightness(.8)' } },
  { key: 'dictdragon', name: '딕셔너리 드래곤', line: '사전 날개를 펼친 거대한 드래곤', color: '#4f46e5', temp: { pet: 'dragon', form: 3, filter: 'hue-rotate(45deg) saturate(1.4) brightness(.88)' } },
  { key: 'finalking', name: '수능 대마왕', line: '시험지 갑옷을 입은 마지막 대마왕', color: '#b91c1c', temp: { pet: 'qilin', form: 3, filter: 'hue-rotate(-40deg) saturate(1.6) brightness(.82) contrast(1.1)' } },
  // V13.105 몬스터 2탄 (주문서 docs/asset-requests/runner/12-monsters.txt). Until the pictures of sheets
  // 12-1 … 12-9 arrive they borrow a recoloured pet picture like the first nine did.
  { key: 'mochi', name: '암기 모찌', line: '외운 단어를 말랑하게 뭉개 버리는 찹쌀 모찌', color: '#e8a7b8', temp: { pet: 'hamster', form: 1, filter: 'saturate(.25) brightness(1.22)' } },
  { key: 'pencilworm', name: '샤프 벌레', line: '샤프심을 갉아 먹는 초록 애벌레', color: '#3fbf8f', temp: { pet: 'snake', form: 2, filter: 'hue-rotate(25deg) saturate(1.25)' } },
  { key: 'mimic', name: '노트 미믹', line: '노트인 척하다가 덥석 무는 미믹', color: '#c9894a', temp: { pet: 'robot', form: 2, filter: 'sepia(.6) hue-rotate(-20deg) saturate(1.5)' } },
  { key: 'sleepcloud', name: '졸음 구름', line: '공부만 하면 졸음을 뿌리는 구름', color: '#8b93c9', temp: { pet: 'whale', form: 1, filter: 'grayscale(.55) hue-rotate(200deg) brightness(1.08)' } },
  { key: 'alarmwolf', name: '알람 늑대', line: '알람 소리로 집중을 깨뜨리는 늑대', color: '#3d5a99', temp: { pet: 'fox', form: 3, filter: 'hue-rotate(190deg) saturate(1.2) brightness(.85)' } },
  { key: 'scrollgoblin', name: '무한 스크롤 도깨비', line: '끝없는 스크롤로 시간을 훔치는 도깨비', color: '#f08a3c', temp: { pet: 'fox', form: 2, filter: 'saturate(1.6) hue-rotate(-10deg)' } },
  { key: 'proctor', name: '감독 기사', line: '시계 방패를 든 엄격한 시험 감독 기사', color: '#6b7b93', temp: { pet: 'robot', form: 3, filter: 'grayscale(.35) hue-rotate(160deg) brightness(.9)' } },
  { key: 'cramwizard', name: '벼락치기 마법사', line: '시험 전날 밤 커피로 마법을 부리는 마법사', color: '#7c4dcc', temp: { pet: 'owl', form: 3, filter: 'hue-rotate(40deg) saturate(1.5) brightness(.85)' } },
  { key: 'mockhydra', name: '모의고사 히드라', line: '머리 셋 달린 모의고사 괴물', color: '#2f9e8f', temp: { pet: 'dragon', form: 3, filter: 'sepia(.45) saturate(1.3) hue-rotate(80deg)' } }
];
// V13.105 the monster of each level: small to big, the first and the second nine mixed. After the
// 18th level they come round again stronger ("+1", "+2" …).
export const MONSTER_ORDER = ['mochi', 'slime', 'pencilworm', 'forgetghost', 'mimic', 'clock', 'sleepcloud', 'golem', 'alarmwolf', 'phone', 'scrollgoblin', 'pirate', 'proctor', 'owlnight', 'cramwizard', 'dictdragon', 'mockhydra', 'finalking'];
export function stageMonster(stage) {
  const s = Math.max(1, Math.floor(Number(stage) || 1)), i = (s - 1) % MONSTER_ORDER.length, round = Math.floor((s - 1) / MONSTER_ORDER.length);
  const m = MONSTERS.find(x => x.key === MONSTER_ORDER[i]) || MONSTERS[0];
  return { ...m, round, title: round ? `${m.name} +${round}` : m.name };
}
// Monsters whose own pictures are in public/assets/monsters (<key>.webp, <key>-attack.webp,
// <key>-hurt.webp, <key>-down.webp). V13.95: all nine, cut from the sheets 10-1 … 10-9 (the
// four poses of a sheet at one scale, feet on the floor like the pets). `temp` stays as the
// fallback for a monster added later without pictures.
export const MONSTER_ART = new Set(['slime', 'forgetghost', 'clock', 'golem', 'phone', 'pirate', 'owlnight', 'dictdragon', 'finalking']);
export const MONSTER_POSES = ['attack', 'hurt', 'down'];
// V13.94 parts (kept for moving the old clears) took the first nine in turn.
export const monsterOf = index => MONSTERS[((index % 9) + 9) % 9];

// 이지 · 노말 · 하드. The monster answers like the practice robot (`accuracy`, `min`..`max` ms)
// with its own HP and skill, and it has to be knocked out before time runs out (otherwise the
// monster wins). 하드 is 실력전 (spelling mixed in). In thousands of simulated fights:
//   이지  — a student who knows 3 words in 4 wins 80%
//   노말  — a student who knows 9 words in 10 wins 80% (3 in 4: 12%)
//   하드  — a student who knows almost every word wins about a third (9 in 10: 16%)
// The first clear pays a lot; clearing again pays a little, MONSTER_DAILY times a day.
// V13.102 coins: first 50/150/500 -> 30/90/200, again 6/12/30 -> 8/15/20 (경험치 is unchanged).
// Replaying hard 5 times used to pay as much as a whole day of study (150); now at most 100.
// `need`: words to answer right for a fight to pay at all.
export const MONSTER_LEVELS = {
  easy: { name: '이지', mode: 'speed', accuracy: .45, min: 3200, max: 7200, hp: 320, monsterHp: 200, skill: 'bump', need: 5,
    first: { coins: 30, xp: 150 }, again: { coins: 8, xp: 40 } },
  normal: { name: '노말', mode: 'speed', accuracy: .72, min: 2000, max: 5000, hp: 320, monsterHp: 330, skill: 'roar', need: 8,
    first: { coins: 90, xp: 350 }, again: { coins: 15, xp: 70 } },
  hard: { name: '하드', mode: 'skill', accuracy: .85, min: 1500, max: 3600, hp: 300, monsterHp: 330, skill: 'rage', need: 12,
    first: { coins: 200, xp: 1000 }, again: { coins: 20, xp: 120 } }
};
export const MONSTER_LEVEL_KEYS = ['easy', 'normal', 'hard'];

/* ---------- V13.105 끝없는 레벨 (stages) ----------
   몬스터전은 레벨 1, 2, 3 … 끝없이 이어진다. 레벨마다 이지 · 노말 · 하드가 있고, 한 레벨의 셋을
   모두 깨야 다음 레벨이 열린다. 레벨 1은 셋 다 쉽고, 레벨 10에서 V13.94의 이지 · 노말 · 하드
   세기가 되고, 그 뒤로는 점점 상한(STAGE_CAP)에 가까워진다. 보상(처음 깰 때)은 레벨이 오를수록
   늘고(STAGE_REWARD_MAX배까지), 5레벨마다 보스(보상 1.5배, 몬스터 HP 1.08배).
   레벨 N의 단어는 학생이 고른 범위(야차전과 같은 범위)라서, 레벨은 단어장과 상관없이 이어진다. */
// The fight at stage 1 and at stage 10 (= V13.94 MONSTER_LEVELS), and the limit far beyond.
const STAGE_START = {
  easy: { accuracy: .2, min: 4400, max: 9000, monsterHp: 130, need: 4 },
  normal: { accuracy: .4, min: 3200, max: 6800, monsterHp: 210, need: 6 },
  hard: { accuracy: .55, min: 2400, max: 5200, monsterHp: 230, need: 8 }
};
export const STAGE_CAP = {
  easy: { accuracy: .75, min: 2300, max: 5000, monsterHp: 330, need: 7 },
  normal: { accuracy: .85, min: 1650, max: 3900, monsterHp: 430, need: 10 },
  hard: { accuracy: .93, min: 1200, max: 2900, monsterHp: 430, need: 14 }
};
export const STAGE_ANCHOR = 10;     // the stage where V13.94's 이지 · 노말 · 하드 are reached
export const STAGE_CLIMB = 0.97;    // after STAGE_ANCHOR, each stage closes 3% of the gap to STAGE_CAP
export const STAGE_BOSS_EVERY = 5;
// First-clear reward at stage 1 (coins, 경험치); it grows by STAGE_REWARD_STEP a stage up to
// STAGE_REWARD_MAX times. A cleared fight played again pays STAGE_AGAIN_SHARE of it.
export const STAGE_REWARD = { easy: { coins: 5, xp: 60 }, normal: { coins: 10, xp: 120 }, hard: { coins: 15, xp: 240 } };
export const STAGE_REWARD_STEP = 0.12, STAGE_REWARD_MAX = 4, STAGE_BOSS_REWARD = 1.5, STAGE_BOSS_HP = 1.08;
export const STAGE_AGAIN_SHARE = 0.2;
export const cleanStage = value => Math.max(1, Math.min(9999, Math.floor(Number(value) || 1)));
export const isBossStage = stage => cleanStage(stage) % STAGE_BOSS_EVERY === 0;
const mix = (a, b, x) => a + (b - a) * x;
// The fight of a stage at a level: MONSTER_LEVELS[level] with this stage's strength and rewards.
export function stageLevel(stage, level) {
  const L = MONSTER_LEVELS[level];
  if (!L) return null;
  const s = cleanStage(stage), from = STAGE_START[level], at = MONSTER_LEVELS[level], cap = STAGE_CAP[level];
  const x = s <= STAGE_ANCHOR ? (s - 1) / (STAGE_ANCHOR - 1) : 1 - STAGE_CLIMB ** (s - STAGE_ANCHOR);
  const pick = key => s <= STAGE_ANCHOR ? mix(from[key], at[key], x) : mix(at[key], cap[key], x);
  const boss = isBossStage(s);
  const grow = Math.min(STAGE_REWARD_MAX, 1 + STAGE_REWARD_STEP * (s - 1)) * (boss ? STAGE_BOSS_REWARD : 1);
  const first = { coins: Math.round(STAGE_REWARD[level].coins * grow), xp: Math.round(STAGE_REWARD[level].xp * grow) };
  return {
    ...L, stage: s, boss,
    accuracy: Math.round(pick('accuracy') * 1000) / 1000,
    min: Math.round(pick('min')), max: Math.round(pick('max')),
    monsterHp: Math.round(pick('monsterHp') * (boss ? STAGE_BOSS_HP : 1)),
    need: Math.round(pick('need')),
    first,
    again: { coins: Math.max(1, Math.round(first.coins * STAGE_AGAIN_SHARE)), xp: Math.max(1, Math.round(first.xp * STAGE_AGAIN_SHARE)) }
  };
}

export const MONSTER_DAILY = 5;
export const MONSTER_MIN_MS = 30000; // a fight cannot be won faster than this
// V13.99: a lost fight pays only after `need` right answers, and answering takes time: at least
// 1.5 s per right answer (a real word needs the tap plus the 1.4 s reveal, after a 3 s countdown),
// so an honest quick loss always passes and a made-up result sent at once does not.
export const MONSTER_MS_PER_RIGHT = 1500;
export const MONSTER_TRY = { coins: 2, xp: 20 }; // a lost fight that answered `need` words

// Natural order of range codes: 2 before 10, '41~42' after '40', L1 after the numbers.
const codeKey = code => { const m = String(code).match(/^(\D*)(\d+)/); return m ? [m[1], Number(m[2]), String(code)] : [String(code), 0, String(code)]; };
const byCode = (a, b) => { const x = codeKey(a), y = codeKey(b); return x[0].localeCompare(y[0]) || x[1] - y[1] || x[2].localeCompare(y[2]); };

// Parts from the ranges of a grade (`counts`: Map code -> words). A part takes ranges in order
// until it has 60 words or 3 ranges; a last part under 30 words joins the one before it.
// Ranges with fewer than 4 words are left out.
export const PART_WORDS = 60, PART_RANGES = 3;
export function monsterParts(counts) {
  const codes = [...counts.keys()].map(String).filter(code => (counts.get(code) || 0) >= 4).sort(byCode);
  const parts = [];
  let cur = null;
  for (const code of codes) {
    if (!cur || cur.words >= PART_WORDS || cur.codes.length >= PART_RANGES) parts.push(cur = { codes: [], words: 0 });
    cur.codes.push(code); cur.words += counts.get(code) || 0;
  }
  const last = parts[parts.length - 1];
  if (parts.length > 1 && last.words < 30) { const prev = parts[parts.length - 2]; prev.codes.push(...last.codes); prev.words += last.words; parts.pop(); }
  // V13.100 `sizes`: words of each range (same order as `codes`), for the first-clear share.
  return parts.filter(p => p.words >= 8).map((p, index) => ({ ...p, sizes: p.codes.map(code => counts.get(code) || 0), index, key: p.codes.join('+'), monster: monsterOf(index) }));
}
// V13.100 클리어는 범위마다 기록한다 (`ranges`: { [range code]: { easy, normal, hard: first clear time } }
// of the student's school and grade). The grouping into parts changes when a teacher adds a range
// or words, so a part is cleared at a level when every range in it is; a part that got a new range
// opens again from 이지, and its first clear pays only the share of words not cleared yet.
export function partClears(part, ranges = {}) {
  const out = {};
  for (const level of MONSTER_LEVEL_KEYS) {
    const times = (part?.codes || []).map(code => Number(ranges[code]?.[level]) || 0);
    if (times.length && times.every(Boolean)) out[level] = Math.max(...times);
  }
  return out;
}
// Words of the part not cleared at `level` yet, out of all its words (0 … 1).
export function monsterNewShare(part, ranges = {}, level) {
  const codes = part?.codes || [], sizes = codes.map((code, i) => Math.max(0, Number(part.sizes?.[i]) || 0));
  const total = sizes.reduce((n, x) => n + x, 0);
  const fresh = codes.reduce((n, code, i) => n + (ranges[code]?.[level] ? 0 : total ? sizes[i] : 1), 0);
  return total ? fresh / total : codes.length ? fresh / codes.length : 0;
}
// The first-clear reward of a level: the whole MONSTER_LEVELS[level].first for a part never
// cleared, the share of new words (rounded up) when ranges were added, null when all are cleared.
export function monsterFirstReward(part, ranges = {}, level) {
  const L = MONSTER_LEVELS[level], share = monsterNewShare(part, ranges, level);
  if (!L || share <= 0) return null;
  return share >= 1 ? { ...L.first, share: 1 } : { coins: Math.ceil(L.first.coins * share), xp: Math.ceil(L.first.xp * share), share };
}
// V13.100: a cleared-part key of V13.94–V13.99 (the codes joined by '+') back into its range codes.
// A teacher's range code may hold '+' itself, so the known codes of the grade are matched first
// (longest first); what is left is split at every '+'.
export function partKeyCodes(key, known = []) {
  const bits = String(key || '').split('+'), set = new Set([...known].map(String)), out = [];
  for (let i = 0; i < bits.length;) {
    let j = bits.length;
    while (j > i + 1 && !set.has(bits.slice(i, j).join('+'))) j--;
    out.push(bits.slice(i, j).join('+'));
    i = j;
  }
  return out.filter(Boolean);
}
// Which levels of a part are open: 노말 after 이지, 하드 after 노말 (cleared: { easy, normal, hard },
// from partClears).
export function monsterOpen(cleared = {}, level) {
  return level === 'easy' || (level === 'normal' && !!cleared.easy) || (level === 'hard' && !!cleared.normal);
}
