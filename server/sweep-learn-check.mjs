// V13.168 학습 점검(연습 · 실전시험 · 선생님 시험 · 이의제기)에서 고친 것.
// 1) 뜻 이의제기: 점수에 들어가지 않는 오답 다시 풀기 답은 받지 않는다(맞힌 수가 문제 수를 넘고 경험치가 또 올랐다).
//    실전시험은 끝나기 전에 이의제기할 수 없다(풀던 중 맞고 틀림을 알 수 있었다).
// 2) 3일 방치로 닫힌 연습: 마지막으로 푼 때의 기록, 코인 · 미끼 · 공 없음(v13.73). 예전: 닫는 날 코인 · 오늘 첫 학습 · 공부한 날.
// 3) 선생님 시험 수정: 마감을 시작 시간보다 앞으로 바꿀 수 없다.
// 시각은 모두 고정한다(요일 · 시간과 상관없이 같은 결과).
import { emptyState } from './state.mjs';
import { passwordHash } from './auth.mjs';
import { service, allBooks, sweep } from './service.mjs';
import { dayKey } from '../public/modules/core.js';

const DAY = 86400000;

export async function runSweepLearnChecks(assert, expectStatus) {
  const realNow = Date.now;
  const T0 = Date.parse('2026-10-05T03:00:00Z'); // 월요일 12:00 KST
  let now = T0;
  Date.now = () => now;
  try {
    const state = emptyState();
    const hash = await passwordHash('QaSweepLearn1!');
    const student = id => ({ id, username: id, display_name: id, role: 'student', active: true, class_name: '고1A', school_id: 'danwon-high', school: '단원고', division: 'high', password_hash: hash, pets: [{ key: 'dog', first: true, acquired_at: T0 - 9 * DAY }], avatar_key: 'dog', created_at: T0 - 9 * DAY });
    state.profiles.push(
      { id: 'qa-sl-t', username: 'qa_sl_t', display_name: '학습 선생님', role: 'teacher', active: true, password_hash: hash, school_ids: ['danwon-high'], division_ids: ['high'], active_division: 'high', active_school_id: 'danwon-high', created_at: T0 - 9 * DAY },
      student('qa-sl-a'), student('qa-sl-b'), student('qa-sl-c')
    );
    const tokens = {};
    for (const u of ['qa_sl_t', 'qa-sl-a', 'qa-sl-b', 'qa-sl-c']) tokens[u] = (await service(state, 'POST', '/login', { username: u, password: 'QaSweepLearn1!', division: 'high', role: u === 'qa_sl_t' ? 'teacher' : undefined }, null))._cookie;
    const call = (u, method, path, body = {}) => service(state, method, path, body, tokens[u]);
    const meaningOf = wid => allBooks(state).flatMap(b => b.words || []).find(w => w.id === wid)?.meaning;

    /* ---------- 1. 이의제기: 다시 풀기 답 · 끝나지 않은 실전시험 ---------- */
    await call('qa-sl-a', 'POST', '/practice/start', { mode: 'write_meaning', range_codes: ['24'], target: 5 });
    const x = state.practices.find(p => p.student_id === 'qa-sl-a' && !p.finished);
    let scoredWrong = null, retryWrong = null;
    for (let i = 0; i < 20 && !x.finished && !retryWrong; i++) {
      const qid = x.question_id, retry = x.question_is_retry, wrong = i === 0 || retry;
      now += 3000;
      await call('qa-sl-a', 'POST', `/practice/${x.id}/answer`, { question_id: qid, answer: wrong ? '모르는 뜻' + i : meaningOf(x.question.word_id) });
      if (wrong && !retry) scoredWrong = qid;
      if (retry) { retryWrong = qid; break; }
      await call('qa-sl-a', 'POST', `/practice/${x.id}/next`, {});
    }
    assert(scoredWrong && retryWrong && x.responses[retryWrong]?.feedback?.can_dispute === false, 'V13.168 (준비) 점수 문제 오답 하나와 그 단어의 다시 풀기 오답 하나');
    await expectStatus(409, () => call('qa-sl-a', 'POST', '/meaning-disputes', { source_type: 'practice', source_id: x.id, question_id: retryWrong }), 'V13.168 점수에 들어가지 않는 다시 풀기 오답은 이의제기할 수 없다');
    const d1 = await call('qa-sl-a', 'POST', '/meaning-disputes', { source_type: 'practice', source_id: x.id, question_id: scoredWrong });
    await call('qa_sl_t', 'PATCH', `/meaning-disputes/${d1.id}/resolve`, { action: 'approve_once' });
    assert(d1.status === 'approved_once' && x.score_correct <= x.score_total && state.meaningDisputes.length === 1, 'V13.168 점수 문제 오답 이의제기는 그대로 받고, 맞힌 수가 푼 수를 넘지 않는다');

    await call('qa-sl-b', 'POST', '/practice/start', { mode: 'write_meaning', run_mode: 'test', range_codes: ['24'], target: 5 });
    const t = state.practices.find(p => p.student_id === 'qa-sl-b' && !p.finished);
    const firstTestQ = t.question_id;
    now += 3000;
    await call('qa-sl-b', 'POST', `/practice/${t.id}/answer`, { question_id: firstTestQ, answer: '모르는 뜻' });
    await expectStatus(409, () => call('qa-sl-b', 'POST', '/meaning-disputes', { source_type: 'practice', source_id: t.id, question_id: firstTestQ }), 'V13.168 실전시험은 끝나기 전에 이의제기할 수 없다(맞고 틀림이 드러난다)');
    for (let i = 0; i < 10 && !t.finished; i++) { now += 3000; await call('qa-sl-b', 'POST', `/practice/${t.id}/answer`, { question_id: t.question_id, answer: meaningOf(t.question.word_id) }); }
    const afterTest = await call('qa-sl-b', 'POST', '/meaning-disputes', { source_type: 'practice', source_id: t.id, question_id: firstTestQ });
    assert(t.finished && afterTest.id && afterTest.status === 'pending', 'V13.168 실전시험이 끝난 뒤에는 오답 이의제기를 받는다');

    /* ---------- 2. 3일 방치로 닫힌 연습 ---------- */
    now = T0 + 3600000;
    await call('qa-sl-c', 'POST', '/practice/start', { mode: 'eng2mean', range_codes: ['24'], target: 10 });
    const s = state.practices.find(p => p.student_id === 'qa-sl-c' && !p.finished);
    for (let i = 0; i < 40 && !s.finished && Number(s.score_total || 0) < 10; i++) {
      now += 4000;
      const lastScored = Number(s.score_total || 0) === 9 && !s.question_is_retry;
      await call('qa-sl-c', 'POST', `/practice/${s.id}/answer`, { question_id: s.question_id, answer: lastScored ? '모르는 뜻' : meaningOf(s.question.word_id) });
      await call('qa-sl-c', 'POST', `/practice/${s.id}/next`, {});
    }
    const lastAnswerAt = Math.max(...s.answer_records.map(r => r.at));
    assert(!s.finished && s.score_total === 10 && s.retry.length + (s.question_is_retry ? 1 : 0) > 0, 'V13.168 (준비) 정해진 10문제를 다 풀고 오답 다시 풀기에서 멈춘 연습');
    now = T0 + 4 * DAY; // 금요일
    sweep(state, now);
    const closed = state.sessions.find(r => r.id === s.id);
    const c = state.profiles.find(p => p.id === 'qa-sl-c');
    assert(s.finished && closed && closed.created_at === lastAnswerAt && dayKey(closed.created_at) === dayKey(T0) && closed.answered_count === 10,
      'V13.168 3일 방치로 닫힌 연습은 마지막으로 푼 때의 기록이다(닫는 날이 공부한 날이 되지 않는다)');
    assert(closed.reward_points === 0 && !(closed.reward_breakdown || []).length && !s.bait && !s.ball && !Number(c.reel?.bait || 0),
      'V13.168 3일 방치로 닫힌 연습은 코인 · 오늘 첫 학습 · 미끼 · 공이 없다(v13.73)');

    /* ---------- 3. 선생님 시험: 마감은 시작보다 뒤 ---------- */
    now = T0 + 5 * DAY;
    const exam = await call('qa_sl_t', 'POST', '/exams', { school_id: 'danwon-high', class_name: '고1A', title: '점검 시험', range_codes: ['24'], exam_type: 'eng2mean_mc', question_count: 5, duration_sec: 600, available_at: now + DAY, due_at: now + 3 * DAY, passing_score: 60, max_attempts: 1 });
    await expectStatus(400, () => call('qa_sl_t', 'PATCH', `/exams/${exam.id}`, { due_at: now + DAY / 2 }), 'V13.168 시험 마감을 시작 시간보다 앞으로 바꿀 수 없다');
    const moved = await call('qa_sl_t', 'PATCH', `/exams/${exam.id}`, { available_at: now + DAY / 4, due_at: now + DAY / 2 });
    const toggled = await call('qa_sl_t', 'PATCH', `/exams/${exam.id}`, { active: false });
    assert(moved.due_at === now + DAY / 2 && moved.available_at === now + DAY / 4 && toggled.active === false, 'V13.168 시작과 마감을 함께 앞당기기 · 배정만 바꾸기는 그대로 된다');
  } finally {
    Date.now = realNow;
  }
}
