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
  FAST_MS: 2000,       // answers faster than this are critical hits
  HIT: 12,             // damage of a correct answer
  SPEED_BONUS: 0.5,    // extra damage per second left on the word
  CRIT: 1.25,          // a fast answer multiplies the damage
  FEVER_MS: 15000,     // the last 15 seconds of a match are fever time
  FEVER_MULT: 1.5,     // hits in fever time do 1.5x damage
  REVIEW_MAX: 20       // words listed per player on the result screen
};
// V13.67 modes. 스피드전 is the original match (four choices, speed hits harder). 실력전 mixes
// in spelling words typed on an in-app keyboard: a spelled word hits hardest, speed adds only
// a little and there are no critical hits, so knowing the word decides the match.
export const BATTLE_MODES = {
  speed: { name: '스피드전', desc: '4지선다 · 빠를수록 세게', match_ms: 90000 },
  skill: { name: '실력전', desc: '철자 쓰기 섞임 · 정확도로 승부', match_ms: 120000 }
};
export const SKILL_RULES = {
  CHOICE_TURN_MS: 9000,
  SPELL_TURN_MS: 16000,
  CHOICE_HIT: 10,
  SPELL_HIT: 22,
  SPEED_BONUS: 0.15    // extra damage per second left, much less than 스피드전
};
export const battleMode = mode => mode === 'skill' ? 'skill' : 'speed';
// Typed answers are compared letter by letter after the same clean-up the question used.
export const normalizeTyped = raw => String(raw ?? '').normalize('NFKC').toLowerCase().replace(/[‘’]/g, "'").replace(/[‐‑–—]/g, '-').replace(/\s+/g, ' ').trim();
const turnMs = (state, q) => state.mode === 'skill' ? (q?.kind === 'spell' ? SKILL_RULES.SPELL_TURN_MS : SKILL_RULES.CHOICE_TURN_MS) : BATTLE.TURN_MS;
// The word and its meaning of a question (the review list and the reveal line).
export function questionWord(q) {
  return q.kind === 'spell' ? { word: q.text, meaning: q.prompt } : { word: q.prompt, meaning: q.options[q.answer] };
}

// V13.72 pet skills fire by themselves: answering 3 words in a row right fills the gauge
// (토리: 2 in a row, but weaker); a wrong answer or a word left to time out empties it.
// There are no skill buttons: children focusing on the word kept missing them. Every pet is
// as strong at any level, and the numbers come from a simulation of thousands of matches per
// pair of pets (each pet wins 47–54% against the others in both modes at every skill level).
// Bonuses and guards are flat numbers, added after the critical and fever multipliers.
export const PET_SKILL_NEED = 3;
export const PET_SKILLS = {
  dog: { name: '용감한 돌진', desc: '다음 공격 +16', boost: [16] },
  dragon: { name: '불꽃 숨결', desc: '바로 13 피해', burst: 13 },
  fox: { name: '여우 연타', desc: '다음 공격 2번 +9씩', boost: [9, 9] },
  snake: { name: '독 이빨', desc: '3문제 동안 5씩 피해', poison: 5, turns: 3 },
  cat: { name: '사뿐 회피', desc: '다음에 받는 공격 −16', guard: [16] },
  pig: { name: '말랑 방패', desc: '다음에 받는 공격 2번 −8씩', guard: [8, 8] },
  panda: { name: '대나무 간식', desc: 'HP +13', heal: 13 },
  rabbit: { name: '깡총 연타', desc: '2번 연속 맞히면 바로 7 피해', burst: 7, need: 2 }
};
// A pet without its own skill (the practice robot, or no pet) uses 몽이's.
export const petSkillKey = pet => PET_SKILLS[pet?.key] ? pet.key : 'dog';
export const petSkill = pet => ({ key: petSkillKey(pet), need: PET_SKILL_NEED, ...PET_SKILLS[petSkillKey(pet)] });

const other = (state, pid) => state.order.find(id => id !== pid);

