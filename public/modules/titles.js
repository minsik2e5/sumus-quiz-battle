// V13.66 titles (칭호) and the weekly yacha league, shared by the server (which decides what
// is unlocked) and the app (which draws the collection). Every title is earned from one
// number in the student's title stats (server/competition.mjs, titleStats):
//   level        growth level (경험치)
//   correct      words answered correctly in finished study
//   best_days    longest run of days in a row with study
//   perfect      100-point study of 10 or more questions
//   combo        best run of correct answers in one study
//   pets         pets met
//   wins         yacha wins (the same friend counts at most 3 times a day)
//   win_streak   best yacha win streak
//   comebacks    wins with a fifth of the HP or less left (20 of 100, 50 of 250)
//   flawless     wins with full HP left
//   league_best  best weekly league tier reached (1 silver .. 3 diamond)
//   championships  academy tournaments won
//   weekly_rank  last week's 경험치 rank in the student's grade (1..3, 0 = none)
//   league_king  1 when the student topped last week's yacha league
//   item_<key>   V13.67: how many of that capsule the student pulled (capsule-only titles)
//   studies      V13.73: finished studies of 10 or more answers
//   attendance   V13.73: days checked in (출석)
//   bot_wins     V13.73: robot practice matches won (any level); bot_hard_wins: at 어려움
//   skills       V13.73: pet skills set off in yacha matches (counted from v13.73 on)
//   exams        V13.73: teacher exams submitted
//   gifts        V13.73: coin gifts received from a teacher
//   rps_wins     V13.82: 가위바위보 throws won; rps_jackpots: ×8 pots (three wins in a row)
//   monster_wins V13.94: monsters beaten (몬스터 잡기, any level); monster_hard: at 하드
//   dungeon_*    V13.143 던전(server/dungeon-records.mjs dungeonTitleStats): dungeon_clears 클리어한 판,
//                dungeon_c3 · dungeon_c2 · dungeon_c1 그 등급컷을 깼는지, dungeon_max_floor 만점 모드 최고 층,
//                dungeon_no_down 아무도 기절하지 않고 깬 판, dungeon_records 역대 보드 1위 기록을 세운 횟수,
//                dungeon_week_king 지난주 던전 주간 보드 1위 파티였는지(한정)
//   V13.148 칭호 2탄(그림 25): units 정복한 과(정답률 95% 이상으로 모든 단어를 푼 범위), exam_perfect 실전시험 100점,
//                fixes 틀렸다가 다시 맞힌 단어, weekend_days 공부한 주말(토·일) 날, morning_studies 아침(5~9시) 학습,
//                event_studies 보상 이벤트 중 학습, away_wins 다른 학교 친구에게 이긴 야차전, rematches 같은 친구와 10분 안에
//                다시 한 판, legend_pets · mythic_pets · season_pets 전설 · 신화 · 한정 펫 수, eggs 상점 알을 연 수,
//                care 펫 교감(쓰다듬기 · 밥) 수, lucky_best_day 코인 뽑기 3배가 하루에 가장 많이 나온 수, boss_wins 보스 몬스터 처치
//   V13.168 zodiac_pets 만난 12지 펫 수(core.js ZODIAC_PET_KEYS)
//   V13.180 인형뽑기(server/claw.mjs): claw_dolls 뽑은 인형 수, claw_kinds 도감에 모은 인형 종류(12종), claw_gold 뽑은 황금 인형 수
//   V13.180 timing_perfect 10초 맞추기 완벽 이상 수, timing_ten 딱 10.00 수, timing_streak 최고 연속 완벽(server/timing.mjs p.timing)
// Limited titles belong to one week: they are held only while last week's result stands.
// V13.148 `once`: 한정 테두리지만 주간 칭호가 아닌 것(신화의 주인): 한 번 받으면 계속 갖고, 코인도 한 번만.

import { EPIC_PET_KEYS, LEGEND_EGG_EPIC_NEED } from './core.js';

export const TITLE_TIERS = {
  common: { name: '일반', order: 1 },
  rare: { name: '희귀', order: 2 },
  epic: { name: '영웅', order: 3 },
  legendary: { name: '전설', order: 4 },
  limited: { name: '한정', order: 5 }
};
export const TITLE_GROUPS = { study: '학습', yacha: '야차전', monster: '몬스터', dungeon: '던전', collect: '수집', gacha: '뽑기', arcade: '놀이터', limited: '한정' };
// V13.73: coins for a new title, by tier (paid once when the student first sees it; a limited
// title pays again each week it is won). 첫걸음 and retired capsule titles pay nothing.
export const TITLE_COINS = { common: 10, rare: 30, epic: 60, legendary: 120, limited: 60 };
// V13.143: a title may name its own coins (`coins`): 던전 주간 1위 파티 코인은 그 칭호가 준다.
export const titleCoins = key => key === 'rookie' || !TITLES[key] || TITLES[key].retired ? 0 : TITLES[key].coins ?? TITLE_COINS[TITLES[key].tier] ?? 0;

