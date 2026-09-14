import { api, modal, esc, date, toast, buttonBusy, icon } from './modules/ui.js';

const app = document.querySelector('#app');
const cache = new Map();

function injectStyles() {
  if (document.querySelector('#exam-ops-style')) return;
  const style = document.createElement('style');
  style.id = 'exam-ops-style';
  style.textContent = `
    .exam-ops-mini{display:flex;flex-wrap:wrap;gap:5px;min-width:145px}
    .exam-ops-mini span{font-size:11px;font-weight:750;padding:4px 7px;border-radius:999px;background:#f2f4f7;color:#475467}
    .exam-ops-mini .done{background:#ecfdf3;color:#027a48}.exam-ops-mini .live{background:#eff8ff;color:#175cd3}.exam-ops-mini .wait{background:#fff7ed;color:#b54708}
    .exam-ops-open{margin-left:6px}
    .exam-ops-hero{padding:2px 0 14px;border-bottom:1px solid #eaecf0}
    .exam-ops-hero h2{margin:0 0 5px;font-size:21px}.exam-ops-hero p{margin:0;color:#667085;font-size:13px;line-height:1.5}
    .exam-ops-metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:16px 0}
    .exam-ops-metrics div{padding:12px;border:1px solid #eaecf0;border-radius:14px;background:#fff}
    .exam-ops-metrics span{display:block;font-size:11px;color:#98a2b3;margin-bottom:5px}.exam-ops-metrics b{font-size:20px}
    .exam-ops-tools{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:0 0 14px}
    .exam-ops-tools select{margin-left:auto;min-width:130px}
    .exam-ops-list{display:grid;gap:8px;max-height:52vh;overflow:auto;padding-right:2px}
    .exam-ops-row{display:grid;grid-template-columns:minmax(120px,1.1fr) 105px minmax(150px,1.3fr) auto;gap:10px;align-items:center;padding:11px 12px;border:1px solid #eaecf0;border-radius:13px;background:#fff}
    .exam-ops-student strong{display:block;font-size:13px}.exam-ops-student small,.exam-ops-meta small{display:block;color:#98a2b3;font-size:11px;margin-top:2px}
    .exam-ops-meta{font-size:12px;color:#475467;line-height:1.45}.exam-ops-actions{display:flex;gap:6px;justify-content:flex-end;flex-wrap:wrap}
    .exam-ops-status{display:inline-flex;align-items:center;justify-content:center;border-radius:999px;padding:5px 8px;font-size:11px;font-weight:800;background:#f2f4f7;color:#475467;white-space:nowrap}
    .exam-ops-status.submitted{background:#ecfdf3;color:#027a48}.exam-ops-status.active{background:#eff8ff;color:#175cd3}.exam-ops-status.not_started{background:#fff7ed;color:#b54708}
    .exam-ops-expired{color:#b42318;font-weight:700}.exam-ops-opened{color:#027a48;font-weight:700}
    .exam-answer-list{display:grid;gap:8px;max-height:58vh;overflow:auto;margin-top:14px}
    .exam-answer-item{padding:11px 12px;border:1px solid #eaecf0;border-radius:12px}.exam-answer-item.ok{border-color:#abefc6;background:#f6fef9}.exam-answer-item.wrong{border-color:#fecdca;background:#fffafa}
    .exam-answer-item b{display:block;margin-bottom:5px;font-size:13px}.exam-answer-item p{margin:2px 0;font-size:12px;color:#475467}.exam-answer-item small{color:#98a2b3}
    @media(max-width:760px){.exam-ops-row{grid-template-columns:1fr auto}.exam-ops-meta{grid-column:1/-1}.exam-ops-actions{grid-column:1/-1;justify-content:flex-start}.exam-ops-metrics{grid-template-columns:repeat(2,1fr)}.exam-ops-tools select{margin-left:0;width:100%}}
  `;
  document.head.appendChild(style);
}

