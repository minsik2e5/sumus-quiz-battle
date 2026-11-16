// V13.241 펫 대행진(크라우드 러너) 검사. 구성안 docs/pet-runner-plan.md.
//   규칙: 같은 조종 기록 → 같은 결과(서버 다시 돌리기) · 규칙 쪽은 판 씨앗만 · 엔진마다 다를 수 있는 수학(sin · pow …) 없음.
//   난도: "처음 도전하는 학생" 흉내 봇으로 깰 확률 · 별 3 확률이 선생님 목표 가까이, 가장 잘하는 봇은 강화 없이 별 3.
//   서버: 시작 · 끝 두 요청, 열린 판 하나, 너무 빠른 판 · 오래된 판 무효, 코인 하루 40 + 첫 판 상자 10, 응원 정령, 구출 펫은 씨앗으로.
//   렉 방지: 지도 · 반 순위는 GET(1분 캐시), 학생 데이터는 프로필 안(목록 없음, 작음), 새 묶음 예산, 부하 시험에 finish.
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { RUNNER, PET_MUL, UPGRADES, NEXT_TYPES, upCost, makeMap, replay, runResult, runInit, runTick, runPick, recorder, cleanInput, stageTarget, cheerOf, baseStart, gateSides, gateSplit, theme, STAGE_TABLE } from '../public/modules/runner-rules.js';
import { botRun, rates, bestStars, randomPet, tierRates } from './runner-sim.mjs';
import { runnerStart, runnerFinish, runnerView, runnerBoard, runnerUpgrade, rescuePet, startCount } from './runner.mjs';
import { STATE_BUDGET_KB } from './perf-budget.mjs';
import { dayKey } from '../public/modules/core.js';

const source = p => readFileSync(fileURLToPath(new URL(p, import.meta.url)), 'utf8');
const fn = (js, name) => { const i = js.indexOf(`function ${name}(`); if (i < 0) return ''; let d = 0; for (let k = js.indexOf('{', i); k < js.length; k++) { if (js[k] === '{') d++; else if (js[k] === '}' && --d === 0) return js.slice(i, k + 1); } return ''; };

