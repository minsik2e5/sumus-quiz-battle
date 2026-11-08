// V13.230 펫 아레나 실시간 친구 대전(구성안 docs/pet-arena-v2-plan.md 1장 · 6장). 화면(arena-live.js) · 방(cloudflare/arena-room.mjs) ·
// 검사(server/arena-room-check.mjs)가 같이 쓰는 규칙. 화면 · 소켓 · 저장은 모른다.
//   방식: 입력만 주고받기 + 롤백. 두 폰이 같은 전투(arena-rules.js createArena, 상대 쪽도 사람)를 돌리고,
//   방은 조작 순서(몇 번째 틱)를 정해 0.1초마다 "이 틱까지 확정"을 보낸다. 늦게 온 친구 조작이면 폰이 그 틱으로 되감아 다시 계산한다.
//   끝 판정은 늘 방: 확정된 모든 조작으로 runArena를 다시 돌린 결과.
// 엔진 쪽 이름: 방장 = 'me' 쪽(아래), 손님 = 'foe' 쪽(위). 손님 화면은 경기장을 180° 돌려 보여 준다(mirror*). 경기장이 위아래 · 좌우 대칭이라 같다.
import { ARENA, INPUT, PLAYER_CODE_MAX, cleanInputs, createArena, runArena, fighter, cleanTree } from './arena-rules.js';

export const LIVE = {
  MODES: { '1v1': { seats: 2, team: 3, ms: ARENA.MAX_TICKS * ARENA.TICK_MS } }, // ④단계(1:1:1 · 2:2)는 여기에 자리 수 · 펫 수를 더한다
  CODE_LEN: 4,                 // 방 코드 4자리
  LOBBY_MS: 5 * 60000,         // 대기실은 5분이 지나면 닫힌다
  START_MS: 6000,              // 시작을 누르고 6초 뒤 0틱(VS 화면 2.3초 + 3 · 2 · 1 + 여유). 두 폰이 같은 시각에 시작한다
  BATCH_MS: 100,               // 폰 → 방: 바뀐 조작만 0.1초에 한 번 묶어서 · 방 → 폰: 0.1초에 한 번 확정 묶음
  BUFFER_TICKS: 4,             // 방은 (지금 틱 − 4)까지 확정한다(0.2초 안에 온 조작은 누른 틱 그대로)
  ROLLBACK_MAX: 8,             // 이보다 늦게 온 조작은 '늦게 누른 것'으로(확정 다음 틱) 받는다
  AHEAD_MAX: 20,               // 폰 시계가 앞서도 1초 넘게 앞의 틱은 받지 않는다
  HASH_EVERY: 20,              // 1초마다 상태 요약을 보내 폰과 비교
  AI_AFTER_MS: 3000,           // 끊긴 지 3초면 컴퓨터가 대신 조종
  IN_MAX: 24,                  // 메시지 하나에 조작 24개까지
  IN_PER_SEC: 12,              // 폰 → 방 메시지는 1초에 12개까지(넘으면 버림)
  MSG_MAX: 512,                // 512바이트 넘는 메시지는 버린다
  SAVE_EVERY_MS: 5000,         // 방 저장은 5초마다 한 번
  CLOSE_AFTER_MS: 10 * 60000,  // 끝나고 10분 뒤 방을 지운다
  OPEN_GAP_MS: 60000,          // 방 만들기는 1분에 1번
  INVITES_MAX: 4,
  PAIR_DAILY: 2,               // 같은 친구와 코인 판은 하루 2판
  MIN_INPUTS: 20,              // 조작 20개 미만 · 준 피해 0이면 거의 안 한 판(둘 다 보상 없음)
  AI_HALF: 0.5,                // 컴퓨터가 조종한 시간이 절반 넘으면 그 사람은 보상 없음
  EMOTE_GAP_MS: 3000,
  EMOTE_MAX: 20,
  REPLAYS: 5                   // 다시 보기: 최근 5판(이 폰에만, 서버 저장 0)
};
// 이모트: 야차전 이모트를 그대로(cloudflare/battle-room.mjs EMOTES · public/modules/battle.js 글자).
export const LIVE_EMOTES = { lol: 'ㅋㅋ', come: '덤벼!', gg: 'GG', nice: '좋았어!' };
export const SIDES = ['me', 'foe'];
export const otherSide = who => who === 'me' ? 'foe' : 'me';

