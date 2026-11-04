// V13.212 렉 방지 규칙 검사(npm run check, docs/performance-rules.md). 기능이 늘어도 메인 상태 객체가 다시 밀리지 않게:
//   1. 상태의 모든 묶음(맨 위 키)은 예산표(server/perf-budget.mjs)에 있다. 새 묶음은 예산과 정리 방법을 적어야 한다.
//   2. 보기처럼 보이는 POST(…/home · …/ping · …/board 등)는 읽기 경로나 보기 경로에 등록하거나, 예외에 이유를 적는다.
//   3. 화면이 서버에 자동으로 묻는 간격은 3초 이상이다.
//   4. /api/health가 예산을 넘은 묶음을 알려 준다(state_budget).
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { emptyState } from './state.mjs';
import { STATE_BUDGET_KB, STATE_TOTAL_BUDGET_KB, stateBudgetReport, upgradeAdvice, VIEW_LIKE_POST, VIEW_LIKE_POST_EXCEPTIONS, POLL_MIN_MS } from './perf-budget.mjs';
import { READ_POSTS, VIEW_POSTS } from './mutation-coordinator.mjs';
import { prodLikeState } from './tournament-load.mjs';

const source = path => readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8');

// 화면 코드에서 setInterval(…, 숫자) 중 api(를 부르는 것의 간격.
export function pollIntervals(text) {
  const found = [];
  let at = 0;
  while ((at = text.indexOf('setInterval(', at)) >= 0) {
    let depth = 0, i = at + 'setInterval'.length;
    for (; i < text.length; i++) { const ch = text[i]; if (ch === '(') depth++; else if (ch === ')') { depth--; if (!depth) break; } }
    const call = text.slice(at, i + 1);
    const ms = Number(/,\s*(\d+)\s*\)$/.exec(call)?.[1]);
    found.push({ ms: Number.isFinite(ms) ? ms : null, api: /\bapi\(/.test(call) || /\bpoll\b/.test(call), line: text.slice(0, at).split('\n').length });
    at = i;
  }
  return found;
}

export async function runPerfRulesChecks(assert, finalKeys = []) {
  // 1. 묶음 예산.
  const keys = new Set([...Object.keys(emptyState()), ...Object.keys(prodLikeState({ students: 2, sessions: 2, words: 2 })), ...finalKeys]);
  const missing = [...keys].filter(key => STATE_BUDGET_KB[key] === undefined);
  assert(!missing.length, `V13.212 상태의 모든 묶음은 예산표(server/perf-budget.mjs)에 크기 예산이 있다: 빠진 묶음 ${missing.join(', ')}`);
  const sum = Object.values(STATE_BUDGET_KB).reduce((n, kb) => n + kb, 0);
  assert(STATE_TOTAL_BUDGET_KB <= 30000 && sum <= STATE_TOTAL_BUDGET_KB * 1.3, `V13.212 상태 전체 예산은 30MB 아래(지금 ${STATE_TOTAL_BUDGET_KB}KB, 묶음 합 ${sum}KB)`);
  const report = stateBudgetReport({ sessions: 9876.7, mastery: 2353.1, profiles: 588.8, meaningDisputes: 325.9, clawNews: 0.5 }, 13477);
  const bad = stateBudgetReport({ sessions: 17000, newThing: 10 });
  assert(report.ok && !bad.ok && bad.over[0]?.key === 'sessions' && bad.unknown[0] === 'newThing', 'V13.212 예산 보고: 2026-11-03 운영 크기는 예산 안, 넘은 묶음과 예산표에 없는 묶음을 알려 준다');
  assert(source('../cloudflare/worker.mjs').includes('state_budget: stateBudgetReport(this.sizeReport().keys_kb, Math.round((this.local.latest()?.size || 0) / 1024), this.archive.stats())'), 'V13.212 /api/health에 상태 예산(state_budget)이 나온다(V13.216 보관 크기 포함)');

  // 2. 보기처럼 보이는 POST.
  const service = source('./service.mjs');
  const posts = [...service.matchAll(/path === '(\/[a-z0-9/_-]+)' && method === 'POST'/g)].map(m => m[1]);
  const unregistered = posts.filter(path => VIEW_LIKE_POST.test(path) && !READ_POSTS.has('/api' + path) && !VIEW_POSTS.has('/api' + path) && !VIEW_LIKE_POST_EXCEPTIONS[path]);
  assert(posts.length > 50 && !unregistered.length, `V13.212 보기 같은 POST는 읽기 · 보기 경로에 등록하거나 예외에 이유를 적는다(server/perf-budget.mjs): ${unregistered.join(', ')}`);

  // 3. 자동으로 묻는 간격.
  const dir = fileURLToPath(new URL('../public/modules/', import.meta.url));
  const files = [['public/app.js', source('../public/app.js')], ...readdirSync(dir).filter(f => f.endsWith('.js')).map(f => [`public/modules/${f}`, readFileSync(dir + f, 'utf8')])];
  const fast = files.flatMap(([file, text]) => pollIntervals(text).filter(p => p.api && p.ms !== null && p.ms < POLL_MIN_MS).map(p => `${file}:${p.line} (${p.ms}ms)`));
  assert(!fast.length, `V13.212 화면이 서버에 자동으로 묻는 간격은 ${POLL_MIN_MS / 1000}초 이상: ${fast.join(', ')}`);
  assert(pollIntervals('setInterval(async () => { await api("/x"); }, 1000)')[0].ms === 1000 && pollIntervals('setInterval(async () => { await api("/x"); }, 1000)')[0].api, 'V13.212 간격 찾기 자체 시험');

  // 4. 업그레이드 · 정리 알림.
  const calm = upgradeAdvice({ writePct: 1.2, budget: report }), busy = upgradeAdvice({ writePct: 72, budget: bad });
  assert(!calm.paid_upgrade && !calm.fix_data && !calm.reasons.length && busy.paid_upgrade && busy.fix_data && busy.reasons.length === 2 && busy.reasons[0].includes('유료 업그레이드') && busy.reasons[1].includes('업그레이드로는 안 풀려요'),
    'V13.212 /api/health storage.upgrade: 오늘 저장량 70% 이상이면 유료 업그레이드, 데이터 예산 초과면 정리가 필요하다고 알려 준다(평소에는 조용)');
  assert(source('../cloudflare/worker.mjs').includes('result.storage.upgrade = upgradeAdvice({ writePct: writeStats.pct, budget: result.storage.state_budget })')
    && source('../public/modules/teacher.js').includes('일주일에 한 번 넘게 뜨면 Cloudflare 유료 업그레이드'), 'V13.212 health와 선생님 저장량 경고에 업그레이드 안내가 있다');

  // 5. 규칙 문서와 작업 메모.
  const memoNow = source('../CLAUDE.md');
  assert(memoNow.includes('렉 방지 · 업그레이드 점검(작업할 때마다 계속)') && memoNow.includes('"렉 방지 점검" 칸') && memoNow.includes('storage.upgrade'), 'V13.212 작업 메모(CLAUDE.md)에 PR마다 렉 방지 점검 · 업그레이드 알림 규칙이 있다');
  const rules = source('../docs/performance-rules.md'), memo = source('../CLAUDE.md');
  assert(rules.includes('렉 방지 규칙') && memo.includes('docs/performance-rules.md'), 'V13.212 렉 방지 규칙 문서가 있고 작업 메모(CLAUDE.md)가 가리킨다');
}
