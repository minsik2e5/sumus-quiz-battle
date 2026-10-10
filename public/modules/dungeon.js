import { api, esc, icon, toast, num, rangeLabel, buttonBusy, modal } from './ui.js';
import { avatar, expressionSrc, petKey } from './character.js';
import { getRanges } from './student.js';
import { comboRank } from './battle-fx.js';
import { createDungeonFx } from './dungeon-fx.js';
import { playSound, preloadSound, soundOn } from './sound.js';

// V13.128 던전 화면 (docs/dungeon-design.md 2 · 3번): 던전 입구(등급컷 · 범위 · 방 만들기 · 초대 코드 · 받은 초대),
// 로비(파티 3자리, 친구 부르기, 봇 동료, 준비), 입장 연출, 층 전투, 휴식, 결과.
// 판은 던전 방(cloudflare/dungeon-room.mjs)이 돌리고, 이 화면은 방이 보낸 view와 이벤트를 그리고 선택 번호만 보낸다.
// V13.130 전투 화면: 세로(세우면) · 가로(눕히면) 무대, 던전 배경 · 몬스터 자세(숨쉬기 · 맞음 · 공격 · 포효 · 핵) · UI 그림,
// 펫 속성별 발사체와 메이플식으로 쌓이는 피해 숫자(dungeon-fx.js), 합동 필살 컷인, 전투 효과음(sound.js),
// 문제 세 종류(뜻 고르기 · 영어 고르기 · 영어 쓰기). 쓰기는 누른 글자 하나씩 보내고 방이 채점한다.
// 움직임 줄이기를 켠 폰에서는 효과를 그리지 않는다. A.screen === 'dungeon'일 때 #app을 쓴다.

const EMOTES = { cheer: '힘내!', help: '도와줘!', nice: '나이스!', gg: '수고했어!' };
const CUT_DESC = { c3: '처음 도전', c2: '3등급 컷을 깨면 열려요', c1: '2등급 컷을 깨면 열려요', max: '세 단계를 모두 깨면 열려요 · 끝없는 층' };

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
  leaveStage();
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
  if (act === 'tile') return tapTile(Number(b.dataset.i), b);
  if (act === 'sound') return toggleSound(b);
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

/* ---------- 전투 무대 ----------
   V13.130: 폰을 세우면 세로 무대(390×844), 눕히면 가로 무대(844×390)를 그리고 화면에 맞춰 키운다.
   세로는 위 전투 · 가운데 파티 게이지 · 아래 문제 칸, 가로는 왼쪽 파티 · 오른쪽 몬스터 · 아래 메이플식 칸
   (내 상태 · 문제 · 보기 단축키 · 파티 게이지)이다. 가로에만 파티 창 · 층 지도 · 채점/핵 막대가 있다. */
const STAGE = {
  land: { w: 844, h: 390, foot: 252, pets: [[26, 106], [118, 112], [214, 124]], mon: { cx: 655, foot: 262, boss: 430, S: 200, M: 230, L: 260 }, cols: [540, 620, 700], base: 184 },
  port: { w: 390, h: 844, foot: 474, pets: [[0, 138], [106, 128], [212, 128]], mon: { cx: 245, foot: 380, boss: 430, S: 230, M: 260, L: 290 }, cols: [150, 240, 320], base: 236 }
};
// 그림 안에서 발이 닿는 높이와 맞는 자리(그림 크기에 대한 비율). 보스 그림은 위아래 여백이 크다.
const FOOT = { boss: .96, mon: .93 }, HIT_AT = { boss: .68, mon: .48 };
const RANK_ICON = { c3: 'dungeon-rank3', c2: 'dungeon-rank2', c1: 'dungeon-rank1', max: 'dungeon-perfect' };
// 속성 → 효과음 묶음(별빛 · 풀 · 바람 세 가지 소리로 여덟 속성을 낸다).
const EL_SOUND = { star: 'star', flame: 'star', ice: 'star', leaf: 'leaf', earth: 'leaf', wind: 'wind', water: 'wind', toxic: 'wind' };
const KIND_HINT = { mean: '알맞은 뜻을 고르세요', eng: '알맞은 영어를 고르세요', spell: '뜻을 보고 영어를 써요 · 글자 칸을 차례로 눌러요' };
const KIND_LABEL = { mean: '뜻 고르기', eng: '영어 고르기', spell: '영어 쓰기' };
const SFX_BATTLE = ['atk-star', 'atk-leaf', 'atk-wind', 'hit-star', 'hit-leaf', 'hit-wind', 'dmg-tick', 'crit', 'boss-slam', 'smash', 'type-key', 'type-ok', 'type-wrong', 'spell-done', 'correct', 'wrong', 'faint', 'revive'];
const SFX_BOSS = ['boss-charge', 'warn-beep', 'shield-block', 'boss-roar', 'ult-riser', 'ult-impact', 'boss-down', 'combo-10'];
const sfx = (key, opts) => playSound(key, opts);

const $id = id => document.getElementById(id);
const mode = () => (innerWidth > innerHeight ? 'land' : 'port');
const L = () => STAGE[D.mode];
// 그림을 바꿀 때 새 그림을 먼저 풀어 둔 뒤 바꾼다(바꾸는 순간 그림이 잠깐 비지 않게).
function swapSrc(img, src) {
  if (!img || img.getAttribute('src') === src) return;
  img._want = src;
  const pre = new Image(); pre.src = src;
  (pre.decode ? pre.decode() : Promise.resolve()).catch(() => {}).then(() => { if (img._want === src) img.src = src; });
}
const retrig = (el, cls) => { if (!el) return; el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); };

