import { dayKey } from '../public/modules/core.js';
import { PARTY } from '../public/modules/party-engine.js';
import { SOLO, SOLO_BOTS, soloRng, soloReplay } from '../public/modules/treasure-solo-rules.js';
import { addBonus, findReceipt, keepReceipt } from './rewards.mjs';

// V13.150 혼자 보물 사냥(반 친구 금고)의 서버 쪽. 판은 폰이 돌리고, 끝나면 서버가 기록으로 다시 돌려 확인한다(treasure-solo-rules.js).
//   p.games.vault { week, best, shield, at, robbed[{by, name, kind, amount, pct, at}], live{id, at, start} }
//   금고 = 이번 주 내 최고 판의 금화 · 방패. 친구가 털어도 금고는 줄지 않는다(알림 · 되갚기만).
// 쓰기: 시작 1번 + 끝 1번(+ 턴 친구 알림 줄). 판 도중에는 서버에 아무것도 보내지 않는다. 코인 판은 교실 게임과 함께 하루 3판.

const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };
const SLACK_MS = 5000;
const vaultOf = (x, weekKey) => x.games?.vault?.week === weekKey && x.games.vault.best > 0 ? x.games.vault : null;
// 주가 바뀌면 금고를 새로(같은 객체를 고친다: 영수증 done · 진행 중인 판 live는 그대로 둔다).
const freshVault = (g, weekKey) => { const v = g.vault ||= {}; if (v.week !== weekKey) Object.assign(v, { week: weekKey, best: 0, shield: 0, robbed: [] }); return v; };

