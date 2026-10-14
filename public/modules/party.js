import { api, esc, num, icon, toast } from './ui.js';
import { avatar } from './character.js';
import { coin } from './emblems.js';
import { playSound, unlockSound, soundOn, preloadSound } from './sound.js';
import { coinShower } from './celebrate.js';
import { FISH, LURES, RARITY, kgText } from './fishing-rules.js';
import { fishPic } from './fishing-art.js';
import { guardShield } from './streak-guard-ui.js';

// V13.149 교실 게임(학생 폰): 선생님 TV의 보물 사냥 · 반 전체 낚시에 4자리 번호로 들어간다.
// 판정은 방(cloudflare/party-room.mjs → server/party-engine.mjs)이 한다. 폰은 고른 번호만 보낸다.

let P = null;
const root = () => document.getElementById('app');
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)');
const reduced = () => REDUCED.matches;
const sfx = (key, opts) => { if (soundOn()) playSound(key, opts); };
const buzz = p => { try { if (soundOn()) navigator.vibrate?.(p); } catch {} };
const serverNow = () => Date.now() + (P?.offset || 0);
function later(fn, ms) { const cur = P; const t = setTimeout(() => { if (P === cur && !cur.closing) fn(); }, ms); cur.timers.push(t); return t; }
const clock = ms => `${Math.floor(Math.max(0, ms) / 60000)}:${String(Math.floor(Math.max(0, ms) / 1000) % 60).padStart(2, '0')}`;
const CHEST_ART = { gold: '금화', double: '×2', triple: '×3', nothing: '꽝', steal: '훔치기', shield: '방패', swap: '바꾸기', monster: '몬스터', jackpot: '대박' };

export async function openPartyJoin(A, exit, { code }) {
  closeAll();
  P = { A, exit, timers: [], offset: 0, view: null, busy: false };
  A.screen = 'party';
  root().innerHTML = `<div class="session-app pt-app"><header class="pt-top"><button type="button" class="yb-back" data-pt="exit" aria-label="나가기">${icon('back')}</button><strong id="pt-title">교실 게임</strong><span class="pt-clock" id="pt-clock"></span></header><main id="pt-main" class="pt-main"><div class="yb-loading">교실 게임에 들어가는 중…</div></main><div class="pt-toasts" id="pt-toasts" aria-live="polite"></div></div>`;
  root().onclick = onClick;
  window.scrollTo(0, 0);
  preloadSound(['coins', 'fanfare-basic', 'crack', 'shield-block', 'boss-roar']);
  try {
    const r = await api('/party/join', { code });
    if (!P) return;
    P.room = r.room;
    document.getElementById('pt-title').textContent = r.room.kind === 'fish' ? '반 전체 낚시' : '보물 사냥';
    connect();
  } catch (err) {
    if (!P) return;
    main(`<div class="yb-loading"><p>${esc(err.message)}</p><button type="button" class="btn primary" data-pt="exit">돌아가기</button></div>`);
  }
}
function closeAll() {
  if (!P) return;
  P.closing = true;
  P.timers.forEach(clearTimeout);
  clearInterval(P.ticker); clearInterval(P.pinger);
  try { P.ws?.close(); } catch {}
}
async function leave() { const exit = P?.exit; closeAll(); root().onclick = null; P = null; await exit?.(); }
const main = html => { const el = document.getElementById('pt-main'); if (el) el.innerHTML = html; };

