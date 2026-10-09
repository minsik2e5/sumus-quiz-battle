// Release checks for V13.120 던전 엔진 (server/dungeon-engine.mjs, docs/dungeon-design.md 2~8번):
// 입장 조건, 등급컷 열림, 문제 풀 보충, 보기 수, 피해 계산, 파티 게이지, 기절·부활, 끊김·포기,
// 휴식과 기록 시계, 보스 3페이즈, 만점 모드, 결과 보고 키, 시뮬레이션 클리어율.
import { createDungeon, join, ready, leave, disconnect, reconnect, answer, tick, nextWake, view, openCuts, partyCuts, dungeonPool, hitDamage, floorSpec, gradeExtraMs, reportId, DUNGEON, CUTS, FLOORS, MONSTERS, TRAITS, BOSS } from './dungeon-engine.mjs';
import { clearRate, run, student, seeded } from './dungeon-sim.mjs';
import { elementOf } from '../public/modules/battle-fx.js';

const WORDS = Array.from({ length: 130 }, (_, i) => ({ word_id: 'w' + i, prompt: 'word' + i, meaning: '뜻' + i, wrong: [1, 2, 3, 4, 5].map(k => '뜻' + ((i + k * 11) % 130)) }));
const member = (id, extra = {}) => ({ id, name: id, grade: '중2', pet: { key: 'dog' }, questions: WORDS, cleared: [], ...extra });
const throws = fn => { try { fn(); return false; } catch { return true; } };
// 3명(또는 n명)이 준비를 마치고 1층이 열린 방. `pets`로 속성을 고른다.
function party({ n = 3, cut = 'c3', pets = ['dog', 'cat', 'owl'], now = 0, seed = 5 } = {}) {
  const s = createDungeon({ id: 'd1', cut, grade: '중2', seed, now });
  for (let i = 0; i < n; i++) join(s, member('p' + i, { pet: { key: pets[i] }, cleared: ['c3', 'c2', 'c1'] }), now);
  for (let i = 0; i < n; i++) ready(s, 'p' + i, now);
  tick(s, now + DUNGEON.INTRO_MS);
  return s;
}
const q = (s, pid) => s.players[pid].q;
const right = (s, pid, at) => answer(s, pid, q(s, pid).answer, at, q(s, pid).n);
const wrongChoice = (s, pid) => q(s, pid).options.findIndex((_, i) => i !== q(s, pid).answer && i !== q(s, pid).covered);
const wrong = (s, pid, at) => answer(s, pid, wrongChoice(s, pid), at, q(s, pid).n);
// 모두가 다음 문제를 받을 때까지 시계를 돌린다.
const settle = (s, t) => { tick(s, t + DUNGEON.REVEAL_MS); return t + DUNGEON.REVEAL_MS; };
// 몬스터를 정답으로 잡는다(p0이 계속 맞힌다).
function killFloor(s, t) {
  const floor = s.floor;
  for (let i = 0; i < 400 && s.floor === floor && s.phase === 'fight'; i++) { if (!q(s, 'p0')) t = settle(s, t); else { right(s, 'p0', t + 100); t += 100; } }
  return t;
}

