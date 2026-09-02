'use strict';

const fs = require('fs');
const { buildClient } = require('./lib/build-client');

const outputPath = require('path').join(__dirname, 'index.html.gz.b64');

try {
  const commit = String(process.env.RENDER_GIT_COMMIT || process.env.SUMUS_COMMIT || 'local-build').slice(0, 7);
  const built = buildClient(__dirname, commit);
  fs.writeFileSync(outputPath, built.encoded);
  console.log(`[SUMUS] Client bundle ready: ${built.partCount} parts -> ${built.byteLength} bytes · V0.9.1 RELEASE CANDIDATE (${built.commit})`);
} catch (err) {
  console.error('[SUMUS] Failed to prepare client bundle:', err);
  process.exit(1);
}

require('./server.js');
