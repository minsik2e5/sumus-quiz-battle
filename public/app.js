import { $, $$, api, esc, icon, toast, modal, buttonBusy, date, num, rangeLabel } from './modules/ui.js';
import { CHARACTERS, EXAM_TYPES, PRACTICE_TYPES, CLASS_OPTIONS, petForm } from './modules/core.js';
import { avatar } from './modules/character.js';
import { studentPage, getRanges, updateRangeSummary } from './modules/student.js';
import { teacherPage, collectExamForm, updateExamSummary, studentFiltered, vocabTable, moreVocab, onTeacherGrammarLoaded } from './modules/teacher.js';
import { configureSessions, openExam, openResult, openPracticeRecord, startPractice, resumeActivePractice, leaveSession } from './modules/sessions.js';
import { maybePetMoment, openPetNameModal, openEggShop, petJosa } from './modules/pet-moments.js';
import { mountYacha } from './modules/battle.js';
import { maybeTitleMoment, openTitleDetail } from './modules/titles-ui.js';
import { mountLeagueBoard } from './modules/league-ui.js';
import { coin } from './modules/emblems.js';
import { openBracket } from './modules/tournament-ui.js';
import { openBracketTv } from './modules/bracket-tv.js';
import { mountArcade, attendanceMoment } from './modules/arcade.js';
import { LUCKY_BETS, ATTENDANCE_REWARDS, BOT_WIN_REWARDS, BOT_TRY_REWARD, BOT_DAILY, EXAM_COINS } from './modules/rewards.js';
import { EGG_PRICE } from './modules/core.js';
const A = { data: null, tab: 'home', screen: null, school: '단원고', ranges: {}, mode: 'write_meaning', practiceRunMode: 'practice', target: 30, sound: false, role: 'student', division: 'high', studyView: 'hub', examKind: null, memorizeFilter: 'all', memorizeShowAll: false, memorizeRange: '', memStars: [], memRevealed: [], middleWordsOpen: false, middleGrammarLesson: 6 };
const ALL_CLASSES = '__ALL__';
const examTargetLabel = value => value === ALL_CLASSES ? '학교 전체' : value;
const examTargetMatches = (exam, profile) => exam?.class_name === ALL_CLASSES || exam?.class_name === profile?.class_name;
const examRangeGrade = value => value === ALL_CLASSES ? null : value;
const examTargetOptions = () => A.data.profile.active_division === 'middle' ? ['중2', '중3'] : [ALL_CLASSES, '고1A', '고1B'];
let poll, rendering = false, contextGeneration = 0;
function preferences() {
  try {
    const v = JSON.parse(localStorage.getItem('sumus:v13:prefs:' + A.data.profile.id) || localStorage.getItem('sumus:v12:prefs:' + A.data.profile.id) || '{}');
    A.ranges = v.ranges || {};
    A.school = A.data.profile.role === 'teacher' ? A.data.profile.active_school : A.data.profile.school || v.school || A.data.schools[0]?.name || '단원고';
    A.division = A.data.profile.active_division || A.data.profile.division || A.division || 'high';
    A.mode = v.mode || 'write_meaning';
    A.practiceRunMode = ['practice','test'].includes(v.practiceRunMode) ? v.practiceRunMode : 'practice';
    A.target = v.target || 30;
    A.highRangeType = ['mock','textbook'].includes(v.highRangeType) ? v.highRangeType : (A.highRangeType || 'mock');
    A.memorizeRangeType = ['mock','textbook'].includes(v.memorizeRangeType) ? v.memorizeRangeType : (A.memorizeRangeType || 'mock');
    A.middleRange = v.middleRange || A.middleRange || '';
    A.middleChunkSize = [20,25,30].includes(Number(v.middleChunkSize)) ? Number(v.middleChunkSize) : (A.middleChunkSize || 20);
    A.middleStartIndex = Math.max(0, Number(v.middleStartIndex || 0));
    A.middleWordIds = Array.isArray(v.middleWordIds) ? v.middleWordIds : (A.middleWordIds || []);
    A.rankMode = v.rankMode || A.rankMode || 'xp';
    A.rankScope = v.rankScope || A.rankScope || 'all';
    A.rankPeriod = v.rankPeriod || A.rankPeriod || 'week';
    A.rankView = v.rankView === 'league' ? 'league' : 'study';
    A.leaguePeriod = v.leaguePeriod === 'all' ? 'all' : 'week';
    A.memorizeFilter = v.memorizeFilter === 'starred' ? 'starred' : 'all';
    A.memorizeRange = v.memorizeRange || A.memorizeRange || '';
    A.memStars = Array.isArray(v.memStars) ? v.memStars : [];
    A.sound = localStorage.getItem('sumus:sound') === 'true';
  } catch {}
}
function savePreferences() {
  try {
    localStorage.setItem('sumus:v13:prefs:' + A.data.profile.id, JSON.stringify({
      ranges: A.ranges, school: A.school, mode: A.mode, practiceRunMode: A.practiceRunMode, target: A.target,
      highRangeType: A.highRangeType || 'mock', memorizeRangeType: A.memorizeRangeType || 'mock',
      rankMode: A.rankMode, rankScope: A.rankScope, rankPeriod: A.rankPeriod, rankView: A.rankView, leaguePeriod: A.leaguePeriod,
      middleRange: A.middleRange, middleChunkSize: A.middleChunkSize || 20, middleStartIndex: A.middleStartIndex || 0,
      middleWordIds: A.middleWordIds || [], memorizeFilter: A.memorizeFilter || 'all',
      memorizeRange: A.memorizeRange || '', memStars: A.memStars || []
    }));
  } catch {}
}
async function refresh() { A.data = await api('/bootstrap'); A.loadedAt = Date.now(); globalThis.__SUMUS_BOOTSTRAP__ = A.data; if (A.data.profile.role === 'teacher') A.school = A.data.profile.active_school; }
globalThis.__SUMUS_APPLY_BOOTSTRAP__ = data => { A.data = data; A.loadedAt = Date.now(); globalThis.__SUMUS_BOOTSTRAP__ = data; if (data?.profile?.role === 'teacher') A.school = data.profile.active_school; if (!A.screen) render(); };
let roleModules = { teacher: null, student: null };
function ensureRoleEnhancements() {
  const role = A.data?.profile?.role;
  if (role === 'teacher' && !roleModules.teacher) {
    roleModules.teacher = Promise.all([
      import('./teacher-enhancements.js'),
      import('./exam-ops.js')
    ]).catch(() => null);
  }
  if (role === 'student' && !roleModules.student) {
    roleModules.student = Promise.all([
      import('./student-enhancements.js'),
      import('./practice-enhancements.js')
    ]).catch(() => null);
  }
}
async function ensureGrammarData() {
  if (!A.data?.profile) return;
  const division = A.data.profile.division;
  const school = A.data.profile.school || A.school || '';
  const key = division + ':' + school;
  if (A.grammarDataKey === key && A.grammarData) return;
  let data = { passages: [] };
  if (division === 'middle') {
    const mod = await import('./middle-donga-yoon-grammar-data.js');
    data = { passages: mod.MIDDLE_DONGA_YOON_PASSAGES || [], byLesson: mod.MIDDLE_DONGA_YOON_BY_LESSON || {} };
  } else if (school === '단원고') {
    const [mock, textbook] = await Promise.all([import('./danwongo-grammar-data.js'), import('./danwongo-textbook-grammar-data.js')]);
    const textbookPassages = textbook.DANWONGO_TEXTBOOK_PASSAGES || [];
    const mockPassages = mock.DANWONGO_PASSAGES || [];
    data = { passages: [...textbookPassages, ...mockPassages], textbook: textbookPassages, byLesson: textbook.DANWONGO_TEXTBOOK_BY_LESSON || {}, mock: mockPassages };
  } else if (school === '선부고') {
    const mod = await import('./seonbu-grammar-data.js');
    const current = mod.SEONBU_2026_PASSAGES || [], old = mod.SEONBU_2025_PASSAGES || [];
    data = { passages: [...current, ...old], current, old };
  } else if (school === '강서고') {
    // 강서고 uses the same textbook as 단원고: textbook lessons first, then its own mock exam.
    const [mod, textbook] = await Promise.all([import('./gangseo-grammar-data.js'), import('./danwongo-textbook-grammar-data.js')]);
    const textbookPassages = textbook.DANWONGO_TEXTBOOK_PASSAGES || [];
    const mockPassages = mod.GANGSEO_PASSAGES || [];
    data = { passages: [...textbookPassages, ...mockPassages], textbook: textbookPassages, byLesson: textbook.DANWONGO_TEXTBOOK_BY_LESSON || {}, mock: mockPassages };
  }
  A.grammarDataKey = key;
  A.grammarData = data;
}
function renderKeepScroll() {
  const y = window.scrollY;
  render();
  requestAnimationFrame(() => window.scrollTo(0, y));
}
// Teacher grammar summaries fill in once the school's dataset arrives.
onTeacherGrammarLoaded(() => { if (A.data?.profile?.role === 'teacher' && !A.screen && !document.querySelector('#modal-root .modal') && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) renderKeepScroll(); });
function render() {
  if (!A.data || A.screen) return;
  // Every student picks a first pet (once) before using the app.
  if (A.data.profile.role === 'student' && A.data.stats?.needs_pet_pick) A.tab = 'studio';
  $('#app').innerHTML = A.data.profile.role === 'teacher' ? teacherPage(A) : studentPage(A);
  bindPageForms();
  queueMicrotask(ensureRoleEnhancements);
  if (A.data.profile.role === 'student') {
    $$('[data-league-board]').forEach(el => mountLeagueBoard(el, period => { A.leaguePeriod = period; savePreferences(); }));
    $$('[data-arcade]').forEach(el => mountArcade(el, A));
    $$('#yacha-host').forEach(el => { const opts = A.yachaOpts; A.yachaOpts = null; mountYacha(el, A, leaveBattle, opts); });
    queueMicrotask(() => maybePetMoment(A, petChanged));
    queueMicrotask(() => maybeTitleMoment(A, moved => { if (moved) { render(); window.scrollTo(0, 0); } else renderKeepScroll(); }));
  }
}
async function petChanged() { try { await refresh(); A.style = null; renderKeepScroll(); } catch (err) { toast(err.message); } }
function confirmFirstPet(key) {
  const c = CHARACTERS[key]; if (!c) return;
  const close = modal(`<div class="pet-confirm">${avatar(key, { form: Math.max(1, petForm(A.data.stats.level)) })}<h2>${esc(petJosa(c.ko, '과', '와'))} 함께할까요?</h2><p>첫 펫은 <b>다시 바꿀 수 없어요.</b><br>지금까지 쌓은 경험치로 바로 자라요.</p><button class="btn primary full" id="confirm-first-pet">${esc(petJosa(c.ko, '으로', '로'))} 정할게요</button><button class="btn full" id="cancel-first-pet">다시 고를래요</button></div>`, '첫 펫 확인');
  $('#cancel-first-pet').onclick = close;
  $('#confirm-first-pet').onclick = async event => {
    const b = event.currentTarget; buttonBusy(b);
    try { await api('/pets/choose', { key }); close(); await refresh(); A.style = null; A.tab = 'home'; render(); window.scrollTo(0, 0); toast(`이제 ${petJosa(c.ko, '과', '와')} 함께 공부해요!`); }
    catch (err) { toast(err.message); buttonBusy(b, false); }
  };
}
configureSessions(A, render, refresh);
function navigate(tab) {
  collectExamForm(A); A.tab = tab;
  if (tab === 'practice') { A.studyView = 'hub'; A.practiceRunMode = 'practice'; }
  if (tab === 'exam') { A.examKind = null; A.practiceRunMode = 'practice'; if (!['write_meaning','spell','eng2mean','mean2eng'].includes(A.mode)) A.mode = 'eng2mean'; }
  A.search = ''; A.classFilter = ''; A.style = null; A.vocabLimit = 0; render(); window.scrollTo(0, 0);
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
  // V13.64: on wide screens the login sits next to a brand panel (what the app does + the pet
  // growing up). Phones keep the single card; the panel's images are lazy so phones skip them.
  const showcase = teacher
    ? { kicker: 'SUMUS VOCA · 선생님', title: '학생들의 오늘을<br>한눈에 관리해요', items: [['home', '오늘 현황', '누가 학습했고 누가 아직인지 바로 확인'], ['user', '학생 관리', '반별 정답률·취약 단어·최근 활동'], ['ranking', '결과 분석', '연습·실전 기록과 뜻 이의제기 처리']] }
    : { kicker: 'SUMUS VOCA', title: '매일 20개,<br>펫과 함께 쌓는 영어 실력', items: [['check', '오늘의 추천 학습', '틀린 단어·복습·새 단어를 알맞게 섞어 20개'], ['sparkle', '펫 키우기', '공부할수록 자라고, 진화하고, 컬렉션이 늘어요'], ['flame', '야차전', '친구와 1:1 실시간 단어 대결']] };
  const showcaseHtml = `<aside class="auth-show-v1364" aria-hidden="true"><div class="auth-show-in"><span class="auth-show-kicker">${showcase.kicker}</span><h2>${showcase.title}</h2><ul>${showcase.items.map(([i, t, d]) => `<li><span>${icon(i)}</span><div><b>${t}</b><small>${d}</small></div></li>`).join('')}</ul><div class="auth-show-pets">${[1, 2, 3].map(f => `<img src="/assets/pets/dog-${f}.webp" alt="" loading="lazy" decoding="async" width="512" height="512">`).join('')}</div><p class="auth-show-foot">Better Words, A Brighter You</p></div></aside>`;
  $('#app').innerHTML = `<div class="auth auth-v1327 auth-v1364${teacher ? ' is-teacher' : ''}">${showcaseHtml}<form class="auth-form auth-card-v1327" id="login-form">
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
      const values = Object.fromEntries(new FormData(e.currentTarget)); const login = await api('/login', { ...values, role: A.role, division: A.division }); A.role = login.profile?.role || A.role; await refresh(); preferences(); A.tab = A.data.profile.role === 'teacher' ? 'dashboard' : A.data.profile.avatar_key ? 'home' : 'studio'; render(); startPolling(); if (A.data.profile.role === 'student' && A.data.active_practice) await resumeActivePractice();
    } catch (err) { $('#login-error').textContent = err.message; buttonBusy(b, false); }
  };
}
window.addEventListener('offline', () => toast('인터넷 연결이 끊겼어요. 현재 화면은 유지할게요.'));
window.addEventListener('online', async () => {
  toast('연결이 복구됐어요.');
  if (!A.data || A.screen) return;
  try { await refresh(); renderKeepScroll(); } catch {}
});
window.addEventListener('pageshow', async event => {
  if (!event.persisted || !A.data || A.screen) return;
  try { await refresh(); renderKeepScroll(); } catch {}
});
// V13.63: pets with a run cycle run three laps when tapped; the rest hop. The sheet is loaded
// on the first tap (the pet hops meanwhile) and runs from the next tap on.
const RUN_MS = 1800;
function runPet(art) {
  const box = art.querySelector('.avatar-art[data-run]');
  if (!box || matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
  const url = box.dataset.run;
  const pre = art.querySelector('.pet-run-preload');
  if (pre?.complete && pre.naturalWidth > 0) (runPet.ready ||= new Set()).add(url);
  if (!runPet.ready?.has(url)) {
    runPet.ready ||= new Set();
    const img = new Image(); img.src = url;
    img.decode().then(() => runPet.ready.add(url)).catch(() => {});
    return false;
  }
  let sprite = box.querySelector('.pet-run');
  if (!sprite) { sprite = document.createElement('i'); sprite.className = 'pet-run'; sprite.setAttribute('aria-hidden', 'true'); sprite.style.setProperty('--run', `url("${url}")`); sprite.appendChild(document.createElement('b')); box.appendChild(sprite); }
  // Same square the still sprite occupies (object-fit: contain), so the switch does not jump.
  sprite.style.setProperty('--side', `${Math.min(box.clientWidth, box.clientHeight)}px`);
  art.classList.remove('running'); void art.offsetWidth; art.classList.add('running');
  clearTimeout(art._run); art._run = setTimeout(() => art.classList.remove('running'), RUN_MS);
  return true;
}
function pokePet(art) {
  if (!art.classList.contains('running') && !runPet(art)) {
    art.classList.remove('poke'); void art.offsetWidth; art.classList.add('poke');
    clearTimeout(art._poke); art._poke = setTimeout(() => art.classList.remove('poke'), 720);
  }
  navigator.vibrate?.(12);
  for (let i = 0; i < 3; i++) {
    const heart = document.createElement('i');
    heart.className = 'pet-heart'; heart.textContent = '♥'; heart.setAttribute('aria-hidden', 'true');
    heart.style.setProperty('--x', `${38 + i * 12}%`); heart.style.setProperty('--dx', `${(i - 1) * 18}px`); heart.style.animationDelay = `${i * 90}ms`;
    art.appendChild(heart);
    setTimeout(() => heart.remove(), 1200);
  }
}
async function leaveBattle() { A.screen = null; await petChanged(); window.scrollTo(0, 0); }
// V13.61: a student on the home screen checks for a friend's challenge every 20 seconds
// (a small request; the full refresh stays every 2 minutes).
let invitePoll;
function startInvitePolling() {
  clearInterval(invitePoll);
  if (A.data?.profile?.role !== 'student') return;
  invitePoll = setInterval(async () => {
    if (!A.data || A.screen || A.tab !== 'home' || document.visibilityState !== 'visible' || $('#modal-root').children.length) return;
    try {
      const { invite } = await api('/battle/invite');
      const before = A.data.battle_invite;
      if ((invite?.id || null) === (before?.id || null) && !invite) return;
      A.data.battle_invite = invite;
      if (invite && invite.id !== before?.id) { toast(`${invite.host}의 도전장이 왔어요!`); navigator.vibrate?.(80); }
      renderKeepScroll();
    } catch {}
  }, 20000);
}
// V13.66: while a teacher watches a tournament, the bracket refreshes every 8 seconds.
let tournamentPoll;
function startTournamentPolling() {
  clearInterval(tournamentPoll);
  if (A.data?.profile?.role !== 'teacher') return;
  tournamentPoll = setInterval(async () => {
    if (!A.data || A.screen || A.tab !== 'tournaments' || document.visibilityState !== 'visible' || $('#modal-root').children.length) return;
    if (document.activeElement && ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) return;
    if (!(A.data.tournaments || []).some(t => t.status === 'active')) return;
    try { await refresh(); renderKeepScroll(); } catch {}
  }, 8000);
}
function startPolling() {
  startInvitePolling();
  startTournamentPolling();
  clearInterval(poll);
  const interval = A.data?.profile?.role === 'teacher' ? 60000 : 120000;
  poll = setInterval(async () => {
    if (!A.data || A.screen || document.visibilityState !== 'visible' || $('#modal-root').children.length) return;
    if (document.activeElement && ['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName)) return;
    const liveTabs = A.data.profile.role === 'teacher'
      ? ['dashboard', 'exams', 'results', 'tournaments']
      : ['home', 'ranking'];
    if (!liveTabs.includes(A.tab)) return;
    try { await refresh(); renderKeepScroll(); }
    catch (err) { if (err.status === 401) { clearInterval(poll); A.data = null; loginView(); } }
  }, interval);
}
// Partner card on the home screen: the foil follows the finger, and the card tilts a little
// unless the phone asks for reduced motion.
$('#app').addEventListener('pointermove', event => {
  const card = event.target.closest?.('.partner-card-btn');
  if (!card) return;
  const r = card.getBoundingClientRect();
  const x = Math.min(1, Math.max(0, (event.clientX - r.left) / r.width)), y = Math.min(1, Math.max(0, (event.clientY - r.top) / r.height));
  card.style.setProperty('--mx', `${(x * 100).toFixed(1)}%`);
  card.style.setProperty('--my', `${(y * 100).toFixed(1)}%`);
  if (card.getAttribute('aria-pressed') !== 'true' && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    card.style.setProperty('--ry', `${((x - .5) * 12).toFixed(2)}deg`);
    card.style.setProperty('--rx', `${((.5 - y) * 12).toFixed(2)}deg`);
  }
});
$('#app').addEventListener('pointerout', event => {
  const card = event.target.closest?.('.partner-card-btn');
  if (!card || card.contains(event.relatedTarget)) return;
  card.style.setProperty('--rx', '0deg');
  card.style.setProperty('--ry', '0deg');
});
$('#app').addEventListener('click', async event => {
  const b = event.target.closest('button'); if (!b || b.disabled || !A.data || A.screen) return;
  // V13.68: the yacha lobby inside its tab answers its own buttons (battle.js).
  if (b.closest('#yacha-host')) return;
  const d = b.dataset; if (!Object.keys(d).length) return; event.preventDefault();
  try {
    if (d.go) { if (d.go === 'ranking') A.rankFrom = d.from || 'home'; return navigate(d.go); }
    if (d.action === 'student-preview' && A.data.profile.role === 'teacher') {
      const grade = $('#preview-grade')?.value || (A.data.profile.active_division === 'middle' ? '중3' : '고1A');
      await api('/teacher/student-preview', { school_id: A.data.profile.active_school_id, grade });
      await refresh(); A.role = 'student'; A.tab = A.data.profile.avatar_key ? 'home' : 'studio'; render(); window.scrollTo(0, 0); return;
    }
    if (d.action === 'exit-student-preview' && A.data.profile.preview_owner_id) {
      await api('/student-preview/exit', {});
      await refresh(); A.role = 'teacher'; A.tab = 'dashboard'; render(); window.scrollTo(0, 0); return;
    }
    if (d.teacherDivision && A.data.profile.role === 'teacher') { await performTeacherContextSwitch('division', d.teacherDivision); return; }
    if (d.study) {
      if (d.study === 'grammar') { buttonBusy(b); await ensureGrammarData(); }
      A.studyView = d.study; A.tab = 'practice'; A.practiceRunMode = 'practice'; render(); window.scrollTo(0, 0); return;
    }
    if (d.memorizeRangeType) {
      A.memorizeRangeType = d.memorizeRangeType;
      const info = getRanges(A);
      const codes = info.codes.filter(code => d.memorizeRangeType === 'textbook' ? /^L\\d+$/i.test(String(code)) : !/^L\\d+$/i.test(String(code)));
      A.memorizeRange = String(codes[0] || '');
      A.memRevealed = []; A.memorizeFilter = 'all'; savePreferences(); renderKeepScroll(); return;
    }
    if (d.memorizeRange) { A.memorizeRange = d.memorizeRange; A.memRevealed = []; A.memorizeFilter = 'all'; savePreferences(); renderKeepScroll(); return; }
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
      if (!['write_meaning','spell','eng2mean','mean2eng'].includes(A.mode)) A.mode = 'write_meaning';
      savePreferences(); render(); window.scrollTo(0,0); return;
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
    if (d.mode) { A.mode = d.mode; savePreferences(); renderKeepScroll(); return; }
    if (d.practiceTarget) { A.target = d.practiceTarget === 'all' ? 'all' : Number(d.practiceTarget); $$('[data-practice-target]').forEach(e => { const selected = e === b; e.classList.toggle('selected', selected); e.setAttribute('aria-pressed', String(selected)); }); savePreferences(); render(); return; }
    if (d.highRangeType) { A.highRangeType = d.highRangeType; A.target = 20; savePreferences(); renderKeepScroll(); return; }
    if (d.highRangeAll) {
      const info = getRanges(A);
      const visibleCodes = info.codes.filter(code => d.highRangeType === 'textbook' ? /^L\\d+$/i.test(String(code)) : !/^L\\d+$/i.test(String(code)));
      const current = new Set(info.selected);
      visibleCodes.forEach(code => d.highRangeAll === 'true' ? current.add(code) : current.delete(code));
      A.ranges[info.key] = [...current]; savePreferences(); render(); return;
    }
    if (d.middleWordAll) {
      const words = A.data.books.flatMap(book => book.words || []).filter(word => String(word.range_code) === String(A.middleRange || ''));
      A.middleWordIds = d.middleWordAll === 'true' ? words.map(word => word.id) : [];
      A.target = 'all';
      savePreferences();
      renderKeepScroll();
      return;
    }
    if (d.middleLesson) { A.middleRange = d.middleLesson; A.middleStartIndex = 0; A.middleWordIds = []; A.middleWordsOpen = false; A.target = 'all'; savePreferences(); renderKeepScroll(); return; }
    if (d.middleGrammarLesson) { A.middleGrammarLesson = Number(d.middleGrammarLesson); render(); window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
    if (d.rankMode) { A.rankMode = d.rankMode; savePreferences(); render(); return; }
    if (d.rankView) { A.rankView = d.rankView === 'league' ? 'league' : 'study'; savePreferences(); render(); return; }
    if (d.titleFilter) { A.titleFilter = d.titleFilter; renderKeepScroll(); return; }
    if (d.titleOpen) { openTitleDetail(A, d.titleOpen, renderKeepScroll); return; }
    if (d.leaguePeriod) return;
    if (d.rankScope) { A.rankScope = d.rankScope; savePreferences(); render(); return; }
    if (d.rankPeriod) { A.rankPeriod = d.rankPeriod; savePreferences(); render(); return; }
    if (d.recordTab) { A.recordTab = d.recordTab; render(); return; }
    if (d.studioTab) { A.studioTab = d.studioTab; render(); return; }
    if (d.style) { A.style[d.style] = d.value; render(); return; }
    if (d.exam) return await openExam(d.exam);
    if (d.result) return await openResult(d.result);
    if (d.practiceRecord) return openPracticeRecord(d.practiceRecord);
    if (d.resultsMore !== undefined) { A.resultsLimit = (Number(A.resultsLimit) || 30) + 30; renderKeepScroll(); return; }
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
      buttonBusy(b);
      await ensureGrammarData();
      const { openGrammarChoiceSample } = await import('./grammar-choice-sample.js');
      openGrammarChoiceSample(A, render, d.grammarId);
      return;
    }
    if (d.action === 'partner-flip') {
      // V13.62: tapping the pet on the front makes it jump with hearts; the rest of the card flips it.
      const art = event.target.closest('.partner-art');
      if (art && b.getAttribute('aria-pressed') !== 'true') { pokePet(art); return; }
      // V13.66: an unnamed pet shows a small "✎ 이름" on the card that opens the name form.
      if (event.target.closest('.partner-name-pen') && b.getAttribute('aria-pressed') !== 'true') return openPetNameModal(A, petChanged);
      const flipped = b.getAttribute('aria-pressed') !== 'true';
      b.setAttribute('aria-pressed', String(flipped));
      b.closest('.partner-card-v1358')?.classList.toggle('flipped', flipped);
      b.style.setProperty('--rx', '0deg'); b.style.setProperty('--ry', '0deg');
      return;
    }
    if (d.action === 'pet-name') return openPetNameModal(A, petChanged);
    if (d.action === 'choose-pet') return confirmFirstPet(d.key);
    if (d.action === 'egg-shop') return openEggShop(A, petChanged);
    if (d.action === 'vocab-more') { moreVocab(A); $('#vocab-table').innerHTML = vocabTable(A); return; }
    if (d.action === 'battle') return navigate('yacha');
    if (d.action === 'coins') return walletModal();
    if (d.action === 'attend') return attend(b);
    if (d.action === 'tournament-play') { A.yachaOpts = { tournament: { tid: d.tournament, mid: d.match } }; return navigate('yacha'); }
    if (d.action === 'tournament-bracket') return bracketModal(d.tournament);
    if (d.action === 'tournament-new') return tournamentCreateModal();
    if (d.action === 'tournament-tv') return openTournamentTv(d.id);
    if (d.action === 'tournament-cancel') return cancelTournament(d.id, b);
    if (d.tnDecide) return decideTournamentMatch(d.tnDecide, d.match, d.winner, d.name, b);
    if (d.action === 'battle-accept' && A.data.battle_invite) { const invite = A.data.battle_invite; A.data.battle_invite = null; A.yachaOpts = { accept: invite }; return navigate('yacha'); }
    if (d.action === 'battle-decline') { buttonBusy(b); await api('/battle/invite/decline', { id: d.id }); A.data.battle_invite = null; renderKeepScroll(); toast('도전장을 거절했어요.'); return; }
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
    A.middleWordIds = [...set];
    A.target = 'all';
    input.closest('.middle-direct-word-v1343')?.classList.toggle('selected', input.checked);
    const count = set.size;
    const countEl = $('#middle-direct-count');
    if (countEl) countEl.textContent = count + '개 선택';
    const startButton = $('[data-action="start-exam-run"]');
    if (startButton) startButton.disabled = count === 0;
    const summary = $('.exam-start-inline p');
    if (summary) summary.textContent = `${A.middleRange || ''}과 · 직접 선택 ${count}개 · ${count}문제 · ${PRACTICE_TYPES[A.mode] || '뜻쓰기'}`;
    savePreferences();
    return;
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
  if (input.id === 'vocab-grade') { A.vocabGrade = input.value; A.vocabLimit = 0; $('#vocab-table').innerHTML = vocabTable(A); return; }
  if (input.id === 'class-filter') { A.classFilter = input.value; $('#student-table').innerHTML = studentFiltered(A); }
  if (input.id === 'results-class') { A.resultsClass = input.value; A.resultsLimit = 30; renderKeepScroll(); }
});
function bindPageForms() {
  $('#student-search')?.addEventListener('input', e => { A.search = e.target.value; $('#student-table').innerHTML = studentFiltered(A); });
  $('#vocab-search')?.addEventListener('input', e => { A.vocabSearch = e.target.value; A.vocabLimit = 0; $('#vocab-table').innerHTML = vocabTable(A); });
  $('#results-search')?.addEventListener('input', e => {
    A.resultsQuery = e.target.value; A.resultsLimit = 30;
    clearTimeout(bindPageForms.resultsTimer);
    bindPageForms.resultsTimer = setTimeout(() => {
      renderKeepScroll();
      const box = $('#results-search'); if (box) { box.focus(); box.setSelectionRange(box.value.length, box.value.length); }
    }, 180);
  });
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
// V13.66 coin wallet: balance, today's study coins (80 a day) and where coins come from and go.
// V13.67 today's attendance stamp.
async function attend(button) {
  if (button) button.disabled = true;
  try {
    const res = await api('/attendance/check', {});
    A.data.rewards ||= {};
    A.data.rewards.attendance = res.attendance;
    if (A.data.rewards.gacha) A.data.rewards.gacha.tickets = res.tickets;
    A.data.stats.points_balance = res.points_balance;
    renderKeepScroll();
    attendanceMoment(res, () => navigate('arcade'));
  } catch (err) { toast(err.message); if (button) button.disabled = false; }
}
function walletModal() {
  const g = A.data.stats, today = Number(g.today_reward_points || 0);
  const close = modal(`<div class="wallet-v1366">
    <div class="wallet-top">${coin()}<div><small>내 코인</small><strong>${num(g.points_balance || 0)}<span>코인</span></strong></div></div>
    <p class="wallet-note"><b>경험치와 코인은 달라요.</b> 경험치는 맞힐수록 쌓여서 레벨·펫 성장·랭킹에 쓰이고, 코인은 모아서 쓰는 돈이에요.</p>
    <div class="wallet-today"><div class="row"><span>오늘 공부로 모은 코인</span><b>${num(today)} / 80</b></div><div class="wallet-bar"><i style="width:${Math.min(100, Math.round(today / 80 * 100))}%"></i></div></div>
    <h3>모으는 법</h3>
    <ul class="wallet-list">
      <li><span>학습 완료 (10·20·30문제)</span><b>+5·12·18</b></li>
      <li><span>100점 (10문제 이상)</span><b>+10</b></li>
      <li><span>추천 학습 · 오늘 첫 학습</span><b>+5·5</b></li>
      <li><span>3일 · 7일 연속 학습</span><b>+8·20</b></li>
      <li><span>매일 출석 체크 (7번째는 코인 뽑기권도)</span><b>+${ATTENDANCE_REWARDS[0]}~${ATTENDANCE_REWARDS.at(-1)}</b></li>
      <li><span>선생님 실전시험 (절반 이상 풀기 · 처음 한 번)</span><b>+${EXAM_COINS}</b></li>
      <li><span>로보 연습 대결 (하루 ${BOT_DAILY}판까지)</span><b>+${BOT_TRY_REWARD.coins}~${BOT_WIN_REWARDS.hard.coins}</b></li>
      <li><span>야차전 승리 · 학원 대회 상금</span><b>판돈 · 상금</b></li>
    </ul>
    <h3>쓰는 곳</h3>
    <div class="wallet-actions"><button type="button" class="btn" id="wallet-egg">랜덤 알 <small>${coin()}${num(EGG_PRICE)}</small></button><button type="button" class="btn" id="wallet-yacha">야차전 판돈 <small>${coin()}10·30·50</small></button><button type="button" class="btn" id="wallet-gacha">코인 뽑기 <small>${coin()}${LUCKY_BETS.join('·')}</small></button></div>
  </div>`, '코인 지갑');
  $('#wallet-gacha').onclick = () => { close(); navigate('arcade'); };
  $('#wallet-egg').onclick = () => { close(); openEggShop(A, petChanged); };
  $('#wallet-yacha').onclick = () => { close(); navigate('yacha'); };
}
function bracketModal(id) {
  const t = (A.data.tournaments || []).find(item => item.id === id) || null;
  return openBracket(id, A.data.profile.id, t);
}
// V13.69 teacher: the bracket on the classroom TV, full screen and refreshing by itself.
function openTournamentTv(id) {
  A.screen = 'bracket-tv';
  window.scrollTo(0, 0);
  openBracketTv(A, id, async () => { A.screen = null; try { await refresh(); } catch {} render(); window.scrollTo(0, 0); });
}
// V13.66 teacher: open an academy tournament for one grade (or class).
const gradeOfClass = value => String(value || '').match(/^(중[1-3]|고[1-3])/)?.[1] || String(value || '');
function tournamentCreateModal() {
  const middle = A.data.profile.active_division === 'middle';
  const targets = middle ? [['중2', '중2'], ['중3', '중3']] : [['고1', '고1 전체'], ['고1A', '고1A'], ['고1B', '고1B']];
  const students = target => A.data.profiles.filter(p => p.active && !p.preview_owner_id && (target === gradeOfClass(target) && target.length === 2 ? gradeOfClass(p.class_name) === target : p.class_name === target)).sort((a, b) => a.display_name.localeCompare(b.display_name, 'ko'));
  const roundName = n => { let size = 2; while (size < n) size *= 2; return size === 2 ? '결승' : `${size}강`; };
  const MAX_PLAYERS = 32;
  // Students already in a running tournament cannot join a second one.
  const busy = new Set((A.data.tournaments || []).filter(t => t.status === 'active').flatMap(t => t.rounds[0].matches.flatMap(m => [m.a?.id, m.b?.id])).filter(Boolean));
  const close = modal(`<h2>야차 대회 만들기</h2><p>${esc(A.school)} · 판돈 없는 1:1 토너먼트예요. 학생들은 홈 화면에서 자기 경기를 시작해요.</p>
    <form id="tn-form" class="tn-form">
      <label class="field"><span>대회 이름</span><input name="name" maxlength="40" placeholder="${esc(A.school)} 야차 대회"></label>
      <div class="form-columns">
        <label class="field"><span>대상</span><select name="class_name" id="tn-target">${targets.map(([value, label]) => `<option value="${value}">${label}</option>`).join('')}</select></label>
        <label class="field"><span>대결 방식</span><select name="mode"><option value="speed">스피드전 (4지선다)</option><option value="skill">실력전 (철자 쓰기 섞임)</option></select></label>
        <label class="field"><span>대진 방식</span><select name="seeding"><option value="random">랜덤 대진</option><option value="league">이번 주 리그 승점순</option></select></label>
        <label class="field"><span>우승 상금 (준우승 절반)</span><select name="prize"><option value="0">없음</option><option value="50">50코인</option><option value="100" selected>100코인</option><option value="200">200코인</option></select></label>
      </div>
      <div class="step-label">참가 학생 <small id="tn-count"></small></div>
      <div class="tn-pick-tools"><button type="button" class="text-button" data-tn-all="1">전체 선택</button><button type="button" class="text-button" data-tn-all="0">전체 해제</button></div>
      <div class="tn-pick" id="tn-players"></div>
      <div class="step-label">대결 단어 범위</div>
      <div class="teacher-range" id="tn-ranges"></div>
      <div id="tn-error" class="form-error" role="alert"></div>
      <button class="btn primary full" type="submit">대회 시작하기</button>
    </form>`, '야차 대회 만들기');
  const form = $('#tn-form');
  const count = () => {
    const n = $$('input[name="student"]:checked', form).length;
    $('#tn-count').textContent = n > MAX_PLAYERS ? `${n}명 · 한 대회는 ${MAX_PLAYERS}명까지예요` : n >= 2 ? `${n}명 · ${roundName(n)}부터` : `${n}명 · 2명 이상 골라주세요`;
    $('#tn-count').classList.toggle('warn', n > MAX_PLAYERS || n < 2);
  };
  const fill = () => {
    const target = $('#tn-target').value;
    const list = students(target);
    const open = p => Array.isArray(p.pets) && p.pets.length > 0 && !busy.has(p.id);
    const tick = list.filter(open).length <= MAX_PLAYERS;
    $('#tn-players').innerHTML = list.length ? list.map(p => { const ok = open(p); const why = busy.has(p.id) ? '다른 대회 참가 중' : !ok ? '아직 펫을 고르지 않았어요' : `Lv.${p.stats?.level || 1}`; return `<label class="tn-pick-item ${ok ? '' : 'off'}"><input type="checkbox" name="student" value="${esc(p.id)}" ${ok ? (tick ? 'checked' : '') : 'disabled'}><span><b>${esc(p.display_name)}</b><small>${esc(p.class_name)} · ${why}</small></span></label>`; }).join('') : '<p class="tiny muted">이 대상의 활성 학생이 없어요.</p>';
    const info = getRanges(A, A.school, middle ? target : null);
    $('#tn-ranges').innerHTML = info.codes.map((code, index) => `<label class="range-option"><input type="checkbox" name="range" value="${esc(code)}" ${index < 2 ? 'checked' : ''}><span>${esc(middle ? `${code}과` : rangeLabel(A.school, code))}<small>${info.words.filter(word => word.range_code === code).length}개 단어</small></span></label>`).join('') || '<p class="tiny muted">단어 범위가 없어요.</p>';
    count();
  };
  $('#tn-target').onchange = fill;
  form.addEventListener('change', event => { if (event.target.name === 'student') count(); });
  $$('[data-tn-all]', form).forEach(button => button.onclick = () => { $$('input[name="student"]:not(:disabled)', form).forEach(input => { input.checked = button.dataset.tnAll === '1'; }); count(); });
  fill();
  form.onsubmit = async event => {
    event.preventDefault();
    const button = $('[type="submit"]', form), values = Object.fromEntries(new FormData(form));
    const ids = $$('input[name="student"]:checked', form).map(input => input.value);
    const ranges = $$('input[name="range"]:checked', form).map(input => input.value);
    if (ids.length < 2) return $('#tn-error').textContent = '참가 학생을 2명 이상 골라주세요.';
    if (ids.length > MAX_PLAYERS) return $('#tn-error').textContent = `한 대회에는 ${MAX_PLAYERS}명까지 참가할 수 있어요.`;
    if (!ranges.length) return $('#tn-error').textContent = '단어 범위를 하나 이상 골라주세요.';
    buttonBusy(button); $('#tn-error').textContent = '';
    try {
      await api('/teacher/tournaments', { name: values.name, class_name: values.class_name, seeding: values.seeding, mode: values.mode, prize: Number(values.prize), student_ids: ids, range_codes: ranges });
      close(); await refresh(); A.tab = 'tournaments'; render(); toast('대회를 열었어요! 학생 홈 화면에 첫 경기가 떠요.');
    } catch (err) { $('#tn-error').textContent = err.message; buttonBusy(button, false); }
  };
}
async function decideTournamentMatch(tid, matchId, winnerId, name, button) {
  if (!confirm(`${name} 학생을 이 경기의 승자로 정할까요?\n결석·기권처럼 경기를 할 수 없을 때 써요. 되돌릴 수 없어요.`)) return;
  buttonBusy(button);
  try { await api(`/teacher/tournaments/${encodeURIComponent(tid)}/winner`, { match_id: matchId, winner_id: winnerId }); await refresh(); renderKeepScroll(); toast(`${name} 학생이 다음 라운드로 올라갔어요.`); }
  catch (err) { toast(err.message); buttonBusy(button, false); }
}
async function cancelTournament(id, button) {
  if (!confirm('이 대회를 취소할까요? 진행 중인 기록은 남지만 더 이상 경기를 할 수 없어요.')) return;
  buttonBusy(button);
  try { await api(`/teacher/tournaments/${encodeURIComponent(id)}/cancel`, {}); await refresh(); renderKeepScroll(); toast('대회를 취소했어요.'); }
  catch (err) { toast(err.message); buttonBusy(button, false); }
}
loginView();
try {
  // Ask for the data directly: a 401 means "not logged in", so a separate
  // /session round trip (~0.7 s from Korea) is not needed first.
  await refresh();
  preferences();
  A.tab = A.data.profile.role === 'teacher' ? 'dashboard' : A.data.profile.avatar_key ? 'home' : 'studio';
  render();
  startPolling();
  if (A.data.profile.role === 'student' && A.data.active_practice) await resumeActivePractice();
} catch (e) {
  if (e.status !== 401) {
    $('#login-error').textContent = '서버 응답이 느립니다. 잠시 후 다시 로그인해주세요.';
  }
}
