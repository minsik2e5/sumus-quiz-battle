'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const assetRoot = path.join(root, 'assets', 'raid');
const manifest = JSON.parse(fs.readFileSync(path.join(assetRoot, 'manifest.json'), 'utf8'));
const ids = Object.values(manifest.groups).flat();

test('V0.9.3B.1 canonical RAID asset inventory is exact and local-only', () => {
  assert.equal(manifest.canonicalAssetCount, 34);
  assert.equal(manifest.convertedWebPCount, 34);
  assert.equal(ids.length, 34);
  assert.equal(new Set(ids).size, 34);
  assert.deepEqual(manifest.pendingFallbackOnly, [
    'raid-fx-revive','raid-fx-word-tamed','raid-fx-special','raid-fx-combo-aura'
  ]);
  const director = fs.readFileSync(path.join(root, 'client', 'raid-assets.js'), 'utf8');
  assert.doesNotMatch(director, /https?:\/\//);
  assert.match(director, /WebP -> PNG -> original SVG\/CSS fallback/);
  assert.match(director, /preloadFor/);
  assert.match(director, /raid-player-main-\$\{state\}/);
  assert.match(director, /raid-common-\$\{state\}/);
  assert.match(director, /raid-elite-\$\{state\}/);
  assert.match(director, /raid-boss-\$\{state\}/);
  assert.match(director, /raid-fx-\$\{state\}/);
});

test('every canonical PNG and WebP is nonzero, transparent, and structurally decodable', () => {
  const groupById = new Map(Object.entries(manifest.groups).flatMap(([group, groupIds]) => groupIds.map(id => [id, group])));
  for (const id of ids) {
    const group = groupById.get(id);
    const png = fs.readFileSync(path.join(assetRoot, group, `${id}.png`));
    const webp = fs.readFileSync(path.join(assetRoot, group, `${id}.webp`));
    assert.ok(png.length > 1000, `${id} PNG is nonzero`);
    assert.deepEqual([...png.subarray(0,8)], [137,80,78,71,13,10,26,10], `${id} PNG signature`);
    assert.equal(png.toString('ascii',12,16), 'IHDR', `${id} PNG IHDR`);
    assert.ok([4,6].includes(png[25]), `${id} PNG has alpha color type`);
    assert.ok(png.readUInt32BE(16) > 0 && png.readUInt32BE(20) > 0, `${id} PNG dimensions`);
    assert.ok(webp.length > 1000, `${id} WebP is nonzero`);
    assert.equal(webp.toString('ascii',0,4), 'RIFF', `${id} WebP RIFF`);
    assert.equal(webp.toString('ascii',8,12), 'WEBP', `${id} WebP container`);
    assert.ok(webp.includes(Buffer.from('ALPH')) || webp.includes(Buffer.from('VP8L')), `${id} WebP preserves alpha`);
  }
});

test('source manifest and runtime manifest agree while pending candidates stay non-runtime', () => {
  const source = JSON.parse(fs.readFileSync(path.join(assetRoot, 'source-manifest.json'), 'utf8'));
  const sourcePaths = Object.keys(source.assets);
  assert.equal(sourcePaths.length, 34);
  ids.forEach(id => assert.ok(sourcePaths.some(assetPath => assetPath.endsWith(`/${id}.png`)), id));
  assert.equal(manifest.provenance.pendingReviewCopiedToRuntime, false);
  assert.equal(manifest.provenance.referenceCopiedToRuntime, false);
  assert.equal(fs.existsSync(path.join(assetRoot, '_pending_review')), false);
  assert.equal(fs.existsSync(path.join(assetRoot, '_reference')), false);
});
