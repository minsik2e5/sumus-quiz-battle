// V13.227 펫 아레나 시뮬레이터(검사 · 밸런스 맞추기용, 앱에는 들어가지 않는다).
//   node server/arena-sim.mjs tiers 300   등급끼리 승률(같은 단계 · 같은 레벨, 양쪽 모두 같은 솜씨의 컴퓨터가 조종)
//   node server/arena-sim.mjs bots 120    검사용 학생(대충 · 보통 · 잘함) 대 컴퓨터(쉬움 · 보통 · 어려움) 승률
// 목표(docs/pet-arena-v2-plan.md 2장 · 5장): 일반 대 영웅 50% ± 3, 전설 대 일반 ≈ 55%, 신화 대 전설 ≈ 55%, 한정 대 일반 50% ± 3.
//   보통 학생 대 컴퓨터: 쉬움 ≈ 90% · 보통 ≈ 50% · 어려움 ≈ 35%.
import { fileURLToPath } from 'node:url';
import { ARENA, INPUT, createArena, fighter, petTier, dirCode, aimCode } from '../public/modules/arena-rules.js';
import { CHARACTERS } from '../public/modules/core.js';

export const seeded = seed => () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };

// 사람처럼 조종하는 검사용 학생(skill 0 대충 · 1 보통 · 2 잘함). 화면 보기(view)만 읽어 조작 기록을 만든다.
// V13.227 조준 규칙을 사람처럼 따른다: 기본 공격은 조이스틱을 상대 쪽으로 한 번 밀고(바라보는 방향) 톡 누르고,
//   스킬 · 필살기는 버튼을 끌어서 조준한다(솜씨만큼 정확히, 아니면 16방향 한 칸 빗나감).
export function playArena(A, skill = 1, seed = 1) {
  const P = [{ dodge: 0.05, atk: 0.5, keep: 0.3, acc: 0.55 }, { dodge: 0.2, atk: 0.75, keep: 0.6, acc: 0.8 }, { dodge: 0.45, atk: 0.95, keep: 0.9, acc: 0.95 }][skill];
  const rnd = seeded(seed * 13 + 1), inputs = [];
  let dir = -1, guard = 0, aiming = 0, off = 0;
  const aim = (dx, dy) => { const c = aimCode(dx, dy); return rnd() < P.acc ? c : (c + (rnd() < 0.5 ? 15 : 1)) % 16; };
  while (!A.S.over && guard++ < ARENA.MAX_TICKS + 50) {
    const v = A.view(), m = v.me, f = v.foe, t = v.t, out = [];
    const dx = f.x - m.x, dy = f.y - m.y, d = Math.sqrt(dx * dx + dy * dy) || 1;
    const melee = ['quake', 'dash'].includes(A.S.me.team[m.idx].shape), want = melee ? 9 : 28;
    let mx, my;
    // 공격할 때: 상대 쪽으로 조이스틱을 밀어(가끔 옆으로 빗나감) 바라보게 하고, 다음 틱부터 공격이 나갈 때까지 톡.
    if (m.cd <= 1 && f.enter <= 0 && m.enter <= 0 && d < (melee ? 18 : 46)) {
      if (!aiming) { aiming = rnd() < P.atk ? 1 : -1; off = rnd() < P.acc ? 0 : (rnd() < 0.5 ? 0.9 : -0.9); }
      else if (aiming > 0) out.push([t, INPUT.ATK]);
      else if (rnd() < 0.25) aiming = 0; // 이번엔 안 쳤다 → 곧 다시 고민
    } else aiming = 0;
    if (aiming > 0) { mx = dx / d - dy / d * off; my = dy / d + dx / d * off; } else if (rnd() < P.keep) { const tw = d > want + 4 ? 1 : d < want - 5 ? -1 : 0; mx = dx / d * tw - dy / d * 0.7; my = dy / d * tw + dx / d * 0.7; } else { mx = rnd() - 0.5; my = rnd() - 0.5; }
    const c = dirCode(mx, my, 0.2); if (c !== dir) { dir = c; out.push([t, c]); }
    const danger = v.shots.some(s => s.from === 'foe' && Math.abs(s.x - m.x) < 12 && Math.abs(s.y - m.y) < 12) || v.quakes.some(q => q.from === 'foe' && q.left < 8 && Math.abs(q.x - m.x) < q.r + 3 && Math.abs(q.y - m.y) < q.r + 3);
    if (danger && m.dodgeCd <= 0 && rnd() < P.dodge) out.push([t, INPUT.DODGE]);
    if (m.gauge >= ARENA.GAUGE_MAX && f.enter <= 0) out.push([t, INPUT.ULT, aim(dx, dy)]);
    if (m.skill <= 0 && d < want + 14 && f.enter <= 0) out.push([t, INPUT.SKILL, aim(dx, dy)]);
    else if (m.skill2 <= 0 && d < want + 18 && f.enter <= 0) out.push([t, INPUT.SKILL2, aim(dx, dy)]);
    for (const x of out) { inputs.push(x); A.push(x); }
    A.step();
  }
  return inputs;
}

