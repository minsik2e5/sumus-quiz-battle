const $ = (s) => document.querySelector(s);
const els = {
  status: $('#serverStatus'),
  code: $('#code'),
  qr: $('#qr'),
  join: $('#joinUrl'),
  copyJoin: $('#copyJoin'),
  connected: $('#connected'),
  ready: $('#readyCount'),
  alive: $('#alive'),
  time: $('#roundTime'),
  players: $('#players'),
  ranking: $('#ranking'),
  start: $('#start'),
  pause: $('#pause'),
  restart: $('#restart'),
  kick: $('#projKick'),
  main: $('#projMain'),
  sub: $('#projSub'),
  toast: $('#toast')
};

let code = '';
let teacherToken = '';
let room = null;
let events = null;
let joinUrl = '';

function escapeHtml(v) {
  return String(v ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function toast(text) {
  els.toast.textContent = text;
  els.toast.classList.remove('hidden');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => els.toast.classList.add('hidden'), 1800);
}

function setServerStatus(text, mode = 'ok') {
  els.status.classList.toggle('reconnecting', mode !== 'ok');
  els.status.innerHTML = `<i></i><span>${escapeHtml(text)}</span>`;
}

async function post(url, data) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(data)
  });
  const json = await response.json();
  if (!json.ok) throw new Error(json.error);
  return json;
}

function elapsed() {
  if (!room?.startAt) return 0;
  const end = room.phase === 'paused' && room.pauseStartedAt ? room.pauseStartedAt : Date.now();
  return Math.max(0, end - room.startAt - (room.pausedAccumMs || 0));
}

function fmt(ms) {
  return (Math.max(0, ms) / 1000).toFixed(2);
}

function stateText(p) {
  if (p.eliminatedAtMs != null) return `${fmt(p.eliminatedAtMs)} s`;
  if (!p.ready) return 'WAITING';
  if (p.alive) return 'READY';
  return 'OUT';
}

function playerClass(p) {
  if (p.eliminatedAtMs != null || !p.alive) return 'is-out';
  if (p.ready) return room?.phase === 'running' ? 'is-alive' : 'is-ready';
  return '';
}

function renderPlayers(players) {
  els.players.innerHTML = '';
  for (let i = 0; i < 20; i++) {
    const p = players[i];
    const card = document.createElement('div');
    if (!p) {
      card.className = 'player empty-slot';
      card.innerHTML = `<div class="slot-number">SLOT ${String(i + 1).padStart(2, '0')}</div><div class="small muted">입장 대기</div>`;
    } else {
      card.className = `player ${playerClass(p)}`;
      card.innerHTML = `<div class="name">${escapeHtml(p.name)}</div><div class="small ${p.alive ? 'green' : 'red'}">${escapeHtml(stateText(p))}</div>`;
    }
    els.players.appendChild(card);
  }
}

function renderRanking(players) {
  const ranked = [...players].sort((a, b) => {
    if (a.alive !== b.alive) return a.alive ? -1 : 1;
    return (b.eliminatedAtMs ?? Infinity) - (a.eliminatedAtMs ?? Infinity);
  });

  if (!ranked.length) {
    els.ranking.innerHTML = `
      <div class="empty-ranking">
        <div><div class="empty-icon">♛</div><strong>아직 기록이 없어요</strong><p>학생이 입장하면 여기에 실시간 순위가 표시됩니다.</p></div>
      </div>`;
    return;
  }

  els.ranking.innerHTML = '';
  ranked.slice(0, 10).forEach((p, i) => {
    const row = document.createElement('div');
    row.className = 'rank-row';
    row.innerHTML = `
      <div class="rank-num">${i + 1}</div>
      <div class="rank-name">${escapeHtml(p.name)}</div>
      <div class="rank-time">${p.alive ? (p.ready ? 'ALIVE' : 'WAIT') : `${fmt(p.eliminatedAtMs)}s`}</div>`;
    els.ranking.appendChild(row);
  });
}

