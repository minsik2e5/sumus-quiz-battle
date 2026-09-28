// Local-first persistence for the VocaStateObject Durable Object.
//
// Every mutation is made durable in the object's own SQLite storage (a local
// disk write, milliseconds) before the response leaves the object. Supabase
// keeps receiving the same full-state JSON through the existing
// voca_v12_state_commit RPC, but in the background, so students no longer
// wait for a cross-region upload of the whole state on every answer.
//
// Supabase remains the backup and the source used on first start. Its data
// format and RPCs are unchanged.

// SQLite-backed Durable Objects cap a row at 2 MB. 500k UTF-16 code units is at
// most ~1.5 MB of UTF-8 even when every character is Korean (3 bytes each).
const CHUNK_CHARS = 500_000;

function chunks(text) {
  const parts = [];
  for (let start = 0; start < text.length;) {
    let end = Math.min(text.length, start + CHUNK_CHARS);
    // Never split a surrogate pair: a lone surrogate is not valid UTF-8 and
    // SQLite would store a replacement character, corrupting the JSON.
    const code = text.charCodeAt(end - 1);
    if (end < text.length && code >= 0xd800 && code <= 0xdbff) end -= 1;
    parts.push(text.slice(start, end));
    start = end;
  }
  return parts;
}

export function createLocalRepository(storage) {
  const sql = storage.sql;
  sql.exec('CREATE TABLE IF NOT EXISTS voca_snapshot (idx INTEGER PRIMARY KEY, data TEXT NOT NULL)');
  sql.exec('CREATE TABLE IF NOT EXISTS voca_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)');

  const readMeta = () => {
    const rows = Object.fromEntries(sql.exec('SELECT key, value FROM voca_meta').toArray().map(row => [row.key, row.value]));
    return {
      // version: local snapshot counter; -1 means no snapshot yet.
      version: rows.version === undefined ? -1 : Number(rows.version),
      // syncedVersion: newest local version known to be stored in Supabase.
      syncedVersion: rows.synced_version === undefined ? -1 : Number(rows.synced_version),
      // supabaseRevision: Supabase revision that holds syncedVersion.
      supabaseRevision: rows.supabase_revision === undefined ? null : Number(rows.supabase_revision)
    };
  };
  let meta = readMeta();
  let latest = null;
  const metrics = { commitMs: 0, commitBytes: 0 };
  let onCommit = () => {};

  const writeMeta = next => {
    const entries = [['version', next.version], ['synced_version', next.syncedVersion], ['supabase_revision', next.supabaseRevision]];
    for (const [key, value] of entries) {
      if (value === null || value === undefined) continue;
      sql.exec('INSERT OR REPLACE INTO voca_meta (key, value) VALUES (?, ?)', key, String(value));
    }
  };

  const writeSnapshot = (json, nextMeta) => {
    storage.transactionSync(() => {
      sql.exec('DELETE FROM voca_snapshot');
      chunks(json).forEach((part, idx) => sql.exec('INSERT INTO voca_snapshot (idx, data) VALUES (?, ?)', idx, part));
      writeMeta(nextMeta);
    });
    meta = nextMeta;
    latest = { version: nextMeta.version, json };
  };

  const load = () => {
    if (meta.version < 0) throw Object.assign(Error('로컬 저장 데이터가 없습니다.'), { status: 503 });
    const json = sql.exec('SELECT data FROM voca_snapshot ORDER BY idx').toArray().map(row => row.data).join('');
    if (!json) throw Object.assign(Error('로컬 저장 데이터를 불러오지 못했습니다.'), { status: 503 });
    latest = { version: meta.version, json };
    return { revision: meta.version, state: JSON.parse(json) };
  };

  return {
    metrics,
    status: () => ({ ...meta }),
    latest: () => latest,
    hasSnapshot: () => meta.version >= 0,
    set onCommit(callback) { onCommit = callback || (() => {}); },
    async read() { return load(); },
    async refresh() { meta = readMeta(); return load(); },
    // Coordinator contract: `revision` is the version the checkpoint was built on.
    async commit(state, revision) {
      if (Number(revision) !== meta.version) throw Object.assign(Error('로컬 저장 순서가 맞지 않습니다.'), { status: 409 });
      const started = Date.now();
      const json = JSON.stringify(state);
      try {
        writeSnapshot(json, { ...meta, version: meta.version + 1 });
      } catch (error) {
        console.error('[local-store] write failed', error?.message);
        throw Object.assign(Error('저장하지 못했습니다. 잠시 후 다시 시도해주세요.'), { status: 503 });
      }
      metrics.commitMs = Date.now() - started;
      metrics.commitBytes = json.length;
      onCommit();
    },
    // Replace the local snapshot with a Supabase copy that is already stored remotely.
    adoptRemote(state, supabaseRevision) {
      const version = meta.version + 1;
      writeSnapshot(JSON.stringify(state), { version, syncedVersion: version, supabaseRevision: Number(supabaseRevision) });
    },
    markSynced(version, supabaseRevision) {
      const next = { ...meta, syncedVersion: Math.max(meta.syncedVersion, version), supabaseRevision: Number(supabaseRevision) };
      storage.transactionSync(() => writeMeta(next));
      meta = next;
    }
  };
}

