import { api, esc, icon, toast, num, rangeLabel } from './ui.js';
import { CHARACTERS, PET_FORMS } from './core.js';
import { avatar, petKey } from './character.js';
import { getRanges } from './student.js';
import { petJosa } from './pet-moments.js';

// Yacha battle screens: lobby (create / join), waiting room, the match, and the result.
// The match runs in a battle room on the server; this module only draws what the room
// says and sends answers and skills. It owns #app while A.screen === 'battle'.

const STAKES = [10, 30, 50];
const SKILLS = [
  { id: 'shield', name: '방패', cost: 2, desc: '받는 피해 절반' },
  { id: 'heal', name: '회복', cost: 3, desc: 'HP 20 회복' },
  { id: 'freeze', name: '얼리기', cost: 4, desc: '상대 2초 멈춤' },
  { id: 'power', name: '필살기', cost: 5, desc: '다음 공격 2배' }
];
const MAX_HP = 100, MAX_KI = 5;
const REASONS = { end: '시간 종료', forfeit: '상대가 나갔어요', disconnect: '연결이 끊겼어요', cancelled: '대결이 취소됐어요' };

let B = null; // current screen state

const root = () => document.getElementById('app');
const serverNow = () => Date.now() + (B?.clockOffset || 0);
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const petName = pet => pet?.name || CHARACTERS[petKey(pet?.key)]?.ko || '';

export async function openBattle(A, exit) {
  closeSocket();
  B = { A, exit, stake: 10, ranges: null, joinCode: '' };
  root().innerHTML = shell('<div class="yb-loading">야차전을 준비하고 있어요…</div>');
  bindRoot();
  try {
    const [{ battle }, history] = await Promise.all([api('/battle/current'), api('/battle/history')]);
    B.history = history;
    if (battle) return enterRoom(battle);
    lobby();
  } catch (err) { toast(err.message); leaveScreen(); }
}

function shell(content) {
  return `<div class="session-app battle-app"><header class="yb-top"><button type="button" class="yb-back" data-yb="exit" aria-label="나가기">${icon('back')}</button><strong>야차전</strong><span class="yb-top-note" id="yb-top-note"></span></header><main class="yb-main" id="yb-main">${content}</main></div>`;
}
function main(html) { const m = document.getElementById('yb-main'); if (m) m.innerHTML = html; }

function bindRoot() {
  root().onclick = event => {
    const b = event.target.closest('[data-yb]'); if (!b || b.disabled) return;
    const act = b.dataset.yb;
    if (act === 'exit') return tryExit();
    if (act === 'range') { toggleRange(b.dataset.code); return; }
    if (act === 'stake') { B.stake = Number(b.dataset.stake); lobby(); return; }
    if (act === 'create') return createRoom(b);
    if (act === 'join') return joinRoom(b);
    if (act === 'cancel') return cancelRoom(b);
    if (act === 'answer') return send({ type: 'answer', choice: Number(b.dataset.choice) }, b);
    if (act === 'skill') return send({ type: 'skill', skill: b.dataset.skill });
    if (act === 'leave') return confirmLeave();
    if (act === 'again') return openBattle(B.A, B.exit);
  };
  root().oninput = event => { if (event.target.id === 'yb-code') B.joinCode = event.target.value.replace(/\D/g, '').slice(0, 6); };
}

/* ---------- lobby ---------- */
function lobbyRanges() {
  const A = B.A, grade = A.data.profile.class_name;
  const { words, codes } = getRanges(A, A.school, grade);
  const counts = new Map(); for (const w of words) counts.set(w.range_code, (counts.get(w.range_code) || 0) + 1);
  B.ranges ??= new Set(codes.filter(c => (counts.get(c) || 0) >= 8).slice(0, 1));
  return { codes, counts };
}
function toggleRange(code) { B.ranges.has(code) ? B.ranges.delete(code) : B.ranges.add(code); lobby(); }

