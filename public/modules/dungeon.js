import { api, esc, icon, toast, num, rangeLabel, buttonBusy, modal } from './ui.js';
import { avatar } from './character.js';
import { getRanges } from './student.js';
import { ELEMENTS, fxShot, fxImpact, fxPunch, fxEdge, fxHeal, fxPowerUp, fxRank, fxShield, comboRank } from './battle-fx.js';

// V13.128 던전 화면 (docs/dungeon-design.md 2 · 3번): 던전 입구(등급컷 · 범위 · 방 만들기 · 초대 코드 · 받은 초대),
// 로비(파티 3자리, 친구 부르기, 봇 동료, 준비), 입장 연출, 층 전투, 휴식, 결과.
// 판은 던전 방(cloudflare/dungeon-room.mjs)이 돌리고, 이 화면은 방이 보낸 view와 이벤트를 그리고 선택 번호만 보낸다.
// 그림은 아직 던전용 포즈 · 배경 · UI를 연결하지 않았다(5번 세션). 몬스터는 /assets/monsters/의 기본 그림을 쓴다.
// 전투 효과는 battle-fx.js, 움직임 줄이기를 켠 폰에서는 효과를 그리지 않는다. A.screen === 'dungeon'일 때 #app을 쓴다.

const EMOTES = { cheer: '힘내!', help: '도와줘!', nice: '나이스!', gg: '수고했어!' };
const CUT_DESC = { c3: '처음 도전', c2: '3등급 컷을 깨면 열려요', c1: '2등급 컷을 깨면 열려요', max: '세 단계를 모두 깨면 열려요 · 끝없는 층' };
// 몬스터 크기(S · M · L)는 화면 폭에 대한 배율. 보스는 정사각 430px 안팎(몸이 화면 폭의 약 70%).
const SIZE_W = { S: 52, M: 60, L: 68 };
const FLOOR_BG = ['#3a2d5c', '#2c3d5e', '#25504f', '#4a3a2a', '#5a2b33', '#3b1020'];

let D = null;
const root = () => document.getElementById('app');
const serverNow = () => Date.now() + (D?.offset || 0);
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const clock = ms => `${Math.floor(Math.max(0, ms) / 60000)}:${String(Math.floor(Math.max(0, ms) / 1000) % 60).padStart(2, '0')}`;
function later(fn, ms) { const cur = D; const id = setTimeout(() => { if (D === cur && !cur.closing) fn(); }, ms); cur.timers.push(id); }

/* ---------- 열고 닫기 ---------- */
export async function openDungeon(A, exit) {
  closeAll();
  D = { A, exit, timers: [], cut: 'c3', offset: 0, ranges: null, code: '' };
  A.screen = 'dungeon';
  root().innerHTML = `<div class="session-app dg-app"><header class="dg-top"><button type="button" class="yb-back" data-dg="exit" aria-label="나가기">${icon('back')}</button><strong>던전</strong><span class="dg-top-note" id="dg-note"></span></header><main id="dg-main" class="dg-main"><div class="yb-loading">던전 문을 여는 중…</div></main></div>`;
  root().onclick = onClick;
  root().oninput = event => { if (event.target.id === 'dg-code') D.code = event.target.value.replace(/\D/g, '').slice(0, 6); };
  window.scrollTo(0, 0);
  await loadHome();
}
async function loadHome() {
  try {
    D.home = await api('/dungeon/home');
    if (!D) return;
    if (D.home.room?.ticket) return enterRoom(D.home.room);
    const open = D.home.cuts.filter(c => c.open);
    if (!open.some(c => c.key === D.cut)) D.cut = open.at(-1)?.key || 'c3';
    homeScreen();
  } catch (err) {
    main(`<div class="yb-loading"><p>던전을 불러오지 못했어요.<br><small>${esc(err.message)}</small></p><button type="button" class="btn primary" data-dg="retry">다시 시도</button></div>`);
  }
}
function closeAll() {
  if (!D) return;
  D.closing = true;
  (D.timers || []).forEach(clearTimeout);
  cancelAnimationFrame(D.raf);
  clearInterval(D.pinger);
  try { D.ws?.close(); } catch {}
  D.ws = null;
}
async function leaveScreen() {
  const exit = D?.exit;
  closeAll();
  root().onclick = null; root().oninput = null;
  D = null;
  await exit?.();
}
const main = html => { const m = document.getElementById('dg-main'); if (m) m.innerHTML = html; };
const note = text => { const n = document.getElementById('dg-note'); if (n) n.textContent = text; };

