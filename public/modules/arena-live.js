// V13.230 펫 아레나 실시간 친구 대전 화면(구성안 docs/pet-arena-v2-plan.md 1장 · 6장). 펫 아레나 화면(arena.js) 안에서 열린다.
//   친구 대전 첫 화면: 방 만들기 · 방 코드 4자리로 들어가기 · 받은 초대 · 다시 보기(최근 5판).
//   대기실(방 객체 WebSocket): 자리 · 펫 3마리 고르기(스킬 ② 고르기 포함) · 준비 · 방장 시작 · 같은 학년 친구 초대 · 이모트.
//   판: arena.js의 전투 화면을 그대로 쓰고, 전투만 롤백 전투(arena-live-rules.js createLiveSim)로 바꾼다.
//     내 조작은 바로 보이고, 0.1초마다 묶어 방에 보낸다. 방이 보낸 확정 조작으로 친구 펫을 맞추고(늦게 온 것은 되감기), 1초마다 상태를 비교한다.
//     손님은 경기장을 180° 돌려 본다(내 펫이 늘 아래).
//   렉 방지: 자동 새로고침 없음(초대 알림은 첫 화면이 이미 20초마다 묻는 /battle/invite에 실린다). 보기 요청은 GET.
//   다시 보기: 씨앗 + 두 쪽 조작을 이 폰(localStorage)에 최근 5판만. 서버 저장 0.
import { api, esc, num, toast, buttonBusy } from './ui.js';
import { CHARACTERS } from './core.js';
import { ARENA, fighter, skill2Picks } from './arena-rules.js';
import { LIVE, LIVE_EMOTES, cleanCode, createLiveSim, createReplaySim, cleanReplays, liveFighters, otherSide } from './arena-live-rules.js';
import { arenaMatch, arenaUi } from './arena.js';
import { ARENA_ART } from './arena-art.js';

// 그림 66(PR #287: 대기실 배경 lobby-bg · 팀 깃발 team-blue/red)이 들어오면 그림, 없으면 CSS(v13230.css).
const artOn = name => ARENA_ART.has(name);
const lobbyArt = () => artOn('lobby-bg') ? ' art" style="--lv-bg:url(/assets/arena/lobby-bg.webp)' : '';
const flag = i => { const n = i === 0 ? 'team-blue' : 'team-red'; return artOn(n) ? ` flag" style="--flag:url(/assets/arena/${n}.webp)` : ''; };

let L = null;
const $ = id => document.getElementById(id);
const petName = key => CHARACTERS[key]?.ko || key;
const REPLAY_KEY = A => `sumus-arena-replays:${A?.data?.profile?.id || ''}`;
const loadJson = (k, d) => { try { return JSON.parse(localStorage.getItem(k) || 'null') ?? d; } catch { return d; } };
const saveJson = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
const WHY = {
  pair: `오늘 이 친구와 코인 판(${LIVE.PAIR_DAILY}판)을 다 했어요. 기록은 남아요!`,
  idle: '거의 조작하지 않은 판이라 둘 다 보상이 없어요.',
  ai: '컴퓨터가 대신 싸운 시간이 길어서 보상이 없어요.',
  grade: '같은 학년 친구와의 판만 보상이 있어요.',
  daily: `오늘 코인 판(${ARENA.DAILY}판)을 다 썼어요. 기록은 남아요!`,
  ticket: '입장권이 없어서 연습 판이었어요. 단어 연습을 끝까지 풀면 입장권을 받아요!',
  wait: '결과를 아직 못 받았어요. 잠시 뒤 펫 아레나에서 코인을 확인해 주세요.'
};

/* ---------- 다시 보기 기록(이 폰에만) ---------- */
export function keepReplay(A, rec) {
  const list = cleanReplays(loadJson(REPLAY_KEY(A), []));
  list.push({ ...rec, at: Date.now() });
  saveJson(REPLAY_KEY(A), list.slice(-LIVE.REPLAYS));
}
const replays = A => cleanReplays(loadJson(REPLAY_KEY(A), []));

