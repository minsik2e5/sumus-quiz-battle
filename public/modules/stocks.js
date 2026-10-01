// V13.82 문법 증권거래소 (놀이터). Prices come from the server every hour (server/market.mjs);
// this module draws the board, a share's page with its 48-hour chart, and the order buttons.
// Korean market colours: a rise is red, a fall is blue.
import { api, esc, num, toast, modal } from './ui.js';
import { coin } from './emblems.js';
import { MARKET, tradeFee, stockOf } from './market.js';

let market = null, loading = null, ticker = null;
const UP = '#e03131', DOWN = '#1c7ed6', FLAT = '#868e96';
const tone = (now, before) => now > before ? 'up' : now < before ? 'down' : 'flat';
const colorOf = t => t === 'up' ? UP : t === 'down' ? DOWN : FLAT;
const pct = (now, before) => before ? Math.round((now - before) / before * 1000) / 10 : 0;
const signed = (n, unit = '') => `${n > 0 ? '+' : n < 0 ? '−' : ''}${num(Math.abs(n))}${unit}`;
const arrow = t => t === 'up' ? '▲' : t === 'down' ? '▼' : '–';

export const marketData = () => market;
export function loadMarket() {
  loading ||= api('/market').then(res => { market = res.market; return market; }).finally(() => { loading = null; });
  return loading;
}

function spark(hist, t, w = 76, h = 26) {
  const lo = Math.min(...hist), hi = Math.max(...hist), span = hi - lo || 1;
  const pts = hist.map((v, i) => `${(i / (hist.length - 1) * w).toFixed(1)},${(h - 2 - (v - lo) / span * (h - 4)).toFixed(1)}`).join(' ');
  return `<svg class="stk-spark" viewBox="0 0 ${w} ${h}" aria-hidden="true"><polyline points="${pts}" fill="none" stroke="${colorOf(t)}" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"/></svg>`;
}
function chart(hist, t) {
  const w = 320, h = 150, pad = 8, lo = Math.min(...hist), hi = Math.max(...hist), span = hi - lo || 1;
  const x = i => pad + i / (hist.length - 1) * (w - pad * 2), y = v => pad + (1 - (v - lo) / span) * (h - pad * 2 - 14);
  const line = hist.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const c = colorOf(t), last = hist.length - 1;
  return `<svg class="stk-chart" viewBox="0 0 ${w} ${h}" role="img" aria-label="최근 ${hist.length}시간 가격: 최저 ${lo}, 최고 ${hi}">
    <defs><linearGradient id="stk-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c}" stop-opacity=".28"/><stop offset="1" stop-color="${c}" stop-opacity="0"/></linearGradient></defs>
    <line x1="${pad}" x2="${w - pad}" y1="${y(hist[0]).toFixed(1)}" y2="${y(hist[0]).toFixed(1)}" class="stk-base"/>
    <polygon points="${x(0)},${h - 14} ${line} ${x(last)},${h - 14}" fill="url(#stk-fill)"/>
    <polyline points="${line}" fill="none" stroke="${c}" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/>
    <circle cx="${x(last).toFixed(1)}" cy="${y(hist[last]).toFixed(1)}" r="4" fill="${c}" class="stk-dot"/>
    <text x="${w - pad}" y="${(y(hi) + 10).toFixed(1)}" text-anchor="end" class="stk-axis">최고 ${hi}</text>
    <text x="${w - pad}" y="${(h - 18).toFixed(1)}" text-anchor="end" class="stk-axis">최저 ${lo}</text>
    <text x="${pad}" y="${h - 2}" class="stk-axis">${hist.length}시간 전</text><text x="${w - pad}" y="${h - 2}" text-anchor="end" class="stk-axis">지금</text>
  </svg>`;
}
const countdown = () => {
  if (!market?.next_at) return '';
  const left = Math.max(0, market.next_at - Date.now());
  return `${String(Math.floor(left / 60000)).padStart(2, '0')}:${String(Math.floor(left / 1000) % 60).padStart(2, '0')}`;
};

