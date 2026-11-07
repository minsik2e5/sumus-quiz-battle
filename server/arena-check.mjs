// V13.223 검사: 펫 아레나(public/modules/arena-rules.js · server/arena.mjs · public/modules/arena.js).
//   전투는 씨앗과 '몇 번째 틱에 맞혔나/틀렸나'만으로 정해지고, 서버가 같은 함수로 다시 돌려 승패 · 보상을 정한다.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { ARENA, BEATS, matchup, fighter, petRank, gradeAnswers, createArena, runArena } from '../public/modules/arena-rules.js';
import { arenaStart, arenaFinish, arenaView, arenaPicks, pickTeam, pickFoe, foeLevelOf, answersFor, arenaLine } from './arena.mjs';
import { ACTIVITY_MODES } from './activity.mjs';

const source = path => readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8');
const seeded = seed => () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
const fails = (fn, word) => { try { fn(); return false; } catch (err) { return !word || String(err.message).includes(word); } };
const WORDS = [
  ['affect', '영향을 주다'], ['effect', '효과'], ['advance', '발전'], ['argue', '주장하다'], ['claim', '요구하다'], ['cause', '원인'],
  ['former', '전자'], ['medical', '의학의'], ['surgeon', '외과의'], ['legal', '법률의'], ['give up', '포기하다'], ['look after', '돌보다'],
  ['brave', '용감한'], ['calm', '차분한'], ['apple', '사과'], ['substantial', '상당한'], ['phenomenon', '현상'], ['define', '규정하다']
].map(([word, meaning], i) => ({ id: `w${i}`, word, meaning, range_code: '1' }));
const T = (keys, form = 2, level = 12) => keys.map(key => fighter({ key, form, level }));
// 답을 일정 간격으로(맞힘 확률 okp) 넣는 학생.
function student(rate, okp, seed) {
  const r = seeded(seed * 7 + 3), inputs = [];
  for (let t = 30; t < ARENA.MAX_TICKS; t += rate + ARENA.GAP_TICKS) inputs.push({ t, ok: r() < okp });
  return inputs;
}

