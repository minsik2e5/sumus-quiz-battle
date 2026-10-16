import { service, sweep, preauthenticateLogin, settleBattle, battleReportPending, undoDungeon, runEveningReminders, settlePartyReport, partyReportPending, undoParty } from '../server/service.mjs';
import { createDungeonReporter } from '../server/dungeon-reports.mjs';
import { sendPush } from '../server/push.mjs';
import { dropEndpoints } from '../server/notify.mjs';
import { BattleRoom, battleReportKey } from './battle-room.mjs';
export { BattleRoom };
// V13.128 던전 방: 파티 하나에 방 하나.
import { DungeonRoom, dungeonReportKey } from './dungeon-room.mjs';
export { DungeonRoom };
// V13.149 교실 게임 방(보물 사냥 · 반 전체 낚시): 판 하나에 방 하나.
import { PartyRoom, partyReportKey } from './party-room.mjs';
export { PartyRoom };
import { selfSignup, checkSignupCode, signupCodeGuard } from '../server/signup.mjs';
import { examAdmin } from '../server/exam-admin.mjs';
import { migrateState, stateSizeReport } from '../server/state.mjs';
import { hashToken } from '../server/auth.mjs';
import { createMutationCoordinator, NO_MUTATION, isQuickWrite } from '../server/mutation-coordinator.mjs';
import { createLocalRepository, createSupabaseSync } from './local-first.mjs';
import { partitionState, assembleState, hashText } from './state-parts.mjs';
import { WRITE_WARN_PCT } from './cf-limits.mjs';
import { testSeedState, applyTestSeed } from '../server/test-seed.mjs';

// V13.144 쓰기 모으기: 저장이 연달아 오면 이 시간(ms) 안에 온 변경을 한 번에 쓴다. 오늘 쓴 양이 70%를 넘으면 2배,
// 90%를 넘으면 4배로 늘린다. 쉬고 있다가 온 저장은 기다리지 않는다. env.VOCA_COMMIT_GROUP_MS로 바꿀 수 있다.
export const COMMIT_GROUP_MS = 1500;
const SYNC_MIN_INTERVAL_MS = 60000;
// 시작하지 못했을 때(1101 대신) 보내는 답. /api/health에는 원인(앞 300자)과 시작 경고도 붙인다.
export const BOOT_FAIL_MESSAGE = '서버를 시작하지 못했어요. 잠시 후 다시 시도해 주세요.';
export function bootFailureResponse(error, pathname, bootWarning = null) {
  const payload = { ok: false, error: BOOT_FAIL_MESSAGE };
  if (pathname === '/api/health') Object.assign(payload, { cause: String(error?.detail || error?.message || error || '').slice(0, 300), boot_warning: bootWarning });
  return json(payload, 503);
}

// V13.136: 같은 아이디로 5분에 10번 틀리면 5분 쉰다(맞게 로그인한 횟수는 세지 않는다).
const LOGIN_FAIL_MAX = 10;
const LOGIN_FAIL_WINDOW_MS = 5 * 60000;

const JSON_HEADERS = { 'Content-Type': 'application/json; charset=utf-8' };

// Changes allowed without a session. Everything else needs a live token of an active profile
// (the same test service() makes, done once more outside the queue).
const OPEN_POST_PATHS = new Set(['/api/login', '/api/signup', '/api/signup/check']);
function hasLiveSession(state, token) {
  if (!token || token.length > 200) return false;
  const hash = hashToken(token), now = Date.now();
  const auth = state.tokens.find(t => t.hash === hash && t.expires_at > now);
  return !!auth && state.profiles.some(p => p.id === auth.user_id && p.active);
}
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