/* ---------- 친구 대전 첫 화면 ---------- */
export async function openLive(A, opts = {}) {
  closeLive();
  L = { A, timers: [], picks: {}, keys: null, skip: opts.skip || null };
  arenaUi.main('<div class="ar-saving">친구 대전 불러오는 중…</div>');
  if (opts.join) return join({ id: opts.join });
  await home();
}
export function closeLive() {
  if (!L) return;
  L.closing = true;
  L.timers.forEach(t => clearInterval(t));
  try { L.ws?.close(1000, 'bye'); } catch {}
  L = null;
}
async function home() {
  let d;
  try { d = await api('/games/arena/live'); } catch (err) { if (!L) return; return arenaUi.main(`<div class="ar-saving">${esc(err.message || '불러오지 못했어요.')}<button type="button" class="btn" data-ar="lv-back">돌아가기</button></div>`); }
  if (!L) return;
  L.home = d;
  if (d.room && d.room.id !== L.skip) return enter(d.room);
  const list = replays(L.A).slice().reverse();
  arenaUi.main(`<section class="ar-live${lobbyArt()}">
    <div class="ar-title"><small>같은 학년 친구와 1 대 1</small><h1>친구 대전</h1></div>
    ${d.invite ? `<div class="ar-card ar-lv-invite"><b>📨 ${esc(d.invite.host)}의 초대</b><small>방 ${esc(d.invite.code)} · 5분 안에 들어가요</small><div class="ar-lv-row"><button type="button" class="btn" data-ar="lv-decline" data-id="${esc(d.invite.id)}">거절</button><button type="button" class="yl-cta" data-ar="lv-accept" data-id="${esc(d.invite.id)}">들어가기</button></div></div>` : ''}
    <div class="ar-card">
      <button type="button" class="yl-cta ar-go" data-ar="lv-open">방 만들기</button>
      <div class="ar-lv-code"><label for="lv-code">방 코드</label><input id="lv-code" inputmode="numeric" pattern="[0-9]*" maxlength="4" autocomplete="off" placeholder="0000"><button type="button" class="btn primary" data-ar="lv-code">들어가기</button></div>
      <p class="ar-words">같은 학교 · 같은 학년 친구끼리만 대전할 수 있어요(반은 달라도 돼요). 보상은 혼자 판과 같고 하루 ${ARENA.DAILY}판에 같이 세요. 같은 친구와 코인 판은 하루 ${LIVE.PAIR_DAILY}판까지.</p>
    </div>
    ${list.length ? `<div class="ar-card"><h3 class="ar-sub">다시 보기 <small>이 폰에 최근 ${LIVE.REPLAYS}판</small></h3><div class="ar-lv-replays">${list.map((r, i) => `<button type="button" class="ar-lv-rp" data-ar="lv-replay" data-i="${list.length - 1 - i}"><b>${r.solo ? '혼자 판' : '친구 대전'} · ${esc(r.names?.[otherSide(r.side || 'me')] || '상대')}</b><small>${new Date(r.at).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: 'numeric', minute: '2-digit' })} · ${r.result === 'win' ? '승리' : r.result === 'draw' ? '무승부' : '패배'}</small></button>`).join('')}</div></div>` : ''}
    <button type="button" class="btn full" data-ar="lv-back">혼자 판으로</button>
  </section>`);
}

