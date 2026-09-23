import { EXAM_TYPES, PRACTICE_TYPES, CLASS_OPTIONS, dayKey } from './core.js';
import { icon, esc, num, date, recordRangeLabel, scope, empty, $, $$ } from './ui.js';
import { avatar } from './character.js';
import { rangePicker, selectedCount, getRanges } from './student.js';
import { DANWONGO_PASSAGES } from '../danwongo-grammar-data.js?v=2';
import { SEONBU_2025_PASSAGES, SEONBU_2026_PASSAGES } from '../seonbu-grammar-data.js?v=2';
import { GANGSEO_PASSAGES } from '../gangseo-grammar-data.js?v=1';
const tabs = [['dashboard', '대시보드', 'home'], ['students', '학생 관리', 'user'], ['books', '단어 데이터', 'practice'], ['disputes', '뜻 이의제기', 'records'], ['results', '결과 분석', 'ranking']];
const ALL_CLASSES = '__ALL__';
const targetLabel = value => value === ALL_CLASSES ? '학교 전체' : value;
const targetMatches = (target, profile) => target === ALL_CLASSES || profile.class_name === target;
const examRangeGrade = value => value === ALL_CLASSES ? null : value;
const targetCount = (A, value) => A.data.profiles.filter(p => p.active && targetMatches(value, p)).length;
export function teacherPage(A) {
  const title = tabs.find(t => t[0] === A.tab)?.[1] || '대시보드';
  const pendingDisputes = (A.data.meaning_disputes || []).filter(item => item.status === 'pending').length;
  const actions = A.tab === 'students' ? `<button class="btn primary" data-action="add-student">${icon('plus')} 학생 등록</button>` : A.tab === 'results' ? `<button class="btn secondary" data-action="export-results">${icon('download')} 결과 내보내기</button>` : '';
  const content = ({ dashboard, students, books, disputes, results }[A.tab] || dashboard)(A);
  const divisionOptions = [['middle','중등부'],['high','고등부']].filter(([id]) => (A.data.divisions || []).includes(id)).map(([id,label]) => `<option value="${id}" ${id === A.data.profile.active_division ? 'selected' : ''}>${label}</option>`).join('');
  const schoolOptions = A.data.schools.map(s => `<option value="${esc(s.id)}" ${s.id === A.data.profile.active_school_id ? 'selected' : ''}>${esc(s.name)}</option>`).join('');
  return `<div class="teacher-app"><aside class="sidebar"><div class="brand"><img src="/icon.svg" alt=""><div>SUMUS <span>VOCA</span></div></div><div class="workspace-label">선생님 워크스페이스</div><nav aria-label="교사 메뉴">${tabs.map(([id, label, i]) => `<button data-go="${id}" class="${A.tab === id || (A.tab === 'exam-create' && id === 'exams') ? 'active' : ''}">${icon(i)}<span>${label}</span>${id === 'disputes' && pendingDisputes ? `<em class="nav-count">${pendingDisputes}</em>` : ''}</button>`).join('')}</nav><footer><b>${esc(A.data.profile.display_name)}</b><small>SUMUS ENGLISH ACADEMY</small><br><button class="text-button" data-action="account">${icon('user')} 내 계정</button><button class="text-button" data-action="logout">${icon('logout')} 로그아웃</button></footer></aside><main class="teacher-main"><header class="teacher-top"><div><div class="eyebrow">SUMUS · ${esc(A.data.profile.active_school)} 학습 관리</div><h1>${title}</h1><p>${A.tab === 'dashboard' ? `${esc(A.data.profile.active_school)} 학생들의 오늘, 한눈에 확인하세요.` : '수업에 필요한 정보만, 간결하게.'}</p></div><div class="teacher-actions"><div class="teacher-division-switch" role="group" aria-label="중등부 고등부 변경"><button data-teacher-division="middle" class="${A.data.profile.active_division === 'middle' ? 'selected' : ''}">중등</button><button data-teacher-division="high" class="${A.data.profile.active_division === 'high' ? 'selected' : ''}">고등</button></div><label class="teacher-school"><span>학교</span><select id="teacher-school" aria-label="관리 학교 변경">${schoolOptions}</select></label><span class="teacher-date">${new Date().toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short', timeZone: 'Asia/Seoul' })}</span>${`<button class="icon-button" data-action="refresh" aria-label="새로고침">${icon('refresh')}</button>`}${actions}</div></header>${content}</main></div>`;
}
function metrics(items) { return `<div class="teacher-metrics">${items.map(([name, value, unit]) => `<div><span>${name}</span><strong>${num(value)}<small>${unit || ''}</small></strong></div>`).join('')}</div>`; }
function grammarPassagesForSchool(school) {
  if (school === '단원고') return DANWONGO_PASSAGES;
  if (school === '선부고') return [...SEONBU_2026_PASSAGES, ...SEONBU_2025_PASSAGES];
  if (school === '강서고') return GANGSEO_PASSAGES;
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
function attentionStudentButton(student, sub, tone = '') {
  return `<button class="v136-student-chip ${tone}" data-student="${student.id}"><span>${esc(student.display_name)}</span><small>${esc(sub)}</small>${icon('chevron')}</button>`;
}
function dashboard(A) {
  const d = A.data;
  const activeStudents = d.profiles.filter(student => student.active);
  const learnedToday = todayStudentIds(d);
  const learnedActiveCount = activeStudents.filter(student => learnedToday.has(student.id)).length;
  const inactiveToday = activeStudents.filter(student => !learnedToday.has(student.id));
  const grammar = grammarSummary(d, A.school);
  const weak = grammarWeakness(d, A.school);
  const sharedSelfTests = d.sessions.filter(item => item.run_mode === 'test' && item.shared_to_teacher_at).sort((a,b) => Number(b.shared_to_teacher_at) - Number(a.shared_to_teacher_at));
  const sharedToday = sharedSelfTests.filter(item => dayKey(item.shared_to_teacher_at) === dayKey(Date.now()));
  const attention = [...inactiveToday].sort((a, b) => a.display_name.localeCompare(b.display_name, 'ko'));
  const grammarAttention = [...grammar.studentRows].sort((a, b) => a.masters - b.masters || a.touched - b.touched).slice(0, 6);

  return `
    <div class="v136-command">
      <div class="v136-command-copy"><span class="v136-kicker">TODAY CONTROL</span><h2>오늘 관리할 학생부터 보여드려요.</h2><p>단어 암기·연습 · 어법/어휘 · 학생이 보낸 실전 결과를 한 번에 봅니다.</p></div>
      <div class="v136-command-score"><strong>${learnedActiveCount}<small>/ ${activeStudents.length}명</small></strong><span>오늘 학습 확인</span></div>
    </div>
    ${metrics([
      ['오늘 학습 확인', learnedActiveCount, '명'],
      ['오늘 미학습', inactiveToday.length, '명'],
      ['어법 MASTER', grammar.mastered, '지문'],
      ['실전 결과 제출', sharedToday.length, '건']
    ])}
    <div class="v136-dashboard-grid">
      <section class="panel v136-attention">
        <div class="panel-head"><div><h2>오늘 확인 필요</h2><span>학습 기록이 아직 없는 학생</span></div><span class="v136-count danger">${inactiveToday.length}명</span></div>
        <div class="v136-chip-list">${attention.length
          ? attention.slice(0, 10).map(student => attentionStudentButton(student, '오늘 학습 기록 없음')).join('')
          : '<div class="v136-clear">✓ 현재 활성 학생 모두 오늘 학습 기록이 있어요.</div>'}</div>
        ${attention.length > 10 ? `<button class="text-button v136-more" data-go="students">나머지 ${attention.length - 10}명 학생 관리에서 보기 ${icon('chevron')}</button>` : ''}
      </section>

      <section class="panel v136-grammar">
        <div class="panel-head"><div><h2>어법·어휘 MASTER</h2><span>${esc(A.school)} 시험범위 · ${grammar.passages.length}지문 기준</span></div><span class="v136-count">${grammar.percent}%</span></div>
        <div class="v136-master-bar"><i style="width:${grammar.percent}%"></i></div>
        <div class="v136-master-summary"><b>${grammar.mastered}</b><span>/ ${activeStudents.length * grammar.passages.length} 학생·지문 MASTER</span></div>
        <div class="v136-mini-list">${grammarAttention.length ? grammarAttention.map(row => `
          <button data-student="${row.student.id}"><span><b>${esc(row.student.display_name)}</b><small>${esc(row.student.class_name)} · 학습 ${row.touched}/${row.total}</small></span><strong>${row.masters}/${row.total}</strong></button>
        `).join('') : '<div class="v136-empty-line">등록된 활성 학생이 없어요.</div>'}</div>
      </section>
    </div>

    <div class="v136-dashboard-grid">
      <section class="panel">
        <div class="panel-head"><div><h2>학생이 보낸 실전 결과</h2><span>학생이 직접 실전모드를 끝내고 전송한 기록</span></div><button class="text-button" data-go="results">전체 결과</button></div>
        <div class="v136-exam-list">${sharedSelfTests.length ? sharedSelfTests.slice(0,6).map(item => {
          const student = d.profiles.find(profile => profile.id === item.student_id);
          const ranges = (item.range_codes || []).map(code => recordRangeLabel(item, code)).join(' · ') || '선택 범위';
          return `<div class="v136-exam-item"><div class="v136-exam-top"><span class="square-icon">${icon('exam')}</span><div class="grow"><h3>${esc(student?.display_name || '학생')} · ${item.score ?? 0}점</h3><p>${esc(student?.class_name || item.grade || '')} · ${esc(ranges)} · ${esc(PRACTICE_TYPES[item.mode] || '쓰기')}</p></div><button class="text-button" data-practice-record="${item.id}">답안 보기</button></div><div class="v136-missing-names"><span>전송 ${date(item.shared_to_teacher_at)}</span></div></div>`;
        }).join('') : '<div class="v136-empty-line">아직 학생이 보낸 실전 결과가 없어요.</div>'}</div>
      </section>

      <section class="panel">
        <div class="panel-head"><div><h2>많이 틀린 어법 포인트</h2><span>현재 저장된 1차 오답 기준</span></div><span class="v136-count warn">${weak.choices.reduce((n, item) => n + item.count, 0)}건</span></div>
        <div class="v136-weak-list">${weak.choices.length ? weak.choices.slice(0, 5).map((item, index) => `
          <div><span class="v136-rank">${index + 1}</span><div class="grow"><b>${esc(item.passage.number)}번 · 정답 ${esc(item.answer)}</b><small>${esc(item.type)} · ${esc(item.passage.subtitle || item.passage.title)}</small></div><strong>${item.count}명</strong></div>
        `).join('') : '<div class="v136-empty-line">아직 누적된 어법·어휘 오답이 없어요.</div>'}</div>
      </section>
    </div>

    <section class="panel">
      <div class="panel-head"><div><h2>취약 지문 TOP</h2><span>학생들의 1차 오답이 많이 쌓인 지문</span></div><button class="text-button" data-go="students">학생별 확인 ${icon('chevron')}</button></div>
      <div class="v136-passage-grid">${weak.passages.length ? weak.passages.slice(0, 6).map((item, index) => `
        <div><span>${index + 1}</span><strong>${esc(item.passage.number)}번</strong><small>${esc(item.passage.subtitle || item.passage.title)}</small><b>${item.count}건 오답</b></div>
      `).join('') : '<div class="v136-empty-line">어법·어휘 학습 데이터가 쌓이면 지문별 취약도가 표시됩니다.</div>'}</div>
    </section>

    <section class="panel">
      <div class="panel-head"><h2>학생 학습 현황</h2><button class="text-button" data-go="students">전체 학생 ${icon('chevron')}</button></div>
      ${studentTable(d.profiles.slice(0, 8), d.word_mastery || {})}
    </section>
  `;
}
function studentTable(list, wordMastery = {}) {
  return list.length ? `<div class="table-scroll"><table class="student-ops-table"><thead><tr><th>학생</th><th>반 / 학교</th><th>오늘 학습량</th><th>정답률</th><th>단어 MASTER</th><th>취약 단어</th><th>상태</th></tr></thead><tbody>${list.map(p => { const wm = wordMastery[p.id] || {}; return `<tr><td><button class="table-name" data-student="${p.id}">${avatar(p.avatar_key, { size: 'mini' })}<div><strong>${esc(p.display_name)}</strong><small>Lv.${p.stats.level} · ${esc(p.username)}</small></div></button></td><td>${esc(p.class_name)}<small>${p.school}</small></td><td><strong>${num(p.stats.today_total)}</strong> 문제</td><td><div class="stat-bar"><div class="progress"><i style="width:${p.stats.accuracy}%"></i></div><span>${p.stats.accuracy}%</span></div></td><td><strong>${wm.mastered || 0}/${wm.total_ranges || 0}</strong><small>정복도 ${wm.conquest || 0}%</small></td><td>${p.stats.weak}개</td><td><span class="pill ${p.active ? 'green' : ''}">${p.active ? '활성' : '일시 중지'}</span></td></tr>`; }).join('')}</tbody></table></div>` : empty('user', '등록된 학생이 없어요', '학생 등록으로 첫 계정을 만들어주세요.');
}
export function studentFiltered(A) {
  const q = (A.search || '').toLowerCase();
  return studentTable(A.data.profiles.filter(p => (!A.classFilter || p.class_name === A.classFilter) && `${p.display_name} ${p.username}`.toLowerCase().includes(q)), A.data.word_mastery || {});
}
function students(A) {
  return `<div class="toolbar"><div class="search">${icon('search')}<input id="student-search" aria-label="학생 검색" placeholder="이름 또는 아이디 검색" value="${esc(A.search || '')}"></div><select id="class-filter" aria-label="반 필터"><option value="">전체 반</option>${[...new Set(A.data.profiles.map(p => p.class_name))].map(c => `<option ${c === A.classFilter ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select><span class="tiny muted">총 ${A.data.profiles.length}명</span></div><section class="panel" id="student-table">${studentFiltered(A)}</section>`;
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
  return `<div class="panel-head"><div><h2>${A.school} 단어장</h2><span>원본 뜻은 유지하고, 기본 유효답과 승인된 허용 뜻의 출처를 따로 관리합니다.</span></div><span>${list.length}개 단어</span></div><div class="table-scroll"><table class="vocab-table"><thead><tr>${gradeHead}<th>범위</th><th>영어</th><th>기본 뜻</th><th>허용 뜻</th><th>관리</th></tr></thead><tbody>${list.slice(0, 400).map(w => {
    const aliases = A.data.meaning_aliases?.[w.id] || [];
    const meta = A.data.meaning_alias_meta?.[w.id] || [];
    const aliasHtml = aliases.map(alias => {
      const item = meta.find(entry => String(entry.value) === String(alias));
      const source = item?.source || 'legacy';
      return `<span class="meaning-alias source-${source}" title="${esc(aliasSourceLabel(source))}">${esc(alias)}<small>${esc(aliasSourceLabel(source))}</small></span>`;
    }).join('');
    return `<tr>${middle ? `<td><span class="pill">${esc(w.grade || '-')}</span></td>` : ''}<td>${esc(w.range_code)}</td><td><strong>${esc(w.word)}</strong></td><td>${esc(w.meaning)}</td><td><span class="meaning-alias auto">기본 유효답<small>자동</small></span>${aliasHtml}</td><td><button class="text-button" data-meaning-alias="${esc(w.id)}">허용 뜻 관리</button></td></tr>`;
  }).join('')}</tbody></table></div>`;
}
function books(A) {
  const middle = A.data.profile.active_division === 'middle';
  const gradeSelect = middle ? `<label class="teacher-school"><span>학년</span><select id="vocab-grade"><option value="">전체</option><option value="중2" ${A.vocabGrade === '중2' ? 'selected' : ''}>중2</option><option value="중3" ${A.vocabGrade === '중3' ? 'selected' : ''}>중3</option></select></label>` : '';
  const importButton = middle ? `<button class="btn primary" data-action="vocab-import">${icon('plus')} 단어 파일 등록</button>` : '';
  return `<div class="toolbar"><span class="school-chip">${esc(A.school)}</span>${gradeSelect}<div class="search">${icon('search')}<input id="vocab-search" aria-label="단어 검색" placeholder="영어 또는 뜻 검색" value="${esc(A.vocabSearch || '')}"></div>${importButton}</div><section class="panel" id="vocab-table">${vocabTable(A)}</section>`;
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
  const selfTests = allSessions.filter(item => item.run_mode === 'test' && item.shared_to_teacher_at);
  const practices = allSessions.filter(item => item.run_mode !== 'test');
  const legacyAttempts = A.data.attempts.filter(a => a.status === 'submitted').sort((a,b) => b.submitted_at - a.submitted_at);
  const avg = rows => rows.length ? Math.round(rows.reduce((n, item) => n + Number(item.score ?? (item.total ? Math.round(item.correct / item.total * 100) : 0)), 0) / rows.length) : 0;
  const totalQuestions = allSessions.reduce((n,s)=>n+Number(s.total||0),0);
  const pending = (A.data.meaning_disputes || []).filter(item => item.status === 'pending').length;
  const sec = value => { const n = Math.max(0, Number(value || 0)), m = Math.floor(n/60), s = n%60; return `${m}:${String(s).padStart(2,'0')}`; };
  const table = (rows, sent = false) => rows.length ? `<div class="table-scroll"><table><thead><tr><th>학생</th><th>범위</th><th>방식</th><th>점수</th><th>정답</th><th>시간</th><th>${sent ? '전송' : '학습'}</th><th>상세</th></tr></thead><tbody>${rows.slice(0,300).map(s => {
    const p = A.data.profiles.find(profile => profile.id === s.student_id);
    const score = s.score ?? (s.total ? Math.round(s.correct / s.total * 100) : 0);
    const disputes = (A.data.meaning_disputes || []).filter(d => d.source_type === 'practice' && d.source_id === s.id);
    const pendingCount = disputes.filter(d => d.status === 'pending').length;
    const regraded = disputes.some(d => String(d.status || '').startsWith('approved')) || s.regraded_at;
    return `<tr><td><strong>${esc(p?.display_name || '학생')}</strong><small>${esc(p?.class_name || s.grade || '')}</small></td><td>${(s.range_codes || []).map(code => esc(recordRangeLabel(s, code))).join(' · ') || '선택 범위'}</td><td>${esc(PRACTICE_TYPES[s.mode] || '연습')}<small>${sent ? '학생 실전' : '연습 모드'}</small></td><td><strong>${score}점</strong>${pendingCount ? '<small>임시 · 이의제기 심사중</small>' : regraded ? '<small>재채점 완료</small>' : ''}</td><td>${s.correct} / ${s.total}</td><td>${sec(s.duration_sec)}</td><td>${date(sent ? s.shared_to_teacher_at : s.created_at)}${s.auto_submitted ? '<small>시간 종료 자동 제출</small>' : ''}</td><td><button class="text-button" data-practice-record="${s.id}">답안 보기</button></td></tr>`;
  }).join('')}</tbody></table></div>` : empty('records', sent ? '학생이 보낸 실전 결과가 아직 없어요' : '완료된 연습 기록이 아직 없어요');
  const legacyTable = legacyAttempts.length ? `<details class="legacy-results"><summary>이전 선생님 배정시험 기록 ${legacyAttempts.length}회</summary><div class="table-scroll"><table><thead><tr><th>학생</th><th>시험</th><th>점수</th><th>일시</th></tr></thead><tbody>${legacyAttempts.slice(0,100).map(a => { const e=A.data.exams.find(exam=>exam.id===a.exam_id), p=A.data.profiles.find(profile=>profile.id===a.student_id); return `<tr><td>${esc(p?.display_name || '학생')}</td><td>${esc(e?.title || '이전 시험')}</td><td>${a.score}점</td><td>${date(a.submitted_at)}</td></tr>`; }).join('')}</tbody></table></div></details>` : '';
  return `${metrics([['학생 제출 실전', selfTests.length, '회'], ['실전 평균', avg(selfTests), '점'], ['연습 평균', avg(practices), '점'], ['누적 문제', totalQuestions, '문제']])}
    ${pending ? `<div class="dispute-summary"><div><span>이의제기 검토 대기</span><strong>${pending}<small>건</small></strong></div><p>승인하면 해당 기록 점수가 자동 재계산됩니다.</p></div>` : ''}
    <section class="panel"><div class="panel-head"><div><h2>학생이 보낸 실전 결과</h2><span>학생이 직접 범위·유형을 선택하고 선생님께 전송한 성적</span></div><span>${selfTests.length}회</span></div>${table(selfTests, true)}</section>
    <section class="panel"><div class="panel-head"><div><h2>학생별 연습 기록</h2><span>암기 후 문제 연습 과정에서 저장된 기록</span></div><span>${practices.length}회</span></div>${table(practices, false)}</section>
    ${legacyTable}`;
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
