import { api, esc, num, icon, toast, modal, buttonBusy, rangeLabel, $, $$ } from './ui.js';
import { avatar } from './character.js';
import { coin } from './emblems.js';
import { getRanges, periodFolders } from './student.js';
import { playSound, unlockSound, preloadSound } from './sound.js';
import { FISH, RARITY, kgText } from './fishing-rules.js';
import { fishPic } from './fishing-art.js';

// V13.149 교실 게임 — 선생님: 만들기 창과 교실 TV 화면(전체 화면). TV는 방에 선생님 입장표로 WebSocket 연결한다.
// TV에는 번호 · 들어온 학생 · 실시간 순위 막대 · 소식(훔치기 · 막기 · 대박 · 큰 물고기)이 나오고, 마지막 1분은 순위를 가렸다가 끝에 공개한다.

let T = null;
const EVENT = { golden: ['🌟 황금 시간!', '45초 동안 금화 상자가 두 배'], raid: ['☠️ 해적선 습격!', '방패 없는 친구는 금화 10%를 뺏겨요'], storm: ['🌪️ 보물 폭풍!', '45초 동안 상자가 5개'] };
const root = () => document.getElementById('app');
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)');
const reduced = () => REDUCED.matches;
const sfx = (key, opts) => { try { playSound(key, { always: true, ...opts }); } catch {} };
const serverNow = () => Date.now() + (T?.offset || 0);
const clock = ms => `${Math.floor(Math.max(0, ms) / 60000)}:${String(Math.floor(Math.max(0, ms) / 1000) % 60).padStart(2, '0')}`;
function later(fn, ms) { const cur = T; const t = setTimeout(() => { if (T === cur && !cur.closing) fn(); }, ms); cur.timers.push(t); }

/* ---------- 만들기 ---------- */
export async function partyCreateModal(A, onOpen) {
  let open = null;
  try { open = (await api('/teacher/party')).party; } catch {}
  const middle = A.data.profile.active_division === 'middle';
  const targets = middle ? [['중2', '중2'], ['중3', '중3']] : [['고1', '고1 전체'], ['고1A', '고1A'], ['고1B', '고1B']];
  const close = modal(`<form id="pg-form" class="pg-form">
    <h2>🎮 교실 게임 열기</h2>
    <p class="tiny muted">교실 TV에 띄우고, 학생은 폰의 <b>야차전 → 게임 → 교실 게임 참가</b>에 번호 4자리를 넣어요.</p>
    ${open ? `<div class="pg-open"><span>열려 있는 게임 · 번호 <b>${esc(open.code)}</b> · ${open.kind === 'fish' ? '반 전체 낚시' : '보물 사냥'}</span><button type="button" class="btn small primary" data-pg-reopen>TV 다시 열기</button></div>` : ''}
    <div class="pg-kinds">
      <label class="pg-kind"><input type="radio" name="kind" value="treasure" checked><span><b>💰 보물 사냥</b><small>맞히면 상자 3개 중 하나! 금화 · 2배 · 훔치기 · 방패 · 몬스터… 역전이 잘 나는 시끌벅적 모드</small></span></label>
      <label class="pg-kind"><input type="radio" name="kind" value="fish"><span><b>🎣 반 전체 낚시</b><small>맞히면 물고기! 빨리 맞힐수록 큰 물고기, 반 정답 40개마다 물고기 떼. 남을 방해하지 않는 편안한 모드</small></span></label>
    </div>
    <div class="form-columns">
      <label class="field"><span>대상</span><select name="class_name" id="pg-target">${targets.map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}</select></label>
      <label class="field"><span>게임 시간</span><select name="minutes"><option value="5">5분</option><option value="8" selected>8분</option><option value="10">10분</option></select></label>
    </div>
    <label class="pg-steal"><input type="checkbox" name="steal" checked><span><b>훔치기 · 바꾸기 켜기</b><small>끄면 금화 · 배수 · 꽝 · 몬스터만 나와요(보물 사냥만). 같은 친구는 한 판에 2번까지만 훔칠 수 있어요.</small></span></label>
    <label class="pg-steal pg-teams"><input type="checkbox" name="teams"><span><b>팀전으로 하기 (보물 사냥만)</b><small>반을 A · B 팀으로 나눠요. 훔치기 · 바꾸기는 상대 팀만 노릴 수 있고, 팀 금화 합계가 큰 팀이 이겨요(코인 +3). 같은 반 친구끼리 뺏는 게 부담스러울 때 좋아요.</small></span></label>
    <div class="step-label">단어 범위</div>
    <div class="teacher-range" id="pg-ranges"></div>
    <div id="pg-error" class="form-error" role="alert"></div>
    <button class="btn primary full" type="submit">TV에 게임 열기</button>
  </form>`, '교실 게임 열기');
  const form = $('#pg-form');
  const fill = () => {
    const target = $('#pg-target').value, info = getRanges(A, A.school, middle ? target : null);
    $('#pg-ranges').innerHTML = periodFolders(A, info.codes, { wrap: 'teacher-range', bare: true, selected: info.codes.slice(0, 2), count: code => info.words.filter(w => w.range_code === code).length, option: code => `<label class="range-option"><input type="checkbox" name="range" value="${esc(code)}" ${info.codes.indexOf(code) < 2 ? 'checked' : ''}><span>${esc(middle ? `${code}과` : rangeLabel(A.school, code))}<small>${info.words.filter(w => w.range_code === code).length}개 단어</small></span></label>` }) || '<p class="tiny muted">단어 범위가 없어요.</p>';
  };
  $('#pg-target').onchange = fill;
  form.addEventListener('change', e => { if (e.target.name === 'kind') form.querySelectorAll('.pg-steal').forEach(x => x.classList.toggle('off', e.target.value === 'fish')); });
  fill();
  form.querySelector('[data-pg-reopen]')?.addEventListener('click', () => { close(); onOpen(open); });
  form.onsubmit = async event => {
    event.preventDefault();
    const button = $('[type="submit"]', form), values = Object.fromEntries(new FormData(form));
    const ranges = $$('input[name="range"]:checked', form).map(x => x.value);
    if (!ranges.length) return $('#pg-error').textContent = '단어 범위를 골라주세요.';
    buttonBusy(button);
    try {
      const r = await api('/teacher/party', { kind: values.kind, class_name: values.class_name, minutes: Number(values.minutes), steal: !!values.steal, teams: !!values.teams && values.kind === 'treasure', range_codes: ranges });
      close();
      onOpen(r.party);
    } catch (err) { $('#pg-error').textContent = err.message; buttonBusy(button, false); }
  };
}