// players: [{ id, name, pet, streak, title, tier, bot }] (host first);
// questions: [{ word_id, prompt, options[4], answer }] or, in 실력전, also spelling words
// [{ word_id, kind: 'spell', prompt (meaning), hint, text, accept[] }]. `label` names a match
// that is not an ordinary one ('대회 8강', '연습 경기').
export function createBattle({ id, players, questions, stake = 0, label = null, mode = 'speed', now }) {
  if (players.length !== 2 || players[0].id === players[1].id) throw Error('battle needs two different players');
  if (!questions.length) throw Error('battle needs questions');
  return {
    id, stake, label: label || null, mode: battleMode(mode), created_at: now, phase: 'waiting', seq: 0,
    order: players.map(p => p.id),
    players: Object.fromEntries(players.map(p => [p.id, {
      id: p.id, name: p.name, pet: p.pet || null, streak: Number(p.streak || 0), title: p.title || null, tier: p.tier || null, bot: !!p.bot,
      hp: BATTLE.MAX_HP, gauge: 0, boost: [], guard: [], poison: 0,
      connected: false, dropped_at: null, correct: 0, answer_ms: 0, skills_used: 0, missed: []
    }])),
    questions, idx: -1, turn: null,
    started_at: null, ends_at: null, deadline: null, result: null
  };
}

function event(state, type, data = {}) { state.seq++; return { type, seq: state.seq, ...data }; }

// What a player sees of a question: never the answer.
function questionPublic(q) {
  return q.kind === 'spell' ? { kind: 'spell', prompt: q.prompt, hint: q.hint, options: [] } : { kind: 'choice', prompt: q.prompt, options: q.options };
}
function questionEvent(state) {
  const q = state.questions[state.turn.q];
  return event(state, 'question', { n: state.idx + 1, ...questionPublic(q), started_at: state.turn.started_at, deadline: state.deadline });
}
const answerOf = q => q.kind === 'spell' ? q.text : q.answer;

function nextQuestion(state, now) {
  const alive = state.order.every(id => state.players[id].hp > 0);
  if (!alive || now >= state.ends_at) return finish(state, now, 'end');
  state.idx++;
  state.turn = { q: state.idx % state.questions.length, started_at: now, locked: {}, hits: 0, resolved: false };
  state.phase = 'question';
  state.deadline = now + turnMs(state, state.questions[state.turn.q]);
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
    return q ? { word_id: wordId, ...questionWord(q) } : null;
  }).filter(Boolean)]));
  // V13.73: pet skills set off, per player (the 스킬 titles count them).
  state.result = { winner, loser: winner ? other(state, winner) : null, reason, stake: state.stake, finished_at: now, hp: { [a.id]: a.hp, [b.id]: b.hp }, skills: { [a.id]: a.skills_used || 0, [b.id]: b.skills_used || 0 }, review };
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
  const q = state.questions[state.turn.q], skill = state.mode === 'skill', spell = q.kind === 'spell';
  // 실력전 has no critical hits.
  const fast = !skill && ms < BATTLE.FAST_MS;
  attacker.correct++; attacker.answer_ms += ms;
  state.turn.locked[attackerId] = true;
  state.turn.hits = (state.turn.hits || 0) + 1;
  const left = Math.max(0, turnMs(state, q) - ms) / 1000;
  let dmg = skill
    ? (spell ? SKILL_RULES.SPELL_HIT : SKILL_RULES.CHOICE_HIT) + Math.round(left * SKILL_RULES.SPEED_BONUS)
    : BATTLE.HIT + Math.round(left * BATTLE.SPEED_BONUS);
  if (fast) dmg = Math.round(dmg * BATTLE.CRIT);
  const fever = inFever(state, now);
  if (fever) dmg = Math.round(dmg * BATTLE.FEVER_MULT);
  // Pet skill effects waiting for this attack (a room started before V13.72 has no lists).
  const boost = (attacker.boost ||= []).shift() || 0, guard = (defender.guard ||= []).shift() || 0;
  dmg = Math.max(0, dmg + boost - guard);
  defender.hp = Math.max(0, defender.hp - dmg);
  attacker.gauge = (attacker.gauge || 0) + 1;
  const events = [event(state, 'attack', { attacker: attacker.id, defender: defender.id, dmg, fast, spell, fever, boost, guard, ms, hp: { [attacker.id]: attacker.hp, [defender.id]: defender.hp }, gauge: attacker.gauge, effects: { [attacker.id]: effectsOf(attacker), [defender.id]: effectsOf(defender) } })];
  if (attacker.gauge >= petSkill(attacker.pet).need) events.push(firePetSkill(state, attacker, defender));
  if (state.order.every(id => state.turn.locked[id])) events.push(...settle(state, now, false));
  return events;
}

