// V13.168 서버 안정화 2차 검사(release-check가 부른다).
// A. 한 달 지난 연습 기록 자동 정리: 대상 · 남기는 것 · 조금씩 · 하루 한 번 · 정리 전후 학생 합계와 선생님 결과 분석이 같다.
// B. 지난 연습 기록 얼려 같이 쓰기: 고치려 하면 깊은 복사로 다시 해서 결과가 같다 · 읽기도 같다 · 저장 글 캐시가 정확하다.
// C. 저장 간격(쓰기 한도에 따라) · 자동 정리는 'ok' 날만 · 실제 서비스 읽기가 얼린 기록을 고치지 않는다.
// D. 몬스터 사냥: 다른 몬스터에 갔다 와도 열매 문제는 한 공에 한 번 · 만나는 중인 펫이 알에서 나오면 다른 펫으로 바뀐다.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { emptyState } from './state.mjs';
import { hashToken } from './auth.mjs';
import { service, sweep } from './service.mjs';
import { autoTrimSessions, autoTrimDue, AUTO_SESSION_KEEP_MS, AUTO_TRIM_STUDENTS, AUTO_TRIM_EVERY_MS, SESSION_DETAIL_FIELDS } from './storage-trim.mjs';
import { createMutationCoordinator, cloneState, sealState, deepFreeze, readState, isFrozenWrite } from './mutation-coordinator.mjs';
import { partitionState, groupTextCached } from '../cloudflare/state-parts.mjs';
import { commitPacing, COMMIT_GROUP_MS } from '../cloudflare/worker.mjs';
import { createLocalRepository } from '../cloudflare/local-first.mjs';
import { createStorageMock } from './storage-mock.mjs';
import { huntMap, huntMeet, huntThrow, huntBerryQuiz, huntBerryAnswer } from './hunt.mjs';

const source = path => readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8');
const DAY = 86400000;

export async function runStability168Checks(assert) {
  await autoTrimChecks(assert);
  await frozenChecks(assert);
  await pacingChecks(assert);
  huntChecks(assert);
}

function classState(now, { students = 30 } = {}) {
  const st = emptyState();
  st.profiles.push({ id: 'at-t', username: 'at_t', display_name: '선생님', role: 'teacher', active: true, school_ids: ['danwon-high'], division_ids: ['high'], active_division: 'high', active_school_id: 'danwon-high' });
  st.tokens.push({ hash: hashToken('tok-at-t'), user_id: 'at-t', expires_at: now + DAY });
  for (let i = 0; i < students; i++) {
    const id = `at-${i}`;
    st.profiles.push({ id, username: id, display_name: id, role: 'student', active: true, class_name: '고1A', school_id: 'danwon-high', school: '단원고', division: 'high', pets: [{ key: 'dog', first: true, acquired_at: now - 200 * DAY }], avatar_key: 'dog', created_at: now - 200 * DAY });
    st.tokens.push({ hash: hashToken('tok-' + id), user_id: id, expires_at: now + DAY });
  }
  const recs = (n, wrong) => Array.from({ length: n }, (_, k) => ({ question_id: `q${k}`, word_id: `w${k}`, type: 'write_meaning', answer: '답' + k, correct: !wrong.includes(k), at: now - 40 * DAY }));
  let n = 0;
  for (let i = 0; i < students; i++) for (const age of [5, 29, 31, 45, 80]) {
    const total = 10, wrong = age % 2 ? [1, 3] : [2];
    st.sessions.push({ id: `at-s${n++}`, student_id: `at-${i}`, division: 'high', school_id: 'danwon-high', school: '단원고', mode: 'write_meaning', run_mode: age === 45 ? 'test' : 'practice', range_codes: ['r1'], total, correct: total - wrong.length, answered_count: total, score: (total - wrong.length) * 10, xp: 50 + age, reward_points: 3, best_combo: 4, perfect: false, created_at: now - age * DAY,
      // 오답 · 미응답 수 칸이 없는 옛 기록(화면이 답 기록에서 세던 것)도 섞는다.
      ...(age === 80 ? {} : { wrong_count: wrong.length, unanswered_count: 0 }),
      answer_records: recs(total, wrong), wrong_details: wrong.map(k => ({ question_id: `q${k}`, word_id: `w${k}`, answer: '답' + k })), word_ids: ['w0'] });
  }
  st.meaningDisputes.push({ id: 'at-d1', status: 'pending', source_type: 'practice', source_id: 'at-s2', student_id: 'at-0', school_id: 'danwon-high', division: 'high', word_id: 'w1', answer: '답1', created_at: now - 31 * DAY });
  return st;
}

