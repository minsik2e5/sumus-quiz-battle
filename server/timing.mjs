import { dayKey } from '../public/modules/core.js';
import { TIMING, TOP_GRADES, gradeOf, gradeName, errText, secText, targetOk, dailyPlays, guardWindow, autoDailyTarget, dailyCheck } from '../public/modules/timing-rules.js';
import { addBonus } from './rewards.mjs';
import { rankingWeek, sameGradeBand } from './competition.mjs';

// V13.180 10초 맞추기(놀이터) 서버 쪽. 학생 기록 p.timing(작은 키 하나, 판이 끝날 때만 쓴다):
//   { d: 오늘, n: 오늘 쓴 판, b: [오늘 추가 판을 받은 곳], c: 오늘 받은 코인, tn: 오늘 딱 10.00 100코인을 받은 수,
//     live{ id, t: 목표, at: 시작 도착 시각, r: 서버가 잰 RTT }, last{ id, r } (마지막 판 영수증),
//     best: 가장 작은 오차, wk{ k: 주 시작, b: 최고, n: 판 수, s: 오차 합 }, q: 최근 믿은 판 등급(완벽 이상 '1' · 그 밖 '0', 운 감시),
//     pf: 완벽 이상 수, x10: 딱 10.00 수, st: 지금 연속 완벽, sb: 최고 연속 완벽, all: 모든 판,
//     V13.192 고스트: le 가장 최근 믿은 판 오차, bse 최고 기록 오차(부호), db{ d, e } 오늘 가장 좋은 오차, yb{ d, e } 그 전 날,
//     dc{ d: 챌린지 날, n: 그날 판, t: 그날 목표, e: 그날 최고 오차(부호, 믿은 판만), bn: 참여 보너스 받음, pd · pe · pt: 지난 챌린지 날 · 오차 · 목표 } }
// 선생님 설정 state.timingDaily = { 'YYYY-MM-DD': { t: 목표 ms, s: 숫자 보임 ms, m: 메시지, at, by } } (오늘 + 13일, 지난 14일까지만).
// 판 흐름: /timing/ping(쓰기 없음, 서버 시각) → /timing/start(판을 쓰고 live) → 3 · 2 · 1 → 누름 → /timing/finish.
// 서버는 시작 도착 ~ 끝 도착을 재서 화면이 보낸 시간과 비교한다(TIMING.GUARD). V13.191 벗어나면 화면 숫자는 누른 값 그대로,
// 코인 · 순위 · 기록 · 칭호에서 빼고 경험치만 서버가 잰 시간으로 준다. 기록 · 보상은 서버만 정한다.

const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };
const DAY_MS = 86400000;
const liveMs = target => Math.max(TIMING.LIVE_MS, target * TIMING.MAX_FACTOR + TIMING.COUNTDOWN_MS + 15000);
const minMs = target => Math.min(TIMING.MIN_MS, Math.round(target * .4)); // 0.5초 챌린지도 '너무 빠름'이 목표보다 앞이게
const tm = p => p.timing ||= {};
const weekStart = now => rankingWeek(now).start;

function today(t, now) {
  const d = dayKey(now);
  if (t.d !== d) { t.d = d; t.n = 0; t.b = []; t.c = 0; t.tn = 0; }
  return t;
}
const playsOf = p => p.preview_owner_id ? TIMING.PREVIEW_PLAYS : dailyPlays((p.timing?.b || []).length);

// 공부로 한 판 더(연습 끝내기 · 출석, 곳마다 하루 1판). 받았으면 true.
export function grantTimingPlay(p, source, now = Date.now()) {
  if (!TIMING.SOURCES.includes(source)) return false;
  const t = today(tm(p), now);
  if (t.b.includes(source)) return false;
  t.b = [...t.b, source];
  return true;
}

