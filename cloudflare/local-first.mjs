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

import { partitionState, hashText, batchParts } from './state-parts.mjs';

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
  // Hash of every part last stored in the Supabase parts backup (cloudflare/state-parts.mjs).
  sql.exec('CREATE TABLE IF NOT EXISTS voca_parts (key TEXT PRIMARY KEY, hash TEXT NOT NULL)');

  const readMeta = () => {
    const rows = Object.fromEntries(sql.exec('SELECT key, value FROM voca_meta').toArray().map(row => [row.key, row.value]));
    return {
      // version: local snapshot counter; -1 means no snapshot yet.
      version: rows.version === undefined ? -1 : Number(rows.version),
      // syncedVersion: newest local version known to be stored in Supabase.
      syncedVersion: rows.synced_version === undefined ? -1 : Number(rows.synced_version),
      // supabaseRevision: Supabase revision that holds syncedVersion.
      supabaseRevision: rows.supabase_revision === undefined ? null : Number(rows.supabase_revision),
      // partsRevision: revision of the Supabase parts backup that holds the stored hashes.
      partsRevision: rows.parts_revision === undefined || rows.parts_revision === '' ? null : Number(rows.parts_revision),
      // fullAt: when the whole state was last stored in the v12 backup.
      fullAt: rows.full_at === undefined ? 0 : Number(rows.full_at)
    };
  };
  let meta = readMeta();
  let latest = null;
  const metrics = { commitMs: 0, commitBytes: 0 };
  let onCommit = () => {};

  const writeMeta = next => {
    const entries = [['version', next.version], ['synced_version', next.syncedVersion], ['supabase_revision', next.supabaseRevision], ['full_at', next.fullAt]];
    for (const [key, value] of entries) {
      if (value === null || value === undefined) continue;
      sql.exec('INSERT OR REPLACE INTO voca_meta (key, value) VALUES (?, ?)', key, String(value));
    }
    // Unknown parts revision is stored as '' so a reset survives a restart.
    if ('partsRevision' in next) sql.exec('INSERT OR REPLACE INTO voca_meta (key, value) VALUES (?, ?)', 'parts_revision', next.partsRevision === null || next.partsRevision === undefined ? '' : String(next.partsRevision));
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
    },
    // Parts backup: the snapshot reached Supabase as parts (the v12 revision is untouched).
    markSyncedParts(version) {
      const next = { ...meta, syncedVersion: Math.max(meta.syncedVersion, version) };
      storage.transactionSync(() => writeMeta(next));
      meta = next;
    },
    // A full v12 upload that is only a periodic safety copy (parts carry the live backup).
    markFullBackup(supabaseRevision, at) {
      const next = { ...meta, supabaseRevision: Number(supabaseRevision), fullAt: Number(at) };
      storage.transactionSync(() => writeMeta(next));
      meta = next;
    },
    partHashes() {
      return new Map(sql.exec('SELECT key, hash FROM voca_parts').toArray().map(row => [row.key, row.hash]));
    },
    savePartHashes(entries, removed, partsRevision) {
      const next = { ...meta, partsRevision: Number(partsRevision) };
      storage.transactionSync(() => {
        for (const [key, hash] of entries) sql.exec('INSERT OR REPLACE INTO voca_parts (key, hash) VALUES (?, ?)', key, hash);
        for (const key of removed) sql.exec('DELETE FROM voca_parts WHERE key = ?', key);
        writeMeta(next);
      });
      meta = next;
    },
    // Forget what Supabase holds, so the next upload sends every part again.
    clearPartHashes() {
      const next = { ...meta, partsRevision: null };
      storage.transactionSync(() => { sql.exec('DELETE FROM voca_parts'); writeMeta(next); });
      meta = next;
    },
    // Restore from the parts backup: the state and the hashes of what Supabase holds.
    adoptRemoteParts(state, partsRevision, hashes) {
      const version = meta.version + 1;
      const next = { ...meta, version, syncedVersion: version, partsRevision: Number(partsRevision) };
      storage.transactionSync(() => {
        sql.exec('DELETE FROM voca_parts');
        for (const [key, hash] of hashes) sql.exec('INSERT INTO voca_parts (key, hash) VALUES (?, ?)', key, hash);
      });
      writeSnapshot(JSON.stringify(state), next);
    }
  };
}

