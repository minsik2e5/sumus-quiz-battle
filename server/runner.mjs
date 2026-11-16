import { dayKey, petTier } from '../public/modules/core.js';
import { elementOf } from '../public/modules/battle-fx.js';
import { RUNNER, PET_MUL, UPGRADES, upCost, upClean, makeMap, replay, runResult, cleanInput, cheerOf, baseStart } from '../public/modules/runner-rules.js';
import { addBonus } from './rewards.mjs';

// V13.241 펫 대행진(크라우드 러너) 서버 쪽. 구성안 docs/pet-runner-plan.md 6 · 7장.
// 요청은 판마다 두 번: /runner/start(판을 열고 씨앗 · 구출 펫을 정함) → /runner/finish(조종 기록으로 같은 판을 다시 돌려 결과를 정함).
// 학생 기록 p.games.runner(쌓이는 목록 없음, 약 0.25KB):
//   { st: 깬 가장 높은 스테이지, stars: '3321…'(스테이지마다 최고 별 한 글자), d: 오늘, ct: 오늘 받은 판 코인, n: 오늘 연 판,
//     bx: 첫 판 상자를 받은 날, fs · fn: 연달아 진 스테이지 · 횟수(응원 정령), tot: 모든 판,
//     open{ id, seed, stage, pet, cheer, at, v: 규칙 판, up: 연 때의 강화 }(열린 판 하나), last{ id, r }(마지막 판 영수증: 같은 finish를 다시 보내면 그대로),
//     up{ s, f, c, d }(v13.242 정령 강화 단계, 기존 코인으로) }
// v13.242 규칙 2판: 판을 열 때 규칙 판(RUNNER.RULES)을 적는다. 화면이 다른 판 규칙이면 시작을 막고(새로 고침 안내),
//   예전 규칙으로 열린 판의 끝은 기록 없이 돌려준다(진 횟수 · 코인 · 별에 넣지 않음). 지난 별 · 깬 스테이지는 그대로 쓴다.
// 반 순위(GET /runner/board)는 같은 학교 · 같은 학년대 학생을 훑어 1분 캐시한다(쓰기 요청 안에서는 다른 학생을 보지 않는다).

const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };
const rn = p => (p.games ||= {}).runner ||= {};
const ID = /^[a-z0-9-]{8,40}$/i;
const starsOf = g => String(g?.stars || '');
const starAt = (g, s) => Number(starsOf(g)[s - 1] || 0);
const totalStars = g => [...starsOf(g)].reduce((n, c) => n + Number(c || 0), 0);
function today(g, now) { const d = dayKey(now); if (g.d !== d) { g.d = d; g.ct = 0; g.n = 0; } return g; }

// 내 펫 중 판마다 하나(씨앗으로 정함 → 같은 판은 늘 같은 펫). 같은 펫을 여러 번 가져도 한 번만 센다.
export function rescuePet(p, seed) {
  const keys = [...new Set((p.pets || []).map(x => x?.key).filter(Boolean))].sort();
  if (!keys.length) return null;
  const key = keys[(seed >>> 0) % keys.length], tier = petTier(key), form = Math.max(1, Math.min(3, Number((p.pets || []).filter(x => x.key === key).map(x => x.form || 1).sort((a, b) => b - a)[0]) || 1));
  return { key, form, el: elementOf(key), tier, mul: PET_MUL[tier] ?? 1 };
}
// 시작 정령 = (스테이지 기본 + 강화 단계 × 3) × (1 + 응원)
export const startCount = (stage, cheer, up = null) => Math.round((baseStart(stage) + upClean(up).s * 3) * (1 + cheer));
const upView = g => { const up = upClean(g.up); return Object.fromEntries(Object.keys(UPGRADES).map(k => [k, { lv: up[k], max: UPGRADES[k].max, cost: upCost(k, up[k]) }])); };

