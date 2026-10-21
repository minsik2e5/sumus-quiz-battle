// V13.167 검사: 화면이 보낸 값을 덜 믿기(PR #184 안정화 점검에서 남긴 것).
// 1) 몬스터 사냥 열매: 서버가 단어 문제를 내고(정답은 안 보냄) 서버가 채점해 열매 표를 준다. 표가 있어야 열매 효과(한 공에 한 번, 재사용 · 위조 안 됨).
// 2) 던지기 품질: 최근 20번 중 엑설런트 45% · 그레이트 이상 75% 상한, 만나기 · 앞 던지기 뒤 0.8초 안의 던지기는 품질 없음. 보통 · 잘하는 학생은 거의 안 걸린다.
// 3) 짝 맞추기 의심 기록: 사람이 낼 수 없는 짝마다 시간 · 라운드 사이 · 서버 시간과 안 맞음 → 내 화면에만, 순위 · 고스트에서 빠짐, 신기록 코인 없음.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { seeded } from '../public/modules/fishing-rules.js';
import { HUNT, guardQuality } from '../public/modules/hunt-rules.js';
import { MATCH } from '../public/modules/match-rules.js';
import { huntMap, huntMeet, huntThrow, huntBerryQuiz, huntBerryAnswer } from './hunt.mjs';
import { matchStart, matchFinish, matchSuspect, matchBoard, matchGhost, matchView, MATCH_GUARD } from './games.mjs';

const source = path => readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8');
const status = fn => { try { fn(); return null; } catch (e) { return e.status || 500; } };
const WORDS = ['apple:사과', 'river:강', 'brave:용감한', 'quiet:조용한', 'storm:폭풍', 'heavy:무거운'].map((x, i) => ({ id: `w${i}`, word: x.split(':')[0], meaning: x.split(':')[1] }));

