// V13.82 문법 증권거래소 (rules and share list: public/modules/market.js).
//
// Prices move every hour on the hour. Each hour's move is drawn from a seed kept only in the
// state (state.market.seed, never sent to a browser), so the next price cannot be worked out
// from the app's code. A price is a random walk pulled back toward its base, with a rare news
// jump, kept between MARKET.min_x and MARKET.max_x times the base. The whole path is a pure
// function of the seed and the hour, so a GET can show it without saving anything.
//
// A student's shares live on the profile:
//   stocks { h: { KEY: { q, cost } }, paid, bought, realized, day, trades, log[] }
// Buying adds to points_spent; selling adds to stocks.paid (rewardIncome), like other games.
// V13.212: orders are in coins, not shares. q is a fraction of a share (6 decimals), cost is the coins put in;
// taking coins out pays whole coins (rounded down) and takes the matching part of q and cost.
import { createHash, randomBytes } from 'node:crypto';
import { STOCKS, MARKET, stockOf, newsText, shareValue } from '../public/modules/market.js';
import { dayKey } from '../public/modules/core.js';

export const HOUR_MS = 3600000;
export const hourOf = now => Math.floor(now / HOUR_MS);
const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };
const STOCK_LOG_KEEP = 20;
const NEWS_KEEP = 24;

// A new market starts with two days of history already drawn, so the first chart is not empty.
export function newMarket(now = Date.now()) {
  return { seed: randomBytes(16).toString('hex'), start: hourOf(now) - MARKET.history - 24 };
}

