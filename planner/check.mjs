// Checks for the planner (server API, merge, planner rules). Run: node planner/check.mjs
import { handleApi } from './server.mjs';
import { merge3 } from './public/sync.js';
import { runCoreChecks } from './core-check.mjs';

let n = 0;
const assert = (ok, label) => { n++; if (!ok) { console.error('[planner-check] FAIL · ' + label); process.exit(1); } };
const mem = () => { const m = new Map(); return { get: async k => m.get(k), put: async (k, v) => { m.set(k, JSON.parse(JSON.stringify(v))); }, delete: async k => m.delete(k) }; };
const call = async (store, method, path, body, cookie, now = 1_000_000) => {
  const res = await handleApi(new Request('https://p.test' + path, { method, headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) }, body: body ? JSON.stringify(body) : undefined }), store, now);
  return { status: res.status, body: await res.json(), cookie: (res.headers.get('Set-Cookie') || '').split(';')[0] };
};

const s = mem();
assert((await call(s, 'GET', '/api/auth')).body.configured === false, 'no PIN at first');
assert((await call(s, 'GET', '/api/planner')).status === 401, 'data needs a sign-in');
assert((await call(s, 'POST', '/api/auth', { pin: '12a4' })).status === 400, 'PIN must be digits');
const made = await call(s, 'POST', '/api/auth', { pin: '482915' });
assert(made.status === 200 && made.body.created === true && made.cookie.startsWith('sp_session='), 'first visit creates the PIN and signs in');
const c = made.cookie;
assert((await call(s, 'GET', '/api/auth', null, c)).body.authenticated === true, 'the cookie signs in');
assert((await call(s, 'POST', '/api/auth', { pin: '000000' })).status === 401, 'a wrong PIN is refused');
for (let i = 0; i < 4; i++) await call(s, 'POST', '/api/auth', { pin: '000000' });
assert((await call(s, 'POST', '/api/auth', { pin: '482915' })).status === 429, 'five wrong PINs lock for a while');
assert((await call(s, 'POST', '/api/auth', { pin: '482915' }, null, 1_000_000 + 6 * 60000)).status === 200, 'the lock ends after 5 minutes');

const first = await call(s, 'PUT', '/api/planner', { state: { a: 1 }, baseUpdatedAt: 0 }, c);
assert(first.status === 200 && first.body.updatedAt > 0, 'first save');
const stale = await call(s, 'PUT', '/api/planner', { state: { a: 2 }, baseUpdatedAt: 0 }, c);
assert(stale.status === 409 && stale.body.state.a === 1 && stale.body.updatedAt === first.body.updatedAt, 'a save from an old copy gets 409 with the newer copy');
const second = await call(s, 'PUT', '/api/planner', { state: { a: 3 }, baseUpdatedAt: first.body.updatedAt }, c, 1_000_000);
assert(second.status === 200 && second.body.updatedAt > first.body.updatedAt, 'updatedAt always moves forward');
assert((await call(s, 'GET', '/api/widget', null, c)).body.state.a === 3, 'the widget reads the same document');
const imp = await call(s, 'POST', '/api/planner/import', { state: { a: 9 } }, c);
assert(imp.status === 200 && (await s.get('previous')).at(-1).state.a === 3, 'an imported backup keeps the replaced document');
await call(s, 'DELETE', '/api/auth', null, c);
assert((await call(s, 'GET', '/api/planner', null, c)).status === 401, 'signing out ends the session');

// three-way merge
const base = { checks: { a: true }, memo: 'x', list: [1] };
const mine = { checks: { a: true, b: true }, memo: 'x', list: [1, 2] };
const theirs = { checks: { a: false }, memo: 'y', list: [1] };
const m = merge3(base, mine, theirs);
assert(m.checks.a === false && m.checks.b === true && m.memo === 'y' && m.list.length === 2, 'merge keeps both sides\' changes');
assert(!('k' in merge3({ k: 1 }, {}, { k: 1 })), 'a key I removed stays removed');

n += await runCoreChecks(assert);
console.log(`[planner-check] PASS ${n}`);
