'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const zlib = require('zlib');

const HOTFIX_FILES = [
  'client/preflight.js',
  'hotfix_v081_part1.js',
  'hotfix_v081_part2.js',
  'hotfix_v082_public_access.js',
  'hotfix_v083_range_select.js',
  'hotfix_v084_qrlib.js',
  'hotfix_v084_public_stable.js',
  'client/data.js',
  'client/teacher.js',
  'client/network.js',
  'client/student.js',
  'client/range.js',
  'client/assets.js',
  'client/race.js',
  'client/ui.js',
  'client/visual-cleanup.js'
];

function readBaseHtml(rootDir) {
  const bundleDir = path.join(rootDir, 'bundle');
  const parts = fs.readdirSync(bundleDir)
    .filter((name) => /^part\d+\.txt$/.test(name))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  if (parts.length !== 22) throw new Error(`Expected 22 bundle parts, found ${parts.length}`);
  const base64 = parts.map((name) => fs.readFileSync(path.join(bundleDir, name), 'utf8').trim()).join('');
  const html = zlib.brotliDecompressSync(Buffer.from(base64, 'base64')).toString('utf8');
  if (Buffer.byteLength(html) < 800000 || !html.slice(0, 100).includes('<!doctype html>')) {
    throw new Error(`Client bundle integrity check failed (${Buffer.byteLength(html)} bytes)`);
  }
  return { html, partCount: parts.length };
}

function assertClientIntegrity(html) {
  const badSingleSelector = html.match(/(?<!\$)\$\(['"]#[^'"]+['"]\)\.forEach\s*\(/);
  if (badSingleSelector) {
    throw new Error(`Build regression: a single-element $() selector is used with forEach (${badSingleSelector[0]})`);
  }
  const required = [
    'const LocalTransport=', 'const StudentApp=', 'const TeacherBridge=',
    'const QuizEngine=', 'function setBook(', 'function battleSnapshot(', 'init();'
  ];
  required.forEach((token) => {
    if (!html.includes(token)) throw new Error(`Build regression: missing client token ${token}`);
  });
  const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)]
    .map((match) => match[1]).filter((source) => source.trim());
  if (!scripts.length) throw new Error('Build regression: no inline client script found');
  scripts.forEach((source, index) => new vm.Script(source, { filename: `index.inline.${index + 1}.js` }));
}

function buildClient(rootDir, commit = 'local-build') {
  const { html: baseHtml, partCount } = readBaseHtml(rootDir);
  let html = baseHtml;
  const safeCommit = String(commit).slice(0, 7);
  const authoritative = JSON.parse(fs.readFileSync(path.join(rootDir, 'data', 'v09-authoritative-books.json'), 'utf8'));
  const dataInject = `    const V090_AUTHORITATIVE_BOOKS=${JSON.stringify(authoritative.books)};\n`;
  const commitInject = `    try{window.SUMUS_COMMIT=${JSON.stringify(safeCommit)};}catch(e){}\n`;
  const hotfix = dataInject + commitInject + HOTFIX_FILES
    .map((name) => fs.readFileSync(path.join(rootDir, name), 'utf8'))
    .join('\n');
  const marker = '    init();\n  })();';

  if (!html.includes(marker)) throw new Error('Client hotfix insertion marker not found');
  // A function replacer is mandatory: replacement-string tokens ($&, $`, $', $$)
  // occur naturally in client JavaScript and must remain byte-for-byte literal.
  html = html.replace(marker, () => `${hotfix}\n${marker}`);
  assertClientIntegrity(html);

  const gzip = zlib.gzipSync(Buffer.from(html, 'utf8'), { level: 9 });
  return { encoded: gzip.toString('base64'), byteLength: Buffer.byteLength(html), partCount, commit: safeCommit };
}

module.exports = { HOTFIX_FILES, assertClientIntegrity, buildClient, readBaseHtml };
