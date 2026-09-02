'use strict';

const assert = require('node:assert/strict');
const baseUrl = process.env.SUMUS_QA_URL || 'http://127.0.0.1:4317';
const code = String(process.env.SUMUS_QA_CODE || '');
const count = Math.min(24, Math.max(1, Number(process.env.SUMUS_QA_COUNT || 24)));
const holdMs = Math.max(1000, Number(process.env.SUMUS_QA_HOLD_MS || 45000));
const joinDelayMs = Math.max(80, Number(process.env.SUMUS_QA_JOIN_DELAY_MS || 220));

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const message = (clientId,type,payload) => JSON.stringify({id:`${clientId}-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,type,payload:{timestamp:Date.now(),...payload},senderId:clientId,timestamp:Date.now()});

(async()=>{
  assert.match(code,/^\d{5}$/);
  const health=await fetch(`${baseUrl}/health`).then(r=>r.json());
  const room=health.battles.find(row=>row.code===code);
  assert.ok(room,`room ${code} not found`);
  const wsUrl=baseUrl.replace(/^http/,'ws');
  const clients=[];
  for(let i=0;i<count;i++){
    const clientId=`raid-qa-${count}-${i+1}-${Date.now()}`,ws=new WebSocket(`${wsUrl}/ws?role=student&clientId=${clientId}`),queue=[];
    await new Promise((resolve,reject)=>{ws.addEventListener('open',resolve,{once:true});ws.addEventListener('error',reject,{once:true})});
    ws.addEventListener('message',event=>queue.push(JSON.parse(event.data)));
    ws.send(message(clientId,'BATTLE_LOOKUP',{code}));
    await wait(30);
    ws.send(message(clientId,'PLAYER_JOIN_REQUEST',{battleId:room.battleId,name:`RAID학생${String(i+1).padStart(2,'0')}`}));
    let accepted;
    for(let n=0;n<200&&!accepted;n++){accepted=queue.find(m=>m.type==='PLAYER_JOIN_ACCEPTED');if(!accepted)await wait(30)}
    assert.ok(accepted,`join timeout ${i+1}`);
    const playerId=accepted.payload.playerId,reconnectToken=accepted.payload.reconnectToken||'';
    ws.send(message(clientId,'PLAYER_CHARACTER',{battleId:room.battleId,playerId,reconnectToken,character:'runner'}));
    ws.send(message(clientId,'PLAYER_READY',{battleId:room.battleId,playerId,reconnectToken}));
    await wait(90);
    ws.send(message(clientId,'PLAYER_READY',{battleId:room.battleId,playerId,reconnectToken}));
    ws._qaHeartbeat=setInterval(()=>{if(ws.readyState===WebSocket.OPEN)ws.send(message(clientId,'TRANSPORT_PING',{battleId:room.battleId,playerId,reconnectToken}))},1800);
    clients.push(ws);
    await wait(joinDelayMs);
  }
  console.log(JSON.stringify({ok:true,count,code,battleId:room.battleId,holdingMs:holdMs}));
  await wait(holdMs);
  clients.forEach(ws=>{clearInterval(ws._qaHeartbeat);ws.close()});
})().catch(error=>{console.error(error.stack||error);process.exitCode=1});
