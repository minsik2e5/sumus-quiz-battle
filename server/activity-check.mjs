// V13.173 학생 활동 기록 · 인기 집계 검사(선생님 전용). release-check가 부른다.
// 규칙: 모드마다 끝나면 한 줄 · 최근 30개만(31번째에 가장 오래된 것이 빠짐) · 답마다 쓰는 빠른 길에는 쓰지 않음 ·
// 학생 응답(publicProfile · bootstrap)에는 없음 · 선생님만 볼 수 있음(학생은 403) · 미리보기 계정 집계 제외 · 주가 바뀌면 카운터 새로 시작.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { emptyState } from './state.mjs';
import { passwordHash, publicProfile } from './auth.mjs';
import { service, allBooks, settleBattle } from './service.mjs';
import { settleParty } from './party.mjs';
import { addBonus } from './rewards.mjs';
import { logActivity, activityOf, activityOverview, ACTIVITY_KEEP, ACTIVITY_MODES } from './activity.mjs';
import { rankingWeek } from './competition.mjs';

const source = path => readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8');
const DAY = 86400000;

export async function runActivityChecks(assert) {
  const now = Date.now();
  const fails = async (fn, status) => { try { await fn(); return false; } catch (err) { return !status || err.status === status; } };

  /* ---------- 고리 로그 · 카운터 ---------- */
  {
    const p = { id: 's', role: 'student' };
    for (let i = 0; i < ACTIVITY_KEEP + 1; i++) logActivity(p, 'practice', `연습 ${i}`, now + i);
    assert(ACTIVITY_KEEP === 30 && p.activity.length === 30 && p.activity[0].t === '연습 1' && p.activity.at(-1).t === `연습 ${ACTIVITY_KEEP}`,
      'V13.173 활동 기록은 최근 30개만: 31번째에서 가장 오래된 것이 빠진다');
    assert(p.usage.counts.practice === 31 && p.usage.today.practice === 31, 'V13.173 횟수 카운터는 30개 제한과 상관없이 계속 센다(인기 집계가 틀리지 않게)');
    assert(activityOf(p)[0].t === `연습 ${ACTIVITY_KEEP}` && !logActivity(p, 'nope', 'x') && !logActivity(null, 'practice', 'x'), 'V13.173 선생님에게는 최근순으로, 모르는 모드 키는 남기지 않는다');
    const long = { id: 'l', role: 'student' }; logActivity(long, 'fish', 'ㄱ'.repeat(200), now);
    assert(long.activity[0].t.length <= 48, 'V13.173 설명은 짧게(상태 크기를 지킨다)');
    const week = rankingWeek(now);
    const q = { id: 'q', role: 'student' };
    logActivity(q, 'fish', '낚시', week.start + 1000); logActivity(q, 'fish', '낚시', week.start + 2000);
    logActivity(q, 'fish', '낚시', week.end + 1000);
    assert(q.usage.week === week.end && q.usage.counts.fish === 1 && q.activity.length === 3, 'V13.173 주가 바뀌면 카운터가 새로 시작한다(활동 기록은 이어진다)');
    const d = { id: 'd', role: 'student' };
    logActivity(d, 'fish', '낚시', now); logActivity(d, 'fish', '낚시', now + DAY);
    assert(d.usage.today.fish === 1 && d.usage.counts.fish >= 1, 'V13.173 하루가 바뀌면 오늘 카운터가 새로 시작한다');
    const t = { id: 't', role: 'teacher' }, pv = { id: 'pv', role: 'student', preview_owner_id: 't' };
    logActivity(t, 'practice', 'x'); logActivity(pv, 'practice', 'x');
    assert(!t.activity && !pv.activity && !pv.usage, 'V13.173 선생님 · 미리보기 계정은 기록하지 않는다');
    assert(!('activity' in publicProfile(p)) && !('usage' in publicProfile(p)) && publicProfile(p).id === 's', 'V13.173 publicProfile에는 활동 기록 · 카운터가 없다');
  }

  /* ---------- 인기 집계 ---------- */
  {
    const mk = (id, extra = {}) => { const p = { id, role: 'student', active: true, ...extra }; logActivity(p, 'fish', '낚시', now); logActivity(p, 'fish', '낚시', now); logActivity(p, 'match', '짝', now); return p; };
    const list = [mk('a'), mk('b'), mk('off', { active: false }), mk('pv', { preview_owner_id: 'T' })];
    list[3].usage = { week: rankingWeek(now).start, counts: { fish: 9 }, day: '', today: {} };
    const o = activityOverview(list, now);
    const fish = o.popularity.find(x => x.k === 'fish'), match = o.popularity.find(x => x.k === 'match');
    assert(fish.week === 4 && fish.week_players === 2 && fish.today === 4 && fish.today_players === 2 && match.week === 2 && o.students === 2 && o.hours.reduce((a, b) => a + b, 0) === 6 && o.hours.length === 24
      && o.popularity.length === Object.keys(ACTIVITY_MODES).length, 'V13.173 모드별 오늘 · 이번 주 횟수와 하는 학생 수, 시간대 24칸. 미리보기 계정 · 비활성 학생은 뺀다');
    const old = { id: 'o', role: 'student', active: true, usage: { week: rankingWeek(now).start - 7 * DAY, counts: { fish: 50 }, day: '2020-01-01', today: { fish: 5 } } };
    assert(activityOverview([old], now).popularity.every(x => x.week === 0 && x.today === 0), 'V13.173 지난 주 · 지난 날 카운터는 이번 집계에 들어가지 않는다');
  }

  /* ---------- 모드마다 끝나면 한 줄(실제 서비스) ---------- */
  const state = emptyState();
  const hash = await passwordHash('QaActivity1!');
  const student = (id, name, extra = {}) => ({ id, username: id, display_name: name, role: 'student', active: true, class_name: '고1A', school_id: 'danwon-high', school: '단원고', division: 'high', password_hash: hash, pets: [{ key: 'dog', first: true, acquired_at: now - 9 * DAY }], avatar_key: 'dog', created_at: now - 9 * DAY, ...extra });
  state.profiles.push(
    { id: 'qa-ac-teacher', username: 'qa_ac_teacher', display_name: '활동 선생님', role: 'teacher', active: true, password_hash: hash, school_ids: ['danwon-high'], division_ids: ['high'], active_division: 'high', active_school_id: 'danwon-high', created_at: now - 9 * DAY },
    student('qa-ac-a', '가람'), student('qa-ac-b', '나무')
  );
  const prof = id => state.profiles.find(p => p.id === id);
  const tokens = {};
  for (const id of ['qa-ac-teacher', 'qa-ac-a', 'qa-ac-b']) tokens[id] = (await service(state, 'POST', '/login', { username: prof(id).username, password: 'QaActivity1!', division: 'high', role: id.includes('teacher') ? 'teacher' : undefined }, null))._cookie;
  const call = (id, method, path, body = {}) => service(state, method, path, body, tokens[id]);
  const last = (id, k) => (prof(id).activity || []).filter(x => !k || x.k === k).at(-1);
  addBonus(prof('qa-ac-a'), { coins: 2000, now });

  await call('qa-ac-a', 'POST', '/attendance/check');
  assert(last('qa-ac-a')?.k === 'attend', 'V13.173 출석하면 한 줄');
  await call('qa-ac-a', 'POST', '/lucky/pull', { bet: 10 });
  assert(last('qa-ac-a')?.k === 'lucky', 'V13.173 행운 뽑기를 하면 한 줄');
  {
    const g = await call('qa-ac-a', 'POST', '/rps/play', { bet: 10, pick: 'rock' });
    const rows = () => (prof('qa-ac-a').activity || []).filter(x => x.k === 'rps').length;
    const mid = rows();
    if (!g.done) await call('qa-ac-a', 'POST', '/rps/cash');
    assert(g.done ? mid === 1 : mid === 0 && rows() === 1, 'V13.173 가위바위보는 판이 끝났을 때만 한 줄(이기고 고르는 중에는 남기지 않는다)');
  }
  const bot = await call('qa-ac-a', 'POST', '/battle/practice/start', { level: 'easy' });
  await call('qa-ac-a', 'POST', '/battle/practice/finish', { id: bot.id, result: 'win', right: 9 });
  assert(last('qa-ac-a', 'robot')?.t.includes('승'), 'V13.173 로보 연습전이 끝나면 승패 한 줄');
  {
    const m = prof('qa-ac-a').bonus.monster ||= {};
    m.live = { id: 'mon-1', stage: 12, level: 'hard', at: now - 600000, scope: 'danwon-high|', codes: [] };
    await call('qa-ac-a', 'POST', '/monster/finish', { id: 'mon-1', result: 'win', right: 99 });
    const row = last('qa-ac-a', 'monster');
    assert(row && row.t.includes('12') && row.t.includes('하드') && row.t.includes('승'), 'V13.173 몬스터전이 끝나면 레벨 · 난이도 · 승패 한 줄');
    const before = prof('qa-ac-a').activity.length;
    await call('qa-ac-a', 'POST', '/monster/finish', { id: 'mon-1', result: 'win', right: 99 });
    assert(prof('qa-ac-a').activity.length === before, 'V13.173 같은 영수증을 다시 보내도 한 줄만');
  }
  // 낚시 · 짝 맞추기 · 사냥은 판 하나가 끝나는 곳에서 한 줄(영수증이 있어 다시 보내도 한 줄).
  const svc = source('./service.mjs'), party = source('./party.mjs');
  for (const k of ['attend', 'lucky', 'rps', 'market', 'robot', 'monster', 'match', 'fish', 'hunt', 'exam', 'practice', 'yacha', 'dungeon']) {
    assert(svc.includes(`logActivity(`) && new RegExp(`logActivity\\([^\\n]*'${k}'`).test(svc.replace("x.run_mode === 'test' ? 'test' : 'practice'", `'practice'`)), `V13.173 ${ACTIVITY_MODES[k].label}: 끝난 결과를 남기는 곳이 있다`);
  }
  assert(/logActivity\([^\n]*'test' : 'practice'/.test(svc) && /logActivity\([^\n]*'classfish'/.test(party) && /logActivity\([^\n]*'treasure'/.test(party), 'V13.173 실전시험 · 보물 사냥 · 반 낚시도 남긴다');
  assert(Object.keys(ACTIVITY_MODES).every(k => svc.includes(`'${k}'`) || party.includes(`'${k}'`)), 'V13.173 목록의 모든 모드가 어딘가에서 기록된다');

  /* ---------- 연습: 답마다(빠른 길)에는 쓰지 않고, 끝났을 때 한 줄 ---------- */
  {
    const range = [...new Set(allBooks(state).filter(b => b.school_id === 'danwon-high').flatMap(b => b.words || []).map(w => String(w.range_code)))][0];
    const before = (prof('qa-ac-b').activity || []).length;
    const x = await call('qa-ac-b', 'POST', '/practice/start', { school: '단원고', range_codes: [range], mode: 'write_meaning', target: 5, run_mode: 'practice' });
    const qid = x.question?.id || x.question_id;
    await call('qa-ac-b', 'POST', `/practice/${x.id}/answer`, { question_id: qid, answer: '틀린답' });
    await call('qa-ac-b', 'POST', `/practice/${x.id}/next`, {});
    assert((prof('qa-ac-b').activity || []).length === before && !prof('qa-ac-b').usage, 'V13.173 연습 중 답 · 다음에는 활동 기록을 쓰지 않는다(빠른 길)');
    await call('qa-ac-b', 'POST', `/practice/${x.id}/finish`, {});
    const row = last('qa-ac-b', 'practice');
    assert(row && /연습 1문제/.test(row.t) && prof('qa-ac-b').usage.counts.practice === 1, 'V13.173 연습이 끝나면 한 줄(문제 수 · 점수)');
    const quickSrc = source('./mutation-coordinator.mjs');
    assert(!quickSrc.includes('logActivity'), 'V13.173 저장 모으기 · 빠른 길 코드는 활동 기록을 건드리지 않는다');
  }

  /* ---------- 야차전 · 파티 · 던전(방이 보고하는 결과) ---------- */
  {
    state.battles.push({ id: 'bt-1', host_id: 'qa-ac-a', guest_id: 'qa-ac-b', status: 'active', stake: 0, created_at: now });
    settleBattle(state, { id: 'bt-1', winner: 'qa-ac-b', reason: 'ko', hp: {}, max_hp: 100 });
    assert(last('qa-ac-a', 'yacha')?.t.includes('패') && last('qa-ac-b', 'yacha')?.t.includes('승') && last('qa-ac-b', 'yacha').t.includes('가람'), 'V13.173 야차전이 끝나면 두 학생 모두 승패 한 줄(상대 이름)');
    const n = prof('qa-ac-a').activity.length;
    settleBattle(state, { id: 'bt-1', winner: 'qa-ac-b', reason: 'ko' });
    assert(prof('qa-ac-a').activity.length === n, 'V13.173 같은 결과를 다시 보고해도 한 줄만');
    state.parties = [{ id: 'pt-1', kind: 'treasure', status: 'active', tickets: { 'qa-ac-a': 't', 'qa-ac-b': 't' } }, { id: 'pt-2', kind: 'fish', status: 'active', tickets: { 'qa-ac-a': 't' } }];
    settleParty(state, { id: 'pt-1', result: { players: [{ id: 'qa-ac-a', right: 5, rank: 2 }, { id: 'qa-ac-b', right: 9, rank: 1 }] } }, { now });
    settleParty(state, { id: 'pt-2', result: { players: [{ id: 'qa-ac-a', right: 5, rank: 1 }] } }, { now });
    assert(last('qa-ac-a', 'treasure')?.t.includes('2등') && last('qa-ac-b', 'treasure')?.t.includes('1등') && last('qa-ac-a', 'classfish'), 'V13.173 보물 사냥 · 반 낚시가 끝나면 참가 학생마다 한 줄');
  }

  /* ---------- 학생 응답에는 없고, 선생님만 본다 ---------- */
  {
    const boot = await call('qa-ac-a', 'GET', '/bootstrap');
    const mark = JSON.stringify(boot);
    assert(!('activity' in boot.profile) && !('usage' in boot.profile) && !mark.includes('"activity"') && !mark.includes('"usage"'), 'V13.173 학생 화면(bootstrap)에는 활동 기록 · 카운터가 없다');
    const tboot = await call('qa-ac-teacher', 'GET', '/bootstrap');
    assert(tboot.profiles.length >= 2 && tboot.profiles.every(x => !('activity' in x) && !('usage' in x)) && !JSON.stringify(tboot).includes('"activity"'), 'V13.173 선생님 학생 목록 응답에도 활동 기록을 통째로 싣지 않는다(응답 크기)');
    assert(await fails(() => call('qa-ac-a', 'GET', '/teacher/activity'), 403) && await fails(() => call('qa-ac-a', 'GET', '/teacher/activity/qa-ac-b'), 403),
      'V13.173 활동 기록 · 인기 집계는 선생님만(학생이 부르면 403)');
    assert(await fails(() => call('qa-ac-teacher', 'POST', '/teacher/activity'), 405), 'V13.173 활동 기록 경로는 읽기 전용');
    const rev = JSON.stringify(state);
    const overview = (await call('qa-ac-teacher', 'GET', '/teacher/activity')).overview;
    const one = await call('qa-ac-teacher', 'GET', '/teacher/activity/qa-ac-a');
    assert(rev === JSON.stringify(state) && overview.popularity.find(x => x.k === 'practice').week_players === 1 && one.activity[0].at >= one.activity.at(-1).at && one.activity.length === prof('qa-ac-a').activity.length,
      'V13.173 선생님은 학생 한 명의 기록(최근순)과 모드별 인기를 받고, 읽기만으로 저장이 바뀌지 않는다');
    assert(await fails(() => call('qa-ac-teacher', 'GET', '/teacher/activity/nobody'), 404), 'V13.173 없는 학생 · 다른 학교 학생은 404');
  }

  /* ---------- 화면 ---------- */
  {
    const mod = source('../public/modules/teacher-activity.js'), t = source('../public/modules/teacher.js'), e = source('../public/teacher-enhancements.js'), build = source('./build-assets.mjs');
    assert(mod.includes("api('/teacher/activity')") && mod.includes("'/teacher/activity/'") && mod.includes('이 기능이 켜진 뒤부터 쌓여요') && mod.includes('act-hours') && mod.includes('act-cols') && mod.includes('data-act-range')
      && t.includes('activityFold(d)') && e.includes('loadStudentActivity(id,') && build.includes('"v13173.css"') && source('../public/v13173.css').includes('@media (max-width:720px)'),
      'V13.173 선생님 화면: 대시보드의 접는 "학생 활동 · 인기" 카드(인기 막대 · 레벨 분포 · 접속 시간대)와 학생별 "오늘 뭘 했나", "켜진 뒤부터 쌓여요" 안내, 폰 폭 CSS');
    const clientKeys = [...mod.match(/ACT_MODES = \{([\s\S]*?)\n\};/)[1].matchAll(/(\w+): \['/g)].map(m => m[1]).sort().join();
    assert(clientKeys === Object.keys(ACTIVITY_MODES).sort().join(), 'V13.173 화면의 모드 목록이 서버 목록과 같다');
  }
}
