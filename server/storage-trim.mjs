// V13.131 오래된 기록 줄이기(선생님 확정 2026-10-10).
// - 연습 기록(sessions): 90일이 지나면 answer_records · wrong_details · word_ids를 지운다.
//   날짜 · 범위 · 문제 수 · 정답 수 · 점수 · 경험치 · 코인 · 최고 콤보 같은 합계는 그대로 남긴다.
// - 시험 응시(examAttempts): 시험이 끝나고(마감 · 제출 중 늦은 때) 30일 뒤 questions · keys를 지운다.
//   details · 점수 · 보상은 남기고, 문제 수는 total로 옮겨 둔다.
// - 처리 안 된 이의 신청이 걸린 기록, 선생님 재채점(검토)이 남은 시험은 지우지 않는다.
// - 지우기 전에 선생님이 지울 내용 전체를 JSON 보관 파일로 받는다. 정리는 그 파일의 지문(fingerprint)이
//   지금 대상과 똑같을 때만 한다(받은 뒤에 대상이 바뀌었으면 다시 받게 한다).
// V13.168 연습 기록 자동 정리(선생님 확정 2026-10-21): 한 달(30일)이 지난 연습 기록은 sweep이 위와 같은 규칙
//   (처리 안 된 이의 신청 제외 · 오답/미응답 수를 칸으로 남김)으로 answer_records · wrong_details · word_ids를 지운다
//   (autoTrimSessions). 한 번에 학생 AUTO_TRIM_STUDENTS명까지만 바꾸고, 남으면 다음 정리(한 시간 뒤)에 이어서 한다.
//   결과 분석 · 성장 · 순위 · 칭호 · 통계 · 경험치 · 코인은 모두 요약 칸(total · correct · score · xp · reward_points ·
//   answered_count · perfect · best_combo …)에서 계산해서 그대로다(server/auto-trim-check.mjs가 전후를 비교한다).
//   시험 응시(examAttempts)는 저절로 지우지 않는다(수동 정리만).
import { createHash } from 'node:crypto';
import { meaningReviewCandidate } from './meaning-review.mjs';

export const DAY = 86400000;
export const SESSION_DETAIL_KEEP_MS = 90 * DAY;
export const EXAM_DETAIL_KEEP_MS = 30 * DAY;
export const SESSION_DETAIL_FIELDS = ['answer_records', 'wrong_details', 'word_ids'];
export const EXAM_DETAIL_FIELDS = ['questions', 'keys'];
// 보관 파일을 받은 뒤 이 시간 안에 정리해야 한다(오래된 파일로 지우지 않게).
export const ARCHIVE_VALID_MS = 30 * 60000;

const hasAny = (record, fields) => fields.some(key => record[key] !== undefined);
const inSchools = (schoolIds, id) => !schoolIds || schoolIds.has(id);

// 시험이 끝난 때: 시험 마감과 이 응시의 제출 중 늦은 쪽(시험이 지워졌으면 제출 시각).
export function examEndedAt(attempt, exam) {
  return Math.max(Number(exam?.due_at || 0), Number(attempt.submitted_at || 0));
}

function pendingDisputeSources(state, type) {
  return new Set((state.meaningDisputes || []).filter(d => d.status === 'pending' && d.source_type === type).map(d => d.source_id));
}

// 선생님이 아직 보지 않은 뜻쓰기 검토 문항(재채점 중): exam-admin.mjs의 pendingReviewCount와 같은 규칙.
function reviewPending(attempt, exam) {
  if (exam?.exam_type !== 'write_meaning' || !Array.isArray(attempt.details)) return false;
  return attempt.details.some(d => !d.correct && !d.reviewed_at && meaningReviewCandidate(d.answer, d.meaning));
}

// 연습 기록 정리 대상: keepMs보다 오래됐고, 지울 칸이 있고, 처리 안 된 이의 신청이 걸리지 않은 기록(수동 · 자동 같은 규칙).
function sessionCandidates(state, now, schoolIds, keepMs) {
  const practiceDisputes = pendingDisputeSources(state, 'practice');
  return (state.sessions || []).filter(s =>
    s && Number(s.created_at || 0) <= now - keepMs
    && hasAny(s, SESSION_DETAIL_FIELDS)
    && !practiceDisputes.has(s.id)
    && inSchools(schoolIds, s.school_id));
}

