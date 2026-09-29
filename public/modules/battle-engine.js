// Yacha battle: a 1:1 word duel. Rules only — no transport, no clock of its own.
// Every function takes `now` (ms) and returns the events to broadcast, so the battle
// room (a Durable Object), the practice match on the phone (public/modules/battle-bot.js,
// V13.66) and the release check drive it the same way.
// The state is plain JSON and can be stored between WebSocket messages.

export const BATTLE = {
  MATCH_MS: 90000,     // one match
  TURN_MS: 8000,       // one word
  REVEAL_MS: 1400,     // pause after a word is resolved
  COUNTDOWN_MS: 3000,  // after both players are connected
  RECONNECT_MS: 15000, // a dropped player may come back within this
  MAX_HP: 100,
  MAX_KI: 5,
  FAST_MS: 2000,       // answers faster than this are critical and give 2 ki
  HIT: 12,             // damage of a correct answer
  SPEED_BONUS: 0.5,    // extra damage per second left on the word
  CRIT: 1.25,          // a fast answer multiplies the damage
  FREEZE_MS: 2000,
  HEAL: 20,
  FEVER_MS: 15000,     // the last 15 seconds of a match are fever time
  FEVER_MULT: 1.5,     // hits in fever time do 1.5x damage
  REVIEW_MAX: 20       // words listed per player on the result screen
};
export const BATTLE_SKILLS = {
  shield: { cost: 2, name: '방패' },
  heal: { cost: 3, name: '회복' },
  freeze: { cost: 4, name: '얼리기' },
  power: { cost: 5, name: '필살기' }
};

const other = (state, pid) => state.order.find(id => id !== pid);

// players: [{ id, name, pet, streak, title, tier, bot }] (host first);
// questions: [{ word_id, prompt, options[4], answer }]. `label` names a match that is not an
// ordinary one ('대회 8강', '연습 경기').
export function createBattle({ id, players, questions, stake = 0, label = null, now }) {
  if (players.length !== 2 || players[0].id === players[1].id) throw Error('battle needs two different players');
  if (!questions.length) throw Error('battle needs questions');
  return {
    id, stake, label: label || null, created_at: now, phase: 'waiting', seq: 0,
    order: players.map(p => p.id),
    players: Object.fromEntries(players.map(p => [p.id, {
      id: p.id, name: p.name, pet: p.pet || null, streak: Number(p.streak || 0), title: p.title || null, tier: p.tier || null, bot: !!p.bot,
      hp: BATTLE.MAX_HP, ki: 0, shield: false, power: false, frozen_next: false,
      connected: false, dropped_at: null, correct: 0, answer_ms: 0, skills_used: 0, missed: []
    }])),
    questions, idx: -1, turn: null,
    started_at: null, ends_at: null, deadline: null, result: null
  };
}

function event(state, type, data = {}) { state.seq++; return { type, seq: state.seq, ...data }; }

function questionEvent(state) {
  const q = state.questions[state.turn.q];
  return event(state, 'question', { n: state.idx + 1, prompt: q.prompt, options: q.options, started_at: state.turn.started_at, deadline: state.deadline, frozen_until: state.turn.frozen_until });
}

function nextQuestion(state, now) {
  const alive = state.order.every(id => state.players[id].hp > 0);
  if (!alive || now >= state.ends_at) return finish(state, now, 'end');
  state.idx++;
  const frozen_until = {};
  for (const id of state.order) {
    if (state.players[id].frozen_next) { frozen_until[id] = now + BATTLE.FREEZE_MS; state.players[id].frozen_next = false; }
  }
  state.turn = { q: state.idx % state.questions.length, started_at: now, locked: {}, hits: 0, frozen_until, resolved: false };
  state.phase = 'question';
  state.deadline = now + BATTLE.TURN_MS;
  return [questionEvent(state)];
}

// Words a player got wrong or let run out, for review after the match.
function markMissed(state, pid) {
  const p = state.players[pid], wordId = state.questions[state.turn.q]?.word_id;
  p.missed ||= [];
  if (wordId && !p.missed.includes(wordId) && p.missed.length < BATTLE.REVIEW_MAX) p.missed.push(wordId);
}
export const inFever = (state, now) => !!state.ends_at && state.ends_at - now <= BATTLE.FEVER_MS;

