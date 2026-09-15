import { meaningAccepted, normalizeMeaning } from '../public/modules/core.js';

function editDistance(a, b) {
  const left = [...String(a || '')], right = [...String(b || '')];
  const row = Array.from({ length: right.length + 1 }, (_, i) => i);
  for (let i = 1; i <= left.length; i++) {
    let prev = row[0]; row[0] = i;
    for (let j = 1; j <= right.length; j++) {
      const old = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (left[i - 1] === right[j - 1] ? 0 : 1));
      prev = old;
    }
  }
  return row[right.length];
}

function stem(raw) {
  let value = normalizeMeaning(raw);
  const suffixes = ['하는것', '하는일', '한것', '합니다', '하였다', '했다', '한다', '하다', '되다', '된다', '시키다', '이다', '인것', '하는', '됨', '함'];
  for (const suffix of suffixes) {
    if (value.length > suffix.length + 1 && value.endsWith(suffix)) {
      value = value.slice(0, -suffix.length);
      break;
    }
  }
  return value;
}

export function meaningReviewCandidate(answer, expected) {
  const a = normalizeMeaning(answer);
  if (!a || a.length < 2) return false;
  const accepted = meaningAccepted(expected).map(normalizeMeaning).filter(Boolean);
  if (accepted.includes(a)) return false;
  const aStem = stem(a);
  return accepted.some(b => {
    if (!b || b.length < 2) return false;
    const max = Math.max(a.length, b.length), min = Math.min(a.length, b.length);
    if (min >= 3 && Math.abs(a.length - b.length) <= 3 && (a.includes(b) || b.includes(a))) return true;
    const similarity = 1 - editDistance(a, b) / max;
    if (max >= 4 && similarity >= 0.72) return true;
    const bStem = stem(b);
    return aStem.length >= 2 && bStem.length >= 2 && (aStem === bStem || (Math.min(aStem.length, bStem.length) >= 2 && (aStem.startsWith(bStem) || bStem.startsWith(aStem))));
  });
}