function connect() {
  const url = `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/api/party/ws/${P.room.id}?ticket=${encodeURIComponent(P.room.ticket)}`;
  const ws = new WebSocket(url);
  P.ws = ws;
  ws.onopen = () => { P.retries = 0; };
  ws.onmessage = event => { let msg; try { msg = JSON.parse(event.data); } catch { return; } onMessage(msg); };
  ws.onclose = event => {
    if (!P || P.ws !== ws || P.closing) return;
    if (event.code === 4000) { main('<div class="yb-loading"><p>다른 화면에서 이 게임을 열었어요.</p><button type="button" class="btn" data-pt="exit">나가기</button></div>'); P.closing = true; return; }
    if (P.view?.phase === 'ended') return;
    P.retries = (P.retries || 0) + 1;
    if (P.retries > 10) return main('<div class="yb-loading"><p>연결이 끊겼어요.</p><button type="button" class="btn primary" data-pt="retry">다시 연결</button></div>');
    later(connect, Math.min(4000, 500 * P.retries));
  };
  clearInterval(P.pinger);
  P.pinger = setInterval(() => send({ type: 'ping' }), 20000);
  clearInterval(P.ticker);
  P.ticker = setInterval(tickClock, 250);
}
const send = msg => { try { if (P?.ws?.readyState === 1) P.ws.send(JSON.stringify(msg)); } catch {} };

function onClick(event) {
  const b = event.target.closest('[data-pt]');
  if (!b || b.disabled || !P) return;
  unlockSound();
  const act = b.dataset.pt;
  if (act === 'exit') return leave();
  if (act === 'retry') { P.retries = 0; return connect(); }
  if (act === 'answer') return choose(Number(b.dataset.i), b);
  if (act === 'chest') return openChest(Number(b.dataset.i), b);
  if (act === 'target') return pickTarget(b.dataset.pid, b);
}

function onMessage(msg) {
  if (typeof msg.now === 'number') P.offset = msg.now - Date.now();
  if (msg.type === 'view') { P.view = msg.view; return draw(); }
  if (msg.type === 'events') return msg.events.forEach(onEvent);
}
function tickClock() {
  const v = P?.view, el = document.getElementById('pt-clock');
  if (!v || !el) return;
  if (v.phase !== 'play') { el.textContent = ''; return; }
  const left = v.end_at - serverNow();
  el.textContent = clock(left);
  el.classList.toggle('hurry', left < 60000);
  const bar = document.getElementById('pt-wait');
  if (bar && v.q?.wait_until) { const w = v.q.wait_until - serverNow(); if (w <= 0) { P.view.q.wait_until = 0; draw(); } }
  const tb = document.getElementById('pt-target-time');
  if (tb && v.pending) tb.textContent = Math.max(0, Math.ceil((v.pending.until - serverNow()) / 1000));
}

