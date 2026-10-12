// Local-first persistence for the VocaStateObject Durable Object.
//
// Every mutation is made durable in the object's own SQLite storage (a local
// disk write, milliseconds) before the response leaves the object. Supabase
// keeps receiving the state in the background (cloudflare/state-parts.mjs parts,
// or the whole JSON through voca_v12_state_commit), so students never wait for it.
//
// V13.144: 무료 플랜의 쓰기 한도(하루 10만 줄, cloudflare/cf-limits.mjs)를 넘어 2026-10-12에 서버가 멈췄다.
// 예전에는 저장할 때마다 상태 전체(약 4MB)를 지우고 조각으로 다시 넣어 저장 한 번에 수십 줄을 썼다.
// 이제 상태를 키별 조각(state-parts.mjs의 partitionState)으로 voca_rows에 두고, 바뀐 조각만 쓴다.
// 학생 답 하나는 보통 그 학생의 조각 1~2줄 + meta 1줄이다. 바뀐 것이 없으면 아무것도 쓰지 않는다.
//
// Tables:
//   voca_rows (part, idx, data)  상태 조각. 행 한도(2MB)를 넘는 조각은 idx 0,1,2…로 나눈다.
//                                '#hashes'는 Supabase에 올라간 조각들의 해시(한 조각으로).
//   voca_meta 'state'            meta 한 줄(JSON): 버전, 백업 상태, 오늘 쓴 줄 수.
//   voca_snapshot, voca_parts, voca_meta(옛 키)  V13.143까지의 방식. 처음 시작할 때 한 번 옮기고 지운다.
//                                옮기다 실패하면 옛 방식 그대로 읽고 쓴다(다음 시작 때 다시 옮긴다).

import { partitionState, assembleState, hashText, batchParts } from './state-parts.mjs';
import { CF_FREE_PLAN, utcDay, writeBudget } from './cf-limits.mjs';

// 500k UTF-16 code units is at most ~1.5 MB of UTF-8 even when every character is
// Korean (3 bytes each), under the 2 MB row limit.
const CHUNK_CHARS = Math.floor(CF_FREE_PLAN.maxRowBytes / 4);
const HASHES_PART = '#hashes';
const LEGACY_META_KEYS = ['version', 'synced_version', 'supabase_revision', 'parts_revision', 'full_at'];
const META_UPSERT = 'INSERT INTO voca_meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value';
const ROW_UPSERT = 'INSERT INTO voca_rows (part, idx, data) VALUES (?, ?, ?) ON CONFLICT(part, idx) DO UPDATE SET data = excluded.data';

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
  return parts.length ? parts : [''];
}

// Same data, whatever the key order of objects (arrays keep their order).
const canonical = value => JSON.stringify(value, (key, item) => item && typeof item === 'object' && !Array.isArray(item) ? Object.fromEntries(Object.keys(item).sort().map(k => [k, item[k]])) : item);

const emptyMeta = () => ({ version: -1, syncedVersion: -1, supabaseRevision: null, partsRevision: null, fullAt: 0, okAt: 0, okMode: null });
const storageError = (message, status = 503) => Object.assign(Error(message), { status });

