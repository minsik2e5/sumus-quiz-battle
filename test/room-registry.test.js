'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { RoomRegistry } = require('../lib/room-registry');

const liveSocket = () => ({ destroyed: false });

test('a live five-digit code cannot be claimed by another battle', () => {
  const rooms = new RoomRegistry();
  assert.equal(rooms.register({ battleId: 'battle-a', code: '12345', teacherSocket: liveSocket() }).ok, true);
  const conflict = rooms.register({ battleId: 'battle-b', code: '12345', teacherSocket: liveSocket() });
  assert.equal(conflict.ok, false);
  assert.equal(conflict.reason, 'code_conflict');
});

test('cached authoritative snapshot survives teacher detach until TTL', () => {
  let now = 1000;
  const rooms = new RoomRegistry({ ttlMs: 5000, now: () => now });
  const socket = liveSocket();
  rooms.register({ battleId: 'battle-a', code: '12345', teacherSocket: socket });
  rooms.cache('battle-a', 'BATTLE_STATE', { type: 'BATTLE_STATE', payload: { battleId: 'battle-a', players: [] } });
  rooms.detachTeacher(socket);
  assert.equal(rooms.byCode('12345').snapshot.payload.battleId, 'battle-a');
  now = 7001;
  assert.equal(rooms.byCode('12345'), null);
});

test('private teacher state is cached separately from the student snapshot', () => {
  const rooms = new RoomRegistry();
  rooms.register({ battleId: 'battle-a', code: '12345', teacherSocket: liveSocket() });
  rooms.cache('battle-a', 'BATTLE_STATE', { type: 'BATTLE_STATE', payload: { players: [{ id: 'public' }] } });
  rooms.cacheTeacherState('battle-a', { players: [{ id: 'private', score: 42, questions: [{ answer: 'secret' }] }] });
  assert.equal(rooms.byId('battle-a').snapshot.payload.players[0].id, 'public');
  assert.equal(rooms.byId('battle-a').teacherState.players[0].questions[0].answer, 'secret');
});
