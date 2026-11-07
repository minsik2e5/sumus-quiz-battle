// V13.223 펫 아레나(놀이터). 판(문제 45개 · 씨앗 · 두 팀)은 서버가 만들고, 끝나면 서버가 같은 전투(arena-rules.js runArena)를
// 다시 돌려 승패 · 보상을 정한다. 화면이 보낸 승패는 믿지 않는다. 고른 자리와 틱만 받는다.
//   p.games.arena { day, plays, games, wins, streak, best_streak, lost, team[[key, form, level] ×3], live{ id, at, a, seed, me, foe, fl, foe_name, bot }, done[영수증] }
import { dayKey, STANDARD_PET_KEYS } from '../public/modules/core.js';
import { ARENA, fighter, teamPower, gradeAnswers, runArena } from '../public/modules/arena-rules.js';
import { dealWalls } from '../public/modules/wall-rules.js';
import { addBonus, findReceipt, keepReceipt, secureRandom } from './rewards.mjs';

const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };
const games = p => p.games ||= {};
const pack = team => team.map(f => [f.key, f.form, f.level]);
const unpack = list => (list || []).map(([key, form, level]) => fighter({ key, form, level }));
const brief = f => ({ key: f.key, form: f.form, level: f.level, hp: f.hp, atk: f.atk, el: f.el, shape: f.shape, rank: f.rank, skill: f.skill });

export function arenaView(p, now = Date.now()) {
  const a = p.games?.arena || {}; // 읽기만
  const plays = a.day === dayKey(now) ? Number(a.plays || 0) : 0;
  return { left: Math.max(0, ARENA.DAILY - plays), daily: ARENA.DAILY, games: Number(a.games || 0), wins: Number(a.wins || 0), streak: Number(a.streak || 0), best_streak: Number(a.best_streak || 0) };
}

// 싸울 수 있는 펫(알이 아닌 펫)을 레벨 순으로. pets: petProgress()의 결과.
export const readyPets = pets => (pets || []).filter(x => Number(x.form) >= 1).sort((a, b) => b.level - a.level || (b.active ? 1 : 0) - (a.active ? 1 : 0));

// 내 팀: 고른 펫(최대 3, 내 펫이고 알이 아닌 것) → 모자라면 레벨 높은 펫으로 채운다.
export function pickTeam(pets, keys = []) {
  const ready = readyPets(pets), byKey = new Map(ready.map(x => [x.key, x]));
  const team = [];
  for (const k of (Array.isArray(keys) ? keys : []).map(String)) if (byKey.has(k) && !team.includes(byKey.get(k)) && team.length < ARENA.TEAM) team.push(byKey.get(k));
  for (const x of ready) if (team.length < ARENA.TEAM && !team.includes(x)) team.push(x);
  return team.map(x => fighter(x));
}

// 상대: 같은 학교 · 학년 친구가 아레나에 남긴 팀(friends: [{ name, team: [[key, form, level], …] }]) 중 힘이 내 팀과 가장 비슷한 몇 팀에서 하나. 없으면 연습 상대(내 팀과 같은 단계의 일반 펫).
export function pickFoe(mine, friends = [], random = secureRandom) {
  const power = teamPower(mine);
  const cands = friends.map(f => ({ name: f.name, team: unpack(f.team).slice(0, ARENA.TEAM) })).filter(f => f.team.length >= Math.min(ARENA.TEAM, mine.length))
    .map(f => ({ ...f, gap: Math.abs(teamPower(f.team) - power) / Math.max(1, power) }))
    .filter(f => f.gap <= 0.45).sort((a, b) => a.gap - b.gap).slice(0, 4);
  if (cands.length) { const c = cands[Math.floor(random() * cands.length)]; return { name: c.name, bot: false, team: c.team }; }
  const keys = STANDARD_PET_KEYS.filter(k => !mine.some(f => f.key === k));
  const team = mine.map(f => { const key = keys.splice(Math.floor(random() * keys.length), 1)[0] || 'dog'; return fighter({ key, form: f.form, level: f.level }); });
  return { name: '연습 상대', bot: true, team };
}

// 상대 필살기 빠르기: 3연승부터 어려움, 2연패부터 쉬움, 나머지 보통.
export const foeLevelOf = a => Number(a?.streak || 0) >= 3 ? 2 : Number(a?.lost || 0) >= 2 ? 0 : 1;

