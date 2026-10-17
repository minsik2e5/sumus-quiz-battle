import { rollCast, LURES, FISH, RARITY } from './fishing-rules.js';

// V13.149 교실 게임(선생님 TV + 학생 폰) 규칙. 방(cloudflare/party-room.mjs)이 이 함수들을 부른다. 화면 · 저장 · 소켓은 모른다.
//   kind 'treasure' 보물 사냥(Blooket 골드 퀘스트 방식): 맞히면 상자 3개 중 하나 → 금화 · 배수 · 훔치기 · 방패 · 바꾸기 · 몬스터 · 대박
//   kind 'fish'     반 전체 낚시: 맞히면 물고기(fishing-rules.js rollCast), 반 정답이 모이면 '물고기 떼'(잠깐 큰 물고기만)
// 게임 금화 · 무게는 그 판에서만 쓰인다. 진짜 코인은 끝난 뒤 정답 수 위주로(partyCoins).
// V13.150 보물 사냥 2.0: 훔치기는 운이 아니라 실력(금고 털이: 연속 3문제) · 당하는 친구는 도난 경보(5초 안에 1문제로 막기) ·
//   상자 엿보기(들키면 금화 −20%) · 1등 현상금 · 아이템(50:50 · 시간 정지 · 콤보 보호) · 이벤트 라운드(황금 시간 · 해적선 습격 · 보물 폭풍) · 팀전.

export const PARTY = {
  MAX_PLAYERS: 40,
  MINUTES: [5, 8, 10],
  LOBBY_MS: 30 * 60000,       // 시작 안 한 방은 30분 뒤 닫힌다
  WRONG_WAIT_MS: 2000,        // 틀리면 2초 쉬고 다음 문제(막 찍기 막기)
  TARGET_MS: 12000,           // 훔칠 친구를 고르는 시간(지나면 1등에게서)
  NO_STEAL_MS: 60000,         // 처음 1분은 훔치기 없음
  STEAL_LIMIT: 2,             // 같은 친구는 한 판에 2번까지
  STEAL_TOP: 5,               // 훔칠 수 있는 친구: 나를 뺀 위 5명(+ 되갚기)
  REVENGE_MS: 30000,
  HIDE_LAST_MS: 60000,        // 마지막 1분은 TV 순위를 가린다
  FEED_KEEP: 8,
  LEAD_NEWS_MS: 10000,        // '1등 탈환' 소식은 10초에 한 번까지
  FRENZY_EVERY: 40,           // 반 정답 40개마다 물고기 떼
  FRENZY_MS: 20000,
  FRENZY_LURE: 2,
  DAILY: 3,                   // 교실 게임 코인은 하루 3판까지
  MIN_RIGHT: 5,               // 5문제 이상 맞혀야 코인
  HEIST_NEED: 3,              // 금고 털이: 연속 3문제를 맞혀야 훔친다(틀리거나 시간이 지나면 실패, 벌점은 없다)
  HEIST_MS: 25000,
  ALARM_MS: 5000,             // 도난 경보: 이 안에 1문제를 맞히면 막는다
  ALARM_FREEZE_MS: 10000,     // 시간 정지 아이템이 있으면 10초
  DEFEND_GOLD: 10,            // 막은 친구에게 주는 금화
  BOUNTY: 50, BOUNTY_MIN: 150, // 1등(금화 150 이상)을 털면 하우스가 주는 현상금
  PEEK_CATCH: .3, PEEK_LOSS: .2, // 상자 엿보기: 30% 들키면 금화 20%를 잃고 아무것도 못 본다
  ITEM_MAX: 2,                // 아이템은 한 번에 2개까지 들고 있는다
  STORM_CHESTS: 5,
  EVENT_AT: [.3, .55, .8],    // 이벤트 라운드가 오는 때(판 길이의 몇 %)
  GOLDEN_MS: 45000, STORM_MS: 45000, RAID_PCT: 10, RAID_SHOW_MS: 5000,
  TEAM_WIN_COINS: 3
};
export const ITEMS = { fifty: '50:50', freeze: '시간 정지', saver: '콤보 보호' };
const EVENT_ORDERS = [['golden', 'raid', 'storm'], ['raid', 'storm', 'golden'], ['storm', 'golden', 'raid'], ['golden', 'storm', 'raid'], ['storm', 'raid', 'golden'], ['raid', 'golden', 'storm']];
// 상자(확률 %). 훔치기를 끄면 steal · swap · shield가 금화로 바뀐다.
export const CHESTS = {
  gold: { w: 42, name: '금화' },
  double: { w: 6, name: '2배!' },
  triple: { w: 3, name: '3배!!' },
  nothing: { w: 8, name: '꽝' },
  steal: { w: 12, name: '훔치기' },
  shield: { w: 6, name: '방패' },
  swap: { w: 3, name: '바꾸기' },
  monster: { w: 9, name: '몬스터 습격' },
  jackpot: { w: 2, name: '대박 상자' },
  item: { w: 8, name: '아이템' }
};
const THEFT = new Set(['steal', 'swap', 'shield']);