// Keys of the first eight titles are kept from V13.56 (students may have one equipped).
export const TITLES = {
  rookie: { name: '첫걸음', tier: 'common', group: 'study', stat: 'level', goal: 1, icon: 'sprout', how: '처음부터 가지고 있어요', desc: 'SUMUS VOCA와 함께 시작한 첫걸음.' },
  focus: { name: '집중의 힘', tier: 'common', group: 'study', stat: 'level', goal: 5, icon: 'target', how: 'Lv.5 달성', desc: '공부에 푹 빠지는 법을 알아요.' },
  words100: { name: '단어 새싹', tier: 'common', group: 'study', stat: 'correct', goal: 100, icon: 'sprout', how: '맞힌 단어 100개', desc: '단어가 쑥쑥 자라기 시작했어요.' },
  streak3: { name: '작심삼일 돌파', tier: 'common', group: 'study', stat: 'best_days', goal: 3, icon: 'flame', how: '3일 연속 학습', desc: '작심삼일? 그건 남 얘기예요.' },
  perfect1: { name: '첫 만점', tier: 'common', group: 'study', stat: 'perfect', goal: 1, icon: 'star', how: '10문제 이상 100점 1번', desc: '처음 받아 본 100점의 짜릿함!' },
  win1: { name: '첫 승리', tier: 'common', group: 'yacha', stat: 'wins', goal: 1, icon: 'sword', how: '야차전 1승', desc: '야차전의 첫 승리를 거뒀어요.' },
  words500: { name: '단어 수집가', tier: 'rare', group: 'study', stat: 'correct', goal: 500, icon: 'book', how: '맞힌 단어 500개', desc: '머릿속에 단어 창고가 생겼어요.' },
  streak: { name: '일주일의 기적', tier: 'rare', group: 'study', stat: 'best_days', goal: 7, icon: 'flame', how: '7일 연속 학습', desc: '일주일 동안 하루도 쉬지 않았어요.' },
  perfect5: { name: '만점 제조기', tier: 'rare', group: 'study', stat: 'perfect', goal: 5, icon: 'star', how: '10문제 이상 100점 5번', desc: '100점이 이제 익숙해요.' },
  combo: { name: '10연속의 주인공', tier: 'rare', group: 'study', stat: 'combo', goal: 10, icon: 'bolt', how: '한 번에 10문제 연속 정답', desc: '멈추지 않는 정답 행진!' },
  pets4: { name: '펫 수집가', tier: 'rare', group: 'collect', stat: 'pets', goal: 4, icon: 'paw', how: '펫 4마리 만나기', desc: '펫 친구들이 늘어나고 있어요.' },
  win10: { name: '야차 전사', tier: 'rare', group: 'yacha', stat: 'wins', goal: 10, icon: 'sword', how: '야차전 10승', desc: '야차전이 두렵지 않은 전사.' },
  yacha3: { name: '3연승 돌풍', tier: 'rare', group: 'yacha', stat: 'win_streak', goal: 3, icon: 'bolt', how: '야차전 3연승', desc: '아무도 이 기세를 막을 수 없어요.' },
  words1000: { name: '단어 장인', tier: 'epic', group: 'study', stat: 'correct', goal: 1000, icon: 'gem', how: '맞힌 단어 1,000개', desc: '천 개의 단어를 다루는 장인.' },
  streak14: { name: '습관의 힘', tier: 'epic', group: 'study', stat: 'best_days', goal: 14, icon: 'flame', how: '14일 연속 학습', desc: '공부가 습관이 되었어요.' },
  perfect20: { name: '만점의 신', tier: 'epic', group: 'study', stat: 'perfect', goal: 20, icon: 'star', how: '10문제 이상 100점 20번', desc: '100점을 부르는 손.' },
  combo20: { name: '20연속 폭주', tier: 'epic', group: 'study', stat: 'combo', goal: 20, icon: 'bolt', how: '한 번에 20문제 연속 정답', desc: '정답 폭주 기관차!' },
  master: { name: '단어 마스터', tier: 'epic', group: 'study', stat: 'level', goal: 15, icon: 'book', how: 'Lv.15 달성', desc: '단어라면 자신 있어요.' },
  win50: { name: '야차 장군', tier: 'epic', group: 'yacha', stat: 'wins', goal: 50, icon: 'shield', how: '야차전 50승', desc: '수많은 대결을 이겨 낸 장군.' },
  yachaking: { name: '야차왕', tier: 'epic', group: 'yacha', stat: 'win_streak', goal: 5, icon: 'crown', how: '야차전 5연승', desc: '다섯 번 연속으로 이긴 야차의 왕.' },
  comeback: { name: '기적의 역전', tier: 'epic', group: 'yacha', stat: 'comebacks', goal: 1, icon: 'heart', how: 'HP를 5분의 1 이하로 남기고 승리', desc: '끝날 때까지 끝난 게 아니에요!' },
  flawless: { name: '퍼펙트 게임', tier: 'epic', group: 'yacha', stat: 'flawless', goal: 1, icon: 'target', how: 'HP 가득 그대로 승리', desc: '한 대도 맞지 않고 이겼어요.' },
  words3000: { name: '살아있는 사전', tier: 'legendary', group: 'study', stat: 'correct', goal: 3000, icon: 'gem', how: '맞힌 단어 3,000개', desc: '걸어 다니는 영어 사전.' },
  streak30: { name: '한 달의 전설', tier: 'legendary', group: 'study', stat: 'best_days', goal: 30, icon: 'flame', how: '30일 연속 학습', desc: '한 달 내내 멈추지 않은 전설.' },
  legend: { name: '한계를 넘어서', tier: 'legendary', group: 'study', stat: 'level', goal: 20, icon: 'wing', how: 'Lv.20 달성', desc: '한계를 넘어 최종 진화!' },
  pets8: { name: '펫 마스터', tier: 'legendary', group: 'collect', stat: 'pets', goal: 8, icon: 'paw', how: '펫 8마리 모두 만나기', desc: '모든 펫과 친구가 되었어요.' },
  win100: { name: '전설의 야차', tier: 'legendary', group: 'yacha', stat: 'wins', goal: 100, icon: 'crown', how: '야차전 100승', desc: '백 번을 이긴 전설의 야차.' },
  diamond: { name: '다이아 야차', tier: 'legendary', group: 'yacha', stat: 'league_best', goal: 3, icon: 'gem', how: '주간 야차 리그 다이아 달성', desc: '리그 꼭대기, 다이아 티어!' },
  champion: { name: 'SUMUS 챔피언', tier: 'legendary', group: 'yacha', stat: 'championships', goal: 1, icon: 'trophy', how: '학원 야차 대회 우승', desc: '학원 대회의 최강자.' },
  weekly1: { name: '주간 챔피언', tier: 'limited', group: 'limited', stat: 'weekly_rank', goal: 1, exact: true, icon: 'medal', how: '지난주 경험치 랭킹 1위 (우리 학년)', desc: '지난주 우리 학년에서 가장 열심히 공부했어요.' },
  weekly2: { name: '주간 은메달', tier: 'limited', group: 'limited', stat: 'weekly_rank', goal: 2, exact: true, icon: 'medal', how: '지난주 경험치 랭킹 2위 (우리 학년)', desc: '지난주 우리 학년 2위!' },
  weekly3: { name: '주간 동메달', tier: 'limited', group: 'limited', stat: 'weekly_rank', goal: 3, exact: true, icon: 'medal', how: '지난주 경험치 랭킹 3위 (우리 학년)', desc: '지난주 우리 학년 3위!' },
  leagueking: { name: '주간 야차왕', tier: 'limited', group: 'limited', stat: 'league_king', goal: 1, icon: 'crown', how: '지난주 야차 리그 1위', desc: '지난주 야차 리그를 제패했어요.' },
  // V13.73: more titles (출석, 로보, 펫 스킬, 선생님 선물, 실전시험, and higher goals).
  pets2: { name: '새 친구', tier: 'common', group: 'collect', stat: 'pets', goal: 2, icon: 'paw', how: '펫 2마리 만나기', desc: '두 번째 펫 친구가 생겼어요.' },
  study10: { name: '공부 습관', tier: 'common', group: 'study', stat: 'studies', goal: 10, icon: 'book', how: '10문제 이상 학습 10번', desc: '공부가 조금씩 몸에 배고 있어요.' },
  attend7: { name: '출석 도장', tier: 'common', group: 'study', stat: 'attendance', goal: 7, icon: 'calendar', how: '출석 체크 7번', desc: '도장 일곱 개, 꽉 찬 출석 카드!' },
  // V13.82 가위바위보 (놀이터).
  rps10: { name: '가위바위보 고수', tier: 'common', group: 'arcade', stat: 'rps_wins', goal: 10, icon: 'bolt', how: '가위바위보 10번 이기기', desc: '로보의 손이 보이기 시작했어요.' },
  rpsjack: { name: '×8 대박', tier: 'epic', group: 'arcade', stat: 'rps_jackpots', goal: 1, icon: 'flame', how: '가위바위보 3연승(×8) 달성', desc: '로보를 세 번 연속 이겼어요!' },
  rpsgod: { name: '가위바위보의 신', tier: 'legendary', group: 'arcade', stat: 'rps_jackpots', goal: 5, icon: 'crown', how: '가위바위보 ×8 대박 5번', desc: '운도 실력이라는 걸 보여 줬어요.' },
  bot1: { name: '로보 격파', tier: 'common', group: 'yacha', stat: 'bot_wins', goal: 1, icon: 'sword', how: '로보 연습 대결 1승', desc: '로보를 처음으로 이겼어요.' },
  gift1: { name: '선생님의 칭찬', tier: 'common', group: 'collect', stat: 'gifts', goal: 1, icon: 'heart', how: '선생님께 코인 선물 받기', desc: '선생님이 알아봐 주셨어요!' },
  level10: { name: '쑥쑥 성장', tier: 'rare', group: 'study', stat: 'level', goal: 10, icon: 'sprout', how: 'Lv.10 달성', desc: '어느새 이만큼 자랐어요.' },
  // V13.78: the level cap is 60; a title at each new card tier from Lv.30.
  level30: { name: '울트라 레어', tier: 'legendary', group: 'study', stat: 'level', goal: 30, icon: 'gem', how: 'Lv.30 달성', desc: '레벨 30, 이제 진짜 고수예요.' },
  level40: { name: '샤이니', tier: 'legendary', group: 'study', stat: 'level', goal: 40, icon: 'star', how: 'Lv.40 달성', desc: '레벨 40, 무지갯빛으로 반짝이는 실력.' },
  level50: { name: '살아있는 전설', tier: 'legendary', group: 'study', stat: 'level', goal: 50, icon: 'wing', how: 'Lv.50 달성', desc: '레벨 50에 오른 사람은 많지 않아요.' },
  level60: { name: 'MAX', tier: 'legendary', group: 'study', stat: 'level', goal: 60, icon: 'crown', how: 'Lv.60 달성', desc: 'Lv.60에 오른 학생. 레벨은 60 넘어서도 계속 올라가요.' },
  study50: { name: '성실한 학생', tier: 'rare', group: 'study', stat: 'studies', goal: 50, icon: 'book', how: '10문제 이상 학습 50번', desc: '꾸준함이 최고의 재능이에요.' },
  attend30: { name: '개근상', tier: 'rare', group: 'study', stat: 'attendance', goal: 30, icon: 'calendar', how: '출석 체크 30번', desc: '빠짐없이 출석하는 모범생.' },
  // V13.94 몬스터 잡기
  monster1: { name: '몬스터 사냥 입문', tier: 'common', group: 'monster', stat: 'monster_wins', goal: 1, icon: 'sword', how: '몬스터 1마리 처치', desc: '첫 몬스터를 쓰러뜨렸어요.' },
  monster10: { name: '몬스터 헌터', tier: 'rare', group: 'monster', stat: 'monster_wins', goal: 10, icon: 'target', how: '몬스터 10번 처치', desc: '몬스터들이 이름만 들어도 도망가요.' },
  monsterhard: { name: '하드 정복자', tier: 'epic', group: 'monster', stat: 'monster_hard', goal: 1, icon: 'flame', how: '하드 몬스터 1마리 처치', desc: '정말 어려운 하드 몬스터를 이겼어요!' },
  monsterlord: { name: '전설의 사냥꾼', tier: 'legendary', group: 'monster', stat: 'monster_hard', goal: 5, icon: 'crown', how: '하드 몬스터 5번 처치', desc: '하드 몬스터도 이 사냥꾼 앞에서는 떨어요.' },
  bothunter: { name: '로보 사냥꾼', tier: 'rare', group: 'yacha', stat: 'bot_hard_wins', goal: 5, icon: 'target', how: '어려움 로보 5번 이기기', desc: '어려운 로보도 문제없어요.' },
  skill10: { name: '스킬 달인', tier: 'rare', group: 'yacha', stat: 'skills', goal: 10, icon: 'bolt', how: '야차전에서 펫 스킬 10번 발동', desc: '연속 정답으로 펫의 힘을 깨웠어요.' },
  exam3: { name: '실전 강자', tier: 'rare', group: 'study', stat: 'exams', goal: 3, icon: 'target', how: '선생님 실전시험 3번 응시', desc: '실전에서도 떨지 않아요.' },
  words2000: { name: '단어 박사', tier: 'epic', group: 'study', stat: 'correct', goal: 2000, icon: 'gem', how: '맞힌 단어 2,000개', desc: '단어라면 물어보세요, 박사님!' },
  study150: { name: '공부의 신', tier: 'epic', group: 'study', stat: 'studies', goal: 150, icon: 'crown', how: '10문제 이상 학습 150번', desc: '공부의 신이 강림했어요.' },
  attend100: { name: '백일 출석', tier: 'epic', group: 'study', stat: 'attendance', goal: 100, icon: 'calendar', how: '출석 체크 100번', desc: '백 번의 출석, 백 번의 성장.' },
  combo30: { name: '30연속 불꽃', tier: 'epic', group: 'study', stat: 'combo', goal: 30, icon: 'flame', how: '한 번에 30문제 연속 정답', desc: '꺼지지 않는 정답 불꽃!' },
  skill50: { name: '펫과 한마음', tier: 'epic', group: 'yacha', stat: 'skills', goal: 50, icon: 'paw', how: '야차전에서 펫 스킬 50번 발동', desc: '펫과 호흡이 척척 맞아요.' },
  perfect50: { name: '만점 전설', tier: 'legendary', group: 'study', stat: 'perfect', goal: 50, icon: 'star', how: '10문제 이상 100점 50번', desc: '100점이 곧 이름이 되었어요.' },
  yacha10: { name: '무적의 야차', tier: 'legendary', group: 'yacha', stat: 'win_streak', goal: 10, icon: 'crown', how: '야차전 10연승', desc: '열 번 연속, 아무도 막지 못했어요.' }
};
// V13.143 던전 칭호(docs/dungeon-design.md 8번). 메달 그림은 /assets/titles/dungeon-*.webp(그림 23c).
// 주간 1위(dungeon-week)는 한정 칭호라 지난주 결과가 있는 동안만 가지고, 이긴 주마다 코인(DUNGEON_COINS.week_top)을 다시 준다.
Object.assign(TITLES, {
  'dungeon-first': { name: '던전 첫 클리어', tier: 'common', group: 'dungeon', stat: 'dungeon_clears', goal: 1, icon: 'shield', how: '던전 1번 클리어', desc: '친구들과 처음으로 킬러 골렘을 쓰러뜨렸어요.' },
  'dungeon-rank3': { name: '3등급 컷 돌파', tier: 'rare', group: 'dungeon', stat: 'dungeon_c3', goal: 1, icon: 'shield', how: '기말고사 지옥 3등급 컷 클리어', desc: '3등급 컷, 이제 시작이에요.' },
  'dungeon-rank2': { name: '2등급 컷 돌파', tier: 'epic', group: 'dungeon', stat: 'dungeon_c2', goal: 1, icon: 'wing', how: '기말고사 지옥 2등급 컷 클리어', desc: '2등급 컷을 넘은 실력파 파티.' },
  'dungeon-rank1': { name: '1등급 컷 돌파', tier: 'legendary', group: 'dungeon', stat: 'dungeon_c1', goal: 1, icon: 'crown', how: '기말고사 지옥 1등급 컷 클리어', desc: '가장 빡빡한 1등급 컷까지 깼어요.' },
  'dungeon-perfect': { name: '만점 도전자', tier: 'legendary', group: 'dungeon', stat: 'dungeon_max_floor', goal: 10, icon: 'gem', how: '만점 모드 10층 도달', desc: '끝없는 만점의 탑을 10층까지 올랐어요.' },
  'dungeon-flawless': { name: '무사고 클리어', tier: 'epic', group: 'dungeon', stat: 'dungeon_no_down', goal: 1, icon: 'heart', how: '아무도 기절하지 않고 던전 클리어', desc: '한 명도 쓰러지지 않은 완벽한 파티.' },
  'dungeon-record': { name: '신기록 메이커', tier: 'epic', group: 'dungeon', stat: 'dungeon_records', goal: 1, icon: 'bolt', how: '던전 역대 기록 1위 세우기 (봇 없이)', desc: '우리 학년 던전 역대 1위 기록을 세웠어요.' },
  'dungeon-hunter': { name: '던전 사냥꾼', tier: 'rare', group: 'dungeon', stat: 'dungeon_clears', goal: 10, icon: 'sword', how: '던전 10번 클리어', desc: '던전이 집처럼 편해요.' },
  'dungeon-week': { name: '던전 주간 1위', tier: 'limited', group: 'dungeon', stat: 'dungeon_week_king', goal: 1, icon: 'trophy', coins: 100, how: '지난주 던전 주간 보드 1위 파티 (우리 학년)', desc: '지난주 우리 학년 던전 보드 꼭대기!' }
});
// V13.148 칭호 2탄 40개(그림 25: /assets/titles/<key>.webp). 등급 테두리는 그림 그대로다.
Object.assign(TITLES, {
  // 교과서 · 시험
  unit1: { name: '한 과 정복', tier: 'rare', group: 'study', stat: 'units', goal: 1, icon: 'book', how: '한 과의 모든 단어를 정답률 95% 이상으로 정복', desc: '한 과를 완전히 내 것으로 만들었어요.' },
  unit3: { name: '교과서 정복자', tier: 'epic', group: 'study', stat: 'units', goal: 3, icon: 'book', how: '3개 과 정복(정답률 95% 이상)', desc: '교과서가 점점 내 손안에 들어와요.' },
  exam10: { name: '실전 베테랑', tier: 'epic', group: 'study', stat: 'exams', goal: 10, icon: 'target', how: '선생님 실전시험 10번 응시', desc: '실전 경험이 쌓인 베테랑.' },
  finalclear: { name: '기말 올클리어', tier: 'legendary', group: 'study', stat: 'exam_perfect', goal: 3, icon: 'star', how: '선생님 실전시험 100점 3번', desc: '시험지에 금빛 별이 세 번 찍혔어요.' },
  // 오답 극복
  fix50: { name: '오답 사냥꾼', tier: 'rare', group: 'study', stat: 'fixes', goal: 50, icon: 'target', how: '틀렸던 단어 50개를 다시 맞히기', desc: '틀린 단어를 끝까지 쫓아가요.' },
  fix200: { name: '실수는 없다', tier: 'epic', group: 'study', stat: 'fixes', goal: 200, icon: 'heart', how: '틀렸던 단어 200개를 다시 맞히기', desc: '한 번 틀린 단어는 다시 틀리지 않아요.' },
  fix500: { name: '오답 정복자', tier: 'legendary', group: 'study', stat: 'fixes', goal: 500, icon: 'crown', how: '틀렸던 단어 500개를 다시 맞히기', desc: '오답 노트가 텅 비었어요.' },
  // 꾸준함
  weekend10: { name: '주말에도 공부', tier: 'rare', group: 'study', stat: 'weekend_days', goal: 10, icon: 'calendar', how: '주말(토·일)에 공부한 날 10일', desc: '쉬는 날에도 단어를 챙겨요.' },
  morning30: { name: '아침형 학습자', tier: 'rare', group: 'study', stat: 'morning_studies', goal: 30, icon: 'sprout', how: '아침(5~9시)에 10문제 이상 학습 30번', desc: '하루를 단어로 여는 아침형 인간.' },
  streak60: { name: '두 달의 집념', tier: 'legendary', group: 'study', stat: 'best_days', goal: 60, icon: 'flame', how: '60일 연속 학습', desc: '두 달 동안 하루도 쉬지 않았어요.' },
  streak100: { name: '백일의 불꽃', tier: 'legendary', group: 'study', stat: 'best_days', goal: 100, icon: 'flame', how: '100일 연속 학습', desc: '백 일 동안 꺼지지 않은 불꽃.' },
  attend200: { name: '이백일의 약속', tier: 'legendary', group: 'study', stat: 'attendance', goal: 200, icon: 'calendar', how: '출석 체크 200번', desc: '이백 번의 약속을 지켰어요.' },
  attend365: { name: '일 년 개근', tier: 'legendary', group: 'study', stat: 'attendance', goal: 365, icon: 'calendar', how: '출석 체크 365번', desc: '일 년 내내 빠짐없이 출석!' },
  study300: { name: '공부 중독', tier: 'legendary', group: 'study', stat: 'studies', goal: 300, icon: 'book', how: '10문제 이상 학습 300번', desc: '공부를 멈출 수가 없어요.' },
  // 학습량
  words5000: { name: '걸어다니는 단어장', tier: 'legendary', group: 'study', stat: 'correct', goal: 5000, icon: 'gem', how: '맞힌 단어 5,000개', desc: '단어장이 걸어 다녀요.' },
  combo50: { name: '50연속 신화', tier: 'legendary', group: 'study', stat: 'combo', goal: 50, icon: 'bolt', how: '한 번에 50문제 연속 정답', desc: '50번 연속, 신화가 되었어요.' },
  perfect100: { name: '만점 제조 공장', tier: 'legendary', group: 'study', stat: 'perfect', goal: 100, icon: 'star', how: '10문제 이상 100점 100번', desc: '100점이 공장처럼 찍혀 나와요.' },
  // 이벤트
  event10: { name: '이벤트 사냥꾼', tier: 'rare', group: 'study', stat: 'event_studies', goal: 10, icon: 'bolt', how: '보상 이벤트 중에 학습 10번', desc: '이벤트는 놓치지 않아요.' },
  eventlover: { name: '축제의 주인공', tier: 'epic', group: 'study', stat: 'event_studies', goal: 50, icon: 'star', how: '보상 이벤트 중에 학습 50번', desc: '이벤트가 열리면 언제나 이 자리에!' },
  // 야차전
  away1: { name: '원정 첫 승', tier: 'common', group: 'yacha', stat: 'away_wins', goal: 1, icon: 'sword', how: '다른 학교 친구에게 야차전 1승', desc: '다른 학교에서 첫 승리를 거뒀어요.' },
  away10: { name: '원정 대장', tier: 'epic', group: 'yacha', stat: 'away_wins', goal: 10, icon: 'shield', how: '다른 학교 친구에게 야차전 10승', desc: '어느 학교와 붙어도 자신 있어요.' },
  rematch10: { name: '다시 한 판!', tier: 'rare', group: 'yacha', stat: 'rematches', goal: 10, icon: 'bolt', how: '같은 친구와 10분 안에 다시 대결 10번', desc: '한 판 더! 끝날 때까지 끝난 게 아니에요.' },
  comeback5: { name: '역전의 명수', tier: 'legendary', group: 'yacha', stat: 'comebacks', goal: 5, icon: 'heart', how: 'HP를 5분의 1 이하로 남기고 5번 승리', desc: '역전이 특기예요.' },
  win200: { name: '야차의 전설', tier: 'legendary', group: 'yacha', stat: 'wins', goal: 200, icon: 'crown', how: '야차전 200승', desc: '이백 번을 이긴 전설.' },
  skill100: { name: '펫과 일심동체', tier: 'legendary', group: 'yacha', stat: 'skills', goal: 100, icon: 'paw', how: '야차전에서 펫 스킬 100번 발동', desc: '펫과 한 몸처럼 움직여요.' },
  // 펫 · 수집
  legend1: { name: '전설과의 만남', tier: 'epic', group: 'collect', stat: 'legend_pets', goal: 1, icon: 'wing', how: '전설 펫 만나기', desc: '전설 속 펫이 곁에 왔어요.' },
  mythic1: { name: '신화의 주인', tier: 'limited', once: true, group: 'collect', stat: 'mythic_pets', goal: 1, icon: 'crown', how: '신화 펫 만나기', desc: '신화 속 펫의 주인이 되었어요.' },
  pets12: { name: '펫 대가족', tier: 'epic', group: 'collect', stat: 'pets', goal: 12, icon: 'paw', how: '펫 12마리 만나기', desc: '펫 가족이 북적북적해요.' },
  pets20: { name: '펫 박물관', tier: 'legendary', group: 'collect', stat: 'pets', goal: 20, icon: 'paw', how: '펫 20마리 만나기', desc: '펫 박물관을 열어도 되겠어요.' },
  pets30: { name: '살아있는 도감', tier: 'legendary', group: 'collect', stat: 'pets', goal: 30, icon: 'book', how: '펫 30마리 만나기', desc: '펫 도감이 살아 움직여요.' },
  // V13.168 12지 수호자: 12지 펫(core.js ZODIAC_PET_KEYS) 12마리를 모두 만나면. 새 12지 펫 6종은 그림이 들어온 뒤에 만날 수 있다.
  zodiac12: { name: '12지 수호자', tier: 'legendary', group: 'collect', stat: 'zodiac_pets', goal: 12, icon: 'crown', how: '12지 펫 12마리 모두 만나기(쥐 · 소 · 호랑이 · 토끼 · 용 · 뱀 · 말 · 양 · 원숭이 · 닭 · 개 · 돼지)', desc: '열두 띠 친구들이 모두 모였어요.' },
  seasonall: { name: '시즌 컬렉터', tier: 'epic', group: 'collect', stat: 'season_pets', goal: 3, icon: 'gem', how: '한정 펫 3마리 만나기', desc: '시즌마다 한정 펫을 놓치지 않아요.' },
  egg10: { name: '알 콜렉터', tier: 'common', group: 'collect', stat: 'eggs', goal: 5, icon: 'heart', how: '상점에서 알 5개 열기', desc: '알을 모으는 재미에 빠졌어요.' },
  egg50: { name: '알 부화 장인', tier: 'epic', group: 'collect', stat: 'eggs', goal: 20, icon: 'gem', how: '상점에서 알 20개 열기', desc: '알을 깨우는 손길이 장인급.' },
  gift5: { name: '선생님의 보물', tier: 'rare', group: 'collect', stat: 'gifts', goal: 5, icon: 'heart', how: '선생님께 코인 선물 5번 받기', desc: '선생님이 아끼는 보물 같은 학생.' },
  petcare30: { name: '정성 가득 집사', tier: 'rare', group: 'collect', stat: 'care', goal: 30, icon: 'paw', how: '펫 쓰다듬기 · 밥 주기 30번', desc: '펫을 정성껏 돌보는 집사.' },
  // 놀이터
  lucky2: { name: '오늘은 운수 대통', tier: 'epic', group: 'arcade', stat: 'lucky_best_day', goal: 2, icon: 'star', how: '코인 뽑기에서 하루에 3배 2번', desc: '오늘은 뭘 해도 되는 날!' },
  // V13.180 인형뽑기(놀이터): 도감 · 황금 인형 · 뽑은 수.
  claw1: { name: '첫 인형', tier: 'common', group: 'arcade', stat: 'claw_dolls', goal: 1, icon: 'star', how: '인형뽑기에서 인형 1개 뽑기', desc: '집게가 처음으로 꽉 잡았어요!' },
  claw6: { name: '인형 수집가', tier: 'rare', group: 'arcade', stat: 'claw_kinds', goal: 6, icon: 'heart', how: '인형뽑기 도감 6종 모으기', desc: '띠 인형 친구가 반이나 모였어요.' },
  claw12: { name: '인형뽑기 장인', tier: 'epic', group: 'arcade', stat: 'claw_kinds', goal: 12, icon: 'trophy', how: '인형뽑기 도감 12종 모두 모으기', desc: '열두 띠 인형을 모두 뽑았어요.' },
  clawgold: { name: '황금 손', tier: 'rare', group: 'arcade', stat: 'claw_gold', goal: 1, icon: 'gem', how: '인형뽑기에서 황금 인형 1개 뽑기', desc: '반짝이는 황금 인형을 잡았어요!' },
  claw100: { name: '집게의 전설', tier: 'legendary', group: 'arcade', stat: 'claw_dolls', goal: 100, icon: 'crown', how: '인형뽑기에서 인형 100개 뽑기', desc: '이 동네 인형뽑기 기계가 다 아는 이름.' },
  rps50: { name: '가위바위보 달인', tier: 'rare', group: 'arcade', stat: 'rps_wins', goal: 50, icon: 'bolt', how: '가위바위보 50번 이기기', desc: '로보의 다음 손이 다 보여요.' },
  // 몬스터
  monster50: { name: '몬스터 퇴치 전문가', tier: 'epic', group: 'monster', stat: 'monster_wins', goal: 50, icon: 'target', how: '몬스터 50번 처치', desc: '몬스터 퇴치라면 맡겨 주세요.' },
  monster100: { name: '몬스터 킬러', tier: 'legendary', group: 'monster', stat: 'monster_wins', goal: 100, icon: 'sword', how: '몬스터 100번 처치', desc: '백 마리의 몬스터를 쓰러뜨렸어요.' },
  boss10: { name: '보스 슬레이어', tier: 'legendary', group: 'monster', stat: 'boss_wins', goal: 10, icon: 'crown', how: '보스 몬스터(5레벨마다) 10번 처치', desc: '보스만 골라 잡는 슬레이어.' }
});
// V13.182 전설 알 칭호(docs/legend-egg-design.md). 메달 그림은 아직 없어 SVG 메달(그림이 오면 emblems.js TITLE_ART에 키만 넣는다).
// 도감 마스터는 영웅 펫 전부(EPIC_PET_KEYS): 영웅 펫이 늘면 기준도 따라 늘어난다.
Object.assign(TITLES, {
  'epic-collector': { name: '영웅 수집가', tier: 'epic', group: 'collect', stat: 'epic_pets', goal: LEGEND_EGG_EPIC_NEED, icon: 'shield', how: `영웅 펫 ${LEGEND_EGG_EPIC_NEED}마리 만나기`, desc: '영웅들이 모여 전설 알을 데려왔어요.' },
  'legend-owner': { name: '전설의 주인', tier: 'legendary', group: 'collect', stat: 'legend_egg', goal: 1, icon: 'wing', how: '전설 알 보상 받기(전설 알을 열거나, 이미 전설 펫이 있어 대신 받는 보상)', desc: '전설 알의 주인이 되었어요.' },
  'epic-dex': { name: '도감 마스터', tier: 'legendary', group: 'collect', stat: 'epic_pets', goal: EPIC_PET_KEYS.length, icon: 'book', how: '영웅 펫 모두 만나기', desc: '영웅 도감을 빈칸 없이 채웠어요.' }
});
// V13.180 10초 맞추기 칭호(놀이터). 서버가 시간을 믿은 판(순위에 들어가는 판)만 센다. 메달 그림은 아직 없어 SVG 메달.
Object.assign(TITLES, {
  'timing-clock': { name: '시계 장인', tier: 'rare', group: 'arcade', stat: 'timing_perfect', goal: 10, icon: 'target', how: '10초 맞추기 완벽(±0.05초) 10번', desc: '째깍째깍, 머릿속에 시계가 있어요.' },
  'timing-ten': { name: '딱 10.00', tier: 'epic', group: 'arcade', stat: 'timing_ten', goal: 1, icon: 'star', how: '10초 맞추기에서 정확히 10.00초', desc: '0.01초도 틀리지 않았어요.' },
  'timing-human': { name: '인간 초시계', tier: 'legendary', group: 'arcade', stat: 'timing_streak', goal: 3, icon: 'crown', how: '10초 맞추기 완벽 3번 연속', desc: '세 번 연속 0.05초 안. 초시계가 울고 가요.' }
});
// V13.67: titles that came out of the capsule machine. V13.68 retired the machine: they stay
// with the students who have them and are not shown to anyone else (`retired`).
Object.assign(TITLES, {
  g_lucky: { name: '행운의 주인공', tier: 'rare', group: 'gacha', stat: 'item_title_lucky', goal: 1, icon: 'heart', how: '예전 뽑기 머신에서 나온 칭호', desc: '오늘도 운이 좋은 하루!', retired: true },
  g_golden: { name: '황금 손', tier: 'epic', group: 'gacha', stat: 'item_title_golden', goal: 1, icon: 'gem', how: '예전 뽑기 머신에서 나온 칭호', desc: '뽑기만 하면 대박!', retired: true },
  g_god: { name: '뽑기의 신', tier: 'legendary', group: 'gacha', stat: 'item_title_god', goal: 1, icon: 'crown', how: '예전 뽑기 머신에서 나온 칭호', desc: '전설을 뽑아낸 행운의 주인공.', retired: true }
});
export const TITLE_KEYS = Object.keys(TITLES);
// 주마다 다시 정해지는 한정 칭호(지난주 결과로만 갖는다). `once`인 한정 테두리 칭호는 아니다.
export const weeklyTitle = key => TITLES[key]?.tier === 'limited' && !TITLES[key].once;
// The titles a student sees in the collection: all but retired ones they do not have.
export const visibleTitleKeys = unlocked => TITLE_KEYS.filter(key => !TITLES[key].retired || unlocked.includes(key));

