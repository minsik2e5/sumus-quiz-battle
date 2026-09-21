import { api, esc, date, icon } from './modules/ui.js';

const app = document.querySelector('#app');
let cache = null;
let cacheAt = 0;
let scheduled = false;

function injectStyles() {
  if (document.querySelector('#dashboard-ops-style')) return;
  const style = document.createElement('style');
  style.id = 'dashboard-ops-style';
  style.textContent = `
    .ops-dashboard{display:grid;gap:18px;margin:0 0 20px}
    .ops-priority-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
    .ops-priority-card{position:relative;overflow:hidden;border:1px solid #eaecf0;border-radius:18px;background:#fff;padding:17px 18px;min-height:122px;box-shadow:0 1px 2px rgba(16,24,40,.03)}
    .ops-priority-card .ops-card-top{display:flex;align-items:center;justify-content:space-between;gap:10px}
    .ops-priority-card .ops-card-icon{width:34px;height:34px;border-radius:11px;display:grid;place-items:center;background:#f2f4f7;color:#344054}
    .ops-priority-card .ops-card-icon .icon{width:18px;height:18px}
    .ops-priority-card strong{display:block;font-size:26px;line-height:1;margin:18px 0 7px;letter-spacing:-.04em;color:#101828}
    .ops-priority-card p{margin:0;color:#667085;font-size:12px;line-height:1.5}
    .ops-priority-card button{position:absolute;inset:0;border:0;background:transparent;cursor:pointer}
    .ops-priority-card.alert{border-color:#fedf89;background:linear-gradient(145deg,#fffaf0,#fff)}
    .ops-priority-card.alert .ops-card-icon{background:#fef0c7;color:#b54708}
    .ops-priority-card.danger{border-color:#fecdca;background:linear-gradient(145deg,#fff7f7,#fff)}
    .ops-priority-card.danger .ops-card-icon{background:#fee4e2;color:#b42318}
    .ops-board-grid{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(0,.85fr);gap:18px}
    .ops-card{border:1px solid #eaecf0;border-radius:18px;background:#fff;overflow:hidden}
    .ops-card-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:17px 18px 13px;border-bottom:1px solid #f2f4f7}
    .ops-card-head h2{font-size:15px;margin:0 0 4px;color:#101828}
    .ops-card-head p{font-size:11px;color:#98a2b3;margin:0}
    .ops-card-head button{border:0;background:transparent;color:#475467;font:inherit;font-size:12px;font-weight:700;cursor:pointer;padding:4px}
    .ops-list{display:grid}
    .ops-row{display:flex;align-items:center;gap:12px;padding:12px 18px;border-bottom:1px solid #f2f4f7;min-width:0}
    .ops-row:last-child{border-bottom:0}
    .ops-row .ops-badge{flex:0 0 auto;min-width:48px;text-align:center;padding:5px 7px;border-radius:999px;font-size:10px;font-weight:800;background:#f2f4f7;color:#475467}
    .ops-row .ops-badge.warn{background:#fef0c7;color:#b54708}
    .ops-row .ops-badge.bad{background:#fee4e2;color:#b42318}
    .ops-row .ops-badge.good{background:#dcfae6;color:#067647}
    .ops-row .grow{min-width:0;flex:1}
    .ops-row b{display:block;font-size:12px;color:#101828;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .ops-row small{display:block;margin-top:3px;color:#98a2b3;font-size:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .ops-row .ops-value{font-size:12px;font-weight:800;color:#344054;white-space:nowrap}
    .ops-row button.ops-student-link{border:0;background:transparent;padding:0;text-align:left;cursor:pointer;font:inherit;min-width:0;flex:1}
    .ops-empty{padding:24px 18px;text-align:center;color:#98a2b3;font-size:12px}
    .ops-weekly{padding:14px 18px 16px;display:grid;gap:11px}
    .ops-bar-row{display:grid;grid-template-columns:92px minmax(0,1fr) 52px;gap:10px;align-items:center}
    .ops-bar-name{font-size:11px;color:#344054;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .ops-bar-track{height:7px;background:#f2f4f7;border-radius:999px;overflow:hidden}
    .ops-bar-fill{height:100%;border-radius:999px;background:linear-gradient(90deg,#7f56d9,#9e77ed)}
    .ops-bar-value{text-align:right;font-size:10px;font-weight:800;color:#667085}
    .ops-summary-strip{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;padding:14px 18px;border-top:1px solid #f2f4f7}
    .ops-summary-strip div{padding:10px 11px;border-radius:12px;background:#f9fafb}
    .ops-summary-strip span{display:block;font-size:10px;color:#98a2b3;margin-bottom:5px}
    .ops-summary-strip b{font-size:15px;color:#101828}
    @media(max-width:980px){.ops-priority-grid{grid-template-columns:1fr}.ops-board-grid{grid-template-columns:1fr}}
    @media(max-width:640px){.ops-priority-card{min-height:108px}.ops-bar-row{grid-template-columns:74px minmax(0,1fr) 44px}.ops-summary-strip{grid-template-columns:1fr}}
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

function eligibleStudents(data, item) {
  return data.profiles.filter(p => p.active && (item.class_name === '__ALL__' || p.class_name === item.class_name) && (!item.school || p.school === item.school));
}

function examState(data, exam, student) {
  const attempts = data.attempts.filter(a => a.exam_id === exam.id && a.student_id === student.id);
  if (attempts.some(a => a.status === 'submitted')) return 'submitted';
  if (attempts.some(a => a.status === 'active')) return 'active';
  return 'missing';
}

function assignmentProgress(data, assignment, studentId) {
  return data.sessions
    .filter(s => s.assignment_id === assignment.id && s.student_id === studentId)
    .reduce((sum, s) => sum + Number(s.total || 0), 0);
}

function dashboardWeek(data, now = Date.now()) {
  const period = data.ranking_period;
  if (Number.isFinite(Number(period?.start)) && Number.isFinite(Number(period?.end))) {
    return { start: Number(period.start), end: Number(period.end), label: period.label || '이번 주', range: period.range || '월요일 ~ 일요일' };
  }
  const offset = 9 * 3600000, day = 86400000;
  const local = new Date(now + offset);
  const daysSinceMonday = (local.getUTCDay() + 6) % 7;
  const start = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() - daysSinceMonday) - offset;
  return { start, end: start + 7 * day, label: '이번 주', range: '월요일 ~ 일요일' };
}

function calculate(data) {
  const now = Date.now();
  const week = dashboardWeek(data, now);
  const twoWeeksAgo = now - 14 * 86400000;
  const activeStudents = data.profiles.filter(p => p.active);
  const openExams = data.exams.filter(e => e.active && e.available_at <= now && e.due_at > now);
  const missingExams = [];
  const activeExamStudents = [];

  for (const exam of openExams) {
    for (const student of eligibleStudents(data, exam)) {
      const state = examState(data, exam, student);
      if (state === 'missing') missingExams.push({ exam, student });
      else if (state === 'active') activeExamStudents.push({ exam, student });
    }
  }

  const openAssignments = data.assignments.filter(a => a.active && a.due_at > now);
  const incompleteAssignments = [];
  for (const assignment of openAssignments) {
    for (const student of eligibleStudents(data, assignment)) {
      const done = assignmentProgress(data, assignment, student.id);
      if (done < Number(assignment.target_questions || 0)) incompleteAssignments.push({ assignment, student, done });
    }
  }

  const recentSubmitted = data.attempts
    .filter(a => a.status === 'submitted' && a.submitted_at >= twoWeeksAgo && Number.isFinite(Number(a.score)))
    .sort((a, b) => (b.submitted_at || 0) - (a.submitted_at || 0));
  const recentAvg = recentSubmitted.length ? Math.round(recentSubmitted.reduce((n, a) => n + Number(a.score || 0), 0) / recentSubmitted.length) : 0;
  const lowScores = recentSubmitted.filter(a => {
    const exam = data.exams.find(e => e.id === a.exam_id);
    return Number(a.score) < Number(exam?.passing_score ?? 80);
  });

  const weekly = activeStudents.map(student => {
    const sessions = data.sessions.filter(s => s.student_id === student.id && s.created_at >= week.start && s.created_at < week.end);
    return {
      student,
      total: sessions.reduce((n, s) => n + Number(s.total || 0), 0),
      xp: sessions.reduce((n, s) => n + Number(s.xp || 0), 0),
      count: sessions.length
    };
  }).sort((a, b) => b.total - a.total || a.student.display_name.localeCompare(b.student.display_name, 'ko'));

  const studiedThisWeek = weekly.filter(x => x.total > 0).length;
  const totalQuestions = weekly.reduce((n, x) => n + x.total, 0);
  return { activeStudents, openExams, missingExams, activeExamStudents, incompleteAssignments, recentSubmitted, recentAvg, lowScores, weekly, studiedThisWeek, totalQuestions, week };
}

function priorityCard({ label, value, sub, iconName, kind = '', go }) {
  return `<div class="ops-priority-card ${kind}"><div class="ops-card-top"><span>${esc(label)}</span><span class="ops-card-icon">${icon(iconName)}</span></div><strong>${esc(value)}</strong><p>${esc(sub)}</p><button data-go="${esc(go)}" aria-label="${esc(label)} 보기"></button></div>`;
}

function missingExamRows(calc) {
  return calc.missingExams
    .sort((a, b) => a.exam.due_at - b.exam.due_at)
    .slice(0, 6)
    .map(({ exam, student }) => `<div class="ops-row"><span class="ops-badge bad">미응시</span><button class="ops-student-link" data-student="${student.id}"><div class="grow"><b>${esc(student.display_name)} · ${esc(exam.title)}</b><small>${esc(student.class_name)} · ${esc(student.school)} · ${date(exam.due_at)} 마감</small></div></button><span class="ops-value">${Math.max(0, Math.ceil((exam.due_at - Date.now()) / 3600000))}h</span></div>`)
    .join('') || '<div class="ops-empty">현재 미응시 경고가 없어요.</div>';
}

function incompleteRows(calc) {
  return calc.incompleteAssignments
    .sort((a, b) => a.assignment.due_at - b.assignment.due_at || (a.done / a.assignment.target_questions) - (b.done / b.assignment.target_questions))
    .slice(0, 6)
    .map(({ assignment, student, done }) => {
      const target = Number(assignment.target_questions || 0);
      return `<div class="ops-row"><span class="ops-badge warn">과제</span><button class="ops-student-link" data-student="${student.id}"><div class="grow"><b>${esc(student.display_name)} · ${esc(assignment.title)}</b><small>${esc(student.class_name)} · ${done}/${target}문제 · ${date(assignment.due_at)} 마감</small></div></button><span class="ops-value">${target ? Math.min(100, Math.round(done / target * 100)) : 0}%</span></div>`;
    }).join('') || '<div class="ops-empty">현재 미완료 연습 과제가 없어요.</div>';
}

function lowScoreRows(data, calc) {
  return calc.lowScores.slice(0, 6).map(attempt => {
    const student = data.profiles.find(p => p.id === attempt.student_id);
    const exam = data.exams.find(e => e.id === attempt.exam_id);
    return `<div class="ops-row"><span class="ops-badge bad">${Number(attempt.score)}점</span><button class="ops-student-link" data-student="${student?.id || ''}"><div class="grow"><b>${esc(student?.display_name || '학생')} · ${esc(exam?.title || '실전시험')}</b><small>${date(attempt.submitted_at)} · 통과 ${Number(exam?.passing_score ?? 80)}점</small></div></button><span class="ops-value">${attempt.correct ?? '-'} / ${attempt.total ?? '-'}</span></div>`;
  }).join('') || '<div class="ops-empty">최근 14일 기준 통과점수 미만 기록이 없어요.</div>';
}

function weeklyBars(calc) {
  const list = calc.weekly.slice(0, 8);
  const max = Math.max(1, ...list.map(x => x.total));
  return list.length ? list.map(({ student, total }) => `<div class="ops-bar-row"><span class="ops-bar-name">${esc(student.display_name)}</span><div class="ops-bar-track"><div class="ops-bar-fill" style="width:${Math.max(total ? 6 : 0, Math.round(total / max * 100))}%"></div></div><span class="ops-bar-value">${total}문제</span></div>`).join('') : '<div class="ops-empty">등록된 학생이 없어요.</div>';
}

async function enhanceDashboard() {
  if (!document.querySelector('.teacher-app') || !document.querySelector('button[data-go="dashboard"].active')) return;
  const metrics = document.querySelector('.teacher-main .teacher-metrics');
  if (!metrics || document.querySelector('#ops-dashboard')) return;
  injectStyles();
  const data = await bootstrap();
  if (!document.querySelector('button[data-go="dashboard"].active') || document.querySelector('#ops-dashboard')) return;
  const calc = calculate(data);
  const top = calc.weekly[0];
  const wrap = document.createElement('section');
  wrap.id = 'ops-dashboard';
  wrap.className = 'ops-dashboard';
  wrap.innerHTML = `
    <div class="ops-priority-grid">
      ${priorityCard({ label: '실전시험 미응시', value: `${calc.missingExams.length}명`, sub: calc.activeExamStudents.length ? `현재 ${calc.activeExamStudents.length}명 응시 중` : '현재 진행 중인 응시자 없음', iconName: 'exam', kind: calc.missingExams.length ? 'danger' : '', go: 'exams' })}
      ${priorityCard({ label: '연습 과제 미완료', value: `${calc.incompleteAssignments.length}건`, sub: `${data.assignments.filter(a => a.active && a.due_at > Date.now()).length}개 과제 진행 중`, iconName: 'records', kind: calc.incompleteAssignments.length ? 'alert' : '', go: 'assignments' })}
      ${priorityCard({ label: '최근 시험 평균', value: calc.recentSubmitted.length ? `${calc.recentAvg}점` : '-', sub: `최근 14일 · 낮은 점수 ${calc.lowScores.length}건`, iconName: 'ranking', kind: calc.lowScores.length ? 'alert' : '', go: 'results' })}
    </div>
    <div class="ops-board-grid">
      <div class="ops-card">
        <div class="ops-card-head"><div><h2>지금 확인할 학생</h2><p>진행 중 시험 기준 미응시 학생을 마감 순으로 표시해요.</p></div><button data-go="exams">시험 관리</button></div>
        <div class="ops-list">${missingExamRows(calc)}</div>
      </div>
      <div class="ops-card">
        <div class="ops-card-head"><div><h2>주간 학습량</h2><p>${esc(calc.week.label)} · ${esc(calc.week.range)}</p></div><button data-go="students">학생 관리</button></div>
        <div class="ops-weekly">${weeklyBars(calc)}</div>
        <div class="ops-summary-strip"><div><span>학습 학생</span><b>${calc.studiedThisWeek}/${calc.activeStudents.length}명</b></div><div><span>총 학습량</span><b>${calc.totalQuestions}문제</b></div><div><span>최다 학습</span><b>${esc(top?.student.display_name || '-')}</b></div></div>
      </div>
    </div>
    <div class="ops-board-grid">
      <div class="ops-card"><div class="ops-card-head"><div><h2>과제 미완료</h2><p>배정된 목표 문제 수에 아직 도달하지 않은 학생</p></div><button data-go="assignments">과제 관리</button></div><div class="ops-list">${incompleteRows(calc)}</div></div>
      <div class="ops-card"><div class="ops-card-head"><div><h2>낮은 시험 점수</h2><p>최근 14일, 시험별 통과점수 미만 기록</p></div><button data-go="results">결과 분석</button></div><div class="ops-list">${lowScoreRows(data, calc)}</div></div>
    </div>`;
  metrics.insertAdjacentElement('afterend', wrap);
}

function scheduleEnhance() {
  if (scheduled) return;
  scheduled = true;
  queueMicrotask(() => {
    scheduled = false;
    enhanceDashboard().catch(() => {});
  });
}

const observer = new MutationObserver(scheduleEnhance);
observer.observe(app, { childList: true, subtree: true });
injectStyles();
scheduleEnhance();
