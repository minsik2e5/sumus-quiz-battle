// V13.212 야차 대회 렉 시험(check:load): 운영 크기(약 9MB) 상태를 실제 로컬 저장소(cloudflare/local-first.mjs, SQLite 모의 객체)에
// 두고, 대회 날처럼 한꺼번에 일어나는 일을 메인 상태 객체 하나에서 돌려 경로별 걸린 시간(p50 · p95 · max)을 잰다.
//   - 대회 학생 32명: 16판을 열고(주인 · 손님 /tournament/play) 판이 끝나면 방이 결과를 보고한다(settleBattle).
//     경기를 기다리는 동안은 놀이터를 한다(10초 맞추기 ping, 인형뽑기 · 사냥 · 낚시 첫 화면 = '보기'인 POST).
//   - 다른 학생 8명: 연습 답(빠른 길).
//   - 학생 홈 초대 확인(GET /battle/invite) · 선생님 대진표(8초) · TV(5초).
// 쓰기 단계(오늘 쓴 줄 %)마다 저장 모으기 값이 다르다(cloudflare/worker.mjs commitPacing): ok 0.25초 · warn 1.5초 · defer 6초.
// 여기 숫자는 이 컴퓨터의 Node 값이라 Cloudflare와 같지 않다. 바꾸기 전과 후를 같은 조건에서 비교하는 데 쓴다.
import { performance } from 'node:perf_hooks';
import { hashToken } from './auth.mjs';
import { service, settleBattle, settleArenaReport } from './service.mjs';
import { liveMatch } from './arena-live-sim.mjs';
import { liveReport } from './arena-live.mjs';
import * as coord from './mutation-coordinator.mjs';
import { createLocalRepository } from '../cloudflare/local-first.mjs';
import { createStorageMock } from './storage-mock.mjs';
import { loadState } from './save-load.mjs';
import { allBooks } from './service.mjs';
import { createSessionArchive } from '../cloudflare/session-archive-store.mjs';
import { planArchive, applyArchive } from './session-archive.mjs';

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
export const loadStats = list => { const s = list.slice().sort((a, b) => a - b); const at = q => Math.round(s[Math.min(s.length - 1, Math.floor(q * s.length))] || 0); return { p50: at(.5), p95: at(.95), max: Math.round(s.at(-1) || 0), n: s.length }; };
const DAY = 86400000;
export const PACING = { ok: { groupMs: 250, flushDelay: 100 }, warn: { groupMs: 1500, flushDelay: 500 }, defer: { groupMs: 6000, flushDelay: 500 } };

// 운영 /api/health(2026-11-03 대회 중, 13.5MB)와 비슷한 구성: 연습 기록 약 9MB(3,000개) · 숙련도 약 2.4MB(44명, 450단어씩) ·
// 프로필(펫 · 본 칭호 · 활동 기록) · 이의 신청 기록.
export function prodLikeState({ students = 44, sessions = 2991, words = 450, now = Date.now() } = {}) {
  const state = loadState({ students, targetKB: 0, now });
  state.sessions = [];
  for (const p of state.profiles) Object.assign(p, {
    class_name: '고1A',
    pets: Array.from({ length: 15 }, (_, k) => ({ key: ['dog', 'cat', 'fox', 'rabbit', 'bear'][k % 5], form: 2, acquired_at: now - k * DAY, ...(k === 0 ? { first: true, active: true } : {}) })),
    titles_seen: Array.from({ length: 200 }, (_, k) => `title_key_${k}`),
    activity: Array.from({ length: 50 }, (_, k) => ({ at: now - k * 60000, k: 'study', t: `연습 · 단어 ${k}` }))
  });
  const rec = k => ({ word_id: 'word-' + k, answer: '정답 뜻 ' + k, correct: k % 3 > 0, ms: 2100, mode: 'write_meaning', at: now });
  for (let i = 0; i < sessions; i++) state.sessions.push({ id: 'ss' + i, student_id: `sl-${i % students}`, division: 'high', school_id: 'gangseo-high', school: '강서고', total: 30, correct: 24, score: 80, answered_count: 22, wrong_count: 6, unanswered_count: 8, xp: 30, created_at: now - DAY * (1 + (i % 29)), answer_records: Array.from({ length: 22 }, (_, k) => rec(k)), wrong_details: Array.from({ length: 4 }, (_, k) => ({ word_id: 'w' + k, word: 'apple', meaning: '사과 뜻', answer: '오답' })), word_ids: Array.from({ length: 30 }, (_, k) => 'word-' + k) });
  for (let i = 0; i < students; i++) state.mastery[`sl-${i}`] = Object.fromEntries(Array.from({ length: words }, (_, k) => ['word-id-' + k, { mastery: 60, correct: 3, wrong: 1, streak: 1, recent_results: [true, false, true], updated_at: now }]));
  state.meaningDisputes = Array.from({ length: 900 }, (_, k) => ({ id: 'd' + k, word_id: 'w' + k, answer: '학생이 쓴 뜻 ' + k, status: 'done', source_type: 'practice', student_id: 'sl-1', created_at: now }));
  return state;
}