/* ---------- A. 자동 정리 ---------- */
async function autoTrimChecks(assert) {
  const now = Date.now();
  const st = classState(now);
  assert(AUTO_SESSION_KEEP_MS === 30 * DAY && AUTO_TRIM_STUDENTS === 25 && AUTO_TRIM_EVERY_MS === 20 * 3600000, 'V13.168 자동 정리: 한 달(30일) 지난 연습 기록, 한 번에 학생 25명, 다 하면 하루에 한 번');
  // 정리 전: 학생 화면 합계 · 선생님 결과 분석(기록 목록) · 순위
  const look = async () => {
    const teacher = await service(st, 'GET', '/bootstrap', {}, 'tok-at-t');
    const students = {};
    for (const id of ['at-0', 'at-7', 'at-29']) {
      const b = await service(st, 'GET', '/bootstrap', {}, 'tok-' + id);
      students[id] = { stats: b.stats, profile: { xp: b.profile?.xp, level: b.profile?.level, points: b.profile?.points_balance }, sessions: b.sessions.map(s => [s.id, s.total, s.correct, s.score, s.xp, s.reward_points, s.best_combo, s.answered_count, s.perfect, s.created_at]) };
    }
    const keep = s => { const { details_trimmed_at, wrong_count, unanswered_count, ...rest } = s; return rest; };
    return { teacherProfiles: Object.fromEntries(teacher.profiles.map(p => [p.id, p.stats])), teacherSessions: teacher.sessions.map(keep), students };
  };
  const before = await look();
  // 지난 기록은 얼려 둔 채로 정리한다(고치지 않고 새 객체로 바꾼다).
  sealState(st);
  const oldRefs = new Map(st.sessions.map(s => [s.id, s]));
  let threw = null;
  try { assert(sweep(st, now, { autoTrim: true }) === true, 'V13.168 sweep이 자동 정리를 한다'); } catch (error) { threw = error; }
  assert(!threw, `V13.168 자동 정리는 얼린 기록을 고치지 않는다 (${threw?.message || ''})`);
  const first = st.storageAutoTrim;
  const trimmedStudents = new Set(st.sessions.filter(s => s.details_trimmed_at).map(s => s.student_id));
  assert(first.more === true && first.last.students === 25 && trimmedStudents.size === 25 && first.last.sessions === 25 * 3 - 1, `V13.168 한 번에 학생 25명까지만(남은 학생은 다음 정리에) (${first.last.students}명 · ${first.last.sessions}개)`);
  assert(autoTrimDue(st, now + 60000), 'V13.168 남은 것이 있으면 다음 정리(한 시간 뒤)에 바로 이어서 한다');
  sweep(st, now + 3600000, { autoTrim: true });
  const done = st.storageAutoTrim;
  assert(done.more === false && done.total_sessions === 30 * 3 - 1 && done.total_kb >= 0, `V13.168 다 정리하면 끝 (${done.total_sessions}개)`);
  assert(!autoTrimDue(st, now + 3600000 + 60000) && autoTrimDue(st, now + 3600000 + AUTO_TRIM_EVERY_MS), 'V13.168 다 정리한 뒤에는 하루에 한 번만 본다');
  const byId = id => st.sessions.find(s => s.id === id);
  const ages = id => (Number(id.slice(4)) % 5);
  const trimmed = st.sessions.filter(s => s.details_trimmed_at);
  assert(trimmed.every(s => [2, 3, 4].includes(ages(s.id)) && SESSION_DETAIL_FIELDS.every(k => !(k in s))), 'V13.168 31 · 45 · 80일 된 기록만 답 기록 · 오답 · 단어 목록을 지운다');
  assert(st.sessions.filter(s => [0, 1].includes(ages(s.id))).every(s => SESSION_DETAIL_FIELDS.every(k => k in s) && !s.details_trimmed_at), 'V13.168 30일 안 된 기록(5 · 29일)은 그대로다');
  assert(byId('at-s2').answer_records?.length === 10 && !byId('at-s2').details_trimmed_at, 'V13.168 처리 안 된 이의 신청이 걸린 기록은 지우지 않는다(수동 정리와 같은 규칙)');
  assert(byId('at-s4').wrong_count === 1 && byId('at-s4').unanswered_count === 0 && byId('at-s9').wrong_count === 1, 'V13.168 오답 · 미응답 수 칸이 없던 옛 기록은 지우기 전에 답 기록에서 세어 남긴다');
  assert([...oldRefs.values()].every(s => Object.isFrozen(s) && (s.id === 'at-s2' || ![2, 3, 4].includes(ages(s.id)) || Array.isArray(s.answer_records))), 'V13.168 정리 전 상태의 기록 객체는 그대로다(새 객체로 바꿔 넣는다)');
  const after = await look();
  assert(isDeepStrictEqual(before.students, after.students), 'V13.168 정리 전후 학생 화면(경험치 · 레벨 · 코인 · 통계 · 기록 합계)이 같다');
  assert(isDeepStrictEqual(before.teacherProfiles, after.teacherProfiles), 'V13.168 정리 전후 선생님 화면의 학생별 통계(순위 · 칭호 · 성장)가 같다');
  assert(isDeepStrictEqual(before.teacherSessions, after.teacherSessions), 'V13.168 정리 전후 선생님 결과 분석의 기록 목록이 같다');
  const record = await service(st, 'GET', '/sessions/at-s3', {}, 'tok-at-t');
  assert(record.score === 80 && record.details_trimmed_at && !record.answer_records, 'V13.168 정리한 기록도 답안 보기가 열린다(점수 · 날짜 그대로)');
  // 시험 응시는 저절로 지우지 않는다.
  const exam = classState(now, { students: 1 });
  exam.examAttempts.push({ id: 'at-a1', exam_id: 'x', student_id: 'at-0', status: 'submitted', submitted_at: now - 200 * DAY, questions: [{}], keys: [{}], details: [] });
  sweep(exam, now, { autoTrim: true });
  assert(exam.examAttempts[0].questions && exam.examAttempts[0].keys, 'V13.168 시험 응시(문제지)는 자동으로 지우지 않는다');
  // 꺼진 날(쓰기 한도 70% 넘음)은 하지 않는다.
  const off = classState(now, { students: 2 });
  sweep(off, now, { autoTrim: false });
  assert(off.sessions.every(s => s.answer_records) && !off.storageAutoTrim, 'V13.168 자동 정리가 꺼진 sweep은 지우지 않는다');
  const worker = source('../cloudflare/worker.mjs');
  assert(worker.includes("const autoTrim = sweepDue && this.writeLevel() === 'ok';") && worker.includes("sweep(working, Date.now(), { autoTrim: this.writeLevel() === 'ok' })"), 'V13.168 워커: 자동 정리는 쓰기 한도가 넉넉한 날(70% 아래)의 시간마다 정리 · 시작 정리에서만');
  const ui = source('../public/modules/sessions.js');
  assert(ui.includes('한 달이 지나 답안 목록을 정리한 기록이에요') && !ui.includes('90일이 지나 답안 목록을'), 'V13.168 학생 · 선생님 기록 화면 안내: 한 달이 지나 정리한 기록');
}

