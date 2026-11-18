import { dayKey, petTier } from '../public/modules/core.js';
import { elementOf } from '../public/modules/battle-fx.js';
import { RUNNER, PET_MUL, UPGRADES, upCost, upClean, makeMap, replay, runResult, cleanInput, cheerOf, baseStart } from '../public/modules/runner-rules.js';
import { addBonus } from './rewards.mjs';
import { rankingWeek, DAY_MS } from './competition.mjs';
import { DAILY, RAID, dailySpec, modeMap, modeOpts, dailyCompare, dailyBetter, raidHp, raidBoss, bossInfo } from '../public/modules/runner-modes.js';

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
// V13.243 ③단계(오늘의 도전 · 주간 반 보스), 학생 기록에 더한 칸(쌓이는 목록 없음):
//   dd{ d: 날, s · l · t: 별 · 남은 정령 · 틱, a: 세운 때 }(오늘의 도전 오늘 최고 하나), rw · rp{ w: 주 시작, d: 피해, n: 판 }(이번 주 · 지난주 내 보스 피해),
//   rc[주 시작 최대 3개](받은 반 보스 보상). open.m = 'd'(도전) · ms(맵 씨앗) · el(오늘의 속성) · day.
// 반 보스 묶음 state.runnerRaid[묶음] = { w, hp, d, n, k, b, p }(이번 주 숫자 몇 개 + 지난주 한 줄 p). 판 끝 쓰기는 d에 숫자 하나 더하기(O(1))뿐.

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

export function runnerView(p, now = Date.now(), ctx = null) {
  const g = p.games?.runner || {}, on = g.d === dayKey(now);
  return {
    ...(ctx?.group != null ? metaView(p, g, ctx, now) : {}),
    stages: RUNNER.STAGES, st: Number(g.st || 0), stars: starsOf(g), total: totalStars(g),
    coin_today: on ? Number(g.ct || 0) : 0, coin_daily: RUNNER.COIN_DAILY, box: g.bx !== dayKey(now), box_coins: RUNNER.BOX_COINS,
    plays_left: Math.max(0, RUNNER.PLAYS_DAILY - (on ? Number(g.n || 0) : 0)),
    cheer: g.fs ? { stage: g.fs, fails: Number(g.fn || 0), bonus: cheerOf(g.fn) } : null,
    up: upView(g), rules: RUNNER.RULES
  };
}

export function runnerStart(p, { id, stage, rules = RUNNER.RULES, mode = 'stage', group = '', now = Date.now(), seed = (Math.random() * 4294967296) >>> 0 }) {
  if (!ID.test(String(id || ''))) fail('판 번호를 확인해 주세요.');
  if (Number(rules) !== RUNNER.RULES) fail('펫 대행진이 새로워졌어요. 앱을 새로 고친 뒤 다시 출발해 주세요!', 409);
  const g = rn(p), daily = mode === 'daily' ? dailySpec(dayKey(now), group) : null, s = daily ? daily.stage : Math.floor(Number(stage));
  if (g.open?.id === id) return startOut(g.open);           // 같은 시작을 다시 보냄
  if (!daily && !(s >= 1 && s <= Math.min(RUNNER.STAGES, Number(g.st || 0) + 1))) fail('아직 열리지 않은 스테이지예요.', 409);
  const day = today(g, now);
  if (day.n >= RUNNER.PLAYS_DAILY) fail(`펫 대행진은 하루 ${RUNNER.PLAYS_DAILY}판까지예요. 내일 또 만나요!`, 409);
  const pet = rescuePet(p, seed);
  if (!pet) fail('먼저 첫 펫을 골라주세요.', 409);
  day.n += 1;
  // 오늘의 도전은 응원 · 강화 · 펫 등급 세기를 끈다(구출 펫 그림은 내 펫, 필살기는 오늘의 속성 · 세기 1).
  const cheer = !daily && g.fs === s ? cheerOf(g.fn) : 0;
  const up = daily ? upClean(null) : upClean(g.up);
  g.open = { id, seed, stage: s, pet: pet.key, cheer, at: now, v: RUNNER.RULES, ...(up.s + up.f + up.c + up.d ? { up } : {}), ...(daily ? { m: 'd', ms: daily.seed, el: daily.el, day: daily.day } : {}) };
  return startOut(g.open, pet);
}
const modeOf = o => o.m === 'd' ? { mode: 'daily', stage: o.stage, seed: o.ms, el: o.el, day: o.day } : { mode: 'stage', stage: o.stage };
// 시작 옵션은 모두 modeOpts를 거친다: 일반 판 = 응원 · 강화 · 펫 등급 그대로, 오늘의 도전 = 강화 0 · 응원 0 · 세기 1
const optsOf = (o, pet) => modeOpts(modeOf(o), { start: startCount(o.stage, o.cheer, o.up), pet: pet ? { el: pet.el, mul: pet.mul } : null, up: o.up });
function startOut(o, pet = null) {
  const md = modeOf(o), opt = optsOf(o, pet);
  return { id: o.id, stage: o.stage, seed: o.seed, cheer: o.cheer, start: opt.start, up: upClean(opt.up), rules: o.v, mode: md.mode, ...(md.mode === 'daily' ? { map_seed: o.ms, el: o.el } : {}),
    pet: pet ? { ...pet, ...(opt.pet ? { el: opt.pet.el, mul: opt.pet.mul } : {}) } : { key: o.pet } };
}

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

