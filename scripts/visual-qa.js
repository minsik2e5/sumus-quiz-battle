'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { chromium } = require('playwright-core');

const root = path.join(__dirname, '..');
const qaDir = path.join(root, 'qa', 'v0.9.2a');
const port = Number(process.env.SUMUS_VISUAL_PORT || 8894);
const baseUrl = `http://127.0.0.1:${port}`;
const wsOrigin = `ws://127.0.0.1:${port}`;
const runCounts = process.env.SUMUS_VISUAL_COUNTS
  ? process.env.SUMUS_VISUAL_COUNTS.split(',').map(Number).filter((value) => [1, 8, 20, 24].includes(value))
  : [1, 8, 20, 24];
const metrics = { visualBuild: 'V0.9.2A', teacherViewport: [1920, 1080], lobbies: {}, runs: {}, students: {}, pageErrors: [] };
let server;
let browser;
let serverLog = '';

function resolveChromePath() {
  if (process.env.SUMUS_CHROME_PATH) return process.env.SUMUS_CHROME_PATH;
  const candidates = process.platform === 'win32'
    ? [
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
        process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, 'Google', 'Chrome', 'Application', 'chrome.exe') : ''
      ]
    : process.platform === 'darwin'
      ? ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Chromium.app/Contents/MacOS/Chromium']
      : ['/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser'];
  const found = candidates.find((candidate) => candidate && fs.existsSync(candidate));
  if (!found) throw new Error('Chrome/Chromium executable not found. Set SUMUS_CHROME_PATH.');
  return found;
}

function waitForHealth(timeoutMs = 15000) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const probe = () => {
      const request = http.get(`${baseUrl}/health`, (response) => {
        response.resume();
        if (response.statusCode === 200) resolve(); else retry();
      });
      request.on('error', retry);
      request.setTimeout(800, () => request.destroy());
    };
    const retry = () => Date.now() - started > timeoutMs
      ? reject(new Error(`visual QA server health timeout\n${serverLog}`))
      : setTimeout(probe, 120);
    probe();
  });
}

function openStudent(clientId) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`${wsOrigin}/ws?role=student&clientId=${clientId}`);
    const timer = setTimeout(() => reject(new Error(`student socket timeout: ${clientId}`)), 10000);
    ws.addEventListener('open', () => {
      clearTimeout(timer);
      const queue = [];
      const waiters = [];
      ws.addEventListener('message', (event) => {
        const message = JSON.parse(event.data);
        const index = waiters.findIndex((waiter) => waiter.type === message.type);
        if (index >= 0) {
          const waiter = waiters.splice(index, 1)[0];
          clearTimeout(waiter.timer);
          waiter.resolve(message);
        } else queue.push(message);
      });
      resolve({ ws, clientId, queue, waiters });
    }, { once: true });
    ws.addEventListener('error', () => reject(new Error(`student socket error: ${clientId}`)), { once: true });
  });
}

function send(client, type, payload) {
  const timestamp = Date.now();
  client.ws.send(JSON.stringify({
    id: `${client.clientId}-${timestamp}-${Math.random().toString(36).slice(2, 7)}`,
    type,
    payload: { timestamp, ...payload },
    senderId: client.clientId,
    timestamp
  }));
}

function waitForMessage(client, type, timeoutMs = 10000) {
  const queued = client.queue.findIndex((message) => message.type === type);
  if (queued >= 0) return Promise.resolve(client.queue.splice(queued, 1)[0]);
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      const index = client.waiters.findIndex((waiter) => waiter.resolve === resolve);
      if (index >= 0) client.waiters.splice(index, 1);
      reject(new Error(`message timeout: ${client.clientId}:${type}`));
    }, timeoutMs);
    client.waiters.push({ type, resolve, timer });
  });
}

async function createTeacherPage(context, debug = true) {
  const page = await context.newPage();
  page.on('pageerror', (error) => metrics.pageErrors.push(error.message));
  await page.goto(`${baseUrl}/?role=teacher${debug ? '&debug=1' : ''}`);
  await page.waitForFunction(() => window.SUMUS_VISUAL_BUILD?.build === 'V0.9.2A');
  return page;
}

async function createBattle(page) {
  await page.getByRole('button', { name: /CREATE BATTLE/ }).click();
  await page.locator('[data-arena="run"]').click();
  const incheon = page.locator('[data-book-id="incheon-g1-sep-2025-selected"]');
  if (await incheon.count()) await incheon.click();
  await page.getByRole('button', { name: 'CREATE LOBBY →', exact: true }).click();
  const code = (await page.locator('#battleCode').textContent()).trim();
  const snapshot = await page.evaluate(() => window.SUMUS_TEACHER_AUDIT.snapshot());
  assert.match(code, /^\d{5}$/);
  assert.equal(snapshot.battleCode, code);
  return { code, battleId: snapshot.battleId };
}

