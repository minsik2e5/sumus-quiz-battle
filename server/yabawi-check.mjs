// V13.205 검사: 야바위(server/yabawi.mjs · public/modules/yabawi-rules.js · yabawi.js).
//   판(공 자리 · 맞바꾸기 · 밑장빼기)과 판정 · 정산은 서버가 한다. 판돈은 가위바위보처럼 ×2 → ×4 → ×8, 하루 5판.
//   '동작 그만'은 밑장빼기 뒤 맞바꾸기 2번 안에만 통한다. 놀이터 카드는 테스트 앱 · 로컬에서만 보인다.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { YABAWI, ballAt, caughtCheat, cheatMs, isFake, roundMs, slotXY, stepPairs } from '../public/modules/yabawi-rules.js';
import { dealRound, yabawiDeal, yabawiPick, yabawiCash, yabawiView, yabawiLine } from './yabawi.mjs';
import { rewardIncome } from './rewards.mjs';

const source = path => readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8');
// 같은 판을 다시 만들 수 있게 씨앗 있는 난수.
const seeded = seed => () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
const fails = (fn, word) => { try { fn(); return false; } catch (err) { return !word || String(err.message).includes(word); } };

export async function runYabawiChecks(assert) {
  // 1) 판 모양: 이긴 수에 따라 컵 3 → 4 → 6, 둘째 판부터 두 · 세 쌍이 한꺼번에, 페이크 걸음. 첫 판엔 밑장빼기 없음.
  {
    let ok = true, multi = [0, 0, 0], cheats = [0, 0, 0], catchRoom = true;
    for (let s = 1; s <= 600; s++) {
      for (const stage of [0, 1, 2]) {
        const r = dealRound(stage, seeded(s * 7 + stage)), R = YABAWI.ROUNDS[stage];
        const steps = r.swaps.map(stepPairs);
        ok &&= r.cups === R.cups && r.swaps.length === R.swaps && r.ms === R.ms && r.start >= 0 && r.start < r.cups
          && steps.every(st => st.length >= 1 && st.length <= R.pairs && new Set(st.flat()).size === st.length * 2 && st.flat().every(c => c >= 0 && c < r.cups))
          && r.fakes.length === R.fakes && r.fakes.every(i => i > 0 && i < R.swaps - 1) && new Set(r.fakes).size === r.fakes.length;
        if (steps.some(st => st.length > 1)) multi[stage]++;
        if (r.cheat) {
          cheats[stage]++;
          catchRoom &&= r.cheat.at >= 1 && r.cheat.at + YABAWI.CATCH_STEPS <= r.swaps.length - 1 && r.cheat.to !== r.cheat.from && !isFake(r, r.cheat.at)
            && r.cheat.from === ballAt({ ...r, cheat: null }, r.cheat.at + 1);
        }
      }
    }
    assert(ok, 'V13.205 야바위 판: 컵 3 · 4 · 6개, 정한 걸음 · 속도, 한 걸음의 쌍은 겹치지 않고 페이크는 처음 · 끝 걸음이 아니다');
    assert(multi[0] === 0 && multi[1] > 500 && multi[2] === 600, `V13.205 첫 판은 한 쌍씩, 둘째 판부터 여러 쌍이 한꺼번에 (${multi.join(' · ')} / 600)`);
    assert(YABAWI.ROUNDS.map(R => R.ms).join() === '280,215,170' && YABAWI.SHOW_MS === 1000 && YABAWI.CATCH_STEPS === 1, 'V13.205 2차 난이도: 처음보다 2배 빠르게(280 · 215 · 170ms), 공 보여 주기 1초, 동작 그만은 한 걸음 안');
    assert(cheats[0] === 0 && cheats[1] > 600 * 0.25 && cheats[1] < 600 * 0.45 && cheats[2] > 600 * 0.45 && cheats[2] < 600 * 0.65,
      `V13.205 밑장빼기는 첫 판 0%, 둘째 판 약 35%, 셋째 판 약 55% (${cheats.join(' · ')} / 600)`);
    assert(catchRoom, 'V13.205 밑장빼기는 페이크가 아닌 걸음 뒤, 공이 있던 컵에서 다른 컵으로, 뒤에 "동작 그만" 걸음이 남는다');
  }

  // 2) 공 따라가기(여러 쌍 · 페이크 · 예전 판 모양) · 밑장빼기 · 동작 그만 판정 · 시간.
  {
    const round = { cups: 3, start: 0, swaps: [[0, 1], [1, 2], [0, 2], [0, 1]], ms: 500, cheat: null };
    assert(ballAt(round, 0) === 0 && ballAt(round, 1) === 1 && ballAt(round, 2) === 2 && ballAt(round, 3) === 0 && ballAt(round) === 1, 'V13.205 예전 판 모양([a, b])도 공을 따라간다');
    const multi = { cups: 6, start: 0, swaps: [[[0, 1], [2, 3]], [[1, 4], [0, 5]], [[4, 2]]], ms: 200, fakes: [], cheat: null };
    assert(ballAt(multi, 1) === 1 && ballAt(multi, 2) === 4 && ballAt(multi) === 2, 'V13.205 한 걸음에 여러 쌍이 바뀌어도 공은 한 번만 움직인다');
    const fake = { ...multi, fakes: [1] };
    assert(ballAt(fake, 2) === 1 && ballAt(fake) === 1 && isFake(fake, 1) && !isFake(fake, 0), 'V13.205 페이크 걸음에서는 공이 그대로다');
    const cheat = { ...round, cheat: { at: 1, from: 2, to: 0 } };
    assert(ballAt(cheat, 1) === 1 && ballAt(cheat, 2) === 0 && ballAt(cheat) === 2, 'V13.205 밑장빼기는 그 걸음 바로 뒤에 공을 옮긴다');
    assert(!caughtCheat(cheat, 1) && caughtCheat(cheat, 2) && !caughtCheat(cheat, 3) && !caughtCheat(round, 2) && !caughtCheat(cheat, null),
      'V13.205 "동작 그만"은 밑장빼기부터 다음 한 걸음 안에만 통한다');
    assert(roundMs(round) === YABAWI.SHOW_MS + 2000 && roundMs(cheat) === YABAWI.SHOW_MS + 2000 + YABAWI.CHEAT_MS && cheatMs(cheat) === YABAWI.SHOW_MS + 1000 && cheatMs(round) === Infinity,
      'V13.205 섞는 시간 = 공 보여 주기 + 걸음 (+ 밑장빼기 장면)');
    const six = Array.from({ length: 6 }, (_, i) => slotXY(6, i));
    assert(slotXY(3, 1).x === 50 && six.filter(p => p.y < 50).length === 3 && six.filter(p => p.y > 50).length === 3, 'V13.205 컵 6개는 보낸 그림처럼 2 × 3');
  }

  // 3) 새 판 · 하루 5판 · 코인 부족 · 이어 보기.
  {
    const now = Date.UTC(2026, 10, 2, 3), p = { id: 's1', role: 'student' };
    assert(fails(() => yabawiDeal(p, { bet: 15 }, 100, { now }), '걸 코인') && fails(() => yabawiDeal(p, { bet: 30 }, 20, { now }), '부족'), 'V13.205 판돈은 10 · 20 · 30, 잔액보다 많이 못 건다');
    const a = yabawiDeal(p, { bet: 20 }, 100, { now, random: seeded(3) });
    assert(p.points_spent === 20 && p.yabawi.plays === 1 && a.pot === 20 && a.round.cups === 3 && p.yabawi.live.await === 'pick', 'V13.205 판을 받으면 판돈이 빠지고(points_spent) 컵 3개 판이 나온다');
    const again = yabawiDeal(p, {}, 100, { now: now + 5000 });
    assert(JSON.stringify(again.round) === JSON.stringify(a.round) && p.points_spent === 20 && p.yabawi.plays === 1, 'V13.205 섞다가 닫은 판은 같은 판을 처음부터 다시 보여 준다(코인 · 판 수 그대로)');
    assert(fails(() => yabawiDeal(p, { double: true }, 100, { now }), '더블'), 'V13.205 이기기 전엔 더블로 못 간다');
    const q = { id: 's2', role: 'student', yabawi: { day: undefined } };
    for (let i = 0; i < YABAWI.DAILY; i++) { yabawiDeal(q, { bet: 10 }, 999, { now, random: seeded(i + 1) }); q.yabawi.live = null; }
    assert(fails(() => yabawiDeal(q, { bet: 10 }, 999, { now }), '하루') && !fails(() => yabawiDeal(q, { bet: 10 }, 999, { now: now + 86400000, random: seeded(9) })), 'V13.205 야바위는 하루 5판, 다음 날 다시');
  }

  // 4) 고르기: 너무 빨리는 거절, 맞히면 ×2 · 받기/더블, 틀리면 끝. ×8이면 바로 정산.
  {
    const now = Date.UTC(2026, 10, 2, 3), p = { id: 's3', role: 'student' };
    const d = yabawiDeal(p, { bet: 10 }, 100, { now, random: seeded(11) });
    const ball = ballAt(d.round), late = now + roundMs(d.round);
    assert(fails(() => yabawiPick(p, { slot: ball }, { now: now + 200 }), '섞은 뒤'), 'V13.205 섞는 화면을 건너뛴 빠른 고르기는 받지 않는다');
    assert(fails(() => yabawiPick(p, { slot: 9 }, { now: late }), '컵'), 'V13.205 없는 컵은 못 고른다');
    const w = yabawiPick(p, { slot: ball }, { now: late });
    assert(w.result === 'win' && w.wins === 1 && w.pot === 20 && w.paid === 0 && !w.done && p.yabawi.live.await === 'choice', 'V13.205 맞히면 판돈 ×2, 받을지 더블로 갈지 고른다');
    const c = yabawiCash(p, late + 10);
    assert(c.paid === 20 && !p.yabawi.live && p.yabawi.paid === 20 && rewardIncome(p) >= 20 && yabawiLine({ ...c, result: 'win' }) === '야바위 1연승 · 20코인', 'V13.205 받기를 누르면 판돈이 잔액(rewardIncome)으로 들어온다');

    const q = { id: 's4', role: 'student' };
    let r = yabawiDeal(q, { bet: 10 }, 100, { now, random: seeded(21) }), t = now;
    for (let i = 0; i < YABAWI.MAX_WINS; i++) {
      t += roundMs(r.round) + 10;
      const out = yabawiPick(q, { slot: ballAt(r.round) }, { now: t });
      if (i < YABAWI.MAX_WINS - 1) { assert(out.pot === 10 * 2 ** (i + 1), `V13.205 ${i + 1}연승 판돈 ×${2 ** (i + 1)}`); r = yabawiDeal(q, { double: true }, 0, { now: t, random: seeded(22 + i) }); assert(r.round.cups === YABAWI.ROUNDS[i + 1].cups, 'V13.205 더블로 가면 다음 판은 컵이 늘어난다'); }
      else assert(out.done && out.paid === 80 && q.yabawi.jackpots === 1 && !q.yabawi.live && q.yabawi.best === 3, 'V13.205 3연승(×8)이면 바로 80코인 정산, 더블은 없다');
    }

    const l = { id: 's5', role: 'student' };
    const ld = yabawiDeal(l, { bet: 30 }, 100, { now, random: seeded(5) });
    const wrong = (ballAt(ld.round) + 1) % ld.round.cups;
    const lo = yabawiPick(l, { slot: wrong }, { now: now + roundMs(ld.round) });
    assert(lo.result === 'lose' && lo.paid === 0 && !l.yabawi.live && l.points_spent === 30 && l.yabawi.paid === 0 && yabawiLine(lo) === '야바위 패 · 30코인', 'V13.205 틀리면 판돈을 잃고 끝난다');
  }

  // 5) 동작 그만: 밑장빼기 뒤 맞바꾸기 2번 안에 누르면 이긴다(고른 컵 없이). 너무 빨리 보낸 잡기는 거절.
  {
    const now = Date.UTC(2026, 10, 2, 3), p = { id: 's6', role: 'student' };
    yabawiDeal(p, { bet: 10 }, 100, { now, random: seeded(31) });
    yabawiPick(p, { slot: ballAt(p.yabawi.live.round) }, { now: now + 20000 });
    let r, seed = 40;
    do { r = yabawiDeal(p, { double: true }, 0, { now, random: seeded(seed++) }).round; if (!r.cheat) { p.yabawi.live.await = 'choice'; } } while (!r.cheat && seed < 400);
    assert(!!r.cheat, 'V13.205 둘째 판에서 밑장빼기 판을 찾았다');
    const stop = r.cheat.at + 1;
    assert(fails(() => yabawiPick(p, { slot: null, stop }, { now: now + 100 }), '지켜봐'), 'V13.205 밑장빼기 장면보다 빠른 \'동작 그만\'은 받지 않는다');
    const caught = yabawiPick(p, { slot: null, stop }, { now: now + cheatMs(r) });
    assert(caught.caught && caught.result === 'win' && caught.wins === 2 && caught.pot === 40 && p.yabawi.caught_total === 1 && caught.slot === null, 'V13.205 밑장빼기를 잡으면 그 판은 이긴다(×2)');
    const miss = { id: 's7', role: 'student' };
    const m = yabawiDeal(miss, { bet: 10 }, 100, { now, random: seeded(1) });
    assert(fails(() => yabawiPick(miss, { slot: null, stop: 2 }, { now: now + roundMs(m.round) }), '컵'), 'V13.205 밑장빼기가 없을 때 \'동작 그만\'은 판정이 아니다(컵을 골라야 한다)');
  }

  // 6) 10분 넘게 둔 판 정리: 첫 판이면 건 코인을 돌려주고, 이긴 판돈이 있으면 준다.
  {
    const now = Date.UTC(2026, 10, 2, 3), p = { id: 's8', role: 'student' };
    yabawiDeal(p, { bet: 20 }, 100, { now, random: seeded(2) });
    const s = yabawiDeal(p, {}, 100, { now: now + YABAWI.STALE_MS + 1 });
    assert(s.settled && s.paid === 20 && !p.yabawi.live && p.yabawi.paid === 20, 'V13.205 오래 둔 첫 판은 건 코인을 돌려준다');
    const v = yabawiView(p, now);
    assert(v.left === YABAWI.DAILY - 1 && v.live === null && v.bets.join() === '10,20,30' && !('round' in (v.live || {})), 'V13.205 화면에 보내는 상태에는 판 정보(공 자리)가 없다');
  }

  // 7) 연결: API · 잔액 · 활동 기록 · CSS · 테스트 앱에서만 보이는 카드 · 클래스 이름(야차전 yb-와 겹치지 않게 yw-).
  {
    const service = source('./service.mjs'), rewards = source('./rewards.mjs'), activity = source('./activity.mjs'), build = source('./build-assets.mjs');
    const ui = source('../public/modules/yabawi.js'), arcade = source('../public/modules/arcade.js'), css = source('../public/v13205.css');
    assert(['/yabawi/deal', '/yabawi/pick', '/yabawi/cash'].every(path => service.includes(`path === '${path}' && method === 'POST'`)) && service.includes("yabawi: yabawiView(p, now)") && service.includes("logActivity(p, 'yabawi'") && service.includes("'timing', 'yabawi'].filter(k => old[k])"),
      'V13.205 야바위 API 3개 · 보상 화면 상태 · 활동 기록 · 로그인 때 기록(받은 코인)을 지킨다');
    assert(rewards.includes('Number(p?.yabawi?.paid || 0)') && activity.includes("yabawi: { label: '야바위'") && build.includes('"v13205.css"'), 'V13.205 받은 코인은 잔액에, 활동 기록 이름, CSS 묶음');
    assert(ui.includes('export const YABAWI_LIVE = true;') && ui.includes('if (YABAWI_LIVE) return true;') && ui.includes('TEST_HOST') && /yabawiOn\(\)\s*\?\s*yabawiCard/.test(arcade), 'V13.207 야바위 카드는 운영에도 보인다(YABAWI_LIVE, 끄면 테스트 앱 · 로컬만)');
    assert(!/\.yb-/.test(css) && !/class="yb-|'yb-|data-yb/.test(ui) && css.includes('.yw-stop[hidden]{display:none}'), 'V13.205 야바위 클래스는 yw-(야차전 yb-와 겹치지 않음), 숨긴 \'동작 그만\'은 안 보인다');
    const art = source('../public/modules/yabawi-art.js');
    assert(build.includes("public/assets/yabawi") && art.startsWith('// 만든 곳: server/build-assets.mjs') && ui.includes("import { YABAWI_ART } from './yabawi-art.js'")
      && ui.includes("POSES.every(p => YABAWI_ART.has(`dealer-${p}`))") && ui.includes('그림은 야바위를 열 때만 받는다'),
      'V13.205 그림 게이트: 에셋 폴더에 있는 그림만 바꿔 끼우고(곽 사장은 8포즈가 다 있어야), 없으면 SVG · CSS. 그림은 야바위를 열 때만 받는다');
    const { YABAWI_ART } = await import('../public/modules/yabawi-art.js');
    assert(['idle', 'point', 'shuffle', 'sneak', 'grin', 'shock', 'hammer', 'sweep'].every(p => YABAWI_ART.has(`dealer-${p}`)) && ['cup', 'cup-shadow', 'ball', 'table', 'bg-room', 'card-hero'].every(n => YABAWI_ART.has(n)),
      `V13.205 에셋 v2: 곽 사장 8포즈 · 컵 · 공 · 테이블 · 배경 · 카드 그림이 들어왔다(${YABAWI_ART.size}장)`);
    for (const line of ['확실하지 않으면 승부를 걸지 마라.', '어이 젊은 친구, 신사답게 행동해.', '동작 그만', '첫 판부터 장난질이냐?', '묻고 더블로 가', '오함마']) assert(ui.includes(line), `V13.205 곽 사장 대사: ${line}`);
  }
}
