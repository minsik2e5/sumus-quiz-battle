'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { Store } = require('../lib/store');
const { Academy, AWAY_GRACE_MS, BUBBLES_PER_DAY } = require('../lib/academy');
const { splitByDay, dayKey } = require('../lib/time');
const { cleanBubble } = require('../lib/filter');

const MIN = 60 * 1000;

function setup(start = Date.parse('2026-10-13T10:00:00+09:00')) {
  const clock = { t: start };
  const events = [];
  const academy = new Academy(new Store(), { now: () => clock.t, onMember: (m) => events.push(m) });
  const cls = academy.createClass('고1 A반');
  const join = (name) => academy.register({ name, classCode: cls.code, pin: '1234' }).student;
  return { clock, academy, cls, join, events };
}

test('splitByDay splits study time at KST midnight', () => {
  const from = Date.parse('2026-10-13T23:50:00+09:00');
  const to = Date.parse('2026-10-14T00:20:00+09:00');
  assert.deepEqual(splitByDay(from, to), [['2026-10-13', 10 * MIN], ['2026-10-14', 20 * MIN]]);
  assert.equal(dayKey(Date.parse('2026-10-13T15:00:00Z')), '2026-10-14');
});

test('study time accumulates and stops', () => {
  const { clock, academy, join } = setup();
  const s = join('감자');
  academy.attach(s.id);
  academy.setStudy(s.id, true);
  clock.t += 25 * MIN;
  academy.tick();
  clock.t += 5 * MIN;
  assert.equal(academy.todayMs(s.id), 30 * MIN);
  assert.equal(academy.member(s.id).status, 'study');
  academy.setStudy(s.id, false);
  clock.t += 10 * MIN;
  assert.equal(academy.todayMs(s.id), 30 * MIN);
  assert.equal(academy.member(s.id).status, 'rest');
});

test('member baseMs + since reproduces live time across midnight', () => {
  const { clock, academy, join } = setup(Date.parse('2026-10-13T23:40:00+09:00'));
  const s = join('밍지');
  academy.attach(s.id);
  academy.setStudy(s.id, true);
  clock.t = Date.parse('2026-10-14T00:30:00+09:00');
  const m = academy.member(s.id);
  assert.equal(m.baseMs + (clock.t - m.since), 30 * MIN);
  academy.tick();
  assert.equal(academy.peek(s.id, '2026-10-13').ms, 20 * MIN);
  assert.equal(academy.peek(s.id, '2026-10-14').ms, 30 * MIN);
});

test('short disconnect keeps the timer, long one stops at disconnect time', () => {
  const { clock, academy, join } = setup();
  const s = join('채원');
  academy.attach(s.id);
  academy.setStudy(s.id, true);
  clock.t += 10 * MIN;
  academy.detach(s.id);
  assert.equal(academy.status(s.id), 'away');
  clock.t += 3 * MIN;
  academy.attach(s.id);
  assert.equal(academy.status(s.id), 'study');
  clock.t += 2 * MIN;
  assert.equal(academy.todayMs(s.id), 15 * MIN);

  academy.detach(s.id);
  clock.t += AWAY_GRACE_MS + MIN;
  academy.tick();
  assert.equal(academy.status(s.id), 'offline');
  assert.equal(academy.todayMs(s.id), 15 * MIN);
});

test('bubbles are filtered and limited per day', () => {
  const { academy, join } = setup();
  const s = join('또기');
  assert.equal(cleanBubble('  영어   단어 50개!! '), '영어 단어 50개!!');
  assert.equal(cleanBubble('아 시 발 하기싫다'), '아 ♡♡ 하기싫다');
  for (let i = 0; i < BUBBLES_PER_DAY; i += 1) academy.postBubble(s.id, `할일 ${i}`);
  assert.throws(() => academy.postBubble(s.id, '하나 더'), /다 썼어요/);
  assert.equal(academy.me(s.id).bubblesLeft, 0);
  academy.postBubble(s.id, '');
  assert.equal(academy.member(s.id).bubble, null);
});

