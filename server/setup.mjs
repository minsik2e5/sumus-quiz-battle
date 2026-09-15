import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { migrateState, repository } from './repository.mjs';
import { passwordHash } from './auth.mjs';
const repo = await repository(process.env.DATA_PATH || fileURLToPath(new URL('../var/sumus.sqlite', import.meta.url)));
const { state, revision } = await repo.read();
const migrated = migrateState(state);
if (state.profiles.some(p => p.role === 'teacher')) { if (migrated) await repo.commit(state, revision); console.log('교사 계정이 준비되어 있습니다.'); repo.close(); process.exit(0); }
const rl = createInterface({ input: stdin, output: stdout });
const username = (await rl.question('교사 아이디 [teacher]: ')).trim() || 'teacher';
const password = process.env.ADMIN_PASSWORD || await rl.question('교사 비밀번호 (12자 이상): ');
rl.close();
if (!/^[a-z0-9_.-]{3,40}$/.test(username) || password.length < 12) { console.error('아이디는 영문·숫자 3~40자, 비밀번호는 12자 이상 필요합니다.'); repo.close(); process.exit(1); }
state.profiles.push({ id: randomUUID(), username, password_hash: await passwordHash(password), display_name: 'SUMUS 선생님', class_name: '고1A', role: 'teacher', active: true, school_ids: state.schools.filter(s => s.active !== false).map(s => s.id), active_school_id: state.schools[0].id });
await repo.commit(state, revision); repo.close(); console.log('준비되었습니다. npm start 로 실행하세요.');
