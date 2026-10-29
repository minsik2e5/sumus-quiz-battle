// V13.192 검사: 10초 맞추기 오늘의 챌린지(선생님 설정 · 자동 · 하루 1판 · 보상 · 오늘 순위 · 어제 챔피언) + 고스트(내 기록 비교).
// 설정 있는 날 / 없는 날 목표, 선생님만 설정(학생 403), 값 범위, 오늘 것은 도전한 학생이 있으면 잠김, 보상 상한, 순위(미리보기 제외 ·
// 비공개 · 내 줄), 고스트 문구 경계값, 저장 크기 상한, 학생 응답에 미래 날짜 설정 없음. 시간은 가짜 시각으로 돌린다.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { TIMING, autoDailyTarget, dailyCheck, gradeName, ghostLine } from '../public/modules/timing-rules.js';
import { dayKey } from '../public/modules/core.js';
import { timingView, timingStart, timingFinish, timingLine, dailyConfig, dailyTeacherView, setDaily, timingDailyBoard } from './timing.mjs';
import { bonusRecords } from './rewards.mjs';
import { emptyState } from './state.mjs';
import { passwordHash } from './auth.mjs';
import { service } from './service.mjs';

const source = path => readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8');
const status = fn => { try { fn(); return 0; } catch (e) { return e.status || 500; } };
const DAY = 86400000;
const coinsOf = p => bonusRecords(p).reduce((n, r) => n + r.reward_points, 0);
let seq = 0;
const pid = () => `tmd-check-${String(++seq).padStart(4, '0')}`;
// 한 판: 끝 도착 = 시작 + 카운트다운 + real + rtt(서버가 잰 왕복과 같으면 화면 시간을 믿는다).
function play(p, { ms, real = ms, rtt = 100, at, result = 'press', daily = null, id = pid() }) {
  timingStart(p, { id, echo: at - rtt, now: at, ...(daily ? { mode: 'daily', daily } : {}) });
  return timingFinish(p, { id, result, ms, now: at + TIMING.COUNTDOWN_MS + real + rtt });
}