test('login requires the right PIN and names are unique per class', () => {
  const { academy, cls, join } = setup();
  join('감자');
  assert.throws(() => academy.register({ name: '감자', classCode: cls.code, pin: '0000' }), /이미 같은 이름/);
  assert.throws(() => academy.login({ name: '감자', classCode: cls.code, pin: '0000' }), /다시 확인/);
  const { token } = academy.login({ name: '감자', classCode: cls.code, pin: '1234' });
  assert.equal(academy.auth(token).name, '감자');
  academy.resetPin(academy.auth(token).id, '5678');
  assert.equal(academy.auth(token), null);
});

test('streak, stats ranking and cheer', () => {
  const { clock, academy, join } = setup(Date.parse('2026-10-10T20:00:00+09:00'));
  const a = join('감자');
  const b = join('밍지');
  for (let d = 0; d < 3; d += 1) {
    academy.setStudy(a.id, true);
    clock.t += 40 * MIN;
    academy.setStudy(a.id, false);
    clock.t += 24 * 60 * MIN - 40 * MIN;
  }
  academy.setStudy(b.id, true);
  clock.t += 10 * MIN;
  academy.setStudy(b.id, false);
  assert.equal(academy.streak(a.id), 3); // 10~12일 3일 연속, 오늘은 아직 30분 미만이어도 끊기지 않음
  const stats = academy.stats(a.id);
  assert.equal(stats.top[0].name, '감자');
  assert.equal(stats.myRank, 1);
  assert.equal(academy.cheer(b.id, a.id), true);
  assert.equal(academy.cheer(b.id, a.id), false); // 연타 제한
  assert.equal(academy.member(a.id).hearts, 1);
});

test('overview and csv export for teacher', () => {
  const { clock, academy, cls, join } = setup();
  const a = join('=감자');
  academy.setStudy(a.id, true);
  clock.t += 61 * MIN;
  const ov = academy.overview(cls.code);
  assert.equal(ov.studying, 1);
  assert.equal(ov.students[0].dayMs, 61 * MIN);
  const all = academy.overview('ALL');
  assert.equal(all.total, 1);
  const csv = academy.exportCsv('ALL', '2026-10-12', '2026-10-13');
  assert.match(csv, /'=감자,0,61,61/);
  assert.throws(() => academy.deleteClass(cls.code), /학생이 있는 반/);
});

test('store persists to a file and reloads', async () => {
  const fs = require('fs');
  const os = require('os');
  const path = require('path');
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'study-')), 'state.json');
  const store = new Store({ file, flushDelayMs: 10 });
  await store.load();
  const academy = new Academy(store);
  const cls = academy.createClass('중3');
  const { token } = academy.register({ name: '감자', classCode: cls.code, pin: '1234' });
  await store.close();
  const again = new Store({ file });
  await again.load();
  const academy2 = new Academy(again);
  assert.equal(academy2.auth(token).name, '감자');
});

test('focus check: confirming keeps the time, missing stops at the check time', () => {
  const clock = { t: Date.parse('2026-10-13T10:00:00+09:00') };
  const missed = [];
  const academy = new Academy(new Store(), {
    now: () => clock.t,
    random: () => 0,
    checkEveryMs: [30 * MIN, 50 * MIN],
    checkWindowMs: 3 * MIN,
    onCheckMissed: (id) => missed.push(id)
  });
  const cls = academy.createClass('A');
  const s = academy.register({ name: '감자', classCode: cls.code, pin: '1234' }).student;
  academy.attach(s.id);
  academy.setStudy(s.id, true);
  clock.t += 30 * MIN;
  academy.tick();
  assert.ok(academy.me(s.id).check, 'check is shown after 30 minutes');
  clock.t += 1 * MIN;
  assert.equal(academy.confirmCheck(s.id), true);
  assert.equal(academy.me(s.id).check, null);
  clock.t += 30 * MIN;
  academy.tick();
  assert.ok(academy.me(s.id).check, 'next check 30 minutes after confirming');
  clock.t += 3 * MIN + 1000;
  academy.tick();
  assert.deepEqual(missed, [s.id]);
  assert.equal(academy.status(s.id), 'rest');
  assert.equal(academy.todayMs(s.id), 61 * MIN); // 두 번째 확인이 뜬 시점까지만
  const row = academy.overview(cls.code).students[0];
  assert.equal(row.checksOk, 1);
  assert.equal(row.checksMissed, 1);
});

