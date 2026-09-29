import { buildQuestion, shuffle, englishAccepted, normalizeEnglish } from './core.js';

// V13.67: the words of a yacha match, built the same way by the server (battle rooms) and the
// phone (practice match). 스피드전 asks every word as four choices; 실력전 turns every other
// word into a spelling word typed on the in-app keyboard (only words that can be typed there).

const TYPABLE = /^[a-z][a-z' -]*[a-z]$/;
export function spellable(word) {
  const text = normalizeEnglish(word?.word);
  return TYPABLE.test(text) && text.length <= 18 && text.split(' ').length <= 3 && !!String(word?.meaning || '').trim();
}
// "look after" -> "l _ _ _   a _ _ _ _": the first letter of each word, a blank for the rest.
export function spellHint(text) {
  return text.split(' ').map(part => [...part].map((ch, i) => i === 0 || !/[a-z]/.test(ch) ? ch : '_').join('')).join(' ');
}
function choiceQuestion(word, pool) {
  const q = buildQuestion(word, 'eng2mean_mc', pool);
  return { word_id: word.id, prompt: q.prompt, options: q.options, answer: q.options.indexOf(word.meaning) };
}
function spellQuestion(word) {
  const text = normalizeEnglish(word.word);
  return { word_id: word.id, kind: 'spell', prompt: String(word.meaning).trim(), hint: spellHint(text), text, accept: englishAccepted(word.word) };
}
export function battleQuestions(words, mode = 'speed', limit = 40) {
  const pool = words.filter(word => word?.id && word.meaning);
  let spellTurn = false;
  return shuffle(pool).slice(0, limit).map(word => {
    // 실력전: choice, spelling, choice, spelling… (a word that cannot be typed stays a choice).
    if (mode === 'skill' && spellTurn && spellable(word)) { spellTurn = false; return spellQuestion(word); }
    if (mode === 'skill') spellTurn = true;
    return choiceQuestion(word, pool);
  }).filter(q => q.kind === 'spell' || (q.options.length === 4 && q.answer >= 0));
}