function finish(state, now, reason, loserId = null) {
  state.phase = 'finished';
  state.deadline = null;
  const [a, b] = state.order.map(id => state.players[id]);
  let winner = null;
  if (loserId) winner = other(state, loserId);
  else if (a.hp !== b.hp) winner = a.hp > b.hp ? a.id : b.id;
  const review = Object.fromEntries(state.order.map(id => [id, (state.players[id].missed || []).map(wordId => {
    const q = state.questions.find(item => item.word_id === wordId);
    return q ? { word_id: wordId, word: q.prompt, meaning: q.options[q.answer] } : null;
  }).filter(Boolean)]));
  state.result = { winner, loser: winner ? other(state, winner) : null, reason, stake: state.stake, finished_at: now, hp: { [a.id]: a.hp, [b.id]: b.hp }, review };
  return [event(state, 'end', { result: state.result })];
}

function reveal(state, now) {
  state.turn.resolved = true;
  state.phase = 'reveal';
  state.deadline = now + BATTLE.REVEAL_MS;
}

// V13.59: every player who answers a word correctly attacks, not only the fastest.
// Speed adds a little damage; accuracy decides the match. The word stays open until
// both players have answered or its time runs out, and the answer is revealed only then.
function attack(state, attackerId, ms, now) {
  const attacker = state.players[attackerId], defender = state.players[other(state, attackerId)];
  const fast = ms < BATTLE.FAST_MS;
  attacker.ki = Math.min(BATTLE.MAX_KI, attacker.ki + (fast ? 2 : 1));
  attacker.correct++; attacker.answer_ms += ms;
  state.turn.locked[attackerId] = true;
  state.turn.hits = (state.turn.hits || 0) + 1;
  let dmg = BATTLE.HIT + Math.round(Math.max(0, BATTLE.TURN_MS - ms) / 1000 * BATTLE.SPEED_BONUS);
  if (fast) dmg = Math.round(dmg * BATTLE.CRIT);
  const fever = inFever(state, now);
  if (fever) dmg = Math.round(dmg * BATTLE.FEVER_MULT);
  const powered = attacker.power, shielded = defender.shield;
  if (powered) { dmg *= 2; attacker.power = false; }
  if (shielded) { dmg = Math.round(dmg / 2); defender.shield = false; }
  defender.hp = Math.max(0, defender.hp - dmg);
  const events = [event(state, 'attack', { attacker: attacker.id, defender: defender.id, dmg, fast, fever, powered, shielded, ms, hp: { [attacker.id]: attacker.hp, [defender.id]: defender.hp }, ki: { [attacker.id]: attacker.ki, [defender.id]: defender.ki } })];
  if (state.order.every(id => state.turn.locked[id])) events.push(...settle(state, now, false));
  return events;
}

// Closes a word: everyone has answered or its time ran out. Players who did not
// answer lose their ki; the answer is revealed to both.
function settle(state, now, timeout) {
  for (const id of state.order) {
    if (state.turn.locked[id]) continue;
    state.players[id].ki = 0;
    if (timeout) markMissed(state, id);
  }
  reveal(state, now);
  const answer = state.questions[state.turn.q].answer;
  return [event(state, state.turn.hits ? 'reveal' : 'miss', { timeout, answer })];
}

export function connect(state, pid, now) {
  const p = state.players[pid];
  if (!p) throw Object.assign(Error('이 대결의 참가자가 아니에요.'), { status: 403 });
  p.connected = true; p.dropped_at = null;
  const events = [event(state, 'presence', { player: pid, connected: true })];
  if (state.phase === 'waiting' && state.order.every(id => state.players[id].connected)) {
    state.phase = 'countdown';
    state.deadline = now + BATTLE.COUNTDOWN_MS;
    events.push(event(state, 'countdown', { deadline: state.deadline }));
  }
  return events;
}

export function disconnect(state, pid, now) {
  const p = state.players[pid];
  // A socket can report both an error and a close; only the first starts the grace period.
  if (!p || !p.connected || state.phase === 'finished') return [];
  p.connected = false; p.dropped_at = now;
  return [event(state, 'presence', { player: pid, connected: false, grace_until: now + BATTLE.RECONNECT_MS })];
}

// Leaving on purpose ends the match at once as a loss.
export function forfeit(state, pid, now) {
  if (!state.players[pid] || state.phase === 'finished') return [];
  if (state.phase === 'waiting') return finish(state, now, 'cancelled');
  return finish(state, now, 'forfeit', pid);
}