/* ---------- the board in 놀이터 ---------- */
export function stocksCard() {
  if (!market) return `<section class="stk-card" id="stk-card"><div class="stk-head"><div><small>GRAMMAR EXCHANGE</small><h2>문법 증권거래소</h2></div></div><p class="stk-loading">시세를 불러오는 중…</p></section>`;
  if (!market.open) return '';
  const me = market.me, plTone = tone(me.pl, 0);
  const news = market.news.slice(0, 6);
  return `<section class="stk-card" id="stk-card">
    <div class="stk-head"><div><small>GRAMMAR EXCHANGE</small><h2>문법 증권거래소</h2></div><span class="stk-clock" title="다음 가격 변동까지"><i>⏱</i><b id="stk-clock">${countdown()}</b></span></div>
    ${news.length ? `<div class="stk-news" aria-label="뉴스"><div class="stk-news-track">${[...news, ...news].map(n => `<span class="${n.up ? 'up' : 'down'}">${n.up ? '📈' : '📉'} ${esc(n.text)}</span>`).join('')}</div></div>` : ''}
    <div class="stk-me">
      <div><small>내 주식 평가</small><b>${coin()}${num(me.value)}</b></div>
      <div><small>수익률</small><b class="${plTone}">${me.cost ? `${signed(me.pl)} (${signed(me.pl_pct, '%')})` : '—'}</b></div>
      <div><small>실현 손익</small><b class="${tone(me.realized, 0)}">${signed(me.realized)}</b></div>
    </div>
    <ul class="stk-list">${market.stocks.map(s => {
      const t = tone(s.price, s.prev), held = me.holdings.find(h => h.key === s.key);
      return `<li><button type="button" class="stk-row" data-stk="open" data-key="${s.key}">
        <span class="stk-logo" style="--c:${s.color}">${esc(s.short.slice(0, 2))}</span>
        <span class="stk-name"><b>${esc(s.name)}</b><small>${esc(s.short)}${held ? ` · <em>${held.q}주</em>` : ''}</small></span>
        ${spark(s.hist.slice(-24), tone(s.price, s.hist.at(-24) ?? s.prev))}
        <span class="stk-price ${t}"><b>${num(s.price)}</b><small>${arrow(t)} ${Math.abs(pct(s.price, s.prev))}%</small></span>
      </button></li>`;
    }).join('')}</ul>
    <p class="lk-note">매시 정각에 가격이 바뀌어요 · 수수료 ${Math.round(MARKET.fee * 100)}% · 하루 ${MARKET.daily_trades}번 주문 · 오늘 ${me.trades_left}번 남음</p>
  </section>`;
}
// Keeps the countdown going; at the turn of the hour, the new prices are fetched.
export function startStockClock(onNewPrices) {
  clearInterval(ticker);
  ticker = setInterval(() => {
    const el = document.getElementById('stk-clock');
    if (!el) { clearInterval(ticker); ticker = null; return; }
    el.textContent = countdown();
    if (market?.next_at && Date.now() >= market.next_at + 1500) {
      market.next_at = Date.now() + 60000;
      loadMarket().then(onNewPrices).catch(() => {});
    }
  }, 1000);
}