// 판 받기. 하던 판이 있으면 버리고 새로(코인은 끝낼 때만 오가므로 잃을 것이 없다).
export function arenaStart(p, { id, words, missed = [], pets, team: keys, friends = [], now = Date.now(), random = secureRandom }) {
  const me = pickTeam(pets, keys);
  if (!me.length) fail('알에서 깬 펫이 있어야 싸울 수 있어요. 공부해서 펫을 키워 주세요!', 409);
  const questions = [];
  for (let n = 0; n < 4 && questions.length < ARENA.QUESTIONS; n++) {
    const walls = dealWalls(words, { missed: n ? [] : missed, random });
    if (!walls.length) break;
    for (const w of walls) if (questions.length < ARENA.QUESTIONS && questions.at(-1)?.id !== w.id) questions.push({ id: w.id, kind: w.kind, prompt: w.prompt, options: w.options, answer: w.answer });
  }
  if (questions.length < ARENA.QUESTIONS) fail('뜻이 서로 다른 단어가 부족해요. 범위를 더 골라 주세요.', 409);
  const foe = pickFoe(me, friends, random);
  const a = games(p).arena ||= {};
  const seed = Math.floor(random() * 2147483647) + 1, fl = foeLevelOf(a);
  a.team = pack(me); // 친구들이 상대로 만나는 내 팀(마지막으로 나간 팀)
  a.live = { id, at: now, a: questions.map(q => q.answer).join(''), seed, me: pack(me), foe: pack(foe.team), fl, foe_name: foe.name, bot: foe.bot };
  return { id, seed, foe_level: fl, me: me.map(brief), foe: { name: foe.name, bot: foe.bot, team: foe.team.map(brief) }, questions, ...arenaView(p, now) };
}

export function arenaPicks(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, ARENA.QUESTIONS * 2).map(x => Array.isArray(x) ? [Number.isInteger(x[0]) && x[0] >= -1 && x[0] <= 3 ? x[0] : -1, Math.max(0, Math.min(ARENA.MAX_TICKS + 400, Math.round(Number(x[1]) || 0)))] : [-1, 0]);
}

// 끝내기: picks [[고른 자리(-1 = 시간 끝), 틱], …]. 같은 끝내기를 다시 보내면 영수증으로 같은 답.
export function arenaFinish(p, { id, picks, pet = null, now = Date.now() }) {
  const g = games(p), a = g.arena ||= {};
  const seen = findReceipt(g, 'arena', id);
  if (seen) return { ...seen.r, again: true, ...arenaView(p, now) };
  const live = a.live;
  if (!id || !live || live.id !== id) fail('아레나 판을 찾지 못했어요.', 404);
  delete a.live;
  return { ...keepReceipt(g, 'arena', id, arenaSettle(p, a, live, { picks, pet, now }), now), ...arenaView(p, now) };
}

// 문제는 끝없이 돌아가며 나오므로(45개를 다 쓰면 처음부터) 정답도 같은 순서로 이어 붙인다.
export const answersFor = (a, n) => { const base = [...String(a || '')].map(Number); return base.length ? Array.from({ length: n }, (_, i) => base[i % base.length]) : []; };

function arenaSettle(p, a, live, { picks, pet, now }) {
  const list = arenaPicks(picks);
  const graded = gradeAnswers(answersFor(live.a, list.length), list);
  const r = runArena({ seed: live.seed, me: unpack(live.me), foe: unpack(live.foe), foeLevel: live.fl, inputs: graded.inputs });
  const counted = graded.inputs.filter(x => x.t < r.ticks), correct = counted.filter(x => x.ok).length;
  const marks = graded.marks.slice(0, counted.length);
  const base = { winner: r.winner, win: r.winner === 'me', ticks: r.ticks, ults: r.ults.me, left: r.left, correct, wrong: counted.length - correct, marks, foe_name: live.foe_name };
  if (now - live.at > ARENA.STALE_MS) return { ...base, paid: false, reason: 'stale' };
  // 서버가 잰 시간이 카운트다운 + 전투 시간보다 짧으면 끝까지 하지 않았거나(중간에 나감) 화면 시간을 고친 것.
  if (now - live.at + ARENA.SLACK_MS < ARENA.COUNTDOWN_MS + r.ticks * ARENA.TICK_MS) return { ...base, paid: false, reason: 'short' };
  const today = dayKey(now);
  if (a.day !== today) { a.day = today; a.plays = 0; }
  a.games = Number(a.games || 0) + 1;
  if (base.win) { a.wins = Number(a.wins || 0) + 1; a.streak = Number(a.streak || 0) + 1; a.best_streak = Math.max(Number(a.best_streak || 0), a.streak); a.lost = 0; }
  else { a.streak = 0; a.lost = Number(a.lost || 0) + 1; }
  const out = { ...base, streak: a.streak };
  if (Number(a.plays || 0) >= ARENA.DAILY) return { ...out, paid: false, reason: 'daily' };
  const streakCoins = base.win && a.streak % 3 === 0 ? ARENA.STREAK_COINS : 0;
  const coins = base.win ? ARENA.COINS.win + streakCoins : correct >= ARENA.LOSE_MIN_OK ? ARENA.COINS.lose : 0;
  a.plays = Number(a.plays || 0) + 1;
  addBonus(p, { xp: ARENA.XP, coins, pet, now });
  return { ...out, paid: true, coins, streak_coins: streakCoins, xp: ARENA.XP };
}

export const arenaLine = res => `펫 아레나 ${res.win ? '승리' : res.winner === 'draw' ? '무승부' : '패배'} · 맞힘 ${res.correct}${res.paid && res.coins ? ` · ${res.coins}코인` : ''}`;
