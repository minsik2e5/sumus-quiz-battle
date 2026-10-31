import { rankingWeek, isRankedStudent } from './competition.mjs';

// V13.202 학교 대항전(홈 화면): 학원 전체를 팀으로 나눠 이번 주(월~일) 1인 평균 점수로 겨룬다.
//   팀: 중학교는 학년마다(원일중 중2 · 원일중 중3), 고등학교는 학교마다(단원고 · 선부고 · 강서고).
//   점수 = (팀 학생들의 이번 주 경험치 + 보너스) ÷ 팀 학생 수(순위에 들어가는 활성 학생). 학생 수가 달라도 공평하게.
//   보너스: 이번 주 끝난 야차 대회 우승 +300 · 준우승 +150, 교실 게임(보물 사냥 · 반 낚시, 3명 이상) 1 · 2 · 3등 +50 · +30 · +20.
// 저장하지 않고 기록에서 계산한다. 홈 데이터마다 다시 세지 않게 1분 동안 같은 결과를 쓴다.
export const SCHOOL_LEAGUE = { TOURNEY: [300, 150], PARTY: [0, 50, 30, 20], PARTY_MIN: 3, CACHE_MS: 60000 };
const cache = new WeakMap();
export function teamOf(state, p, schoolOf) {
  const school = schoolOf(state, p), grade = String(p?.class_name || '').match(/^(중[1-3]|고[1-3])/)?.[1] || '';
  if (!school || !grade) return null;
  // 중학교 팀은 학년 이름(중2 · 중3)으로 부르고 학교 이름은 작게 함께 보인다. 고등학교 팀은 학교 이름.
  return school.division === 'middle' ? { key: `${school.id}:${grade}`, name: grade, school: school.name } : { key: school.id, name: school.name, school: '' };
}
export function schoolLeague(state, ctx, schoolOf, now = Date.now()) {
  const hit = cache.get(state);
  if (hit && now - hit.at < SCHOOL_LEAGUE.CACHE_MS && hit.week === rankingWeek(now).start) return hit.value;
  const week = rankingWeek(now), inWeek = t => Number(t) >= week.start && Number(t) < week.end;
  const teams = new Map(), teamByPid = new Map();
  for (const x of state.profiles) {
    if (!isRankedStudent(x)) continue;
    const t = teamOf(state, x, schoolOf);
    if (!t) continue;
    const row = teams.get(t.key) || { ...t, students: 0, active: 0, xp: 0, bonus: 0 };
    const xp = ctx.sessionsOf(x.id).filter(s => inWeek(s.created_at)).reduce((n, s) => n + Number(s.xp || 0), 0);
    row.students++; row.xp += xp; if (xp > 0) row.active++;
    teams.set(t.key, row); teamByPid.set(x.id, t.key);
  }
  const add = (pid, n) => { const row = teams.get(teamByPid.get(pid)); if (row && n) row.bonus += n; };
  for (const t of state.tournaments || []) if (t.status === 'finished' && inWeek(t.finished_at)) { add(t.champion, SCHOOL_LEAGUE.TOURNEY[0]); add(t.runner_up, SCHOOL_LEAGUE.TOURNEY[1]); }
  for (const party of state.parties || []) {
    if (!party.settled || !inWeek(party.ended_at) || Number(party.summary?.players || 0) < SCHOOL_LEAGUE.PARTY_MIN) continue;
    for (const row of party.paid || []) add(row.id, SCHOOL_LEAGUE.PARTY[row.rank] || 0);
  }
  const names = new Map();
  for (const r of teams.values()) names.set(r.name, (names.get(r.name) || 0) + 1);
  for (const r of teams.values()) if (names.get(r.name) > 1) r.name = `${r.school} ${r.name}`;
  const rows = [...teams.values()].map(r => ({ ...r, score: r.students ? Math.round((r.xp + r.bonus) / r.students) : 0 }))
    .sort((a, b) => b.score - a.score || b.active - a.active || a.name.localeCompare(b.name, 'ko'));
  const value = { week: { start: week.start, end: week.end }, teams: rows.map((r, i) => ({ key: r.key, name: r.name, school: r.school, rank: i + 1, score: r.score, students: r.students, active: r.active, bonus: r.bonus })), updated_at: now };
  cache.set(state, { at: now, week: week.start, value });
  return value;
}
export const myTeamKey = (state, p, schoolOf) => teamOf(state, p, schoolOf)?.key || null;
