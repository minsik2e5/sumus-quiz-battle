import { emptyState, migrateState } from './state.mjs';
import { passwordHash } from './auth.mjs';
import { LEGENDARY_PET_KEYS, MYTHIC_PET_KEYS, STANDARD_PET_KEYS } from '../public/modules/core.js';

// V13.149 테스트 앱(sumus-voca-test, wrangler.jsonc env.test)의 처음 데이터. 운영 Supabase와 운영 데이터는 쓰지 않는다.
// 처음 켤 때 한 번만 만들고, 그 뒤에는 테스트 앱의 Durable Object 안에만 저장된다.
// 계정은 연습용이라 비밀번호가 공개돼 있다(진짜 학생 정보는 넣지 않는다).
export const TEST_APP = {
  WORKER: 'sumus-voca-test',
  URL: 'https://sumus-voca-test.minsik2e5.workers.dev',
  PASSWORD: 'test1234',
  TEACHER: 'tteacher',
  // 판이 바뀔 때마다 SEED를 올린다: 이미 켜진 테스트 앱에도 시작할 때 한 번 덧붙인다(applyTestSeed).
  SEED: 6,
  TEACHERS: [['tteacher', '테스트 선생님'], ['tteacher2', '테스트 선생님 2']],
  BAIT: 10,
  // V13.162 판 3 · 4(손맛 고퀄 뒤 다시 채움): 펫 사냥을 바로 해 볼 수 있게 공(기본 · 좋은 · 황금)과 지도에 새 친구 '?' 하나.
  HUNT: { basic: 6, good: 3, gold: 1 },
  // 테스트 선물: 이름표마다 한 번만 넣는다(판 번호와 따로라 다른 판과 겹치지 않는다). 곤충 · 공룡 시리즈 12종을 나래(ts2)에게.
  GIFTS: { 'bugdino-ts2': { ts2: ['ladybug', 'bee', 'ant', 'firefly', 'rhinobeetle', 'butterfly', 'tricera', 'stego', 'brachio', 'ptera', 'ankylo', 'tyranno'] } },
  // V13.180 판 6: 인형뽑기를 바로 해 볼 수 있게 집게권(보관 상한까지).
  CLAW: 6,
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
  TEST_APP.STUDENTS.forEach(([username, name, pet], i) => state.profiles.push({
    id: `test-s${i + 1}`, username, password_hash: hash, display_name: name, role: 'student', active: true,
    class_name: '고1A', school_id: school.id, school: school.name, division: 'high', created_at: born,
    pets: [{ key: pet, first: true, acquired_at: born }], avatar_key: pet, avatar_key_set: true,
    // 낚시를 바로 해 볼 수 있게 미끼 · 진주 · 어망을 조금 넣어 둔다.
    reel: { bait: 0, pearls: i === 0 ? 5000 : 300, net: i === 0 ? { tuna: 1, carp: 3, minnow: 5 } : {} },
    // 가온은 보호권 1장을 들고 있다.
    streak_guard: i === 0 ? { log: [{ at: now - 9 * DAY, src: 'buy' }] } : undefined
  }));
  // 가온: 8일 연속 공부하다 어제 빠짐(보호권이 지킴). 나래: 5일 연속 후 어제 빠짐(되살리기 제안). 나머지는 며칠씩.
  const days = { 'test-s1': [9, 8, 7, 6, 5, 4, 3, 2], 'test-s2': [6, 5, 4, 3, 2], 'test-s3': [3, 1], 'test-s4': [2, 1], 'test-s5': [1], 'test-s6': [] };
  for (const [sid, list] of Object.entries(days)) for (const d of list) state.sessions.push({
    id: `test-${sid}-${d}`, student_id: sid, created_at: now - d * DAY, total: 20, correct: 18, answered_count: 20, xp: 120, reward_points: 60,
    range_codes: ['24'], mode: 'eng2mean', score: 90, division: 'high', school_id: school.id, school: school.name, grade: '고1A'
  });
  await applyTestSeed(state, now, hash);
  return state;
}

// 판 2: 선생님 계정 하나 더 · 학생 모두 전설 · 신화 펫 · 미끼 10개. 이미 쓰던 테스트 데이터는 그대로 두고 덧붙인다.
// 바꿨으면 true(시작 저장). 테스트 앱(VOCA_STANDALONE)에서만 부른다.
export async function applyTestSeed(state, now = Date.now(), hash = null) {
  const gifted = giftTestPets(state, now);
  if (Number(state.test_seed || 0) >= TEST_APP.SEED) return gifted;
  hash ||= await passwordHash(TEST_APP.PASSWORD);
  const school = state.schools.find(s => s.id === 'danwon-high');
  TEST_APP.TEACHERS.forEach(([username, name], i) => {
    if (state.profiles.some(p => p.username === username)) return;
    state.profiles.push({ id: i ? `test-teacher${i + 1}` : 'test-teacher', username, password_hash: hash, display_name: name, role: 'teacher', active: true, school_ids: [school.id], division_ids: ['high'], active_division: 'high', active_school_id: school.id, created_at: now });
  });
  const special = [...LEGENDARY_PET_KEYS, ...MYTHIC_PET_KEYS];
  for (const [username] of TEST_APP.STUDENTS) {
    const p = state.profiles.find(x => x.username === username && x.role === 'student');
    if (!p) continue;
    p.pets ||= [];
    for (const key of special) if (!p.pets.some(pet => pet.key === key)) p.pets.push({ key, acquired_at: now });
    p.reel ||= {};
    p.reel.bait = Math.max(Number(p.reel.bait || 0), TEST_APP.BAIT);
    const h = p.hunt ||= {};
    for (const [k, n] of Object.entries(TEST_APP.HUNT)) h[k] = Math.max(Number(h[k] || 0), n);
    const fresh = STANDARD_PET_KEYS.find(k => !p.pets.some(pet => pet.key === k));
    h.map ||= { slot: null, spots: [] };
    const c = p.claw ||= {};
    c.t = Math.max(Number(c.t || 0), TEST_APP.CLAW);
    if (fresh && !h.map.spots.some(s => s.kind === 'pet')) h.map.spots.push({ id: `seed-${username}`, kind: 'pet', key: fresh, tier: 'pet', form: 1, x: 50, y: 44, cell: 4 });
  }
  state.test_seed = TEST_APP.SEED;
  return true;
}

// 테스트 선물(TEST_APP.GIFTS): 아직 안 넣은 이름표만 넣는다. 이미 가진 펫은 건너뛴다. 바꿨으면 true.
function giftTestPets(state, now) {
  const todo = Object.keys(TEST_APP.GIFTS).filter(tag => !(state.test_gifts || []).includes(tag));
  if (!todo.length) return false;
  for (const tag of todo) {
    for (const [username, keys] of Object.entries(TEST_APP.GIFTS[tag])) {
      const p = state.profiles.find(x => x.username === username && x.role === 'student');
      if (!p) continue;
      p.pets ||= [];
      for (const key of keys) if (!p.pets.some(pet => pet.key === key)) p.pets.push({ key, acquired_at: now });
    }
  }
  state.test_gifts = [...(state.test_gifts || []), ...todo];
  return true;
}
