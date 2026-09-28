// Seeds the LOCAL development database (var/sumus.sqlite) with two test students for
// checking pet moments. Never point this at a real database.
// Credentials are written to var/local-test-login.txt (gitignored).
import { randomBytes, randomUUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

for (const key of ['SUPABASE_URL', 'STATE_BRIDGE_URL', 'DATA_PATH']) if (process.env[key]) throw new Error(`${key} is set; refusing to seed`);
const root = new URL('../../', import.meta.url);
const { migrateState, repository } = await import(new URL('server/repository.mjs', root));
const { passwordHash } = await import(new URL('server/auth.mjs', root));
const repo = await repository(fileURLToPath(new URL('var/sumus.sqlite', root)));
const { state, revision } = await repo.read();
migrateState(state);
const password = 'Local-' + randomBytes(6).toString('hex');
const school = state.schools.find(s => s.id === 'danwon-high') || state.schools[0];
const students = [['qa_hatch', '부화 테스트', 'fox', 500], ['qa_evolve', '진화 테스트', 'dragon', 4300]];
for (const [username, name, pet, xp] of students) {
  let p = state.profiles.find(x => x.username === username);
  if (!p) {
    p = { id: randomUUID(), username, display_name: name, class_name: '고1A', role: 'student', active: true, school_id: school.id, school: school.name, division: school.division || 'high', created_at: Date.now() };
    state.profiles.push(p);
  }
  Object.assign(p, { password_hash: await passwordHash(password), avatar_key: pet, avatar_accessory: 'none', avatar_frame: 'basic', avatar_title: 'rookie' });
  // Behave like a student from before collectible pets: no pets yet, nothing spent.
  delete p.pets; delete p.points_spent; delete p.purchases; delete p.pet_name;
  state.sessions = (state.sessions || []).filter(s => s.student_id !== p.id);
  state.sessions.push({ id: randomUUID(), student_id: p.id, division: p.division, school_id: p.school_id, school: p.school, class_name: p.class_name, mode: 'eng2mean', run_mode: 'practice', total: 20, correct: 20, score: 100, xp, reward_points: xp > 1000 ? 1000 : 60, duration_sec: 300, range_codes: [], created_at: Date.now() - 3600000 });
}
await repo.commit(state, revision);
repo.close?.();
writeFileSync(fileURLToPath(new URL('var/local-test-login.txt', root)), `local test students (password for both): ${password}\n${students.map(s => s[0]).join('\n')}\n`);
console.log('seeded', students.map(s => s[0]).join(', '), '→ var/local-test-login.txt');
