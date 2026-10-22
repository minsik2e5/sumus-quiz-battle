export const NO_MUTATION = Symbol('no-mutation');

function compactState(state) {
  if (!state || typeof state !== 'object') return state;
  // V13.157 끝난 연습이 있을 때만 지난 기록 전체로 id 묶음을 만든다(답마다 수만 개를 훑지 않게).
  if (Array.isArray(state.practices) && state.practices.some(item => item?.finished)) {
    const sessionIds = new Set(Array.isArray(state.sessions) ? state.sessions.map(item => item?.id) : []);
    state.practices = state.practices.filter(item => !item?.finished || (Number(item?.total || 0) > 0 && !sessionIds.has(item.id)) || Number(item?.finished_at || 0) > Date.now() - 10 * 60000);
  }
  if (Array.isArray(state.tokens)) state.tokens = state.tokens.filter(item => Number(item?.expires_at || 0) > Date.now());
  return state;
}

// V13.155 렉 줄이기: 변경마다 상태 전체를 깊게 복사하면(운영 9MB, 한 번에 약 100ms) 반 전체가 연습할 때 줄이 밀린다.
// V13.157 고침: 얕은 복사는 연습 중 답 · 다음 · 패스(fast)에만 쓴다. 이때 지난 연습 기록(sessions)은 배열만 새로 만들고
// 숙련도(mastery)는 그 연습을 하는 학생 묶음(own)만 깊게 복사한다. 이 세 요청은 다른 기록 · 다른 학생 숙련도를 고치지
// 않는다(server/practice-speed-check.mjs가 얼려서 확인). 나머지 변경은 예전처럼 전체를 깊게 복사한다: 변경 도중 실패하면
// 고친 것이 이전 상태에 남지 않아야 하고(같이 쓰는 객체를 고치면 실패해도 남아서 다음 저장에 섞였다), 저장 중인 상태를
// 다음 변경이 건드리면 안 되기 때문이다.
export const SHALLOW_KEYS = ['sessions', 'mastery'];
// V13.168 나머지 변경도 지난 연습 기록(sessions, 운영 상태의 약 70%)은 깊게 복사하지 않는다(9MB에서 한 번에 약 0.3초).
// 기록 하나하나를 얼려(Object.freeze, 안쪽까지) 두고 배열만 새로 만든다. 기록을 고치는 변경은 사본으로 바꿔 넣는다
// (storage-trim · 이의 재채점 · 정리). 얼린 기록을 고치려 하면 TypeError가 나고, 그때는 그 변경을 예전처럼 전체를 깊게
// 복사한 상태에서 처음부터 다시 한다(applyMutation). 그래서 놓친 곳이 있어도 결과는 같고 조금 느릴 뿐이다.
// 얼린 기록은 바뀌지 않으므로 저장할 때 그 글(JSON)을 다시 만들지 않는다(cloudflare/state-parts.mjs).
export const FROZEN_KEYS = ['sessions'];
export function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const key of Object.keys(value)) deepFreeze(value[key]);
  return Object.freeze(value);
}
// 상태의 지난 연습 기록을 얼린다(이미 얼린 기록은 건너뛴다: 새 기록만 일한다).
export function sealState(state) {
  for (const key of FROZEN_KEYS) if (Array.isArray(state?.[key])) for (const item of state[key]) deepFreeze(item);
  return state;
}
// 얼린 객체를 고치려 해서 난 오류인지.
export const isFrozenWrite = error => error instanceof TypeError && /read[- ]only|not extensible|Cannot delete property|Cannot define property|frozen/i.test(String(error.message));

export function cloneState(state, own = null) {
  if (!state || typeof state !== 'object') return structuredClone(state);
  const shared = own ? SHALLOW_KEYS : FROZEN_KEYS;
  const rest = {}, shallow = {};
  for (const [key, value] of Object.entries(state)) (shared.includes(key) ? shallow : rest)[key] = value;
  const next = structuredClone(rest);
  for (const [key, value] of Object.entries(shallow)) next[key] = Array.isArray(value) ? value.slice() : value && typeof value === 'object' ? { ...value } : value;
  for (const id of own?.mastery || []) if (next.mastery && next.mastery[id]) next.mastery[id] = structuredClone(next.mastery[id]);
  return next;
}
// GET은 지금 상태를 그대로 읽는다. 얼린 기록을 고치려는 읽기(있으면 안 되지만)는 사본에서 다시 한다.
export async function readState(state, fn, log = console) {
  try { return await fn(state); }
  catch (error) {
    if (!isFrozenWrite(error)) throw error;
    log.warn?.('[frozen-read] a read tried to change a stored record; retried on a copy', error.message);
    return fn(structuredClone(state));
  }
}
// V13.155 연습 중 답 · 다음 문제 · 패스는 메모리에 반영하자마자 답한다(저장은 바로 뒤에 모아서). 저장 모으기(1.5초~)를
// 답마다 기다리면 쓰기 문제 · 실전시험에서 "답안을 저장하고 있어요"가 매번 1~6초 떠 있었다.
export const QUICK_WRITE = /^\/api\/practice\/[^/]+\/(answer|next|pass)$/;
export const isQuickWrite = (method, pathname) => method === 'POST' && QUICK_WRITE.test(pathname);
// 빠른 길이라도 연습이 끝났으면(실전시험 마지막 답 · 시간이 지난 답 · 미리 받은 다음 문제에서 끝남) 저장까지 기다린다.
export const quickSettle = out => !!(out?.finished || out?.prefetched_next?.finished);
// 빠른 길이 깊게 복사할 것: 그 연습을 하는 학생의 숙련도 묶음.
export const quickOwn = pathname => state => {
  const id = decodeURIComponent(pathname.split('/')[3] || '');
  const practice = (state?.practices || []).find(item => item?.id === id);
  return { mastery: practice?.student_id ? [practice.student_id] : [] };
};

