// V13.162 검사: 펫 사냥(놀이터). 공 받기(공부로만) · 좋은 공 · 황금 공, 누가 나오나(새 친구 20% · 기본 85% · 영웅 15%,
// 전설 · 신화 · 한정은 안 나옴), 잡힘 · 도망 확률, 던지기 영수증, 밸런스 시뮬레이션(열심 30일 새 기본 약 5 · 영웅 약 0.4,
// 보통 약 1.8 → 하루 가치 ≈ 낚시: 열심 약 90 · 보통 약 30코인어치), 화면 · 그림 주문서 34.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dayKey, STANDARD_PET_KEYS, EPIC_PET_KEYS, LEGENDARY_PET_KEYS, MYTHIC_PET_KEYS, CHARACTERS } from '../public/modules/core.js';
import { seeded } from '../public/modules/fishing-rules.js';
import { HUNT, catchChance, rollThrow, freshTier, huntSim, huntSimAverage, huntSlot } from '../public/modules/hunt-rules.js';
import { grantBall, huntCard, huntMap, huntView, huntMeet, huntThrow } from './hunt.mjs';
import { emptyState } from './state.mjs';
import { passwordHash } from './auth.mjs';
import { service } from './service.mjs';

const source = path => readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8');
const throws = fn => { try { fn(); return null; } catch (e) { return e.status || 500; } };
const near = (a, b, d = 1e-9) => Math.abs(a - b) <= d;
const DAY = 86400000;

