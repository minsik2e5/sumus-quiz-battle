// V13.212.1 선생님 로그인 오류 검사(npm run check). 증상(2026-11-04 운영): 선생님이 로그인하면 'Cannot read properties of
// undefined (reading 'role')'. 원인: api()(public/modules/ui.js)의 12초 시간 제한이 본문을 받는 동안에도 걸려서, 느린 와이파이에서
// 선생님 홈(/api/bootstrap, 운영 크기 약 1.3MB)을 다 받기 전에 끊기면 r.json()이 실패하고, 그것을 빈 답({})으로 넘겨
// app.js refresh()가 A.data.profile.role에서 멈췄다(Playwright 400kbps로 재현: 예전 16초 뒤 같은 오류, 고친 뒤 로그인).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { api } from '../public/modules/ui.js';

const source = path => readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8');

export async function runBootstrapGuardChecks(assert) {
  const realFetch = globalThis.fetch;
  const calls = [];
  const answer = queue => async (url, init) => { calls.push({ url, timeoutSignal: init.signal }); const next = queue.shift(); return typeof next === 'function' ? next(init) : next; };
  try {
    // 1. 200인데 본문이 잘림 · HTML이면 빈 답을 주지 않고 한국어 오류(GET은 한 번 더 받아 본다).
    calls.length = 0;
    globalThis.fetch = answer([new Response('{"profile":{"role":"tea', { status: 200, headers: { 'content-type': 'application/json' } }), new Response('<html>', { status: 200, headers: { 'content-type': 'text/html' } })]);
    const cut = await api('/bootstrap').then(() => null, e => e);
    assert(cut && /서버 답을 다 받지 못했어요\(형식이 달라요: text\/html\)/.test(cut.message) && calls.length === 2 && cut.transient,
      `V13.212.1 200인데 본문을 못 읽으면 빈 답 대신 한국어 오류, GET은 한 번 더 받아 본다 (${cut?.message})`);
    calls.length = 0;
    globalThis.fetch = answer([new Response('{"profile":{"role":"tea', { status: 200, headers: { 'content-type': 'application/json' } })]);
    const post = await api('/login', { username: 'x' }).then(() => null, e => e);
    assert(post && post.message.includes('답이 중간에 끊겼어요') && calls.length === 1, 'V13.212.1 POST는 다시 보내지 않고(두 번 저장 방지) 끊긴 답이라고 알린다');
    // 2. 정상 답은 그대로.
    globalThis.fetch = answer([Response.json({ profile: { role: 'teacher' } })]);
    const ok = await api('/bootstrap');
    assert(ok?.profile?.role === 'teacher', 'V13.212.1 정상 답은 그대로 돌려준다');
    // 3. 시간 제한은 본문을 다 받을 때까지: 선생님 홈은 30초(느린 와이파이), 나머지는 12초 그대로.
    const ui = source('../public/modules/ui.js'), app = source('../public/app.js');
    assert(ui.includes('setTimeout(() => controller.abort(), Number(opts.timeoutMs) || 12000)') && ui.includes("controller.signal.aborted ? '받는 데 시간이 너무 걸렸어요'")
      && app.includes('const BOOTSTRAP_TIMEOUT_MS = 30000;') && app.includes("async function refresh() { A.data = await loadBootstrap();")
      && app.includes("if (!data?.profile) throw Object.assign(new Error('계정 정보를 받지 못했어요."),
      'V13.212.1 선생님 홈은 본문까지 30초, 계정 정보가 없으면 한 번 더 받고 그래도 없으면 한국어 안내(영어 오류로 멈추지 않음)');
  } finally {
    globalThis.fetch = realFetch;
  }
}
