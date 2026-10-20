import { randomBytes } from 'node:crypto';
import { dayKey } from '../public/modules/core.js';
import { FISH, FISH_KEYS } from '../public/modules/fishing-rules.js';
import { REEL, FIGHT, FINISH, CAST_TIERS, SEA_PETS, ROD, rodLevel, rodOf, reelRoll, pearlsOf } from '../public/modules/reel-rules.js';
import { findReceipt, keepReceipt, giveGift } from './rewards.mjs';

// V13.150 손맛 낚시(놀이터) 서버 쪽. 학생 기록 p.reel:
//   { bait, bait_day, bait_today, pearls, net{key: n}, coin_day, coin_today, coins (받은 코인 합), egg_day, epic_day(V13.160, 예전 epic_week), live{…}, guide, done[], rod (V13.154 낚싯대 단계 1~5) }
// 도감 · 황금 알 수는 예전 단어 낚시와 같은 p.games.fish.book · golden에 쌓는다.
// 물고기는 던질 때(reelCast) 서버가 정하고, 끌어올렸다고 보내면(reelLand) 최소 파이팅 시간을 확인한 뒤 어망에 넣는다.

const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };
const SLACK_MS = 1500;
const reel = p => p.reel ||= {};

// 미끼 받기(연습 끝 · 짝 맞추기 별 3 · 출석). 하루 REEL.BAIT_DAILY개, 들고 있는 것은 REEL.BAIT_MAX개까지. 받았으면 true.
export function grantBait(p, now = Date.now()) {
  const r = reel(p), today = dayKey(now);
  if (r.bait_day !== today) { r.bait_day = today; r.bait_today = 0; }
  if (r.bait_today >= REEL.BAIT_DAILY || Number(r.bait || 0) >= REEL.BAIT_MAX) return false;
  r.bait_today += 1;
  r.bait = Number(r.bait || 0) + 1;
  return true;
}

export function reelView(p, now = Date.now()) {
  const r = p.reel || {}, f = p.games?.fish || {}, today = dayKey(now);
  const net = Object.fromEntries(Object.entries(r.net || {}).filter(([k, n]) => FISH[k] && n > 0));
  return {
    bait: Number(r.bait || 0), bait_today: r.bait_day === today ? Number(r.bait_today || 0) : 0, bait_daily: REEL.BAIT_DAILY, bait_max: REEL.BAIT_MAX,
    pearls: Number(r.pearls || 0), net, net_pearls: Object.entries(net).reduce((s, [k, n]) => s + pearlsOf(k) * n, 0),
    coin_left: Math.max(0, REEL.COIN_DAILY - (r.coin_day === today ? Number(r.coin_today || 0) : 0)),
    egg_left: r.egg_day === today ? 0 : 1, epic_left: r.epic_day === today ? 0 : 1,
    book: f.book || {}, kinds: Object.keys(f.book || {}).length, all: FISH_KEYS.length, golden: Number(f.golden || 0) % REEL.GOLDEN_EGG,
    sea: SEA_PETS.map(x => ({ ...x, owned: (p.pets || []).some(pet => pet.key === x.key) })),
    rod: rodLevel(r.rod), rod_next: rodLevel(r.rod) < ROD.MAX ? ROD.COST[rodLevel(r.rod) + 1] : null,
    guide: !!r.guide, tut: !!r.tut, live: r.live && now - r.live.at < REEL.LIVE_MS ? { id: r.live.id } : null
  };
}

