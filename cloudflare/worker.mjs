import { service, sweep, preauthenticateLogin, settleBattle } from '../server/service.mjs';
import { BattleRoom, battleReportKey } from './battle-room.mjs';
export { BattleRoom };
import { selfSignup } from '../server/signup.mjs';
import { examAdmin } from '../server/exam-admin.mjs';
import { migrateState, stateSizeReport } from '../server/state.mjs';
import { createMutationCoordinator, NO_MUTATION } from '../server/mutation-coordinator.mjs';
import { createLocalRepository, createSupabaseSync } from './local-first.mjs';

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

  // The whole state (about 2.4 MB in Sept 2026) travels on every backup. Uploads run in the
  // background, so they get a long timeout instead of being cut off mid-transfer.
  async function rpc(name, body, timeoutMs) {
    const text = typeof body === 'string' ? body : JSON.stringify(body);
    let response;
    try {
      response = await fetch(base + name, { method: 'POST', headers, body: text, signal: AbortSignal.timeout(timeoutMs) });
    } catch (error) {
      // Timeouts and network failures: keep the cause for /api/health and the logs.
      throw Object.assign(Error('영구 저장 서버에 연결하지 못했습니다.'), { status: 503, detail: `${name}: ${error?.name || 'Error'} ${error?.message || ''} (${Math.round(text.length / 1024)} KB)`.trim() });
    }
    const responseText = await response.text();
    let payload = null;
    try { payload = responseText ? JSON.parse(responseText) : null; } catch {}
    if (!response.ok) {
      const message = payload?.message || payload?.error || 'Supabase 저장 연결을 확인해주세요.';
      const status = payload?.code === '40001' || message.includes('revision_conflict') ? 409 : 503;
      // Supabase's own reason (never the request body or secret), for diagnosing failed backups.
      const detail = `${name}: HTTP ${response.status}${payload?.code ? ' ' + payload.code : ''} ${String(message).slice(0, 160)} (${Math.round(text.length / 1024)} KB)`;
      throw Object.assign(Error(status === 409 ? '다른 기기의 변경이 있습니다. 다시 시도해주세요.' : '영구 저장 서버에 연결하지 못했습니다.'), { status, detail });
    }
    return payload;
  }

  async function load() {
    // Read at start-up blocks the first requests, so it keeps a short timeout (a synced
    // local snapshot is used if Supabase is slow).
    const rows = await rpc('voca_v12_state_read', { p_secret: secret }, 12000);
    const row = Array.isArray(rows) ? rows[0] : rows;
    if (!row || row.revision === undefined || !row.data) throw Object.assign(Error('영구 저장 데이터를 불러오지 못했습니다.'), { status: 503 });
    return { revision: Number(row.revision), state: row.data };
  }

  return {
    read: load,
    async readRevision() { return (await load()).revision; },
    // `json` is the already-serialized state from the local snapshot, so the
    // background upload does not stringify the whole state a second time.
    async commitSerialized(json, revision) {
      const payload = `{"p_secret":${JSON.stringify(secret)},"p_revision":${Number(revision)},"p_data":${json}}`;
      return Number(await rpc('voca_v12_state_commit', payload, 45000));
    }
  };
}

