// V13.241 펫 대행진(크라우드 러너) 검사. 구성안 docs/pet-runner-plan.md.
//   규칙: 같은 조종 기록 → 같은 결과(서버 다시 돌리기) · 규칙 쪽은 판 씨앗만 · 엔진마다 다를 수 있는 수학(sin · pow …) 없음.
//   난도: "처음 도전하는 학생" 흉내 봇으로 깰 확률 · 별 3 확률이 선생님 목표 가까이, 가장 잘하는 봇은 강화 없이 별 3.
//   서버: 시작 · 끝 두 요청, 열린 판 하나, 너무 빠른 판 · 오래된 판 무효, 코인 하루 40 + 첫 판 상자 10, 응원 정령, 구출 펫은 씨앗으로.
//   렉 방지: 지도 · 반 순위는 GET(1분 캐시), 학생 데이터는 프로필 안(목록 없음, 작음), 새 묶음 예산, 부하 시험에 finish.
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { RUNNER, PET_MUL, makeMap, replay, runResult, runInit, runTick, recorder, cleanInput, stageTarget, cheerOf, baseStart, STAGE_TABLE } from '../public/modules/runner-rules.js';
import { botRun, rates, bestStars, randomPet } from './runner-sim.mjs';
import { runnerStart, runnerFinish, runnerView, runnerBoard, rescuePet, startCount } from './runner.mjs';
import { STATE_BUDGET_KB } from './perf-budget.mjs';
import { dayKey } from '../public/modules/core.js';

const source = p => readFileSync(fileURLToPath(new URL(p, import.meta.url)), 'utf8');
const fn = (js, name) => { const i = js.indexOf(`function ${name}(`); if (i < 0) return ''; let d = 0; for (let k = js.indexOf('{', i); k < js.length; k++) { if (js[k] === '{') d++; else if (js[k] === '}' && --d === 0) return js.slice(i, k + 1); } return ''; };

export async function runRunnerChecks(assert) {
  const rules = source('../public/modules/runner-rules.js');
  // 1) 규칙: 결정적 · 판 씨앗만 · 엔진마다 같은 수학
  const ruleCode = ['makeMap', 'cardOffer', 'runInit', 'runTick', 'hurt', 'breakRock', 'runPick', 'rescue', 'petSkill', 'petSiege', 'siegeTick', 'finish', 'replay'].map(n => fn(rules, n)).join('\n');
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
  // 2) 난도(봇): 고른 스테이지에서 목표 ±12%p, 가장 잘하는 봇은 강화 없이 별 3(1~25 모두)
  for (const s of [1, 4, 6, 10, 11, 17, 20, 25]) {
    const r = rates(s, 120, 3), t = stageTarget(s);
    assert(Math.abs(r.clear - t.clear) <= 0.12 && Math.abs(r.three - t.three) <= 0.12 && r.replaySame === 1, `${s}스테이지 처음 도전 깸 ${(r.clear * 100).toFixed(0)}%(목표 ${(t.clear * 100).toFixed(0)}) · 별 3 ${(r.three * 100).toFixed(0)}%(목표 ${(t.three * 100).toFixed(0)})`);
  }
  {
    const miss = []; for (let s = 1; s <= RUNNER.STAGES; s++) if (bestStars(s) < 3) miss.push(s);
    assert(!miss.length, `강화 없이도 별 3이 가능하다(가장 잘하는 봇, 1~${RUNNER.STAGES}스테이지${miss.length ? ` · 안 되는 곳 ${miss.join(', ')}` : ''})`);
    assert(stageTarget(10).clear < stageTarget(9).clear && stageTarget(11).clear > stageTarget(12).clear && stageTarget(3).clear >= 0.98 && stageTarget(76).three === 0.08, '목표: 보스 성(10의 배수)은 어렵게, 바로 다음은 쉬어 가기, 1~5 ≈100% · 76~100 별 3 8%');
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
    assert(JSON.stringify(p.games.runner).length < 400, `학생 한 명 기록이 작다(${JSON.stringify(p.games.runner).length}바이트, 쌓이는 목록 없음)`);
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
    assert(!/setInterval/.test(ui) && (ui.match(/api\('/g) || []).length === 4 && ui.includes("api('/runner/finish', { id: g.id, input: g.rec.out() })"), '게임 화면은 서버에 자동으로 묻지 않는다(지도 · 순위 GET, 시작 · 끝 POST뿐)');
    const ev = ui.match(/const SND_EVENTS = (\[.*?\]);/)?.[1];
    assert(ev && JSON.parse(ev.replace(/'/g, '"')).join() === 'gate-good,gate-bad,multiply,shoot,rock-hit,rock-break,saw,hammer,rescue,card,cannon,castle-hit,castle-fall,star,fail,start'
      && ui.includes("if (!RUNNER_SFX || soundFn) return; import('./runner-sfx.js')") && build.includes("existsSync(resolve(root, 'public/modules/runner-sfx.js'))"),
      '소리: runner-sfx.js가 있을 때만 불러 runnerSound(사건 이름 16개)를 부른다(없으면 조용히, 404 없음)');
    assert(build.includes("resolve(root, 'public/assets/runner')") && ui.includes("RUNNER_ART.has(k) ? `/assets/runner/${k}.webp` : null") && existsSync(fileURLToPath(new URL('../public/modules/runner-art.js', import.meta.url))), '그림 74: build:assets가 적은 그림(RUNNER_ART)만 쓰고 없으면 코드 그림');
    assert(!/ctx\.filter\s*=/.test(ui) && /draw: 150,/.test(ui) && ui.includes('const DRAW_MAX = 150;') && ui.includes("const TIER_KEY = 'sumus-runner-tier', TIER_DAYS = 7;"), '연출: 정령은 최대 150마리만 그림 · blur 필터 없음 · 내려간 품질은 7일 기억');
    const card = source('../public/modules/arcade-games.js'), app = source('../public/app.js');
    assert(card.includes('export function runnerCard') && card.includes('data-action="runner-open"') && source('../public/modules/arcade.js').includes('${runnerCard(A, art)}') && app.includes("d.action === 'runner-open'"), '놀이터 미니게임에 펫 대행진 카드가 있다');
    const load = source('./tournament-load.mjs'), stress = source('./stress-check.mjs');
    assert(load.includes("'POST /runner/finish'") && stress.includes("p95('POST /runner/finish')"), '부하 시험(check:load)에 펫 대행진 끝(다시 돌리기 포함)이 들어 있다');
  }
  void dayKey; void recorder;
}
