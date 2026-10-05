import { randomBytes } from 'node:crypto';
import { dayKey, ACCESSORIES, PET_CARE, PET_MISS_DAYS, LEGENDARY_PET_KEYS, EPIC_PET_KEYS, EPIC_EGG_LEGENDARY_RATE } from '../public/modules/core.js';
import {
  ATTENDANCE_REWARDS, ATTENDANCE_TICKETS, LUCKY_BETS, LUCKY_DAILY, LUCKY_TICKET_BET, LUCKY_ODDS, LEGENDARY_RATE, LEGENDARY_PITY, EPIC_RATE, drawLucky,
  BOT_DAILY, BOT_MIN_RIGHT, BOT_MIN_MS, botReward, EXAM_XP_PER_ANSWER, EXAM_COINS, GIFT_AMOUNTS, GIFT_NOTE_MAX, GIFT_LOG_KEEP,
  RPS_BETS, RPS_DAILY, RPS_MAX_WINS, RPS_KEYS, RPS_STALE_MS, rpsOutcome
} from '../public/modules/rewards.js';
import { titleCoins } from '../public/modules/titles.js';
import { MONSTER_LEVELS, MONSTER_DAILY, MONSTER_MIN_MS, MONSTER_MS_PER_RIGHT, MONSTER_TRY, MONSTER_LEVEL_KEYS, monsterOpen, partClears, partKeyCodes, stageLevel, cleanStage, stageMonster } from '../public/modules/monsters.js';

// Coin rewards and games (rules and odds: public/modules/rewards.js). Everything lives on the
// student's profile:
//   attendance   { last, card, streak, best, total, coins, log[{at, coins}] }
//   title_reward { total, keys[] } V13.73 coins paid for titles (keys already paid)
//   gift_box     { total, count, log[{id, amount, note, from, from_name, at, opened}] } V13.73
//   gacha        { items{key: count}, tickets, refund } decorations from the retired V13.67
//                capsule machine (kept and worn) and free coin capsules (뽑기권)
//   lucky        V13.68 coin capsule { day, plays, bets, paid, log[{at, bet, mult, ticket}] }
//   chance       the V13.67 word double chance (retired in V13.70): { paid } still counts
//   chance_live  a double chance left open when it was retired: its bet (or the pot it had
//                reached) comes back (never sent: see publicProfile)
//   bonus        V13.70 { log[{d, k, xp, c, at}], bot{day, count}, bot_live{id, level, mode, at} }
//                경험치 and coins from robot matches and teacher exams, one entry per day and pet
//                V13.101 done[{id, k, at, r}]: receipts of the last finished robot matches and
//                monster fights (see keepReceipt)
// Coins received here (attendance, old capsule refunds, coin capsule and double chance pay-outs)
// are added to the balance in service.mjs pointsAndPets; coins paid (capsules, bets) go to
// points_spent. Bonus 경험치 and coins join the student's records as bonus rows (bonusRecords).

const DAY_MS = 86400000;
const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };
export const secureRandom = () => randomBytes(4).readUInt32BE(0) / 2 ** 32;

export function rewardIncome(p) {
  return Number(p?.attendance?.coins || 0) + Number(p?.gacha?.refund || 0) + Number(p?.chance?.paid || 0) + Number(p?.lucky?.paid || 0) + chanceRefund(p)
    + Number(p?.title_reward?.total || 0) + Number(p?.gift_box?.total || 0)
    // V13.82: 가위바위보 pay-outs and shares sold in 문법 증권거래소 (bets and buys are points_spent).
    + Number(p?.rps?.paid || 0) + Number(p?.stocks?.paid || 0);
}

/* ---------- V13.73 title coins ---------- */
// A title pays its coins once (TITLE_COINS by tier), when the student sees it; titles held
// before V13.73 are paid the same way the first time the app shows them. `payKey` is the
// title key, or key@week for a limited title (paid again each week it is won). Keys of older
// weeks are dropped: those weeks cannot come back. The total is kept apart from the keys.
export function unpaidTitles(p, keys, payKey) {
  const paid = new Set(p?.title_reward?.keys || []);
  return keys.filter(key => titleCoins(key) > 0 && !paid.has(payKey(key))).map(key => ({ key, coins: titleCoins(key) }));
}
export function payTitles(p, keys, payKey, weekKey) {
  const r = p.title_reward ||= { total: 0, keys: [] };
  r.keys = (r.keys || []).filter(k => !k.includes('@') || k.endsWith('@' + weekKey));
  const paid = unpaidTitles(p, keys, payKey);
  for (const x of paid) { r.keys.push(payKey(x.key)); r.total = Number(r.total || 0) + x.coins; }
  return paid;
}

