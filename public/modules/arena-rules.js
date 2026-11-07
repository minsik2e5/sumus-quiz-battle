import { CHARACTERS } from './core.js';
import { elementOf } from './battle-fx.js';
import { PET_SKILLS } from './battle-engine.js';

// V13.223 펫 아레나(놀이터): 내 펫 3마리 팀과 상대 팀이 넓은 경기장에서 알아서 싸운다(한 번에 한 마리씩 나와 1:1,
// 쓰러지면 다음 펫). 학생은 화면 아래 단어 문제를 맞혀 필살기 게이지를 채운다(꽉 차면 저절로 필살기). 틀리면 내 펫이 잠깐 멈칫.
// 전투는 정해진 씨앗(seed)과 '몇 번째 틱에 맞혔나/틀렸나'만으로 정해진다: 화면(arena.js)이 그 자리에서 돌리고,
// 끝나면 서버(server/arena.mjs)가 같은 함수로 다시 돌려 승패 · 보상을 정한다. 그래서 이 파일에는 화면도 무작위 함수도 없고,
// 브라우저마다 결과가 다를 수 있는 삼각함수(sin · cos · atan2)도 쓰지 않는다(+ − × ÷ · sqrt · floor만).
export const ARENA = {
  TEAM: 3,
  TICK_MS: 50,               // 전투 한 틱
  MAX_TICKS: 2400,           // 2분이 지나면 남은 체력 비율로 승패
  COUNTDOWN_MS: 3000,
  QUESTIONS: 45,             // 한 판에 준비하는 문제(다 쓰면 다시 처음부터)
  Q_LIMIT_TICKS: 140,        // 한 문제 7초(넘기면 놓친 것)
  MIN_PICK_TICKS: 8,         // 0.4초 안에 고른 답은 읽지 않고 누른 것(놓친 것)
  GAP_TICKS: 6,              // 답하고 다음 문제가 나오기까지 0.3초
  GAUGE_MAX: 100,
  GAUGE_HIT: 25,             // 맞히면 +25
  GAUGE_COMBO: 10,           // 3콤보부터 +10 더
  COMBO_AT: 3,
  STUN_TICKS: 16,            // 틀리면(또는 시간 끝) 내 펫이 0.8초 멈칫
  ULT_FREEZE_TICKS: 24,      // 필살기 컷인 동안 경기장이 멈춘다(1.2초)
  ULT_POWER: 6,              // 필살기 = 공격력 × 6
  SKILL_POWER: 2.2,          // 기술(5초마다) = 공격력 × 2.2
  SKILL_TICKS: 100,
  ENTER_TICKS: 30,           // 쓰러지고 다음 펫이 나오기까지
  FOE_ULT_TICKS: [380, 300, 240], // 상대가 필살기를 쓰는 간격(쉬움 · 보통 · 어려움): 19초 · 15초 · 12초
  FIELD: { minX: 8, maxX: 92, minY: 14, maxY: 86 }, // 경기장 바닥(%, 화면 배치 STAGE와 같다)
  DAILY: 5,                  // 하루에 코인을 받는 판
  COINS: { win: 12, lose: 4 },
  LOSE_MIN_OK: 5,            // 져도 5문제 이상 맞혔으면 위로 코인
  STREAK_COINS: 3,           // 3연승마다 +3
  XP: 6,
  STALE_MS: 10 * 60000,
  SLACK_MS: 3000,
  MISSED_MAX: 12
};

// 속성 상성: 이기는 속성에 1.3배, 지는 속성에 0.8배. 별빛은 모두와 보통. 속성마다 두 개를 이기고 두 개에 진다.
export const BEATS = {
  flame: ['leaf', 'ice'], water: ['flame', 'earth'], leaf: ['water', 'earth'], earth: ['flame', 'toxic'],
  wind: ['toxic', 'leaf'], ice: ['wind', 'water'], toxic: ['wind', 'ice'], star: []
};
export const matchup = (a, b) => BEATS[a]?.includes(b) ? 1.3 : BEATS[b]?.includes(a) ? 0.8 : 1;
// 속성마다 기술 모양: 빔(직선 광선) · 발사체(구슬) · 지진(바닥 범위) · 돌진(부딪치기). 모양이 거리를 정한다.
export const SHAPE = { flame: 'beam', ice: 'beam', star: 'beam', water: 'orb', toxic: 'orb', earth: 'quake', leaf: 'dash', wind: 'dash' };
const RANGE = { beam: 34, orb: 30, quake: 20, dash: 9 };
const TRAVEL = { beam: 2, orb: 7, quake: 4, dash: 3 }; // 공격이 닿기까지 틱(화면 연출과 맞춘다)

