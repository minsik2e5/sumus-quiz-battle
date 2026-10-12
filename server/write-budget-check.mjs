// V13.144 쓰기 한도 검사. 2026-10-12 운영 서버가 무료 플랜의 Durable Object 쓰기 한도(하루 10만 줄)를 넘어
// 모든 요청이 Cloudflare 1101이 됐다. 저장소 모의 객체(storage-mock.mjs)가 쓴 줄 수를 세고, 여기서 확인한다.
//   - 학생 답 하나 저장 ≤ 3줄, 바뀐 것이 없는 저장은 0줄
//   - 옛 통째 스냅숏(voca_snapshot) → 조각으로 옮긴 뒤 데이터가 같다, 옮기다 실패하면 옛 방식으로 읽는다
//   - 다시 시작해도 같은 상태, 연달아 오는 저장은 모아서 한 번에 쓴다
//   - 시작 중 정리(sweep)가 던져도 켜진다, 시작하지 못하면 워커가 1101 대신 JSON 503으로 답한다
//   - /api/health에 오늘 쓴 줄 수와 %, 70%면 선생님 첫 화면 경고, 90%면 급하지 않은 정리를 미룬다
// cloudflare-check.mjs가 부른다.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createStorageMock } from './storage-mock.mjs';
import { passwordHash } from './auth.mjs';
import { emptyState } from './state.mjs';
import { builtinBooks } from './service.mjs';
import worker, { VocaStateObject, BOOT_FAIL_MESSAGE } from '../cloudflare/worker.mjs';
import { createLocalRepository } from '../cloudflare/local-first.mjs';
import { createMutationCoordinator } from './mutation-coordinator.mjs';
import { CF_FREE_PLAN, writeBudget, utcDay } from '../cloudflare/cf-limits.mjs';

const canonical = value => JSON.stringify(value, (key, item) => item && typeof item === 'object' && !Array.isArray(item) ? Object.fromEntries(Object.keys(item).sort().map(k => [k, item[k]])) : item);
const quiet = { warn() {}, error() {} };
const env = { SUPABASE_URL: 'https://example.supabase.co', SUPABASE_ANON_KEY: 'k', VOCA_STATE_SECRET: 's', VOCA_COMMIT_GROUP_MS: 0, SUPABASE_SYNC_MIN_INTERVAL_MS: 3600000 };
const ctxFor = storage => ({ storage, blockConcurrencyWhile: callback => callback(), waitUntil: () => {} });

// 학생 둘(선생님 하나)과 큰 덩어리(운영 상태 약 4MB 흉내: 한 번도 바뀌지 않는 조각).
export async function sampleState({ students = 2, padKb = 0 } = {}) {
  const state = emptyState();
  const hash = await passwordHash('Student123!');
  state.profiles.push({ id: 'teacher-1', role: 'teacher', username: 'teacher_one', password_hash: hash, display_name: '선생님', active: true, created_at: Date.now() - 86400000 });
  for (let i = 0; i < students; i++) {
    state.profiles.push({ id: `student-${i}`, role: 'student', username: `student_${i}`, password_hash: hash, display_name: `학생${i}`, class_name: '고1A', school_id: 'danwon-high', school: '단원고', active: true, avatar_key: 'terra', ranking_public: true, created_at: Date.now() - 86400000 });
  }
  if (padKb) state.simPadding = Array.from({ length: Math.ceil(padKb / 10) }, (_, i) => ({ id: `pad-${i}`, text: '단어 기록 '.repeat(1000).slice(0, 10000) }));
  return state;
}

// Supabase v12 RPC만 있는 가짜 서버(파트 함수는 없음 → 'full' 백업).
export function fakeSupabase(state) {
  const remote = { revision: 1, data: structuredClone(state), failReads: false };
  const fetch = async (url, options = {}) => {
    const name = String(url).split('/').at(-1);
    const body = JSON.parse(options.body || '{}');
    if (name === 'voca_v12_state_read') {
      if (remote.failReads) return Response.json({ message: 'down' }, { status: 503 });
      return Response.json([{ revision: remote.revision, data: structuredClone(remote.data) }]);
    }
    if (name === 'voca_v12_state_commit') {
      if (Number(body.p_revision) !== remote.revision) return Response.json({ code: '40001', message: 'revision_conflict' }, { status: 409 });
      remote.data = body.p_data; remote.revision += 1;
      return Response.json(remote.revision);
    }
    return Response.json({ code: 'PGRST202', message: 'missing' }, { status: 404 });
  };
  return { remote, fetch };
}

