// V13.225 검사: 펫 아레나 2(public/modules/arena-rules.js · server/arena.mjs · public/modules/arena.js).
//   직접 조종하는 3:3 펫 대전. 전투는 씨앗과 '몇 번째 틱에 무엇을 눌렀나'만으로 정해지고, 서버가 같은 함수로 다시 돌려 승패 · 보상을 정한다.
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { ARENA, BEATS, INPUT, DIRS, DIR16, ROLE, SHAPE, TIER_MUL, AI, SHAPES6, EL_SKILLS, SK2, ZONES_MAX, matchup, fighter, petRank, petTier, petSkill, petSkill2, skill2Picks, cleanPicks, petRole, dirCode, aimCode, cleanInputs, createArena, runArena } from '../public/modules/arena-rules.js';
import { playArena, seeded, botRate, tierRate, TIER_PAIRS, pickGap } from './arena-sim.mjs';
import { CHARACTERS } from '../public/modules/core.js';
import { elementOf } from '../public/modules/battle-fx.js';
import { PET_SKILLS } from '../public/modules/battle-engine.js';
import { arenaStart, arenaFinish, arenaView, pickTeam, pickFoe, foeLevelOf, arenaLine, grantArenaTicket, arenaPoolFor, arenaPoolPut, ARENA_POOL, S2_MAX } from './arena.mjs';
import { ACTIVITY_MODES } from './activity.mjs';
import { STATE_BUDGET_KB } from './perf-budget.mjs';

const source = path => readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8');
const fails = (fn, word) => { try { fn(); return false; } catch (err) { return !word || String(err.message).includes(word); } };
const T = (keys, form = 2, level = 12) => keys.map(key => fighter({ key, form, level }));
// 검사용 학생(playArena) · 시뮬레이터는 server/arena-sim.mjs(node server/arena-sim.mjs tiers · bots).
export { playArena };

