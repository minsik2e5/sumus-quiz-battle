'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const dataset = require('../data/v09-authoritative-books.json');
const incheonSource = require('../data/incheon-g1-sep-2025-selected.source.json');
const { readBaseHtml } = require('../lib/build-client');

const book = (id) => dataset.books.find((candidate) => candidate.id === id);
const countUnits = (source) => Object.fromEntries([...new Set(source.words.map((word) => word.unit))].map((unit) => [unit, source.words.filter((word) => word.unit === unit).length]));

test('YBM authoritative counts and sections remain exact', () => {
  const park = book('common-english2-ybm-park-2022');
  const kim = book('common-english2-ybm-kim-2022');
  assert.deepEqual(countUnits(park), { 'LESSON 1': 77, 'LESSON 2': 67 });
  assert.deepEqual(countUnits(kim), { 'LESSON 1': 68, 'LESSON 2': 112 });
  assert.equal(park.words.length, 144);
  assert.equal(kim.words.length, 180);
  assert.equal([...park.words, ...kim.words].filter((word) => word.section !== 'READING').length, 0);
  assert.equal(park.words.some((word) => word.unit === 'LESSON 1' && word.word === 'control'), false);
  assert.equal(park.words.some((word) => word.unit === 'LESSON 2' && word.word === 'warning'), false);
  assert.equal(kim.words.some((word) => word.unit === 'LESSON 1' && word.word === 'check ~ out'), false);
  assert.equal(kim.words.some((word) => word.unit === 'LESSON 2' && word.word === 'recommend'), false);
});

test('Incheon authoritative 214 rows and source fields remain exact', () => {
  const incheon = book('incheon-g1-sep-2025-selected');
  assert.ok(incheon, 'Missing incheon-g1-sep-2025-selected authoritative source');
  assert.deepEqual(countUnits(incheon), { '31번': 27, '34번': 51, '36번': 48, '38번': 22, '40번': 30, '43~45번': 36 });
  assert.equal(incheon.words.length, 214);
  const representatives = {
    '31번': ['content', '만족하는'], '34번': ['journalist', '언론인'], '36번': ['desert', '사막'],
    '38번': ['editing', '편집'], '40번': ['vision', '시각'], '43~45번': ['cafeteria', '구내식당']
  };
  for (const [unit, expected] of Object.entries(representatives)) {
    const row = incheon.words.find((word) => word.unit === unit);
    assert.deepEqual([row.word, row.meaning], expected);
  }
  const last = incheon.words.at(-1);
  assert.deepEqual({ n: last.n, sourceN: last.sourceN, unit: last.unit, word: last.word, meaning: last.meaning, sourceMarker: last.sourceMarker }, {
    n: 214, sourceN: 36, unit: '43~45번', word: 'fumble', meaning: '더듬어 찾다', sourceMarker: '*'
  });
  assert.equal(incheonSource.source.sha256, '619619DA946B015A07AB16260C3D103A9D9B8CABC10B8BC652DBD10B28465F78');
  incheon.words.forEach((row) => {
    ['word', 'meaning', 'rawWord', 'rawMeaning', 'sourceN', 'unit', 'section', 'type', 'sourceMarker'].forEach((field) => assert.ok(Object.hasOwn(row, field), `missing ${field}`));
    assert.equal(row.section, row.unit);
    assert.notEqual(row.word.trim(), '');
    assert.notEqual(row.meaning.trim(), '');
  });
});

test('all production authoritative keys are unique and meanings are non-empty', () => {
  for (const source of dataset.books) {
    const keys = source.words.map((row) => `${source.id}\0${row.unit}\0${row.word}`);
    assert.equal(new Set(keys).size, keys.length, `${source.id}: duplicate key`);
    assert.equal(source.words.filter((row) => !row.word?.trim() || !row.meaning?.trim()).length, 0);
  }
});

test('base Neungyul book remains 3,001 exact rows', () => {
  const html = readBaseHtml(path.join(__dirname, '..')).html;
  const match = html.match(/^\s*const BUILT_IN_BOOKS=(.*);$/m);
  assert.ok(match, 'BUILT_IN_BOOKS missing from production base');
  const neungyul = JSON.parse(match[1]).find((source) => source.id === 'neungyule-etymology-2025');
  assert.equal(neungyul.words.length, 3001);
  assert.equal(neungyul.words.filter((row) => !row.word?.trim() || !row.meaning?.trim()).length, 0);
  const keys = neungyul.words.map((row) => `${row.unit}\0${row.word}`);
  assert.equal(new Set(keys).size, keys.length);
});
