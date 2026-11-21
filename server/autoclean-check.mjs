// V13.244 자동 정리 검사(npm run check, server/autoclean.mjs). 모의 데이터로 "지워야 할 것만 지우고 중요한 것은 그대로"를 본다.
//   1. 예산표(perf-budget.mjs)의 모든 묶음에 정리 규칙이 있다(없으면 실패). 중요한 묶음은 'keep' · 'move'다.
//   2. 예산 70% 아래면 아무것도 안 한다. 70%를 넘으면 오래된 것부터 한도만큼, 90%를 넘으면 더 세게.
//   3. 규칙마다: 끝난 · 취소된 · 지난 것만 지우고, 기다리는 이의 신청 · 끝난 대결(전적 · 코인) · 열린 방 · 최근 공지는 그대로.
//   4. 중요한 묶음(계정 · 성적 · 숙련도 · 펫 · 코인 · 단어장 …)은 한 글자도 안 바뀐다.
//   5. 드라이런은 아무것도 안 바꾸고, 실제 정리와 개수가 같다. 내역은 최근 20줄 · 예산 안.
//   6. 요청 수 자동 조절 배수는 1 · 2 · 4뿐이다(간격을 줄이는 길이 없다).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { STATE_BUDGET_KB } from './perf-budget.mjs';
import { emptyState } from './state.mjs';
import { PRUNE_RULES, PRUNE_KEYS, AUTOCLEAN, autocleanPlan, autocleanStep, autocleanDue, autocleanSummary, autocleanReport, pruneSizes, pollScale } from './autoclean.mjs';

const source = path => readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8');
const DAY = 86400000, H = 3600000;
const PROTECTED = ['sessions', 'mastery', 'profiles', 'examAttempts', 'examAttemptArchive', 'exams', 'grammarProgress', 'meaningAliases', 'meaningAliasMeta', 'extraBooks', 'assignments', 'signupCodes', 'schools', 'battleSettings', 'market', 'dungeon_boards'];
const pad = 'x'.repeat(900);   // 한 줄 약 1KB

