// V13.212 렉 방지 예산(docs/performance-rules.md). 메인 상태 객체는 하나뿐이고 요청을 한 줄로 처리한다. 상태가 커지거나 요청마다
// 하는 일이 늘면 모든 학생이 함께 느려진다. 그래서 상태의 묶음(맨 위 키)마다 크기 예산을 두고, /api/health가 넘은 묶음을 알려 준다
// (state_budget). 새 묶음을 만들면 여기에 예산과 정리 방법을 적어야 검사(server/perf-rules-check.mjs)를 통과한다.
//
// 기준(2026-11-03 운영, 학생 약 45명): 전체 13.5MB · sessions 9.9MB · mastery 2.35MB · profiles 0.59MB.
// 예산은 학생이 약 두 배(90명)가 돼도 넘지 않을 만큼. 넘으면 정리 규칙을 손보거나 업그레이드를 검토한다.
export const STATE_TOTAL_BUDGET_KB = 25000;
export const STATE_BUDGET_KB = {
  sessions: 16000,          // 지난 연습 기록: 30일 지나면 답안 목록 자동 정리(storage-trim). 얼려 같이 쓴다(복사 안 함).
  mastery: 6000,            // 학생별 숙련도: 학생 묶음째 얼려 같이 쓴다(요청한 학생 것만 복사).
  profiles: 1500,           // 학생 프로필(펫 · 칭호 · 놀이터 기록): 활동 기록 · 본 칭호 등은 개수 상한을 둔다.
  meaningDisputes: 800,     // 이의 신청: 처리 끝난 것은 정리 대상.
  practices: 600,           // 진행 중 연습(끝난 것은 10분 뒤 지움).
  battles: 500,             // 야차전 방 기록(정리: 취소 1주).
  examAttempts: 500,
  examAttemptArchive: 300,
  grammarProgress: 400,
  meaningAliasMeta: 200,
  meaningAliases: 150,
  tokens: 150,              // 로그인 세션(만료 자동 정리).
  tournaments: 150,
  push: 150,
  dungeon_boards: 80,
  dungeons: 80,
  parties: 80,
  exams: 80,
  rewardEvents: 50,
  assignments: 50,
  extraBooks: 1500,         // 선생님이 올린 단어장.
  market: 30,
  clawNews: 30,             // 인형뽑기 반 소식: 개수 상한.
  timingDaily: 30,          // 10초 맞추기 오늘의 챌린지.
  signupCodes: 20,
  storageAutoTrim: 10,
  storageTrims: 30,
  battleSettings: 5,
  schools: 30,
  schema_version: 1,
  test_seed: 50,            // 테스트 앱(env.test)에서만.
  test_gifts: 50
};

// state_breakdown.keys_kb(server/state.mjs stateSizeReport)를 예산과 비교한다. unknown: 예산표에 없는 묶음(새로 생긴 것).
export function stateBudgetReport(keysKb = {}, totalKb = null) {
  const over = [], unknown = [];
  for (const [key, kb] of Object.entries(keysKb || {})) {
    const budget = STATE_BUDGET_KB[key];
    if (budget === undefined) unknown.push(key);
    else if (Number(kb) > budget) over.push({ key, kb: Number(kb), budget });
  }
  const total = Number(totalKb ?? Object.values(keysKb || {}).reduce((n, kb) => n + Number(kb || 0), 0));
  return { ok: !over.length && !unknown.length && total <= STATE_TOTAL_BUDGET_KB, total_kb: Math.round(total), total_budget_kb: STATE_TOTAL_BUDGET_KB, over, unknown };
}

// 보기(아무것도 바꾸지 않거나 그 학생 표시만 바꾸는) 요청처럼 보이는 POST 이름. 이런 POST는 READ_POSTS나 VIEW_POSTS
// (server/mutation-coordinator.mjs)에 넣거나, 아래 예외에 이유를 적는다.
export const VIEW_LIKE_POST = /\/(home|view|views|ping|board|status|list|guide|preview|peek|info|summary)$/;
export const VIEW_LIKE_POST_EXCEPTIONS = {
  '/teacher/student-preview': '선생님 미리보기 계정을 만든다(쓰기)',
  '/student-preview/exit': '미리보기를 끝내고 세션을 바꾼다(쓰기)',
  '/vocab-import/preview': '선생님 단어장 미리보기(큰 본문, 선생님만, 드묾)'
};

// V13.215 응답 크기 예산(KB, 운영 크기 상태 = server/tournament-load.mjs prodLikeState, 학생 44명 기준).
// 선생님 첫 화면은 느린 학교 와이파이(400kbps)에서도 10초 안에 받도록 400KB 아래로(예전 약 1,340KB). 탭을 열 때 받는 GET은 각각 작게.
// server/teacher-home-check.mjs(npm run check)가 잰다. 넘으면 첫 화면에 새 큰 목록을 싣지 말고 그 탭의 GET으로 옮긴다.
export const RESPONSE_BUDGET_KB = {
  teacher_bootstrap: 400,       // GET /api/bootstrap(선생님): 학생 목록(필요한 칸만) · 오늘 기록 · 학생별 숫자 · 단어장
  teacher_records: 40,          // GET /api/teacher/records: 결과 분석 한 쪽(30개, 최대 100개)
  teacher_student_detail: 20    // GET /api/teacher/student-detail/:id: 학생 기록 창(최근 연습 5개 · 시험범위 정복)
};

// 화면이 서버에 자동으로 묻는 간격(setInterval 안에서 api 호출)의 하한(ms).
export const POLL_MIN_MS = 3000;

// V13.212 업그레이드 · 정리 알림(/api/health storage.upgrade). 선생님이나 AI가 health 하나만 보고 판단할 수 있게.
//   paid_upgrade: Cloudflare 유료(Workers Paid, 최소 월 5달러)를 검토할 때. 무료 쓰기 한도(하루 10만 줄)의 70%를 넘었다.
//   fix_data: 업그레이드로는 안 풀리고 데이터 정리 규칙을 손봐야 할 때(상태 예산 초과 · 예산표에 없는 묶음).
// Durable Objects 요청 수(하루 10만 건 무료 한도)는 이 객체 안에서 셀 수 없다: Cloudflare 대시보드에서 본다(docs/performance-rules.md).
export const UPGRADE_WRITE_PCT = 70;
export function upgradeAdvice({ writePct = 0, budget = null } = {}) {
  const reasons = [];
  const paid = Number(writePct) >= UPGRADE_WRITE_PCT;
  if (paid) reasons.push(`오늘 저장량이 무료 한도의 ${Math.round(Number(writePct))}%예요. 이런 날이 일주일에 한 번 넘게 생기면 Cloudflare 유료 업그레이드(최소 월 5달러)를 하세요.`);
  const fix = !!budget && !budget.ok;
  if (fix) reasons.push(`데이터 예산을 넘었어요(${[...(budget.over || []).map(x => `${x.key} ${Math.round(x.kb)}/${x.budget}KB`), ...(budget.unknown || []).map(k => `${k}(예산 없음)`), budget.total_kb > budget.total_budget_kb ? `전체 ${budget.total_kb}/${budget.total_budget_kb}KB` : ''].filter(Boolean).join(', ')}). 업그레이드로는 안 풀려요: 정리 규칙을 손봐야 해요.`);
  return { paid_upgrade: paid, fix_data: fix, reasons };
}
