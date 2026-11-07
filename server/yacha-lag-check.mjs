// V13.212 야차 대회 렉 검사(npm run check). 원인(운영 /api/health 2026-11-03 대회 중, 상태 13.5MB): 메인 상태 객체는 POST
// 하나마다 상태를 깊게 복사했다(지난 연습 기록만 빼고, 숙련도 2.35MB 포함 → 운영 크기에서 POST 하나에 CPU 약 85ms). 놀이터 첫 화면
// (인형뽑기 · 사냥)과 10초 맞추기 ping까지 POST라서 누를 때마다 복사하고 저장을 기다렸다. 대회를 기다리는 학생들이 놀이터를 같이
// 하면 한 줄짜리 객체가 밀려 대회 판 시작 · 결과 · 놀이터가 모두 1초 넘게 걸렸다(server/tournament-load.mjs, check:load).
// 고친 것: ① 숙련도도 학생 묶음째 얼려 같이 쓰고 요청한 학생 묶음만 복사 ② ping은 읽기 경로 ③ 보기 POST는 프로필 사본에서 해 보고
// 그대로면 저장 없이 답 ④ Supabase 백업은 요청이 몰리면 잠깐(최대 20초) 미룬다. 규칙 · 보상 · 판정 코드는 바꾸지 않았다.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';
import { hashToken } from './auth.mjs';
import { service } from './service.mjs';
import { createMutationCoordinator, cloneState, sealState, deepFreeze, tokenOwner, tokenUser, isReadPost, isViewPost, isQuickWrite, VIEW_POSTS, NO_MUTATION } from './mutation-coordinator.mjs';
import { partitionState, entryTextCached } from '../cloudflare/state-parts.mjs';
import { createSupabaseSync, SYNC_BUSY_DEFER_MAX_MS } from '../cloudflare/local-first.mjs';
import { prodLikeState } from './tournament-load.mjs';
import { runSaveEquivalence } from './save-equivalence-check.mjs';
import { STATE_BUDGET_KB } from './perf-budget.mjs';

const source = path => readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
// 프로필 하나(keep)만 빼고 상태 전체를 안쪽까지 얼린다: 그 밖을 고치면 TypeError.
const freezeAllBut = (state, keep) => { for (const [key, value] of Object.entries(state)) if (key !== 'profiles') deepFreeze(value); for (const p of state.profiles) if (p.id !== keep) deepFreeze(p); Object.freeze(state.profiles); return state; };

