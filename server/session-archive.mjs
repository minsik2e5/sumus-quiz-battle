// V13.216 지난 연습 기록 보관(콜드 저장). 선생님 요청 2026-11-04: 메인 상태(13.5MB)의 73%가 지난 연습 기록(sessions)이고,
// 그중 대부분이 답 상세(answer_records · wrong_details · word_ids)다. 학생에게 보이는 숫자(코인 · 경험치 · 레벨 · 칭호 · 순위 ·
// 통계 · 결과 분석)는 모두 요약 칸(total · correct · score · xp · reward_points · reward_breakdown · answered_count · wrong_count ·
// unanswered_count · perfect · best_combo · created_at …)에서 계산한다. 답 상세를 쓰는 곳은 셋뿐이다:
//   1) 기록 한 개 열기(답안 보기 · 오답 다시 풀기 · 같은 범위 다시): 화면이 그때 GET /sessions/:id로 한 개만 받는다.
//   2) 이의 신청(그 답을 찾는다): 보관에서 다시 꺼내 메인 상태에 되돌린 뒤 예전처럼 처리한다.
//   3) 선생님 이의 재채점: 처리 안 된 이의 신청이 걸린 기록은 옮기지 않으므로 늘 메인 상태에 있다.
// 그래서 일주일(ARCHIVE_AFTER_MS)이 지난 기록의 답 상세는 지우지 않고 Durable Object 저장소의 따로 된 표(voca_archive,
// cloudflare/session-archive-store.mjs)로 옮긴다. 이 표는 부팅 때 읽지 않고(메모리에 올리지 않음) 위 1) · 2)에서 한 줄만 읽는다.
// 메인 상태의 기록에는 요약 칸과 details_archived_at만 남는다. 되돌리기(restoreSession)는 칸 순서까지 처음과 똑같다.
//
// 지키는 것
// - 옮기기는 sweep 차례에 한 번에 ARCHIVE_PER_RUN개 · 학생 ARCHIVE_STUDENTS_PER_RUN명까지(학생 묶음째), 쓰기 한도가 'ok'인 날만(워커).
// - 보관 줄을 먼저 쓰고(되돌릴 수 있게), 그다음 메인 상태에서 뺀다. 빼기 직전에 그 기록이 보관한 글과 한 글자도 같은지 다시 본다.
//   다르면(그사이 이의 신청 · 재채점) 그 기록은 이번에 빼지 않는다. 같은 계획을 두 번 해도 두 번째는 아무것도 바꾸지 않는다.
// - 처리 안 된 이의 신청이 걸린 기록, 요약 칸(오답 · 미응답 · 푼 수)이 없는 옛 기록, 너무 큰 기록(ARCHIVE_ROW_MAX_CHARS)은 옮기지 않는다.
// - 되돌릴 수 없는 삭제는 하지 않는다: 예전 30일 자동 정리(storage-trim autoTrimSessions, 답 상세 지우기)는 워커에서 끈다.
export const DAY = 86400000;
export const ARCHIVE_AFTER_MS = 7 * DAY;
export const ARCHIVE_FIELDS = ['answer_records', 'wrong_details', 'word_ids'];
export const ARCHIVE_MARK = 'details_archived_at';
export const ARCHIVE_PER_RUN = 300;
export const ARCHIVE_STUDENTS_PER_RUN = 10;
// 보관 줄 하나의 글 길이 상한(SQLite 행 한도 2MB 아래, 한국어 3바이트여도 1.2MB). 기록 하나가 이보다 크면 옮기지 않는다.
export const ARCHIVE_ROW_MAX_CHARS = 400_000;
// 남은 것이 있으면 10분 뒤, 다 옮겼으면 한 시간 뒤에 다시 본다(워커).
export const ARCHIVE_MORE_EVERY_MS = 10 * 60000;
export const ARCHIVE_EVERY_MS = 3600000;

export const isArchived = session => !!session && session[ARCHIVE_MARK] !== undefined;
const finite = value => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value));
const hasDetails = session => ARCHIVE_FIELDS.some(key => session[key] !== undefined);

function pendingPracticeDisputes(state) {
  return new Set((state.meaningDisputes || []).filter(d => d?.status === 'pending' && d.source_type === 'practice').map(d => d.source_id));
}