// V13.150 혼자 보물 사냥(solo): duration_ms(3분) · no_steal_ms · hide_last_ms로 판 길이와 처음 훔치기 금지 · 마지막 순위 가리기를 바꾼다. revenge: 되갚기 표시할 친구 id.
export function createParty({ id, code, kind, minutes, steal = true, teams = false, questions, host, seed, school_id, class_name = '', label = '', duration_ms = 0, no_steal_ms = null, hide_last_ms = null, revenge = [], mult_cap = 0, now = Date.now() }) {
  return {
    id, code, kind: kind === 'fish' ? 'fish' : 'treasure', minutes: PARTY.MINUTES.includes(Number(minutes)) ? Number(minutes) : 8,
    steal: kind === 'fish' ? false : steal !== false, teams: kind !== 'fish' && !!teams, ev: [], event: null, questions: (questions || []).slice(0, 120), host, seed: Number(seed) >>> 0, school_id, class_name, label,
    phase: 'lobby', created_at: now, start_at: null, end_at: null, players: {}, order: [], feed: [], seq: 0,
    right_total: 0, frenzy_until: 0, frenzy_n: 0, leader: null, reported: false,
    duration_ms: Number(duration_ms) > 0 ? Number(duration_ms) : 0, no_steal_ms: no_steal_ms === null ? null : Number(no_steal_ms), hide_last_ms: hide_last_ms === null ? null : Number(hide_last_ms), revenge: (revenge || []).map(String).slice(0, 10), mult_cap: Math.max(0, Number(mult_cap) || 0)
  };
}
export function joinParty(room, p, now = Date.now()) {
  if (room.phase === 'ended') return { error: '게임이 끝났어요.' };
  if (room.players[p.id]) { room.players[p.id].name = p.name; return { ok: true, again: true }; }
  if (room.order.length >= PARTY.MAX_PLAYERS) return { error: `${PARTY.MAX_PLAYERS}명까지 들어올 수 있어요.` };
  const n = room.order.length;
  room.players[p.id] = {
    id: p.id, name: String(p.name || '학생').slice(0, 20), pet: p.pet || null, joined_at: now,
    gold: 0, kg: 0, right: 0, wrong: 0, streak: 0, shield: 0, qi: (n * 7) % Math.max(1, room.questions.length), q_at: 0, wait_until: 0,
    offer: null, pending: null, steals: {}, stolen_by: null, lure: 0, run: 0, casts: 0, fish: [],
    team: room.teams ? (room.order.filter(id => room.players[id].team === 'A').length <= room.order.filter(id => room.players[id].team === 'B').length ? 'A' : 'B') : null,
    inv: { fifty: 0, freeze: 0, saver: 0 }, heist: null, alarm: null, fifty: null,
    stat: { stolen: 0, blocked: 0, lost: 0, best: null }
  };
  room.order.push(p.id);
  if (room.phase === 'play') nextQuestion(room, room.players[p.id], now);
  return { ok: true };
}
export function startParty(room, now = Date.now()) {
  if (room.phase !== 'lobby') return { error: '이미 시작했어요.' };
  if (!room.order.length) return { error: '아직 들어온 학생이 없어요.' };
  const length = room.duration_ms || room.minutes * 60000;
  room.phase = 'play'; room.start_at = now; room.end_at = now + length;
  if (room.kind === 'treasure') {
    const order = EVENT_ORDERS[room.seed % EVENT_ORDERS.length];
    room.ev = PARTY.EVENT_AT.map((f, i) => ({ kind: order[i], at: now + Math.round(length * f), done: false }));
  }
  for (const pid of room.order) nextQuestion(room, room.players[pid], now);
  return { events: [feed(room, { kind: 'start' }, now)] };
}
export function endParty(room, now = Date.now()) {
  if (room.phase === 'ended') return { events: [] };
  room.phase = 'ended'; room.ended_at = now;
  room.event = null;
  for (const pid of room.order) { const pl = room.players[pid]; pl.offer = null; pl.pending = null; pl.heist = null; pl.alarm = null; }
  return { events: [{ kind: 'end' }] };
}
function nextQuestion(room, pl, now) {
  const qs = room.questions;
  pl.qi = (pl.qi + 1) % Math.max(1, qs.length);
  pl.q_at = Math.max(now, pl.wait_until || 0);
}
const currentQ = (room, pl) => room.questions[pl.qi % Math.max(1, room.questions.length)];
function feed(room, item, now) {
  const row = { n: ++room.seq, at: now, ...item };
  room.feed = [...room.feed, row].slice(-PARTY.FEED_KEEP);
  return row;
}
export const ranked = room => room.order.map(pid => room.players[pid]).sort((a, b) => (room.kind === 'fish' ? b.kg - a.kg : b.gold - a.gold) || b.right - a.right || a.joined_at - b.joined_at);