// V13.129: 본문을 다 읽기 전에 크기를 본다. 예전에는 끝까지 읽은 뒤에 길이를 봐서 아주 큰 요청 하나가
// 상태 객체의 메모리(128MB)를 채울 수 있었다. 한글은 UTF-8로 글자당 3바이트라 바이트 한도는 글자 한도의 4배.
export const bodyByteLimit = max => max * 4;
export async function readJson(request, max = 100000) {
  const tooBig = () => Object.assign(Error('요청이 너무 큽니다.'), { status: 413 });
  const limit = bodyByteLimit(max);
  if (Number(request.headers.get('content-length') || 0) > limit) throw tooBig();
  let text = '';
  if (request.body) {
    const reader = request.body.getReader(), chunks = [];
    let size = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) { reader.cancel().catch(() => {}); throw tooBig(); }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let at = 0;
    for (const chunk of chunks) { bytes.set(chunk, at); at += chunk.byteLength; }
    text = new TextDecoder().decode(bytes);
  }
  if (text.length > max) throw tooBig();
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
    if (timeoutMs === 'upload') timeoutMs = uploadTimeoutMs(text.length);
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
      // 404: the function does not exist (the parts SQL has not been run yet).
      const status = payload?.code === '40001' || message.includes('revision_conflict') ? 409 : response.status === 404 ? 404 : 503;
      // Supabase's own reason (never the request body or secret), for diagnosing failed backups.
      const detail = `${name}: HTTP ${response.status}${payload?.code ? ' ' + payload.code : ''} ${String(message).slice(0, 160)} (${Math.round(text.length / 1024)} KB)`;
      throw Object.assign(Error(status === 409 ? '다른 기기의 변경이 있습니다. 다시 시도해주세요.' : '영구 저장 서버에 연결하지 못했습니다.'), { status, detail });
    }
    return payload;
  }

  async function load(timeoutMs = 12000) {
    // Read at start-up blocks the first requests, so it keeps a short timeout (a synced
    // local snapshot is used if Supabase is slow).
    const rows = await rpc('voca_v12_state_read', { p_secret: secret }, timeoutMs);
    const row = Array.isArray(rows) ? rows[0] : rows;
    if (!row || row.revision === undefined || !row.data) throw Object.assign(Error('영구 저장 데이터를 불러오지 못했습니다.'), { status: 503 });
    return { revision: Number(row.revision), state: row.data };
  }

  return {
    read: timeoutMs => load(timeoutMs),
    async readRevision() { return (await load()).revision; },
    // `json` is the already-serialized state from the local snapshot, so the
    // background upload does not stringify the whole state a second time.
    async commitSerialized(json, revision) {
      const payload = `{"p_secret":${JSON.stringify(secret)},"p_revision":${Number(revision)},"p_data":${json}}`;
      return Number(await rpc('voca_v12_state_commit', payload, 'upload'));
    },
    // Parts backup (supabase/voca_v13_parts.sql).
    async partsRevision(timeoutMs = 12000) { return Number(await rpc('voca_v13_state_revision', { p_secret: secret }, timeoutMs)); },
    async readParts(timeoutMs = 20000) {
      const rows = await rpc('voca_v13_state_read', { p_secret: secret }, timeoutMs);
      const row = Array.isArray(rows) ? rows[0] : rows;
      return { revision: Number(row?.revision || 0), parts: row?.parts && typeof row.parts === 'object' ? row.parts : {} };
    },
    // entries: [[part key, JSON text]]; the texts are sent as they are, not re-serialized.
    async patchParts(entries, removed, revision) {
      const parts = entries.map(([key, text]) => `${JSON.stringify(key)}:${text}`).join(',');
      const payload = `{"p_secret":${JSON.stringify(secret)},"p_revision":${Number(revision)},"p_parts":{${parts}},"p_removed":${JSON.stringify(removed)}}`;
      return Number(await rpc('voca_v13_state_patch', payload, 'upload'));
    }
  };
}

// V13.150.2 큰 업로드의 시간 제한: 운영 데이터가 8.8MB까지 커져 45초 안에 통째 백업을 다 못 올렸다.
// 1MB를 넘는 만큼 1MB마다 20초를 더 주고(최소 45초, 최대 3분), 업로드는 알람(최대 15분) 안에서 돈다.
export function uploadTimeoutMs(bytes) {
  return Math.min(180000, Math.max(45000, Math.round(45000 + Math.max(0, (Number(bytes) || 0) - 1048576) / 1048576 * 20000)));
}

// V13.149 테스트 앱(env.test, VOCA_STANDALONE=1): Supabase 없이 이 Durable Object 안에만 저장한다.
// 운영 Supabase 주소 · 키 · 비밀값을 쓰지 않는다. 처음 켤 때만 테스트 계정 데이터(server/test-seed.mjs)를 준다.
// 백업 번호만 저장해 두어, 한 번 저장한 뒤에는 처음 데이터로 되돌아가지 않는다(번호가 있으면 read가 실패 → 로컬 사본으로 시작).
const STANDALONE_REV = 'standalone:rev';
export function createStandaloneRepository(storage) {
  const revision = async () => Number(await storage.get(STANDALONE_REV)) || 0;
  const bump = async from => { const next = Math.max(await revision(), Number(from) || 0) + 1; await storage.put(STANDALONE_REV, next); return next; };
  const none = () => Object.assign(Error('테스트 앱은 외부 백업을 쓰지 않습니다.'), { status: 404 });
  return {
    standalone: true,
    async read() {
      if (await revision()) throw Object.assign(Error('테스트 앱: 로컬 사본으로 시작합니다.'), { status: 503 });
      return { revision: 0, state: await testSeedState() };
    },
    readRevision: revision,
    commitSerialized: (json, rev) => bump(rev),
    // 파트 백업은 없다(404): 동기화는 commitSerialized 하나만 쓴다.
    async partsRevision() { throw none(); },
    async readParts() { return { revision: 0, parts: {} }; },
    async patchParts() { throw none(); }
  };
}