// 방 코드: 숫자 4자리(0으로 시작해도 된다).
export const cleanCode = raw => { const s = String(raw ?? '').replace(/\D/g, ''); return s.length === LIVE.CODE_LEN ? s : ''; };

// 대기실에서 고른 펫 3마리: 내 펫 목록(pets: [{key, form, level, s2, tr}])에서만, 겹치지 않게. 모자라면 레벨 높은 펫으로 채운다.
export function liveTeam(pets, keys, n = LIVE.MODES['1v1'].team) {
  const list = (Array.isArray(pets) ? pets : []).filter(p => p && Number(p.form) >= 1);
  const by = new Map(list.map(p => [String(p.key), p]));
  const out = [];
  for (const k of (Array.isArray(keys) ? keys : []).map(String)) if (by.has(k) && !out.includes(by.get(k)) && out.length < n) out.push(by.get(k));
  for (const p of [...list].sort((a, b) => Number(b.level) - Number(a.level))) if (out.length < n && !out.includes(p)) out.push(p);
  return out.map(p => ({ key: String(p.key), form: Math.max(1, Math.min(3, Number(p.form) || 1)), level: Math.max(1, Math.min(99, Number(p.level) || 1)), s2: p.s2 === 1 ? 1 : 0, tr: cleanTree(p.tr) }));
}
// V13.231 스킬트리 가지(tr)도 실어 방 판정 · 서버 롤백 · 다시 보기가 같은 결과(가지 없는 예전 기록은 기본 가지).
export const liveFighters = team => team.map(f => fighter({ key: f.key, form: f.form, level: f.level, s2: f.s2, tr: f.tr }));

/* ---------- 손님 화면: 경기장을 180° 돌려 본다 ---------- */
const flipDir = c => c >= 1 && c <= 8 ? ((c - 1 + 4) % 8) + 1 : c;
const flipAim = a => a == null || a < 0 ? a : (a + 8) % 16;
// 화면 조작 [틱, 코드, 조준] → 엔진 조작(손님이면 방향 · 조준을 돌린다).
export const mirrorInput = (x, on) => !on ? x : x.length > 2 ? [x[0], flipDir(x[1]), flipAim(x[2])] : [x[0], flipDir(x[1])];
const sw = w => w === 'me' ? 'foe' : w === 'foe' ? 'me' : w;
function flipObj(o) {
  const out = { ...o };
  if ('x' in o) out.x = 100 - o.x;
  if ('y' in o) out.y = 100 - o.y;
  if ('tx' in o) out.tx = 100 - o.tx;
  if ('ty' in o) out.ty = 100 - o.ty;
  for (const k of ['nx', 'ny', 'vx', 'vy', 'fx', 'fy', 'cnx', 'cny']) if (k in o) out[k] = -o[k];
  if ('who' in o) out.who = sw(o.who);
  if ('from' in o) out.from = sw(o.from);
  if ('winner' in o) out.winner = sw(o.winner);
  return out;
}
export const mirrorEvent = (e, on) => on ? flipObj(e) : e;
export function mirrorView(v, on) {
  if (!on) return v;
  return { ...v, me: flipObj(v.foe), foe: flipObj(v.me), winner: sw(v.winner), shots: v.shots.map(flipObj), quakes: v.quakes.map(flipObj), zones: v.zones.map(flipObj), lines: v.lines.map(flipObj), minions: v.minions.map(flipObj), mines: v.mines.map(flipObj) };
}

