import { hashToken } from './auth.mjs';
import { meaningReviewCandidate } from './meaning-review.mjs';

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

function pendingReviewCount(a, exam) {
  if (!a || a.status !== 'submitted' || exam.exam_type !== 'write_meaning' || !Array.isArray(a.details)) return 0;
  return a.details.filter(d => !d.correct && !d.reviewed_at && meaningReviewCandidate(d.answer, d.meaning)).length;
}

function attemptSummary(a, exam) {
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
    total: Array.isArray(a.questions) ? a.questions.length : null,
    review_pending: pendingReviewCount(a, exam)
  };
}

function attemptDetails(a, exam) {
  return (a.details || []).map(d => ({
    ...d,
    review_needed: exam.exam_type === 'write_meaning' && !d.correct && !d.reviewed_at && meaningReviewCandidate(d.answer, d.meaning),
    teacher_reviewed: !!d.reviewed_at,
    reviewed_at: d.reviewed_at || null
  }));
}

function recalcAttempt(a) {
  a.correct = (a.details || []).filter(d => d.correct).length;
  a.score = a.questions?.length ? Math.round(a.correct / a.questions.length * 100) : 0;
}

function attemptForExam(state, exam, attemptId) {
  const attempt = state.examAttempts.find(a => a.id === attemptId && a.exam_id === exam.id);
  if (!attempt) fail('응시 기록을 찾을 수 없습니다.', 404);
  return attempt;
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
      attempt: attemptSummary(latest, exam),
      previous: prior.slice(0, 5).map(a => attemptSummary(a, exam))
    };
  }).sort((a, b) => a.display_name.localeCompare(b.display_name, 'ko'));
  const counts = {
    total: students.length,
    not_started: students.filter(s => s.status === 'not_started').length,
    active: students.filter(s => s.status === 'active').length,
    submitted: students.filter(s => s.status === 'submitted').length,
    review_pending: students.reduce((sum, s) => sum + Number(s.attempt?.review_pending || 0), 0)
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
  const teacher = teacherFromToken(state, token);
  const parts = path.split('/').filter(Boolean);
  const examId = parts[2];
  const action = parts[3] || '';
  const exam = examForTeacher(state, examId);

  if (method === 'GET' && action === 'roster') return roster(state, exam);

  if (method === 'GET' && action === 'attempt') {
    const attempt = attemptForExam(state, exam, parts[4]);
    if (attempt.status !== 'submitted') fail('제출된 답안만 확인할 수 있습니다.', 409);
    return { exam: { id: exam.id, title: exam.title, exam_type: exam.exam_type, passing_score: exam.passing_score }, attempt: { ...attemptSummary(attempt, exam), details: attemptDetails(attempt, exam) } };
  }

  if (method === 'POST' && action === 'regrade') {
    if (exam.exam_type !== 'write_meaning') fail('뜻쓰기 시험만 수동 재채점할 수 있습니다.');
    const attempt = attemptForExam(state, exam, String(body.attempt_id || ''));
    if (attempt.status !== 'submitted') fail('제출된 답안만 재채점할 수 있습니다.', 409);
    const number = Number(body.number);
    if (!Number.isInteger(number) || number < 1 || number > (attempt.details || []).length || typeof body.correct !== 'boolean') fail('재채점 내용을 확인해주세요.');
    const detail = attempt.details.find(d => Number(d.number) === number);
    if (!detail) fail('문항을 찾을 수 없습니다.', 404);
    detail.correct = body.correct;
    detail.reviewed_at = Date.now();
    detail.reviewed_by = teacher.id;
    detail.review_source = 'teacher';
    recalcAttempt(attempt);
    return { ok: true, exam: { id: exam.id, title: exam.title, exam_type: exam.exam_type, passing_score: exam.passing_score }, attempt: { ...attemptSummary(attempt, exam), details: attemptDetails(attempt, exam) } };
  }

  if (method === 'POST' && action === 'retry') {
    const studentId = String(body.student_id || '');
    const student = state.profiles.find(p => p.id === studentId && p.role === 'student');
    if (!student) fail('학생을 찾을 수 없습니다.', 404);
    const related = state.examAttempts.filter(a => a.exam_id === exam.id && a.student_id === studentId);
    if (related.some(a => a.status === 'active')) fail('현재 응시 중인 학생은 재응시로 변경할 수 없습니다.', 409);
    const latest = related.filter(a => a.status === 'submitted').sort((a, b) => (b.submitted_at || 0) - (a.submitted_at || 0))[0];
    if (!latest) fail('제출된 응시 기록이 없습니다.');
    state.examAttemptArchive ??= [];
    state.examAttemptArchive.push({ ...structuredClone(latest), archived_at: Date.now(), archived_by: teacher.id });
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