/* ---------- V13.73 teacher coin gifts ---------- */
// The coins count as soon as a gift is sent (`total`); the box on the student's screen is only
// the moment of opening it. The log keeps the last GIFT_LOG_KEEP gifts (all unopened ones).
export function giveGift(p, { amount, note = '', from, fromName, now = Date.now(), id }) {
  if (!GIFT_AMOUNTS.includes(amount)) fail('선물할 코인을 골라주세요.');
  const box = p.gift_box ||= { total: 0, count: 0, log: [] };
  box.total = Number(box.total || 0) + amount;
  box.count = Number(box.count || 0) + 1;
  const log = [...(box.log || []), { id, amount, note: String(note || '').trim().slice(0, GIFT_NOTE_MAX), from, from_name: fromName, at: now, opened: false }];
  const opened = log.filter(g => g.opened), closed = log.filter(g => !g.opened);
  box.log = [...opened.slice(-Math.max(0, GIFT_LOG_KEEP - closed.length)), ...closed].sort((a, b) => a.at - b.at);
  return box;
}
export const giftsWaiting = p => (p?.gift_box?.log || []).filter(g => !g.opened).map(g => ({ id: g.id, amount: g.amount, note: g.note, from_name: g.from_name, at: g.at }));
export function openGifts(p, now = Date.now()) {
  const waiting = giftsWaiting(p);
  for (const g of p?.gift_box?.log || []) if (!g.opened) { g.opened = true; g.opened_at = now; }
  return waiting;
}
// V13.70 the double chance is gone; one left open gives back its bet, or the pot a right answer
// had already reached (the student could have kept it).
function chanceRefund(p) {
  const live = p?.chance_live;
  if (!live) return 0;
  return live.status === 'decide' ? Number(live.pot || live.bet || 0) : Number(live.bet || 0);
}
// Coins from attendance inside a period (the coin ranking counts them like study rewards).
export function attendanceCoins(p, window = null) {
  const a = p?.attendance;
  if (!a) return 0;
  if (!window) return Number(a.coins || 0);
  return (a.log || []).filter(x => x.at >= window.start && x.at < window.end).reduce((n, x) => n + Number(x.coins || 0), 0);
}

/* ---------- V13.71 profile logs stay small (profiles are backed up as one part) ---------- */
// Attendance coins count toward this week's and last week's rankings, so 15 days is enough;
// the coin capsule shows its last six pulls. The old capsule and double-chance logs are unused.
const ATTENDANCE_LOG_DAYS = 15;
const LUCKY_LOG_KEEP = 6;
function trimAttendanceLog(log, now) {
  const cut = now - ATTENDANCE_LOG_DAYS * DAY_MS;
  return log.filter(x => Number(x?.at || 0) >= cut);
}
export function tidyProfileLogs(state, now = Date.now()) {
  let changed = false;
  for (const p of state.profiles || []) {
    const a = p.attendance;
    if (Array.isArray(a?.log)) { const next = trimAttendanceLog(a.log, now); if (next.length !== a.log.length) { a.log = next; changed = true; } }
    const l = p.lucky;
    if (Array.isArray(l?.log) && l.log.length > LUCKY_LOG_KEEP) { l.log = l.log.slice(-LUCKY_LOG_KEEP); changed = true; }
    if (p.gacha && 'log' in p.gacha) { delete p.gacha.log; changed = true; }
    if (p.chance && 'log' in p.chance) { delete p.chance.log; changed = true; }
    if (refundRemovedBadges(p)) changed = true;
    const b = p.bonus;
    if (Array.isArray(b?.done)) { const next = trimReceipts(b.done, now); if (next.length !== b.done.length) { b.done = next; changed = true; } }
  }
  return changed;
}
// V13.68 removed the capsule badges but kept them on students (worn ones broke saving a new
// look) and never paid them back. Each badge kind a student owned is paid back once at the
// capsule price (duplicates already paid their part back), and a worn badge goes back to
// '기본'. The badge entries are removed, so this cannot pay twice.
export const BADGE_REFUND = 60;
export function refundRemovedBadges(p) {
  let changed = false;
  const g = p.gacha;
  const badges = Object.keys(g?.items || {}).filter(key => key.startsWith('badge_') && Number(g.items[key]) > 0);
  if (badges.length) {
    const coins = BADGE_REFUND * badges.length;
    g.refund = Number(g.refund || 0) + coins;
    g.badge_refund = Number(g.badge_refund || 0) + coins;
    for (const key of badges) delete g.items[key];
    changed = true;
  }
  if (typeof p.avatar_accessory === 'string' && !Object.hasOwn(ACCESSORIES, p.avatar_accessory)) { p.avatar_accessory = 'none'; changed = true; }
  return changed;
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
  a.log = trimAttendanceLog([...(a.log || []), { at: now, coins }], now);
  let tickets = 0;
  if (stamp >= ATTENDANCE_REWARDS.length) {
    a.card = 0;
    tickets = ATTENDANCE_TICKETS;
    const g = p.gacha ||= {};
    g.tickets = Number(g.tickets || 0) + tickets;
  } else a.card = stamp;
  return { stamp, coins, tickets, attendance: attendanceView(p, now) };
}

/* ---------- decorations kept from the V13.67 capsule machine ---------- */
export function gachaView(p) {
  const g = p.gacha || {};
  return { items: g.items || {}, tickets: Number(g.tickets || 0) };
}