function battleScreen(v) {
  D.phase = 'battle';
  D.mode = mode();
  main(`
    <div class="dgs-wrap" id="dgs-wrap">
      <div class="dgs-holder" id="dgs-holder">
        <section class="dgs ${D.mode}" id="dgs" aria-label="던전 전투">
          <div class="dgs-world" id="dgs-world">
            <img class="dgs-bg" id="dgs-bg" alt="" decoding="async" draggable="false">
            <div class="dgs-shade"></div>
            <div class="dgs-mon-shadow" id="dgs-mon-shadow"></div>
            <div class="dgs-mon" id="dgs-mon"><img id="dgs-mon-img" alt="" decoding="async" draggable="false"></div>
            <div class="dgs-core" id="dgs-core"><img src="/assets/ui/dungeon-core.webp" alt="" draggable="false"><span>약점</span></div>
            <div class="dgs-pets" id="dgs-pets"></div>
            <canvas class="dgs-fx" id="dgs-fx" aria-hidden="true"></canvas>
            <div class="dgs-layer" id="dgs-layer"></div>
            <img class="dgs-break" id="dgs-break" src="/assets/ui/dungeon-break.webp" alt="" draggable="false">
            <div class="dgs-vig"></div>
          </div>
          <div class="dgs-title" id="dgs-title"></div>
          <div class="dgs-monbar" id="dgs-monbar"><div class="dgs-monname"><b id="dgs-mon-name"></b><span id="dgs-mon-tag"></span><em id="dgs-mon-hp"></em></div><div class="dgs-hp"><i class="lag" id="dgs-hp-lag"></i><i class="fill" id="dgs-hp-fill"></i><s id="dgs-tick2"></s><s id="dgs-tick3"></s></div><div class="dgs-phases" id="dgs-phases"></div></div>
          <div class="dgs-alert" id="dgs-alert" aria-live="polite"></div>
          <div class="dgs-feed" id="dgs-feed"></div>
          <div class="dgs-party" id="dgs-party"></div>
          <div class="dgs-rec"><img src="/assets/ui/dungeon-hourglass.webp" alt="" draggable="false"><span>기록</span><b id="dg-clock">0:00</b></div>
          <button type="button" class="dgs-tool exit" data-dg="exit" aria-label="던전에서 나가기">${icon('back')}</button><button type="button" class="dgs-tool snd" data-dg="sound" aria-pressed="${soundOn()}" aria-label="소리">${icon(soundOn() ? 'sound' : 'mute')}</button>
          <div class="dgs-combo" id="dgs-combo"><b></b><span>COMBO</span></div>
          <div class="dgs-dim" id="dgs-dim"></div>
          <div class="dgs-cutin" id="dgs-cutin"></div>
          <div class="dgs-flash" id="dgs-flash"></div>
          <div class="dgs-banner" id="dgs-banner" aria-live="polite"><b></b><span></span></div>
          <div class="dgs-hud" id="dgs-hud">
            <div class="dgs-me" id="dgs-me"></div>
            <div class="dgs-ask" id="dg-ask"></div>
            <div class="dgs-gauge" id="dgs-gauge"><img id="dgs-gauge-ico" src="/assets/ui/dungeon-ultimate.webp" alt="" draggable="false"><div><span id="dgs-gauge-txt"></span><i><b id="dgs-gauge-fill"></b></i></div></div>
          </div>
        </section>
      </div>
    </div>`);
  D.qn = null; D.monsterKey = null; D.petSig = null; D.spell = null; D.feed = [];
  D.fx?.stop();
  D.fx = createDungeonFx($id('dgs-fx'), { width: L().w, height: L().h, reduced });
  D.onResize = () => { if (D?.phase === 'battle') fitStage(); };
  addEventListener('resize', D.onResize);
  D.onKey = onKey;
  addEventListener('keydown', D.onKey);
  $id('dgs-world').addEventListener('animationend', e => { if (e.target.id === 'dgs-world') e.target.classList.remove('shake', 'shake-big'); });
  for (const type of ['animationend', 'animationcancel']) $id('dgs-mon').addEventListener(type, e => { if (e.target.id === 'dgs-mon') e.target.classList.remove('hit', 'slam'); });
  preloadSound(SFX_BATTLE);
  fitStage();
  tickLoop();
}
// 화면 크기에 맞춰 무대를 키운다. 방향이 바뀌면 무대를 바꾸고 파티 · 몬스터 자리를 다시 잡는다.
function fitStage() {
  const wrap = $id('dgs-wrap'), stage = $id('dgs'), holder = $id('dgs-holder');
  if (!wrap || !stage) return;
  const next = mode();
  if (next !== D.mode) { D.mode = next; stage.className = `dgs ${next}`; D.petSig = null; D.monsterKey = null; D.qn = null; }
  const box = wrap.getBoundingClientRect(), cs = getComputedStyle(wrap);
  const aw = box.width - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight), ah = box.height - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
  const s = Math.max(.3, Math.min(aw / L().w, ah / L().h));
  holder.style.width = `${L().w * s}px`; holder.style.height = `${L().h * s}px`;
  stage.style.transform = `scale(${s})`;
  D.scale = s;
  D.fx?.resize(L().w, L().h, s);
  if (D.view) updateBattle(D.view, null);
}

/* 몬스터 */
const monBox = m => {
  const lay = L().mon, boss = !!m?.boss, w = boss ? lay.boss : (lay[m?.size] || lay.M);
  return { w, x: lay.cx - w / 2, y: lay.foot - w * (boss ? FOOT.boss : FOOT.mon), boss };
};
function monHit(jitter = true) {
  const m = D.view?.monster, b = monBox(m), j = jitter ? 1 : 0;
  if (m?.boss && m.stage === 3) return { x: b.x + b.w * .52 + (Math.random() - .5) * 24 * j, y: b.y + b.w * .66 + (Math.random() - .5) * 20 * j };
  return { x: b.x + b.w / 2 + (Math.random() - .5) * b.w * .3 * j, y: b.y + b.w * (b.boss ? HIT_AT.boss : HIT_AT.mon) + (Math.random() - .5) * b.w * .2 * j };
}
const monSrc = (key, pose) => `/assets/monsters/${key}${pose ? '-' + pose : ''}.webp`;
function idlePose(m) {
  if (!m) return '';
  if (m.boss && m.stage === 3) return 'core';
  if (m.boss && m.stage === 2) return 'rage';
  return D.idleFlip ? 'idle2' : '';
}
// 잠깐 다른 자세(맞음 · 공격 · 포효 …)를 보여 주고 원래 자세로 돌아온다. 그림이 없으면 기본 그림.
function pose(name, ms = 380) {
  const img = $id('dgs-mon-img'), m = D.view?.monster;
  if (!img || !m) return;
  D.posing = name !== 'down' ? serverNow() + ms : Infinity; D.poseName = name;
  swapSrc(img, monSrc(m.key, name));
  clearTimeout(D.poseTimer);
  if (name !== 'down') D.poseTimer = setTimeout(() => { D.posing = 0; if ($id('dgs-mon-img') === img) swapSrc(img, monSrc(m.key, idlePose(D.view?.monster))); }, ms);
}
function drawMonster(v) {
  const m = v.monster, box = $id('dgs-mon'), img = $id('dgs-mon-img'), shadow = $id('dgs-mon-shadow');
  if (!box || !m) return;
  const key = `${D.mode}:${v.floor}:${m.key}`;
  if (D.monsterKey !== key) {
    D.monsterKey = key; D.posing = 0;
    const b = monBox(m);
    Object.assign(box.style, { left: `${b.x}px`, top: `${b.y}px`, width: `${b.w}px`, height: `${b.w}px` });
    box.className = `dgs-mon${m.boss ? ' boss' : ''}`;
    Object.assign(shadow.style, { left: `${L().mon.cx - b.w * .36}px`, top: `${L().mon.foot - 14}px`, width: `${b.w * .72}px` });
    img.alt = m.name;
    img.onerror = () => { img.onerror = null; img.src = monSrc(m.key, ''); };
    img.src = monSrc(m.key, idlePose(m));
    for (const p of ['idle2', 'windup', 'attack', 'attack2', 'skill', 'hurt', 'down', ...(m.boss ? ['rage', 'core', 'roar', 'corehurt'] : [])]) new Image().src = monSrc(m.key, p);
    const bg = $id('dgs-bg'), file = m.boss ? 'bg-boss' : v.floor > 5 ? 'bg-endless' : `bg-f${Math.max(1, v.floor)}`;
    if (bg && !bg.src.endsWith(`/${file}.webp`)) bg.src = `/assets/dungeon/${file}.webp`;
    D.fx?.setEmbers(m.boss ? 22 : 8);
    if (m.boss) preloadSound(SFX_BOSS);
  }
  const core = $id('dgs-core');
  if (core) {
    const on = !!(m.boss && m.core?.open_until), b = monBox(m);
    core.classList.toggle('on', on);
    if (on) Object.assign(core.style, { left: `${b.x + b.w * .52 - 24}px`, top: `${b.y + b.w * .66 - 24}px` });
  }
}

