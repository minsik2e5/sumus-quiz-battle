'use strict';

const MAX_BUBBLE_LENGTH = 20;

// 말풍선은 학원 학생들끼리 보는 공간이라 흔한 욕설은 하트로 가린다.
const BAD_WORDS = [
  '시발', '씨발', '씨바', '시바', 'ㅅㅂ', 'ㅆㅂ', '병신', 'ㅂㅅ', '븅신', '개새', '개색', '새끼', 'ㅅㄲ',
  '좆', 'ㅈ같', '존나', 'ㅈㄴ', '졸라', '지랄', 'ㅈㄹ', '닥쳐', '꺼져', '미친놈', '미친년', '엠창', '느금',
  'fuck', 'shit', 'bitch'
];

function cleanBubble(input) {
  let text = String(input == null ? '' : input)
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  text = Array.from(text).slice(0, MAX_BUBBLE_LENGTH).join('');
  const compact = text.replace(/\s/g, '').toLowerCase();
  for (const word of BAD_WORDS) {
    if (compact.includes(word)) {
      const pattern = new RegExp(Array.from(word).map(escapeRegExp).join('\\s*'), 'gi');
      text = text.replace(pattern, (m) => '♡'.repeat(Array.from(m.replace(/\s/g, '')).length));
    }
  }
  return text;
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function cleanName(input) {
  return Array.from(String(input == null ? '' : input).replace(/[\u0000-\u001f\u007f<>]/g, '').replace(/\s+/g, ' ').trim())
    .slice(0, 10)
    .join('');
}

module.exports = { MAX_BUBBLE_LENGTH, cleanBubble, cleanName };
