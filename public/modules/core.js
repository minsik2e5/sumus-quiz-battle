export const EXAM_TYPES = {
  eng2mean_mc: { label: '영어 → 뜻 객관식', help: '영어를 보고 뜻 고르기', input: false },
  mean2eng_mc: { label: '뜻 → 영어 객관식', help: '뜻을 보고 영어 고르기', input: false },
  write_en: { label: '영어쓰기', help: '뜻을 보고 영어 직접 쓰기', input: true },
  write_meaning: { label: '뜻쓰기', help: '영어를 보고 뜻 직접 쓰기', input: true }
};
// Shared class roster used by teacher assignment forms. Keep values stable so
// student visibility (school + class match) remains deterministic.
export const CLASS_OPTIONS = ['고1A', '고1B', '중3', '중2'];
export const PRACTICE_TYPES = {
  write_meaning: '뜻 직접 쓰기', mixed: '골고루 연습', eng2mean: '영어 → 뜻', mean2eng: '뜻 → 영어',
  spell: '영어 철자 입력', listen: '듣기', scramble: '철자 배열', vowelblank: '모음 빈칸', initial: '첫 글자 힌트'
};
export const CHARACTERS = {
  lumi: { name: 'LUMI', ko: '루미', type: '별빛 여우', color: '#BD792E', light: '#F4CA87', soft: '#F7EEE0' },
  nox: { name: 'NOX', ko: '녹스', type: '나이트 캣', color: '#716297', light: '#C4B5DD', soft: '#F0EBF6' },
  blaze: { name: 'BLAZE', ko: '블레이즈', type: '플레임 울프', color: '#B96853', light: '#EEB197', soft: '#F9ECE6' },
  tide: { name: 'TIDE', ko: '타이드', type: '아쿠아 링크스', color: '#4C8499', light: '#A5D1DE', soft: '#E9F3F5' },
  zeph: { name: 'ZEPH', ko: '제프', type: '스카이 팔콘', color: '#5D8C84', light: '#B5D9CF', soft: '#ECF3EF' },
  terra: { name: 'TERRA', ko: '테라', type: '아이언 베어', color: '#7A825B', light: '#C5CDA3', soft: '#F1F1E5' }
};
export const ACCESSORIES = {
  none: { name: '기본', level: 1 }, headset: { name: '헤드셋', level: 3 }, glasses: { name: '포커스 글래스', level: 6 },
  starpin: { name: '스타 핀', level: 9 }, visor: { name: '바이저', level: 13 }, crown: { name: '크라운', level: 18 }
};
export const FRAMES = { basic: { name: '기본', level: 1 }, silver: { name: '실버', level: 5 }, neon: { name: '블루 라인', level: 10 }, aurora: { name: '오로라', level: 15 }, legend: { name: '골드', level: 20 } };
export const TITLES = { rookie: { name: '첫걸음', level: 1 }, focus: { name: '집중의 힘', level: 5 }, combo: { name: '10연속의 주인공', combo: 10 }, streak: { name: '7일의 기록', streak: 7 }, master: { name: '단어 마스터', level: 15 }, legend: { name: '한계를 넘어서', level: 20 } };
export const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
export function levelInfo(points = 0) {
  let level = 1, base = 0, need = 180;
  points = Math.max(0, Number(points) || 0);
  while (level < 50 && points >= base + need) { base += need; level++; need = 180 + (level - 1) * 70; }
  const current = level === 50 ? need : points - base;
  return { level, current, need, percent: clamp(current / need * 100, 0, 100), remaining: Math.max(0, need - current), stage: level >= 20 ? 5 : level >= 15 ? 4 : level >= 10 ? 3 : level >= 5 ? 2 : 1 };
}
export const unlocked = (item, growth) => !!item && (!item.level || growth.level >= item.level) && (!item.combo || growth.best_combo >= item.combo) && (!item.streak || growth.streak >= item.streak);
export function displayEnglish(raw) {
  return String(raw ?? '').normalize('NFKC').replace(/\([^)]*\)|\[[^\]]*\]/g, '').replace(/[*~～]/g, '').replace(/\s+/g, ' ').trim();
}
export function normalizeEnglish(raw) {
  return displayEnglish(raw).toLowerCase().replace(/[‘’]/g, "'").replace(/[‐‑–—]/g, '-').replace(/^[.,;:!?]+|[.,;:!?]+$/g, '').trim();
}
export function englishAccepted(raw) {
  const values = [normalizeEnglish(raw)];
  for (const m of String(raw).matchAll(/\((?:pl\.?|plural)\s*[:.]?\s*([^)]*)\)/gi)) values.push(...m[1].split(/[,;/]/).map(normalizeEnglish));
  return [...new Set(values.filter(Boolean))];
}
export function normalizeMeaning(raw) {
  return String(raw ?? '').normalize('NFKC').toLowerCase().replace(/[~～·•・.,;:!?()[\]{}"'‘’“”]/g, '').replace(/\s+/g, '').trim();
}
function meaningParts(raw) {
  const original = String(raw ?? '').normalize('NFKC');
  const text = original.replace(/\([^)]*\)|\[[^\]]*\]/g, '');
  return [...new Set([original, text, ...text.split(/[,;；，/\n]|또는/)].map(value => value.trim()).filter(Boolean))];
}
const SAFE_MEANING_GROUPS = [
  ['만족한', '흡족한'],
  ['알아보다', '인식하다', '알아차리다'],
  ['요구하다', '필요로 하다'],
  ['감소하다', '줄어들다'],
  ['감소시키다', '줄이다'],
  ['증가하다', '늘어나다'],
  ['증가시키다', '늘리다'],
  ['선택하다', '고르다'],
  ['구매하다', '사다'],
  ['판매하다', '팔다'],
  ['돕다', '도와주다', '도움을 주다'],
  ['보호하다', '지키다'],
  ['포함하다', '포함시키다'],
  ['제외하다', '빼다'],
  ['발생하다', '일어나다', '생기다'],
  ['끝내다', '마치다'],
  ['사용하다', '이용하다'],
  ['비슷한', '유사한'],
  ['신뢰할 수 있는', '믿을 수 있는', '믿을 만한'],
  ['회상하다', '기억해 내다'],
  ['독립적으로', '스스로'],
  ['궁극적으로', '결국']
].map(group => group.map(normalizeMeaning));