/* 파티 */
// 세로는 내 펫이 왼쪽(이름표가 크게), 가로는 내 펫이 보스와 가장 가까운 오른쪽이다.
function partyOrder(v) {
  const myId = D.A.data.profile.id, me = v.players.filter(p => p.id === myId), others = v.players.filter(p => p.id !== myId);
  return D.mode === 'port' ? [...me, ...others] : [...others, ...me];
}
const petArt = (p, face) => {
  const key = petKey(p.pet?.key || 'dog'), form = p.pet?.form ?? 3;
  return (face && expressionSrc(key, form, face)) || `/assets/pets/${key}-${form}.webp`;
};
function slotOf(pid) { return D.slots?.get(pid) || null; }
function petCenter(pid) {
  const s = slotOf(pid);
  if (!s) return { x: L().w * .25, y: L().foot - 60 };
  return { x: s.x + s.size * .58, y: L().foot - s.size * .52 };
}
function drawParty(v) {
  const myId = D.A.data.profile.id, list = partyOrder(v), host = $id('dgs-pets');
  if (!host) return;
  const sig = `${D.mode}:${list.map(p => p.id).join(',')}`;
  if (D.petSig !== sig) {
    D.petSig = sig; D.slots = new Map();
    host.innerHTML = list.map((p, i) => {
      const [x, size] = L().pets[i] || L().pets[0];
      D.slots.set(p.id, { x, size, i });
      return `<div class="dgs-pet${p.id === myId ? ' me' : ''}" data-pid="${esc(p.id)}" style="left:${x}px;top:${L().foot - size}px;width:${size}px;height:${size}px">
        <i class="sh"></i><img class="art" src="${petArt(p)}" alt="${esc(p.name)}의 펫" decoding="async" draggable="false">
        <img class="ico faint" src="/assets/ui/dungeon-faint.webp" alt="" draggable="false"><img class="ico mark" src="/assets/ui/dungeon-mark.webp" alt="" draggable="false">
        <div class="dgs-card"><b>${esc(p.id === myId ? `${p.name} (나)` : p.name)}${p.bot ? ' · 봇' : ''}</b><em></em><i><u></u></i></div></div>`;
    }).join('');
    host.querySelectorAll('.dgs-pet').forEach(el => { const done = e => { if (e.target.classList.contains('art')) el.classList.remove('lunge', 'hurt'); }; el.addEventListener('animationend', done); el.addEventListener('animationcancel', done); });
    // 공격 · 맞음 · 기쁨 표정 그림을 미리 받아 둔다(처음 바꿀 때 그림이 잠깐 비지 않게).
    for (const p of list) for (const face of ['attack', 'hurt', 'happy']) { const src = petArt(p, face); if (src) new Image().src = src; }
  }
  for (const p of list) {
    const el = host.querySelector(`.dgs-pet[data-pid="${CSS.escape(String(p.id))}"]`);
    if (!el) continue;
    const marked = v.monster?.boss && v.monster.mark === p.id;
    el.classList.toggle('down', !!p.down); el.classList.toggle('out', !!p.out); el.classList.toggle('off', !p.connected && !p.bot); el.classList.toggle('marked', !!marked);
    const hp = Math.max(0, p.hp / p.max_hp * 100);
    el.querySelector('.dgs-card u').style.width = `${hp}%`;
    el.querySelector('.dgs-card u').className = hp < 35 ? 'low' : '';
    el.querySelector('.dgs-card em').textContent = p.down ? '기절' : p.out ? '포기' : !p.connected && !p.bot ? '연결 끊김' : marked ? '표적' : p.combo >= 2 ? `${p.combo}연속` : '';
  }
  // 가로: 파티 창(층 지도 · 이름 · 체력 · 이번 문제 상태).
  const panel = $id('dgs-party');
  if (panel && D.mode === 'land') {
    const last = v.last_floor || v.floor || 1;
    const rooms = Array.from({ length: Math.min(6, last) }, (_, i) => `<span class="${i + 1 < v.floor ? 'done' : i + 1 === v.floor ? 'now' : ''}${i + 1 === last && last <= 6 ? ' boss' : ''}"></span>`).join('<em></em>');
    panel.innerHTML = `<div class="dgs-phead"><b>${v.monster?.boss ? '보스층' : v.floor ? `${v.floor}층` : ''} · ${esc(v.cut_name)}</b><div class="dgs-rooms" aria-hidden="true">${rooms}</div></div>${v.players.map(p => {
      const st = p.down ? '<i class="chip down">기절</i>' : p.out ? '<i class="chip down">포기</i>' : !p.connected && !p.bot ? '<i class="chip off">끊김</i>' : p.combo >= 3 ? `<i class="chip hot">${p.combo}</i>` : '';
      return `<div class="dgs-prow${p.id === myId ? ' me' : ''}"><span>${esc(p.id === myId ? '나' : p.name)}${p.bot ? ' · 봇' : ''}</span>${st}<i class="mini"><u style="width:${Math.max(0, p.hp / p.max_hp * 100)}%"></u></i></div>`;
    }).join('')}`;
  }
}