/* ---------- 그리기 ---------- */
function draw() {
  const v = P.view;
  if (!v) return;
  if (v.phase === 'lobby') { P.bodyKey = null; return lobby(v); }
  if (v.phase === 'ended') { P.bodyKey = null; return ended(v); }
  if (P.anim) return; // 상자 여는 연출 · 물고기 연출 중에는 끝난 뒤에 그린다
  if (!document.getElementById('pt-head')) { main('<div id="pt-head"></div><div id="pt-body"></div>'); P.bodyKey = null; }
  // 점수 · 순위 · 1~3등은 맥박마다 바뀐다: 위 칸만 다시 쓴다. 문제 · 상자 · 표적 칸은 바뀔 때만(누르는 중인 버튼이 사라지지 않게).
  const head = headHtml(v);
  if (P.headHtml !== head) { document.getElementById('pt-head').innerHTML = head; P.headHtml = head; }
  const wait = !!(v.q?.wait_until && v.q.wait_until > serverNow());
  const key = JSON.stringify({ p: v.pending ? [v.pending.kind, v.pending.until, v.pending.targets.map(x => x.id + x.gold)] : null, o: v.offer?.n ?? null, q: v.q ? [v.q.n, v.q.prompt] : null, wait });
  if (key === P.bodyKey) return;
  P.bodyKey = key;
  document.getElementById('pt-body').innerHTML = v.pending ? targetPick(v) : v.offer ? chests() : v.q ? question(v) : '<div class="pt-wait-card">잠시만요…</div>';
}
function headHtml(v) {
  const me = v.me, fish = v.kind === 'fish';
  return `<section class="pt-score${fish ? ' fish' : ''}">
    <div class="pt-me">${petMini()}<div><small>${fish ? '총 무게' : '내 금화'}</small><b id="pt-num">${fish ? kgText(me.kg) : num(me.gold)}</b></div></div>
    <div class="pt-rank"><small>순위</small><b>${num(me.rank)}<small>/${num(me.of)}</small></b></div>
    ${fish ? `<div class="pt-lure l${me.lure}"><small>미끼</small><b>${esc(LURES[me.lure].name)}</b></div>` : `<div class="pt-shield${me.shield ? ' on' : ''}" aria-label="방패 ${me.shield}개">${guardShield(me.shield ? 'on' : 'used', 'pt-sh')}<b>${num(me.shield)}</b></div>`}
  </section>
  ${v.frenzy_until > serverNow() ? '<div class="pt-frenzy">🐟 물고기 떼 등장! 큰 물고기가 몰려와요</div>' : ''}
  <div class="pt-top3">${v.top.map((x, i) => `<span class="${x.id === me.id ? 'me' : ''}"><i>${['🥇', '🥈', '🥉'][i]}</i>${esc(x.name)} <b>${fish ? kgText(x.score) : num(x.score)}</b></span>`).join('')}</div>`;
}
const petMini = () => { const pet = P.A.data.stats?.pet; return pet ? `<span class="pt-pet">${avatar(pet.key, { form: Math.max(1, pet.form ?? 1), size: 'mini' })}</span>` : ''; };
function lobby(v) {
  const pet = P.A.data.stats?.pet, fish = v.kind === 'fish';
  main(`<section class="pt-lobby${fish ? ' fish' : ''}">
    <div class="pt-lobby-pet">${pet ? avatar(pet.key, { form: Math.max(1, pet.form ?? 1), expression: 'cheer' }) : ''}</div>
    <h1>${fish ? '반 전체 낚시' : '보물 사냥'}</h1>
    <p class="pt-label">${esc(v.label || '')}</p>
    <div class="pt-lobby-count"><b>${num(v.players || 0)}</b>명 들어왔어요</div>
    <p class="pt-lobby-wait"><i></i><i></i><i></i> 선생님이 시작하면 바로 문제가 나와요</p>
    <ul class="pt-rules">${fish
      ? '<li>맞히면 물고기를 낚아요. <b>빨리 맞힐수록 큰 물고기!</b></li><li>3연속 정답이면 미끼가 좋아져요. 틀리면 2초 쉬어요.</li><li>반 정답이 40개 모이면 <b>물고기 떼</b>가 와요!</li><li>끝날 때 <b>총 무게</b>가 가장 무거운 사람이 이겨요.</li>'
      : `<li>맞히면 <b>상자 3개 중 하나</b>를 골라 열어요.</li><li>금화 · 2배 · 3배 · 대박도 있지만 꽝과 몬스터도 있어요!</li>${v.steal ? '<li><b>훔치기</b> 상자는 친구 금화를 가져와요. <b>방패</b>는 한 번 막아 줘요.</li>' : '<li>이번 판은 훔치기 없이 금화만 모아요.</li>'}<li>틀리면 2초 쉬어요. 진짜 코인은 <b>맞힌 수</b>대로 받아요.</li>`}</ul>
  </section>`);
}
function question(v) {
  const wait = v.q.wait_until && v.q.wait_until > serverNow();
  return `<section class="pt-q${wait ? ' waiting' : ''}">
    <h2>${esc(v.q.prompt)}</h2>
    <div class="pt-opts">${v.q.options.map((o, i) => `<button type="button" class="pt-opt" data-pt="answer" data-i="${i}" ${wait ? 'disabled' : ''}>${esc(o)}</button>`).join('')}</div>
    ${wait ? `<div class="pt-wait" id="pt-wait"><span>${P.lastWrong ? `<b>${esc(P.lastWrong.word)}</b> = ${esc(P.lastWrong.answer)}` : '잠깐 쉬어요'}</span><i style="--d:${Math.max(0, v.q.wait_until - serverNow())}ms"></i></div>` : ''}
  </section>`;
}
function choose(i, b) {
  if (P.busy) return;
  P.busy = true; later(() => { P.busy = false; }, 250);
  b.classList.add('picked');
  document.querySelectorAll('.pt-opt').forEach(x => { x.disabled = true; });
  sfx('tap');
  P.bodyKey = null; // 답이 닿지 않으면 다음 화면에서 버튼이 다시 살아난다
  send({ type: 'answer', choice: i });
}
function chests() {
  return `<section class="pt-chests"><h2>정답! 상자를 골라요</h2><div class="pt-chest-row">${[0, 1, 2].map(i => `<button type="button" class="pt-chest c${i}" data-pt="chest" data-i="${i}" aria-label="${i + 1}번 상자">${chestSvg(i)}</button>`).join('')}</div></section>`;
}
function chestSvg(i) {
  const tones = [['#b45309', '#f59e0b'], ['#6d28d9', '#a78bfa'], ['#047857', '#34d399']][i];
  return `<svg viewBox="0 0 100 86" aria-hidden="true"><defs><linearGradient id="pc${i}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${tones[1]}"/><stop offset="1" stop-color="${tones[0]}"/></linearGradient></defs>
    <g class="lid"><path d="M8 34 Q8 8 50 8 Q92 8 92 34Z" fill="url(#pc${i})" stroke="#3b2106" stroke-width="3"/><path d="M8 34h84" stroke="#fcd34d" stroke-width="5"/><path d="M50 8v26" stroke="#fcd34d" stroke-width="5"/></g>
    <rect x="8" y="34" width="84" height="44" rx="5" fill="url(#pc${i})" stroke="#3b2106" stroke-width="3"/><path d="M50 34v44M8 50h84" stroke="#fcd34d" stroke-width="5"/><rect x="42" y="42" width="16" height="16" rx="3" fill="#fde68a" stroke="#92400e" stroke-width="2"/></svg>`;
}
function openChest(i, b) {
  if (P.busy || P.anim) return;
  P.busy = true; P.anim = { idx: i };
  document.querySelectorAll('.pt-chest').forEach(x => { x.disabled = true; x.classList.toggle('chosen', x === b); x.classList.toggle('other', x !== b); });
  sfx('wiggle'); buzz(30);
  send({ type: 'pick', i });
  later(() => { if (P.anim && !P.anim.result) { P.anim = null; P.busy = false; P.bodyKey = null; draw(); } }, 4000);
}
function targetPick(v) {
  const p = v.pending, swap = p.kind === 'swap';
  return `<section class="pt-targets"><h2>${swap ? '🔄 누구와 금화를 바꿀까요?' : `🦹 누구의 금화 ${p.pct}%를 가져올까요?`}</h2>
    <p>${swap ? '나보다 금화가 많은 친구와 통째로 바꿔요.' : '방패가 있는 친구는 막을 수도 있어요!'} <b id="pt-target-time">${Math.max(0, Math.ceil((p.until - serverNow()) / 1000))}</b>초</p>
    <div class="pt-target-list">${p.targets.map(x => `<button type="button" class="pt-target${x.revenge ? ' revenge' : ''}" data-pt="target" data-pid="${esc(x.id)}">${x.pet ? avatar(x.pet.key, { form: x.pet.form, size: 'mini' }) : ''}<b>${esc(x.name)}</b><span>${coin()}${num(x.gold)}</span>${x.revenge ? '<em>되갚기!</em>' : ''}</button>`).join('')}</div>
  </section>`;
}
function pickTarget(pid, b) {
  if (P.busy) return;
  P.busy = true; later(() => { P.busy = false; }, 600);
  b.classList.add('picked');
  send({ type: 'target', pid });
}

