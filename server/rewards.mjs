import { randomBytes } from 'node:crypto';
import { dayKey, ACCESSORIES, PET_CARE, PET_MISS_DAYS } from '../public/modules/core.js';
import {
  ATTENDANCE_REWARDS, ATTENDANCE_TICKETS, LUCKY_BETS, LUCKY_DAILY, LUCKY_TICKET_BET, LUCKY_ODDS, drawLucky,
  BOT_DAILY, BOT_MIN_RIGHT, BOT_MIN_MS, botReward, EXAM_XP_PER_ANSWER, EXAM_COINS, GIFT_AMOUNTS, GIFT_NOTE_MAX, GIFT_LOG_KEEP
} from '../public/modules/rewards.js';
import { titleCoins } from '../public/modules/titles.js';

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
// Coins received here (attendance, old capsule refunds, coin capsule and double chance pay-outs)
// are added to the balance in service.mjs pointsAndPets; coins paid (capsules, bets) go to
// points_spent. Bonus 경험치 and coins join the student's records as bonus rows (bonusRecords).

const DAY_MS = 86400000;
const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };
export const secureRandom = () => randomBytes(4).readUInt32BE(0) / 2 ** 32;

export function rewardIncome(p) {
  return Number(p?.attendance?.coins || 0) + Number(p?.gacha?.refund || 0) + Number(p?.chance?.paid || 0) + Number(p?.lucky?.paid || 0) + chanceRefund(p)
    + Number(p?.title_reward?.total || 0) + Number(p?.gift_box?.total || 0);
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
  if (typeof p.avatar_accessory === 'string' && !ACCESSORIES[p.avatar_accessory]) { p.avatar_accessory = 'none'; changed = true; }
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
  return {
    bets: LUCKY_BETS, daily: LUCKY_DAILY, left: Math.max(0, LUCKY_DAILY - plays), odds: LUCKY_ODDS,
    ticket_bet: LUCKY_TICKET_BET, tickets: Number(p.gacha?.tickets || 0),
    recent: (l.log || []).slice(-6).reverse()
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
  l.paid = Number(l.paid || 0) + paid;
  l.log = [...(l.log || []), { at: now, bet, mult: odd.mult, ticket }].slice(-LUCKY_LOG_KEEP);
  return { bet, mult: odd.mult, name: odd.name, paid, ticket, lucky: luckyView(p, now) };
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
  const live = b.bot_live;
  if (!live || live.id !== id) fail('연습 대결을 찾지 못했어요.', 404);
  delete b.bot_live;
  const outcome = ['win', 'lose', 'draw'].includes(result) ? result : 'lose';
  const answered = Math.max(0, Math.min(200, Math.floor(Number(right) || 0)));
  if (now - live.at < BOT_MIN_MS) return { paid: false, reason: 'short', ...botView(p, now) };
  if (answered < BOT_MIN_RIGHT) return { paid: false, reason: 'few', ...botView(p, now) };
  const today = dayKey(now);
  const bot = b.bot ||= {};
  if (bot.day !== today) { bot.day = today; bot.count = 0; }
  if (Number(bot.count || 0) >= BOT_DAILY) return { paid: false, reason: 'daily', ...botView(p, now) };
  bot.count = Number(bot.count || 0) + 1;
  // V13.73: lifetime wins for the 로보 titles (paid matches only).
  if (outcome === 'win') { bot.wins = Number(bot.wins || 0) + 1; if (live.level === 'hard') bot.hard_wins = Number(bot.hard_wins || 0) + 1; }
  const reward = botReward(live.level, outcome);
  addBonus(p, { xp: reward.xp, coins: reward.coins, pet, now });
  return { paid: true, coins: reward.coins, xp: reward.xp, result: outcome, level: live.level, ...botView(p, now) };
}

// A submitted teacher exam: 경험치 for every answered question, coins for answering half of it.
export function examReward(answered, total) {
  const n = Math.max(0, Math.floor(Number(answered) || 0));
  return { xp: n * EXAM_XP_PER_ANSWER, coins: total > 0 && n * 2 >= total ? EXAM_COINS : 0 };
}

/* ---------- V13.76 펫 교감 ---------- */
//   care { day, pet, feed, last_at, total } — 쓰다듬기 and 밥 주기 once a day each (a little 경험치)
// `lastActive`: the student's last activity before today (practice, battles, attendance, care);
// away PET_MISS_DAYS days or more, the pet greets them (보고 싶었어).
export function careView(p, lastActive, now = Date.now()) {
  const c = p.care || {}, today = dayKey(now), done = c.day === today;
  const away = lastActive ? Math.max(0, Math.round((Date.parse(today) - Date.parse(dayKey(lastActive))) / DAY_MS)) : 0;
  return {
    pet: done && !!c.pet, feed: done && !!c.feed, xp: { pet: PET_CARE.pet.xp, feed: PET_CARE.feed.xp },
    away_days: away, missed: away >= PET_MISS_DAYS, total: Number(c.total || 0)
  };
}
export function petCare(p, kind, { pet, now = Date.now() }) {
  if (!PET_CARE[kind]) fail('할 수 있는 교감이 아니에요.');
  if (!pet) fail('먼저 펫을 골라주세요.', 409);
  const c = p.care ||= {};
  const today = dayKey(now);
  if (c.day !== today) { c.day = today; c.pet = false; c.feed = false; }
  if (c[kind]) fail(kind === 'feed' ? '오늘은 이미 밥을 줬어요. 내일 또 주세요!' : '오늘은 이미 쓰다듬어 줬어요. 내일 또 만나요!', 409);
  c[kind] = true;
  c.last_at = now;
  c.total = Number(c.total || 0) + 1;
  const xp = PET_CARE[kind].xp;
  addBonus(p, { xp, pet, now });
  return { kind, xp };
}
