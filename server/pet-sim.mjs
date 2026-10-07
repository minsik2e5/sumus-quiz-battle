// V13.110 펫 특기 밸런스 시뮬레이션: the real battle engine (public/modules/battle-engine.js) on a
// virtual clock, two students who know the same share of the words, each with a pet. A pet's skill
// should win about as often as any other's (V13.72: 47–54% against the field in both modes).
// `node server/pet-sim.mjs [games per pair]` prints each pet's win rate against all the others.
import { createBattle, connect, answer, tick, nextWake, BATTLE, SKILL_RULES, PET_SKILLS } from '../public/modules/battle-engine.js';
import { battleQuestions } from '../public/modules/battle-questions.js';
import { seeded } from './monster-sim.mjs';

const WORDS = Array.from({ length: 60 }, (_, i) => ({ id: 'p' + i, word: ['apple', 'river', 'borrow', 'gentle', 'harvest', 'island', 'journey', 'kitchen', 'ladder', 'mirror'][i % 10] + 'abcdefghij'[Math.floor(i / 10)], meaning: '뜻' + i, range_code: '1' }));

// One match of pet `a` (player A) against pet `b` (player B). Both know `know` of the words and
// answer like monster-sim's student. Returns 1 (A won), 0 (B won) or .5 (a draw).
export function duel(a, b, mode, know, random) {
  const realRandom = Math.random;
  Math.random = random;
  let questions;
  try { questions = battleQuestions(WORDS, mode, 40); } finally { Math.random = realRandom; }
  const players = [{ id: 'A', name: 'A', pet: { key: a, form: 2 } }, { id: 'B', name: 'B', pet: { key: b, form: 2 } }];
  const s = createBattle({ id: 'sim', players, questions, mode, now: 0 });
  connect(s, 'A', 0); connect(s, 'B', 0);
  const plans = [];
  const plan = () => {
    plans.length = 0;
    const q = s.questions[s.turn.q], spell = q.kind === 'spell', t0 = s.turn.started_at;
    const limit = s.mode === 'skill' ? (spell ? SKILL_RULES.SPELL_TURN_MS : SKILL_RULES.CHOICE_TURN_MS) : BATTLE.TURN_MS;
    for (const who of ['A', 'B']) {
      const knows = random() < know;
      const ms = spell ? (knows ? 5000 + random() * 5000 : 6000 + random() * 6000) : (knows ? 1600 + random() * 2400 : 3000 + random() * 4000);
      if (ms < limit - 120) plans.push({ at: t0 + ms, who, choice: spell ? (knows ? q.text : q.text + 'x') : (knows ? q.answer : Math.floor(random() * 4)) });
    }
  };
  let turn = null, guard = 0;
  while (s.phase !== 'finished' && guard++ < 6000) {
    if (s.phase === 'question' && s.turn !== turn) { turn = s.turn; plan(); }
    const wake = nextWake(s);
    const next = plans.length && s.phase === 'question' ? plans.reduce((x, y) => (x.at <= y.at ? x : y)) : null;
    if (next && (wake === null || next.at <= wake)) {
      plans.splice(plans.indexOf(next), 1);
      tick(s, next.at);
      if (s.phase === 'question' && s.turn === turn) answer(s, next.who, next.choice, next.at);
    } else if (wake !== null) tick(s, wake);
    else break;
  }
  const w = s.result?.winner;
  return w === 'A' ? 1 : w === 'B' ? 0 : .5;
}

// Each pet's win rate against every other pet (both sides, `n` games per pair and mode).
export function field(pets = Object.keys(PET_SKILLS), { n = 120, know = .82, modes = ['speed', 'skill'], seed = 11 } = {}) {
  const out = {};
  for (const mode of modes) {
    const random = seeded(seed + (mode === 'skill' ? 7 : 0));
    const score = Object.fromEntries(pets.map(p => [p, 0])), games = Object.fromEntries(pets.map(p => [p, 0]));
    for (const a of pets) for (const b of pets) {
      if (a === b) continue;
      for (let i = 0; i < n; i++) { const r = duel(a, b, mode, know, random); score[a] += r; score[b] += 1 - r; games[a]++; games[b]++; }
    }
    out[mode] = Object.fromEntries(pets.map(p => [p, score[p] / games[p]]));
  }
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const n = Number(process.argv[2] || 60);
  const r = field(Object.keys(PET_SKILLS), { n });
  console.log('pet         speed   skill');
  for (const p of Object.keys(PET_SKILLS)) console.log(`${p.padEnd(10)} ${(r.speed[p] * 100).toFixed(1).padStart(6)}% ${(r.skill[p] * 100).toFixed(1).padStart(6)}%`);
}
