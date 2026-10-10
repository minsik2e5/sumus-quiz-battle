// V13.128 던전 부하 시험(check:load, docs/dungeon-design.md 9번). 메인 상태 객체는 하나라서 모든 변경이
// 한 줄로 처리된다(server/mutation-coordinator.mjs: 변경마다 상태 전체 복사 + 저장할 때 상태 전체 JSON).
// 그래서 운영에 가까운 크기(약 2.4MB)로 상태를 부풀린 뒤 ① 방 만들기 · 참가가 한꺼번에 몰릴 때
// ② 모든 파티의 결과 보고가 같은 순간에 몰릴 때(재시도로 같은 보고가 두 번 오는 것 포함)를 재고, 그동안
// 다른 학생의 평범한 요청(연습 답)이 얼마나 늦어지는지 함께 본다.
// 여기 숫자는 이 컴퓨터의 Node에서 잰 값이다. Cloudflare Durable Object의 실제 시간과 같지 않으니
// 운영에서 Server-Timing / [slow-mutation] 로그로 다시 확인한다(안전하다고 단정하지 않는다).
import { performance } from 'node:perf_hooks';
import { emptyState } from './state.mjs';
import { hashToken } from './auth.mjs';
import { allBooks, service, settleDungeon } from './service.mjs';
import { createMutationCoordinator, NO_MUTATION } from './mutation-coordinator.mjs';
import { createDungeonReporter } from './dungeon-reports.mjs';

const assert = (condition, message) => { if (!condition) throw new Error('[dungeon-load] FAIL · ' + message); };
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const stats = list => { const s = list.slice().sort((a, b) => a - b); const at = q => Math.round(s[Math.min(s.length - 1, Math.floor(q * s.length))] || 0); return { p50: at(.5), p95: at(.95), max: Math.round(s.at(-1) || 0) }; };
const fmt = x => `p50 ${x.p50}ms · p95 ${x.p95}ms · max ${x.max}ms`;

