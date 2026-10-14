(() => {
  'use strict';

  const $ = (sel) => document.querySelector(sel);
  const params = new URLSearchParams(location.search);
  const saved = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch { /* 무시 */ } },
    del(k) { try { localStorage.removeItem(k); } catch { /* 무시 */ } }
  };
  const state = {
    key: saved.get('study.boardKey') || '',
    target: params.get('target') || 'ALL',
    data: null,
    offset: 0,
    tab: 'today',
    cards: new Map(),
    timer: null,
    celebrated: new Set(),
    cheerQueue: [],
    cheering: false,
    started: false
  };
  const POLL_MS = 5000;
  const TAB_MS = 12000;
  const MAX_CARDS = 30;
  const CAM_POSE = { down: 'study', up: 'look', yawn: 'yawn', sleep: 'sleep', still: 'study', side: 'look', gone: 'empty' };
  const BADGE = { away: '자리 비움', rest: '쉬는 중' };
  const STATUS_ORDER = { study: 0, away: 1, rest: 2, offline: 3 };

  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  const pad = (n) => String(n).padStart(2, '0');
  const now = () => Date.now() + state.offset;
  const liveMs = (m) => m.baseMs + (m.since ? Math.max(0, now() - m.since) : 0);
  function hms(ms) {
    const s = Math.max(0, Math.floor(ms / 1000));
    return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
  }
  function hm(ms) {
    const m = Math.floor(ms / 60000);
    return m < 60 ? `${m}분` : `${Math.floor(m / 60)}시간 ${pad(m % 60)}분`;
  }
  function poseOf(m) {
    if (m.status !== 'study') return 'rest';
    return (m.cam && CAM_POSE[m.cam]) || 'study';
  }

  // ---------- 불러오기 ----------

  async function load() {
    try {
      const res = await fetch(`/api/teacher/board?target=${encodeURIComponent(state.target)}`, { headers: { 'X-Teacher-Key': state.key } });
      if (res.status === 401) return showLogin('선생님 키가 올바르지 않아요.');
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'error');
      state.data = await res.json();
      state.offset = state.data.serverNow - Date.now();
      $('#offline').hidden = true;
      render();
    } catch {
      $('#offline').hidden = false;
    }
  }

  function showLogin(message) {
    clearInterval(state.timer);
    saved.del('study.boardKey');
    $('#board').hidden = true;
    $('#login').hidden = false;
    $('#login-err').textContent = message || '';
    $('#key').focus();
  }

  function start() {
    $('#login').hidden = true;
    $('#board').hidden = false;
    load();
    clearInterval(state.timer);
    state.timer = setInterval(load, POLL_MS);
  }

  // ---------- 그리기 ----------

  function render() {
    const d = state.data;
    $('#title').textContent = d.title;
    document.title = `${d.title} 공부방 · TV`;
    $('#studying').textContent = `${d.studying}명`;
    $('#notice').hidden = !d.notice;
    if (d.notice) $('#notice').textContent = `📢 ${d.notice.text}`;
    renderGrid();
    renderRank();
    tick();
    // 새로 목표를 달성한 학생은 TV에 크게 축하한다 (TV를 처음 켰을 때 이미 지난 건 건너뜀)
    for (const g of d.goals || []) {
      const key = `${g.id}|${g.at}`;
      if (state.celebrated.has(key)) continue;
      state.celebrated.add(key);
      if (state.started) state.cheerQueue.push(g);
    }
    state.started = true;
    nextCheer();
  }

  function nextCheer() {
    if (state.cheering || !state.cheerQueue.length) return;
    const g = state.cheerQueue.shift();
    state.cheering = true;
    const h = g.goalMin % 60 ? `${Math.floor(g.goalMin / 60)}시간 ${g.goalMin % 60}분` : `${g.goalMin / 60}시간`;
    const el = $('#cheer');
    el.innerHTML = `<div class="big">🎉 ${esc(g.name)} 목표 달성!</div><div class="small">오늘 목표 ${h} 완료 · 다 같이 박수 👏</div>`;
    el.hidden = false;
    const colors = ['#ff4f6d', '#ffd36a', '#2fc48d', '#6fa6ff', '#b69dff', '#ff9a5a'];
    for (let i = 0; i < 140; i += 1) {
      const c = document.createElement('i');
      c.className = 'confetti';
      c.style.left = `${Math.random() * 100}%`;
      c.style.background = colors[i % colors.length];
      c.style.setProperty('--x', `${(Math.random() - 0.5) * 30}vw`);
      c.style.setProperty('--r', `${360 + Math.random() * 900}deg`);
      c.style.setProperty('--d', `${2.5 + Math.random() * 2}s`);
      c.style.animationDelay = `${Math.random() * 0.8}s`;
      document.body.appendChild(c);
      setTimeout(() => c.remove(), 6000);
    }
    setTimeout(() => {
      el.hidden = true;
      state.cheering = false;
      nextCheer();
    }, 6000);
  }

  // 인원 수에 맞춰 칸 수를 정해서 남는 공간 없이 꽉 차게 배치한다
  function layout(n) {
    const grid = $('#grid');
    const w = grid.clientWidth || 1;
    const h = grid.clientHeight || 1;
    const gap = window.innerWidth * 0.009;
    let best = { cols: 1, size: 0 };
    for (let cols = 1; cols <= Math.max(1, n); cols += 1) {
      const rows = Math.ceil(n / cols);
      const size = Math.min((w - gap * (cols - 1)) / cols, (h - gap * (rows - 1)) / rows);
      if (size > best.size) best = { cols, size };
    }
    grid.style.gridTemplateColumns = `repeat(${best.cols}, ${Math.floor(best.size)}px)`;
    grid.style.justifyContent = 'center';
    grid.style.setProperty('--fs', `${Math.max(11, Math.round(best.size / 13))}px`);
  }

  function renderGrid() {
    const grid = $('#grid');
    const list = state.data.members
      .slice()
      .sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || liveMs(b) - liveMs(a))
      .slice(0, MAX_CARDS);
    $('#empty').hidden = list.length > 0;
    const keep = new Set(list.map((m) => m.id));
    for (const [id, el] of state.cards) if (!keep.has(id)) { el.remove(); state.cards.delete(id); }
    list.forEach((m, i) => {
      let el = state.cards.get(m.id);
      if (!el) {
        el = document.createElement('div');
        el.innerHTML = '<div class="art"></div><div class="top"><span class="timer"></span><span class="name"></span></div>';
        state.cards.set(m.id, el);
      }
      el.className = `card s-${m.status}`;
      el.dataset.id = m.id;
      const pose = poseOf(m);
      const key = JSON.stringify(m.avatar) + pose;
      if (el.dataset.art !== key) {
        el.querySelector('.art').innerHTML = Avatar.svg(m.avatar, { pose });
        el.dataset.art = key;
      }
      el.querySelector('.name').textContent = m.name;
      el.querySelectorAll('.bubble, .badge, .zzz').forEach((x) => x.remove());
      if (m.bubble) el.insertAdjacentHTML('beforeend', `<div class="bubble">${esc(m.bubble.text)}</div>`);
      const badge = (m.status === 'study' && m.cam === 'sleep' && '💤 조는 중') || (m.status === 'study' && m.cam === 'gone' && '잠깐 자리 비움') || BADGE[m.status];
      if (badge) el.insertAdjacentHTML('beforeend', `<span class="badge">${badge}</span>`);
      if (pose === 'sleep') el.insertAdjacentHTML('beforeend', '<span class="zzz">💤</span>');
      el.querySelectorAll('.goal-bar').forEach((x) => x.remove());
      el.classList.toggle('goal-hit', !!m.goalHit);
      if (m.goalMs) el.insertAdjacentHTML('beforeend', `<i class="goal-bar"><b style="width:${Math.min(100, Math.floor((liveMs(m) / m.goalMs) * 100))}%"></b></i>`);
      if (grid.children[i] !== el) grid.insertBefore(el, grid.children[i] || null);
    });
    layout(list.length);
  }

  function renderRank() {
    const d = state.data;
    document.querySelectorAll('.rank-tabs span').forEach((s) => s.classList.toggle('on', s.dataset.tab === state.tab));
    const showClass = d.target === 'ALL';
    const rows = state.tab === 'today'
      ? d.today.slice().sort((a, b) => liveMs(b) - liveMs(a)).map((m) => ({ ...m, ms: null }))
      : d.week;
    const medal = ['🥇', '🥈', '🥉'];
    $('#rank').innerHTML = rows.length
      ? rows.map((r, i) => `<li class="rank-row r${i + 1}" data-id="${r.id}">
          <span class="no">${medal[i] || i + 1}</span>
          <span class="face">${Avatar.face(r.avatar)}</span>
          <span class="who"><div class="nm">${esc(r.name)}</div>${showClass ? `<div class="cl">${esc(r.className)}</div>` : ''}</span>
          <span class="ms">${state.tab === 'today' && r.since ? '<i class="live"></i>' : ''}<b>${hm(r.ms != null ? r.ms : liveMs(r))}</b></span>
        </li>`).join('')
      : `<li class="rank-empty">${state.tab === 'today' ? '오늘 1등 자리가 비어 있어요!' : '아직 기록이 없어요'}</li>`;
  }

  function tick() {
    const d = state.data;
    const t = new Date(now());
    $('#time').textContent = `${pad(t.getHours())}:${pad(t.getMinutes())}`;
    $('#date').textContent = `${t.getMonth() + 1}월 ${t.getDate()}일 ${'일월화수목금토'[t.getDay()]}요일`;
    if (!d) return;
    const live = d.members.filter((m) => m.since).reduce((sum, m) => sum + Math.max(0, now() - Math.max(m.since, d.serverNow)), 0);
    $('#total').textContent = hm(d.totalTodayMs + live);
    for (const m of d.members) {
      const el = state.cards.get(m.id);
      if (el) el.querySelector('.timer').textContent = hms(liveMs(m));
    }
    if (state.tab === 'today') {
      for (const m of d.today) {
        const b = document.querySelector(`.rank-row[data-id="${m.id}"] b`);
        if (b && m.since) b.textContent = hm(liveMs(m));
      }
    }
  }

  // ---------- 이벤트 ----------

  $('#login').addEventListener('submit', (e) => {
    e.preventDefault();
    state.key = $('#key').value.trim();
    saved.set('study.boardKey', state.key);
    start();
  });
  $('#fs').addEventListener('click', () => {
    const el = document.documentElement;
    if (document.fullscreenElement) document.exitFullscreen();
    else if (el.requestFullscreen) el.requestFullscreen().catch(() => {});
  });
  // 마우스를 3초 안 움직이면 커서와 버튼을 숨긴다
  let idleTimer = null;
  const wake = () => {
    document.body.classList.remove('idle');
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => document.body.classList.add('idle'), 3000);
  };
  document.addEventListener('mousemove', wake);
  wake();
  window.addEventListener('resize', () => { if (state.data) layout(Math.min(MAX_CARDS, state.data.members.length)); });
  setInterval(tick, 1000);
  setInterval(() => {
    state.tab = state.tab === 'today' ? 'week' : 'today';
    if (state.data) renderRank();
  }, TAB_MS);
  // TV 브라우저가 화면 보호기로 꺼지지 않게 요청
  if ('wakeLock' in navigator) {
    const lock = () => navigator.wakeLock.request('screen').catch(() => {});
    lock();
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') lock(); });
  }

  Avatar.onReady(() => {
    for (const el of state.cards.values()) delete el.dataset.art;
    if (state.data) render();
  });
  if (state.key) start();
  else showLogin();
})();