export async function runTimingDailyChecks(assert) {
  const t0 = Date.parse('2026-10-28T03:00:00Z'); // 수요일 낮(한국 12시)
  const D = TIMING.DAILY, today = dayKey(t0), day = k => dayKey(t0 + k * DAY);

  /* ---------- 규칙: 자동 목표 · 값 검사 ---------- */
  const autos = Array.from({ length: 120 }, (_, i) => autoDailyTarget(day(i)));
  assert(autos.every(t => t >= D.AUTO_MIN && t <= D.AUTO_MAX && t % 10 === 0) && new Set(autos).size >= 80 && autoDailyTarget(today) === autoDailyTarget(today),
    'V13.192 안 정한 날의 목표는 날짜로 정해진다(같은 날 같은 값, 5.00 ~ 15.00초 · 0.01초 단위, 날마다 달라진다)');
  assert(D.MIN === 500 && D.MAX === 30000 && D.PLAYS === 1 && D.BONUS === 8 && D.AHEAD === 13 && D.KEEP === 14 && D.MSG === 30,
    'V13.192 목표 0.5 ~ 30초 · 하루 1판(기본 판과 따로) · 참여 보너스 8코인 · 오늘부터 13일 뒤까지 정하기 · 지난 14일만 보관 · 메시지 30자');
  const ok = v => !dailyCheck(v).error;
  assert(ok({ target_ms: 500, show_ms: 0 }) && !ok({ target_ms: 490, show_ms: 0 }) && ok({ target_ms: 30000, show_ms: 5000 }) && !ok({ target_ms: 30010, show_ms: 0 }) && !ok({ target_ms: 7775, show_ms: 0 }) && !ok({ target_ms: 3000, show_ms: 3000 }) && ok({ target_ms: 3010, show_ms: 3000 }) && !ok({ target_ms: 7770, show_ms: 4000 }) && ok({ target_ms: 7770, show_ms: 1000, msg: '가'.repeat(30) })
    && !ok({ target_ms: 7770, show_ms: 1000, msg: '가'.repeat(31) }) && dailyCheck({ target_ms: 7770, show_ms: 3000, msg: '  오늘은   7.77초! ' }).m === '오늘은 7.77초!',
    'V13.192 값 검사 경계: 0.50 ~ 30.00초(0.01초 단위), 숫자 보임은 0 · 1 · 2 · 3 · 5초이고 목표보다 짧게, 메시지 30자(공백 정리)');
  const ui = source('../public/modules/timing-daily-ui.js');
  const { secondsToMs } = await import('../public/modules/timing-daily-ui.js').catch(() => ({}));
  assert(ui.includes("export const secondsToMs = text => /^\\d{1,2}(\\.\\d{1,2})?$/.test(") && (!secondsToMs || (secondsToMs('7.77') === 7770 && secondsToMs('0.5') === 500 && Number.isNaN(secondsToMs('7.775')) && Number.isNaN(secondsToMs('-1')))),
    'V13.192 선생님 화면은 초(소수 둘째 자리까지)를 ms로 바꿔 보내고, 서버와 같은 dailyCheck로 먼저 확인한다');

  /* ---------- 설정 있는 날 · 없는 날 · 범위 · 잠김 · 보관 ---------- */
  {
    const state = emptyState();
    const auto = dailyConfig(state, t0);
    assert(auto.auto && auto.target === autoDailyTarget(today) && auto.show === D.AUTO_SHOW && auto.msg.includes('초!'), 'V13.192 설정 없는 날은 자동(날짜 시드 목표 · 숫자 3초 보임 · "오늘은 ○○초!")');
    setDaily(state, { day: today, target_ms: 7770, show_ms: 0, msg: '행운의 7.77' }, { now: t0, by: 't' });
    const set = dailyConfig(state, t0);
    assert(!set.auto && set.target === 7770 && set.show === 0 && set.msg === '행운의 7.77', 'V13.192 선생님이 정한 날은 그 목표 · 가림 방식 · 메시지');
    assert(status(() => setDaily(state, { day: day(-1), target_ms: 5000, show_ms: 0 }, { now: t0 })) === 400 && status(() => setDaily(state, { day: day(14), target_ms: 5000, show_ms: 0 }, { now: t0 })) === 400
      && !status(() => setDaily(state, { day: day(13), target_ms: 29990, show_ms: 0, msg: 'FUTURE-MSG' }, { now: t0 })) && status(() => setDaily(state, { day: day(2), target_ms: 40000, show_ms: 0 }, { now: t0 })) === 400,
      'V13.192 지난 날 · 14일 뒤는 정할 수 없고(400), 13일 뒤까지는 된다, 범위 밖 값은 400');
    const v = dailyTeacherView(state, t0);
    assert(v.days.length === 14 && v.days[0].day === today && v.days[13].target === 29990 && v.days.filter(c => !c.auto).length === 2 && v.played === 0, 'V13.192 선생님 화면: 오늘부터 14일(정한 날 · 자동), 오늘 도전 수');
    setDaily(state, { day: day(5), target_ms: 5000, show_ms: 1000 }, { now: t0 }); setDaily(state, { day: day(5), clear: true }, { now: t0 });
    assert(dailyConfig(state, t0, day(5)).auto, 'V13.192 "자동으로"를 누르면 그날 설정을 지운다');
    // 오늘 것은 학생이 한 명이라도 도전하면 잠긴다(같은 목표로 겨루게). 미리보기 계정은 세지 않는다.
    const pv = { id: 'pv', role: 'student', pets: [{ key: 'dog' }], preview_owner_id: 't' }, st = { id: 'st', role: 'student', pets: [{ key: 'dog' }] };
    state.profiles.push(pv, st);
    play(pv, { ms: 7700, at: t0, daily: dailyConfig(state, t0) });
    const free = status(() => setDaily(state, { day: today, target_ms: 7770, show_ms: 1000, msg: '행운의 7.77' }, { now: t0 }));
    play(st, { ms: 7700, at: t0, daily: dailyConfig(state, t0) });
    assert(!free && status(() => setDaily(state, { day: today, target_ms: 5000, show_ms: 0 }, { now: t0 })) === 409 && !status(() => setDaily(state, { day: day(1), target_ms: 5000, show_ms: 0 }, { now: t0 })) && dailyTeacherView(state, t0).played === 1,
      'V13.192 오늘 챌린지는 학생이 도전한 뒤에는 바꿀 수 없다(409, 내일 것은 된다), 미리보기 계정 도전은 세지 않는다');
    for (let k = 0; k < 40; k++) setDaily(state, { day: day(k + 1), target_ms: 5000 + k * 10, show_ms: 0, msg: '가'.repeat(30) }, { now: t0 + k * DAY });
    const keys = Object.keys(state.timingDaily), size = JSON.stringify(state.timingDaily).length;
    assert(keys.length <= D.KEEP + D.AHEAD && keys[0] >= dayKey(t0 + 39 * DAY - (D.KEEP - 1) * DAY) && size <= 4000, `V13.192 날짜별 설정은 지난 ${D.KEEP}일 + 앞으로 ${D.AHEAD}일만(${keys.length}개 · ${size}바이트 ≤ 4000)`);
  }

  /* ---------- 판 · 보상 · 기록 ---------- */
  {
    const daily = { day: today, target: 7770, show: 0, msg: '', auto: false };
    const p = { pets: [{ key: 'dog' }] };
    const s1 = timingStart(p, { id: 'tmd-a-0001', mode: 'daily', daily, target: 10000, echo: t0 - 100, now: t0 });
    assert(s1.target === 7770 && s1.show_ms === 0 && s1.mode === 'daily' && Object.keys(s1).every(k => ['id', 'target', 'countdown_ms', 'show_ms', 'mode', 'again'].includes(k)),
      'V13.192 챌린지 시작: 목표 · 숫자 보임은 서버 설정(화면이 보낸 target은 무시), 응답에 서버 시각 같은 필드 없음');
    const r1 = timingFinish(p, { id: 'tmd-a-0001', ms: 7800, now: t0 + TIMING.COUNTDOWN_MS + 7800 + 100 });
    assert(r1.daily && r1.grade === 'perfect' && r1.err === 30 && r1.bonus === D.BONUS && r1.coins === TIMING.COINS.perfect + D.BONUS && coinsOf(p) === r1.coins && p.timing.dc.e === 30 && p.timing.dc.bn === 1,
      'V13.192 챌린지 보상: 등급 코인(기존 표) + 참여 보너스 8, 그날 최고 오차를 남긴다');
    assert(p.timing.best == null && !p.timing.wk && !p.timing.pf && !p.timing.st && timingView(p, t0, daily).left === TIMING.FREE_DAILY && timingView(p, t0, daily).daily.left === 0 && timingView(p, t0, daily).daily.best === 30,
      'V13.192 챌린지는 기본 판(하루 3판)을 쓰지 않고, 기본 기록(최고 · 주 · 완벽 수 · 연속)과 따로 센다');
    assert(status(() => timingStart(p, { id: pid(), mode: 'daily', daily, echo: t0, now: t0 + 60000 })) === 409 && status(() => timingStart(p, { id: pid(), mode: 'daily', daily: null, now: t0 })) === 404,
      `V13.192 챌린지는 하루 ${D.PLAYS}판(두 번째는 409)`);
    assert(timingLine(r1) === '10초 맞추기 오늘의 챌린지 7.77초 +0.03초 완벽' && gradeName('ten', 7770) === '딱 7.77!' && gradeName('ten', 10000) === '딱 10.00!' && timingLine({ daily: true, valid: false, target: 7770 }) === '10초 맞추기 오늘의 챌린지 7.77초 무효',
      'V13.192 선생님 활동 기록 한 줄("10초 맞추기 오늘의 챌린지 7.77초 +0.03초 완벽"), 딱 맞춤은 "딱 7.77!"');
    // 하루 코인 상한(150)에 닿아도 참여 보너스 8은 따로, 인터넷이 느린 판 · 너무 빠른 판도 보너스는 준다(하루 한 번).
    const q = { pets: [{ key: 'dog' }], preview_owner_id: 'qa' };
    for (let i = 0; i < 2; i++) play(q, { ms: 10000 + i * 3, at: t0 + i * 60000 }); play(q, { ms: 10020, at: t0 + 2 * 60000 });
    const before = coinsOf(q), capped = play(q, { ms: 7770, at: t0 + 5 * 60000, daily });
    const again = play(q, { ms: 7770, at: t0 + 6 * 60000, daily });
    assert(before === TIMING.COIN_DAILY && capped.grade === 'ten' && capped.coins === D.BONUS && capped.capped && coinsOf(q) === TIMING.COIN_DAILY + D.BONUS && again.bonus === 0 && again.coins === 0,
      `V13.192 하루 코인 상한(${TIMING.COIN_DAILY})과 안 겹치게: 상한에 닿아도 참여 보너스 ${D.BONUS}만, 보너스는 하루 한 번(하루 최대 +${D.BONUS})`);
    const n = { pets: [{ key: 'dog' }] }, slow = play(n, { ms: 7770, real: 7770 + 600, at: t0, daily });
    const e2 = { pets: [{ key: 'dog' }] }, early = play(e2, { ms: 1000, at: t0, daily });
    const v2 = { pets: [{ key: 'dog' }] }, voided = play(v2, { ms: 7000, at: t0, daily, result: 'void' });
    assert(slow.checked === 'server' && slow.coins === D.BONUS && slow.ms === 7770 && n.timing.dc.e == null && early.grade === 'early' && early.coins === D.BONUS && !voided.valid && coinsOf(v2) === 0,
      'V13.192 인터넷이 느린 판은 보너스만 · 기록 없음(숫자는 누른 값), 너무 빠른 판도 보너스, 무효(화면 가림)는 보너스 없음');
    const tiny = { day: today, target: 500, show: 0 }, big = { day: today, target: 30000, show: 5000 };
    const a = { pets: [{ key: 'dog' }] }, b = { pets: [{ key: 'dog' }] };
    const ra = play(a, { ms: 600, at: t0, daily: tiny }), rb = play(b, { ms: 30100, at: t0, daily: big });
    const c = { pets: [{ key: 'dog' }] }, rc = play(c, { ms: 150, at: t0, daily: tiny });
    assert(ra.grade === 'great' && ra.err === 100 && rb.valid && rb.grade === 'great' && rc.grade === 'early', 'V13.192 0.5초 챌린지(0.2초보다 빠르면 실수) · 30초 챌린지(60초 만료에 걸리지 않음)도 판정된다');
  }

  /* ---------- 오늘 순위 · 어제 챔피언 ---------- */
  {
    const mk = (id, extra = {}) => ({ id, role: 'student', active: true, class_name: '고1A', division: 'high', school: '단원고', display_name: id, avatar_key: 'cat', pets: [{ key: 'cat' }], ...extra });
    const dY = { day: dayKey(t0 - DAY), target: 5000, show: 0 }, dT = { day: today, target: 7770, show: 0 };
    const me = mk('me'), others = Array.from({ length: 23 }, (_, i) => mk(`s${i}`)), hide = mk('private', { ranking_public: false }), preview = mk('preview', { preview_owner_id: 't1' });
    const mid = mk('mid', { class_name: '중2A', division: 'middle' }), slow = mk('slow'), old = mk('old');
    others.forEach((x, i) => { play(x, { ms: 5000 + (i + 1) * 7, at: t0 - DAY }); play(x, { ms: 7770 + (i % 2 ? 1 : -1) * (i + 1) * 11, at: t0 + i * 1000, daily: dT }); });
    others.slice(0, 3).forEach(x => { x.timing.dc = { ...x.timing.dc }; });
    // 어제 챌린지(어제 판 → 오늘 판으로 넘어가며 pd · pe에 남는다)
    for (const [x, e] of [[others[0], 40], [others[1], -20], [others[2], 90], [hide, 5]]) { x.timing ||= {}; x.timing.dc = { d: dayKey(t0 - DAY), n: 1, t: 5000, e }; }
    others.slice(0, 3).forEach((x, i) => play(x, { ms: 7770 + 500 + i, at: t0 + 3e5 + i, daily: { ...dT }, id: pid() }));
    play(hide, { ms: 7775, at: t0, daily: dT }); play(preview, { ms: 7770, at: t0, daily: dT }); play(mid, { ms: 7770, at: t0, daily: dT });
    play(slow, { ms: 7770, real: 7770 + 700, at: t0, daily: dT });
    old.timing = { dc: { d: dayKey(t0 - 3 * DAY), n: 1, t: 6000, e: 1 } };
    play(me, { ms: 7770 + 900, at: t0, daily: dT });
    const all = [me, ...others, hide, preview, mid, slow, old];
    const r = timingDailyBoard(all, me, { now: t0 + 1e6, hidden: x => x.ranking_public === false, target: 7770, yesterdayTarget: 5000 });
    const names = r.rows.map(x => x.name);
    assert(r.rows.length === TIMING.BOARD_TOP + 1 && r.rows.at(-1).me && r.rows.at(-1).err === 900 && r.rows[0].name === '비공개 학생' && r.rows[0].err === 5 && !names.includes('private') && !['preview', 'mid', 'slow', 'old'].some(n => names.includes(n)) && r.total === 25,
      'V13.192 오늘의 챌린지 순위: 오늘 · 같은 학년대 · 가장 작은 오차, 미리보기 · 다른 학년 · 인터넷 느린 판 · 지난 날 제외, 비공개는 "비공개 학생", 내 줄은 20등 밖이어도 붙는다');
    assert(r.champions.length === D.CHAMPS && r.champions[0].name === '비공개 학생' && r.champions[0].err === 5 && r.champions[1].name === 's1' && r.champions[1].err === 20 && r.champions[2].name === 's0' && r.yesterday_target === 5000 && r.target === 7770,
      'V13.192 어제의 챌린지 챔피언 1 ~ 3등(오늘 도전해도 어제 기록은 pd · pe로 남는다, 비공개는 이름 숨김)');
    const pv = timingDailyBoard(all, preview, { now: t0 + 1e6 });
    assert(pv.rows.filter(x => x.me).length === 1 && pv.rows.filter(x => x.name === 'preview').length === 1 && !pv.champions.some(x => x.me), 'V13.192 미리보기 계정은 자기 줄만 보이고 챔피언에는 없다');
  }

  /* ---------- 고스트 ---------- */
  {
    assert(ghostLine(30, { k: 'yesterday', e: -150 }) === '어제보다 0.12초 가까워졌어요' && ghostLine(-120, { k: 'yesterday', e: 120 }) === '어제와 똑같은 오차예요'
      && ghostLine(125, { k: 'last', e: 120 }) === '지난 판보다 0.01초 멀어졌어요. 다시 해 봐요!' && ghostLine(120, { k: 'last', e: 125 }) === '지난 판보다 0.01초 가까워졌어요' && ghostLine(124, { k: 'last', e: 120 }) === '지난 판과 똑같은 오차예요'
      && ghostLine(0, { k: 'daily', e: 30 }) === '어제 챌린지보다 0.03초 가까워졌어요' && ghostLine(50, { k: 'daily_old', e: 30 }).startsWith('지난 챌린지보다 0.02초 멀어졌어요') && ghostLine(10, null) === '' && ghostLine(10, { k: 'last', e: null }) === '',
      'V13.192 고스트 문구 경계값: 0.01초 단위로 가까워짐 · 똑같음 · 멀어짐, 어제 · 지난 판 · 어제 챌린지 · 지난 챌린지(조사 와 · 과), 데이터가 없으면 아무것도 안 쓴다');
    const p = { pets: [{ key: 'dog' }] };
    const first = play(p, { ms: 10300, at: t0 });
    const second = play(p, { ms: 9880, at: t0 + 60000 });
    assert(first.ghost.prev === null && first.ghost.best === null && second.ghost.prev.k === 'last' && second.ghost.prev.e === 300 && second.ghost.best === 300 && p.timing.bse === -120,
      'V13.192 고스트: 처음 판은 비교할 것이 없고(아무것도 안 그림), 어제 기록이 없으면 지난 판과, 내 최고(부호 있는 오차) 위치');
    play(p, { ms: 10050, at: t0 + 120000 });
    const next = play(p, { ms: 10010, at: t0 + DAY });
    const later = play(p, { ms: 10200, at: t0 + DAY + 60000 });
    assert(next.ghost.prev.k === 'yesterday' && next.ghost.prev.e === 50 && later.ghost.prev.k === 'yesterday' && later.ghost.prev.e === 50 && later.ghost.best === 10,
      'V13.192 다음 날은 어제 가장 좋은 오차(+0.05)와 비교하고, 그날 내내 같은 어제 기록을 쓴다');
    const far = play(p, { ms: 10100, at: t0 + 5 * DAY });
    const slow = play(p, { ms: 10000, real: 10700, at: t0 + 5 * DAY + 60000 });
    assert(far.ghost.prev.k === 'last' && far.ghost.prev.e === 200 && slow.ghost.prev.e === 100 && p.timing.le === 100, 'V13.192 며칠 쉬면 지난 판과, 인터넷이 느린 판은 고스트 기록(최근 판)에 넣지 않는다');
    const d = { pets: [{ key: 'dog' }] };
    play(d, { ms: 7800, at: t0, daily: { day: today, target: 7770, show: 0 } });
    const y = play(d, { ms: 5010, at: t0 + DAY, daily: { day: day(1), target: 5000, show: 0 } });
    const o = play(d, { ms: 12000, at: t0 + 4 * DAY, daily: { day: day(4), target: 12340, show: 0 } });
    assert(y.ghost.prev.k === 'daily' && y.ghost.prev.e === 30 && o.ghost.prev.k === 'daily_old' && o.ghost.prev.e === 10 && timingView(d, t0 + 4 * DAY, { day: day(4), target: 12340, show: 0 }).daily.prev === null || o.ghost.prev.e === 10,
      'V13.192 챌린지 고스트: 어제 챌린지의 내 오차(목표가 달라도 오차끼리), 며칠 지나면 "지난 챌린지"');
    // 저장 크기: 40일 동안 기본 5판 + 챌린지 1판
    const z = { pets: [{ key: 'dog' }], preview_owner_id: 'x' };
    for (let k = 0; k < 40; k++) { for (let j = 0; j < 5; j++) play(z, { ms: 9500 + j * 97 + k, at: t0 + k * DAY + j * 60000 }); play(z, { ms: 7700 + k, at: t0 + k * DAY + 9e5, daily: { day: day(k), target: 7770, show: 0 } }); }
    const size = JSON.stringify(z.timing).length;
    assert(size <= 700 && Object.keys(z.timing.dc).every(k => ['d', 'n', 't', 'e', 'bn', 'pd', 'pe', 'pt'].includes(k)), `V13.192 학생 기록 p.timing은 작은 키 하나 그대로(240판 뒤 ${size}바이트 ≤ 700, 챌린지는 오늘 · 지난 것 하나씩)`);
  }

  /* ---------- 서버 경로 · 권한 · 미래 설정 숨김 ---------- */
  {
    const state = emptyState(), hash = await passwordHash('QaDaily1!x'), now = Date.now();
    state.profiles.push({ id: 'qa-td-s', username: 'qa-td-s', display_name: '챌린저', role: 'student', active: true, class_name: '고1A', school_id: 'danwon-high', school: '단원고', division: 'high', password_hash: hash, pets: [{ key: 'dog', first: true, acquired_at: now - 9 * DAY }], avatar_key: 'dog', created_at: now - 9 * DAY });
    state.profiles.push({ id: 'qa-td-t', username: 'qa-td-t', display_name: '선생님', role: 'teacher', active: true, password_hash: hash, school_ids: ['danwon-high'], active_school_id: 'danwon-high' });
    const login = async u => (await service(state, 'POST', '/login', { username: u, password: 'QaDaily1!x', division: 'high' }, null))._cookie;
    const ts = await login('qa-td-s'), tt = await login('qa-td-t');
    const as = (token, method, path, body = {}) => service(state, method, path, body, token);
    const code = async fn => { try { await fn(); return 0; } catch (e) { return e.status || 500; } };
    const tv = await as(tt, 'GET', '/teacher/timing-daily');
    const set = await as(tt, 'POST', '/teacher/timing-daily', { day: dayKey(now), target_ms: 7770, show_ms: 2000, msg: '오늘은 7.77초!' });
    await as(tt, 'POST', '/teacher/timing-daily', { day: dayKey(now + 3 * DAY), target_ms: 29990, show_ms: 0, msg: 'FUTURE-MSG' });
    assert(tv.days.length === 14 && set.days[0].target === 7770 && state.timingDaily[dayKey(now)].t === 7770 && await code(() => as(ts, 'POST', '/teacher/timing-daily', { day: dayKey(now), target_ms: 5000, show_ms: 0 })) === 403
      && await code(() => as(ts, 'GET', '/teacher/timing-daily')) === 403 && await code(() => as(tt, 'POST', '/teacher/timing-daily', { day: dayKey(now), target_ms: 99999, show_ms: 0 })) === 400,
      'V13.192 선생님만 오늘의 챌린지를 보고 정한다(학생은 403), 범위 밖 값은 400');
    const boot = await as(ts, 'GET', '/bootstrap'), rw = await as(ts, 'GET', '/rewards');
    const text = JSON.stringify(boot) + JSON.stringify(rw);
    const future = Array.from({ length: D.AHEAD }, (_, i) => dayKey(now + (i + 1) * DAY));
    assert(boot.rewards.timing.daily.target === 7770 && boot.rewards.timing.daily.show === 2000 && boot.rewards.timing.daily.msg === '오늘은 7.77초!' && rw.timing.daily.target === 7770
      && !future.some(d => text.includes(d)) && !text.includes('29990') && !text.includes('FUTURE-MSG') && !('timingDaily' in boot) && boot.timing_daily === undefined,
      'V13.192 학생 홈 · 놀이터 응답에는 오늘 챌린지만(미래 날짜 설정 · 목표 · 메시지 필드 없음)');
    const ping = await as(ts, 'POST', '/timing/ping');
    const st = await as(ts, 'POST', '/timing/start', { id: 'qa-daily-0001', mode: 'daily', target: 10000, echo: ping.echo });
    const me = state.profiles.find(x => x.id === 'qa-td-s');
    me.timing.live.at -= TIMING.COUNTDOWN_MS + 7770 + 100; me.timing.live.r = 100;
    const fin = await as(ts, 'POST', '/timing/finish', { id: 'qa-daily-0001', ms: 7770 });
    assert(st.target === 7770 && st.show_ms === 2000 && st.timing.daily.left === 0 && st.timing.left === 3 && fin.daily && fin.grade === 'ten' && fin.coins === TIMING.COINS.ten + D.BONUS && fin.timing.daily.best === 0
      && me.activity?.at(-1)?.t === '10초 맞추기 오늘의 챌린지 7.77초 ±0.00초 딱 7.77!' && await code(() => as(ts, 'POST', '/timing/start', { id: 'qa-daily-0002', mode: 'daily', echo: Date.now() })) === 409,
      'V13.192 서버 경로: 챌린지 시작은 서버 목표(7.77초 · 2초 보임), 기본 판은 그대로 3판, 끝나면 보상 · 활동 기록 한 줄, 하루 1판');
    const brd = await as(ts, 'GET', '/timing/daily-board');
    assert(brd.kind === 'daily' && brd.rows.length === 1 && brd.rows[0].me && brd.rows[0].err === 0 && brd.target === 7770 && Array.isArray(brd.champions) && await code(() => as(tt, 'GET', '/timing/daily-board')) === 403 && await code(() => as(tt, 'POST', '/timing/start', { id: 'qa-daily-0003', mode: 'daily' })) === 403,
      'V13.192 오늘 순위 경로(학생만), 선생님 계정은 챌린지를 할 수 없다(미리보기 계정으로)');
    assert(await code(() => as(tt, 'POST', '/teacher/timing-daily', { day: dayKey(now), target_ms: 5000, show_ms: 0 })) === 409, 'V13.192 학생이 도전한 뒤 오늘 챌린지를 바꾸면 409');
  }

  /* ---------- 화면 · 구성안 ---------- */
  {
    const ui = source('../public/modules/timing.js'), tui = source('../public/modules/timing-daily-ui.js'), teacher = source('../public/modules/teacher.js'), app = source('../public/app.js'), css = source('../public/v13192.css'), build = source('./build-assets.mjs'), games = source('../public/modules/arcade-games.js');
    assert(ui.includes('function dailyCard(d)') && ui.includes("data-tm=\"daily\"") && ui.includes("api('/timing/start', daily ? { id, mode: 'daily', echo: ping.echo }") && ui.includes("'/timing/daily-board'") && ui.includes('어제의 챌린지 챔피언') && ui.includes("tab('daily', '🎯 챌린지')"),
      'V13.192 학생 화면: 10초 맞추기 안의 오늘의 챌린지 카드(목표 · 메시지 · 참여 보너스 · 도전 · 오늘 순위), 시작은 mode만 보낸다(목표는 서버), 순위 탭 · 어제 챔피언');
    assert(ui.includes('class="tm-ghost gh-${k}"') && ui.includes('ghostLine(res.err, res.ghost?.prev)') && ui.includes("res.checked === 'server' ? '' : ghostLine") && css.includes('.tm-ghost{') && css.includes('.tm-ghost-line.up') && ui.includes('NEW BEST'),
      'V13.192 고스트: 결과 눈금자에 어제 · 지난 판 · 내 최고 옅은 마커, 비교 한 줄(가까워지면 초록), 새 기록은 기존 NEW BEST');
    assert(tui.includes('export async function timingDailyModal()') && tui.includes('dailyCheck(body)') && teacher.includes('${timingDailyEntry()}') && teacher.includes('data-action="timing-daily"') && app.includes("if (d.action === 'timing-daily') return timingDailyModal(A);")
      && css.includes('.tmd-entry-v13192') && css.includes('@media (max-width:720px){.tmd-top-v13192{display:none!important}.tmd-entry-v13192{display:flex}}'),
      'V13.192 선생님 화면: 대시보드 위 "오늘의 챌린지" 버튼(PC) · 입구 카드(폰) → 날짜 · 목표 · 숫자 보임 · 메시지 · 14일 목록');
    assert(games.includes('ag-tm-daily') && build.includes('"v13190.css",\n  "v13192.css",') && build.trim().length > 0 && css.includes('@media (prefers-reduced-motion:reduce)'),
      'V13.192 놀이터 카드에 오늘의 챌린지 한 줄, CSS는 번들에(민트 목록 CSS가 맨 끝 그대로), 움직임 줄이기 대응');
    const doc = source('../docs/timing-daily-design.md');
    assert(['## 1. 멈춤 현상', '## 2. 오늘의 챌린지', '### 선생님 설정 화면', '### 자동으로 정하는 방식', '### 보상', '### 순위', '### 저장 키', '## 3. 고스트', '## 검사', '## 선생님이 정할 것'].every(h => doc.includes(h)),
      'V13.192 docs/timing-daily-design.md 구성안(멈춤 재현 · 챌린지 규칙 · 설정 화면 · 자동 · 보상 · 순위 · 저장 키 · 고스트 · 검사 · 정할 것)');
  }
}