/* ---------- 버튼 ---------- */
export function liveClick(act, b) {
  if (!L) return false;
  if (act === 'lv-back') { closeLive(); arenaUi.lobby(); return true; }
  if (act === 'lv-open') { open(b); return true; }
  if (act === 'lv-code') { const code = cleanCode($('lv-code')?.value); if (!code) { toast('방 코드 4자리를 넣어 주세요.'); return true; } join({ code }, b); return true; }
  if (act === 'lv-accept') { join({ id: b.dataset.id }, b); return true; }
  if (act === 'lv-decline') { api('/games/arena/live/decline', { id: b.dataset.id }).catch(() => {}).then(() => L && home()); return true; }
  if (act === 'lv-invite') { invite(b); return true; }
  if (act === 'lv-pet') { togglePet(b.dataset.key); return true; }
  if (act === 'lv-pick2') { L.picks[b.dataset.key] = Number(b.dataset.i) === 1 ? 1 : 0; sendTeam(); return true; }
  if (act === 'lv-ready') { send({ type: 'ready', on: b.dataset.on === '1' }); arenaUi.sfx('tap'); return true; }
  if (act === 'lv-start') { send({ type: 'start' }); buttonBusy(b); setTimeout(() => buttonBusy(b, false), 1500); return true; }
  if (act === 'lv-leave') { send({ type: 'leave' }); closeLive(); arenaUi.lobby(); return true; }
  if (act === 'lv-emo') { emote(b.dataset.k); return true; }
  if (act === 'lv-replay') { replay(Number(b.dataset.i)); return true; }
  if (act === 'lv-home') { const A = L.A, skip = L.room?.id; closeLive(); openLive(A, { skip }); return true; }
  return false;
}
async function open(b) {
  buttonBusy(b);
  try { const d = await api('/games/arena/live/open', {}); if (L) enter(d.room); }
  catch (err) { if (L) { buttonBusy(b, false); toast(err.message || '방을 만들지 못했어요.'); } }
}
async function join(body, b) {
  if (b) buttonBusy(b);
  try { const d = await api('/games/arena/live/join', body); if (L) enter(d.room); }
  catch (err) { if (!L) return; if (b) buttonBusy(b, false); toast(err.message || '들어가지 못했어요.'); if (!L.home) home(); }
}
async function invite(b) {
  buttonBusy(b);
  try { const d = await api('/games/arena/live/invite', { friend_id: b.dataset.id }); toast(d.already ? '이미 들어와 있어요.' : `${d.friend || '친구'}에게 초대를 보냈어요! 친구 첫 화면에 떠요.`); b.textContent = '보냄'; }
  catch (err) { buttonBusy(b, false); toast(err.message || '초대하지 못했어요.'); }
}

