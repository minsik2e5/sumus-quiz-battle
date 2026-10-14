// V13.149 연속 학습 보호권 · 짝 맞추기 타임어택 · 단어 낚시 · 교실 게임(보물 사냥 · 반 전체 낚시) 검사. release-check가 부른다.
// 방(cloudflare/party-room.mjs) 자체는 server/party-room-check.mjs(cloudflare-check)가 본다.
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { emptyState } from './state.mjs';
import { passwordHash } from './auth.mjs';
import { service } from './service.mjs';
import { DAY_MS, createCompetition } from './competition.mjs';
import { growthFor, dayKey } from '../public/modules/core.js';
import { STREAK_GUARD, guardPlan, guardView, guardDayKeys, dayNum } from '../public/modules/streak-guard.js';
import { MATCH, matchPick, matchStars, cardMeaning } from '../public/modules/match-rules.js';
import { FISH, FISH_KEYS, LURES, rollCast } from '../public/modules/fishing-rules.js';
import { REEL, FIGHT, reelRoll, pearlsOf } from '../public/modules/reel-rules.js';
import { grantBait, reelCast, reelLand } from './reel.mjs';
import { fishSvg, FISH_ART } from '../public/modules/fishing-art.js';
import { addBonus } from './rewards.mjs';
import { PARTY, CHESTS, createParty, joinParty, startParty, answer, pick, target, tick, tvView, playerView, awards, partyCoins, partyReport, ranked } from './party-engine.mjs';
import { settleParty } from './party.mjs';

const source = path => readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8');
const lcg = seed => () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };

