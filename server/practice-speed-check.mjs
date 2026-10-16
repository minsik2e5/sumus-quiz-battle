// V13.155 연습 · 실전시험 렉 줄이기 검사. 원인(반 40명 · 9MB 상태): 답마다 ① 상태 전체 깊은 복사(약 100ms, 한 줄로 처리)
// ② 저장 모으기(1.5초~)가 끝날 때까지 답을 붙잡음 → 답 하나 p50 약 2.6초. 고친 뒤 7ms(server/practice-load.mjs, check:load).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { cloneState, isQuickWrite, SHALLOW_KEYS, createMutationCoordinator } from './mutation-coordinator.mjs';

const source = path => readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8');

export async function runPracticeSpeedChecks(assert) {
  const s = { sessions: [{ id: 'a', n: 1 }], mastery: { p1: { w1: { n: 1 } } }, profiles: [{ id: 'p1', coins: 1 }], practices: [] };
  const c = cloneState(s);
  c.sessions.push({ id: 'b' }); c.mastery.p2 = {}; c.profiles[0].coins = 9; c.practices.push(1);
  assert(SHALLOW_KEYS.join() === 'sessions,mastery' && s.sessions.length === 1 && !s.mastery.p2 && s.profiles[0].coins === 1 && !s.practices.length && c.sessions[0] === s.sessions[0] && c.mastery.p1 === s.mastery.p1,
    'V13.155 변경 복사: 지난 연습 기록 · 숙련도는 얕게(배열 · 학생 묶음만 새로), 나머지는 깊게 복사해서 새 변경이 이전 상태를 바꾸지 않는다');
  assert(isQuickWrite('POST', '/api/practice/abc/answer') && isQuickWrite('POST', '/api/practice/abc/next') && isQuickWrite('POST', '/api/practice/abc/pass')
    && !isQuickWrite('POST', '/api/practice/abc/finish') && !isQuickWrite('POST', '/api/practice/start') && !isQuickWrite('GET', '/api/practice/abc/answer') && !isQuickWrite('POST', '/api/exams/x/submit'),
    'V13.155 빠른 길은 연습 중 답 · 다음 · 패스만(시작 · 끝내기 · 시험 제출 · 코인 같은 것은 저장까지 기다린다)');
  // 빠른 길도 저장은 된다(답한 뒤 곧 모아서 저장).
  let committed = null;
  const co = createMutationCoordinator({ async read() { return { state: {}, revision: 0 }; }, async commit(state) { committed = JSON.stringify(state); } }, { state: { n: 0 }, revision: 0 }, { flushDelay: 50, groupMs: () => 0 });
  const out = await co.fast(state => { state.n = 7; return 'ok'; });
  await co.flush(); await co.close();
  assert(out === 'ok' && committed === '{"n":7}', 'V13.155 빠른 길로 받은 답도 곧 저장된다');
  const worker = source('../cloudflare/worker.mjs');
  assert(worker.includes('isQuickWrite(request.method, url.pathname) ? await this.mutations.fast(execute) : await this.mutations.durable(execute)') && source('./mutation-coordinator.mjs').includes('const nextState = cloneState(snapshot.state);'),
    'V13.155 워커: 연습 답 · 다음 · 패스는 빠른 길, 변경 복사는 cloneState');
}
