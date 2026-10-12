// V13.140 던전 기록 · 보상 검사(docs/dungeon-design.md 7 · 8번): 코인(처음 클리어 · 반복 하루 3회 · 실패 위로 · 만점 5층),
// 같은 보고 한 번만, 봇이 낀 판은 보상만 받고 기록 제외, 보드 정렬 · 상위 10 · 같은 팀 하나, 주간 1위, 칭호 지급, 화면 연결.
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { emptyState, migrateState } from './state.mjs';
import { passwordHash } from './auth.mjs';
import { service, settleDungeon } from './service.mjs';
import { DUNGEON_COINS, dungeonReward, milestoneCoins } from './dungeon-engine.mjs';
import { insertRow, boardKey, dungeonKings, dungeonBoardsView, dungeonLastView, BOARD_TOP, DUNGEON_TITLE_KEYS } from './dungeon-records.mjs';
import { createCompetition, rankingWeek } from './competition.mjs';
import { TITLES, TITLE_GROUPS, titleUnlocked, titleCoins } from '../public/modules/titles.js';
import { TITLE_ART } from '../public/modules/emblems.js';
import { bonusRecords } from './rewards.mjs';

const source = path => readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8');
const DAY = 86400000;

export async function runDungeonRewardChecks(assert, expectStatus) {
  /* ---------- 코인 계산(서버가 정답 수 · 층 · 등급컷으로) ---------- */
  const C = DUNGEON_COINS;
  assert(C.first.c3 === 150 && C.first.c2 === 300 && C.first.c1 === 500 && C.again_max.c3 === 40 && C.again_max.c2 === 50 && C.again_max.c1 === 60 && C.daily === 3 && C.per_right.c3 === 0.5 && C.per_right.c1 === 0.7, 'V13.140 확정 코인(처음 150 · 300 · 500, 반복 정답당 0.5~0.7 · 최대 40~60, 하루 3회)은 그대로');
  assert(dungeonReward({ cut: 'c3', cleared: true, first: true, right: 3 }).coins === 150 && !dungeonReward({ cut: 'c3', cleared: true, first: true, right: 3 }).daily, 'V13.140 처음 클리어는 150코인, 하루 횟수를 쓰지 않는다(정답 수와 상관없이)');
  assert(dungeonReward({ cut: 'c3', cleared: true, right: 100 }).coins === 40 && dungeonReward({ cut: 'c2', cleared: true, right: 60 }).coins === 36 && dungeonReward({ cut: 'c1', cleared: true, right: 200 }).coins === 60, 'V13.140 반복 클리어: 정답 × 단가, 한 판 최대 40 · 50 · 60');
  assert(dungeonReward({ cut: 'c3', cleared: true, right: 100, today: 3 }).coins === 0 && dungeonReward({ cut: 'c3', cleared: true, right: 100, today: 3 }).note === 'daily', 'V13.140 하루 3판이 지나면 반복 코인은 없다');
  assert(dungeonReward({ cut: 'c3', cleared: false, right: 40, reached: 3 }).coins === 12 && dungeonReward({ cut: 'c2', cleared: false, right: 20, reached: 5 }).coins === 12 && dungeonReward({ cut: 'c1', cleared: false, right: 200, reached: 5 }).coins === 30, 'V13.140 실패 위로: 도달 층 × 4 · 5 · 6, 정답 × 단가 중 작은 쪽');
  assert(dungeonReward({ cut: 'c3', cleared: false, right: 9, reached: 4 }).coins === 0 && dungeonReward({ cut: 'c3', cleared: false, right: 9, reached: 4 }).note === 'few' && dungeonReward({ cut: 'c1', cleared: true, right: 200, reward: false }).coins === 0, 'V13.140 정답 10개 미만이거나 포기 · 봇이면 코인 없음');
  const climb = dungeonReward({ cut: 'max', cleared: false, right: 150, reached: 12, best: 0 });
  assert(climb.coins === 60 + 100 + 150 && climb.items.map(x => x.key).join() === 'climb,floor5,floor10' && dungeonReward({ cut: 'max', cleared: false, right: 150, reached: 12, best: 10 }).items.map(x => x.key).join() === 'climb', 'V13.140 만점 모드: 한 판(최대 60) + 5층마다 처음 도달 보상(100 · 150 …), 이미 넘은 층은 다시 주지 않는다');
  assert(milestoneCoins(5) === 300 && milestoneCoins(6) === 100 && [1, 2, 3, 4, 5].reduce((n, k) => n + milestoneCoins(k), 0) === 1000, 'V13.140 만점 5층 단위 보상: 25층까지 1,000코인, 그 뒤로 100씩');
  assert(dungeonReward({ cut: 'max', cleared: false, right: 150, reached: 12, today: 3 }).items.map(x => x.key).join() === 'floor5,floor10', 'V13.140 하루 3판이 끝나도 만점 층 도달 보상은 받는다');

  /* ---------- 보드: 정렬 · 상위 10 · 같은 팀은 하나 ---------- */
  const rows = [];
  for (let i = 0; i < 12; i++) insertRow(rows, { t: 400000 + ((i * 7) % 12) * 1000, f: 6, at: i, team: 't' + i, m: [] }, 'c3');
  assert(rows.length === BOARD_TOP && rows.every((r, i) => !i || rows[i - 1].t <= r.t) && rows[0].t === 400000 && !rows.some(r => r.t >= 410000), 'V13.140 보드: 빠른 시간 순서로 상위 10팀만 남긴다');
  assert(insertRow(rows, { t: 500000, f: 6, at: 99, team: 't0', m: [] }, 'c3') === null && rows.filter(r => r.team === 't0').length === 1, 'V13.140 같은 팀의 더 느린 기록은 보드에 넣지 않는다');
  assert(insertRow(rows, { t: 300000, f: 6, at: 100, team: 't5', m: [] }, 'c3') === 1 && rows.filter(r => r.team === 't5').length === 1 && rows[0].team === 't5', 'V13.140 같은 팀이 더 빠르면 그 팀 기록을 바꾸고 순위를 돌려준다');
  const maxRows = [];
  insertRow(maxRows, { t: 900000, f: 9, at: 1, team: 'a', m: [] }, 'max'); insertRow(maxRows, { t: 500000, f: 7, at: 2, team: 'b', m: [] }, 'max'); insertRow(maxRows, { t: 800000, f: 9, at: 3, team: 'c', m: [] }, 'max');
  assert(maxRows.map(r => r.team).join() === 'c,a,b', 'V13.140 만점 보드: 높은 층 먼저, 같으면 빠른 시간');

  /* ---------- 결과 처리: 학생 3명 ---------- */
  const state = emptyState();
  const hash = await passwordHash('QaReward1!');
  const student = (id, name, cls, school = 'gangseo-high') => ({ id, username: id, display_name: name, role: 'student', active: true, class_name: cls, school_id: school, school: school === 'gangseo-high' ? '강서고' : '단원고', division: 'high', password_hash: hash, pets: [{ key: 'dog', form: 1 }], avatar_key: 'dog', created_at: Date.now() });
  state.profiles.push(student('qa-rw-a', '가람', '고1A'), student('qa-rw-b', '나비', '고1B'), student('qa-rw-c', '다솜', '고1A', 'danwon-high'), student('qa-rw-z', '자두', '고2A'));
  migrateState(state);
  const P = id => state.profiles.find(x => x.id === id);
  const coinsOf = id => bonusRecords(P(id)).reduce((n, r) => n + r.reward_points, 0);
  let seq = 0;
  const play = ({ ids = ['qa-rw-a', 'qa-rw-b', 'qa-rw-c'], cut = 'c3', cleared = true, reached = cleared ? 6 : 3, time = 480000, right = 80, bots = 0, noDown = false, now = Date.now() }) => {
    const id = 'qa-rw-room-' + (++seq), grade = '고1';
    const d = { id, code: String(100000 + seq), status: 'open', school_id: 'gangseo-high', division: 'high', grade, cut, host_id: ids[0], members: [...ids], left: [], invites: [], bots, created_at: now - 600000 };
    state.dungeons = [...(state.dungeons || []), d];
    const players = [...ids.map((pid, i) => ({ id: pid, name: P(pid).display_name, right, answered: right + 10, accuracy: .9, share: .3, downs: 0, reward: true, bot: false, out: false, pet: { key: 'dog', form: i } })),
      ...Array.from({ length: bots }, (_, i) => ({ id: `bot-${i + 1}`, name: '봇', right, answered: right, reward: false, bot: true }))];
    const result = { cleared, cut, size: players.length, floor: reached, reached, time_ms: time, record: (cleared || cut === 'max') && !bots, no_down: noDown, report_id: `dungeon:${id}:1`, players };
    return { d, report: { id, report_id: result.report_id, result }, ok: settleDungeon(state, { id, report_id: result.report_id, result }, now) };
  };
  const now = Date.now();
  const first = play({ now, noDown: true });
  const ra = first.d.result.rewards['qa-rw-a'];
  assert(first.ok && ra.coins === 150 && ra.first && coinsOf('qa-rw-a') === 150 && P('qa-rw-a').dungeon_cleared.join() === 'c3' && P('qa-rw-c').dungeon_cleared.join() === 'c3', 'V13.140 처음 클리어: 파티원마다 150코인, 다음 등급컷이 열린다');
  assert(['dungeon-first', 'dungeon-rank3', 'dungeon-flawless', 'dungeon-record'].every(k => ra.titles.includes(k)) && !ra.titles.includes('dungeon-hunter'), `V13.140 이번 판으로 얻은 던전 칭호를 알려 준다 (${ra.titles.join(', ')})`);
  assert(first.d.result.board?.all_rank === 1 && first.d.result.board.all_top && first.d.result.board.week_top && ra.best?.all, 'V13.140 첫 기록은 이번 주 · 역대 1위, 내 파티 최고 기록');
  assert(!settleDungeon(state, first.report, now) && coinsOf('qa-rw-a') === 150 && P('qa-rw-a').dungeon.clears === 1, 'V13.140 같은 report_id는 다시 와도 코인 · 기록을 한 번만 처리한다');
  const stats = createCompetition(state, now).titleStats(P('qa-rw-b'));
  assert(['dungeon-first', 'dungeon-rank3', 'dungeon-flawless', 'dungeon-record'].every(k => titleUnlocked(k, stats)) && !titleUnlocked('dungeon-rank2', stats), 'V13.140 칭호 화면(titleStats)에서도 던전 칭호가 열린다');

  // 반복 클리어: 하루 3판까지 소액.
  const again = [1, 2, 3, 4].map(i => play({ now: now + i * 1000, time: 470000 - i * 1000, right: 100 }).d.result.rewards['qa-rw-a']);
  assert(again.slice(0, 3).every(r => r.coins === 40 && !r.first) && again[3].coins === 0 && again[3].note === 'daily' && again[3].plays_left === 0 && coinsOf('qa-rw-a') === 150 + 120, 'V13.140 반복 클리어는 하루 3판까지 40코인, 넷째 판은 0');
  const nextDay = now + DAY;
  const fail = play({ now: nextDay, cleared: false, reached: 4, right: 50 }).d;
  assert(fail.result.rewards['qa-rw-a'].coins === 16 && fail.result.board === null && coinsOf('qa-rw-a') === 270 + 16, 'V13.140 다음 날: 실패해도 도달 층 × 4 위로 코인, 실패 판은 보드에 없다');

  // 봇이 낀 판: 보상은 받고 기록은 빠진다.
  const boardBefore = JSON.stringify(state.dungeon_boards);
  const withBot = play({ ids: ['qa-rw-a', 'qa-rw-b'], bots: 1, now: nextDay + 1000, time: 200000, right: 90 }).d;
  assert(withBot.result.rewards['qa-rw-a'].coins === 40 && withBot.result.board === null && JSON.stringify(state.dungeon_boards) === boardBefore && !withBot.result.rewards['bot-1'], 'V13.140 봇이 낀 판은 보상은 받고(봇은 없음) 기록 보드에는 오르지 않는다');

  // 2인 · 다른 팀 · 보드 정렬.
  play({ ids: ['qa-rw-a', 'qa-rw-b'], now: nextDay + 2000, time: 450000 });
  play({ ids: ['qa-rw-b', 'qa-rw-c'], now: nextDay + 3000, time: 430000 });
  const b2 = state.dungeon_boards[boardKey('고1', 'c3', 2)];
  assert(b2.all.map(r => r.t).join() === '430000,450000' && b2.all[0].m.map(m => m.id).join() === 'qa-rw-b,qa-rw-c' && b2.all[0].m[0].pet?.key === 'dog', 'V13.140 2인 보드는 따로, 빠른 순서, 닉네임과 펫을 남긴다');
  const b3 = state.dungeon_boards[boardKey('고1', 'c3', 3)];
  assert(b3.all.length === 1 && b3.all[0].t === 466000 && JSON.stringify(state).length < 2000000, 'V13.140 같은 3인 팀은 가장 빠른 기록 하나만 보드에 남는다');

  // 화면용: 보드(내 학년만) · 마지막 판.
  const view = dungeonBoardsView(state, P('qa-rw-c'), '고1', nextDay + 4000);
  const v2 = view.boards.find(x => x.cut === 'c3' && x.size === 2);
  assert(view.boards.length === 8 && v2.all[0].me && v2.all[0].members[0].name === '나비' && v2.mine.all?.time_ms === 430000 && view.boards.find(x => x.cut === 'c3' && x.size === 3).mine.all?.time_ms === 466000, 'V13.140 보드 화면: 등급컷 4 × 인원 2, 내 파티 표시, 내 파티 최고 기록');
  assert(dungeonBoardsView(state, P('qa-rw-z'), '고2', nextDay).boards.every(x => !x.all.length), 'V13.140 다른 학년 보드는 따로(고2에는 고1 기록이 없다)');
  const last = dungeonLastView(state, P('qa-rw-c'));
  assert(last.reward && last.cut === 'c3' && last.board?.all_rank === 1 && last.size === 2, 'V13.140 결과 화면은 내가 들어간 마지막 판의 보상과 기록을 받는다');
  state.dungeons.push({ id: 'qa-rw-open', status: 'open', members: ['qa-rw-c'], created_at: nextDay + 9000 });
  assert(dungeonLastView(state, P('qa-rw-c')).pending, 'V13.140 아직 보고가 처리되지 않은 판은 기다린다(pending)');
  state.dungeons = state.dungeons.filter(x => x.id !== 'qa-rw-open');

  // 주간 1위: 다음 주에 지난주 1위 파티가 한정 칭호(100코인)를 가진다.
  const nextWeek = rankingWeek(nextDay).end + 3600000;
  const kings = dungeonKings(state, nextWeek);
  assert(kings.has('qa-rw-a') && kings.has('qa-rw-b') && kings.has('qa-rw-c') && !kings.has('qa-rw-z'), 'V13.140 지난주 보드 1위 파티원이 주간 1위');
  assert(titleUnlocked('dungeon-week', createCompetition(state, nextWeek).titleStats(P('qa-rw-a'))) && titleCoins('dungeon-week') === C.week_top && !titleUnlocked('dungeon-week', createCompetition(state, nextDay).titleStats(P('qa-rw-a'))), 'V13.140 주간 1위 칭호는 다음 주에 열리고 100코인을 준다');
  play({ ids: ['qa-rw-a', 'qa-rw-b', 'qa-rw-c'], now: nextWeek, time: 499000, right: 100 });
  const rolled = state.dungeon_boards[boardKey('고1', 'c3', 3)];
  assert(rolled.week.rows.length === 1 && rolled.week.rows[0].t === 499000 && rolled.prev?.rows.length === 1 && rolled.all[0].t === 466000 && dungeonKings(state, nextWeek).has('qa-rw-a'), 'V13.140 새 주에는 주간 보드가 비고, 지난주 1위는 prev로 남는다(역대는 그대로)');

  // 서비스 경로(로그인한 학생).
  const login = (await service(state, 'POST', '/login', { username: 'qa-rw-a', password: 'QaReward1!', division: 'high' }, null))._cookie;
  const home = await service(state, 'GET', '/dungeon/home', {}, login);
  const boards = await service(state, 'GET', '/dungeon/boards', {}, login);
  assert(home.reward?.daily === 3 && home.reward.first.c1 === 500 && typeof home.reward.plays_left === 'number' && boards.grade === '고1' && boards.boards.length === 8, 'V13.140 던전 입구에 오늘 보상 판 · 처음 클리어 코인, 기록 보드 API');
  await expectStatus(401, () => service(state, 'GET', '/dungeon/boards', {}, null), 'V13.140 기록 보드는 로그인한 학생만');

  /* ---------- 칭호 9개 · 그림 · 묶음 ---------- */
  const keys = Object.keys(TITLES).filter(k => k.startsWith('dungeon-'));
  assert(TITLE_GROUPS.dungeon === '던전' && keys.length === 9 && keys.every(k => TITLES[k].group === 'dungeon' && TITLE_ART.has(k) && existsSync(fileURLToPath(new URL(`../public/assets/titles/${k}.webp`, import.meta.url)))) && DUNGEON_TITLE_KEYS.length === 8 && TITLES['dungeon-week'].tier === 'limited', 'V13.140 던전 칭호 9개를 \'던전\' 묶음에 등록, 모두 메달 그림이 있다(주간 1위는 한정)');

  /* ---------- 화면 연결 ---------- */
  const ui = source('../public/modules/dungeon.js'), css = source('../public/v13140.css');
  assert(ui.includes("api('/dungeon/last')") && ui.includes("api('/dungeon/boards')") && ui.includes('function showReward(res)') && ui.includes('dg-newrec') && ui.includes("data-dg=\"see-board\"") && ui.includes('titleEmblem(k') && !ui.includes('보상은 곧 열려요'), 'V13.140 결과 화면(코인 · 새 칭호 · 신기록)과 던전 입구 기록 보드 탭');
  assert(css.includes('.dg-newrec') && css.includes('.dg-brow.r1') && css.includes('.dg-rw-title') && css.includes('prefers-reduced-motion') && source('./build-assets.mjs').includes('"v13140.css"'), 'V13.140 기록 · 보상 CSS(움직임 줄이기 존중)가 묶음에 들어간다');
}