export function runnerFinish(p, { id, input, now = Date.now(), raid = null }) {
  const g = rn(p);
  if (id && g.last?.id === id) return { ...g.last.r, again: true };
  const open = g.open;
  if (!id || !open || open.id !== id) fail('펫 대행진 판을 찾지 못했어요.', 404);
  delete g.open;
  const out = settle(p, g, open, input, now, raid);
  g.last = { id, r: out };
  return out;
}
function settle(p, g, open, input, now, raid) {
  const md = modeOf(open), daily = md.mode === 'daily', base = { stage: open.stage, mode: md.mode, valid: false };
  if (open.v !== RUNNER.RULES) return { ...base, reason: 'version' };   // 예전 규칙으로 연 판: 기록 없이(진 횟수에도 안 넣음)
  if (now - open.at > RUNNER.OPEN_MS) return { ...base, reason: 'expired' };
  let size = 0; try { size = JSON.stringify(input ?? null).length; } catch { size = Infinity; }
  const clean = size <= RUNNER.INPUT_MAX ? cleanInput(input) : null;
  if (!clean) return { ...base, reason: 'input' };
  const pet = rescuePet(p, open.seed) || { el: 'star', mul: 1 };
  const map = modeMap(md), res = runResult(replay(map, optsOf(open, pet), clean));
  // 너무 빨리 끝난 판(서버 시계로 잰 시간이 다시 돌린 판 길이의 90%보다 짧음)은 무효
  if (now - open.at < res.ticks * RUNNER.TICK * RUNNER.MIN_RATIO) return { ...base, reason: 'fast', ticks: res.ticks };
  const day = today(g, now), s = open.stage, prev = daily ? 0 : starAt(g, s);
  g.tot = Number(g.tot || 0) + 1;
  // 반 보스: 일반 · 도전 모든 판의 공성전 피해를 묶음 숫자 하나에 더한다(O(1), 다른 학생을 보지 않음). 다시 돌린 결과로만.
  const boss = raid ? raidAdd(g, raid, res.dmg, now) : null;
  if (daily) return settleDaily(p, g, md, res, day, now, { ...base, valid: true, pet: pet.key, raid: boss });
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
  return { ...base, valid: true, stars: res.stars, left: res.left, start: res.start, ticks: res.ticks, broke: res.broke, coins, box, won: res.won, fevers: res.fevers, best: Math.max(prev, res.stars), first_clear: firstClear, pet: pet.key, cheer_next: g.fs === s ? cheerOf(g.fn) : 0, raid: boss };
}
// 오늘의 도전: 지도 별 · 응원은 그대로 두고, 오늘 최고 기록 하나만 바꾼다. 코인은 별마다 다시 받는 값(하루 상한 안) + 첫 판 상자.
function settleDaily(p, g, md, res, day, now, out) {
  const rec = { d: md.day, s: res.stars, l: res.left, t: res.ticks, a: now }, cur = g.dd?.d === md.day ? g.dd : null, best = dailyBetter(rec, cur);
  if (best) g.dd = rec;
  const coins = Math.max(0, Math.min(res.stars * RUNNER.STAR_AGAIN, RUNNER.COIN_DAILY - Number(day.ct || 0)));
  day.ct = Number(day.ct || 0) + coins;
  const box = g.bx !== dayKey(now) ? RUNNER.BOX_COINS : 0;
  if (box) g.bx = dayKey(now);
  if (coins + box) addBonus(p, { coins: coins + box, now });
  return { ...out, stars: res.stars, left: res.left, start: res.start, ticks: res.ticks, broke: res.broke, coins, box, daily_best: best, today: { s: g.dd.s, l: g.dd.l, t: g.dd.t } };
}
export const runnerLine = r => !r.valid ? '' : r.mode === 'daily' ? `펫 대행진 오늘의 도전 ${r.stars ? `별 ${r.stars}개 · 남은 정령 ${r.left}` : '실패'}` : `펫 대행진 ${r.stage}스테이지 ${r.stars ? `별 ${r.stars}개` : '실패'}`;

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

