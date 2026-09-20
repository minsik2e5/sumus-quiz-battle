import { api, modal, $, $$, esc, date, toast, buttonBusy, icon } from './modules/ui.js';
import { avatar } from './modules/character.js';
import { CLASS_OPTIONS } from './modules/core.js';

const app = document.querySelector('#app');
let cache = null;
let cacheAt = 0;

function injectStyles() {
  if (document.querySelector('#teacher-enhance-style')) return;
  const style = document.createElement('style');
  style.id = 'teacher-enhance-style';
  style.textContent = `
    .sumus-extra-filter{min-width:132px}
    .sumus-filter-count{font-size:12px;color:#98a2b3;white-space:nowrap}
    .sumus-student-hero{display:flex;align-items:center;gap:14px;margin:2px 0 18px}
    .sumus-student-hero h2{margin:0 0 4px}
    .sumus-student-hero p{margin:0;color:#667085;font-size:13px}
    .sumus-status-dot{display:inline-block;width:8px;height:8px;border-radius:999px;background:#12b76a;margin-right:6px}
    .sumus-status-dot.off{background:#98a2b3}
    .sumus-detail-section{margin-top:20px;padding-top:18px;border-top:1px solid #eaecf0}
    .sumus-detail-section h3{font-size:14px;margin:0 0 12px}
    .sumus-activity-list{display:grid;gap:8px}
    .sumus-activity-item{display:flex;align-items:center;gap:10px;padding:10px 12px;border:1px solid #eaecf0;border-radius:12px;background:#fff}
    .sumus-activity-item .grow{min-width:0}
    .sumus-activity-item b{display:block;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .sumus-activity-item small{display:block;margin-top:2px;color:#98a2b3;font-size:11px}
    .sumus-score{margin-left:auto;font-weight:800;font-size:13px;white-space:nowrap}
    .sumus-last-activity{white-space:nowrap;color:#667085;font-size:12px}
    .sumus-account-note{margin-top:10px;font-size:12px;line-height:1.5;color:#98a2b3}
    .sumus-account-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px}
    .sumus-danger{color:#b42318!important;border-color:#fecdca!important;background:#fff!important}
    @media(max-width:760px){.sumus-extra-filter{min-width:0}.toolbar{flex-wrap:wrap}.sumus-detail-section .form-columns{grid-template-columns:1fr}}
  `;
  document.head.appendChild(style);
}

async function bootstrap(force = false) {
  if (!force && globalThis.__SUMUS_BOOTSTRAP__) return globalThis.__SUMUS_BOOTSTRAP__;
  if (!force && cache && Date.now() - cacheAt < 10000) return cache;
  cache = await api('/bootstrap');
  cacheAt = Date.now();
  return cache;
}

function lastActivity(data, studentId) {
  const stamps = [];
  const profile = data.profiles.find(p => p.id === studentId);
  if (profile?.created_at) stamps.push(profile.created_at);
  for (const s of data.sessions) if (s.student_id === studentId && s.created_at) stamps.push(s.created_at);
  for (const a of data.attempts) if (a.student_id === studentId) stamps.push(a.submitted_at || a.started_at || 0);
  for (const item of Object.values(data.grammar_progress?.[studentId] || {})) if (item.updated_at) stamps.push(item.updated_at);
  return Math.max(0, ...stamps);
}

