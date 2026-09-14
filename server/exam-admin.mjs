import { hashToken } from './auth.mjs';

const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };

function teacherFromToken(state, token) {
  const auth = state.tokens.find(t => t.hash === hashToken(token || '') && t.expires_at > Date.now());
  const profile = state.profiles.find(p => p.id === auth?.user_id && p.active);
  if (!profile) fail('다시 로그인해주세요.', 401);
  if (profile.role !== 'teacher') fail('선생님만 사용할 수 있는 기능입니다.', 403);
  return profile;
}

function examForTeacher(state, id) {
  const exam = state.exams.find(e => e.id === id);
  if (!exam) fail('시험을 찾을 수 없습니다.', 404);
  return exam;
}

function attemptSummary(a) {
  if (!a) return null;
  return {
    id: a.id,
    status: a.status,
    started_at: a.started_at || null,
    deadline: a.deadline || null,
    submitted_at: a.submitted_at || null,
    auto_submitted: !!a.auto_submitted,
    score: Number.isFinite(a.score) ? a.score : null,
    correct: Number.isFinite(a.correct) ? a.correct : null,
    total: Array.isArray(a.questions) ? a.questions.length : null
  };
}

function roster(state, exam) {
  const archived = Array.isArray(state.examAttemptArchive) ? state.examAttemptArchive : [];
  const candidates = state.profiles.filter(p => p.role === 'student' && p.class_name === exam.class_name && p.school === exam.school && (p.active || state.examAttempts.some(a => a.exam_id === exam.id && a.student_id === p.id)));
  const students = candidates.map(student => {
    const attempts = state.examAttempts.filter(a => a.exam_id === exam.id && a.student_id === student.id).sort((a, b) => (b.submitted_at || b.started_at || 0) - (a.submitted_at || a.started_at || 0));
    const active = attempts.find(a => a.status === 'active');
    const submitted = attempts.find(a => a.status === 'submitted');
    const prior = archived.filter(a => a.exam_id === exam.id && a.student_id === student.id).sort((a, b) => (b.archived_at || 0) - (a.archived_at || 0));
    const latest = active || submitted || null;
    return {
      id: student.id,
      display_name: student.display_name,
      username: student.username,
      class_name: student.class_name,
      school: student.school,
      active: !!student.active,
      status: active ? 'active' : submitted ? 'submitted' : 'not_started',
      attempts_used: attempts.length,
      attempt: attemptSummary(latest),
      previous: prior.slice(0, 5).map(attemptSummary)
    };
  }).sort((a, b) => a.display_name.localeCompare(b.display_name, 'ko'));
  const counts = {
    total: students.length,
    not_started: students.filter(s => s.status === 'not_started').length,
    active: students.filter(s => s.status === 'active').length,
    submitted: students.filter(s => s.status === 'submitted').length
  };
  return {
    exam: {
      id: exam.id,
      title: exam.title,
      school: exam.school,
      class_name: exam.class_name,
      active: !!exam.active,
      available_at: exam.available_at,
      due_at: exam.due_at,
      passing_score: exam.passing_score,
      max_attempts: exam.max_attempts,
      release_result: !!exam.release_result,
      exam_type: exam.exam_type,
      question_count: exam.question_count,
      duration_sec: exam.duration_sec
    },
    counts,
    students
  };
}

export async function examAdmin(state, method, path, body, token) {
  if (!path.startsWith('/admin/exams/')) return undefined;
  teacherFromToken(state, token);
  const parts = path.split('/').filter(Boolean);
  const examId = parts[2];
  const action = parts[3] || '';
  const exam = examForTeacher(state, examId);

  if (method === 'GET' && action === 'roster') return roster(state, exam);

  if (method === 'POST' && action === 'retry') {
    const studentId = String(body.student_id || '');
    const student = state.profiles.find(p => p.id === studentId && p.role === 'student');
    if (!student) fail('학생을 찾을 수 없습니다.', 404);
    const related = state.examAttempts.filter(a => a.exam_id === exam.id && a.student_id === studentId);
    if (related.some(a => a.status === 'active')) fail('현재 응시 중인 학생은 재응시로 변경할 수 없습니다.', 409);
    const latest = related.filter(a => a.status === 'submitted').sort((a, b) => (b.submitted_at || 0) - (a.submitted_at || 0))[0];
    if (!latest) fail('제출된 응시 기록이 없습니다.');
    state.examAttemptArchive ??= [];
    state.examAttemptArchive.push({ ...structuredClone(latest), archived_at: Date.now(), archived_by: teacherFromToken(state, token).id });
    state.examAttempts = state.examAttempts.filter(a => a !== latest);
    return { ok: true, archived_score: latest.score, roster: roster(state, exam) };
  }

  if (method === 'POST' && action === 'extend') {
    const minutes = Number(body.minutes);
    if (!Number.isInteger(minutes) || minutes < 5 || minutes > 10080) fail('연장 시간을 확인해주세요.');
    exam.due_at = Math.max(Number(exam.due_at) || 0, Date.now()) + minutes * 60000;
    exam.active = true;
    return { ok: true, due_at: exam.due_at, roster: roster(state, exam) };
  }

  fail('요청한 시험 운영 기능을 찾을 수 없습니다.', 404);
}