function lobby() {
  const A = B.A, g = A.data.stats, h = B.history || { record: { wins: 0, losses: 0, draws: 0 }, battles: [], lost_today: 0, daily_loss_cap: 150 };
  const { codes, counts } = lobbyRanges();
  const balance = Number(g.points_balance || 0), lossLeft = Math.max(0, h.daily_loss_cap - h.lost_today);
  const selectedWords = [...B.ranges].reduce((n, c) => n + (counts.get(c) || 0), 0);
  const canCreate = B.ranges.size && selectedWords >= 8 && balance >= B.stake && B.stake <= lossLeft;
  const pet = g.pet;
  main(`
    <section class="yb-hero">
      <div class="yb-hero-pet">${pet ? avatar(pet.key, { form: Math.max(1, pet.form) }) : ''}</div>
      <div><span class="yb-eyebrow">1 : 1 단어 배틀</span><h1>${pet ? esc(petJosa(petName(pet), '과', '와')) : ''} 함께 대결!</h1>
      <p>같은 학교·학년 친구와 같은 단어로 겨뤄요. 먼저 맞히면 공격해요.</p>
      <div class="yb-record"><b>${h.record.wins}</b>승 <b>${h.record.losses}</b>패 <b>${h.record.draws}</b>무</div></div>
    </section>
    <section class="yb-card">
      <h2>방 만들기</h2>
      <div class="yb-label">단어 범위 <small>${B.ranges.size ? `${B.ranges.size}개 범위 · ${selectedWords}단어` : '범위를 골라주세요'}</small></div>
      <div class="yb-ranges">${codes.map(c => `<button type="button" class="yb-chip ${B.ranges.has(c) ? 'on' : ''}" data-yb="range" data-code="${esc(c)}" aria-pressed="${B.ranges.has(c)}">${esc(rangeLabel(A.data.profile.school, c))}<small>${counts.get(c) || 0}</small></button>`).join('') || '<p class="yb-muted">학습할 단어 범위가 없어요.</p>'}</div>
      <div class="yb-label">판돈 <small>보유 ${num(balance)}P · 오늘 더 잃을 수 있는 포인트 ${num(lossLeft)}P</small></div>
      <div class="yb-stakes">${STAKES.map(s => `<button type="button" class="yb-stake ${B.stake === s ? 'on' : ''}" data-yb="stake" data-stake="${s}" aria-pressed="${B.stake === s}" ${balance < s || s > lossLeft ? 'disabled' : ''}>${s}P</button>`).join('')}</div>
      <p class="yb-note">이기면 판돈만큼 받고, 지면 판돈만큼 잃어요. 무승부면 그대로예요.</p>
      <button type="button" class="btn primary full" data-yb="create" ${canCreate ? '' : 'disabled'}>방 만들기</button>
    </section>
    <section class="yb-card">
      <h2>코드로 참가</h2>
      <div class="yb-join"><input id="yb-code" inputmode="numeric" autocomplete="off" maxlength="6" placeholder="6자리 코드" value="${esc(B.joinCode)}" aria-label="대결 방 코드"><button type="button" class="btn primary" data-yb="join">참가</button></div>
    </section>
    ${h.battles.length ? `<section class="yb-card"><h2>최근 대결</h2><ul class="yb-history">${h.battles.slice(0, 8).map(b => `<li class="${b.outcome}"><b>${b.outcome === 'win' ? '승' : b.outcome === 'lose' ? '패' : '무'}</b><span>${esc(b.opponent || '친구')}</span><small>${b.outcome === 'win' ? '+' : b.outcome === 'lose' ? '−' : '±'}${b.outcome === 'draw' ? 0 : b.stake}P</small></li>`).join('')}</ul></section>` : ''}`);
}

async function createRoom(button) {
  button.disabled = true;
  try {
    const room = await api('/battle/rooms', { stake: B.stake, range_codes: [...B.ranges] });
    enterRoom({ ...room, host: true });
  } catch (err) { toast(err.message); button.disabled = false; }
}
async function joinRoom(button) {
  if (!/^\d{6}$/.test(B.joinCode)) return toast('6자리 코드를 입력해주세요.');
  button.disabled = true;
  try {
    const room = await api('/battle/join', { code: B.joinCode });
    enterRoom({ ...room, host: false });
  } catch (err) { toast(err.message); button.disabled = false; }
}
async function cancelRoom(button) {
  button.disabled = true;
  try { await api(`/battle/rooms/${B.room.id}/cancel`, {}); } catch (err) { toast(err.message); }
  closeSocket(); openBattle(B.A, B.exit);
}

