import { dayKey, STANDARD_PET_KEYS, EPIC_PET_KEYS } from '../public/modules/core.js';
import { HUNT, BALL_KINDS, BERRIES, HUNT_MONSTERS, MONSTER_KEYS, spawnPool, monsterReady, rollThrow, spawnTier, petTier, huntSlot, guardQuality } from '../public/modules/hunt-rules.js';
import { displayEnglish } from '../public/modules/core.js';
import { cardMeaning } from '../public/modules/match-rules.js';
import { findReceipt, keepReceipt, addBonus, secureRandom } from './rewards.mjs';

// V13.162 몬스터 사냥(놀이터) 서버 쪽. 학생 기록 p.hunt:
//   { basic, good, gold (공), got{ day, practice, attend, match, good } (오늘 받은 곳), cards (황금 공까지 채운 출석 도장판),
//     map{ slot, spots[{ id, kind: 'monster'|'pet', key, tier, form, x, y, cell }] }, live{ spot, kind, key, tier, at, throws },
//     bag{ 몬스터: 수 }, book{ 몬스터: { n } } (도감), stars (별조각), coin_day · coin_today · coins (바꾼 코인 합), egg_day, epic_day, met, caught, done[] (영수증) }
// 지도의 몬스터 · 펫(누가 나오나)은 서버가 정한다. 펫 자리는 만남을 끝낼 때(잡거나 도망)마다 HUNT.PET% 확률로만 생긴다:
//   몬스터를 건너뛰거나 지도가 바뀔 때까지 기다려도 펫이 더 나오지 않는다(공을 써야 생긴다).
// 잡힘 · 도망도 서버가 정하고, 던지기마다 영수증(id)을 남겨 같은 던지기를 다시 보내도 공을 또 쓰지 않는다(낚시 cast/land와 같다).
// 던지기 품질 · 열매는 화면이 보내지만 정해진 값만 받는다(나이스 ×1.1 · 그레이트 ×1.25 · 엑설런트 ×1.6이 상한, 열매는 한 번에 하나).
// V13.167 열매는 서버가 낸 단어 문제(huntBerryQuiz)를 서버가 채점해 준 열매 표(h.berry)가 있어야 붙는다(한 공에 한 번, 재사용 · 위조 안 됨).
//   던지기 품질은 guardQuality(최근 비율 상한 · 너무 빠른 던지기)로 대략 확인한다(p.hunt.qlog: 최근 화면이 보낸 품질, h.last: 앞 일 시각).

const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };
const hunt = p => p.hunt ||= {};
const ball = (h, kind) => Number(h[kind] || 0);
const held = h => ball(h, 'basic') + ball(h, 'good');
const has = (p, key) => (p.pets || []).some(pet => pet.key === key);
const pick = (list, random) => list[Math.min(list.length - 1, Math.floor(random() * list.length))];

// 오늘 받은 곳(연습 · 출석 · 짝 맞추기, 곳마다 하루 1개).
function today(h, now) {
  const d = dayKey(now);
  if (h.got?.day !== d) h.got = { day: d };
  return h.got;
}
// 공 받기(공부로만). source: 'practice' | 'attend' | 'match'. lucky: 만점 연습 · 별 3이면 가끔 좋은 공.
// 받은 공('basic' | 'good')을 돌려준다. 오늘 이미 받았거나 가득 찼으면 null.
export function grantBall(p, source, { lucky = false, now = Date.now(), random = secureRandom } = {}) {
  if (!HUNT.SOURCES.includes(source)) return null;
  const h = hunt(p), got = today(h, now);
  if (got[source] || held(h) >= HUNT.BALL_MAX) return null;
  got[source] = 1;
  const kind = lucky && Number(got.good || 0) < HUNT.GOOD_DAILY && random() * 100 < HUNT.GOOD_CHANCE ? 'good' : 'basic';
  if (kind === 'good') got.good = Number(got.good || 0) + 1;
  h[kind] = ball(h, kind) + 1;
  return kind;
}
// 출석 도장판(7칸)을 다 채웠을 때 부른다. HUNT.GOLD_CARDS장마다 황금 공 1개. 받았으면 true.
export function huntCard(p) {
  const h = hunt(p);
  h.cards = Number(h.cards || 0) + 1;
  if (h.cards < HUNT.GOLD_CARDS) return false;
  h.cards = 0;
  if (ball(h, 'gold') >= HUNT.GOLD_MAX) return false;
  h.gold = ball(h, 'gold') + 1;
  return true;
}

