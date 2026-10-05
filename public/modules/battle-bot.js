import { createBattle, connect, answer, forfeit, tick, battleView, BATTLE, SKILL_RULES } from './battle-engine.js';
import { battleQuestions } from './battle-questions.js';
import { miniDue, miniWords, pickGame, miniBonus, addBonus } from './word-minigame.js';

// V13.66 practice match (연습 상대): a yacha match against a computer pet, run entirely on the
// phone with the same engine as the battle rooms. No stake, no records, no league points;
// it is there for when no friend is around. It talks to the battle screen with the same
// messages a room sends ('view', 'events'), so the screen draws it like any match.

// V13.94: the robot was too easy and a match was over in about a minute. It answers more
// often and faster now, and a practice match has more HP (BOT_HP), so it lasts about 2 minutes
// (실력전 about 2:30). In thousands of simulated matches a student who knows almost every word
// beats 어려움 about half the time; 보통 is for a student who knows most of them.
export const BOT_LEVELS = {
  easy: { name: '쉬움', form: 1, accuracy: .68, min: 2500, max: 6000 },
  normal: { name: '보통', form: 2, accuracy: .84, min: 1600, max: 4200 },
  hard: { name: '어려움', form: 3, accuracy: .95, min: 1000, max: 2700 }
};
export const BOT_HP = 400;
export const BOT_ID = 'practice-bot';
const EMOTE_REPLIES = { lol: 'lol', come: 'come', gg: 'gg', nice: 'nice' };

// The student's own words (at most 40), built like a room builds them (V13.67: by mode).
export function practiceQuestions(words, mode = 'speed') {
  return battleQuestions(words, mode, 40);
}

