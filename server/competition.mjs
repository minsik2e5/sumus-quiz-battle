// V13.66 competition: titles, the weekly yacha league and weekly awards, computed from the
// state on each request (nothing here is stored). One context per request groups sessions
// and battles by student once, so ranking lists stay O(sessions + battles).
import { levelInfo, petProgress } from '../public/modules/core.js';
import { TITLES, TITLE_KEYS, titleUnlocked, LEAGUE_POINTS, LEAGUE_PAIR_DAY_CAP, leagueTier, leagueTierIndex } from '../public/modules/titles.js';
import { GACHA_ITEMS, GACHA_KEYS } from '../public/modules/rewards.js';
import { bonusRecords } from './rewards.mjs';

export const DAY_MS = 86400000;
export const KST_OFFSET_MS = 9 * 3600000;
const KO_WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
function shortKstDate(ts) {
  const d = new Date(ts + KST_OFFSET_MS);
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()}(${KO_WEEKDAYS[d.getUTCDay()]})`;
}
// Ranking weeks start on Monday 00:00 KST.
export function rankingWeek(now = Date.now()) {
  const local = new Date(now + KST_OFFSET_MS);
  const daysSinceMonday = (local.getUTCDay() + 6) % 7;
  const start = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() - daysSinceMonday) - KST_OFFSET_MS;
  const end = start + 7 * DAY_MS;
  const thursday = new Date(start + KST_OFFSET_MS + 3 * DAY_MS);
  const year = thursday.getUTCFullYear();
  const monthIndex = thursday.getUTCMonth();
  const month = monthIndex + 1;
  const firstOfMonth = new Date(Date.UTC(year, monthIndex, 1));
  const firstThursday = 1 + ((4 - firstOfMonth.getUTCDay() + 7) % 7);
  const week = 1 + Math.floor((thursday.getUTCDate() - firstThursday) / 7);
  return {
    start, end, year, month, week,
    key: `${year}-${String(month).padStart(2, '0')}-W${week}`,
    label: `${year}년 ${month}월 ${week}주차`,
    range: `${shortKstDate(start)} ~ ${shortKstDate(end - 1)}`
  };
}
export const gradeOf = className => String(className || '').match(/^(중[1-3]|고[1-3])/)?.[1] || String(className || '');
// V13.125: the same 부 (중학교/고등학교) and the same 학년 (고1A and 고1B are both 고1), whichever
// school. a and b are { division, class_name }. 야차전 across schools uses it, and the dungeon lobby
// (docs/dungeon-design.md: 학교가 달라도 같은 학년이면 된다) is meant to use the same rule.
export const sameGradeBand = (a, b) => {
  const grade = gradeOf(a?.class_name);
  return !!a?.division && a.division === b?.division && /^(중|고)[1-3]$/.test(grade) && grade === gradeOf(b?.class_name);
};
// The grade group of the ranking tab.
export function rankGrade(profile) {
  const c = profile?.class_name || '';
  return /^중2/.test(c) ? '중2' : /^중3/.test(c) ? '중3' : /^고1/.test(c) ? '고1' : (profile?.division === 'middle' ? '중등' : '고등');
}
const push = (map, key, value) => { if (!map.has(key)) map.set(key, []); map.get(key).push(value); };
// KST calendar day and Monday-based week as plain numbers (KST has no daylight saving), so
// grouping thousands of records needs no date formatting. 1970-01-01 was a Thursday.
export const kstDay = ts => Math.floor((Number(ts) + KST_OFFSET_MS) / DAY_MS);
export const kstWeek = ts => Math.floor((kstDay(ts) + 3) / 7);
const schoolOf = profile => profile?.school_id || profile?.school || '';
// Students who play and are ranked (teacher preview accounts are left out).
export const isRankedStudent = p => p?.role === 'student' && p.active !== false && !p.preview_owner_id;
export const isPrivate = p => p?.ranking_public === false || p?.share_profile === false;

// Win streak: consecutive wins until a loss or draw. Within one streak, wins over the same
// friend on the same day count once, so two friends cannot trade wins to build titles.
export function battleStreaks(rows, pid) {
  let current = 0, best = 0, counted = new Set();
  for (const b of [...rows].sort((x, y) => x.finished_at - y.finished_at)) {
    if (b.winner !== pid) { current = 0; counted = new Set(); continue; }
    const key = `${b.host_id === pid ? b.guest_id : b.host_id}:${kstDay(b.finished_at)}`;
    if (counted.has(key)) continue;
    counted.add(key);
    best = Math.max(best, ++current);
  }
  return { streak: current, best_streak: best };
}
// A finished match between two students. Practice matches against the app run on the phone
// and never reach the state.
export const isMatch = b => !!b && b.status === 'finished' && !!b.host_id && !!b.guest_id;
const opponentOf = (b, pid) => (b.host_id === pid ? b.guest_id : b.host_id);
export const outcomeOf = (b, pid) => (b.winner === pid ? 'win' : b.loser === pid ? 'loss' : 'draw');
// Matches that count for the league and yacha titles: in time order, the first three between
// the same two students on one day.
export function countedMatches(rows, pid) {
  const seen = new Map(), out = [];
  for (const b of [...rows].sort((x, y) => x.finished_at - y.finished_at)) {
    const key = `${opponentOf(b, pid)}:${kstDay(b.finished_at)}`;
    const n = (seen.get(key) || 0) + 1;
    seen.set(key, n);
    if (n <= LEAGUE_PAIR_DAY_CAP) out.push(b);
  }
  return out;
}
export function leagueSummary(rows, pid) {
  let wins = 0, losses = 0, draws = 0;
  for (const b of rows) { const o = outcomeOf(b, pid); if (o === 'win') wins++; else if (o === 'loss') losses++; else draws++; }
  const points = wins * LEAGUE_POINTS.win + draws * LEAGUE_POINTS.draw + losses * LEAGUE_POINTS.loss;
  const played = wins + losses + draws;
  return { points, wins, losses, draws, played, win_rate: played ? Math.round(wins / played * 100) : null, tier: leagueTier(points) };
}
function longestDayRun(sessions) {
  const days = [...new Set(sessions.filter(s => s.total > 0 && s.answered_count !== 0).map(s => kstDay(s.created_at)))].sort((a, b) => a - b);
  let best = 0, run = 0, prev = null;
  for (const day of days) { run = prev !== null && day === prev + 1 ? run + 1 : 1; best = Math.max(best, run); prev = day; }
  return best;
}
const hpOf = (b, pid) => { const v = b.hp?.[pid]; return v === undefined || v === null ? NaN : Number(v); };
// V13.94: full HP went from 100 to 250; a match keeps the full HP it was played with.
const maxHpOf = b => Number(b.max_hp) || 100;

export function createCompetition(state, now = Date.now()) {
  const sessionsBy = new Map(), battlesBy = new Map();
  for (const s of state.sessions || []) push(sessionsBy, s.student_id, s);
  for (const b of state.battles || []) if (isMatch(b)) { push(battlesBy, b.host_id, b); push(battlesBy, b.guest_id, b); }
  const profiles = new Map((state.profiles || []).map(p => [p.id, p]));
  // V13.70 경험치 and coins from robot matches and exams count like practice (levels, pets, rankings).
  for (const p of profiles.values()) for (const row of bonusRecords(p)) push(sessionsBy, p.id, row);
  const week = rankingWeek(now), lastWeek = rankingWeek(week.start - 1);
  const champions = new Map();
  for (const t of state.tournaments || []) if (t.status === 'finished' && t.champion) champions.set(t.champion, (champions.get(t.champion) || 0) + 1);
  const exams = new Map();
  for (const a of state.examAttempts || []) if (a.status === 'submitted') exams.set(a.student_id, (exams.get(a.student_id) || 0) + 1);
  const countedCache = new Map(), statCache = new Map();
  let awards = null;
  const inWindow = window => b => b.finished_at >= window.start && b.finished_at < window.end;
  const winsOf = pid => ctx.countedOf(pid).filter(b => b.winner === pid);
  const STATS = {
    level: (p, pid) => levelInfo(ctx.sessionsOf(pid).reduce((n, s) => n + Number(s.xp || 0), 0)).level,
    combo: (p, pid) => Math.max(0, ...ctx.sessionsOf(pid).map(s => Number(s.best_combo || 0))),
    correct: (p, pid) => ctx.sessionsOf(pid).reduce((n, s) => n + Number(s.correct || 0), 0),
    best_days: (p, pid) => longestDayRun(ctx.sessionsOf(pid)),
    perfect: (p, pid) => ctx.sessionsOf(pid).filter(s => s.perfect === true && Number(s.total || 0) >= 10).length,
    pets: p => Array.isArray(p?.pets) ? p.pets.length : 0,
    wins: (p, pid) => winsOf(pid).length,
    win_streak: (p, pid) => battleStreaks(ctx.battlesOf(pid), pid).best_streak,
    comebacks: (p, pid) => winsOf(pid).filter(b => b.reason === 'end' && hpOf(b, pid) > 0 && hpOf(b, pid) <= maxHpOf(b) / 5).length,
    flawless: (p, pid) => winsOf(pid).filter(b => b.reason === 'end' && hpOf(b, pid) === maxHpOf(b)).length,
    league_best: (p, pid) => {
      const weeks = new Map();
      for (const b of ctx.countedOf(pid)) {
        const o = outcomeOf(b, pid), w = kstWeek(b.finished_at);
        weeks.set(w, (weeks.get(w) || 0) + (o === 'win' ? LEAGUE_POINTS.win : o === 'draw' ? LEAGUE_POINTS.draw : LEAGUE_POINTS.loss));
      }
      return Math.max(0, ...[...weeks.values()].map(points => leagueTierIndex(points)));
    },
    championships: (p, pid) => champions.get(pid) || 0,
    // V13.73 titles. Bonus rows (robot matches, exams) have no answers, so they are not studies.
    studies: (p, pid) => ctx.sessionsOf(pid).filter(s => !s.bonus && Number(s.answered_count ?? s.total ?? 0) >= 10).length,
    attendance: p => Number(p?.attendance?.total || 0),
    bot_wins: p => Number(p?.bonus?.bot?.wins || 0),
    bot_hard_wins: p => Number(p?.bonus?.bot?.hard_wins || 0),
    monster_wins: p => Number(p?.bonus?.monster?.wins || 0),
    monster_hard: p => Number(p?.bonus?.monster?.hard_wins || 0),
    // V13.82 가위바위보: throws won, and ×8 (three wins in a row) pots.
    rps_wins: p => Number(p?.rps?.wins_total || 0),
    rps_jackpots: p => Number(p?.rps?.jackpots || 0),
    skills: (p, pid) => ctx.battlesOf(pid).reduce((n, b) => n + Number(b.skills?.[pid] || 0), 0),
    exams: (p, pid) => exams.get(pid) || 0,
    gifts: p => Number(p?.gift_box?.count || 0),
    weekly_rank: (p, pid) => ctx.awards().weeklyRank.get(pid) || 0,
    league_king: (p, pid) => ctx.awards().leagueKings.has(pid) ? 1 : 0,
    // V13.67 capsule-only titles: owned when the capsule was pulled.
    ...Object.fromEntries(GACHA_KEYS.filter(key => GACHA_ITEMS[key].kind === 'title').map(key => [`item_${key}`, p => Number(p?.gacha?.items?.[key] || 0)]))
  };

  const ctx = {
    now, week, lastWeek, profiles,
    sessionsOf: pid => sessionsBy.get(pid) || [],
    battlesOf: pid => battlesBy.get(pid) || [],
    countedOf(pid) {
      if (!countedCache.has(pid)) countedCache.set(pid, countedMatches(ctx.battlesOf(pid), pid));
      return countedCache.get(pid);
    },
    league(pid, window = week) { return leagueSummary(ctx.countedOf(pid).filter(inWindow(window)), pid); },
    awards() { return awards ??= weeklyAwards(ctx, state); },
    // One number of a student's title stats (see public/modules/titles.js), worked out only
    // when a title needs it: ranking lists check just each equipped title.
    titleStat(profile, stat) {
      const pid = profile?.id, key = `${pid}|${stat}`;
      if (statCache.has(key)) return statCache.get(key);
      const value = STATS[stat] ? STATS[stat](profile, pid) : 0;
      statCache.set(key, value);
      return value;
    },
    titleStats(profile) { return Object.fromEntries(Object.keys(STATS).map(stat => [stat, ctx.titleStat(profile, stat)])); },
    unlocked(profile) { const stats = ctx.titleStats(profile); return TITLE_KEYS.filter(key => titleUnlocked(key, stats)); },
    // The equipped title when it is still held (limited titles end with their week), else 첫걸음.
    displayTitle(profile) {
      const key = profile?.avatar_title;
      return key && TITLES[key] && titleUnlocked(key, { [TITLES[key].stat]: ctx.titleStat(profile, TITLES[key].stat) }) ? key : 'rookie';
    },
    // Classmates one can play: same school and grade, with a pet (and always oneself).
    leagueMembers(profile) {
      const school = schoolOf(profile), grade = gradeOf(profile?.class_name);
      return [...profiles.values()].filter(x => isRankedStudent(x) && (x.pets?.length || x.id === profile.id) && schoolOf(x) === school && gradeOf(x.class_name) === grade);
    }
  };
  return ctx;
}

// Last week's 경험치 top 3 of each grade, and the yacha league leader of each school + grade
// (with at least three wins' worth of points). Ties share the place.
export const LEAGUE_KING_MIN_POINTS = 9;
function weeklyAwards(ctx, state) {
  const { start, end } = ctx.lastWeek;
  const students = (state.profiles || []).filter(isRankedStudent);
  const byGrade = new Map();
  for (const p of students) {
    const xp = ctx.sessionsOf(p.id).filter(s => s.created_at >= start && s.created_at < end).reduce((n, s) => n + Number(s.xp || 0), 0);
    if (xp > 0) push(byGrade, rankGrade(p), { id: p.id, xp });
  }
  const weeklyRank = new Map();
  for (const list of byGrade.values()) {
    for (const entry of list) {
      const rank = 1 + list.filter(other => other.xp > entry.xp).length;
      if (rank <= 3) weeklyRank.set(entry.id, rank);
    }
  }
  const groups = new Map();
  for (const p of students) if (p.pets?.length) push(groups, `${schoolOf(p)}|${gradeOf(p.class_name)}`, p);
  const leagueKings = new Set();
  for (const members of groups.values()) {
    const points = members.map(p => ({ id: p.id, points: ctx.league(p.id, ctx.lastWeek).points }));
    const top = Math.max(0, ...points.map(x => x.points));
    if (top >= LEAGUE_KING_MIN_POINTS) points.filter(x => x.points === top).forEach(x => leagueKings.add(x.id));
  }
  return { weeklyRank, leagueKings };
}

// League table of a student's school + grade. week: this week's counted matches and points;
// all: every match ever (the raw record), sorted by wins.
export function leagueStandings(ctx, profile, period = 'week') {
  const rows = ctx.leagueMembers(profile).map(x => {
    const me = x.id === profile.id, hidden = !me && isPrivate(x);
    const pet = hidden ? null : petProgress(x.pets || [], ctx.sessionsOf(x.id), x.avatar_key).find(item => item.active) || null;
    let line;
    if (period === 'all') {
      const all = ctx.battlesOf(x.id);
      const wins = all.filter(b => b.winner === x.id).length, losses = all.filter(b => b.loser === x.id).length, draws = all.length - wins - losses;
      line = { wins, losses, draws, played: all.length, win_rate: all.length ? Math.round(wins / all.length * 100) : null, best_streak: battleStreaks(all, x.id).best_streak, score: wins };
    } else {
      const lg = ctx.league(x.id);
      line = { ...lg, tier: lg.tier.key, score: lg.points };
    }
    return {
      id: hidden ? null : x.id, is_me: me, private: hidden,
      name: hidden ? '비공개 학생' : x.display_name,
      class_name: x.class_name || '',
      pet: pet ? { key: pet.key, form: pet.form } : null,
      title: hidden ? null : ctx.displayTitle(x),
      ...line
    };
  });
  rows.sort((a, b) => b.score - a.score || b.wins - a.wins || (b.win_rate ?? -1) - (a.win_rate ?? -1) || b.played - a.played || String(a.name).localeCompare(String(b.name), 'ko'));
  for (const row of rows) row.rank = row.score > 0 ? 1 + rows.filter(other => other.score > row.score).length : null;
  return rows;
}
