import { createParty, joinParty, startParty, answer, pick, target, peek, useItem, tick } from './party-engine.js';

// V13.150 혼자 보물 사냥(반 친구 금고): 혼자 3분, 이번 주 반 친구들의 금고(그 친구의 이번 주 최고 판 금화 · 방패)를 턴다.
// 친구 금고는 줄지 않는다(털렸다는 알림 · 되갚기만). 판은 폰이 돌리고, 끝나면 행동 기록(log)을 보내면 서버가 같은 함수로
// 처음부터 다시 돌려(soloReplay) 금화 · 맞힌 수 · 턴 친구를 계산한다. 그래서 폰이 보낸 금화를 믿지 않는다.
//   log 한 줄: [t(시작부터 ms), 종류, 값]  a 답(보기 번호) · p 상자(번호) · g 표적(친구 id) · k 엿보기 · i 아이템(이름)
export const SOLO = {
  MS: 180000,          // 한 판 3분
  NO_STEAL_MS: 20000,  // 처음 20초는 훔치기 없음
  MIN_GAP_MS: 450,     // 답과 답 사이(사람 손)
  LOG_MAX: 700,
  VAULTS: 6,           // 털 수 있는 반 친구 금고(금화 많은 순)
  MIN_VAULTS: 3,       // 이보다 적으면 해적 봇 금고로 채운다
  ROBBED_KEEP: 12,     // 털린 알림은 이번 주 12개까지
  RECORD_COINS: 3,     // 이번 주 금고 최고 기록을 넘으면
  QUESTIONS: 60,
  MULT_CAP: 300        // 2배 상자는 최대 +300, 3배는 +600(금고가 운으로만 커지지 않게)
};
export const SOLO_BOTS = [['bot-1', '해적 선장 루비', 'fox'], ['bot-2', '외눈 해적 토토', 'bear'], ['bot-3', '앵무 해적 삐삐', 'penguin']];
export const soloRng = seed => { let x = (Number(seed) >>> 0) || 1; return () => (x = (Math.imul(x, 1664525) + 1013904223) >>> 0) / 4294967296; };

// 시작 정보(start: 서버가 정한 문제 · 시드 · 금고 목록)로 판을 만든다. 폰과 서버가 똑같이 만든다.
export function soloRoom(start, t0) {
  const room = createParty({ id: start.id, code: 'solo', kind: 'treasure', minutes: 5, steal: true, questions: start.qs, seed: start.seed, host: { id: start.me.id },
    duration_ms: SOLO.MS, no_steal_ms: SOLO.NO_STEAL_MS, hide_last_ms: 0, revenge: start.revenge || [], mult_cap: SOLO.MULT_CAP, label: '혼자 보물 사냥', now: t0 });
  joinParty(room, start.me, t0);
  for (const v of start.vaults) { joinParty(room, { id: v.id, name: v.name, pet: v.pet }, t0); Object.assign(room.players[v.id], { gold: Math.max(0, Math.round(v.gold)), shield: Math.max(0, Math.min(2, v.shield || 0)) }); }
  startParty(room, t0);
  return room;
}
// 행동 하나: 먼저 그때까지의 시간을 흘리고(tick) 행동을 한다. 엔진의 시간 규칙은 정해진 시각 기준이라, 중간에 맥박이 몇 번 돌든 결과가 같다.
export function soloStep(room, me, entry, t0, rng) {
  const now = t0 + Number(entry[0]), events = [...tick(room, now).events];
  if (room.phase !== 'play') return { events, res: null };
  const [, type, arg] = entry;
  const res = type === 'a' ? answer(room, me, Number.isInteger(arg) ? arg : -1, now, rng) : type === 'p' ? pick(room, me, Number(arg) || 0, now)
    : type === 'g' ? target(room, me, String(arg || '').slice(0, 80), now) : type === 'k' ? peek(room, me, now, rng) : type === 'i' ? useItem(room, me, String(arg || '').slice(0, 20), now) : null;
  return { events: [...events, ...(res?.events || [])], res };
}
// 서버가 기록으로 판을 다시 돌린다. 순서가 뒤바뀌거나, 판 시간 밖이거나, 사람 손보다 빠른 답이면 bad.
export function soloReplay(start, log) {
  if (!Array.isArray(log) || log.length > SOLO.LOG_MAX) return { bad: 'log' };
  const t0 = 1e12, rng = soloRng(start.seed), room = soloRoom(start, t0), me = start.me.id, hits = [];
  let last = 0, lastA = -Infinity;
  for (const e of log) {
    if (!Array.isArray(e) || !['a', 'p', 'g', 'k', 'i'].includes(e[1])) return { bad: 'entry' };
    const t = Number(e[0]);
    if (!Number.isFinite(t) || t < last || t > SOLO.MS + 1000) return { bad: 'time' };
    if (e[1] === 'a') { if (t - lastA < SOLO.MIN_GAP_MS) return { bad: 'fast' }; lastA = t; }
    last = t;
    const { events } = soloStep(room, me, [t, e[1], e[2]], t0, rng);
    for (const x of events) if (x.pid === me && ['steal', 'swap', 'block'].includes(x.kind)) hits.push({ vid: x.vid, kind: x.kind, amount: x.amount || 0, pct: x.pct || 0, bounty: x.bounty || 0 });
  }
  tick(room, t0 + SOLO.MS + 1);
  const pl = room.players[me];
  return { gold: pl.gold, right: pl.right, wrong: pl.wrong, shield: pl.shield, hits, last, room };
}
