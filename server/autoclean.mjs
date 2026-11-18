// V13.244 자동 정리(docs/server-audit-2026-11.md). 원칙: 안전한 것만 자동으로 지우고, 중요한 것은 옮기기만 하고, 내역은 항상 보이게.
//   - 상태의 묶음(server/perf-budget.mjs STATE_BUDGET_KB)마다 "넘으면 무엇부터 정리하는지"를 PRUNE_RULES에 적는다.
//     규칙이 없는 묶음이 있으면 검사(server/autoclean-check.mjs)가 실패한다.
//   - 묶음이 예산의 70%를 넘으면 오래된 것부터 조금씩(한 번에 200개), 90%를 넘으면 더 세게(보관 기간을 줄이고 한 번에 600개) 지운다.
//   - 지우는 것은 kind가 'prune'인 묶음의 "끝난 · 취소된 · 지난" 줄뿐이다. 학생 계정 · 성적 · 숙련도 · 펫 · 코인 기록 · 단어장은
//     kind 'keep'(절대 자동으로 안 지움) 또는 'move'(보관 표로 옮기기만: server/session-archive.mjs)라서 이 파일이 손대지 않는다.
//   - 한 번에 조금씩: 전체 상태를 훑지 않는다. 크기는 'prune' 묶음만 잰다(작은 묶음들). 워커는 10분에 한 번, 쓰기 한도가 'ok'일 때만 부른다.
//   - 내역: state.autoclean.log에 최근 20줄(무엇을 몇 개, 언제). 선생님 화면 한 줄 · /api/health에 보인다.
import { STATE_BUDGET_KB } from './perf-budget.mjs';

const H = 3600000, DAY = 24 * H;
export const AUTOCLEAN = {
  WARN_PCT: 70, HARD_PCT: 90,          // 1단계 · 2단계
  STEP: [200, 600],                     // 한 번에 지우는 줄 수(단계별)
  EVERY_MS: 10 * 60000,                 // 워커가 살펴보는 간격
  LOG_KEEP: 20,                         // 내역 줄 수(고정 크기)
  WEEK_MS: 7 * DAY
};

// 배열 묶음 규칙: time(줄) → 그 줄이 끝난 시각(지워도 되는 줄만 숫자, 아니면 null). keep: [1단계, 2단계] 보관 기간(ms).
const rows = (key, time, keep) => ({
  pick(state, now, tier) {
    const list = Array.isArray(state[key]) ? state[key] : [];
    return list.map(x => ({ x, at: time(x, state) })).filter(r => r.at !== null && Number.isFinite(r.at) && now - r.at >= keep[tier - 1]).sort((a, b) => a.at - b.at).map(r => r.x);
  },
  drop(state, gone) { state[key] = state[key].filter(x => !gone.has(x)); }
});
const doneAt = x => Number(x.finished_at || x.created_at || 0);