/* ---------- room connection ---------- */
function enterRoom(room) {
  B.room = room;
  B.view = null;
  if (room.status === 'waiting' && room.host) waitingRoom();
  else main('<div class="yb-loading">대결 방에 연결하고 있어요…</div>');
  openSocket();
}

function openSocket() {
  closeSocket(false);
  const url = `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/api/battle/ws/${B.room.id}?ticket=${encodeURIComponent(B.room.ticket)}`;
  const ws = new WebSocket(url);
  B.ws = ws;
  ws.onmessage = event => { let msg; try { msg = JSON.parse(event.data); } catch { return; } onMessage(msg); };
  ws.onclose = () => {
    if (B?.ws !== ws || B.closing) return;
    if (B.view?.phase === 'finished') return;
    B.retries = (B.retries || 0) + 1;
    if (B.retries > 8) { toast('대결 방에 다시 연결하지 못했어요.'); return; }
    setNote('연결이 끊겨 다시 연결하는 중…');
    setTimeout(() => { if (B?.ws === ws) openSocket(); }, Math.min(4000, 600 * B.retries));
  };
  ws.onopen = () => { B.retries = 0; setNote(''); };
  clearInterval(B.pinger);
  B.pinger = setInterval(() => { if (ws.readyState === 1) ws.send('{"type":"ping"}'); }, 20000);
}
function closeSocket(final = true) {
  if (!B) return;
  if (final) { B.closing = true; clearInterval(B.pinger); cancelAnimationFrame(B.raf); clearInterval(B.waitTimer); }
  try { B.ws?.close(); } catch {}
  B.ws = null;
}
function send(message, button) {
  if (B?.ws?.readyState !== 1) return toast('대결 방과 연결되지 않았어요.');
  if (button) button.classList.add('picked');
  B.ws.send(JSON.stringify(message));
}
function setNote(text) { const n = document.getElementById('yb-top-note'); if (n) n.textContent = text; }

function onMessage(msg) {
  if (typeof msg.now === 'number') B.clockOffset = msg.now - Date.now();
  if (msg.type === 'lobby') { if (B.room.host) waitingRoom(msg.expires_at); return; }
  if (msg.type === 'cancelled' || msg.type === 'expired') { toast(msg.type === 'expired' ? '10분 동안 아무도 들어오지 않아 방이 닫혔어요.' : '대결 방이 취소됐어요.'); closeSocket(); return openBattle(B.A, B.exit); }
  if (msg.type === 'view') { B.view = msg.view; return drawMatch(); }
  if (msg.type === 'events' && B.view) { for (const e of msg.events) applyEvent(e); }
}

/* ---------- waiting room ---------- */
function waitingRoom(expiresAt = B.room.expires_at) {
  const code = String(B.room.code || '');
  main(`<section class="yb-card yb-waiting">
    <span class="yb-eyebrow">친구를 기다리는 중</span>
    <div class="yb-code" aria-label="대결 방 코드 ${esc(code)}">${esc(code.slice(0, 3))}<i></i>${esc(code.slice(3))}</div>
    <p>같은 학교·학년 친구에게 이 코드를 알려주세요.<br>친구가 <b>야차전 → 코드로 참가</b>에 입력하면 시작해요.</p>
    <p class="yb-note">판돈 ${B.room.stake}P · <span id="yb-wait-left"></span></p>
    <button type="button" class="btn full" data-yb="cancel">방 취소</button>
  </section>`);
  clearInterval(B.waitTimer);
  const tickWait = () => { const left = Math.max(0, (expiresAt || 0) - serverNow()); const el = document.getElementById('yb-wait-left'); if (el) el.textContent = `${Math.floor(left / 60000)}:${String(Math.floor(left / 1000) % 60).padStart(2, '0')} 뒤에 방이 닫혀요`; };
  tickWait(); B.waitTimer = setInterval(tickWait, 1000);
}

/* ---------- match ---------- */
const me = () => B.view.players[B.view.me];
const foe = () => B.view.players[B.view.order.find(id => id !== B.view.me)];

