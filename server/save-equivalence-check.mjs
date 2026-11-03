// V13.211 저장 방식 바꾼 뒤 결과가 같은지(대회 중이 아닐 때 포함). 같은 요청 순서를 예전 길(v13.210: POST는 모두 상태를 깊게
// 복사하고 저장까지 기다림)과 새 길(숙련도는 요청한 학생 것만 복사 · ping은 읽기 · 놀이터 보기는 프로필 사본에서 먼저)로 돌려,
// 모든 답(오류 포함)과 마지막에 저장된 상태(JSON)가 한 글자도 같은지 본다. 난수(randomBytes · randomUUID · Math.random)와
// 시계(Date.now)는 두 번 모두 같은 값이 나오게 고정한다.
// 요청: 출석 · 연습(쓰기 · 객관식, 오답, 끝내기) · 이의 신청 · 선생님 재채점(다른 학생 숙련도!) · 놀이터(인형뽑기 · 사냥 · 낚시 ·
// 10초 맞추기 · 야바위 · 가위바위보 · 행운) · 대회(만들기 · 판 열기 · 참가 · 결과) · 홈 GET.
import crypto from 'node:crypto';
import { syncBuiltinESMExports } from 'node:module';
import { hashToken } from './auth.mjs';
import { service, settleBattle, allBooks } from './service.mjs';
import * as NEW from './mutation-coordinator.mjs';
import { prodLikeState } from './tournament-load.mjs';
import { RPS_KEYS } from '../public/modules/rewards.js';
const RPS_PICK = RPS_KEYS[0];