export function answer(state, pid, choice, now) {
  const p = state.players[pid], turn = state.turn;
  // Answers after the deadline do not count, even if the room has not woken up yet.
  if (!p || state.phase !== 'question' || !turn || turn.resolved || now >= state.deadline) return [];
  if (turn.locked[pid]) return [];
  if ((turn.frozen_until[pid] || 0) > now) return [];
  if (!Number.isInteger(choice) || choice < 0 || choice > 3) return [];
  const q = state.questions[turn.q];
  if (choice === q.answer) return attack(state, pid, now - turn.started_at, now);
  turn.locked[pid] = true;
  p.ki = 0;
  markMissed(state, pid);
  const events = [event(state, 'wrong', { player: pid, ki: 0 })];
  if (state.order.every(id => turn.locked[id])) events.push(...settle(state, now, false));
  return events;
}

export function useSkill(state, pid, skill, now) {
  const p = state.players[pid], rule = BATTLE_SKILLS[skill];
  if (!p || !rule || !['question', 'reveal'].includes(state.phase) || now >= state.deadline || p.ki < rule.cost) return [];
  const foe = state.players[other(state, pid)];
  if (skill === 'shield' && p.shield) return [];
  if (skill === 'power' && p.power) return [];
  if (skill === 'heal' && p.hp >= BATTLE.MAX_HP) return [];
  if (skill === 'freeze' && foe.frozen_next) return [];
  p.ki -= rule.cost; p.skills_used++;
  if (skill === 'shield') p.shield = true;
  if (skill === 'power') p.power = true;
  if (skill === 'heal') p.hp = Math.min(BATTLE.MAX_HP, p.hp + BATTLE.HEAL);
  if (skill === 'freeze') foe.frozen_next = true;
  return [event(state, 'skill', { player: pid, skill, ki: p.ki, hp: p.hp })];
}

// Advances timers: countdown, word timeout, reveal pause, and dropped players.
export function tick(state, now) {
  const events = [];
  for (let guard = 0; guard < 8 && state.phase !== 'finished'; guard++) {
    const dropped = state.order.find(id => !state.players[id].connected && state.players[id].dropped_at !== null && now - state.players[id].dropped_at >= BATTLE.RECONNECT_MS);
    if (dropped && state.phase !== 'waiting') { events.push(...finish(state, now, 'disconnect', dropped)); break; }
    if (state.deadline === null || now < state.deadline) break;
    // Timers restart from `now`, not from the missed deadline: if the room wakes up
    // late, a word still gets its full time instead of expiring unseen.
    if (state.phase === 'countdown') {
      state.started_at = now;
      state.ends_at = now + BATTLE.MATCH_MS;
      events.push(event(state, 'start', { ends_at: state.ends_at }));
      events.push(...nextQuestion(state, now));
    } else if (state.phase === 'question') events.push(...settle(state, now, true));
    else if (state.phase === 'reveal') events.push(...nextQuestion(state, now));
    else break;
  }
  return events;
}

// When the room should wake up next (word deadline or a dropped player's grace end).
export function nextWake(state) {
  if (state.phase === 'finished') return null;
  // Before the match starts a dropped player only matters to the room's connect deadline.
  const graceEnds = state.phase === 'waiting' ? [] : state.order.map(id => state.players[id].dropped_at === null ? null : state.players[id].dropped_at + BATTLE.RECONNECT_MS);
  const times = [state.deadline, ...graceEnds].filter(t => t !== null);
  return times.length ? Math.min(...times) : null;
}

// What a (re)connecting player needs to draw the screen. Never includes the answer
// of an open word.
export function battleView(state, pid) {
  const turn = state.turn, q = turn ? state.questions[turn.q] : null;
  return {
    id: state.id, me: pid, phase: state.phase, seq: state.seq, stake: state.stake, label: state.label || null,
    order: state.order, started_at: state.started_at, ends_at: state.ends_at, deadline: state.deadline, fever_ms: BATTLE.FEVER_MS,
    players: Object.fromEntries(state.order.map(id => {
      const p = state.players[id];
      return [id, { id, name: p.name, pet: p.pet, streak: p.streak || 0, title: p.title || null, tier: p.tier || null, bot: !!p.bot, hp: p.hp, ki: p.ki, shield: p.shield, power: p.power, frozen_next: p.frozen_next, connected: p.connected }];
    })),
    question: q && ['question', 'reveal'].includes(state.phase) ? {
      n: state.idx + 1, prompt: q.prompt, options: q.options, started_at: turn.started_at,
      frozen_until: turn.frozen_until, locked: !!turn.locked[pid], answer: state.phase === 'reveal' ? q.answer : undefined
    } : null,
    result: state.result
  };
}