function onClick(event) {
  const b = event.target.closest('[data-dg]');
  if (!b || b.disabled || !D) return;
  const act = b.dataset.dg;
  if (act === 'exit') return tryExit();
  if (act === 'retry') return loadHome();
  if (act === 'cut') { D.cut = b.dataset.cut; return homeScreen(); }
  if (act === 'range') { D.ranges.has(b.dataset.code) ? D.ranges.delete(b.dataset.code) : D.ranges.add(b.dataset.code); saveRanges(); return homeScreen(); }
  if (act === 'create') return createRoom(b);
  if (act === 'join') return joinByCode(b, D.code);
  if (act === 'accept') return joinByCode(b, b.dataset.code);
  if (act === 'decline') return declineInvite(b);
  if (act === 'ready') return send({ type: 'ready', on: b.dataset.on !== '0' });
  if (act === 'friends') return pickFriend();
  if (act === 'bot') return addBot(b);
  if (act === 'copy') return copyCode();
  if (act === 'answer') return pick(Number(b.dataset.choice), b);
  if (act === 'emote') return emote(b.dataset.emote, b);
  if (act === 'again') { closeAll(); const { A, exit } = D; return openDungeon(A, exit); }
  if (act === 'home') return leaveScreen();
  if (act === 'leave-room') { buttonBusy(b); return api('/dungeon/leave', {}).catch(() => {}).then(() => { closeAll(); const { A, exit } = D; return openDungeon(A, exit); }); }
}

/* ---------- 던전 입구 ---------- */
// 범위는 야차전처럼 폰에 기억한다. 처음에는 학습 화면에서 고른 범위.
const rangesKey = () => `sumus-dungeon-ranges:${D.A.data.profile.id}`;
function myRanges() {
  const A = D.A, { words, codes, selected } = getRanges(A, A.school, A.data.profile.class_name);
  const counts = new Map(); for (const w of words) counts.set(String(w.range_code), (counts.get(String(w.range_code)) || 0) + 1);
  if (!D.ranges) {
    let saved = []; try { saved = JSON.parse(localStorage.getItem(rangesKey()) || '[]'); } catch {}
    const known = list => (Array.isArray(list) ? list : []).map(String).filter(code => counts.has(code));
    D.ranges = new Set(known(saved).length ? known(saved) : known(selected).length ? known(selected) : codes.map(String).slice(0, 1));
  }
  return { codes: codes.map(String), counts };
}
function saveRanges() { try { localStorage.setItem(rangesKey(), JSON.stringify([...D.ranges])); } catch {} }
function homeScreen() {
  const A = D.A, h = D.home, { codes, counts } = myRanges();
  const picked = [...D.ranges].reduce((n, c) => n + (counts.get(c) || 0), 0);
  note('');
  main(`
    <section class="dg-hero">
      <div class="dg-hero-glow" aria-hidden="true"></div>
      <img class="dg-hero-boss" src="/assets/monsters/killergolem.webp" alt="" width="512" height="512" decoding="async" draggable="false">
      <div class="dg-hero-copy"><span class="dg-kicker">2~3명 실시간 파티</span><h1>기말고사 지옥</h1><p>1층부터 보스 <b>킬러 골렘</b>까지 쉬지 않고 올라가요. 같은 학년이면 학교가 달라도 함께해요.</p></div>
    </section>
    ${h.invites?.length ? `<section class="dg-card dg-invites"><h2>받은 초대</h2>${h.invites.map(r => `<div class="dg-invite"><div><b>${esc(r.host)}</b><span>${esc(r.host_school)} · ${esc(r.cut_name)} · ${r.members}/${r.max}명</span></div><button type="button" class="btn primary" data-dg="accept" data-code="${esc(r.code)}">같이 가기</button><button type="button" class="btn ghost" data-dg="decline" data-id="${esc(r.id)}">거절</button></div>`).join('')}</section>` : ''}
    <section class="dg-card">
      <h2>등급컷</h2>
      <div class="dg-cuts" role="group" aria-label="등급컷 고르기">${h.cuts.map(c => `<button type="button" class="dg-cut ${c.key}${D.cut === c.key ? ' on' : ''}" data-dg="cut" data-cut="${c.key}" ${c.open ? '' : 'disabled'} aria-pressed="${D.cut === c.key}"><b>${esc(c.name)}</b><small>${c.cleared ? '✓ 클리어' : c.open ? '도전 가능' : '🔒 잠김'}</small></button>`).join('')}</div>
      <p class="dg-hint">${esc(CUT_DESC[D.cut] || '')}. 앞 단계를 깨야 다음 단계가 열리고, 방은 파티원 모두에게 열린 단계까지만 고를 수 있어요.</p>
    </section>
    <section class="dg-card">
      <h2>내 단어 범위 <small>${num(picked)}단어</small></h2>
      <div class="dg-ranges">${codes.map(code => `<button type="button" class="dg-range${D.ranges.has(code) ? ' on' : ''}" data-dg="range" data-code="${esc(code)}" aria-pressed="${D.ranges.has(code)}">${esc(rangeLabel(A.school, code))}<small>${num(counts.get(code) || 0)}</small></button>`).join('')}</div>
      <p class="dg-hint">던전은 문제 ${num(h.pool_min)}단어 이상이 필요해요. 모자라면 앞쪽 범위 → 남은 단어 → 틀린 단어로 채워요(내가 고른 범위는 그대로예요).</p>
    </section>
    <section class="dg-card dg-actions">
      <button type="button" class="btn primary full dg-go" data-dg="create" ${D.ranges.size ? '' : 'disabled'}>${icon('plus')} 방 만들기</button>
      <div class="dg-join"><input id="dg-code" inputmode="numeric" maxlength="6" placeholder="초대 코드 6자리" value="${esc(D.code)}" aria-label="초대 코드"><button type="button" class="btn" data-dg="join">들어가기</button></div>
    </section>
    <section class="dg-card dg-rules"><h2>규칙</h2><ul>
      <li>맞히면 공격, 빠를수록·콤보가 길수록 세게. 틀리거나 시간이 지나면 몬스터가 때려요.</li>
      <li>모두의 정답으로 <b>파티 게이지</b>가 차면 합동 필살기. 속성이 다른 펫 3마리면 피해 +30%.</li>
      <li>체력이 0이면 기절. 동료가 3연속 정답이면 부활, 층이 바뀌어도 부활해요.</li>
      <li>빈자리는 봇 동료로 채울 수 있어요(봇이 낀 파티는 기록에서 빠져요). 보상은 곧 열려요.</li>
    </ul></section>
    ${h.recent?.length ? `<section class="dg-card"><h2>최근 던전</h2>${h.recent.map(r => `<div class="dg-recent ${r.cleared ? 'win' : ''}"><b>${esc(r.cut_name)}</b><span>${r.cleared ? `클리어 ${clock(r.time_ms)}` : `${num(r.reached)}층까지`}</span><small>${r.size}명</small></div>`).join('')}</section>` : ''}`);
}
const rangeBody = () => ({ range_codes: [...(D.ranges || [])] });
async function createRoom(b) {
  buttonBusy(b);
  try { const res = await api('/dungeon/rooms', { cut: D.cut, ...rangeBody() }); if (D) enterRoom(res.room); }
  catch (err) { buttonBusy(b, false); toast(err.message); }
}
async function joinByCode(b, code) {
  if (!/^\d{6}$/.test(code || '')) return toast('초대 코드 6자리를 넣어 주세요.');
  if (!D.ranges) myRanges();
  buttonBusy(b);
  try { const res = await api('/dungeon/join', { code, ...rangeBody() }); if (D) enterRoom(res.room); }
  catch (err) { buttonBusy(b, false); toast(err.message); }
}
async function declineInvite(b) {
  buttonBusy(b);
  try { await api('/dungeon/invite/decline', { id: b.dataset.id }); D.home.invites = D.home.invites.filter(r => r.id !== b.dataset.id); homeScreen(); }
  catch (err) { buttonBusy(b, false); toast(err.message); }
}

