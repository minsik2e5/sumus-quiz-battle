// Release checks for V13.142 학습 보상 이벤트: 선생님이 기간·대상을 정해 학습(연습·시험) 코인과 경험치를
// 1.5배·2배로 준다. 겹치는 이벤트는 거부, 선생님만 만들기, 서버 시간 기준, 끝나면 저절로 꺼짐,
// 다른 콘텐츠(몬스터전·던전·야차전·놀이터·출석·칭호)에는 걸리지 않음.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { emptyState, migrateState } from './state.mjs';
import { passwordHash } from './auth.mjs';
import { service } from './service.mjs';
import { meaningAccepted } from '../public/modules/core.js';
import { STUDY_COINS } from '../public/modules/rewards.js';
import { parseKst, kstInput, eventCoins, eventXp, eventsOverlap, activeEventFor, EVENT_MULTIPLIERS } from './reward-events.mjs';

const source = path => readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8');
const HOUR = 3600000, DAY = 24 * HOUR;

export async function runRewardEventChecks(assert, expectStatus) {
  /* ---------- rules (pure) ---------- */
  assert(parseKst('2026-10-14T18:00') === Date.parse('2026-10-14T09:00:00Z') && Number.isNaN(parseKst('2026-02-30T10:00')) && Number.isNaN(parseKst('2026-10-14 18:00')) && kstInput(Date.parse('2026-10-14T09:00:00Z')) === '2026-10-14T18:00', 'V13.142 the teacher picks Korean time (+09:00); impossible dates and other shapes are refused');
  assert(EVENT_MULTIPLIERS.join() === '1.5,2', 'V13.142 the multiplier is 1.5 or 2');
  // 소수점: 추가분은 버림. 1.5배 7코인 → +3(3.5 버림) = 10, 2배 7코인 → +7 = 14. 하루 한도도 배율만큼(150 → 225 · 300).
  const c15 = eventCoins({ multiplier: 1.5 }, 7, STUDY_COINS.cap), c2 = eventCoins({ multiplier: 2 }, 7, STUDY_COINS.cap);
  assert(c15.bonus === 3 && c15.line.label === '이벤트 ×1.5' && c15.cap === 225 && c2.bonus === 7 && c2.line.label === '이벤트 ×2' && c2.cap === 300, 'V13.142 extra coins = floor(base × (multiplier − 1)); the daily study cap grows by the same multiplier');
  assert(eventCoins({ multiplier: 2 }, 0, 150).line === null && eventCoins({ multiplier: 2 }, 0, 150).bonus === 0 && eventCoins(null, 20, 150).bonus === 0 && eventCoins(null, 20, 150).cap === 150, 'V13.142 0 coins stay 0; no event changes nothing');
  assert(eventXp({ multiplier: 1.5 }, 365) === 182 && eventXp({ multiplier: 2 }, 365) === 365 && eventXp({ multiplier: 2 }, 0) === 0 && eventXp(null, 365) === 0, 'V13.142 extra 경험치 = floor(경험치 × (multiplier − 1))');
  const ev = (o) => ({ start_at: 0, end_at: 10, school_ids: ['a'], grade: null, ...o });
  assert(eventsOverlap(ev(), ev({ start_at: 5, end_at: 15 })) && !eventsOverlap(ev(), ev({ start_at: 10, end_at: 20 })) && !eventsOverlap(ev(), ev({ school_ids: ['b'] })) && eventsOverlap(ev(), ev({ grade: '고1' })) && !eventsOverlap(ev({ grade: '고1' }), ev({ grade: '고2' })) && eventsOverlap(ev({ school_ids: ['a', 'b'] }), ev({ school_ids: ['b'], grade: '고2' })), 'V13.142 overlap = same time and a student both could reach (school shared, grade not different); back-to-back is fine');

  /* ---------- an old state gets an empty list ---------- */
  const old = emptyState();
  delete old.rewardEvents;
  migrateState(old);
  assert(Array.isArray(old.rewardEvents) && old.rewardEvents.length === 0 && Array.isArray(emptyState().rewardEvents), 'V13.142 an old state gets an empty event list');

  /* ---------- setup ---------- */
  const state = emptyState();
  const hash = await passwordHash('QaEvent1!');
  const now = Date.now();
  const student = (id, className = '고1A', extra = {}) => ({ id, username: id, display_name: id, role: 'student', active: true, class_name: className, school_id: 'danwon-high', school: '단원고', division: 'high', password_hash: hash, pets: [{ key: 'dog', first: true, acquired_at: now - 9e8 }], avatar_key: 'dog', created_at: now - 9e8, ...extra });
  state.profiles.push(
    { id: 'qa-ev-teacher', username: 'qa_ev_teacher', display_name: '이벤트 선생님', role: 'teacher', active: true, password_hash: hash, school_ids: ['danwon-high', 'seonbu-high'], division_ids: ['high'], active_division: 'high', active_school_id: 'danwon-high', created_at: now },
    student('qa-ev-a'), student('qa-ev-b'), student('qa-ev-c'), student('qa-ev-g2', '고2A'),
    student('qa-ev-far', '고1A', { school_id: 'seonbu-high', school: '선부고' })
  );
  migrateState(state);
  const tokens = {};
  for (const p of state.profiles) tokens[p.id] = (await service(state, 'POST', '/login', { username: p.username, password: 'QaEvent1!', division: 'high', role: p.role === 'teacher' ? 'teacher' : undefined }, null))._cookie;
  const T = tokens['qa-ev-teacher'];
  const words = (await service(state, 'GET', '/bootstrap', {}, tokens['qa-ev-a'])).books.flatMap(book => book.words || []);
  async function study(id, { target = 10, rights = null, stopAt = null } = {}) {
    const started = await service(state, 'POST', '/practice/start', { school: '단원고', range_codes: ['24'], mode: 'write_meaning', target, run_mode: 'practice', exam_style: true }, tokens[id]);
    let view = started, n = 0;
    while (!view.finished && n < target + 15) {
      if (stopAt !== null && n >= stopAt) { view = await service(state, 'POST', `/practice/${started.id}/finish`, {}, tokens[id]); break; }
      const x = state.practices.find(item => item.id === started.id);
      const wordId = x.question_id === view.question_id ? x.question?.word_id : x.next_preview?.question?.word_id;
      const word = words.find(w => w.id === wordId);
      const right = rights ? rights[n] !== false : true;
      view = await service(state, 'POST', `/practice/${started.id}/answer`, { question_id: view.question_id, answer: right ? (meaningAccepted(word.meaning, word.accepted_meanings)[0] || word.meaning) : '__틀린답__', prefetch_next: false, client_time: 0 }, tokens[id]);
      n++;
      if (!view.finished) view = await service(state, 'POST', `/practice/${started.id}/next`, {}, tokens[id]);
    }
    return { session: state.sessions.find(s => s.id === started.id), view };
  }
  const form = (o = {}) => ({ name: '기말 대비 2배 주간', multiplier: 2, start: kstInput(now - HOUR), end: kstInput(now + 3 * DAY), scope: 'grade', school_id: 'danwon-high', grade: '고1', ...o });

  /* ---------- only teachers ---------- */
  await expectStatus(403, () => service(state, 'POST', '/teacher/reward-events', form(), tokens['qa-ev-a']), 'V13.142 a student cannot make an event');
  await expectStatus(403, () => service(state, 'GET', '/teacher/reward-events', {}, tokens['qa-ev-a']), 'V13.142 a student cannot list events');
  await expectStatus(400, () => service(state, 'POST', '/teacher/reward-events', form({ multiplier: 3 }), T), 'V13.142 only ×1.5 or ×2');
  await expectStatus(400, () => service(state, 'POST', '/teacher/reward-events', form({ name: '  ' }), T), 'V13.142 a name is needed');
  await expectStatus(400, () => service(state, 'POST', '/teacher/reward-events', form({ end: kstInput(now - 2 * HOUR) }), T), 'V13.142 the end must come after the start');
  await expectStatus(400, () => service(state, 'POST', '/teacher/reward-events', form({ start: kstInput(now - 3 * HOUR), end: kstInput(now - HOUR) }), T), 'V13.142 a period already over is refused');
  await expectStatus(400, () => service(state, 'POST', '/teacher/reward-events', form({ end: kstInput(now + 40 * DAY) }), T), 'V13.142 at most 31 days');
  await expectStatus(403, () => service(state, 'POST', '/teacher/reward-events', form({ school_id: 'no-such-school' }), T), 'V13.142 only a school the teacher teaches');
  await expectStatus(400, () => service(state, 'POST', '/teacher/reward-events', form({ grade: '중2' }), T), 'V13.142 a grade of that school only');

  /* ---------- make one; overlapping ones are refused with the reason ---------- */
  const made = await service(state, 'POST', '/teacher/reward-events', form(), T);
  const e2 = made.event;
  assert(e2.status === 'live' && e2.multiplier === 2 && e2.target_label === '단원고 고1' && state.rewardEvents.length === 1 && e2.start_at >= now, 'V13.142 the teacher makes a ×2 event for 단원고 고1 (a start in the past begins now)');
  let reason = '';
  try { await service(state, 'POST', '/teacher/reward-events', form({ name: '겹침', scope: 'school', start: kstInput(now + DAY), end: kstInput(now + 5 * DAY) }), T); } catch (error) { reason = `${error.status} ${error.message}`; }
  assert(/^409 /.test(reason) && reason.includes('기말 대비 2배 주간') && reason.includes('겹쳐요'), 'V13.142 an event over the same students at the same time is refused, naming the one it clashes with');
  await expectStatus(409, () => service(state, 'POST', '/teacher/reward-events', form({ name: '전체', scope: 'all', multiplier: 1.5 }), T), 'V13.142 an 전체 event over a live school event is refused');
  const g2 = await service(state, 'POST', '/teacher/reward-events', form({ name: '고2 예정', multiplier: 1.5, grade: '고2', start: kstInput(now + DAY), end: kstInput(now + 2 * DAY) }), T);
  const far = await service(state, 'POST', '/teacher/reward-events', form({ name: '선부고', scope: 'school', school_id: 'seonbu-high' }), T);
  assert(g2.event.status === 'upcoming' && far.event.target_label === '선부고 전체' && far.events.length === 3, 'V13.142 another grade, or another school, at the same time is fine; an event may start later (예정)');

  /* ---------- who sees it ---------- */
  const bootA = await service(state, 'GET', '/bootstrap', {}, tokens['qa-ev-a']);
  const bootG2 = await service(state, 'GET', '/bootstrap', {}, tokens['qa-ev-g2']);
  const bootFar = await service(state, 'GET', '/bootstrap', {}, tokens['qa-ev-far']);
  const bootT = await service(state, 'GET', '/bootstrap', {}, T);
  assert(bootA.reward_event?.multiplier === 2 && bootA.reward_event.name === '기말 대비 2배 주간' && Object.keys(bootA.reward_event).sort().join() === 'end_at,id,multiplier,name,start_at', 'V13.142 a student of the target gets the live event (name, multiplier, period only)');
  assert(bootG2.reward_event === null && bootFar.reward_event?.name === '선부고' && bootT.reward_event === null, 'V13.142 another grade sees no event (theirs is 예정); another school sees its own; the teacher bootstrap has none');
  await expectStatus(403, () => service(state, 'POST', `/teacher/reward-events/${e2.id}/end`, {}, tokens['qa-ev-a']), 'V13.142 a student cannot end an event');
  await expectStatus(403, () => service(state, 'POST', `/teacher/reward-events/${e2.id}/delete`, {}, tokens['qa-ev-a']), 'V13.142 a student cannot delete an event');
  await expectStatus(404, () => service(state, 'POST', '/teacher/reward-events/no-such/end', {}, T), 'V13.142 an unknown event is 404');

  /* ---------- ×2 on a practice ---------- */
  const { session: s2, view: v2 } = await study('qa-ev-a');
  const base2 = STUDY_COINS.t10 + STUDY_COINS.perfect + STUDY_COINS.first;
  const line2 = s2.reward_breakdown.find(item => item.event);
  assert(line2?.label === '이벤트 ×2' && line2.points === base2 && s2.reward_points === base2 * 2, `V13.142 a ×2 practice pays the base coins twice, with its own "이벤트 ×2" line (${base2} + ${base2})`);
  assert(s2.reward_event?.multiplier === 2 && s2.reward_event.coins === base2 && s2.reward_event.xp > 0 && s2.xp === s2.reward_event.xp * 2 && v2.reward_event?.xp === s2.reward_event.xp && v2.xp === s2.xp, 'V13.142 경험치 is doubled too, and the result screen gets the event and the doubled total');
  // 하루 한도 300(=150×2): 오늘 290을 받은 학생은 10만.
  state.sessions.push({ id: 'qa-ev-rich', student_id: 'qa-ev-b', division: 'high', school_id: 'danwon-high', school: '단원고', mode: 'eng2mean', run_mode: 'practice', total: 30, correct: 30, answered_count: 30, score: 100, xp: 0, reward_points: STUDY_COINS.cap * 2 - 10, reward_breakdown: [{ label: '오늘 첫 학습', points: 5 }], created_at: Date.now() - 1000 });
  const { session: capped } = await study('qa-ev-b');
  assert(capped.reward_points === 10 && capped.reward_breakdown.some(x => x.label === '이벤트 ×2') && capped.reward_breakdown.some(x => x.label === '일일 보상 한도 적용'), 'V13.142 on a ×2 day study coins stop at 300 (cap × 2)');
  // 코인이 0인 학습은 0 그대로.
  const { session: sloppy } = await study('qa-ev-c', { rights: [true, true, true, true, true, false, false, false, false, false] });
  assert(sloppy.reward_points === 0 && !sloppy.reward_breakdown.length && /60%/.test(sloppy.reward_note) && sloppy.reward_event?.coins === 0 && sloppy.reward_event.xp > 0, 'V13.142 under 60% right: still 0 coins (no event line); 경험치 of a finished practice is doubled');
  const { session: quit } = await study('qa-ev-c', { stopAt: 4 });
  assert(quit.reward_points === 0 && !quit.reward_event && quit.xp > 0, 'V13.142 a practice left midway: 0 coins and no event 경험치');
  const { session: plain } = await study('qa-ev-g2');
  assert(!plain.reward_breakdown.some(x => x.event) && !plain.reward_event, 'V13.142 a student outside the target (고2, event 예정) gets no event');

  /* ---------- end early, then ×1.5 right after ---------- */
  const ended = await service(state, 'POST', `/teacher/reward-events/${e2.id}/end`, {}, T);
  assert(ended.events.find(e => e.id === e2.id).status === 'ended' && ended.events.find(e => e.id === e2.id).ended_early && (await service(state, 'GET', '/bootstrap', {}, tokens['qa-ev-a'])).reward_event === null, 'V13.142 미리 끝내기 ends it now; the student banner is gone');
  await expectStatus(409, () => service(state, 'POST', `/teacher/reward-events/${e2.id}/end`, {}, T), 'V13.142 an event already over cannot be ended again');
  const e15 = (await service(state, 'POST', '/teacher/reward-events', form({ name: '1.5배', multiplier: 1.5 }), T)).event;
  const { session: s15 } = await study('qa-ev-a');
  const base15 = STUDY_COINS.t10 + STUDY_COINS.perfect;
  assert(s15.reward_breakdown.find(x => x.event)?.label === '이벤트 ×1.5' && s15.reward_points === base15 + Math.floor(base15 * 0.5) && s15.reward_event.xp === Math.floor((s15.xp - s15.reward_event.xp) * 0.5), `V13.142 ×1.5: ${base15} + floor(${base15 * 0.5}) coins, 경험치 + floor(half)`);

  /* ---------- ends by itself (server time) ---------- */
  const live = state.rewardEvents.find(e => e.id === e15.id);
  assert(activeEventFor(state, state.profiles.find(p => p.id === 'qa-ev-a'), live.end_at - 1)?.id === e15.id && activeEventFor(state, state.profiles.find(p => p.id === 'qa-ev-a'), live.end_at) === null, 'V13.142 the event holds until its end (exclusive) by server time');
  live.end_at = Date.now() - 1;
  const after = await service(state, 'GET', '/bootstrap', {}, tokens['qa-ev-a']);
  const { session: late } = await study('qa-ev-a');
  assert(after.reward_event === null && !late.reward_event && !late.reward_breakdown.some(x => x.event) && (await service(state, 'GET', '/teacher/reward-events', {}, T)).events.find(e => e.id === e15.id).status === 'ended', 'V13.142 once over, the event is off by itself: no banner, no bonus, listed as 끝남');

  /* ---------- delete ---------- */
  const del = await service(state, 'POST', `/teacher/reward-events/${g2.event.id}/delete`, {}, T);
  assert(!del.events.some(e => e.id === g2.event.id) && !state.rewardEvents.some(e => e.id === g2.event.id) && s2.reward_event.multiplier === 2, 'V13.142 지우기 removes it; coins already paid stay in the records');

  /* ---------- nothing else is boosted ---------- */
  const svc = source('./service.mjs'), rewards = source('./rewards.mjs'), dungeon = source('./dungeon-engine.mjs');
  assert((svc.match(/activeEventFor\(/g) || []).length === 2 && /const event = answerRecords\.length \? activeEventFor\(state, student, endedAt\)/.test(svc) && /reward_event: teacher \? null : studentEventView\(activeEventFor\(state, p, now\)\)/.test(svc), 'V13.142 the event is read only when a practice ends (its own end time on the server) and for the student bootstrap');
  assert(!/reward-events|rewardEvents|multiplier/.test(rewards) && !/reward-events|rewardEvents/.test(dungeon), 'V13.142 monster, robot, playground, attendance, title, exam and dungeon rewards (server/rewards.mjs, dungeon) do not use the event');
  // 폰 시간은 쓰지 않는다: 답에 실린 client_time(0)과 상관없이 서버 시간으로 이벤트를 골랐다(위 학습들).
  const ui = source('../public/modules/reward-events-ui.js');
  assert(source('../public/modules/student.js').includes('${rewardEventBanner(A)}${noticeBanner(A)}') && source('../public/modules/sessions.js').includes('${rewardEventResult(x)}') && /data-action="reward-events"/.test(source('../public/modules/teacher.js')) && source('../public/app.js').includes("if (d.action === 'reward-events') return rewardEventModal(A);"), 'V13.142 the event banner sits at the top of the student home, the result screen shows the event, the teacher dashboard has the event button');
  assert(ui.includes('A.data.server_time') && ui.includes('Date.now() - Number(A.loadedAt') && ui.includes("document.querySelector('.reward-event-v13142')?.remove()") && ui.includes('if (left <= 0) return'), 'V13.142 the banner counts down by server time (time since bootstrap, not the phone clock) and removes itself when the event ends');
  assert(ui.includes('return `${Math.floor(ms / DAY)}일 남음`') && ui.includes('${Math.floor(ms / HOUR)}시간 남음'), 'V13.142 "3일 남음", and from 24 hours before the end in hours');
}
