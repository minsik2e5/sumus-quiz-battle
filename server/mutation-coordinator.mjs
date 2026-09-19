export const NO_MUTATION = Symbol('no-mutation');

function compactState(state) {
  if (!state || typeof state !== 'object') return state;
  if (Array.isArray(state.practices)) {
    const sessionIds = new Set(Array.isArray(state.sessions) ? state.sessions.map(item => item?.id) : []);
    state.practices = state.practices.filter(item => !item?.finished || (Number(item?.total || 0) > 0 && !sessionIds.has(item.id)));
  }
  if (Array.isArray(state.tokens)) state.tokens = state.tokens.filter(item => Number(item?.expires_at || 0) > Date.now());
  return state;
}

export function createMutationCoordinator(repo, initialSnapshot, options = {}) {
  const flushDelay = Math.max(50, Number(options.flushDelay || 500));
  const retryDelay = Math.max(1000, Number(options.retryDelay || 2000));
  const onError = options.onError || (error => console.error('[checkpoint]', error.message));

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

  const queueApply = task => {
    const run = applyTail.then(task, task);
    applyTail = run.then(() => undefined, () => undefined);
    return run;
  };

  async function applyMutation(fn) {
    return queueApply(async () => {
      const nextState = structuredClone(snapshot.state);
      const output = await fn(nextState);
      compactState(nextState);
      if (output === NO_MUTATION) {
        return { output: undefined, version: stateVersion, changed: false };
      }
      snapshot = { state: nextState, revision: persistedRevision };
      stateVersion += 1;
      return { output, version: stateVersion, changed: true };
    });
  }

  function persistOnce() {
    const run = persistTail.then(async () => {
      const checkpoint = await queueApply(() => ({
        state: structuredClone(snapshot.state),
        version: stateVersion,
        revision: persistedRevision
      }));
      if (checkpoint.version <= persistedVersion) return;

      try {
        await repo.commit(checkpoint.state, checkpoint.revision);
      } catch (error) {
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

  async function persistThrough(targetVersion) {
    while (persistedVersion < targetVersion) await persistOnce();
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
    await persistThrough(result.version);
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
    current: () => snapshot
  };
}