function drawMatch() {
  clearInterval(B.waitTimer);
  const v = B.view;
  if (v.phase === 'finished') return drawResult();
  const m = me(), f = foe();
  main(`
    <div class="yb-clock"><b>남은 시간</b><span id="yb-clock">1:30</span></div>
    <div class="yb-arena" id="yb-arena">
      <div class="yb-banner">夜叉</div><div class="yb-centerline"></div><div class="yb-ring"></div>
      ${hud(f, 'op')}
      <div class="yb-pet op" id="yb-pet-op">${avatar(f.pet?.key, { form: Math.max(1, f.pet?.form || 1) })}</div>
      <div class="yb-pet me" id="yb-pet-me">${avatar(m.pet?.key, { form: Math.max(1, m.pet?.form || 1) })}</div>
      ${hud(m, 'me')}
      <div class="yb-flash" id="yb-flash"></div>
      <div class="yb-countdown" id="yb-countdown" hidden></div>
    </div>
    <div class="yb-msg" aria-live="polite"><div class="yb-msg-main" id="yb-msg-main"></div><div class="yb-msg-sub" id="yb-msg-sub"></div></div>
    <div class="yb-question"><div class="yb-q-head"><span id="yb-q-n"></span><span>판돈 ${v.stake}P</span></div><div class="yb-q-word" id="yb-q-word">…</div><div class="yb-turnbar"><i id="yb-turnbar"></i></div><div class="yb-status"><span id="yb-status-me"></span><span id="yb-status-op"></span></div></div>
    <div class="yb-skillbar" id="yb-skillbar"></div>
    <div class="yb-answers" id="yb-answers"></div>
    <button type="button" class="yb-leave" data-yb="leave">대결 포기하기</button>`);
  refreshHud();
  if (v.phase === 'waiting') say('상대가 들어오기를 기다리는 중…', '둘 다 연결되면 3초 뒤에 시작해요.');
  if (v.phase === 'countdown') showCountdown(v.deadline);
  if (v.question) drawQuestion();
  loop();
}

function hud(p, side) {
  return `<div class="yb-hud ${side}" id="yb-hud-${side}">
    <div class="yb-hud-row"><span class="yb-hud-name">${esc(petName(p.pet))}</span><span class="yb-hud-lv">${p.pet?.form ? PET_FORMS[p.pet.form] : ''}</span></div>
    <div class="yb-hud-who">${esc(p.name)}${side === 'me' ? ' · 나' : ''}</div>
    <div class="yb-hpbar"><i>HP</i><div class="yb-track"><div class="yb-fill" id="yb-hp-${side}"></div></div></div>
    <div class="yb-hud-foot"><div class="yb-ki" id="yb-ki-${side}"></div><div class="yb-fx" id="yb-fx-${side}"></div></div>
  </div>`;
}

function refreshHud() {
  for (const [side, p] of [['me', me()], ['op', foe()]]) {
    const pct = Math.max(0, p.hp) / MAX_HP * 100, fill = document.getElementById('yb-hp-' + side);
    if (fill) { fill.style.width = pct + '%'; fill.style.backgroundColor = pct > 50 ? '#2fbf71' : pct > 20 ? '#f2b233' : '#e5484d'; }
    const ki = document.getElementById('yb-ki-' + side);
    if (ki) ki.innerHTML = '<i>기</i>' + Array.from({ length: MAX_KI }, (_, i) => `<span class="${i < p.ki ? 'on' : ''}"></span>`).join('');
    const fx = document.getElementById('yb-fx-' + side);
    if (fx) fx.innerHTML = [p.shield && '<b class="shield">방패</b>', p.power && '<b class="power">필살 준비</b>', p.frozen_next && '<b class="freeze">다음 단어 얼음</b>', !p.connected && B.view.phase !== 'waiting' && '<b class="off">연결 끊김</b>'].filter(Boolean).join('');
    document.getElementById('yb-pet-' + side)?.classList.toggle('buff', !!p.power);
  }
  drawSkills();
}