// 지금(now) 정리할 수 있는 기록. schoolIds를 주면 그 학교 기록만(선생님이 맡은 학교).
export function trimCandidates(state, now = Date.now(), schoolIds = null) {
  const examDisputes = pendingDisputeSources(state, 'exam');
  const exams = new Map((state.exams || []).map(e => [e.id, e]));
  const sessions = sessionCandidates(state, now, schoolIds, SESSION_DETAIL_KEEP_MS);
  const attempts = (state.examAttempts || []).filter(a => {
    if (a.status !== 'submitted' || !hasAny(a, EXAM_DETAIL_FIELDS)) return false;
    const exam = exams.get(a.exam_id);
    if (!inSchools(schoolIds, exam?.school_id)) return false;
    if (examEndedAt(a, exam) > now - EXAM_DETAIL_KEEP_MS) return false;
    return !examDisputes.has(a.id) && !reviewPending(a, exam);
  });
  return { sessions, attempts };
}

// 대상이 똑같은지 보는 지문: 기록 id와 지울 칸의 내용 전체.
export function fingerprintOf({ sessions, attempts }) {
  const hash = createHash('sha256');
  for (const s of sessions) hash.update(`s:${s.id}:${JSON.stringify(SESSION_DETAIL_FIELDS.map(key => s[key] ?? null))}\n`);
  for (const a of attempts) hash.update(`a:${a.id}:${JSON.stringify(EXAM_DETAIL_FIELDS.map(key => a[key] ?? null))}\n`);
  return hash.digest('hex');
}

const bytesOf = (records, fields) => records.reduce((n, r) => n + fields.reduce((m, key) => m + (r[key] === undefined ? 0 : JSON.stringify(r[key]).length), 0), 0);

export function trimSummary(state, now = Date.now(), schoolIds = null) {
  const found = trimCandidates(state, now, schoolIds);
  return {
    at: now,
    sessions: found.sessions.length,
    attempts: found.attempts.length,
    kb: Math.round((bytesOf(found.sessions, SESSION_DETAIL_FIELDS) + bytesOf(found.attempts, EXAM_DETAIL_FIELDS)) / 1024),
    fingerprint: fingerprintOf(found),
    rules: { session_days: SESSION_DETAIL_KEEP_MS / DAY, exam_days: EXAM_DETAIL_KEEP_MS / DAY }
  };
}

// 보관 파일: 지울 내용 전체와, 어느 기록인지 알아볼 수 있는 합계 칸. hydrate는 줄인 답 기록에 단어 · 뜻을 다시 채운다.
export function trimArchive(state, now = Date.now(), schoolIds = null, { hydrate = s => s } = {}) {
  const found = trimCandidates(state, now, schoolIds);
  const names = new Map((state.profiles || []).map(p => [p.id, p]));
  const exams = new Map((state.exams || []).map(e => [e.id, e]));
  const person = id => ({ student_id: id, student_name: names.get(id)?.display_name || '', class_name: names.get(id)?.class_name || '' });
  return {
    kind: 'sumus-voca-trim-archive',
    created_at: now,
    fingerprint: fingerprintOf(found),
    rules: { session_days: SESSION_DETAIL_KEEP_MS / DAY, exam_days: EXAM_DETAIL_KEEP_MS / DAY, session_fields: SESSION_DETAIL_FIELDS, exam_fields: EXAM_DETAIL_FIELDS },
    counts: { sessions: found.sessions.length, attempts: found.attempts.length },
    sessions: found.sessions.map(s => {
      const full = hydrate(s);
      return { id: s.id, ...person(s.student_id), school: s.school || '', created_at: s.created_at, mode: s.mode, run_mode: s.run_mode, range_codes: s.range_codes || [], total: s.total, correct: s.correct, score: s.score, ...Object.fromEntries(SESSION_DETAIL_FIELDS.map(key => [key, full[key] ?? null])) };
    }),
    exam_attempts: found.attempts.map(a => ({ id: a.id, exam_id: a.exam_id, exam_title: exams.get(a.exam_id)?.title || '', ...person(a.student_id), submitted_at: a.submitted_at, score: a.score, correct: a.correct, ...Object.fromEntries(EXAM_DETAIL_FIELDS.map(key => [key, a[key] ?? null])) }))
  };
}

// 화면이 연습 기록의 오답 · 미응답 수를 답 기록에서 세던 것(sessions.js)을 지우기 전에 칸으로 남긴다.
function keepCounts(s) {
  const records = Array.isArray(s.answer_records) ? s.answer_records : [];
  if (!Number.isFinite(Number(s.wrong_count)) || s.wrong_count === null) {
    const wrong = records.length ? records.filter(r => r?.correct === false && !r.regraded && !r.timed_out) : (s.wrong_details || []).filter(r => r && !r.regraded && !r.timed_out);
    s.wrong_count = wrong.length;
  }
  if (!Number.isFinite(Number(s.unanswered_count)) || s.unanswered_count === null) {
    const timedOut = records.filter(r => r?.timed_out && !r.regraded).length;
    s.unanswered_count = timedOut + Math.max(0, Number(s.total || 0) - records.length);
  }
}

