import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { passwordHash } from './auth.mjs';
import { emptyState } from './state.mjs';
import { builtinBooks } from './service.mjs';
import { VocaStateObject } from '../cloudflare/worker.mjs';
import { createLocalRepository, createSupabaseSync } from '../cloudflare/local-first.mjs';
import { assembleState } from '../cloudflare/state-parts.mjs';
import { runBattleRoomChecks } from './battle-room-check.mjs';
import { runDungeonRoomChecks } from './dungeon-room-check.mjs';

const deepCopy = value => structuredClone(value);

// Minimal stand-in for a SQLite-backed Durable Object's ctx.storage, backed by
// node:sqlite so the real SQL statements run.
function createStorageMock() {
  const db = new DatabaseSync(':memory:');
  let failWrites = 0;
  return {
    alarm: null,
    failNextWrite() { failWrites += 1; },
    sql: {
      exec(query, ...bindings) {
        if (failWrites > 0 && /^\s*(INSERT|DELETE)/i.test(query)) {
          failWrites -= 1;
          throw new Error('simulated disk failure');
        }
        const statement = db.prepare(query);
        const rows = /^\s*SELECT/i.test(query) ? statement.all(...bindings) : (statement.run(...bindings), []);
        return { toArray: () => rows, one: () => rows[0] };
      }
    },
    transactionSync(callback) {
      db.exec('BEGIN');
      try { const result = callback(); db.exec('COMMIT'); return result; }
      catch (error) { db.exec('ROLLBACK'); throw error; }
    },
    setAlarm(time) { this.alarm = time; },
    // Key-value API of ctx.storage (V13.99: last successful backup time).
    kv: new Map(),
    // Like the real API: a key or a list of keys (-> Map), a key and value or an object of entries.
    async get(key) { return Array.isArray(key) ? new Map(key.filter(k => this.kv.has(k)).map(k => [k, this.kv.get(k)])) : this.kv.get(key); },
    async put(key, value) { if (typeof key === 'object') for (const [k, v] of Object.entries(key)) this.kv.set(k, v); else this.kv.set(key, value); }
  };
}

