// 수업 방(홈에서 연 방) 선생님 화면 공용: PART 1·2·3 중 아무 때나 골라서 넘어가는 전환 막대
// host.html / mg-host.html / jr-host.html 끝에서 불러옴 — 각 페이지의 socket, phase 를 그대로 사용
(() => {
  const SESS = 'sumus-sess';
  const KEYS = { quiz: 'sumus-island-quiz:v1:host', mg: 'sumus-mg:host', jr: 'sumus-jr:host', bk: 'sumus-bk:host' };
  const GAMES = [
    { id: 'quiz', label: '퀴즈쇼', no: '1', path: '/host', busy: ['question', 'reveal'] },
    { id: 'mg', label: '무궁화', no: '2', path: '/mg', busy: ['ready', 'play'] },
    { id: 'jr', label: '줄넘기', no: '3', path: '/jr', busy: ['ready', 'play'] },
    { id: 'bk', label: '바나나킥', no: '4', path: '/bk', busy: ['ready', 'play'] },
  ];
  let sess = null; try { sess = JSON.parse(sessionStorage.getItem(SESS) || 'null'); } catch (e) {}
  if (!sess) return;
  const cur = location.pathname.startsWith('/mg') ? 'mg' : location.pathname.startsWith('/jr') ? 'jr' : location.pathname.startsWith('/bk') ? 'bk' : 'quiz';
  const mine = () => { try { return JSON.parse(sessionStorage.getItem(KEYS[cur]) || 'null'); } catch (e) { return null; } };
  const inSession = () => { const c = mine(); return !!(c && c.pin === sess.pin); };

  const css = document.createElement('style');
  css.textContent = `
    #gameSwitch{display:flex;gap:3px;padding:4px;border-radius:14px;background:rgba(11,42,74,.82);box-shadow:0 2px 10px rgba(0,0,0,.25);align-items:center}
    #gameSwitch button{border:0;cursor:pointer;font:inherit;font-weight:800;font-size:13px;line-height:1;padding:9px 12px;border-radius:10px;background:transparent;color:#cfe0f5;white-space:nowrap;display:flex;gap:6px;align-items:center}
    #gameSwitch button b{display:inline-grid;place-items:center;width:18px;height:18px;border-radius:50%;background:rgba(255,255,255,.18);font-size:11px}
    #gameSwitch button:hover{background:rgba(255,255,255,.14);color:#fff}
    #gameSwitch button.on{background:#f2c14e;color:#2b1d00;cursor:default}
    #gameSwitch button.on b{background:rgba(0,0,0,.15)}
    #gameSwitch button:disabled{opacity:.6;cursor:wait}
    @media (max-width:760px){#gameSwitch button span{display:none}}
    @media (max-width:1100px){#gameSwitch button{padding:8px 9px}}`;
  document.head.appendChild(css);

  const bar = document.createElement('div'); bar.id = 'gameSwitch'; bar.title = '게임 바꾸기 — 학생 화면도 함께 넘어갑니다';
  bar.innerHTML = GAMES.map(g => `<button data-g="${g.id}" class="${g.id === cur ? 'on' : ''}"><b>${g.no}</b><span>${g.label}</span></button>`).join('');
  let mount = document.querySelector('.hud-tr') || document.getElementById('hudR');
  if (!mount) { mount = document.createElement('div'); mount.style.cssText = 'position:fixed;right:18px;top:18px;z-index:5;display:flex;gap:8px'; document.body.appendChild(mount); }
  mount.prepend(bar);
  const paint = () => { bar.style.display = inSession() ? '' : 'none'; };
  paint(); setInterval(paint, 1000);

  bar.onmousedown = (e) => e.preventDefault(); // 포커스가 남아 Space(진행)로 다시 눌리지 않게
  bar.onclick = (e) => {
    const b = e.target.closest('button'); if (!b || b.classList.contains('on') || !inSession()) return;
    const to = GAMES.find(g => g.id === b.dataset.g), from = GAMES.find(g => g.id === cur);
    const busy = from.busy.includes(typeof phase !== 'undefined' && phase ? phase.phase : '');
    if (!confirm((busy ? `진행 중인 ${from.label}을(를) 끝내고 ` : '') + `학생 화면을 ${to.no}. ${to.label}(으)로 넘길까요?`)) return;
    bar.querySelectorAll('button').forEach(x => x.disabled = true);
    socket.emit('sess:switch', to.id, (r) => {
      bar.querySelectorAll('button').forEach(x => x.disabled = false);
      if (!r || !r.ok) return alert((r && r.error) || '넘기지 못했습니다. 다시 눌러 주세요.');
      for (const k of Object.keys(KEYS)) if (r[k]) sessionStorage.setItem(KEYS[k], JSON.stringify(r[k]));
      location.href = to.path;
    });
  };

  // 방에 문제가 없으면(홈에서 못 보냈거나 서버가 방을 새로 만든 경우) 이 화면의 문제 목록으로 채움
  if (cur === 'quiz') {
    let checked = false;
    socket.on('phase', (p) => {
      if (checked || !inSession()) return;
      checked = true;
      if (p.phase === 'lobby' && !p.total && typeof validQuestions === 'function') { const qs = validQuestions(); if (qs.length) socket.emit('host:config', { questions: qs }); }
    });
  }
})();
