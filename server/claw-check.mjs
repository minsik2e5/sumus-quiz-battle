// V13.180 검사: 인형뽑기(놀이터). 구성안 docs/claw-machine-design.md(선생님 승인 추천안) §12의 검사 목록.
// 규칙 숫자, 판 배치(판 id → 같은 배치), 서버 판정(조준 · 잡힘 · 놓침 · 대박), 영수증, 부정 방지(차례 · 최소 시간 · 마감 · 조준 비율 상한),
// 연속 실패 보정, 하루 코인 상한, 집게권(공부로만 · 곳마다 하루 1장 · 보관 6장), 밸런스(하루 가치 열심 약 26 · 보통 약 8),
// 칭호 · rewardIncome, 그림 게이트(claw-art.js), 활동 기록, 저장 크기, 펫 경제(펫 · 알이 늘지 않음), 화면 연결.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dayKey } from '../public/modules/core.js';
import { CLAW, DOLL_KEYS, DOLLS, roundLayout, roundEnds, touchAt, grabChance, guardAim, rollDrop, nextPity, clawOpen, clawSimAverage, clawDayValue, CLAW_TITLE_COINS } from '../public/modules/claw-rules.js';
import { CLAW_DOLLS, CLAW_ART } from '../public/modules/claw-art.js';
import { grantClaw, clawView, clawStart, clawDrop, clawActivityText, clawTitleStats } from './claw.mjs';
import { TITLES, titleCoins, titleUnlocked } from '../public/modules/titles.js';
import { rewardIncome } from './rewards.mjs';
import { publicProfile } from './auth.mjs';
import { emptyState } from './state.mjs';
import { passwordHash } from './auth.mjs';
import { service } from './service.mjs';

const source = path => readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8');
const throws = fn => { try { fn(); return null; } catch (e) { return e.status || 500; } };
const DAY = 86400000;
const seq = list => { const r = [...list]; return () => r.length ? r.shift() : 0.5; };
const student = () => ({ id: 's', role: 'student', pets: [{ key: 'dog' }] });