export async function runArenaChecks(assert) {
  // 1) 펫 능력치 · 상성 · 펫별 스킬.
  {
    const a = fighter({ key: 'dog', form: 1, level: 1 }), b = fighter({ key: 'dog', form: 3, level: 1 }), egg = fighter({ key: 'dog', form: 0, level: 1 });
    assert(b.hp > a.hp && b.atk > a.atk && egg.form === 1 && fighter({ key: 'dog', form: 2, level: 30 }).hp > fighter({ key: 'dog', form: 2, level: 1 }).hp,
      'V13.225 단계가 높을수록 · 레벨이 높을수록 세다(알은 1단계로 친다)');
    assert(petRank('dog') === 0 && fighter({ key: 'dog', form: 2, level: 5 }).shape === 'dash' && fighter({ key: 'dragon', form: 2, level: 5 }).shape === 'beam' && fighter({ key: 'bear', form: 2, level: 5 }).shape === 'quake',
      'V13.225 속성마다 공격 모양: 불꽃 빔 · 바위 지진 · 바람 돌진');
    const els = Object.keys(BEATS).filter(k => k !== 'star');
    assert(els.every(e => BEATS[e].length === 2 && els.filter(x => BEATS[x].includes(e)).length === 2) && matchup('flame', 'leaf') === 1.3 && matchup('leaf', 'flame') === 0.8 && matchup('star', 'flame') === 1,
      'V13.225 상성: 속성마다 둘을 이기고(1.3배) 둘에 진다(0.8배), 별빛은 보통');
    const keys = Object.keys(PET_SKILLS), kinds = new Set(keys.map(k => petSkill(k).kind));
    assert(keys.every(k => petSkill(k).name === PET_SKILLS[k].name && petSkill(k).desc) && ['burst', 'boost', 'poison', 'guard'].every(k => kinds.has(k)),
      `V13.225 펫별 스킬: 펫 스킬표 ${keys.length}마리 모두 같은 이름 · 설명, 종류는 공격 · 강화 · 중독 · 지키기`);
    assert(petSkill('dragon').kind === 'burst' && petSkill('dog').kind === 'boost' && petSkill('snake').kind === 'poison' && petSkill('panda').kind === 'guard' && petSkill('panda').heal > 0 && petSkill('cat').shield > 0,
      'V13.225 스킬 예: 용 불꽃 숨결(공격) · 강아지 용감한 돌진(강화) · 뱀 독 이빨(중독) · 판다 회복 · 고양이 보호막');
    assert([[0, -1], [1, 0], [0, 1], [-1, 0], [1, -1], [-1, 1], [0, 0]].map(([x, y]) => dirCode(x, y)).join() === '1,3,5,7,2,6,0' && DIRS.length === 9,
      'V13.225 조이스틱 방향 8개 + 멈춤(삼각함수 없이)');
  }
  // 2) 같은 조작 기록이면 같은 결과(서버 = 화면), 컴퓨터 상대도 씨앗대로.
  {
    const me = T(['dog', 'bear', 'dragon']), foe = T(['cat', 'pig', 'owl']);
    let same = true;
    for (let s = 1; s <= 30; s++) {
      const A = createArena({ seed: s * 101, me, foe, foeLevel: 1 });
      const inputs = playArena(A, s % 3, s);
      const x = runArena({ seed: s * 101, me, foe, foeLevel: 1, inputs }), y = runArena({ seed: s * 101, me, foe, foeLevel: 1, inputs });
      same &&= JSON.stringify(x) === JSON.stringify(y) && x.winner === A.S.winner && x.ticks === A.S.t;
    }
    assert(same, 'V13.225 전투는 씨앗과 조작 기록만으로 정해진다(화면에서 한 틱씩 돌린 결과 = 서버가 다시 돌린 결과)');
    assert(!source('../public/modules/arena-rules.js').match(/Math\.(random|sin|cos|tan|atan2|exp|log|pow|hypot)\b/), 'V13.225 전투 계산에는 Math.random · 삼각함수가 없다(브라우저마다 같은 결과)');
    assert(cleanInputs([[0, 3], [5, 10], [4, 11], [9, 12]]).length === 2 && cleanInputs([[0, 9]]).length === 0 && cleanInputs([[0, 3], ['x', 3]]).length === 1 && cleanInputs(Array.from({ length: 5000 }, (_, i) => [i >> 1, 10])).length === ARENA.INPUT_MAX && cleanInputs([[ARENA.MAX_TICKS + 401, 10]]).length === 0,
      'V13.225 서버는 조작 기록을 순서대로 · 아는 코드만 · 4000개까지 받는다(어긋나면 거기서 멈춘다)');
  }
  // 3) 잘 조종할수록 이기고, 상대가 어려울수록 어렵다. 한 판 길이.
  {
    const rate = (fl, skill, n = 90) => botRate(fl, skill, n);
    const easyBad = rate(0, 0), easyGood = rate(0, 2), easyMid = rate(0, 1, 200), midMid = rate(1, 1, 200), hardMid = rate(2, 1, 200), hardGood = rate(2, 2), hardBad = rate(2, 0);
    assert(easyGood.w > 0.8 && easyBad.w > 0.15 && midMid.w > 0.25 && midMid.w < 0.75 && hardGood.w > hardBad.w + 0.2 && hardBad.w < 0.35,
      `V13.225 잘 조종할수록 이긴다(쉬움: 대충 ${Math.round(easyBad.w * 100)}% · 잘함 ${Math.round(easyGood.w * 100)}%, 보통끼리 ${Math.round(midMid.w * 100)}%, 어려움: 대충 ${Math.round(hardBad.w * 100)}% · 잘함 ${Math.round(hardGood.w * 100)}%)`);
    assert(easyMid.w >= 0.84 && easyMid.w <= 0.97 && midMid.w >= 0.4 && midMid.w <= 0.6 && hardMid.w >= 0.27 && hardMid.w <= 0.43,
      `V13.228 조준 규칙에 맞춘 컴퓨터 솜씨: 보통 학생이 쉬움 ${Math.round(easyMid.w * 100)}%(≈90) · 보통 ${Math.round(midMid.w * 100)}%(≈50) · 어려움 ${Math.round(hardMid.w * 100)}%(≈35)를 이긴다`);
    assert(midMid.sec > 25 && midMid.sec < 100, `V13.225 한 판은 보통 30초~1분 반(평균 ${Math.round(midMid.sec)}초)`);
    const idle = runArena({ seed: 3, me: T(['dog', 'bear', 'fox']), foe: T(['dog', 'bear', 'fox']), foeLevel: 0, inputs: [] });
    assert(idle.winner === 'foe', 'V13.225 아무것도 안 누르면 진다(상대는 쉬움이어도 공격한다)');
  }
  // 4) 버튼: 회피는 잠깐 무적, 교체는 쿨타임, 필살기는 게이지가 차야.
  {
    const me = T(['dragon', 'dog', 'cat']), foe = T(['pig', 'owl', 'fox']);
    const A = createArena({ seed: 5, me, foe, foeLevel: 1 });
    A.push([0, INPUT.ULT]); A.step();
    assert(A.S.ults.me === 0, 'V13.225 게이지가 안 찼으면 필살기가 안 나간다');
    A.push([1, INPUT.DODGE]); A.step();
    assert(A.S.me.inv > 0 && A.S.me.dodgeCd > 0, 'V13.225 회피하면 잠깐 무적, 다시 쓰려면 기다린다');
    const idx = A.S.me.idx;
    for (let t = A.S.t; t < 70; t++) A.step();
    A.push([A.S.t, INPUT.SWAP]); A.step(); A.step();
    const swapped = A.S.me.idx !== idx;
    A.push([A.S.t, INPUT.SWAP]); const at = A.S.me.idx; A.step(); A.step();
    assert(swapped && A.S.me.idx === at && A.S.me.swapCd > 0, 'V13.225 교체하면 다음 펫이 나오고, 바로 또 바꿀 수는 없다(10초)');
    const B = createArena({ seed: 9, me, foe, foeLevel: 1 }); B.S.me.gauge = ARENA.GAUGE_MAX;
    B.push([0, INPUT.ULT]); B.step();
    assert(B.S.ults.me === 1 && B.S.freeze > 0, 'V13.225 게이지가 차면 필살기(컷인 동안 경기장이 멈춘다)');
  }
  // 5) 팀 · 상대 · 친구 팀 목록 · 입장권.
  {
    const pets = [{ key: 'dog', form: 2, level: 14, active: true }, { key: 'cat', form: 0, level: 1 }, { key: 'fox', form: 1, level: 5 }, { key: 'bear', form: 3, level: 22 }, { key: 'owl', form: 1, level: 3 }];
    assert(pickTeam(pets, ['fox', 'cat', 'nope']).map(f => f.key).join() === 'fox,bear,dog' && pickTeam(pets).map(f => f.key).join() === 'bear,dog,fox' && !pickTeam([{ key: 'cat', form: 0, level: 1 }]).length,
      'V13.225 내 팀: 고른 펫(알 · 없는 펫은 빼고) → 레벨 높은 펫으로 채운다');
    const friend = { name: '친구', team: [['pig', 1, 5], ['owl', 1, 5], ['cat', 1, 5]] }, far = { name: '고수', team: [['dragon', 3, 40], ['phoenix', 3, 40], ['gumiho', 3, 40]] };
    const mine = T(['dog', 'bear', 'fox'], 1, 5);
    assert(pickFoe(mine, [friend, far], seeded(1)).name === '친구' && pickFoe(mine, [far], seeded(1)).bot && pickFoe(mine, [], seeded(2)).team.length === 3,
      'V13.225 상대: 힘이 비슷한 친구 팀, 없으면 연습 상대(내 팀과 같은 단계)');
    assert(foeLevelOf({ streak: 3, games: 9 }) === 2 && foeLevelOf({ lost: 2, games: 9 }) === 0 && foeLevelOf({ games: 1 }) === 0 && foeLevelOf({ games: 5 }) === 1, 'V13.225 처음 3판 · 2연패는 쉬움, 3연승부터 어려움');
    const state = {}, t0 = 1_800_000_000_000;
    for (let i = 0; i < 30; i++) arenaPoolPut(state, { id: `s${i}`, display_name: `학생${i}`, class_name: '1-1' }, 'sch', [['dog', 2, 5]], t0 + i);
    arenaPoolPut(state, { id: 'x', display_name: '옆반', class_name: '1-2' }, 'sch', [['cat', 2, 5]], t0);
    arenaPoolPut(state, { id: 's29', display_name: '학생29', class_name: '1-1' }, 'sch', [['fox', 2, 5]], t0 + 99);
    const seen = arenaPoolFor(state, { id: 's0', class_name: '1-1' }, 'sch', t0 + 100);
    assert(seen.length === ARENA_POOL.PER_CLASS && !seen.some(x => x.name === '옆반') && seen.filter(x => x.name === '학생29').length === 1 && seen.at(-1).team[0][0] === 'fox' && arenaPoolFor(state, { id: 'q', class_name: '1-1' }, 'sch', t0 + ARENA_POOL.KEEP_MS + 200).length === 0,
      'V13.225 친구 팀 목록: 같은 반만 · 반마다 최근 20팀 · 한 학생 한 팀 · 30일 지나면 빠진다');
    assert(STATE_BUDGET_KB.arenaTeams > 0, 'V13.225 친구 팀 목록(state.arenaTeams)은 렉 방지 예산표에 있다');
    const s = { id: 'tk', role: 'student' };
    const got = [1, 2, 3, 4].map(() => grantArenaTicket(s, 'practice', t0));
    assert(got.join() === 'true,true,true,false' && grantArenaTicket(s, 'attend', t0) && !grantArenaTicket(s, 'attend', t0) && arenaView(s, t0).tickets === 4 && !grantArenaTicket({ role: 'teacher' }, 'practice', t0),
      'V13.225 입장권: 끝까지 푼 연습마다 1장(하루 3장) · 출석 1장(학생만)');
    grantArenaTicket(s, 'practice', t0 + 86400000); grantArenaTicket(s, 'practice', t0 + 86400000);
    assert(arenaView(s, t0).tickets === ARENA.TICKETS_MAX, 'V13.225 입장권은 5장까지 모은다');
  }
  // 6) 서버: 시작 · 끝 · 보상.
  {
    const pets = [{ key: 'dog', form: 2, level: 12, active: true }, { key: 'bear', form: 2, level: 12 }, { key: 'fox', form: 2, level: 12 }];
    const p = { id: 's1', role: 'student' }, t0 = 1_800_000_000_000;
    assert(fails(() => arenaStart(p, { id: 'g0', pets: [{ key: 'dog', form: 0, level: 1 }], random: seeded(1) }), '알에서 깬 펫'), 'V13.225 알에서 깬 펫이 없으면 못 한다');
    const start = arenaStart(p, { id: 'g1', pets, team: ['dog'], now: t0, random: seeded(5) });
    assert(start.me.length === 3 && start.foe.team.length === 3 && start.me[0].key === 'dog' && start.me[0].skill?.name && !('questions' in start) && p.games.arena.team.map(x => x[0]).join() === start.me.map(f => f.key).join(),
      'V13.225 판: 두 팀(스킬 포함), 단어 문제 없음, 내 팀을 남겨 두면 친구들이 상대로 만난다');
    const play = (st, skill) => { const A = createArena({ seed: st.seed, me: st.me.map(f => fighter(f)), foe: st.foe.team.map(f => fighter(f)), foeLevel: st.foe_level }); const inputs = playArena(A, skill, 4); return { inputs, winner: A.S.winner, ticks: A.S.t }; };
    const run1 = play(start, 2);
    const tooSoon = arenaFinish(p, { id: 'g1', inputs: run1.inputs, now: t0 + 1000 });
    assert(!tooSoon.paid && tooSoon.reason === 'short' && tooSoon.winner === run1.winner, 'V13.225 서버가 잰 시간이 전투보다 짧으면(중간에 나감 · 시간 조작) 보상 없음, 승패는 서버가 다시 계산');
    // 입장권 없으면 연습 판(기록은 남고 코인 없음).
    const s2 = arenaStart(p, { id: 'g2', pets, now: t0, random: seeded(6) }), run2 = play(s2, 2);
    const end2 = t0 + ARENA.COUNTDOWN_MS + run2.ticks * ARENA.TICK_MS + 500;
    const free = arenaFinish(p, { id: 'g2', inputs: run2.inputs, now: end2 });
    assert(!free.paid && free.reason === 'ticket' && free.winner === run2.winner && arenaView(p, end2).games === 1, 'V13.225 입장권이 없으면 연습 판: 승패 기록은 남고 코인은 없다');
    for (let i = 0; i < 3; i++) grantArenaTicket(p, 'practice', t0);
    grantArenaTicket(p, 'attend', t0);
    // 이길 때까지 잘하는 학생으로.
    let win = null, n = 0;
    while (!win && n < 8) { const s = arenaStart(p, { id: `w${n}`, pets, now: t0, random: seeded(40 + n) }), r = play(s, 2); const res = arenaFinish(p, { id: `w${n}`, inputs: r.inputs, now: t0 + ARENA.COUNTDOWN_MS + r.ticks * ARENA.TICK_MS + 500 }); if (res.win) win = { res, id: `w${n}`, r }; n++; }
    assert(win && win.res.paid && win.res.coins >= ARENA.COINS.win && win.res.xp === ARENA.XP && win.res.winner === win.r.winner, `V13.225 이기면 코인 ${ARENA.COINS.win} · 경험치(서버와 화면 결과가 같다)`);
    const again = arenaFinish(p, { id: win.id, inputs: [], now: t0 + 999999 });
    assert(again.again && again.coins === win.res.coins, 'V13.225 같은 끝내기를 다시 보내면 같은 답(두 번 받지 않는다)');
    assert(fails(() => arenaFinish(p, { id: 'nope', inputs: [], now: t0 }), '찾지 못했어요'), 'V13.225 없는 판은 끝낼 수 없다');
    const before = arenaView(p, t0).tickets;
    const s3 = arenaStart(p, { id: 'g3', pets, now: t0, random: seeded(7) });
    const lose = arenaFinish(p, { id: 'g3', inputs: [], now: t0 + ARENA.COUNTDOWN_MS + ARENA.MAX_TICKS * ARENA.TICK_MS + 500 });
    assert(!lose.win && lose.paid && lose.coins === 0 && lose.ko === 0 && arenaView(p, t0).streak === 0 && arenaView(p, t0).tickets === before - 1 && s3.coin_play,
      'V13.225 아무것도 안 하면 지고, 한 마리도 못 쓰러뜨리면 위로 코인 없음(입장권은 쓴다 · 연승은 끊긴다)');
    // 하루 5판.
    p.games.arena.tk = 5;
    let paid = 0;
    for (let k = 0; k < 6; k++) { const s = arenaStart(p, { id: `d${k}`, pets, now: t0, random: seeded(20 + k) }), r = play(s, 1); if (arenaFinish(p, { id: `d${k}`, inputs: r.inputs, now: t0 + ARENA.COUNTDOWN_MS + r.ticks * ARENA.TICK_MS + 500 }).paid) paid++; }
    assert(arenaView(p, t0).left === 0 && paid + Number(p.games.arena.plays) - paid <= ARENA.DAILY && Number(p.games.arena.plays) === ARENA.DAILY, 'V13.225 하루에 코인을 받는 판은 5판');
    const old = arenaStart(p, { id: 'old', pets, now: t0, random: seeded(30) });
    assert(arenaFinish(p, { id: 'old', inputs: play(old, 1).inputs, now: t0 + ARENA.STALE_MS + 1 }).reason === 'stale', 'V13.225 10분이 지난 판은 무효');
    assert(arenaLine({ win: true, ko: 3, paid: true, coins: 12 }) === '펫 아레나 승리 · 쓰러뜨림 3 · 12코인' && ACTIVITY_MODES.arena?.label === '펫 아레나', 'V13.225 선생님 활동 기록 한 줄');
  }
  // 7) 화면 연결 · 렉 방지.
  {
    const svc = source('./service.mjs'), games = source('../public/modules/arcade-games.js'), arcade = source('../public/modules/arcade.js'), app = source('../public/app.js'), menu = source('../public/modules/playground-menu.js'), ui = source('../public/modules/arena.js'), build = source('./build-assets.mjs');
    const route = svc.slice(svc.indexOf("path === '/games/arena/start'"), svc.indexOf("path === '/games/arena/finish'"));
    assert(svc.includes("path === '/games/arena/finish'") && svc.includes('arena: arenaView(p, now)') && !route.includes('createCompetition') && !route.includes('state.profiles') && route.includes('arenaPoolFor(') && route.includes('arenaPoolPut('),
      'V13.225 서버 길: 시작 · 끝(렉 방지: 시작에서 전체 학생을 훑지 않고 친구 팀 목록만 본다)');
    assert(svc.includes("grantArenaTicket(p, 'attend', now)") && svc.includes("grantArenaTicket(student, 'practice', finalizedAt)"), 'V13.225 출석 · 끝까지 푼 연습이 입장권을 준다');
    assert(games.includes('export function arenaCard') && arcade.includes('${arenaCard(A, art)}') && app.includes("d.action === 'arena-open'") && !app.slice(app.indexOf("d.action === 'arena-open'"), app.indexOf("d.action === 'arena-open'") + 300).includes('arcadeWords') && menu.includes("['펫 아레나', r.arena?.left]") && build.includes('"v13226.css"') && build.includes("'wall', 'arena'"),
      'V13.225 놀이터 미니게임에 펫 아레나 카드(단어 고르기 없음) · 오늘 남은 판 · 최고 연승');
    assert(ui.includes("api('/games/arena/start'") && ui.includes("api('/games/arena/finish', { id: R.r.id, inputs: R.inputs })") && ui.includes('createArena(') && ui.includes('fighter({ key: f.key, form: f.form, level: f.level, s2: f.s2 })') && ui.includes("'arena/bg-plaza', 'battle/bg-arena'"),
      'V13.225 화면은 서버 판으로 같은 전투를 돌리고 조작 기록만 보낸다');
    assert(['ar-stick', "data-btn=\"atk\"", "data-btn=\"skill\"", "data-btn=\"ult\"", "data-btn=\"dodge\"", "data-btn=\"swap\"", 'pointerdown', 'KeyJ'].every(x => ui.includes(x)) && !ui.includes('dealWalls') && !ui.includes('questions'),
      'V13.225 조작: 조이스틱 · 공격 · 스킬 · 필살기 · 회피 · 교체 버튼(누르는 순간 반응), 키보드도 된다. 단어 문제 없음');
    const css = source('../public/v13226.css');
    const art = ['entry', 'bg-plaza', 'bg-forest', 'bg-night', 'vs', 'banner-win', 'banner-lose', 'ult-icon', 'fx-faint'];
    assert(art.every(n => existsSync(new URL(`../public/assets/arena/${n}.webp`, import.meta.url))) && ui.includes("artImg('ult-icon'") && ui.includes("'banner-win' : 'banner-lose'") && ui.includes('/assets/arena/fx-faint.webp') && css.includes('url(/assets/arena/vs.webp)') && css.includes('.ar-stage.art~.ar-main .ar-ring{display:none}'),
      'V13.225 주문서 65 그림 9개: 경기장 · VS · 승패 배너 · 필살기 아이콘 · 쓰러짐 별');
    assert(ui.includes('R.fxN >= (R.lite ? FX_MAX_LITE : FX_MAX)') && ui.includes('SHOTS_MAX') && css.includes('.ar-shot{') && css.includes('will-change:transform') && !/\.ar-shot[^{]*\{[^}]*transition:[^}]*(left|top)/.test(css),
      'V13.225 렉 방지: 효과 조각 상한, 날아가는 공격은 정해진 칸을 다시 쓰고 transform으로만 움직인다');
  }
  // 8) V13.226 펫마다 역할 · 스킬 2개 · 근접 보강 · 렉 방지.
  {
    const keys = Object.keys(CHARACTERS), roles = new Set(keys.map(petRole)), kinds = new Set(keys.flatMap(k => skill2Picks(k).map(x => x.kind)));
    assert(Object.keys(ROLE).every(r => roles.has(r)) && kinds.size === 16 && keys.every(k => { const f = fighter({ key: k, form: 2, level: 5 }); return f.role && f.skill2?.name && f.skill2.desc && f.skillCd > 0 && f.skill2Cd > 0; }),
      `V13.226 펫 ${keys.length}마리 모두 역할(${[...roles].length}가지) · 스킬 2(V13.229 속성 스킬 ${kinds.size}가지 중 고르기)가 있다`);
    const combos = new Set(keys.map(k => `${elementOf(k)}|${petRole(k)}|${petSkill(k).name}`));
    assert(combos.size >= keys.length * 0.9, `V13.226 펫마다 특징 · 스킬 조합이 거의 다 다르다(${combos.size}/${keys.length}, 스킬 ②는 학생이 고른다)`);
    assert(keys.every(k => skill2Picks(k).length === 2 && skill2Picks(k).every((x, i) => EL_SKILLS[elementOf(k)][i].id === x.id)),
      'V13.229 스킬 ②는 펫 속성의 새 스킬 2개 중 하나(근접 · 원거리 모두 같은 두 개에서 고른다)');
    // 근접(돌진 · 지진)과 원거리(빔 · 구슬)가 서로 이길 수 있다.
    const melee = keys.filter(k => ['dash', 'quake'].includes(SHAPE[elementOf(k)])), ranged = keys.filter(k => !melee.includes(k));
    // V13.229: 근접 팀 대 원거리 팀을 직접 붙인다(양쪽 보통 컴퓨터, 절반은 자리를 바꾸고 스킬 ②도 섞는다). 전: 400판 55.0% → 후 55.2%.
    //   (예전에는 검사용 학생 대 컴퓨터로 쟀지만, 그 값은 학생 · 컴퓨터 솜씨 차이가 섞여 근접 · 원거리 차이를 보기 어렵다.)
    let mw = 0;
    for (let n = 1; n <= 400; n++) {
      const flip = n % 2, me = [0, 1, 2].map(i => fighter({ key: melee[(n * 3 + i) % melee.length], form: 2, level: 10, s2: (n + i) & 1 })), foe = [0, 1, 2].map(i => fighter({ key: ranged[(n * 5 + i * 7) % ranged.length], form: 2, level: 10, s2: (n >> 1) + i & 1 }));
      const X = createArena({ seed: n * 31, me: flip ? foe : me, foe: flip ? me : foe, foeLevel: 1, meAi: 1 });
      let g = 0; while (!X.S.over && g++ < ARENA.MAX_TICKS + 50) X.step();
      mw += X.S.winner === (flip ? 'foe' : 'me') ? 1 : X.S.winner === 'draw' ? 0.5 : 0;
    }
    assert(mw / 400 > 0.38 && mw / 400 < 0.62, `V13.226 근접 펫도 원거리 펫을 이길 수 있다(근접 팀 대 원거리 팀 ${Math.round(mw / 4)}%, 400판)`);
    // 스킬 2 버튼: 쿨타임이 있다(V13.229 방울 보호막: 누르면 방울 2개).
    const me = [fighter({ key: 'dog', form: 2, level: 5 })];
    const A = createArena({ seed: 3, me: [fighter({ key: 'turtle', form: 2, level: 5, s2: 1 })], foe: me, foeLevel: 0 });
    A.S.me.skill2 = 0; A.push([0, INPUT.SKILL2]); A.step();
    assert(A.S.me.skill2 > 0 && A.S.me.bubble === SK2.bubble.hits && cleanInputs([[0, INPUT.SKILL2]]).length === 1, 'V13.226 스킬 2: 누르면 쿨타임(방울 보호막은 방울 2개), 서버도 스킬 2 조작을 받는다');
    const ui = source('../public/modules/arena.js'), css = source('../public/v13226.css');
    assert(ui.includes('data-btn="skill2"') && ui.includes("KeyI: 'skill2'") && ui.includes('ar-role') && ui.includes('ar-mine-'), 'V13.226 화면: 스킬 2 버튼(키보드 I) · 대기실에 역할 · 스킬 ① ② · 함정 표시');
    assert(ui.includes('function lagWatch') && ui.includes("classList.toggle('ar-lite', on)") && ui.includes('fxLite(on)') && css.includes('.ar-lite .ar-pet-img') && ui.includes('preloadPoses()') && ui.includes('poseReady(src)') && ui.includes("if (e.kind === 'atk') spark("),
      'V13.226 렉 방지: 기본 공격은 가벼운 불꽃, 자세 그림은 미리 받아 두고, 느린 폰은 자동으로 가벼운 연출');
    assert(!/@keyframes ar-warnblink\{[^}]*filter/.test(css) && ui.includes('el._flags !== flags'), 'V13.226 렉 방지: 깜빡임은 opacity로, 펫 상태 클래스는 바뀔 때만 쓴다');
  }

  // 9) V13.228 (2탄 ①단계) 조준 직접 조작 · 넉백 · 크리티컬 · 등급 배수 · 렉 방지.
  {
    // 16방향 표(삼각함수 없이).
    assert(DIR16.length === 16 && DIR16.every(([x, y]) => Math.abs(x * x + y * y - 1) < 0.001) && DIR16.every(([x, y], i) => aimCode(x, y) === i) && aimCode(0, -1) === 0 && aimCode(1, 0) === 4 && aimCode(0, 1) === 8 && aimCode(-1, 0) === 12 && aimCode(0, 0) === -1,
      'V13.228 조준 방향 16개(위부터 시계 방향, 미리 적은 표) · 화면 방향 → 가장 가까운 칸');
    assert(cleanInputs([[0, INPUT.SKILL, 5]])[0]?.join() === '0,11,5' && cleanInputs([[0, INPUT.ULT, 15], [1, INPUT.ATK, 0], [2, INPUT.SKILL2, 3]]).length === 3 && cleanInputs([[0, INPUT.DODGE, 5]]).length === 0 && cleanInputs([[0, INPUT.SKILL, 16]]).length === 0 && cleanInputs([[0, INPUT.AIM_EASY], [0, INPUT.AIM_AUTO], [0, INPUT.AIM_FREE]]).length === 3 && cleanInputs([[0, 19]]).length === 0,
      'V13.228 조작 기록에 조준 방향: [틱, 공격 · 스킬 · 필살기, 0~15]만 받는다(회피 · 교체에는 없다), 조준 방식 16 쉬움 · 17 자동 · 18 직접');
    // 가만히 있는 상대로 규칙 확인. 내 펫 (50, 72), 상대는 정해 둔 자리.
    const arena = (foeAt, opts = {}) => {
      const A = createArena({ seed: 7, me: T(['dragon'], 2, 10), foe: T(['pig'], 2, 10), foeLevel: 1, foeIdle: true });
      Object.assign(A.S.foe, foeAt); A.S.me.cd = 0; A.S.me.skill = 0;
      if (opts.mode) A.push([0, opts.mode]);
      return A;
    };
    const shotDir = (A, input) => { A.push(input); A.step(); const x = A.S.shots.find(q => q.from === 'me'); return x ? [x.vx, x.vy] : null; };
    // 바라보는 쪽(위)으로 톡: 정면 상대는 맞추고, 30° 옆 상대는 직접 조준(±25°)이면 바라보는 쪽 그대로, 쉬운 조준(±40°) · 자동 조준이면 상대 쪽.
    const side30 = { x: 50 + 32 * 0.5, y: 72 - 32 * 0.866 };
    const up = shotDir(arena({ x: 50, y: 40 }), [0, INPUT.ATK]), free30 = shotDir(arena(side30), [0, INPUT.ATK]), easy30 = shotDir(arena(side30, { mode: INPUT.AIM_EASY }), [0, INPUT.ATK]), auto30 = shotDir(arena(side30, { mode: INPUT.AIM_AUTO }), [0, INPUT.ATK]);
    const toward = v => v && Math.abs(v[0] / Math.sqrt(v[0] ** 2 + v[1] ** 2) - 0.5) < 0.02;
    assert(up && Math.abs(up[0]) < 1e-9 && up[1] < 0 && free30 && Math.abs(free30[0]) < 1e-9 && toward(easy30) && toward(auto30),
      'V13.228 톡 = 바라보는 방향: 바라보는 쪽 ±25° 안의 상대만 맞춰 준다(쉬운 조준 ±40° · 자동 조준은 늘 상대 쪽)');
    const dragged = shotDir(arena({ x: 50, y: 40 }), [0, INPUT.ATK, 4]), dragSnap = shotDir(arena({ x: 50 + 30 * 0.17, y: 72 - 30 * 0.985 }), [0, INPUT.SKILL, 0]);
    assert(dragged && dragged[0] > 0 && Math.abs(dragged[1]) < 1e-9 && dragSnap && dragSnap[0] > 0,
      'V13.228 끌어서 조준: 끈 방향(16방향)으로 나간다. 한 칸 반(≈12°) 안의 상대에게는 맞춰 준다(칸 오차만 메움)');
    const M = arena({ x: 50, y: 30 });
    M.push([0, 3]); M.step(); const right = [M.S.me.fx, M.S.me.fy].join();
    M.push([1, INPUT.STOP]); M.step(); M.step();
    assert(right === '1,0' && M.S.me.fx === 1 && M.S.me.fy === 0, 'V13.228 움직이는 방향 = 바라보는 방향, 서 있으면 마지막 방향을 그대로');
    // 넉백 · 크리티컬(무작위 없이 규칙으로).
    const hit = (foeAt, extra = {}) => {
      const A = arena(foeAt); Object.assign(A.S.foe, extra);
      A.push([0, INPUT.SKILL, 0]);
      let ev = null, guard = 0;
      while (!ev && guard++ < 40) ev = A.step().find(e => e.e === 'dmg' && e.who === 'foe');
      const y0 = A.S.foe.y; for (let k = 0; k < ARENA.KNOCK_TICKS + 1; k++) A.step();
      return { ev, push: y0 - A.S.foe.y };
    };
    const front = hit({ x: 50, y: 40, fx: 0, fy: 1 }), back = hit({ x: 50, y: 40, fx: 0, fy: -1 }), stun = hit({ x: 50, y: 40, fx: 0, fy: 1 }, { stun: 60 }), sideOn = hit({ x: 50, y: 40, fx: 1, fy: 0 });
    const ratio = back.ev && front.ev ? back.ev.dmg / front.ev.dmg : 0;
    assert(front.ev && !front.ev.crit && back.ev?.crit && stun.ev?.crit && !sideOn.ev?.crit && ratio > 1.4 && ratio < 1.6,
      `V13.228 크리티컬: 등 뒤(±45°)에서 · 기절한 상대는 1.5배(${ratio.toFixed(2)}배), 정면 · 옆은 보통. 무작위가 아니다`);
    assert(Math.abs(front.push - ARENA.KNOCK.skill) < 0.01 && ARENA.KNOCK.ult > ARENA.KNOCK.skill && ARENA.KNOCK.skill > ARENA.KNOCK.atk && ARENA.KNOCK.atk > 0,
      `V13.228 넉백은 규칙 파일에: 맞으면 때린 쪽 반대로 밀린다(스킬 ${front.push.toFixed(1)} · 필살기 > 스킬 > 기본), 서버도 같은 결과`);
    // 필살기는 조준한 부채꼴(±35°) 안이어야 맞는다.
    const U = (code) => { const A = arena({ x: 50, y: 40 }); A.S.me.gauge = ARENA.GAUGE_MAX; A.push([0, INPUT.ULT, code]); let ev = [], g = 0; while (g++ < ARENA.ULT_FREEZE_TICKS + 3) ev = ev.concat(A.step()); return ev.find(e => e.e === 'ult'); };
    assert(U(0)?.hit === true && U(4)?.hit === false, 'V13.228 필살기: 조준한 부채꼴(±35°) 안이면 맞고, 다른 쪽으로 쏘면 빗나간다');
    // 컴퓨터도 같은 조준 규칙(버튼을 끌어서 조준, 솜씨만큼 정확히).
    const rules = source('../public/modules/arena-rules.js');
    assert(AI.every(b => b.acc > 0 && b.acc < 1) && AI[0].acc < AI[1].acc && AI[1].acc <= AI[2].acc && rules.includes('w.atkA = aim()') && rules.includes('w.ultA = aim()') && !rules.includes('HITSTOP') && !rules.includes('hitStop'),
      'V13.228 컴퓨터도 조준 방향을 넣어 공격한다(쉬움 < 보통 ≤ 어려움 정확도). 히트스톱은 규칙 파일에 없다(화면만)');
    // 사람처럼 조종한 판(끌어서 조준 포함)도 서버가 다시 돌리면 같은 결과.
    let same = true, aimed = 0;
    for (let k = 1; k <= 12; k++) {
      const me = T(['bear', 'dragon', 'turtle']), foe = T(['cat', 'dog', 'owl']), A = createArena({ seed: k * 53, me, foe, foeLevel: k % 3 });
      const inputs = cleanInputs(playArena(A, k % 3, k)); aimed += inputs.filter(x => x.length === 3).length;
      const r = runArena({ seed: k * 53, me, foe, foeLevel: k % 3, inputs });
      same &&= r.winner === A.S.winner && r.ticks === A.S.t && r.dealt.me === A.S.dealt.me;
    }
    assert(same && aimed > 20, `V13.228 조준 방향이 든 조작 기록도 서버(runArena) = 화면(조준 ${aimed}번)`);
  }
  // 10) V13.228 등급 배수: 기본 ≈ 영웅 < 전설(시리즈) < 신화, 한정 ≈ 기본. 승률로 맞춘다(node server/arena-sim.mjs tiers 4000).
  {
    assert(petTier('dog') === 'normal' && petTier('penguin') === 'epic' && petTier('phoenix') === 'legend' && petTier('tyranno') === 'legend' && petTier('ladybug') === 'legend' && petTier('pumpkincat') === 'limited' && petTier('gumiho') === 'mythic',
      'V13.228 아레나 등급: 일반 · 영웅 · 전설(시리즈 포함) · 한정 · 신화');
    assert(TIER_MUL.normal === 1 && Math.abs(TIER_MUL.epic - 1) <= 0.02 && Math.abs(TIER_MUL.limited - 1) <= 0.025 && TIER_MUL.legend > TIER_MUL.epic && TIER_MUL.mythic > TIER_MUL.legend && TIER_MUL.mythic <= 1.12,
      `V13.228 등급 배수: 일반 ${TIER_MUL.normal} · 영웅 ${TIER_MUL.epic} · 전설 ${TIER_MUL.legend} · 한정 ${TIER_MUL.limited} · 신화 ${TIER_MUL.mythic}`);
    const got = TIER_PAIRS.map(([a, b, goal, tol]) => ({ a, b, goal, tol, r: tierRate(a, b, 800) }));
    assert(got.every(x => Math.abs(x.r - x.goal) <= x.tol), `V13.228 등급 승률(800판씩, 양쪽 같은 솜씨): ${got.map(x => `${x.a} 대 ${x.b} ${Math.round(x.r * 1000) / 10}%(목표 ${Math.round(x.goal * 100)} ± ${Math.round(x.tol * 100)})`).join(' · ')}`);
  }
  // 11) V13.228 화면: 끌어서 조준 · 타격감 · 렉 방지 금지 패턴.
  {
    const ui = source('../public/modules/arena.js'), css = source('../public/v13228.css'), build = source('./build-assets.mjs');
    assert(build.includes('"v13228.css"') && ['function aimShape(', "addEventListener('pointermove'", 'press(d.btn, true, d.on ? d.code : -1)', 'aimCode(dx / g.w, dy / g.h)', 'id="ar-aim"', 'id="ar-aim-spot"', 'data-ar="aim"', 'INPUT.AIM_EASY', 'INPUT.AIM_AUTO', 'id="ar-face"'].every(x => ui.includes(x)),
      'V13.228 화면: 스킬 · 필살기 버튼을 끌면 화살표 · 부채꼴 · 원으로 조준하고 놓으면 그 방향, 바라보는 쪽 화살표, 대기실에서 조준 방식(직접 · 쉬움 · 자동)');
    assert(['function hitStop(', 'R.pausedMs += until', 'function flash(', 'DMG_MAX', 'function dmgNum(', "pop('치명타!'", 'function combo(', 'function finale(', 'function shakeField(', 'function zoomAt(', 'now - (sfxAt.get(key)', "e.who === 'me' && e.hit) buzz"].every(x => ui.includes(x)) && css.includes('.ar-lite .ar-flash{filter:none') && ui.includes("if (!big && app()?.classList.contains('ar-lite')) return"),
      'V13.228 타격감: 히트스톱(화면만) · 피격 섬광 · 큰 숫자(칸 다시 쓰기) · 치명타 · 콤보 · 마지막 한 방 슬로 · 경기장 흔들림 · 줌 · 소리 겹치기(0.05초) · 진동. 저사양은 조각만 줄이고 느낌은 그대로');
    const drawHud = ui.slice(ui.indexOf('function drawHud()'), ui.indexOf('function drawHp()')), placeFn = ui.slice(ui.indexOf('function place(frac)'), ui.indexOf('function loop(now)'));
    const banned = ["app()?.classList.add('ult')", "classList.add('shake')", 'fxPunch(app()', 'fxSkillCutIn(', 'style.zIndex = String(10 + Math.round(y))', "left: `${x}%`"];
    assert(banned.every(x => !ui.includes(x)) && !drawHud.includes('innerHTML') && !placeFn.includes('style.width') && !placeFn.includes('style.height') && placeFn.includes('if (R.z !== z)') && ui.includes("nextFrame(() => fxImpact(") && ui.includes('id="ar-cut"') && ui.includes("nextFrame(() => banner("),
      'V13.228 렉 방지: 필살기 컷인은 미리 만든 칸 · 흔들림/멈춤은 경기장만 · 조각은 프레임을 나눠 · 겹침 순서는 바뀔 때만 · 지진 표시는 scale · 글자는 translate · HUD는 클래스만');
    assert(css.includes('.ar-field.yb-arena{contain:layout style}') && css.includes('.ar-warn::after,.ar-mine::after{animation:none}') && css.includes('.ar-warn.on::after{animation:') && css.includes('.ar-fx.pop,.ar-fx.pop.eff{left:0;top:0}'),
      'V13.228 렉 방지(CSS): 경기장 contain · 숨은 경고 · 함정 칸은 애니메이션 멈춤');
  }

  // 12) V13.229 (2탄 ②단계) 모양 6가지 · 속성 스킬 16개 · 스킬 ② 고르기 · 렉 예산 · 그림 66 주문서.
  {
    const ids = Object.values(EL_SKILLS).flat().map(k => k.id), shapes = new Set(Object.values(EL_SKILLS).flat().map(k => k.shape));
    assert(SHAPES6.length === 6 && SHAPES6.every(x => shapes.has(x)) && ids.length === 16 && new Set(ids).size === 16 && ids.every(id => SK2[id]) && Object.keys(EL_SKILLS).length === 8 && Object.values(EL_SKILLS).every(l => l.length === 2 && l.every(k => k.name && k.desc && k.icon)),
      `V13.229 모양 6가지(부채꼴 지속 · 굵은 줄기 · 원 폭발 · 장판 · 돌진 · 소환)를 모두 쓰는 속성 스킬 16개(속성마다 2개): ${Object.values(EL_SKILLS).flat().map(k => k.name).join(' · ')}`);
    // 스킬 판정: 가만히 선 상대(위쪽 22칸)에게 위로 조준하면 맞고, 아래로 조준하면 빗나간다. 펫은 그 속성 펫 하나(스킬 ② = 그 스킬).
    const elKey = el => Object.keys(CHARACTERS).find(k => elementOf(k) === el && fighter({ key: k }).el === el);
    const trial = (el, pick, code, setup = null, ticks = 110) => {
      const A = createArena({ seed: 11, me: [fighter({ key: elKey(el), form: 2, level: 10, s2: pick })], foe: T(['pig'], 2, 10), foeLevel: 1, foeIdle: true });
      Object.assign(A.S.foe, { x: 50, y: 50, fx: 0, fy: 1 }); A.S.me.skill2 = 0; A.S.me.cd = 999; A.S.me.skill = 999;
      setup?.(A);
      A.push([0, INPUT.SKILL2, code]);
      const ev = [], seen = { zone: 0, line: 0, minion: 0, maxZones: 0 }, foe0 = { x: A.S.foe.x, y: A.S.foe.y };
      let rootSeen = 0, stunSeen = 0, slowSeen = 0, slideSeen = 0, poisonSeen = 0, burnSeen = 0;
      for (let t = 0; t < ticks; t++) {
        ev.push(...A.step());
        seen.zone += A.S.zones.length > 0; seen.line += A.S.lines.length > 0; seen.minion += A.S.minions.length > 0; seen.maxZones = Math.max(seen.maxZones, A.S.zones.length);
        rootSeen ||= A.S.foe.root; stunSeen ||= A.S.foe.stun; slowSeen ||= A.S.foe.slow; slideSeen ||= A.S.foe.slide; poisonSeen ||= A.S.foe.poison; burnSeen ||= A.S.foe.burn;
        if (t === 2 && A.S.foe.x !== 50) { A.S.foe.x = 50; }
      }
      const dmg = ev.filter(e => e.e === 'dmg' && e.who === 'foe').reduce((n, e) => n + e.dmg, 0);
      return { A, ev, dmg, seen, rootSeen, stunSeen, slowSeen, slideSeen, poisonSeen, burnSeen, moved: Math.abs(A.S.foe.y - foe0.y) + Math.abs(A.S.foe.x - foe0.x) };
    };
    const results = {}, aimed = [];
    for (const [el, list] of Object.entries(EL_SKILLS)) list.forEach((k, pick) => {
      const hit = trial(el, pick, 0), miss = ['bubble', 'petal', 'clone'].includes(k.id) ? null : trial(el, pick, 8);
      results[k.id] = { hit, miss };
      if (miss) aimed.push(k.id);
    });
    const offensive = ids.filter(id => !['bubble', 'petal'].includes(id));
    const hits = offensive.filter(id => results[id].hit.dmg > 0), misses = aimed.filter(id => results[id].miss.dmg === 0);
    assert(hits.length === offensive.length && misses.length === aimed.length,
      `V13.229 스킬 판정: 조준한 쪽 상대에게 맞고(${hits.length}/${offensive.length}) 반대쪽으로 쏘면 빗나간다(${misses.length}/${aimed.length})${offensive.filter(id => !hits.includes(id)).concat(aimed.filter(id => !misses.includes(id)).map(x => '빗' + x)).join(',')}`);
    const R = id => results[id].hit;
    assert(R('breath').burnSeen > 0 && R('breath').ev.filter(e => e.e === 'dmg' && e.who === 'foe' && e.kind === 'skill2').length >= 4 && R('meteor').ev.some(e => e.e === 'boom' && e.id === 'meteor') && R('vine').rootSeen > 0 && R('spear').stunSeen > 0 && R('chain').stunSeen > 0 && R('boulder').stunSeen > 0
      && R('crack').slowSeen > 0 && R('icefield').slideSeen > 0 && R('cloud').poisonSeen > 0 && R('darts').poisonSeen > 0 && R('jet').moved > ARENA.KNOCK.skill2 + 5 && R('tornado').seen.zone > 0 && R('gale').ev.filter(e => e.e === 'gale').length === SK2.gale.n - 1 && R('clone').seen.minion > 0,
      'V13.229 스킬 덤: 불 뿜기 여러 번 + 화상 · 운석 폭발 · 덩굴 묶임 · 얼음 창 얼어붙음 · 번개 감전 · 바위 기절 · 지진 느려짐 · 얼음 장판 미끄러짐 · 독구름 · 독침 중독 · 물대포 크게 밀림 · 회오리 · 질풍 세 번 · 분신');
    // 방울 보호막: 다음 피해 2번을 막고(필살기는 못 막는다) 깨질 때 밀쳐낸다. 꽃잎 회복장: 안에 있으면 회복.
    {
      const A = createArena({ seed: 5, me: [fighter({ key: 'turtle', form: 2, level: 10, s2: 1 })], foe: T(['pig'], 2, 10), foeLevel: 1, foeIdle: true });
      Object.assign(A.S.foe, { x: 50, y: 62 }); A.S.me.skill2 = 0; A.push([0, INPUT.SKILL2]); A.step();
      const hp0 = A.S.me.team[0].cur, shot = () => { A.S.shots.push({ from: 'foe', x: A.S.me.x, y: A.S.me.y - 7, vx: 0, vy: 2, r: 2.6, life: 6, power: 1, kind: 'atk', extra: null, el: 'star' }); const ev = []; for (let i = 0; i < 4; i++) ev.push(...A.step()); return ev; };
      const e1 = shot(), e2 = shot(), e3 = shot();
      assert(A.S.me.team[0].cur < hp0 && e1.some(e => e.e === 'bubble') && e2.some(e => e.e === 'bubblepop') && !e3.some(e => e.e === 'bubble') && A.S.me.bubble === 0 && SK2.bubble.hits === 2,
        'V13.229 방울 보호막: 피해 2번을 막고, 마지막 방울이 깨질 때 둘레를 밀쳐낸다(세 번째는 맞는다)');
      const P = createArena({ seed: 5, me: [fighter({ key: Object.keys(CHARACTERS).find(k => elementOf(k) === 'leaf'), form: 2, level: 10, s2: 1 })], foe: T(['pig'], 2, 10), foeLevel: 1, foeIdle: true });
      Object.assign(P.S.foe, { x: 50, y: 20 }); P.S.me.team[0].cur = 100; P.S.me.skill2 = 0; P.push([0, INPUT.SKILL2]);
      for (let i = 0; i < 90; i++) P.step();
      assert(P.S.me.team[0].cur > 100 && P.S.zones.length === 0, 'V13.229 꽃잎 회복장: 4초 동안 안에 있으면 회복하고 사라진다');
    }
    // 장판은 한 판에 4개까지(화면 칸 4개를 다시 쓴다). 얼음 장판을 6번 깔아도 4개.
    {
      const A = createArena({ seed: 9, me: [fighter({ key: elKey('ice'), form: 2, level: 10, s2: 0 })], foe: T(['pig'], 2, 10), foeLevel: 1, foeIdle: true });
      Object.assign(A.S.foe, { x: 20, y: 20 }); let most = 0;
      for (let i = 0; i < 6; i++) { A.S.me.skill2 = 0; A.push([A.S.t, INPUT.SKILL2, i * 2]); A.step(); most = Math.max(most, A.S.zones.length); }
      assert(ZONES_MAX === 4 && most === ZONES_MAX && new Set(A.S.zones.map(z => z.n % ZONES_MAX)).size === A.S.zones.length, `V13.229 장판은 ${ZONES_MAX}개까지(넘으면 오래된 것부터), 칸 번호가 겹치지 않는다`);
    }
    // 서버 다시 돌리기: 새 스킬을 고른 판도 서버(runArena) = 화면. 판마다 스킬 ②를 섞는다.
    let same = true, s2used = 0;
    for (let k = 1; k <= 16; k++) {
      const all = Object.keys(CHARACTERS), me = [0, 1, 2].map(i => fighter({ key: all[(k * 7 + i * 11) % all.length], form: 2, level: 12, s2: (k + i) & 1 })), foe = [0, 1, 2].map(i => fighter({ key: all[(k * 5 + i * 13 + 3) % all.length], form: 2, level: 12, s2: (k >> 1) + i & 1 }));
      const A = createArena({ seed: k * 71, me, foe, foeLevel: k % 3 });
      const inputs = cleanInputs(playArena(A, k % 3, k));
      s2used += inputs.filter(x => x[1] === INPUT.SKILL2).length;
      const r = runArena({ seed: k * 71, me, foe, foeLevel: k % 3, inputs });
      same &&= r.winner === A.S.winner && r.ticks === A.S.t && r.dealt.me === A.S.dealt.me && r.dealt.foe === A.S.dealt.foe;
    }
    assert(same && s2used > 30, `V13.229 새 스킬을 쓴 판도 서버가 다시 돌리면 같은 결과(스킬 ② ${s2used}번, 16판)`);
    assert(!source('../public/modules/arena-rules.js').match(/Math\.(random|sin|cos|tan|atan2|exp|log|pow|hypot)\b/), 'V13.229 새 모양 · 스킬도 삼각함수 · 무작위 없이(16방향 표 · sqrt만)');
    // 스킬 ② 고르기: 규칙 · 서버.
    assert(fighter({ key: 'turtle', s2: 1 }).skill2.id === 'bubble' && fighter({ key: 'turtle' }).skill2.id === 'jet' && fighter({ key: 'turtle', s2: 7 }).skill2.id === 'jet'
      && JSON.stringify(cleanPicks({ turtle: 1, dog: 0, nope: 1, cat: 2, bear: '1' })) === '{"turtle":1,"dog":0}' && JSON.stringify(cleanPicks([1])) === '{}',
      'V13.229 스킬 ② 고르기: 0(A) · 1(B)만, 모르는 펫 · 다른 값은 버린다');
    {
      const pets = [{ key: 'turtle', form: 2, level: 10 }, { key: 'dog', form: 2, level: 9 }, { key: 'bear', form: 2, level: 8 }, { key: 'cat', form: 0, level: 1 }];
      const p = { id: 's2', role: 'student', display_name: '학생', games: {} };
      const r = arenaStart(p, { id: 'g1', pets, team: ['turtle', 'dog', 'bear'], picks: { turtle: 1, dog: 1, cat: 1, owl: 1 }, now: 1000, random: seeded(3) });
      const a = p.games.arena;
      assert(a.s2.turtle === 1 && a.s2.dog === 1 && a.s2.cat === undefined && a.s2.owl === undefined && a.live.me.find(x => x[0] === 'turtle')[3] === 1 && a.live.me.find(x => x[0] === 'bear')[3] === 0 && r.me.find(f => f.key === 'turtle').s2 === 1 && r.s2.turtle === 1,
        'V13.229 서버: 고른 스킬 ②는 내 펫(알 아님)만 기억하고, 판 기록 [키, 단계, 레벨, 스킬 ②]에 넣어 보낸다');
      arenaStart(p, { id: 'g2', pets, team: ['turtle'], now: 2000, random: seeded(4) });
      assert(p.games.arena.live.me.find(x => x[0] === 'turtle')[3] === 1 && arenaView(p, 2000).s2.turtle === 1, 'V13.229 서버: 고르지 않고 시작하면 기억한 스킬 ②로(무료로 바꾼 것이 남는다)');
      // 끝내기: 서버가 같은 스킬 ②로 다시 돌린다(화면에서 돌린 결과 = 서버).
      const live = p.games.arena.live, me = live.me.map(([key, form, level, s2]) => fighter({ key, form, level, s2 })), foe = live.foe.map(([key, form, level, s2]) => fighter({ key, form, level, s2 }));
      const A = createArena({ seed: live.seed, me, foe, foeLevel: live.fl }), inputs = playArena(A, 2, 5);
      const fin = arenaFinish(p, { id: 'g2', inputs, now: 2000 + ARENA.COUNTDOWN_MS + A.S.t * ARENA.TICK_MS + 1000 });
      assert(fin.winner === A.S.winner && fin.dealt === A.S.dealt.me && S2_MAX === 40, `V13.229 서버 끝내기도 고른 스킬 ②로 다시 돌린다(화면 = 서버: ${fin.winner})`);
      const many = {}; for (const k of Object.keys(CHARACTERS)) many[k] = 1;
      const q = { id: 'q', role: 'student', games: {} }, all = Object.keys(CHARACTERS).map((key, i) => ({ key, form: 2, level: 5 + (i % 9) }));
      arenaStart(q, { id: 'g', pets: all, team: [], picks: many, now: 1, random: seeded(1) });
      assert(Object.keys(q.games.arena.s2).length <= S2_MAX, `V13.229 스킬 ② 기억은 ${S2_MAX}개까지(프로필 크기 상한)`);
    }
    // 밸런스: 같은 펫이 두 스킬 중 무엇을 골라도 섞인 상대 팀 승률 차이 ±3% 안(node server/arena-sim.mjs picks 1000).
    const gaps = Object.keys(EL_SKILLS).map(el => ({ el, ...pickGap(el, 1000) }));
    assert(gaps.every(g => Math.abs(g.gap) <= 0.03), `V13.229 스킬 ② 고르기 승률 차이(1000판씩): ${gaps.map(g => `${EL_SKILLS[g.el][0].name} ${Math.round(g.a * 1000) / 10} · ${EL_SKILLS[g.el][1].name} ${Math.round(g.b * 1000) / 10}`).join(' / ')}`);
    // 화면: 스킬 ② 고르기 칸 · 새 칸(장판 4 · 줄기 · 부채꼴 · 분신) · 조각 상한 · 그림 게이트.
    const ui = source('../public/modules/arena.js'), css = source('../public/v13229.css'), build = source('./build-assets.mjs');
    assert(['data-ar="pick2"', 'skill2Picks(key)', "api('/games/arena/start', { team: R.team, picks })", 'R.view?.s2', 's2: f.s2', 'id="ar-zone-${i}"', 'id="ar-line-${i}"', 'id="ar-stream-${i}"', 'id="ar-cone-${w}"', 'id="ar-clone-${w}"', 'function drawSkills(', 'function streamFx(', 'function ultExtra(', 'function meteorBoom(', "import { ARENA_ART } from './arena-art.js'"].every(x => ui.includes(x)) && build.includes('"v13229.css"') && build.includes("public/modules/arena-art.js") && source('../public/modules/arena-art.js').includes('export const ARENA_ART'),
      'V13.229 화면: 대기실에서 펫마다 스킬 ② 고르기(무료) · 미리 만든 장판 · 줄기 · 부채꼴 · 분신 칸 · 속성 필살기 연출 · 그림 66이 오면 칸이 그림으로(ARENA_ART)');
    assert(ui.includes('FX_MAX = 40, FX_MAX_LITE = 20, SKILL_FX = 8, SKILL_FX_LITE = 4') && ui.includes('R.fxN >= (R.lite ? FX_MAX_LITE : FX_MAX)') && ui.includes('k = skillCap(n)') && ui.includes('STREAM_MAX = 2') && ui.includes('Array.from({ length: ZONES_MAX }'),
      'V13.229 렉 예산: 효과 조각 한 번에 40개(저사양 20) · 스킬 하나 8개(저사양 4) · 장판 칸 4개 · 줄기 칸 2개');
    const drawFn = ui.slice(ui.indexOf('function drawSkills('), ui.indexOf('function loop(now)')), fxFns = ui.slice(ui.indexOf('/* ---------- V13.229 새 스킬 연출'), ui.indexOf('function afterimage('));
    const keyframes = [...css.matchAll(/@keyframes [\w-]+\{([^{}]*\{[^}]*\})+\}/g)].map(m => m[0]);
    assert(!/style\.(width|height|left|top)\b/.test(drawFn) && !ui.includes('offsetWidth') && !/style\.(width|height)\b/.test(fxFns) && keyframes.length > 10 && keyframes.every(k => !/(width|height|left|top|filter|margin)\s*:/.test(k.replace(/^@keyframes [\w-]+\{/, ''))),
      'V13.229 렉 방지: 새 칸은 transform(scale) · opacity로만 움직이고(너비 · 높이 · 위치 · 필터 애니메이션 없음), 강제 배치(offsetWidth) 없음');
    const filters = [...css.matchAll(/([^{}]+)\{[^}]*filter:(?!none)[^;}]*/g)].map(m => m[1].trim());
    assert(filters.length >= 3 && filters.every(sel => /ar-cone|ar-stream|ultfx/.test(sel)) && css.includes('.ar-lite .ar-cone.on,.ar-lite .ar-stream b,.ar-lite .ar-fx.ultfx{filter:none}'),
      `V13.229 렉 방지: 빛 번짐 필터는 스킬 · 필살기 칸만(${filters.length}곳), 저사양은 끈다`);
    // 그림 66 주문서: CLAUDE.md 규칙 두 가지(Drive 65번 그림을 열어 그림체 맞추기 · 정해진 Drive 폴더에 정확한 이름으로 저장) + Codex 지시문.
    const dir = '../docs/asset-requests/runner/', split = readdirSync(fileURLToPath(new URL(dir + 'split/', import.meta.url))).filter(f => f.startsWith('66-'));
    const texts = split.map(f => source(`${dir}split/${f}`)), codex = source(`${dir}CODEX_PROMPT_66.md`), map = source(`${dir}slice-map.csv`).split('\n').filter(l => l.startsWith('"66-pet-arena-skills.txt"'));
    assert(split.length === 7 && texts.every((t, i) => t.includes('STYLE REFERENCE') && t.includes('"SUMUS 펫 아레나 65 (Runner용)"') && t.includes('"SUMUS 펫 아레나 66 (Runner용)"') && /named exactly "66-\d\.png"/.test(t)) && map.length === 19 && map.every(l => l.includes('public/assets/arena/'))
      && codex.includes('SUMUS 펫 아레나 66 (Runner용)') && codex.includes('REFERENCE IMAGES ARE ATTACHED') && codex.includes('PR까지만') && codex.includes('arena/bg-plaza.webp') && source(`${dir}README.md`).includes('펫 아레나 스킬 연출(66)'),
      'V13.229 그림 66 주문서: 시트 7장 · 그림 19장, 시트마다 Drive 65번 아레나 그림을 열어 그림체를 맞추고 "SUMUS 펫 아레나 66 (Runner용)"에 정확한 이름으로 저장, Codex 지시문은 저장소 그림 참고');
  }
}
