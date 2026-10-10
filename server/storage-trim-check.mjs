// V13.131 검사: 오래된 기록 줄이기(A) · 서버 시작 시간 제한(B) · 친구 목록 계산 가볍게(C) · 배포 확인(E).
// 던전 방 저장 줄이기(D)는 cloudflare/dungeon-room.mjs를 돌리는 server/dungeon-room-check.mjs의 11번이 본다.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { passwordHash } from './auth.mjs';
import { emptyState } from './state.mjs';
import { service, sweep, lightCountsForCheck } from './service.mjs';
import { examAdmin } from './exam-admin.mjs';
import { createCompetition } from './competition.mjs';
import { trimCandidates, trimSummary, attemptTotal, ARCHIVE_VALID_MS, SESSION_DETAIL_KEEP_MS, EXAM_DETAIL_KEEP_MS } from './storage-trim.mjs';
import { VocaStateObject, bootTimer, BOOT_BUDGET_MS } from '../cloudflare/worker.mjs';

const source = path => readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8');
const DAY = 86400000;

export async function runStorageTrimChecks(assert, expectStatus) {
  await trimChecks(assert, expectStatus);
  await bootChecks(assert);
  lightCountChecks(assert);
  uiAndDeployChecks(assert);
}

/* ---------- A. 오래된 기록 줄이기 ---------- */
async function trimChecks(assert, expectStatus) {
  const now = Date.now();
  const state = emptyState();
  const hash = await passwordHash('QaTrim1!');
  const student = (id, school = 'danwon-high', name = '단원고') => ({ id, username: id, display_name: id, role: 'student', active: true, class_name: '고1A', school_id: school, school: name, division: 'high', password_hash: hash, pets: [{ key: 'dog', first: true, acquired_at: now - 300 * DAY }], avatar_key: 'dog', created_at: now - 300 * DAY,
    bonus: { log: [{ d: 'old', k: null, xp: 40, c: 15, at: now - 200 * DAY }] } });
  state.profiles.push(
    { id: 'qa-tr-teacher', username: 'qa_tr_teacher', display_name: '정리 선생님', role: 'teacher', active: true, password_hash: hash, school_ids: ['danwon-high'], division_ids: ['high'], active_division: 'high', active_school_id: 'danwon-high' },
    student('qa-tr-a'), student('qa-tr-b'), student('qa-tr-x', 'seonbu-high', '선부고')
  );
  const records = (n, wrongAt = [1]) => Array.from({ length: n }, (_, i) => ({ question_id: `q${i}`, word_id: `w${i}`, type: 'write_meaning', answer: '답' + i, correct: !wrongAt.includes(i), at: now - 100 * DAY + i }));
  const session = (id, sid, ageDays, over = {}) => ({ id, student_id: sid, division: 'high', school_id: 'danwon-high', school: '단원고', mode: 'write_meaning', run_mode: 'practice', range_codes: ['r1'], total: 12, correct: 11, answered_count: 12, score: 92, xp: 130, reward_points: 9, best_combo: 7, perfect: false, created_at: now - ageDays * DAY, answer_records: records(12), wrong_details: [{ word_id: 'w1', answer: '답1' }], word_ids: ['w20', 'w21'], ...over });
  state.sessions.push(
    session('s-old', 'qa-tr-a', 100),
    session('s-old-nocount', 'qa-tr-b', 95, { total: 14, answer_records: records(12, [1, 4]) }),
    session('s-recent', 'qa-tr-a', 89),
    session('s-dispute', 'qa-tr-b', 120),
    session('s-other-school', 'qa-tr-x', 120, { school_id: 'seonbu-high', school: '선부고' })
  );
  state.meaningDisputes.push({ id: 'd1', status: 'pending', source_type: 'practice', source_id: 's-dispute', student_id: 'qa-tr-b', school_id: 'danwon-high', division: 'high', word_id: 'w1', answer: '답1', created_at: now - 100 * DAY });
  const exam = (id, dueDays) => ({ id, title: '시험 ' + id, exam_type: 'write_meaning', school_id: 'danwon-high', school: '단원고', division: 'high', class_name: '고1A', active: false, release_result: true, created_at: now - 60 * DAY, available_at: now - 60 * DAY, due_at: now - dueDays * DAY, duration_sec: 600 });
  state.exams.push(exam('e-old', 40), exam('e-new', 10));
  const keys = [{ id: 'w1', word: 'apple', meaning: '사과' }, { id: 'w2', word: 'bee', meaning: '벌' }];
  const attempt = (id, examId, sid, over = {}) => ({ id, exam_id: examId, student_id: sid, status: 'submitted', started_at: now - 45 * DAY, submitted_at: now - 41 * DAY, questions: [{ type: 'write_meaning', prompt: 'apple', options: [] }, { type: 'write_meaning', prompt: 'bee', options: [] }], keys, answers: { 0: '사과', 1: '벌레' },
    details: [{ number: 1, word_id: 'w1', type: 'write_meaning', word: 'apple', meaning: '사과', answer: '사과', correct: true }, { number: 2, word_id: 'w2', type: 'write_meaning', word: 'bee', meaning: '벌', answer: '아무말', correct: false, reviewed_at: now - 40 * DAY }],
    correct: 1, score: 50, reward: { xp: 10, coins: 4 }, ...over });
  state.examAttempts.push(
    attempt('a-old', 'e-old', 'qa-tr-a'),
    attempt('a-review', 'e-old', 'qa-tr-b', { details: [{ number: 1, word_id: 'w1', type: 'write_meaning', word: 'apple', meaning: '사과', answer: '사과', correct: true }, { number: 2, word_id: 'w2', type: 'write_meaning', word: 'tree', meaning: '사과나무', answer: '사과나무들', correct: false }] }),
    attempt('a-dispute', 'e-old', 'qa-tr-b'),
    attempt('a-new', 'e-new', 'qa-tr-a', { submitted_at: now - 11 * DAY })
  );
  state.meaningDisputes.push({ id: 'd2', status: 'pending', source_type: 'exam', source_id: 'a-dispute', student_id: 'qa-tr-b', school_id: 'danwon-high', division: 'high', word_id: 'w2', answer: '아무말', created_at: now - 40 * DAY });
  const login = async (username, role) => (await service(state, 'POST', '/login', { username, password: 'QaTrim1!', division: 'high', role }, null))._cookie;
  const teacher = await login('qa_tr_teacher', 'teacher'), studentA = await login('qa-tr-a');

  assert(SESSION_DETAIL_KEEP_MS === 90 * DAY && EXAM_DETAIL_KEEP_MS === 30 * DAY, 'V13.131 연습 기록 90일 · 시험 문제지는 시험이 끝나고 30일');
  const summary = (await service(state, 'GET', '/teacher/storage-trim', {}, teacher)).trim;
  assert(summary.sessions === 2 && summary.attempts === 1 && summary.kb >= 0 && summary.fingerprint.length === 64, `V13.131 대상: 90일 지난 연습 2개 · 30일 지난 시험 1개 (${summary.sessions}/${summary.attempts})`);
  const found = trimCandidates(state, now, new Set(['danwon-high']));
  assert(found.sessions.map(s => s.id).sort().join() === 's-old,s-old-nocount' && found.attempts.map(a => a.id).join() === 'a-old', 'V13.131 89일 기록 · 다른 학교 기록 · 처리 안 된 이의 신청 · 재채점(검토) 대기 · 끝난 지 30일 안 된 시험은 대상이 아니다');
  await expectStatus(403, () => service(state, 'GET', '/teacher/storage-trim', {}, studentA), 'V13.131 학생은 정리 화면을 쓸 수 없다');
  await expectStatus(403, () => service(state, 'GET', '/teacher/storage-archive', {}, studentA), 'V13.131 학생은 보관 파일을 받을 수 없다');

  // 보관 파일: 지울 내용 전체
  const archive = (await service(state, 'GET', '/teacher/storage-archive', {}, teacher)).archive;
  const old = archive.sessions.find(s => s.id === 's-old');
  assert(archive.kind === 'sumus-voca-trim-archive' && archive.fingerprint === summary.fingerprint && archive.counts.sessions === 2 && archive.counts.attempts === 1, 'V13.131 보관 파일의 지문 · 개수가 대상과 같다');
  assert(old.answer_records.length === 12 && old.wrong_details.length === 1 && old.word_ids.length === 2 && old.student_name === 'qa-tr-a' && old.score === 92, 'V13.131 보관 파일에 연습 기록의 답 기록 · 오답 · 단어 목록 전체와 누구 기록인지가 들어 있다');
  assert(archive.exam_attempts[0].questions.length === 2 && archive.exam_attempts[0].keys.length === 2 && archive.exam_attempts[0].exam_title === '시험 e-old', 'V13.131 보관 파일에 시험 문제 · 정답 단어 전체가 들어 있다');

  // 줄이기 전 합계(코인 잔액 · 경험치 · 레벨 · 펫)
  const totals = async () => {
    const boot = await service(state, 'GET', '/bootstrap', {}, teacher);
    const own = await service(state, 'GET', '/bootstrap', {}, studentA);
    return { teacher: Object.fromEntries(boot.profiles.map(p => [p.id, p.stats])), student: own.stats, attempts: own.attempts.map(a => [a.id, a.total, a.score]) };
  };
  const before = await totals();
  const bytesBefore = JSON.stringify(state).length;

  await expectStatus(409, () => service(state, 'POST', '/teacher/storage-trim', { fingerprint: 'f'.repeat(64), archived_at: archive.created_at }, teacher), 'V13.131 다른 지문으로는 지우지 않는다');
  await expectStatus(409, () => service(state, 'POST', '/teacher/storage-trim', { fingerprint: archive.fingerprint, archived_at: now - ARCHIVE_VALID_MS - 1000 }, teacher), 'V13.131 오래된 보관 파일로는 지우지 않는다');
  await expectStatus(409, () => service(state, 'POST', '/teacher/storage-trim', {}, teacher), 'V13.131 보관 파일 없이 정리하지 않는다');
  // 받은 뒤 대상이 바뀌면(새로 90일 지난 기록) 다시 받게 한다.
  state.sessions.push(session('s-late', 'qa-tr-a', 91));
  await expectStatus(409, () => service(state, 'POST', '/teacher/storage-trim', { fingerprint: archive.fingerprint, archived_at: archive.created_at }, teacher), 'V13.131 보관 파일을 받은 뒤 대상이 바뀌면 다시 받게 한다');
  state.sessions.pop();
  // 저절로 지우지 않는다: 매시간 정리(sweep)는 답 기록을 그대로 둔다.
  sweep(state, now);
  assert(state.sessions.find(s => s.id === 's-old').answer_records?.length === 12, 'V13.131 정리는 보관 파일을 받은 뒤 버튼으로만 한다(sweep이 저절로 지우지 않는다)');

  const result = await service(state, 'POST', '/teacher/storage-trim', { fingerprint: archive.fingerprint, archived_at: archive.created_at }, teacher);
  assert(result.trimmed.sessions === 2 && result.trimmed.attempts === 1 && result.trim.sessions === 0 && result.trim.attempts === 0, 'V13.131 받은 파일과 같으면 정리하고, 다시 보면 남은 대상이 없다');
  const s = id => state.sessions.find(x => x.id === id), a = id => state.examAttempts.find(x => x.id === id);
  const kept = ['created_at', 'range_codes', 'total', 'correct', 'score', 'xp', 'reward_points', 'best_combo'];
  assert(['answer_records', 'wrong_details', 'word_ids'].every(k => !(k in s('s-old'))) && kept.every(k => s('s-old')[k] !== undefined) && s('s-old').details_trimmed_at, 'V13.131 연습 기록: 답 기록 · 오답 · 단어 목록만 지우고 날짜 · 범위 · 문제 수 · 정답 수 · 점수 · 경험치 · 코인 · 최고 콤보는 남긴다');
  assert(s('s-old-nocount').wrong_count === 2 && s('s-old-nocount').unanswered_count === 2, 'V13.131 화면이 답 기록에서 세던 오답 · 미응답 수는 지우기 전에 칸으로 남긴다');
  assert(!('questions' in a('a-old')) && !('keys' in a('a-old')) && a('a-old').details.length === 2 && a('a-old').score === 50 && a('a-old').reward.coins === 4 && a('a-old').total === 2 && attemptTotal(a('a-old')) === 2, 'V13.131 시험 응시: 문제 · 정답 단어만 지우고 채점 내용 · 점수 · 보상 · 문제 수는 남긴다');
  assert(s('s-recent').answer_records && s('s-dispute').answer_records && s('s-other-school').answer_records && a('a-review').questions && a('a-dispute').keys && a('a-new').questions, 'V13.131 대상이 아닌 기록은 그대로다');
  assert(JSON.stringify(state).length < bytesBefore && state.storageTrims.at(-1).by === 'qa-tr-teacher', 'V13.131 상태가 작아지고, 누가 언제 정리했는지 남긴다');
  const after = await totals();
  assert(isDeepStrictEqual(before, after), 'V13.131 정리 전후 학생마다 코인 잔액 · 경험치 · 레벨 · 펫 · 시험 문제 수와 점수가 같다');
  // 정리한 응시도 재채점(점수 다시 계산)과 답안 보기가 된다.
  const regrade = await examAdmin(state, 'POST', '/admin/exams/e-old/regrade', { attempt_id: 'a-old', number: 2, correct: true }, teacher);
  assert(regrade.attempt.score === 100 && regrade.attempt.total === 2, 'V13.131 정리한 시험도 선생님 재채점이 문제 수(total)로 점수를 다시 계산한다');
  const record = await service(state, 'GET', '/sessions/s-old', {}, teacher).catch(error => ({ error }));
  assert(!record.error && record.score === 92 && !record.answer_records, 'V13.131 정리한 연습 기록도 선생님 답안 보기가 열린다(점수만)');
}

