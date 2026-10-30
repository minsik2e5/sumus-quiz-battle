// V13.202 검사: 학교 대항전(학생 홈). 중학교는 학년마다(중2 · 중3), 고등학교는 학교마다 한 팀,
// 이번 주 (경험치 + 대회 · 교실 게임 보너스) ÷ 학생 수로 순위를 매긴다. 저장하지 않고 기록에서 계산.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { emptyState } from './state.mjs';
import { passwordHash } from './auth.mjs';
import { service } from './service.mjs';
import { rankingWeek } from './competition.mjs';
import { schoolLeague, teamOf, SCHOOL_LEAGUE } from './school-league.mjs';

const source = path => readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8');
const DAY = 86400000;

export async function runSchoolLeagueChecks(assert) {
  const state = emptyState(), now = Date.now(), week = rankingWeek(now), inWeek = week.start + 1000, lastWeek = week.start - DAY;
  const schoolOf = (s, p) => s.schools.find(x => x.id === p.school_id);
  const st = (id, school, cls, extra = {}) => ({ id, username: id, display_name: id, role: 'student', active: true, school_id: school, class_name: cls, ...extra });
  state.profiles.push(st('m2a', 'wonil-middle', '중2'), st('m2b', 'wonil-middle', '중2A'), st('m3a', 'wonil-middle', '중3'),
    st('d1', 'danwon-high', '고1A'), st('d2', 'danwon-high', '고2B'), st('d3', 'danwon-high', '고1A'),
    st('g1', 'gangseo-high', '고1A'), st('s1', 'seonbu-high', '고1A'),
    st('off', 'gangseo-high', '고1A', { active: false }), st('pv', 'gangseo-high', '고1A', { preview_owner_id: 't' }));
  const xp = { m2a: 100, m2b: 300, m3a: 50, d1: 90, d2: 0, d3: 0, g1: 40, s1: 0, off: 9999, pv: 9999 };
  const sessions = id => [{ xp: xp[id] || 0, created_at: inWeek }, { xp: 5000, created_at: lastWeek }];
  const ctx = { sessionsOf: sessions };

  assert(teamOf(state, state.profiles[0], schoolOf).name === '중2' && teamOf(state, state.profiles[0], schoolOf).school === '원일중' && teamOf(state, state.profiles[3], schoolOf).key === 'danwon-high' && teamOf(state, state.profiles[4], schoolOf).key === 'danwon-high',
    'V13.202 팀: 중학교는 학년(중2 · 중3, 학교 이름은 작게), 고등학교는 학교 하나(고1 · 고2 함께)');
  const a = schoolLeague(state, ctx, schoolOf, now), by = k => a.teams.find(t => t.key === k);
  assert(a.teams.map(t => t.name).sort().join() === '강서고,단원고,선부고,중2,중3', 'V13.202 학교 대항전 팀은 중2 · 중3 · 단원고 · 선부고 · 강서고');
  assert(by('wonil-middle:중2').score === 200 && by('danwon-high').score === 30 && by('gangseo-high').students === 1 && by('gangseo-high').score === 40,
    'V13.202 점수 = 이번 주 경험치 ÷ 학생 수(지난주 기록 · 그만둔 학생 · 미리보기 학생은 빼고)');
  assert(a.teams[0].key === 'wonil-middle:중2' && a.teams[0].rank === 1 && a.teams.at(-1).score === 0, 'V13.202 1인 평균이 높은 팀부터');
  assert(schoolLeague(state, { sessionsOf: () => [] }, schoolOf, now + 1000) === a, 'V13.202 1분 동안은 같은 결과를 쓴다(홈 데이터마다 다시 세지 않는다)');

  // 보너스: 이번 주 대회 우승 · 준우승, 3명 이상 교실 게임 1~3등
  const s2 = emptyState(); s2.profiles = state.profiles;
  s2.tournaments = [{ id: 't1', status: 'finished', finished_at: inWeek, champion: 's1', runner_up: 'g1' }, { id: 't0', status: 'finished', finished_at: lastWeek, champion: 'd1' }];
  s2.parties = [{ id: 'p1', settled: true, ended_at: inWeek, summary: { players: 3 }, paid: [{ id: 'd1', rank: 1 }, { id: 'd3', rank: 2 }, { id: 'm3a', rank: 3 }, { id: 'g1', rank: 4 }] },
    { id: 'p2', settled: true, ended_at: inWeek, summary: { players: 2 }, paid: [{ id: 's1', rank: 1 }] }];
  const b = schoolLeague(s2, ctx, schoolOf, now), bb = k => b.teams.find(t => t.key === k);
  assert(bb('seonbu-high').bonus === SCHOOL_LEAGUE.TOURNEY[0] && bb('seonbu-high').score === 300 && bb('gangseo-high').bonus === 150 && bb('danwon-high').bonus === 80 && bb('wonil-middle:중3').bonus === 20,
    'V13.202 보너스: 이번 주 대회 우승 +300 · 준우승 +150, 교실 게임(3명 이상) 1 · 2 · 3등 +50 · +30 · +20(지난주 대회 · 2명 게임은 없음)');
  assert(b.teams[0].key === 'seonbu-high', 'V13.202 대회 우승 보너스로 작은 학교도 1등을 할 수 있다');

  // 서버: 학생 홈 데이터에 school_league, 내 팀 표시
  const s3 = emptyState(), hash = await passwordHash('QaLeague1!');
  s3.profiles.push({ id: 'qa-l1', username: 'qa-l1', display_name: '리그', role: 'student', active: true, class_name: '고1A', school_id: 'danwon-high', school: '단원고', division: 'high', password_hash: hash, avatar_key: 'dog', pets: [{ key: 'dog', first: true, acquired_at: now - DAY }], created_at: now - 9 * DAY },
    { id: 'qa-l2', username: 'qa-l2', display_name: '중등', role: 'student', active: true, class_name: '중2', school_id: 'wonil-middle', school: '원일중', division: 'middle', password_hash: hash, avatar_key: 'dog', pets: [{ key: 'dog', first: true, acquired_at: now - DAY }], created_at: now - 9 * DAY });
  const token = (await service(s3, 'POST', '/login', { username: 'qa-l1', password: 'QaLeague1!', division: 'high' }, null))._cookie;
  const boot = await service(s3, 'GET', '/bootstrap', {}, token);
  const mine = boot.school_league?.teams.filter(t => t.mine) || [];
  assert(boot.school_league?.teams.length === 2 && mine.length === 1 && mine[0].key === 'danwon-high', 'V13.202 학생 홈 데이터에 학교 대항전 · 우리 팀 표시');

  const ui = source('../public/modules/student.js'), build = source('./build-assets.mjs');
  assert(ui.includes('${compactGrowth(A)}${schoolLeagueCard(A)}') && ui.includes('🏫 학교 대항전') && ui.includes('우리 팀') && build.includes('"v13202.css"'),
    'V13.202 학생 홈에 학교 대항전 카드(우리 팀 강조 · 1인 평균 · 보너스 안내)');
}