/* 위 정보 */
function drawTop(v) {
  const m = v.monster, myId = D.A.data.profile.id;
  const title = $id('dgs-title');
  if (title) title.innerHTML = `<img src="/assets/ui/${RANK_ICON[v.cut] || 'dungeon-rank3'}.webp" alt="${esc(v.cut_name)}" draggable="false"><div><b>${m?.boss ? '보스 · 킬러 골렘' : v.floor ? `${v.floor}층 · ${esc(m?.name || '')}` : '기말고사 지옥'}</b><span>기말고사 지옥 · ${esc(v.cut_name)} · ${v.players.length}명</span></div>`;
  if (m) {
    const share = Math.max(0, m.hp / m.max_hp);
    $id('dgs-mon-name').textContent = m.name;
    $id('dgs-mon-tag').textContent = m.boss ? ['', '1페이즈', '2페이즈 · 빨간펜 채점', '3페이즈 · 핵 노출'][m.stage] || '' : m.trait ? m.trait.name : '';
    $id('dgs-mon-tag').title = m.trait?.desc || '';
    $id('dgs-mon-hp').textContent = `${Math.ceil(share * 100)}% · ${num(Math.max(0, m.hp))}`;
    $id('dgs-hp-fill').style.width = `${share * 100}%`; $id('dgs-hp-lag').style.width = `${share * 100}%`;
    $id('dgs-tick2').hidden = $id('dgs-tick3').hidden = !m.boss;
    $id('dgs-phases').innerHTML = m.boss ? [['1페이즈', 1], ['2 채점', 2], ['3 핵', 3]].map(([t, s]) => `<span class="${m.stage === s ? 'on' : ''}">${m.stage === s ? ['', '1페이즈', '2페이즈 · 빨간펜 채점', '3페이즈 · 핵 노출'][s] : t}</span>`).join('') : '';
    $id('dgs-world').classList.toggle('p2', !!(m.boss && m.stage === 2)); $id('dgs-world').classList.toggle('p3', !!(m.boss && m.stage === 3));
  }
  // 채점 표적 · 핵 (세로는 카드, 가로는 보스 체력 아래 막대).
  const alert = $id('dgs-alert');
  if (alert) {
    const target = m?.boss && m.mark ? v.players.find(p => p.id === m.mark) : null;
    const core = m?.boss && m.core?.open_until ? m.core : null;
    let html = '';
    if (target) {
      const mine = target.id === myId, done = 3 - (target.mark_left || 0);
      html = `<div class="dgs-al mark${mine ? ' mine' : ''}"><img src="/assets/ui/dungeon-mark.webp" alt="" draggable="false"><div><b>빨간펜 채점!</b><span>${mine ? '내가 표적! 다음 3문제를 연속으로 맞혀 막아요' : `${esc(target.name)} 표적 · 3문제 연속 정답이면 막아요`}</span><p>${[0, 1, 2].map(i => `<i class="${i < done ? 'on' : ''}">${i < done ? i + 1 : ''}</i>`).join('')}</p></div></div>`;
    } else if (core) {
      html = `<div class="dgs-al core"><img src="/assets/ui/dungeon-core.webp" alt="" draggable="false"><div><b>핵이 드러났다!</b><span>파티가 정답 ${core.goal}개를 채우면 브레이크!</span><p class="bar"><i style="width:${Math.min(100, core.count / core.goal * 100)}%"></i><em>${core.count}/${core.goal}</em></p></div><strong id="dgs-core-left"></strong></div>`;
    }
    alert.innerHTML = html;
    alert.classList.toggle('on', !!html);
    $id('dgs-feed')?.classList.toggle('hide', !!html);
  }
}

/* 게이지 · 내 상태 · 콤보 */
function drawGauge(v) {
  const m = v.monster, core = m?.boss && m.core?.open_until ? m.core : null;
  const fill = $id('dgs-gauge-fill'), txt = $id('dgs-gauge-txt'), ico = $id('dgs-gauge-ico'), box = $id('dgs-gauge');
  if (!fill) return;
  const share = core ? core.count / core.goal : v.gauge_max ? v.gauge / v.gauge_max : 0;
  box.style.setProperty('--g', `${Math.min(100, share * 100)}%`);
  box.classList.toggle('core', !!core); box.classList.toggle('ready', !core && share >= .85);
  const icoSrc = `/assets/ui/${core ? 'dungeon-break' : 'dungeon-ultimate'}.webp`;
  if (!ico.src.endsWith(icoSrc)) ico.src = icoSrc;
  txt.innerHTML = core ? `<span>브레이크까지 · 파티 정답</span><b>${core.count}/${core.goal}</b>` : `<span>${D.mode === 'land' ? '합동 필살' : `파티 게이지${v.element_bonus > 1 ? ' · 서로 다른 속성 3마리 +30%' : ''}`}</span><b>${Math.round(share * 100)}%</b>`;
}
function drawMe(v) {
  const me = D.me, box = $id('dgs-me');
  if (box && me && D.mode === 'land') {
    box.innerHTML = `<div class="hd"><img src="${petArt(me)}" alt="" draggable="false"><div><b>${esc(me.name)}</b><span>${esc(v.grade)} · ${esc(v.cut_name)}</span></div></div>
      <div class="bar hp"><span>HP</span><i><u style="width:${Math.max(0, me.hp / me.max_hp * 100)}%"></u><em>${num(Math.max(0, me.hp))}/${num(me.max_hp)}</em></i></div>
      <div class="bar sp"><span>콤보</span><i><u style="width:${Math.min(100, (me.combo % 5) / 5 * 100 + (me.combo >= 25 ? 100 : 0))}%"></u><em>${me.combo}연속 · ×${Math.min(1.5, 1 + .1 * Math.floor(me.combo / 5)).toFixed(1)}</em></i></div>`;
  }
  const combo = $id('dgs-combo');
  if (combo && me) {
    const c = me.combo || 0, was = Number(combo.dataset.n || 0);
    combo.dataset.n = c;
    combo.classList.toggle('on', c >= 3);
    combo.querySelector('b').textContent = c;
    combo.querySelector('span').textContent = c >= 5 ? `COMBO ×${Math.min(1.5, 1 + .1 * Math.floor(c / 5)).toFixed(1)}` : 'COMBO';
    if (c > was && c >= 3) retrig(combo, 'pop');
    if (c > was && c > 0 && c % 10 === 0) { sfx('combo-10'); say(D.mode === 'land' ? 300 : 300, D.mode === 'land' ? 60 : 380, `${c} 콤보!`, '#fde68a'); }
  }
}

function updateBattle(v, prev) {
  if (!$id('dgs')) return;
  drawMonster(v);
  drawParty(v);
  drawTop(v);
  drawGauge(v);
  drawMe(v);
  $id('dgs-world')?.classList.toggle('low', !!D.me && !D.me.down && D.me.hp <= 30);
  drawAsk(v);
  void prev;
}