export async function runCloudflareCheck() {
  const book = builtinBooks.find(item => item.school === '단원고');
  assert(book?.words?.length, '단원고 단어 데이터가 존재해야 합니다.');

  const originalHash = await passwordHash('Student123!');
  const state = emptyState();
  state.profiles.push({
    id: 'student-preserved', role: 'student', username: 'student_preserved',
    password_hash: originalHash, display_name: '이관보존', class_name: '고1A',
    school_id: 'danwon-high', school: '단원고', active: true,
    avatar_key: 'terra', ranking_public: true, created_at: Date.now() - 86400000
  });
  state.sessions.push({
    id: 'session-preserved', student_id: 'student-preserved', school_id: 'danwon-high',
    school: '단원고', range_codes: [book.words[0].range_code], mode: 'word_to_meaning',
    correct: 30, total: 30, xp: 900, best_combo: 30, duration_sec: 240,
    created_at: Date.now() - 3600000
  });

  let persisted = deepCopy(state);
  let revision = 41;
  let commits = 0;
  let holdNextCommit = null;
  let failNextCommit = false;
  let failAfterCommit = false;
  let failReads = 0;
  // Parts backup (supabase/voca_v13_parts.sql): absent (404) until a test turns it on.
  const partsStore = { enabled: false, revision: 0, parts: {}, patches: [], loseNextAnswer: false };
  const nativeFetch = globalThis.fetch;
  globalThis.fetch = async (url, options = {}) => {
    const name = String(url).split('/').at(-1);
    const body = JSON.parse(options.body || '{}');
    if (name === 'voca_v12_state_read') {
      assert.equal(body.p_secret, 'test-state-secret');
      if (failReads > 0) {
        failReads -= 1;
        return Response.json({ message: 'temporary storage failure' }, { status: 503 });
      }
      return Response.json([{ revision, data: deepCopy(persisted) }]);
    }
    if (name === 'voca_v12_state_commit') {
      assert.equal(body.p_secret, 'test-state-secret');
      if (failNextCommit) {
        failNextCommit = false;
        return Response.json({ message: 'temporary storage failure' }, { status: 503 });
      }
      if (holdNextCommit) {
        const hold = holdNextCommit;
        holdNextCommit = null;
        hold.started();
        await hold.release;
      }
      if (Number(body.p_revision) !== revision) {
        return Response.json({ code: '40001', message: 'revision_conflict' }, { status: 409 });
      }
      persisted = deepCopy(body.p_data);
      revision += 1;
      commits += 1;
      if (failAfterCommit) {
        failAfterCommit = false;
        return Response.json({ message: 'response lost after commit' }, { status: 503 });
      }
      return Response.json(revision);
    }
    if (name.startsWith('voca_v13_')) {
      if (!partsStore.enabled) return Response.json({ code: 'PGRST202', message: `Could not find the function public.${name}` }, { status: 404 });
      assert.equal(body.p_secret, 'test-state-secret');
      if (name === 'voca_v13_state_revision') return Response.json(partsStore.revision);
      if (name === 'voca_v13_state_read') return Response.json([{ revision: partsStore.revision, parts: deepCopy(partsStore.parts) }]);
      if (name === 'voca_v13_state_patch') {
        if (Number(body.p_revision) !== partsStore.revision) return Response.json({ code: '40001', message: 'revision_conflict' }, { status: 409 });
        Object.assign(partsStore.parts, deepCopy(body.p_parts));
        for (const key of body.p_removed || []) delete partsStore.parts[key];
        partsStore.revision += 1;
        partsStore.patches.push({ keys: Object.keys(body.p_parts), removed: body.p_removed || [], bytes: options.body.length });
        if (partsStore.loseNextAnswer) { partsStore.loseNextAnswer = false; return Response.json({ message: 'response lost after commit' }, { status: 503 }); }
        return Response.json(partsStore.revision);
      }
    }
    throw new Error(`unexpected RPC: ${name}`);
  };

  const storage = createStorageMock();
  const env = {
    SUPABASE_URL: 'https://example.supabase.co',
    SUPABASE_ANON_KEY: 'test-anon-key',
    VOCA_STATE_SECRET: 'test-state-secret'
  };
  // A new object on the same storage is what a Durable Object restart looks like.
  const boot = () => new VocaStateObject({ storage, blockConcurrencyWhile: callback => callback(), waitUntil: () => {} }, env);
  const client = object => async (path, options = {}) => {
    const response = await object.fetch(new Request(`https://sumus-voca.example${path}`, {
      method: options.method || 'GET',
      headers: {
        ...(options.body === undefined ? {} : { 'content-type': 'application/json' }),
        ...(options.cookie ? { cookie: options.cookie } : {}),
        origin: 'https://sumus-voca.example'
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body)
    }));
    const payload = await response.json();
    assert.equal(response.status, options.status || 200, JSON.stringify(payload));
    return { response, payload };
  };
  const practiceBody = { school: '단원고', range_codes: [book.words[0].range_code], mode: 'eng2mean', target: 10 };

  try {
    let object = boot();
    let call = client(object);
    const syncNow = async () => { await object.ready; await object.sync.run(); };

    const login = await call('/api/login', {
      method: 'POST', body: { username: 'student_preserved', password: 'Student123!', role: 'student' }
    });
    const cookie = login.response.headers.get('set-cookie').split(';')[0];
    assert.equal(login.payload.profile.id, 'student-preserved');
    assert.match(login.response.headers.get('server-timing') || '', /app;dur=\d+, commit;dur=\d+;desc="local \d+ bytes", supabase;dur=\d+/, '저장 요청은 Server-Timing으로 로컬 저장·Supabase 업로드 시간을 알려야 합니다.');
    await call('/api/login', {
      method: 'POST', status: 401, body: { username: 'student_preserved', password: 'wrong-password', role: 'student' }
    });

    const bootstrap = await call('/api/bootstrap', { cookie });
    assert.equal(bootstrap.payload.stats.points, 900, '기존 XP가 그대로 노출되어야 합니다.');
    assert.equal(bootstrap.payload.stats.practice_count, 1, '기존 학습 기록이 보존되어야 합니다.');
    assert.equal(bootstrap.payload.profile.avatar_key, 'terra', '기존 캐릭터가 보존되어야 합니다.');

    // 1. Answers no longer wait for Supabase.
    const practice = await call('/api/practice/start', { method: 'POST', cookie, body: practiceBody });
    await syncNow();
    let commitStarted;
    let releaseCommit;
    const started = new Promise(resolve => { commitStarted = resolve; });
    const release = new Promise(resolve => { releaseCommit = resolve; });
    holdNextCommit = { started: commitStarted, release };
    const answer = await call(`/api/practice/${practice.payload.id}/answer`, {
      method: 'POST', cookie,
      body: { question_id: practice.payload.question_id, answer: '__cloudflare_check__', prefetch_next: true }
    });
    assert.equal(typeof answer.payload.feedback.ok, 'boolean', 'Supabase 업로드가 멈춰 있어도 답안은 바로 응답해야 합니다.');
    const pendingSync = object.sync.run();
    await started;
    assert.equal(persisted.practices.find(item => item.id === practice.payload.id)?.answer_records?.length || 0, 0, '업로드가 끝나기 전에는 Supabase에 반영되지 않아야 합니다.');

    // 2. The answer is already durable on the object's own disk.
    const onDisk = await createLocalRepository(storage).read();
    assert.equal(onDisk.state.practices.find(item => item.id === practice.payload.id).total, 1, '응답 전에 답안이 로컬 디스크에 저장되어 있어야 합니다.');
    releaseCommit();
    await pendingSync;
    assert.equal(persisted.practices.find(item => item.id === practice.payload.id).answer_records.length, 1, '백그라운드 업로드 후 Supabase에 답안이 반영되어야 합니다.');

    // 3. Supabase stored the upload but the response was lost -> no duplicate, retry succeeds.
    const nextQuestion = answer.payload.prefetched_next;
    assert(nextQuestion?.question_id, '다음 문제를 미리 받아야 합니다.');
    await call(`/api/practice/${practice.payload.id}/answer`, {
      method: 'POST', cookie, body: { question_id: nextQuestion.question_id, answer: '__cloudflare_retry__', prefetch_next: true }
    });
    failAfterCommit = true;
    await assert.rejects(syncNow(), '응답 유실은 동기화 실패로 보고되어야 합니다.');
    await syncNow();
    assert.equal(persisted.practices.find(item => item.id === practice.payload.id).answer_records.length, 2, '업로드 응답이 유실돼도 답안이 중복되지 않아야 합니다.');
    assert.equal(object.sync.status().pending, false, '재시도 후 동기화 대기가 없어야 합니다.');

    await call(`/api/practice/${practice.payload.id}/finish`, { method: 'POST', cookie, body: {} });
    await syncNow();

    // 4. Supabase outage: students keep working, backup catches up later.
    failNextCommit = true;
    const duringOutage = await call('/api/practice/start', { method: 'POST', cookie, body: practiceBody });
    await assert.rejects(syncNow());
    assert(!persisted.practices.some(item => item.id === duringOutage.payload.id), '장애 중에는 Supabase에 아직 없어야 합니다.');
    const health = await call('/api/health');
    assert.equal(health.payload.storage.mode, 'local-first');
    assert.equal(health.payload.storage.supabase_pending, true, '상태 점검에서 백업 대기를 보여야 합니다.');
    assert(health.payload.storage.state_breakdown?.keys_kb?.sessions >= 0 && Number.isInteger(health.payload.storage.state_breakdown.practices.active), '상태 점검에서 항목별 크기를 보여야 합니다.');
    // V13.99: when the backup last succeeded (kept in ctx.storage) and how it is stored.
    const lastOk = health.payload.storage.supabase_last_ok_at;
    assert(Number.isFinite(lastOk) && lastOk > 0 && lastOk <= Date.now(), `V13.99 상태 점검에서 마지막 백업 성공 시각을 보여야 합니다: ${lastOk}`);
    assert.equal(storage.kv.get('supabase_last_ok_at'), lastOk, 'V13.99 마지막 백업 성공 시각은 ctx.storage에 저장해야 합니다.');
    assert.equal(health.payload.storage.supabase_backup_mode, 'full', 'V13.99 상태 점검에서 백업 방식(full)을 보여야 합니다.');

    // 5. Restart with changes Supabase has not received: local wins, then uploads.
    object.sync.close();
    failReads = 1;
    object = boot();
    call = client(object);
    await object.ready;
    assert.equal(failReads, 1, '미동기화 변경이 있으면 Supabase를 읽지 않고 로컬로 시작해야 합니다.');
    failReads = 0;
    assert(object.mutations.current().state.practices.some(item => item.id === duringOutage.payload.id), '미동기화 로컬 변경이 재시작 후에도 유지되어야 합니다.');
    const afterRestart = await call('/api/health');
    assert.equal(afterRestart.payload.storage.supabase_last_ok_at, lastOk, 'V13.99 재시작 뒤에도 마지막 백업 성공 시각이 남아 있어야 합니다.');
    await syncNow();
    assert(persisted.practices.some(item => item.id === duringOutage.payload.id), '복구 후 Supabase가 따라잡아야 합니다.');

    // 6. Local disk failure -> request fails and nothing half-applied remains.
    storage.failNextWrite();
    const beforeFailure = deepCopy(object.mutations.current().state);
    await call(`/api/practice/${duringOutage.payload.id}/finish`, { method: 'POST', cookie, body: {}, status: 503 });
    await call('/api/health');
    assert.deepEqual(object.mutations.current().state.practices, beforeFailure.practices, '로컬 저장 실패는 적용되지 않아야 합니다.');

    // 7. Supabase restored from a backup while the local copy is fully synced -> adopt it.
    await syncNow();
    persisted = deepCopy(persisted);
    persisted.profiles[0].display_name = '백업복원';
    revision += 5;
    object.sync.close();
    object = boot();
    call = client(object);
    const restored = await call('/api/bootstrap', { cookie });
    assert.equal(restored.payload.profile.display_name, '백업복원', '외부에서 복원된 Supabase 데이터를 받아들여야 합니다.');

    const concurrent = await Promise.all(Array.from({ length: 200 }, () => call('/api/health')));
    assert(concurrent.every(item => item.payload.ok), '동시 API 200건이 모두 성공해야 합니다.');
    assert.equal(persisted.profiles[0].password_hash, originalHash, '비밀번호 해시는 재생성하지 않고 그대로 보존해야 합니다.');
    assert(persisted.sessions.some(item => item.id === 'session-preserved'), '기존 학습 기록이 영구 저장에 남아야 합니다.');
    assert(persisted.mastery['student-preserved'], '신규 정답 데이터가 영구 저장되어야 합니다.');

    // 8. Minimum upload interval: after a successful upload the next one waits, and a
    //    newer snapshot is not uploaded back to back.
    {
      let version = 1, synced = 0, uploads = 0, alarmAt = null;
      const fakeLocal = { status: () => ({ version, syncedVersion: synced, supabaseRevision: 1 }), latest: () => ({ version, json: '{}' }), markSynced(v) { synced = v; } };
      const fakeRemote = { async commitSerialized() { uploads += 1; version += uploads === 1 ? 1 : 0; return 2; } };
      const sync = createSupabaseSync({ local: fakeLocal, supabase: fakeRemote, storage: { setAlarm(at) { alarmAt = at; } }, minIntervalMs: 60000, log: { warn() {}, error() {} } });
      await sync.run();
      assert.equal(uploads, 1, '최소 간격이 있으면 새 스냅샷을 연달아 올리지 않아야 합니다.');
      assert.equal(sync.pending(), true);
      assert(alarmAt >= Date.now() + 60000, '다음 업로드는 최소 간격 뒤로 예약되어야 합니다.');
      sync.close();
    }

    // 9. Parts backup (supabase/voca_v13_parts.sql): once the functions exist, only the
    //    parts that changed are uploaded, a lost answer is retried safely, a periodic full
    //    v12 copy is still stored, and an object without a local copy restores from parts.
    {
      object.sync.close();
      partsStore.enabled = true;
      object = boot();
      call = client(object);
      await object.ready;
      const partsLogin = await call('/api/login', { method: 'POST', body: { username: 'student_preserved', password: 'Student123!', role: 'student' } });
      const partsCookie = partsLogin.response.headers.get('set-cookie').split(';')[0];
      const commitsBefore = commits;
      await object.sync.run();
      assert.equal(object.sync.status().mode, 'parts', '파트 함수가 있으면 파트 백업을 써야 합니다.');
      const partsHealth = (await call('/api/health')).payload.storage;
      assert(partsHealth.supabase_backup_mode === 'parts' && partsHealth.supabase_last_ok_mode === 'parts' && partsHealth.supabase_last_ok_at >= lastOk, 'V13.99 상태 점검에서 백업 방식(parts)과 마지막 성공을 보여야 합니다.');
      assert(partsStore.revision >= 1 && partsStore.parts['o:keys'] && partsStore.parts['k:profiles'], '첫 파트 백업은 모든 파트를 올려야 합니다.');
      assert.equal(commits, commitsBefore + 1, '파트 백업 중에도 전체 사본(v12)을 주기적으로 남겨야 합니다.');

      const run = await call('/api/practice/start', { method: 'POST', cookie: partsCookie, body: practiceBody });
      await object.sync.run();
      partsStore.patches = [];
      await call(`/api/practice/${run.payload.id}/answer`, { method: 'POST', cookie: partsCookie, body: { question_id: run.payload.question_id, answer: '__parts__' } });
      await object.sync.run();
      const sent = partsStore.patches.flatMap(patch => patch.keys);
      assert(sent.length > 0 && sent.every(key => key.includes('student-preserved') || key.startsWith('o:')), `답 하나에는 그 학생의 파트만 올라가야 합니다: ${sent.join(', ')}`);
      assert(!sent.includes('k:profiles') && !sent.some(key => key.startsWith('a:sessions:')), '바뀌지 않은 파트는 다시 올리지 않아야 합니다.');
      assert.equal(commits, commitsBefore + 1, '전체 사본은 주기(6시간)마다만 올려야 합니다.');

      partsStore.loseNextAnswer = true;
      await call(`/api/practice/${run.payload.id}/next`, { method: 'POST', cookie: partsCookie, body: {} });
      await assert.rejects(object.sync.run(), '응답이 유실되면 이번 동기화는 실패로 보고해야 합니다.');
      await object.sync.run();
      assert.equal(object.sync.status().pending, false, '응답 유실 뒤 재시도로 파트 백업이 따라잡아야 합니다.');

      const canonical = value => JSON.stringify(value, (key, item) => item && typeof item === 'object' && !Array.isArray(item) ? Object.fromEntries(Object.keys(item).sort().map(k => [k, item[k]])) : item);
      const live = object.mutations.current().state;
      const restoredObject = new VocaStateObject({ storage: createStorageMock(), blockConcurrencyWhile: callback => callback(), waitUntil: () => {} }, env);
      await restoredObject.ready;
      assert.equal(canonical(restoredObject.mutations.current().state), canonical(live), '로컬 사본이 없으면 파트 백업에서 똑같이 복원해야 합니다.');
      partsStore.patches = [];
      assert.equal(restoredObject.sync.pending(), false, '파트에서 복원한 직후에는 다시 올릴 것이 없어야 합니다.');
      restoredObject.sync.close();

      const beforeReset = partsStore.revision;
      partsStore.revision += 3; // changed elsewhere (e.g. a manual restore)
      await call(`/api/practice/${run.payload.id}/finish`, { method: 'POST', cookie: partsCookie, body: {} });
      await assert.rejects(object.sync.run(), '다른 곳에서 파트가 바뀌면 이번 동기화는 실패로 보고해야 합니다.');
      await object.sync.run();
      assert(partsStore.revision > beforeReset + 3 && partsStore.patches.some(patch => patch.keys.includes('k:profiles')), '다른 곳에서 바뀌었으면 모든 파트를 다시 올려야 합니다.');
      assert.equal(canonical(assembleState(deepCopy(partsStore.parts))), canonical(object.mutations.current().state), 'Supabase 파트를 합치면 현재 상태와 같아야 합니다.');

      // The periodic v12 copy is older than the parts backup: a restart must not adopt it,
      // even when its revision moved (e.g. a full copy whose answer was lost).
      const beforeRestart = canonical(object.mutations.current().state);
      persisted = deepCopy(state);
      revision += 7;
      object.sync.close();
      object = boot();
      await object.ready;
      assert.equal(canonical(object.mutations.current().state), beforeRestart, '파트 백업 중에는 오래된 v12 사본으로 되돌아가면 안 됩니다.');
      object.sync.close();
    }
    console.log(`[cloudflare-check] PASS local-first storage + ${concurrent.length} concurrent reads (${commits} Supabase commits)`);
  } finally {
    globalThis.fetch = nativeFetch;
  }
}

// pathToFileURL: a hand-built `file://${path}` never matches on Windows, which made this check exit 0 without running.
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  runCloudflareCheck().then(runBattleRoomChecks).then(runDungeonRoomChecks).catch(error => {
    console.error('[cloudflare-check] FAIL', error);
    process.exitCode = 1;
  });
}
