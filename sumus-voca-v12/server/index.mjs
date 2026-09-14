import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { repository } from './repository.mjs';
import { passwordHash } from './auth.mjs';
import { service, sweep } from './service.mjs';
import { selfSignup } from './signup.mjs';
const root = resolve(fileURLToPath(new URL('../public/', import.meta.url)));
const dbPath = process.env.DATA_PATH || fileURLToPath(new URL('../var/sumus.sqlite', import.meta.url));
const repo = await repository(dbPath);
if (process.env.ADMIN_PASSWORD) {
  const { state, revision } = await repo.read();
  const adminUsername = process.env.ADMIN_USERNAME || 'teacher';
  const teacher = state.profiles.find(p => p.role === 'teacher' && p.username === adminUsername);
  if (!teacher) {
    if (process.env.ADMIN_PASSWORD.length < 6) throw Error('ADMIN_PASSWORD must contain at least 6 characters');
    state.profiles.push({ id: randomUUID(), username: adminUsername, display_name: 'SUMUS 선생님', class_name: '고1A', role: 'teacher', active: true, password_hash: await passwordHash(process.env.ADMIN_PASSWORD) });
    await repo.commit(state, revision);
  } else if (process.env.FORCE_ADMIN_PASSWORD === 'true') {
    if (process.env.ADMIN_PASSWORD.length < 6) throw Error('ADMIN_PASSWORD must contain at least 6 characters');
    teacher.password_hash = await passwordHash(process.env.ADMIN_PASSWORD);
    state.tokens = state.tokens.filter(t => t.user_id !== teacher.id);
    await repo.commit(state, revision);
    console.log('[auth] Teacher password reset completed');
  }
}
let tail = Promise.resolve();
const serial = fn => { const next = tail.then(fn, fn); tail = next.catch(() => {}); return next; };
const rates = new Map();
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/manifest+json' };
function rateLimit(bucket, max, windowMs, message) {
  const list = (rates.get(bucket) || []).filter(t => t > Date.now() - windowMs);
  if (list.length >= max) throw Object.assign(Error(message), { status: 429 });
  list.push(Date.now()); rates.set(bucket, list);
}
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; media-src 'self' blob:; font-src 'self'; frame-ancestors 'self'; base-uri 'self'; form-action 'self'");
  if (process.env.NODE_ENV === 'production') res.setHeader('Strict-Transport-Security', 'max-age=31536000');
  try {
    if (url.pathname.startsWith('/api/')) {
      res.setHeader('Cache-Control', 'no-store');
      if (!['GET', 'POST', 'PATCH'].includes(req.method)) throw Object.assign(Error('지원하지 않는 요청입니다.'), { status: 405 });
      if (req.method !== 'GET') {
        if (req.headers['sec-fetch-site'] === 'cross-site') throw Object.assign(Error('허용되지 않은 요청입니다.'), { status: 403 });
        if (req.headers.origin && new URL(req.headers.origin).host !== req.headers.host) throw Object.assign(Error('허용되지 않은 요청입니다.'), { status: 403 });
        if (!String(req.headers['content-type']).startsWith('application/json')) throw Object.assign(Error('요청 형식을 확인해주세요.'), { status: 415 });
      }
      let text = '';
      for await (const chunk of req) { text += chunk; if (text.length > 100000) throw Object.assign(Error('요청이 너무 큽니다.'), { status: 413 }); }
      let body = {}; try { body = text ? JSON.parse(text) : {}; } catch { throw Object.assign(Error('요청 형식을 확인해주세요.'), { status: 400 }); }
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
      const result = await serial(async () => {
        const snapshot = await repo.read(), state = snapshot.state;
        let revision = snapshot.revision;
        if (sweep(state)) { await repo.commit(state, revision); revision++; }
        const output = url.pathname === '/api/signup' && req.method === 'POST'
          ? await selfSignup(state, body)
          : await service(state, req.method, url.pathname.slice(4), body, token);
        if (req.method !== 'GET') await repo.commit(state, revision);
        return output;
      });
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
    res.setHeader('Cache-Control', 'no-cache');
    res.end(req.method === 'HEAD' ? undefined : await readFile(path));
  } catch (e) {
    const status = e.status || (url.pathname.startsWith('/api/') ? 500 : 404);
    if (status === 500) console.error('[request]', e.message);
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: status === 500 ? '저장 서버에 연결하지 못했습니다. 잠시 후 다시 시도해주세요.' : e.message }));
  }
});
const timer = setInterval(() => serial(async () => { const { state, revision } = await repo.read(); if (sweep(state)) await repo.commit(state, revision); }).catch(e => console.error('[deadline]', e.message)), 1000);
timer.unref();
const port = Number(process.env.PORT || 3000);
server.listen(port, process.env.HOST || '0.0.0.0', () => console.log(`SUMUS VOCA http://localhost:${port}`));
async function shutdown() { clearInterval(timer); server.close(); await tail; repo.close(); process.exit(0); }
process.on('SIGTERM', shutdown); process.on('SIGINT', shutdown);