/* ---------- one share's page ---------- */
export function openStock(key, { onBalance, onChange } = {}) {
  let qty = 1, busy = false, close = null;
  const draw = () => {
    const s = market?.stocks.find(x => x.key === key), info = stockOf(key);
    if (!s || !info) return;
    const me = market.me, held = me.holdings.find(h => h.key === key), t = tone(s.price, s.prev), day = tone(s.price, s.open);
    const cash = Number(me.cash || 0), room = MARKET.max_hold - (held?.q || 0);
    const maxBuy = Math.max(0, Math.min(MARKET.max_qty, room, Math.floor(cash / (s.price * (1 + MARKET.fee)))));
    const maxSell = Math.min(MARKET.max_qty, held?.q || 0);
    qty = Math.max(1, Math.min(qty, Math.max(maxBuy, maxSell, 1)));
    const amount = s.price * qty, fee = tradeFee(amount);
    const html = `<div class="stk-detail">
      <div class="stk-d-head"><span class="stk-logo big" style="--c:${s.color}">${esc(s.short.slice(0, 2))}</span><div><h2>${esc(s.name)}</h2><small>${esc(s.short)} · ${esc(s.key)}</small></div></div>
      <div class="stk-d-price ${t}"><b>${coin()}${num(s.price)}</b><span>${arrow(t)} ${signed(s.price - s.prev)} (${signed(pct(s.price, s.prev), '%')}) <small>1시간</small></span><span class="${day}">24시간 ${signed(pct(s.price, s.open), '%')}</span></div>
      ${chart(s.hist, tone(s.price, s.hist[0]))}
      <p class="stk-tip">📘 ${esc(s.tip)}</p>
      <div class="stk-hold">${held ? `<span>보유 <b>${held.q}주</b></span><span>평균 <b>${num(held.avg)}</b></span><span>평가 <b>${num(held.value)}</b></span><span class="${tone(held.pl, 0)}">손익 <b>${signed(held.pl)} (${signed(held.pl_pct, '%')})</b></span>` : '<span>아직 이 주식이 없어요</span>'}</div>
      <div class="stk-order">
        <div class="stk-qty" role="group" aria-label="수량"><button type="button" data-q="-1" aria-label="1주 빼기">−</button><b><span id="stk-qty">${qty}</span>주</b><button type="button" data-q="1" aria-label="1주 더하기">+</button></div>
        <div class="stk-quick">${[5, 10].map(n => `<button type="button" data-q-set="${n}">${n}주</button>`).join('')}<button type="button" data-q-set="${maxBuy}" ${maxBuy ? '' : 'disabled'}>최대 매수</button>${maxSell ? `<button type="button" data-q-set="${maxSell}">전부 매도</button>` : ''}</div>
        <p class="stk-sum">금액 ${num(amount)} · 수수료 ${num(fee)} → 살 때 <b>${num(amount + fee)}</b> · 팔 때 <b>${num(amount - fee)}</b>코인</p>
        <div class="stk-btns"><button type="button" class="stk-buy" data-side="buy" ${qty <= maxBuy && me.trades_left > 0 ? '' : 'disabled'}>사기</button><button type="button" class="stk-sell" data-side="sell" ${qty <= maxSell && me.trades_left > 0 ? '' : 'disabled'}>팔기</button></div>
        <p class="stk-cash">내 코인 ${coin()}${num(cash)} · 오늘 주문 ${me.trades_left}번 남음</p>
      </div>
    </div>`;
    const root = document.querySelector('.modal .stk-detail');
    if (root) root.outerHTML = html;
    else close = modal(html, `${s.name} 주식`);
    bind();
  };
  const bind = () => {
    const box = document.querySelector('.modal');
    if (!box) return;
    box.querySelectorAll('[data-q]').forEach(b => { b.onclick = () => { qty = Math.max(1, Math.min(MARKET.max_qty, qty + Number(b.dataset.q))); draw(); }; });
    box.querySelectorAll('[data-q-set]').forEach(b => { b.onclick = () => { qty = Math.max(1, Number(b.dataset.qSet)); draw(); }; });
    box.querySelectorAll('[data-side]').forEach(b => { b.onclick = () => order(b.dataset.side, b); });
  };
  const order = async (side, button) => {
    if (busy) return;
    const s = market.stocks.find(x => x.key === key);
    busy = true; button.disabled = true;
    try {
      const res = await api('/market/trade', { key, side, qty, price: s.price });
      market = res.market;
      onBalance?.(res.points_balance);
      const t = res.trade;
      toast(side === 'buy' ? `${stockOf(key).name} ${t.qty}주를 ${num(t.total)}코인에 샀어요` : `${stockOf(key).name} ${t.qty}주를 팔아 ${num(t.total)}코인을 받았어요`);
      document.querySelector('.modal .stk-d-price')?.classList.add(side === 'buy' ? 'flash-buy' : 'flash-sell');
    } catch (err) {
      toast(err.message);
      if (err.status === 409) await loadMarket().catch(() => {});
    }
    busy = false;
    onChange?.();
    if (document.querySelector('.modal .stk-detail')) draw();
  };
  draw();
  return () => close?.();
}
