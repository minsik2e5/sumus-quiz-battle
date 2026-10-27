import { dayKey } from '../public/modules/core.js';
import { TIMING, LEVEL_NAMES, GRADE_NAMES, gradeOf, errText, levelOk, targetOk, dailyPlays, guardWindow } from '../public/modules/timing-rules.js';
import { addBonus } from './rewards.mjs';
import { rankingWeek, sameGradeBand } from './competition.mjs';

// V13.180 10초 맞추기(놀이터) 서버 쪽. 학생 기록 p.timing(작은 키 하나, 판이 끝날 때만 쓴다):
//   { d: 오늘, n: 오늘 쓴 판, b: [오늘 추가 판을 받은 곳], c: 오늘 받은 코인,
//     live{ id, lv, t: 목표, at: 시작 도착 시각, r: 서버가 잰 RTT }, last{ id, r } (마지막 판 영수증),
//     best{ 난이도: 가장 작은 오차 }, wk{ k: 주 시작, 난이도: [가장 작은 오차, 판 수, 오차 합] },
//     pf: 완벽 수, hp: 하드 완벽 수, st: 지금 연속 완벽, sb: 최고 연속 완벽, all: 모든 판 }
// 판 흐름: /timing/ping(쓰기 없음, 서버 시각) → /timing/start(판을 쓰고 live) → 3 · 2 · 1 → 누름 → /timing/finish.
// 서버는 시작 도착 ~ 끝 도착을 재서 화면이 보낸 시간과 비교한다(TIMING.GUARD). 벗어나면 서버가 잰 시간으로 판정하고
// 순위에 넣지 않으며 코인은 '좋음'까지만 준다. 기록 · 보상은 서버만 정한다.

const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };
const tm = p => p.timing ||= {};
const weekStart = now => rankingWeek(now).start;

function today(t, now) {
  const d = dayKey(now);
  if (t.d !== d) { t.d = d; t.n = 0; t.b = []; t.c = 0; }
  return t;
}
const playsOf = p => p.preview_owner_id ? TIMING.PREVIEW_PLAYS : dailyPlays((p.timing?.b || []).length);
const weekOf = (t, now) => t.wk?.k === weekStart(now) ? t.wk : null;

// 공부로 추가 판 받기(연습 끝내기 · 출석, 곳마다 하루 1판). 받았으면 true.
export function grantTimingPlay(p, source, now = Date.now()) {
  if (!TIMING.SOURCES.includes(source)) return false;
  const t = today(tm(p), now);
  if (t.b.includes(source)) return false;
  t.b = [...t.b, source];
  return true;
}

export function timingView(p, now = Date.now()) {
  const t = p.timing || {}, d = dayKey(now), on = t.d === d; // 읽기만(보기에서 기록을 만들지 않는다)
  const got = on ? t.b || [] : [], plays = p.preview_owner_id ? TIMING.PREVIEW_PLAYS : dailyPlays(got.length);
  const wk = weekOf(t, now) || {};
  return {
    target: TIMING.TARGET, levels: TIMING.LEVELS, left: Math.max(0, plays - (on ? Number(t.n || 0) : 0)), plays,
    got: Object.fromEntries(TIMING.SOURCES.map(s => [s, got.includes(s)])),
    coin_left: Math.max(0, TIMING.COIN_DAILY - (on ? Number(t.c || 0) : 0)), coin_daily: TIMING.COIN_DAILY,
    best: Object.fromEntries(TIMING.LEVELS.map(lv => [lv, t.best?.[lv] ?? null])),
    week: Object.fromEntries(TIMING.LEVELS.map(lv => { const w = wk[lv]; return [lv, w ? { best: w[0], n: w[1], avg: Math.round(w[2] / w[1]) } : null]; })),
    perfect: Number(t.pf || 0), streak: Number(t.st || 0), streak_best: Number(t.sb || 0), total: Number(t.all || 0)
  };
}

// 시작 전 ping: 쓰기 없이 서버 시각만. 화면은 받자마자 /timing/start에 echo로 돌려보낸다(서버가 그 사이를 RTT로 잰다).
export const timingPing = (now = Date.now()) => ({ echo: now });

