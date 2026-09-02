'use strict';

const fs = require('fs');
const path = require('path');
const { buildClient } = require('../lib/build-client');

const root = path.join(__dirname, '..');
const output = path.join(root, 'index.html.gz.b64');
const commit = process.env.RENDER_GIT_COMMIT || process.env.SUMUS_COMMIT || 'local-build';
const built = buildClient(root, commit);
fs.writeFileSync(output, built.encoded);
console.log(`[SUMUS] Build verified: ${built.byteLength} bytes · ${built.commit}`);
