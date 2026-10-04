// Release checks for V13.104: 단어 미니게임 (철자 타일 · O/X 연타 · 폭탄 해제) between two words of
// a robot practice match or a monster fight. The rules live in public/modules/word-minigame.js
// and the match in public/modules/battle-bot.js; the screen is word-minigame-ui.js.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { BATTLE, PET_SKILLS } from '../public/modules/battle-engine.js';
import { createPracticeMatch, BOT_ID } from '../public/modules/battle-bot.js';
import { MONSTER_LEVELS } from '../public/modules/monsters.js';
import {
  MINIGAME, MINIGAME_BONUS, MINIGAME_KINDS, BOMB_COMBO, TILE_WORDS, miniBonus, addBonus, bonusText, miniDue, miniWords, pickGame, decoyOf,
  createTiles, createOx, createBomb, createGame
} from '../public/modules/word-minigame.js';

const source = path => readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8');
// mulberry32: a small seed gives a well mixed first number too.
const seeded = seed => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

const PAIRS = [
  ['apple', '사과'], ['river', '강'], ['bridge', '다리'], ['castle', '성'], ['garden', '정원'], ['market', '시장'], ['window', '창문'], ['planet', '행성'],
  ['pencil', '연필'], ['mirror', '거울'], ['ticket', '표'], ['island', '섬'], ['forest', '숲'], ['jacket', '재킷'], ['kitchen', '부엌'], ['look after', '돌보다'],
  ['museum', '박물관'], ['pocket', '주머니'], ['rainbow', '무지개'], ['silver', '은'], ['tunnel', '터널'], ['violin', '바이올린'], ['winter', '겨울'], ['yellow', '노란']
];
// Four-choice questions the way battle-questions makes them: the wrong choices are other meanings.
const questions = PAIRS.map(([word, meaning], i) => {
  const wrong = [1, 2, 3].map(k => PAIRS[(i + k * 5) % PAIRS.length][1]);
  const options = [...wrong.slice(0, i % 4), meaning, ...wrong.slice(i % 4)];
  return { word_id: `w${i}`, prompt: word, options, answer: options.indexOf(meaning) };
});
// A spelling word of the 실력전 (the meaning is the prompt).
questions[3] = { word_id: 'w3', kind: 'spell', prompt: PAIRS[3][1], hint: 'c _ _ _ _ _', text: 'castle', accept: ['castle'] };