/* ---------- 답하기 ---------- */
const alarmLive = (pl, now) => !!pl.alarm && !pl.alarm.done && now < pl.alarm.until;
const invCount = pl => pl.inv.fifty + pl.inv.freeze + pl.inv.saver;
const eventNow = (room, kind, now) => !!room.event && room.event.kind === kind && now < room.event.until;
export function answer(room, pid, choice, now = Date.now(), random = Math.random) {
  const pl = room.players[pid];
  if (room.phase !== 'play' || !pl) return { events: [] };
  if (pl.offer || pl.pending || alarmLive(pl, now)) return { events: [] }; // 상자 · 표적 · 경보를 먼저
  if (now < (pl.wait_until || 0)) return { events: [] };
  const q = currentQ(room, pl);
  if (!q) return { events: [] };
  const ok = Number(choice) === q.answer, ms = Math.max(0, now - (pl.q_at || now));
  if (!ok) {
    pl.wrong++;
    if (pl.inv.saver > 0 && pl.streak > 0) pl.inv.saver--; else pl.streak = 0; // 콤보 보호: 틀려도 연속 정답이 이어진다
    if (room.kind === 'fish') { pl.run = 0; pl.lure = Math.max(0, pl.lure - 1); pl.casts++; }
    pl.wait_until = now + PARTY.WRONG_WAIT_MS;
    const missed = { kind: 'wrong', pid, word: q.prompt, answer: q.options[q.answer] };
    const events = [missed];
    if (pl.heist) events.push(heistFail(room, pl, now));
    nextQuestion(room, pl, now);
    return { events, me: missed };
  }
  pl.right++; pl.streak++; room.right_total++;
  if (room.kind === 'fish') return fishCatch(room, pl, ms, now);
  if (pl.heist) {
    pl.heist.got++;
    const done = pl.heist.got >= pl.heist.need, got = pl.heist.got, need = pl.heist.need;
    nextQuestion(room, pl, now);
    return done ? resolveHeist(room, pl, now) : { events: [], me: { kind: 'heist-step', pid, got, need } };
  }
  const count = eventNow(room, 'storm', now) ? PARTY.STORM_CHESTS : 3;
  pl.offer = { chests: Array.from({ length: count }, () => rollChest(room, pl, now, random)), at: now, peeked: false, caught: false };
  return { events: [], me: { kind: 'chests', pid } };
}