export function runDungeonChecks(assert) {
  /* ---------- 등급컷 · 입장 ---------- */
  assert(openCuts([]).join() === 'c3' && openCuts(['c3']).join() === 'c3,c2' && openCuts(['c3', 'c2']).join() === 'c3,c2,c1' && openCuts(['c3', 'c2', 'c1']).join() === 'c3,c2,c1,max' && openCuts(['c2']).join() === 'c3', 'V13.120 던전 등급컷은 3등급 컷 → 2등급 컷 → 1등급 컷 → 만점 순으로, 앞 단계를 깨야 열린다');
  assert(partyCuts([{ cleared: ['c3', 'c2'] }, { cleared: ['c3'] }]).join() === 'c3,c2' && partyCuts([{ cleared: [] }, { cleared: ['c3', 'c2', 'c1'] }]).join() === 'c3', 'V13.120 방은 파티원 모두에게 열린 단계까지만 고른다');
  {
    const s = createDungeon({ id: 'd', cut: 'c3', grade: '중2', now: 0 });
    join(s, member('a'), 0);
    assert(throws(() => join(s, member('b', { grade: '중3' }), 0)) && throws(() => join(s, member('c', { questions: WORDS.slice(0, 119) }), 0)) && !throws(() => join(s, member('d', { questions: WORDS.slice(0, 120) }), 0)), 'V13.120 던전은 같은 학년만, 문제 풀 120단어 이상이어야 들어온다(학교는 달라도 된다)');
    join(s, member('e', { bot: true }), 0);
    assert(throws(() => join(s, member('f'), 0)) && s.order.length === 3 && s.host === 'a', 'V13.120 파티는 3명까지(빈자리는 봇 동료), 처음 들어온 학생이 방장이다');
    const locked = createDungeon({ id: 'd', cut: 'c2', grade: '중2', now: 0 });
    assert(throws(() => join(locked, member('a'), 0)) && !throws(() => join(locked, member('b', { cleared: ['c3'] }), 0)) && !throws(() => join(locked, member('c', { bot: true }), 0)), 'V13.120 아직 열리지 않은 등급컷 방에는 들어오지 못한다(봇 동료는 된다)');
    const solo = createDungeon({ id: 'd', grade: '중2', now: 0 });
    join(solo, member('a'), 0); ready(solo, 'a', 0);
    assert(solo.phase === 'lobby', 'V13.120 혼자서는 시작하지 않는다(2~3명)');
    join(solo, member('b'), 0); leave(solo, 'a', 0);
    assert(solo.order.join() === 'b' && solo.host === 'b', 'V13.120 로비에서 방장이 나가면 다음 학생이 방장이 된다');
  }
  {
    const own = WORDS.slice(0, 50), earlier = WORDS.slice(40, 100), extra = WORDS.slice(90, 130), wrongs = WORDS.slice(0, 5);
    const r = dungeonPool({ own, earlier, extra, wrong: wrongs });
    const src = r.pool.map(w => w.source);
    assert(r.ok && r.pool.length === 120 && src.slice(0, 50).every(x => x === 'own') && src.slice(50, 100).every(x => x === 'earlier') && src.slice(100).every(x => x === 'extra') && new Set(r.pool.map(w => w.word_id)).size === 120, 'V13.120 문제 풀 보충: 내 범위 그대로 + ① 이미 푼 앞쪽 범위 ② 추가 단어장 순으로 120단어까지(중복 없이)');
    const small = dungeonPool({ own: WORDS.slice(0, 100), wrong: wrongs.concat(wrongs, wrongs, wrongs, wrongs) });
    assert(small.ok && small.pool.slice(100).every(w => w.source === 'wrong') && dungeonPool({ own: WORDS.slice(0, 30) }).short === 90, 'V13.120 그래도 모자라면 ③ 틀린 단어 반복으로 채우고, 모자란 수를 알려 준다');
    assert(dungeonPool({ own: WORDS }).pool.length === 130, 'V13.120 학생이 정한 범위는 줄이지 않는다');
  }

  /* ---------- 시작 · 보기 · 시계 ---------- */
  {
    const s = createDungeon({ id: 'd1', cut: 'c3', grade: '중2', seed: 5, now: 0 });
    for (const id of ['p0', 'p1', 'p2']) join(s, member(id), 0);
    ready(s, 'p0', 0); ready(s, 'p1', 0);
    assert(s.phase === 'lobby', 'V13.120 모두 준비해야 시작한다');
    ready(s, 'p2', 0);
    assert(s.phase === 'intro' && nextWake(s) === DUNGEON.INTRO_MS && s.started_at === null, 'V13.120 모두 준비하면 입장 연출(문 열림)부터, 기록 시계는 아직 멈춰 있다');
    tick(s, DUNGEON.INTRO_MS);
    assert(s.phase === 'fight' && s.floor === 1 && s.started_at === DUNGEON.INTRO_MS && ['p0', 'p1', 'p2'].every(id => q(s, id)?.options.length === 4), 'V13.120 1층이 열리면 기록 시계가 돌고 파티원마다 자기 문제가 나온다');
    const v = view(s, 'p0');
    assert(v.question && !('answer' in v.question) && v.players.length === 3 && !JSON.stringify(v).includes('"answer"') && v.monster.hp === v.monster.max_hp, 'V13.120 화면에는 내 문제만 가고 정답 번호는 보내지 않는다');
    assert(FLOORS.map(f => f.options).join() === '4,4,5,5,6,6' && FLOORS.at(-1).boss && FLOORS.length === 6, 'V13.120 보기 수: 1~2층 4개, 3~4층 5개, 5층·보스 6개');
    assert(['c3', 'c2', 'c1'].every(cut => FLOORS.every((f, i) => i === 0 || f.limit[cut] < FLOORS[i - 1].limit[cut])) && FLOORS.every(f => f.limit.c3 > f.limit.c2 && f.limit.c2 > f.limit.c1) && floorSpec('c3', 1).limit === 9000 && floorSpec('c1', 6).limit === 4000, 'V13.120 제한 시간은 층이 오를수록, 등급컷이 오를수록 짧다(3등급 컷 1층 9초 … 1등급 컷 보스 4초)');
    assert(gradeExtraMs('중1') > gradeExtraMs('중3') && gradeExtraMs('중3') > gradeExtraMs('고3') && gradeExtraMs('고3') === 0 && gradeExtraMs('모름') === 0 && q(s, 'p0').deadline - q(s, 'p0').started_at === 9000 + gradeExtraMs('중2'), 'V13.120 제한 시간은 학년에 따라 조금 더 준다(파티가 같은 학년이라 파티 안에서는 같다)');
    const n0 = q(s, 'p0').n, t = DUNGEON.INTRO_MS;
    assert(answer(s, 'p0', q(s, 'p0').answer, t + 500, n0 + 1).length === 0 && q(s, 'p0').n === n0, 'V13.120 다른 문제 번호로 온 답(늦게 온 답)은 버린다');
    const hp0 = s.players.p1.hp, deadline = q(s, 'p1').deadline;
    tick(s, deadline);
    assert(s.players.p1.hp < hp0 && s.players.p1.timeouts === 1 && !q(s, 'p1') && s.players.p1.next_at === deadline + DUNGEON.REVEAL_MS, 'V13.120 시간 초과는 오답처럼 몬스터에게 맞고, 잠깐 뒤 다음 문제가 나온다');
  }

  /* ---------- 피해 ---------- */
  assert(hitDamage({}) === DUNGEON.HIT && hitDamage({ leftShare: 1 }) === 15 && hitDamage({ combo: 4 }) === 10 && hitDamage({ combo: 5 }) === 11 && hitDamage({ combo: 10 }) === 12 && hitDamage({ combo: 100 }) === 15 && hitDamage({ element: 1.3 }) === 13 && hitDamage({ leftShare: 1, combo: 25, element: 1.3 }) === Math.round(10 * 1.5 * 1.5 * 1.3), 'V13.120 정답 피해 = 기본 10 × 속도(최대 ×1.5) × 콤보(5연속마다 +10%, 최대 ×1.5) × 속성 보너스');
  {
    const mixed = party({ pets: ['dragon', 'penguin', 'panda'] }), same = party({ pets: ['dragon', 'fox', 'cat'] }), duo = party({ n: 2, pets: ['dragon', 'penguin'] });
    assert(new Set(['dragon', 'penguin', 'panda'].map(elementOf)).size === 3 && mixed.element_bonus === 1.3 && same.element_bonus === 1 && duo.element_bonus === 1, 'V13.120 서로 다른 속성(battle-fx.js) 펫 3마리면 피해 +30%');
    const s = party(), t = DUNGEON.INTRO_MS, hp = s.monster.hp;
    right(s, 'p0', t);
    assert(s.monster.hp === hp - 15 && s.players.p0.combo === 1 && s.players.p0.damage === 15 && s.gauge === 1, 'V13.120 바로 맞히면 몬스터 체력이 줄고, 콤보와 파티 게이지가 오른다');
    const php = s.players.p1.hp;
    wrong(s, 'p1', t + 2000);
    assert(s.players.p1.hp === php - (CUTS.c3.hit + FLOORS[0].hitAdd) && s.players.p1.combo === 0 && s.players.p1.retry.length === 1 && s.players.p1.retry[0].due === s.players.p1.served + DUNGEON.RETRY_GAP, 'V13.120 오답이면 몬스터가 그 학생을 때리고 콤보가 끊기며, 틀린 단어는 8문제 뒤에 다시 나온다');
    const missed = s.players.p1.retry[0].q.word_id;
    let t2 = t + 2000;
    for (let i = 0; i < DUNGEON.RETRY_GAP; i++) { t2 = settle(s, t2); right(s, 'p1', t2 + 50); t2 += 50; }
    t2 = settle(s, t2);
    assert(q(s, 'p1').word_id === missed, 'V13.120 틀린 단어는 같은 판 뒤쪽에서 다시 나온다');
  }
  {
    const s = party(); let t = DUNGEON.INTRO_MS;
    assert(s.gauge_max === 18, 'V13.120 파티 게이지는 파티원 수 × 6 정답');
    let special = null;
    for (let i = 0; i < 18; i++) { const pid = 'p' + (i % 3); if (!q(s, pid)) t = settle(s, t); const ev = right(s, pid, t + 10); t += 10; special ||= ev.find(e => e.type === 'special'); }
    assert(special && special.damage === DUNGEON.SPECIAL_HITS * DUNGEON.HIT * 3 && s.gauge === 0, 'V13.120 게이지가 가득 차면 합동 필살기(파티원 수 × 3 정답만큼)가 나가고 게이지가 비워진다');
  }

  /* ---------- 기절 · 부활 · 실패 ---------- */
  {
    const s = party(); let t = DUNGEON.INTRO_MS;
    s.players.p2.hp = 5;
    wrong(s, 'p2', t + 100);
    assert(s.players.p2.down && !q(s, 'p2') && s.players.p2.downs === 1 && s.phase === 'fight', 'V13.120 체력이 0이 되면 기절해서 관전한다');
    right(s, 'p0', t + 200); t = settle(s, t + 200); right(s, 'p0', t + 10); t = settle(s, t + 10);
    assert(s.players.p2.down && s.players.p0.rescue === 2, 'V13.120 부활은 동료가 연속으로 맞혀야 한다');
    const ev = right(s, 'p0', t + 10);
    assert(!s.players.p2.down && s.players.p2.hp === 40 && ev.some(e => e.type === 'revive' && e.pid === 'p2' && e.by === 'p0') && q(s, 'p2'), 'V13.120 동료가 3연속 정답이면 체력 40%로 부활한다');
    s.players.p1.hp = 1; s.players.p1.down = true; s.players.p2.hp = 1;
    t += 10; t = settle(s, t);
    wrong(s, 'p2', t + 10);
    s.monster.hp = 1; right(s, 'p0', t + 20); t += 20;
    assert(s.phase === 'rest' && s.floor === 1 && ['p1', 'p2'].every(id => !s.players[id].down && s.players[id].hp === 30) && nextWake(s) === s.rest_until, 'V13.120 층을 깨면 6초 휴식, 기절한 친구는 체력 30%로 부활한다');
    const restEnd = s.rest_until;
    assert(restEnd - t <= DUNGEON.REST_MS && DUNGEON.REST_MS === 6000, 'V13.120 휴식은 6초로 고정');
    tick(s, restEnd);
    assert(s.phase === 'fight' && s.floor === 2 && q(s, 'p1') && s.monster.key !== s.used_monsters[0], 'V13.120 휴식이 끝나면 다음 층(다른 몬스터)');
    for (const id of ['p0', 'p1', 'p2']) s.players[id].hp = 1;
    t = restEnd;
    for (const id of ['p0', 'p1', 'p2']) wrong(s, id, t + 10);
    assert(s.phase === 'finished' && s.result.cleared === false && s.result.reached === 1 && s.result.floor === 2 && nextWake(s) === null && s.result.record === false, 'V13.120 전원 기절이면 실패, 도달한 층(깬 층)을 남긴다');
  }

  /* ---------- 끊김 ---------- */
  {
    const s = party(); const t = DUNGEON.INTRO_MS;
    disconnect(s, 'p2', t);
    assert(!q(s, 'p2') && nextWake(s) <= t + DUNGEON.AUTO_MS, 'V13.120 끊긴 학생의 문제는 멈추고(맞지 않는다)');
    const hp = s.monster.hp;
    s.players.p0.q.deadline = s.players.p1.q.deadline = t + 999999;
    tick(s, t + DUNGEON.AUTO_MS);
    assert(s.monster.hp === hp - DUNGEON.HIT * DUNGEON.AUTO_HIT && s.players.p2.damage === 5, 'V13.120 끊겨도 펫이 4초마다 자동 공격하며 기다린다');
    reconnect(s, 'p2', t + 5000);
    assert(s.players.p2.connected && q(s, 'p2'), 'V13.120 다시 들어오면 바로 문제가 나온다');
    disconnect(s, 'p2', t + 6000);
    tick(s, t + 6000 + DUNGEON.DROP_MS - 1);
    assert(!s.players.p2.out, 'V13.120 90초 전에는 기다린다');
    tick(s, t + 6000 + DUNGEON.DROP_MS);
    assert(s.players.p2.out && s.phase === 'fight' && reconnect(s, 'p2', t + 6000 + DUNGEON.DROP_MS + 1).length === 0, 'V13.120 90초가 지나면 그 학생만 포기 처리(다시 들어와도 못 돌아온다)');
  }

  /* ---------- 클리어 · 기록 ---------- */
  {
    const s = party({ pets: ['dragon', 'penguin', 'panda'] }); let t = DUNGEON.INTRO_MS;
    const floors = [];
    for (let f = 0; f < 6 && s.phase !== 'finished'; f++) { floors.push(s.monster.key); t = killFloor(s, t); if (s.phase === 'rest') { t = s.rest_until; tick(s, t); } }
    assert(s.phase === 'finished' && s.result.cleared && s.floor === 6 && floors.at(-1) === BOSS.key && new Set(floors).size === 6, 'V13.120 1~5층(층마다 다른 몬스터) 다음 보스 킬러 골렘을 잡으면 클리어');
    assert(floors.slice(0, 5).every((key, i) => MONSTERS[key].floors.includes(i + 1)) && Object.keys(MONSTERS).length === 15 && Object.values(MONSTERS).every(m => TRAITS[m.trait] && SIZE_OK(m.size)), 'V13.120 일반 몬스터 15종은 정해진 층에서만 나오고, 층마다 특징이 하나씩 있다');
    assert(s.result.time_ms === s.finished_at - s.started_at && s.result.time_ms > 5 * DUNGEON.REST_MS && s.result.record && s.result.players.every(p => p.reward && p.accuracy >= 0 && p.accuracy <= 1) && Math.abs(s.result.players.reduce((n, p) => n + p.share, 0) - 1) < 0.01, 'V13.120 결과: 기록 시간(1층 시작 ~ 보스 처치, 휴식 포함), 파티원별 정답률과 기여도');
    assert(s.result.report_id === reportId(s) && reportId(s) === `dungeon:d1:${s.started_at}` && tick(s, t + 99999).length === 0 && answer(s, 'p0', 0, t + 99999).length === 0, 'V13.120 끝난 판은 더 움직이지 않고, 결과 보고 키는 방과 시작 시각으로 하나다(두 번 지급 방지)');
    const withBot = party({ seed: 9 });
    withBot.players.p2.bot = true;
    let tb = DUNGEON.INTRO_MS;
    for (let f = 0; f < 6 && withBot.phase !== 'finished'; f++) { tb = killFloor(withBot, tb); if (withBot.phase === 'rest') { tb = withBot.rest_until; tick(withBot, tb); } }
    assert(withBot.result.cleared && withBot.result.record === false && withBot.result.players.find(p => p.id === 'p2').reward === false, 'V13.120 봇이 낀 파티는 기록에서 빠진다');
  }

  /* ---------- 보스 ---------- */
  {
    const s = party(); let t = DUNGEON.INTRO_MS;
    for (let f = 0; f < 5; f++) { t = killFloor(s, t); t = s.rest_until; tick(s, t); }
    const m = s.monster;
    assert(m.boss && m.stage === 1 && q(s, 'p0').options.length === 6 && m.max_hp === Math.round(FLOORS[5].hp * DUNGEON.HIT), 'V13.120 보스방: 보기 6개, 1페이즈');
    m.hp = Math.round(m.max_hp * 0.61);
    const ev = right(s, 'p0', t + 10);
    assert(m.stage === 2 && ev.some(e => e.type === 'boss_phase' && e.stage === 2) && m.mark_at === t + 10 + 3000, 'V13.120 보스 체력 60% 아래: 2페이즈 빨간펜 채점');
    t = settle(s, t + 10);
    for (const id of ['p0', 'p1', 'p2']) if (s.players[id].q) s.players[id].q.deadline = t + 999999;
    tick(s, m.mark_at);
    const first = m.mark;
    disconnect(s, first, m.mark_at - 1); s.players[first].connected = true;
    tick(s, m.mark_at);
    assert(s.players[first].mark_left === 0 || m.mark === first, 'V13.120 채점 표적은 주기마다 새로 뽑고, 지난 표적은 풀린다');
    const target = s.players[m.mark];
    assert(target && target.mark_left === 3 && m.mark_at > t, 'V13.120 채점: 주기마다 무작위 한 명이 표적, 다음 3문제를 연속으로 맞혀야 막는다');
    for (const id of ['p0', 'p1', 'p2']) s.players[id].hp = DUNGEON.MAX_HP;
    const hp = target.hp;
    wrong(s, target.id, m.mark_at + 10);
    assert(hp - target.hp === (CUTS.c3.hit + FLOORS[5].hitAdd) * DUNGEON.MARK_HIT && !m.mark, 'V13.120 채점 중에 틀리면 두 배로 맞는다');
    m.hp = Math.round(m.max_hp * 0.31);
    t = m.mark_at + 2000; tick(s, t);
    const pid = ['p0', 'p1', 'p2'].find(id => q(s, id));
    const ev3 = right(s, pid, t + 10);
    assert(m.stage === 3 && ev3.some(e => e.type === 'core_open') && m.core.goal === 3 * DUNGEON.CORE_PER_PLAYER, 'V13.120 보스 체력 30% 아래: 3페이즈 핵 노출(목표 = 서 있는 인원 × 3 정답)');
    t = settle(s, t + 10);
    const before = m.hp; let broke = null;
    for (let i = 0; i < 20 && !broke && s.phase === 'fight'; i++) { const id = ['p0', 'p1', 'p2'][i % 3]; if (!q(s, id)) { t = settle(s, t); continue; } broke = right(s, id, t + 5).find(e => e.type === 'break'); t += 5; }
    assert(broke && broke.damage === Math.round(m.max_hp * DUNGEON.BREAK_SHARE) && (m.hp < before - broke.damage || s.phase === 'finished'), 'V13.120 핵이 열린 동안 목표를 채우면 브레이크(보스 최대 체력의 15%)');
    if (s.phase === 'fight') {
      t = settle(s, t);
      const live = ['p0', 'p1', 'p2'].map(id => q(s, id)).find(Boolean);
      assert(live && live.deadline - live.started_at === Math.max(DUNGEON.MIN_LIMIT_MS, FLOORS[5].limit.c3 + gradeExtraMs('중2') - DUNGEON.RAGE_MS) && m.core.reopen_at, 'V13.120 3페이즈는 분노: 제한 시간 1초 단축, 핵은 잠시 뒤 다시 열린다');
    }
  }

  /* ---------- 만점 모드 ---------- */
  assert(floorSpec('max', 5).boss && floorSpec('max', 10).boss && !floorSpec('max', 6).boss && floorSpec('max', 7).hp > floorSpec('max', 6).hp && floorSpec('max', 30).limit >= DUNGEON.ENDLESS_LIMIT_MIN && floorSpec('max', 6).options === 6, 'V13.120 만점 모드: 5층마다 보스, 층마다 조금씩 단단해지고 제한 시간은 3초 아래로 줄지 않는다');
  {
    const s = party({ cut: 'max' }); let t = DUNGEON.INTRO_MS;
    for (let f = 0; f < 6 && s.phase !== 'finished'; f++) { t = killFloor(s, t); if (s.phase === 'rest') { t = s.rest_until; tick(s, t); } }
    assert(s.phase === 'fight' && s.floor === 7 && view(s, 'p0').last_floor === null, 'V13.120 만점 모드는 보스를 잡아도 끝나지 않고 계속 올라간다');
    for (const id of ['p0', 'p1', 'p2']) { s.players[id].hp = 1; wrong(s, id, t + 10); }
    assert(s.result && !s.result.cleared && s.result.reached === 6 && s.result.record, 'V13.120 만점 모드 기록은 도달한 층(실패로 끝나도 기록된다)');
  }

  /* ---------- 몬스터 특징 ---------- */
  {
    const s = party(); let t = DUNGEON.INTRO_MS, ok = 0;
    s.monster.trait = 'bandage'; s.monster.hp = 99999;
    assert(answer(s, 'p0', null, t + 1).length === 0 && answer(s, 'p0', '7', t + 1).length === 0 && answer(s, 'p0', 1.5, t + 1).length === 0 && s.players.p0.answered === 0, 'V13.120 보기 번호가 아닌 답은 버린다');
    right(s, 'p0', t + 1); t += 1;
    for (let i = 1; i < 26; i++) {
      t = settle(s, t);
      const qq = q(s, 'p0');
      if (qq.covered !== null && qq.covered !== qq.answer) ok++;
      const before = qq.n;
      answer(s, 'p0', qq.covered, t + 1, qq.n);
      if (q(s, 'p0')?.n !== before || s.players.p0.answered !== i) ok = -999;
      right(s, 'p0', t + 2); t += 2;
    }
    assert(ok === 25, 'V13.120 오답노트 미라의 붕대는 문제마다 오답 보기 한 칸만 가리고(정답은 가리지 않는다), 가려진 칸은 눌러도 답이 되지 않는다');
    s.monster.trait = 'redx';
    t = settle(s, t); wrong(s, 'p0', t + 1); t = settle(s, t + 1);
    const marked = q(s, 'p0');
    right(s, 'p0', t + 1); t = settle(s, t + 1);
    assert(marked.marked !== null && marked.marked !== marked.answer && q(s, 'p0').marked === null, 'V13.120 빨간펜 귀신: 틀린 다음 문제에만 오답 보기 하나에 X(정답에는 긋지 않는다)');
    s.monster.trait = 'sand';
    right(s, 'p0', t + 1); t = settle(s, t + 1);
    const qs = q(s, 'p0');
    assert(qs.deadline - qs.started_at === FLOORS[0].limit.c3 + gradeExtraMs('중2') - 500 && Object.values(TRAITS).every(x => x.name && x.desc), 'V13.120 몬스터 특징마다 이름과 설명이 있고, 모래시계 마녀는 제한 시간을 0.5초 줄인다');
  }

  /* ---------- 같은 씨앗이면 같은 판 · 시뮬레이션 ---------- */
  const once = seed => { const r = seeded(seed); return JSON.stringify(run('c2', [student(r), student(r), student(r)], r, { grade: '중2', pets: ['dog', 'cat', 'owl'] })); };
  assert(once(3) === once(3), 'V13.120 같은 씨앗이면 같은 판이 나온다(무작위는 상태 안의 씨앗으로만)');
  const rates = { c3: clearRate('c3', 3, 300).rate, c2: clearRate('c2', 3, 300).rate, c1: clearRate('c1', 3, 300).rate };
  assert(rates.c3 >= 0.5 && rates.c3 <= 0.7 && rates.c2 >= 0.27 && rates.c2 <= 0.43 && rates.c1 >= 0.05 && rates.c1 <= 0.16, `V13.120 시뮬레이션(3명 첫 도전) 클리어율이 목표 근처: 3등급 컷 ${Math.round(rates.c3 * 100)}%(≈60) · 2등급 컷 ${Math.round(rates.c2 * 100)}%(≈35) · 1등급 컷 ${Math.round(rates.c1 * 100)}%(≈10)`);
  const duo = clearRate('c3', 2, 300);
  assert(duo.rate >= 0.4 && duo.rate <= rates.c3 + 0.05 && duo.avg_ms > 6 * 60000 && duo.avg_ms < 9.5 * 60000, 'V13.120 2인 파티도 3인과 비슷하게 깰 수 있고(조금 어렵게), 한 판은 약 7~9분이다');
}
const SIZE_OK = size => ['S', 'M', 'L'].includes(size);

if (import.meta.url === `file://${process.argv[1]}`) {
  let n = 0;
  runDungeonChecks((ok, label) => { n++; if (!ok) { console.error('[dungeon-check] FAIL', label); process.exit(1); } });
  console.log(`[dungeon-check] PASS ${n}`);
}