export async function runMinigameChecks(assert) {
  /* ---------- the prize ---------- */
  const hit = BATTLE.HIT;
  assert(MINIGAME_BONUS[3].value <= Math.round(hit * .6) && MINIGAME_BONUS[3].count === 3 && MINIGAME_BONUS[2].value < MINIGAME_BONUS[3].value && MINIGAME_BONUS[1].count < MINIGAME_BONUS[2].count, 'V13.104 the best prize is about +50% of a normal hit (+7 of 12~16) for 3 attacks, and smaller for fewer stars');
  assert(miniBonus('tiles', 3).boost.join() === '7,7,7' && miniBonus('ox', 2).boost.join() === '4,4,4' && miniBonus('tiles', 1).boost.join() === '4' && miniBonus('bomb', 3).guard.join() === '7,7,7' && miniBonus('bomb', 3).boost.length === 0 && miniBonus('tiles', 3).guard.length === 0, 'V13.104 the attack games give a boost and the bomb game a guard');
  assert(miniBonus('tiles', 0).boost.length === 0 && miniBonus('bomb', 0).guard.length === 0 && miniBonus('nothing', 3).boost.length === 0 && miniBonus('tiles', 9).boost.length === 0, 'V13.104 no stars (skipped or lost), an unknown game or stars out of range give nothing');
  assert(addBonus([16], [7, 7, 7]).join() === '23,7,7' && addBonus([], [4]).join() === '4' && addBonus([9, 9], []).join() === '9,9', 'V13.104 a prize is added to the pet skill bonus still waiting, place by place');
  assert(bonusText('tiles', 3) === '공격 강화 +7 ×3' && bonusText('bomb', 1) === '방어막 −4' && bonusText('tiles', 0) === '', 'V13.104 the prize is written in words');
  const ownerPets = Object.values(PET_SKILLS).map(s => (s.boost || []).reduce((a, b) => a + b, 0)).filter(Boolean);
  assert(Math.max(...ownerPets) >= 16 && MINIGAME.EVERY >= 2 * 3 && MINIGAME.MAX === 2, 'V13.104 a game comes after every 6th word (at most twice a match), less often than a pet skill (every 3rd right word)');

  /* ---------- when ---------- */
  const due = (over = {}) => miniDue({ asked: 6, done: 0, leftMs: 90000, myHp: 200, foeHp: 200, ...over });
  assert(due() && due({ asked: 12, done: 1 }) && !due({ asked: 5 }) && !due({ asked: 7 }) && !due({ asked: 18, done: 2 }) && !due({ leftMs: MINIGAME.MIN_LEFT_MS }) && !due({ myHp: 0 }) && !due({ foeHp: 0 }), 'V13.104 a game is due after the 6th and 12th word, not in the last 30 seconds, not twice more than twice, not when someone is knocked out');

  /* ---------- the words ---------- */
  const rng = seeded(7);
  const missedWords = miniWords(questions, 10, ['w8', 'w2'], rng);
  assert(missedWords.length === 10 && missedWords.slice(0, 2).every(w => w.missed) && new Set(missedWords.map(w => w.id)).size === 10 && missedWords.every(w => Number(w.id.slice(1)) < 10), 'V13.104 a game uses only words already asked (no answer of a coming word is given away), the missed ones first');
  const sample = missedWords.find(w => w.id === 'w1'), spelled = missedWords.find(w => w.id === 'w3');
  assert(sample.decoys.length === 3 && sample.decoys.every(d => d !== sample.meaning) && spelled.word === 'castle' && spelled.meaning === '성' && spelled.decoys.length === 0, 'V13.104 the wrong meanings of a word are the wrong choices of its own question; a spelling word has none of its own');
  assert(miniWords(questions, 0, []).length === 0 && miniWords([{ word_id: 'x', prompt: 'dup', options: ['가', '나', '다', '라'], answer: 0 }, { word_id: 'y', prompt: 'DUP', options: ['가', '나', '다', '라'], answer: 0 }], 2).length === 1, 'V13.104 no words before the first question, and a word is used once');
  const words = miniWords(questions, 10, [], seeded(3));
  const kinds = new Set();
  for (let i = 0; i < 60; i++) kinds.add(pickGame(words, null, seeded(i + 1)));
  assert(['tiles', 'ox', 'bomb'].every(k => kinds.has(k)), 'V13.104 all three games come up');
  let again = false;
  for (let i = 0; i < 90; i++) { const a = pickGame(words, 'ox', seeded(i + 11)); if (a === 'ox') again = true; }
  assert(!again && pickGame(words.slice(0, 1), null) === null && pickGame(words.filter(w => !/^[a-z]{4,8}$/.test(w.word)), null) !== 'tiles' && pickGame(words.filter(w => /^[a-z]{4,8}$/.test(w.word)).slice(0, 1), 'ox', seeded(2)) !== 'tiles', 'V13.104 the same game never comes twice in a row; with too few words (or too few single words) the games that cannot be played are left out');
  assert(words.every(w => { const d = decoyOf(w, words, seeded(5)); return d && d !== w.meaning; }) && decoyOf({ word: 'a', meaning: '가', decoys: [] }, [{ word: 'b', meaning: '가', decoys: [] }]) === null, 'V13.104 a wrong meaning is never the meaning itself');

  /* ---------- 1. 철자 타일 ---------- */
  const tiles = createTiles(words, seeded(9));
  const sorted = g => [...g.target].map(ch => g.tiles.findIndex(t => t.ch === ch && !t.used && !g.__taken?.has(t.id)));
  const play = (g, indexOf) => { const out = []; for (const ch of g.target) { const i = g.tiles.findIndex(t => t.ch === ch && !t.used); out.push(g.press(i, 5000)); } return out; };
  assert(tiles.rounds.length === TILE_WORDS && tiles.rounds.every(w => /^[a-z]{4,8}$/.test(w.word)) && tiles.tiles.map(t => t.ch).join('') !== tiles.target && [...tiles.tiles.map(t => t.ch)].sort().join('') === [...tiles.target].sort().join(''), 'V13.104 철자 타일 deals the letters of a 4~8 letter word, not in order');
  const wrongIndex = tiles.tiles.findIndex(t => t.ch !== tiles.target[0]);
  const w1 = tiles.press(wrongIndex, 1000);
  assert(w1 === 'wrong' && tiles.mistakes === 1 && tiles.penalty === 1000 && tiles.left(2000) === tiles.limit - 2000 - 1000 && tiles.pos === 0 && tiles.press(wrongIndex, 1200) === 'wrong', 'V13.104 a wrong tile costs 1 second and does not move on');
  const outs1 = play(tiles, null);
  assert(outs1.at(-1) === 'word' && tiles.done === 1 && tiles.round === 1 && tiles.pos === 0 && !tiles.finished, 'V13.104 the first word done goes on to the second');
  const outs2 = play(tiles, null);
  assert(outs2.at(-1) === 'win' && tiles.finished && tiles.done === 2 && tiles.stars() === 2 && tiles.press(0, 9000) === 'end', 'V13.104 both words done = a win (2 stars with 2 wrong tiles)');
  const clean = createTiles(words, seeded(4));
  play(clean, null); play(clean, null);
  const half = createTiles(words, seeded(4)); play(half, null);
  const none = createTiles(words, seeded(4));
  assert(clean.stars() === 3 && half.stars() === 1 && none.stars() === 0, 'V13.104 철자 타일 stars: 3 with no wrong tile, 1 with one word, 0 with none');
  const twin = createTiles([{ id: 'a', word: 'letter', meaning: '편지', decoys: [] }, { id: 'b', word: 'little', meaning: '작은', decoys: [] }], seeded(1));
  const twinOut = play(twin, null);
  assert(twinOut.every(o => o !== 'wrong' && o !== 'none') && twin.done === 1 && twin.target === 'little' || twin.done === 1 && twin.target === 'letter', 'V13.104 a word with the same letter twice (letter, little) works with any tile of that letter');

  /* ---------- 2. O/X 연타 ---------- */
  const ox = createOx(words, seeded(21));
  let seenTrue = 0, seenFalse = 0, ok = true;
  for (let i = 0; i < 80; i++) {
    const c = ox.current;
    if (c.truth) { seenTrue++; ok &&= c.shown === c.word.meaning; } else { seenFalse++; ok &&= c.shown !== c.word.meaning && !!c.shown; }
    ox.answer(c.truth); // always right
  }
  assert(ok && seenTrue > 15 && seenFalse > 15 && ox.right === 80 && ox.wrong === 0, 'V13.104 O/X pairs are half right and half a confusing wrong meaning, and the right answer scores');
  const o2 = createOx(words, seeded(22));
  const first = o2.current.truth; const res = o2.answer(!first);
  assert(res === 'wrong' && o2.wrong === 1 && o2.last.ok === false && o2.last.meaning && o2.score() === -1, 'V13.104 a wrong O/X answer counts against the score and shows the right pair');
  const stars = n => { const g = createOx(words, seeded(23)); for (let i = 0; i < n; i++) g.answer(g.current.truth); return g.stars(); };
  assert(stars(1) === 0 && stars(2) === 1 && stars(4) === 2 && stars(7) === 3, 'V13.104 O/X stars: 2 → 1 star, 4 → 2, 7 → 3 (right minus wrong)');
  const pairs = []; const o3 = createOx(words, seeded(24)); for (let i = 0; i < 40; i++) { pairs.push(o3.current.word.word); o3.answer(o3.current.truth); }
  assert(pairs.every((w, i) => i === 0 || w !== pairs[i - 1]), 'V13.104 the same word does not come twice in a row in O/X');

  /* ---------- 3. 폭탄 해제 ---------- */
  const bomb = createBomb(words, seeded(31));
  let cardsOk = true;
  for (let i = 0; i < 40; i++) {
    const meanings = bomb.cards.map(w => words.find(x => x.word === w).meaning);
    cardsOk &&= bomb.cards.length === 4 && new Set(bomb.cards).size === 4 && bomb.cards.includes(bomb.target.word) && meanings.filter(m => m === bomb.target.meaning).length === 1;
    bomb.next();
  }
  assert(cardsOk, 'V13.104 폭탄 해제 shows 4 different word cards, only one of the meaning (a card with the same meaning is never a wrong card)');
  const press = (g, right, at = 3000) => g.press(right ? g.cards.indexOf(g.target.word) : g.cards.findIndex(w => w !== g.target.word), at);
  const b2 = createBomb(words, seeded(32));
  press(b2, true); press(b2, true); press(b2, true);
  assert(b2.combo === 3 && press(b2, false) === 'wrong' && b2.combo === 0 && b2.mistakes === 1 && b2.last.meaning, 'V13.104 a wrong card starts again from 0 and shows the right pair');
  let last; for (let i = 0; i < BOMB_COMBO; i++) last = press(b2, true, 8000);
  assert(last === 'win' && b2.won && b2.finished && b2.stars() === 3 && press(b2, true) === 'end', 'V13.104 5 right in a row defuse the bomb (8 seconds = 3 stars)');
  const b3 = createBomb(words, seeded(33)); for (let i = 0; i < 5; i++) press(b3, true, 12000);
  const b4 = createBomb(words, seeded(34)); for (let i = 0; i < 5; i++) press(b4, true, 14500);
  const b5 = createBomb(words, seeded(35)); press(b5, true);
  assert(b3.stars() === 2 && b4.stars() === 1 && b5.stars() === 0, 'V13.104 폭탄 해제 stars: 3 within 9 seconds, 2 within 13, 1 later, 0 when the time ran out');
  assert(createGame('tiles', words)?.kind === 'tiles' && createGame('ox', words)?.kind === 'ox' && createGame('bomb', words)?.kind === 'bomb' && createGame('x', words) === null && ['tiles', 'ox', 'bomb'].every(k => MINIGAME_KINDS[k].ms >= 12000 && MINIGAME_KINDS[k].ms <= 15000), 'V13.104 three games of 12~15 seconds');

  /* ---------- the match stands still while a game is open ---------- */
  const real = { now: Date.now, si: globalThis.setInterval, ci: globalThis.clearInterval, st: globalThis.setTimeout, ct: globalThis.clearTimeout };
  const sandbox = (minigame, extra = {}) => {
    let clock = 5_000_000, loopFn = null, nextId = 1, timers = [];
    Date.now = () => clock;
    globalThis.setInterval = fn => { loopFn = fn; return 1; };
    globalThis.clearInterval = () => { loopFn = null; };
    globalThis.setTimeout = (fn, ms) => { const id = nextId++; timers.push({ id, fn, at: clock + ms }); return id; };
    globalThis.clearTimeout = id => { timers = timers.filter(t => t.id !== id); };
    const messages = [];
    const match = createPracticeMatch({ me: { id: 'me', name: '가온', pet: { key: 'dog', form: 1 } }, questions, level: 'normal', onMessage: m => messages.push(m), random: seeded(12), minigame, ...extra });
    const events = () => messages.filter(m => m.type === 'events').flatMap(m => m.events);
    const advance = ms => { for (let spent = 0; spent < ms; spent += 100) { clock += 100; for (const t of timers.filter(t => t.at <= clock)) { timers = timers.filter(x => x !== t); t.fn(); } loopFn?.(); } };
    // Answers the open word right (in the questions list: the word at `idx`).
    const answerRight = () => {
      const q = events().filter(e => e.type === 'question').at(-1), real = questions[q.idx % questions.length];
      match.send({ type: 'answer', choice: real.kind === 'spell' ? real.text : real.answer, idx: q.idx });
    };
    // Plays words until `n` have been asked and their reveal is on screen.
    const playTo = n => { for (let guard = 0; guard < 400; guard++) { const qs = events().filter(e => e.type === 'question'); const st = events().at(-1); if (qs.length >= n && events().some(e => e.type === 'reveal' || e.type === 'miss') && events().filter(e => e.type === 'reveal' || e.type === 'miss').length >= n) return; if (qs.length && !events().filter(e => e.type === 'attack' && e.attacker === 'me').some(e => e.seq > qs.at(-1).seq)) answerRight(); advance(100); } };
    return { match, messages, events, advance, playTo, now: () => clock, restore: () => Object.assign(globalThis, { setInterval: real.si, clearInterval: real.ci, setTimeout: real.st, clearTimeout: real.ct }, {}) && (Date.now = real.now) };
  };
  try {
    // a) without the option (the yacha match code path) nothing stops
    const plain = sandbox(null);
    plain.match.start(); plain.advance(3200); plain.playTo(6); plain.advance(2000);
    assert(plain.events().filter(e => e.type === 'question').length >= 7 && !plain.events().some(e => e.type === 'minibonus') && plain.match.miniCount() === 0, 'V13.104 without the minigame option (yacha rooms, older callers) the match never stops');
    plain.match.close();

    // b) with it: stops after the 6th word, clocks wait, prize comes with the end
    const calls = [];
    const s = sandbox(offer => { calls.push(offer); return () => calls.push('cancelled'); });
    s.match.start(); s.advance(3200); s.playTo(6); s.advance(1600);
    const rightBefore = s.match.myRight(), endsBefore = s.events().filter(e => e.type === 'start').at(-1).ends_at, qCount = s.events().filter(e => e.type === 'question').length;
    assert(calls.length === 1 && calls[0].words.length === 6 && ['tiles', 'ox', 'bomb'].includes(calls[0].kind) && typeof calls[0].finish === 'function' && s.match.miniCount() === 1 && qCount === 6, 'V13.104 after the 6th word\'s reveal the match asks for a word game with the 6 words asked');
    s.advance(30000);
    s.match.send({ type: 'answer', choice: 0, idx: 5 }); s.match.send({ type: 'emote', emote: 'gg' });
    assert(s.events().filter(e => e.type === 'question').length === qCount && !s.events().some(e => e.type === 'end') && s.match.myRight() === rightBefore, 'V13.104 for 30 seconds of game the match stands still: no new word, no end, no answer taken');
    const kind = calls[0].kind, isBoost = MINIGAME_KINDS[kind].bonus === 'boost';
    calls[0].finish({ kind, stars: 3 });
    calls[0].finish({ kind, stars: 3 });
    const bonus = s.events().filter(e => e.type === 'minibonus');
    assert(bonus.length === 1 && bonus[0].stars === 3 && bonus[0].ends_at >= endsBefore + 30000 && bonus[0].ends_at <= endsBefore + 34000 && (isBoost ? bonus[0].effects.me.boost.join() === '7,7,7' : bonus[0].effects.me.guard.join() === '7,7,7'), 'V13.104 the match clock is moved on by the length of the game and the prize shows (once, even if finished twice)');
    s.advance(300);
    assert(s.events().filter(e => e.type === 'question').length === qCount + 1, 'V13.104 the next word comes at once when the game is over');
    if (isBoost) { s.answerRight?.(); }
    // the prize is used by the next attack
    const q7 = s.events().filter(e => e.type === 'question').at(-1);
    const real7 = questions[q7.idx % questions.length];
    s.match.send({ type: 'answer', choice: real7.kind === 'spell' ? real7.text : real7.answer, idx: q7.idx });
    const atk = s.events().filter(e => e.type === 'attack' && e.attacker === 'me').at(-1);
    // (the dog's skill of the 6th right word may still be waiting: the prize is added to it, not instead of it)
    const waiting = bonus[0].effects.me.boost[0] || 0;
    assert(atk.boost === waiting && (isBoost ? waiting >= 7 : true), 'V13.104 the next attack of mine gets the prize on top of a pet skill bonus still waiting (a guard game adds no attack bonus)');
    assert(s.match.myRight() === rightBefore + 1, 'V13.104 a game gives no right answer (the count the server pays by only grows with words answered)');
    s.match.close();

    // c) skipping or losing gives nothing; the game is not played again at once; at most twice
    const calls2 = [];
    const t = sandbox(offer => { calls2.push(offer); return null; });
    t.match.start(); t.advance(3200); t.playTo(6); t.advance(1600);
    calls2[0].finish({ kind: calls2[0].kind, stars: 0 });
    const skipped = t.events().filter(e => e.type === 'minibonus');
    const beforeSkip = t.events().filter(e => e.effects?.me && e.type !== 'minibonus').at(-1).effects.me;
    assert(skipped.length === 1 && skipped[0].stars === 0 && skipped[0].effects.me.boost.join() === beforeSkip.boost.join() && skipped[0].effects.me.guard.join() === beforeSkip.guard.join(), 'V13.104 skipping gives no prize (what the pet skill had waiting stays as it was)');
    t.advance(300);
    assert(t.events().filter(e => e.type === 'question').length === 7 && t.events().filter(e => e.type === 'question').at(-1).idx === 6, 'V13.104 and the match goes on with the next word');
    t.match.close();

    // d) a pet skill's bonus still waiting is kept, not lost
    const u = sandbox(offer => { calls2.push(offer); return null; });
    u.match.start(); u.advance(3200); u.playTo(6); u.advance(1600);
    const callU = calls2.at(-1);
    callU.finish({ kind: callU.kind, stars: 2 });
    const effect = u.events().filter(e => e.type === 'minibonus').at(-1).effects.me;
    assert((effect.boost.length || effect.guard.length) && [...effect.boost, ...effect.guard].every(v => v >= 4), 'V13.104 a 2-star prize is 3 × 4');
    u.match.close();

    // e) leaving or closing during a game closes it
    const cancels = [];
    const v = sandbox(() => () => cancels.push('x'));
    v.match.start(); v.advance(3200); v.playTo(6); v.advance(1600);
    v.match.send({ type: 'leave' });
    assert(cancels.length === 1 && v.events().some(e => e.type === 'end' && e.result.reason === 'forfeit'), 'V13.104 leaving the match during a game closes the game and ends the match');
    v.match.close();
    const w = sandbox(() => () => cancels.push('y'));
    w.match.start(); w.advance(3200); w.playTo(6); w.advance(1600);
    w.match.close();
    assert(cancels.length === 2 && cancels[1] === 'y', 'V13.104 closing the match closes an open game');
  } finally {
    Date.now = real.now; globalThis.setInterval = real.si; globalThis.clearInterval = real.ci; globalThis.setTimeout = real.st; globalThis.clearTimeout = real.ct;
  }

  /* ---------- reward judging is not touched ---------- */
  const logic = source('../public/modules/word-minigame.js'), ui = source('../public/modules/word-minigame-ui.js'), bot = source('../public/modules/battle-bot.js');
  const battleUi = source('../public/modules/battle.js'), rewardsServer = source('./rewards.mjs'), service = source('./service.mjs'), room = source('../cloudflare/battle-room.mjs');
  assert(!/\bapi\(|rewards\.js|\bcoins\s*:|\bxp\s*:/.test(logic + ui) && !/minigame|miniBonus|minibonus/i.test(rewardsServer + service + room) && !/\.correct\s*(\+\+|\+=)/.test(bot.slice(bot.indexOf('function openMini'), bot.indexOf('return {', bot.indexOf('function resumeMini')))), 'V13.104 a game pays no coins or experience, sends nothing to the server and does not count as a right answer; the server and the battle room know nothing of it');
  assert(!/correct/.test(bot.slice(bot.indexOf('function openMini'), bot.indexOf('return {', bot.indexOf('function resumeMini')))) && bot.includes('myRight: () => Number(state.players[me.id]?.correct || 0)'), 'V13.104 the right answers the server pays by are still the engine\'s own count');
  assert((battleUi.match(/createPracticeMatch\(/g) || []).length === 2 && (battleUi.match(/minigame: miniGameHook/g) || []).length === 2 && battleUi.includes('if (B.mini) { B.raf = requestAnimationFrame(frame); return; }') && battleUi.includes("e.type === 'minibonus'") && battleUi.includes("import { openMiniGame } from './word-minigame-ui.js'"), 'V13.104 the robot practice match and the monster fight (the only two matches run on the phone) open the games; the match clock under the card stands still');
  assert(MONSTER_LEVELS.hard.mode === 'skill' && bot.includes('state.ends_at += gap') && bot.includes('state.deadline = t') && bot.includes("if (message.type !== 'leave') return;"), 'V13.104 the monster must still be beaten in time: the game time is added to the match time');

  /* ---------- screen ---------- */
  const css = source('../public/v13104.css'), build = source('./build-assets.mjs'), sw = source('../public/sw.js');
  assert(build.includes('"v13104.css"') && sw.includes('/modules/word-minigame.js') && sw.includes('/modules/word-minigame-ui.js') && css.includes('.mg-overlay{position:fixed') && css.includes('align-items:flex-end') && css.includes('@media (min-width:700px)') && css.includes('@media (max-height:520px)'), 'V13.104 the screen is in the bundle and the app cache: a sheet at the bottom of a phone, a card on a pad, smaller on a low screen');
  assert(css.includes('@media (prefers-reduced-motion:reduce)') && css.includes('.mg-calm *{animation:none!important') && ui.includes("reduced ? ' mg-calm' : ''") && battleUi.includes('reduced: reduced()') && css.includes('.mg-tile.bad::after{content:"✕"') && css.includes('min-height:60px') && css.includes('min-height:96px'), 'V13.104 움직임 줄이기 turns off every movement (a wrong tile is marked with ✕, not only shaken) and the buttons are large for one thumb');
  assert((ui.match(/data-mg="skip"/g) || []).length >= 2 && ui.includes("setAttribute('aria-modal', 'true')") && ui.includes("key === 'Escape'") && ui.includes('data-mg="start"') && ui.includes('경기 시간은 멈춰 있어요') && ui.includes('코인은 걸려 있지 않아요'), 'V13.104 skipping is always possible (the top button, the intro and Esc); the intro says the clock stands still and no coins are at stake');
}
