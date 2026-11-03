// V13.82 문법 증권거래소 (놀이터). Prices come from the server every hour (server/market.mjs);
// this module draws the board, a share's page with its 48-hour chart, and the order buttons.
// Korean market colours: a rise is red, a fall is blue.
// V13.212: 몇 주가 아니라 코인으로 넣고 뺀다. 화면은 '넣은 코인 → 지금' 한 줄과 등락만 크게, 평균가 · 주 수는 숨긴다.
import { api, esc, num, toast, modal } from './ui.js';
import { coin } from './emblems.js';
import { MARKET, stockOf } from './market.js';

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
const chip = (t, text) => `<em class="stk-chip ${t}">${text}</em>`;
const face = t => t === 'up' ? '😀' : t === 'down' ? '😢' : '🙂';
function wallet(me) {
  if (!me.cost) return `<div class="stk-wallet is-empty"><span class="stk-coinpile" aria-hidden="true">💰</span><div><b>아직 넣은 코인이 없어요</b><small>종목을 눌러 ${MARKET.steps[0]}코인부터 넣어 보세요. 가격이 오르면 불어나고, 내리면 줄어요.</small></div></div>`;
  const t = tone(me.pl, 0);
  return `<div class="stk-wallet ${t}">
      <small>내 투자</small>
      <div class="stk-flow"><span><i>넣은 코인</i><b>${coin()}${num(me.cost)}</b></span><i class="stk-to" aria-hidden="true">→</i><span><i>지금</i><b class="${t}">${coin()}${num(me.value)}</b></span></div>
      ${chip(t, `${face(t)} ${signed(me.pl)}코인 (${signed(me.pl_pct, '%')})`)}
      ${me.realized ? `<small class="stk-realized">지금까지 빼서 ${me.realized > 0 ? '번' : '잃은'} 코인 <b class="${tone(me.realized, 0)}">${signed(me.realized)}</b></small>` : ''}
    </div>`;
}
export function stocksCard() {
  if (!market) return `<section class="stk-card" id="stk-card"><div class="stk-head"><div><small>GRAMMAR EXCHANGE</small><h2>문법 증권거래소</h2></div></div><p class="stk-loading">시세를 불러오는 중…</p></section>`;
  if (!market.open) return '';
  const me = market.me, news = market.news.slice(0, 6);
  return `<section class="stk-card" id="stk-card">
    <div class="stk-head"><div><small>GRAMMAR EXCHANGE</small><h2>문법 증권거래소</h2><p>코인을 넣어 두면 문법 주식을 따라 불어나요</p></div><span class="stk-clock" title="다음 가격 변동까지"><i>다음 가격</i><b id="stk-clock">${countdown()}</b></span></div>
    ${wallet(me)}
    ${news.length ? `<div class="stk-news" aria-label="뉴스"><span class="stk-news-tag">NEWS</span><div class="stk-news-win"><div class="stk-news-track">${[...news, ...news].map(n => `<span class="${n.up ? 'up' : 'down'}">${n.up ? '▲' : '▼'} ${esc(n.text)}</span>`).join('')}</div></div></div>` : ''}
    <div class="stk-list-head"><span>종목</span><span>24시간</span></div>
    <ul class="stk-list">${market.stocks.map(s => {
      // 줄 그래프와 칩이 같은 24시간을 본다(색이 서로 다르면 헷갈린다).
      const t = tone(s.price, s.open), held = me.holdings.find(h => h.key === s.key);
      return `<li><button type="button" class="stk-row${held ? ' is-mine' : ''}" data-stk="open" data-key="${s.key}">
        <span class="stk-logo" style="--c:${s.color}">${esc(s.short.slice(0, 2))}</span>
        <span class="stk-name"><b>${esc(s.name)}</b><small>${held ? `<em>내 ${num(held.value)}코인</em>` : esc(s.short)}</small></span>
        ${spark(s.hist.slice(-25), t)}
        ${chip(t, `${arrow(t)} ${Math.abs(pct(s.price, s.open))}%`)}
      </button></li>`;
    }).join('')}</ul>
    <p class="stk-foot">매시 정각에 가격이 바뀌어요 · 수수료 없음 · 오늘 주문 <b>${me.trades_left}</b>번 남음</p>
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

/* ---------- one share's page: 넣기 · 빼기 ---------- */
export function openStock(key, { onBalance, onChange } = {}) {
  let mode = null, amount = MARKET.steps[0], busy = false, close = null;
  const draw = () => {
    const s = market?.stocks.find(x => x.key === key), info = stockOf(key);
    if (!s || !info) return;
    const me = market.me, held = me.holdings.find(h => h.key === key), t = tone(s.price, s.prev), day = tone(s.price, s.open);
    const cash = Number(me.cash || 0), worth = held?.value || 0;
    const maxBuy = Math.max(0, Math.min(MARKET.max_order, cash, MARKET.max_put - (held?.cost || 0)));
    const canBuy = maxBuy >= MARKET.min_order;
    mode ||= worth ? 'sell' : 'buy';
    if (mode === 'sell' && !worth) mode = 'buy';
    const max = mode === 'buy' ? maxBuy : worth, min = mode === 'buy' ? MARKET.min_order : 1;
    amount = Math.max(min, Math.min(amount, Math.max(max, min)));
    const ok = me.trades_left > 0 && (mode === 'buy' ? canBuy && amount <= maxBuy : worth >= 1 && amount <= worth);
    const steps = MARKET.steps.filter(n => n < max);
    const hint = mode === 'buy'
      ? `가격이 10% 오르면 <b class="up">${num(Math.floor(amount * 1.1))}코인</b>, 10% 내리면 <b class="down">${num(Math.floor(amount * 0.9))}코인</b>이 돼요`
      : `빼면 <b>${num(amount)}코인</b>이 바로 내 지갑으로 와요`;
    const html = `<div class="stk-detail" style="--c:${s.color}">
      <div class="stk-d-head"><span class="stk-logo big" style="--c:${s.color}">${esc(s.short.slice(0, 2))}</span><div><h2>${esc(s.name)}</h2><small>${esc(s.short)} 주식 · 1주 ${num(s.price)}코인</small></div></div>
      <div class="stk-moves">${chip(t, `1시간 ${arrow(t)} ${Math.abs(pct(s.price, s.prev))}%`)}${chip(day, `24시간 ${arrow(day)} ${Math.abs(pct(s.price, s.open))}%`)}</div>
      ${chart(s.hist, tone(s.price, s.hist[0]))}
      <p class="stk-tip"><b>📘 ${esc(s.short)} 핵심</b>${esc(s.tip)}</p>
      ${held ? `<div class="stk-mine ${tone(held.pl, 0)}"><span><i>넣은 코인</i><b>${coin()}${num(held.cost)}</b></span><i class="stk-to" aria-hidden="true">→</i><span><i>지금</i><b>${coin()}${num(held.value)}</b></span>${chip(tone(held.pl, 0), `${face(tone(held.pl, 0))} ${signed(held.pl)}`)}</div>` : ''}
      <div class="stk-order">
        <div class="stk-mode" role="group" aria-label="넣기 또는 빼기"><button type="button" data-mode="buy" class="${mode === 'buy' ? 'on' : ''}" aria-pressed="${mode === 'buy'}">넣기</button><button type="button" data-mode="sell" class="${mode === 'sell' ? 'on' : ''}" aria-pressed="${mode === 'sell'}" ${worth ? '' : 'disabled'}>빼기</button></div>
        <div class="stk-amount" role="group" aria-label="코인"><button type="button" data-step="-10" aria-label="10코인 줄이기" ${amount - 10 >= min ? '' : 'disabled'}>−</button><b>${coin()}<span id="stk-amt">${num(amount)}</span></b><button type="button" data-step="10" aria-label="10코인 늘리기" ${amount + 10 <= max ? '' : 'disabled'}>+</button></div>
        <div class="stk-quick">${steps.map(n => `<button type="button" data-set="${n}" class="${amount === n ? 'on' : ''}">${n}</button>`).join('')}${max >= min ? `<button type="button" data-set="${max}" class="${amount === max ? 'on' : ''}">${mode === 'buy' ? '최대' : '전부'}</button>` : ''}</div>
        <p class="stk-hint">${mode === 'buy' && !canBuy ? (cash < MARKET.min_order ? `코인이 ${MARKET.min_order}개 이상 있어야 넣을 수 있어요` : `이 종목에는 ${MARKET.max_put}코인까지 넣을 수 있어요`) : hint}</p>
        <button type="button" class="stk-go ${mode}" data-go ${ok ? '' : 'disabled'}>${num(amount)}코인 ${mode === 'buy' ? '넣기' : '빼기'}</button>
        <p class="stk-cash">내 코인 ${coin()}${num(cash)} · 오늘 주문 ${me.trades_left}번 남음</p>
      </div>
    </div>`;
    const root = document.querySelector('.modal .stk-detail');
    if (root) root.outerHTML = html;
    else close = modal(html, `${s.name} 주식`);
    bind(max, min);
  };
  const bind = (max, min) => {
    const box = document.querySelector('.modal');
    if (!box) return;
    box.querySelectorAll('[data-mode]').forEach(b => { b.onclick = () => { if (mode !== b.dataset.mode) { mode = b.dataset.mode; amount = MARKET.steps[0]; draw(); } }; });
    box.querySelectorAll('[data-step]').forEach(b => { b.onclick = () => { amount = Math.max(min, Math.min(max, amount + Number(b.dataset.step))); draw(); }; });
    box.querySelectorAll('[data-set]').forEach(b => { b.onclick = () => { amount = Number(b.dataset.set); draw(); }; });
    box.querySelector('[data-go]')?.addEventListener('click', e => order(e.currentTarget, max));
  };
  const order = async (button, max) => {
    if (busy) return;
    const s = market.stocks.find(x => x.key === key), side = mode;
    busy = true; button.disabled = true;
    try {
      const res = await api('/market/trade', { key, side, price: s.price, ...(side === 'sell' && amount === max ? { all: true } : { coins: amount }) });
      market = res.market;
      onBalance?.(res.points_balance);
      const name = stockOf(key).name;
      toast(side === 'buy' ? `${name}에 ${num(res.trade.coins)}코인을 넣었어요` : `${name}에서 ${num(res.trade.coins)}코인을 뺐어요`);
      amount = MARKET.steps[0];
      if (side === 'sell' && !market.me.holdings.some(h => h.key === key)) mode = 'buy';
    } catch (err) {
      toast(err.message);
      if (err.status === 409) await loadMarket().catch(() => {});
    }
    busy = false;
    onChange?.();
    if (document.querySelector('.modal .stk-detail')) {
      draw();
      document.querySelector('.modal .stk-mine')?.classList.add(side === 'buy' ? 'flash-buy' : 'flash-sell');
    }
  };
  draw();
  return () => close?.();
}
