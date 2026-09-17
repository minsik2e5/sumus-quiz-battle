import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { migrateState, repository } from './repository.mjs';
import { passwordHash } from './auth.mjs';
import { service, sweep } from './service.mjs';
import { selfSignup } from './signup.mjs';
import { examAdmin } from './exam-admin.mjs';
const root = resolve(fileURLToPath(new URL('../public/', import.meta.url)));
const dbPath = process.env.DATA_PATH || fileURLToPath(new URL('../var/sumus.sqlite', import.meta.url));
const repo = await repository(dbPath);
{
  const { state, revision } = await repo.read();
  if (migrateState(state)) await repo.commit(state, revision);
}
{
  const { state, revision } = await repo.read();
  const adminUsername = process.env.ADMIN_USERNAME || 'teacher';
  const teacher = state.profiles.find(p => p.role === 'teacher' && p.username === adminUsername);
  if (teacher && process.env.FORCE_ADMIN_PASSWORD_HASH) {
    const hash = String(process.env.FORCE_ADMIN_PASSWORD_HASH);
    if (!/^[0-9a-f]{32}:[0-9a-f]{128}$/i.test(hash)) throw Error('FORCE_ADMIN_PASSWORD_HASH format is invalid');
    teacher.password_hash = hash;
    state.tokens = state.tokens.filter(t => t.user_id !== teacher.id);
    await repo.commit(state, revision);
    console.log('[auth] Teacher password reset completed');
  } else if (!teacher && process.env.ADMIN_PASSWORD) {
    if (process.env.ADMIN_PASSWORD.length < 12) throw Error('ADMIN_PASSWORD must contain at least 12 characters');
    state.profiles.push({ id: randomUUID(), username: adminUsername, display_name: 'SUMUS 선생님', class_name: '고1A', role: 'teacher', active: true, password_hash: await passwordHash(process.env.ADMIN_PASSWORD), school_ids: state.schools.filter(school => school.active !== false).map(school => school.id), active_school_id: state.schools[0].id });
    await repo.commit(state, revision);
  }
}
let snapshotCache = await repo.read();
let tail = Promise.resolve();
const serial = fn => { const next = tail.then(fn, fn); tail = next.catch(() => {}); return next; };
const commitMutation = fn => serial(async () => {
  const state = structuredClone(snapshotCache.state);
  const revision = snapshotCache.revision;
  const output = await fn(state);
  try {
    await repo.commit(state, revision);
  } catch (error) {
    snapshotCache = await repo.read();
    if (!error.status) error.status = 409;
    throw error;
  }
  snapshotCache = { state, revision: revision + 1 };
  return output;
});
const rates = new Map();
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/manifest+json' };
function rateLimit(bucket, max, windowMs, message) {
  const list = (rates.get(bucket) || []).filter(t => t > Date.now() - windowMs);
  if (list.length >= max) throw Object.assign(Error(message), { status: 429 });
  list.push(Date.now()); rates.set(bucket, list);
}
async function readJson(req, max = 100000) {
  let text = '';
  for await (const chunk of req) { text += chunk; if (text.length > max) throw Object.assign(Error('요청이 너무 큽니다.'), { status: 413 }); }
  try { return text ? JSON.parse(text) : {}; } catch { throw Object.assign(Error('요청 형식을 확인해주세요.'), { status: 400 }); }
}
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; media-src 'self' blob:; font-src 'self'; frame-ancestors 'self'; base-uri 'self'; form-action 'self'");
  if (process.env.NODE_ENV === 'production') res.setHeader('Strict-Transport-Security', 'max-age=31536000');
  try {
    if (url.pathname.startsWith('/internal/state/')) {
      res.setHeader('Cache-Control', 'no-store');
      if (req.method !== 'POST') throw Object.assign(Error('지원하지 않는 요청입니다.'), { status: 405 });
      const expected = String(process.env.STATE_BRIDGE_SECRET || '');
      const supplied = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
      if (!expected || supplied !== expected) throw Object.assign(Error('허용되지 않은 요청입니다.'), { status: 403 });
      if (url.pathname === '/internal/state/read') {
        const snapshot = { state: structuredClone(snapshotCache.state), revision: snapshotCache.revision };
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(snapshot)); return;
      }
      if (url.pathname === '/internal/state/commit') {
        const body = await readJson(req, 5000000);
        if (!Number.isInteger(Number(body.revision)) || !body.state || typeof body.state !== 'object') throw Object.assign(Error('저장 요청을 확인해주세요.'), { status: 400 });
        await serial(async () => {
          await repo.commit(body.state, Number(body.revision));
          snapshotCache = { state: structuredClone(body.state), revision: Number(body.revision) + 1 };
        });
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ ok: true })); return;
      }
      throw Object.assign(Error('요청한 기능을 찾을 수 없습니다.'), { status: 404 });
    }
    if (url.pathname.startsWith('/api/')) {
      res.setHeader('Cache-Control', 'no-store');
      if (!['GET', 'POST', 'PATCH'].includes(req.method)) throw Object.assign(Error('지원하지 않는 요청입니다.'), { status: 405 });
      if (req.method !== 'GET') {
        if (req.headers['sec-fetch-site'] === 'cross-site') throw Object.assign(Error('허용되지 않은 요청입니다.'), { status: 403 });
        if (req.headers.origin && new URL(req.headers.origin).host !== req.headers.host) throw Object.assign(Error('허용되지 않은 요청입니다.'), { status: 403 });
        if (!String(req.headers['content-type']).startsWith('application/json')) throw Object.assign(Error('요청 형식을 확인해주세요.'), { status: 415 });
      }
      const body = await readJson(req);
      const address = req.socket.remoteAddress || 'unknown';
      if (url.pathname === '/api/login') {
        const key = address + ':' + String(body.username || '').trim().toLowerCase();
        rateLimit(key, 10, 15 * 60000, '로그인 시도가 많습니다. 15분 후 다시 시도해주세요.');
        rateLimit(address + ':all', 500, 15 * 60000, '요청이 많습니다. 잠시 후 다시 시도해주세요.');
      }
      if (url.pathname === '/api/signup') {
        const username = String(body.username || '').trim().toLowerCase();
        rateLimit(address + ':signup', 12, 30 * 60000, '회원가입 시도가 많습니다. 잠시 후 다시 시도해주세요.');
        rateLimit(address + ':signup:' + username, 4, 30 * 60000, '같은 아이디로 가입 시도가 많습니다. 잠시 후 다시 시도해주세요.');
      }
      if (rates.size > 10000) for (const [k, values] of rates) if (values.at(-1) < Date.now() - 30 * 60000) rates.delete(k);
      const token = (req.headers.cookie || '').split(';').map(s => s.trim()).find(s => s.startsWith('sumus_session='))?.slice(14) || '';
      const execute = async state => {
        const path = url.pathname.slice(4);
        const adminOutput = await examAdmin(state, req.method, path, body, token);
        return adminOutput !== undefined
          ? adminOutput
          : url.pathname === '/api/signup' && req.method === 'POST'
            ? await selfSignup(state, body)
            : await service(state, req.method, path, body, token);
      };
      const result = req.method === 'GET'
        ? await execute(snapshotCache.state)
        : await commitMutation(execute);
      const secure = process.env.COOKIE_SECURE === 'true' || process.env.NODE_ENV === 'production';
      if (result._cookie) { res.setHeader('Set-Cookie', `sumus_session=${result._cookie}; HttpOnly; SameSite=Strict; Path=/; Max-Age=604800${secure ? '; Secure' : ''}`); delete result._cookie; }
      if (result._clearCookie) { res.setHeader('Set-Cookie', 'sumus_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0'); delete result._clearCookie; }
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(result)); return;
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); res.end(); return; }
    const path = resolve(root, '.' + decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname));
    if (!path.startsWith(root + sep) && path !== root) { res.writeHead(403); res.end(); return; }
    const s = await stat(path); if (!s.isFile()) throw Error('not found');
    res.setHeader('Content-Type', mime[extname(path)] || 'application/octet-stream');
    const extension = extname(path);
    res.setHeader('Cache-Control', extension === '.html' || url.pathname === '/sw.js'
      ? 'no-cache'
      : 'public, max-age=3600, stale-while-revalidate=86400');
    res.end(req.method === 'HEAD' ? undefined : await readFile(path));
  } catch (e) {
    const internal = url.pathname.startsWith('/internal/');
    const status = e.status || (url.pathname.startsWith('/api/') || internal ? 500 : 404);
    if (status === 500) console.error('[request]', e.message);
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: status === 500 ? '저장 서버에 연결하지 못했습니다. 잠시 후 다시 시도해주세요.' : e.message }));
  }
});
const timer = setInterval(() => serial(async () => {
  const state = structuredClone(snapshotCache.state);
  if (!sweep(state)) return;
  const revision = snapshotCache.revision;
  await repo.commit(state, revision);
  snapshotCache = { state, revision: revision + 1 };
}).catch(async e => {
  console.error('[deadline]', e.message);
  snapshotCache = await repo.read().catch(() => snapshotCache);
}), 5000);
timer.unref();
const port = Number(process.env.PORT || 3000);
server.listen(port, process.env.HOST || '0.0.0.0', () => console.log(`SUMUS VOCA http://localhost:${server.address().port}`));
async function shutdown() { clearInterval(timer); server.close(); await tail; repo.close(); process.exit(0); }
process.on('SIGTERM', shutdown); process.on('SIGINT', shutdown);
