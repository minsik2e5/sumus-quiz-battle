'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Raid = require('../client/raid-domain');

const q = (type='write-en', id='q1') => ({ id, type });
const fresh = (type='write-en', now=1000) => Raid.beginQuestion(Raid.create(20,now),q(type),now);

test('critical, normal, and weak damage use authoritative timing ratios', () => {
  const critical=fresh('write-en'); assert.equal(Raid.correct(critical,'write-en',1000+1000).grade,'critical'); assert.equal(critical.totalDamage,173);
  const normal=fresh('write-en'); assert.equal(Raid.correct(normal,'write-en',1000+6000).grade,'normal'); assert.equal(normal.totalDamage,115);
  const weak=fresh('write-en'); assert.equal(Raid.correct(weak,'write-en',1000+11000).grade,'weak'); assert.equal(weak.totalDamage,81);
});

test('first wrong accelerates gauge, second wrong counters, and pass queues retry', () => {
  const state=fresh(); const deadline=state.attackDeadline;
  const first=Raid.wrong(state,'q1',2000); assert.equal(first.advance,false); assert.equal(state.attackDeadline,deadline-3000); assert.equal(state.hp,100);
  const second=Raid.wrong(state,'q1',2100); assert.equal(second.counter,true); assert.equal(state.hp,92);
  const passState=fresh(); const pass=Raid.pass(passState,'q1',2000); assert.equal(pass.advance,true); assert.deepEqual(passState.retryQuestionIds,['q1']); assert.equal(passState.combo,0);
});

test('timeout attacks at most once and shield is consumed once', () => {
  const state=fresh(); assert.equal(Raid.applyTimeout(state,13000).applied,true); assert.equal(state.hp,90); assert.equal(Raid.applyTimeout(state,14000).applied,false); assert.equal(state.hp,90);
  const shield=fresh(); shield.shield=1; assert.equal(Raid.applyTimeout(shield,13000).blocked,true); assert.equal(shield.hp,100); assert.equal(shield.shield,0);
});

test('combo 3 bonus, combo 5 shield, and combo 10 special attack', () => {
  const state=fresh('write-ko');
  for(let i=0;i<3;i++){Raid.beginQuestion(state,q('write-ko',`q${i}`),1000+i*100);Raid.correct(state,'write-ko',1050+i*100)}
  assert.equal(state.combo,3); assert.ok(state.totalDamage>450);
  for(let i=3;i<5;i++){Raid.beginQuestion(state,q('write-ko',`q${i}`),2000+i*100);Raid.correct(state,'write-ko',2050+i*100)}
  assert.equal(state.shield,1);
  for(let i=5;i<10;i++){Raid.beginQuestion(state,q('write-ko',`q${i}`),3000+i*100);Raid.correct(state,'write-ko',3050+i*100)}
  assert.equal(state.specialCount,1);
});

test('DOWN and unlimited revive HP tiers work for first, second, and third+', () => {
  const state=fresh(); state.hp=5; Raid.applyTimeout(state,13000); assert.equal(state.battleState,'DOWN');
  Raid.correct(state,'write-en',13001); Raid.correct(state,'write-en',13002); assert.equal(state.hp,40); assert.equal(state.reviveCount,1);
  state.hp=1; Raid.beginQuestion(state,q(),14000); Raid.applyTimeout(state,26000); Raid.correct(state,'write-en',26001); Raid.correct(state,'write-en',26002); assert.equal(state.hp,30);
  state.hp=1; Raid.beginQuestion(state,q(),27000); Raid.applyTimeout(state,39000); Raid.correct(state,'write-en',39001); Raid.correct(state,'write-en',39002); assert.equal(state.hp,20); assert.equal(state.reviveCount,3);
});

test('GUARD consumes one answer and critical makes a perfect break', () => {
  const normal=fresh(); Raid.activateGuard(normal); const a=Raid.correct(normal,'write-en',7000); assert.equal(a.guardBreak,true); assert.equal(normal.totalDamage,0); assert.equal(normal.guardState.perfect,false);
  const critical=fresh(); Raid.activateGuard(critical); Raid.correct(critical,'write-en',1100); assert.equal(critical.guardState.perfect,true); assert.equal(critical.stunBonus,true);
});

test('HEAVY progresses 0/2 to cancel, and wrong fails with heavy damage', () => {
  const success=fresh(); Raid.activateHeavy(success); assert.equal(success.heavyAttackState.progress,0); Raid.correct(success,'write-en',1100); assert.equal(success.heavyAttackState.progress,1); Raid.correct(success,'write-en',1200); assert.equal(success.heavyAttackState.cancelled,true);
  const fail=fresh(); Raid.activateHeavy(fail); const result=Raid.wrong(fail,'q1',1200); assert.equal(result.heavyFailed,true); assert.equal(fail.hp,82);
});

