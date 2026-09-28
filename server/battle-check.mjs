// Release checks for the yacha battle rules (server/battle-engine.mjs).
import { BATTLE, createBattle, connect, disconnect, forfeit, answer, useSkill, tick, nextWake, battleView } from './battle-engine.mjs';

const questions = Array.from({ length: 6 }, (_, i) => ({ word_id: 'w' + i, prompt: 'word' + i, options: ['a', 'b', 'c', 'd'], answer: i % 4 }));
const players = [{ id: 'host', name: '호스트', pet: { key: 'fox', form: 2 } }, { id: 'guest', name: '게스트', pet: { key: 'cat', form: 1 } }];
const fresh = (now = 1000, stake = 30) => createBattle({ id: 'b1', players, questions, stake, now });
// Connect both players and run the countdown so the first word is open at `t`.
function started(t = 1000) {
  const s = fresh(t);
  connect(s, 'host', t); connect(s, 'guest', t);
  tick(s, t + BATTLE.COUNTDOWN_MS);
  return { s, t: t + BATTLE.COUNTDOWN_MS };
}
const correct = s => s.questions[s.turn.q].answer;
const wrong = s => (correct(s) + 1) % 4;
// Damage of a correct answer with `left` whole seconds still on the word (not fast).
const slowHit = left => BATTLE.HIT + Math.round(left * BATTLE.SPEED_BONUS);

