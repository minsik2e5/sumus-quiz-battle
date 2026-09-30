// API of the planner. Pure logic over a small key-value store so it runs the same in the
// Durable Object and in the local checks (check.mjs).
//   GET  /api/auth              -> { configured, authenticated }
//   POST /api/auth  {pin}        -> sets the PIN the first time, otherwise signs in (cookie)
//   DELETE /api/auth             -> signs out
//   PATCH /api/auth {currentPin, newPin} -> changes the PIN and signs every device out
//   GET  /api/planner            -> { state, updatedAt }
//   PUT  /api/planner {state, baseUpdatedAt} -> { updatedAt } | 409 { error, state, updatedAt }
//   POST /api/planner/import {state} -> replaces the document (a backup file), keeps the old one
//   GET  /api/widget             -> same as GET /api/planner (the widget page)
const COOKIE = 'sp_session';
const SESSION_MS = 180 * 86400000;
const LOCK_AFTER = 5, LOCK_MS = 5 * 60000;
const MAX_DOC = 2_000_000; // bytes of JSON

const json = (body, status = 200, headers = {}) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers } });
const hex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
const randomHex = n => hex(crypto.getRandomValues(new Uint8Array(n)));
async function sha256(text) { return hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))); }
async function pinHash(pin, salt) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits']);
  return hex(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: new TextEncoder().encode(salt), iterations: 100000 }, key, 256));
}
function cookieOf(request) {
  const raw = request.headers.get('Cookie') || '';
  const hit = raw.split(/;\s*/).find(part => part.startsWith(COOKIE + '='));
  return hit ? decodeURIComponent(hit.slice(COOKIE.length + 1)) : '';
}
const setCookie = (token, maxAge) => `${COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;

async function signedIn(request, store, now) {
  const token = cookieOf(request);
  if (!token) return false;
  const sessions = (await store.get('sessions')) || {};
  const s = sessions[await sha256(token)];
  return !!s && s.expires > now;
}

export async function handleApi(request, store, now = Date.now()) {
  const url = new URL(request.url), path = url.pathname, method = request.method;
  try {
    if (path === '/api/auth') return await auth(request, store, now, method);
    if (!(await signedIn(request, store, now))) return json({ error: '로그인이 필요해요.' }, 401);
    if ((path === '/api/planner' || path === '/api/widget') && method === 'GET') {
      const doc = (await store.get('doc')) || { state: null, updatedAt: 0 };
      return json(doc);
    }
    if ((path === '/api/planner' || path === '/api/widget') && method === 'PUT') {
      const body = await readJson(request);
      if (!body || typeof body.state !== 'object' || body.state === null) return json({ error: '저장할 내용이 없어요.' }, 400);
      const doc = (await store.get('doc')) || { state: null, updatedAt: 0 };
      // Another device saved since this one loaded: send the newer copy back to be merged.
      if (Number(body.baseUpdatedAt || 0) !== Number(doc.updatedAt || 0)) return json({ error: 'conflict', state: doc.state, updatedAt: doc.updatedAt }, 409);
      const size = JSON.stringify(body.state).length;
      if (size > MAX_DOC) return json({ error: '저장할 내용이 너무 커요.' }, 413);
      const updatedAt = Math.max(now, Number(doc.updatedAt || 0) + 1);
      await store.put('doc', { state: body.state, updatedAt });
      return json({ updatedAt });
    }
    if (path === '/api/planner/import' && method === 'POST') {
      const body = await readJson(request);
      if (!body || typeof body.state !== 'object' || body.state === null) return json({ error: '백업 파일을 확인해 주세요.' }, 400);
      const doc = (await store.get('doc')) || { state: null, updatedAt: 0 };
      // The replaced document is kept (the last 5), never thrown away.
      if (doc.state) {
        const old = (await store.get('previous')) || [];
        await store.put('previous', [...old, { state: doc.state, updatedAt: doc.updatedAt, replacedAt: now }].slice(-5));
      }
      const updatedAt = Math.max(now, Number(doc.updatedAt || 0) + 1);
      await store.put('doc', { state: body.state, updatedAt });
      return json({ updatedAt });
    }
    return json({ error: '찾을 수 없어요.' }, 404);
  } catch (err) {
    return json({ error: '서버 오류가 났어요. 잠시 후 다시 시도해 주세요.' }, 500);
  }
}

async function readJson(request) { try { return await request.json(); } catch { return null; } }

async function auth(request, store, now, method) {
  const pin = await store.get('pin');
  if (method === 'GET') return json({ configured: !!pin, authenticated: await signedIn(request, store, now) });
  if (method === 'DELETE') {
    const token = cookieOf(request);
    if (token) {
      const sessions = (await store.get('sessions')) || {};
      delete sessions[await sha256(token)];
      await store.put('sessions', sessions);
    }
    return json({ ok: true }, 200, { 'Set-Cookie': setCookie('', 0) });
  }
  if (method === 'PATCH') {
    if (!pin || !(await signedIn(request, store, now))) return json({ error: '로그인이 필요해요.' }, 401);
    const body = await readJson(request);
    const next = String(body?.newPin ?? '');
    if ((await pinHash(String(body?.currentPin ?? ''), pin.salt)) !== pin.hash) return json({ error: '현재 PIN이 맞지 않아요.' }, 400);
    if (!/^\d{4,8}$/.test(next)) return json({ error: '새 PIN은 숫자 4~8자리예요.' }, 400);
    const salt = randomHex(16);
    await store.put('pin', { salt, hash: await pinHash(next, salt) });
    await store.put('sessions', {});
    return json({ ok: true }, 200, { 'Set-Cookie': setCookie('', 0) });
  }
  if (method !== 'POST') return json({ error: '찾을 수 없어요.' }, 404);
  const body = await readJson(request);
  const value = String(body?.pin ?? '');
  if (!/^\d{4,8}$/.test(value)) return json({ error: 'PIN은 숫자 4~8자리예요.' }, 400);
  if (!pin) {
    // First visit: the PIN is created here.
    const salt = randomHex(16);
    await store.put('pin', { salt, hash: await pinHash(value, salt) });
  } else {
    const lock = (await store.get('lock')) || { fails: 0, until: 0 };
    if (lock.until > now) return json({ error: `PIN을 여러 번 틀렸어요. ${Math.ceil((lock.until - now) / 60000)}분 뒤에 다시 시도해 주세요.` }, 429);
    if ((await pinHash(value, pin.salt)) !== pin.hash) {
      const fails = lock.fails + 1;
      await store.put('lock', fails >= LOCK_AFTER ? { fails: 0, until: now + LOCK_MS } : { fails, until: 0 });
      return json({ error: 'PIN이 맞지 않아요.' }, 401);
    }
    await store.put('lock', { fails: 0, until: 0 });
  }
  const token = randomHex(32);
  const sessions = (await store.get('sessions')) || {};
  for (const [k, s] of Object.entries(sessions)) if (s.expires <= now) delete sessions[k];
  sessions[await sha256(token)] = { created: now, expires: now + SESSION_MS };
  await store.put('sessions', sessions);
  return json({ ok: true, created: !pin }, 200, { 'Set-Cookie': setCookie(token, SESSION_MS / 1000) });
}
