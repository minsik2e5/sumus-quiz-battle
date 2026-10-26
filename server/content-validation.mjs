import builtinBooksData from '../data/vocabulary.json' with { type: 'json' };
import { seonbu44Correction } from './seonbu44-correction.mjs';
import { gangseoSepMockBook } from './gangseo-sep-mock.mjs';
import { seonbuExternalFinalBook } from './seonbu-external-final.mjs';
import { DANWONGO_PASSAGES } from '../public/danwongo-grammar-data.js';
import { DANWONGO_TEXTBOOK_PASSAGES } from '../public/danwongo-textbook-grammar-data.js';
import { SEONBU_2025_PASSAGES, SEONBU_2026_PASSAGES } from '../public/seonbu-grammar-data.js';
import { GANGSEO_PASSAGES } from '../public/gangseo-grammar-data.js';
import { MIDDLE_YBM_PARK_PASSAGES } from '../public/middle-ybm-park-grammar-data.js';
import { BLANK_LESSONS } from '../public/middle-donga-yoon-blank-data.js';

const fail = message => { throw new Error('[content-validation] ' + message); };
const runtimeBooks = () => {
  const books = builtinBooksData.map(book => {
    const isSeonbu = book.school_id === 'seonbu-high' || book.school === '선부고';
    if (!isSeonbu || !Array.isArray(book.words)) return book;
    return { ...book, words: book.words.filter(word => String(word.range_code) !== '44') };
  });
  return [...books, seonbu44Correction, seonbuExternalFinalBook, gangseoSepMockBook];
};
const assert = (condition, message) => { if (!condition) fail(message); };

function choiceCount(passages) {
  return passages.reduce((sum, passage) => sum + passage.sentences.reduce((inner, sentence) =>
    inner + sentence.parts.filter(part => part[0] === 'c').length, 0), 0);
}

function validateGrammarSet(name, passages, expectedNumbers, expectedChoices) {
  assert(Array.isArray(passages) && passages.length === expectedNumbers.length, `${name}: 지문 수 불일치`);
  assert(passages.map(p => String(p.number)).join('|') === expectedNumbers.join('|'), `${name}: 지문 범위 불일치`);
  assert(new Set(passages.map(p => p.id)).size === passages.length, `${name}: 지문 id 중복`);
  for (const passage of passages) {
    assert(Array.isArray(passage.sentences) && passage.sentences.length > 0, `${name} ${passage.number}: 문장 없음`);
    passage.sentences.forEach((sentence, sentenceIndex) => {
      assert(typeof sentence.ko === 'string' && sentence.ko.trim(), `${name} ${passage.number} ${sentenceIndex + 1}: 해석 누락`);
      const choices = sentence.parts.filter(part => part[0] === 'c');
      assert(choices.length > 0, `${name} ${passage.number} ${sentenceIndex + 1}: 선택 포인트 없음`);
      choices.forEach((part, choiceIndex) => {
        assert(Array.isArray(part[1]) && part[1].length === 2, `${name} ${passage.number} ${sentenceIndex + 1}-${choiceIndex + 1}: 2지선다 아님`);
        assert(part[1].includes(part[2]), `${name} ${passage.number} ${sentenceIndex + 1}-${choiceIndex + 1}: 정답이 선택지에 없음`);
        assert(part[1][0] !== part[1][1], `${name} ${passage.number} ${sentenceIndex + 1}-${choiceIndex + 1}: 동일 선택지 중복`);
      });
    });
  }
  assert(choiceCount(passages) === expectedChoices, `${name}: 선택 포인트 수 불일치 (${choiceCount(passages)} != ${expectedChoices})`);
}

// 중3 동아(윤정미) 빈칸영작(Step 1 ~ 5) 데이터: 칸 번호가 영어 전문 안에 있고, Step 1 보기가 Step 1 빈칸 단어와 같고, Step 4 단어 묶음이 문장 전체와 같다.
const blankCore = word => String(word).replace(/[’‘]/g, "'").replace(/[“”]/g, '"').toLowerCase().replace(/^[^\w]+|[^\w]+$/g, '');
function validateBlankData() {
  const expected = { 5: [29, 4], 6: [28, 4], 7: [24, 4] };
  assert(Object.keys(BLANK_LESSONS).join(',') === '5,6,7', '빈칸영작: 5 · 6 · 7과');
  for (const [lesson, [count, groups]] of Object.entries(expected)) {
    const data = BLANK_LESSONS[lesson];
    assert(data.items.length === count && data.groups.length === groups, `빈칸영작 ${lesson}과: 문항 ${data.items.length} != ${count}`);
    assert(data.items.every((item, i) => item.n === i + 1), `빈칸영작 ${lesson}과: 문항 번호가 1부터 이어지지 않음`);
    assert(data.groups.every((g, i) => g.from === (i ? data.groups[i - 1].to + 1 : 1)) && data.groups.at(-1).to === count, `빈칸영작 ${lesson}과: 본문 나누기가 문항을 빠짐없이 덮지 않음`);
    for (const item of data.items) {
      const label = `빈칸영작 ${lesson}과 ${item.n}번`;
      const tokens = item.en.split(' ');
      assert(item.ko && item.en && tokens.every(Boolean), `${label}: 영어 · 해석 누락`);
      for (const step of ['s1', 's2', 's3']) {
        const list = item[step];
        assert(Array.isArray(list) && list.length > 0 && list.every((n, i) => Number.isInteger(n) && n >= 0 && n < tokens.length && (!i || n > list[i - 1])), `${label}: ${step} 빈칸 위치가 올바르지 않음`);
      }
      assert(item.s3.length >= item.s2.length, `${label}: Step 3 빈칸이 Step 2보다 적음`);
      const blanked = item.s1.map(n => blankCore(tokens[n])).sort().join('|'), options = item.o1.map(blankCore).sort().join('|');
      assert(blanked === options, `${label}: Step 1 보기가 빈칸 단어와 다름 (${options} != ${blanked})`);
      assert(item.s4.length >= 1 && item.s4.every(group => group.length > 1), `${label}: Step 4 묶음 누락`);
      const scrambled = item.s4.flatMap(group => group.flatMap(chunk => chunk.split(' '))).map(blankCore).sort().join('|');
      assert(scrambled === tokens.map(blankCore).sort().join('|'), `${label}: Step 4 단어가 영어 문장과 다름`);
    }
  }
}

