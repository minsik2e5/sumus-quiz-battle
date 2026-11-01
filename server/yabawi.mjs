// V13.205 야바위(놀이터). 판은 서버가 만들고(공 자리 · 맞바꾸는 순서 · 밑장빼기), 고른 컵 · '동작 그만'도 서버가 판정한다.
//   p.yabawi { day, plays, bets, paid, best, wins_total, losses_total, caught_total, jackpots, biggest,
//              live: { id, bet, pot, wins, await: 'pick'|'choice', round, started, at }, log[{ at, bet, wins, paid }] }
// 판돈은 points_spent로 빠지고, 받은 코인(paid)은 rewardIncome으로 잔액에 들어간다.
import { randomBytes } from 'node:crypto';
import { dayKey } from '../public/modules/core.js';
import { YABAWI, ballAt, caughtCheat, cheatMs, roundMs } from '../public/modules/yabawi-rules.js';
import { secureRandom } from './rewards.mjs';

const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };
const LOG_KEEP = 36;

export function yabawiView(p, now = Date.now()) {
  const y = p.yabawi || {}, today = dayKey(now);
  const plays = y.day === today ? Number(y.plays || 0) : 0;
  const live = y.live ? { bet: y.live.bet, pot: y.live.pot, wins: y.live.wins, await: y.live.await } : null;
  return {
    bets: YABAWI.BETS, daily: YABAWI.DAILY, left: Math.max(0, YABAWI.DAILY - plays), max_wins: YABAWI.MAX_WINS, live,
    best: Number(y.best || 0), recent: (y.log || []).slice(-6).reverse(),
    stats: { wins: Number(y.wins_total || 0), losses: Number(y.losses_total || 0), caught: Number(y.caught_total || 0), jackpots: Number(y.jackpots || 0), biggest: Number(y.biggest || 0) }
  };
}

// 판 하나: 이긴 수(stage)에 맞는 컵 수 · 맞바꾸기, 가끔 밑장빼기. 같은 두 컵을 연달아 바꾸지 않는다(제자리로 돌아가 보이지 않게).
export function dealRound(stage, random = secureRandom) {
  const R = YABAWI.ROUNDS[Math.min(stage, YABAWI.ROUNDS.length - 1)], n = R.cups;
  const pick = k => Math.min(k - 1, Math.floor(random() * k));
  const start = pick(n), swaps = [];
  while (swaps.length < R.swaps) {
    const a = pick(n), b = (a + 1 + pick(n - 1)) % n, last = swaps.at(-1);
    if (last && Math.min(a, b) === Math.min(...last) && Math.max(a, b) === Math.max(...last)) continue;
    swaps.push([a, b]);
  }
  const round = { stage, cups: n, start, swaps, ms: R.ms, cheat: null };
  if (random() < R.cheat) {
    // 밑장빼기 뒤로 '동작 그만'을 누를 맞바꾸기가 CATCH_STEPS번 남게.
    const at = 1 + pick(R.swaps - 1 - YABAWI.CATCH_STEPS);
    const from = ballAt({ ...round, swaps: swaps.slice(0, at + 1) });
    round.cheat = { at, from, to: (from + 1 + pick(n - 1)) % n };
  }
  return round;
}

function settle(y, now, paid) {
  const live = y.live;
  y.paid = Number(y.paid || 0) + paid;
  y.best = Math.max(Number(y.best || 0), live.wins);
  y.biggest = Math.max(Number(y.biggest || 0), paid);
  if (live.wins >= YABAWI.MAX_WINS) y.jackpots = Number(y.jackpots || 0) + 1;
  y.log = [...(y.log || []), { at: now, bet: live.bet, wins: live.wins, paid }].slice(-LOG_KEEP);
  y.live = null;
  return paid;
}
// 10분 넘게 둔 판은 먼저 정리한다: 이긴 판돈이 있으면 주고, 첫 판이면 건 코인을 돌려준다(아무것도 안 정해졌다).
function settleStale(y, now) {
  if (!y.live || now - Number(y.live.at || 0) < YABAWI.STALE_MS) return null;
  const stale = y.live;
  return { ...stale, paid: settle(y, now, stale.wins > 0 ? stale.pot : stale.bet) };
}
const roundOut = r => ({ stage: r.stage, cups: r.cups, start: r.start, swaps: r.swaps, ms: r.ms, cheat: r.cheat });

