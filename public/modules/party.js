import { api, esc, num, icon, toast } from './ui.js';
import { avatar } from './character.js';
import { coin } from './emblems.js';
import { playSound, unlockSound, soundOn, preloadSound } from './sound.js';
import { coinShower } from './celebrate.js';
import { FISH, LURES, RARITY, kgText } from './fishing-rules.js';
import { fishPic } from './fishing-art.js';
import { guardShield } from './streak-guard-ui.js';
import { iconize, treasureArt } from './game-icons.js';

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
const CHEST_ART = { gold: '금화', double: '×2', triple: '×3', nothing: '꽝', steal: '훔치기', shield: '방패', swap: '바꾸기', monster: '몬스터', jackpot: '대박', item: '아이템' };
// V13.150 보물 사냥 2.0 아이템 · 이벤트 라운드 이름.
const ITEM = { fifty: ['50:50', '½'], freeze: ['시간 정지', '⏱️'], saver: ['콤보 보호', '🔗'] };
const EVENT = { golden: ['🌟 황금 시간!', '금화 상자가 두 배예요'], raid: ['☠️ 해적선 습격!', '방패 없는 친구는 금화 10%를 뺏겨요'], storm: ['🌪️ 보물 폭풍!', '상자가 5개로 늘었어요'] };

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
    root().querySelector('.pt-app')?.classList.add(r.room.kind === 'fish' ? 'fish' : 'treasure');
    if (r.room.kind !== 'fish' && treasureArt('bg-phone')) root().querySelector('.pt-app')?.classList.add('art-bg');
    connect();
  } catch (err) {
    if (!P) return;
    main(`<div class="yb-loading"><p>${esc(err.message)}</p><button type="button" class="btn primary" data-pt="exit">돌아가기</button></div>`);
  }
}
// V13.150 혼자 보물 사냥: 방(소켓) 대신 폰 안의 엔진(solo: treasure-solo.js)에 이어 같은 화면을 쓴다.
//   solo { attach(onMessage), send(msg), ended(view), stop() }
export function openPartySolo(A, exit, solo) {
  closeAll();
  P = { A, exit, timers: [], offset: 0, view: null, busy: false, solo };
  A.screen = 'party';
  root().innerHTML = `<div class="session-app pt-app treasure solo${treasureArt('bg-phone') ? ' art-bg' : ''}"><header class="pt-top"><button type="button" class="yb-back" data-pt="exit" aria-label="나가기">${icon('back')}</button><strong id="pt-title">혼자 보물 사냥</strong><span class="pt-clock" id="pt-clock"></span></header><main id="pt-main" class="pt-main"></main><div class="pt-toasts" id="pt-toasts" aria-live="polite"></div></div>`;
  root().onclick = onClick;
  window.scrollTo(0, 0);
  preloadSound(['coins', 'fanfare-basic', 'crack', 'shield-block', 'boss-roar', 'warn-beep', 'boss-charge', 'crit']);
  clearInterval(P.ticker);
  P.ticker = setInterval(tickClock, 250);
  solo.attach(onMessage);
}
export const partyMain = html => main(html);
function closeAll() {
  if (!P) return;
  P.closing = true;
  P.solo?.stop?.();
  P.timers.forEach(clearTimeout);
  clearInterval(P.ticker); clearInterval(P.pinger);
  try { P.ws?.close(); } catch {}
}
async function leave() { const exit = P?.exit; closeAll(); root().onclick = null; P = null; await exit?.(); }
const main = html => { const el = document.getElementById('pt-main'); if (el) el.innerHTML = iconize(html); };

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
const send = msg => { if (P?.solo) return P.solo.send(msg); try { if (P?.ws?.readyState === 1) P.ws.send(JSON.stringify(msg)); } catch {} };

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
  if (act === 'alarm') return answerAlarm(Number(b.dataset.i), b);
  if (act === 'peek') { b.disabled = true; sfx('tap'); return send({ type: 'peek' }); }
  if (act === 'item') { sfx('tap'); P.bodyKey = null; return send({ type: 'item', item: b.dataset.item }); }
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
  const ht = document.getElementById('pt-heist-time');
  if (ht && v.heist) ht.textContent = Math.max(0, Math.ceil((v.heist.until - serverNow()) / 1000));
  const at = document.getElementById('pt-alarm-time');
  if (at && v.alarm) {
    at.textContent = Math.max(0, Math.ceil((v.alarm.until - serverNow()) / 1000));
    const fill = document.getElementById('pt-alarm-bar');
    if (fill) fill.style.transform = `scaleX(${Math.max(0, Math.min(1, (v.alarm.until - serverNow()) / (v.alarm.span || 5000)))})`;
  }
}

