// V13.67 coin rewards and games, shared by the server (which decides) and the app (which draws):
// daily attendance (출석 체크), the capsule machine (뽑기) and the word double chance (더블 찬스).

// Attendance: one stamp a day (days in a row are not required). The 7th stamp of a card gives
// the most coins and a free capsule ticket, then a new card starts.
export const ATTENDANCE_REWARDS = [10, 10, 15, 15, 20, 20, 50];
export const ATTENDANCE_TICKETS = 1; // capsule tickets on the 7th stamp

// Capsule machine. Every capsule is a decoration that only comes out of the machine: an aura
// around the pet (worn as the frame), a badge (worn as the accessory) or a title. The odds are
// shown on the machine. A repeat gives some coins back; no rare-or-better in GACHA_PITY - 1
// pulls makes the next one at least rare.
export const GACHA_PRICE = 60;
export const GACHA_PITY = 10;
export const GACHA_TIERS = {
  common: { name: '일반', rate: 62, refund: 10 },
  rare: { name: '희귀', rate: 27, refund: 20 },
  epic: { name: '영웅', rate: 9, refund: 40 },
  legendary: { name: '전설', rate: 2, refund: 100 }
};
export const GACHA_TIER_KEYS = Object.keys(GACHA_TIERS);
export const GACHA_KINDS = { aura: '오라', badge: '배지', title: '칭호' };
// `wear`: the frame / accessory key the item puts on the pet (see core.js FRAMES, ACCESSORIES).
export const GACHA_ITEMS = {
  badge_heart: { kind: 'badge', tier: 'common', name: '하트 배지', wear: 'g_heart', desc: '펫 옆에 콩닥콩닥 하트.' },
  badge_note: { kind: 'badge', tier: 'common', name: '음표 배지', wear: 'g_note', desc: '흥얼흥얼 노래하는 펫.' },
  badge_clover: { kind: 'badge', tier: 'common', name: '네잎클로버 배지', wear: 'g_clover', desc: '행운이 따라다녀요.' },
  badge_cloud: { kind: 'badge', tier: 'common', name: '구름 배지', wear: 'g_cloud', desc: '몽글몽글 구름 한 조각.' },
  badge_candy: { kind: 'badge', tier: 'common', name: '사탕 배지', wear: 'g_candy', desc: '달콤한 공부 시간.' },
  aura_mint: { kind: 'aura', tier: 'common', name: '민트 오라', wear: 'g_mint', desc: '시원한 민트빛이 감싸요.' },
  aura_peach: { kind: 'aura', tier: 'common', name: '복숭아 오라', wear: 'g_peach', desc: '말랑한 복숭아빛 기운.' },
  aura_sakura: { kind: 'aura', tier: 'rare', name: '벚꽃 오라', wear: 'g_sakura', desc: '벚꽃 잎이 살랑살랑 흩날려요.' },
  aura_ocean: { kind: 'aura', tier: 'rare', name: '바다 오라', wear: 'g_ocean', desc: '파도처럼 넘실대는 푸른 빛.' },
  aura_sunset: { kind: 'aura', tier: 'rare', name: '노을 오라', wear: 'g_sunset', desc: '해 질 녘 하늘을 닮았어요.' },
  badge_rocket: { kind: 'badge', tier: 'rare', name: '로켓 배지', wear: 'g_rocket', desc: '점수가 로켓처럼 슝!' },
  badge_gem: { kind: 'badge', tier: 'rare', name: '보석 배지', wear: 'g_gem', desc: '반짝반짝 빛나는 보석.' },
  title_lucky: { kind: 'title', tier: 'rare', name: '행운의 주인공', title: 'g_lucky', desc: '뽑기에서만 나오는 칭호.' },
  aura_fire: { kind: 'aura', tier: 'epic', name: '불꽃 오라', wear: 'g_fire', desc: '활활 타오르는 열정!' },
  aura_thunder: { kind: 'aura', tier: 'epic', name: '번개 오라', wear: 'g_thunder', desc: '찌릿찌릿 번개가 번쩍.' },
  badge_rainbow: { kind: 'badge', tier: 'epic', name: '무지개 배지', wear: 'g_rainbow', desc: '일곱 빛깔 무지개.' },
  title_golden: { kind: 'title', tier: 'epic', name: '황금 손', title: 'g_golden', desc: '뽑기만 하면 대박!' },
  aura_galaxy: { kind: 'aura', tier: 'legendary', name: '은하수 오라', wear: 'g_galaxy', desc: '별이 도는 은하수를 두른 펫.' },
  aura_prism: { kind: 'aura', tier: 'legendary', name: '프리즘 오라', wear: 'g_prism', desc: '빛이 무지갯빛으로 흘러요.' },
  title_god: { kind: 'title', tier: 'legendary', name: '뽑기의 신', title: 'g_god', desc: '전설을 뽑아낸 단 한 명.' }
};
export const GACHA_KEYS = Object.keys(GACHA_ITEMS);
export const gachaItemByWear = wear => GACHA_KEYS.find(key => GACHA_ITEMS[key].wear === wear) || null;
export const gachaItemByTitle = title => GACHA_KEYS.find(key => GACHA_ITEMS[key].title === title) || null;

// One capsule: tier by the odds (at least rare when the pity counter is full), then an item
// of that tier, all equally likely. `random` returns [0, 1).
export function drawCapsule(random, sinceRare = 0) {
  let roll = random() * 100, tier = 'common';
  for (const key of GACHA_TIER_KEYS) { if (roll < GACHA_TIERS[key].rate) { tier = key; break; } roll -= GACHA_TIERS[key].rate; }
  const pity = tier === 'common' && sinceRare >= GACHA_PITY - 1;
  if (pity) tier = 'rare';
  const pool = GACHA_KEYS.filter(key => GACHA_ITEMS[key].tier === tier);
  return { key: pool[Math.floor(random() * pool.length)] || pool[0], tier, pity };
}

// Word double chance: bet coins, answer a word, and each right answer doubles the pot. After
// a right answer the student keeps the pot or goes on; three steps at most. A wrong answer or
// running out of time loses the pot. Only words the student has already studied come up.
export const CHANCE_BETS = [10, 20];
export const CHANCE_DAILY = 3;
export const CHANCE_STEPS = [
  { kind: 'choice', dir: 'eng2mean', mult: 2, ms: 12000, name: '뜻 고르기' },
  { kind: 'choice', dir: 'mean2eng', mult: 4, ms: 12000, name: '단어 고르기' },
  { kind: 'spell', mult: 8, ms: 20000, name: '철자 쓰기' }
];
export const CHANCE_MIN_WORDS = 8;