export class VocaStateObject {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
    this.rates = new Map();
    this.ready = ctx.blockConcurrencyWhile(async () => {
      this.supabase = createSupabaseRepository(env);
      this.local = createLocalRepository(ctx.storage);
      this.sync = createSupabaseSync({ local: this.local, supabase: this.supabase, storage: ctx.storage, minIntervalMs: Number(env.SUPABASE_SYNC_MIN_INTERVAL_MS ?? 60000) });
      const initial = await this.loadInitialState();
      const migrated = migrateState(initial.state);
      const swept = sweep(initial.state);
      this.sweptAt = Date.now();
      if (migrated || swept) {
        await this.local.commit(initial.state, initial.revision);
        initial.revision += 1;
      }
      this.local.onCommit = () => this.sync.schedule();
      this.mutations = createMutationCoordinator(this.local, initial, {
        flushDelay: 500,
        retryDelay: 2000,
        rollbackOnFailure: true,
        onError: error => console.error('[checkpoint]', error.message)
      });
      if (this.sync.pending()) this.sync.schedule(0);
    });
  }

  // Chooses the starting state:
  // - local snapshot with changes Supabase has not received yet -> local wins
  //   (those are student answers that must not be lost);
  // - otherwise Supabase is read; if its revision differs from the one the
  //   local snapshot was synced to (first start, or restored from a backup),
  //   Supabase wins and replaces the local snapshot;
  // - if Supabase is unreachable but a synced local snapshot exists, start from it.
  async loadInitialState() {
    const hasLocal = this.local.hasSnapshot();
    const status = this.local.status();
    if (hasLocal && status.syncedVersion < status.version) return this.local.read();
    let remote;
    try {
      remote = await this.supabase.read();
    } catch (error) {
      if (!hasLocal) throw error;
      console.error('[boot] Supabase unavailable; starting from the local snapshot', error.message);
      return this.local.read();
    }
    if (!hasLocal || remote.revision !== status.supabaseRevision) {
      if (hasLocal) console.warn('[boot] Supabase revision changed outside this object; adopting it', { local: status.supabaseRevision, remote: remote.revision });
      this.local.adoptRemote(remote.state, remote.revision);
    }
    return this.local.read();
  }

  async alarm() {
    await this.ready;
    try { await this.sync.run(); } catch {}
  }

  // Which parts of the state are large (sizes and counts only). Measuring stringifies the
  // whole state, so the public health check reuses the last result for a minute.
  sizeReport() {
    const now = Date.now();
    if (!this.sizeCache || now - this.sizeCache.at > 60000) this.sizeCache = { at: now, report: stateSizeReport(this.mutations.current().state) };
    return this.sizeCache.report;
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
      await this.mutations.recover();
      if (!url.pathname.startsWith('/api/')) return json({ error: '요청한 기능을 찾을 수 없습니다.' }, 404);
      if (!['GET', 'POST', 'PATCH', 'DELETE'].includes(request.method)) throw Object.assign(Error('지원하지 않는 요청입니다.'), { status: 405 });
      if (request.method !== 'GET') {
        if (request.headers.get('sec-fetch-site') === 'cross-site') throw Object.assign(Error('허용되지 않은 요청입니다.'), { status: 403 });
        const origin = request.headers.get('origin');
        if (origin && new URL(origin).host !== url.host) throw Object.assign(Error('허용되지 않은 요청입니다.'), { status: 403 });
        if (!String(request.headers.get('content-type')).startsWith('application/json')) throw Object.assign(Error('요청 형식을 확인해주세요.'), { status: 415 });
      }

      const body = request.method === 'GET' ? Object.fromEntries(url.searchParams) : await readJson(request, url.pathname.startsWith('/api/vocab-import/') ? 1000000 : 100000);
      // Battle rooms report finished matches here (the public worker blocks /api/internal/).
      if (url.pathname === '/api/internal/battle-result') {
        if (request.headers.get('X-Battle-Key') !== await battleReportKey(this.env)) throw Object.assign(Error('허용되지 않은 요청입니다.'), { status: 403 });
        await this.mutations.durable(state => settleBattle(state, body) ? { ok: true } : NO_MUTATION);
        return json({ ok: true });
      }
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
      if (url.pathname === '/api/battle/join' || url.pathname === '/api/battle/preview') {
        this.rateLimit(`${address}:battle-join`, 30, 10 * 60000, '대결 방 참가 시도가 많아요. 잠시 후 다시 시도해주세요.');
      }
      if (this.rates.size > 10000) {
        for (const [key, values] of this.rates) if (values.at(-1) < Date.now() - 30 * 60000) this.rates.delete(key);
      }

      const currentState = this.mutations.current().state;
      const hasExpiredAttempt = currentState.examAttempts.some(attempt => attempt.status === 'active' && attempt.deadline <= Date.now());
      // Housekeeping (stale practices, old record compaction) also runs hourly, not only at start-up.
      const sweepDue = Date.now() - this.sweptAt > 3600000;
      if (hasExpiredAttempt || sweepDue) {
        if (sweepDue) this.sweptAt = Date.now();
        await this.mutations.durable(state => sweep(state) ? true : NO_MUTATION);
      }

      const cookie = request.headers.get('cookie') || '';
      const token = cookie.split(';').map(value => value.trim()).find(value => value.startsWith('sumus_session='))?.slice(14) || '';
      // scrypt takes tens of ms; doing it inside durable() would stall every
      // other student's save while one login is checked.
      const preauthenticatedUserId = url.pathname === '/api/login' && request.method === 'POST'
        ? await preauthenticateLogin(this.mutations.current().state, body)
        : null;
      const execute = async state => {
        const path = url.pathname.slice(4);
        const adminOutput = await examAdmin(state, request.method, path, body, token);
        return adminOutput !== undefined
          ? adminOutput
          : url.pathname === '/api/signup' && request.method === 'POST'
            ? await selfSignup(state, body)
            : await service(state, request.method, path, body, token, { preauthenticatedUserId });
      };

      const startedAt = Date.now();
      const result = request.method === 'GET'
        ? await execute(this.mutations.current().state)
        : await this.mutations.durable(execute);
      // Room set-up for yacha battles: the questions (with answers) go to the room only.
      if (result?._battle) {
        const message = result._battle;
        delete result._battle;
        const room = this.env.BATTLE_ROOM.get(this.env.BATTLE_ROOM.idFromName(message.id));
        const reply = await room.fetch('https://battle/admin', { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify(message) }).catch(() => null);
        if (!reply?.ok && message.action !== 'cancel') {
          await this.mutations.durable(state => settleBattle(state, { id: message.id, reason: 'cancelled' }) ? true : NO_MUTATION);
          throw Object.assign(Error('대결 방을 준비하지 못했어요. 잠시 후 다시 시도해주세요.'), { status: 503 });
        }
      }
      const elapsed = Date.now() - startedAt;
      const { commitMs, commitBytes } = this.local.metrics;
      const sync = this.sync.status();
      if (request.method !== 'GET' && elapsed > 1500) console.warn('[slow-mutation]', url.pathname.replace(/\/[0-9a-f-]{36}/g, '/:id'), { elapsed, commitMs, commitBytes });
      // Public health output shows whether the Supabase backup is keeping up.
      if (url.pathname === '/api/health') result.storage = { mode: 'local-first', supabase_pending: sync.pending, supabase_lag_sec: sync.lag_sec, supabase_failures: sync.failures, supabase_last_error: sync.last_error, supabase_last_sync_ms: sync.last_sync_ms, state_kb: Math.round((this.local.latest()?.json.length || 0) / 1024), state_breakdown: this.sizeReport() };
      const responseHeaders = {
        // Visible in DevTools > Network > Timing, so slow saves can be measured on a real phone.
        // commit = local durable write; supabase = last background upload.
        'Server-Timing': request.method === 'GET'
          ? `app;dur=${elapsed}`
          : `app;dur=${elapsed}, commit;dur=${commitMs};desc="local ${commitBytes} bytes", supabase;dur=${sync.last_sync_ms}`
      };
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
      if (status === 500 || status === 503) console.error('[request]', status, error?.message);
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
    if (url.pathname.startsWith('/api/internal/')) return securityHeaders(json({ error: '요청한 기능을 찾을 수 없습니다.' }, 404), url.pathname);
    // Battle sockets go straight to their room; a 101 response must not be re-wrapped.
    const battleSocket = url.pathname.match(/^\/api\/battle\/ws\/([0-9a-f-]{36})$/);
    if (battleSocket) {
      if (request.headers.get('Upgrade') !== 'websocket') return securityHeaders(json({ error: 'WebSocket 연결이 필요해요.' }, 426), url.pathname);
      const origin = request.headers.get('origin');
      if (origin && new URL(origin).host !== url.host) return securityHeaders(json({ error: '허용되지 않은 요청입니다.' }, 403), url.pathname);
      return env.BATTLE_ROOM.get(env.BATTLE_ROOM.idFromName(battleSocket[1])).fetch(request);
    }
    if (url.pathname.startsWith('/api/')) {
      const id = env.VOCA_STATE.idFromName('main');
      return securityHeaders(await env.VOCA_STATE.get(id).fetch(request), url.pathname);
    }
    return securityHeaders(await env.ASSETS.fetch(request), url.pathname);
  }
};