function shortActivity(ts) {
  if (!ts) return '기록 없음';
  const diff = Date.now() - ts;
  if (diff < 60000) return '방금 전';
  if (diff < 3600000) return `${Math.max(1, Math.floor(diff / 60000))}분 전`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}시간 전`;
  if (diff < 7 * 86400000) return `${Math.floor(diff / 86400000)}일 전`;
  return date(ts);
}

async function enhanceStudentsPage() {
  if (!document.querySelector('.teacher-app') || !document.querySelector('#student-table')) return;
  injectStyles();
  const toolbar = document.querySelector('.teacher-main .toolbar');
  if (!toolbar) return;

  if (!toolbar.querySelector('#school-filter')) {
    const school = document.createElement('select');
    school.id = 'school-filter';
    school.className = 'sumus-extra-filter';
    school.setAttribute('aria-label', '학교 필터');
    school.innerHTML = '<option value="">현재 학교 전체</option><option value="단원고">단원고</option><option value="선부고">선부고</option><option value="강서고">강서고</option>';
    toolbar.appendChild(school);

    const status = document.createElement('select');
    status.id = 'status-filter';
    status.className = 'sumus-extra-filter';
    status.setAttribute('aria-label', '계정 상태 필터');
    status.innerHTML = '<option value="">전체 상태</option><option value="active">활성</option><option value="inactive">일시 중지</option>';
    toolbar.appendChild(status);

    const count = document.createElement('span');
    count.id = 'visible-student-count';
    count.className = 'sumus-filter-count';
    toolbar.appendChild(count);

    school.addEventListener('change', applyFilters);
    status.addEventListener('change', applyFilters);
  }

  const data = await bootstrap();
  const table = document.querySelector('#student-table table');
  if (!table) return;
  const headRow = table.querySelector('thead tr');
  if (headRow && !headRow.querySelector('[data-extra-last]')) {
    const th = document.createElement('th');
    th.dataset.extraLast = '1';
    th.textContent = '최근 활동';
    headRow.appendChild(th);
  }
  for (const row of table.querySelectorAll('tbody tr')) {
    const button = row.querySelector('[data-student]');
    if (!button || row.querySelector('[data-extra-last]')) continue;
    const td = document.createElement('td');
    td.dataset.extraLast = '1';
    td.innerHTML = `<span class="sumus-last-activity">${esc(shortActivity(lastActivity(data, button.dataset.student)))}</span>`;
    row.appendChild(td);
  }
  applyFilters();
}

async function applyFilters() {
  const table = document.querySelector('#student-table table');
  if (!table) return;
  const data = await bootstrap();
  const school = document.querySelector('#school-filter')?.value || '';
  const status = document.querySelector('#status-filter')?.value || '';
  let visible = 0;
  for (const row of table.querySelectorAll('tbody tr')) {
    const id = row.querySelector('[data-student]')?.dataset.student;
    const p = data.profiles.find(x => x.id === id);
    const show = !!p && (!school || p.school === school) && (!status || (status === 'active' ? p.active : !p.active));
    row.hidden = !show;
    if (show) visible++;
  }
  const count = document.querySelector('#visible-student-count');
  if (count) count.textContent = `현재 ${visible}명 표시`;
}

function activityRows(data, id) {
  return data.sessions.filter(s => s.student_id === id).slice(0, 5).map(s => {
    const rate = s.total ? Math.round((s.correct || 0) / s.total * 100) : 0;
    return `<div class="sumus-activity-item"><span class="square-icon">${icon('practice')}</span><div class="grow"><b>${s.total}문제 연습 · 정답률 ${rate}%</b><small>${date(s.created_at)} · +${s.xp || 0}P</small></div></div>`;
  }).join('') || '<p class="tiny muted">아직 연습 기록이 없어요.</p>';
}

function examRows(data, id) {
  return data.attempts.filter(a => a.student_id === id && a.status === 'submitted').sort((a, b) => (b.submitted_at || 0) - (a.submitted_at || 0)).slice(0, 5).map(a => {
    const exam = data.exams.find(e => e.id === a.exam_id);
    return `<div class="sumus-activity-item"><span class="square-icon">${icon('exam')}</span><div class="grow"><b>${esc(exam?.title || '실전시험')}</b><small>${date(a.submitted_at)}${a.auto_submitted ? ' · 자동 제출' : ''}</small></div><span class="sumus-score">${a.score ?? '-'}점</span></div>`;
  }).join('') || '<p class="tiny muted">아직 제출한 시험이 없어요.</p>';
}

async function openStudentDetail(id) {
  const data = await bootstrap();
  const p = data.profiles.find(x => x.id === id);
  if (!p) return toast('학생 정보를 찾을 수 없어요.');
  const attempts = data.attempts.filter(a => a.student_id === id && a.status === 'submitted');
  const grammarItems = Object.values(data.grammar_progress?.[id] || {}).filter(item => !item.school_id || item.school_id === p.school_id);
  const grammarMastered = grammarItems.filter(item => item.mastered).length;
  const grammarRecent = [...grammarItems].sort((a, b) => Number(b.updated_at || 0) - Number(a.updated_at || 0))[0];
  const recent = shortActivity(lastActivity(data, id));
  const schoolOptions = data.schools.map(s => `<option value="${esc(s.id)}" ${(s.id === p.school_id || (!p.school_id && s.name === p.school)) ? 'selected' : ''}>${esc(s.name)}</option>`).join('');
  const classOptions = [...new Set([...CLASS_OPTIONS, p.class_name].filter(Boolean))].map(c => `<option value="${esc(c)}" ${c === p.class_name ? 'selected' : ''}>${esc(c)}</option>`).join('');
  const close = modal(`
    <div class="sumus-student-hero">
      ${avatar(p.avatar_key || 'lumi', { size: 'mini' })}
      <div><h2>${esc(p.display_name)}</h2><p><span class="sumus-status-dot ${p.active ? '' : 'off'}"></span>${p.active ? '활성 계정' : '일시 중지'} · ${esc(p.username)}</p><p>${esc(p.class_name)} · ${esc(p.school)} · 최근 활동 ${esc(recent)}</p></div>
    </div>
    <div class="detail-grid">
      <div><b>${p.stats.today_total}문제</b><small>오늘 학습량</small></div>
      <div><b>${p.stats.accuracy}%</b><small>연습 정답률</small></div>
      <div><b>${p.stats.practice_count}회</b><small>누적 연습</small></div>
      <div><b>${attempts.length}회</b><small>실전시험 제출</small></div>
    </div>
    <div class="sumus-detail-section"><h3>어법·어휘 진도</h3><div class="detail-grid"><div><b>${grammarMastered}지문</b><small>MASTER</small></div><div><b>${grammarItems.length}지문</b><small>학습 기록</small></div></div><p class="sumus-account-note">${grammarRecent ? '최근 어법 학습 ' + esc(shortActivity(grammarRecent.updated_at)) : '아직 어법·어휘 학습 기록이 없어요.'}</p></div>
    <div class="sumus-detail-section"><h3>최근 연습 기록</h3><div class="sumus-activity-list">${activityRows(data, id)}</div></div>
    <div class="sumus-detail-section"><h3>최근 시험 결과</h3><div class="sumus-activity-list">${examRows(data, id)}</div></div>
    <div class="sumus-detail-section">
      <h3>계정 관리</h3>
      <form id="student-enhanced-update">
        <div class="form-columns">
          <label class="field"><span>반</span><select name="class_name" required>${classOptions}</select></label>
          <label class="field"><span>학교 변경</span><select name="school_id" required>${schoolOptions}</select></label>
        </div>
        <label class="field"><span>새 비밀번호</span><input name="password" type="password" minlength="8" maxlength="128" autocomplete="new-password" placeholder="변경할 때만 입력 · 8자 이상"></label>
        <label class="checkbox-line"><input type="checkbox" name="active" ${p.active ? 'checked' : ''}>계정 활성화</label>
        <div class="form-error" id="student-enhanced-error" role="alert"></div>
        <button class="btn primary full" type="submit">학생 정보 저장</button><div class="sumus-account-actions"><button class="btn" type="button" id="student-reset-password">비밀번호 12345678로 재설정</button><button class="btn sumus-danger" type="button" id="student-delete-account">학생 계정 삭제</button></div>
        <p class="sumus-account-note">학교를 변경하면 다음 로그인부터 새 학교의 단어·과제·시험만 표시됩니다. 비밀번호 재설정 시 기존 로그인은 모두 해제됩니다. 계정 삭제는 해당 학생의 연습·시험 기록도 함께 삭제합니다.</p>
      </form>
    </div>`, '학생 관리');

  $('#student-enhanced-update').onsubmit = async event => {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector('[type="submit"]');
    const error = form.querySelector('#student-enhanced-error');
    error.textContent = '';
    buttonBusy(button);
    const values = Object.fromEntries(new FormData(form));
    const payload = { class_name: values.class_name, school_id: values.school_id, active: values.active === 'on' };
    if (values.password) payload.password = values.password;
    try {
      await api('/students/' + id, payload, 'PATCH');
      const fresh = await api('/bootstrap');
      cache = fresh; cacheAt = Date.now(); globalThis.__SUMUS_BOOTSTRAP__ = fresh;
      close();
      globalThis.__SUMUS_APPLY_BOOTSTRAP__?.(fresh);
      toast('학생 정보를 저장했어요.');
    } catch (err) {
      error.textContent = err.message;
      buttonBusy(button, false);
    }
  };

  $('#student-reset-password').onclick = async event => {
    if (!confirm(p.display_name + ' 학생의 비밀번호를 12345678로 재설정할까요?')) return;
    buttonBusy(event.currentTarget);
    try {
      await api('/students/' + id, { password: '12345678' }, 'PATCH');
      toast('비밀번호를 12345678로 재설정했어요.');
    } catch (err) { toast(err.message); }
    finally { buttonBusy(event.currentTarget, false); }
  };

  $('#student-delete-account').onclick = async event => {
    if (!confirm(p.display_name + ' 학생 계정을 삭제할까요?\n연습 기록과 시험 기록도 함께 삭제됩니다.')) return;
    buttonBusy(event.currentTarget);
    try {
      await api('/students/' + id, {}, 'DELETE');
      const fresh = await api('/bootstrap');
      cache = fresh; cacheAt = Date.now(); globalThis.__SUMUS_BOOTSTRAP__ = fresh;
      close();
      globalThis.__SUMUS_APPLY_BOOTSTRAP__?.(fresh);
      toast('학생 계정을 삭제했어요.');
    } catch (err) { toast(err.message); buttonBusy(event.currentTarget, false); }
  };
}

document.addEventListener('click', event => {
  const button = event.target.closest('button[data-student]');
  if (!button || !document.querySelector('.teacher-app')) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  openStudentDetail(button.dataset.student).catch(err => toast(err.message));
}, true);

let enhanceFrame = 0;
function scheduleEnhance() {
  if (enhanceFrame) return;
  enhanceFrame = requestAnimationFrame(() => {
    enhanceFrame = 0;
    enhanceStudentsPage().catch(() => {});
  });
}
const observer = new MutationObserver(scheduleEnhance);
observer.observe(app, { childList: true, subtree: true });
injectStyles();
scheduleEnhance();
