'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const WebSocket = require('ws');
const { createApp } = require('../server');

function nextMessage(ws, predicate) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), 3000);
    ws.on('message', function onMsg(raw) {
      const msg = JSON.parse(raw.toString());
      if (predicate(msg)) {
        clearTimeout(timer);
        ws.off('message', onMsg);
        resolve(msg);
      }
    });
  });
}

test('register, join the room over websocket and see a friend study', async () => {
  const app = await createApp({ port: 0, host: '127.0.0.1', teacherKey: 'secret', dataFile: '', quiet: true });
  const base = `http://127.0.0.1:${app.port}`;
  const post = (path, body, headers = {}) => fetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) }).then(async (r) => ({ status: r.status, body: await r.json() }));
  try {
    assert.equal((await post('/api/teacher/classes', { name: 'A반' }, { 'X-Teacher-Key': 'nope' })).status, 401);
    const { body: { class: cls } } = await post('/api/teacher/classes', { name: 'A반' }, { 'X-Teacher-Key': 'secret' });
    const a = (await post('/api/register', { name: '감자', classCode: cls.code, pin: '1111' })).body;
    const b = (await post('/api/register', { name: '밍지', classCode: cls.code, pin: '2222' })).body;
    assert.ok(a.token && b.token);

    const wsA = new WebSocket(`ws://127.0.0.1:${app.port}/ws`);
    await new Promise((r) => wsA.on('open', r));
    const welcome = nextMessage(wsA, (m) => m.t === 'welcome');
    wsA.send(JSON.stringify({ t: 'auth', token: a.token }));
    assert.equal((await welcome).members.length, 2);

    const wsB = new WebSocket(`ws://127.0.0.1:${app.port}/ws`);
    await new Promise((r) => wsB.on('open', r));
    wsB.send(JSON.stringify({ t: 'auth', token: b.token }));
    await nextMessage(wsB, (m) => m.t === 'welcome');

    const studying = nextMessage(wsA, (m) => m.t === 'member' && m.m.name === '밍지' && m.m.status === 'study');
    wsB.send(JSON.stringify({ t: 'study', on: true }));
    assert.ok((await studying).m.since);

    const cheer = nextMessage(wsB, (m) => m.t === 'cheer');
    wsA.send(JSON.stringify({ t: 'cheer', to: b.me.id }));
    assert.equal((await cheer).fromName, '감자');

    const ov = await fetch(`${base}/api/teacher/overview?target=ALL`, { headers: { 'X-Teacher-Key': 'secret' } }).then((r) => r.json());
    assert.equal(ov.studying, 1);

    const stats = await fetch(`${base}/api/me/stats`, { headers: { Authorization: `Bearer ${b.token}` } }).then((r) => r.json());
    assert.equal(stats.days.length, 7);
    wsA.close();
    wsB.close();
  } finally {
    await app.close();
  }
});

test('teacher key can be checked against a SHA-256 hash', async () => {
  const { createHub } = require('../lib/hub');
  const { Store } = require('../lib/store');
  const hash = require('crypto').createHash('sha256').update('long-secret-key').digest('hex');
  const hub = createHub({ store: new Store(), teacherKeyHash: hash });
  const call = (key) => hub.api({ method: 'GET', path: '/api/teacher/classes', query: new URLSearchParams(), header: (n) => (n === 'x-teacher-key' ? key : ''), bodyText: '', ip: 'x' });
  assert.equal((await call('long-secret-key')).status, 200);
  assert.equal((await call('wrong')).status, 401);
  assert.equal((await call('')).status, 401);
});
