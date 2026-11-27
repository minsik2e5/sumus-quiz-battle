// V13.249 원일중 학년 올리기 검사: 반 '예비고1' + 선생님 "반 전체 학년 올리기"(중3 → 예비고1, 기말 뒤 중2 → 중3).
// - 반 목록: 원일중만 중2 · 중3 · 예비고1, 다른 학교는 그대로. 예비고1은 학년 묶음(야차전 · 순위 · 대회 · 교실 게임 · 학교 대항전 · 펫 대행진 반)이 따로.
// - 반 전체 옮기기: 미리보기(GET) 수 = 옮긴 수, 이 학교 · 이 반 학생만 바뀐다. 새 반에 학생이 있으면 막는다(순서가 꼬여 섞이지 않게).
// - 옮긴 뒤 펫 · 코인 · 경험치 · 레벨 · 연습 수 · 연습 기록 · 단어 기록 · 칭호(과 정복)가 그대로.
// - 옛 반(중3) 진행 중 시험 · 과제는 닫히고, 시험 중인 학생이 있으면 옮기지 않는다.
// - 예비고1은 중3 책이 안 보이고(책 0권), 학생 첫 화면이 깨지지 않는다. grade: '예비고1' 책을 더하면 바로 보인다.
// - 단원고 · 단원고2 · 선부고 · 강서고 학생 화면(책 · 범위 · 단어 id)은 그대로.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { emptyState, migrateState } from './state.mjs';
import { passwordHash } from './auth.mjs';
import { service, allBooks } from './service.mjs';
import { signupCodeRows } from './signup.mjs';
import { rankGrade, gradeOf, sameGradeBand } from './competition.mjs';
import { rankBand } from './arena-rank.mjs';
import { teamOf } from './school-league.mjs';
import { gradeExtraMs } from './dungeon-engine.mjs';
import { schoolClasses, schoolGrades, gradeTargets, schoolClassAllowed } from '../public/modules/school-classes.js';
import { READ_POSTS, VIEW_POSTS } from './mutation-coordinator.mjs';

const source = path => readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8');
// 다른 학교 학생 화면(V13.248.0과 같아야 한다): 학교, 반, 책 수, 범위 수, 단어 수.
const OTHERS = [['danwon-high', '고1A', 6, 27, 1273], ['danwon-high-2', '고2', 1, 15, 572], ['seonbu-high', '고1A', 5, 28, 1059], ['gangseo-high', '고1B', 6, 26, 1131]];

