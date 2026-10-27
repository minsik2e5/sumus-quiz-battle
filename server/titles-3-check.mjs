// V13.184 검사: 칭호 3탄 28개(docs/titles-plan.md). 키 · 이름 · 등급 · 조건(직전 미달 / 딱 달성), 코인 표,
// 빈칸영작 칭호는 고등 도감에서 숨김, 어법 최고값(gram_best) 유지, 몬스터 하루 승은 날짜가 바뀌면 0부터,
// 소급 지급은 한 장 묶음 카드로 한 번만(코인 합계 · 푸시 없음), titles_seen 240, 메달 그림 28 × 2 · TITLE_ART 연결, 응답에 정답 힌트 없음.
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { TITLES, TITLES_3, TITLE_KEYS, titleUnlocked, titleProgress, titleCoins, visibleTitleKeys, weeklyTitle, LEVEL_TITLES_AFTER_100 } from '../public/modules/titles.js';
import { TITLE_ART, titleEmblem } from '../public/modules/emblems.js';
import { blankGroup, blankKey } from '../public/modules/blank-rules.js';
import { monsterDayWin, blankTitleStats, gramTitleStats, rememberGramBest } from './titles-3.mjs';
import { rewardIncome } from './rewards.mjs';
import { createCompetition } from './competition.mjs';
import { emptyState } from './state.mjs';
import { passwordHash } from './auth.mjs';
import { service, TITLES_SEEN_MAX } from './service.mjs';

const source = path => readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8');
const DAY = 86400000;
// 문서 표 그대로: [키, 이름, 등급, stat, 수치, 코인]
const TABLE = [
  ['level65', '한계 돌파', 'epic', 'level', 65, 60],
  ['level70', '일흔 계단', 'epic', 'level', 70, 60],
  ['level75', '단어 곳간지기', 'epic', 'level', 75, 60],
  ['level80', '불꽃 학습자', 'legendary', 'level', 80, 120],
  ['level85', '별빛 여행자', 'legendary', 'level', 85, 120],
  ['level90', '지식의 탑', 'legendary', 'level', 90, 120],
  ['level95', '전설 직전', 'legendary', 'level', 95, 120],
  ['level100', '백 레벨의 전설', 'limited', 'level', 100, 200],
  ['mlv10', '야자 탈출', 'common', 'monster_best', 10, 10],
  ['mday3', '몬스터 세 끼', 'common', 'monster_day_best', 3, 10],
  ['mlv30', '들판 무법자', 'rare', 'monster_best', 30, 30],
  ['boss3', '보스 퇴근 도우미', 'rare', 'boss_wins', 3, 30],
  ['mlv50', '밤도깨비 퇴치반', 'epic', 'monster_best', 50, 60],
  ['mlv70', '보스 단톡방 방장', 'legendary', 'monster_best', 70, 120],
  ['blank1', '빈칸 메우미', 'common', 'blank_done', 1, 10],
  ['blank5', '5과 빈칸 땜장이', 'rare', 'blank_l5', 20, 30],
  ['blank6', '6과 빈칸 미장이', 'rare', 'blank_l6', 20, 30],
  ['blank7', '7과 빈칸 목수', 'rare', 'blank_l7', 20, 30],
  ['blankperfect', '한 번에 딱!', 'epic', 'blank_perfect', 10, 60],
  ['blanks5', '영작 폭주족', 'epic', 'blank_s5', 6, 60],
  ['blankall', '빈칸 없는 세상', 'legendary', 'blank_done', 60, 120],
  ['gram1', '어법 첫 감별', 'common', 'gram_mastered', 1, 10],
  ['gram10', '어법 감별사', 'rare', 'gram_mastered', 10, 30],
  ['gramclean', '오답 실종 사건', 'epic', 'gram_clean', 5, 60],
  ['gram30', '문법 명탐정', 'epic', 'gram_mastered', 30, 60]
];
const PET3 = ['epic-collector', 'legend-owner', 'epic-dex'];
const BLANK_KEYS = ['blank1', 'blank5', 'blank6', 'blank7', 'blankperfect', 'blanks5', 'blankall'];