/* ---------- B. 얼려 같이 쓰기 ---------- */
async function frozenChecks(assert) {
  const s = sealState({ sessions: [{ id: 'a', student_id: 'p1', rec: [{ n: 1 }] }, { id: 'b', student_id: 'p2', rec: [] }], mastery: { p1: { w: { n: 1 } } }, profiles: [{ id: 'p1', coins: 1 }] });
  assert(Object.isFrozen(s.sessions[0]) && Object.isFrozen(s.sessions[0].rec[0]) && !Object.isFrozen(s.sessions) && !Object.isFrozen(s.mastery.p1), 'V13.168 지난 연습 기록만 안쪽까지 얼린다(배열 · 숙련도 · 프로필은 아니다)');
  let error = null;
  try { s.sessions[0].rec[0].n = 2; } catch (e) { error = e; }
  assert(error && isFrozenWrite(error) && !isFrozenWrite(new TypeError("Cannot read properties of undefined (reading 'x')")), 'V13.168 얼린 기록을 고치면 알아볼 수 있는 오류가 난다(다른 오류와 구별)');
  const c = cloneState(s);
  assert(c.sessions !== s.sessions && c.sessions[0] === s.sessions[0] && c.mastery.p1 !== s.mastery.p1 && c.profiles[0] !== s.profiles[0], 'V13.168 변경은 얼린 기록만 같이 쓰고 나머지는 깊게 복사한다');

  // 얼린 기록을 고치는 변경: 전체 깊은 복사로 처음부터 다시 해서 같은 결과, 이전 상태는 그대로.
  let commits = [];
  const repo = { async read() { return { state: {}, revision: 0 }; }, async commit(state) { commits.push(JSON.stringify(state)); } };
  const co = createMutationCoordinator(repo, { state: structuredClone({ sessions: [{ id: 'a', student_id: 'p1', n: 1 }], profiles: [{ id: 'p1', coins: 1 }] }), revision: 0 }, { flushDelay: 20, groupMs: () => 0 });
  const prev = co.current().state;
  let runs = 0;
  const out = await co.durable(state => { runs += 1; state.profiles[0].coins += 1; state.sessions[0].n = 5; return 'done'; });
  const now = co.current().state;
  assert(out === 'done' && runs === 2 && now.sessions[0].n === 5 && now.profiles[0].coins === 2 && prev.sessions[0].n === 1 && prev.profiles[0].coins === 1 && co.stats().frozen_retries === 1, 'V13.168 얼린 기록을 고치는 변경은 처음부터 깊은 복사로 다시 해서 한 번만 반영된다(코인이 두 번 오르지 않음)');
  assert(Object.isFrozen(now.sessions[0]) && commits.at(-1).includes('"n":5'), 'V13.168 다시 한 변경도 얼리고 저장한다');
  // 다른 오류는 그대로 던지고 아무것도 남기지 않는다.
  const err = await co.durable(state => { state.profiles[0].coins = 99; throw Object.assign(Error('no'), { status: 409 }); }).catch(e => e);
  assert(err?.status === 409 && co.current().state.profiles[0].coins === 2, 'V13.168 다른 오류는 다시 하지 않고 이전 상태 그대로');
  // 새 기록 추가는 다시 하지 않는다(얼린 기록을 고치지 않음).
  await co.durable(state => { state.sessions.push({ id: 'b', student_id: 'p2', n: 1 }); });
  assert(co.stats().frozen_retries === 1 && co.current().state.sessions.length === 2 && Object.isFrozen(co.current().state.sessions[1]), 'V13.168 새 기록 추가는 다시 하지 않고, 새 기록도 얼린다');
  await co.close();
  // 읽기(GET)가 얼린 기록을 고치려 하면 사본에서 다시 한다.
  const warned = [];
  const r = await readState(s, state => { state.sessions[0].seen = true; return state.sessions[0].seen; }, { warn: (...a) => warned.push(a) });
  assert(r === true && !('seen' in s.sessions[0]) && warned.length === 1, 'V13.168 얼린 기록을 고치려는 읽기는 사본에서 다시 하고 알린다');

  // 저장 글 캐시: 얼린 기록 글은 한 번만 만들고, 결과는 JSON.stringify와 같다.
  const big = classState(Date.now(), { students: 5 });
  sealState(big);
  const plain = new Map([...partitionState(structuredClone(big))]);
  const a = partitionState(big), b = partitionState(big);
  assert([...a].every(([k, v]) => plain.get(k) === v) && a.size === plain.size, 'V13.168 얼린 기록 캐시를 써도 저장 조각 글이 예전과 똑같다');
  assert([...a].filter(([k]) => k.startsWith('a:sessions:')).every(([k, v]) => b.get(k) === v), 'V13.168 바뀌지 않은 학생의 기록 조각은 같은 글을 다시 쓴다');
  const next = cloneState(big);
  const i = next.sessions.findIndex(x => x.student_id === 'at-1');
  next.sessions[i] = { ...structuredClone(next.sessions[i]), correct: 0 };
  next.sessions.push({ id: 'new', student_id: 'at-2', total: 1 });
  sealState(next);
  const d = partitionState(next);
  assert(d.get('a:sessions:at-1') === JSON.stringify(next.sessions.filter(x => x.student_id === 'at-1')) && d.get('a:sessions:at-2') === JSON.stringify(next.sessions.filter(x => x.student_id === 'at-2')) && d.get('a:sessions:at-0') === a.get('a:sessions:at-0'), 'V13.168 바뀐 기록 · 새 기록이 있는 학생 조각만 새 글이 된다');
  // 학생에게 기록이 늘어날 때 지난번 묶음 글은 남지 않는다(메모리가 계속 늘지 않게).
  const grow = { sessions: [] };
  const firsts = [];
  for (let k = 0; k < 30; k++) { grow.sessions = [...grow.sessions, deepFreeze({ id: 'g' + k, student_id: 'g', n: k })]; firsts.push(grow.sessions.at(-1)); partitionState(grow); }
  assert(groupTextCached(firsts.at(-1)) && firsts.slice(0, -1).every(item => !groupTextCached(item)), 'V13.168 기록이 늘어도 학생마다 묶음 글은 하나만 남는다(지난번 것은 지운다)');
  // 얼리지 않은 객체는 캐시하지 않는다(고쳐질 수 있다).
  const loose = { sessions: [{ id: 'x', student_id: 'p', n: 1 }] };
  partitionState(loose); loose.sessions[0].n = 2;
  assert(partitionState(loose).get('a:sessions:p') === '[{"id":"x","student_id":"p","n":2}]', 'V13.168 얼리지 않은 기록은 늘 새로 글로 바꾼다');
  assert(source('../cloudflare/local-first.mjs').includes('if (seen && seen[0] === text) return [key, seen[1]];'), 'V13.168 백업: 바뀌지 않은 조각은 지난번 해시를 쓴다');

  // 실제 서비스 읽기는 얼린 기록을 고치지 않는다(학생 · 선생님 첫 화면, 기록 하나, 정리 화면).
  const live = classState(Date.now(), { students: 3 });
  sealState(live);
  for (const v of Object.values(live.mastery || {})) deepFreeze(v);
  let readError = null;
  for (const [path, tok] of [['/bootstrap', 'tok-at-0'], ['/bootstrap', 'tok-at-t'], ['/sessions/at-s0', 'tok-at-0'], ['/sessions/at-s3', 'tok-at-t'], ['/teacher/storage-trim', 'tok-at-t']]) {
    try { await service(live, 'GET', path, {}, tok); } catch (e) { if (isFrozenWrite(e)) readError = `${path}: ${e.message}`; }
  }
  assert(!readError, `V13.168 첫 화면 · 기록 보기 · 정리 화면 읽기가 얼린 기록을 고치지 않는다 (${readError || ''})`);
  assert(source('../cloudflare/worker.mjs').includes('await readState(this.mutations.current().state, execute)') && source('./index.mjs').includes('await readState(mutations.current().state, execute)'), 'V13.168 워커 · Node 서버: 읽기는 readState로');
}

