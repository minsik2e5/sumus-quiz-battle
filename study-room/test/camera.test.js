'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Cam = require('../public/camera');
const { Store } = require('../lib/store');
const { Academy, CAM_GONE_MS } = require('../lib/academy');

const MIN = 60 * 1000;

function feed(classifier, from, to, sample) {
  let pose;
  for (let t = from; t <= to; t += 500) pose = classifier.push({ t, ...sample });
  return pose;
}

const face = (extra) => ({ face: true, pitch: 0.45, lookDown: 0.1, blink: 0.1, jaw: 0, ...extra });

test('classifier: calibrates on looking at the screen, then detects head down', () => {
  const c = Cam.createClassifier();
  assert.equal(feed(c, 0, 2000, face()), 'up');
  assert.equal(c.calibrated, true);
  assert.equal(feed(c, 2500, 5000, face({ pitch: 0.56 })), 'down');
  assert.equal(feed(c, 5500, 8000, face({ pitch: 0.46, lookDown: 0.6 })), 'down', 'eyes looking down also counts');
  assert.equal(feed(c, 8500, 11000, face()), 'up');
});

test('classifier: gone after 3 seconds without a face, yawn and sleep', () => {
  const c = Cam.createClassifier();
  feed(c, 0, 2000, face());
  assert.equal(feed(c, 2500, 4000, { face: false }), 'up', 'short glitches are ignored');
  assert.equal(feed(c, 4500, 6000, { face: false }), 'gone');
  assert.equal(feed(c, 6500, 7000, face({ jaw: 0.8 })), 'yawn');
  assert.equal(feed(c, 7500, 12000, face()), 'up');
  assert.equal(feed(c, 12500, 26000, face({ blink: 0.9 })), 'up', 'not asleep before 15 seconds');
  assert.equal(feed(c, 26500, 30000, face({ blink: 0.9 })), 'sleep');
  assert.equal(feed(c, 30500, 40000, face({ blink: 0.9, pitch: 0.6 })), 'down', 'closed-looking eyes while reading are not sleep');
});

test('toSample reads landmarks and blendshapes', () => {
  const lm = [];
  for (let i = 0; i < 478; i += 1) lm.push({ x: 0.5, y: 0.5, z: 0 });
  lm[33].y = 0.4; lm[263].y = 0.4; lm[1].y = 0.5; lm[152].y = 0.6;
  const s = Cam.toSample({ faceLandmarks: [lm], faceBlendshapes: [{ categories: [{ categoryName: 'jawOpen', score: 0.7 }, { categoryName: 'eyeLookDownLeft', score: 0.4 }, { categoryName: 'eyeLookDownRight', score: 0.6 }] }] }, 10);
  assert.equal(s.face, true);
  assert.equal(Math.round(s.pitch * 100), 50);
  assert.equal(s.jaw, 0.7);
  assert.equal(s.lookDown, 0.5);
  assert.deepEqual(Cam.toSample({ faceLandmarks: [] }, 3), { t: 3, face: false });
});

function setup() {
  const clock = { t: Date.parse('2026-10-13T10:00:00+09:00') };
  const stopped = [];
  const academy = new Academy(new Store(), { now: () => clock.t, random: () => 0, onCamStopped: (id) => stopped.push(id) });
  const cls = academy.createClass('A');
  const s = academy.register({ name: '감자', classCode: cls.code, pin: '1234' }).student;
  academy.attach(s.id);
  return { clock, academy, s, stopped };
}

test('camera: leaving for under 5 minutes keeps the time, longer stops at the moment you left', () => {
  const { clock, academy, s, stopped } = setup();
  academy.setStudy(s.id, true);
  academy.setCam(s.id, true, 'down');
  clock.t += 20 * MIN;
  academy.setCam(s.id, true, 'gone');
  clock.t += 2 * MIN;
  academy.tick();
  academy.setCam(s.id, true, 'down');
  clock.t += 8 * MIN;
  academy.tick();
  assert.equal(academy.todayMs(s.id), 30 * MIN);

  academy.setCam(s.id, true, 'gone');
  clock.t += CAM_GONE_MS + MIN;
  academy.tick();
  assert.deepEqual(stopped, [s.id]);
  assert.equal(academy.status(s.id), 'rest');
  assert.equal(academy.todayMs(s.id), 30 * MIN, 'nothing counted after leaving');
  const row = academy.overview('ALL').students[0];
  assert.equal(row.camMs, 28 * MIN, 'camera-verified time excludes the 2 minutes away');
});

test('camera: no focus check popups while the camera sees you', () => {
  const { clock, academy, s } = setup();
  academy.setStudy(s.id, true);
  academy.setCam(s.id, true, 'down');
  for (let i = 0; i < 12; i += 1) {
    clock.t += 10 * MIN;
    academy.tick();
  }
  assert.equal(academy.me(s.id).check, null);
  assert.equal(academy.todayMs(s.id), 120 * MIN);
  assert.equal(academy.member(s.id).cam, 'down');
  academy.detach(s.id);
  assert.equal(academy.member(s.id).cam, null, 'camera state is cleared when disconnected');
});

