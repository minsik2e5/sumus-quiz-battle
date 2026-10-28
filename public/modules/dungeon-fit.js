// V13.185 던전 문제 글자 수 규칙: 단어 · 뜻이 길면 글씨를 줄이고, 그래도 모자라면 줄을 바꾼다(자르기 · 가로 스크롤 없음).
// 글자 수는 '칸'으로 센다: 한글 · 한자 1칸, 영어 글자 0.5칸, 띄어쓰기 0.3칸. 실제 글씨 크기와 줄 수는 v13185.css가 정한다.
export const textUnits = text => [...String(text ?? '')].reduce((sum, ch) => sum + (ch.charCodeAt(0) > 0x2e7f ? 1 : ch === ' ' ? .3 : .5), 0);

// 문제 글(영어 단어 · 한국어 뜻): 0(원래 크기) → 4(가장 작고 여러 줄). 뜻 고르기는 영어, 나머지는 한국어 뜻이 문제다.
const PROMPT_STEPS = { mean: [5, 6.5, 8.5, 18], other: [6, 8, 9, 16] };
export function promptFit(text, kind) {
  const units = textUnits(text), steps = PROMPT_STEPS[kind === 'mean' ? 'mean' : 'other'];
  const at = steps.findIndex(max => units <= max);
  return at < 0 ? steps.length : at;
}

// 보기: 0(한 줄, 원래 크기) · 1(두 줄 안쪽, 두 칸) · 2(세 줄 넘게, 두 칸). 영어 고르기는 영어, 뜻 고르기는 한국어 뜻이 보기다.
const OPTION_ONE_LINE = { mean: { many: 5.5, few: 9.5 }, eng: { many: 4.4, few: 7.8 } };
const OPTION_TWO_LINES = { mean: 18, eng: 15 };
export function optionFit(options, kind, count = (options || []).length) {
  const longest = Math.max(0, ...(options || []).map(textUnits)), key = kind === 'eng' ? 'eng' : 'mean';
  if (longest <= OPTION_ONE_LINE[key][count >= 5 ? 'many' : 'few']) return 0;
  return longest <= OPTION_TWO_LINES[key] ? 1 : 2;
}
