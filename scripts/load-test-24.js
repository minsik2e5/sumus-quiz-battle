'use strict';

const assert = require('node:assert/strict');

const origin = process.env.SUMUS_LOAD_ORIGIN || 'ws://127.0.0.1:8790';
const code = String(process.env.SUMUS_LOAD_CODE || '92468');
const battleId = `load-v09-${Date.now().toString(36)}`;
const waiters = new Map();
const metrics = { lookupMs: [], answerBatchMs: 0, broadcastMs: 0 };
let readyReceived = 0;
let answersReceived = 0;

function open(role, clientId, extra = '') {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`${origin}/ws?role=${role}&clientId=${clientId}${extra}`);
    const timer = setTimeout(() => reject(new Error(`open timeout: ${clientId}`)), 10000);
    ws.addEventListener('open', () => { clearTimeout(timer); resolve(ws); }, { once: true });
    ws.addEventListener('error', () => reject(new Error(`socket error: ${clientId}`)), { once: true });
  });
}

function send(ws, type, payload, senderId) {
  ws.send(JSON.stringify({ id: `${senderId}-${Date.now()}-${Math.random()}`, type, payload: { timestamp: Date.now(), ...payload }, senderId, timestamp: Date.now() }));
}

function waitFor(clientId, type, timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    const key = `${clientId}:${type}`;
    const timer = setTimeout(() => { waiters.delete(key); reject(new Error(`timeout ${key}`)); }, timeoutMs);
    waiters.set(key, (message) => { clearTimeout(timer); waiters.delete(key); resolve(message); });
  });
}

function listen(ws, clientId) {
  ws.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    const key = `${clientId}:${message.type}`;
    const waiter = waiters.get(key);
    if (waiter) waiter(message);
  });
}

function waitUntil(predicate, label, timeoutMs = 10000) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      if (predicate()) return resolve(Date.now() - started);
      if (Date.now() - started >= timeoutMs) return reject(new Error(`timeout ${label}`));
      setTimeout(tick, 10);
    };
    tick();
  });
}

function percentile(values, fraction) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * fraction))] || 0;
}

