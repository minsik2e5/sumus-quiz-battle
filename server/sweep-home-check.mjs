// V13.168 버그 잡기(홈 · 나 + 놀이터): 첫 펫을 고르기 전에 받은 선생님 알 선물, 보호권 카드 문구.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { emptyState } from './state.mjs';
import { passwordHash } from './auth.mjs';
import { service } from './service.mjs';
import { giveGift, giftsWaiting, openGifts } from './rewards.mjs';

const DAY_MS = 86400000;
const source = path => readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8');

export async function runSweepHomeChecks(assert, expectStatus) {
  /* ---------- 첫 펫 전 알 선물 ---------- */
  // 전에는 첫 펫을 고르지 않은 학생이 알 선물을 열면 그 펫이 첫 펫 자리를 차지했다: /pets/choose가 막히고,
  // 그동안 쌓은 경험치(펫 표시 없는 학습 = 첫 펫 몫)는 어느 펫에게도 가지 않았고, 파트너가 없어 펫 교감도 막혔다.
  const fixedAt = Date.parse('2026-10-20T12:00:00+09:00');
  const lone = { id: 'sw-lone', pets: [] };
  giveGift(lone, { kind: 'coins', amount: 30, note: '', from: 't', fromName: 'T', now: fixedAt, id: 'g-coin' });
  giveGift(lone, { kind: 'egg', note: '', from: 't', fromName: 'T', now: fixedAt + 1, id: 'g-egg' });
  assert(giftsWaiting(lone).map(g => g.id).join() === 'g-coin', 'V13.168 a student with no pet yet does not see a teacher egg gift (only the coins)');
  const firstOpen = openGifts(lone, fixedAt + 2, () => 0.5);
  assert(firstOpen.length === 1 && firstOpen[0].id === 'g-coin' && !lone.pets.length && lone.gift_box.log.find(g => g.id === 'g-egg').opened === false && lone.gift_box.total === 30,
    'V13.168 opening gifts before the first pet opens the coins and keeps the egg closed (no pet is added)');
  lone.pets = [{ key: 'dog', first: true, acquired_at: fixedAt + 3 }];
  const later = openGifts(lone, fixedAt + 4, () => 0.5);
  assert(giftsWaiting(lone).length === 0 && later.length === 1 && later[0].kind === 'egg' && lone.pets.length === 2 && lone.pets[0].first && !lone.pets[1].first,
    'V13.168 after the first pet is chosen the waiting egg opens as a second pet');

  // The same through the app: the teacher sends an egg to a student who has not picked a pet.
  const state = emptyState();
  const hash = await passwordHash('QaSweepHome1!');
  const now = Date.now();
  state.profiles.push(
    { id: 'sw-home-t', username: 'sw_home_t', display_name: '홈 선생님', role: 'teacher', active: true, password_hash: hash, school_ids: ['danwon-high'], division_ids: ['high'], active_division: 'high', active_school_id: 'danwon-high', created_at: now - 9 * DAY_MS },
    { id: 'sw-home-a', username: 'sw-home-a', display_name: '새내기', role: 'student', active: true, class_name: '고1A', school_id: 'danwon-high', school: '단원고', division: 'high', password_hash: hash, avatar_key: 'lumi', created_at: now - 9 * DAY_MS }
  );
  state.sessions.push({ id: 'sw-home-s1', student_id: 'sw-home-a', division: 'high', school_id: 'danwon-high', mode: 'eng2mean', run_mode: 'practice', total: 20, correct: 18, answered_count: 20, xp: 300, reward_points: 0, created_at: now - 2 * DAY_MS });
  const login = async (username, role) => (await service(state, 'POST', '/login', { username, password: 'QaSweepHome1!', division: 'high', role }, null))._cookie;
  const teacher = await login('sw_home_t', 'teacher'), student = await login('sw-home-a');
  const kid = state.profiles.find(p => p.id === 'sw-home-a');
  await service(state, 'POST', '/teacher/gifts', { kind: 'egg', student_ids: ['sw-home-a'] }, teacher);
  const boot = await service(state, 'GET', '/bootstrap', {}, student);
  const opened = await service(state, 'POST', '/gifts/open', {}, student);
  assert(boot.gifts.length === 0 && opened.gifts.length === 0 && !(kid.pets || []).length, 'V13.168 the app shows no gift box for an egg sent before the first pet, and opening adds no pet');
  await service(state, 'POST', '/pets/choose', { key: 'dog' }, student);
  const chosen = await service(state, 'GET', '/bootstrap', {}, student);
  assert(chosen.stats.pets.length === 1 && chosen.stats.pets[0].key === 'dog' && chosen.stats.pets[0].xp === 300 && chosen.gifts.length === 1 && chosen.gifts[0].kind === 'egg',
    'V13.168 the student still picks the first pet (with the XP earned so far), then the teacher egg box appears');
  const hatched = await service(state, 'POST', '/gifts/open', {}, student);
  assert(hatched.gifts.length === 1 && hatched.gifts[0].egg?.key && kid.pets.length === 2 && kid.avatar_key === 'dog', 'V13.168 the egg then hatches into a second pet; the partner stays the first pet');
  const again = await service(state, 'POST', '/gifts/open', {}, student);
  assert(again.gifts.length === 0 && kid.pets.length === 2, 'V13.168 the egg cannot be opened twice');
  await expectStatus(409, () => service(state, 'POST', '/pets/choose', { key: 'cat' }, student), 'V13.168 the first pet is still chosen only once');

  /* ---------- 보호권 카드: 오늘 이미 공부했을 때 ---------- */
  const ui = source('../public/modules/streak-guard-ui.js');
  assert(ui.includes("import { STREAK_GUARD, dayNum } from './streak-guard.js'") && ui.includes('const studiedToday = A =>') && ui.includes('studiedToday(A) ? `오늘도 공부해서 ${num(days)}일 연속!` : `오늘 공부하면 ${num(days + 1)}일 연속!`'),
    'V13.168 the streak card after a guarded day says "오늘 공부하면 +1" only before today\'s study (after it the streak already counts today)');
}
