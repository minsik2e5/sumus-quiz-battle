// V13.162 검사: 몬스터 사냥(놀이터, 처음 이름 펫 사냥). 선생님 결정(테스트 뒤): 펫을 사냥으로 많이 얻으면 알을 안 사므로 몬스터 위주.
// 공 받기(공부로만) · 좋은 공 · 황금 공, 누가 나오나(몬스터 5등급, 펫은 만남을 끝낼 때 7% · 더 어렵게, 전설 · 신화 · 한정 펫 없음),
// 잡힘 · 도망 확률, 던지기 영수증, 가방 · 도감 · 팔기(별조각) · 교환소(코인 하루 한도 · 랜덤 알 · 영웅 알),
// 밸런스 시뮬레이션(하루 가치 ≈ 낚시: 열심 약 90 · 보통 약 30코인어치), 화면 · 그림 주문서 34.
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dayKey, STANDARD_PET_KEYS, EPIC_PET_KEYS, CHARACTERS } from '../public/modules/core.js';
import { seeded } from '../public/modules/fishing-rules.js';
import { HUNT, HUNT_MONSTERS, MONSTER_KEYS, MONSTER_TIERS, catchChance, rollThrow, spawnTier, petTier, huntSim, huntSimAverage, huntSlot, dayValue } from '../public/modules/hunt-rules.js';
import { grantBall, huntCard, huntMap, huntView, huntMeet, huntThrow, huntSell, huntCoins, huntSpend } from './hunt.mjs';
import { rewardIncome } from './rewards.mjs';
import { emptyState } from './state.mjs';
import { passwordHash } from './auth.mjs';
import { service } from './service.mjs';

const source = path => readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8');
const throws = fn => { try { fn(); return null; } catch (e) { return e.status || 500; } };
const near = (a, b, d = 1e-9) => Math.abs(a - b) <= d;
const DAY = 86400000;
const seq = list => { const r = [...list]; return () => r.length ? r.shift() : .5; };