// 중요한 것 + 지워도 되는 것이 섞인 모의 상태. big: 그 묶음을 예산의 pct%쯤으로 부풀린다.
export function mockState(now, big = {}) {
  const s = emptyState();
  const fill = (key, make) => Array.from({ length: Math.ceil(STATE_BUDGET_KB[key] * (big[key] || 0) / 100) }, (_, i) => make(i));
  s.profiles.push({ id: 'st1', role: 'student', display_name: '학생', pets: [{ key: 'dog', form: 2 }], points_spent: 30, titles_seen: ['a'], games: { runner: { rw: { w: 1 } } }, eggs: [{ k: 'hero' }] });
  s.sessions.push({ id: 'ss1', student_id: 'st1', total: 30, correct: 24, score: 80, reward_points: 12, created_at: now - 200 * DAY, answer_records: [{ word_id: 'w', correct: true }] });
  s.mastery.st1 = { w1: { mastery: 60 } };
  s.exams.push({ id: 'ex1', title: '중간고사' });
  s.examAttempts.push({ id: 'ea1', exam_id: 'ex1', student_id: 'st1', status: 'submitted', score: 90, submitted_at: now - 300 * DAY });
  s.examAttemptArchive = [{ id: 'ea0', score: 70, archived_at: now - 300 * DAY }];
  s.grammarProgress.st1 = { u1: 3 };
  s.meaningAliases.w1 = ['뜻']; s.meaningAliasMeta.w1 = [{ value: '뜻', created_at: 1 }];
  s.extraBooks.push({ id: 'book1', words: [{ id: 'w1', word: 'apple' }] });
  s.assignments.push({ id: 'as1', active: true, created_at: now - 300 * DAY });
  s.dungeon_boards = { 'high:max:2': { all: [{ t: 1000, at: now - 300 * DAY }] } };
  s.meaningDisputes = [
    { id: 'wait-old', status: 'pending', created_at: now - 400 * DAY },
    { id: 'done-new', status: 'approved', resolved_at: now - 5 * DAY, created_at: now - 6 * DAY },
    { id: 'done-40', status: 'rejected', resolved_at: now - 40 * DAY, created_at: now - 41 * DAY },
    ...fill('meaningDisputes', i => ({ id: 'done-old-' + i, status: 'approved_auto', resolved_at: now - (100 + i % 50) * DAY, created_at: now - 200 * DAY, pad }))
  ];
  s.battles = [
    { id: 'fin-old', status: 'finished', stake: 50, host_id: 'st1', winner: 'st1', finished_at: now - 300 * DAY, created_at: now - 300 * DAY },
    { id: 'live', status: 'active', created_at: now - 60000 },
    { id: 'cancel-new', status: 'cancelled', finished_at: now - H, created_at: now - H },
    { id: 'cancel-1d', status: 'cancelled', finished_at: now - DAY, created_at: now - DAY },
    ...fill('battles', i => ({ id: 'cancel-old-' + i, status: 'cancelled', finished_at: now - 3 * DAY - i, created_at: now - 3 * DAY - i, pad }))
  ];
  s.tournaments = [{ id: 't-fin', status: 'finished', finished_at: now - 300 * DAY, players: [] }, { id: 't-live', status: 'active', players: [] },
    ...fill('tournaments', i => ({ id: 't-cancel-' + i, status: 'cancelled', finished_at: now - 5 * DAY, players: [], pad }))];
  s.dungeons = [{ id: 'd-open', status: 'open', created_at: now - 60000 }, { id: 'd-new', status: 'finished', finished_at: now - H, created_at: now - H },
    ...fill('dungeons', i => ({ id: 'd-old-' + i, status: i % 2 ? 'finished' : 'cancelled', finished_at: now - 4 * DAY, created_at: now - 4 * DAY, pad }))];
  s.parties = [{ id: 'p-open', status: 'open', created_at: now - 60000 }, { id: 'p-unsettled', status: 'expired', created_at: now - 2.5 * DAY },
    ...fill('parties', i => ({ id: 'p-old-' + i, status: 'finished', settled: true, created_at: now - 5 * DAY, pad }))];
  s.clawNews = [{ id: 'n-new', at: now - H }, ...fill('clawNews', i => ({ id: 'n-old-' + i, at: now - 2 * DAY, pad }))];
  s.arenaTeams = [{ k: 'a|1', p: 'st1', at: now - DAY }, ...fill('arenaTeams', i => ({ k: 'a|1', p: 'old' + i, at: now - 20 * DAY, pad }))];
  const week = now - 2 * DAY;
  s.runnerRaid = { live: { w: week, hp: 100, d: 5, n: 1, p: { w: week - 7 * DAY, d: 9 } }, ...Object.fromEntries(fill('runnerRaid', i => ['old' + i, { w: week - 21 * DAY, hp: 1, d: 1, pad }])) };
  s.push = { vapid: { k: 1 }, subject: 'https://x', subs: { st1: [{ endpoint: 'e' }] }, prefs: { st1: { daily: false } }, reminded: { st1: '2026-11-01' },
    notices: [...fill('push', i => ({ id: 'no-old-' + i, at: now - 30 * DAY - i, pad })), ...Array.from({ length: 6 }, (_, i) => ({ id: 'no-recent-' + i, at: now - (40 - i) * DAY }))],
    legends: [{ id: 'lg-old', at: now - 30 * DAY }, { id: 'lg-new', at: now - H }] };
  return s;
}
const ids = list => new Set((list || []).map(x => x.id));
const snap = (s, keys) => JSON.stringify(keys.map(k => s[k]));

