// V13.198 검사: 학교별 단어 야차 대회. 선생님이 맡은 여러 학교(같은 부)의 같은 학년 학생으로 대회를 열고,
// 학교마다 단어 범위를 고른다. 경기마다 두 학생은 각자 자기 학교 범위의 단어를 받는다(같은 학교끼리는 같은 단어).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { emptyState } from './state.mjs';
import { passwordHash } from './auth.mjs';
import { service, allBooks } from './service.mjs';
import { tournamentRanges, tournamentHasSchool } from './tournament.mjs';

const source = path => readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8');
const DAY = 86400000;

export async function runTournamentSchoolsChecks(assert) {
  const state = emptyState(), now = Date.now(), hash = await passwordHash('QaTourney1!');
  const wordIds = (school, code) => new Set(allBooks(state).filter(b => b.school_id === school && (!b.grade || b.grade === '고1')).flatMap(b => b.words || []).filter(w => String(w.range_code) === code).map(w => w.id));
  const DANWON = wordIds('danwon-high', '24'), GANGSEO = wordIds('gangseo-high', '21');
  assert(DANWON.size >= 8 && GANGSEO.size >= 8, 'V13.198 검사 준비: 단원고 24번 · 강서고 21번 범위에 단어가 있다');
  state.profiles.push({ id: 'qa-tt', username: 'qa-tt', display_name: '대회 선생님', role: 'teacher', active: true, password_hash: hash, school_ids: ['danwon-high', 'gangseo-high'], division_ids: ['high'], active_division: 'high', active_school_id: 'danwon-high', created_at: now - DAY });
  state.profiles.push({ id: 'qa-ot', username: 'qa-ot', display_name: '남의 선생님', role: 'teacher', active: true, password_hash: hash, school_ids: ['danwon-high'], division_ids: ['high'], active_division: 'high', active_school_id: 'danwon-high', created_at: now - DAY });
  const student = (id, school, name) => ({ id, username: id, display_name: name, role: 'student', active: true, class_name: '고1A', school_id: school, school: school === 'danwon-high' ? '단원고' : '강서고', division: 'high', password_hash: hash, avatar_key: 'dog', pets: [{ key: 'dog', first: true, acquired_at: now - DAY }], created_at: now - 9 * DAY });
  state.profiles.push(student('qa-d1', 'danwon-high', '단원일'), student('qa-d2', 'danwon-high', '단원이'), student('qa-g1', 'gangseo-high', '강서일'), student('qa-g2', 'gangseo-high', '강서이'));
  const tokens = {};
  for (const u of ['qa-tt', 'qa-ot', 'qa-d1', 'qa-d2', 'qa-g1', 'qa-g2']) tokens[u] = (await service(state, 'POST', '/login', { username: u, password: 'QaTourney1!', division: 'high' }, null))._cookie;
  const call = (u, method, path, body = {}) => service(state, method, path, body, tokens[u]);
  const status = p => p.then(() => 200, e => e.status || 500);

  // ---- 만들기 창: 맡은 학교마다 그 학년 학생과 범위
  const pool = await call('qa-tt', 'GET', '/teacher/tournament-pool', { grade: '고1' });
  const gs = pool.schools.find(x => x.id === 'gangseo-high'), ds = pool.schools.find(x => x.id === 'danwon-high');
  assert(pool.grade === '고1' && ds && gs && gs.students.map(x => x.id).sort().join() === 'qa-g1,qa-g2' && gs.ranges.some(r => r.code === '21' && r.count === GANGSEO.size) && !pool.schools.some(x => x.id === 'seonbu-high'),
    'V13.198 대회 만들기 창: 맡은 학교마다 같은 학년 학생 · 범위(맡지 않은 학교는 없다)');
  assert(await status(call('qa-d1', 'GET', '/teacher/tournament-pool', { grade: '고1' })) === 403, 'V13.198 학생은 대회 학생 목록을 볼 수 없다');

  // ---- 거절: 맡지 않은 학교, 반 대회에 다른 학교, 범위 없음, 다른 학교 학생만 따로
  const base = { name: '고1 연합 대회', class_name: '고1', mode: 'speed', prize: 0, range_codes: ['24'] };
  assert(await status(call('qa-ot', 'POST', '/teacher/tournaments', { ...base, student_ids: ['qa-d1', 'qa-g1'], schools: [{ school_id: 'gangseo-high', range_codes: ['21'] }] })) === 403, 'V13.198 맡지 않은 학교는 함께할 수 없다');
  assert(await status(call('qa-tt', 'POST', '/teacher/tournaments', { ...base, class_name: '고1A', student_ids: ['qa-d1', 'qa-g1'], schools: [{ school_id: 'gangseo-high', range_codes: ['21'] }] })) === 400, 'V13.198 여러 학교 대회는 학년 전체로만');
  assert(await status(call('qa-tt', 'POST', '/teacher/tournaments', { ...base, student_ids: ['qa-d1', 'qa-g1'], schools: [{ school_id: 'gangseo-high', range_codes: [] }] })) === 400, 'V13.198 함께할 학교마다 범위가 있어야 한다');
  assert(await status(call('qa-tt', 'POST', '/teacher/tournaments', { ...base, student_ids: ['qa-d1', 'qa-g1'] })) === 400, 'V13.198 함께할 학교를 고르지 않으면 다른 학교 학생은 참가할 수 없다(예전처럼 한 학교 대회)');

  // ---- 학교별 단어 대회 열기
  const made = await call('qa-tt', 'POST', '/teacher/tournaments', { ...base, student_ids: ['qa-d1', 'qa-g1'], schools: [{ school_id: 'gangseo-high', range_codes: ['21'] }] });
  const t = state.tournaments.find(x => x.id === made.tournament.id);
  assert(t.school_id === 'danwon-high' && t.school_ids.join() === 'danwon-high,gangseo-high' && tournamentRanges(t, 'gangseo-high').join() === '21' && tournamentRanges(t, 'danwon-high').join() === '24' && tournamentRanges(t, 'seonbu-high') === null && tournamentHasSchool(t, 'gangseo-high'),
    'V13.198 대회에 학교마다 범위가 저장된다');
  assert(made.tournament.schools.join() === '단원고,강서고' && made.tournament.rounds[0].matches[0].a.school && made.tournament.rounds[0].matches[0].b.school, 'V13.198 대진표에 학교 이름이 보인다');

  // ---- 경기: 단원고 학생이 방을 열면 단원고 단어, 강서고 학생이 들어오면 각자 자기 학교 단어
  const opened = await call('qa-d1', 'POST', '/tournament/play', { tournament_id: t.id, match_id: t.rounds[0][0].id });
  assert(opened._battle?.action === 'init' && opened._battle.questions.every(q => DANWON.has(q.word_id)), 'V13.198 방을 연 학생의 문제는 자기 학교 범위(단원고 24번)');
  const invite = await call('qa-g1', 'GET', '/battle/invite');
  assert(invite.invite?.tournament && invite.invite.cross_school === true && invite.invite.range_mode === 'each', 'V13.198 다른 학교 대회 상대에게도 경기 알림이 가고, 각자 내 범위로 안내한다');
  const joined = await call('qa-g1', 'POST', '/tournament/play', { tournament_id: t.id, match_id: t.rounds[0][0].id });
  const own = joined._battle?.own;
  assert(joined.own_words === true && own?.['qa-d1']?.length >= 8 && own['qa-g1'].length === own['qa-d1'].length && own['qa-d1'].every(q => DANWON.has(q.word_id)) && own['qa-g1'].every(q => GANGSEO.has(q.word_id)),
    'V13.198 경기마다 각자 자기 학교 범위의 단어(단원고 24번 · 강서고 21번), 문제 수는 같다');
  const room = state.battles.find(b => b.id === opened.id);
  assert(room.range_mode === 'each' && room.guest_school_id === 'gangseo-high' && room.guest_range_codes.join() === '21' && room.stake === 0 && room.tournament_id === t.id, 'V13.198 방 기록: 각자 내 범위 · 상대 학교 · 판돈 없음');

  // ---- 한 학교 대회는 예전 그대로
  const solo = { id: 'solo', players: ['a', 'b'], school_id: 'danwon-high', range_codes: ['24'] };
  assert(tournamentRanges(solo, 'danwon-high').join() === '24' && tournamentRanges(solo, 'gangseo-high') === null && !tournamentHasSchool(solo, 'gangseo-high'), 'V13.198 한 학교 대회는 예전과 같다(그 학교만, 대회 범위)');

  // ---- 화면
  const app = source('../public/app.js'), svc = source('./service.mjs'), build = source('./build-assets.mjs');
  assert(app.includes("api('/teacher/tournament-pool?grade=' + encodeURIComponent(grade))") && app.includes('함께할 학교') && app.includes("...(schools.length ? { schools } : {})") && app.includes('함께할 학교마다 단어 범위를 하나 이상 골라주세요.'),
    'V13.198 대회 만들기 창: 함께할 학교 · 학교마다 범위 고르기');
  assert(svc.includes("if (battle.tournament_id) { const t = (state.tournaments || []).find(x => x.id === battle.tournament_id); return !!t?.players.includes(p.id) && tournamentHasSchool(t, school.id); }") && build.includes('"v13198.css"'),
    'V13.198 대회 방은 그 대회 선수에게만(다른 학교 선수 포함) 열린다');
}