function canUse(skill) {
  const v = B.view, m = me(), f = foe();
  if (!['question', 'reveal'].includes(v.phase) || m.ki < skill.cost) return false;
  if (skill.id === 'shield' && m.shield) return false;
  if (skill.id === 'power' && m.power) return false;
  if (skill.id === 'heal' && m.hp >= MAX_HP) return false;
  if (skill.id === 'freeze' && f.frozen_next) return false;
  return true;
}
function drawSkills() {
  const bar = document.getElementById('yb-skillbar'); if (!bar) return;
  bar.innerHTML = SKILLS.map(s => { const ok = canUse(s); return `<button type="button" class="yb-sk ${ok ? 'ready' : ''}" data-yb="skill" data-skill="${s.id}" ${ok ? '' : 'disabled'} aria-label="${s.name}, 기 ${s.cost}칸, ${s.desc}"><b>${s.name}</b><span class="yb-cost">${'<span></span>'.repeat(s.cost)}</span><small>${s.desc}</small></button>`; }).join('');
}

function drawQuestion() {
  const q = B.view.question; if (!q) return;
  document.getElementById('yb-q-n').textContent = `${q.n}번째 단어`;
  document.getElementById('yb-q-word').textContent = q.prompt;
  const frozen = (q.frozen_until?.[B.view.me] || 0) > serverNow();
  document.getElementById('yb-answers').innerHTML = q.options.map((o, i) => `<button type="button" class="yb-answer ${q.answer === i ? 'right' : ''} ${q.answer !== undefined && q.answer !== i ? 'dim' : ''}" data-yb="answer" data-choice="${i}" ${q.locked || q.answer !== undefined || frozen ? 'disabled' : ''}><span class="yb-tag"><b>${i + 1}</b>공격</span><span class="yb-ko">${esc(o)}</span></button>`).join('');
  document.getElementById('yb-answers').classList.toggle('frozen', frozen);
  document.getElementById('yb-pet-me')?.classList.toggle('frozen', frozen);
  if (frozen) {
    setStatus('me', '얼어붙었어요! 2초 뒤 풀려요');
    setTimeout(() => { if (B?.view?.question === q && q.answer === undefined) drawQuestion(); }, Math.max(0, q.frozen_until[B.view.me] - serverNow()) + 30);
  }
  if (q.answer === undefined && !q.locked) say(`<em>${esc(q.prompt)}</em>의 뜻은?`, '정답 버튼이 곧 공격 버튼이에요.');
}

function say(mainHtml, sub = '') {
  const a = document.getElementById('yb-msg-main'), b = document.getElementById('yb-msg-sub');
  if (a) a.innerHTML = mainHtml; if (b) b.textContent = sub;
}
function setStatus(side, text) { const el = document.getElementById('yb-status-' + side); if (el) el.textContent = text; }
function flash(color) { const f = document.getElementById('yb-flash'); if (!f) return; f.style.setProperty('--flash', color); f.classList.remove('on'); void f.offsetWidth; f.classList.add('on'); }
function pop(side, text, kind = '') {
  const arena = document.getElementById('yb-arena'), pet = document.getElementById('yb-pet-' + side); if (!arena || !pet) return;
  const a = arena.getBoundingClientRect(), r = pet.getBoundingClientRect(), d = document.createElement('div');
  d.className = 'yb-pop ' + kind; d.textContent = text;
  d.style.left = (r.left - a.left + r.width * .22) + 'px'; d.style.top = (r.top - a.top + r.height * .1) + 'px';
  arena.appendChild(d); setTimeout(() => d.remove(), 1050);
}
function hit(side) { const el = document.getElementById('yb-pet-' + side); if (!el) return; el.classList.remove('hit'); void el.offsetWidth; el.classList.add('hit'); }
function lunge(side) { if (reduced()) return; const el = document.getElementById('yb-pet-' + side); if (!el) return; el.classList.add('lunge'); setTimeout(() => el.classList.remove('lunge'), 240); }
const sideOf = pid => pid === B.view.me ? 'me' : 'op';

function showCountdown(deadline) {
  const box = document.getElementById('yb-countdown'); if (!box) return;
  box.hidden = false;
  const step = () => {
    const left = Math.ceil((deadline - serverNow()) / 1000);
    if (left <= 0 || B.view.phase !== 'countdown') { box.hidden = true; return; }
    box.textContent = left; setTimeout(step, 150);
  };
  step();
  say('곧 시작해요!', '같은 단어가 두 사람에게 동시에 나와요.');
}

