import { shuffle } from './core.js';

// V13.104 단어 미니게임: a 10~15 second game of English words that comes between two words of a
// robot practice match or a monster fight (never a yacha match against a friend: that one needs
// both phones in step). The rules live here without any screen so the release check can run
// them; the screen is word-minigame-ui.js.
//
// The match stops its clocks while a game is open. A game pays no coins, no experience and does
// not count as a right answer: its only prize is a bonus on the next attacks (the `boost` list
// of a pet skill) or a guard, of at most +50% of a normal hit.

export const MINIGAME = {
  EVERY: 6,           // a game after every 6th word ...
  MAX: 2,             // ... at most twice in a match
  MIN_LEFT_MS: 30000, // not when the match has less than this left (fever time is near)
  MIN_WORDS: 6        // words already asked (a game uses only those: no answer is given away)
};
// "공격 +7": a normal hit is 12~16, so +7 is about +50%.
export const MINIGAME_BONUS = {
  3: { count: 3, value: 7 },
  2: { count: 3, value: 4 },
  1: { count: 1, value: 4 }
};
export const MINIGAME_KINDS = {
  tiles: { name: '철자 타일', bonus: 'boost', ms: 15000, line: '글자 타일을 순서대로 눌러 단어를 완성해요' },
  ox: { name: 'O/X 연타', bonus: 'boost', ms: 12000, line: '뜻이 맞으면 오른쪽, 틀리면 왼쪽을 연타해요' },
  bomb: { name: '단어 폭탄 해제', bonus: 'guard', ms: 15000, line: '뜻에 맞는 단어 카드를 연속 5번 눌러요' }
};
export const TILE_WORDS = 2, BOMB_COMBO = 5;

// What a game result gives: { boost: [7, 7, 7] } for the attack games, { guard: [...] } for the bomb.
export function miniBonus(kind, stars) {
  const rule = MINIGAME_BONUS[stars], type = MINIGAME_KINDS[kind]?.bonus;
  if (!rule || !type) return { boost: [], guard: [] };
  const list = Array.from({ length: rule.count }, () => rule.value);
  return { boost: type === 'boost' ? list : [], guard: type === 'guard' ? list : [] };
}
// Adds a bonus to what a player already has waiting (a pet skill's list), place by place.
export function addBonus(list = [], extra = []) {
  const out = [];
  for (let i = 0; i < Math.max(list.length, extra.length); i++) out.push((list[i] || 0) + (extra[i] || 0));
  return out;
}
export const bonusText = (kind, stars) => {
  const b = miniBonus(kind, stars), list = b.boost.length ? b.boost : b.guard;
  if (!list.length) return '';
  return `${b.boost.length ? '공격 강화' : '방어막'} ${b.boost.length ? '+' : '−'}${list[0]}${list.length > 1 ? ` ×${list.length}` : ''}`;
};

// Is a game due now? `asked`: words asked so far, `done`: games already played in this match.
export function miniDue({ asked, done, leftMs, myHp, foeHp }) {
  return asked >= MINIGAME.MIN_WORDS && asked % MINIGAME.EVERY === 0 && done < MINIGAME.MAX
    && leftMs > MINIGAME.MIN_LEFT_MS && myHp > 0 && foeHp > 0;
}

// The words a game may use: those of the questions already asked (`upto` = number of questions
// asked), the ones the player missed first. A word has its meaning and some confusing wrong
// meanings (the wrong choices of its own question, made the way battle-questions makes them).
export function miniWords(questions, upto, missed = [], random = Math.random) {
  const seen = new Set(), list = [];
  for (const q of (questions || []).slice(0, Math.max(0, upto))) {
    const spell = q.kind === 'spell';
    const word = String(spell ? q.text : q.prompt || '').trim(), meaning = String(spell ? q.prompt : q.options?.[q.answer] || '').trim();
    if (!word || !meaning || seen.has(word.toLowerCase())) continue;
    seen.add(word.toLowerCase());
    list.push({ id: q.word_id, word, meaning, decoys: spell ? [] : (q.options || []).filter((_, i) => i !== q.answer && q.options[i] && q.options[i] !== meaning), missed: missed.includes(q.word_id) });
  }
  return [...shuffle(list.filter(w => w.missed), random), ...shuffle(list.filter(w => !w.missed), random)];
}
const lettersOnly = w => /^[a-z]{4,8}$/.test(w.word.toLowerCase());
// Which games can be played with these words (and which not twice in a row).
export function pickGame(words, last = null, random = Math.random) {
  const ok = [];
  if (words.filter(lettersOnly).length >= TILE_WORDS) ok.push('tiles');
  if (words.length >= 4) ok.push('ox');
  if (new Set(words.map(w => w.meaning)).size >= 4 && words.length >= 4) ok.push('bomb');
  const fresh = ok.filter(kind => kind !== last);
  const pool = fresh.length ? fresh : ok;
  return pool.length ? pool[Math.floor(random() * pool.length)] : null;
}
// A wrong meaning for a word: one of its own wrong choices, or the meaning of another word.
export function decoyOf(word, words, random = Math.random) {
  const own = word.decoys.filter(d => d && d !== word.meaning);
  if (own.length) return own[Math.floor(random() * own.length)];
  const others = words.filter(w => w.meaning !== word.meaning).map(w => w.meaning);
  return others.length ? others[Math.floor(random() * others.length)] : null;
}

