import { service, sweep } from '../server/service.mjs';
import { selfSignup } from '../server/signup.mjs';
import { examAdmin } from '../server/exam-admin.mjs';
import { migrateState } from '../server/state.mjs';
import { createMutationCoordinator, NO_MUTATION } from '../server/mutation-coordinator.mjs';

const JSON_HEADERS = { 'Content-Type': 'application/json; charset=utf-8' };

function json(payload, status = 200, headers = {}) {
  return new Response(JSON.stringify(payload), { status, headers: { ...JSON_HEADERS, ...headers } });
}

function errorStatus(error) {
  return Number(error?.status) || 500;
}

function safeError(error, status) {
  return status === 500
    ? '저장 서버에 연결하지 못했습니다. 잠시 후 다시 시도해주세요.'
    : error?.message || '요청을 처리하지 못했습니다.';
}

async function readJson(request, max = 100000) {
  const text = await request.text();
  if (text.length > max) throw Object.assign(Error('요청이 너무 큽니다.'), { status: 413 });
  try { return text ? JSON.parse(text) : {}; }
  catch { throw Object.assign(Error('요청 형식을 확인해주세요.'), { status: 400 }); }
}

function createSupabaseRepository(env) {
  const base = String(env.SUPABASE_URL || '').replace(/\/$/, '') + '/rest/v1/rpc/';
  const apiKey = env.SUPABASE_ANON_KEY;
  const secret = env.VOCA_STATE_SECRET;
  if (!env.SUPABASE_URL || !apiKey || !secret) throw Error('Cloudflare Supabase secrets are not configured');
  const headers = { apikey: apiKey, Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' };

  async function rpc(name, body) {
    const response = await fetch(base + name, {
      method: 'POST', headers, body: JSON.stringify(body), signal: AbortSignal.timeout(12000)
    });
    const text = await response.text();
    let payload = null;
    try { payload = text ? JSON.parse(text) : null; } catch {}
    if (!response.ok) {
      const message = payload?.message || payload?.error || 'Supabase 저장 연결을 확인해주세요.';
      const status = payload?.code === '40001' || message.includes('revision_conflict') ? 409 : 503;
      throw Object.assign(Error(status === 409 ? '다른 기기의 변경이 있습니다. 다시 시도해주세요.' : '영구 저장 서버에 연결하지 못했습니다.'), { status });
    }
    return payload;
  }

  async function load() {
    const rows = await rpc('voca_v12_state_read', { p_secret: secret });
    const row = Array.isArray(rows) ? rows[0] : rows;
    if (!row || row.revision === undefined || !row.data) throw Object.assign(Error('영구 저장 데이터를 불러오지 못했습니다.'), { status: 503 });
    return { revision: Number(row.revision), state: row.data };
  }

  let cache;
  return {
    async read() {
      if (!cache) cache = await load();
      return { revision: cache.revision, state: structuredClone(cache.state) };
    },
    async commit(state, revision) {
      try {
        const next = await rpc('voca_v12_state_commit', { p_secret: secret, p_revision: Number(revision), p_data: state });
        cache = { revision: Number(next), state: structuredClone(state) };
      } catch (error) {
        try { cache = await load(); } catch {}
        throw error;
      }
    }
  };
}

export class VocaStateObject {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
    this.rates = new Map();
    this.ready = ctx.blockConcurrencyWhile(async () => {
      this.repo = createSupabaseRepository(env);
      const initial = await this.repo.read();
      if (migrateState(initial.state)) {
        await this.repo.commit(initial.state, initial.revision);
        initial.revision += 1;
      }
      this.mutations = createMutationCoordinator(this.repo, initial, {
        flushDelay: 500,
        retryDelay: 2000,
        onError: error => console.error('[checkpoint]', error.message)
      });
    });
  }

  rateLimit(bucket, max, windowMs, message) {
    const list = (this.rates.get(bucket) || []).filter(time => time > Date.now() - windowMs);
    if (list.length >= max) throw Object.assign(Error(message), { status: 429 });
    list.push(Date.now());
    this.rates.set(bucket, list);
  }

  async fetch(request) {
    await this.ready;
    const url = new URL(request.url);
    try {
      if (!url.pathname.startsWith('/api/')) return json({ error: '요청한 기능을 찾을 수 없습니다.' }, 404);
      if (!['GET', 'POST', 'PATCH', 'DELETE'].includes(request.method)) throw Object.assign(Error('지원하지 않는 요청입니다.'), { status: 405 });
      if (request.method !== 'GET') {
        if (request.headers.get('sec-fetch-site') === 'cross-site') throw Object.assign(Error('허용되지 않은 요청입니다.'), { status: 403 });
        const origin = request.headers.get('origin');
        if (origin && new URL(origin).host !== url.host) throw Object.assign(Error('허용되지 않은 요청입니다.'), { status: 403 });
        if (!String(request.headers.get('content-type')).startsWith('application/json')) throw Object.assign(Error('요청 형식을 확인해주세요.'), { status: 415 });
      }

      const body = request.method === 'GET' ? Object.fromEntries(url.searchParams) : await readJson(request);
      const address = request.headers.get('CF-Connecting-IP') || 'unknown';
      if (url.pathname === '/api/login') {
        const key = `${address}:${String(body.username || '').trim().toLowerCase()}`;
        this.rateLimit(key, 10, 15 * 60000, '로그인 시도가 많습니다. 15분 후 다시 시도해주세요.');
        this.rateLimit(`${address}:all`, 500, 15 * 60000, '요청이 많습니다. 잠시 후 다시 시도해주세요.');
      }
      if (url.pathname === '/api/signup') {
        const username = String(body.username || '').trim().toLowerCase();
        this.rateLimit(`${address}:signup`, 12, 30 * 60000, '회원가입 시도가 많습니다. 잠시 후 다시 시도해주세요.');
        this.rateLimit(`${address}:signup:${username}`, 4, 30 * 60000, '같은 아이디로 가입 시도가 많습니다. 잠시 후 다시 시도해주세요.');
      }
      if (this.rates.size > 10000) {
        for (const [key, values] of this.rates) if (values.at(-1) < Date.now() - 30 * 60000) this.rates.delete(key);
      }

      const currentState = this.mutations.current().state;
      const hasExpiredAttempt = currentState.examAttempts.some(attempt => attempt.status === 'active' && attempt.deadline <= Date.now());
      if (hasExpiredAttempt) await this.mutations.durable(state => sweep(state) ? true : NO_MUTATION);

      const cookie = request.headers.get('cookie') || '';
      const token = cookie.split(';').map(value => value.trim()).find(value => value.startsWith('sumus_session='))?.slice(14) || '';
      const execute = async state => {
        const path = url.pathname.slice(4);
        const adminOutput = await examAdmin(state, request.method, path, body, token);
        return adminOutput !== undefined
          ? adminOutput
          : url.pathname === '/api/signup' && request.method === 'POST'
            ? await selfSignup(state, body)
            : await service(state, request.method, path, body, token);
      };

      const fastMutation =
        (request.method === 'POST' && (url.pathname === '/api/practice/start' || /^\/api\/practice\/[^/]+\/(?:answer|finish)$/.test(url.pathname))) ||
        (request.method === 'PATCH' && url.pathname === '/api/teacher/school');
      const result = request.method === 'GET'
        ? await execute(this.mutations.current().state)
        : fastMutation
          ? await this.mutations.fast(execute)
          : await this.mutations.durable(execute);

      if (fastMutation) this.ctx.waitUntil(this.mutations.flush());
      const responseHeaders = {};
      if (result._cookie) {
        responseHeaders['Set-Cookie'] = `sumus_session=${result._cookie}; HttpOnly; SameSite=Strict; Path=/; Max-Age=604800; Secure`;
        delete result._cookie;
      }
      if (result._clearCookie) {
        responseHeaders['Set-Cookie'] = 'sumus_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0; Secure';
        delete result._clearCookie;
      }
      return json(result, 200, responseHeaders);
    } catch (error) {
      const status = errorStatus(error);
      if (status === 500) console.error('[request]', error?.message);
      return json({ error: safeError(error, status) }, status);
    }
  }
}

function securityHeaders(response, pathname) {
  const headers = new Headers(response.headers);
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('Referrer-Policy', 'same-origin');
  headers.set('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; media-src 'self' blob:; font-src 'self'; frame-ancestors 'self'; base-uri 'self'; form-action 'self'");
  headers.set('Strict-Transport-Security', 'max-age=31536000');
  if (pathname.startsWith('/api/')) headers.set('Cache-Control', 'no-store');
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/')) {
      const id = env.VOCA_STATE.idFromName('main');
      return securityHeaders(await env.VOCA_STATE.get(id).fetch(request), url.pathname);
    }
    return securityHeaders(await env.ASSETS.fetch(request), url.pathname);
  }
};