function uniform(seed, key, hour, n) {
  const d = createHash('sha256').update(`${seed}:${key}:${hour}:${n}`).digest();
  return (d.readUInt32BE(0) + 1) / 4294967297;
}
function gauss(seed, key, hour) {
  const u1 = uniform(seed, key, hour, 0), u2 = uniform(seed, key, hour, 1);
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

// The path so far, kept per seed and extended an hour at a time.
const paths = new Map();
function pathTo(market, hour) {
  const seed = market.seed;
  let c = paths.get(seed);
  if (!c || c.hour > hour || c.start !== market.start) {
    const from = market.from || {};
    const raw = Object.fromEntries(STOCKS.map(s => [s.key, Number(from[s.key]) > 0 ? Number(from[s.key]) : s.base]));
    c = { start: market.start, hour: market.start, raw, hist: Object.fromEntries(STOCKS.map(s => [s.key, [priceOf(raw[s.key])]])), news: [] };
    paths.set(seed, c);
  }
  // A market nobody opened for months catches up quickly (a few thousand hashes per stock).
  while (c.hour < hour) {
    c.hour++;
    for (const s of STOCKS) {
      const p = c.raw[s.key];
      let move = s.vol * gauss(seed, s.key, c.hour) + MARKET.revert * Math.log(s.base / p);
      if (uniform(seed, s.key, c.hour, 2) < MARKET.news_rate) {
        const up = uniform(seed, s.key, c.hour, 3) < 0.5, size = 0.08 + uniform(seed, s.key, c.hour, 4) * 0.12;
        move += up ? size : -size;
        c.news.push({ hour: c.hour, key: s.key, up, pick: Math.floor(uniform(seed, s.key, c.hour, 5) * 1000) });
      }
      c.raw[s.key] = Math.min(s.base * MARKET.max_x, Math.max(s.base * MARKET.min_x, p * Math.exp(move)));
      const h = c.hist[s.key];
      h.push(priceOf(c.raw[s.key]));
      if (h.length > MARKET.history + 25) h.splice(0, h.length - MARKET.history - 25);
    }
    if (c.news.length > NEWS_KEEP) c.news.splice(0, c.news.length - NEWS_KEEP);
  }
  return c;
}
const priceOf = raw => Math.max(1, Math.round(raw));

export function marketPrices(state, now = Date.now()) {
  const market = state.market?.seed ? state.market : null;
  if (!market) return null;
  const hour = hourOf(now), c = pathTo(market, hour);
  return { hour, prices: Object.fromEntries(STOCKS.map(s => [s.key, c.hist[s.key].at(-1)])), hist: c.hist, news: c.news };
}

function holdingsOf(p) {
  const h = p.stocks?.h || {};
  return Object.entries(h).filter(([key, x]) => stockOf(key) && Number(x?.q) > 0);
}

export function marketView(state, p, balance, now = Date.now()) {
  const m = marketPrices(state, now);
  if (!m) return { open: false };
  const st = p?.stocks || {}, today = dayKey(now);
  const trades = st.day === today ? Number(st.trades || 0) : 0;
  const stocks = STOCKS.map(s => {
    const hist = m.hist[s.key].slice(-MARKET.history - 1);
    const price = hist.at(-1), prev = hist.at(-2) ?? price, open = hist.at(-25) ?? hist[0];
    return { key: s.key, name: s.name, short: s.short, color: s.color, tip: s.tip, price, prev, open, hist: hist.slice(-MARKET.history) };
  });
  const prices = m.prices;
  const holdings = holdingsOf(p || {}).map(([key, x]) => {
    const q = Number(x.q), cost = Math.round(Number(x.cost || 0)), value = shareValue(q, prices[key]);
    return { key, q: Math.round(q * 1000) / 1000, cost, value, pl: value - cost, pl_pct: cost ? Math.round((value - cost) / cost * 1000) / 10 : 0 };
  });
  const value = holdings.reduce((n, x) => n + x.value, 0), cost = holdings.reduce((n, x) => n + x.cost, 0);
  return {
    open: true, hour: m.hour, next_at: (m.hour + 1) * HOUR_MS, stocks,
    news: m.news.slice(-8).reverse().map(n => ({ key: n.key, up: n.up, at: n.hour * HOUR_MS, text: newsText(n) })),
    me: { holdings, value, cost, pl: value - cost, pl_pct: cost ? Math.round((value - cost) / cost * 1000) / 10 : 0, realized: Math.round(Number(st.realized || 0)), cash: balance, trades_left: Math.max(0, MARKET.daily_trades - trades), recent: (st.log || []).slice(-6).reverse() },
    rules: MARKET
  };
}

// One order at the price of this hour, in coins. `price` is the price the student saw: if the hour turned
// meanwhile, the order is refused so nobody trades at a price they did not see.
//   buy  { coins }        put that many coins in (whole coins, MARKET.min_order..max_order)
//   sell { coins | all }  take that many coins out, or everything (pays whole coins, rounded down)
const Q = n => Math.round(n * 1e6) / 1e6;
export function trade(state, p, { key, side, coins, all, price }, balance, now = Date.now()) {
  const s = stockOf(key);
  if (!s) fail('종목을 확인해주세요.');
  if (!['buy', 'sell'].includes(side)) fail('넣기 또는 빼기를 골라주세요.');
  const m = marketPrices(state, now);
  if (!m) fail('거래소가 아직 열리지 않았어요.', 409);
  const current = m.prices[s.key];
  if (Number(price) !== current) fail('그 사이 가격이 바뀌었어요. 새 가격을 확인해 주세요.', 409);
  const st = p.stocks ||= {};
  const h = st.h ||= {};
  const held = Object.hasOwn(h, s.key) ? h[s.key] : null;
  const worth = held ? shareValue(held.q, current) : 0;
  if (side === 'sell' && worth < 1) fail('이 종목에 넣어 둔 코인이 없어요.', 409);
  coins = all === true && side === 'sell' ? worth : Number(coins);
  if (!Number.isInteger(coins) || coins < 1) fail('코인 수를 확인해 주세요.');
  const today = dayKey(now);
  if (st.day !== today) { st.day = today; st.trades = 0; }
  if (Number(st.trades || 0) >= MARKET.daily_trades) fail(`주문은 하루 ${MARKET.daily_trades}번까지예요. 내일 또 만나요!`, 409);
  let total;
  if (side === 'buy') {
    if (coins < MARKET.min_order || coins > MARKET.max_order) fail(`한 번에 ${MARKET.min_order}~${MARKET.max_order}코인까지 넣을 수 있어요.`);
    if (Number(held?.cost || 0) + coins > MARKET.max_put) fail(`한 종목에는 ${MARKET.max_put}코인까지 넣을 수 있어요.`, 409);
    if (balance < coins) fail(`코인이 ${coins - balance}개 부족해요.`);
    total = coins;
    p.points_spent = Number(p.points_spent || 0) + coins;
    st.bought = Number(st.bought || 0) + coins;
    const next = held || (h[s.key] = { q: 0, cost: 0 });
    next.q = Q(Number(next.q || 0) + coins / current);
    next.cost = Math.round((Number(next.cost || 0) + coins) * 100) / 100;
  } else {
    if (coins > worth) fail(`지금 뺄 수 있는 건 ${worth}코인이에요.`, 409);
    // 남는 몫이 1코인도 안 되면 전부 뺀다.
    const everything = coins === worth || shareValue(held.q - coins / current, current) < 1;
    const part = everything ? 1 : Math.min(1, coins / current / held.q);
    const costPart = held.cost * part;
    total = coins;
    st.paid = Number(st.paid || 0) + total;
    st.realized = Math.round((Number(st.realized || 0) + total - costPart) * 100) / 100;
    if (everything) delete h[s.key];
    else { held.q = Q(held.q * (1 - part)); held.cost = Math.round((held.cost - costPart) * 100) / 100; }
  }
  st.trades = Number(st.trades || 0) + 1;
  st.log = [...(st.log || []), { at: now, key: s.key, side, coins: total, price: current }].slice(-STOCK_LOG_KEEP);
  return { side, key: s.key, coins: total, price: current };
}

// Every two weeks (from the hourly sweep) the path restarts three days back from the prices it
// had reached, so a server waking up never has to replay months of hours. Same prices after.
const REBASE_AFTER_H = 14 * 24;
export function rebaseMarket(state, now = Date.now()) {
  const market = state.market;
  // `open` (switching the market on through the state) is kept.
  const keep = market?.open === true ? { open: true } : {};
  if (!market?.seed) { state.market = { ...newMarket(now), ...keep }; return true; }
  const hour = hourOf(now);
  if (hour - market.start < REBASE_AFTER_H) return false;
  const start = hour - MARKET.history - 24, c = pathTo(market, start);
  state.market = { seed: market.seed, start, from: { ...c.raw }, ...keep };
  return true;
}