export async function runRunnerChecks(assert) {
  const rules = source('../public/modules/runner-rules.js');
  // 1) 규칙: 결정적 · 판 씨앗만 · 엔진마다 같은 수학
  const ruleCode = ['makeMap', 'cardOffer', 'runInit', 'runTick', 'hitObj', 'clashTick', 'hurt', 'breakRock', 'runPick', 'rescue', 'petSkill', 'petSiege', 'siegeTick', 'finish', 'replay'].map(n => fn(rules, n)).join('\n');
  assert(ruleCode.length > 3000 && !/Math\.(random|sin|cos|tan|pow|exp|log|atan|hypot)\b|Date\.now|performance/.test(ruleCode), '펫 대행진 규칙은 판 씨앗 난수만 쓰고, 엔진마다 끝자리가 다를 수 있는 수학(sin · pow · hypot …)을 쓰지 않는다');
  assert(JSON.stringify(makeMap(7)) === JSON.stringify(makeMap(7)) && JSON.stringify(makeMap(7).items) !== JSON.stringify(makeMap(8).items), '스테이지 번호가 같으면 늘 같은 맵, 다르면 다른 맵');
  assert(STAGE_TABLE.length === RUNNER.MAX_STAGE && STAGE_TABLE.every(r => r.length === 3 && r[0] >= 10 && r[1] >= 5 && r[1] <= 90 && r[2] >= 20 && r[2] <= 100), '스테이지 표(성 HP · 별 3 기준 · 위험 세기)가 1~100 모두 있다(node server/runner-sim.mjs tune)');
  {
    let same = 0, n = 0;
    for (const s of [1, 10, 25]) { const map = makeMap(s); for (let i = 0; i < 12; i++) { const opts = { start: map.start, pet: randomPet(() => (i * 0.137) % 1) }, { input, S } = botRun(map, opts, { skill: 0.4 + i * 0.05, seed: 100 + i }); const r = runResult(replay(map, opts, input)); n++; if (r.stars === S.stars && r.left === S.left && r.ticks === S.tick && r.broke === S.broke) same++; } }
    assert(same === n, `조종 기록을 다시 돌리면 화면에서 본 결과와 같다(${same}/${n})`);
    const map = makeMap(3), opts = { start: map.start, pet: { el: 'flame', mul: 1 } }, { input } = botRun(map, opts, { skill: 0.9, seed: 5 }), a = runResult(replay(map, opts, input));
    const json = JSON.parse(JSON.stringify(input));
    assert(cleanInput(json) && JSON.stringify(runResult(replay(map, opts, cleanInput(json)))) === JSON.stringify(a) && JSON.stringify(input).length < RUNNER.INPUT_MAX, `조종 기록은 JSON으로 보내도 같은 결과 · ${JSON.stringify(input).length}바이트(상한 ${RUNNER.INPUT_MAX})`);
    assert(cleanInput({ s: [5, 10, 3, 10], h: [], c: [] }) === null && cleanInput({ s: [1, 300], h: [], c: [] }) === null && cleanInput({ s: [], h: [], c: [0, 1, 2] }) === null && cleanInput({ s: [1, 1.5], h: [], c: [] }) === null && cleanInput('x') === null, '이상한 조종 기록(틱이 줄어듦 · 범위 밖 · 카드 3장 · 소수)은 거절');
  }
  // 무리는 숫자 하나: 그리는 수 · 품질이 규칙에 없다. 카드를 고르는 동안은 틱이 안 간다. 응원 정령은 시작 무리만 늘린다.
  {
    const S = runInit(makeMap(1), { start: 10 }); S.phase = 'card'; S.card = { cards: [['add', 20], ['fire', 0], ['shield', 0]] }; runTick(S, 0, false);
    assert(S.tick === 0 && !/shown|T\.draw|tier/.test(fn(rules, 'runTick')), '규칙의 무리는 숫자 하나(그리는 정령 수 · 품질과 무관), 카드 고르는 동안 틱이 멈춘다');
    assert(cheerOf(2) === 0 && cheerOf(3) === 0.1 && cheerOf(6) === 0.2 && cheerOf(30) === 0.3 && startCount(5, 0.3) === Math.round(baseStart(5) * 1.3), '응원 정령: 같은 스테이지 3연패마다 시작 무리 +10%(최대 +30%)');
    assert(PET_MUL.basic === 1 && PET_MUL.epic === 1 && PET_MUL.limited === 1 && PET_MUL.legendary === 1.06 && PET_MUL.mythic === 1.12, '펫 필살기 세기: 기본 ≈ 영웅 = 한정 < 전설(+6%) < 신화(+6%)(CLAUDE.md)');
  }
  // v13.242 규칙 2판: 숫자 벽 · 적 무리 정면 충돌 · 움직이는/바뀌는 문 · 위험한 짝 · 피버 · 테마 장애물 · 강화 · 규칙 판 번호
  {
    const at = (types, s) => makeMap(s).items.filter(o => types.includes(o.type)).length;
    const all = Array.from({ length: 100 }, (_, i) => makeMap(i + 1)), count = (m, t) => m.items.filter(o => o.type === t).length;
    assert(all.slice(2).every(m => count(m, 'wall') + count(m, 'foe') >= 2) && all.slice(7).every(m => m.items.some(o => o.mv) || m.items.some(o => o.sw)) && all.every(m => m.items.every(o => o.type !== 'foe' || o.z > m.len * 0.12)),
      '맵 2판: 3스테이지부터 판마다 숫자 벽 · 적 무리가 2번 넘게, 8스테이지부터 움직이는 문 · 바뀌는 문, 적 무리는 판 처음 12% 뒤');
    const gates = all.slice(1).flatMap(m => m.items.filter(o => o.type === 'gate')), bothGood = gates.filter(o => o.l[0] !== '−' && o.r[0] !== '−').length / gates.length;
    assert(bothGood < 0.3 && gates.some(o => o.l[0] === '×' && o.l[1] === 3) && all.slice(4).some(m => m.items.some((o, i) => o.type === 'gate' && (o.l[0] === '−' || o.r[0] === '−') && m.items.slice(i + 1, i + 4).some(q => q.type === 'gate' && (q.l[0] === '×' || q.r[0] === '×')))),
      `위험한 선택: 둘 다 좋은 문은 ${Math.round(bothGood * 100)}%(30% 아래) · ×3 옆 톱날 · −N 뒤 ×2가 있다`);
    const band = (t, a) => all.slice(a - 1, a + 24).filter(m => count(m, t) > 0).length;
    assert(band('whirl', 26) >= 15 && band('slide', 51) >= 15 && band('pillar', 76) >= 15 && all.every(m => m.items.every(o => !['whirl', 'slide', 'pillar'].includes(o.type) || ({ whirl: 'desert', slide: 'ice', pillar: 'volcano' })[o.type] === theme(m.stage))) && at(['whirl', 'slide', 'pillar'], 10) === 0 && all.filter(m => m.boss).every(m => m.items.some(o => o.type === 'foe' && o.boss)),
      '테마 장애물: 사막 모래 소용돌이 · 얼음 미끄럼 · 화산 불기둥(하늘 다리에는 없음), 보스 성 앞에는 적 대장');
    // 숫자 벽: 틈 = 틈에 안 들어가는 정령만, 부딪힘 = 남은 HP만큼
    const wallRun = (gap, cx) => { const S = runInit({ ...makeMap(1), items: [{ type: 'wall', z: 3, hp: 400, ...(gap ? { gap: { x: 2.6, w: RUNNER.GAP_W } } : {}) }, { type: 'end', z: 200 }] }, { start: 100 }); S.cx = cx; let ev = ''; for (let i = 0; i < 20 && !ev; i++) runTick(S, cx, false, t => { if (t === 'gap' || t === 'wallCrash') ev = t; }); return { S, ev }; };
    const crash = wallRun(false, 0), slip = wallRun(true, 2.6);
    assert(crash.ev === 'wallCrash' && crash.S.n === 0 && slip.ev === 'gap' && slip.S.n > 50 && slip.S.n < 100, `숫자 벽: 부딪히면 남은 숫자만큼 잃고(100 → ${crash.S.n}), 좁은 틈은 틈에 안 들어가는 정령만 잃는다(100 → ${slip.S.n})`);
    // 적 무리 정면 충돌: 양쪽이 같이 깎이고, 큰 쪽이 이긴다(숫자 하나)
    const fight = (me, foe, opts = {}) => { const S = runInit({ ...makeMap(1), items: [{ type: 'foe', z: 8, x: 0, hp: foe }, { type: 'end', z: 400 }] }, { start: me, ...opts }); let kinds = new Set(); for (let i = 0; i < 400 && S.phase === 'run'; i++) runTick(S, 0, false, t => kinds.add(t)); return { S, kinds }; };
    const win = fight(200, 90), lose = fight(30, 200), def = fight(200, 90, { up: { d: 10 } });
    assert(win.kinds.has('foeWake') && win.kinds.has('clash') && win.kinds.has('clashWin') && win.S.n > 100 && win.S.won === 1 && lose.S.phase === 'done' && lose.S.n === 0 && def.S.n > win.S.n,
      `적 무리: 달려와 정면 충돌, 양쪽이 같이 깎인다(200 대 90 → ${win.S.n} 남음 · 30 대 200 → 짐) · 방어 강화는 덜 잃음(${def.S.n})`);
    // 움직이는 · 바뀌는 문: 규칙이 정한 칸(gateSplit · gateSides)으로 판정
    const mv = { type: 'gate', z: 5, l: ['+', 10], r: ['−', 5], mv: { amp: 2, per: 40, ph: 0 } }, sw = { type: 'gate', z: 5, l: ['+', 10], r: ['−', 5], sw: 20 };
    assert(gateSplit(mv, 10) === 2 && gateSplit(mv, 30) === -2 && gateSides(sw, 5)[0] === sw.l && gateSides(sw, 25)[0] === sw.r && gateSides(sw, 45)[0] === sw.l, '움직이는 문은 칸막이가 오가고(삼각파), 바뀌는 문은 정해진 틱마다 두 칸이 바뀐다');
    // 피버: 가장 좋은 문 3번 → 7초 빨라짐 · 사격 2배
    { const items = [1, 2, 3].map(k => ({ type: 'gate', z: k * 6, l: ['+', 5], r: ['−', 3] })).concat([{ type: 'end', z: 300 }]), S = runInit({ ...makeMap(1), items }, { start: 20 }); let on = 0; for (let i = 0; i < 60; i++) runTick(S, -2, false, t => { if (t === 'fever') on = S.tick; }); const z0 = S.z; runTick(S, -2, false);
      assert(on > 0 && S.fever > 0 && Math.abs(S.z - z0 - RUNNER.SPEED * RUNNER.DT * RUNNER.FEVER_SPEED) < 1e-9 && RUNNER.FEVER_FIRE === 2 && RUNNER.FEVER_TICKS === 120, '피버: 가장 좋은 문 3번 연속이면 6초 동안 달리기 ×1.3 · 사격 ×2'); }
    // 다음 단계(거대 몬스터 · 좁은 다리 · 공성전 수비)는 이름만 열어 둠: 규칙은 모르는 물체를 건너뛴다
    { const S = runInit({ ...makeMap(1), items: NEXT_TYPES.map((t, i) => ({ type: t, z: 5 + i, x: 0, hp: 50 })).concat([{ type: 'end', z: 30 }]) }, { start: 20 }); for (let i = 0; i < 80 && S.phase === 'run'; i++) runTick(S, 0, false); assert(S.phase === 'siege' && S.n === 20, '다음 단계 물체(거대 몬스터 · 좁은 다리 · 공성전 수비)는 구조만: 규칙이 건너뛴다'); }
    // 다시 돌리기 비용(서버 finish): 가장 긴 판도 몇 ms
    let worst = 0; for (const s of [25, 50, 75, 90, 100]) { const map = makeMap(s), opts = { start: map.start, pet: { el: 'water', mul: 1 } }, { input } = botRun(map, opts, { skill: 0.9, seed: 4 }); const t0 = performance.now(); for (let i = 0; i < 10; i++) replay(map, opts, input); worst = Math.max(worst, (performance.now() - t0) / 10); }
    assert(worst < 6, `다시 돌리기 비용: 가장 긴 스테이지도 판당 ${worst.toFixed(2)}ms(6ms 아래)`);
    assert(Object.keys(UPGRADES).join() === 's,f,c,d' && upCost('s', 0) === 20 && upCost('c', 19) === 30 + 15 * 19 && upCost('d', 10) === null && Object.entries(UPGRADES).reduce((a, [k, u]) => a + Array.from({ length: u.max }, (_, i) => upCost(k, i)).reduce((x, y) => x + y, 0), 0) < 10000,
      '정령 강화(구성안 3-3): 시작 정령 · 사격 · 대포 위력 · 방어, 값 = 기본 + 단계 × 올림, 다 올려도 1만 코인 아래');
  }
  // 펫 등급 세기(구성안 2-5 · CLAUDE.md): 같은 봇이면 기본 ≤ 전설 ≤ 신화, 차이는 작게(별 3 확률 각 +0~10%p)
  {
    const rows = [12, 37, 64].map(s => [1, 1.06, 1.12].map(m => tierRates(s, m, 200)));
    const sum = k => rows.reduce((a, r) => a + r[k].three + r[k].clear, 0) / rows.length;
    assert(sum(0) <= sum(1) + 0.01 && sum(1) <= sum(2) + 0.01 && sum(2) - sum(0) < 0.2, `펫 등급 세기: 깸 + 별 3 확률 합 기본 ${(sum(0) * 100).toFixed(0)} ≤ 전설 ${(sum(1) * 100).toFixed(0)} ≤ 신화 ${(sum(2) * 100).toFixed(0)}(%p, 차이 작게)`);
  }
  // 2) 난도(봇): 고른 스테이지에서 목표 ±12%p, 가장 잘하는 봇은 강화 없이 별 3(1~100 모두)
  for (const s of [1, 4, 6, 10, 11, 17, 20, 25, 33, 40, 47, 58, 70, 81, 95]) {
    const r = rates(s, 120, 3), t = stageTarget(s);
    assert(Math.abs(r.clear - t.clear) <= 0.12 && Math.abs(r.three - t.three) <= 0.12 && r.replaySame === 1, `${s}스테이지 처음 도전 깸 ${(r.clear * 100).toFixed(0)}%(목표 ${(t.clear * 100).toFixed(0)}) · 별 3 ${(r.three * 100).toFixed(0)}%(목표 ${(t.three * 100).toFixed(0)})`);
  }
  {
    const miss = []; for (let s = 1; s <= RUNNER.MAX_STAGE; s++) if (bestStars(s) < 3) miss.push(s);
    assert(!miss.length, `강화 없이도 별 3이 가능하다(가장 잘하는 봇, 1~${RUNNER.STAGES}스테이지${miss.length ? ` · 안 되는 곳 ${miss.join(', ')}` : ''})`);
    assert(stageTarget(10).clear === 0.5 && stageTarget(20).clear === 0.5 && stageTarget(11).clear > stageTarget(12).clear && stageTarget(1).clear === 0.95 && stageTarget(3).clear === 0.8 && stageTarget(3).three === 0.4 && stageTarget(17).clear >= 0.65 && stageTarget(17).clear <= 0.75 && stageTarget(76).three === 0.08 && stageTarget(33).clear === 0.7 && stageTarget(62).clear === 0.55 && stageTarget(88).clear === 0.4, '목표(선생님): 1 튜토리얼 95% · 2~5 80% · 6~25 65~75% · 보스 성 50%, 별 3은 절반쯤 · 26~50 70% · 51~75 55% · 76~100 40%(별 3 8%)');
  }
  // 3) 서버: 시작 · 끝
  {
    const now = Date.UTC(2026, 10, 16, 3), DAY = 86400000;
    const p = { id: 's1', role: 'student', pets: [{ key: 'dog', form: 2 }, { key: 'gumiho', form: 3 }, { key: 'dog', form: 3 }] };
    let threw = ''; try { runnerStart(p, { id: 'rn-aaaa-0001', stage: 2, now }); } catch (e) { threw = e.message; }
    assert(/열리지 않은/.test(threw), '아직 안 연 스테이지(깬 것 + 1보다 큰)는 시작할 수 없다');
    const a = runnerStart(p, { id: 'rn-aaaa-0001', stage: 1, now, seed: 7 }), again = runnerStart(p, { id: 'rn-aaaa-0001', stage: 1, now, seed: 99 });
    assert(a.seed === 7 && again.seed === 7 && p.games.runner.n === 1 && rescuePet(p, 7).key === ['dog', 'gumiho'][7 % 2] && rescuePet(p, 8).mul === (rescuePet(p, 8).key === 'gumiho' ? 1.12 : 1) && rescuePet(p, 7).form === 3,
      '시작: 같은 판 번호는 한 번만 연다 · 구출 펫은 내 펫 중 씨앗으로(같은 펫은 한 번, 가장 큰 모습) · 신화는 ×1.12');
    const map = makeMap(1), pet = rescuePet(p, 7), opts = { start: a.start, pet: { el: pet.el, mul: pet.mul } }, best = botRun(map, opts, { skill: 1, seed: 3, cards: [0, 0] });
    const fast = runnerFinish(p, { id: 'rn-aaaa-0001', input: best.input, now: now + 5000 });
    assert(!fast.valid && fast.reason === 'fast' && !p.games.runner.open && !p.games.runner.stars && runnerFinish(p, { id: 'rn-aaaa-0001', input: best.input, now: now + 9000 }).again, '너무 빨리 끝난 판(다시 돌린 길이의 90%보다 짧음)은 무효 · 같은 끝을 다시 보내면 그 영수증');
    const b = runnerStart(p, { id: 'rn-aaaa-0002', stage: 1, now, seed: 7 }), ms = best.S.tick * RUNNER.TICK;
    const won = runnerFinish(p, { id: b.id, input: best.input, now: now + ms + 3000 });
    assert(won.valid && won.stars === best.S.stars && won.stars > 0 && won.coins === won.stars * RUNNER.STAR_NEW && won.box === RUNNER.BOX_COINS && p.games.runner.st === 1 && p.games.runner.stars === String(won.stars) && p.bonus?.log?.[0]?.c === won.coins + won.box,
      `별을 처음 받으면 별마다 ${RUNNER.STAR_NEW}코인 + 오늘 첫 판 상자 ${RUNNER.BOX_COINS}코인(코인은 기존 코인으로)`);
    let coins = won.coins;
    for (let i = 3; i < 20; i++) { runnerStart(p, { id: `rn-aaaa-${String(i).padStart(4, '0')}`, stage: 1, now, seed: 7 }); coins += runnerFinish(p, { id: `rn-aaaa-${String(i).padStart(4, '0')}`, input: best.input, now: now + ms + 3000 }).coins; }
    const v = runnerView(p, now);
    assert(coins === RUNNER.COIN_DAILY && v.coin_today === RUNNER.COIN_DAILY && !v.box && v.total === won.stars && v.st === 1, `판 수는 끝없이, 판 코인은 하루 ${RUNNER.COIN_DAILY}까지(다시 받는 별은 ${RUNNER.STAR_AGAIN}코인) · 상자는 하루 한 번`);
    const next = runnerView(p, now + DAY);
    assert(next.coin_today === 0 && next.box === true && next.plays_left === RUNNER.PLAYS_DAILY, '다음 날은 코인 · 상자 · 판 수가 새로');
    // 응원 정령: 2스테이지 3연패 → 다음 시작 무리 +10%
    for (let i = 0; i < 3; i++) { const id = `rn-bbbb-000${i}`; runnerStart(p, { id, stage: 2, now: now + DAY, seed: 1 }); runnerFinish(p, { id, input: { s: [], h: [], c: [] }, now: now + DAY + 200000 }); }
    const c = runnerStart(p, { id: 'rn-bbbb-0009', stage: 2, now: now + DAY, seed: 1 });
    assert(c.cheer === 0.1 && c.start === Math.round(baseStart(2) * 1.1) && runnerView(p, now + DAY).cheer?.fails === 3, '같은 스테이지 3번 지면 응원 정령 +10%로 시작');
    const old = runnerFinish(p, { id: 'rn-bbbb-0009', input: { s: [], h: [], c: [] }, now: now + DAY + RUNNER.OPEN_MS + 1000 });
    assert(!old.valid && old.reason === 'expired', '10분 넘게 열린 판은 무효');
    // v13.242 규칙 판 번호 · 기존 기록 호환 · 정령 강화
    let vthrew = ''; try { runnerStart(p, { id: 'rn-cccc-0001', stage: 1, rules: 1, now: now + DAY }); } catch (e) { vthrew = e.message; }
    p.games.runner.open = { id: 'rn-old-00001', seed: 7, stage: 2, pet: 'dog', cheer: 0, at: now + DAY };   // v13.241에 열린 판(규칙 판 번호 없음)
    const fn0 = p.games.runner.fn, oldRes = runnerFinish(p, { id: 'rn-old-00001', input: { s: [], h: [], c: [] }, now: now + DAY + 100000 });
    assert(/새로/.test(vthrew) && !oldRes.valid && oldRes.reason === 'version' && p.games.runner.fn === fn0 && p.games.runner.stars === String(won.stars) && runnerView(p, now).stages === 100,
      '규칙 판 번호: 예전 화면은 시작을 막고(새로 고침 안내), 예전 규칙으로 열린 판은 기록 없이 끝(진 횟수 · 별 그대로), 지도는 100스테이지');
    let poor = ''; try { runnerUpgrade(p, 's', 10); } catch (e) { poor = e.message; }
    const spent0 = Number(p.points_spent || 0), u1 = runnerUpgrade(p, 's', 1000), u2 = runnerUpgrade(p, 's', 1000);
    const d = runnerStart(p, { id: 'rn-cccc-0002', stage: 1, now: now + DAY, seed: 7 });
    assert(/부족/.test(poor) && u1.cost === 20 && u2.cost === 30 && p.points_spent === spent0 + 50 && d.start === baseStart(1) + 6 && p.games.runner.open.up?.s === 2 && runnerView(p, now).up.s.lv === 2 && runnerView(p, now).up.s.cost === 40,
      '정령 강화: 기존 코인(points_spent)으로 한 단계씩, 시작 정령 +3/단계, 열린 판은 연 때의 강화로 다시 돌린다');
    { const map = makeMap(1), opts = { start: d.start, pet: { el: rescuePet(p, 7).el, mul: rescuePet(p, 7).mul }, up: p.games.runner.open.up }, run = botRun(map, opts, { skill: 1, seed: 3, cards: [0, 0] }), r = runnerFinish(p, { id: 'rn-cccc-0002', input: run.input, now: now + DAY + run.S.tick * RUNNER.TICK + 3000 });
      assert(r.valid && r.stars === run.S.stars && r.left === run.S.left, '강화한 판도 서버 다시 돌리기 결과가 화면과 같다'); }
    assert(JSON.stringify(p.games.runner).length < 520, `학생 한 명 기록이 작다(${JSON.stringify(p.games.runner).length}바이트, 쌓이는 목록 없음)`);
    // 반 순위: GET에서 계산 · 1분 캐시, 같은 묶음만
    const q = { id: 's2', role: 'student', display_name: '둘', games: { runner: { tot: 3, stars: '333', st: 3 } } }, r = { id: 's3', role: 'student', display_name: '셋', games: { runner: { tot: 1, stars: '3' } } };
    const group = x => x.id === 's3' ? 'B' : 'A', board = runnerBoard([p, q, r], p, { group, ranked: () => true, now });
    p.games.runner.stars = '3333333'; const cached = runnerBoard([p, q, r], p, { group, ranked: () => true, now: now + 1000 }), fresh = runnerBoard([p, q, r], p, { group, ranked: () => true, now: now + RUNNER.BOARD_CACHE_MS + 1 });
    assert(board.top.length === 2 && board.top[0].name === '둘' && board.me.rank === 2 && cached.me.total === board.me.total && fresh.me.rank === 1, '반 순위: 같은 학교 · 학년대 묶음만, 별 합계 순, 1분 캐시');
  }
  // 4) 서비스 · 화면 연결 · 렉 방지
  {
    const svc = source('./service.mjs'), ui = source('../public/modules/runner.js'), build = source('./build-assets.mjs');
    assert(svc.includes("path === '/runner/home' && method === 'GET'") && svc.includes("path === '/runner/board' && method === 'GET'") && svc.includes("path === '/runner/start' && method === 'POST'") && svc.includes("path === '/runner/finish' && method === 'POST'"),
      '서버 요청: 지도 · 반 순위는 GET, 판마다 start · finish 두 POST');
    assert(STATE_BUDGET_KB.runnerRaid > 0 && STATE_BUDGET_KB.runnerRaid <= 20, '새 데이터 묶음(주간 반 보스 runnerRaid)에 예산이 있다(perf-budget.mjs)');
    assert(!/setInterval/.test(ui) && (ui.match(/api\('/g) || []).length === 6 && ui.includes("api('/runner/upgrade', { key: b.dataset.up })") && svc.includes("path === '/runner/upgrade' && method === 'POST'") && ui.includes("api('/runner/finish', { id: g.id, input: g.rec.out() })"), '게임 화면은 서버에 자동으로 묻지 않는다(지도 · 순위 GET, 시작 · 끝 · 강화 POST뿐, V13.243 보상 받은 뒤 지도 GET 한 번)');
    const ev = ui.match(/const SND_EVENTS = (\[.*?\]);/)?.[1];
    assert(ev && JSON.parse(ev.replace(/'/g, '"')).join() === 'gate-good,gate-bad,multiply,shoot,rock-hit,rock-break,saw,hammer,rescue,card,cannon,castle-hit,castle-fall,star,fail,start,wall-hit,wall-break,clash,clash-win,fever,whirl,pillar'
      && ui.includes("if (!RUNNER_SFX || soundFn) return; import('./runner-sfx.js')") && ui.includes('m.preloadRunnerSound?.()') && ui.includes("g.shootOpt.crowd = S.n; snd('shoot', g.shootOpt);") && ui.includes("snd('star', { i })") && ui.includes("snd('card', { pick: true })") && build.includes("existsSync(resolve(root, 'public/modules/runner-sfx.js'))"),
      '소리: runner-sfx.js가 있을 때만 불러 들어갈 때 preloadRunnerSound(), runnerSound(사건 이름 23개 · 사격 crowd · 별 i · 카드 pick)를 부른다');
    // v13.242 연출: 벽(토막 캐시 · 금 2단계 · 큰 숫자) · 적 무리(품질별 그리는 수 상한) · 정면 충돌(느린 동작 · 충돌 빛 · 함성) · 피버(금빛 · 사격 · 속도선) · 그림 75는 있을 때만
    assert(ui.includes('const FOE_DRAW = [12, 28, 40, 56];') && ui.includes("if (type === 'clash') {") && ui.includes("g.slow = .5; g.hitstop = .06;") && ui.includes("flash(g, cxm, 1.2, cz + 1.2, 1.8, .18") && ui.includes("'clash-burst'") && ui.includes("if (type === 'clashWin') { snd('clash-win'); g.cheerT = 1.1;") && ui.includes("if (type === 'fever') { snd('fever');") && ui.includes('v.segs ||=') && ui.includes('v.lb ||=')
      && ['enemy-run', 'enemy-boss', 'fever-plate', 'light-band', 'fever-aura', 'clash-burst', 'sand-whirl', 'ice-slide', 'fire-pillar'].every(k => ui.includes(`'${k}'`)) && ui.includes("['bg', 'road', 'post', 'castle', 'wall', 'wall-chunk']"),
      '연출 2판: 숫자 벽 · 적 무리(품질별 상한) · 정면 충돌(느린 동작 · 충돌 빛 · 함성) · 피버, 그림 75 · 테마 장애물 그림은 RUNNER_ART에 있을 때만');
    assert(build.includes("resolve(root, 'public/assets/runner')") && ui.includes("RUNNER_ART.has(k) ? `/assets/runner/${k}.webp` : null") && existsSync(fileURLToPath(new URL('../public/modules/runner-art.js', import.meta.url))), '그림 74: build:assets가 적은 그림(RUNNER_ART)만 쓰고 없으면 코드 그림');
    assert(!/ctx\.filter\s*=/.test(ui) && /draw: 150,/.test(ui) && ui.includes('const DRAW_MAX = 150;') && ui.includes("const TIER_KEY = 'sumus-runner-tier', TIER_DAYS = 7;"), '연출: 정령은 최대 150마리만 그림 · blur 필터 없음 · 내려간 품질은 7일 기억');
    // v13.241 퀄리티 업: 새 연출도 품질 4단계에 묶인다(낮은 단계는 끄거나 줄임), 위쪽 배지는 바뀔 때만 · 0.1초에 한 번까지, 결과 화면
    const tiers = [...ui.matchAll(/\{ name: '[^']+', scale: [^}]*?shadows: (true|false), trail: (true|false), speed: (\d+), sky: (\d+), fire: (true|false), rim: (true|false), coins: (\d+) \}/g)].map(m => m.slice(1));
    assert(tiers.length === 4 && tiers[0].join() === 'false,false,0,0,false,false,6' && tiers[3][0] === 'true' && tiers.every((t, i) => !i || (Number(t[2]) >= Number(tiers[i - 1][2]) && Number(t[6]) >= Number(tiers[i - 1][6]))),
      '새 연출(발밑 그림자 · 빛 꼬리 · 속도선 · 떠가는 구름 · 성 불 · 앞줄 빛 · 코인 비)은 품질 단계에 묶이고 최저에서는 꺼진다');
    assert(ui.includes('if (S.n === g.hudN || now - g.hudTextAt < 100) return;') && ui.includes("box.animate([") && !/offsetWidth|getBoundingClientRect/.test(ui), '위쪽 정령 수 배지: 바뀔 때만 · 0.1초에 한 번 글자를 쓰고, 튀는 효과는 Web Animations(배치 다시 계산 없음)');
    assert(ui.includes("g.slow > 0 ? dt * .3 : dt") && ui.includes("if (type === 'fall') { g.slow = .75; invertFlash(); castleDown(g); return; }") && ui.includes('data-g="again">한 판 더</button>') && ui.includes('성 HP <b>${hpLeft}%</b> 남았어') && ui.includes('const n = g.T.coins;'),
      '마지막 일격은 연출 시간만 느리게(규칙 틱은 그대로) + 반전 섬광, 결과는 큰 "한 판 더" · 아깝게 지면 남은 성 HP · 코인 비는 품질 상한');
    // 렉 방지(선생님: "렉은 절대 안 걸리게"): 판 전에 그림 디코드 · 재료 굽기 · 카운트다운 동안 품질 결정, blur · shadowBlur 없음,
    //   프레임마다 색 문자열 · 숫자 문자열 · 물체 목록을 새로 만들지 않음, 정령이 많으면 효과 상한을 줄임
    assert(!/shadowBlur|ctx\.filter\s*=/.test(ui) && ui.includes('await Promise.race([warmArt(res.pet?.key, res.pet?.form, theme(res.stage))') && ui.includes('function prebake(g)') && ui.includes('autoTier(g, true)') && ui.includes('const COUNTDOWN = 1.5;'),
      '판 시작 전: 그림 디코드(최대 1.8초) · 색 입힌 재료 · 길 색 표 미리 굽기 · 카운트다운 동안 품질 결정, blur · shadowBlur 없음');
    // 그림 74: 검은 배경 문 판은 검정→투명 진한 색 유리(보통 섞기, 빛만 더하기), 길 타일은 띠로 원근, 성 붕괴는 castle-chunk-a · b 조각, 정령은 테두리
    assert(ui.includes('function glassOf(im, w, h)') && ui.includes('if (g.img[k]) { P[k] = glassOf(g.img[k], g.img[k].width, g.img[k].height); P[k + \'S\'] = shrink(P[k], 192); continue; }') && !ui.includes('g.gateAdd') && ui.includes('function drawRoadTiled(g, img, endZ)') && ui.includes("['chunk-a', 'chunk-b']") && ui.includes('addDebris(g, 0, 4, c.z, 40, 2, 1.4); addSmoke(') && ui.includes("outlined(g, 'spirit-run'"),
      '그림 74: 문 판 진한 색 유리(검정→투명, 보통 섞기 · 빛만 더하기) · 길 타일 원근 · 성 조각 그림 · 정령 테두리');
    // 그림 74 렉 방지: 길 타일 · 하늘은 불투명 캔버스로 미리 굽고(축소본 4장), 최저 단계는 길을 가까운 점으로, 판 준비는 두 번에 나눈다
    assert(ui.includes('function roadMip(img)') && ui.includes("x = c.getContext('2d', { alpha: false });   // 불투명 캔버스") && (ui.match(/imageSmoothingEnabled = false/g) || []).length === 1 && ui.includes('if (g.emerg >= 2) ctx.imageSmoothingEnabled = false;') && ui.includes('requestAnimationFrame(() => setTimeout(() => {') && !ui.includes('buildSprites(g); buildSky(g); }\n  prebake(g);'),
      '그림 74 렉 방지: 길 타일 축소본 · 불투명 하늘 · 판 준비 두 번에 나눔(v13.241 안정화: 가까운 점 그리기는 비상 끝 단계의 길 무늬만)');
    // 넓은 화면: 게임은 가운데 세로 칸, 낮음 · 최저는 칸 넓이를 폰만큼으로, 카운트다운 품질 예상은 실제 캔버스 배율로. 양옆 장식은 CSS 배경 한 장(프레임마다 안 그림)
    assert(ui.includes('function s2Of(g, t)') && ui.includes('const RES_MIN_W = 540;') && ui.includes("function floorS2(g) { const d = Math.min(devicePixelRatio || 1, 2); return Math.max(d * .5, RES_MIN_W / Math.max(1, g.cssW)); }") && ui.includes('mid * (s2Of(g, t) / sc) ** 2 * (t > g.tier ? 1.25 : 1) > 10') && ui.includes("g.cssW = box?.clientWidth") && source('../public/v13241.css').includes('.rn-back{') && source('../public/v13241.css').includes('width:min(100vw,520px,') && !/rn-back/.test(ui.slice(ui.indexOf('/* ---------- 그리기 ---------- */'))),
      '넓은 화면: 세로 칸 · 품질 예상은 실제 배율 · 양옆 장식은 정적 CSS 배경');
    // v13.241 그래픽 안정화(선생님 아이폰 녹화: 길 가장자리 계단 · 흐린 정령 · 숫자): 해상도 하한 · 효과부터 줄이기 · 히스테리시스 · 사다리꼴 길 · 큰 숫자 아틀라스 · 흔들림 줄임
    {
      const fake = { cssW: 390 }, s2 = t => { globalThis.devicePixelRatio = 3; const TI = [0, 1, 2, 3]; const lo = Math.max(1, 540 / fake.cssW), top = Math.max(lo, 2); return lo + (top - lo) * TI[t] / 3; };
      assert(s2(0) * 390 >= 540 && s2(3) === 2 && ui.includes("{ name: '최저', scale: .68, res: 0,") && ui.includes("{ name: '높음', scale: 2, res: 3,"),
        '안정화: 어떤 품질 단계도 캔버스가 CSS × min(dpr, 2) × 0.5 · 폭 540px 아래로 내려가지 않는다(세로 폰 390px 최저 = 540px, 예전 265px)');
    }
    assert(ui.includes('if (s2Of(g, t) !== g.S2) resize(g);') && ui.includes('c / log.length >= .9 && big / log.length < .02') && ui.includes("const bad = x => x.slow > .25 || x.avg > 24;") && ui.includes('if (bad(w) && bad(prev)) { setTier(g, g.tier - 1); g.lastWin = null; }') && ui.includes('g.clock - (g.tierAt || 0) < 6') && ui.includes('if (w.capped && w.js < 10 && prev.capped) return;') && !ui.includes('g.tier - (slow > .5 ? 2 : 1)'),
      '안정화: 품질은 4초(2초 창 둘) 평균으로(30Hz 묶임 = 33ms 근처 90%↑ · 40ms↑ 2% 아래) 한 단계씩만 내리고, 내린 뒤 6초 쉬며 판 중에는 올리지 않는다 · 30Hz로 묶인 폰은 내리지 않음 · 해상도가 같으면 다시 굽지 않음');
    assert(ui.includes('function roadQuad(g, half, zNear, zFar)') && ui.includes('const pad = drawRoadTiled(g, tile, endZ) + .5;') && ui.includes('const band = g.emerg ? 4 : clamp(Math.round(2.2 * g.S2 + 1), 3, 6);') && ui.includes('return padMax;') && !/ctx\.clip\(\); drawRoadTiled/.test(ui) && ui.includes('g.SPR.post : g.SPR.postS'),
      '안정화: 길은 사다리꼴 한 장(난간 포함) + 무늬 띠(화면 4~5px) + 가장자리 직선을 화면 픽셀로 덮는 매끈한 테두리 띠(clip 없음), 난간 윗줄 · 기둥 원본 해상도');
    assert(ui.includes('const RES_EMERGENCY = true, EMERG_MS = 25, EMERG_MID = .75, PHONE_AREA = 390 * 844;') && ui.includes('floorS2(g) * (g.emerg === 1 ? EMERG_MID : 1)')
      && ui.includes('if (RES_EMERGENCY && (avg > EMERG_MS || slow > .12) && !(w.capped && prev.capped)) { setTier(g, 0, g.emerg + 1); g.lastWin = null; }') && ui.includes('if (g.emerg >= 2 || !prev || g.clock - (g.tierAt || 0) < 6) return;')
      && ui.includes('if (RES_EMERGENCY && t === 0 && mid * (floorS2(g) / sc) ** 2 > EMERG_CD) return setTier(g, 0, mid * (floorS2(g) * EMERG_MID / sc) ** 2 > EMERG_CD ? 2 : 1);') && ui.includes('tier: savedTier(), emerg: 0,')
      && /\n  writePref\(TIER_KEY, JSON\.stringify\(\{ t, at: Date\.now\(\) \}\)\);   \/\/ 비상 단계는 기억하지 않는다/.test(ui) && ui.includes('if (g.emerg >= 2) ctx.imageSmoothingEnabled = false;'),
      '안정화 비상 단계(선생님 확인): 하한 → 중간(0.75배) → 예전 최저, 4초 평균 25ms 초과 또는 20ms↑ 프레임 12%↑(30Hz 묶임 아님)일 때 한 단계씩 6초 쉼, 카운트다운이 무거우면 중간부터, 그 판만(기억 안 함, 품질 기억 writePref는 살아 있음)');
    assert(ui.includes('Math.min(1.8, sc / (17 * g.S2), fitN)') && ui.includes('Math.min(1.5, PS / (15 * g.S2) + .4)') && !/PS \/ 34\b/.test(ui), '안정화: 숫자 크기는 화면 배율과 상관없이 같고(PS ÷ 배율), 문 판 · 바위 폭 안에 들어간다');
    assert(ui.includes('const NUM_AT = { foe: 2, wall: 2, count: 2, rock: 2, good: 3, bad: 3, pop: 2, minus: 2 };') && ui.includes('cap = A.k * 1.1') && ui.includes("w > 260 ? P['gate-good'] : P['gate-goodS']") && ui.includes('sp = Math.round(46 * S)'),
      '안정화: 숫자는 2~3배 큰 아틀라스로 굽고 튀어나오는 숫자는 1.1배까지만 늘림 · 문 판은 원본/축소본 중 고름 · 정령은 그리는 크기보다 크게 구움');
    assert(ui.includes('cam.punch = Math.min(cam.punch, .08)') && ui.includes('const shk = cam.trauma * cam.trauma * .2,') && !ui.includes('Math.sin(tt * 71)'), '안정화: 줌 펀치 상한 0.08 · 흔들림 폭 0.2 · 빠른 떨림(71) 없음');
    const drawCode = ui.slice(ui.indexOf('/* ---------- 그리기 ---------- */'));
    assert(!/String\(Math\.ceil|\.splice\(|objs = \[\]|for \(const \[side, val\]|\$\{lerp\(base/.test(drawCode) && ui.includes('const objs = g.objs; objs.length = 0;') && ui.includes("let m = g.tintCache.get(k);") && ui.includes('g.capK = 1 - .35 * want / DRAW_MAX;'),
      '그리기: 프레임마다 숫자 · 색 문자열, 물체 배열, splice를 만들지 않고(캐시 · 재사용), 정령이 많을수록 파편 · 빛 상한을 줄인다');
    const card = source('../public/modules/arcade-games.js'), app = source('../public/app.js');
    assert(card.includes('export function runnerCard') && card.includes('data-action="runner-open"') && source('../public/modules/arcade.js').includes('${runnerCard(A, art)}') && app.includes("d.action === 'runner-open'"), '놀이터 미니게임에 펫 대행진 카드가 있다');
    const load = source('./tournament-load.mjs'), stress = source('./stress-check.mjs');
    assert(load.includes("'POST /runner/finish'") && stress.includes("p95('POST /runner/finish')"), '부하 시험(check:load)에 펫 대행진 끝(다시 돌리기 포함)이 들어 있다');
  }
  // V13.243 판 중 다시 굽기 0: 해상도가 내려가도 그림은 다시 굽지 않고(크기만 비율로), 길 축소본은 그림마다 한 번, 알림 글자는 카운트다운에 미리,
  //   카운트다운 예상 기준 12ms(판 중에 다시 내려가며 캔버스를 다시 만들지 않게), 위쪽 피버 점은 끝없는 CSS 애니메이션 없음
  {
    const ui = source('../public/modules/runner.js'), css = source('../public/v13241.css');
    assert(ui.includes('if (!g.sprS2 || g.S2 > g.sprS2 * 1.01) { g.sprS2 = g.logS2 = g.S2; buildSprites(g); }') && ui.includes('function rescaleLogical(g, r)') && ui.includes('const MIPS = new Map();') && ui.includes("textSprite(g, '피버 타임!', 'cut', 'star');") && ui.includes('const EMERG_CD = 12;') && !/rn-streak[^{]*\{[^}]*animation/.test(css) && !/\.rn-streak i\{[^}]*transition/.test(css),
      '판 중 다시 굽기 없음: 해상도가 내려가도 그림은 그대로(크기만), 알림 글자 미리 굽기, 카운트다운 예상 12ms, 피버 점은 끝없는 애니메이션 없음');
  }
  // V13.243 놀이터 큰 카드: 입구 그림은 다른 게임처럼 ENTRY_ART(public/assets/runner/entry.webp, 임시는 그림 74 합성), 숫자 줄은 남색 바탕 위 흰 글씨(아레나와 같은 토큰)
  {
    const card = source('../public/modules/arcade-games.js'), build = source('./build-assets.mjs'), css = source('../public/v13241.css');
    assert(card.includes("has = art?.entry?.has?.('runner')") && build.includes("'arena', 'runner'].filter(") && existsSync(fileURLToPath(new URL('../public/assets/runner/entry.webp', import.meta.url))) && existsSync(fileURLToPath(new URL('../docs/asset-requests/runner/make-entry.mjs', import.meta.url))) && css.includes('.ag-runner{background:var(--a-bg)}'),
      '펫 대행진 놀이터 카드: 입구 그림 ENTRY_ART(임시 그림은 그림 74 합성) · 숫자 줄이 잘 보이는 남색 바탕');
  }
  // V13.243 테스트 앱 띠 빌드 표시: deploy-test만 /test-build.json을 만들고(저장소 · 운영에는 없음), 앱은 테스트 앱 주소에서만 부른다
  {
    const wf = source('../.github/workflows/deploy-test.yml'), prod = source('../.github/workflows/deploy-cloudflare.yml'), app = source('../public/app.js'), ign = source('../.gitignore');
    const i = app.indexOf("fetch('/test-build.json'"), guard = app.lastIndexOf("if (/^sumus-voca-test\\./.test(location.hostname)) {", i);
    assert(wf.includes('> public/test-build.json') && !prod.includes('test-build') && i > 0 && guard > 0 && i - guard < 200 && ign.includes('public/test-build.json') && !existsSync(fileURLToPath(new URL('../public/test-build.json', import.meta.url))) && source('../public/v13149.css').includes("var(--test-build,'')"),
      '테스트 앱 띠에 빌드 표시(브랜치 끝 · 커밋 7자리): 테스트 배포만 만들고, 앱은 테스트 앱에서만 읽는다(운영에는 없음)');
  }
  void dayKey; void recorder;
}