const BOT_TEAMS = {
  me: [['dog', 'bear', 'fox'], ['dragon', 'penguin', 'cat'], ['snake', 'panda', 'owl']],
  foe: [['pig', 'rabbit', 'owl'], ['dog', 'bear', 'fox'], ['dragon', 'cat', 'panda']]
};
// 검사용 학생 솜씨 skill 대 컴퓨터 foeLevel: 이긴 비율 · 한 판 평균 초.
export function botRate(foeLevel, skill, n = 45) {
  let w = 0, ticks = 0;
  for (let s = 1; s <= n; s++) {
    const me = BOT_TEAMS.me[s % 3].map(key => fighter({ key, form: 2, level: 12 })), foe = BOT_TEAMS.foe[s % 3].map(key => fighter({ key, form: 2, level: 12 }));
    const A = createArena({ seed: s * 37, me, foe, foeLevel }); playArena(A, skill, s);
    if (A.S.winner === 'me') w++; else if (A.S.winner === 'draw') w += 0.5;
    ticks += A.S.t;
  }
  return { w: w / n, sec: ticks / n * ARENA.TICK_MS / 1000 };
}

export const TIER_POOL = (() => { const out = { normal: [], epic: [], legend: [], limited: [], mythic: [] }; for (const k of Object.keys(CHARACTERS)) out[petTier(k)].push(k); return out; })();
// 등급 a 팀 대 등급 b 팀(같은 단계 · 레벨, 양쪽 모두 보통 솜씨 컴퓨터). 자리 차이가 없게 절반은 자리를 바꾼다. a가 이긴 비율(무승부는 반).
//   능력치는 정수로 반올림되므로 단계(2 · 3)와 레벨(8~16)을 판마다 바꿔 반올림 차이가 한쪽으로 쏠리지 않게 한다(양쪽은 늘 같은 단계 · 레벨).
export function tierRate(a, b, n = 300) {
  const A = TIER_POOL[a], B = TIER_POOL[b], rnd = seeded(n * 7 + a.length * 31 + b.length);
  const pick = (list, form, level) => [0, 1, 2].map(() => fighter({ key: list[Math.floor(rnd() * list.length)], form, level }));
  let w = 0;
  for (let i = 0; i < n; i++) {
    const form = 2 + ((i >> 1) % 2), level = 8 + ((i >> 2) % 9), x = pick(A, form, level), y = pick(B, form, level), flip = i % 2 === 1;
    const S = createArena({ seed: 1000 + i * 17, me: flip ? y : x, foe: flip ? x : y, foeLevel: 1, meAi: 1 });
    let guard = 0; while (!S.S.over && guard++ < ARENA.MAX_TICKS + 50) S.step();
    const win = S.S.winner === (flip ? 'foe' : 'me');
    w += win ? 1 : S.S.winner === 'draw' ? 0.5 : 0;
  }
  return w / n;
}
export const TIER_PAIRS = [['epic', 'normal', 0.5, 0.03], ['legend', 'normal', 0.55, 0.04], ['mythic', 'legend', 0.55, 0.04], ['limited', 'normal', 0.5, 0.03]];

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [mode = 'tiers', nArg] = process.argv.slice(2), n = Number(nArg) || (mode === 'bots' ? 120 : 300);
  const pc = x => `${(x * 100).toFixed(1)}%`;
  if (mode === 'tiers') {
    console.log(`등급 승률(${n}판씩, 2 · 3단계 Lv.8~16, 양쪽 보통 컴퓨터)`);
    for (const [a, b, goal, tol] of TIER_PAIRS) { const r = tierRate(a, b, n); console.log(`${a} 대 ${b}: ${pc(r)} (목표 ${pc(goal)} ± ${Math.round(tol * 100)}) ${Math.abs(r - goal) <= tol ? 'OK' : '벗어남'}`); }
    console.log('(참고)', ['epic', 'legend', 'limited', 'mythic'].map(t => `${t} 대 normal ${pc(tierRate(t, 'normal', n))}`).join(' · '));
  } else if (mode === 'bots') {
    console.log(`검사용 학생 대 컴퓨터(${n}판씩)`);
    for (const [skill, name] of [[0, '대충'], [1, '보통'], [2, '잘함']]) console.log(`${name}: ` + [0, 1, 2].map(fl => { const r = botRate(fl, skill, n); return `${['쉬움', '보통', '어려움'][fl]} ${pc(r.w)}(${Math.round(r.sec)}초)`; }).join(' · '));
  }
}
