'use strict';

const origin = process.env.SUMUS_QA_ORIGIN || 'ws://127.0.0.1:8794';
const code = String(process.env.SUMUS_QA_CODE || '00000');
const count = Math.max(1,Number(process.env.SUMUS_QA_CLIENTS || 23));
const existingPrefix = String(process.env.SUMUS_QA_EXISTING_PREFIX || '');
const waiters = new Map();

function send(ws,type,payload,senderId){
  ws.send(JSON.stringify({id:`${senderId}-${Date.now()}-${Math.random()}`,type,payload:{timestamp:Date.now(),...payload},senderId,timestamp:Date.now()}));
}
function waitFor(clientId,type,timeoutMs=10000){
  return new Promise((resolve,reject)=>{
    const key=`${clientId}:${type}`;
    const timer=setTimeout(()=>{waiters.delete(key);reject(new Error(`timeout ${key}`))},timeoutMs);
    waiters.set(key,message=>{clearTimeout(timer);waiters.delete(key);resolve(message)});
  });
}
function open(clientId){
  return new Promise((resolve,reject)=>{
    const ws=new WebSocket(`${origin}/ws?role=student&clientId=${clientId}`);
    const timer=setTimeout(()=>reject(new Error(`open timeout ${clientId}`)),10000);
    ws.addEventListener('open',()=>{clearTimeout(timer);resolve(ws)},{once:true});
    ws.addEventListener('error',()=>reject(new Error(`socket error ${clientId}`)),{once:true});
    ws.addEventListener('message',event=>{
      const message=JSON.parse(event.data),waiter=waiters.get(`${clientId}:${message.type}`);
      if(waiter)waiter(message);
    });
  });
}

(async()=>{
  if(!/^\d{5}$/.test(code))throw new Error('SUMUS_QA_CODE must be a live five-digit room code');
  const clients=[];
  if(existingPrefix){
    const probeId=`c4-ready-probe-${process.pid}`,probe=await open(probeId),snapshotPromise=waitFor(probeId,'BATTLE_STATE');
    send(probe,'BATTLE_LOOKUP',{code},probeId);
    const snapshot=await snapshotPromise,battleId=snapshot.payload?.battleId;
    probe.close();
    const targets=(snapshot.payload?.players||[]).filter(player=>String(player.name||'').startsWith(existingPrefix)&&!player.ready);
    for(const [index,player] of targets.entries()){
      const clientId=`c4-ready-${process.pid}-${index+1}`,ws=await open(clientId);
      send(ws,'PLAYER_CHARACTER',{battleId,playerId:player.id,character:'runner'},clientId);
      send(ws,'PLAYER_READY',{battleId,playerId:player.id},clientId);
      await new Promise(resolve=>setTimeout(resolve,40));
      send(ws,'PLAYER_READY',{battleId,playerId:player.id},clientId);
      ws._qaHeartbeat=setInterval(()=>send(ws,'TRANSPORT_PING',{battleId,playerId:player.id},clientId),1800);
      clients.push(ws);
    }
    console.log(JSON.stringify({ok:true,code,readied:clients.length,existingPrefix}));
  } else {
  for(let index=0;index<count;index+=1){
    const clientId=`c4-qa-${process.pid}-${index+1}`,ws=await open(clientId);
    const statePromise=waitFor(clientId,'BATTLE_STATE');
    send(ws,'BATTLE_LOOKUP',{code},clientId);
    const state=await statePromise,battleId=state.payload?.battleId;
    const acceptedPromise=waitFor(clientId,'PLAYER_JOIN_ACCEPTED');
    send(ws,'PLAYER_JOIN_REQUEST',{battleId,name:`C4학생${String(index+2).padStart(2,'0')}`,deviceId:`c4-device-${process.pid}-${index+1}`},clientId);
    const accepted=await acceptedPromise;
    const playerId=accepted.payload.playerId,reconnectToken=accepted.payload.reconnectToken||'';
    send(ws,'PLAYER_CHARACTER',{battleId,playerId,reconnectToken,character:'runner'},clientId);
    send(ws,'PLAYER_READY',{battleId,playerId,reconnectToken},clientId);
    await new Promise(resolve=>setTimeout(resolve,40));
    send(ws,'PLAYER_READY',{battleId,playerId,reconnectToken},clientId);
    ws._qaHeartbeat=setInterval(()=>send(ws,'TRANSPORT_PING',{battleId,playerId,reconnectToken},clientId),1800);
    clients.push(ws);
  }
  console.log(JSON.stringify({ok:true,code,connected:clients.length}));
  }
  const close=()=>{clients.forEach(ws=>{clearInterval(ws._qaHeartbeat);ws.close()});process.exit(0)};
  process.on('SIGINT',close);process.on('SIGTERM',close);
  setInterval(()=>{},30000);
})().catch(error=>{console.error(error.stack||error);process.exit(1)});
