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
import { RUNNER, makeMap, runInit, runTick, runPick, recorder, replay, runResult, crowdR, gateApply, mulberry, stageTarget, quantTx } from '../public/modules/runner-rules.js';

const ELS = ['flame', 'water', 'ice', 'leaf', 'earth', 'wind', 'toxic', 'star'];
const dmgTick = (n, fire) => (1 + Math.min(n, 400) * 0.028) * fire;

// 봇 한 판: { input, S }. cards: 'random' | [i, j](정한 카드) , skill 1이면 늘 바르게.
export function botRun(map, opts, { skill = 0.7, seed = 1, cards = 'random', holdDelay = 8 } = {}) {
  const R = mulberry(seed), S = runInit(map, opts), rec = recorder(), plan = new Map();
  let ci = 0, tx = 0;
  const look = 8 + 16 * skill;
  while (S.phase !== 'done' && S.tick < 6000) {
    if (S.phase === 'card') { const i = Array.isArray(cards) ? cards[ci++] ?? 0 : Math.floor(R() * 3); rec.pick(i); runPick(S, i); continue; }
    let hold = false;
    if (S.phase === 'siege') hold = S.siegeT >= holdDelay;
    else if (S.phase === 'run') {
      const R0 = crowdR(S.n);
      for (const o of S.items) {
        if (o.done || o.z < S.z - 1 || o.type === 'card' || o.type === 'end') continue;
        if (o.z > S.z + look) break;
        if (!plan.has(o)) {
          // 사람은 문은 잘 본다(0.6 + 0.4k), 바위 판단은 중간(0.5 + 0.5k), 톱날 · 망치 피하기가 솜씨 그대로(k).
          const good = R() < (o.type === 'gate' ? 0.6 + 0.4 * skill : o.type === 'rock' || o.type === 'crystal' ? 0.5 + 0.5 * skill : skill);
          if (o.type === 'gate') { const l = gateApply(S.n, o.l), r = gateApply(S.n, o.r), best = l >= r ? -2.2 : 2.2; plan.set(o, good ? best : -best); }
          else if (o.type === 'rock' || o.type === 'crystal') {
            const row = S.items.filter(x => (x.type === 'rock' || x.type === 'crystal') && !x.done && Math.abs(x.z - o.z) < 3);
            const ticks = Math.min(RUNNER.SHOOT_RANGE, o.z - S.z) / (RUNNER.SPEED * RUNNER.DT), can = x => x.hp <= dmgTick(S.n, S.fire) * ticks * 0.85;
            const target = o.type === 'crystal' ? o : row.filter(can).sort((a, b) => a.hp - b.hp)[0];
            // 바르게: 깰 수 있는 바위를 노리고, 다 못 깨면 바위가 없는 쪽으로. 틀리면 그냥 지금 자리.
            const gap = x => Math.min(...row.map(r => Math.abs(r.x - x))), free = [-3, -1.5, 0, 1.5, 3].reduce((m, x) => gap(x) > gap(m) ? x : m, 0);
            plan.set(o, good ? (target ? target.x : free) : S.cx);
          } else plan.set(o, good ? (o.type === 'saw' ? (o.x0 > 0 ? -2.8 : o.x0 < 0 ? 2.8 : (R() < 0.5 ? -2.8 : 2.8)) : (o.x > 0 ? -2.8 : o.x < 0 ? 2.8 : 2.8)) : S.cx + (R() - 0.5) * 2);
        }
        // 두 번째 기회: 바위가 6단위 안인데 다 못 깰 것 같으면 0.5 + 0.5k 확률로 틈으로 비킨다(한 번만 정함)
        if ((o.type === 'rock') && o.z - S.z < 6 && !plan.has('late' + S.items.indexOf(o))) {
          const left = (o.z - S.z) / (RUNNER.SPEED * RUNNER.DT), sure = o.hp <= dmgTick(S.n, S.fire) * left;
          const row = S.items.filter(x => x.type === 'rock' && !x.done && Math.abs(x.z - o.z) < 3), gap = x => Math.min(...row.map(r => Math.abs(r.x - x)));
          plan.set('late' + S.items.indexOf(o), true);
          if (!sure && R() < 0.5 + 0.5 * skill) plan.set(o, [-3, -1.5, 0, 1.5, 3].reduce((m, x) => gap(x) > gap(m) ? x : m, 0));
        }
        tx = plan.get(o); break;
      }
      void R0;
    }
    tx = quantTx(tx);
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
export function tuneStage(stage, M = 400) {
  const { clear, three } = stageTarget(stage);
  let hz = HZ_STEPS.at(-1);
  for (const h of HZ_STEPS) { const { out } = population(stage, Math.round(M / 2), 5, { hz: h / 100 }); if (out.filter(o => !o.n).length / out.length <= (1 - clear) * 0.6) { hz = h; break; } }
  const { out } = population(stage, M, 7, { hz: hz / 100 });
  const A = out.map(o => o.n * o.power / (1 - o.f)).sort((a, b) => a - b);
  // 하한: 가운데 봇 값의 35%(전멸한 봇이 분위수에 걸려 성이 너무 약해지지 않게)
  const H = Math.max(10, Math.round(A[A.length >> 1] * 0.35), Math.round(A[Math.min(A.length - 1, Math.floor((1 - clear) * A.length))]));
  const ratio = out.map(o => { const hp = Math.max(1, H - Math.round(H * o.f)), need = Math.ceil(hp / o.power); return o.n >= need ? (o.n - need) / o.n : -1; }).sort((a, b) => a - b);
  const r3 = Math.max(5, Math.min(90, Math.round(100 * ratio[Math.min(ratio.length - 1, Math.floor((1 - three) * ratio.length))])));
  return [H, r3, hz];
}
// 가장 잘하는 봇(솜씨 1, 카드 9가지 중 가장 좋은 것, 강화 없음)의 별
export function bestStars(stage, pet = { el: 'flame', mul: 1 }) {
  const map = makeMap(stage); let best = 0;
  for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) best = Math.max(best, botRun(map, { start: map.start, pet }, { skill: 1, seed: 3, cards: [a, b] }).S.stars);
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
  if (cmd === 'tune') {
    const rows = [];
    for (let s = 1; s <= RUNNER.MAX_STAGE; s++) rows.push(tuneStage(s, M));
    const file = fileURLToPath(new URL('../public/modules/runner-rules.js', import.meta.url)), src = readFileSync(file, 'utf8');
    writeFileSync(file, src.replace(/export const STAGE_TABLE = \[.*\];/, `export const STAGE_TABLE = ${JSON.stringify(rows)};`));
    console.log(JSON.stringify(rows));
  } else {
    for (let s = 1; s <= RUNNER.STAGES; s++) { const r = rates(s, M), tg = stageTarget(s); console.log(`스테이지 ${s}: 깸 ${(r.clear * 100).toFixed(0)}%(목표 ${(tg.clear * 100).toFixed(0)}) · 별3 ${(r.three * 100).toFixed(0)}%(목표 ${(tg.three * 100).toFixed(0)}) · 다시 돌리기 같음 ${(r.replaySame * 100).toFixed(0)}% · 가장 잘하면 별 ${bestStars(s)}`); }
  }
}