export async function runHuntChecks(assert) {
  const t0 = Date.parse('2026-10-20T03:00:00Z');

  /* ---------- 규칙 숫자(선생님 결정) ---------- */
  assert(HUNT.SOURCES.join() === 'practice,attend,match' && HUNT.BALL_MAX === 6 && HUNT.MIN_PRACTICE === 10 && HUNT.GOLD_CARDS === 4 && HUNT.GOOD_DAILY === 1,
    'V13.162 공은 공부로만: 연습 끝내기(10문제 이상) · 출석 · 짝 맞추기 별 3, 곳마다 하루 1개(하루 최대 3개), 6개까지 보관, 황금 공은 출석 도장판 4장마다');
  assert(MONSTER_TIERS.join() === 'common,uncommon,rare,epic,legend' && MONSTER_TIERS.reduce((n, t) => n + HUNT.SPAWN[t], 0) === 100 && MONSTER_KEYS.length >= 30
    && MONSTER_TIERS.every(t => MONSTER_KEYS.some(k => HUNT_MONSTERS[k].tier === t)),
    `V13.162 몬스터 5등급(낚시처럼, 흔함 · 보통 · 희귀 · 영웅 · 전설) ${MONSTER_KEYS.length}종, 등급 확률 합 100%`);
  const root = fileURLToPath(new URL('../public/assets/monsters/', import.meta.url));
  assert(MONSTER_KEYS.every(k => ['', '-attack', '-hurt'].every(s => existsSync(`${root}${k}${s}.webp`))), 'V13.162 사냥 몬스터는 모두 기존 몬스터 그림(기본 · 공격 · 맞음)이 있다');
  assert(HUNT.PET === 7 && HUNT.PET_EPIC === 15 && HUNT.CATCH.pet < HUNT.CATCH.common && HUNT.CATCH.petEpic < HUNT.CATCH.legend && HUNT.FLEE.pet >= HUNT.FLEE.epic,
    'V13.162 펫은 낮은 확률(만남을 끝낼 때 7%, 기본 85 · 영웅 15)로만, 몬스터보다 잘 안 잡히고 잘 도망친다(선생님 결정)');
  assert(MONSTER_TIERS.every((t, i) => !i || (HUNT.CATCH[t] < HUNT.CATCH[MONSTER_TIERS[i - 1]] && HUNT.FLEE[t] > HUNT.FLEE[MONSTER_TIERS[i - 1]] && HUNT.STARS[t] > HUNT.STARS[MONSTER_TIERS[i - 1]])),
    'V13.162 높은 등급일수록 잘 안 잡히고 잘 도망치고, 팔면 별조각을 더 준다');
  assert(HUNT.THROWS.nice === 1.1 && HUNT.THROWS.great === 1.25 && HUNT.THROWS.excellent === 1.6 && HUNT.BALLS.good === 1.5 && HUNT.BERRY_CATCH === 1.5 && HUNT.BERRY_REWARD === 2,
    'V13.162 나이스 ×1.1 · 그레이트 ×1.25 · 엑설런트 ×1.6, 좋은 공 ×1.5, 🍓 ×1.5, 🍍 몬스터 2마리');
  assert(near(catchChance('common'), .4) && near(catchChance('pet'), .12) && near(catchChance('rare', { ball: 'good' }), .33) && catchChance('legend', { ball: 'gold' }) === 1 && catchChance('common', { berry: 'nanab' }) === .4
    && catchChance('common', { ball: 'good', quality: 'excellent', berry: 'razz' }) === 1, 'V13.162 잡힘 확률은 공 · 던지기 · 🍓를 곱하고(1을 넘지 않음), 황금 공은 무조건, 🍌는 확률을 바꾸지 않는다');
  const meetOdds = tier => { const p = catchChance(tier), f = HUNT.FLEE[tier] / 100; return p / (1 - (1 - p) * (1 - f)); };
  assert(meetOdds('common') > .7 && meetOdds('legend') < .25 && meetOdds('pet') < .4 && meetOdds('petEpic') < .2,
    `V13.162 한 번 만나 결국 잡힐 확률: 흔함 ${(meetOdds('common') * 100).toFixed(0)}% · 전설 ${(meetOdds('legend') * 100).toFixed(0)}% · 펫 ${(meetOdds('pet') * 100).toFixed(0)}% · 영웅 펫 ${(meetOdds('petEpic') * 100).toFixed(0)}%`);
  assert(rollThrow('common', {}, .1, .9).caught && rollThrow('common', {}, .1, .9).shakes === 3 && rollThrow('common', {}, .5, .1).fled && !rollThrow('common', {}, .5, .9).fled && rollThrow('legend', { ball: 'gold' }, .999, 0).caught,
    'V13.162 던지기 결과: 잡히면 흔들림 3번, 빠져나오면 도망 확률로 도망');
  assert(spawnTier(0) === 'common' && spawnTier(.5) === 'uncommon' && spawnTier(.995) === 'legend' && petTier(.1, { basic: 5, epic: 5 }) === 'petEpic' && petTier(.5, { basic: 5, epic: 5 }) === 'pet'
    && petTier(.5, { basic: 0, epic: 3 }) === 'petEpic' && petTier(.5, { basic: 0, epic: 0 }) === null, 'V13.162 등급 뽑기 · 펫 등급(한쪽을 다 모으면 다른 쪽, 다 모으면 펫 없음)');

  /* ---------- 밸런스 시뮬레이션 ---------- */
  const hard = huntSimAverage({ daily: 3, goodRolls: 2 }, 2000), easy = huntSimAverage({ daily: 1 }, 2000);
  assert(dayValue(hard) >= 75 && dayValue(hard) <= 105 && dayValue(easy) >= 24 && dayValue(easy) <= 40,
    `V13.162 하루 가치 ≈ 낚시 하루(열심 약 90 · 보통 약 30코인어치, 별조각은 600개 = 랜덤 알 400코인으로 계산): 열심 ${dayValue(hard)} · 보통 ${dayValue(easy)}`);
  assert(hard.basic + hard.epic < 2 && easy.basic + easy.epic < .7 && hard.basic > .4, `V13.162 펫은 가끔: 열심 30일 기본 ${hard.basic} · 영웅 ${hard.epic}, 보통 ${easy.basic}(예전 안은 기본 약 5 → 알을 안 사게 됨)`);
  assert(Math.round(hard.stars / 30) > HUNT.COIN_DAILY * .8 && huntSim({ daily: 3, goodRolls: 2, seed: 3 }).caught > 10, `V13.162 열심이면 하루 별조각 약 ${Math.round(hard.stars / 30)}개(코인 교환 하루 ${HUNT.COIN_DAILY} 근처), 한 달에 몬스터 수십 마리`);

  /* ---------- 공 받기 ---------- */
  {
    const p = { pets: [{ key: 'dog' }] }, hi = () => .99, lo = () => 0;
    const got = [grantBall(p, 'practice', { now: t0, random: hi }), grantBall(p, 'practice', { now: t0 + 1000, random: hi }), grantBall(p, 'attend', { now: t0, random: hi }), grantBall(p, 'match', { now: t0, random: hi }), grantBall(p, 'nope', { now: t0 })];
    assert(got.join() === 'basic,,basic,basic,' && p.hunt.basic === 3, 'V13.162 공은 연습 · 출석 · 짝 맞추기 곳마다 하루 1개(하루 3개), 다른 곳에서는 안 준다');
    grantBall(p, 'practice', { now: t0 + DAY, random: hi }); grantBall(p, 'attend', { now: t0 + DAY, random: hi }); grantBall(p, 'match', { now: t0 + DAY, random: hi });
    assert(p.hunt.basic === 6 && grantBall(p, 'practice', { now: t0 + 2 * DAY }) === null && p.hunt.basic === 6, 'V13.162 다음 날 다시 받고, 6개가 차면 더 받지 않는다');
    const q = { pets: [{ key: 'dog' }] };
    assert(grantBall(q, 'practice', { now: t0, random: lo }) === 'basic' && grantBall(q, 'match', { lucky: true, now: t0, random: lo }) === 'good' && grantBall(q, 'attend', { lucky: true, now: t0, random: lo }) === 'basic'
      && q.hunt.good === 1 && q.hunt.basic === 2, 'V13.162 좋은 공은 만점 연습 · 별 3에서 가끔(하루 1개, 받는 공 3개 안에서 바뀜)');
    const g = {};
    const cards = [huntCard(g), huntCard(g), huntCard(g), huntCard(g)];
    assert(cards.join() === 'false,false,false,true' && g.hunt.gold === 1 && g.hunt.cards === 0, 'V13.162 출석 도장판 4장을 채우면 황금 공 1개(한 달에 1개)');
  }

  /* ---------- 지도 · 만남 · 던지기 · 가방 ---------- */
  {
    const rand = seeded(42);
    const p = { pets: [{ key: 'dog' }, { key: 'cat' }], avatar_key: 'dog', hunt: { basic: 6, good: 2, gold: 1 } };
    const map = huntMap(p, t0, rand);
    assert(map.spots.length >= HUNT.SPOTS[0] && map.spots.length <= HUNT.SPOTS[1] && map.spots.every(s => s.kind === 'monster' && HUNT_MONSTERS[s.key]?.tier === s.tier),
      'V13.162 지도에는 몬스터 3~5마리(처음에는 펫 없음: 펫 자리는 공을 써야 생긴다)');
    assert(map.spots.every(s => s.x >= 5 && s.x <= 95 && s.y >= 15 && s.y <= 90) && new Set(map.spots.map(s => s.cell)).size === map.spots.length, 'V13.162 지도 위 자리는 겹치지 않는다');
    assert(JSON.stringify(huntMap(p, t0 + 60000, rand).spots) === JSON.stringify(map.spots) && huntSlot(t0 + HUNT.SLOT_HOURS * 3600000) === huntSlot(t0) + 1, 'V13.162 지도는 같은 시간대에는 그대로, 몇 시간마다 바뀐다');
    // 펫 자리: 이름을 숨긴다. 예전 판(펫 사냥) 자리는 지운다.
    const petKey = STANDARD_PET_KEYS.find(k => k !== 'dog' && k !== 'cat');
    p.hunt.map.spots.push({ id: 'px', kind: 'pet', key: petKey, tier: 'pet', form: 1, x: 50, y: 50, cell: 4 }, { id: 'old', key: 'dog', tier: 'basic', fresh: false, x: 20, y: 20, cell: 0 });
    huntMap(p, t0 + 120000, rand);
    const view = huntView(p, t0);
    const pv = view.spots.find(s => s.id === 'px');
    assert(pv && !('key' in pv) && !JSON.stringify(pv).includes(petKey) && !view.spots.some(s => s.id === 'old'), 'V13.162 지도에서 펫은 이름 · 등급을 숨기고(반짝이는 ?), 예전 판 자리는 지운다');
    const first = map.spots[0];
    huntMeet(p, first.id, t0, rand);
    const later = huntMap(p, t0 + HUNT.SLOT_HOURS * 3600000, rand);
    assert(later.spots.some(s => s.id === 'px') && later.spots.some(s => s.id === first.id), 'V13.162 지도가 바뀌어도 펫 · 만나는 중인 몬스터는 그대로');
    assert(throws(() => huntMeet(p, 'nope', t0, rand)) === 404, 'V13.162 지도에 없는 자리는 만날 수 없다');
    const now = t0 + HUNT.SLOT_HOURS * 3600000, spot = first.id;
    const miss = huntThrow(p, { id: 'throw-0001', spot, ball: 'basic', quality: 'perfect!!', berry: 'gold', now, random: seq([.99, .99]) });
    const again = huntThrow(p, { id: 'throw-0001', spot, ball: 'basic', now, random: () => 0 });
    assert(!miss.caught && !miss.fled && miss.quality === null && miss.berry === null && again.again && again.caught === false && p.hunt.basic === 5, 'V13.162 같은 던지기(id)를 다시 보내면 공을 또 쓰지 않고 같은 답, 정해진 품질 · 열매만 받는다');
    assert(throws(() => huntThrow(p, { id: 'throw-0002', spot: 'other', ball: 'basic', now })) === 404, 'V13.162 만나는 중인 몬스터에게만 던진다');
    // 몬스터를 🍍로 잡으면 가방에 2마리 · 도감 · 파트너 펫 경험치.
    const got = huntThrow(p, { id: 'throw-0004', spot, ball: 'basic', berry: 'pinap', quality: 'great', pet: 'dog', now, random: () => 0 });
    const xpRow = p.bonus?.log?.find(x => x.k === 'dog');
    assert(got.caught && got.kind === 'monster' && got.n === 2 && got.fresh && p.hunt.bag[first.key] === 2 && p.hunt.book[first.key].n === 2 && got.stars === HUNT.STARS[first.tier] * 2 && xpRow?.xp === HUNT.XP[first.tier] && !xpRow.c
      && !p.hunt.live && !p.hunt.map.spots.some(s => s.id === spot), 'V13.162 몬스터를 잡으면 가방 · 도감에 넣고(🍍면 2마리) 파트너 펫이 경험치(코인은 안 줌), 만남이 끝나면 자리가 사라진다');
    // 팔기 → 별조각 → 교환소.
    const sold = huntSell(p, {});
    assert(sold.sold === 2 && sold.stars === HUNT.STARS[first.tier] * 2 && p.hunt.stars === sold.stars && !Object.keys(p.hunt.bag).length && throws(() => huntSell(p, {})) === 409, 'V13.162 가방 몬스터를 팔면 별조각, 팔 게 없으면 못 판다');
    p.hunt.stars = 2000;
    const before = rewardIncome(p);
    huntCoins(p, HUNT.COIN_DAILY, now);
    assert(rewardIncome(p) - before === HUNT.COIN_DAILY && throws(() => huntCoins(p, 1, now)) === 409 && huntView(p, now).coin_left === 0 && huntView(p, now + DAY).coin_left === HUNT.COIN_DAILY, `V13.162 별조각 → 코인 1:1, 하루 ${HUNT.COIN_DAILY}코인까지(코인 지갑에 들어간다)`);
    huntSpend(p, 'egg', now)();
    assert(p.hunt.stars === 2000 - HUNT.COIN_DAILY - HUNT.EGG && throws(() => huntSpend(p, 'egg', now)) === 409 && typeof huntSpend(p, 'epic_egg', now) === 'function' && huntView(p, now + DAY).egg_left === 1,
      `V13.162 교환소 랜덤 알 ${HUNT.EGG} · 영웅 알 ${HUNT.EPIC_EGG}, 각각 하루 1개`);
    // 펫: 황금 공은 무조건, 잡으면 내 펫(파트너).
    huntMeet(p, 'px', now, rand);
    const fresh = huntThrow(p, { id: 'throw-0005', spot: 'px', ball: 'gold', now, random: () => .999 });
    assert(fresh.caught && fresh.new_pet && fresh.kind === 'pet' && p.pets.some(x => x.key === petKey && x.hunt) && p.avatar_key === petKey && p.hunt.gold === 0 && !CHARACTERS[petKey].legendary,
      'V13.162 황금 공은 무조건 잡히고, 펫은 내 펫이 되어 알 상점 알처럼 바로 파트너가 된다');
  }
  // 펫 자리는 만남을 끝낼(잡거나 도망) 때만 약 7% 생긴다: 도망 버튼(다시 만나기)이나 지도 바뀜으로는 생기지 않는다.
  {
    const p = { pets: ['dog', 'cat', 'pig'].map(key => ({ key })), hunt: { basic: 0 } };
    const rand = seeded(7);
    let now = t0, petSeen = 0, ends = 0;
    for (let slot = 0; slot < 40; slot++, now += HUNT.SLOT_HOURS * 3600000) for (const s of huntMap(p, now, rand).spots) huntMeet(p, s.id, now, rand);
    assert(!p.hunt.map.spots.some(s => s.kind === 'pet'), 'V13.162 만나기만 하고 도망(던지지 않음) · 지도 바뀜으로는 펫이 생기지 않는다');
    for (let i = 0; i < 4000; i++) {
      const mon = huntMap(p, now, rand).spots.find(s => s.kind === 'monster');
      p.hunt.basic = 1;
      huntMeet(p, mon.id, now, rand);
      huntThrow(p, { id: `sim-${String(i).padStart(6, '0')}`, spot: mon.id, ball: 'basic', now, random: (() => { const r = [.99, 0]; return () => r.length ? r.shift() : rand(); })() });
      ends++;
      const f = p.hunt.map.spots.find(s => s.kind === 'pet');
      if (f) { petSeen++; p.hunt.map.spots = p.hunt.map.spots.filter(s => s !== f); }
    }
    const rate = petSeen / ends * 100;
    assert(rate > 5.5 && rate < 8.5, `V13.162 만남을 끝낼 때마다 펫 자리 약 7%(${rate.toFixed(1)}%)`);
    // 몬스터 등급 분포(지도에 자리가 생길 때).
    const r2 = seeded(11), count = Object.fromEntries(MONSTER_TIERS.map(t => [t, 0]));
    for (let i = 0; i < 20000; i++) count[spawnTier(r2())]++;
    assert(MONSTER_TIERS.every(t => Math.abs(count[t] / 200 - HUNT.SPAWN[t]) < 1.2), `V13.162 몬스터 등급 확률(${MONSTER_TIERS.map(t => `${t} ${(count[t] / 200).toFixed(1)}%`).join(' · ')})`);
  }
  // 기본 · 영웅을 다 모으면 펫 없이 몬스터만.
  {
    const p = { pets: [...STANDARD_PET_KEYS, ...EPIC_PET_KEYS].map(key => ({ key })), hunt: { basic: 100 } };
    const rand = seeded(9);
    for (let i = 0; i < 60; i++) {
      const s = huntMap(p, t0, rand).spots[0];
      huntMeet(p, s.id, t0, rand);
      huntThrow(p, { id: `full-${String(i).padStart(5, '0')}`, spot: s.id, ball: 'basic', now: t0, random: () => 0 });
    }
    assert(!p.hunt.map.spots.some(s => s.kind === 'pet') && p.pets.length === STANDARD_PET_KEYS.length + EPIC_PET_KEYS.length && huntView(p, t0).kinds > 0, 'V13.162 기본 · 영웅 펫을 다 모았으면 펫 없이 몬스터만 나온다');
  }

  /* ---------- 서버 연결: 출석 · 짝 맞추기 · 연습 · 경로 ---------- */
  {
    const state = emptyState(), hash = await passwordHash('QaHunt1!'), now = Date.now();
    state.profiles.push({ id: 'qa-hunt', username: 'qa-hunt', display_name: '사냥', role: 'student', active: true, class_name: '고1A', school_id: 'danwon-high', school: '단원고', division: 'high', password_hash: hash, pets: [{ key: 'dog', first: true, acquired_at: now - 9 * DAY }], avatar_key: 'dog', created_at: now - 9 * DAY });
    const token = (await service(state, 'POST', '/login', { username: 'qa-hunt', password: 'QaHunt1!', division: 'high' }, null))._cookie;
    const call = (method, path, body = {}) => service(state, method, path, body, token);
    const me = state.profiles.find(x => x.id === 'qa-hunt');
    const before = JSON.stringify(me);
    const boot = await call('GET', '/bootstrap');
    assert(boot.rewards.hunt && boot.rewards.hunt.basic === 0 && JSON.stringify(me) === before, 'V13.162 홈 데이터에 몬스터 사냥이 오고, 읽기만으로 학생 기록이 바뀌지 않는다');
    me.attendance = { card: 6, last: dayKey(now - DAY), streak: 6 };
    me.hunt = { cards: 3 };
    const att = await call('POST', '/attendance/check');
    assert(att.ball === 'basic' && att.gold_ball === true && att.hunt.basic === 1 && att.hunt.gold === 1 && att.hunt.got.attend, 'V13.162 출석하면 공 1개, 도장판 4장째를 채우면 황금 공');
    const home = await call('POST', '/hunt/home');
    assert(home.hunt.spots.length >= HUNT.SPOTS[0] && home.hunt.spots.every(s => s.kind === 'monster' && HUNT_MONSTERS[s.key]), 'V13.162 지도를 열면 서버가 몬스터를 정한다');
    const met = await call('POST', '/hunt/meet', { spot: home.hunt.spots[0].id });
    assert(met.key === home.hunt.spots[0].key && met.kind === 'monster' && met.hunt.live.spot === home.hunt.spots[0].id, 'V13.162 만나면 어떤 몬스터인지 알려 준다');
    let failed = false; try { await call('POST', '/hunt/throw', { spot: met.spot, ball: 'basic' }); } catch (e) { failed = e.status === 400; }
    const thr = await call('POST', '/hunt/throw', { id: 'qa-throw-0001', spot: met.spot, ball: 'basic', quality: 'excellent' });
    const thr2 = await call('POST', '/hunt/throw', { id: 'qa-throw-0001', spot: met.spot, ball: 'basic' });
    assert(failed && thr.hunt.basic === 0 && thr2.again && thr2.hunt.basic === 0 && thr.quality === 'excellent', 'V13.162 던지기는 번호가 있어야 하고, 같은 번호는 한 번만(공 하나)');
    me.hunt.bag = { slime: 3 }; me.hunt.stars = 0;
    const sold = await call('POST', '/hunt/sell', { key: 'slime', n: 2 });
    me.hunt.stars = 1000;
    const coins = await call('POST', '/hunt/exchange', { item: 'coins', amount: 30 });
    const egg = await call('POST', '/hunt/exchange', { item: 'egg' });
    assert(sold.sold === 2 && sold.hunt.bag.slime === 1 && coins.coins === 30 && typeof coins.points_balance === 'number' && egg.key && STANDARD_PET_KEYS.includes(egg.key) && egg.hunt.stars === 1000 - 30 - HUNT.EGG && egg.hunt.egg_left === 0,
      'V13.162 경로: 가방 팔기 · 교환소 코인 · 랜덤 알(알 상점과 같은 알 깨기)');
    const svc = source('./service.mjs'), games = source('./games.mjs');
    assert(svc.includes("if (complete && student && answerRecords.length >= HUNT.MIN_PRACTICE) { const ball = grantBall(student, 'practice', { lucky: perfect, now: endedAt });")
      && games.includes("const ball = stars === 3 ? grantBall(p, 'match', { lucky: true, now }) : null;") && svc.includes("ball: x.finished ? (x.ball || null) : undefined") && svc.includes('pet: activePetKey(state, p.id), now });'),
      'V13.162 끝까지 푼 연습(10문제 이상)과 짝 맞추기 별 3도 공 1개(만점 · 별 3은 가끔 좋은 공), 잡으면 파트너 펫 경험치');
    assert(svc.includes("'reel', 'hunt'].filter(k => old[k])") && svc.includes('preview.hunt.basic = Math.max('), 'V13.162 사냥 기록도 로그인 때 지키고, 교사 미리보기 계정은 공을 채운다');
  }

  /* ---------- 화면 ---------- */
  {
    const ui = source('../public/modules/hunt.js'), games = source('../public/modules/arcade-games.js'), arcade = source('../public/modules/arcade.js'), app = source('../public/app.js');
    const moments = source('../public/modules/pet-moments.js'), lucky = source('../public/modules/lucky.js'), css = source('../public/v13162.css'), build = source('./build-assets.mjs');
    assert(ui.includes('export const HUNT_ART = new Set([') && ui.includes("const has = name => HUNT_ART.has(name);") && ui.includes("art('ball-spin'") && ui.includes("art('fx-smoke'") && ui.includes("has('bg-catch')") && ui.includes('`bg-${v.area || \'forest\'}-${v.night ? \'night\' : \'day\'}`'),
      'V13.162 그림(주문서 34)은 HUNT_ART에 이름이 있으면 쓰고, 없으면 코드 그림 · 이모지(낚시 FISHING_ART와 같은 방식)');
    assert(ui.includes("const monSrc = (key, pose = '') => `/assets/monsters/${key}") && ui.includes("pose('attack', dur)") && ui.includes("pose('hurt', 1100)") && ui.includes('<strong>몬스터 사냥</strong>'),
      'V13.162 몬스터는 기존 몬스터 그림(덤빌 때 공격 자세, 빠져나오면 맞은 자세)');
    assert(ui.includes("api('/hunt/meet'") && ui.includes("api('/hunt/throw'") && ui.includes('throwId()') && ui.includes('hn-flash') && ui.includes('야생의 <b>') && ui.includes('나타났다!')
      && ui.includes('ringScale') && ui.includes("rs < .45 ? 'excellent' : rs < .7 ? 'great'") && ui.includes('정말 쓸까요?') && ui.includes("data-hn=\"run\"") && ui.includes("data-hn=\"bag\"") && ui.includes("data-hn=\"berry\""),
      'V13.162 화면: 하얀 번쩍임 → "야생의 ○○이 나타났다!", 줄어드는 원(나이스 · 그레이트 · 엑설런트), 도망 · 가방 · 열매, 황금 공 "정말 쓸까요?"');
    assert(ui.includes('wob-l') && ui.includes("ball-lock") && ui.includes('잡았다!') && ui.includes('빠져나왔어요') && ui.includes('도망쳤어요') && ui.includes("huntPetShow(res.key, res.tier === 'petEpic' ? 'epic' : 'basic')"),
      'V13.162 결과: 흔들림 → 딸깍 + 별 "잡았다!" / 빠져나옴 / 도망 연기, 펫은 알 상점과 같은 펫 공개 연출');
    assert(ui.includes('function monsterBag()') && ui.includes('function monsterBook()') && ui.includes('function shop()') && ui.includes("api('/hunt/sell'") && ui.includes("api('/hunt/exchange'") && ui.includes("path: '/hunt/exchange'") && ui.includes("class=\"shadow\""),
      'V13.162 지도 아래 가방(팔기 · 모두 팔기) · 도감(못 잡은 몬스터는 그림자) · 별조각 교환소(코인 · 랜덤 알 · 영웅 알)');
    assert(ui.includes('const reachOf = power =>') && ui.includes("'short'") && ui.includes("'over'") && ui.includes('function flightStep(now)') && ui.includes('hn-bshadow') && ui.includes('scaleAt(z)'),
      'V13.162 공은 원근 포물선으로 날아가 작아지고(그림자도 따라감), 약하면 앞에 떨어지고 세면 넘어간다(이때는 서버에 안 보내 공을 안 쓴다)');
    assert(ui.includes('drag.spin') && ui.includes('커브볼!') && ui.includes('function petAct(now)') && ui.includes("kind === 'attack'") && ui.includes('function deflect(') && ui.includes('hn-beam') && ui.includes("classList.add('lit')"),
      'V13.162 커브볼(손가락으로 원 그리기, 잡힐 확률은 그대로) · 덤비거나 피할 때 맞히면 튕겨 나감 · 맞으면 빛이 되어 공에 빨려 들어감');
    assert(ui.includes("addEventListener('devicemotion', onMotion)") && ui.includes('DeviceMotionEvent.requestPermission') && ui.includes("addEventListener('deviceorientation', onTilt)") && ui.includes('두 손으로 꼭') && ui.includes('stopMotion(); stopTilt();'),
      'V13.162 📱 폰으로 던지기(가속도계, 아이폰 허락, 두 손으로 꼭 안내) · 기울이면 배경이 움직임(자이로), 나가면 센서를 끈다');
    assert(ui.includes('function zoomTo(btn)') && ui.includes('hn-radar') && ui.includes('hn-rustles') && css.includes('@keyframes hn-petdrop') && css.includes('@keyframes hn-rustle'),
      'V13.162 지도: 내 파트너 레이더 · 바스락 풀숲 · 누르면 카메라 줌, 위에서 떨어지며 등장');
    assert(ui.includes('arcadeWords(H.A)') && ui.includes('function quiz(berry)') && ui.includes('H.berryTried = true'), 'V13.162 열매는 게임 단어(학습 범위)에서 단어 문제를 맞혀야 받는다(한 공에 한 번)');
    assert(moments.includes('export async function huntPetShow(key, tier)') && moments.includes("epicShow({ key, from: 'hunt' })") && moments.includes("eggRevealHtml(openOverlay('새 친구'), key") && lucky.includes("from === 'hunt' ? '몬스터 사냥에서 영웅 펫을 잡았어요!'"),
      'V13.162 펫 공개: 기본은 알 이름 카드(eggRevealHtml), 영웅은 영웅 연출(epicShow)');
    assert(games.includes('export function huntCard(A, art)') && games.includes('${huntCard(A, art)}') && games.includes('data-action="hunt-open"') && games.includes("art?.hunt?.has('entry')") && games.includes('<strong>몬스터 사냥</strong>')
      && arcade.includes('hunt: HUNT_ART') && app.includes("if (d.action === 'hunt-open')") && app.includes('openHunt(A,'),
      'V13.162 놀이터 게임 묶음에 몬스터 사냥 그림 카드(공 · 별조각 · 도감), 그림이 오면 entry 그림');
    assert(build.includes('"v13162.css"') && css.includes('.hn-rings') && css.includes('@keyframes hn-wob-l') && css.includes('.ag-hunt') && css.includes('.hn-book-cell img.shadow') && css.includes('prefers-reduced-motion'), 'V13.162 몬스터 사냥 스타일(원 · 흔들림 · 입구 카드 · 도감)');
  }

  /* ---------- 그림 주문서 34 ---------- */
  {
    const R = '../docs/asset-requests/runner/';
    const orders = ['34a-hunt-backgrounds.txt', '34b-hunt-ui.txt'].flatMap(f => source(R + f).trim().split('\n---\n'));
    const codex = source(R + 'CODEX_PROMPT_34.md'), map = source(R + 'slice-map.csv'), readme = source(R + 'README.md');
    const names = ['bg-forest-day', 'bg-forest-night', 'bg-field-day', 'bg-field-night', 'bg-beach-day', 'bg-beach-night', 'bg-catch', 'entry', 'ball-basic', 'ball-good', 'ball-gold', 'ball-open', 'ball-spin', 'ball-tilt-l', 'ball-tilt-r', 'ball-lock',
      'fx-sparkle', 'fx-star', 'fx-burst', 'fx-smoke', 'ring-green', 'ring-yellow', 'ring-red', 'fx-mystery', 'berry-razz', 'berry-pinap', 'berry-nanab', 'bag'];
    assert(orders.length === 13 && orders.every(t => t.includes('STYLE REFERENCE — before drawing, open') && /named exactly "34[ab]-\d\.png"/.test(t) && t.includes('"SUMUS 펫 사냥 34 (Runner용)"') && t.includes('showing the picture in the chat is not enough')),
      'V13.162 그림 주문서 34(펫 사냥 13시트): 모두 Drive의 기존 그림을 열어 그림체를 맞추고, 정해진 Drive 폴더에 정확한 파일 이름으로 저장');
    assert(codex.includes('Drive의 기존 그림을 열어 그림체를 맞춘다') && codex.includes('정해진 Drive 폴더 "SUMUS 펫 사냥 34 (Runner용)"에 정확한 파일 이름') && codex.includes('펫 그림은 새로 그리지 않는다') && codex.includes('`HUNT_ART`'),
      'V13.162 CODEX_PROMPT_34: 그림체 맞추기 · 정해진 폴더와 파일 이름 · 펫은 기존 그림 · HUNT_ART');
    assert(names.every(n => map.includes(`public/assets/hunt/${n}.webp`)) && readme.includes('34a-hunt-backgrounds.txt') && orders.filter(t => t.includes('No characters, no animals')).length === 7, 'V13.162 28장 모두 자르기 표에, 지도 · 잡기 배경에는 펫을 그리지 않는다');
  }
}