/* ---------- V13.243 ③단계: 오늘의 도전 · 주간 반 보스 ---------- */
const KST = 9 * 3600000;
const dayEnd = now => Math.floor((now + KST) / DAY_MS + 1) * DAY_MS - KST;   // 다음 한국 시간 자정
const weekOf = now => rankingWeek(now);                                        // 월요일 0시(한국 시간)부터 한 주
const myWeek = (g, w) => g.rw?.w === w ? g.rw : g.rp?.w === w ? g.rp : null;
// 묶음 크기(보스 HP용): GET이 묶음을 훑을 때 적어 둔다. 판 끝 쓰기는 이 값만 읽는다(없으면 기본 20명).
const sizeCache = new Map();

// 이번 주 묶음 한 줄을 준비한다. 주가 바뀌면 지난주 한 줄(p)만 남기고, 2주 넘게 안 쓴 묶음은 지운다(묶음 수만큼, 학생은 안 훑음).
export function raidEntry(bucket, group, now = Date.now()) {
  const w = weekOf(now).start, prev = w - 7 * DAY_MS;
  let e = bucket[group];
  if (e?.w === w) return e;
  const last = e?.w === prev ? { w: e.w, hp: e.hp, d: e.d, n: e.n, k: e.k || 0, b: e.b } : null;
  for (const key of Object.keys(bucket)) if (key !== group && !(bucket[key]?.w >= prev)) delete bucket[key];
  const keys = Object.keys(bucket);
  if (keys.length >= RAID.GROUPS_MAX) keys.sort((a, b) => bucket[a].w - bucket[b].w).slice(0, keys.length - RAID.GROUPS_MAX + 1).forEach(k => delete bucket[k]);
  e = bucket[group] = { w, hp: raidHp(sizeCache.get(group)?.n), d: 0, n: 0, k: 0, b: raidBoss(w, group), p: last };
  return e;
}
// 판 끝: 묶음 숫자 하나 + 내 기록 하나만 고친다.
function raidAdd(g, { bucket, group }, dmg, now) {
  const e = raidEntry(bucket, group, now), w = e.w, hit = Math.max(0, Math.round(Number(dmg) || 0));
  if (g.rw?.w !== w) { g.rp = g.rw?.w === w - 7 * DAY_MS ? g.rw : undefined; if (!g.rp) delete g.rp; g.rw = { w, d: 0, n: 0 }; e.n += 1; }
  g.rw.d += hit; g.rw.n += 1;
  e.d += hit;
  const killed = !e.k && e.d >= e.hp;
  if (killed) e.k = now;
  return { dmg: hit, mine: g.rw.d, total: e.d, hp: e.hp, pct: Math.min(100, Math.floor(e.d / e.hp * 100)), killed: !!e.k, killed_now: killed, boss: e.b };
}
// 받을 수 있는 반 보스 보상(이번 주 · 지난주 중 격파했고, 내가 그 주에 한 판이라도 했고, 아직 안 받은 주).
function claimable(g, bucket, group, now) {
  const e = bucket?.[group], w = weekOf(now).start, out = [];
  const weeks = [e?.w === w ? e : null, e?.w === w ? e.p : e?.w === w - 7 * DAY_MS ? e : null];
  for (const x of weeks) if (x?.k && myWeek(g, x.w) && !(g.rc || []).includes(x.w)) out.push({ w: x.w, coins: RAID.COINS, boss: x.b });
  return out;
}
export function runnerRaidClaim(p, { bucket, group, now = Date.now() }) {
  const g = rn(p), list = claimable(g, bucket, group, now);
  if (!list.length) fail('받을 반 보스 보상이 없어요.', 409);
  g.rc = [...(g.rc || []), ...list.map(x => x.w)].slice(-3);
  const coins = list.reduce((n, x) => n + x.coins, 0);
  addBonus(p, { coins, now });
  return { coins, weeks: list.map(x => x.w) };
}