/* ---------- 방 연결 ---------- */
function enter(room) {
  L.room = room;
  connect();
  // 시계 맞추기 · 살아 있음 알리기: 대기실 5초, 판 도중 1초(끊김 3초면 방이 컴퓨터로 바꾼다).
  L.timers.push(setInterval(() => { if (!L?.match || L.match.done) ping(); }, 5000));
}
function connect() {
  const room = L.room, ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/api/arena/ws/${room.id}?ticket=${encodeURIComponent(room.ticket)}`);
  L.ws = ws;
  ws.onopen = () => { if (L?.ws !== ws) return; L.retries = 0; ping(); };
  ws.onmessage = event => { if (L?.ws !== ws) return; let msg; try { msg = JSON.parse(event.data); } catch { return; } onMessage(msg); };
  ws.onclose = event => {
    if (!L || L.ws !== ws || L.closing) return;
    if (event.code === 4000) { L.closing = true; return arenaUi.main('<div class="ar-saving">다른 화면에서 이 방을 열었어요.<button type="button" class="btn" data-ar="lv-back">돌아가기</button></div>'); }
    if (event.code === 1000 && !L.match) return;
    L.retries = (L.retries || 0) + 1;
    if (L.retries > 12) { toast('연결이 끊겼어요.'); return; }
    setTimeout(() => { if (L && !L.closing) connect(); }, Math.min(3000, 300 * L.retries));
  };
}
const send = msg => { try { if (L?.ws?.readyState === 1) { L.ws.send(JSON.stringify(msg)); L.sent = (L.sent || 0) + 1; } } catch {} };
function ping() { L.pingAt = performance.now(); send({ type: 'ping', t: Math.round(L.pingAt) }); }
// 서버 시계 = 이 폰 시계 + offset. 왕복이 가장 짧았던 측정을 쓴다.
const serverNow = () => Date.now() + (L?.offset || 0);
function clockFrom(msg) {
  if (!Number.isFinite(msg.now)) return;
  const rtt = msg.type === 'pong' && msg.t ? performance.now() - msg.t : null;
  if (rtt != null) { L.rtt = rtt; netBar(rtt); }
  const est = msg.now + (rtt || 0) / 2 - Date.now();
  if (L.offset == null || (rtt != null && rtt <= (L.bestRtt ?? Infinity))) { L.offset = est; if (rtt != null) L.bestRtt = rtt; }
}
function netBar(rtt) {
  const el = $('ar-net'); if (!el) return;
  const cls = rtt < 150 ? 'good' : rtt < 400 ? 'ok' : 'bad';
  if (el._c !== cls) { el._c = cls; el.className = `ar-net ${cls}`; }
  el.title = `${Math.round(rtt)}ms`;
}

function onMessage(msg) {
  clockFrom(msg);
  const m = L.match;
  if (msg.type === 'pong') return;
  if (msg.type === 'lobby') { L.view = msg; if (!L.keys && msg.you) { const me = msg.players.find(p => p.id === msg.you); L.keys = (me?.team || []).map(f => f.key); for (const f of me?.team || []) L.picks[f.key] = f.s2; } return lobbyView(); }
  if (msg.type === 'closed') { if (m && !m.done) return; L.closing = true; return arenaUi.main(`<div class="ar-saving">${esc(msg.why || '방이 닫혔어요.')}<button type="button" class="btn" data-ar="lv-home">친구 대전으로</button></div>`); }
  if (msg.type === 'error') return toast(msg.error);
  if (msg.type === 'start') {
    if (m) return;
    if (msg.over) { L.closing = true; try { L.ws.close(1000, 'over'); } catch {} return arenaUi.main('<div class="ar-saving">이미 끝난 판이에요.<button type="button" class="btn" data-ar="lv-home">친구 대전으로</button></div>'); }
    return begin(msg);
  }
  if (!m) return;
  if (msg.type === 'b') return m.sim.onBatch(msg);
  if (msg.type === 'all') return m.sim.rebuild(msg.inputs, msg.c);
  if (msg.type === 'ai') {
    const mine = msg.side === m.side;
    if (msg.on) arenaUi.pop(mine ? '연결이 끊겨 컴퓨터가 대신 싸우는 중' : '친구 연결이 끊겨 컴퓨터가 대신 조종해요', 50, 30, 'hint');
    else if (!mine) arenaUi.pop('친구가 돌아왔어요!', 50, 30, 'hint');
    return;
  }
  if (msg.type === 'emo') return showEmote(msg.side === m.side ? 'me' : 'foe', msg.k);
  if (msg.type === 'over') { m.over = msg; m.sim.end({ winner: msg.winner, ticks: msg.ticks, all: msg.all }); return; }
  if (msg.type === 'reported') { m.reported = true; return; }
}

/* ---------- 대기실 ---------- */
function myPets() { return (L.view?.pets || []).map(p => ({ ...p, s2: L.picks[p.key] ?? p.s2 })); }
function togglePet(key) {
  const keys = (L.keys || []).slice(), i = keys.indexOf(key);
  if (i >= 0) { if (keys.length > 1) keys.splice(i, 1); }
  else if (keys.length < LIVE.MODES['1v1'].team) keys.push(key);
  else { keys.shift(); keys.push(key); }
  L.keys = keys;
  sendTeam();
}
function sendTeam() {
  const s2 = Object.fromEntries((L.keys || []).filter(k => L.picks[k] != null).map(k => [k, L.picks[k]]));
  send({ type: 'team', keys: L.keys, s2 });
  arenaUi.sfx('tap');
}
const petImg = (key, form) => arenaUi.petImg(key, form);
function lobbyView() {
  const v = L.view, me = v.players.find(p => p.id === v.you), host = me?.host, n = v.seats;
  const left = Math.max(0, Math.ceil((v.closes_at - serverNow()) / 1000));
  const seat = i => {
    const p = v.players[i];
    if (!p) return `<div class="ar-lv-seat empty"><b>${i === 0 ? '방장' : '빈자리'}</b><small>친구를 기다려요…</small></div>`;
    return `<div class="ar-lv-seat ${p.id === v.you ? 'mine' : ''} ${p.ready || p.host ? 'ready' : ''}${flag(i)}"><b>${esc(p.name)}${p.host ? ' 👑' : ''}</b><span class="ar-lv-team">${p.team.map(f => `<i>${petImg(f.key, f.form)}<small>Lv.${f.level}</small></i>`).join('')}</span><small>${p.host ? '방장' : p.ready ? '준비 완료!' : '고르는 중'}${p.online ? '' : ' · 연결 끊김'}</small></div>`;
  };
  const pets = myPets(), mine = L.keys || [];
  const locked = !!me?.ready && !host;
  const all = v.players.length >= n && v.players.every(p => p.host || p.ready);
  const friends = host ? (L.home?.friends || []) : [];
  const keep = L.drawn ? ' keep' : '';
  L.drawn = true;
  arenaUi.main(`<section class="ar-live ar-lv-lobby${keep}${lobbyArt()}">
    <div class="ar-title"><small>친구 대전 대기실 · ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')} 뒤 닫혀요</small><h1>방 <b class="ar-lv-codebig">${esc(v.code)}</b></h1></div>
    <div class="ar-lv-seats">${Array.from({ length: n }, (_, i) => seat(i)).join('<span class="ar-lv-vs">VS</span>')}</div>
    <div class="ar-card">
      <h3 class="ar-sub">내 팀 <small>3마리 · 순서대로 나가요 · 펫마다 스킬 ②를 골라요</small></h3>
      <div class="ar-pets">${pets.map(p => `<button type="button" class="ar-pet-pick${mine.includes(p.key) ? ' on' : ''}" data-ar="lv-pet" data-key="${esc(p.key)}" ${locked ? 'disabled' : ''} aria-pressed="${mine.includes(p.key)}">${petImg(p.key, p.form)}<small>Lv.${p.level}</small>${mine.includes(p.key) ? `<b>${mine.indexOf(p.key) + 1}</b>` : ''}</button>`).join('')}</div>
      <div class="ar-lv-picks">${mine.map(k => pets.find(p => p.key === k)).filter(Boolean).map(p => `<div class="ar-lv-pick"><b>${esc(petName(p.key))}</b>${skill2Picks(p.key).map((k2, i) => `<button type="button" class="ar-pick2${(p.s2 === 1 ? 1 : 0) === i ? ' on' : ''}" data-ar="lv-pick2" data-key="${esc(p.key)}" data-i="${i}" ${locked ? 'disabled' : ''}><i>${k2.icon}</i><b>${esc(k2.name)}</b></button>`).join('')}</div>`).join('')}</div>
      ${host ? `<button type="button" class="yl-cta ar-go" data-ar="lv-start" ${all ? '' : 'disabled'}>${all ? '대전 시작!' : v.players.length < n ? '친구를 기다려요' : '친구가 준비하면 시작'}</button>`
        : `<button type="button" class="yl-cta ar-go" data-ar="lv-ready" data-on="${me?.ready ? 0 : 1}">${me?.ready ? '준비 취소' : '준비!'}</button>`}
      <div class="ar-emotes ar-lv-emo">${Object.entries(LIVE_EMOTES).map(([k, t]) => `<button type="button" class="yb-emote" data-ar="lv-emo" data-k="${k}">${esc(t)}</button>`).join('')}</div>
    </div>
    ${host ? `<div class="ar-card"><h3 class="ar-sub">초대하기 <small>같은 학년 친구 · 방 코드 <b>${esc(v.code)}</b>를 알려 줘도 돼요</small></h3>
      ${friends.length ? `<ul class="ar-lv-friends">${friends.map(f => `<li><span><b>${esc(f.name)}</b><small>${esc(f.class_name)}${f.pair_left ? '' : ' · 오늘 코인 판 끝'}</small></span><button type="button" class="btn" data-ar="lv-invite" data-id="${esc(f.id)}">초대</button></li>`).join('')}</ul>` : '<p class="ar-why">같은 학년 친구가 아직 없어요. 방 코드를 알려 주세요!</p>'}</div>` : ''}
    <button type="button" class="btn full" data-ar="lv-leave">${host ? '방 닫고 나가기' : '나가기'}</button>
  </section>`);
  // 남은 시간은 바뀔 때만(1초에 한 번 글자만).
  clearInterval(L.lobbyClock);
  L.lobbyClock = setInterval(() => { if (!L || L.match) return clearInterval(L?.lobbyClock); const s = Math.max(0, Math.ceil((L.view.closes_at - serverNow()) / 1000)), el = document.querySelector('.ar-lv-lobby .ar-title small'); if (el) el.textContent = `친구 대전 대기실 · ${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')} 뒤 닫혀요`; }, 1000);
  L.timers.push(L.lobbyClock);
}
function emote(k) {
  const now = performance.now();
  if (now - (L.emoAt || -1e9) < LIVE.EMOTE_GAP_MS || (L.emoN || 0) >= LIVE.EMOTE_MAX) return toast('이모트는 3초에 한 번이에요.');
  L.emoAt = now; L.emoN = (L.emoN || 0) + 1;
  send({ type: 'emo', k });
}
function showEmote(who, k) {
  const text = LIVE_EMOTES[k]; if (!text) return;
  const cur = arenaUi.cur();
  if (cur) { arenaUi.pop(text, cur[who].x, cur[who].y - 28, `emote ${who}`); arenaUi.sfx('tap', { rate: who === 'me' ? 1.2 : 0.9 }); }
  else toast(`${who === 'me' ? '나' : '친구'}: ${text}`);
}

/* ---------- 판 ---------- */
const brief = list => list.map(f => { const x = fighter({ key: f.key, form: f.form, level: f.level, s2: f.s2 }); return { key: f.key, form: f.form, level: f.level, s2: f.s2, el: x.el }; });
function begin(msg) {
  const side = msg.side, foe = otherSide(side);
  if (!side) return;
  clearInterval(L.lobbyClock);
  const teams = { me: liveFighters(msg.teams.me), foe: liveFighters(msg.teams.foe) };
  const sim = createLiveSim({ seed: msg.seed, teams, side, send: l => send({ type: 'in', l }), onDesync: () => send({ type: 'sync' }) });
  const m = L.match = { side, sim, msg, start_at: msg.start_at };
  // 0.1초마다 조작 묶음 보내기 · 1초마다 시계 · 살아 있음.
  L.timers.push(setInterval(() => { if (L?.match === m && !m.done) sim.flush(); }, LIVE.BATCH_MS));
  L.timers.push(setInterval(() => { if (L?.match === m && !m.done) ping(); }, 1000));
  const r = { id: L.room.id, seed: msg.seed, live: true, me: brief(msg.teams[side]), foe: { name: msg.names[foe] || '친구', bot: false, team: brief(msg.teams[foe]) }, foe_level: 1 };
  arenaMatch(r, {
    sim, live: true,
    // 지금 틱 = (서버 시계 − 시작 시각) ÷ 50ms. 히트스톱으로 화면이 잠깐 멈춰도 다음 프레임에 따라잡는다.
    want: () => (serverNow() - m.start_at) / ARENA.TICK_MS,
    late: serverNow() > m.start_at,
    mounted: () => {
      const play = $('ar-play'); if (!play || $('ar-net')) return;
      play.insertAdjacentHTML('beforeend', `<span class="ar-net" id="ar-net" aria-label="연결 상태"><i></i><i></i><i></i></span><div class="ar-emotes ar-play-emo">${Object.entries(LIVE_EMOTES).map(([k, t]) => `<button type="button" class="yb-emote" data-ar="lv-emo" data-k="${k}">${esc(t)}</button>`).join('')}</div>`);
      if (L.rtt != null) netBar(L.rtt);
    },
    finish: () => finish(m),
    why: res => WHY[res?.reason] || '',
    buttons: () => `<button type="button" class="yl-cta" data-ar="lv-replay" data-i="-1">다시 보기</button><button type="button" class="btn full" data-ar="lv-home">친구 대전으로</button><button type="button" class="btn full" data-ar="exit">놀이터로</button>`,
    quitText: '나가면 컴퓨터가 대신 싸우고, 보상은 없을 수 있어요.',
    quit: () => { send({ type: 'leave' }); closeLive(); }
  });
}
// 끝: 방 판정이 온 뒤(늘 방이 정한다) 다시 보기를 남기고 메인의 결과(영수증)를 GET으로 읽는다(보고가 늦으면 몇 번만 다시).
async function finish(m) {
  m.done = true;
  const o = m.over, A = L.A;
  keepReplay(A, { side: m.side, seed: m.msg.seed, teams: m.msg.teams, names: m.msg.names, inputs: o.all, result: o.winner === 'draw' ? 'draw' : o.winner === m.side ? 'win' : 'lose' });
  for (let i = 0; i < 6; i++) {
    if (!L || L.match !== m) return { paid: false, reason: 'wait' };
    if (i > 0 || !m.reported) await new Promise(res => setTimeout(res, i === 0 ? 600 : 1200));
    try {
      const d = await api(`/games/arena/live/result?id=${encodeURIComponent(L.room.id)}`);
      if (d.result) { if (typeof d.points_balance === 'number') A.data.stats.points_balance = d.points_balance; return { ...d.result, left: d.left, tickets: d.tickets, wins: d.wins }; }
    } catch {}
  }
  const s = o.sides?.[m.side] || {};
  return { winner: o.winner === 'draw' ? 'draw' : o.winner === m.side ? 'me' : 'foe', ko: s.ko, dealt: s.dealt, ults: s.ults, paid: false, reason: 'wait' };
}

/* ---------- 다시 보기 ---------- */
function replay(i) {
  const list = replays(L.A), rec = i < 0 ? list.at(-1) : list[i];
  if (!rec) return toast('다시 볼 판이 없어요.');
  const side = rec.side || 'me', foe = otherSide(side);
  const teams = { me: liveFighters(rec.teams.me), foe: liveFighters(rec.teams.foe) };
  const sim = createReplaySim({ seed: rec.seed, teams, inputs: rec.inputs, side, foeLevel: rec.foeLevel ?? 1, solo: !!rec.solo });
  let t0 = 0;
  const r = { id: 'replay', seed: rec.seed, live: true, replay: true, me: brief(rec.teams[side]), foe: { name: `${rec.names?.[foe] || '상대'} · 다시 보기`, bot: !!rec.solo, team: brief(rec.teams[foe]) }, foe_level: rec.foeLevel ?? 1 };
  if (L.match) L.match.done = true;
  L.match = null;
  arenaMatch(r, {
    sim, live: true, replay: true,
    want: now => { t0 ||= now; return (now - t0) / ARENA.TICK_MS; },
    mounted: () => { $('ar-app')?.classList.add('ar-replay'); },
    finish: async () => { $('ar-app')?.classList.remove('ar-replay'); return { winner: sim.S.winner, ko: sim.S.ko.me, dealt: sim.S.dealt.me, ults: sim.S.ults.me, paid: false, reason: 'replay' }; },
    why: () => '다시 보기가 끝났어요.',
    buttons: () => `<button type="button" class="yl-cta" data-ar="lv-replay" data-i="${i}">한 번 더 보기</button><button type="button" class="btn full" data-ar="lv-home">친구 대전으로</button>`,
    quit: () => { $('ar-app')?.classList.remove('ar-replay'); }
  });
}
