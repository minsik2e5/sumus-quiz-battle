// V13.129 서버 안정화 · 던전 버그 수정 검사. 바뀐 규칙마다 하나씩:
// 저장할 때 상태를 한 번 더 복사하지 않기, 큰 요청 먼저 막기, 정리(sweep) 실패 격리, 푸시 시간 제한,
// 학생별 요청 제한, 정산된 대결 보고는 복사 없이 끝내기, 배포 확인(버전), 던전 로비 · 기절 · 봇 · 화면 고침.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createMutationCoordinator } from './mutation-coordinator.mjs';
import { emptyState } from './state.mjs';
import { sweep, battleReportPending } from './service.mjs';
import { readJson, bodyByteLimit } from '../cloudflare/worker.mjs';
import { createDungeon, join, ready, leave, disconnect, reconnect, answer, tick, DUNGEON } from './dungeon-engine.mjs';

const source = path => readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8');
const questions = Array.from({ length: 130 }, (_, i) => ({ word_id: 'w' + i, prompt: 'word' + i, meaning: '뜻' + i, wrong: [1, 2, 3, 4, 5].map(k => `오답${i}-${k}`) }));
const player = (id, extra = {}) => ({ id, name: id, grade: '고1', pet: { key: 'dog' }, questions, cleared: [], ...extra });

