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
    wakeLock: null,
    alertedCheck: null,
    cam: null,
    camPose: null,
    camStarting: false
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
    document.body.classList.toggle('solo-on', id === 'screen-solo');
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
      const notes = kind === 'start' ? [523, 659, 784] : kind === 'check' ? [784, 988, 784, 988] : [880, 1175];
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
    $('#btn-sound').textContent = state.muted ? '🔇 소리 켜기' : '🔈 소리 끄기';
  }

  // ---------- 카메라 (얼굴 방향 → 캐릭터 자세) ----------

  async function startCam() {
    if (state.cam || state.camStarting) return;
    state.camStarting = true;
    renderCam('준비 중…');
    try {
      state.cam = await Cam.start({
        video: $('#cam-video'),
        onPose(pose) {
          if (!pose) return;
          state.camPose = pose;
          sendWs({ t: 'cam', on: true, pose }, true);
          renderCam();
        }
      });
      saved.set('study.cam', '1');
      toast('카메라 켰어요. 화면을 잠깐 바라봐 주세요 👀');
    } catch (err) {
      saved.del('study.cam');
      toast(err && err.name === 'NotAllowedError' ? '카메라 권한을 허용해 주세요 (브라우저 설정)' : (err.message || '카메라를 켤 수 없어요.'), 4000);
    } finally {
      state.camStarting = false;
      renderCam();
    }
  }

  function stopCam(remember = true) {
    if (state.cam) state.cam.stop();
    state.cam = null;
    state.camPose = null;
    if (remember) saved.del('study.cam');
    sendWs({ t: 'cam', on: false }, true);
    renderCam();
  }

  function renderCam(status) {
    const on = !!state.cam;
    $('#btn-cam').classList.toggle('cam-on', on);
    $('#cam-off').hidden = on;
    $('#cam-toggle').textContent = state.camStarting ? '준비 중…' : on ? '카메라 끄기' : '카메라 켜기';
    $('#cam-toggle').disabled = state.camStarting;
    $('#cam-pose').textContent = status || (on && state.camPose ? Cam.LABEL[state.camPose] : on ? '얼굴 찾는 중…' : '');
    $('#cam-peek').hidden = !on;
    if (!on) $('.cam-preview').classList.remove('peek');
    // 내 화면에서도 얼굴 대신 캐릭터가 따라 움직이게 보여 준다
    const pose = on && state.camPose ? CAM_POSE[state.camPose] : 'study';
    const box = $('#cam-avatar');
    const key = state.me ? JSON.stringify(state.me.avatar) + pose : '';
    box.hidden = !on;
    if (on && state.me && box.dataset.art !== key) {
      box.innerHTML = Avatar.svg(state.me.avatar, { pose });
      box.dataset.art = key;
    }
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
      if (seq === classLookup) {
        el.textContent = `✔ ${cls.name}`;
        state.classTaken = cls.takenKinds || [];
      }
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
      const body = mode === 'register' ? { ...v, avatar: Avatar.random(state.classTaken) } : v;
      const data = await api(mode === 'register' ? '/api/register' : '/api/login', { method: 'POST', body });
      state.token = data.token;
      state.me = data.me;
      saved.set('study.token', data.token);
      saved.set('study.code', v.classCode);
      if (mode === 'register') openAvatarEditor('room-first');
      else if (needsCharacter()) openAvatarEditor('room-first');
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

  // 선생님이 등록한 학생은 사람 캐릭터로 시작하니, 동물 캐릭터가 있으면 처음 한 번 고르게 한다
  function needsCharacter() {
    if (!state.me || state.me.avatar.kind || !Avatar.CHARACTERS.some((c) => Avatar.isAvailable(c.id))) return false;
    return saved.get(`study.picked.${state.me.id}`) !== '1';
  }

  async function openAvatarEditor(returnTo) {
    state.avatarReturn = returnTo;
    state.draft = Avatar.normalize(state.me && state.me.avatar);
    state.taken = [];
    $('#avatar-back').hidden = returnTo === 'room-first';
    renderAvatarEditor();
    show('screen-avatar');
    try {
      state.taken = (await api('/api/me/taken')).taken;
      renderAvatarEditor();
    } catch { /* 못 불러와도 고를 때 서버가 확인한다 */ }
  }

  function renderAvatarEditor() {
    const d = state.draft;
    $('#avatar-preview-card').innerHTML = `<div class="art">${Avatar.svg(d)}</div>`;
    const chips = (key, list) => list.map((o) => `<button class="chip${d[key] === o.id ? ' on' : ''}" data-key="${key}" data-val="${o.id}">${o.label}</button>`).join('');
    const swatches = (key, colors) => colors.map((c, i) => `<button class="swatch${d[key] === i ? ' on' : ''}" style="background:${c}" data-key="${key}" data-val="${i}" aria-label="색 ${i + 1}"></button>`).join('');
    // 이미지 캐릭터: 올라온 것만 보여 주고, 누적 시간이 모자라면 잠금으로 표시
    const hours = Math.floor(((state.me && state.me.totalMs) || 0) / 3600000);
    const chars = Avatar.CHARACTERS.filter((c) => Avatar.isAvailable(c.id));
    const charGroup = chars.length ? `<div class="opt-group"><h4>캐릭터 고르기</h4><div class="char-grid">
        <button class="char${d.kind ? '' : ' on'}" data-key="kind" data-val=""><span class="char-face human">${Avatar.face({ ...d, kind: null })}</span><b>사람</b></button>
        ${chars.map((c) => {
          const locked = c.unlock > hours && (state.me && state.me.avatar && state.me.avatar.kind) !== c.id;
          const owner = (state.taken || []).find((t) => t.kind === c.id);
          return `<button class="char${d.kind === c.id ? ' on' : ''}${locked ? ' locked' : ''}${owner ? ' taken' : ''}" data-key="kind" data-val="${c.id}" ${locked ? `data-locked="${c.unlock}"` : ''} ${owner ? `data-owner="${esc(owner.name)}"` : ''}>
            <span class="char-face">${Avatar.face({ kind: c.id })}</span><b>${c.name}</b>${owner ? `<small>${esc(owner.name)} 사용 중</small>` : locked ? `<small>🔒 ${c.unlock}시간</small>` : ''}</button>`;
        }).join('')}
      </div><p class="char-help">한 반에서는 캐릭터가 겹치지 않아요 · 누적 공부 시간이 쌓이면 새 친구가 열려요 (지금 ${hours}시간)</p></div>` : '';
    $('#avatar-options').innerHTML = charGroup + (d.kind ? `
      <div class="opt-group"><h4>책상 소품</h4><div class="opt-row">${chips('item', Avatar.ITEMS)}</div></div>` : `
      <div class="opt-group"><h4>머리 모양</h4><div class="opt-row">${chips('hair', Avatar.HAIR)}</div></div>
      <div class="opt-group"><h4>머리 색</h4><div class="opt-row">${swatches('hc', Avatar.HAIR_COLORS)}</div></div>
      <div class="opt-group"><h4>옷 색</h4><div class="opt-row">${swatches('top', Avatar.TOPS)}</div></div>
      <div class="opt-group"><h4>안경</h4><div class="opt-row">${chips('glasses', [{ id: false, label: '없음' }, { id: true, label: '있음' }])}</div></div>
      <div class="opt-group"><h4>책상 소품</h4><div class="opt-row">${chips('item', Avatar.ITEMS)}</div></div>`);
  }

  function onAvatarOption(e) {
    const btn = e.target.closest('[data-key]');
    if (!btn) return;
    const key = btn.dataset.key;
    let val = btn.dataset.val;
    if (key === 'hc' || key === 'top') val = Number(val);
    if (key === 'glasses') val = val === 'true';
    if (key === 'kind' && btn.dataset.owner) {
      toast(`${btn.dataset.owner} 친구가 이미 쓰고 있어요. 다른 친구를 골라 봐요!`);
      return;
    }
    if (key === 'kind' && btn.dataset.locked) {
      toast(`누적 ${btn.dataset.locked}시간을 공부하면 열려요. 조금만 더 힘내요! 💪`);
      return;
    }
    if (key === 'kind') val = val || null;
    state.draft = Avatar.normalize({ ...state.draft, [key]: val });
    renderAvatarEditor();
  }

  async function saveAvatar() {
    const btn = $('#avatar-save');
    btn.disabled = true;
    try {
      const data = await api('/api/me/avatar', { method: 'POST', body: { avatar: state.draft } });
      state.me = { ...state.me, ...data.me };
      saved.set(`study.picked.${state.me.id}`, '1');
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

  function sendWs(msg, quiet) {
    if (state.ws && state.ws.readyState === WebSocket.OPEN) {
      state.ws.send(JSON.stringify(msg));
      return true;
    }
    if (!quiet) toast('연결 중이에요. 잠시만요!');
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
        // 다시 연결되면 카메라 상태를 서버에 다시 알린다
        if (state.cam && state.camPose) sendWs({ t: 'cam', on: true, pose: state.camPose }, true);
        else if (!state.cam && saved.get('study.cam') === '1') startCam();
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
      case 'cam_stopped':
        toast('자리를 오래 비워서 타이머를 멈춰 뒀어요. 돌아오면 ▶ 눌러서 이어 가요 🙂', 6000);
        break;
      case 'goal':
        if (state.me && msg.id === state.me.id) {
          confetti(null, 120);
          ding('start');
          toast(`🎉 오늘 목표 ${hoursLabel(msg.goalMin)} 달성! 정말 대단해요`, 4000);
        } else {
          const card = state.cards.get(msg.id);
          if (card) confetti(card, 28);
          toast(`🎉 ${msg.name}님이 오늘 목표 ${hoursLabel(msg.goalMin)}를 달성했어요!`, 3500);
        }
        break;
      case 'check_missed':
        toast('잠깐 자리를 비운 것 같아서 타이머를 멈춰 뒀어요. ▶ 누르면 바로 이어서 할 수 있어요 🙂', 6000);
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
  const CAM_POSE = { down: 'study', up: 'look', yawn: 'yawn', sleep: 'sleep', gone: 'empty' };
  const CAM_BADGE = { sleep: '💤 조는 중', gone: '잠깐 자리 비움' };

  function poseOf(m) {
    if (m.status !== 'study') return 'rest';
    return (m.cam && CAM_POSE[m.cam]) || 'study';
  }

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
    const pose = poseOf(m);
    const artKey = JSON.stringify(m.avatar) + pose;
    if (el.dataset.art !== artKey) {
      $('.art', el).innerHTML = Avatar.svg(m.avatar, { pose });
      el.dataset.art = artKey;
    }
    el.className = `card s-${m.status}${state.me && m.id === state.me.id ? ' me' : ''}`;
    $('.timer', el).textContent = fmt(liveMs(m));
    $('.name', el).innerHTML = `${esc(m.name)}${m.goalHit ? '<span class="goal-chip" title="오늘 목표 달성">🎯</span>' : ''}${m.cam ? '<span class="cam-chip" title="카메라로 확인 중">📷</span>' : ''}`;
    el.classList.toggle('goal-hit', !!m.goalHit);
    let bar = $('.goal-bar', el);
    if (m.goalMs) {
      if (!bar) {
        el.insertAdjacentHTML('beforeend', '<i class="goal-bar"><b></b></i>');
        bar = $('.goal-bar', el);
      }
      $('b', bar).style.width = `${goalPct(m)}%`;
    } else if (bar) bar.remove();
    const badge = $('.badge', el);
    const badgeText = (m.status === 'study' && m.cam && CAM_BADGE[m.cam]) || BADGE[m.status];
    badge.textContent = badgeText;
    badge.hidden = !badgeText;
    let zzz = $('.zzz', el);
    if (pose === 'sleep' && !zzz) el.insertAdjacentHTML('beforeend', '<span class="zzz">💤</span>');
    else if (pose !== 'sleep' && zzz) zzz.remove();

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
    renderCheck();
    renderGone();
    syncWakeLock();
  }

  function renderGone() {
    const at = state.me && state.me.camGoneAt;
    $('#gone-banner').hidden = !at;
    if (!at) return;
    const left = Math.max(0, Math.ceil((at + state.me.camStopMs - serverNow()) / 1000));
    $('#gone-left').textContent = `${Math.floor(left / 60)}:${pad(left % 60)}`;
  }

  // 공부 중 45~75분마다 서버가 집중 확인을 보낸다. 5분 안에 누르면 시간이 이어진다.
  // 감시처럼 느껴지지 않게 내 캐릭터가 쉬자고 말을 거는 모양으로 보여 준다.
  const CHECK_MSGS = [
    '기지개 한 번 쭉 켜고 갈까? 🙆',
    '물 한 모금 마시고 계속하자 💧',
    '눈 잠깐 감았다 떠 봐. 눈도 쉬어야지 👀',
    '여기까지 온 거 진짜 대단해 👏',
    '어깨 한 번 돌리고 다시 집중! 💪'
  ];
  function renderCheck() {
    const check = state.me && state.me.check;
    $('#check').hidden = !check;
    document.title = check ? '👀 집중 확인!' : 'SUMUS 공부방';
    if (!check) return;
    tickCheck();
    if (state.alertedCheck !== check.at) {
      state.alertedCheck = check.at;
      $('#check-title').textContent = `${state.me.name}, 아직 같이 공부 중이지?`;
      $('#check-msg').textContent = `오늘 벌써 ${fmtShort(liveMs(state.me))} 했어! ${CHECK_MSGS[Math.floor(Math.random() * CHECK_MSGS.length)]}`;
      $('#check-avatar').innerHTML = Avatar.svg(state.me.avatar, { pose: 'cheer' }).replace('viewBox="0 0 200 200"', 'viewBox="30 18 140 140"');
      ding('check');
      try { if (navigator.vibrate) navigator.vibrate([200, 100, 200]); } catch { /* 무시 */ }
    }
  }

  function tickCheck() {
    const check = state.me && state.me.check;
    if (!check) return;
    const left = Math.max(0, Math.min(Math.floor((check.deadline - check.at) / 1000), Math.ceil((check.deadline - serverNow()) / 1000)));
    $('#check-left').textContent = `${Math.floor(left / 60)}:${pad(left % 60)}`;
  }

  function toggleStudy() {
    if (!state.me) return;
    sendWs({ t: 'study', on: state.me.status !== 'study' });
  }

  function tickTimers() {
    for (const [id, el] of state.cards) {
      const m = state.members.get(id);
      if (m && m.since) {
        $('.timer', el).textContent = fmt(liveMs(m));
        const b = m.goalMs && $('.goal-bar b', el);
        if (b) b.style.width = `${goalPct(m)}%`;
      }
    }
    if (!$('#screen-solo').hidden && state.me) $('#solo-time').textContent = fmt(liveMs(state.me));
    tickCheck();
    renderGone();
    if (state.cam && !state.cam.alive) stopCam(false);
  }

  // ---------- 혼자 모드 ----------

  function openSolo() {
    show('screen-solo');
    renderSolo();
  }

  function renderSolo() {
    const m = state.me;
    $('#solo-time').textContent = fmt(liveMs(m));
    $('#solo-label').textContent = m.status === 'study' ? '집중하는 중 · 오늘 공부한 시간' : '▶ 눌러서 집중 시작';
    renderSoloGoal();
    const pose = poseOf(m);
    const key = JSON.stringify(m.avatar) + pose;
    const box = $('#solo-avatar');
    if (box.dataset.art !== key) {
      // 머리부터 책상까지 크게 잘라서 보여 준다 (벽은 화면 배경을 그대로 쓴다)
      box.innerHTML = Avatar.svg(m.avatar, { pose, bare: true }).replace('viewBox="0 0 200 200"', 'viewBox="14 30 172 170"');
      box.dataset.art = key;
    }
    renderSoloFriends();
  }

  function goalPct(m) {
    return m.goalMs ? Math.min(100, Math.floor((liveMs(m) / m.goalMs) * 100)) : 0;
  }

  function hoursLabel(min) {
    return min % 60 ? `${Math.floor(min / 60)}시간 ${min % 60}분` : `${min / 60}시간`;
  }

  function renderSoloGoal() {
    const m = state.me;
    const el = $('#solo-goal');
    el.classList.toggle('hit', !!m.goalHit);
    if (!m.goalMs) {
      el.innerHTML = '🎯 오늘 목표 정하기';
      return;
    }
    const pct = goalPct(m);
    const left = Math.max(0, m.goalMs - liveMs(m));
    el.innerHTML = m.goalHit
      ? `🎉 오늘 목표 ${hoursLabel(m.goalMs / 60000)} 달성!<span class="track"><b style="width:100%"></b></span>`
      : `🎯 목표 ${hoursLabel(m.goalMs / 60000)} · ${pct}% · ${fmtShort(left)} 남음<span class="track"><b style="width:${pct}%"></b></span>`;
  }

  // ---------- 오늘 목표 ----------

  const GOAL_OPTIONS = [60, 90, 120, 180, 240, 300, 360, 420, 480, 600, 720, 840];

  function openGoal() {
    const cur = state.me && state.me.goalMs ? state.me.goalMs / 60000 : 0;
    $('#goal-chips').innerHTML = GOAL_OPTIONS.map((min) => `<button type="button" data-min="${min}" class="${min === cur ? 'on' : ''}">${min % 60 ? `${min / 60}h` : `${min / 60}시간`}</button>`).join('')
      + `<button type="button" data-min="0" class="none${cur ? '' : ' on'}">목표 없음</button>`;
    closeSheets();
    openSheet('#sheet-goal');
  }

  async function chooseGoal(min) {
    try {
      const data = await api('/api/me/goal', { method: 'POST', body: { minutes: min } });
      state.me = { ...state.me, ...data.me };
      closeSheets();
      renderMe();
      renderGrid();
      toast(min ? `오늘 목표 ${hoursLabel(min)}! 화이팅 💪` : '목표를 지웠어요');
    } catch (err) {
      toast(err.message);
    }
  }

  // 축하 꽃가루: 카드 위(작게) 또는 화면 전체
  function confetti(target, count) {
    const colors = ['#ff4f6d', '#ffd36a', '#2fc48d', '#6fa6ff', '#b69dff', '#ff9a5a'];
    const host = target || document.body;
    for (let i = 0; i < count; i += 1) {
      const c = document.createElement('i');
      c.className = 'confetti';
      c.style.left = `${Math.random() * 100}%`;
      c.style.background = colors[i % colors.length];
      c.style.setProperty('--x', `${(Math.random() - 0.5) * 160}px`);
      c.style.setProperty('--y', target ? `${120 + Math.random() * 80}px` : '105vh');
      c.style.setProperty('--r', `${360 + Math.random() * 720}deg`);
      c.style.setProperty('--d', `${(target ? 1.2 : 2) + Math.random() * 1.4}s`);
      c.style.animationDelay = `${Math.random() * 0.5}s`;
      host.appendChild(c);
      setTimeout(() => c.remove(), 4500);
    }
  }

  function renderSoloFriends() {
    const friends = Array.from(state.members.values()).filter((m) => m.status === 'study' && m.id !== state.me.id);
    $('#solo-friends').innerHTML = friends.length
      ? friends.slice(0, 3).map((f) => `<div class="f" title="${esc(f.name)}">${Avatar.svg(f.avatar, { pose: 'rest' }).replace('viewBox="0 0 200 200"', 'viewBox="40 22 120 120"')}</div>`).join('')
        + (friends.length > 3 ? `<span class="more">+${friends.length - 3}</span>` : '')
      : '<span class="alone">아직 공부 중인 친구가 없어요</span>';
    const room = state.view === 'all' ? '학원 전체' : (state.className || '우리 반');
    $('#solo-room').textContent = friends.length ? `${room} · ${friends.length}명이 같이 공부 중` : room;
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
        <div class="goal-row">
          <span class="txt">${s.goalMs ? `🎯 오늘 목표 ${hoursLabel(s.goalMs / 60000)} · ${s.goalHit ? '달성! 🎉' : `${Math.min(100, Math.floor((s.todayMs / s.goalMs) * 100))}%`}` : '🎯 아직 오늘 목표가 없어요'}<small>최근 30일 동안 목표 달성 ${s.goalDays}일</small></span>
          <button type="button" data-goal>${s.goalMs ? '바꾸기' : '정하기'}</button>
        </div>
        <div class="bars">${s.days.map((d) => `<div class="bar${d.day === s.today ? ' today' : ''}"><em>${d.ms ? fmtShort(d.ms) : ''}</em><i style="height:${Math.round((d.ms / max) * 100)}%"></i></div>`).join('')}</div>
        <div class="bar-labels">${s.days.map((d) => `<span>${d.day === s.today ? '오늘' : weekday[new Date(`${d.day}T00:00:00Z`).getUTCDay()]}</span>`).join('')}</div>
        ${heatmap(s)}
        <div class="rank">
          <h4>우리 반 최근 7일 TOP 3</h4>
          ${s.top.length ? s.top.map((r, i) => `<div class="rank-row"><span class="medal">${medals[i]}</span><span class="f">${Avatar.face(r.avatar)}</span><span>${esc(r.name)}</span><span class="t">${fmtShort(r.ms)}</span></div>`).join('') : '<p class="rank-me">아직 기록이 없어요. 1등 자리가 비어 있어요!</p>'}
          <p class="rank-me">나는 ${s.classSize}명 중 <b>${s.myRank}등</b> · 오늘 받은 응원 ♥ ${s.hearts}</p>
        </div>
        <p class="rank-me">하루 30분 이상 공부하면 연속 기록이 이어져요. 카메라를 안 켜면 가끔(45~75분마다) 쉬어 가자는 확인 창이 떠요.</p>
        <button class="btn" data-close style="margin-top:12px;background:#f6f3f8">닫기</button>`;
    } catch (err) {
      body.innerHTML = `<p class="sheet-title">내 기록</p><p>${esc(err.message)}</p><button class="btn" data-close>닫기</button>`;
    }
  }

  // 공부 잔디: 세로 7칸(요일) × 가로 주 단위, 많이 할수록 진한 초록, 목표 달성한 날은 노란 점
  function heatLevel(ms) {
    const m = ms / 60000;
    if (m <= 0) return 0;
    if (m < 30) return 1;
    if (m < 60) return 2;
    if (m < 120) return 3;
    if (m < 180) return 4;
    return 5;
  }

  function heatmap(s) {
    const first = new Date(`${s.history[0].day}T00:00:00Z`).getUTCDay();
    const cells = Array.from({ length: first }, () => '<i class="pad"></i>')
      .concat(s.history.map((d) => `<i class="l${heatLevel(d.ms)}${d.g ? ' g' : ''}${d.day === s.today ? ' today' : ''}" data-day="${d.day}" data-ms="${d.ms}" data-g="${d.g ? 1 : 0}"></i>`));
    const weeks = Math.ceil(cells.length / 7);
    const months = [];
    let last = '';
    for (let w = 0; w < weeks; w += 1) {
      const d = s.history[Math.max(0, w * 7 - first)];
      const mon = d ? Number(d.day.slice(5, 7)) : '';
      months.push(mon !== last ? `<span>${mon}월</span>` : '<span></span>');
      last = mon;
    }
    const studied = s.history.filter((d) => d.ms > 0).length;
    return `<div class="heat">
      <h4>공부 잔디 <small>최근 ${Math.round(s.history.length / 7)}주 중 ${studied}일 공부</small></h4>
      <div class="heat-scroll" id="heat-scroll">
        <div class="heat-months">${months.join('')}</div>
        <div class="heat-wrap">
          <div class="heat-days"><span></span><span>월</span><span></span><span>수</span><span></span><span>금</span><span></span></div>
          <div class="heat-grid" id="heat-grid">${cells.join('')}</div>
        </div>
      </div>
      <p class="heat-info" id="heat-info">칸을 누르면 그날 공부한 시간이 보여요</p>
      <div class="heat-legend">적게 <i style="background:#ebedf0"></i><i style="background:#c6e9a6"></i><i style="background:#8fd17b"></i><i style="background:#4fb15f"></i><i style="background:#2e8b44"></i><i style="background:#1b6331"></i> 많이 · <i style="background:#ffd36a;border-radius:50%"></i> 목표 달성</div>
    </div>`;
  }

  function openMenu() {
    $('#menu-who').textContent = state.me ? `${state.me.name} · ${state.className}` : '';
    openSheet('#sheet-menu');
  }

  async function logout(message) {
    const token = state.token;
    state.token = null;
    saved.del('study.token');
    if (state.cam) { state.cam.stop(); state.cam = null; }
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
    $('#avatar-dice').addEventListener('click', () => { state.draft = Avatar.random((state.taken || []).map((t) => t.kind)); renderAvatarEditor(); });
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
    $('#btn-cam').addEventListener('click', () => { renderCam(); openSheet('#sheet-cam'); });
    $('#cam-toggle').addEventListener('click', () => (state.cam ? stopCam() : startCam()));
    // 각도 맞추기: 누르면 내 카메라 화면을 보여 주고, 다시 누르거나 5초 지나면 캐릭터로 돌아간다
    let peekTimer = null;
    $('#cam-peek').addEventListener('click', () => {
      const preview = $('.cam-preview');
      clearTimeout(peekTimer);
      if (preview.classList.toggle('peek')) peekTimer = setTimeout(() => preview.classList.remove('peek'), 5000);
    });
    $('#solo-back').addEventListener('click', () => show('screen-room'));
    $('#btn-stats').addEventListener('click', openStats);
    $('#solo-goal').addEventListener('click', openGoal);
    $('#goal-chips').addEventListener('click', (e) => {
      const b = e.target.closest('[data-min]');
      if (b) chooseGoal(Number(b.dataset.min));
    });
    $('#stats-body').addEventListener('click', (e) => {
      if (e.target.closest('[data-goal]')) return openGoal();
      const cell = e.target.closest('#heat-grid i[data-day]');
      if (!cell) return;
      const [, mm, dd] = cell.dataset.day.split('-');
      const ms = Number(cell.dataset.ms);
      $('#heat-info').textContent = `${Number(mm)}월 ${Number(dd)}일 · ${ms ? fmtShort(ms) : '공부 안 함'}${cell.dataset.g === '1' ? ' · 🎯 목표 달성' : ''}`;
    });
    $('#btn-bubble').addEventListener('click', openBubble);
    $('#btn-menu').addEventListener('click', openMenu);
    $('#bubble-form').addEventListener('submit', submitBubble);
    $('#check-ok').addEventListener('click', () => sendWs({ t: 'check_ok' }));
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
      // 다른 앱에 다녀오면 카메라가 꺼져 있을 수 있어 다시 켠다
      if (saved.get('study.cam') === '1' && (!state.cam || !state.cam.alive) && !$('#screen-room').hidden) {
        if (state.cam) stopCam(false);
        startCam();
      }
    });
    setInterval(tickTimers, 1000);
    setInterval(() => {
      if (state.ws && state.ws.readyState === WebSocket.OPEN) state.ws.send(JSON.stringify({ t: 'ping' }));
      for (const m of state.members.values()) if (m.bubble) cardFor(m);
    }, 30000);
  }

  async function start() {
    bind();
    // 캐릭터 이미지가 확인되면 이미 그린 카드들을 이미지 캐릭터로 다시 그린다
    Avatar.onReady(() => {
      for (const el of state.cards.values()) delete el.dataset.art;
      $('#solo-avatar').dataset.art = '';
      if (state.me) renderGrid();
      if (!$('#screen-avatar').hidden) renderAvatarEditor();
      if (!$('#screen-solo').hidden) renderSolo();
      if (!$('#screen-room').hidden && needsCharacter()) openAvatarEditor('room-first');
    });
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
