// V13.177 검사: 빈칸영작(중등 학습 → 빈칸영작, 중3 동아(윤정미) 5 · 6 · 7과 본문 암기노트 Step 1 ~ 5).
// 서버 채점(대소문자 · 구두점 · 따옴표 무시), 보상은 본문 × 단계마다 첫 완료 때만(두 번째는 0), 하루 70코인 상한(그 뒤 경험치만),
// 시작 신호 없음 · 너무 빠름 · 틀린 답 · 고등 · 선생님 거절, 저장 크기 상한, 정답이 서버 응답으로 새지 않음, 학습 허브 카드는 중등만.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dayKey } from '../public/modules/core.js';
import { BLANK_LESSONS, blankGroupItems } from '../public/middle-donga-yoon-blank-data.js';
import { BLANK_REWARDS, BLANK_DAILY_COINS, BLANK_MS_PER, BLANK_MIN_FLOOR_MS } from '../public/modules/rewards.js';
import { blankGroup, blankNorm, blankSlots, blankSentences, blankAnswer, gradeBlankItem, gradeBlankStep, blankMinMs, blankDiff, blankKey } from '../public/modules/blank-rules.js';
import { blankStart, blankFinish, blankView, BLANK_DONE_MAX } from './blank.mjs';
import { bonusRecords } from './rewards.mjs';
import { emptyState } from './state.mjs';
import { passwordHash } from './auth.mjs';
import { service } from './service.mjs';

const source = path => readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8');
const DAY = 86400000;
const throws = fn => { try { fn(); return null; } catch (e) { return e.status || 500; } };

// 한 단계의 정답 답안(화면이 보내는 모양).
const answersFor = (items, step) => Object.fromEntries(items.map(item => [item.n, blankAnswer(item, step)]));
const student = (id = 'k', extra = {}) => ({ id, role: 'student', class_name: '중3', division: 'middle', pets: [{ key: 'dog' }], ...extra });
const coinsOf = p => bonusRecords(p).reduce((n, r) => n + r.reward_points, 0);

