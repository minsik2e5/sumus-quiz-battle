// V13.143 던전 기록 · 보상 (docs/dungeon-design.md 7 · 8번). 방이 보고한 결과(settleDungeon)를 받아
//  1) 학생마다 코인(dungeonReward: 처음 클리어 · 반복 · 위로 · 만점 5층 도달)을 주고 하루 3회를 센다.
//  2) 기록 보드(학년 × 등급컷 × 인원 2 · 3인, 주간 · 역대)에 넣는다. 봇이 끼거나 포기한 친구가 있는 판은 넣지 않는다
//     (엔진 result.record). 보상은 받는다.
//  3) 칭호 숫자(clears · no_down · records · max_floor)를 올리고, 이번 판으로 새로 얻은 던전 칭호를 알려 준다.
// 메인 상태는 한 덩어리로 저장되므로 보드는 상위 기록만 둔다(역대 10 · 이번 주 10 · 지난주 1위 1).
// 같은 report_id는 settleDungeon이 한 번만 부르므로 여기서 두 번 지급되지 않는다.
import { CUT_KEYS, CUTS, DUNGEON_COINS, dungeonReward } from './dungeon-engine.mjs';
import { rankingWeek } from './competition.mjs';
import { addBonus } from './rewards.mjs';
import { dayKey } from '../public/modules/core.js';
import { TITLES, titleUnlocked } from '../public/modules/titles.js';

export const BOARD_TOP = 10;
export const BOARD_SIZES = [2, 3];
export const boardKey = (grade, cut, size) => `${grade}|${cut}|${size}`;
// 만점 모드는 높이 올라간 층이 먼저, 같으면 빠른 시간. 나머지는 빠른 시간. 같으면 먼저 세운 기록.
export const boardOrder = cut => cut === 'max'
  ? (a, b) => b.f - a.f || a.t - b.t || a.at - b.at
  : (a, b) => a.t - b.t || a.at - b.at;
const weekKeys = now => { const week = rankingWeek(now); return { cur: week.key, last: rankingWeek(week.start - 1).key, end: week.end }; };
const teamOf = ids => [...ids].sort().join(',');

// 한 보드 목록에 한 팀의 기록을 넣는다. 같은 팀(같은 파티원)은 가장 좋은 기록 하나만 남긴다.
// 돌려주는 것: 이 기록의 순위(상위 BOARD_TOP 밖이거나 같은 팀의 더 좋은 기록이 있으면 null).
export function insertRow(rows, row, cut, top = BOARD_TOP) {
  const order = boardOrder(cut);
  const same = rows.findIndex(x => x.team === row.team);
  if (same >= 0) { if (order(rows[same], row) <= 0) return null; rows.splice(same, 1); }
  rows.push(row);
  rows.sort(order);
  rows.length = Math.min(rows.length, top);
  const at = rows.indexOf(row);
  return at >= 0 ? at + 1 : null;
}
// 주가 바뀌었으면 이번 주 목록을 비우고, 지난주 1위만 `prev`에 남긴다(주간 1위 칭호용).
function rollWeek(b, now) {
  const { cur, last } = weekKeys(now);
  if (b.week?.k === cur) return;
  if (b.week?.k === last) b.prev = { k: last, rows: b.week.rows.slice(0, 1) };
  else if (b.prev?.k !== last) b.prev = null;
  b.week = { k: cur, rows: [] };
}
const lastWeekRows = (b, last) => b?.week?.k === last ? b.week.rows : b?.prev?.k === last ? b.prev.rows : [];
// 지난주 각 보드 1위 파티원(한정 칭호 dungeon-week). 보드 수만큼만 본다.
export function dungeonKings(state, now = Date.now()) {
  const { last } = weekKeys(now), kings = new Set();
  for (const b of Object.values(state.dungeon_boards || {})) for (const m of lastWeekRows(b, last)[0]?.m || []) kings.add(m.id);
  return kings;
}

