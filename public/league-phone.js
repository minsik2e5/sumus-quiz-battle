// 오늘의 리그 + SUMUS RECORD (학생 폰 공용 — play.html / mg-play.html / jr-play.html / bk-play.html 에서 불러옴)
// - 한 판이 끝나면 "리그 +10점 · 누적 24점 (3위)" 알림
// - 선생님이 최종 정산하면 내 최종 순위 카드
// - 내가 SUMUS RECORD 를 깨면 빵빠레 축하 화면, 친구가 깨면 짧은 알림
(() => {
  if (window.__sumusLeaguePhone || typeof socket === 'undefined') return; window.__sumusLeaguePhone = true;
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const myId = () => { try { return JSON.parse(localStorage.getItem('sumus-island-player') || '{}').pid || null; } catch (e) { return null; } };
  const muted = () => { const m = localStorage.getItem('sumus-island-mute'); return m === '1' || m === 'true'; };
  const buzz = (p) => { try { navigator.vibrate && navigator.vibrate(p); } catch (e) {} };

  const css = document.createElement('style');
  css.textContent = `
  #lpToast{position:fixed;left:50%;top:calc(64px + env(safe-area-inset-top));transform:translate(-50%,-20px);z-index:120;background:#0b2a4a;color:#fff;border:2px solid #f2c14e;border-radius:16px;padding:10px 16px;font:800 15px Pretendard,sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.35);opacity:0;transition:.35s;pointer-events:none;text-align:center;max-width:92vw}
  #lpToast.on{opacity:1;transform:translate(-50%,0)}#lpToast b{color:#ffe15a}
  #lpOv{position:fixed;inset:0;z-index:130;display:none;place-items:center;background:rgba(4,14,30,.9);font-family:Pretendard,sans-serif;padding:18px}
  #lpOv.on{display:grid}
  #lpOv canvas{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}
  #lpOv .card{position:relative;width:min(420px,100%);max-height:100%;overflow:auto;background:#fff;border-radius:24px;border:5px solid #f2c14e;box-shadow:0 8px 0 #d9a21b;padding:20px 18px;text-align:center;color:#0b2a4a;animation:lpIn .6s cubic-bezier(.2,1.5,.4,1)}
  #lpOv .k{font-weight:900;letter-spacing:3px;color:#c27c3a;font-size:13px}
  #lpOv .big{font-weight:900;font-size:64px;line-height:1;margin:6px 0}
  #lpOv .sub{font-weight:800;color:#516b88;font-size:15px}
  #lpOv .pts{display:inline-block;margin-top:10px;background:#0b2a4a;color:#ffe15a;font-weight:900;font-size:22px;border-radius:14px;padding:6px 18px}
  #lpOv ul{list-style:none;padding:0;margin:14px 0 0;text-align:left}
  #lpOv li{display:flex;gap:8px;align-items:center;padding:8px 4px;border-top:1px solid #eef2f7;font-weight:700;font-size:14px}
  #lpOv li .r{margin-left:auto;font-weight:900}
  #lpOv .lptop{display:flex;justify-content:center;gap:8px;margin-top:12px;font-weight:800;font-size:13px;flex-wrap:wrap}
  #lpOv .lptop span{background:#f4f7fb;border-radius:10px;padding:6px 10px}
  #lpOv .close{margin-top:16px;border:0;border-radius:14px;background:#f2c14e;color:#2b1d00;font:900 17px Pretendard,sans-serif;padding:12px 28px}
  #lpOv.rec .card{background:linear-gradient(180deg,#fff7d6,#fff);}
  #lpOv.rec .big{font-size:52px;background:linear-gradient(180deg,#ffcf33,#e89b00);-webkit-background-clip:text;background-clip:text;color:transparent}
  @keyframes lpIn{from{transform:scale(.4);opacity:0}}`;
  document.head.appendChild(css);
  const toast = document.createElement('div'); toast.id = 'lpToast'; document.body.appendChild(toast);
  const ov = document.createElement('div'); ov.id = 'lpOv'; ov.innerHTML = '<canvas></canvas><div class="card"></div>'; document.body.appendChild(ov);
  let tt = 0;
  function showToast(html, ms) { toast.innerHTML = html; toast.classList.add('on'); clearTimeout(tt); tt = setTimeout(() => toast.classList.remove('on'), ms || 4200); }
  function showCard(html, rec) { ov.classList.toggle('rec', !!rec); ov.querySelector('.card').innerHTML = html + '<button class="close">확인</button>'; ov.classList.add('on'); ov.querySelector('.close').onclick = () => ov.classList.remove('on'); confetti(ov.querySelector('canvas'), rec ? 5000 : 3000); }

  // 한 판이 끝날 때: 처음 받은 목록은 기준으로만 쓰고, 그 뒤 새로 생긴 판만 알림
  let knownMax = null;
  socket.on('league:update', (m) => {
    try {
      if (!m || !Array.isArray(m.rounds)) return;
      const max = Math.max(0, ...m.rounds.map(r => r.id));
      const fresh = knownMax == null ? [] : m.rounds.filter(r => r.id > knownMax);
      knownMax = knownMax == null ? max : Math.max(knownMax, max);
      const id = myId(); if (!id) return;
      for (const r of fresh) {
        const e = r.entries.find(x => x.id === id); if (!e) continue;
        const i = (m.standings || []).findIndex(s => s.id === id), s = m.standings[i];
        setTimeout(() => showToast(`🏆 리그 <b>+${e.pts}점</b>${r.counted ? '' : ' (반영 안 됨)'}<br><span style="font-weight:700;font-size:13px">누적 ${s ? s.total : 0}점 · 지금 ${i + 1}위 / ${m.standings.length}명</span>`, 5000), 2500);
      }
    } catch (e) {}
  });
  // 최종 정산
  socket.on('league:final', (m) => {
    try {
      const id = myId(), st = m.standings || [], i = st.findIndex(s => s.id === id), s = st[i];
      const rounds = (m.rounds || []).filter(r => r.counted);
      const mine = rounds.map(r => ({ r, e: r.entries.find(x => x.id === id) })).filter(x => x.e);
      const msg = !s ? '오늘 리그 기록이 없어요' : i === 0 ? '오늘의 MVP! 🎉' : i < 3 ? '시상대에 올랐어요!' : i < Math.ceil(st.length * 0.3) ? '아주 잘했어요!' : '오늘도 수고했어요!';
      showCard(`<div class="k">SUMUS LEAGUE · 최종 정산</div><div class="big">${s ? (i + 1) + '위' : '-'}</div><div class="sub">${st.length}명 중 · ${esc(msg)}</div>${s ? `<div class="pts">${s.total}점</div>` : ''}
        <ul>${mine.map(x => `<li>${esc(x.r.name)} <span style="color:#8a99ad;font-size:12px">${esc(x.r.label)}</span><span class="r">${x.e.rank}등 · +${x.e.pts}</span></li>`).join('')}</ul>
        <div class="lptop">${st.slice(0, 3).map((t, k) => `<span>${['🥇', '🥈', '🥉'][k]} ${esc(t.name)} ${t.total}점</span>`).join('')}</div>`);
      buzz([80, 60, 160]); if (i === 0) fanfare();
    } catch (e) {}
  });
  // SUMUS RECORD
  socket.on('rec:news', (d) => {
    try {
      if (!d) return;
      if (d.id && d.id === myId()) {
        showCard(`<div class="k">★ NEW SUMUS RECORD ★</div><div class="big">신기록!</div><div class="sub">${esc(d.label)}</div><div class="pts">${esc(d.value)}</div><div class="sub" style="margin-top:10px;font-size:13px">${esc(d.prev)}</div>`, true);
        fanfare(); buzz([120, 60, 120, 60, 400]);
      } else showToast(`🎉 <b>${esc(d.name)}</b> 신기록!<br><span style="font-weight:700;font-size:13px">${esc(d.label)} · ${esc(d.value)}</span>`, 5000);
    } catch (e) {}
  });

  let AC = null;
  function fanfare() {
    if (muted()) return;
    try {
      AC = AC || new (window.AudioContext || window.webkitAudioContext)(); const t0 = AC.currentTime + 0.05;
      const note = (f, t, d, type, v) => { const o = AC.createOscillator(), g = AC.createGain(); o.type = type || 'square'; o.frequency.value = f; g.gain.setValueAtTime(0, t0 + t); g.gain.linearRampToValueAtTime(v || 0.1, t0 + t + 0.02); g.gain.exponentialRampToValueAtTime(0.001, t0 + t + d); o.connect(g).connect(AC.destination); o.start(t0 + t); o.stop(t0 + t + d + 0.05); };
      [0, 0.15, 0.3].forEach(t => note(523, t, 0.12)); [523, 659, 784, 1047].forEach(f => note(f, 0.46, 1.2, 'triangle', 0.09));
    } catch (e) {}
  }
  function confetti(cv, ms) {
    const ctx = cv.getContext('2d'), DPR = Math.min(2, devicePixelRatio || 1); cv.width = innerWidth * DPR; cv.height = innerHeight * DPR; ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    const cols = ['#ffe15a', '#ff6b8a', '#6be3ff', '#9dff7a', '#ffb347'], P = Array.from({ length: 90 }, () => ({ x: Math.random() * innerWidth, y: -Math.random() * innerHeight * 0.6, vy: 1.5 + Math.random() * 2.5, vx: Math.random() * 2 - 1, r: Math.random() * 6.28, c: cols[(Math.random() * cols.length) | 0] }));
    const t0 = performance.now();
    (function f(now) {
      if (now - t0 > ms || !ov.classList.contains('on')) { ctx.clearRect(0, 0, innerWidth, innerHeight); return; }
      ctx.clearRect(0, 0, innerWidth, innerHeight);
      for (const p of P) { p.x += p.vx; p.y += p.vy; p.r += 0.1; if (p.y > innerHeight + 10) p.y = -10; ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.fillStyle = p.c; ctx.fillRect(-4, -2, 8, 4); ctx.restore(); }
      requestAnimationFrame(f);
    })(t0);
  }
})();