export async function runYachaLagChecks(assert) {
  /* ---------- 1. 복사 범위: 지난 연습 기록 · 숙련도는 복사하지 않는다(요청한 학생 숙련도만) ---------- */
  {
    const s = sealState({ sessions: [{ id: 'a', student_id: 'p1' }], mastery: { p1: { w: { n: 1 } }, p2: { w: { n: 1 } } }, profiles: [{ id: 'p1', coins: 1 }], tokens: [{ hash: hashToken('t1'), user_id: 'p1' }] });
    const own = tokenOwner(hashToken('t1'))(s);
    const c = cloneState(s, own);
    assert(own.mastery.join() === 'p1' && tokenUser(s, hashToken('t1')) === 'p1' && tokenOwner('')(s).mastery.length === 0 && tokenUser(s, hashToken('nope')) === null,
      'V13.212 요청한 학생(로그인 세션)의 숙련도만 고칠 수 있게 복사한다(세션이 없으면 아무 학생도)');
    assert(c.sessions[0] === s.sessions[0] && c.mastery.p2 === s.mastery.p2 && Object.isFrozen(s.mastery.p2) && c.mastery.p1 !== s.mastery.p1 && !Object.isFrozen(c.mastery.p1) && c.profiles[0] !== s.profiles[0],
      'V13.212 변경 복사에 지난 연습 기록 · 다른 학생 숙련도가 들어가지 않는다(얼려서 같이 씀), 요청한 학생 숙련도와 나머지는 깊게');
  }
  /* ---------- 2. 다른 학생 숙련도를 고치는 변경도 결과가 같다(한 번만 반영) ---------- */
  {
    let saved = null;
    const repo = { async read() { return { state: {}, revision: 0 }; }, async commit(state) { saved = JSON.parse(JSON.stringify(state)); } };
    const init = { sessions: [], mastery: { p1: { w: { n: 1 } }, p2: { w: { n: 1 } } }, profiles: [{ id: 'p1', coins: 1 }, { id: 'p2', coins: 1 }] };
    const co = createMutationCoordinator(repo, { state: structuredClone(init), revision: 0 }, { flushDelay: 20, groupMs: () => 0 });
    let runs = 0;
    const out = await co.durable(state => { runs += 1; state.profiles[0].coins += 5; state.mastery.p2.w.n += 1; return 'ok'; }, { mastery: ['p1'] });
    const mine = await co.durable(state => { state.mastery.p1.w.n += 10; state.profiles[0].coins += 1; return 'mine'; }, { mastery: ['p1'] });
    const now = co.current().state;
    await co.flush();
    assert(out === 'ok' && mine === 'mine' && runs === 2 && now.profiles[0].coins === 7 && now.mastery.p2.w.n === 2 && now.mastery.p1.w.n === 11 && co.stats().mastery_retries === 1 && co.stats().frozen_retries === 0 && saved.mastery.p2.w.n === 2,
      'V13.212 다른 학생 숙련도를 고치는 변경은 숙련도까지 복사해서 처음부터 다시 하고 한 번만 반영된다(코인 두 번 안 오름), 내 숙련도는 바로');
    await co.close();
  }
  /* ---------- 3. 저장 조각: 얼린 숙련도 묶음은 글을 다시 만들지 않는다(결과 글은 예전과 같다) ---------- */
  {
    const s = sealState({ mastery: { a: { w: { n: 1 } }, b: { w: { n: 2 } } }, sessions: [] });
    const plain = partitionState(structuredClone(s));
    const one = partitionState(s), two = partitionState(s);
    assert([...plain].every(([k, v]) => one.get(k) === v) && one.size === plain.size && one.get('m:mastery:a') === two.get('m:mastery:a') && entryTextCached(s.mastery.a),
      'V13.212 얼린 숙련도 묶음은 지난번 글을 다시 쓰고, 글은 JSON.stringify와 똑같다');
  }
  /* ---------- 4. 경로: ping은 읽기, 놀이터 보기는 보기 경로, 나머지 쓰기는 그대로 ---------- */
  assert(isReadPost('POST', '/api/timing/ping') && !isReadPost('POST', '/api/timing/start') && !isReadPost('POST', '/api/timing/finish')
    && ['/api/claw/home', '/api/hunt/home', '/api/reel/guide', '/api/hunt/guide'].every(p => isViewPost('POST', p))
    && ['/api/claw/start', '/api/claw/drop', '/api/hunt/meet', '/api/hunt/throw', '/api/reel/cast', '/api/reel/land', '/api/yabawi/deal', '/api/yabawi/pick', '/api/yabawi/cash', '/api/timing/start', '/api/timing/finish'].every(p => !isViewPost('POST', p) && !isReadPost('POST', p) && !isQuickWrite('POST', p)),
    'V13.212 보기 요청(인형뽑기 · 사냥 첫 화면, 낚시 · 사냥 안내, 10초 맞추기 ping)만 쓰기 경로가 아니고, 시작 · 집게 · 던지기 · 판 받기 · 끝내기는 그대로 저장한다');
  {
    const worker = source('../cloudflare/worker.mjs');
    assert(worker.includes("request.method === 'GET' || isReadPost(request.method, url.pathname)") && worker.includes('isViewPost(request.method, url.pathname) ? await this.mutations.view(execute, tokenUser(')
      && worker.includes(": await this.mutations.durable(execute, tokenOwner(token ? hashToken(token) : ''));") && worker.includes('isBusy: () => this.busy()'),
      'V13.212 워커: ping은 읽기, 보기 POST는 view, 나머지 쓰기는 요청한 학생 숙련도만 복사, 백업은 요청이 몰리면 미룬다');
  }
  /* ---------- 5. 보기 POST는 요청한 학생 프로필 말고는 고치지 않는다(나머지를 얼려서 실제 서비스로) ---------- */
  {
    const st = prodLikeState({ students: 4, sessions: 20, words: 20 });
    const me = 'sl-1', tok = 'sl-token-' + me;
    st.profiles.find(p => p.id === me).pets = [{ key: 'dog', first: true, active: true, acquired_at: Date.now() }];
    let bad = null, ran = 0;
    for (const path of [...VIEW_POSTS].map(p => p.slice(4)).concat('/timing/ping')) {
      for (const round of [0, 1]) {
        const copy = freezeAllBut(structuredClone(st), path === '/timing/ping' ? null : me);
        try { await service(copy, 'POST', path, {}, tok); ran += 1; if (path !== '/timing/ping') st.profiles = st.profiles.map(p => p.id === me ? structuredClone(copy.profiles.find(x => x.id === me)) : p); }
        catch (e) { if (e instanceof TypeError) bad = `${path} (${round}): ${e.message}`; }
      }
    }
    assert(!bad && ran === (VIEW_POSTS.size + 1) * 2, `V13.212 보기 POST는 그 학생 프로필 말고 아무것도 고치지 않는다, ping은 아무것도 고치지 않는다 ${bad || ''}`);
    // 그대로면 저장 없이 답하고, 바뀌면(처음 연 사냥 지도) 저장 경로로 다시 해서 저장한다.
    let commits = 0;
    const repo = { async read() { return { state: {}, revision: 0 }; }, async commit() { commits += 1; } };
    const st2 = prodLikeState({ students: 4, sessions: 20, words: 20 });
    st2.profiles.find(p => p.id === me).pets = [{ key: 'dog', first: true, active: true, acquired_at: Date.now() }];
    const co = createMutationCoordinator(repo, { state: st2, revision: 0 }, { flushDelay: 20, groupMs: () => 0 });
    const run = path => s => service(s, 'POST', path, {}, tok);
    const first = await co.view(run('/hunt/home'), me, tokenOwner(hashToken(tok)));
    const c1 = commits, kept1 = co.stats().views_kept;
    const second = await co.view(run('/hunt/home'), me, tokenOwner(hashToken(tok)));
    const claw = await co.view(run('/claw/home'), me, tokenOwner(hashToken(tok)));
    assert(first?.hunt && second?.hunt && claw?.claw && c1 >= 1 && kept1 === 0 && commits === c1 && co.stats().views_kept === 2 && co.current().state.profiles.find(p => p.id === me).hunt?.map,
      `V13.212 보기 POST: 바뀌면 저장하고(사냥 지도), 그대로면 저장 없이 답한다(저장 ${commits}번, 그대로 ${co.stats().views_kept}번)`);
    const none = await co.view(() => NO_MUTATION, null, null);
    assert(none === undefined, 'V13.212 학생을 모르면 보기 POST도 예전처럼 저장 경로');
    await co.close();
  }
  /* ---------- 6. Supabase 백업은 요청이 몰리면 미루되 끝없이 미루지는 않는다 ---------- */
  {
    let busy = true, pushes = 0;
    const local = { status: () => ({ syncedVersion: 0, version: 1, partsRevision: 1, fullAt: Date.now() }), markFullBackup() {}, latest: () => ({ version: 1, parts: new Map([['k:a', '1']]) }), partHashes: () => new Map(), savePartHashes() {}, noteSyncOk() {}, markSyncedParts() {}, countRows() {} };
    const supabase = { async partsRevision() { return 1; }, async patchParts() { pushes += 1; return 2; } };
    const sync = createSupabaseSync({ local, supabase, storage: {}, isBusy: () => busy, log: { warn() {}, error() {} } });
    const deferred = await sync.run();
    sync.close();
    busy = false;
    await sync.run();
    assert(deferred === false && sync.status().deferred_busy === 1 && pushes === 1 && SYNC_BUSY_DEFER_MAX_MS <= 30000,
      'V13.212 백업은 요청을 처리하는 동안 미루고(최대 20초), 잠잠해지면 올린다');
    // V13.214 30분 넘게 실패하면 5분마다(server/supabase-backup-check.mjs), 그 전에는 V13.212 그대로.
    assert(source('../cloudflare/local-first.mjs').includes('SYNC_FAIL_SLOW_RETRY_MS : Math.min(60000, 2000 * 2 ** Math.min(failures - 1, 5)), backupErrorKind(error) === \'timeout\' ? SYNC_TIMEOUT_RETRY_MS : 0));'), 'V13.212 백업 실패 뒤 다시 하기는 2초부터 두 배씩 최대 1분(그대로)');
  }
  /* ---------- 7. 운영 크기에서 POST 하나의 복사 · 저장 비용: 숙련도를 빼서 예전보다 확실히 적다 ---------- */
  {
    const st = sealState(prodLikeState());
    const time = (fn, n = 4) => { fn(); const t = performance.now(); for (let i = 0; i < n; i++) fn(); return (performance.now() - t) / n; };
    const before = time(() => cloneState(st, null, { deep: true }));
    const after = time(() => cloneState(st, tokenOwner(hashToken('sl-token-sl-1'))(st)));
    partitionState(st);
    const partsAfter = time(() => partitionState(st));
    assert(after < before * 0.5, `V13.212 운영 크기(약 12MB) POST 하나의 상태 복사: 예전 ${before.toFixed(0)}ms → ${after.toFixed(0)}ms(절반 아래여야)`);
    assert(partsAfter < 60, `V13.212 저장 조각 만들기(얼린 기록 · 숙련도 글 재사용) ${partsAfter.toFixed(0)}ms`);
  }
  /* ---------- 8. 저장 결과가 예전과 같다(대회 중이 아닐 때도): 같은 요청 157개를 v13.210 저장 줄과 새 저장 줄로 ---------- */
  {
    const r = await runSaveEquivalence();
    assert(r.requests > 150 && r.sameAnswers && r.sameSaved && r.sameFinal && r.stats.mastery_retries >= 1 && r.stats.views_kept >= 10 && r.stats.frozen_retries === 0,
      `V13.212 출석 · 연습 · 이의 신청 · 선생님 재채점(다른 학생 숙련도) · 놀이터 · 대회 · 홈을 예전 저장 줄과 새 저장 줄로 해도 모든 답 · 저장된 상태가 똑같다 ${JSON.stringify(r.firstDiff || r.finalDiff || '')}`);
    const loose = r.finalKeys.filter(key => STATE_BUDGET_KB[key] === undefined);
    assert(!loose.length, `V13.212 여러 기능을 해 본 상태의 모든 묶음이 예산표(server/perf-budget.mjs)에 있다: ${loose.join(', ')}`);
  }
  await sleep(0);
}