export async function runHuntChecks(assert) {
  const t0 = Date.parse('2026-10-20T03:00:00Z');

  /* ---------- 규칙 숫자(선생님 결정) ---------- */
  assert(HUNT.SOURCES.join() === 'practice,attend,match' && HUNT.BALL_MAX === 6 && HUNT.MIN_PRACTICE === 10 && HUNT.GOLD_CARDS === 4 && HUNT.GOOD_DAILY === 1,
    'V13.162 공은 공부로만: 연습 끝내기(10문제 이상) · 출석 · 짝 맞추기 별 3, 곳마다 하루 1개(하루 최대 3개), 6개까지 보관, 황금 공은 출석 도장판 4장마다');
  assert(HUNT.FRESH === 20 && HUNT.FRESH_EPIC === 15 && HUNT.CATCH.basic === 25 && HUNT.FLEE.basic === 25 && HUNT.CATCH.epic === 10 && HUNT.FLEE.epic === 30,
    'V13.162 새 친구 20%(기본 85 · 영웅 15), 잡힘 · 도망: 기본 25% · 25%, 영웅 10% · 30%');
  assert(HUNT.THROWS.nice === 1.1 && HUNT.THROWS.great === 1.25 && HUNT.THROWS.excellent === 1.6 && HUNT.BALLS.good === 1.5 && HUNT.BERRY_CATCH === 1.5 && HUNT.BERRY_REWARD === 2 && HUNT.DUP_COINS === 10,
    'V13.162 나이스 ×1.1 · 그레이트 ×1.25 · 엑설런트 ×1.6, 좋은 공 ×1.5, 🍓 ×1.5, 🍍 보상 ×2, 가진 펫은 10코인');
  assert(catchChance('basic') === .25 && catchChance('epic') === .1 && near(catchChance('basic', { ball: 'good' }), .375) && near(catchChance('epic', { quality: 'excellent', berry: 'razz' }), .24)
    && catchChance('epic', { ball: 'gold' }) === 1 && catchChance('basic', { berry: 'nanab' }) === .25 && catchChance('basic', { ball: 'good', quality: 'excellent', berry: 'razz' }) <= 1,
    'V13.162 잡힘 확률은 공 · 던지기 · 🍓를 곱하고(1을 넘지 않음), 황금 공은 무조건, 🍌는 확률을 바꾸지 않는다');
  // 한 번 만나서 결국 잡힐 확률(열매 없이, 기본 공): p / (1 - (1-p)(1-도망)).
  const meetOdds = tier => { const p = catchChance(tier), f = HUNT.FLEE[tier] / 100; return p / (1 - (1 - p) * (1 - f)); };
  assert(Math.round(meetOdds('basic') * 100) === 57 && Math.round(meetOdds('epic') * 100) === 27, `V13.162 한 번 만나 결국 잡힐 확률: 기본 약 57%(${(meetOdds('basic') * 100).toFixed(1)}) · 영웅 약 28%(${(meetOdds('epic') * 100).toFixed(1)})`);
  assert(rollThrow('basic', {}, .1, .9).caught && rollThrow('basic', {}, .1, .9).shakes === 3 && !rollThrow('basic', {}, .5, .9).fled && rollThrow('basic', {}, .5, .1).fled && rollThrow('epic', { ball: 'gold' }, .999, 0).caught,
    'V13.162 던지기 결과: 잡히면 흔들림 3번, 빠져나오면 도망 확률로 도망');
  assert(freshTier(.1, { basic: 5, epic: 5 }) === 'epic' && freshTier(.5, { basic: 5, epic: 5 }) === 'basic' && freshTier(.5, { basic: 0, epic: 3 }) === 'epic' && freshTier(.1, { basic: 3, epic: 0 }) === 'basic' && freshTier(.5, { basic: 0, epic: 0 }) === null,
    'V13.162 새 친구 등급: 영웅 15% · 기본 85%, 한쪽을 다 모았으면 다른 쪽, 둘 다 모았으면 새 친구 없음');

  /* ---------- 밸런스 시뮬레이션 ---------- */
  const hard = huntSimAverage({ daily: 3, goodRolls: 2 }), easy = huntSimAverage({ daily: 1 });
  const value = r => (r.basic * 400 + r.epic * 800 + r.coins) / 30;
  assert(hard.basic >= 4.5 && hard.basic <= 6.2 && hard.epic >= .3 && hard.epic <= .7, `V13.162 열심(공 3개/일) 30일: 새 기본 약 5(${hard.basic}) · 영웅 약 0.4(${hard.epic})`);
  assert(easy.basic >= 1.4 && easy.basic <= 2.2, `V13.162 보통(공 1개/일) 30일: 새 기본 약 1.8(${easy.basic})`);
  assert(value(hard) >= 75 && value(hard) <= 110 && value(easy) >= 22 && value(easy) <= 40,
    `V13.162 하루 가치 ≈ 낚시 하루(열심 약 90 · 보통 약 30코인어치, 랜덤 알 400 · 영웅 알 800으로 계산): 열심 ${Math.round(value(hard))} · 보통 ${Math.round(value(easy))}`);
  // 만나면 거의 새 펫이면(예전 안) 30일에 기본을 다 모아 알 상점이 쓸모없어진다: 지금 규칙은 한 달에 기본 21마리 중 일부만.
  assert(huntSim({ daily: 3, goodRolls: 2, days: 30, seed: 3 }).basic < 12 && huntSimAverage({ daily: 3, goodRolls: 2, days: 90 }, 600).basic < 18, 'V13.162 열심이어도 한 달에 기본 펫을 다 모으지 못한다(알 상점이 쓸모 있다)');

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

  /* ---------- 지도 · 만남 · 던지기 ---------- */
  {
    const rand = seeded(42);
    const owned = ['dog', 'cat', EPIC_PET_KEYS[0], LEGENDARY_PET_KEYS[0], MYTHIC_PET_KEYS[0]].filter(Boolean);
    const p = { pets: owned.map(key => ({ key })), avatar_key: 'dog', hunt: { basic: 6, good: 2, gold: 1 } };
    const map = huntMap(p, t0, rand);
    const allowed = new Set([...STANDARD_PET_KEYS, ...EPIC_PET_KEYS]);
    assert(map.spots.length >= HUNT.SPOTS[0] && map.spots.length <= HUNT.SPOTS[1] && map.spots.every(s => !s.fresh && allowed.has(s.key) && owned.includes(s.key)),
      'V13.162 지도에는 펫 3~5마리, 처음에는 가진 기본 · 영웅 펫만(전설 · 신화 · 한정 · 바다 펫은 안 나옴, 새 친구는 공을 써야 생긴다)');
    assert(map.spots.every(s => s.x >= 5 && s.x <= 95 && s.y >= 15 && s.y <= 90) && new Set(map.spots.map(s => s.cell)).size === map.spots.length, 'V13.162 지도 위 자리는 겹치지 않는다');
    const same = JSON.stringify(huntMap(p, t0 + 60000, rand).spots);
    assert(same === JSON.stringify(map.spots) && huntSlot(t0 + HUNT.SLOT_HOURS * 3600000) === huntSlot(t0) + 1, 'V13.162 지도는 같은 시간대에는 그대로, 몇 시간마다 바뀐다');
    // 새 친구 자리: 이름을 숨긴다.
    p.hunt.map.spots.push({ id: 'fx', key: STANDARD_PET_KEYS.find(k => !owned.includes(k)), tier: 'basic', fresh: true, form: 1, x: 50, y: 50, cell: 4 });
    const view = huntView(p, t0);
    assert(view.spots.find(s => s.id === 'fx') && !('key' in view.spots.find(s => s.id === 'fx')) && !JSON.stringify(view.spots.find(s => s.id === 'fx')).includes(p.hunt.map.spots.at(-1).key), 'V13.162 지도에서 새 친구는 이름 · 등급을 숨긴다(반짝이는 ? 실루엣)');
    // 지도가 바뀌어도 새 친구 자리와 만나는 중인 자리는 남는다.
    const meetDup = huntMeet(p, map.spots[0].id, t0, rand);
    const later = huntMap(p, t0 + HUNT.SLOT_HOURS * 3600000, rand);
    assert(meetDup.key === map.spots[0].key && later.spots.some(s => s.id === 'fx') && later.spots.some(s => s.id === map.spots[0].id), 'V13.162 지도가 바뀌어도 새 친구 · 만나는 중인 펫은 그대로');
    assert(throws(() => huntMeet(p, 'nope', t0, rand)) === 404, 'V13.162 지도에 없는 펫은 만날 수 없다');
    // 던지기: 영수증으로 두 번 안 되게, 공 없으면 못 던짐, 이상한 품질 · 열매는 무시.
    const now = t0 + HUNT.SLOT_HOURS * 3600000;
    const spot = p.hunt.live.spot;
    const miss = huntThrow(p, { id: 'throw-0001', spot, ball: 'basic', quality: 'perfect!!', berry: 'gold', now, random: (() => { const r = [.9, .9]; return () => r.shift(); })() });
    const again = huntThrow(p, { id: 'throw-0001', spot, ball: 'basic', now, random: () => 0 });
    assert(!miss.caught && !miss.fled && miss.quality === null && miss.berry === null && again.again && again.caught === false && p.hunt.basic === 5, 'V13.162 같은 던지기(id)를 다시 보내면 공을 또 쓰지 않고 같은 답, 정해진 품질 · 열매만 받는다');
    assert(throws(() => huntThrow(p, { id: 'throw-0002', spot: 'other', ball: 'basic', now })) === 404 && throws(() => huntThrow(p, { id: 'throw-0003', spot, ball: 'good', now, random: () => .99 })) === null && p.hunt.good === 1, 'V13.162 만나는 중인 펫에게만 던진다');
    // 가진 펫을 🍍로 잡으면 20코인 + 경험치(그 펫).
    const coinsBefore = (p.bonus?.log || []).reduce((n, x) => n + x.c, 0);
    const got = huntThrow(p, { id: 'throw-0004', spot, ball: 'basic', berry: 'pinap', quality: 'great', now, random: () => 0 });
    const row = p.bonus.log.find(x => x.k === got.key);
    assert(got.caught && got.coins === 20 && got.xp === HUNT.DUP_XP * 2 && p.bonus.log.reduce((n, x) => n + x.c, 0) - coinsBefore === 20 && row?.xp === HUNT.DUP_XP * 2 && !p.hunt.live && !p.hunt.map.spots.some(s => s.id === spot),
      'V13.162 가진 펫을 잡으면 코인 + 그 펫 경험치(🍍면 두 배), 만남이 끝나면 자리가 사라진다');
    // 새 친구: 황금 공은 무조건 잡히고, 펫이 생기며 파트너가 된다.
    huntMeet(p, 'fx', now, rand);
    const fresh = huntThrow(p, { id: 'throw-0005', spot: 'fx', ball: 'gold', now, random: () => .999 });
    const newKey = fresh.key;
    assert(fresh.caught && fresh.new_pet && fresh.fresh && p.pets.some(x => x.key === newKey && x.hunt) && p.avatar_key === newKey && p.hunt.gold === 0 && STANDARD_PET_KEYS.includes(newKey) && !CHARACTERS[newKey].legendary,
      'V13.162 황금 공은 무조건 잡히고, 새 친구는 내 펫이 되어 알 상점 알처럼 바로 파트너가 된다');
    assert(throws(() => huntThrow(p, { id: 'throw-0006', spot: p.hunt.map.spots[0].id, ball: 'gold', now })) !== null, 'V13.162 황금 공이 없으면 못 던진다');
  }
  // 새 친구 자리는 만남을 끝낼(잡거나 도망) 때만 약 20% 생긴다: 도망 버튼(다시 만나기)이나 지도 바뀜으로는 생기지 않는다.
  {
    const p = { pets: ['dog', 'cat', 'pig'].map(key => ({ key })), hunt: { basic: 0 } };
    const rand = seeded(7);
    let now = t0, freshSeen = 0, ends = 0;
    for (let slot = 0; slot < 40; slot++, now += HUNT.SLOT_HOURS * 3600000) {
      const map = huntMap(p, now, rand);
      for (const s of map.spots.filter(x => !x.fresh)) huntMeet(p, s.id, now, rand);
    }
    assert(!p.hunt.map.spots.some(s => s.fresh), 'V13.162 만나기만 하고 도망(던지지 않음) · 지도 바뀜으로는 새 친구가 생기지 않는다');
    for (let i = 0; i < 2000; i++) {
      const map = huntMap(p, now, rand);
      const dup = map.spots.find(s => !s.fresh);
      if (!dup) break;
      p.hunt.basic = 1;
      huntMeet(p, dup.id, now, rand);
      huntThrow(p, { id: `sim-${i.toString().padStart(6, '0')}`, spot: dup.id, ball: 'basic', now, random: (() => { const r = [.99, 0]; return () => r.length ? r.shift() : rand(); })() });
      ends++;
      const f = p.hunt.map.spots.find(s => s.fresh);
      if (f) { freshSeen++; p.hunt.map.spots = p.hunt.map.spots.filter(s => s !== f); }
    }
    const rate = freshSeen / ends * 100;
    assert(ends > 1500 && rate > 16 && rate < 24, `V13.162 만남을 끝낼 때마다 새 친구 약 20%(${rate.toFixed(1)}%)`);
  }
  // 기본 · 영웅을 다 모으면 새 친구 없이 가진 펫만.
  {
    const p = { pets: [...STANDARD_PET_KEYS, ...EPIC_PET_KEYS].map(key => ({ key })), hunt: { basic: 100 } };
    const rand = seeded(9);
    for (let i = 0; i < 60; i++) {
      const s = huntMap(p, t0, rand).spots[0];
      huntMeet(p, s.id, t0, rand);
      huntThrow(p, { id: `full-${String(i).padStart(5, '0')}`, spot: s.id, ball: 'basic', now: t0, random: () => 0 });
    }
    assert(!p.hunt.map.spots.some(s => s.fresh) && p.pets.length === STANDARD_PET_KEYS.length + EPIC_PET_KEYS.length, 'V13.162 기본 · 영웅을 다 모았으면 새 친구 없이 가진 펫만 나온다');
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
    assert(boot.rewards.hunt && boot.rewards.hunt.basic === 0 && JSON.stringify(me) === before, 'V13.162 홈 데이터에 펫 사냥이 오고, 읽기만으로 학생 기록이 바뀌지 않는다');
    me.attendance = { card: 6, last: dayKey(now - DAY), streak: 6 };
    me.hunt = { cards: 3 };
    const att = await call('POST', '/attendance/check');
    assert(att.ball === 'basic' && att.gold_ball === true && att.hunt.basic === 1 && att.hunt.gold === 1 && att.hunt.got.attend, 'V13.162 출석하면 공 1개, 도장판 4장째를 채우면 황금 공');
    const home = await call('POST', '/hunt/home');
    assert(home.hunt.spots.length >= HUNT.SPOTS[0] && home.hunt.spots.every(s => s.key === 'dog'), 'V13.162 지도를 열면 서버가 펫을 정한다(가진 펫이 하나면 그 펫만)');
    const met = await call('POST', '/hunt/meet', { spot: home.hunt.spots[0].id });
    assert(met.key === 'dog' && met.hunt.live.spot === home.hunt.spots[0].id, 'V13.162 만나면 어떤 펫인지 알려 준다');
    let failed = false; try { await call('POST', '/hunt/throw', { spot: met.spot, ball: 'basic' }); } catch (e) { failed = e.status === 400; }
    const thr = await call('POST', '/hunt/throw', { id: 'qa-throw-0001', spot: met.spot, ball: 'basic', quality: 'excellent' });
    const thr2 = await call('POST', '/hunt/throw', { id: 'qa-throw-0001', spot: met.spot, ball: 'basic' });
    assert(failed && thr.hunt.basic === 0 && thr2.again && thr2.hunt.basic === 0 && thr.quality === 'excellent', 'V13.162 던지기는 번호가 있어야 하고, 같은 번호는 한 번만(공 하나)');
    const svc = source('./service.mjs'), games = source('./games.mjs');
    assert(svc.includes("if (complete && student && answerRecords.length >= HUNT.MIN_PRACTICE) { const ball = grantBall(student, 'practice', { lucky: perfect, now: endedAt });")
      && games.includes("const ball = stars === 3 ? grantBall(p, 'match', { lucky: true, now }) : null;") && svc.includes("ball: x.finished ? (x.ball || null) : undefined"),
      'V13.162 끝까지 푼 연습(10문제 이상, 미끼와 같은 조건)과 짝 맞추기 별 3도 공 1개, 만점 · 별 3은 가끔 좋은 공');
    assert(svc.includes("'reel', 'hunt'].filter(k => old[k])") && svc.includes('preview.hunt.basic = Math.max('), 'V13.162 펫 사냥 기록도 로그인 때 지키고, 교사 미리보기 계정은 공을 채운다');
  }

  /* ---------- 화면 ---------- */
  {
    const ui = source('../public/modules/hunt.js'), games = source('../public/modules/arcade-games.js'), arcade = source('../public/modules/arcade.js'), app = source('../public/app.js');
    const moments = source('../public/modules/pet-moments.js'), lucky = source('../public/modules/lucky.js'), css = source('../public/v13162.css'), build = source('./build-assets.mjs');
    assert(ui.includes('export const HUNT_ART = new Set([') && ui.includes("const has = name => HUNT_ART.has(name);") && ui.includes("art('ball-spin'") && ui.includes("art('fx-smoke'") && ui.includes("has('bg-catch')") && ui.includes('`bg-${v.area || \'forest\'}-${v.night ? \'night\' : \'day\'}`'),
      'V13.162 그림(주문서 34)은 HUNT_ART에 이름이 있으면 쓰고, 없으면 코드 그림 · 이모지(낚시 FISHING_ART와 같은 방식)');
    assert(ui.includes("api('/hunt/meet'") && ui.includes("api('/hunt/throw'") && ui.includes('throwId()') && ui.includes('hn-flash') && ui.includes('야생의 <b>') && ui.includes('나타났다!')
      && ui.includes('ringScale') && ui.includes("rs < .45 ? 'excellent' : rs < .7 ? 'great'") && ui.includes('정말 쓸까요?') && ui.includes("data-hn=\"run\"") && ui.includes("data-hn=\"bag\"") && ui.includes("data-hn=\"berry\""),
      'V13.162 화면: 하얀 번쩍임 → "야생의 ○○이 나타났다!", 줄어드는 원(나이스 · 그레이트 · 엑설런트), 도망 · 가방 · 열매, 황금 공 "정말 쓸까요?"');
    assert(ui.includes('wob-l') && ui.includes("ball-lock") && ui.includes('잡았다!') && ui.includes('빠져나왔어요') && ui.includes('도망쳤어요') && ui.includes('huntPetShow(res.key, res.tier)'),
      'V13.162 결과: 흔들림 → 딸깍 + 별 "잡았다!" / 빠져나옴 / 도망 연기, 새 친구는 알 상점과 같은 펫 공개 연출');
    assert(ui.includes('arcadeWords(H.A)') && ui.includes('function quiz(berry)') && ui.includes('H.berryTried = true'), 'V13.162 열매는 게임 단어(학습 범위)에서 단어 문제를 맞혀야 받는다(한 공에 한 번)');
    assert(moments.includes('export async function huntPetShow(key, tier)') && moments.includes("epicShow({ key, from: 'hunt' })") && moments.includes("eggRevealHtml(openOverlay('새 친구'), key") && lucky.includes("from === 'hunt' ? '펫 사냥에서 영웅 펫을 잡았어요!'"),
      'V13.162 새 친구 공개: 기본은 알 이름 카드(eggRevealHtml), 영웅은 영웅 연출(epicShow)');
    assert(games.includes('export function huntCard(A, art)') && games.includes('${huntCard(A, art)}') && games.includes('data-action="hunt-open"') && games.includes("art?.hunt?.has('entry')")
      && arcade.includes('hunt: HUNT_ART') && app.includes("if (d.action === 'hunt-open')") && app.includes('openHunt(A,'),
      'V13.162 놀이터 게임 묶음에 펫 사냥 그림 카드(낚시터 · 짝 맞추기처럼), 그림이 오면 entry 그림');
    assert(build.includes('"v13162.css"') && css.includes('.hn-ring') && css.includes('@keyframes hn-wob-l') && css.includes('.ag-hunt') && css.includes('prefers-reduced-motion'), 'V13.162 펫 사냥 스타일(코드 공 · 원 · 흔들림 · 입구 카드)');
    assert(!/legendary|mythic|limited/.test(source('./hunt.mjs').match(/const dupPool[^\n]*/)[0]) && source('./hunt.mjs').includes('[...STANDARD_PET_KEYS, ...EPIC_PET_KEYS]'), 'V13.162 사냥에는 기본 · 영웅 펫만(전설 펫 야차전 특기 등 다른 규칙은 그대로)');
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
