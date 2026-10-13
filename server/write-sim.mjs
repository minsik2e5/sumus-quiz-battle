// V13.144 하루 쓰기 시뮬레이션: node server/write-sim.mjs
//
// 학생 60명(2반)이 하루에 연습 3번(문제 20개씩) + 야차전(로봇 연습) 2판 + 던전 방 1번 + 놀이터(가위바위보 5번,
// 행운 뽑기 1번)를 하는 하루를 상태 객체(VocaStateObject)에 실제 요청으로 보내고, 저장소 모의 객체가 센
// "쓴 줄 수"를 옛 방식(V13.143 코드 그대로)과 새 방식으로 비교한다. 상태는 운영처럼 약 4MB로 채운다.
//
// 시간은 10배 빠르게 돌린다: 답 사이 2.5~4.5초 → 0.25~0.45초, 쓰기 모으기 1.5초 → 0.15초, 백업 간격 60초 → 6초.
// 옛 코드는 git에서 꺼내(SIM_OLD_REF, 기본 V13.143.0 커밋) 잠깐 cloudflare-v13143/에 두고 끝나면 지운다.
// 대결 방 · 던전 방(따로 사는 Durable Object)은 이번에 바꾸지 않아서 두 방식이 같다: 코드에서 센 추정치를 따로 적는다.
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createStorageMock } from './storage-mock.mjs';
import { sampleState, clientFor } from './write-budget-check.mjs';
import { builtinBooks } from './service.mjs';
import { CF_FREE_PLAN } from '../cloudflare/cf-limits.mjs';

const STUDENTS = 60;
const PRACTICES = 3;
const QUESTIONS = 20;
const SPEED = 10;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
let seed = 7;
const random = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };

// 파트 백업 함수가 있는 가짜 Supabase(운영과 같은 'parts' 백업).
function fakeSupabase(state) {
  const v12 = { revision: 1, data: structuredClone(state) };
  const parts = { revision: 0, parts: {} };
  return async (url, options = {}) => {
    const name = String(url).split('/').at(-1);
    const body = JSON.parse(options.body || '{}');
    if (name === 'voca_v12_state_read') return Response.json([{ revision: v12.revision, data: structuredClone(v12.data) }]);
    if (name === 'voca_v12_state_commit') { v12.data = body.p_data; v12.revision += 1; return Response.json(v12.revision); }
    if (name === 'voca_v13_state_revision') return Response.json(parts.revision);
    if (name === 'voca_v13_state_read') return Response.json([{ revision: parts.revision, parts: parts.parts }]);
    if (name === 'voca_v13_state_patch') {
      if (Number(body.p_revision) !== parts.revision) return Response.json({ code: '40001', message: 'revision_conflict' }, { status: 409 });
      Object.assign(parts.parts, body.p_parts); for (const key of body.p_removed || []) delete parts.parts[key];
      parts.revision += 1; return Response.json(parts.revision);
    }
    return Response.json({ message: 'missing' }, { status: 404 });
  };
}