function validateVocabulary() {
  const books = runtimeBooks();
  const words = books.flatMap(book => book.words || []);
  assert(new Set(words.map(word => word.id)).size === words.length, '단어 id 중복');
  const bySchool = school => books.filter(book => book.school === school).flatMap(book => book.words || []);

  const gangseo = bySchool('강서고').filter(word => !String(word.range_code).startsWith('9월 '));
  const gangseoExpected = { 21:31, 23:21, 29:41, 30:31, 31:32, 32:26, 33:22, 34:27, 36:32, 37:22, 38:25, 39:25, 40:19 };
  assert(gangseo.length === 354, `강서고 단어 총합 불일치 (${gangseo.length} != 354)`);
  for (const [range, count] of Object.entries(gangseoExpected)) {
    const actual = gangseo.filter(word => String(word.range_code) === range).length;
    assert(actual === count, `강서고 ${range}번 단어 수 불일치 (${actual} != ${count})`);
  }

  const seonbu = bySchool('선부고');
  // 44: 중간고사 외부 44(3월 32번) · 45~60: 기말고사 외부지문 16지문(3월 33 · 34 · 37 · 40번, 6월 21 · 23 · 24 · 29 · 30 · 32 · 33 · 34 · 37 · 39 · 40 · 41~42번)
  const seonbuCurrent = { 44:49, 45:28, 46:33, 47:41, 48:31, 49:21, 50:22, 51:41, 52:31, 53:26, 54:22, 55:27, 56:22, 57:25, 58:19, 59:37, 60:35 };
  for (const [range, count] of Object.entries(seonbuCurrent)) {
    const actual = seonbu.filter(word => String(word.range_code) === range).length;
    assert(actual === count, `선부고 외부 ${range} 단어 수 불일치 (${actual} != ${count})`);
  }
}

export function runContentValidation() {
  validateVocabulary();
  validateBlankData();
  validateGrammarSet('단원고', DANWONGO_PASSAGES, ['24','29','31','32','33','34','36','39','40','41~42'], 279);
  validateGrammarSet('단원고 교과서', DANWONGO_TEXTBOOK_PASSAGES, [
    '1과 · 본문 1', '1과 · 본문 2', '1과 · 본문 3', '1과 · 본문 4', '1과 · 본문 외',
    '2과 · 본문 1', '2과 · 본문 2', '2과 · 본문 3', '2과 · 본문 4', '2과 · 본문 5', '2과 · 본문 6', '2과 · 본문 외'
  ], 143);
  for (const passage of DANWONGO_TEXTBOOK_PASSAGES) {
    // Progress is saved under the passage id; the server only accepts this shape.
    assert(/^[a-z0-9~._-]{3,80}$/i.test(passage.id), `단원고 교과서 ${passage.number}: 저장할 수 없는 id`);
    for (const sentence of passage.sentences) for (const part of sentence.parts.filter(item => item[0] === 'c')) {
      assert(part[3] && part[4]?.length > 10, `단원고 교과서 ${passage.number}: 문법 유형/해설 누락`);
    }
  }
  assert(!DANWONGO_TEXTBOOK_PASSAGES.some(p => DANWONGO_PASSAGES.some(q => q.id === p.id)), '단원고 교과서/모의고사 지문 id 중복');
  validateGrammarSet('선부고 2026', SEONBU_2026_PASSAGES, ['20','23','24','32'], 101);
  validateGrammarSet('선부고 2025', SEONBU_2025_PASSAGES, ['31','34','36','38','40','43~45'], 161);
  validateGrammarSet('중2 YBM(박준언)', MIDDLE_YBM_PARK_PASSAGES, ['5과 · 본문 1','5과 · 본문 2','5과 · 본문 3','6과 · 본문 1','6과 · 본문 2','6과 · 본문 3','6과 · 본문 4','7과 · 본문 1','7과 · 본문 2','7과 · 본문 3'], 100);
  for (const passage of MIDDLE_YBM_PARK_PASSAGES) for (const sentence of passage.sentences) for (const part of sentence.parts) {
    if (part[0] === 'c') assert(typeof part[3] === 'string' && part[3] && typeof part[4] === 'string' && part[4].length > 10, `중2 YBM(박준언) ${passage.number}: 설명 누락`);
  }
  validateGrammarSet('강서고', GANGSEO_PASSAGES, ['21','23','29','30','31','32','33','34','36','37','38','39','40'], 241);
  return { ok: true };
}
