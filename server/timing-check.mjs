// V13.180 검사: 10초 맞추기(놀이터). 서버 시간 비교(허용 오차 안 · 밖), 한 판 한 번, 하루 판 수 · 코인 상한, 만료,
// 등급 경계값, 순위(미리보기 계정 제외 · 비공개 · 자기 줄 · 같은 학년대), 보상은 서버만, 시작 응답에 정답 시각 같은 필드 없음,
// 저장 크기 상한, 선생님 활동 기록 한 줄, 화면 · 소리 · 구성안. 시간은 모두 가짜 시각으로 돌려 빠르다(실제로 10초를 기다리지 않음).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { TIMING, LEVEL_NAMES, GRADE_KEYS, gradeOf, errText, secText, ledDigits, dailyPlays, guardWindow } from '../public/modules/timing-rules.js';
import { TITLES, titleUnlocked, titleCoins, TITLE_COINS } from '../public/modules/titles.js';
import { SOUND_KEYS } from '../public/modules/sound.js';
import { dayKey } from '../public/modules/core.js';
import { grantTimingPlay, timingView, timingPing, timingStart, timingFinish, timingBoard, timingLine } from './timing.mjs';
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
// 한 판: 서버가 잰 왕복 rtt, 화면이 잰 ms, 실제로 누른 때 real(ms, 기본 ms와 같음) → 끝 도착 = 시작 + 카운트다운 + real + rtt.
function play(p, { level = 'normal', ms, real = ms, rtt = 100, at, result = 'press', id = pid(), pet = null }) {
  timingStart(p, { id, level, echo: at - rtt, now: at });
  return timingFinish(p, { id, result, ms, pet, now: at + TIMING.COUNTDOWN_MS + real + rtt });
}