export async function runWonilPromoteChecks(assert, expectStatus) {
  /* ---------- 반 목록 · 학년 묶음 ---------- */
  const state = emptyState();
  const school = id => state.schools.find(s => s.id === id);
  const wonil = school('wonil-middle');
  assert(schoolClasses(wonil).join() === '중2,중3,예비고1' && wonil.division === 'middle' && wonil.name === '원일중', 'V13.249 원일중 반 목록은 중2 · 중3 · 예비고1(학교 원일중 · 중등부 그대로)');
  assert(schoolClasses(school('danwon-high')).join() === '고1A,고1B' && schoolClasses(school('danwon-high-2')).join() === '고2' && schoolClasses(school('seonbu-high')).join() === '고1A,고1B' && schoolClasses(school('gangseo-high')).join() === '고1A,고1B'
    && !schoolClassAllowed(school('danwon-high'), '예비고1') && schoolClasses({ id: 'other-middle', division: 'middle' }).join() === '중2,중3', 'V13.249 다른 학교(다른 중학교 기본 목록 포함) 반 목록은 그대로, 예비고1은 원일중에만');
  assert(schoolGrades(wonil).join() === '중2,중3,예비고1' && JSON.stringify(gradeTargets(wonil)) === '[["중2","중2"],["중3","중3"],["예비고1","예비고1"]]', 'V13.249 대회 · 교실 게임 대상에 예비고1이 한 학년으로 나온다');
  const m3 = { division: 'middle', class_name: '중3' }, pre = { division: 'middle', class_name: '예비고1' }, h1 = { division: 'high', class_name: '고1A' };
  assert(gradeOf('예비고1') === '예비고1' && gradeOf('중3') === '중3' && gradeOf('고1A') === '고1' && rankGrade(pre) === '예비고1' && rankGrade(m3) === '중3' && rankGrade(h1) === '고1',
    'V13.249 gradeOf · 순위 학년: 예비고1은 예비고1(중3 · 고1과 따로)');
  assert(sameGradeBand(pre, pre) && !sameGradeBand(pre, m3) && !sameGradeBand(pre, h1) && !sameGradeBand(pre, { division: 'high', class_name: '예비고1' }), 'V13.249 야차전 학년(다른 학교 대결 포함): 예비고1끼리만, 중3 · 고1과는 안 붙는다');
  assert(rankBand({ class_name: '예비고1' }, wonil) === 'wonil-middle|middle|예비고1' && rankBand({ class_name: '예비고1' }, wonil) !== rankBand({ class_name: '중3' }, wonil), 'V13.249 펫 아레나 랭크 묶음: 예비고1은 따로');
  const sOf = () => wonil;
  assert(teamOf(state, pre, sOf)?.name === '예비고1' && teamOf(state, pre, sOf).key !== teamOf(state, m3, sOf).key, 'V13.249 학교 대항전: 예비고1은 따로 한 팀');
  assert(gradeExtraMs('예비고1') === gradeExtraMs('고1') && gradeExtraMs('예비고1') < gradeExtraMs('중3'), 'V13.249 던전 생각 시간: 예비고1은 고1과 같다');
  const codes = signupCodeRows(state, state.schools);
  assert(codes.some(r => r.school_id === 'wonil-middle' && r.class_name === '예비고1') && !codes.some(r => r.school_id !== 'wonil-middle' && r.class_name === '예비고1'), 'V13.249 가입 코드 표에 원일중 예비고1 줄이 있다(다른 학교에는 없음)');

  /* ---------- 운영 state: 배포만으로는 아무도 옮겨지지 않는다 ---------- */
  const old = emptyState();
  old.profiles.push({ id: 'old-m3', role: 'student', username: 'old_m3', display_name: '옛중3', active: true, class_name: '중3', school_id: 'wonil-middle', school: '원일중', division: 'middle' });
  migrateState(old);
  assert(old.profiles.find(p => p.id === 'old-m3').class_name === '중3', 'V13.249 서버가 켜질 때(migrate) 중3 학생을 자동으로 옮기지 않는다(선생님 버튼으로만)');

  /* ---------- 학생들 ---------- */
  const hash = await passwordHash('QaWpPass1!');
  const NAMES = { 'danwon-high': '단원고', 'danwon-high-2': '단원고2', 'seonbu-high': '선부고', 'gangseo-high': '강서고', 'wonil-middle': '원일중' };
  const student = (id, schoolId, cls, extra = {}) => ({ id, username: id, display_name: id, role: 'student', active: true, class_name: cls, school_id: schoolId, school: NAMES[schoolId], division: schoolId.endsWith('middle') ? 'middle' : 'high', password_hash: hash, created_at: Date.now() - 86400000, pets: [{ key: 'dog', first: true, acquired_at: 1 }], avatar_key: 'dog', ...extra });
  state.profiles.push(
    { id: 'qa-wp-t', username: 'qa_wp_t', display_name: '원일중 선생님', role: 'teacher', active: true, password_hash: hash, school_ids: state.schools.map(s => s.id), division_ids: ['middle', 'high'], active_division: 'middle', active_school_id: 'wonil-middle' },
    student('qa-wp-a', 'wonil-middle', '중3', { pets: [{ key: 'dog', first: true, acquired_at: 1 }, { key: 'cat', acquired_at: 2 }], avatar_key: 'cat' }),
    student('qa-wp-b', 'wonil-middle', '중3'), student('qa-wp-c', 'wonil-middle', '중3', { active: false }),
    student('qa-wp-d', 'wonil-middle', '중2'), student('qa-wp-e', 'wonil-middle', '중2'),
    student('qa-wp-1a', 'danwon-high', '고1A'), student('qa-wp-2', 'danwon-high-2', '고2'), student('qa-wp-sb', 'seonbu-high', '고1A'), student('qa-wp-gs', 'gangseo-high', '고1B')
  );
  const runtime = allBooks({ extraBooks: [] });
  const g3 = runtime.filter(b => b.school_id === 'wonil-middle' && b.grade === '중3'), g2 = runtime.filter(b => b.school_id === 'wonil-middle' && b.grade === '중2');
  const code3 = String(g3[0].words[0].range_code), code2 = String(g2[0].words[0].range_code), word3 = g3[0].words[0];
  // 연습 기록(코인 · 경험치) · 단어 기록 · 과 정복(중3 한 과를 95% 이상으로 모두 풂)
  const now0 = Date.now();
  for (const p of state.profiles.filter(x => x.role === 'student')) state.sessions.push({ id: 'qa-wp-s-' + p.id, student_id: p.id, division: p.division, school_id: p.school_id, school: p.school, total: 20, correct: 18, answered_count: 20, xp: 120, reward_points: 700, created_at: now0 - 3600000, range_codes: [code3] });
  const lesson = g3[0].words.filter(w => String(w.range_code) === code3);
  state.mastery['qa-wp-a'] = Object.fromEntries(lesson.map(w => [w.id, { correct: 3, wrong: 0, streak: 3, recent_results: [{ ok: true, at: now0 - 7200000 }] }]));
  migrateState(state);
  const t = {};
  for (const p of state.profiles.filter(x => x.id.startsWith('qa-wp-') && x.active)) t[p.id] = (await service(state, 'POST', '/login', { username: p.username, password: 'QaWpPass1!', division: p.division || 'middle', role: p.role === 'teacher' ? 'teacher' : undefined }, null))._cookie;
  const boot = id => service(state, 'GET', '/bootstrap', {}, t[id]);
  const tt = t['qa-wp-t'];
  const ids = list => list.flatMap(b => b.words || []).map(w => w.id).sort().join();
  const beforeOthers = {};
  for (const [schoolId, cls] of OTHERS) { const who = state.profiles.find(p => p.school_id === schoolId && p.class_name === cls && p.id.startsWith('qa-wp-')).id; beforeOthers[who] = JSON.stringify((await boot(who)).books.map(b => b.id)) + ids((await boot(who)).books); }

  /* ---------- 옛 반 대상 시험 · 과제 ---------- */
  const now = Date.now();
  const examBody = (class_name, range_codes, title) => ({ title, class_name, school: '원일중', range_codes, exam_type: 'eng2mean_mc', question_count: 4, duration_sec: 300, passing_score: 70, max_attempts: 1, available_at: now - 1000, due_at: now + 3600000, release_result: true });
  const exam3 = await service(state, 'POST', '/exams', examBody('중3', [code3], 'QA 중3 시험'), tt);
  const exam2 = await service(state, 'POST', '/exams', examBody('중2', [code2], 'QA 중2 시험'), tt);
  const asg3 = await service(state, 'POST', '/assignments', { title: 'QA 중3 과제', class_name: '중3', school_id: 'wonil-middle', range_codes: [code3], target_questions: 20, due_at: now + 86400000 }, tt);
  assert((await boot('qa-wp-a')).exams.some(e => e.id === exam3.id) && (await boot('qa-wp-a')).assignments.some(a => a.id === asg3.id), 'V13.249 옮기기 전: 중3 학생에게 중3 시험 · 과제가 보인다');

  /* ---------- 미리보기 ---------- */
  const before = await boot('qa-wp-a');
  const keep = b => JSON.stringify({ pets: b.profile.pets, avatar: b.profile.avatar_key, coins: b.stats.points_balance, xp: b.stats.xp, level: b.stats.level, practices: b.stats.practice_count });
  const sessionsBefore = JSON.stringify(state.sessions.filter(x => x.student_id.startsWith('qa-wp-'))), masteryBefore = JSON.stringify(state.mastery['qa-wp-a']);
  const unitsBefore = Number(state.profiles.find(p => p.id === 'qa-wp-a').unit_best || 0);
  assert(before.books.length === g3.length && before.books.every(b => b.grade === '중3') && before.stats.points_balance > 0 && before.word_mastery.mastered >= 1, 'V13.249 옮기기 전: 중3 학생은 중3 책을 보고 코인 · 과 정복이 있다');
  await expectStatus(403, () => service(state, 'GET', '/teacher/class-move', { from: '중3', to: '예비고1' }, t['qa-wp-a']), 'V13.249 학생은 반 옮기기 미리보기를 못 본다');
  const view = await service(state, 'GET', '/teacher/class-move', { from: '중3', to: '예비고1' }, tt);
  assert(view.school_id === 'wonil-middle' && view.from === '중3' && view.to === '예비고1' && view.count === 3 && view.names.length === 3 && view.already === 0 && view.testing === 0
    && view.exams.map(e => e.id).join() === exam3.id && view.assignments.map(a => a.id).join() === asg3.id, 'V13.249 미리보기: 원일중 중3 3명(쉬는 학생 포함) → 예비고1, 닫힐 중3 시험 1 · 과제 1');
  assert(!READ_POSTS.has('/api/teacher/class-move') && !VIEW_POSTS.has('/api/teacher/class-move'), 'V13.249 미리보기는 GET(쓰지 않는다)');
  await expectStatus(400, () => service(state, 'GET', '/teacher/class-move', { from: '중3', to: '고1A' }, tt), 'V13.249 원일중에 없는 반(고1A)으로는 못 옮긴다');
  await expectStatus(400, () => service(state, 'GET', '/teacher/class-move', { from: '중3', to: '중3' }, tt), 'V13.249 같은 반으로는 못 옮긴다');

  /* ---------- 순서 지키기 · 확인 ---------- */
  const snapshot = () => JSON.stringify(state.profiles.filter(p => p.id.startsWith('qa-wp-')).map(p => [p.id, p.class_name, p.school_id]));
  const snap0 = snapshot();
  await expectStatus(409, () => service(state, 'POST', '/teacher/class-move', { from: '중2', to: '중3', count: 2 }, tt), 'V13.249 중3 → 예비고1 전에 중2 → 중3을 누르면 막는다(중3 반에 학생이 있어 섞임)');
  await expectStatus(409, () => service(state, 'POST', '/teacher/class-move', { from: '중3', to: '예비고1', count: 2 }, tt), 'V13.249 미리보기 뒤 학생 수가 다르면(확인한 수와 다름) 옮기지 않는다');
  // 시험을 보고 있는 학생이 있으면 기다린다.
  const started = await service(state, 'POST', '/exams/start', { exam_id: exam3.id }, t['qa-wp-b']);
  assert((await service(state, 'GET', '/teacher/class-move', { from: '중3', to: '예비고1' }, tt)).testing === 1, 'V13.249 미리보기에 지금 시험 보는 학생 수가 나온다');
  await expectStatus(409, () => service(state, 'POST', '/teacher/class-move', { from: '중3', to: '예비고1', count: 3 }, tt), 'V13.249 중3 학생이 시험을 보는 중이면 옮기지 않는다(학생이 갑자기 막히지 않게)');
  assert(snapshot() === snap0, 'V13.249 막힌 요청은 아무 학생도 바꾸지 않는다');
  await service(state, 'POST', `/attempts/${started.attempt.id}/submit`, { lease: started.attempt.lease, revision: started.attempt.revision, answers: {} }, t['qa-wp-b']);

  /* ---------- 중3 → 예비고1 ---------- */
  const moved = await service(state, 'POST', '/teacher/class-move', { from: '중3', to: '예비고1', count: 3 }, tt);
  const cls = id => state.profiles.find(p => p.id === id).class_name;
  assert(moved.ok && moved.moved === 3 && moved.moved === view.count && ['qa-wp-a', 'qa-wp-b', 'qa-wp-c'].every(id => cls(id) === '예비고1') && ['qa-wp-d', 'qa-wp-e'].every(id => cls(id) === '중2'),
    'V13.249 중3 → 예비고1: 미리보기 수(3명)만큼 옮기고 중2는 그대로');
  assert(['qa-wp-1a', 'qa-wp-2', 'qa-wp-sb', 'qa-wp-gs'].every(id => state.profiles.find(p => p.id === id).class_name === JSON.parse(snap0).find(r => r[0] === id)[1]) && state.profiles.filter(p => p.id.startsWith('qa-wp-')).every(p => (p.school_id ?? null) === JSON.parse(snap0).find(r => r[0] === p.id)[2]),
    'V13.249 다른 학교 학생은 바뀌지 않고, 옮긴 학생의 학교도 원일중 그대로');
  assert(state.exams.find(e => e.id === exam3.id).active === false && state.assignments.find(a => a.id === asg3.id).active === false && state.exams.find(e => e.id === exam2.id).active === true
    && state.examAttempts.some(a => a.exam_id === exam3.id && a.status === 'submitted'), 'V13.249 옛 반(중3) 진행 중 시험 · 과제는 닫히고(기록은 남음), 중2 시험은 그대로');

  /* ---------- 옮긴 뒤 숫자 그대로 ---------- */
  const after = await boot('qa-wp-a');
  assert(after.profile.class_name === '예비고1' && keep(after) === keep(before) && JSON.stringify(state.sessions.filter(x => x.student_id.startsWith('qa-wp-'))) === sessionsBefore && JSON.stringify(state.mastery['qa-wp-a']) === masteryBefore,
    `V13.249 옮겨도 펫 · 대표 펫 · 코인 · 경험치 · 레벨 · 연습 수 · 연습 기록 · 단어 기록이 그대로 (${keep(after)})`);
  assert(after.sessions.length === before.sessions.length && after.stats.points_balance === 700 && after.stats.practice_count === 1, 'V13.249 예비고1 학생 화면의 연습 기록 목록 · 코인이 0으로 보이지 않는다');
  const unitBest = Number(state.profiles.find(p => p.id === 'qa-wp-a').unit_best || 0);
  assert(unitBest >= 1 && unitBest >= unitsBefore && after.word_mastery.mastered === 0, 'V13.249 옮기기 직전 과 정복 수를 남겨(unit_best) 칭호 "한 과 정복"이 사라지지 않는다(예비고1 책은 아직 없어 화면 정복 수는 0)');
  const teacherRow = (await boot('qa-wp-t')).profiles.find(x => x.id === 'qa-wp-a');
  assert(teacherRow?.class_name === '예비고1' && teacherRow.stats.points_balance === before.stats.points_balance && teacherRow.stats.practice_count === before.stats.practice_count, 'V13.249 선생님 학생 관리에도 옮긴 학생의 코인 · 연습 수가 그대로');

  /* ---------- 예비고1: 중3 책 안 보임 · 빈 화면 안 깨짐 ---------- */
  assert(after.books.length === 0 && !after.books.some(b => b.grade === '중3') && after.exams.length === 0 && after.assignments.length === 0 && after.word_mastery.total_ranges === 0 && after.profile.division === 'middle' && after.profile.school === '원일중',
    'V13.249 예비고1 학생에게는 중3 책이 안 보이고(책 0권), 닫힌 중3 시험 · 과제도 안 보인다');
  assert(Array.isArray(after.ranking) && after.ranking.some(r => r.is_me && r.grade === '예비고1') && after.rewards && after.titles && after.stats, 'V13.249 예비고1 학생 첫 화면(순위 · 보상 · 칭호 · 통계)이 정상으로 온다');
  assert(g3.every(b => runtime.some(x => x.id === b.id)), 'V13.249 중3 책은 지우지 않는다(나중에 새 중3이 본다)');
  const friends = (await service(state, 'GET', '/battle/friends', {}, t['qa-wp-a'])).friends.map(f => f.id);
  assert(friends.includes('qa-wp-b') && !friends.includes('qa-wp-d') && !friends.some(id => ['qa-wp-1a', 'qa-wp-2', 'qa-wp-sb', 'qa-wp-gs'].includes(id)), 'V13.249 예비고1 야차전 친구는 예비고1끼리만(중2 · 고1 · 고2 아님)');
  await expectStatus(400, () => service(state, 'POST', '/practice/start', { range_codes: [code3], mode: 'eng2mean_mc', target: 10 }, t['qa-wp-a']), 'V13.249 예비고1은 중3 범위로 연습을 시작할 수 없다');
  await service(state, 'POST', '/teacher/student-preview', { school_id: 'wonil-middle', grade: '예비고1' }, tt);
  assert(state.profiles.find(p => p.id === 'teacher-preview:qa-wp-t:wonil-middle:예비고1')?.class_name === '예비고1', 'V13.249 선생님 미리보기에서 예비고1 학생 화면을 본다');
  const made = await service(state, 'POST', '/students', { username: 'qa_wp_new', password: 'QaWpNew123!', display_name: '예비고1등록', class_name: '예비고1', school_id: 'wonil-middle' }, tt);
  assert(made.class_name === '예비고1' && made.school_id === 'wonil-middle', 'V13.249 선생님이 예비고1 학생을 등록한다');
  const pool = await service(state, 'GET', '/teacher/tournament-pool', { grade: '예비고1' }, tt);
  assert(pool.grade === '예비고1' && pool.schools.length === 1 && pool.schools[0].students.some(s => s.id === 'qa-wp-a') && !pool.schools[0].students.some(s => s.id === 'qa-wp-d') && pool.schools[0].ranges.length === 0, 'V13.249 대회 학생 목록: 예비고1은 예비고1만(단어는 아직 없음)');

  /* ---------- 다른 학교 화면 그대로 ---------- */
  for (const [schoolId, cls2, nBooks, nRanges, nWords] of OTHERS) {
    const who = state.profiles.find(p => p.school_id === schoolId && p.class_name === cls2 && p.id.startsWith('qa-wp-')).id;
    const b = (await boot(who)).books, w = b.flatMap(x => x.words || []);
    assert(b.length === nBooks && new Set(w.map(x => x.range_code)).size === nRanges && w.length === nWords && JSON.stringify(b.map(x => x.id)) + ids(b) === beforeOthers[who], `V13.249 ${NAMES[schoolId]} ${cls2} 학생 책 ${nBooks}권 · 범위 ${nRanges} · 단어 ${nWords} 그대로`);
  }

  /* ---------- 기말 뒤: 중2 → 중3 ---------- */
  const view2 = await service(state, 'GET', '/teacher/class-move', { from: '중2', to: '중3' }, tt);
  assert(view2.count === 2 && view2.already === 0 && view2.exams.map(e => e.id).join() === exam2.id, 'V13.249 그 뒤 중2 → 중3 미리보기: 2명, 중3 반은 비어 있다');
  await service(state, 'POST', '/teacher/class-move', { from: '중2', to: '중3', count: 2 }, tt);
  assert(['qa-wp-d', 'qa-wp-e'].every(id => cls(id) === '중3') && ['qa-wp-a', 'qa-wp-b', 'qa-wp-c'].every(id => cls(id) === '예비고1') && state.profiles.filter(p => p.school_id === 'wonil-middle' && p.class_name === '중2' && !p.preview_owner_id).length === 0,
    'V13.249 중2 → 중3 뒤에도 예비고1과 섞이지 않는다');
  const new3 = await boot('qa-wp-d');
  assert(new3.books.length === g3.length && new3.books.every(b => b.grade === '중3') && !new3.exams.some(e => e.id === exam3.id) && !new3.assignments.some(a => a.id === asg3.id), 'V13.249 새 중3은 중3 책을 보고, 지난해 중3 시험 · 과제(닫힘)는 다시 보이지 않는다');
  assert((await boot('qa-wp-a')).books.length === 0 && !sameGradeBand(state.profiles.find(p => p.id === 'qa-wp-a'), state.profiles.find(p => p.id === 'qa-wp-d')), 'V13.249 예비고1은 여전히 책 0권이고 새 중3과 야차전 학년이 다르다');
  await expectStatus(409, () => service(state, 'POST', '/teacher/class-move', { from: '중2', to: '중3', count: 0 }, tt), 'V13.249 빈 반은 옮길 것이 없다');

  /* ---------- 새 단어: grade '예비고1' 책 하나면 바로 보인다 ---------- */
  state.extraBooks.push({ id: 'qa-wp-pre-book', school_id: 'wonil-middle', school: '원일중', division: 'middle', grade: '예비고1', title: 'QA 예비고1', words: Array.from({ length: 10 }, (_, i) => ({ id: 'qa-wp-pw' + i, word: 'preword' + i, meaning: '예비뜻' + i, range_code: 'P1', grade: '예비고1', school_id: 'wonil-middle' })) });
  const withBook = await boot('qa-wp-a');
  assert(withBook.books.length === 1 && withBook.books[0].id === 'qa-wp-pre-book' && !(await boot('qa-wp-d')).books.some(b => b.id === 'qa-wp-pre-book'), 'V13.249 grade: 예비고1 책을 더하면 예비고1 학생에게만 바로 보인다');
  state.extraBooks = state.extraBooks.filter(b => b.id !== 'qa-wp-pre-book');
  const rows = Array.from({ length: 8 }, (_, i) => ({ range_code: 'DAY1', word: 'preimport' + i, meaning: '예비가져오기' + i }));
  assert((await service(state, 'POST', '/vocab-import/preview', { grade: '예비고1', rows }, tt)).grade === '예비고1', 'V13.249 중등 단어 파일 등록에서도 예비고1 학년을 고를 수 있다');
  await expectStatus(400, () => service(state, 'POST', '/vocab-import/preview', { grade: '고1A', rows }, tt), 'V13.249 원일중에 없는 반은 단어 등록 학년이 아니다');

  /* ---------- 화면 ---------- */
  const teacherUi = source('../public/modules/teacher.js'), app = source('../public/app.js'), studentUi = source('../public/modules/student.js'), battle = source('../public/modules/battle.js'), dungeon = source('../public/modules/dungeon.js'), arcade = source('../public/modules/arcade-games.js');
  assert(teacherUi.includes('${classMovePanel(A)}${signupCodePanel(A)}') && teacherUi.includes('반 전체 학년 올리기') && teacherUi.includes('data-class-move-preview-btn') && teacherUi.includes('data-class-move-go'),
    'V13.249 학생 관리 화면에 "반 전체 학년 올리기"(미리보기 → 옮기기)');
  assert(app.includes("api(`/teacher/class-move?from=${encodeURIComponent(A.classMove.from)}&to=${encodeURIComponent(A.classMove.to)}`)") && app.includes("confirm(`${v.school} ${v.from} 학생 ${v.count}명을 모두 ${v.to}(으)로 옮길까요?") && app.includes("api('/teacher/class-move', { from: v.from, to: v.to, count: v.count })"),
    'V13.249 미리보기는 GET, 옮기기는 한 번 더 확인한 뒤 미리보기 수와 함께 POST');
  assert(studentUi.includes('${noWordsYet(A) ? wordsComingCard(A) : \'\'}') && studentUi.includes("if (!teacher && !codes.length && noWordsYet(A)) return wordsComingCard(") && studentUi.includes('middleTextbookOff(A)')
    && battle.includes("wordsComingCard(A, '단어가 올라오면 친구와 야차전 대결을 할 수 있어요.')") && battle.includes("wordsComingCard(A, '단어가 올라오면 몬스터와 싸울 수 있어요.')") && dungeon.includes("wordsComingCard(A, '단어가 올라오면 친구와 던전에 들어갈 수 있어요.')") && arcade.includes("'새 단어 준비 중'"),
    'V13.249 책이 없으면 홈 · 단어 학습 · 어법 · 빈칸영작 · 야차전 · 몬스터 · 던전 · 놀이터에 "새 단어 준비 중" 안내');
  assert(studentUi.includes("has('예비고1') ? [['예비고1','예비고1']] : []") && app.includes("match(/^(예비고1|중[1-3]|고[1-3])/)"), 'V13.249 순위 학년 고르기 · 대회 대상 화면에 예비고1');
}