// 지난 챌린지(오늘 것 말고 가장 최근): { day, e, k: 'daily'(어제) | 'daily_old' }
function prevDaily(t, now) {
  const c = t.dc, today = dayKey(now), yd = dayKey(now - DAY_MS);
  const rec = c?.d !== today && c?.e != null ? { day: c.d, e: c.e } : c?.pd ? { day: c.pd, e: c.pe } : null;
  return rec ? { ...rec, k: rec.day === yd ? 'daily' : 'daily_old' } : null;
}
const dailyLimit = p => p.preview_owner_id ? TIMING.PREVIEW_PLAYS : TIMING.DAILY.PLAYS;
function dailyView(p, now, cfg) {
  if (!cfg) return null;
  const t = p.timing || {}, c = t.dc?.d === cfg.day ? t.dc : null, n = Number(c?.n || 0), limit = dailyLimit(p);
  return { day: cfg.day, target: cfg.target, show: cfg.show, msg: cfg.msg, auto: cfg.auto, left: Math.max(0, limit - n), plays: limit, played: n > 0, best: c?.e ?? null, bonus: TIMING.DAILY.BONUS, bonus_got: !!c?.bn, prev: prevDaily(t, now) };
}

export function timingView(p, now = Date.now(), daily = null) {
  const t = p.timing || {}, on = t.d === dayKey(now); // 읽기만(보기에서 기록을 만들지 않는다)
  const got = on ? t.b || [] : [], plays = p.preview_owner_id ? TIMING.PREVIEW_PLAYS : dailyPlays(got.length);
  const wk = t.wk?.k === weekStart(now) && t.wk.n ? t.wk : null;
  return {
    target: TIMING.TARGET, left: Math.max(0, plays - (on ? Number(t.n || 0) : 0)), plays, max: dailyPlays(TIMING.SOURCES.length),
    got: Object.fromEntries(TIMING.SOURCES.map(s => [s, got.includes(s)])),
    coin_left: Math.max(0, TIMING.COIN_DAILY - (on ? Number(t.c || 0) : 0)), ten_left: Math.max(0, TIMING.TEN_DAILY - (on ? Number(t.tn || 0) : 0)),
    best: t.best ?? null, week: wk ? { best: wk.b, n: wk.n, avg: Math.round(wk.s / wk.n) } : null,
    perfect: Number(t.pf || 0), ten: Number(t.x10 || 0), streak: Number(t.st || 0), streak_best: Number(t.sb || 0), total: Number(t.all || 0),
    daily: dailyView(p, now, daily)
  };
}

// 시작 전 ping: 쓰기 없이 서버 시각만. 화면은 받자마자 /timing/start에 echo로 돌려보낸다(서버가 그 사이를 RTT로 잰다).
export const timingPing = (now = Date.now()) => ({ echo: now });

// 판 시작: 판을 하나 쓰고 서버 시각을 남긴다. 같은 id를 다시 보내면 판을 또 쓰지 않는다.
// 응답에는 목표(화면에 '10.00초를 맞춰라'로 보이는 규칙)와 숨김 시간만: 서버 시각 · 끝나야 할 시각 같은 것은 보내지 않는다.
// V13.192 mode 'daily': 오늘의 챌린지(목표 · 숫자 보임은 서버 설정 daily에서, 기본 판과 따로 하루 DAILY.PLAYS판).
export function timingStart(p, { id, target = TIMING.TARGET, mode = 'normal', daily = null, echo = null, now = Date.now() }) {
  if (!id) fail('판 번호가 없어요.');
  const isDaily = mode === 'daily';
  if (isDaily && !daily) fail('오늘의 챌린지를 찾지 못했어요.', 404);
  if (!isDaily && !targetOk(target)) fail('목표 시간을 확인해 주세요.');
  const goal = isDaily ? daily.target : Number(target), show = isDaily ? daily.show : TIMING.SHOW_MS;
  const t = today(tm(p), now);
  const answer = () => ({ id, target: goal, countdown_ms: TIMING.COUNTDOWN_MS, show_ms: show, ...(isDaily ? { mode: 'daily' } : {}) });
  if (t.live?.id === id && now - t.live.at < liveMs(t.live.t)) return { ...answer(), again: true };
  const c = isDaily ? dcOf(t, now) : null;
  if (isDaily && Number(c.n || 0) >= dailyLimit(p)) fail('오늘의 챌린지는 이미 했어요. 내일 새 챌린지가 열려요!', 409);
  if (!isDaily && Number(t.n || 0) >= playsOf(p)) fail(t.b.length < TIMING.SOURCES.length ? '오늘 판을 다 했어요. 연습을 끝내거나 출석하면 한 판 더!' : '오늘 판을 다 했어요. 내일 또 만나요!', 409);
  // 끝내지 않은 앞 판(나가기 · 화면 가림)은 무효: 연속 완벽도 끊긴다.
  if (t.live) t.st = 0;
  const e = Number(echo), rtt = Number.isFinite(e) && e <= now ? now - e : TIMING.GUARD.RTT_MAX;
  if (isDaily) { c.n = Number(c.n || 0) + 1; c.t = goal; } else t.n = Number(t.n || 0) + 1;
  t.live = { id, t: goal, at: now, r: Math.min(TIMING.GUARD.RTT_MAX, Math.max(0, rtt)), ...(isDaily ? { m: 'd' } : {}) };
  return answer();
}
// 챌린지 날이 바뀌면 그 전 날 최고 오차를 지난 챌린지(pd · pe · pt)로 넘긴다.
function dcOf(t, now) {
  const d = dayKey(now), c = t.dc ||= {};
  if (c.d !== d) {
    if (c.d && c.e != null) Object.assign(c, { pd: c.d, pe: c.e, pt: c.t });
    c.d = d; c.n = 0; c.t = null; delete c.e; delete c.bn;
  }
  return c;
}