/* ---------- C. 저장 간격 ---------- */
async function pacingChecks(assert) {
  // 실제 로컬 저장소(SQLite 모의)에서: 빠른 길로 받은 답이 'ok' 날 값으로 0.4초 안에 디스크에 저장된다(예전 값은 2초 넘게).
  const disk = async pacing => {
    const local = createLocalRepository(createStorageMock(), { log: { warn() {}, error() {} } });
    local.adoptRemote({ n: 0 }, 1);
    const co = createMutationCoordinator(local, await local.read(), { flushDelay: () => pacing.flushDelay, groupMs: () => pacing.groupMs, rollbackOnFailure: true, onError() {} });
    await co.durable(state => { state.n = 1; });
    const saved = [];
    for (let k = 2; k <= 4; k++) {
      await co.fast(state => { state.n = k; });
      const t = Date.now();
      while ((await local.read()).state.n !== k && Date.now() - t < 3000) await new Promise(r => setTimeout(r, 10));
      saved.push(Date.now() - t);
      await new Promise(r => setTimeout(r, 50));
    }
    await co.close();
    return Math.max(...saved);
  };
  const quick = await disk(commitPacing('ok')), slow = await disk(commitPacing('warn'));
  assert(quick < 400 && slow > 1000, `V13.168 연습 답은 쓰기 한도가 넉넉한 날 ${quick}ms 안에 디스크에 저장된다(70% 넘은 날 ${slow}ms)`);
  const ok = commitPacing('ok'), warn = commitPacing('warn'), defer = commitPacing('defer');
  assert(ok.groupMs === 250 && ok.flushDelay === 100 && warn.groupMs === COMMIT_GROUP_MS && warn.flushDelay === 500 && defer.groupMs === COMMIT_GROUP_MS * 4, 'V13.168 쓰기 한도 70% 아래는 0.1초 뒤 · 0.25초 모아 저장(배포 · 재시작 때 잃을 수 있는 답 1.5~6초 → 약 0.35초), 넘으면 예전처럼 1.5초 · 6초');
  assert(commitPacing('ok', 100).groupMs === 100, 'V13.168 VOCA_COMMIT_GROUP_MS가 더 짧으면 그 값');
}