/* ---------- 보물 사냥 ---------- */
function rollChest(room, pl, now, random) {
  const early = now - room.start_at < (room.no_steal_ms ?? PARTY.NO_STEAL_MS);
  const rank = ranked(room).findIndex(x => x.id === pl.id), n = room.order.length;
  const behind = n >= 4 && rank >= Math.ceil(n * .7);
  const odds = Object.entries(CHESTS).map(([k, c]) => {
    let w = c.w;
    if (k === 'item' && behind) w *= 1.5;
    if (THEFT.has(k) && (!room.steal || (early && k !== 'shield'))) w = 0;
    if (behind) w *= k === 'shield' ? 1.5 : k === 'gold' ? 1.2 : k === 'monster' ? .5 : 1;
    return [k, w];
  });
  let roll = random() * odds.reduce((s, [, w]) => s + w, 0), kind = 'gold';
  for (const [k, w] of odds) { if ((roll -= w) <= 0) { kind = k; break; } }
  const chest = { kind };
  const golden = eventNow(room, 'golden', now) ? 2 : 1; // 황금 시간: 금화가 두 배
  if (kind === 'gold') chest.amount = Math.round((10 + random() * 40) * (1 + Math.min(10, pl.streak) * .1) * golden / 5) * 5;
  if (kind === 'steal') chest.pct = random() < .6 ? 10 : 25;
  if (kind === 'jackpot') chest.amount = (200 + Math.round(random() * 20) * 5) * golden;
  if (kind === 'item') { const pool = room.steal ? ['fifty', 'freeze', 'saver'] : ['fifty', 'saver']; chest.item = pool[Math.floor(random() * pool.length)]; }
  return chest;
}
export function pick(room, pid, i, now = Date.now()) {
  const pl = room.players[pid];
  if (room.phase !== 'play' || !pl?.offer) return { events: [] };
  const chests = pl.offer.chests, idx = Math.max(0, Math.min(chests.length - 1, Math.floor(Number(i) || 0)));
  const c = chests[idx];
  pl.offer = null;
  const events = [], me = { kind: 'opened', pid, idx, chests, chest: c };
  if (c.kind === 'gold') pl.gold += c.amount;
  // 혼자 보물 사냥(mult_cap): 2배 · 3배가 계속 곱해져 금고가 운으로만 커지지 않게, 늘어나는 금화를 2배 ≤ cap · 3배 ≤ cap×2로 막는다.
  else if (c.kind === 'double') { me.before = pl.gold; pl.gold = room.mult_cap ? pl.gold + Math.min(room.mult_cap, pl.gold) || 20 : pl.gold * 2 || 20; }
  else if (c.kind === 'triple') { me.before = pl.gold; pl.gold = room.mult_cap ? pl.gold + Math.min(room.mult_cap * 2, pl.gold * 2) || 30 : pl.gold * 3 || 30; }
  else if (c.kind === 'jackpot') { pl.gold += c.amount; events.push(feed(room, { kind: 'jackpot', pid, name: pl.name, amount: c.amount }, now)); }
  else if (c.kind === 'monster') { const lost = Math.floor(pl.gold * .25); pl.gold -= lost; pl.stat.lost += lost; me.lost = lost; if (lost >= 60) events.push(feed(room, { kind: 'monster', pid, name: pl.name, amount: lost }, now)); }
  else if (c.kind === 'shield') { pl.shield = Math.min(2, pl.shield + 1); }
  else if (c.kind === 'item') {
    if (invCount(pl) >= PARTY.ITEM_MAX) { pl.gold += 20; me.fallback = 20; }
    else { pl.inv[c.item]++; me.item = c.item; }
  }
  else if (c.kind === 'steal' || c.kind === 'swap') {
    const list = targets(room, pl, now, c.kind);
    if (!list.length) { pl.gold += 30; me.fallback = 30; }
    else { pl.pending = { kind: c.kind, pct: c.pct || 0, until: now + PARTY.TARGET_MS, list: list.map(x => x.id) }; me.targets = true; }
  }
  pl.gold = Math.max(0, Math.round(pl.gold));
  nextQuestion(room, pl, now);
  events.push(...leaderCheck(room, now));
  return { events, me };
}
// 훔칠 수 있는 친구: 나를 뺀 위 5명 + 30초 안에 나에게서 훔쳐 간 친구(되갚기). 같은 친구는 2번까지. 바꾸기는 나보다 많은 친구만.
export function targets(room, pl, now = Date.now(), kind = 'steal') {
  const foe = x => !room.teams || x.team !== pl.team; // 팀전: 상대 팀만
  const top = ranked(room).filter(x => x.id !== pl.id && foe(x)).slice(0, PARTY.STEAL_TOP);
  const rev = pl.stolen_by && now - pl.stolen_by.at < PARTY.REVENGE_MS ? room.players[pl.stolen_by.pid] : null;
  const back = (room.revenge || []).map(id => room.players[id]).filter(x => x && x !== pl && foe(x)); // 혼자 보물 사냥: 이번 주에 나를 턴 친구
  const list = [...top, ...[rev, ...back].filter((x, i, a) => x && !top.includes(x) && foe(x) && a.indexOf(x) === i)];
  const bounty = bountyId(room);
  return list.filter(x => (pl.steals[x.id] || 0) < PARTY.STEAL_LIMIT && x.gold > 0 && (kind !== 'swap' || x.gold > pl.gold))
    .map(x => ({ id: x.id, name: x.name, pet: x.pet, gold: x.gold, revenge: x === rev || back.includes(x), bounty: x.id === bounty }));
}
export function target(room, pid, tid, now = Date.now()) {
  const pl = room.players[pid];
  if (room.phase !== 'play' || !pl?.pending) return { events: [] };
  const p = pl.pending;
  const victim = p.list.includes(tid) ? room.players[tid] : null;
  if (!victim) return { events: [] };
  pl.pending = null;
  pl.steals[victim.id] = (pl.steals[victim.id] || 0) + 1;
  if (victim.shield > 0) {
    victim.shield--; victim.stat.blocked++;
    const events = [feed(room, { kind: 'block', pid, name: pl.name, vid: victim.id, vname: victim.name }, now), ...leaderCheck(room, now)];
    return { events, me: { kind: 'blocked', pid, vid: victim.id, vname: victim.name } };
  }
  // 방패가 없으면 금고 털이 시작: 훔치는 쪽은 연속 3문제, 당하는 쪽은 도난 경보(5초 안에 1문제로 막기).
  pl.heist = { vid: victim.id, kind: p.kind, pct: p.pct || 0, need: PARTY.HEIST_NEED, got: 0, until: now + PARTY.HEIST_MS };
  let ms = PARTY.ALARM_MS;
  if (victim.inv.freeze > 0) { victim.inv.freeze--; ms = PARTY.ALARM_FREEZE_MS; } // 시간 정지
  victim.alarm = { by: pl.id, until: now + ms, done: false, defended: false, qi: hash(`${victim.id}:${pl.id}:${now}`) % Math.max(1, room.questions.length) };
  const bounty = bountyId(room) === victim.id;
  return { events: [feed(room, { kind: 'heist', pid, name: pl.name, vid: victim.id, vname: victim.name, swap: p.kind === 'swap', bounty }, now)], me: { kind: 'heist', pid, vid: victim.id, vname: victim.name, need: PARTY.HEIST_NEED } };
}
// 1등이면서 금화가 150 이상이면 현상금이 걸린다(털면 하우스가 50을 더 준다).
export function bountyId(room) {
  if (room.kind !== 'treasure' || room.phase !== 'play') return null;
  const top = ranked(room)[0];
  return top && top.gold >= PARTY.BOUNTY_MIN ? top.id : null;
}
function heistFail(room, pl, now) {
  const h = pl.heist, victim = room.players[h.vid];
  if (victim?.alarm?.by === pl.id) victim.alarm = null;
  pl.heist = null;
  return feed(room, { kind: 'heistfail', pid: pl.id, name: pl.name, vid: h.vid, vname: victim?.name || '' }, now);
}
function resolveHeist(room, pl, now) {
  const h = pl.heist, victim = room.players[h.vid];
  pl.heist = null;
  if (!victim) return { events: [] };
  const defended = victim.alarm?.by === pl.id && victim.alarm.defended;
  if (victim.alarm?.by === pl.id) victim.alarm = null;
  const void_ = () => ({ events: [feed(room, { kind: 'heistfail', pid: pl.id, name: pl.name, vid: victim.id, vname: victim.name }, now)], me: { kind: 'heist-void', pid: pl.id } });
  if (defended) {
    victim.stat.blocked++; victim.gold += PARTY.DEFEND_GOLD;
    const events = [feed(room, { kind: 'block', pid: pl.id, name: pl.name, vid: victim.id, vname: victim.name, defended: true }, now)];
    return { events, me: { kind: 'blocked', pid: pl.id, vid: victim.id, vname: victim.name, defended: true } };
  }
  const events = [];
  let me;
  if (h.kind === 'swap') {
    if (victim.gold <= pl.gold) return void_(); // 그사이 나보다 적어졌으면 바꿀 수 없다
    const mine = pl.gold; pl.gold = victim.gold; victim.gold = mine;
    victim.stolen_by = { pid: pl.id, at: now };
    events.push(feed(room, { kind: 'swap', pid: pl.id, name: pl.name, vid: victim.id, vname: victim.name, amount: pl.gold - mine }, now));
    me = { kind: 'swapped', pid: pl.id, vid: victim.id, vname: victim.name, gain: pl.gold - mine };
  } else {
    if (victim.gold <= 0) return void_();
    const bonus = bountyId(room) === victim.id ? PARTY.BOUNTY : 0;
    const amount = Math.min(victim.gold, Math.max(1, Math.floor(victim.gold * h.pct / 100)));
    victim.gold -= amount; pl.gold += amount + bonus; pl.stat.stolen += amount; victim.stat.lost += amount;
    victim.stolen_by = { pid: pl.id, at: now };
    events.push(feed(room, { kind: 'steal', pid: pl.id, name: pl.name, vid: victim.id, vname: victim.name, pct: h.pct, amount, bounty: bonus }, now));
    me = { kind: 'stole', pid: pl.id, vid: victim.id, vname: victim.name, amount, pct: h.pct, bounty: bonus };
  }
  events.push(...leaderCheck(room, now));
  return { events, me };
}

