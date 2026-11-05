// V13.214 Supabase 백업 안전 장치 검사(운영에 연결하지 않는다: 가짜 Supabase를 globalThis.fetch로 흉내 낸다).
// 2026-11-03 운영 /api/health: supabase_backup_mode 'checking', failures 6, last_error
// "voca_v13_state_revision: TimeoutError The operation was aborted due to timeout (0 KB)", last_ok_at null.
//   1. 답 없음(타임아웃) · 503 · 404(조각 함수만 / 전부 없음) · 401 · 일시정지(HTTP 540) 각각 health 상태값
//   2. 6시간 넘게 실패하면 선생님 첫 화면에만 경고 한 줄(학생 · 5시간에는 없음), 다시 시작해도 실패 시작 시각 유지
//   3. 복구되면 밀린 조각을 250KB 묶음으로 올리고 상태 ok · failures 0 · lag 0 · 경고 사라짐
//   4. 묶음 사이에 요청이 오면 쉬었다가 이어 올린다(#262 미루기 유지) · 실패한 다시 하기 한 번은 CPU를 거의 안 쓴다
//   5. 30분 넘게 실패하면 다시 하기 간격 5분
// release-check.mjs(npm run check)가 부른다. 단독: node server/supabase-backup-check.mjs
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import nodeAssert from 'node:assert/strict';
import { createStorageMock } from './storage-mock.mjs';
import { VocaStateObject } from '../cloudflare/worker.mjs';
import { createLocalRepository, createSupabaseSync, backupState, backupErrorKind, SYNC_FAILING_MS, SYNC_WARN_MS, SYNC_FAIL_SLOW_RETRY_MS, BACKUP_GUIDE_URL } from '../cloudflare/local-first.mjs';
import { partitionState, assembleState } from '../cloudflare/state-parts.mjs';
import { sampleState, clientFor, loginAs } from './write-budget-check.mjs';

const canonical = value => JSON.stringify(value, (key, item) => item && typeof item === 'object' && !Array.isArray(item) ? Object.fromEntries(Object.keys(item).sort().map(k => [k, item[k]])) : item);
const quiet = { warn() {}, error() {} };
const env = { SUPABASE_URL: 'https://example.supabase.co', SUPABASE_ANON_KEY: 'k', VOCA_STATE_SECRET: 's', VOCA_COMMIT_GROUP_MS: 0, SUPABASE_SYNC_MIN_INTERVAL_MS: 3600000 };
const ctxFor = storage => ({ storage, blockConcurrencyWhile: callback => callback(), waitUntil: () => {} });

// 가짜 Supabase. fail: null(정상) | 'timeout' | '503' | '404-parts'(조각 함수만 없음) | '404-all' | '401' | 'paused'.
// 'paused': Supabase가 일시정지된 프로젝트의 API에 돌려주는 HTTP 540(문서의 "Project paused")을 흉내 낸다.
// 실제로는 정지 직후 · 재시작 중에 답이 없거나(타임아웃) 503이 올 수도 있어서, 그 경우는 timeout · 503으로 따로 본다.
export function fakeSupabase(state) {
  const remote = { revision: 1, data: structuredClone(state), parts: {}, partsRevision: 0, patches: [], fail: null, signals: 0, onPatch: null };
  const fetch = async (url, options = {}) => {
    const name = String(url).split('/').at(-1);
    if (options.signal) remote.signals += 1;
    const body = JSON.parse(options.body || '{}');
    const isParts = name.startsWith('voca_v13_');
    const fail = remote.fail;
    // 시작할 때 읽기(v12 read)는 언제나 된다(로컬 사본이 있으면 어차피 로컬로 시작한다).
    if (name !== 'voca_v12_state_read' && fail) {
      if (fail === 'timeout') throw new DOMException('The operation was aborted due to timeout', 'TimeoutError');
      if (fail === '503') return Response.json({ message: 'upstream connect error or disconnect/reset before headers' }, { status: 503 });
      if (fail === '401') return Response.json({ message: 'Invalid API key' }, { status: 401 });
      if (fail === 'paused') return Response.json({ message: 'Project paused. Restore it from the Supabase dashboard.' }, { status: 540 });
      if (fail === '404-all' || (fail === '404-parts' && isParts)) return Response.json({ code: 'PGRST202', message: `Could not find the function public.${name}` }, { status: 404 });
    }
    if (name === 'voca_v12_state_read') return Response.json([{ revision: remote.revision, data: structuredClone(remote.data) }]);
    if (name === 'voca_v12_state_commit') {
      if (Number(body.p_revision) !== remote.revision) return Response.json({ code: '40001', message: 'revision_conflict' }, { status: 409 });
      remote.data = body.p_data; remote.revision += 1;
      return Response.json(remote.revision);
    }
    if (name === 'voca_v13_state_revision') return Response.json(remote.partsRevision);
    if (name === 'voca_v13_state_read') return Response.json([{ revision: remote.partsRevision, parts: structuredClone(remote.parts) }]);
    if (name === 'voca_v13_state_patch') {
      if (Number(body.p_revision) !== remote.partsRevision) return Response.json({ code: '40001', message: 'revision_conflict' }, { status: 409 });
      Object.assign(remote.parts, body.p_parts);
      for (const key of body.p_removed || []) delete remote.parts[key];
      remote.partsRevision += 1;
      remote.patches.push({ keys: Object.keys(body.p_parts), bytes: options.body.length });
      remote.onPatch?.();
      return Response.json(remote.partsRevision);
    }
    throw new Error(`unexpected RPC: ${name}`);
  };
  return { remote, fetch };
}

