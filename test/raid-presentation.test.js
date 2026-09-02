'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Raid = require('../client/raid-domain');
const Visual = require('../client/raid-visual-model');

const root = path.join(__dirname, '..');

test('RAID presentation never assigns frozen gameplay fields', () => {
  const source = fs.readFileSync(path.join(root, 'client', 'raid-presentation.js'), 'utf8');
  const frozen = '(?:hp|enemyHp|combo|damage|totalDamage|questionIndex|waveIndex|attackDeadline|wrongAttemptsForCurrentQuestion|shield|reviveCount|cleared|clearAt)';
  assert.doesNotMatch(source, new RegExp(`\\b(?:state|raid|player|StudentSession\\.player)\\.${frozen}\\s*=`));
  assert.doesNotMatch(source, /RaidFoundation\.(?:correct|wrong|pass|applyTimeout|beginQuestion|activateGuard|activateHeavy)\s*\(/);
  assert.doesNotMatch(source, /(?:RaceEngine|TeacherBridge|StudentApp)\.[A-Za-z_$][\w$]*\s*=/);
  assert.match(source, /prefers-reduced-motion:reduce/);
  assert.match(source, /RaidVisualModel\.MAX_EFFECT_NODES/);
});

test('V0.9.3C.4 preserves dedicated shells for both roles and keeps teacher answers private', () => {
  const source = fs.readFileSync(path.join(root, 'client', 'raid-presentation.js'), 'utf8');
  const shells = fs.readFileSync(path.join(root, 'client', 'raid-shell.js'), 'utf8');
  const css = fs.readFileSync(path.join(root, 'client', 'raid-premium.css'), 'utf8');
  assert.match(source, /V0\.9\.3C\.4 RAID GAME FEEL/);
  assert.match(shells, /renderRaidStudentShell/);
  assert.match(shells, /teacherRoot/);
  assert.match(shells, /raidTeacherScreen/);
  assert.match(shells, /baseStudentRender\.call\(this\)/);
  assert.match(shells, /renderTeacherLobby/);
  assert.doesNotMatch(shells, /Runners assemble|LOCAL DEMO CLIENT/);
  assert.match(source, /visibleTeacherCards/);
  assert.doesNotMatch(source.slice(source.indexOf('const teacherMarkup'), source.indexOf('const bindTeacher')), /currentQuestion|correctAnswer|studentAnswer/i);
  [
    '.raid-student-shell','.raid-student-battle','.raid-combat-scene','.raid-question-panel',
    '.raid-teacher-shell','.raid-spotlight','.raid-card-grid','.raid-events','.raid-ranking'
  ].forEach(selector => assert.match(css, new RegExp(selector.replace('.', '\\.'))));
  assert.match(css, /V0\.9\.3C\.7 TEACHER BROADCAST REBUILD/);
  assert.match(css, /grid-template-columns:repeat\(6,minmax\(0,1fr\)\)/);
  assert.match(css, /grid-template-rows:repeat\(4,minmax\(0,1fr\)\)/);
  assert.match(css, /100dvh/);
  assert.match(css, /safe-area-inset-bottom/);
  assert.match(css, /@media\(max-width:430px\)/);
  assert.match(css, /@media\(max-width:390px\)/);
  assert.match(css, /@media\(max-width:365px\)/);
  assert.match(css, /prefers-reduced-motion:reduce/);
});

test('C.4 presentation sequences combat feedback and bounds classroom signals', () => {
  const source = fs.readFileSync(path.join(root, 'client', 'raid-presentation.js'), 'utf8');
  const shells = fs.readFileSync(path.join(root, 'client', 'raid-shell.js'), 'utf8');
  const css = fs.readFileSync(path.join(root, 'client', 'raid-premium.css'), 'utf8');
  const mode = fs.readFileSync(path.join(root, 'client', 'raid-mode.js'), 'utf8');
  [80,120,180,220,270,330,360,500].forEach(delay => assert.match(source,new RegExp(`queueEffect\\(stage,${delay}`)));
  ['is-player-attacking','is-enemy-reacting','is-player-reacting','is-wave-transition','ALL WORDS TAMED','SPECIAL ATTACK · COMBO 10'].forEach(marker => assert.match(source,new RegExp(marker)));
  ['RETRY BATTLE · GAUGE +25%','RETRY BATTLE · PASS +35%','REVIVE ${visual.reviveStreak}/2','HEAVY CHARGE ${visual.heavyProgress}/2'].forEach(marker => assert.ok(source.includes(marker),`missing ${marker}`));
  assert.match(shells,/role','status/);
  assert.match(css,/pointer-events:none/);
  assert.match(css,/raidCriticalCamera/);
  assert.match(css,/prefers-reduced-motion:reduce/);
  assert.match(mode,/minimumDisplayMs: 3500/);
  assert.match(mode,/repeatCooldownMs: 7000/);
  assert.match(source,/V093_events\.filter\(importantEvent\)/);
  assert.match(source,/ACC \$\{accuracy\(player\)\}%/);
  assert.match(source,/MAX ×\$\{Number\(player\.raid\?\.maxCombo/);
});

test('RAID public join URL follows the current or canonical room-registry origin', () => {
  const data = fs.readFileSync(path.join(root, 'client', 'data.js'), 'utf8');
  const access = fs.readFileSync(path.join(root, 'hotfix_v084_public_stable.js'), 'utf8');
  assert.doesNotMatch(data + access, /sumus-quiz-battle-public-v083\.onrender\.com/);
  assert.match(access, /SUMUS_CANONICAL_PUBLIC_ORIGIN/);
  assert.match(access, /location\.origin/);
  assert.match(access, /searchParams\.set\('mode', 'raid'\)/);
});

test('RAID asset slots are local-only and every key visual has a fallback', () => {
  const source = fs.readFileSync(path.join(root, 'client', 'raid-assets.js'), 'utf8');
  const required = [
    'raid-player-default','raid-common-spirit','raid-elite-guardian','raid-boss-forgotten-queen',
    'raid-arena-common','raid-arena-elite','raid-arena-boss','raid-fx-hit','raid-fx-critical',
    'raid-fx-shield','raid-fx-guard-break','raid-fx-heavy','raid-fx-player-hit','raid-fx-revive','raid-fx-clear'
  ];
  required.forEach(id => assert.match(source,new RegExp(id)));
  assert.doesNotMatch(source,/https?:\/\//);
  assert.match(source,/is-fallback/);
  assert.match(source,/original SVG\/CSS fallback/);
});

test('visual projection supports every combat state without mutating the source', () => {
  const source = Raid.create(68,1000);
  const states = [
    ['',{}],['critical',{}],['normal',{}],['weak',{}],['wrong',{}],['pass',{}],
    ['shield',{shield:1}],['guard',{guardState:{active:true}}],['heavy',{heavyAttackState:{active:true,progress:1}}],
    ['player-hit',{hp:72,lastEvent:'COUNTER ATTACK'}],['down',{hp:0,battleState:'DOWN'}],
    ['revive',{battleState:'REVIVE'}],['boss',{enemyType:'FINAL BOSS',waveIndex:5}],
    ['boss-clear',{enemyType:'FINAL BOSS',waveIndex:5,enemyHp:0,cleared:true,battleState:'CLEAR'}]
  ];
  states.forEach(([preview,patch]) => {
    const raid = {...source,...patch}, before = JSON.parse(JSON.stringify(raid));
    const visual = Visual.project(raid,preview);
    assert.deepEqual(raid,before);
    assert.ok(['common','elite','boss'].includes(visual.tier));
    assert.ok(visual.monster.id.startsWith('raid-'));
    assert.ok(Visual.signature(visual).length>10);
  });
  assert.equal(Visual.MAX_EFFECT_NODES,6);
});

test('68-question visual endurance switches all tiers with stable serializable projections', () => {
  let raid = Raid.create(68,1000), now=1000, projections=0;
  const tiers = new Set(), keys = Object.keys(Visual.project(raid)).sort();
  while(!raid.cleared&&projections<180){
    now+=13000;
    Raid.beginQuestion(raid,{id:`visual-${projections}`,type:'write-en'},now);
    if(projections%23===11){Raid.wrong(raid,raid.currentQuestionId,now+500);Raid.wrong(raid,raid.currentQuestionId,now+700);}
    else Raid.correct(raid,'write-en',now+Math.round(raid.attackDurationMs*.58));
    const before=JSON.parse(JSON.stringify(raid)), visual=Visual.project(raid);
    assert.deepEqual(raid,before);
    assert.deepEqual(Object.keys(visual).sort(),keys);
    assert.doesNotThrow(()=>JSON.stringify(visual));
    tiers.add(visual.tier); projections+=1;
    raid=Raid.restore(Raid.snapshot(raid));
  }
  assert.equal(raid.cleared,true);
  assert.deepEqual([...tiers].sort(),['boss','common','elite']);
  assert.ok(projections>=40&&projections<180);
});

test('timer presentation follows SAFE, ALERT, CHARGE, DANGER thresholds', () => {
  assert.equal(Visual.timerPhase(0),'safe');
  assert.equal(Visual.timerPhase(.35),'alert');
  assert.equal(Visual.timerPhase(.70),'charge');
  assert.equal(Visual.timerPhase(.90),'danger');
  assert.equal(Visual.timerPhase(1),'danger');
});

test('C.5 classroom flow exposes readiness, partial results, review, and bounded clear spotlight', () => {
  const shells=fs.readFileSync(path.join(root,'client','raid-shell.js'),'utf8');
  const results=fs.readFileSync(path.join(root,'client','raid-results.js'),'utf8');
  const mode=fs.readFileSync(path.join(root,'client','raid-mode.js'),'utf8');
  const css=fs.readFileSync(path.join(root,'client','raid-premium.css'),'utf8');
  ['CONNECTED','NOT READY','FORCE START','RANGE','RAID READY'].forEach(marker=>assert.match(shells,new RegExp(marker)));
  ['ALL WORDS TAMED','PARTIAL','TIMEOUT','ACCURACY','RETRY BATTLE WORDS','CLASS RETRY SUMMARY'].forEach(marker=>assert.match(results,new RegExp(marker)));
  assert.match(mode,/raidManualEnd=!player\.finished/);
  assert.match(mode,/targetClientId:player\.clientId/);
  assert.match(mode,/if\(current\?\.raid\?\.cleared\)/);
  assert.match(css,/\.raid-pause-overlay/);
  assert.match(css,/\.raid-teacher-results/);
  assert.doesNotMatch(results,/totalDamage|damage/i);
});
