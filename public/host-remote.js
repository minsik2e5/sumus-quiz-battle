// 프로젝터 화면 보조: 조작 창(/control)을 따로 띄우고, 연결되면 프로젝터에서 조작 UI를 숨김
(() => {
  const ch = new BroadcastChannel('sumus-island-ctrl');
  let remoteUntil = 0, win = null;
  const creds = () => JSON.parse(sessionStorage.getItem(STORE + ':host') || 'null');

  const css = document.createElement('style');
  css.textContent = `
    body.remote #ctrl, body.remote #live, body.remote #liveBtn2, body.remote #lobby .small, body.remote #goBtn, body.remote #end .row { display:none!important }
    #ctrlWinBtn{width:auto;padding:0 14px;gap:6px;font-weight:800;font-size:14px;display:flex;align-items:center}
    body.remote #ctrlWinBtn{background:rgba(31,179,107,.85)}
    #remoteNote{position:absolute;left:24px;bottom:22px;z-index:7;background:rgba(11,42,74,.75);color:#fff;border-radius:12px;padding:8px 14px;font-weight:700;font-size:13px;display:none}
    body.remote #remoteNote{display:block}`;
  document.head.appendChild(css);

  const btn = document.createElement('button');
  btn.className = 'ibtn'; btn.id = 'ctrlWinBtn'; btn.title = '다른 모니터에 띄울 조작 창'; btn.textContent = '조작 창 열기';
  document.querySelector('.hud-tr').prepend(btn);
  const note = document.createElement('div'); note.id = 'remoteNote'; note.textContent = '조작 창에서 진행 중';
  document.getElementById('game').appendChild(note);

  function openControl() {
    const c = creds(); if (!c) return alert('먼저 방을 열어 주세요.');
    const url = `/control?pin=${c.pin}&key=${encodeURIComponent(c.hostKey)}`;
    win = window.open(url, 'sumus-island-control', 'width=560,height=940');
    if (!win) alert('팝업이 막혔습니다. 주소창 오른쪽의 팝업 차단 아이콘에서 허용해 주세요.');
  }
  btn.onclick = openControl;

  ch.onmessage = (e) => {
    const m = e.data || {};
    if (m.type === 'hello') {
      remoteUntil = Date.now() + 5000;
      const c = creds(); if (c && (c.pin !== m.pin || c.hostKey !== m.key)) ch.postMessage({ type: 'room', pin: c.pin, key: c.hostKey });
      tick();
    }
    if (m.type === 'bye') { remoteUntil = 0; tick(); }
  };
  function tick() {
    const on = Date.now() < remoteUntil;
    document.body.classList.toggle('remote', on);
    btn.textContent = on ? '조작 창 ✓' : '조작 창 열기';
    if (on) { const lv = document.getElementById('live'); if (lv && !lv.classList.contains('hidden')) closeLive(); }
  }
  setInterval(tick, 1000);

  // ── 자동 진행 (정답 공개 5초 뒤 다음 문제) ──
  const AUTO_KEY = STORE + ':auto';
  const autoPref = () => localStorage.getItem(AUTO_KEY) !== 'off';
  const side = document.querySelector('.s-side .side-block:nth-of-type(3)') || document.querySelector('.s-side');
  const autoRow = document.createElement('div');
  autoRow.innerHTML = `<div class="chk" style="margin-top:12px"><input type="checkbox" id="autoNext"><span>정답 공개 5초 뒤 자동으로 다음 문제</span></div>`;
  side.appendChild(autoRow);
  const autoBox = document.getElementById('autoNext'); autoBox.checked = autoPref();
  autoBox.onchange = () => { localStorage.setItem(AUTO_KEY, autoBox.checked ? 'on' : 'off'); socket.emit('host:auto', autoBox.checked); };

  const cd = document.createElement('div'); cd.id = 'autoCd';
  cd.style.cssText = 'position:absolute;right:3vw;bottom:4vh;z-index:6;background:rgba(11,42,74,.82);color:#fff;border-radius:18px;padding:12px 18px;font-weight:900;font-size:clamp(16px,1.4vw,26px);display:none;text-align:center;line-height:1.25';
  document.getElementById('game').appendChild(cd);
  let autoEnd = 0, autoLabel = '', syncedPin = null;
  socket.on('phase', (p) => {
    const c = creds();
    if (c && syncedPin !== c.pin) { syncedPin = c.pin; if (!!p.auto !== autoPref()) socket.emit('host:auto', autoPref()); }
    autoEnd = p.phase === 'reveal' && p.autoRemain ? performance.now() + p.autoRemain : 0;
    const last = p.qIndex >= p.total - 1 || (p.mode === 'survival' && p.alive <= 1 && rosterMap.size >= 2);
    autoLabel = last ? '결과 발표' : '다음 문제';
    if (p.phase === 'reveal') { const nb = document.getElementById('nextBtn'); if (nb && nb.firstChild) nb.firstChild.textContent = last ? '결과 보기' : '다음 문제'; }
  });
  setInterval(() => {
    const left = autoEnd ? Math.ceil((autoEnd - performance.now()) / 1000) : 0;
    cd.style.display = left > 0 && phase.phase === 'reveal' ? 'block' : 'none';
    if (left > 0) cd.innerHTML = `${autoLabel}까지<br><span style="font-size:1.8em;color:#ffe15a">${left}</span>`;
  }, 200);

  // ── 서버가 다시 켜졌을 때: 같은 방 번호로 다시 열어 학생들이 자동으로 돌아오게 ──
  window.recreateRoom = function () {
    const old = creds();
    socket.emit('host:create', { questions: validQuestions(), mode: settings.mode, gather: settings.gather, auto: autoPref(), pin: old && old.pin }, (r) => {
      if (!r.ok) return;
      room = { pin: r.pin }; sessionStorage.setItem(STORE + ':host', JSON.stringify(r)); setupJoin(r.pin);
      syncedPin = r.pin;
      if (!old || old.pin !== r.pin) alert(`서버가 다시 시작되어 새 방을 열었습니다.\n새 방 번호: ${r.pin}\n학생들은 다시 입장해야 합니다.`);
    });
  };

  // 조작 창이 연결돼 있으면 프로젝터의 즉석 문제 패널은 열지 않음
  const _openLive = openLive;
  window.openLive = function () { if (Date.now() < remoteUntil) { if (win && !win.closed) win.focus(); return; } _openLive(); };

  // 조작 창에서 '목록에도 저장'한 문제를 반영 (저장소가 비어 있으면 현재 목록을 먼저 기록)
  if (!localStorage.getItem(STORE)) try { localStorage.setItem(STORE, JSON.stringify(Q)); } catch (e) {}
  addEventListener('storage', (e) => { if (e.key === STORE) { Q = load(); if (!document.getElementById('setup').classList.contains('hidden')) renderList(); } });
})();