// 보기(읽기만): 이번 주 내 금고 · 털린 알림 · 오늘 남은 코인 판.
export function treasureView(p, now = Date.now(), weekKey = '') {
  const v = p.games?.vault?.week === weekKey ? p.games.vault : {}, day = p.games?.party || {};
  const plays = day.day === dayKey(now) ? Number(day.plays || 0) : 0;
  return { best: v.best || 0, shield: v.shield || 0, robbed: (v.robbed || []).slice(-SOLO.ROBBED_KEEP), left: Math.max(0, PARTY.DAILY - plays), daily: PARTY.DAILY };
}
// 시작: 문제 · 시드 · 털 수 있는 금고(이번 주 반 친구 금화 많은 순 6개 + 나를 턴 친구, 3개보다 적으면 해적 봇).
export function treasureStart(state, p, { id, me, questions, seed, now = Date.now(), weekKey = '', hidden = () => false, petOf = () => null }) {
  const g = p.games ||= {}, mine = freshVault(g, weekKey);
  const robbers = [...new Set((mine.robbed || []).filter(r => r.kind !== 'block').map(r => r.by))];
  const mates = state.profiles.filter(x => x.id !== p.id && x.role === 'student' && x.active !== false && x.school_id === p.school_id && x.class_name === p.class_name && vaultOf(x, weekKey))
    .map(x => ({ x, v: vaultOf(x, weekKey) })).sort((a, b) => b.v.best - a.v.best);
  const chosen = mates.slice(0, SOLO.VAULTS);
  for (const r of robbers) { const m = mates.find(y => y.x.id === r); if (m && !chosen.includes(m)) chosen.push(m); }
  const vaults = chosen.map(({ x, v }) => { const veil = hidden(x); return { id: x.id, name: veil ? '비공개 학생' : x.display_name, pet: veil ? { key: 'lumi', form: 1 } : petOf(x), gold: v.best, shield: Math.min(2, v.shield || 0) }; });
  const rnd = soloRng((Number(seed) ^ 0x9e3779b9) >>> 0);
  for (const [bid, name, pet] of SOLO_BOTS) { if (vaults.length >= SOLO.MIN_VAULTS) break; vaults.push({ id: bid, name, pet: { key: pet, form: 2 }, gold: 60 + Math.round(rnd() * 30) * 5, shield: rnd() < .3 ? 1 : 0, bot: true }); }
  const start = { id, seed: Number(seed) >>> 0, qs: questions.slice(0, SOLO.QUESTIONS), me, vaults, revenge: robbers.filter(r => vaults.some(v => v.id === r)), duration_ms: SOLO.MS };
  mine.live = { id, at: now, start };
  return { start, ...treasureView(p, now, weekKey) };
}
// 끝: 기록으로 다시 돌려 금화 · 맞힌 수 · 턴 친구를 계산한다. 같은 끝내기는 영수증으로 한 번만.
export function treasureFinish(state, p, { id, log, now = Date.now(), weekKey = '', pet = null }) {
  const g = p.games ||= {}, mine = g.vault ||= {};
  const seen = findReceipt(mine, 'vault', id);
  if (seen) return { ...seen.r, again: true, ...treasureView(p, now, weekKey) };
  const live = mine.live;
  if (!id || !live || live.id !== id) fail('보물 사냥 판을 찾지 못했어요.', 404);
  delete mine.live;
  return { ...keepReceipt(mine, 'vault', id, settle(state, p, live, log, { now, weekKey, pet }), now), ...treasureView(p, now, weekKey) };
}
function settle(state, p, live, log, { now, weekKey, pet }) {
  if (now - live.at + SLACK_MS < SOLO.MS) return { paid: false, reason: 'short' };
  const r = soloReplay(live.start, log);
  if (r.bad) return { paid: false, reason: 'bad' };
  const g = p.games, mine = freshVault(g, weekKey);
  const record = r.gold > (mine.best || 0);
  if (record) { mine.best = r.gold; mine.shield = r.shield; mine.at = now; }
  // 턴 친구에게 알림(금고는 줄지 않는다). 해적 봇은 알림 없음. 내가 되갚은 친구는 내 알림에서 지운다.
  const hits = [];
  for (const h of r.hits) {
    const v = live.start.vaults.find(x => x.id === h.vid);
    if (!v) continue;
    hits.push({ name: v.name, kind: h.kind, amount: h.amount, pct: h.pct, bounty: h.bounty, bot: !!v.bot });
    if (v.bot) continue;
    const vp = state.profiles.find(x => x.id === h.vid && x.role === 'student');
    const vv = vp?.games?.vault;
    if (!vv || vv.week !== weekKey) continue;
    vv.robbed = [...(vv.robbed || []), { by: p.id, name: p.display_name || '학생', kind: h.kind, amount: h.amount, pct: h.pct, at: now }].slice(-SOLO.ROBBED_KEEP);
  }
  const paidBack = new Set(r.hits.filter(h => h.kind !== 'block').map(h => h.vid));
  mine.robbed = (mine.robbed || []).filter(x => !paidBack.has(x.by));
  // 코인: 맞힌 수 절반(최대 15) + 금고 최고 기록이면 +3. 5문제 이상, 교실 게임과 함께 하루 3판.
  const day = g.party ||= {}, today = dayKey(now);
  if (day.day !== today) { day.day = today; day.plays = 0; }
  const base = { gold: r.gold, right: r.right, wrong: r.wrong, record, best: mine.best, hits };
  const xp = Math.min(60, r.right);
  if (r.right < PARTY.MIN_RIGHT) { addBonus(p, { xp, coins: 0, pet, now }); return { ...base, paid: false, coins: 0, xp, reason: 'few' }; }
  if (Number(day.plays || 0) >= PARTY.DAILY) { addBonus(p, { xp, coins: 0, pet, now }); return { ...base, paid: false, coins: 0, xp, reason: 'daily' }; }
  day.plays = Number(day.plays || 0) + 1;
  const coins = Math.min(15, Math.floor(r.right / 2)) + (record ? SOLO.RECORD_COINS : 0);
  addBonus(p, { xp, coins, pet, now });
  return { ...base, paid: true, coins, xp };
}
// 이번 주 반 금고 순위(읽기만).
export function treasureBoard(profiles, p, weekKey, { hidden = () => false, petOf = () => null } = {}) {
  const rows = profiles.filter(x => x.role === 'student' && x.active !== false && x.school_id === p.school_id && x.class_name === p.class_name && vaultOf(x, weekKey))
    .map(x => { const veil = x.id !== p.id && hidden(x); return { id: x.id, me: x.id === p.id, name: veil ? '비공개 학생' : x.display_name, pet: veil ? 'lumi' : (x.avatar_key || 'lumi'), gold: x.games.vault.best }; })
    .sort((a, b) => b.gold - a.gold);
  rows.forEach((r, i) => { r.rank = i + 1; });
  const top = rows.slice(0, 10), mine = rows.find(r => r.me);
  return { rows: mine && !top.includes(mine) ? [...top, mine] : top, total: rows.length };
}
