(() => {
  'use strict';

  const $ = (sel) => document.querySelector(sel);
  const state = {
    key: sessionStorage.getItem('study.teacherKey') || '',
    classes: [],
    target: 'ALL',
    day: '',
    today: '',
    data: null,
    timer: null
  };
  const STATUS = { study: '공부 중', rest: '쉬는 중', away: '자리 비움', offline: '오프라인' };
  const CAM = { down: '📷 고개 숙임', up: '📷 고개 듦', yawn: '📷 하품', sleep: '📷 💤 조는 중', gone: '📷 자리 비움' };

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function fmtShort(ms) {
    const m = Math.floor(ms / 60000);
    if (m < 60) return `${m}분`;
    return `${Math.floor(m / 60)}시간 ${m % 60}분`;
  }

  function fmtSeen(at) {
    if (!at) return '-';
    const d = new Date(at);
    return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }

  async function api(path, { method = 'GET', body } = {}) {
    const res = await fetch(path, {
      method,
      headers: { 'Content-Type': 'application/json', 'X-Teacher-Key': state.key },
      body: body ? JSON.stringify(body) : undefined
    });
    if (res.status === 401) {
      showLogin('선생님 키가 올바르지 않아요.');
      throw new Error('unauthorized');
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || '문제가 생겼어요.');
    return data;
  }

  function showLogin(message) {
    clearInterval(state.timer);
    sessionStorage.removeItem('study.teacherKey');
    $('#app').hidden = true;
    $('#login').hidden = false;
    $('#login-err').textContent = message || '';
    $('#key').focus();
  }

  async function loadClasses() {
    const data = await api('/api/teacher/classes');
    state.classes = data.classes;
    state.today = data.today;
    if (!state.day) state.day = data.today;
    if (state.target !== 'ALL' && !state.classes.some((c) => c.code === state.target)) state.target = 'ALL';
    renderClasses();
  }

  function renderClasses() {
    const total = state.classes.reduce((n, c) => n + c.count, 0);
    const rows = [{ code: 'ALL', name: '🏫 학원 전체', count: total }, ...state.classes];
    $('#classes').innerHTML = rows.map((c) => `<button class="cls${c.code === state.target ? ' on' : ''}" data-code="${c.code}"><span>${esc(c.name)}</span><small>${c.count}명</small></button>`).join('');
  }

  async function loadOverview() {
    try {
      state.data = await api(`/api/teacher/overview?target=${encodeURIComponent(state.target)}&day=${state.day}`);
      renderMain();
    } catch (err) {
      if (err.message !== 'unauthorized') $('#main').innerHTML = `<p class="empty">${esc(err.message)}</p>`;
    }
  }

  function renderMain() {
    const d = state.data;
    $('#open-board').href = `/board?target=${encodeURIComponent(d.target)}`;
    const cls = state.classes.find((c) => c.code === d.target);
    const isAll = d.target === 'ALL';
    const link = cls ? `${location.origin}/?code=${cls.code}` : location.origin;
    const total = d.students.reduce((n, s) => n + s.dayMs, 0);
    const active = d.students.filter((s) => s.dayMs > 0);
    const avg = active.length ? total / active.length : 0;
    const isToday = d.day === d.today;
    const focusId = document.activeElement && document.activeElement.id;
    const noticeDraft = $('#notice-text') ? $('#notice-text').value : null;

    $('#main').innerHTML = `
      <div class="class-head">
        <h2>${isAll ? '학원 전체' : esc(cls.name)}</h2>
        ${cls ? `<span class="code-pill">${cls.code}</span>` : ''}
        <span class="sp"></span>
        ${cls ? `<button class="btn small primary" data-act="bulk">학생 추가</button><button class="btn small" data-act="rename">이름 바꾸기</button><button class="btn small danger" data-act="delete-class">반 삭제</button>` : ''}
      </div>
      ${cls && state.bulkOpen ? `<form class="bulk" id="bulk-form">
        <p><b>학생 한꺼번에 추가</b> · 이름을 한 줄에 하나씩 적거나 엑셀에서 이름 칸을 복사해 붙여 넣으세요. 학생마다 처음 PIN(숫자 4자리)이 만들어져요.</p>
        <textarea id="bulk-names" rows="6" placeholder="수아&#10;지율&#10;성욱"></textarea>
        <div><button class="btn small primary" type="submit">추가하기</button> <button class="btn small" type="button" data-act="bulk">닫기</button></div>
      </form>` : ''}
      ${state.bulkResults ? `<div class="bulk-result">
        <p><b>추가 결과</b> · 학생에게 <b>반 코드 ${cls ? cls.code : ''}</b>, 이름, PIN을 알려주세요. 학생은 "다시 들어가기"로 들어오면 돼요. (이 PIN 목록은 이 화면을 닫으면 다시 볼 수 없어요)</p>
        <table><thead><tr><th>이름</th><th>PIN</th><th></th></tr></thead><tbody>${state.bulkResults.map((r) => `<tr><td>${esc(r.name)}</td><td class="num">${r.pin || '-'}</td><td class="muted">${r.status === 'added' ? '추가됨' : '이미 있어서 건너뜀'}</td></tr>`).join('')}</tbody></table>
        <button class="btn small" data-act="copy-pins">이름·PIN 복사 (엑셀에 붙여넣기)</button> <button class="btn small" data-act="close-results">닫기</button>
      </div>` : ''}
      <p class="join-link">학생 입장 주소: <b>${esc(link)}</b> <button class="btn small" data-act="copy" data-link="${esc(link)}">복사</button></p>
      <div class="tiles">
        <div class="tile"><div class="k">${isToday ? '지금 공부 중' : '선택한 날'}</div><div class="v">${isToday ? `${d.studying}명` : esc(d.day)}</div></div>
        <div class="tile"><div class="k">공부한 학생</div><div class="v">${active.length} / ${d.total}명</div></div>
        <div class="tile"><div class="k">총 공부 시간</div><div class="v">${fmtShort(total)}</div></div>
        <div class="tile"><div class="k">1인 평균 (공부한 학생)</div><div class="v">${fmtShort(avg)}</div></div>
      </div>
      <div class="tools">
        <label>날짜 <input type="date" id="day" value="${d.day}" max="${d.today}"></label>
        <button class="btn small" data-act="today">오늘</button>
        <button class="btn small" data-act="csv">엑셀(CSV) 받기</button>
        <form class="notice" id="notice-form">
          <input id="notice-text" maxlength="80" placeholder="${isAll ? '학원 전체' : '이 반'} 학생들에게 보일 공지" value="${esc(d.notice ? d.notice.text : '')}">
          <button class="btn small primary" type="submit">공지 올리기</button>
          ${d.notice ? '<button class="btn small" type="button" data-act="clear-notice">내리기</button>' : ''}
        </form>
      </div>
      <div class="table-wrap">
        ${d.students.length ? `<table>
          <thead><tr><th>상태</th><th>이름</th>${isAll ? '<th>반</th>' : ''}<th>${isToday ? '오늘' : esc(d.day.slice(5))}</th><th>최근 7일</th><th>7일 추이</th><th title="카메라에 얼굴이 보인 상태로 공부한 시간">카메라 인증</th><th>연속</th><th title="공부 중 30~50분마다 뜨는 확인. ✖는 3분 안에 안 눌러서 자동으로 멈춘 횟수">집중 확인</th><th>말풍선</th><th>♥</th><th>마지막 접속</th><th></th></tr></thead>
          <tbody>${d.students.map((s) => row(s, isAll)).join('')}</tbody>
        </table>` : `<p class="empty">아직 학생이 없어요.${cls ? ` 반 코드 <b>${cls.code}</b>를 알려주세요.` : ''}</p>`}
      </div>`;
    if (noticeDraft !== null && focusId === 'notice-text') {
      $('#notice-text').value = noticeDraft;
      $('#notice-text').focus();
    }
  }

  function row(s, isAll) {
    const max = Math.max(60 * 60 * 1000, ...s.days.map((d) => d.ms));
    const spark = s.days.map((d, i) => `<i class="${i === s.days.length - 1 ? 'last' : ''}" style="height:${Math.max(2, Math.round((d.ms / max) * 26))}px" title="${d.day} ${fmtShort(d.ms)}"></i>`).join('');
    return `<tr class="s-${s.status}">
      <td><span class="dot"></span>${STATUS[s.status]}${s.cam ? `<br><small class="muted">${CAM[s.cam]}</small>` : ''}</td>
      <td><span class="face">${Avatar.face(s.avatar)}</span>${esc(s.name)}</td>
      ${isAll ? `<td>${esc(s.className)}</td>` : ''}
      <td class="num">${fmtShort(s.dayMs)}</td>
      <td class="num">${fmtShort(s.weekMs)}</td>
      <td><span class="spark">${spark}</span></td>
      <td>${s.camMs ? `${fmtShort(s.camMs)} <small class="muted">(${Math.round((s.camMs / Math.max(1, s.dayMs)) * 100)}%)</small>` : '-'}</td>
      <td>${s.streak ? `🔥${s.streak}` : '-'}</td>
      <td>${s.checksOk || s.checksMissed ? `<span class="ok">✔${s.checksOk}</span> ${s.checksMissed ? `<span class="miss">✖${s.checksMissed}</span>` : ''}` : '-'}</td>
      <td>${s.bubble ? `<span class="bub" title="${esc(s.bubble.text)}">${esc(s.bubble.text)}</span> <button class="btn small" data-act="clear-bubble" data-id="${s.id}">지우기</button>` : `<span class="muted">${s.bubblesUsed ? `${s.bubblesUsed}회` : '-'}</span>`}</td>
      <td>${s.hearts || '-'}</td>
      <td class="muted">${fmtSeen(s.lastSeen)}</td>
      <td>
        <button class="btn small" data-act="pin" data-id="${s.id}" data-name="${esc(s.name)}">PIN 재설정</button>
        <button class="btn small" data-act="move" data-id="${s.id}" data-name="${esc(s.name)}">반 이동</button>
        <button class="btn small danger" data-act="remove" data-id="${s.id}" data-name="${esc(s.name)}">삭제</button>
      </td>
    </tr>`;
  }

  async function act(btn) {
    const a = btn.dataset.act;
    const id = btn.dataset.id;
    try {
      if (a === 'bulk') {
        state.bulkOpen = !state.bulkOpen;
        renderMain();
        if (state.bulkOpen) $('#bulk-names').focus();
        return;
      } else if (a === 'close-results') {
        state.bulkResults = null;
        renderMain();
        return;
      } else if (a === 'copy-pins') {
        const text = ['이름\tPIN', ...state.bulkResults.filter((r) => r.pin).map((r) => `${r.name}\t${r.pin}`)].join('\n');
        await navigator.clipboard.writeText(text).catch(() => prompt('복사하세요', text));
        btn.textContent = '복사됨';
        return;
      } else if (a === 'today') state.day = state.today;
      else if (a === 'copy') {
        await navigator.clipboard.writeText(btn.dataset.link).catch(() => prompt('주소를 복사하세요', btn.dataset.link));
        btn.textContent = '복사됨';
        return;
      } else if (a === 'csv') return downloadCsv();
      else if (a === 'clear-notice') await api('/api/teacher/notice', { method: 'POST', body: { target: state.target, text: '' } });
      else if (a === 'clear-bubble') await api(`/api/teacher/students/${id}/bubble`, { method: 'POST' });
      else if (a === 'pin') {
        const pin = prompt(`${btn.dataset.name} 학생의 새 PIN (숫자 4자리)`);
        if (!pin) return;
        await api(`/api/teacher/students/${id}/pin`, { method: 'POST', body: { pin: pin.trim() } });
        alert('PIN을 바꿨어요. 학생은 새 PIN으로 다시 로그인하면 돼요.');
      } else if (a === 'move') {
        const list = state.classes.map((c) => `${c.code} ${c.name}`).join('\n');
        const code = prompt(`${btn.dataset.name} 학생을 옮길 반 코드를 입력하세요\n\n${list}`);
        if (!code) return;
        await api(`/api/teacher/students/${id}/move`, { method: 'POST', body: { classCode: code.trim() } });
        await loadClasses();
      } else if (a === 'remove') {
        if (!confirm(`${btn.dataset.name} 학생과 공부 기록을 모두 삭제할까요? 되돌릴 수 없어요.`)) return;
        await api(`/api/teacher/students/${id}`, { method: 'DELETE' });
        await loadClasses();
      } else if (a === 'rename') {
        const name = prompt('새 반 이름');
        if (!name) return;
        await api(`/api/teacher/classes/${state.target}`, { method: 'PATCH', body: { name } });
        await loadClasses();
      } else if (a === 'delete-class') {
        if (!confirm('이 반을 삭제할까요?')) return;
        await api(`/api/teacher/classes/${state.target}`, { method: 'DELETE' });
        state.target = 'ALL';
        await loadClasses();
      }
      await loadOverview();
    } catch (err) {
      if (err.message !== 'unauthorized') alert(err.message);
    }
  }

  async function downloadCsv() {
    const to = state.day;
    const from = new Date(`${to}T00:00:00Z`);
    from.setUTCDate(from.getUTCDate() - 29);
    const fromDay = prompt('시작 날짜 (YYYY-MM-DD) · 끝 날짜는 선택한 날짜예요', from.toISOString().slice(0, 10));
    if (!fromDay) return;
    const res = await fetch(`/api/teacher/export.csv?target=${encodeURIComponent(state.target)}&from=${encodeURIComponent(fromDay.trim())}&to=${to}`, { headers: { 'X-Teacher-Key': state.key } });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.error || '받기에 실패했어요.');
      return;
    }
    const blob = await res.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `공부기록_${state.target === 'ALL' ? '전체' : state.target}_${fromDay.trim()}_${to}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  async function startApp() {
    $('#login').hidden = true;
    $('#app').hidden = false;
    try {
      await loadClasses();
      await loadOverview();
    } catch {
      return;
    }
    clearInterval(state.timer);
    // 오늘 화면일 때만 10초마다 새로고침 (입력 중이면 건너뜀)
    state.timer = setInterval(() => {
      const typing = document.activeElement && ['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName);
      if (state.bulkOpen || state.bulkResults) return;
      if (state.day === state.today && !typing) loadOverview();
    }, 10000);
  }

  $('#login').addEventListener('submit', (e) => {
    e.preventDefault();
    state.key = $('#key').value.trim();
    sessionStorage.setItem('study.teacherKey', state.key);
    startApp();
  });
  $('#logout').addEventListener('click', () => showLogin());
  $('#classes').addEventListener('click', (e) => {
    const btn = e.target.closest('.cls');
    if (!btn) return;
    state.target = btn.dataset.code;
    renderClasses();
    loadOverview();
  });
  $('#new-class').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = $('#new-class-name').value.trim();
    if (!name) return;
    try {
      const data = await api('/api/teacher/classes', { method: 'POST', body: { name } });
      $('#new-class-name').value = '';
      state.target = data.class.code;
      await loadClasses();
      await loadOverview();
    } catch (err) {
      if (err.message !== 'unauthorized') alert(err.message);
    }
  });
  $('#main').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-act]');
    if (btn) act(btn);
  });
  $('#main').addEventListener('change', (e) => {
    if (e.target.id === 'day' && e.target.value) {
      state.day = e.target.value;
      loadOverview();
    }
  });
  $('#main').addEventListener('submit', async (e) => {
    if (e.target.id === 'bulk-form') {
      e.preventDefault();
      // 줄마다 첫 칸만 이름으로 쓴다 (엑셀에서 점수 칸까지 같이 복사해도 괜찮게)
      const names = $('#bulk-names').value.split(/\r?\n|,/)
        .map((line) => line.split('\t')[0].trim())
        .filter((n) => n && !/^\d+$/.test(n));
      if (!names.length) return alert('이름을 입력해 주세요.');
      try {
        const data = await api(`/api/teacher/classes/${state.target}/students`, { method: 'POST', body: { names } });
        state.bulkResults = data.results;
        state.bulkOpen = false;
        await loadClasses();
        await loadOverview();
      } catch (err) {
        if (err.message !== 'unauthorized') alert(err.message);
      }
      return;
    }
    if (e.target.id !== 'notice-form') return;
    e.preventDefault();
    try {
      await api('/api/teacher/notice', { method: 'POST', body: { target: state.target, text: $('#notice-text').value } });
      $('#notice-text').blur();
      await loadOverview();
    } catch (err) {
      if (err.message !== 'unauthorized') alert(err.message);
    }
  });

  if (state.key) startApp();
  else showLogin();
})();