/* ---------- V13.68 coin capsule (코인 뽑기) ---------- */
export function luckyView(p, now = Date.now()) {
  const l = p.lucky || {}, today = dayKey(now);
  const plays = l.day === today ? Number(l.plays || 0) : 0;
  const legendary = (p.pets || []).find(pet => LEGENDARY_PET_KEYS.includes(pet.key));
  const legendPulls = Math.max(0, Number(l.legend_pulls || 0));
  return {
    bets: LUCKY_BETS, daily: LUCKY_DAILY, left: Math.max(0, LUCKY_DAILY - plays), odds: LUCKY_ODDS,
    ticket_bet: LUCKY_TICKET_BET, tickets: Number(p.gacha?.tickets || 0),
    recent: (l.log || []).slice(-6).reverse(),
    today_net: l.net_day === today ? Number(l.net || 0) : null,
    legend: { rate: LEGENDARY_RATE, pity: LEGENDARY_PITY, pulls: legendPulls, remaining: legendary ? 0 : Math.max(0, LEGENDARY_PITY - legendPulls), owned: !!legendary, key: legendary?.key || null },
    epic: { rate: EPIC_RATE, left: EPIC_PET_KEYS.filter(key => !(p.pets || []).some(pet => pet.key === key)).length, total: EPIC_PET_KEYS.length }
  };
}
// A ticket plays a 10-coin capsule for free and does not count toward the three a day.
export function pullLucky(p, bet, balance, { ticket = false, random = secureRandom, now = Date.now() } = {}) {
  const l = p.lucky ||= {};
  const today = dayKey(now);
  if (l.day !== today) { l.day = today; l.plays = 0; }
  if (ticket) {
    const g = p.gacha ||= {};
    if (!(Number(g.tickets || 0) > 0)) fail('뽑기권이 없어요. 출석 7번째 도장에서 받아요!', 409);
    g.tickets = Number(g.tickets) - 1;
    bet = LUCKY_TICKET_BET;
  } else {
    if (!LUCKY_BETS.includes(bet)) fail('걸 코인을 골라주세요.');
    if (Number(l.plays || 0) >= LUCKY_DAILY) fail(`코인 뽑기는 하루 ${LUCKY_DAILY}번까지예요. 내일 또 만나요!`, 409);
    if (balance < bet) fail(`코인이 ${bet - balance}개 부족해요.`);
    p.points_spent = Number(p.points_spent || 0) + bet;
    l.plays = Number(l.plays || 0) + 1;
    l.bets = Number(l.bets || 0) + bet;
  }
  const odd = drawLucky(random);
  const paid = bet * odd.mult;
  let legendary = null;
  const hasLegend = (p.pets || []).some(pet => LEGENDARY_PET_KEYS.includes(pet.key));
  if (!hasLegend) {
    l.legend_pulls = Number(l.legend_pulls || 0) + 1;
    const guaranteed = l.legend_pulls >= LEGENDARY_PITY;
    if (guaranteed || random() * 100 < LEGENDARY_RATE) {
      const key = LEGENDARY_PET_KEYS[Math.min(LEGENDARY_PET_KEYS.length - 1, Math.floor(random() * LEGENDARY_PET_KEYS.length))];
      (p.pets ||= []).push({ key, acquired_at: now, legendary: true });
      p.avatar_key = key;
      l.legend_key = key;
      l.legend_at = now;
      legendary = { key, guaranteed, pull: l.legend_pulls };
    }
  }
  // V13.92: not legendary this time, then a 3% chance of a 영웅 egg the student has not met yet.
  let epic = null;
  const epicLeft = EPIC_PET_KEYS.filter(key => !(p.pets || []).some(pet => pet.key === key));
  if (!legendary && (p.pets || []).length && epicLeft.length && random() * 100 < EPIC_RATE) {
    const key = epicLeft[Math.min(epicLeft.length - 1, Math.floor(random() * epicLeft.length))];
    p.pets.push({ key, acquired_at: now, epic: true });
    p.avatar_key = key;
    epic = { key };
  }
  l.paid = Number(l.paid || 0) + paid;
  // V13.98: today's net, kept apart from the log (which keeps only the last few pulls).
  if (l.net_day !== today) { l.net_day = today; l.net = 0; }
  l.net = Number(l.net || 0) + (ticket ? paid : paid - bet);
  l.log = [...(l.log || []), { at: now, bet, mult: odd.mult, ticket, ...(legendary ? { legendary: legendary.key } : {}), ...(epic ? { epic: epic.key } : {}) }].slice(-LUCKY_LOG_KEEP);
  return { bet, mult: odd.mult, name: odd.name, paid, ticket, legendary, epic, lucky: luckyView(p, now) };
}

