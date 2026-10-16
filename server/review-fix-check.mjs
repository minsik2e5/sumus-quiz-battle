// V13.157 서버 · 버그 점검에서 나온 것 고침 검사: 짝 맞추기 빈 라운드 · 미리보기 계정 순위 · 비공개 학생 id · 낚싯대 강화 두 번.
// (변경 복사 안전성은 server/practice-speed-check.mjs)
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { matchPick } from '../public/modules/match-rules.js';
import { matchBoard, matchGhost } from './games.mjs';
import { reelRodUp } from './reel.mjs';

const source = path => readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8');
const throws = fn => { try { fn(); return null; } catch (e) { return e.status || 500; } };

export function runReviewFixChecks(assert) {
  // 남은 단어가 카드에 안 들어가는 긴 말뿐이어도 라운드마다 6쌍이 나온다(예전: 6 · 2 · 0쌍, 빈 판에서 멈춤).
  const words = [...Array(8)].map((_, i) => ({ id: 'v' + i, word: 'word' + i, meaning: '뜻' + i }))
    .concat([...Array(6)].map((_, i) => ({ id: 'L' + i, word: 'take something into consideration ' + i, meaning: '고려하다' + i })));
  const r1 = matchPick(words, { random: () => 0.001 }), r2 = matchPick(words, { skip: r1.map(x => x.id) }), r3 = matchPick(words, { skip: [...r1, ...r2].map(x => x.id) });
  assert([r1, r2, r3].every(r => r.length === 6), 'V13.157 짝 맞추기: 남은 단어가 긴 말뿐이면 전체에서 다시 골라 라운드마다 6쌍');
  const fresh = matchPick([...Array(20)].map((_, i) => ({ id: 'n' + i, word: 'w' + i, meaning: '뜻' + i })), { skip: ['n0', 'n1', 'n2', 'n3', 'n4', 'n5'] });
  assert(fresh.length === 6 && fresh.every(x => !['n0', 'n1', 'n2', 'n3', 'n4', 'n5'].includes(x.id)), 'V13.157 단어가 넉넉하면 앞 라운드 단어는 그대로 빼고 고른다');
  // 교사 미리보기 계정은 짝 맞추기 순위 · 고스트에 안 나온다. 비공개 학생 줄은 id도 숨긴다.
  const wk = 'w1', rec = ms => ({ match: { r3: { best: ms, week: { key: wk, best: ms } } } });
  const stu = { id: 's1', role: 'student', school_id: 'A', class_name: '1-1', display_name: 'S', games: rec(40000) };
  const hid = { id: 's2', role: 'student', school_id: 'A', class_name: '1-1', display_name: 'H', games: rec(30000) };
  const prev = { id: 'teacher-preview:t:A:1-1', role: 'student', preview_owner_id: 't', school_id: 'A', class_name: '1-1', display_name: '미리보기', games: rec(9500) };
  const board = matchBoard([stu, hid, prev], stu, wk, { hidden: x => x.id === 's2' });
  assert(board.rows.length === 2 && !board.rows.some(r => r.id === prev.id) && matchGhost([stu, hid, prev], stu, wk, { hidden: x => x.id === 's2' })?.name !== '미리보기', 'V13.157 교사 미리보기 계정은 짝 맞추기 순위 · 고스트에서 빠진다');
  assert(board.rows.find(r => r.name === '비공개 학생')?.id === null, 'V13.157 비공개 학생 줄은 id를 보내지 않는다');
  assert(matchBoard([stu, prev], prev, wk).rows.some(r => r.me), 'V13.157 미리보기 계정 자신에게는 자기 줄이 보인다');
  // 낚싯대 강화: 화면이 본 단계(from)와 다르면 막는다(응답을 못 받고 다시 눌러 두 단계 오르는 것).
  const p = { reel: { pearls: 800 } };
  reelRodUp(p, 1);
  assert(throws(() => reelRodUp(p, 1)) === 409 && p.reel.rod === 2 && p.reel.pearls === 600, 'V13.157 낚싯대 강화는 화면이 본 단계에서만 한 단계 오른다(다시 눌러도 두 번 쓰지 않음)');
  assert(source('../public/modules/reel.js').includes("api('/reel/rod', { from: myRod().level })") && source('./service.mjs').includes('reelRodUp(p, body.from ?? null)'), 'V13.157 강화 요청에 지금 단계를 보낸다');
}
