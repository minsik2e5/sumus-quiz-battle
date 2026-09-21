import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export const DEFAULT_SCHOOLS = [
  { id: 'danwon-high', name: '단원고', full_name: '단원고등학교', active: true, sort_order: 10 },
  { id: 'seonbu-high', name: '선부고', full_name: '선부고등학교', active: true, sort_order: 20 },
  { id: 'gangseo-high', name: '강서고', full_name: '강서고등학교', active: true, sort_order: 30 }
];

export function emptyState() {
  return { schema_version: 13, schools: structuredClone(DEFAULT_SCHOOLS), profiles: [], tokens: [], sessions: [], mastery: {}, assignments: [], exams: [], examAttempts: [], practices: [], extraBooks: [] };
}

export function migrateState(state) {
  let changed = false;
  for (const key of ['profiles', 'tokens', 'sessions', 'assignments', 'exams', 'examAttempts', 'practices', 'extraBooks']) {
    if (!Array.isArray(state[key])) { state[key] = []; changed = true; }
  }
  if (!state.mastery || typeof state.mastery !== 'object' || Array.isArray(state.mastery)) { state.mastery = {}; changed = true; }
  if (!Array.isArray(state.schools)) { state.schools = []; changed = true; }
  for (const school of DEFAULT_SCHOOLS) {
    if (!state.schools.some(item => item.id === school.id || item.name === school.name)) { state.schools.push(structuredClone(school)); changed = true; }
  }
  state.schools.sort((a, b) => (a.sort_order || 999) - (b.sort_order || 999));
  const normalizeSchool = value => String(value || '').trim().replace(/\s+/g, '');
  const byRef = value => {
    const raw = String(value || '').trim();
    const normalized = normalizeSchool(raw);
    return state.schools.find(school =>
      school.id === raw ||
      normalizeSchool(school.name) === normalized ||
      normalizeSchool(school.full_name) === normalized
    );
  };
  for (const profile of state.profiles) {
    if (profile.role === 'student') {
      const school = byRef(profile.school_id) || byRef(profile.school);
      if (school && (profile.school_id !== school.id || profile.school !== school.name)) {
        profile.school_id = school.id;
        profile.school = school.name;
        changed = true;
      }
    }
    if (profile.role === 'teacher') {
      const normalizedIds = [...new Set((Array.isArray(profile.school_ids) ? profile.school_ids : []).map(value => byRef(value)?.id).filter(Boolean))];
      const schoolIds = normalizedIds.length ? normalizedIds : state.schools.filter(school => school.active !== false).map(school => school.id);
      if (JSON.stringify(profile.school_ids || []) !== JSON.stringify(schoolIds)) { profile.school_ids = schoolIds; changed = true; }
      const active = byRef(profile.active_school_id);
      if (!active || !profile.school_ids.includes(active.id)) {
        profile.active_school_id = profile.school_ids.find(schoolId => state.schools.some(school => school.id === schoolId && school.active !== false)) || state.schools[0]?.id;
        changed = true;
      } else if (profile.active_school_id !== active.id) {
        profile.active_school_id = active.id;
        changed = true;
      }
    }
  }
  for (const key of ['assignments', 'exams', 'sessions', 'practices']) {
    for (const record of state[key]) {
      const school = byRef(record.school_id) || byRef(record.school);
      if (school && (record.school_id !== school.id || record.school !== school.name)) {
        record.school_id = school.id;
        record.school = school.name;
        changed = true;
      }
    }
  }
  if (state.schema_version !== 13) { state.schema_version = 13; changed = true; }
  return changed;
}

async function remoteBridgeRepository() {
  const base = process.env.STATE_BRIDGE_URL.replace(/\/$/, '');
  const secret = process.env.STATE_BRIDGE_SECRET;

  async function request(path, body = {}) {
    const response = await fetch(base + path, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secret}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15000)
    });
    const text = await response.text();
    let payload = null;
    try { payload = text ? JSON.parse(text) : null; } catch {}
    if (!response.ok) {
      const message = payload?.error || '영구 저장 서버에 연결하지 못했습니다.';
      throw Object.assign(new Error(message), { status: response.status === 409 ? 409 : 503 });
    }
    return payload;
  }

  const initial = await request('/internal/state/read');
  if (!initial || initial.revision === undefined || !initial.state) {
    throw Object.assign(new Error('영구 저장 데이터를 불러오지 못했습니다.'), { status: 503 });
  }
  console.log(`[storage] Remote state bridge connected · revision ${initial.revision}`);

  return {
    async read() {
      const payload = await request('/internal/state/read');
      return { revision: Number(payload.revision), state: payload.state };
    },
    async commit(state, revision) {
      await request('/internal/state/commit', { revision: Number(revision), state });
    },
    close() {}
  };
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
  if (process.env.STATE_BRIDGE_URL && process.env.STATE_BRIDGE_SECRET) {
    return remoteBridgeRepository();
  }

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