const SAFE_MEANING_LOOKUP = (() => {
  const lookup = new Map();
  for (const group of SAFE_MEANING_GROUPS) {
    for (const value of group) lookup.set(value, group);
  }
  return lookup;
})();

function addPredicateFamily(set, raw, includeBare = false) {
  const value = normalizeMeaning(raw);
  if (!value) return;
  set.add(value);
  const add = (...values) => values.filter(Boolean).forEach(item => set.add(item));

  if (value.endsWith('하다') && value.length > 2) {
    const stem = value.slice(0, -2);
    add(stem + '하다', stem + '한', stem + '하는', stem + '하기', stem + '함', stem + '하여', stem + '해서');
    if (includeBare) add(stem);
    return;
  }
  if (value.endsWith('하는') && value.length > 2) {
    const stem = value.slice(0, -2);
    add(stem + '하다', stem + '한', stem + '하는', stem + '하기', stem + '함');
    return;
  }
  if (value.endsWith('한것') && value.length > 2) {
    const stem = value.slice(0, -2);
    add(stem + '하다', stem + '한', stem + '하는');
    return;
  }
  if (value.endsWith('한') && value.length > 1) {
    const stem = value.slice(0, -1);
    add(stem + '하다', stem + '한', stem + '하는');
    return;
  }
  if ((value.endsWith('하여') || value.endsWith('해서')) && value.length > 2) {
    const stem = value.slice(0, -2);
    add(stem + '하다', stem + '한', stem + '하는');
    return;
  }

  if (value.endsWith('되다') && value.length > 2) {
    const stem = value.slice(0, -2);
    add(stem + '되다', stem + '된', stem + '되는', stem + '되어', stem + '돼');
    if (includeBare) add(stem);
    return;
  }
  if (value.endsWith('되는') && value.length > 2) {
    const stem = value.slice(0, -2);
    add(stem + '되다', stem + '된', stem + '되는');
    return;
  }
  if (value.endsWith('된') && value.length > 1) {
    const stem = value.slice(0, -1);
    add(stem + '되다', stem + '된', stem + '되는');
    return;
  }

  if (value.endsWith('시키다') && value.length > 3) {
    const stem = value.slice(0, -3);
    add(stem + '시키다', stem + '시키는', stem + '시킨');
    return;
  }
  if (value.endsWith('시키는') && value.length > 3) {
    const stem = value.slice(0, -3);
    add(stem + '시키다', stem + '시키는', stem + '시킨');
    return;
  }
  if (value.endsWith('시킨') && value.length > 2) {
    const stem = value.slice(0, -2);
    add(stem + '시키다', stem + '시키는', stem + '시킨');
    return;
  }

  if (value.endsWith('있다') && value.length > 2) {
    const stem = value.slice(0, -2);
    add(stem + '있다', stem + '있는');
    return;
  }
  if (value.endsWith('있는') && value.length > 2) {
    const stem = value.slice(0, -2);
    add(stem + '있다', stem + '있는');
    return;
  }
  if (value.endsWith('없다') && value.length > 2) {
    const stem = value.slice(0, -2);
    add(stem + '없다', stem + '없는');
    return;
  }
  if (value.endsWith('없는') && value.length > 2) {
    const stem = value.slice(0, -2);
    add(stem + '없다', stem + '없는');
    return;
  }

  if (value.endsWith('적이다') && value.length > 3) {
    const stem = value.slice(0, -2);
    add(stem, stem + '이다', stem + '인');
    return;
  }
  if (value.endsWith('적인') && value.length > 2) {
    const stem = value.slice(0, -1);
    add(stem, stem + '이다', stem + '인');
    return;
  }
  if (value.endsWith('스럽다') && value.length > 3) {
    const stem = value.slice(0, -3);
    add(stem + '스럽다', stem + '스러운');
    return;
  }
  if (value.endsWith('스러운') && value.length > 3) {
    const stem = value.slice(0, -3);
    add(stem + '스럽다', stem + '스러운');
  }
}
function stripMeaningParticle(raw) {
  const value = normalizeMeaning(raw);
  if (value.length < 3) return value;
  for (const suffix of ['으로는','로는','에게는','에서는','부터는','까지는','은','는','이','가','을','를','도','만']) {
    if (value.endsWith(suffix) && value.length > suffix.length + 1) return value.slice(0, -suffix.length);
  }
  return value;
}
export function automaticMeaningAccepted(raw) {
  const accepted = new Set();
  for (const part of meaningParts(raw)) {
    const normalized = normalizeMeaning(part);
    addPredicateFamily(accepted, normalized, normalized.endsWith('하다') || normalized.endsWith('되다'));
    const group = SAFE_MEANING_LOOKUP.get(normalized);
    if (group) for (const alias of group) addPredicateFamily(accepted, alias, alias.endsWith('하다') || alias.endsWith('되다'));
  }
  return [...accepted];
}
export function meaningAccepted(raw, aliases = []) {
  const accepted = new Set(automaticMeaningAccepted(raw));
  for (const alias of Array.isArray(aliases) ? aliases : []) {
    addPredicateFamily(accepted, alias, true);
  }
  return [...accepted];
}
export function grade(type, answer, word) {
  if (typeof answer !== 'string' || !answer.trim()) return false;
  if (type === 'write_en' || ['spell', 'scramble', 'vowelblank', 'initial'].includes(type)) return englishAccepted(word.word).includes(normalizeEnglish(answer));
  if (type === 'write_meaning') {
    const accepted = new Set(meaningAccepted(word.meaning, word.accepted_meanings));
    const input = normalizeMeaning(answer);
    const candidates = new Set();
    addPredicateFamily(candidates, input, false);
    const withoutParticle = stripMeaningParticle(input);
    if (withoutParticle !== input) addPredicateFamily(candidates, withoutParticle, false);
    return [...candidates].some(value => accepted.has(value));
  }
  return answer === (type === 'mean2eng_mc' || type === 'mean2eng' ? displayEnglish(word.word) : word.meaning);
}
export function shuffle(values, random = Math.random) {
  const result = [...values];
  for (let i = result.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [result[i], result[j]] = [result[j], result[i]]; }
  return result;
}
export function buildQuestion(word, type, pool) {
  const isEn = ['mean2eng_mc', 'mean2eng', 'write_en', 'spell', 'scramble', 'vowelblank', 'initial'].includes(type);
  let prompt = isEn ? word.meaning : displayEnglish(word.word);
  let hint = '';
  if (type === 'vowelblank') hint = displayEnglish(word.word).replace(/[aeiou]/gi, '＿');
  if (type === 'initial') hint = displayEnglish(word.word).split(' ').map(s => s[0] + '＿'.repeat(Math.max(0, s.length - 1))).join(' ');
  if (type === 'scramble') hint = shuffle([...displayEnglish(word.word)]).join(' · ');
  if (type === 'listen') prompt = '';
  const mc = ['eng2mean_mc', 'mean2eng_mc', 'eng2mean', 'mean2eng', 'listen'].includes(type);
  const value = w => isEn ? displayEnglish(w.word) : w.meaning;
  const correct = value(word);
  const options = mc ? shuffle([correct, ...shuffle([...new Set(pool.filter(w => w.id !== word.id).map(value))].filter(v => v !== correct)).slice(0, 3)]) : [];
  return { word_id: word.id, type, prompt, hint, options, ...(type === 'listen' ? { audio: displayEnglish(word.word) } : {}) };
}
export function choosePracticeWord(words, mastery, state, random = Math.random) {
  const due = state.retry.findIndex(r => r.at <= state.total);
  if (due >= 0) { const retry = state.retry.splice(due, 1)[0]; return words.find(w => w.id === retry.id); }
  const candidates = words.filter(w => w.id !== state.last && !state.retry.some(r => r.id === w.id));
  const pool = candidates.length ? candidates : words;
  const weighted = pool.map(w => ({ w, weight: 1 + (100 - (mastery[w.id]?.mastery || 0)) / 20 + Math.min(4, mastery[w.id]?.wrong || 0) }));
  let roll = random() * weighted.reduce((n, v) => n + v.weight, 0);
  return (weighted.find(v => (roll -= v.weight) <= 0) || weighted.at(-1)).w;
}
const dayFormatter = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' });
export const dayKey = ts => dayFormatter.format(new Date(ts));
export function growthFor(sessions) {
  const points = sessions.reduce((n, s) => n + (s.xp || 0), 0);
  const days = new Set(sessions.filter(s => s.total > 0).map(s => dayKey(s.created_at)));
  let streak = 0, day = Date.now();
  if (!days.has(dayKey(day))) day -= 86400000;
  while (days.has(dayKey(day))) { streak++; day -= 86400000; }
  return { ...levelInfo(points), points, streak, best_combo: Math.max(0, ...sessions.map(s => s.best_combo || 0)) };
}
