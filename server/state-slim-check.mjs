// V13.215 지난 연습 기록 보관(server/session-archive.mjs) 검사. release-check가 부르고, 혼자 돌리면 숫자를 보여 준다.
// A. 같음: 운영 비율(2026-11-03 /api/health: 학생 44명 · 기록 2,991개 · 답 상세 비율)에 맞춘 합성 상태에서, 옮기기 전과 다 옮긴 뒤
//    학생 44명 모두의 첫 화면(bootstrap: 코인 · 경험치 · 레벨 · 칭호 · 펫 · 순위 · 통계 · 오늘의 학습)과 보상 · 리그 · 대결 기록,
//    선생님 첫 화면(결과 분석 · 학생 관리 통계 · 기록 목록) · 반 리그 · TV · 보관 파일 내보내기가 한 글자도 같다.
//    학생 목록의 기록 한 줄은 답 상세만 빠지고(요약은 같음), 모든 기록의 답안 보기(GET /sessions/:id)는 한 글자도 같다.
// B. 옮기기 규칙: 한 번에 300개 · 학생 25명까지 · 일주일 안 기록 · 처리 안 된 이의 신청 · 요약 없는 옛 기록 · 너무 큰 기록은 그대로,
//    보관 글이 다르면 빼지 않음, 같은 계획 두 번 · 다 한 뒤 다시 해도 같은 상태, 되돌리기는 처음 상태와 한 글자도 같다.
// C. 권한: 답안 보기는 본인과 그 학교 선생님만. 이의 신청은 보관에서 되돌린 뒤 예전과 같은 결과.
// D. 부팅 때 보관 표를 읽지 않는다 · 워커는 'ok' 날만 옮기고 30일 자동 삭제는 껐다 · 크기 상한 · health 표시.
import crypto from 'node:crypto';
import { syncBuiltinESMExports } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { hashToken } from './auth.mjs';
import { service, allBooks } from './service.mjs';
import { prodLikeState } from './tournament-load.mjs';
import { createMutationCoordinator, NO_MUTATION } from './mutation-coordinator.mjs';
import { createLocalRepository } from '../cloudflare/local-first.mjs';
import { createSessionArchive } from '../cloudflare/session-archive-store.mjs';
import { createStorageMock } from './storage-mock.mjs';
import { stateSizeReport } from './state.mjs';
import { stateBudgetReport, STATE_BUDGET_KB } from './perf-budget.mjs';
import {
  planArchive, applyArchive, runArchiveStep, archiveText, planRestore, applyRestore, isArchived, archiveDue,
  ARCHIVE_AFTER_MS, ARCHIVE_PER_RUN, ARCHIVE_STUDENTS_PER_RUN, ARCHIVE_ROW_MAX_CHARS, ARCHIVE_FIELDS, ARCHIVE_MORE_EVERY_MS, ARCHIVE_EVERY_MS
} from './session-archive.mjs';

const DAY = 86400000;
const source = path => readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8');
const kb = value => Math.round(JSON.stringify(value).length / 1024);