async function roster(examId, force = false) {
  const hit = cache.get(examId);
  if (!force && hit && Date.now() - hit.at < 10000) return hit.data;
  const data = await api(`/admin/exams/${examId}/roster`);
  cache.set(examId, { at: Date.now(), data });
  return data;
}

function statusLabel(status) {
  return status === 'submitted' ? '제출 완료' : status === 'active' ? '응시 중' : '미응시';
}

function renderMini(row, data) {
  const cells = row.querySelectorAll('td');
  const cell = cells[4];
  if (!cell) return;
  cell.innerHTML = `<div class="exam-ops-mini"><span class="done">완료 ${data.counts.submitted}</span><span class="live">응시 ${data.counts.active}</span><span class="wait">미응시 ${data.counts.not_started}</span></div>`;
}

async function enhanceExamRows() {
  if (!document.querySelector('.teacher-app')) return;
  injectStyles();
  const activeButtons = [...document.querySelectorAll('button[data-exam-active]')];
  for (const activeButton of activeButtons) {
    const examId = activeButton.dataset.examActive;
    const row = activeButton.closest('tr');
    if (!row) continue;
    const actionCell = activeButton.closest('td');
    if (actionCell && !actionCell.querySelector(`[data-exam-ops="${examId}"]`)) {
      const button = document.createElement('button');
      button.className = 'btn small exam-ops-open';
      button.dataset.examOps = examId;
      button.innerHTML = `${icon('records')} 현황`;
      actionCell.appendChild(button);
    }
    if (!row.dataset.examOpsLoaded) {
      row.dataset.examOpsLoaded = '1';
      roster(examId).then(data => renderMini(row, data)).catch(() => { row.dataset.examOpsLoaded = ''; });
    }
  }
}

function studentRows(data, filter = '') {
  const rows = data.students.filter(s => !filter || s.status === filter);
  if (!rows.length) return '<p class="tiny muted" style="padding:16px 4px">해당 상태의 학생이 없어요.</p>';
  return rows.map(s => {
    const a = s.attempt;
    let meta = '아직 시험을 시작하지 않았어요.';
    if (s.status === 'active') meta = `시작 ${date(a.started_at)}<small>제한시간 종료 ${date(a.deadline)}</small>`;
    if (s.status === 'submitted') meta = `<b>${a.score}점 · ${a.correct}/${a.total}</b><small>${date(a.submitted_at)}${a.auto_submitted ? ' · 자동 제출' : ''}${s.previous.length ? ` · 이전 기록 ${s.previous.length}회 보관` : ''}</small>`;
    const actions = s.status === 'submitted' ? `<button class="btn small" data-exam-answer="${a.id}" data-exam-id="${data.exam.id}">답안 보기</button><button class="btn small" data-exam-retry="${s.id}" data-exam-id="${data.exam.id}">재응시 허용</button>` : '';
    return `<div class="exam-ops-row"><div class="exam-ops-student"><strong>${esc(s.display_name)}</strong><small>${esc(s.username)} · ${s.active ? '활성' : '일시 중지'}</small></div><div><span class="exam-ops-status ${s.status}">${statusLabel(s.status)}</span></div><div class="exam-ops-meta">${meta}</div><div class="exam-ops-actions">${actions}</div></div>`;
  }).join('');
}

