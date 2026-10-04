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
  { key: 'finalking', name: '수능 대마왕', line: '시험지 갑옷을 입은 마지막 대마왕', color: '#b91c1c', temp: { pet: 'qilin', form: 3, filter: 'hue-rotate(-40deg) saturate(1.6) brightness(.82) contrast(1.1)' } }
];
// Monsters whose own pictures are in public/assets/monsters (<key>.webp, <key>-attack.webp,
// <key>-hurt.webp, <key>-down.webp). V13.95: all nine, cut from the sheets 10-1 … 10-9 (the
// four poses of a sheet at one scale, feet on the floor like the pets). `temp` stays as the
// fallback for a monster added later without pictures.
export const MONSTER_ART = new Set(['slime', 'forgetghost', 'clock', 'golem', 'phone', 'pirate', 'owlnight', 'dictdragon', 'finalking']);
export const MONSTER_POSES = ['attack', 'hurt', 'down'];
export const monsterOf = index => MONSTERS[((index % MONSTERS.length) + MONSTERS.length) % MONSTERS.length];

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