/* ---------- 이벤트 ---------- */
function onEvent(e) {
  const me = P.view?.me?.id;
  if (e.kind === 'wrong' && e.pid === me) { P.lastWrong = e; sfx('wrong'); buzz([30, 30, 30]); return; }
  if (e.kind === 'chests' && e.pid === me) { sfx('correct'); buzz(20); return; }
  if (e.kind === 'opened' && e.pid === me) return chestReveal(e);
  if (e.kind === 'caught' && e.pid === me) return caught(e);
  if (e.kind === 'stole' && e.pid === me) { sfx('coins'); return pop(`🦹 <b>${esc(e.vname)}</b>의 금화 ${e.pct}%! ${coin()}+${num(e.amount)}`, 'good'); }
  if (e.kind === 'swapped' && e.pid === me) { sfx('coins'); return pop(`🔄 <b>${esc(e.vname)}</b>와 금화를 바꿨어요! ${e.gain >= 0 ? '+' : ''}${num(e.gain)}`, 'good'); }
  if (e.kind === 'blocked' && e.pid === me) { sfx('shield-block'); return pop(`🛡️ <b>${esc(e.vname)}</b>가 방패로 막았어요!`, 'bad'); }
  // 내가 당했을 때
  if (e.vid === me && e.kind === 'steal') { sfx('hurt'); buzz([60, 40, 60]); return pop(`😱 <b>${esc(e.name)}</b>가 내 금화 ${e.pct}%(${num(e.amount)})를 가져갔어요! 30초 안에 훔치기 상자가 나오면 <b>되갚기</b>!`, 'bad', 3600); }
  if (e.vid === me && e.kind === 'swap') { sfx('hurt'); return pop(`😵 <b>${esc(e.name)}</b>가 내 금화와 바꿔 갔어요!`, 'bad', 3200); }
  if (e.vid === me && e.kind === 'block') { sfx('shield-block'); buzz(40); return pop(`🛡️ 방패가 <b>${esc(e.name)}</b>의 훔치기를 막았어요!`, 'good', 3000); }
  if (e.kind === 'frenzy') { sfx('boss-roar', { rate: 1.3, gain: .6 }); return pop('🐟🐟 물고기 떼 등장! 20초 동안 큰 물고기가 몰려와요!', 'gold', 3000); }
  if (e.kind === 'end') { sfx('clear'); }
}
function chestReveal(e) {
  P.anim = { ...(P.anim || {}), result: e };
  const row = document.querySelector('.pt-chest-row');
  if (!row) { P.anim = null; P.busy = false; P.bodyKey = null; return draw(); }
  [...row.children].forEach((b, k) => {
    const c = e.chests[k];
    b.classList.add('open', `k-${c.kind}`);
    if (k !== e.idx) b.classList.add('other');
    b.insertAdjacentHTML('beforeend', `<span class="pt-loot">${lootArt(c)}<b>${lootText(c, e, k === e.idx)}</b></span>`);
  });
  const c = e.chest;
  const good = ['gold', 'double', 'triple', 'jackpot', 'shield', 'steal', 'swap'].includes(c.kind);
  later(() => {
    sfx(c.kind === 'jackpot' ? 'fanfare-epic' : c.kind === 'monster' ? 'boss-roar' : c.kind === 'nothing' ? 'fail' : c.kind === 'shield' ? 'shield-block' : 'coins', { gain: c.kind === 'boss-roar' ? .6 : 1 });
    buzz(good ? 30 : [50, 30, 50]);
    if (c.kind === 'jackpot' || c.kind === 'triple') coinShower(document.querySelector('.pt-chests'), 22);
  }, reduced() ? 0 : 380);
  later(() => { P.anim = null; P.busy = false; draw(); }, reduced() ? 600 : (c.kind === 'steal' || c.kind === 'swap' ? 1200 : 1700));
}
function lootArt(c) {
  if (c.kind === 'gold' || c.kind === 'jackpot') return `<span class="pt-coins">${coin()}${c.kind === 'jackpot' ? coin() + coin() : ''}</span>`;
  if (c.kind === 'shield') return guardShield('on', 'pt-loot-sh');
  if (c.kind === 'monster') return '<img src="/assets/monsters/killergolem.webp" alt="" width="64" height="64">';
  return `<span class="pt-loot-ico">${{ double: '×2', triple: '×3', nothing: '💨', steal: '🦹', swap: '🔄' }[c.kind] || '?'}</span>`;
}
function lootText(c, e, mine) {
  if (c.kind === 'gold') return `+${num(c.amount)}`;
  if (c.kind === 'jackpot') return `대박 +${num(c.amount)}`;
  if (c.kind === 'steal') return `훔치기 ${c.pct}%`;
  if (c.kind === 'monster') return mine && e.lost ? `몬스터! −${num(e.lost)}` : '몬스터 습격';
  return CHEST_ART[c.kind] || '';
}
function caught(e) {
  const f = e.fish, info = FISH[f.key];
  P.anim = { fish: f };
  const box = document.createElement('div');
  box.className = `pt-catch r-${f.rarity}`;
  box.innerHTML = `<span class="fs-rarity">${esc(RARITY[f.rarity].name)}</span><div class="pt-catch-art">${fishPic(f.key, { cls: 'pop' })}</div><b>${esc(info.name)}</b><small>${kgText(f.kg)}${e.frenzy ? ' · 물고기 떼!' : ''}</small>`;
  document.querySelector('.pt-app')?.appendChild(box);
  sfx(f.rarity === 'legend' || f.rarity === 'golden' ? 'fanfare-legend' : f.rarity === 'epic' ? 'fanfare-epic' : 'correct');
  buzz(f.rarity === 'legend' ? [80, 40, 120] : 20);
  const hold = ['epic', 'legend', 'golden'].includes(f.rarity) ? 1500 : 850;
  later(() => { box.classList.add('out'); later(() => box.remove(), 250); P.anim = null; draw(); }, reduced() ? 400 : hold);
}
function pop(html, cls = '', ms = 2600) {
  const host = document.getElementById('pt-toasts');
  if (!host) return;
  const el = document.createElement('div');
  el.className = `pt-pop ${cls}`;
  el.innerHTML = html;
  host.appendChild(el);
  while (host.children.length > 3) host.firstElementChild.remove();
  later(() => { el.classList.add('out'); later(() => el.remove(), 300); }, ms);
}

