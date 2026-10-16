// V13.155 연습 · 실전시험 렉 줄이기 검사. 원인(반 40명 · 9MB 상태): 답마다 ① 상태 전체 깊은 복사(약 100ms, 한 줄로 처리)
// ② 저장 모으기(1.5초~)가 끝날 때까지 답을 붙잡음 → 답 하나 p50 약 2.6초. 고친 뒤 7ms(server/practice-load.mjs, check:load).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { cloneState, isQuickWrite, quickOwn, quickSettle, SHALLOW_KEYS, createMutationCoordinator } from './mutation-coordinator.mjs';

const source = path => readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8');

// V13.157: 얕은 복사는 빠른 길(연습 답 · 다음 · 패스)에만, 그 학생 숙련도는 깊게. 다른 변경은 전체를 깊게 복사한다
// (같이 쓰는 객체를 고친 뒤 실패하면 고친 것이 이전 상태에 남아 다음 저장에 섞였다).
const deepFreeze = value => { if (value && typeof value === 'object' && !Object.isFrozen(value)) { Object.freeze(value); for (const v of Object.values(value)) deepFreeze(v); } return value; };

export async function runPracticeSpeedChecks(assert) {
  const s = { sessions: [{ id: 'a', n: 1 }], mastery: { p1: { w1: { n: 1 } }, p2: { w1: { n: 1 } } }, profiles: [{ id: 'p1', coins: 1 }], practices: [] };
  const c = cloneState(s, { mastery: ['p1'] });
  c.sessions.push({ id: 'b' }); c.mastery.p3 = {}; c.mastery.p1.w1.n = 5; c.profiles[0].coins = 9; c.practices.push(1);
  assert(SHALLOW_KEYS.join() === 'sessions,mastery' && s.sessions.length === 1 && !s.mastery.p3 && s.mastery.p1.w1.n === 1 && s.profiles[0].coins === 1 && !s.practices.length && c.sessions[0] === s.sessions[0] && c.mastery.p2 === s.mastery.p2,
    'V13.157 빠른 길 복사: 지난 연습 기록 · 다른 학생 숙련도는 얕게, 그 학생 숙련도와 나머지는 깊게 복사해서 새 변경이 이전 상태를 바꾸지 않는다');
  const full = cloneState(s);
  assert(full.sessions[0] !== s.sessions[0] && full.mastery.p2 !== s.mastery.p2, 'V13.157 빠른 길이 아닌 변경은 전체를 깊게 복사한다');
  // 실패한 변경은 이전 상태에 아무것도 남기지 않는다(예전: 같이 쓰는 숙련도를 고친 뒤 던지면 남았다).
  {
    const co = createMutationCoordinator({ async read() { return { state: {}, revision: 0 }; }, async commit() {} }, { state: structuredClone(s), revision: 0 }, { flushDelay: 50, groupMs: () => 0 });
    await co.durable(state => { state.mastery.p1.w1.n = 99; state.sessions[0].n = 99; throw new Error('x'); }).catch(() => {});
    await co.fast(state => { state.mastery.p1.w1.n = 77; throw new Error('x'); }, { mastery: ['p1'] }).catch(() => {});
    const now = co.current().state;
    await co.close();
    assert(now.mastery.p1.w1.n === 1 && now.sessions[0].n === 1, 'V13.157 변경 도중 실패하면 숙련도 · 연습 기록이 그대로다');
  }
  // 빠른 길 세 요청은 다른 기록 · 다른 학생 숙련도를 고치지 않는다: 얼려 두고 실제 서비스로 답 · 다음 · 패스를 해 본다.
  {
    const { emptyState } = await import('./state.mjs');
    const { hashToken } = await import('./auth.mjs');
    const { service, allBooks } = await import('./service.mjs');
    const st = emptyState(), now = Date.now();
    for (const id of ['qs-1', 'qs-2']) { st.profiles.push({ id, username: id, display_name: id, role: 'student', active: true, class_name: '고1A', school_id: 'gangseo-high', school: '강서고', division: 'high', pets: [{ key: 'dog', first: true, acquired_at: now }], avatar_key: 'dog', password_hash: 'x', created_at: now }); st.tokens.push({ hash: hashToken('tok-' + id), user_id: id, expires_at: now + 86400000 }); }
    st.mastery ||= {}; st.mastery['qs-2'] = { w0: { mastery: 10, correct: 1, wrong: 0, streak: 0, recent_results: [] } };
    st.sessions.push({ id: 'old-1', student_id: 'qs-1', division: 'high', school_id: 'gangseo-high', school: '강서고', total: 3, correct: 2, xp: 3, mode: 'choice', range_codes: ['24'], created_at: now - 86400000, answer_records: [] });
    const range = [...new Set(allBooks(st).filter(b => b.school_id === 'gangseo-high').flatMap(b => b.words || []).map(w => String(w.range_code)))][0];
    const run = mode => service(st, 'POST', '/practice/start', { school: '강서고', range_codes: [range], mode, target: 10, run_mode: 'practice' }, 'tok-qs-1');
    let ok = true, done = 0;
    for (const mode of ['write_meaning', 'eng2mean']) {
      const x = await run(mode);
      const quick = async (path, body) => {
        const next = cloneState(st, quickOwn('/api' + path)(st));
        for (const item of next.sessions) deepFreeze(item); for (const [k, v] of Object.entries(next.mastery)) if (k !== 'qs-1') deepFreeze(v);
        try { await service(next, 'POST', path, body, 'tok-qs-1'); Object.assign(st, next); done++; } catch (e) { if (e instanceof TypeError) { ok = false; } }
      };
      const qid = x.question?.id || x.question_id;
      await quick(`/practice/${x.id}/answer`, { question_id: qid, answer: '틀린답' });
      await quick(`/practice/${x.id}/next`, {});
      const y = st.practices.find(p => p.id === x.id);
      await quick(`/practice/${x.id}/pass`, { question_id: y?.question?.id });
      // 끝내기도 빠른 길 안에서 일어날 수 있다(실전시험 마지막 답): 같은 얼린 복사에서 해 본다.
      const before = st.sessions.length;
      await quick(`/practice/${x.id}/finish`, {});
      if (st.sessions.length !== before + 1) { ok = false; }
    }
    assert(ok && done >= 4 && Object.keys(st.mastery['qs-1'] || {}).length > 0 && st.mastery['qs-2'].w0.mastery === 10, 'V13.157 연습 답 · 다음 · 패스는 지난 연습 기록 · 다른 학생 숙련도를 고치지 않는다(얼려도 오류 없음)');
  }
  // 뒤 저장이 실패하고 있으면 빠른 길도 저장이 끝난 뒤 답한다.
  {
    let fail = true, tries = 0;
    const co = createMutationCoordinator({ async read() { return { state: {}, revision: 0 }; }, async commit() { tries++; if (fail) throw new Error('quota'); } }, { state: { n: 0 }, revision: 0 }, { flushDelay: 50, retryDelay: 1000, groupMs: () => 0, onError() {} });
    await co.fast(state => { state.n = 1; });
    await new Promise(r => setTimeout(r, 120));
    const second = await co.fast(state => { state.n = 2; return 'ok'; }).then(() => 'replied', () => 'refused');
    fail = false; await co.flush().catch(() => {}); await co.close();
    assert(tries >= 2 && second === 'refused', 'V13.157 뒤 저장이 실패하는 동안 빠른 길은 저장까지 기다려서, 저장 못 한 답을 "됐다"고 답하지 않는다');
  }
  // 빠른 길이어도 연습이 끝났으면(코인 · 경험치) 저장이 끝난 뒤 답한다.
  {
    let saved = 0;
    const co = createMutationCoordinator({ async read() { return { state: {}, revision: 0 }; }, async commit() { await new Promise(r => setTimeout(r, 30)); saved++; } }, { state: { n: 0 }, revision: 0 }, { flushDelay: 5000, groupMs: () => 0 });
    await co.fast(state => { state.n = 1; return { finished: false }; }, null, quickSettle);
    const before = saved;
    await co.fast(state => { state.n = 2; return { finished: true }; }, null, quickSettle);
    const after = saved;
    await co.fast(state => { state.n = 3; return { prefetched_next: { finished: true } }; }, null, quickSettle);
    const third = saved;
    await co.close();
    assert(before === 0 && after === 1 && third === 2, 'V13.157 빠른 길에서 연습이 끝나면(실전시험 마지막 답 · 미리 받은 다음 문제에서 끝남) 저장까지 기다린다');
  }
  // 풀던 단어가 단어장에서 빠져도 답이 500으로 막히지 않고 다음 문제로 넘어간다.
  {
    const { emptyState } = await import('./state.mjs');
    const { hashToken } = await import('./auth.mjs');
    const { service, allBooks } = await import('./service.mjs');
    const st = emptyState(), now = Date.now();
    st.profiles.push({ id: 'mw-1', username: 'mw-1', display_name: 'mw', role: 'student', active: true, class_name: '고1A', school_id: 'gangseo-high', school: '강서고', division: 'high', pets: [{ key: 'dog', first: true, acquired_at: now }], avatar_key: 'dog', password_hash: 'x', created_at: now });
    st.tokens.push({ hash: hashToken('tok-mw'), user_id: 'mw-1', expires_at: now + 86400000 });
    const range = [...new Set(allBooks(st).filter(b => b.school_id === 'gangseo-high').flatMap(b => b.words || []).map(w => String(w.range_code)))][0];
    const x = await service(st, 'POST', '/practice/start', { school: '강서고', range_codes: [range], mode: 'write_meaning', target: 10, run_mode: 'practice' }, 'tok-mw');
    const live = st.practices.find(p => p.id === x.id);
    live.question.word_id = 'gone-word'; if (live.next_preview) live.next_preview.question.word_id = 'gone-word-2';
    live.retry = [{ id: 'gone-word-3', at: 0 }];
    const res = await service(st, 'POST', `/practice/${x.id}/answer`, { question_id: live.question_id, answer: '아무거나' }, 'tok-mw').catch(e => e);
    assert(res?.skipped_missing_word && !res.feedback && res.question && st.practices.find(p => p.id === x.id).question.word_id !== 'gone-word', 'V13.157 풀던 단어 · 다시 낼 단어가 단어장에서 빠지면 채점하지 않고 다른 단어로 넘어간다(예전: 답마다 500)');
  }
  // 화면: 나갔다 다시 들어오면 저장 실패 표시를 지우고, 화면 복귀 때 답을 보내는 중이면 시험을 끝내지 않는다.
  {
    const ui = source('../public/modules/sessions.js');
    assert(/export function leaveSession\(\) \{[^\n]*brokenSession = null;/.test(ui) && ui.includes('Number(practiceState.deadline) <= Date.now() + practiceOffset && !answering) finishPracticeByTimer();'),
      'V13.157 다시 이어 풀면 저장 실패 표시가 남아 답을 버리지 않고, 마감 순간 보내던 답이 시험 끝내기보다 늦게 가서 버려지지 않는다');
  }
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
  assert(worker.includes('isQuickWrite(request.method, url.pathname) ? await this.mutations.fast(execute, quickOwn(url.pathname), quickSettle) : await this.mutations.durable(execute)') && source('./mutation-coordinator.mjs').includes("const nextState = cloneState(snapshot.state, typeof own === 'function' ? own(snapshot.state) : own);"),
    'V13.157 워커: 연습 답 · 다음 · 패스는 빠른 길(그 학생 숙련도만 깊게), 나머지는 전체 깊은 복사');
}
