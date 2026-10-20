import { dayKey, STANDARD_PET_KEYS, EPIC_PET_KEYS } from '../public/modules/core.js';
import { HUNT, BALL_KINDS, BERRIES, rollThrow, freshTier, huntSlot } from '../public/modules/hunt-rules.js';
import { findReceipt, keepReceipt, addBonus, secureRandom } from './rewards.mjs';

// V13.162 펫 사냥(놀이터) 서버 쪽. 학생 기록 p.hunt:
//   { basic, good, gold (공), got{ day, practice, attend, match, good } (오늘 받은 곳), cards (황금 공까지 채운 출석 도장판),
//     map{ slot, spots[{ id, key, tier, fresh, form, x, y }] }, live{ spot, key, tier, fresh, at, throws }, met, caught, done[] (영수증) }
// 지도의 펫 · 새 친구(누가 나오나)는 서버가 정한다. 새 친구 자리는 만남을 끝낼 때(잡거나 도망)마다 HUNT.FRESH% 확률로 생긴다:
//   가진 펫을 건너뛰고 새 친구만 기다리거나, 지도가 바뀔 때까지 기다려도 새 친구가 더 나오지 않는다(공을 써야 생긴다).
// 잡힘 · 도망도 서버가 정하고, 던지기마다 영수증(id)을 남겨 같은 던지기를 다시 보내도 공을 또 쓰지 않는다(낚시 cast/land와 같다).
// 던지기 품질 · 열매는 화면이 보내지만 정해진 값만 받는다(나이스 ×1.1 · 그레이트 ×1.25 · 엑설런트 ×1.6이 상한, 열매는 한 번에 하나).

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

// 지도에 나오는 가진 펫(기본 · 영웅만. 전설 · 신화 · 한정 · 바다 펫은 안 나온다).
const dupPool = p => [...STANDARD_PET_KEYS, ...EPIC_PET_KEYS].filter(key => has(p, key));
const missing = p => ({ basic: STANDARD_PET_KEYS.filter(k => !has(p, k)), epic: EPIC_PET_KEYS.filter(k => !has(p, k)) });
// 자리: 9칸 격자에서 빈 칸을 골라 조금 흔든다(펫끼리 겹치지 않게).
function place(spots, random) {
  const used = new Set(spots.map(s => s.cell));
  const free = Array.from({ length: 9 }, (_, i) => i).filter(i => !used.has(i));
  const cell = free.length ? pick(free, random) : Math.floor(random() * 9);
  return { cell, x: Math.round(18 + (cell % 3) * 32 + (random() - .5) * 14), y: Math.round(26 + Math.floor(cell / 3) * 22 + (random() - .5) * 10) };
}
let spotSeq = 0;
const spotId = (now, random) => `s${(now % 1e8).toString(36)}${(spotSeq++ % 1296).toString(36)}${Math.floor(random() * 1296).toString(36)}`;
function dupSpot(p, spots, now, random) {
  const pool = dupPool(p);
  if (!pool.length) return null;
  const key = pick(pool, random);
  return { id: spotId(now, random), key, tier: EPIC_PET_KEYS.includes(key) ? 'epic' : 'basic', fresh: false, form: 1 + Math.floor(random() * 3), ...place(spots, random) };
}
function freshSpot(p, spots, now, random, tier) {
  const key = pick(missing(p)[tier], random);
  return { id: spotId(now, random), key, tier, fresh: true, form: 1, ...place(spots, random) };
}
// 지도: 슬롯(HUNT.SLOT_HOURS시간)이 바뀌면 가진 펫 자리를 새로 뽑는다. 새 친구 자리와 만나는 중인 자리는 그대로 둔다.
export function huntMap(p, now = Date.now(), random = secureRandom) {
  const h = hunt(p), slot = huntSlot(now);
  const map = h.map ||= { slot: null, spots: [] };
  // 새 친구가 그 사이 다른 곳(알 상점 · 선물)에서 생겼으면 아직 못 만난 다른 친구로, 없으면 지운다.
  map.spots = (map.spots || []).flatMap(s => {
    if (!s.fresh || !has(p, s.key)) return [s];
    const left = missing(p)[s.tier];
    return left.length ? [{ ...s, key: pick(left, random) }] : [];
  });
  if (map.slot !== slot) {
    map.slot = slot;
    map.spots = map.spots.filter(s => s.fresh || s.id === h.live?.spot);
    const n = HUNT.SPOTS[0] + Math.floor(random() * (HUNT.SPOTS[1] - HUNT.SPOTS[0] + 1));
    while (map.spots.length < n) { const s = dupSpot(p, map.spots, now, random); if (!s) break; map.spots.push(s); }
  }
  while (map.spots.length < HUNT.SPOTS[0]) { const s = dupSpot(p, map.spots, now, random); if (!s) break; map.spots.push(s); }
  return map;
}
// 사냥터: 낮 · 밤(한국 시간 19시 ~ 6시는 밤), 숲 · 들판 · 바닷가는 슬롯마다 돌아가며.
export function huntPlace(now = Date.now()) {
  const hour = new Date(Number(now) + 9 * 3600000).getUTCHours();
  return { area: ['forest', 'field', 'beach'][huntSlot(now) % 3], night: hour >= 19 || hour < 6 };
}