export async function runClawChecks(assert) {
  const t0 = Date.parse('2026-10-27T03:00:00Z');

  /* ---------- 1. 규칙 숫자(선생님 승인 추천안) ---------- */
  assert(CLAW.TIME === 30 && CLAW.DOLLS === 20 && CLAW.DROPS === 3 && CLAW.GRAB.perfect === 38 && CLAW.GRAB.good === 26 && CLAW.GRAB.edge === 10
    && CLAW.PITY === 5 && CLAW.PITY_MAX === 20 && CLAW.GOLD_ROUND === 25 && CLAW.GOLD_X === 0.5 && CLAW.JACKPOT === 4,
    'V13.180 한 판: 30초 · 인형 20개 · 집게 3번, 잡힐 확률 38 · 26 · 10%, 놓칠 때마다 +5%p(최대 20), 황금 인형 판마다 25%(×0.5), 대박 4%');
  assert(CLAW.COIN === 6 && CLAW.GOLD_COIN === 20 && CLAW.COIN_DAILY === 30 && CLAW.BOOK_BONUS === 100 && CLAW.SOURCES.join() === 'practice,attend,match' && CLAW.TICKET_MAX === 6 && CLAW.MIN_PRACTICE === 10,
    'V13.180 보상: 인형 6 · 황금 20 · 하루 30코인 · 도감 완성 100, 집게권은 연습 끝내기 · 출석 · 짝 맞추기 별 3에서 곳마다 하루 1장, 6장까지');
  assert(DOLL_KEYS.length === 12 && DOLL_KEYS.every(k => DOLLS[k]?.ko) && DOLLS.rat.ko === '쪼꼬 쥐' && DOLLS.pig.ko === '꿀꿀 돼지', 'V13.180 인형 12종 = 12지 동물(이름은 추천안)');

  /* ---------- 2. 배치 ---------- */
  {
    const a = roundLayout('r-aaaa1111'), b = roundLayout('r-aaaa1111'), c = roundLayout('r-bbbb2222');
    assert(JSON.stringify(a) === JSON.stringify(b) && JSON.stringify(a) !== JSON.stringify(c) && a.length === CLAW.DOLLS && a.every((d, i) => d.i === i && DOLL_KEYS.includes(d.k)),
      'V13.180 같은 판 id → 같은 배치, 다른 id → 다른 배치(20개)');
    let golds = 0;
    for (let i = 0; i < 400; i++) { const l = roundLayout(`r-gold-${i}`); const g = l.filter(d => d.g); assert(g.length <= 1 && g.every(d => d.z === 2), 'V13.180 황금 인형은 판마다 0~1개, 맨 위층'); golds += g.length; }
    assert(golds > 400 * 0.18 && golds < 400 * 0.32, `V13.180 황금 인형이 있는 판은 약 25% (${golds}/400)`);
    const some = roundLayout('r-only-two', ['rat', 'ox']);
    assert(some.every(d => d.k === 'rat' || d.k === 'ox'), 'V13.180 그림이 있는 인형만 배치한다(그림 게이트)');
    assert(a.every(d => !(d.x < 0.34 && d.y > 0.25)), 'V13.180 앞 왼쪽 배출구 자리에는 인형을 두지 않는다');
  }

  /* ---------- 3. 판정 ---------- */
  {
    const dolls = [{ i: 0, k: 'rat', g: 0, x: 0.5, y: 0.5, z: 0, s: 1 }, { i: 1, k: 'ox', g: 0, x: 0.52, y: 0.5, z: 1, s: 1 }];
    const R = CLAW.R;
    assert(touchAt(dolls, 0.52, 0.5).doll.i === 1 && touchAt(dolls, 0.52, 0.5).aim === 'perfect', 'V13.180 겹치면 맨 위층 인형이 먼저 닿는다');
    assert(touchAt(dolls, 0.52, 0.5, 2).doll.i === 0, 'V13.180 뽑힌 인형은 다음 집게에 없다');
    const one = [{ i: 0, k: 'rat', g: 0, x: 0.5, y: 0.5, z: 0, s: 1 }];
    assert(touchAt(one, 0.5 + R * 0.34, 0.5).aim === 'perfect' && touchAt(one, 0.5 + R * 0.36, 0.5).aim === 'good' && touchAt(one, 0.5 + R * 0.69, 0.5).aim === 'good'
      && touchAt(one, 0.5 + R * 0.71, 0.5).aim === 'edge' && touchAt(one, 0.5 + R * 0.99, 0.5).aim === 'edge' && touchAt(one, 0.5 + R * 1.02, 0.5).aim === 'miss',
      'V13.180 조준 경계: 0.35 · 0.7 · 1.0 × 반지름');
    assert(grabChance('perfect') === 0.38 && grabChance('good') === 0.26 && grabChance('edge') === 0.1 && grabChance('miss') === 0
      && Math.abs(grabChance('perfect', { pity: 20 }) - 0.58) < 1e-9 && Math.abs(grabChance('edge', { pity: 20 }) - 0.2) < 1e-9 && Math.abs(grabChance('perfect', { gold: true }) - 0.19) < 1e-9,
      'V13.180 잡힐 확률 · 보정(edge는 절반) · 황금 ×0.5');
    assert(rollDrop('perfect', {}, 0.37, 0.5, 0.5).result === 'win' && rollDrop('perfect', {}, 0.39, 0.5, 0.5).result === 'slip' && rollDrop('miss', {}, 0, 0, 0).result === 'miss'
      && rollDrop('good', {}, 0.1, 0.5, 0.03).jackpot && !rollDrop('good', {}, 0.1, 0.5, 0.05).jackpot
      && rollDrop('good', {}, 0.9, 0.1, 0.5).slip === 'lift' && rollDrop('good', {}, 0.9, 0.7, 0.5).slip === 'chute' && rollDrop('good', {}, 0.9, 0.9, 0.5).slip === 'loose',
      'V13.180 잡힘 · 놓침(미끄러짐 60 · 배출구 앞 15 · 빠짐 25%) · 대박 4%는 서버 난수로 정한다');
    assert(nextPity(0, 'slip') === 5 && nextPity(15, 'slip') === 20 && nextPity(20, 'slip') === 20 && nextPity(20, 'win') === 0 && nextPity(10, 'miss') === 10, 'V13.180 연속 실패 보정: 놓칠수록 오르고(최대 20), 뽑으면 0');
  }

  /* ---------- 4 · 5. 영수증 · 부정 방지 ---------- */
  {
    const p = student();
    assert(throws(() => clawStart(p, { id: 'r-noticket1', now: t0 })) === 409, 'V13.180 집게권이 없으면 시작할 수 없다');
    p.claw = { t: 2 };
    const s1 = clawStart(p, { id: 'r-round0001', now: t0 }), s2 = clawStart(p, { id: 'r-round0001', now: t0 + 100 });
    assert(p.claw.t === 1 && s2.again && s2.round.id === 'r-round0001', 'V13.180 판 시작은 영수증으로 한 번(같은 판 id를 다시 보내도 집게권은 한 장)');
    const s3 = clawStart(p, { id: 'r-round0002', now: t0 + 200 });
    assert(s3.resumed && s3.round.id === 'r-round0001' && p.claw.t === 1, 'V13.180 판은 하나만 열린다(열린 판을 돌려준다)');
    const top = s1.round.dolls.find(d => d.z === 2);
    const fast = clawDrop(p, { id: 'd-fast-0001', round: 'r-round0001', n: 0, x: top.x, y: top.y, now: t0 + 500, random: () => 0 });
    assert(fast.fast && fast.aim === 'miss' && fast.result === 'miss', 'V13.180 시작 뒤 1.2초보다 빠른 첫 집게는 조준 없음(miss)');
    assert(throws(() => clawDrop(p, { id: 'd-skip-0001', round: 'r-round0001', n: 2, x: 0.5, y: 0.5, now: t0 + 9000 })) === 409, 'V13.180 집게 번호를 건너뛰면 거절');
    const again = clawDrop(p, { id: 'd-fast-0001', round: 'r-round0001', n: 0, x: 0.5, y: 0.5, now: t0 + 9000 });
    assert(again.again && p.claw.r.n === 1, 'V13.180 같은 집게 번호를 다시 보내면 저장한 결과(집게를 또 쓰지 않는다)');
    const quick = clawDrop(p, { id: 'd-quick-001', round: 'r-round0001', n: 1, x: top.x, y: top.y, now: t0 + 2500, random: () => 0 });
    assert(quick.fast && quick.result === 'miss', 'V13.180 앞 집게 뒤 4초보다 빠른 집게도 조준 없음');
    const late = p.claw.r.at;
    assert(throws(() => clawDrop(p, { id: 'd-late-0001', round: 'r-round0001', n: 2, x: 0.5, y: 0.5, now: roundEnds(late) + 1 })) === 409 && !p.claw.r, 'V13.180 판 마감 뒤 집게는 거절하고 판을 닫는다');
    assert(throws(() => clawDrop(p, { id: 'd-none-0001', round: 'r-round0001', n: 0, x: 0.5, y: 0.5, now: t0 })) === 409, 'V13.180 열린 판 없이 집게는 거절');
    assert(throws(() => clawDrop(p, { id: 'x', round: 'r', n: 0, x: 0, y: 0, now: t0 })) === 400 && throws(() => clawStart(p, { id: 'bad id!', now: t0 })) === 400, 'V13.180 판 · 집게 번호 모양 확인');
  }

  /* ---------- 6. 조준 비율 상한 ---------- */
  {
    assert(guardAim('perfect', 'ppp') === 'perfect' && guardAim('perfect', 'p'.repeat(20)) === 'edge' && guardAim('perfect', 'ppppppgggeeemmmmmmmm') === 'perfect'
      && guardAim('perfect', 'ppppppppppppppgeemmm') === 'good' && guardAim('perfect', 'pppppppppppppgeemmmm') === 'perfect'
      && guardAim('good', 'gggggggggggggggggggp') === 'edge' && guardAim('good', 'ggggggggggggggggggem') === 'good' && guardAim('edge', 'p'.repeat(20)) === 'edge',
      'V13.180 조준 비율 상한: 최근 20번 중 perfect 70% 이상 → good, perfect + good 95% 이상 → edge(8번 전에는 보지 않음)');
    // 늘 한가운데를 보내는 스크립트 vs 보통 · 잘하는 학생.
    const run = pick => { let log = '', down = 0; for (let i = 0; i < 400; i++) { const a = pick(i); const g = guardAim(a, log); if (g !== a) down++; log = (log + ({ perfect: 'p', good: 'g', edge: 'e', miss: 'm' })[a]).slice(-20); } return down / 400; };
    const bot = (() => { let log = '', perfect = 0; for (let i = 0; i < 400; i++) { const g = guardAim('perfect', log); if (g === 'perfect') perfect++; log = (log + 'p').slice(-20); } return perfect / 400; })();
    const r = (s => () => (s = (s * 16807) % 2147483647) / 2147483647)(7);
    const normal = run(() => { const x = r(); return x < 0.2 ? 'perfect' : x < 0.55 ? 'good' : x < 0.8 ? 'edge' : 'miss'; });
    const good = run(() => { const x = r(); return x < 0.4 ? 'perfect' : x < 0.75 ? 'good' : x < 0.9 ? 'edge' : 'miss'; });
    assert(CLAW.GUARD.PERFECT === 0.7 && CLAW.GUARD.TOP === 0.95 && bot <= 0.6 && normal < 0.01 && good < 0.05, `V13.180 좌표를 꾸며 늘 한가운데를 보내도 perfect는 ${Math.round(bot * 100)}%로 깎이고, 보통(${normal}) · 잘하는 학생(${good})은 거의 걸리지 않는다`);
  }

  /* ---------- 7 · 8. 연속 실패 보정 · 하루 코인 · 도감 ---------- */
  {
    const p = student(); p.claw = { t: 6 };
    let now = t0, n = 0;
    const play = (rand, xy = null) => {
      const s = clawStart(p, { id: `r-play-${n++}`, now });
      const out = [];
      for (let k = 0; k < CLAW.DROPS; k++) {
        now += 5000;
        const top = s.round.dolls.filter(d => !((p.claw.r?.w || 0) >> d.i & 1)).sort((a, b) => b.z - a.z)[0];
        out.push(clawDrop(p, { id: `d-play-${n}-${k}`, round: s.round.id, n: k, x: xy ? xy[0] : top.x, y: xy ? xy[1] : top.y, now, random: rand }));
      }
      now += 5000;
      return out;
    };
    const lose = play(seq([0.99, 0.1, 0.5, 0.99, 0.1, 0.5, 0.99, 0.1, 0.5]));
    assert(lose.every(r => r.result === 'slip') && p.claw.m === 15 && lose[2].summary && lose[2].summary.won.length === 0 && !p.claw.r, 'V13.180 놓칠수록 보정이 오르고(15), 판이 바뀌어도 이어진다');
    const win = play(() => 0.01);
    assert(win.every(r => r.result === 'win') && p.claw.m === 0 && win[0].coins > 0 && win[2].summary.won.length >= 3, 'V13.180 뽑으면 보정 0, 인형마다 코인');
    assert(p.claw.ct <= CLAW.COIN_DAILY && clawView(p, now).coin_today === p.claw.ct, 'V13.180 하루 코인 30 상한');
    const before = p.claw.n;
    play(() => 0.01);
    assert(p.claw.n > before && p.claw.ct === CLAW.COIN_DAILY, 'V13.180 상한 뒤에도 인형 · 도감은 늘고 코인만 0');
    now = t0 + DAY;
    const next = play(() => 0.01);
    assert(next[0].coins > 0 && p.claw.cd === dayKey(now), 'V13.180 다음 날 다시 코인을 받는다');
    // 도감 완성 보너스(한 번).
    const q = student(); q.claw = { t: 1, b: DOLL_KEYS.map((_, i) => i < 11 ? 1 : 0) };
    const s = clawStart(q, { id: 'r-complete1', now: t0 });
    const last = s.round.dolls.find(d => !d.g);
    const before2 = { ...s.round.dolls[last.i] };
    q.claw.r.keys = ['pig'];
    const res = clawDrop(q, { id: 'd-complete1', round: 'r-complete1', n: 0, x: before2.x, y: before2.y, now: t0 + 2000, random: () => 0.01 });
    assert(res.result === 'win' && res.complete && res.coins >= CLAW.BOOK_BONUS && q.claw.bonus === 1 && clawView(q, t0).kinds === 12, 'V13.180 12종을 모으면 도감 완성 100코인(한 번)');
  }

  /* ---------- 9. 집게권 ---------- */
  {
    const p = student();
    assert(grantClaw(p, 'practice', { now: t0 }) && !grantClaw(p, 'practice', { now: t0 + 1000 }) && grantClaw(p, 'attend', { now: t0 }) && grantClaw(p, 'match', { now: t0 }) && !grantClaw(p, 'nope', { now: t0 }) && p.claw.t === 3,
      'V13.180 집게권: 곳마다 하루 1장(하루 최대 3장), 모르는 곳은 안 준다');
    grantClaw(p, 'practice', { now: t0 + DAY }); grantClaw(p, 'attend', { now: t0 + DAY }); grantClaw(p, 'match', { now: t0 + DAY });
    assert(p.claw.t === 6 && !grantClaw(p, 'practice', { now: t0 + 2 * DAY }) && p.claw.t === 6 && clawView(p, t0 + 2 * DAY).got.practice === false, 'V13.180 다음 날 다시 받고(이월), 6장이 차면 더 받지 않는다');
    assert(!grantClaw({ role: 'teacher' }, 'attend', { now: t0 }), 'V13.180 선생님은 받지 않는다');
    const svc = source('./service.mjs'), games = source('./games.mjs');
    assert(svc.includes("const clawTicket = grantClaw(p, 'attend', { now });") && svc.includes("answerRecords.length >= CLAW.MIN_PRACTICE && grantClaw(student, 'practice', { now: finalizedAt })")
      && games.includes("const clawTicket = stars === 3 && grantClaw(p, 'match', { now });") && svc.includes("claw_ticket: x.finished ? !!x.claw_ticket : undefined"),
      'V13.180 집게권 연결: 출석 · 끝까지 푼 연습(10문제 이상) · 짝 맞추기 별 3(몬스터 사냥 공 옆)');
  }

  /* ---------- 10. 밸런스 ---------- */
  {
    const hard = clawSimAverage({ rounds: 3, aim: [0.4, 0.35, 0.15] }, 1500), easy = clawSimAverage({ rounds: 1, aim: [0.2, 0.35, 0.25] }, 1500);
    const hv = clawDayValue(hard), ev = clawDayValue(easy);
    assert(hv >= 20 && hv <= 32 && ev >= 5 && ev <= 11, `V13.180 하루 가치(30일): 열심 ${hv} · 보통 ${ev}코인(목표 열심 20~32 · 보통 5~11, 사냥 · 낚시의 약 ¼)`);
    assert(hard.complete > 0.85 && hard.dolls / 90 > 0.75 && hard.dolls / 90 < 1, `V13.180 열심이면 한 달 안에 도감 완성(${hard.complete}), 판당 인형 약 0.86개(${Math.round(hard.dolls / 90 * 100) / 100})`);
  }

  /* ---------- 11. 칭호 · 코인 ---------- */
  {
    const keys = ['claw1', 'claw6', 'claw12', 'clawgold', 'claw100'];
    assert(keys.every(k => TITLES[k]?.group === 'arcade') && keys.every(k => titleCoins(k) === CLAW_TITLE_COINS[k])
      && TITLES.claw1.stat === 'claw_dolls' && TITLES.claw100.goal === 100 && TITLES.claw12.stat === 'claw_kinds' && TITLES.claw12.goal === 12 && TITLES.clawgold.stat === 'claw_gold',
      'V13.180 칭호 5개(첫 인형 · 인형 수집가 · 인형뽑기 장인 · 황금 손 · 집게의 전설), 코인은 등급 코인(시뮬레이션과 같다)');
    const p = { claw: { n: 100, b: DOLL_KEYS.map(() => 1), ng: 1, coins: 77 } }, st = clawTitleStats(p);
    assert(keys.every(k => titleUnlocked(k, st)) && !titleUnlocked('claw6', clawTitleStats({ claw: { b: [1, 1, 1, 1, 1] } })) && rewardIncome(p) === 77,
      'V13.180 칭호는 p.claw에서 세고, 인형 코인은 rewardIncome(p.claw.coins)에 들어간다');
    assert(source('./competition.mjs').includes('claw_kinds: p => clawTitleStats(p).claw_kinds'), 'V13.180 칭호 stat 연결(competition.mjs)');
  }

  /* ---------- 12. 그림 게이트 ---------- */
  {
    assert(!clawOpen(new Set(), new Set()) && !clawOpen(new Set(['rat', 'ox', 'tiger', 'rabbit', 'dragon']), new Set(['machine', 'claw-open', 'claw-closed', 'claw-grip-back', 'claw-grip-front']))
      && clawOpen(new Set(['rat', 'ox', 'tiger', 'rabbit', 'dragon', 'snake']), new Set(['machine', 'claw-open', 'claw-closed', 'claw-grip-back', 'claw-grip-front']))
      && !clawOpen(new Set(DOLL_KEYS), new Set(['machine'])), 'V13.180 그림 게이트: 기계 · 집게 그림과 인형 6종 이상이 있어야 열린다');
    assert(CLAW_DOLLS.size === 12 && clawOpen() && CLAW_ART.has('entry') && !CLAW_ART.has('preview-42'), 'V13.180 지금 그림(주문서 42 ~ 45)이 다 들어와 있다(미리보기 그림은 앱에 넣지 않는다)');
    const build = source('./build-assets.mjs'), games = source('../public/modules/arcade-games.js');
    assert(build.includes("public/modules/claw-art.js") && build.includes("['', '-grab', '-fall', '-joy'].every") && build.includes('"v13181.css"'), 'V13.180 build:assets가 그림 폴더를 보고 claw-art.js를 만든다');
    const { clawCard } = await import('../public/modules/arcade-games.js');
    const html = clawCard({ data: { rewards: { claw: { open: false, tickets: 2, kinds: 3, all: 12 } } } }, {});
    assert(html.includes('곧 열려요') && html.includes('disabled') && !html.includes('/assets/claw/entry.webp') && games.includes('${clawCard(A, art)}'),
      'V13.180 그림 게이트가 닫히면 놀이터 카드는 "곧 열려요"(그림 없이도 깨지지 않는다)');
    const prev = student();
    assert(throws(() => clawStart(prev, { id: 'r-gate0001', now: t0 })) === 409, 'V13.180 집게권이 없거나 닫혀 있으면 시작은 409');
  }

  /* ---------- 13 · 14 · 15. 서버 경로 · 활동 기록 · 저장 크기 · 펫 경제 ---------- */
  {
    const state = emptyState(), hash = await passwordHash('QaClaw1!'), now = Date.now();
    state.profiles.push({ id: 'qa-claw', username: 'qa-claw', display_name: '집게', role: 'student', active: true, class_name: '고1A', school_id: 'danwon-high', school: '단원고', division: 'high', password_hash: hash, pets: [{ key: 'dog', first: true, acquired_at: now - 9 * DAY }], avatar_key: 'dog', created_at: now - 9 * DAY });
    const token = (await service(state, 'POST', '/login', { username: 'qa-claw', password: 'QaClaw1!', division: 'high' }, null))._cookie;
    const call = (method, path, body = {}) => service(state, method, path, body, token);
    const me = state.profiles.find(x => x.id === 'qa-claw');
    const boot = await call('GET', '/bootstrap');
    assert(boot.rewards.claw && boot.rewards.claw.tickets === 0 && boot.rewards.claw.open === true && !('claw' in (boot.profile || {})), 'V13.180 홈 데이터에 인형뽑기 보기가 오고, 프로필에는 기록을 싣지 않는다');
    const att = await call('POST', '/attendance/check');
    assert(att.claw_ticket === true && att.claw.tickets === 1 && att.claw.got.attend, 'V13.180 출석하면 집게권 1장');
    const pets = me.pets.length;
    const st = await call('POST', '/claw/start', { id: 'r-qa-000001' });
    me.claw.r.at -= 3000; me.claw.r.last -= 3000;
    const top = st.round.dolls.find(d => d.z === 2);
    let dropped = null;
    for (let k = 0; k < CLAW.DROPS; k++) {
      dropped = await call('POST', '/claw/drop', { id: `d-qa-00000${k}`, round: st.round.id, n: k, x: top.x, y: top.y });
      if (me.claw.r) { me.claw.r.last -= 5000; }
    }
    const again = await call('POST', '/claw/drop', { id: 'd-qa-000002', round: st.round.id, n: 2, x: top.x, y: top.y });
    const logs = (me.activity || []).filter(x => x.k === 'claw');
    assert(dropped.end && dropped.summary && again.again && logs.length === 1 && logs[0].t.startsWith('인형뽑기'), 'V13.180 판이 끝나면 활동 기록 한 줄(다시 보내도 한 줄)');
    assert(me.pets.length === pets && !(me.purchases || []).some(x => x.item === 'claw'), 'V13.180 인형뽑기에서는 펫 · 알이 절대 늘지 않는다(펫 경제)');
    const { done, ...rest } = me.claw;
    assert(JSON.stringify(rest).length <= 600 && !('claw' in publicProfile(me)), `V13.180 저장 크기: p.claw 영수증 빼고 ${JSON.stringify(rest).length}바이트(600 이하), publicProfile에 없음`);
    assert(clawActivityText({ won: [{ k: 'rabbit', g: 0 }, { k: 'dragon', g: 1 }], drops: 3 }) === '인형뽑기 2개 (토끼 · 황금 용)' && clawActivityText({ won: [], drops: 3 }) === '인형뽑기 꽝(집게 3번)', 'V13.180 활동 기록 문구');
    const svc = source('./service.mjs');
    assert(svc.includes("logActivity(p, 'claw', clawActivityText(res.summary), now)") && svc.includes("'games', 'claw', 'reel', 'hunt', 'blank'") && svc.includes('clawPreviewFill(preview);'),
      'V13.180 활동 기록 · 로그인 때 기록 지키기 · 교사 미리보기 집게권');
  }

  /* ---------- 화면 ---------- */
  {
    const ui = source('../public/modules/claw.js'), app = source('../public/app.js'), css = source('../public/v13181.css'), seed = source('./test-seed.mjs');
    assert(ui.includes("api('/claw/start'") && ui.includes("api('/claw/drop'") && ui.includes('clawPic(\'grip\', doll)') && ui.includes('function prizeOut(') && ui.includes('function slipLift(')
      && ui.includes('function bindStick()') && ui.includes("e.key === ' ' || e.key === 'Enter'") && ui.includes('function book()') && ui.includes('function toggleZoom()'),
      'V13.180 화면: 서버 판정을 받아 연출(쥠 뒤 · 앞 발톱 층, 상품 문, 놓침), 조이스틱 · 키보드, 도감, 확대');
    assert(app.includes("d.action === 'claw-open'") && css.includes('.cw-app{') && css.includes('prefers-reduced-motion') && seed.includes('CLAW: 6'), 'V13.180 놀이터 연결 · 스타일 · 테스트 앱 집게권');
  }
}