// 던지기: 미끼 1개를 쓰고 물고기를 정한다. 화면에는 파이팅 세기와 그림자 크기만(어떤 물고기인지는 끌어올린 뒤에).
export function reelCast(p, { id, cast, water = false, now = Date.now(), seed = randomBytes(4).readUInt32BE(0) }) {
  const r = reel(p);
  // V13.150.1 같은 던지기(id)를 다시 보내면(연결이 끊겨 다시 보냄 · 화면을 다시 열어 이어 하기) 미끼를 또 쓰지 않고 같은 답.
  const fightOf = live => { const F = FIGHT[live.rarity]; return { hp: F.hp, pull: F.pull, dash: F.dash, size: F.size, min: F.min, dist: F.dist, moves: F.moves, taps: F.taps, notes: F.notes, beat: F.beat }; };
  if (r.live && now - r.live.at < REEL.LIVE_MS) {
    if (id && r.live.id === id) return { id, fight: fightOf(r.live), bait: Number(r.bait || 0), again: true, at: r.live.at };
    fail('던진 낚싯대를 먼저 끌어올려 주세요.', 409);
  }
  if (Number(r.bait || 0) < 1) fail('미끼가 없어요. 공부하면 미끼를 받아요!', 409);
  r.bait -= 1;
  const tier = CAST_TIERS.includes(cast) ? cast : 'ok';
  const fish = reelRoll(seed, tier, { water });
  // V13.154 던질 때의 낚싯대 단계를 남긴다(끌어올릴 때 최소 파이팅 시간을 그만큼 줄여서 본다).
  r.live = { id, at: now, cast: tier, rod: rodLevel(r.rod), ...fish };
  // 어떤 물고기인지는 보내지 않는다: 등급마다 같은 세기 · 성격만.
  return { id, fight: fightOf(r.live), bait: r.bait };
}
// 끌어올리기(또는 놓침). 놓치면 미끼는 사라진다. 같은 끝내기를 다시 보내면 같은 답.
export function reelLand(p, { id, result, finish = null, now = Date.now(), giftId }) {
  const r = reel(p);
  const seen = findReceipt(r, 'reel', id);
  if (seen) return { ...seen.r, again: true };
  const live = r.live;
  if (!id || !live || live.id !== id) fail('던진 낚싯대를 찾지 못했어요.', 404);
  delete r.live;
  let out;
  if (result !== 'caught') out = { caught: false };
  else if (now - live.at + SLACK_MS < FIGHT[live.rarity].min / rodOf(live.rod).reel) out = { caught: false, reason: 'short' };
  else {
    const g = p.games ||= {}, f = g.fish ||= {}, book = f.book ||= {};
    // V13.150 마무리 퍼펙트: 무게 +8%(기록 · 자랑용, 진주 값은 그대로). 물고기의 무게 범위를 넘을 수 있다(그래서 '최고 무게').
    const perfect = finish === 'perfect' && live.key !== 'goldenegg';
    if (perfect) live.kg = Math.round(live.kg * FINISH.PERFECT_KG * 100) / 100;
    const fresh = !book[live.key]?.n;
    const b = book[live.key] ||= { n: 0, kg: 0 };
    const record = !fresh && live.kg > Number(b.kg || 0);
    b.n += 1; b.kg = Math.max(Number(b.kg || 0), live.kg);
    out = { caught: true, key: live.key, kg: live.kg, rarity: live.rarity, fresh, pearls: pearlsOf(live.key), record, perfect };
    if (live.key === 'goldenegg') {
      // 황금 알 물고기는 팔지 않고 모은다: 3마리마다 랜덤 알(선생님 알과 같은 선물 상자).
      const before = Math.floor(Number(f.golden || 0) / REEL.GOLDEN_EGG);
      f.golden = Number(f.golden || 0) + 1;
      out.golden = f.golden % REEL.GOLDEN_EGG;
      if (Math.floor(f.golden / REEL.GOLDEN_EGG) > before && giftId) { giveGift(p, { kind: 'egg', note: `황금 알 물고기 ${REEL.GOLDEN_EGG}마리를 모았어요!`, from: 'fishing', fromName: '낚시터', now, id: giftId }); out.egg = true; }
    } else {
      r.net ||= {};
      r.net[live.key] = Number(r.net[live.key] || 0) + 1;
    }
  }
  return keepReceipt(r, 'reel', id, out, now);
}
// 어망 물고기 팔기(진주로). key가 없으면 모두.
export function reelSell(p, { key = null, n = null } = {}) {
  const r = reel(p), net = r.net ||= {};
  const keys = key ? [key] : Object.keys(net);
  let pearls = 0, sold = 0;
  for (const k of keys) {
    const have = Number(net[k] || 0), take = Math.min(have, n === null || n === undefined ? have : Math.max(0, Math.floor(Number(n) || 0)));
    if (!FISH[k] || take <= 0) continue;
    net[k] = have - take;
    if (!net[k]) delete net[k];
    pearls += take * pearlsOf(k); sold += take;
  }
  if (!sold) fail('팔 물고기가 없어요.', 409);
  r.pearls = Number(r.pearls || 0) + pearls;
  return { sold, pearls };
}
// V13.154 낚싯대 강화: 진주 ROD.COST[다음 단계]를 쓰고 한 단계 올린다(5단계까지).
// V13.157 from: 화면이 본 지금 단계. 응답을 못 받고 다시 누르면 다음 단계까지 두 번 올리지 않게 막는다.
export function reelRodUp(p, from = null) {
  const r = reel(p), now = rodLevel(r.rod);
  if (from != null && Number(from) !== now) fail('낚싯대가 이미 강화됐어요. 화면을 다시 확인해 주세요.', 409);
  if (now >= ROD.MAX) fail('낚싯대가 이미 최고 단계예요!', 409);
  const cost = ROD.COST[now + 1];
  if (Number(r.pearls || 0) < cost) fail(`진주가 ${cost - Number(r.pearls || 0)}개 부족해요.`);
  r.pearls -= cost;
  r.rod = now + 1;
  return { rod: r.rod, cost, name: rodOf(r.rod).name };
}
// 진주로 코인(1:1, 하루 REEL.COIN_DAILY). 알 · 바다 펫은 service.mjs가 알을 깨는 함수와 함께 부른다(reelSpend).
export function reelCoins(p, amount, now = Date.now()) {
  const r = reel(p), today = dayKey(now);
  if (r.coin_day !== today) { r.coin_day = today; r.coin_today = 0; }
  const want = Math.floor(Number(amount) || 0), left = REEL.COIN_DAILY - r.coin_today;
  if (want < 1) fail('바꿀 진주 수를 골라 주세요.');
  if (want > left) fail(left ? `오늘은 ${left}코인까지 바꿀 수 있어요.` : '오늘 코인 교환을 다 했어요. 내일 또 와요!', 409);
  if (want > Number(r.pearls || 0)) fail(`진주가 ${want - Number(r.pearls || 0)}개 부족해요.`);
  r.pearls -= want; r.coin_today += want; r.coins = Number(r.coins || 0) + want;
  return { coins: want };
}
// 알 · 영웅 알: 한도와 진주를 확인하고 진주를 쓴다(알은 부른 쪽이 깬다).
export function reelSpend(p, item, now = Date.now()) {
  const r = reel(p), price = item === 'epic_egg' ? REEL.EPIC_EGG : item === 'egg' ? REEL.EGG : null;
  if (!price) fail('바꿀 것을 골라 주세요.');
  if (item === 'egg' && r.egg_day === dayKey(now)) fail('랜덤 알은 하루에 하나만 바꿀 수 있어요.', 409);
  if (item === 'epic_egg' && r.epic_day === dayKey(now)) fail('영웅 알은 하루에 하나만 바꿀 수 있어요.', 409);
  if (Number(r.pearls || 0) < price) fail(`진주가 ${price - Number(r.pearls || 0)}개 부족해요.`);
  return () => { r.pearls -= price; if (item === 'egg') r.egg_day = dayKey(now); else r.epic_day = dayKey(now); };
}
// 바다 펫: 교환소에서만, 진주 REEL.SEA_PET개. 그림이 들어오기 전(REEL.SEA_READY가 false)에는 잠겨 있다.
// 영웅급 펫으로 들어오고(알 상점 · 뽑기 · 선생님 알에서는 나오지 않는다), 이미 함께하는 바다 펫은 다시 못 바꾼다.
export function reelSeaPet(p, key, now = Date.now(), ready = REEL.SEA_READY) {
  const sea = SEA_PETS.find(x => x.key === key);
  if (!sea) fail('바다 펫을 골라 주세요.');
  if (!ready) fail('바다 펫은 그림이 완성되면 만날 수 있어요. 진주를 모아 두세요!', 409);
  if ((p.pets || []).some(x => x.key === key)) fail(`이미 ${sea.ko}와 함께하고 있어요.`, 409);
  const r = reel(p);
  if (Number(r.pearls || 0) < REEL.SEA_PET) fail(`진주가 ${REEL.SEA_PET - Number(r.pearls || 0)}개 부족해요.`);
  r.pearls -= REEL.SEA_PET;
  (p.pets ||= []).push({ key, acquired_at: now, epic: true, sea: true });
  (p.purchases ||= []).push({ item: 'sea_pet', key, price: 0, pearls: REEL.SEA_PET, at: now });
  return { key, epic: true, sea: true };
}