function render() {
  if (!room) return;
  const players = room.players.filter((p) => p.connected);
  const ready = players.filter((p) => p.ready).length;
  const alive = players.filter((p) => p.alive).length;
  const activePhase = ['countdown', 'running', 'paused', 'finished'].includes(room.phase);

  els.connected.textContent = `${players.length} / 20`;
  els.ready.textContent = `${ready}`;
  els.alive.textContent = activePhase ? `${alive}` : '—';
  els.time.textContent = `${fmt(elapsed())} s`;

  els.start.disabled = room.phase !== 'lobby' || players.length < 2 || ready !== players.length;
  els.pause.disabled = !['running', 'paused'].includes(room.phase);
  els.pause.textContent = room.phase === 'paused' ? '▶ RESUME' : 'Ⅱ PAUSE';
  els.restart.disabled = room.phase === 'lobby';

  renderPlayers(players);
  renderRanking(players);

  if (room.phase === 'lobby') {
    els.kick.textContent = players.length ? 'PLAYER LOBBY' : 'WAITING ROOM';
    els.main.textContent = `${players.length} / 20`;
    els.sub.textContent = players.length >= 2 && ready === players.length
      ? '모두 READY · START ROUND를 눌러주세요'
      : players.length
        ? `${ready}명 READY · 학생들을 기다리는 중`
        : 'QR을 스캔하면 학생이 바로 입장합니다.';
  } else if (room.phase === 'countdown') {
    els.kick.textContent = 'ROUND START';
    els.main.textContent = Math.max(0, Math.ceil((room.startAt - Date.now()) / 1000)) || 'GO!';
    els.sub.textContent = `${players.length}명 동시 시작`;
  } else if (room.phase === 'running' || room.phase === 'paused') {
    els.kick.textContent = alive <= 3 ? '🔥 FINAL 3' : alive <= 5 ? '🔥 FINAL 5' : room.phase === 'paused' ? 'GAME PAUSED' : 'LIVE SURVIVAL';
    els.main.textContent = `${alive} ALIVE`;
    els.sub.textContent = `${fmt(elapsed())}초 · ${room.phase === 'paused' ? 'PAUSED' : '끝까지 살아남으세요!'}`;
  } else if (room.phase === 'finished') {
    const winner = players.find((p) => p.alive);
    els.kick.textContent = '👑 WINNER';
    els.main.textContent = winner ? winner.name : 'ROUND END';
    els.sub.textContent = `최종 기록 ${fmt(elapsed())}초`;
  }
}

function connectEvents() {
  if (events) events.close();
  events = new EventSource(`/api/events?role=teacher&code=${encodeURIComponent(code)}&token=${encodeURIComponent(teacherToken)}`);
  events.onopen = () => setServerStatus('SERVER CONNECTED', 'ok');
  events.onerror = () => setServerStatus('RECONNECTING', 'warn');
  events.addEventListener('room:state', (event) => {
    room = JSON.parse(event.data);
    render();
  });
  events.addEventListener('round:finished', () => render());
}

function createQr(url) {
  els.qr.innerHTML = '';
  try {
    if (window.QRCode) {
      new QRCode(els.qr, {
        text: url,
        width: 148,
        height: 148,
        colorDark: '#24183f',
        colorLight: '#ffffff',
        correctLevel: QRCode.CorrectLevel.M
      });
      return;
    }
  } catch (e) {
    console.warn('QR library failed', e);
  }

  const fallback = document.createElement('a');
  fallback.href = url;
  fallback.target = '_blank';
  fallback.rel = 'noopener';
  fallback.textContent = '학생 입장 링크 열기';
  fallback.style.cssText = 'color:#4e31bd;font-weight:900;font-size:12px;text-decoration:none';
  els.qr.appendChild(fallback);
}

async function copyText(value, successText) {
  if (!value) return;
  try {
    await navigator.clipboard.writeText(value);
    toast(successText);
  } catch {
    const input = document.createElement('textarea');
    input.value = value;
    document.body.appendChild(input);
    input.select();
    document.execCommand('copy');
    input.remove();
    toast(successText);
  }
}

(async () => {
  try {
    const created = await post('/api/teacher/create', {});
    code = created.code;
    teacherToken = created.teacherToken;
    room = created.room;
    joinUrl = created.joinUrl;
    els.code.textContent = code;
    els.join.textContent = joinUrl;
    createQr(joinUrl);
    connectEvents();
    render();
  } catch (error) {
    setServerStatus('SERVER ERROR', 'warn');
    toast(error.message);
  }
})();

els.code.onclick = () => copyText(code, '방 코드를 복사했어요');
els.copyJoin.onclick = () => copyText(joinUrl, '학생 입장 링크를 복사했어요');
els.join.onclick = () => copyText(joinUrl, '학생 입장 링크를 복사했어요');
els.join.style.cursor = 'pointer';
els.start.onclick = async () => {
  try { await post('/api/teacher/start', { code, teacherToken }); }
  catch (error) { toast(error.message); }
};
els.pause.onclick = async () => {
  try {
    await post(room?.phase === 'paused' ? '/api/teacher/resume' : '/api/teacher/pause', { code, teacherToken });
  } catch (error) { toast(error.message); }
};
els.restart.onclick = async () => {
  try { await post('/api/teacher/restart', { code, teacherToken }); }
  catch (error) { toast(error.message); }
};

setInterval(() => {
  if (room) render();
}, 250);