// 도난 경보에 답하기(당하는 친구): 정답이면 막는다. 문제는 방이 낸다.
export function alarmAnswer(room, pid, choice, now = Date.now()) {
  const pl = room.players[pid], a = pl?.alarm;
  if (room.phase !== 'play' || !a || !alarmLive(pl, now)) return { events: [] };
  const q = room.questions[a.qi % Math.max(1, room.questions.length)];
  a.done = true; a.defended = Number(choice) === q.answer;
  return { events: [], me: { kind: 'alarmed', pid, defended: a.defended, word: q.prompt, answer: q.options[q.answer] } };
}
// 상자 엿보기: 30%는 들켜서 금화 20%를 잃고 아무것도 못 본다. 상자 하나에 한 번.
export function peek(room, pid, now = Date.now(), random = Math.random) {
  const pl = room.players[pid];
  if (room.phase !== 'play' || !pl?.offer || pl.offer.peeked) return { events: [] };
  pl.offer.peeked = true;
  if (random() < PARTY.PEEK_CATCH) {
    pl.offer.caught = true;
    const lost = Math.floor(pl.gold * PARTY.PEEK_LOSS);
    pl.gold -= lost; pl.stat.lost += lost;
    const events = lost >= 30 ? [feed(room, { kind: 'peekcaught', pid, name: pl.name, amount: lost }, now)] : [];
    return { events, me: { kind: 'peeked', pid, caught: true, lost } };
  }
  return { events: [], me: { kind: 'peeked', pid, caught: false } };
}
// 아이템 쓰기: 50:50(지금 문제의 틀린 보기 둘을 지운다). 시간 정지 · 콤보 보호는 알아서 쓰인다.
export function useItem(room, pid, item, now = Date.now()) {
  const pl = room.players[pid];
  if (room.phase !== 'play' || !pl || item !== 'fifty' || pl.inv.fifty < 1 || pl.offer || pl.pending || alarmLive(pl, now)) return { events: [] };
  const q = currentQ(room, pl);
  if (!q || (pl.fifty && pl.fifty.qi === pl.qi)) return { events: [] };
  const wrong = q.options.map((_, i) => i).filter(i => i !== q.answer);
  const a = hash(`${pl.id}:${pl.qi}`) % wrong.length, hide = [wrong[a], wrong[(a + 1) % wrong.length]];
  pl.inv.fifty--; pl.fifty = { qi: pl.qi, hide };
  return { events: [], me: { kind: 'itemused', pid, item } };
}
function leaderCheck(room, now) {
  const top = ranked(room)[0];
  if (!top || top.id === room.leader || !(room.kind === 'fish' ? top.kg : top.gold)) return [];
  const was = room.leader;
  room.leader = top.id;
  // 1등이 자주 바뀌어도 소식은 10초에 한 번만(TV가 '1등 탈환'으로 가득 차지 않게).
  if (!was || now - (room.lead_at || 0) < PARTY.LEAD_NEWS_MS) return [];
  room.lead_at = now;
  return [feed(room, { kind: 'lead', pid: top.id, name: top.name }, now)];
}

