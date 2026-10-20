import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createStorageMock } from './storage-mock.mjs';
import { TEST_APP, applyTestSeed } from './test-seed.mjs';
import { LEGENDARY_PET_KEYS, MYTHIC_PET_KEYS } from '../public/modules/core.js';
import { VocaStateObject } from '../cloudflare/worker.mjs';

// V13.149 테스트 앱 검사: 운영 Worker · 운영 Supabase · 운영 비밀값에 닿지 않는지, Supabase 없이 켜지고 저장이 남는지.
const root = new URL('../', import.meta.url);
const read = path => readFileSync(new URL(path, root), 'utf8');

// 문자열 안의 '//'(주소)는 건드리지 않고 주석만 지운다.
export function parseJsonc(text) {
  let out = '', inStr = false;
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    if (inStr) { out += c; if (c === '\\') out += text[++i]; else if (c === '"') inStr = false; continue; }
    if (c === '"') { inStr = true; out += c; continue; }
    if (c === '/' && text[i + 1] === '/') { while (i < text.length && text[i] !== '\n') i += 1; out += '\n'; continue; }
    if (c === '/' && text[i + 1] === '*') { i = text.indexOf('*/', i + 2) + 1; continue; }
    out += c;
  }
  return JSON.parse(out.replace(/,(\s*[}\]])/g, '$1'));
}

// 테스트 설정이 운영을 가리키면 오류 목록(빈 배열이면 괜찮다). 배포 직전 가드(test-app-guard.mjs)도 같이 쓴다.
export function testEnvProblems(config) {
  const t = config.env?.test, problems = [];
  if (!t) return ['wrangler.jsonc에 env.test가 없습니다.'];
  if (t.name !== TEST_APP.WORKER || t.name === config.name) problems.push(`테스트 Worker 이름이 ${TEST_APP.WORKER}가 아닙니다: ${t.name}`);
  if (t.vars?.SUPABASE_URL !== '' || t.vars?.SUPABASE_ANON_KEY !== '') problems.push('테스트 앱의 SUPABASE_URL · SUPABASE_ANON_KEY는 비어 있어야 합니다.');
  if (t.vars?.VOCA_STANDALONE !== '1') problems.push('테스트 앱은 VOCA_STANDALONE=1이어야 합니다.');
  if (JSON.stringify(t).includes('supabase.co')) problems.push('테스트 설정에 Supabase 주소가 있습니다.');
  if (!Array.isArray(t.triggers?.crons) || t.triggers.crons.length) problems.push('테스트 앱은 저녁 알림(cron)을 끕니다.');
  const names = b => (b?.bindings || []).map(x => `${x.name}:${x.class_name}`).sort().join(',');
  if (names(t.durable_objects) !== names(config.durable_objects)) problems.push('테스트 앱의 Durable Object 연결이 운영 설정과 같아야 합니다.');
  return problems;
}