/* ---------- 알 상점 ---------- */
// Opens a bought egg (the price is paid by the caller). `missing` are the pets of that egg the
// student has not met yet. V13.98: a 영웅 알 opens as a legendary pet EPIC_EGG_LEGENDARY_RATE% of
// the time for a student who has none yet (a student owns at most one legendary pet).
export function openEgg(p, { epic, missing, price, random = secureRandom, now = Date.now() }) {
  const hasLegend = (p.pets || []).some(pet => LEGENDARY_PET_KEYS.includes(pet.key));
  const legendary = !!epic && !hasLegend && random() * 100 < EPIC_EGG_LEGENDARY_RATE;
  const pool = legendary ? LEGENDARY_PET_KEYS : missing;
  const key = pool[Math.min(pool.length - 1, Math.floor(random() * pool.length))];
  (p.pets ||= []).push({ key, acquired_at: now, ...(legendary ? { legendary: true } : epic ? { epic: true } : {}) });
  p.points_spent = Number(p.points_spent || 0) + price;
  (p.purchases ||= []).push({ item: epic ? 'epic_egg' : 'egg', key, price, at: now, ...(legendary ? { legendary: true } : {}) });
  p.avatar_key = key;
  if (legendary) { const l = p.lucky ||= {}; l.legend_key = key; l.legend_at = now; }
  return { key, legendary };
}

/* ---------- V13.82 가위바위보 ---------- */
//   rps { day, plays, bets, paid, wins_total, best, live: { id, bet, pot, wins, ties, await: 'pick'|'choice', at }, log[] }
// A week of games (five a day), for the weekly ×8 명예의 전당.
const RPS_LOG_KEEP = 36;
const RPS_HANDS_KEEP = 8;
export function rpsView(p, now = Date.now()) {
  const r = p.rps || {}, today = dayKey(now);
  const plays = r.day === today ? Number(r.plays || 0) : 0;
  const live = r.live ? { bet: r.live.bet, pot: r.live.pot, wins: r.live.wins, await: r.live.await } : null;
  return {
    bets: RPS_BETS, daily: RPS_DAILY, left: Math.max(0, RPS_DAILY - plays), max_wins: RPS_MAX_WINS, live, best: Number(r.best || 0), recent: (r.log || []).slice(-6).reverse(),
    // V13.82: 로보's last hands (it picks at random; students like to look for a pattern anyway)
    // and the student's record.
    robot_recent: (r.hands || []).slice(-RPS_HANDS_KEEP).reverse(),
    stats: { wins: Number(r.wins_total || 0), ties: Number(r.ties_total || 0), losses: Number(r.losses_total || 0), jackpots: Number(r.jackpots || 0), biggest: Number(r.biggest || 0) }
  };
}
function rpsSettle(r, now, paid) {
  const live = r.live;
  r.paid = Number(r.paid || 0) + paid;
  r.best = Math.max(Number(r.best || 0), live.wins);
  r.biggest = Math.max(Number(r.biggest || 0), paid); // everything paid back in one game (bet included)
  if (live.wins >= RPS_MAX_WINS) r.jackpots = Number(r.jackpots || 0) + 1;
  r.log = [...(r.log || []), { at: now, bet: live.bet, wins: live.wins, paid }].slice(-RPS_LOG_KEEP);
  r.live = null;
  return paid;
}
// A game left open for a while is settled before anything else: a pot already won is paid, a
// first round left on a tie gives the bet back (nothing was decided).
function rpsSettleStale(r, now) {
  if (!r.live || now - Number(r.live.at || 0) < RPS_STALE_MS) return 0;
  return rpsSettle(r, now, r.live.wins > 0 ? r.live.pot : r.live.bet);
}
// One throw. A new game takes `bet`; after a win `double: true` plays the pot again.
export function rpsPlay(p, { bet, pick, double = false }, balance, { random = secureRandom, now = Date.now() } = {}) {
  if (!RPS_KEYS.includes(pick)) fail('가위·바위·보 중에 골라주세요.');
  const r = p.rps ||= {};
  const today = dayKey(now);
  if (r.day !== today) { r.day = today; r.plays = 0; }
  // V13.98: a game left open for 10 minutes is settled first. When the throw only continued that
  // game (no new bet, or a 더블), the answer is the settlement itself; before, the throw then asked
  // for a bet, failed, and the failed request undid the settlement, so the game stayed stuck.
  const stale = r.live;
  const refund = rpsSettleStale(r, now);
  if (stale && !r.live && (double || !RPS_BETS.includes(bet))) {
    return { settled: true, pick, robot: null, result: 'settled', pot: stale.pot, wins: stale.wins, bet: stale.bet, paid: refund, done: true, rps: rpsView(p, now) };
  }
  if (r.live?.await === 'choice' && !double) fail('받을지 더블 도전할지 먼저 골라주세요.', 409);
  if (!r.live) {
    if (!RPS_BETS.includes(bet)) fail('걸 코인을 골라주세요.');
    if (Number(r.plays || 0) >= RPS_DAILY) fail(`가위바위보는 하루 ${RPS_DAILY}판까지예요. 내일 또 겨뤄요!`, 409);
    if (balance < bet) fail(`코인이 ${bet - balance}개 부족해요.`);
    p.points_spent = Number(p.points_spent || 0) + bet;
    r.plays = Number(r.plays || 0) + 1;
    r.bets = Number(r.bets || 0) + bet;
    r.live = { id: randomBytes(6).toString('hex'), bet, pot: bet, wins: 0, ties: 0, await: 'pick', at: now };
  }
  const live = r.live;
  live.at = now;
  const robot = RPS_KEYS[Math.floor(random() * 3) % 3];
  const result = rpsOutcome(pick, robot);
  r.hands = [...(r.hands || []), robot].slice(-RPS_HANDS_KEEP);
  let paid = 0;
  if (result === 'draw') { live.ties++; live.await = 'pick'; r.ties_total = Number(r.ties_total || 0) + 1; }
  else if (result === 'lose') { live.lost = live.pot; r.losses_total = Number(r.losses_total || 0) + 1; rpsSettle(r, now, 0); }
  else {
    live.wins++; live.pot *= 2;
    r.wins_total = Number(r.wins_total || 0) + 1;
    if (live.wins >= RPS_MAX_WINS) paid = rpsSettle(r, now, live.pot);
    else live.await = 'choice';
  }
  return { pick, robot, result, pot: live.pot, wins: live.wins, bet: live.bet, paid, done: !r.live, rps: rpsView(p, now) };
}
// Stop after a win and take the pot.
export function rpsCash(p, now = Date.now()) {
  const r = p.rps ||= {};
  if (r.live?.await !== 'choice') fail('받을 코인이 없어요.', 409);
  const pot = r.live.pot, wins = r.live.wins;
  rpsSettle(r, now, pot);
  return { paid: pot, wins, rps: rpsView(p, now) };
}

