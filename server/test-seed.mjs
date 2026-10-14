import { emptyState, migrateState } from './state.mjs';
import { passwordHash } from './auth.mjs';

// V13.149 테스트 앱(sumus-voca-test, wrangler.jsonc env.test)의 처음 데이터. 운영 Supabase와 운영 데이터는 쓰지 않는다.
// 처음 켤 때 한 번만 만들고, 그 뒤에는 테스트 앱의 Durable Object 안에만 저장된다.
// 계정은 연습용이라 비밀번호가 공개돼 있다(진짜 학생 정보는 넣지 않는다).
export const TEST_APP = {
  WORKER: 'sumus-voca-test',
  URL: 'https://sumus-voca-test.minsik2e5.workers.dev',
  PASSWORD: 'test1234',
  TEACHER: 'tteacher',
  STUDENTS: [
    ['ts1', '가온', 'dog'], ['ts2', '나래', 'cat'], ['ts3', '다온', 'fox'],
    ['ts4', '라온', 'rabbit'], ['ts5', '마루', 'bear'], ['ts6', '바다', 'penguin']
  ]
};

export async function testSeedState(now = Date.now()) {
  const DAY = 86400000, state = emptyState();
  migrateState(state);
  const hash = await passwordHash(TEST_APP.PASSWORD);
  const school = state.schools.find(s => s.id === 'danwon-high');
  const born = now - 30 * DAY;
  state.profiles.push({ id: 'test-teacher', username: TEST_APP.TEACHER, password_hash: hash, display_name: '테스트 선생님', role: 'teacher', active: true, school_ids: [school.id], division_ids: ['high'], active_division: 'high', active_school_id: school.id, created_at: born });
  TEST_APP.STUDENTS.forEach(([username, name, pet], i) => state.profiles.push({
    id: `test-s${i + 1}`, username, password_hash: hash, display_name: name, role: 'student', active: true,
    class_name: '고1A', school_id: school.id, school: school.name, division: 'high', created_at: born,
    pets: [{ key: pet, first: true, acquired_at: born }], avatar_key: pet, avatar_key_set: true,
    // 낚시를 바로 해 볼 수 있게 미끼 · 진주 · 어망을 조금 넣어 둔다.
    reel: { bait: 5, pearls: i === 0 ? 5000 : 300, net: i === 0 ? { tuna: 1, carp: 3, minnow: 5 } : {} },
    // 가온은 보호권 1장을 들고 있다.
    streak_guard: i === 0 ? { log: [{ at: now - 9 * DAY, src: 'buy' }] } : undefined
  }));
  // 가온: 8일 연속 공부하다 어제 빠짐(보호권이 지킴). 나래: 5일 연속 후 어제 빠짐(되살리기 제안). 나머지는 며칠씩.
  const days = { 'test-s1': [9, 8, 7, 6, 5, 4, 3, 2], 'test-s2': [6, 5, 4, 3, 2], 'test-s3': [3, 1], 'test-s4': [2, 1], 'test-s5': [1], 'test-s6': [] };
  for (const [sid, list] of Object.entries(days)) for (const d of list) state.sessions.push({
    id: `test-${sid}-${d}`, student_id: sid, created_at: now - d * DAY, total: 20, correct: 18, answered_count: 20, xp: 120, reward_points: 60,
    range_codes: ['24'], mode: 'eng2mean', score: 90, division: 'high', school_id: school.id, school: school.name, grade: '고1A'
  });
  return state;
}
