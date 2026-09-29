// V13.66 academy yacha tournaments (학원 대회): a single-elimination bracket a teacher opens
// for students of one school and grade. Matches are ordinary yacha rooms without a stake;
// a finished room decides its match (server/service.mjs, settleBattle) and the winner moves
// on. A draw is played again. The teacher can decide a match (e.g. a student is absent).
//
// state.tournaments[]: { id, name, teacher_id, school_id, school, division, grade, class_name,
//   range_codes, prize, status: 'active'|'finished'|'cancelled', created_at, finished_at,
//   players: [student ids in seed order], rounds: [[{ id, a, b, winner, loser, by, draws }]],
//   champion, runner_up }

export const TOURNAMENT_MIN_PLAYERS = 2;
export const TOURNAMENT_MAX_PLAYERS = 32;
export const TOURNAMENT_PRIZES = [0, 50, 100, 200];

// 1 v 8, 4 v 5, 2 v 7, 3 v 6 ...: the top seeds meet last and byes go to them.
export function seedOrder(size) {
  let order = [1, 2];
  while (order.length < size) { const n = order.length * 2 + 1; order = order.flatMap(seed => [seed, n - seed]); }
  return order.slice(0, size);
}
export function roundLabel(matches) {
  return matches === 1 ? '결승' : `${matches * 2}강`;
}
export function buildBracket(players) {
  let size = 2;
  while (size < players.length) size *= 2;
  const order = seedOrder(size);
  const rounds = [];
  const first = [];
  for (let i = 0; i < size; i += 2) first.push({ id: `r0m${i / 2}`, a: players[order[i] - 1] || null, b: players[order[i + 1] - 1] || null, winner: null });
  rounds.push(first);
  for (let matches = size / 4, r = 1; matches >= 1; matches /= 2, r++) rounds.push(Array.from({ length: matches }, (_, j) => ({ id: `r${r}m${j}`, a: null, b: null, winner: null })));
  return rounds;
}
export function findMatch(t, matchId) {
  for (let r = 0; r < (t?.rounds || []).length; r++) {
    const i = t.rounds[r].findIndex(m => m.id === matchId);
    if (i >= 0) return { round: r, index: i, match: t.rounds[r][i] };
  }
  return null;
}
// Decides a match and moves the winner on; the final decides the tournament.
export function decideMatch(t, matchId, winner, by, now = Date.now()) {
  const found = findMatch(t, matchId);
  if (!found || t.status !== 'active') return false;
  const { round, index, match } = found;
  if (match.winner || ![match.a, match.b].includes(winner) || !winner) return false;
  match.winner = winner;
  match.loser = winner === match.a ? match.b : match.a;
  match.by = by;
  match.decided_at = now;
  delete match.battle_id;
  if (round === t.rounds.length - 1) {
    Object.assign(t, { champion: winner, runner_up: match.loser || null, status: 'finished', finished_at: now });
    return true;
  }
  const next = t.rounds[round + 1][Math.floor(index / 2)];
  next[index % 2 === 0 ? 'a' : 'b'] = winner;
  return true;
}
// First-round matches with one player are byes (부전승).
export function resolveByes(t, now = Date.now()) {
  for (const match of t.rounds[0]) {
    if (match.winner) continue;
    if (match.a && !match.b) decideMatch(t, match.id, match.a, 'bye', now);
    else if (!match.a && match.b) decideMatch(t, match.id, match.b, 'bye', now);
  }
}
export function createTournament({ id, name, teacher, school, grade, className, players, rangeCodes, prize, now = Date.now() }) {
  const t = {
    id, name, teacher_id: teacher.id, school_id: school.id, school: school.name, division: school.division,
    grade, class_name: className || null, range_codes: rangeCodes, prize, status: 'active', created_at: now,
    players: [...players], rounds: buildBracket(players), champion: null, runner_up: null
  };
  resolveByes(t, now);
  return t;
}
// The match a player has to play now (both players known, not decided yet).
export function playerMatch(t, pid) {
  if (t?.status !== 'active') return null;
  for (let r = 0; r < t.rounds.length; r++) {
    const i = t.rounds[r].findIndex(m => !m.winner && (m.a === pid || m.b === pid));
    if (i >= 0) return { round: r, index: i, match: t.rounds[r][i], label: roundLabel(t.rounds[r].length), ready: !!(t.rounds[r][i].a && t.rounds[r][i].b) };
  }
  return null;
}
// Where a player's run ended: the round they lost, or null while still in it.
export function eliminatedIn(t, pid) {
  for (let r = 0; r < t.rounds.length; r++) if (t.rounds[r].some(m => m.loser === pid)) return roundLabel(t.rounds[r].length);
  return null;
}
// Coins from finished tournaments: the prize for the champion, half for the runner-up.
export function tournamentPrizes(state, pid, window = null) {
  let total = 0;
  for (const t of state.tournaments || []) {
    if (t.status !== 'finished' || !t.prize) continue;
    if (window && !(t.finished_at >= window.start && t.finished_at < window.end)) continue;
    if (t.champion === pid) total += t.prize;
    else if (t.runner_up === pid) total += Math.floor(t.prize / 2);
  }
  return total;
}
