import { EXAM_TYPES, PRACTICE_TYPES, CLASS_OPTIONS, dayKey } from './core.js';
import { icon, esc, num, date, recordRangeLabel, scope, empty, $, $$ } from './ui.js';
import { avatar } from './character.js';
import { rangePicker, selectedCount, getRanges, periodGroups } from './student.js';
import { bracketHtml } from './tournament-ui.js';
import { coin, trophy } from './emblems.js';
import { teacherPetDex } from './petbook.js';
// V13.76 실전시험: how often the student left the test screen (the third time hands it in).
function leaveNote(s) {
  const n = Number(s.leave_count || 0);
  if (!n) return '';
  const sec = Math.round(Number(s.leave_ms || 0) / 1000);
  return `📵 화면 이탈 ${n}번${sec ? ` · ${sec >= 60 ? `${Math.floor(sec / 60)}분 ${sec % 60}초` : `${sec}초`}` : ''}${s.left_out ? ' · 자동 제출' : ''}`;
}
// V13.123 실전시험 결과는 학생이 보내지 않아도 선생님께 보여요. 끝난 시간 기준 최신순.
const testEndedAt = s => Number(s.ended_at || s.created_at || 0);
export function finishedSelfTests(sessions) {
  return (sessions || []).filter(item => item.run_mode === 'test').sort((a, b) => testEndedAt(b) - testEndedAt(a));
}
const passNote = s => Number(s.pass_count || 0) ? `PASS ${Number(s.pass_count)}번` : '';
// Grammar datasets are ~170KB; load only the active school's file, on demand,
// so students (who also import this module) never download them up front.
const GRAMMAR_LOADERS = {
  '단원고': () => Promise.all([import('../danwongo-textbook-grammar-data.js'), import('../danwongo-grammar-data.js')])
    .then(([textbook, mock]) => [...(textbook.DANWONGO_TEXTBOOK_PASSAGES || []), ...(mock.DANWONGO_PASSAGES || [])]),
  '선부고': () => import('../seonbu-grammar-data.js').then(mod => [...(mod.SEONBU_2026_PASSAGES || []), ...(mod.SEONBU_2025_PASSAGES || [])]),
  // 강서고 shares 단원고's textbook (YBM Kim), so its textbook passages come first.
  '강서고': () => Promise.all([import('../danwongo-textbook-grammar-data.js'), import('../gangseo-grammar-data.js')])
    .then(([textbook, mod]) => [...(textbook.DANWONGO_TEXTBOOK_PASSAGES || []), ...(mod.GANGSEO_PASSAGES || [])])
};
// Mock-exam passages are numbered ("24" -> "24번"); textbook ones already read "1과 · 본문 1".
const passageNumberLabel = passage => /과/.test(String(passage.number)) ? String(passage.number) : `${passage.number}번`;
const grammarCache = new Map();
let grammarLoaded = null;
export function onTeacherGrammarLoaded(callback) { grammarLoaded = callback; }
const tabs = [['dashboard', '대시보드', 'home'], ['students', '학생 관리', 'user'], ['books', '단어 데이터', 'practice'], ['disputes', '뜻 이의제기', 'records'], ['results', '결과 분석', 'ranking'], ['tournaments', '야차 대회', 'battle'], ['petdex', '펫 도감', 'sparkle']];
const ALL_CLASSES = '__ALL__';
const targetLabel = value => value === ALL_CLASSES ? '학교 전체' : value;
const targetMatches = (target, profile) => target === ALL_CLASSES || profile.class_name === target;
const examRangeGrade = value => value === ALL_CLASSES ? null : value;
const targetCount = (A, value) => A.data.profiles.filter(p => p.active && targetMatches(value, p)).length;
export function teacherPage(A) {
  const title = tabs.find(t => t[0] === A.tab)?.[1] || '대시보드';
  const pendingDisputes = (A.data.meaning_disputes || []).filter(item => item.status === 'pending').length;
  const actions = A.tab === 'students' ? `<button class="btn primary" data-action="add-student">${icon('plus')} 학생 등록</button>` : A.tab === 'results' ? `<button class="btn secondary" data-action="export-results">${icon('download')} 결과 내보내기</button>` : A.tab === 'tournaments' ? `<button class="btn primary" data-action="tournament-new">${icon('plus')} 대회 만들기</button>` : A.tab === 'dashboard' || !A.tab ? `<button class="btn secondary notice-top-v1377" data-action="notice">📢 공지 보내기</button><button class="btn secondary install-qr-v1377" data-action="install-qr" title="교실 TV에 띄우면 학생들이 찍어서 앱을 설치해요">📲 앱 설치 QR</button><button class="btn secondary tv2-gift-top-v1375" data-action="gift">${icon('gift')} 코인 선물</button>` : '';
  const content = ({ dashboard, students, books, disputes, results, tournaments, petdex: teacherPetDex }[A.tab] || dashboard)(A);
  const divisionOptions = [['middle','중등부'],['high','고등부']].filter(([id]) => (A.data.divisions || []).includes(id)).map(([id,label]) => `<option value="${id}" ${id === A.data.profile.active_division ? 'selected' : ''}>${label}</option>`).join('');
  const schoolOptions = A.data.schools.map(s => `<option value="${esc(s.id)}" ${s.id === A.data.profile.active_school_id ? 'selected' : ''}>${esc(s.name)}</option>`).join('');
  const division = A.data.profile.active_division;
  const navButtons = cls => tabs.map(([id, label, i]) => `<button data-go="${id}" class="${cls} ${A.tab === id || (A.tab === 'exam-create' && id === 'exams') ? 'active' : ''}" ${A.tab === id ? 'aria-current="page"' : ''}>${icon(i)}<span>${label}</span>${id === 'disputes' && pendingDisputes ? `<em class="nav-count">${pendingDisputes}</em>` : ''}</button>`).join('');
  const today = new Date().toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short', timeZone: 'Asia/Seoul' });
  // V13.64: one clean header (title + actions), a separate context bar (division · school ·
  // student preview) that never wraps into broken words, and a bottom tab bar on phones.
  return `<div class="teacher-app tv2"><aside class="sidebar"><div class="brand"><img src="/sumus-logo-green.svg" alt=""><div>SUMUS <span>VOCA</span></div></div><div class="workspace-label">선생님 워크스페이스</div><nav aria-label="교사 메뉴">${navButtons('')}</nav><footer><b>${esc(A.data.profile.display_name)}</b><small>SUMUS ENGLISH ACADEMY</small><br><button class="text-button" data-action="account">${icon('user')} 내 계정</button><button class="text-button" data-action="logout">${icon('logout')} 로그아웃</button></footer></aside>
    <main class="teacher-main">
      <header class="tv2-top">
        <div class="tv2-title"><div class="eyebrow">${esc(A.data.profile.active_school)} · ${division === 'middle' ? '중등부' : '고등부'}</div><h1>${title}</h1></div>
        <div class="tv2-top-actions"><span class="tv2-date">${today}</span><button class="icon-button" data-action="refresh" aria-label="새로고침" title="새로고침">${icon('refresh')}</button>${actions}<button class="icon-button tv2-mobile-only" data-action="account" aria-label="내 계정">${icon('user')}</button><button class="icon-button tv2-mobile-only" data-action="logout" aria-label="로그아웃">${icon('logout')}</button></div>
      </header>
      <div class="tv2-context" role="group" aria-label="관리 대상">
        <div class="teacher-division-switch" role="group" aria-label="중등부 고등부 변경"><button data-teacher-division="middle" class="${division === 'middle' ? 'selected' : ''}">중등</button><button data-teacher-division="high" class="${division === 'high' ? 'selected' : ''}">고등</button></div>
        <label class="tv2-select"><span>학교</span><select id="teacher-school" aria-label="관리 학교 변경">${schoolOptions}</select></label>
        <span class="tv2-context-gap" aria-hidden="true"></span>
        <label class="tv2-select"><span>학생 화면</span><select id="preview-grade" aria-label="학생 미리보기 학년/반">${division === 'middle' ? '<option value="중2">중2</option><option value="중3">중3</option>' : '<option value="고1A">고1A</option><option value="고1B">고1B</option>'}</select></label>
        <button class="btn secondary tv2-preview" data-action="student-preview">${icon('user')}<span>미리보기</span></button>
      </div>
      ${content}
    </main>
    <nav class="tv2-bottom-nav" aria-label="교사 메뉴">${navButtons('tv2-tab')}</nav>
  </div>`;
}
function metrics(items) { return `<div class="teacher-metrics">${items.map(([name, value, unit]) => `<div><span>${name}</span><strong>${num(value)}<small>${unit || ''}</small></strong></div>`).join('')}</div>`; }
function grammarPassagesForSchool(school) {
  if (grammarCache.has(school)) return grammarCache.get(school);
  const load = GRAMMAR_LOADERS[school];
  if (!load) return [];
  grammarCache.set(school, []);
  load()
    .then(passages => { grammarCache.set(school, passages); grammarLoaded?.(); })
    .catch(() => grammarCache.delete(school));
  return [];
}
function grammarPassageMap(school) {
  return new Map(grammarPassagesForSchool(school).map(passage => [passage.id, passage]));
}
function todayStudentIds(d) {
  const key = dayKey(Date.now());
  const ids = new Set(d.sessions.filter(s => dayKey(s.created_at) === key).map(s => s.student_id));
  d.attempts.filter(a => dayKey(a.submitted_at || a.started_at || 0) === key).forEach(a => ids.add(a.student_id));
  Object.entries(d.grammar_progress || {}).forEach(([studentId, progress]) => {
    if (Object.values(progress || {}).some(item => dayKey(item.updated_at || 0) === key)) ids.add(studentId);
  });
  return ids;
}
function grammarSummary(d, school) {
  const passages = grammarPassagesForSchool(school);
  const allowed = new Set(passages.map(p => p.id));
  const activeStudents = d.profiles.filter(p => p.active);
  let mastered = 0, touched = 0;
  const studentRows = activeStudents.map(student => {
    const items = Object.values(d.grammar_progress?.[student.id] || {}).filter(item => allowed.has(item.passage_id));
    const masters = items.filter(item => item.mastered).length;
    mastered += masters;
    touched += items.length;
    return { student, masters, touched: items.length, total: passages.length, recent: Math.max(0, ...items.map(item => Number(item.updated_at || 0))) };
  });
  const denominator = activeStudents.length * Math.max(1, passages.length);
  return { passages, studentRows, mastered, touched, percent: denominator ? Math.round(mastered / denominator * 100) : 0 };
}
function grammarWeakness(d, school) {
  const map = grammarPassageMap(school);
  const passageCounts = new Map();
  const choiceCounts = new Map();
  Object.values(d.grammar_progress || {}).forEach(progress => {
    Object.values(progress || {}).forEach(item => {
      const passage = map.get(item.passage_id);
      if (!passage) return;
      for (const key of item.wrong_keys || []) {
        const [sentenceIndex, partIndex] = key.split(':').map(Number);
        const part = passage.sentences?.[sentenceIndex]?.parts?.[partIndex];
        if (!part || part[0] !== 'c') continue;
        passageCounts.set(passage.id, (passageCounts.get(passage.id) || 0) + 1);
        const choiceKey = passage.id + ':' + key;
        const prior = choiceCounts.get(choiceKey) || { passage, answer: part[2], type: part[3] || '선택 포인트', count: 0 };
        prior.count++;
        choiceCounts.set(choiceKey, prior);
      }
    });
  });
  return {
    passages: [...passageCounts.entries()].map(([id, count]) => ({ passage: map.get(id), count })).sort((a, b) => b.count - a.count),
    choices: [...choiceCounts.values()].sort((a, b) => b.count - a.count)
  };
}
function activeExamStatus(d) {
  const now = Date.now();
  return d.exams.filter(e => e.active && e.available_at <= now && e.due_at > now).map(exam => {
    const targets = d.profiles.filter(p => p.active && targetMatches(exam.class_name, p));
    const examAttempts = d.attempts.filter(a => a.exam_id === exam.id);
    const submittedIds = new Set(examAttempts.filter(a => a.status === 'submitted').map(a => a.student_id));
    const activeIds = new Set(examAttempts.filter(a => a.status === 'active').map(a => a.student_id));
    const submitted = targets.filter(student => submittedIds.has(student.id));
    const active = targets.filter(student => !submittedIds.has(student.id) && activeIds.has(student.id));
    const missing = targets.filter(student => !submittedIds.has(student.id) && !activeIds.has(student.id));
    return { exam, targets, submitted, active, missing };
  });
}
// V13.74 반 대항전 (this week's 경험치 of each class). The V13.74 선생님 알림판 is part of
// 챙겨야 할 학생 since V13.75.
function classLeaguePanel(league) {
  if (!league) return '';
  const max = Math.max(1, ...league.classes.map(c => c.xp));
  return `<section class="panel cl-panel-v1374">
    <div class="panel-head"><div><h2>반 대항전</h2><span>이번 주 반별 경험치 합계 · 일요일 밤 마감</span></div></div>
    <div class="cl-bars">${league.classes.length ? league.classes.map((c, i) => `<div class="cl-bar ${i === 0 && c.xp ? 'lead' : ''}"><b>${i + 1}</b><span class="cl-name">${esc(c.name)}</span><span class="cl-track"><i style="width:${Math.max(3, Math.round(c.xp / max * 100))}%"></i></span><strong>${num(c.xp)}</strong><small>${num(c.active)}/${num(c.students)}명</small></div>`).join('') : '<div class="v136-empty-line">반에 배정된 학생이 없어요.</div>'}</div>
    <div class="cl-actions"><button type="button" class="btn" data-action="class-tv">${icon('tv')} TV로 크게 보기</button><button type="button" class="btn" data-action="class-tv-link">TV 링크</button></div>
  </section>`;
}
// V13.75 teacher overview helpers: when each student last did anything, this week's work.
const DAY = 86400000;
function weekStart(now = Date.now()) {
  const kst = new Date(now + 9 * 3600000), back = (kst.getUTCDay() + 6) % 7;
  return Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate() - back) - 9 * 3600000;
}
function lastActivityMap(d) {
  const last = new Map();
  const put = (id, t) => { t = Number(t || 0); if (t > (last.get(id) || 0)) last.set(id, t); };
  for (const s of d.sessions) put(s.student_id, s.created_at);
  for (const a of d.attempts) put(a.student_id, a.submitted_at || a.started_at);
  for (const [id, progress] of Object.entries(d.grammar_progress || {})) for (const item of Object.values(progress || {})) put(id, item.updated_at);
  for (const r of d.idle_students || []) if (r.last) put(r.id, r.last);
  return last;
}
export function agoLabel(t, now = Date.now()) {
  if (!t) return '기록 없음';
  const diff = now - t;
  if (dayKey(t) === dayKey(now)) return diff < 3600000 ? `${Math.max(1, Math.floor(diff / 60000))}분 전` : `${Math.floor(diff / 3600000)}시간 전`;
  const days = Math.max(1, Math.round((new Date(dayKey(now)) - new Date(dayKey(t))) / DAY));
  return days < 14 ? `${days}일 전` : date(t);
}
function weekWork(d, now = Date.now()) {
  const start = weekStart(now), prev = start - 7 * DAY, rows = new Map();
  const row = id => rows.get(id) || rows.set(id, { count: 0, total: 0, scores: 0, prevTotal: 0 }).get(id);
  for (const s of d.sessions) {
    const t = Number(s.created_at || 0);
    if (t >= start) { const r = row(s.student_id); r.count++; r.total += Number(s.total || 0); r.scores += Number(s.score ?? (s.total ? Math.round(s.correct / s.total * 100) : 0)); }
    else if (t >= prev) row(s.student_id).prevTotal += Number(s.total || 0);
  }
  return rows;
}
// Students to look after: not studied today, not seen this week, quiet for 3+ days.
function careGroups(d) {
  const active = d.profiles.filter(p => p.active && !p.preview_owner_id);
  const today = todayStudentIds(d), last = lastActivityMap(d), start = weekStart();
  const byName = (a, b) => a.display_name.localeCompare(b.display_name, 'ko');
  const idle = new Map((d.idle_students || []).map(r => [r.id, r]));
  const todayMissing = active.filter(p => !today.has(p.id)).sort((a, b) => (last.get(b.id) || 0) - (last.get(a.id) || 0) || byName(a, b));
  const week = active.filter(p => idle.get(p.id)?.week ?? (last.get(p.id) || 0) < start).sort((a, b) => (last.get(a.id) || 0) - (last.get(b.id) || 0) || byName(a, b));
  const quiet = active.filter(p => { const t = last.get(p.id) || 0; return t >= start && Date.now() - t >= 3 * DAY; }).sort((a, b) => (last.get(a.id) || 0) - (last.get(b.id) || 0));
  return { active, today, last, groups: { today: todayMissing, week, quiet } };
}
// The student ids of one 챙겨야 할 학생 tab (for the 응원 코인 button).
export const careIds = (A, tab) => (careGroups(A.data).groups[tab] || []).map(p => p.id);
const CARE_TABS = [['today', '오늘 안 함'], ['week', '이번 주 미접속'], ['quiet', '3일 이상 쉼']];
function carePanel(A, care) {
  const tab = CARE_TABS.some(([k]) => k === A.careTab) ? A.careTab : 'today';
  const list = care.groups[tab], shown = A.careAll ? list : list.slice(0, 12);
  const empty = { today: '✓ 활성 학생 모두 오늘 학습했어요.', week: '✓ 이번 주 모든 학생이 한 번 이상 들어왔어요.', quiet: '✓ 3일 넘게 쉰 학생이 없어요.' }[tab];
  return `<section class="panel care-v1375" id="care-panel">
    <div class="panel-head"><div><h2>챙겨야 할 학생</h2><span>오늘 확인 필요 · 이름을 누르면 학생 기록이 열려요</span></div>${list.length ? `<button type="button" class="btn small" data-action="gift-care" data-care="${tab}">${icon('gift')} ${list.length}명에게 응원 코인</button>` : ''}</div>
    <div class="care-tabs" role="tablist">${CARE_TABS.map(([k, label]) => `<button type="button" role="tab" aria-selected="${k === tab}" class="${k === tab ? 'on' : ''}" data-care-tab="${k}">${label}<b>${care.groups[k].length}</b></button>`).join('')}</div>
    <div class="care-list">${shown.length ? shown.map(p => `<div class="care-row"><button type="button" class="care-who" data-student="${p.id}">${avatar(p.avatar_key, { size: 'mini' })}<span><b>${esc(p.display_name)}</b><small>${esc(p.class_name || '')}</small></span></button><span class="care-when ${Date.now() - (care.last.get(p.id) || 0) >= 3 * DAY ? 'late' : ''}">${agoLabel(care.last.get(p.id))}</span><button type="button" class="care-gift" data-gift-to="${p.id}" aria-label="${esc(p.display_name)}에게 코인 선물">${icon('gift')}</button></div>`).join('') : `<div class="v136-clear">${empty}</div>`}</div>
    ${list.length > 12 ? `<button type="button" class="text-button v136-more" data-care-all>${A.careAll ? '접기' : `${list.length - 12}명 더 보기`} ${icon('chevron')}</button>` : ''}
  </section>`;
}
function kpiCards(A, care) {
  const d = A.data, active = care.active.length, done = active - care.groups.today.length;
  const pct = active ? Math.round(done / active * 100) : 0;
  const pending = (d.meaning_disputes || []).filter(item => item.status === 'pending').length;
  const matches = (d.tournaments || []).filter(t => t.status === 'active').flatMap(t => t.rounds.flatMap(r => r.matches)).filter(m => !m.winner && m.a && m.b).length;
  const todayKey = dayKey(Date.now());
  const questions = d.sessions.filter(s => dayKey(s.created_at) === todayKey).reduce((n, s) => n + Number(s.total || 0), 0);
  return `<section class="tv2-today kpi-v1375" aria-label="오늘 현황">
    <button type="button" class="kpi" data-care-tab="today"><span class="kpi-ring" style="--p:${pct}"><b>${pct}%</b></span><span><small>오늘 학습</small><strong>${num(done)}<em>/${num(active)}명</em></strong><i>오늘 푼 문제 ${num(questions)}</i></span></button>
    <button type="button" class="kpi ${care.groups.week.length ? 'warn' : 'ok'}" data-care-tab="week"><span class="kpi-ico">${icon('user')}</span><span><small>이번 주 미접속</small><strong>${num(care.groups.week.length)}<em>명</em></strong><i>${care.groups.quiet.length ? `3일 이상 쉼 ${care.groups.quiet.length}명` : '월요일부터 기준'}</i></span></button>
    <button type="button" class="kpi ${pending ? 'warn' : 'ok'}" data-go="disputes"><span class="kpi-ico">${icon('records')}</span><span><small>뜻 이의제기</small><strong>${num(pending)}<em>건</em></strong><i>${pending ? '검토가 필요해요' : '대기 없음'}</i></span></button>
    <button type="button" class="kpi" data-go="tournaments"><span class="kpi-ico">${icon('battle')}</span><span><small>야차 대회</small><strong>${num(matches)}<em>경기</em></strong><i>${matches ? '아직 안 한 경기' : '진행 중인 경기 없음'}</i></span></button>
  </section>`;
}
function examPanel(d) {
  const rows = activeExamStatus(d);
  if (!rows.length) return '';
  return `<section class="panel exam-now-v1375"><div class="panel-head"><div><h2>진행 중인 실전시험</h2><span>마감 전 시험의 제출 현황</span></div></div>${rows.slice(0, 4).map(r => `<div class="exam-now-row"><b>${esc(r.exam.title)}</b><span class="exam-submit-state"><span class="done">완료 ${r.submitted.length}</span><span class="doing">응시 ${r.active.length}</span><span class="wait">미응시 ${r.missing.length}</span></span><small>${date(r.exam.due_at)} 마감</small></div>`).join('')}</section>`;
}
function dashboard(A) {
  const d = A.data;
  const care = careGroups(d);
  const grammar = grammarSummary(d, A.school);
  const weak = grammarWeakness(d, A.school);
  const activeStudents = care.active;
  const selfTests = finishedSelfTests(d.sessions);
  const grammarAttention = [...grammar.studentRows].sort((a, b) => a.masters - b.masters || a.touched - b.touched).slice(0, 6);
  const grammarUsed = grammar.touched > 0 || weak.choices.length > 0;
  // V13.75: the four numbers that need the teacher, one list of students to look after, the
  // class race, then what students sent. Grammar analysis folds away until there is data.
  return `
    ${kpiCards(A, care)}
    <div class="dash-grid-v1375">
      ${carePanel(A, care)}
      <div class="dash-side-v1375">${classLeaguePanel(d.class_league)}${examPanel(d)}</div>
    </div>
    ${selfTests.length ? `<section class="panel">
      <div class="panel-head"><div><h2>실전시험 결과</h2><span>학생이 끝낸 실전시험 · 최근 끝난 순서</span></div><button class="text-button" data-go="results" data-results-view="sent">전체 결과</button></div>
      <div class="v136-exam-list">${selfTests.slice(0,6).map(item => {
        const student = d.profiles.find(profile => profile.id === item.student_id);
        const ranges = (item.range_codes || []).map(code => recordRangeLabel(item, code)).join(' · ') || '선택 범위';
        return `<div class="v136-exam-item"><div class="v136-exam-top"><span class="square-icon">${icon('exam')}</span><div class="grow"><h3>${esc(student?.display_name || '학생')} · ${item.score ?? 0}점</h3><p>${esc(student?.class_name || item.grade || '')} · ${esc(ranges)} · ${esc(PRACTICE_TYPES[item.mode] || '쓰기')}</p></div><button class="text-button" data-practice-record="${item.id}">답안 보기</button></div><div class="v136-missing-names"><span>${date(testEndedAt(item))} 끝남</span><span>정답 ${item.correct ?? 0} / ${item.total ?? 0}</span>${passNote(item) ? `<span>${passNote(item)}</span>` : ''}${item.auto_submitted && !item.left_out ? '<span>시간 종료 자동 제출</span>' : ''}${leaveNote(item) ? `<span class="leave-note-v1376">${leaveNote(item)}</span>` : ''}</div></div>`;
      }).join('')}</div>
    </section>` : ''}
    <details class="panel grammar-fold-v1375" ${A.grammarOpen ?? grammarUsed ? 'open' : ''}>
      <summary><span><b>어법·어휘 분석</b><small>${grammarUsed ? `MASTER ${grammar.percent}% · 오답 ${weak.choices.reduce((n, item) => n + item.count, 0)}건` : '학생들이 어법·어휘를 공부하면 여기에 쌓여요'}</small></span>${icon('chevron')}</summary>
      <div class="v136-dashboard-grid">
        <section class="v136-grammar">
          <div class="panel-head"><div><h2>어법·어휘 MASTER</h2><span>${esc(A.school)} 시험범위 · ${grammar.passages.length}지문 기준</span></div><span class="v136-count">${grammar.percent}%</span></div>
          <div class="v136-master-bar"><i style="width:${grammar.percent}%"></i></div>
          <div class="v136-master-summary"><b>${grammar.mastered}</b><span>/ ${activeStudents.length * grammar.passages.length} 학생·지문 MASTER</span></div>
          <div class="v136-mini-list">${grammarAttention.length ? grammarAttention.map(row => `
            <button data-student="${row.student.id}"><span><b>${esc(row.student.display_name)}</b><small>${esc(row.student.class_name)} · 학습 ${row.touched}/${row.total}</small></span><strong>${row.masters}/${row.total}</strong></button>
          `).join('') : '<div class="v136-empty-line">등록된 활성 학생이 없어요.</div>'}</div>
        </section>
        <section>
          <div class="panel-head"><div><h2>많이 틀린 어법 포인트</h2><span>현재 저장된 1차 오답 기준</span></div><span class="v136-count warn">${weak.choices.reduce((n, item) => n + item.count, 0)}건</span></div>
          <div class="v136-weak-list">${weak.choices.length ? weak.choices.slice(0, 5).map((item, index) => `
            <div><span class="v136-rank">${index + 1}</span><div class="grow"><b>${esc(passageNumberLabel(item.passage))} · 정답 ${esc(item.answer)}</b><small>${esc(item.type)} · ${esc(item.passage.subtitle || item.passage.title)}</small></div><strong>${item.count}명</strong></div>
          `).join('') : '<div class="v136-empty-line">아직 누적된 어법·어휘 오답이 없어요.</div>'}</div>
        </section>
      </div>
      <div class="panel-head"><div><h2>취약 지문 TOP</h2><span>학생들의 1차 오답이 많이 쌓인 지문</span></div></div>
      <div class="v136-passage-grid">${weak.passages.length ? weak.passages.slice(0, 6).map((item, index) => `
        <div><span>${index + 1}</span><strong>${esc(passageNumberLabel(item.passage))}</strong><small>${esc(item.passage.subtitle || item.passage.title)}</small><b>${item.count}건 오답</b></div>
      `).join('') : '<div class="v136-empty-line">어법·어휘 학습 데이터가 쌓이면 지문별 취약도가 표시됩니다.</div>'}</div>
    </details>
    <button type="button" class="dash-students-link-v1375" data-go="students">${icon('user')} 전체 학생 ${num(d.profiles.length)}명 · 정렬과 필터는 학생 관리에서 ${icon('chevron')}</button>
  `;
}
// V13.75 학생 관리: quick filters, sortable columns, one compact row per student.
const QUICK = [['', '전체'], ['today', '오늘 안 함'], ['week', '이번 주 미접속'], ['low', '정답률 60% 미만'], ['off', '일시 중지']];
const SORTS = { name: '이름', recent: '최근 활동', today: '오늘', week: '이번 주', accuracy: '정답률', weak: '취약 단어' };
export function studentFiltered(A) {
  const d = A.data, q = (A.search || '').toLowerCase();
  const care = careGroups(d), work = weekWork(d);
  const sets = { today: new Set(care.groups.today.map(p => p.id)), week: new Set(care.groups.week.map(p => p.id)) };
  const quick = QUICK.some(([k]) => k === A.studentQuick) ? A.studentQuick : '';
  const pass = p => (!A.classFilter || p.class_name === A.classFilter) && `${p.display_name} ${p.username}`.toLowerCase().includes(q) && (
    !quick ? true : quick === 'off' ? !p.active : quick === 'low' ? p.active && p.stats.practice_count > 0 && p.stats.accuracy < 60 : sets[quick].has(p.id));
  const count = key => d.profiles.filter(p => (!A.classFilter || p.class_name === A.classFilter) && (key === 'off' ? !p.active : key === 'low' ? p.active && p.stats.practice_count > 0 && p.stats.accuracy < 60 : key ? sets[key].has(p.id) : true)).length;
  const sort = SORTS[A.studentSort] ? A.studentSort : 'recent', dir = A.studentSortDir === 'asc' ? 1 : -1;
  const value = p => ({ name: p.display_name, recent: care.last.get(p.id) || 0, today: p.stats.today_total || 0, week: work.get(p.id)?.total || 0, accuracy: p.stats.accuracy || 0, weak: p.stats.weak || 0 }[sort]);
  const list = d.profiles.filter(pass).sort((a, b) => { const x = value(a), y = value(b); return (typeof x === 'string' ? x.localeCompare(y, 'ko') * -dir : (x - y) * dir) || a.display_name.localeCompare(b.display_name, 'ko'); });
  const th = (key, label) => `<th${key === 'accuracy' ? ' class="num"' : ''}><button type="button" data-student-sort="${key}" class="${sort === key ? 'on' : ''}" aria-label="${label}로 정렬">${label}${sort === key ? (dir > 0 ? ' ↓' : ' ↑') : ''}</button></th>`;
  const chips = `<div class="st-quick-v1375" role="group" aria-label="빠른 필터">${QUICK.map(([k, label]) => `<button type="button" data-student-quick="${k}" class="${quick === k ? 'on' : ''}">${label}<b>${count(k)}</b></button>`).join('')}</div>`;
  if (!d.profiles.length) return chips + empty('user', '등록된 학생이 없어요', '학생 등록으로 첫 계정을 만들어주세요.');
  if (!list.length) return chips + empty('user', '조건에 맞는 학생이 없어요', '다른 필터를 골라 보세요.');
  return `${chips}<div class="table-scroll"><table class="student-ops-table st-table-v1375"><thead><tr>${th('name', '학생')}<th>반</th>${th('recent', '최근 활동')}${th('today', '오늘')}${th('week', '이번 주')}${th('accuracy', '정답률')}${th('weak', '취약 단어')}<th></th></tr></thead><tbody>${list.map(p => {
    const w = work.get(p.id), t = care.last.get(p.id) || 0, late = p.active && Date.now() - t >= 3 * DAY;
    return `<tr class="${p.active ? '' : 'off'}"><td class="tv2-cell-name"><button class="table-name" data-student="${p.id}">${avatar(p.avatar_key, { size: 'mini' })}<div><strong>${esc(p.display_name)}</strong><small>Lv.${p.stats.level} · ${esc(p.username)}${p.active ? '' : ' · 일시 중지'}</small></div></button></td><td data-label="반">${esc(p.class_name)}</td><td data-label="최근 활동"><span class="st-when ${late ? 'late' : ''}">${agoLabel(t)}</span></td><td data-label="오늘"><strong>${num(p.stats.today_total)}</strong><small>문제</small></td><td data-label="이번 주"><strong>${num(w?.total || 0)}</strong><small>문제 · ${num(w?.count || 0)}회</small></td><td data-label="정답률" class="num"><div class="stat-bar"><div class="progress"><i style="width:${p.stats.accuracy}%"></i></div><span class="${p.stats.practice_count && p.stats.accuracy < 60 ? 'lo' : ''}">${p.stats.practice_count ? `${p.stats.accuracy}%` : '-'}</span></div></td><td data-label="취약 단어">${num(p.stats.weak)}개</td><td class="st-act"><button type="button" class="icon-button st-gift" data-gift-to="${p.id}" aria-label="${esc(p.display_name)}에게 코인 선물" title="코인 선물">${icon('gift')}</button></td></tr>`;
  }).join('')}</tbody></table></div><p class="st-count-v1375">${num(list.length)}명 표시 · 이름을 누르면 기록과 계정 관리가 열려요</p>`;
}
function students(A) {
  return `<div class="toolbar st-toolbar-v1375"><div class="search">${icon('search')}<input id="student-search" aria-label="학생 검색" placeholder="이름 또는 아이디 검색" value="${esc(A.search || '')}"></div><select id="class-filter" aria-label="반 필터"><option value="">전체 반</option>${[...new Set(A.data.profiles.map(p => p.class_name))].map(c => `<option ${c === A.classFilter ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select><button type="button" class="btn secondary gift-btn-v1373" data-action="gift">${icon('gift')} 코인 선물</button></div><section class="panel st-panel-v1375" id="student-table">${studentFiltered(A)}</section>`;
}
const aliasSourceLabel = source => source === 'appeal' ? '학생 이의제기' : source === 'teacher' ? '선생님 추가' : '기존 허용답';
export function vocabTable(A) {
  const q = (A.vocabSearch || '').toLowerCase(), { words } = getRanges(A);
  const middle = A.data.profile.active_division === 'middle';
  const list = words.filter(w => {
    const searchMatch = `${w.word} ${w.meaning}`.toLowerCase().includes(q);
    const rangeMatch = !A.vocabRange || w.range_code === A.vocabRange;
    const gradeMatch = !middle || !A.vocabGrade || w.grade === A.vocabGrade;
    return searchMatch && rangeMatch && gradeMatch;
  });
  const gradeHead = middle ? '<th>학년</th>' : '';
  // V13.75 one chip per range (with its word count): pick a range instead of scrolling.
  const counts = new Map();
  for (const w of words) if (!middle || !A.vocabGrade || w.grade === A.vocabGrade) counts.set(w.range_code, (counts.get(w.range_code) || 0) + 1);
  // V13.112: a school with both 기말고사 and 중간고사 ranges gets a small label before each group of chips.
  const chip = ([code, n]) => `<button type="button" data-vocab-range="${esc(code)}" class="${A.vocabRange === code ? 'on' : ''}">${esc(recordRangeLabel({ division: middle ? 'middle' : 'high', school: A.school }, code))}<b>${num(n)}</b></button>`;
  const periods = periodGroups(A, [...counts.keys()]);
  const rangeChips = periods[0].period ? periods.map(group => `<span class="vocab-period-tag ${group.period}">${group.label}</span>${group.codes.map(code => chip([code, counts.get(code)])).join('')}`).join('') : [...counts].map(chip).join('');
  const chips = counts.size > 1 ? `<div class="vocab-ranges-v1375" role="group" aria-label="범위 고르기"><button type="button" data-vocab-range="" class="${A.vocabRange ? '' : 'on'}">전체<b>${num([...counts.values()].reduce((n, c) => n + c, 0))}</b></button>${rangeChips}</div>` : '';
  return `${chips}<div class="panel-head"><div><h2>${A.school} 단어장</h2><span>원본 뜻은 유지하고, 기본 유효답과 승인된 허용 뜻의 출처를 따로 관리합니다.</span></div><span>${list.length}개 단어</span></div><div class="table-scroll"><table class="vocab-table"><thead><tr>${gradeHead}<th>범위</th><th>영어</th><th>기본 뜻</th><th>허용 뜻</th><th>관리</th></tr></thead><tbody>${list.slice(0, vocabLimit(A)).map(w => {
    const aliases = A.data.meaning_aliases?.[w.id] || [];
    const meta = A.data.meaning_alias_meta?.[w.id] || [];
    const aliasHtml = aliases.map(alias => {
      const item = meta.find(entry => String(entry.value) === String(alias));
      const source = item?.source || 'legacy';
      return `<span class="meaning-alias source-${source}" title="${esc(aliasSourceLabel(source))}">${esc(alias)}<small>${esc(aliasSourceLabel(source))}</small></span>`;
    }).join('');
    return `<tr>${middle ? `<td><span class="pill">${esc(w.grade || '-')}</span></td>` : ''}<td>${esc(w.range_code)}</td><td><strong>${esc(w.word)}</strong></td><td>${esc(w.meaning)}</td><td><span class="meaning-alias auto">기본 유효답<small>자동</small></span>${aliasHtml}</td><td><button class="text-button" data-meaning-alias="${esc(w.id)}">허용 뜻 관리</button></td></tr>`;
  }).join('')}</tbody></table></div>${list.length > vocabLimit(A) ? `<button class="btn full vocab-more-v1365" data-action="vocab-more">더 보기 (${list.length - vocabLimit(A)}개 남음)</button>` : ''}`;
}
// V13.65: 80 rows first (was 400 at once, which made this tab slow to open on phones);
// "더 보기" adds 200, and search still looks through every word.
const VOCAB_FIRST = 80, VOCAB_STEP = 200;
const vocabLimit = A => A.vocabLimit || VOCAB_FIRST;
export function moreVocab(A) { A.vocabLimit = vocabLimit(A) + VOCAB_STEP; }
function books(A) {
  const middle = A.data.profile.active_division === 'middle';
  const gradeSelect = middle ? `<label class="teacher-school"><span>학년</span><select id="vocab-grade"><option value="">전체</option><option value="중2" ${A.vocabGrade === '중2' ? 'selected' : ''}>중2</option><option value="중3" ${A.vocabGrade === '중3' ? 'selected' : ''}>중3</option></select></label>` : '';
  const importButton = middle ? `<button class="btn primary" data-action="vocab-import">${icon('plus')} 단어 파일 등록</button>` : '';
  return `<div class="toolbar books-toolbar-v1375"><span class="school-chip">${esc(A.school)}</span>${gradeSelect}<div class="search">${icon('search')}<input id="vocab-search" aria-label="단어 검색" placeholder="영어 또는 뜻 검색" value="${esc(A.vocabSearch || '')}"></div>${importButton}</div><section class="panel" id="vocab-table">${vocabTable(A)}</section>`;
}
function disputes(A) {
  const all = A.data.meaning_disputes || [];
  const pending = all.filter(item => item.status === 'pending');
  const groups = new Map();
  for (const item of pending) {
    const key = item.word_id + '|' + item.answer_normalized;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  }
  const cards = [...groups.values()].sort((a, b) => b.length - a.length || b[0].created_at - a[0].created_at).map(items => {
    const first = items[0];
    const students = items.map(item => A.data.profiles.find(p => p.id === item.student_id)?.display_name || '학생');
    return `<article class="dispute-card"><div class="dispute-main"><div><span class="pill blue">${items.length}명 이의제기</span><h3>${esc(first.word)}</h3><p>기본 뜻 <b>${esc(first.meaning)}</b></p><div class="dispute-answer">학생 답 <strong>${esc(first.answer)}</strong></div><small>${esc([...new Set(students)].join(' · '))}</small></div><div class="dispute-actions"><button class="btn primary" data-dispute-global="${first.id}">전체 정답 인정</button><button class="btn" data-dispute-reject="${first.id}">오답 유지</button></div></div><div class="dispute-students">${items.map(item => { const student = A.data.profiles.find(p => p.id === item.student_id); return `<div><span><b>${esc(student?.display_name || '학생')}</b><small>${item.source_type === 'exam' ? '실전시험' : '단어 연습'} · ${date(item.created_at)}</small></span><button class="text-button" data-dispute-once="${item.id}">이번 학생만 인정</button></div>`; }).join('')}</div></article>`;
  }).join('');
  const history = all.filter(item => item.status !== 'pending').slice(0, 20).map(item => {
    const label = item.status === 'approved_auto' ? '자동 인정' : item.status === 'approved_global' ? '전체 인정' : item.status === 'approved_once' ? '이번만 인정' : '오답 유지';
    return `<div class="teacher-feed"><span class="pill ${item.status.startsWith('approved') ? 'green' : ''}">${label}</span><div class="grow"><p><b>${esc(item.word)}</b> · ${esc(item.answer)}</p><small>${date(item.resolved_at || item.created_at)}</small></div></div>`;
  }).join('');
  return `<div class="dispute-summary"><div><span>검토 대기</span><strong>${pending.length}<small>건</small></strong></div><p>뜻쓰기 오답에서 학생이 제기한 답만 모입니다. <b>전체 정답 인정</b>을 누르면 허용 뜻 DB에 저장되고 같은 답을 제기한 학생들이 자동 재채점됩니다.</p></div><section class="panel"><div class="panel-head"><div><h2>뜻쓰기 이의제기</h2><span>현재 ${esc(A.school)} · ${A.data.profile.active_division === 'middle' ? '중등부' : '고등부'}</span></div><span>${groups.size}개 표현</span></div><div class="dispute-list">${cards || empty('records','검토할 이의제기가 없어요','승인한 허용 뜻은 단어 데이터에 계속 저장됩니다.')}</div></section>${history ? `<section class="panel"><div class="panel-head"><h2>최근 처리 기록</h2><span>최근 20건</span></div><div class="panel-body">${history}</div></section>` : ''}`;
}
function assignments(A) {
  return `<section class="panel"><div class="panel-head"><h2>배정된 연습 과제</h2><span>${A.data.assignments.length}개 과제</span></div><div class="panel-body">${A.data.assignments.length ? A.data.assignments.map(a => { const sessions = A.data.sessions.filter(s => s.assignment_id === a.id); return `<div class="assignment-row"><div class="row between"><h3>${esc(a.title)}</h3><span class="pill ${a.due_at > Date.now() ? 'blue' : ''}">${a.due_at > Date.now() ? '진행 중' : '마감'}</span></div><p>${esc(a.class_name)} · ${a.school} · ${esc(scope(a))} · ${date(a.due_at)}까지</p><div class="row"><span class="pill">목표 ${a.target_questions}문제</span><span class="tiny muted">${new Set(sessions.map(s => s.student_id)).size}명 참여 · ${sessions.reduce((n, s) => n + s.total, 0)}문제 학습</span></div></div>`; }).join('') : empty('records', '배정된 연습 과제가 없어요', '학생은 과제 없이도 직접 범위를 골라 연습할 수 있어요.')}</div></section>`;
}
function exams(A) {
  return `<section class="panel exam-ops-panel"><div class="panel-head"><div><h2>실전시험 목록</h2><span>학교·반 기준으로 정확하게 분리되어 표시됩니다.</span></div><span>총 ${A.data.exams.length}개</span></div>${A.data.exams.length ? `<div class="table-scroll"><table class="exam-ops-table"><thead><tr><th>시험명 / 범위</th><th>시험 유형</th><th>대상</th><th>문제 / 시간</th><th>제출 현황</th><th>결과</th><th>운영</th></tr></thead><tbody>${A.data.exams.map(e => {
    const attempts = A.data.attempts.filter(a => a.exam_id === e.id);
    const submitted = attempts.filter(a => a.status === 'submitted').length;
    const active = attempts.filter(a => a.status === 'active').length;
    const targetStudents = A.data.profiles.filter(p => p.active && targetMatches(e.class_name, p));
    const attemptedIds = new Set(attempts.map(a => a.student_id));
    const missing = targetStudents.filter(p => !attemptedIds.has(p.id)).length;
    return `<tr><td><strong>${esc(e.title)}</strong><small>${e.school} · ${esc(scope(e))}</small><small>${date(e.due_at)} 마감</small></td><td>${EXAM_TYPES[e.exam_type].label}</td><td><strong>${esc(targetLabel(e.class_name))}</strong><small>${targetStudents.length}명 대상</small></td><td><strong>${e.question_count}문제</strong><small>${Math.round(e.duration_sec / 60)}분</small></td><td><div class="exam-submit-state"><span class="done">완료 ${submitted}</span><span class="doing">응시 ${active}</span><span class="wait">미응시 ${missing}</span></div></td><td><button class="text-button" data-release="${e.id}">${e.release_result ? '공개 중' : '비공개'}</button></td><td><div class="exam-op-actions"><button class="btn small" data-exam-edit="${e.id}">수정</button><button class="btn small secondary" data-exam-status="${e.id}">현황</button><button class="icon-button exam-more" data-exam-menu="${e.id}" aria-label="시험 더보기">⋯</button></div></td></tr>`;
  }).join('')}</tbody></table></div>` : empty('exam', '첫 실전시험을 만들어보세요', '영어쓰기와 뜻쓰기도 바로 만들 수 있어요.')}</section>`;
}
function results(A) {
  const allSessions = [...A.data.sessions].sort((a,b) => b.created_at - a.created_at);
  const selfTests = finishedSelfTests(allSessions);
  const practices = allSessions.filter(item => item.run_mode !== 'test');
  const legacyAttempts = A.data.attempts.filter(a => a.status === 'submitted').sort((a,b) => b.submitted_at - a.submitted_at);
  const avg = rows => rows.length ? Math.round(rows.reduce((n, item) => n + Number(item.score ?? (item.total ? Math.round(item.correct / item.total * 100) : 0)), 0) / rows.length) : 0;
  const totalQuestions = allSessions.reduce((n,s)=>n+Number(s.total||0),0);
  const pending = (A.data.meaning_disputes || []).filter(item => item.status === 'pending').length;
  const sec = value => { const n = Math.max(0, Number(value || 0)), m = Math.floor(n/60), s = n%60; return `${m}:${String(s).padStart(2,'0')}`; };
  // V13.64: filter by class / name and show 30 rows at a time (was every record at once).
  const q = (A.resultsQuery || '').trim().toLowerCase();
  const nameOf = new Map(A.data.profiles.map(profile => [profile.id, profile]));
  const matches = s => { const p = nameOf.get(s.student_id); return (!A.resultsClass || (p?.class_name || s.grade) === A.resultsClass) && (!q || `${p?.display_name || ''} ${p?.username || ''}`.toLowerCase().includes(q)); };
  const limit = Math.max(30, Number(A.resultsLimit) || 30);
  const table = (all, sent = false) => { const rows = all.filter(matches); return rows.length ? `<div class="table-scroll"><table class="tv2-results-table"><thead><tr><th>학생</th><th>범위</th><th>방식</th><th>점수</th><th>정답</th><th>시간</th><th>${sent ? '끝난 시간' : '학습'}</th><th>상세</th></tr></thead><tbody>${rows.slice(0, limit).map(s => {
    const p = A.data.profiles.find(profile => profile.id === s.student_id);
    const score = s.score ?? (s.total ? Math.round(s.correct / s.total * 100) : 0);
    const disputes = (A.data.meaning_disputes || []).filter(d => d.source_type === 'practice' && d.source_id === s.id);
    const pendingCount = disputes.filter(d => d.status === 'pending').length;
    const regraded = disputes.some(d => String(d.status || '').startsWith('approved')) || s.regraded_at;
    return `<tr><td class="tv2-cell-name"><strong>${esc(p?.display_name || '학생')}</strong><small>${esc(p?.class_name || s.grade || '')}</small></td><td data-label="범위" class="tv2-cell-range">${(s.range_codes || []).map(code => esc(recordRangeLabel(s, code))).join(' · ') || '선택 범위'}</td><td data-label="방식">${esc(PRACTICE_TYPES[s.mode] || '연습')}<small>${sent ? '실전시험' : '연습 모드'}</small></td><td data-label="점수"><strong class="tv2-score ${score >= 90 ? 'hi' : score < 60 ? 'lo' : ''}">${score}점</strong>${pendingCount ? '<small>임시 · 이의제기 심사중</small>' : regraded ? '<small>재채점 완료</small>' : ''}</td><td data-label="정답">${s.correct} / ${s.total}</td><td data-label="시간">${sec(s.duration_sec)}</td><td data-label="${sent ? '끝난 시간' : '학습'}">${date(sent ? testEndedAt(s) : s.created_at)}${sent && passNote(s) ? `<small>${passNote(s)}</small>` : ''}${s.left_out ? '' : s.auto_submitted ? '<small>시간 종료 자동 제출</small>' : ''}${leaveNote(s) ? `<small class="leave-note-v1376">${leaveNote(s)}</small>` : ''}</td><td class="tv2-cell-action"><button class="text-button" data-practice-record="${s.id}">답안 보기</button></td></tr>`;
  }).join('')}</tbody></table></div>${rows.length > limit ? `<button class="tv2-more" data-results-more>${rows.length - limit}개 더 보기</button>` : ''}` : empty('records', q || A.resultsClass ? '조건에 맞는 기록이 없어요' : sent ? '실전시험 결과가 아직 없어요' : '완료된 연습 기록이 아직 없어요'); };
  const classes = [...new Set(A.data.profiles.map(p => p.class_name).filter(Boolean))];
  const filterBar = `<div class="toolbar tv2-results-filter"><div class="search">${icon('search')}<input id="results-search" aria-label="학생 이름으로 기록 찾기" placeholder="학생 이름 또는 아이디" value="${esc(A.resultsQuery || '')}"></div><select id="results-class" aria-label="반으로 기록 거르기"><option value="">전체 반</option>${classes.map(c => `<option ${c === A.resultsClass ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></div>`;
  const legacyTable = legacyAttempts.length ? `<details class="legacy-results"><summary>이전 선생님 배정시험 기록 ${legacyAttempts.length}회</summary><div class="table-scroll"><table><thead><tr><th>학생</th><th>시험</th><th>점수</th><th>일시</th></tr></thead><tbody>${legacyAttempts.slice(0,100).map(a => { const e=A.data.exams.find(exam=>exam.id===a.exam_id), p=A.data.profiles.find(profile=>profile.id===a.student_id); return `<tr><td>${esc(p?.display_name || '학생')}</td><td>${esc(e?.title || '이전 시험')}</td><td>${a.score}점</td><td>${date(a.submitted_at)}</td></tr>`; }).join('')}</tbody></table></div></details>` : '';
  // V13.75: a weekly summary per student comes first; the full logs sit behind tabs.
  const views = [['week', '이번 주 요약'], ['practice', `연습 기록 ${num(practices.length)}`], ['sent', `실전시험 결과 ${num(selfTests.length)}`]];
  const view = views.some(([k]) => k === A.resultsView) ? A.resultsView : 'week';
  const tabsBar = `<div class="res-tabs-v1375" role="tablist">${views.map(([k, label]) => `<button type="button" role="tab" aria-selected="${k === view}" class="${k === view ? 'on' : ''}" data-results-view="${k}">${label}</button>`).join('')}</div>`;
  let body;
  if (view === 'week') {
    const work = weekWork(A.data), last = lastActivityMap(A.data);
    const rows = A.data.profiles.filter(p => p.active && (!A.resultsClass || p.class_name === A.resultsClass) && (!q || `${p.display_name} ${p.username}`.toLowerCase().includes(q)))
      .map(p => ({ p, w: work.get(p.id) || { count: 0, total: 0, scores: 0, prevTotal: 0 }, t: last.get(p.id) || 0 }))
      .sort((a, b) => b.w.total - a.w.total || b.t - a.t);
    const trend = w => { const diff = w.total - w.prevTotal; return diff > 0 ? `<span class="up">▲ ${num(diff)}</span>` : diff < 0 ? `<span class="down">▼ ${num(-diff)}</span>` : '<span>-</span>'; };
    body = `<section class="panel"><div class="panel-head"><div><h2>이번 주 학생별 요약</h2><span>월요일부터 오늘까지 · 푼 문제가 많은 순서</span></div><span>${num(rows.filter(r => r.w.count).length)}/${num(rows.length)}명 학습</span></div>${rows.length ? `<div class="table-scroll"><table class="tv2-results-table week-table-v1375"><thead><tr><th>학생</th><th>학습</th><th>푼 문제</th><th>평균 점수</th><th>지난주 대비</th><th>최근 활동</th></tr></thead><tbody>${rows.map(({ p, w, t }) => `<tr class="${w.count ? '' : 'none'}"><td class="tv2-cell-name"><button class="table-name" data-student="${p.id}"><div><strong>${esc(p.display_name)}</strong><small>${esc(p.class_name || '')}</small></div></button></td><td data-label="학습">${w.count ? `${num(w.count)}회` : '<b class="lo">없음</b>'}</td><td data-label="푼 문제"><strong>${num(w.total)}</strong></td><td data-label="평균 점수">${w.count ? `<strong class="tv2-score ${Math.round(w.scores / w.count) >= 90 ? 'hi' : Math.round(w.scores / w.count) < 60 ? 'lo' : ''}">${Math.round(w.scores / w.count)}점</strong>` : '-'}</td><td data-label="지난주 대비" class="trend-v1375">${trend(w)}</td><td data-label="최근 활동">${agoLabel(t)}</td></tr>`).join('')}</tbody></table></div>` : empty('records', '조건에 맞는 학생이 없어요')}</section>`;
  } else if (view === 'sent') {
    body = `<section class="panel"><div class="panel-head"><div><h2>실전시험 결과</h2><span>학생이 끝낸 실전시험 전부 · 최근 끝난 순서</span></div><span>${selfTests.length}회</span></div>${table(selfTests, true)}</section>`;
  } else {
    body = `<section class="panel"><div class="panel-head"><div><h2>학생별 연습 기록</h2><span>암기 후 문제 연습 과정에서 저장된 기록</span></div><span>${practices.length}회</span></div>${table(practices, false)}</section>`;
  }
  return `${metrics([['실전시험', selfTests.length, '회'], ['실전 평균', avg(selfTests), '점'], ['연습 평균', avg(practices), '점'], ['누적 문제', totalQuestions, '문제']])}
    ${pending ? `<div class="dispute-summary"><div><span>이의제기 검토 대기</span><strong>${pending}<small>건</small></strong></div><p>승인하면 해당 기록 점수가 자동 재계산됩니다.</p></div>` : ''}
    ${tabsBar}
    ${filterBar}
    ${body}
    ${legacyTable}
    ${trimPanel(A)}`;
}
// V13.131 오래된 기록 정리: 대상 보기 → 보관 파일(JSON) 내려받기 → 정리하기. 받은 파일과 같을 때만 서버가 지운다.
function trimPanel(A) {
  const t = A.storageTrim, saved = A.storageArchived;
  const count = t ? `<p>정리할 기록: 연습 기록 <b>${num(t.sessions)}</b>개 · 시험 응시 <b>${num(t.attempts)}</b>개 · 약 <b>${num(t.kb)}</b>KB</p>` : '';
  const done = saved ? `<p>보관 파일을 받았어요(연습 ${num(saved.sessions)}개 · 시험 ${num(saved.attempts)}개). 파일이 저장된 것을 확인한 뒤 정리하기를 눌러 주세요.</p>` : '';
  return `<section class="panel trim-v13131"><div class="panel-head"><div><h2>오래된 기록 정리</h2><span>연습 기록은 90일, 시험 문제지는 시험이 끝나고 30일이 지나면 답안 목록을 지워 저장 공간을 줄여요. 날짜 · 점수 · 정답 수 · 경험치 · 코인은 그대로예요. 처리 안 된 이의제기와 재채점 중인 시험은 남겨 둬요.</span></div></div>
    ${count}${done}
    <div class="trim-actions-v13131" style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">
      <button type="button" class="btn secondary" data-action="trim-check">정리할 기록 보기</button>
      <button type="button" class="btn secondary" data-action="trim-archive" ${t && (t.sessions || t.attempts) ? '' : 'disabled'}>${icon('download')} 보관 파일 내려받기</button>
      <button type="button" class="btn primary" data-action="trim-run" ${saved ? '' : 'disabled'}>정리하기</button>
    </div></section>`;
}
// V13.66 academy yacha tournaments: open a bracket for a grade, watch it live, decide a match
// when a student cannot play.
export function tournamentPanel(t) {
  const decided = t.rounds.flatMap(round => round.matches).filter(m => m.winner && m.by !== 'bye').length;
  const total = t.rounds.flatMap(round => round.matches).filter(m => m.by !== 'bye').length;
  const live = t.rounds.flatMap(round => round.matches).filter(m => m.live).length;
  const current = t.rounds.find(round => round.matches.some(m => !m.winner));
  const status = t.status === 'finished' ? `<span class="pill green">우승 ${esc(t.champion?.name || '')}</span>` : t.status === 'cancelled' ? '<span class="pill">취소됨</span>' : `<span class="pill blue">${esc(current?.label || '')} 진행 중${live ? ` · 경기 ${live}개` : ''}</span>`;
  return `<section class="panel tn-panel ${t.status}" id="tn-${esc(t.id)}">
    <div class="panel-head"><div><h2>${esc(t.name)}</h2><span>${esc(t.class_name || t.grade || '')} · ${t.mode === 'skill' ? '실력전' : '스피드전'} · ${num(t.players)}명 · 경기 ${decided}/${total} · ${t.prize ? `${coin()} 우승 ${num(t.prize)} · 준우승 ${num(Math.floor(t.prize / 2))}` : '상금 없음'} · ${date(t.created_at)}</span></div><div class="tn-panel-actions">${status}${t.status !== 'cancelled' ? `<button type="button" class="btn small primary tn-tv-open" data-action="tournament-tv" data-id="${esc(t.id)}">${icon('tv')} TV로 크게 보기</button><button type="button" class="btn small secondary tn-tv-link" data-action="tournament-tv-link" data-id="${esc(t.id)}">${icon('tv')} TV 링크</button>` : ''}</div></div>
    ${bracketHtml(t, { teacher: true })}
    ${t.status === 'active' ? `<div class="tn-panel-foot"><p>학생이 오지 않았거나 경기를 할 수 없을 때는 경기 칸의 <b>승자 지정</b>으로 다음 라운드를 열 수 있어요. 무승부는 다시 겨뤄요.</p><button class="btn small" data-action="tournament-cancel" data-id="${esc(t.id)}">대회 취소</button></div>` : ''}
  </section>`;
}
function tournaments(A) {
  const list = A.data.tournaments || [];
  const active = list.filter(t => t.status === 'active'), past = list.filter(t => t.status !== 'active');
  // V13.125: 다른 학교와 야차전 허용 (one switch for the academy, on by default).
  const cross = A.data.battle_settings?.cross_school !== false;
  return `<section class="panel xs-switch-v13125">
      <div class="xs-copy"><h2>다른 학교와 야차전 허용</h2><p>켜 두면 학교가 달라도 <b>같은 부·같은 학년</b>(예: 강서고 고1 ↔ 단원고 고1)이면 친구 목록·도전장·방 코드로 겨뤄요. 단어는 각자 자기 학교 범위로 나와요. 끄면 같은 학교끼리만 해요. 대회·주간 리그·랭킹은 학교별 그대로예요.</p></div>
      <button type="button" class="xs-toggle-v13125 ${cross ? 'on' : ''}" role="switch" aria-checked="${cross}" aria-label="다른 학교와 야차전 허용" data-action="battle-cross-school"><i aria-hidden="true"></i><span>${cross ? '켜짐' : '꺼짐'}</span></button>
    </section>
    <section class="panel tn-intro">
      ${trophy('xl')}<div class="tn-intro-copy"><h2>학원 야차 대회</h2><p>같은 학년 학생들을 골라 토너먼트를 열어요. 판돈 없이 겨루고, 이기면 다음 라운드로 올라가요. 학생은 <b>홈 화면의 대회 알림</b>에서 경기를 시작하고, 우승하면 <b>SUMUS 챔피언</b> 칭호와 상금을 받아요.</p></div>
    </section>
    ${active.length ? active.map(tournamentPanel).join('') : empty('battle', '진행 중인 대회가 없어요', '대회 만들기로 첫 토너먼트를 열어 보세요.')}
    ${past.length ? `<details class="tn-past" ${A.tnPastOpen ? 'open' : ''}><summary>지난 대회 ${past.length}개</summary>${past.map(tournamentPanel).join('')}</details>` : ''}`;
}
const localDate = n => { const d = new Date(n); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16); };
export function examDefaults(A) { return A.examForm ??= { title: '', class_name: A.data.profile.active_division === 'middle' ? (A.data.profiles[0]?.class_name || '중3') : ALL_CLASSES, exam_type: 'write_meaning', question_count: 20, minutes: 10, passing_score: 80, max_attempts: 1, available: localDate(Date.now()), due: localDate(Date.now() + 3 * 86400000), release_result: true }; }
const field = (label, name, value, type = 'text', extra = '') => `<label class="field"><span>${label}</span><input name="${name}" value="${esc(value)}" type="${type}" required ${extra}></label>`;
const divisionClasses = A => A.data.profile.active_division === 'middle' ? ['중2','중3'] : ['고1A','고1B'];
const classSelect = (A, label, name, value) => {
  const options = [...new Set([...divisionClasses(A), value].filter(v => v && v !== ALL_CLASSES))];
  const allOption = A.data.profile.active_division === 'high'
    ? `<option value="${ALL_CLASSES}" ${value === ALL_CLASSES ? 'selected' : ''}>학교 전체</option>`
    : '';
  return `<label class="field"><span>${label}</span><select name="${name}" required>${allOption}${options.map(c => `<option value="${esc(c)}" ${String(value) === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></label>`;
};
const questionCountSelect = (value) => `<label class="field"><span>문제 수</span><select name="question_count" required><option value="10" ${String(value) === '10' ? 'selected' : ''}>10문제</option><option value="20" ${String(value) === '20' ? 'selected' : ''}>20문제</option><option value="30" ${String(value) === '30' ? 'selected' : ''}>30문제</option><option value="all" ${String(value) === 'all' ? 'selected' : ''}>단어 전체</option></select></label>`;
function examForm(A) {
  const f = examDefaults(A);
  return `<form id="exam-form" class="teacher-form"><div><section class="form-section"><h2>1. 시험과 범위</h2>${field('시험 이름', 'title', f.title, 'text', `placeholder="예: ${esc(A.school)} 중간고사 핵심 단어" maxlength="120"`)}<div class="step-label">학교</div><div class="locked-school">${icon('shield')}<div><b>${esc(A.school)}</b><small>상단 학교 변경에서 전환할 수 있어요.</small></div></div><div class="step-label" style="margin-top:22px">시험 범위</div>${rangePicker(A, true, examRangeGrade(f.class_name))}</section><section class="form-section"><h2>2. 시험 유형</h2><div class="exam-type-grid">${Object.entries(EXAM_TYPES).map(([k, t]) => `<label class="exam-type-option"><input type="radio" name="exam_type" value="${k}" ${f.exam_type === k ? 'checked' : ''}><div><b>${t.label}</b><small>${t.help}</small></div></label>`).join('')}</div><p class="form-footnote">선택한 한 가지 유형으로만 모든 문제가 출제됩니다.</p></section><section class="form-section"><h2>3. 응시 설정</h2><div class="form-columns">${classSelect(A, '대상', 'class_name', f.class_name)}${questionCountSelect(f.question_count)}${field('제한시간 (분)', 'minutes', f.minutes, 'number', 'min="1" max="180"')}${field('통과 점수', 'passing_score', f.passing_score, 'number', 'min="0" max="100"')}${field('시작 시간', 'available', f.available, 'datetime-local')}${field('마감 시간', 'due', f.due, 'datetime-local')}${field('응시 가능 횟수', 'max_attempts', f.max_attempts, 'number', 'min="1" max="10"')}</div></section></div><aside class="form-section publish-summary"><span class="pill blue">배정 미리보기</span><h2 class="summary-title" id="summary-title">${esc(f.title || '새 실전시험')}</h2><div id="exam-summary">${summary(A)}</div><label class="checkbox-line"><input type="checkbox" name="release_result" ${f.release_result ? 'checked' : ''}><span>제출 후 결과 공개<br><span class="muted">점수와 정답을 학생이 확인할 수 있어요.</span></span></label><div id="exam-create-error" class="form-error" role="alert"></div><button type="submit" class="btn primary full">시험 배정하기 ${icon('arrow')}</button><button type="button" class="text-button full" data-go="exams" style="width:100%">목록으로 돌아가기</button><p class="form-footnote">고등부는 학교 전체 또는 반별로 배정할 수 있어요. 배정 즉시 선택한 대상에게 표시됩니다.</p></aside></form>`;
}
function summary(A) {
  const f = examDefaults(A);
  const grade = examRangeGrade(f.class_name);
  const ranges = getRanges(A, A.school, grade);
  const selectedWords = selectedCount(A, grade);
  const count = String(f.question_count) === 'all' ? `단어 전체 (${selectedWords}문제)` : `${f.question_count}문제`;
  const target = `${targetLabel(f.class_name)} · ${targetCount(A, f.class_name)}명`;
  return [['학교', A.school], ['선택 범위', `${ranges.selected.length}개 범위 · ${selectedWords}단어`], ['시험 유형', EXAM_TYPES[f.exam_type].label], ['문제 / 시간', `${count} · ${f.minutes}분`], ['대상', target]].map(([label, value]) => `<div class="summary-line"><span>${label}</span><b>${esc(value)}</b></div>`).join('');
}
export function collectExamForm(A) {
  const form = $('#exam-form'); if (!form) return;
  const values = Object.fromEntries(new FormData(form)); A.examForm = { ...values, release_result: values.release_result === 'on' };
}
export function updateExamSummary(A) { collectExamForm(A); if ($('#summary-title')) $('#summary-title').textContent = A.examForm.title || '새 실전시험'; if ($('#exam-summary')) $('#exam-summary').innerHTML = summary(A); }
