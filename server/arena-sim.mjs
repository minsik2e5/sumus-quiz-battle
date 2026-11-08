// V13.228 펫 아레나 시뮬레이터(검사 · 밸런스 맞추기용, 앱에는 들어가지 않는다).
//   node server/arena-sim.mjs tiers 300   등급끼리 승률(같은 단계 · 같은 레벨, 양쪽 모두 같은 솜씨의 컴퓨터가 조종)
//   node server/arena-sim.mjs bots 120    검사용 학생(대충 · 보통 · 잘함) 대 컴퓨터(쉬움 · 보통 · 어려움) 승률
//   node server/arena-sim.mjs picks 1000  V13.229 속성마다 스킬 ② 두 개: 검사용 학생이 A · B를 골라 같은 상대들을 이긴 비율(목표 차이 ±3)
// 목표(docs/pet-arena-v2-plan.md 2장 · 5장): 일반 대 영웅 50% ± 3, 전설 대 일반 ≈ 55%, 신화 대 전설 ≈ 55%, 한정 대 일반 50% ± 3.
//   보통 학생 대 컴퓨터: 쉬움 ≈ 90% · 보통 ≈ 50% · 어려움 ≈ 35%.
import { fileURLToPath } from 'node:url';
import { ARENA, INPUT, EL_SKILLS, createArena, fighter, petTier, dirCode, aimCode } from '../public/modules/arena-rules.js';
import { elementOf } from '../public/modules/battle-fx.js';
import { CHARACTERS } from '../public/modules/core.js';

export const seeded = seed => () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };

// 사람처럼 조종하는 검사용 학생(skill 0 대충 · 1 보통 · 2 잘함). 화면 보기(view)만 읽어 조작 기록을 만든다.
// V13.228 조준 규칙을 사람처럼 따른다: 기본 공격은 조이스틱을 상대 쪽으로 한 번 밀고(바라보는 방향) 톡 누르고,
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
    // V13.229 사람처럼 줄기 표시 · 장판도 본다: 줄기 표시 위면 피하고, 상대 장판 안이면 바깥쪽으로 걸어 나간다.
    const onLine = L => { const rx = m.x - L.x, ry = m.y - L.y, al = rx * L.nx + ry * L.ny; return al > -5 && al < L.len + 5 && Math.abs(rx * L.ny - ry * L.nx) < L.w + 6; };
    const zone = (v.zones || []).find(z => z.from === 'foe' && z.id !== 'petal' && Math.abs(z.x - m.x) < z.r + 3 && Math.abs(z.y - m.y) < z.r + 3);
    if (zone && rnd() < P.keep) { const zx = m.x - zone.x, zy = m.y - zone.y, zl = Math.sqrt(zx * zx + zy * zy) || 1; mx = zx / zl; my = zy / zl; }
    const danger = v.shots.some(s => s.from === 'foe' && Math.abs(s.x - m.x) < 12 && Math.abs(s.y - m.y) < 12) || v.quakes.some(q => q.from === 'foe' && q.left < 8 && Math.abs(q.x - m.x) < q.r + 3 && Math.abs(q.y - m.y) < q.r + 3)
      || (v.lines || []).some(L => L.from === 'foe' && L.left <= 3 && onLine(L));
    const c = dirCode(mx, my, 0.2); if (c !== dir) { dir = c; out.push([t, c]); }
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
    const me = BOT_TEAMS.me[s % 3].map((key, i) => fighter({ key, form: 2, level: 12, s2: (s >> 1) + i & 1 })), foe = BOT_TEAMS.foe[s % 3].map((key, i) => fighter({ key, form: 2, level: 12, s2: (s >> 2) + i & 1 }));
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
  const pick = (list, form, level) => [0, 1, 2].map(() => fighter({ key: list[Math.floor(rnd() * list.length)], form, level, s2: rnd() < 0.5 ? 0 : 1 }));
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
// V13.229 스킬 ② 고르기 승률: 고르는 것은 학생이므로, 속성 el 펫 셋을 가진 검사용 학생(보통 솜씨, playArena)이 스킬 pick(0 A · 1 B)을
//   골랐을 때 보통 컴퓨터가 조종하는 섞인 상대 팀(스킬 ②도 섞임)을 이긴 비율. A와 B는 같은 판(같은 씨앗 · 같은 내 펫 · 같은 상대)을
//   돌려 비교한다(짝지은 비교라 흔들림이 작다). 목표: |A 승률 − B 승률| ≤ 3%(무엇을 골라도 승률 차이 ±3% 안).
//   참고로 컴퓨터끼리(aiPickRate)도 본다.
export const EL_KEYS = (() => { const out = {}; for (const k of Object.keys(CHARACTERS)) (out[elementOf(k)] ||= []).push(k); return out; })();
const ALL_KEYS = Object.keys(CHARACTERS);
const pickTeams = (el, pick, i, rnd) => {
  const keys = EL_KEYS[el] || [], form = 2 + ((i >> 1) % 2), level = 8 + ((i >> 2) % 9);
  const mine = [0, 1, 2].map(() => fighter({ key: keys[Math.floor(rnd() * keys.length)], form, level, s2: pick }));
  const foe = [0, 1, 2].map(() => fighter({ key: ALL_KEYS[Math.floor(rnd() * ALL_KEYS.length)], form, level, s2: rnd() < 0.5 ? 0 : 1 }));
  return { mine, foe };
};
export function pickRate(el, pick, n = 1000) {
  const rnd = seeded(n * 11 + el.length * 97 + el.charCodeAt(0));
  let w = 0;
  for (let i = 0; i < n; i++) {
    const { mine, foe } = pickTeams(el, pick, i, rnd), A = createArena({ seed: 2000 + i * 13, me: mine, foe, foeLevel: 1 });
    playArena(A, 1, i + 1);
    w += A.S.winner === 'me' ? 1 : A.S.winner === 'draw' ? 0.5 : 0;
  }
  return w / n;
}
export function aiPickRate(el, pick, n = 1000) {
  const rnd = seeded(n * 11 + el.length * 97 + el.charCodeAt(0));
  let w = 0;
  for (let i = 0; i < n; i++) {
    const { mine, foe } = pickTeams(el, pick, i, rnd), flip = i % 2 === 1;
    const S = createArena({ seed: 2000 + i * 13, me: flip ? foe : mine, foe: flip ? mine : foe, foeLevel: 1, meAi: 1 });
    let guard = 0; while (!S.S.over && guard++ < ARENA.MAX_TICKS + 50) S.step();
    w += S.S.winner === (flip ? 'foe' : 'me') ? 1 : S.S.winner === 'draw' ? 0.5 : 0;
  }
  return w / n;
}
export const pickGap = (el, n = 800) => { const a = pickRate(el, 0, n), b = pickRate(el, 1, n); return { a, b, gap: a - b }; };
export const TIER_PAIRS = [['epic', 'normal', 0.5, 0.03], ['legend', 'normal', 0.55, 0.04], ['mythic', 'legend', 0.55, 0.04], ['limited', 'normal', 0.5, 0.03]];