export async function runTimingChecks(assert) {
  const t0 = Date.parse('2026-10-27T03:00:00Z'); // 화요일 낮(한국 12시)

  /* ---------- 규칙 숫자 · 등급 경계 ---------- */
  assert(TIMING.TARGET === 10000 && TIMING.TARGETS.join() === '10000' && TIMING.LEVELS.join() === 'easy,normal,hard' && TIMING.SHOW_MS.easy === 3000 && TIMING.SHOW_MS.normal === 1000 && TIMING.SHOW_MS.hard === 0,
    'V13.180 목표 10.00초(목표 변주는 TARGETS 자리만), 난이도 3단계: 이지 숫자 3초 · 노말 1초 · 하드 처음부터 숨김');
  assert(TIMING.GRADES.perfect === 50 && TIMING.GRADES.great === 150 && TIMING.GRADES.good === 400 && GRADE_KEYS.join() === 'perfect,great,good,miss',
    'V13.180 등급: 완벽 ±0.05초 · 훌륭 ±0.15초 · 좋음 ±0.4초 · 그 밖 아쉬움');
  assert(gradeOf(0) === 'perfect' && gradeOf(50) === 'perfect' && gradeOf(-50) === 'perfect' && gradeOf(51) === 'great' && gradeOf(-150) === 'great' && gradeOf(151) === 'good'
    && gradeOf(400) === 'good' && gradeOf(-401) === 'miss' && gradeOf(NaN) === 'miss', 'V13.180 등급 경계값: 50 · 150 · 400ms는 안쪽 등급(이하), 1ms 넘으면 다음 등급, 빠름 · 늦음 같게');
  assert(errText(30) === '+0.03초' && errText(-120) === '−0.12초' && errText(0) === '±0.00초' && errText(4) === '±0.00초' && secText(10004) === '10.00' && ledDigits(10037).join('') === '1004' && ledDigits(999999).join('') === '9999',
    'V13.180 오차는 0.01초 단위(+늦음 · −빠름), 숫자판은 초 두 자리 : 1/100초 두 자리');
  assert(TIMING.FREE_DAILY === 5 && TIMING.SOURCES.join() === 'practice,attend' && dailyPlays(0) === 5 && dailyPlays(2) === 7 && dailyPlays(9) === 7 && TIMING.COIN_DAILY === 30,
    'V13.180 도전권은 코인을 안 쓴다: 하루 무료 5판 + 연습 끝내기 · 출석마다 1판(하루 최대 7판), 코인은 하루 30까지');
  const maxCoin = Math.max(...TIMING.LEVELS.flatMap(lv => GRADE_KEYS.map(g => TIMING.COINS[lv][g])));
  assert(TIMING.LEVELS.every(lv => GRADE_KEYS.every((g, i) => !i || TIMING.COINS[lv][g] <= TIMING.COINS[lv][GRADE_KEYS[i - 1]])) && TIMING.COINS.hard.perfect > TIMING.COINS.normal.perfect && TIMING.COINS.normal.perfect > TIMING.COINS.easy.perfect
    && maxCoin * dailyPlays(2) > TIMING.COIN_DAILY && TIMING.XP.perfect === 4 && TIMING.XP.miss === 1, `V13.180 코인은 등급 · 난이도대로(하드 완벽 ${maxCoin}), 하루 최대 판을 다 완벽해도 상한 ${TIMING.COIN_DAILY}에서 멈춘다`);

  /* ---------- 서버 시간 비교(허용 오차) ---------- */
  const w = guardWindow(100);
  assert(w.rtt === 100 && w.lo === -40 && w.hi === 300 && guardWindow(5000).rtt === TIMING.GUARD.RTT_MAX && guardWindow(-5).rtt === 0 && guardWindow(0).hi === TIMING.GUARD.JITTER,
    'V13.180 허용 오차: 서버가 잰 왕복(RTT, 800ms까지) ± (0.15초 + RTT의 절반), 아래는 −40ms보다 작아질 수 없다');
  {
    const p = { pets: [{ key: 'dog' }], preview_owner_id: 'qa' }; // 하루 판 수에 걸리지 않게(미리보기 계정은 30판)
    const ok = play(p, { ms: 10020, rtt: 100, at: t0 });
    assert(ok.valid && ok.grade === 'perfect' && ok.checked === 'client' && ok.err === 20 && ok.ms === 10020 && !ok.unranked && ok.record && ok.coins === TIMING.COINS.normal.perfect && ok.xp === 4,
      'V13.180 허용 오차 안: 화면이 잰 시간(10.02초)을 믿고 완벽 · 기록 · 보상');
    const edge = play(p, { ms: 10000, real: 10000 + w.hi - 100, rtt: 100, at: t0 + 60000 });
    const out = play(p, { ms: 10000, real: 10000 + w.hi - 100 + 1, rtt: 100, at: t0 + 120000 });
    assert(edge.checked === 'client' && edge.grade === 'perfect' && out.checked === 'server' && out.unranked && out.ms === 10201 && out.grade === 'good',
      'V13.180 경계: 남는 시간이 허용 오차 끝(+0.3초)이면 믿고, 1ms만 넘어도 서버가 잰 시간(서버 경과 − RTT)으로 판정 · 순위 제외');
    const cheat = play(p, { level: 'hard', ms: 10000, real: 10700, rtt: 100, at: t0 + 180000 });
    assert(cheat.checked === 'server' && cheat.ms === 10700 && cheat.grade === 'miss' && cheat.coins === TIMING.COINS.hard.miss,
      'V13.180 10.70초에 누르고 10.00초라고 보내면 서버가 잰 10.70초로 아쉬움');
    const lucky = play(p, { level: 'hard', ms: 9000, real: 10010, rtt: 100, at: t0 + 240000 });
    assert(lucky.checked === 'server' && lucky.grade === 'perfect' && lucky.coins === TIMING.COINS.hard.good && lucky.unranked && p.timing.hp === undefined,
      'V13.180 서버 판정으로 완벽이어도 코인은 좋음까지, 순위 · 칭호(하드 완벽)에 넣지 않는다');
    const early = play(p, { ms: 1500, rtt: 100, at: t0 + 300000 });
    const late = play(p, { ms: 20000, rtt: 100, at: t0 + 360000, result: 'timeout' });
    assert(early.grade === 'early' && early.coins === 0 && early.xp === 0 && late.grade === 'miss' && late.ms === 20000 && !late.record,
      `V13.180 최소 시간: ${TIMING.MIN_MS / 1000}초보다 빨리 누르면 실수(보상 · 기록 없음), 목표의 2배가 지나 화면이 멈추면 아쉬움`);
  }

  /* ---------- 한 판 한 번 · 영수증 · 만료 · 무효 ---------- */
  {
    const p = { pets: [{ key: 'dog' }] }, id = pid();
    const s1 = timingStart(p, { id, level: 'easy', echo: t0 - 80, now: t0 });
    const s2 = timingStart(p, { id, level: 'easy', echo: t0 - 80, now: t0 + 10 });
    assert(s1.id === id && !s1.again && s2.again && p.timing.n === 1, 'V13.180 같은 시작(id)을 다시 보내면 판을 또 쓰지 않는다');
    const keys = new Set([...Object.keys(s1), ...Object.keys(s2)]);
    assert([...keys].every(k => ['id', 'level', 'target', 'countdown_ms', 'show_ms', 'again'].includes(k)) && !JSON.stringify(s1).includes(String(t0)),
      'V13.180 시작 응답에는 목표(화면에 보이는 규칙) · 카운트다운 · 숨김 시간만: 서버 시각 · 끝나야 할 시각 같은 필드가 없다');
    const f1 = timingFinish(p, { id, ms: 10000, now: t0 + 13080 });
    const before = coinsOf(p);
    const f2 = timingFinish(p, { id, ms: 10000, now: t0 + 13090 });
    assert(f1.grade === 'perfect' && f2.again && f2.grade === 'perfect' && coinsOf(p) === before && p.timing.all === 1, 'V13.180 같은 끝내기를 다시 보내면 같은 답(보상 · 기록은 한 번)');
    assert(status(() => timingFinish(p, { id: 'tm-none-0001', ms: 10000, now: t0 + 14000 })) === 404 && status(() => timingFinish(p, { id, ms: 9000, now: t0 + 20000 })) === 0,
      'V13.180 모르는 판의 끝 신호는 404');
    const id2 = pid();
    timingStart(p, { id: id2, level: 'normal', echo: t0 + 1e5 - 50, now: t0 + 1e5 });
    const gone = timingFinish(p, { id: id2, ms: 10000, now: t0 + 1e5 + TIMING.LIVE_MS + 1 });
    const id3 = pid();
    timingStart(p, { id: id3, level: 'normal', echo: t0 + 2e5 - 50, now: t0 + 2e5 });
    const voided = timingFinish(p, { id: id3, result: 'void', now: t0 + 2e5 + 6000 });
    assert(!gone.valid && gone.reason === 'expired' && !voided.valid && voided.reason === 'void' && p.timing.n === 3 && coinsOf(p) === before,
      `V13.180 시작 뒤 ${TIMING.LIVE_MS / 1000}초 안에 끝 신호가 없으면 무효, 화면이 가려지면(void) 무효: 판은 쓰고 보상 없음`);
    assert(status(() => timingStart(p, { id: pid(), level: 'expert', now: t0 })) === 400 && status(() => timingStart(p, { id: pid(), level: 'easy', target: 7000, now: t0 })) === 400 && status(() => timingStart(p, { level: 'easy', now: t0 })) === 400,
      'V13.180 난이도 · 목표 시간(TARGETS에 있는 것만) · 판 번호를 확인한다');
  }

  /* ---------- 하루 판 수 · 추가 판 · 코인 상한 ---------- */
  {
    const p = { pets: [{ key: 'dog' }] }, at = i => t0 + i * 60000;
    let i = 0;
    for (; i < 5; i++) play(p, { level: 'hard', ms: 10000, at: at(i) });
    assert(status(() => timingStart(p, { id: pid(), level: 'hard', echo: at(9), now: at(9) })) === 409 && timingView(p, at(9)).left === 0, 'V13.180 하루 무료 5판을 다 쓰면 409');
    assert(grantTimingPlay(p, 'practice', at(10)) && !grantTimingPlay(p, 'practice', at(11)) && grantTimingPlay(p, 'attend', at(12)) && !grantTimingPlay(p, 'match', at(12)) && timingView(p, at(12)).left === 2 && timingView(p, at(12)).plays === 7,
      'V13.180 연습 끝내기 · 출석마다 하루 1판 더(같은 곳은 하루 한 번, 다른 곳은 안 됨)');
    const r6 = play(p, { level: 'hard', ms: 10000, at: at(13) });
    play(p, { level: 'hard', ms: 10000, at: at(14) });
    assert(status(() => timingStart(p, { id: pid(), level: 'hard', echo: at(15), now: at(15) })) === 409 && coinsOf(p) === TIMING.COIN_DAILY && timingView(p, at(15)).coin_left === 0 && r6.capped && r6.coins === 0 && xpOf(p) === 7 * TIMING.XP.perfect,
      `V13.180 하드 완벽 7판(${7 * TIMING.COINS.hard.perfect}코인어치)도 하루 코인은 ${TIMING.COIN_DAILY}에서 멈추고 경험치는 그대로`);
    const next = at(0) + DAY;
    assert(timingView(p, next).left === 5 && timingView(p, next).coin_left === TIMING.COIN_DAILY && timingView(p, next).got.practice === false, 'V13.180 다음 날(한국 날짜)은 판 · 코인 · 추가 판이 새로');
    assert(p.timing.st === 7 && p.timing.sb === 7 && p.timing.pf === 7 && p.timing.hp === 7 && titleUnlocked('timing-human', { timing_streak: p.timing.sb }) && titleUnlocked('timing-blind', { timing_hard: 1 }) && !titleUnlocked('timing-clock', { timing_perfect: 9 }) && titleUnlocked('timing-clock', { timing_perfect: 10 }),
      'V13.180 칭호 숫자: 완벽 수 · 하드 완벽 수 · 최고 연속 완벽');
    play({ pets: [] , timing: p.timing }, { ms: 10300, at: next });
    assert(p.timing.st === 0 && p.timing.sb === 7, 'V13.180 완벽이 아니면 연속 완벽이 끊긴다(최고 기록은 그대로)');
  }

  /* ---------- 칭호 ---------- */
  const tk = ['timing-clock', 'timing-blind', 'timing-human'];
  assert(tk.every(k => TITLES[k]?.group === 'arcade') && TITLES['timing-clock'].name === '시계 장인' && TITLES['timing-clock'].goal === 10 && TITLES['timing-human'].goal === 3 && TITLES['timing-blind'].stat === 'timing_hard'
    && titleCoins('timing-human') === TITLE_COINS.legendary && source('./competition.mjs').includes('timing_perfect: p => Number(p?.timing?.pf || 0)') && source('./competition.mjs').includes('timing_streak: p => Number(p?.timing?.sb || 0)'),
    'V13.180 칭호 3개(놀이터): 시계 장인(완벽 10번) · 눈 감고도 10초(하드 완벽) · 인간 초시계(완벽 3번 연속), 서버가 학생 기록에서 센다');

  /* ---------- 순위 ---------- */
  {
    const mk = (id, extra = {}) => ({ id, role: 'student', active: true, class_name: '고1A', division: 'high', school: '단원고', display_name: id, avatar_key: 'cat', pets: [{ key: 'cat' }], ...extra });
    const me = mk('me'), others = Array.from({ length: 24 }, (_, i) => mk(`s${i}`));
    const hide = mk('private', { ranking_public: false }), preview = mk('preview', { preview_owner_id: 't1' }), off = mk('off', { active: false }), mid = mk('mid', { class_name: '중2A', division: 'middle' }), high2 = mk('high2', { class_name: '고2B' });
    const atW = t0 + 3600000;
    others.forEach((x, i) => { for (let k = 0; k < 5; k++) play(x, { ms: 10000 + (i % 2 ? 1 : -1) * (i + 1) * 10, at: atW + k * 60000 }); });
    for (const x of [hide, preview, off, mid, high2]) for (let k = 0; k < 5; k++) play(x, { ms: 10000, at: atW + k * 60000 });
    for (let k = 0; k < 4; k++) play(me, { ms: 10900, at: atW + k * 60000 });
    const all = [me, ...others, hide, preview, off, mid, high2];
    const best = timingBoard(all, me, { level: 'normal', kind: 'best', now: atW + DAY, hidden: x => x.ranking_public === false });
    const names = best.rows.map(r => r.name);
    assert(best.total === 26 && best.rows.length === TIMING.BOARD_TOP + 1 && best.rows.at(-1).me && best.rows.at(-1).rank === 26 && names.includes('비공개 학생') && !names.includes('private')
      && !['preview', 'off', 'mid', 'high2'].some(n => names.includes(n)) && best.rows[0].err === 0,
      'V13.180 이번 주 최고 기록 순위: 같은 학년대만, 교사 미리보기 · 쉬는 학생 제외, 비공개 학생은 이름을 숨기고, 내 줄은 20등 밖이어도 붙는다');
    const avg = timingBoard(all, me, { level: 'normal', kind: 'avg', now: atW + DAY });
    assert(avg.rows.length === TIMING.BOARD_TOP && !avg.rows.some(r => r.me) && avg.total === 25 && avg.avg_min === TIMING.AVG_MIN, `V13.180 평균 오차 순위는 ${TIMING.AVG_MIN}판 이상(4판인 나는 아직 없음)`);
    play(me, { ms: 10900, at: atW + 9 * 60000 });
    const avg2 = timingBoard(all, me, { level: 'normal', kind: 'avg', now: atW + DAY });
    assert(avg2.rows.at(-1).me && avg2.rows.at(-1).err === 900, 'V13.180 5판을 채우면 평균 오차 줄이 생긴다(합 오차 ÷ 판 수)');
    const pv = timingBoard(all, preview, { level: 'normal', now: atW + DAY });
    assert(pv.rows.some(r => r.me) && pv.rows.filter(r => r.name === 'preview').length === 1 && !timingBoard(all, me, { level: 'hard', now: atW + DAY }).rows.length && !timingBoard(all, me, { level: 'normal', now: atW + 8 * DAY }).rows.length,
      'V13.180 교사 미리보기 계정은 자기 줄만 보이고, 순위는 난이도마다 · 이번 주만');
  }

  /* ---------- 저장 크기 ---------- */
  {
    const p = { pets: [{ key: 'dog' }], preview_owner_id: 'x' };
    for (let d = 0; d < 20; d++) for (let k = 0; k < 10; k++) play(p, { level: TIMING.LEVELS[k % 3], ms: 9500 + k * 97, at: t0 + d * DAY + k * 60000 });
    const size = JSON.stringify(p.timing).length;
    assert(size <= 600 && p.timing.all === 200 && !p.timing.done, `V13.180 학생 기록 p.timing은 작은 키 하나(200판 뒤 ${size}바이트 ≤ 600, 영수증은 마지막 판 하나)`);
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
    assert(boot.rewards.timing?.left === 5 && JSON.stringify(me) === before, 'V13.180 홈 데이터에 10초 맞추기가 오고, 읽기만으로 학생 기록이 바뀌지 않는다');
    const ping = await call('POST', '/timing/ping');
    assert(Object.keys(ping).join() === 'echo' && JSON.stringify(me) === before && Math.abs(ping.echo - Date.now()) < 5000, 'V13.180 ping은 서버 시각만 주고 기록을 바꾸지 않는다(쓰기 없음)');
    let bad = 0; try { await call('POST', '/timing/start', { level: 'normal' }); } catch (e) { bad = e.status; }
    const st = await call('POST', '/timing/start', { id: 'qa-timing-0001', level: 'normal', echo: ping.echo });
    assert(bad === 400 && st.id === 'qa-timing-0001' && st.timing.left === 4 && st.show_ms === 1000 && !('at' in st) && me.timing.live.r <= TIMING.GUARD.RTT_MAX, 'V13.180 시작은 판 번호가 있어야 하고 판을 하나 쓴다');
    // 실제로 10초를 기다리지 않고 서버가 잰 시작 시각을 13.1초 앞으로 옮긴다(남는 시간 = RTT).
    me.timing.live.at -= TIMING.COUNTDOWN_MS + 10000 + 100; me.timing.live.r = 100;
    const fin = await call('POST', '/timing/finish', { id: 'qa-timing-0001', ms: 10000, coins: 999, grade: 'perfect', xp: 999 });
    const again = await call('POST', '/timing/finish', { id: 'qa-timing-0001', ms: 10000 });
    assert(fin.valid && fin.grade === 'perfect' && fin.coins === TIMING.COINS.normal.perfect && fin.xp === 4 && again.again && typeof fin.points_balance === 'number' && coinsOf(me) === TIMING.COINS.normal.perfect,
      'V13.180 보상은 서버만 정한다(화면이 보낸 coins · grade · xp는 무시), 다시 보내도 한 번');
    assert(me.activity?.at(-1)?.k === 'timing' && me.activity.at(-1).t === `10초 맞추기 ${LEVEL_NAMES.normal} ${errText(fin.err)} 완벽` && timingLine({ valid: true, level: 'hard', err: 30, grade: 'perfect' }) === '10초 맞추기 하드 +0.03초 완벽' && me.usage?.today?.timing === 1,
      'V13.180 선생님 활동 기록에 한 줄("10초 맞추기 하드 +0.03초 완벽"), 같은 끝내기를 다시 보내도 한 줄');
    const brd = await call('GET', '/timing/board', { level: 'normal', kind: 'best' });
    assert(brd.rows.length === 1 && brd.rows[0].me && brd.rows[0].err === Math.abs(fin.err), 'V13.180 순위 경로(GET)');
    me.attendance = { card: 1, last: dayKey(Date.now() - DAY), streak: 1 };
    const att = await call('POST', '/attendance/check');
    assert(att.timing_play === true && att.timing.got.attend && att.timing.left === 5, 'V13.180 출석하면 10초 맞추기 한 판 더');
    assert(publicProfile(me).timing && !JSON.stringify(publicProfile(me).timing).includes('"echo"'), 'V13.180 학생 기록은 작은 키 하나로 프로필에 실린다(비밀 값 없음)');
    const svc = source('./service.mjs');
    assert(svc.includes("if (complete && student && answerRecords.length >= TIMING.MIN_PRACTICE) grantTimingPlay(student, 'practice', finalizedAt);") && svc.includes("'hunt', 'blank', 'timing'].filter(k => old[k])") && svc.includes("if (!res.again) logActivity(p, 'timing', timingLine(res), now);"),
      'V13.180 끝까지 푼 연습(10문제 이상)도 한 판 더, 로그인 때 기록을 지키고, 끝날 때만 활동 기록');
    const routes = svc.slice(svc.indexOf("if (path === '/timing/ping'"), svc.indexOf("if (path === '/hunt/home'"));
    assert((routes.match(/requireRole\(p, 'student'\);/g) || []).length === 4 && (routes.match(/if \(path === '\/timing\//g) || []).length === 4, 'V13.180 10초 맞추기 경로 넷(ping · 시작 · 끝 · 순위)은 학생만');
  }

  /* ---------- 화면 · 소리 · 구성안 ---------- */
  {
    const ui = source('../public/modules/timing.js'), css = source('../public/v13180.css'), games = source('../public/modules/arcade-games.js'), app = source('../public/app.js'), build = source('./build-assets.mjs');
    assert(ui.includes('performance.now()') && ui.includes("document.addEventListener('visibilitychange', T.onVis)") && ui.includes("addEventListener('pagehide', T.onVis)") && ui.includes("result: 'void'") && ui.includes('navigator.vibrate?.(p)') && ui.includes("api('/timing/ping', {})") && ui.includes('echo: ping.echo'),
      'V13.180 화면: performance.now()로 재고, 화면이 가려지거나 나가면 그 판은 무효(void), 진동은 지원할 때만, 시작 전 ping');
    assert(ui.includes("btn.addEventListener('pointerdown', onPointerDown)") && ui.includes("e.code === 'Space'") && ui.includes('if (e.repeat) return;') && ui.includes('stampOf(e)') && css.includes('touch-action:none'),
      'V13.180 큰 버튼: 터치 · 마우스(pointerdown) · 스페이스, 누른 순간은 이벤트 시각으로, 꾹 눌러 반복 입력은 무시');
    assert(['tm-btn-base', 'tm-btn-side', 'tm-btn-top', 'tm-btn-shine', 'tm-btn-well', 'tm-spill'].every(c => ui.includes(c) && css.includes(`.${c}`)) && css.includes('.tm-btn.down .tm-btn-top{transform:translateY(') && css.includes('@keyframes tmUpTop') && css.includes('@keyframes tmSpill'),
      'V13.180 입체 버튼: 받침 · 옆면 · 윗면 · 반사광 · 안쪽 구멍, 누르면 깊이 내려가고 손을 떼면 튕겨 오르며, 아래로 빛이 번진다');
    assert(ui.includes("const DIGIT = { 0: 'abcdef'") && css.includes('.tm-led .sg{fill:var(--tm-off)') && css.includes('.tm-led .sg.on{fill:var(--tm-red)}') && css.includes('@keyframes tmFlicker') && css.includes('.tm-led.hid .hd{') && ui.includes('tm-colon') && css.includes('@keyframes tmReveal'),
      'V13.180 LED: 7-세그먼트 SVG(꺼진 세그먼트 잔광 · 켜진 글로우 · 깜빡임), 숨김은 점이 숨 쉬고, 콜론 깜빡, 공개 때 번쩍');
    assert(ui.includes('function reveal(ms)') && ui.includes('Math.max(0, ms - 500)') && ui.includes('function ruler(res)') && ui.includes('function perfectShow()') && ui.includes('NEW BEST') && ui.includes('연속 완벽 ×') && ui.includes('CHEERS[g]') && ui.includes('GRADE_MARKS[g]'),
      'V13.180 결과: 눌린 순간 0.5초를 늘려 공개(슬로모션), 눈금자, 완벽 번쩍 · 파티클, 최고 기록 · 연속 완벽, 낮은 등급 격려, 색 + 기호로 등급');
    assert(css.includes('@media (prefers-reduced-motion:reduce)') && css.includes('.tm-confetti,.tm-flash{display:none}') && ui.includes('if (reduced()) return;') && css.includes('@media (min-width:760px)') && css.includes('(orientation:landscape)'),
      'V13.180 움직임 줄이기면 파티클 · 번쩍 · 흔들림을 끄고, 가로 · PC 배치가 있다');
    const used = [...ui.matchAll(/sfx\('([a-z-]+)'/g)].map(m => m[1]);
    assert(used.length >= 10 && used.every(k => SOUND_KEYS.includes(k)) && ['tm-count', 'tm-go', 'tm-hide', 'tm-tick', 'tm-press', 'tm-reveal', 'tm-perfect', 'tm-great', 'tm-good', 'tm-miss', 'tm-record'].every(k => SOUND_KEYS.includes(k) && used.includes(k) && source('../docs/sound/timing-synth.mjs').includes(`def('${k}'`))
      && ui.includes("const tickOn = () => readPref(TICK_KEY, 'on') === 'on';") && ui.includes('if (tickOn() && sec > 0)'), 'V13.180 소리 11개(docs/sound/timing-synth.mjs로 합성): 카운트다운 · 시작 · 숨김 · 째깍(설정으로 끔) · 버튼 · 공개 · 등급 4개 · 기록 갱신');
    assert(!/\.webp|\.png/.test(ui) && !/url\(\/assets/.test(css) && games.includes('export function timingCard(A)') && games.includes('${timingCard(A)}') && games.includes('data-action="timing-open"') && app.includes("if (d.action === 'timing-open')") && build.includes('"v13180.css"'),
      'V13.180 그림 파일 없이 코드로 그리고, 놀이터 게임 카드 → 게임 화면으로 들어간다');
    const doc = source('../docs/timing-design.md');
    assert(['## 규칙', '## 등급', '## 도전권', '## 보상', '## 하루 가치', '## 순위', '## 서버 판정', '## 연출', '## 소리', '## 저장 키', '## 부정 방지와 한계', '## 선생님이 정할 것'].every(h => doc.includes(h)), 'V13.180 docs/timing-design.md 구성안');
  }
}
