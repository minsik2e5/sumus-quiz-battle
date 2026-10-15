import { rollCast, LURES, FISH, RARITY } from '../public/modules/fishing-rules.js';

// V13.149 교실 게임(선생님 TV + 학생 폰) 규칙. 방(cloudflare/party-room.mjs)이 이 함수들을 부른다. 화면 · 저장 · 소켓은 모른다.
//   kind 'treasure' 보물 사냥(Blooket 골드 퀘스트 방식): 맞히면 상자 3개 중 하나 → 금화 · 배수 · 훔치기 · 방패 · 바꾸기 · 몬스터 · 대박
//   kind 'fish'     반 전체 낚시: 맞히면 물고기(fishing-rules.js rollCast), 반 정답이 모이면 '물고기 떼'(잠깐 큰 물고기만)
// 게임 금화 · 무게는 그 판에서만 쓰인다. 진짜 코인은 끝난 뒤 정답 수 위주로(partyCoins).

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
  MIN_RIGHT: 5                // 5문제 이상 맞혀야 코인
};
// 상자(확률 %). 훔치기를 끄면 steal · swap · shield가 금화로 바뀐다.
export const CHESTS = {
  gold: { w: 45, name: '금화' },
  double: { w: 6, name: '2배!' },
  triple: { w: 3, name: '3배!!' },
  nothing: { w: 10, name: '꽝' },
  steal: { w: 12, name: '훔치기' },
  shield: { w: 8, name: '방패' },
  swap: { w: 3, name: '바꾸기' },
  monster: { w: 10, name: '몬스터 습격' },
  jackpot: { w: 2, name: '대박 상자' }
};
const THEFT = new Set(['steal', 'swap', 'shield']);