const missing = p => ({ basic: STANDARD_PET_KEYS.filter(k => !has(p, k)), epic: EPIC_PET_KEYS.filter(k => !has(p, k)) });
// 자리: 9칸 격자에서 빈 칸을 골라 조금 흔든다(겹치지 않게).
function place(spots, random) {
  const used = new Set(spots.map(s => s.cell));
  const free = Array.from({ length: 9 }, (_, i) => i).filter(i => !used.has(i));
  const cell = free.length ? pick(free, random) : Math.floor(random() * 9);
  return { cell, x: Math.round(18 + (cell % 3) * 32 + (random() - .5) * 14), y: Math.round(26 + Math.floor(cell / 3) * 22 + (random() - .5) * 10) };
}
let spotSeq = 0;
const spotId = (now, random) => `s${(now % 1e8).toString(36)}${(spotSeq++ % 1296).toString(36)}${Math.floor(random() * 1296).toString(36)}`;
// V13.166 등급(HUNT.SPAWN)은 그대로 뽑고, 그 등급에서 지금 지도 · 시간에 맞고 그림이 있는 몬스터 중 하나.
function monsterSpot(spots, now, random) {
  const tier = spawnTier(random());
  return { id: spotId(now, random), kind: 'monster', key: pick(spawnPool(tier, huntPlace(now)), random), tier, ...place(spots, random) };
}
function petSpot(p, spots, now, random, tier) {
  const key = pick(missing(p)[tier === 'petEpic' ? 'epic' : 'basic'], random);
  return { id: spotId(now, random), kind: 'pet', key, tier, form: 1, ...place(spots, random) };
}
const refill = (map, now, random, n = HUNT.SPOTS[0]) => { while (map.spots.length < n) map.spots.push(monsterSpot(map.spots, now, random)); };
// 지도: 슬롯(HUNT.SLOT_HOURS시간)이 바뀌면 몬스터 자리를 새로 뽑는다. 펫 자리와 만나는 중인 자리는 그대로 둔다.
export function huntMap(p, now = Date.now(), random = secureRandom) {
  const h = hunt(p), slot = huntSlot(now);
  const map = h.map ||= { slot: null, spots: [] };
  // 예전 판(펫 사냥) 자리 · 모르는 몬스터는 지운다. 펫이 그 사이 다른 곳(알 상점 · 선물)에서 생겼으면 못 만난 다른 펫으로, 없으면 지운다.
  map.spots = (map.spots || []).flatMap(s => {
    if (s.kind === 'monster') return HUNT_MONSTERS[s.key] && monsterReady(s.key) ? [s] : [];
    if (s.kind !== 'pet') return [];
    if (!has(p, s.key)) return [s];
    const left = missing(p)[s.tier === 'petEpic' ? 'epic' : 'basic'];
    return left.length ? [{ ...s, key: pick(left, random) }] : [];
  });
  // V13.166 아침 6시가 되면 밤 몬스터는 떠난다(만나는 중인 자리는 그대로). 장소 몬스터는 지도가 바뀔 때(슬롯) 같이 바뀐다.
  const where = huntPlace(now);
  map.spots = map.spots.filter(s => s.kind !== 'monster' || s.id === h.live?.spot || HUNT_MONSTERS[s.key].place !== 'night' || where.night);
  if (h.live && !map.spots.some(s => s.id === h.live.spot)) delete h.live;
  if (map.slot !== slot) {
    map.slot = slot;
    map.spots = map.spots.filter(s => s.kind === 'pet' || s.id === h.live?.spot);
    refill(map, now, random, HUNT.SPOTS[0] + Math.floor(random() * (HUNT.SPOTS[1] - HUNT.SPOTS[0] + 1)));
  }
  refill(map, now, random);
  return map;
}
// 사냥터: 낮 · 밤(한국 시간 19시 ~ 6시는 밤), 숲 · 들판 · 바닷가는 슬롯마다 돌아가며.
export function huntPlace(now = Date.now()) {
  const hour = new Date(Number(now) + 9 * 3600000).getUTCHours();
  return { area: ['forest', 'field', 'beach'][huntSlot(now) % 3], night: hour >= 19 || hour < 6 };
}