// 연습 기록 하나의 답 기록을 지운다(수동 · 자동 같은 규칙). s는 고쳐도 되는 사본이어야 한다.
function trimSessionDetails(s, now) {
  keepCounts(s);
  for (const key of SESSION_DETAIL_FIELDS) delete s[key];
  s.details_trimmed_at = now;
  return s;
}

// 정리: archive_at(보관 파일을 만든 시각) 기준 대상이 받은 파일의 지문과 같을 때만 지운다.
export function trimRecords(state, { fingerprint, archived_at } = {}, now = Date.now(), schoolIds = null, by = null) {
  const at = Number(archived_at);
  if (!fingerprint || !Number.isFinite(at) || at > now || now - at > ARCHIVE_VALID_MS) {
    throw Object.assign(Error('보관 파일을 다시 내려받은 뒤 정리해 주세요.'), { status: 409 });
  }
  const found = trimCandidates(state, at, schoolIds);
  if (fingerprintOf(found) !== fingerprint) {
    throw Object.assign(Error('보관 파일을 받은 뒤 기록이 바뀌었어요. 보관 파일을 다시 내려받아 주세요.'), { status: 409 });
  }
  const kb = Math.round((bytesOf(found.sessions, SESSION_DETAIL_FIELDS) + bytesOf(found.attempts, EXAM_DETAIL_FIELDS)) / 1024);
  // 기록 객체는 새로 만들어 바꾼다(지난 기록은 얼려 두고 다음 상태와 같이 쓴다: server/mutation-coordinator.mjs).
  const trimmed = new Map(found.sessions.map(s => [s, trimSessionDetails(structuredClone(s), now)]));
  if (trimmed.size) state.sessions = state.sessions.map(s => trimmed.get(s) || s);
  for (const a of found.attempts) {
    if (!Number.isFinite(Number(a.total)) && Array.isArray(a.questions)) a.total = a.questions.length;
    for (const key of EXAM_DETAIL_FIELDS) delete a[key];
    a.questions_trimmed_at = now;
  }
  const entry = { at: now, by, sessions: found.sessions.length, attempts: found.attempts.length, kb, fingerprint };
  state.storageTrims = [...(state.storageTrims || []), entry].slice(-20);
  return entry;
}

// 시험 응시의 문제 수: 정리한 응시는 questions 대신 total을 본다.
export const attemptTotal = a => Array.isArray(a?.questions) ? a.questions.length : Number(a?.total || 0);

// ---- V13.168 자동 정리 ------------------------------------------------------------------------
export const AUTO_SESSION_KEEP_MS = 30 * DAY;
// 한 번에 바꾸는 학생 수: 학생마다 그 학생의 연습 기록 조각(cloudflare/state-parts.mjs) 몇 줄을 다시 쓴다.
export const AUTO_TRIM_STUDENTS = 25;
// 다 정리한 뒤에는 하루에 한 번만 본다(남은 것이 있으면 다음 정리 때 바로 이어서).
export const AUTO_TRIM_EVERY_MS = 20 * 3600000;

export function autoTrimDue(state, now = Date.now()) {
  const last = state.storageAutoTrim;
  const at = Number(last?.at || 0);
  return !last || !!last.more || now - at >= AUTO_TRIM_EVERY_MS || at > now;
}

// 지난 연습 기록을 자동으로 줄인다(sweep이 부른다). 바꾼 것이 있거나 정리 시각을 적었으면 true.
export function autoTrimSessions(state, now = Date.now(), { students = AUTO_TRIM_STUDENTS } = {}) {
  if (!Array.isArray(state.sessions) || !autoTrimDue(state, now)) return false;
  const found = sessionCandidates(state, now, null, AUTO_SESSION_KEEP_MS);
  const picked = new Set();
  for (const s of found) {
    if (picked.size >= students && !picked.has(String(s.student_id ?? '_'))) continue;
    picked.add(String(s.student_id ?? '_'));
  }
  const chosen = found.filter(s => picked.has(String(s.student_id ?? '_')));
  const bytes = bytesOf(chosen, SESSION_DETAIL_FIELDS);
  const trimmed = new Map(chosen.map(s => [s, trimSessionDetails(structuredClone(s), now)]));
  if (trimmed.size) state.sessions = state.sessions.map(s => trimmed.get(s) || s);
  const prev = state.storageAutoTrim || {};
  const kb = Math.round(bytes / 1024);
  state.storageAutoTrim = {
    at: now,
    more: found.length > chosen.length,
    keep_days: AUTO_SESSION_KEEP_MS / DAY,
    last: { sessions: chosen.length, students: picked.size, kb },
    total_sessions: Number(prev.total_sessions || 0) + chosen.length,
    total_kb: Number(prev.total_kb || 0) + kb
  };
  return true;
}