export async function runGuard167Checks(assert) {
  const t0 = Date.parse('2026-10-22T03:00:00Z');

  /* ---------- 1. 열매: 서버 문제 · 서버 채점 · 열매 표 ---------- */
  {
    const rand = seeded(7);
    const p = { pets: [{ key: 'dog' }], hunt: { basic: 6, good: 0, gold: 0 } };
    const spot = huntMap(p, t0, rand).spots[0].id, other = p.hunt.map.spots[1].id;
    assert(status(() => huntBerryQuiz(p, { spot, berry: 'razz', words: WORDS, now: t0 })) === 404, 'V13.167 만나는 중인 몬스터가 없으면 열매 문제를 내지 않는다');
    huntMeet(p, spot, t0, rand);
    const q = huntBerryQuiz(p, { spot, berry: 'razz', words: WORDS, now: t0, random: rand });
    assert(q.id && q.en && q.choices.length === 4 && new Set(q.choices).size === 4 && !('answer' in q) && !JSON.stringify(q).includes(`"${p.hunt.quiz.answer}"`) === false && q.choices.includes(p.hunt.quiz.answer)
      && Object.keys(q).sort().join() === 'berry,choices,en,id', 'V13.167 열매 문제는 서버가 낸다: 영어 + 뜻 4개(정답이 어느 것인지는 보내지 않는다)');
    assert(huntBerryQuiz(p, { spot, berry: 'pinap', words: WORDS, now: t0, random: rand }).id === q.id, 'V13.167 같은 공에서 다시 불러도 같은 문제(다시 뽑아 쉬운 단어를 고르지 못한다)');
    assert(status(() => huntBerryQuiz(p, { spot, berry: 'razz', words: WORDS.slice(0, 3), now: t0 })) === null && status(() => huntBerryQuiz({ hunt: { live: { spot: 'x', throws: 0 } } }, { spot: 'x', berry: 'razz', words: WORDS.slice(0, 3) })) === 409
      && status(() => huntBerryQuiz(p, { spot, berry: 'gold', words: WORDS })) === 400, 'V13.167 뜻이 다른 단어가 4개 안 되면 · 없는 열매면 문제를 내지 않는다');
    const wrongChoice = q.choices.find(c => c !== p.hunt.quiz.answer);
    const bad = huntBerryAnswer(p, { id: q.id, choice: wrongChoice }), badAgain = huntBerryAnswer(p, { id: q.id, choice: p.hunt.quiz.answer });
    assert(!bad.ok && !bad.ticket && badAgain === bad && !p.hunt.berry && status(() => huntBerryQuiz(p, { spot, berry: 'razz', words: WORDS })) === 409,
      'V13.167 틀리면 열매 표가 없고, 같은 문제를 다시 보내도 같은 답(고쳐 내기 안 됨), 그 공에는 다시 풀 수 없다');
    // 열매 없이 던지면(이름만 보내도) 열매 효과 없음. 다음 공에서 다시 풀 수 있다.
    const t1 = huntThrow(p, { id: 'g-throw-001', spot, ball: 'basic', berry: 'razz', now: t0 + 5000, random: () => .99 });
    assert(t1.berry === null && !t1.caught, 'V13.167 화면이 열매 이름만 보내면 열매 효과가 없다(예전: 스크립트로 늘 🍓)');
    const q2 = huntBerryQuiz(p, { spot, berry: 'razz', words: WORDS, now: t0 + 6000, random: rand });
    const good = huntBerryAnswer(p, { id: q2.id, choice: p.hunt.quiz.answer });
    assert(q2.id !== q.id && good.ok && /^b[a-z0-9]+$/.test(good.ticket) && p.hunt.berry?.berry === 'razz', 'V13.167 다음 공에서 다시 풀 수 있고, 맞히면 열매 표를 받는다');
    const forged = huntThrow(p, { id: 'g-throw-002', spot, ball: 'basic', ticket: 'bfake123', now: t0 + 9000, random: () => .99 });
    assert(forged.berry === null && !p.hunt.berry, 'V13.167 위조한 표로 던지면 열매가 없고, 던지면 진짜 표도 쓴 것이 된다');
    const q3 = huntBerryQuiz(p, { spot, berry: 'pinap', words: WORDS, now: t0 + 10000, random: rand });
    const card = huntBerryAnswer(p, { id: q3.id, choice: p.hunt.quiz.answer });
    const used = huntThrow(p, { id: 'g-throw-003', spot, ball: 'basic', ticket: card.ticket, now: t0 + 14000, random: () => .99 });
    const reuse = huntThrow(p, { id: 'g-throw-004', spot, ball: 'basic', ticket: card.ticket, now: t0 + 18000, random: () => .99 });
    assert(used.berry === 'pinap' && reuse.berry === null, 'V13.167 열매 표는 한 공에 한 번: 쓰면 다시 쓸 수 없다');
    const q4 = huntBerryQuiz(p, { spot, berry: 'razz', words: WORDS, now: t0 + 19000, random: rand });
    const moved = huntBerryAnswer(p, { id: q4.id, choice: p.hunt.quiz.answer });
    huntMeet(p, other, t0 + 20000, rand);
    const elsewhere = huntThrow(p, { id: 'g-throw-005', spot: other, ball: 'basic', ticket: moved.ticket, now: t0 + 24000, random: () => .99 });
    assert(moved.ok && elsewhere.berry === null && status(() => huntBerryAnswer(p, { id: q4.id, choice: 'x' })) === 404, 'V13.167 열매 표는 그 몬스터에게만(다른 몬스터를 만나면 사라진다)');
    const svc = source('./service.mjs'), ui = source('../public/modules/hunt.js');
    assert(svc.includes("path === '/hunt/berry' && method === 'POST'") && svc.includes("path === '/hunt/berry/answer'") && svc.includes('scopedWords(state, ctx.school.id, asked, p.class_name)') && svc.includes('ticket: body.berry_ticket')
      && !/huntThrow\([^)]*berry: body\.berry/.test(svc), 'V13.167 서버: 열매 문제는 내 학교 · 학년 범위 단어로, 던지기는 열매 표만 받는다');
    assert(ui.includes("api('/hunt/berry', { spot: H.meet.spot, berry, range_codes: arcadeWords(H.A).picked })") && ui.includes("api('/hunt/berry/answer'") && ui.includes('berry_ticket: H.berry ? H.berryTicket : null')
      && !ui.includes('answer: q.ko'), 'V13.167 화면: 문제 · 정답을 서버에서 받고, 던질 때 열매 표를 보낸다(화면에는 정답이 없다)');
  }

  /* ---------- 2. 던지기 품질 ---------- */
  {
    assert(guardQuality('excellent', [], 900) === 'excellent' && guardQuality('excellent', [], 300) === null && guardQuality('bogus' && null, [], 900) === null
      && guardQuality('excellent', Array(10).fill('excellent'), 2000) === 'nice' && guardQuality('excellent', [...Array(6).fill('excellent'), ...Array(4).fill(null)], 2000) === 'great',
      'V13.167 던지기 품질: 0.8초 안의 던지기는 품질 없음, 엑설런트가 너무 많으면 그레이트, 그레이트 이상이 너무 많으면 나이스');
    // 학생 모양 시뮬레이션: 원 밖 40 · 나이스 30 · 그레이트 20 · 엑설런트 10(보통), 아주 잘함: 15 · 25 · 35 · 25.
    const run = (dist, n = 20000, seed = 1) => {
      const r = seeded(seed), log = [];
      let changed = 0, mult = 0;
      for (let i = 0; i < n; i++) {
        const x = r(); let acc = 0, q = null;
        for (const [k, w] of dist) { acc += w; if (x < acc) { q = k; break; } }
        const g = guardQuality(q, log, 3000);
        if (g !== q) changed++;
        mult += HUNT.THROWS[g] || 1;
        log.push(q); if (log.length > HUNT.QUALITY_GUARD.WINDOW) log.shift();
      }
      return { changed: changed / n, mult: mult / n };
    };
    const normal = run([[null, .4], ['nice', .3], ['great', .2], ['excellent', .1]]), skilled = run([[null, .15], ['nice', .25], ['great', .35], ['excellent', .25]]), bot = run([['excellent', 1]]);
    assert(normal.changed === 0 && skilled.changed < .03 && bot.mult <= HUNT.THROWS.nice + .02,
      `V13.167 진짜 손맛은 그대로: 보통 학생 ${(normal.changed * 100).toFixed(2)}% · 아주 잘하는 학생 ${(skilled.changed * 100).toFixed(2)}%만 낮춰짐, 늘 엑설런트를 보내는 스크립트는 ×${bot.mult.toFixed(2)}(나이스 수준)`);
    const p = { pets: [{ key: 'dog' }], hunt: { basic: 6 } }, rand = seeded(9);
    const spot = huntMap(p, t0, rand).spots[0].id;
    huntMeet(p, spot, t0, rand);
    const quick = huntThrow(p, { id: 'g-throw-101', spot, ball: 'basic', quality: 'excellent', now: t0 + 200, random: () => .99 });
    const fine = huntThrow(p, { id: 'g-throw-102', spot, ball: 'basic', quality: 'excellent', now: t0 + 4000, random: () => .99 });
    assert(quick.quality === null && quick.claimed === 'excellent' && fine.quality === 'excellent' && p.hunt.qlog.length === 2, 'V13.167 만난 뒤 0.2초 만에 온 던지기는 품질 없음(공이 날아가는 데만 0.8초 넘게 걸린다), 보통 던지기는 그대로');
  }

  /* ---------- 3. 짝 맞추기 의심 기록 ---------- */
  {
    const G = MATCH_GUARD, n = MATCH.TOTAL_PAIRS;
    const turns = [MATCH.PAIRS, MATCH.PAIRS * 2];
    // 사람 모양: 짝 간격은 로그 정규(가운데 m, 퍼짐 sd), 첫 짝은 카드를 보느라 길고, 라운드 사이는 카드가 바뀌는 시간(0.93초) + 찾기.
    const human = (r, m, sd = .35, reduced = false) => {
      const z = () => Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r());
      const gaps = Array.from({ length: n }, (_, i) => Math.round(m * Math.exp(sd * z()) + (i === 0 ? 600 : turns.includes(i) ? (reduced ? 160 : 930) : 0)));
      let at = 0; return gaps.map(g => (at += Math.max(1, g)));
    };
    let falses = 0, tries = 0, fastest = Infinity;
    for (const [m, sd, reduced] of [[800, .35, false], [800, .35, true], [1000, .45, false], [1300, .5, false], [2000, .6, true]]) {
      const r = seeded(Math.round(m * 7 + sd * 100));
      for (let i = 0; i < 2000; i++) { const s = human(r, m, sd, reduced), t = s[n - 1]; tries++; fastest = Math.min(fastest, t); if (matchSuspect(s, t, { elapsed: t + 1500 })) falses++; }
    }
    assert(falses / tries < .005, `V13.167 빠른 실제 플레이 모양(짝마다 0.8초 ~ 2초, 움직임 줄이기 포함, 가장 빠른 판 ${(fastest / 1000).toFixed(1)}초) ${tries}판 중 ${falses}판만 의심(0.5% 미만)`);
    const even = Array.from({ length: n }, (_, i) => (i + 1) * 800), tenSec = Array.from({ length: n }, (_, i) => Math.round((i + 1) * 10000 / n));
    // 10초 스크립트(짝마다 0.45 ~ 0.65초로 흔들어 보냄)도 가운데 값이 0.6초보다 빨라서 걸린다.
    const script10 = (() => { const r = seeded(4); let at = 0; return Array.from({ length: n }, () => (at += 450 + Math.round(r() * 200))); })();
    const jitter = (() => { const r = seeded(3); let at = 0; return Array.from({ length: n }, () => (at += 800 + Math.round(r() * 30))); })();
    // 라운드가 바뀌는 짝을 0.2초로 바꾼다(both: 둘 다, one: 첫째만 → 사람도 가끔 그럴 수 있어서 의심 아님).
    const atTurn = (s, list) => { const g = s.map((v, i) => v - (i ? s[i - 1] : 0)).map((x, i) => list.includes(i) ? 200 : x); let at = 0; return g.map(x => (at += x)); };
    const base = human(seeded(5), 900), bothRound = atTurn(base, turns), oneRound = atTurn(base, [turns[0]]);
    assert(matchSuspect(even, even[n - 1], {}) === 'even' && !!matchSuspect(tenSec, 10000, {}) && !!matchSuspect(script10, script10[n - 1], {}) && matchSuspect(jitter, jitter[n - 1], {}) === 'even'
      && matchSuspect(null, 20000, {}) === 'splits' && matchSuspect(even.slice(0, 17), 20000, {}) === 'splits' && matchSuspect(even, even[n - 1] - 500, {}) === 'splits'
      && matchSuspect(bothRound, bothRound[n - 1], {}) === 'round' && matchSuspect(oneRound, oneRound[n - 1], {}) === null && matchSuspect(human(seeded(6), 900), 30000, {}) === 'splits'
      && matchSuspect(human(seeded(8), 900), human(seeded(8), 900)[n - 1], { elapsed: 80000 }) === 'clock',
      'V13.167 의심: 너무 고른 시간(스크립트) · 10초 기록 · 짝마다 시간 없음/위조 · 라운드가 바뀌는데 바로 누름 · 서버 시간과 30초 넘게 안 맞음');
    assert(G.FAST_MS <= MATCH.MIN_MS_PER_PAIR && MATCH.MIN_MS_PER_PAIR === 450 && G.CLOCK_MS === 30000, 'V13.167 고정 최소 시간(한 쌍 0.45초)은 올리지 않았다(진짜 빠른 학생이 막히지 않게)');
    // 끝내기: 의심 기록은 내 화면에만, 순위 · 고스트에서 빠지고 신기록 코인이 없다. 보통 판 코인은 그대로.
    const week = '2026-W43', school = 's1';
    const mk = (id, name) => ({ id, role: 'student', display_name: name, school_id: school, school: '수무스고', class_name: '1-1', pets: [{ key: 'dog' }], avatar_key: 'dog' });
    const cheat = mk('c1', '스크립트'), real = mk('r1', '빠른 학생'), other = mk('o1', '친구');
    const play = (p, splits, id, at, extra = 1500) => { matchStart(p, { id, now: at, weekKey: week }); const ms = splits[n - 1]; return matchFinish(p, { id, ms, misses: 0, splits, pet: 'dog', now: at + MATCH.COUNTDOWN_MS + ms + extra, weekKey: week }); };
    const realSplits = human(seeded(11), 800);
    const a = play(real, realSplits, 'm-real-1', t0), b = play(cheat, tenSec, 'm-bot-1', t0), c = play(other, human(seeded(12), 1600), 'm-oth-1', t0);
    assert(a.record && !a.unranked && a.record_coins === MATCH.RECORD_COINS && b.unranked && !b.record && b.paid && b.coins === MATCH.COINS[3] && !b.record_coins && c.record,
      'V13.167 의심 기록: 보통 판처럼 코인(별 3개 12코인)은 받고 신기록 코인은 없다. 빠른 실제 기록은 그대로 신기록');
    const profiles = [real, cheat, other];
    const board = matchBoard(profiles, other, week, { scope: 'all' }), mine = matchBoard(profiles, cheat, week, { scope: 'class' }), school_ = matchBoard(profiles, real, week, { scope: 'school', period: 'all' });
    assert(board.rows.length === 2 && board.rows[0].name === '빠른 학생' && !board.rows.some(r => r.name === '스크립트') && !school_.rows.some(r => r.name === '스크립트')
      && mine.rows.find(r => r.me)?.ms === 10000 && matchView(cheat, t0, week).best === 10000 && !cheat.games.match.r3.best && cheat.games.match.r3.sus.reason === 'fast',
      'V13.167 의심 기록은 전체 · 학교 · 반 순위에서 빠지고, 그 학생 화면(내 기록 · 내 줄)에는 남는다');
    const ghost = matchGhost(profiles, other, week), ghostMe = matchGhost(profiles, cheat, week);
    assert(ghost.name === '빠른 학생' && ghostMe && ghostMe.name !== '스크립트' && ghostMe.ms !== 10000, 'V13.167 의심 기록은 고스트로도 나오지 않는다');
    const later = play(cheat, human(seeded(13), 1500), 'm-bot-2', t0 + 60000);
    assert(later.record && !later.unranked && matchBoard(profiles, other, week).rows.some(r => r.name === '스크립트' && r.ms === later.ms) && matchView(cheat, t0, week).best === 10000,
      'V13.167 의심 기록 뒤에도 그 학생의 보통 기록은 순위에 들어간다(내 화면 최고는 더 빠른 쪽)');
    const ui = source('../public/modules/match-game.js');
    assert(ui.includes('res?.unranked') && ui.includes('순위에는 확인된 기록만 올라가요'), 'V13.167 짝 맞추기 결과: 의심 기록이면 "이 기록은 내 화면에만 남아요" 안내(꾸짖지 않게)');
  }
}