export function createParty({ id, code, kind, minutes, steal = true, questions, host, seed, school_id, class_name = '', label = '', now = Date.now() }) {
  return {
    id, code, kind: kind === 'fish' ? 'fish' : 'treasure', minutes: PARTY.MINUTES.includes(Number(minutes)) ? Number(minutes) : 8,
    steal: kind === 'fish' ? false : steal !== false, questions: (questions || []).slice(0, 120), host, seed: Number(seed) >>> 0, school_id, class_name, label,
    phase: 'lobby', created_at: now, start_at: null, end_at: null, players: {}, order: [], feed: [], seq: 0,
    right_total: 0, frenzy_until: 0, frenzy_n: 0, leader: null, reported: false
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
    stat: { stolen: 0, blocked: 0, lost: 0, best: null }
  };
  room.order.push(p.id);
  if (room.phase === 'play') nextQuestion(room, room.players[p.id], now);
  return { ok: true };
}
export function startParty(room, now = Date.now()) {
  if (room.phase !== 'lobby') return { error: '이미 시작했어요.' };
  if (!room.order.length) return { error: '아직 들어온 학생이 없어요.' };
  room.phase = 'play'; room.start_at = now; room.end_at = now + room.minutes * 60000;
  for (const pid of room.order) nextQuestion(room, room.players[pid], now);
  return { events: [feed(room, { kind: 'start' }, now)] };
}
export function endParty(room, now = Date.now()) {
  if (room.phase === 'ended') return { events: [] };
  room.phase = 'ended'; room.ended_at = now;
  for (const pid of room.order) { const pl = room.players[pid]; pl.offer = null; pl.pending = null; }
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
export function answer(room, pid, choice, now = Date.now(), random = Math.random) {
  const pl = room.players[pid];
  if (room.phase !== 'play' || !pl) return { events: [] };
  if (pl.offer || pl.pending) return { events: [] }; // 상자 · 표적을 먼저
  if (now < (pl.wait_until || 0)) return { events: [] };
  const q = currentQ(room, pl);
  if (!q) return { events: [] };
  const ok = Number(choice) === q.answer, ms = Math.max(0, now - (pl.q_at || now));
  if (!ok) {
    pl.wrong++; pl.streak = 0;
    if (room.kind === 'fish') { pl.run = 0; pl.lure = Math.max(0, pl.lure - 1); pl.casts++; }
    pl.wait_until = now + PARTY.WRONG_WAIT_MS;
    const missed = { kind: 'wrong', pid, word: q.prompt, answer: q.options[q.answer] };
    nextQuestion(room, pl, now);
    return { events: [missed], me: missed };
  }
  pl.right++; pl.streak++; room.right_total++;
  if (room.kind === 'fish') return fishCatch(room, pl, ms, now);
  pl.offer = { chests: [0, 1, 2].map(() => rollChest(room, pl, now, random)), at: now };
  return { events: [], me: { kind: 'chests', pid } };
}

/* ---------- 보물 사냥 ---------- */
function rollChest(room, pl, now, random) {
  const early = now - room.start_at < PARTY.NO_STEAL_MS;
  const rank = ranked(room).findIndex(x => x.id === pl.id), n = room.order.length;
  const behind = n >= 4 && rank >= Math.ceil(n * .7);
  const odds = Object.entries(CHESTS).map(([k, c]) => {
    let w = c.w;
    if (THEFT.has(k) && (!room.steal || (early && k !== 'shield'))) w = 0;
    if (behind) w *= k === 'shield' ? 1.5 : k === 'gold' ? 1.2 : k === 'monster' ? .5 : 1;
    return [k, w];
  });
  let roll = random() * odds.reduce((s, [, w]) => s + w, 0), kind = 'gold';
  for (const [k, w] of odds) { if ((roll -= w) <= 0) { kind = k; break; } }
  const chest = { kind };
  if (kind === 'gold') chest.amount = Math.round((10 + random() * 40) * (1 + Math.min(10, pl.streak) * .1) / 5) * 5;
  if (kind === 'steal') chest.pct = random() < .6 ? 10 : 25;
  if (kind === 'jackpot') chest.amount = 200 + Math.round(random() * 20) * 5;
  return chest;
}
export function pick(room, pid, i, now = Date.now()) {
  const pl = room.players[pid];
  if (room.phase !== 'play' || !pl?.offer) return { events: [] };
  const idx = Math.max(0, Math.min(2, Math.floor(Number(i) || 0)));
  const chests = pl.offer.chests, c = chests[idx];
  pl.offer = null;
  const events = [], me = { kind: 'opened', pid, idx, chests, chest: c };
  if (c.kind === 'gold') pl.gold += c.amount;
  else if (c.kind === 'double') { me.before = pl.gold; pl.gold = pl.gold * 2 || 20; }
  else if (c.kind === 'triple') { me.before = pl.gold; pl.gold = pl.gold * 3 || 30; }
  else if (c.kind === 'jackpot') { pl.gold += c.amount; events.push(feed(room, { kind: 'jackpot', pid, name: pl.name, amount: c.amount }, now)); }
  else if (c.kind === 'monster') { const lost = Math.floor(pl.gold * .25); pl.gold -= lost; pl.stat.lost += lost; me.lost = lost; if (lost >= 60) events.push(feed(room, { kind: 'monster', pid, name: pl.name, amount: lost }, now)); }
  else if (c.kind === 'shield') { pl.shield = Math.min(2, pl.shield + 1); }
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
  const top = ranked(room).filter(x => x.id !== pl.id).slice(0, PARTY.STEAL_TOP);
  const rev = pl.stolen_by && now - pl.stolen_by.at < PARTY.REVENGE_MS ? room.players[pl.stolen_by.pid] : null;
  const list = [...top, ...(rev && !top.includes(rev) ? [rev] : [])];
  return list.filter(x => (pl.steals[x.id] || 0) < PARTY.STEAL_LIMIT && x.gold > 0 && (kind !== 'swap' || x.gold > pl.gold))
    .map(x => ({ id: x.id, name: x.name, pet: x.pet, gold: x.gold, revenge: x === rev }));
}
export function target(room, pid, tid, now = Date.now()) {
  const pl = room.players[pid];
  if (room.phase !== 'play' || !pl?.pending) return { events: [] };
  const p = pl.pending;
  const victim = p.list.includes(tid) ? room.players[tid] : null;
  if (!victim) return { events: [] };
  pl.pending = null;
  pl.steals[victim.id] = (pl.steals[victim.id] || 0) + 1;
  const events = [];
  let me;
  if (victim.shield > 0) {
    victim.shield--; victim.stat.blocked++;
    events.push(feed(room, { kind: 'block', pid, name: pl.name, vid: victim.id, vname: victim.name }, now));
    me = { kind: 'blocked', pid, vid: victim.id, vname: victim.name };
  } else if (p.kind === 'swap') {
    const mine = pl.gold; pl.gold = victim.gold; victim.gold = mine;
    victim.stolen_by = { pid, at: now };
    events.push(feed(room, { kind: 'swap', pid, name: pl.name, vid: victim.id, vname: victim.name, amount: pl.gold - mine }, now));
    me = { kind: 'swapped', pid, vid: victim.id, vname: victim.name, gain: pl.gold - mine };
  } else {
    const amount = Math.max(1, Math.floor(victim.gold * p.pct / 100));
    victim.gold -= amount; pl.gold += amount; pl.stat.stolen += amount; victim.stat.lost += amount;
    victim.stolen_by = { pid, at: now };
    events.push(feed(room, { kind: 'steal', pid, name: pl.name, vid: victim.id, vname: victim.name, pct: p.pct, amount }, now));
    me = { kind: 'stole', pid, vid: victim.id, vname: victim.name, amount, pct: p.pct };
  }
  events.push(...leaderCheck(room, now));
  return { events, me };
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
// 끝날 시간, 훔칠 친구를 안 고른 채 시간이 지난 학생(1등에게서 훔친다).
export function tick(room, now = Date.now()) {
  const events = [];
  if (room.phase === 'play' && now >= room.end_at) return endParty(room, now);
  if (room.phase !== 'play') return { events };
  for (const pid of room.order) {
    const pl = room.players[pid];
    if (pl.pending && now >= pl.pending.until) {
      const first = pl.pending.list.find(id => room.players[id]);
      const r = first ? target(room, pid, first, now) : (pl.pending = null, { events: [] });
      events.push(...r.events);
    }
  }
  return { events };
}
export function nextWake(room) {
  if (room.phase === 'lobby') return room.created_at + PARTY.LOBBY_MS;
  if (room.phase !== 'play') return null;
  const waits = room.order.map(pid => room.players[pid].pending?.until).filter(Boolean);
  return Math.min(room.end_at, ...waits);
}

/* ---------- 화면에 보내는 것 ---------- */
const petOf = pl => pl.pet ? { key: pl.pet.key, form: pl.pet.form } : null;
export function tvView(room, now = Date.now()) {
  const list = ranked(room), hide = room.phase === 'play' && room.end_at - now < PARTY.HIDE_LAST_MS;
  return {
    id: room.id, code: room.code, kind: room.kind, phase: room.phase, minutes: room.minutes, steal: room.steal, label: room.label,
    start_at: room.start_at, end_at: room.end_at, now, hidden: hide, players: list.length, right_total: room.right_total,
    frenzy_until: room.frenzy_until > now ? room.frenzy_until : 0, feed: room.feed,
    lobby: room.phase === 'lobby' ? list.map(x => ({ id: x.id, name: x.name, pet: petOf(x) })) : undefined,
    // 마지막 1분: 점수 · 순위 대신 이름 순서(줄 순서로도 순위가 새지 않게).
    top: hide ? [...list].sort((a, b) => a.name.localeCompare(b.name, 'ko')).slice(0, 10).map(x => ({ id: x.id, rank: null, name: x.name, pet: petOf(x), score: null, right: null, shield: 0 }))
      : list.slice(0, 10).map((x, i) => ({ id: x.id, rank: i + 1, name: x.name, pet: petOf(x), score: room.kind === 'fish' ? x.kg : x.gold, right: x.right, shield: x.shield })),
    ...(room.phase === 'ended' ? { awards: awards(room) } : {})
  };
}
export function playerView(room, pid, now = Date.now()) {
  const pl = room.players[pid];
  if (!pl) return null;
  const list = ranked(room), rank = list.findIndex(x => x.id === pid) + 1;
  const q = room.phase === 'play' && !pl.offer && !pl.pending ? currentQ(room, pl) : null;
  // 마지막 1분은 TV처럼 폰에서도 순위 · 1~3등을 가린다(끝나고 한꺼번에 공개).
  const hide = room.phase === 'play' && room.end_at - now < PARTY.HIDE_LAST_MS;
  return {
    kind: room.kind, phase: room.phase, label: room.label, end_at: room.end_at, start_at: room.start_at, now, steal: room.steal,
    hidden: hide,
    me: { id: pl.id, name: pl.name, gold: pl.gold, kg: pl.kg, right: pl.right, wrong: pl.wrong, streak: pl.streak, shield: pl.shield, lure: pl.lure, run: pl.run, rank: hide ? null : rank, of: list.length },
    q: q ? { n: pl.right + pl.wrong, prompt: q.prompt, options: q.options, wait_until: pl.wait_until > now ? pl.wait_until : 0 } : null,
    offer: pl.offer ? { n: pl.right } : null,
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
export function partyResultFor(room, pid) {
  const list = ranked(room), i = list.findIndex(x => x.id === pid), pl = room.players[pid];
  if (!pl) return null;
  return { rank: i + 1, of: list.length, right: pl.right, score: room.kind === 'fish' ? pl.kg : pl.gold, coins: partyCoins(pl.right, i + 1, list.length), xp: pl.right };
}
// 방이 끝나면 본 상태에 알리는 것(server/service.mjs settleParty).
export function partyReport(room) {
  const list = ranked(room);
  return {
    id: room.id, kind: room.kind, ended_at: room.ended_at,
    players: list.map((x, i) => ({ id: x.id, rank: i + 1, right: x.right, wrong: x.wrong, score: room.kind === 'fish' ? x.kg : x.gold, fish: room.kind === 'fish' ? x.fish.slice(-40) : undefined }))
  };
}
