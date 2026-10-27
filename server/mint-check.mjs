// V13.178 검사: 목록 화면 민트 통일(어법 중등 · 고등 목록과 빈칸영작 목록은 같은 카드). 남색 배너 · 파랑 타일 · 칩 · 화살표를 민트로.
// 색만 바뀌고 동작 · 모양은 그대로: 클래스 이름과 student.js는 건드리지 않는다. (구성안: docs/mint-unify-design.md PR 1)
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const source = path => readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8');
export function runMintChecks(assert) {
  const css = source('../public/v13178.css'), build = source('./build-assets.mjs');
  const list = [...build.matchAll(/^\s+"([^"]+\.css)",?$/gm)].map(m => m[1]);
  assert(list.at(-1) === 'v13178.css', 'V13.178 민트 목록 스타일은 CSS 번들의 맨 끝에 있어서 앞의 파랑 · 남색 규칙을 덮는다');
  const blue = css.match(/#(?:3f6df3|3867f0|2f5ee0|5b7be0|eef3ff|17213a|24365e|2f4a7c|9fe3c7)\b/gi) || [];
  assert(!blue.length, `V13.178 목록 스타일에 파랑 · 남색 값이 없다(${blue.join(',') || '없음'})`);
  assert(/\.grammar-range-head\{background:linear-gradient\(135deg,#eaf9f2/.test(css) && css.includes('.gx-tile{background:linear-gradient(160deg,#eefaf5') && css.includes('.gx-go{background:#e8f8f1;color:#087f61}') && css.includes('.gx-chip.state{color:#087f61'),
    'V13.178 배너 · 번호 타일 · 상태 칩 · 화살표가 민트다');
  assert(css.includes('.grammar-set-card.gx-card.mastered .gx-tile{background:linear-gradient(135deg,#17c487,#0eb77c);color:#fff') && css.includes('.gx-chip.state.master{color:#fff;background:#12b886}'), 'V13.178 완료 카드는 진한 민트 면, 아직 안 푼 카드는 연한 민트로 구분된다');
  assert(!/(?:width|height|padding|margin|font-size|border-radius|display|transform)\s*:/.test(css), 'V13.178 색만 바꾼다: 크기 · 간격 · 모양 속성이 없다');
}
