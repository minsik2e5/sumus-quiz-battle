// V13.241 펫 대행진 난도 맞추기 · 봇(public/modules/runner-rules.js). 검사(server/runner-check.mjs) · 부하 시험(server/tournament-load.mjs)도 쓴다.
// "처음 도전하는 학생" 흉내 봇(솜씨 k 0.35~0.95): 좋은 문을 0.6 + 0.4k, 바위 판단(깰 수 있으면 노리고 아니면 피함)을 0.5 + 0.5k,
//   톱날 · 망치 피하기를 k 확률로 바르게 한다. 카드는 아무거나.
// 봇이 매 틱 정한 조종을 기록(recorder)하고, 그 기록을 다시 돌려(replay) 같은 결과인지도 본다(서버와 같은 길).
// 스테이지 표(STAGE_TABLE: 성 HP · 별 3 기준)는 봇 M명의 공성전 시작 무리로 정한다:
//   깸 ⇔ 시작 무리 × 대포 위력 ≥ 성 HP × (1 − 펫 한 방) → 성 HP = 그 값의 (1 − 깰 확률) 분위수, 별 3 기준 = 남은 비율의 (1 − 별 3 확률) 분위수.
// 사용: node server/runner-sim.mjs tune [봇 수=400]   (public/modules/runner-rules.js의 STAGE_TABLE 줄을 다시 쓴다)
//       node server/runner-sim.mjs rates [봇 수=300]  (지금 표로 스테이지마다 깬 확률 · 별 3 확률)
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { RUNNER, makeMap, runInit, runTick, runPick, recorder, replay, runResult, crowdR, gateApply, gateSides, gateSplit, mulberry, stageTarget, quantTx } from '../public/modules/runner-rules.js';

const ELS = ['flame', 'water', 'ice', 'leaf', 'earth', 'wind', 'toxic', 'star'];
const dmgTick = (n, fire) => (1 + Math.min(n, 400) * 0.028) * fire;

