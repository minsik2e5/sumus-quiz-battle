const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = Number(process.env.PORT || 3000);
const PUBLIC = path.join(__dirname, 'public');
const CAPACITY = 20;
const rooms = new Map();

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
};

function token() { return crypto.randomBytes(18).toString('base64url'); }
function code() {
  for (let i = 0; i < 100; i++) {
    const c = String(Math.floor(100000 + Math.random() * 900000));
    if (!rooms.has(c)) return c;
  }
  throw new Error('ROOM_CODE_EXHAUSTED');
}
function safeName(v) { return String(v || '').trim().replace(/[<>]/g, '').slice(0, 16) || '학생'; }
function json(res, status, body) { const data = Buffer.from(JSON.stringify(body)); res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': data.length, 'Cache-Control': 'no-store' }); res.end(data); }
async function body(req) { let s=''; for await (const c of req) { s += c; if (s.length > 100_000) throw new Error('BODY_TOO_LARGE'); } return s ? JSON.parse(s) : {}; }
function publicUrl(req) { const host = req.headers['x-forwarded-host'] || req.headers.host || `localhost:${PORT}`; const proto = (req.headers['x-forwarded-proto'] || (host.includes('localhost') || host.startsWith('127.') ? 'http' : 'https')).split(',')[0]; return `${proto}://${host}`; }
function elapsed(room, now = Date.now()) { if (!room.startAt) return 0; const end = room.phase === 'paused' && room.pauseStartedAt ? room.pauseStartedAt : now; return Math.max(0, end - room.startAt - room.pausedAccumMs); }
function snapshot(room) { return { code: room.code, phase: room.phase, roundId: room.roundId, seed: room.seed, startAt: room.startAt, pauseStartedAt: room.pauseStartedAt, pausedAccumMs: room.pausedAccumMs, capacity: CAPACITY, players: [...room.players.values()].map(p => ({ id:p.id, name:p.name, ready:p.ready, alive:p.alive, eliminatedAtMs:p.eliminatedAtMs, connected:p.connected })) }; }
function sseWrite(res, event, data) { res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`); }
function broadcast(room, event='room:state', data=snapshot(room)) { for (const client of room.sseClients) { try { sseWrite(client.res, event, data); } catch {} } }
function broadcastState(room) { broadcast(room, 'room:state', snapshot(room)); }
function connectedPlayers(room) { return [...room.players.values()].filter(p => p.connected); }
function authorizeTeacher(room, t) { return room && t && t === room.teacherToken; }
function authorizePlayer(room, id, t) { const p = room?.players.get(id); return p && t && p.token === t ? p : null; }
function finishIfNeeded(room) { const connected = connectedPlayers(room); const alive = connected.filter(p => p.alive); if (['running','paused'].includes(room.phase) && connected.length >= 2 && alive.length <= 1) { room.phase = 'finished'; broadcast(room, 'round:finished', { winner: alive[0] ? { id: alive[0].id, name: alive[0].name } : null, elapsedMs: elapsed(room) }); broadcastState(room); } }
function cleanupRoom(room) { const anySse = room.sseClients.size > 0; const anyConnected = connectedPlayers(room).length > 0; if (!anySse && !anyConnected && Date.now() - room.createdAt > 60_000) rooms.delete(room.code); }

setInterval(() => {
  for (const room of rooms.values()) {
    for (const c of room.sseClients) { try { c.res.write(': ping\n\n'); } catch {} }
    if (room.phase === 'countdown' && room.startAt && Date.now() >= room.startAt) { room.phase = 'running'; broadcast(room, 'round:start', { roundId: room.roundId, seed: room.seed, startAt: room.startAt }); broadcastState(room); }
    cleanupRoom(room);
  }
}, 1000).unref();

function staticFile(req, res, pathname) {
  let rel = pathname === '/' ? '/index.html' : pathname;
  rel = path.normalize(rel).replace(/^([.][.][/\\])+/, '');
  const file = path.join(PUBLIC, rel);
  if (!file.startsWith(PUBLIC)) return false;
  try {
    const st = fs.statSync(file); if (!st.isFile()) return false;
    const ext = path.extname(file); res.writeHead(200, { 'Content-Type': mime[ext] || 'application/octet-stream', 'Cache-Control': ext === '.html' ? 'no-store' : 'public, max-age=300' }); fs.createReadStream(file).pipe(res); return true;
  } catch { return false; }
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const p = url.pathname;
    if (p === '/healthz') return json(res, 200, { ok:true, version:'0.10.0', rooms:rooms.size, now:Date.now() });

    if (req.method === 'POST' && p === '/api/teacher/create') {
      const c = code(); const teacherToken = token(); const base = publicUrl(req); const joinUrl = `${base}/student.html?room=${c}`;
      const room = { code:c, teacherToken, createdAt:Date.now(), players:new Map(), sseClients:new Set(), phase:'lobby', roundId:0, seed:0, startAt:null, pauseStartedAt:null, pausedAccumMs:0, joinUrl };
      rooms.set(c, room); return json(res, 200, { ok:true, code:c, teacherToken, joinUrl, room:snapshot(room) });
    }

    if (req.method === 'POST' && p === '/api/student/join') {
      const b = await body(req); const room = rooms.get(String(b.code || ''));
      if (!room) return json(res, 404, { ok:false, error:'ROOM_NOT_FOUND' });
      if (room.phase !== 'lobby') return json(res, 409, { ok:false, error:'ROUND_ALREADY_STARTED' });
      if (connectedPlayers(room).length >= CAPACITY) return json(res, 409, { ok:false, error:'ROOM_FULL' });
      const id = crypto.randomUUID(); const playerToken = token(); const player = { id, token:playerToken, name:safeName(b.name), ready:false, alive:true, eliminatedAtMs:null, connected:true, lastSeenAt:Date.now() };
      room.players.set(id, player); broadcastState(room); return json(res, 200, { ok:true, playerId:id, playerToken, room:snapshot(room) });
    }

    if (req.method === 'POST' && p === '/api/student/reconnect') {
      const b = await body(req); const room = rooms.get(String(b.code || '')); const player = authorizePlayer(room, b.playerId, b.playerToken);
      if (!player) return json(res, 403, { ok:false, error:'RECONNECT_DENIED' }); player.connected = true; player.lastSeenAt = Date.now(); broadcastState(room); return json(res, 200, { ok:true, room:snapshot(room) });
    }

    if (req.method === 'GET' && p === '/api/events') {
      const room = rooms.get(url.searchParams.get('code') || ''); if (!room) return json(res, 404, { ok:false, error:'ROOM_NOT_FOUND' });
      const role = url.searchParams.get('role'); let id = null;
      if (role === 'teacher') { if (!authorizeTeacher(room, url.searchParams.get('token'))) return json(res, 403, { ok:false, error:'DENIED' }); }
      else if (role === 'student') { id = url.searchParams.get('playerId'); const pl = authorizePlayer(room, id, url.searchParams.get('token')); if (!pl) return json(res, 403, { ok:false, error:'DENIED' }); pl.connected = true; pl.lastSeenAt = Date.now(); }
      else return json(res, 400, { ok:false, error:'BAD_ROLE' });
      res.writeHead(200, { 'Content-Type':'text/event-stream; charset=utf-8', 'Cache-Control':'no-cache, no-transform', 'Connection':'keep-alive', 'X-Accel-Buffering':'no' }); res.write('retry: 1500\n\n');
      const client = { res, role, id }; room.sseClients.add(client); sseWrite(res, 'room:state', snapshot(room));
      req.on('close', () => { room.sseClients.delete(client); if (role === 'student') { const pl=room.players.get(id); if (pl) { pl.connected=false; pl.lastSeenAt=Date.now(); } broadcastState(room); finishIfNeeded(room); } cleanupRoom(room); }); return;
    }

    if (req.method === 'GET' && p === '/api/room/state') {
      const room = rooms.get(url.searchParams.get('code') || ''); if (!room) return json(res,404,{ok:false,error:'ROOM_NOT_FOUND'});
      return json(res,200,{ok:true,room:snapshot(room)});
    }

    if (req.method === 'POST' && p === '/api/student/ready') {
      const b = await body(req); const room=rooms.get(String(b.code||'')); const pl=authorizePlayer(room,b.playerId,b.playerToken);
      if(!pl)return json(res,403,{ok:false,error:'DENIED'}); if(room.phase!=='lobby')return json(res,409,{ok:false,error:'NOT_LOBBY'}); pl.ready=!!b.ready; pl.lastSeenAt=Date.now(); broadcastState(room); return json(res,200,{ok:true});
    }

    if (req.method === 'POST' && p === '/api/teacher/start') {
      const b=await body(req); const room=rooms.get(String(b.code||'')); if(!authorizeTeacher(room,b.teacherToken))return json(res,403,{ok:false,error:'DENIED'}); const ps=connectedPlayers(room); if(ps.length<2)return json(res,409,{ok:false,error:'NEED_2_PLAYERS'}); if(!ps.every(x=>x.ready))return json(res,409,{ok:false,error:'NOT_ALL_READY'});
      room.roundId++; room.seed=crypto.randomInt(1,0x7fffffff); room.startAt=Date.now()+4000; room.pauseStartedAt=null; room.pausedAccumMs=0; room.phase='countdown'; ps.forEach(x=>{x.alive=true;x.eliminatedAtMs=null}); broadcast(room,'round:scheduled',{roundId:room.roundId,seed:room.seed,startAt:room.startAt}); broadcastState(room); return json(res,200,{ok:true,roundId:room.roundId,seed:room.seed,startAt:room.startAt});
    }

    if (req.method === 'POST' && p === '/api/teacher/pause') {
      const b=await body(req); const room=rooms.get(String(b.code||'')); if(!authorizeTeacher(room,b.teacherToken))return json(res,403,{ok:false,error:'DENIED'}); if(room.phase!=='running')return json(res,409,{ok:false,error:'NOT_RUNNING'}); room.phase='paused'; room.pauseStartedAt=Date.now(); broadcast(room,'round:pause',{at:room.pauseStartedAt}); broadcastState(room); return json(res,200,{ok:true,elapsedMs:elapsed(room)});
    }
    if (req.method === 'POST' && p === '/api/teacher/resume') {
      const b=await body(req); const room=rooms.get(String(b.code||'')); if(!authorizeTeacher(room,b.teacherToken))return json(res,403,{ok:false,error:'DENIED'}); if(room.phase!=='paused'||!room.pauseStartedAt)return json(res,409,{ok:false,error:'NOT_PAUSED'}); const now=Date.now(); room.pausedAccumMs+=now-room.pauseStartedAt; room.pauseStartedAt=null; room.phase='running'; broadcast(room,'round:resume',{at:now,pausedAccumMs:room.pausedAccumMs}); broadcastState(room); return json(res,200,{ok:true,pausedAccumMs:room.pausedAccumMs});
    }
    if (req.method === 'POST' && p === '/api/teacher/restart') {
      const b=await body(req); const room=rooms.get(String(b.code||'')); if(!authorizeTeacher(room,b.teacherToken))return json(res,403,{ok:false,error:'DENIED'}); room.phase='lobby'; room.startAt=null; room.pauseStartedAt=null; room.pausedAccumMs=0; room.players.forEach(x=>{x.ready=false;x.alive=true;x.eliminatedAtMs=null}); broadcast(room,'round:reset',{}); broadcastState(room); return json(res,200,{ok:true});
    }
    if (req.method === 'POST' && p === '/api/student/eliminated') {
      const b=await body(req); const room=rooms.get(String(b.code||'')); const pl=authorizePlayer(room,b.playerId,b.playerToken); if(!pl)return json(res,403,{ok:false,error:'DENIED'}); if(room.roundId!==b.roundId||!['running','paused'].includes(room.phase))return json(res,409,{ok:false,error:'ROUND_MISMATCH'}); if(!pl.alive)return json(res,200,{ok:true,duplicate:true}); const sv=elapsed(room); const cv=Number(b.elapsedMs); const accepted=Number.isFinite(cv)?Math.min(sv+1500,Math.max(0,cv)):sv; pl.alive=false; pl.eliminatedAtMs=Math.round(accepted); broadcastState(room); const alive=connectedPlayers(room).filter(x=>x.alive).length; broadcast(room,'round:alive',{alive,total:connectedPlayers(room).length}); finishIfNeeded(room); return json(res,200,{ok:true,eliminatedAtMs:pl.eliminatedAtMs});
    }

    if (staticFile(req,res,p)) return;
    json(res,404,{ok:false,error:'NOT_FOUND'});
  } catch (err) { console.error(err); if (!res.headersSent) json(res,500,{ok:false,error:'SERVER_ERROR'}); else res.end(); }
});

server.listen(PORT, () => console.log(`Sweet Survival V0.10 SSE server listening on :${PORT}`));
