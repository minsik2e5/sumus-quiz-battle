// V13.236 펫 아레나 연습장 규칙(화면 없이 돌아가는 부분, 검사 server/arena-deco-check.mjs가 그대로 돌린다).
//   전투는 arena-rules.js createArena를 그대로 쓴다(새 전투 규칙 없음). 연습장은 그 위에서 한 걸음마다
//   ① 움직이는 허수아비 걷기 조작 ② 내가 준 피해 세기(DPS · 가장 센 한 방 · 콤보 · 기술별) ③ 체력 다시 채우기 · 허수아비 필살기 게이지 0만 한다.
// 보상 · 기록 · 서버 요청 없음(이 파일과 arena-practice.js 어디에도 api 호출이 없다 — 검사가 본다).
import { STANDARD_PET_KEYS } from './core.js';
import { elementOf } from './battle-fx.js';
import { ARENA, TREE, createArena, fighter, dirCode, matchup } from './arena-rules.js';

export const DUMMIES = [
  { k: 'still', n: '가만히', d: '움직이지 않아요 · 조준 연습', icon: '🎯' },
  { k: 'move', n: '움직임', d: '빙글빙글 걸어요 · 맞히기 연습', icon: '🏃' },
  { k: 'fight', n: '반격', d: '살살 맞받아쳐요 · 회피 연습', icon: '🥊' }
];
// DUMMY_HP: 허수아비 체력(내 펫 체력 × 8, 적어도 3000) · REFILL: 이만큼 아래로 내려가면 다시 가득 · FIGHT_ATK: 반격 허수아비 공격 배수 ·
// MAX_TICKS: 연습 한 판 2분(1:1 전투 규칙의 판 길이 그대로) · DPS_WINDOW: 최근 5초(100틱) · PANEL_MS: 숫자판 다시 쓰기 간격 · WALK_TICKS: 걷는 방향 바꾸는 간격.
export const PRACTICE = { DUMMY_HP: 8, REFILL: 0.35, ME_REFILL: 0.35, FIGHT_ATK: 0.6, MAX_TICKS: ARENA.MAX_TICKS, DPS_WINDOW: 100, PANEL_MS: 250, WALK_TICKS: 26 };
export const KIND_KO = { atk: '공격', skill: '스킬 ①', skill2: '스킬 ②', ult: '필살기', poison: '중독', burn: '화상' };
const WALK = [3, 4, 5, 6, 7, 8, 1, 2, 0, 3, 3, 7, 7, 0];
// 허수아비 몸(규칙에서는 일반 펫 하나): 내 펫 속성과 상성이 서로 1배인 펫(숫자가 상성으로 부풀거나 줄지 않게).
export const dummyKey = el => STANDARD_PET_KEYS.find(k => matchup(el, elementOf(k)) === 1 && matchup(elementOf(k), el) === 1) || STANDARD_PET_KEYS[0] || 'dog';