// 판 끝. result: 'press'(눌렀다) | 'timeout'(목표의 2배가 지나 화면이 멈춤) | 'void'(화면이 가려짐 · 나감).
// ms: 화면이 performance.now()로 잰 경과(카운트다운 뒤부터). 같은 끝내기를 다시 보내면 같은 답.
export function timingFinish(p, { id, result = 'press', ms, pet = null, now = Date.now() }) {
  const t = tm(p);
  if (id && t.last?.id === id) return { ...t.last.r, again: true };
  const live = t.live;
  if (!id || !live || live.id !== id) fail('10초 맞추기 판을 찾지 못했어요.', 404);
  delete t.live;
  const out = settle(p, t, live, { result, ms, pet, now });
  t.last = { id, r: out };
  return out;
}
const coinCap = g => TOP_GRADES.includes(g) || g === 'great' ? 'good' : g;
function settle(p, t, live, { result, ms, pet, now }) {
  const isDaily = live.m === 'd', base = { target: live.t, ...(isDaily ? { daily: true } : {}) };
  if (now - live.at > liveMs(live.t)) { t.st = 0; return { ...base, valid: false, reason: 'expired' }; }
  if (result === 'void') { t.st = 0; return { ...base, valid: false, reason: 'void' }; }
  // 고스트(기록을 바꾸기 전): 보통 판은 어제 가장 좋은 오차(없으면 가장 최근 판) · 내 최고, 챌린지는 지난 챌린지 · 오늘 앞 판.
  const yd = dayKey(now - DAY_MS), c = isDaily ? dcOf(t, now) : null;
  const yb = t.db?.d === yd ? t.db : t.yb?.d === yd ? t.yb : null, pdy = isDaily ? prevDaily(t, now) : null;
  const ghost = isDaily
    ? { prev: pdy ? { k: pdy.k, e: pdy.e } : null, best: c.e ?? null }
    : { prev: yb ? { k: 'yesterday', e: yb.e } : t.le != null ? { k: 'last', e: t.le } : null, best: t.bse ?? null };
  // 챌린지 참여 보너스: 하루 한 번, 하루 코인 상한 밖(눌러서 끝낸 판이면 너무 빨라도 · 인터넷이 느려도 준다).
  const bonus = isDaily && !c.bn ? TIMING.DAILY.BONUS : 0;
  if (bonus) c.bn = 1;
  const server = now - live.at - TIMING.COUNTDOWN_MS; // 서버가 잰 시간(왕복 지연 하나가 더 들어 있다)
  const claimed = Math.round(Number(ms));
  const { lo, hi } = guardWindow(live.r), gap = server - claimed;
  const trusted = Number.isFinite(claimed) && gap >= lo && gap <= hi;
  // V13.191 벗어나도 화면 숫자(누른 값)는 그대로 보여 준다(서버 값으로 바꾸면 "누른 것보다 늦게 찍혔다"로 보인다).
  //   그 판은 코인 · 순위 · 기록 · 칭호에서 빠지고, 경험치만 서버 측정값(서버가 잰 시간 − RTT) 등급으로 준다.
  const measured = Math.round(server - live.r);
  const used = Number.isFinite(claimed) ? claimed : measured;
  const timeout = result === 'timeout' || used >= live.t * TIMING.MAX_FACTOR;
  const shown = timeout ? Math.max(used, live.t * TIMING.MAX_FACTOR) : used;
  const day = today(t, now);
  t.all = Number(t.all || 0) + 1;
  if (shown < minMs(live.t)) {
    if (!isDaily) t.st = 0;
    if (bonus) addBonus(p, { xp: 0, coins: bonus, pet, now });
    return { ...base, valid: true, ms: shown, err: shown - live.t, grade: 'early', coins: bonus, xp: 0, bonus, ghost, checked: trusted ? 'client' : 'server', ...(trusted ? {} : { unranked: true }) };
  }
  const err = shown - live.t, abs = Math.abs(err), grade = timeout ? 'miss' : gradeOf(err), top = TOP_GRADES.includes(grade);
  // 운 감시: 최근 믿은 판에서 완벽 이상이 너무 잦으면 이번 판은 서버 판정과 같이 다룬다.
  const recent = String(t.q || '').slice(-(TIMING.LUCK_GUARD.WINDOW - 1));
  const lucky = trusted && top && [...recent].filter(c => c === '1').length >= TIMING.LUCK_GUARD.MAX;
  const clean = trusted && !lucky;
  if (trusted) t.q = (recent + (top ? '1' : '0')).slice(-TIMING.LUCK_GUARD.WINDOW);
  // 운 감시 판은 순위 · 칭호에 넣지 않고 코인은 '좋음'까지만, 서버가 못 믿은 판은 코인 0. 딱 10.00의 100코인은 하루 한 번(그 뒤는 완벽 코인).
  let coinGrade = !trusted ? 'miss' : clean ? grade : coinCap(grade);
  if (coinGrade === 'ten' && Number(day.tn || 0) >= TIMING.TEN_DAILY) coinGrade = 'perfect';
  if (coinGrade === 'ten') day.tn = Number(day.tn || 0) + 1;
  const want = TIMING.COINS[coinGrade], coins = Math.max(0, Math.min(want, TIMING.COIN_DAILY - Number(day.c || 0)));
  const serverGrade = timeout || measured >= live.t * TIMING.MAX_FACTOR ? 'miss' : measured < minMs(live.t) ? null : gradeOf(measured - live.t);
  const xp = trusted ? TIMING.XP[grade] : serverGrade ? TIMING.XP[serverGrade] : 0;
  day.c = Number(day.c || 0) + coins;
  addBonus(p, { xp, coins: coins + bonus, pet, now });
  let record = false, weekRecord = false;
  if (isDaily) {
    // 챌린지는 기본 판 기록(최고 · 주 · 연속 · 칭호)과 따로: 그날 최고 오차만.
    if (clean && !timeout && (c.e == null || abs < Math.abs(c.e))) { record = c.e != null; c.e = err; }
    return {
      ...base, valid: true, ms: shown, err, grade, coins: coins + bonus, bonus, xp, record, ghost, checked: trusted ? 'client' : 'server',
      ...(clean ? {} : { unranked: true }), ...(lucky ? { lucky: true } : {}), ...(grade === 'ten' && coinGrade !== 'ten' && clean ? { ten_used: true } : {}), ...(coins < want ? { capped: true } : {}),
      ...(trusted ? {} : { server_err: measured - live.t })
    };
  }
  if (clean && !timeout) {
    // 고스트 재료: 가장 최근 판 · 오늘 가장 좋은 오차(날이 바뀌면 그 전 날로).
    t.le = err;
    const d = dayKey(now);
    if (t.db?.d !== d) { if (t.db) t.yb = t.db; t.db = { d, e: err }; } else if (abs < Math.abs(t.db.e)) t.db.e = err;
    record = t.best == null || abs < t.best;
    if (record) { t.best = abs; t.bse = err; }
    const k = weekStart(now);
    if (t.wk?.k !== k) t.wk = { k, b: abs, n: 0, s: 0 };
    weekRecord = !t.wk.n || abs < t.wk.b;
    t.wk.b = Math.min(t.wk.b, abs); t.wk.n += 1; t.wk.s += abs;
  }
  if (clean && top) {
    t.pf = Number(t.pf || 0) + 1;
    if (grade === 'ten') t.x10 = Number(t.x10 || 0) + 1;
    t.st = Number(t.st || 0) + 1;
    t.sb = Math.max(Number(t.sb || 0), t.st);
  } else t.st = 0;
  return {
    ...base, valid: true, ms: shown, err, grade, coins, xp, record, week_record: weekRecord, streak: Number(t.st || 0), ghost, checked: trusted ? 'client' : 'server',
    ...(clean ? {} : { unranked: true }), ...(lucky ? { lucky: true } : {}), ...(grade === 'ten' && coinGrade !== 'ten' && clean ? { ten_used: true } : {}), ...(coins < want ? { capped: true } : {}),
    ...(trusted ? {} : { server_err: measured - live.t })
  };
}