// 봇 한 판: { input, S }. cards: 'random' | [i, j](정한 카드) , skill 1이면 늘 바르게.
// 규칙 2판: 움직이는 · 바뀌는 문은 닿을 때의 칸을 내다보고, 벽은 틈 · 부딪힘 중 덜 잃는 쪽, 적 무리는 쏴서 이길 만하면 맞서고 아니면 비킨다.
const ROAD_X = [-3, -1.5, 0, 1.5, 3];
export function botRun(map, opts, { skill = 0.7, seed = 1, cards = 'random', holdDelay = 8 } = {}) {
  const R = mulberry(seed), S = runInit(map, opts), rec = recorder(), plan = new Map();
  let ci = 0, tx = 0;
  const look = 8 + 16 * skill;
  const roll = o => R() < (o.type === 'gate' ? 0.6 + 0.4 * skill : o.type === 'rock' || o.type === 'crystal' || o.type === 'wall' || o.type === 'foe' ? 0.5 + 0.5 * skill : skill);
  const stepZ = () => RUNNER.SPEED * RUNNER.DT * (S.fever > 0 ? RUNNER.FEVER_SPEED : 1);
  const fireNow = () => S.fever > 0 ? S.fire * RUNNER.FEVER_FIRE : S.fire;
  const away = x => x > 0.3 ? -2.8 : x < -0.3 ? 2.8 : (R() < 0.5 ? -2.8 : 2.8);
  while (S.phase !== 'done' && S.tick < 7000) {
    if (S.phase === 'card') { const i = Array.isArray(cards) ? cards[ci++] ?? 0 : Math.floor(R() * 3); rec.pick(i); runPick(S, i); continue; }
    let hold = false;
    if (S.phase === 'siege') hold = S.siegeT >= holdDelay;
    else if (S.phase === 'run' && !S.clash) {
      let target = null;
      // 달려오는 적 무리가 먼저
      for (const o of S.foes) {
        if (o.done || o.pz - S.z > look + 6) continue;
        if (!plan.has(o)) plan.set(o, roll(o));
        const left = Math.max(1, (o.pz - S.z) / (stepZ() + RUNNER.FOE_SPEED * RUNNER.DT)), rest = o.hp - dmgTick(S.n, fireNow()) * RUNNER.FOE_ARMOR * Math.min(left, 34);
        // 바르게: 쏴서 많이 남지 않으면 정면으로(쏘며 맞섬), 많이 남으면 반대쪽 끝으로 비킨다. 틀리면 그냥 지금 자리.
        target = plan.get(o) ? (rest > S.n * 0.6 ? away(o.x) : o.x) : S.cx; break;
      }
      if (target === null) for (const o of S.items) {
        if (o.done || o.z < S.z - 1 || o.type === 'card' || o.type === 'end' || o.type === 'slide' || o.type === 'foe') continue;
        if (o.z > S.z + look) break;
        if (!plan.has(o)) plan.set(o, roll(o));
        const good = plan.get(o), ticks = Math.max(0, (o.z - S.z) / stepZ());
        if (o.type === 'gate') {
          // 닿을 때(ticks 뒤)의 칸막이 · 두 칸 값으로 고른다
          const at = S.tick + ticks, [l, r] = gateSides(o, at), sx = gateSplit(o, at), best = gateApply(S.n, l) >= gateApply(S.n, r) ? -1 : 1, side = good ? best : -best;
          target = side < 0 ? Math.max(-3.4, Math.min(sx - 1.3, -0.6 + sx)) : Math.min(3.4, Math.max(sx + 1.3, 0.6 + sx));
        } else if (o.type === 'rock' || o.type === 'crystal') {
          if (!plan.has('x' + S.items.indexOf(o))) {
            const row = S.items.filter(x => (x.type === 'rock' || x.type === 'crystal') && !x.done && Math.abs(x.z - o.z) < 3);
            const tt = Math.min(RUNNER.SHOOT_RANGE, o.z - S.z) / stepZ(), can = x => x.hp <= dmgTick(S.n, fireNow()) * tt * 0.85;
            const tg = o.type === 'crystal' ? o : row.filter(can).sort((a, b) => a.hp - b.hp)[0];
            const gap = x => Math.min(...row.map(r => Math.abs(r.x - x))), free = ROAD_X.reduce((m, x) => gap(x) > gap(m) ? x : m, 0);
            plan.set('x' + S.items.indexOf(o), good ? (tg ? tg.x : free) : S.cx);
          }
          target = plan.get('x' + S.items.indexOf(o));
          // 두 번째 기회: 바위가 6단위 안인데 다 못 깰 것 같으면 0.5 + 0.5k 확률로 틈으로 비킨다(한 번만 정함)
          if (o.type === 'rock' && o.z - S.z < 6 && !plan.has('late' + S.items.indexOf(o))) {
            const sure = o.hp <= dmgTick(S.n, fireNow()) * ticks;
            const row = S.items.filter(x => x.type === 'rock' && !x.done && Math.abs(x.z - o.z) < 3), gap = x => Math.min(...row.map(r => Math.abs(r.x - x)));
            plan.set('late' + S.items.indexOf(o), true);
            if (!sure && R() < 0.5 + 0.5 * skill) plan.set('x' + S.items.indexOf(o), ROAD_X.reduce((m, x) => gap(x) > gap(m) ? x : m, 0));
            target = plan.get('x' + S.items.indexOf(o));
          }
        } else if (o.type === 'wall') {
          // 벽: 닿기 전에 다 깰 수 있으면 그대로, 아니면 틈(있으면)과 부딪힘 중 덜 잃는 쪽
          const rest = o.hp - dmgTick(S.n, fireNow()) * ticks, Rn = crowdR(S.n);
          const gapLoss = o.gap ? Math.floor(S.n * Math.max(0, 1 - o.gap.w / 2 / Rn) * RUNNER.GAP_SQUEEZE) : Infinity;
          target = good && o.gap && rest > 0 && gapLoss < rest ? o.gap.x : (good ? S.cx : (o.gap ? -o.gap.x : S.cx));
        } else if (o.type === 'saw') target = good ? away(o.x0) : S.cx + (R() - 0.5) * 2;
        else target = good ? away(o.x) : S.cx + (R() - 0.5) * 2;   // 망치 · 모래 소용돌이 · 불기둥
        break;
      }
      if (target !== null) tx = target;
    }
    tx = quantTx(Math.max(-RUNNER.ROAD, Math.min(RUNNER.ROAD, tx)));
    rec.tick(S.tick, tx, hold);
    runTick(S, tx, hold);
  }
  return { input: rec.out(), S };
}
export const randomPet = R => ({ el: ELS[Math.floor(R() * ELS.length)], mul: 1 });

