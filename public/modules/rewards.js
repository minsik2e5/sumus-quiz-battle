// Coin rewards and games, shared by the server (which decides) and the app (which draws): daily
// attendance (출석 체크), the coin capsule (코인 뽑기, V13.68) and, since V13.70, the small rewards
// for practice matches against the robot and for teacher exams (실전시험).

// Attendance: one stamp a day (days in a row are not required). The 7th stamp of a card gives
// the most coins and a free coin capsule (뽑기권), then a new card starts.
export const ATTENDANCE_REWARDS = [10, 10, 15, 15, 20, 20, 50];
export const ATTENDANCE_TICKETS = 1; // free coin capsules on the 7th stamp

// V13.68 coin capsule: bet coins, the capsule says how many times the bet comes back. The odds
// are shown on the machine; on average a little less comes back than is bet, so study stays the
// way to earn coins. A free capsule (뽑기권) plays a 10-coin bet without paying or counting.
export const LUCKY_BETS = [10, 20, 30];
export const LUCKY_DAILY = 3;
export const LUCKY_TICKET_BET = 10;
export const LUCKY_ODDS = [
  { mult: 0, rate: 45, name: '꽝' },
  { mult: 1, rate: 25, name: '본전' },
  { mult: 2, rate: 20, name: '2배' },
  { mult: 3, rate: 10, name: '3배' }
];
export function drawLucky(random) {
  let roll = random() * 100;
  for (const odd of LUCKY_ODDS) { if (roll < odd.rate) return odd; roll -= odd.rate; }
  return LUCKY_ODDS[0];
}

// Decorations from the V13.67 capsule machine (retired in V13.68): students who pulled them keep
// wearing them, nobody can get new ones. Auras are worn as the frame; titles are equipped.
export const GACHA_TIERS = { common: { name: '일반' }, rare: { name: '희귀' }, epic: { name: '영웅' }, legendary: { name: '전설' } };
export const GACHA_TIER_KEYS = Object.keys(GACHA_TIERS);
export const GACHA_KINDS = { aura: '오라', title: '칭호' };
export const GACHA_ITEMS = {
  aura_mint: { kind: 'aura', tier: 'common', name: '민트 오라', wear: 'g_mint', desc: '시원한 민트빛이 감싸요.' },
  aura_peach: { kind: 'aura', tier: 'common', name: '복숭아 오라', wear: 'g_peach', desc: '말랑한 복숭아빛 기운.' },
  aura_sakura: { kind: 'aura', tier: 'rare', name: '벚꽃 오라', wear: 'g_sakura', desc: '벚꽃 잎이 살랑살랑 흩날려요.' },
  aura_ocean: { kind: 'aura', tier: 'rare', name: '바다 오라', wear: 'g_ocean', desc: '파도처럼 넘실대는 푸른 빛.' },
  aura_sunset: { kind: 'aura', tier: 'rare', name: '노을 오라', wear: 'g_sunset', desc: '해 질 녘 하늘을 닮았어요.' },
  title_lucky: { kind: 'title', tier: 'rare', name: '행운의 주인공', title: 'g_lucky', desc: '뽑기에서 나온 칭호.' },
  aura_fire: { kind: 'aura', tier: 'epic', name: '불꽃 오라', wear: 'g_fire', desc: '활활 타오르는 열정!' },
  aura_thunder: { kind: 'aura', tier: 'epic', name: '번개 오라', wear: 'g_thunder', desc: '찌릿찌릿 번개가 번쩍.' },
  title_golden: { kind: 'title', tier: 'epic', name: '황금 손', title: 'g_golden', desc: '뽑기만 하면 대박!' },
  aura_galaxy: { kind: 'aura', tier: 'legendary', name: '은하수 오라', wear: 'g_galaxy', desc: '별이 도는 은하수를 두른 펫.' },
  aura_prism: { kind: 'aura', tier: 'legendary', name: '프리즘 오라', wear: 'g_prism', desc: '빛이 무지갯빛으로 흘러요.' },
  title_god: { kind: 'title', tier: 'legendary', name: '뽑기의 신', title: 'g_god', desc: '전설을 뽑아낸 행운의 주인공.' }
};
export const GACHA_KEYS = Object.keys(GACHA_ITEMS);
export const ownedDecorations = items => GACHA_KEYS.filter(key => Number(items?.[key] || 0) > 0);

// V13.70 practice match against the robot (로보와 연습 대결): a few coins and 경험치 for the
// partner pet. A win pays by the robot's level; a loss or draw still pays a little. The first
// BOT_DAILY matches of a day pay, and only if the student answered BOT_MIN_RIGHT words right.
export const BOT_WIN_REWARDS = { easy: { coins: 3, xp: 40 }, normal: { coins: 5, xp: 60 }, hard: { coins: 8, xp: 80 } };
export const BOT_TRY_REWARD = { coins: 2, xp: 30 };
export const BOT_DAILY = 5;
export const BOT_MIN_RIGHT = 3;
export const BOT_MIN_MS = 15000; // a match cannot be over faster than this
export function botReward(level, result) {
  return result === 'win' ? (BOT_WIN_REWARDS[level] || BOT_WIN_REWARDS.normal) : BOT_TRY_REWARD;
}

// V13.70 teacher exams (실전시험): 경험치 for every question answered (not for right answers, so a
// result the teacher has not released stays hidden) and coins for finishing at least half of it.
// Only the first submitted attempt of an exam pays.
export const EXAM_XP_PER_ANSWER = 10;
export const EXAM_COINS = 10;
