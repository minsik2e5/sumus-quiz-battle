// V13.153 본렙(학생 레벨)은 끝없이 오르고, 펫 레벨만 60에서 멈춘다(선생님 결정). 60 넘은 뒤 칭호는 docs/titles-backlog.md에 모아 뒀다가 한꺼번에 만든다.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { levelInfo, growthFor, petProgress, MAX_LEVEL, PLAYER_MAX_LEVEL } from '../public/modules/core.js';
import { TITLES } from '../public/modules/titles.js';

const source = path => readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8');

export function runLevelChecks(assert) {
  // Lv.60까지 누적 경험치(공식 그대로): 180 + 250 + … 한 레벨마다 70씩 는다.
  let to60 = 0; for (let l = 1; l < 60; l++) to60 += 180 + (l - 1) * 70;
  const at60 = levelInfo(to60, PLAYER_MAX_LEVEL), next = levelInfo(to60 + 180 + 59 * 70, PLAYER_MAX_LEVEL);
  assert(MAX_LEVEL === 60 && PLAYER_MAX_LEVEL === Infinity && at60.level === 60 && at60.remaining === 180 + 59 * 70 && next.level === 61 && next.need === 180 + 60 * 70, 'V13.153 본렙은 60 넘어서도 같은 공식으로 오른다(Lv.61은 4,380 경험치 더)');
  const big = [{ xp: 10 ** 6, total: 1, created_at: Date.now() }];
  const g = growthFor(big), pet = petProgress([{ key: 'dog', first: true }], big, 'dog')[0];
  assert(g.level > 60 && g.remaining > 0 && g.percent < 100 && pet.level === 60 && pet.remaining === 0, 'V13.153 학생 레벨(growthFor)은 60을 넘고 막대가 다시 움직이며, 펫 레벨은 60에서 멈춘다');
  assert(source('./competition.mjs').includes('PLAYER_MAX_LEVEL).level') && TITLES.level60.how === 'Lv.60 달성' && !TITLES.level60.desc.includes('더 오를 곳'), 'V13.153 칭호 · 대회의 레벨 통계도 본렙 기준, Lv.60 칭호는 "최고 레벨"이라고 하지 않는다');
  const backlog = source('../docs/titles-backlog.md');
  assert(backlog.includes('Lv.65부터 5레벨마다') && [65, 70, 75, 80, 85, 90, 95, 100].every(l => backlog.includes(`| level${l} | ${l} |`)) && backlog.includes('Drive의 기존 칭호 메달') && backlog.includes('정해진 Drive 폴더에 정확한 파일 이름'), 'V13.153 60 넘은 뒤 레벨 칭호(65부터 5단위)는 대기 목록에 저장, 만들 때 그림 주문서 규칙도 적어 둔다');
}