async function joinReadyStudents(page, count, battle) {
  const clients = [];
  for (let index = 0; index < count; index += 1) {
    const clientId = `visual-${count}-${index + 1}-${Date.now()}`;
    const client = await openStudent(clientId);
    clients.push(client);
    const lookup = waitForMessage(client, 'BATTLE_STATE');
    send(client, 'BATTLE_LOOKUP', { code: battle.code });
    await lookup;
    const joinPayload = {
      battleId: battle.battleId,
      name: `학생${String(index + 1).padStart(2, '0')}`,
      deviceId: `visual-device-${count}-${index + 1}`
    };
    let joined;
    for (let attempt = 0; attempt < 3 && !joined; attempt += 1) {
      const accepted = waitForMessage(client, 'PLAYER_JOIN_ACCEPTED', 5000);
      send(client, 'PLAYER_JOIN_REQUEST', joinPayload);
      try { joined = await accepted; } catch (error) {
        if (attempt === 2) throw error;
      }
    }
    const playerId = joined.payload.playerId;
    const reconnectToken = joined.payload.reconnectToken || '';
    client.playerId = playerId;
    client.reconnectToken = reconnectToken;
    send(client, 'PLAYER_CHARACTER', { battleId: battle.battleId, playerId, reconnectToken, character: 'runner' });
    send(client, 'PLAYER_READY', { battleId: battle.battleId, playerId, reconnectToken });
    await new Promise((resolve) => setTimeout(resolve, 35));
  }
  let snapshot;
  for (let attempt = 0; attempt < 10; attempt += 1) {
    snapshot = await page.evaluate(() => window.SUMUS_TEACHER_AUDIT?.snapshot());
    if (snapshot?.players.length === count && snapshot.players.every((player) => player.ready)) return clients;
    const unreadyIds = new Set((snapshot?.players || []).filter((player) => !player.ready).map((player) => player.id));
    clients.filter((client) => unreadyIds.has(client.playerId)).forEach((client) => {
      send(client, 'PLAYER_READY', {
        battleId: battle.battleId, playerId: client.playerId,
        reconnectToken: client.reconnectToken
      });
    });
    await new Promise((resolve) => setTimeout(resolve, 650));
  }
  throw new Error(`students did not become ready: expected ${count}, state ${JSON.stringify(snapshot?.players?.map((player) => ({ name: player.name, ready: player.ready })))}`);
}

async function measureProductionLobbyControls(page) {
  return page.evaluate(() => {
    const hidden = (selector) => {
      const node = document.querySelector(selector);
      return !node || getComputedStyle(node).display === 'none' || !node.getClientRects().length;
    };
    const visible = (selector) => !hidden(selector);
    return {
      viewport: [innerWidth, innerHeight],
      productionControlsVisible: {
        forceStartBattle: visible('#forceStartBattle'),
        addDemoPlayers: visible('#addDemoPlayers'),
        clearPlayers: visible('#clearPlayers'),
        copyStudentUrl: visible('#copyStudentUrl')
      },
      qaControlsHidden: {
        autoRace: hidden('#autoRace'),
        demoSpeed: hidden('.demo-speed'),
        openStudentTest: hidden('#openStudentTest'),
        debugPanel: hidden('#debugPanel'),
        buildBadge: hidden('.v091-buildtag')
      }
    };
  });
}

