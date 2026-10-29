// npm test — server.js 를 빈 포트로 띄우고 tests/*.test.js 를 차례로 실행
// 각 테스트 파일은 [{ name, fn, timeout? }] 배열을 module.exports 로 내보냄
const { spawn } = require('node:child_process');
const net = require('node:net');
const http = require('node:http');
const path = require('node:path');
const fs = require('node:fs');

const ROOT = path.join(__dirname, '..');
const only = process.argv[2] ? new RegExp(process.argv[2], 'i') : null; // npm test -- bk  처럼 이름으로 골라 실행

function freePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.unref(); srv.on('error', reject);
    srv.listen(0, '127.0.0.1', () => { const { port } = srv.address(); srv.close(() => resolve(port)); });
  });
}
function get(url) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, (res) => { res.resume(); res.on('end', () => resolve(res.statusCode)); });
    req.on('error', reject); req.setTimeout(1000, () => req.destroy(new Error('timeout')));
  });
}
async function waitListening(url, child, ms = 15000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (child.exitCode !== null) throw new Error('server exited early with code ' + child.exitCode);
    try { if ((await get(url + '/api/info')) === 200) return; } catch (_) {}
    await new Promise(r => setTimeout(r, 100));
  }
  throw new Error('server did not start listening within ' + ms + 'ms');
}
const withTimeout = (p, ms, name) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('test timeout after ' + ms + 'ms')), ms))]);

(async () => {
  const t0 = Date.now();
  const port = await freePort();
  const url = 'http://127.0.0.1:' + port;
  const child = spawn(process.execPath, [path.join(ROOT, 'server.js')], {
    cwd: ROOT, env: { ...process.env, PORT: String(port) }, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true,
  });
  // 서버가 남긴 오류 로그(console.error) — 이벤트 처리 중 예외가 나도 서버는 죽지 않고 로그만 남기므로 이것도 실패로 봄
  let errBuf = '', outBuf = '';
  child.stderr.setEncoding('utf8'); child.stdout.setEncoding('utf8');
  child.stderr.on('data', (d) => { errBuf += d; });
  child.stdout.on('data', (d) => { outBuf += d; if (outBuf.length > 200000) outBuf = outBuf.slice(-100000); });
  const killServer = () => { try { if (child.exitCode === null) child.kill(); } catch (_) {} };
  process.on('exit', killServer);
  process.on('SIGINT', () => { killServer(); process.exit(130); });

  let pass = 0, fail = 0; const failed = [];
  try {
    await waitListening(url, child);
    process.env.SUMUS_TEST_URL = url;
    console.log('server listening on ' + url + '\n');
    const lib = require('./lib');
    const files = fs.readdirSync(__dirname).filter(f => f.endsWith('.test.js')).sort();
    for (const f of files) {
      const cases = require(path.join(__dirname, f));
      console.log(f);
      for (const c of cases) {
        if (only && !only.test(f + ' ' + c.name)) continue;
        const errBefore = errBuf.length, start = Date.now();
        let err = null;
        try { await withTimeout(Promise.resolve().then(() => c.fn()), c.timeout || 30000, c.name); } catch (e) { err = e; }
        lib.closeAll();
        await new Promise(r => setTimeout(r, 50));
        const serverErr = errBuf.slice(errBefore).trim();
        if (!err && serverErr) err = new Error('server logged errors:\n' + serverErr);
        const ms = Date.now() - start;
        if (err) { fail++; failed.push(f + ' > ' + c.name); console.log('  FAIL ' + c.name + ' (' + ms + 'ms)\n       ' + String(err && err.stack || err).split('\n').slice(0, 6).join('\n       ')); }
        else { pass++; console.log('  ok   ' + c.name + ' (' + ms + 'ms)'); }
      }
    }
  } catch (e) {
    fail++; failed.push('runner'); console.log('RUNNER ERROR', e && e.stack || e);
    if (outBuf) console.log('--- server stdout ---\n' + outBuf.slice(-3000));
  } finally {
    killServer();
  }
  if (errBuf.trim() && fail) console.log('\n--- server stderr ---\n' + errBuf.slice(-4000));
  console.log('\n' + pass + ' passed, ' + fail + ' failed  (' + ((Date.now() - t0) / 1000).toFixed(1) + 's)');
  if (failed.length) console.log('failed:\n  ' + failed.join('\n  '));
  process.exit(fail ? 1 : 0);
})();