// 고정 시계 · 난수(요청마다 같은 자리에서 시작).
let seed = 1;
const real = { now: Date.now, random: Math.random, randomUUID: crypto.randomUUID };
const next = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff);
// service는 같은 판 안에서 끝나지 않는 일(타이머)을 남기지 않으므로, 답이 돌아온 뒤에 되돌린다.
const pinned = async (at, fn) => {
  seed = 4242; Date.now = () => at; Math.random = () => next() / 0x80000000;
  crypto.randomUUID = () => { const h = Array.from({ length: 32 }, () => (next() & 15).toString(16)).join(''); return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`; };
  syncBuiltinESMExports();
  try { return await fn(); } finally { Date.now = real.now; Math.random = real.random; crypto.randomUUID = real.randomUUID; syncBuiltinESMExports(); }
};

// 운영 비율 합성 상태: 기록 하나당 answer_records 약 2.1KB · wrong_details 0.33KB · word_ids 0.14KB · reward_breakdown 0.03KB.
export function slimState(now, { students = 44, sessions = 2991 } = {}) {
  const state = prodLikeState({ students, sessions: 0, now });
  const words = allBooks(state).filter(b => b.school_id === 'gangseo-high').flatMap(b => b.words || []).slice(0, 400);
  state.profiles.push({ id: 'ss-t', username: 'ss-t', display_name: '선생님', role: 'teacher', active: true, school_ids: ['gangseo-high'], active_school_id: 'gangseo-high', division: 'high', created_at: now - 90 * DAY });
  state.profiles.push({ id: 'ss-other', username: 'ss-other', display_name: '다른 학교 선생님', role: 'teacher', active: true, school_ids: ['danwon-high'], active_school_id: 'danwon-high', division: 'high', created_at: now - 90 * DAY });
  for (const id of ['ss-t', 'ss-other']) state.tokens.push({ hash: hashToken('sl-token-' + id), user_id: id, expires_at: now + 30 * DAY });
  for (const t of state.tokens) t.expires_at = now + 30 * DAY;
  state.meaningDisputes = state.meaningDisputes.map(d => ({ ...d, status: 'approved_once' }));
  const word = k => words[k % words.length];
  for (let i = 0; i < sessions; i++) {
    const sid = `sl-${i % students}`, n = 10 + (i % 3) * 3, right = Math.max(0, n - (i % 5));
    // 하루 0~30일 전에 고르게(운영: 30일 자동 정리 뒤 남은 기록).
    const created = now - (i % 31) * DAY - (i % 17) * 3600000 - 60000;
    const records = Array.from({ length: n }, (_, k) => {
      const w = word(i * 3 + k), ok = k >= n - right || k % 2 === 1;
      return { question_id: `q-${i}-${k}`, word_id: w.id, type: 'write_meaning', mode: 'write_meaning', answer: ok ? w.meaning : '모르는 뜻', correct: k >= n - right, ms: 1800 + k * 37, at: created - (n - k) * 4000 };
    });
    const wrong = records.filter(r => !r.correct);
    state.sessions.push({
      id: `ss-${i}`, student_id: sid, division: 'high', school_id: 'gangseo-high', school: '강서고', grade: '고1A', daily_quest: i % 5 === 0,
      range_codes: [String(word(i).range_code)], mode: 'write_meaning', run_mode: i % 9 === 0 ? 'test' : 'practice', exam_style: false,
      correct: right, total: n, attempts_total: n, answered_count: n, score: Math.round(right / n * 100), wrong_count: wrong.length, unanswered_count: 0,
      perfect: right === n, xp: right * 10, pet_key: 'dog', reward_points: right / n >= 0.6 ? 3 + (i % 4) : 0,
      reward_breakdown: right / n >= 0.6 ? [{ label: '학습 완료', points: 3 }, ...(i % 4 ? [{ label: '오늘 첫 학습', points: i % 4 }] : [])] : [],
      best_combo: right, duration_sec: n * 4, limit_sec: 0, timer_mode: 'session', question_duration_sec: 0, auto_submitted: false,
      ended_at: created, finalized_at: created, shared_to_teacher_at: null,
      answer_records: records, word_ids: wrong.slice(0, 3).map(r => r.word_id), wrong_details: wrong.slice(0, 4).map(r => ({ question_id: r.question_id, word_id: r.word_id, word: displayWord(word(i)), meaning: word(i).meaning, answer: r.answer, type: 'write_meaning' })),
      created_at: created
    });
  }
  return state;
}
const displayWord = w => String(w.word || '');

// 보관 표 대신(검사용): put/get만.
const memoryArchive = () => { const rows = new Map(); return { rows, put(entries) { for (const e of entries) rows.set(e.id, e.text); return entries.length; }, get: id => rows.get(id) ?? null }; };

const call = (state, who, method, path, body = {}, archive = null, at) => pinned(at, () => service(state, method, path, body, 'sl-token-' + who, { archive }));
const settle = async promise => { try { return await promise; } catch (error) { return { error: error.message, status: error.status }; } };
const stripDetails = boot => {
  const copy = JSON.parse(JSON.stringify(boot));
  for (const s of copy.sessions || []) { for (const key of [...ARCHIVE_FIELDS, 'details_omitted']) delete s[key]; }
  return JSON.stringify(copy);
};

// 화면 출력 모음: 학생마다 · 선생님 · 기록마다.
async function screens(state, archive, at) {
  const students = state.profiles.filter(p => p.role === 'student').map(p => p.id);
  const out = { students: {}, teacher: {}, records: {} };
  for (const id of students) {
    const boot = await settle(call(state, id, 'GET', '/bootstrap', {}, archive, at));
    out.students[id] = {
      boot: stripDetails(boot), numbers: JSON.stringify({ profile: boot.profile, stats: boot.stats, daily_quest: boot.daily_quest }),
      rewards: JSON.stringify(await settle(call(state, id, 'GET', '/rewards', {}, archive, at))),
      league: JSON.stringify(await settle(call(state, id, 'GET', '/battle/league', {}, archive, at))),
      history: JSON.stringify(await settle(call(state, id, 'GET', '/battle/history', {}, archive, at)))
    };
  }
  for (const path of ['/bootstrap', '/teacher/class-league', '/tv/classes', '/teacher/storage-archive']) out.teacher[path] = JSON.stringify(await settle(call(state, 'ss-t', 'GET', path, {}, archive, at)));
  for (const s of state.sessions) out.records[s.id] = JSON.stringify(await settle(call(state, s.student_id, 'GET', `/sessions/${s.id}`, {}, archive, at)));
  return out;
}

function compare(before, after) {
  const diffs = [];
  for (const [id, b] of Object.entries(before.students)) for (const key of Object.keys(b)) if (after.students[id]?.[key] !== b[key]) diffs.push(`학생 ${id} ${key}`);
  for (const [path, b] of Object.entries(before.teacher)) if (after.teacher[path] !== b) diffs.push(`선생님 ${path}`);
  for (const [id, b] of Object.entries(before.records)) if (after.records[id] !== b) diffs.push(`답안 보기 ${id}`);
  return diffs;
}

export async function runStateSlimChecks(assert, { verbose = false } = {}) {
  const now = Date.UTC(2026, 10, 3, 3, 0, 0);
  const report = {};

  /* ---------- A. 운영 크기에서 같음 ---------- */
  const state = slimState(now);
  // 옮기지 않아야 하는 기록: 처리 안 된 이의 신청 · 요약 없는 옛 기록 · 너무 큰 기록 · 이미 정리된 기록.
  const pendingId = state.sessions.find(s => s.student_id === 'sl-3' && s.created_at < now - 20 * DAY && s.answer_records.some(r => !r.correct)).id;
  const pendingRecord = state.sessions.find(s => s.id === pendingId).answer_records.find(r => !r.correct);
  state.meaningDisputes.push({ id: 'ss-pending', student_id: 'sl-3', source_type: 'practice', source_id: pendingId, source_key: pendingRecord.question_id, question_id: pendingRecord.question_id, word_id: pendingRecord.word_id, answer: pendingRecord.answer, status: 'pending', school_id: 'gangseo-high', division: 'high', created_at: now - DAY });
  const legacy = state.sessions.find(s => s.student_id === 'sl-4' && s.created_at < now - 20 * DAY); delete legacy.wrong_count;
  const huge = state.sessions.find(s => s.student_id === 'sl-5' && s.created_at < now - 20 * DAY);
  huge.answer_records = Array.from({ length: 500 }, (_, k) => ({ ...huge.answer_records[0], question_id: `big-${k}`, answer: '아주 긴 답'.repeat(200) }));
  const trimmed = state.sessions.find(s => s.student_id === 'sl-6' && s.created_at < now - 20 * DAY);
  for (const key of ARCHIVE_FIELDS) delete trimmed[key]; trimmed.details_trimmed_at = now - 2 * DAY;
  const original = JSON.stringify(state);
  const size0 = stateSizeReport(state);
  report.before = { state_kb: kb(state), sessions_kb: size0.keys_kb.sessions, ...size0.sessions };
  const before = await screens(state, null, now);

  // 워커처럼 실제 coordinator · 로컬 저장소(SQLite 모의) · 보관 표로 다 옮길 때까지.
  const storage = createStorageMock();
  const local = createLocalRepository(storage, { log: { warn() {}, error() {} } });
  local.adoptRemote(JSON.parse(original), 1);
  const archive = createSessionArchive(storage, { countRows: rows => local.countRows(rows) });
  const c = createMutationCoordinator(local, await local.read(), { flushDelay: 20, rollbackOnFailure: true, onError() {} });
  const rows0 = storage.rowsWritten;
  let runs = 0, moved = 0, maxPlan = 0, maxStudents = 0;
  for (; runs < 40; runs++) {
    const plan = planArchive(c.current().state, now);
    maxPlan = Math.max(maxPlan, plan.entries.length); maxStudents = Math.max(maxStudents, plan.students);
    const r = await runArchiveStep({ state: c.current().state, archive, mutate: fn => c.durable(fn), now, mode: 'on', noMutation: NO_MUTATION });
    moved += r.moved;
    if (!r.moved) break;
  }
  await c.flush();
  const slim = c.current().state;
  const size1 = stateSizeReport(slim);
  const cold = archive.stats();
  report.after = { state_kb: kb(slim), sessions_kb: size1.keys_kb.sessions, ...size1.sessions, archive: cold, runs, rows_written: storage.rowsWritten - rows0, frozen_retries: c.stats().frozen_retries };
  report.drop_pct = Math.round((1 - size1.keys_kb.sessions / size0.keys_kb.sessions) * 100);
  assert(report.drop_pct >= 50, `V13.215 지난 연습 기록(sessions)이 50% 넘게 준다(${size0.keys_kb.sessions}KB → ${size1.keys_kb.sessions}KB, ${report.drop_pct}%)`);
  assert(maxPlan <= ARCHIVE_PER_RUN && maxStudents <= ARCHIVE_STUDENTS_PER_RUN && runs > 1, `V13.215 한 번에 ${ARCHIVE_PER_RUN}개 · 학생 ${ARCHIVE_STUDENTS_PER_RUN}명까지 조금씩 옮긴다(${runs}번)`);
  assert(c.stats().frozen_retries === 0, 'V13.215 옮기기는 얼린 기록을 고치지 않는다(새 객체로 바꿔 넣는다)');
  const expectMoved = JSON.parse(original).sessions.filter(s => s.created_at <= now - ARCHIVE_AFTER_MS).length - 4;
  assert(moved === expectMoved && slim.sessions.filter(isArchived).length === moved && cold.sessions === moved, `V13.215 일주일 지난 기록 ${expectMoved}개를 옮긴다(옮김 ${moved} · 보관 ${cold.sessions})`);
  const byId = new Map(slim.sessions.map(s => [s.id, s]));
  assert(!isArchived(byId.get(pendingId)) && byId.get(pendingId).answer_records, 'V13.215 처리 안 된 이의 신청이 걸린 기록은 옮기지 않는다');
  assert(!isArchived(byId.get(legacy.id)) && !isArchived(byId.get(huge.id)) && !isArchived(byId.get(trimmed.id)), 'V13.215 요약 없는 옛 기록 · 너무 큰 기록 · 이미 정리된 기록은 그대로');
  assert(archiveText(huge).length > ARCHIVE_ROW_MAX_CHARS, 'V13.215 (검사 준비) 큰 기록은 보관 줄 상한을 넘는다');
  assert(slim.sessions.filter(s => s.created_at > now - ARCHIVE_AFTER_MS).every(s => !isArchived(s) && s.answer_records), 'V13.215 일주일 안 기록은 메인 상태에 그대로(오늘 보상 · 바로 다시 풀기)');
  assert(slim.sessions.filter(isArchived).every(s => ARCHIVE_FIELDS.every(k => s[k] === undefined) && Array.isArray(s.reward_breakdown) && Number.isFinite(s.wrong_count)), 'V13.215 옮긴 기록에는 요약 칸(보상 내역 · 오답 수 포함)이 남는다');

  const after = await screens(slim, archive, now);
  const diffs = compare(before, after);
  report.compared = { students: Object.keys(before.students).length, teacher_screens: Object.keys(before.teacher).length, records: Object.keys(before.records).length, diffs: diffs.length };
  assert(!diffs.length, `V13.215 옮기기 전 · 후 학생 · 선생님 화면과 답안 보기가 같다(다른 곳: ${diffs.slice(0, 5).join(', ')})`);
  assert(Object.keys(before.students).length === 44, 'V13.215 학생 44명 모두 비교한다');
  const sample = slim.sessions.find(isArchived);
  const listed = JSON.parse(after.students[sample.student_id].boot).sessions.find(s => s.id === sample.id);
  const listedRaw = (await call(slim, sample.student_id, 'GET', '/bootstrap', {}, archive, now)).sessions.find(s => s.id === sample.id);
  assert(listed && listedRaw.details_omitted === true && !listedRaw.answer_records && listedRaw.details_archived_at === undefined, 'V13.215 학생 목록의 옮긴 기록은 요약만(details_omitted: 화면이 열 때 한 개만 받는다) · 보관 표시는 보내지 않는다');
  assert(Buffer.byteLength(after.records[sample.id]) < 64 * 1024, 'V13.215 답안 보기 한 개는 작다(64KB 아래)');

  /* ---------- B. 다시 해도 같음 · 되돌리기 ---------- */
  const slimText = JSON.stringify(slim);
  const again = await runArchiveStep({ state: slim, archive, mutate: fn => c.durable(fn), now, mode: 'on', noMutation: NO_MUTATION });
  assert(again.moved === 0 && JSON.stringify(c.current().state) === slimText, 'V13.215 다 옮긴 뒤 다시 해도 아무것도 바뀌지 않는다');
  const twice = JSON.parse(original);
  const plan = planArchive(twice, now);
  assert(applyArchive(twice, plan.entries, now) === plan.entries.length && applyArchive(twice, plan.entries, now) === 0, 'V13.215 같은 계획을 두 번 해도 두 번째는 0개');
  const changed = JSON.parse(original);
  const p2 = planArchive(changed, now);
  changed.sessions.find(s => s.id === p2.entries[0].id).answer_records[0].correct = !changed.sessions.find(s => s.id === p2.entries[0].id).answer_records[0].correct;
  assert(applyArchive(changed, p2.entries, now) === p2.entries.length - 1 && !isArchived(changed.sessions.find(s => s.id === p2.entries[0].id)), 'V13.215 보관한 뒤 기록이 바뀌었으면(재채점 등) 그 기록은 빼지 않는다');
  // 되돌리기: 처음 상태와 한 글자도 같다(옮기기 기록 sessionArchive만 남는다).
  let back = JSON.parse(slimText);
  for (let i = 0; i < 40; i++) { const r = planRestore(back, archive); if (!r.entries.length) break; applyRestore(back, r.entries, now); }
  const { sessionArchive, ...restored } = back;
  // 맨 위 묶음 순서는 coordinator 복사가 바꾼다(sessions · mastery를 뒤로): 묶음마다 · 묶음 이름 모두 같은지 본다.
  const o = JSON.parse(original), same = Object.keys(o).length === Object.keys(restored).length && Object.keys(o).every(k => JSON.stringify(o[k]) === JSON.stringify(restored[k]));
  assert(same && sessionArchive.total_restored === moved, 'V13.215 되돌리기(VOCA_SESSION_ARCHIVE=restore)는 처음 상태와 한 글자도 같다');
  assert(archiveDue({ sessionArchive: { more: true } }, now, now - ARCHIVE_MORE_EVERY_MS) && !archiveDue({ sessionArchive: { more: false } }, now, now - ARCHIVE_MORE_EVERY_MS) && archiveDue({}, now, now - ARCHIVE_EVERY_MS), 'V13.215 남으면 10분 뒤 · 다 옮겼으면 한 시간 뒤에 다시 본다');

  /* ---------- C. 권한 · 이의 신청 ---------- */
  const other = slim.sessions.find(s => isArchived(s) && s.student_id !== sample.student_id);
  const denied = await settle(call(slim, sample.student_id, 'GET', `/sessions/${other.id}`, {}, archive, now));
  const otherTeacher = await settle(call(slim, 'ss-other', 'GET', `/sessions/${sample.id}`, {}, archive, now));
  const teacherView = await settle(call(slim, 'ss-t', 'GET', `/sessions/${sample.id}`, {}, archive, now));
  assert(denied.status === 404 && otherTeacher.status === 404, 'V13.215 보관한 답안 보기는 다른 학생 · 다른 학교 선생님에게 보이지 않는다');
  assert(JSON.stringify(teacherView) === before.records[sample.id], 'V13.215 그 학교 선생님은 보관한 답안을 본다(옮기기 전과 같다)');
  const noStore = await settle(call(slim, sample.student_id, 'GET', `/sessions/${sample.id}`, {}, null, now));
  assert(noStore.details_missing === true && noStore.score === sample.score, 'V13.215 보관 표가 없으면(로컬 Node 서버) 점수는 그대로 · 답안 없음 표시');
  // 옮긴 기록에 이의 신청: 옮기기 전과 같은 답 · 같은 기록.
  const target = slim.sessions.find(s => isArchived(s) && JSON.parse(original).sessions.find(o => o.id === s.id).answer_records.some(r => !r.correct));
  const wrongQ = JSON.parse(original).sessions.find(o => o.id === target.id).answer_records.find(r => !r.correct).question_id;
  const fresh = JSON.parse(original), moved2 = JSON.parse(JSON.stringify(slim));
  const body = { source_type: 'practice', source_id: target.id, question_id: wrongQ };
  const r1 = JSON.stringify(await settle(call(fresh, target.student_id, 'POST', '/meaning-disputes', body, null, now + 60000)));
  const r2 = JSON.stringify(await settle(call(moved2, target.student_id, 'POST', '/meaning-disputes', body, archive, now + 60000)));
  const s1 = JSON.stringify(fresh.sessions.find(s => s.id === target.id)), s2 = JSON.stringify(moved2.sessions.find(s => s.id === target.id));
  assert(r1 === r2 && !/"error"/.test(r1) && s1 === s2, `V13.215 옮긴 기록에 이의 신청: 보관에서 되돌린 뒤 옮기기 전과 같은 결과(${r1.slice(0, 120)})`);
  const stranger = JSON.parse(JSON.stringify(slim));
  const strangerId = target.student_id === 'sl-0' ? 'sl-1' : 'sl-0';
  const r3 = await settle(call(stranger, strangerId, 'POST', '/meaning-disputes', { ...body }, archive, now + 60000));
  assert(r3.status === 404 && isArchived(stranger.sessions.find(s => s.id === target.id)), 'V13.215 남의 기록에는 이의 신청도 되돌리기도 안 된다');

  /* ---------- D. 부팅 · 워커 · 크기 · health ---------- */
  const queries = [];
  const spy = { ...storage, sql: { exec: (q, ...b) => { queries.push(q); return storage.sql.exec(q, ...b); } } };
  const booted = createLocalRepository(spy, { log: { warn() {}, error() {} } });
  await booted.read();
  assert(!queries.some(q => /voca_archive/i.test(q)), 'V13.215 부팅(상태 읽기)은 보관 표를 읽지 않는다');
  const worker = source('../cloudflare/worker.mjs');
  assert(worker.includes("sweep(working, Date.now(), { autoTrim: false })") && worker.includes("sweep(state, Date.now(), { autoTrim: false })") && !/autoTrim: this\.writeLevel\(\)/.test(worker), 'V13.215 워커: 되돌릴 수 없는 30일 자동 정리(답 상세 지우기)는 끈다');
  assert(/archiveMode !== 'off' && this\.writeLevel\(\) === 'ok' && archiveDue\(/.test(worker), "V13.215 워커: 옮기기는 쓰기 한도가 넉넉한 날('ok')만");
  assert(worker.includes('archive: this.archive }') && worker.includes('this.archive.stats()'), 'V13.215 워커: 답안 보기 · 이의 신청이 보관 표를 쓰고 health에 보관 크기를 보인다');
  const bootBlock = worker.slice(worker.indexOf('this.ready = ctx.blockConcurrencyWhile'), worker.indexOf('writeLevel() {'));
  assert(!/this\.archive\.(get|stats)\(/.test(bootBlock), 'V13.215 워커 시작은 보관 표를 읽지 않는다');
  assert(archive.put([{ id: 'too-big', student_id: 'x', created_at: 0, text: 'x'.repeat(ARCHIVE_ROW_MAX_CHARS + 1) }]) === 0 && archive.get('too-big') === null, 'V13.215 보관 줄 하나의 크기 상한');
  const budget = stateBudgetReport(size1.keys_kb, null, cold);
  assert(budget.archive && budget.archive.sessions === cold.sessions && STATE_BUDGET_KB.sessionArchive && size1.keys_kb.sessions <= STATE_BUDGET_KB.sessions, 'V13.215 health state_budget에 보관 크기 · 예산표에 sessionArchive');
  const client = source('../public/modules/sessions.js') + source('../public/app.js');
  assert(client.includes('export async function sessionWithDetails') && (client.match(/await sessionWithDetails\(/g) || []).length >= 3, 'V13.215 화면: 답안 보기 · 오답 다시 풀기 · 같은 범위 다시는 요약만 온 기록을 한 개 받아서 쓴다');

  report.rows_per_moved = Math.round(report.after.rows_written / Math.max(1, moved) * 10) / 10;
  if (verbose) console.log(JSON.stringify(report, null, 1));
  return report;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runStateSlimChecks((ok, message) => { if (!ok) throw new Error('[state-slim] FAIL · ' + message); console.log('PASS · ' + message); }, { verbose: true }).catch(error => { console.error(error); process.exit(1); });
}
