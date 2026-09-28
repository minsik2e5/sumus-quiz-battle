// A stand-in for the Supabase state RPCs, for `wrangler dev` on this PC only.
// Starts from the local test database (var/sumus.sqlite) and keeps everything in memory,
// so a local worker never talks to the real Supabase.
// Usage: node prototypes/tools/mock-supabase.mjs [port=54321]
import http from 'node:http';
import { fileURLToPath } from 'node:url';

const SECRET = 'local-test';
const port = Number(process.argv[2]) || 54321;
const root = new URL('../../', import.meta.url);
const { repository } = await import(new URL('server/repository.mjs', root));
const repo = await repository(fileURLToPath(new URL('var/sumus.sqlite', root)));
let { state } = await repo.read();
repo.close?.();
let revision = 1;

http.createServer(async (req, res) => {
  const reply = (status, body) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(body)); };
  let text = ''; for await (const chunk of req) text += chunk;
  let body = {}; try { body = JSON.parse(text || '{}'); } catch { return reply(400, { message: 'bad json' }); }
  if (body.p_secret !== SECRET) return reply(401, { message: 'bad secret' });
  if (req.url.endsWith('/voca_v12_state_read')) return reply(200, [{ revision, data: state }]);
  if (req.url.endsWith('/voca_v12_state_commit')) {
    if (Number(body.p_revision) !== revision) return reply(409, { code: '40001', message: 'revision_conflict' });
    state = body.p_data; revision++;
    console.log('[mock-supabase] commit', revision, Math.round(text.length / 1024) + 'KB');
    return reply(200, revision);
  }
  reply(404, { message: 'unknown rpc' });
}).listen(port, '127.0.0.1', () => console.log(`[mock-supabase] http://127.0.0.1:${port} (secret "${SECRET}")`));
