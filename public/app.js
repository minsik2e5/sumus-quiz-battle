import { $, $$, api, esc, icon, toast, modal, buttonBusy, date } from './modules/ui.js';
import { CHARACTERS, EXAM_TYPES, PRACTICE_TYPES, CLASS_OPTIONS } from './modules/core.js';
import { avatar } from './modules/character.js?v=13.30.0';
import { studentPage, getRanges, updateRangeSummary } from './modules/student.js?v=13.30.0';
import { teacherPage, collectExamForm, updateExamSummary, studentFiltered, vocabTable } from './modules/teacher.js?v=13.30.0';
import { configureSessions, openExam, openResult, openPracticeRecord, startPractice, leaveSession } from './modules/sessions.js?v=13.30.0';
const A = { data: null, tab: 'home', screen: null, school: '단원고', ranges: {}, mode: 'write_meaning', practiceRunMode: 'practice', target: 30, sound: false, role: 'student', division: 'high', studyView: 'hub', examKind: null, memorizeFilter: 'all', memorizeShowAll: false, memorizeRange: '', memStars: [], memRevealed: [] };
const ALL_CLASSES = '__ALL__';
const examTargetLabel = value => value === ALL_CLASSES ? '학교 전체' : value;
const examTargetMatches = (exam, profile) => exam?.class_name === ALL_CLASSES || exam?.class_name === profile?.class_name;
const examRangeGrade = value => value === ALL_CLASSES ? null : value;
const examTargetOptions = () => A.data.profile.active_division === 'middle' ? ['중2', '중3'] : [ALL_CLASSES, '고1A', '고1B'];
let poll, rendering = false, contextGeneration = 0;
function preferences() {
  try { const v = JSON.parse(localStorage.getItem('sumus:v13:prefs:' + A.data.profile.id) || localStorage.getItem('sumus:v12:prefs:' + A.data.profile.id) || '{}'); A.ranges = v.ranges || {}; A.school = A.data.profile.role === 'teacher' ? A.data.profile.active_school : A.data.profile.school || v.school || A.data.schools[0]?.name || '단원고'; A.division = A.data.profile.active_division || A.data.profile.division || A.division || 'high'; A.mode = v.mode || 'write_meaning'; A.practiceRunMode = ['practice','test'].includes(v.practiceRunMode) ? v.practiceRunMode : 'practice'; A.target = v.target || 30; A.middleRange = v.middleRange || A.middleRange || ''; A.middleWordIds = Array.isArray(v.middleWordIds) ? v.middleWordIds : (A.middleWordIds || []); A.rankMode = v.rankMode || A.rankMode || 'xp'; A.rankScope = v.rankScope || A.rankScope || 'all'; A.rankPeriod = v.rankPeriod || A.rankPeriod || 'week'; A.memorizeFilter = v.memorizeFilter === 'starred' ? 'starred' : 'all'; A.memorizeRange = v.memorizeRange || A.memorizeRange || ''; A.memStars = Array.isArray(v.memStars) ? v.memStars : []; A.sound = localStorage.getItem('sumus:sound') === 'true'; } catch {}
}
function savePreferences() { try { localStorage.setItem('sumus:v13:prefs:' + A.data.profile.id, JSON.stringify({ ranges: A.ranges, school: A.school, mode: A.mode, practiceRunMode: A.practiceRunMode, target: A.target, rankMode: A.rankMode, rankScope: A.rankScope, rankPeriod: A.rankPeriod, middleRange: A.middleRange, middleWordIds: A.middleWordIds || [], memorizeFilter: A.memorizeFilter || 'all', memorizeRange: A.memorizeRange || '', memStars: A.memStars || [] })); } catch {} }
async function refresh() { A.data = await api('/bootstrap'); globalThis.__SUMUS_BOOTSTRAP__ = A.data; if (A.data.profile.role === 'teacher') A.school = A.data.profile.active_school; }
globalThis.__SUMUS_APPLY_BOOTSTRAP__ = data => { A.data = data; globalThis.__SUMUS_BOOTSTRAP__ = data; if (data?.profile?.role === 'teacher') A.school = data.profile.active_school; if (!A.screen) render(); };
function render() {
  if (!A.data || A.screen) return;
  $('#app').innerHTML = A.data.profile.role === 'teacher' ? teacherPage(A) : studentPage(A);
  bindPageForms();
}
configureSessions(A, render, refresh);
function navigate(tab) {
  collectExamForm(A); A.tab = tab;
  if (tab === 'practice') { A.studyView = 'hub'; A.practiceRunMode = 'practice'; }
  if (tab === 'exam') { A.examKind = null; A.practiceRunMode = 'practice'; if (!['write_meaning','spell','eng2mean'].includes(A.mode)) A.mode = 'write_meaning'; }
  A.search = ''; A.classFilter = ''; A.style = null; render(); window.scrollTo(0, 0);
}
function signupView(division = A.division) {
  A.role = 'student'; A.division = division;
  const divisionName = division === 'middle' ? '중등부' : '고등부';
  const schools = division === 'middle'
    ? [{ id:'wonil-middle', name:'원일중' }]
    : [{ id:'danwon-high', name:'단원고' }, { id:'seonbu-high', name:'선부고' }, { id:'gangseo-high', name:'강서고' }];
  const classes = division === 'middle' ? ['중2','중3'] : ['고1A','고1B'];
  $('#app').innerHTML = `<div class="auth auth-v1327"><form class="auth-form auth-card-v1327 signup-card-v1332" id="signup-form">
    <div class="auth-hero-v1330"><img src="/sumus-logo-green.svg" alt="SUMUS VOCA"><h1>SUMUS <em>VOCA</em></h1><p>나만의 학습 계정을 만들어요</p></div>
    <button type="button" class="auth-back-student" data-back-login>← 로그인으로</button>
    <div class="division-segment auth-division-v1327"><button type="button" data-signup-division="middle" class="${division === 'middle' ? 'selected' : ''}">중등부</button><button type="button" data-signup-division="high" class="${division === 'high' ? 'selected' : ''}">고등부</button></div>
    <div class="auth-title-v1327"><span>JOIN SUMUS</span><h1>학생 회원가입</h1><p>${divisionName} 학교와 반을 선택해 주세요.</p></div>
    <div class="signup-grid-v1332">
      <label class="field"><span>학교</span><select name="school_id" required>${schools.map(x=>`<option value="${x.id}">${x.name}</option>`).join('')}</select></label>
      <label class="field"><span>학년 / 반</span><select name="class_name" required>${classes.map(x=>`<option value="${x}">${x}</option>`).join('')}</select></label>
    </div>
    <div class="auth-fields-v1327">
      <label class="field"><span>이름</span><input name="display_name" placeholder="학생 이름" required maxlength="40"></label>
      <label class="field"><span>아이디</span><input name="username" autocomplete="username" placeholder="영문 소문자·숫자 3자 이상" required maxlength="40" autocapitalize="off"></label>
      <label class="field"><span>비밀번호</span><div class="password-wrap"><input name="password" type="password" autocomplete="new-password" placeholder="8자 이상" required maxlength="128"><button type="button" id="toggle-signup-password">보기</button></div></label>
    </div>
    <div class="form-error" id="signup-error" role="alert"></div>
    <button class="btn primary full auth-submit-v1327" type="submit">회원가입하고 시작하기 ${icon('arrow')}</button>
  </form></div>`;
  $('[data-signup-division]').forEach(b => b.onclick = () => signupView(b.dataset.signupDivision));
  $('[data-back-login]').onclick = () => loginView('student', division);
  $('#toggle-signup-password').onclick = e => { const input = $('[name="password"]'); input.type = input.type === 'password' ? 'text' : 'password'; e.currentTarget.textContent = input.type === 'password' ? '보기' : '숨기기'; };
  $('#signup-form').onsubmit = async e => {
    e.preventDefault(); const b = $('[type="submit"]', e.currentTarget); buttonBusy(b); $('#signup-error').textContent = '';
    try {
      const values = Object.fromEntries(new FormData(e.currentTarget));
      await api('/signup', { ...values, division });
      const login = await api('/login', { username: values.username, password: values.password, role:'student', division });
      A.role = login.profile?.role || 'student'; A.division = division; await refresh(); preferences(); A.tab = A.data.profile.avatar_key ? 'home' : 'studio'; render(); startPolling();
    } catch (err) { $('#signup-error').textContent = err.message; buttonBusy(b, false); }
  };
}
function loginView(role = A.role, division = A.division) {
  A.role = role; A.division = division;
  const teacher = role === 'teacher';
  const divisionName = division === 'middle' ? '중등부' : '고등부';
  $('#app').innerHTML = `<div class="auth auth-v1327"><form class="auth-form auth-card-v1327" id="login-form">
    <div class="auth-hero-v1330"><span class="auth-motto">Better Words<br>A Brighter You</span><img src="/sumus-logo-green.svg" alt="SUMUS VOCA"><h1>SUMUS <em>VOCA</em></h1><p>매일 쌓이는 나의 영어 성장</p><div class="auth-pet-mini">${avatar("dog")}</div></div>
    ${teacher ? `<button type="button" class="auth-back-student" data-login-student>← 학생 로그인</button><div class="auth-title-v1327"><span>TEACHER</span><h1>선생님 로그인</h1><p>학생 학습과 시험을 관리하는 전용 화면입니다.</p></div>` : `<div class="division-segment auth-division-v1327"><button type="button" data-division="middle" class="${division === 'middle' ? 'selected' : ''}">중등부</button><button type="button" data-division="high" class="${division === 'high' ? 'selected' : ''}">고등부</button></div><div class="auth-title-v1327"><span>STUDENT</span><h1>로그인</h1><p>${divisionName} 계정으로 시작하세요.</p></div>`}
    <div class="auth-fields-v1327"><label class="field"><span>아이디</span><input name="username" autocomplete="username" placeholder="아이디" required maxlength="80" autocapitalize="off"></label><label class="field"><span>비밀번호</span><div class="password-wrap"><input name="password" type="password" autocomplete="current-password" placeholder="비밀번호" required maxlength="128"><button type="button" id="toggle-password" aria-label="비밀번호 보기">보기</button></div></label></div>
    <div class="form-error" id="login-error" role="alert"></div>
    <button class="btn primary full auth-submit-v1327" type="submit">${teacher ? '선생님 로그인' : divisionName + ' 로그인'} ${icon('arrow')}</button>
    ${teacher ? '' : '<button type="button" class="signup-link-v1332" data-signup>처음이신가요? <b>회원가입</b></button><button type="button" class="teacher-login-link" data-login-teacher>선생님 로그인 →</button>'}
  </form></div>`;
  $$('[data-division]').forEach(b => b.onclick = () => loginView('student', b.dataset.division));
  $('[data-login-teacher]')?.addEventListener('click', () => loginView('teacher', A.division));
  $('[data-signup]')?.addEventListener('click', () => signupView(A.division));
  $('[data-login-student]')?.addEventListener('click', () => loginView('student', A.division));
  $('#toggle-password').onclick = e => { const input = $('[name="password"]'); input.type = input.type === 'password' ? 'text' : 'password'; e.currentTarget.textContent = input.type === 'password' ? '보기' : '숨기기'; };
  $('#login-form').onsubmit = async e => {
    e.preventDefault(); const b = $('[type="submit"]', e.currentTarget); buttonBusy(b); $('#login-error').textContent = '';
    try {
      const values = Object.fromEntries(new FormData(e.currentTarget)); const login = await api('/login', { ...values, role: A.role, division: A.division }); A.role = login.profile?.role || A.role; await refresh(); preferences(); A.tab = A.data.profile.role === 'teacher' ? 'dashboard' : A.data.profile.avatar_key ? 'home' : 'studio'; render(); startPolling();
    } catch (err) { $('#login-error').textContent = err.message; buttonBusy(b, false); }
  };
}
function startPolling() {
  clearInterval(poll); poll = setInterval(async () => {
    if (!A.data || A.screen || document.visibilityState !== 'visible' || A.tab === 'exam-create' || $('#modal-root').children.length) return;
    const liveTabs = ['home', 'exam', 'ranking', 'dashboard', 'exams', 'results'];
    if (!liveTabs.includes(A.tab)) return;
    try { await refresh(); render(); }
    catch (err) { if (err.status === 401) { clearInterval(poll); A.data = null; loginView(); } }
  }, 60000);
}
$('#app').addEventListener('click', async event => {
  const b = event.target.closest('button'); if (!b || b.disabled || !A.data || A.screen) return;
  const d = b.dataset; if (!Object.keys(d).length) return; event.preventDefault();
  try {
    if (d.go) return navigate(d.go);
    if (d.teacherDivision && A.data.profile.role === 'teacher') { await performTeacherContextSwitch('division', d.teacherDivision); return; }
    if (d.study) { A.studyView = d.study; A.tab = 'practice'; A.practiceRunMode = 'practice'; render(); window.scrollTo(0, 0); return; }
    if (d.memorizeRange) { A.memorizeRange = d.memorizeRange; A.memRevealed = []; A.memorizeFilter = 'all'; savePreferences(); render(); window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
    if (d.memorizeFilter) { A.memorizeFilter = d.memorizeFilter === 'starred' ? 'starred' : 'all'; savePreferences(); render(); return; }
    if (d.memorizeRevealAll) { A.memorizeShowAll = d.memorizeRevealAll === 'show'; render(); return; }
    if (d.memorizeWord) {
      const wordId = d.memorizeWord;
      const row = b.closest('.memorize-row');
      row?.classList.add('memorize-flip-out');
      await new Promise(resolve => setTimeout(resolve, 115));
      const set = new Set(A.memRevealed || []);
      set.has(wordId) ? set.delete(wordId) : set.add(wordId);
      A.memRevealed = [...set];
      render();
      requestAnimationFrame(() => {
        const nextButton = $('[data-memorize-word]').find(item => item.dataset.memorizeWord === wordId);
        const nextRow = nextButton?.closest('.memorize-row');
        if (!nextRow) return;
        nextRow.classList.add('memorize-flip-in');
        setTimeout(() => nextRow.classList.remove('memorize-flip-in'), 320);
      });
      return;
    }
    if (d.memorizeStar) {
      const set = new Set(A.memStars || []); set.has(d.memorizeStar) ? set.delete(d.memorizeStar) : set.add(d.memorizeStar); A.memStars = [...set]; savePreferences(); render(); return;
    }
    if (d.memorizeSpeak) {
      const word = A.data.books.flatMap(book => book.words || []).find(item => item.id === d.memorizeSpeak);
      if (!word) return toast('단어를 찾을 수 없어요.');
      if (!('speechSynthesis' in window)) return toast('이 기기에서는 발음 재생을 지원하지 않아요.');
      speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(String(word.word || '').replace(/\([^)]*\)|\[[^\]]*\]/g, '').trim());
      utterance.lang = 'en-US'; utterance.rate = .82;
      utterance.onerror = () => toast('발음을 재생하지 못했어요. 다시 눌러주세요.');
      speechSynthesis.speak(utterance);
      return;
    }
    if (d.examKind) {
      A.examKind = d.examKind === 'test' ? 'test' : 'practice';
      A.practiceRunMode = A.examKind === 'test' ? 'test' : 'practice';
      if (!['write_meaning','spell'].includes(A.mode)) A.mode = 'write_meaning';
      render(); window.scrollTo(0,0); return;
    }
    if (d.quickPractice) {
      if (!A.data.active_practice && !(A.data.daily_quest?.target > 0)) {
        A.studyView = 'vocab'; A.tab = 'practice'; render(); window.scrollTo(0, 0); return;
      }
      if (!A.data.active_practice) {
        A.mode = 'write_meaning';
        A.target = 20;
        A.assignmentId = null;
        savePreferences();
      }
      buttonBusy(b);
      await startPractice({ dailyQuest: !A.data.active_practice, runMode: 'practice' });
      return;
    }
    if (d.school && A.data.profile.role === 'teacher') { collectExamForm(A); A.school = d.school; A.vocabRange = ''; A.assignmentId = null; savePreferences(); render(); return; }
    if (d.rangeAll) { const { codes } = getRanges(A); A.ranges[A.school] = d.rangeAll === 'true' ? [...codes] : []; $$('[data-range]').forEach(i => i.checked = d.rangeAll === 'true'); updateRangeSummary(A); updateExamSummary(A); savePreferences(); return; }
    if (d.mode) { A.mode = d.mode; if (!['write_meaning','spell'].includes(A.mode)) A.practiceRunMode = 'practice'; savePreferences(); render(); return; }
    if (d.practiceTarget) { A.target = d.practiceTarget === 'all' ? 'all' : Number(d.practiceTarget); $$('[data-practice-target]').forEach(e => { const selected = e === b; e.classList.toggle('selected', selected); e.setAttribute('aria-pressed', String(selected)); }); savePreferences(); render(); return; }
    if (d.middleLesson) { A.middleRange = d.middleLesson; A.middleWordIds = []; A.target = 'all'; savePreferences(); render(); return; }
    if (d.middleWordPreset) {
      const words = A.data.books.flatMap(book => book.words || []).filter(word => String(word.range_code) === String(A.middleRange || ''));
      A.middleWordIds = d.middleWordPreset === 'clear' ? [] : d.middleWordPreset === 'all' ? words.map(word => word.id) : words.slice(0, Number(d.middleWordPreset)).map(word => word.id);
      A.target = 'all'; savePreferences(); render(); return;
    }
    if (d.rankMode) { A.rankMode = d.rankMode; savePreferences(); render(); return; }
    if (d.rankScope) { A.rankScope = d.rankScope; savePreferences(); render(); return; }
    if (d.rankPeriod) { A.rankPeriod = d.rankPeriod; savePreferences(); render(); return; }
    if (d.recordTab) { A.recordTab = d.recordTab; render(); return; }
    if (d.studioTab) { A.studioTab = d.studioTab; render(); return; }
    if (d.style) { A.style[d.style] = d.value; render(); return; }
    if (d.exam) return await openExam(d.exam);
    if (d.result) return await openResult(d.result);
    if (d.practiceRecord) return openPracticeRecord(d.practiceRecord);
    if (d.reviewPractice) {
      const session = A.data.sessions.find(item => item.id === d.reviewPractice);
      if (!session) return toast('복습할 기록을 찾을 수 없어요.');
      const records = Array.isArray(session.answer_records) ? session.answer_records : [];
      const answered = new Set(records.map(item => item.word_id).filter(Boolean));
      const wrongIds = records.length
        ? records.filter(item => item.correct === false && !item.regraded).map(item => item.word_id).filter(Boolean)
        : (session.wrong_details || []).filter(item => !item.regraded).map(item => item.word_id).filter(Boolean);
      const timedOutCount = records.filter(item => item.timed_out && !item.regraded).length;
      const missingCount = Math.max(0, Number(session.unanswered_count || 0) - timedOutCount);
      const missingIds = (session.word_ids || []).filter(id => !answered.has(id)).slice(0, missingCount);
      const wordIds = [...new Set([...wrongIds, ...missingIds])];
      if (!wordIds.length) return openPracticeRecord(session.id);
      A.mode = session.mode || 'write_meaning'; A.practiceRunMode = 'practice'; savePreferences();
      return await startPractice({ wordIds, mode: A.mode, runMode: 'practice' });
    }
    if (d.repeatPractice) {
      const session = A.data.sessions.find(item => item.id === d.repeatPractice);
      if (!session) return toast('이전 학습 기록을 찾을 수 없어요.');
      A.school = session.school || A.school;
      A.mode = session.mode || 'write_meaning';
      A.practiceRunMode = session.run_mode === 'test' && ['write_meaning','spell'].includes(A.mode) ? 'test' : 'practice';
      A.assignmentId = null;
      if (A.data.profile.division === 'middle') {
        A.middleRange = String(session.range_codes?.[0] || A.middleRange || '');
        const recordedIds = [...new Set((session.answer_records || []).map(item => item.word_id).filter(Boolean))];
        A.middleWordIds = recordedIds;
        A.middleWordsOpen = false;
      } else {
        A.ranges[A.school] = [...(session.range_codes || [])];
        A.memorizeRange = String(session.range_codes?.[0] || A.memorizeRange || '');
        A.target = [10,20,30].includes(Number(session.total)) ? Number(session.total) : 'all';
      }
      A.studyView = 'vocab'; A.tab = 'practice'; savePreferences(); render(); window.scrollTo(0,0); return;
    }
    if (d.student) return studentModal(d.student);
    if (d.assignment) { const task = A.data.assignments.find(a => a.id === d.assignment); A.school = task.school; A.ranges[task.school] = [...task.range_codes]; A.memorizeRange = String(task.range_codes?.[0] || A.memorizeRange || ''); A.assignmentId = task.id; A.studyView = 'vocab'; A.tab = 'practice'; render(); window.scrollTo(0, 0); return; }
    if (d.release) { const e = A.data.exams.find(e => e.id === d.release); await api('/exams/' + e.id, { release_result: !e.release_result }, 'PATCH'); await refresh(); render(); toast(e.release_result ? '결과를 비공개로 바꿨어요.' : '학생에게 결과가 공개됐어요.'); return; }
    if (d.examActive) { const e = A.data.exams.find(e => e.id === d.examActive); await api('/exams/' + e.id, { active: !e.active }, 'PATCH'); await refresh(); render(); return; }
    if (d.examEdit) { examEditModal(d.examEdit); return; }
    if (d.examStatus) { examStatusModal(d.examStatus); return; }
    if (d.examMenu) { examMenuModal(d.examMenu); return; }
    if (d.meaningAlias) { meaningAliasModal(d.meaningAlias); return; }
    if (d.disputeGlobal) { await resolveDispute(d.disputeGlobal, 'approve_global', b); return; }
    if (d.disputeOnce) { await resolveDispute(d.disputeOnce, 'approve_once', b); return; }
    if (d.disputeReject) { await resolveDispute(d.disputeReject, 'reject', b); return; }
    if (d.action === 'refresh') { buttonBusy(b); await refresh(); render(); toast('최신 기록으로 업데이트했어요.'); }
    if (d.action === 'start-exam-run') {
      const runMode = A.examKind === 'test' ? 'test' : 'practice';
      A.practiceRunMode = runMode; savePreferences(); buttonBusy(b);
      if (A.data.profile.division === 'middle') {
        const lessonWords = A.data.books.flatMap(book => book.words || []).filter(word => String(word.range_code) === String(A.middleRange || ''));
        const selected = new Set(A.middleWordIds || []);
        const words = lessonWords.filter(word => selected.has(word.id));
        if (!words.length) { buttonBusy(b, false); return toast('시험 볼 단어를 먼저 선택해주세요.'); }
        const target = A.target === 'all' ? 'all' : Math.min(words.length, Number(A.target || words.length));
        await startPractice({ wordIds: words.map(word => word.id), target, mode: A.mode, runMode, examStyle: true, confirmed: true });
      } else {
        await startPractice({ runMode, examStyle: true, confirmed: true });
      }
      return;
    }
    if (d.action === 'grammar-choice-sample' || d.action === 'grammar-choice') {
      const { openGrammarChoiceSample } = await import('./grammar-choice-sample.js?v=13.30.0');
      openGrammarChoiceSample(A, render, d.grammarId);
      return;
    }
    if (d.action === 'save-style') { buttonBusy(b); await api('/profile/style', A.style); await refresh(); A.style = null; A.tab = 'home'; render(); toast('내 캐릭터를 저장했어요.'); }
    if (d.action === 'account') accountModal();
    if (d.action === 'logout') await logout();
    if (d.action === 'add-student') addStudent();
    if (d.action === 'add-assignment') addAssignment();
    if (d.action === 'vocab-import') vocabImportModal();
    if (d.action === 'export-results') exportResults();
  } catch (err) { toast(err.message); buttonBusy(b, false); }
});
$('#app').addEventListener('change', event => {
  const input = event.target;
  if (!A.data || A.screen) return;
  if (input.dataset.middleWord !== undefined) {
    const set = new Set(A.middleWordIds || []);
    input.checked ? set.add(input.dataset.middleWord) : set.delete(input.dataset.middleWord);
    A.middleWordIds = [...set]; A.target = 'all'; savePreferences(); render(); return;
  }
    if (input.dataset.rankScopeSelect !== undefined) { A.rankScope = input.value; savePreferences(); render(); return; }
  if (input.dataset.rankPeriodSelect !== undefined) { A.rankPeriod = input.value; savePreferences(); render(); return; }
  if (input.dataset.rankModeSelect !== undefined) { A.rankMode = input.value; savePreferences(); render(); }
});