test('20 and 68 question plans are automatic and preserve total HP', () => {
  const p20=Raid.planStages(20); assert.equal(p20.totalWaves,3); assert.equal(p20.waves.reduce((n,w)=>n+w.hp,0),1700); assert.deepEqual(p20.waves.map(w=>w.type),['COMMON','ELITE','BOSS']);
  const p68=Raid.planStages(68); assert.equal(p68.totalWaves,6); assert.equal(p68.waves.reduce((n,w)=>n+w.hp,0),5780); assert.equal(p68.waves.at(-1).type,'FINAL BOSS');
});

test('early clear is permitted and reconnect snapshots restore all combat state', () => {
  const state=Raid.create(5,1000); state.waveIndex=state.totalWaves-1; const boss=state.wavePlan.at(-1); state.enemyType=boss.type; state.enemyMaxHp=boss.hp; state.enemyHp=1; Raid.beginQuestion(state,q('spell'),1000); const hit=Raid.correct(state,'spell',1100); assert.equal(hit.cleared,true); assert.equal(state.battleState,'CLEAR');
  state.shield=2; state.attackDeadline=99999; const restored=Raid.restore(Raid.snapshot(state)); assert.deepEqual(restored,state); restored.hp=1; assert.notEqual(restored.hp,state.hp);
});

test('stage planner scales across arbitrary question counts without 20/68 special cases', () => {
  let previousWaves=0;
  for (const count of [1,2,7,12,13,19,20,21,24,25,39,40,41,59,60,61,67,68,69,100]) {
    const plan=Raid.planStages(count);
    assert.equal(plan.questionCount,count);
    assert.equal(plan.totalMonsterHp,count*Raid.CONFIG.totalHpPerQuestion);
    assert.equal(plan.waves.length,plan.totalWaves);
    assert.equal(plan.waves.reduce((sum,wave)=>sum+wave.hp,0),plan.totalMonsterHp);
    assert.ok(plan.waves.every((wave,index)=>wave.index===index&&wave.number===index+1&&wave.hp>0));
    assert.ok(plan.totalWaves>=previousWaves);
    previousWaves=plan.totalWaves;
  }
});

const runLongRaid = questionCount => {
  let state=Raid.create(questionCount,10_000);
  const stateKeys=Object.keys(state).sort();
  const visited=new Set([state.waveIndex]);
  let previousDamage=0, previousWave=0, now=10_000;

  for(let index=0;index<questionCount;index+=1){
    now+=20_000;
    Raid.beginQuestion(state,q('choice-en-ko',`long-${questionCount}-${index}`),now);
    if(index%17===7){
      Raid.wrong(state,state.currentQuestionId,now+500);
      Raid.wrong(state,state.currentQuestionId,now+700);
    }else if(index%13===5){
      Raid.pass(state,state.currentQuestionId,now+500);
    }else{
      Raid.correct(state,'choice-en-ko',now+Math.round(state.attackDurationMs*.95));
    }
    assert.ok(Number.isFinite(state.hp)&&state.hp>=0&&state.hp<=state.maxHp);
    assert.ok(Number.isFinite(state.enemyHp)&&Number.isFinite(state.totalDamage));
    assert.ok(state.totalDamage>=previousDamage);
    assert.ok(state.waveIndex>=previousWave);
    previousDamage=state.totalDamage; previousWave=state.waveIndex; visited.add(state.waveIndex);
    state=Raid.restore(JSON.parse(JSON.stringify(Raid.snapshot(state))));
    assert.deepEqual(Object.keys(state).sort(),stateKeys);
  }

  let retries=0;
  while(!state.cleared&&retries<questionCount*3){
    now+=20_000; retries+=1;
    Raid.beginQuestion(state,q('write-en',`retry-${questionCount}-${retries}`),now);
    Raid.correct(state,'write-en',now+Math.round(state.attackDurationMs*.55));
    visited.add(state.waveIndex);
    state=Raid.restore(Raid.snapshot(state));
  }
  assert.equal(state.cleared,true);
  assert.equal(state.enemyHp,0);
  assert.equal(state.waveIndex,state.totalWaves-1);
  assert.deepEqual([...visited].sort((a,b)=>a-b),Array.from({length:state.totalWaves},(_,i)=>i));
  assert.ok(Number.isFinite(state.totalDamage)&&state.totalDamage>=state.wavePlan.reduce((sum,wave)=>sum+wave.hp,0));
  return { state, retries };
};

test('20-question RAID completes every planned wave without cumulative state loss', () => {
  const result=runLongRaid(20);
  assert.equal(result.state.wavePlan.length,3);
  assert.ok(result.retries<60);
});

test('68-question long RAID preserves HP, damage, combo, waves, and snapshots', () => {
  const result=runLongRaid(68);
  assert.equal(result.state.wavePlan.length,6);
  assert.ok(result.state.maxCombo>=1);
  assert.ok(result.retries<204);
});