async function measureRun(page) {
  return page.evaluate(() => {
    const rect = (node) => {
      if (!node) return null;
      const value = node.getBoundingClientRect();
      return { x: value.x, y: value.y, width: value.width, height: value.height, right: value.right, bottom: value.bottom };
    };
    const stageNode = document.getElementById('raceStage');
    const stage = rect(stageNode);
    const runners = [...document.querySelectorAll('#runners > .runner-v3')].map((node) => ({
      id: node.dataset.runner,
      runner: rect(node),
      nameplate: rect(node.querySelector('.nameplate')),
      rank: node.dataset.v092aRank || ''
    }));
    const intersectionRatio = (a, b) => {
      if (!a || !b) return 0;
      const width = Math.max(0, Math.min(a.right, b.right) - Math.max(a.x, b.x));
      const height = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.y, b.y));
      return (width * height) / Math.max(1, Math.min(a.width * a.height, b.width * b.height));
    };
    let overlappingNameplates = 0;
    let maxNameplateOverlap = 0;
    for (let left = 0; left < runners.length; left += 1) {
      for (let right = left + 1; right < runners.length; right += 1) {
        const ratio = intersectionRatio(runners[left].nameplate, runners[right].nameplate);
        if (ratio > 0.02) overlappingNameplates += 1;
        maxNameplateOverlap = Math.max(maxNameplateOverlap, ratio);
      }
    }
    const within = (value, outer, tolerance = 2) => value && outer &&
      value.x >= outer.x - tolerance && value.right <= outer.right + tolerance &&
      value.y >= outer.y - tolerance && value.bottom <= outer.bottom + tolerance;
    const hidden = (selector) => {
      const node = document.querySelector(selector);
      return !node || getComputedStyle(node).display === 'none' || !node.getClientRects().length;
    };
    return {
      viewport: [innerWidth, innerHeight],
      runnerCount: runners.length,
      stage,
      runnersOutsideStage: runners.filter((item) => !within(item.runner, stage)).map((item) => item.id),
      nameplatesOutsideStage: runners.filter((item) => !within(item.nameplate, stage)).map((item) => item.id),
      overlappingNameplatePairs: overlappingNameplates,
      maxNameplateOverlap: Number(maxNameplateOverlap.toFixed(3)),
      productionControlsHidden: {
        buildTag: hidden('.v091-buildtag'), autoDemo: hidden('#autoRace'),
        demoSpeed: hidden('.demo-speed'), debugPanel: hidden('#debugPanel'),
        studentLab: hidden('#studentLabLauncher'), openStudentTest: hidden('#openStudentTest')
      },
      rankingRows: document.querySelectorAll('#ranking .rank-row').length,
      visualBuild: window.SUMUS_VISUAL_BUILD?.build || ''
    };
  });
}

async function runTeacherScenario(count) {
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  let page = await createTeacherPage(context, false);
  const battle = await createBattle(page);
  const lobbyMetrics = await measureProductionLobbyControls(page);
  assert.deepEqual(lobbyMetrics.viewport, [1920, 1080]);
  assert.ok(Object.values(lobbyMetrics.productionControlsVisible).every(Boolean));
  assert.ok(Object.values(lobbyMetrics.qaControlsHidden).every(Boolean));
  metrics.lobbies[count] = lobbyMetrics;
  const students = await joinReadyStudents(page, count, battle);
  // Synthetic sockets do not run the student UI heartbeat, so the existing
  // production FORCE START control is used to enter the renderer. The page is
  // then refreshed to exercise production recovery before capture.
  await page.locator('#forceStartBattle').click();
  await page.locator('#race.active').waitFor({ timeout: 30000 });
  await page.waitForFunction((expected) => document.querySelectorAll('#runners > .runner-v3').length === expected, count);
  await page.waitForTimeout(900);

  await page.goto(`${baseUrl}/?role=teacher`);
  await page.waitForFunction(() => window.SUMUS_VISUAL_BUILD?.build === 'V0.9.2A');
  await page.waitForFunction((expected) => {
    const audit = window.SUMUS_TEACHER_AUDIT;
    return audit?.restoreApplied() && audit.snapshot().players.length === expected;
  }, count, { timeout: 12000 });
  await page.locator('#race.active').waitFor({ timeout: 12000 });
  await page.waitForFunction((expected) => document.querySelectorAll('#runners > .runner-v3').length === expected, count);
  await page.waitForTimeout(5200);

  const runMetrics = await measureRun(page);
  assert.deepEqual(runMetrics.viewport, [1920, 1080]);
  assert.equal(runMetrics.runnerCount, count);
  assert.equal(runMetrics.visualBuild, 'V0.9.2A');
  assert.ok(Object.values(runMetrics.productionControlsHidden).every(Boolean));
  assert.deepEqual(runMetrics.runnersOutsideStage, []);
  assert.deepEqual(runMetrics.nameplatesOutsideStage, []);
  assert.equal(runMetrics.overlappingNameplatePairs, 0);
  metrics.runs[count] = runMetrics;
  await page.screenshot({ path: path.join(qaDir, `after-run-${count}-1920x1080.png`) });

  if (count === 8) {
    await page.getByRole('button', { name: 'FINISH', exact: true }).click();
    await page.locator('#results.active').waitFor({ timeout: 6000 });
    await page.waitForTimeout(3200);
    await page.screenshot({ path: path.join(qaDir, 'after-teacher-results-1920x1080.png') });
  }
  students.forEach((student) => student.ws.close());
  await context.close();
}

