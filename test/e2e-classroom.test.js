'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { chromium } = require('playwright-core');

const root = path.join(__dirname, '..');
const port = Number(process.env.SUMUS_E2E_PORT || 8891);
const baseUrl = `http://127.0.0.1:${port}`;
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
  if (!found) {
    throw new Error('Chrome/Chromium executable not found. Set SUMUS_CHROME_PATH to the browser executable.');
  }
  return found;
}
const chromePath = resolveChromePath();
let server;
let browser;
let serverLog = '';
const authoritativeDataset = JSON.parse(fs.readFileSync(path.join(root, 'data', 'v09-authoritative-books.json'), 'utf8'));
const hasIncheon = authoritativeDataset.books.some((book) => book.id === 'incheon-g1-sep-2025-selected');

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
      ? reject(new Error(`E2E server health timeout\n${serverLog}`))
      : setTimeout(probe, 120);
    probe();
  });
}

test.before(async () => {
  server = spawn(process.execPath, ['bootstrap.js'], {
    cwd: root,
    env: { ...process.env, PORT: String(port), HOST: '127.0.0.1', SUMUS_COMMIT: 'e2etest' },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  server.stdout.on('data', (chunk) => { serverLog += chunk; });
  server.stderr.on('data', (chunk) => { serverLog += chunk; });
  await waitForHealth();
  browser = await chromium.launch({ executablePath: chromePath, headless: true });
});

test.after(async () => {
  await browser?.close();
  server?.kill('SIGTERM');
});

test('Incheon authoritative ranges isolate the actual pools', () => {
  const book = authoritativeDataset.books.find((candidate) => candidate.id === 'incheon-g1-sep-2025-selected');
  assert.ok(book, 'Missing incheon-g1-sep-2025-selected authoritative source');
  const units = [...new Set(book.words.map((word) => word.unit))];
  assert.deepEqual(units, ['31번', '34번', '36번', '38번', '40번', '43~45번']);
  assert.deepEqual(units.slice(units.indexOf('31번'), units.indexOf('34번') + 1), ['31번', '34번']);
  assert.deepEqual(units.slice(units.indexOf('36번'), units.indexOf('40번') + 1), ['36번', '38번', '40번']);
  const a = new Set(['31번', '34번']);
  const b = new Set(['36번', '38번', '40번']);
  assert.equal(book.words.filter((word) => a.has(word.unit) && b.has(word.unit)).length, 0);
  assert.equal(book.words.filter((word) => a.has(word.unit)).length, 78);
  assert.equal(book.words.filter((word) => b.has(word.unit)).length, 100);
});

test('HOME to results survives student reconnect and teacher refresh', { timeout: 60000 }, async () => {
  const teacherContext = await browser.newContext();
  const teacher = await teacherContext.newPage();
  const pageErrors = [];
  teacher.on('pageerror', (error) => pageErrors.push(`teacher: ${error.message}`));
  await teacher.goto(`${baseUrl}/?role=teacher`);
  await assert.doesNotReject(() => teacher.getByRole('button', { name: /CREATE BATTLE/ }).click());
  await teacher.locator('[data-arena="run"]').click();
  if (hasIncheon) await teacher.locator('[data-book-id="incheon-g1-sep-2025-selected"]').click();
  else await teacher.getByRole('button', { name: /BOOK 04 .*김은형/ }).click();
  await teacher.getByRole('button', { name: 'INDIVIDUAL', exact: true }).click();
  const rows = teacher.locator('.v083-row');
  const rangeA = hasIncheon ? ['31번', '34번'] : ['LESSON 1', 'LESSON 1'];
  const rangeB = hasIncheon ? ['36번', '40번'] : ['LESSON 2', 'LESSON 2'];
  await rows.nth(0).locator('[data-v083-from]').selectOption({ label: rangeA[0] });
  await rows.nth(0).locator('[data-v083-to]').selectOption({ label: rangeA[1] });
  await rows.nth(1).locator('[data-v083-from]').selectOption({ label: rangeB[0] });
  await rows.nth(1).locator('[data-v083-to]').selectOption({ label: rangeB[1] });
  await teacher.getByRole('button', { name: 'CREATE LOBBY →', exact: true }).click();
  const code = (await teacher.locator('#battleCode').textContent()).trim();
  assert.match(code, /^\d{5}$/);

  async function joinStudent(name, rangeNumber) {
    const context = await browser.newContext();
    const page = await context.newPage();
    page.on('pageerror', (error) => pageErrors.push(`${name}: ${error.message}`));
    await page.goto(`${baseUrl}/?role=student&code=${code}`);
    await page.getByRole('textbox').waitFor();
    await page.getByRole('textbox').fill(name);
    await page.getByRole('button', { name: 'CONTINUE', exact: true }).click();
    await page.getByRole('button', { name: new RegExp(`^${rangeNumber} ${rangeNumber}번 범위`) }).click();
    await page.getByRole('button', { name: /PLAYER 1/ }).click();
    await page.getByRole('button', { name: 'READY', exact: true }).click();
    return { context, page };
  }

  const studentA = await joinStudent('학생A', 1);
  const studentB = await joinStudent('학생B', 2);
  await teacher.getByText('학생A', { exact: true }).waitFor();
  await teacher.getByText('학생B', { exact: true }).waitFor();
  const audit = await teacher.evaluate(() => ({
    valid: window.SUMUS_RANGE_AUDIT.check(),
    players: window.SUMUS_RANGE_AUDIT.players(),
    pools: Object.fromEntries(window.SUMUS_RANGE_AUDIT.players().map((player) => [player.name, window.SUMUS_RANGE_AUDIT.poolForPlayer(player.id)]))
  }));
  assert.equal(audit.valid, true);
  const expectedA = hasIncheon ? ['31번', '34번'] : ['LESSON 1'];
  const expectedB = hasIncheon ? ['36번', '38번', '40번'] : ['LESSON 2'];
  assert.deepEqual(audit.players.find((player) => player.name === '학생A').units, expectedA);
  assert.deepEqual(audit.players.find((player) => player.name === '학생B').units, expectedB);
  assert.ok(audit.pools['학생A'].every((word) => expectedA.includes(word.unit) && !expectedB.includes(word.unit)));
  assert.ok(audit.pools['학생B'].every((word) => expectedB.includes(word.unit) && !expectedA.includes(word.unit)));

  await teacher.getByRole('button', { name: 'START BATTLE →', exact: true }).click();
  await studentA.page.getByText(/Q 1 \/ 20/).waitFor({ timeout: 10000 });
  await studentB.page.getByText(/Q 1 \/ 20/).waitFor({ timeout: 10000 });
  await studentA.page.locator('.student-answer').first().click();
  await studentA.page.getByText(/Q 2 \/ 20/).waitFor({ timeout: 5000 });

  await teacher.getByRole('button', { name: 'PAUSE', exact: true }).click();
  await teacher.getByRole('button', { name: 'RESUME', exact: true }).click();
  const playersBeforeStudentReload = await teacher.evaluate(() => window.SUMUS_TEACHER_AUDIT.snapshot().players.map((player) => ({ id: player.id, name: player.name })));
  await studentB.page.reload();
  await studentB.page.getByText(/Q 1 \/ 20|기다리고 있습니다/).waitFor({ timeout: 10000 });
  await teacher.waitForFunction((expected) => {
    const current = window.SUMUS_TEACHER_AUDIT.snapshot().players.map((player) => ({ id: player.id, name: player.name }));
    return JSON.stringify(current) === JSON.stringify(expected);
  }, playersBeforeStudentReload);

  await teacher.getByRole('button', { name: 'PAUSE', exact: true }).click();
  await teacher.waitForTimeout(150);
  const beforeRefresh = await teacher.evaluate(() => window.SUMUS_TEACHER_AUDIT.snapshot());
  assert.equal(beforeRefresh.race.paused, true);
  await teacher.reload();
  await teacher.waitForFunction(() => window.SUMUS_TEACHER_AUDIT?.restoreApplied(), null, { timeout: 10000 });
  const afterRefresh = await teacher.evaluate(() => window.SUMUS_TEACHER_AUDIT.snapshot());
  assert.equal(afterRefresh.battleId, beforeRefresh.battleId);
  assert.equal(afterRefresh.battleCode, beforeRefresh.battleCode);
  assert.equal(afterRefresh.bookId, beforeRefresh.bookId);
  assert.equal(afterRefresh.rangeMode, beforeRefresh.rangeMode);
  assert.deepEqual(afterRefresh.rangeOptions, beforeRefresh.rangeOptions);
  assert.deepEqual(afterRefresh.players.map((player) => ({
    id: player.id, name: player.name, ready: player.ready, score: player.score,
    distance: player.distance, combo: player.combo, questionIndex: player.questionIndex,
    units: player.units
  })), beforeRefresh.players.map((player) => ({
    id: player.id, name: player.name, ready: player.ready, score: player.score,
    distance: player.distance, combo: player.combo, questionIndex: player.questionIndex,
    units: player.units
  })));
  assert.deepEqual(afterRefresh.race, beforeRefresh.race);
  assert.equal(afterRefresh.race.paused, true);

  await teacher.getByRole('button', { name: 'RESUME', exact: true }).click();
  await teacher.getByRole('button', { name: 'FINISH', exact: true }).click();
  await teacher.locator('#results.active').waitFor({ timeout: 5000 });
  assert.deepEqual(pageErrors, []);
  await studentA.context.close();
  await studentB.context.close();
  await teacherContext.close();
});
