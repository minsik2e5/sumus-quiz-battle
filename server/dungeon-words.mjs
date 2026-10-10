// V13.128 던전 문제 (docs/dungeon-design.md 3번): 학생 한 명의 던전 문제 풀을 만든다.
// 엔진(server/dungeon-engine.mjs)은 { word_id, prompt, meaning, wrong: [5개 이상], wrong_en } 목록을 받아
// 층마다 보기 4 · 5 · 6개를 뽑으므로, 여기서 단어마다 오답 뜻 5개를 미리 붙인다.
// V13.130: 뜻을 보고 영어를 고르는 문제를 위해 영어 오답 5개(wrong_en)도 붙인다(같은 품사 · 비슷한 길이의 영어).
// 오답은 전체 단어장에서 같은 품사 · 비슷한 길이의 뜻을 고른다(품사가 없는 단어는 길이만).
// 학생이 정한 범위는 그대로 두고 던전의 문제 풀만 넓힌다(dungeonPool: 앞쪽 범위 → 추가 단어 → 틀린 단어).
import { displayEnglish } from '../public/modules/core.js';
import { dungeonPool, DUNGEON } from './dungeon-engine.mjs';

export const DUNGEON_WRONG = 5;     // 단어마다 붙이는 오답 뜻 (보기 6개 = 정답 1 + 오답 5)
export const DUNGEON_POOL_MAX = 180; // 한 판(7~9분)에 한 학생이 푸는 문제는 150개를 넘지 않는다

const meaningOf = w => String(w?.meaning ?? '').trim();
const posOf = w => String(w?.part_of_speech ?? '').trim().toLowerCase().replace(/\.$/, '');
// 같은 뜻으로 인정되는 말(accepted_meanings)과 같은 오답은 보기로 쓰지 않는다.
const acceptedOf = w => new Set([meaningOf(w), ...(Array.isArray(w?.accepted_meanings) ? w.accepted_meanings.map(x => String(x).trim()) : [])].filter(Boolean));

// 오답 후보 목록(전체 단어장). 같은 뜻은 한 번만.
export function distractorIndex(words) {
  const seen = new Set(), all = [], byPos = new Map();
  for (const w of words || []) {
    const meaning = meaningOf(w);
    if (!meaning || seen.has(meaning)) continue;
    seen.add(meaning);
    const item = { meaning, pos: posOf(w), len: meaning.length };
    all.push(item);
    if (item.pos) { if (!byPos.has(item.pos)) byPos.set(item.pos, []); byPos.get(item.pos).push(item); }
  }
  return { all, byPos };
}

// 단어 하나의 오답 뜻 n개: 같은 품사 → 길이 차이 2 이내를 먼저, 모자라면 길이 차이를 넓히고, 그래도
// 모자라면 품사와 상관없이 채운다.
export function pickWrong(word, index, random = Math.random, n = DUNGEON_WRONG) {
  const avoid = acceptedOf(word), len = meaningOf(word).length, pos = posOf(word), out = [];
  const take = list => {
    for (let i = list.length - 1; i > 0 && out.length < n; i--) { const j = Math.floor(random() * (i + 1)); [list[i], list[j]] = [list[j], list[i]]; }
    for (const item of list) { if (out.length >= n) break; if (!avoid.has(item.meaning) && !out.includes(item.meaning)) out.push(item.meaning); }
  };
  const groups = [pos && index.byPos.get(pos), index.all].filter(Boolean);
  for (const group of groups) for (const gap of [2, 5, Infinity]) { if (out.length >= n) return out; take(group.filter(item => Math.abs(item.len - len) <= gap)); }
  return out;
}

// V13.130 영어 오답 후보(전체 단어장). 같은 영어는 한 번만.
const englishOf = w => displayEnglish(w?.word ?? '').trim();
export function englishIndex(words) {
  const seen = new Set(), all = [], byPos = new Map();
  for (const w of words || []) {
    const en = englishOf(w), low = en.toLowerCase();
    if (!en || seen.has(low)) continue;
    seen.add(low);
    const item = { en, low, pos: posOf(w), len: en.length, meaning: meaningOf(w) };
    all.push(item);
    if (item.pos) { if (!byPos.has(item.pos)) byPos.set(item.pos, []); byPos.get(item.pos).push(item); }
  }
  return { all, byPos };
}
// 단어 하나의 영어 오답 n개: 뜻이 같거나 같은 영어는 빼고, 같은 품사 → 길이 차이 2 · 4 이내를 먼저 고른다.
export function pickWrongEnglish(word, index, random = Math.random, n = DUNGEON_WRONG) {
  const self = englishOf(word).toLowerCase(), avoid = acceptedOf(word), len = englishOf(word).length, pos = posOf(word), out = [];
  const take = list => {
    for (let i = list.length - 1; i > 0 && out.length < n; i--) { const j = Math.floor(random() * (i + 1)); [list[i], list[j]] = [list[j], list[i]]; }
    for (const item of list) { if (out.length >= n) break; if (item.low !== self && !avoid.has(item.meaning) && !out.some(x => x.toLowerCase() === item.low)) out.push(item.en); }
  };
  const groups = [pos && index.byPos.get(pos), index.all].filter(Boolean);
  for (const group of groups) for (const gap of [2, 4, Infinity]) { if (out.length >= n) return out; take(group.filter(item => Math.abs(item.len - len) <= gap)); }
  return out;
}

// 엔진 문제 하나. 오답이 5개보다 적으면(단어장이 아주 작을 때) null. 영어 오답이 모자라면 wrong_en 없이
// 보내고, 엔진은 그 단어를 영어 고르기 대신 뜻 고르기로 낸다.
export function dungeonQuestion(word, index, random = Math.random, enIndex = null) {
  const meaning = meaningOf(word), prompt = displayEnglish(word?.word ?? '');
  if (!meaning || !prompt || word?.id === undefined) return null;
  const wrong = pickWrong(word, index, random);
  if (wrong.length < DUNGEON_WRONG) return null;
  const wrong_en = enIndex ? pickWrongEnglish(word, enIndex, random) : [];
  return { word_id: String(word.id), prompt, meaning, wrong, ...(wrong_en.length >= DUNGEON_WRONG ? { wrong_en } : {}) };
}

const shuffled = (list, random) => { const out = list.slice(); for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; } return out; };

// 한 학생의 던전 문제 풀. own: 고른 범위 단어, earlier: 앞쪽 범위(가까운 범위부터), extra: 나머지 단어장,
// wrong: 틀린 적 있는 단어, all: 오답을 뽑을 전체 단어장. 결과 순서가 곧 문제 순서라 섞어서 돌려준다.
// 고른 범위가 POOL_MAX보다 크면 그 안에서 무작위로 고른다(한 판에 다 풀지 못한다).
export function dungeonQuestions({ own = [], earlier = [], extra = [], wrong = [], all = [] }, random = Math.random) {
  const source = all.length ? all : [...own, ...earlier, ...extra];
  const index = distractorIndex(source), enIndex = englishIndex(source);
  const build = list => list.map(w => dungeonQuestion(w, index, random, enIndex)).filter(Boolean);
  const mine = build(shuffled(own, random)).slice(0, DUNGEON_POOL_MAX);
  const { pool, ok, short } = dungeonPool({ own: mine, earlier: build(earlier), extra: build(shuffled(extra, random)), wrong: build(wrong) });
  const own_count = pool.filter(q => q.source === 'own').length;
  return { questions: shuffled(pool, random).map(({ source, ...q }) => q), ok, short, own: own_count, min: DUNGEON.POOL_MIN };
}
