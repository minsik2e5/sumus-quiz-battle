(() => {
  'use strict';

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const saved = {
    get(key) { try { return localStorage.getItem(key); } catch { return null; } },
    set(key, value) { try { localStorage.setItem(key, value); } catch { /* 저장 안 되는 브라우저 */ } },
    del(key) { try { localStorage.removeItem(key); } catch { /* 무시 */ } }
  };

  const state = {
    token: saved.get('study.token'),
    me: null,
    className: '',
    view: saved.get('study.view') === 'all' ? 'all' : 'class',
    members: new Map(),
    cards: new Map(),
    notices: [],
    offset: 0,
    ws: null,
    retry: 0,
    retryTimer: null,
    muted: saved.get('study.muted') === '1',
    draft: null,
    avatarReturn: 'room',
    wakeLock: null
  };

  // ---------- 유틸 ----------

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function pad(n) { return String(n).padStart(2, '0'); }

  function fmt(ms) {
    const s = Math.max(0, Math.floor(ms / 1000));
    return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
  }

  function fmtShort(ms) {
    const m = Math.floor(ms / 60000);
    if (m < 60) return `${m}분`;
    return `${Math.floor(m / 60)}시간 ${m % 60}분`;
  }

  function ago(at) {
    const m = Math.floor((serverNow() - at) / 60000);
    if (m < 1) return '방금';
    if (m < 60) return `${m}분 전`;
    return `${Math.floor(m / 60)}시간 전`;
  }

  function serverNow() { return Date.now() + state.offset; }

  function liveMs(m) {
    return m.baseMs + (m.since ? Math.max(0, serverNow() - m.since) : 0);
  }

  function show(id) {
    for (const el of $$('.screen')) el.hidden = el.id !== id;
    window.scrollTo(0, 0);
  }

  let toastTimer = null;
  function toast(text, ms = 2200) {
    const el = $('#toast');
    el.textContent = text;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.hidden = true; }, ms);
  }

  async function api(path, { method = 'GET', body } = {}) {
    const headers = { 'Content-Type': 'application/json' };
    if (state.token) headers.Authorization = `Bearer ${state.token}`;
    const res = await fetch(path, { method, headers, body: body ? JSON.stringify(body) : undefined });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(data.error || '문제가 생겼어요. 다시 해 주세요.');
      err.status = res.status;
      throw err;
    }
    return data;
  }

  // ---------- 소리 ----------

  let audio = null;
  function ding(kind) {
    if (state.muted) return;
    try {
      audio = audio || new (window.AudioContext || window.webkitAudioContext)();
      const notes = kind === 'start' ? [523, 659, 784] : [880, 1175];
      notes.forEach((freq, i) => {
        const o = audio.createOscillator();
        const g = audio.createGain();
        const t = audio.currentTime + i * 0.09;
        o.type = 'sine';
        o.frequency.value = freq;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.18, t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
        o.connect(g).connect(audio.destination);
        o.start(t);
        o.stop(t + 0.3);
      });
    } catch { /* 소리 못 내는 환경 */ }
  }

  function renderSound() {
    $('#btn-sound').textContent = state.muted ? '🔇' : '🔈';
  }

  // ---------- 화면 꺼짐 방지 ----------

  async function syncWakeLock() {
    const studying = state.me && state.me.status === 'study';
    try {
      if (studying && !state.wakeLock && 'wakeLock' in navigator && document.visibilityState === 'visible') {
        state.wakeLock = await navigator.wakeLock.request('screen');
        state.wakeLock.addEventListener('release', () => { state.wakeLock = null; });
      } else if (!studying && state.wakeLock) {
        await state.wakeLock.release();
        state.wakeLock = null;
      }
    } catch { /* 지원 안 하는 브라우저 */ }
  }

  // ---------- 입장 ----------

  function renderHero() {
    const sample = [
      { hair: 'short', hc: 0, top: 0, glasses: false, item: 'plant' },
      { hair: 'long', hc: 1, top: 1, glasses: false, item: 'none' },
      { hair: 'buns', hc: 0, top: 3, glasses: false, item: 'books' },
      { hair: 'bob', hc: 2, top: 4, glasses: true, item: 'cup' }
    ];
    $('#entry-hero').innerHTML = sample.map((a) => `<div class="mini">${Avatar.svg(a)}</div>`).join('');
  }

  let classLookup = 0;
  async function lookupClass() {
    const code = $('#in-code').value.trim();
    const el = $('#class-name');
    el.textContent = '';
    if (!/^\d{4}$/.test(code)) return;
    const seq = ++classLookup;
    try {
      const cls = await api(`/api/class?code=${encodeURIComponent(code)}`);
      if (seq === classLookup) el.textContent = `✔ ${cls.name}`;
    } catch (err) {
      if (seq === classLookup) el.textContent = err.message;
    }
  }

  function entryValues() {
    return {
      classCode: $('#in-code').value.trim(),
      name: $('#in-name').value.trim(),
      pin: $('#in-pin').value.trim()
    };
  }

  function validateEntry(v) {
    if (!/^\d{4}$/.test(v.classCode)) return '반 코드 4자리를 입력해 주세요.';
    if (!v.name) return '이름을 입력해 주세요.';
    if (!/^\d{4}$/.test(v.pin)) return 'PIN은 숫자 4자리예요.';
    return '';
  }

  async function enter(mode) {
    const v = entryValues();
    const problem = validateEntry(v);
    const errorEl = $('#entry-error');
    if (problem) { errorEl.textContent = problem; return; }
    errorEl.textContent = '';
    const buttons = $$('#entry-form button');
    buttons.forEach((b) => { b.disabled = true; });
    try {
      const body = mode === 'register' ? { ...v, avatar: Avatar.random() } : v;
      const data = await api(mode === 'register' ? '/api/register' : '/api/login', { method: 'POST', body });
      state.token = data.token;
      state.me = data.me;
      saved.set('study.token', data.token);
      saved.set('study.code', v.classCode);
      if (mode === 'register') openAvatarEditor('room-first');
      else openRoom();
    } catch (err) {
      errorEl.textContent = err.message;
    } finally {
      buttons.forEach((b) => { b.disabled = false; });
    }
  }

  function openEntry(message) {
    renderHero();
    const params = new URLSearchParams(location.search);
    $('#in-code').value = params.get('code') || saved.get('study.code') || '';
    $('#entry-error').textContent = message || '';
    show('screen-entry');
    lookupClass();
  }

  // ---------- 캐릭터 꾸미기 ----------

  function openAvatarEditor(returnTo) {
    state.avatarReturn = returnTo;
    state.draft = Avatar.normalize(state.me && state.me.avatar);
    $('#avatar-back').hidden = returnTo === 'room-first';
    renderAvatarEditor();
    show('screen-avatar');
  }

  function renderAvatarEditor() {
    const d = state.draft;
    $('#avatar-preview-card').innerHTML = `<div class="art">${Avatar.svg(d)}</div>`;
    const chips = (key, list) => list.map((o) => `<button class="chip${d[key] === o.id ? ' on' : ''}" data-key="${key}" data-val="${o.id}">${o.label}</button>`).join('');
    const swatches = (key, colors) => colors.map((c, i) => `<button class="swatch${d[key] === i ? ' on' : ''}" style="background:${c}" data-key="${key}" data-val="${i}" aria-label="색 ${i + 1}"></button>`).join('');
    $('#avatar-options').innerHTML = `
      <div class="opt-group"><h4>머리 모양</h4><div class="opt-row">${chips('hair', Avatar.HAIR)}</div></div>
      <div class="opt-group"><h4>머리 색</h4><div class="opt-row">${swatches('hc', Avatar.HAIR_COLORS)}</div></div>
      <div class="opt-group"><h4>옷 색</h4><div class="opt-row">${swatches('top', Avatar.TOPS)}</div></div>
      <div class="opt-group"><h4>안경</h4><div class="opt-row">${chips('glasses', [{ id: false, label: '없음' }, { id: true, label: '있음' }])}</div></div>
      <div class="opt-group"><h4>책상 소품</h4><div class="opt-row">${chips('item', Avatar.ITEMS)}</div></div>`;
  }

  function onAvatarOption(e) {
    const btn = e.target.closest('[data-key]');
    if (!btn) return;
    const key = btn.dataset.key;
    let val = btn.dataset.val;
    if (key === 'hc' || key === 'top') val = Number(val);
    if (key === 'glasses') val = val === 'true';
    state.draft = Avatar.normalize({ ...state.draft, [key]: val });
    renderAvatarEditor();
  }

  async function saveAvatar() {
    const btn = $('#avatar-save');
    btn.disabled = true;
    try {
      const data = await api('/api/me/avatar', { method: 'POST', body: { avatar: state.draft } });
      state.me = { ...state.me, ...data.me };
      openRoom();
      if (state.avatarReturn === 'room-first') toast('환영해요! ▶ 버튼을 누르면 공부 시간이 흘러가요');
    } catch (err) {
      toast(err.message);
      if (err.status === 401) logout();
    } finally {
      btn.disabled = false;
    }
  }

  // ---------- 공부방 ----------

  function openRoom() {
    show('screen-room');
    renderTabs();
    renderSound();
    if (!state.ws) connect();
  }

  function connect() {
    clearTimeout(state.retryTimer);
    const ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`);
    state.ws = ws;
    ws.onopen = () => {
      state.retry = 0;
      ws.send(JSON.stringify({ t: 'auth', token: state.token, view: state.view }));
    };
    ws.onmessage = (e) => {
      let msg;
      try { msg = JSON.parse(e.data); } catch { return; }
      onMessage(msg);
    };
    ws.onclose = (e) => {
      if (state.ws !== ws) return;
      state.ws = null;
      if (e.code === 4001 || !state.token) return;
      $('#conn').hidden = false;
      const delay = Math.min(15000, 800 * 2 ** state.retry++);
      state.retryTimer = setTimeout(() => { if (!state.ws && state.token) connect(); }, delay);
    };
  }

  function sendWs(msg) {
    if (state.ws && state.ws.readyState === WebSocket.OPEN) {
      state.ws.send(JSON.stringify(msg));
      return true;
    }
    toast('연결 중이에요. 잠시만요!');
    return false;
  }

  function onMessage(msg) {
    switch (msg.t) {
      case 'welcome':
        $('#conn').hidden = true;
        state.offset = msg.serverNow - Date.now();
        state.me = msg.me;
        state.className = msg.className;
        state.view = msg.view;
        state.notices = msg.notices || [];
        state.members = new Map(msg.members.map((m) => [m.id, m]));
        state.cards.clear();
        $('#grid').innerHTML = '';
        renderTabs();
        renderNotices();
        renderGrid();
        renderMe();
        break;
      case 'member':
        state.members.set(msg.m.id, msg.m);
        renderGrid();
        break;
      case 'me': {
        const was = state.me && state.me.status;
        state.me = msg.me;
        if (was !== 'study' && msg.me.status === 'study') ding('start');
        renderMe();
        break;
      }
      case 'remove':
        state.members.delete(msg.id);
        renderGrid();
        break;
      case 'cheer':
        floatHearts(msg.to);
        if (state.me && msg.to === state.me.id) {
          toast(`${msg.fromName}님이 응원했어요 ❤️`);
          ding('cheer');
        }
        break;
      case 'notices':
        state.notices = msg.notices || [];
        renderNotices();
        break;
      case 'pong':
        state.offset = msg.serverNow - Date.now();
        break;
      case 'error':
        toast(msg.msg);
        break;
      case 'kicked':
        logout('선생님이 계정을 정리했어요. 다시 가입해 주세요.');
        break;
      case 'auth_failed':
        logout('다시 로그인해 주세요.');
        break;
      default:
        break;
    }
  }

  function renderTabs() {
    $('#room-name').textContent = state.view === 'all' ? '학원 전체 공부방' : (state.className || '우리 반') + ' 공부방';
    for (const tab of $$('.tab')) tab.classList.toggle('on', tab.dataset.view === state.view);
  }

  function renderNotices() {
    $('#notices').innerHTML = state.notices.map((n) => `<div class="notice"><b>📢 공지</b>${esc(n.text)}</div>`).join('');
  }

  const STATUS_ORDER = { study: 0, away: 1, rest: 2, offline: 3 };
  const BADGE = { study: '', away: '자리 비움', rest: '쉬는 중', offline: '오프라인' };

  function sortedMembers() {
    const meId = state.me && state.me.id;
    return Array.from(state.members.values()).sort((a, b) =>
      (b.id === meId) - (a.id === meId) || STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || a.name.localeCompare(b.name, 'ko'));
  }

  function renderGrid() {
    const grid = $('#grid');
    const list = sortedMembers();
    const keep = new Set(list.map((m) => m.id));
    for (const [id, el] of state.cards) {
      if (!keep.has(id)) { el.remove(); state.cards.delete(id); }
    }
    list.forEach((m, i) => {
      const el = cardFor(m);
      if (grid.children[i] !== el) grid.insertBefore(el, grid.children[i] || null);
    });
    let empty = $('.empty', grid);
    if (!list.length) {
      if (!empty) grid.insertAdjacentHTML('beforeend', '<p class="empty">아직 아무도 없어요. 먼저 공부를 시작해 볼까요?</p>');
    } else if (empty) empty.remove();
    const studying = list.filter((m) => m.status === 'study').length;
    $('#room-summary').innerHTML = state.view === 'all'
      ? `지금 학원 전체 <b>${studying}명</b> 공부 중 · 접속 ${list.length}명`
      : `지금 <b>${studying}명</b> 공부 중 · 우리 반 ${list.length}명`;
    if (!$('#screen-solo').hidden) renderSoloFriends();
  }

  function cardFor(m) {
    let el = state.cards.get(m.id);
    if (!el) {
      el = document.createElement('div');
      el.className = 'card';
      el.dataset.id = m.id;
      el.innerHTML = '<div class="art"></div><div class="card-top"><span class="timer"></span><span class="name"></span></div><span class="badge"></span>';
      state.cards.set(m.id, el);
    }
    const pose = m.status === 'study' ? 'study' : 'rest';
    const artKey = JSON.stringify(m.avatar) + pose;
    if (el.dataset.art !== artKey) {
      $('.art', el).innerHTML = Avatar.svg(m.avatar, { pose });
      el.dataset.art = artKey;
    }
    el.className = `card s-${m.status}${state.me && m.id === state.me.id ? ' me' : ''}`;
    $('.timer', el).textContent = fmt(liveMs(m));
    $('.name', el).textContent = m.name;
    const badge = $('.badge', el);
    badge.textContent = BADGE[m.status];
    badge.hidden = !BADGE[m.status];

    let bubble = $('.bubble', el);
    if (m.bubble) {
      if (!bubble) {
        bubble = document.createElement('div');
        bubble.className = 'bubble';
        el.appendChild(bubble);
      }
      bubble.innerHTML = `${esc(m.bubble.text)}<small>${ago(m.bubble.at)}</small>`;
      bubble.classList.toggle('old', serverNow() - m.bubble.at > 60 * 60 * 1000);
    } else if (bubble) bubble.remove();

    let hearts = $('.hearts', el);
    if (m.hearts > 0) {
      if (!hearts) {
        hearts = document.createElement('span');
        hearts.className = 'hearts';
        el.appendChild(hearts);
      }
      hearts.textContent = `♥ ${m.hearts}`;
    } else if (hearts) hearts.remove();
    return el;
  }

  function floatHearts(id) {
    const el = state.cards.get(id);
    if (!el) return;
    for (let i = 0; i < 4; i += 1) {
      const h = document.createElement('span');
      h.className = 'float-heart';
      h.textContent = ['❤️', '💖', '💗', '💕'][i];
      h.style.left = `${35 + Math.random() * 30}%`;
      h.style.top = '60%';
      h.style.setProperty('--dx', `${(Math.random() - 0.5) * 60}px`);
      h.style.animationDelay = `${i * 0.12}s`;
      el.appendChild(h);
      setTimeout(() => h.remove(), 1700);
    }
  }

  function renderMe() {
    if (!state.me) return;
    const on = state.me.status === 'study';
    for (const btn of [$('#btn-play'), $('#solo-play')]) {
      btn.classList.toggle('on', on);
      btn.setAttribute('aria-label', on ? '쉬기' : '공부 시작');
    }
    $('#bubble-left').textContent = state.me.bubblesLeft;
    if (!state.members.has(state.me.id) && state.view === 'class') state.members.set(state.me.id, state.me);
    if (!$('#screen-solo').hidden) renderSolo();
    syncWakeLock();
  }

  function toggleStudy() {
    if (!state.me) return;
    sendWs({ t: 'study', on: state.me.status !== 'study' });
  }

  function tickTimers() {
    for (const [id, el] of state.cards) {
      const m = state.members.get(id);
      if (m && m.since) $('.timer', el).textContent = fmt(liveMs(m));
    }
    if (!$('#screen-solo').hidden && state.me) $('#solo-time').textContent = fmt(liveMs(state.me));
  }

  // ---------- 혼자 모드 ----------

  function openSolo() {
    show('screen-solo');
    renderSolo();
  }

  function renderSolo() {
    const m = state.me;
    $('#solo-time').textContent = fmt(liveMs(m));
    $('#solo-label').textContent = m.status === 'study' ? '집중하는 중… 오늘 공부한 시간' : '오늘 공부한 시간 · ▶ 눌러서 시작';
    const pose = m.status === 'study' ? 'study' : 'rest';
    const key = JSON.stringify(m.avatar) + pose;
    const box = $('#solo-avatar');
    if (box.dataset.art !== key) {
      box.innerHTML = Avatar.svg(m.avatar, { pose }).replace('viewBox="0 0 200 200"', 'viewBox="0 20 200 160"');
      box.dataset.art = key;
    }
    renderSoloFriends();
  }

  function renderSoloFriends() {
    const friends = Array.from(state.members.values()).filter((m) => m.status === 'study' && m.id !== state.me.id);
    $('#solo-friends').innerHTML = friends.length
      ? friends.slice(0, 5).map((f) => `<div class="f">${Avatar.face(f.avatar)}</div>`).join('') + `<span>친구 ${friends.length}명도 공부 중</span>`
      : '<span>아직 공부 중인 친구가 없어요</span>';
  }

  // ---------- 시트 ----------

  function openSheet(id) {
    $(id).hidden = false;
  }

  function closeSheets() {
    for (const el of $$('.sheet')) el.hidden = true;
  }

  function openBubble() {
    $('#bubble-input').value = '';
    openSheet('#sheet-bubble');
    setTimeout(() => $('#bubble-input').focus(), 50);
  }

  function submitBubble(e) {
    e.preventDefault();
    const text = $('#bubble-input').value.trim();
    if (!text) return;
    if (sendWs({ t: 'bubble', text })) closeSheets();
  }

  async function openStats() {
    openSheet('#sheet-stats');
    const body = $('#stats-body');
    body.innerHTML = '<p class="sheet-title">내 기록</p><p>불러오는 중…</p>';
    try {
      const s = await api('/api/me/stats');
      const max = Math.max(60 * 60 * 1000, ...s.days.map((d) => d.ms));
      const weekday = ['일', '월', '화', '수', '목', '금', '토'];
      const medals = ['🥇', '🥈', '🥉'];
      body.innerHTML = `
        <p class="sheet-title">내 기록</p>
        <div class="stat-tiles">
          <div class="stat-tile"><div class="k">오늘</div><div class="v">${fmtShort(s.todayMs)}</div></div>
          <div class="stat-tile"><div class="k">최근 7일</div><div class="v">${fmtShort(s.weekMs)}</div></div>
          <div class="stat-tile"><div class="k">연속 공부</div><div class="v">🔥 ${s.streak}일</div></div>
        </div>
        <div class="bars">${s.days.map((d) => `<div class="bar${d.day === s.today ? ' today' : ''}"><em>${d.ms ? fmtShort(d.ms) : ''}</em><i style="height:${Math.round((d.ms / max) * 100)}%"></i></div>`).join('')}</div>
        <div class="bar-labels">${s.days.map((d) => `<span>${d.day === s.today ? '오늘' : weekday[new Date(`${d.day}T00:00:00Z`).getUTCDay()]}</span>`).join('')}</div>
        <div class="rank">
          <h4>우리 반 최근 7일 TOP 3</h4>
          ${s.top.length ? s.top.map((r, i) => `<div class="rank-row"><span class="medal">${medals[i]}</span><span class="f">${Avatar.face(r.avatar)}</span><span>${esc(r.name)}</span><span class="t">${fmtShort(r.ms)}</span></div>`).join('') : '<p class="rank-me">아직 기록이 없어요. 1등 자리가 비어 있어요!</p>'}
          <p class="rank-me">나는 ${s.classSize}명 중 <b>${s.myRank}등</b> · 오늘 받은 응원 ♥ ${s.hearts}</p>
        </div>
        <p class="rank-me">하루 30분 이상 공부하면 연속 기록이 이어져요.</p>
        <button class="btn" data-close style="margin-top:12px;background:#f6f3f8">닫기</button>`;
    } catch (err) {
      body.innerHTML = `<p class="sheet-title">내 기록</p><p>${esc(err.message)}</p><button class="btn" data-close>닫기</button>`;
    }
  }

  function openMenu() {
    $('#menu-who').textContent = state.me ? `${state.me.name} · ${state.className}` : '';
    openSheet('#sheet-menu');
  }

  async function logout(message) {
    const token = state.token;
    state.token = null;
    saved.del('study.token');
    if (state.ws) { const ws = state.ws; state.ws = null; ws.close(); }
    clearTimeout(state.retryTimer);
    state.me = null;
    state.members.clear();
    state.cards.clear();
    $('#grid').innerHTML = '';
    closeSheets();
    if (token && !message) {
      fetch('/api/me/logout', { method: 'POST', headers: { Authorization: `Bearer ${token}` } }).catch(() => {});
    }
    openEntry(typeof message === 'string' ? message : '');
  }

  // ---------- 이벤트 연결 ----------

  function bind() {
    $('#in-code').addEventListener('input', lookupClass);
    $('#entry-form').addEventListener('submit', (e) => { e.preventDefault(); enter('login'); });
    $('#btn-register').addEventListener('click', () => enter('register'));

    $('#avatar-options').addEventListener('click', onAvatarOption);
    $('#avatar-dice').addEventListener('click', () => { state.draft = Avatar.random(); renderAvatarEditor(); });
    $('#avatar-save').addEventListener('click', saveAvatar);
    $('#avatar-back').addEventListener('click', () => openRoom());

    for (const tab of $$('.tab')) {
      tab.addEventListener('click', () => {
        if (state.view === tab.dataset.view) return;
        state.view = tab.dataset.view;
        saved.set('study.view', state.view);
        renderTabs();
        sendWs({ t: 'view', view: state.view });
      });
    }
    $('#grid').addEventListener('click', (e) => {
      const card = e.target.closest('.card');
      if (!card || !state.me) return;
      if (card.dataset.id === state.me.id) openBubble();
      else sendWs({ t: 'cheer', to: card.dataset.id });
    });
    $('#btn-play').addEventListener('click', toggleStudy);
    $('#solo-play').addEventListener('click', toggleStudy);
    $('#btn-sound').addEventListener('click', () => {
      state.muted = !state.muted;
      saved.set('study.muted', state.muted ? '1' : '0');
      renderSound();
      toast(state.muted ? '소리 끔' : '소리 켬', 1000);
    });
    $('#btn-solo').addEventListener('click', openSolo);
    $('#solo-back').addEventListener('click', () => show('screen-room'));
    $('#btn-stats').addEventListener('click', openStats);
    $('#btn-bubble').addEventListener('click', openBubble);
    $('#btn-menu').addEventListener('click', openMenu);
    $('#bubble-form').addEventListener('submit', submitBubble);
    $('#bubble-clear').addEventListener('click', () => { if (sendWs({ t: 'bubble', text: '' })) closeSheets(); });
    $('#menu-avatar').addEventListener('click', () => { closeSheets(); openAvatarEditor('room'); });
    $('#menu-install').addEventListener('click', () => {
      closeSheets();
      toast('아이폰: 사파리 공유 버튼 → "홈 화면에 추가" / 안드로이드: 크롬 ⋮ → "홈 화면에 추가"', 5000);
    });
    $('#menu-logout').addEventListener('click', () => logout());
    document.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) closeSheets(); });

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState !== 'visible') return;
      syncWakeLock();
      if (state.token && !state.ws && !$('#screen-room').hidden) connect();
    });
    setInterval(tickTimers, 1000);
    setInterval(() => {
      if (state.ws && state.ws.readyState === WebSocket.OPEN) state.ws.send(JSON.stringify({ t: 'ping' }));
      for (const m of state.members.values()) if (m.bubble) cardFor(m);
    }, 30000);
  }

  async function start() {
    bind();
    if (!state.token) return openEntry();
    try {
      const data = await api('/api/me');
      state.me = data.me;
      openRoom();
    } catch (err) {
      if (err.status === 401) logout('다시 로그인해 주세요.');
      else openEntry(err.message);
    }
  }

  start();
})();