const healthOf = async object => (await clientFor(object)('/api/health')).payload.storage;
// Date.now()를 잠깐 앞당겨(몇 시간 뒤) 부른다.
async function later(ms, fn) {
  const real = Date.now;
  Date.now = () => real() + ms;
  try { return await fn(); } finally { Date.now = real; }
}
const pick = s => ({ status: s.supabase_status, kind: s.supabase_fail_kind, mode: s.supabase_backup_mode, failures: s.supabase_failures, pending: s.supabase_pending, last_ok: s.supabase_last_ok_at ? 'O' : null, error: String(s.supabase_last_error || '').slice(0, 120) });

// release-check가 넘기는 assert는 함수 하나뿐이라 node:assert를 쓴다.
export async function runSupabaseBackupChecks(_releaseAssert, assert = nodeAssert) {
  const nativeFetch = globalThis.fetch;
  const table = {};
  try {
    /* ---------- 0. 원인 종류 나누기 ---------- */
    assert.equal(backupErrorKind({ status: 503, http: 0, detail: 'voca_v13_state_revision: TimeoutError The operation was aborted due to timeout (0 KB)' }), 'timeout', '운영 오류 문구는 timeout');
    assert.equal(backupErrorKind({ status: 503, http: 540, detail: 'x: HTTP 540 Project paused (0 KB)' }), 'paused');
    assert.equal(backupErrorKind({ status: 404, http: 404 }), 'missing');
    assert.equal(backupErrorKind({ status: 503, http: 401, detail: 'x: HTTP 401 Invalid API key' }), 'auth');
    assert.equal(backupErrorKind({ status: 503, http: 503 }), 'server');
    assert.equal(backupErrorKind({ status: 503, http: 0, detail: 'x: TypeError fetch failed' }), 'network');

    /* ---------- 1. 경우마다 health에 찍히는 값 ---------- */
    const cases = [
      ['timeout', { now: 'delayed', after30: 'paused_suspected', kind: 'timeout', mode: 'checking' }],
      ['503', { now: 'delayed', after30: 'failing', kind: 'server', mode: 'checking' }],
      ['paused', { now: 'paused_suspected', after30: 'paused_suspected', kind: 'paused', mode: 'checking' }],
      ['401', { now: 'delayed', after30: 'failing', kind: 'auth', mode: 'checking' }],
      ['404-all', { now: 'delayed', after30: 'failing', kind: 'missing', mode: 'full' }],
      ['404-parts', { now: 'ok', after30: 'ok', kind: null, mode: 'full' }]
    ];
    for (const [fail, want] of cases) {
      const supa = fakeSupabase(await sampleState());
      globalThis.fetch = supa.fetch;
      const object = new VocaStateObject(ctxFor(createStorageMock()), env);
      await object.ready;
      object.sync.close();
      const call = clientFor(object);
      const cookie = await loginAs(call, 'student_0');
      await call('/api/ping', { cookie }).catch(() => {});
      await object.mutations.durable(state => { state.profiles[1].display_name = `바뀜-${fail}`; return true; });
      supa.remote.fail = fail;
      object.lastRequestAt = 0;
      await object.sync.run().catch(() => {});
      if (fail.startsWith('404-all')) await object.sync.run().catch(() => {}); // 404 → full로 바꾼 뒤 v12도 404
      const now = await healthOf(object);
      const after30 = await later(SYNC_FAILING_MS + 60000, () => healthOf(object));
      table[fail] = { ...pick(now), after_30min: after30.supabase_status };
      assert.equal(now.supabase_status, want.now, `V13.214 ${fail}: 처음 상태 ${JSON.stringify(pick(now))}`);
      assert.equal(after30.supabase_status, want.after30, `V13.214 ${fail}: 30분 뒤 상태 ${after30.supabase_status}`);
      assert.equal(now.supabase_fail_kind, want.kind, `V13.214 ${fail}: 원인 종류`);
      assert.equal(now.supabase_backup_mode, want.mode, `V13.214 ${fail}: 백업 방식`);
      assert(typeof now.supabase_status_text === 'string' && now.supabase_status_text.length > 3 && now.supabase_guide_url === BACKUP_GUIDE_URL, `V13.214 ${fail}: 사람이 읽는 말과 안내서 주소`);
      if (want.kind) assert(now.supabase_failures >= 1 && now.supabase_failing_since && now.supabase_last_ok_text === '아직 없음' && now.supabase_pending, `V13.214 ${fail}: 실패 횟수 · 실패 시작 시각`);
      else assert(now.supabase_failures === 0 && now.supabase_last_ok_at && now.supabase_last_ok_text.endsWith('(한국 시간)'), `V13.214 ${fail}: 조각 함수가 없으면 통째로 올려 성공`);
      assert(supa.remote.signals > 0, 'Supabase 요청마다 시간 제한(AbortSignal)이 붙어야 합니다');
    }
    // 운영과 같은 오류 문구가 그대로 보인다.
    assert(/voca_v13_state_revision: TimeoutError The operation was aborted due to timeout \(0 KB\)/.test(table.timeout.error), `V13.214 타임아웃 오류 문구: ${table.timeout.error}`);
    assert(/HTTP 540/.test(table.paused.error) && /HTTP 404 PGRST202/.test(table['404-all'].error), 'V13.214 HTTP 상태가 오류 문구에 남는다');

    /* ---------- 2. 6시간 경고(선생님만) · 다시 시작해도 유지 · 3. 복구 ---------- */
    {
      const state = await sampleState({ students: 30, padKb: 600 });
      const supa = fakeSupabase(state);
      supa.remote.parts = Object.fromEntries([...partitionState(state)].map(([key, text]) => [key, JSON.parse(text)]));
      globalThis.fetch = supa.fetch;
      const storage = createStorageMock();
      let object = new VocaStateObject(ctxFor(storage), env);
      await object.ready;
      object.sync.close();
      let call = clientFor(object);
      // 처음 한 번은 잘 올라간다(조각 백업).
      await object.mutations.durable(s => { s.profiles[1].display_name = '처음'; return true; });
      object.lastRequestAt = 0;
      await object.sync.run();
      assert.equal((await healthOf(object)).supabase_status, 'ok', '처음 백업은 ok');
      // 운영처럼 백업 번호 확인부터 답이 없다.
      supa.remote.fail = 'timeout';
      for (let i = 0; i < 6; i++) await object.mutations.durable(s => { s.profiles[2 + i].display_name = `밀림-${i}`; return true; });
      object.lastRequestAt = 0;
      await assert.rejects(object.sync.run());
      const since = (await healthOf(object)).supabase_failing_since;
      assert(since, '실패 시작 시각');
      // 다시 시작(Durable Object 재시작)해도 실패 시작 시각이 이어진다.
      object = new VocaStateObject(ctxFor(storage), env);
      await object.ready;
      object.sync.close();
      call = clientFor(object);
      assert.equal((await healthOf(object)).supabase_failing_since, since, 'V13.214 다시 시작해도 실패 시작 시각이 남아야 합니다');
      const teacher = await loginAs(call, 'teacher_one', 'teacher');
      const student = await loginAs(call, 'student_0');
      const boot = cookie => call('/api/bootstrap', { cookie }).then(r => r.payload.server_backup_warning);
      assert.equal(await boot(teacher), undefined, '방금 실패했으면 경고 없음');
      assert.equal(await later(5 * 3600000, () => boot(teacher)), undefined, 'V13.214 5시간에는 아직 경고 없음');
      const warned = await later(SYNC_WARN_MS + 60000, () => boot(teacher));
      assert(warned?.text === '데이터 백업이 6시간째 안 되고 있어요' && warned.guide_url === BACKUP_GUIDE_URL && warned.status === 'paused_suspected', `V13.214 6시간 넘으면 선생님 경고: ${JSON.stringify(warned)}`);
      assert.equal(await later(SYNC_WARN_MS + 60000, () => boot(student)), undefined, 'V13.214 학생 화면에는 경고가 없어야 합니다');
      const hours10 = await later(10 * 3600000, () => healthOf(object));
      assert(hours10.supabase_failing_hours >= 9.9 && /10시간째/.test(hours10.supabase_status_text), `V13.214 health에 몇 시간째인지: ${hours10.supabase_status_text}`);
      table.warning = { at_5h: 'none', at_6h: warned.text, student: 'none' };

      // 복구: 밀린 조각을 한꺼번에(250KB 묶음) 올리고 ok로 돌아온다.
      supa.remote.fail = null;
      supa.remote.patches.length = 0;
      object.lastRequestAt = 0;
      await object.sync.run();
      const back = await healthOf(object);
      assert(back.supabase_status === 'ok' && back.supabase_failures === 0 && back.supabase_lag_sec === 0 && !back.supabase_pending && back.supabase_last_ok_at >= since && !back.supabase_failing_since,
        `V13.214 복구 뒤 ok · failures 0 · lag 0: ${JSON.stringify(pick(back))}`);
      assert.equal(canonical(assembleState(structuredClone(supa.remote.parts))), canonical(object.mutations.current().state), 'V13.214 복구 뒤 Supabase 조각을 합치면 지금 상태와 같다');
      assert(supa.remote.patches.every(p => p.bytes < 300_000) && supa.remote.patches.length >= 1, `V13.214 밀린 조각은 250KB 안팎 묶음으로: ${supa.remote.patches.map(p => p.bytes).join(',')}`);
      assert.equal(await boot(teacher), undefined, 'V13.214 복구되면 경고가 사라진다');
      // 다시 시작해도 ok(실패 기록이 끝났다고 저장됨).
      const again = new VocaStateObject(ctxFor(storage), env);
      await again.ready;
      again.sync.close();
      assert.equal((await healthOf(again)).supabase_status, 'ok', 'V13.214 복구 뒤 다시 시작해도 ok');
      table.recovered = pick(back);
    }

    /* ---------- 4. 큰 밀린 조각: 묶음 사이에 요청이 오면 쉬었다 이어 간다 · CPU ---------- */
    {
      const storage = createStorageMock();
      const local = createLocalRepository(storage, { log: quiet });
      // 학생 120명 × 숙련도 · 연습 기록(약 6MB, 조각 수백 개).
      const big = await sampleState({ students: 120 });
      big.mastery = Object.fromEntries(big.profiles.map(p => [p.id, Object.fromEntries(Array.from({ length: 300 }, (_, i) => [`w-${i}`, { seen: i, ok: i % 7, at: 1_700_000_000_000 + i }]))]));
      big.practices = big.profiles.flatMap(p => Array.from({ length: 20 }, (_, i) => ({ id: `${p.id}-p${i}`, student_id: p.id, answers: Array.from({ length: 30 }, (_, j) => ({ w: `w-${j}`, ok: j % 3 > 0 })) })));
      await local.commit(big, -1);
      const sizeKb = Math.round(local.latest().json.length / 1024);
      let busy = false, patches = 0, maxBytes = 0, sawBusyBetween = false;
      const supabase = {
        async partsRevision() { return 0; },
        async readParts() { return { revision: 0, parts: {} }; },
        async patchParts(entries, removed, revision) {
          patches += 1;
          maxBytes = Math.max(maxBytes, entries.reduce((sum, [k, t]) => sum + k.length + t.length, 0));
          if (patches === 2) { busy = true; setTimeout(() => { busy = false; }, 30); }
          if (patches === 3) sawBusyBetween = !busy;
          return revision + 1;
        }
      };
      const sync = createSupabaseSync({ local, supabase, storage, isBusy: () => busy, busyRetryMs: 5, fullEveryMs: 0, log: quiet });
      // 묶음 사이 쉬기는 unref 타이머라서(워커에는 영향 없음) Node에서는 기다리는 동안 붙잡아 둘 타이머가 없으면
      // 프로세스가 조용히 끝나 버린다(v13.214~v13.217: 이 뒤의 release-check 검사 약 45개가 돌지 않고 끝났다).
      const keepAlive = setInterval(() => {}, 1000);
      try { await sync.run(); } finally { clearInterval(keepAlive); }
      sync.close();
      const s = sync.status();
      assert(patches >= 10 && maxBytes <= 260_000 && s.yielded_busy >= 1 && sawBusyBetween && !s.pending && s.last_max_batch_kb <= 254,
        `V13.214 ${sizeKb}KB 밀린 조각: 묶음 ${patches}개 · 가장 큰 묶음 ${Math.round(maxBytes / 1024)}KB · 요청 때문에 쉼 ${s.yielded_busy}번`);
      table.backlog = { state_kb: sizeKb, batches: patches, max_batch_kb: Math.round(maxBytes / 1024), yielded: s.yielded_busy };

      // 실패하는 다시 하기 한 번의 CPU: 답을 기다리는 것뿐이라 짧다(운영처럼 백업 번호 확인부터 실패).
      await local.commit({ ...big, touched: 1 }, local.status().version);
      const failing = createSupabaseSync({ local, supabase: { async partsRevision() { throw Object.assign(Error('x'), { status: 503, http: 0, detail: 'voca_v13_state_revision: TimeoutError The operation was aborted due to timeout (0 KB)' }); } }, storage, log: quiet });
      const cpu0 = process.cpuUsage();
      for (let i = 0; i < 20; i++) await failing.run().catch(() => {});
      const cpuMs = (process.cpuUsage(cpu0).user + process.cpuUsage(cpu0).system) / 1000 / 20;
      failing.close();
      assert(cpuMs < 20, `V13.214 실패한 백업 다시 하기 한 번의 CPU ${cpuMs.toFixed(2)}ms(20ms 아래)`);
      table.retry_cpu_ms = Number(cpuMs.toFixed(2));
    }

    /* ---------- 5. 오래 실패하면 다시 하기 간격 5분 · #262 미루기 그대로 ---------- */
    {
      const src = readFileSync(new URL('../cloudflare/local-first.mjs', import.meta.url), 'utf8');
      assert(SYNC_FAIL_SLOW_RETRY_MS === 300000 && src.includes('Date.now() - failSince >= SYNC_FAILING_MS ? SYNC_FAIL_SLOW_RETRY_MS'), 'V13.214 30분 넘게 실패하면 5분마다 다시 해 본다');
      assert(src.includes('if (now - busySince < SYNC_BUSY_DEFER_MAX_MS) { deferred += 1;') && src.includes('if (i > 0) await yieldWhileBusy();'), 'V13.212 시작 미루기 + V13.214 묶음 사이 쉬기');
      const ui = readFileSync(new URL('../public/modules/teacher.js', import.meta.url), 'utf8');
      assert(ui.includes('${serverBackupWarning(d)}') && ui.includes('d?.server_backup_warning') && ui.includes('안내서 보기'), 'V13.214 선생님 첫 화면이 백업 경고를 보여야 합니다');
      const doc = readFileSync(new URL('../docs/supabase-backup-runbook.md', import.meta.url), 'utf8');
      assert(/Restore/.test(doc) && /supabase_failures/.test(doc) && /supabase_status/.test(doc), 'V13.214 선생님 안내서(docs/supabase-backup-runbook.md)');
    }
    console.log('[supabase-backup-check] PASS', JSON.stringify(table));
    return table;
  } finally {
    globalThis.fetch = nativeFetch;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runSupabaseBackupChecks().catch(error => { console.error('[supabase-backup-check] FAIL', error); process.exitCode = 1; });
}
