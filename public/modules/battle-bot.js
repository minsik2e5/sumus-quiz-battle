import { createBattle, connect, answer, useSkill, forfeit, tick, battleView, BATTLE, BATTLE_SKILLS } from './battle-engine.js';
import { CHARACTERS, buildQuestion, shuffle } from './core.js';

// V13.66 practice match (연습 상대): a yacha match against a computer pet, run entirely on the
// phone with the same engine as the battle rooms. No stake, no records, no league points;
// it is there for when no friend is around. It talks to the battle screen with the same
// messages a room sends ('view', 'events'), so the screen draws it like any match.

export const BOT_LEVELS = {
  easy: { name: '쉬움', form: 1, accuracy: .58, min: 3000, max: 7000, skill: .25 },
  normal: { name: '보통', form: 2, accuracy: .74, min: 2100, max: 5600, skill: .55 },
  hard: { name: '어려움', form: 3, accuracy: .88, min: 1300, max: 4200, skill: .9 }
};
export const BOT_ID = 'practice-bot';
const EMOTE_REPLIES = { lol: 'lol', come: 'come', gg: 'gg', nice: 'nice' };

// Four-choice questions from the student's own words (at most 40), like a room builds them.
export function practiceQuestions(words) {
  const pool = words.filter(word => word?.id && word.meaning);
  return shuffle(pool).slice(0, 40)
    .map(word => { const q = buildQuestion(word, 'eng2mean_mc', pool); return { word_id: word.id, prompt: q.prompt, options: q.options, answer: q.options.indexOf(word.meaning) }; })
    .filter(q => q.options.length === 4 && q.answer >= 0);
}

export function createPracticeMatch({ me, questions, level = 'normal', onMessage, random = Math.random }) {
  const lv = BOT_LEVELS[level] || BOT_LEVELS.normal;
  const species = Object.keys(CHARACTERS).filter(key => key !== me.pet?.key);
  const key = species[Math.floor(random() * species.length)] || 'cat';
  const bot = { id: BOT_ID, name: `연습 상대 · ${lv.name}`, pet: { key, form: lv.form, name: `AI ${CHARACTERS[key].ko}` }, bot: true };
  const state = createBattle({ id: `practice-${Date.now()}`, players: [me, bot], questions, stake: 0, label: '연습 경기', now: Date.now() });
  let closed = false, loop = null, botTimer = null, skillTimer = null, emoteTimer = null;
  const now = () => Date.now();
  const deliver = message => { if (!closed) onMessage({ ...message, now: now() }); };
  const emit = events => {
    if (!events.length || closed) return;
    deliver({ type: 'events', events });
    for (const e of events) react(e);
    if (state.phase === 'finished') stop();
  };
  const stop = () => { clearInterval(loop); clearTimeout(botTimer); clearTimeout(skillTimer); loop = null; };

  // The bot answers each word after a human-like pause, right or wrong by its level.
  function planAnswer(e) {
    clearTimeout(botTimer);
    const turn = state.turn;
    const frozenFor = Math.max(0, (e.frozen_until?.[BOT_ID] || 0) - now());
    const delay = frozenFor + lv.min + random() * (lv.max - lv.min);
    if (delay >= BATTLE.TURN_MS - 120) return; // too slow: the word times out for the bot
    botTimer = setTimeout(() => {
      if (closed || state.phase !== 'question' || state.turn !== turn || turn.locked[BOT_ID]) return;
      const q = state.questions[turn.q];
      const wrong = [0, 1, 2, 3].filter(i => i !== q.answer);
      const choice = random() < lv.accuracy ? q.answer : wrong[Math.floor(random() * wrong.length)];
      emit(answer(state, BOT_ID, choice, now()));
      planSkill();
    }, delay);
  }
  // Skills: heal when hurt, a power hit when full, now and then a shield or freeze.
  function planSkill() {
    clearTimeout(skillTimer);
    skillTimer = setTimeout(() => {
      if (closed || !['question', 'reveal'].includes(state.phase) || random() > lv.skill) return;
      const b = state.players[BOT_ID], foe = state.players[me.id];
      let pick = null;
      if (b.ki >= BATTLE_SKILLS.heal.cost && b.hp <= 55) pick = 'heal';
      else if (b.ki >= BATTLE_SKILLS.power.cost && !b.power) pick = 'power';
      else if (b.ki >= BATTLE_SKILLS.freeze.cost && !foe.frozen_next && random() < .5) pick = 'freeze';
      else if (b.ki >= BATTLE_SKILLS.shield.cost && !b.shield && foe.hp > b.hp && random() < .4) pick = 'shield';
      if (pick) emit(useSkill(state, BOT_ID, pick, now()));
    }, 350 + random() * 900);
  }
  function react(e) {
    if (e.type === 'question') planAnswer(e);
    if (e.type === 'attack' && e.attacker === me.id) planSkill();
  }

  return {
    id: state.id,
    bot,
    start() {
      connect(state, BOT_ID, now());
      deliver({ type: 'view', view: battleView(state, me.id) });
      emit(connect(state, me.id, now()));
      loop = setInterval(() => { if (!closed) emit(tick(state, now())); }, 100);
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
      const events = tick(state, t);
      if (message.type === 'answer') events.push(...answer(state, me.id, Number(message.choice), t));
      else if (message.type === 'skill') events.push(...useSkill(state, me.id, String(message.skill), t));
      else if (message.type === 'leave') events.push(...forfeit(state, me.id, t));
      emit(events);
    },
    close() { closed = true; stop(); clearTimeout(emoteTimer); }
  };
}
