'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const continuation = require('../client/raid-c5-continuation');

test('RAID stale recovery is ignored only after an explicit teacher interaction', () => {
  const interactionAt = 10_000;
  assert.equal(continuation.shouldIgnoreRecovery({ arena:'raid', savedAt:9_999 }, interactionAt, 10_100, 'raid'), true);
  assert.equal(continuation.shouldIgnoreRecovery({ arena:'raid', savedAt:10_001 }, interactionAt, 10_100, 'raid'), false);
  assert.equal(continuation.shouldIgnoreRecovery({ arena:'run', savedAt:9_999 }, interactionAt, 10_100, 'run'), false);
  assert.equal(continuation.shouldIgnoreRecovery({ arena:'raid' }, interactionAt, 11_399, 'raid'), true);
  assert.equal(continuation.shouldIgnoreRecovery({ arena:'raid' }, interactionAt, 11_401, 'raid'), false);
  assert.equal(continuation.shouldIgnoreRecovery({ arena:'raid', savedAt:1 }, 0, 10_100, 'raid'), false);
});

test('paused RAID submission is validated before its attempt id is consumed', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'client', 'raid-mode.js'), 'utf8');
  const start = source.indexOf('const V093_baseTeacherAnswer');
  const end = source.indexOf('const V093_baseAssign', start);
  const answer = source.slice(start, end);
  assert.ok(answer.indexOf('state.race.paused') < answer.indexOf('this.resolved.add(key)'));
});

test('result navigation uses capture delegation and sends one canonical lobby event', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'client', 'raid-c5-continuation.js'), 'utf8');
  assert.match(source, /closest\?\.\('#studentReturnLobby'\)/);
  assert.match(source, /stopImmediatePropagation\(\)/);
  assert.match(source, /PLAYER_RETURN_LOBBY/);
  assert.match(source, /\}, true\);/);
});