/* ---------- V13.70 bonus 경험치 and coins (robot matches, teacher exams) ---------- */
const BONUS_KEEP_DAYS = 40; // older days fold into one entry per pet (totals stay the same)
export function addBonus(p, { xp = 0, coins = 0, pet = null, now = Date.now() }) {
  if (!(xp > 0 || coins > 0)) return;
  const b = p.bonus ||= {};
  const log = b.log ||= [];
  const d = dayKey(now), k = pet || null;
  let row = log.find(x => x.d === d && x.k === k);
  if (!row) { row = { d, k, xp: 0, c: 0, at: now }; log.push(row); }
  row.xp += xp; row.c += coins;
  const cut = now - BONUS_KEEP_DAYS * DAY_MS;
  if (log.some(x => x.d !== 'old' && x.at < cut)) {
    const keep = [], old = new Map();
    for (const x of log) {
      if (x.d !== 'old' && x.at >= cut) { keep.push(x); continue; }
      const o = old.get(x.k) || { d: 'old', k: x.k, xp: 0, c: 0, at: x.at };
      o.xp += x.xp; o.c += x.c; o.at = Math.min(o.at, x.at);
      old.set(x.k, o);
    }
    b.log = [...old.values(), ...keep];
  }
}
// The bonus as rows shaped like finished practices, so 경험치 (levels, pet growth, the weekly
// ranking) and coins count them. They are not practices: no words, not a study day, no records.
export function bonusRecords(p) {
  return (p?.bonus?.log || []).map(x => ({
    id: `bonus:${x.d}:${x.k || ''}`, student_id: p.id, bonus: true, created_at: x.at,
    xp: Number(x.xp || 0), reward_points: Number(x.c || 0), pet_key: x.k || undefined,
    total: 0, correct: 0, answered_count: 0, best_combo: 0
  }));
}

// V13.101 receipts: a finished robot match or monster fight keeps what it decided (paid or not)
// under its id, so the same finish sent again (the answer was lost on the way back, or the app
// sends a result it never got an answer for) gets the same answer and is never paid twice. The
// match's `live` entry is gone by then, so a receipt is the only way it can be answered.
export const RECEIPT_KEEP = 10;
export const RECEIPT_DAYS = 7;
function trimReceipts(list, now) {
  const cut = now - RECEIPT_DAYS * DAY_MS;
  return list.filter(x => x?.id && Number(x.at || 0) >= cut).slice(-RECEIPT_KEEP);
}
const findReceipt = (b, kind, id) => (id && Array.isArray(b?.done) ? b.done.find(x => x.id === id && x.k === kind) : null) || null;
function keepReceipt(b, kind, id, result, now) {
  b.done = trimReceipts([...(Array.isArray(b.done) ? b.done : []).filter(x => !(x?.id === id && x.k === kind)), { id, k: kind, at: now, r: result }], now);
  return result;
}