export async function runDungeonLoadCheck({ parties = 40, targetKB = 2400, others = 40 } = {}) {
  const state = emptyState();
  const SCHOOLS = [['gangseo-high', '강서고'], ['danwon-high', '단원고']];
  const now = Date.now();
  const tokens = {};
  const addStudent = (id, i, cls = '고1A') => {
    const [school, name] = SCHOOLS[i % 2];
    state.profiles.push({ id, username: id, display_name: '부하' + i, role: 'student', active: true, class_name: cls, school_id: school, school: name, division: 'high', pets: [{ key: ['dog', 'cat', 'fox', 'penguin'][i % 4], form: 1 }], avatar_key: 'dog', password_hash: 'x', created_at: now });
    tokens[id] = 'load-token-' + id;
    state.tokens.push({ hash: hashToken(tokens[id]), user_id: id, expires_at: now + 86400000 });
  };
  for (let i = 0; i < parties * 3; i++) addStudent(`dg-load-${i}`, i);
  for (let i = 0; i < others; i++) addStudent(`dg-other-${i}`, i);
  // 운영 상태 크기에 맞춰 지난 연습 기록을 채운다(전체 복사 · 저장 비용이 상태 크기에 비례한다).
  const filler = i => ({ id: 'fill-' + i, student_id: `dg-other-${i % others}`, division: 'high', school_id: 'gangseo-high', school: '강서고', total: 30, correct: 24, xp: 30, reward_points: 3, mode: 'eng2mean', range_codes: ['24'], created_at: now - 86400000 * (1 + (i % 60)), answer_records: Array.from({ length: 6 }, (_, k) => ({ word_id: 'w' + k, correct: k % 3 !== 0, ms: 2100 })) });
  for (let i = 0; JSON.stringify(state).length < targetKB * 1024; i++) for (let k = 0; k < 200; k++) state.sessions.push(filler(i * 200 + k));
  const stateKB = Math.round(JSON.stringify(state).length / 1024);

  // 저장: 로컬 우선 저장소처럼 상태 전체를 JSON으로 만들고 디스크 쓰기 시간을 조금 기다린다.
  let writes = 0;
  const repo = { async read() { return { state, revision: 0 }; }, async commit(next) { JSON.stringify(next); await sleep(3); writes++; } };
  const coordinator = createMutationCoordinator(repo, { state: structuredClone(state), revision: 0 }, { flushDelay: 500, retryDelay: 2000 });
  const timed = async fn => { const t = performance.now(); const out = await fn(); return { out, ms: performance.now() - t }; };
  const call = (who, method, path, body = {}) => method === 'GET' ? service(coordinator.current().state, method, path, body, tokens[who]) : coordinator.durable(s => service(s, method, path, body, tokens[who]));

  const words = allBooks(state).filter(b => b.school_id === 'gangseo-high').flatMap(b => b.words || []);
  const range = [...new Set(words.map(w => String(w.range_code)))][0];
  const dRange = [...new Set(allBooks(state).filter(b => b.school_id === 'danwon-high').flatMap(b => b.words || []).map(w => String(w.range_code)))][0];
  const rangeFor = i => [i % 2 ? dRange : range];

  // 다른 학생들의 연습(평소 요청)을 미리 시작해 둔다.
  const practices = [];
  for (let i = 0; i < others; i++) practices.push(await call(`dg-other-${i}`, 'POST', '/practice/start', { school: i % 2 ? '단원고' : '강서고', range_codes: rangeFor(i), mode: 'eng2mean', target: 30, run_mode: 'practice' }));
  const answerOnce = async i => {
    const v = practices[i];
    const res = await call(`dg-other-${i}`, 'POST', `/practice/${v.id}/answer`, { question_id: v.question_id, answer: v.question?.options?.[0] || 'x', prefetch_next: true });
    practices[i] = res.prefetched_next || res;
  };
  // 기준: 몰림이 없을 때 연습 답 하나의 시간.
  const baseline = [];
  for (let i = 0; i < others; i++) baseline.push((await timed(() => answerOnce(i))).ms);

  /* ---------- ① 방 만들기 · 참가가 한꺼번에 ---------- */
  const hosts = Array.from({ length: parties }, (_, p) => `dg-load-${p * 3}`);
  const created = await Promise.all(hosts.map((h, p) => timed(() => call(h, 'POST', '/dungeon/rooms', { cut: 'c3', range_codes: rangeFor(p * 3) }))));
  assert(created.every(x => x.out.room?.code && x.out._dungeon?.host?.questions?.length >= 120), '모든 방장이 방을 만든다');
  const joins = await Promise.all(Array.from({ length: parties * 2 }, (_, k) => {
    const p = Math.floor(k / 2), i = p * 3 + 1 + (k % 2);
    return timed(() => call(`dg-load-${i}`, 'POST', '/dungeon/join', { code: created[p].out.room.code, range_codes: rangeFor(i) }));
  }));
  assert(joins.every(x => x.out._dungeon?.player?.questions?.length >= 120), '모든 친구가 들어간다');

  /* ---------- ② 결과 보고가 같은 순간에(같은 보고 두 번씩) + 그동안 다른 학생의 연습 답 ---------- */
  const reportOf = (p, cleared) => {
    const id = created[p].out.room.id, rid = `dungeon:${id}:${now}`;
    return { id, report_id: rid, result: { cleared, cut: 'c3', grade: '고1', size: 3, floor: 6, reached: cleared ? 6 : 4, boss: cleared, time_ms: 470000 + p * 1000, record: true, no_down: false, report_id: rid,
      players: [0, 1, 2].map(k => ({ id: `dg-load-${p * 3 + k}`, name: '부하', bot: false, out: false, right: 120 + k, wrong: 10, timeouts: 4, answered: 134 + k, accuracy: .9, share: .33, best_combo: 14, downs: 1, reward: true })) } };
  };
  const reports = Array.from({ length: parties }, (_, p) => reportOf(p, p % 2 === 0));
  await coordinator.flush();
  const snapshot = structuredClone(coordinator.current().state), views = practices.slice();
  // 같은 상태에서 두 번: 보고를 하나씩 처리(예전 야차전 방식)할 때와 모아서 처리(워커가 쓰는 방식)할 때.
  async function burst(batched) {
    const c = createMutationCoordinator(repo, { state: structuredClone(snapshot), revision: 0 }, { flushDelay: 500, retryDelay: 2000 });
    const mine = views.slice();
    const answer = async i => { const v = mine[i]; const res = await c.durable(st => service(st, 'POST', `/practice/${v.id}/answer`, { question_id: v.question_id, answer: v.question?.options?.[0] || 'x', prefetch_next: true }, tokens[`dg-other-${i}`])); mine[i] = res.prefetched_next || res; };
    let settled = 0;
    const reporter = createDungeonReporter(c);
    const one = body => timed(async () => {
      if (batched) { await reporter(body); return; }
      await c.durable(st => settleDungeon(st, body) ? (settled++, { ok: true }) : NO_MUTATION);
    });
    const writesBefore = writes, t0 = performance.now();
    const [reportTimes, during] = await Promise.all([
      Promise.all([...reports, ...reports].map(one)),
      Promise.all(Array.from({ length: others }, (_, i) => sleep(i % 5).then(() => timed(() => answer(i)))))
    ]);
    const ms = Math.round(performance.now() - t0);
    await c.flush();
    const final = c.current().state;
    const finished = final.dungeons.filter(d => d.status === 'finished');
    assert(finished.length === parties && (batched || settled === parties), `보고 ${parties * 2}번(재시도 포함) → 방마다 정확히 한 번 처리 (${batched ? '모아서' : '하나씩'}: 끝난 방 ${finished.length})`);
    assert(finished.every(d => d.result.players.length === 3), '결과에 파티원 3명');
    assert(final.profiles.filter(p => p.dungeon_cleared?.includes('c3')).length === Math.ceil(parties / 2) * 3, '깬 파티의 학생만 다음 단계가 열린다');
    await c.close();
    return { report: stats(reportTimes.map(x => x.ms)), during: stats(during.map(x => x.ms)), ms, writes: writes - writesBefore };
  }
  const single = await burst(false), grouped = await burst(true);
  const r = { stateKB, parties, create: stats(created.map(x => x.ms)), join: stats(joins.map(x => x.ms)), baseline: stats(baseline), single, grouped };
  // 회귀를 잡는 한계(이 컴퓨터 기준): 모아서 처리하면 보고가 몰려도 하나씩보다 확실히 빨라야 하고, 다른 학생의
  // 요청이 몇 초씩 밀리지 않아야 한다. 운영 판단은 아래 숫자와 운영 로그(Server-Timing, [slow-mutation])로 한다.
  assert(grouped.ms < single.ms, `결과 보고를 모아서 처리하면 몰려도 더 빨리 끝난다 (하나씩 ${single.ms}ms → 모아서 ${grouped.ms}ms)`);
  console.log(`[dungeon-load] PASS · state=${stateKB}KB parties=${parties} (학생 ${parties * 3}명) · 다른 학생 ${others}명
  방 만들기 ${parties}개 동시: ${fmt(r.create)}
  참가 ${parties * 2}명 동시: ${fmt(r.join)}
  다른 학생 연습 답(평소): ${fmt(r.baseline)}
  결과 보고 ${parties * 2}번 동시(재시도 중복 ${parties}) + 연습 답 ${others}개
    하나씩: 보고 ${fmt(single.report)} · 연습 답 ${fmt(single.during)} · 전체 ${single.ms}ms · 저장 ${single.writes}번
    모아서: 보고 ${fmt(grouped.report)} · 연습 답 ${fmt(grouped.during)} · 전체 ${grouped.ms}ms · 저장 ${grouped.writes}번`);
  await coordinator.close();
  return r;
}