/* ---------- 문제 칸 ---------- */
// 새 문제 번호가 오면 그린다. 답한 뒤 다음 문제 전까지는 정답 표시를 그대로 둔다. 쓰기 문제는 방이 보낸 진행(채운 글자 · 실수)을 덧그린다.
function drawAsk(v) {
  const ask = $id('dg-ask');
  if (!ask) return;
  const me = D.me, q = v.question;
  if (v.phase === 'rest') { if (D.qn !== 'rest') { D.qn = 'rest'; ask.innerHTML = `<div class="dg-rest dgs-rest"><b>휴식</b><span id="dg-rest-left"></span><p>${num(v.floor + 1)}층으로 올라가요. 기절한 친구는 체력 30%로 일어나요.</p></div>`; } return; }
  if (v.phase === 'intro') { if (D.qn !== 'intro') { D.qn = 'intro'; ask.innerHTML = '<div class="dg-rest dgs-rest"><b>입장 준비</b><p>문이 열리면 바로 첫 문제가 나와요.</p></div>'; } return; }
  if (me?.down) {
    if (D.qn !== 'down') { D.qn = 'down'; ask.innerHTML = `<div class="dg-down dgs-rest"><b>기절했어요</b><p>동료가 3연속 정답이면 일어나요. 응원을 보내요!</p><div class="dg-emotes">${Object.entries(EMOTES).map(([k, t]) => `<button type="button" class="btn ghost" data-dg="emote" data-emote="${k}">${t}</button>`).join('')}</div></div>`; }
    return;
  }
  if (!q) return;
  if (D.qn === q.n) { if (q.kind === 'spell') drawSpell(q); return; }
  D.qn = q.n; D.picked = null; D.tick = 4;
  const kind = q.kind || 'mean', trait = v.monster?.trait?.key;
  const head = `<div class="dgs-qhead"><span class="dgs-kind ${kind}">${KIND_LABEL[kind]}</span><span class="dgs-left" id="dgs-time-left"></span></div>`;
  const timer = '<div class="dgs-time"><img src="/assets/ui/dungeon-hourglass.webp" alt="" draggable="false"><i><b id="dg-time"></b></i></div>';
  const prompt = `<h2 class="dgs-prompt ${kind === 'mean' ? 'en' : 'ko'}${trait === 'blink' ? ' blink' : ''}">${esc(q.prompt)}</h2>`;
  if (kind === 'spell') {
    // 화면을 다시 그릴 때(방향 바뀜)는 이미 맞힌 글자만큼 칸을 쓴 것으로 되살린다.
    D.spell = { n: q.n, queue: [], used: new Set() };
    for (const ch of q.filled || '') { const k = q.tiles.findIndex((c, j) => c === ch && !D.spell.used.has(j)); if (k >= 0) D.spell.used.add(k); }
    ask.innerHTML = `<div class="dgs-q spell"><div class="dgs-qbox">${head}${prompt}<div class="dgs-slots" id="dgs-slots">${Array.from({ length: q.len }, () => '<i></i>').join('')}</div><p class="dgs-hint" id="dgs-hint"></p>${timer}</div>
      <div class="dgs-tiles" style="--cols:${Math.ceil(q.tiles.length / 2)}">${q.tiles.map((c, i) => { const used = D.spell.used.has(i); return `<button type="button" class="dgs-tile${used ? ' used' : ''}" data-dg="tile" data-i="${i}" aria-label="글자 ${esc(c)}" ${used ? 'disabled' : ''}>${esc(c)}</button>`; }).join('')}</div></div>`;
    drawSpell(q);
    return;
  }
  D.spell = null;
  const n = q.options.length;
  ask.innerHTML = `<div class="dgs-q ${kind}"><div class="dgs-qbox">${head}${prompt}<p class="dgs-hint">${KIND_HINT[kind]} · ${n}개 중 1개</p>${timer}</div>
    <div class="dgs-options n${n}${trait === 'web' ? ' web' : ''}">${q.options.map((o, i) => {
      const covered = i === q.covered, marked = i === q.marked;
      return `<button type="button" class="dgs-opt${kind === 'eng' ? ' en' : ''}${covered ? ' covered' : ''}${marked ? ' marked' : ''}" data-dg="answer" data-choice="${i}" ${covered ? 'disabled aria-label="붕대로 가려진 보기"' : ''}><kbd>${i + 1}</kbd><span>${covered ? '붕대' : esc(o)}</span></button>`;
    }).join('')}</div></div>`;
}
function drawSpell(q) {
  const slots = $id('dgs-slots');
  if (!slots || !D.spell || D.spell.n !== q.n) return;
  const filled = q.filled || '';
  slots.querySelectorAll('i').forEach((el, i) => {
    if (el.classList.contains('miss')) return;
    el.textContent = filled[i] || '';
    el.className = i < filled.length ? 'f' : i === filled.length ? 'cur' : '';
  });
  const hint = $id('dgs-hint');
  if (hint) hint.textContent = `${q.len}글자 · 실수 ${q.miss}/${q.miss_max}`;
}
function pick(choice, b) {
  const q = D.view?.question;
  if (!q || q.kind === 'spell' || D.picked !== null || q.n !== D.qn) return;
  // V13.129: 연결이 끊긴 사이에는 누르지 않은 것으로 둔다(보기가 잠기지 않게).
  if (D.ws?.readyState !== 1) return toast('연결 중이에요. 잠시 뒤 눌러 주세요.');
  D.picked = choice;
  b.classList.add('picked');
  document.querySelectorAll('.dgs-opt').forEach(x => { x.disabled = true; });
  send({ type: 'answer', choice, n: q.n });
}
// 영어 쓰기: 누른 글자 하나를 보내고, 방의 답(letter 이벤트)이 오면 그 칸을 쓰거나 흔든다.
function tapTile(i, b) {
  const q = D.view?.question;
  if (!q || q.kind !== 'spell' || !D.spell || D.spell.n !== q.n || q.n !== D.qn || D.spell.used.has(i) || D.spell.queue.includes(i) || D.spell.done) return;
  // 연결이 끊긴 사이에는 보내지 않는다(V13.129 보기와 같다).
  if (D.ws?.readyState !== 1) return toast('연결 중이에요. 잠시 뒤 눌러 주세요.');
  D.spell.queue.push(i);
  b?.classList.add('wait');
  retrig(b, 'press');
  sfx('type-key', { vary: .04 });
  send({ type: 'letter', ch: q.tiles[i], n: q.n });
}
function onKey(event) {
  if (!D || D.phase !== 'battle' || event.ctrlKey || event.metaKey || event.altKey || event.target?.tagName === 'INPUT') return;
  const q = D.view?.question;
  if (!q || D.me?.down) return;
  if (q.kind === 'spell' && /^[a-z]$/i.test(event.key)) {
    const ch = event.key.toLowerCase();
    const i = q.tiles.findIndex((c, k) => c === ch && !D.spell?.used.has(k) && !D.spell?.queue.includes(k));
    if (i >= 0) tapTile(i, document.querySelector(`.dgs-tile[data-i="${i}"]`));
    else if (D.spell && D.spell.n === q.n && !D.spell.done && D.ws?.readyState === 1) { D.spell.queue.push(-1); sfx('type-key'); send({ type: 'letter', ch, n: q.n }); }
  } else if (q.kind !== 'spell' && /^[1-6]$/.test(event.key)) {
    const b = document.querySelector(`.dgs-opt[data-choice="${Number(event.key) - 1}"]`);
    if (b && !b.disabled) pick(Number(event.key) - 1, b);
  }
}
function emote(key, b) {
  send({ type: 'emote', emote: key });
  if (b) { b.disabled = true; later(() => { b.disabled = false; }, 3000); }
}
function toggleSound(b) {
  const on = !soundOn();
  try { localStorage.setItem('sumus-yacha-sound', on ? 'on' : 'off'); } catch {}
  b.setAttribute('aria-pressed', on); b.innerHTML = icon(on ? 'sound' : 'mute');
  if (on) { preloadSound(SFX_BATTLE); sfx('correct', { gain: .6 }); }
}