/* ---------- 방: 조작 순서 정하기(타임라인) ---------- */
// teams: { me: [fighter…], foe: [fighter…] }. 방이 하나 들고, 받은 조작에 틱을 확정하고, 확정한 만큼 전투를 돌린다(상태 요약 · 끝 알기).
export function createTimeline({ seed, teams }) {
  const E = createArena({ seed, me: teams.me, foe: teams.foe, foeHuman: true });
  const T = { seed, confirmed: -1, inputs: { me: [], foe: [] }, pending: { me: [], foe: [] }, last: { me: 0, foe: 0 }, human: { me: 0, foe: 0 }, aiOn: { me: false, foe: false }, aiTicks: { me: 0, foe: 0 }, aiFrom: { me: -1, foe: -1 } };
  // 폰이 보낸 조작(엔진 쪽 좌표). 너무 옛날이면 확정 다음 틱으로, 너무 미래면 1초 앞으로. 순서가 뒤로 가지 않게.
  function accept(side, list, roomTick) {
    const clean = cleanInputs((Array.isArray(list) ? list : []).slice(0, LIVE.IN_MAX).map(x => Array.isArray(x) ? [Math.max(0, Math.round(Number(x[0]) || 0)), ...x.slice(1, 3)] : x).sort((a, b) => a[0] - b[0]), ARENA.MAX_TICKS + 400, PLAYER_CODE_MAX);
    let n = 0;
    for (const x of clean) {
      if (T.inputs[side].length + T.pending[side].length >= ARENA.INPUT_MAX - 40) break;
      const t = Math.min(Math.max(x[0], T.confirmed + 1, T.last[side], roomTick - LIVE.ROLLBACK_MAX), Math.max(T.confirmed + 1, roomTick + LIVE.AHEAD_MAX));
      T.pending[side].push([t, ...x.slice(1)]); T.last[side] = t; n++;
      if (x[1] !== INPUT.AIM_EASY && x[1] !== INPUT.AIM_AUTO && x[1] !== INPUT.AIM_FREE) T.human[side]++;
    }
    return n;
  }
  // 방이 넣는 조작: 컴퓨터 대신 조종 켜기 · 끄기.
  function system(side, on) {
    if (T.aiOn[side] === on) return false;
    const t = Math.max(T.confirmed + 1, T.last[side]);
    T.pending[side].push([t, on ? INPUT.AI_ON : INPUT.AI_OFF]); T.last[side] = t;
    T.aiOn[side] = on;
    return true;
  }
  // upTo 틱까지 확정: 그 안의 조작을 확정 목록 · 전투에 넣고 그만큼 돌린다. 돌려주는 것: 새로 확정된 조작 [[쪽 0|1, 틱, 코드, 조준?], …].
  function confirm(upTo) {
    if (upTo <= T.confirmed) return [];
    const out = [];
    SIDES.forEach((side, si) => {
      const p = T.pending[side];
      let k = 0;
      while (k < p.length && p[k][0] <= upTo) { const x = p[k++]; T.inputs[side].push(x); (side === 'me' ? E.push : E.pushFoe)(x); out.push([si, ...x]); }
      if (k) T.pending[side] = p.slice(k);
    });
    while (E.S.t <= upTo && !E.S.over) {
      for (const side of SIDES) if (E.S.ai[side] != null) T.aiTicks[side]++;
      E.step();
    }
    T.confirmed = upTo;
    return out.sort((a, b) => a[1] - b[1] || a[0] - b[0]);
  }
  return { T, E, accept, system, confirm, hash: () => E.hash(), get over() { return E.S.over; }, get tick() { return E.S.t; } };
}

// 끝 판정: 확정된 모든 조작으로 처음부터 다시 돌린다(방이 돌리던 전투와 같아야 한다 — 검사가 확인).
export function liveVerdict({ seed, teams, inputs, aiTicks = { me: 0, foe: 0 }, human = { me: 0, foe: 0 } }) {
  const r = runArena({ seed, me: teams.me, foe: teams.foe, inputs: inputs.me, foeInputs: inputs.foe });
  const total = Math.max(1, r.ticks);
  const sides = Object.fromEntries(SIDES.map(s => [s, { win: r.winner === s, ko: r.ko[s], dealt: r.dealt[s], ults: r.ults[s], left: r.left[s], inputs: human[s] || 0, ai_ticks: aiTicks[s] || 0, ai_half: (aiTicks[s] || 0) / total > LIVE.AI_HALF }]));
  // 거의 조작하지 않은 쪽이 있으면(조작 20개 미만 · 준 피해 0) 그 판은 둘 다 보상 없음(져 주기 막기).
  const idle = SIDES.some(s => sides[s].inputs < LIVE.MIN_INPUTS || sides[s].dealt <= 0);
  return { winner: r.winner, ticks: r.ticks, sides, idle };
}