/* ---------- 방 연결 ---------- */
function enterRoom(room) {
  D.room = room; D.view = null; D.qn = null; D.phase = null;
  main('<div class="yb-loading">던전 방에 들어가는 중…</div>');
  openSocket();
}
function openSocket() {
  try { D.ws?.close(); } catch {}
  const ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/api/dungeon/ws/${D.room.id}?ticket=${encodeURIComponent(D.room.ticket)}`);
  D.ws = ws;
  ws.onmessage = event => { let msg; try { msg = JSON.parse(event.data); } catch { return; } if (D?.ws === ws) onMessage(msg); };
  // V13.129: 다시 연결되면 첫 화면에서 문제를 새로 그린다(끊긴 사이 누른 보기가 잠긴 채 남지 않게).
  ws.onopen = () => { D.retries = 0; D.qn = null; note(''); };
  ws.onclose = event => {
    if (D?.ws !== ws || D.closing || D.view?.phase === 'finished' || D.ended) return;
    if (event.code === 4000) { D.ended = true; D.replaced = true; return main('<section class="dg-card dg-center"><h2>다른 화면에서 던전을 열었어요</h2><p>방금 연 화면에서 이어서 해요.</p><button type="button" class="btn primary" data-dg="home">나가기</button></section>'); }
    D.retries = (D.retries || 0) + 1;
    // V13.129: 방이 닫혔거나 들어갈 수 없으면 '나가기'로 방에서 빠져나와 입구로 돌아간다.
    if (D.retries > 8) { D.ended = true; return main('<section class="dg-card dg-center"><h2>던전 방에 연결하지 못했어요</h2><p>방이 닫혔을 수 있어요. 나가서 다시 들어가 주세요.</p><button type="button" class="btn primary" data-dg="leave-room">나가서 던전 입구로</button></section>'); }
    note('연결이 끊겨 다시 연결하는 중…');
    later(() => { if (D.ws === ws) openSocket(); }, Math.min(4000, 600 * D.retries));
  };
  clearInterval(D.pinger);
  D.pinger = setInterval(() => { if (ws.readyState === 1) ws.send('{"type":"ping"}'); }, 20000);
}
function send(msg) { if (D?.ws?.readyState === 1) D.ws.send(JSON.stringify(msg)); }
function onMessage(msg) {
  // 방 시계와 폰 시계의 차이(가장 늦게 온 메시지가 아니라 가장 빠른 쪽에 맞춘다).
  if (Number.isFinite(msg.now)) { const off = msg.now - Date.now(); D.offset = D.offsetSet ? Math.max(D.offset - 50, Math.min(D.offset + 50, off)) : off; D.offsetSet = true; }
  if (msg.type === 'view') return draw(msg.view);
  if (msg.type === 'events') return msg.events.forEach(play);
  if (msg.type === 'expired' || msg.type === 'closed') {
    D.ended = true;
    const why = msg.reason === 'host-left' ? '방장이 방을 닫았어요.' : msg.reason === 'lobby-expired' ? '15분 동안 시작하지 않아 방이 닫혔어요.' : '방이 닫혔어요.';
    main(`<section class="dg-card dg-center"><h2>${why}</h2><button type="button" class="btn primary" data-dg="again">던전 입구로</button></section>`);
  }
}

/* ---------- 그리기 ---------- */
function draw(v) {
  const prev = D.view;
  D.view = v;
  const me = v.players.find(p => p.id === D.A.data.profile.id);
  D.me = me;
  if (v.phase === 'lobby') return lobbyScreen(v);
  if (v.phase === 'finished') return resultScreen(v);
  if (D.phase !== 'battle') battleScreen(v);
  if (v.phase === 'intro') introOverlay(v);
  updateBattle(v, prev);
}
function slot(p, me) {
  if (!p) return '<div class="dg-slot empty"><i>빈자리</i></div>';
  return `<div class="dg-slot${p.id === me ? ' me' : ''}${p.ready ? ' ready' : ''}${p.connected ? '' : ' off'}">${p.pet ? avatar(p.pet.key, { form: p.pet.form }) : ''}<b>${esc(p.name)}</b><span>${p.bot ? '봇 동료' : p.id === D.view?.host ? '방장' : '파티원'}${p.connected || p.bot ? '' : ' · 연결 대기'}</span><em>${p.ready ? '준비 완료' : '준비 중'}</em></div>`;
}
function lobbyScreen(v) {
  D.phase = 'lobby';
  const myId = D.A.data.profile.id, host = v.host === myId, me = v.players.find(p => p.id === myId);
  const seats = [0, 1, 2].map(i => slot(v.players[i], myId)).join('');
  const full = v.players.length >= 3;
  note(`${v.cut_name} · ${v.grade}`);
  main(`
    <section class="dg-lobby">
      <div class="dg-code-box"><span>초대 코드</span><b>${esc(D.room.code || '')}</b><button type="button" class="btn ghost" data-dg="copy">복사</button></div>
      <p class="dg-hint">같은 학년 친구에게 코드를 알려 주거나, 친구 목록에서 불러요. 2명부터 시작할 수 있어요.</p>
      <div class="dg-seats">${seats}</div>
      ${host && !full ? `<div class="dg-row"><button type="button" class="btn" data-dg="friends">${icon('user')} 친구 부르기</button><button type="button" class="btn ghost" data-dg="bot">🤖 봇 동료</button></div>` : ''}
      <button type="button" class="btn ${me?.ready ? 'ghost' : 'primary'} full dg-ready" data-dg="ready" data-on="${me?.ready ? '0' : '1'}">${me?.ready ? '준비 취소' : '준비 완료!'}</button>
      <p class="dg-hint">${v.players.length < 2 ? '한 명 더 있어야 시작할 수 있어요.' : v.players.every(p => p.ready) ? '곧 시작해요!' : '모두 준비하면 바로 시작해요.'}</p>
    </section>`);
}
async function copyCode() {
  try { await navigator.clipboard.writeText(D.room.code); toast('초대 코드를 복사했어요.'); } catch { toast(`초대 코드: ${D.room.code}`); }
}
async function pickFriend() {
  let friends;
  try { ({ friends } = await api('/dungeon/friends')); } catch (err) { return toast(err.message); }
  if (!D) return;
  const cut = D.view?.cut;
  const close = modal(`<div class="dg-friends">${friends.length ? friends.map(f => {
    const locked = cut && cut !== 'c3' && !(f.cleared || []).includes({ c2: 'c3', c1: 'c2', max: 'c1' }[cut]);
    return `<div class="dg-friend">${f.pet ? avatar(f.pet.key, { form: f.pet.form, size: 'mini' }) : ''}<div><b>${esc(f.name)}</b><span>${esc(f.school)}${f.same_class ? ' · 우리 반' : ''}${f.busy ? ' · 던전 중' : ''}${locked ? ' · 단계 잠김' : ''}</span></div><button type="button" class="btn primary" data-friend="${esc(f.id)}" ${f.busy || locked ? 'disabled' : ''}>부르기</button></div>`;
  }).join('') : '<p>같은 학년 친구가 아직 없어요. 초대 코드를 알려 주세요.</p>'}</div>`, '같은 학년 친구 부르기');
  document.querySelector('.dg-friends')?.addEventListener('click', async event => {
    const b = event.target.closest('[data-friend]'); if (!b || b.disabled) return;
    buttonBusy(b);
    try { const res = await api('/dungeon/invite', { friend_id: b.dataset.friend }); toast(`${res.friend}에게 초대를 보냈어요.`); b.textContent = '보냈어요'; }
    catch (err) { buttonBusy(b, false); toast(err.message); }
  });
  void close;
}
async function addBot(b) {
  buttonBusy(b);
  try { await api('/dungeon/bot', {}); } catch (err) { toast(err.message); }
  buttonBusy(b, false);
}

/* ---------- 전투 ---------- */
function battleScreen(v) {
  D.phase = 'battle';
  main(`
    <section class="dg-battle">
      <div class="dg-hud"><span class="dg-floor" id="dg-floor"></span><span class="dg-clock" id="dg-clock">0:00</span></div>
      <div class="dg-arena" id="dg-arena">
        <div class="dg-monster" id="dg-monster"></div>
        <div class="dg-boss" id="dg-boss"></div>
        <div class="dg-party" id="dg-party"></div>
        <div class="dg-banner" id="dg-banner" aria-live="polite"></div>
      </div>
      <div class="dg-gauge" id="dg-gauge" aria-label="파티 게이지"><i></i><span></span></div>
      <div class="dg-ask" id="dg-ask"></div>
    </section>`);
  D.qn = null; D.monsterKey = null;
  tickLoop();
}
function updateBattle(v, prev) {
  const myId = D.A.data.profile.id;
  const arena = document.getElementById('dg-arena');
  if (arena) arena.style.setProperty('--dg-bg', FLOOR_BG[Math.max(0, Math.min(5, (v.monster?.boss ? 6 : v.floor) - 1))]);
  const floor = document.getElementById('dg-floor');
  if (floor) floor.textContent = v.floor ? `${v.monster?.boss ? '보스' : `${v.floor}층`}${v.last_floor ? ` / ${v.last_floor}` : ''} · ${v.cut_name}` : v.cut_name;
  // 몬스터: 바뀔 때만 다시 그린다(맞는 효과가 끊기지 않게).
  const m = v.monster, box = document.getElementById('dg-monster');
  if (box && m && D.monsterKey !== `${v.floor}:${m.key}`) {
    D.monsterKey = `${v.floor}:${m.key}`;
    const w = m.boss ? 'min(430px, 100%)' : `${SIZE_W[m.size] || 54}%`;
    box.innerHTML = `<div class="dg-mon-name"><b>${esc(m.name)}</b>${m.trait ? `<span title="${esc(m.trait.desc)}">${esc(m.trait.name)}</span>` : ''}</div><div class="dg-hp"><i></i><span></span></div><img class="dg-mon-img${m.boss ? ' boss' : ''}" id="dg-mon-img" src="/assets/monsters/${esc(m.key)}.webp" alt="${esc(m.name)}" style="width:${w}" width="512" height="512" decoding="async" draggable="false">`;
    box.querySelector('img').onerror = event => { event.target.onerror = null; event.target.src = '/assets/monsters/golem.webp'; };
    if (m.trait) banner(`${m.name} · ${m.trait.name}`, m.trait.desc);
  }
  if (box && m) {
    const share = Math.max(0, m.hp / m.max_hp);
    box.querySelector('.dg-hp i').style.width = `${share * 100}%`;
    box.querySelector('.dg-hp span').textContent = `${num(m.hp)} / ${num(m.max_hp)}`;
    box.classList.toggle('low', share < .3);
  }
  // 보스: 페이즈, 채점 표적, 핵.
  const boss = document.getElementById('dg-boss');
  if (boss) {
    const target = m?.boss && m.mark ? v.players.find(p => p.id === m.mark) : null;
    const core = m?.boss && m.core?.open_until ? m.core : null;
    boss.innerHTML = m?.boss ? `<span class="dg-stage s${m.stage}">${['', '1페이즈', '빨간펜 채점', '핵 노출 · 분노'][m.stage] || ''}</span>${target ? `<span class="dg-mark${target.id === myId ? ' me' : ''}">✏️ 채점 표적: ${esc(target.id === myId ? '나' : target.name)}${target.id === myId ? ` · ${target.mark_left}문제 연속!` : ''}</span>` : ''}${core ? `<span class="dg-core">💠 핵 ${core.count}/${core.goal}</span>` : ''}` : '';
  }
  // 파티: 체력, 기절, 콤보, 연결.
  const party = document.getElementById('dg-party');
  if (party) party.innerHTML = v.players.map(p => `<div class="dg-member${p.id === myId ? ' me' : ''}${p.down ? ' down' : ''}${p.out ? ' out' : ''}${p.connected || p.bot ? '' : ' off'}" data-pid="${esc(p.id)}" style="--el:${ELEMENTS[p.element]?.c1 || '#ffd23f'}">${p.pet ? avatar(p.pet.key, { form: p.pet.form, size: 'mini' }) : ''}<b>${esc(p.id === myId ? '나' : p.name)}</b><div class="dg-mhp"><i style="width:${Math.max(0, p.hp / p.max_hp * 100)}%"></i></div>${p.combo >= 3 ? `<em>${p.combo}콤보</em>` : ''}${p.down ? '<strong>기절</strong>' : p.out ? '<strong>포기</strong>' : !p.connected && !p.bot ? '<strong>연결 끊김</strong>' : ''}</div>`).join('');
  const gauge = document.getElementById('dg-gauge');
  if (gauge) { gauge.querySelector('i').style.width = `${v.gauge_max ? v.gauge / v.gauge_max * 100 : 0}%`; gauge.querySelector('span').textContent = `파티 게이지 ${v.gauge}/${v.gauge_max}${v.element_bonus > 1 ? ' · 속성 3색 +30%' : ''}`; }
  if (arena && !reduced()) fxEdge(arena, 'low', !!D.me && !D.me.down && D.me.hp <= 30);
  drawAsk(v);
}
// 내 문제: 새 문제 번호가 오면 그린다. 답한 뒤 다음 문제 전까지는 정답 표시를 그대로 둔다.
function drawAsk(v) {
  const ask = document.getElementById('dg-ask');
  if (!ask) return;
  const me = D.me, q = v.question;
  if (v.phase === 'rest') { D.qn = null; ask.innerHTML = `<div class="dg-rest"><b>휴식</b><span id="dg-rest-left"></span><p>${num(v.floor + 1)}층으로 올라가요. 기절한 친구는 체력 30%로 일어나요.</p></div>`; return; }
  if (v.phase === 'intro') { ask.innerHTML = '<div class="dg-rest"><b>입장 준비</b><p>문이 열리면 바로 첫 문제가 나와요.</p></div>'; return; }
  if (me?.down) {
    if (D.qn !== 'down') { D.qn = 'down'; ask.innerHTML = `<div class="dg-down"><b>기절했어요</b><p>동료가 3연속 정답이면 일어나요. 응원을 보내요!</p><div class="dg-emotes">${Object.entries(EMOTES).map(([k, t]) => `<button type="button" class="btn ghost" data-dg="emote" data-emote="${k}">${t}</button>`).join('')}</div></div>`; }
    return;
  }
  if (!q || D.qn === q.n) return;
  D.qn = q.n; D.picked = null;
  const n = q.options.length;
  ask.innerHTML = `<div class="dg-q"><div class="dg-time"><i id="dg-time"></i></div><h2 class="dg-word${v.monster?.trait?.key === 'blink' ? ' blink' : ''}">${esc(q.prompt)}</h2><div class="dg-options n${n}${v.monster?.trait?.key === 'web' ? ' web' : ''}">${q.options.map((o, i) => {
    const covered = i === q.covered, marked = i === q.marked;
    return `<button type="button" class="dg-opt${covered ? ' covered' : ''}${marked ? ' marked' : ''}" data-dg="answer" data-choice="${i}" ${covered ? 'disabled aria-label="붕대로 가려진 보기"' : ''}>${covered ? '붕대' : esc(o)}</button>`;
  }).join('')}</div></div>`;
}
function pick(choice, b) {
  const q = D.view?.question;
  if (!q || D.picked !== null || q.n !== D.qn) return;
  // V13.129: 연결이 끊긴 사이에는 누르지 않은 것으로 둔다(보기가 잠기지 않게).
  if (D.ws?.readyState !== 1) return toast('연결 중이에요. 잠시 뒤 눌러 주세요.');
  D.picked = choice;
  b.classList.add('picked');
  document.querySelectorAll('.dg-opt').forEach(x => { x.disabled = true; });
  send({ type: 'answer', choice, n: q.n });
}
function emote(key, b) {
  send({ type: 'emote', emote: key });
  if (b) { b.disabled = true; later(() => { b.disabled = false; }, 3000); }
}
// 시계: 경과 시간, 내 문제의 남은 시간, 휴식 · 입장 남은 시간.
function tickLoop() {
  cancelAnimationFrame(D.raf);
  const step = () => {
    if (!D || D.closing || D.phase !== 'battle') return;
    const v = D.view, now = serverNow();
    const c = document.getElementById('dg-clock');
    if (c && v) c.textContent = clock(v.started_at ? now - v.started_at : 0);
    const bar = document.getElementById('dg-time'), q = v?.question;
    if (bar && q && q.n === D.qn) { const left = Math.max(0, (q.deadline - now) / (q.deadline - q.started_at)); bar.style.width = `${left * 100}%`; bar.classList.toggle('hurry', left < .3); }
    const rest = document.getElementById('dg-rest-left');
    if (rest && v?.rest_until) rest.textContent = `${Math.max(0, Math.ceil((v.rest_until - now) / 1000))}초`;
    const intro = document.getElementById('dg-intro-left');
    if (intro && v?.intro_until) intro.textContent = Math.max(0, Math.ceil((v.intro_until - now) / 1000)) || '시작!';
    D.raf = requestAnimationFrame(step);
  };
  D.raf = requestAnimationFrame(step);
}
function introOverlay(v) {
  const arena = document.getElementById('dg-arena');
  if (!arena || arena.querySelector('.dg-door')) return;
  const el = document.createElement('div');
  el.className = `dg-door${reduced() ? ' still' : ''}`;
  el.innerHTML = `<i class="l"></i><i class="r"></i><div><span>${esc(v.cut_name)}</span><b>기말고사 지옥</b><em id="dg-intro-left"></em></div>`;
  arena.appendChild(el);
  later(() => el.classList.add('open'), Math.max(0, (v.intro_until || 0) - serverNow() - 700));
  later(() => el.remove(), Math.max(0, (v.intro_until || 0) - serverNow() + 900));
}
function banner(title, sub = '') {
  const el = document.getElementById('dg-banner');
  if (!el) return;
  el.innerHTML = `<b>${esc(title)}</b>${sub ? `<span>${esc(sub)}</span>` : ''}`;
  el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
}

/* ---------- 이벤트 → 효과 ---------- */
function centerOf(el, arena) {
  const a = arena.getBoundingClientRect(), r = el.getBoundingClientRect();
  return { x: r.left - a.left + r.width / 2, y: r.top - a.top + r.height / 2 };
}
function popNumber(arena, at, text, cls) {
  const el = document.createElement('div');
  el.className = `dg-pop ${cls}`; el.textContent = text;
  el.style.left = `${at.x}px`; el.style.top = `${at.y}px`;
  arena.appendChild(el);
  setTimeout(() => el.remove(), 1000);
}
function pose(name, ms = 380) {
  const img = document.getElementById('dg-mon-img'), m = D.view?.monster;
  if (!img || !m) return;
  img.src = `/assets/monsters/${m.key}-${name}.webp`;
  clearTimeout(D.poseTimer);
  if (name !== 'down') D.poseTimer = setTimeout(() => { if (document.getElementById('dg-mon-img') === img) img.src = `/assets/monsters/${m.key}.webp`; }, ms);
}
function play(e) {
  const arena = document.getElementById('dg-arena'), myId = D.A.data.profile.id;
  if (e.type === 'floor') banner(e.boss ? '보스 등장! 킬러 골렘' : `${e.floor}층`, e.bg);
  if (e.type === 'boss_phase') banner(`페이즈 ${e.stage}`, e.name);
  if (e.type === 'mark' && e.pid === myId) banner('✏️ 채점 표적!', '다음 3문제를 연속으로 맞혀야 막아요');
  if (e.type === 'core_open') banner('💠 핵 노출!', `모두 함께 ${e.goal}문제를 맞히면 브레이크`);
  if (e.type === 'rest') banner('층 클리어!', '6초 휴식');
  if (e.type === 'forfeit') banner(`${nameOf(e.pid)} 포기`, '연결이 90초 넘게 끊겼어요');
  if (e.type === 'answered' && e.pid === myId) {
    const opts = document.querySelectorAll('.dg-opt');
    opts[e.answer]?.classList.add('right');
    if (!e.right && D.picked !== null) opts[D.picked]?.classList.add('wrong');
    if (e.timeout) document.querySelector('.dg-q')?.classList.add('late');
    opts.forEach(x => { x.disabled = true; });
  }
  if (!arena || reduced()) return;
  const monster = document.getElementById('dg-mon-img');
  const memberEl = pid => arena.querySelector(`.dg-member[data-pid="${CSS.escape(String(pid))}"]`);
  const at = monster ? centerOf(monster, arena) : { x: arena.clientWidth / 2, y: arena.clientHeight * .35 };
  if (e.type === 'hit') {
    const p = D.view?.players.find(x => x.id === e.pid), el = p?.element || 'star', from = e.pid && memberEl(e.pid);
    if (from && e.kind !== 'auto') fxShot(arena, centerOf(from, arena), at, el, { big: e.pid === myId });
    later(() => { fxImpact(arena, at, el, e.kind === 'special' || e.kind === 'break' ? 3 : e.pid === myId ? 2 : 1); popNumber(arena, at, `-${e.damage}`, e.pid === myId ? 'mine' : ''); pose('hurt'); }, from ? 230 : 0);
  }
  if (e.type === 'special') { banner('합동 필살기!', `${nameOf(e.pid)}의 정답으로 게이지가 찼어요`); fxPunch(arena, .06); fxPowerUp(arena, at, 'star'); }
  if (e.type === 'break') { banner('브레이크!', '핵이 부서졌어요'); fxPunch(arena, .08); }
  if (e.type === 'struck') {
    const el = memberEl(e.pid);
    pose('attack', 420);
    if (el) { const where = centerOf(el, arena); popNumber(arena, where, `-${e.damage}`, 'hurt'); el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake'); }
    if (e.pid === myId) fxPunch(arena, .035);
  }
  if (e.type === 'mark_blocked' && e.pid === myId) { const el = memberEl(e.pid); if (el) fxShield(arena, centerOf(el, arena)); banner('채점 방어!', '3문제 연속 정답'); }
  if (e.type === 'revive') { const el = memberEl(e.pid); if (el) fxHeal(arena, centerOf(el, arena)); if (e.by) banner(`${nameOf(e.pid)} 부활!`, `${nameOf(e.by)}의 3연속 정답`); }
  if (e.type === 'defeat') { pose('down'); fxImpact(arena, at, 'star', 3); }
  if (e.type === 'emote') { const el = memberEl(e.pid); if (el) { const bubble = document.createElement('i'); bubble.className = 'dg-bubble'; bubble.textContent = EMOTES[e.emote] || ''; el.appendChild(bubble); setTimeout(() => bubble.remove(), 1800); } }
  if (e.type === 'answered' && e.right && e.pid === myId) {
    const me = D.view?.players.find(x => x.id === myId), rank = comboRank((me?.combo || 0) + 1);
    if (rank) fxRank(arena, { x: arena.clientWidth / 2, y: arena.clientHeight * .6 }, rank[1], rank[2]);
  }
}
const nameOf = pid => { const p = D.view?.players.find(x => x.id === pid); return p ? (p.id === D.A.data.profile.id ? '나' : p.name) : ''; };

/* ---------- 결과 ---------- */
function resultScreen(v) {
  if (D.phase === 'result') return;
  D.phase = 'result';
  cancelAnimationFrame(D.raf);
  const r = v.result, myId = D.A.data.profile.id;
  note('');
  main(`
    <section class="dg-result ${r.cleared ? 'win' : 'lose'}">
      <span class="dg-kicker">${esc(v.cut_name)} · ${r.size}명</span>
      <h1>${r.cleared ? '던전 클리어!' : '전멸…'}</h1>
      <div class="dg-result-stats"><div><b>${clock(r.time_ms)}</b><span>클리어 시간</span></div><div><b>${r.cleared ? '보스' : `${num(r.reached)}층`}</b><span>${r.cleared ? '처치' : '도달'}</span></div><div><b>${r.no_down ? '무사고' : '—'}</b><span>기절 없음</span></div></div>
      <div class="dg-result-players">${r.players.map(p => `<div class="${p.id === myId ? 'me' : ''}"><b>${esc(p.id === myId ? '나' : p.name)}${p.bot ? ' <small>봇</small>' : ''}${p.out ? ' <small>포기</small>' : ''}</b><span>정답 ${num(p.right)}/${num(p.answered)} · ${Math.round(p.accuracy * 100)}%</span><i style="--share:${Math.round(p.share * 100)}%"><em>기여 ${Math.round(p.share * 100)}%</em></i><small>최고 콤보 ${num(p.best_combo)} · 기절 ${num(p.downs)}</small></div>`).join('')}</div>
      <p class="dg-hint">${r.record ? '기록 보드와 보상은 곧 열려요.' : '봇 동료가 있거나 포기한 친구가 있으면 기록에서 빠져요.'}</p>
      <div class="dg-row"><button type="button" class="btn primary" data-dg="again">던전 입구로</button><button type="button" class="btn ghost" data-dg="home">나가기</button></div>
    </section>`);
}

/* ---------- 나가기 ---------- */
async function tryExit() {
  const phase = D.view?.phase;
  // V13.129: 판이 끝났거나 방이 닫혔으면 바로 나간다. 방에 들어가 있던 중이면 서버에도 나간다고 알린다.
  // 다른 화면에서 같은 방을 열었으면 그 화면이 방을 이어 간다(여기서는 나가기를 보내지 않는다).
  if (!D.room || phase === 'finished' || D.replaced) return leaveScreen();
  if (D.ended || !phase) { try { await api('/dungeon/leave', {}); } catch {} return leaveScreen(); }
  const fighting = phase !== 'lobby';
  const ask = fighting ? '지금 나가면 90초 뒤 포기 처리되고 보상을 받지 못해요. 그동안 펫이 대신 싸워요.' : D.view.host === D.A.data.profile.id ? '방장이 나가면 방이 닫혀요.' : '로비에서 나갈까요?';
  const close = modal(`<p>${ask}</p><div class="dg-row"><button type="button" class="btn danger" id="dg-leave-yes">나가기</button><button type="button" class="btn ghost" id="dg-leave-no">계속하기</button></div>`, '던전에서 나가기');
  document.getElementById('dg-leave-no').onclick = close;
  document.getElementById('dg-leave-yes').onclick = async event => {
    buttonBusy(event.currentTarget);
    try { await api('/dungeon/leave', {}); } catch {}
    close();
    leaveScreen();
  };
}