test('teacher adds students in bulk with initial PINs', () => {
  const { academy, cls, join } = setup();
  join('수아');
  const results = academy.addStudents(cls.code, ['수아', '지율', ' 성욱 ', '지율', '']);
  assert.deepEqual(results.map((r) => [r.name, r.status]), [['수아', 'exists'], ['지율', 'added'], ['성욱', 'added']]);
  const pin = results[1].pin;
  assert.match(pin, /^\d{4}$/);
  assert.equal(academy.login({ name: '지율', classCode: cls.code, pin }).student.name, '지율');
  assert.equal(academy.overview(cls.code).students.find((s) => s.name === '성욱').lastSeen, null);
});

test('live study sessions survive a server restart', async () => {
  const fs = require('fs');
  const os = require('os');
  const path = require('path');
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'study-')), 'state.json');
  const clock = { t: Date.parse('2026-10-13T10:00:00+09:00') };
  const store = new Store({ file, flushDelayMs: 10 });
  await store.load();
  const academy = new Academy(store, { now: () => clock.t });
  const cls = academy.createClass('A');
  const s = academy.register({ name: '감자', classCode: cls.code, pin: '1234' }).student;
  academy.attach(s.id);
  academy.setStudy(s.id, true);
  academy.postBubble(s.id, '영어');
  clock.t += 20 * MIN;
  academy.tick();
  await store.close();

  clock.t += 1 * MIN;
  const again = new Store({ file });
  await again.load();
  const academy2 = new Academy(again, { now: () => clock.t });
  assert.equal(academy2.status(s.id), 'away');
  assert.equal(academy2.member(s.id).bubble.text, '영어');
  academy2.attach(s.id);
  clock.t += 4 * MIN;
  assert.equal(academy2.status(s.id), 'study');
  assert.equal(academy2.todayMs(s.id), 25 * MIN);
});

test('TV board lists online students and today/week rankings', () => {
  const { clock, academy, cls, join } = setup();
  const a = join('감자');
  const b = join('밍지');
  join('채원');
  academy.attach(a.id);
  academy.setStudy(a.id, true);
  clock.t += 50 * MIN;
  academy.attach(b.id);
  academy.setStudy(b.id, true);
  clock.t += 10 * MIN;
  const board = academy.board(cls.code);
  assert.equal(board.studying, 2);
  assert.deepEqual(board.members.map((m) => m.name), ['감자', '밍지']);
  assert.deepEqual(board.today.map((m) => m.name), ['감자', '밍지']);
  assert.equal(board.week[0].ms, 60 * MIN);
  assert.equal(board.totalTodayMs, 70 * MIN);
});

test('daily goal is celebrated once and history feeds the calendar', () => {
  const goals = [];
  const clock = { t: Date.parse('2026-10-13T10:00:00+09:00') };
  const academy = new Academy(new Store(), { now: () => clock.t, onGoal: (e) => goals.push(e) });
  const cls = academy.createClass('A');
  const s = academy.register({ name: '감자', classCode: cls.code, pin: '1234' }).student;
  assert.throws(() => academy.setGoal(s.id, 45), /30분 단위/);
  academy.setGoal(s.id, 60);
  academy.attach(s.id);
  academy.setStudy(s.id, true);
  clock.t += 59 * MIN;
  academy.tick();
  assert.equal(goals.length, 0);
  clock.t += 2 * MIN;
  academy.tick();
  academy.tick();
  assert.equal(goals.length, 1);
  assert.equal(goals[0].goalMin, 60);
  assert.equal(academy.me(s.id).goalHit, true);
  const st = academy.stats(s.id);
  assert.equal(st.history.length, 126);
  assert.equal(st.history[st.history.length - 1].g, true);
  assert.equal(st.goalDays, 1);
  assert.equal(academy.board(cls.code).goals.length, 1);
  assert.equal(academy.overview(cls.code).students[0].goalMin, 60);
});