/* ---------- TV ---------- */
export function openPartyTv(A, party, exit) {
  closeAll();
  T = { A, party, exit, timers: [], offset: 0, view: null, feedSeen: 0, bars: new Map() };
  A.screen = 'party-tv';
  root().innerHTML = `<div class="ptv ${party.kind}"><div class="ptv-bg" aria-hidden="true"></div>
    <header class="ptv-top"><button type="button" class="ptv-x" data-tv="exit" aria-label="나가기">${icon('back')}</button><strong>${party.kind === 'fish' ? '🎣 반 전체 낚시' : '💰 보물 사냥'}</strong><span class="ptv-label">${esc(party.label || '')}</span><span class="ptv-clock" id="ptv-clock"></span><button type="button" class="ptv-full" data-tv="full">전체 화면</button></header>
    <main class="ptv-main" id="ptv-main"><div class="ptv-loading">게임 방에 연결하는 중…</div></main>
    <div class="ptv-feed" id="ptv-feed" aria-live="polite"></div></div>`;
  root().onclick = onClick;
  window.scrollTo(0, 0);
  preloadSound(['fanfare-epic', 'fanfare-legend', 'coins', 'shield-block', 'boss-roar', 'clear']);
  connect();
}
function closeAll() { if (!T) return; T.closing = true; T.timers.forEach(clearTimeout); clearInterval(T.ticker); clearInterval(T.pinger); try { T.ws?.close(); } catch {} }
async function leave() { const exit = T?.exit; closeAll(); root().onclick = null; T = null; if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {}); await exit?.(); }
const main = html => { const el = document.getElementById('ptv-main'); if (el) el.innerHTML = html; };

