'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { validateMessage, normalizeCode, normalizeId } = require('../lib/protocol');

test('role-specific message types are enforced', () => {
  assert.equal(validateMessage('student', { type: 'ANSWER_SUBMIT', payload: {} }).ok, true);
  assert.equal(validateMessage('student', { type: 'GAME_START', payload: {} }).ok, false);
  assert.equal(validateMessage('teacher', { type: 'GAME_START', payload: {} }).ok, true);
  assert.equal(validateMessage('teacher', { type: 'PLAYER_READY', payload: {} }).ok, true);
  assert.equal(validateMessage('teacher', { type: 'ANSWER_SUBMIT', payload: {} }).ok, false);
});

test('codes, ids, and envelopes are normalized defensively', () => {
  assert.equal(normalizeCode('12345'), '12345');
  assert.equal(normalizeCode('1234'), '');
  assert.equal(normalizeId('battle-safe_1'), 'battle-safe_1');
  assert.equal(normalizeId('../unsafe'), '');
  assert.equal(validateMessage('student', { type: 'BATTLE_LOOKUP', payload: [] }).ok, false);
});