// A robot match is announced when it starts (the server keeps the level) and pays when it ends.
export function botStart(p, { level, mode, id, now = Date.now() }) {
  const b = p.bonus ||= {};
  b.bot_live = { id, level: ['easy', 'normal', 'hard'].includes(level) ? level : 'normal', mode: mode === 'skill' ? 'skill' : 'speed', at: now };
  return { id, ...botView(p, now) };
}
export function botView(p, now = Date.now()) {
  const bot = p.bonus?.bot || {};
  const used = bot.day === dayKey(now) ? Number(bot.count || 0) : 0;
  return { left: Math.max(0, BOT_DAILY - used), daily: BOT_DAILY };
}
export function botFinish(p, { id, result, right, pet, now = Date.now() }) {
  const b = p.bonus ||= {};
  const seen = findReceipt(b, 'bot', id);
  if (seen) return { ...seen.r, again: true, ...botView(p, now) };
  const live = b.bot_live;
  if (!id || !live || live.id !== id) fail('연습 대결을 찾지 못했어요.', 404);
  delete b.bot_live;
  return { ...keepReceipt(b, 'bot', id, botSettle(p, b, live, { result, right, pet, now }), now), ...botView(p, now) };
}
function botSettle(p, b, live, { result, right, pet, now }) {
  const outcome = ['win', 'lose', 'draw'].includes(result) ? result : 'lose';
  const answered = Math.max(0, Math.min(200, Math.floor(Number(right) || 0)));
  if (now - live.at < BOT_MIN_MS) return { paid: false, reason: 'short' };
  if (answered < BOT_MIN_RIGHT) return { paid: false, reason: 'few' };
  const today = dayKey(now);
  const bot = b.bot ||= {};
  if (bot.day !== today) { bot.day = today; bot.count = 0; }
  if (Number(bot.count || 0) >= BOT_DAILY) return { paid: false, reason: 'daily' };
  bot.count = Number(bot.count || 0) + 1;
  // V13.73: lifetime wins for the 로보 titles (paid matches only).
  if (outcome === 'win') { bot.wins = Number(bot.wins || 0) + 1; if (live.level === 'hard') bot.hard_wins = Number(bot.hard_wins || 0) + 1; }
  const reward = botReward(live.level, outcome);
  addBonus(p, { xp: reward.xp, coins: reward.coins, pet, now });
  return { paid: true, coins: reward.coins, xp: reward.xp, result: outcome, level: live.level };
}

/* ---------- V13.94 몬스터 잡기 ---------- */
//   monster { ranges: { ['<school id>|<grade>|<range code>']: { easy, normal, hard: first clear time } },
//             cleared_v1: { [V13.94 part key]: { easy, normal, hard } } (moved, kept as it was),
//             day, count, wins, hard_wins, live: { id, part, level, at, scope, codes, sizes } }
// A fight is announced when it starts (the server checks the part and that the level is open)
// and pays when it ends: the first clear of a part at a level pays MONSTER_LEVELS[level].first,
// any later fight (won: `again`, lost after answering `need` words: MONSTER_TRY) pays only
// MONSTER_DAILY times a day.
// V13.100: clears are kept per range of the student's school and grade (`scope`), not per part:
// the parts are regrouped when a teacher adds a range or words, which used to hide clears and pay
// the first clear again. A part is cleared when every range in it is (partClears); a part that
// got a new range pays only the share of its words not cleared yet (monsterFirstReward).
export const monsterScope = (schoolId, grade) => `${schoolId || ''}|${grade || ''}`;
// The clears of one school and grade: { [range code]: { easy, normal, hard } }. Clears of V13.99
// not moved yet (monsterMigrate runs on the next fight) are read the same way, without changing p.
export function monsterRanges(p, scope = '', known = []) {
  const m = p?.bonus?.monster || {}, head = scope + '|', out = {};
  const put = (code, level, at) => { const c = out[code] ||= {}; if (!c[level] || at < c[level]) c[level] = at; };
  for (const [key, value] of Object.entries(m.ranges || {})) {
    if (!key.startsWith(head)) continue;
    for (const level of MONSTER_LEVEL_KEYS) if (Number(value?.[level])) put(key.slice(head.length), level, Number(value[level]));
  }
  for (const [key, levels] of Object.entries(m.cleared && typeof m.cleared === 'object' ? m.cleared : {})) {
    for (const level of MONSTER_LEVEL_KEYS) {
      const at = Number(levels?.[level]) || 0;
      if (at) for (const code of partKeyCodes(key, known)) put(code, level, at);
    }
  }
  return out;
}
function markRange(m, scope, code, level, at) {
  const c = (m.ranges ||= {})[`${scope}|${code}`] ||= {};
  if (!c[level] || at < c[level]) c[level] = at;
}
// V13.100: move the V13.94–V13.99 clears (keyed by the part, the codes joined by '+') onto each of
// their ranges in `scope` (the student's school and grade when it runs; `known`: the range codes
// of that grade, so a code holding '+' stays whole). The old map is kept as `cleared_v1`; running
// it again changes nothing. Returns whether anything moved.
export function monsterMigrate(p, scope = '', known = []) {
  const m = p?.bonus?.monster;
  if (!m?.cleared || typeof m.cleared !== 'object') return false;
  for (const [code, levels] of Object.entries(monsterRanges(p, scope, known))) {
    for (const [level, at] of Object.entries(levels)) markRange(m, scope, code, level, at);
  }
  m.cleared_v1 = { ...(m.cleared_v1 || {}), ...m.cleared };
  delete m.cleared;
  return true;
}
/* ---------- V13.105 끝없는 레벨 ----------
   monster { stage: the level open now (1 …), clear: { easy, normal, hard } of that level (first
   clear times), best: the highest level cleared, from_parts (V13.105 move), … as above }.
   A level's 이지 → 노말 → 하드 open in order; clearing its 하드 opens the next level. The first clear
   of a level at a difficulty pays stageLevel(stage, level).first; any other fight (a level already
   cleared, won: `again`; lost after `need` words: MONSTER_TRY) pays MONSTER_DAILY times a day.
   V13.94–V13.103 cleared parts (per range since V13.100) move once: every part cleared up to 하드
   counts as a level cleared (no coins again), and 이지/노말 of a part not finished carry over. */
