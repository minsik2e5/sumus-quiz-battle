'use strict';

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const bundleDir = path.join(__dirname, 'bundle');
const outputPath = path.join(__dirname, 'index.html.gz.b64');

try {
  const parts = fs.readdirSync(bundleDir)
    .filter(name => /^part\d+\.txt$/.test(name))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  if (parts.length !== 22) {
    throw new Error(`Expected 22 bundle parts, found ${parts.length}`);
  }

  const base64 = parts
    .map(name => fs.readFileSync(path.join(bundleDir, name), 'utf8').trim())
    .join('');

  const html = zlib.brotliDecompressSync(Buffer.from(base64, 'base64'));
  if (html.length < 800000 || !html.toString('utf8', 0, 100).includes('<!doctype html>')) {
    throw new Error(`Client bundle integrity check failed (${html.length} bytes)`);
  }

  const gzip = zlib.gzipSync(html, { level: 9 });
  fs.writeFileSync(outputPath, gzip.toString('base64'));
  console.log(`[SUMUS] Client bundle ready: ${parts.length} parts -> ${html.length} bytes`);
} catch (err) {
  console.error('[SUMUS] Failed to prepare client bundle:', err);
  process.exit(1);
}

require('./server.js');
