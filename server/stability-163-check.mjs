// V13.163 서버 안정화 점검에서 고친 것 검사: 실전시험 마감 유예 · 재응시 보상 한 번 · 답마다 기록 훑기 없음 ·
// 펫 없는 교환소 500 · 보물 사냥 다시 들어오기/미리보기 계정 · 비공개 학생 이름 · 저장 실패 뒤 빠른 길 · 저장 사본 한 벌.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { emptyState } from './state.mjs';
import { passwordHash } from './auth.mjs';
import { service, sweep, allBooks, EXAM_SUBMIT_GRACE_MS } from './service.mjs';
import { examAdmin } from './exam-admin.mjs';
import { undoParty } from './party.mjs';
import { createMutationCoordinator } from './mutation-coordinator.mjs';
import { createStorageMock } from './storage-mock.mjs';
import { createLocalRepository } from '../cloudflare/local-first.mjs';

const source = path => readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8');
const status = async fn => { try { await fn(); return 200; } catch (e) { return e.status || 500; } };
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const DAY = 86400000;

async function setup() {
  const state = emptyState(), now = Date.now(), hash = await passwordHash('QaStab163!');
  const student = (id, name, extra = {}) => ({ id, username: id, display_name: name, role: 'student', active: true, class_name: '고1A', school_id: 'danwon-high', school: '단원고', division: 'high', password_hash: hash, pets: [{ key: 'dog', first: true, acquired_at: now - 9 * DAY }], avatar_key: 'dog', created_at: now - 9 * DAY, ...extra });
  state.profiles.push(
    { id: 'qa-st-t', username: 'qa_st_t', display_name: '선생님', role: 'teacher', active: true, password_hash: hash, school_ids: ['danwon-high'], division_ids: ['high'], active_division: 'high', active_school_id: 'danwon-high', created_at: now - 9 * DAY },
    student('qa-st-a', '가람'), student('qa-st-b', '나무'), student('qa-st-c', '다솜'), student('qa-st-nopet', '새싹', { pets: [], avatar_key: null }),
    student('qa-st-pv', '미리보기', { preview_owner_id: 'qa-st-t' })
  );
  const tokens = {};
  for (const p of state.profiles) tokens[p.id] = (await service(state, 'POST', '/login', { username: p.username, password: 'QaStab163!', division: 'high', role: p.role === 'teacher' ? 'teacher' : undefined }, null))._cookie;
  const call = (id, method, path, body = {}) => service(state, method, path, body, tokens[id]);
  return { state, tokens, call, now };
}

