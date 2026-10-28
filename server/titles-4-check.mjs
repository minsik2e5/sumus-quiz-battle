// V13.191 검사: 칭호 4탄 24개(docs/titles-plan-4.md). 키 · 이름 · 등급 · 묶음 · 조건(직전 미달 / 딱 달성), 코인 표, 새 묶음 '낚시',
// 새 기록 키 넷(p.reel.dc · p.care.dn · p.timing.pw · p.range_best)이 작고 서버 값으로만 쌓임, 월척은 게임 월척(trophyOf)과 같은 기준,
// 모의고사 칭호는 모의고사 책이 있는 학교만 보임, 심해 칭호는 심해 그림이 다 있을 때만 보임, 주간 초시계왕(지난주 학년 묶음 1위),
// 소급 지급 묶음 카드(3탄 다음 4탄, 한 번만 · 코인 합계 · 푸시 없음), 메달 그림 24 × 2 · TITLE_ART 연결, titles_seen 240.
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { TITLES, TITLES_3, TITLES_4, TITLE_KEYS, TITLE_GROUPS, titleUnlocked, titleProgress, titleCoins, visibleTitleKeys, weeklyTitle, DEEP_TITLES_READY } from '../public/modules/titles.js';
import { TITLE_ART } from '../public/modules/emblems.js';
import { FISH, FISH_KEYS, DEEP_KEYS } from '../public/modules/fishing-rules.js';
import { FISH_READY } from '../public/modules/fish-art.js';
import { trophyOf } from '../public/modules/reel-feel.js';
import { MONSTER_KEYS, HUNT_MONSTERS } from '../public/modules/hunt-rules.js';
import { LEGEND_EGG_PRICE } from '../public/modules/core.js';
import { reelDayCatch, keepTimingLastWeek, timingWeekOf, timingWeekKings, fishTitleStats, huntTitleStats, coinEarned, coinSpent, rangeCounts, rangeTitleStats, rememberRangeBest, petTitleStats } from './titles-4.mjs';
import { reelCast, reelLand } from './reel.mjs';
import { petCare, rewardIncome } from './rewards.mjs';
import { createCompetition, rankingWeek } from './competition.mjs';
import { emptyState } from './state.mjs';
import { passwordHash } from './auth.mjs';
import { service, allBooks, TITLES_SEEN_MAX } from './service.mjs';

const source = path => readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8');
const DAY = 86400000;
// 문서 표 그대로: [키, 이름, 등급, 묶음, stat, 수치, 코인]
const TABLE = [
  ['fishkg', '월척이다!', 'common', 'fishing', 'fish_trophy', 1, 10],
  ['fishbook12', '물고기 반장', 'rare', 'fishing', 'fish_kinds', 12, 30],
  ['fishday10', '오늘 회식은 나야', 'rare', 'fishing', 'fish_day_best', 10, 30],
  ['deep1', '심해 첫 손님', 'rare', 'fishing', 'deep_kinds', 1, 30],
  ['fishlegend', '전설을 낚았다', 'epic', 'fishing', 'fish_legend', 1, 60],
  ['rod5', '낚싯대 풀강', 'epic', 'fishing', 'reel_rod', 5, 60],
  ['fishall', '수산시장 사장님', 'legendary', 'fishing', 'fish_shore', 24, 120],
  ['deepall', '심해 탐사대장', 'legendary', 'fishing', 'deep_kinds', 8, 120],
  ['range1', '범위 한 바퀴', 'common', 'study', 'range_cover', 1, 10],
  ['mockcover', '외부지문 완주', 'rare', 'study', 'mock_cover', 1, 30],
  ['mockclear', '모의고사 씹어먹기', 'epic', 'study', 'mock_clear', 1, 60],
  ['rangeall', '시험 범위 올킬', 'legendary', 'study', 'range_all', 1, 120],
  ['coin1k', '티끌 모아 천 코인', 'common', 'collect', 'coin_earned', 1000, 10],
  ['gift20', '선물 자석', 'rare', 'collect', 'gifts', 20, 30],
  ['broke', '통장 텅장', 'epic', 'collect', 'coin_spent', 10000, 60],
  ['coin30k', '걸어다니는 금고', 'legendary', 'collect', 'coin_earned', 30000, 120],
  ['petname', '작명소 사장님', 'common', 'collect', 'pet_named', 1, 10],
  ['petfinal', '다 컸네!', 'rare', 'collect', 'pet_best_level', 20, 30],
  ['care100', '100일 집사', 'epic', 'collect', 'care_days', 100, 60],
  ['petmax', '만렙 펫의 보호자', 'legendary', 'collect', 'pet_best_level', 60, 120],
  ['huntplace', '우리 동네 터줏대감', 'rare', 'monster', 'hunt_place_best', 9, 30],
  ['huntnight', '올빼미 포획단', 'epic', 'monster', 'hunt_night', 9, 60],
  ['huntall', '몬스터 동사무소장', 'legendary', 'monster', 'hunt_kinds', 70, 120],
  ['timingweek', '주간 초시계왕', 'limited', 'arcade', 'timing_week_king', 1, 60]
];
const FISHING = TABLE.filter(r => r[3] === 'fishing').map(r => r[0]);
const MOCK = ['mockcover', 'mockclear'], DEEP = ['deep1', 'deepall'];

