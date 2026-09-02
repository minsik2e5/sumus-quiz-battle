'use strict';

const fs = require('fs');
const path = require('path');

const repoRoot = path.join(__dirname, '..');
const workspaceRoot = path.join(repoRoot, '..');
const args = process.argv.slice(2);
const option = (name, fallback) => {
  const index = args.indexOf(name);
  return path.resolve(index >= 0 && args[index + 1] ? args[index + 1] : fallback);
};
const ybmSource = option('--ybm', path.join(workspaceRoot, 'SUMUS_QUIZ_BATTLE_V0.6.4_KO_REVIEW_STABLE_CANDIDATE.html'));
const incheonSource = option('--incheon', path.join(workspaceRoot, 'SUMUS_QUIZ_BATTLE_V0.6.5.1_INCHEON_VOCAB_STABLE_CANDIDATE.html'));
const incheonJsonSource = option('--incheon-json', path.join(repoRoot, 'data', 'incheon-g1-sep-2025-selected.source.json'));
const output = option('--output', path.join(repoRoot, 'data', 'v09-authoritative-books.json'));

function booksFromHtml(filePath) {
  if (!fs.existsSync(filePath)) throw new Error(`Authoritative source not found: ${filePath}`);
  const html = fs.readFileSync(filePath, 'utf8');
  const match = html.match(/^\s*const BUILT_IN_BOOKS=(.*);$/m);
  if (!match) throw new Error(`BUILT_IN_BOOKS not found in ${filePath}`);
  return JSON.parse(match[1]);
}

const ybmBooks = booksFromHtml(ybmSource);
let incheonBooks;
let incheonSourceName;
if (fs.existsSync(incheonSource)) {
  incheonBooks = booksFromHtml(incheonSource);
  incheonSourceName = path.basename(incheonSource);
} else if (fs.existsSync(incheonJsonSource)) {
  const payload = JSON.parse(fs.readFileSync(incheonJsonSource, 'utf8'));
  if (!payload?.book || payload.book.id !== 'incheon-g1-sep-2025-selected') {
    throw new Error(`Invalid Incheon PDF extraction payload: ${incheonJsonSource}`);
  }
  incheonBooks = [payload.book];
  incheonSourceName = `${path.basename(incheonJsonSource)} · ${payload.source?.sha256 || 'unhashed'}`;
} else {
  throw new Error(`Authoritative Incheon source not found: ${incheonSource} or ${incheonJsonSource}`);
}
const rules = {
  'common-english2-ybm-park-2022': { units: { 'LESSON 1': 77, 'LESSON 2': 67 }, forceSection: 'READING', sourceKind: 'ybm' },
  'common-english2-ybm-kim-2022': { units: { 'LESSON 1': 68, 'LESSON 2': 112 }, forceSection: 'READING', sourceKind: 'ybm' },
  'incheon-g1-sep-2025-selected': { units: { '31번': 27, '34번': 51, '36번': 48, '38번': 22, '40번': 30, '43~45번': 36 }, preserveSection: true, sourceKind: 'incheon' }
};

const selected = Object.entries(rules).map(([id, rule]) => {
  const sourceBooks = rule.sourceKind === 'ybm' ? ybmBooks : incheonBooks;
  const book = sourceBooks.find((candidate) => candidate.id === id);
  if (!book) throw new Error(`Missing authoritative book ${id} in ${rule.sourceKind}`);
  return { ...book, words: book.words.map((word) => ({ ...word, section: rule.forceSection || word.section })) };
});

for (const [id, rule] of Object.entries(rules)) {
  const book = selected.find((candidate) => candidate.id === id);
  const actualOrder = [...new Set(book.words.map((word) => word.unit))];
  const expectedOrder = Object.keys(rule.units);
  if (actualOrder.join('\0') !== expectedOrder.join('\0')) throw new Error(`${id} unit order mismatch: ${actualOrder.join(', ')}`);
  for (const [unit, expected] of Object.entries(rule.units)) {
    const rows = book.words.filter((word) => word.unit === unit);
    if (rows.length !== expected) throw new Error(`${id} ${unit}: expected ${expected}, got ${rows.length}`);
    rows.forEach((word, index) => {
      if (!word.word || !word.meaning) throw new Error(`${id} ${unit} #${index + 1}: empty word/meaning`);
      if (rule.forceSection && word.section !== rule.forceSection) throw new Error(`${id} ${unit}: non-${rule.forceSection} row`);
      if (rule.preserveSection && word.section !== word.unit) throw new Error(`${id} ${unit}: source section was not preserved`);
    });
  }
}

const incheon = selected.find((book) => book.id === 'incheon-g1-sep-2025-selected');
const first = (unit) => incheon.words.find((word) => word.unit === unit);
const representatives = {
  '31번': ['content', '만족하는'], '34번': ['journalist', '언론인'], '36번': ['desert', '사막'],
  '38번': ['editing', '편집'], '40번': ['vision', '시각'], '43~45번': ['cafeteria', '구내식당']
};
for (const [unit, [word, meaning]] of Object.entries(representatives)) {
  const row = first(unit);
  if (row?.word !== word || row?.meaning !== meaning) throw new Error(`${unit} representative mismatch`);
}
const last = incheon.words.at(-1);
if (incheon.words.length !== 214 || last.n !== 214 || last.sourceN !== 36 || last.unit !== '43~45번' || last.word !== 'fumble' || last.meaning !== '더듬어 찾다' || last.sourceMarker !== '*') {
  throw new Error('Incheon final-row invariant mismatch');
}
incheon.words.forEach((word, index) => {
  for (const field of ['word', 'meaning', 'rawWord', 'rawMeaning', 'sourceN', 'unit', 'section', 'type', 'sourceMarker']) {
    if (!Object.hasOwn(word, field)) throw new Error(`Incheon #${index + 1}: missing ${field}`);
  }
});

fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, `${JSON.stringify({ schemaVersion: 2, sources: [path.basename(ybmSource), incheonSourceName], books: selected }, null, 2)}\n`, 'utf8');
console.log(`Wrote ${output}: Park 144 · Kim 180 · Incheon 214`);