/* ---------- 끝 ---------- */
function ended(v) {
  const r = v.result || {}, fish = v.kind === 'fish';
  const medal = ['🥇', '🥈', '🥉'][r.rank - 1] || '';
  main(`<section class="pt-end">
    <div class="pt-end-rank${r.rank <= 3 ? ` top${r.rank}` : ''}">${medal ? `<i>${medal}</i>` : ''}<b>${num(r.rank || 0)}등</b><small>/ ${num(r.of || 0)}명</small></div>
    <div class="pt-end-pet">${(() => { const pet = P.A.data.stats?.pet; return pet ? avatar(pet.key, { form: Math.max(1, pet.form ?? 1), expression: r.rank <= 3 ? 'cheer' : 'happy' }) : ''; })()}</div>
    <div class="mg-result-facts"><span>${fish ? '총 무게' : '금화'} <b>${fish ? kgText(r.score || 0) : num(r.score || 0)}</b></span><span>맞힌 문제 <b>${num(r.right || 0)}</b></span></div>
    ${r.coins ? `<div class="mg-result-coins">${coin()}<b>+${num(r.coins)}</b><small>경험치 +${num(r.xp || 0)} · 하루 ${3}판까지 받아요</small></div>` : `<p class="mg-result-why">${(r.right || 0) < 5 ? '5문제 이상 맞히면 코인을 받아요.' : ''}</p>`}
    ${v.awards?.length ? `<div class="pt-awards">${v.awards.map(a => `<div class="pt-award ${a.key}"><small>${esc(a.title)}</small><b>${esc(a.name)}</b><span>${esc(a.value)}</span></div>`).join('')}</div>` : ''}
    <button type="button" class="yl-cta" data-pt="exit">나가기</button>
  </section>`);
  if (r.rank === 1 && !P.celebrated) { P.celebrated = true; sfx('fanfare-epic'); coinShower(document.querySelector('.pt-end'), 26, 2); }
  else if (!P.celebrated) { P.celebrated = true; sfx('clear'); }
}