async function captureTeacherHome() {
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await createTeacherPage(context, false);
  const state = await page.evaluate(() => ({
    viewport: [innerWidth, innerHeight],
    buildTagHidden: !document.querySelector('.v091-buildtag')?.getClientRects().length,
    debugPanelHidden: !document.querySelector('#debugPanel')?.getClientRects().length
  }));
  assert.deepEqual(state.viewport, [1920, 1080]);
  assert.equal(state.buildTagHidden, true);
  assert.equal(state.debugPanelHidden, true);
  await page.screenshot({ path: path.join(qaDir, 'after-teacher-home-1920x1080.png') });
  await context.close();
}

async function captureStudent(width, height) {
  const context = await browser.newContext({ viewport: { width, height } });
  const page = await context.newPage();
  page.on('pageerror', (error) => metrics.pageErrors.push(error.message));
  await page.goto(`${baseUrl}/?role=student&lab=1`);
  await page.waitForFunction(() => window.SUMUS_VISUAL_BUILD?.build === 'V0.9.2A');
  await page.locator('.student-answer').first().waitFor({ timeout: 8000 });
  const studentMetrics = await page.evaluate(() => {
    const shell = document.querySelector('.student-shell')?.getBoundingClientRect();
    const answers = [...document.querySelectorAll('.student-answer')].map((node) => node.getBoundingClientRect());
    const pass = document.querySelector('.student-pass')?.getBoundingClientRect();
    const inside = (value) => value && value.x >= -1 && value.right <= innerWidth + 1 && value.y >= -1 && value.bottom <= innerHeight + 1;
    return {
      viewport: [innerWidth, innerHeight],
      shellInsideViewport: inside(shell),
      answersInsideViewport: answers.every(inside),
      passInsideViewport: inside(pass),
      answers: answers.length,
      buildTagHidden: !document.querySelector('.v091-buildtag')?.getClientRects().length,
      debugToolsHidden: !document.querySelector('.student-debug')?.getClientRects().length
    };
  });
  assert.deepEqual(studentMetrics.viewport, [width, height]);
  assert.equal(studentMetrics.shellInsideViewport, true);
  assert.equal(studentMetrics.answersInsideViewport, true);
  assert.equal(studentMetrics.passInsideViewport, true);
  assert.equal(studentMetrics.buildTagHidden, true);
  assert.equal(studentMetrics.debugToolsHidden, true);
  metrics.students[`${width}x${height}`] = studentMetrics;
  await page.screenshot({ path: path.join(qaDir, `after-student-question-${width}x${height}.png`) });
  await page.locator('.student-answer').first().click();
  const feedback = page.locator('.student-result-flash');
  await feedback.waitFor({ state: 'visible', timeout: 3000 });
  if (width === 390) await page.screenshot({ path: path.join(qaDir, 'after-student-feedback-390x844.png') });
  await context.close();
}

(async () => {
  fs.mkdirSync(qaDir, { recursive: true });
  server = spawn(process.execPath, ['bootstrap.js'], {
    cwd: root,
    env: { ...process.env, PORT: String(port), HOST: '127.0.0.1', SUMUS_COMMIT: 'v092a-visual-qa' },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  server.stdout.on('data', (chunk) => { serverLog += chunk; });
  server.stderr.on('data', (chunk) => { serverLog += chunk; });
  await waitForHealth();
  browser = await chromium.launch({ executablePath: resolveChromePath(), headless: true });

  await captureTeacherHome();
  for (const count of runCounts) await runTeacherScenario(count);
  await captureStudent(390, 844);
  await captureStudent(360, 800);

  assert.deepEqual(metrics.pageErrors, []);
  fs.writeFileSync(path.join(qaDir, 'visual-metrics.json'), `${JSON.stringify(metrics, null, 2)}\n`);
  console.log(JSON.stringify({
    ok: true,
    runCounts: Object.keys(metrics.runs).map(Number),
    studentViewports: Object.keys(metrics.students),
    maxNameplateOverlap: Math.max(...Object.values(metrics.runs).map((run) => run.maxNameplateOverlap)),
    pageErrors: metrics.pageErrors.length
  }));
})().catch((error) => {
  console.error(error.stack || error);
  if (metrics.pageErrors.length) console.error(`Page errors:\n${metrics.pageErrors.join('\n')}`);
  if (serverLog) console.error(`Server log tail:\n${serverLog.slice(-8000)}`);
  process.exitCode = 1;
}).finally(async () => {
  await browser?.close();
  server?.kill('SIGTERM');
});