export const clientFor = object => async (path, { method = 'GET', body, cookie, status = 200 } = {}) => {
  const response = await object.fetch(new Request(`https://sumus-voca.example${path}`, {
    method,
    headers: { ...(body === undefined ? {} : { 'content-type': 'application/json' }), ...(cookie ? { cookie } : {}), origin: 'https://sumus-voca.example' },
    body: body === undefined ? undefined : JSON.stringify(body)
  }));
  const payload = await response.json();
  assert.equal(response.status, status, `${path}: ${JSON.stringify(payload).slice(0, 300)}`);
  return { response, payload };
};
export const loginAs = async (call, username, role = 'student') => (await call('/api/login', { method: 'POST', body: { username, password: 'Student123!', role } })).response.headers.get('set-cookie').split(';')[0];

export async function runWriteBudgetChecks() {
  const nativeFetch = globalThis.fetch;
  const book = builtinBooks.find(item => item.school === '단원고');
  const results = {};
  try {
    /* ---------- 1. 답 하나 ≤ 3줄 · 바뀐 것 없는 저장 0줄 ---------- */
    {
      const supa = fakeSupabase(await sampleState({ padKb: 3000 }));
      globalThis.fetch = supa.fetch;
      const storage = createStorageMock();
      const object = new VocaStateObject(ctxFor(storage), env);
      const call = clientFor(object);
      await object.ready;
      object.sync.close();
      const cookie = await loginAs(call, 'student_0');
      const run = await call('/api/practice/start', { method: 'POST', cookie, body: { school: '단원고', range_codes: [book.words[0].range_code], mode: 'eng2mean', target: 20 } });
      let questionId = run.payload.question_id;
      const perAnswer = [], perCommit = [];
      for (let i = 0; i < 12; i++) {
        const before = storage.rowsWritten;
        const answer = await call(`/api/practice/${run.payload.id}/answer`, { method: 'POST', cookie, body: { question_id: questionId, answer: `__answer_${i}__`, prefetch_next: true } });
        perAnswer.push(storage.rowsWritten - before);
        perCommit.push(object.local.metrics.commitRows);
        questionId = answer.payload.prefetched_next?.question_id;
        assert(questionId, '다음 문제를 미리 받아야 합니다.');
      }
      // 답 하나 = 그 학생의 mastery 조각 + practices 조각 + meta = 3줄. 학생의 첫 답만 mastery 순서(o:mastery)가 한 번 더 바뀐다(4줄).
      assert(perCommit[0] <= 4 && perCommit.slice(1).every(rows => rows <= 3), `V13.144 답 하나의 로컬 저장은 3줄 이하여야 합니다: ${perCommit.join(', ')}`);
      assert(perAnswer.slice(1).every(rows => rows <= 3), `V13.144 답 하나에 쓰는 줄(알람 포함)은 3줄 이하여야 합니다: ${perAnswer.join(', ')}`);
      results.answer = { perAnswer, perCommit };

      // 바뀐 것이 없는 저장: 상태를 그대로 다시 저장해도, 아무것도 안 바꾸는 요청이 와도 0줄.
      const local = object.local;
      const before = storage.rowsWritten;
      const version = local.status().version;
      const same = structuredClone(object.mutations.current().state);
      assert.equal(await local.commit(same, version), version, 'V13.144 바뀐 것이 없으면 버전을 올리지 않아야 합니다.');
      await object.mutations.durable(state => { state.profiles = [...state.profiles]; return true; });
      await call('/api/bootstrap', { cookie });
      assert.equal(storage.rowsWritten - before, 0, 'V13.144 바뀐 것이 없는 저장은 한 줄도 쓰지 않아야 합니다.');
      results.noop = storage.rowsWritten - before;

      // 다시 시작해도 같은 상태.
      const live = canonical(object.mutations.current().state);
      const again = new VocaStateObject(ctxFor(storage), env);
      await again.ready;
      again.sync.close();
      assert.equal(canonical(again.mutations.current().state), live, 'V13.144 다시 시작해도 상태가 같아야 합니다.');
      assert.equal(again.local.format(), 'parts');

      // 상태 점검: 오늘 쓴 줄 수와 %.
      const health = (await clientFor(again)('/api/health')).payload;
      assert(health.rows_written_today > 0 && health.rows_written_limit === CF_FREE_PLAN.rowsWrittenPerDay && health.rows_written_pct === writeBudget(health.rows_written_today).pct && health.write_level === 'ok' && health.boot_warning === null,
        `V13.144 /api/health에 오늘 쓴 줄 수와 무료 한도 대비 %가 있어야 합니다: ${JSON.stringify(health).slice(0, 300)}`);
      assert.equal(health.storage.storage_format, 'parts');
    }

    /* ---------- 2. 큰 조각은 여러 행으로 나누고, 바뀐 행만 쓴다 ---------- */
    {
      const storage = createStorageMock();
      const local = createLocalRepository(storage, { log: quiet });
      const state = { profiles: [], big: 'ㄱ'.repeat(1_300_000), small: 1 };
      await local.commit(state, -1);
      assert.equal(storage.count('voca_rows'), 6, 'V13.144 1.3M 글자 조각은 3행(+ o:keys, k:profiles, k:small)으로 나눠야 합니다.');
      const before = storage.rowsWritten;
      await local.commit({ ...state, small: 2 }, 0);
      assert.equal(storage.rowsWritten - before, 2, 'V13.144 작은 조각 하나가 바뀌면 그 행 + meta 한 줄만 써야 합니다.');
      await local.commit({ ...state, small: 2, big: 'ㄴ' }, 1);
      assert.equal(storage.count('voca_rows'), 4, 'V13.144 줄어든 조각의 남는 행은 지워야 합니다.');
      assert.equal(canonical((await createLocalRepository(storage, { log: quiet }).read()).state), canonical({ ...state, small: 2, big: 'ㄴ' }));
    }

    /* ---------- 3. 옛 통째 스냅숏 → 조각으로 옮기기 ---------- */
    const legacyState = await sampleState({ students: 3, padKb: 1200 });
    legacyState.sessions.push({ id: 's-1', student_id: 'student-1', correct: 3, total: 4 });
    legacyState.mastery['student-2'] = { w1: { right: 2 } };
    {
      const storage = createStorageMock();
      storage.writeLegacySnapshot(legacyState, { version: 7, synced_version: 5, supabase_revision: 41 });
      const local = createLocalRepository(storage, { log: quiet });
      assert.equal(local.format(), 'parts', 'V13.144 옛 스냅숏은 처음 시작할 때 조각으로 옮겨야 합니다.');
      assert.equal(canonical((await local.read()).state), canonical(legacyState), 'V13.144 옮긴 뒤 데이터가 옛 데이터와 같아야 합니다.');
      assert.deepEqual([local.status().version, local.status().syncedVersion, local.status().supabaseRevision], [7, 5, 41], 'V13.144 옮겨도 버전과 백업 상태는 그대로여야 합니다.');
      assert.equal(storage.count('voca_snapshot'), 0, 'V13.144 다 옮긴 뒤에는 옛 행을 지워야 합니다.');
      const reopened = createLocalRepository(storage, { log: quiet });
      assert.equal(canonical((await reopened.read()).state), canonical(legacyState), 'V13.144 옮긴 뒤 다시 시작해도 같아야 합니다.');
    }
    {
      // 옮기다 실패(새 조각을 쓰다가 디스크 오류) → 옛 방식으로 읽고, 데이터는 그대로, 다음 시작 때 다시 옮긴다.
      const storage = createStorageMock();
      storage.writeLegacySnapshot(legacyState);
      storage.failNextWrite(/voca_rows/);
      const local = createLocalRepository(storage, { log: quiet });
      assert.equal(local.format(), 'legacy', 'V13.144 옮기다 실패하면 옛 방식으로 읽어야 합니다.');
      assert.match(local.migrationError(), /simulated disk failure/);
      assert.equal(canonical((await local.read()).state), canonical(legacyState), 'V13.144 옮기다 실패해도 학생 데이터를 잃지 않아야 합니다.');
      assert.equal(storage.count('voca_rows'), 0, 'V13.144 실패한 옮기기의 반쪽 조각은 남지 않아야 합니다.');
      // 옛 방식으로도 저장은 된다.
      const changed = structuredClone(legacyState); changed.sessions.push({ id: 's-2', student_id: 'student-0', correct: 1, total: 1 });
      await local.commit(changed, 7);
      const retry = createLocalRepository(storage, { log: quiet });
      assert.equal(retry.format(), 'parts', 'V13.144 다음 시작 때 다시 옮겨야 합니다.');
      assert.equal(canonical((await retry.read()).state), canonical(changed), 'V13.144 옛 방식으로 저장한 것까지 옮겨야 합니다.');
    }
    {
      // 상태 객체 전체로: 옛 스냅숏이 있는 저장소에서 켜면 옮기고 같은 상태로 시작, 옮기기 실패면 경고를 보인다.
      const supa = fakeSupabase(legacyState);
      supa.remote.failReads = true; // Supabase가 안 돼도 로컬로 시작해야 한다
      globalThis.fetch = supa.fetch;
      const storage = createStorageMock();
      storage.writeLegacySnapshot(legacyState, { version: 7, synced_version: 7, supabase_revision: 1 });
      storage.failNextWrite(/voca_rows/);
      const object = new VocaStateObject(ctxFor(storage), env);
      await object.ready;
      object.sync.close();
      assert(object.mutations.current().state.sessions.some(item => item.id === 's-1'), 'V13.144 옮기기가 실패해도 옛 데이터로 켜져야 합니다.');
      const health = (await clientFor(object)('/api/health')).payload;
      assert.match(health.boot_warning || '', /옛 저장 방식/, 'V13.144 옮기기 실패는 /api/health의 시작 경고로 보여야 합니다.');
    }

    /* ---------- 4. 연달아 오는 저장은 모아서 한 번에(응답은 저장이 끝난 뒤) ---------- */
    {
      const commits = [];
      const repo = { async commit(state, revision) { commits.push(state.n); return revision + 1; }, async read() { return { revision: 0, state: { n: 0 } }; } };
      const coordinator = createMutationCoordinator(repo, { revision: 0, state: { n: 0 } }, { groupMs: 120 });
      await coordinator.durable(state => { state.n = 1; return 1; });
      assert.deepEqual(commits, [1], '쉬고 있다가 온 저장은 바로 써야 합니다.');
      const started = Date.now();
      const answers = await Promise.all([2, 3, 4, 5].map(n => coordinator.durable(state => { state.n = n; return n; })));
      assert.deepEqual(answers, [2, 3, 4, 5]);
      assert.deepEqual(commits, [1, 5], `V13.144 연달아 온 저장 4개는 한 번에 써야 합니다: ${commits.join(', ')}`);
      assert(Date.now() - started >= 100, '모으는 동안 기다렸다가 저장이 끝난 뒤에 답해야 합니다.');
      await coordinator.close();
    }

    /* ---------- 5. 시작 중 정리가 던져도 켜진다 · 시작하지 못하면 503 JSON ---------- */
    {
      const broken = await sampleState();
      broken.battles = [null]; // sweep(tidyBattles)이 b.status에서 던진다
      const supa = fakeSupabase(broken);
      globalThis.fetch = supa.fetch;
      const object = new VocaStateObject(ctxFor(createStorageMock()), env);
      await object.ready;
      object.sync.close();
      const health = (await clientFor(object)('/api/health')).payload;
      assert(health.ok && /시작 정리 실패/.test(health.boot_warning || ''), `V13.144 시작 중 정리가 던져도 켜지고 경고를 보여야 합니다: ${health.boot_warning}`);

      // 로컬 사본도 없고 Supabase도 안 될 때: 상태 객체가 1101 대신 503 JSON(원인 포함).
      supa.remote.failReads = true;
      const dead = new VocaStateObject(ctxFor(createStorageMock()), env);
      const failed = await dead.fetch(new Request('https://sumus-voca.example/api/health'));
      const body = await failed.json();
      assert(failed.status === 503 && body.error === BOOT_FAIL_MESSAGE && body.cause.length > 0 && body.cause.length <= 300, `V13.144 시작하지 못하면 503 JSON과 원인을 보여야 합니다: ${JSON.stringify(body)}`);
      const other = await (await dead.fetch(new Request('https://sumus-voca.example/api/bootstrap'))).json();
      assert(!('cause' in other), '원인 문구는 /api/health에만 보여야 합니다.');

      // 워커 기본 fetch: 상태 객체 호출이 던지면 1101 대신 JSON 503.
      const throwingEnv = { VOCA_STATE: { idFromName: name => name, get: () => ({ fetch: async () => { throw new Error('Exceeded allowed rows written in Durable Objects free tier.'); } }) } };
      const reply = await worker.fetch(new Request('https://sumus-voca.example/api/health'), throwingEnv);
      const replyBody = await reply.json();
      assert(reply.status === 503 && replyBody.error === BOOT_FAIL_MESSAGE && /rows written/.test(replyBody.cause), `V13.144 워커는 503 JSON으로 답해야 합니다: ${JSON.stringify(replyBody)}`);
      assert.equal(reply.headers.get('content-type'), 'application/json; charset=utf-8');
    }

    /* ---------- 6. 70% 경고 · 90% 미루기 · 날이 바뀌면 다시 0 ---------- */
    {
      const supa = fakeSupabase(await sampleState());
      globalThis.fetch = supa.fetch;
      const storage = createStorageMock();
      const object = new VocaStateObject(ctxFor(storage), env);
      const call = clientFor(object);
      await object.ready;
      object.sync.close();
      const teacher = await loginAs(call, 'teacher_one', 'teacher');
      assert.equal((await call('/api/bootstrap', { cookie: teacher })).payload.server_write_warning, undefined, '평소에는 경고가 없어야 합니다.');
      object.local.countRows(Math.ceil(CF_FREE_PLAN.rowsWrittenPerDay * 0.72));
      const warned = (await call('/api/bootstrap', { cookie: teacher })).payload.server_write_warning;
      assert(warned?.text === '오늘 서버 저장량이 많아요(72%)' && warned.defer === false, `V13.144 70%를 넘으면 선생님 첫 화면에 경고: ${JSON.stringify(warned)}`);
      const student = await loginAs(call, 'student_0');
      assert.equal((await call('/api/bootstrap', { cookie: student })).payload.server_write_warning, undefined, '학생에게는 경고를 보이지 않아야 합니다.');
      object.local.countRows(Math.ceil(CF_FREE_PLAN.rowsWrittenPerDay * 0.2));
      assert.equal(object.writeLevel(), 'defer');
      // 90%: 시간마다 하는 정리는 미룬다(쓸 것이 있어도 쓰지 않는다).
      object.sweptAt = 0;
      object.mutations.current().state.tokens.push({ hash: 'old', user_id: 'x', expires_at: 1 });
      const before = storage.rowsWritten;
      await call('/api/bootstrap', { cookie: student });
      assert.equal(storage.rowsWritten - before, 0, 'V13.144 90%를 넘으면 급하지 않은 정리를 다음 날로 미뤄야 합니다.');
      assert((await call('/api/bootstrap', { cookie: teacher })).payload.server_write_warning.defer, '90%에는 미루는 중이라고 알려야 합니다.');
      const teacherUi = readFileSync(new URL('../public/modules/teacher.js', import.meta.url), 'utf8');
      const css = readFileSync(new URL('../public/app.bundle.css', import.meta.url), 'utf8');
      assert(teacherUi.includes('${serverWriteWarning(d)}') && teacherUi.includes('d?.server_write_warning') && css.includes('.server-write-warning-v13144'), 'V13.144 선생님 첫 화면이 서버 저장량 경고를 보여야 합니다.');

      // UTC 날이 바뀌면 0부터 다시 센다.
      let clock = Date.parse('2026-10-12T23:59:00Z');
      const dayStorage = createStorageMock();
      const local = createLocalRepository(dayStorage, { log: quiet, now: () => clock });
      await local.commit({ a: 1 }, -1);
      assert.equal(local.writeStats().day, '2026-10-12');
      clock = Date.parse('2026-10-13T00:01:00Z');
      assert.deepEqual([local.writeStats().day, local.writeStats().rows], ['2026-10-13', 0], 'V13.144 한도는 UTC 0시(한국 오전 9시)에 다시 센다.');
      assert.equal(utcDay(Date.parse('2026-10-13T08:59:00+09:00')), '2026-10-12');
    }

    console.log(`[write-budget-check] PASS answer rows ${results.answer.perAnswer.join('/')} (local ${results.answer.perCommit.join('/')}) · no-op ${results.noop} rows · legacy move · group commit · boot failures · 70%/90%`);
  } finally {
    globalThis.fetch = nativeFetch;
  }
}