export async function runTitles3Checks(assert) {
  // ---- 28개 표: 키 · 이름 · 등급 · 조건 · 코인
  assert(TITLES_3.length === 25 && TITLES_3.join() === TABLE.map(r => r[0]).join() && TABLE.every(([key, name, tier, stat, goal, coins]) => TITLES[key] && TITLES[key].name === name && TITLES[key].tier === tier && TITLES[key].stat === stat && TITLES[key].goal === goal && titleCoins(key) === coins),
    'V13.184 칭호 3탄 25개는 문서 표의 키 · 이름 · 등급 · 조건 · 코인 그대로');
  assert(PET3.every(key => TITLES[key] && !TITLES_3.includes(key)) && TITLES['epic-collector'].tier === 'epic' && TITLES['legend-owner'].tier === 'legendary' && TITLES['epic-dex'].tier === 'legendary',
    'V13.184 펫 수집 3개는 새로 만들지 않고 V13.182 칭호(영웅 · 전설 · 전설) 그대로');
  assert(TITLE_KEYS.length === 151 && new Set(TITLE_KEYS.map(key => TITLES[key].name)).size === TITLE_KEYS.length - 1 /* 옛 뽑기 '황금 손'과 인형뽑기 '황금 손' */,
    'V13.184 칭호는 모두 151개(지금 126 + 3탄 25), 이름은 겹치지 않는다(Lv.75는 "단어 곳간지기")');
  assert(TITLES.level75.name !== TITLES.words500.name, 'V13.184 Lv.75 이름은 기존 "단어 수집가"와 다르다');
  // 조건 경계: 직전 미달 / 딱 달성
  assert(TABLE.every(([key, , , stat, goal]) => !titleUnlocked(key, { [stat]: goal - 1 }) && titleUnlocked(key, { [stat]: goal }) && titleProgress(key, { [stat]: goal - 1 })?.join() === `${goal - 1},${goal}`),
    'V13.184 3탄 칭호마다 조건 직전에는 없고 딱 달성하면 얻는다(진행 막대도 있다)');
  // Lv.100: 한정 테두리 · once · 200코인
  assert(TITLES.level100.once && !weeklyTitle('level100') && titleCoins('level100') === 200 && TITLES.level100.num === 100, 'V13.184 Lv.100은 한정(무지개) 테두리, 한 번 받으면 계속(once), 코인 200, 메달 앞판에 100');
  // backlog 규칙: Lv.65부터 5레벨마다 stat level
  const levels = TITLE_KEYS.filter(key => TITLES[key].stat === 'level' && TITLES[key].goal >= 65).map(key => TITLES[key].goal).sort((a, b) => a - b);
  assert(levels.length >= 8 && levels.every((lv, i) => lv === 65 + 5 * i), 'V13.184 레벨 칭호는 Lv.65부터 5레벨마다 하나씩(stat level)');
  assert(Object.keys(LEVEL_TITLES_AFTER_100).every(lv => TITLES[`level${lv}`]?.art === 'level100' && TITLES[`level${lv}`].num === Number(lv)) && source('../public/modules/emblems.js').includes("const a = t.art && TITLE_ART.has(t.art) ? t.art : k") && source('../public/v13184.css').includes('.tt-emblem .tt-num{'),
    'V13.184 Lv.105부터는 새 그림 없이 level100 메달 + 레벨 숫자');
  {
    TITLES.level105 = { ...TITLES.level95, tier: 'legendary', goal: 105, art: 'level100', num: 105 };
    const e = titleEmblem('level105', { size: 'md' });
    delete TITLES.level105;
    assert(e.includes('/assets/titles/level100.webp') && e.includes('<b class="tt-num">105</b>') && e.includes('has-num') && titleEmblem('level100', { size: 'lg' }).includes('<b class="tt-num">100</b>') && !titleEmblem('level95', { size: 'md' }).includes('tt-num'),
      'V13.184 숫자를 얹는 메달: level100 그림을 빌려 쓰고 앞판에 레벨 숫자');
  }

  // ---- 코인 표(문서와 같다)
  const sum = keys => keys.reduce((n, key) => n + titleCoins(key), 0);
  assert(sum(TITLES_3.slice(0, 8)) === 860 && sum(TITLES_3.slice(8, 14)) === 260 && sum(BLANK_KEYS) === 340 && sum(['gram1', 'gram10', 'gramclean', 'gram30']) === 160 && sum(TITLES_3) === 1620 && sum(PET3) === 300,
    'V13.184 코인: 레벨 860 · 몬스터전 260 · 빈칸영작 340 · 어법 160 = 1,620 (펫 수집 3개 300)');

  // ---- 빈칸영작 칭호는 중등만: 고등 도감에서 숨김
  const high = visibleTitleKeys(['rookie'], { middle: false }), middle = visibleTitleKeys(['rookie'], { middle: true });
  assert(BLANK_KEYS.every(key => TITLES[key].middle && !high.includes(key) && middle.includes(key)) && TITLES_3.filter(key => !BLANK_KEYS.includes(key)).every(key => !TITLES[key].middle && high.includes(key)) && high.length === middle.length - 7 && visibleTitleKeys(['rookie', 'blank1'], { middle: false }).includes('blank1'),
    'V13.184 빈칸영작 칭호 7개는 고등 학생 도감에서 숨기고(가지고 있으면 보인다) 중등은 모두 보인다');
  assert(source('../public/modules/titles-ui.js').includes("visibleTitleKeys(unlocked, { middle: A.data?.profile?.division === 'middle' })") && !/visibleTitleKeys\((t\.unlocked|u|titleState\(A\)\.unlocked)\)/.test(source('../public/modules/titles-ui.js')),
    'V13.184 칭호 도감 · 칭호 수 · 첫 소개가 모두 중등 여부로 거른다');

  // ---- 몬스터 세 끼: 하루 3승, 날짜가 바뀌면 0부터
  {
    const t0 = Date.parse('2026-10-27T03:00:00Z'), m = {};
    monsterDayWin(m, t0); monsterDayWin(m, t0 + 1000);
    assert(m.dw.n === 2 && m.dw.b === 2 && !titleUnlocked('mday3', { monster_day_best: m.dw.b }), 'V13.184 하루 2승은 몬스터 세 끼가 아니다');
    monsterDayWin(m, t0 + DAY);
    assert(m.dw.n === 1 && m.dw.b === 2 && m.dw.d !== undefined, 'V13.184 날짜가 바뀌면 오늘 승은 0부터(최다는 남는다)');
    monsterDayWin(m, t0 + DAY + 1); monsterDayWin(m, t0 + DAY + 2);
    assert(m.dw.n === 3 && m.dw.b === 3 && Object.keys(m.dw).join() === 'd,n,b' && createCompetition(emptyState()).titleStats({ id: 'x', bonus: { monster: m } }).monster_day_best === 3, 'V13.184 같은 날 3승이면 하루 최다 3(저장은 d · n · b 셋뿐)');
    const rw = source('./rewards.mjs');
    assert(/if \(won\) \{[^\n]*monsterDayWin\(m, now\); \}/.test(rw) && rw.indexOf('monsterDayWin(m, now)') < rw.indexOf("if (Number(m.count || 0) >= MONSTER_DAILY) return { paid: false, reason: 'daily'"),
      'V13.184 몬스터전 끝 보고에서 이긴 판마다 센다(하루 코인 상한을 넘은 판도)');
    assert(createCompetition(emptyState()).titleStats({ id: 'y', bonus: { monster: { best: 49 } } }).monster_best === 49 && !titleUnlocked('mlv50', { monster_best: 49 }), 'V13.184 몬스터전 최고 레벨은 m.best(하드까지 깬 레벨)');
  }

  // ---- 빈칸영작: 60칸 = 5 · 6 · 7과 × 본문 4 × 단계 5, 레슨 칭호는 20칸 모두
  {
    const groups = [5, 6, 7].flatMap(l => [1, 2, 3, 4].map(g => `${l}-${g}`));
    assert(groups.every(id => blankGroup(id)), 'V13.184 빈칸영작 본문은 5 · 6 · 7과 × 4개');
    const all = Object.fromEntries(groups.flatMap(g => [1, 2, 3, 4, 5].map(s => [blankKey(g, s), 1])));
    const l5 = Object.fromEntries(Object.entries(all).filter(([k]) => k.startsWith('5-')));
    const l5less = { ...l5 }; delete l5less[blankKey('5-4', 5)];
    const s = done => blankTitleStats({ blank: { done } });
    assert(s(l5less).blank_l5 === 19 && !titleUnlocked('blank5', s(l5less)) && titleUnlocked('blank5', s(l5)) && !titleUnlocked('blank6', s(l5)) && s(all).blank_done === 60 && titleUnlocked('blankall', s(all)) && s(all).blank_s5 === 12,
      'V13.184 5과 칭호는 5과 20칸 모두(19칸은 아님), 60칸이면 빈칸 없는 세상');
    const rate = Object.fromEntries(Object.keys(all).slice(0, 10).map((k, i) => [k, i ? 100 : 99]));
    assert(blankTitleStats({ blank: { rate } }).blank_perfect === 9 && blankTitleStats(null).blank_done === 0, 'V13.184 한 번에 딱!은 1차 정답률 100인 칸만 센다');
  }

  // ---- 어법: 최고값 기억(gram_best), 지문 기록을 지워도 칭호 유지
  {
    const passages = { a: { mastered: true, first_rate: 100 }, b: { mastered: true, first_rate: 80 }, c: { mastered: false, first_rate: 100 } };
    const p = {};
    assert(gramTitleStats(p, passages).gram_mastered === 2 && gramTitleStats(p, passages).gram_clean === 1, 'V13.184 어법: 완성 지문 · 1차 100점 완성 지문을 센다(완성 안 한 지문은 아님)');
    rememberGramBest(p, passages);
    assert(p.gram_best.m === 2 && p.gram_best.c === 1 && gramTitleStats(p, {}).gram_mastered === 2 && Object.keys(p.gram_best).join() === 'm,c', 'V13.184 지문 기록이 줄어도 최고값(gram_best = { m, c })으로 유지');
    assert(!rememberGramBest({}, {}) , 'V13.184 어법 기록이 없는 학생에게는 새 키를 만들지 않는다');
  }

  // ---- 그림: 28개 × 2, TITLE_ART 연결, slice-map 줄
  {
    const map = source('../docs/asset-requests/runner/slice-map.csv').split('\n').filter(line => /^"5[012]-titles/.test(line));
    const keys28 = [...TITLES_3, ...PET3];
    assert(keys28.length === 28 && keys28.every(key => TITLE_ART.has(key) && existsSync(fileURLToPath(new URL(`../public/assets/titles/${key}.webp`, import.meta.url))) && existsSync(fileURLToPath(new URL(`../public/assets/titles/${key}-s.webp`, import.meta.url))) && map.some(line => line.endsWith(`"public/assets/titles/${key}.webp"`))) && map.length === 28,
      'V13.184 3탄 메달 28개마다 그림(256 · 96)이 있고 TITLE_ART와 그림 주문서(slice-map 50 · 51 · 52)에 있다');
    assert(!existsSync(fileURLToPath(new URL('../public/assets/titles/preview-52.webp', import.meta.url))), 'V13.184 확인용 합본 그림(preview-52)은 넣지 않는다');
    assert(['claw1', 'claw6', 'claw12', 'clawgold', 'claw100', 'timing-clock', 'timing-ten', 'timing-human'].every(key => !TITLE_ART.has(key)), 'V13.184 인형뽑기 · 10초 맞추기 칭호는 그림이 없어 아직 SVG 메달');
    const prompts = ['50-titles-level', '51-titles-3a', '52-titles-3b'].map(n => source(`../docs/asset-requests/runner/${n}.txt`)).join('\n');
    const frames = { common: 'mint-silver rim', rare: 'HEXAGON badge', epic: 'SHIELD-shaped crest', legendary: 'ROUND GOLD medal', limited: 'RAINBOW holographic rim' };
    assert(Object.entries(frames).every(([tier, phrase]) => prompts.split(phrase).length - 1 === keys28.filter(key => TITLES[key].tier === tier).length),
      'V13.184 그림 주문서의 등급 테두리 문장 수 = 등급별 칭호 수(일반 민트 · 희귀 육각형 · 영웅 방패 · 전설 금빛 · 한정 무지개)');
  }

  // ---- titles_seen 240
  assert(TITLES_SEEN_MAX === 240 && source('./service.mjs').includes('.slice(0, TITLES_SEEN_MAX);') && !source('./service.mjs').includes('.slice(0, 160);') && TITLE_KEYS.length < TITLES_SEEN_MAX,
    'V13.184 학생이 본 칭호 기록은 240개까지(칭호가 150개를 넘음)');

  // ---- 서버 경로: 소급 지급은 한 장 묶음 카드로 한 번만, 코인 합계, 푸시 없음, 어법 기록 지워도 유지, 응답에 정답 힌트 없음
  {
    const state = emptyState(), hash = await passwordHash('QaTitles3!'), now = Date.now();
    const base = { role: 'student', active: true, password_hash: hash, avatar_key: 'dog', created_at: now - 30 * DAY, pets: [{ key: 'dog', first: true, acquired_at: now - 30 * DAY }] };
    // 배포 전부터 몬스터전 레벨 30 · 하루 3승 · 빈칸 5과를 채운 중등 학생. 예전 칭호는 이미 봤다.
    const done5 = Object.fromEntries([1, 2, 3, 4].flatMap(g => [1, 2, 3, 4, 5].map(s => [blankKey(`5-${g}`, s), now - DAY])));
    state.profiles.push({ ...base, id: 'qa-t3', username: 'qa-t3', display_name: '중등', class_name: '중3', school_id: 'wonil-middle', school: '원일중', division: 'middle',
      bonus: { monster: { best: 30, wins: 40, dw: { d: '2026-10-01', n: 3, b: 3 } } }, blank: { done: done5, rate: {} }, titles_seen: ['rookie', 'monster1', 'monster10'], title_reward: { total: 40, keys: ['monster1', 'monster10'] } });
    state.profiles.push({ ...base, id: 'qa-t3h', username: 'qa-t3h', display_name: '고등', class_name: '고1A', school_id: 'danwon-high', school: '단원고', division: 'high', titles_seen: ['rookie'] });
    const login = async (u, division) => (await service(state, 'POST', '/login', { username: u, password: 'QaTitles3!', division }, null))._cookie;
    const tok = await login('qa-t3', 'middle'), tokH = await login('qa-t3h', 'high');
    const call = (token, method, path, body = {}) => service(state, method, path, body, token);
    const me = state.profiles.find(x => x.id === 'qa-t3');
    const want = ['mlv10', 'mday3', 'mlv30', 'boss3', 'blank1', 'blank5'];
    const boot = await call(tok, 'GET', '/bootstrap');
    const t = boot.titles;
    assert(t && want.every(key => t.unlocked.includes(key) && t.fresh.includes(key)) && t.batch.join() === want.join() && !t.intro, 'V13.184 배포 직후: 이미 조건을 채운 3탄 칭호 6개가 묶음 카드(batch)로 온다');
    const coins = want.reduce((n, key) => n + titleCoins(key), 0), before = rewardIncome(me);
    const seen1 = await call(tok, 'POST', '/titles/seen', { keys: t.batch });
    assert(coins === 120 && seen1.paid_coins === coins && rewardIncome(me) === before + coins && !seen1._push && me.title_reward.total === 40 + coins, 'V13.184 묶음 카드를 보면 코인을 한 번에 합쳐 준다(10 + 10 + 30 + 30 + 10 + 30 = 120), 푸시 없음, 코인 기록(title_reward)에 남는다');
    const boot2 = (await call(tok, 'GET', '/bootstrap')).titles;
    const seen2 = await call(tok, 'POST', '/titles/seen', { keys: t.batch });
    assert(!boot2.batch.length && want.every(key => !boot2.fresh.includes(key)) && seen2.paid_coins === 0 && me.title_reward.total === 40 + coins, 'V13.184 소급 지급은 한 번만(다시 보내도 코인 0, 다시 묶이지 않는다)');
    // 그 뒤에 새로 얻는 3탄 칭호는 원래처럼 하나씩 팝업
    await call(tok, 'PATCH', '/grammar-progress/qa-t3-g1', { sentence_count: 5, choice_count: 10, completed_sentences: 5, first_rate: 100, mastered: true });
    const boot3 = (await call(tok, 'GET', '/bootstrap')).titles;
    assert(!boot3.batch.length && boot3.fresh.includes('gram1') && me.gram_best?.m === 1 && me.gram_best.c === 1, 'V13.184 그 뒤 새로 얻은 칭호(어법 첫 감별)는 묶이지 않고 원래 팝업, 어법 최고값을 저장 때 같이 기억');
    await call(tok, 'POST', '/titles/seen', { keys: ['gram1'] });
    await call(tok, 'PATCH', '/grammar-progress/qa-t3-g1', { reset: true });
    const boot4 = (await call(tok, 'GET', '/bootstrap')).titles;
    assert(!Object.keys(state.grammarProgress['qa-t3'] || {}).length && boot4.unlocked.includes('gram1') && boot4.stats.gram_mastered === 1, 'V13.184 어법 지문 기록을 지워도 어법 첫 감별은 그대로');
    // 한 개만 새로 얻은 학생은 묶음 카드가 아니다
    const hb = (await call(tokH, 'GET', '/bootstrap')).titles;
    assert(!hb.batch.length && !BLANK_KEYS.some(key => hb.unlocked.includes(key)), 'V13.184 3탄 칭호가 없는(또는 하나뿐인) 학생에게는 묶음 카드가 없다');
    // 응답에 정답 힌트 없음: 칭호 데이터는 숫자뿐이고 빈칸 답 · 어법 답이 실리지 않는다
    const text = JSON.stringify([t, boot2, boot3, boot4, seen1]);
    assert(Object.values(t.stats).every(v => typeof v === 'number') && !/answers|wrong_keys|"en"|"ko"|choice/.test(text), 'V13.184 칭호 응답에는 숫자 기록만 있고 정답 힌트가 없다');
    // titles_seen이 160을 넘어도 잘리지 않는다
    me.titles_seen = Array.from({ length: 200 }, (_, i) => `old${i}`);
    await call(tok, 'POST', '/titles/seen', { all: true });
    assert(me.titles_seen.length > 200 && me.titles_seen.length <= TITLES_SEEN_MAX, 'V13.184 본 칭호가 160개를 넘어도 240까지 남는다');
  }

  // ---- 화면: 묶음 카드는 한 장, 하나하나 팝업이 연달아 뜨지 않는다
  {
    const ui = source('../public/modules/titles-ui.js');
    assert(ui.includes('function batchMoment(') && ui.includes('칭호 ${keys.length}개가 한꺼번에 도착!') && ui.includes('else if (batch.length >= 2) batchMoment(A, batch, onChanged);') && ui.indexOf('batchMoment(A, batch') < ui.indexOf('unlockMoment(A, fresh.slice(0, 5)') && ui.includes('await closeAfter(A, { keys });'),
      'V13.184 소급 지급 묶음 카드: 한 장에 메달을 나열하고, 받은 칭호를 한 번에 본 것으로 보내 코인을 합쳐 받는다');
    assert(source('./build-assets.mjs').includes('"v13184.css",\n  "v13178.css"'), 'V13.184 칭호 3탄 CSS(숫자 메달 · 묶음 카드)는 번들에 들어가고 민트 목록 CSS가 맨 끝');
  }
}
