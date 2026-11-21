// 썸어스 마케팅 센터 - Cloudflare Workers 진입점.
// 화면 파일은 정적 자산(site/)으로 내보내고, /api 요청은 비밀번호를 확인한 뒤
// 기록 전체를 맡는 Durable Object 하나(내장 SQLite)로 보낸다.
import { DurableObject } from 'cloudflare:workers';
import { SEED_TASKS, SEED_CONTENT } from './seed.js';

const COLLECTIONS = ['tasks', 'metrics', 'leads', 'content', 'routine'];
const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
const MAX_BODY = 16 * 1024;

export class MarketingStore extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    this.sql.exec(`CREATE TABLE IF NOT EXISTS docs (
      col TEXT NOT NULL, id TEXT NOT NULL, data TEXT NOT NULL, updated INTEGER NOT NULL,
      PRIMARY KEY (col, id))`);
    this.sql.exec('CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT NOT NULL)');
    this.seed();
  }

  // 처음 한 번만 기본 할 일과 콘텐츠 계획을 넣는다
  seed() {
    const done = this.sql.exec("SELECT v FROM meta WHERE k = 'seeded'").toArray();
    if (done.length) return;
    const now = Date.now();
    for (const t of SEED_TASKS) this.put('tasks', t.id, { ...t, id: undefined }, now);
    for (const c of SEED_CONTENT) this.put('content', c.id, { ...c, id: undefined }, now);
    this.sql.exec("INSERT INTO meta (k, v) VALUES ('seeded', ?)", String(now));
  }

  put(col, id, data, now = Date.now()) {
    const body = JSON.parse(JSON.stringify(data));
    this.sql.exec('INSERT OR REPLACE INTO docs (col, id, data, updated) VALUES (?, ?, ?, ?)', col, id, JSON.stringify(body), now);
    return body;
  }

  get(col, id) {
    const row = this.sql.exec('SELECT data FROM docs WHERE col = ? AND id = ?', col, id).toArray()[0];
    return row ? JSON.parse(row.data) : null;
  }

  all() {
    const out = { tasks: [], metrics: [], leads: [], content: [], routine: [] };
    for (const row of this.sql.exec('SELECT col, id, data FROM docs').toArray()) {
      if (out[row.col]) out[row.col].push({ ...JSON.parse(row.data), id: row.id });
    }
    return out;
  }

  async fetch(request) {
    const url = new URL(request.url);
    const parts = url.pathname.split('/').filter(Boolean); // api, all | api, doc, col, id?
    if (request.method === 'GET' && parts[1] === 'all') return json(this.all());
    if (parts[1] !== 'doc') return json({ error: 'not_found' }, 404);
    const col = parts[2];
    let id = parts[3];
    if (!COLLECTIONS.includes(col)) return json({ error: '없는 분류예요' }, 400);
    if (id !== undefined && !ID_RE.test(id)) return json({ error: '잘못된 주소예요' }, 400);

    let body = null;
    if (request.method !== 'DELETE') {
      const text = await request.text();
      if (text.length > MAX_BODY) return json({ error: '내용이 너무 길어요' }, 413);
      try { body = JSON.parse(text || '{}'); } catch { return json({ error: '형식이 잘못됐어요' }, 400); }
      if (!body || typeof body !== 'object' || Array.isArray(body)) return json({ error: '형식이 잘못됐어요' }, 400);
      delete body.id;
    }

    if (request.method === 'POST' && id === undefined) {
      id = crypto.randomUUID().replace(/-/g, '').slice(0, 20);
      return json({ id, ...this.put(col, id, body) }, 201);
    }
    if (id === undefined) return json({ error: 'not_found' }, 404);
    if (request.method === 'PUT') return json({ id, ...this.put(col, id, body) });
    if (request.method === 'PATCH') {
      const old = this.get(col, id);
      if (!old) return json({ error: '이미 지워진 기록이에요' }, 404);
      return json({ id, ...this.put(col, id, { ...old, ...body }) });
    }
    if (request.method === 'DELETE') {
      this.sql.exec('DELETE FROM docs WHERE col = ? AND id = ?', col, id);
      return json({ ok: true });
    }
    return json({ error: 'method_not_allowed' }, 405);
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/api/health') return json({ ok: true });
    if (url.pathname.startsWith('/api/')) {
      if (!(await allowed(request.headers.get('x-sumus-key') || '', env))) return json({ error: '비밀번호가 맞지 않아요' }, 401);
      const stub = env.STORE.get(env.STORE.idFromName('sumus'));
      return stub.fetch(request);
    }
    return env.ASSETS.fetch(request);
  }
};

// 비밀번호 확인: 비밀 값 ADMIN_KEY가 있으면 그것을, 없으면 ADMIN_KEY_HASH(SHA-256)를 쓴다
async function allowed(key, env) {
  if (!key) return false;
  if (env.ADMIN_KEY) return safeEqual(key, env.ADMIN_KEY);
  if (!env.ADMIN_KEY_HASH) return false;
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(key));
  const hex = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
  return safeEqual(hex, env.ADMIN_KEY_HASH.toLowerCase());
}

function safeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
}