async function openExamOps(examId) {
  injectStyles();
  const data = await roster(examId, true);
  const expired = data.exam.due_at <= Date.now();
  const close = modal(`
    <div class="exam-ops-hero"><h2>${esc(data.exam.title)}</h2><p>${esc(data.exam.class_name)} · ${esc(data.exam.school)} · ${data.exam.question_count}문제 · ${Math.round(data.exam.duration_sec / 60)}분<br>마감 ${date(data.exam.due_at)} · <span class="${expired ? 'exam-ops-expired' : 'exam-ops-opened'}">${expired ? '마감됨' : '응시 가능'}</span></p></div>
    <div class="exam-ops-metrics"><div><span>대상 학생</span><b>${data.counts.total}</b></div><div><span>미응시</span><b>${data.counts.not_started}</b></div><div><span>응시 중</span><b>${data.counts.active}</b></div><div><span>제출 완료</span><b>${data.counts.submitted}</b></div></div>
    <div class="exam-ops-tools"><button class="btn small" data-exam-extend="30" data-exam-id="${examId}">마감 +30분</button><button class="btn small" data-exam-extend="1440" data-exam-id="${examId}">마감 +1일</button><select id="exam-ops-filter"><option value="">전체 학생</option><option value="not_started">미응시</option><option value="active">응시 중</option><option value="submitted">제출 완료</option></select></div>
    <div class="exam-ops-list" id="exam-ops-list">${studentRows(data)}</div>`, '실전시험 운영');

  const filter = document.querySelector('#exam-ops-filter');
  filter.onchange = () => { document.querySelector('#exam-ops-list').innerHTML = studentRows(data, filter.value); };

  document.querySelectorAll('[data-exam-extend]').forEach(button => {
    button.onclick = async () => {
      buttonBusy(button);
      try {
        const minutes = Number(button.dataset.examExtend);
        await api(`/admin/exams/${examId}/extend`, { minutes });
        cache.delete(examId);
        toast(minutes === 1440 ? '마감 시간을 1일 연장했어요.' : '마감 시간을 30분 연장했어요.');
        close();
        await openExamOps(examId);
      } catch (err) { toast(err.message); buttonBusy(button, false); }
    };
  });

  bindRosterActions(examId, close);
}

function bindRosterActions(examId, close) {
  document.querySelectorAll('[data-exam-retry]').forEach(button => {
    button.onclick = async () => {
      const studentId = button.dataset.examRetry;
      const name = button.closest('.exam-ops-row')?.querySelector('.exam-ops-student strong')?.textContent || '이 학생';
      if (!confirm(`${name} 학생에게 재응시를 허용할까요?\n현재 제출 결과는 이전 기록으로 보관됩니다.`)) return;
      buttonBusy(button);
      try {
        await api(`/admin/exams/${examId}/retry`, { student_id: studentId });
        cache.delete(examId);
        toast('재응시가 허용됐어요.');
        close();
        await openExamOps(examId);
      } catch (err) { toast(err.message); buttonBusy(button, false); }
    };
  });

  document.querySelectorAll('[data-exam-answer]').forEach(button => {
    button.onclick = () => openAnswer(examId, button.dataset.examAnswer).catch(err => toast(err.message));
  });
}

async function openAnswer(examId, attemptId) {
  const result = await api(`/attempts/${attemptId}`);
  const a = result.attempt;
  const details = a.details || [];
  modal(`
    <button class="text-button" id="answer-back">← 시험 현황으로</button>
    <h2 style="margin:10px 0 4px">${esc(result.exam?.title || '실전시험')} 답안</h2>
    <p class="tiny muted">${a.score}점 · ${a.correct}/${a.total} · ${date(a.submitted_at)}${a.auto_submitted ? ' · 자동 제출' : ''}</p>
    <div class="exam-answer-list">${details.map(d => `<div class="exam-answer-item ${d.correct ? 'ok' : 'wrong'}"><b>${d.number}. ${esc(d.word)}</b><p>뜻: ${esc(d.meaning)}</p><p>학생 답: ${esc(d.answer || '(미응답)')}</p><small>${d.correct ? '정답' : '오답'}</small></div>`).join('')}</div>`, '학생 답안');
  document.querySelector('#answer-back').onclick = () => openExamOps(examId).catch(err => toast(err.message));
}

document.addEventListener('click', event => {
  const button = event.target.closest('button[data-exam-ops]');
  if (!button || !document.querySelector('.teacher-app')) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  openExamOps(button.dataset.examOps).catch(err => toast(err.message));
}, true);

const observer = new MutationObserver(() => enhanceExamRows().catch(() => {}));
observer.observe(app, { childList: true, subtree: true });
injectStyles();
enhanceExamRows().catch(() => {});