export function huntView(p, now = Date.now()) {
  const h = p.hunt || {}, d = dayKey(now), got = h.got?.day === d ? h.got : {};
  const map = h.map?.slot === huntSlot(now) ? h.map : null;
  const bag = Object.fromEntries(Object.entries(h.bag || {}).filter(([k, n]) => HUNT_MONSTERS[k] && n > 0));
  return {
    basic: ball(h, 'basic'), good: ball(h, 'good'), gold: ball(h, 'gold'), max: HUNT.BALL_MAX,
    got: Object.fromEntries(HUNT.SOURCES.map(s => [s, !!got[s]])), cards: Number(h.cards || 0), gold_cards: HUNT.GOLD_CARDS,
    // 펫 자리는 이름 · 등급을 숨긴다(지도에는 반짝이는 '?' 실루엣).
    spots: map ? map.spots.map(s => s.kind === 'pet' ? { id: s.id, kind: 'pet', x: s.x, y: s.y } : { id: s.id, kind: 'monster', key: s.key, tier: s.tier, x: s.x, y: s.y }) : null,
    live: h.live ? { spot: h.live.spot } : null,
    bag, bag_stars: Object.entries(bag).reduce((s, [k, n]) => s + HUNT.STARS[HUNT_MONSTERS[k].tier] * n, 0), stars: Number(h.stars || 0),
    book: Object.fromEntries(Object.entries(h.book || {}).filter(([k]) => HUNT_MONSTERS[k])), kinds: Object.keys(h.book || {}).filter(k => HUNT_MONSTERS[k]).length, all: MONSTER_KEYS.length,
    coin_left: Math.max(0, HUNT.COIN_DAILY - (h.coin_day === d ? Number(h.coin_today || 0) : 0)),
    egg_left: h.egg_day === d ? 0 : 1, epic_left: h.epic_day === d ? 0 : 1,
    ...huntPlace(now), met: Number(h.met || 0), caught: Number(h.caught || 0), guide: !!h.guide
  };
}

// 만나기: 지도의 몬스터를 누르면 만난다(다른 자리를 누르면 그쪽으로 바뀐다). 도망 버튼은 서버에 알리지 않는다: 지도에 남는다.
export function huntMeet(p, spotIdIn, now = Date.now(), random = secureRandom) {
  const h = hunt(p), map = huntMap(p, now, random);
  const spot = map.spots.find(s => s.id === spotIdIn);
  if (!spot) fail('벌써 다른 곳으로 갔어요. 지도를 다시 볼게요.', 404);
  if (h.live?.spot !== spot.id) { h.live = { spot: spot.id, kind: spot.kind, key: spot.key, tier: spot.tier, at: now, throws: 0 }; delete h.berry; delete h.quiz; }
  h.last = now;
  return { spot: spot.id, kind: spot.kind, key: spot.key, tier: spot.tier, form: spot.form || 1, throws: h.live.throws };
}