/* ---------- B. 서버 시작 시간 제한 ---------- */
async function bootChecks(assert) {
  let clock = 1_000_000;
  const realNow = Date.now;
  Date.now = () => clock;
  try {
    const timer = bootTimer(20000);
    clock += 15000;
    assert(timer.left() === 5000 && timer.limit(12000) === 5000 && timer.limit(12000, 0.5) === 2500, 'V13.131 시작 시간: 남은 시간과 원래 제한 중 짧은 쪽');
    clock += 4500;
    assert(timer.limit(12000) === 0, 'V13.131 남은 시간이 1초보다 적으면 더 부르지 않는다');

    // Supabase가 답하지 않으면(제한 시간까지 기다렸다 실패) 시계를 그만큼 보낸다.
    const hang = name => async ms => { calls.push([name, ms]); clock += ms; throw Object.assign(Error('timeout'), { status: 503 }); };
    let calls = [];
    const boot = async ({ hasLocal, partsRevision = 3, mode, supabase }) => {
      calls = [];
      const o = Object.create(VocaStateObject.prototype);
      o.env = mode ? { SUPABASE_BACKUP_MODE: mode } : {};
      o.local = { hasSnapshot: () => hasLocal, status: () => ({ syncedVersion: 5, version: 5, partsRevision, supabaseRevision: 9 }), read: async () => ({ from: 'local' }), adoptRemoteParts() {}, adoptRemote() {} };
      o.supabase = supabase;
      const started = clock;
      let out, error;
      try { out = await o.loadInitialState(); } catch (e) { error = e; }
      return { out, error, spent: clock - started, calls: [...calls] };
    };
    const a = await boot({ hasLocal: true, supabase: { partsRevision: hang('rev'), readParts: hang('parts'), read: hang('v12') } });
    assert(a.out?.from === 'local' && a.spent <= 10000, `V13.131 로컬 사본 + 파트 번호가 답하지 않음: 10초 안에 로컬 사본으로 시작 (${a.spent}ms)`);
    const b = await boot({ hasLocal: true, supabase: { partsRevision: async ms => { calls.push(['rev', ms]); clock += ms - 100; return 4; }, readParts: hang('parts'), read: hang('v12') } });
    assert(b.out?.from === 'local' && b.spent <= BOOT_BUDGET_MS && b.calls.length === 2, `V13.131 번호가 바뀌었는데 파트 읽기가 답하지 않음: 합계 20초 안에 로컬 사본으로 시작 (예전 32초, 지금 ${b.spent}ms)`);
    const c = await boot({ hasLocal: false, supabase: { partsRevision: hang('rev'), readParts: hang('parts'), read: hang('v12') } });
    assert(c.error && c.spent <= BOOT_BUDGET_MS && c.calls.map(x => x[0]).join() === 'parts,v12', `V13.131 로컬 사본이 없으면 파트 → v12 사본을 합계 20초 안에 시도한다 (${c.spent}ms)`);
    const d = await boot({ hasLocal: true, mode: 'full', supabase: { read: hang('v12') } });
    assert(d.out?.from === 'local' && d.spent <= 12000, 'V13.131 전체 사본 방식도 12초 안에 로컬 사본으로 시작');
  } finally {
    Date.now = realNow;
  }
  const worker = source('../cloudflare/worker.mjs');
  assert(worker.includes('export const BOOT_BUDGET_MS = 20000;') && worker.includes('this.supabase.partsRevision(ms)') && worker.includes('this.readPartsBackup(timer.limit(20000))'), 'V13.131 워커 시작이 시간 예산(20초)을 쓴다');
}