function connect() {
  const ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/api/party/ws/${T.party.id}?ticket=${encodeURIComponent(T.party.tv_ticket)}`);
  T.ws = ws;
  ws.onopen = () => { T.retries = 0; };
  ws.onmessage = event => { let msg; try { msg = JSON.parse(event.data); } catch { return; } onMessage(msg); };
  ws.onclose = event => {
    if (!T || T.ws !== ws || T.closing) return;
    if (event.code === 4000) { main('<div class="ptv-loading">다른 화면에서 이 게임 TV를 열었어요.</div>'); T.closing = true; return; }
    if (T.view?.phase === 'ended') return;
    T.retries = (T.retries || 0) + 1;
    later(connect, Math.min(5000, 600 * T.retries));
  };
  clearInterval(T.pinger); T.pinger = setInterval(() => send({ type: 'ping' }), 20000);
  clearInterval(T.ticker); T.ticker = setInterval(tickClock, 250);
}
const send = msg => { try { if (T?.ws?.readyState === 1) T.ws.send(JSON.stringify(msg)); } catch {} };
function onClick(event) {
  const b = event.target.closest('[data-tv]');
  if (!b || !T) return;
  unlockSound();
  const act = b.dataset.tv;
  if (act === 'exit') return leave();
  if (act === 'full') { const el = document.documentElement; return document.fullscreenElement ? document.exitFullscreen?.() : el.requestFullscreen?.().catch(() => {}); }
  if (act === 'start') { b.disabled = true; sfx('door'); return send({ type: 'start' }); }
  if (act === 'end') { if (b.dataset.sure) { b.disabled = true; return send({ type: 'end' }); } b.dataset.sure = '1'; b.textContent = '한 번 더 누르면 끝내요'; return; }
}
function onMessage(msg) {
  if (typeof msg.now === 'number') T.offset = msg.now - Date.now();
  if (msg.type === 'view') { const before = T.view; T.view = msg.view; return draw(before); }
  if (msg.type === 'events') return msg.events.forEach(onEvent);
  if (msg.type === 'error') toast(msg.error);
}
function tickClock() {
  const v = T?.view, el = document.getElementById('ptv-clock');
  if (!v || !el) return;
  if (v.phase !== 'play') { el.textContent = ''; return; }
  const left = v.end_at - serverNow();
  el.textContent = clock(left);
  el.classList.toggle('hurry', left < 60000);
  const bar = document.getElementById('ptv-timebar');
  if (bar) bar.style.transform = `scaleX(${Math.max(0, Math.min(1, left / (v.minutes * 60000)))})`;
}

/* ---------- 그리기 ---------- */
function draw(before) {
  const v = T.view;
  if (v.phase === 'lobby') return lobby(v, before);
  if (v.phase === 'ended') return ended(v, before);
  return play(v, before);
}
function lobby(v, before) {
  const fresh = new Set((v.lobby || []).map(x => x.id).filter(id => !(before?.lobby || []).some(y => y.id === id)));
  main(`<section class="ptv-lobby">
    <div class="ptv-join">
      <p>폰에서 <b>야차전 → 게임 → 교실 게임 참가</b></p>
      <div class="ptv-code" aria-label="방 번호 ${esc(v.code)}">${[...String(v.code)].map(d => `<span>${esc(d)}</span>`).join('')}</div>
      <p class="ptv-sub">${v.kind === 'fish' ? '맞히면 물고기! 빨리 맞힐수록 큰 물고기 · 반 정답 40개마다 물고기 떼' : `맞히면 보물 상자! ${v.teams ? '팀전! ' : ''}${v.steal ? '금고 털이 · 도난 경보 · 방패까지' : '금화 · 배수 · 대박'} · ${v.minutes}분`}</p>
    </div>
    <div class="ptv-crowd">${(v.lobby || []).map(x => `<span class="ptv-kid${fresh.has(x.id) ? ' new' : ''}">${x.pet ? avatar(x.pet.key, { form: x.pet.form, size: 'mini' }) : ''}<b>${esc(x.name)}</b></span>`).join('') || '<p class="ptv-empty">학생을 기다리는 중…</p>'}</div>
    <div class="ptv-actions"><span><b>${num(v.players)}</b>명 들어왔어요</span><button type="button" class="ptv-start" data-tv="start" ${v.players ? '' : 'disabled'}>게임 시작!</button></div>
  </section>`);
  if (fresh.size && before) sfx('pop', { rate: 1.1 + Math.random() * .3 });
}
function play(v, before) {
  const fish = v.kind === 'fish';
  if (!document.getElementById('ptv-board') || before?.phase !== 'play') {
    main(`<section class="ptv-play">
      <div class="ptv-timebar"><i id="ptv-timebar"></i></div>
      <div class="ptv-stats"><span>참가 <b id="ptv-n">${num(v.players)}</b>명</span><span>반 전체 정답 <b id="ptv-right">${num(v.right_total)}</b></span><span class="ptv-code-mini">번호 <b>${esc(v.code)}</b></span><button type="button" class="ptv-end" data-tv="end">끝내기</button></div>
      <div class="ptv-frenzy" id="ptv-frenzy" hidden>🐟🐟🐟 물고기 떼! 🐟🐟🐟</div>
      <div class="ptv-event" id="ptv-event" hidden></div>
      <div class="ptv-teams" id="ptv-teams" hidden></div>
      <div class="ptv-board" id="ptv-board"></div>
      <div class="ptv-hidden" id="ptv-hidden" hidden><b>마지막 1분!</b><span>순위는 끝나고 공개해요 🤫</span></div>
    </section>`);
    T.bars = new Map();
  }
  const n = document.getElementById('ptv-n'); if (n) n.textContent = num(v.players);
  const r = document.getElementById('ptv-right'); if (r) r.textContent = num(v.right_total);
  const fz = document.getElementById('ptv-frenzy'); if (fz) fz.hidden = !(v.frenzy_until > serverNow());
  const evEl = document.getElementById('ptv-event');
  if (evEl) {
    const info = v.event && EVENT[v.event.kind];
    evEl.hidden = !info;
    if (info && evEl.dataset.kind !== v.event.kind) { evEl.dataset.kind = v.event.kind; evEl.className = `ptv-event ${v.event.kind}`; evEl.innerHTML = `<b>${info[0]}</b><span>${info[1]}</span>`; }
    if (!info) evEl.dataset.kind = '';
  }
  const tmEl = document.getElementById('ptv-teams');
  if (tmEl) {
    tmEl.hidden = !v.teams;
    if (v.teams) {
      const t = v.team_gold, total = t ? Math.max(1, t[0].gold + t[1].gold) : 1;
      tmEl.innerHTML = t ? `<span class="tA"><b>🔴 A팀</b><em>${num(t[0].gold)}</em></span><i class="bar"><u style="--p:${(t[0].gold / total * 100).toFixed(1)}%"></u></i><span class="tB"><em>${num(t[1].gold)}</em><b>🔵 B팀</b></span>` : '<span class="tA"><b>🔴 A팀</b></span><i class="hid">마지막 1분! 점수는 끝나고 공개해요 🤫</i><span class="tB"><b>🔵 B팀</b></span>';
    }
  }
  const hid = document.getElementById('ptv-hidden'), board = document.getElementById('ptv-board');
  if (hid) hid.hidden = !v.hidden;
  board.classList.toggle('masked', !!v.hidden);
  if (v.hidden && !before?.hidden) sfx('warn-beep');
  // 순위 막대: 학생마다 한 줄을 두고 위치(translateY) · 길이만 바꾼다(줄이 미끄러지며 순위가 바뀐다).
  const max = Math.max(1, ...v.top.map(x => x.score || 0));
  const ROW = 58;
  board.style.height = `${v.top.length * ROW}px`;
  const seen = new Set();
  v.top.forEach((x, i) => {
    seen.add(x.id);
    let row = T.bars.get(x.id);
    if (!row) {
      row = document.createElement('div');
      row.className = 'ptv-row';
      row.innerHTML = `<i class="ptv-rank"></i><span class="ptv-pet">${x.pet ? avatar(x.pet.key, { form: x.pet.form, size: 'mini' }) : ''}</span><b class="ptv-name">${esc(x.name)}</b><span class="ptv-bar"><u></u></span><em class="ptv-score"></em><span class="ptv-sh"></span>`;
      board.appendChild(row);
      T.bars.set(x.id, row);
    }
    row.style.transform = `translateY(${i * ROW}px)`;
    row.className = `ptv-row${!v.hidden && i < 3 ? ` top${i + 1}` : ''}${x.team ? ` team-${x.team}` : ''}${v.bounty === x.id ? ' bounty' : ''}`;
    row.querySelector('.ptv-rank').textContent = v.hidden ? '?' : i + 1;
    row.querySelector('.ptv-bar u').style.transform = `scaleX(${v.hidden ? .5 : Math.max(.02, x.score / max)})`;
    const score = v.hidden ? '???' : fish ? kgText(x.score) : num(x.score);
    const s = row.querySelector('.ptv-score');
    if (s.textContent !== score) { s.textContent = score; s.classList.remove('bump'); void s.offsetWidth; s.classList.add('bump'); }
    row.querySelector('.ptv-sh').textContent = !fish && !v.hidden ? `${v.bounty === x.id ? '💰' : ''}${x.shield ? '🛡️'.repeat(x.shield) : ''}` : '';
  });
  for (const [id, row] of T.bars) if (!seen.has(id)) { row.remove(); T.bars.delete(id); }
  for (const f of v.feed || []) if (f.n > T.feedSeen) { T.feedSeen = f.n; if (before) feedPop(f); }
}
// 소식 한 줄(아래에서 올라와 몇 초 뒤 사라진다). 큰 소식은 화면 가운데에 크게.
function feedPop(f) {
  const host = document.getElementById('ptv-feed');
  if (!host) return;
  let html = '', big = false, cls = f.kind;
  if (f.kind === 'heist') { html = `🚨 <b>${esc(f.name)}</b>가 <b>${esc(f.vname)}</b>의 금고를 노려요!${f.bounty ? ' <em>💰 현상금 1등!</em>' : ''}`; big = !!f.bounty; }
  else if (f.kind === 'heistfail') html = `😅 <b>${esc(f.name)}</b>의 금고 털이 실패!`;
  else if (f.kind === 'peekcaught') html = `👀 <b>${esc(f.name)}</b>가 상자를 엿보다 들켰어요! <em>−${num(f.amount)}</em>`;
  else if (f.kind === 'event') { const info = EVENT[f.event]; if (!info) return; html = f.event === 'raid' ? `☠️ <b>해적선 습격!</b> 방패 없는 ${num(f.hit)}명이 금화 ${num(f.total)}를 뺏겼어요` : `<b>${info[0]}</b> ${info[1]}`; big = true; }
  else if (f.kind === 'steal') html = `🦹 <b>${esc(f.name)}</b>가 <b>${esc(f.vname)}</b>의 금고를 털었어요! ${f.pct}% <em>${coin()}${num(f.amount)}${f.bounty ? ` +현상금 ${num(f.bounty)}` : ''}</em>`;
  else if (f.kind === 'block') html = f.defended ? `🚨 <b>${esc(f.vname)}</b>가 경보에 맞혀 <b>${esc(f.name)}</b>의 금고 털이를 막았어요!` : `🛡️ <b>${esc(f.vname)}</b>가 <b>${esc(f.name)}</b>의 훔치기를 막았어요!`;
  else if (f.kind === 'swap') html = `🔄 <b>${esc(f.name)}</b>가 <b>${esc(f.vname)}</b>와 금화를 통째로 바꿨어요!`;
  else if (f.kind === 'jackpot') { html = `💎 <b>${esc(f.name)}</b> 대박 상자! <em>+${num(f.amount)}</em>`; big = true; }
  else if (f.kind === 'monster') html = `👹 <b>${esc(f.name)}</b>가 몬스터에게 금화 ${num(f.amount)}를 빼앗겼어요`;
  else if (f.kind === 'lead') html = `👑 <b>${esc(f.name)}</b> 1등 탈환!`;
  else if (f.kind === 'fish') { html = `<span class="ptv-feed-fish">${fishPic(f.key)}</span><b>${esc(f.name)}</b> ${esc(RARITY[f.rarity].name)} <b>${esc(FISH[f.key]?.name || '')}</b> <em>${kgText(f.kg)}</em>`; big = f.rarity === 'legend' || f.rarity === 'golden' || f.rarity === 'epic'; }
  else if (f.kind === 'frenzy') { html = '🐟🐟 물고기 떼 등장! 20초 동안 큰 물고기!'; big = true; }
  else if (f.kind === 'start') html = '🚀 게임 시작!';
  else return;
  const el = document.createElement('div');
  el.className = `ptv-news ${cls}${big ? ' big' : ''}`;
  el.innerHTML = html;
  host.appendChild(el);
  while (host.children.length > 4) host.firstElementChild.remove();
  sfx(f.kind === 'heist' ? 'warn-beep' : f.kind === 'heistfail' ? 'fail' : f.kind === 'event' ? (f.event === 'raid' ? 'boss-roar' : f.event === 'storm' ? 'ult-riser' : 'fanfare-basic') : f.kind === 'steal' || f.kind === 'swap' ? 'slash' : f.kind === 'block' ? 'shield-block' : f.kind === 'jackpot' ? 'fanfare-epic' : f.kind === 'lead' ? 'combo' : f.kind === 'frenzy' ? 'boss-roar' : f.kind === 'fish' ? (big ? 'fanfare-legend' : 'pop') : 'pop', { gain: .8 });
  later(() => { el.classList.add('out'); later(() => el.remove(), 400); }, big ? 4200 : 3200);
}
function onEvent(e) { if (e.kind === 'end') sfx('clear'); }

/* ---------- 끝: 시상대 ---------- */
function ended(v, before) {
  const fish = v.kind === 'fish', top = v.top.slice(0, 3), rest = v.top.slice(3, 10);
  const podium = [top[1], top[0], top[2]].map((x, k) => x ? `<div class="ptv-step s${[2, 1, 3][k]}" style="--d:${[1, 2, 0][k] * 700 + 600}ms"><span class="ptv-step-pet">${x.pet ? avatar(x.pet.key, { form: x.pet.form, expression: 'cheer' }) : ''}</span><b>${esc(x.name)}</b><em>${fish ? kgText(x.score) : `${coin()}${num(x.score)}`}</em><i>${[2, 1, 3][k]}</i></div>` : '<div class="ptv-step empty"></div>').join('');
  main(`<section class="ptv-end">
    <h1>${fish ? '🎣 오늘의 낚시왕' : '💰 오늘의 보물왕'}</h1>
    ${v.teams && v.team_gold ? `<div class="ptv-team-end"><span class="tA${v.team_gold[0].gold > v.team_gold[1].gold ? ' win' : ''}">🔴 A팀 <b>${num(v.team_gold[0].gold)}</b></span><i>${v.team_gold[0].gold === v.team_gold[1].gold ? '무승부' : v.team_gold[0].gold > v.team_gold[1].gold ? 'A팀 승리!' : 'B팀 승리!'}</i><span class="tB${v.team_gold[1].gold > v.team_gold[0].gold ? ' win' : ''}">🔵 B팀 <b>${num(v.team_gold[1].gold)}</b></span></div>` : ''}
    <div class="ptv-podium">${podium}</div>
    ${rest.length ? `<ol class="ptv-rest">${rest.map((x, k) => `<li><i>${k + 4}</i><b>${esc(x.name)}</b><em>${fish ? kgText(x.score) : num(x.score)}</em></li>`).join('')}</ol>` : ''}
    ${v.awards?.length ? `<div class="ptv-awards">${v.awards.map(a => `<div class="ptv-award ${a.key}">${a.fish ? `<span class="ptv-award-fish">${fishPic(a.fish)}</span>` : ''}<small>${esc(a.title)}</small><b>${esc(a.name)}</b><span>${esc(a.value)}</span></div>`).join('')}</div>` : ''}
    <p class="ptv-foot">진짜 코인은 <b>맞힌 문제 수</b>대로 받고, 1~3등은 보너스! (5문제 이상 · 하루 3판까지)</p>
    <button type="button" class="ptv-start" data-tv="exit">닫기</button>
  </section>`);
  if (before?.phase !== 'ended') { later(() => sfx('fanfare-epic'), 1900); confetti(); }
}
function confetti() {
  if (reduced()) return;
  const layer = document.createElement('div');
  layer.className = 'ptv-confetti';
  layer.innerHTML = Array.from({ length: 80 }, () => `<i style="--x:${Math.random() * 100}%;--d:${1800 + Math.random() * 1600}ms;--delay:${1800 + Math.random() * 1200}ms;--h:${Math.floor(Math.random() * 360)};--r:${Math.floor(Math.random() * 720)}deg"></i>`).join('');
  document.querySelector('.ptv')?.appendChild(layer);
  later(() => layer.remove(), 6000);
}
