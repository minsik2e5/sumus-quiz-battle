'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Results = require('../client/raid-results-model');

const player = (overrides = {}) => ({
  id:'p1',name:'민준',assignedTotal:10,questionIndex:8,finished:false,raidSessionEnded:true,raidManualEnd:true,
  raid:{cleared:false,waveIndex:1,totalWaves:3,maxCombo:7,reviveCount:1},
  raidLearning:{counts:{correct:6,wrong:2,pass:1,timeout:1},words:{
    q1:{id:'q1',word:'significant',meaning:'중요한',expected:'중요한',correct:1,wrong:1,pass:0,timeout:0},
    q2:{id:'q2',word:'ordinary',meaning:'평범한',expected:'평범한',correct:0,wrong:0,pass:1,timeout:1}
  }},...overrides
});

test('student RAID results use learning outcomes and preserve partial/manual end', () => {
  const result=Results.student(player());
  assert.deepEqual({total:result.total,correct:result.correct,wrong:result.wrong,pass:result.pass,timeout:result.timeout,accuracy:result.accuracy},{total:10,correct:6,wrong:2,pass:1,timeout:1,accuracy:60});
  assert.equal(result.partial,true);assert.equal(result.retryCount,4);assert.equal(result.retryWords.length,2);
  assert.equal(result.retryWords.find(row=>row.id==='q2').status,'TIMEOUT');
});

test('class summary is weighted by attempts and never ranks by damage', () => {
  const clear=player({id:'p2',name:'서윤',questionIndex:10,finished:true,raidSessionEnded:true,raidManualEnd:false,raid:{cleared:true,waveIndex:2,totalWaves:3,maxCombo:10,reviveCount:0,totalDamage:999999},raidLearning:{counts:{correct:10,wrong:0,pass:0,timeout:0},words:{}}});
  const summary=Results.classroom([player(),clear]);
  assert.deepEqual({students:summary.students,completed:summary.completed,cleared:summary.cleared,incomplete:summary.incomplete},{students:2,completed:2,cleared:1,incomplete:1});
  assert.equal(summary.averageAccuracy,80);assert.equal(summary.maxCombo,10);assert.equal(summary.retryBurden,4);
  assert.equal(Object.hasOwn(summary,'damage'),false);
});

test('public retry payload contains assigned source word detail only after projection', () => {
  const result=Results.publicResult(player());
  assert.deepEqual(result.retryWords.map(row=>row.word).sort(),['ordinary','significant']);
  assert.ok(result.retryWords.every(row=>row.expected));
});