export async function runStability163Checks(assert) {
  const { state, tokens, call, now } = await setup();
  const range = [...new Set(allBooks(state).filter(b => b.school_id === 'danwon-high').flatMap(b => b.words || []).map(w => String(w.range_code)))][0];
  const exam = id => ({ id, title: 'QA', division: 'high', school_id: 'danwon-high', school: '단원고', class_name: '고1A', active: true, available_at: now - 1000, due_at: now + 3600000, max_attempts: 1, range_codes: [range], question_count: 5, duration_sec: 600, exam_type: 'eng2mean_mc', passing_score: 60 });

  // 1. 실전시험: 마감 직후(유예 안) 온 마지막 답은 받고, 유예가 지난 답은 받지 않는다.
  {
    state.exams.push(exam('qa-e1'));
    await call('qa-st-a', 'POST', '/exams/start', { exam_id: 'qa-e1' });
    const a = state.examAttempts.find(x => x.exam_id === 'qa-e1');
    a.deadline = Date.now() - 300;
    sweep(state);
    const last = a.questions[4].options[0];
    await call('qa-st-a', 'POST', `/attempts/${a.id}/submit`, { lease: a.lease, revision: a.revision, answers: { 4: last } });
    assert(a.status === 'submitted' && a.answers[4] === last && !a.auto_submitted, 'V13.163 실전시험 마감 직후(유예 5초 안) 온 마지막 답은 정리가 먼저 닫지 않고 받는다');
    state.exams.push(exam('qa-e2'));
    await call('qa-st-b', 'POST', '/exams/start', { exam_id: 'qa-e2' });
    const b = state.examAttempts.find(x => x.exam_id === 'qa-e2');
    b.deadline = Date.now() - EXAM_SUBMIT_GRACE_MS - 60000;
    await call('qa-st-b', 'POST', `/attempts/${b.id}/submit`, { lease: b.lease, revision: b.revision, answers: { 0: b.questions[0].options[0] } });
    assert(b.status === 'submitted' && b.auto_submitted && b.answers[0] === undefined, 'V13.163 유예까지 지난 답은 받지 않고 저장된 답으로 닫는다(정리가 아직 안 돌았어도)');
  }
  // 2. 재응시를 줘도 시험 보상(경험치 · 코인)은 처음 한 번만.
  {
    state.exams.push(exam('qa-e3'));
    const bonus = () => (state.profiles.find(x => x.id === 'qa-st-c').bonus?.log || []).reduce((n, r) => n + Number(r.c || 0), 0);
    const rewards = [];
    for (let round = 0; round < 3; round++) {
      const { attempt } = await call('qa-st-c', 'POST', '/exams/start', { exam_id: 'qa-e3' });
      const a = state.examAttempts.find(x => x.id === attempt.id);
      await call('qa-st-c', 'POST', `/attempts/${a.id}/submit`, { lease: a.lease, revision: a.revision, answers: Object.fromEntries(a.questions.map((q, i) => [i, q.options[0]])) });
      rewards.push(a.reward ? 1 : 0);
      await examAdmin(state, 'POST', '/admin/exams/qa-e3/retry', { student_id: 'qa-st-c' }, tokens['qa-st-t']);
    }
    assert(rewards.join() === '1,0,0' && bonus() > 0 && bonus() <= 10, 'V13.163 재응시를 줘도 시험 보상은 처음 한 번만(예전: 재응시마다 다시 지급)');
  }
  // 3. 연습 중 답 · 다음 응답은 지난 기록 전체로 성장 값을 다시 계산하지 않는다(끝났을 때만).
  assert(source('./service.mjs').includes('stats: x.finished ? growthFor(xpSessions(state, x.student_id)) : undefined'), 'V13.163 연습 중에는 성장 값(stats)을 계산하지 않는다(답마다 기록 전체를 두 번 훑었다)');
  // 4. 첫 펫이 없는 학생의 교환소: 500이 아니라 안내(409).
  assert(await status(() => call('qa-st-nopet', 'POST', '/hunt/exchange', { item: 'egg' })) === 409 && await status(() => call('qa-st-nopet', 'POST', '/reel/exchange', { item: 'epic_egg' })) === 409, 'V13.163 첫 펫이 없는 학생이 사냥 · 낚시 교환소에서 알을 바꾸면 500이 아니라 409');
  // 5. 보물 사냥: 미리보기 계정은 못 들어오고, 이미 놀던 학생이 끝난 방에 다시 들어와도 참가표는 남는다.
  {
    const made = await call('qa-st-t', 'POST', '/teacher/party', { kind: 'treasure', class_name: '고1A', minutes: 5, range_codes: [range] });
    assert(await status(() => call('qa-st-pv', 'POST', '/party/join', { code: made.party.code })) === 409, 'V13.163 교사 미리보기 계정은 교실 게임에 들어갈 수 없다(순위 · 코인을 가져갔다)');
    const first = await call('qa-st-a', 'POST', '/party/join', { code: made.party.code });
    const again = await call('qa-st-a', 'POST', '/party/join', { code: made.party.code });
    const party = state.parties.find(x => x.id === made.party.id);
    assert(first._parties[0].fresh === true && again._parties[0].fresh === false && again.room.ticket === first.room.ticket, 'V13.163 다시 들어오면 같은 참가표 · 새 표가 아님(fresh:false)');
    undoParty(state, again._parties[0]);
    assert(party.tickets['qa-st-a'] === first.room.ticket, 'V13.163 끝난 방이 다시 들어오기를 거절해도 이미 놀던 학생의 참가표는 지우지 않는다(정산 전 보상을 잃었다)');
    undoParty(state, first._parties[0]);
    assert(!party.tickets['qa-st-a'], 'V13.163 새로 만든 참가표는 방이 거절하면 그대로 되돌린다');
  }
  // 6. 순위를 비공개로 한 학생: 가위바위보 명예의 전당 · 반 대항전 TV에서도 이름을 숨긴다.
  {
    const shy = state.profiles.find(x => x.id === 'qa-st-c');
    shy.ranking_public = false;
    shy.rps = { log: [{ at: Date.now() - 1000, wins: 3, bet: 10 }] };
    state.sessions.push({ id: 'qa-st-s1', student_id: 'qa-st-c', created_at: Date.now() - 1000, total: 10, correct: 10, xp: 50, answered_count: 10 });
    const hall = (await call('qa-st-a', 'GET', '/bootstrap')).rewards.rps.hall;
    const mine = (await call('qa-st-c', 'GET', '/bootstrap')).rewards.rps.hall;
    assert(hall.length && hall.every(x => x.name === '비공개 학생') && mine.some(x => x.me && x.name === '다솜'), 'V13.163 비공개 학생은 가위바위보 명예의 전당에서 이름이 숨는다(자기 줄은 그대로)');
    const tv = await call('qa-st-t', 'POST', '/teacher/class-league/tv', {});
    const league = await service(state, 'GET', '/tv/classes', { token: tv.token }, null);
    const names = league.league.classes.flatMap(c => c.top.map(x => x.name));
    assert(names.length && !names.includes('다솜') && names.includes('비공개 학생'), 'V13.163 비공개 학생은 반 대항전 TV(로그인 없는 화면) top 3에서도 이름이 숨는다');
  }
  // 7. 저장: 뒤 저장이 한 번 실패해도(운영처럼 rollbackOnFailure) 저장이 다시 되면 빠른 길로 돌아온다.
  {
    const storage = createStorageMock();
    const local = createLocalRepository(storage, { log: { warn() {}, error() {} } });
    local.adoptRemote({ n: 0, list: [{ id: 'x', v: 'same' }] }, 1);
    const initial = await local.read();
    let commits = 0;
    const repo = { read: () => local.read(), refresh: () => local.refresh(), async commit(s, r) { commits++; return local.commit(s, r); } };
    const co = createMutationCoordinator(repo, initial, { flushDelay: 50, retryDelay: 1000, rollbackOnFailure: true, groupMs: () => 0, onError() {} });
    const bump = s => { s.n += 1; return { n: s.n }; };
    storage.failNextWrite();
    await co.fast(bump);
    await sleep(200);
    await co.fast(bump);
    const before = commits;
    await co.fast(bump);
    assert(commits === before, 'V13.163 저장이 한 번 실패한 뒤에도 저장이 다시 되면 빠른 길(답 먼저)로 돌아온다(예전: 다시 시작할 때까지 답마다 저장을 기다림)');
    await co.close();
    const latest = local.latest();
    assert(JSON.parse(latest.json).n === co.current().state.n && latest.parts.size > 0, 'V13.163 최신 저장본은 조각에서 다시 만들어도 같다');
  }
  assert(source('../cloudflare/local-first.mjs').includes("latest = makeLatest(nextMeta.version, new Map([...texts].filter(([key]) => !key.startsWith('#'))));"), 'V13.163 최신 저장본은 디스크 조각(texts)을 같이 쓰고 상태 객체를 붙잡지 않는다(9MB 한 벌 덜 들고 있음)');
  assert(/replace\(state, revision\)[\s\S]{0,400}generation \+= 1/.test(source('./mutation-coordinator.mjs')), 'V13.163 상태를 통째로 바꿀 때 세대를 바꿔 기다리던 저장이 끝없이 돌지 않는다');
}
