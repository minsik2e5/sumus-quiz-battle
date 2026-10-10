// V13.128 던전 방 · 로비 · 초대 규칙 검사(docs/dungeon-design.md 2 · 9번). 메인 상태 쪽 규칙(방 만들기, 같은 학년,
// 열린 등급컷, 문제 풀 120단어, 초대 · 친구 목록 · 봇 동료, 결과 한 번 처리)과 방 · 화면 연결 코드를 본다.
// 방(cloudflare/dungeon-room.mjs) 자체는 dungeon-room-check.mjs(check:cloudflare)가 끝까지 돌려 본다.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { emptyState, migrateState } from './state.mjs';
import { passwordHash } from './auth.mjs';
import { service, settleDungeon, undoDungeon, tidyDungeons, DUNGEON_LOBBY_MS, DUNGEON_BOT_LIMIT } from './service.mjs';
import { createDungeon, join, DUNGEON, FLOORS, CUTS, DUNGEON_COINS } from './dungeon-engine.mjs';
import { dungeonQuestions, pickWrong, distractorIndex, pickWrongEnglish, englishIndex, DUNGEON_POOL_MAX } from './dungeon-words.mjs';
import { createBatcher, createDungeonReporter } from './dungeon-reports.mjs';

const source = path => readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8');

