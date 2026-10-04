// Release checks for the yacha battle rules (server/battle-engine.mjs).
import { readFileSync } from 'node:fs';
import { BATTLE, BATTLE_MODES, PET_SKILLS, PET_SKILL_NEED, petSkill, createBattle, connect, disconnect, forfeit, answer, tick, nextWake, battleView } from './battle-engine.mjs';

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
// V13.72: one word where each player answers right (true), wrong (false) or not at all
// (missing), the host at 3 s and the guest at 3.5 s; runs the clock until the next word opens.
function playWord(s, picks) {
  const at = s.turn.started_at, events = [];
  if (picks.host !== undefined) events.push(...answer(s, 'host', picks.host ? correct(s) : wrong(s), at + 3000));
  if (picks.guest !== undefined) events.push(...answer(s, 'guest', picks.guest ? correct(s) : wrong(s), at + 3500));
  while (s.phase !== 'finished' && (s.phase !== 'question' || s.turn.started_at === at)) events.push(...tick(s, s.deadline));
  return events;
}
function startedWith(hostPet, guestPet, t = 1000) {
  const s = createBattle({ id: 'b2', players: [{ ...players[0], pet: { key: hostPet, form: 1 } }, { ...players[1], pet: { key: guestPet, form: 1 } }], questions, stake: 30, now: t });
  connect(s, 'host', t); connect(s, 'guest', t);
  tick(s, t + BATTLE.COUNTDOWN_MS);
  return s;
}

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
    assert(hit && hit.fast && hit.dmg === expected && s.players.guest.hp === BATTLE.MAX_HP - expected && s.players.host.gauge === 1, 'a fast correct answer attacks with a critical and fills one step of the pet gauge');
    assert(s.phase === 'question' && !('answer' in hit) && !events.some(e => e.type === 'reveal'), 'V13.59 the word stays open and hides its answer until the other player answers');
    assert(!answer(s, 'host', correct(s), t + 1200).length, 'a player attacks at most once per word');
    const counter = answer(s, 'guest', correct(s), t + 3000);
    const guestHit = counter.find(e => e.type === 'attack'), shown = counter.find(e => e.type === 'reveal');
    assert(guestHit && !guestHit.fast && guestHit.dmg === slowHit(5) && s.players.host.hp === BATTLE.MAX_HP - slowHit(5) && s.players.guest.gauge === 1, 'V13.59 the slower player also attacks when correct');
    assert(s.players.host.gauge === 1 && shown && shown.answer === correct(s) && !shown.timeout && s.phase === 'reveal', 'V13.59 being slower does not empty the other player\'s gauge, and the answer is revealed once both answered');
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
    assert(guestHit && !guestHit.fast && s.players.host.hp === BATTLE.MAX_HP - slowHit(5) && s.players.guest.gauge === 1 && s.players.host.gauge === 0 && s.phase === 'reveal', 'the other player can still win the word slowly');
  }
  {
    const { s, t } = started();
    answer(s, 'host', wrong(s), t + 500);
    const events = answer(s, 'guest', wrong(s), t + 600);
    assert(events.some(e => e.type === 'miss' && !e.timeout) && s.phase === 'reveal', 'two wrong answers end the word with no attack');
    const { s: s2, t: t2 } = started();
    s2.players.host.gauge = 2;
    const timeout = tick(s2, t2 + BATTLE.TURN_MS);
    assert(timeout.some(e => e.type === 'miss' && e.timeout) && s2.players.host.gauge === 0, 'V13.72 a word nobody answers times out and empties the pet gauge');
    const { s: s3, t: t3 } = started();
    answer(s3, 'host', correct(s3), t3 + 3000);
    s3.players.guest.gauge = 2;
    const late = tick(s3, t3 + BATTLE.TURN_MS);
    assert(late.some(e => e.type === 'reveal' && e.timeout) && s3.players.host.gauge === 1 && s3.players.guest.gauge === 0 && s3.players.guest.missed.length === 1 && !s3.players.host.missed.length, 'V13.59 when time runs out only the player who did not answer loses the gauge and gets the word to review');
  }
  {
    // V13.72 pet skills: 3 right answers in a row set off the pet's own skill, no buttons.
    const { s } = started(); // host 호야 (fox), guest 나비 (cat)
    playWord(s, { host: true, guest: false });
    const second = playWord(s, { host: true, guest: false });
    assert(s.players.host.gauge === 2 && s.players.guest.gauge === 0 && !second.some(e => e.type === 'petskill'), 'V13.72 the gauge fills one step per right answer and a wrong answer empties it');
    const third = playWord(s, { host: true, guest: false });
    const fired = third.find(e => e.type === 'petskill');
    assert(fired?.player === 'host' && fired.skill === 'fox' && fired.name === PET_SKILLS.fox.name && s.players.host.gauge === 0 && s.players.host.boost.join() === '9,9' && s.players.host.skills_used === 1, 'V13.72 the third right answer in a row sets off 호야\'s skill (next 2 attacks +9) and the gauge starts again');
    assert(third.findIndex(e => e.type === 'attack') < third.findIndex(e => e.type === 'petskill') && fired.effects.boost.length === 2, 'V13.72 the skill goes off right after the attack that filled the gauge');
    const hp = s.players.guest.hp;
    const boosted = playWord(s, { host: true, guest: true }).find(e => e.type === 'attack' && e.attacker === 'host');
    assert(boosted.boost === 9 && boosted.dmg === slowHit(5) + 9 && s.players.guest.hp === hp - boosted.dmg && s.players.host.boost.length === 1, 'V13.72 a boost adds its number to one attack');
    playWord(s, { host: false, guest: true });
    const guard = playWord(s, { host: false, guest: true }).find(e => e.type === 'petskill');
    assert(guard?.skill === 'cat' && s.players.guest.guard.join() === '16', 'V13.72 나비\'s skill guards the next attack it takes');
    const guarded = playWord(s, { host: true }).find(e => e.type === 'attack');
    assert(guarded.guard === 16 && guarded.boost === 9 && guarded.dmg === Math.max(0, slowHit(5) + 9 - 16) && !s.players.guest.guard.length && !s.players.host.boost.length, 'V13.72 a guard takes its number off one attack (after a boost), then both are used up');
  }
  {
    // 토리 needs only 2 in a row and hits at once; 초롱 poisons 3 words; 밤부 heals up to 100.
    const s = startedWith('rabbit', 'snake');
    playWord(s, { host: true, guest: true });
    const hop = playWord(s, { host: true, guest: true });
    const rabbit = hop.find(e => e.type === 'petskill' && e.player === 'host');
    assert(PET_SKILLS.rabbit.need === 2 && rabbit?.dmg === 7 && !hop.some(e => e.type === 'petskill' && e.player === 'guest'), 'V13.72 토리\'s skill goes off after 2 in a row and hits for 7 at once');
    assert(s.players.guest.hp === BATTLE.MAX_HP - 2 * slowHit(5) - 7, 'V13.72 토리\'s hit comes on top of the attacks');
    const bite = playWord(s, { host: false, guest: true });
    const poison = bite.find(e => e.type === 'poison');
    assert(bite.some(e => e.type === 'petskill' && e.skill === 'snake') && poison?.dmg === 5 && poison.left === 2 && poison.target === 'host' && bite.findIndex(e => e.type === 'reveal') < bite.findIndex(e => e.type === 'poison'), 'V13.72 초롱\'s poison bites as the word closes');
    const hostHp = s.players.host.hp;
    playWord(s, { host: false, guest: false });
    playWord(s, { host: false, guest: false });
    playWord(s, { host: false, guest: false });
    assert(s.players.host.hp === hostHp - 10 && s.players.guest.poison === 0, 'V13.72 the poison bites 3 words in all, even words nobody answers');
    const p = startedWith('panda', 'dragon');
    p.players.host.hp = BATTLE.MAX_HP - 5;
    for (let i = 0; i < PET_SKILL_NEED; i++) playWord(p, { host: true, guest: false });
    assert(p.players.host.hp === BATTLE.MAX_HP && p.players.host.skills_used === 1, 'V13.72 밤부 heals 13 but not above full HP');
    const d = startedWith('panda', 'dragon');
    for (let i = 0; i < PET_SKILL_NEED; i++) playWord(d, { host: false, guest: true });
    assert(d.players.host.hp === BATTLE.MAX_HP - 3 * slowHit(4.5) - 13, 'V13.72 용이 hits for 13 at once');
    const ko = startedWith('dragon', 'dog');
    ko.players.guest.hp = 50;
    playWord(ko, { host: true }); playWord(ko, { host: true });
    const last = playWord(ko, { host: true, guest: false }), end = last.find(e => e.type === 'end');
    assert(last.find(e => e.type === 'attack').hp.guest === 5 && ko.phase === 'finished' && end?.result.winner === 'host' && ko.players.guest.hp === 0, 'V13.72 a skill can knock the other pet out');
  }
  {
    // Every pet has one skill; the robot and a player without a pet use 몽이's.
    assert(Object.keys(PET_SKILLS).length === 16 && Object.values(PET_SKILLS).every(x => x.name && x.desc), 'V13.72 all eight pets have a named skill');
    assert(petSkill({ key: 'robot' }).key === 'dog' && petSkill(null).key === 'dog' && petSkill({ key: 'pig' }).need === PET_SKILL_NEED, 'V13.72 the practice robot and a player without a pet use 몽이\'s skill');
    const r = startedWith('robot', 'fox');
    const view = battleView(r, 'guest');
    assert(view.players.host.skill.key === 'dog' && view.players.guest.skill.name === PET_SKILLS.fox.name && view.players.host.gauge === 0 && Array.isArray(view.players.guest.effects.boost) && !('ki' in view.players.host), 'V13.72 the view shows each pet\'s skill, gauge and waiting effects');
    // A match saved by an older room (no gauge or effect lists) keeps working.
    const old = startedWith('fox', 'cat');
    for (const id of old.order) { const x = old.players[id]; delete x.gauge; delete x.boost; delete x.guard; delete x.poison; x.ki = 3; }
    const hit = playWord(old, { host: true, guest: true }).find(e => e.type === 'attack');
    assert(hit?.dmg === slowHit(5) && old.players.host.gauge === 1 && battleView(old, 'host').players.guest.gauge === 1, 'V13.72 a match started before the update keeps going');
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
    // V13.82 tie-breaks: equal HP is no longer a draw when the match can be told apart.
    const { s: k, t: kt } = started();
    k.players.host.hp = 10; k.players.guest.hp = 10;
    answer(k, 'host', correct(k), kt + 1000); answer(k, 'guest', correct(k), kt + 2000);
    const ko = tick(k, kt + 2000 + BATTLE.REVEAL_MS).find(e => e.type === 'end');
    assert(k.players.host.hp === 0 && k.players.guest.hp === 0 && ko?.result.winner === 'host' && ko.result.tiebreak === 'ko_first', 'V13.82 both knocked out on one word: the pet that knocked the other out first wins');
    const { s: c, t: ct } = started();
    answer(c, 'host', correct(c), ct + 3000); answer(c, 'guest', wrong(c), ct + 3000);
    c.players.host.hp = 50; c.players.guest.hp = 50; c.ends_at = ct + 3100;
    const more = tick(c, ct + 3000 + BATTLE.REVEAL_MS).find(e => e.type === 'end');
    assert(more?.result.winner === 'host' && more.result.tiebreak === 'correct', 'V13.82 same HP when time runs out: more right answers wins');
    const { s: f, t: ft } = started();
    answer(f, 'host', correct(f), ft + 3000); answer(f, 'guest', correct(f), ft + 1500);
    f.players.host.hp = 40; f.players.guest.hp = 40; f.ends_at = ft + 3100;
    const fast = tick(f, ft + 3000 + BATTLE.REVEAL_MS).find(e => e.type === 'end');
    assert(fast?.result.winner === 'guest' && fast.result.tiebreak === 'speed', 'V13.82 then the faster average answer wins');
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
  {
    // V13.94 longer matches: HP 250, 스피드전 2분, 실력전 2분 30초, fever the last 20 seconds.
    assert(BATTLE.MAX_HP === 250 && BATTLE_MODES.speed.match_ms === 120000 && BATTLE_MODES.skill.match_ms === 150000 && BATTLE.FEVER_MS === 20000 && fresh().max_hp === 250 && fresh().players.host.hp === 250, 'V13.94 matches last longer: HP 250, 2 minutes (실력전 2:30), fever the last 20 seconds');
    const legacy = fresh(); delete legacy.max_hp; legacy.players.host.hp = 95;
    connect(legacy, 'host', 1000); connect(legacy, 'guest', 1000); tick(legacy, 1000 + BATTLE.COUNTDOWN_MS);
    assert(battleView(legacy, 'host').max_hp === 100, 'V13.94 a room started before the change keeps its full HP of 100');
    // 각자 내 범위: each player answers a word of their own list on the same turn.
    const mine = Array.from({ length: 6 }, (_, i) => ({ word_id: 'h' + i, prompt: 'host' + i, options: ['a', 'b', 'c', 'd'], answer: i % 4 }));
    const theirs = Array.from({ length: 6 }, (_, i) => ({ word_id: 'g' + i, prompt: 'guest' + i, options: ['a', 'b', 'c', 'd'], answer: (i + 1) % 4 }));
    const s = createBattle({ id: 'own', players: [{ ...players[0], ranges: ['24'] }, { ...players[1], ranges: ['31'] }], questions: mine, own: { host: mine, guest: theirs }, stake: 10, now: 1000 });
    connect(s, 'host', 1000); connect(s, 'guest', 1000);
    const first = tick(s, 1000 + BATTLE.COUNTDOWN_MS).find(e => e.type === 'question');
    const t = 1000 + BATTLE.COUNTDOWN_MS;
    const hv = battleView(s, 'host'), gv = battleView(s, 'guest');
    assert(first.own.host.prompt === 'host0' && first.own.guest.prompt === 'guest0' && !('answer' in first.own.guest) && hv.question.prompt === 'host0' && gv.question.prompt === 'guest0' && gv.own_words && gv.players.guest.ranges.join() === '31', 'V13.94 each player sees a word of their own range on the same turn, without its answer');
    const guestHostAnswer = answer(s, 'guest', 0, t + 2500);
    assert(guestHostAnswer.some(e => e.type === 'wrong') && s.players.guest.missed.join() === 'g0', 'V13.94 a player is marked on their own word (the host\'s answer is wrong for the guest)');
    const hit = answer(s, 'host', 0, t + 3000);
    const reveal = hit.find(e => e.type === 'reveal');
    assert(hit.some(e => e.type === 'attack' && e.attacker === 'host') && reveal?.answers?.host === 0 && reveal.answers.guest === 1, 'V13.94 the reveal tells each player the answer of their own word');
    tick(s, t + 3000 + BATTLE.REVEAL_MS);
    assert(battleView(s, 'guest').question.prompt === 'guest1' && battleView(s, 'host').question.prompt === 'host1', 'V13.94 the next turn moves both lists on');
    const end = forfeit(s, 'host', t + 5000).find(e => e.type === 'end');
    assert(end.result.review.guest[0]?.word === 'guest0' && end.result.max_hp === 250, 'V13.94 the result lists the words each player missed from their own range');
  }
  /* ---------- V13.99 경기 종료 시각 · 문제 번호 ---------- */
  {
    // A word opened just before the match ends gets only the time that is left, not a full turn.
    const { s, t } = started();
    answer(s, 'host', correct(s), t + 500); answer(s, 'guest', correct(s), t + 500);
    s.ends_at = t + 2500; // the reveal ends at t + 1900, 0.6 s before the match ends
    const opened = tick(s, t + 1900).find(e => e.type === 'question');
    assert(opened && s.deadline === s.ends_at && opened.deadline === s.ends_at, 'V13.99 the last word closes when the match ends (deadline = ends_at)');
    assert(answer(s, 'host', correct(s), s.ends_at).length === 0 && answer(s, 'host', correct(s), s.ends_at + 400).length === 0 && s.players.host.correct === 1, 'V13.99 an answer at or after ends_at does not attack');
    assert(nextWake(s) <= s.ends_at, 'V13.99 the room wakes up when the match ends');
    const over = tick(s, s.ends_at + 50);
    assert(s.phase === 'finished' && over.some(e => e.type === 'end' && e.result.reason === 'end'), 'V13.99 tick ends the match at ends_at');
  }
  {
    // A reveal running past ends_at: the match ends at ends_at, not when the reveal pause ends.
    const { s, t } = started();
    s.ends_at = t + 1000;
    answer(s, 'host', correct(s), t + 500); answer(s, 'guest', wrong(s), t + 500);
    assert(s.phase === 'reveal' && s.deadline > s.ends_at && nextWake(s) === s.ends_at, 'V13.99 nextWake includes ends_at during the reveal');
    tick(s, s.ends_at);
    assert(s.phase === 'finished' && s.result.reason === 'end', 'V13.99 tick ends the match at ends_at even in the middle of a reveal');
  }
  {
    // A player dropped long before the end still loses by disconnect, not by time.
    const { s, t } = started();
    s.ends_at = t + 20000;
    disconnect(s, 'guest', t + 1000);
    tick(s, t + 30000);
    assert(s.result?.reason === 'disconnect' && s.result.loser === 'guest', 'V13.99 a grace period that ran out before ends_at is still a disconnect loss');
  }
  {
    // The answer of the previous word must not count for the next one.
    const { s, t } = started();
    const q0 = s.idx;
    assert(battleView(s, 'host').question.idx === q0, 'V13.99 the view carries the word number (idx)');
    answer(s, 'host', wrong(s), t + 1000); answer(s, 'guest', wrong(s), t + 1000);
    const next = tick(s, t + 1000 + BATTLE.REVEAL_MS).find(e => e.type === 'question');
    assert(next && next.idx === s.idx && s.idx === q0 + 1, 'V13.99 the question event carries the word number (idx)');
    const late = answer(s, 'host', correct(s), t + 3000, q0);
    assert(late.length === 0 && !s.turn.locked.host, 'V13.99 an answer sent for the previous word is ignored');
    const legacy = answer(s, 'guest', correct(s), t + 3100);
    const current = answer(s, 'host', correct(s), t + 3200, s.idx);
    assert(legacy.some(e => e.type === 'attack' && e.attacker === 'guest') && current.some(e => e.type === 'attack' && e.attacker === 'host'), 'V13.99 an answer with the current number, or none (older app), still counts');
  }
  {
    // The phone sends the word number with every answer and takes no more taps for that word.
    const ui = readFileSync(new URL('../public/modules/battle.js', import.meta.url), 'utf8');
    const bot = readFileSync(new URL('../public/modules/battle-bot.js', import.meta.url), 'utf8');
    assert(ui.includes("v.question = { n: e.n, idx: e.idx,") && (ui.match(/\{ idx: q\.idx \}/g) || []).length === 2 && ui.includes('q.picked = choice;') && ui.includes("{ idx: q.idx } : {}) }, button)) { q.picked = before; return; }\n  q.locked = true;") && ui.includes("if (act === 'answer') return pickChoice("), 'V13.99 battle.js sends idx with choice and spelling answers and locks the word once sent');
    assert(bot.includes('Number.isInteger(message.idx) ? message.idx : undefined'), 'V13.99 the practice match (로보·몬스터) passes idx to the same engine');
  }
}