/* ---------- 1. 철자 타일 ---------- */
// Two words, 15 seconds. The meaning is on top, the letters are scattered; the next right letter
// must be pressed. A wrong tile costs 1 second.
export function createTiles(words, random = Math.random) {
  const picked = shuffle(words.filter(lettersOnly), random).slice(0, TILE_WORDS);
  const g = { kind: 'tiles', limit: MINIGAME_KINDS.tiles.ms, penalty: 0, mistakes: 0, round: 0, done: 0, pos: 0, rounds: picked, finished: false, last: null };
  const deal = () => {
    const word = picked[g.round]?.word.toLowerCase() || '';
    let tiles = [...word].map((ch, id) => ({ id, ch, used: false }));
    // Never deal the word already in order.
    for (let n = 0; n < 8 && tiles.length > 1; n++) { const s = shuffle(tiles, random); tiles = s; if (s.map(t => t.ch).join('') !== word) break; }
    g.tiles = tiles; g.target = word; g.pos = 0;
  };
  g.press = (index, elapsed) => {
    if (g.finished) return 'end';
    const tile = g.tiles[index];
    if (!tile || tile.used) return 'none';
    if (tile.ch === g.target[g.pos]) {
      tile.used = true; g.pos++;
      if (g.pos === g.target.length) {
        g.done++; g.round++;
        if (g.round >= picked.length) { g.finished = true; g.elapsed = elapsed; return 'win'; }
        deal(); return 'word';
      }
      return 'right';
    }
    g.mistakes++; g.penalty += 1000;
    return 'wrong';
  };
  g.left = elapsed => Math.max(0, g.limit - elapsed - g.penalty);
  g.stars = () => g.done >= picked.length ? (g.mistakes === 0 ? 3 : g.mistakes <= 2 ? 2 : 1) : g.done >= 1 ? 1 : 0;
  deal();
  return g;
}

/* ---------- 2. O/X 좌우 연타 ---------- */
// An English word and a meaning, again and again for 12 seconds: right (the meaning is of the
// word) or left (it is not). Score = right answers − wrong answers.
export function createOx(words, random = Math.random) {
  const g = { kind: 'ox', limit: MINIGAME_KINDS.ox.ms, right: 0, wrong: 0, finished: false, last: null, deck: [] };
  g.next = () => {
    if (!g.deck.length) g.deck = shuffle(words, random);
    let word = g.deck.shift();
    if (g.current && word.word === g.current.word.word && g.deck.length) { g.deck.push(word); word = g.deck.shift(); }
    const decoy = decoyOf(word, words, random), truth = decoy === null || random() < .5;
    g.current = { word, shown: truth ? word.meaning : decoy, truth };
    return g.current;
  };
  g.answer = said => {
    if (g.finished || !g.current) return 'end';
    const ok = said === g.current.truth;
    ok ? g.right++ : g.wrong++;
    g.last = { word: g.current.word.word, meaning: g.current.word.meaning, ok };
    g.next();
    return ok ? 'right' : 'wrong';
  };
  g.score = () => g.right - g.wrong;
  g.stars = () => g.score() >= 7 ? 3 : g.score() >= 4 ? 2 : g.score() >= 2 ? 1 : 0;
  g.next();
  return g;
}

/* ---------- 3. 단어 폭탄 해제 ---------- */
// The meaning on top, 4 word cards below: press the card of that meaning. 5 right in a row
// defuse the bomb in 15 seconds; a wrong card starts again from 0.
export function createBomb(words, random = Math.random) {
  const g = { kind: 'bomb', limit: MINIGAME_KINDS.bomb.ms, combo: 0, mistakes: 0, finished: false, won: false, last: null, deck: [] };
  g.next = () => {
    if (!g.deck.length) g.deck = shuffle(words, random);
    let target = g.deck.shift();
    if (g.target && target.word === g.target.word && g.deck.length) { g.deck.push(target); target = g.deck.shift(); }
    // Cards of another word that has the same meaning would be right too: leave them out.
    const others = shuffle(words.filter(w => w.word !== target.word && w.meaning !== target.meaning), random).slice(0, 3);
    g.target = target;
    g.cards = shuffle([target, ...others], random).map(w => w.word);
    return g.target;
  };
  g.press = (index, elapsed) => {
    if (g.finished) return 'end';
    const word = g.cards[index];
    if (word === undefined) return 'none';
    if (word === g.target.word) {
      g.combo++;
      if (g.combo >= BOMB_COMBO) { g.finished = g.won = true; g.elapsed = elapsed; return 'win'; }
      g.next(); return 'right';
    }
    g.combo = 0; g.mistakes++;
    g.last = { word: g.target.word, meaning: g.target.meaning };
    g.next();
    return 'wrong';
  };
  g.stars = () => !g.won ? 0 : g.elapsed <= 9000 ? 3 : g.elapsed <= 13000 ? 2 : 1;
  g.next();
  return g;
}

export const createGame = (kind, words, random = Math.random) => kind === 'tiles' ? createTiles(words, random) : kind === 'ox' ? createOx(words, random) : kind === 'bomb' ? createBomb(words, random) : null;