// extraGamers: 대회 밖에서 놀이터만 하는 학생 수(몇 명까지 버티는지 재기, docs/performance-rules.md).
// archived: V13.216 일주일 지난 연습 기록 답 상세를 보관 표로 다 옮긴 상태에서 잰다(server/session-archive.mjs).
export async function runTournamentLoad({ level = 'ok', seconds = 20, others = 8, extraGamers = 0, gameEvery = 2500, targetKB = 9000, coordinator = coord, archived = false } = {}) {
  const now = Date.now();
  const state = prodLikeState({ now, students: Math.max(44, 40 + extraGamers) });
  void targetKB;
  state.profiles.push({ id: 'tl-teacher', username: 'tl-teacher', display_name: '선생님', role: 'teacher', active: true, school_ids: ['gangseo-high'], active_school_id: 'gangseo-high', division: 'high', created_at: now });
  state.tokens.push({ hash: hashToken('sl-token-tl-teacher'), user_id: 'tl-teacher', expires_at: now + DAY });
  const storage = createStorageMock();
  if (archived) {
    const archive = createSessionArchive(storage);
    for (let i = 0; i < 40; i++) { const plan = planArchive(state, now); if (!plan.entries.length) break; archive.put(plan.entries); applyArchive(state, plan.entries, now); }
  }
  const local = createLocalRepository(storage, { log: { warn() {}, error() {} } });
  local.adoptRemote(state, 1);
  const initial = await local.read();
  const pacing = PACING[level];
  const c = coordinator.createMutationCoordinator(local, initial, { ...pacing, retryDelay: 2000, rollbackOnFailure: true, onError() {} });
  const token = id => 'sl-token-' + id;
  // 워커와 같은 길: GET은 그대로 읽고, 연습 답 · 다음 · 패스는 빠른 길, 나머지 POST는 저장까지 기다린다.
  const call = (who, method, path, body = {}) => {
    const run = s => service(s, method, path, body, token(who));
    const api = '/api' + path;
    if (method === 'GET' || coordinator.isReadPost?.(method, api)) return coordinator.readState(c.current().state, run);
    if (coordinator.isQuickWrite(method, api)) return c.fast(run, coordinator.quickOwn(api), coordinator.quickSettle);
    if (coordinator.isViewPost?.('POST', api)) return c.view(run, who, coordinator.tokenOwner(hashToken(token(who))));
    return coordinator.tokenOwner ? c.durable(run, coordinator.tokenOwner(hashToken(token(who)))) : c.durable(run);
  };
  const times = {};
  let errors = 0;
  const timed = async (key, fn) => { const t = performance.now(); try { return await fn(); } catch (error) { if (!(error?.status < 500)) { errors += 1; if (errors < 3) console.error('[tournament-load]', key, error?.message); } return null; } finally { (times[key] ||= []).push(performance.now() - t); } };
  const commits0 = local.metrics.commits || 0, rows0 = storage.rowsWritten;
  let commits = 0;
  local.onCommit = () => { commits += 1; };

  // 대회 만들기(32명).
  const players = Array.from({ length: 32 }, (_, i) => `sl-${i}`);
  const range = [...new Set(allBooks(c.current().state).filter(b => b.school_id === 'gangseo-high').flatMap(b => b.words || []).map(w => String(w.range_code)))].slice(0, 3);
  const made = await c.durable(s => service(s, 'POST', '/teacher/tournaments', { class_name: '고1', student_ids: players, range_codes: range, prize: 100 }, token('tl-teacher')));
  const tid = made.tournament.id;
  const deadline = performance.now() + seconds * 1000;
  const live = () => performance.now() < deadline;

  // 판 하나: 둘이 들어가고, 경기(약 seconds/2초) 동안은 놀이터, 끝나면 방이 보고하고 둘 다 홈을 새로 불러온다.
  const match = async m => {
    await sleep(Math.random() * 3000);
    const host = await timed('대회 판 열기', () => call(m.a, 'POST', '/tournament/play', { tournament_id: tid, match_id: m.id }));
    await sleep(500 + Math.random() * 1500);
    await timed('대회 판 참가', () => call(m.b, 'POST', '/tournament/play', { tournament_id: tid, match_id: m.id }));
    await sleep(seconds * 400 + Math.random() * seconds * 200);
    if (host?.id) await timed('결과 보고', () => c.durable(s => settleBattle(s, { id: host.id, winner: m.a, reason: 'end', hp: { [m.a]: 100, [m.b]: 0 }, max_hp: 250 }) ? { ok: true } : coordinator.NO_MUTATION));
    await Promise.all([m.a, m.b].map(id => timed('홈 새로고침(GET)', () => call(id, 'GET', '/bootstrap'))));
  };
  // 놀이터: 10초 맞추기 ping, 인형뽑기 · 사냥 첫 화면, 낚시 안내(모두 '보기'인 POST).
  const GAMES = [['POST /timing/ping', '/timing/ping'], ['POST /claw/home', '/claw/home'], ['POST /hunt/home', '/hunt/home'], ['POST /reel/guide', '/reel/guide']];
  const gamer = async id => {
    while (live()) {
      await sleep(gameEvery * (0.5 + Math.random()));
      const [key, path] = GAMES[Math.floor(Math.random() * GAMES.length)];
      await timed(key, () => call(id, 'POST', path, {}));
    }
  };
  const inviter = async id => { while (live()) { await sleep(20000 * Math.random() + 2000); await timed('GET /battle/invite', () => call(id, 'GET', '/battle/invite')); } };
  const range0 = range[0];
  const practice = async id => {
    let v = await call(id, 'POST', '/practice/start', { school: '강서고', range_codes: [range0], mode: 'write_meaning', target: 30, run_mode: 'practice' }).catch(() => null);
    while (v && !v.finished && live()) {
      await sleep(1500 * (0.4 + Math.random()));
      const res = await timed('연습 답(빠른 길)', () => call(id, 'POST', `/practice/${v.id}/answer`, { question_id: v.question_id, answer: '모르는 답', prefetch_next: true }));
      v = res?.prefetched_next || null;
    }
  };
  // V13.230 펫 아레나 친구 대전(실시간 1:1): 메인에는 방 만들기 · 들어가기 · 끝 보고만 온다(판 도중 조작은 방 객체).
  //   친구 4쌍이 대회 중에 한 판씩. 끝 보고는 두 조작 기록으로 runArena를 다시 돌린다(메인에서 가장 무거운 부분).
  const report = liveReport(liveMatch({ seed: 5 }).r);
  const friendMatch = async (a, b) => {
    await sleep(Math.random() * 4000);
    const made = await timed('친구 대전 방 만들기', () => call(a, 'POST', '/games/arena/live/create', { friend_id: b }));
    if (!made?.room) return;
    await sleep(800 + Math.random() * 1500);
    const joined = await timed('친구 대전 들어가기', () => call(b, 'POST', '/games/arena/live/join', { id: made.room.id }));
    if (!joined?.room) return;
    await sleep(seconds * 400 + Math.random() * seconds * 200);
    await timed('친구 대전 끝 보고', () => c.durable(s => settleArenaReport(s, { ...report, id: made.room.id, players: [a, b] }) || coordinator.NO_MUTATION));
  };
  const teacher = async () => { while (live()) { await sleep(8000); await timed('선생님 대진표(GET)', () => call('tl-teacher', 'GET', `/teacher/tournaments/${tid}`)); } };
  const t = c.current().state.tournaments.find(x => x.id === tid);
  const t0 = performance.now();
  await Promise.all([
    ...t.rounds[0].filter(m => m.a && m.b).map(match),
    ...players.map(gamer), ...players.map(inviter),
    ...Array.from({ length: extraGamers }, (_, i) => gamer(`sl-${40 + i}`)),
    ...Array.from({ length: others }, (_, i) => practice(`sl-${32 + i}`)),
    ...Array.from({ length: 4 }, (_, i) => friendMatch(`sl-${32 + i * 2}`, `sl-${33 + i * 2}`)),
    teacher()
  ]);
  await c.flush();
  const out = { level, kb: Math.round((local.latest()?.size || 0) / 1024), errors, commits, rows: storage.rowsWritten - rows0, total: Math.round(performance.now() - t0), frozenRetries: c.stats?.().frozen_retries ?? 0 };
  for (const [key, list] of Object.entries(times)) out[key] = loadStats(list);
  await c.close();
  void commits0;
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const levels = (process.argv[2] || 'ok,warn,defer').split(',');
  for (const level of levels) console.log(JSON.stringify(await runTournamentLoad({ level }), null, 1));
}