// 던지기. 같은 던지기(id)를 다시 보내면 같은 답(공을 또 쓰지 않는다). pet: 경험치를 받을 파트너 펫 키.
export function huntThrow(p, { id, spot, ball: kind, quality = null, ticket = null, pet = null, now = Date.now(), random = secureRandom }) {
  const h = hunt(p);
  const seen = findReceipt(h, 'hunt', id);
  if (seen) return { ...seen.r, again: true };
  if (!id) fail('던지기 번호가 없어요.');
  const live = h.live;
  if (!live || live.spot !== spot) fail('만나는 중인 몬스터가 없어요. 지도에서 다시 눌러 주세요.', 404);
  const b = BALL_KINDS.includes(kind) ? kind : 'basic';
  if (ball(h, b) < 1) fail(b === 'gold' ? '황금 공이 없어요.' : b === 'good' ? '좋은 공이 없어요.' : '공이 없어요. 공부하면 공을 받아요!', 409);
  const claimed = Object.hasOwn(HUNT.THROWS, quality) ? quality : null;
  const q = guardQuality(claimed, h.qlog || [], now - Number(h.last || 0));
  h.qlog = [...(h.qlog || []), claimed].slice(-HUNT.QUALITY_GUARD.WINDOW);
  h.last = now;
  // 열매: 이 만남 · 이 공에 서버가 준 열매 표가 있을 때만. 던지면(잡히든 아니든) 표를 쓴다.
  const card = h.berry, fruit = card && ticket && card.ticket === ticket && card.spot === live.spot && card.throws === Number(live.throws || 0) && Object.hasOwn(BERRIES, card.berry) ? card.berry : null;
  delete h.berry; delete h.quiz;
  h[b] = ball(h, b) - 1;
  live.throws = Number(live.throws || 0) + 1;
  const roll = rollThrow(live.tier, { ball: b, quality: q, berry: fruit }, random(), random());
  const out = { caught: roll.caught, fled: roll.fled, shakes: roll.shakes, kind: live.kind, key: live.key, tier: live.tier, ball: b, quality: q, berry: fruit, throws: live.throws, ...(claimed && q !== claimed ? { claimed } : {}) };
  if (roll.caught) {
    h.caught = Number(h.caught || 0) + 1;
    if (live.kind === 'pet') {
      if (!has(p, live.key)) {
        // 펫: 알 상점 알처럼 바로 파트너가 되고, 함께 공부해 Lv.3이 되면 알에서 깨어난다.
        const epic = live.tier === 'petEpic';
        (p.pets ||= []).push({ key: live.key, acquired_at: now, ...(epic ? { epic: true } : {}), hunt: true });
        (p.purchases ||= []).push({ item: 'hunt', key: live.key, price: 0, at: now, ...(epic ? { epic: true } : {}) });
        p.avatar_key = live.key;
        out.new_pet = true;
      }
    } else {
      // 몬스터: 가방에 넣고(🍍면 2마리) 도감에 남긴다. 파트너 펫은 경험치.
      const n = fruit === 'pinap' ? HUNT.BERRY_REWARD : 1;
      const book = h.book ||= {}, bag = h.bag ||= {};
      out.fresh = !book[live.key]?.n;
      (book[live.key] ||= { n: 0 }).n += n;
      bag[live.key] = Number(bag[live.key] || 0) + n;
      out.n = n; out.stars = HUNT.STARS[live.tier] * n; out.xp = HUNT.XP[live.tier];
      if (pet) addBonus(p, { xp: out.xp, pet, now });
    }
  }
  if (roll.caught || roll.fled) endMeet(p, h, now, random);
  return keepReceipt(h, 'hunt', id, out, now);
}
// V13.167 열매 문제: 만나는 중인 몬스터에게, 공 하나에 한 번. 단어는 부른 쪽(service.mjs)이 내 학교 · 학년 범위에서 준다.
// 정답은 보내지 않는다. 같은 공에서 다시 부르면 같은 문제(다시 뽑아 쉬운 단어를 고르지 못하게).
const quizId = random => `q${Math.floor(random() * 36 ** 6).toString(36)}${Math.floor(random() * 36 ** 6).toString(36)}`;
export function huntBerryQuiz(p, { spot, berry, words = [], now = Date.now(), random = secureRandom }) {
  const h = hunt(p), live = h.live;
  if (!live || live.spot !== spot) fail('만나는 중인 몬스터가 없어요. 지도에서 다시 눌러 주세요.', 404);
  if (!Object.hasOwn(BERRIES, berry)) fail('열매를 골라 주세요.');
  const throws = Number(live.throws || 0);
  if (h.berry?.spot === spot && h.berry.throws === throws) fail('이 공에는 벌써 열매를 줬어요.', 409);
  if (h.quiz?.spot === spot && h.quiz.throws === throws) {
    if (h.quiz.done) fail('이 공에는 벌써 문제를 풀었어요. 다음 공에 다시 해요.', 409);
    return { id: h.quiz.id, berry: h.quiz.berry, en: h.quiz.en, choices: h.quiz.choices };
  }
  const seenEn = new Set(), seenKo = new Set(), pool = [];
  // 범위 단어가 많아도 앞에서부터 섞어 4개만 고른다(전체를 섞지 않는다).
  const list = [...words];
  for (let i = 0; i < list.length && pool.length < 4; i++) {
    const j = i + Math.floor(random() * (list.length - i));
    [list[i], list[j]] = [list[j], list[i]];
    const w = list[i], en = displayEnglish(w.word || '').trim(), ko = cardMeaning(w.meaning);
    if (!en || !ko || seenEn.has(en.toLowerCase()) || seenKo.has(ko)) continue;
    seenEn.add(en.toLowerCase()); seenKo.add(ko); pool.push({ en, ko });
  }
  if (pool.length < HUNT.BERRY_QUIZ_MIN) fail('단어가 모자라요. 놀이터에서 게임 단어 범위를 더 골라 주세요.', 409);
  const choices = pool.map(w => w.ko).sort(() => random() - .5);
  h.quiz = { id: quizId(random), spot, throws, berry, en: pool[0].en, answer: pool[0].ko, choices, at: now };
  return { id: h.quiz.id, berry, en: h.quiz.en, choices };
}
// 채점: 맞히면 열매 표(ticket)를 준다. 같은 문제를 다시 보내면 같은 답(표도 같다).
export function huntBerryAnswer(p, { id, choice, random = secureRandom }) {
  const h = hunt(p), q = h.quiz;
  if (!q || q.id !== id) fail('열매 문제가 끝났어요. 다시 골라 주세요.', 404);
  if (q.done) return q.done;
  const live = h.live;
  if (!live || live.spot !== q.spot || Number(live.throws || 0) !== q.throws) fail('열매 문제가 끝났어요. 다시 골라 주세요.', 404);
  const ok = String(choice || '') === q.answer;
  q.done = { ok, answer: q.answer, en: q.en, berry: q.berry };
  if (ok) {
    const ticket = `b${quizId(random)}`;
    h.berry = { ticket, berry: q.berry, spot: q.spot, throws: q.throws };
    q.done.ticket = ticket;
  }
  return q.done;
}