// 시계: 경과 시간, 내 문제의 남은 시간(마지막 3초 째깍), 핵 남은 시간, 휴식 · 입장 남은 시간, 몬스터 숨쉬기 자세.
function tickLoop() {
  cancelAnimationFrame(D.raf);
  let flipAt = 0;
  const step = () => {
    if (!D || D.closing || D.phase !== 'battle') return;
    const v = D.view, now = serverNow();
    const c = $id('dg-clock');
    if (c && v) c.textContent = clock(v.started_at ? now - v.started_at : 0);
    const bar = $id('dg-time'), q = v?.question;
    if (bar && q && q.n === D.qn) {
      const leftMs = Math.max(0, q.deadline - now), left = leftMs / (q.deadline - q.started_at);
      bar.style.width = `${left * 100}%`; bar.classList.toggle('hurry', left < .3);
      const lt = $id('dgs-time-left'); if (lt) lt.textContent = `${(leftMs / 1000).toFixed(1)}초`;
      const sec = Math.ceil(leftMs / 1000);
      if (sec < D.tick && sec > 0 && sec <= 3 && D.picked === null && !D.spell?.done) { D.tick = sec; sfx('tick', { gain: .7 }); }
    }
    const coreLeft = $id('dgs-core-left'), core = v?.monster?.core;
    if (coreLeft && core?.open_until) coreLeft.innerHTML = `<b>${Math.max(0, Math.ceil((core.open_until - now) / 1000))}</b><span>초 남음</span>`;
    const rest = $id('dg-rest-left');
    if (rest && v?.rest_until) rest.textContent = `${Math.max(0, Math.ceil((v.rest_until - now) / 1000))}초`;
    const intro = $id('dg-intro-left');
    if (intro && v?.intro_until) intro.textContent = Math.max(0, Math.ceil((v.intro_until - now) / 1000)) || '시작!';
    if (now > flipAt) {
      flipAt = now + 900; D.idleFlip = !D.idleFlip;
      const img = $id('dgs-mon-img'), m = v?.monster;
      if (img && m && !(D.posing > now) && v.phase !== 'finished') swapSrc(img, monSrc(m.key, idlePose(m)));
    }
    D.raf = requestAnimationFrame(step);
  };
  D.raf = requestAnimationFrame(step);
}
function introOverlay(v) {
  const world = $id('dgs-world');
  if (!world || world.querySelector('.dg-door')) return;
  const el = document.createElement('div');
  el.className = `dg-door${reduced() ? ' still' : ''}`;
  el.innerHTML = `<i class="l"></i><i class="r"></i><div><span>${esc(v.cut_name)}</span><b>기말고사 지옥</b><em id="dg-intro-left"></em></div>`;
  world.appendChild(el);
  sfx('door');
  later(() => el.classList.add('open'), Math.max(0, (v.intro_until || 0) - serverNow() - 700));
  later(() => el.remove(), Math.max(0, (v.intro_until || 0) - serverNow() + 900));
}
function banner(title, sub = '', cls = '') {
  const el = $id('dgs-banner');
  if (!el) return;
  el.className = `dgs-banner ${cls}`;
  el.querySelector('b').textContent = title;
  el.querySelector('span').textContent = sub; el.querySelector('span').hidden = !sub;
  retrig(el, 'show');
}
function say(x, y, text, color = '#fff') {
  const layer = $id('dgs-layer');
  if (!layer) return;
  const el = document.createElement('div');
  el.className = 'dgs-say'; el.textContent = text; el.style.left = `${x}px`; el.style.top = `${y}px`; el.style.color = color;
  layer.appendChild(el);
  setTimeout(() => el.remove(), 1100);
}
const flash = cls => retrig($id('dgs-flash'), cls);
const shake = big => { if (!reduced()) retrig($id('dgs-world'), big ? 'shake-big' : 'shake'); };

