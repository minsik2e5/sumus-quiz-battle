// V13.230 펫 아레나 실시간 1:1(구성안 1장 ⭐ A안): 입력만 주고받고 각 폰이 같은 전투를 돌린다(롤백).
//   방(cloudflare/arena-room.mjs)은 두 학생의 조작에 틱 번호를 정해 0.1초마다 "이 틱까지 확정" 묶음을 보낸다.
//   폰은 확정된 전투(conf)를 한 벌 들고, 그 위에 아직 확정되지 않은 내 조작을 얹어 앞서 돌린다(pred, 내 조작은 바로 보인다).
//   새 묶음이 오면 확정 전투를 그 틱까지 돌리고, 앞서 돌린 전투를 거기서 다시 계산한다(되감기 최대 몇 틱, 느린 폰도 1ms 안).
// 같은 전투: 방장 = 'me' 쪽(아래), 들어온 친구 = 'foe' 쪽(위). 친구 화면은 이 파일이 위아래 · 좌우를 뒤집어 보여 준다
//   (자리 x → 100 − x, 방향 → 반대, me ↔ foe). 친구가 누른 방향 · 조준도 뒤집어서 같은 전투에 넣는다.
// 이 파일은 화면(DOM)이 없다: 검사(server/arena-check.mjs)가 Node에서 두 폰을 흉내 내 돌린다.
import { ARENA, createArena } from './arena-rules.js';

export const LIVE = {
  DELAY: 8,          // 방은 지금 틱보다 8틱(0.4초) 뒤까지만 확정한다(그보다 늦게 온 조작은 '늦게 누른 것'으로 다음 틱에)
  AHEAD: 4,          // 폰 시계가 앞서도 방 시계보다 4틱 넘게 미래로는 받지 않는다
  PULSE_MS: 100,     // 방 → 폰 확정 묶음 간격
  SEND_MS: 100,      // 폰 → 방: 바뀐 조작만 0.1초에 한 번 묶어서
  HASH_EVERY: 20,    // 1초마다 상태 요약을 비교한다(어긋나면 처음부터 다시 계산)
  AWAY_MS: 3000,     // 3초 동안 소식이 없으면 컴퓨터가 대신 조종
  PING_MS: 1000,
  LEAD_MAX: 40,      // 확정보다 2초 넘게 앞서 돌리지 않는다(연결이 끊기면 멈추고 기다린다)
  VS_MS: 5500,       // 시작 버튼 → VS 화면 2.5초 + 카운트다운 3초 → 첫 틱
  LOBBY_MS: 5 * 60000,
  MSG_MAX: 512,
  BATCH_MAX: 24,     // 한 메시지에 조작 24개까지
  EMOTES: ['👋', '😆', '😎', '😭', '🔥', '👍', '🙏', 'GG'],
  EMOTE_GAP_MS: 1500
};

// 방향(1~8, 위부터 시계 방향) · 조준(0~15)을 반 바퀴 돌린다. 공격 · 스킬 등 버튼 코드는 그대로.
export const flipDir = c => c >= 1 && c <= 8 ? ((c - 1 + 4) % 8) + 1 : c;
export const flipAim = a => (a + 8) % 16;
// 내 화면 기준 조작 [틱, 코드, 조준?] → 같은 전투 기준(side 0 방장은 그대로, 1 친구는 뒤집기).
export function toCanon(x, side) {
  if (!side) return x;
  return x.length > 2 && x[2] != null ? [x[0], flipDir(x[1]), flipAim(x[2])] : [x[0], flipDir(x[1])];
}