// 옮겨도 되는 기록인지(계획과 실제 빼기 때 같은 규칙).
function movable(session, now, pending) {
  return !!session && typeof session === 'object'
    && typeof session.id === 'string' && session.id
    && !isArchived(session)
    && Number(session.created_at || 0) <= now - ARCHIVE_AFTER_MS
    && hasDetails(session)
    && finite(session.wrong_count) && finite(session.unanswered_count) && finite(session.answered_count)
    && !pending.has(session.id);
}

// 보관 글: 원래 칸 순서(keys)와 옮긴 칸. 되돌릴 때 칸 순서까지 처음과 같게 만든다.
export function archiveText(session) {
  const fields = {};
  for (const key of ARCHIVE_FIELDS) if (session[key] !== undefined) fields[key] = session[key];
  return JSON.stringify({ v: 1, id: session.id, student_id: session.student_id ?? null, keys: Object.keys(session), fields });
}

// 이번에 옮길 기록. 상태는 바꾸지 않는다. { entries: [{ id, student_id, created_at, text }], more, students }
// 학생 묶음째로 고른다(가장 오래된 기록이 있는 학생부터, 그 학생의 옮길 기록 전부): 저장은 학생마다 기록 조각 하나를 통째로 다시
// 쓰므로(cloudflare/state-parts.mjs), 여러 학생에서 조금씩 빼면 같은 조각을 차례마다 다시 쓴다. 한 학생이 limit보다 많으면 그 학생만 나눠서.
export function planArchive(state, now = Date.now(), { limit = ARCHIVE_PER_RUN, students = ARCHIVE_STUDENTS_PER_RUN } = {}) {
  const pending = pendingPracticeDisputes(state);
  const groups = new Map();
  let total = 0;
  for (const s of state.sessions || []) {
    if (!movable(s, now, pending)) continue;
    const sid = String(s.student_id ?? '_');
    if (!groups.has(sid)) groups.set(sid, []);
    groups.get(sid).push(s);
    total += 1;
  }
  const oldest = list => Math.min(...list.map(s => Number(s.created_at || 0)));
  const order = [...groups.entries()].map(([sid, list]) => ({ sid, list: list.sort((a, b) => Number(a.created_at || 0) - Number(b.created_at || 0)), at: oldest(list) }))
    .sort((a, b) => a.at - b.at || (a.sid < b.sid ? -1 : 1));
  const entries = [];
  let picked = 0, skippedLarge = 0;
  for (const { list } of order) {
    if (picked >= students || entries.length >= limit) break;
    if (entries.length && entries.length + list.length > limit) break;
    picked += 1;
    for (const s of list) {
      if (entries.length >= limit) break;
      const text = archiveText(s);
      if (text.length > ARCHIVE_ROW_MAX_CHARS) { skippedLarge += 1; continue; }
      entries.push({ id: s.id, student_id: s.student_id ?? null, created_at: Number(s.created_at || 0), text });
    }
  }
  // 남은 것이 있는지(너무 큰 기록은 이번에 본 것만 뺀다: 남은 것이 그것뿐이면 다음 차례가 아무것도 쓰지 않고 끝난다).
  return { entries, more: total - skippedLarge > entries.length, students: picked };
}

// 보관한 기록을 메인 상태에서 뺀다(보관 줄을 쓴 뒤에). 기록이 보관 글과 똑같고 아직 옮겨도 될 때만. 뺀 개수를 돌려준다.
// 기록은 얼려 같이 쓰므로(server/mutation-coordinator.mjs) 새 객체로 바꿔 넣는다.
export function applyArchive(state, entries, now = Date.now(), { more = false } = {}) {
  if (!Array.isArray(state.sessions) || !entries?.length) return 0;
  const byId = new Map(entries.map(e => [e.id, e]));
  const pending = pendingPracticeDisputes(state);
  let moved = 0;
  const next = state.sessions.map(s => {
    const entry = s && byId.get(s.id);
    if (!entry || !movable(s, now, pending) || archiveText(s) !== entry.text) return s;
    const copy = {};
    for (const key of Object.keys(s)) if (!ARCHIVE_FIELDS.includes(key)) copy[key] = s[key];
    copy[ARCHIVE_MARK] = now;
    moved += 1;
    return copy;
  });
  if (!moved) return 0;
  state.sessions = next;
  noteArchive(state, now, { moved, more });
  return moved;
}

