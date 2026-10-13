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
