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
