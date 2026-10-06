// 오늘의 리그 + SUMUS RECORD (선생님 화면 공용 — session-bar.js 가 불러옴)
// - 리그: 한 판이 끝날 때마다 서버가 순위로 리그 점수를 기록. 이 창에서 누적 순위·판 목록·반영 여부·최종 정산·CSV.
// - SUMUS RECORD: 게임별 역대 최고 기록을 이 PC 브라우저(localStorage)에 영구 저장. 깨지면 빵빠레 + 학생 폰에도 축하.
(() => {
  if (window.__sumusLeague) return; window.__sumusLeague = true;
  let sess = null; try { sess = JSON.parse(sessionStorage.getItem('sumus-sess') || 'null'); } catch (e) {}
  if (!sess || typeof socket === 'undefined') return;
  const cur = location.pathname.startsWith('/mg') ? 'mg' : location.pathname.startsWith('/jr') ? 'jr' : location.pathname.startsWith('/bk') ? 'bk' : 'quiz';
  const LKEY = 'sumus-league:' + sess.pin + ':' + sess.key, RKEY = 'sumus-records';
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k) || 'null') || d; } catch (e) { return d; } };
  const store = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
  const muted = () => localStorage.getItem('sumus-island-mute') === '1' || localStorage.getItem('sumus-island-mute') === 'true';
  let league = load(LKEY, { rounds: [], standings: [] });

  /* ── 스타일 ── */
  const css = document.createElement('style');
  css.textContent = `
  #lgBtn{border:0;cursor:pointer;font:inherit;font-weight:800;font-size:13px;line-height:1;padding:9px 12px;border-radius:10px;background:rgba(255,255,255,.12);color:#ffe79a;white-space:nowrap}
  #lgBtn:hover{background:rgba(255,255,255,.22)}
  #lgOv{position:fixed;inset:0;z-index:90;background:rgba(4,14,30,.86);backdrop-filter:blur(4px);display:none;font-family:Pretendard,'Malgun Gothic',sans-serif;color:#0b2a4a}
  #lgOv.on{display:grid;place-items:center}
  #lgOv .box{width:min(1180px,94vw);height:min(760px,90vh);background:#fff;border-radius:26px;border:6px solid #f2c14e;box-shadow:0 12px 0 #d9a21b,0 30px 80px rgba(0,0,0,.45);display:flex;flex-direction:column;overflow:hidden}
  #lgOv header{display:flex;align-items:center;gap:12px;padding:16px 22px;background:linear-gradient(90deg,#0b2a4a,#173f6b);color:#fff}
  #lgOv header h2{margin:0;font-size:24px;font-weight:900;letter-spacing:-.5px}
  #lgOv header small{color:#9fc0e6;font-weight:700}
  #lgOv header .sp{flex:1}
  #lgOv .x{border:0;background:rgba(255,255,255,.15);color:#fff;border-radius:10px;width:40px;height:40px;font-size:20px;cursor:pointer}
  #lgOv .body{flex:1;display:grid;grid-template-columns:1.25fr 1fr;gap:16px;padding:16px 20px;min-height:0}
  #lgOv .col{display:flex;flex-direction:column;min-height:0}
  #lgOv h3{margin:4px 0 8px;font-size:15px;font-weight:900;color:#516b88;display:flex;align-items:center;gap:8px}
  #lgOv .scroll{overflow:auto;flex:1;border:1px solid #e3e9f1;border-radius:14px}
  #lgOv table{width:100%;border-collapse:collapse;font-size:15px}
  #lgOv th{position:sticky;top:0;background:#f4f7fb;text-align:left;font-size:12px;color:#6b7c93;padding:8px 10px;font-weight:800}
  #lgOv td{padding:8px 10px;border-top:1px solid #eef2f7;font-weight:700}
  #lgOv td.rk{width:46px;font-weight:900;color:#0b2a4a}
  #lgOv tr.g1 td.rk{color:#d9a21b}#lgOv tr.g2 td.rk{color:#8a99ad}#lgOv tr.g3 td.rk{color:#c27c3a}
  #lgOv td.tot{font-weight:900;font-size:18px;color:#0b2a4a}
  #lgOv .dot{display:inline-block;width:11px;height:11px;border-radius:50%;margin-right:7px;vertical-align:-1px}
  #lgOv .rd{display:flex;align-items:center;gap:10px;padding:9px 12px;border-top:1px solid #eef2f7;font-weight:700;font-size:14px}
  #lgOv .rd:first-child{border-top:0}
  #lgOv .rd .n{width:26px;height:26px;border-radius:8px;background:#0b2a4a;color:#fff;display:grid;place-items:center;font-size:12px;font-weight:900}
  #lgOv .rd .t{flex:1}#lgOv .rd .t small{display:block;color:#6b7c93;font-weight:700;font-size:12px}
  #lgOv .rd.off{opacity:.45}
  #lgOv .rd label{display:flex;align-items:center;gap:6px;font-size:12px;color:#516b88;cursor:pointer;white-space:nowrap}
  #lgOv .rec{display:flex;align-items:center;gap:10px;padding:8px 12px;border-top:1px solid #eef2f7;font-size:14px;font-weight:700}
  #lgOv .rec:first-child{border-top:0}#lgOv .rec .v{margin-left:auto;font-weight:900;color:#c27c3a}
  #lgOv .empty{padding:24px;text-align:center;color:#8a99ad;font-weight:700}
  #lgOv footer{display:flex;gap:10px;padding:14px 20px;border-top:1px solid #e3e9f1;align-items:center}
  #lgOv footer button{border:0;cursor:pointer;font:inherit;font-weight:900;border-radius:14px;padding:13px 18px;font-size:16px;background:#eef2f7;color:#0b2a4a}
  #lgOv footer .final{background:#f2c14e;color:#2b1d00;font-size:18px;padding:14px 24px;box-shadow:0 4px 0 #d9a21b}
  #lgOv footer .sp{flex:1}#lgOv footer .warn{background:#fff;color:#c2364f;border:1px solid #f3c1c9;font-size:13px;padding:10px 12px}
  #recPill{position:fixed;left:50%;bottom:18px;transform:translateX(-50%);z-index:7;background:rgba(11,42,74,.88);color:#fff;border:2px solid #f2c14e;border-radius:999px;padding:9px 18px;font:800 clamp(13px,1.15vw,19px) Pretendard,sans-serif;display:none;gap:10px;align-items:center;box-shadow:0 6px 20px rgba(0,0,0,.3);pointer-events:none;white-space:nowrap}
  #recPill.on{display:flex}#recPill b{color:#ffe15a}#recPill .k{font-size:.72em;letter-spacing:1.5px;color:#f2c14e}
  #recOv{position:fixed;inset:0;z-index:95;display:none;place-items:center;background:radial-gradient(circle at 50% 45%,rgba(70,36,0,.9),rgba(0,0,0,.95));font-family:Pretendard,sans-serif;cursor:pointer}
  #recOv.on{display:grid}
  #recOv canvas{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}
  #recOv .c{position:relative;text-align:center;color:#fff;animation:recIn .7s cubic-bezier(.2,1.5,.4,1)}
  #recOv .k{font-weight:900;letter-spacing:6px;font-size:clamp(16px,1.8vw,30px);color:#ffe15a;text-shadow:0 0 20px rgba(255,200,0,.8)}
  #recOv .t{font-weight:900;font-size:clamp(46px,6.8vw,124px);line-height:1;margin:8px 0 14px;background:linear-gradient(180deg,#fff7c2,#ffcf33 55%,#e89b00);-webkit-background-clip:text;background-clip:text;color:transparent;filter:drop-shadow(0 6px 0 rgba(0,0,0,.35))}
  #recOv .nm{font-weight:900;font-size:clamp(34px,4.6vw,84px)}
  #recOv .lb{font-weight:800;font-size:clamp(16px,1.6vw,28px);color:#cfe0f5;margin-top:10px}
  #recOv .v{display:inline-block;margin-top:14px;font-weight:900;font-size:clamp(30px,3.6vw,64px);background:#fff;color:#0b2a4a;border-radius:20px;padding:6px 26px;border:5px solid #f2c14e}
  #recOv .pv{margin-top:12px;color:#9fb6d3;font-weight:700;font-size:clamp(13px,1.1vw,19px)}
  @keyframes recIn{from{transform:scale(.3);opacity:0}}`;
  document.head.appendChild(css);

  /* ── 리그 버튼 + 창 ── */
  const btn = document.createElement('button'); btn.id = 'lgBtn'; btn.textContent = '🏆 리그'; btn.title = '오늘의 리그 · SUMUS RECORD';
  btn.onmousedown = (e) => e.preventDefault();
  const mountBtn = () => { const bar = document.getElementById('gameSwitch'); if (bar && !bar.contains(btn)) bar.appendChild(btn); else if (!bar && !btn.parentNode) { const h = document.querySelector('.hud-tr') || document.getElementById('hudR'); if (h) h.prepend(btn); } };
  mountBtn(); setTimeout(mountBtn, 500);
  const ov = document.createElement('div'); ov.id = 'lgOv';
  ov.innerHTML = `<div class="box"><header><h2>🏆 오늘의 리그</h2><small id="lgSub"></small><span class="sp"></span><button class="x" id="lgX">✕</button></header>
    <div class="body"><div class="col"><h3>누적 순위 <span style="font-weight:700;font-size:12px;color:#8a99ad">1등 10 · 2등 8 · 3등 6 · 상위 30% 4 · 참가 2점</span></h3><div class="scroll" id="lgSt"></div></div>
    <div class="col"><h3>지금까지 한 판</h3><div class="scroll" id="lgRd" style="flex:1.3"></div><h3 style="margin-top:12px">🏅 SUMUS RECORD <span style="font-weight:700;font-size:12px;color:#8a99ad">이 PC에 저장된 역대 최고 기록</span></h3><div class="scroll" id="lgRec"></div></div></div>
    <footer><button class="final" id="lgFinal">🎉 최종 정산</button><button id="lgCsv">CSV 저장</button><span class="sp"></span><button class="warn" id="lgReset">리그 새로 시작</button><button class="warn" id="lgRecReset">기록 초기화</button></footer></div>`;
  document.body.appendChild(ov);
  const $ = (id) => document.getElementById(id);
  btn.onclick = () => { render(); ov.classList.add('on'); };
  $('lgX').onclick = () => ov.classList.remove('on');
  ov.onclick = (e) => { if (e.target === ov) ov.classList.remove('on'); };

  const fmtTime = (t) => { const d = new Date(t); return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`; };
  function render() {
    $('lgSub').textContent = `방 ${sess.pin} · ${league.rounds.filter(r => r.counted).length}판 반영`;
    const st = league.standings || [];
    $('lgSt').innerHTML = st.length ? `<table><tr><th>순위</th><th>이름</th><th>총점</th><th>참가</th><th>1등</th></tr>${st.map((s, i) => `<tr class="g${i + 1}"><td class="rk">${i + 1}</td><td><span class="dot" style="background:${esc(s.color)}"></span>${esc(s.name)}</td><td class="tot">${s.total}</td><td>${s.played}판</td><td>${s.golds ? '🥇×' + s.golds : ''}</td></tr>`).join('')}</table>`
      : '<div class="empty">아직 끝난 판이 없어요.<br>게임을 한 판 끝내면 여기에 점수가 쌓여요.</div>';
    $('lgRd').innerHTML = league.rounds.length ? league.rounds.slice().reverse().map(r => {
      const w = r.entries[0];
      return `<div class="rd ${r.counted ? '' : 'off'}"><span class="n">${r.id}</span><span class="t">${esc(r.name)} · ${esc(r.label)}<small>${fmtTime(r.at)} · ${r.entries.length}명 · 1등 ${esc(w ? w.name : '-')}${r.why === 'stop' ? ' · 중간에 멈춤' : ''}</small></span><label><input type="checkbox" data-id="${r.id}" ${r.counted ? 'checked' : ''}> 리그에 반영</label></div>`;
    }).join('') : '<div class="empty">아직 없어요</div>';
    const recs = load(RKEY, {}), keys = Object.keys(recs).sort();
    $('lgRec').innerHTML = keys.length ? keys.map(k => { const r = recs[k]; return `<div class="rec"><span>${esc(r.label)}</span><span class="dot" style="background:${esc(r.color)};margin-left:8px"></span>${esc(r.name)}<span class="v">${esc(r.text)}</span></div>`; }).join('') : '<div class="empty">아직 기록이 없어요</div>';
  }
  $('lgRd').onchange = (e) => { const c = e.target.closest('input[data-id]'); if (c) socket.emit('league:toggle', { id: +c.dataset.id, counted: c.checked }); };
  $('lgReset').onclick = () => { if (confirm('오늘의 리그 점수를 모두 지우고 새로 시작할까요? (SUMUS RECORD 는 지워지지 않아요)')) socket.emit('league:reset'); };
  $('lgRecReset').onclick = () => { if (confirm('이 PC에 저장된 SUMUS RECORD 를 모두 지울까요? 되돌릴 수 없어요.')) { store(RKEY, {}); render(); pill(); } };
  $('lgCsv').onclick = () => {
    const rds = league.rounds.filter(r => r.counted), st = league.standings || [];
    const q = (v) => '"' + String(v ?? '').replace(/"/g, '""') + '"';
    const head = ['순위', '이름', '총점', '참가 판 수', '1등 횟수', ...rds.map(r => `${r.id}. ${r.name} ${r.label}`)];
    const rows = st.map((s, i) => [i + 1, s.name, s.total, s.played, s.golds, ...rds.map(r => (s.by && s.by[r.id] != null ? s.by[r.id] : ''))]);
    const csv = '﻿' + [head, ...rows].map(r => r.map(q).join(',')).join('\r\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const d = new Date(); a.download = `수업리그_${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}_방${sess.pin}.csv`; a.click();
  };
  $('lgFinal').onclick = () => {
    const st = (league.standings || []).filter(s => !s.bot || true);
    if (!st.length) return alert('아직 끝난 판이 없어요.');
    if (!confirm('최종 정산을 할까요? 프로젝터와 학생 폰에 오늘의 최종 순위가 나와요.')) return;
    socket.emit('league:final');
    ov.classList.remove('on');
    const entries = st.map(s => ({ id: s.id, name: s.name, color: s.color, main: s.total + '점', stats: [s.golds ? `1등 ${s.golds}회` : null, `${s.played}판 참가`].filter(Boolean) }));
    if (window.CEREMONY && CEREMONY.show) CEREMONY.show({ title: '오늘의 리그 최종 정산', subtitle: `${league.rounds.filter(r => r.counted).length}판 · ${st.length}명`, badge: 'SUMUS LEAGUE', ranking: entries, buttons: [{ label: '닫기', primary: true, onClick: () => CEREMONY.hide() }], muted });
    else { render(); ov.classList.add('on'); }
  };

  /* ── 서버와 동기화 (서버가 비었으면 이 PC 사본으로 되살림) ── */
  socket.on('league:update', (m) => { if (!m || !Array.isArray(m.rounds)) return; league = m; store(LKEY, league); if (ov.classList.contains('on')) render(); });
  let synced = false;
  function sync() {
    socket.emit('league:get', null, (r) => {
      if (!r || !r.ok) { setTimeout(sync, 1500); return; } // 아직 호스트로 연결 전
      synced = true;
      if (!r.rounds.length && league.rounds.length) socket.emit('league:restore', { rounds: league.rounds }, (x) => { if (x && x.ok) { league = x; store(LKEY, league); } });
      else { league = r; store(LKEY, league); }
    });
  }
  socket.on('connect', () => { synced = false; setTimeout(sync, 800); });
  if (socket.connected) setTimeout(sync, 800);

  /* ── SUMUS RECORD ── */
  const isBot = (e) => e.bot || /\(봇\)$/.test(e.name || '');
  const DIST = { 1: '보통', 1.5: '길게', 2: '아주 길게' };
  // 게임 결과 → 이번 판 최고 기록 후보
  function candidate(kind, res, ph) {
    const rk = (res.ranking || []).filter(e => !isBot(e));
    if (!rk.length) return null;
    if (kind === 'quiz') { const b = rk.reduce((a, e) => ((e.correct ?? Math.round((e.score || 0) / 100)) > (a.correct ?? Math.round((a.score || 0) / 100)) ? e : a)); const v = b.correct ?? Math.round((b.score || 0) / 100); return v > 0 && { key: 'quiz', label: 'PART 1 퀴즈쇼 · 한 판 최다 정답', v, text: v + '개', low: false, e: b }; }
    if (kind === 'mg') { const f = rk.filter(e => e.fin && e.t); if (!f.length) return null; const b = f.reduce((a, e) => (e.t < a.t ? e : a)); const d = res.dist || ph.dist || 1.5; return { key: 'mg:' + d, label: `PART 2 무궁화 · 최단 결승 (거리 ${DIST[d] || d})`, v: b.t, text: b.t.toFixed(1) + '초', low: true, e: b }; }
    if (kind === 'jr') { const b = rk.reduce((a, e) => ((e.score || 0) > (a.score || 0) ? e : a)); return b.score > 0 && { key: 'jr', label: 'PART 3 줄넘기 · 한 판 최고 점수', v: b.score, text: b.score.toLocaleString() + '점', low: false, e: b }; }
    if (kind === 'bk') { const b = rk.reduce((a, e) => ((e.score || 0) > (a.score || 0) ? e : a)); const k = res.mode === 'score' ? String(res.time) : 'out'; return b.score > 0 && { key: 'bk:' + k, label: `PART 4 바나나킥 · 최고 점수 (${res.mode === 'score' ? '점수전 ' + Math.round(res.time / 60) + '분' : '탈락'})`, v: b.score, text: b.score.toLocaleString() + '점', low: false, e: b }; }
    return null;
  }
  let lastPhase = {}, seen = new Set();
  function onPhase(p) {
    if (!p) return; lastPhase = p; pill();
    if (p.phase !== 'end' || !p.result) return;
    const sig = cur + ':' + JSON.stringify((p.result.ranking || []).slice(0, 5).map(e => [e.id, e.score, e.t]));
    if (seen.has(sig) || sessionStorage.getItem('sumus-recsig') === sig) return;
    seen.add(sig); sessionStorage.setItem('sumus-recsig', sig);
    const c = candidate(cur, p.result, p); if (!c) return;
    const recs = load(RKEY, {}), old = recs[c.key];
    const better = !old || (c.low ? c.v < old.v : c.v > old.v);
    if (!better) return;
    recs[c.key] = { label: c.label, v: c.v, text: c.text, name: c.e.name, color: c.e.color, at: Date.now() };
    store(RKEY, recs);
    const prev = old ? `이전 기록 ${old.name} · ${old.text}` : '첫 기록!';
    setTimeout(() => { celebrate(c, prev); socket.emit('rec:new', { kind: cur, label: c.label, value: c.text, prev, name: c.e.name, id: c.e.id }); }, 7600); // 시상식이 끝난 뒤
  }
  for (const ev of ['phase', 'mg:phase', 'jr:phase', 'bk:phase']) socket.on(ev, onPhase);

  // 대기실에서 이 게임의 현재 기록 보여 주기 (도전 목표)
  const pillEl = document.createElement('div'); pillEl.id = 'recPill'; document.body.appendChild(pillEl);
  function recKey() {
    if (cur === 'mg') return 'mg:' + (lastPhase.dist || 1.5);
    if (cur === 'bk') return 'bk:' + (lastPhase.mode === 'score' ? String(lastPhase.time || 120) : 'out');
    return cur;
  }
  function pill() {
    const r = load(RKEY, {})[recKey()];
    const show = lastPhase.phase === 'lobby' && r;
    pillEl.classList.toggle('on', !!show);
    if (show) pillEl.innerHTML = `<span class="k">SUMUS RECORD</span> ${esc(r.name)} · <b>${esc(r.text)}</b> <span style="opacity:.75;font-size:.85em">도전해 보세요!</span>`;
  }

  // 신기록 축하 (빵빠레 + 폭죽)
  const rOv = document.createElement('div'); rOv.id = 'recOv'; rOv.innerHTML = '<canvas></canvas><div class="c"></div>'; document.body.appendChild(rOv);
  rOv.onclick = () => rOv.classList.remove('on');
  function celebrate(c, prev) {
    rOv.querySelector('.c').innerHTML = `<div class="k">★ NEW SUMUS RECORD ★</div><div class="t">신기록!</div><div class="nm" style="color:${esc(c.e.color)}">${esc(c.e.name)}</div><div class="lb">${esc(c.label)}</div><div class="v">${esc(c.text)}</div><div class="pv">${esc(prev)}</div>`;
    rOv.classList.add('on'); fanfare(); fireworks(rOv.querySelector('canvas'), 6500);
    setTimeout(() => rOv.classList.remove('on'), 9000);
  }
  let AC = null;
  function fanfare() {
    if (muted()) return;
    try {
      AC = AC || new (window.AudioContext || window.webkitAudioContext)(); const t0 = AC.currentTime + 0.05;
      const note = (f, t, d, type, v) => { const o = AC.createOscillator(), g = AC.createGain(); o.type = type || 'square'; o.frequency.value = f; g.gain.setValueAtTime(0, t0 + t); g.gain.linearRampToValueAtTime(v || 0.12, t0 + t + 0.02); g.gain.exponentialRampToValueAtTime(0.001, t0 + t + d); o.connect(g).connect(AC.destination); o.start(t0 + t); o.stop(t0 + t + d + 0.05); };
      // 빰-빰-빰-빠아암! (도-도-도-솔↑ 화음)
      [[523, 0], [523, 0.16], [523, 0.32]].forEach(([f, t]) => { note(f, t, 0.13); note(f * 1.5, t, 0.13, 'triangle', 0.06); });
      [523, 659, 784, 1047].forEach((f) => note(f, 0.5, 1.4, f > 900 ? 'square' : 'triangle', 0.1));
      note(1319, 0.9, 1.1, 'triangle', 0.08); note(1568, 1.15, 1.2, 'triangle', 0.08);
      for (let i = 0; i < 14; i++) note(180 + Math.random() * 120, 0.5 + i * 0.04, 0.05, 'sawtooth', 0.03); // 드럼 롤 꼬리
    } catch (e) {}
  }
  function fireworks(cv, ms) {
    const ctx = cv.getContext('2d'), DPR = Math.min(2, devicePixelRatio || 1); cv.width = innerWidth * DPR; cv.height = innerHeight * DPR; ctx.scale(DPR, DPR);
    const P = [], cols = ['#ffe15a', '#ff6b8a', '#6be3ff', '#9dff7a', '#ffffff', '#ffb347'], t0 = performance.now();
    const burst = () => { const x = innerWidth * (0.15 + Math.random() * 0.7), y = innerHeight * (0.12 + Math.random() * 0.4), c = cols[(Math.random() * cols.length) | 0]; for (let i = 0; i < 70; i++) { const a = Math.random() * 6.28, s = 2 + Math.random() * 6; P.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, l: 1, c }); } };
    let next = 0;
    (function f(now) {
      if (now - t0 > ms + 2000 || !rOv.classList.contains('on')) { ctx.clearRect(0, 0, innerWidth, innerHeight); return; }
      if (now - t0 < ms && now > next) { burst(); next = now + 260 + Math.random() * 420; }
      ctx.clearRect(0, 0, innerWidth, innerHeight);
      for (let i = P.length - 1; i >= 0; i--) { const p = P[i]; p.x += p.vx; p.y += p.vy; p.vy += 0.09; p.vx *= 0.985; p.l -= 0.012; if (p.l <= 0) { P.splice(i, 1); continue; } ctx.globalAlpha = p.l; ctx.fillStyle = p.c; ctx.beginPath(); ctx.arc(p.x, p.y, 2.6, 0, 6.29); ctx.fill(); }
      ctx.globalAlpha = 1; requestAnimationFrame(f);
    })(t0);
  }
  window.SUMUS_LEAGUE = { open: () => btn.click(), celebrate, candidate };
})();
