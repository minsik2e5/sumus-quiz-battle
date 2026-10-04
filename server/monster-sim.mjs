// V13.104 몬스터 레벨 시뮬레이션: the real battle engine (public/modules/battle-engine.js) on a
// virtual clock, the monster answering like battle-bot.js, and a student who knows a share of the
// words. `node server/monster-sim.mjs` prints win rates by stage; the release check uses
// `simulate` with a fixed seed to keep the difficulty curve where it was tuned.
import { createBattle, connect, answer, tick, nextWake, BATTLE, SKILL_RULES } from '../public/modules/battle-engine.js';
import { battleQuestions } from '../public/modules/battle-questions.js';
import { stageLevel, MONSTERS } from '../public/modules/monsters.js';

// A small seeded random (mulberry32), so a run is repeatable.
export function seeded(seed = 1) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const WORDS = Array.from({ length: 60 }, (_, i) => ({ id: 'sim' + i, word: ['apple', 'river', 'borrow', 'gentle', 'harvest', 'island', 'journey', 'kitchen', 'ladder', 'mirror'][i % 10] + 'abcdefghij'[Math.floor(i / 10)], meaning: '뜻' + i, range_code: '1' }));

// One fight. `know`: the share of words the student knows; a known word is answered right after
// 1.6–4 s (spelling 5–10 s on the phone keyboard), an unknown one is a guess after 3–7 s.
export function fight(stage, level, know, random = Math.random) {
  const L = stageLevel(stage, level);
  const realRandom = Math.random;
  Math.random = random; // battleQuestions shuffles with Math.random
  let questions;
  try { questions = battleQuestions(WORDS, L.mode, 40); } finally { Math.random = realRandom; }
  const mon = MONSTERS[0];
  const players = [{ id: 'me', name: '나', pet: { key: 'dog', form: 2 } }, { id: 'mon', name: mon.name, pet: { key: mon.temp.pet, form: mon.temp.form, skill: L.skill }, monster: { key: mon.key, level }, hp: L.monsterHp }];
  const s = createBattle({ id: 'sim', players, questions, mode: L.mode, hp: L.hp, timeoutWinner: 'mon', now: 0 });
  connect(s, 'mon', 0); connect(s, 'me', 0);
  const plans = [];
  const plan = () => {
    plans.length = 0;
    const q = s.questions[s.turn.q], spell = q.kind === 'spell', t0 = s.turn.started_at;
    const limit = s.mode === 'skill' ? (spell ? SKILL_RULES.SPELL_TURN_MS : SKILL_RULES.CHOICE_TURN_MS) : BATTLE.TURN_MS;
    // the monster (battle-bot.js planAnswer)
    const delay = spell ? 2600 + (L.min + random() * (L.max - L.min)) * 1.35 : L.min + random() * (L.max - L.min);
    if (delay < limit - 120) {
      let choice;
      if (spell) choice = random() < L.accuracy * .88 ? q.text : q.text + 'x';
      else { const wrong = [0, 1, 2, 3].filter(i => i !== q.answer); choice = random() < L.accuracy ? q.answer : wrong[Math.floor(random() * 3)]; }
      plans.push({ at: t0 + delay, who: 'mon', choice });
    }
    // the student
    const knows = random() < know;
    const ms = spell ? (knows ? 5000 + random() * 5000 : 6000 + random() * 6000) : (knows ? 1600 + random() * 2400 : 3000 + random() * 4000);
    if (ms < limit - 120) plans.push({ at: t0 + ms, who: 'me', choice: spell ? (knows ? q.text : q.text + 'x') : (knows ? q.answer : Math.floor(random() * 4)) });
  };
  let turn = null, guard = 0;
  while (s.phase !== 'finished' && guard++ < 5000) {
    if (s.phase === 'question' && s.turn !== turn) { turn = s.turn; plan(); }
    const wake = nextWake(s);
    const next = plans.length && s.phase === 'question' ? plans.reduce((a, b) => (a.at <= b.at ? a : b)) : null;
    if (next && (wake === null || next.at <= wake)) {
      plans.splice(plans.indexOf(next), 1);
      tick(s, next.at);
      if (s.phase === 'question' && s.turn === turn) answer(s, next.who, next.choice, next.at);
    } else if (wake !== null) tick(s, wake);
    else break;
  }
  const r = s.result || {};
  return { won: r.winner === 'me', right: s.players.me.correct };
}

// Win rate of `n` fights.
export function simulate(stage, level, know, n = 400, seed = 7) {
  const random = seeded(seed + stage * 131 + level.length * 7 + Math.round(know * 1000));
  let wins = 0;
  for (let i = 0; i < n; i++) if (fight(stage, level, know, random).won) wins++;
  return wins / n;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const knows = [0.75, 0.9, 0.98];
  const stages = (process.argv[2] || '1,2,3,5,10,15,20,30,40,60').split(',').map(Number);
  console.log('stage  level   ' + knows.map(k => `knows ${Math.round(k * 100)}%`).join('  '));
  for (const stage of stages) for (const level of ['easy', 'normal', 'hard']) {
    console.log(`${String(stage).padStart(5)}  ${level.padEnd(6)}  ${knows.map(k => `${String(Math.round(simulate(stage, level, k, Number(process.argv[3] || 300)) * 100)).padStart(8)}%`).join('  ')}`);
  }
}
