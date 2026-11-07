// V13.221 검사: 벽 통과(public/modules/wall-rules.js · server/wall.mjs · public/modules/wall.js).
//   판(벽 15장)은 서버가 만들고, 끝나면 서버가 저장한 정답으로 다시 채점한다. 별은 통과 수(15 · 11 · 6), 코인은 짝 맞추기와 같다(하루 5판).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { WALL, dealWalls, gradeWalls, wallStars, wallMs, stageOf, passPoints, comboMult } from '../public/modules/wall-rules.js';
import { wallStart, wallFinish, wallView, wallPicks, wallLine } from './wall.mjs';
import { ACTIVITY_MODES } from './activity.mjs';

const source = path => readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8');
const seeded = seed => () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
const fails = (fn, word) => { try { fn(); return false; } catch (err) { return !word || String(err.message).includes(word); } };
const WORDS = [
  ['affect', '영향을 주다'], ['effect', '효과'], ['advance', '발전'], ['argue', '주장하다'], ['claim', '요구하다'], ['cause', '원인'],
  ['former', '전자'], ['medical', '의학의'], ['surgeon', '외과의'], ['legal', '법률의'], ['give up', '포기하다'], ['look after', '돌보다'],
  ['brave', '용감한'], ['calm', '차분한'], ['apple', '사과'], ['substantial', '상당한'], ['phenomenon', '현상'], ['define', '규정하다'],
  ['contribute to', '~에 기여하다'], ['a very very long phrase indeed', '너무 긴 말']
].map(([word, meaning], i) => ({ id: `w${i}`, word, meaning, range_code: '1' }));

