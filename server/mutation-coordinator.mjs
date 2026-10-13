export const NO_MUTATION = Symbol('no-mutation');

function compactState(state) {
  if (!state || typeof state !== 'object') return state;
  if (Array.isArray(state.practices)) {
    const sessionIds = new Set(Array.isArray(state.sessions) ? state.sessions.map(item => item?.id) : []);
    state.practices = state.practices.filter(item => !item?.finished || (Number(item?.total || 0) > 0 && !sessionIds.has(item.id)) || Number(item?.finished_at || 0) > Date.now() - 10 * 60000);
  }
  if (Array.isArray(state.tokens)) state.tokens = state.tokens.filter(item => Number(item?.expires_at || 0) > Date.now());
  return state;
}

export function createMutationCoordinator(repo, initialSnapshot, options = {}) {
  const flushDelay = Math.max(50, Number(options.flushDelay || 500));
  const retryDelay = Math.max(1000, Number(options.retryDelay || 2000));
  const onError = options.onError || (error => console.error('[checkpoint]', error.message));
  const rollbackOnFailure = Boolean(options.rollbackOnFailure);
  // V13.144 쓰기 모으기: 저장이 연달아 오면 앞 저장이 시작된 뒤 groupMs가 지날 때까지 기다렸다가, 그동안 온 변경을
  // 한 번에 저장한다(쉬고 있다가 온 저장은 바로). durable()은 그대로 저장이 끝난 뒤에 답한다: 줄이는 것은 "몇 번 쓰느냐"뿐.
  // 숫자 또는 함수(오늘 쓴 양에 따라 늘린다).
  const groupMs = () => Math.max(0, Number(typeof options.groupMs === 'function' ? options.groupMs() : options.groupMs || 0) || 0);
  let lastCommitAt = 0;

  let snapshot = {
    state: initialSnapshot.state,
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

  const unavailable = () => lastFailure || Object.assign(Error('저장 서버에 연결하지 못했습니다.'), { status: 503 });

  const queueApply = task => {
    const run = applyTail.then(task, task);
    applyTail = run.then(() => undefined, () => undefined);
    return run;
  };

  async function applyMutation(fn) {
    return queueApply(async () => {
      if (needsRecovery) throw unavailable();
      const nextState = structuredClone(snapshot.state);
      const output = await fn(nextState);
      compactState(nextState);
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
          snapshot = { state: current.state, revision: Number(current.revision) };
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

  function scheduleFlush(delay = flushDelay) {
    if (closed || flushTimer || stateVersion <= persistedVersion) return;
    flushTimer = setTimeout(async () => {
      flushTimer = null;
      try {
        await persistThrough(stateVersion);
      } catch (error) {
        onError(error);
        scheduleFlush(retryDelay);
        return;
      }
      scheduleFlush();
    }, delay);
    flushTimer.unref?.();
  }

  async function fast(fn) {
    const result = await applyMutation(fn);
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
  }

  async function replace(state, revision) {
    await flush();
    await queueApply(() => {
      snapshot = { state: structuredClone(state), revision: Number(revision) };
      persistedRevision = Number(revision);
      stateVersion = 0;
      persistedVersion = 0;
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
    current: () => {
      if (needsRecovery) throw unavailable();
      return snapshot;
    }
  };
}