export async function runTestAppChecks() {
  const config = parseJsonc(read('wrangler.jsonc'));
  assert.equal(config.name, 'sumus-voca', '운영 Worker 이름은 그대로');
  assert.deepEqual(testEnvProblems(config), [], '테스트 앱 설정');
  assert(testEnvProblems({ ...config, env: { test: { ...config.env.test, vars: { ...config.env.test.vars, SUPABASE_URL: config.vars.SUPABASE_URL } } } }).some(x => x.includes('Supabase')), '운영 Supabase를 넣으면 가드가 막는다');

  // 배포 워크플로: 테스트는 언제나 --env test, 운영 비밀값과 운영 브랜치는 쓰지 않는다. 운영 배포는 작업 브랜치로 돌지 않는다.
  const wf = read('.github/workflows/deploy-test.yml'), prod = read('.github/workflows/deploy-cloudflare.yml');
  const deploys = wf.split('\n').filter(line => /wrangler (deploy|secret)/.test(line) && !line.trim().startsWith('#'));
  assert(deploys.length >= 2 && deploys.every(line => line.includes('--env test')), '테스트 워크플로의 wrangler 배포는 모두 --env test');
  assert(!wf.includes('secrets.VOCA_STATE_SECRET') && !wf.includes('sumus-voca-prod-deploy'), '테스트 워크플로는 운영 비밀값 · 운영 브랜치를 쓰지 않는다');
  assert(wf.includes('test-app-guard.mjs') && wf.includes('npm run check:cloudflare'), '테스트 배포도 검사와 가드를 거친다');
  assert(/branches: \[sumus-voca-prod-deploy\]/.test(prod) && !prod.includes('claude/'), '운영 배포는 운영 브랜치에서만');

  assert(read('public/app.js').includes("is-test-app") && read('public/v13149.css').includes('.is-test-app body::before'), '테스트 앱 화면에는 테스트 표시');

  // Supabase 없이 켜진다: 네트워크를 부르면 실패. 처음엔 테스트 계정, 다시 켜도 저장한 내용이 남는다.
  const nativeFetch = globalThis.fetch;
  globalThis.fetch = async url => { throw Error(`테스트 앱이 외부로 요청했습니다: ${url}`); };
  try {
    const storage = createStorageMock();
    const env = { VOCA_STANDALONE: '1', SUPABASE_URL: '', SUPABASE_ANON_KEY: '', VOCA_STATE_SECRET: 'test-only', VOCA_COMMIT_GROUP_MS: 0 };
    const boot = () => new VocaStateObject({ storage, blockConcurrencyWhile: callback => callback(), waitUntil: () => {} }, env);
    const call = object => async (path, { method = 'GET', body, cookie } = {}) => {
      const response = await object.fetch(new Request(`https://sumus-voca-test.example${path}`, { method, headers: { origin: 'https://sumus-voca-test.example', ...(body ? { 'content-type': 'application/json' } : {}), ...(cookie ? { cookie } : {}) }, body: body ? JSON.stringify(body) : undefined }));
      return { status: response.status, payload: await response.json(), cookie: response.headers.get('set-cookie')?.split(';')[0] };
    };
    let object = boot();
    await object.ready;
    let api = call(object);
    const health = await api('/api/health');
    assert.equal(health.payload.ok, true, '테스트 앱 health ok');
    const teacher = await api('/api/login', { method: 'POST', body: { username: TEST_APP.TEACHER, password: TEST_APP.PASSWORD, role: 'teacher' } });
    assert.equal(teacher.status, 200, '테스트 선생님 로그인');
    const s1 = await api('/api/login', { method: 'POST', body: { username: TEST_APP.STUDENTS[0][0], password: TEST_APP.PASSWORD, role: 'student' } });
    assert.equal(s1.status, 200, '테스트 학생 로그인');
    const view = await api('/api/bootstrap', { cookie: s1.cookie });
    assert.equal(view.payload.rewards.reel.bait, TEST_APP.BAIT, '테스트 학생은 미끼 10개로 시작');
    // V13.162 펫 사냥: 공(기본 6 · 좋은 3 · 황금 1)과 지도에 새 친구 '?' 하나.
    assert(view.payload.rewards.hunt.basic === TEST_APP.HUNT.basic && view.payload.rewards.hunt.good === TEST_APP.HUNT.good && view.payload.rewards.hunt.gold === TEST_APP.HUNT.gold, '테스트 학생은 펫 사냥 공을 들고 시작');
    const hunt = await api('/api/hunt/home', { method: 'POST', cookie: s1.cookie, body: {} });
    assert(hunt.status === 200 && hunt.payload.hunt.spots.some(s => s.fresh) && hunt.payload.hunt.spots.length >= 3, '테스트 학생 지도에는 새 친구 ? 하나와 가진 펫이 있다');
    const pets = object.mutations.current().state.profiles.find(p => p.username === 'ts1').pets.map(p => p.key);
    assert(LEGENDARY_PET_KEYS.length && MYTHIC_PET_KEYS.length && [...LEGENDARY_PET_KEYS, ...MYTHIC_PET_KEYS].every(k => pets.includes(k)), '테스트 학생은 전설 · 신화 펫을 모두 가진다');
    const t2 = await api('/api/login', { method: 'POST', body: { username: 'tteacher2', password: TEST_APP.PASSWORD, role: 'teacher' } });
    assert.equal(t2.status, 200, '테스트 선생님 2 로그인');
    const sold = await api('/api/reel/sell', { method: 'POST', cookie: s1.cookie, body: { key: 'minnow', n: 1 } });
    assert.equal(sold.status, 200, JSON.stringify(sold.payload));
    assert.equal(sold.payload.reel.net.minnow, 4);
    await object.sync.run();
    object.sync.close();

    object = boot();
    await object.ready;
    api = call(object);
    const again = await api('/api/login', { method: 'POST', body: { username: TEST_APP.STUDENTS[0][0], password: TEST_APP.PASSWORD, role: 'student' } });
    const after = await api('/api/bootstrap', { cookie: again.cookie });
    assert.equal(after.payload.rewards.reel.net.minnow, 4, '다시 켜도 처음 데이터로 돌아가지 않는다');
    // 미끼를 쓰고 다시 켜도 덧붙이기(applyTestSeed)는 한 번만: 미끼가 10개로 다시 차지 않는다.
    const cast = await api('/api/reel/cast', { method: 'POST', cookie: again.cookie, body: { id: 'chk-cast-1', cast: 'ok' } });
    assert.equal(cast.status, 200, JSON.stringify(cast.payload));
    await object.sync.run();
    object.sync.close();
    object = boot();
    await object.ready;
    assert.equal(object.mutations.current().state.profiles.find(p => p.username === 'ts1').reel.bait, TEST_APP.BAIT - 1, '테스트 덧붙이기는 판마다 한 번만');
    object.sync.close();

    // 예전 판(1)으로 켜져 있던 테스트 앱: 새 판에서 선생님 2 · 전설 · 신화 펫 · 미끼 10을 덧붙인다(쓰던 기록은 그대로).
    const prev = structuredClone(object.mutations.current().state);
    delete prev.test_seed;
    prev.profiles = prev.profiles.filter(p => p.username !== 'tteacher2');
    const ts2 = prev.profiles.find(p => p.username === 'ts2'); ts2.pets = [{ key: 'cat', first: true }]; ts2.reel.bait = 3;
    assert.equal(await applyTestSeed(prev), true);
    assert(prev.profiles.some(p => p.username === 'tteacher2') && ts2.pets.length === 1 + LEGENDARY_PET_KEYS.length + MYTHIC_PET_KEYS.length && ts2.reel.bait === TEST_APP.BAIT && ts2.pets[0].first, '예전 판에 덧붙이기');
    assert.equal(prev.profiles.find(p => p.username === 'ts1').reel.net.minnow, 4, '덧붙여도 쓰던 기록은 그대로');
    assert.equal(await applyTestSeed(prev), false, '같은 판은 다시 덧붙이지 않는다');
  } finally {
    globalThis.fetch = nativeFetch;
  }
  console.log('[test-app-check] PASS 테스트 앱: 운영과 분리 · Supabase 없이 시작 · 다시 켜도 저장 유지');
}