async function simulateDay(VocaStateObject, { label, groupMs }) {
  const state = await sampleState({ students: STUDENTS, padKb: 3600 });
  state.profiles.filter(p => p.role === 'student').forEach((p, i) => { p.class_name = i % 2 ? '고1B' : '고1A'; });
  const nativeFetch = globalThis.fetch;
  globalThis.fetch = fakeSupabase(state);
  const storage = createStorageMock();
  const okRoom = { idFromName: name => name, get: () => ({ fetch: async () => new Response('{}', { status: 200 }) }) };
  const env = {
    SUPABASE_URL: 'https://example.supabase.co', SUPABASE_ANON_KEY: 'k', VOCA_STATE_SECRET: 's',
    VOCA_COMMIT_GROUP_MS: groupMs, SUPABASE_SYNC_MIN_INTERVAL_MS: 60000 / SPEED, BATTLE_ROOM: okRoom, DUNGEON_ROOM: okRoom
  };
  const object = new VocaStateObject({ storage, blockConcurrencyWhile: callback => callback(), waitUntil: () => {} }, env);
  await object.ready;
  const startRows = storage.rowsWritten;
  const raw = clientFor(object);
  const counts = { requests: 0, failed: 0 };
  const call = async (path, options = {}) => {
    counts.requests += 1;
    const response = await object.fetch(new Request(`https://sumus-voca.example${path}`, {
      method: options.method || 'GET',
      headers: { ...(options.body === undefined ? {} : { 'content-type': 'application/json' }), ...(options.cookie ? { cookie: options.cookie } : {}), origin: 'https://sumus-voca.example' },
      body: options.body === undefined ? undefined : JSON.stringify(options.body)
    }));
    const payload = await response.json();
    if (!response.ok) counts.failed += 1;
    return payload;
  };
  void raw;
  const book = builtinBooks.find(item => item.school === '단원고');
  const ranges = [book.words[0].range_code];

  async function student(i) {
    const login = await object.fetch(new Request('https://sumus-voca.example/api/login', { method: 'POST', headers: { 'content-type': 'application/json', origin: 'https://sumus-voca.example' }, body: JSON.stringify({ username: `student_${i}`, password: 'Student123!', role: 'student' }) }));
    counts.requests += 1;
    const cookie = login.headers.get('set-cookie')?.split(';')[0];
    await call('/api/bootstrap', { cookie });
    return cookie;
  }
  async function practice(cookie) {
    await call('/api/bootstrap', { cookie });
    const run = await call('/api/practice/start', { method: 'POST', cookie, body: { school: '단원고', range_codes: ranges, mode: 'eng2mean', target: QUESTIONS } });
    let questionId = run.question_id;
    for (let q = 0; q < QUESTIONS && questionId; q++) {
      await sleep((2500 + random() * 2000) / SPEED);
      const answer = await call(`/api/practice/${run.id}/answer`, { method: 'POST', cookie, body: { question_id: questionId, answer: random() < 0.7 ? '' : '__x__', prefetch_next: true } });
      questionId = answer.prefetched_next?.question_id;
    }
    await call(`/api/practice/${run.id}/finish`, { method: 'POST', cookie, body: {} });
  }
  async function games(cookie) {
    for (let k = 0; k < 2; k++) {
      const bot = await call('/api/battle/practice/start', { method: 'POST', cookie, body: { level: 'easy', mode: 'meaning' } });
      await sleep(3000 / SPEED);
      await call('/api/battle/practice/finish', { method: 'POST', cookie, body: { id: bot.id, result: random() < 0.5 ? 'win' : 'lose', right: 8 } });
    }
    const room = await call('/api/dungeon/rooms', { method: 'POST', cookie, body: { cut: 'c3', range_codes: ranges } });
    if (room.room?.id) await call('/api/dungeon/leave', { method: 'POST', cookie, body: { id: room.room.id } });
    for (let k = 0; k < 5; k++) await call('/api/rps/play', { method: 'POST', cookie, body: { bet: 1, pick: ['rock', 'paper', 'scissors'][k % 3] } });
    await call('/api/lucky/pull', { method: 'POST', cookie, body: { bet: 1 } });
  }

  process.stderr.write(`[${label}] start
`);
  const cookies = await Promise.all(Array.from({ length: STUDENTS }, (_, i) => student(i)));
  process.stderr.write(`[${label}] logged in
`);
  // 수업 시간처럼 반 전체가 함께 연습한다(3번).
  for (let round = 0; round < PRACTICES; round++) { await Promise.all(cookies.map(cookie => practice(cookie))); process.stderr.write(`[${label}] practice ${round + 1}
`); }
  // 쉬는 시간 · 방과 후 게임은 몇 명씩 나눠서.
  for (let k = 0; k < STUDENTS; k += 10) await Promise.all(cookies.slice(k, k + 10).map(cookie => games(cookie)));
  await object.mutations.flush();
  try { await object.sync.run(); } catch {}
  const rows = storage.rowsWritten - startRows;
  object.sync.close?.();
  globalThis.fetch = nativeFetch;
  return { label, rows, requests: counts.requests, failed: counts.failed, kb: Math.round((object.local.latest()?.size || object.local.latest()?.json?.length || 0) / 1024) };
}

export async function runWriteSim() {
  const root = fileURLToPath(new URL('..', import.meta.url));
  const ref = process.env.SIM_OLD_REF || 'b5e878e';
  const oldDir = fileURLToPath(new URL('../cloudflare-v13143/', import.meta.url));
  const results = [];
  const quietWarn = console.warn, quietError = console.error, quietLog = console.log;
  try {
    mkdirSync(oldDir, { recursive: true });
    for (const file of ['worker.mjs', 'local-first.mjs', 'state-parts.mjs', 'battle-room.mjs', 'dungeon-room.mjs']) {
      writeFileSync(oldDir + file, execFileSync('git', ['show', `${ref}:cloudflare/${file}`], { cwd: root, maxBuffer: 64 << 20 }));
    }
    const { VocaStateObject: OldObject } = await import(pathToFileURL(oldDir + 'worker.mjs').href);
    const { VocaStateObject: NewObject } = await import('../cloudflare/worker.mjs');
    console.warn = console.error = () => {};
    console.log = (...args) => { if (!String(args[0]).startsWith('[')) quietLog(...args); };
    results.push(await simulateDay(OldObject, { label: '지금 방식(V13.143)', groupMs: 0 }));
    results.push(await simulateDay(NewObject, { label: '새 방식, 모으기 없이', groupMs: 0 }));
    results.push(await simulateDay(NewObject, { label: '새 방식(V13.144, 모으기 1.5초)', groupMs: 1500 / SPEED }));
  } finally {
    console.warn = quietWarn; console.error = quietError; console.log = quietLog;
    rmSync(oldDir, { recursive: true, force: true });
  }
  const limit = CF_FREE_PLAN.rowsWrittenPerDay;
  console.log(`학생 ${STUDENTS}명 · 연습 ${PRACTICES}번 × ${QUESTIONS}문제 · 야차전 2판 · 던전 방 1번 · 놀이터 6번 (상태 약 ${results[0].kb} KB)`);
  console.log('| 방식 | 요청 수 | 상태 객체가 쓴 줄 | 무료 한도 대비 |');
  console.log('|---|---:|---:|---:|');
  for (const r of results) console.log(`| ${r.label} | ${r.requests} | ${r.rows.toLocaleString()} | ${(r.rows / limit * 100).toFixed(1)}% |`);
  return results;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  runWriteSim().catch(error => { console.error('[write-sim] FAIL', error); process.exitCode = 1; });
}