// 판 받기: 새 판(bet), 이긴 뒤 더블(double), 또는 섞다가 닫은 판 이어 보기(아무것도 없이 → 같은 판을 처음부터).
export function yabawiDeal(p, { bet, double = false }, balance, { random = secureRandom, now = Date.now() } = {}) {
  const y = p.yabawi ||= {};
  const today = dayKey(now);
  if (y.day !== today) { y.day = today; y.plays = 0; }
  const stale = settleStale(y, now);
  if (stale && (double || !YABAWI.BETS.includes(bet))) return { settled: true, paid: stale.paid, wins: stale.wins, bet: stale.bet, yabawi: yabawiView(p, now) };
  if (y.live?.await === 'pick' && !double) {
    y.live.started = y.live.at = now;
    return { round: roundOut(y.live.round), bet: y.live.bet, pot: y.live.pot, wins: y.live.wins, yabawi: yabawiView(p, now) };
  }
  if (double) {
    if (y.live?.await !== 'choice') fail('더블로 갈 판돈이 없어요.', 409);
  } else {
    if (y.live) fail('받을지 더블로 갈지 먼저 골라주세요.', 409);
    if (!YABAWI.BETS.includes(bet)) fail('걸 코인을 골라주세요.');
    if (Number(y.plays || 0) >= YABAWI.DAILY) fail(`야바위는 하루 ${YABAWI.DAILY}판까지예요. 내일 또 와요!`, 409);
    if (balance < bet) fail(`코인이 ${bet - balance}개 부족해요.`);
    p.points_spent = Number(p.points_spent || 0) + bet;
    y.plays = Number(y.plays || 0) + 1;
    y.bets = Number(y.bets || 0) + bet;
    y.live = { id: randomBytes(6).toString('hex'), bet, pot: bet, wins: 0 };
  }
  const live = y.live;
  live.round = dealRound(live.wins, random);
  live.await = 'pick';
  live.started = live.at = now;
  return { round: roundOut(live.round), bet: live.bet, pot: live.pot, wins: live.wins, yabawi: yabawiView(p, now) };
}

// 컵 고르기(slot) 또는 '동작 그만'(stop: 그때까지 끝난 맞바꾸기 수). 밑장빼기를 잡으면 그 판은 이긴다.
export function yabawiPick(p, { slot, stop = null }, { now = Date.now() } = {}) {
  const y = p.yabawi ||= {};
  const live = y.live;
  if (live?.await !== 'pick' || !live.round) fail('고를 판이 없어요.', 409);
  const round = live.round, elapsed = now - Number(live.started || 0);
  const caught = caughtCheat(round, stop);
  if (caught) {
    if (elapsed < cheatMs(round) * YABAWI.MIN_SHARE) fail('조금만 더 지켜봐요.', 409);
  } else {
    if (!Number.isInteger(slot) || slot < 0 || slot >= round.cups) fail('컵을 골라주세요.');
    if (elapsed < roundMs(round) * YABAWI.MIN_SHARE) fail('컵을 다 섞은 뒤에 골라요.', 409);
  }
  const ball = ballAt(round);
  const win = caught || slot === ball;
  live.at = now;
  const out = { slot: caught ? null : slot, ball, cheat: round.cheat, caught, bet: live.bet };
  if (!win) {
    y.losses_total = Number(y.losses_total || 0) + 1;
    const wins = live.wins;
    settle(y, now, 0);
    return { ...out, result: 'lose', wins, pot: 0, paid: 0, done: true, yabawi: yabawiView(p, now) };
  }
  live.wins++; live.pot *= 2; live.round = null;
  y.wins_total = Number(y.wins_total || 0) + 1;
  if (caught) y.caught_total = Number(y.caught_total || 0) + 1;
  const wins = live.wins, pot = live.pot;
  let paid = 0;
  if (wins >= YABAWI.MAX_WINS) paid = settle(y, now, pot);
  else live.await = 'choice';
  return { ...out, result: 'win', wins, pot, paid, done: !y.live, yabawi: yabawiView(p, now) };
}

// 이긴 뒤 판돈 받고 끝내기.
export function yabawiCash(p, now = Date.now()) {
  const y = p.yabawi ||= {};
  if (y.live?.await !== 'choice') fail('받을 코인이 없어요.', 409);
  const pot = y.live.pot, wins = y.live.wins;
  settle(y, now, pot);
  return { paid: pot, wins, yabawi: yabawiView(p, now) };
}

export const yabawiLine = res => res.result === 'lose' ? `야바위 ${res.wins ? `${res.wins}연승 뒤 ` : ''}패 · ${res.bet}코인` : `야바위 ${res.wins}연승 · ${res.paid}코인`;