export async function runWallChecks(assert) {
  // 1) 판 모양.
  {
    let ok = true, kinds = new Set(), runs = true, repeats = true, longOut = true, missedFirst = true, alike = 0, total = 0;
    for (let s = 1; s <= 300; s++) {
      const walls = dealWalls(WORDS, { random: seeded(s), missed: ['w9', 'w13'] });
      ok &&= walls.length === WALL.WALLS && walls.every((w, i) => w.options.length === 4 && new Set(w.options).size === 4 && w.answer >= 0 && w.answer < 4 && w.ms === wallMs(i)
        && (w.kind === 'mean2en' ? WORDS.find(x => x.id === w.id).word === w.options[w.answer] && WORDS.find(x => x.id === w.id).meaning === w.prompt
          : WORDS.find(x => x.id === w.id).word === w.prompt && WORDS.find(x => x.id === w.id).meaning === w.options[w.answer]));
      walls.forEach(w => kinds.add(w.kind));
      runs &&= walls.every((w, i) => i < 2 || !(walls[i - 1].answer === w.answer && walls[i - 2].answer === w.answer));
      repeats &&= walls.every((w, i) => !i || walls[i - 1].id !== w.id);
      longOut &&= walls.every(w => w.id !== 'w19' && !w.options.includes('a very very long phrase indeed'));
      missedFirst &&= ['w9', 'w13'].every(id => walls.slice(0, 2).some(w => w.id === id));
      for (const w of walls.filter(x => x.kind === 'mean2en')) { total++; if (w.options.some((o, k) => k !== w.answer && o[0] === w.options[w.answer][0])) alike++; }
    }
    assert(ok, 'V13.221 벽 통과 판: 벽 15장, 구멍 단어 4개는 서로 다르고 정답 자리 · 문제 · 단계 속도(6 · 4.5 · 3.5초)가 맞다');
    assert(kinds.has('mean2en') && kinds.has('en2mean'), 'V13.221 문제 유형은 섞기: 뜻 → 영어 · 영어 → 뜻');
    assert(runs && repeats, 'V13.221 같은 정답 자리가 3번 이어지지 않고, 바로 앞 벽과 같은 단어가 나오지 않는다');
    assert(longOut, 'V13.221 단어 판에 안 들어가는 긴 말은 판에 나오지 않는다');
    assert(missedFirst, 'V13.221 지난 판 헷갈린 단어가 먼저 나온다');
    assert(alike / total > .45, `V13.221 오답은 헷갈리는 단어(첫 글자 같은 영어)를 먼저 고른다 (${Math.round(alike / total * 100)}%)`);
    assert(dealWalls(WORDS.slice(0, 3)).length === 0 && dealWalls([]).length === 0, 'V13.221 단어가 모자라면 판을 만들지 않는다');
    assert(stageOf(0) === 0 && stageOf(5) === 1 && stageOf(14) === 2 && WALL.SPEEDS.join() === '6000,4500,3500', 'V13.221 5장마다 단계가 오른다');
  }
  // 2) 채점.
  {
    const answers = Array.from({ length: 15 }, (_, i) => i % 4);
    const all = gradeWalls(answers, answers.map(a => [a, 1000]));
    assert(all.passes === 15 && all.lives === 3 && all.stars === 3 && all.over && all.combo === 15, 'V13.221 15장 모두 통과하면 3별');
    const three = gradeWalls(answers, answers.map((a, i) => [i < 3 ? (a + 1) % 4 : a, 1000]));
    assert(three.passes === 0 && three.lives === 0 && three.played === 3 && three.over, 'V13.221 목숨 3개를 다 쓰면 거기서 끝(뒤의 답은 보지 않는다)');
    const fast = gradeWalls(answers, answers.map(a => [a, WALL.MIN_PICK_MS - 1]));
    assert(fast.passes === 0, 'V13.221 구멍이 켜지기 전(0.4초)에 고른 답은 놓친 것');
    const late = gradeWalls(answers, answers.map((a, i) => [a, wallMs(i) + 1]));
    assert(late.passes === 0, 'V13.221 시간이 넘은 답은 놓친 것');
    const timeout = gradeWalls(answers, [[-1, 6000], ...answers.slice(1).map(a => [a, 1000])]);
    assert(timeout.passes === 14 && timeout.lives === 2 && timeout.stars === 2, 'V13.221 시간 끝(-1)은 목숨 하나');
    assert(wallStars(15) === 3 && wallStars(14) === 2 && wallStars(11) === 2 && wallStars(10) === 1 && wallStars(6) === 1 && wallStars(5) === 0, 'V13.221 별: 15장 3별 · 11장 2별 · 6장 1별');
    assert(passPoints(0, 6000, 1) === 150 && passPoints(6000, 6000, 1) === 100 && passPoints(3000, 6000, 10) === 250 && comboMult(3) === 1.2 && comboMult(5) === 1.5, 'V13.221 점수: 100 + 빠르기 최대 50, 콤보 배수 ×1.2 · ×1.5 · ×2');
    assert(wallPicks([[1, 900], ['x', 'y'], [9, 100], 'z']).join('|') === '1,900|-1,0|-1,100|-1,0' && wallPicks(Array(40).fill([0, 1])).length === 15, 'V13.221 서버는 고른 답을 0~3 · -1과 숫자 시간만 받는다(최대 15개)');
  }
  // 3) 서버: 시작 · 끝내기 · 보상.
  {
    const p = { id: 's1', role: 'student' };
    const t0 = Date.UTC(2026, 10, 7, 3);
    const s = wallStart(p, { id: 'g1', words: WORDS, now: t0, random: seeded(3) });
    assert(s.walls.length === 15 && p.games.wall.live.a === s.walls.map(w => w.answer).join('') && s.left === 5, 'V13.221 판 받기: 서버가 정답 자리만 live에 둔다');
    assert(fails(() => wallStart(p, { id: 'x', words: WORDS.slice(0, 3), now: t0 }), '단어가 부족'), 'V13.221 단어가 모자라면 시작하지 못한다');
    const perfect = s.walls.map(w => [w.answer, 1000]);
    const short = wallFinish(p, { id: 'g1', picks: perfect, now: t0 + 5000 });
    assert(short.paid === false && short.reason === 'short' && !p.games.wall.live, 'V13.221 서버가 잰 시간이 벽마다 걸린 시간보다 짧으면 코인 없음');
    const again = wallFinish(p, { id: 'g1', picks: perfect, now: t0 + 60000 });
    assert(again.again && again.paid === false, 'V13.221 같은 끝내기를 다시 보내면 영수증으로 같은 답');
    const s2 = wallStart(p, { id: 'g2', words: WORDS, now: t0 + 70000, random: seeded(4) });
    const r2 = wallFinish(p, { id: 'g2', picks: s2.walls.map(w => [w.answer, 1000]), now: t0 + 70000 + 40000 });
    assert(r2.paid && r2.stars === 3 && r2.coins === WALL.COINS[3] + WALL.RECORD_COINS && r2.record && r2.xp === WALL.XP && p.bonus.log.at(-1).c === r2.coins, 'V13.221 3별 12코인 + 첫 신기록 5코인, 경험치');
    const s3 = wallStart(p, { id: 'g3', words: WORDS, now: t0 + 200000, random: seeded(5) });
    const quit = wallFinish(p, { id: 'g3', picks: s3.walls.slice(0, 4).map(w => [w.answer, 1000]), now: t0 + 260000 });
    assert(quit.paid === false && quit.reason === 'quit', 'V13.221 끝까지 안 한 판은 코인 · 기록 없음');
    let left = wallView(p, t0 + 300000).left, n = 0;
    for (let g = 4; g < 12; g++) {
      const sx = wallStart(p, { id: `g${g}`, words: WORDS, now: t0 + g * 100000, random: seeded(g) });
      const rx = wallFinish(p, { id: `g${g}`, picks: sx.walls.map((w, i) => [i < 3 ? (w.answer + 1) % 4 : w.answer, 1000]), now: t0 + g * 100000 + 30000 });
      if (rx.paid) n++;
      if (g === 11) assert(!rx.paid && rx.reason === 'daily' && rx.record === false, 'V13.221 하루 5판이 넘으면 코인 없이 연습판');
    }
    assert(left === 4 && n === 4 && wallView(p, t0 + 2000000).left === 0, 'V13.221 하루 코인 판 5판');
    assert(wallView(p, t0 + 86400000).left === 5, 'V13.221 다음 날 다시 5판');
    const s4 = wallStart(p, { id: 'g99', words: WORDS, now: t0 + 86400000, random: seeded(9) });
    const stale = wallFinish(p, { id: 'g99', picks: s4.walls.map(w => [w.answer, 1000]), now: t0 + 86400000 + WALL.STALE_MS + 1 });
    assert(stale.paid === false && stale.reason === 'stale', 'V13.221 10분 넘은 판은 무효');
    assert(fails(() => wallFinish(p, { id: 'nope', picks: [], now: t0 }), '찾지 못했어요'), 'V13.221 없는 판은 끝낼 수 없다');
    assert(wallLine({ passes: 12, record: true, paid: true, coins: 13 }) === '벽 통과 12/15 · 신기록 · 13코인', 'V13.221 활동 기록 한 줄');
  }
  // 4) 연결.
  {
    const svc = source('./service.mjs'), app = source('../public/app.js'), games = source('../public/modules/arcade-games.js'), arcade = source('../public/modules/arcade.js');
    const menu = source('../public/modules/playground-menu.js'), ui = source('../public/modules/wall.js'), build = source('./build-assets.mjs'), css = source('../public/v13221.css');
    assert(svc.includes("path === '/games/wall/start' && method === 'POST'") && svc.includes("path === '/games/wall/finish' && method === 'POST'") && svc.includes('scopedWords(state, ctx.school.id, asked, p.class_name)')
      && svc.includes("logActivity(p, 'wall', wallLine(result), now)") && svc.includes('wall: wallView(p, now)'), 'V13.221 서버 길: 시작(내 학교 · 학년 범위 단어) · 끝내기(활동 기록), 놀이터 보기에 벽 통과');
    assert(ACTIVITY_MODES.wall?.label === '벽 통과', 'V13.221 선생님 활동 목록에 벽 통과');
    assert(app.includes("d.action === 'wall-open'") && app.includes('openWallGame(A,') && games.includes('export function wallCard') && games.includes('data-action="wall-open"') && games.includes('${wallCard(A, art)}')
      && arcade.includes('${wallCard(A, art)}') && menu.includes("['벽 통과', r.wall?.left]") && menu.includes("'벽 통과', '최고 점수'"), 'V13.221 놀이터 미니게임 카드 · 오늘 남은 판 · 기록 탭에 벽 통과');
    assert(build.includes('"v13221.css"') && build.includes("['timing', 'rps', 'yabawi', 'wall']") && css.includes('.wl-app') && css.includes('@media (max-height:640px)'), 'V13.221 CSS · 입구 그림 게이트');
    assert(ui.includes("api('/games/wall/start'") && ui.includes("api('/games/wall/finish'") && ui.includes('{ x: 28.96, y: 33.40') && ui.includes('onpointerdown = onPointer')
      && ui.includes('document.hidden') && ui.includes('sumus-wall-missed:') && ui.includes('soundOn()'), 'V13.221 화면: 서버 판 · 벽 구멍 실측 좌표(DONE_64) · 손 닿는 순간 고르기 · 다른 앱이면 멈춤 · 헷갈린 단어 기억 · 소리 설정');
    const need = ['bg-1', 'bg-2', 'bg-3', 'wall-1', 'wall-2', 'wall-3', 'fx-splash', 'fx-ripple', 'water-front', 'tube-back', 'tube-front', 'fx-pass', 'fx-impact', 'heart', 'heart-broken', 'badge-stage', 'ref-ready', 'ref-pass', 'ref-splash', 'ref-fever', 'entry'];
    const { existsSync } = await import('node:fs');
    assert(need.every(n => existsSync(fileURLToPath(new URL(`../public/assets/wall/${n}.webp`, import.meta.url)))) && !existsSync(fileURLToPath(new URL('../public/assets/wall/preview.webp', import.meta.url))), 'V13.221 벽 통과 그림(주문서 64)이 있고, 검토용 preview는 앱에 넣지 않는다');
  }
}
