// Release checks for V13.67: 실력전 (spelling words in yacha), daily attendance (출석 체크) and the
// capsule machine (뽑기); V13.70: 경험치 and coins from robot matches and teacher exams, and the
// retired word double chance; V13.76: 펫 교감, ⭐ 어려운 단어 on the account, and the 실전시험
// countdown and leave record.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { emptyState } from './state.mjs';
import { passwordHash, publicProfile, hashToken } from './auth.mjs';
import { service, scopedWords, sweep } from './service.mjs';
import { DAY_MS, rankingWeek } from './competition.mjs';
import { dayKey, unlocked, FRAMES, ACCESSORIES, MAX_LEVEL, CARD_TIERS, cardTier, levelInfo, PET_CARE, PET_MISS_DAYS, TEST_SECONDS_PER_QUESTION, testDurationSec, TEST_LEAVE_LIMIT, STARS_MAX } from '../public/modules/core.js';
import { TITLES, TITLE_KEYS, visibleTitleKeys } from '../public/modules/titles.js';
import { createBattle, connect, answer, tick, battleView, SKILL_RULES, BATTLE } from '../public/modules/battle-engine.js';
import { battleQuestions, spellHint, spellable } from '../public/modules/battle-questions.js';
import { createPracticeMatch } from '../public/modules/battle-bot.js';
import { ATTENDANCE_REWARDS, GACHA_KEYS, LUCKY_BETS, LUCKY_DAILY, LUCKY_ODDS, drawLucky, BOT_WIN_REWARDS, BOT_TRY_REWARD, BOT_DAILY, EXAM_XP_PER_ANSWER, EXAM_COINS, RPS_BETS, RPS_DAILY, RPS_MAX_WINS, RPS_KEYS, RPS_STALE_MS, rpsOutcome } from '../public/modules/rewards.js';
import { addBonus, bonusRecords, tidyProfileLogs, BADGE_REFUND, rpsPlay, rpsCash, rewardIncome } from './rewards.mjs';
import { marketPrices } from './market.mjs';
import { STOCKS, MARKET, tradeFee, newsText } from '../public/modules/market.js';

const source = path => readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8');
// A small deterministic random source for the odds checks.
const seeded = seed => () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };

export async function runRewardsChecks(assert, expectStatus) {
  const now = Date.now();
  const state = emptyState();
  const hash = await passwordHash('QaRewards1!');
  const student = (id, name, extra = {}) => ({ id, username: id, display_name: name, role: 'student', active: true, class_name: '고1A', school_id: 'danwon-high', school: '단원고', division: 'high', password_hash: hash, pets: [{ key: 'dog', first: true, acquired_at: now - 9 * DAY_MS }], avatar_key: 'dog', created_at: now - 9 * DAY_MS, ...extra });
  state.profiles.push(
    { id: 'qa-rw-teacher', username: 'qa_rw_teacher', display_name: '보상 선생님', role: 'teacher', active: true, password_hash: hash, school_ids: ['danwon-high'], division_ids: ['high'], active_division: 'high', active_school_id: 'danwon-high', created_at: now - 9 * DAY_MS },
    student('qa-rw-a', '가온'), student('qa-rw-b', '나래'), student('qa-rw-c', '다온')
  );
  const login = async username => (await service(state, 'POST', '/login', { username, password: 'QaRewards1!', division: 'high', role: username.includes('teacher') ? 'teacher' : undefined }, null))._cookie;
  const tokens = {};
  for (const id of ['qa_rw_teacher', 'qa-rw-a', 'qa-rw-b', 'qa-rw-c']) tokens[id] = await login(id);
  const profile = id => state.profiles.find(p => p.id === id);
  const balance = async id => (await service(state, 'GET', '/rewards', {}, tokens[id])).points_balance;
  // Study coins to spend: 400 coins each.
  for (const id of ['qa-rw-a', 'qa-rw-b', 'qa-rw-c']) state.sessions.push({ id: `qa-rw-s-${id}`, student_id: id, division: 'high', school_id: 'danwon-high', school: '단원고', mode: 'eng2mean', run_mode: 'practice', total: 20, correct: 18, answered_count: 20, score: 90, xp: 200, reward_points: 400, created_at: now - DAY_MS });
  const range = ['24'];
  const words = scopedWords(state, 'danwon-high', range, '고1A');

  /* ---------- 실력전 ---------- */
  assert(spellHint('look after') === 'l___ a____' && spellHint("don't") === "d__'_" && spellable({ word: 'apologize', meaning: '사과하다' }) && !spellable({ word: 'a/an', meaning: '하나의' }) && !spellable({ word: 'extraordinarily-complicated', meaning: 'x' }), 'V13.67 spelling words: first letter of each word as the hint; only words the in-app keyboard can type');
  const speedQs = battleQuestions(words, 'speed', 40), skillQs = battleQuestions(words, 'skill', 40);
  const spells = skillQs.filter(q => q.kind === 'spell');
  assert(speedQs.every(q => !q.kind && q.options.length === 4) && spells.length >= 10 && skillQs.length - spells.length >= spells.length && spells.every(q => q.accept.includes(q.text) && q.hint.length === q.text.length && q.hint[0] === q.text[0]), 'V13.67 스피드전 asks four choices; 실력전 turns every other word into a spelling word');
  const duel = createBattle({ id: 'qa-skill', players: [{ id: 'x', name: 'X' }, { id: 'y', name: 'Y' }], questions: [spells[0], ...skillQs.filter(q => !q.kind)], mode: 'skill', now });
  connect(duel, 'x', now); connect(duel, 'y', now); tick(duel, now + BATTLE.COUNTDOWN_MS);
  const t1 = now + BATTLE.COUNTDOWN_MS, sq = duel.questions[duel.turn.q];
  const openView = JSON.stringify(battleView(duel, 'x'));
  assert(duel.mode === 'skill' && duel.ends_at - t1 === 120000 && duel.deadline - t1 === SKILL_RULES.SPELL_TURN_MS && sq.kind === 'spell' && !openView.includes(`"${sq.text}"`) && !openView.includes('accept') && battleView(duel, 'x').question.hint === sq.hint, 'V13.67 실력전 lasts 2 minutes, a spelling word gets 16 seconds and the room never sends its spelling while it is open');
  const wrongSpell = answer(duel, 'y', 'zzzz', t1 + 1000);
  const typed = answer(duel, 'x', ` ${sq.text.toUpperCase()} `, t1 + 8000);
  const hitSpell = typed.find(e => e.type === 'attack'), reveal = typed.find(e => e.type === 'reveal');
  assert(wrongSpell[0].type === 'wrong' && hitSpell?.spell === true && hitSpell.fast === false && hitSpell.dmg === SKILL_RULES.SPELL_HIT + Math.round(8 * SKILL_RULES.SPEED_BONUS) && duel.players.x.gauge === 1 && reveal?.answer === sq.text, 'V13.67 a typed spelling is checked without case or spaces; it hits hardest (no speed crits in 실력전) and the word is revealed after');
  tick(duel, t1 + 8000 + BATTLE.REVEAL_MS);
  const cq = duel.questions[duel.turn.q], t2 = t1 + 8000 + BATTLE.REVEAL_MS;
  const quick = answer(duel, 'x', cq.answer, t2 + 500).find(e => e.type === 'attack');
  assert(cq.kind !== 'spell' && duel.deadline - t2 === SKILL_RULES.CHOICE_TURN_MS && quick.dmg === SKILL_RULES.CHOICE_HIT + Math.round(8.5 * SKILL_RULES.SPEED_BONUS) && !quick.fast, 'V13.67 in 실력전 a quick choice answer adds only a little damage');
  const speedDuel = createBattle({ id: 'qa-speed', players: [{ id: 'x', name: 'X' }, { id: 'y', name: 'Y' }], questions: speedQs, now });
  connect(speedDuel, 'x', now); connect(speedDuel, 'y', now); tick(speedDuel, t1);
  const fast = answer(speedDuel, 'x', speedDuel.questions[speedDuel.turn.q].answer, t1 + 500).find(e => e.type === 'attack');
  assert(speedDuel.mode === 'speed' && speedDuel.ends_at - t1 === 90000 && fast.fast && fast.dmg > quick.dmg, 'V13.67 스피드전 keeps its rules: 90 seconds, fast answers are critical');
  const room = await service(state, 'POST', '/battle/rooms', { stake: 10, range_codes: range, mode: 'skill' }, tokens['qa-rw-a']);
  const stored = state.battles.find(b => b.id === room.id);
  assert(room.mode === 'skill' && room._battle.mode === 'skill' && room._battle.questions.some(q => q.kind === 'spell') && stored.mode === 'skill', 'V13.67 a room is opened as 실력전 and the room gets spelling words');
  const preview = await service(state, 'GET', '/battle/preview', { code: room.code }, tokens['qa-rw-b']);
  assert(preview.mode === 'skill' && (await service(state, 'GET', '/battle/current', {}, tokens['qa-rw-a'])).battle.mode === 'skill', 'V13.67 the joining player sees which mode the room is');
  await service(state, 'POST', '/battle/cancel', { id: room.id }, tokens['qa-rw-a']).catch(() => null);
  const plain = await service(state, 'POST', '/battle/rooms', { stake: 10, range_codes: range, mode: 'weird' }, tokens['qa-rw-c']);
  assert(plain.mode === 'speed' && plain._battle.questions.every(q => !q.kind), 'V13.67 rooms default to 스피드전');
  const bot = createPracticeMatch({ me: { id: 'qa-rw-a', name: '가온', pet: { key: 'dog', form: 1 } }, questions: skillQs, level: 'hard', mode: 'skill', onMessage: () => {} });
  assert(bot.bot.pet.key === 'robot' && bot.bot.pet.form === 3, 'V13.67 the practice partner is the robot 로보, grown by level');
  bot.close();
  const roomSource = source('../cloudflare/battle-room.mjs'), battleUi = source('../public/modules/battle.js');
  assert(roomSource.includes("mode: this.room.mode") && roomSource.includes("typeof msg.choice === 'string'") && battleUi.includes('data-yb="mode"') && battleUi.includes('function spellKey(') && battleUi.includes("send({ type: 'answer', choice: spelled(q) })"), 'V13.67 the battle room keeps the mode and takes typed answers; the lobby picks the mode; words are typed on the in-app keyboard');

  /* ---------- attendance ---------- */
  const before = await balance('qa-rw-b');
  const first = await service(state, 'POST', '/attendance/check', {}, tokens['qa-rw-b']);
  assert(first.coins === ATTENDANCE_REWARDS[0] && first.stamp === 1 && first.points_balance === before + ATTENDANCE_REWARDS[0] && first.attendance.done && first.attendance.streak === 1, 'V13.67 attendance: one stamp and coins a day');
  await expectStatus(409, () => service(state, 'POST', '/attendance/check', {}, tokens['qa-rw-b']), 'V13.67 attendance counts once a day');
  const att = profile('qa-rw-b').attendance;
  Object.assign(att, { last: dayKey(now - DAY_MS), card: 6, streak: 6 });
  const seventh = await service(state, 'POST', '/attendance/check', {}, tokens['qa-rw-b']);
  assert(seventh.stamp === 7 && seventh.coins === ATTENDANCE_REWARDS[6] && seventh.tickets === 1 && seventh.attendance.stamps === 7 && profile('qa-rw-b').attendance.card === 0 && seventh.attendance.streak === 7, 'V13.67 the 7th stamp gives the big reward and a capsule ticket, then a new card starts');
  Object.assign(att, { last: dayKey(now - 3 * DAY_MS) });
  const broken = (await service(state, 'GET', '/rewards', {}, tokens['qa-rw-b'])).attendance;
  assert(!broken.done && broken.streak === 0 && broken.next === ATTENDANCE_REWARDS[0] && broken.stamps === 0, 'V13.67 missing days only resets the streak count; the stamp card goes on');
  const week = rankingWeek(now);
  const coinRow = (await service(state, 'GET', '/bootstrap', {}, tokens['qa-rw-b'])).ranking.find(r => r.is_me);
  assert(coinRow.all_coins === 400 + ATTENDANCE_REWARDS[0] + ATTENDANCE_REWARDS[6] && coinRow.coins === (now - DAY_MS >= week.start ? 400 : 0) + ATTENDANCE_REWARDS[0] + ATTENDANCE_REWARDS[6], 'V13.67 attendance coins count in the coin ranking');

  /* ---------- V13.68 coin capsule (코인 뽑기) ---------- */
  const avg = LUCKY_ODDS.reduce((n, o) => n + o.mult * o.rate, 0);
  assert(LUCKY_ODDS.reduce((n, o) => n + o.rate, 0) === 100 && LUCKY_ODDS.map(o => o.mult).join() === '0,1,2,3' && LUCKY_BETS.join() === '10,20,30' && LUCKY_DAILY === 5, 'V13.68 coin capsule (V13.82: five a day): ×0·×1·×2·×3 for bets of 10·20·30 coins, three a day');
  assert(avg >= 90 && avg < 100, 'V13.68 on average a little less comes back than is bet (study stays the way to earn coins)');
  const counts = {}, rnd = seeded(7);
  for (let i = 0; i < 20000; i++) { const got = drawLucky(rnd); counts[got.mult] = (counts[got.mult] || 0) + 1; }
  assert(LUCKY_ODDS.every(o => Math.abs((counts[o.mult] || 0) / 200 - o.rate) < 1.2), 'V13.68 capsules come out at the odds shown on the machine');
  // V13.81: a stake waiting in a room is not spent on capsules, and a host who can no longer
  // pay the stake cannot be joined.
  await expectStatus(409, () => service(state, 'POST', '/lucky/pull', { bet: 10 }, tokens['qa-rw-c']), 'V13.81 coins staked in a waiting room are not spent on capsules');
  profile('qa-rw-c').points_spent = 395;
  await expectStatus(409, () => service(state, 'POST', '/battle/join', { code: plain.code }, tokens['qa-rw-b']), 'V13.81 a room whose host has fewer coins than the stake cannot be joined');
  profile('qa-rw-c').points_spent = 0;
  assert(state.battles.find(b => b.id === plain.id).status === 'waiting', 'V13.81 the refused join leaves the room waiting');
  await service(state, 'POST', `/battle/rooms/${plain.id}/cancel`, {}, tokens['qa-rw-c']);
  const poor = profile('qa-rw-c');
  poor.points_spent = 390; // 400 earned (a waiting room holds no stake): 10 left
  await expectStatus(400, () => service(state, 'POST', '/lucky/pull', { bet: 20 }, tokens['qa-rw-c']), 'V13.68 a coin capsule needs the coins it bets');
  await expectStatus(400, () => service(state, 'POST', '/lucky/pull', { bet: 15 }, tokens['qa-rw-c']), 'V13.68 bets are 10, 20 or 30 coins');
  poor.points_spent = 0;
  const b0 = await balance('qa-rw-c');
  const plays = [];
  for (let i = 0; i < LUCKY_DAILY; i++) plays.push(await service(state, 'POST', '/lucky/pull', { bet: 10 }, tokens['qa-rw-c']));
  const won = plays.reduce((n, r) => n + r.paid, 0);
  assert(plays.every(r => [0, 10, 20, 30].includes(r.paid) && r.paid === r.bet * r.mult) && plays.at(-1).points_balance === b0 - 10 * LUCKY_DAILY + won && plays.at(-1).lucky.left === 0, 'V13.68 each capsule pays the bet times ×0·×1·×2·×3 into the balance');
  await expectStatus(409, () => service(state, 'POST', '/lucky/pull', { bet: 10 }, tokens['qa-rw-c']), 'V13.82 coin capsules are five a day');
  await expectStatus(409, () => service(state, 'POST', '/lucky/pull', { ticket: true }, tokens['qa-rw-c']), 'V13.68 a free capsule needs a ticket');
  const bb = await balance('qa-rw-b');
  const withTicket = await service(state, 'POST', '/lucky/pull', { ticket: true }, tokens['qa-rw-b']);
  assert(withTicket.ticket && withTicket.bet === 10 && withTicket.lucky.tickets === 0 && withTicket.lucky.left === LUCKY_DAILY && withTicket.points_balance === bb + withTicket.paid, 'V13.68 the attendance ticket plays a 10-coin capsule for free, outside the three a day');
  const rankC = (await service(state, 'GET', '/bootstrap', {}, tokens['qa-rw-c'])).ranking.find(r => r.is_me);
  assert(rankC.all_coins === 400, 'V13.68 coin capsule winnings are not counted in the coin ranking');
  await expectStatus(404, () => service(state, 'POST', '/gacha/pull', {}, tokens['qa-rw-c']), 'V13.68 the decoration capsule machine is gone');

  /* ---------- decorations kept from the V13.67 machine ---------- */
  poor.gacha = { items: { aura_sakura: 1, title_lucky: 1 } };
  assert(!GACHA_KEYS.some(key => key.startsWith('badge_')) && !Object.keys(ACCESSORIES).some(key => key.startsWith('g_')) && FRAMES.g_sakura?.gacha === 'aura_sakura' && !unlocked(FRAMES.g_sakura, { level: 50 }) && unlocked(FRAMES.g_sakura, { level: 1, gacha: { aura_sakura: 1 } }), 'V13.68 badges are gone; auras pulled before stay wearable by their owners only');
  const styleBody = { avatar_key: 'dog', avatar_accessory: 'none', avatar_frame: 'g_sakura', avatar_title: 'rookie' };
  assert((await service(state, 'POST', '/profile/style', styleBody, tokens['qa-rw-c'])).avatar_frame === 'g_sakura', 'V13.68 a pulled aura can still be worn');
  await expectStatus(400, () => service(state, 'POST', '/profile/style', { ...styleBody, avatar_frame: 'g_galaxy' }, tokens['qa-rw-c']), 'V13.68 an aura not pulled cannot be worn');
  // V13.71: a removed badge is not worn (it falls back to 기본) instead of blocking the change.
  assert((await service(state, 'POST', '/profile/style', { ...styleBody, avatar_accessory: 'g_heart' }, tokens['qa-rw-c'])).avatar_accessory === 'none', 'V13.71 a removed badge is saved as 기본, not worn');
  {
    // A student who still wore a badge from V13.67 can put on an aura again, gets the badges paid
    // back once (60 coins per kind), and the profile logs stay small.
    const now = Date.now();
    poor.avatar_accessory = 'g_note';
    poor.gacha = { items: { badge_heart: 2, badge_note: 1, aura_sakura: 1, title_lucky: 1 }, refund: 5, log: [{ at: now, key: 'badge_heart' }] };
    poor.chance = { paid: 0, log: [{ at: now }] };
    poor.attendance = { ...(poor.attendance || {}), log: [{ at: now - 30 * DAY_MS, coins: 3 }, { at: now - 20 * DAY_MS, coins: 3 }, { at: now - DAY_MS, coins: 5 }] };
    poor.lucky = { ...(poor.lucky || {}), log: Array.from({ length: 12 }, (_, i) => ({ at: now - i * 1000, bet: 10, mult: 0 })) };
    const before = (await service(state, 'GET', '/bootstrap', {}, tokens['qa-rw-c'])).stats.points_balance;
    assert((await service(state, 'POST', '/profile/style', { ...styleBody, avatar_accessory: 'g_note' }, tokens['qa-rw-c'])).avatar_frame === 'g_sakura', 'V13.71 a student still wearing a removed badge can change the look again');
    poor.avatar_accessory = 'g_note';
    assert(tidyProfileLogs(state, now) === true && tidyProfileLogs(state, now) === false, 'V13.71 the profile tidy runs once and then has nothing left to do');
    const after = (await service(state, 'GET', '/bootstrap', {}, tokens['qa-rw-c'])).stats.points_balance;
    assert(after - before === BADGE_REFUND * 2 && poor.gacha.refund === 5 + BADGE_REFUND * 2 && poor.gacha.items.aura_sakura === 1 && !Object.keys(poor.gacha.items).some(key => key.startsWith('badge_')) && poor.avatar_accessory === 'none', 'V13.71 each removed badge kind is paid back once at the capsule price and a worn one goes back to 기본');
    assert(!('log' in poor.gacha) && !('log' in poor.chance) && poor.attendance.log.length === 1 && poor.lucky.log.length === 6, 'V13.71 profile logs keep only what screens and rankings read');
  }
  assert(TITLES.g_lucky.retired && !visibleTitleKeys(['rookie']).includes('g_lucky') && visibleTitleKeys(['rookie', 'g_lucky']).includes('g_lucky') && (await service(state, 'POST', '/profile/title', { key: 'g_lucky' }, tokens['qa-rw-c'])).equipped === 'g_lucky', 'V13.68 capsule titles stay with their owners and are hidden from everyone else');
  await expectStatus(403, () => service(state, 'POST', '/profile/title', { key: 'g_god' }, tokens['qa-rw-c']), 'V13.67 a capsule title not pulled cannot be equipped');
  const bootC = await service(state, 'GET', '/bootstrap', {}, tokens['qa-rw-c']);
  assert(bootC.stats.gacha.aura_sakura === 1 && bootC.rewards.gacha.items.aura_sakura === 1 && bootC.rewards.lucky.left === 0, 'V13.68 the app gets the decorations owned and today\'s coin capsules');

  /* ---------- V13.70 the word double chance is retired ---------- */
  const A = profile('qa-rw-a');
  await expectStatus(404, () => service(state, 'POST', '/chance/start', { bet: 10 }, tokens['qa-rw-a']), 'V13.70 the word double chance is gone');
  const beforeRefund = await balance('qa-rw-a');
  A.points_spent = Number(A.points_spent || 0) + 10;
  A.chance_live = { id: 'qa-old', bet: 10, pot: 10, step: 0, status: 'question', used: [] };
  const refundQuestion = await balance('qa-rw-a');
  A.chance_live = { id: 'qa-old', bet: 10, pot: 20, step: 0, status: 'decide', used: [] };
  const refundDecide = await balance('qa-rw-a');
  const bootA = await service(state, 'GET', '/bootstrap', {}, tokens['qa-rw-a']);
  assert(refundQuestion === beforeRefund && refundDecide === beforeRefund + 10 && !JSON.stringify(bootA).includes('chance_live') && !('chance' in bootA.rewards), 'V13.70 a double chance left open gives its bet back (or the pot a right answer reached)');

  /* ---------- V13.70 robot practice matches ---------- */
  const tB = tokens['qa-rw-b'], B = profile('qa-rw-b');
  const statsOf = async id => (await service(state, 'GET', '/bootstrap', {}, tokens[id])).stats;
  const s0 = await statsOf('qa-rw-b');
  const quickStart = await service(state, 'POST', '/battle/practice/start', { level: 'hard', mode: 'speed' }, tB);
  const tooQuick = await service(state, 'POST', '/battle/practice/finish', { id: quickStart.id, result: 'win', right: 9 }, tB);
  await expectStatus(404, () => service(state, 'POST', '/battle/practice/finish', { id: quickStart.id, result: 'win', right: 9 }, tB), 'V13.70 a robot match pays once');
  const play = async (level, result, right) => {
    const start = await service(state, 'POST', '/battle/practice/start', { level, mode: 'skill' }, tB);
    B.bonus.bot_live.at -= 60000;
    return service(state, 'POST', '/battle/practice/finish', { id: start.id, result, right }, tB);
  };
  const few = await play('hard', 'win', 2);
  const botWon = await play('hard', 'win', 8);
  const s1 = await statsOf('qa-rw-b');
  const petXp = st => (st.pets || []).find(x => x.active)?.xp || 0;
  assert(quickStart.left === BOT_DAILY && !tooQuick.paid && tooQuick.reason === 'short' && !few.paid && few.reason === 'few', 'V13.70 a robot match pays only when it lasted and enough words were right');
  assert(botWon.paid && botWon.coins === BOT_WIN_REWARDS.hard.coins && botWon.xp === BOT_WIN_REWARDS.hard.xp && botWon.left === BOT_DAILY - 1 && s1.points_balance === s0.points_balance + botWon.coins && s1.points === s0.points + botWon.xp && petXp(s1) === petXp(s0) + botWon.xp && s1.today_xp === s0.today_xp + botWon.xp, 'V13.70 a robot win pays coins and 경험치 by the robot level (level, partner pet and today)');
  assert(s1.practice_count === s0.practice_count && s1.streak === s0.streak && s1.accuracy === s0.accuracy && !state.sessions.some(x => x.bonus), 'V13.70 robot matches are not practice records (count, study days and accuracy stay)');
  const lostMatch = await play('easy', 'lose', 5);
  assert(lostMatch.paid && lostMatch.coins === BOT_TRY_REWARD.coins && lostMatch.xp === BOT_TRY_REWARD.xp, 'V13.70 a lost robot match still pays a little');
  const spoofed = await (async () => { const start = await service(state, 'POST', '/battle/practice/start', { level: 'easy', mode: 'speed' }, tB); B.bonus.bot_live.at -= 60000; return service(state, 'POST', '/battle/practice/finish', { id: start.id, result: 'win', right: 6, level: 'hard' }, tB); })();
  assert(spoofed.paid && spoofed.coins === BOT_WIN_REWARDS.easy.coins, 'V13.70 the reward follows the level the match started with');
  await play('normal', 'draw', 4);
  await play('normal', 'win', 4);
  const over = await play('normal', 'win', 9);
  assert(over.paid === false && over.reason === 'daily' && over.left === 0 && B.bonus.bot.count === BOT_DAILY, `V13.70 robot matches pay ${BOT_DAILY} times a day`);
  const bootB = await service(state, 'GET', '/bootstrap', {}, tB);
  const rankB = bootB.ranking.find(r => r.is_me);
  assert(!('bonus' in bootB.profile) && bootB.rewards.bot.left === 0 && rankB.xp >= botWon.xp + lostMatch.xp, 'V13.70 the bonus counts in the weekly ranking; the ledger itself is not sent');
  // The ledger keeps one row per day and pet; old days fold together without changing totals.
  const ledger = { id: 'qa-ledger', bonus: {} };
  addBonus(ledger, { xp: 10, coins: 1, pet: 'dog', now: now - 60 * DAY_MS });
  addBonus(ledger, { xp: 20, coins: 2, pet: 'dog', now: now - 50 * DAY_MS });
  addBonus(ledger, { xp: 5, coins: 1, pet: 'dog', now });
  addBonus(ledger, { xp: 5, coins: 1, pet: 'dog', now });
  const rows = bonusRecords(ledger);
  assert(rows.length === 2 && rows.reduce((n, r) => n + r.xp, 0) === 40 && rows.reduce((n, r) => n + r.reward_points, 0) === 5 && rows.every(r => r.bonus && r.answered_count === 0 && r.pet_key === 'dog'), 'V13.70 the bonus ledger folds old days and keeps the totals');

  /* ---------- V13.70 teacher exams ---------- */
  const tC = tokens['qa-rw-c'];
  const exam = await service(state, 'POST', '/exams', { title: 'QA 보상 시험', class_name: '고1A', school: '단원고', range_codes: range, exam_type: 'write_meaning', question_count: 4, duration_sec: 300, passing_score: 70, max_attempts: 2, available_at: now - 1000, due_at: now + 3600000, release_result: false }, tokens.qa_rw_teacher);
  const c0 = await statsOf('qa-rw-c');
  const examFirst = await service(state, 'POST', '/exams/start', { exam_id: exam.id }, tC);
  const firstAttempt = state.examAttempts.find(x => x.id === examFirst.attempt.id);
  const firstDone = await service(state, 'POST', `/attempts/${firstAttempt.id}/submit`, { lease: firstAttempt.lease, revision: firstAttempt.revision, answers: { 0: '모름', 2: '모름' } }, tC);
  const c1 = await statsOf('qa-rw-c');
  assert(firstDone.attempt.reward?.xp === 2 * EXAM_XP_PER_ANSWER && firstDone.attempt.reward.coins === EXAM_COINS && firstDone.attempt.score === undefined && c1.points === c0.points + 2 * EXAM_XP_PER_ANSWER && c1.points_balance === c0.points_balance + EXAM_COINS && c1.practice_count === c0.practice_count, 'V13.70 an exam gives 경험치 per answered question and coins for half of it (the hidden score stays hidden)');
  const again = await service(state, 'POST', '/exams/start', { exam_id: exam.id }, tC);
  const againAttempt = state.examAttempts.find(x => x.id === again.attempt.id);
  const againDone = await service(state, 'POST', `/attempts/${againAttempt.id}/submit`, { lease: againAttempt.lease, revision: againAttempt.revision, answers: { 0: 'a', 1: 'b', 2: 'c', 3: 'd' } }, tC);
  const c2 = await statsOf('qa-rw-c');
  assert(!againDone.attempt.reward && c2.points === c1.points && c2.points_balance === c1.points_balance, 'V13.70 only the first attempt of an exam pays');
  const homeUi = source('../public/modules/student.js'), arcade = source('../public/modules/arcade.js');
  const luckyUi = source('../public/modules/lucky.js');
  assert(luckyUi.includes('export function luckyShow(') && luckyUi.includes('function machineSpin(') && luckyUi.includes("const shakes = res.mult === 0 ? 1 : res.mult === 1 ? 2 : 3") && luckyUi.includes('data-lk="skip"') && luckyUi.includes('prefers-reduced-motion') && arcade.includes('luckyCard(luckyState(A)'), 'V13.68 the coin capsule has a machine and a show: coin in, dial, the capsule shakes more for better results, bursts open; it can be skipped and respects reduced motion');
  assert(homeUi.includes('attendanceCard(') && arcade.includes('/lucky/pull') && !arcade.includes('/chance/') && !arcade.includes('더블 찬스') && arcade.includes('확률'), 'V13.67 the home screen has the attendance card; the coin arcade has the capsule machine (with its odds); V13.70 no double chance');
  const battleV70 = source('../public/modules/battle.js'), sessionsUi = source('../public/modules/sessions.js'), appUi = source('../public/app.js'), buildUi = source('./build-assets.mjs');
  assert(battleV70.includes("api('/battle/practice/start'") && battleV70.includes("api('/battle/practice/finish'") && battleV70.includes('botRewardLine()') && sessionsUi.includes('a.reward ?') && homeUi.includes('data-go="ranking" data-from="me"') && homeUi.includes("A.rankFrom === 'me' ? backTo('me', '나')") && appUi.includes("A.rankFrom = d.from || 'home'") && !appUi.includes('wallet-chance') && buildUi.includes('"v1370.css"'), 'V13.70 robot and exam rewards show in the app; 나 opens the ranking; the wallet has no double chance');
  assert(battleV70.indexOf('id="yb-answers"') < battleV70.indexOf('id="yb-myskill"') && battleV70.includes('yb-strip-v1370') && battleV70.includes('yb-hpn-'), 'V13.70 the match shows the answers right under the word, the clock beside the message line and HP numbers');

  /* ---------- V13.76 펫 교감 ---------- */
  state.profiles.push(student('qa-rw-d', '라온'), student('qa-rw-e', '마루'));
  for (const id of ['qa-rw-d', 'qa-rw-e']) tokens[id] = await login(id);
  const tD = tokens['qa-rw-d'], tE = tokens['qa-rw-e'];
  const d0 = await service(state, 'GET', '/bootstrap', {}, tD);
  assert(d0.care && d0.care.pet === false && d0.care.feed === false && d0.care.xp.pet === PET_CARE.pet.xp && d0.care.away_days === 0 && d0.care.missed === false, 'V13.76 a new student sees both 교감 buttons open and no "missed you"');
  const petted = await service(state, 'POST', '/pet/care', { kind: 'pet' }, tD);
  assert(petted.kind === 'pet' && petted.xp === PET_CARE.pet.xp && petted.care.pet === true && petted.care.feed === false && petted.stats.points === d0.stats.points + PET_CARE.pet.xp, 'V13.76 쓰다듬기 gives its 경험치 right away');
  await expectStatus(409, () => service(state, 'POST', '/pet/care', { kind: 'pet' }, tD), 'V13.76 쓰다듬기 pays once a day');
  const fed = await service(state, 'POST', '/pet/care', { kind: 'feed' }, tD);
  assert(fed.care.pet && fed.care.feed && fed.stats.points === d0.stats.points + PET_CARE.pet.xp + PET_CARE.feed.xp && fed.care.total === 2, 'V13.76 밥 주기 is a second, separate daily 교감');
  await expectStatus(400, () => service(state, 'POST', '/pet/care', { kind: 'hug' }, tD), 'V13.76 only 쓰다듬기 and 밥 주기 exist');
  await expectStatus(403, () => service(state, 'POST', '/pet/care', { kind: 'pet' }, tokens.qa_rw_teacher), 'V13.76 teachers have no pet to care for');
  profile('qa-rw-d').care.day = dayKey(now - DAY_MS);
  const dNext = await service(state, 'GET', '/bootstrap', {}, tD);
  assert(!dNext.care.pet && !dNext.care.feed, 'V13.76 the 교감 buttons open again the next day');
  profile('qa-rw-d').care.last_at = now - (PET_MISS_DAYS + 2) * DAY_MS;
  const dAway = await service(state, 'GET', '/bootstrap', {}, tD);
  assert(dAway.care.missed === true && dAway.care.away_days === PET_MISS_DAYS + 2, 'V13.76 after a few days away the pet says it missed the student');
  profile('qa-rw-d').care.last_at = now - DAY_MS;
  assert((await service(state, 'GET', '/bootstrap', {}, tD)).care.missed === false, 'V13.76 yesterday counts as not away');
  const teacherCare = (await service(state, 'GET', '/bootstrap', {}, tokens.qa_rw_teacher)).profiles.find(x => x.id === 'qa-rw-d');
  assert(teacherCare && teacherCare.care === undefined, 'V13.76 the teacher list does not carry each student\'s 교감 record');

  /* ---------- V13.76 ⭐ 어려운 단어 ---------- */
  const [w1, w2, w3] = words;
  const starOn = await service(state, 'POST', '/stars', { word_id: w1.id, on: true }, tD);
  assert(starOn.stars.length === 1 && starOn.stars[0] === w1.id, 'V13.76 a ★ is saved on the account');
  const merged = await service(state, 'POST', '/stars', { word_ids: [w1.id, w2.id, w3.id, 'not-a-word'] }, tD);
  assert(merged.stars.join() === [w1.id, w2.id, w3.id].join(), 'V13.76 the stars kept on one phone are merged in once (unknown words dropped, no doubles)');
  const starOff = await service(state, 'POST', '/stars', { word_id: w2.id, on: false }, tD);
  assert(starOff.stars.join() === [w1.id, w3.id].join(), 'V13.76 ★ can be taken off');
  await expectStatus(404, () => service(state, 'POST', '/stars', { word_id: 'not-a-word', on: true }, tD), 'V13.76 only words of the student\'s school and grade can be starred');
  profile('qa-rw-d').stars.push('retired-word');
  assert(!(await service(state, 'POST', '/stars', { word_id: 'retired-word', on: false }, tD)).stars.includes('retired-word'), 'V13.79 a star can be taken off a word that left the list');
  const dStars = await service(state, 'GET', '/bootstrap', {}, tD);
  assert(dStars.profile.stars.join() === [w1.id, w3.id].join(), 'V13.76 the stars come back on any phone');
  const teacherView = await service(state, 'GET', '/bootstrap', {}, tokens.qa_rw_teacher);
  assert(teacherView.profiles.every(x => x.stars === undefined), 'V13.76 the teacher list does not carry the stars');
  profile('qa-rw-e').stars = [];
  await service(state, 'POST', '/stars', { word_ids: words.slice(0, Math.min(words.length, STARS_MAX + 5)).map(w => w.id) }, tE);
  assert(profile('qa-rw-e').stars.length <= STARS_MAX, 'V13.76 the star list has a ceiling');
  const starPractice = await service(state, 'POST', '/practice/start', { school: '단원고', mode: 'eng2mean', word_ids: [w1.id, w3.id], cover_all: true, run_mode: 'practice' }, tD);
  assert(starPractice.target === 2 && starPractice.timer_mode === 'none' && !starPractice.question_deadline, 'V13.76 the ★ words start as one untimed practice');
  await service(state, 'POST', `/practice/${starPractice.id}/finish`, {}, tD);

  /* ---------- V13.76 실전시험: countdown and leaving the screen ---------- */
  const test = await service(state, 'POST', '/practice/start', { school: '단원고', range_codes: range, mode: 'write_meaning', target: 5, run_mode: 'test' }, tE);
  const testX = () => state.practices.find(x => x.id === test.id);
  const testSec = testDurationSec('write_meaning', 5);
  assert(test.timer_mode === 'session' && test.deadline - test.started_at === testSec * 1000 && test.duration_sec === testSec && testSec === 120 && !test.question_deadline && test.leaves === 0 && test.can_pass === true, 'V13.80 실전시험 has one calm time limit for the whole test (at least 2 minutes), no countdown per word');
  const again0 = await service(state, 'GET', `/practice/${test.id}`, {}, tE);
  assert(again0.timer_mode === 'session' && again0.deadline === test.deadline, 'V13.80 opening the test again keeps its time limit');
  assert(testDurationSec('eng2mean', 20) === 300 && testDurationSec('write_meaning', 20) === 480, 'V13.80 20 words: 5 minutes to choose, 8 minutes to write');
  // PASS
  const firstWord = testX().question.word_id;
  const passed = await service(state, 'POST', `/practice/${test.id}/pass`, { question_id: test.question_id }, tE);
  assert(passed.pass_count === 1 && passed.passed_left === 1 && passed.question_id !== test.question_id && testX().question.word_id !== firstWord && passed.score_total === 0, 'V13.80 PASS moves on without answering and keeps the word for the end');
  const repeatPass = await service(state, 'POST', `/practice/${test.id}/pass`, { question_id: test.question_id }, tE);
  assert(repeatPass.question_id === passed.question_id && repeatPass.pass_count === 1, 'V13.80 a repeated PASS tap changes nothing');
  await expectStatus(405, () => service(state, 'GET', `/practice/${test.id}/pass`, { question_id: passed.question_id }, tE), 'V13.80 PASS is only a POST (saved)');
  let walk = passed;
  for (let i = 0; i < 3; i++) walk = await service(state, 'POST', `/practice/${test.id}/answer`, { question_id: walk.question_id, answer: 'x' }, tE);
  assert(!walk.revisit && walk.can_pass === true && walk.passed_left === 1, 'V13.80 the new words come before the passed one (PASS stays open while two or more words are left)');
  walk = await service(state, 'POST', `/practice/${test.id}/answer`, { question_id: walk.question_id, answer: 'x' }, tE);
  assert(walk.revisit === true && testX().question.word_id === firstWord && walk.can_pass === false && walk.passed_left === 0 && !walk.finished, 'V13.80 the passed word comes back last, once, without PASS');
  await expectStatus(409, () => service(state, 'POST', `/practice/${test.id}/pass`, { question_id: walk.question_id }, tE), 'V13.80 a word can be passed only once');
  // The whole-test time limit
  const timed = await service(state, 'POST', '/practice/start', { school: '단원고', range_codes: range, mode: 'eng2mean', target: 5, run_mode: 'test' }, tD);
  const timedX = state.practices.find(x => x.id === timed.id);
  timedX.deadline = Date.now() - 500;
  const graceAnswer = await service(state, 'POST', `/practice/${timed.id}/answer`, { question_id: timed.question_id, answer: timed.question.options[0] }, tD);
  assert(!graceAnswer.finished && timedX.answer_records?.length === 1, 'V13.80 an answer sent just before the time ran out still counts');
  timedX.deadline = Date.now() - 5000;
  const lateAnswer = await service(state, 'POST', `/practice/${timed.id}/answer`, { question_id: graceAnswer.question_id, answer: 'x' }, tD);
  assert(lateAnswer.finished === true && lateAnswer.auto_submitted === true, 'V13.80 when the time is up the test is handed in with the answers so far');
  // An abandoned test is handed in by the hourly sweep once its time is up (not 3 days later).
  const left = await service(state, 'POST', '/practice/start', { school: '단원고', range_codes: range, mode: 'eng2mean', target: 5, run_mode: 'test' }, tD);
  const leftX = state.practices.find(x => x.id === left.id);
  await service(state, 'POST', `/practice/${left.id}/answer`, { question_id: left.question_id, answer: left.question.options[0] }, tD);
  leftX.deadline = Date.now() - 10000;
  sweep(state);
  const sweptSession = state.sessions.find(x => x.id === left.id);
  assert(leftX.finished && sweptSession?.auto_submitted === true && sweptSession.answered_count === 1, 'V13.80 a test left open past its time is handed in by the sweep');
  // Leaving after the time is up is a time-out, not a leave.
  const late2 = await service(state, 'POST', '/practice/start', { school: '단원고', range_codes: range, mode: 'eng2mean', target: 5, run_mode: 'test' }, tD);
  state.practices.find(x => x.id === late2.id).deadline = Date.now() - 10000;
  const lateLeave = await service(state, 'POST', `/practice/${late2.id}/leave`, { phase: 'out' }, tD);
  assert(lateLeave.finished === true && lateLeave.auto_submitted === true && !lateLeave.left_out && lateLeave.leaves === 0, 'V13.80 leaving after the time is up hands the test in as a time-out');
  // Tests started before v13.80 (a countdown per word) have no PASS.
  const old = await service(state, 'POST', '/practice/start', { school: '단원고', range_codes: range, mode: 'eng2mean', target: 5, run_mode: 'test' }, tD);
  const oldX = state.practices.find(x => x.id === old.id);
  Object.assign(oldX, { timer_mode: 'question', deadline: null, question_deadline: Date.now() + 9000 });
  assert((await service(state, 'GET', `/practice/${old.id}`, {}, tD)).can_pass === false, 'V13.80 an older per-word-countdown test shows no PASS');
  await expectStatus(409, () => service(state, 'POST', `/practice/${old.id}/pass`, { question_id: old.question_id }, tD), 'V13.80 and cannot PASS');
  assert(source('../public/modules/sessions.js').includes("Number(practiceState.deadline || 0) > 0 && Number(practiceState.deadline) <= Date.now() + practiceOffset"), 'V13.80 coming back to a practice without a time limit never ends it');
  const out1 = await service(state, 'POST', `/practice/${test.id}/leave`, { phase: 'out' }, tE);
  const back1 = await service(state, 'POST', `/practice/${test.id}/leave`, { phase: 'back', ms: 4200 }, tE);
  assert(out1.leaves === 1 && out1.limit === TEST_LEAVE_LIMIT && out1.finished === false && back1.leaves === 1 && testX().leave_ms === 4200, 'V13.76 leaving the test is counted, with how long');
  await expectStatus(405, () => service(state, 'GET', `/practice/${test.id}/leave`, { phase: 'out' }, tE), 'V13.76 a leave is only recorded by POST (saved)');
  const out2 = await service(state, 'POST', `/practice/${test.id}/leave`, { phase: 'out' }, tE);
  assert(out2.leaves === 2 && !out2.finished, 'V13.76 the second leave is a warning');
  const out3 = await service(state, 'POST', `/practice/${test.id}/leave`, { phase: 'out' }, tE);
  const leftSession = state.sessions.find(x => x.id === test.id);
  assert(out3.finished === true && out3.left_out === true && out3.leaves === TEST_LEAVE_LIMIT && leftSession?.leave_count === TEST_LEAVE_LIMIT && leftSession.left_out === true && leftSession.leave_ms === 4200, `V13.76 the ${TEST_LEAVE_LIMIT}rd leave hands the test in, and the record keeps the leaves`);
  const afterDone = await service(state, 'POST', `/practice/${test.id}/leave`, { phase: 'back', ms: 9000 }, tE);
  assert(afterDone.finished === true && (!testX() || testX().leave_ms === 4200) && leftSession.leave_ms === 4200, 'V13.76 a leave report after the end changes nothing');
  assert(afterDone.id === test.id && afterDone.left_out === true && Number.isFinite(Number(afterDone.score)), 'V13.79 a leave report that arrives after the test ended gets the whole result (not an empty screen)');
  const practiceRun = await service(state, 'POST', '/practice/start', { school: '단원고', range_codes: range, mode: 'write_meaning', target: 5 }, tE);
  const practiceLeave = await service(state, 'POST', `/practice/${practiceRun.id}/leave`, { phase: 'out' }, tE);
  assert(practiceRun.timer_mode === 'none' && practiceLeave.leaves === 0 && !state.practices.find(x => x.id === practiceRun.id).leaves, 'V13.76 practice keeps no countdown and no leave record');
  await service(state, 'POST', `/practice/${practiceRun.id}/finish`, {}, tE);
  const sessionsUi76 = source('../public/modules/sessions.js'), appUi76 = source('../public/app.js'), studentUi76 = source('../public/modules/student.js'), teacherUi76 = source('../public/modules/teacher.js'), build76 = source('./build-assets.mjs'), css76 = source('../public/v1376.css');
  assert(sessionsUi76.includes("reportTestLeave(x.id, { phase: 'out' })") && sessionsUi76.includes('keepalive: true') && sessionsUi76.includes('function testLeaveBack()') && sessionsUi76.includes('id="practice-timer-value"') && sessionsUi76.includes('if (questionTimer && !pendingPracticeSave) timer = setInterval(practiceTick, 100)') && sessionsUi76.includes('test-leave-rule-v1376') && sessionsUi76.includes("const out = testMode ? await reportTestLeave(x.id, { phase: 'out' }) : null") && teacherUi76.includes('function leaveNote(s)'), 'V13.76 the test screen shows the countdown, reports leaving and warns; the teacher sees the leaves');
  assert(studentUi76.includes('function petCareBar(A, hatched)') && studentUi76.includes('data-pet-care="${kind}"') && appUi76.includes("api('/pet/care', { kind })") && appUi76.includes('function maybeMissedYou()') && appUi76.includes('보고 싶었어!'), 'V13.76 the home card has 쓰다듬기 and 밥 주기, and the pet greets a student back');
  assert(appUi76.includes('function syncStars()') && appUi76.includes("api('/stars', { word_id: wordId, on })") && studentUi76.includes('export function starredWords(A)') && studentUi76.includes('data-star-practice="true"') && appUi76.includes('function openStarPractice()'), 'V13.76 ★ words are kept on the account and practised together');
  assert(build76.includes('"v1376.css"') && css76.includes('.pet-care-v1376') && css76.includes('.practice-timer-v1376') && css76.includes('.star-practice-v1376'), 'V13.76 styles are bundled');

  /* ---------- V13.78 card tiers by level, Lv.60 cap ---------- */
  const top = levelInfo(10 ** 9);
  assert(MAX_LEVEL === 60 && top.level === 60 && top.remaining === 0 && levelInfo(91140).level === 50 && levelInfo(91140 + 10000).level > 50, 'V13.78 the level cap is 60 (it was 50)');
  assert(CARD_TIERS.map(t => `${t.label}:${t.min}`).join() === 'C:1,U:3,R:6,RR:10,RRR:15,SR:20,HR:25,UR:30,SSR:40,LGD:50', 'V13.78 ten card tiers by level');
  assert(cardTier(1).key === 'c' && cardTier(2).key === 'c' && cardTier(9).key === 'r' && cardTier(10).key === 'rr' && cardTier(49).key === 'ssr' && cardTier(50).key === 'lgd' && cardTier(60).max && !cardTier(59).max && cardTier(15).next.key === 'sr' && cardTier(60).next === null, 'V13.78 each level maps to one tier; Lv.60 is MAX');
  assert(['level30', 'level40', 'level50', 'level60'].every(k => TITLES[k]?.stat === 'level' && TITLES[k].tier === 'legendary') && TITLES.level60.goal === 60, 'V13.78 titles at Lv.30, 40, 50 and 60');
  const card78 = source('../public/modules/card-levelup.js'), app78 = source('../public/app.js'), css78 = source('../public/v1378.css'), build78 = source('./build-assets.mjs'), home78 = source('../public/modules/student.js');
  assert(card78.includes('export function maybeCardLevelUp(A)') && card78.includes('if (to.index > from.index) upgradeScene(') && card78.includes('setTimeout(() => bump(level), 900)') && card78.includes('waitForClear(root') && card78.includes("sumus:card-level:") && app78.includes('queueMicrotask(() => maybeCardLevelUp(A))'), 'V13.78 a level-up plays on the home card; a new tier plays the card-upgrade scene after any evolution moment');
  assert(home78.includes('function cardFx(tier)') && build78.includes('"v1378.css"') && ['c', 'u', 'r', 'rr', 'rrr', 'sr', 'hr', 'ur', 'ssr', 'lgd'].every(k => k === 'c' || css78.includes(`.tier-${k} `)) && css78.includes('.card-up-v1378') && css78.includes('prefers-reduced-motion'), 'V13.78 every tier has its own finish (styles bundled, calmer with reduced motion)');

  /* ---------- V13.81 점검: limits on what one student can store or send ---------- */
  state.profiles.push(student('qa-rw-f', '라온'), student('qa-rw-g', '마루'), student('qa-rw-h', '바다'));
  for (const id of ['qa-rw-f', 'qa-rw-g', 'qa-rw-h']) tokens[id] = await login(id);
  for (const id of ['qa-rw-f', 'qa-rw-g', 'qa-rw-h']) state.sessions.push({ id: `qa-rw-s81-${id}`, student_id: id, division: 'high', school_id: 'danwon-high', school: '단원고', mode: 'eng2mean', run_mode: 'practice', total: 20, correct: 18, answered_count: 20, score: 90, xp: 200, reward_points: 400, created_at: now - DAY_MS });
  const tF = tokens['qa-rw-f'];
  const grammar = await service(state, 'PATCH', '/grammar-progress/qa-g81', {
    sentence_count: 3, choice_count: 4,
    answers: { '0:0': 'that', '0:1': 'x'.repeat(41), '9:0': 'is', '00001:0': 'are', '1:0': 'was', '1:1': 'were', '2:0': 'a', '2:1': 'b', '2:2': 'c' },
    wrong_keys: [...Array.from({ length: 500 }, (_, i) => `${i % 3}:${i}`), '7:0', '1:'.padEnd(5000, '9')]
  }, tF);
  const gKeys = Object.keys(grammar.answers);
  assert(gKeys.length === 4 && !gKeys.includes('9:0') && !gKeys.includes('0:1') && grammar.answers['1:0'] === 'was' && gKeys.includes('1:1'), 'V13.81 grammar answers: real sentences only, short answers, no more than the passage has');
  assert(grammar.wrong_keys.length === 4 && grammar.wrong_keys.every(k => /^[0-2]:\d{1,3}$/.test(k)), 'V13.81 grammar wrong words are capped the same way');
  await expectStatus(400, () => service(state, 'PATCH', '/grammar-progress/qa-g81b', { sentence_count: 3, choice_count: 151 }, tF), 'V13.81 a passage cannot claim more choices than any real one');
  const ranged = await service(state, 'POST', '/practice/start', { school: '단원고', range_codes: Array(5000).fill(range[0]), mode: 'eng2mean', target: 5 }, tF);
  assert(state.practices.find(x => x.id === ranged.id).range_codes.length === 1, 'V13.81 a practice keeps each range once (a repeated list is not stored)');
  await service(state, 'POST', `/practice/${ranged.id}/finish`, {}, tF);
  await expectStatus(400, () => service(state, 'POST', '/profile/style', { avatar_key: 'constructor', avatar_accessory: 'toString', avatar_frame: 'constructor', avatar_title: 'rookie' }, tF), 'V13.81 a look named after a JavaScript built-in is refused');
  await expectStatus(400, () => service(state, 'POST', '/practice/start', { school: '단원고', range_codes: range, mode: 'constructor' }, tF), 'V13.81 so is a practice mode named after one');
  // Challenges: one at a time per friend, one phone alert per friend every few minutes, and a
  // cap on rooms opened in 10 minutes.
  const ch1 = await service(state, 'POST', '/battle/challenge', { stake: 10, friend_id: 'qa-rw-g', range_codes: range }, tF);
  assert(ch1._push.length === 1 && ch1._push[0].url === '/?go=challenge', 'V13.81 the first 도전장 buzzes the friend, and opens the challenge itself');
  const friendsH = (await service(state, 'GET', '/battle/friends', {}, tokens['qa-rw-h'])).friends;
  assert(friendsH.find(f => f.id === 'qa-rw-g')?.invited === true, 'V13.81 a friend already holding a 도전장 shows as invited');
  await expectStatus(409, () => service(state, 'POST', '/battle/challenge', { stake: 10, friend_id: 'qa-rw-g', range_codes: range }, tokens['qa-rw-h']), 'V13.81 a second 도전장 to the same friend waits (only one is shown)');
  await service(state, 'POST', `/battle/rooms/${ch1.id}/cancel`, {}, tF);
  const ch2 = await service(state, 'POST', '/battle/challenge', { stake: 10, friend_id: 'qa-rw-g', range_codes: range }, tF);
  assert(Array.isArray(ch2._push) && ch2._push.length === 0, 'V13.81 sent again right away: no second alert');
  await service(state, 'POST', `/battle/rooms/${ch2.id}/cancel`, {}, tF);
  for (let i = 2; i < 12; i++) { const r = await service(state, 'POST', '/battle/rooms', { stake: 10, range_codes: range }, tF); await service(state, 'POST', `/battle/rooms/${r.id}/cancel`, {}, tF); }
  await expectStatus(429, () => service(state, 'POST', '/battle/rooms', { stake: 10, range_codes: range }, tF), 'V13.81 at most 12 rooms in 10 minutes');
  // Teacher preview accounts are not classmates: not in the 도전장 list, not editable as students,
  // and only the preview token goes back to the teacher.
  const tT = tokens['qa_rw_teacher'];
  const previewLogin = await service(state, 'POST', '/teacher/student-preview', { school_id: 'danwon-high', grade: '고1A' }, tT);
  const previewId = previewLogin.profile.id;
  assert(!(await service(state, 'GET', '/battle/friends', {}, tF)).friends.some(f => f.id === previewId), 'V13.81 a preview account is not in the 도전장 list');
  await expectStatus(404, () => service(state, 'PATCH', `/students/${encodeURIComponent(previewId)}`, { password: 'Changed1!' }, tT), 'V13.81 a preview account cannot be edited as a student');
  const fakeToken = 'qa-preview-fake-token-81';
  state.tokens.push({ hash: hashToken(fakeToken), user_id: previewId, expires_at: Date.now() + 60000 });
  await expectStatus(403, () => service(state, 'POST', '/student-preview/exit', {}, fakeToken), 'V13.81 only the preview token handed to the teacher goes back to the teacher');
  assert((await service(state, 'POST', '/student-preview/exit', {}, previewLogin._cookie)).profile.id === 'qa-rw-teacher', 'V13.81 the real preview token still goes back');
  const worker81 = source('../cloudflare/worker.mjs'), sync81 = source('../cloudflare/local-first.mjs'), battle81 = source('../public/modules/battle.js'), app81 = source('../public/app.js');
  const student81 = source('../public/modules/student.js'), gift81 = source('../public/modules/celebrate.js'), lucky81 = source('../public/modules/lucky.js');
  assert(worker81.includes("!hasLiveSession(this.mutations.current().state, token)") && worker81.includes("OPEN_POST_PATHS = new Set(['/api/login', '/api/signup'])") && worker81.includes("url.pathname === '/api/profile/password'"), 'V13.81 changes without a session are turned away before the queue; password changes are rate-limited');
  assert(sync81.includes('if (!previous.size && supabase.readParts)') && sync81.includes("removed = Object.keys(remote.parts || {}).filter(key => !parts.has(key))"), 'V13.81 sending every part again also removes parts deleted here');
  assert(battle81.includes("Object.assign(q, { typed: [], hint: q.hint || ''") && battle81.includes("f.invited ? ' · 도전장 받는 중'"), 'V13.81 a 실력전 word after a reconnect can be typed; friends with a 도전장 show it');
  assert(app81.includes("if (go === 'challenge')") && app81.includes('A.yachaOpts = { accept: invite }; return navigate(\'yacha\')'), 'V13.81 the 도전장 alert opens the challenge');
  assert(!student81.includes('/^L\\\\d+$/') && !app81.includes('/^L\\\\d+$/') && student81.includes('const textbookCodes = state.codes.filter(code => /^L\\d+$/i.test(String(code)));'), 'V13.81 the 교과서 tab finds textbook lessons (L1, L2)');
  assert(gift81.includes('if (Array.isArray(res?.gifts) && !res.gifts.length)') && lucky81.includes("if (audio) { if (audio.state !== 'running') audio.resume"), 'V13.81 a gift opened on another phone is not shown again; capsule sounds wake after iOS pauses them');

  /* ---------- V13.82 가위바위보 · 문법 증권거래소 · more capsules and study coins ---------- */
  const g82 = { id: 'qa-rw-g82', role: 'student' };
  const fixed = v => () => v; // 0 → 로보 내는 손 rock, 0.4 → scissors, 0.7 → paper
  assert(rpsOutcome('paper', 'rock') === 'win' && rpsOutcome('rock', 'paper') === 'lose' && rpsOutcome('scissors', 'scissors') === 'draw' && RPS_BETS.join() === '10,20,30' && RPS_DAILY === 5 && RPS_MAX_WINS === 3, 'V13.82 가위바위보 rules: 10·20·30 coins, five a day, up to three wins in a row');
  const t82 = Date.now();
  const rw1 = rpsPlay(g82, { bet: 10, pick: 'paper' }, 1000, { random: fixed(0), now: t82 });
  assert(rw1.result === 'win' && rw1.robot === 'rock' && rw1.pot === 20 && !rw1.done && g82.points_spent === 10 && rw1.rps.live.await === 'choice', 'V13.82 a win doubles the pot and asks: take it or double');
  await expectStatus(409, async () => rpsPlay(g82, { bet: 10, pick: 'rock' }, 1000, { random: fixed(0), now: t82 }), 'V13.82 after a win the student must take the pot or double it');
  const rtie = rpsPlay(g82, { pick: 'rock', double: true }, 1000, { random: fixed(0), now: t82 });
  assert(rtie.result === 'draw' && rtie.pot === 20 && rtie.rps.live.await === 'pick' && g82.points_spent === 10, 'V13.82 a tie is thrown again for free');
  const rw2 = rpsPlay(g82, { pick: 'rock' }, 1000, { random: fixed(0.4), now: t82 });
  const rcashed = rpsCash(g82, t82);
  assert(rw2.result === 'win' && rw2.pot === 40 && rcashed.paid === 40 && g82.rps.paid === 40 && !g82.rps.live && rewardIncome(g82) >= 40, 'V13.82 taking the pot pays it as coins');
  const rl1 = rpsPlay(g82, { bet: 20, pick: 'scissors' }, 1000, { random: fixed(0), now: t82 });
  assert(rl1.result === 'lose' && rl1.done && g82.points_spent === 30 && g82.rps.paid === 40, 'V13.82 a loss loses the pot');
  let rjack = rpsPlay(g82, { bet: 10, pick: 'paper' }, 1000, { random: fixed(0), now: t82 });
  rjack = rpsPlay(g82, { pick: 'paper', double: true }, 1000, { random: fixed(0), now: t82 });
  rjack = rpsPlay(g82, { pick: 'paper', double: true }, 1000, { random: fixed(0), now: t82 });
  assert(rjack.done && rjack.wins === 3 && rjack.paid === 80 && g82.rps.paid === 120 && g82.rps.best === 3, 'V13.82 three wins in a row pay ×8 at once');
  const rst = rpsPlay(g82, { bet: 10, pick: 'paper' }, 1000, { random: fixed(0), now: t82 });
  const rlater = rpsPlay(g82, { bet: 10, pick: 'paper' }, 1000, { random: fixed(0.7), now: t82 + RPS_STALE_MS + 1 });
  assert(rst.rps.live && g82.rps.paid === 140 && rlater.result === 'draw', 'V13.82 a won pot left open is paid before the next game');
  rpsPlay(g82, { pick: 'paper' }, 1000, { random: fixed(0), now: t82 + RPS_STALE_MS + 2 }); rpsCash(g82, t82 + RPS_STALE_MS + 2);
  await expectStatus(409, async () => rpsPlay(g82, { bet: 10, pick: 'rock' }, 1000, { random: fixed(0.4), now: t82 + RPS_STALE_MS + 3 }), 'V13.82 five games a day');
  await expectStatus(400, async () => rpsPlay({}, { bet: 10, pick: 'constructor' }, 1000), 'V13.82 only 가위, 바위 or 보');
  await expectStatus(400, async () => rpsPlay({}, { bet: 10, pick: 'rock' }, 5), 'V13.82 a game needs the coins it bets');
  // Through the API, with real coins.
  const tG = tokens['qa-rw-h'];
  const g0 = await balance('qa-rw-h');
  const viaApi = await service(state, 'POST', '/rps/play', { bet: 10, pick: 'rock' }, tG);
  assert(['win', 'lose', 'draw'].includes(viaApi.result) && RPS_KEYS.includes(viaApi.robot) && viaApi.points_balance === g0 - 10 && (await service(state, 'GET', '/rewards', {}, tG)).rps.left === RPS_DAILY - 1, 'V13.82 /rps/play takes the bet and shows the throw');
  // 문법 증권거래소
  assert(!(await service(state, 'GET', '/market', {}, tG)).market.open || state.market?.seed, 'V13.82 the market needs its seed');
  sweep(state);
  const sseed = state.market.seed;
  assert(typeof sseed === 'string' && sseed.length >= 32, 'V13.82 the hourly sweep gives the market a secret seed');
  const before82 = JSON.stringify(state.market);
  const smk = (await service(state, 'GET', '/market', {}, tG)).market;
  assert(JSON.stringify(state.market) === before82 && smk.open && smk.stocks.length === STOCKS.length && smk.stocks.every(s => s.hist.length === MARKET.history && s.price > 0) && !JSON.stringify(smk).includes(sseed), 'V13.82 the market shows 10 shares with 48 hours of prices (never the seed), without saving anything');
  const sprices = marketPrices(state, Date.now() + 3600000 * 500);
  assert(STOCKS.every(s => sprices.hist[s.key].every(v => v >= Math.floor(s.base * MARKET.min_x) && v <= Math.ceil(s.base * MARKET.max_x))), 'V13.82 prices stay between 0.3× and 3× of their base');
  const again82 = marketPrices({ market: { ...state.market } }, Date.now() + 3600000 * 500);
  assert(STOCKS.every(s => again82.prices[s.key] === sprices.prices[s.key]), 'V13.82 the same seed always gives the same prices (nothing to store)');
  const other82 = marketPrices({ market: { seed: 'another-seed-0123456789abcdef0000', start: state.market.start } }, Date.now());
  assert(STOCKS.some(s => other82.prices[s.key] !== smk.stocks.find(x => x.key === s.key).price), 'V13.82 another seed gives other prices');
  const srel = smk.stocks.find(s => s.key === 'REL');
  const cash0 = await balance('qa-rw-h');
  const sbuy = await service(state, 'POST', '/market/trade', { key: 'REL', side: 'buy', qty: 2, price: srel.price }, tG);
  const sfee = tradeFee(srel.price * 2);
  assert(sbuy.trade.total === srel.price * 2 + sfee && sbuy.points_balance === cash0 - srel.price * 2 - sfee && sbuy.market.me.holdings[0].q === 2, 'V13.82 buying pays price × shares + 1% fee');
  await expectStatus(409, () => service(state, 'POST', '/market/trade', { key: 'REL', side: 'buy', qty: 1, price: srel.price + 1 }, tG), 'V13.82 an order at a price that is no longer the price is refused');
  await expectStatus(409, () => service(state, 'POST', '/market/trade', { key: 'REL', side: 'sell', qty: 3, price: srel.price }, tG), 'V13.82 nobody sells shares they do not have');
  await expectStatus(400, () => service(state, 'POST', '/market/trade', { key: 'constructor', side: 'buy', qty: 1, price: 1 }, tG), 'V13.82 only listed shares');
  await expectStatus(400, () => service(state, 'POST', '/market/trade', { key: 'REL', side: 'buy', qty: 0.5, price: srel.price }, tG), 'V13.82 whole shares only');
  const ssell = await service(state, 'POST', '/market/trade', { key: 'REL', side: 'sell', qty: 2, price: srel.price }, tG);
  assert(ssell.trade.total === srel.price * 2 - sfee && ssell.points_balance === cash0 - 2 * sfee && !ssell.market.me.holdings.length && ssell.market.me.realized === -2 * sfee, 'V13.82 selling pays price × shares − fee; the fees are the only loss at the same price');
  profile('qa-rw-h').stocks.h = { REL: { q: MARKET.max_hold, cost: 1 } };
  await expectStatus(409, () => service(state, 'POST', '/market/trade', { key: 'REL', side: 'buy', qty: 1, price: srel.price }, tG), 'V13.82 at most 100 shares of one stock');
  delete profile('qa-rw-h').stocks.h.REL;
  assert(newsText({ key: 'SUBJ', up: true, pick: 1 }).includes('가정법은') && newsText({ key: 'PART', up: true, pick: 1 }).includes('분사는'), 'V13.82 news lines use 은/는 by the last letter');
  const arcade82 = source('../public/modules/arcade.js'), css82 = source('../public/v1382.css'), build82 = source('./build-assets.mjs');
  assert(arcade82.includes('rpsCard(rewards(current.A).rps') && arcade82.includes('${stocksCard()}') && arcade82.includes("openStock(k.dataset.key") && build82.includes('"v1382.css"') && css82.includes('.rps-show{') && css82.includes('.stk-card{'), 'V13.82 놀이터 shows 가위바위보 and 문법 증권거래소');
}