export function createLocalRepository(storage, { log = console, now = () => Date.now() } = {}) {
  const sql = storage.sql;
  sql.exec('CREATE TABLE IF NOT EXISTS voca_snapshot (idx INTEGER PRIMARY KEY, data TEXT NOT NULL)');
  sql.exec('CREATE TABLE IF NOT EXISTS voca_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)');
  sql.exec('CREATE TABLE IF NOT EXISTS voca_parts (key TEXT PRIMARY KEY, hash TEXT NOT NULL)');
  sql.exec('CREATE TABLE IF NOT EXISTS voca_rows (part TEXT NOT NULL, idx INTEGER NOT NULL, data TEXT NOT NULL, PRIMARY KEY (part, idx)) WITHOUT ROWID');

  // ---- 쓴 줄 수 세기 -------------------------------------------------------------
  // Cloudflare의 cursor.rowsWritten을 더한다(없으면 문장 하나를 1줄로 본다). 오늘(UTC) 값은 meta 줄에 같이 저장한다.
  let txRows = 0;
  const write = (query, ...bindings) => {
    const cursor = sql.exec(query, ...bindings);
    cursor?.toArray?.();
    const rows = Number(cursor?.rowsWritten);
    txRows += Number.isFinite(rows) ? rows : 1;
  };
  let writes = { day: utcDay(now()), rows: 0 };
  const rollDay = () => { const day = utcDay(now()); if (writes.day !== day) writes = { day, rows: 0 }; };
  const countRows = rows => { rollDay(); writes.rows += rows; };

  // ---- meta ---------------------------------------------------------------------
  const metaRows = new Map(sql.exec('SELECT key, value FROM voca_meta').toArray().map(row => [row.key, row.value]));
  const legacyMeta = rows => ({
    ...emptyMeta(),
    // version: local snapshot counter; -1 means no snapshot yet.
    version: rows.has('version') ? Number(rows.get('version')) : -1,
    // syncedVersion: newest local version known to be stored in Supabase.
    syncedVersion: rows.has('synced_version') ? Number(rows.get('synced_version')) : -1,
    // supabaseRevision: Supabase revision that holds syncedVersion.
    supabaseRevision: rows.has('supabase_revision') ? Number(rows.get('supabase_revision')) : null,
    // partsRevision: revision of the Supabase parts backup that holds the stored hashes.
    partsRevision: !rows.has('parts_revision') || rows.get('parts_revision') === '' ? null : Number(rows.get('parts_revision')),
    // fullAt: when the whole state was last stored in the v12 backup.
    fullAt: rows.has('full_at') ? Number(rows.get('full_at')) : 0
  });
  const parseMeta = text => {
    const saved = JSON.parse(text);
    if (saved.writes?.day) writes = { day: saved.writes.day, rows: Number(saved.writes.rows) || 0 };
    rollDay();
    const { format: _format, writes: _writes, ...rest } = saved;
    return { ...emptyMeta(), ...rest };
  };

  // 'parts' (V13.144) or 'legacy' (V13.143 and earlier, used only while moving it fails).
  let format = 'parts';
  let meta = emptyMeta();
  let migrationError = null;
  // On disk now: part -> chunks, part -> whole text.
  const pieces = new Map();
  const texts = new Map();
  let hashes = new Map();
  let latest = null;
  const metrics = { commitMs: 0, commitBytes: 0, commitRows: 0, skipped: 0 };
  let onCommit = () => {};

  // ---- 새 방식 쓰기 --------------------------------------------------------------------
  // Changes made inside a transaction; applied to `pieces`/`texts` only after it commits.
  let staged = null;
  const putPart = (key, text) => {
    const old = pieces.get(key) || [];
    const next = chunks(text);
    next.forEach((piece, idx) => { if (old[idx] !== piece) write(ROW_UPSERT, key, idx, piece); });
    if (old.length > next.length) write('DELETE FROM voca_rows WHERE part = ? AND idx >= ?', key, next.length);
    staged.set(key, { next, text });
  };
  const dropPart = key => { write('DELETE FROM voca_rows WHERE part = ?', key); staged.set(key, null); };

  // One transaction: `work`, then the meta row. Returns the rows written.
  const transact = (nextMeta, work = () => {}) => {
    const before = { ...writes };
    txRows = 0;
    staged = new Map();
    try {
      storage.transactionSync(() => {
        work();
        if (format === 'legacy') { legacyWriteMeta(nextMeta); countRows(txRows); return; }
        countRows(txRows + 1);
        write(META_UPSERT, 'state', JSON.stringify({ format: 'parts', ...nextMeta, writes }));
      });
    } catch (error) {
      writes = before;
      staged = null;
      throw error;
    }
    for (const [key, value] of staged) {
      if (value) { pieces.set(key, value.next); texts.set(key, value.text); } else { pieces.delete(key); texts.delete(key); }
    }
    staged = null;
    meta = nextMeta;
    return txRows;
  };

  // The newest stored state. `json` is built only when asked (the full v12 backup).
  const makeLatest = (version, parts, state = null) => {
    let json = null;
    let size = 0;
    for (const text of parts.values()) size += text.length;
    return {
      version, parts, size,
      get json() {
        if (json === null) json = JSON.stringify(state || assembleState(Object.fromEntries([...parts].map(([key, text]) => [key, JSON.parse(text)]))));
        return json;
      }
    };
  };

  // Writes only the parts of `state` that differ from what is on disk. null: nothing differed
  // (and `always` was not asked), so nothing was written.
  const writeState = (state, nextMeta, { always = false, extra = null } = {}) => {
    const parts = partitionState(state);
    const changed = [...parts].filter(([key, text]) => texts.get(key) !== text);
    const removed = [...texts.keys()].filter(key => !key.startsWith('#') && !parts.has(key));
    if (!changed.length && !removed.length && !always && !extra) return null;
    let bytes = 0;
    const rows = transact(nextMeta, () => {
      for (const [key, text] of changed) { putPart(key, text); bytes += text.length; }
      for (const key of removed) dropPart(key);
      extra?.();
    });
    latest = makeLatest(nextMeta.version, parts, state);
    return { rows, bytes, changed: changed.length, removed: removed.length };
  };

  const hashesWork = next => format === 'legacy'
    ? () => {
      for (const [key, hash] of next) if (hashes.get(key) !== hash) write('INSERT OR REPLACE INTO voca_parts (key, hash) VALUES (?, ?)', key, hash);
      for (const key of hashes.keys()) if (!next.has(key)) write('DELETE FROM voca_parts WHERE key = ?', key);
    }
    : () => putPart(HASHES_PART, JSON.stringify(Object.fromEntries(next)));

  // ---- 읽기 ----------------------------------------------------------------------------
  const readRows = () => {
    const found = new Map();
    for (const row of sql.exec('SELECT part, idx, data FROM voca_rows ORDER BY part, idx').toArray()) {
      if (!found.has(row.part)) found.set(row.part, []);
      found.get(row.part)[Number(row.idx)] = row.data;
    }
    const whole = new Map();
    for (const [key, list] of found) {
      if (list.some(piece => piece === undefined)) throw storageError('로컬 저장 데이터가 끊겨 있습니다.');
      whole.set(key, list.join(''));
    }
    return { found, whole };
  };
  const stateOf = whole => assembleState(Object.fromEntries([...whole].filter(([key]) => !key.startsWith('#')).map(([key, text]) => [key, JSON.parse(text)])));

  const loadParts = () => {
    const { found, whole } = readRows();
    if (!whole.has('o:keys')) throw storageError('로컬 저장 데이터를 불러오지 못했습니다.');
    pieces.clear(); texts.clear();
    for (const [key, list] of found) { pieces.set(key, list); texts.set(key, whole.get(key)); }
    hashes = new Map(Object.entries(whole.has(HASHES_PART) ? JSON.parse(whole.get(HASHES_PART)) : {}));
    const stateParts = new Map([...whole].filter(([key]) => !key.startsWith('#')));
    latest = makeLatest(meta.version, stateParts);
    return { revision: meta.version, state: stateOf(whole) };
  };

  // ---- 옛 방식(V13.143까지): 옮기다 실패했을 때만 쓴다 -----------------------------------
  const legacyJson = () => sql.exec('SELECT data FROM voca_snapshot ORDER BY idx').toArray().map(row => row.data).join('');
  function legacyWriteMeta(next) {
    const entries = [['version', next.version], ['synced_version', next.syncedVersion], ['supabase_revision', next.supabaseRevision], ['full_at', next.fullAt]];
    for (const [key, value] of entries) {
      if (value === null || value === undefined) continue;
      write('INSERT OR REPLACE INTO voca_meta (key, value) VALUES (?, ?)', key, String(value));
    }
    // Unknown parts revision is stored as '' so a reset survives a restart.
    write('INSERT OR REPLACE INTO voca_meta (key, value) VALUES (?, ?)', 'parts_revision', next.partsRevision === null || next.partsRevision === undefined ? '' : String(next.partsRevision));
  }
  const legacyWriteState = (state, nextMeta, extra = null) => {
    const json = JSON.stringify(state);
    const rows = transact(nextMeta, () => {
      write('DELETE FROM voca_snapshot');
      chunks(json).forEach((part, idx) => write('INSERT INTO voca_snapshot (idx, data) VALUES (?, ?)', idx, part));
      extra?.();
    });
    latest = { version: nextMeta.version, json, size: json.length, parts: null };
    return { rows, bytes: json.length };
  };
  const loadLegacy = () => {
    const json = legacyJson();
    if (!json) throw storageError('로컬 저장 데이터를 불러오지 못했습니다.');
    latest = { version: meta.version, json, size: json.length, parts: null };
    hashes = new Map(sql.exec('SELECT key, hash FROM voca_parts').toArray().map(row => [row.key, row.hash]));
    return { revision: meta.version, state: JSON.parse(json) };
  };

  // 옛 통째 스냅숏을 조각으로 옮긴다. 다 넣은 뒤 다시 읽어 옛 데이터와 같은지 확인하고 나서야 옛 행을 지운다.
  // 어디서든 실패하면 새 행을 되돌리고 옛 방식으로 둔다(학생 데이터는 옛 행에 그대로 있다).
  function migrateLegacy() {
    const json = legacyJson();
    if (!json) throw Error('옛 스냅숏이 비어 있습니다.');
    const state = JSON.parse(json);
    const oldHashes = new Map(sql.exec('SELECT key, hash FROM voca_parts').toArray().map(row => [row.key, row.hash]));
    const parts = partitionState(state);
    try {
      format = 'parts';
      pieces.clear(); texts.clear();
      transact({ ...meta }, () => {
        write('DELETE FROM voca_rows');
        for (const [key, text] of parts) putPart(key, text);
        putPart(HASHES_PART, JSON.stringify(Object.fromEntries(oldHashes)));
      });
      const back = readRows().whole;
      if (canonical(stateOf(back)) !== canonical(state)) throw Error('옮긴 데이터가 옛 데이터와 다릅니다.');
    } catch (error) {
      format = 'legacy';
      pieces.clear(); texts.clear();
      try { storage.transactionSync(() => { sql.exec('DELETE FROM voca_rows'); sql.exec("DELETE FROM voca_meta WHERE key = 'state'"); }); } catch {}
      throw error;
    }
    hashes = oldHashes;
    dropLegacy();
    log.warn?.('[local-store] moved the old whole snapshot to parts', { parts: parts.size, kb: Math.round(json.length / 1024) });
  }
  // The old copy is no longer read once the parts are in place (best-effort, retried at start).
  function dropLegacy() {
    try {
      txRows = 0;
      storage.transactionSync(() => {
        write('DELETE FROM voca_snapshot');
        write('DELETE FROM voca_parts');
        write(`DELETE FROM voca_meta WHERE key IN (${LEGACY_META_KEYS.map(() => '?').join(', ')})`, ...LEGACY_META_KEYS);
      });
      countRows(txRows);
    } catch (error) {
      log.warn?.('[local-store] could not drop the old snapshot yet', error?.message);
    }
  }

  // ---- 시작 ----------------------------------------------------------------------------
  if (metaRows.has('state')) {
    meta = parseMeta(metaRows.get('state'));
    if (sql.exec('SELECT idx FROM voca_snapshot LIMIT 1').toArray().length) dropLegacy();
  } else if (metaRows.has('version') && Number(metaRows.get('version')) >= 0) {
    meta = legacyMeta(metaRows);
    try {
      migrateLegacy();
    } catch (error) {
      migrationError = String(error?.message || error).slice(0, 300);
      log.error?.('[local-store] could not move the old snapshot; reading it the old way', migrationError);
    }
  }

  const load = () => {
    if (meta.version < 0) throw storageError('로컬 저장 데이터가 없습니다.');
    return format === 'legacy' ? loadLegacy() : loadParts();
  };
  const saveState = (state, nextMeta, options = {}) => format === 'legacy'
    ? legacyWriteState(state, nextMeta, options.extra)
    : writeState(state, nextMeta, options);

  return {
    metrics,
    status: () => ({ ...meta }),
    latest: () => latest,
    hasSnapshot: () => meta.version >= 0,
    format: () => format,
    migrationError: () => migrationError,
    // 오늘(UTC) 이 객체가 쓴 줄 수와 무료 한도 대비 %.
    writeStats: () => { rollDay(); return { day: writes.day, ...writeBudget(writes.rows) }; },
    // Rows written outside this repository (alarms); saved with the next meta row.
    countRows,
    set onCommit(callback) { onCommit = callback || (() => {}); },
    async read() { return load(); },
    async refresh() {
      const row = sql.exec("SELECT value FROM voca_meta WHERE key = 'state'").toArray()[0];
      const day = writes.day, rows = writes.rows;
      if (row) meta = parseMeta(row.value);
      else meta = legacyMeta(new Map(sql.exec('SELECT key, value FROM voca_meta').toArray().map(item => [item.key, item.value])));
      if (writes.day === day) writes.rows = Math.max(writes.rows, rows);
      return load();
    },
    // Coordinator contract: `revision` is the version the checkpoint was built on. Returns the
    // version now on disk: unchanged when nothing differed (then nothing is written at all).
    async commit(state, revision) {
      if (Number(revision) !== meta.version) throw storageError('로컬 저장 순서가 맞지 않습니다.', 409);
      const started = Date.now();
      let result;
      try {
        result = saveState(state, { ...meta, version: meta.version + 1 });
      } catch (error) {
        console.error('[local-store] write failed', error?.message);
        throw storageError('저장하지 못했습니다. 잠시 후 다시 시도해주세요.');
      }
      if (!result) { metrics.skipped += 1; metrics.commitRows = 0; return meta.version; }
      metrics.commitMs = Date.now() - started;
      metrics.commitBytes = result.bytes;
      metrics.commitRows = result.rows;
      onCommit();
      return meta.version;
    },
    // Replace the local snapshot with a Supabase copy that is already stored remotely.
    adoptRemote(state, supabaseRevision) {
      const version = meta.version + 1;
      saveState(state, { ...meta, version, syncedVersion: version, supabaseRevision: Number(supabaseRevision) }, { always: true });
    },
    // The upload finished: kept with the next meta row (an upload always writes one).
    noteSyncOk(at, how) { meta = { ...meta, okAt: Number(at), okMode: how }; },
    markSynced(version, supabaseRevision) {
      transact({ ...meta, syncedVersion: Math.max(meta.syncedVersion, version), supabaseRevision: Number(supabaseRevision) });
    },
    // Parts backup: the snapshot reached Supabase as parts (the v12 revision is untouched).
    markSyncedParts(version) {
      transact({ ...meta, syncedVersion: Math.max(meta.syncedVersion, version) });
    },
    // A full v12 upload that is only a periodic safety copy (parts carry the live backup).
    markFullBackup(supabaseRevision, at) {
      transact({ ...meta, supabaseRevision: Number(supabaseRevision), fullAt: Number(at) });
    },
    partHashes() { return new Map(hashes); },
    // Hashes of what Supabase now holds (one row) + meta (one row). `syncedVersion`: the
    // snapshot is fully uploaded with this batch, saved in the same write.
    savePartHashes(entries, removed, partsRevision, syncedVersion = null) {
      const next = new Map(hashes);
      for (const [key, hash] of entries) next.set(key, hash);
      for (const key of removed) next.delete(key);
      const nextMeta = { ...meta, partsRevision: Number(partsRevision) };
      if (syncedVersion !== null) nextMeta.syncedVersion = Math.max(meta.syncedVersion, syncedVersion);
      transact(nextMeta, hashesWork(next));
      hashes = next;
    },
    // Forget what Supabase holds, so the next upload sends every part again.
    clearPartHashes() {
      transact({ ...meta, partsRevision: null }, hashesWork(new Map()));
      hashes = new Map();
    },
    // Restore from the parts backup: the state and the hashes of what Supabase holds.
    adoptRemoteParts(state, partsRevision, remoteHashes) {
      const version = meta.version + 1;
      const next = new Map(remoteHashes);
      saveState(state, { ...meta, version, syncedVersion: version, partsRevision: Number(partsRevision) }, { always: true, extra: hashesWork(next) });
      hashes = next;
    }
  };
}