/* ---------- 그리기 ---------- */
function draw() {
  const v = P.view;
  if (!v) return;
  if (v.phase === 'lobby') { P.bodyKey = null; return lobby(v); }
  if (v.phase === 'ended') { P.bodyKey = null; return P.solo ? P.solo.ended(v) : ended(v); }
  if (P.anim) return; // 상자 여는 연출 · 물고기 연출 중에는 끝난 뒤에 그린다
  if (!document.getElementById('pt-head')) { main('<div id="pt-head"></div><div id="pt-body"></div>'); P.bodyKey = null; }
  // 점수 · 순위 · 1~3등은 맥박마다 바뀐다: 위 칸만 다시 쓴다. 문제 · 상자 · 표적 칸은 바뀔 때만(누르는 중인 버튼이 사라지지 않게).
  const head = headHtml(v);
  if (P.headHtml !== head) { document.getElementById('pt-head').innerHTML = iconize(head); P.headHtml = head; }
  const wait = !!(v.q?.wait_until && v.q.wait_until > serverNow());
  if (v.alarm && !P.alarmSpan) P.alarmSpan = v.alarm.until - serverNow(); else if (!v.alarm) P.alarmSpan = 0;
  if (v.alarm) v.alarm.span = P.alarmSpan;
  const key = JSON.stringify({ a: v.alarm ? [v.alarm.by, v.alarm.until, v.alarm.prompt] : null, h: v.heist ? [v.heist.got, v.heist.vname] : null, p: v.pending ? [v.pending.kind, v.pending.until, v.pending.targets.map(x => x.id + x.gold + (x.bounty ? 'b' : ''))] : null, o: v.offer ? [v.offer.n, v.offer.count, v.offer.peeked, v.offer.caught, v.offer.kinds] : null, q: v.q ? [v.q.n, v.q.prompt, v.q.hide, v.me.inv?.fifty || 0] : null, wait });
  if (key === P.bodyKey) return;
  P.bodyKey = key;
  document.getElementById('pt-body').innerHTML = iconize(v.alarm ? alarmCard(v) : v.pending ? targetPick(v) : v.offer ? chests(v) : v.q ? question(v) : '<div class="pt-wait-card">잠시만요…</div>');
}
function headHtml(v) {
  const me = v.me, fish = v.kind === 'fish';
  return `<section class="pt-score${fish ? ' fish' : ''}">
    <div class="pt-me">${petMini()}<div><small>${fish ? '총 무게' : '내 금화'}</small><b id="pt-num">${fish ? kgText(me.kg) : num(me.gold)}</b></div></div>
    <div class="pt-rank"><small>순위</small><b>${me.rank ? `${num(me.rank)}<small>/${num(me.of)}</small>` : '?'}</b></div>
    ${fish ? `<div class="pt-lure l${me.lure}"><small>미끼</small><b>${esc(LURES[me.lure].name)}</b></div>` : `<div class="pt-shield${me.shield ? ' on' : ''}" aria-label="방패 ${me.shield}개">${guardShield(me.shield ? 'on' : 'used', 'pt-sh')}<b>${num(me.shield)}</b></div>`}
  </section>
  ${me.team ? teamBar(v) : ''}${eventBar(v)}${invBar(me)}
  ${v.frenzy_until > serverNow() ? '<div class="pt-frenzy">🐟 물고기 떼 등장! 큰 물고기가 몰려와요</div>' : ''}
  ${v.hidden ? '<div class="pt-top3 hidden"><span>🤫 마지막 1분! 순위는 끝나고 공개해요</span></div>' : ''}<div class="pt-top3">${v.top.map((x, i) => `<span class="${x.id === me.id ? 'me' : ''}"><i>${['🥇', '🥈', '🥉'][i]}</i>${esc(x.name)} <b>${fish ? kgText(x.score) : num(x.score)}</b></span>`).join('')}</div>`;
}
const teamBar = v => `<div class="pt-team t${v.me.team}"><b>${v.me.team === 'A' ? '🔴 A팀' : '🔵 B팀'}</b>${v.team_gold ? v.team_gold.map(t => `<span class="${t.team === v.me.team ? 'mine' : ''}">${t.team}팀 ${num(t.gold)}</span>`).join('') : '<span>마지막 1분: 점수 비공개</span>'}</div>`;
const eventBar = v => v.event && EVENT[v.event.kind] ? `<div class="pt-event ${v.event.kind}"><b>${EVENT[v.event.kind][0]}</b><span>${EVENT[v.event.kind][1]}</span></div>` : '';
const invBar = me => {
  const have = Object.entries(me.inv || {}).filter(([, n]) => n > 0);
  return have.length ? `<div class="pt-inv" aria-label="가진 아이템">${have.map(([k, n]) => `<span class="${k}"><i>${ITEM[k][1]}</i>${ITEM[k][0]}${n > 1 ? ` ×${n}` : ''}</span>`).join('')}</div>` : '';
};
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
      : `<li>맞히면 <b>상자 3개 중 하나</b>를 골라 열어요.</li><li>금화 · 2배 · 3배 · 대박도 있지만 꽝과 몬스터도 있어요!</li>${v.steal ? '<li><b>훔치기</b> 상자는 친구 금화를 가져와요. <b>방패</b>는 한 번 막아 줘요.</li>' : '<li>이번 판은 훔치기 없이 금화만 모아요.</li>'}<li>틀리면 2초 쉬어요. 진짜 코인은 <b>맞힌 수</b>대로 받아요.</li>${v.steal ? '<li>훔치려면 <b>금고 털이</b>(연속 3문제)! 털리는 친구는 <b>도난 경보</b>에 5초 안에 맞히면 막아요.</li><li><b>1등</b>을 털면 <b>현상금</b>이 붙어요. 상자를 <b>엿볼</b> 수도 있지만 30%는 들켜요.</li>' : ''}<li>중간에 <b>황금 시간 · 해적선 습격 · 보물 폭풍</b>이 와요!</li>${v.teams ? '<li>이번 판은 <b>팀전</b>! 훔치기는 상대 팀만, 팀 금화 합계가 큰 쪽이 이겨요.</li>' : ''}`}</ul>
  </section>`);
}
function question(v) {
  const wait = v.q.wait_until && v.q.wait_until > serverNow(), hide = v.q.hide || [], h = v.heist;
  const fifty = (v.me.inv?.fifty || 0) > 0 && !hide.length && !wait;
  return `<section class="pt-q${wait ? ' waiting' : ''}${h ? ' heist' : ''}">
    ${h ? `<div class="pt-heist"><b>🦹 ${esc(h.vname)}의 ${h.kind === 'swap' ? '금고와 바꾸기' : `금고 ${h.pct}%`}</b><span class="pt-steps">${Array.from({ length: h.need }, (_, k) => `<i class="${k < h.got ? 'on' : ''}"></i>`).join('')}</span><small><b id="pt-heist-time">${Math.max(0, Math.ceil((h.until - serverNow()) / 1000))}</b>초 · 틀리면 실패</small></div>` : ''}
    <h2>${esc(v.q.prompt)}</h2>
    <div class="pt-opts">${v.q.options.map((o, i) => hide.includes(i) ? '<button type="button" class="pt-opt gone" disabled aria-hidden="true">✕</button>' : `<button type="button" class="pt-opt" data-pt="answer" data-i="${i}" ${wait ? 'disabled' : ''}>${esc(o)}</button>`).join('')}</div>
    ${fifty ? `<button type="button" class="pt-item-btn" data-pt="item" data-item="fifty">½ 50:50 쓰기 <b>×${v.me.inv.fifty}</b></button>` : ''}
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
function chests(v) {
  const o = v.offer, n = o.count || 3, k = o.kinds;
  const peek = !o.peeked ? '<button type="button" class="pt-peek-btn" data-pt="peek">👀 몰래 엿보기 <small>30% 들키면 금화 −20%</small></button>'
    : o.caught ? '<p class="pt-peek-msg bad">😱 들켰어요! 아무것도 못 봤어요</p>' : '<p class="pt-peek-msg good">👀 살짝 봤어요!</p>';
  return `<section class="pt-chests${n > 3 ? ' storm' : ''}"><h2>${n > 3 ? '🌪️ 보물 폭풍! 상자가 5개예요' : '정답! 상자를 골라요'}</h2><div class="pt-chest-row n${n}">${Array.from({ length: n }, (_, i) => `<button type="button" class="pt-chest c${i % 3}" data-pt="chest" data-i="${i}" aria-label="${i + 1}번 상자">${chestSvg(i)}${k ? `<span class="pt-peek-tag k-${k[i]}">${CHEST_ART[k[i]] || ''}</span>` : ''}</button>`).join('')}</div>${peek}</section>`;
}
// V13.150 손그림 상자: 잉크 외곽선 · 평면 색 · 쇠 띠 · 나뭇결(그라데이션 · 흐린 그림자 없이).
function chestSvg(i) {
  // 그림 30이 있으면 그림 상자(닫힘 3색 · 열림), 없으면 아래 손그림 SVG.
  const art = treasureArt(['chest-gold', 'chest-violet', 'chest-green'][i % 3]);
  if (art && treasureArt('chest-open')) return `<img class="pt-chest-img" src="${art}" alt="" draggable="false"><img class="pt-chest-img opened" src="${treasureArt('chest-open')}" alt="" draggable="false">`;
  const [body, dark] = [['#c0763a', '#8a4f22'], ['#7a5aa6', '#563d7c'], ['#4e9a57', '#346b3b']][i % 3], ink = '#2b1d12';
  return `<svg viewBox="0 0 100 86" aria-hidden="true">
    <ellipse cx="50" cy="82" rx="40" ry="4" fill="${ink}" opacity=".35"/>
    <g class="lid"><path d="M8 34 Q8 8 50 8 Q92 8 92 34Z" fill="${dark}" stroke="${ink}" stroke-width="3.5" stroke-linejoin="round"/><path d="M18 20 Q50 12 82 20" fill="none" stroke="${ink}" stroke-width="1.6" opacity=".45"/><path d="M8 34h84" stroke="${ink}" stroke-width="3.5"/><path d="M26 11v23M74 11v23" stroke="#e8a930" stroke-width="6"/><path d="M26 11v23M74 11v23" stroke="${ink}" stroke-width="1.6" opacity=".6"/></g>
    <rect x="8" y="34" width="84" height="44" rx="4" fill="${body}" stroke="${ink}" stroke-width="3.5"/><path d="M12 50h76M12 64h76" stroke="${ink}" stroke-width="1.6" opacity=".35"/>
    <path d="M26 34v44M74 34v44" stroke="#e8a930" stroke-width="6"/><path d="M26 34v44M74 34v44" stroke="${ink}" stroke-width="1.6" opacity=".6"/>
    <rect x="41" y="38" width="18" height="20" rx="3" fill="#e8a930" stroke="${ink}" stroke-width="3"/><circle cx="50" cy="46" r="2.6" fill="${ink}"/><path d="M50 47v6" stroke="${ink}" stroke-width="2.6" stroke-linecap="round"/></svg>`;
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
    <p>${swap ? '나보다 금화가 많은 친구와 통째로 바꿔요.' : '방패가 있으면 막혀요. 뽑으면 <b>금고 털이(연속 3문제)</b>!'} <b id="pt-target-time">${Math.max(0, Math.ceil((p.until - serverNow()) / 1000))}</b>초</p>
    <div class="pt-target-list">${p.targets.map(x => `<button type="button" class="pt-target${x.revenge ? ' revenge' : ''}${x.bounty ? ' bounty' : ''}" data-pt="target" data-pid="${esc(x.id)}">${x.pet ? avatar(x.pet.key, { form: x.pet.form, size: 'mini' }) : ''}<b>${esc(x.name)}</b><span>${coin()}${num(x.gold)}</span>${x.bounty ? '<em class="bty">📜 현상금 +50</em>' : ''}${x.revenge ? '<em>되갚기!</em>' : ''}</button>`).join('')}</div>
  </section>`;
}
function alarmCard(v) {
  const a = v.alarm;
  return `<section class="pt-alarm"><div class="pt-siren" aria-hidden="true">🚨</div><h2>도난 경보!</h2>
    <p><b>${esc(a.by)}</b>가 내 금고를 털고 있어요! 맞히면 막아요 <b id="pt-alarm-time">${Math.max(0, Math.ceil((a.until - serverNow()) / 1000))}</b>초</p>
    <div class="pt-alarm-bar"><i id="pt-alarm-bar"></i></div>
    <h3>${esc(a.prompt)}</h3>
    <div class="pt-opts">${a.options.map((o, i) => `<button type="button" class="pt-opt" data-pt="alarm" data-i="${i}">${esc(o)}</button>`).join('')}</div></section>`;
}
function answerAlarm(i, b) {
  if (P.busy) return;
  P.busy = true; later(() => { P.busy = false; }, 250);
  b.classList.add('picked');
  document.querySelectorAll('.pt-alarm .pt-opt').forEach(x => { x.disabled = true; });
  P.bodyKey = null;
  send({ type: 'alarm', choice: i });
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
  if (e.kind === 'heist' && e.pid === me && e.need) { sfx('boss-charge', { gain: .6 }); buzz(30); return pop(`🦹 <b>${esc(e.vname)}</b>의 금고 털이 시작! 연속 ${e.need}문제!`, 'good'); }
  if (e.kind === 'heist-step' && e.pid === me) { sfx('crit', { gain: .5, rate: 1 + e.got * .15 }); buzz(20); return; }
  if (e.kind === 'heist-void' && e.pid === me) return pop('금고가 이미 비었어요…', 'bad');
  if (e.kind === 'heistfail' && e.pid === me) { sfx('fail'); buzz([40, 30, 40]); return pop(`금고 털이 실패… <b>${esc(e.vname)}</b>는 무사해요`, 'bad'); }
  if (e.kind === 'heistfail' && e.vid === me) { sfx('pop'); return pop('😮‍💨 털이범이 실패했어요!', 'good', 2200); }
  if (e.kind === 'heist' && e.vid === me) { sfx('warn-beep'); sfx('warn-beep', { at: .2 }); buzz([120, 60, 120, 60, 200]); return; }
  if (e.kind === 'alarmed' && e.pid === me) { sfx(e.defended ? 'shield-block' : 'wrong'); buzz(e.defended ? 40 : [40, 30, 40]); return pop(e.defended ? '🛡️ 맞혔어요! 털이범을 막는 중…' : `놓쳤어요… 답은 <b>${esc(e.answer)}</b>`, e.defended ? 'good' : 'bad', 2600); }
  if (e.kind === 'peeked' && e.pid === me) { sfx(e.caught ? 'hurt' : 'pop'); buzz(e.caught ? [60, 40, 60] : 20); return pop(e.caught ? `😱 들켰다! 금화 −${num(e.lost)}` : '👀 상자 속이 보여요!', e.caught ? 'bad' : 'good'); }
  if (e.kind === 'itemused' && e.pid === me) { sfx('skill'); return pop('½ 틀린 보기 둘을 지웠어요!', 'good', 1800); }
  if (e.kind === 'event') { const info = EVENT[e.event]; if (!info) return; sfx(e.event === 'raid' ? 'boss-roar' : e.event === 'storm' ? 'ult-riser' : 'fanfare-basic', { gain: .7 }); buzz(e.event === 'raid' ? [100, 50, 100] : 40); return pop(`<b>${info[0]}</b> ${info[1]}`, e.event === 'raid' ? 'bad' : 'gold', 3800); }
  if (e.kind === 'stole' && e.pid === me) { sfx('coins'); return pop(`🦹 <b>${esc(e.vname)}</b>의 금화 ${e.pct}%! ${coin()}+${num(e.amount)}${e.bounty ? ` · 💰 현상금 +${num(e.bounty)}` : ''}`, 'good'); }
  if (e.kind === 'swapped' && e.pid === me) { sfx('coins'); return pop(`🔄 <b>${esc(e.vname)}</b>와 금화를 바꿨어요! ${e.gain >= 0 ? '+' : ''}${num(e.gain)}`, 'good'); }
  if (e.kind === 'blocked' && e.pid === me) { sfx('shield-block'); return pop(e.defended ? `🚨 <b>${esc(e.vname)}</b>가 경보에 맞혀서 막았어요!` : `🛡️ <b>${esc(e.vname)}</b>가 방패로 막았어요!`, 'bad'); }
  // 내가 당했을 때
  if (e.vid === me && e.kind === 'steal') { sfx('hurt'); buzz([60, 40, 60]); return pop(`😱 <b>${esc(e.name)}</b>가 내 금화 ${e.pct}%(${num(e.amount)})를 가져갔어요! 30초 안에 훔치기 상자가 나오면 <b>되갚기</b>!`, 'bad', 3600); }
  if (e.vid === me && e.kind === 'swap') { sfx('hurt'); return pop(`😵 <b>${esc(e.name)}</b>가 내 금화와 바꿔 갔어요!`, 'bad', 3200); }
  if (e.vid === me && e.kind === 'block') { sfx('shield-block'); buzz(40); return pop(e.defended ? `🚨 경보로 <b>${esc(e.name)}</b>의 금고 털이를 막았어요! ${coin()}+10` : `🛡️ 방패가 <b>${esc(e.name)}</b>의 훔치기를 막았어요!`, 'good', 3000); }
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
    b.insertAdjacentHTML('beforeend', iconize(`<span class="pt-loot">${lootArt(c)}<b>${lootText(c, e, k === e.idx)}</b></span>`));
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
  if (c.kind === 'item') return `<span class="pt-loot-ico">${ITEM[c.item]?.[1] || '🎁'}</span>`;
  return `<span class="pt-loot-ico">${{ double: '×2', triple: '×3', nothing: '💨', steal: '🦹', swap: '🔄' }[c.kind] || '?'}</span>`;
}
function lootText(c, e, mine) {
  if (c.kind === 'gold') return `+${num(c.amount)}`;
  if (c.kind === 'jackpot') return `대박 +${num(c.amount)}`;
  if (c.kind === 'steal') return `훔치기 ${c.pct}%`;
  if (c.kind === 'monster') return mine && e.lost ? `몬스터! −${num(e.lost)}` : '몬스터 습격';
  if (c.kind === 'item') return mine && e.fallback ? `가득 참 +${num(e.fallback)}` : ITEM[c.item]?.[0] || '아이템';
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
  el.innerHTML = iconize(html);
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
    ${r.team ? `<div class="pt-team-end t${r.team}">${r.team_win ? '🏆 우리 팀 승리!' : r.team_gold && r.team_gold[0].gold === r.team_gold[1].gold ? '🤝 무승부' : '아쉬워요'} <small>${(r.team_gold || []).map(t => `${t.team}팀 ${num(t.gold)}`).join(' : ')}${r.team_win ? ` · 코인 +${3}` : ''}</small></div>` : ''}
    <div class="mg-result-facts"><span>${fish ? '총 무게' : '금화'} <b>${fish ? kgText(r.score || 0) : num(r.score || 0)}</b></span><span>맞힌 문제 <b>${num(r.right || 0)}</b></span></div>
    ${r.coins ? `<div class="mg-result-coins">${coin()}<b>+${num(r.coins)}</b><small>경험치 +${num(r.xp || 0)} · 하루 ${3}판까지 받아요</small></div>` : `<p class="mg-result-why">${(r.right || 0) < 5 ? '5문제 이상 맞히면 코인을 받아요.' : ''}</p>`}
    ${v.awards?.length ? `<div class="pt-awards">${v.awards.map(a => `<div class="pt-award ${a.key}"><small>${esc(a.title)}</small><b>${esc(a.name)}</b><span>${esc(a.value)}</span></div>`).join('')}</div>` : ''}
    <button type="button" class="yl-cta" data-pt="exit">나가기</button>
  </section>`);
  if (r.rank === 1 && !P.celebrated) { P.celebrated = true; sfx('fanfare-epic'); coinShower(document.querySelector('.pt-end'), 26, 2); }
  else if (!P.celebrated) { P.celebrated = true; sfx('clear'); }
}