// minIntervalMs: the least time between the end of one successful upload and the start
// of the next. The local snapshot is durable, so a later backup loses nothing.
//
// Two ways to back up:
// - "parts" (once supabase/voca_v13_parts.sql has been run): only the parts of the state
//   that changed since the last upload (cloudflare/state-parts.mjs), in batches of about
//   250 KB. A full v12 copy is still stored every fullEveryMs as a second safety copy.
// - "full" (until then, or with SUPABASE_BACKUP_MODE=full): the whole state through
//   voca_v12_state_commit, as before.
// The mode is found by asking for the parts revision; a missing function (404) means
// "full", checked again every 10 minutes so running the SQL needs no deploy.
export function createSupabaseSync({ local, supabase, storage, delayMs = 1000, minIntervalMs = 0, fullEveryMs = 6 * 3600000, forceFull = false, log = console }) {
  let timer = null;
  let running = null;
  let failures = 0;
  let lastError = null;
  let lastSyncAt = 0;
  let lastSyncMs = 0;
  let lastUploadKb = 0;
  let pendingSince = 0;
  let closed = false;
  let mode = forceFull || !supabase.partsRevision ? 'full' : 'unknown';
  let modeCheckedAt = 0;
  let fullError = null;

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

  async function resolveMode() {
    if (forceFull || !supabase.partsRevision || mode === 'parts') return mode === 'unknown' ? 'full' : mode;
    if (mode === 'full' && Date.now() - modeCheckedAt < 10 * 60000) return mode;
    modeCheckedAt = Date.now();
    try {
      await supabase.partsRevision();
      mode = 'parts';
    } catch (error) {
      if (error?.status !== 404) throw error;
      mode = 'full';
    }
    return mode;
  }

  // Whole state through v12, retried on top of the current revision after a conflict.
  async function commitFull(json, revision) {
    try {
      return await supabase.commitSerialized(json, revision);
    } catch (error) {
      if (error?.status !== 409) throw error;
      // Either an earlier upload succeeded but its response was lost, or the
      // remote copy changed. The local snapshot is authoritative while it has
      // changes Supabase has not seen, so retry on top of the current revision.
      const remoteRevision = await supabase.readRevision();
      log.warn('[supabase-sync] revision moved; re-uploading local snapshot', { expected: revision, remote: remoteRevision });
      return supabase.commitSerialized(json, remoteRevision);
    }
  }

  async function pushFull() {
    const status = local.status();
    const snapshot = local.latest();
    if (!snapshot || status.syncedVersion >= snapshot.version) return false;
    const started = Date.now();
    const next = await commitFull(snapshot.json, status.supabaseRevision);
    local.markSynced(snapshot.version, next);
    lastSyncAt = Date.now();
    lastSyncMs = lastSyncAt - started;
    lastUploadKb = Math.round(snapshot.json.length / 1024);
    return true;
  }

  async function pushParts() {
    const status = local.status();
    const snapshot = local.latest();
    if (!snapshot || status.syncedVersion >= snapshot.version) return false;
    const started = Date.now();
    const parts = partitionState(JSON.parse(snapshot.json));
    const hashes = new Map(await Promise.all([...parts].map(async ([key, text]) => [key, await hashText(text)])));
    const previous = local.partHashes();
    const changed = [...parts].filter(([key]) => previous.get(key) !== hashes.get(key));
    let removed = [...previous.keys()].filter(key => !parts.has(key));
    // Sending everything again (no hashes kept): parts deleted here meanwhile are still in
    // Supabase and would come back on a restore, so ask which keys it holds.
    if (!previous.size && supabase.readParts) {
      try {
        const remote = await supabase.readParts();
        removed = Object.keys(remote.parts || {}).filter(key => !parts.has(key));
      } catch (error) {
        log.warn('[supabase-sync] could not list remote parts; old parts kept', { error: error?.message || String(error) });
      }
    }
    const batches = batchParts(changed);
    if (!batches.length && removed.length) batches.push([]);
    let revision = status.partsRevision ?? await supabase.partsRevision();
    let bytes = 0;
    for (let i = 0; i < batches.length; i += 1) {
      const batch = batches[i];
      const drop = i === batches.length - 1 ? removed : [];
      let next;
      try {
        next = await supabase.patchParts(batch, drop, revision);
      } catch (error) {
        if (error?.status !== 409) throw error;
        const remote = await supabase.partsRevision();
        // One step ahead: the previous upload landed but its answer was lost, so sending
        // the same parts again is safe. Anything else means the remote copy changed
        // elsewhere: forget the hashes and send every part on the next run.
        if (remote !== revision + 1) {
          local.clearPartHashes();
          throw Object.assign(Error('parts revision moved'), { detail: `voca_v13_state_patch: revision moved (${revision} -> ${remote}); sending every part again` });
        }
        next = await supabase.patchParts(batch, drop, remote);
      }
      revision = next;
      local.savePartHashes(batch.map(([key]) => [key, hashes.get(key)]), drop, revision);
      bytes += batch.reduce((sum, [key, text]) => sum + key.length + text.length, 0);
    }
    local.markSyncedParts(snapshot.version);
    lastSyncAt = Date.now();
    lastSyncMs = lastSyncAt - started;
    lastUploadKb = Math.round(bytes / 1024);
    return true;
  }

  // Second safety copy in the v12 format while parts carry the live backup. Its failure is
  // reported separately and never holds up the parts backup.
  async function maybeFullCopy() {
    const snapshot = local.latest();
    if (!snapshot || !fullEveryMs || Date.now() - local.status().fullAt < fullEveryMs) return;
    try {
      const next = await commitFull(snapshot.json, local.status().supabaseRevision);
      local.markFullBackup(next, Date.now());
      fullError = null;
    } catch (error) {
      fullError = error?.detail || error?.message || String(error);
      // Try again next period, not on every run.
      local.markFullBackup(local.status().supabaseRevision ?? 0, Date.now());
      log.warn('[supabase-full-copy]', fullError);
    }
  }

  function run() {
    if (running) return running;
    running = (async () => {
      try {
        if (await resolveMode() === 'parts') {
          await pushParts();
          await maybeFullCopy();
        } else {
          // Without a minimum interval, keep going while newer snapshots exist; with one,
          // a newer snapshot waits for the next scheduled upload.
          while (await pushFull() && minIntervalMs <= 0) { /* next snapshot */ }
        }
        failures = 0;
        lastError = null;
        pendingSince = 0;
      } catch (error) {
        failures += 1;
        lastError = error?.detail || error?.message || String(error);
        // The parts functions went missing (e.g. restored database): find the mode again.
        if (error?.status === 404 && mode === 'parts') mode = 'unknown';
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
      mode: mode === 'unknown' ? null : mode,
      lag_sec: pendingSince ? Math.round((Date.now() - pendingSince) / 1000) : 0,
      failures,
      last_sync_ms: lastSyncMs,
      last_sync_at: lastSyncAt || null,
      last_upload_kb: lastUploadKb,
      last_error: lastError,
      full_copy_at: local.status().fullAt || null,
      full_copy_error: fullError
    })
  };
}