// 친구 화면: 같은 전투의 보기 · 사건을 뒤집는다(자리 · 방향 · 누구).
const POS = new Set(['x', 'y', 'tx', 'ty']);
const VEC = new Set(['nx', 'ny', 'fx', 'fy', 'cnx', 'cny', 'vx', 'vy']);
const WHO = new Set(['who', 'from', 'winner']);
const SWAP = { me: 'foe', foe: 'me' };
export function mirror(o) {
  if (o === null || typeof o !== 'object') return o;
  if (Array.isArray(o)) return o.map(mirror);
  const out = {};
  for (const k in o) {
    const v = o[k], key = k === 'me' ? 'foe' : k === 'foe' ? 'me' : k;
    if (typeof v === 'number') out[key] = POS.has(k) ? 100 - v : VEC.has(k) ? -v : v;
    else if (typeof v === 'string' && WHO.has(k)) out[key] = SWAP[v] || v;
    else out[key] = typeof v === 'object' ? mirror(v) : v;
  }
  return out;
}
const flip = (side, x) => side ? mirror(x) : x;

// 사건 이름표: 같은 틱의 같은 사건을 두 번 보여 주지 않는다(되감아 다시 계산할 때).
const evKey = (t, e) => `${t}|${e.e}|${e.who || e.from || ''}|${e.kind || e.id || ''}|${e.idx ?? ''}`;