// 고정 난수 · 시계.
let seed = 1, clock = 0;
const next = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed; };
const real = { randomBytes: crypto.randomBytes, randomUUID: crypto.randomUUID, random: Math.random, now: Date.now };
function pin(start) {
  seed = 7; clock = start;
  crypto.randomBytes = n => { const b = Buffer.alloc(n); for (let i = 0; i < n; i++) b[i] = next() & 255; return b; };
  crypto.randomUUID = () => { const h = Array.from({ length: 32 }, () => (next() & 15).toString(16)).join(''); return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`; };
  syncBuiltinESMExports();
  Math.random = () => next() / 0x80000000;
  Date.now = () => clock; // 한 요청 안에서는 같은 시각(뒤에서 도는 저장 타이머가 시계를 움직이지 않게)
}
function unpin() { Object.assign(crypto, { randomBytes: real.randomBytes, randomUUID: real.randomUUID }); syncBuiltinESMExports(); Math.random = real.random; Date.now = real.now; }

async function replay(mode, coordinatorModule, start) {
  pin(start);
  const state = prodLikeState({ students: 6, sessions: 60, words: 40, now: start });
  state.profiles.push({ id: 'eq-t', username: 'eq-t', display_name: '선생님', role: 'teacher', active: true, school_ids: ['gangseo-high'], active_school_id: 'gangseo-high', division: 'high', created_at: start });
  state.tokens.push({ hash: hashToken('sl-token-eq-t'), user_id: 'eq-t', expires_at: start + 864e6 });
  // 가입 코드는 상태를 만들 때 고정하지 않은 난수(randomInt)로 정해진다: 비교를 위해 같은 값으로.
  for (const x of state.sessions) x.reward_points = 40; // 놀이터에서 걸 코인
  (state.signupCodes || []).forEach((x, i) => { x.code = `EQ${String(i).padStart(4, '0')}`; });
  for (const p of state.profiles) if (p.role === 'student') { p.points_bonus = 5000; p.pets = [{ key: 'dog', form: 2, first: true, active: true, acquired_at: start }]; }
  let saved = null;
  const repo = { async read() { return { state: {}, revision: 0 }; }, async commit(s) { saved = JSON.stringify(s); } };
  const c = coordinatorModule.createMutationCoordinator(repo, { state, revision: 0 }, { flushDelay: 20, groupMs: () => 0, rollbackOnFailure: true, onError() {} });
  const tok = id => 'sl-token-' + id;
  const log = [];
  // 워커와 같은 갈림길.
  let step = 0;
  const call = async (who, method, path, body = {}) => {
    // 요청마다 난수 · 시계를 같은 자리에서 시작한다(새 길은 한 요청을 두세 번 해 볼 수 있다: 해 볼 때마다 같은 값).
    const base = 1000 + (++step) * 7919, at = start + step * 2000;
    const run = s => { seed = base; clock = at; return service(s, method, path, body, tok(who)); };
    const api = '/api' + path;
    let out;
    try {
      if (method === 'GET') out = await NEW.readState(c.current().state, run);
      else if (mode === 'new' && NEW.isReadPost(method, api)) out = await NEW.readState(c.current().state, run);
      else if (NEW.isQuickWrite(method, api)) out = await c.fast(run, NEW.quickOwn(api), NEW.quickSettle);
      else if (mode === 'new' && NEW.isViewPost(method, api)) out = await c.view(run, NEW.tokenUser(c.current().state, hashToken(tok(who))), NEW.tokenOwner(hashToken(tok(who))));
      else out = mode === 'new' ? await c.durable(run, NEW.tokenOwner(hashToken(tok(who)))) : await c.durable(run);
    } catch (error) { out = { error: error.message, status: error.status }; }
    log.push([who, method, path, JSON.stringify(out ?? null)]);
    return out;
  };
  const range = [...new Set(allBooks(c.current().state).filter(b => b.school_id === 'gangseo-high').flatMap(b => b.words || []).map(w => String(w.range_code)))].slice(0, 2);
  const students = ['sl-0', 'sl-1', 'sl-2', 'sl-3'];
  for (const s of students) {
    await call(s, 'GET', '/bootstrap');
    await call(s, 'POST', '/attendance/check');
    for (const path of ['/claw/home', '/claw/home', '/hunt/home', '/hunt/home', '/reel/guide', '/hunt/guide', '/timing/ping']) await call(s, 'POST', path, {});
    await call(s, 'POST', '/claw/home', { guide: true });
    await call(s, 'POST', '/reel/guide', { tutorial: true });
    const claw = await call(s, 'POST', '/claw/start', { id: `eq-claw-${s}` });
    for (let n = 0; n < 2; n++) await call(s, 'POST', '/claw/drop', { id: `eq-drop-${s}-${n}`, round: claw?.round?.id, n, x: 0.5, y: 0.5 });
    const home = await call(s, 'POST', '/hunt/home', {});
    const spot = home?.hunt?.spots?.[0];
    if (spot) { const met = await call(s, 'POST', '/hunt/meet', { spot: spot.id }); await call(s, 'POST', '/hunt/throw', { id: `eq-throw-${s}`, spot: met?.spot || spot.id, ball: 'basic' }); }
    await call(s, 'POST', '/reel/cast', { id: `eq-cast-${s}`, cast: 'good' });
    await call(s, 'POST', '/reel/land', { id: `eq-cast-${s}`, result: 'caught', finish: 'perfect' });
    const ping = await call(s, 'POST', '/timing/ping', {});
    await call(s, 'POST', '/timing/start', { id: `eq-timing-${s}`, target: 10000, echo: ping?.echo });
    await call(s, 'POST', '/timing/finish', { id: `eq-timing-${s}`, ms: 10010 });
    const deal = await call(s, 'POST', '/yabawi/deal', { bet: 10 });
    if (!deal?.error) { await call(s, 'POST', '/yabawi/pick', { slot: 1 }); await call(s, 'POST', '/yabawi/cash', {}); }
    await call(s, 'POST', '/rps/play', { bet: 10, pick: RPS_PICK });
    await call(s, 'POST', '/lucky/pull', { bet: 10 });
    // 연습(쓰기): 틀린 답 몇 개 → 끝내기 → 그 오답에 이의 신청.
    let v = await call(s, 'POST', '/practice/start', { school: '강서고', range_codes: range, mode: 'write_meaning', target: 5, run_mode: 'practice' });
    const practiceId = v?.id;
    let wrongQ = null;
    for (let i = 0; i < 5 && v && !v.finished && !v.error; i++) {
      const res = await call(s, 'POST', `/practice/${v.id}/answer`, { question_id: v.question_id, answer: i % 2 ? '틀린 뜻' : '모르는 답', prefetch_next: true });
      if (res?.feedback && !res.feedback.ok) wrongQ ||= v.question_id;
      v = res?.prefetched_next || (res && !res.error ? await call(s, 'POST', `/practice/${practiceId}/next`, {}) : null);
    }
    if (practiceId) await call(s, 'POST', `/practice/${practiceId}/finish`, {});
    if (practiceId && wrongQ) await call(s, 'POST', '/meaning-disputes', { source_type: 'practice', source_id: practiceId, question_id: wrongQ, reason: '뜻이 맞아요' });
    await call(s, 'GET', '/bootstrap');
  }
  // 선생님이 이의를 받아 준다: 다른 학생 숙련도를 고치는 변경(새 길에서는 얼린 묶음 → 다시 하기).
  for (const d of [...(c.current().state.meaningDisputes || [])].filter(x => x.status === 'pending').slice(0, 3)) await call('eq-t', 'PATCH', `/meaning-disputes/${d.id}/resolve`, { action: 'approve_once' });
  // 대회.
  const made = await call('eq-t', 'POST', '/teacher/tournaments', { class_name: '고1', student_ids: students, range_codes: range, prize: 100 });
  const t = c.current().state.tournaments?.find(x => x.id === made?.tournament?.id);
  for (const m of t?.rounds[0] || []) {
    if (!m.a || !m.b) continue;
    const host = await call(m.a, 'POST', '/tournament/play', { tournament_id: t.id, match_id: m.id });
    await call(m.b, 'POST', '/tournament/play', { tournament_id: t.id, match_id: m.id });
    if (host?.id) { try { await c.durable(s => (clock = Math.max(clock, start + (step + 1) * 2000)) && settleBattle(s, { id: host.id, winner: m.b, reason: 'end', hp: { [m.a]: 0, [m.b]: 90 }, max_hp: 250 }) ? { ok: true } : coordinatorModule.NO_MUTATION); } catch (e) { log.push(['settle', e.message]); } }
  }
  await call('eq-t', 'GET', `/teacher/tournaments/${t?.id}`);
  for (const s of students) await call(s, 'GET', '/bootstrap');
  await c.flush();
  const finalState = JSON.stringify(c.current().state);
  const stats = c.stats();
  await c.close();
  unpin();
  return { log, saved, finalState, stats };
}

// 사냥 자리 id에는 모듈 안 번호(spotSeq, server/hunt.mjs)가 들어간다: 한 번 해 보고 다시 하는 새 길에서는 번호만 하나씩 밀린다
// (id는 여전히 겹치지 않는다). 그래서 사냥 자리 id만 처음 나온 순서 번호로 바꿔 비교한다.
function normalizeSpots(...texts) {
  const map = new Map();
  return texts.map(text => String(text).replace(/\bs(?=[0-9a-z]*\d)[0-9a-z]{6,12}\b/g, id => { if (!map.has(id)) map.set(id, `spot#${map.size}`); return map.get(id); }));
}

function firstJsonDiff(a, b, path = '') {
  if (JSON.stringify(a) === JSON.stringify(b)) return null;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return { path, old: JSON.stringify(a)?.slice(0, 300), new: JSON.stringify(b)?.slice(0, 300) };
  const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])];
  if (Array.isArray(a) !== Array.isArray(b) || Object.keys(a).join() !== Object.keys(b).join()) {
    for (const k of keys) if (JSON.stringify(a[k]) !== JSON.stringify(b[k])) return firstJsonDiff(a[k], b[k], `${path}.${k}`) || { path: `${path}.${k}` };
    return { path, keysOld: Object.keys(a).join(), keysNew: Object.keys(b).join() };
  }
  for (const k of keys) { const d = firstJsonDiff(a[k], b[k], `${path}.${k}`); if (d) return d; }
  return null;
}

