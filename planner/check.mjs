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

// automatic daily copies: the first save of each day keeps the document as it was just before
const DAY = 86_400_000, t0 = Date.parse('2026-10-20T03:00:00Z');
const bs = mem(); const bc = (await call(bs, 'POST', '/api/auth', { pin: '482915' }, null, t0)).cookie;
let up = (await call(bs, 'PUT', '/api/planner', { state: { v: 'day0' }, baseUpdatedAt: 0 }, bc, t0)).body.updatedAt;
assert((await call(bs, 'GET', '/api/planner/backups', null, bc, t0)).body.backups.length === 0, 'nothing to copy on the very first save');
up = (await call(bs, 'PUT', '/api/planner', { state: { v: 'day0b' }, baseUpdatedAt: up }, bc, t0 + 1000)).body.updatedAt;
assert((await call(bs, 'GET', '/api/planner/backups', null, bc, t0)).body.backups.length === 1, 'the first save of a day makes one copy');
up = (await call(bs, 'PUT', '/api/planner', { state: { v: 'day0c' }, baseUpdatedAt: up }, bc, t0 + 2000)).body.updatedAt;
assert((await call(bs, 'GET', '/api/planner/backups', null, bc, t0)).body.backups.length === 1, 'later saves the same day make no more');
for (let d = 1; d <= 35; d++) up = (await call(bs, 'PUT', '/api/planner', { state: { v: 'day' + d }, baseUpdatedAt: up }, bc, t0 + d * DAY)).body.updatedAt;
const list = (await call(bs, 'GET', '/api/planner/backups', null, bc, t0 + 35 * DAY)).body.backups;
assert(list.length === 30 && list[0].date === '2026-11-24' && list[0].bytes > 0 && !(await bs.get('snap:2026-10-20')), 'only the last 30 days are kept, newest first, older ones are deleted');
const one = await call(bs, 'GET', '/api/planner/backups/' + list[2].date, null, bc, t0);
assert(one.status === 200 && one.body.state.v === 'day32' && (await call(bs, 'GET', '/api/planner/backups/2020-01-01', null, bc, t0)).status === 404, 'one copy can be read, an unknown day is 404');
const back = await call(bs, 'POST', '/api/planner/restore', { date: list[2].date }, bc, t0 + 36 * DAY);
assert(back.status === 200 && (await call(bs, 'GET', '/api/planner', null, bc, t0)).body.state.v === 'day32' && (await bs.get('previous')).at(-1).state.v === 'day35', 'restoring puts the day back and keeps what it replaced');
assert((await call(bs, 'POST', '/api/planner/restore', { date: '../x' }, bc, t0)).status === 404 && (await call(bs, 'GET', '/api/planner/backups', null)).status === 401, 'bad dates are refused and backups need a sign-in');

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
