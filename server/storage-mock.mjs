// Minimal stand-in for a SQLite-backed Durable Object's ctx.storage, backed by
// node:sqlite so the real SQL statements run. cloudflare-check.mjs와 write-sim.mjs가 쓴다.
//
// V13.144: Cloudflare처럼 "쓴 줄 수"를 센다. INSERT/UPDATE/DELETE 문장은 바뀐 행 수를 cursor.rowsWritten으로
// 돌려주고 storage.rowsWritten에 더한다. 알람 하나, 키-값 put 한 키도 한 줄로 센다(무료 한도와 같은 셈).
import { DatabaseSync } from 'node:sqlite';

export function createStorageMock() {
  const db = new DatabaseSync(':memory:');
  let failWrites = 0;
  let failMatch = null;
  const storage = {
    alarm: null,
    rowsWritten: 0,
    // Fails the next write; `match` (RegExp) limits it to matching statements.
    failNextWrite(match = null) { failWrites += 1; failMatch = match; },
    sql: {
      exec(query, ...bindings) {
        const writes = /^\s*(INSERT|UPDATE|DELETE)/i.test(query);
        if (failWrites > 0 && writes && (!failMatch || failMatch.test(query))) {
          failWrites -= 1;
          throw new Error('simulated disk failure');
        }
        const statement = db.prepare(query);
        let rows = [];
        let rowsWritten = 0;
        if (/^\s*SELECT/i.test(query)) rows = statement.all(...bindings);
        else {
          const result = statement.run(...bindings);
          if (writes) rowsWritten = Number(result.changes) || 0;
        }
        storage.rowsWritten += rowsWritten;
        return { toArray: () => rows, one: () => rows[0], rowsWritten };
      }
    },
    transactionSync(callback) {
      db.exec('BEGIN');
      try { const result = callback(); db.exec('COMMIT'); return result; }
      catch (error) { db.exec('ROLLBACK'); throw error; }
    },
    setAlarm(time) { this.alarm = time; storage.rowsWritten += 1; },
    // Key-value API of ctx.storage (V13.99: last successful backup time).
    kv: new Map(),
    // Like the real API: a key or a list of keys (-> Map), a key and value or an object of entries.
    async get(key) { return Array.isArray(key) ? new Map(key.filter(k => this.kv.has(k)).map(k => [k, this.kv.get(k)])) : this.kv.get(key); },
    async put(key, value) {
      const entries = typeof key === 'object' ? Object.entries(key) : [[key, value]];
      for (const [k, v] of entries) this.kv.set(k, v);
      storage.rowsWritten += entries.length;
    },
    // Old (V13.143) whole-JSON snapshot rows, as a store left by that version holds them.
    writeLegacySnapshot(state, meta = {}) {
      db.exec('CREATE TABLE IF NOT EXISTS voca_snapshot (idx INTEGER PRIMARY KEY, data TEXT NOT NULL)');
      db.exec('CREATE TABLE IF NOT EXISTS voca_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)');
      db.exec('CREATE TABLE IF NOT EXISTS voca_parts (key TEXT PRIMARY KEY, hash TEXT NOT NULL)');
      const json = JSON.stringify(state);
      const size = 500_000;
      for (let i = 0, idx = 0; i < json.length; i += size, idx += 1) db.prepare('INSERT INTO voca_snapshot (idx, data) VALUES (?, ?)').run(idx, json.slice(i, i + size));
      for (const [key, value] of Object.entries({ version: 7, synced_version: 7, supabase_revision: 41, parts_revision: '', full_at: 0, ...meta })) db.prepare('INSERT OR REPLACE INTO voca_meta (key, value) VALUES (?, ?)').run(key, String(value));
    },
    count(table) { return Number(db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get().n); }
  };
  return storage;
}