// minIntervalMs: the least time between the end of one successful upload and the start
// of the next. Every upload carries the whole state, so during a class uploading after each
// answer kept Supabase busy with back-to-back multi-megabyte writes and uploads timed out.
// The local snapshot is durable, so a later backup loses nothing.
export function createSupabaseSync({ local, supabase, storage, delayMs = 1000, minIntervalMs = 0, log = console }) {
  let timer = null;
  let running = null;
  let failures = 0;
  let lastError = null;
  let lastSyncAt = 0;
  let lastSyncMs = 0;
  let pendingSince = 0;
  let closed = false;

  const pending = () => {
    const status = local.status();
    return status.syncedVersion < status.version;
  };

  function schedule(delay = delayMs) {
    if (!pendingSince && pending()) pendingSince = Date.now();
    if (timer || closed) return;
    if (lastSyncAt && minIntervalMs > 0) delay = Math.max(delay, lastSyncAt + minIntervalMs - Date.now());
    timer = setTimeout(() => { timer = null; run().catch(() => {}); }, delay);
    timer?.unref?.();
    // Safety net: if the object is evicted before the timer fires, the alarm
    // wakes it up again and the constructor + alarm() finish the upload.
    Promise.resolve(storage.setAlarm?.(Date.now() + delay + 30000)).catch(() => {});
  }

  async function pushOnce() {
    const status = local.status();
    const snapshot = local.latest();
    if (!snapshot || status.syncedVersion >= snapshot.version) return false;
    const started = Date.now();
    let next;
    try {
      next = await supabase.commitSerialized(snapshot.json, status.supabaseRevision);
    } catch (error) {
      if (error?.status !== 409) throw error;
      // Either an earlier upload succeeded but its response was lost, or the
      // remote copy changed. The local snapshot is authoritative while it has
      // changes Supabase has not seen, so retry on top of the current revision.
      const remoteRevision = await supabase.readRevision();
      log.warn('[supabase-sync] revision moved; re-uploading local snapshot', { expected: status.supabaseRevision, remote: remoteRevision });
      next = await supabase.commitSerialized(snapshot.json, remoteRevision);
    }
    local.markSynced(snapshot.version, next);
    lastSyncAt = Date.now();
    lastSyncMs = lastSyncAt - started;
    return true;
  }

  function run() {
    if (running) return running;
    running = (async () => {
      try {
        // Without a minimum interval, keep going while newer snapshots exist; with one,
        // a newer snapshot waits for the next scheduled upload.
        while (await pushOnce() && minIntervalMs <= 0) { /* next snapshot */ }
        failures = 0;
        lastError = null;
        pendingSince = 0;
      } catch (error) {
        failures += 1;
        lastError = error?.detail || error?.message || String(error);
        log.error('[supabase-sync]', lastError);
        schedule(Math.min(60000, 2000 * 2 ** Math.min(failures - 1, 5)));
        throw error;
      } finally {
        running = null;
      }
      // A commit may have landed while the last upload was in flight.
      if (pending()) schedule();
    })();
    return running;
  }

  return {
    schedule,
    run,
    pending,
    // Stops background retries (used when a test discards an object instance).
    close() { closed = true; clearTimeout(timer); timer = null; },
    status: () => ({
      pending: pending(),
      lag_sec: pendingSince ? Math.round((Date.now() - pendingSince) / 1000) : 0,
      failures,
      last_sync_ms: lastSyncMs,
      last_sync_at: lastSyncAt || null,
      last_error: lastError
    })
  };
}
