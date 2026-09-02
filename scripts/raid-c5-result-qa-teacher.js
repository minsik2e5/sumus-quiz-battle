'use strict';

const origin=process.env.SUMUS_QA_ORIGIN||'http://localhost:8790';
const code=process.env.SUMUS_QA_CODE||'73195',battleId=`c5-result-${Date.now()}`,teacherId=`c5-result-teacher-${process.pid}`,playerId='c5-result-player';
const player={id:playerId,name:'학습결과',character:'runner',ready:true,connected:true,status:'FINISHED',rangeFrom:'DAY 01',rangeTo:'DAY 03',units:['DAY 01','DAY 02','DAY 03'],assignedTotal:10,questionIndex:7,combo:0,correct:5,wrong:2,pass:1,maxCombo:7,times:[2.1,3.2],finished:false,raidSessionEnded:true,raidManualEnd:true,raid:{hp:72,maxHp:100,enemyType:'BOSS',enemyHp:320,enemyMaxHp:600,waveIndex:1,totalWaves:2,maxCombo:7,reviveCount:1,cleared:false},raidResult:{id:playerId,name:'학습결과',assigned:10,progressed:7,total:9,correct:5,wrong:2,pass:1,timeout:1,accuracy:56,maxCombo:7,reviveCount:1,wavesCleared:1,totalWaves:2,cleared:false,finished:true,incomplete:true,partial:true,retryCount:4,connected:true,retryWords:[{id:'q1',word:'significant',meaning:'중요한, 상당한',expected:'중요한, 상당한',wrong:1,pass:0,timeout:0,correct:1,resolved:true,status:'WRONG'},{id:'q2',word:'ordinary',meaning:'평범한, 일반적인',expected:'평범한, 일반적인',wrong:0,pass:1,timeout:1,correct:0,resolved:false,status:'TIMEOUT'}]}};
const envelope=(type,payload={},targetClientId='')=>({id:`${teacherId}-${Date.now()}-${Math.random()}`,type,payload:{battleId,playerId:'',questionId:'',attemptId:'',timestamp:Date.now(),targetClientId,...payload},senderId:teacherId,timestamp:Date.now()});
const snapshot=targetClientId=>({battleId,battleCode:code,arena:'raid',arenaName:'WORD TAMING RAID',bookId:'neungyul-voca-root-high-2025',bookName:'능률VOCA 어원편 고등 2025개정',rangeMode:'individual',selectedUnits:['DAY 01'],config:{questionCount:10,passOn:true,showAnswer:false},screen:'results',running:false,paused:false,targetClientId,players:[player]});
const url=new URL('/ws',origin);url.protocol=url.protocol==='https:'?'wss:':'ws:';url.searchParams.set('role','teacher');url.searchParams.set('clientId',teacherId);url.searchParams.set('battleId',battleId);url.searchParams.set('code',code);
const ws=new WebSocket(url);
const send=(type,payload,target)=>ws.send(JSON.stringify(envelope(type,payload,target)));
ws.onopen=()=>send('SERVER_REGISTER_BATTLE',{battleCode:code});
ws.onmessage=event=>{const message=JSON.parse(event.data),p=message.payload||{};
  if(message.type==='SERVER_REGISTERED')console.log(JSON.stringify({ok:true,code,battleId}));
  if(message.type==='BATTLE_LOOKUP')send('BATTLE_STATE',snapshot(message.senderId),message.senderId);
  if(message.type==='PLAYER_JOIN_REQUEST'){send('PLAYER_JOIN_ACCEPTED',{playerId,reconnectToken:'qa-result-token',player,snapshot:snapshot(message.senderId)},message.senderId);setTimeout(()=>send('BATTLE_STATE',snapshot(message.senderId),message.senderId),60);}
  if(message.type==='TRANSPORT_PING'||message.type==='PLAYER_READY')send('BATTLE_STATE',snapshot(message.senderId),message.senderId);
};
setInterval(()=>{if(ws.readyState===WebSocket.OPEN)send('SERVER_SAVE_TEACHER_STATE',{battleCode:code,state:{battleId,battleCode:code,arena:'raid',screen:'results',players:[player],race:{running:false,paused:false}}});},2000);