// V13.131: 시작(blockConcurrencyWhile, Cloudflare 제한 30초) 안에서 Supabase를 기다리는 시간은 모두 합쳐
// BOOT_BUDGET_MS까지. 예전에는 파트 번호(12초) + 파트 읽기(20초)처럼 이어지면 32초가 되어 시작이 끊길 수 있었다.
// 시간이 모자라면 로컬 사본으로 시작한다. 로컬 사본이 없을 때만 남은 시간이 적어도 v12 사본을 5초 더 기다린다.
export const BOOT_BUDGET_MS = 20000;
const BOOT_MIN_CALL_MS = 1000;
export function bootTimer(budgetMs = BOOT_BUDGET_MS, now = () => Date.now()) {
  const deadline = now() + budgetMs;
  return {
    left: () => Math.max(0, deadline - now()),
    // 이번 호출의 시간 제한: 원래 제한과 남은 시간 중 짧은 쪽. 남은 시간이 1초보다 적으면 0(부르지 않는다).
    limit(defaultMs, share = 1) {
      const left = Math.floor(this.left() * share);
      return left < BOOT_MIN_CALL_MS ? 0 : Math.min(defaultMs, left);
    }
  };
}
const bootOutOfTime = () => Object.assign(Error('시작 시간 안에 영구 저장 서버가 답하지 않았습니다.'), { status: 503, detail: 'boot budget used up' });