export function monsterProgress(p, { scope = '', parts = null } = {}) {
  const m = p?.bonus?.monster || {};
  if (Number.isFinite(Number(m.stage)) && Number(m.stage) >= 1) return { stage: cleanStage(m.stage), clear: { ...(m.clear || {}) }, best: Number(m.best || 0), moved: false };
  const ranges = monsterRanges(p, scope, (parts || []).flatMap(x => x.codes));
  const done = (parts || []).map(part => partClears(part, ranges));
  const full = done.filter(c => c.hard).length;
  const partial = done.filter(c => !c.hard).sort((a, b) => Object.keys(b).length - Object.keys(a).length)[0] || {};
  const clear = partial.normal ? { easy: partial.easy || partial.normal, normal: partial.normal } : partial.easy ? { easy: partial.easy } : {};
  return { stage: full + 1, clear, best: full, moved: true, from_parts: full };
}
function monsterSaveProgress(m, prog, now) {
  m.stage = prog.stage; m.clear = { ...prog.clear }; m.best = prog.best;
  if (prog.moved) m.from_parts = { parts: prog.from_parts, at: now };
}
export function monsterView(p, now = Date.now(), { scope = '', parts = null } = {}) {
  const m = p.bonus?.monster || {};
  const used = m.day === dayKey(now) ? Number(m.count || 0) : 0;
  const prog = monsterProgress(p, { scope, parts });
  return { stage: prog.stage, clear: prog.clear, best: prog.best, left: Math.max(0, MONSTER_DAILY - used), daily: MONSTER_DAILY, wins: Number(m.wins || 0), hard_wins: Number(m.hard_wins || 0) };
}
// `codes`: the word ranges the student fights with (checked by the service: their own school and
// grade, 8 words or more). A level below the open one is a replay at any difficulty.
export function monsterStart(p, { stage, level, codes = [], parts, scope = '', id, now = Date.now() }) {
  if (!MONSTER_LEVELS[level]) fail('난이도를 골라주세요.');
  const m = (p.bonus ||= {}).monster ||= {};
  const prog = monsterProgress(p, { scope, parts });
  if (prog.moved) { monsterMigrate(p, scope, (parts || []).flatMap(x => x.codes)); monsterSaveProgress(m, prog, now); }
  const s = stage === undefined || stage === null || stage === '' ? prog.stage : cleanStage(stage);
  if (s > prog.stage) fail('아직 열리지 않은 레벨이에요. 앞 레벨의 하드까지 깨면 열려요.', 409);
  if (s === prog.stage && !monsterOpen(prog.clear, level)) fail(level === 'hard' ? '노말을 먼저 깨야 하드에 도전할 수 있어요.' : '이지를 먼저 깨야 노말에 도전할 수 있어요.', 409);
  m.live = { id, stage: s, level, at: now, scope, codes: [...codes].map(String).slice(0, 60) };
  return { id, stage: s, level, monster: stageMonster(s).key, ...monsterView(p, now, { scope, parts }) };
}
export function monsterFinish(p, { id, result, right, pet, scope: nowScope = '', parts = null, now = Date.now() }) {
  const b = p.bonus ||= {};
  const m = b.monster ||= {};
  const view = () => monsterView(p, now, { scope: nowScope, parts });
  const seen = findReceipt(b, 'monster', id);
  if (seen) return { ...seen.r, again: true, ...view() };
  const live = m.live;
  if (!id || !live || live.id !== id) fail('몬스터 전투를 찾지 못했어요.', 404);
  delete m.live;
  const settled = monsterSettle(p, m, live, { result, right, pet, nowScope, parts, now });
  return { ...keepReceipt(b, 'monster', id, settled, now), ...view() };
}
function monsterSettle(p, m, live, { result, right, pet, nowScope, parts, now }) {
  const prog = monsterProgress(p, { scope: live.scope ?? nowScope, parts });
  if (prog.moved) { monsterMigrate(p, live.scope ?? nowScope, (parts || []).flatMap(x => x.codes)); monsterSaveProgress(m, prog, now); }
  // A fight started before V13.105 (a part, no level number) is played again at level 1 and can
  // not be a first clear.
  const legacy = !Number.isFinite(Number(live.stage));
  const stage = legacy ? 1 : cleanStage(live.stage);
  const L = stageLevel(stage, live.level) || stageLevel(1, 'easy'), won = result === 'win';
  const answered = Math.max(0, Math.min(200, Math.floor(Number(right) || 0)));
  const base = { result: won ? 'win' : 'lose', level: live.level, fought: stage };
  if (won && now - live.at < MONSTER_MIN_MS) return { paid: false, reason: 'short', ...base };
  if (answered < L.need) return { paid: false, reason: 'few', need: L.need, ...base };
  // V13.99: a lost fight is checked for time too: the right answers it claims take MONSTER_MS_PER_RIGHT each.
  if (!won && now - live.at < answered * MONSTER_MS_PER_RIGHT) return { paid: false, reason: 'short', ...base };
  if (won) { m.wins = Number(m.wins || 0) + 1; if (live.level === 'hard') m.hard_wins = Number(m.hard_wins || 0) + 1; }
  const first = won && !legacy && stage === prog.stage && !prog.clear[live.level] && monsterOpen(prog.clear, live.level);
  let reward, up = false;
  if (first) {
    const clear = { ...prog.clear, [live.level]: now };
    if (live.level === 'hard') { up = true; m.stage = stage + 1; m.clear = {}; m.best = Math.max(Number(m.best || 0), stage); }
    else { m.stage = stage; m.clear = clear; m.best = Number(m.best || prog.best || 0); }
    reward = L.first;
  } else {
    const today = dayKey(now);
    if (m.day !== today) { m.day = today; m.count = 0; }
    if (Number(m.count || 0) >= MONSTER_DAILY) return { paid: false, reason: 'daily', ...base };
    m.count = Number(m.count || 0) + 1;
    reward = won ? L.again : MONSTER_TRY;
  }
  addBonus(p, { xp: reward.xp, coins: reward.coins, pet, now });
  return { paid: true, first, ...(up ? { stage_up: stage + 1 } : {}), ...(L.boss ? { boss: true } : {}), coins: reward.coins, xp: reward.xp, ...base };
}

