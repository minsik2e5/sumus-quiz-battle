// V13.149 연속 학습 보호권(Duolingo 스트릭 프리즈 방식). 화면과 서버가 같은 규칙을 쓴다.
//
// 학생 기록(p.streak_guard): { log: [{ at, src: 'buy' | 'attend' }], repairs: [{ at, day }] }
//   log      보호권을 받은 때(상점에서 사기 · 출석 7번째 도장). 쓴 기록은 따로 남기지 않는다.
//   repairs  '되살리기': 끊긴 다음 날 20문제를 풀어 어제 하루를 이은 기록(day = 이은 날, 한국 날짜 번호)
//
// 쓴 보호권은 저장하지 않고 공부한 날과 받은 기록으로 그때그때 계산한다(guardPlan). 그래서
//  - 빠진 날이 있으면 그날까지 받아 둔 보호권으로 메운다(한 장에 하루). 연속이 살아 있을 때만 쓴다.
//  - 빈칸을 다 메우지 못하면(사흘 빠졌는데 보호권 2장) 한 장도 쓰지 않는다: 보호권이 헛되이 사라지지 않는다.
//  - 오늘은 아직 공부할 수 있으니 판단하지 않는다.
// 보호권으로 이은 날은 연속 일수(홈 · 연속 학습 순위 · 연속 칭호)에 들어가고, 공부한 날 수 · 학습 기록에는 들어가지 않는다.

export const STREAK_GUARD = {
  MAX: 2,            // 한 번에 가질 수 있는 보호권
  PRICE: 120,        // 상점 가격(코인)
  REPAIR_NEED: 20,   // 되살리기: 끊긴 다음 날 이만큼 풀면
  REPAIR_MIN_RUN: 3, // 이만큼 이어 온 연속만 되살린다
  REPAIR_EVERY_DAYS: 30, // 되살리기는 30일에 한 번
  LOG_KEEP: 200
};

const DAY_MS = 86400000, KST_MS = 9 * 3600000;
// 한국 날짜 번호(1970-01-01부터 며칠째). dayKey(n * DAY_MS)가 그날의 'YYYY-MM-DD'다.
export const dayNum = ts => Math.floor((Number(ts) + KST_MS) / DAY_MS);
export const dayOfNum = n => new Date(n * DAY_MS).toISOString().slice(0, 10);
export const studyDayNums = sessions => new Set((sessions || []).filter(s => s.total > 0 && s.answered_count !== 0 && !s.bonus).map(s => dayNum(s.created_at)));

// study: 공부한 날 번호(Set). 돌려주는 것:
//   covered  공부한 날 + 보호권으로 이은 날 + 되살린 날(Set)
//   guarded  보호권으로 이은 날(오래된 순)   held  지금 가진 보호권
//   repair   되살리기를 할 수 있으면 { day, run, need }
export function guardPlan(study, g, now = Date.now()) {
  const today = dayNum(now);
  const repairs = (g?.repairs || []).filter(r => Number.isFinite(Number(r.day)));
  const covered = new Set(study);
  for (const r of repairs) covered.add(Number(r.day));
  const grants = (g?.log || []).map(x => dayNum(x.at)).filter(Number.isFinite).sort((a, b) => a - b);
  const guarded = [];
  let held = 0, gi = 0;
  const take = (upto, h, i) => { while (i < grants.length && grants[i] <= upto) { h = Math.min(STREAK_GUARD.MAX, h + 1); i++; } return [h, i]; };
  for (let d = grants.length ? grants[0] : today; d < today;) {
    [held, gi] = take(d, held, gi);
    if (covered.has(d) || !covered.has(d - 1)) { d++; continue; }
    // d부터 빈칸: 다음 공부한 날(또는 오늘) 앞까지.
    let end = d;
    while (end < today && !covered.has(end)) end++;
    let h = held, i = gi, ok = true;
    const used = [];
    for (let x = d; x < end; x++) {
      [h, i] = take(x, h, i);
      if (h > 0) { h--; used.push(x); } else { ok = false; break; }
    }
    if (ok) { for (const x of used) { covered.add(x); guarded.push(x); } held = h; gi = i; }
    d = end;
  }
  [held] = take(today, held, gi);
  // 되살리기: 어제가 비었고, 그 앞까지 3일 이상 이어 왔고, 30일 안에 되살린 적이 없을 때.
  let repair = null;
  const yesterday = today - 1;
  if (!covered.has(yesterday) && covered.has(yesterday - 1)) {
    let run = 0;
    for (let d = yesterday - 1; covered.has(d); d--) run++;
    const recent = repairs.some(r => now - Number(r.at || 0) < STREAK_GUARD.REPAIR_EVERY_DAYS * DAY_MS);
    if (run >= STREAK_GUARD.REPAIR_MIN_RUN && !recent) repair = { day: yesterday, run, need: STREAK_GUARD.REPAIR_NEED };
  }
  return { covered, guarded, held, repair, today };
}

// 연속 일수 계산에 더할 날('YYYY-MM-DD'): 보호권 · 되살리기로 이은 날.
export function guardDayNums(sessions, g, now = Date.now()) {
  if (!g?.log?.length && !g?.repairs?.length) return [];
  const study = studyDayNums(sessions), plan = guardPlan(study, g, now);
  return [...plan.covered].filter(d => !study.has(d));
}
export const guardDayKeys = (sessions, g, now = Date.now()) => guardDayNums(sessions, g, now).map(dayOfNum);

// 화면에 보내는 것.
export function guardView(sessions, g, now = Date.now()) {
  const plan = guardPlan(studyDayNums(sessions), g, now);
  const recent = plan.guarded.filter(d => d >= plan.today - 7).map(dayOfNum);
  return {
    held: plan.held, max: STREAK_GUARD.MAX, price: STREAK_GUARD.PRICE,
    used_total: plan.guarded.length, recent,
    saved_yesterday: plan.guarded.includes(plan.today - 1),
    repaired_today: (g?.repairs || []).some(r => dayNum(r.at) === plan.today),
    repair: plan.repair ? { day: dayOfNum(plan.repair.day), run: plan.repair.run, need: plan.repair.need } : null
  };
}