// minIntervalMs: the least time between the end of one successful upload and the start
// of the next. The local snapshot is durable, so a later backup loses nothing. It may be a
// function (V13.144: longer when today's write quota is nearly used up).
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
  const interval = () => Number(typeof minIntervalMs === 'function' ? minIntervalMs() : minIntervalMs) || 0;
  // V13.99: when an upload last succeeded (and how), so /api/health still shows it after a
  // restart. V13.144: kept in the local meta row that the upload writes anyway (no extra
  // rows); the ctx.storage keys of V13.99-V13.143 are still read once.
  let lastOkAt = Number(local.status().okAt) || 0;
  let lastOkMode = local.status().okMode || null;
  const loaded = Promise.resolve()
    .then(() => storage?.get?.(['supabase_last_ok_at', 'supabase_last_ok_mode']))
    .then(saved => {
      const at = Number(saved?.get?.('supabase_last_ok_at')) || 0;
      if (at > lastOkAt) { lastOkAt = at; lastOkMode = saved.get('supabase_last_ok_mode') || null; }
    })
    .catch(() => {});
  function markOk(how) {
    lastOkAt = Date.now();
    lastOkMode = how;
  }

  const pending = () => {
    const status = local.status();
    return status.syncedVersion < status.version;
  };

  function schedule(delay = delayMs) {
    if (!pendingSince && pending()) pendingSince = Date.now();
    if (timer || closed) return;
    if (lastSyncAt && interval() > 0) delay = Math.max(delay, lastSyncAt + interval() - Date.now());
    timer = setTimeout(() => { timer = null; run().catch(() => {}); }, delay);
    timer?.unref?.();
    // Safety net: if the object is evicted before the timer fires, the alarm
    // wakes it up again and the constructor + alarm() finish the upload.
    Promise.resolve(storage.setAlarm?.(Date.now() + delay + 30000)).catch(() => {});
    // An alarm is a row written too (counted toward today's quota).
    local.countRows?.(1);
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
    local.noteSyncOk?.(Date.now(), 'full');
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
    // V13.144: the local copy is stored as these same parts, so they are reused as they are.
    const parts = snapshot.parts || partitionState(JSON.parse(snapshot.json));
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
      // The last batch also marks the snapshot uploaded: one write (hashes + meta) per batch.
      const last = i === batches.length - 1;
      if (last) local.noteSyncOk?.(Date.now(), 'parts');
      local.savePartHashes(batch.map(([key]) => [key, hashes.get(key)]), drop, revision, last ? snapshot.version : null);
      bytes += batch.reduce((sum, [key, text]) => sum + key.length + text.length, 0);
    }
    if (!batches.length) { local.noteSyncOk?.(Date.now(), 'parts'); local.markSyncedParts(snapshot.version); }
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
        const how = await resolveMode();
        if (how === 'parts') {
          await pushParts();
          await maybeFullCopy();
        } else {
          // Without a minimum interval, keep going while newer snapshots exist; with one,
          // a newer snapshot waits for the next scheduled upload.
          while (await pushFull() && interval() <= 0) { /* next snapshot */ }
        }
        markOk(how);
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
    // Resolves once the saved last-success time has been read.
    loaded,
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
      // V13.99: last successful run (nothing left to upload) and the way the backup is stored:
      // 'parts', 'full', or 'checking' until the first upload finds out.
      last_ok_at: lastOkAt || null,
      last_ok_mode: lastOkMode,
      backup_mode: mode === 'unknown' ? 'checking' : mode,
      backup_forced_full: !!forceFull,
      full_copy_error: fullError
    })
  };
}