// 화면이 쓰는 전투 하나(혼자 판 · 다시 보기와 같은 모양): S(t · over · winner) · step() · view().
export class LiveSim {
  // a · b: 방장 · 친구 팀(fighter 3개씩), side: 0 방장 · 1 친구.
  constructor({ seed, a, b, side }) {
    Object.assign(this, { seed, a, b, side });
    this.reset();
  }
  reset() {
    const make = () => createArena({ seed: this.seed, me: this.a, foe: this.b, foeHuman: true });
    this.conf = make();
    this.pred = make();
    this.all = [[], []];       // 확정된 조작(같은 전투 기준) — 다시 보기 · 서버 확인에 쓴다
    this.pending = [];         // 아직 확정 안 된 내 조작 [순번, 조작]
    this.seq ||= 0;
    this.upto = -1;
    this.shown = new Map();    // 틱 → 보여 준 사건 이름표
    this.late = [];            // 되감기로 새로 생긴 사건(다음 step 때 보여 준다)
    this.bad = false;          // 상태 요약이 방과 다르다 → 처음부터 다시 받기
    this.rollbacks = 0; this.maxRewind = 0;
  }
  get S() {
    const c = this.conf.S, w = c.over ? (this.side ? SWAP[c.winner] || c.winner : c.winner) : null;
    return { t: this.pred.S.t, over: c.over, winner: w, conf: c.t };
  }
  // 앞서 돌릴 수 있나(확정보다 너무 앞서면 기다린다).
  canStep() { return !this.pred.S.over && this.pred.S.t < this.conf.S.t + LIVE.LEAD_MAX; }
  // 내 조작(내 화면 기준) → 같은 전투에 넣고, 방에 보낼 [순번, 조작]을 돌려준다.
  local(x) {
    const c = toCanon(x, this.side), seq = ++this.seq;
    this.pending.push([seq, c]);
    this.side ? this.pred.push2(c) : this.pred.push(c);
    return [seq, c];
  }
  step() {
    const t = this.pred.S.t, ev = this.pred.step(), out = this.late.splice(0);
    const seen = this.shown.get(t) || new Set();
    for (const e of ev) { const k = evKey(t, e); if (!seen.has(k)) { seen.add(k); out.push(e); } }
    this.shown.set(t, seen);
    return flip(this.side, out);
  }
  view() { return flip(this.side, this.pred.view()); }
  // 방의 확정 묶음 { u: 이 틱까지 확정, i: [[쪽, 틱, 코드, 조준?] …], k: [방장 순번, 친구 순번], h: { t, v } }.
  confirm({ u, i = [], k = [0, 0], h = null }) {
    for (const [sd, ...x] of i) { this.all[sd].push(x); sd ? this.conf.push2(x) : this.conf.push(x); }
    while (!this.conf.S.over && this.conf.S.t <= u) this.conf.step();
    this.upto = Math.max(this.upto, u);
    if (h && h.t === this.conf.S.t && h.v !== this.conf.hash()) this.bad = true;
    const ack = Number(k[this.side] || 0);
    this.pending = this.pending.filter(([s]) => s > ack);
    this.rebuild();
  }
  // 되감기: 확정 전투를 복사하고, 확정 안 된 내 조작을 얹어 지금 틱까지 다시 돌린다. 친구 조작은 '하던 대로'(방향 유지).
  rebuild() {
    const target = this.pred.S.t, from = this.conf.S.t;
    const mine = this.pending.map(([, x]) => x[0] < from ? [from, ...x.slice(1)] : x);
    this.pred.load(this.conf.save(), this.side ? [] : mine, this.side ? mine : []);
    const n = Math.max(0, target - from);
    this.rollbacks++; this.maxRewind = Math.max(this.maxRewind, n);
    while (this.pred.S.t < target && !this.pred.S.over) {
      const t = this.pred.S.t, ev = this.pred.step(), seen = this.shown.get(t) || new Set();
      for (const e of ev) { const key = evKey(t, e); if (!seen.has(key)) { seen.add(key); this.late.push(e); } }
      this.shown.set(t, seen);
    }
    // 같은 틱을 너무 늦게 보여 주면 이상하니, 0.5초 넘게 지난 사건은 체력 막대 · 자리만 바뀌게 둔다.
    if (this.late.length > 12) this.late = this.late.filter(e => e.e === 'faint' || e.e === 'swap' || e.e === 'over');
    for (const t of this.shown.keys()) if (t < from - 40) this.shown.delete(t);
  }
  // 처음부터 다시(다시 들어옴 · 어긋남): 방이 준 확정 조작 전체로.
  full({ u, ia = [], ib = [] }) {
    const target = this.pred.S.t, pending = this.pending;
    this.reset();
    this.pending = pending;
    for (const x of ia) { this.all[0].push(x); this.conf.push(x); }
    for (const x of ib) { this.all[1].push(x); this.conf.push2(x); }
    while (!this.conf.S.over && this.conf.S.t <= u) this.conf.step();
    this.upto = u;
    // 다시 들어오면 지금 틱까지 효과 없이 따라잡는다.
    this.pred.load(this.conf.save(), this.side ? [] : pending.map(([, x]) => x), this.side ? pending.map(([, x]) => x) : []);
    while (this.pred.S.t < Math.max(target, this.conf.S.t) && !this.pred.S.over && this.pred.S.t < this.conf.S.t + LIVE.LEAD_MAX) {
      const t = this.pred.S.t, ev = this.pred.step(), seen = new Set(ev.map(e => evKey(t, e)));
      this.shown.set(t, seen);
    }
  }
  // 이 판의 결과(같은 전투 기준 → 내 쪽 기준): 끝 화면 숫자.
  mine() {
    const c = this.conf.S, me = this.side ? 'foe' : 'me', foe = this.side ? 'me' : 'foe';
    return { ko: c.ko[me], dealt: c.dealt[me], ults: c.ults[me], team: c[me].team.map(f => f.cur), foeTeam: c[foe].team.map(f => f.cur) };
  }
}

// 다시 보기: 씨앗 + 두 쪽 조작 기록으로 처음부터 다시 돈다(혼자 판은 상대가 컴퓨터, foeLevel).
export function replaySim({ seed, a, b, ia = [], ib = null, side = 0, foeLevel = 1 }) {
  const A = createArena({ seed, me: a, foe: b, foeLevel, foeHuman: !!ib });
  for (const x of ia) A.push(x);
  for (const x of ib || []) A.push2(x);
  return {
    get S() { const s = A.S; return { t: s.t, over: s.over, winner: s.over && side ? SWAP[s.winner] || s.winner : s.winner }; },
    step: () => flip(side, A.step()),
    view: () => flip(side, A.view()),
    canStep: () => !A.S.over && A.S.t < ARENA.MAX_TICKS + 10
  };
}
