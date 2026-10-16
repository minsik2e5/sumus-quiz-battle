// V13.155 반 전체 연습 부하 시험(check:load): 운영 크기(약 9MB) 상태에서 한 반 40명이 동시에 쓰기 문제(뜻 직접 쓰기)를
// 풀 때 답 하나가 얼마나 걸리는지 잰다. 운영처럼 저장을 1.5초씩 모은다(cloudflare/worker.mjs COMMIT_GROUP_MS).
// 여기 숫자는 이 컴퓨터의 Node 값이라 Cloudflare와 같지 않다. 바꾸기 전과 후를 같은 조건에서 비교하는 데 쓴다.
import { performance } from 'node:perf_hooks';
import { emptyState } from './state.mjs';
import { hashToken } from './auth.mjs';
import { service, allBooks } from './service.mjs';
import * as coord from './mutation-coordinator.mjs';

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const stats = list => { const s = list.slice().sort((a, b) => a - b); const at = q => Math.round(s[Math.min(s.length - 1, Math.floor(q * s.length))] || 0); return { p50: at(.5), p95: at(.95), max: Math.round(s.at(-1) || 0) }; };

export async function runPracticeLoad({ students = 40, rounds = 6, targetKB = 9000, groupMs = 1500, think = 2500 } = {}) {
  const state = emptyState(), now = Date.now(), tokens = {};
  for (let i = 0; i < students; i++) {
    const id = `pl-${i}`;
    state.profiles.push({ id, username: id, display_name: '연습' + i, role: 'student', active: true, class_name: '고1A', school_id: 'gangseo-high', school: '강서고', division: 'high', pets: [{ key: 'dog', first: true, acquired_at: now }], avatar_key: 'dog', password_hash: 'x', created_at: now });
    tokens[id] = 'pl-token-' + id;
    state.tokens.push({ hash: hashToken(tokens[id]), user_id: id, expires_at: now + 86400000 });
  }
  // 운영처럼 지난 연습 기록(문제마다 답 기록 30개)과 숙련도를 채운다.
  const rec = k => ({ word_id: 'w' + k, answer: '정답' + k, correct: k % 3 > 0, ms: 2100, mode: 'write_meaning', at: now });
  const filler = i => ({ id: 'pf-' + i, student_id: `pl-${i % students}`, division: 'high', school_id: 'gangseo-high', school: '강서고', total: 30, correct: 24, xp: 30, mode: 'write_meaning', range_codes: ['24'], created_at: now - 86400000 * (1 + (i % 60)), answer_records: Array.from({ length: 30 }, (_, k) => rec(k)) });
  state.mastery ||= {};
  for (let i = 0; i < students; i++) state.mastery[`pl-${i}`] = Object.fromEntries(Array.from({ length: 600 }, (_, k) => ['w' + k, { n: 3, r: 2, at: now }]));
  for (let i = 0; JSON.stringify(state).length < targetKB * 1024; i++) for (let k = 0; k < 100; k++) state.sessions.push(filler(i * 100 + k));
  const stateKB = Math.round(JSON.stringify(state).length / 1024);

  let writes = 0;
  const repo = { async read() { return { state, revision: 0 }; }, async commit(next) { JSON.stringify(next); await sleep(3); writes++; } };
  const c = coord.createMutationCoordinator(repo, { state: structuredClone(state), revision: 0 }, { flushDelay: 500, retryDelay: 2000, groupMs: () => groupMs });
  // 워커와 같은 길: 연습 답 · 다음 · 패스는 빠른 길(있으면), 나머지는 저장까지 기다린다.
  const quick = coord.isQuickWrite || (() => false);
  const call = (who, method, path, body = {}) => method === 'GET' ? service(c.current().state, method, path, body, tokens[who])
    : (quick(method, '/api' + path) ? c.fast : c.durable)(s => service(s, method, path, body, tokens[who]));

  const range = [...new Set(allBooks(state).filter(b => b.school_id === 'gangseo-high').flatMap(b => b.words || []).map(w => String(w.range_code)))][0];
  const practices = [];
  for (let i = 0; i < students; i++) practices.push(await call(`pl-${i}`, 'POST', '/practice/start', { school: '강서고', range_codes: [range], mode: 'write_meaning', target: 30, run_mode: 'practice' }));
  const times = [];
  const student = async i => {
    await sleep(Math.random() * think);
    for (let r = 0; r < rounds; r++) {
      const v = practices[i], t = performance.now();
      const res = await call(`pl-${i}`, 'POST', `/practice/${v.id}/answer`, { question_id: v.question_id, answer: '모르는 답', prefetch_next: true });
      times.push(performance.now() - t);
      practices[i] = res.prefetched_next || await call(`pl-${i}`, 'POST', `/practice/${v.id}/next`, {});
      await sleep(think * (0.6 + Math.random() * 0.8));
    }
  };
  const t0 = performance.now();
  await Promise.all(Array.from({ length: students }, (_, i) => student(i)));
  await c.flush();
  const total = Math.round(performance.now() - t0);
  await c.close();
  return { stateKB, answers: times.length, answer: stats(times), writes, total, quick: !!coord.isQuickWrite };
}

if (import.meta.url === `file://${process.argv[1]}`) runPracticeLoad().then(r => console.log(JSON.stringify(r)));