// A submitted teacher exam: 경험치 for every answered question, coins for answering half of it.
export function examReward(answered, total) {
  const n = Math.max(0, Math.floor(Number(answered) || 0));
  return { xp: n * EXAM_XP_PER_ANSWER, coins: total > 0 && n * 2 >= total ? EXAM_COINS : 0 };
}

/* ---------- V13.76 펫 교감 ---------- */
//   care { day, done: { [pet]: { pet, feed } }, last_at, total } — V13.90: 쓰다듬기 and 밥 주기
// once a day each, for every pet the student owns (a little 경험치 to that pet).
// `lastActive`: the student's last activity before today (practice, battles, attendance, care);
// away PET_MISS_DAYS days or more, the pet greets them (보고 싶었어).
// Today's record per pet. A record from before V13.90 kept one pair a day (c.pet / c.feed):
// it belonged to the partner of the time, so it counts for the partner now.
function careToday(c, active, today) {
  if (c.day !== today) return {};
  const done = c.done && typeof c.done === 'object' ? { ...c.done } : {};
  if ((c.pet || c.feed) && active && !done[active]) done[active] = { pet: !!c.pet, feed: !!c.feed };
  return done;
}
export function careView(p, lastActive, now = Date.now(), active) {
  const c = p.care || {}, today = dayKey(now), done = careToday(c, active, today), mine = done[active] || {};
  const away = lastActive ? Math.max(0, Math.round((Date.parse(today) - Date.parse(dayKey(lastActive))) / DAY_MS)) : 0;
  return {
    pet: !!mine.pet, feed: !!mine.feed, done, xp: { pet: PET_CARE.pet.xp, feed: PET_CARE.feed.xp },
    away_days: away, missed: away >= PET_MISS_DAYS, total: Number(c.total || 0)
  };
}
export function petCare(p, kind, { pet, now = Date.now() }) {
  if (typeof kind !== 'string' || !Object.hasOwn(PET_CARE, kind)) fail('할 수 있는 교감이 아니에요.');
  if (!pet) fail('먼저 펫을 골라주세요.', 409);
  const c = p.care ||= {};
  const today = dayKey(now);
  c.done = careToday(c, pet, today);
  c.day = today; delete c.pet; delete c.feed;
  const mine = c.done[pet] ||= { pet: false, feed: false };
  if (mine[kind]) fail(kind === 'feed' ? '오늘은 이 펫에게 이미 밥을 줬어요. 내일 또 주세요!' : '오늘은 이 펫을 이미 쓰다듬어 줬어요. 내일 또 만나요!', 409);
  mine[kind] = true;
  c.last_at = now;
  c.total = Number(c.total || 0) + 1;
  const xp = PET_CARE[kind].xp;
  addBonus(p, { xp, pet, now });
  return { kind, xp };
}
