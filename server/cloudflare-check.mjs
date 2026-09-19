import assert from 'node:assert/strict';
import { passwordHash } from './auth.mjs';
import { emptyState } from './state.mjs';
import { builtinBooks } from './service.mjs';
import { VocaStateObject } from '../cloudflare/worker.mjs';

const deepCopy = value => structuredClone(value);

export async function runCloudflareCheck() {
  const book = builtinBooks.find(item => item.school === '단원고');
  assert(book?.words?.length, '단원고 단어 데이터가 존재해야 합니다.');

  const originalHash = await passwordHash('Student123!');
  const state = emptyState();
  state.profiles.push({
    id: 'student-preserved', role: 'student', username: 'student_preserved',
    password_hash: originalHash, display_name: '이관보존', class_name: '고1A',
    school_id: 'danwon-high', school: '단원고', active: true,
    avatar_key: 'terra', ranking_public: true, created_at: Date.now() - 86400000
  });
  state.sessions.push({
    id: 'session-preserved', student_id: 'student-preserved', school_id: 'danwon-high',
    school: '단원고', range_codes: [book.words[0].range_code], mode: 'word_to_meaning',
    correct: 30, total: 30, xp: 900, best_combo: 30, duration_sec: 240,
    created_at: Date.now() - 3600000
  });

  let persisted = deepCopy(state);
  let revision = 41;
  let commits = 0;
  const nativeFetch = globalThis.fetch;
  globalThis.fetch = async (url, options = {}) => {
    const name = String(url).split('/').at(-1);
    const body = JSON.parse(options.body || '{}');
    if (name === 'voca_v12_state_read') {
      assert.equal(body.p_secret, 'test-state-secret');
      return Response.json([{ revision, data: deepCopy(persisted) }]);
    }
    if (name === 'voca_v12_state_commit') {
      assert.equal(body.p_secret, 'test-state-secret');
      if (Number(body.p_revision) !== revision) {
        return Response.json({ code: '40001', message: 'revision_conflict' }, { status: 409 });
      }
      persisted = deepCopy(body.p_data);
      revision += 1;
      commits += 1;
      return Response.json(revision);
    }
    throw new Error(`unexpected RPC: ${name}`);
  };

  const waits = [];
  const ctx = {
    blockConcurrencyWhile: callback => callback(),
    waitUntil: promise => waits.push(Promise.resolve(promise))
  };
  const env = {
    SUPABASE_URL: 'https://example.supabase.co',
    SUPABASE_ANON_KEY: 'test-anon-key',
    VOCA_STATE_SECRET: 'test-state-secret'
  };

  try {
    const object = new VocaStateObject(ctx, env);
    const call = async (path, options = {}) => {
      const response = await object.fetch(new Request(`https://sumus-voca.example${path}`, {
        method: options.method || 'GET',
        headers: {
          ...(options.body === undefined ? {} : { 'content-type': 'application/json' }),
          ...(options.cookie ? { cookie: options.cookie } : {}),
          origin: 'https://sumus-voca.example'
        },
        body: options.body === undefined ? undefined : JSON.stringify(options.body)
      }));
      const payload = await response.json();
      assert.equal(response.status, options.status || 200, JSON.stringify(payload));
      return { response, payload };
    };

    const login = await call('/api/login', {
      method: 'POST', body: { username: 'student_preserved', password: 'Student123!', role: 'student' }
    });
    const cookie = login.response.headers.get('set-cookie').split(';')[0];
    assert.equal(login.payload.profile.id, 'student-preserved');

    const bootstrap = await call('/api/bootstrap', { cookie });
    assert.equal(bootstrap.payload.stats.points, 900, '기존 XP가 그대로 노출되어야 합니다.');
    assert.equal(bootstrap.payload.stats.practice_count, 1, '기존 학습 기록이 보존되어야 합니다.');
    assert.equal(bootstrap.payload.profile.avatar_key, 'terra', '기존 캐릭터가 보존되어야 합니다.');

    const practice = await call('/api/practice/start', {
      method: 'POST', cookie,
      body: { school: '단원고', range_codes: [book.words[0].range_code], mode: 'eng2mean', target: 10 }
    });
    const answer = await call(`/api/practice/${practice.payload.id}/answer`, {
      method: 'POST', cookie,
      body: { question_id: practice.payload.question_id, answer: '__cloudflare_check__', prefetch_next: true }
    });
    assert.equal(typeof answer.payload.feedback.ok, 'boolean');
    await Promise.all(waits);

    assert.equal(persisted.profiles[0].password_hash, originalHash, '비밀번호 해시는 재생성하지 않고 그대로 보존해야 합니다.');
    assert(persisted.sessions.some(item => item.id === 'session-preserved'), '기존 학습 기록이 영구 저장에 남아야 합니다.');
    assert(persisted.mastery['student-preserved'], '신규 정답 데이터가 영구 저장되어야 합니다.');
    assert(commits >= 3, '로그인·연습 생성·정답이 순서대로 저장되어야 합니다.');

    const concurrent = await Promise.all(Array.from({ length: 200 }, () => call('/api/health')));
    assert(concurrent.every(item => item.payload.ok), '동시 API 200건이 모두 성공해야 합니다.');
    console.log(`[cloudflare-check] PASS credentials/records + ${concurrent.length} concurrent reads (${commits} commits)`);
  } finally {
    globalThis.fetch = nativeFetch;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runCloudflareCheck().catch(error => {
    console.error('[cloudflare-check] FAIL', error);
    process.exitCode = 1;
  });
}
