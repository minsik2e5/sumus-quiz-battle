// V13.177 빈칸영작 규칙: 화면(public/blank-writing.js)과 서버 채점(server/blank.mjs)이 같이 쓴다.
// 데이터는 교과서마다 한 파일(빈칸 위치 · 보기 · 단어 묶음은 PDF 그대로):
//   중2 YBM(박준언) public/middle-ybm-park-blank-data.js (본문 id y5-1 …) · 중3 동아(윤정미) public/middle-donga-yoon-blank-data.js (5-1 …).
import * as ybm from '../middle-ybm-park-blank-data.js';
import * as donga from '../middle-donga-yoon-blank-data.js';
import { BLANK_MS_PER, BLANK_MIN_FLOOR_MS } from './rewards.js';

export const BLANK_STEPS = [1, 2, 3, 4, 5];
// V13.196 교과서 두 벌(어법 선택형처럼). 중2 학생은 YBM, 중3 학생은 동아가 먼저 열린다(화면 public/modules/student.js).
export const BLANK_BOOKS = [
  { key: 'ybm-park', grade: '중2', name: 'YBM(박준언)', eyebrow: '중2 · YBM(박준언) · 기말고사 범위', lessons: ybm.BLANK_LESSONS, items: ybm.blankGroupItems, steps: ybm.BLANK_STEP_NAMES },
  { key: 'donga-yoon', grade: '중3', name: '동아(윤정미)', eyebrow: '중3 · 동아(윤정미)', lessons: donga.BLANK_LESSONS, items: donga.blankGroupItems, steps: donga.BLANK_STEP_NAMES }
];
// 정답 비교용 낱말: 대소문자 · 앞뒤 구두점 · 따옴표 모양(’ ‘ “ ” 와 ' ")을 무시한다.
export const blankNorm = word => String(word ?? '').replace(/[’‘]/g, "'").replace(/[“”]/g, '"').toLowerCase().replace(/^[^\w]+|[^\w]+$/g, '');
export const blankWords = text => String(text ?? '').split(/\s+/).map(blankNorm).filter(Boolean);
export const blankTokens = item => item.en.split(' ');

// 본문 찾기: "5-1"(동아) · "y5-1"(YBM) → { book, lesson: '5', group, items }. 두 교과서의 본문 id는 겹치지 않는다.
export function blankGroup(id) {
  for (const book of BLANK_BOOKS) for (const [lesson, data] of Object.entries(book.lessons)) {
    const group = data.groups.find(g => g.id === id);
    if (group) return { book, lesson, group, items: book.items(lesson, group) };
  }
  return null;
}
export const blankKey = (groupId, step) => `${groupId}:${step}`;
export const blankStepOk = step => Number.isInteger(step) && step >= 1 && step <= 5;

// Step 1 ~ 3의 빈칸 위치(작은 번호부터).
export const blankSlots = (item, step) => (item[`s${step}`] || []).slice().sort((a, b) => a - b);
// Step 4의 문장들: 단어 묶음(s4)마다 한 문장이고, 영어 전문을 묶음의 낱말 수대로 앞에서부터 나눈다.
export function blankSentences(item) {
  const tokens = blankTokens(item);
  let at = 0;
  return item.s4.map(group => {
    const size = group.reduce((n, chunk) => n + chunk.split(' ').length, 0);
    const text = tokens.slice(at, at + size).join(' ');
    at += size;
    return text;
  });
}
// 한 문항의 정답(단계별 모양): 1 ~ 3 낱말 배열 / 4 문장 배열 / 5 전문.
export function blankAnswer(item, step) {
  if (step <= 3) { const tokens = blankTokens(item); return blankSlots(item, step).map(i => tokens[i]); }
  if (step === 4) return blankSentences(item);
  return item.en;
}
// 채점. given: 1 ~ 3 낱말 배열 / 4 문장 배열(문장마다 고른 묶음을 이은 글) / 5 쓴 전문.
// 돌려줄 때 `wrong`은 틀린 칸 번호(Step 1 ~ 4) — Step 5는 전체가 하나다.
export function gradeBlankItem(item, step, given) {
  if (step === 5) {
    const ok = typeof given === 'string' && blankWords(given).join(' ') === blankWords(item.en).join(' ');
    return { ok, wrong: ok ? [] : [0] };
  }
  const want = blankAnswer(item, step), list = Array.isArray(given) ? given : [];
  const wrong = [];
  want.forEach((answer, i) => {
    const mine = typeof list[i] === 'string' ? list[i] : '';
    const same = step === 4 ? blankWords(mine).join(' ') === blankWords(answer).join(' ') : blankNorm(mine) === blankNorm(answer);
    if (!same || (step !== 4 && !blankNorm(mine))) wrong.push(i);
  });
  if (list.length !== want.length) return { ok: false, wrong: wrong.length ? wrong : [0] };
  return { ok: !wrong.length, wrong };
}
// 낱말 수(최소 시간 계산): Step 1 ~ 3 빈칸 수 · Step 4 단어 묶음 수 · Step 5 영어 낱말 수.
export const blankUnits = (item, step) => step <= 3 ? blankSlots(item, step).length : step === 4 ? item.s4.reduce((n, g) => n + g.length, 0) : blankTokens(item).length;
export const blankMinMs = (items, step) => Math.max(BLANK_MIN_FLOOR_MS, items.reduce((n, item) => n + blankUnits(item, step), 0) * BLANK_MS_PER[step]);
// 단계 전체를 채점한다. answers: { [문항 번호]: 정답 모양 }.
export function gradeBlankStep(items, step, answers) {
  const wrong = [];
  for (const item of items) if (!gradeBlankItem(item, step, answers?.[item.n]).ok) wrong.push(item.n);
  return { ok: !wrong.length, wrong };
}

// Step 5에서 어디가 다른지 보여 주는 낱말 비교(가장 긴 공통 부분): 정답 낱말마다 맞음 / 빠짐, 쓴 낱말마다 맞음 / 틀림.
export function blankDiff(expected, typed) {
  const a = String(expected).split(/\s+/).filter(Boolean), b = String(typed ?? '').split(/\s+/).filter(Boolean);
  const na = a.map(blankNorm), nb = b.map(blankNorm);
  const dp = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) for (let j = b.length - 1; j >= 0; j--) dp[i][j] = na[i] === nb[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const want = a.map(word => ({ word, ok: false })), mine = b.map(word => ({ word, ok: false }));
  let i = 0, j = 0;
  while (i < a.length && j < b.length) {
    if (na[i] === nb[j]) { want[i].ok = mine[j].ok = true; i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) i++;
    else j++;
  }
  return { want, mine };
}