// 던전 칭호 숫자(public/modules/titles.js의 dungeon_*). 주간 1위는 보드에서 센다(competition.mjs).
export function dungeonTitleStats(p) {
  const g = p?.dungeon || {}, cleared = p?.dungeon_cleared || [];
  return {
    dungeon_clears: Number(g.clears || 0), dungeon_no_down: Number(g.no_down || 0), dungeon_records: Number(g.records || 0), dungeon_max_floor: Number(g.max_floor || 0),
    dungeon_c3: cleared.includes('c3') ? 1 : 0, dungeon_c2: cleared.includes('c2') ? 1 : 0, dungeon_c1: cleared.includes('c1') ? 1 : 0
  };
}
export const DUNGEON_TITLE_KEYS = Object.keys(TITLES).filter(key => TITLES[key].group === 'dungeon' && TITLES[key].tier !== 'limited');
const heldDungeonTitles = p => { const stats = dungeonTitleStats(p); return DUNGEON_TITLE_KEYS.filter(key => titleUnlocked(key, stats)); };

// 기록 보드에 이 판을 넣는다. 봇 · 포기한 친구가 없는 판만(엔진 result.record). 돌려주는 것: 순위 · 신기록 정보.
function recordRun(state, d, result, humans, now) {
  if (!result.record || !humans.length || humans.length !== result.size || !BOARD_SIZES.includes(result.size)) return null;
  if (result.cut !== 'max' && !result.cleared) return null;
  if (result.cut === 'max' && result.reached < 1) return null;
  const boards = state.dungeon_boards ||= {};
  const key = boardKey(d.grade, result.cut, result.size);
  const b = boards[key] ||= { all: [], week: null, prev: null };
  rollWeek(b, now);
  const before = b.all[0] || null;
  const row = { t: result.time_ms, f: result.reached, at: now, team: teamOf(humans.map(x => x.id)), m: humans.map(x => ({ id: x.id, n: x.name, ...(x.pet ? { pet: x.pet } : {}) })) };
  const allRank = insertRow(b.all, row, result.cut);
  const weekRank = insertRow(b.week.rows, { ...row }, result.cut);
  return { key, all_rank: allRank, week_rank: weekRank, all_top: allRank === 1, week_top: weekRank === 1, beat: allRank === 1 && before ? { t: before.t, f: before.f } : null };
}
// 내 파티 최고 기록(역대 · 이번 주). 보드 밖 기록도 학생마다 남긴다(보드마다 하나라 작다).
function personalBest(g, key, result, now) {
  const { cur } = weekKeys(now), order = boardOrder(result.cut), mine = { t: result.time_ms, f: result.reached, at: now };
  g.best ||= {}; g.wbest ||= {};
  const all = !g.best[key] || order(mine, g.best[key]) < 0;
  const week = g.wbest[key]?.k !== cur || order(mine, g.wbest[key]) < 0;
  if (all) g.best[key] = mine;
  if (week) g.wbest[key] = { k: cur, ...mine };
  return { all, week };
}

// settleDungeon이 결과를 정리한 뒤 부른다. 깬 등급컷 열기 · 코인 · 기록 · 칭호 숫자. 돌려주는 것: 보드 정보와 학생별 보상.
export function settleDungeonRecords(state, d, now = Date.now()) {
  const r = d.result, today = dayKey(now);
  const humans = r.players.filter(x => x.reward);
  const board = recordRun(state, d, r, humans, now);
  const rewards = {};
  for (const x of humans) {
    const profile = state.profiles.find(y => y.id === x.id);
    if (!profile) continue;
    const g = profile.dungeon ||= {};
    const before = heldDungeonTitles(profile);
    const first = r.cleared && r.cut !== 'max' && !(profile.dungeon_cleared || []).includes(r.cut);
    const plays = g.day === today ? Number(g.plays || 0) : 0;
    const reward = dungeonReward({ cut: r.cut, cleared: r.cleared, first, right: x.right, reached: r.reached, today: plays, best: Number(g.max_floor || 0) });
    if (reward.daily) { g.day = today; g.plays = plays + 1; }
    // 깬 등급컷은 다음 단계를 여는 데 쓴다(만점은 기록만).
    if (first) profile.dungeon_cleared = [...(profile.dungeon_cleared || []), r.cut];
    if (r.cleared) { g.clears = Number(g.clears || 0) + 1; if (r.no_down) g.no_down = Number(g.no_down || 0) + 1; }
    if (r.cut === 'max') g.max_floor = Math.max(Number(g.max_floor || 0), r.reached);
    if (board?.all_top) g.records = Number(g.records || 0) + 1;
    const best = board ? personalBest(g, board.key, r, now) : null;
    if (reward.coins > 0) { addBonus(profile, { coins: reward.coins, now }); g.coins = Number(g.coins || 0) + reward.coins; }
    const titles = heldDungeonTitles(profile).filter(key => !before.includes(key));
    rewards[x.id] = { coins: reward.coins, items: reward.items, note: reward.note, first, plays_left: Math.max(0, DUNGEON_COINS.daily - (g.day === today ? Number(g.plays || 0) : 0)), titles, ...(best ? { best } : {}) };
  }
  return { board, rewards };
}

