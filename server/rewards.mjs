import { randomBytes, randomUUID } from 'node:crypto';
import { buildQuestion, shuffle, dayKey, displayEnglish, englishAccepted, normalizeEnglish } from '../public/modules/core.js';
import { normalizeTyped } from '../public/modules/battle-engine.js';
import { spellable, spellHint } from '../public/modules/battle-questions.js';
import {
  ATTENDANCE_REWARDS, ATTENDANCE_TICKETS, GACHA_PRICE, GACHA_PITY, GACHA_TIERS, GACHA_ITEMS, drawCapsule,
  CHANCE_BETS, CHANCE_DAILY, CHANCE_STEPS, CHANCE_MIN_WORDS
} from '../public/modules/rewards.js';

// V13.67 coin rewards and games (rules and odds: public/modules/rewards.js). Everything lives
// on the student's profile:
//   attendance   { last, card, streak, best, total, coins, log[{at, coins}] }
//   gacha        { items{key: count}, pulls, since_rare, tickets, refund, log[{at, key, dup}] }
//   chance       { day, plays, wins, losses, paid, bets, best, log[{at, bet, steps, paid}] }
//   chance_live  the double chance being played, with its answer (never sent: see publicProfile)
// Coins received here (attendance, capsule refunds, double chance pay-outs) are added to the
// balance in service.mjs pointsAndPets; coins paid (capsules, bets) go to points_spent.

const DAY_MS = 86400000;
const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };
export const secureRandom = () => randomBytes(4).readUInt32BE(0) / 2 ** 32;
const CHANCE_GRACE_MS = 1500;   // network delay allowed after a question's time
const CHANCE_ABANDON_MS = 5000; // a question left open this long after its time is lost

export function rewardIncome(p) {
  return Number(p?.attendance?.coins || 0) + Number(p?.gacha?.refund || 0) + Number(p?.chance?.paid || 0);
}
// Coins from attendance inside a period (the coin ranking counts them like study rewards).
export function attendanceCoins(p, window = null) {
  const a = p?.attendance;
  if (!a) return 0;
  if (!window) return Number(a.coins || 0);
  return (a.log || []).filter(x => x.at >= window.start && x.at < window.end).reduce((n, x) => n + Number(x.coins || 0), 0);
}

/* ---------- attendance ---------- */
export function attendanceView(p, now = Date.now()) {
  const a = p.attendance || {}, today = dayKey(now), done = a.last === today;
  const card = Number(a.card || 0);
  const alive = a.last === today || a.last === dayKey(now - DAY_MS);
  return {
    done, rewards: ATTENDANCE_REWARDS, tickets_at: ATTENDANCE_REWARDS.length,
    // Stamps on the card; a card finished today still shows all seven until tomorrow.
    stamps: done && card === 0 && a.total ? ATTENDANCE_REWARDS.length : card,
    next: ATTENDANCE_REWARDS[done ? card % ATTENDANCE_REWARDS.length : card],
    streak: alive ? Number(a.streak || 0) : 0, best: Number(a.best || 0), total: Number(a.total || 0)
  };
}
export function checkIn(p, now = Date.now()) {
  const a = p.attendance ||= {};
  const today = dayKey(now);
  if (a.last === today) fail('오늘은 이미 출석했어요. 내일 또 만나요!', 409);
  const stamp = Number(a.card || 0) + 1;
  const coins = ATTENDANCE_REWARDS[stamp - 1];
  a.streak = a.last === dayKey(now - DAY_MS) ? Number(a.streak || 0) + 1 : 1;
  a.best = Math.max(Number(a.best || 0), a.streak);
  a.total = Number(a.total || 0) + 1;
  a.coins = Number(a.coins || 0) + coins;
  a.last = today;
  a.log = [...(a.log || []), { at: now, coins }].slice(-40);
  let tickets = 0;
  if (stamp >= ATTENDANCE_REWARDS.length) {
    a.card = 0;
    tickets = ATTENDANCE_TICKETS;
    const g = p.gacha ||= {};
    g.tickets = Number(g.tickets || 0) + tickets;
  } else a.card = stamp;
  return { stamp, coins, tickets, attendance: attendanceView(p, now) };
}