test('camera: turning it on answers a pending focus check', () => {
  const { clock, academy, s } = setup();
  academy.setStudy(s.id, true);
  clock.t += 45 * MIN;
  academy.tick();
  assert.ok(academy.me(s.id).check);
  academy.setCam(s.id, true, 'down');
  assert.equal(academy.me(s.id).check, null);
});

test('classifier: nodding off while sitting counts as sleep', () => {
  const c = Cam.createClassifier();
  let t = feed(c, 0, 2000, face());
  let now = 2500;
  for (let i = 0; i < 3; i += 1) {
    c.push({ t: now, ...face({ pitch: 0.66 }) });
    now += 500;
    c.push({ t: now, ...face() });
    now += 5000;
    feed(c, now, now + 2000, face());
    now += 2500;
  }
  assert.equal(c.pose, 'sleep');
  assert.ok(c.since() != null);
  assert.equal(feed(c, now, now + 25000, face({ gaze: 0 })), 'up', 'wakes up after the hold');
});

test('classifier: head down without moving for 10 minutes is still, reading is not', () => {
  const reading = Cam.createClassifier();
  feed(reading, 0, 2000, face());
  let g = 0;
  let pose;
  for (let t = 2500; t <= 11 * 60000; t += 500) {
    g = g ? 0 : 0.1; // 줄을 따라 눈동자가 계속 움직임
    pose = reading.push({ t, ...face({ pitch: 0.56, gaze: g }) });
  }
  assert.equal(pose, 'down');

  const frozen = Cam.createClassifier();
  feed(frozen, 0, 2000, face());
  assert.equal(feed(frozen, 2500, 11 * 60000, face({ pitch: 0.56 })), 'still');
  assert.ok(frozen.since() < 2 * 60000);
});

test('classifier: looking sideways for 3 minutes is side', () => {
  const c = Cam.createClassifier();
  feed(c, 0, 2000, face({ yaw: 0 }));
  assert.equal(feed(c, 2500, 60000, face({ yaw: 0.4 })), 'up');
  assert.equal(feed(c, 60500, 4 * 60000, face({ yaw: 0.4 })), 'side');
});

test('camera: dozing for over 5 minutes stops at the moment it started', () => {
  const { clock, academy, s, stopped } = setup();
  academy.setStudy(s.id, true);
  academy.setCam(s.id, true, 'down');
  clock.t += 30 * MIN;
  academy.tick();
  academy.setCam(s.id, true, 'sleep', 20000); // 20초 전부터 눈 감음
  clock.t += 3 * MIN;
  academy.tick();
  assert.equal(academy.status(s.id), 'study', 'short doze keeps studying');
  clock.t += 3 * MIN;
  academy.tick();
  assert.deepEqual(stopped, [s.id]);
  assert.equal(academy.todayMs(s.id), 30 * MIN - 20000);
  assert.equal(academy.overview('ALL').students[0].dozes, 1);
});

test('camera: frozen head-down raises a check, missing it rolls back to when it started', () => {
  const { clock, academy, s } = setup();
  academy.setStudy(s.id, true);
  academy.setCam(s.id, true, 'down');
  for (let i = 0; i < 4; i += 1) { clock.t += 10 * MIN; academy.tick(); }
  academy.setCam(s.id, true, 'still', 10 * MIN);
  assert.ok(academy.me(s.id).check, 'check shows up');
  clock.t += 6 * MIN;
  academy.tick();
  assert.equal(academy.status(s.id), 'rest');
  assert.equal(academy.todayMs(s.id), 30 * MIN, 'only time before going still counts');
});

test('camera: moving again answers the still check; switching apps for 2+ minutes stops', () => {
  const { clock, academy, s, stopped } = setup();
  academy.setStudy(s.id, true);
  academy.setCam(s.id, true, 'side', 3 * MIN);
  assert.ok(academy.me(s.id).check);
  academy.setCam(s.id, true, 'down');
  assert.equal(academy.me(s.id).check, null);
  clock.t += 10 * MIN;
  academy.setHidden(s.id, true);
  clock.t += 1 * MIN;
  academy.setHidden(s.id, false);
  academy.tick();
  assert.equal(academy.status(s.id), 'study', 'quick app switch is fine');
  academy.setHidden(s.id, true);
  clock.t += 3 * MIN;
  academy.tick();
  assert.deepEqual(stopped, [s.id]);
  assert.equal(academy.todayMs(s.id), 11 * MIN);
  assert.equal(academy.overview('ALL').students[0].offTask, 2);
});
