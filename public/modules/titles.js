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
// Limited titles belong to one week: they are held only while last week's result stands.

export const TITLE_TIERS = {
  common: { name: '일반', order: 1 },
  rare: { name: '희귀', order: 2 },
  epic: { name: '영웅', order: 3 },
  legendary: { name: '전설', order: 4 },
  limited: { name: '한정', order: 5 }
};
export const TITLE_GROUPS = { study: '학습', yacha: '야차전', collect: '수집', limited: '한정' };

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
  leagueking: { name: '주간 야차왕', tier: 'limited', group: 'limited', stat: 'league_king', goal: 1, icon: 'crown', how: '지난주 야차 리그 1위', desc: '지난주 야차 리그를 제패했어요.' }
};
export const TITLE_KEYS = Object.keys(TITLES);

export function titleUnlocked(key, stats = {}) {
  const t = TITLES[key];
  if (!t) return false;
  const value = Number(stats[t.stat] || 0);
  return t.exact ? value === t.goal : value >= t.goal;
}
// [value, goal] for a progress bar; limited titles have no progress (a rank either is or isn't).
export function titleProgress(key, stats = {}) {
  const t = TITLES[key];
  if (!t || t.exact || t.tier === 'limited') return null;
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
