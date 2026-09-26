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

  function persistOnce() {
    const run = persistTail.then(async () => {
      const checkpoint = await queueApply(() => ({
        state: structuredClone(snapshot.state),
        version: stateVersion,
        revision: persistedRevision,
        generation
      }));
      if (needsRecovery) throw unavailable();
      if (checkpoint.generation !== generation) return;
      if (checkpoint.version <= persistedVersion) return;

      try {
        await repo.commit(checkpoint.state, checkpoint.revision);
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

      persistedRevision = checkpoint.revision + 1;
      persistedVersion = checkpoint.version;
      snapshot = { state: snapshot.state, revision: persistedRevision };
    });
    persistTail = run.catch(() => undefined);
    return run;
  }

  async function persistThrough(targetVersion, expectedGeneration = generation) {
    while (persistedVersion < targetVersion) {
      if (generation !== expectedGeneration || needsRecovery) throw unavailable();
      await persistOnce();
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
