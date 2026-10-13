// Cloudflare Workers 진입점.
// 화면 파일은 정적 자산으로 내보내고, /api·/ws·/health는 학원 전체를 맡는 Durable Object 하나로 보낸다.
import { DurableObject } from 'cloudflare:workers';
import hubLib from '../lib/hub.js';
import { SqlStore } from './sql-store.js';

const { createHub } = hubLib;
const TICK_MS = 15 * 1000;

export class AcademyRoom extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    const log = (...args) => console.log(...args);
    this.store = new SqlStore(ctx.storage.sql, { log });
    this.store.load();
    this.hub = createHub({ store: this.store, teacherKey: env.STUDY_TEACHER_KEY || '', log });
  }

  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === '/ws') return this.openSocket(request, url);
    if (url.pathname === '/health') return toResponse(this.hub.health());
    const out = await this.hub.api({
      method: request.method,
      path: url.pathname,
      query: url.searchParams,
      header: (name) => request.headers.get(name),
      bodyText: request.method === 'GET' || request.method === 'HEAD' ? '' : await request.text(),
      ip: request.headers.get('cf-connecting-ip') || 'unknown',
      origin: request.headers.get('origin'),
      host: url.host
    });
    await this.keepTicking();
    return toResponse(out);
  }

  async openSocket(request, url) {
    if (request.headers.get('Upgrade') !== 'websocket') return new Response('WebSocket only', { status: 426 });
    if (!this.hub.sameOrigin(request.headers.get('origin'), url.host)) return new Response('Forbidden', { status: 403 });
    const [client, server] = Object.values(new WebSocketPair());
    server.accept();
    const conn = {
      send: (text) => server.send(text),
      close: (code, reason) => { try { server.close(code, reason); } catch { /* 이미 닫힘 */ } }
    };
    this.hub.connect(conn);
    server.addEventListener('message', (event) => this.hub.message(conn, typeof event.data === 'string' ? event.data : ''));
    const gone = () => {
      this.hub.disconnect(conn);
      conn.close(1000, 'bye');
    };
    server.addEventListener('close', gone);
    server.addEventListener('error', gone);
    await this.keepTicking();
    return new Response(null, { status: 101, webSocket: client });
  }

  // 접속자나 공부 중인 학생이 있는 동안 15초마다 깨어나 시간을 저장하고 확인 창 등을 처리한다
  async keepTicking() {
    if ((await this.ctx.storage.getAlarm()) == null) await this.ctx.storage.setAlarm(Date.now() + TICK_MS);
  }

  async alarm() {
    this.hub.tick();
    this.store.flush();
    if (this.hub.active()) await this.ctx.storage.setAlarm(Date.now() + TICK_MS);
  }
}

function toResponse(out) {
  return new Response(out.body, { status: out.status, headers: out.headers });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/ws' || url.pathname === '/health' || url.pathname.startsWith('/api/')) {
      const stub = env.ACADEMY.get(env.ACADEMY.idFromName('academy'));
      return stub.fetch(request);
    }
    return env.ASSETS.fetch(request);
  }
};
