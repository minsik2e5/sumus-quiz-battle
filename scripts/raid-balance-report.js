'use strict';

const fs = require('node:fs');
const path = require('node:path');
const Raid = require('../client/raid-domain');

const counts = [5,10,20,40,68];
const profiles = {
  fast:{ratio:.2,transition:1.1,pattern:()=> 'correct'},
  average:{ratio:.58,transition:1.5,pattern:index=>index%17===9?'timeout':index%11===6?'pass':index%8===3?'wrong':'correct'},
  slow:{ratio:.9,transition:1.8,pattern:index=>index%9===4?'timeout':index%7===2?'pass':index%5===1?'wrong':'correct'}
};

function simulate(questionCount, profileName) {
  const profile=profiles[profileName], state=Raid.create(questionCount,1_000);
  let now=1_000,attempts=0,correct=0,bossAttacks=0,guard=0,heavy=0,revives=0;
  const retry=[];
  while(!state.cleared&&attempts<questionCount*8){
    const index=attempts++,id=`q-${attempts}`,type=attempts%4===0?'write-en':'choice-en-ko';
    Raid.beginQuestion(state,{id,type},now);
    const action=retry.length?'correct':profile.pattern(index);
    if(action==='timeout'){now+=state.attackDurationMs;const hit=Raid.applyTimeout(state,now);if(hit.applied)bossAttacks+=1;retry.push(id);}
    else if(action==='pass'){now+=Math.round(state.attackDurationMs*.45);Raid.pass(state,id,now);retry.push(id);}
    else if(action==='wrong'){
      now+=Math.round(state.attackDurationMs*.35);Raid.wrong(state,id,now);
      now+=120;const hit=Raid.wrong(state,id,now);if(hit.counter||hit.heavyFailed)bossAttacks+=1;retry.push(id);
    } else {
      now+=Math.round(state.attackDurationMs*profile.ratio);
      const beforeGuard=!!state.guardState?.active,beforeRevive=state.reviveCount;
      Raid.correct(state,type,now);correct+=1;
      if(beforeGuard)guard+=1;if(state.reviveCount>beforeRevive)revives+=state.reviveCount-beforeRevive;
      if(state.waveIndex===state.totalWaves-1&&!state.heavyTriggered&&!state.guardState?.active&&correct>=4){Raid.activateHeavy(state);state.heavyTriggered=true;heavy+=1;}
      if(retry.length)retry.shift();
    }
    if(state.battleState==='DOWN'){
      for(let reviveHit=0;reviveHit<2;reviveHit+=1){now+=500;const before=state.reviveCount;Raid.correct(state,'choice-en-ko',now);if(state.reviveCount>before)revives+=1;}
    }
    now+=profile.transition*1000;
  }
  return {
    profile:profileName,cleared:state.cleared,waves:state.totalWaves,attempts,estimatedSeconds:Math.round((now-1_000)/1000),
    bossAttacks,guard,heavy,revives,reviveObserved:revives>0,reviveProbability:revives>0?1:0,
    maxCombo:state.maxCombo,totalDamage:state.totalDamage,finalHp:state.hp
  };
}

const report={generatedAt:new Date().toISOString(),rulesChanged:false,reason:'All measured sizes clear with the existing adaptive stage planner; no balance change justified.',counts:{}};
for(const count of counts){const plan=Raid.planStages(count);report.counts[count]={plan,profiles:Object.fromEntries(Object.keys(profiles).map(name=>[name,simulate(count,name)]))};}
const outputDir=path.join(__dirname,'..','qa','v0.9.3c5');fs.mkdirSync(outputDir,{recursive:true});
fs.writeFileSync(path.join(outputDir,'balance-report.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