// Clock and word timer, drawn from the room's deadlines.
function loop() {
  cancelAnimationFrame(B.raf);
  const frame = () => {
    if (!B?.view || B.view.phase === 'finished') return;
    const v = B.view, now = serverNow();
    const clock = document.getElementById('yb-clock');
    if (clock) { const left = v.ends_at ? Math.max(0, v.ends_at - now) : 90000; clock.textContent = `${Math.floor(left / 60000)}:${String(Math.floor(left / 1000) % 60).padStart(2, '0')}`; clock.parentElement.classList.toggle('warn', left <= 15000 && !!v.ends_at); }
    const bar = document.getElementById('yb-turnbar');
    if (bar) bar.style.transform = `scaleX(${v.phase === 'question' && v.deadline ? Math.max(0, Math.min(1, (v.deadline - now) / (v.deadline - v.question.started_at))) : 0})`;
    B.raf = requestAnimationFrame(frame);
  };
  B.raf = requestAnimationFrame(frame);
}

function applyEvent(e) {
  const v = B.view;
  if (e.seq && e.seq <= v.seq) return; // already in the view
  v.seq = e.seq || v.seq;
  const P = v.players;
  if (e.type === 'presence') { P[e.player].connected = e.connected; if (!e.connected && e.player !== v.me) setStatus('op', '상대 연결이 끊겼어요. 15초 기다려요'); refreshHud(); return; }
  if (e.type === 'countdown') { v.phase = 'countdown'; v.deadline = e.deadline; if (!document.getElementById('yb-arena')) drawMatch(); showCountdown(e.deadline); return; }
  if (e.type === 'start') { v.ends_at = e.ends_at; return; }
  if (e.type === 'question') {
    v.phase = 'question'; v.deadline = e.deadline;
    v.question = { n: e.n, prompt: e.prompt, options: e.options, started_at: e.started_at, frozen_until: e.frozen_until || {}, locked: false, answer: undefined };
    for (const id of Object.keys(e.frozen_until || {})) P[id].frozen_next = false;
    if (!document.getElementById('yb-arena')) return drawMatch();
    setStatus('me', ''); setStatus('op', '');
    document.getElementById('yb-pet-op')?.classList.remove('frozen');
    drawQuestion(); refreshHud(); return;
  }
  if (e.type === 'wrong') {
    P[e.player].ki = 0;
    if (e.player === v.me) {
      v.question.locked = true;
      document.querySelector('.yb-answer.picked')?.classList.add('wrong');
      document.querySelectorAll('.yb-answer').forEach(b => { b.disabled = true; });
      setStatus('me', '틀렸어요! 이번 단어는 공격 불가');
    } else setStatus('op', '상대가 틀렸어요!');
    refreshHud(); return;
  }
  if (e.type === 'attack' || e.type === 'miss') {
    v.phase = 'reveal'; v.question.answer = e.answer;
    if (e.type === 'miss') {
      for (const id of v.order) P[id].ki = 0;
      say(e.timeout ? '시간 초과!' : '둘 다 놓쳤어요!', `${v.question.prompt} = ${v.question.options[e.answer]}`);
    } else {
      const atk = sideOf(e.attacker), def = sideOf(e.defender);
      Object.assign(P[e.attacker], { hp: e.hp[e.attacker], ki: e.ki[e.attacker] });
      Object.assign(P[e.defender], { hp: e.hp[e.defender], ki: 0 });
      if (e.powered) P[e.attacker].power = false;
      if (e.shielded) P[e.defender].shield = false;
      setStatus(atk, `${(e.ms / 1000).toFixed(1)}초 정답!${atk === 'me' ? ` 기 +${e.fast ? 2 : 1}` : ''}`);
      const label = e.powered ? '<em>필살기!</em>' : e.fast ? '<em>크리티컬</em> 공격!' : '공격!';
      say(`${atk === 'op' ? '상대 ' : ''}${esc(petName(P[e.attacker].pet))}의 ${label}`, `${v.question.prompt} = ${v.question.options[e.answer]}${e.shielded ? ' · 방패가 피해를 절반 막았어요' : ''}`);
      lunge(atk);
      setTimeout(() => { if (e.powered || e.fast) flash(e.powered ? 'rgba(255,214,90,.9)' : 'rgba(255,236,160,.8)'); hit(def); pop(def, `-${e.dmg}${e.powered ? ' 필살!' : e.fast ? ' 크리티컬!' : ''}`, e.powered || e.fast ? 'crit' : ''); refreshHud(); }, reduced() ? 0 : 230);
    }
    drawQuestion(); refreshHud(); return;
  }
  if (e.type === 'skill') {
    const p = P[e.player], side = sideOf(e.player), other = side === 'me' ? 'op' : 'me', rule = SKILLS.find(s => s.id === e.skill);
    p.ki = e.ki; p.hp = e.hp;
    if (e.skill === 'shield') { p.shield = true; flash('rgba(120,200,240,.7)'); pop(side, '방패!', 'info'); }
    if (e.skill === 'power') { p.power = true; flash('rgba(255,214,90,.85)'); pop(side, '기 모으기!', 'crit'); }
    if (e.skill === 'heal') { flash('rgba(120,235,170,.7)'); pop(side, '+20', 'heal'); }
    if (e.skill === 'freeze') { P[v.order.find(id => id !== e.player)].frozen_next = true; flash('rgba(160,215,245,.8)'); pop(other, '얼음!', 'info'); }
    say(`${side === 'op' ? '상대 ' : ''}${esc(petName(p.pet))}의 <em>${rule?.name || ''}</em>!`, e.skill === 'freeze' ? '다음 단어에서 2초 동안 멈춰요.' : rule?.desc || '');
    refreshHud(); return;
  }
  if (e.type === 'end') {
    v.phase = 'finished'; v.result = e.result;
    const loser = e.result.loser ? sideOf(e.result.loser) : null;
    if (loser) document.getElementById('yb-pet-' + loser)?.classList.add('faint');
    cancelAnimationFrame(B.raf);
    setTimeout(drawResult, reduced() ? 0 : 1100);
  }
}

