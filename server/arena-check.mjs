// V13.225 검사: 펫 아레나 2(public/modules/arena-rules.js · server/arena.mjs · public/modules/arena.js).
//   직접 조종하는 3:3 펫 대전. 전투는 씨앗과 '몇 번째 틱에 무엇을 눌렀나'만으로 정해지고, 서버가 같은 함수로 다시 돌려 승패 · 보상을 정한다.
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { ARENA, BEATS, INPUT, DIRS, ROLE, SKILL2, SHAPE, matchup, fighter, petRank, petSkill, petSkill2, petRole, dirCode, cleanInputs, createArena, runArena } from '../public/modules/arena-rules.js';
import { CHARACTERS } from '../public/modules/core.js';
import { elementOf } from '../public/modules/battle-fx.js';
import { PET_SKILLS } from '../public/modules/battle-engine.js';
import { arenaStart, arenaFinish, arenaView, pickTeam, pickFoe, foeLevelOf, arenaLine, grantArenaTicket, arenaPoolFor, arenaPoolPut, ARENA_POOL } from './arena.mjs';
import { ACTIVITY_MODES } from './activity.mjs';
import { STATE_BUDGET_KB } from './perf-budget.mjs';

const source = path => readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8');
const seeded = seed => () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
const fails = (fn, word) => { try { fn(); return false; } catch (err) { return !word || String(err.message).includes(word); } };
const T = (keys, form = 2, level = 12) => keys.map(key => fighter({ key, form, level }));