export async function runStabilityChecks(assert) {
  /* ---------- 저장: 상태를 한 번 더 복사하지 않는다 ---------- */
  let committed = null;
  const repo = { async read() { return { state: {}, revision: 0 }; }, async commit(state) { committed = state; } };
  const c = createMutationCoordinator(repo, { state: { n: 0 }, revision: 0 }, { flushDelay: 50, retryDelay: 1000 });
  await c.durable(state => { state.n = 1; return true; });
  assert(committed && committed === c.current().state && committed.n === 1, 'V13.129 저장소에는 지금 상태 객체를 그대로 넘긴다(저장마다 2.4MB 복사 · 20MB를 아낀다)');
  await c.durable(state => { state.n = 2; return true; });
  assert(committed.n === 2 && c.current().state.n === 2, 'V13.129 다음 변경은 새 객체라서 저장한 상태가 뒤에서 바뀌지 않는다');
  await c.close();

  /* ---------- 큰 요청은 다 읽기 전에 막는다 ---------- */
  const small = await readJson(new Request('https://x/api/a', { method: 'POST', body: JSON.stringify({ a: '가나다' }) }), 100);
  assert(small.a === '가나다', 'V13.129 보통 요청(한글 포함)은 그대로 읽는다');
  let refused = null;
  try { await readJson(new Request('https://x/api/a', { method: 'POST', body: 'x'.repeat(bodyByteLimit(100) + 1) }), 100); } catch (error) { refused = error.status; }
  assert(refused === 413, 'V13.129 바이트 한도를 넘는 본문은 끝까지 읽지 않고 413');
  let declared = null;
  try { await readJson(new Request('https://x/api/a', { method: 'POST', headers: { 'content-length': String(bodyByteLimit(100) + 1) }, body: '{}' }), 100); } catch (error) { declared = error.status; }
  assert(declared === 413, 'V13.129 Content-Length가 한도를 넘으면 읽지 않고 413');
  const worker = source('../cloudflare/worker.mjs');
  assert(worker.includes("Number(request.headers.get('content-length') || 0) > bodyByteLimit(1000000)"), 'V13.129 너무 큰 요청은 상태 객체에 보내기 전에(바깥 워커에서) 막는다');

  /* ---------- 정리(sweep)가 실패해도 요청이 막히지 않는다 ---------- */
  const state = emptyState();
  state.examAttempts.push({ id: 'broken', status: 'active', deadline: Date.now() - 1000, student_id: 'nobody', exam_id: 'e' });
  let threw = false;
  try { sweep(state); } catch { threw = true; }
  const broken = state.examAttempts[0];
  assert(!threw && broken.status === 'submitted' && broken.auto_error === true, 'V13.129 기록이 망가진 시험 응시 하나는 제출로 닫고 정리는 계속한다(예전: 모든 요청 500)');
  assert(!sweep(state), 'V13.129 닫힌 응시는 다음 정리에서 다시 손대지 않는다');
  assert(/try \{ await this\.mutations\.durable\(state => sweep\(state\)/.test(worker) && worker.includes("console.error('[sweep]'"), 'V13.129 워커: 정리가 실패해도 학생 요청은 계속 처리한다');

  /* ---------- 푸시 시간 제한 · 학생별 요청 제한 · 대결 보고 ---------- */
  assert(source('./push.mjs').includes('signal: AbortSignal.timeout(8000)'), 'V13.129 푸시 보내기는 8초에서 끊는다');
  assert(worker.includes('this.rateLimit(`user:${hashToken(token).slice(0, 16)}`, 60, 10000') && worker.includes('this.rateLimit(`boot:${hashToken(token).slice(0, 16)}`, 60, 60000'), 'V13.129 로그인한 학생마다 변경 10초 60번, 첫 화면 1분 60번까지');
  const battles = { battles: [{ id: 'a', status: 'active' }, { id: 'b', status: 'finished' }] };
  assert(battleReportPending(battles, { id: 'a' }) && !battleReportPending(battles, { id: 'b' }) && !battleReportPending(battles, { id: 'z' }), 'V13.129 정산 전 대결만 처리, 끝난 대결 · 없는 대결의 보고는 복사 없이 끝낸다');
  assert(worker.includes('if (!battleReportPending(this.mutations.current().state, body)) return json({ ok: true });'), 'V13.129 워커가 대결 보고 전에 미리 본다');

  /* ---------- 배포 ---------- */
  const deploy = source('../.github/workflows/deploy-cloudflare.yml'), ci = source('../.github/workflows/release-check.yml');
  assert(deploy.includes("h.ok === true && h.version === process.argv[1]") && deploy.includes("require('./package.json').version"), 'V13.129 배포 확인: 새 버전이 실제로 올라가 ok:true인지 본다');
  assert(!/@v4\b/.test(deploy + ci) && deploy.includes('actions/checkout@v5') && ci.includes('actions/setup-node@v5'), 'V13.129 GitHub Actions checkout · setup-node v5(Node 24 실행 환경)');

  /* ---------- 던전: 로비 시작 ---------- */
  let now = 1000;
  const lobby = () => { const s = createDungeon({ id: 'r', cut: 'c3', grade: '고1', now }); join(s, player('a'), now); return s; };
  const s1 = lobby();
  ready(s1, 'a', now);
  join(s1, player('bot-1', { bot: true }), now);
  assert(s1.phase === 'intro', 'V13.129 준비한 방장에게 봇 동료가 들어오면 바로 시작한다(예전: 준비를 다시 눌러야 했다)');
  const s2 = lobby();
  join(s2, player('b'), now); join(s2, player('c'), now);
  ready(s2, 'a', now); ready(s2, 'b', now);
  assert(s2.phase === 'lobby', '준비하지 않은 친구가 있으면 기다린다');
  leave(s2, 'c', now);
  assert(s2.phase === 'intro', 'V13.129 준비 안 한 친구가 나가고 남은 사람이 모두 준비했으면 시작한다');

  /* ---------- 던전: 로비에서 끊기면 준비가 풀린다 ---------- */
  const s3 = lobby();
  join(s3, player('b'), now);
  ready(s3, 'a', now);
  disconnect(s3, 'a', now);
  assert(!s3.players.a.ready, 'V13.129 로비에서 끊기면 준비가 풀린다');
  now += DUNGEON.DROP_MS + 5000;
  ready(s3, 'b', now);
  assert(s3.phase === 'lobby', 'V13.129 끊긴 학생과는 시작하지 않는다(예전: 시작하자마자 그 학생이 포기 처리)');
  reconnect(s3, 'a', now); ready(s3, 'a', now);
  assert(s3.phase === 'intro', '다시 연결해서 준비하면 시작한다');

  /* ---------- 던전: 부활은 연결된 친구부터 · 사람이 모두 포기하면 끝 ---------- */
  now = 1000;
  const s4 = lobby();
  join(s4, player('b'), now); join(s4, player('c'), now);
  for (const id of ['a', 'b', 'c']) ready(s4, id, now);
  now += DUNGEON.INTRO_MS; tick(s4, now);
  Object.assign(s4.players.b, { down: true, hp: 0, q: null }); Object.assign(s4.players.c, { down: true, hp: 0, q: null });
  disconnect(s4, 'b', now);
  for (let i = 0; i < 3; i++) { const q = s4.players.a.q; now = q.started_at + 500; answer(s4, 'a', q.answer, now, q.n); now += DUNGEON.REVEAL_MS; tick(s4, now); }
  assert(!s4.players.c.down && s4.players.b.down, 'V13.129 3연속 정답은 연결된 친구(C)를 먼저 살린다(끊긴 B가 아니라)');
  const s5 = lobby();
  join(s5, player('bot-1', { bot: true }), now);
  ready(s5, 'a', now);
  now += DUNGEON.INTRO_MS; tick(s5, now);
  disconnect(s5, 'a', now);
  now += DUNGEON.DROP_MS + 1; tick(s5, now);
  assert(s5.phase === 'finished' && s5.result && !s5.result.cleared, 'V13.129 사람이 모두 포기하면 봇 동료끼리 계속 싸우지 않고 실패로 끝난다');

  /* ---------- 던전 화면 ---------- */
  const ui = source('../public/modules/dungeon.js');
  assert(ui.includes("ws.onopen = () => { D.retries = 0; D.qn = null;") && ui.includes("if (D.ws?.readyState !== 1) return toast("), 'V13.129 연결이 끊긴 사이 누른 보기는 잠그지 않고, 다시 연결되면 문제를 새로 그린다');
  assert(ui.includes('data-dg="leave-room"') && ui.includes("if (D.ended || !phase) { try { await api('/dungeon/leave', {}); }") && ui.includes('D.replaced'), 'V13.129 방에 연결하지 못하면 나가기로 빠져나오고, 다른 화면이 연 방은 나가지 않는다');
}