// 선생님 활동 기록 한 줄: "10초 맞추기 +0.03초 완벽".
export function timingLine(res) {
  if (res?.daily) {
    const head = `10초 맞추기 오늘의 챌린지 ${secText(res.target)}초`;
    if (!res.valid) return `${head} 무효`;
    return `${head} ${errText(res.err)} ${gradeName(res.grade, res.target)}${res.checked === 'server' ? ` · 인터넷 느림(서버 ${res.server_err == null ? '—' : errText(res.server_err)}, 기록 제외)` : res.unranked ? ' · 운 감시(순위 제외)' : ''}`;
  }
  if (!res?.valid) return '10초 맞추기 무효';
  if (res.checked === 'server') return `10초 맞추기 ${errText(res.err)} ${gradeName(res.grade)} · 인터넷 느림(서버 ${res.server_err == null ? '—' : errText(res.server_err)}, 기록 제외)`;
  return `10초 맞추기 ${errText(res.err)} ${gradeName(res.grade)}${res.unranked ? ' · 운 감시(순위 제외)' : ''}`;
}

// 순위(하나): 이번 주, 같은 학년대(sameGradeBand: 같은 부 · 같은 학년, 학교는 달라도).
//   kind 'best' 가장 작은 오차, 'avg' 평균 오차(AVG_MIN판 이상). 교사 미리보기 계정은 빼고(자기 줄만),
//   비공개 학생은 '비공개 학생', 내 줄은 BOARD_TOP 밖이어도 붙인다.
export const TIMING_KINDS = ['best', 'avg'];
export function timingBoard(profiles, p, { kind = 'best', now = Date.now(), ranked = x => x?.role === 'student' && x.active !== false && !x.preview_owner_id, hidden = () => false } = {}) {
  kind = TIMING_KINDS.includes(kind) ? kind : 'best';
  const k = weekStart(now), rows = [];
  for (const x of profiles) {
    const me = x.id === p.id;
    if (!me && (!ranked(x) || !sameGradeBand(x, p))) continue;
    const w = x.timing?.wk?.k === k ? x.timing.wk : null;
    if (!w?.n || (kind === 'avg' && w.n < TIMING.AVG_MIN)) continue;
    const veil = !me && hidden(x);
    rows.push({ me, name: veil ? '비공개 학생' : x.display_name, pet: veil ? 'lumi' : (x.avatar_key || 'lumi'), school: veil ? '' : (x.school || ''), private: veil, err: kind === 'avg' ? Math.round(w.s / w.n) : w.b, n: w.n });
  }
  rows.sort((a, b) => a.err - b.err || b.n - a.n);
  rows.forEach((r, i) => { r.rank = i + 1; });
  const top = rows.slice(0, TIMING.BOARD_TOP), mine = rows.find(r => r.me);
  return { kind, avg_min: TIMING.AVG_MIN, rows: mine && !top.includes(mine) ? [...top, mine] : top, total: rows.length };
}