// 봇 M명: 공성전 시작 무리 · 대포 위력 · 펫 한 방 비율
export function population(stage, M = 300, seed = 7, over = null) {
  const map = makeMap(stage, over), R = mulberry(seed * 1000 + stage), out = [];
  for (let i = 0; i < M; i++) {
    const skill = 0.35 + R() * 0.6, pet = randomPet(R);
    const { S } = botRun(map, { start: map.start, pet }, { skill, seed: Math.floor(R() * 1e9) });
    const f = S.petOn ? Math.min(0.6, (RUNNER.PET_SIEGE + (pet.el === 'star' ? 0.2 : 0)) * pet.mul * S.petup) : 0;
    out.push({ n: S.start, power: S.power, f, stars: S.stars });
  }
  return { map, out };
}
// 위험 세기: 100%부터 낮춰 가며 달리기 중 전멸이 (1 − 깰 확률)의 60% 아래가 되는 첫 값(예: 85% 목표면 전멸 9% 아래).
export const HZ_STEPS = [100, 85, 70, 55, 42, 32, 24];
// mapSeed · target: 오늘의 도전 맵 표(DAILY_TABLE)를 맞출 때만(씨앗을 바꾼 맵 · 목표 깸 65%)
export function tuneStage(stage, M = 400, mapSeed = null, target = null) {
  const { clear, three } = target || stageTarget(stage), ms = mapSeed == null ? {} : { seed: mapSeed };
  let hz = HZ_STEPS.at(-1);
  for (const h of HZ_STEPS) { const { out } = population(stage, Math.round(M / 2), 5, { hz: h / 100, ...ms }); if (out.filter(o => !o.n).length / out.length <= (1 - clear) * 0.6) { hz = h; break; } }
  const { out } = population(stage, M, 7, { hz: hz / 100, ...ms });
  const A = out.map(o => o.n * o.power / (1 - o.f)).sort((a, b) => a - b);
  // 하한: 가운데 봇 값의 35%(전멸한 봇이 분위수에 걸려 성이 너무 약해지지 않게)
  const H = Math.max(10, Math.round(A[A.length >> 1] * 0.35), Math.round(A[Math.min(A.length - 1, Math.floor((1 - clear) * A.length))]));
  const ratio = out.map(o => { const hp = Math.max(1, H - Math.round(H * o.f)), need = Math.ceil(hp / o.power); return o.n >= need ? (o.n - need) / o.n : -1; }).sort((a, b) => a - b);
  let r3 = Math.max(5, Math.min(90, Math.round(100 * ratio[Math.min(ratio.length - 1, Math.floor((1 - three) * ratio.length))])));
  // 강화 없이 별 3이 늘 가능하게: 가장 잘하는 봇(솜씨 1 · 카드 9가지 중 최고)이 남기는 비율의 97%를 넘지 않게
  //   가장 잘하는 봇도 못 깨는 성이면 성 HP를 그 봇이 별 3을 받을 만큼으로 낮춘다(드문 경우).
  const map = makeMap(stage, { hz: hz / 100, ...ms }), tops = [];
  for (const [el, seed] of BEST_TRY) for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) { const { S } = botRun(map, { start: map.start, pet: { el, mul: 1 } }, { skill: 1, seed, cards: [a, b] }); tops.push({ n: S.start, power: S.power, f: S.petOn ? (RUNNER.PET_SIEGE + (el === 'star' ? 0.2 : 0)) * S.petup : 0 }); }
  const topAt = h => Math.max(-1, ...tops.map(o => { const need = Math.ceil(Math.max(1, h - Math.round(h * o.f)) / o.power); return o.n >= need ? (o.n - need) / o.n : -1; }));
  let HH = H, top = topAt(HH);
  while (top * 97 < 5 && HH > 10) { HH = Math.floor(HH * 0.9); top = topAt(HH); }
  if (top > 0) r3 = Math.max(5, Math.min(r3, Math.floor(top * 97)));
  return [HH, r3, hz];
}
// 가장 잘하는 봇(솜씨 1, 강화 없음)의 별: 펫 2가지 × 조종 씨앗 2가지 × 카드 9가지 중 가장 좋은 것(별 3이 나오면 바로 멈춤)
const BEST_TRY = [['flame', 3], ['water', 4], ['flame', 5], ['star', 6]];
export function bestStars(stage) {
  const map = makeMap(stage); let best = 0;
  for (const [el, seed] of BEST_TRY) for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) { best = Math.max(best, botRun(map, { start: map.start, pet: { el, mul: 1 } }, { skill: 1, seed, cards: [a, b] }).S.stars); if (best === 3) return 3; }
  return best;
}
export function rates(stage, M = 300, seed = 11) {
  const map = makeMap(stage), R = mulberry(seed * 977 + stage); let c = 0, t = 0, same = 0;
  for (let i = 0; i < M; i++) {
    const opts = { start: map.start, pet: randomPet(R) }, { input, S } = botRun(map, opts, { skill: 0.35 + R() * 0.6, seed: Math.floor(R() * 1e9) });
    if (S.stars > 0) c++; if (S.stars === 3) t++;
    const again = runResult(replay(map, opts, input));
    if (again.stars === S.stars && again.left === S.left && again.ticks === S.tick) same++;
  }
  return { clear: c / M, three: t / M, replaySame: same / M };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const cmd = process.argv[2] || 'rates', M = Number(process.argv[3]) || (cmd === 'tune' ? 400 : 300);
  if (cmd === 'daily') {
    // 오늘의 도전 맵 표: 도전 스테이지마다 씨앗 8개를 봇 M명으로 맞춰 runner-modes.js의 DAILY_TABLE 줄을 다시 쓴다(목표 깸 65% · 별 3 30%)
    const { DAILY, DAILY_SEED } = await import('../public/modules/runner-modes.js'), table = {};
    for (const st of DAILY.STAGES) table[st] = Array.from({ length: 8 }, (_, i) => { const sd = DAILY_SEED(st, i); return [sd, ...tuneStage(st, M, sd, { clear: 0.65, three: 0.3 })]; });
    const file = fileURLToPath(new URL('../public/modules/runner-modes.js', import.meta.url)), src = readFileSync(file, 'utf8');
    writeFileSync(file, src.replace(/export const DAILY_TABLE = \{.*\};/, `export const DAILY_TABLE = ${JSON.stringify(table)};`));
    console.log('daily table', Object.keys(table).length);
  } else if (cmd === 'tune') {
    const rows = [];
    for (let s = 1; s <= RUNNER.MAX_STAGE; s++) rows.push(tuneStage(s, M));
    const file = fileURLToPath(new URL('../public/modules/runner-rules.js', import.meta.url)), src = readFileSync(file, 'utf8');
    writeFileSync(file, src.replace(/export const STAGE_TABLE = \[.*\];/, `export const STAGE_TABLE = ${JSON.stringify(rows)};`));
    console.log(JSON.stringify(rows));
  } else {
    for (let s = 1; s <= RUNNER.STAGES; s++) { const r = rates(s, M), tg = stageTarget(s); console.log(`스테이지 ${s}: 깸 ${(r.clear * 100).toFixed(0)}%(목표 ${(tg.clear * 100).toFixed(0)}) · 별3 ${(r.three * 100).toFixed(0)}%(목표 ${(tg.three * 100).toFixed(0)}) · 다시 돌리기 같음 ${(r.replaySame * 100).toFixed(0)}% · 가장 잘하면 별 ${bestStars(s)}`); }
  }
}
// v13.242 펫 등급 세기 확인(구성안 2-5): 같은 봇 · 같은 펫 속성으로 등급 배율만 바꿔(기본 1 · 전설 1.06 · 신화 1.12) 깸 · 별 3 확률을 잰다.
export function tierRates(stage, mul, M = 200, seed = 21) {
  const map = makeMap(stage), R = mulberry(seed * 131 + stage); let c = 0, t = 0;
  for (let i = 0; i < M; i++) {
    const el = ['flame', 'water', 'ice', 'leaf', 'earth', 'wind', 'toxic', 'star'][Math.floor(R() * 8)], skill = 0.35 + R() * 0.6, sd = Math.floor(R() * 1e9);
    const { S } = botRun(map, { start: map.start, pet: { el, mul } }, { skill, seed: sd });
    if (S.stars > 0) c++; if (S.stars === 3) t++;
  }
  return { clear: c / M, three: t / M };
}
