'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const zlib = require('node:zlib');
const { buildClient } = require('../lib/build-client');

test('production client builds, compiles, and contains audited data', () => {
  const built = buildClient(path.join(__dirname, '..'), 'test123');
  const html = zlib.gunzipSync(Buffer.from(built.encoded, 'base64')).toString('utf8');
  assert.match(html, /V0\.9\.1 RELEASE CANDIDATE/);
  assert.match(html, /sumus-quiz-battle-public-v083\.onrender\.com/);
  assert.match(html, /V090_AUTHORITATIVE_BOOKS/);
  assert.doesNotMatch(html, /(?<!\$)\$\(['"]#[^'"]+['"]\)\.forEach\s*\(/);
  assert.match(html, /const \$=\(s,r=document\)=>r\.querySelector\(s\), \$\$=\(s,r=document\)=>\[\.\.\.r\.querySelectorAll\(s\)\]/);
  assert.match(html, /V091_restoreTeacherState/);
});