export async function runGamesChecks(assert) {
  // V13.149 그림 26 · 27: 코드가 쓰는 그림 파일이 모두 있어야 한다(없으면 빈 그림).
  {
    const pub = new URL('../public/', import.meta.url);
    assert(FISH_KEYS.every(k => FISH_ART.has(k) && existsSync(new URL(`assets/fish/${k}.webp`, pub)) && existsSync(new URL(`assets/fish/${k}-hang.webp`, pub))), 'V13.149 물고기 그림(26) · 매달린 그림(27) 24종');
    const reelSrc = readFileSync(new URL('modules/reel.js', pub), 'utf8');
    const names = [...reelSrc.match(/FISHING_ART = new Set\(\[([\s\S]*?)\]\)/)[1].matchAll(/'([a-z0-9-]+)'/g)].map(m => m[1]);
    assert(names.length >= 30 && names.every(n => existsSync(new URL(`assets/fishing/${n}.webp`, pub))), 'V13.149 낚시 그림(27) 파일이 모두 있다');
    assert(!existsSync(new URL('assets/fishing/preview-27.png', pub)), 'V13.149 미리보기 시트는 앱에 싣지 않는다');
    // 알을 받을 때 아기 모습까지 보여 준다: 영웅 · 한정 · 전설(lucky.js) 2곳, 일반 알(pet-moments.js) 1곳.
    const lucky = readFileSync(new URL('modules/lucky.js', pub), 'utf8'), moments = readFileSync(new URL('modules/pet-moments.js', pub), 'utf8'), growth = readFileSync(new URL('modules/pet-growth.js', pub), 'utf8');
    assert((lucky.match(/\$\{growthStrip\(key, name\)\}/g) || []).length === 2 && moments.includes('${growthStrip(key, name)}') && growth.includes("form === 1 ? ' baby'") && !lucky.includes('뒤에 비치는 모습으로'), 'V13.149 알 공개에 알 → 아기 → 성장 → 최종');
  }
  const now = Date.now(), DAY = DAY_MS;
  const at = d => now - d * DAY;
  const studied = days => days.map(d => ({ id: `s${d}`, created_at: at(d), total: 10, answered_count: 10, correct: 10, xp: 10 }));

  /* ---------- 연속 학습 보호권 ---------- */
  {
    const two = { log: [{ at: at(9) }, { at: at(8) }] };
    let s = studied([10, 9, 8, 7, 6, 5, 4, 3]);
    let v = guardView(s, two, now);
    assert(v.used_total === 2 && v.held === 0 && v.saved_yesterday && growthFor(s, guardDayKeys(s, two, now)).streak === 10 && growthFor(s).streak === 0,
      'V13.149 보호권: 이틀 빠지면 보호권 2장이 그 이틀을 메워 연속이 이어진다(보호권 없이는 끊긴다)');
    s = studied([10, 9, 8, 7, 6, 5, 4]);
    v = guardView(s, two, now);
    assert(v.used_total === 0 && v.held === 2, 'V13.149 보호권: 빠진 날을 다 메우지 못하면(사흘 빠짐, 2장) 한 장도 쓰지 않고 남긴다');
    s = studied([8, 7, 6, 4, 3, 2, 1]);
    v = guardView(s, { log: [{ at: at(9) }] }, now);
    assert(v.used_total === 1 && v.recent.length === 1 && growthFor(s, guardDayKeys(s, { log: [{ at: at(9) }] }, now)).streak === 8, 'V13.149 보호권: 지난 빈칸(하루)은 그 전에 받은 보호권으로 메운다');
    s = studied([6, 5, 4, 3]);
    v = guardView(s, { log: [{ at: at(1) }] }, now);
    assert(v.used_total === 0 && v.held === 1, 'V13.149 보호권: 빠진 날 뒤에 받은 보호권은 그날을 메우지 않는다');
    const capped = guardPlan(new Set(), { log: [{ at: at(5) }, { at: at(4) }, { at: at(3) }] }, now);
    assert(capped.held === STREAK_GUARD.MAX, `V13.149 보호권은 ${STREAK_GUARD.MAX}장까지만 가진다`);
    // 되살리기: 어제가 비었고 그 앞까지 3일 이상 → 제안, 되살린 뒤에는 이어지고, 30일 안에는 다시 없다.
    s = studied([5, 4, 3, 2]);
    v = guardView(s, {}, now);
    assert(v.repair?.run === 4 && v.repair.need === STREAK_GUARD.REPAIR_NEED && v.repair.day === dayKey(at(1)), 'V13.149 되살리기: 어제 끊긴 3일 이상 연속은 오늘 20문제로 되살릴 수 있다고 알려 준다');
    const fixed = { repairs: [{ at: now, day: dayNum(at(1)) }] };
    const withToday = [...s, { id: 'today', created_at: now, total: 20, answered_count: 20 }];
    assert(guardView(withToday, fixed, now).repaired_today && growthFor(withToday, guardDayKeys(withToday, fixed, now)).streak === 6, 'V13.149 되살리기: 되살린 날은 연속에 들어간다');
    assert(!guardView(studied([6, 5, 4, 3, 2]), { repairs: [{ at: at(10), day: 1 }] }, now).repair && !guardView(studied([4, 3, 2]).slice(0, 2), {}, now).repair,
      'V13.149 되살리기는 30일에 한 번, 3일 이상 이어 온 연속만');
    // 연속 칭호(best_days)도 보호권 날을 센다.
    const state = { profiles: [{ id: 'g1', role: 'student', streak_guard: two }], sessions: studied([10, 9, 8, 7, 6, 5, 4, 3]).map(x => ({ ...x, student_id: 'g1' })), battles: [], mastery: {}, examAttempts: [], schools: [], tournaments: [] };
    assert(createCompetition(state, now).titleStats(state.profiles[0]).best_days === 10, 'V13.149 연속 칭호도 보호권으로 이은 날을 센다');
    const svc = source('./service.mjs');
    assert(svc.includes('growthFor(all, guardDayKeys(sessions, p.streak_guard))') && svc.includes('growthFor(records, guardDayKeys(records, s.streak_guard))') && svc.includes('guardDayKeys(previous, student?.streak_guard, endedAt)'),
      'V13.149 홈 연속 · 연속 학습 순위 · 3일/7일 연속 코인이 모두 보호권 날을 센다');
  }

  /* ---------- 서버: 보호권 사기 · 출석 · 짝 맞추기 · 낚시 ---------- */
  const state = emptyState();
  const hash = await passwordHash('QaGames1!');
  const student = (id, name, extra = {}) => ({ id, username: id, display_name: name, role: 'student', active: true, class_name: '고1A', school_id: 'danwon-high', school: '단원고', division: 'high', password_hash: hash, pets: [{ key: 'dog', first: true, acquired_at: now - 9 * DAY }], avatar_key: 'dog', created_at: now - 9 * DAY, ...extra });
  state.profiles.push(
    { id: 'qa-gm-teacher', username: 'qa_gm_teacher', display_name: '게임 선생님', role: 'teacher', active: true, password_hash: hash, school_ids: ['danwon-high'], division_ids: ['high'], active_division: 'high', active_school_id: 'danwon-high', created_at: now - 9 * DAY },
    student('qa-gm-a', '가람'), student('qa-gm-b', '나무'), student('qa-gm-c', '다솜'), student('qa-gm-d', '라온', { class_name: '고1B' })
  );
  const tokens = {};
  for (const id of ['qa_gm_teacher', 'qa-gm-a', 'qa-gm-b', 'qa-gm-c', 'qa-gm-d']) tokens[id] = (await service(state, 'POST', '/login', { username: id, password: 'QaGames1!', division: 'high', role: id.includes('teacher') ? 'teacher' : undefined }, null))._cookie;
  const prof = id => state.profiles.find(p => p.id === id);
  const call = (id, method, path, body = {}) => service(state, method, path, body, tokens[id]);
  const fails = async (fn, status) => { try { await fn(); return false; } catch (err) { return !status || err.status === status; } };

  {
    const before = JSON.stringify(prof('qa-gm-a'));
    const boot = await call('qa-gm-a', 'GET', '/bootstrap');
    assert(boot.stats.streak_guard?.held === 0 && boot.rewards.match && boot.rewards.reel && JSON.stringify(prof('qa-gm-a')) === before, 'V13.149 홈 데이터에 보호권 · 짝 맞추기 · 낚시가 오고, 읽기만으로 학생 기록이 바뀌지 않는다');
    assert(await fails(() => call('qa-gm-a', 'POST', '/shop/streak-guard'), 400), 'V13.149 코인이 모자라면 보호권을 살 수 없다');
    addBonus(prof('qa-gm-a'), { coins: 1000, now });
    const spentBefore = Number(prof('qa-gm-a').points_spent || 0);
    const b1 = await call('qa-gm-a', 'POST', '/shop/streak-guard');
    const b2 = await call('qa-gm-a', 'POST', '/shop/streak-guard');
    assert(b1.streak_guard.held === 1 && b2.streak_guard.held === 2 && prof('qa-gm-a').points_spent - spentBefore === 2 * STREAK_GUARD.PRICE && prof('qa-gm-a').purchases.filter(x => x.item === 'streak_guard').length === 2,
      `V13.149 보호권은 ${STREAK_GUARD.PRICE}코인(쓴 코인에 들어가고 구매 기록에 남는다)`);
    assert(await fails(() => call('qa-gm-a', 'POST', '/shop/streak-guard'), 409), `V13.149 보호권은 ${STREAK_GUARD.MAX}장이면 더 살 수 없다`);
    // 출석 7번째 도장: 보호권 1장(가득이면 없음).
    const b = prof('qa-gm-b');
    b.attendance = { card: 6, last: dayKey(now - DAY), streak: 6 };
    const seventh = await call('qa-gm-b', 'POST', '/attendance/check');
    prof('qa-gm-a').attendance = { card: 6, last: dayKey(now - DAY), streak: 6 };
    const full = await call('qa-gm-a', 'POST', '/attendance/check');
    assert(seventh.tickets === 1 && seventh.streak_guard?.held === 1 && b.streak_guard.log[0].src === 'attend' && full.streak_guard === null && prof('qa-gm-a').streak_guard.log.length === 2,
      'V13.149 출석 7번째 도장에 보호권 1장(이미 2장이면 주지 않는다)');
    const evts = source('../public/modules/student.js'), app = source('../public/app.js'), ui = source('../public/modules/streak-guard-ui.js');
    assert(evts.includes('${streakCard(A)}') && app.includes("d.action === 'streak-guard'") && app.includes('maybeGuardMoment(A)') && ui.includes("'/shop/streak-guard'") && ui.includes('보호권이 연속을 지켰어요!') && ui.includes('연속 되살리기 성공!'),
      'V13.149 홈 불꽃 카드 · 보호권 창(사기) · 지켰어요/되살리기 순간');
  }

  {
    // 짝 맞추기: 뜻이 서로 다른 6쌍, 카드에는 뜻의 첫 갈래만.
    const words = Array.from({ length: 20 }, (_, i) => ({ id: 'w' + i, word: 'word' + i, meaning: i === 3 ? '같은 뜻, 다른 말' : i === 4 ? '같은 뜻' : `뜻${i}, 다른 뜻` }));
    const pairs = matchPick(words, { random: lcg(3) });
    assert(pairs.length === MATCH.PAIRS && new Set(pairs.map(p => p.ko)).size === MATCH.PAIRS && new Set(pairs.map(p => p.en)).size === MATCH.PAIRS && cardMeaning('~을 포기하다, 버리다') === '~을 포기하다' && matchPick(words, { missed: ['w7'], random: lcg(1) }).some(p => p.id === 'w7'),
      'V13.149 짝 맞추기: 영어 · 뜻이 겹치지 않는 6쌍, 틀린 단어를 먼저 넣는다');
    assert(matchStars(15000) === 3 && matchStars(25000) === 2 && matchStars(40000) === 1, 'V13.149 짝 맞추기 별: 18초 · 28초 안');
    const realNow = Date.now;
    let clock = now;
    Date.now = () => clock;
    try {
      const play = async (ms, misses = 0, wait = MATCH.COUNTDOWN_MS + ms) => { const s = await call('qa-gm-c', 'POST', '/games/match/start', { range_codes: ['24'] }); clock += wait; return [s, await call('qa-gm-c', 'POST', '/games/match/finish', { id: s.id, ms, misses })]; };
      const [, fast] = await play(2000);
      const [, early] = await play(15000, 0, 4000);
      const [s1, r1] = await play(16000);
      const again = await call('qa-gm-c', 'POST', '/games/match/finish', { id: s1.id, ms: 16000, misses: 0 });
      const [, r2] = await play(12000, 1);
      assert(!fast.paid && fast.reason === 'bad' && !early.paid && early.reason === 'short', 'V13.149 짝 맞추기: 사람 손보다 빠르거나 서버가 잰 시간보다 긴 기록은 받지 않는다');
      assert(r1.paid && r1.stars === 3 && r1.record && r1.coins === MATCH.COINS[3] + MATCH.RECORD_COINS && again.again && again.coins === r1.coins && r2.record && r2.coins === MATCH.COINS[3] && prof('qa-gm-c').games.match.best === 12000,
        'V13.149 짝 맞추기: 별만큼 코인 + 신기록 보너스(하루 한 번), 같은 끝내기는 한 번만 받는다');
      for (let i = 0; i < 5; i++) await play(20000);
      const [, capped] = await play(20000);
      assert(!capped.paid && capped.reason === 'daily' && capped.left === 0, `V13.149 짝 맞추기 코인은 하루 ${MATCH.DAILY}판까지(기록은 남는다)`);
      const board = await call('qa-gm-a', 'GET', '/games/match/board');
      assert(board.rows[0]?.id === 'qa-gm-c' && board.rows[0].ms === 12000 && !board.rows.some(r => r.id === 'qa-gm-d'), 'V13.149 이번 주 우리 반 짝 맞추기 순위(다른 반은 안 보인다)');
      // V13.150 손맛 낚시(놀이터): 미끼 → 던지기(서버가 물고기를 정함) → 끌어올리기(최소 파이팅 시간) → 어망 → 진주 → 코인 · 알.
      const b = prof('qa-gm-b');
      b.reel = {}; // 앞의 출석 검사에서 받은 미끼는 지우고 시작
      assert(await fails(() => call('qa-gm-b', 'POST', '/reel/cast', { cast: 'perfect' }), 409), 'V13.150 미끼가 없으면 던질 수 없다');
      const given = Array.from({ length: 7 }, () => grantBait(b, clock));
      assert(given.filter(Boolean).length === REEL.BAIT_DAILY && b.reel.bait === REEL.BAIT_DAILY, `V13.150 미끼는 하루 ${REEL.BAIT_DAILY}개까지 받는다`);
      const c1 = await call('qa-gm-b', 'POST', '/reel/cast', { cast: 'perfect' });
      const live1 = b.reel.live;
      assert(c1.fight.hp === FIGHT[live1.rarity].hp && !('key' in c1) && !JSON.stringify(c1.fight).includes(live1.key) && c1.reel.bait === REEL.BAIT_DAILY - 1 && await fails(() => call('qa-gm-b', 'POST', '/reel/cast', {}), 409),
        'V13.150 던지면 미끼 1개를 쓰고, 화면에는 파이팅 세기만(어떤 물고기인지는 끌어올린 뒤), 끌어올리기 전에 또 던질 수 없다');
      clock += 1000;
      const tooSoon = await call('qa-gm-b', 'POST', '/reel/land', { id: c1.id, result: 'caught' });
      assert(!tooSoon.caught && tooSoon.reason === 'short' && !b.reel.live, 'V13.150 최소 파이팅 시간보다 빨리 끌어올렸다고 하면 놓친 것');
      const c2 = await call('qa-gm-b', 'POST', '/reel/cast', { cast: 'ok' });
      const live2 = b.reel.live;
      clock += FIGHT.legend.min + 100;
      const got = await call('qa-gm-b', 'POST', '/reel/land', { id: c2.id, result: 'caught' });
      const twice = await call('qa-gm-b', 'POST', '/reel/land', { id: c2.id, result: 'caught' });
      assert(got.caught && got.key === live2.key && got.kg === live2.kg && twice.again && b.games.fish.book[live2.key].n >= 1 && (live2.key === 'goldenegg' || got.reel.net[live2.key] === 1),
        'V13.150 끌어올리면 던질 때 정해진 물고기가 어망 · 도감에(같은 끝내기는 한 번만)');
      const c3 = await call('qa-gm-b', 'POST', '/reel/cast', { cast: 'good' });
      const lost = await call('qa-gm-b', 'POST', '/reel/land', { id: c3.id, result: 'lost' });
      assert(!lost.caught && lost.reel.bait === REEL.BAIT_DAILY - 3, 'V13.150 놓치면 미끼는 사라진다');
      // 팔기 · 교환.
      b.reel.net = { tuna: 2, carp: 1 };
      const sold = await call('qa-gm-b', 'POST', '/reel/sell', {});
      assert(sold.pearls === 2 * REEL.PEARLS.rare + REEL.PEARLS.uncommon && !Object.keys(sold.reel.net).length && b.games.fish.book[live2.key], 'V13.150 어망 물고기를 팔면 등급만큼 진주(도감은 그대로)');
      b.reel.pearls = 5000;
      const bal0 = (await call('qa-gm-b', 'GET', '/rewards')).points_balance;
      const coins = await call('qa-gm-b', 'POST', '/reel/exchange', { item: 'coins', amount: 60 });
      assert(coins.coins === 60 && coins.points_balance - bal0 === 60 && await fails(() => call('qa-gm-b', 'POST', '/reel/exchange', { item: 'coins', amount: 50 }), 409),
        `V13.150 진주 → 코인 1:1, 하루 ${REEL.COIN_DAILY}코인까지`);
      const pets0 = b.pets.length;
      const egg = await call('qa-gm-b', 'POST', '/reel/exchange', { item: 'egg' });
      const epic = await call('qa-gm-b', 'POST', '/reel/exchange', { item: 'epic_egg' });
      assert(egg.key && epic.key && b.pets.length === pets0 + 2 && b.reel.pearls === 5000 - 60 - REEL.EGG - REEL.EPIC_EGG
        && await fails(() => call('qa-gm-b', 'POST', '/reel/exchange', { item: 'egg' }), 409) && await fails(() => call('qa-gm-b', 'POST', '/reel/exchange', { item: 'epic_egg' }), 409)
        && await fails(() => call('qa-gm-b', 'POST', '/reel/exchange', { item: 'sea_pet' }), 409),
        `V13.150 진주 ${REEL.EGG} = 랜덤 알(하루 1), ${REEL.EPIC_EGG} = 영웅 알(일주일 1), 바다 펫은 그림이 올 때까지 잠김`);
      const att = b.attendance = { card: 0, last: dayKey(clock - DAY), streak: 1 };
      b.reel.bait_today = 0;
      const checkin = await call('qa-gm-b', 'POST', '/attendance/check');
      assert(checkin.bait === true && checkin.reel.bait === b.reel.bait && att, 'V13.150 출석하면 미끼 1개');
    } finally { Date.now = realNow; }
  }

  {
    // 물고기 규칙(반 전체 낚시 · 손맛 낚시가 같이 쓴다).
    let fast = 0, slow = 0;
    for (let i = 0; i < 400; i++) { fast += rollCast(i * 7919, 0, 0, 1000).kg; slow += rollCast(i * 7919, 0, 0, 9000).kg; }
    const rare = k => { let n = 0; for (let i = 0; i < 2000; i++) if (['rare', 'epic', 'legend'].includes(rollCast(i * 104729, 1, k, 5000).rarity)) n++; return n; };
    assert(fast > slow * 1.5 && rare(3) > rare(0) * 3, 'V13.149 반 전체 낚시: 빨리 맞힐수록 큰 물고기, 좋은 미끼일수록 귀한 물고기');
    assert(FISH_KEYS.length === 24 && FISH_KEYS.every(k => fishSvg(k).startsWith('<svg') && fishSvg(k).includes(FISH[k].name)) && LURES.length === 4 && FISH.goldenegg.rarity === 'golden',
      'V13.149 물고기 24종(황금 알 물고기 포함)은 모두 코드 그림이 있다');
    // 손맛 낚시: 퍼펙트로 던질수록 귀한 물고기, 같은 seed는 같은 물고기, 등급마다 진주 · 파이팅 세기.
    const rareCast = c => { let n = 0; for (let i = 0; i < 3000; i++) if (['rare', 'epic', 'legend'].includes(reelRoll(i * 2654435761, c).rarity)) n++; return n; };
    assert(rareCast('perfect') > rareCast('ok') * 2 && JSON.stringify(reelRoll(99, 'good')) === JSON.stringify(reelRoll(99, 'good')) && pearlsOf('whaleshark') === 400 && pearlsOf('minnow') === 10
      && FIGHT.legend.hp > FIGHT.common.hp && FIGHT.legend.min > FIGHT.common.min, 'V13.150 손맛 낚시: 퍼펙트일수록 귀한 물고기, 진주 10 · 25 · 60 · 150 · 400, 귀할수록 오래 버틴다');
    // 황금 알 물고기 3마리 → 선생님 알과 같은 선물 상자.
    const p = { id: 'egg-test', pets: [{ key: 'dog' }], reel: { bait: 1 }, games: { fish: { golden: 2 } } };
    let seed = 0;
    while (reelRoll(seed, 'perfect').key !== 'goldenegg') seed++;
    reelCast(p, { id: 'g1', cast: 'perfect', now, seed });
    const done = reelLand(p, { id: 'g1', result: 'caught', now: now + FIGHT.golden.min + 10, giftId: 'gift-1' });
    assert(done.egg && p.gift_box.log.some(g => g.kind === 'egg' && g.from_name === '낚시터') && !p.reel.net?.goldenegg, 'V13.150 황금 알 물고기는 팔지 않고 모아 3마리면 알 선물');
    const art = source('../docs/asset-requests/runner/26-fishing.txt'), codex = source('../docs/asset-requests/runner/CODEX_PROMPT_26.md'), map = source('../docs/asset-requests/runner/slice-map.csv');
    assert(art.split('\n---\n').length === 6 && art.split('\n---\n').every((t, i) => t.includes('STYLE REFERENCE — before drawing, open "06-3.png"') && t.includes(`named exactly "26-${i + 1}.png"`) && t.includes('"SUMUS 낚시 26 (Runner용)"'))
      && codex.includes('Drive의 기존 그림을 열어 그림체를 맞춘다') && codex.includes('정해진 Drive 폴더 "SUMUS 낚시 26 (Runner용)"에 정확한 파일 이름') && FISH_KEYS.every(k => map.includes(`public/assets/fish/${k}.webp`)),
      'V13.149 그림 주문서 26: Drive의 기존 그림을 열어 그림체를 맞추고, 정해진 Drive 폴더에 정확한 파일 이름으로 저장(물고기 24종 모두 자르기 표에)');
    // 그림 주문서 27(낚시 손맛 업그레이드): 시트마다 Drive 참고 그림을 열고, "SUMUS 낚시 27" 폴더에 정확한 이름으로 저장.
    const sheets27 = ['27a-fishing-backgrounds.txt', '27b-fish-hanging.txt', '27c-fishing-gear-ui.txt'].flatMap(f => source(`../docs/asset-requests/runner/${f}`).trim().split('\n---\n'));
    const codex27 = source('../docs/asset-requests/runner/CODEX_PROMPT_27.md');
    assert(sheets27.length === 16 && sheets27.every(t => /STYLE REFERENCE — before drawing, open/.test(t) && /named exactly "27[abc]-\d+\.png"/.test(t) && t.includes('"SUMUS 낚시 27 (Runner용)"'))
      && sheets27.slice(3, 9).every((t, i) => t.includes(`open "26-${i + 1}.png"`)) && FISH_KEYS.every(k => map.includes(`public/assets/fish/${k}-hang.webp`))
      && codex27.includes('Drive의 기존 그림을 열어 그림체를 맞춘다') && codex27.includes('정해진 Drive 폴더 "SUMUS 낚시 27 (Runner용)"에 정확한 파일 이름'),
      'V13.149 그림 주문서 27: 배경 3 · 낚인 물고기 24(26을 열어 같은 물고기) · 도구 · 조작 7시트, Drive 그림체 맞추기와 정해진 폴더 · 정확한 이름 저장');
    const sheets28 = ['28a-sea-pets-design.txt', '28b-sea-pets-expressions.txt', '28c-sea-pets-battle-poses.txt'].flatMap(f => source(`../docs/asset-requests/runner/${f}`).trim().split('\n---\n'));
    const codex28 = source('../docs/asset-requests/runner/CODEX_PROMPT_28.md');
    assert(sheets28.length === 19 && sheets28.every(t => /(STYLE|CHARACTER) REFERENCE — before drawing, open/.test(t) && /named exactly "28[abc]-\d+\.png"/.test(t) && t.includes('"SUMUS 바다 펫 28 (Runner용)"'))
      && sheets28.slice(3).every(t => /open "28a-\d\.png"/.test(t)) && ['dolphin', 'seahorse', 'hermitcrab'].every(k => [0, 1, 2, 3].every(f => map.includes(`public/assets/pets/${k}-${f}.webp`)) && map.includes(`public/assets/pets/${k}-3-attack.webp`))
      && codex28.includes('Drive의 기존 그림을 열어 그림체를 맞춘다') && codex28.includes('정해진 Drive 폴더 "SUMUS 바다 펫 28 (Runner용)"에 정확한 파일 이름'),
      'V13.149 그림 주문서 28(바다 펫 3종): 설정 시트를 먼저, 표정 · 전투 자세는 설정 시트를 열어 맞추고, 정해진 폴더에 정확한 이름으로 저장');
    // 그림 주문서 29(낚시 화면 새 단장): 27 그림을 열어 맞추고, "SUMUS 낚시 29" 폴더에 정확한 이름으로 저장.
    const sheets29 = ['29a-fishing-pov-backgrounds.txt', '29b-fishing-pov-rod.txt', '29c-fishing-juice-fx.txt', '29d-fishing-tank.txt', '29e-fishing-hud.txt'].flatMap(f => source(`../docs/asset-requests/runner/${f}`).trim().split('\n---\n'));
    const codex29 = source('../docs/asset-requests/runner/CODEX_PROMPT_29.md');
    assert(sheets29.length === 12 && sheets29.every(t => /STYLE REFERENCE — before drawing, open/.test(t) && t.includes('"SUMUS 낚시 27 (Runner용)"') && /named exactly "29[a-e]-\d\.png"/.test(t) && t.includes('"SUMUS 낚시 29 (Runner용)"'))
      && sheets29.slice(3, 5).every(t => t.includes('keep') && t.includes('27c-1.png')) && ['bg-pov', 'pov-rod-left', 'pov-crank', 'fx-jump', 'bobber-sink', 'hint-hand'].every(k => map.includes(`public/assets/fishing/${k}.webp`))
      && codex29.includes('Drive의 기존 그림을 열어 그림체를 맞춘다') && codex29.includes('정해진 Drive 폴더 "SUMUS 낚시 29 (Runner용)"에 정확한 파일 이름') && codex29.includes('`sumus-voca-prod-deploy`로 PR을 만들지 않는다'),
      'V13.149 그림 주문서 29: 1인칭 낚시 12시트, 27 그림체 맞추기와 정해진 폴더 · 정확한 이름 저장, 운영 브랜치로 PR 금지');
  }

  /* ---------- 교실 게임 규칙 ---------- */
  {
    const qs = Array.from({ length: 20 }, (_, i) => ({ word_id: 'w' + i, prompt: 'word' + i, options: ['a', 'b', 'c', 'd'], answer: i % 4 }));
    const make = (kind = 'treasure', steal = true) => createParty({ id: 'p1', code: '1234', kind, minutes: 5, steal, questions: qs, seed: 9, host: { id: 't' }, now });
    const room = make();
    for (const id of ['a', 'b', 'c', 'd', 'e', 'f']) joinParty(room, { id, name: id.toUpperCase() }, now);
    const ans = (pid, ok, t) => { const q = qs[room.players[pid].qi % qs.length]; return answer(room, pid, ok ? q.answer : (q.answer + 1) % 4, t, lcg(5)); };
    assert(startParty(room, now).events[0].kind === 'start' && room.end_at === now + 5 * 60000, 'V13.149 교실 게임: 선생님이 시작하면 정한 시간(5분)만큼');
    const w = ans('a', false, now + 1000);
    assert(w.me.kind === 'wrong' && room.players.a.wait_until === now + 1000 + PARTY.WRONG_WAIT_MS && !ans('a', true, now + 1500).me, 'V13.149 틀리면 2초 쉰다(그동안 답은 받지 않는다)');
    const v = playerView(room, 'b', now + 2000);
    assert(v.q && !('answer' in v.q) && !JSON.stringify(v).includes('"answer"'), 'V13.149 학생 화면에는 정답 번호가 없다');
    // 처음 1분: 훔치기 · 바꾸기 상자 없음.
    const early = [];
    for (let i = 0; i < 60; i++) { ans('b', true, now + 2000 + i); early.push(...room.players.b.offer.chests.map(c => c.kind)); pick(room, 'b', 0, now + 2000 + i); }
    assert(!early.some(k => k === 'steal' || k === 'swap') && room.players.b.gold > 0, 'V13.149 처음 1분은 훔치기 · 바꾸기가 나오지 않는다');
    // 훔치기: 위 5명 중에서, 같은 친구 2번까지, 방패가 막는다, 되갚기.
    const T0 = now + PARTY.NO_STEAL_MS + 1000;
    Object.assign(room.players.a, { gold: 100 }); Object.assign(room.players.c, { gold: 500, shield: 1 }); Object.assign(room.players.b, { gold: 300 });
    const steal = (pid, vid, t, pct = 25) => { room.players[pid].offer = { chests: [{ kind: 'steal', pct }, { kind: 'gold', amount: 5 }, { kind: 'nothing' }], at: t }; const opened = pick(room, pid, 0, t); return { opened, res: target(room, pid, vid, t) }; };
    const blocked = steal('a', 'c', T0);
    assert(blocked.opened.me.targets && blocked.res.me.kind === 'blocked' && room.players.c.shield === 0 && room.players.c.gold === 500 && blocked.res.events.some(e => e.kind === 'block'), 'V13.149 방패가 있으면 훔치기를 막는다(방패는 사라진다)');
    const took = steal('a', 'c', T0 + 10);
    assert(took.res.me.kind === 'stole' && took.res.me.amount === 125 && room.players.c.gold === 375 && room.players.a.gold === 225, 'V13.149 훔치기 25%: 친구 금화의 25%를 가져온다');
    const third = steal('a', 'c', T0 + 20, 10);
    assert(!third.res.me && room.players.a.pending && !room.players.a.pending.list.includes('c') && !playerView(room, 'a', T0 + 21).pending.targets.some(x => x.id === 'c') && room.players.c.gold === 375,
      'V13.149 같은 친구는 한 판에 2번까지(세 번째는 표적에 없고, 골라도 훔쳐지지 않는다)');
    target(room, 'a', room.players.a.pending.list[0], T0 + 26);
    const revenge = playerView(room, 'c', T0 + 30);
    room.players.c.offer = { chests: [{ kind: 'steal', pct: 10 }, { kind: 'nothing' }, { kind: 'nothing' }], at: T0 + 30 };
    pick(room, 'c', 0, T0 + 30);
    const list = playerView(room, 'c', T0 + 31).pending.targets;
    assert(list.some(x => x.id === 'a' && x.revenge) && revenge.me.gold < 500, 'V13.149 30초 안에 나에게서 훔쳐 간 친구는 되갚기 표시와 함께 표적에 나온다');
    const auto = tick(room, T0 + 31 + PARTY.TARGET_MS);
    assert(!room.players.c.pending && auto.events.some(e => e.kind === 'steal' || e.kind === 'block'), 'V13.149 12초 안에 고르지 않으면 1등 쪽에서 자동으로');
    // 바꾸기는 나보다 많은 친구만.
    room.players.f.offer = { chests: [{ kind: 'swap' }, { kind: 'nothing' }, { kind: 'nothing' }], at: T0 + 50 };
    room.players.f.gold = 0;
    pick(room, 'f', 0, T0 + 50);
    assert(room.players.f.pending.list.every(id => room.players[id].gold > 0), 'V13.149 바꾸기는 나보다 금화가 많은 친구와만');
    // 훔치기 끄기: 훔치기 · 바꾸기 · 방패 상자가 나오지 않는다.
    const calm = make('treasure', false);
    ['a', 'b'].forEach(id => joinParty(calm, { id, name: id }, now)); startParty(calm, now);
    const kinds = new Set();
    for (let i = 0; i < 200; i++) { const q = qs[calm.players.a.qi % qs.length]; answer(calm, 'a', q.answer, now + 70000 + i, lcg(i + 1)); calm.players.a.offer.chests.forEach(c => kinds.add(c.kind)); pick(calm, 'a', 0, now + 70000 + i); }
    assert(!kinds.has('steal') && !kinds.has('swap') && !kinds.has('shield') && kinds.has('gold') && kinds.has('monster'), 'V13.149 훔치기를 끄면 금화 · 배수 · 꽝 · 몬스터만');
    assert(Object.values(CHESTS).reduce((n, c) => n + c.w, 0) === 99 && CHESTS.steal.w === 12 && CHESTS.jackpot.w === 2, 'V13.149 상자 확률: 금화 45 · 2배 6 · 3배 3 · 꽝 10 · 훔치기 12 · 방패 8 · 바꾸기 3 · 몬스터 10 · 대박 2');
    // 마지막 1분은 TV 순위를 가린다, 끝나면 재미 상.
    const lastTv = tvView(room, room.end_at - 30000), lastMe = playerView(room, 'a', room.end_at - 30000);
    const names = lastTv.top.map(x => x.name);
    assert(!tvView(room, now + 3 * 60000).hidden && lastTv.hidden && lastTv.top.every(x => x.score === null && x.rank === null) && names.join() === [...names].sort((a, b) => a.localeCompare(b, 'ko')).join()
      && lastMe.hidden && lastMe.me.rank === null && !lastMe.top.length,
      'V13.149 마지막 1분은 TV와 폰 모두 순위를 가린다(TV 줄은 이름 순, 점수 없음)');
    const leads = room.feed.filter(f => f.kind === 'lead');
    assert(leads.every((f, i) => !i || f.at - leads[i - 1].at >= PARTY.LEAD_NEWS_MS), "V13.149 '1등 탈환' 소식은 10초에 한 번까지");
    tick(room, room.end_at + 1);
    const tv = tvView(room, room.end_at + 2);
    assert(room.phase === 'ended' && tv.awards.some(a => a.key === 'thief') && tv.awards.some(a => a.key === 'smart') && tv.awards.some(a => a.key === 'wall'), 'V13.149 시간이 다 되면 끝나고 정답왕 · 대도 · 철벽 방패 상');
    assert(partyCoins(4, 1, 10) === 0 && partyCoins(10, 1, 10) === 15 && partyCoins(40, 5, 10) === 15 && partyCoins(10, 2, 2) === 5, 'V13.149 진짜 코인: 맞힌 수 절반(최대 15) + 1~3등 10 · 6 · 4, 5문제 이상');
    // 반 전체 낚시: 반 정답 40개마다 물고기 떼(미끼 +2).
    const pond = make('fish');
    for (let i = 0; i < 8; i++) joinParty(pond, { id: 'k' + i, name: 'k' + i }, now);
    startParty(pond, now);
    let frenzy = null;
    for (let r = 0; r < 6 && !frenzy; r++) for (let i = 0; i < 8; i++) { const pl = pond.players['k' + i], q = qs[pl.qi % qs.length]; const res = answer(pond, 'k' + i, q.answer, now + 1000 + r * 10 + i, lcg(1)); frenzy ||= res.events.find(e => e.kind === 'frenzy'); }
    assert(frenzy && pond.right_total === PARTY.FRENZY_EVERY && pond.frenzy_until === frenzy.until && ranked(pond)[0].kg > 0 && pond.players.k0.fish.length > 0, 'V13.149 반 전체 낚시: 반 정답 40개면 물고기 떼(20초)');
    const report = partyReport(pond);
    assert(report.players.length === 8 && report.players[0].fish && report.kind === 'fish', 'V13.149 끝난 판 보고에는 순위 · 맞힌 수 · 잡은 물고기');
  }

  /* ---------- 교실 게임: 서버(만들기 · 참가 · 정산) ---------- */
  {
    const made = await call('qa_gm_teacher', 'POST', '/teacher/party', { kind: 'treasure', class_name: '고1A', minutes: 8, steal: true, range_codes: ['24'] });
    const init = made._parties.find(m => m.action === 'init');
    assert(/^\d{4}$/.test(made.party.code) && made.party.tv_ticket && init.party.questions.length >= 8 && init.party.questions.every(q => q.options.length === 4 && q.answer >= 0) && init.tv_ticket === made.party.tv_ticket,
      'V13.149 선생님이 교실 게임을 열면 4자리 번호 · TV 입장표 · 문제(정답은 방에만)');
    const joined = await call('qa-gm-a', 'POST', '/party/join', { code: made.party.code });
    assert(joined.room.id === made.party.id && joined.room.ticket && joined._parties[0].action === 'join' && joined._parties[0].player.pet?.key === 'dog' && !JSON.stringify(joined.room).includes('questions'),
      'V13.149 학생은 번호로 들어가고 입장표를 받는다(문제는 받지 않는다)');
    assert(await fails(() => call('qa-gm-d', 'POST', '/party/join', { code: made.party.code }), 409) && await fails(() => call('qa-gm-b', 'POST', '/party/join', { code: '0000' === made.party.code ? '0001' : '0000' }), 404),
      'V13.149 다른 반 · 틀린 번호로는 들어갈 수 없다');
    const again = await call('qa_gm_teacher', 'POST', '/teacher/party', { kind: 'fish', class_name: '고1', minutes: 5, range_codes: ['24'] });
    assert(again._parties.some(m => m.action === 'close' && m.id === made.party.id) && state.parties.find(x => x.id === made.party.id).status === 'closed' && again.party.steal === false,
      'V13.149 새 게임을 열면 예전 방은 닫힌다(선생님 한 명에 하나), 낚시는 훔치기 없음');
    await call('qa-gm-b', 'POST', '/party/join', { code: again.party.code });
    await call('qa-gm-c', 'POST', '/party/join', { code: again.party.code });
    const before = Number(prof('qa-gm-b').games?.fish?.book?.shark?.n || 0);
    const body = { id: again.party.id, report_id: `party:${again.party.id}`, result: { players: [{ id: 'qa-gm-b', rank: 1, right: 20, fish: [{ key: 'shark', kg: 150 }] }, { id: 'qa-gm-c', rank: 2, right: 3 }, { id: 'stranger', rank: 3, right: 30 }] } };
    const coinsOf = id => (prof(id).bonus?.log || []).reduce((n, x) => n + x.c, 0);
    const b0 = coinsOf('qa-gm-b'), c0 = coinsOf('qa-gm-c');
    assert(settleParty(state, body, { now }) && !settleParty(state, body, { now }), 'V13.149 끝난 판은 한 번만 정산한다');
    assert(coinsOf('qa-gm-b') - b0 === 10 && coinsOf('qa-gm-c') === c0 && prof('qa-gm-b').games.fish.book.shark.n === before + 1 && !state.profiles.some(p => p.id === 'stranger'),
      'V13.149 정산: 맞힌 수 위주 코인(3명 미만이면 순위 보너스 없음), 5문제 미만은 코인 없음, 반 낚시 물고기는 어항 도감에');
    const cap = state.parties.find(x => x.id === again.party.id);
    prof('qa-gm-b').games.party = { day: dayKey(now), plays: PARTY.DAILY };
    cap.settled = false;
    const b1 = coinsOf('qa-gm-b');
    settleParty(state, body, { now });
    assert(coinsOf('qa-gm-b') === b1, `V13.149 교실 게임 코인은 하루 ${PARTY.DAILY}판까지`);
  }

  /* ---------- 연결(Cloudflare · 로컬 서버 · 화면) ---------- */
  {
    const wrangler = source('../wrangler.jsonc'), worker = source('../cloudflare/worker.mjs'), local = source('./index.mjs'), build = source('./build-assets.mjs'), sw = source('../public/sw.js');
    const battle = source('../public/modules/battle.js'), app = source('../public/app.js'), teacher = source('../public/modules/teacher.js');
    assert(wrangler.includes('"name": "PARTY_ROOM"') && wrangler.includes('"class_name": "PartyRoom"') && /"tag": "v4",\s*"new_sqlite_classes": \[\s*"PartyRoom"/.test(wrangler),
      'V13.149 wrangler: PARTY_ROOM 바인딩과 v4 마이그레이션');
    assert(worker.includes('export { PartyRoom };') && worker.includes("url.pathname.match(/^\\/api\\/party\\/ws\\/([0-9a-f-]{36})$/)") && worker.includes("'X-Party-Key'") && worker.includes('delete result._parties') && worker.includes('undoParty(state, message)') && worker.includes('settlePartyReport(state, body)'),
      'V13.149 worker: 교실 게임 소켓은 방으로, 방 준비 메시지는 브라우저로 안 가고, 결과 보고는 키로 확인');
    assert(local.includes('delete result._parties;') && local.includes('delete result._dungeon;'), 'V13.149 로컬 서버도 방 준비 메시지(문제 · 입장표)를 브라우저로 보내지 않는다');
    assert(/"v13146\.css",\s*"v13149\.css"\s*\]/.test(build) && ['match-game.js', 'reel.js', 'reel-rules.js', 'fishing-art.js', 'fishing-rules.js', 'party.js', 'party-tv.js', 'streak-guard.js', 'streak-guard-ui.js', 'match-rules.js'].every(f => sw.includes(`modules/${f}`)),
      'V13.149 새 화면 CSS는 묶음 끝에, 새 모듈은 오프라인 캐시에');
    assert(battle.includes("['games', '게임', 'arcade']") && battle.includes("act === 'game-match'") && !battle.includes('game-fish') && source('../public/modules/arcade.js').includes('data-action="reel-open"') && app.includes("d.action === 'reel-open'")
      && source('../public/modules/reel.js').includes('진주 1개 = 1코인') && source('../public/modules/sessions.js').includes('낚시 미끼 +1') && battle.includes("act === 'game-party'") && app.includes("d.action === 'party-new'") && teacher.includes('data-action="party-new"'),
      'V13.149 야차전 게임 탭(짝 맞추기 · 단어 낚시 · 교실 게임 참가)과 선생님 대시보드의 교실 게임 버튼');
  }
}
