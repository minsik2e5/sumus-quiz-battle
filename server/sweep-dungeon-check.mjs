// V13.168 던전 · 교실 게임 점검 검사.
//  1) 던전 결과 화면(/dungeon/last)은 방금 끝난 판을 돌려준다. 내 방을 만들었다 닫고(또는 로비에서 나가고) 먼저 열린
//     친구 방에서 끝까지 하면, 예전에는 만든 시각이 가장 늦은 닫힌 방을 돌려줘서 보상 · 신기록이 보이지 않았다.
//  2) 던전 입구 '최근 던전'에는 로비에서 나가 판에 없던 방을 넣지 않는다.
//  3) 교실 게임: 오늘 코인 3판을 다 받은 학생에게 결과 화면이 '+코인'을 보이지 않게, 참가할 때 남은 판 수를 알려 준다.
// 시각은 모두 고정한다(오늘 요일 · 시각과 상관없다).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { emptyState, migrateState } from './state.mjs';
import { passwordHash } from './auth.mjs';
import { service, settleDungeon } from './service.mjs';
import { dungeonLastView } from './dungeon-records.mjs';
import { settleParty, partyPlaysLeft } from './party.mjs';
import { PARTY } from './party-engine.mjs';
import { dayKey } from '../public/modules/core.js';

const source = path => readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8');
// 2026-10-20(화) 12:00 KST. 하루 경계: 2026-10-20 23:59:59 KST = 14:59:59 UTC.
const T = Date.UTC(2026, 9, 20, 3, 0, 0);
const MIDNIGHT_KST = Date.UTC(2026, 9, 20, 15, 0, 0);