/* ---------- 폰: 롤백으로 돌리기 ---------- */
// 확정 전투(C)와 보여 주는 전투(P) 두 개. P = C에서 시작해 내 아직 확정 안 된 조작 + 친구는 '하던 대로'(방향 유지)로 앞서 돌린 것.
// 친구 조작이 이미 지나간 틱에 확정되면 P를 C에서 다시 만들어 지금 틱까지 조용히 다시 돌린다(되감기).
// arena.js가 R.sim처럼 쓴다: S.t · S.over · push() · step() · view().
export function createLiveSim({ seed, teams, side, send = () => {}, onDesync = () => {} }) {
  const mine = side, theirs = otherSide(side), flip = side === 'foe';
  const C = createArena({ seed, me: teams.me, foe: teams.foe, foeHuman: true });
  const P = createArena({ seed, me: teams.me, foe: teams.foe, foeHuman: true });
  const confirmed = { me: [], foe: [] };
  let pendingMine = [], outbox = [], confirmedTick = -1, roomOver = null, extra = [], hashes = new Map();
  const stats = { rollbacks: 0, deepest: 0, resim: 0, desync: 0 };
  const pushTo = (A, who, x) => (who === 'me' ? A.push : A.pushFoe)(x);
  const queueAfter = who => confirmed[who].slice(who === 'me' ? C.S.ip : C.S.ip2);
  function advanceC() {
    const target = Math.min(confirmedTick, P.S.t - 1);
    while (C.S.t <= target && !C.S.over) {
      C.step();
      const h = hashes.get(C.S.t - 1);
      if (h != null) { hashes.delete(C.S.t - 1); if (h !== C.hash()) { stats.desync++; onDesync(); } }
    }
  }
  function resync() {
    const before = P.S.t, idx = { me: P.S.me.idx, foe: P.S.foe.idx };
    P.restore(C.snapshot());
    const q = { [mine]: [...queueAfter(mine), ...pendingMine], [theirs]: queueAfter(theirs) };
    P.setQueues(q.me, q.foe);
    stats.rollbacks++; stats.deepest = Math.max(stats.deepest, before - P.S.t);
    while (P.S.t < before && !P.S.over) { P.step(); stats.resim++; }
    // 되감기로 지금 펫이 바뀌었으면 화면이 그림을 바꾸도록 '교체' 사건을 하나 넣는다.
    for (const w of SIDES) if (P.S[w].idx !== idx[w]) extra.push({ e: 'swap', who: w, idx: P.S[w].idx, key: P.S[w].team[P.S[w].idx].key });
  }
  // 방이 보낸 확정 묶음: { c: 확정 틱, l: [[쪽, 틱, 코드, 조준?], …], h: [틱, 요약]? }.
  function onBatch(b) {
    let need = false;
    for (const [si, ...x] of b.l || []) {
      const who = SIDES[si];
      if (!who) continue;
      confirmed[who].push(x);
      if (who === mine) {
        const p = pendingMine.shift();
        if (!p || p[0] !== x[0] || p[1] !== x[1] || p[2] !== x[2]) need = true; // 방이 틱을 옮겼다(늦게 도착)
      } else if (x[0] < P.S.t) need = true; // 지나간 틱의 친구 조작: 되감기
      else pushTo(P, who, x);                // 아직 오지 않은 틱: 그대로 넣으면 된다
    }
    if (b.h) hashes.set(b.h[0], b.h[1]);
    confirmedTick = Math.max(confirmedTick, Number(b.c));
    advanceC();
    if (need) resync();
  }
  // 다시 들어왔거나 어긋났을 때: 처음부터 확정 조작 전부로 C를 다시 만든다(2분 판 2,400틱 ≈ 느린 폰 40ms).
  function rebuild(all, c) {
    for (const w of SIDES) confirmed[w] = (all?.[w] || []).map(x => [...x]);
    const fresh = createArena({ seed, me: teams.me, foe: teams.foe, foeHuman: true });
    C.restore(fresh.snapshot()); C.setQueues(confirmed.me.slice(), confirmed.foe.slice());
    // setQueues 뒤 C.S.ip는 0: 확정 목록 그대로 소비한다(queueAfter가 ip로 자른다).
    C.S.inputs = confirmed.me; C.S.inputs2 = confirmed.foe;
    confirmedTick = c; pendingMine = []; hashes.clear();
    const now = Math.max(P.S.t, Math.min(c + 1, ARENA.MAX_TICKS));
    P.restore(fresh.snapshot()); P.setQueues([], []);
    while (P.S.t < now && !P.S.over) P.step();
    advanceC(); resync();
  }
  C.S.inputs = confirmed.me; C.S.inputs2 = confirmed.foe;
  const S = {
    get t() { return P.S.t; },
    get over() { return !!roomOver && (P.S.over || P.S.t >= roomOver.ticks); },
    get winner() { return roomOver ? (roomOver.winner === 'draw' ? 'draw' : roomOver.winner === mine ? 'me' : 'foe') : null; },
    get me() { return P.S[mine]; }, get foe() { return P.S[theirs]; },
    get ko() { return { me: P.S.ko[mine], foe: P.S.ko[theirs] }; },
    get dealt() { return { me: P.S.dealt[mine], foe: P.S.dealt[theirs] }; },
    get ults() { return { me: P.S.ults[mine], foe: P.S.ults[theirs] }; }
  };
  return {
    S, stats, side, flip,
    // 화면 조작(내 쪽 = 아래) → 엔진 조작. P에 바로 넣고(바로 반응) 보낼 묶음에 쌓는다.
    push(x) { const y = mirrorInput(x, flip); pendingMine.push(y); pushTo(P, mine, y); outbox.push(y); },
    flush() { if (!outbox.length) return null; const l = outbox.splice(0, LIVE.IN_MAX); send(l); return l; },
    step() { const ev = P.step(), out = extra.length ? [...extra.splice(0), ...ev] : ev; return flip ? out.map(e => mirrorEvent(e, true)) : out; },
    view: () => mirrorView(P.view(), flip),
    onBatch, rebuild,
    end(res) { roomOver = res; if (res?.all) rebuild(res.all, res.ticks); },
    get confirmedTick() { return confirmedTick; },
    get roomOver() { return roomOver; },
    inputsOf: who => confirmed[who],
    C, P
  };
}

