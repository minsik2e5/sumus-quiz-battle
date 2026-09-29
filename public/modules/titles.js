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
//   comebacks    wins with 20 HP or less left
//   flawless     wins with all 100 HP left
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
// Limited titles belong to one week: they are held only while last week's result stands.

export const TITLE_TIERS = {
  common: { name: '일반', order: 1 },
  rare: { name: '희귀', order: 2 },
  epic: { name: '영웅', order: 3 },
  legendary: { name: '전설', order: 4 },
  limited: { name: '한정', order: 5 }
};
export const TITLE_GROUPS = { study: '학습', yacha: '야차전', collect: '수집', gacha: '뽑기', limited: '한정' };
// V13.73: coins for a new title, by tier (paid once when the student first sees it; a limited
// title pays again each week it is won). 첫걸음 and retired capsule titles pay nothing.
export const TITLE_COINS = { common: 10, rare: 30, epic: 60, legendary: 120, limited: 60 };
export const titleCoins = key => key === 'rookie' || !TITLES[key] || TITLES[key].retired ? 0 : TITLE_COINS[TITLES[key].tier] || 0;

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
  comeback: { name: '기적의 역전', tier: 'epic', group: 'yacha', stat: 'comebacks', goal: 1, icon: 'heart', how: 'HP 20 이하로 남기고 승리', desc: '끝날 때까지 끝난 게 아니에요!' },
  flawless: { name: '퍼펙트 게임', tier: 'epic', group: 'yacha', stat: 'flawless', goal: 1, icon: 'target', how: 'HP 100 그대로 승리', desc: '한 대도 맞지 않고 이겼어요.' },
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
  bot1: { name: '로보 격파', tier: 'common', group: 'yacha', stat: 'bot_wins', goal: 1, icon: 'sword', how: '로보 연습 대결 1승', desc: '로보를 처음으로 이겼어요.' },
  gift1: { name: '선생님의 칭찬', tier: 'common', group: 'collect', stat: 'gifts', goal: 1, icon: 'heart', how: '선생님께 코인 선물 받기', desc: '선생님이 알아봐 주셨어요!' },
  level10: { name: '쑥쑥 성장', tier: 'rare', group: 'study', stat: 'level', goal: 10, icon: 'sprout', how: 'Lv.10 달성', desc: '어느새 이만큼 자랐어요.' },
  study50: { name: '성실한 학생', tier: 'rare', group: 'study', stat: 'studies', goal: 50, icon: 'book', how: '10문제 이상 학습 50번', desc: '꾸준함이 최고의 재능이에요.' },
  attend30: { name: '개근상', tier: 'rare', group: 'study', stat: 'attendance', goal: 30, icon: 'calendar', how: '출석 체크 30번', desc: '빠짐없이 출석하는 모범생.' },
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
// V13.67: titles that came out of the capsule machine. V13.68 retired the machine: they stay
// with the students who have them and are not shown to anyone else (`retired`).
Object.assign(TITLES, {
  g_lucky: { name: '행운의 주인공', tier: 'rare', group: 'gacha', stat: 'item_title_lucky', goal: 1, icon: 'heart', how: '예전 뽑기 머신에서 나온 칭호', desc: '오늘도 운이 좋은 하루!', retired: true },
  g_golden: { name: '황금 손', tier: 'epic', group: 'gacha', stat: 'item_title_golden', goal: 1, icon: 'gem', how: '예전 뽑기 머신에서 나온 칭호', desc: '뽑기만 하면 대박!', retired: true },
  g_god: { name: '뽑기의 신', tier: 'legendary', group: 'gacha', stat: 'item_title_god', goal: 1, icon: 'crown', how: '예전 뽑기 머신에서 나온 칭호', desc: '전설을 뽑아낸 행운의 주인공.', retired: true }
});
export const TITLE_KEYS = Object.keys(TITLES);
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
  if (!t || t.exact || t.tier === 'limited' || t.group === 'gacha') return null;
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