// 등급: 일반 0 · 영웅 1 · 전설 · 한정 · 시리즈 2 · 신화 3.
export function petRank(key) {
  const c = CHARACTERS[key] || {};
  return c.mythic ? 3 : c.legendary || c.limited || c.series || c.rank === 'legendary' ? 2 : c.epic || c.rank === 'epic' ? 1 : 0;
}
const FORM_HP = [0, 300, 420, 560], FORM_ATK = [0, 12, 16, 20], RANK_MUL = [1, 1.06, 1.1, 1.14];
// 펫 이름에서 고정으로 정한 작은 차이(같은 펫은 늘 같다): 빠르기 0.9~1.1.
const keyHash = key => [...String(key)].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) % 9973, 7);
// 싸우는 펫 하나: { key, form(1~3), level } → 능력치. 알(form 0)은 싸우지 않는다.
export function fighter(pet) {
  const key = String(pet?.key || 'dog'), form = Math.max(1, Math.min(3, Math.round(Number(pet?.form) || 1)));
  const level = Math.max(1, Math.min(60, Math.round(Number(pet?.level) || 1))), rank = petRank(key), el = elementOf(key);
  const mul = RANK_MUL[rank] * (1 + Math.min(30, level) * 0.01);
  const spd = 0.9 + (keyHash(key) % 21) / 100;
  return {
    key, form, level, rank, el, shape: SHAPE[el] || 'beam',
    hp: Math.round(FORM_HP[form] * mul), atk: Math.round(FORM_ATK[form] * mul),
    spd, atkTicks: Math.round(28 / spd), move: 0.55 * spd,
    skill: PET_SKILLS[key]?.name || '필살기'
  };
}
export const teamPower = team => (team || []).reduce((n, f) => n + f.hp / 10 + f.atk * 3, 0);

// 같은 씨앗이면 어디서나 같은 수(mulberry32).
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 문제 시간표: picks [[고른 자리(-1 = 시간 끝), 틱], …], answers 정답 자리. 문제 i는 앞 답 + GAP_TICKS에 나온다(첫 문제는 0틱).
// 너무 빨리 고른 답 · 시간이 넘은 답은 놓친 것. 고른 틱이 앞뒤가 안 맞으면(되돌아가거나 한도를 넘으면) 거기서 멈춘다.
// 결과: inputs [{ t, ok }] (전투에 넣을 입력) · marks · correct · wrong.
export function gradeAnswers(answers, picks, maxTick = ARENA.MAX_TICKS) {
  const inputs = [], marks = [];
  let shown = 0, correct = 0;
  for (let i = 0; i < (picks || []).length && i < (answers || []).length; i++) {
    const raw = picks[i] || [], pick = Number.isInteger(raw[0]) ? raw[0] : -1, t = Math.round(Number(raw[1]));
    if (!Number.isFinite(t) || t < shown || t > shown + ARENA.Q_LIMIT_TICKS || t > maxTick) break;
    const ok = pick >= 0 && pick <= 3 && pick === answers[i] && t - shown >= ARENA.MIN_PICK_TICKS;
    if (pick < 0 && t !== shown + ARENA.Q_LIMIT_TICKS) break; // 시간 끝은 딱 그 틱에만
    inputs.push({ t, ok });
    marks.push(ok ? 1 : 0);
    if (ok) correct++;
    shown = t + ARENA.GAP_TICKS;
  }
  return { inputs, marks, correct, wrong: marks.length - correct, next: shown };
}