// kind: 'prune' 자동으로 지움 · 'move' 옮기기만(지우지 않음) · 'keep' 절대 자동으로 안 지움 · 'fixed' 이미 크기가 정해져 있음 · 'ask' 선생님께 물을 것
export const PRUNE_RULES = {
  // ---- 절대 자동으로 지우지 않는 것 ----
  sessions: { kind: 'move', label: '연습 기록', note: '일주일 지난 답 상세만 보관 표로 옮긴다(session-archive.mjs). 요약은 그대로 둔다.' },
  mastery: { kind: 'keep', label: '숙련도', note: '학생 학습 결과.' },
  profiles: { kind: 'keep', label: '학생 계정 · 펫 · 코인 · 칭호', note: '안쪽 목록(출석 · 뽑기 기록)은 tidyProfileLogs가 개수 상한으로 줄인다.' },
  examAttempts: { kind: 'keep', label: '시험 응시', note: '성적. 선생님이 보관 파일을 받은 뒤 하는 수동 정리만(storage-trim.mjs).' },
  examAttemptArchive: { kind: 'keep', label: '다시 보게 한 시험의 옛 응시', note: '성적 기록.' },
  exams: { kind: 'keep', label: '시험', note: '선생님이 만든 것.' },
  grammarProgress: { kind: 'keep', label: '문법 진도', note: '학생 학습 결과.' },
  meaningAliases: { kind: 'keep', label: '허용 뜻', note: '선생님이 정한 것.' },
  meaningAliasMeta: { kind: 'keep', label: '허용 뜻 기록', note: '선생님이 정한 것.' },
  extraBooks: { kind: 'keep', label: '선생님 단어장', note: '선생님이 올린 것.' },
  assignments: { kind: 'keep', label: '과제', note: '선생님이 만든 것.' },
  signupCodes: { kind: 'keep', label: '가입 코드', note: '반마다 하나.' },
  schools: { kind: 'keep', label: '학교', note: '설정.' },
  battleSettings: { kind: 'keep', label: '야차전 설정', note: '설정.' },
  market: { kind: 'keep', label: '문법 증권거래소', note: '설정 · 시세 씨앗(크기 고정).' },
  // ---- 선생님께 물을 것(지우지 않는다) ----
  dungeon_boards: { kind: 'ask', label: '던전 기록 보드', note: '역대 기록이 들어 있다. 보드마다 상위 줄만 남아 크기는 거의 고정.' },
  // ---- 이미 크기가 정해진 것(자기 규칙으로 줄어든다) ----
  practices: { kind: 'fixed', label: '진행 중 연습', note: '끝난 것은 10분 뒤, 방치된 것은 sweep이 닫는다.' },
  tokens: { kind: 'fixed', label: '로그인 세션', note: '만료된 것은 sweep이 지운다. 살아 있는 것은 지우면 로그아웃된다.' },
  rewardEvents: { kind: 'fixed', label: '코인 이벤트', note: '끝나고 60일 뒤 지운다(reward-events.mjs).' },
  timingDaily: { kind: 'fixed', label: '10초 맞추기 오늘의 챌린지', note: '지난 14일만.' },
  arenaInvites: { kind: 'fixed', label: '아레나 친구 대전 방', note: '대기 5분 · 찬 방 30분 · 최대 120개.' },
  storageTrims: { kind: 'fixed', label: '수동 정리 내역', note: '최근 20줄.' },
  storageAutoTrim: { kind: 'fixed', label: '옛 자동 정리 표시', note: '한 줄.' },
  sessionArchive: { kind: 'fixed', label: '옮기기 기록', note: '한 줄.' },
  autoclean: { kind: 'fixed', label: '자동 정리 내역', note: '최근 20줄.' },
  schema_version: { kind: 'fixed', label: '버전 숫자', note: '숫자 하나.' },
  test_seed: { kind: 'fixed', label: '테스트 앱', note: '테스트 앱에서만.' },
  test_gifts: { kind: 'fixed', label: '테스트 앱', note: '테스트 앱에서만.' },
  // ---- 자동으로 지우는 것(끝난 · 취소된 · 지난 것만) ----
  meaningDisputes: { kind: 'prune', label: '처리된 이의 신청', note: '처리 끝난 것만(재채점은 이미 기록에 반영됨). 기다리는 것은 그대로.',
    ...rows('meaningDisputes', d => d.status === 'pending' ? null : Number(d.resolved_at || d.created_at || 0), [90 * DAY, 30 * DAY]) },
  battles: { kind: 'prune', label: '취소된 야차전 방', note: '취소된 방만. 끝난 대결은 전적 · 코인 계산에 쓰여 지우지 않는다.',
    ...rows('battles', b => b.status === 'cancelled' ? doneAt(b) : null, [2 * DAY, 6 * H]) },
  tournaments: { kind: 'prune', label: '취소된 대회', note: '취소된 것만. 끝난 대회는 우승 · 상금 기록이라 지우지 않는다.',
    ...rows('tournaments', t => t.status === 'cancelled' ? doneAt(t) : null, [2 * DAY, 6 * H]) },
  dungeons: { kind: 'prune', label: '끝난 던전 방', note: '끝난 · 취소된 방(보상 · 기록은 학생 프로필과 기록 보드에 이미 있다).',
    ...rows('dungeons', d => d.status === 'open' ? null : doneAt(d), [3 * DAY, DAY]) },
  parties: { kind: 'prune', label: '끝난 교실 게임 방', note: '정산이 끝난 방(코인은 이미 학생에게 갔다). 정산을 기다리는 방은 하루 뒤.',
    ...rows('parties', (x, _s) => x.status === 'open' ? null : Number(x.created_at || 0) + (x.settled ? 0 : DAY), [2 * DAY, 12 * H]) },
  clawNews: { kind: 'prune', label: '지난 인형뽑기 소식', note: '하루 지나 화면에 안 보이는 소식.',
    ...rows('clawNews', n => Number(n.at || 0), [DAY, DAY]) },
  arenaTeams: { kind: 'prune', label: '오래된 아레나 친구 팀', note: '오래 안 쓴 친구 팀(다음 판에 다시 올라온다).',
    ...rows('arenaTeams', x => Number(x.at || 0), [14 * DAY, 7 * DAY]) },
  runnerRaid: { kind: 'prune', label: '지난 반 보스', note: '이번 주가 아닌 묶음(보상 여부는 학생 프로필에 있다). 2단계는 지난주 한 줄(p)도 비운다.',
    pick(state, now, tier) {
      const bucket = state.runnerRaid && typeof state.runnerRaid === 'object' ? state.runnerRaid : {};
      const live = Math.max(0, ...Object.values(bucket).map(e => Number(e?.w || 0)));
      // 가장 새 주(이번 주)가 아닌 묶음. 2단계는 이번 주 묶음에 붙은 지난주 한 줄도.
      const old = Object.keys(bucket).filter(k => now - Number(bucket[k]?.w || 0) >= 14 * DAY || (tier > 1 && Number(bucket[k]?.w || 0) < live)).map(k => ({ k }));
      const lines = tier > 1 ? Object.keys(bucket).filter(k => bucket[k]?.p && !old.some(o => o.k === k)).map(k => ({ k, p: true })) : [];
      return [...old, ...lines];
    },
    drop(state, gone) {
      const next = { ...state.runnerRaid };
      for (const g of gone) { if (g.p) next[g.k] = { ...next[g.k], p: null }; else delete next[g.k]; }
      state.runnerRaid = next;
    } },
  push: { kind: 'prune', label: '오래된 알림 · 소식', note: '보이는 기간(공지 3일 · 전설 소식 2일)이 지난 것만. 최근 공지 5개 · 알림 설정 · 폰 등록은 그대로.',
    pick(state, now, tier) {
      const push = state.push && typeof state.push === 'object' ? state.push : {};
      const keepN = [14 * DAY, 3 * DAY][tier - 1], keepL = [7 * DAY, 2 * DAY][tier - 1];
      const notices = Array.isArray(push.notices) ? push.notices : [], legends = Array.isArray(push.legends) ? push.legends : [];
      const recent = new Set(notices.slice(-5));
      return [...notices.filter(n => !recent.has(n) && now - Number(n.at || 0) >= keepN), ...legends.filter(n => now - Number(n.at || 0) >= keepL)].sort((a, b) => Number(a.at || 0) - Number(b.at || 0));
    },
    drop(state, gone) {
      const push = { ...state.push };
      if (Array.isArray(push.notices)) push.notices = push.notices.filter(n => !gone.has(n));
      if (Array.isArray(push.legends)) push.legends = push.legends.filter(n => !gone.has(n));
      state.push = push;
    } }
};

