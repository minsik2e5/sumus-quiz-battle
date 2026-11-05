// Runs supabase/voca_v13_parts.sql in PGlite (real Postgres, in-process) and checks it:
// wrong secret refused, revision conflicts, upsert/removal, anon limited to the RPCs.
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';

const SECRET = 'local-test';
const sql = readFileSync(new URL('../supabase/voca_v13_parts.sql', import.meta.url), 'utf8').replace('81336e5a06fcd1381eb4e828715636773142660f792073648a5fb2e81f410e53', createHash('sha256').update(SECRET).digest('hex'));
const db = new PGlite({ extensions: { pgcrypto } });
await db.exec(`create schema if not exists extensions; create role anon nologin; create role authenticated nologin;`);
await db.exec(sql);
await db.exec(sql); // running it twice must be safe
const code = async fn => { try { await fn(); return 'ok'; } catch (e) { return e.code; } };

assert.equal(await code(() => db.query(`select public.voca_v13_state_revision($1)`, ['wrong'])), '42501', 'wrong secret is refused');
let rev = (await db.query(`select public.voca_v13_state_revision($1) r`, [SECRET])).rows[0].r;
assert.equal(Number(rev), 0);
rev = (await db.query(`select public.voca_v13_state_patch($1, $2, $3::jsonb, $4::jsonb) r`, [SECRET, 0, JSON.stringify({ 'k:profiles': [{ id: 'a' }], 'a:sessions:s1': [{ id: 1 }] }), '[]'])).rows[0].r;
assert.equal(Number(rev), 1, 'patch bumps the revision');
assert.equal(await code(() => db.query(`select public.voca_v13_state_patch($1, $2, $3::jsonb, $4::jsonb)`, [SECRET, 0, '{}', '[]'])), '40001', 'stale revision is a conflict');
rev = (await db.query(`select public.voca_v13_state_patch($1, $2, $3::jsonb, $4::jsonb) r`, [SECRET, 1, JSON.stringify({ 'a:sessions:s1': [{ id: 1 }, { id: 2 }] }), JSON.stringify(['k:profiles'])])).rows[0].r;
const read = (await db.query(`select * from public.voca_v13_state_read($1)`, [SECRET])).rows[0];
assert.equal(Number(read.revision), 2);
assert.deepEqual(read.parts, { 'a:sessions:s1': [{ id: 1 }, { id: 2 }] }, 'upsert and removal apply');
const big = { 'k:big': Array.from({ length: 20000 }, (_, i) => ({ i, text: '한글 텍스트 ' + i })) };
rev = (await db.query(`select public.voca_v13_state_patch($1, $2, $3::jsonb, '[]'::jsonb) r`, [SECRET, 2, JSON.stringify(big)])).rows[0].r;
assert.equal(Number(rev), 3, 'a large part is stored');

await db.exec(`set role anon`);
assert.equal(await code(() => db.query(`select * from public.voca_v13_parts`)), '42501', 'anon cannot read the table directly');
assert.equal(await code(() => db.query(`select public.voca_v13_check_secret($1)`, [SECRET])), '42501', 'anon cannot call the secret check directly');
assert.equal(Number((await db.query(`select public.voca_v13_state_revision($1) r`, [SECRET])).rows[0].r), 3, 'anon can call the RPCs with the secret');
await db.exec(`reset role`);
console.log('[sql-check] PASS supabase/voca_v13_parts.sql (PGlite)');

// V13.219 새 프로젝트로 옮길 때 쓰는 통째 사본(v12). 워커가 부르는 모양 그대로인지, 빈 사본을 백업으로 읽히지 않는지 본다.
const v12 = readFileSync(new URL('../supabase/voca_v12_state.sql', import.meta.url), 'utf8');
assert(!v12.includes('81336e5a06'), 'v12 SQL은 비밀값 지문을 따로 적지 않고 v13 확인 함수를 쓴다');
await db.exec(v12);
await db.exec(v12); // 두 번 실행해도 안전
assert.equal((await db.query(`select * from public.voca_v12_state_read($1)`, [SECRET])).rows.length, 0, 'V13.219 아직 올린 적 없으면 아무것도 돌려주지 않는다(빈 사본으로 학생 기록을 덮지 않게)');
assert.equal(await code(() => db.query(`select public.voca_v12_state_read($1)`, ['wrong'])), '42501', 'V13.219 v12 read도 비밀값을 본다');
assert.equal(await code(() => db.query(`select public.voca_v12_state_commit($1, $2, $3::jsonb)`, ['wrong', 0, '{}'])), '42501', 'V13.219 v12 commit도 비밀값을 본다');
const state1 = { profiles: [{ id: 'a', name: '학생' }] };
let r12 = (await db.query(`select public.voca_v12_state_commit($1, $2, $3::jsonb) r`, [SECRET, 4321, JSON.stringify(state1)])).rows[0].r;
assert.equal(Number(r12), 1, 'V13.219 첫 commit은 옛 프로젝트 번호를 들고 와도 받아서 1이 된다');
assert.equal(await code(() => db.query(`select public.voca_v12_state_commit($1, $2, $3::jsonb)`, [SECRET, 4321, '{}'])), '40001', 'V13.219 그다음부터는 번호가 어긋나면 충돌(워커가 번호를 다시 읽고 올린다)');
assert.equal(await code(() => db.query(`select public.voca_v12_state_commit($1, $2, $3::jsonb)`, [SECRET, 1, '[]'])), '22023', 'V13.219 상태가 아닌 값은 받지 않는다');
r12 = (await db.query(`select public.voca_v12_state_commit($1, $2, $3::jsonb) r`, [SECRET, 1, JSON.stringify({ ...state1, n: 2 })])).rows[0].r;
assert.equal(Number(r12), 2);
await db.exec(`set role anon`);
const row12 = (await db.query(`select * from public.voca_v12_state_read($1)`, [SECRET])).rows[0];
assert(Number(row12.revision) === 2 && row12.data.n === 2, 'V13.219 anon은 함수로 읽는다(워커 load가 기대하는 {revision, data})');
assert.equal(await code(() => db.query(`select * from public.voca_v12_state`)), '42501', 'V13.219 anon은 표를 직접 못 읽는다');
await db.exec(`reset role`);
const timeouts = (await db.query(`select r.rolname, s.setconfig from pg_db_role_setting s join pg_roles r on r.oid = s.setrole where r.rolname in ('anon', 'authenticated')`)).rows;
assert(timeouts.length === 2 && timeouts.every(t => t.setconfig.includes('statement_timeout=120s')), 'V13.219 13MB 통째 사본이 시간 제한(57014)에 끊기지 않게 2분');
console.log('[sql-check] PASS supabase/voca_v12_state.sql (PGlite)');