export function createMutationCoordinator(repo, initialSnapshot, options = {}) {
  // V13.168 숫자 또는 함수(쓰기 한도가 넉넉한 날은 짧게: cloudflare/worker.mjs).
  const flushDelay = () => Math.max(20, Number(typeof options.flushDelay === 'function' ? options.flushDelay() : options.flushDelay || 500) || 500);
  const retryDelay = Math.max(1000, Number(options.retryDelay || 2000));
  const onError = options.onError || (error => console.error('[checkpoint]', error.message));
  const rollbackOnFailure = Boolean(options.rollbackOnFailure);
  // V13.144 쓰기 모으기: 저장이 연달아 오면 앞 저장이 시작된 뒤 groupMs가 지날 때까지 기다렸다가, 그동안 온 변경을
  // 한 번에 저장한다(쉬고 있다가 온 저장은 바로). durable()은 그대로 저장이 끝난 뒤에 답한다: 줄이는 것은 "몇 번 쓰느냐"뿐.
  // 숫자 또는 함수(오늘 쓴 양에 따라 늘린다).
  const groupMs = () => Math.max(0, Number(typeof options.groupMs === 'function' ? options.groupMs() : options.groupMs || 0) || 0);
  let lastCommitAt = 0;

  let snapshot = {
    state: sealState(initialSnapshot.state),
    revision: Number(initialSnapshot.revision)
  };
  let stateVersion = 0;
  let persistedVersion = 0;
  let persistedRevision = snapshot.revision;
  let applyTail = Promise.resolve();
  let persistTail = Promise.resolve();
  let flushTimer = null;
  let closed = false;
  let generation = 0;
  let needsRecovery = false;
  let recoveryPromise = null;
  let lastFailure = null;
  let flushFailing = false;
  let frozenRetries = 0;

  const unavailable = () => lastFailure || Object.assign(Error('저장 서버에 연결하지 못했습니다.'), { status: 503 });

  const queueApply = task => {
    const run = applyTail.then(task, task);
    applyTail = run.then(() => undefined, () => undefined);
    return run;
  };

  async function applyMutation(fn, own = null) {
    return queueApply(async () => {
      if (needsRecovery) throw unavailable();
      let nextState = cloneState(snapshot.state, typeof own === 'function' ? own(snapshot.state) : own);
      let output;
      try {
        output = await fn(nextState);
      } catch (error) {
        if (!isFrozenWrite(error)) throw error;
        // V13.168 얼린 기록을 고치려 했다: 전체를 깊게 복사한 상태에서 처음부터 다시 한다(예전과 같은 결과).
        frozenRetries += 1;
        nextState = structuredClone(snapshot.state);
        output = await fn(nextState);
      }
      compactState(nextState);
      sealState(nextState);
      if (output === NO_MUTATION) {
        return { output: undefined, version: stateVersion, generation, changed: false };
      }
      snapshot = { state: nextState, revision: persistedRevision };
      stateVersion += 1;
      return { output, version: stateVersion, generation, changed: true };
    });
  }

  async function recover() {
    if (!needsRecovery) return;
    if (!recoveryPromise) {
      recoveryPromise = (async () => {
        const current = await (repo.refresh ? repo.refresh() : repo.read());
        await queueApply(() => {
          snapshot = { state: sealState(current.state), revision: Number(current.revision) };
          persistedRevision = Number(current.revision);
          stateVersion = 0;
          persistedVersion = 0;
          generation += 1;
          needsRecovery = false;
        });
      })().finally(() => { recoveryPromise = null; });
    }
    return recoveryPromise;
  }

  function persistOnce(target = Infinity) {
    const run = persistTail.then(async () => {
      // Already saved by the write this one waited behind: do not wait for another window.
      if (persistedVersion >= target && !needsRecovery) return;
      const wait = lastCommitAt + groupMs() - Date.now();
      if (wait > 0 && lastCommitAt) await new Promise(resolve => setTimeout(resolve, wait));
      const checkpoint = await queueApply(() => ({
        // V13.129: 복사하지 않는다. 변경은 늘 새 상태 객체로 바꾸고(applyMutation) 이 객체는 고치지 않으며,
        // 저장소는 저장하자마자 직렬화한다. 2.4MB 상태에서 저장마다 약 30ms · 20MB를 아낀다.
        state: snapshot.state,
        version: stateVersion,
        revision: persistedRevision,
        generation
      }));
      if (needsRecovery) throw unavailable();
      if (checkpoint.generation !== generation) return;
      if (checkpoint.version <= persistedVersion) return;

      let stored;
      try {
        lastCommitAt = Date.now();
        stored = await repo.commit(checkpoint.state, checkpoint.revision);
      } catch (error) {
        if (rollbackOnFailure) {
          lastFailure = error;
          needsRecovery = true;
          try { await recover(); } catch {}
          throw error;
        }
        try {
          const current = await repo.read();
          persistedRevision = Number(current.revision);
          snapshot = { state: snapshot.state, revision: persistedRevision };
        } catch {}
        throw error;
      }

      // V13.144: a repository that skips a write when nothing changed returns the revision it kept.
      persistedRevision = Number.isFinite(stored) ? Number(stored) : checkpoint.revision + 1;
      persistedVersion = checkpoint.version;
      snapshot = { state: snapshot.state, revision: persistedRevision };
      // V13.163 저장이 다시 되면 빠른 길을 다시 쓴다. 운영(rollbackOnFailure)에서는 실패 뒤 recover()가 버전을 0으로
      // 되돌려 다시 시도할 저장이 없어서, 이 표시가 DO가 다시 시작할 때까지 남아 답마다 1~6초 기다렸다.
      flushFailing = false;
    });
    persistTail = run.catch(() => undefined);
    return run;
  }

  async function persistThrough(targetVersion, expectedGeneration = generation) {
    while (persistedVersion < targetVersion) {
      if (generation !== expectedGeneration || needsRecovery) throw unavailable();
      await persistOnce(targetVersion);
    }
    if (generation !== expectedGeneration || needsRecovery) throw unavailable();
  }

  function scheduleFlush(delay = flushDelay()) {
    if (closed || flushTimer || stateVersion <= persistedVersion) return;
    flushTimer = setTimeout(async () => {
      flushTimer = null;
      try {
        await persistThrough(stateVersion);
      } catch (error) {
        flushFailing = true;
        onError(error);
        scheduleFlush(retryDelay);
        return;
      }
      flushFailing = false;
      scheduleFlush();
    }, delay);
    flushTimer.unref?.();
  }

  // V13.157: 뒤에서 하는 저장이 실패하고 있으면 빠른 길을 쓰지 않는다(저장됐다고 답한 뒤 잃지 않게, 저장이 끝난 뒤 답한다).
  // settle(답)이 true면(연습이 끝나 코인 · 경험치를 줌) 저장이 끝난 뒤 답한다.
  async function fast(fn, own = null, settle = null) {
    if (flushFailing || needsRecovery) return durable(fn);
    const result = await applyMutation(fn, own);
    if (result.changed && settle?.(result.output)) {
      await persistThrough(result.version, result.generation);
      return result.output;
    }
    if (result.changed) scheduleFlush();
    return result.output;
  }

  async function durable(fn) {
    const result = await applyMutation(fn);
    await persistThrough(result.version, result.generation);
    return result.output;
  }

  async function flush() {
    if (flushTimer) clearTimeout(flushTimer);
    flushTimer = null;
    await applyTail;
    await persistThrough(stateVersion);
    await persistTail;
    flushFailing = false;
  }

  async function replace(state, revision) {
    await flush();
    await queueApply(() => {
      snapshot = { state: sealState(structuredClone(state)), revision: Number(revision) };
      persistedRevision = Number(revision);
      stateVersion = 0;
      persistedVersion = 0;
      // V13.163 앞 상태를 기다리던 durable()이 끝없이 돌지 않게(버전이 0으로 돌아가 다시 오지 않음) 세대를 바꾼다.
      generation += 1;
    });
  }

  async function close() {
    closed = true;
    await flush();
  }

  return {
    fast,
    durable,
    flush,
    replace,
    close,
    recover,
    // V13.168 얼린 기록을 고치려 해서 처음부터 다시 한 변경 수(/api/health).
    stats: () => ({ frozen_retries: frozenRetries }),
    current: () => {
      if (needsRecovery) throw unavailable();
      return snapshot;
    }
  };
}
