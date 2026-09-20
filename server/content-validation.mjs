import { allBooks } from './service.mjs';
import { DANWONGO_PASSAGES } from '../public/danwongo-grammar-data.js';
import { SEONBU_2025_PASSAGES, SEONBU_2026_PASSAGES } from '../public/seonbu-grammar-data.js';
import { GANGSEO_PASSAGES } from '../public/gangseo-grammar-data.js';

const fail = message => { throw new Error('[content-validation] ' + message); };
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

function validateVocabulary() {
  const books = allBooks({ extraBooks: [] });
  const words = books.flatMap(book => book.words || []);
  assert(new Set(words.map(word => word.id)).size === words.length, '단어 id 중복');
  const bySchool = school => books.filter(book => book.school === school).flatMap(book => book.words || []);

  const gangseo = bySchool('강서고');
  const gangseoExpected = { 21:31, 23:21, 29:41, 30:31, 31:32, 32:26, 33:22, 34:27, 36:32, 37:22, 38:25, 39:25, 40:19 };
  assert(gangseo.length === 354, `강서고 단어 총합 불일치 (${gangseo.length} != 354)`);
  for (const [range, count] of Object.entries(gangseoExpected)) {
    const actual = gangseo.filter(word => String(word.range_code) === range).length;
    assert(actual === count, `강서고 ${range}번 단어 수 불일치 (${actual} != ${count})`);
  }

  const seonbu = bySchool('선부고');
  const seonbuCurrent = { 41:34, 42:28, 43:24, 44:49 };
  for (const [range, count] of Object.entries(seonbuCurrent)) {
    const actual = seonbu.filter(word => String(word.range_code) === range).length;
    assert(actual === count, `선부고 외부 ${range} 단어 수 불일치 (${actual} != ${count})`);
  }
}

export function runContentValidation() {
  validateVocabulary();
  validateGrammarSet('단원고', DANWONGO_PASSAGES, ['24','29','31','32','33','34','36','39','40','41~42'], 279);
  validateGrammarSet('선부고 2026', SEONBU_2026_PASSAGES, ['20','23','24','32'], 101);
  validateGrammarSet('선부고 2025', SEONBU_2025_PASSAGES, ['31','34','36','38','40','43~45'], 161);
  validateGrammarSet('강서고', GANGSEO_PASSAGES, ['21','23','29','30','31','32','33','34','36','37','38','39','40'], 241);
  return { ok: true };
}