/* ---------- capsule machine ---------- */
export function gachaView(p) {
  const g = p.gacha || {};
  return {
    price: GACHA_PRICE, pity: GACHA_PITY, tiers: GACHA_TIERS, items: g.items || {}, pulls: Number(g.pulls || 0),
    tickets: Number(g.tickets || 0), since_rare: Number(g.since_rare || 0),
    recent: (g.log || []).slice(-8).reverse()
  };
}
export function pullCapsule(p, balance, { ticket = false, random = secureRandom, now = Date.now() } = {}) {
  const g = p.gacha ||= {};
  g.items ||= {};
  if (ticket) {
    if (!(Number(g.tickets || 0) > 0)) fail('뽑기권이 없어요. 출석 7번째 도장에서 받아요!', 409);
    g.tickets = Number(g.tickets) - 1;
  } else {
    if (balance < GACHA_PRICE) fail(`코인이 ${GACHA_PRICE - balance}개 부족해요.`);
    p.points_spent = Number(p.points_spent || 0) + GACHA_PRICE;
  }
  const got = drawCapsule(random, Number(g.since_rare || 0));
  const dup = Number(g.items[got.key] || 0) > 0;
  g.items[got.key] = Number(g.items[got.key] || 0) + 1;
  g.pulls = Number(g.pulls || 0) + 1;
  g.since_rare = got.tier === 'common' ? Number(g.since_rare || 0) + 1 : 0;
  const refund = dup ? GACHA_TIERS[got.tier].refund : 0;
  g.refund = Number(g.refund || 0) + refund;
  g.log = [...(g.log || []), { at: now, key: got.key, dup }].slice(-20);
  return { key: got.key, tier: got.tier, item: GACHA_ITEMS[got.key], dup, refund, pity: got.pity, ticket, gacha: gachaView(p) };
}