/* ---------- C. 친구 목록 · 선생님 통계 계산 가볍게 ---------- */
function lightCountChecks(assert) {
  const { pointsAndPets, xpSessions, activePetOf, battleIndex, stats } = lightCountsForCheck;
  const now = Date.now();
  const state = emptyState();
  const pets = ['dog', 'cat', 'fox'];
  for (let i = 0; i < 40; i++) {
    state.profiles.push({ id: `p${i}`, username: `p${i}`, display_name: `학생${i}`, role: 'student', active: true, class_name: i % 2 ? '고1A' : '고1B', school_id: 'danwon-high', school: '단원고', division: 'high',
      pets: pets.slice(0, 1 + i % 3).map((key, k) => ({ key, first: k === 0, acquired_at: now - (50 - k) * DAY })), avatar_key: pets[i % 3 === 0 ? 0 : i % 3], points_spent: i * 3,
      bonus: { log: [{ d: 'old', k: i % 2 ? 'cat' : null, xp: 20 + i, c: i, at: now - 30 * DAY }] } });
  }
  for (let i = 0; i < 1200; i++) state.sessions.push({ id: `s${i}`, student_id: `p${i % 40}`, division: 'high', school_id: 'danwon-high', total: 10, correct: i % 10, xp: 30 + i % 50, reward_points: i % 9, pet_key: pets[i % 3], best_combo: i % 13, created_at: now - (i % 90) * DAY });
  for (let i = 0; i < 300; i++) {
    const host = `p${i % 40}`, guest = `p${(i * 7 + 1) % 40}`;
    state.battles.push({ id: `b${i}`, status: i % 10 === 0 ? 'active' : i % 15 === 0 ? 'cancelled' : 'finished', host_id: host, guest_id: host === guest ? `p${(i + 1) % 40}` : guest, stake: 10 + i % 3 * 20, winner: i % 4 ? host : null, loser: i % 4 ? guest : null, finished_at: now - i * 3600000, created_at: now - i * 3600000 - 60000 });
  }
  const ctx = createCompetition(state, now), index = battleIndex(state);
  let samePet = true, sameStats = true;
  for (const p of state.profiles) {
    if (!isDeepStrictEqual(activePetOf(ctx, p), pointsAndPets(state, p, xpSessions(state, p.id, p)).pet)) samePet = false;
    const mine = state.sessions.filter(s => s.student_id === p.id);
    if (!isDeepStrictEqual(stats(state, p, mine, index), stats(state, p, mine))) sameStats = false;
  }
  assert(samePet, 'V13.131 친구 목록의 펫(createCompetition의 학생별 기록)이 예전 계산(pointsAndPets)과 같다');
  assert(sameStats, 'V13.131 선생님 화면 학생 통계(대결 목록을 한 번만 나눠 셈)가 예전 계산과 같다(코인 잔액 · 대결 전적 · 걸린 판돈 포함)');
  const svc = source('./service.mjs');
  const friends = name => svc.slice(svc.indexOf(`function ${name}(`), svc.indexOf('\n}\n', svc.indexOf(`function ${name}(`)));
  assert(['battleFriends', 'dungeonFriends'].every(name => friends(name).includes('activePetOf(ctx, x)') && !friends(name).includes('pointsAndPets')), 'V13.131 야차전 · 던전 친구 목록은 친구마다 전체 기록을 훑지 않는다');
  assert(svc.includes('stats: stats(state, s, sessionsByStudent.get(s.id) || [], battlesByStudent)'), 'V13.131 선생님 bootstrap은 대결 목록을 한 번만 나눈다');
}

