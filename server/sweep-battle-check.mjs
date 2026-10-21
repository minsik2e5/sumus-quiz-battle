// V13.168 야차전(대결 · 로보 · 몬스터 · 리그 · 대회) 버그 점검에서 재현한 것을 고친 뒤의 검사.
// 시각에 기대지 않는다: 대결 기록은 지금 시각 바로 앞에 끝난 것으로 만든다(설욕전은 끝나고 2분 안).
import { emptyState } from './state.mjs';
import { passwordHash } from './auth.mjs';
import { service } from './service.mjs';

const DAY_MS = 86400000;

export async function runSweepBattleChecks(assert, expectStatus) {
  const now = Date.now();
  const state = emptyState();
  const hash = await passwordHash('QaSweepBattle1!');
  const student = (id, name) => ({ id, username: id, display_name: name, role: 'student', active: true, class_name: '고1A', school_id: 'danwon-high', school: '단원고', division: 'high', password_hash: hash, pets: [{ key: 'dog', first: true, acquired_at: now - 9 * DAY_MS }], avatar_key: 'dog', created_at: now - 9 * DAY_MS });
  state.profiles.push(student('qa-swb-a', '가람'), student('qa-swb-b', '나래'));
  for (const p of state.profiles) state.sessions.push({ id: 'qa-swb-coins-' + p.id, student_id: p.id, division: 'high', school_id: 'danwon-high', school: '단원고', total: 20, correct: 18, answered_count: 20, xp: 100, reward_points: 400, created_at: now - DAY_MS });
  const tokens = {};
  for (const p of state.profiles) tokens[p.id] = (await service(state, 'POST', '/login', { username: p.username, password: 'QaSweepBattle1!', division: 'high' }, null))._cookie;
  const finished = (id, extra = {}) => ({ id, code: String(100000 + state.battles.length), status: 'finished', school_id: 'danwon-high', division: 'high', grade: '고1', host_id: 'qa-swb-a', guest_id: 'qa-swb-b', winner: 'qa-swb-a', loser: 'qa-swb-b', reason: 'end', hp: {}, max_hp: 250, range_codes: ['24'], guest_range_codes: ['24'], mode: 'speed', range_mode: 'same', created_at: now - 4 * 60000, joined_at: now - 3 * 60000, finished_at: now - 20000, ...extra });

  /* ---------- 대회 경기의 설욕전 ---------- */
  // 대회 경기(판돈 0)에 설욕전을 신청하면 판돈 0인 일반 대결 방이 열렸다(BATTLE_STAKES에 없는 판돈, 리그 승점도 쌓임).
  state.battles = [finished('qa-swb-tn', { stake: 0, tournament_id: 'qa-swb-t', match_id: 'r0m0', label: '대회 결승', challenge: true, invite_id: 'qa-swb-b' })];
  await expectStatus(409, () => service(state, 'POST', '/battle/rematch', { battle_id: 'qa-swb-tn' }, tokens['qa-swb-b']), 'V13.168 대회 경기는 설욕전을 신청할 수 없다(판돈 0인 일반 대결이 생기지 않는다)');
  assert(state.battles.length === 1, 'V13.168 대회 경기 설욕전 신청은 방을 만들지 않는다');
  // 일반 대결의 설욕전은 그대로 된다.
  state.battles.push(finished('qa-swb-plain', { stake: 10 }));
  const rematch = await service(state, 'POST', '/battle/rematch', { battle_id: 'qa-swb-plain' }, tokens['qa-swb-b']);
  assert(rematch.rematch === true && rematch.stake === 10 && state.battles.some(b => b.rematch_of === 'qa-swb-plain' && b.status === 'waiting' && b.stake === 10), 'V13.168 일반 대결의 설욕전은 같은 판돈으로 그대로 열린다');
}