// 전투. me · foe: fighter() 3개씩. inputs: 내 답 [{ t, ok }](틱 순서). 한 틱씩 step()으로 돌린다.
// 화면은 step()이 돌려주는 사건(ev)으로 그리고, 서버는 끝까지 돌려 결과만 본다.
export function createArena({ seed, me, foe, foeLevel = 1 }) {
  const random = rng(seed);
  const side = (team, who) => ({
    who, team: team.map(f => ({ ...f, cur: f.hp })), idx: 0, gauge: 0, combo: 0, stun: 0,
    x: who === 'me' ? 50 : 50, y: who === 'me' ? 74 : 26, cd: 20 + Math.floor(random() * 10), skill: ARENA.SKILL_TICKS - 30 + Math.floor(random() * 30),
    enter: 0, strafe: random() < 0.5 ? 1 : -1, ultAt: null
  });
  const S = { t: 0, freeze: 0, over: false, winner: null, me: side(me, 'me'), foe: side(foe, 'foe'), pending: [], foeUlt: ARENA.FOE_ULT_TICKS[Math.max(0, Math.min(2, foeLevel))], inputs: [], ip: 0, ults: { me: 0, foe: 0 } };
  S.foe.gauge = 0;
  const active = s => s.team[s.idx];
  const other = s => s === S.me ? S.foe : S.me;
  const alive = s => s.team.some(f => f.cur > 0);

  function hit(from, to, power, kind, ev) {
    const a = active(from), d = active(to);
    if (!a || !d || d.cur <= 0) return;
    const m = matchup(a.el, d.el), spread = 0.9 + random() * 0.2;
    const dmg = Math.max(1, Math.round(a.atk * power * m * spread));
    S.pending.push({ at: S.t + (kind === 'ult' ? 3 : TRAVEL[a.shape]), from: from.who, to: to.who, dmg, kind, m, target: to.idx });
    ev.push({ e: kind, who: from.who, shape: a.shape, el: a.el, dmg, m, fx: from.x, fy: from.y, tx: to.x, ty: to.y, travel: kind === 'ult' ? 3 : TRAVEL[a.shape] });
  }
  function land(ev) {
    for (const h of S.pending.filter(x => x.at <= S.t)) {
      const s = h.to === 'me' ? S.me : S.foe, d = s.team[h.target];
      if (!d || d.cur <= 0 || s.idx !== h.target) continue;
      d.cur = Math.max(0, d.cur - h.dmg);
      ev.push({ e: 'dmg', who: h.to, dmg: h.dmg, kind: h.kind, m: h.m, hp: d.cur, max: d.hp, x: s.x, y: s.y });
      if (d.cur <= 0) {
        ev.push({ e: 'faint', who: h.to, idx: s.idx, key: d.key });
        const next = s.team.findIndex(f => f.cur > 0);
        if (next >= 0) { s.idx = next; s.enter = ARENA.ENTER_TICKS; s.stun = 0; s.x = 50; s.y = s.who === 'me' ? 80 : 20; }
      }
    }
    S.pending = S.pending.filter(x => x.at > S.t);
  }
  // 움직임: 상대와의 거리를 기술 사거리에 맞추고, 옆으로 돌며 다가간다(삼각함수 없이 수직 벡터로).
  function move(s) {
    const a = active(s), o = other(s);
    const dx = o.x - s.x, dy = o.y - s.y, dist = Math.sqrt(dx * dx + dy * dy) || 1, want = RANGE[a.shape];
    const nx = dx / dist, ny = dy / dist;
    const toward = dist > want + 3 ? 1 : dist < want - 6 ? -0.8 : 0;
    if (random() < 0.012) s.strafe = -s.strafe;
    // 경기장 가운데로 살짝 당긴다(가장자리에 몰려 붙지 않게).
    const vx = (nx * toward + -ny * s.strafe * 0.6 + (50 - s.x) * 0.012) * a.move, vy = (ny * toward + nx * s.strafe * 0.6 + (50 - s.y) * 0.012) * a.move;
    s.x = Math.max(ARENA.FIELD.minX, Math.min(ARENA.FIELD.maxX, s.x + vx));
    s.y = Math.max(ARENA.FIELD.minY, Math.min(ARENA.FIELD.maxY, s.y + vy));
    if (s.x <= ARENA.FIELD.minX + 0.5 || s.x >= ARENA.FIELD.maxX - 0.5) s.strafe = -s.strafe;
    return dist;
  }
  function ult(s, ev) {
    const a = active(s);
    s.gauge = 0;
    S.ults[s.who]++;
    S.freeze = ARENA.ULT_FREEZE_TICKS;
    ev.push({ e: 'cutin', who: s.who, key: a.key, form: a.form, el: a.el, name: a.skill, rank: a.rank });
    hit(s, other(s), ARENA.ULT_POWER, 'ult', ev);
  }
  function act(s, dist, ev) {
    const a = active(s);
    if (s.enter > 0) { s.enter--; if (!s.enter) ev.push({ e: 'enter', who: s.who, idx: s.idx, key: a.key }); return; }
    if (s.stun > 0) { s.stun--; return; }
    if (s.gauge >= ARENA.GAUGE_MAX && other(s).enter <= 0) return ult(s, ev);
    s.cd--; s.skill--;
    const inRange = dist <= RANGE[a.shape] + 6;
    if (s.skill <= 0 && inRange && other(s).enter <= 0) { s.skill = ARENA.SKILL_TICKS; s.cd = a.atkTicks; return hit(s, other(s), ARENA.SKILL_POWER, 'skill', ev); }
    if (s.cd <= 0 && inRange && other(s).enter <= 0) { s.cd = a.atkTicks; hit(s, other(s), 1, 'atk', ev); }
  }
  function input(ev) {
    while (S.ip < S.inputs.length && S.inputs[S.ip].t <= S.t) {
      const x = S.inputs[S.ip++], s = S.me;
      if (x.ok) {
        s.combo++;
        s.gauge = Math.min(ARENA.GAUGE_MAX, s.gauge + ARENA.GAUGE_HIT + (s.combo >= ARENA.COMBO_AT ? ARENA.GAUGE_COMBO : 0));
        ev.push({ e: 'ok', combo: s.combo, gauge: s.gauge });
      } else {
        s.combo = 0;
        if (s.enter <= 0) s.stun = Math.max(s.stun, ARENA.STUN_TICKS);
        ev.push({ e: 'bad', x: s.x, y: s.y });
      }
    }
  }
  function finish(ev) {
    if (S.over) return;
    const meAlive = alive(S.me), foeAlive = alive(S.foe);
    let winner = null;
    if (!foeAlive && meAlive) winner = 'me';
    else if (!meAlive && foeAlive) winner = 'foe';
    else if (!meAlive && !foeAlive) winner = 'draw';
    else if (S.t >= ARENA.MAX_TICKS) {
      const left = s => s.team.reduce((n, f) => n + f.cur / f.hp, 0);
      const a = left(S.me), b = left(S.foe);
      winner = Math.abs(a - b) < 1e-9 ? 'draw' : a > b ? 'me' : 'foe';
    }
    if (winner) { S.over = true; S.winner = winner; ev.push({ e: 'over', winner }); }
  }
  // 한 틱. 앞으로 넣을 내 답은 push(x)로(틱 순서대로).
  function step() {
    const ev = [];
    if (S.over) return ev;
    input(ev);
    if (S.freeze > 0) { S.freeze--; if (!S.freeze) land(ev); S.t++; finish(ev); return ev; }
    // 상대 게이지: 일정하게 차오른다(상대의 단어 실력).
    if (S.foe.enter <= 0) S.foe.gauge = Math.min(ARENA.GAUGE_MAX, S.foe.gauge + ARENA.GAUGE_MAX / S.foeUlt);
    const dMe = S.me.enter > 0 || S.me.stun > 0 ? null : move(S.me), dFoe = S.foe.enter > 0 ? null : move(S.foe);
    const dist = s => { const o = other(s), dx = o.x - s.x, dy = o.y - s.y; return Math.sqrt(dx * dx + dy * dy); };
    act(S.me, dMe ?? dist(S.me), ev);
    if (!S.freeze) act(S.foe, dFoe ?? dist(S.foe), ev);
    land(ev);
    S.t++;
    finish(ev);
    return ev;
  }
  return {
    S, step,
    push: x => { S.inputs.push(x); },
    view: () => ({ t: S.t, me: { x: S.me.x, y: S.me.y, idx: S.me.idx, gauge: S.me.gauge, combo: S.me.combo, stun: S.me.stun, enter: S.me.enter, team: S.me.team.map(f => ({ key: f.key, cur: f.cur, hp: f.hp })) },
      foe: { x: S.foe.x, y: S.foe.y, idx: S.foe.idx, gauge: S.foe.gauge, enter: S.foe.enter, team: S.foe.team.map(f => ({ key: f.key, cur: f.cur, hp: f.hp })) }, over: S.over, winner: S.winner })
  };
}

// 끝까지 한 번에(서버 · 검사): 결과 { winner, ticks, ults, left }.
export function runArena({ seed, me, foe, foeLevel, inputs }) {
  const A = createArena({ seed, me, foe, foeLevel });
  for (const x of inputs || []) A.push(x);
  let guard = 0;
  while (!A.S.over && guard++ < ARENA.MAX_TICKS + 2000) A.step();
  const left = s => s.team.filter(f => f.cur > 0).length;
  return { winner: A.S.winner || 'draw', ticks: A.S.t, ults: { ...A.S.ults }, left: { me: left(A.S.me), foe: left(A.S.foe) } };
}