/* ---------- 반 전체 낚시 ---------- */
function fishCatch(room, pl, ms, now) {
  const frenzy = now < room.frenzy_until;
  const lure = Math.min(LURES.length - 1, pl.lure + (frenzy ? PARTY.FRENZY_LURE : 0));
  const seed = (room.seed ^ hash(pl.id)) >>> 0;
  const fish = rollCast(seed, pl.casts, lure, ms);
  pl.casts++;
  pl.kg = Math.round((pl.kg + fish.kg) * 100) / 100;
  pl.fish = [...pl.fish, { key: fish.key, kg: fish.kg }].slice(-60);
  if (!pl.stat.best || fish.kg > pl.stat.best.kg) pl.stat.best = { key: fish.key, kg: fish.kg };
  pl.run++;
  if (pl.run >= 3) { pl.run = 0; pl.lure = Math.min(LURES.length - 1, pl.lure + 1); }
  const events = [];
  if (['rare', 'epic', 'legend', 'golden'].includes(fish.rarity)) events.push(feed(room, { kind: 'fish', pid: pl.id, name: pl.name, key: fish.key, kg: fish.kg, rarity: fish.rarity }, now));
  // 반 정답이 40개 모일 때마다 물고기 떼(20초).
  if (Math.floor(room.right_total / PARTY.FRENZY_EVERY) > room.frenzy_n) {
    room.frenzy_n = Math.floor(room.right_total / PARTY.FRENZY_EVERY);
    room.frenzy_until = now + PARTY.FRENZY_MS;
    events.push(feed(room, { kind: 'frenzy', until: room.frenzy_until }, now));
  }
  nextQuestion(room, pl, now);
  events.push(...leaderCheck(room, now));
  return { events, me: { kind: 'caught', pid: pl.id, fish, lure: pl.lure, frenzy } };
}
function hash(s) { let h = 2166136261; for (const ch of String(s)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }

/* ---------- 시간 ---------- */
// 이벤트 라운드: 황금 시간(45초 금화 2배) · 해적선 습격(방패 없는 모두 금화 −10%) · 보물 폭풍(45초 상자 5개).
function fireEvents(room, now) {
  const events = [];
  for (const ev of room.ev || []) {
    if (ev.done || now < ev.at) continue;
    ev.done = true;
    if (ev.kind === 'raid') {
      let total = 0, hit = 0;
      for (const pid of room.order) { const pl = room.players[pid]; if (pl.shield > 0) continue; const lost = Math.floor(pl.gold * PARTY.RAID_PCT / 100); if (lost) { pl.gold -= lost; pl.stat.lost += lost; total += lost; hit++; } }
      room.event = { kind: 'raid', until: ev.at + PARTY.RAID_SHOW_MS };
      events.push(feed(room, { kind: 'event', event: 'raid', total, hit, until: room.event.until }, now));
    } else {
      room.event = { kind: ev.kind, until: ev.at + (ev.kind === 'golden' ? PARTY.GOLDEN_MS : PARTY.STORM_MS) };
      events.push(feed(room, { kind: 'event', event: ev.kind, until: room.event.until }, now));
    }
  }
  if (room.event && now >= room.event.until) room.event = null;
  return events;
}
// 끝날 시간, 훔칠 친구를 안 고른 채 시간이 지난 학생(1등에게서 훔친다), 금고 털이 시간 초과, 도난 경보 마감, 이벤트 라운드.
export function tick(room, now = Date.now()) {
  const events = [];
  if (room.phase === 'play' && now >= room.end_at) return endParty(room, now);
  if (room.phase !== 'play') return { events };
  events.push(...fireEvents(room, now));
  for (const pid of room.order) {
    const pl = room.players[pid];
    if (pl.heist && now >= pl.heist.until) events.push(heistFail(room, pl, now));
    if (pl.alarm && !pl.alarm.done && now >= pl.alarm.until) pl.alarm.done = true;
    if (pl.pending && now >= pl.pending.until) {
      const first = pl.pending.list.find(id => room.players[id]);
      const r = first ? target(room, pid, first, pl.pending.until) : (pl.pending = null, { events: [] }); // 마감 시각 기준(언제 맥박이 돌든 같다)
      events.push(...r.events);
    }
  }
  return { events };
}
export function nextWake(room) {
  if (room.phase === 'lobby') return room.created_at + PARTY.LOBBY_MS;
  if (room.phase !== 'play') return null;
  const waits = room.order.map(pid => room.players[pid].pending?.until).filter(Boolean);
  const evs = (room.ev || []).filter(e => !e.done).map(e => e.at);
  return Math.min(room.end_at, ...waits, ...evs);
}

/* ---------- 화면에 보내는 것 ---------- */
const petOf = pl => pl.pet ? { key: pl.pet.key, form: pl.pet.form } : null;
const teamTotals = room => room.teams ? ['A', 'B'].map(t => ({ team: t, gold: room.order.reduce((n, id) => n + (room.players[id].team === t ? room.players[id].gold : 0), 0), players: room.order.filter(id => room.players[id].team === t).length })) : null;
const eventView = (room, now) => room.event && now < room.event.until ? { kind: room.event.kind, until: room.event.until } : null;
export function tvView(room, now = Date.now()) {
  const list = ranked(room), hide = room.phase === 'play' && room.end_at - now < (room.hide_last_ms ?? PARTY.HIDE_LAST_MS);
  return {
    id: room.id, code: room.code, kind: room.kind, phase: room.phase, minutes: room.minutes, steal: room.steal, teams: room.teams, label: room.label,
    event: eventView(room, now), bounty: hide ? null : bountyId(room), team_gold: hide ? null : teamTotals(room),
    start_at: room.start_at, end_at: room.end_at, now, hidden: hide, players: list.length, right_total: room.right_total,
    frenzy_until: room.frenzy_until > now ? room.frenzy_until : 0, feed: room.feed,
    lobby: room.phase === 'lobby' ? list.map(x => ({ id: x.id, name: x.name, pet: petOf(x) })) : undefined,
    // 마지막 1분: 점수 · 순위 대신 이름 순서(줄 순서로도 순위가 새지 않게).
    top: hide ? [...list].sort((a, b) => a.name.localeCompare(b.name, 'ko')).slice(0, 10).map(x => ({ id: x.id, rank: null, name: x.name, pet: petOf(x), score: null, right: null, shield: 0, team: x.team }))
      : list.slice(0, 10).map((x, i) => ({ id: x.id, rank: i + 1, name: x.name, pet: petOf(x), score: room.kind === 'fish' ? x.kg : x.gold, right: x.right, shield: x.shield, team: x.team })),
    ...(room.phase === 'ended' ? { awards: awards(room) } : {})
  };
}
export function playerView(room, pid, now = Date.now()) {
  const pl = room.players[pid];
  if (!pl) return null;
  const list = ranked(room), rank = list.findIndex(x => x.id === pid) + 1;
  const q = room.phase === 'play' && !pl.offer && !pl.pending && !alarmLive(pl, now) ? currentQ(room, pl) : null;
  // 마지막 1분은 TV처럼 폰에서도 순위 · 1~3등을 가린다(끝나고 한꺼번에 공개).
  const hide = room.phase === 'play' && room.end_at - now < (room.hide_last_ms ?? PARTY.HIDE_LAST_MS);
  return {
    kind: room.kind, phase: room.phase, label: room.label, end_at: room.end_at, start_at: room.start_at, now, steal: room.steal, teams: room.teams,
    hidden: hide, event: eventView(room, now), team_gold: hide ? null : teamTotals(room),
    me: { id: pl.id, name: pl.name, gold: pl.gold, kg: pl.kg, right: pl.right, wrong: pl.wrong, streak: pl.streak, shield: pl.shield, lure: pl.lure, run: pl.run, rank: hide ? null : rank, of: list.length, team: pl.team, inv: pl.inv },
    q: q ? { n: pl.right + pl.wrong, prompt: q.prompt, options: q.options, wait_until: pl.wait_until > now ? pl.wait_until : 0, hide: pl.fifty && pl.fifty.qi === pl.qi ? pl.fifty.hide : [] } : null,
    heist: pl.heist ? { kind: pl.heist.kind, pct: pl.heist.pct, got: pl.heist.got, need: pl.heist.need, until: pl.heist.until, vname: room.players[pl.heist.vid]?.name || '' } : null,
    alarm: alarmLive(pl, now) ? (() => { const a = pl.alarm, aq = room.questions[a.qi % Math.max(1, room.questions.length)]; return { until: a.until, by: room.players[a.by]?.name || '', prompt: aq.prompt, options: aq.options }; })() : null,
    offer: pl.offer ? { n: pl.right, count: pl.offer.chests.length, peeked: pl.offer.peeked, caught: pl.offer.caught, kinds: pl.offer.peeked && !pl.offer.caught ? pl.offer.chests.map(c => c.kind) : null } : null,
    pending: pl.pending ? { kind: pl.pending.kind, pct: pl.pending.pct, until: pl.pending.until, targets: targets(room, pl, now, pl.pending.kind).filter(x => pl.pending.list.includes(x.id)) } : null,
    frenzy_until: room.frenzy_until > now ? room.frenzy_until : 0,
    top: hide ? [] : list.slice(0, 3).map(x => ({ id: x.id, name: x.name, score: room.kind === 'fish' ? x.kg : x.gold })),
    players: room.phase === 'lobby' ? list.length : undefined,
    ...(room.phase === 'ended' ? { awards: awards(room), result: partyResultFor(room, pid) } : {})
  };
}
// 재미 상: 정답왕 · 가장 많이 훔친 사람 · 가장 많이 막은 사람(보물) / 가장 귀한 물고기(낚시).
export function awards(room) {
  const list = room.order.map(pid => room.players[pid]), out = [];
  const best = (f, min = 1) => { const top = [...list].sort((a, b) => f(b) - f(a))[0]; return top && f(top) >= min ? top : null; };
  const smart = best(x => x.right);
  if (smart) out.push({ key: 'smart', title: '정답왕', name: smart.name, pid: smart.id, value: `${smart.right}문제` });
  if (room.kind === 'treasure') {
    const thief = best(x => x.stat.stolen);
    if (thief) out.push({ key: 'thief', title: '대도', name: thief.name, pid: thief.id, value: `${thief.stat.stolen}금화` });
    const wall = best(x => x.stat.blocked);
    if (wall) out.push({ key: 'wall', title: '철벽 방패', name: wall.name, pid: wall.id, value: `${wall.stat.blocked}번 막음` });
  } else {
    const order = ['common', 'uncommon', 'rare', 'epic', 'legend', 'golden'];
    const rare = best(x => x.stat.best ? order.indexOf(FISH[x.stat.best.key].rarity) * 10000 + x.stat.best.kg : -1, 0);
    if (rare?.stat.best) out.push({ key: 'rare', title: '가장 귀한 물고기', name: rare.name, pid: rare.id, value: `${FISH[rare.stat.best.key].name} ${rare.stat.best.kg}kg`, fish: rare.stat.best.key, rarity: RARITY[FISH[rare.stat.best.key].rarity].name });
  }
  return out;
}
// 진짜 코인: 맞힌 수 절반(최대 15) + 1등 10 · 2등 6 · 3등 4(3명 이상일 때). 5문제 이상 맞혀야.
export function partyCoins(right, rank, n) {
  if (right < PARTY.MIN_RIGHT) return 0;
  return Math.min(15, Math.floor(right / 2)) + (n >= 3 ? [0, 10, 6, 4][rank] || 0 : 0);
}
// 팀전: 금화 합계가 더 많은 팀이 이긴다(같으면 아무도 아님). 5문제 이상 맞힌 이긴 팀 학생은 코인 +3.
export function teamWinner(room) {
  const t = teamTotals(room);
  return t && t[0].gold !== t[1].gold ? (t[0].gold > t[1].gold ? 'A' : 'B') : null;
}
export function partyResultFor(room, pid) {
  const list = ranked(room), i = list.findIndex(x => x.id === pid), pl = room.players[pid];
  if (!pl) return null;
  const win = !!pl.team && pl.team === teamWinner(room), bonus = win && pl.right >= PARTY.MIN_RIGHT ? PARTY.TEAM_WIN_COINS : 0;
  return { rank: i + 1, of: list.length, right: pl.right, score: room.kind === 'fish' ? pl.kg : pl.gold, coins: partyCoins(pl.right, i + 1, list.length) + bonus, xp: pl.right, team: pl.team, team_win: win, team_gold: teamTotals(room) };
}
// 방이 끝나면 본 상태에 알리는 것(server/service.mjs settleParty).
export function partyReport(room) {
  const list = ranked(room);
  return {
    id: room.id, kind: room.kind, ended_at: room.ended_at,
    players: list.map((x, i) => ({ id: x.id, rank: i + 1, right: x.right, wrong: x.wrong, score: room.kind === 'fish' ? x.kg : x.gold, team_win: !!x.team && x.team === teamWinner(room), fish: room.kind === 'fish' ? x.fish.slice(-40) : undefined }))
  };
}
