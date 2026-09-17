import { $, $$, api, esc, icon, toast, modal, buttonBusy, date } from './modules/ui.js';
import { CHARACTERS, EXAM_TYPES, CLASS_OPTIONS } from './modules/core.js';
import { avatar } from './modules/character.js';
import { studentPage, getRanges, updateRangeSummary } from './modules/student.js';
import { teacherPage, collectExamForm, updateExamSummary, studentFiltered, vocabTable } from './modules/teacher.js';
import { configureSessions, openExam, openResult, startPractice, leaveSession } from './modules/sessions.js';
const A = { data: null, tab: 'home', screen: null, school: '단원고', ranges: {}, mode: 'write_meaning', target: 30, sound: false, role: 'student' };
let poll, rendering = false;
function preferences() {
  try { const v = JSON.parse(localStorage.getItem('sumus:v13:prefs:' + A.data.profile.id) || localStorage.getItem('sumus:v12:prefs:' + A.data.profile.id) || '{}'); A.ranges = v.ranges || {}; A.school = A.data.profile.role === 'teacher' ? A.data.profile.active_school : v.school || A.data.profile.school || A.data.schools[0]?.name || '단원고'; A.mode = v.mode || 'write_meaning'; A.target = v.target || 30; A.sound = localStorage.getItem('sumus:sound') === 'true'; } catch {}
}
function savePreferences() { try { localStorage.setItem('sumus:v13:prefs:' + A.data.profile.id, JSON.stringify({ ranges: A.ranges, school: A.school, mode: A.mode, target: A.target })); } catch {} }
async function refresh() { A.data = await api('/bootstrap'); globalThis.__SUMUS_BOOTSTRAP__ = A.data; if (A.data.profile.role === 'teacher') A.school = A.data.profile.active_school; }
function render() {
  if (!A.data || A.screen) return;
  $('#app').innerHTML = A.data.profile.role === 'teacher' ? teacherPage(A) : studentPage(A);
  bindPageForms();
}
configureSessions(A, render, refresh);
function navigate(tab) {
  collectExamForm(A); A.tab = tab; A.search = ''; A.classFilter = ''; A.style = null; render(); window.scrollTo(0, 0);
}
function loginView(role = A.role) {
  A.role = role;
  $('#app').innerHTML = `<div class="auth"><section class="auth-visual"><div class="brand"><img src="/icon.svg" alt=""><div>SUMUS <span>VOCA</span></div></div><div><h1>단어를 넘어,<br>나만의 성장으로.</h1><p>매일 조금씩 쌓이는 실력.<br>오늘의 작은 연습부터 시작해요.</p>${avatar('lumi')}</div><footer>SUMUS ENGLISH ACADEMY</footer></section><form class="auth-form" id="login-form"><div class="brand"><img src="/icon.svg" alt=""><div>SUMUS <span>VOCA</span></div></div><div class="segment"><button type="button" data-role="student" class="${role === 'student' ? 'selected' : ''}">학생</button><button type="button" data-role="teacher" class="${role === 'teacher' ? 'selected' : ''}">선생님</button></div><h2>${role === 'student' ? '반가워요, 다시 시작할까요?' : '선생님, 안녕하세요.'}</h2><p>${role === 'student' ? '나만의 캐릭터와 함께 단어를 익혀요.' : '오늘의 학습과 실전시험을 준비하세요.'}</p><label class="field"><span>아이디</span><input name="username" autocomplete="username" placeholder="아이디를 입력하세요" required maxlength="80" autocapitalize="off"></label><label class="field"><span>비밀번호</span><div class="password-wrap"><input name="password" type="password" autocomplete="current-password" placeholder="비밀번호를 입력하세요" required maxlength="128"><button type="button" id="toggle-password" aria-label="비밀번호 보기">보기</button></div></label><div class="form-error" id="login-error" role="alert"></div><button class="btn primary full" type="submit">로그인 ${icon('arrow')}</button><p class="auth-note">계정 문의는 담당 선생님에게 알려주세요.</p></form></div>`;
  $$('[data-role]').forEach(b => b.onclick = () => loginView(b.dataset.role));
  $('#toggle-password').onclick = e => { const input = $('[name="password"]'); input.type = input.type === 'password' ? 'text' : 'password'; e.currentTarget.textContent = input.type === 'password' ? '보기' : '숨기기'; };
  $('#login-form').onsubmit = async e => {
    e.preventDefault(); const b = $('[type="submit"]', e.currentTarget); buttonBusy(b); $('#login-error').textContent = '';
    try {
      const values = Object.fromEntries(new FormData(e.currentTarget)); await api('/login', { ...values, role: A.role }); await refresh(); preferences(); A.tab = A.data.profile.role === 'teacher' ? 'dashboard' : A.data.profile.avatar_key ? 'home' : 'studio'; render(); startPolling();
    } catch (err) { $('#login-error').textContent = err.message; buttonBusy(b, false); }
  };
}
function startPolling() {
  clearInterval(poll); poll = setInterval(async () => {
    if (!A.data || A.screen || document.visibilityState !== 'visible' || A.tab === 'exam-create' || $('#modal-root').children.length) return;
    try { await refresh(); if (['home', 'exam', 'ranking', 'dashboard', 'exams', 'results'].includes(A.tab)) render(); }
    catch (err) { if (err.status === 401) { clearInterval(poll); A.data = null; loginView(); } }
  }, 60000);
}
$('#app').addEventListener('click', async event => {
  const b = event.target.closest('button'); if (!b || b.disabled || !A.data || A.screen) return;
  const d = b.dataset; if (!Object.keys(d).length) return; event.preventDefault();
  try {
    if (d.go) return navigate(d.go);
    if (d.school) { collectExamForm(A); A.school = d.school; A.vocabRange = ''; A.assignmentId = null; savePreferences(); render(); return; }
    if (d.rangeAll) { const { codes } = getRanges(A); A.ranges[A.school] = d.rangeAll === 'true' ? [...codes] : []; $$('[data-range]').forEach(i => i.checked = d.rangeAll === 'true'); updateRangeSummary(A); updateExamSummary(A); savePreferences(); return; }
    if (d.mode) { A.mode = d.mode; $$('[data-mode]').forEach(e => { e.classList.toggle('selected', e === b); e.setAttribute('aria-pressed', String(e === b)); }); savePreferences(); return; }
    if (d.practiceTarget) { A.target = d.practiceTarget === 'all' ? 'all' : Number(d.practiceTarget); $$('[data-practice-target]').forEach(e => { const selected = e === b; e.classList.toggle('selected', selected); e.setAttribute('aria-pressed', String(selected)); }); savePreferences(); render(); return; }
    if (d.rankMode) { A.rankMode = d.rankMode; render(); return; }
    if (d.recordTab) { A.recordTab = d.recordTab; render(); return; }
    if (d.studioTab) { A.studioTab = d.studioTab; render(); return; }
    if (d.style) { A.style[d.style] = d.value; render(); return; }
    if (d.exam) return await openExam(d.exam);
    if (d.result) return await openResult(d.result);
    if (d.student) return studentModal(d.student);
    if (d.assignment) { const task = A.data.assignments.find(a => a.id === d.assignment); A.school = task.school; A.ranges[task.school] = [...task.range_codes]; A.assignmentId = task.id; navigate('practice'); return; }
    if (d.release) { const e = A.data.exams.find(e => e.id === d.release); await api('/exams/' + e.id, { release_result: !e.release_result }, 'PATCH'); await refresh(); render(); toast(e.release_result ? '결과를 비공개로 바꿨어요.' : '학생에게 결과가 공개됐어요.'); return; }
    if (d.examActive) { const e = A.data.exams.find(e => e.id === d.examActive); await api('/exams/' + e.id, { active: !e.active }, 'PATCH'); await refresh(); render(); return; }
    if (d.action === 'refresh') { buttonBusy(b); await refresh(); render(); toast('최신 기록으로 업데이트했어요.'); }
    if (d.action === 'start-practice') { buttonBusy(b); await startPractice(); }
    if (d.action === 'save-style') { buttonBusy(b); await api('/profile/style', A.style); await refresh(); A.style = null; A.tab = 'home'; render(); toast('내 캐릭터를 저장했어요.'); }
    if (d.action === 'account') accountModal();
    if (d.action === 'logout') await logout();
    if (d.action === 'add-student') addStudent();
    if (d.action === 'add-assignment') addAssignment();
    if (d.action === 'export-results') exportResults();
  } catch (err) { toast(err.message); buttonBusy(b, false); }
});
$('#app').addEventListener('change', event => {
  const input = event.target;
  if (input.id === 'teacher-school') {
    const previous = A.data.profile.active_school_id;
    input.disabled = true;
    api('/teacher/school', { school_id: input.value }, 'PATCH').then(async () => { A.examForm = null; A.ranges = {}; await refresh(); render(); toast(`${A.data.profile.active_school} 관리 화면으로 변경했어요.`); }).catch(err => { input.value = previous; input.disabled = false; toast(err.message); });
    return;
  }
  if (input.dataset.range) {
    const values = new Set(getRanges(A).selected); if (input.checked) values.add(input.dataset.range); else values.delete(input.dataset.range); A.ranges[A.school] = [...values]; A.assignmentId = null; updateRangeSummary(A); updateExamSummary(A); savePreferences();
  }
  if (input.id === 'class-filter') { A.classFilter = input.value; $('#student-table').innerHTML = studentFiltered(A); }
});
function bindPageForms() {
  $('#student-search')?.addEventListener('input', e => { A.search = e.target.value; $('#student-table').innerHTML = studentFiltered(A); });
  $('#vocab-search')?.addEventListener('input', e => { A.vocabSearch = e.target.value; $('#vocab-table').innerHTML = vocabTable(A); });
  const form = $('#exam-form');
  if (form) {
    form.oninput = () => updateExamSummary(A); form.onchange = () => updateExamSummary(A);
    form.onsubmit = async e => {
      e.preventDefault(); collectExamForm(A); const v = A.examForm, b = $('[type="submit"]', form); buttonBusy(b); $('#exam-create-error').textContent = '';
      try {
        await api('/exams', { title: v.title, school: A.school, range_codes: getRanges(A).selected, class_name: v.class_name, exam_type: v.exam_type, question_count: v.question_count === 'all' ? 'all' : Number(v.question_count), duration_sec: Number(v.minutes) * 60, passing_score: Number(v.passing_score), max_attempts: Number(v.max_attempts), available_at: new Date(v.available).getTime(), due_at: new Date(v.due).getTime(), release_result: v.release_result });
        A.examForm = null; await refresh(); A.tab = 'exams'; render(); toast('시험이 학생에게 배정됐어요.');
      } catch (err) { $('#exam-create-error').textContent = err.message; buttonBusy(b, false); }
    };
  }
}
async function logout() { await api('/logout', {}); clearInterval(poll); leaveSession(); A.data = null; A.ranges = {}; A.style = null; A.examForm = null; $('#modal-root').innerHTML = ''; loginView(); }
function accountModal() {
  const p = A.data.profile;
  modal(`<h2>${esc(p.display_name)}</h2><p>${esc(p.class_name)} · ${esc(p.school || 'SUMUS')}<br>${esc(p.username)}</p><button class="btn full" id="account-logout">로그아웃</button>`, '내 계정');
  $('#account-logout').onclick = logout;
}
function addStudent() {
  const classOptions = CLASS_OPTIONS.map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join('');
  const close = modal(`<h2>학생 등록</h2><p>${esc(A.school)} 학생 계정을 만듭니다. 아이디와 비밀번호를 학생에게 알려주세요.</p><form id="student-form"><input type="hidden" name="school_id" value="${esc(A.data.profile.active_school_id)}"><div class="form-columns"><label class="field"><span>학생 이름</span><input name="display_name" required maxlength="40"></label><label class="field"><span>반</span><select name="class_name" required>${classOptions}</select></label></div><div class="locked-school">${icon('shield')}<div><b>${esc(A.school)}</b><small>현재 관리 중인 학교</small></div></div><label class="field"><span>아이디</span><input name="username" required pattern="[a-z0-9_.-]{3,40}" placeholder="영문·숫자 3자 이상" autocomplete="off"></label><label class="field"><span>비밀번호</span><input name="password" required minlength="8" maxlength="128" type="password" placeholder="8자 이상" autocomplete="new-password"></label><div id="student-error" class="form-error" role="alert"></div><button class="btn primary full" type="submit">학생 등록하기</button></form>`, '학생 등록');
  $('#student-form').onsubmit = async e => { e.preventDefault(); const b = $('[type="submit"]', e.currentTarget); buttonBusy(b); try { await api('/students', Object.fromEntries(new FormData(e.currentTarget))); close(); await refresh(); render(); toast('학생 계정을 등록했어요.'); } catch (err) { $('#student-error').textContent = err.message; buttonBusy(b, false); } };
}
function studentModal(id) {
  const p = A.data.profiles.find(p => p.id === id), attempts = A.data.attempts.filter(a => a.student_id === id && a.status === 'submitted');
  const schoolOptions = A.data.schools.map(s => `<option value="${esc(s.id)}" ${s.id === p.school_id ? 'selected' : ''}>${esc(s.name)}</option>`).join('');
  const classOptions = [...new Set([...CLASS_OPTIONS, p.class_name].filter(Boolean))].map(c => `<option value="${esc(c)}" ${c === p.class_name ? 'selected' : ''}>${esc(c)}</option>`).join('');
  const close = modal(`<h2>${esc(p.display_name)}</h2><p>${esc(p.class_name)} · ${p.school} · ${esc(p.username)}</p><div class="detail-grid"><div><b>${p.stats.today_total}문제</b><small>오늘 학습량</small></div><div><b>${p.stats.accuracy}%</b><small>연습 정답률</small></div><div><b>${p.stats.weak}개</b><small>취약 단어</small></div><div><b>${attempts.length}회</b><small>실전시험 응시</small></div></div><form id="student-update"><label class="field"><span>학교 변경</span><select name="school_id">${schoolOptions}</select></label><label class="field"><span>반 변경</span><select name="class_name" required>${classOptions}</select></label><label class="field"><span>새 비밀번호 (변경할 때만)</span><input name="password" type="password" minlength="8" autocomplete="new-password" placeholder="8자 이상"></label><label class="checkbox-line"><input type="checkbox" name="active" ${p.active ? 'checked' : ''}>계정 활성화</label><div class="form-error" id="update-error" role="alert"></div><button class="btn primary full" type="submit">변경 저장</button></form>`, '학생 정보');
  $('#student-update').onsubmit = async e => { e.preventDefault(); const v = Object.fromEntries(new FormData(e.currentTarget)); try { await api('/students/' + id, { ...v, active: v.active === 'on' }, 'PATCH'); close(); await refresh(); render(); toast('학생 정보를 저장했어요.'); } catch (err) { $('#update-error').textContent = err.message; } };
}
function addAssignment() {
  const codes = getRanges(A).codes, selected = codes.slice(0, 2);
  const classOptions = CLASS_OPTIONS.map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join('');
  const close = modal(`<h2>연습 과제 만들기</h2><p>${esc(A.school)}의 여러 범위를 선택해 배정하세요.</p><form id="assignment-form"><input type="hidden" name="school_id" value="${esc(A.data.profile.active_school_id)}"><label class="field"><span>과제명</span><input name="title" required placeholder="예: 중간고사 단어 복습"></label><div class="form-columns"><label class="field"><span>반</span><select name="class_name" required>${classOptions}</select></label><label class="field"><span>목표 문제 수</span><input name="target_questions" type="number" min="5" max="500" value="40" required></label></div><div class="locked-school">${icon('shield')}<div><b>${esc(A.school)}</b><small>현재 관리 중인 학교</small></div></div><div class="range-grid" id="assignment-ranges">${codes.map(c => `<label class="range-option"><input type="checkbox" value="${esc(c)}" ${selected.includes(c) ? 'checked' : ''}><span>${esc(c)}<small>번 / 외부지문</small></span></label>`).join('')}</div><label class="field" style="margin-top:18px"><span>마감일</span><input name="due" type="date" required></label><div class="form-error" id="assignment-error" role="alert"></div><button class="btn primary full" type="submit">과제 배정하기</button></form>`, '연습 과제 배정');
  $('#assignment-form').onsubmit = async e => { e.preventDefault(); const v = Object.fromEntries(new FormData(e.currentTarget)), range_codes = $$('input:checked', $('#assignment-ranges')).map(i => i.value); try { await api('/assignments', { ...v, range_codes, target_questions: Number(v.target_questions), due_at: new Date(v.due + 'T23:59:59').getTime() }); close(); await refresh(); render(); toast('연습 과제를 배정했어요.'); } catch (err) { $('#assignment-error').textContent = err.message; } };
}
function exportResults() {
  const safe = value => '"' + String(value ?? '').replace(/^[=+@-]/, "'$&").replaceAll('"', '""') + '"';
  const rows = [['학생', '반', '시험', '유형', '점수', '정답 수', '전체', '제출 시간']];
  A.data.attempts.filter(a => a.status === 'submitted').forEach(a => { const p = A.data.profiles.find(p => p.id === a.student_id), e = A.data.exams.find(e => e.id === a.exam_id); rows.push([p?.display_name, p?.class_name, e?.title, EXAM_TYPES[e?.exam_type]?.label, a.score, a.correct, a.total, date(a.submitted_at)]); });
  const url = URL.createObjectURL(new Blob(['\uFEFF' + rows.map(r => r.map(safe).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' })); const link = document.createElement('a'); link.href = url; link.download = 'SUMUS_시험결과.csv'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 5000);
}
try { const health = await api('/health'); if (!health.ready) { loginView(); $('#login-error').textContent = '교사 계정을 먼저 설정해주세요. 실행 폴더의 시작 안내를 확인하세요.'; } else {
  try { const session = await api('/session'); if (!session.authenticated) loginView(); else { await refresh(); preferences(); A.tab = A.data.profile.role === 'teacher' ? 'dashboard' : A.data.profile.avatar_key ? 'home' : 'studio'; render(); startPolling(); } } catch (e) { if (e.status === 401) loginView(); else throw e; }
} } catch (e) { loginView(); $('#login-error').textContent = '서버 연결을 확인해주세요. 실행 폴더에서 서버를 시작해야 합니다.'; }