/* ---------- word double chance ---------- */
function chanceDay(p, now) {
  const c = p.chance ||= {};
  const today = dayKey(now);
  if (c.day !== today) { c.day = today; c.plays = 0; }
  return c;
}
function chanceLog(p, live, paid, now) {
  const c = p.chance ||= {};
  if (paid) { c.paid = Number(c.paid || 0) + paid; c.wins = Number(c.wins || 0) + 1; }
  else c.losses = Number(c.losses || 0) + 1;
  c.best = Math.max(Number(c.best || 0), paid ? live.step + 1 : live.step);
  c.log = [...(c.log || []), { at: now, bet: live.bet, steps: paid ? live.step + 1 : live.step, paid }].slice(-20);
  delete p.chance_live;
}
// A question left open (the student closed the app) is lost once its time is well past.
export function chanceTidy(p, now = Date.now()) {
  const live = p.chance_live;
  if (abandoned(live, now)) { chanceLog(p, live, 0, now); return true; }
  return false;
}
function liveView(live, now) {
  const q = live.q, step = CHANCE_STEPS[live.step];
  return {
    id: live.id, bet: live.bet, step: live.step, pot: live.pot, status: live.status,
    next_pot: live.status === 'decide' && CHANCE_STEPS[live.step + 1] ? live.bet * CHANCE_STEPS[live.step + 1].mult : null,
    question: live.status === 'question' && q ? { kind: q.kind, dir: step.dir || null, prompt: q.prompt, options: q.options || [], hint: q.hint || '', left: Math.max(0, live.deadline - now), ms: step.ms } : null
  };
}
// Read-only (GET requests do not save): a question left open past its time shows as over; it is
// recorded as lost by the next double-chance request (chanceTidy).
const abandoned = (live, now) => live?.status === 'question' && now > live.deadline + CHANCE_ABANDON_MS;
export function chanceView(p, now = Date.now()) {
  const c = p.chance || {}, today = dayKey(now);
  const plays = c.day === today ? Number(c.plays || 0) : 0;
  return {
    bets: CHANCE_BETS, daily: CHANCE_DAILY, left: Math.max(0, CHANCE_DAILY - plays),
    steps: CHANCE_STEPS.map(s => ({ kind: s.kind, name: s.name, mult: s.mult, ms: s.ms })),
    wins: Number(c.wins || 0), losses: Number(c.losses || 0), paid: Number(c.paid || 0), best: Number(c.best || 0),
    live: p.chance_live && !abandoned(p.chance_live, now) ? liveView(p.chance_live, now) : null
  };
}
// `words`: the words the student has studied (word objects); the question is one not asked yet
// in this run. The last step is spelled, so it needs a word that can be typed.
function askStep(live, words, now, random) {
  const step = CHANCE_STEPS[live.step];
  let pool = words.filter(w => !live.used.includes(w.id));
  if (step.kind === 'spell') pool = pool.filter(spellable);
  if (!pool.length) pool = step.kind === 'spell' ? words.filter(spellable) : words;
  if (!pool.length) fail('철자를 쓸 수 있는 단어가 부족해요.', 409);
  const word = pool[Math.floor(random() * pool.length)];
  let q;
  if (step.kind === 'spell') {
    const text = normalizeEnglish(word.word);
    q = { kind: 'spell', prompt: String(word.meaning).trim(), hint: spellHint(text), text, accept: englishAccepted(word.word) };
  } else {
    const built = buildQuestion(word, step.dir === 'mean2eng' ? 'mean2eng_mc' : 'eng2mean_mc', words);
    const right = step.dir === 'mean2eng' ? displayEnglish(word.word) : word.meaning;
    q = { kind: 'choice', prompt: built.prompt, options: built.options, answer: built.options.indexOf(right) };
    if (q.options.length !== 4 || q.answer < 0) fail('뜻이 서로 다른 단어가 부족해요. 단어를 더 공부해요!', 409);
  }
  live.q = { word_id: word.id, ...q };
  live.used.push(word.id);
  live.status = 'question';
  live.deadline = now + step.ms;
}
export function chanceStart(p, bet, balance, words, { now = Date.now(), random = secureRandom } = {}) {
  chanceTidy(p, now);
  if (!CHANCE_BETS.includes(bet)) fail('걸 코인을 골라주세요.');
  if (p.chance_live) fail('진행 중인 더블 찬스가 있어요.', 409);
  const c = chanceDay(p, now);
  if (Number(c.plays || 0) >= CHANCE_DAILY) fail(`더블 찬스는 하루 ${CHANCE_DAILY}번까지예요. 내일 또 도전해요!`, 409);
  if (words.length < CHANCE_MIN_WORDS) fail(`단어를 ${CHANCE_MIN_WORDS}개 이상 공부하면 도전할 수 있어요.`, 409);
  if (balance < bet) fail(`코인이 ${bet - balance}개 부족해요.`);
  const live = { id: randomUUID(), bet, step: 0, pot: bet, used: [], started_at: now };
  askStep(live, shuffle(words), now, random);
  p.points_spent = Number(p.points_spent || 0) + bet;
  c.plays = Number(c.plays || 0) + 1;
  c.bets = Number(c.bets || 0) + bet;
  p.chance_live = live;
  return { chance: chanceView(p, now) };
}
export function chanceAnswer(p, answer, now = Date.now()) {
  const live = p.chance_live;
  if (!live || live.status !== 'question') fail('지금은 답할 문제가 없어요.', 409);
  const q = live.q, late = now > live.deadline + CHANCE_GRACE_MS;
  const right = !late && (q.kind === 'spell'
    ? typeof answer === 'string' && answer.length <= 60 && q.accept.includes(normalizeTyped(answer))
    : Number.isInteger(answer) && answer === q.answer);
  const reveal = q.kind === 'spell' ? { word: q.text, meaning: q.prompt } : { right_option: q.answer, word: q.options[q.answer] };
  if (!right) {
    const lost = live.pot;
    chanceLog(p, live, 0, now);
    return { right: false, late, reveal, lost, chance: chanceView(p, now) };
  }
  live.pot = live.bet * CHANCE_STEPS[live.step].mult;
  live.q = null;
  if (live.step === CHANCE_STEPS.length - 1) {
    const paid = live.pot;
    chanceLog(p, live, paid, now);
    return { right: true, reveal, paid, done: true, chance: chanceView(p, now) };
  }
  live.status = 'decide';
  return { right: true, reveal, pot: live.pot, chance: chanceView(p, now) };
}
// After a right answer: keep the pot (go = false) or answer the next, harder word.
export function chanceDecide(p, go, words, { now = Date.now(), random = secureRandom } = {}) {
  const live = p.chance_live;
  if (!live || live.status !== 'decide') fail('지금은 고를 수 없어요.', 409);
  if (!go) {
    const paid = live.pot;
    chanceLog(p, live, paid, now);
    return { paid, chance: chanceView(p, now) };
  }
  live.step++;
  askStep(live, shuffle(words), now, random);
  return { chance: chanceView(p, now) };
}
