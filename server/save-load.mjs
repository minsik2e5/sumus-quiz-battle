// V13.168 저장 부하 시험(check:load): 운영 크기(약 9MB) 상태를 실제 로컬 저장소(cloudflare/local-first.mjs, SQLite 모의 객체)에
// 두고, 한 반 40명이 동시에 연습(20명) · 몬스터 사냥(10명) · 낚시(10명)를 할 때 걸리는 시간과 저장 한 번의 시간을 잰다.
// 그다음 한 달 지난 연습 기록을 자동 정리(sweep)로 다 줄이고 같은 일을 다시 해서 상태 크기 · 저장 시간 전후를 비교한다.
// 워커처럼: 연습 답 · 다음 · 패스는 빠른 길, 나머지는 저장까지 기다린다. 저장 대기 · 모으기는 쓰기 한도 'ok' 날 값.
// 여기 숫자는 이 컴퓨터의 Node 값이라 Cloudflare와 같지 않다. 바꾸기 전과 후를 같은 조건에서 비교하는 데 쓴다.
import { performance } from 'node:perf_hooks';
import { emptyState } from './state.mjs';
import { hashToken } from './auth.mjs';
import { service, allBooks, sweep } from './service.mjs';
import * as coord from './mutation-coordinator.mjs';
import { createLocalRepository } from '../cloudflare/local-first.mjs';
import { createStorageMock } from './storage-mock.mjs';

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const stats = list => { const s = list.slice().sort((a, b) => a - b); const at = q => Math.round(s[Math.min(s.length - 1, Math.floor(q * s.length))] || 0); return { p50: at(.5), p95: at(.95), max: Math.round(s.at(-1) || 0), n: s.length }; };
const DAY = 86400000;

export function loadState({ students = 40, targetKB = 9000, now = Date.now() } = {}) {
  const state = emptyState();
  for (let i = 0; i < students; i++) {
    const id = `sl-${i}`;
    state.profiles.push({ id, username: id, display_name: '저장' + i, role: 'student', active: true, class_name: '고1A', school_id: 'gangseo-high', school: '강서고', division: 'high', pets: [{ key: 'dog', first: true, acquired_at: now }], avatar_key: 'dog', password_hash: 'x', created_at: now, hunt: { basic: 200 }, reel: { bait: 200, guide: true, tut: true } });
    state.tokens.push({ hash: hashToken('sl-token-' + id), user_id: id, expires_at: now + DAY });
  }
  // 운영처럼: 지난 연습 기록(답 기록 30개씩, 하루~60일 전)과 숙련도.
  const rec = k => ({ word_id: 'w' + k, answer: '정답' + k, correct: k % 3 > 0, ms: 2100, mode: 'write_meaning', at: now });
  const filler = i => ({ id: 'sf-' + i, student_id: `sl-${i % students}`, division: 'high', school_id: 'gangseo-high', school: '강서고', total: 30, correct: 24, score: 80, xp: 30, reward_points: 3, mode: 'write_meaning', range_codes: ['24'], created_at: now - DAY * (1 + (i % 60)), answer_records: Array.from({ length: 30 }, (_, k) => rec(k)) });
  for (let i = 0; i < students; i++) state.mastery[`sl-${i}`] = Object.fromEntries(Array.from({ length: 600 }, (_, k) => ['w' + k, { n: 3, r: 2, at: now }]));
  for (let i = 0; JSON.stringify(state).length < targetKB * 1024; i++) for (let k = 0; k < 100; k++) state.sessions.push(filler(i * 100 + k));
  return state;
}

