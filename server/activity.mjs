import { dayKey } from '../public/modules/core.js';
import { rankingWeek, isRankedStudent } from './competition.mjs';

// V13.173 학생 활동 기록(선생님 전용). 학생 프로필에 최근 ACTIVITY_KEEP개만 보관하는 고리 로그와,
// 인기 집계용 횟수 카운터를 둔다. 새 저장을 만들지 않는다: 이미 저장이 일어나는 변경(끝난 결과를 기록하는 곳)에만 얹는다.
//   p.activity = [{ at, k: 모드 키, t: 짧은 설명 }]  (오래된 것부터, 최대 30개)
//   p.usage    = { week: 주 시작 시각, counts: { 모드: 횟수 }, day: 'YYYY-MM-DD', today: { 모드: 횟수 } }
// publicProfile이 둘 다 뺀다(server/auth.mjs): 학생 화면 · 선생님 학생 목록에는 실리지 않고 선생님 전용 GET으로만 간다.
export const ACTIVITY_KEEP = 30;
export const ACTIVITY_TEXT_MAX = 48;
export const ACTIVITY_MODES = {
  practice: { label: '연습', icon: '📝' },
  test: { label: '실전시험(스스로)', icon: '🎯' },
  exam: { label: '선생님 시험', icon: '🧪' },
  yacha: { label: '야차전', icon: '⚔️' },
  robot: { label: '로보 연습전', icon: '🤖' },
  monster: { label: '몬스터전', icon: '👹' },
  hunt: { label: '몬스터 사냥', icon: '🎯' },
  claw: { label: '인형뽑기', icon: '🧸' },
  blank: { label: '빈칸영작', icon: '✍️' },
  fish: { label: '낚시', icon: '🎣' },
  match: { label: '짝 맞추기', icon: '🃏' },
  dungeon: { label: '던전', icon: '🏰' },
  treasure: { label: '보물 사냥', icon: '💰' },
  classfish: { label: '반 낚시', icon: '🐟' },
  attend: { label: '출석', icon: '📅' },
  rps: { label: '가위바위보', icon: '✌️' },
  lucky: { label: '행운 뽑기', icon: '🎰' },
  market: { label: '증권거래소', icon: '📈' }
};

// 끝난 결과 한 줄을 남긴다. 학생만(선생님 · 미리보기 계정은 남기지 않는다).
export function logActivity(p, k, text, now = Date.now()) {
  if (!p || p.role !== 'student' || p.preview_owner_id || !Object.hasOwn(ACTIVITY_MODES, k)) return false;
  const log = Array.isArray(p.activity) ? p.activity : (p.activity = []);
  log.push({ at: now, k, t: String(text || ACTIVITY_MODES[k].label).slice(0, ACTIVITY_TEXT_MAX) });
  if (log.length > ACTIVITY_KEEP) log.splice(0, log.length - ACTIVITY_KEEP);
  const weekStart = rankingWeek(now).start, today = dayKey(now);
  const u = p.usage && typeof p.usage === 'object' ? p.usage : (p.usage = {});
  if (u.week !== weekStart) { u.week = weekStart; u.counts = {}; }
  if (u.day !== today) { u.day = today; u.today = {}; }
  u.counts[k] = Number(u.counts[k] || 0) + 1;
  u.today[k] = Number(u.today[k] || 0) + 1;
  return true;
}

// 선생님이 한 학생을 눌렀을 때 받는 것: 오늘 것이 먼저 보이도록 최근순.
export function activityOf(p) {
  // 방이 보고하는 결과(야차전 · 던전 · 파티)는 끝난 시각으로 남아서 쌓인 순서와 시각이 조금 다를 수 있다: 시각 기준 최근순.
  return (Array.isArray(p?.activity) ? p.activity : []).map(x => ({ at: x.at, k: x.k, t: x.t })).reverse().sort((a, b) => b.at - a.at);
}

const bucketOf = value => Math.max(0, Math.floor(Number(value) || 0));
// 학생 목록 → 모드별 인기(오늘 · 이번 주 횟수와 하는 학생 수), 접속 시간대 24칸, 몬스터 레벨 분포.
// 미리보기 계정과 비활성 학생은 뺀다(isRankedStudent).
export function activityOverview(students, now = Date.now(), { timeZoneOffsetHours = 9 } = {}) {
  const weekStart = rankingWeek(now).start, today = dayKey(now);
  const rows = Object.fromEntries(Object.keys(ACTIVITY_MODES).map(k => [k, { k, today: 0, today_players: 0, week: 0, week_players: 0 }]));
  const hours = Array(24).fill(0), monsters = new Map();
  let tracked = 0, first = 0;
  for (const p of students) {
    if (!isRankedStudent(p)) continue;
    const u = p.usage;
    if (u?.week === weekStart) for (const [k, n] of Object.entries(u.counts || {})) if (rows[k] && n > 0) { rows[k].week += n; rows[k].week_players++; }
    if (u?.day === today) for (const [k, n] of Object.entries(u.today || {})) if (rows[k] && n > 0) { rows[k].today += n; rows[k].today_players++; }
    const log = Array.isArray(p.activity) ? p.activity : [];
    if (log.length) { tracked++; first = first ? Math.min(first, log[0].at) : log[0].at; }
    for (const x of log) hours[(new Date(Number(x.at) + timeZoneOffsetHours * 3600000).getUTCHours() + 24) % 24]++;
    const m = p.bonus?.monster;
    const stage = Math.max(bucketOf(m?.stage), bucketOf(m?.best));
    monsters.set(stage, (monsters.get(stage) || 0) + 1);
  }
  const popularity = Object.values(rows).map(r => ({ ...r, label: ACTIVITY_MODES[r.k].label, icon: ACTIVITY_MODES[r.k].icon }));
  return {
    popularity,
    hours,
    monsters: [...monsters.entries()].sort((a, b) => a[0] - b[0]).map(([stage, count]) => ({ stage, count })),
    tracked, since: first || null, students: students.filter(isRankedStudent).length, week_start: weekStart
  };
}
