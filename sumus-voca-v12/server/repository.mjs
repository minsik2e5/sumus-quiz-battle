import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export function emptyState() {
  return { profiles: [], tokens: [], sessions: [], mastery: {}, assignments: [], exams: [], examAttempts: [], practices: [], extraBooks: [] };
}

async function protectedSupabaseRepository() {
  const base = process.env.SUPABASE_URL.replace(/\/$/, '') + '/rest/v1/rpc/';
  const apiKey = process.env.SUPABASE_ANON_KEY;
  const secret = process.env.VOCA_STATE_SECRET;
  const headers = {
    apikey: apiKey,
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json'
  };

  async function rpc(name, body) {
    const response = await fetch(base + name, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(12000)
    });
    const text = await response.text();
    let payload = null;
    try { payload = text ? JSON.parse(text) : null; } catch {}
    if (!response.ok) {
      const message = payload?.message || payload?.error || 'Supabase 저장 연결을 확인해주세요.';
      const status = payload?.code === '40001' || message.includes('revision_conflict') ? 409 : 503;
      throw Object.assign(new Error(status === 409 ? '다른 기기의 변경이 있습니다. 다시 시도해주세요.' : '영구 저장 서버에 연결하지 못했습니다.'), { status });
    }
    return payload;
  }

  async function load() {
    const rows = await rpc('voca_v12_state_read', { p_secret: secret });
    const row = Array.isArray(rows) ? rows[0] : rows;
    if (!row || row.revision === undefined || !row.data) throw Object.assign(new Error('영구 저장 데이터를 불러오지 못했습니다.'), { status: 503 });
    return { revision: Number(row.revision), state: row.data };
  }

  let cache = await load();
  console.log(`[storage] Supabase persistent state connected · revision ${cache.revision}`);

  return {
    async read() {
      return { revision: cache.revision, state: structuredClone(cache.state) };
    },
    async commit(state, revision) {
      try {
        const next = await rpc('voca_v12_state_commit', {
          p_secret: secret,
          p_revision: Number(revision),
          p_data: state
        });
        cache = { revision: Number(next), state: structuredClone(state) };
      } catch (error) {
        try { cache = await load(); } catch {}
        throw error;
      }
    },
    close() {}
  };
}

export async function repository(path) {
  if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY && process.env.VOCA_STATE_SECRET) {
    return protectedSupabaseRepository();
  }

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
