import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export function emptyState() { return { profiles: [], tokens: [], sessions: [], mastery: {}, assignments: [], exams: [], examAttempts: [], practices: [], extraBooks: [] }; }
export async function repository(path) {
  if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const base = process.env.SUPABASE_URL.replace(/\/$/, '') + '/rest/v1/voca_v12_state';
    const headers = { apikey: process.env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json' };
    async function request(url, options = {}) {
      const r = await fetch(url, { ...options, headers: { ...headers, ...options.headers }, signal: AbortSignal.timeout(10000) });
      if (!r.ok) throw new Error('Supabase 저장 연결을 확인해주세요.');
      return r.status === 204 ? null : r.json();
    }
    const initial = await request(base + '?id=eq.main');
    if (!initial.length) await request(base, { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ id: 'main', revision: 0, data: emptyState() }) });
    return {
      async read() { const [r] = await request(base + '?id=eq.main'); return { revision: r.revision, state: r.data }; },
      async commit(state, revision) {
        const rows = await request(`${base}?id=eq.main&revision=eq.${revision}`, { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ data: state, revision: revision + 1, updated_at: new Date().toISOString() }) });
        if (!rows.length) throw Object.assign(new Error('다른 기기의 변경이 있습니다. 다시 시도해주세요.'), { status: 409 });
      }, close() {}
    };
  }
  mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS state (id INTEGER PRIMARY KEY CHECK(id=1), revision INTEGER NOT NULL, data TEXT NOT NULL);');
  db.prepare('INSERT OR IGNORE INTO state VALUES (1, 0, ?)').run(JSON.stringify(emptyState()));
  return {
    async read() { const r = db.prepare('SELECT * FROM state WHERE id=1').get(); return { revision: r.revision, state: JSON.parse(r.data) }; },
    async commit(state, revision) {
      const r = db.prepare('UPDATE state SET data=?, revision=revision+1 WHERE id=1 AND revision=?').run(JSON.stringify(state), revision);
      if (!r.changes) throw Object.assign(new Error('저장 상태가 변경되었습니다. 다시 시도해주세요.'), { status: 409 });
    }, close() { db.close(); }
  };
}
