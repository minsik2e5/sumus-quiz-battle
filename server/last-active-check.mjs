// V13.213.1 검사: 선생님 대시보드 '오늘 안 함' · 'N일 전'이 야차전 · 놀이터 · 출석 · 펫 돌보기도 활동으로 센다.
// 증상(2026-11-04): 오늘 야차전 · 놀이터만 한 학생이 '오늘 안 함'에 '1일 전'으로 나왔다(단어 연습 · 시험 · 문법만 봤다).
import { readFileSync } from 'node:fs';
import { lastActiveAt } from './activity.mjs';

const source = path => readFileSync(new URL(path, import.meta.url), 'utf8');

export async function runLastActiveChecks(assert) {
  const now = Date.parse('2026-11-04T16:00:00+09:00'), y = now - 86400000;
  assert(lastActiveAt({}) === null && lastActiveAt({ activity: [{ at: y, k: 'practice' }, { at: now - 60000, k: 'yacha' }] }) === now - 60000
    && lastActiveAt({ activity: [{ at: y }], attendance: { log: [{ at: now - 3600000 }] } }) === now - 3600000
    && lastActiveAt({ activity: [{ at: y }], care: { last_at: now - 5000 } }) === now - 5000,
    'V13.213.1 마지막 활동 = 활동 기록(야차전 · 놀이터 등) · 출석 · 펫 돌보기 중 가장 늦은 때');
  const service = source('./service.mjs'), teacher = source('../public/modules/teacher.js');
  assert(service.includes('active_at: lastActiveAt(s)') && service.includes('times.push(Number(lastActiveAt(x) || 0));'),
    'V13.213.1 선생님 홈의 학생마다 active_at을 싣고, 이번 주 미접속(idle_students)도 같은 활동을 센다');
  assert(teacher.includes("(d.profiles || []).forEach(p => { if (p.active_at && dayKey(p.active_at) === key) ids.add(p.id); });") && teacher.includes('for (const p of d.profiles || []) put(p.id, p.active_at);'),
    'V13.213.1 대시보드 오늘 한 학생 · N일 전 계산에 active_at을 쓴다');
}