export class VocaStateObject {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
    this.rates = new Map();
    this.bootWarning = null;
    this.ready = ctx.blockConcurrencyWhile(async () => {
      this.supabase = env.VOCA_STANDALONE === '1' ? createStandaloneRepository(ctx.storage) : createSupabaseRepository(env);
      this.local = createLocalRepository(ctx.storage);
      if (this.local.migrationError()) this.bootWarning = `옛 저장 방식으로 읽었어요(옮기기 실패): ${this.local.migrationError()}`.slice(0, 300);
      const syncInterval = Number(env.SUPABASE_SYNC_MIN_INTERVAL_MS ?? SYNC_MIN_INTERVAL_MS);
      // V13.144: 오늘 쓴 양이 90%를 넘으면 백업 간격을 5배로(백업도 줄을 쓴다).
      this.sync = createSupabaseSync({ local: this.local, supabase: this.supabase, storage: ctx.storage, minIntervalMs: () => this.writeLevel() === 'defer' ? syncInterval * 5 : syncInterval, forceFull: env.SUPABASE_BACKUP_MODE === 'full' });
      const initial = await this.loadInitialState();
      // V13.144: 시작 정리(migrateState · sweep)와 시작 저장이 실패해도 서버는 켠다. 예전에는 여기서 던지면 상태 객체가
      // 리셋되고 다음 요청에서 또 던져 모든 요청이 1101이 됐다(2026-10-12, 쓰기 한도 초과로 시작 저장이 실패).
      // 정리는 복사본에서 해서, 중간에 던져도 읽은 상태는 그대로다.
      this.sweptAt = Date.now();
      try {
        const working = structuredClone(initial.state);
        const migrated = migrateState(working);
        // 테스트 앱: 새 판의 테스트 계정 · 펫 · 미끼를 덧붙인다(운영에서는 부르지 않는다).
        const seeded = env.VOCA_STANDALONE === '1' && await applyTestSeed(working);
        // 90%를 넘은 날은 급하지 않은 정리를 다음 날로 미룬다.
        const swept = this.writeLevel() === 'defer' ? false : sweep(working);
        initial.state = working;
        if (migrated || swept || seeded) {
          try {
            initial.revision = await this.local.commit(working, initial.revision);
          } catch (error) {
            this.bootWarning = `시작 저장 실패(다음 저장 때 다시): ${error?.message || error}`.slice(0, 300);
            console.error('[boot] start-up save failed; serving anyway', error?.message);
          }
        }
      } catch (error) {
        this.bootWarning = `시작 정리 실패(정리 없이 켬): ${error?.message || error}`.slice(0, 300);
        console.error('[boot] migrate/sweep failed; serving the stored state as it is', error?.message);
      }
      this.local.onCommit = () => this.sync.schedule();
      const groupBase = Math.max(0, Number(env.VOCA_COMMIT_GROUP_MS ?? COMMIT_GROUP_MS) || 0);
      this.mutations = createMutationCoordinator(this.local, initial, {
        flushDelay: 500,
        retryDelay: 2000,
        rollbackOnFailure: true,
        groupMs: () => groupBase * ({ ok: 1, warn: 2, defer: 4 }[this.writeLevel()] || 1),
        onError: error => console.error('[checkpoint]', error.message)
      });
      if (this.sync.pending()) this.sync.schedule(0);
    });
    // fetch() and alarm() report a failed start themselves.
    this.ready.catch(() => {});
  }

  // V13.144: 오늘(UTC) 쓴 줄 수 단계: 'ok' · 'warn'(70%) · 'defer'(90%, 급하지 않은 쓰기를 미룬다).
  writeLevel() {
    return this.local?.writeStats().level || 'ok';
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
    // V13.131: Supabase를 기다리는 시간은 모두 합쳐 BOOT_BUDGET_MS(20초)까지.
    const timer = bootTimer(Number(this.env.BOOT_BUDGET_MS) || BOOT_BUDGET_MS);
    // Backed up as parts: only the parts copy is compared. The v12 copy is then just a
    // periodic safety copy, hours older, and must never replace a synced local snapshot.
    if (hasLocal && status.partsRevision !== null && this.env.SUPABASE_BACKUP_MODE !== 'full') {
      let remoteRevision;
      try {
        // 번호 확인은 남은 시간의 절반까지만: 바뀌었으면 파트를 읽을 시간이 남게 한다.
        const ms = timer.limit(12000, 0.5);
        if (!ms) throw bootOutOfTime();
        remoteRevision = await this.supabase.partsRevision(ms);
      } catch (error) {
        console.error('[boot] parts backup unavailable; starting from the local snapshot', error?.detail || error?.message);
        return this.local.read();
      }
      if (remoteRevision !== status.partsRevision) {
        // 시간이 모자라거나 읽지 못하면 null: 로컬 사본으로 시작한다(다음 동기화가 차이를 다시 본다).
        const remoteParts = await this.readPartsBackup(timer.limit(20000));
        if (remoteParts) {
          console.warn('[boot] parts backup changed outside this object; adopting it', { local: status.partsRevision, remote: remoteParts.revision });
          this.local.adoptRemoteParts(remoteParts.state, remoteParts.revision, remoteParts.hashes);
        }
      }
      return this.local.read();
    }
    // No local copy: the parts backup, when it is set up and filled, is the freshest copy.
    if (!hasLocal && this.env.SUPABASE_BACKUP_MODE !== 'full') {
      // 로컬 사본이 없으면 실패할 때 v12 사본을 읽을 시간을 남긴다(남은 시간의 60%까지).
      const remoteParts = await this.readPartsBackup(timer.limit(20000, 0.6));
      if (remoteParts) {
        this.local.adoptRemoteParts(remoteParts.state, remoteParts.revision, remoteParts.hashes);
        return this.local.read();
      }
    }
    let remote;
    try {
      // 로컬 사본이 없으면 시작할 다른 방법이 없어서, 시간이 모자라도 5초는 기다린다(합계 최대 25초 < 30초).
      const ms = timer.limit(12000) || (hasLocal ? 0 : 5000);
      if (!ms) throw bootOutOfTime();
      remote = await this.supabase.read(ms);
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

  // The state from the parts backup, or null when it is missing, empty or unreachable
  // (then the v12 copy is used as before).
  async readPartsBackup(timeoutMs = 20000) {
    try {
      if (!timeoutMs) throw bootOutOfTime();
      const { revision, parts } = await this.supabase.readParts(timeoutMs);
      if (!revision || !parts['o:keys']) return null;
      const state = assembleState(parts);
      const hashes = await Promise.all([...partitionState(state)].map(async ([key, text]) => [key, await hashText(text)]));
      return { state, revision, hashes };
    } catch (error) {
      if (error?.status !== 404) console.error('[boot] parts backup unavailable', error?.detail || error?.message);
      return null;
    }
  }

  // V13.77 알림: send after the change is saved; phones that are gone (404/410) are forgotten.
  async deliverPush(messages, origin = '') {
    const push = this.mutations.current().state.push;
    if (!push?.vapid || !messages.length) return { sent: 0, failed: 0, gone: 0 };
    const subject = push.subject || origin || 'mailto:sumus-voca@users.noreply.github.com';
    const jobs = [];
    for (const m of messages) {
      const payload = { title: String(m.title || 'SUMUS VOCA').slice(0, 80), body: String(m.body || '').slice(0, 160), url: String(m.url || '/'), tag: m.tag || undefined, urgent: !!m.urgent };
      for (const id of new Set(m.to || [])) for (const sub of push.subs?.[id] || []) jobs.push([sub, payload]);
    }
    const gone = [];
    let sent = 0, failed = 0;
    for (let i = 0; i < jobs.length; i += 8) {
      const results = await Promise.all(jobs.slice(i, i + 8).map(([sub, payload]) => sendPush(sub, payload, push.vapid, { subject })));
      results.forEach((r, k) => { if (r.ok) sent++; else { failed++; if (r.gone) gone.push(jobs[i + k][0].endpoint); } });
    }
    if (gone.length) await this.mutations.durable(state => dropEndpoints(state, gone) ? true : NO_MUTATION).catch(() => {});
    if (failed) console.warn('[push]', { sent, failed, gone: gone.length });
    return { sent, failed, gone: gone.length };
  }

  // Called by the daily cron (19:00 KST): students who have not studied today get one nudge.
  async eveningPush() {
    const messages = await this.mutations.durable(state => {
      const list = runEveningReminders(state);
      return list.length ? list : NO_MUTATION;
    });
    return Array.isArray(messages) ? this.deliverPush(messages) : { sent: 0 };
  }

  async alarm() {
    try { await this.ready; } catch { return; }
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
    const url = new URL(request.url);
    try { await this.ready; }
    catch (error) {
      console.error('[boot] state object did not start', error?.message);
      return bootFailureResponse(error, url.pathname, this.bootWarning);
    }
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
      if (url.pathname === '/api/internal/evening-push') {
        if (request.headers.get('X-Push-Key') !== await eveningPushKey(this.env)) throw Object.assign(Error('허용되지 않은 요청입니다.'), { status: 403 });
        return json(await this.eveningPush());
      }
      // Battle rooms report finished matches here (the public worker blocks /api/internal/).
      if (url.pathname === '/api/internal/battle-result') {
        if (request.headers.get('X-Battle-Key') !== await battleReportKey(this.env)) throw Object.assign(Error('허용되지 않은 요청입니다.'), { status: 403 });
        // V13.129: 이미 정산한 대결의 재시도 보고는 상태를 복사하지 않고 바로 끝낸다.
        if (!battleReportPending(this.mutations.current().state, body)) return json({ ok: true });
        await this.mutations.durable(state => settleBattle(state, body) ? { ok: true } : NO_MUTATION);
        return json({ ok: true });
      }
      // V13.128: 던전 방이 끝난 판(또는 시작 못 하고 닫힌 방)을 한 번 보고한다. 같은 report_id는 한 번만 처리.
      if (url.pathname === '/api/internal/dungeon-result') {
        if (request.headers.get('X-Dungeon-Key') !== await dungeonReportKey(this.env)) throw Object.assign(Error('허용되지 않은 요청입니다.'), { status: 403 });
        // 몰려 온 보고는 모아서 한 번에, 이미 처리한 보고는 복사 없이 바로 끝낸다(server/dungeon-reports.mjs).
        this.dungeonReporter ||= createDungeonReporter({ current: () => this.mutations.current(), durable: fn => this.mutations.durable(fn) });
        await this.dungeonReporter(body);
        return json({ ok: true });
      }
      // V13.149: 교실 게임 방이 끝난 판을 한 번 보고한다(같은 판은 한 번만 정산).
      if (url.pathname === '/api/internal/party-result') {
        if (request.headers.get('X-Party-Key') !== await partyReportKey(this.env)) throw Object.assign(Error('허용되지 않은 요청입니다.'), { status: 403 });
        if (!partyReportPending(this.mutations.current().state, body)) return json({ ok: true });
        await this.mutations.durable(state => settlePartyReport(state, body) ? { ok: true } : NO_MUTATION);
        return json({ ok: true });
      }
      const address = request.headers.get('CF-Connecting-IP') || 'unknown';
      const cookie = request.headers.get('cookie') || '';
      const token = cookie.split(';').map(value => value.trim()).find(value => value.startsWith('sumus_session='))?.slice(14) || '';
      // A change without a live session is turned away here, before it waits in the queue
      // and copies the whole state (only login and signup work without one).
      if (request.method !== 'GET' && !OPEN_POST_PATHS.has(url.pathname) && !hasLiveSession(this.mutations.current().state, token)) {
        throw Object.assign(Error('다시 로그인해주세요.'), { status: 401 });
      }
      // V13.136: 로그인 제한은 틀린 시도만 센다. 맞게 로그인하면 그 아이디의 기록을 지우고(아래 _cookie),
      // 같은 아이디로 5분에 10번 틀렸을 때만 5분 쉰다.
      const loginKey = url.pathname === '/api/login' ? `${address}:${String(body.username || '').trim().toLowerCase()}` : '';
      if (loginKey) {
        this.rateLimit(loginKey, LOGIN_FAIL_MAX, LOGIN_FAIL_WINDOW_MS, '비밀번호를 여러 번 틀렸어요. 5분 후 다시 시도해주세요.');
        this.rateLimit(`${address}:all`, 500, 15 * 60000, '요청이 많습니다. 잠시 후 다시 시도해주세요.');
      }
      // V13.141: 틀린 가입 코드는 같은 기기에서 30분에 20번까지(맞은 시도는 세지 않는다).
      const signupCodeTry = url.pathname === '/api/signup' || url.pathname === '/api/signup/check';
      const countWrongCode = signupCodeTry ? signupCodeGuard(this.rates, address) : null;
      const withCodeCount = async fn => { try { return await fn(); } catch (error) { countWrongCode?.(error); throw error; } };
      if (url.pathname === '/api/signup') {
        const username = String(body.username || '').trim().toLowerCase();
        // 가입 코드가 막아 주므로, 한 교실(같은 와이파이)이 함께 가입할 수 있게 넉넉히 둔다.
        this.rateLimit(`${address}:signup`, 60, 30 * 60000, '회원가입 시도가 많습니다. 잠시 후 다시 시도해주세요.');
        this.rateLimit(`${address}:signup:${username}`, 4, 30 * 60000, '같은 아이디로 가입 시도가 많습니다. 잠시 후 다시 시도해주세요.');
      }
      // 코드 확인은 아무것도 바꾸지 않으므로 저장 줄을 거치지 않는다.
      if (url.pathname === '/api/signup/check') {
        if (request.method !== 'POST') throw Object.assign(Error('지원하지 않는 요청입니다.'), { status: 405 });
        return json(await withCodeCount(() => checkSignupCode(this.mutations.current().state, body)));
      }
      // Each password check runs scrypt up to three times.
      if (url.pathname === '/api/profile/password') this.rateLimit(`${address}:password:${hashToken(token).slice(0, 16)}`, 8, 15 * 60000, '비밀번호 변경 시도가 많습니다. 잠시 후 다시 시도해주세요.');
      if (url.pathname === '/api/battle/join' || url.pathname === '/api/battle/preview') {
        this.rateLimit(`${address}:battle-join`, 30, 10 * 60000, '대결 방 참가 시도가 많아요. 잠시 후 다시 시도해주세요.');
      }
      if (url.pathname === '/api/dungeon/join' || url.pathname === '/api/dungeon/preview') {
        this.rateLimit(`${address}:dungeon-join`, 30, 10 * 60000, '던전 방 참가 시도가 많아요. 잠시 후 다시 시도해주세요.');
      }
      // V13.129: 학생 한 명(로그인 세션)의 요청 수 제한. 고장 난 화면이 요청을 쏟아 내도 한 줄짜리 저장 줄을
      // 다 차지하지 못하게 한다(넉넉하게: 변경 10초에 60번, 첫 화면 불러오기 1분에 60번).
      if (token && request.method !== 'GET') this.rateLimit(`user:${hashToken(token).slice(0, 16)}`, 60, 10000, '요청이 너무 많아요. 잠시 후 다시 시도해주세요.');
      if (token && url.pathname === '/api/bootstrap') this.rateLimit(`boot:${hashToken(token).slice(0, 16)}`, 60, 60000, '요청이 너무 많아요. 잠시 후 다시 시도해주세요.');
      if (this.rates.size > 10000) {
        for (const [key, values] of this.rates) if (values.at(-1) < Date.now() - 30 * 60000) this.rates.delete(key);
      }

      const currentState = this.mutations.current().state;
      const hasExpiredAttempt = currentState.examAttempts.some(attempt => attempt.status === 'active' && attempt.deadline <= Date.now());
      // Housekeeping (stale practices, old record compaction) also runs hourly, not only at start-up.
      // V13.144: 오늘 쓴 양이 90%를 넘으면 시간마다 하는 정리는 다음 날로 미룬다(끝난 시험 마감은 그대로 한다).
      const sweepDue = Date.now() - this.sweptAt > 3600000 && this.writeLevel() !== 'defer';
      if (hasExpiredAttempt || sweepDue) {
        if (sweepDue) this.sweptAt = Date.now();
        // V13.129: 정리가 실패해도 학생의 요청은 그대로 처리한다(실패는 로그로 남긴다).
        try { await this.mutations.durable(state => sweep(state) ? true : NO_MUTATION); }
        catch (error) { console.error('[sweep]', error?.message); }
      }

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
            ? await withCodeCount(() => selfSignup(state, body))
            : await service(state, request.method, path, body, token, { preauthenticatedUserId, origin: url.origin });
      };

      const startedAt = Date.now();
      const result = request.method === 'GET'
        ? await execute(this.mutations.current().state)
        : isQuickWrite(request.method, url.pathname) ? await this.mutations.fast(execute) : await this.mutations.durable(execute);
      // Room set-up for yacha battles: the questions (with answers) go to the room only.
      // `_battles` (V13.66) carries several room messages, e.g. when a tournament is called off.
      const roomMessages = [...(result?._battle ? [result._battle] : []), ...(Array.isArray(result?._battles) ? result._battles : [])];
      const pushMessages = Array.isArray(result?._push) ? result._push : [];
      // V13.128 던전 방 준비(문제와 입장표는 방에만 간다).
      const dungeonMessages = result?._dungeon ? [result._dungeon] : [];
      // V13.149 교실 게임 방 준비(문제와 입장표는 방에만 간다).
      const partyMessages = Array.isArray(result?._parties) ? result._parties : [];
      if (result && typeof result === 'object') { delete result._battle; delete result._battles; delete result._push; delete result._dungeon; delete result._parties; }
      for (const message of roomMessages) {
        const room = this.env.BATTLE_ROOM.get(this.env.BATTLE_ROOM.idFromName(message.id));
        const reply = await room.fetch('https://battle/admin', { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify(message) }).catch(() => null);
        if (!reply?.ok && message.action !== 'cancel') {
          await this.mutations.durable(state => settleBattle(state, { id: message.id, reason: 'cancelled' }) ? true : NO_MUTATION);
          throw Object.assign(Error('대결 방을 준비하지 못했어요. 잠시 후 다시 시도해주세요.'), { status: 503 });
        }
      }
      for (const message of dungeonMessages) {
        const room = this.env.DUNGEON_ROOM.get(this.env.DUNGEON_ROOM.idFromName(message.id));
        const reply = await room.fetch('https://dungeon/admin', { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify(message) }).catch(() => null);
        if (!reply?.ok && message.action !== 'leave') {
          // 방이 받지 못했다(가득 참, 이미 시작함, 연결 실패): 메인 상태를 되돌리고 방의 이유를 알려 준다.
          const why = await reply?.json().catch(() => null);
          await this.mutations.durable(state => undoDungeon(state, message) ? true : NO_MUTATION);
          throw Object.assign(Error(why?.error || '던전 방을 준비하지 못했어요. 잠시 후 다시 시도해주세요.'), { status: reply && reply.status < 500 ? 409 : 503 });
        }
      }
      for (const message of partyMessages) {
        const room = this.env.PARTY_ROOM.get(this.env.PARTY_ROOM.idFromName(message.id));
        const reply = await room.fetch('https://party/admin', { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify(message) }).catch(() => null);
        if (!reply?.ok && message.action !== 'close') {
          const why = await reply?.json().catch(() => null);
          await this.mutations.durable(state => undoParty(state, message) ? true : NO_MUTATION);
          throw Object.assign(Error(why?.error || '교실 게임 방을 준비하지 못했어요. 잠시 후 다시 시도해주세요.'), { status: reply && reply.status < 500 ? 409 : 503 });
        }
      }
      // After the rooms are ready: a 도전장 for a room that failed to open is never sent.
      if (pushMessages.length) this.ctx.waitUntil(this.deliverPush(pushMessages, url.origin).catch(error => console.error('[push]', error?.message)));
      const elapsed = Date.now() - startedAt;
      const { commitMs, commitBytes } = this.local.metrics;
      // The last successful backup time is read from ctx.storage once, after a restart.
      if (url.pathname === '/api/health') await this.sync.loaded;
      const sync = this.sync.status();
      if (request.method !== 'GET' && elapsed > 1500) console.warn('[slow-mutation]', url.pathname.replace(/\/[0-9a-f-]{36}/g, '/:id'), { elapsed, commitMs, commitBytes });
      // Public health output shows whether the Supabase backup is keeping up.
      // V13.99: supabase_last_ok_at (kept in ctx.storage) and the backup way (parts/full).
      const writeStats = this.local.writeStats();
      if (url.pathname === '/api/health') {
        // V13.144: 오늘(UTC) 이 상태 객체가 쓴 줄 수와 무료 한도(cloudflare/cf-limits.mjs) 대비 %, 시작 경고.
        Object.assign(result, { rows_written_today: writeStats.rows, rows_written_pct: writeStats.pct, rows_written_limit: writeStats.limit, rows_written_day: writeStats.day, write_level: writeStats.level, boot_warning: this.bootWarning });
      }
      // V13.144: 70%를 넘으면 선생님 첫 화면에 경고.
      if (url.pathname === '/api/bootstrap' && result?.profile?.role === 'teacher' && writeStats.pct >= WRITE_WARN_PCT) {
        result.server_write_warning = { pct: Math.round(writeStats.pct), defer: writeStats.level === 'defer', text: `오늘 서버 저장량이 많아요(${Math.round(writeStats.pct)}%)` };
      }
      if (url.pathname === '/api/health') result.storage = { mode: 'local-first', storage_format: this.local.format(), last_commit_rows: this.local.metrics.commitRows, supabase_last_ok_at: sync.last_ok_at, supabase_last_ok_mode: sync.last_ok_mode, supabase_backup_mode: sync.backup_mode, supabase_backup_forced_full: sync.backup_forced_full, supabase_pending: sync.pending, supabase_lag_sec: sync.lag_sec, supabase_failures: sync.failures, supabase_last_error: sync.last_error, supabase_last_sync_ms: sync.last_sync_ms, supabase_mode: sync.mode, supabase_last_upload_kb: sync.last_upload_kb, supabase_full_copy_at: sync.full_copy_at, supabase_full_copy_error: sync.full_copy_error, state_kb: Math.round((this.local.latest()?.size || 0) / 1024), state_breakdown: this.sizeReport() };
      const responseHeaders = {
        // Visible in DevTools > Network > Timing, so slow saves can be measured on a real phone.
        // commit = local durable write; supabase = last background upload.
        'Server-Timing': request.method === 'GET'
          ? `app;dur=${elapsed}`
          : `app;dur=${elapsed}, commit;dur=${commitMs};desc="local ${commitBytes} bytes", supabase;dur=${sync.last_sync_ms}`
      };
      if (result._cookie && loginKey) this.rates.delete(loginKey);
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

// The cron's call into the state object (the public worker blocks /api/internal/).
async function eveningPushKey(env) {
  const bytes = new TextEncoder().encode(`${env.VOCA_STATE_SECRET}:evening-push`);
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(b => b.toString(16).padStart(2, '0')).join('');
}

export default {
  // wrangler.jsonc "triggers": 10:00 UTC = 19:00 in Korea.
  async scheduled(controller, env, ctx) {
    ctx.waitUntil((async () => {
      const stub = env.VOCA_STATE.get(env.VOCA_STATE.idFromName('main'));
      const res = await stub.fetch('https://voca.internal/api/internal/evening-push', { method: 'POST', headers: { ...JSON_HEADERS, 'X-Push-Key': await eveningPushKey(env) }, body: '{}' });
      console.log('[push:evening]', res.status, await res.text());
    })().catch(error => console.error('[push:evening]', error?.message)));
  },
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/internal/')) return securityHeaders(json({ error: '요청한 기능을 찾을 수 없습니다.' }, 404), url.pathname);
    // V13.129: 너무 큰 요청은 상태 객체에 보내기 전에 막는다(단어장 가져오기가 가장 크다: 100만 글자).
    if (url.pathname.startsWith('/api/') && Number(request.headers.get('content-length') || 0) > bodyByteLimit(1000000)) return securityHeaders(json({ error: '요청이 너무 큽니다.' }, 413), url.pathname);
    // Battle sockets go straight to their room; a 101 response must not be re-wrapped.
    const battleSocket = url.pathname.match(/^\/api\/battle\/ws\/([0-9a-f-]{36})$/);
    if (battleSocket) {
      if (request.headers.get('Upgrade') !== 'websocket') return securityHeaders(json({ error: 'WebSocket 연결이 필요해요.' }, 426), url.pathname);
      const origin = request.headers.get('origin');
      if (origin && new URL(origin).host !== url.host) return securityHeaders(json({ error: '허용되지 않은 요청입니다.' }, 403), url.pathname);
      return env.BATTLE_ROOM.get(env.BATTLE_ROOM.idFromName(battleSocket[1])).fetch(request);
    }
    // V13.128 던전 방 소켓도 방으로 바로 간다.
    const dungeonSocket = url.pathname.match(/^\/api\/dungeon\/ws\/([0-9a-f-]{36})$/);
    if (dungeonSocket) {
      if (request.headers.get('Upgrade') !== 'websocket') return securityHeaders(json({ error: 'WebSocket 연결이 필요해요.' }, 426), url.pathname);
      const origin = request.headers.get('origin');
      if (origin && new URL(origin).host !== url.host) return securityHeaders(json({ error: '허용되지 않은 요청입니다.' }, 403), url.pathname);
      return env.DUNGEON_ROOM.get(env.DUNGEON_ROOM.idFromName(dungeonSocket[1])).fetch(request);
    }
    // V13.149 교실 게임 방 소켓(선생님 TV · 학생 폰)도 방으로 바로 간다.
    const partySocket = url.pathname.match(/^\/api\/party\/ws\/([0-9a-f-]{36})$/);
    if (partySocket) {
      if (request.headers.get('Upgrade') !== 'websocket') return securityHeaders(json({ error: 'WebSocket 연결이 필요해요.' }, 426), url.pathname);
      const origin = request.headers.get('origin');
      if (origin && new URL(origin).host !== url.host) return securityHeaders(json({ error: '허용되지 않은 요청입니다.' }, 403), url.pathname);
      return env.PARTY_ROOM.get(env.PARTY_ROOM.idFromName(partySocket[1])).fetch(request);
    }
    if (url.pathname.startsWith('/api/')) {
      const id = env.VOCA_STATE.idFromName('main');
      // V13.144: 상태 객체가 던지면(시작 실패 등) Cloudflare 1101 화면 대신 JSON 503으로 답한다.
      try {
        return securityHeaders(await env.VOCA_STATE.get(id).fetch(request), url.pathname);
      } catch (error) {
        console.error('[voca-state] call failed', error?.message);
        return securityHeaders(bootFailureResponse(error, url.pathname), url.pathname);
      }
    }
    return securityHeaders(await env.ASSETS.fetch(request), url.pathname);
  }
};