export async function runSaveEquivalence(oldCoordinatorModule) {
  oldCoordinatorModule ||= await import('./reference/mutation-coordinator-v13.210.mjs');
  const start = Date.UTC(2026, 10, 3, 3, 0, 0);
  let before, after;
  try {
    before = await replay('old', oldCoordinatorModule, start);
    after = await replay('new', NEW, start);
  } finally { unpin(); }
  const [oldLog, oldSaved, oldFinal] = normalizeSpots(JSON.stringify(before.log), before.saved, before.finalState);
  const [newLog, newSaved, newFinal] = normalizeSpots(JSON.stringify(after.log), after.saved, after.finalState);
  const a = JSON.parse(oldLog), b = JSON.parse(newLog);
  const diff = a.findIndex((row, i) => JSON.stringify(row) !== JSON.stringify(b[i]));
  return {
    requests: before.log.length,
    errorList: [...new Set(a.filter(row => /"error"/.test(row[3] || "")).map(row => row[2].replace(/[0-9a-f-]{36}/g, ":id") + " " + JSON.parse(row[3]).error))],
    errors: before.log.filter(row => /"error"/.test(row[3] || '')).length,
    sameAnswers: diff < 0 && a.length === b.length,
    firstDiff: diff < 0 ? null : { old: a[diff], new: b[diff] },
    sameSaved: oldSaved === newSaved,
    sameFinal: oldFinal === newFinal,
    stats: after.stats,
    finalKeys: Object.keys(JSON.parse(after.finalState)),
    finalDiff: oldFinal === newFinal ? null : firstJsonDiff(JSON.parse(oldFinal), JSON.parse(newFinal))
  };
}