export function runBattleChecks(assert) {
  {
    // V13.56 fever time: the last 15 seconds deal 1.5x damage.
    const { s, t } = started();
    const late = s.ends_at - BATTLE.FEVER_MS + 100;
    s.turn.started_at = late - 3000; s.deadline = late + 5000;
    const hit = answer(s, 'host', correct(s), late).find(e => e.type === 'attack');
    const normal = slowHit(5);
    assert(hit?.fever === true && hit.dmg === Math.round(normal * BATTLE.FEVER_MULT) && s.players.guest.hp === BATTLE.MAX_HP - hit.dmg, 'fever time hits deal 1.5x damage');
    const { s: early, t: te } = started();
    assert(answer(early, 'host', correct(early), te + 3000).find(e => e.type === 'attack')?.fever === false, 'hits before fever time deal normal damage');
    assert(battleView(early, 'host').fever_ms === BATTLE.FEVER_MS, 'the view tells phones when fever time starts');
  }
  {
    // V13.56 review: wrong answers and timeouts are listed per player after the match.
    const { s, t } = started();
    const first = s.questions[s.turn.q];
    answer(s, 'host', wrong(s), t + 500);
    answer(s, 'guest', correct(s), t + 900);
    tick(s, t + 900 + BATTLE.REVEAL_MS);
    const second = s.questions[s.turn.q];
    tick(s, t + 900 + BATTLE.REVEAL_MS + BATTLE.TURN_MS);
    const end = forfeit(s, 'guest', t + 20000).find(e => e.type === 'end');
    const review = end.result.review;
    assert(review.host.map(w => w.word_id).join() === [first.word_id, second.word_id].join() && review.host[0].meaning === first.options[first.answer] && review.host[0].word === first.prompt, 'the host sees the word answered wrong and the word that timed out');
    assert(review.guest.map(w => w.word_id).join() === second.word_id, 'the guest sees only the word that timed out');
    const legacy = fresh(); delete legacy.players.host.missed;
    connect(legacy, 'host', 1000); connect(legacy, 'guest', 1000); tick(legacy, 1000 + BATTLE.COUNTDOWN_MS);
    answer(legacy, 'host', wrong(legacy), 1000 + BATTLE.COUNTDOWN_MS + 100);
    assert(legacy.players.host.missed.length === 1, 'a match saved before v13.56 starts its missed list on the first wrong answer');
  }
  {
    const s = fresh();
    connect(s, 'host', 1000);
    assert(s.phase === 'waiting' && nextWake(s) === null, 'battle waits until both players connect');
    const events = connect(s, 'guest', 1200);
    assert(s.phase === 'countdown' && events.some(e => e.type === 'countdown') && nextWake(s) === 1200 + BATTLE.COUNTDOWN_MS, 'both players connected start a countdown');
    const startEvents = tick(s, 1200 + BATTLE.COUNTDOWN_MS);
    const q = startEvents.find(e => e.type === 'question');
    assert(s.phase === 'question' && q && !('answer' in q) && q.options.length === 4 && s.ends_at === s.started_at + BATTLE.MATCH_MS, 'the first word opens without revealing its answer');
    const view = battleView(s, 'guest');
    assert(view.me === 'guest' && view.question && view.question.answer === undefined && view.players.host.hp === BATTLE.MAX_HP, 'a player view hides the open answer');
  }
  {
    const { s, t } = started();
    const events = answer(s, 'host', correct(s), t + 1000);
    const hit = events.find(e => e.type === 'attack');
    const expected = Math.round(slowHit(7) * BATTLE.CRIT);
    assert(hit && hit.fast && hit.dmg === expected && s.players.guest.hp === BATTLE.MAX_HP - expected && s.players.host.ki === 2, 'a fast correct answer attacks with a critical and gives 2 ki');
    assert(s.phase === 'question' && !('answer' in hit) && !events.some(e => e.type === 'reveal'), 'V13.59 the word stays open and hides its answer until the other player answers');
    assert(!answer(s, 'host', correct(s), t + 1200).length, 'a player attacks at most once per word');
    const counter = answer(s, 'guest', correct(s), t + 3000);
    const guestHit = counter.find(e => e.type === 'attack'), shown = counter.find(e => e.type === 'reveal');
    assert(guestHit && !guestHit.fast && guestHit.dmg === slowHit(5) && s.players.host.hp === BATTLE.MAX_HP - slowHit(5) && s.players.guest.ki === 1, 'V13.59 the slower player also attacks when correct');
    assert(s.players.host.ki === 2 && shown && shown.answer === correct(s) && !shown.timeout && s.phase === 'reveal', 'V13.59 being slower does not break the other player\'s ki, and the answer is revealed once both answered');
    assert(guestHit.dmg < hit.dmg, 'V13.59 speed still gives a small bonus');
    assert(!answer(s, 'guest', correct(s), t + 3100).length, 'a resolved word ignores later answers');
    tick(s, t + 3000 + BATTLE.REVEAL_MS);
    assert(s.phase === 'question' && s.idx === 1, 'the next word opens after the reveal pause');
  }
  {
    const { s, t } = started();
    answer(s, 'host', wrong(s), t + 500);
    assert(s.turn.locked.host && !answer(s, 'host', correct(s), t + 700).length, 'a wrong answer locks that player out of the word');
    const guestHit = answer(s, 'guest', correct(s), t + 3000).find(e => e.type === 'attack');
    assert(guestHit && !guestHit.fast && s.players.host.hp === BATTLE.MAX_HP - slowHit(5) && s.players.guest.ki === 1 && s.phase === 'reveal', 'the other player can still win the word slowly for 1 ki');
  }
  {
    const { s, t } = started();
    answer(s, 'host', wrong(s), t + 500);
    const events = answer(s, 'guest', wrong(s), t + 600);
    assert(events.some(e => e.type === 'miss' && !e.timeout) && s.phase === 'reveal', 'two wrong answers end the word with no attack');
    const { s: s2, t: t2 } = started();
    s2.players.host.ki = 3;
    const timeout = tick(s2, t2 + BATTLE.TURN_MS);
    assert(timeout.some(e => e.type === 'miss' && e.timeout) && s2.players.host.ki === 0, 'a word nobody answers times out and resets ki');
    const { s: s3, t: t3 } = started();
    answer(s3, 'host', correct(s3), t3 + 3000);
    s3.players.guest.ki = 3;
    const late = tick(s3, t3 + BATTLE.TURN_MS);
    assert(late.some(e => e.type === 'reveal' && e.timeout) && s3.players.host.ki === 1 && s3.players.guest.ki === 0 && s3.players.guest.missed.length === 1 && !s3.players.host.missed.length, 'V13.59 when time runs out only the player who did not answer loses ki and gets the word to review');
  }
  {
    const { s, t } = started();
    s.players.host.ki = 5;
    assert(useSkill(s, 'host', 'power', t).length && s.players.host.power && s.players.host.ki === 0, 'the power skill costs 5 ki');
    s.players.guest.ki = 2;
    useSkill(s, 'guest', 'shield', t + 10);
    const hit = answer(s, 'host', correct(s), t + 3000).find(e => e.type === 'attack');
    const base = slowHit(5);
    assert(hit.powered && hit.shielded && hit.dmg === Math.round(base * 2 / 2) && !s.players.host.power && !s.players.guest.shield, 'power doubles and shield halves one attack, then both are used up');
    assert(!useSkill(s, 'host', 'heal', t + 3100).length, 'skills need enough ki');
    s.players.guest.ki = 3;
    useSkill(s, 'guest', 'heal', t + 3200);
    assert(s.players.guest.hp === Math.min(BATTLE.MAX_HP, BATTLE.MAX_HP - hit.dmg + BATTLE.HEAL), 'heal restores 20 HP up to the maximum');
  }
  {
    const { s, t } = started();
    s.players.host.ki = 4;
    useSkill(s, 'host', 'freeze', t);
    answer(s, 'host', correct(s), t + 1000);
    answer(s, 'guest', wrong(s), t + 1100);
    tick(s, t + 1100 + BATTLE.REVEAL_MS);
    const opened = s.turn.started_at;
    assert(s.turn.frozen_until.guest === opened + BATTLE.FREEZE_MS && !answer(s, 'guest', correct(s), opened + 1000).length, 'a frozen player cannot answer for the first 2 seconds of the next word');
    assert(answer(s, 'guest', correct(s), opened + 2500).some(e => e.type === 'attack'), 'a frozen player can answer once the freeze ends');
  }
  {
    const { s, t } = started();
    s.players.guest.hp = 10;
    answer(s, 'host', correct(s), t + 1000);
    assert(s.players.guest.hp === 0 && s.phase === 'question' && answer(s, 'guest', correct(s), t + 2000).some(e => e.type === 'attack') && s.players.host.hp < BATTLE.MAX_HP, 'V13.59 a knocked-out pet still gets its answer on that word');
    const end = tick(s, t + 2000 + BATTLE.REVEAL_MS).find(e => e.type === 'end');
    assert(end && end.result.winner === 'host' && end.result.loser === 'guest' && end.result.stake === 30 && s.phase === 'finished' && nextWake(s) === null, 'knocking the other pet to 0 HP wins the stake');
  }
  {
    const { s, t } = started();
    s.players.host.hp = 60; s.players.guest.hp = 40;
    s.ends_at = t + 100;
    answer(s, 'host', wrong(s), t + 50); answer(s, 'guest', wrong(s), t + 60);
    const end = tick(s, t + 60 + BATTLE.REVEAL_MS).find(e => e.type === 'end');
    assert(end && end.result.winner === 'host' && end.result.reason === 'end', 'when time runs out the pet with more HP wins');
    const { s: d, t: dt } = started();
    d.ends_at = dt;
    answer(d, 'host', wrong(d), dt + 10); answer(d, 'guest', wrong(d), dt + 20);
    const draw = tick(d, dt + 20 + BATTLE.REVEAL_MS).find(e => e.type === 'end');
    assert(draw && draw.result.winner === null && draw.result.loser === null, 'equal HP at the end is a draw with no stake moved');
  }
  {
    const { s, t } = started();
    disconnect(s, 'guest', t + 100);
    assert(nextWake(s) <= t + 100 + BATTLE.RECONNECT_MS && !tick(s, t + 5000).some(e => e.type === 'end'), 'a dropped player gets a grace period');
    connect(s, 'guest', t + 6000);
    assert(s.players.guest.connected && s.phase !== 'finished', 'a dropped player can come back');
    disconnect(s, 'guest', t + 7000);
    const end = tick(s, t + 7000 + BATTLE.RECONNECT_MS).find(e => e.type === 'end');
    assert(end && end.result.loser === 'guest' && end.result.reason === 'disconnect', 'staying away past the grace period loses the match');
    const { s: f, t: ft } = started();
    const quit = forfeit(f, 'host', ft + 10).find(e => e.type === 'end');
    assert(quit && quit.result.winner === 'guest' && quit.result.reason === 'forfeit', 'leaving on purpose is a loss');
    const waiting = fresh();
    connect(waiting, 'host', 1000);
    const cancelled = forfeit(waiting, 'host', 1500).find(e => e.type === 'end');
    assert(cancelled && cancelled.result.winner === null && cancelled.result.reason === 'cancelled', 'leaving before the match starts cancels it without a winner');
  }
  {
    const { s, t } = started();
    assert(!answer(s, 'host', correct(s), t + BATTLE.TURN_MS + 300).length && s.players.guest.hp === BATTLE.MAX_HP, 'an answer after the word deadline does not count even before the room wakes up');
    s.players.host.ki = 2;
    assert(!useSkill(s, 'host', 'shield', t + BATTLE.TURN_MS + 300).length, 'a skill after the deadline waits for the timers to run first');
  }
  {
    const s = fresh();
    connect(s, 'host', 1000);
    disconnect(s, 'host', 2000);
    assert(nextWake(s) === null, 'a player who drops before the match starts does not keep waking the room');
    const { s: d, t } = started();
    disconnect(d, 'guest', t + 100);
    assert(!disconnect(d, 'guest', t + 5000).length && d.players.guest.dropped_at === t + 100, 'a second disconnect report does not extend the grace period');
  }
  {
    const s = fresh();
    connect(s, 'host', 1000); connect(s, 'guest', 1000);
    const late = tick(s, 1000 + BATTLE.COUNTDOWN_MS + 60000);
    const q = late.find(e => e.type === 'question');
    assert(q && q.deadline === 1000 + BATTLE.COUNTDOWN_MS + 60000 + BATTLE.TURN_MS && !late.some(e => e.type === 'miss'), 'a room that wakes up late still gives the word its full time');
  }
}