async function round(c, local, storage, { students, rounds, think }) {
  const rows0 = storage.rowsWritten;
  let requests = 0;
  const tokens = id => 'sl-token-' + id;
  const call = (who, method, path, body = {}) => (requests += 1, coord.isQuickWrite(method, '/api' + path)
    ? c.fast(s => service(s, method, path, body, tokens(who)), coord.quickOwn('/api' + path), coord.quickSettle)
    : c.durable(s => service(s, method, path, body, tokens(who))));
  const commits = [];
  local.onCommit = () => commits.push(local.metrics.commitMs);
  const range = [...new Set(allBooks(c.current().state).filter(b => b.school_id === 'gangseo-high').flatMap(b => b.words || []).map(w => String(w.range_code)))][0];
  const times = { answer: [], hunt: [], reel: [] };
  let errors = 0;
  const timed = async (list, fn) => { const t = performance.now(); try { return await fn(); } catch (error) { if (!(error?.status < 500)) errors += 1; return null; } finally { list.push(performance.now() - t); } };
  const practice = async i => {
    let v = await call(`sl-${i}`, 'POST', '/practice/start', { school: '강서고', range_codes: [range], mode: 'write_meaning', target: 30, run_mode: 'practice' });
    for (let r = 0; r < rounds && v && !v.finished; r++) {
      await sleep(think * (0.4 + Math.random()));
      const res = await timed(times.answer, () => call(`sl-${i}`, 'POST', `/practice/${v.id}/answer`, { question_id: v.question_id, answer: '모르는 답', prefetch_next: true }));
      v = res?.prefetched_next || await call(`sl-${i}`, 'POST', `/practice/${v.id}/next`, {}).catch(() => null);
    }
  };
  const hunter = async i => {
    for (let r = 0; r < rounds; r++) {
      await sleep(think * (0.4 + Math.random()));
      const home = await timed(times.hunt, () => call(`sl-${i}`, 'POST', '/hunt/home'));
      const spot = home?.hunt?.spots?.find(s => s.kind === 'monster') || home?.hunt?.spots?.[0];
      if (!spot) continue;
      const met = await timed(times.hunt, () => call(`sl-${i}`, 'POST', '/hunt/meet', { spot: spot.id }));
      if (met) await timed(times.hunt, () => call(`sl-${i}`, 'POST', '/hunt/throw', { id: `sl-throw-${i}-${r}-${Math.random().toString(36).slice(2, 8)}`, spot: met.spot || spot.id, ball: 'basic' }));
    }
  };
  const fisher = async i => {
    for (let r = 0; r < rounds; r++) {
      await sleep(think * (0.4 + Math.random()));
      const castId = `sl-cast-${i}-${r}-${Math.random().toString(36).slice(2, 8)}`;
      const cast = await timed(times.reel, () => call(`sl-${i}`, 'POST', '/reel/cast', { id: castId, cast: 'good' }));
      if (cast) await timed(times.reel, () => call(`sl-${i}`, 'POST', '/reel/land', { id: castId, result: 'caught', finish: 'perfect' }));
    }
  };
  const t0 = performance.now();
  await Promise.all(Array.from({ length: students }, (_, i) => i < students / 2 ? practice(i) : i < students * 3 / 4 ? hunter(i) : fisher(i)));
  await c.flush();
  const kb = Math.round((local.latest()?.size || 0) / 1024);
  return { kb, answer: stats(times.answer), hunt: stats(times.hunt), reel: stats(times.reel), commit: stats(commits), commits: commits.length, errors, total: Math.round(performance.now() - t0), requests, rows: storage.rowsWritten - rows0 };
}

export async function runSaveLoad({ students = 40, rounds = 5, think = 1500, targetKB = 9000 } = {}) {
  const state = loadState({ students, targetKB });
  const storage = createStorageMock();
  const local = createLocalRepository(storage, { log: { warn() {}, error() {} } });
  local.adoptRemote(state, 1);
  const initial = await local.read();
  const c = coord.createMutationCoordinator(local, initial, { flushDelay: 100, retryDelay: 2000, rollbackOnFailure: true, groupMs: () => 250, onError() {} });
  const before = await round(c, local, storage, { students, rounds, think });
  // 한 달 지난 연습 기록 자동 정리: 한 번에 학생 25명씩, 다 할 때까지(운영에서는 한 시간에 한 번씩 이어서).
  let runs = 0;
  const trimStarted = performance.now();
  do { await c.durable(s => sweep(s, Date.now(), { autoTrim: true }) ? true : coord.NO_MUTATION); runs += 1; }
  while (c.current().state.storageAutoTrim?.more && runs < 20);
  const trimMs = Math.round(performance.now() - trimStarted);
  const trimmed = c.current().state.storageAutoTrim;
  const after = await round(c, local, storage, { students, rounds, think });
  await c.close();
  return { before, after, trim: { runs, ms: trimMs, sessions: trimmed?.total_sessions || 0, kb: trimmed?.total_kb || 0 }, frozenRetries: c.stats?.().frozen_retries ?? 0 };
}

if (import.meta.url === `file://${process.argv[1]}`) runSaveLoad().then(r => console.log(JSON.stringify(r, null, 1)));