export const PRUNE_KEYS = Object.keys(PRUNE_RULES).filter(key => PRUNE_RULES[key].kind === 'prune');
const kbOf = value => value === undefined ? 0 : JSON.stringify(value).length / 1024;
const tierOf = pct => pct >= AUTOCLEAN.HARD_PCT ? 2 : pct >= AUTOCLEAN.WARN_PCT ? 1 : 0;

// 'prune' 묶음만 잰다(작은 묶음들이라 가볍다: 큰 묶음 sessions · mastery · profiles는 재지 않는다).
export function pruneSizes(state) {
  return Object.fromEntries(PRUNE_KEYS.map(key => [key, Math.round(kbOf(state[key]) * 10) / 10]));
}

// 드라이런: 지금 정리하면 무엇이 몇 개 · 몇 KB 줄어드는지 세기만 한다(아무것도 바꾸지 않는다).
export function autocleanPlan(state, now = Date.now(), sizes = pruneSizes(state)) {
  const bundles = [];
  for (const key of PRUNE_KEYS) {
    const budget = STATE_BUDGET_KB[key], kb = Number(sizes[key] || 0), pct = Math.round(kb / budget * 100), tier = tierOf(pct);
    if (!tier) continue;
    const found = PRUNE_RULES[key].pick(state, now, tier);
    bundles.push({ key, label: PRUNE_RULES[key].label, kb, budget, pct, tier, items: found.length, free_kb: Math.round(found.reduce((n, x) => n + kbOf(x), 0) * 10) / 10 });
  }
  return { at: now, bundles, items: bundles.reduce((n, b) => n + b.items, 0), free_kb: Math.round(bundles.reduce((n, b) => n + b.free_kb, 0) * 10) / 10 };
}