export async function runBlankChecks(assert) {
  const t0 = Date.parse('2026-10-26T03:00:00Z');
  const g1 = blankGroup('5-1'), g2 = blankGroup('5-2');

  /* ---------- 규칙 숫자(선생님 결정) ---------- */
  assert(Object.entries(BLANK_REWARDS).map(([s, r]) => `${s}:${r.coins}/${r.xp}`).join() === '1:4/20,2:6/30,3:8/40,4:8/40,5:12/60' && BLANK_DAILY_COINS === 70,
    'V13.177 빈칸영작 보상: Step 1 4코인 · 20xp, Step 2 6 · 30, Step 3 8 · 40, Step 4 8 · 40, Step 5 12 · 60, 하루 코인 상한 70');
  assert(Object.values(BLANK_MS_PER).every(ms => ms >= 1000 && ms <= 1500) && BLANK_MS_PER[1] === 1500 && BLANK_MS_PER[5] === 1500 && BLANK_MIN_FLOOR_MS >= 5000,
    'V13.177 너무 빠른 끝 보고: 빈칸 · 단어 수 × 약 1.5초(Step 4는 칩을 누르는 일이라 1초)');
  const total = Object.values(BLANK_LESSONS).flatMap(l => l.groups).length;
  const sum = Object.values(BLANK_REWARDS).reduce((n, r) => n + r.coins, 0) * total;
  assert(total === 12 && sum === 38 * 12 && sum <= 500, `V13.177 전체 한 번뿐인 코인 보상 ${sum}코인(본문 12 × 5단계, 한 본문 38코인)`);

  /* ---------- 정규화와 채점 ---------- */
  assert(blankNorm('“Hello,”') === 'hello' && blankNorm('don’t') === "don't" && blankNorm("don't") === blankNorm('don’t') && blankNorm('Medal.') === 'medal' && blankNorm('players’') === 'players',
    'V13.177 정답 비교는 대소문자 · 앞뒤 구두점 · 따옴표 모양(’ ‘ “ ” 와 \' ")을 무시한다(낱말 안의 아포스트로피는 그대로)');
  const first = g1.items[0]; // "In sports, only the players get a trophy or medal, but they don’t win on their own."
  assert(blankSlots(first, 1).join() === '2,7,9' && blankAnswer(first, 1).join('|') === 'only|trophy|medal,', 'V13.177 Step 1 정답 낱말은 빈칸 위치(en.split(" ")의 칸 번호) 그대로');
  assert(gradeBlankItem(first, 1, ['ONLY', 'trophy', '“medal”']).ok && !gradeBlankItem(first, 1, ['only', 'medal', 'trophy']).ok && !gradeBlankItem(first, 1, ['only', 'trophy']).ok && !gradeBlankItem(first, 1, ['only', 'trophy', '']).ok,
    'V13.177 Step 1 ~ 3 채점: 대소문자 · 구두점 · 따옴표는 봐주고, 순서가 다르거나 빈칸이 모자라거나 비면 틀림');
  const quote = blankGroup('6-1').items.find(item => item.en.includes('’'));
  assert(!quote || gradeBlankItem({ ...quote, s2: [quote.en.split(' ').findIndex(w => w.includes('’'))] }, 2, [quote.en.split(' ').find(w => w.includes('’')).replace(/’/g, "'")]).ok,
    'V13.177 곧은 따옴표(\')로 쓴 낱말도 굽은 따옴표(’) 정답과 같다');
  const two = g2.items.find(item => item.s4.length === 2);
  assert(two && blankSentences(two).length === 2 && blankSentences(two).join(' ') === two.en, 'V13.177 Step 4: 한 문항에 단어 묶음이 둘이면 문장 둘을 각각 배열하고, 문장은 묶음의 낱말 수대로 en을 나눈다');
  assert(gradeBlankItem(two, 4, blankSentences(two).map(s => s.toLowerCase())).ok && !gradeBlankItem(two, 4, [...blankSentences(two)].reverse()).ok && !gradeBlankItem(two, 4, [blankSentences(two)[0]]).ok,
    'V13.177 Step 4 채점: 문장마다 정규화해서 비교(대소문자 무시), 문장이 바뀌거나 모자라면 틀림');
  assert(gradeBlankItem(first, 5, first.en.toUpperCase()).ok && gradeBlankItem(first, 5, ' in sports only the players get a trophy or medal but they don\'t win on their own ').ok && !gradeBlankItem(first, 5, 'In sports, the players get a trophy or medal.').ok && !gradeBlankItem(first, 5, 42).ok,
    'V13.177 Step 5 채점: 정규화한 단어 순서가 en과 같으면 정답, 한 낱말이라도 빠지면 틀림');
  const diff = blankDiff(first.en, 'In sports, the players get a trophy or medal but they win on their own.');
  assert(diff.want.filter(w => !w.ok).map(w => w.word).join() === 'only,don’t' && diff.mine.every(w => w.ok), 'V13.177 Step 5 틀리면 어디가 다른지(빠진 낱말)를 알려 준다');
  const allCorrect = Object.keys(BLANK_LESSONS).every(lesson => BLANK_LESSONS[lesson].groups.every(group => [1, 2, 3, 4, 5].every(step => gradeBlankStep(blankGroupItems(lesson, group), step, answersFor(blankGroupItems(lesson, group), step)).ok)));
  assert(allCorrect, 'V13.177 12개 본문 × 5단계 모두 정답 답안이 채점을 통과한다(데이터와 채점이 같은 규칙)');
  assert(!gradeBlankStep(g1.items, 2, { ...answersFor(g1.items, 2), 1: [] }).ok && gradeBlankStep(g1.items, 2, {}).wrong.length === g1.items.length, 'V13.177 답이 없거나 비어 있으면 틀림');

  /* ---------- 서버: 시작 → 끝 보고 → 보상 ---------- */
  {
    const p = student();
    const start = blankStart(p, { group: '5-1', step: 2, id: 'b1', now: t0 });
    assert(start.id === 'b1' && start.left === 70 && p.blank.live.id === 'b1', 'V13.177 시작 신호를 받으면 서버가 어느 본문 · 단계인지 기억한다');
    const wait = blankMinMs(g1.items, 2);
    assert(wait === Math.max(BLANK_MIN_FLOOR_MS, g1.items.reduce((n, item) => n + blankSlots(item, 2).length, 0) * 1500), 'V13.177 최소 시간 = 빈칸 수 × 1.5초');
    const quick = blankFinish(p, { id: 'b1', group: '5-1', step: 2, answers: answersFor(g1.items, 2), now: t0 + wait - 1 });
    assert(quick.paid === false && quick.reason === 'short' && !p.blank.done && coinsOf(p) === 0, 'V13.177 너무 빠른 끝 보고는 거절(보상 없음, 첫 완료로도 치지 않음)');
    blankStart(p, { group: '5-1', step: 2, id: 'b2', now: t0 });
    const bad = blankFinish(p, { id: 'b2', group: '5-1', step: 2, answers: { ...answersFor(g1.items, 2), [g1.items[0].n]: ['x', 'x', 'x', 'x', 'x', 'x', 'x'] }, now: t0 + wait + 1 });
    assert(bad.paid === false && bad.reason === 'wrong' && bad.wrong.join() === String(g1.items[0].n) && !p.blank.done, 'V13.177 서버 채점에서 최종 답이 틀리면 거절하고 어느 문항인지 알려 준다');
    const noStart = blankFinish(p, { id: 'zz', group: '5-1', step: 2, answers: answersFor(g1.items, 2), now: t0 + wait + 5 });
    assert(noStart.paid === false && noStart.reason === 'nostart' && !p.blank.done, 'V13.177 시작 신호 없는 끝 보고는 거절');
    blankStart(p, { group: '5-1', step: 3, id: 'b3', now: t0 });
    assert(blankFinish(p, { id: 'b3', group: '5-1', step: 2, answers: answersFor(g1.items, 2), now: t0 + 999999 }).reason === 'nostart', 'V13.177 시작한 본문 · 단계와 다른 단계로 보고하면 거절');
    blankStart(p, { group: '5-1', step: 2, id: 'b4', now: t0 });
    const ok = blankFinish(p, { id: 'b4', group: '5-1', step: 2, answers: answersFor(g1.items, 2), rate: 83, pet: 'dog', now: t0 + wait + 1000 });
    assert(ok.paid && ok.coins === 6 && ok.xp === 30 && ok.capped === false && ok.done['5-1:2'] === t0 + wait + 1000 && ok.rate['5-1:2'] === 83 && coinsOf(p) === 6, 'V13.177 첫 완료: 6코인 · 30경험치(addBonus), 완료 시각과 1차 정답률이 남는다');
    assert(p.bonus.log.find(x => x.k === 'dog')?.xp === 30, 'V13.177 경험치는 파트너 펫에게 간다(addBonus)');
    const replay = blankFinish(p, { id: 'b4', group: '5-1', step: 2, answers: answersFor(g1.items, 2), now: t0 + wait + 3000 });
    assert(replay.again && replay.paid && replay.coins === 6 && coinsOf(p) === 6, 'V13.177 같은 끝 보고를 다시 보내도(답을 못 받은 경우) 같은 답이고 또 주지 않는다');
    blankStart(p, { group: '5-1', step: 2, id: 'b5', now: t0 + 20000 });
    const again = blankFinish(p, { id: 'b5', group: '5-1', step: 2, answers: answersFor(g1.items, 2), rate: 100, now: t0 + 20000 + wait + 1 });
    assert(again.paid === false && again.reason === 'again' && coinsOf(p) === 6 && again.rate['5-1:2'] === 100 && again.done['5-1:2'] === t0 + wait + 1000, 'V13.177 같은 본문 · 단계를 다시 풀면 연습만(보상 0), 완료 시각은 처음 그대로 · 정답률은 높은 값');
  }

  /* ---------- 하루 코인 상한 70 ---------- */
  {
    const p = student('cap'), at = t0 + DAY;
    let paid = 0, xp = 0, capped = 0, n = 0;
    // 한 날에 모든 본문의 Step 5(12코인)를 순서대로: 70 / 12 → 5번 다 받고 6번째는 10코인만, 그 뒤는 경험치만.
    for (const group of Object.values(BLANK_LESSONS).flatMap(l => l.groups)) {
      const found = blankGroup(group.id), id = 'c' + n++, now = at + n * 600000;
      blankStart(p, { group: group.id, step: 5, id, now });
      const r = blankFinish(p, { id, group: group.id, step: 5, answers: answersFor(found.items, 5), pet: 'dog', now: now + blankMinMs(found.items, 5) + 1 });
      assert(r.paid && r.xp === 60, `V13.177 상한 뒤에도 경험치는 계속 받는다(${group.id})`);
      paid += r.coins; xp += r.xp; if (r.capped) capped++;
    }
    assert(paid === 70 && xp === 12 * 60 && capped === 7 && coinsOf(p) === 70, `V13.177 하루에 빈칸영작으로 받는 코인은 ${paid}코인에서 멈추고(12 × 5 + 10), 그 뒤 본문은 경험치만(${xp}xp)`);
    assert(blankView(p, at + 7 * 3600000).left === 0 && p.blank.day.coins === 70, 'V13.177 오늘 남은 코인이 0으로 보인다');
    // 다음 날(한국 시간)이 되면 다시 받는다.
    const next = t0 + 2 * DAY, found = blankGroup('5-1');
    assert(dayKey(next) !== dayKey(at), 'V13.177 (검사 준비) 다음 날이다');
    blankStart(p, { group: '5-1', step: 1, id: 'n1', now: next });
    const r = blankFinish(p, { id: 'n1', group: '5-1', step: 1, answers: answersFor(found.items, 1), now: next + blankMinMs(found.items, 1) + 1 });
    assert(r.paid && r.coins === 4 && r.capped === false && coinsOf(p) === 74 && blankView(p, next).left === 66, 'V13.177 하루 기준은 한국 시간 날짜: 다음 날에는 상한이 다시 70으로 시작');
  }

  /* ---------- 접근: 중등 학생만 ---------- */
  {
    const high = student('hi', { division: 'high', class_name: '고1A' }), teacher = { id: 't', role: 'teacher', division: 'middle' }, noLabel = { id: 'x', role: 'student', class_name: '고1B' };
    assert(throws(() => blankStart(high, { group: '5-1', step: 1, id: 'h', now: t0 })) === 403 && throws(() => blankFinish(high, { id: 'h', group: '5-1', step: 1, answers: {}, now: t0 })) === 403, 'V13.177 고등 학생은 시작 · 끝 보고 모두 거절(403)');
    assert(throws(() => blankStart(teacher, { group: '5-1', step: 1, id: 't', now: t0 })) === 403 && throws(() => blankStart(null, { group: '5-1', step: 1, id: 't', now: t0 })) === 403, 'V13.177 선생님 · 학생이 아닌 계정은 거절(403)');
    assert(throws(() => blankStart(noLabel, { group: '5-1', step: 1, id: 'x', now: t0 })) === 403 && !high.blank && !noLabel.blank, 'V13.177 학년으로 중등을 알아낼 수 없으면(division 없음, 고등 반) 고등으로 보고 거절, 기록은 만들지 않음');
    const k = student('ok');
    assert(throws(() => blankStart(k, { group: '9-9', step: 1, id: 'g', now: t0 })) === 400 && throws(() => blankStart(k, { group: '5-1', step: 6, id: 'g', now: t0 })) === 400 && throws(() => blankStart(k, { group: '5-1', step: 1.5, id: 'g', now: t0 })) === 400 && throws(() => blankStart(k, { group: '5-1', step: 0, id: 'g', now: t0 })) === 400,
      'V13.177 모르는 본문 · 단계는 거절(400)');
  }

  /* ---------- 저장 크기 ---------- */
  {
    const p = student('size');
    let n = 0, now = t0 + 3 * DAY;
    for (const group of Object.values(BLANK_LESSONS).flatMap(l => l.groups)) for (const step of [1, 2, 3, 4, 5]) {
      const found = blankGroup(group.id), id = 'z' + n++;
      now += DAY;
      blankStart(p, { group: group.id, step, id, now });
      blankFinish(p, { id, group: group.id, step, answers: answersFor(found.items, step), rate: 100, now: now + blankMinMs(found.items, step) + 1 });
    }
    const size = JSON.stringify(p.blank).length;
    assert(Object.keys(p.blank.done).length === BLANK_DONE_MAX && BLANK_DONE_MAX === 60 && Object.keys(p.blank.rate).length === 60 && Object.keys(p.blank.done).every(key => /^\d-\d:[1-5]$/.test(key)) && size < 3500 && !p.blank.live,
      `V13.177 저장은 작다: 12본문 × 5단계 = 60칸이 모두 차도 ${size}바이트(< 3.5KB), 시작 기록은 남지 않음`);
    const coinsBefore = coinsOf(p);
    for (let i = 0; i < 40; i++) { blankStart(p, { group: '5-1', step: 1, id: 'rep' + i, now }); blankFinish(p, { id: 'rep' + i, group: '5-1', step: 1, answers: answersFor(g1.items, 1), rate: 100, now: now + 99999 }); }
    assert(Math.abs(JSON.stringify(p.blank).length - size) < 40 && coinsOf(p) === coinsBefore && coinsBefore === 38 * 12, 'V13.177 같은 단계를 몇 번을 다시 풀어도 저장은 늘지 않고 보상도 없다(전체 456코인은 정확히 한 번)');
    assert(Object.keys(p.blank).sort().join() === 'day,done,last,rate', 'V13.177 p.blank 키: done · rate · day · last (시작 기록 live는 끝나면 지운다)');
  }

  /* ---------- 서버 연결(API): 중등 학생 · 고등 학생 · 선생님 ---------- */
  {
    const state = emptyState(), hash = await passwordHash('QaBlank1!'), now = Date.now();
    const base = { active: true, password_hash: hash, pets: [{ key: 'dog', first: true, acquired_at: now - 9 * DAY }], avatar_key: 'dog', created_at: now - 9 * DAY };
    state.profiles.push(
      { id: 'qa-bw-mid', username: 'qa-bw-mid', display_name: '중등', role: 'student', class_name: '중3', school_id: 'wonil-middle', school: '원일중', division: 'middle', ...base },
      { id: 'qa-bw-high', username: 'qa-bw-high', display_name: '고등', role: 'student', class_name: '고1A', school_id: 'danwon-high', school: '단원고', division: 'high', ...base },
      { id: 'qa-bw-teacher', username: 'qa-bw-teacher', display_name: '선생님', role: 'teacher', school_ids: ['wonil-middle'], division_ids: ['middle'], active_division: 'middle', active_school_id: 'wonil-middle', ...base }
    );
    const login = async (username, division) => (await service(state, 'POST', '/login', { username, password: 'QaBlank1!', division }, null))._cookie;
    const mid = await login('qa-bw-mid', 'middle'), high = await login('qa-bw-high', 'high'), teacher = await login('qa-bw-teacher', 'middle');
    const me = state.profiles.find(x => x.id === 'qa-bw-mid');
    const boot = await service(state, 'GET', '/bootstrap', undefined, mid);
    assert(boot.rewards.blank && boot.rewards.blank.left === 70 && boot.rewards.blank.daily === 70 && Object.keys(boot.rewards.blank.done).length === 0 && !('blank' in boot.profile),
      'V13.177 홈 데이터에 빈칸영작 진행(완료 · 정답률 · 오늘 남은 코인)이 오고, 시작 기록이 든 p.blank 자체는 profile에 싣지 않는다');
    const hi = await service(state, 'GET', '/bootstrap', undefined, high);
    assert(hi.rewards.blank && hi.rewards.blank.left === 70, 'V13.177 (고등 학생 홈 데이터에도 같은 모양이 오지만 시작 · 끝은 거절)');
    const start = await service(state, 'POST', '/blank/start', { group: '5-1', step: 1 }, mid);
    assert(start.id && start.left === 70 && me.blank.live.g === '5-1', 'V13.177 /blank/start: 중등 학생은 시작');
    const lessThanWait = await service(state, 'POST', '/blank/finish', { id: start.id, group: '5-1', step: 1, answers: answersFor(g1.items, 1) }, mid);
    assert(lessThanWait.paid === false && lessThanWait.reason === 'short' && lessThanWait.points_balance === 0, 'V13.177 /blank/finish: 시작 직후 보고는 너무 빨라서 거절');
    const dirty = { ...answersFor(g1.items, 1), junk: 'x'.repeat(5000), [g1.items[0].n]: Array(200).fill('y'.repeat(500)) };
    const cleaned = await service(state, 'POST', '/blank/finish', { id: 'nope', group: '5-1', step: 1, answers: dirty }, mid);
    assert(cleaned.reason === 'nostart', 'V13.177 길거나 이상한 답안은 잘려서 받는다(저장 안 함, 모르는 시작 번호는 거절)');
    for (const [name, token] of [['고등', high], ['선생님', teacher]]) {
      let s = 0; try { await service(state, 'POST', '/blank/start', { group: '5-1', step: 1 }, token); } catch (e) { s = e.status; }
      let f = 0; try { await service(state, 'POST', '/blank/finish', { id: 'x', group: '5-1', step: 1, answers: {} }, token); } catch (e) { f = e.status; }
      assert(s === 403 && f === 403, `V13.177 API: ${name}은 시작 · 끝 보고 모두 403`);
    }
    // 시간을 앞당겨 정상 흐름(서버의 시계를 쓰므로 live.at을 과거로 돌린다).
    const s2 = await service(state, 'POST', '/blank/start', { group: '5-1', step: 1 }, mid);
    me.blank.live.at -= 60000;
    const done = await service(state, 'POST', '/blank/finish', { id: s2.id, group: '5-1', step: 1, answers: answersFor(g1.items, 1), first_rate: 75 }, mid);
    assert(done.paid && done.coins === 4 && done.xp === 20 && done.points_balance === 4 && done.done['5-1:1'] && done.rate['5-1:1'] === 75 && done.stats, 'V13.177 /blank/finish: 맞게 끝내면 4코인 · 20경험치, 잔액 · 진행 · 통계가 같이 온다');
    const boot2 = await service(state, 'GET', '/bootstrap', undefined, mid);
    assert(boot2.rewards.blank.done['5-1:1'] && boot2.rewards.blank.left === 66, 'V13.177 다시 열어도 완료 표시와 남은 코인이 서버에 저장돼 있다');
    const log = JSON.stringify(state.profiles.find(x => x.id === 'qa-bw-mid').activity || []);
    assert(log.includes('빈칸영작 5-1 Step 1'), 'V13.177 선생님이 보는 활동 기록에 한 줄이 남는다');
    const wire = JSON.stringify([start, lessThanWait, done, boot2.rewards.blank]);
    const leaks = Object.values(BLANK_LESSONS).flatMap(l => l.items).filter(item => item.en.length > 40 && wire.includes(item.en));
    assert(!leaks.length && !wire.includes('trophy or medal') && Object.keys(done).every(k => !/^(en|ko|s\d|o\d|answer)/.test(k)), 'V13.177 서버 응답에는 정답이 따로 실리지 않는다(정답은 정적 데이터 파일에만 있고, 서버는 맞았는지와 틀린 문항 번호만 말한다)');
  }

  /* ---------- 화면(소스): 허브 카드는 중등에만, 한 번에 한 단계 ---------- */
  {
    const student = source('../public/modules/student.js'), app = source('../public/app.js'), screen = source('../public/blank-writing.js'), build = source('./build-assets.mjs'), svc = source('./service.mjs'), auth = source('./auth.mjs');
    assert(student.includes("export const blankVisible = A => A.data?.profile?.role === 'student' && A.data.profile.division === 'middle'") && student.includes("${blankVisible(A) ? `<button class=\"study-hub-card blank\" data-study=\"blank\">") && student.includes("A.studyView === 'blank' && blankVisible(A)"),
      'V13.177 학습 허브의 세 번째 카드 "빈칸영작"은 중등 학생에게만 보이고 고등은 카드 · 화면 모두 막힌다');
    assert(student.includes('data-blank-lesson') && student.includes('data-blank-group') && student.includes('data-blank-step') && student.includes('middle-grammar-tabs-v1339') && student.includes('gx-card') && student.includes('Step 1 ~ 5'),
      'V13.177 화면 흐름: 5과 · 6과 · 7과 탭 → 본문 목록(단계 점) → Step 1 ~ 5 고르기(완료 · 정답률), 어법 선택형과 같은 탭 · 카드');
    assert(student.includes('A.data.rewards?.blank?.done') && !student.slice(student.indexOf('function blankStudy(A)'), student.indexOf('function studyHub(A)')).includes('localStorage'), 'V13.177 완료 표시는 서버에 저장된 진행(rewards.blank)을 쓴다');
    assert(app.includes("A.data.profile.division !== 'middle'") && app.includes("import('./blank-writing.js')") && app.includes("import('./middle-donga-yoon-blank-data.js')"), 'V13.177 빈칸영작 화면과 자료는 눌렀을 때만 불러온다(앱 시작을 무겁게 하지 않음)');
    assert(screen.includes("api('/blank/start'") && screen.includes("api('/blank/finish'") && screen.includes('first_rate') && screen.includes("reason === 'error'") && screen.includes('연습은 끝났어요'), 'V13.177 화면: 시작 신호 → 끝 보고, 거절돼도 "연습은 끝났어요" 이유가 보인다');
    assert(screen.includes('data-chip') && screen.includes('class="bw-in') && screen.includes('data-pool') && screen.includes('data-undo') && screen.includes('data-reset') && screen.includes('id="bw-area"') && screen.includes('blankDiff(') && screen.includes('정답 보기') && screen.includes('첫 글자 힌트'),
      'V13.177 단계별 방식: 1 보기 칩 · 2/3 입력칸 · 4 순서 쌓기(되돌리기 · 처음부터) · 5 영작(틀린 곳 보기) · 정답 보기 · 첫 글자 힌트');
    assert(screen.includes('autocapitalize="off"') && screen.includes('spellcheck="false"') && screen.includes('width:calc(${len}ch') && screen.includes('class="bw-ko"') && screen.includes('bw-slot') && screen.includes('prefers-reduced-motion'),
      'V13.177 입력칸은 자동 대문자 · 맞춤법 끄기, 칸 너비는 정답 단어 길이에 맞추고, 우리말 해석은 항상 보인다');
    assert(screen.includes("@media(max-width:390px)") && screen.includes('min-height:46px') && screen.includes('env(safe-area-inset-bottom)'), 'V13.177 폰 390px: 칩은 46px 이상, 아래 고정 버튼은 안전 영역을 비운다');
    assert(screen.includes('coinShower(') && screen.includes('playReward(') && screen.includes('bw-confetti') && screen.includes('1차 정답률') && screen.includes('걸린 시간'), 'V13.177 완료 연출: 색종이 · 코인 비 · 코인 올라가는 숫자, 1차 정답률 · 걸린 시간');
    assert(svc.includes("path === '/blank/start'") && svc.includes("path === '/blank/finish'") && svc.includes("requireRole(p, 'student')") && svc.includes("'hunt', 'blank']") && auth.includes('chance_live, bonus, blank,'), 'V13.177 서버 길: 시작 · 끝은 학생만, 로그인 때 기록을 지키고, profile에는 싣지 않는다');
    assert(build.includes('blank-writing') && build.includes('[a-z-]+-blank-data') && build.includes('"v13177.css"'), 'V13.177 빈칸영작 화면 · 자료는 앱 설치 때 미리 받지 않고 쓸 때 받고, 스타일은 번들에 들어간다');
    assert(!student.slice(student.indexOf('function grammarStudy(A)'), student.indexOf('// V13.124 고등 단어 고르기')).includes('blank'), 'V13.177 기존 어법 선택형 화면(grammarStudy)은 건드리지 않았다');
    assert(!svc.includes('GRAMMAR_PASSAGES_PER_STUDENT = 80') || svc.includes('const GRAMMAR_PASSAGES_PER_STUDENT = 80;'), 'V13.177 어법 선택형 진행 한도(학생당 80지문)는 그대로, 빈칸영작은 별도 저장');
  }
}