/* ---------- 이벤트 → 효과 ---------- */
// 피해 숫자를 메이플처럼 줄줄이 쌓는다. 숫자는 방이 계산한 피해 그대로다(합동 필살 · 브레이크 · 쓰기 보너스만 몇 줄로 나눠 보여 주고 합은 같다).
function stack(x, y, lines, { tag = '', tagCls = '', big = false, gap = 70, step = 31 } = {}) {
  const layer = $id('dgs-layer');
  if (!layer) return;
  const box = document.createElement('div');
  box.className = 'dgs-stack'; box.style.left = `${x}px`; box.style.top = `${y}px`;
  lines.forEach((l, i) => {
    const d = document.createElement('div');
    d.className = `dgs-dl ${l.cls || ''}${big ? ' big' : ''}`; d.textContent = l.text;
    d.style.top = `${-i * step}px`; d.style.animationDelay = `${i * gap}ms`;
    box.appendChild(d);
  });
  if (tag) { const t = document.createElement('div'); t.className = `dgs-dtag ${tagCls}`; t.textContent = tag; t.style.top = `${-lines.length * step - 6}px`; t.style.animationDelay = `${(lines.length - 1) * gap}ms`; box.appendChild(t); }
  layer.appendChild(box);
  setTimeout(() => box.remove(), 1500 + lines.length * gap);
}
// 합이 total인 n개의 숫자(조금씩 다르게).
function split(total, n) {
  n = Math.max(1, Math.min(n, total));
  const w = Array.from({ length: n }, () => .75 + Math.random() * .5), sum = w.reduce((a, b) => a + b, 0);
  const out = w.map(x => Math.max(1, Math.floor(total * x / sum)));
  out[0] += total - out.reduce((a, b) => a + b, 0);
  return out;
}
const petEl = pid => document.querySelector(`.dgs-pet[data-pid="${CSS.escape(String(pid))}"]`);
const playerOf = pid => D.view?.players.find(x => x.id === pid);
function petFace(pid, face, ms) {
  const el = petEl(pid), p = playerOf(pid);
  if (!el || !p) return;
  const img = el.querySelector('.art');
  clearTimeout(el._faceT);
  swapSrc(img, petArt(p, face));
  if (ms) el._faceT = setTimeout(() => { if (!p.down) swapSrc(img, petArt(playerOf(pid) || p)); }, ms);
}
function colOf(pid) { const s = slotOf(pid); return L().cols[s ? s.i : 1] ?? L().cols[1]; }
function hitShow(e, myId) {
  const p = playerOf(e.pid), el = p?.element || 'star', snd = EL_SOUND[el] || 'star', mine = e.pid === myId;
  const big = e.kind === 'special' || e.kind === 'break';
  const to = monHit(!big);
  const land = () => {
    if (!$id('dgs')) return;
    D.fx?.impact(big ? 'star' : el, to.x, to.y, big);
    if (big) { D.fx?.impact('flame', to.x - 18, to.y + 8, true, false); D.fx?.impact('water', to.x + 18, to.y - 8, true, false); }
    let lines, opt = {};
    if (e.kind === 'special') { lines = split(e.damage, 6).map((d, i) => ({ text: num(d), cls: i % 2 ? 'crit' : '' })); opt = { big: true, step: 34, gap: 90, tag: '합동 필살', tagCls: 'ult' }; }
    else if (e.kind === 'break') { lines = split(e.damage, 4).map(d => ({ text: num(d), cls: 'weak' })); opt = { big: true, step: 34, gap: 90, tag: '브레이크!', tagCls: 'weak' }; }
    else if (e.kind === 'spell') { const base = Math.max(1, Math.round(e.damage / 1.6)); lines = [{ text: num(base), cls: mine ? 'mine' : '' }, { text: num(e.damage - base), cls: 'crit' }].filter(l => l.text !== '0'); opt = { tag: '쓰기 보너스', tagCls: 'spell' }; }
    else if (e.kind === 'auto') { lines = [{ text: num(e.damage), cls: 'small' }]; }
    else { lines = [{ text: num(e.damage), cls: mine ? 'mine' : '' }]; if (p?.combo >= 5) opt.tag = `${p.combo}콤보`; }
    const x = big ? (D.mode === 'land' ? 640 : 250) : colOf(e.pid);
    stack(x, big ? (D.mode === 'land' ? 232 : 300) : L().base - (slotOf(e.pid)?.i || 0) * 6, lines, opt);
    $id('dgs-mon') && retrig($id('dgs-mon'), 'hit');
    const m = D.view?.monster;
    if (m && !(D.posing > serverNow() && D.poseName === 'roar')) pose(m.boss && m.stage === 3 ? 'corehurt' : 'hurt', 220);
    if (big) { sfx('ult-impact', { gain: e.kind === 'break' ? .8 : 1 }); flash('white'); shake(true); }
    else sfx(e.kind === 'spell' ? 'crit' : `hit-${snd}`, { gain: mine ? 1 : .7, vary: .04 });
    lines.forEach((_, k) => { if (k) sfx('dmg-tick', { gain: .55, at: k * (big ? .09 : .07), rate: 1 + k * .07 }); });
    if (!big) shake(false);
    if (!mine && e.pid && (e.kind === 'answer' || e.kind === 'spell')) feed(p, e.damage, e.kind === 'spell');
  };
  if (big) { const wait = Math.max(0, (D.cutinUntil || 0) - Date.now()); return later(land, wait); }
  if (e.kind === 'auto' || !e.pid || !slotOf(e.pid)) return land();
  const pet = petEl(e.pid);
  retrig(pet, 'lunge'); petFace(e.pid, 'attack', 520);
  sfx(`atk-${snd}`, { gain: mine ? .9 : .55, vary: .04 });
  const from = petCenter(e.pid);
  if (EL_SOUND[el] === 'leaf') { for (let k = 0; k < 4; k++) later(() => D.fx?.shoot(from, { x: to.x + (Math.random() - .5) * 36, y: to.y + (Math.random() - .5) * 36 }, el, 420, k ? () => D.fx?.impact(el, to.x, to.y) : land), k * 70); }
  else D.fx ? D.fx.shoot({ x: from.x + 24, y: from.y - 10 }, to, el, 340, land) : land();
  if (e.kind === 'spell' && D.fx) later(() => D.fx?.shoot({ x: from.x + 24, y: from.y - 30 }, { x: to.x - 20, y: to.y - 20 }, el, 340, () => D.fx?.impact(el, to.x - 20, to.y - 20)), 110);
}
// 세로 화면 왼쪽 위: 동료 정답 알림(최근 두 개).
function feed(p, damage, spell) {
  const box = $id('dgs-feed');
  if (!box || !p) return;
  D.feed = [{ name: p.name, damage, spell, at: Date.now() }, ...(D.feed || [])].slice(0, 2);
  box.innerHTML = D.feed.map((f, i) => `<span class="${i ? 'old' : ''}"><b>${esc(f.name)}</b> ${f.spell ? '쓰기 정답' : '정답'} · ${num(f.damage)} 피해</span>`).join('');
  clearTimeout(D.feedT);
  D.feedT = setTimeout(() => { if ($id('dgs-feed')) { D.feed = []; $id('dgs-feed').innerHTML = ''; } }, 3200);
}
function cutin(v) {
  const box = $id('dgs-cutin');
  if (!box) return;
  const pets = partyOrder(v).filter(p => !p.down && !p.out);
  box.innerHTML = `<div class="band"><i></i></div>${pets.map((p, i) => `<img class="cp c${i}" src="${petArt(p, 'attack')}" alt="" draggable="false">`).join('')}<div class="ct"><small>TEAM ULTIMATE</small><b>합동 필살!</b><span>${v.element_bonus > 1 ? '서로 다른 속성 3마리 +30%' : '모두의 정답으로 게이지가 찼어요'}</span></div>`;
  retrig(box, 'go');
  $id('dgs-dim')?.classList.add('on');
  later(() => { box.classList.remove('go'); $id('dgs-dim')?.classList.remove('on'); }, 1500);
}
function play(e) {
  if (!$id('dgs')) return;
  const myId = D.A.data.profile.id, v = D.view, fast = reduced();
  switch (e.type) {
    case 'floor':
      banner(e.boss ? '보스 등장! 킬러 골렘' : `${e.floor}층`, e.boss ? '기말고사 지옥의 끝' : e.bg, e.boss ? 'red' : '');
      sfx(e.boss ? 'boss' : 'door');
      if (e.boss) { later(() => { pose('roar', 1300); sfx('boss-roar', { gain: .8 }); shake(true); }, 600); }
      break;
    case 'answered':
      if (e.pid !== myId) break;
      if (e.kind === 'spell') {
        if (D.spell) D.spell.done = true;
        document.querySelectorAll('.dgs-tile').forEach(x => { x.disabled = true; });
        const slots = $id('dgs-slots');
        if (e.right) { slots?.classList.add('done'); sfx('spell-done'); }
        else {
          slots?.querySelectorAll('i').forEach((el, i) => { if (!el.classList.contains('f')) { el.textContent = e.word?.[i] || ''; el.className = 'miss'; } });
          sfx('wrong');
        }
      } else {
        const opts = document.querySelectorAll('.dgs-opt');
        opts[e.answer]?.classList.add('right');
        if (!e.right && D.picked !== null) opts[D.picked]?.classList.add('wrong');
        opts.forEach(x => { x.disabled = true; });
        sfx(e.right ? 'correct' : 'wrong');
      }
      if (e.timeout) document.querySelector('.dgs-q')?.classList.add('late');
      if (e.right) {
        const me = playerOf(myId), rank = comboRank((me?.combo || 0) + 1);
        if (rank) say(D.mode === 'land' ? 300 : 120, D.mode === 'land' ? 96 : 300, rank[1], rank[2]);
      }
      break;
    case 'letter': {
      if (e.pid !== myId || !D.spell || D.spell.n !== e.n) break;
      const i = D.spell.queue.shift(), tile = i >= 0 ? document.querySelector(`.dgs-tile[data-i="${i}"]`) : null;
      tile?.classList.remove('wait');
      if (e.ok) { if (i >= 0) { D.spell.used.add(i); tile?.classList.add('used'); if (tile) tile.disabled = true; } sfx('type-ok', { rate: 1 + e.pos * .06, gain: .8 }); }
      else { retrig(tile || $id('dgs-slots'), 'no'); sfx('type-wrong', { gain: .7 }); }
      break;
    }
    case 'hit': hitShow(e, myId); break;
    case 'special':
      if (fast) banner('합동 필살!', '모두의 정답으로 게이지가 찼어요', 'gold'); else cutin(v);
      D.cutinUntil = Date.now() + (fast ? 300 : 1350);
      sfx('ult-riser', { gain: .9 });
      partyOrder(v).forEach((p, i) => { if (p.down || p.out) return; later(() => { retrig(petEl(p.id), 'lunge'); petFace(p.id, 'attack', 900); D.fx?.shoot(petCenter(p.id), monHit(false), p.element || 'star', 420, null, -60 - i * 20); }, (fast ? 300 : 1350) - 380 + i * 60); });
      break;
    case 'break':
      banner('브레이크!', '핵이 부서졌어요', 'gold');
      later(() => { const b = $id('dgs-break'); if (b) { const at = monHit(false); Object.assign(b.style, { left: `${at.x + 30}px`, top: `${at.y + 10}px` }); retrig(b, 'go'); } sfx('crit'); }, 120);
      break;
    case 'struck': {
      const el = petEl(e.pid), m = v?.monster;
      pose('windup', 180);
      later(() => {
        pose(D.markFail === e.pid ? 'attack2' : 'attack', 520);
        retrig($id('dgs-mon'), 'slam');
        later(() => {
          if (!$id('dgs')) return;
          const at = petCenter(e.pid);
          D.fx?.slash(at.x, at.y);
          if (m?.boss || D.markFail === e.pid) D.fx?.dust(at.x - 70, at.x + 70, L().foot);
          retrig(el, 'hurt'); petFace(e.pid, 'hurt', 1000);
          stack(at.x - 6, at.y - 40, [{ text: `-${num(e.damage)}`, cls: 'hurt' }]);
          sfx(m?.boss ? 'boss-slam' : 'smash', { gain: m?.boss ? .9 : .8, vary: .05 });
          sfx('hurt', { gain: .45, at: .1 });
          shake(!!m?.boss || D.markFail === e.pid);
          if (e.pid === myId) flash('red');
          D.markFail = null;
        }, 160);
      }, 180);
      break;
    }
    case 'down': say(petCenter(e.pid).x - 30, L().foot - 150, '기절', '#e9d5ff'); sfx('faint'); break;
    case 'revive': {
      const at = petCenter(e.pid);
      D.fx?.heal(at.x, at.y);
      stack(at.x, at.y - 40, [{ text: `+${num(e.hp)}`, cls: 'heal' }]);
      petFace(e.pid, 'happy', 900);
      sfx('revive');
      if (e.by) banner(`${nameOf(e.pid)} 부활!`, `${nameOf(e.by)}의 3연속 정답`, 'green');
      break;
    }
    case 'mark':
      banner('✏️ 빨간펜 채점!', e.pid === myId ? '내가 표적! 다음 3문제를 연속으로 맞혀야 막아요' : `${nameOf(e.pid)} 표적 · 3문제 연속 정답이면 막아요`, 'red');
      pose('skill', 1000);
      sfx('boss-charge', { dur: 1.6, gain: .8 });
      if (e.pid === myId) sfx('warn-beep', { at: .3 });
      break;
    case 'mark_blocked': {
      const el = petEl(e.pid);
      retrig(el, 'shield');
      sfx('shield-block');
      banner('채점 방어!', `${nameOf(e.pid)}의 3연속 정답`, 'blue');
      pose('hurt', 500);
      break;
    }
    case 'mark_failed': D.markFail = e.pid; banner('채점 실패!', '빨간펜이 크게 내려쳐요', 'red'); break;
    case 'core_open': banner('💠 핵 노출!', `모두 함께 ${e.goal}문제를 맞히면 브레이크`, 'gold'); sfx('boss', { gain: .7 }); pose('roar', 900); break;
    case 'core_close': if (!e.broke) banner('핵이 닫혔어요', '잠시 뒤 다시 열려요'); break;
    case 'boss_phase': banner(`${e.stage}페이즈 · ${e.name}`, e.stage === 3 ? '가슴의 핵을 노려요 · 제한 시간 −1초' : '킬러 골렘이 화가 났어요', 'red'); pose('roar', 1300); sfx('boss-roar', { gain: .85 }); flash('red'); shake(true); break;
    case 'defeat': {
      const at = monHit(false);
      pose('down');
      D.fx?.impact('star', at.x, at.y, true);
      sfx(e.boss ? 'boss-down' : 'burst', { gain: e.boss ? .9 : .7 });
      if (e.boss) { D.fx?.confetti(); later(() => sfx('fanfare-epic'), 1300); }
      break;
    }
    case 'rest': banner('층 클리어!', '6초 휴식', 'green'); sfx('clear', { gain: .7 }); break;
    case 'forfeit': banner(`${nameOf(e.pid)} 포기`, '연결이 90초 넘게 끊겼어요'); break;
    case 'emote': { const el = petEl(e.pid); if (el) { const bubble = document.createElement('i'); bubble.className = 'dg-bubble'; bubble.textContent = EMOTES[e.emote] || ''; el.appendChild(bubble); setTimeout(() => bubble.remove(), 1800); } break; }
  }
}
const nameOf = pid => { const p = D.view?.players.find(x => x.id === pid); return p ? (p.id === D.A.data.profile.id ? '나' : p.name) : ''; };

// 무대를 떠날 때: 효과 캔버스를 멈추고 창 크기 · 키보드 듣기를 뗀다.
function leaveStage() {
  D.fx?.stop(); D.fx = null;
  if (D.onResize) removeEventListener('resize', D.onResize);
  if (D.onKey) removeEventListener('keydown', D.onKey);
  D.onResize = D.onKey = null;
}

/* ---------- 결과 ---------- */
function resultScreen(v) {
  if (D.phase === 'result') return;
  D.phase = 'result';
  cancelAnimationFrame(D.raf);
  leaveStage();
  if (!v.result?.cleared) playSound('fail');
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