// 한 차례 정리: 70%를 넘은 묶음에서 오래된 것부터 단계별 한도만큼 지우고 내역 한 줄을 남긴다. 지운 것이 없으면 null(상태를 안 바꾼다).
export function autocleanStep(state, now = Date.now(), { sizes = pruneSizes(state) } = {}) {
  const done = [];
  let more = false;
  for (const key of PRUNE_KEYS) {
    const tier = tierOf(Number(sizes[key] || 0) / STATE_BUDGET_KB[key] * 100);
    if (!tier) continue;
    const rule = PRUNE_RULES[key], found = rule.pick(state, now, tier), limit = AUTOCLEAN.STEP[tier - 1];
    if (!found.length) continue;
    const gone = new Set(found.slice(0, limit));
    if (found.length > limit) more = true;
    const kb = Math.round([...gone].reduce((n, x) => n + kbOf(x), 0) * 10) / 10;
    rule.drop(state, gone);
    done.push({ k: key, n: gone.size, kb, t: tier });
  }
  if (!done.length) return null;
  const prev = state.autoclean && typeof state.autoclean === 'object' ? state.autoclean : {};
  const entry = { at: now, d: done };
  Object.defineProperty(entry, 'more', { value: more, enumerable: false });
  state.autoclean = {
    at: now, more,
    log: [...(Array.isArray(prev.log) ? prev.log : []), entry].slice(-AUTOCLEAN.LOG_KEEP),
    total: { n: Number(prev.total?.n || 0) + done.reduce((n, d) => n + d.n, 0), kb: Math.round((Number(prev.total?.kb || 0) + done.reduce((n, d) => n + d.kb, 0)) * 10) / 10 }
  };
  return entry;
}

// 워커가 살펴볼 때인가: 지난 차례에 남은 것이 있었으면(more) 10분 뒤, 없으면 한 시간에 한 번.
export function autocleanDue(more, now, lastAt) {
  const gap = now - Number(lastAt || 0);
  return gap < 0 || gap >= (more ? AUTOCLEAN.EVERY_MS : 6 * AUTOCLEAN.EVERY_MS);
}

// 선생님 화면 한 줄 · health: 최근 7일 내역을 묶음별로 더한다. 정리한 것이 없으면 text는 빈 글자.
export function autocleanSummary(state, now = Date.now()) {
  const log = Array.isArray(state.autoclean?.log) ? state.autoclean.log : [];
  const sum = new Map();
  let kb = 0;
  for (const e of log) if (now - Number(e.at || 0) < AUTOCLEAN.WEEK_MS) for (const d of e.d || []) { sum.set(d.k, (sum.get(d.k) || 0) + Number(d.n || 0)); kb += Number(d.kb || 0); }
  const parts = [...sum].sort((a, b) => b[1] - a[1]).map(([k, n]) => `${PRUNE_RULES[k]?.label || k} ${n.toLocaleString('ko-KR')}개`);
  return { text: parts.length ? `이번 주 자동 정리: ${parts.join(' · ')}` : '', items: [...sum.values()].reduce((n, v) => n + v, 0), kb: Math.round(kb), last_at: Number(state.autoclean?.at || 0) || null, more: !!state.autoclean?.more };
}

// health용: 내역(최근 20줄) + 드라이런 + 규칙 요약.
export function autocleanReport(state, now = Date.now()) {
  const plan = autocleanPlan(state, now);
  return {
    week: autocleanSummary(state, now),
    total: state.autoclean?.total || { n: 0, kb: 0 },
    log: (state.autoclean?.log || []).map(e => ({ at: e.at, text: (e.d || []).map(d => `${PRUNE_RULES[d.k]?.label || d.k} ${d.n}개(${d.kb}KB${d.t > 1 ? ' · 세게' : ''})`).join(' · ') })),
    dry_run: { items: plan.items, free_kb: plan.free_kb, bundles: plan.bundles },
    rules: { warn_pct: AUTOCLEAN.WARN_PCT, hard_pct: AUTOCLEAN.HARD_PCT, auto: PRUNE_KEYS, never: Object.keys(PRUNE_RULES).filter(k => ['keep', 'move', 'ask'].includes(PRUNE_RULES[k].kind)) }
  };
}

// ---- 요청 수 자동 조절 ----
// 하루 쓰기(줄) 또는 요청 수가 무료 한도의 70%를 넘으면 화면의 자동 새로고침을 2배, 90%를 넘으면 4배 느리게 한다.
// 화면은 기본 간격에 이 배수를 곱하기만 한다(1 미만은 없다: 3초 아래로는 절대 안 내려간다).
export const POLL_SCALES = [1, 2, 4];
export function pollScale({ writePct = 0, requestPct = 0 } = {}) {
  const pct = Math.max(Number(writePct) || 0, Number(requestPct) || 0);
  return pct >= AUTOCLEAN.HARD_PCT ? POLL_SCALES[2] : pct >= AUTOCLEAN.WARN_PCT ? POLL_SCALES[1] : POLL_SCALES[0];
}