// 지도 위 카드용 요약(첫 화면 · /runner/home). 묶음 한 줄만 읽는다(O(1)).
function metaView(p, g, { group, bucket }, now) {
  const day = dayKey(now), spec = dailySpec(day, group), wk = weekOf(now), e = bucket?.[group];
  const cur = e?.w === wk.start ? e : null, hp = cur ? cur.hp : raidHp(sizeCache.get(group)?.n), d = cur ? cur.d : 0;
  const best = g.dd?.d === day ? { s: g.dd.s, l: g.dd.l, t: g.dd.t } : null;
  return {
    daily: { stage: spec.stage, el: spec.el, best, ends_at: dayEnd(now) },
    raid: { boss: bossInfo(cur?.b || raidBoss(wk.start, group)), hp, dmg: d, pct: Math.min(100, Math.floor(d / hp * 100)), killed: !!cur?.k, mine: g.rw?.w === wk.start ? g.rw.d : 0,
      claim: claimable(g, bucket, group, now).reduce((n, x) => n + x.coins, 0), ends_at: wk.end }
  };
}

// 오늘의 도전 순위(GET, 묶음 · 날마다 1분 캐시). 내 줄은 캐시와 상관없이 지금 기록으로 등수를 센다(묶음 안 줄 수만큼).
const dailyCache = new Map();
export function runnerDaily(profiles, p, { group, ranked, hidden = () => false, now = Date.now() }) {
  const day = dayKey(now), key = `${day}|${group(p)}`, spec = dailySpec(day, group(p));
  let hit = dailyCache.get(key);
  if (!hit || now - hit.at > DAILY.CACHE_MS) {
    const rows = [], gk = group(p);
    for (const x of profiles) { if (!ranked(x) || group(x) !== gk) continue; const r = x.games?.runner?.dd; if (r?.d !== day) continue; rows.push({ id: x.id, s: r.s, l: r.l, t: r.t, a: r.a, name: x.display_name, pet: x.avatar_key || 'lumi', veil: hidden(x) }); }
    rows.sort(dailyCompare);
    hit = { at: now, rows };
    if (dailyCache.size > 300) dailyCache.clear();
    dailyCache.set(key, hit);
  }
  const g = p.games?.runner || {}, mine = g.dd?.d === day ? { id: p.id, s: g.dd.s, l: g.dd.l, t: g.dd.t, a: g.dd.a, name: p.display_name, pet: p.avatar_key || 'lumi' } : null;
  const card = (r, i) => ({ rank: i + 1, s: r.s, l: r.l, t: r.t, me: r.id === p.id, name: r.veil && r.id !== p.id ? '비공개 학생' : r.name, pet: r.veil && r.id !== p.id ? 'lumi' : r.pet });
  const others = hit.rows.filter(r => r.id !== p.id);
  const rank = mine ? others.filter(r => dailyCompare(r, mine) < 0).length + 1 : 0;
  const top = others.slice(); if (mine) top.splice(rank - 1, 0, mine);
  return { spec: { stage: spec.stage, el: spec.el }, top: top.slice(0, DAILY.TOP).map(card), me: mine ? card(mine, rank - 1) : null, count: top.length, ends_at: dayEnd(now), cached_at: hit.at };
}