/* ---------- A 화면 · E 배포 확인 ---------- */
function uiAndDeployChecks(assert) {
  const app = source('../public/app.js'), teacher = source('../public/modules/teacher.js'), sessions = source('../public/modules/sessions.js');
  assert(teacher.includes('data-action="trim-archive"') && teacher.includes('data-action="trim-run" ${saved ? \'\' : \'disabled\'}') && app.includes("fetch('/api/teacher/storage-archive'") && app.includes("api('/teacher/storage-trim', { fingerprint: saved.fingerprint, archived_at: saved.archived_at })"), 'V13.131 선생님 결과 탭: 보관 파일을 받아야 정리하기가 켜지고, 받은 파일의 지문으로 정리한다');
  assert(sessions.includes('session.details_trimmed_at'), 'V13.131 정리한 연습 기록은 답안 대신 정리했다고 알려 준다');
  const deploy = source('../.github/workflows/deploy-cloudflare.yml');
  assert(deploy.includes('for i in $(seq 1 30)') && deploy.includes('sleep 10'), 'V13.131 배포 확인: 새 버전을 5분(10초 × 30번)까지 기다린다');
  assert(deploy.includes('::warning::API is up (ok:true) but still reports an older version') && deploy.includes('::error::Deployed API did not report ok:true within 5 minutes'), 'V13.131 배포 확인: 5분 뒤에도 이전 버전이면 경고만, API가 아예 ok가 아니면 실패');
  assert(deploy.includes('Number(s.supabase_failures) > 0') && deploy.includes('!s.supabase_last_ok_at') && deploy.includes('timeout-minutes: 20'), 'V13.131 배포 확인: Supabase 백업 실패 · 마지막 성공 시각 없음은 경고로 보여 준다');
}