export async function runDungeonLobbyChecks(assert, expectStatus) {
  /* ---------- 확정 수치는 이 세션에서 바꾸지 않는다 ---------- */
  assert(FLOORS.map(f => f.limit.c3).join() === '8000,7000,6500,6000,5500,5000' && FLOORS.map(f => f.limit.c1).join() === '6000,5000,4500,4000,3500,3000', 'V13.128 확정 제한 시간(1초 줄인 값)은 그대로');
  assert(DUNGEON_COINS.first.c3 === 150 && DUNGEON_COINS.first.c2 === 300 && DUNGEON_COINS.first.c1 === 500 && DUNGEON_COINS.again_max.c3 === 40 && DUNGEON_COINS.again_max.c1 === 60 && DUNGEON_COINS.daily === 3, 'V13.128 확정 코인 수치는 그대로');
  assert(!/dungeonCoins|DUNGEON_COINS/.test(source('./service.mjs')) && !/dungeonCoins|DUNGEON_COINS/.test(source('../cloudflare/dungeon-room.mjs')), 'V13.128 코인 지급은 기록 · 보상 세션에서(이번에는 넣지 않는다)');

  /* ---------- 문제 풀: 오답 5개, 같은 품사 · 비슷한 길이, 정답 · 인정 뜻은 오답에 없다 ---------- */
  const words = [
    ...Array.from({ length: 70 }, (_, i) => ({ id: 'n' + i, word: 'noun' + i, meaning: `명사뜻${i}`, part_of_speech: 'n.' })),
    ...Array.from({ length: 70 }, (_, i) => ({ id: 'v' + i, word: 'verb' + i, meaning: `동사뜻을나타냄${i}`, part_of_speech: 'v' })),
    { id: 'dup', word: 'twin', meaning: '명사뜻1', accepted_meanings: ['명사뜻2'], part_of_speech: 'n' }
  ];
  const index = distractorIndex(words);
  let r = 0; const random = () => { r = (r * 9301 + 49297) % 233280; return r / 233280; };
  const wrong = pickWrong(words.at(-1), index, random);
  assert(wrong.length === 5 && new Set(wrong).size === 5 && !wrong.includes('명사뜻1') && !wrong.includes('명사뜻2') && wrong.every(w => w.startsWith('명사뜻')), `V13.128 오답 뜻 5개는 서로 다르고, 같은 품사이며, 정답과 인정 뜻이 없다 (${wrong.join(', ')})`);
  const built = dungeonQuestions({ own: words.slice(0, 30), earlier: words.slice(30, 80), extra: words.slice(80), wrong: words.slice(0, 5), all: words }, random);
  assert(built.ok && built.questions.length >= DUNGEON.POOL_MIN && built.own === 30 && built.questions.every(q => q.prompt && q.meaning && q.wrong.length === 5 && !q.wrong.includes(q.meaning)), 'V13.128 범위가 120단어보다 적으면 앞쪽 범위 · 나머지 · 틀린 단어로 채운다(고른 범위는 모두 남는다)');
  const big = dungeonQuestions({ own: Array.from({ length: 400 }, (_, i) => ({ id: 'b' + i, word: 'big' + i, meaning: `큰뜻${i}`, part_of_speech: 'n' })) }, random);
  assert(big.questions.length === DUNGEON_POOL_MAX, `V13.128 고른 범위가 크면 한 판 문제 풀은 ${DUNGEON_POOL_MAX}개`);
  assert(!dungeonQuestions({ own: words.slice(0, 50), all: words }, random).ok, 'V13.128 보충해도 120단어가 안 되면 들어갈 수 없다');
  // V13.130 영어 고르기용 영어 오답 5개: 같은 품사 · 비슷한 길이, 자기 자신 · 같은 뜻 단어는 빼고 서로 다르다.
  const enWrong = pickWrongEnglish(words.at(-1), englishIndex(words), random);
  assert(enWrong.length === 5 && new Set(enWrong.map(w => w.toLowerCase())).size === 5 && !enWrong.includes('twin') && !enWrong.includes('noun1') && enWrong.every(w => w.startsWith('noun')), `V13.130 영어 오답 5개는 서로 다르고, 같은 품사이며, 자기 자신과 같은 뜻 단어가 없다 (${enWrong.join(', ')})`);
  assert(built.questions.every(q => q.wrong_en?.length === 5 && !q.wrong_en.includes(q.prompt)) && !dungeonQuestions({ own: words.slice(0, 2), all: words.slice(0, 2) }, random).questions.length, 'V13.130 문제마다 영어 오답(wrong_en)이 붙는다(뜻 오답이 모자란 작은 단어장은 문제를 만들지 않는다)');

  /* ---------- 준비: 같은 학년 세 학교 학생, 다른 학년 · 중학생 ---------- */
  const state = emptyState();
  const hash = await passwordHash('QaDungeon1!');
  const SCHOOLS = { 'gangseo-high': '강서고', 'danwon-high': '단원고', 'wonil-middle': '원일중' };
  const student = (id, name, school, cls, extra = {}) => ({ id, username: id, display_name: name, role: 'student', active: true, class_name: cls, school_id: school, school: SCHOOLS[school], division: school.endsWith('middle') ? 'middle' : 'high', password_hash: hash, pets: [{ key: 'dog', form: 1 }], avatar_key: 'dog', created_at: Date.now(), ...extra });
  state.profiles.push(
    student('qa-dg-a', '가온', 'gangseo-high', '고1A'), student('qa-dg-b', '나래', 'gangseo-high', '고1B'), student('qa-dg-c', '다온', 'danwon-high', '고1A'),
    student('qa-dg-d', '라온', 'gangseo-high', '고1A'), student('qa-dg-x', '마루', 'gangseo-high', '고2A'), student('qa-dg-m', '바다', 'wonil-middle', '중2'),
    student('qa-dg-np', '사랑', 'gangseo-high', '고1A', { pets: [] })
  );
  migrateState(state);
  const t = {};
  for (const p of state.profiles) t[p.id] = (await service(state, 'POST', '/login', { username: p.username, password: 'QaDungeon1!', division: p.division }, null))._cookie;
  const call = (method, path, body, who) => service(state, method, path, body, t[who]);
  const rangesOf = async who => { const boot = await call('GET', '/bootstrap', {}, who); return [...new Set(boot.books.flatMap(b => b.words || []).map(w => String(w.range_code)))]; };
  const gRanges = await rangesOf('qa-dg-a'), dRanges = await rangesOf('qa-dg-c');
  assert(gRanges.length > 2 && dRanges.length > 2, 'V13.128 검사 준비: 학교마다 범위가 있다');

  /* ---------- 방 만들기 ---------- */
  await expectStatus(409, () => call('POST', '/dungeon/rooms', { cut: 'c2', range_codes: [gRanges[0]] }, 'qa-dg-a'), 'V13.128 열리지 않은 등급컷(2등급 컷)으로는 방을 만들 수 없다');
  await expectStatus(409, () => call('POST', '/dungeon/rooms', { cut: 'c3', range_codes: [gRanges[0]] }, 'qa-dg-np'), 'V13.128 펫이 없으면 던전에 들어갈 수 없다');
  const made = await call('POST', '/dungeon/rooms', { cut: 'c3', range_codes: [gRanges[0]] }, 'qa-dg-a');
  const room = made.room, msg = made._dungeon;
  assert(/^\d{6}$/.test(room.code) && room.ticket && room.is_host && room.members === 1, 'V13.128 방: 6자리 초대 코드, 방장 입장표');
  assert(msg.action === 'init' && msg.host.questions.length >= DUNGEON.POOL_MIN && msg.host.questions.every(q => q.wrong.length >= 5) && msg.grade === '고1' && msg.ticket === room.ticket, 'V13.128 방 준비 메시지에 방장 문제 풀(120단어 이상, 오답 5개씩)과 학년');
  // 메시지로 엔진 방을 실제로 만들 수 있다(DungeonRoom이 하는 것).
  const engine = createDungeon({ id: msg.id, cut: msg.cut, grade: msg.grade, host: msg.host.id, seed: msg.seed, now: Date.now() });
  join(engine, msg.host, Date.now());
  assert(engine.order[0] === 'qa-dg-a', 'V13.128 방장 정보로 엔진에 들어갈 수 있다');
  await expectStatus(409, () => call('POST', '/dungeon/rooms', { cut: 'c3', range_codes: [gRanges[0]] }, 'qa-dg-a'), 'V13.128 이미 방에 있으면 새 방을 만들 수 없다');
  const home = await call('GET', '/dungeon/home', {}, 'qa-dg-a');
  assert(home.room?.id === room.id && home.room.ticket === room.ticket && home.cuts.map(c => `${c.key}:${c.open}`).join() === 'c3:true,c2:false,c1:false,max:false', 'V13.128 던전 입구: 내 방(다시 들어가기)과 열린 등급컷');

  /* ---------- 친구 목록 · 초대 ---------- */
  const friends = (await call('GET', '/dungeon/friends', {}, 'qa-dg-a')).friends;
  const ids = friends.map(f => f.id);
  assert(['qa-dg-b', 'qa-dg-c', 'qa-dg-d'].every(id => ids.includes(id)) && !ids.includes('qa-dg-x') && !ids.includes('qa-dg-m') && !ids.includes('qa-dg-np'), 'V13.128 친구 목록: 같은 학년(다른 학교 포함), 다른 학년 · 중학생 · 펫 없는 학생은 없다');
  assert(ids[0] === 'qa-dg-d' && ids.indexOf('qa-dg-b') < ids.indexOf('qa-dg-c'), 'V13.128 내 반 → 우리 학교 → 다른 학교 순서');
  const invited = await call('POST', '/dungeon/invite', { friend_id: 'qa-dg-c' }, 'qa-dg-a');
  assert(invited._push?.[0]?.to?.[0] === 'qa-dg-c' && invited._push[0].url === '/?go=dungeon' && invited._push[0].body.includes(room.code), 'V13.128 초대는 푸시 알림(초대 코드, 던전 탭 링크)');
  assert((await call('POST', '/dungeon/invite', { friend_id: 'qa-dg-c' }, 'qa-dg-a'))._push.length === 0, 'V13.128 같은 친구에게 초대 알림은 3분에 한 번');
  await expectStatus(404, () => call('POST', '/dungeon/invite', { friend_id: 'qa-dg-x' }, 'qa-dg-a'), 'V13.128 다른 학년은 부를 수 없다');
  const cHome = await call('GET', '/dungeon/home', {}, 'qa-dg-c');
  assert(cHome.invites.length === 1 && cHome.invites[0].code === room.code && !cHome.invites[0].ticket, 'V13.128 받은 초대가 던전 입구에 보인다(입장표는 참가할 때 받는다)');

  /* ---------- 참가 ---------- */
  await expectStatus(404, () => call('POST', '/dungeon/join', { code: room.code, range_codes: [gRanges[0]] }, 'qa-dg-x'), 'V13.128 다른 학년은 코드가 있어도 들어갈 수 없다');
  await expectStatus(404, () => call('GET', '/dungeon/preview', { code: room.code }, 'qa-dg-m'), 'V13.128 중학생에게는 없는 방과 같다');
  const joined = await call('POST', '/dungeon/join', { code: room.code, range_codes: [dRanges[0]] }, 'qa-dg-c');
  assert(joined._dungeon.action === 'join' && joined._dungeon.player.id === 'qa-dg-c' && joined._dungeon.player.grade === '고1' && joined.room.ticket && joined.room.members === 2, 'V13.128 다른 학교 같은 학년 친구가 자기 범위 단어로 들어온다');
  const cWords = new Set(joined._dungeon.player.questions.map(q => q.word_id)), aWords = new Set(msg.host.questions.map(q => q.word_id));
  assert([...cWords].some(id => !aWords.has(id)), 'V13.128 파티원마다 자기 범위 문제');
  assert((await call('GET', '/dungeon/home', {}, 'qa-dg-c')).invites.length === 0, 'V13.128 들어간 방의 초대는 사라진다');
  const bot = await call('POST', '/dungeon/bot', {}, 'qa-dg-a');
  assert(bot._dungeon.player.bot === true && bot._dungeon.player.id === 'bot-1' && bot._dungeon.player.questions.length >= DUNGEON.POOL_MIN && bot.room.members === 3, 'V13.128 빈자리 봇 동료(방장 범위 단어)');
  await expectStatus(409, () => call('POST', '/dungeon/join', { code: room.code, range_codes: [gRanges[0]] }, 'qa-dg-b'), 'V13.128 3명이 차면 더 들어올 수 없다');
  await expectStatus(409, () => call('POST', '/dungeon/bot', {}, 'qa-dg-c'), 'V13.128 방장만 봇 동료를 부른다');
  // 방이 받지 못한 참가 · 봇은 되돌린다(워커가 undoDungeon을 부른다).
  const d = state.dungeons.find(x => x.id === room.id);
  undoDungeon(state, bot._dungeon);
  assert(d.bots === 0, 'V13.128 방이 거절한 봇 동료는 되돌린다');
  d.bots = 1;

  /* ---------- 결과: 한 번만, 보상 대상, 깬 등급컷 ---------- */
  const result = { cleared: true, cut: 'c3', size: 3, floor: 6, reached: 6, time_ms: 480000, record: false, no_down: true, report_id: `dungeon:${room.id}:123`,
    players: [{ id: 'qa-dg-a', name: '가온', right: 120, answered: 140, accuracy: .857, share: .4, reward: true }, { id: 'qa-dg-c', name: '다온', right: 100, answered: 130, accuracy: .77, share: .35, reward: true }, { id: 'bot-1', bot: true, right: 90, answered: 110, reward: false }, { id: 'qa-dg-x', right: 999, reward: true }] };
  assert(!settleDungeon(state, { id: room.id, report_id: 'other', result }), 'V13.128 report_id가 결과와 다르면 처리하지 않는다');
  assert(settleDungeon(state, { id: room.id, report_id: result.report_id, result }), 'V13.128 방의 결과를 처리한다');
  assert(!settleDungeon(state, { id: room.id, report_id: result.report_id, result }), 'V13.128 같은 결과가 다시 와도(재시도) 한 번만 처리한다');
  assert(d.status === 'finished' && d.result.players.length === 3 && d.result.players.find(x => x.id === 'qa-dg-x') === undefined, 'V13.128 결과는 파티 인원(3명)까지만');
  const a = state.profiles.find(x => x.id === 'qa-dg-a'), x = state.profiles.find(p => p.id === 'qa-dg-x');
  assert(a.dungeon_cleared?.join() === 'c3' && !x.dungeon_cleared, 'V13.128 깬 등급컷은 그 방 파티원만 기록');
  const after = await call('GET', '/dungeon/home', {}, 'qa-dg-a');
  assert(!after.room && after.cuts.find(c => c.key === 'c2').open && after.recent[0]?.cleared && after.recent[0].time_ms === 480000, 'V13.128 클리어하면 다음 등급컷이 열리고 최근 던전에 남는다');
  await expectStatus(404, () => call('POST', '/dungeon/join', { code: room.code, range_codes: [gRanges[0]] }, 'qa-dg-b'), 'V13.128 끝난 방에는 들어갈 수 없다');

  /* ---------- 나가기 · 2등급 컷 방에는 열린 학생만 · 정리 ---------- */
  const second = await call('POST', '/dungeon/rooms', { cut: 'c2', range_codes: [gRanges[0]] }, 'qa-dg-a');
  await expectStatus(409, () => call('POST', '/dungeon/join', { code: second.room.code, range_codes: [gRanges[0]] }, 'qa-dg-b'), 'V13.128 등급컷이 열리지 않은 친구는 그 방에 들어갈 수 없다');
  const left = await call('POST', '/dungeon/leave', {}, 'qa-dg-a');
  assert(left._dungeon?.action === 'leave' && left._dungeon.pid === 'qa-dg-a' && !(await call('GET', '/dungeon/home', {}, 'qa-dg-a')).room, 'V13.128 나가면 방에 알리고 새 방을 만들 수 있다');
  const second2 = state.dungeons.find(y => y.id === second.room.id);
  assert(settleDungeon(state, { id: second2.id, report_id: `dungeon:${second2.id}:closed`, cancelled: true, reason: 'host-left' }) && second2.status === 'cancelled', 'V13.128 방이 닫힌 것을 보고하면 취소로 정리');
  const later = Date.now() + 8 * 86400000;
  state.dungeons.push({ id: 'qa-old-open', code: '111111', status: 'open', members: ['qa-dg-b'], tickets: { 'qa-dg-b': 'x' }, created_at: Date.now() - 3 * 3600000 });
  assert(tidyDungeons(state, Date.now()) && state.dungeons.find(y => y.id === 'qa-old-open').status === 'cancelled' && !state.dungeons.find(y => y.id === 'qa-old-open').tickets, 'V13.128 보고 없이 2시간이 지난 방은 정리하고 입장표를 지운다');
  tidyDungeons(state, later);
  assert(state.dungeons.length === 0, 'V13.128 끝난 방 기록은 일주일 뒤 지운다(상태가 계속 커지지 않게)');
  assert(DUNGEON_LOBBY_MS === 15 * 60000 && DUNGEON_BOT_LIMIT === 2 && CUTS.c3, 'V13.128 로비 15분, 봇 동료 2명까지');

  /* ---------- 결과 보고 모아 처리하기(부하 시험으로 정함) ---------- */
  const runs = [];
  const batch = createBatcher(async items => { runs.push(items.slice()); await new Promise(resolve => setTimeout(resolve, 5)); return items.length; });
  const first = [batch(1), batch(2), batch(3)];
  await first[0];
  const next = [batch(4), batch(5)];
  await Promise.all([...first, ...next]);
  assert(runs.length === 2 && runs[0].join() === '1,2,3' && runs[1].join() === '4,5', `V13.128 같은 때 온 보고는 한 번의 변경으로 처리한다 (${JSON.stringify(runs)})`);
  let clones = 0;
  const fakeState = { profiles: [], dungeons: [{ id: 'r1', status: 'open', cut: 'c3', members: [] }, { id: 'r2', status: 'open', cut: 'c3', members: [] }] };
  const mutations = { current: () => ({ state: fakeState }), durable: async fn => { clones++; return fn(fakeState); } };
  const reporter = createDungeonReporter(mutations);
  const rep = id => ({ id, report_id: `dungeon:${id}:1`, result: { cleared: false, cut: 'c3', report_id: `dungeon:${id}:1`, players: [] } });
  await Promise.all([reporter(rep('r1')), reporter(rep('r2')), reporter(rep('r1'))]);
  assert(clones === 1 && fakeState.dungeons.every(x => x.status === 'finished'), `V13.128 몰린 보고 셋(중복 하나) → 상태 복사 한 번 (${clones}번)`);
  await reporter(rep('r1')); await reporter(rep('nope'));
  assert(clones === 1, 'V13.128 이미 처리한 보고 · 없는 방의 보고는 상태를 복사하지 않고 바로 끝낸다');
  const stress = source('./stress-check.mjs'), load = source('./dungeon-load.mjs');
  assert(stress.includes('runDungeonLoadCheck({ parties: 10 })') && stress.includes('runDungeonLoadCheck({ parties: 40 })') && load.includes('targetKB = 2400') && source('../cloudflare/worker.mjs').includes('createDungeonReporter('), 'V13.128 check:load에 던전 시나리오(한 반 · 여러 반, 운영 크기 상태), 워커는 모아서 처리');

  /* ---------- 방 · 워커 · 화면 연결 ---------- */
  const wrangler = source('../wrangler.jsonc'), worker = source('../cloudflare/worker.mjs'), room2 = source('../cloudflare/dungeon-room.mjs');
  assert(/"name": "DUNGEON_ROOM",\s*"class_name": "DungeonRoom"/.test(wrangler) && /"tag": "v3",\s*"new_sqlite_classes": \[\s*"DungeonRoom"\s*\]/.test(wrangler), 'V13.128 wrangler: DUNGEON_ROOM 바인딩과 v3 마이그레이션(새 SQLite 클래스)');
  assert(worker.includes('export { DungeonRoom }') && worker.includes("/^\\/api\\/dungeon\\/ws\\/([0-9a-f-]{36})$/") && worker.includes("'/api/internal/dungeon-result'") && worker.includes("'X-Dungeon-Key'") && worker.includes('undoDungeon(state, message)') && worker.includes('delete result._dungeon'), 'V13.128 워커: 던전 소켓은 방으로, 결과 보고는 키가 있어야, 방이 거절하면 되돌리고, _dungeon은 응답에서 지운다');
  assert(worker.indexOf("url.pathname.startsWith('/api/internal/')") < worker.indexOf('dungeonSocket'), 'V13.128 /api/internal/은 바깥에서 막힌다(방만 결과를 보고)');
  assert(room2.includes('acceptWebSocket') && room2.includes('setAlarm') && room2.includes('reportRetryMs') && room2.includes('report_id'), 'V13.128 방: 하이버네이션 소켓, 알람, 보고 재시도, report_id');
  const ui = source('../public/modules/dungeon.js'), battle = source('../public/modules/battle.js'), app = source('../public/app.js');
  assert(/send\(\{ type: 'answer', choice, n: q\.n \}\)/.test(ui) && !/\.answer\b(?!ed)/.test(ui.replace(/e\.answer/g, '')), 'V13.128 화면은 선택 번호와 문제 번호만 보낸다(정답 번호는 받지 않는다)');
  assert(ui.includes("from './battle-fx.js'") && ui.includes('reduced()') && ui.includes('/assets/monsters/'), 'V13.128 전투 효과는 battle-fx.js, 움직임 줄이기 존중, 임시 그림은 기존 몬스터 그림');
  assert(/land: \{[^\n]*boss: 430/.test(ui) && /port: \{[^\n]*boss: 430/.test(ui), 'V13.128 보스는 정사각 430px 안팎으로 크게(설계 5번, V13.130: 세로 · 가로 무대 모두)');
  /* ---------- V13.130 전투 무대 ---------- */
  const fx = source('../public/modules/dungeon-fx.js'), css129 = source('../public/v13130.css'), sound = source('../public/modules/sound.js');
  assert(ui.includes("innerWidth > innerHeight ? 'land' : 'port'") && ui.includes("land: { w: 844, h: 390") && ui.includes("port: { w: 390, h: 844") && ui.includes("addEventListener('resize', D.onResize)") && ui.includes('stage.style.transform = `scale(${s})`') && css129.includes('.dgs.land { width: 844px; height: 390px; }') && css129.includes('.dgs.port { width: 390px; height: 844px; }'), 'V13.130 폰을 세우면 세로(390×844), 눕히면 가로(844×390) 무대를 그리고 화면에 맞춰 키운다(돌리면 바로 바뀐다)');
  assert(css129.includes('.dgs.land .dgs-party {') && css129.includes('.dgs-party { display: none; }') && ui.includes("D.mode === 'land'") && ui.includes('dgs-rooms') && css129.includes('.dgs.land .dgs-alert {'), 'V13.130 가로에만 파티 창 · 층 지도가 있고, 채점 표적 · 핵은 보스 체력 아래 막대로(세로는 카드)');
  assert(ui.includes("send({ type: 'letter', ch: q.tiles[i], n: q.n })") && ui.includes("case 'letter':") && ui.includes('D.spell.queue.shift()') && ui.includes("data-dg=\"tile\"") && !ui.includes('q.word') && ui.includes('e.word'), 'V13.130 영어 쓰기: 누른 글자 하나와 문제 번호만 보내고, 방의 letter 이벤트로 칸을 쓰거나 흔든다(정답 철자는 끝난 뒤 answered 이벤트로만)');
  assert(ui.includes("KIND_LABEL = { mean: '뜻 고르기', eng: '영어 고르기', spell: '영어 쓰기' }") && ui.includes("class=\"dgs-kind ${kind}\""), 'V13.130 문제 칸에 문제 종류(뜻 고르기 · 영어 고르기 · 영어 쓰기)를 보여 준다');
  assert(ui.includes("from './dungeon-fx.js'") && fx.includes('MAX_PARTS = 420') && fx.includes('if (reduced() || parts.length >= MAX_PARTS) return;') && fx.includes("if (reduced()) { onHit?.(); return; }") && ui.includes("split(e.damage, 6)") && ui.includes("D.cutinUntil"), 'V13.130 펫 속성별 발사체 · 맞는 순간 효과(조각 420개까지, 움직임 줄이기면 그리지 않고 바로 맞음), 피해 숫자는 방이 계산한 값 그대로 쌓고 합동 필살은 컷인 뒤에 터진다');
  assert(ui.includes('/assets/dungeon/${file}.webp') && ui.includes("'bg-boss'") && ui.includes("monSrc(m.key, idlePose(m))") && ui.includes("return 'core'") && ui.includes("return 'rage'") && ui.includes("'idle2'") && ui.includes("/assets/ui/dungeon-mark.webp") && ui.includes("/assets/ui/dungeon-faint.webp"), 'V13.130 던전 배경(층 · 보스방 · 끝없는 탑), 몬스터 자세(숨쉬기 · 분노 · 핵 · 맞음 · 공격 · 포효), UI 그림(채점 표적 · 기절 · 핵 · 브레이크 · 모래시계)을 쓴다');
  assert(css129.includes("font-family: 'Jua'") && css129.includes("/assets/fonts/jua-latin.woff2") && css129.includes('unicode-range') && source('../public/assets/fonts/Jua-OFL.txt').includes('SIL Open Font License') && source('./index.mjs').includes("'.woff2': 'font/woff2'"), 'V13.130 전투 글자(숫자 · 단어)는 주아 글꼴(OFL, 영어 · 한글 나눠서 쓰는 화면에서만 받는다)');
  assert(sound.includes("'boss-slam': .9") && css129.includes('@media (prefers-reduced-motion: reduce)'), 'V13.130 전투 효과음 · 움직임 줄이기');
  assert(battle.includes("['dungeon', '던전', 'dungeon-tab']") && battle.includes('openDungeon(A, exit)') && app.includes("if (go === 'dungeon')"), 'V13.128 야차전 탭의 던전 메뉴와 초대 알림 링크');
}
