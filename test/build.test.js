'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const zlib = require('node:zlib');
const { HOTFIX_FILES, buildClient } = require('../lib/build-client');

test('production client builds, compiles, and contains audited data', () => {
  const built = buildClient(path.join(__dirname, '..'), 'test123');
  const html = zlib.gunzipSync(Buffer.from(built.encoded, 'base64')).toString('utf8');
  assert.match(html, /V0\.9\.1 RELEASE CANDIDATE/);
  assert.match(html, /sumus-quiz-battle-public-v083\.onrender\.com/);
  assert.match(html, /V090_AUTHORITATIVE_BOOKS/);
  assert.doesNotMatch(html, /(?<!\$)\$\(['"]#[^'"]+['"]\)\.forEach\s*\(/);
  assert.match(html, /const \$=\(s,r=document\)=>r\.querySelector\(s\), \$\$=\(s,r=document\)=>\[\.\.\.r\.querySelectorAll\(s\)\]/);
  assert.match(html, /V091_restoreTeacherState/);
  assert.match(html, /V0\.9\.2A VISUAL CLEANUP/);
  assert.match(html, /V0\.9\.2B RUN MOTION UPGRADE/);
  assert.match(html, /V0\.9\.2B\.1 PREMIUM DIRECTOR PASS/);
  assert.deepEqual(HOTFIX_FILES.slice(-3), [
    'client/visual-cleanup.js',
    'client/run-motion.js',
    'client/premium-director.js'
  ]);
  assert.ok(html.indexOf('V0.9.2A VISUAL CLEANUP') > html.indexOf('Diagnostics, fatal surface'));
  assert.ok(html.indexOf('V0.9.2B RUN MOTION UPGRADE') > html.indexOf('V0.9.2A VISUAL CLEANUP'));
  assert.ok(html.indexOf('V0.9.2B.1 PREMIUM DIRECTOR PASS') > html.indexOf('V0.9.2B RUN MOTION UPGRADE'));
});

test('V0.9.2A presentation layer does not override frozen gameplay methods', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'client', 'visual-cleanup.js'), 'utf8');
  assert.doesNotMatch(source, /RaceEngine\.(answer|frame|finish)\s*=/);
  assert.doesNotMatch(source, /(?:QuizEngine|ScoreEngine|TeacherBridge|StudentApp)\.[A-Za-z_$][\w$]*\s*=/);
  assert.match(source, /RoleParams\.get\('debug'\) === '1'/);
  const productionHideBlock = source.slice(
    source.indexOf('Production surfaces never expose QA affordances'),
    source.indexOf('body.v092a-debug .v091-buildtag')
  );
  assert.match(productionHideBlock, /#openStudentTest/);
  assert.doesNotMatch(productionHideBlock, /#(?:forceStartBattle|addDemoPlayers|clearPlayers|copyStudentUrl)|\.student-lobby-tools/);
});

test('V0.9.2B motion layer stays presentation-only', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'client', 'run-motion.js'), 'utf8');
  assert.doesNotMatch(source, /RaceEngine\.(?:answer|frame|finish|rank|setup|updateHud)\s*=/);
  assert.doesNotMatch(source, /(?:QuizEngine|ScoreEngine|TeacherBridge|StudentApp)\.[A-Za-z_$][\w$]*\s*=/);
  assert.doesNotMatch(source, /\bplayer\.(?:distance|worldDistance|score|points|combo|questionIndex|finished|finishRank)\s*=/);
  assert.doesNotMatch(source, /\bstate\.(?:players|config|arena|battleId)\s*=/);
  assert.match(source, /leaderProgress\s*>=\s*\.8/);
  assert.match(source, /window\.SUMUS_MOTION_AUDIT/);
  assert.match(source, /V0\.9\.2B RUN MOTION UPGRADE/);
});

test('V0.9.2B.1 premium director stays presentation-only', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'client', 'premium-director.js'), 'utf8');
  assert.doesNotMatch(source, /RaceEngine\.(?:answer|frame|finish|rank|setup|updateHud)\s*=/);
  assert.doesNotMatch(source, /(?:QuizEngine|ScoreEngine|TeacherBridge|StudentApp)\.[A-Za-z_$][\w$]*\s*=/);
  assert.doesNotMatch(source, /\bplayer\.(?:distance|worldDistance|score|points|combo|questionIndex|finished|finishRank)\s*=/);
  assert.doesNotMatch(source, /\bstate\.(?:players|config|arena|battleId)\s*=/);
  assert.match(source, /v092b1-stadium-depth/);
  assert.match(source, /window\.SUMUS_PREMIUM_BUILD/);
});
