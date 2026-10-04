// 수업 방(홈에서 연 방)일 때: 선생님 화면에 PART 1 ↔ PART 2 전환 버튼
// host.html / mg-host.html 공용 — 각 페이지의 socket, phase, validQuestions 를 그대로 사용
(() => {
  const SESS = 'sumus-sess', QK = 'sumus-island-quiz:v1:host', MK = 'sumus-mg:host';
  const sess = JSON.parse(sessionStorage.getItem(SESS) || 'null');
  if (!sess) return;
  const isMg = location.pathname.startsWith('/mg');
  const mine = () => JSON.parse(sessionStorage.getItem(isMg ? MK : QK) || 'null');
  const inSession = () => { const c = mine(); return !!(c && c.pin === sess.pin); };

  const btn = document.createElement('button');
  btn.className = 'ibtn'; btn.id = 'switchBtn';
  btn.style.cssText = 'width:auto;padding:0 14px;font-weight:800;font-size:14px;background:rgba(242,193,78,.95);color:#0b2a4a';
  btn.textContent = isMg ? '◀ PART 1 퀴즈쇼' : 'PART 2 무궁화 ▶';
  btn.title = '학생 화면도 함께 넘어갑니다';
  btn.onmousedown = (e) => e.preventDefault(); // 포커스가 남아 Space(진행)로 다시 눌리지 않게
  (document.querySelector(isMg ? '#hudR' : '.hud-tr')).prepend(btn);
  const paint = () => { btn.style.display = inSession() ? '' : 'none'; };
  paint(); setInterval(paint, 1000);

  const busy = () => isMg ? ['ready', 'play'].includes(phase.phase) : ['question', 'reveal'].includes(phase.phase);
  btn.onclick = () => {
    if (!inSession()) return;
    const to = isMg ? 'PART 1 퀴즈쇼' : 'PART 2 무궁화 꽃이 피었습니다';
    if (!confirm((busy() ? '진행 중인 게임을 끝내고 ' : '') + `학생 화면을 ${to}로 넘길까요?`)) return;
    btn.disabled = true;
    socket.emit('sess:switch', isMg ? 'quiz' : 'mg', (r) => {
      btn.disabled = false;
      if (!r || !r.ok) return alert((r && r.error) || '넘기지 못했습니다. 다시 눌러 주세요.');
      sessionStorage.setItem(QK, JSON.stringify(r.quiz));
      sessionStorage.setItem(MK, JSON.stringify(r.mg));
      location.href = isMg ? '/host' : '/mg';
    });
  };

  // 방에 문제가 없으면(홈에서 못 보냈거나 서버가 방을 새로 만든 경우) 이 화면의 문제 목록으로 채움
  if (!isMg) {
    let checked = false;
    socket.on('phase', (p) => {
      if (checked || !inSession()) return;
      checked = true;
      if (p.phase === 'lobby' && !p.total) { const qs = validQuestions(); if (qs.length) socket.emit('host:config', { questions: qs }); }
    });
  }
})();
