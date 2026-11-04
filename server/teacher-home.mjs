// V13.215 선생님 첫 화면(GET /api/bootstrap) 줄이기. 운영 크기에서 선생님 첫 화면이 약 1.3MB였다
// (연습 기록 553KB · 학생 목록 303KB · 단어 숙련도 257KB · 단어장 224KB). 느린 학교 와이파이(400kbps)에서 30초 넘게 걸렸다.
//   - 연습 기록(sessions): 첫 화면에는 오늘 기록 + 최근 실전시험 6개만. 대시보드 · 학생 관리 · 이번 주 요약에 쓰는
//     학생별 숫자(마지막 학습 · 이번 주 · 지난주)는 서버가 한 번 세어 session_digest로 보낸다(학생 수만큼, 작다).
//   - 결과 분석의 연습 기록 · 실전시험 결과는 그 탭을 열 때 GET /api/teacher/records로 30개씩 받는다(반 · 이름으로 거른 것만).
//   - 학생 기록 창(최근 연습 5개 · 시험범위 정복)은 그 창을 열 때 GET /api/teacher/student-detail/:id로 받는다.
//   - 학생 목록(profiles)은 선생님 화면이 쓰는 칸만 보낸다(놀이터 기록 · 본 칭호 · 펫 상세는 빼고 펫 종류만).
// 모두 GET(보기)이고 아무것도 쓰지 않는다(docs/performance-rules.md 1 · 4번).
const DAY = 86400000;
const KST = 9 * 3600000;

// public/modules/teacher.js weekStart와 같은 계산(한국 시간 월요일 0시).
export function teacherWeekStart(now = Date.now()) {
  const kst = new Date(now + KST), back = (kst.getUTCDay() + 6) % 7;
  return Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate() - back) - KST;
}

export const sessionScore = s => Number(s.score ?? (s.total ? Math.round(s.correct / s.total * 100) : 0));
const endedAt = s => Number(s.ended_at || s.created_at || 0);

// 학생별 마지막 학습 · 이번 주(횟수 · 문제 · 점수 합) · 지난주 문제 수. 화면의 weekWork · lastActivityMap이 그대로 쓴다.
export function sessionDigest(sessions, now = Date.now()) {
  const start = teacherWeekStart(now), prev = start - 7 * DAY, students = {};
  for (const s of sessions) {
    const r = students[s.student_id] ??= { last: 0, week_count: 0, week_total: 0, week_scores: 0, prev_total: 0 };
    const t = Number(s.created_at || 0);
    if (t > r.last) r.last = t;
    if (t >= start) { r.week_count++; r.week_total += Number(s.total || 0); r.week_scores += sessionScore(s); }
    else if (t >= prev) r.prev_total += Number(s.total || 0);
  }
  return { week_start: start, students };
}

// 첫 화면에 싣는 연습 기록: 오늘(한국 날짜) 기록 + 최근 끝난 실전시험 6개(대시보드 '실전시험 결과' 칸).
export const HOME_TEST_LIMIT = 6;
export function homeSessions(sessions, dayKey, now = Date.now()) {
  const today = dayKey(now);
  const keep = new Set(sessions.filter(s => dayKey(s.created_at) === today));
  sessions.filter(s => s.run_mode === 'test').sort((a, b) => endedAt(b) - endedAt(a)).slice(0, HOME_TEST_LIMIT).forEach(s => keep.add(s));
  return sessions.filter(s => keep.has(s));
}

// 선생님 학생 목록 한 줄: 화면(public/modules/teacher.js · teacher-enhancements.js · petbook.js · app.js)이 읽는 칸만.
export const TEACHER_PROFILE_KEYS = ['id', 'username', 'display_name', 'role', 'class_name', 'grade', 'division', 'school', 'school_id', 'active', 'avatar_key', 'created_at', 'self_signup', 'preview_owner_id', 'ranking_public', 'share_profile'];
export const TEACHER_STAT_KEYS = ['level', 'current', 'need', 'percent', 'stage', 'form', 'points', 'streak', 'week_correct', 'today_total', 'today_xp', 'points_balance', 'practice_count', 'accuracy', 'weak'];
export function teacherStudentRow(profile, stats) {
  const row = {};
  for (const key of TEACHER_PROFILE_KEYS) if (profile[key] !== undefined) row[key] = profile[key];
  // 펫 도감(선생님)은 누가 어떤 펫을 가졌는지만 본다.
  row.pets = (Array.isArray(profile.pets) ? profile.pets : []).map(pet => ({ key: pet.key }));
  row.stats = Object.fromEntries(TEACHER_STAT_KEYS.filter(key => stats?.[key] !== undefined).map(key => [key, stats[key]]));
  return row;
}

// 결과 분석 탭(GET /api/teacher/records): 반 · 이름으로 거르고 최신순으로 한 쪽(기본 30개, 최대 100개)만.
export const RECORDS_PAGE = 30;
export const RECORDS_PAGE_MAX = 100;
export function recordsPage(sessions, profiles, query = {}, summarize = s => s) {
  const view = ['practice', 'sent', 'week'].includes(query.view) ? query.view : 'practice';
  const tests = sessions.filter(s => s.run_mode === 'test'), practices = sessions.filter(s => s.run_mode !== 'test');
  const avg = rows => rows.length ? Math.round(rows.reduce((n, s) => n + sessionScore(s), 0) / rows.length) : 0;
  const metrics = { tests: tests.length, practices: practices.length, test_avg: avg(tests), practice_avg: avg(practices), questions: sessions.reduce((n, s) => n + Number(s.total || 0), 0) };
  if (view === 'week') return { view, rows: [], total: 0, offset: 0, metrics };
  const byId = new Map(profiles.map(x => [x.id, x]));
  const cls = String(query.class || '').slice(0, 40), q = String(query.q || '').trim().toLowerCase().slice(0, 60);
  const matches = s => { const x = byId.get(s.student_id); return (!cls || (x?.class_name || s.grade) === cls) && (!q || `${x?.display_name || ''} ${x?.username || ''}`.toLowerCase().includes(q)); };
  const list = (view === 'sent' ? tests.sort((a, b) => endedAt(b) - endedAt(a)) : practices.sort((a, b) => b.created_at - a.created_at)).filter(matches);
  const offset = Math.max(0, Math.floor(Number(query.offset) || 0));
  const limit = Math.min(RECORDS_PAGE_MAX, Math.max(1, Math.floor(Number(query.limit) || RECORDS_PAGE)));
  return { view, rows: list.slice(offset, offset + limit).map(summarize), total: list.length, offset, metrics };
}