// 보관 글로 기록을 처음 모습(칸 순서까지)으로 되돌린다. 보관 뒤에 생긴 칸은 뒤에 그대로 둔다.
export function restoreSession(session, text) {
  const saved = typeof text === 'string' ? JSON.parse(text) : text;
  if (!saved || saved.id !== session.id || !Array.isArray(saved.keys)) return null;
  const out = {};
  for (const key of saved.keys) {
    if (Object.hasOwn(saved.fields || {}, key)) out[key] = saved.fields[key];
    else if (key !== ARCHIVE_MARK && session[key] !== undefined) out[key] = session[key];
  }
  for (const key of Object.keys(session)) if (key !== ARCHIVE_MARK && !(key in out)) out[key] = session[key];
  return out;
}

// 보관한 기록 하나를 메인 상태에 되돌린다(이의 신청 전). 되돌렸으면 그 기록, 아니면 null.
export function restoreInState(state, sessionId, archive) {
  const index = (state.sessions || []).findIndex(s => s?.id === sessionId);
  if (index < 0 || !isArchived(state.sessions[index])) return null;
  const text = archive?.get?.(sessionId);
  const restored = text ? restoreSession(state.sessions[index], text) : null;
  if (!restored) return null;
  state.sessions[index] = restored;
  return restored;
}

// 되돌리기(선생님이 옮기기를 무르고 싶을 때, 워커 VOCA_SESSION_ARCHIVE=restore): 한 번에 limit개씩 메인 상태로 되돌린다.
export function planRestore(state, archive, { limit = ARCHIVE_PER_RUN } = {}) {
  const list = (state.sessions || []).filter(isArchived);
  const entries = [];
  for (const s of list.slice(0, limit)) { const text = archive.get(s.id); if (text) entries.push({ id: s.id, text }); }
  return { entries, more: list.length > limit };
}
export function applyRestore(state, entries, now = Date.now()) {
  if (!entries?.length) return 0;
  const byId = new Map(entries.map(e => [e.id, e.text]));
  let restored = 0;
  const next = state.sessions.map(s => {
    if (!isArchived(s) || !byId.has(s.id)) return s;
    const out = restoreSession(s, byId.get(s.id));
    if (!out) return s;
    restored += 1;
    return out;
  });
  if (restored) { state.sessions = next; noteArchive(state, now, { restored }); }
  return restored;
}

// 옮기기 기록(상태 맨 위 묶음 sessionArchive, 예산 server/perf-budget.mjs): 마지막 차례와 합계만.
function noteArchive(state, now, { moved = 0, restored = 0, more = false }) {
  const prev = state.sessionArchive || {};
  state.sessionArchive = {
    at: now,
    after_days: ARCHIVE_AFTER_MS / DAY,
    more: !!more,
    last: { moved, restored },
    total_moved: Number(prev.total_moved || 0) + moved,
    total_restored: Number(prev.total_restored || 0) + restored
  };
}

// 옮길 차례인지(워커가 시간마다 정리와 함께 본다).
export function archiveDue(state, now = Date.now(), lastRunAt = 0) {
  const wait = state?.sessionArchive?.more ? ARCHIVE_MORE_EVERY_MS : ARCHIVE_EVERY_MS;
  return now - Number(lastRunAt || 0) >= wait;
}

// 워커 한 차례: 계획 → 보관 줄 쓰기 → 메인 상태에서 빼기(mutate는 coordinator.durable). mode: 'on' | 'off' | 'restore'.
export async function runArchiveStep({ state, archive, mutate, now = Date.now(), mode = 'on', noMutation }) {
  if (mode === 'restore') {
    const plan = planRestore(state, archive);
    if (!plan.entries.length) return { restored: 0 };
    let restored = 0;
    await mutate(s => (restored = applyRestore(s, plan.entries, now)) ? true : noMutation);
    return { restored, more: plan.more };
  }
  if (mode !== 'on') return { moved: 0 };
  const plan = planArchive(state, now);
  if (!plan.entries.length) return { moved: 0 };
  archive.put(plan.entries);
  let moved = 0;
  await mutate(s => (moved = applyArchive(s, plan.entries, now, { more: plan.more })) ? true : noMutation);
  return { moved, planned: plan.entries.length, more: plan.more };
}
