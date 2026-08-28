'use strict';

const { spawn } = require('child_process');
const http = require('http');
const path = require('path');

const root = path.join(__dirname, '..');
const port = Number(process.env.SUMUS_LOAD_PORT || 8892);
const server = spawn(process.execPath, ['bootstrap.js'], {
  cwd: root,
  env: { ...process.env, PORT: String(port), HOST: '127.0.0.1', SUMUS_COMMIT: 'loadtest' },
  stdio: ['ignore', 'pipe', 'pipe']
});
let serverLog = '';
server.stdout.on('data', (chunk) => { serverLog += chunk; });
server.stderr.on('data', (chunk) => { serverLog += chunk; });

function waitForHealth(timeoutMs = 15000) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const probe = () => {
      const request = http.get(`http://127.0.0.1:${port}/health`, (response) => {
        response.resume();
        if (response.statusCode === 200) resolve();
        else retry();
      });
      request.on('error', retry);
      request.setTimeout(800, () => request.destroy());
    };
    const retry = () => {
      if (Date.now() - started > timeoutMs) reject(new Error(`server health timeout\n${serverLog}`));
      else setTimeout(probe, 120);
    };
    probe();
  });
}

function runLoad() {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['scripts/load-test-24.js'], {
      cwd: root,
      env: { ...process.env, SUMUS_LOAD_ORIGIN: `ws://127.0.0.1:${port}` },
      stdio: 'inherit'
    });
    child.on('exit', (code) => code === 0 ? resolve() : reject(new Error(`load test exited ${code}`)));
  });
}

(async () => {
  try {
    await waitForHealth();
    await runLoad();
  } finally {
    server.kill('SIGTERM');
  }
})().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