/* ---------- 화면에 보내는 모양 ---------- */
// 보드 한 줄: 순위, 시간 · 층, 파티원(지금 닉네임, 그 판의 펫), 내 파티인지.
function rowView(row, i, names, pid) {
  return { rank: i + 1, time_ms: row.t, floor: row.f, at: row.at, me: row.m.some(m => m.id === pid), members: row.m.map(m => ({ name: names.get(m.id) || m.n, pet: m.pet || null, me: m.id === pid })) };
}
// 내 학년 보드 전부(등급컷 4 × 인원 2): 이번 주 · 역대 상위 10팀, 지난주 1위, 내 파티 최고 기록.
// 학년별 전체 공개(학교가 달라도 같은 학년이면 한 보드), 닉네임과 펫만 보여 준다.
export function dungeonBoardsView(state, p, grade, now = Date.now()) {
  const { cur, last, end } = weekKeys(now), boards = state.dungeon_boards || {}, g = p.dungeon || {};
  const ids = new Set();
  for (const cut of CUT_KEYS) for (const size of BOARD_SIZES) { const b = boards[boardKey(grade, cut, size)]; for (const row of [...(b?.all || []), ...(b?.week?.rows || []), ...(b?.prev?.rows || [])]) row.m.forEach(m => ids.add(m.id)); }
  const names = new Map(state.profiles.filter(x => ids.has(x.id)).map(x => [x.id, x.display_name]));
  const list = [];
  for (const cut of CUT_KEYS) for (const size of BOARD_SIZES) {
    const key = boardKey(grade, cut, size), b = boards[key];
    const week = b?.week?.k === cur ? b.week.rows : [];
    const lastTop = lastWeekRows(b, last)[0];
    const best = g.best?.[key], wbest = g.wbest?.[key]?.k === cur ? g.wbest[key] : null;
    list.push({
      cut, cut_name: CUTS[cut].name, size, endless: cut === 'max',
      week: week.map((row, i) => rowView(row, i, names, p.id)),
      all: (b?.all || []).map((row, i) => rowView(row, i, names, p.id)),
      last_top: lastTop ? rowView(lastTop, 0, names, p.id) : null,
      mine: { all: best ? { time_ms: best.t, floor: best.f, at: best.at } : null, week: wbest ? { time_ms: wbest.t, floor: wbest.f, at: wbest.at } : null }
    });
  }
  return { grade, top: BOARD_TOP, week_end: end, boards: list };
}
// 내가 들어간 가장 최근 던전의 결과(결과 화면이 방의 보고를 기다렸다가 받아 간다).
// V13.168 화면이 방금 판의 방 번호(id)를 보내면 그 방을, 없으면 내가 끝까지 남아 있던 방(로비에서 나간 방 제외) 중 가장 최근 것을 본다.
// 예전에는 만든 시각만 봐서, 내 방을 만들었다가 닫고 먼저 열린 친구 방에서 끝까지 하면 닫힌 내 방을 돌려줬다(보상 · 신기록이 안 보였다).
export function dungeonLastView(state, p, wantId = '') {
  const mine = (state.dungeons || []).filter(x => (x.members || []).includes(p.id)).sort((a, b) => b.created_at - a.created_at);
  const d = (wantId && mine.find(x => x.id === wantId)) || mine.find(x => !(x.left || []).includes(p.id)) || mine[0];
  if (!d) return { none: true };
  if (d.status === 'open') return { id: d.id, pending: true };
  if (d.status !== 'finished' || !d.result) return { id: d.id, cancelled: true };
  const r = d.result;
  return { id: d.id, cut: r.cut, cut_name: CUTS[r.cut]?.name || '', cleared: r.cleared, reached: r.reached, time_ms: r.time_ms, size: r.size, record: r.record, board: r.board || null, reward: r.rewards?.[p.id] || null, daily: DUNGEON_COINS.daily, min_right: DUNGEON_COINS.min_right, finished_at: d.finished_at };
}