// 연습용 펫: 열린 층은 그대로, 잠긴 층을 미리보기로 켰으면 30레벨 가지를 빌려 오고 체력 · 공격은 내 레벨 비율로 맞춘다(가지 효과만 시험).
export function practiceFighter({ key, form, level, s2, tr }) {
  const real = fighter({ key, form, level, s2, tr });
  if (Number(level) >= TREE.LEVELS[2]) return real;
  const lv = TREE.LEVELS[2], full = fighter({ key, form, level: lv, s2, tr }), bareHi = fighter({ key, form, level: lv, s2, noTree: true }), bareMe = fighter({ key, form, level, s2, noTree: true });
  return { ...full, level: real.level, hp: Math.round(full.hp * bareMe.hp / bareHi.hp), atk: Math.round(full.atk * bareMe.atk / bareHi.atk), preview: true };
}
export function dummyFighter(me, kind) {
  const base = fighter({ key: dummyKey(me.el), form: me.form, level: me.level });
  return { ...base, hp: Math.max(3000, me.hp * PRACTICE.DUMMY_HP), atk: kind === 'fight' ? Math.max(1, Math.round(base.atk * PRACTICE.FIGHT_ATK)) : base.atk, dummy: true };
}
// 가장자리에 닿으면 가운데 쪽으로 돈다(걷기 방향 코드 0~8).
export function edgeTurn(s, d) {
  if (!d) return 0;
  const [dx, dy] = [[0, 0], [0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1]][d];
  return dirCode(s.x < 22 ? 1 : s.x > 78 ? -1 : dx, s.y < 22 ? 1 : s.y > 78 ? -1 : dy);
}
export const newStats = (start = 0) => ({ total: 0, hits: [], best: 0, combo: 0, by: {}, n: 0, start });
// 이번 걸음 사건에서 허수아비가 맞은 피해만 센다(최근 5초 목록은 오래된 것부터 버린다: 많아야 100틱 분량).
export function countHits(st, ev, t) {
  for (const e of ev) {
    if (e.e !== 'dmg' || e.who !== 'foe' || !(e.dmg > 0)) continue;
    st.total += e.dmg; st.n++;
    st.hits.push([t, e.dmg]);
    if (e.dmg > st.best) st.best = e.dmg;
    if ((e.combo || 0) > st.combo) st.combo = e.combo;
    const k = KIND_KO[e.kind] ? e.kind : 'atk';
    st.by[k] = (st.by[k] || 0) + e.dmg;
  }
  while (st.hits.length && st.hits[0][0] < t - PRACTICE.DPS_WINDOW) st.hits.shift();
}
// 화면 숫자: { dps 최근 5초, avg 전체 평균(초당), total, best, combo, n }.
export function statsView(st, t, tickMs = 50) {
  const span = Math.max(1, t - st.start), win = Math.min(PRACTICE.DPS_WINDOW, span);
  return { dps: Math.round(st.hits.reduce((n, [, d]) => n + d, 0) / (win * tickMs / 1000)), avg: Math.round(st.total / (span * tickMs / 1000)), total: st.total, best: st.best, combo: st.combo, n: st.n };
}
// 연습 판 만들기: createArena 그대로 + 한 걸음 감싸기. onPop(글, 쪽): 다시 채울 때 화면 글자(없어도 된다).
export function createPractice({ me, dummy = 'still', seed = 1, onPop = () => {} }) {
  const foe = dummyFighter(me, dummy);
  const sim = createArena({ seed, me: [me], foe: [foe], foeLevel: 0, foeIdle: dummy === 'still', foeHuman: dummy === 'move', maxTicks: PRACTICE.MAX_TICKS });
  const run = { sim, foe, stats: newStats(), walk: 0, refills: 0 };
  const step0 = sim.step;
  sim.step = () => {
    const S = sim.S, t = S.t;
    if (dummy === 'move' && t % PRACTICE.WALK_TICKS === 0) sim.pushFoe([t, edgeTurn(S.foe, WALK[run.walk++ % WALK.length])]);
    const ev = step0();
    countHits(run.stats, ev, S.t);
    // 가만히 허수아비: 밀려난 뒤 제자리로 천천히 돌아온다(넉백은 그대로 보이고, 구석에 박히지 않게).
    if (dummy === 'still' && S.foe.kb <= 0) { const f = S.foe, dx = f.hx - f.x, dy = f.hy - f.y + 6, d = Math.hypot(dx, dy); if (d > 0.5) { const k = Math.min(1, 0.5 / d); f.x += dx * k; f.y += dy * k; } }
    const d = S.foe.team[0], m = S.me.team[0];
    S.foe.gauge = 0; // 허수아비는 필살기를 쓰지 않는다
    if (d && d.cur < d.hp * PRACTICE.REFILL) { d.cur = d.hp; run.refills++; onPop('허수아비 다시 튼튼!', S.foe); }
    if (m && m.cur > 0 && m.cur < m.hp * PRACTICE.ME_REFILL) { m.cur = m.hp; onPop('연습장 회복!', S.me); }
    return ev;
  };
  // 쿨타임 바로 돌리기 · 필살기 채우기(연습장 버튼).
  run.resetCd = () => Object.assign(sim.S.me, { skill: 0, skill2: 0, cd: 0, dodgeCd: 0, swapCd: 0 });
  run.fillUlt = () => { sim.S.me.gauge = 100; };
  return run;
}