export function runnerView(p, now = Date.now()) {
  const g = p.games?.runner || {}, on = g.d === dayKey(now);
  return {
    stages: RUNNER.STAGES, st: Number(g.st || 0), stars: starsOf(g), total: totalStars(g),
    coin_today: on ? Number(g.ct || 0) : 0, coin_daily: RUNNER.COIN_DAILY, box: g.bx !== dayKey(now), box_coins: RUNNER.BOX_COINS,
    plays_left: Math.max(0, RUNNER.PLAYS_DAILY - (on ? Number(g.n || 0) : 0)),
    cheer: g.fs ? { stage: g.fs, fails: Number(g.fn || 0), bonus: cheerOf(g.fn) } : null,
    up: upView(g), rules: RUNNER.RULES
  };
}

export function runnerStart(p, { id, stage, rules = RUNNER.RULES, now = Date.now(), seed = (Math.random() * 4294967296) >>> 0 }) {
  if (!ID.test(String(id || ''))) fail('판 번호를 확인해 주세요.');
  if (Number(rules) !== RUNNER.RULES) fail('펫 대행진이 새로워졌어요. 앱을 새로 고친 뒤 다시 출발해 주세요!', 409);
  const g = rn(p), s = Math.floor(Number(stage));
  if (g.open?.id === id) return startOut(g.open);           // 같은 시작을 다시 보냄
  if (!(s >= 1 && s <= Math.min(RUNNER.STAGES, Number(g.st || 0) + 1))) fail('아직 열리지 않은 스테이지예요.', 409);
  const day = today(g, now);
  if (day.n >= RUNNER.PLAYS_DAILY) fail(`펫 대행진은 하루 ${RUNNER.PLAYS_DAILY}판까지예요. 내일 또 만나요!`, 409);
  const pet = rescuePet(p, seed);
  if (!pet) fail('먼저 첫 펫을 골라주세요.', 409);
  day.n += 1;
  const cheer = g.fs === s ? cheerOf(g.fn) : 0;
  const up = upClean(g.up);
  g.open = { id, seed, stage: s, pet: pet.key, cheer, at: now, v: RUNNER.RULES, ...(up.s + up.f + up.c + up.d ? { up } : {}) };
  return startOut(g.open, pet);
}
function startOut(o, pet = null) { return { id: o.id, stage: o.stage, seed: o.seed, cheer: o.cheer, start: startCount(o.stage, o.cheer, o.up), up: upClean(o.up), rules: o.v, pet: pet || { key: o.pet } }; }

// 정령 강화(구성안 3-3): 기존 코인으로 한 단계씩. 판 중에 바꿔도 열린 판은 연 때의 강화로 다시 돌린다(open.up).
export function runnerUpgrade(p, key, balance) {
  const g = rn(p), up = upClean(g.up), k = String(key || '');
  if (!UPGRADES[k]) fail('강화할 것을 골라 주세요.');
  const cost = upCost(k, up[k]);
  if (cost == null) fail(`${UPGRADES[k].name}은 이미 끝까지 올렸어요.`, 409);
  if (!(balance >= cost)) fail(`코인이 ${cost - Math.max(0, balance | 0)}개 부족해요.`, 409);
  p.points_spent = Number(p.points_spent || 0) + cost;
  up[k] += 1; g.up = up;
  return { key: k, lv: up[k], cost };
}