export async function runTitles4Checks(assert) {
  // ---- 24개 표: 키 · 이름 · 등급 · 묶음 · 조건 · 코인
  assert(TITLES_4.length === 24 && TITLES_4.join() === TABLE.map(r => r[0]).join() && TABLE.every(([key, name, tier, group, stat, goal, coins]) => TITLES[key] && TITLES[key].name === name && TITLES[key].tier === tier && TITLES[key].group === group && TITLES[key].stat === stat && TITLES[key].goal === goal && titleCoins(key) === coins && !TITLES[key].coins),
    'V13.191 칭호 4탄 24개는 문서 표의 키 · 이름 · 등급 · 묶음 · 조건 · 코인 그대로(따로 coins를 주는 칭호 없음)');
  assert(TITLE_KEYS.length === 175 && new Set(TITLE_KEYS.map(key => TITLES[key].name)).size === TITLE_KEYS.length - 1 /* 옛 뽑기 '황금 손'과 인형뽑기 '황금 손' */ && TITLES_4.every(key => !TITLES_3.includes(key)),
    'V13.191 칭호는 모두 175개(151 + 4탄 24), 4탄 이름은 기존 칭호와 겹치지 않는다');
  assert(!TITLES.bugall && !TITLES.dinoall && !Object.values(TITLES).some(t => /곤충 채집왕|쥬라기 반장/.test(t.name)),
    'V13.191 곤충 · 공룡 펫 칭호 2개(곤충 채집왕 · 쥬라기 반장)는 펫 코드와 같이 넣으므로 이번에는 없다');
  assert(TABLE.every(([key, , , , stat, goal]) => !titleUnlocked(key, { [stat]: goal - 1 }) && titleUnlocked(key, { [stat]: goal }) && titleUnlocked(key, { [stat]: goal + 1 })),
    'V13.191 4탄 칭호마다 조건 직전에는 없고 딱 달성하면 얻는다');
  assert(TABLE.filter(r => r[0] !== 'timingweek').every(([key, , , , stat, goal]) => titleProgress(key, { [stat]: goal - 1 })?.join() === `${goal - 1},${goal}`) && titleProgress('timingweek', { timing_week_king: 0 }) === null,
    'V13.191 4탄 칭호는 진행 막대가 있고(주간 초시계왕은 순위라 없음)');
  assert(weeklyTitle('timingweek') && !TITLES.timingweek.once && TITLES_4.filter(key => key !== 'timingweek').every(key => !weeklyTitle(key)),
    'V13.191 주간 초시계왕만 주마다 다시 정해지는 한정 칭호(이긴 주마다 60코인)');

  // ---- 코인 표(문서와 같다)
  const sum = keys => keys.reduce((n, key) => n + titleCoins(key), 0);
  assert(sum(FISHING) === 460 && sum(TITLES_4.slice(8, 12)) === 220 && sum(TITLES_4.slice(12, 16)) === 220 && sum(TITLES_4.slice(16, 20)) === 220 && sum(TITLES_4.slice(20, 23)) === 210 && sum(TITLES_4.slice(0, 23)) === 1330 && titleCoins('timingweek') === 60,
    'V13.191 코인: 낚시 460 · 시험 범위 220 · 코인 선물 220 · 펫 육성 220 · 몬스터 사냥 210 = 한 번 받는 23개 1,330, 주간 초시계왕은 이긴 주마다 60');

  // ---- 새 묶음 '낚시'(선생님 결정 4)
  const groups = Object.keys(TITLE_GROUPS);
  assert(TITLE_GROUPS.fishing === '낚시' && groups.indexOf('fishing') === groups.indexOf('arcade') + 1 && groups.at(-1) === 'limited' && TITLE_KEYS.filter(key => TITLES[key].group === 'fishing').join() === FISHING.join() && FISHING.length === 8,
    "V13.191 칭호 도감에 새 묶음 '낚시'(놀이터 다음): 낚시 칭호 8개가 모두 여기에");
  assert(source('../public/modules/titles-ui.js').includes('Object.entries(TITLE_GROUPS).filter(([key]) => visible.some(k => TITLES[k].group === key))'),
    'V13.191 도감 묶음 버튼은 TITLE_GROUPS에서 만들어져 낚시 묶음이 저절로 생긴다');

  // ---- 낚시: 월척(trophyOf) · 도감 · 하루 최다 · 낚싯대
  {
    const [lo, hi] = FISH.carp.kg, cut = lo + (hi - lo) * .85;
    const s = book => fishTitleStats({ games: { fish: { book } } });
    assert(s({ carp: { n: 1, kg: cut } }).fish_trophy === 1 && s({ carp: { n: 1, kg: cut - .05 } }).fish_trophy === 0 && s({ minnow: { n: 3, kg: FISH.minnow.kg[1] } }).fish_trophy === 0 && s({ goldenegg: { n: 1, kg: 7.7 } }).fish_trophy === 0 && s({ whaleshark: { n: 1, kg: 500 } }).fish_trophy === 1,
      'V13.191 월척이다!: 게임 월척과 같은 기준(보통 이상 물고기가 무게 상위 15% · 전설은 언제나, 흔함 · 황금 알 물고기는 아님)');
    const all = Object.keys(FISH), sample = all.map(k => ({ k, kg: FISH[k].kg[0] + (FISH[k].kg[1] - FISH[k].kg[0]) * (all.indexOf(k) % 7) / 6 }));
    assert(sample.every(({ k, kg }) => (s({ [k]: { n: 1, kg } }).fish_trophy === 1) === trophyOf({ caught: true, key: k, rarity: FISH[k].rarity, kg }).trophy),
      'V13.191 월척 칭호 판정은 모든 물고기 · 여러 무게에서 trophyOf 그대로(도감 최고 무게로 판정해서 배포 전 월척도 소급)');
    const shore = Object.fromEntries(FISH_KEYS.map(k => [k, { n: 1, kg: FISH[k].kg[0] }])), deep = Object.fromEntries(DEEP_KEYS.map(k => [k, { n: 1, kg: FISH[k].kg[0] }]));
    const shore23 = { ...shore }; delete shore23.goldenegg;
    assert(FISH_KEYS.length === 24 && FISH_KEYS.includes('goldenegg') && DEEP_KEYS.length === 8 && s(shore).fish_shore === 24 && s(shore23).fish_shore === 23 && !titleUnlocked('fishall', s(shore23)) && titleUnlocked('fishall', s(shore)) && s(shore).deep_kinds === 0,
      'V13.191 수산시장 사장님: 물가 도감 24종(황금 알 물고기 포함), 23종은 아니다, 심해는 따로');
    assert(s(deep).deep_kinds === 8 && titleUnlocked('deepall', s(deep)) && titleUnlocked('deep1', s({ anglerfish: { n: 1, kg: 3 } })) && s({ ...shore, ...deep }).fish_kinds === 32 && s({ ...shore, ...deep }).fish_legend === 5 && s({ coelacanth: { n: 0, kg: 0 } }).fish_legend === 0,
      'V13.191 심해 첫 손님 · 심해 탐사대장(8종) · 전설 물고기 5종(고래상어 · 황금 잉어 · 실러캔스 · 대왕쥐가오리 · 주름상어), 잡은 수 0인 칸은 세지 않는다');
    assert(fishTitleStats({ reel: { rod: 5 } }).reel_rod === 5 && fishTitleStats({ reel: { rod: 99 } }).reel_rod === 5 && fishTitleStats(null).reel_rod === 1, 'V13.191 낚싯대 풀강: 낚싯대 단계(p.reel.rod, 1~5)');
    // 하루 최다: 날짜가 바뀌면 0부터, 저장은 d · n · b 셋
    const t0 = Date.parse('2026-10-27T03:00:00Z'), r = {};
    for (let i = 0; i < 9; i++) reelDayCatch(r, t0 + i);
    assert(r.dc.n === 9 && r.dc.b === 9 && !titleUnlocked('fishday10', fishTitleStats({ reel: r })), 'V13.191 하루 9마리는 오늘 회식은 나야가 아니다');
    reelDayCatch(r, t0 + DAY);
    assert(r.dc.n === 1 && r.dc.b === 9, 'V13.191 날짜가 바뀌면 오늘 잡은 수는 0부터(최다는 남는다)');
    for (let i = 0; i < 9; i++) reelDayCatch(r, t0 + DAY + 1 + i);
    assert(r.dc.n === 10 && r.dc.b === 10 && Object.keys(r.dc).join() === 'd,n,b' && titleUnlocked('fishday10', fishTitleStats({ reel: r })), 'V13.191 같은 날 10마리면 하루 최다 10(p.reel.dc = { d, n, b })');
    // 끌어올리기에서만 센다: 놓치거나 너무 빨리 올리면(서버가 막음) 세지 않는다
    const p = { reel: { bait: 4 } }, at = Date.parse('2026-10-28T03:00:00Z');
    reelCast(p, { id: 'c1', cast: 'ok', now: at, seed: 7 }); reelLand(p, { id: 'c1', result: 'caught', now: at + 120000 });
    reelCast(p, { id: 'c2', cast: 'ok', now: at + 130000, seed: 8 }); reelLand(p, { id: 'c2', result: 'lost', now: at + 140000 });
    reelCast(p, { id: 'c3', cast: 'ok', now: at + 150000, seed: 9 }); reelLand(p, { id: 'c3', result: 'caught', now: at + 150001 });
    reelLand(p, { id: 'c1', result: 'caught', now: at + 160000 });
    assert(p.reel.dc?.n === 1 && p.reel.dc.b === 1, 'V13.191 하루 낚기는 서버가 잡았다고 정한 것만 센다(놓침 · 너무 빠른 끌어올리기 · 같은 끝내기 다시 보내기는 아님)');
    assert(/out = \{ caught: true[^\n]*\n\s*reelDayCatch\(r, now\);/.test(source('./reel.mjs')), 'V13.191 하루 낚기는 reelLand의 잡음(caught) 줄에서만 센다');
  }

  // ---- 몬스터 사냥 도감
  {
    const at = place => MONSTER_KEYS.filter(k => (HUNT_MONSTERS[k].place || 'any') === place);
    const book = keys => ({ hunt: { book: Object.fromEntries(keys.map(k => [k, { n: 1 }])) } });
    const forest8 = at('forest').slice(0, 8);
    assert(MONSTER_KEYS.length === 70 && at('forest').length === 9 && at('night').length === 9 && huntTitleStats(book(forest8)).hunt_place_best === 8 && !titleUnlocked('huntplace', huntTitleStats(book(forest8))) && titleUnlocked('huntplace', huntTitleStats(book(at('beach')))),
      'V13.191 우리 동네 터줏대감: 숲 · 들판 · 바닷가 중 한 곳 9종(8종은 아님)');
    assert(huntTitleStats(book(at('night'))).hunt_place_best === 0 && titleUnlocked('huntnight', huntTitleStats(book(at('night')))) && huntTitleStats(book(MONSTER_KEYS)).hunt_kinds === 70 && titleUnlocked('huntall', huntTitleStats(book(MONSTER_KEYS))) && !titleUnlocked('huntall', huntTitleStats(book(MONSTER_KEYS.slice(1)))),
      'V13.191 올빼미 포획단(밤 9종은 동네 칭호와 따로) · 몬스터 동사무소장(70종 전부)');
  }

  // ---- 코인: 번 코인에 가위바위보 · 주식 · 뽑기 받은 돈 · 야차전은 넣지 않음, 쓴 코인에서 전설 알 빼기
  {
    const p = { attendance: { coins: 100 }, title_reward: { total: 50 }, gift_box: { total: 30, count: 2 }, reel: { coins: 20 }, hunt: { coins: 10 }, claw: { coins: 5 }, rps: { paid: 9000 }, stocks: { paid: 8000 }, gacha: { refund: 700 }, chance: { paid: 600 }, lucky: { paid: 500 }, legend_egg: { coins: 400 } };
    assert(coinEarned(p, [{ reward_points: 300 }, { reward_points: 85, bonus: true }], 200) === 300 + 85 + 200 + 100 + 50 + 30 + 20 + 10 + 5 && rewardIncome(p) > 9000,
      'V13.191 번 코인 = 연습 · 보너스 판 + 대회 상금 + 출석 · 칭호 · 선물 · 진주 · 별조각 · 인형(가위바위보 · 주식 · 뽑기 · 더블 찬스 받은 돈은 아님)');
    assert(coinSpent({ points_spent: 10000 }) === 10000 && titleUnlocked('broke', { coin_spent: coinSpent({ points_spent: 10000 }) }) && coinSpent({ points_spent: 24999, legend_egg: { buy: 1 } }) === 24999 - LEGEND_EGG_PRICE && !titleUnlocked('broke', { coin_spent: coinSpent({ points_spent: 24999, legend_egg: { buy: 1 } }) }),
      'V13.191 통장 텅장: 쓴 코인 10,000, 전설 알 15,000은 빼고 센다(선생님 결정 3)');
    const state = emptyState();
    state.tournaments = [{ status: 'finished', prize: 300, champion: 'c1', runner_up: 'c2' }];
    const ctx = createCompetition(state);
    assert(ctx.titleStat({ id: 'c1' }, 'coin_earned') === 300 && ctx.titleStat({ id: 'c2' }, 'coin_earned') === 150 && ctx.titleStat({ id: 'c2', battle_coins: 9999 }, 'coin_spent') === 0,
      'V13.191 번 코인에 대회 상금(우승 · 준우승 절반)이 들어간다');
  }

  // ---- 펫 육성: 이름 · 레벨 · 돌본 날(p.care.dn)
  {
    assert(petTitleStats({ pets: [{ key: 'dog', name: '  ' }, { key: 'cat', name: '나비' }] }).pet_named === 1 && petTitleStats({}, [{ level: 19 }, { level: 7 }]).pet_best_level === 19 && petTitleStats({}, [{ level: 20 }]).pet_best_level === 20,
      'V13.191 작명소 사장님(이름 지어 준 펫) · 다 컸네!(가장 높은 펫 레벨, petProgress)');
    const t0 = Date.parse('2026-10-27T03:00:00Z'), p = { pets: [{ key: 'dog', first: true }, { key: 'cat' }] };
    petCare(p, 'pet', { pet: 'dog', now: t0 }); petCare(p, 'feed', { pet: 'dog', now: t0 + 1 }); petCare(p, 'pet', { pet: 'cat', now: t0 + 2 });
    assert(p.care.dn === 1 && p.care.total === 3, 'V13.191 100일 집사: 하루에 펫 여럿을 여러 번 돌봐도 돌본 날은 1');
    try { petCare(p, 'pet', { pet: 'dog', now: t0 + 3 }); } catch {}
    petCare(p, 'pet', { pet: 'dog', now: t0 + DAY });
    assert(p.care.dn === 2 && typeof p.care.dn === 'number' && createCompetition(emptyState()).titleStats({ id: 'x', care: { dn: 100 } }).care_days === 100 && !titleUnlocked('care100', { care_days: 99 }),
      'V13.191 다음 날 첫 교감에 돌본 날 +1(p.care.dn은 숫자 하나), 막힌 교감은 세지 않는다');
  }

  // ---- 주간 초시계왕: 지난주 기록(wk → pw), 학년 묶음마다 1위, 이긴 주마다 다시
  {
    const now = Date.parse('2026-10-28T03:00:00Z'), week = rankingWeek(now).start, last = rankingWeek(week - 1).start, older = rankingWeek(last - 1).start;
    const t = { timing: { wk: { k: last, b: 12, n: 3, s: 60 } } };
    assert(timingWeekOf(t, last)?.b === 12 && keepTimingLastWeek(t, week)?.b === 12 && Object.keys(t.timing.pw).join() === 'k,b,n' && t.timing.pw.k === last && timingWeekOf({ timing: { wk: { k: week, b: 1, n: 1, s: 1 }, pw: t.timing.pw } }, last)?.b === 12,
      'V13.191 새 주 첫 판 전에 지난주 wk를 pw = { k, b, n }으로 옮긴다(그 주에 안 하면 wk 그대로 본다)');
    const same = { timing: { wk: { k: week, b: 5, n: 1, s: 5 } } };
    assert(keepTimingLastWeek(same, week) === null && !same.timing.pw && keepTimingLastWeek({}, week) === null, 'V13.191 이번 주 기록이거나 기록이 없으면 옮기지 않는다');
    const stu = (id, cls, wk, extra = {}) => ({ id, role: 'student', active: true, division: cls.startsWith('중') ? 'middle' : 'high', class_name: cls, timing: wk, ...extra });
    const profiles = [
      stu('a', '고1A', { wk: { k: last, b: 8, n: 2, s: 20 } }),
      stu('b', '고1B', { wk: { k: week, b: 1, n: 1, s: 1 }, pw: { k: last, b: 6, n: 4 } }),
      stu('c', '고1A', { wk: { k: last, b: 6, n: 4, s: 30 } }),
      stu('d', '고2A', { wk: { k: last, b: 30, n: 1, s: 30 } }),
      stu('e', '고1A', { wk: { k: older, b: 0, n: 9, s: 0 } }),
      stu('f', '중1', { wk: { k: last, b: 6, n: 9, s: 60 } }),
      stu('g', '고1A', { wk: { k: last, b: 0, n: 1, s: 0 } }, { preview_owner_id: 't' }),
      stu('h', '고1A', { wk: { k: last, b: 6, n: 3, s: 30 } })
    ];
    const kings = timingWeekKings(profiles, last, { ranked: x => !x.preview_owner_id, band: x => `${x.division}|${x.class_name.slice(0, 2)}` });
    assert([...kings].sort().join() === 'b,c,d,f', 'V13.191 지난주 학년 묶음마다 1위(오차가 작을수록, 같으면 판이 많을수록, 완전히 같으면 함께): 고1 b · c(같은 기록), 고2 d, 중1 f. 지지난주 · 교사 미리보기는 아님');
    const state = emptyState();
    state.profiles = profiles.map(x => ({ ...x }));
    const ctx = createCompetition(state, now);
    assert(ctx.titleStat(state.profiles[1], 'timing_week_king') === 1 && ctx.titleStat(state.profiles[0], 'timing_week_king') === 0 && ctx.titleStat(state.profiles[6], 'timing_week_king') === 0 && ctx.lastWeek.start === last,
      'V13.191 주간 초시계왕 판정은 지난주(competition lastWeek)의 같은 학년 묶음(sameGradeBand) 순위');
    const svc = source('./service.mjs'), tm = source('./timing.mjs');
    assert(svc.indexOf('keepTimingLastWeek(p, rankingWeek(now).start);') > 0 && svc.indexOf('keepTimingLastWeek(p, rankingWeek(now).start);') < svc.indexOf('const res = timingFinish(p, {') && !tm.includes('pw') && !tm.includes('titles-4'),
      'V13.191 지난주 기록 옮기기는 service.mjs의 10초 맞추기 끝에서 timingFinish 전에(timing.mjs는 그대로라 10초 맞추기 PR과 겹치지 않는다)');
  }

  // ---- 시험 범위: 한 바퀴 · 모의고사 책 · 시험 전체, 최고값(p.range_best) 유지
  {
    const w = (code, n) => Array.from({ length: n }, (_, i) => ({ id: `${code}-${i}`, range_code: code }));
    const books = [
      { id: 'b1', exam_period: 'midterm', words: [...w('1', 3), ...w('2', 3)] },
      { id: 'm1', exam_period: 'midterm', mock: true, words: w('29', 4) },
      { id: 'b2', exam_period: 'final', words: w('L3', 5) },
      { id: 'm2', exam_period: 'final', mock: true, words: [...w('45', 2), ...w('46', 2)] }
    ];
    const r = (total, attempted, status) => ({ total, attempted, status });
    const ranges = { 1: r(3, 3, 'master'), 2: r(3, 3, 'perfect'), 29: r(4, 4, 'conquering'), L3: r(5, 4, 'in_progress'), 45: r(2, 2, 'master'), 46: r(2, 1, 'in_progress') };
    let c = rangeCounts(books, ranges);
    assert(c.c === 4 && c.mc === 1 && c.mm === 0 && c.all === 0 && c.books === 2, 'V13.191 한 바퀴 범위 4 · 모의고사 책 한 바퀴 1(29번) · 정복한 모의고사 책 0 · 시험 전체 정복 0');
    ranges[29].status = 'master';
    c = rangeCounts(books, ranges);
    assert(c.mm === 1 && c.all === 1 && !titleUnlocked('rangeall', rangeTitleStats({}, { all: 0 })) && titleUnlocked('rangeall', rangeTitleStats({}, c)), 'V13.191 중간고사 범위(1 · 2 · 29번)를 모두 정복하면 시험 범위 올킬, 모의고사 책 정복');
    const p = {};
    rememberRangeBest(p, c);
    assert(Object.keys(p.range_best).join() === 'c,mc,mm,all' && p.range_best.mm === 1, 'V13.191 연습 끝에 최고값 p.range_best = { c, mc, mm, all }를 남긴다');
    ranges[29].status = 'needs_work';
    const after = rangeTitleStats(p, rangeCounts(books, ranges));
    assert(after.mock_clear === 1 && after.range_all === 1 && titleUnlocked('mockclear', after) && titleUnlocked('rangeall', after), 'V13.191 정복이 풀려도(최근 정답률이 떨어져도) 한 번 얻은 시험 범위 칭호는 그대로(선생님 결정 2)');
    assert(!rememberRangeBest({}, rangeCounts([], {})) && rangeTitleStats({ range_best: { c: 2 } }, null).range_cover === 2, 'V13.191 기록이 없는 학생에게는 키를 만들지 않고, 연습 전에도 지금 값과 최고값 중 큰 것으로 판정');
    const svc = source('./service.mjs');
    assert(/repairStreak\(state, student, endedAt\);\n[^\n]*\n\s*if \(student\?\.role === 'student' && answerRecords\.length\) rememberRangeBest\(student, studentRangeCounts\(state, student\)\);/.test(svc) && svc.includes('setRangeCounter(studentRangeCounts);'),
      'V13.191 최고값은 연습이 끝날 때(finishPractice) 서버가 채점한 단어 기록으로만 센다');
    const mocks = allBooks({ extraBooks: [] }).filter(b => b.mock).map(b => b.id).sort();
    assert(mocks.join() === 'gangseo:final:mock-sep-2026,seonbu-external-44-corrected-202603,seonbu:final:external-45-60-2026', 'V13.191 모의고사 책 표시(mock: true)는 강서고 9월 · 선부고 외부지문 44 · 45~60 셋');
  }

  // ---- 보이는 범위: 모의고사 칭호는 모의고사 책이 있는 학교만, 심해 칭호는 심해 그림이 다 있을 때만
  {
    const all = visibleTitleKeys(['rookie'], { middle: true }), noMock = visibleTitleKeys(['rookie'], { mock: false }), noDeep = visibleTitleKeys(['rookie'], { deep: false });
    assert(MOCK.every(key => TITLES[key].mock && all.includes(key) && !noMock.includes(key)) && noMock.length === all.length - 2 && visibleTitleKeys(['rookie', 'mockclear'], { mock: false }).includes('mockclear') && TITLES_4.filter(key => !MOCK.includes(key)).every(key => !TITLES[key].mock),
      'V13.191 모의고사 칭호 2개는 모의고사 책이 없는 학교 학생 도감에서 숨기고(가지고 있으면 보인다), 나머지 4탄 칭호는 모두 보인다');
    assert(DEEP.every(key => TITLES[key].deep && !noDeep.includes(key)) && noDeep.length === all.length - 2 && DEEP_TITLES_READY === DEEP_KEYS.every(key => FISH_READY.has(key)) && DEEP_TITLES_READY,
      'V13.191 심해 칭호 2개는 심해 8종 그림이 다 있을 때만 보인다(안전장치, 지금은 그림 53이 있어 보인다)');
    const ui = source('../public/modules/titles-ui.js'), svc = source('./service.mjs');
    assert(ui.includes("mock: Number(titleState(A).stats?.mock_books || 0) > 0 })") && svc.includes("const titleScope = (p, stats) => ({ middle: p?.division === 'middle', mock: Number(stats?.mock_books || 0) > 0 });"),
      'V13.191 화면(titles-ui.js)과 서버(묶음 카드)가 같은 기준으로 모의고사 칭호를 거른다');
  }

  // ---- 그림: 24개 × 2, TITLE_ART 연결, slice-map 60 · 61 줄, 등급 테두리 문장
  {
    const map = source('../docs/asset-requests/runner/slice-map.csv').split('\n').filter(line => /^"6[01]-titles/.test(line));
    const file = name => existsSync(fileURLToPath(new URL(`../public/assets/titles/${name}.webp`, import.meta.url)));
    assert(TITLES_4.every(key => TITLE_ART.has(key) && file(key) && file(`${key}-s`) && map.some(line => line.endsWith(`"public/assets/titles/${key}.webp"`))) && map.length === 24,
      'V13.191 4탄 메달 24개마다 그림(256 · 96)이 있고 TITLE_ART와 그림 주문서(slice-map 60 · 61)에 있다');
    assert(!file('preview-60') && !file('preview-61'), 'V13.191 확인용 합본 그림(preview-60 · 61)은 넣지 않는다');
    const prompts = ['60-titles-4a', '61-titles-4b'].map(n => source(`../docs/asset-requests/runner/${n}.txt`)).join('\n');
    const frames = { common: 'mint-silver rim', rare: 'HEXAGON badge', epic: 'SHIELD-shaped crest', legendary: 'ROUND GOLD medal', limited: 'RAINBOW holographic rim' };
    assert(Object.entries(frames).every(([tier, phrase]) => prompts.split(phrase).length - 1 === TITLES_4.filter(key => TITLES[key].tier === tier).length),
      'V13.191 그림 주문서의 등급 테두리 문장 수 = 등급별 칭호 수(일반 4 · 희귀 7 · 영웅 6 · 전설 6 · 한정 1)');
    assert(prompts.includes('Google Drive folder "SUMUS 칭호 11 (Runner용)"') && /named exactly "60-1\.png"/.test(prompts) && /named exactly "61-3\.png"/.test(prompts), 'V13.191 그림 주문서에 Drive 기존 메달로 그림체 맞추기 · 정해진 폴더에 정확한 이름으로 저장이 있다');
  }

  // ---- titles_seen 240: 칭호 175 + 지난주 한정 칭호(key@주) 6개
  {
    const weekly = TITLE_KEYS.filter(weeklyTitle);
    assert(TITLES_SEEN_MAX === 240 && weekly.length === 6 && weekly.includes('timingweek') && TITLE_KEYS.length + weekly.length <= 181 && TITLE_KEYS.length + weekly.length < TITLES_SEEN_MAX,
      'V13.191 학생이 본 칭호 기록 240칸은 모자라지 않는다(칭호 175 + 지난주 한정 6 = 최대 181)');
  }

  // ---- 서버 경로: 3탄 묶음 다음 4탄 묶음, 한 번만, 코인 합계, 푸시 없음, 모의고사 칭호 범위, 응답에 정답 힌트 없음
  {
    const state = emptyState(), hash = await passwordHash('QaTitles4!'), now = Date.now();
    const base = { role: 'student', active: true, password_hash: hash, avatar_key: 'dog', created_at: now - 30 * DAY };
    // 선부고(모의고사 책 있음): 배포 전부터 펫 이름 · 선물 20 · 쓴 코인 10,000 · 낚싯대 5단계 · 고래상어를 채운 학생. 3탄 칭호는 이미 봤다.
    state.profiles.push({ ...base, id: 'qa-t4', username: 'qa-t4', display_name: '선부', class_name: '고1A', school_id: 'seonbu-high', school: '선부고', division: 'high',
      pets: [{ key: 'dog', first: true, name: '초코', acquired_at: now - 30 * DAY }], gift_box: { count: 20, total: 0 }, points_spent: 10000,
      reel: { rod: 5 }, games: { fish: { book: { whaleshark: { n: 1, kg: 600 } } } }, titles_seen: ['rookie', 'level65'] });
    // 단원고(모의고사 책 없음): 3탄 몬스터 칭호 2개와 4탄 칭호 2개를 함께 가진 학생. 3탄 묶음이 먼저, 다음 열기에 4탄 묶음.
    state.profiles.push({ ...base, id: 'qa-t4d', username: 'qa-t4d', display_name: '단원', class_name: '고1A', school_id: 'danwon-high', school: '단원고', division: 'high',
      pets: [{ key: 'dog', first: true, name: '보리', acquired_at: now - 30 * DAY }], gift_box: { count: 20, total: 0 }, bonus: { monster: { best: 10, wins: 12, dw: { d: '2026-10-01', n: 3, b: 3 } } }, titles_seen: ['rookie'] });
    const login = async u => (await service(state, 'POST', '/login', { username: u, password: 'QaTitles4!', division: 'high' }, null))._cookie;
    const tok = await login('qa-t4'), tokD = await login('qa-t4d');
    const call = (token, method, path, body = {}) => service(state, method, path, body, token);
    const me = state.profiles.find(x => x.id === 'qa-t4');
    const want = ['fishkg', 'fishlegend', 'rod5', 'gift20', 'broke', 'petname'];
    const t = (await call(tok, 'GET', '/bootstrap')).titles;
    assert(t && want.every(key => t.unlocked.includes(key) && t.fresh.includes(key)) && t.batch.join() === want.join() && t.batch_wave === 4 && !t.intro, 'V13.191 배포 직후: 이미 조건을 채운 4탄 칭호 6개가 4탄 묶음 카드로 온다(월척은 도감 최고 무게로 소급)');
    assert(t.stats.mock_books === 2 && visibleTitleKeys(t.unlocked, { middle: false, mock: t.stats.mock_books > 0 }).includes('mockcover'), 'V13.191 선부고 학생은 모의고사 책이 2권이라 모의고사 칭호가 보인다');
    const coins = want.reduce((n, key) => n + titleCoins(key), 0), before = rewardIncome(me);
    const seen1 = await call(tok, 'POST', '/titles/seen', { keys: t.batch });
    assert(coins === 230 && seen1.paid_coins === coins && rewardIncome(me) === before + coins && !seen1._push && me.title_reward.total === coins, 'V13.191 4탄 묶음 카드를 보면 코인을 한 번에(10 + 60 + 60 + 30 + 60 + 10 = 230), 푸시 없음');
    const t2 = (await call(tok, 'GET', '/bootstrap')).titles, seen2 = await call(tok, 'POST', '/titles/seen', { keys: t.batch });
    assert(!t2.batch.length && want.every(key => !t2.fresh.includes(key)) && seen2.paid_coins === 0 && me.title_reward.total === coins, 'V13.191 소급 지급은 한 번만(다시 보내도 코인 0, 다시 묶이지 않는다)');
    const d1 = (await call(tokD, 'GET', '/bootstrap')).titles;
    assert(d1.batch_wave === 3 && d1.batch.join() === 'mlv10,mday3' && d1.stats.mock_books === 0 && !visibleTitleKeys(d1.unlocked, { middle: false, mock: false }).includes('mockcover'), 'V13.191 3탄도 아직 안 본 학생은 3탄 묶음부터, 단원고는 모의고사 책이 없어 모의고사 칭호가 숨는다');
    await call(tokD, 'POST', '/titles/seen', { keys: d1.batch });
    const d2 = (await call(tokD, 'GET', '/bootstrap')).titles;
    assert(d2.batch_wave === 4 && d2.batch.join() === 'gift20,petname', 'V13.191 3탄 묶음을 본 뒤 다음 열기에 4탄 묶음');
    await call(tokD, 'POST', '/titles/seen', { keys: d2.batch });
    me.points_spent = 0;
    const t3 = (await call(tok, 'GET', '/bootstrap')).titles;
    assert(!t3.batch.length && !t3.unlocked.includes('broke'), 'V13.191 (검사용) 코인이 줄면 통장 텅장 조건은 다시 계산된다(최고값을 따로 저장하지 않는 칭호)');
    const text = JSON.stringify([t, t2, d1, d2, seen1]);
    assert(Object.values(t.stats).every(v => typeof v === 'number') && !/answers|wrong_keys|"en"|"ko"|choice|meaning/.test(text), 'V13.191 칭호 응답에는 숫자 기록만 있고 정답 힌트가 없다');
    // 학생 폰이 보내는 값으로는 새 기록 키가 생기지 않는다
    const keysBefore = JSON.stringify([me.reel?.dc, me.care?.dn, me.timing?.pw, me.range_best]);
    await call(tok, 'PATCH', '/profile', { reel: { dc: { d: 'x', n: 99, b: 99 } }, care: { dn: 999 }, timing: { pw: { k: 1, b: 0, n: 9 } }, range_best: { c: 9, mc: 9, mm: 9, all: 9 } }).catch(() => null);
    assert(JSON.stringify([me.reel?.dc, me.care?.dn, me.timing?.pw, me.range_best]) === keysBefore, 'V13.191 새 기록 키 넷은 학생이 보낸 값으로 바뀌지 않는다(서버가 정한 값으로만 쌓임)');
  }

  // ---- 화면: 묶음 카드는 몇 탄인지 보여 준다
  {
    const ui = source('../public/modules/titles-ui.js');
    assert(ui.includes('const wave = Number(A.data?.titles?.batch_wave) || 3;') && ui.includes('NEW · 칭호 ${wave}탄</span>') && !ui.includes('NEW · 칭호 3탄</span>'), 'V13.191 묶음 카드 머리말은 서버가 알려 준 탄(3탄 · 4탄)');
    const css = source('../public/v13191.css'), list = JSON.parse(source('./build-assets.mjs').match(/const cssSources = (\[[\s\S]*?\]);/)?.[1] || '[]');
    assert(css.includes('.tt-filter{max-width:none;overflow-x:auto') && css.includes('.tt-filter button{flex:1 0 auto;white-space:nowrap') && list.includes('v13191.css') && list.indexOf('v13191.css') < list.indexOf('v13184.css') && list.at(-1) === 'v13178.css' && source('../public/app.bundle.css').includes('.tt-filter{max-width:none'),
      'V13.191 칭호 도감 묶음 버튼 9개는 폰(390px)에서 한 줄로, 넘치면 옆으로 민다(번들에 들어가고 v13178.css가 맨 끝)');
    assert(source('../public/app.js').includes("if (d.titleFilter) { const x = $('.tt-filter')?.scrollLeft || 0; A.titleFilter = d.titleFilter; renderKeepScroll(); const seg = $('.tt-filter'); if (seg) seg.scrollLeft = x; return; }"),
      'V13.191 묶음 버튼을 눌러 다시 그려도 버튼 줄의 가로 위치를 지킨다(낚시 · 한정 버튼이 화면 밖으로 사라지지 않게)');
  }
}