/* ---------- 다시 보기 ---------- */
// 씨앗 + 두 쪽 조작으로 처음부터 다시 돌린다(저장은 이 폰의 localStorage, 최근 5판). arena.js가 R.sim처럼 쓴다(조작은 받지 않는다).
export function createReplaySim({ seed, teams, inputs, side = 'me', foeLevel = 1, solo = false }) {
  const flip = side === 'foe';
  const P = createArena({ seed, me: teams.me, foe: teams.foe, foeLevel, foeHuman: !solo });
  for (const x of inputs.me || []) P.push(x);
  for (const x of inputs.foe || []) P.pushFoe(x);
  const mine = side, theirs = otherSide(side);
  const S = {
    get t() { return P.S.t; }, get over() { return P.S.over; },
    get winner() { const w = P.S.winner; return w === 'draw' || !w ? w : w === mine ? 'me' : 'foe'; },
    get me() { return P.S[mine]; }, get foe() { return P.S[theirs]; },
    get ko() { return { me: P.S.ko[mine], foe: P.S.ko[theirs] }; }, get dealt() { return { me: P.S.dealt[mine], foe: P.S.dealt[theirs] }; }, get ults() { return { me: P.S.ults[mine], foe: P.S.ults[theirs] }; }
  };
  return { S, replay: true, push() {}, step: () => { const ev = P.step(); return flip ? ev.map(e => mirrorEvent(e, true)) : ev; }, view: () => mirrorView(P.view(), flip) };
}
// 다시 보기 기록 정리(localStorage에서 읽은 것): 최근 REPLAYS판, 판 하나 조작 쪽마다 INPUT_MAX개까지.
export function cleanReplays(list) {
  return (Array.isArray(list) ? list : []).filter(r => r && Number.isFinite(r.seed) && Array.isArray(r.teams?.me) && Array.isArray(r.teams?.foe))
    .slice(-LIVE.REPLAYS)
    .map(r => ({ ...r, inputs: { me: cleanInputs(r.inputs?.me, ARENA.MAX_TICKS + 400, INPUT.AI_OFF), foe: cleanInputs(r.inputs?.foe, ARENA.MAX_TICKS + 400, INPUT.AI_OFF) } }));
}
