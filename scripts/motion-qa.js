'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { chromium } = require('playwright-core');

const root = path.join(__dirname, '..');
const qaDir = path.join(root, 'qa', 'v0.9.2b');
const port = Number(process.env.SUMUS_MOTION_PORT || 8895);
const baseUrl = `http://127.0.0.1:${port}`;
const metrics = { build: 'V0.9.2B', premium: 'V0.9.2B.1', viewport: [1920, 1080], pageErrors: [], consoleErrors: [], ignoredResource404s: 0 };
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
      ? reject(new Error(`motion QA server health timeout\n${serverLog}`))
      : setTimeout(probe, 120);
    probe();
  });
}

async function createBattle(page) {
  await page.getByRole('button', { name: /CREATE BATTLE/ }).click();
  await page.locator('[data-arena="run"]').click();
  const incheon = page.locator('[data-book-id="incheon-g1-sep-2025-selected"]');
  if (await incheon.count()) await incheon.click();
  await page.getByRole('button', { name: 'CREATE LOBBY →', exact: true }).click();
  await page.locator('#lobby.active').waitFor({ timeout: 8000 });
}

(async () => {
  fs.mkdirSync(qaDir, { recursive: true });
  server = spawn(process.execPath, ['bootstrap.js'], {
    cwd: root,
    env: { ...process.env, PORT: String(port), HOST: '127.0.0.1', SUMUS_COMMIT: 'v092b-motion-qa' },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  server.stdout.on('data', (chunk) => { serverLog += chunk; });
  server.stderr.on('data', (chunk) => { serverLog += chunk; });
  await waitForHealth();

  browser = await chromium.launch({ executablePath: resolveChromePath(), headless: true });
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();
  page.on('pageerror', (error) => metrics.pageErrors.push(error.message));
  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    const text = message.text();
    if (/Failed to load resource: the server responded with a status of 404 \(Not Found\)/.test(text)) {
      metrics.ignoredResource404s += 1;
      return;
    }
    metrics.consoleErrors.push(text);
  });
  await page.goto(`${baseUrl}/?role=teacher&debug=1`);
  await page.waitForFunction(() => window.SUMUS_VISUAL_BUILD?.build === 'V0.9.2A');
  await page.waitForFunction(() => window.SUMUS_MOTION_BUILD?.build === 'V0.9.2B');
  await page.waitForFunction(() => window.SUMUS_PREMIUM_BUILD?.build === 'V0.9.2B.1');

  await createBattle(page);
  await page.locator('#addDemoPlayers').click();
  await page.waitForFunction(() => window.SUMUS_TEACHER_AUDIT?.snapshot().players.length === 10);
  await page.screenshot({ path: path.join(qaDir, 'motion-lobby-10-1920x1080.png') });

  await page.locator('#forceStartBattle').click();
  await page.locator('#race.active').waitFor({ timeout: 30000 });
  await page.waitForFunction(() => document.querySelectorAll('#runners > .runner-v3').length === 10);
  await page.waitForTimeout(500);

  const startState = await page.evaluate(() => {
    const stage = document.getElementById('raceStage');
    const entity = document.querySelector('#runners > .runner-v3 .entity-svg');
    const style = entity ? getComputedStyle(entity) : null;
    const rect = entity?.getBoundingClientRect();
    const stageRect = stage?.getBoundingClientRect();
    return {
      countdown: window.SUMUS_MOTION_AUDIT?.snapshot().countdownStages || [],
      stadiumDepth: Boolean(stage?.querySelector('.v092b1-stadium-depth')),
      runAnimation: style?.animationName || '',
      entityHeightRatio: rect && stageRect ? Number((rect.height / stageRect.height).toFixed(3)) : 0,
      visual: window.SUMUS_VISUAL_BUILD?.build,
      motion: window.SUMUS_MOTION_BUILD?.build,
      premium: window.SUMUS_PREMIUM_BUILD?.build
    };
  });
  metrics.start = startState;
  assert.equal(startState.visual, 'V0.9.2A');
  assert.equal(startState.motion, 'V0.9.2B');
  assert.equal(startState.premium, 'V0.9.2B.1');
  assert.equal(startState.stadiumDepth, true);
  assert.match(startState.runAnimation, /v092bRunCycle/);
  assert.ok(startState.entityHeightRatio > 0.05, `runner art unexpectedly small: ${startState.entityHeightRatio}`);
  for (const stage of ['READY', '3', '2', '1', 'GO!']) assert.ok(startState.countdown.includes(stage), `missing countdown stage ${stage}`);
  await page.screenshot({ path: path.join(qaDir, 'motion-run-start-10-1920x1080.png') });

  await page.locator('#demoSpeed').selectOption('4');
  await page.locator('#autoRace').click();
  await page.waitForFunction(() => window.SUMUS_MOTION_AUDIT?.snapshot().boostEvents > 0, null, { timeout: 10000 });
  await page.waitForFunction(() => window.SUMUS_MOTION_AUDIT?.snapshot().finalSprintActive, null, { timeout: 30000 });
  await page.screenshot({ path: path.join(qaDir, 'motion-final-sprint-10-1920x1080.png') });

  const finalStyle = await page.evaluate(() => ({
    audit: window.SUMUS_MOTION_AUDIT?.snapshot(),
    finalStage: document.getElementById('raceStage')?.classList.contains('v092b-final'),
    finalRace: document.getElementById('race')?.classList.contains('v092b-final'),
    premiumDepth: Boolean(document.querySelector('#raceStage .v092b1-stadium-depth')),
    finalBanner: Boolean(document.querySelector('.v092b-final-banner'))
  }));
  metrics.finalSprint = finalStyle;
  assert.equal(finalStyle.finalStage, true);
  assert.equal(finalStyle.finalRace, true);
  assert.equal(finalStyle.premiumDepth, true);
  assert.ok(finalStyle.audit.boostEvents > 0);
  assert.equal(finalStyle.audit.finalSprintEntries, 1);

  await page.locator('#results.active').waitFor({ timeout: 30000 });
  await page.waitForTimeout(1600);
  const resultState = await page.evaluate(() => ({
    audit: window.SUMUS_MOTION_AUDIT?.snapshot(),
    podiumSlots: document.querySelectorAll('#podium > .podium-slot').length,
    firstSpotlight: getComputedStyle(document.querySelector('#podium > .podium-slot[data-place="1"] .podium-block')).boxShadow
  }));
  metrics.results = resultState;
  assert.ok(resultState.audit.finishEvents > 0);
  assert.ok(resultState.podiumSlots >= 3);
  assert.notEqual(resultState.firstSpotlight, 'none');
  await page.screenshot({ path: path.join(qaDir, 'motion-results-10-1920x1080.png') });

  assert.deepEqual(metrics.pageErrors, []);
  assert.deepEqual(metrics.consoleErrors, []);
  fs.writeFileSync(path.join(qaDir, 'motion-metrics.json'), `${JSON.stringify(metrics, null, 2)}\n`);
  console.log(JSON.stringify({ ok: true, start: metrics.start, finalSprint: metrics.finalSprint.audit, results: metrics.results.audit, ignoredResource404s: metrics.ignoredResource404s }));
  await context.close();
})().catch((error) => {
  console.error(error.stack || error);
  if (metrics.pageErrors.length) console.error(`Page errors:\n${metrics.pageErrors.join('\n')}`);
  if (metrics.consoleErrors.length) console.error(`Console errors:\n${metrics.consoleErrors.join('\n')}`);
  if (serverLog) console.error(`Server log tail:\n${serverLog.slice(-8000)}`);
  process.exitCode = 1;
}).finally(async () => {
  await browser?.close();
  server?.kill('SIGTERM');
});
