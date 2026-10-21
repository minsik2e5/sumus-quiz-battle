import { randomBytes } from 'node:crypto';
import { dayKey } from '../public/modules/core.js';
import { FISH } from '../public/modules/fishing-rules.js';
import { PARTY, partyCoins } from './party-engine.mjs';
import { addBonus } from './rewards.mjs';

// V13.149 교실 게임(보물 사냥 · 반 전체 낚시)의 메인 상태 쪽: 방 목록(state.parties), 참가, 끝난 판 정산.
// 판 자체는 방(cloudflare/party-room.mjs)이 돌린다. 방 준비 메시지(_party: 문제 · 입장표)는 브라우저로 가지 않는다.
//   state.parties [{ id, code, kind, school_id, teacher_id, class_name, grade, minutes, steal, status, created_at, tickets{pid}, tv_ticket, settled, summary }]

export const PARTY_OPEN_MS = 3 * 3600000;
export const PARTY_KEEP = 30;
export const partyTicket = () => randomBytes(18).toString('hex');

export const openParties = (state, now = Date.now()) => (state.parties || []).filter(x => x.status === 'open' && now - x.created_at < PARTY_OPEN_MS);
export function newPartyCode(state, now = Date.now(), random = Math.random) {
  const used = new Set(openParties(state, now).map(x => x.code));
  for (let i = 0; i < 50; i++) { const code = String(1000 + Math.floor(random() * 9000)); if (!used.has(code)) return code; }
  throw Object.assign(Error('방 번호를 만들지 못했어요. 잠시 후 다시 해 주세요.'), { status: 503 });
}
// 오래된 판은 지운다(열린 판 + 최근 PARTY_KEEP개만).
export function tidyParties(state, now = Date.now()) {
  const list = state.parties;
  if (!Array.isArray(list) || !list.length) return false;
  let changed = false;
  for (const x of list) if (x.status === 'open' && now - x.created_at >= PARTY_OPEN_MS) { x.status = 'expired'; changed = true; }
  const done = list.filter(x => x.status !== 'open');
  if (done.length > PARTY_KEEP) {
    const keep = new Set(done.sort((a, b) => b.created_at - a.created_at).slice(0, PARTY_KEEP));
    state.parties = list.filter(x => x.status === 'open' || keep.has(x));
    changed = true;
  }
  return changed;
}
// V13.168 오늘 코인을 받을 수 있는 교실 게임 판 수(settleParty와 같은 셈). 방의 결과 화면은 하루 3판을 모르므로
// 참가할 때 알려 준다(3판을 다 받은 학생에게 '+코인'이 보였는데 실제로는 0코인이었다).
export const partyPlaysLeft = (p, now = Date.now()) => { const day = p?.games?.party; return Math.max(0, PARTY.DAILY - (day?.day === dayKey(now) ? Number(day.plays || 0) : 0)); };
// 학생 한 명의 화면 표시용 펫.
export const partyPlayer = (p, pet) => ({ id: p.id, name: p.display_name || '학생', pet: pet ? { key: pet.key, form: Math.max(1, pet.form ?? 1) } : null });

// 방이 보낸 결과: 학생마다 진짜 코인(맞힌 수 위주) · 경험치, 반 낚시는 잡은 물고기를 어항 도감에. 같은 판은 한 번만.
export function settleParty(state, body, { petKey = () => undefined, now = Date.now() } = {}) {
  const party = (state.parties || []).find(x => x.id === body?.id);
  if (!party || party.settled) return false;
  const players = Array.isArray(body.result?.players) ? body.result.players.slice(0, PARTY.MAX_PLAYERS) : [];
  party.settled = true; party.status = 'ended'; party.ended_at = now;
  const n = players.filter(row => party.tickets?.[row?.id]).length, paid = []; // 순위 보너스는 실제로 들어온 학생 수로
  for (const row of players) {
    const p = state.profiles.find(x => x.id === row.id && x.role === 'student');
    if (!p || !party.tickets?.[p.id]) continue;
    const right = Math.max(0, Math.min(300, Math.floor(Number(row.right) || 0))), rank = Math.max(1, Math.floor(Number(row.rank) || n));
    const g = p.games ||= {}, day = g.party ||= {};
    const today = dayKey(now);
    if (day.day !== today) { day.day = today; day.plays = 0; }
    let coins = 0;
    if (day.plays < PARTY.DAILY) { coins = partyCoins(right, rank, n) + (row.team_win && right >= PARTY.MIN_RIGHT ? PARTY.TEAM_WIN_COINS : 0); if (coins) day.plays++; }
    day.total = Number(day.total || 0) + 1;
    if (rank === 1 && n >= 3) day.wins = Number(day.wins || 0) + 1;
    const xp = Math.min(60, right);
    addBonus(p, { xp, coins, pet: petKey(p.id), now });
    // 반 낚시에서 잡은 물고기도 어항 도감에 남는다.
    if (party.kind === 'fish' && Array.isArray(row.fish)) {
      const f = g.fish ||= {}, book = f.book ||= {};
      for (const c of row.fish.slice(0, 60)) {
        if (!FISH[c?.key]) continue;
        const b = book[c.key] ||= { n: 0, kg: 0 };
        b.n += 1; b.kg = Math.max(Number(b.kg || 0), Math.min(FISH[c.key].kg[1], Number(c.kg) || 0));
      }
    }
    paid.push({ id: p.id, rank, right, coins, xp });
  }
  party.summary = { players: n, top: paid.filter(x => x.rank <= 3).sort((a, b) => a.rank - b.rank).map(x => ({ id: x.id, rank: x.rank, name: state.profiles.find(y => y.id === x.id)?.display_name || '' })) };
  party.paid = paid;
  return true;
}
export const partyReportPending = (state, body) => !!(state.parties || []).find(x => x.id === body?.id && !x.settled);
// 방이 받지 못했으면(가득 참 · 끝남) 참가표를 되돌린다.
// V13.163 이번 요청이 새로 만든 참가표만(fresh). 이미 놀던 학생이 끝난 방에 다시 들어오면 방은 거절하지만,
// 그 표를 지우면 아직 정산 전인 판에서 그 학생 보상이 빠지고 참가 수(n)도 줄었다.
export function undoParty(state, message) {
  const party = (state.parties || []).find(x => x.id === message?.id);
  if (!party) return false;
  if (message.action === 'init') { party.status = 'failed'; return true; }
  if (message.action === 'join' && message.fresh && party.tickets?.[message.player?.id]) { delete party.tickets[message.player.id]; return true; }
  return false;
}