async function performTeacherContextSwitch(kind, value) {
  const generation = ++contextGeneration;
  const endpoint = kind === 'division' ? '/teacher/division' : '/teacher/school';
  const payload = kind === 'division' ? { division: value } : { school_id: value };
  const selectors = $$('#teacher-division,#teacher-school');
  selectors.forEach(select => select.disabled = true);
  try {
    await api(endpoint, payload, 'PATCH');
    if (generation !== contextGeneration) return;
    A.examForm = null; A.examFormDirty = false; A.ranges = {}; A.search = ''; A.classFilter = '';
    await refresh();
    if (generation !== contextGeneration) return;
    preferences();
    render();
    toast(kind === 'division'
      ? `${A.data.profile.active_division === 'middle' ? '중등부' : '고등부'} 관리 화면으로 변경했어요.`
      : `${A.data.profile.active_school} 관리 화면으로 변경했어요.`);
  } catch (error) {
    if (generation !== contextGeneration) return;
    render();
    toast(error.message);
  }
}
function requestTeacherContextSwitch(kind, value, input) {
  const currentValue = kind === 'division' ? A.data.profile.active_division : A.data.profile.active_school_id;
  if (value === currentValue) return;
  if (A.tab === 'exam-create' && A.examFormDirty) {
    input.value = currentValue;
    const close = modal(`<h2>작성 중인 시험 설정이 있어요.</h2><p>부서나 학교를 바꾸면 지금 작성한 시험 설정은 취소됩니다.</p><button class="btn primary full" id="discard-and-switch">작성 취소 후 전환</button><button class="btn full" id="keep-editing">계속 작성</button>`, '관리 화면 전환');
    $('#keep-editing').onclick = close;
    $('#discard-and-switch').onclick = () => { close(); performTeacherContextSwitch(kind, value); };
    return;
  }
  performTeacherContextSwitch(kind, value);
}
$('#app').addEventListener('change', event => {
  const input = event.target;
  if (input.id === 'teacher-division') {
    requestTeacherContextSwitch('division', input.value, input);
    return;
  }
  if (input.id === 'teacher-school') {
    requestTeacherContextSwitch('school', input.value, input);
    return;
  }
  if (input.dataset.range) {
    const grade = input.dataset.rangeGrade || null;
    const info = getRanges(A, A.school, grade);
    const values = new Set(info.selected);
    if (input.checked) values.add(input.dataset.range); else values.delete(input.dataset.range);
    A.ranges[info.key] = [...values];
    A.assignmentId = null;
    if (grade) {
      const count = selectedCount(A, grade);
      if ($('#scope-count')) $('#scope-count').textContent = `${values.size}개 범위 · ${count}개 단어`;
      updateExamSummary(A);
    } else updateRangeSummary(A);
    savePreferences();
  }
  if (input.id === 'vocab-grade') { A.vocabGrade = input.value; $('#vocab-table').innerHTML = vocabTable(A); return; }
  if (input.id === 'class-filter') { A.classFilter = input.value; $('#student-table').innerHTML = studentFiltered(A); }
});
function bindPageForms() {
  $('#student-search')?.addEventListener('input', e => { A.search = e.target.value; $('#student-table').innerHTML = studentFiltered(A); });
  $('#vocab-search')?.addEventListener('input', e => { A.vocabSearch = e.target.value; $('#vocab-table').innerHTML = vocabTable(A); });
  const form = $('#exam-form');
  if (form) {
    form.oninput = () => { A.examFormDirty = true; updateExamSummary(A); };
    form.onchange = event => {
      A.examFormDirty = true;
      collectExamForm(A);
      if (event.target?.name === 'class_name') { getRanges(A, A.school, examRangeGrade(A.examForm.class_name)); render(); return; }
      updateExamSummary(A);
    };
    form.onsubmit = async e => {
      e.preventDefault(); collectExamForm(A); const v = A.examForm, b = $('[type="submit"]', form); buttonBusy(b); $('#exam-create-error').textContent = '';
      try {
        await api('/exams', { title: v.title, school: A.school, range_codes: getRanges(A, A.school, examRangeGrade(v.class_name)).selected, class_name: v.class_name, exam_type: v.exam_type, question_count: v.question_count === 'all' ? 'all' : Number(v.question_count), duration_sec: Number(v.minutes) * 60, passing_score: Number(v.passing_score), max_attempts: Number(v.max_attempts), available_at: new Date(v.available).getTime(), due_at: new Date(v.due).getTime(), release_result: v.release_result });
        A.examForm = null; A.examFormDirty = false; await refresh(); A.tab = 'exams'; render(); toast('시험이 학생에게 배정됐어요.');
      } catch (err) { $('#exam-create-error').textContent = err.message; buttonBusy(b, false); }
    };
  }
}
async function logout() { await api('/logout', {}); clearInterval(poll); leaveSession(); A.data = null; A.ranges = {}; A.style = null; A.examForm = null; A.examFormDirty = false; $('#modal-root').innerHTML = ''; loginView(); }
async function resolveDispute(id, action, button) {
  const messages = {
    approve_global: '이 표현을 모든 학생의 정답으로 인정할까요? 허용 뜻 DB에 저장되고 같은 이의제기가 자동 재채점됩니다.',
    approve_once: '이 학생의 답안만 이번에 정답으로 인정할까요?',
    reject: '같은 표현의 대기 중 이의제기를 오답으로 유지할까요?'
  };
  if (!confirm(messages[action])) return;
  buttonBusy(button);
  try {
    const result = await api('/meaning-disputes/' + id + '/resolve', { action }, 'PATCH');
    await refresh(); render();
    toast(action === 'approve_global' ? `허용 뜻에 저장하고 ${result.regraded || 0}건 재채점했어요.` : action === 'approve_once' ? '이번 답안을 정답으로 재채점했어요.' : '오답으로 유지했어요.');
  } catch (err) { toast(err.message); buttonBusy(button, false); }
}
function accountModal() {
  const p = A.data.profile;
  modal(`<h2>${esc(p.display_name)}</h2><p>${esc(p.class_name)} · ${esc(p.role === 'teacher' ? (p.active_school || 'SUMUS') : (p.school || 'SUMUS'))}<br>${esc(p.username)}</p>
    ${p.role === 'student'
      ? `<div class="sumus-detail-section"><h3>학교 소속</h3><div class="locked-school">${icon('shield')}<div><b>${esc(p.school || '학교 미설정')}</b><small>학교 변경은 선생님이 관리합니다.</small></div></div><p class="sumus-account-note">다른 학교 시험이나 학습 범위가 섞이지 않도록 학교 소속은 학생이 직접 변경할 수 없어요.</p></div>`
      : `<div class="sumus-detail-section"><h3>비밀번호 변경</h3><form id="teacher-password-form"><label class="field"><span>현재 비밀번호</span><input name="current_password" type="password" autocomplete="current-password" required></label><label class="field"><span>새 비밀번호</span><input name="new_password" type="password" autocomplete="new-password" minlength="8" maxlength="128" placeholder="8자 이상" required></label><label class="field"><span>새 비밀번호 확인</span><input name="confirm_password" type="password" autocomplete="new-password" minlength="8" maxlength="128" required></label><div id="teacher-password-error" class="form-error" role="alert"></div><button class="btn primary full" type="submit">비밀번호 변경</button></form><p class="sumus-account-note">변경 후 현재 기기를 제외한 기존 로그인 세션은 종료됩니다.</p></div>`}
    <button class="btn full" id="account-logout" style="margin-top:10px">로그아웃</button>`, '내 계정');
  $('#account-logout').onclick = logout;
  $('#teacher-password-form')?.addEventListener('submit', async event => {
    event.preventDefault();
    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form));
    const error = $('#teacher-password-error');
    error.textContent = '';
    if (values.new_password !== values.confirm_password) return error.textContent = '새 비밀번호 확인이 일치하지 않습니다.';
    const button = $('[type="submit"]', form);
    buttonBusy(button);
    try {
      await api('/profile/password', { current_password: values.current_password, new_password: values.new_password }, 'PATCH');
      form.reset();
      toast('선생님 비밀번호를 변경했어요.');
    } catch (err) {
      error.textContent = err.message;
    } finally {
      buttonBusy(button, false);
    }
  });
}
function localDateTime(value) {
  const d = new Date(value);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}
