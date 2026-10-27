// V13.180 검사: 10초 맞추기(놀이터, 2판: 이지 하나 · 하루 기본 3판 + 공부로 최대 5판 · ±1초부터 보상 · 딱 10.00 100코인).
// 서버 시간 비교(허용 오차 안 · 밖), 한 판 한 번, 하루 판 수 · 코인 상한 · 딱 10.00 하루 한 번 · 운 감시, 만료, 등급 경계값,
// 순위(미리보기 계정 제외 · 비공개 · 자기 줄 · 같은 학년대), 보상은 서버만, 시작 응답에 정답 시각 같은 필드 없음,
// 저장 크기 상한, 선생님 활동 기록 한 줄, 화면 · 소리 · 구성안. 시간은 모두 가짜 시각으로 돌려 빠르다(실제로 10초를 기다리지 않음).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { TIMING, GRADE_KEYS, gradeOf, errText, secText, ledDigits, dailyPlays, guardWindow } from '../public/modules/timing-rules.js';
import { TITLES, titleUnlocked, titleCoins, TITLE_COINS } from '../public/modules/titles.js';
import { SOUND_KEYS } from '../public/modules/sound.js';
import { dayKey } from '../public/modules/core.js';
import { grantTimingPlay, timingView, timingStart, timingFinish, timingBoard, timingLine } from './timing.mjs';
import { bonusRecords } from './rewards.mjs';
import { emptyState } from './state.mjs';
import { passwordHash, publicProfile } from './auth.mjs';
import { service } from './service.mjs';

const source = path => readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8');
const status = fn => { try { fn(); return 0; } catch (e) { return e.status || 500; } };
const DAY = 86400000;
const coinsOf = p => bonusRecords(p).reduce((n, r) => n + r.reward_points, 0);
const xpOf = p => bonusRecords(p).reduce((n, r) => n + r.xp, 0);
let seq = 0;
const pid = () => `tm-check-${String(++seq).padStart(4, '0')}`;
// 한 판: 서버가 잰 왕복 rtt, 화면이 잰 ms, 실제로 누른 때 real(기본 ms와 같음) → 끝 도착 = 시작 + 카운트다운 + real + rtt.
function play(p, { ms, real = ms, rtt = 100, at, result = 'press', id = pid() }) {
  timingStart(p, { id, echo: at - rtt, now: at });
  return timingFinish(p, { id, result, ms, now: at + TIMING.COUNTDOWN_MS + real + rtt });
}
// 오차가 정규분포(표준편차 sd ms)인 학생의 한 판 기대 코인(하루 상한 · 딱 10.00 하루 한 번 전).
const erf = x => { const t = 1 / (1 + .3275911 * Math.abs(x)), y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - .284496736) * t + .254829592) * t * Math.exp(-x * x); return x < 0 ? -y : y; };
const within = (ms, sd) => erf(ms / (sd * Math.SQRT2));
const perPlay = sd => { let prev = 0, ev = 0; for (const k of GRADE_KEYS.filter(k => k !== 'miss')) { const c = within(TIMING.GRADES[k] + .5, sd); ev += (c - prev) * TIMING.COINS[k]; prev = c; } return ev; };

