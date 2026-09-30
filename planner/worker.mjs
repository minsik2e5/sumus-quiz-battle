// SUMUS 수업관리 플래너 (Cloudflare Worker). Moved off ChatGPT Sites on 2026-10-01 so it can be
// changed and deployed directly. Static pages come from ./public; /api/* goes to one Durable
// Object that keeps the whole planner as one JSON document plus the PIN and sessions.
import { handleApi } from './server.mjs';

export class PlannerState {
  constructor(ctx, env) { this.ctx = ctx; this.env = env; }
  async fetch(request) {
    const store = {
      get: key => this.ctx.storage.get(key),
      put: (key, value) => this.ctx.storage.put(key, value),
      delete: key => this.ctx.storage.delete(key)
    };
    return handleApi(request, store, Date.now());
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/')) {
      const stub = env.PLANNER_STATE.get(env.PLANNER_STATE.idFromName('main'));
      return stub.fetch(request);
    }
    // /widget (the desktop widget EXE opens it) is public/widget.html, served by the assets.
    return env.ASSETS.fetch(request);
  }
};