// The gauge is full: the pet's skill goes off at once and the gauge starts again.
function firePetSkill(state, p, foe) {
  const s = petSkill(p.pet);
  p.gauge = 0; p.skills_used++;
  if (s.boost) p.boost = [...s.boost];
  if (s.guard) p.guard = [...s.guard];
  if (s.poison) p.poison = s.turns;
  if (s.heal) p.hp = Math.min(BATTLE.MAX_HP, p.hp + s.heal);
  if (s.burst) foe.hp = Math.max(0, foe.hp - s.burst);
  return event(state, 'petskill', { player: p.id, skill: s.key, name: s.name, desc: s.desc, dmg: s.burst || 0, heal: s.heal || 0, hp: { [p.id]: p.hp, [foe.id]: foe.hp }, effects: effectsOf(p) });
}
// What is still waiting to happen for a player (drawn under the HP bar).
const effectsOf = p => ({ boost: [...(p.boost || [])], guard: [...(p.guard || [])], poison: p.poison || 0 });

// Closes a word: everyone has answered or its time ran out; the answer is revealed to both.
// A word left to run out empties the pet gauge like a wrong answer. 초롱's poison bites
// as each word closes.
function settle(state, now, timeout) {
  for (const id of state.order) {
    if (state.turn.locked[id]) continue;
    state.players[id].gauge = 0;
    if (timeout) markMissed(state, id);
  }
  reveal(state, now);
  const answer = answerOf(state.questions[state.turn.q]);
  const events = [event(state, state.turn.hits ? 'reveal' : 'miss', { timeout, answer })];
  for (const id of state.order) {
    const p = state.players[id];
    if (!(p.poison > 0)) continue;
    const foe = state.players[other(state, id)], dmg = petSkill(p.pet).poison || 0;
    p.poison--;
    foe.hp = Math.max(0, foe.hp - dmg);
    events.push(event(state, 'poison', { player: id, target: foe.id, dmg, left: p.poison, hp: foe.hp }));
  }
  return events;
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
  const q = state.questions[turn.q];
  let right;
  if (q.kind === 'spell') {
    if (typeof choice !== 'string' || !choice.trim() || choice.length > 60) return [];
    right = (q.accept || [q.text]).includes(normalizeTyped(choice));
  } else {
    if (!Number.isInteger(choice) || choice < 0 || choice > 3) return [];
    right = choice === q.answer;
  }
  if (right) return attack(state, pid, now - turn.started_at, now);
  turn.locked[pid] = true;
  p.gauge = 0;
  markMissed(state, pid);
  const events = [event(state, 'wrong', { player: pid, gauge: 0 })];
  if (state.order.every(id => turn.locked[id])) events.push(...settle(state, now, false));
  return events;
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
      state.ends_at = now + (BATTLE_MODES[state.mode]?.match_ms || BATTLE.MATCH_MS);
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
    id: state.id, me: pid, phase: state.phase, seq: state.seq, stake: state.stake, label: state.label || null, mode: state.mode || 'speed',
    order: state.order, started_at: state.started_at, ends_at: state.ends_at, deadline: state.deadline, fever_ms: BATTLE.FEVER_MS,
    players: Object.fromEntries(state.order.map(id => {
      const p = state.players[id];
      const s = petSkill(p.pet);
      return [id, { id, name: p.name, pet: p.pet, streak: p.streak || 0, title: p.title || null, tier: p.tier || null, bot: !!p.bot, hp: p.hp, gauge: p.gauge || 0, skill: { key: s.key, name: s.name, desc: s.desc, need: s.need }, effects: effectsOf(p), connected: p.connected }];
    })),
    question: q && ['question', 'reveal'].includes(state.phase) ? {
      n: state.idx + 1, ...questionPublic(q), started_at: turn.started_at,
      locked: !!turn.locked[pid], answer: state.phase === 'reveal' ? answerOf(q) : undefined
    } : null,
    result: state.result
  };
}