// 사람처럼 조종하는 검사용 학생(skill 0 대충 · 1 보통 · 2 잘함). 화면 보기(view)만 읽어 조작 기록을 만든다.
export function playArena(A, skill = 1, seed = 1) {
  const P = [{ dodge: 0.05, atk: 0.5, keep: 0.3 }, { dodge: 0.2, atk: 0.75, keep: 0.6 }, { dodge: 0.45, atk: 0.95, keep: 0.9 }][skill];
  const rnd = seeded(seed * 13 + 1), inputs = [];
  let dir = -1, guard = 0;
  while (!A.S.over && guard++ < ARENA.MAX_TICKS + 50) {
    const v = A.view(), m = v.me, f = v.foe, t = v.t, out = [];
    const dx = f.x - m.x, dy = f.y - m.y, d = Math.sqrt(dx * dx + dy * dy) || 1;
    const melee = ['quake', 'dash'].includes(A.S.me.team[m.idx].shape), want = melee ? 9 : 28;
    let mx, my;
    if (rnd() < P.keep) { const tw = d > want + 4 ? 1 : d < want - 5 ? -1 : 0; mx = dx / d * tw - dy / d * 0.7; my = dy / d * tw + dx / d * 0.7; } else { mx = rnd() - 0.5; my = rnd() - 0.5; }
    const c = dirCode(mx, my, 0.2); if (c !== dir) { dir = c; out.push([t, c]); }
    const danger = v.shots.some(s => s.from === 'foe' && Math.abs(s.x - m.x) < 12 && Math.abs(s.y - m.y) < 12) || v.quakes.some(q => q.from === 'foe' && q.left < 8 && Math.abs(q.x - m.x) < q.r + 3 && Math.abs(q.y - m.y) < q.r + 3);
    if (danger && m.dodgeCd <= 0 && rnd() < P.dodge) out.push([t, INPUT.DODGE]);
    if (m.gauge >= ARENA.GAUGE_MAX) out.push([t, INPUT.ULT]);
    if (m.skill <= 0 && d < want + 14) out.push([t, INPUT.SKILL]);
    else if (m.skill2 <= 0 && d < want + 18) out.push([t, INPUT.SKILL2]);
    if (m.cd <= 0 && rnd() < P.atk) out.push([t, INPUT.ATK]);
    for (const x of out) { inputs.push(x); A.push(x); }
    A.step();
  }
  return inputs;
}

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
    const rate = (fl, skill) => {
      let w = 0, ticks = 0;
      for (let s = 1; s <= 45; s++) {
        const me = T([['dog', 'bear', 'fox'], ['dragon', 'penguin', 'cat'], ['snake', 'panda', 'owl']][s % 3]), foe = T([['pig', 'rabbit', 'owl'], ['dog', 'bear', 'fox'], ['dragon', 'cat', 'panda']][s % 3]);
        const A = createArena({ seed: s * 37, me, foe, foeLevel: fl }); playArena(A, skill, s);
        if (A.S.winner === 'me') w++; ticks += A.S.t;
      }
      return { w: w / 45, sec: ticks / 45 * ARENA.TICK_MS / 1000 };
    };
    const easyBad = rate(0, 0), easyGood = rate(0, 2), midMid = rate(1, 1), hardGood = rate(2, 2), hardBad = rate(2, 0);
    assert(easyGood.w > 0.8 && easyBad.w > 0.15 && midMid.w > 0.25 && midMid.w < 0.75 && hardGood.w > hardBad.w + 0.2 && hardBad.w < 0.35,
      `V13.225 잘 조종할수록 이긴다(쉬움: 대충 ${Math.round(easyBad.w * 100)}% · 잘함 ${Math.round(easyGood.w * 100)}%, 보통끼리 ${Math.round(midMid.w * 100)}%, 어려움: 대충 ${Math.round(hardBad.w * 100)}% · 잘함 ${Math.round(hardGood.w * 100)}%)`);
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
    assert(ui.includes("api('/games/arena/start'") && ui.includes("api('/games/arena/finish', { id: R.r.id, inputs: R.inputs })") && ui.includes('createArena(') && ui.includes('fighter({ key: f.key, form: f.form, level: f.level })') && ui.includes("'arena/bg-plaza', 'battle/bg-arena'"),
      'V13.225 화면은 서버 판으로 같은 전투를 돌리고 조작 기록만 보낸다');
    assert(['ar-stick', "data-btn=\"atk\"", "data-btn=\"skill\"", "data-btn=\"ult\"", "data-btn=\"dodge\"", "data-btn=\"swap\"", 'pointerdown', 'KeyJ'].every(x => ui.includes(x)) && !ui.includes('dealWalls') && !ui.includes('questions'),
      'V13.225 조작: 조이스틱 · 공격 · 스킬 · 필살기 · 회피 · 교체 버튼(누르는 순간 반응), 키보드도 된다. 단어 문제 없음');
    const css = source('../public/v13226.css');
    const art = ['entry', 'bg-plaza', 'bg-forest', 'bg-night', 'vs', 'banner-win', 'banner-lose', 'ult-icon', 'fx-faint'];
    assert(art.every(n => existsSync(new URL(`../public/assets/arena/${n}.webp`, import.meta.url))) && ui.includes("artImg('ult-icon'") && ui.includes("'banner-win' : 'banner-lose'") && ui.includes('/assets/arena/fx-faint.webp') && css.includes('url(/assets/arena/vs.webp)') && css.includes('.ar-stage.art~.ar-main .ar-ring{display:none}'),
      'V13.225 주문서 65 그림 9개: 경기장 · VS · 승패 배너 · 필살기 아이콘 · 쓰러짐 별');
    assert(ui.includes('R.fxN >= FX_MAX') && ui.includes('SHOTS_MAX') && css.includes('.ar-shot{') && css.includes('will-change:transform') && !/\.ar-shot[^{]*\{[^}]*transition:[^}]*(left|top)/.test(css),
      'V13.225 렉 방지: 효과 조각 상한, 날아가는 공격은 정해진 칸을 다시 쓰고 transform으로만 움직인다');
  }
  // 8) V13.226 펫마다 역할 · 스킬 2개 · 근접 보강 · 렉 방지.
  {
    const keys = Object.keys(CHARACTERS), roles = new Set(keys.map(petRole)), kinds = new Set(keys.map(k => petSkill2(k).kind));
    assert(Object.keys(ROLE).every(r => roles.has(r)) && Object.keys(SKILL2).every(k => kinds.has(k)) && keys.every(k => { const f = fighter({ key: k, form: 2, level: 5 }); return f.role && f.skill2?.name && f.skill2.desc && f.skillCd > 0 && f.skill2Cd > 0; }),
      `V13.226 펫 ${keys.length}마리 모두 역할(${[...roles].length}가지) · 스킬 2(${[...kinds].length}가지)가 있다`);
    const combos = new Set(keys.map(k => `${elementOf(k)}|${petRole(k)}|${petSkill(k).name}|${petSkill2(k).kind}`));
    assert(combos.size >= keys.length * 0.9, `V13.226 펫마다 특징 · 스킬 조합이 거의 다 다르다(${combos.size}/${keys.length})`);
    assert(keys.every(k => !(petSkill(k).kind === 'guard' && petSkill2(k).kind === 'heal')) && keys.filter(k => fighter({ key: k }).melee).every(k => ['rush', 'nova', 'pull', 'blink', 'heal'].includes(petSkill2(k).kind)),
      'V13.226 지키기 펫은 치유를 또 받지 않고, 근접 펫은 근접에 맞는 스킬 2(돌격 · 폭발 · 갈고리 · 순간이동 · 치유)');
    // 근접(돌진 · 지진)과 원거리(빔 · 구슬)가 서로 이길 수 있다.
    const melee = keys.filter(k => ['dash', 'quake'].includes(SHAPE[elementOf(k)])), ranged = keys.filter(k => !melee.includes(k));
    const win = (A, B) => { let w = 0; for (let n = 1; n <= 36; n++) { const me = [0, 1, 2].map(i => fighter({ key: A[(n * 3 + i) % A.length], form: 2, level: 10 })), foe = [0, 1, 2].map(i => fighter({ key: B[(n * 5 + i * 7) % B.length], form: 2, level: 10 })); const X = createArena({ seed: n * 31, me, foe, foeLevel: 1 }); playArena(X, 1, n); if (X.S.winner === 'me') w++; } return w / 36; };
    const mr = win(melee, ranged), rm = win(ranged, melee);
    assert(mr > 0.35 && mr < 0.85 && rm > 0.35 && rm < 0.85 && Math.abs(mr - rm) < 0.3, `V13.226 근접 펫도 원거리 펫을 이길 수 있다(근접 → 원거리 ${Math.round(mr * 100)}% · 원거리 → 근접 ${Math.round(rm * 100)}%)`);
    // 스킬 2 버튼: 쿨타임이 있고, 순간이동은 다음 공격 2배.
    const me = [fighter({ key: 'dog', form: 2, level: 5 })];
    const blinker = Object.keys(CHARACTERS).find(k => petSkill2(k).kind === 'blink');
    const A = createArena({ seed: 3, me: [fighter({ key: blinker, form: 2, level: 5 })], foe: me, foeLevel: 0 });
    A.S.me.skill2 = 0; A.push([0, INPUT.SKILL2]); A.step();
    assert(A.S.me.skill2 > 0 && A.S.me.power2 === 1 && cleanInputs([[0, INPUT.SKILL2]]).length === 1, 'V13.226 스킬 2: 누르면 쿨타임, 순간이동은 다음 공격 2배, 서버도 스킬 2 조작을 받는다');
    const ui = source('../public/modules/arena.js'), css = source('../public/v13226.css');
    assert(ui.includes('data-btn="skill2"') && ui.includes("KeyI: 'skill2'") && ui.includes('ar-role') && ui.includes('ar-mine-'), 'V13.226 화면: 스킬 2 버튼(키보드 I) · 대기실에 역할 · 스킬 ① ② · 함정 표시');
    assert(ui.includes('function lagWatch') && ui.includes("classList.toggle('ar-lite', on)") && ui.includes('fxLite(on)') && css.includes('.ar-lite .ar-pet-img') && ui.includes('preloadPoses()') && ui.includes('poseReady(src)') && ui.includes("if (e.kind === 'atk') spark("),
      'V13.226 렉 방지: 기본 공격은 가벼운 불꽃, 자세 그림은 미리 받아 두고, 느린 폰은 자동으로 가벼운 연출');
    assert(!/@keyframes ar-warnblink\{[^}]*filter/.test(css) && ui.includes('el._flags !== flags'), 'V13.226 렉 방지: 깜빡임은 opacity로, 펫 상태 클래스는 바뀔 때만 쓴다');
  }
}