/* ---------- D. 몬스터 사냥 ---------- */
function seq(seed) { let x = seed >>> 0; return () => { x = (x * 1664525 + 1013904223) >>> 0; return x / 2 ** 32; }; }
function huntChecks(assert) {
  const WORDS = ['apple:사과', 'river:강', 'brave:용감한', 'quiet:조용한', 'storm:폭풍', 'heavy:무거운'].map((x, i) => ({ id: 'w' + i, word: x.split(':')[0], meaning: x.split(':')[1] }));
  const t0 = Date.parse('2026-10-22T03:00:00Z'), rand = seq(7);
  const status = fn => { try { fn(); return 'ok'; } catch (e) { return e.status; } };
  // 1) 열매 문제를 틀린 뒤 다른 몬스터에 갔다 와도 같은 공으로 다시 풀 수 없다.
  const p = { pets: [{ key: 'dog' }], hunt: { basic: 6 } };
  const map = huntMap(p, t0, rand), A = map.spots[0].id, B = map.spots[1].id;
  huntMeet(p, A, t0, rand);
  const q = huntBerryQuiz(p, { spot: A, berry: 'pinap', words: WORDS, now: t0, random: rand });
  const bad = huntBerryAnswer(p, { id: q.id, choice: q.choices.find(c => c !== p.hunt.quiz.answer) });
  huntMeet(p, B, t0 + 10, rand); huntMeet(p, A, t0 + 20, rand);
  assert(!bad.ok && status(() => huntBerryQuiz(p, { spot: A, berry: 'pinap', words: WORDS, now: t0 + 30, random: rand })) === 409, 'V13.168 몬스터 사냥: 틀린 열매 문제는 다른 몬스터에 갔다 와도 같은 공으로 다시 풀 수 없다(예전: 다시 풀어 별조각 약 2배)');
  // 던진 수도 이어서 센다: 공을 던진 뒤에는 다음 공에 다시 문제를 받을 수 있다.
  huntThrow(p, { id: 'qa168-throw-1', spot: A, ball: 'basic', now: t0 + 5000, random: () => 0.99 });
  if (p.hunt.live?.spot === A) {
    huntMeet(p, B, t0 + 6000, rand); huntMeet(p, A, t0 + 7000, rand);
    assert(p.hunt.live.throws === 1 && status(() => huntBerryQuiz(p, { spot: A, berry: 'pinap', words: WORDS, now: t0 + 8000, random: rand })) === 'ok', 'V13.168 몬스터 사냥: 다음 공에는 다시 열매 문제를 받는다(던진 수를 자리에 남겨 이어서 센다)');
  }
  // 2) 만나는 중인 펫이 알에서 나오면, 던질 때 못 만난 다른 펫으로 바뀐다(공만 쓰고 펫이 안 나오지 않게).
  const q2 = { pets: [{ key: 'dog' }], hunt: { gold: 2 } };
  const m2 = huntMap(q2, t0, seq(3));
  m2.spots.push({ id: 'petspot1', kind: 'pet', key: 'cat', tier: 'pet', form: 1, x: 10, y: 10, cell: 8 });
  huntMeet(q2, 'petspot1', t0, seq(4));
  q2.pets.push({ key: 'cat', gift: true });
  const out = huntThrow(q2, { id: 'qa168-pet-01', spot: 'petspot1', ball: 'gold', now: t0 + 5000, random: () => 0 });
  assert(out.key !== 'cat' && (!out.caught || out.new_pet === true) && q2.pets.filter(x => x.key === 'cat').length === 1, `V13.168 몬스터 사냥: 만나는 중 그 펫이 알에서 나오면 다른 펫으로 바꿔 던진다 (${out.key}, caught ${out.caught}, new ${out.new_pet})`);
  const q3 = { pets: [{ key: 'dog' }], hunt: { gold: 2 } };
  huntMap(q3, t0, seq(5)).spots.push({ id: 'petspot2', kind: 'pet', key: 'cat', tier: 'pet', form: 1, x: 10, y: 10, cell: 8 });
  huntMeet(q3, 'petspot2', t0, seq(6));
  q3.pets.push({ key: 'cat' });
  huntMap(q3, t0 + 1000, seq(7));
  assert(q3.hunt.live.key === q3.hunt.map.spots.find(s => s.id === 'petspot2').key && q3.hunt.live.key !== 'cat', 'V13.168 몬스터 사냥: 지도가 펫 자리를 바꾸면 만나는 중인 펫도 같이 바뀐다');
}