// 판 시작: 판을 하나 쓰고 서버 시각을 남긴다. 같은 id를 다시 보내면 판을 또 쓰지 않는다.
// 응답에는 목표(화면에 '10.00초를 맞춰라'로 보이는 규칙)와 숨김 시간만: 서버 시각 · 끝나야 할 시각 같은 것은 보내지 않는다.
export function timingStart(p, { id, level, target = TIMING.TARGET, echo = null, now = Date.now() }) {
  if (!id) fail('판 번호가 없어요.');
  if (!levelOk(level)) fail('난이도를 골라 주세요.');
  if (!targetOk(target)) fail('목표 시간을 확인해 주세요.');
  const t = today(tm(p), now);
  const answer = () => ({ id, level, target: Number(target), countdown_ms: TIMING.COUNTDOWN_MS, show_ms: TIMING.SHOW_MS[level] });
  if (t.live?.id === id && now - t.live.at < TIMING.LIVE_MS) return { ...answer(), again: true };
  if (Number(t.n || 0) >= playsOf(p)) fail('오늘 판을 다 했어요. 연습을 끝내거나 출석하면 한 판 더!', 409);
  // 끝내지 않은 앞 판(나가기 · 화면 가림)은 무효: 연속 완벽도 끊긴다.
  if (t.live) t.st = 0;
  const e = Number(echo), rtt = Number.isFinite(e) && e <= now ? now - e : TIMING.GUARD.RTT_MAX;
  t.n = Number(t.n || 0) + 1;
  t.live = { id, lv: level, t: Number(target), at: now, r: Math.min(TIMING.GUARD.RTT_MAX, Math.max(0, rtt)) };
  return answer();
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
function settle(p, t, live, { result, ms, pet, now }) {
  const base = { level: live.lv, target: live.t };
  const server = now - live.at - TIMING.COUNTDOWN_MS; // 서버가 잰 시간(왕복 지연 하나가 더 들어 있다)
  if (now - live.at > TIMING.LIVE_MS) { t.st = 0; return { ...base, valid: false, reason: 'expired' }; }
  if (result === 'void') { t.st = 0; return { ...base, valid: false, reason: 'void' }; }
  const claimed = Math.round(Number(ms));
  const { lo, hi } = guardWindow(live.r), gap = server - claimed;
  const trusted = Number.isFinite(claimed) && gap >= lo && gap <= hi;
  // 벗어나면 서버 측정값(서버가 잰 시간 − RTT)으로 대신한다.
  const used = trusted ? claimed : Math.round(server - live.r);
  const timeout = result === 'timeout' || used >= live.t * TIMING.MAX_FACTOR;
  const shown = timeout ? Math.max(used, live.t * TIMING.MAX_FACTOR) : used;
  const day = today(t, now);
  t.all = Number(t.all || 0) + 1;
  if (shown < TIMING.MIN_MS) { t.st = 0; return { ...base, valid: true, ms: shown, err: shown - live.t, grade: 'early', coins: 0, xp: 0, checked: trusted ? 'client' : 'server' }; }
  const err = shown - live.t, abs = Math.abs(err), grade = timeout ? 'miss' : gradeOf(err);
  // 서버 측정으로 판정한 판은 순위 · 칭호에 넣지 않고 코인은 '좋음'까지만.
  const coinGrade = !trusted && (grade === 'perfect' || grade === 'great') ? 'good' : grade;
  const coins = Math.max(0, Math.min(TIMING.COINS[live.lv][coinGrade], TIMING.COIN_DAILY - Number(day.c || 0)));
  const xp = TIMING.XP[grade];
  day.c = Number(day.c || 0) + coins;
  addBonus(p, { xp, coins, pet, now });
  let record = false, weekRecord = false;
  if (trusted && !timeout) {
    const best = t.best ||= {};
    record = best[live.lv] == null || abs < best[live.lv];
    if (record) best[live.lv] = abs;
    const k = weekStart(now);
    if (t.wk?.k !== k) t.wk = { k };
    const w = t.wk[live.lv] ||= [abs, 0, 0];
    weekRecord = !w[1] || abs < w[0];
    w[0] = Math.min(w[0], abs); w[1] += 1; w[2] += abs;
  }
  if (trusted && grade === 'perfect') {
    t.pf = Number(t.pf || 0) + 1;
    if (live.lv === 'hard') t.hp = Number(t.hp || 0) + 1;
    t.st = Number(t.st || 0) + 1;
    t.sb = Math.max(Number(t.sb || 0), t.st);
  } else t.st = 0;
  return { ...base, valid: true, ms: shown, err, grade, coins, xp, record, week_record: weekRecord, streak: Number(t.st || 0), checked: trusted ? 'client' : 'server', ...(trusted ? {} : { unranked: true }), ...(coins < TIMING.COINS[live.lv][coinGrade] ? { capped: true } : {}) };
}

// 선생님 활동 기록 한 줄: "10초 맞추기 하드 +0.03초 완벽".
export function timingLine(res) {
  if (!res?.valid) return `10초 맞추기 ${LEVEL_NAMES[res?.level] || ''} 무효`.replace(/  +/g, ' ');
  return `10초 맞추기 ${LEVEL_NAMES[res.level]} ${errText(res.err)} ${GRADE_NAMES[res.grade]}${res.unranked ? ' · 서버 판정' : ''}`;
}

// 순위: 이번 주, 같은 학년대(sameGradeBand: 같은 부 · 같은 학년, 학교는 달라도), 난이도마다.
//   kind 'best' 가장 작은 오차, 'avg' 평균 오차(AVG_MIN판 이상). 교사 미리보기 계정은 빼고(자기 줄만),
//   비공개 학생은 '비공개 학생', 내 줄은 BOARD_TOP 밖이어도 붙인다.
export const TIMING_KINDS = ['best', 'avg'];
export function timingBoard(profiles, p, { level = 'normal', kind = 'best', now = Date.now(), ranked = x => x?.role === 'student' && x.active !== false && !x.preview_owner_id, hidden = () => false } = {}) {
  level = levelOk(level) ? level : 'normal'; kind = TIMING_KINDS.includes(kind) ? kind : 'best';
  const k = weekStart(now);
  const rows = [];
  for (const x of profiles) {
    const me = x.id === p.id;
    if (!me && (!ranked(x) || !sameGradeBand(x, p))) continue;
    const w = x.timing?.wk?.k === k ? x.timing.wk[level] : null;
    if (!w || !w[1] || (kind === 'avg' && w[1] < TIMING.AVG_MIN)) continue;
    const veil = !me && hidden(x);
    rows.push({ me, name: veil ? '비공개 학생' : x.display_name, pet: veil ? 'lumi' : (x.avatar_key || 'lumi'), school: veil ? '' : (x.school || ''), private: veil, err: kind === 'avg' ? Math.round(w[2] / w[1]) : w[0], n: w[1] });
  }
  rows.sort((a, b) => a.err - b.err || b.n - a.n);
  rows.forEach((r, i) => { r.rank = i + 1; });
  const top = rows.slice(0, TIMING.BOARD_TOP), mine = rows.find(r => r.me);
  return { level, kind, avg_min: TIMING.AVG_MIN, rows: mine && !top.includes(mine) ? [...top, mine] : top, total: rows.length };
}