export async function runTimingChecks(assert) {
  const t0 = Date.parse('2026-10-27T03:00:00Z'); // 화요일 낮(한국 12시)

  /* ---------- 규칙 숫자 · 등급 경계 ---------- */
  assert(TIMING.TARGET === 10000 && TIMING.TARGETS.join() === '10000' && TIMING.SHOW_MS === 3000 && !('LEVELS' in TIMING),
    'V13.180 목표 10.00초(목표 변주는 TARGETS 자리만), 난이도는 이지 하나: 숫자가 처음 3초만 보인다(선생님 결정)');
  assert(GRADE_KEYS.join() === 'ten,perfect,great,good,close,miss' && TIMING.GRADES.perfect === 50 && TIMING.GRADES.great === 150 && TIMING.GRADES.good === 400 && TIMING.GRADES.close === 1000,
    'V13.180 등급: 딱 10.00(숫자판 0.00 차이) · 완벽 ±0.05 · 훌륭 ±0.15 · 좋음 ±0.4 · 아쉬움 ±1초 · 그 밖 꽝');
  assert(gradeOf(0) === 'ten' && gradeOf(-4) === 'ten' && errText(4) === '±0.00초' && gradeOf(5) === 'perfect' && errText(5) === '+0.01초' && gradeOf(50) === 'perfect' && gradeOf(-51) === 'great' && gradeOf(150) === 'great'
    && gradeOf(151) === 'good' && gradeOf(-400) === 'good' && gradeOf(401) === 'close' && gradeOf(-1000) === 'close' && gradeOf(1001) === 'miss' && gradeOf(NaN) === 'miss',
    'V13.180 등급 경계값: 딱 10.00은 숫자판이 정확히 10.00일 때(±4ms), 경계값은 안쪽 등급, 1ms 넘으면 다음 등급, 빠름 · 늦음 같게');
  assert(errText(30) === '+0.03초' && errText(-120) === '−0.12초' && secText(10004) === '10.00' && ledDigits(10037).join('') === '1004' && ledDigits(999999).join('') === '9999',
    'V13.180 오차는 0.01초 단위(+늦음 · −빠름), 숫자판은 초 두 자리 : 1/100초 두 자리');
  assert(TIMING.FREE_DAILY === 3 && TIMING.SOURCES.join() === 'practice,attend' && dailyPlays(0) === 3 && dailyPlays(2) === 5 && dailyPlays(9) === 5,
    'V13.180 도전권은 코인을 안 쓴다: 하루 기본 3판 + 연습 끝내기 · 출석마다 1판(하루 최대 5판, 선생님 결정)');
  assert(TIMING.COINS.ten === 100 && TIMING.COINS.perfect === 30 && TIMING.COINS.close > 0 && TIMING.COINS.miss === 0 && GRADE_KEYS.every((g, i) => !i || TIMING.COINS[g] < TIMING.COINS[GRADE_KEYS[i - 1]]) && TIMING.TEN_DAILY === 1 && TIMING.COIN_DAILY === 150,
    'V13.180 코인: 딱 10.00 100(하루 한 번, 선생님 결정) · 완벽 30 · 훌륭 15 · 좋음 8 · 아쉬움(±1초) 4 · 꽝 0, 하루 150까지');
  const avg = Math.round(perPlay(400) * 3), good = Math.round(perPlay(250) * 5);
  assert(avg >= 25 && avg <= 40 && good >= 55 && good <= 80, `V13.180 하루 가치: 보통 학생(오차 표준편차 0.4초) 3판 약 ${avg}코인, 잘하는 학생(0.25초) 5판 약 ${good}코인`);

  /* ---------- 서버 시간 비교(허용 오차) ---------- */
  const w = guardWindow(100);
  assert(w.rtt === 100 && w.lo === -40 && w.hi === 300 && guardWindow(5000).rtt === TIMING.GUARD.RTT_MAX && guardWindow(-5).rtt === 0 && guardWindow(0).hi === TIMING.GUARD.JITTER,
    'V13.180 허용 오차: 서버가 잰 왕복(RTT, 800ms까지) ± (0.15초 + RTT의 절반), 아래는 −40ms보다 작아질 수 없다');
  {
    const p = { pets: [{ key: 'dog' }], preview_owner_id: 'qa' }; // 하루 판 수에 걸리지 않게(미리보기 계정은 30판)
    const ok = play(p, { ms: 10020, at: t0 });
    assert(ok.valid && ok.grade === 'perfect' && ok.checked === 'client' && ok.err === 20 && !ok.unranked && ok.record && ok.coins === 30 && ok.xp === TIMING.XP.perfect,
      'V13.180 허용 오차 안: 화면이 잰 시간(10.02초)을 믿고 완벽 · 기록 · 보상');
    const edge = play(p, { ms: 10300, real: 10300 + w.hi - 100, at: t0 + 60000 });
    const out = play(p, { ms: 10300, real: 10300 + w.hi - 100 + 1, at: t0 + 120000 });
    assert(edge.checked === 'client' && edge.grade === 'good' && out.checked === 'server' && out.unranked && out.ms === 10501 && out.grade === 'close',
      'V13.180 경계: 남는 시간이 허용 오차 끝(+0.3초)이면 믿고, 1ms만 넘어도 서버가 잰 시간(서버 경과 − RTT)으로 판정 · 순위 제외');
    const cheat = play(p, { ms: 10000, real: 10700, at: t0 + 180000 });
    assert(cheat.checked === 'server' && cheat.ms === 10700 && cheat.grade === 'close' && cheat.coins === TIMING.COINS.close, 'V13.180 10.70초에 누르고 10.00초라고 보내면 서버가 잰 10.70초로 아쉬움');
    const lucky = play(p, { ms: 9000, real: 10000, at: t0 + 240000 });
    assert(lucky.checked === 'server' && lucky.grade === 'ten' && lucky.coins === TIMING.COINS.good && lucky.unranked && !p.timing.x10 && p.timing.tn === 0,
      'V13.180 서버 판정으로 딱 10.00이어도 코인은 좋음까지(100코인 아님), 순위 · 칭호에 넣지 않는다');
    const early = play(p, { ms: 1500, at: t0 + 300000 });
    const late = play(p, { ms: 20000, at: t0 + 360000, result: 'timeout' });
    assert(early.grade === 'early' && early.coins === 0 && early.xp === 0 && late.grade === 'miss' && late.coins === 0 && late.ms === 20000 && !late.record,
      `V13.180 최소 시간: ${TIMING.MIN_MS / 1000}초보다 빨리 누르면 실수(보상 · 기록 없음), 20초가 지나 화면이 멈추면 꽝`);
  }

  /* ---------- 딱 10.00 하루 한 번 · 운 감시 · 하루 코인 상한 ---------- */
  {
    const p = { pets: [{ key: 'dog' }], preview_owner_id: 'qa' }, at = i => t0 + i * 60000;
    const a = play(p, { ms: 10000, at: at(0) }), b = play(p, { ms: 10003, at: at(1) });
    assert(a.grade === 'ten' && a.coins === 100 && b.grade === 'ten' && b.coins === 30 && b.ten_used && p.timing.x10 === 2 && timingView(p, at(1)).ten_left === 0,
      'V13.180 딱 10.00의 100코인은 하루 한 번(두 번째는 완벽 코인 30), 칭호용 수는 둘 다 센다');
    play(p, { ms: 10040, at: at(2) }); play(p, { ms: 9960, at: at(3) });
    const fifth = play(p, { ms: 10010, at: at(4) });
    assert(fifth.lucky && fifth.unranked && fifth.coins === 0 && p.timing.pf === 4 && p.timing.st === 0 && p.timing.sb === 4,
      `V13.180 운 감시: 최근 ${TIMING.LUCK_GUARD.WINDOW}판 중 완벽 이상이 ${TIMING.LUCK_GUARD.MAX}번 있은 뒤의 완벽은 좋음 코인까지 · 순위 · 칭호 제외(허용 오차 안의 부정 대비)`);
    assert(coinsOf(p) === TIMING.COIN_DAILY && fifth.capped && timingView(p, at(5)).coin_left === 0, `V13.180 하루 코인은 ${TIMING.COIN_DAILY}에서 멈춘다(100 + 30 + 30 → 상한)`);
    for (let i = 0; i < 9; i++) play(p, { ms: 10600, at: at(10 + i) });
    const back = play(p, { ms: 10010, at: at(20) + DAY });
    assert(!back.lucky && back.grade === 'perfect' && back.coins === 30, 'V13.180 완벽이 아닌 판이 쌓이면 운 감시가 풀리고, 다음 날은 코인이 새로');
  }

  /* ---------- 한 판 한 번 · 영수증 · 만료 · 무효 · 하루 판 ---------- */
  {
    const p = { pets: [{ key: 'dog' }] }, id = pid();
    const s1 = timingStart(p, { id, echo: t0 - 80, now: t0 });
    const s2 = timingStart(p, { id, echo: t0 - 80, now: t0 + 10 });
    assert(s1.id === id && !s1.again && s2.again && p.timing.n === 1, 'V13.180 같은 시작(id)을 다시 보내면 판을 또 쓰지 않는다');
    const keys = new Set([...Object.keys(s1), ...Object.keys(s2)]);
    assert([...keys].every(k => ['id', 'target', 'countdown_ms', 'show_ms', 'again'].includes(k)) && !JSON.stringify(s1).includes(String(t0)),
      'V13.180 시작 응답에는 목표(화면에 보이는 규칙) · 카운트다운 · 숨김 시간만: 서버 시각 · 끝나야 할 시각 같은 필드가 없다');
    const f1 = timingFinish(p, { id, ms: 10010, now: t0 + 13090 });
    const before = coinsOf(p);
    const f2 = timingFinish(p, { id, ms: 10010, now: t0 + 13100 });
    assert(f1.grade === 'perfect' && f2.again && f2.grade === 'perfect' && coinsOf(p) === before && p.timing.all === 1, 'V13.180 같은 끝내기를 다시 보내면 같은 답(보상 · 기록은 한 번)');
    assert(status(() => timingFinish(p, { id: 'tm-none-0001', ms: 10000, now: t0 + 14000 })) === 404, 'V13.180 모르는 판의 끝 신호는 404');
    const id2 = pid();
    timingStart(p, { id: id2, echo: t0 + 1e5 - 50, now: t0 + 1e5 });
    const gone = timingFinish(p, { id: id2, ms: 10000, now: t0 + 1e5 + TIMING.LIVE_MS + 1 });
    const id3 = pid();
    timingStart(p, { id: id3, echo: t0 + 2e5 - 50, now: t0 + 2e5 });
    const voided = timingFinish(p, { id: id3, result: 'void', now: t0 + 2e5 + 6000 });
    assert(!gone.valid && gone.reason === 'expired' && !voided.valid && voided.reason === 'void' && p.timing.n === 3 && coinsOf(p) === before && p.timing.st === 0,
      `V13.180 시작 뒤 ${TIMING.LIVE_MS / 1000}초 안에 끝 신호가 없으면 무효, 화면이 가려지면(void) 무효: 판은 쓰고 보상 없음 · 연속 완벽 끊김`);
    assert(status(() => timingStart(p, { id: pid(), target: 7000, now: t0 + 3e5 })) === 400 && status(() => timingStart(p, { now: t0 + 3e5 })) === 400 && status(() => timingStart(p, { id: pid(), echo: t0 + 3e5, now: t0 + 3e5 })) === 409,
      'V13.180 목표 시간(TARGETS에 있는 것만) · 판 번호를 확인하고, 하루 기본 3판을 다 쓰면 409');
    assert(grantTimingPlay(p, 'practice', t0 + 4e5) && !grantTimingPlay(p, 'practice', t0 + 4e5) && grantTimingPlay(p, 'attend', t0 + 4e5) && !grantTimingPlay(p, 'match', t0 + 4e5) && timingView(p, t0 + 4e5).left === 2 && timingView(p, t0 + 4e5).plays === 5,
      'V13.180 연습 끝내기 · 출석마다 하루 1판 더(같은 곳은 하루 한 번, 다른 곳은 안 됨) → 최대 5판');
    play(p, { ms: 12000, at: t0 + 5e5 }); play(p, { ms: 12000, at: t0 + 6e5 });
    assert(status(() => timingStart(p, { id: pid(), echo: t0 + 7e5, now: t0 + 7e5 })) === 409 && timingView(p, t0 + DAY).left === 3 && timingView(p, t0 + DAY).got.practice === false,
      'V13.180 5판을 다 쓰면 409, 다음 날(한국 날짜)은 3판 · 추가 판이 새로');
  }

  /* ---------- 칭호 ---------- */
  assert(['timing-clock', 'timing-ten', 'timing-human'].every(k => TITLES[k]?.group === 'arcade') && TITLES['timing-clock'].name === '시계 장인' && TITLES['timing-clock'].goal === 10 && TITLES['timing-ten'].stat === 'timing_ten' && TITLES['timing-human'].goal === 3
    && titleUnlocked('timing-ten', { timing_ten: 1 }) && !titleUnlocked('timing-clock', { timing_perfect: 9 }) && titleCoins('timing-human') === TITLE_COINS.legendary
    && ['timing_perfect: p => Number(p?.timing?.pf || 0)', 'timing_ten: p => Number(p?.timing?.x10 || 0)', 'timing_streak: p => Number(p?.timing?.sb || 0)'].every(x => source('./competition.mjs').includes(x)),
    'V13.180 칭호 3개(놀이터): 시계 장인(완벽 10번) · 딱 10.00(정확히 10.00) · 인간 초시계(완벽 3번 연속), 서버가 학생 기록에서 센다');

  /* ---------- 순위(하나) ---------- */
  {
    const mk = (id, extra = {}) => ({ id, role: 'student', active: true, class_name: '고1A', division: 'high', school: '단원고', display_name: id, avatar_key: 'cat', pets: [{ key: 'cat' }], ...extra });
    const PLAYS = 'qa-board'; // 판을 넉넉히 하려고 잠시 미리보기 표시(30판)를 붙였다가 순위 전에 뗀다
    const me = mk('me'), others = Array.from({ length: 24 }, (_, i) => mk(`s${i}`));
    const hide = mk('private', { ranking_public: false }), preview = mk('preview'), off = mk('off'), mid = mk('mid', { class_name: '중2A', division: 'middle' }), high2 = mk('high2', { class_name: '고2B' });
    const all = [me, ...others, hide, preview, off, mid, high2];
    all.forEach(x => { x.preview_owner_id = PLAYS; });
    const atW = t0 + 3600000;
    // 완벽은 운 감시에 걸리지 않게 몇 판에 한 번만(나머지는 0.5초 밖).
    others.forEach((x, i) => { for (let k = 0; k < 5; k++) play(x, { ms: k ? 10600 + i : 10000 + (i % 2 ? 1 : -1) * (i + 1) * 30, at: atW + k * 60000 }); });
    for (const x of [hide, preview, off, mid, high2]) for (let k = 0; k < 5; k++) play(x, { ms: k ? 10600 : 10010, at: atW + k * 60000 });
    for (let k = 0; k < 4; k++) play(me, { ms: 10900, at: atW + k * 60000 });
    all.forEach(x => { delete x.preview_owner_id; });
    preview.preview_owner_id = 't1'; off.active = false;
    const best = timingBoard(all, me, { kind: 'best', now: atW + DAY, hidden: x => x.ranking_public === false });
    const names = best.rows.map(r => r.name);
    assert(best.total === 26 && best.rows.length === TIMING.BOARD_TOP + 1 && best.rows.at(-1).me && best.rows.at(-1).rank === 26 && names.includes('비공개 학생') && !names.includes('private')
      && !['preview', 'off', 'mid', 'high2'].some(n => names.includes(n)) && best.rows[0].err === 10,
      'V13.180 이번 주 최고 기록 순위(하나): 같은 학년대만, 교사 미리보기 · 쉬는 학생 제외, 비공개 학생은 이름을 숨기고, 내 줄은 20등 밖이어도 붙는다');
    const avgB = timingBoard(all, me, { kind: 'avg', now: atW + DAY });
    assert(avgB.rows.length === TIMING.BOARD_TOP && !avgB.rows.some(r => r.me) && avgB.total === 25 && avgB.avg_min === TIMING.AVG_MIN, `V13.180 평균 오차 순위는 ${TIMING.AVG_MIN}판 이상(4판인 나는 아직 없음)`);
    me.preview_owner_id = PLAYS; play(me, { ms: 10900, at: atW + 9 * 60000 }); delete me.preview_owner_id;
    const avg2 = timingBoard(all, me, { kind: 'avg', now: atW + DAY });
    assert(avg2.rows.at(-1).me && avg2.rows.at(-1).err === 900, 'V13.180 5판을 채우면 평균 오차 줄이 생긴다(합 오차 ÷ 판 수)');
    const pv = timingBoard(all, preview, { now: atW + DAY });
    assert(pv.rows.some(r => r.me) && pv.rows.filter(r => r.name === 'preview').length === 1 && !timingBoard(all, me, { now: atW + 8 * DAY }).rows.length,
      'V13.180 교사 미리보기 계정은 자기 줄만 보이고, 순위는 이번 주만');
  }

  /* ---------- 저장 크기 ---------- */
  {
    const p = { pets: [{ key: 'dog' }], preview_owner_id: 'x' };
    for (let d = 0; d < 40; d++) for (let k = 0; k < 5; k++) play(p, { ms: 9500 + k * 97 + d, at: t0 + d * DAY + k * 60000 });
    const size = JSON.stringify(p.timing).length;
    assert(size <= 500 && p.timing.all === 200 && !p.timing.done && p.timing.q.length <= TIMING.LUCK_GUARD.WINDOW, `V13.180 학생 기록 p.timing은 작은 키 하나(200판 뒤 ${size}바이트 ≤ 500, 영수증은 마지막 판 하나)`);
  }

  /* ---------- 서버 경로 ---------- */
  {
    const state = emptyState(), hash = await passwordHash('QaTiming1!'), now = Date.now();
    state.profiles.push({ id: 'qa-tm', username: 'qa-tm', display_name: '타이밍', role: 'student', active: true, class_name: '고1A', school_id: 'danwon-high', school: '단원고', division: 'high', password_hash: hash, pets: [{ key: 'dog', first: true, acquired_at: now - 9 * DAY }], avatar_key: 'dog', created_at: now - 9 * DAY });
    const token = (await service(state, 'POST', '/login', { username: 'qa-tm', password: 'QaTiming1!', division: 'high' }, null))._cookie;
    const call = (method, path, body = {}) => service(state, method, path, body, token);
    const me = state.profiles.find(x => x.id === 'qa-tm');
    const before = JSON.stringify(me);
    const boot = await call('GET', '/bootstrap');
    assert(boot.rewards.timing?.left === 3 && boot.rewards.timing.max === 5 && JSON.stringify(me) === before, 'V13.180 홈 데이터에 10초 맞추기가 오고, 읽기만으로 학생 기록이 바뀌지 않는다');
    const ping = await call('POST', '/timing/ping');
    assert(Object.keys(ping).join() === 'echo' && JSON.stringify(me) === before && Math.abs(ping.echo - Date.now()) < 5000, 'V13.180 ping은 서버 시각만 주고 기록을 바꾸지 않는다(쓰기 없음)');
    let bad = 0; try { await call('POST', '/timing/start', {}); } catch (e) { bad = e.status; }
    const st = await call('POST', '/timing/start', { id: 'qa-timing-0001', echo: ping.echo });
    assert(bad === 400 && st.id === 'qa-timing-0001' && st.timing.left === 2 && st.show_ms === 3000 && !('at' in st) && me.timing.live.r <= TIMING.GUARD.RTT_MAX, 'V13.180 시작은 판 번호가 있어야 하고 판을 하나 쓴다');
    // 실제로 10초를 기다리지 않고 서버가 잰 시작 시각을 13.1초 앞으로 옮긴다(남는 시간 = RTT).
    me.timing.live.at -= TIMING.COUNTDOWN_MS + 10000 + 100; me.timing.live.r = 100;
    const fin = await call('POST', '/timing/finish', { id: 'qa-timing-0001', ms: 10000, coins: 999, grade: 'ten', xp: 999 });
    const again = await call('POST', '/timing/finish', { id: 'qa-timing-0001', ms: 10000 });
    assert(fin.valid && fin.grade === 'ten' && fin.coins === 100 && fin.xp === TIMING.XP.ten && again.again && typeof fin.points_balance === 'number' && coinsOf(me) === 100 && xpOf(me) === TIMING.XP.ten,
      'V13.180 보상은 서버만 정한다(화면이 보낸 coins · grade · xp는 무시), 다시 보내도 한 번');
    assert(me.activity?.at(-1)?.k === 'timing' && me.activity.at(-1).t === '10초 맞추기 ±0.00초 딱 10.00!' && timingLine({ valid: true, err: 30, grade: 'perfect' }) === '10초 맞추기 +0.03초 완벽' && me.usage?.today?.timing === 1,
      'V13.180 선생님 활동 기록에 한 줄("10초 맞추기 +0.03초 완벽"), 같은 끝내기를 다시 보내도 한 줄');
    const brd = await call('GET', '/timing/board', { kind: 'best' });
    assert(brd.rows.length === 1 && brd.rows[0].me && brd.rows[0].err === 0, 'V13.180 순위 경로(GET)');
    me.attendance = { card: 1, last: dayKey(Date.now() - DAY), streak: 1 };
    const att = await call('POST', '/attendance/check');
    assert(att.timing_play === true && att.timing.got.attend && att.timing.left === 3, 'V13.180 출석하면 10초 맞추기 한 판 더');
    assert(publicProfile(me).timing && !('live' in publicProfile(me).timing), 'V13.180 학생 기록은 작은 키 하나로 프로필에 실린다(진행 중인 판 없음)');
    const svc = source('./service.mjs');
    assert(svc.includes("if (complete && student && answerRecords.length >= TIMING.MIN_PRACTICE) grantTimingPlay(student, 'practice', finalizedAt);") && svc.includes("'hunt', 'blank', 'timing'].filter(k => old[k])") && svc.includes("if (!res.again) logActivity(p, 'timing', timingLine(res), now);"),
      'V13.180 끝까지 푼 연습(10문제 이상)도 한 판 더, 로그인 때 기록을 지키고, 끝날 때만 활동 기록');
    const routes = svc.slice(svc.indexOf("if (path === '/timing/ping'"), svc.indexOf("if (path === '/hunt/home'"));
    assert((routes.match(/requireRole\(p, 'student'\);/g) || []).length === 4 && (routes.match(/if \(path === '\/timing\//g) || []).length === 4, 'V13.180 10초 맞추기 경로 넷(ping · 시작 · 끝 · 순위)은 학생만');
  }

  /* ---------- 화면 · 소리 · 구성안 ---------- */
  {
    const ui = source('../public/modules/timing.js'), css = source('../public/v13180.css'), games = source('../public/modules/arcade-games.js'), app = source('../public/app.js'), build = source('./build-assets.mjs');
    assert(ui.includes('performance.now()') && ui.includes("document.addEventListener('visibilitychange', T.onVis)") && ui.includes("addEventListener('pagehide', T.onVis)") && ui.includes("result: 'void'") && ui.includes('navigator.vibrate?.(p)') && ui.includes("api('/timing/ping', {})") && ui.includes('echo: ping.echo') && !/level/i.test(ui),
      'V13.180 화면: performance.now()로 재고, 화면이 가려지거나 나가면 그 판은 무효(void), 진동은 지원할 때만, 시작 전 ping, 난이도 고르기 없음');
    assert(ui.includes("btn.addEventListener('pointerdown', onPointerDown)") && ui.includes("e.code === 'Space'") && ui.includes('if (e.repeat) return;') && ui.includes('stampOf(e)') && css.includes('touch-action:none'),
      'V13.180 큰 버튼: 터치 · 마우스(pointerdown) · 스페이스, 누른 순간은 이벤트 시각으로, 꾹 눌러 반복 입력은 무시');
    assert(['tm-btn-base', 'tm-btn-side', 'tm-btn-top', 'tm-btn-shine', 'tm-btn-well', 'tm-spill'].every(c => ui.includes(c) && css.includes(`.${c}`)) && css.includes('.tm-btn.down .tm-btn-top{transform:translateY(') && css.includes('@keyframes tmUpTop') && css.includes('@keyframes tmSpill'),
      'V13.180 입체 버튼: 받침 · 옆면 · 윗면 · 반사광 · 안쪽 구멍, 누르면 깊이 내려가고 손을 떼면 튕겨 오르며, 아래로 빛이 번진다');
    assert(ui.includes("const DIGIT = { 0: 'abcdef'") && css.includes('.tm-led .sg{fill:var(--tm-off)') && css.includes('.tm-led .sg.on{fill:var(--tm-red)}') && css.includes('@keyframes tmFlicker') && css.includes('.tm-led.hid .hd{') && ui.includes('tm-colon') && css.includes('@keyframes tmReveal') && css.includes('.tm-led.gold .sg.on'),
      'V13.180 LED: 7-세그먼트 SVG(꺼진 세그먼트 잔광 · 켜진 글로우 · 깜빡임), 숨김은 점이 숨 쉬고, 콜론 깜빡, 공개 때 번쩍, 딱 10.00은 금색');
    assert(ui.includes('function reveal(ms)') && ui.includes('Math.max(0, ms - 500)') && ui.includes('function ruler(res)') && ui.includes('function perfectShow(ten)') && ui.includes('JACKPOT') && ui.includes('NEW BEST') && ui.includes('연속 완벽 ×') && ui.includes('CHEERS[g]') && ui.includes('GRADE_MARKS[g]') && ui.includes('tm-lamps'),
      'V13.180 결과: 눌린 순간 0.5초를 늘려 공개(슬로모션), 눈금자, 완벽 번쩍 · 파티클, 딱 10.00 대박, 최고 기록 · 연속 완벽, 낮은 등급 격려, 색 + 기호로 등급, 오늘 판 램프');
    assert(css.includes('@media (prefers-reduced-motion:reduce)') && css.includes('.tm-confetti,.tm-flash{display:none}') && ui.includes('if (reduced()) return;') && css.includes('@media (min-width:760px)') && css.includes('(orientation:landscape)'),
      'V13.180 움직임 줄이기면 파티클 · 번쩍 · 흔들림을 끄고, 가로 · PC 배치가 있다');
    const used = [...ui.matchAll(/sfx\('([a-z-]+)'/g)].map(m => m[1]);
    assert(used.every(k => SOUND_KEYS.includes(k)) && ['tm-count', 'tm-go', 'tm-hide', 'tm-tick', 'tm-press', 'tm-reveal', 'tm-perfect', 'tm-great', 'tm-good', 'tm-miss', 'tm-record'].every(k => SOUND_KEYS.includes(k) && used.includes(k) && source('../docs/sound/timing-synth.mjs').includes(`def('${k}'`))
      && ui.includes("const tickOn = () => readPref(TICK_KEY, 'on') === 'on';") && ui.includes('if (tickOn() && sec > 0)'), 'V13.180 소리 11개(docs/sound/timing-synth.mjs로 합성): 카운트다운 · 시작 · 숨김 · 째깍(설정으로 끔) · 버튼 · 공개 · 등급 · 기록 갱신');
    assert(!/\.webp|\.png/.test(ui) && !/url\(\/assets/.test(css) && games.includes('export function timingCard(A)') && games.includes('${timingCard(A)}') && games.includes('data-action="timing-open"') && app.includes("if (d.action === 'timing-open')") && build.includes('"v13180.css"'),
      'V13.180 그림 파일 없이 코드로 그리고, 놀이터 게임 카드 → 게임 화면으로 들어간다');
    const doc = source('../docs/timing-design.md');
    assert(['## 규칙', '## 등급과 보상', '## 하루 가치', '## 순위', '## 서버 판정', '## 연출 · 소리', '## 저장 키', '## 부정 방지와 한계'].every(h => doc.includes(h)) && doc.includes('100'), 'V13.180 docs/timing-design.md 구성안');
  }
}