export async function runArenaChecks(assert) {
  // 1) 펫 능력치 · 상성.
  {
    const a = fighter({ key: 'dog', form: 1, level: 1 }), b = fighter({ key: 'dog', form: 3, level: 1 }), egg = fighter({ key: 'dog', form: 0, level: 1 });
    assert(b.hp > a.hp && b.atk > a.atk && egg.form === 1 && fighter({ key: 'dog', form: 2, level: 30 }).hp > fighter({ key: 'dog', form: 2, level: 1 }).hp,
      'V13.223 단계가 높을수록 · 레벨이 높을수록 세다(알은 1단계로 친다)');
    assert(petRank('dog') === 0 && fighter({ key: 'dog', form: 2, level: 5 }).shape === 'dash' && fighter({ key: 'dragon', form: 2, level: 5 }).shape === 'beam' && fighter({ key: 'bear', form: 2, level: 5 }).shape === 'quake',
      'V13.223 속성마다 기술 모양: 불꽃 빔 · 바위 지진 · 바람 돌진');
    const els = Object.keys(BEATS).filter(k => k !== 'star');
    assert(els.every(e => BEATS[e].length === 2 && els.filter(x => BEATS[x].includes(e)).length === 2) && matchup('flame', 'leaf') === 1.3 && matchup('leaf', 'flame') === 0.8 && matchup('star', 'flame') === 1,
      'V13.223 상성: 속성마다 둘을 이기고(1.3배) 둘에 진다(0.8배), 별빛은 보통');
  }
  // 2) 같은 입력이면 같은 결과(서버 = 화면), 한 틱씩 돌려도 같다.
  {
    const me = T(['dog', 'bear', 'fox']), foe = T(['cat', 'pig', 'owl']);
    let same = true, stepSame = true;
    for (let s = 1; s <= 40; s++) {
      const inputs = student(40, .8, s);
      const x = runArena({ seed: s * 101, me, foe, foeLevel: 1, inputs }), y = runArena({ seed: s * 101, me, foe, foeLevel: 1, inputs });
      same &&= JSON.stringify(x) === JSON.stringify(y);
      const A = createArena({ seed: s * 101, me, foe, foeLevel: 1 });
      let k = 0;
      while (!A.S.over && A.S.t < 4000) { while (k < inputs.length && inputs[k].t <= A.S.t) A.push(inputs[k++]); A.step(); }
      stepSame &&= A.S.winner === x.winner && A.S.t === x.ticks;
    }
    assert(same && stepSame, 'V13.223 전투는 씨앗과 답만으로 정해진다(두 번 돌려도, 화면처럼 한 틱씩 돌려도 같다)');
    assert(!source('../public/modules/arena-rules.js').match(/Math\.(random|sin|cos|tan|atan2|exp|log|pow)\b/), 'V13.223 전투 계산에는 Math.random · 삼각함수가 없다(브라우저마다 같은 결과)');
  }
  // 3) 단어를 잘 맞힐수록 이긴다(같은 팀끼리).
  {
    const me = T(['dog', 'bear', 'fox']), foe = T(['dog', 'bear', 'fox']);
    const rate = (r, okp) => { let w = 0; for (let s = 1; s <= 120; s++) if (runArena({ seed: s, me, foe, foeLevel: 1, inputs: student(r, okp, s) }).winner === 'me') w++; return w / 120; };
    const none = rate(9999, 0), mid = rate(50, .7), good = rate(44, .9);
    assert(none < .1 && mid > .2 && mid < .8 && good > .85, `V13.223 같은 팀이면 단어 실력이 승패를 가른다(안 풀면 ${Math.round(none * 100)}% · 70% 맞힘 ${Math.round(mid * 100)}% · 90% 맞힘 ${Math.round(good * 100)}%)`);
    const r = runArena({ seed: 7, me, foe, foeLevel: 1, inputs: student(44, .9, 7) });
    assert(r.ticks > 600 && r.ticks <= ARENA.MAX_TICKS && r.ults.me >= 3, `V13.223 한 판은 30초~2분, 잘 맞히면 필살기를 여러 번 (${Math.round(r.ticks * ARENA.TICK_MS / 1000)}초 · 필살기 ${r.ults.me}번)`);
    const loseNoAnswer = runArena({ seed: 3, me, foe, foeLevel: 1, inputs: [] });
    assert(loseNoAnswer.winner === 'foe', 'V13.223 단어를 하나도 안 풀면 진다(상대는 필살기를 쓴다)');
  }
  // 4) 채점.
  {
    const ans = [0, 1, 2, 3, 0, 1];
    const g = gradeAnswers(ans, [[0, 20], [1, 20 + ARENA.GAP_TICKS + 30], [-1, 50 + 2 * ARENA.GAP_TICKS + ARENA.Q_LIMIT_TICKS]]);
    assert(g.correct === 2 && g.wrong === 1 && g.inputs.length === 3 && g.inputs[2].ok === false, 'V13.223 맞힘 · 시간 끝(딱 7초)을 순서대로 센다');
    assert(gradeAnswers(ans, [[0, 3]]).correct === 0, 'V13.223 0.4초 안에 고른 답은 놓친 것');
    assert(gradeAnswers(ans, [[0, 20], [1, 10]]).inputs.length === 1 && gradeAnswers(ans, [[0, ARENA.Q_LIMIT_TICKS + 5]]).inputs.length === 0 && gradeAnswers(ans, [[-1, 40]]).inputs.length === 0,
      'V13.223 앞뒤가 안 맞는 틱 · 시간이 넘은 답 · 아무 때나 보낸 시간 끝은 거기서 멈춘다');
    assert(arenaPicks([[1, 90], ['x', 'y'], [9, 100], 'z']).join('|') === '1,90|-1,0|-1,100|-1,0' && answersFor('012', 5).join('') === '01201', 'V13.223 서버는 고른 답을 0~3 · -1과 숫자 틱만 받고, 문제를 다 쓰면 정답도 처음부터 이어진다');
  }
  // 5) 팀 · 상대.
  {
    const pets = [{ key: 'dog', form: 2, level: 14, active: true }, { key: 'cat', form: 0, level: 1 }, { key: 'fox', form: 1, level: 5 }, { key: 'bear', form: 3, level: 22 }, { key: 'owl', form: 1, level: 3 }];
    const team = pickTeam(pets, ['fox', 'cat', 'nope']);
    assert(team.map(f => f.key).join() === 'fox,bear,dog' && pickTeam(pets).map(f => f.key).join() === 'bear,dog,fox' && !pickTeam([{ key: 'cat', form: 0, level: 1 }]).length,
      'V13.223 내 팀: 고른 펫(알 · 없는 펫은 빼고) → 레벨 높은 펫으로 채운다');
    const friend = { name: '친구', team: [['pig', 2, 12], ['owl', 2, 12], ['cat', 2, 12]] };
    const far = { name: '고수', team: [['dragon', 3, 40], ['phoenix', 3, 40], ['gumiho', 3, 40]] };
    const mine = T(['dog', 'bear', 'fox']);
    assert(pickFoe(mine, [friend, far], seeded(1)).name === '친구' && pickFoe(mine, [far], seeded(1)).bot && pickFoe(mine, [], seeded(2)).team.length === 3,
      'V13.223 상대: 힘이 비슷한 친구 팀, 없으면 연습 상대(내 팀과 같은 단계)');
    assert(foeLevelOf({ streak: 3 }) === 2 && foeLevelOf({ lost: 2 }) === 0 && foeLevelOf({}) === 1, 'V13.223 3연승부터 어려움 · 2연패부터 쉬움');
  }
  // 6) 서버: 시작 · 끝 · 보상.
  {
    const pets = [{ key: 'dog', form: 2, level: 12, active: true }, { key: 'bear', form: 2, level: 12 }, { key: 'fox', form: 2, level: 12 }];
    const p = { id: 's1', role: 'student' };
    assert(fails(() => arenaStart(p, { id: 'g0', words: WORDS, pets: [{ key: 'dog', form: 0, level: 1 }], random: seeded(1) }), '알에서 깬 펫'), 'V13.223 알에서 깬 펫이 없으면 못 한다');
    const t0 = 1_800_000_000_000;
    const start = arenaStart(p, { id: 'g1', words: WORDS, pets, team: ['dog'], now: t0, random: seeded(5) });
    assert(start.questions.length === ARENA.QUESTIONS && start.me.length === 3 && start.foe.team.length === 3 && start.questions.every(q => q.options.length === 4 && q.answer >= 0 && q.answer < 4) && p.games.arena.live.a.length === ARENA.QUESTIONS,
      'V13.223 판: 문제 45개(구멍 4개처럼 보기 4개), 두 팀, 정답은 서버에 남긴다');
    assert(p.games.arena.team.map(x => x[0]).join() === start.me.map(f => f.key).join(), 'V13.223 내 팀을 남겨 두면 친구들이 상대로 만난다');
    // 화면처럼 풀기: 늘 맞히는 학생.
    const play = (s, okRate) => {
      const A = createArena({ seed: s.seed, me: s.me.map(f => fighter(f)), foe: s.foe.team.map(f => fighter(f)), foeLevel: s.foe_level });
      const picks = [], r = seeded(9);
      let qi = 0, shown = 0, next = null, asking = true;
      while (!A.S.over && A.S.t < ARENA.MAX_TICKS + 10) {
        const t = A.S.t;
        if (!asking && next != null && t >= next) { asking = true; shown = t; }
        if (asking && t - shown === 40) {
          const q = s.questions[qi % s.questions.length], ok = r() < okRate, k = ok ? q.answer : (q.answer + 1) % 4;
          picks.push([k, t]); A.push({ t, ok }); qi++; asking = false; next = t + ARENA.GAP_TICKS;
        }
        A.step();
      }
      return { picks, winner: A.S.winner, ticks: A.S.t };
    };
    const run1 = play(start, 1);
    const tooSoon = arenaFinish(p, { id: 'g1', picks: run1.picks, now: t0 + 1000 });
    assert(!tooSoon.paid && tooSoon.reason === 'short' && tooSoon.winner === run1.winner, 'V13.223 서버가 잰 시간이 전투보다 짧으면(중간에 나감 · 시간 조작) 보상 없음, 승패는 서버가 다시 계산');
    const s2 = arenaStart(p, { id: 'g2', words: WORDS, pets, now: t0, random: seeded(6) });
    const run2 = play(s2, 1);
    const end = t0 + ARENA.COUNTDOWN_MS + run2.ticks * ARENA.TICK_MS + 500;
    const res = arenaFinish(p, { id: 'g2', picks: run2.picks, now: end });
    assert(res.paid && res.win && res.winner === run2.winner && res.coins === ARENA.COINS.win && res.xp === ARENA.XP && res.correct > 10 && res.wrong === 0, `V13.223 다 맞히면 이기고 코인 ${ARENA.COINS.win} · 경험치를 받는다(서버와 화면 결과가 같다)`);
    const again = arenaFinish(p, { id: 'g2', picks: [], now: end + 10 });
    assert(again.again && again.coins === res.coins && arenaView(p, end).wins === 1 && arenaView(p, end).left === ARENA.DAILY - 1, 'V13.223 같은 끝내기를 다시 보내면 같은 답(두 번 받지 않는다)');
    assert(fails(() => arenaFinish(p, { id: 'nope', picks: [], now: end }), '찾지 못했어요'), 'V13.223 없는 판은 끝낼 수 없다');
    const s3 = arenaStart(p, { id: 'g3', words: WORDS, pets, now: t0, random: seeded(7) });
    const lose = arenaFinish(p, { id: 'g3', picks: [], now: t0 + ARENA.COUNTDOWN_MS + ARENA.MAX_TICKS * ARENA.TICK_MS + 500 });
    assert(!lose.win && lose.paid && lose.coins === 0 && lose.correct === 0 && arenaView(p, end).streak === 0, 'V13.223 안 풀면 지고, 5문제 미만 맞히면 위로 코인 없음(연승은 끊긴다)');
    // 하루 5판.
    let paid = 0;
    for (let n = 0; n < 6; n++) {
      const s = arenaStart(p, { id: `d${n}`, words: WORDS, pets, now: t0, random: seeded(20 + n) });
      const run = play(s, 1);
      if (arenaFinish(p, { id: `d${n}`, picks: run.picks, now: t0 + ARENA.COUNTDOWN_MS + run.ticks * ARENA.TICK_MS + 500 }).paid) paid++;
    }
    assert(paid === ARENA.DAILY - 2, 'V13.223 하루에 코인을 받는 판은 5판');
    const old = arenaStart(p, { id: 'old', words: WORDS, pets, now: t0, random: seeded(30) });
    assert(arenaFinish(p, { id: 'old', picks: play(old, 1).picks, now: t0 + ARENA.STALE_MS + 1 }).reason === 'stale', 'V13.223 10분이 지난 판은 무효');
    assert(arenaLine({ win: true, correct: 12, paid: true, coins: 12 }) === '펫 아레나 승리 · 맞힘 12 · 12코인' && ACTIVITY_MODES.arena?.label === '펫 아레나', 'V13.223 선생님 활동 기록 한 줄');
  }
  // 7) 화면 연결.
  {
    const svc = source('./service.mjs'), games = source('../public/modules/arcade-games.js'), arcade = source('../public/modules/arcade.js'), app = source('../public/app.js'), menu = source('../public/modules/playground-menu.js'), ui = source('../public/modules/arena.js'), build = source('./build-assets.mjs');
    assert(svc.includes("path === '/games/arena/start'") && svc.includes("path === '/games/arena/finish'") && svc.includes('arena: arenaView(p, now)') && !svc.slice(svc.indexOf("path === '/games/arena/start'"), svc.indexOf("path === '/games/arena/finish'")).includes('createCompetition'), 'V13.223 서버 길: 시작 · 끝, 놀이터 화면에 아레나 기록(렉 방지: 시작에서 다른 학생 기록을 훑지 않는다)');
    assert(games.includes('export function arenaCard') && arcade.includes('${arenaCard(A, art)}') && app.includes("d.action === 'arena-open'") && menu.includes("['펫 아레나', r.arena?.left]") && build.includes('"v13223.css"') && build.includes("'wall', 'arena'"),
      'V13.223 놀이터 미니게임에 펫 아레나 카드 · 오늘 남은 판 · 최고 연승, 입구 그림은 주문서 65가 들어오면');
    assert(ui.includes("api('/games/arena/start'") && ui.includes("api('/games/arena/finish'") && ui.includes('createArena(') && ui.includes("'arena/bg-plaza', 'battle/bg-arena'") && ui.includes('fighter({ key: f.key, form: f.form, level: f.level })'),
      'V13.223 화면은 서버 판으로 같은 전투를 돌리고, 경기장 그림이 없으면 지금 전투 광장을 쓴다');
  }
}