export function runAutocleanChecks(assert, finalKeys = []) {
  const now = Date.UTC(2026, 10, 18, 3);
  // 1. 모든 묶음에 규칙.
  const keys = new Set([...Object.keys(STATE_BUDGET_KB), ...Object.keys(emptyState()), ...finalKeys]);
  const missing = [...keys].filter(k => !PRUNE_RULES[k]);
  const extra = Object.keys(PRUNE_RULES).filter(k => STATE_BUDGET_KB[k] === undefined);
  assert(!missing.length && !extra.length, `V13.244 예산표의 모든 묶음에 정리 규칙(server/autoclean.mjs PRUNE_RULES)이 있다: 빠진 묶음 ${missing.join(', ')} · 예산 없는 규칙 ${extra.join(', ')}`);
  const kinds = ['prune', 'move', 'keep', 'fixed', 'ask'];
  assert(Object.values(PRUNE_RULES).every(r => kinds.includes(r.kind) && r.label && r.note && (r.kind !== 'prune' || (typeof r.pick === 'function' && typeof r.drop === 'function')) && (r.kind === 'prune' || !r.pick)), 'V13.244 규칙마다 종류 · 이름 · 설명이 있고, 지우는 함수는 자동 정리 묶음에만 있다');
  assert(PROTECTED.every(k => ['keep', 'move', 'ask'].includes(PRUNE_RULES[k].kind)) && PRUNE_RULES.sessions.kind === 'move' && !PRUNE_KEYS.some(k => PROTECTED.includes(k)),
    'V13.244 학생 계정 · 성적 · 시험 · 숙련도 · 펫 · 코인 · 칭호 · 단어장 · 허용 뜻은 자동으로 지우는 묶음이 아니다(연습 기록은 옮기기만)');

  // 2. 예산 아래면 조용.
  const calm = mockState(now);
  const calmBefore = JSON.stringify(calm);
  assert(autocleanPlan(calm, now).items === 0 && autocleanStep(calm, now) === null && JSON.stringify(calm) === calmBefore && calm.autoclean === undefined, 'V13.244 예산 70% 아래면 자동 정리는 아무것도 바꾸지 않는다(내역도 안 쓴다)');

  // 3 · 4 · 5. 1단계(70%를 넘음): 모든 자동 정리 묶음을 80%쯤으로.
  const warm = mockState(now, Object.fromEntries(PRUNE_KEYS.map(k => [k, 80])));
  const guard = snap(warm, PROTECTED), warmAll = JSON.stringify(warm);
  const plan = autocleanPlan(warm, now);
  assert(JSON.stringify(warm) === warmAll && plan.bundles.length === PRUNE_KEYS.length && plan.bundles.every(b => b.tier === 1 && b.items > 0 && b.free_kb > 0), `V13.244 드라이런은 아무것도 바꾸지 않고 묶음마다 지울 개수 · KB를 센다(${plan.bundles.map(b => `${b.key} ${b.items}`).join(', ')})`);
  // 규칙마다: 무엇을 고르는가(1단계 · 2단계). 고른 것만 지워진다.
  const picked = (key, tier) => PRUNE_RULES[key].pick(warm, now, tier);
  const pid = (key, tier) => new Set(picked(key, tier).map(x => x.id ?? x.k ?? x.p));
  const d1 = pid('meaningDisputes', 1), d2 = pid('meaningDisputes', 2);
  assert(!d1.has('wait-old') && !d1.has('done-new') && !d1.has('done-40') && d1.has('done-old-0') && d2.has('done-40') && !d2.has('done-new') && !d2.has('wait-old'), 'V13.244 이의 신청: 처리 끝나고 90일(세게: 30일) 지난 것만 고른다(기다리는 것은 400일이 돼도 그대로)');
  const b1 = pid('battles', 1), b2 = pid('battles', 2);
  assert(!b1.has('fin-old') && !b1.has('live') && !b1.has('cancel-new') && !b1.has('cancel-1d') && b1.has('cancel-old-0') && b2.has('cancel-1d') && !b2.has('cancel-new') && !b2.has('fin-old') && !b2.has('live'), 'V13.244 야차전: 취소되고 이틀(세게: 6시간) 지난 방만 고른다(끝난 대결 = 전적 · 코인 기록은 그대로)');
  assert([1, 2].every(t => !pid('tournaments', t).has('t-fin') && !pid('tournaments', t).has('t-live') && pid('tournaments', t).has('t-cancel-0')), 'V13.244 대회: 취소된 것만 고른다(끝난 대회 = 우승 · 상금 기록은 그대로)');
  assert([1, 2].every(t => !pid('dungeons', t).has('d-open') && !pid('dungeons', t).has('d-new') && pid('dungeons', t).has('d-old-0')), 'V13.244 던전: 끝나고 3일(세게: 하루) 지난 방만 고른다(열린 방 · 방금 끝난 방은 그대로)');
  assert(!pid('parties', 1).has('p-open') && !pid('parties', 1).has('p-unsettled') && pid('parties', 1).has('p-old-0') && !pid('parties', 2).has('p-open') && pid('parties', 2).has('p-unsettled'), 'V13.244 교실 게임: 정산 끝나고 이틀 지난 방만 고른다(열린 방은 그대로, 정산을 못 받은 방은 하루 더 기다린다)');
  assert(!pid('clawNews', 1).has('n-new') && pid('clawNews', 1).has('n-old-0') && !picked('arenaTeams', 2).some(x => x.p === 'st1') && picked('arenaTeams', 1).some(x => x.p === 'old0'), 'V13.244 인형뽑기 소식 · 아레나 친구 팀: 지난 것만 고른다');
  const r1 = picked('runnerRaid', 1), r2 = picked('runnerRaid', 2);
  assert(!r1.some(x => x.k === 'live') && r1.some(x => x.k === 'old0') && r2.some(x => x.k === 'live' && x.p) && !r2.some(x => x.k === 'live' && !x.p), 'V13.244 반 보스: 2주 넘게 안 쓴 묶음만 고른다(세게: 지난주 한 줄도. 이번 주 숫자는 그대로)');
  const n1 = pid('push', 1), n2 = pid('push', 2);
  assert(n1.has('no-old-0') && n1.has('lg-old') && !n1.has('lg-new') && ![...n1, ...n2].some(id => String(id).startsWith('no-recent-') && Number(String(id).slice(10)) >= 1) && n2.has('no-recent-0') && !n2.has('lg-new'), 'V13.244 알림: 보이는 기간이 지난 공지 · 소식만 고른다(최근 공지 5개는 그대로)');

  // 한 차례씩 돌리기: 한도만큼만, 70% 아래로 내려가면 멈춘다.
  const before = Object.fromEntries(PRUNE_KEYS.map(k => [k, new Set(PRUNE_RULES[k].pick(warm, now, 2))]));
  let entry = autocleanStep(warm, now), rounds = 1;
  assert(entry.d.every(d => d.n <= AUTOCLEAN.STEP[0] && d.t === 1) && entry.d.find(d => d.k === 'meaningDisputes').n === AUTOCLEAN.STEP[0] && warm.autoclean.more === true, 'V13.244 한 차례에 묶음마다 200개까지만 지우고, 남으면 more로 다음 차례에 잇는다');
  while (rounds < 50 && autocleanStep(warm, now + rounds * AUTOCLEAN.EVERY_MS)) rounds++;
  const total = warm.autoclean.total.n, after = autocleanPlan(warm, now);
  assert(total > 0 && total <= plan.items && after.items === 0 && rounds < 20, `V13.244 드라이런(${plan.items}개)보다 더 지우지 않고(${total}개, ${rounds}차례), 70% 아래로 내려가거나 지울 것이 없으면 멈춘다`);
  assert(snap(warm, PROTECTED) === guard, 'V13.244 중요한 묶음(연습 기록 · 숙련도 · 프로필 · 시험 · 단어장 · 허용 뜻 · 과제 · 던전 기록 보드)은 자동 정리 뒤에도 한 글자도 안 바뀐다');
  const keepers = { meaningDisputes: ['wait-old', 'done-new', 'done-40'], battles: ['fin-old', 'live', 'cancel-new', 'cancel-1d'], tournaments: ['t-fin', 't-live'], dungeons: ['d-open', 'd-new'], parties: ['p-open', 'p-unsettled'], clawNews: ['n-new'] };
  assert(Object.entries(keepers).every(([k, list]) => list.every(id => ids(warm[k]).has(id))) && warm.arenaTeams.some(x => x.p === 'st1') && warm.runnerRaid.live.d === 5 && warm.runnerRaid.live.p?.d === 9, 'V13.244 실제로 돌린 뒤: 기다리는 이의 신청 · 끝난 대결 · 열린 방 · 새 소식 · 이번 주 반 보스는 남아 있다');
  const p = warm.push;
  assert(p.vapid.k === 1 && p.subs.st1.length === 1 && p.prefs.st1.daily === false && p.reminded.st1 && p.notices.slice(-5).every(n => n.id.startsWith('no-recent-')) && p.legends.some(n => n.id === 'lg-new'), 'V13.244 알림: 폰 등록 · 알림 설정 · 서버 열쇠 · 최근 공지 5개는 그대로다');
  void before;

  // 2단계(90%를 넘음): 보관 기간이 줄고 한 번에 더 많이.
  const hot = mockState(now, { meaningDisputes: 95, battles: 95, runnerRaid: 95 });
  const hotGuard = snap(hot, PROTECTED);
  const hotEntry = autocleanStep(hot, now);
  const hd = ids(hot.meaningDisputes), hb = ids(hot.battles);
  assert(hotEntry.d.every(x => x.t === 2 && x.n <= AUTOCLEAN.STEP[1]) && hotEntry.d.find(x => x.k === 'meaningDisputes').n === AUTOCLEAN.STEP[1] && hd.has('done-new') && hd.has('wait-old')
    && hb.has('cancel-new') && hb.has('fin-old') && hb.has('live') && hot.runnerRaid.live.p === null && hot.runnerRaid.live.d === 5 && snap(hot, PROTECTED) === hotGuard,
    'V13.244 90%를 넘으면 더 세게(한 번에 600개 · 반 보스 지난주 한 줄) 정리하되, 기다리는 것 · 끝난 대결 · 이번 주 보스 숫자 · 중요한 묶음은 그대로다');

  // 내역: 최근 20줄 · 예산 안 · 한 줄 요약.
  const logged = mockState(now);
  for (let i = 0; i < 30; i++) { logged.clawNews = Array.from({ length: 40 }, (_, k) => ({ id: `r${i}-${k}`, at: now - 3 * DAY, pad })); autocleanStep(logged, now + i * 1000); }
  const week = autocleanSummary(logged, now + 60000), report = autocleanReport(logged, now + 60000);
  assert(logged.autoclean.log.length === AUTOCLEAN.LOG_KEEP && logged.autoclean.total.n === 30 * 40 && JSON.stringify(logged.autoclean).length / 1024 < STATE_BUDGET_KB.autoclean
    && week.text === '이번 주 자동 정리: 지난 인형뽑기 소식 800개' && autocleanSummary(logged, now + 9 * DAY).text === '' && report.log.length === 20 && report.dry_run.items === 0 && report.rules.never.includes('profiles') && report.rules.auto.includes('battles'),
    `V13.244 정리 내역은 최근 20줄만 남고(${Math.round(JSON.stringify(logged.autoclean).length / 102.4) / 10}KB, 예산 ${STATE_BUDGET_KB.autoclean}KB) 선생님 화면 한 줄 · health 보고가 나온다`);
  assert(Object.keys(pruneSizes(warm)).join() === PRUNE_KEYS.join() && !PRUNE_KEYS.some(k => ['sessions', 'mastery', 'profiles'].includes(k)), 'V13.244 크기는 자동 정리 묶음만 잰다(큰 묶음 sessions · mastery · profiles를 훑지 않는다)');
  assert(autocleanDue(false, now, now - 61 * 60000) && !autocleanDue(false, now, now - 30 * 60000) && autocleanDue(true, now, now - 11 * 60000) && !autocleanDue(true, now, now - 5 * 60000), 'V13.244 살펴보는 간격: 평소 한 시간, 남은 것이 있으면 10분');

  // 6. 요청 수 자동 조절.
  const scales = [0, 50, 69.9, 70, 89.9, 90, 150].map(pct => pollScale({ writePct: pct }));
  assert(scales.join() === '1,1,1,2,2,4,4' && pollScale({ writePct: 10, requestPct: 75 }) === 2 && pollScale({ writePct: NaN, requestPct: -5 }) === 1 && pollScale() === 1, 'V13.244 자동 새로고침 배수: 쓰기 · 요청이 한도의 70%면 2배, 90%면 4배 느리게(1보다 작은 값은 없다)');

  // 연결: 워커 · 화면.
  const worker = source('../cloudflare/worker.mjs'), app = source('../public/app.js'), teacher = source('../public/modules/teacher.js');
  assert(worker.includes("this.writeLevel() === 'ok' && autocleanDue(") && worker.includes('this.ctx.waitUntil(this.mutations.durable(state => {') && worker.includes('const entry = autocleanStep(state, Date.now());') && worker.includes("this.env.VOCA_AUTOCLEAN !== 'off'"),
    'V13.244 워커: 쓰기 한도가 ok일 때만, 학생 답을 기다리게 하지 않고(waitUntil) 한 차례씩 정리한다(VOCA_AUTOCLEAN=off로 멈춤)');
  assert(worker.includes('result.storage.autoclean = autocleanReport(') && worker.includes('result.server_autoclean = { text: week.text') && worker.includes('result.poll_scale = scale') && worker.includes('requests_today'), 'V13.244 health에 정리 내역 · 드라이런 · 오늘 요청 수가, 선생님 첫 화면에 한 줄이, 첫 화면 · 초대 확인에 새로고침 배수가 나온다');
  assert(app.includes('Math.max(1, Math.min(4, Math.floor(Number(A.data?.poll_scale) || 1)))') && app.includes("pollSlow('invite')") && app.includes("pollSlow('refresh')") && app.includes("pollSlow('tournament')") && teacher.includes('server_autoclean') && teacher.includes('${serverAutoclean(d)}'),
    'V13.244 화면: 서버 배수만큼 자동 새로고침을 건너뛰고(1~4배, 빨라지는 길 없음), 선생님 화면에 정리 내역 한 줄을 보여 준다');
}