export function titleUnlocked(key, stats = {}) {
  const t = TITLES[key];
  if (!t) return false;
  const value = Number(stats[t.stat] || 0);
  return t.exact ? value === t.goal : value >= t.goal;
}
// [value, goal] for a progress bar; limited titles have no progress (a rank either is or isn't).
export function titleProgress(key, stats = {}) {
  const t = TITLES[key];
  if (!t || t.exact || weeklyTitle(key) || t.group === 'gacha') return null;
  return [Math.min(t.goal, Math.max(0, Number(stats[t.stat] || 0))), t.goal];
}

// Weekly yacha league: 3 points a win, 1 a draw. Among the same two friends only the first
// three matches of a day count, so trading wins does not climb the league.
export const LEAGUE_POINTS = { win: 3, draw: 1, loss: 0 };
export const LEAGUE_PAIR_DAY_CAP = 3;
export const LEAGUE_TIERS = [
  { key: 'bronze', name: '브론즈', min: 0 },
  { key: 'silver', name: '실버', min: 6 },
  { key: 'gold', name: '골드', min: 15 },
  { key: 'diamond', name: '다이아', min: 30 }
];
export const leagueTierIndex = points => LEAGUE_TIERS.reduce((index, tier, i) => (Number(points) >= tier.min ? i : index), 0);
export function leagueTier(points = 0) {
  const index = leagueTierIndex(points), tier = LEAGUE_TIERS[index], next = LEAGUE_TIERS[index + 1] || null;
  return { index, key: tier.key, name: tier.name, min: tier.min, next: next ? { key: next.key, name: next.name, min: next.min, need: Math.max(0, next.min - Number(points || 0)) } : null };
}