export async function runSweepDungeonChecks(assert, expectStatus) {
  const state = emptyState();
  const hash = await passwordHash('QaSweepDg1!');
  const student = (id, name, cls, extra = {}) => ({ id, username: id, display_name: name, role: 'student', active: true, class_name: cls, school_id: 'gangseo-high', school: '강서고', division: 'high', password_hash: hash, pets: [{ key: 'dog', form: 1 }], avatar_key: 'dog', created_at: T, ...extra });
  state.profiles.push(student('qa-sw-a', '가람', '고1A'), student('qa-sw-b', '나비', '고1A'), student('qa-sw-c', '다솜', '고1A'));
  migrateState(state);
  const P = id => state.profiles.find(x => x.id === id);

  /* ---------- 1) 결과 화면은 방금 끝난 판 ---------- */
  const room = (id, at, members, extra = {}) => ({ id, code: String(200000 + at % 1000), status: 'open', school_id: 'gangseo-high', division: 'high', grade: '고1', cut: 'c3', host_id: members[0], members: [...members], left: [], invites: [], bots: 0, created_at: at, ...extra });
  // 친구 방 Y가 먼저 열리고, 내 방 X를 나중에 만들었다가 닫았다(방장이 나감). 나는 Y에서 끝까지 했다.
  state.dungeons = [room('qa-sw-y', T, ['qa-sw-b', 'qa-sw-a']), room('qa-sw-x', T + 60000, ['qa-sw-a'], { left: ['qa-sw-a'] })];
  assert(settleDungeon(state, { id: 'qa-sw-x', report_id: 'dungeon:qa-sw-x:closed', cancelled: true, reason: 'host-left' }, T + 70000), 'V13.168 검사 준비: 닫힌 내 방');
  const players = ['qa-sw-b', 'qa-sw-a'].map(id => ({ id, name: P(id).display_name, right: 60, answered: 70, reward: true, bot: false, out: false }));
  const result = { cleared: true, cut: 'c3', size: 2, floor: 6, reached: 6, time_ms: 420000, record: true, no_down: false, report_id: 'dungeon:qa-sw-y:1', players };
  assert(settleDungeon(state, { id: 'qa-sw-y', report_id: result.report_id, result }, T + 600000), 'V13.168 검사 준비: 친구 방에서 끝난 판');
  const last = dungeonLastView(state, P('qa-sw-a'));
  assert(last.id === 'qa-sw-y' && !last.cancelled && last.reward?.coins === 150 && last.board?.all_rank === 1, `V13.168 결과 화면: 내 방을 만들었다 닫고 친구 방에서 끝까지 하면 친구 방의 보상 · 기록을 받는다 (${last.id})`);
  assert(dungeonLastView(state, P('qa-sw-a'), 'qa-sw-y').id === 'qa-sw-y' && dungeonLastView(state, P('qa-sw-a'), 'qa-sw-x').cancelled, 'V13.168 결과 화면이 방 번호를 보내면 그 방을 돌려준다');
  assert(dungeonLastView(state, P('qa-sw-c'), 'qa-sw-y').none, 'V13.168 내가 없던 방 번호를 보내도 그 방 결과를 주지 않는다');
  // 나중에 들어갔다가 로비에서 나간 방(아직 열림)이 있어도 끝난 판을 기다리지 않고 보여 준다.
  state.dungeons.push(room('qa-sw-z', T + 700000, ['qa-sw-c', 'qa-sw-a'], { left: ['qa-sw-a'] }));
  assert(dungeonLastView(state, P('qa-sw-a')).id === 'qa-sw-y' && dungeonLastView(state, P('qa-sw-c')).pending, 'V13.168 로비에서 나간 방은 내 마지막 판이 아니다(그 방에 남은 친구에게는 그대로 기다리는 판)');
  state.dungeons = state.dungeons.filter(x => x.id !== 'qa-sw-z');
  const ui = source('../public/modules/dungeon.js');
  assert(ui.includes('/dungeon/last?id=${encodeURIComponent(id)}') && /dungeonLastView\(state, p, str\(body\.id, 64\)\)/.test(source('./service.mjs')), 'V13.168 결과 화면이 방금 판의 방 번호를 보내고 서버가 받는다');

  /* ---------- 2) 최근 던전 ---------- */
  // 학생 C가 친구 방 W의 로비에서 나간 뒤 그 방은 B · A끼리 끝났다.
  state.dungeons.push(room('qa-sw-w', T + 800000, ['qa-sw-b', 'qa-sw-a', 'qa-sw-c'], { left: ['qa-sw-c'] }));
  const wResult = { ...result, report_id: 'dungeon:qa-sw-w:1', players: players.map(x => ({ ...x })) };
  assert(settleDungeon(state, { id: 'qa-sw-w', report_id: wResult.report_id, result: wResult }, T + 1400000), 'V13.168 검사 준비: C가 로비에서 나간 방');
  const token = {};
  for (const id of ['qa-sw-a', 'qa-sw-c']) token[id] = (await service(state, 'POST', '/login', { username: id, password: 'QaSweepDg1!', division: 'high' }, null))._cookie;
  const homeC = await service(state, 'GET', '/dungeon/home', {}, token['qa-sw-c']);
  const homeA = await service(state, 'GET', '/dungeon/home', {}, token['qa-sw-a']);
  assert(!homeC.recent.some(r => r.id === 'qa-sw-w') && ['qa-sw-w', 'qa-sw-y'].every(id => homeA.recent.some(r => r.id === id)), 'V13.168 최근 던전: 로비에서 나가 하지 않은 판은 빼고, 끝까지 한 판은 남긴다');

  /* ---------- 3) 교실 게임 하루 3판 ---------- */
  const g = { day: dayKey(T), plays: PARTY.DAILY };
  assert(partyPlaysLeft({ games: { party: g } }, T) === 0 && partyPlaysLeft({ games: { party: g } }, MIDNIGHT_KST - 1) === 0 && partyPlaysLeft({ games: { party: g } }, MIDNIGHT_KST) === PARTY.DAILY && partyPlaysLeft({}, T) === PARTY.DAILY && partyPlaysLeft({ games: { party: { day: dayKey(T), plays: 1 } } }, T) === PARTY.DAILY - 1, 'V13.168 교실 게임 남은 코인 판: 한국 시간 자정에 다시 3판');
  // 정산과 같은 셈: 3판 받은 날 넷째 판은 0코인, 남은 판 0.
  const party = { id: 'qa-sw-pty', code: '4321', kind: 'treasure', school_id: 'gangseo-high', teacher_id: 'qa-t', class_name: '고1A', grade: '고1', minutes: 5, status: 'open', created_at: T, tickets: { 'qa-sw-a': 'x', 'qa-sw-b': 'y', 'qa-sw-c': 'z' }, tv_ticket: 'tv', range_codes: [] };
  P('qa-sw-a').games = { ...(P('qa-sw-a').games || {}), party: { day: dayKey(T), plays: PARTY.DAILY } };
  P('qa-sw-b').games = { ...(P('qa-sw-b').games || {}), party: { day: dayKey(T), plays: PARTY.DAILY - 1 } };
  state.parties = [party];
  assert(settleParty(state, { id: party.id, result: { players: [{ id: 'qa-sw-a', rank: 1, right: 30 }, { id: 'qa-sw-b', rank: 2, right: 30 }, { id: 'qa-sw-c', rank: 3, right: 0 }] } }, { now: T + 600000 }), 'V13.168 검사 준비: 교실 게임 정산');
  const paid = Object.fromEntries(party.paid.map(x => [x.id, x.coins]));
  assert(paid['qa-sw-a'] === 0 && paid['qa-sw-b'] > 0 && partyPlaysLeft(P('qa-sw-a'), T + 600000) === 0 && partyPlaysLeft(P('qa-sw-b'), T + 600000) === 0, 'V13.168 남은 판이 0이면 정산도 0코인(남은 판 셈이 정산과 같다)');
  // 참가 응답에 남은 판 수(지금 시각 기준)가 들어가고, 결과 화면은 0판이면 '+코인' 대신 안내를 보인다.
  const now = Date.now();
  state.parties = [{ ...party, id: 'qa-sw-pty2', code: '5432', status: 'open', settled: false, created_at: now, tickets: {} }];
  P('qa-sw-a').games.party = { day: dayKey(now), plays: PARTY.DAILY };
  const joined = await service(state, 'POST', '/party/join', { code: '5432' }, token['qa-sw-a']);
  assert(typeof joined.room.plays_left === 'number' && joined.room.plays_left === partyPlaysLeft(P('qa-sw-a')), `V13.168 교실 게임 참가 응답에 오늘 남은 코인 판 (${joined.room.plays_left})`);
  const pui = source('../public/modules/party.js');
  assert(/capped = P\.room\?\.plays_left === 0/.test(pui) && pui.includes('r.coins && capped ?') && pui.includes('r.team_win && !capped'), 'V13.168 교실 게임 결과 화면: 오늘 코인 판이 없으면 \'+코인\'을 보이지 않는다');
}
