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

  let htmlText = zlib.brotliDecompressSync(Buffer.from(base64, 'base64')).toString('utf8');
  if (Buffer.byteLength(htmlText) < 800000 || !htmlText.slice(0, 100).includes('<!doctype html>')) {
    throw new Error(`Client bundle integrity check failed (${Buffer.byteLength(htmlText)} bytes)`);
  }

  const hotfix = ['hotfix_v081_part1.js', 'hotfix_v081_part2.js', 'hotfix_v082_public_access.js']
    .map(name => fs.readFileSync(path.join(__dirname, name), 'utf8'))
    .join('\n');
  const marker = '    init();\n  })();';
  if (!htmlText.includes(marker)) throw new Error('Client hotfix insertion marker not found');
  htmlText = htmlText.replace(marker, `${hotfix}\n${marker}`);

  const html = Buffer.from(htmlText, 'utf8');
  const gzip = zlib.gzipSync(html, { level: 9 });
  fs.writeFileSync(outputPath, gzip.toString('base64'));
  console.log(`[SUMUS] Client bundle ready: ${parts.length} parts -> ${html.length} bytes · V0.8.2 PUBLIC ACCESS`);
} catch (err) {
  console.error('[SUMUS] Failed to prepare client bundle:', err);
  process.exit(1);
}

require('./server.js');
