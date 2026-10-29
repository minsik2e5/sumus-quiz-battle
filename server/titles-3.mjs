import { dayKey } from '../public/modules/core.js';
import { BLANK_BOOKS, blankKey } from '../public/modules/blank-rules.js';

// V13.184 칭호 3탄(docs/titles-plan.md)의 기록. 새로 저장하는 것은 두 가지뿐이고, 둘 다 이미 저장하는 곳에 얹는다:
//   몬스터전 m.dw = { d: 오늘 날짜, n: 오늘 이긴 판, b: 하루 최다 승 }   (몬스터전 끝 보고 monsterSettle)
//   p.gram_best = { m: 완성한 어법 지문 수, c: 1차 100점으로 끝낸 지문 수 }의 최고값   (/grammar-progress 저장)
// 나머지(몬스터전 최고 레벨, 빈칸영작 완료 칸 · 1차 정답률)는 지금 기록에서 바로 센다.

// 이긴 몬스터전 한 판. 날짜가 바뀌면 오늘 승은 0부터 다시 센다(하루 코인 상한을 넘은 판도 센다).
export function monsterDayWin(m, now = Date.now()) {
  const today = dayKey(now), dw = m.dw && m.dw.d === today ? m.dw : { d: today, n: 0, b: Number(m.dw?.b || 0) };
  dw.n = Number(dw.n || 0) + 1;
  dw.b = Math.max(Number(dw.b || 0), dw.n);
  m.dw = dw;
  return dw;
}

// 빈칸영작 p.blank.done['5-1:2'](본문 × 단계 첫 완료) · rate(칸마다 1차 정답률 최고값).
// V13.196 교과서가 두 벌(중2 YBM 본문 'y5-1' · 중3 동아 '5-1')이라 본문 수가 교과서마다 다르다.
//   blank_done · blank_perfect · blank_s5: 두 교과서를 합쳐 센다(칸이 늘어 값은 줄지 않는다).
//   blank_l5 · l6 · l7(목표 20) · blank_book(목표 60, '빈칸 없는 세상'): 교과서마다 그 범위의 완료 비율을 20 · 60칸으로 바꾼 값 중 큰 것(내림).
//   동아는 과마다 본문 4개(20칸) · 전체 60칸이라 예전 값과 똑같다 → 이미 받은 학생은 칭호를 잃지 않는다.
//   YBM은 과마다 본문 수가 달라(3 · 4 · 3개) 그 과를 다 끝내야 20, 세 과를 다 끝내야 60이 된다.
const scaled = (count, total, goal) => total ? Math.floor(count * goal / total) : 0;
export function blankTitleStats(p) {
  const b = p?.blank || {}, done = Object.keys(b.done || {}), doneSet = new Set(done);
  const cells = groups => groups.reduce((n, g) => n + [1, 2, 3, 4, 5].filter(s => doneSet.has(blankKey(g.id, s))).length, 0);
  const lesson = n => Math.max(0, ...BLANK_BOOKS.map(book => { const groups = book.lessons[n]?.groups || []; return scaled(cells(groups), groups.length * 5, 20); }));
  return {
    blank_done: done.length,
    blank_l5: lesson(5), blank_l6: lesson(6), blank_l7: lesson(7),
    blank_book: Math.max(0, ...BLANK_BOOKS.map(book => { const groups = Object.values(book.lessons).flatMap(l => l.groups); return scaled(cells(groups), groups.length * 5, 60); })),
    blank_perfect: Object.values(b.rate || {}).filter(r => Number(r) === 100).length,
    blank_s5: done.filter(key => key.endsWith(':5')).length
  };
}

// 어법 지문 기록(state.grammarProgress[학생])에서 센 지금 값.
export function gramCounts(passages = {}) {
  const list = Object.values(passages || {}).filter(x => x && x.mastered === true);
  return { m: list.length, c: list.filter(x => Number(x.first_rate) === 100).length };
}
// 지금 값과 기억한 최고값 중 큰 것: 학생이 지문 기록을 지워도 한 번 얻은 칭호는 그대로다.
export function gramTitleStats(p, passages) {
  const now = gramCounts(passages), best = p?.gram_best || {};
  return { gram_mastered: Math.max(now.m, Number(best.m || 0)), gram_clean: Math.max(now.c, Number(best.c || 0)) };
}
// /grammar-progress 저장 때 최고값을 같이 갱신한다(새 저장이 생기지 않는다).
export function rememberGramBest(p, passages) {
  const s = gramTitleStats(p, passages);
  if (s.gram_mastered || s.gram_clean) p.gram_best = { m: s.gram_mastered, c: s.gram_clean };
  return p.gram_best;
}