// 반 보스 화면(GET). 보스 HP · 피해는 묶음 한 줄(지금 값), 기여 상위 5 · 지난주 내 순위는 묶음 학생을 훑어 1분 캐시.
const raidCache = new Map();
export function runnerRaid(profiles, p, { group, ranked, hidden = () => false, bucket = {}, now = Date.now() }) {
  const gk = group(p), wk = weekOf(now), w = wk.start, prev = w - 7 * DAY_MS, key = `${w}|${gk}`;
  let hit = raidCache.get(key);
  if (!hit || now - hit.at > RAID.CACHE_MS) {
    const rows = []; let size = 0;
    for (const x of profiles) {
      if (!ranked(x) || group(x) !== gk) continue;
      size++;
      const g = x.games?.runner; if (!g) continue;
      const a = myWeek(g, w), b = myWeek(g, prev);
      if (a || b) rows.push({ id: x.id, d: a?.d || 0, n: a?.n || 0, dl: b?.d || 0, nl: b?.n || 0, name: x.display_name, pet: x.avatar_key || 'lumi', veil: hidden(x) });
    }
    hit = { at: now, rows, size };
    sizeCache.set(gk, { n: size, at: now });
    if (sizeCache.size > 600) sizeCache.clear();
    if (raidCache.size > 300) raidCache.clear();
    raidCache.set(key, hit);
  }
  const e = bucket[gk], cur = e?.w === w ? e : null, last = e?.w === w ? e.p : e?.w === prev ? e : null;
  const g = p.games?.runner || {}, mine = myWeek(g, w)?.d || 0, mineLast = myWeek(g, prev);
  const hp = cur ? cur.hp : raidHp(hit.size), d = cur ? cur.d : 0;
  const card = r => ({ d: r.d, me: r.id === p.id, name: r.veil && r.id !== p.id ? '비공개 학생' : r.name, pet: r.veil && r.id !== p.id ? 'lumi' : r.pet });
  const live = hit.rows.filter(r => r.id !== p.id && r.n > 0);
  if (myWeek(g, w)) live.push({ id: p.id, d: mine, n: 1, name: p.display_name, pet: p.avatar_key || 'lumi' });
  live.sort((a, b) => b.d - a.d || String(a.name).localeCompare(String(b.name)));
  const myRank = live.findIndex(r => r.id === p.id) + 1;
  const lastRows = hit.rows.filter(r => r.nl > 0).sort((a, b) => b.dl - a.dl);
  const lastRank = mineLast ? lastRows.filter(r => r.id !== p.id && r.dl > mineLast.d).length + 1 : 0;
  return {
    boss: bossInfo(cur?.b || raidBoss(w, gk)), hp, dmg: d, pct: Math.min(100, Math.floor(d / hp * 100)), killed: !!cur?.k, killed_at: cur?.k || 0, players: cur?.n || 0, size: hit.size,
    top: live.slice(0, RAID.TOP).map((r, i) => ({ rank: i + 1, ...card(r) })), me: { dmg: mine, rank: myRank },
    claim: claimable(g, bucket, gk, now), coins: RAID.COINS, ends_at: wk.end,
    last: last ? { boss: bossInfo(last.b).name, killed: !!last.k, pct: Math.min(100, Math.floor(last.d / last.hp * 100)), players: last.n, mine: mineLast?.d || 0, rank: lastRank, of: Math.max(lastRows.length, lastRank) } : null,
    cached_at: hit.at
  };
}
// 선생님 화면(GET): 맡은 학교 묶음별 이번 주 보스 진행 · 참여 수 한 줄. 묶음 표만 본다(학생을 훑지 않음).
export function runnerRaidTeacher(bucket = {}, schoolId, now = Date.now()) {
  const w = weekOf(now).start, prev = w - 7 * DAY_MS, rows = [];
  for (const [key, e] of Object.entries(bucket)) {
    const [sid, division, grade] = key.split('|');
    if (sid !== String(schoolId)) continue;
    const cur = e.w === w ? e : null, last = cur ? e.p : e.w === prev ? e : null;
    rows.push({ division, grade: grade || '학년 없음', boss: bossInfo(cur?.b || raidBoss(w, key)).name, pct: cur ? Math.min(100, Math.floor(cur.d / cur.hp * 100)) : 0, killed: !!cur?.k, players: cur?.n || 0, last: last ? { killed: !!last.k, players: last.n } : null });
  }
  return rows.sort((a, b) => String(a.grade).localeCompare(String(b.grade)));
}