// V13.232 (④단계) 여러 명 판 밸런스: 1:1:1 난투 · 2:2 팀전. 모두 보통 솜씨 컴퓨터, 등급 섞인 펫 2마리씩(같은 단계 · 레벨).
//   난투: 같은 세 팀을 자리 세 곳에 돌려 앉혀(3판 한 묶음) 자리마다 1등 비율 · 판 길이 · 막타 분포(1등 · 2등 · 3등이 얻은 쓰러뜨림 몫,
//         마지막에 때린 사람만 점수라 '가장 약한 사람 몰아치기'로 점수를 뺏기 어려운지) · 시간 끝 비율.
//   팀전: 같은 네 팀을 파랑 · 빨강 바꿔 2판 한 묶음. 파랑 승률(목표 50 ± 3) · 판 길이 · 팀원끼리 피해 0.
export function multiStats(mode, n = 300) {
  const ffa = mode === 'ffa', rnd = seeded(n * 5 + (ffa ? 3 : 4));
  const SP = ffa ? [[50, 78], [18, 24], [82, 24]] : [[32, 76], [68, 76], [32, 24], [68, 24]];
  const seats = ffa ? 3 : 4, maxTicks = ffa ? 2400 : 3000;
  const out = { games: 0, ticks: 0, timeUp: 0, seatWin: Array(seats).fill(0), blue: 0, draws: 0, koByPlace: [0, 0, 0, 0], ko: 0, lowFocus: 0, lowKills: 0 };
  for (let i = 0; i < n; i++) {
    const form = 2 + (i % 2), level = 8 + (i % 9);
    const teams = Array.from({ length: seats }, () => [0, 1].map(() => fighter({ key: ALL_KEYS[Math.floor(rnd() * ALL_KEYS.length)], form, level, s2: rnd() < 0.5 ? 0 : 1 })));
    const rotations = ffa ? [0, 1, 2] : [0, 2];
    for (const r of rotations) {
      // 자리 k에 팀 (k + r) % seats.
      const players = SP.map((xy, k) => ({ who: `p${k}`, tm: ffa ? k : (k < 2 ? 0 : 1), team: teams[(k + r) % seats], x: xy[0], y: xy[1], ai: 1 }));
      const A = createArena({ seed: 3000 + i * 29 + r, players, maxTicks, ffa });
      let guard = 0, lowest = null;
      while (!A.S.over && guard++ < maxTicks + 50) {
        const ev = A.step();
        // 막타 분포: 쓰러진 순간 그 사람이 가장 약한(남은 체력 비율 합이 가장 낮은) 사람이었나.
        for (const e of ev) if (e.e === 'faint') {
          const hp = s => s.team.reduce((m, f) => m + f.cur / f.hp, 0);
          lowest = A.S.list.filter(s => s.who !== e.who).length ? A.S.list.slice().sort((a, b) => hp(a) - hp(b))[0].who : null;
          out.lowKills += lowest === e.who ? 1 : 0;
        }
      }
      out.games++; out.ticks += A.S.t; if (A.S.t >= maxTicks) out.timeUp++;
      if (A.S.winner === 'draw') out.draws++;
      else if (ffa) out.seatWin[Number(A.S.winner.slice(1))]++;
      else if (A.S.winner === 't0') out.blue++;
      if (ffa) A.S.rank.forEach((w, place) => { out.koByPlace[place] += A.S.ko[w]; });
      out.ko += Object.values(A.S.ko).reduce((a, b) => a + b, 0);
    }
  }
  return { ...out, sec: out.ticks / out.games * ARENA.TICK_MS / 1000 };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [mode = 'tiers', nArg] = process.argv.slice(2), n = Number(nArg) || (mode === 'bots' ? 120 : 300);
  const pc = x => `${(x * 100).toFixed(1)}%`;
  if (mode === 'tiers') {
    console.log(`등급 승률(${n}판씩, 2 · 3단계 Lv.8~16, 양쪽 보통 컴퓨터)`);
    for (const [a, b, goal, tol] of TIER_PAIRS) { const r = tierRate(a, b, n); console.log(`${a} 대 ${b}: ${pc(r)} (목표 ${pc(goal)} ± ${Math.round(tol * 100)}) ${Math.abs(r - goal) <= tol ? 'OK' : '벗어남'}`); }
    console.log('(참고)', ['epic', 'legend', 'limited', 'mythic'].map(t => `${t} 대 normal ${pc(tierRate(t, 'normal', n))}`).join(' · '));
  } else if (mode === 'picks') {
    console.log(`스킬 ② 고르기(${n}판씩, 보통 솜씨 검사용 학생이 A · B를 골라 같은 판을 돌린 승률, 목표 차이 ±3)`);
    for (const el of Object.keys(EL_SKILLS)) { const r = pickGap(el, n), [a, b] = EL_SKILLS[el], c = aiPickRate(el, 0, n), d = aiPickRate(el, 1, n); console.log(`${el} ${a.name} ${pc(r.a)} · ${b.name} ${pc(r.b)} → 차이 ${(r.gap * 100).toFixed(1)} ${Math.abs(r.gap) <= 0.03 ? 'OK' : '벗어남'}  (참고: 컴퓨터끼리 ${pc(c)} · ${pc(d)})`); }
  } else if (mode === 'multi') {
    const f = multiStats('ffa', n), t = multiStats('2v2', n);
    console.log(`1:1:1 난투(${f.games}판, 같은 세 팀을 자리 셋에 돌려 앉힘): 평균 ${f.sec.toFixed(0)}초 · 시간 끝 ${pc(f.timeUp / f.games)} · 무승부 ${pc(f.draws / f.games)}`);
    console.log(`  자리별 1등: ${f.seatWin.map((w, k) => `p${k} ${pc(w / f.games)}`).join(' · ')} (목표 각 33 ± 3)`);
    console.log(`  막타 분포(쓰러뜨림 몫): 1등 ${pc(f.koByPlace[0] / f.ko)} · 2등 ${pc(f.koByPlace[1] / f.ko)} · 3등 ${pc(f.koByPlace[2] / f.ko)} · 쓰러진 펫이 그때 가장 약한 사람 것 ${pc(f.lowKills / f.ko)}`);
    console.log(`2:2 팀전(${t.games}판, 같은 네 팀을 파랑 · 빨강 바꿔 2판씩): 평균 ${t.sec.toFixed(0)}초 · 시간 끝 ${pc(t.timeUp / t.games)} · 파랑 승률 ${pc((t.blue + t.draws / 2) / t.games)} (목표 50 ± 3) ${Math.abs((t.blue + t.draws / 2) / t.games - 0.5) <= 0.03 ? 'OK' : '벗어남'}`);
  } else if (mode === 'bots') {
    console.log(`검사용 학생 대 컴퓨터(${n}판씩)`);
    for (const [skill, name] of [[0, '대충'], [1, '보통'], [2, '잘함']]) console.log(`${name}: ` + [0, 1, 2].map(fl => { const r = botRate(fl, skill, n); return `${['쉬움', '보통', '어려움'][fl]} ${pc(r.w)}(${Math.round(r.sec)}초)`; }).join(' · '));
  }
}