export function runnerFinish(p, { id, input, now = Date.now() }) {
  const g = rn(p);
  if (id && g.last?.id === id) return { ...g.last.r, again: true };
  const open = g.open;
  if (!id || !open || open.id !== id) fail('펫 대행진 판을 찾지 못했어요.', 404);
  delete g.open;
  const out = settle(p, g, open, input, now);
  g.last = { id, r: out };
  return out;
}
function settle(p, g, open, input, now) {
  const base = { stage: open.stage, valid: false };
  if (open.v !== RUNNER.RULES) return { ...base, reason: 'version' };   // 예전 규칙으로 연 판: 기록 없이(진 횟수에도 안 넣음)
  if (now - open.at > RUNNER.OPEN_MS) return { ...base, reason: 'expired' };
  let size = 0; try { size = JSON.stringify(input ?? null).length; } catch { size = Infinity; }
  const clean = size <= RUNNER.INPUT_MAX ? cleanInput(input) : null;
  if (!clean) return { ...base, reason: 'input' };
  const pet = rescuePet(p, open.seed) || { el: 'star', mul: 1 };
  const map = makeMap(open.stage), res = runResult(replay(map, { start: startCount(open.stage, open.cheer, open.up), pet: { el: pet.el, mul: pet.mul }, up: open.up }, clean));
  // 너무 빨리 끝난 판(서버 시계로 잰 시간이 다시 돌린 판 길이의 90%보다 짧음)은 무효
  if (now - open.at < res.ticks * RUNNER.TICK * RUNNER.MIN_RATIO) return { ...base, reason: 'fast', ticks: res.ticks };
  const day = today(g, now), s = open.stage, prev = starAt(g, s);
  g.tot = Number(g.tot || 0) + 1;
  const fresh = Math.max(0, res.stars - prev);
  const coins = Math.max(0, Math.min(fresh * RUNNER.STAR_NEW + (res.stars - fresh) * RUNNER.STAR_AGAIN, RUNNER.COIN_DAILY - Number(day.ct || 0)));
  day.ct = Number(day.ct || 0) + coins;
  const box = g.bx !== dayKey(now) ? RUNNER.BOX_COINS : 0;
  if (box) g.bx = dayKey(now);
  if (coins + box) addBonus(p, { coins: coins + box, now });
  if (res.stars > prev) { const arr = starsOf(g).padEnd(s, '0').split(''); arr[s - 1] = String(res.stars); g.stars = arr.join('').replace(/0+$/, ''); }
  const firstClear = res.stars > 0 && prev === 0;
  if (res.stars > 0) { g.st = Math.max(Number(g.st || 0), s); if (g.fs === s) { delete g.fs; delete g.fn; } }
  else if (g.fs === s) g.fn = Number(g.fn || 0) + 1;
  else { g.fs = s; g.fn = 1; }
  return { ...base, valid: true, stars: res.stars, left: res.left, start: res.start, ticks: res.ticks, broke: res.broke, coins, box, won: res.won, fevers: res.fevers, best: Math.max(prev, res.stars), first_clear: firstClear, pet: pet.key, cheer_next: g.fs === s ? cheerOf(g.fn) : 0 };
}
export const runnerLine = r => r.valid ? `펫 대행진 ${r.stage}스테이지 ${r.stars ? `별 ${r.stars}개` : '실패'}` : '';

// 반 순위: 같은 묶음(group 키가 같은 학생) 별 합계 → 깬 스테이지 순. 묶음마다 1분 캐시.
const boardCache = new Map();
export function runnerBoard(profiles, p, { group, ranked, hidden = () => false, now = Date.now() }) {
  const key = group(p);
  let hit = boardCache.get(key);
  if (!hit || now - hit.at > RUNNER.BOARD_CACHE_MS) {
    const rows = [];
    for (const x of profiles) { if (!ranked(x) || group(x) !== key) continue; const g = x.games?.runner; if (!g?.tot) continue; rows.push({ id: x.id, total: totalStars(g), st: Number(g.st || 0), name: x.display_name, pet: x.avatar_key || 'lumi', veil: hidden(x) }); }
    rows.sort((a, b) => b.total - a.total || b.st - a.st || String(a.name).localeCompare(String(b.name)));
    rows.forEach((r, i) => { r.rank = i + 1; });
    hit = { at: now, rows };
    if (boardCache.size > 300) boardCache.clear();
    boardCache.set(key, hit);
  }
  const card = r => ({ rank: r.rank, total: r.total, st: r.st, me: r.id === p.id, name: r.veil && r.id !== p.id ? '비공개 학생' : r.name, pet: r.veil && r.id !== p.id ? 'lumi' : r.pet });
  const mine = hit.rows.find(r => r.id === p.id);
  return { top: hit.rows.slice(0, RUNNER.BOARD_TOP).map(card), me: mine ? card(mine) : null, count: hit.rows.length, cached_at: hit.at };
}