/* ---------- V13.192 오늘의 챌린지: 선생님 설정 · 자동 · 순위 ---------- */
// 그날 설정(없으면 자동). 학생 응답에는 오늘 것만 실린다(미래 날짜 설정은 선생님 화면에만).
export function dailyConfig(state, now = Date.now(), day = dayKey(now)) {
  const c = state.timingDaily?.[day];
  if (c) return { day, target: c.t, show: c.s, msg: c.m || '', auto: false };
  const target = autoDailyTarget(day);
  return { day, target, show: target > TIMING.DAILY.AUTO_SHOW ? TIMING.DAILY.AUTO_SHOW : 0, msg: `오늘은 ${secText(target)}초!`, auto: true };
}
const dailyDays = now => Array.from({ length: TIMING.DAILY.AHEAD + 1 }, (_, i) => dayKey(now + i * DAY_MS));
const playedToday = (state, day) => state.profiles.filter(x => x.role === 'student' && !x.preview_owner_id && x.timing?.dc?.d === day && Number(x.timing.dc.n) > 0).length;
// 선생님 화면: 오늘부터 13일 뒤까지(정한 날 · 자동), 오늘 참여 수.
export function dailyTeacherView(state, now = Date.now()) {
  const today = dayKey(now);
  return { today, days: dailyDays(now).map(day => dailyConfig(state, now, day)), played: playedToday(state, today), rules: TIMING.DAILY };
}
// 선생님이 정하기 · 자동으로 되돌리기. 오늘 것은 학생이 한 명이라도 도전했으면 바꿀 수 없다(같은 목표로 겨루게).
export function setDaily(state, body = {}, { now = Date.now(), by = null } = {}) {
  const day = String(body.day || ''), days = dailyDays(now);
  if (!days.includes(day)) fail(`오늘부터 ${TIMING.DAILY.AHEAD}일 뒤까지만 정할 수 있어요.`);
  if (day === days[0] && playedToday(state, day)) fail('오늘 챌린지는 이미 도전한 학생이 있어서 바꿀 수 없어요. 내일 것부터 바꿔 주세요.', 409);
  const all = { ...(state.timingDaily || {}) };
  if (body.clear) delete all[day];
  else {
    const v = dailyCheck(body);
    if (v.error) fail(v.error);
    all[day] = { t: v.t, s: v.s, m: v.m, at: now, by };
  }
  // 지난 14일만 남긴다(학생 기록에는 그날 목표가 따로 남아 있다).
  const oldest = dayKey(now - (TIMING.DAILY.KEEP - 1) * DAY_MS);
  state.timingDaily = Object.fromEntries(Object.entries(all).filter(([d]) => d >= oldest).sort(([a], [b]) => a.localeCompare(b)));
  return dailyTeacherView(state, now);
}
// 오늘의 챌린지 순위: 같은 학년대 · 가장 작은 오차(믿은 판만), 미리보기 계정 제외(자기 줄만) · 비공개 · 내 줄은 항상.
// 어제 1 ~ 3등은 '어제의 챌린지 챔피언'(칭호는 아직 없음, 자리만).
export function timingDailyBoard(profiles, p, { now = Date.now(), ranked = x => x?.role === 'student' && x.active !== false && !x.preview_owner_id, hidden = () => false, target = null, yesterdayTarget = null } = {}) {
  const today = dayKey(now), yd = dayKey(now - DAY_MS), rows = [], champs = [];
  const card = (x, me) => { const veil = !me && hidden(x); return { me, name: veil ? '비공개 학생' : x.display_name, pet: veil ? 'lumi' : (x.avatar_key || 'lumi'), school: veil ? '' : (x.school || ''), private: veil }; };
  for (const x of profiles) {
    const me = x.id === p.id, c = x.timing?.dc;
    if (!c || (!me && (!ranked(x) || !sameGradeBand(x, p)))) continue;
    if (c.d === today && c.e != null) rows.push({ ...card(x, me), err: Math.abs(c.e), e: c.e });
    const y = c.d === yd && c.e != null ? c.e : c.pd === yd && c.pe != null ? c.pe : null;
    if (y != null && ranked(x)) champs.push({ ...card(x, me), err: Math.abs(y), e: y });
  }
  const rank = list => { list.sort((a, b) => a.err - b.err || String(a.name).localeCompare(String(b.name))); list.forEach((r, i) => { r.rank = i + 1; }); return list; };
  rank(rows); rank(champs);
  const top = rows.slice(0, TIMING.BOARD_TOP), mine = rows.find(r => r.me);
  return { kind: 'daily', day: today, target, rows: mine && !top.includes(mine) ? [...top, mine] : top, total: rows.length, champions: champs.slice(0, TIMING.DAILY.CHAMPS), yesterday: yd, yesterday_target: yesterdayTarget };
}