function drawResult() {
  const v = B.view, r = v.result || {}, m = me();
  const outcome = !r.winner ? 'draw' : r.winner === v.me ? 'win' : 'lose';
  const delta = outcome === 'win' ? `+${r.stake}P` : outcome === 'lose' ? `−${r.stake}P` : '±0P';
  closeSocket();
  main(`<section class="yb-card yb-result ${outcome}">
    <div class="yb-result-pet">${avatar(m.pet?.key, { form: Math.max(1, m.pet?.form || 1), expression: outcome === 'win' ? 'win' : outcome === 'lose' ? 'hurt' : 'normal' })}</div>
    <div class="yb-result-badge">${{ win: '승리!', lose: '패배', draw: r.reason === 'cancelled' ? '취소' : '무승부' }[outcome]}</div>
    <p class="yb-result-lead">${esc(REASONS[r.reason] || '')}${r.hp ? ` · 내 HP ${r.hp[v.me] ?? m.hp} · 상대 HP ${r.hp[foe().id] ?? foe().hp}` : ''}</p>
    <div class="yb-result-points ${outcome}">${delta}</div>
    <div class="btn-row yb-result-actions"><button type="button" class="btn" data-yb="exit">홈으로</button><button type="button" class="btn primary" data-yb="again">다시 대결</button></div>
  </section>`);
}

/* ---------- leaving ---------- */
function confirmLeave() {
  if (!B.view || B.view.phase === 'finished') return tryExit();
  const box = document.createElement('div');
  box.className = 'yb-confirm';
  box.innerHTML = `<div class="yb-confirm-card" role="dialog" aria-modal="true" aria-label="대결 포기"><h2>대결을 포기할까요?</h2><p>지금 나가면 <b>패배</b>로 처리되고 판돈 ${B.view.stake}P를 잃어요.</p><div class="btn-row"><button type="button" class="btn" data-confirm="no">계속할게요</button><button type="button" class="btn danger" data-confirm="yes">포기하기</button></div></div>`;
  box.onclick = e => {
    const c = e.target.closest('[data-confirm]')?.dataset.confirm; if (!c) return;
    box.remove();
    if (c === 'yes') send({ type: 'leave' });
  };
  document.querySelector('.battle-app')?.appendChild(box);
  box.querySelector('[data-confirm="no"]').focus();
}
function tryExit() {
  if (B?.view && !['finished', 'waiting'].includes(B.view.phase)) return confirmLeave();
  leaveScreen();
}
function leaveScreen() {
  const exit = B?.exit;
  closeSocket();
  root().onclick = null; root().oninput = null;
  B = null;
  exit?.();
}