function examStatusModal(id) {
  const exam = A.data.exams.find(item => item.id === id);
  if (!exam) return toast('시험을 찾을 수 없어요.');
  const students = A.data.profiles.filter(p => p.active && examTargetMatches(exam, p));
  const rows = students.map(student => {
    const attempts = A.data.attempts.filter(a => a.exam_id === id && a.student_id === student.id);
    const submitted = attempts.filter(a => a.status === 'submitted');
    const active = attempts.some(a => a.status === 'active');
    const label = submitted.length ? `완료 ${submitted.length}회` : active ? '응시 중' : '미응시';
    const cls = submitted.length ? 'green' : active ? 'blue' : '';
    return `<div class="exam-status-student"><button class="table-name" data-student="${student.id}"><strong>${esc(student.display_name)}</strong><small>${esc(student.class_name)} · ${esc(student.school)}</small></button><span class="pill ${cls}">${label}</span></div>`;
  }).join('');
  modal(`<h2>${esc(exam.title)}</h2><p>${esc(exam.school)} · ${esc(examTargetLabel(exam.class_name))} · ${exam.question_count}문제</p><div class="sumus-detail-section"><h3>응시 현황</h3><div class="exam-status-list">${rows || '<p class="tiny muted">대상 학생이 없어요.</p>'}</div></div>`, '시험 현황');
}
function examMenuModal(id) {
  const exam = A.data.exams.find(item => item.id === id);
  if (!exam) return toast('시험을 찾을 수 없어요.');
  const hasAttempts = A.data.attempts.some(a => a.exam_id === id);
  const close = modal(`<h2>시험 운영</h2><p><b>${esc(exam.title)}</b><br>${esc(exam.school)} · ${esc(examTargetLabel(exam.class_name))}</p>
    <div class="exam-menu-actions">
      <button class="btn full" id="exam-menu-toggle">${exam.active ? '배정 중지' : '다시 배정'}</button>
      <button class="btn full" id="exam-menu-clone">수정본으로 복제</button>
      <button class="btn full sumus-danger" id="exam-menu-delete" ${hasAttempts ? 'disabled' : ''}>시험 삭제</button>
    </div>
    ${hasAttempts ? '<p class="sumus-account-note">응시 기록이 있는 시험은 삭제할 수 없어요. 문제 구성을 바꾸려면 수정본으로 복제하세요.</p>' : ''}`, '시험 운영');
  $('#exam-menu-toggle').onclick = async event => {
    buttonBusy(event.currentTarget);
    try { await api('/exams/' + id, { active: !exam.active }, 'PATCH'); close(); await refresh(); render(); toast(exam.active ? '시험 배정을 중지했어요.' : '시험을 다시 배정했어요.'); }
    catch (err) { toast(err.message); buttonBusy(event.currentTarget, false); }
  };
  $('#exam-menu-clone').onclick = async event => {
    buttonBusy(event.currentTarget);
    try {
      const copy = await api('/exams/' + id + '/clone', {}, 'POST');
      close(); await refresh(); render(); toast('수정본을 만들었어요. 내용을 확인해 저장해주세요.'); examEditModal(copy.id);
    } catch (err) { toast(err.message); buttonBusy(event.currentTarget, false); }
  };
  $('#exam-menu-delete').onclick = async event => {
    if (!confirm('이 시험을 삭제할까요?')) return;
    buttonBusy(event.currentTarget);
    try { await api('/exams/' + id, {}, 'DELETE'); close(); await refresh(); render(); toast('시험을 삭제했어요.'); }
    catch (err) { toast(err.message); buttonBusy(event.currentTarget, false); }
  };
}
function examEditModal(id) {
  const exam = A.data.exams.find(item => item.id === id);
  if (!exam) return toast('시험을 찾을 수 없어요.');
  const locked = A.data.attempts.some(a => a.exam_id === id);
  const { codes, words } = getRanges(A, A.school, examRangeGrade(exam.class_name));
  const rangeChecks = codes.map(code => `<label class="range-option"><input type="checkbox" name="range_code" value="${esc(code)}" ${exam.range_codes.includes(code) ? 'checked' : ''} ${locked ? 'disabled' : ''}><span>${esc(code)}<small>${words.filter(w => w.range_code === code).length}개 단어</small></span></label>`).join('');
  const typeOptions = Object.entries(EXAM_TYPES).map(([key, type]) => `<option value="${key}" ${exam.exam_type === key ? 'selected' : ''}>${esc(type.label)}</option>`).join('');
  const classOptions = [...new Set([...examTargetOptions(), exam.class_name])].map(name => `<option value="${esc(name)}" ${name === exam.class_name ? 'selected' : ''}>${esc(examTargetLabel(name))}</option>`).join('');
  const close = modal(`<h2>시험 수정</h2><p>${esc(exam.school)} · ${locked ? '응시 기록 있음' : '아직 응시 기록 없음'}</p>
    ${locked ? '<div class="edit-lock-note">학생 응시 기록이 있어 <b>시험명 · 마감시간 · 결과공개 · 배정상태</b>만 수정할 수 있어요. 범위나 문제 구성을 바꾸려면 수정본으로 복제하세요.</div>' : ''}
    <form id="exam-edit-form">
      <label class="field"><span>시험 이름</span><input name="title" value="${esc(exam.title)}" required maxlength="120"></label>
      <div class="form-columns">
        <label class="field"><span>대상</span><select name="class_name" ${locked ? 'disabled' : ''}>${classOptions}</select></label>
        <label class="field"><span>시험 유형</span><select name="exam_type" ${locked ? 'disabled' : ''}>${typeOptions}</select></label>
        <label class="field"><span>문제 수</span><input name="question_count" type="number" min="1" max="${words.length}" value="${exam.question_count}" ${locked ? 'disabled' : ''}></label>
        <label class="field"><span>제한시간 (분)</span><input name="minutes" type="number" min="1" max="180" value="${Math.round(exam.duration_sec / 60)}" ${locked ? 'disabled' : ''}></label>
        <label class="field"><span>시작 시간</span><input name="available" type="datetime-local" value="${localDateTime(exam.available_at)}" ${locked ? 'disabled' : ''}></label>
        <label class="field"><span>마감 시간</span><input name="due" type="datetime-local" value="${localDateTime(exam.due_at)}" required></label>
        <label class="field"><span>통과 점수</span><input name="passing_score" type="number" min="0" max="100" value="${exam.passing_score}" ${locked ? 'disabled' : ''}></label>
        <label class="field"><span>응시 가능 횟수</span><input name="max_attempts" type="number" min="1" max="10" value="${exam.max_attempts}" ${locked ? 'disabled' : ''}></label>
      </div>
      <div class="step-label">시험 범위</div><div class="teacher-range">${rangeChecks}</div>
      <label class="checkbox-line"><input type="checkbox" name="release_result" ${exam.release_result ? 'checked' : ''}><span>제출 후 결과 공개</span></label>
      <label class="checkbox-line"><input type="checkbox" name="active" ${exam.active ? 'checked' : ''}><span>학생에게 배정</span></label>
      <div id="exam-edit-error" class="form-error" role="alert"></div>
      <button class="btn primary full" type="submit">수정 저장</button>
    </form>`, '시험 수정');
  $('#exam-edit-form').onsubmit = async event => {
    event.preventDefault();
    const form = event.currentTarget, button = $('[type="submit"]', form);
    const values = Object.fromEntries(new FormData(form));
    const payload = {
      title: values.title,
      due_at: new Date(values.due).getTime(),
      release_result: values.release_result === 'on',
      active: values.active === 'on'
    };
    if (!locked) Object.assign(payload, {
      class_name: values.class_name,
      exam_type: values.exam_type,
      question_count: Number(values.question_count),
      duration_sec: Number(values.minutes) * 60,
      available_at: new Date(values.available).getTime(),
      passing_score: Number(values.passing_score),
      max_attempts: Number(values.max_attempts),
      range_codes: $$('input[name="range_code"]:checked', form).map(input => input.value)
    });
    buttonBusy(button); $('#exam-edit-error').textContent = '';
    try { await api('/exams/' + id, payload, 'PATCH'); close(); await refresh(); render(); toast('시험을 수정했어요.'); }
    catch (err) { $('#exam-edit-error').textContent = err.message; buttonBusy(button, false); }
  };
}
function meaningAliasModal(wordId) {
  const word = A.data.books.flatMap(book => book.words || []).find(item => item.id === wordId);
  if (!word) return toast('단어를 찾을 수 없어요.');
  const aliases = A.data.meaning_aliases?.[wordId] || [];
  const meta = A.data.meaning_alias_meta?.[wordId] || [];
  const sourceLabel = source => source === 'appeal' ? '학생 이의제기로 추가' : source === 'teacher' ? '선생님 추가' : '기존 허용답';
  const aliasRows = aliases.map(alias => {
    const info = meta.find(item => String(item.value) === String(alias));
    return `<div class="meaning-alias-row"><div><strong>${esc(alias)}</strong><small>${esc(sourceLabel(info?.source || 'legacy'))}${info?.created_at ? ' · ' + date(info.created_at) : ''}</small></div><button class="text-button danger-text" data-alias-remove="${encodeURIComponent(alias)}">삭제</button></div>`;
  }).join('');
  const close = modal(`<h2>${esc(word.word)}</h2><p>원본 뜻: <b>${esc(word.meaning)}</b></p>
    <div class="sumus-detail-section"><h3>기본 유효답</h3><p class="sumus-account-note">같은 품사의 안전한 형태·동의 표현은 자동 판정합니다. 원본 뜻은 변경하지 않아요.</p></div>
    <div class="sumus-detail-section"><h3>추가 허용 뜻</h3><div class="meaning-alias-list detailed">${aliasRows || '<p class="tiny muted">추가로 승인된 허용 뜻이 없어요.</p>'}</div></div>
    <form id="meaning-alias-form"><label class="field"><span>새로 인정할 뜻</span><input name="alias" maxlength="80" placeholder="예: 인식하다" required></label><div id="meaning-alias-error" class="form-error"></div><button class="btn primary full" type="submit">선생님 허용 뜻으로 추가</button></form>
    ${aliases.length ? '<button class="text-button full" id="meaning-alias-clear" style="width:100%;margin-top:10px">추가 허용 뜻 전체 초기화</button>' : ''}`, '허용 뜻 관리');
  $('#meaning-alias-form').onsubmit = async event => {
    event.preventDefault(); const button = $('[type="submit"]', event.currentTarget); buttonBusy(button);
    try { await api('/meaning-aliases/' + encodeURIComponent(wordId), { alias: new FormData(event.currentTarget).get('alias') }, 'POST'); close(); await refresh(); render(); toast('선생님 허용 뜻으로 추가했어요.'); }
    catch (err) { $('#meaning-alias-error').textContent = err.message; buttonBusy(button, false); }
  };
  $$('[data-alias-remove]').forEach(button => button.addEventListener('click', async event => {
    const alias = decodeURIComponent(event.currentTarget.dataset.aliasRemove || '');
    if (!confirm(`"${alias}" 허용 뜻만 삭제할까요?`)) return;
    buttonBusy(event.currentTarget);
    try {
      await api('/meaning-aliases/' + encodeURIComponent(wordId) + '/' + encodeURIComponent(alias), {}, 'DELETE');
      close(); await refresh(); render(); toast('선택한 허용 뜻을 삭제했어요.');
    } catch (err) { toast(err.message); buttonBusy(event.currentTarget, false); }
  }));
  $('#meaning-alias-clear')?.addEventListener('click', async event => {
    if (!confirm('추가로 등록한 허용 뜻을 모두 지울까요? 기본 유효답은 유지됩니다.')) return;
    buttonBusy(event.currentTarget);
    try { await api('/meaning-aliases/' + encodeURIComponent(wordId), {}, 'DELETE'); close(); await refresh(); render(); toast('추가 허용 뜻을 초기화했어요.'); }
    catch (err) { toast(err.message); buttonBusy(event.currentTarget, false); }
  });
}
function parseDelimitedRows(text) {
  const matrix = []; let row = [], cell = '', quoted = false;
  const source = String(text || '').replace(/^\uFEFF/, '');
  for (let i = 0; i < source.length; i++) {
    const ch = source[i];
    if (ch === '"') {
      if (quoted && source[i + 1] === '"') { cell += '"'; i++; }
      else quoted = !quoted;
    } else if (ch === ',' && !quoted) { row.push(cell.trim()); cell = ''; }
    else if ((ch === '\n' || ch === '\r') && !quoted) {
      if (ch === '\r' && source[i + 1] === '\n') i++;
      row.push(cell.trim()); cell = '';
      if (row.some(Boolean)) matrix.push(row); row = [];
    } else cell += ch;
  }
  row.push(cell.trim()); if (row.some(Boolean)) matrix.push(row);
  if (!matrix.length) return [];
  const first = matrix[0].map(value => value.toLowerCase().replace(/\s+/g, ''));
  const isHeader = first.some(value => ['range','range_code','범위','번호','day'].includes(value))
    && first.some(value => ['word','english','영어','단어'].includes(value))
    && first.some(value => ['meaning','korean','뜻','의미'].includes(value));
  if (!isHeader) return matrix.map(values => ({ range_code: values[0], word: values[1], meaning: values.slice(2).join(', ') }));
  const find = names => first.findIndex(value => names.includes(value));
  const rangeIndex = find(['range','range_code','범위','번호','day']);
  const wordIndex = find(['word','english','영어','단어']);
  const meaningIndex = find(['meaning','korean','뜻','의미']);
  return matrix.slice(1).map(values => ({ range_code: values[rangeIndex], word: values[wordIndex], meaning: values[meaningIndex] }));
}
function parseVocabFile(name, text) {
  if (/\.json$/i.test(name)) {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) return parsed;
    if (Array.isArray(parsed?.words)) return parsed.words;
    throw new Error('JSON은 단어 배열 또는 { words: [...] } 형식이어야 합니다.');
  }
  return parseDelimitedRows(text);
}
function vocabImportModal() {
  if (A.data.profile.active_division !== 'middle') return toast('중등부에서 사용할 수 있어요.');
  let rows = [], preview = null;
  const close = modal(`<h2>중등 단어 파일 등록</h2><p>${esc(A.school)} 중2·중3 단어를 CSV 또는 JSON으로 등록합니다.</p>
    <div class="sumus-detail-section"><div class="form-columns"><label class="field"><span>학년</span><select id="vocab-import-grade"><option value="중2" ${A.vocabGrade === '중2' ? 'selected' : ''}>중2</option><option value="중3" ${A.vocabGrade === '중3' ? 'selected' : ''}>중3</option></select></label><label class="field"><span>파일</span><input id="vocab-import-file" type="file" accept=".csv,.json,text/csv,application/json"></label></div><p class="sumus-account-note">CSV 열: <b>범위, 영어, 뜻</b> 또는 <b>range, word, meaning</b>. 등록하면 같은 학교·같은 학년의 이전 업로드 단어를 교체합니다.</p></div>
    <div id="vocab-import-preview" class="vocab-import-preview"><p class="tiny muted">파일을 선택하면 등록 전 미리보기가 나옵니다.</p></div>
    <div id="vocab-import-error" class="form-error"></div>
    <button class="btn primary full" id="vocab-import-save" disabled>검수 후 등록하기</button>`, '단어 DB 등록');
  const renderPreview = data => {
    const ranges = data.ranges.map(item => `<span class="pill">${esc(item.range_code)} · ${item.count}개</span>`).join('');
    const sample = data.sample.map(item => `<tr><td>${esc(item.range_code)}</td><td><b>${esc(item.word)}</b></td><td>${esc(item.meaning)}</td></tr>`).join('');
    $('#vocab-import-preview').innerHTML = `<div class="import-summary"><strong>${data.valid}개 등록 가능</strong><span>${data.skipped ? data.skipped + '개 제외' : '오류 없음'}</span></div><div class="import-ranges">${ranges}</div><div class="table-scroll"><table><thead><tr><th>범위</th><th>영어</th><th>뜻</th></tr></thead><tbody>${sample}</tbody></table></div>${data.issues?.length ? `<p class="tiny muted">확인: ${esc(data.issues.slice(0, 3).map(item => item.row + '행 ' + item.message).join(' / '))}</p>` : ''}`;
    $('#vocab-import-save').disabled = !data.valid;
  };
  const previewRows = async () => {
    if (!rows.length) return;
    const error = $('#vocab-import-error'); error.textContent = '';
    $('#vocab-import-save').disabled = true;
    try {
      preview = await api('/vocab-import/preview', { grade: $('#vocab-import-grade').value, rows }, 'POST');
      renderPreview(preview);
    } catch (err) { error.textContent = err.message; }
  };
  $('#vocab-import-file').addEventListener('change', async event => {
    const file = event.target.files?.[0]; if (!file) return;
    const error = $('#vocab-import-error'); error.textContent = '';
    try { rows = parseVocabFile(file.name, await file.text()); await previewRows(); }
    catch (err) { rows = []; preview = null; $('#vocab-import-save').disabled = true; error.textContent = err.message; }
  });
  $('#vocab-import-grade').addEventListener('change', previewRows);
  $('#vocab-import-save').addEventListener('click', async event => {
    if (!preview || !rows.length) return;
    if (!confirm(`${A.school} ${preview.grade} 단어 ${preview.valid}개를 등록할까요? 기존 업로드 데이터는 교체됩니다.`)) return;
    buttonBusy(event.currentTarget);
    try {
      const result = await api('/vocab-import/commit', { grade: preview.grade, rows }, 'POST');
      A.vocabGrade = preview.grade; close(); await refresh(); render();
      toast(`${result.grade} 단어 ${result.count}개를 등록했어요.`);
    } catch (err) { $('#vocab-import-error').textContent = err.message; buttonBusy(event.currentTarget, false); }
  });
}
function activeClassOptions() { return (A.data.profile.active_division === 'middle' ? ['중2','중3'] : ['고1A','고1B']); }
function addStudent() {
  const classOptions = activeClassOptions().map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join('');
  const close = modal(`<h2>학생 등록</h2><p>${esc(A.school)} 학생 계정을 만듭니다. 아이디와 비밀번호를 학생에게 알려주세요.</p><form id="student-form"><input type="hidden" name="school_id" value="${esc(A.data.profile.active_school_id)}"><div class="form-columns"><label class="field"><span>학생 이름</span><input name="display_name" required maxlength="40"></label><label class="field"><span>반</span><select name="class_name" required>${classOptions}</select></label></div><div class="locked-school">${icon('shield')}<div><b>${esc(A.school)}</b><small>현재 관리 중인 학교</small></div></div><label class="field"><span>아이디</span><input name="username" required pattern="[a-z0-9_.-]{3,40}" placeholder="영문·숫자 3자 이상" autocomplete="off"></label><label class="field"><span>비밀번호</span><input name="password" required minlength="8" maxlength="128" type="password" placeholder="8자 이상" autocomplete="new-password"></label><div id="student-error" class="form-error" role="alert"></div><button class="btn primary full" type="submit">학생 등록하기</button></form>`, '학생 등록');
  $('#student-form').onsubmit = async e => { e.preventDefault(); const b = $('[type="submit"]', e.currentTarget); buttonBusy(b); try { await api('/students', Object.fromEntries(new FormData(e.currentTarget))); close(); await refresh(); render(); toast('학생 계정을 등록했어요.'); } catch (err) { $('#student-error').textContent = err.message; buttonBusy(b, false); } };
}
function studentModal(id) {
  const p = A.data.profiles.find(p => p.id === id), attempts = A.data.attempts.filter(a => a.student_id === id && a.status === 'submitted');
  const grammarItems = Object.values(A.data.grammar_progress?.[id] || {}).filter(item => !item.school_id || item.school_id === p.school_id);
  const grammarMastered = grammarItems.filter(item => item.mastered).length;
  const grammarRecent = [...grammarItems].sort((a, b) => Number(b.updated_at || 0) - Number(a.updated_at || 0))[0];
  const wordMastery = A.data.word_mastery?.[id] || {};
  const schoolOptions = A.data.schools.map(s => `<option value="${esc(s.id)}" ${s.id === p.school_id ? 'selected' : ''}>${esc(s.name)}</option>`).join('');
  const classOptions = [...new Set([...activeClassOptions(), p.class_name].filter(Boolean))].map(c => `<option value="${esc(c)}" ${c === p.class_name ? 'selected' : ''}>${esc(c)}</option>`).join('');
  const close = modal(`<h2>${esc(p.display_name)}</h2><p>${esc(p.class_name)} · ${p.school} · ${esc(p.username)}</p><div class="detail-grid"><div><b>${p.stats.today_total}문제</b><small>오늘 학습량</small></div><div><b>${p.stats.accuracy}%</b><small>연습 정답률</small></div><div><b>${p.stats.weak}개</b><small>취약 단어</small></div><div><b>${attempts.length}회</b><small>실전시험 응시</small></div></div><div class="sumus-detail-section"><h3>시험범위 정복</h3><div class="detail-grid"><div><b>${wordMastery.mastered || 0}/${wordMastery.total_ranges || 0}</b><small>단어 MASTER</small></div><div><b>${wordMastery.conquest || 0}%</b><small>단어 정복도</small></div><div><b>${grammarMastered}</b><small>어법 MASTER</small></div><div><b>${grammarItems.length}</b><small>어법 학습 지문</small></div></div><p class="sumus-account-note">${grammarRecent ? `최근 어법 학습 ${date(grammarRecent.updated_at)}` : '어법·어휘 학습 기록 없음'}</p></div><form id="student-update"><label class="field"><span>학교 변경</span><select name="school_id">${schoolOptions}</select></label><label class="field"><span>반 변경</span><select name="class_name" required>${classOptions}</select></label><label class="field"><span>새 비밀번호 (변경할 때만)</span><input name="password" type="password" minlength="8" autocomplete="new-password" placeholder="8자 이상"></label><label class="checkbox-line"><input type="checkbox" name="active" ${p.active ? 'checked' : ''}>계정 활성화</label><div class="form-error" id="update-error" role="alert"></div><button class="btn primary full" type="submit">변경 저장</button><div class="sumus-account-actions"><button class="btn" type="button" id="student-quick-reset">비밀번호 12345678로 재설정</button><button class="btn sumus-danger" type="button" id="student-quick-delete">학생 계정 삭제</button></div></form>`, '학생 정보');
  $('#student-update').onsubmit = async e => { e.preventDefault(); const v = Object.fromEntries(new FormData(e.currentTarget)); try { await api('/students/' + id, { ...v, active: v.active === 'on' }, 'PATCH'); close(); await refresh(); render(); toast('학생 정보를 저장했어요.'); } catch (err) { $('#update-error').textContent = err.message; } };
  $('#student-quick-reset').onclick = async e => { if (!confirm(p.display_name + ' 학생의 비밀번호를 12345678로 재설정할까요?')) return; buttonBusy(e.currentTarget); try { await api('/students/' + id, { password: '12345678' }, 'PATCH'); toast('비밀번호를 12345678로 재설정했어요.'); } catch (err) { toast(err.message); } finally { buttonBusy(e.currentTarget, false); } };
  $('#student-quick-delete').onclick = async e => { if (!confirm(p.display_name + ' 학생 계정을 삭제할까요?\n연습 기록과 시험 기록도 함께 삭제됩니다.')) return; buttonBusy(e.currentTarget); try { await api('/students/' + id, {}, 'DELETE'); close(); await refresh(); render(); toast('학생 계정을 삭제했어요.'); } catch (err) { toast(err.message); buttonBusy(e.currentTarget, false); } };
}
function addAssignment() {
  const classes = activeClassOptions();
  const defaultClass = classes[0];
  const classOptions = classes.map(name => `<option value="${esc(name)}">${esc(name)}</option>`).join('');
  const rangeHtml = className => {
    const info = getRanges(A, A.school, className);
    return info.codes.map((code, index) => `<label class="range-option"><input type="checkbox" value="${esc(code)}" ${index < 2 ? 'checked' : ''}><span>${esc(code)}<small>${info.words.filter(word => word.range_code === code).length}개 단어</small></span></label>`).join('');
  };
  const close = modal(`<h2>연습 과제 만들기</h2><p>${esc(A.school)}의 학년별 단어 범위를 선택해 배정하세요.</p><form id="assignment-form"><input type="hidden" name="school_id" value="${esc(A.data.profile.active_school_id)}"><label class="field"><span>과제명</span><input name="title" required placeholder="예: 중간고사 단어 복습"></label><div class="form-columns"><label class="field"><span>반</span><select id="assignment-class" name="class_name" required>${classOptions}</select></label><label class="field"><span>목표 문제 수</span><input name="target_questions" type="number" min="5" max="500" value="40" required></label></div><div class="locked-school">${icon('shield')}<div><b>${esc(A.school)}</b><small>현재 관리 중인 학교</small></div></div><div class="range-grid" id="assignment-ranges">${rangeHtml(defaultClass)}</div><label class="field" style="margin-top:18px"><span>마감일</span><input name="due" type="date" required></label><div class="form-error" id="assignment-error" role="alert"></div><button class="btn primary full" type="submit">과제 배정하기</button></form>`, '연습 과제 배정');
  $('#assignment-class').addEventListener('change', event => { $('#assignment-ranges').innerHTML = rangeHtml(event.target.value); });
  $('#assignment-form').onsubmit = async e => {
    e.preventDefault();
    const v = Object.fromEntries(new FormData(e.currentTarget));
    const range_codes = $$('input:checked', $('#assignment-ranges')).map(input => input.value);
    if (!range_codes.length) return $('#assignment-error').textContent = '과제 범위를 하나 이상 선택해주세요.';
    try {
      await api('/assignments', { ...v, range_codes, target_questions: Number(v.target_questions), due_at: new Date(v.due + 'T23:59:59').getTime() });
      close(); await refresh(); render(); toast('연습 과제를 배정했어요.');
    } catch (err) { $('#assignment-error').textContent = err.message; }
  };
}
function exportResults() {
  const safe = value => '"' + String(value ?? '').replace(/^[=+@-]/, "'$&").replaceAll('"', '""') + '"';
  const rows = [['학생', '반', '시험', '유형', '점수', '정답 수', '전체', '제출 시간']];
  A.data.attempts.filter(a => a.status === 'submitted').forEach(a => { const p = A.data.profiles.find(p => p.id === a.student_id), e = A.data.exams.find(e => e.id === a.exam_id); rows.push([p?.display_name, p?.class_name, e?.title, EXAM_TYPES[e?.exam_type]?.label, a.score, a.correct, a.total, date(a.submitted_at)]); });
  const url = URL.createObjectURL(new Blob(['\uFEFF' + rows.map(r => r.map(safe).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' })); const link = document.createElement('a'); link.href = url; link.download = 'SUMUS_시험결과.csv'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 5000);
}
loginView();
try {
  const session = await api('/session');
  if (session.authenticated) {
    await refresh();
    preferences();
    A.tab = A.data.profile.role === 'teacher' ? 'dashboard' : A.data.profile.avatar_key ? 'home' : 'studio';
    render();
    startPolling();
  }
} catch (e) {
  if (e.status !== 401) {
    $('#login-error').textContent = '서버 응답이 느립니다. 잠시 후 다시 로그인해주세요.';
  }
}