export function huntView(p, now = Date.now()) {
  const h = p.hunt || {}, got = h.got?.day === dayKey(now) ? h.got : {};
  const map = p.hunt?.map?.slot === huntSlot(now) ? p.hunt.map : null;
  return {
    basic: ball(h, 'basic'), good: ball(h, 'good'), gold: ball(h, 'gold'), max: HUNT.BALL_MAX,
    got: Object.fromEntries(HUNT.SOURCES.map(s => [s, !!got[s]])), cards: Number(h.cards || 0), gold_cards: HUNT.GOLD_CARDS,
    // 새 친구는 이름 · 등급을 숨긴다(지도에는 반짝이는 '?' 실루엣).
    spots: map ? map.spots.map(s => s.fresh ? { id: s.id, fresh: true, x: s.x, y: s.y } : { id: s.id, key: s.key, tier: s.tier, form: s.form, x: s.x, y: s.y }) : null,
    live: h.live ? { spot: h.live.spot } : null,
    ...huntPlace(now), met: Number(h.met || 0), caught: Number(h.caught || 0), guide: !!h.guide
  };
}

// 만나기: 지도의 펫을 누르면 그 펫과 만난다(다른 펫을 누르면 그쪽으로 바뀐다). 도망 버튼은 서버에 알리지 않는다: 펫은 지도에 남는다.
export function huntMeet(p, spotIdIn, now = Date.now(), random = secureRandom) {
  const h = hunt(p), map = huntMap(p, now, random);
  const spot = map.spots.find(s => s.id === spotIdIn);
  if (!spot) fail('그 펫은 벌써 다른 곳으로 갔어요. 지도를 다시 볼게요.', 404);
  if (h.live?.spot !== spot.id) h.live = { spot: spot.id, key: spot.key, tier: spot.tier, fresh: spot.fresh, at: now, throws: 0 };
  return { spot: spot.id, key: spot.key, tier: spot.tier, fresh: spot.fresh, form: spot.form, throws: h.live.throws };
}

// 던지기. 같은 던지기(id)를 다시 보내면 같은 답(공을 또 쓰지 않는다).
export function huntThrow(p, { id, spot, ball: kind, quality = null, berry = null, now = Date.now(), random = secureRandom }) {
  const h = hunt(p);
  const seen = findReceipt(h, 'hunt', id);
  if (seen) return { ...seen.r, again: true };
  if (!id) fail('던지기 번호가 없어요.');
  const live = h.live;
  if (!live || live.spot !== spot) fail('만나는 중인 펫이 없어요. 지도에서 다시 눌러 주세요.', 404);
  const b = BALL_KINDS.includes(kind) ? kind : 'basic';
  if (ball(h, b) < 1) fail(b === 'gold' ? '황금 공이 없어요.' : b === 'good' ? '좋은 공이 없어요.' : '공이 없어요. 공부하면 공을 받아요!', 409);
  const q = Object.hasOwn(HUNT.THROWS, quality) ? quality : null;
  const fruit = Object.hasOwn(BERRIES, berry) ? berry : null;
  h[b] = ball(h, b) - 1;
  live.throws = Number(live.throws || 0) + 1;
  const roll = rollThrow(live.tier, { ball: b, quality: q, berry: fruit }, random(), random());
  const out = { caught: roll.caught, fled: roll.fled, shakes: roll.shakes, key: live.key, tier: live.tier, fresh: live.fresh, ball: b, quality: q, berry: fruit, throws: live.throws };
  if (roll.caught) {
    h.caught = Number(h.caught || 0) + 1;
    if (live.fresh && !has(p, live.key)) {
      // 새 친구: 알 상점 알처럼 바로 파트너가 되고, 함께 공부해 Lv.3이 되면 알에서 깨어난다.
      (p.pets ||= []).push({ key: live.key, acquired_at: now, ...(live.tier === 'epic' ? { epic: true } : {}), hunt: true });
      (p.purchases ||= []).push({ item: 'hunt', key: live.key, price: 0, at: now, ...(live.tier === 'epic' ? { epic: true } : {}) });
      p.avatar_key = live.key;
      out.new_pet = true;
    } else {
      // 가진 펫(또는 그 사이 이미 생긴 친구): 코인 + 그 펫 경험치. 🍍면 두 배.
      const k = fruit === 'pinap' ? HUNT.BERRY_REWARD : 1;
      out.coins = HUNT.DUP_COINS * k; out.xp = HUNT.DUP_XP * k;
      addBonus(p, { coins: out.coins, xp: out.xp, pet: live.key, now });
    }
  }
  if (roll.caught || roll.fled) endMeet(p, h, now, random);
  return keepReceipt(h, 'hunt', id, out, now);
}
// 만남이 끝나면(잡거나 도망) 그 자리를 지우고, HUNT.FRESH% 확률로 새 친구 자리를 하나 만든다(이미 있으면 그대로).
function endMeet(p, h, now, random) {
  const map = h.map ||= { slot: huntSlot(now), spots: [] };
  map.spots = (map.spots || []).filter(s => s.id !== h.live.spot);
  delete h.live;
  h.met = Number(h.met || 0) + 1;
  if (!map.spots.some(s => s.fresh) && random() * 100 < HUNT.FRESH) {
    const left = missing(p), tier = freshTier(random(), { basic: left.basic.length, epic: left.epic.length });
    if (tier) map.spots.push(freshSpot(p, map.spots, now, random, tier));
  }
  while (map.spots.length < HUNT.SPOTS[0]) { const s = dupSpot(p, map.spots, now, random); if (!s) break; map.spots.push(s); }
}