// 만남이 끝나면(잡거나 도망) 그 자리를 지우고, HUNT.PET% 확률로 펫 자리를 하나 만든다(이미 있으면 그대로).
function endMeet(p, h, now, random) {
  const map = h.map ||= { slot: huntSlot(now), spots: [] };
  map.spots = (map.spots || []).filter(s => s.id !== h.live.spot);
  delete h.live; delete h.berry; delete h.quiz;
  h.met = Number(h.met || 0) + 1;
  if (!map.spots.some(s => s.kind === 'pet') && random() * 100 < HUNT.PET) {
    const left = missing(p), tier = petTier(random(), { basic: left.basic.length, epic: left.epic.length });
    if (tier) map.spots.push(petSpot(p, map.spots, now, random, tier));
  }
  refill(map, now, random);
}

// 가방 몬스터 팔기(별조각으로). key가 없으면 모두.
export function huntSell(p, { key = null, n = null } = {}) {
  const h = hunt(p), bag = h.bag ||= {};
  const keys = key ? [key] : Object.keys(bag);
  let stars = 0, sold = 0;
  for (const k of keys) {
    const have = Number(bag[k] || 0), take = Math.min(have, n === null || n === undefined ? have : Math.max(0, Math.floor(Number(n) || 0)));
    if (!HUNT_MONSTERS[k] || take <= 0) continue;
    bag[k] = have - take;
    if (!bag[k]) delete bag[k];
    stars += take * HUNT.STARS[HUNT_MONSTERS[k].tier]; sold += take;
  }
  if (!sold) fail('팔 몬스터가 없어요.', 409);
  h.stars = Number(h.stars || 0) + stars;
  return { sold, stars };
}
// 별조각으로 코인(1:1, 하루 HUNT.COIN_DAILY). 코인은 rewardIncome(p.hunt.coins)에 들어간다.
export function huntCoins(p, amount, now = Date.now()) {
  const h = hunt(p), d = dayKey(now);
  if (h.coin_day !== d) { h.coin_day = d; h.coin_today = 0; }
  const want = Math.floor(Number(amount) || 0), left = HUNT.COIN_DAILY - h.coin_today;
  if (want < 1) fail('바꿀 별조각 수를 골라 주세요.');
  if (want > left) fail(left ? `오늘은 ${left}코인까지 바꿀 수 있어요.` : '오늘 코인 교환을 다 했어요. 내일 또 와요!', 409);
  if (want > Number(h.stars || 0)) fail(`별조각이 ${want - Number(h.stars || 0)}개 부족해요.`);
  h.stars -= want; h.coin_today += want; h.coins = Number(h.coins || 0) + want;
  return { coins: want };
}
// 알 · 영웅 알: 한도와 별조각을 확인하고, 쓰는 함수를 돌려준다(알은 부른 쪽이 깬다: service.mjs hatchEgg).
export function huntSpend(p, item, now = Date.now()) {
  const h = hunt(p), price = item === 'epic_egg' ? HUNT.EPIC_EGG : item === 'egg' ? HUNT.EGG : null;
  if (!price) fail('바꿀 것을 골라 주세요.');
  if (item === 'egg' && h.egg_day === dayKey(now)) fail('랜덤 알은 하루에 하나만 바꿀 수 있어요.', 409);
  if (item === 'epic_egg' && h.epic_day === dayKey(now)) fail('영웅 알은 하루에 하나만 바꿀 수 있어요.', 409);
  if (Number(h.stars || 0) < price) fail(`별조각이 ${price - Number(h.stars || 0)}개 부족해요.`);
  return () => { h.stars -= price; if (item === 'egg') h.egg_day = dayKey(now); else h.epic_day = dayKey(now); };
}