(async () => {
  const teacherId = `load-teacher-${Date.now()}`;
  const teacher = await open('teacher', teacherId, `&battleId=${battleId}&code=${code}`);
  listen(teacher, teacherId);
  const players = [];
  teacher.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    const p = message.payload || {};
    if (message.type === 'BATTLE_LOOKUP') {
      send(teacher, 'BATTLE_STATE', { battleId, battleCode: code, targetClientId: message.senderId, players }, teacherId);
    } else if (message.type === 'PLAYER_JOIN_REQUEST') {
      const player = { id: `player-${players.length + 1}`, name: p.name, ready: false, connected: true };
      players.push(player);
      send(teacher, 'PLAYER_JOIN_ACCEPTED', { battleId, battleCode: code, targetClientId: message.senderId, playerId: player.id, player, snapshot: { battleId, battleCode: code, players } }, teacherId);
    } else if (message.type === 'PLAYER_READY') {
      readyReceived += 1;
    } else if (message.type === 'ANSWER_SUBMIT') {
      answersReceived += 1;
      send(teacher, 'ANSWER_RESULT', { battleId, battleCode: code, targetClientId: message.senderId, playerId: p.playerId, questionId: p.questionId, attemptId: p.attemptId, result: 'correct', player: { id: p.playerId, questionIndex: 1, assignedTotal: 1 }, rank: answersReceived }, teacherId);
      send(teacher, 'PLAYER_PROGRESS', { battleId, battleCode: code, playerId: p.playerId, questionIndex: 1, assignedTotal: 1, rank: answersReceived }, teacherId);
    }
  });
  send(teacher, 'SERVER_REGISTER_BATTLE', { battleId, battleCode: code, build: 'V0.9', commit: 'loadtest' }, teacherId);
  await waitFor(teacherId, 'SERVER_REGISTERED');

  const collisionId = `load-collision-${Date.now()}`;
  const collision = await open('teacher', collisionId);
  listen(collision, collisionId);
  const conflictPromise = waitFor(collisionId, 'SERVER_CODE_CONFLICT');
  send(collision, 'SERVER_REGISTER_BATTLE', { battleId: `${battleId}-other`, battleCode: code, build: 'V0.9' }, collisionId);
  const conflict = await conflictPromise;
  assert.equal(conflict.payload.reason, 'code_conflict');
  collision.close();

  const clients = await Promise.all(Array.from({ length: 24 }, async (_, index) => {
    const clientId = `load-student-${index + 1}`;
    const ws = await open('student', clientId);
    listen(ws, clientId);
    const lookupStarted = Date.now();
    const statePromise = waitFor(clientId, 'BATTLE_STATE');
    send(ws, 'BATTLE_LOOKUP', { code }, clientId);
    await statePromise;
    metrics.lookupMs.push(Date.now() - lookupStarted);
    const acceptedPromise = waitFor(clientId, 'PLAYER_JOIN_ACCEPTED');
    send(ws, 'PLAYER_JOIN_REQUEST', { battleId, name: `학생${index + 1}` }, clientId);
    const accepted = await acceptedPromise;
    assert.equal(accepted.payload.player.name, `학생${index + 1}`);
    return { ws, clientId, playerId: accepted.payload.playerId };
  }));
  assert.equal(players.length, 24);

  clients.forEach((client) => send(client.ws, 'PLAYER_READY', { battleId, playerId: client.playerId }, client.clientId));
  await waitUntil(() => readyReceived === 24, '24 ready');

  await Promise.all(clients.map((client, index) => {
    const assigned = waitFor(client.clientId, 'QUESTION_ASSIGN');
    send(teacher, 'QUESTION_ASSIGN', { battleId, battleCode: code, targetClientId: client.clientId, playerId: client.playerId, questionId: `q-${index}`, attemptId: `a-${index}`, question: { id: `q-${index}`, type: 'choice-en-ko', prompt: 'word', options: ['뜻'] }, timeLimit: 20 }, teacherId);
    return assigned;
  }));
  const answerStarted = Date.now();
  await Promise.all(clients.map((client, index) => {
    const result = waitFor(client.clientId, 'ANSWER_RESULT');
    send(client.ws, 'ANSWER_SUBMIT', { battleId, playerId: client.playerId, questionId: `q-${index}`, attemptId: `a-${index}`, answer: '뜻', action: 'answer', responseTime: 1 }, client.clientId);
    return result;
  }));
  metrics.answerBatchMs = Date.now() - answerStarted;
  assert.equal(answersReceived, 24);

  const pauseStarted = Date.now();
  await Promise.all(clients.map((client) => {
    const paused = waitFor(client.clientId, 'GAME_PAUSE');
    return paused;
  }).concat([(send(teacher, 'GAME_PAUSE', { battleId, battleCode: code }, teacherId), Promise.resolve())]));
  const resumePromises = clients.map((client) => waitFor(client.clientId, 'GAME_RESUME'));
  send(teacher, 'GAME_RESUME', { battleId, battleCode: code }, teacherId);
  await Promise.all(resumePromises);
  metrics.broadcastMs = Date.now() - pauseStarted;

  send(teacher, 'BATTLE_STATE', { battleId, battleCode: code, players }, teacherId);
  const reconnecting = clients.slice(0, 5);
  reconnecting.forEach(({ ws }) => ws.close());
  await new Promise((resolve) => setTimeout(resolve, 250));
  for (const client of reconnecting) {
    client.ws = await open('student', client.clientId);
    listen(client.ws, client.clientId);
    const restored = waitFor(client.clientId, 'BATTLE_STATE');
    send(client.ws, 'BATTLE_LOOKUP', { code }, client.clientId);
    const snapshot = await restored;
    assert.equal(snapshot.payload.players.length, 24);
  }

  const finishPromises = clients.map((client) => waitFor(client.clientId, 'GAME_FINISH'));
  send(teacher, 'GAME_FINISH', { battleId, battleCode: code, playerId: '', rank: 1 }, teacherId);
  await Promise.all(finishPromises);

  const memory = process.memoryUsage();
  console.log(JSON.stringify({
    ok: true,
    clients: clients.length,
    ready: readyReceived,
    answers: answersReceived,
    reconnects: reconnecting.length,
    players: players.length,
    collisionRejected: true,
    lookupAvgMs: Math.round(metrics.lookupMs.reduce((a, b) => a + b, 0) / metrics.lookupMs.length),
    lookupP95Ms: percentile(metrics.lookupMs, 0.95),
    answerBatchMs: metrics.answerBatchMs,
    pauseResumeBroadcastMs: metrics.broadcastMs,
    memoryRssMb: +(memory.rss / 1024 / 1024).toFixed(1),
    battleId,
    code
  }));
  clients.forEach(({ ws }) => ws.close());
  teacher.close();
})().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