// V13.67: the practice partner is 로보, a robot pet that grows with the level.
// V13.94 몬스터 잡기 uses the same match with a monster instead of the robot: `foe` (name, pet
// with the monster's skill, `monster`, its own `hp`), `skill` ({ accuracy, min, max } of the
// monster), `hp` (the student's) and `ko` (the monster wins if time runs out).
// V13.104 `minigame`: ({ kind, words, finish }) => cancel. After the reveal of every 6th word a
// short word game may open (word-minigame.js). The match stands still until `finish({ kind,
// stars })` is called (stars 0 = skipped or lost): both clocks and the robot's answer wait, then
// run on for as long as the game took. The prize is only a bonus on the next attacks (or a
// guard), never coins, and the right answers the server pays by (`myRight`) are not touched.
export function createPracticeMatch({ me, questions, level = 'normal', mode = 'speed', onMessage, random = Math.random, foe = null, skill = null, hp = BOT_HP, ko = false, label = '연습 경기', minigame = null }) {
  const lv = skill || BOT_LEVELS[level] || BOT_LEVELS.normal;
  const bot = foe ? { ...foe, id: BOT_ID, bot: true } : { id: BOT_ID, name: `연습 상대 · ${lv.name}`, pet: { key: 'robot', form: lv.form, name: `AI 로보` }, bot: true };
  const state = createBattle({ id: `practice-${Date.now()}`, players: [me, bot], questions, stake: 0, label, mode, hp, timeoutWinner: ko ? BOT_ID : null, now: Date.now() });
  let closed = false, loop = null, botTimer = null, emoteTimer = null;
  // V13.104: `pausedAt` is set while a word game is open; `mini.last` is the last game's kind.
  let pausedAt = null, cancelMini = null;
  const mini = { done: 0, last: null, idx: -1 };
  const now = () => Date.now();
  const deliver = message => { if (!closed) onMessage({ ...message, now: now() }); };
  const emit = events => {
    if (!events.length || closed) return;
    deliver({ type: 'events', events });
    for (const e of events) react(e);
    if (state.phase === 'finished') stop();
  };
  const stop = () => { clearInterval(loop); clearTimeout(botTimer); loop = null; };

  // The bot answers each word after a human-like pause, right or wrong by its level.
  function planAnswer(e) {
    clearTimeout(botTimer);
    const turn = state.turn;
    // A spelling word takes longer to type and is a little harder for the bot too.
    const spell = e.kind === 'spell';
    const delay = spell ? 2600 + (lv.min + random() * (lv.max - lv.min)) * 1.35 : lv.min + random() * (lv.max - lv.min);
    const limit = state.mode === 'skill' ? (spell ? SKILL_RULES.SPELL_TURN_MS : SKILL_RULES.CHOICE_TURN_MS) : BATTLE.TURN_MS;
    if (delay >= limit - 120) return; // too slow: the word times out for the bot
    botTimer = setTimeout(() => {
      if (closed || state.phase !== 'question' || state.turn !== turn || turn.locked[BOT_ID]) return;
      const q = state.questions[turn.q];
      let choice;
      if (q.kind === 'spell') choice = random() < lv.accuracy * .88 ? q.text : `${q.text.slice(0, -1)}${q.text.endsWith('e') ? 'a' : 'e'}`;
      else {
        const wrong = [0, 1, 2, 3].filter(i => i !== q.answer);
        choice = random() < lv.accuracy ? q.answer : wrong[Math.floor(random() * wrong.length)];
      }
      emit(answer(state, BOT_ID, choice, now()));
    }, delay);
  }
  function react(e) {
    if (e.type === 'question') planAnswer(e);
  }
  // V13.104: the reveal of every 6th word is over and the match would go on: a word game may come first.
  function openMini(t) {
    // `mini.idx`: the word a game was already offered after (the reveal is still on when it ends).
    if (!minigame || state.phase !== 'reveal' || t < state.deadline || mini.idx === state.idx) return false;
    const mine = state.players[me.id], theirs = state.players[BOT_ID], asked = state.idx + 1;
    if (!miniDue({ asked, done: mini.done, leftMs: state.ends_at - t, myHp: mine.hp, foeHp: theirs.hp })) return false;
    mini.done++; mini.idx = state.idx;
    const words = miniWords(state.questions, asked, mine.missed || [], random), kind = pickGame(words, mini.last, random);
    if (!kind) return false;
    pausedAt = t;
    clearTimeout(botTimer);
    let answered = false;
    const finish = (result = {}) => { if (!answered && !closed && pausedAt !== null) { answered = true; resumeMini(result.kind || kind, result.stars); } };
    cancelMini = minigame({ kind, words, finish }) || null;
    return true;
  }
  function resumeMini(kind, stars = 0) {
    const t = now(), gap = Math.max(0, t - pausedAt), mine = state.players[me.id];
    pausedAt = null; cancelMini = null;
    mini.last = kind;
    state.ends_at += gap;
    if (state.started_at) state.started_at += gap;
    state.deadline = t;
    const bonus = miniBonus(kind, Math.max(0, Math.min(3, Number(stars) || 0)));
    mine.boost = addBonus(mine.boost, bonus.boost);
    mine.guard = addBonus(mine.guard, bonus.guard);
    const given = bonus.boost.length || bonus.guard.length;
    deliver({ type: 'events', events: [{ type: 'minibonus', seq: ++state.seq, player: me.id, kind, stars: given ? stars : 0, ends_at: state.ends_at, effects: { [me.id]: { boost: [...mine.boost], guard: [...mine.guard], poison: mine.poison || 0 } } }] });
  }

  return {
    id: state.id,
    bot,
    // V13.70 words the student answered right (the server pays the practice reward by it).
    myRight: () => Number(state.players[me.id]?.correct || 0),
    start() {
      connect(state, BOT_ID, now());
      deliver({ type: 'view', view: battleView(state, me.id) });
      emit(connect(state, me.id, now()));
      loop = setInterval(() => { if (closed || pausedAt !== null) return; const t = now(); if (!openMini(t)) emit(tick(state, t)); }, 100);
    },
    send(message) {
      if (closed) return;
      const t = now();
      if (message.type === 'emote') {
        if (!['countdown', 'question', 'reveal'].includes(state.phase)) return;
        deliver({ type: 'events', events: [{ type: 'emote', player: me.id, emote: message.emote }] });
        // The bot sometimes answers an emote with the same one.
        clearTimeout(emoteTimer);
        if (random() < .6 && EMOTE_REPLIES[message.emote]) emoteTimer = setTimeout(() => deliver({ type: 'events', events: [{ type: 'emote', player: BOT_ID, emote: EMOTE_REPLIES[message.emote] }] }), 700 + random() * 800);
        return;
      }
      if (message.type === 'ping' || message.type === 'sync') return;
      // V13.104: while a word game is open the match stands still (only leaving works).
      if (pausedAt !== null) {
        if (message.type !== 'leave') return;
        cancelMini?.(); cancelMini = null; pausedAt = null;
      }
      const events = tick(state, t);
      // V13.99: the word number (idx) as in a battle room, so a late tap is not counted twice.
      if (message.type === 'answer') events.push(...answer(state, me.id, typeof message.choice === 'string' ? message.choice.slice(0, 60) : Number(message.choice), t, Number.isInteger(message.idx) ? message.idx : undefined));
      else if (message.type === 'leave') events.push(...forfeit(state, me.id, t));
      emit(events);
    },
    // V13.104: a word game that is still open is closed with the match.
    close() { closed = true; stop(); clearTimeout(emoteTimer); cancelMini?.(); cancelMini = null; },
    // How many word games opened in this match (for the release check).
    miniCount: () => mini.done
  };
}
