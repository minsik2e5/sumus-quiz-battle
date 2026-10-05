// Release checks for V13.67: 실력전 (spelling words in yacha), daily attendance (출석 체크) and the
// capsule machine (뽑기); V13.70: 경험치 and coins from robot matches and teacher exams, and the
// retired word double chance; V13.76: 펫 교감, ⭐ 어려운 단어 on the account, and the 실전시험
// countdown and leave record.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { emptyState } from './state.mjs';
import { passwordHash, publicProfile, hashToken } from './auth.mjs';
import { service, scopedWords, sweep } from './service.mjs';
import { DAY_MS, rankingWeek, createCompetition } from './competition.mjs';
import { dayKey, unlocked, FRAMES, ACCESSORIES, MAX_LEVEL, CARD_TIERS, cardTier, levelInfo, PET_CARE, PET_MISS_DAYS, TEST_SECONDS_PER_QUESTION, testDurationSec, TEST_LEAVE_LIMIT, STARS_MAX, CHARACTERS, LEGENDARY_PET_KEYS, STANDARD_PET_KEYS, EPIC_PET_KEYS, EPIC_EGG_PRICE, EPIC_EGG_LEGENDARY_RATE, EGG_PRICE, petTier } from '../public/modules/core.js';
import { TITLES, TITLE_KEYS, visibleTitleKeys, titleUnlocked } from '../public/modules/titles.js';
import { createBattle, connect, answer, tick, battleView, petSkill, SKILL_RULES, BATTLE, PET_SKILLS, MONSTER_SKILLS, forfeit } from '../public/modules/battle-engine.js';
import { MONSTERS, MONSTER_ART, MONSTER_POSES, MONSTER_LEVELS, MONSTER_DAILY, MONSTER_TRY, MONSTER_MS_PER_RIGHT, monsterParts, monsterOpen, partClears, partKeyCodes, stageLevel, stageMonster, isBossStage, MONSTER_ORDER, STAGE_REWARD, STAGE_REWARD_MAX, STAGE_AGAIN_SHARE, STAGE_AGAIN_MIN, STAGE_AGAIN_MAX } from '../public/modules/monsters.js';
import { simulate as simulateMonster } from './monster-sim.mjs';
import { expressionSrc, holdPose, showPose } from '../public/modules/character.js';
import { battleQuestions, spellHint, spellable, pairedBattleQuestions } from '../public/modules/battle-questions.js';
import { createPracticeMatch, BOT_LEVELS, BOT_HP } from '../public/modules/battle-bot.js';
import { ATTENDANCE_REWARDS, GACHA_KEYS, LUCKY_BETS, LUCKY_DAILY, LUCKY_ODDS, LEGENDARY_RATE, LEGENDARY_PITY, EPIC_RATE, drawLucky, BOT_WIN_REWARDS, BOT_TRY_REWARD, BOT_DAILY, EXAM_XP_PER_ANSWER, EXAM_COINS, RPS_BETS, RPS_DAILY, RPS_MAX_WINS, RPS_KEYS, RPS_STALE_MS, rpsOutcome } from '../public/modules/rewards.js';
import { botStart, botFinish, RECEIPT_KEEP, RECEIPT_DAYS, monsterStart, monsterFinish, monsterView, monsterMigrate, monsterRanges, monsterProgress, addBonus, bonusRecords, tidyProfileLogs, BADGE_REFUND, pullLucky, rpsPlay, rpsCash, rpsView, rewardIncome, openEgg, luckyView as luckyViewOf } from './rewards.mjs';
import { marketPrices } from './market.mjs';
import { STOCKS, MARKET, MARKET_OPEN, tradeFee, newsText } from '../public/modules/market.js';

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
  assert(duel.mode === 'skill' && duel.ends_at - t1 === 150000 && duel.deadline - t1 === SKILL_RULES.SPELL_TURN_MS && sq.kind === 'spell' && !openView.includes(`"${sq.text}"`) && !openView.includes('accept') && battleView(duel, 'x').question.hint === sq.hint, 'V13.94 실력전 lasts 2 minutes 30 seconds, a spelling word gets 16 seconds and the room never sends its spelling while it is open');
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
  assert(speedDuel.mode === 'speed' && speedDuel.ends_at - t1 === 120000 && fast.fast && fast.dmg > quick.dmg, 'V13.67 스피드전 keeps its rules: 2 minutes (V13.94), fast answers are critical');
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
  assert(roomSource.includes("mode: this.room.mode") && roomSource.includes("typeof msg.choice === 'string'") && battleUi.includes('data-yb="mode"') && battleUi.includes('function spellKey(') && battleUi.includes("send({ type: 'answer', choice: spelled(q), "), 'V13.67 the battle room keeps the mode and takes typed answers; the lobby picks the mode; words are typed on the in-app keyboard');

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
  profile('qa-rw-a').lucky = { legend_pulls: LEGENDARY_PITY - 1 };
  (profile('qa-rw-a').gacha ||= {}).tickets = 1;
  const schoolLegend = await service(state, 'POST', '/lucky/pull', { ticket: true }, tokens['qa-rw-a']);
  assert(schoolLegend.legendary?.guaranteed && schoolLegend.profile.avatar_key === schoolLegend.legendary.key && schoolLegend.stats.pets.some(pet => pet.key === schoolLegend.legendary.key) && schoolLegend.legend_news?.text.includes('전설 펫') && !schoolLegend.notice && schoolLegend._push?.[0]?.to.includes('qa-rw-b') && !schoolLegend._push[0].to.includes('qa-rw-a') && schoolLegend._push[0].tag === 'legend', 'V13.89 a pity pull gives the legendary egg, makes it the partner and sends the news to the school');
  const bootLegend = await service(state, 'GET', '/bootstrap', {}, tokens['qa-rw-b']);
  assert(bootLegend.legend_news?.id === schoolLegend.legend_news.id && !(state.push?.notices || []).some(n => n.id === schoolLegend.legend_news.id), 'V13.89 the news shows as its own home banner and never replaces (or poses as) 선생님 공지');
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
  // V13.101: the same finish again gets the same answer (its receipt), never a second pay-out.
  const tooQuickAgain = await service(state, 'POST', '/battle/practice/finish', { id: quickStart.id, result: 'win', right: 9 }, tB);
  assert(!tooQuickAgain.paid && tooQuickAgain.reason === 'short' && tooQuickAgain.again, 'V13.70 a robot match pays once (V13.101: sent again, it gets the same answer)');
  await expectStatus(404, () => service(state, 'POST', '/battle/practice/finish', { id: 'made-up', result: 'win', right: 9 }, tB), 'V13.70 a robot match the server never started pays nothing');
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
  assert(battleV70.includes("registerStart('/battle/practice/start'") && battleV70.includes("bot: '/battle/practice/finish'") && battleV70.includes('botRewardLine()') && sessionsUi.includes('a.reward ?') && homeUi.includes('data-go="ranking" data-from="me"') && homeUi.includes("A.rankFrom === 'me' ? backTo('me', '나')") && appUi.includes("A.rankFrom = d.from || 'home'") && !appUi.includes('wallet-chance') && buildUi.includes('"v1370.css"'), 'V13.70 robot and exam rewards show in the app; 나 opens the ranking; the wallet has no double chance');
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
  const careFirst = profile('qa-rw-d').avatar_key, careOther = ['dog', 'pig', 'cat'].find(k => k !== careFirst);
  profile('qa-rw-d').pets.push({ key: careOther, acquired_at: now });
  profile('qa-rw-d').avatar_key = careOther;
  const other0 = await service(state, 'GET', '/bootstrap', {}, tD);
  assert(!other0.care.pet && !other0.care.feed && other0.care.done[careFirst]?.pet && other0.care.done[careFirst]?.feed, 'V13.90 another pet has its own 쓰다듬기 and 밥 주기 today');
  const otherFed = await service(state, 'POST', '/pet/care', { kind: 'feed' }, tD);
  assert(otherFed.care.feed && !otherFed.care.pet && otherFed.stats.points === fed.stats.points + PET_CARE.feed.xp, 'V13.90 caring for the second pet pays its 경험치 too');
  await expectStatus(409, () => service(state, 'POST', '/pet/care', { kind: 'feed' }, tD), 'V13.90 still once a day for that pet');
  profile('qa-rw-d').avatar_key = careFirst;
  await expectStatus(409, () => service(state, 'POST', '/pet/care', { kind: 'pet' }, tD), 'V13.90 switching back does not open the first pet again');
  profile('qa-rw-d').care = { day: dayKey(now), pet: true, feed: false, total: 1 };
  const legacyCare = await service(state, 'GET', '/bootstrap', {}, tD);
  assert(legacyCare.care.pet === true && legacyCare.care.feed === false, 'V13.90 a care record from before counts for the partner');
  await expectStatus(409, () => service(state, 'POST', '/pet/care', { kind: 'pet' }, tD), 'V13.90 an old record still blocks a second 쓰다듬기 the same day');
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
  // The upgrade: 로보's last hands, the student's record, ×8 count, titles and 명예의 전당.
  const v82 = rpsView(g82, t82 + RPS_STALE_MS + 3);
  assert(v82.robot_recent.length > 0 && v82.robot_recent.length <= 8 && v82.robot_recent.every(h => RPS_KEYS.includes(h)) && v82.robot_recent[0] === g82.rps.hands.at(-1), 'V13.82 the card shows 로보\'s last hands, newest first');
  assert(v82.stats.wins === g82.rps.wins_total && v82.stats.jackpots === 1 && v82.stats.ties >= 2 && v82.stats.losses === 1 && v82.stats.biggest === 80, 'V13.82 the record: wins, ties, losses, ×8 count, biggest pay-out');
  assert(TITLES.rps10?.stat === 'rps_wins' && TITLES.rpsjack?.stat === 'rps_jackpots' && TITLES.rpsjack.goal === 1 && TITLES.rpsgod?.goal === 5 && TITLES.rpsgod.tier === 'legendary', 'V13.82 three 가위바위보 titles');
  // Through the API, with real coins.
  const tG = tokens['qa-rw-h'];
  const g0 = await balance('qa-rw-h');
  const viaApi = await service(state, 'POST', '/rps/play', { bet: 10, pick: 'rock' }, tG);
  assert(['win', 'lose', 'draw'].includes(viaApi.result) && RPS_KEYS.includes(viaApi.robot) && viaApi.points_balance === g0 - 10 && (await service(state, 'GET', '/rewards', {}, tG)).rps.left === RPS_DAILY - 1, 'V13.82 /rps/play takes the bet and shows the throw');
  profile('qa-rw-h').rps.log = [...(profile('qa-rw-h').rps.log || []), { at: Date.now(), bet: 10, wins: RPS_MAX_WINS, paid: 80 }];
  profile('qa-rw-h').rps.jackpots = 1;
  const hall82 = (await service(state, 'GET', '/rewards', {}, tokens['qa-rw-g'])).rps.hall;
  assert(hall82.some(h => h.name === profile('qa-rw-h').display_name && h.count === 1 && !h.me), 'V13.82 a ×8 this week shows in the school\'s 명예의 전당');
  const tstats = createCompetition(state).titleStats(profile('qa-rw-h'));
  assert(tstats.rps_jackpots === 1 && titleUnlocked('rpsjack', tstats) && !titleUnlocked('rpsgod', tstats), 'V13.82 the ×8 title opens with the first ×8');
  const rps82 = source('../public/modules/rps.js');
  assert(rps82.includes('const TALK = {') && rps82.includes("box.classList.toggle('tense', tense)") && rps82.includes("stamp(res.done ? '×8!' : 'WIN!'") && rps82.includes('function skipIntro()') && rps82.includes('robotRow(g.robot)'), 'V13.82 the match: entrance, 로보\'s talk, clash stamp, tension, 로보\'s last hands');
  // 문법 증권거래소 (on hold: shipped switched off, checked here switched on through the state)
  assert(MARKET_OPEN === false, 'V13.82 문법 증권거래소 is on hold');
  await expectStatus(404, () => service(state, 'GET', '/market', {}, tG), 'V13.82 while on hold the market is closed');
  await expectStatus(404, () => service(state, 'POST', '/market/trade', { key: 'REL', side: 'buy', qty: 1, price: 1 }, tG), 'V13.82 and takes no orders');
  sweep(state);
  assert(!state.market?.seed && (await service(state, 'GET', '/rewards', {}, tG)).market_open === false, 'V13.82 no market seed is made, and the app is told it is closed');
  state.market = { open: true };
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
  assert(arcade82.includes('rpsCard(rewards(current.A).rps') && arcade82.includes("rewards(current.A).market_open ? stocksCard() : ''") && arcade82.includes("openStock(k.dataset.key") && build82.includes('"v1382.css"') && css82.includes('.rps-show{') && css82.includes('.stk-card{'), 'V13.82 놀이터 shows 가위바위보 and 문법 증권거래소');

  /* ---------- V13.83 pet expressions (art from SUMUS ASSET STUDIO) ---------- */
  const { expressionSrc } = await import('../public/modules/character.js');
  const { existsSync } = await import('node:fs');
  const exprFiles = [];
  for (const pet of ['dog', 'pig', 'cat', 'dragon', 'panda', 'snake', 'rabbit', 'fox']) for (const form of [1, 2, 3]) for (const e of ['happy', 'eat', 'sad', 'cheer']) { const src = expressionSrc(pet, form, e); if (src) exprFiles.push(src); }
  assert(exprFiles.length === 96 && exprFiles.every(src => existsSync(fileURLToPath(new URL('../public' + src, import.meta.url)))), 'V13.84 every listed pet pose has its picture (96 drawn)');
  assert(expressionSrc('dog', 3, 'feed') === '/assets/pets/dog-3-eat.webp' && expressionSrc('dog', 1, 'hurt') === '/assets/pets/dog-1-sad.webp' && expressionSrc('pig', 1, 'sad') === '/assets/pets/pig-1-sad.webp' && expressionSrc('fox', 2, 'happy') === '/assets/pets/fox-2-happy.webp' && expressionSrc('cat', 2, 'happy') === '/assets/pets/cat-2-happy.webp' && expressionSrc('panda', 3, 'eat') === '/assets/pets/panda-3-eat.webp' && expressionSrc('dog', 0, 'happy') === '/assets/pets/dog-0-happy.webp' && expressionSrc('dog', 0, 'sad') === null, 'V13.84 poses map (feed→eat, hurt→sad); egg happy is drawn and an undrawn pose keeps the still sprite');
  const app83 = source('../public/app.js');
  assert(app83.includes("showPose(art, kind === 'feed' ? 'eat' : 'happy')") && app83.includes("showPose(art, 'sad', 2200)"), 'V13.83 feeding and petting show the eating or happy pose; a long absence shows sad, then happy');

  /* ---------- V13.85 로보 · 가위바위보 · UI art ---------- */
  const art85 = ['rps/robot-rock', 'rps/robot-scissors', 'rps/robot-paper', 'rps/robot-ready', 'rps/robot-win', 'rps/robot-lose', 'rps/robot-shock', 'rps/robot-think',
    'rps/hand-rock', 'rps/hand-scissors', 'rps/hand-paper', 'rps/clash', 'pets/robot-3-attack', 'pets/robot-3-hurt', 'pets/robot-3-happy', 'pets/robot-3-sad',
    ...['care-feed', 'care-pet', 'care-warm', 'notice', 'bell', 'star-word', 'stopwatch', 'leave-warn', 'coin', 'xp', 'attendance', 'gift', 'egg-shop', 'streak', 'install', 'arcade',
      'season-bronze', 'season-silver', 'season-gold', 'season-diamond'].map(k => `ui/${k}`)];
  assert(art85.length === 36 && art85.every(a => existsSync(fileURLToPath(new URL(`../public/assets/${a}.webp`, import.meta.url)))), 'V13.85 the 36 drawn pictures (로보, 가위바위보, UI icons, season trophies) are in place');
  assert(expressionSrc('robot', 3, 'attack') === '/assets/pets/robot-3-attack.webp' && expressionSrc('robot', 3, 'hurt') === '/assets/pets/robot-3-hurt.webp' && expressionSrc('robot', 3, 'win') === '/assets/pets/robot-3-happy.webp' && expressionSrc('robot', 2, 'attack') === '/assets/pets/robot-2-attack.webp' && expressionSrc('dog', 2, 'attack') === '/assets/pets/dog-2-cheer.webp' && expressionSrc('dog', 2, 'hurt') === '/assets/pets/dog-2-sad.webp', 'V13.85 로보 punches and flinches with its own art; other pets attack with cheer and are hurt with sad');
  const rps85 = source('../public/modules/rps.js'), battle85 = source('../public/modules/battle.js'), css85 = source('../public/v1385.css'), build85 = source('./build-assets.mjs'), student85 = source('../public/modules/student.js');
  assert(rps85.includes('robotPose(res.robot)') && rps85.includes("robotPose(res.done ? 'shock' : 'lose')") && rps85.includes("robotPose('win')") && rps85.includes("robotPose('think')") && rps85.includes("robotPose('ready')") && !rps85.includes('.emoji') && rps85.includes('clash.webp'), 'V13.85 가위바위보 uses the drawn hands, the clash, and 로보 pumps, throws and reacts');
  const css86 = source('../public/v1386.css');
  const css861 = source('../public/v13861.css');
  assert(build85.includes('"v13861.css"') && css861.includes('.home-stack-v1360 .partner-card-btn{max-width:312px}') && css861.includes('.partner-art .avatar-art{position:absolute;left:50%;bottom:0') && css861.includes('.pet-say{left:auto;right:4%'), 'V13.86.1 the home card pet is a little bigger and stands on its frame; the bubble keeps off its face');
  assert(rps85.includes('rps-arena comic') && rps85.includes('const ARM_ART = true') && rps85.includes("fist('me', res.pick, 'shown')") && rps85.includes('id="rps-mine"') && build85.includes('"v1386.css"') && css86.includes('.rps-vsburst{') && css86.includes('.rps-comic .bolt{') && css86.includes('.rps-arena.comic.win .rps-arm.me{'), 'V13.86 가위바위보 is a comic panel: a lightning split, a VS burst, arms from the edges, hand bars (arm art switches on with ARM_ART)');
  assert(battle85.includes("showPose(el, 'hurt', 900)") && battle85.includes("showPose(el, 'attack', 900)"), 'V13.85 yacha pets show their attack and hurt poses');
  assert(build85.includes('"v1385.css"') && css85.includes('.coin-ico{background:url(/assets/ui/coin.webp)') && student85.includes("hatched ? 'care-feed' : 'care-warm'") && student85.includes("uiArt('notice')") && student85.includes("uiArt('gift', 'att-gift-art')"), 'V13.85 UI icons: pet care, notice, bell, install, attendance, the drawn coin');

  /* ---------- V13.88 로보 쉬움·보통 · 코인 뽑기 · 알 반응 ---------- */
  const robot88 = [1, 2].flatMap(form => ['attack', 'hurt', 'happy', 'sad'].map(expression => expressionSrc('robot', form, expression)));
  const eggs88 = ['dog', 'pig', 'cat', 'dragon', 'panda', 'snake', 'rabbit', 'fox'].flatMap(pet => ['happy', 'eat'].map(expression => expressionSrc(pet, 0, expression)));
  const registered88 = [...robot88, ...eggs88];
  assert(registered88.length === 24 && registered88.every(src => src && existsSync(fileURLToPath(new URL('../public' + src, import.meta.url)))), 'V13.88 로보 1·2단계 8장과 알 반응 16장이 등록되어 있고 파일이 있다');
  const luckyArt88 = ['machine', 'machine-lit', 'ticket', 'jackpot', 'capsule', 'capsule-top', 'capsule-bottom', 'miss'];
  assert(luckyArt88.every(name => existsSync(fileURLToPath(new URL(`../public/assets/lucky/${name}.webp`, import.meta.url)))), 'V13.88 코인 뽑기 그림 8장이 있다');
  const lucky88 = source('../public/modules/lucky.js'), build88 = source('./build-assets.mjs');
  assert(lucky88.includes('/assets/lucky/machine.webp') && lucky88.includes('/assets/lucky/capsule-top.webp') && lucky88.includes('/assets/lucky/ticket.webp') && !lucky88.includes('🎟'), 'V13.88 뽑기 화면은 새 머신·캡슐·뽑기권 그림을 쓴다');
  assert(build88.includes('"v1388.css"'), 'V13.88 뽑기 그림 스타일이 빌드 목록에 있다');

  /* ---------- V13.89 전설 펫 ---------- */
  assert(LEGENDARY_RATE === 0.5 && LEGENDARY_PITY === 150 && LEGENDARY_PET_KEYS.join() === 'haechi,phoenix,whale,qilin' && STANDARD_PET_KEYS.length === 8, 'V13.89 전설 펫은 네 마리, 0.5% 확률, 150회 확정이며 일반 펫과 분리된다');
  const values = xs => () => xs.shift() ?? .99;
  const legendProfile = { pets: [{ key: 'dog' }], avatar_key: 'dog', lucky: { legend_pulls: 148 }, points_spent: 0 };
  const beforePity = pullLucky(legendProfile, 10, 100, { random: values([.5, .99]), now });
  const atPity = pullLucky(legendProfile, 10, 100, { random: values([.5, .6]), now });
  const afterPity = pullLucky(legendProfile, 10, 100, { random: values([.5, 0, 0]), now });
  assert(!beforePity.legendary && beforePity.lucky.legend.remaining === 1 && atPity.legendary?.guaranteed && atPity.legendary.pull === 150 && LEGENDARY_PET_KEYS.includes(atPity.legendary.key) && afterPity.legendary === null && legendProfile.pets.filter(pet => LEGENDARY_PET_KEYS.includes(pet.key)).length === 1, 'V13.89 149번째까지 실패하면 150번째에 확정되고, 한 번 만난 뒤에는 전설 펫이 더 나오지 않는다');
  const legendExpressions = LEGENDARY_PET_KEYS.flatMap(pet => [0, 1, 2, 3].flatMap(form => (form ? ['happy', 'eat', 'sad', 'cheer'] : ['happy', 'eat']).map(expression => expressionSrc(pet, form, expression))));
  assert(legendExpressions.length === 56 && legendExpressions.every(src => src && existsSync(fileURLToPath(new URL('../public' + src, import.meta.url)))), 'V13.89 전설 펫 표정과 알 반응 56장이 등록되어 있고 파일이 있다');
  assert(LEGENDARY_PET_KEYS.every(key => CHARACTERS[key].legendary && petSkill({ key }).key === 'none'), 'V13.89 전설 펫에는 야차전 펫 특기가 없다');
  const lucky89 = source('../public/modules/lucky.js'), arcade89 = source('../public/modules/arcade.js'), service89 = source('./service.mjs'), css89 = source('../public/v1389.css'), build89 = source('./build-assets.mjs');
  assert(lucky89.includes('legend-egg-glow.webp') && lucky89.includes('legend-egg-burst.webp') && lucky89.includes('legend-badge.webp') && lucky89.includes('function legendaryShow(') && css89.includes('.lk-legend-show{') && build89.includes('"v1389.css"'), 'V13.89 전설 알의 빛남·깨짐·배지 연출과 전설 결과 화면이 빌드에 들어간다');
  assert(arcade89.includes('LEGENDARY_RATE') && service89.includes('postNotice(state') && service89.includes('(epic ? EPIC_PET_KEYS : STANDARD_PET_KEYS).filter') && service89.includes('학생이 ${where}에서 전설 펫') && service89.includes("announceLegend(state, p, result.legendary.key, '행운 뽑기')"), 'V13.89 확률과 천장을 안내하고, 전설 획득은 학교에 알리며, 랜덤 알에서는 일반 펫만 나온다');
  const fc90 = source('../public/modules/flashcards.js'), student90 = source('../public/modules/student.js'), app90 = source('../public/app.js'), css90 = source('../public/v1390.css');
  assert(fc90.includes('export function openFlashcards(') && fc90.includes('KNOWN_AT') && fc90.includes("data-fc=\"next-round\"") && fc90.includes("data-fc=\"star-left\"") && fc90.includes("'eng2mean' : 'mean2eng'") && student90.includes('data-flashcards="true"') && student90.includes('export function memorizeDeck(') && app90.includes('if (d.flashcards) return openCards();') && app90.includes('openFlashcards({') && css90.includes('.fc-cover{') && build89.includes('"v1390.css"'), 'V13.90 단어 학습에서 카드로 가리고 외우기: 커버를 끝까지 내리면 아는 카드, 헷갈리는 카드만 다음 라운드, ★ 담기와 확인 테스트');
  assert(css90.includes('.lk-machine{width:220px') && css90.includes('.lk-result-art{width:156px') && student90.includes('pet-care-more-v1390'), 'V13.90 코인 뽑기 기계·캡슐·결과 그림이 커지고, 펫이 여러 마리면 다른 펫도 돌볼 수 있다고 알려 준다');
  const emblems91 = source('../public/modules/emblems.js'), battle91 = source('../public/modules/battle.js'), css91 = source('../public/v1391.css'), runner91 = source('../docs/asset-requests/runner/build-runner.mjs');
  assert(student90.includes('function meMenu(A, { gachaHave, att })') && student90.includes('data-action="me-stars"') && student90.includes('data-action="me-notify"') && student90.includes('data-action="account"') && student90.includes('id="me-notify"') && app90.includes("d.action === 'me-stars'") && app90.includes("d.action === 'me-notify'") && css91.includes('.me-menu-grid{') && build89.includes('"v1391.css"'), 'V13.91 나 메뉴판: 내 기록·출석·어려운 단어·알림·앱 설치·계정을 아이콘 메뉴로 연다');
  const wired91 = ['nav-home', 'nav-study', 'nav-yacha', 'nav-arcade', 'nav-me', 'me-pets', 'me-ranking', 'me-titles', 'me-records', 'me-settings', 'study-vocab', 'study-grammar', 'exam-practice', 'exam-test', 'study-daily', 'flash-deck', 'flash-done', 'word-empty', 'badge-first100', 'badge-streak90', 'badge-english100', 'badge-master', 'me-attendance', 'me-stars', 'me-notify', 'me-install', 'me-gacha', 'pet-locked', 'pet-legend-locked', 'empty-records', 'result-perfect', 'result-great', 'result-good', 'result-retry'];
  const allUi91 = student90 + fc90 + battle91 + source('../public/modules/sessions.js');
  assert(emblems91.includes('export const ART_READY = new Set(') && emblems91.includes('export const artOr') && wired91.every(key => allUi91.includes(`'${key}'`) && (runner91.includes(`'${key}'`) || runner91.includes(`assets/ui/${key}.webp`))) && battle91.includes("artOr('mode-' + key") && runner91.includes("['mode-speed'") && runner91.includes("['mode-skill'"), 'V13.91 08 그림 36개 자리가 모두 연결돼 있고, 그림이 오기 전에는 지금 아이콘이 그대로 보인다');
  const missing91 = [...emblems91.matchAll(/ART_READY = new Set\(\[([^\]]*)\]/g)].flatMap(m => [...m[1].matchAll(/'([a-z0-9-]+)'/g)].map(x => x[1])).filter(key => !existsSync(fileURLToPath(new URL(`../public/assets/ui/${key}.webp`, import.meta.url))));
  assert(!missing91.length, `V13.91 ART_READY에 넣은 그림은 파일이 있어야 한다 (${missing91.join(', ')})`);
  const petbook91 = source('../public/modules/petbook.js');
  assert(petbook91.includes('export function petBookPage(A)') && petbook91.includes('STANDARD_PET_KEYS') && petbook91.includes('LEGENDARY_PET_KEYS') && css91.includes('.pb-sprite.shadow{') && petbook91.includes('PET_SKILLS[key]') && student90.includes("petbook: petBookPage") && student90.includes('data-go="petbook"') && css91.includes('.pb-card{') && [...STANDARD_PET_KEYS, ...LEGENDARY_PET_KEYS].every(key => [0, 1, 2, 3].every(f => existsSync(fileURLToPath(new URL(`../public/assets/pets/${key}-${f}-s.webp`, import.meta.url))))), 'V13.91 학생은 나 → 펫 도감에서 모든 펫을 보고, 못 만난 펫은 그림자와 만나는 법으로 보인다');
  assert(lucky89.includes("box.className = 'lk-show lk-legend-show lgx'") && ['p0', 'p1', 'p2', 'p3', 'p4'].every(c => lucky89.includes(`'${c}'`)) && lucky89.includes('lgx-future') && lucky89.includes('SFX.fanfare()') && lucky89.includes('SFX.boom()') && lucky89.includes('if (reduced()) return showResult();') && lucky89.includes('if (!ready) return;') && css91.includes('.lgx.p4 .lgx-flash{') && css91.includes('@keyframes lgxRing'), 'V13.91 전설 펫을 뽑으면 어둠·박동·섬광·공개로 이어지는 연출이 나오고, 누르면 건너뛰고, 움직임 줄이기면 바로 결과가 보인다');
  /* ---------- V13.94 야차전: 각자 내 범위 · 더 긴 대결 · 새 메뉴 화면 ---------- */
  {
    const mk = (prefix, n, typed = true) => Array.from({ length: n }, (_, i) => ({ id: `${prefix}${i}`, word: typed ? `${prefix}word${'abcdefghijklmnop'[i]}` : `${prefix}-${i}!`, meaning: `${prefix} 뜻 ${i}` }));
    const [qa, qb] = pairedBattleQuestions(mk('aa', 30), mk('bb', 9), 'skill', 40);
    assert(qa.length === 40 && qb.length === 40 && qa.every((q, i) => (q.kind || 'choice') === (qb[i].kind || 'choice')) && qa.some(q => q.kind === 'spell') && qa.every(q => q.word_id.startsWith('aa')) && qb.every(q => q.word_id.startsWith('bb')) && new Set(qb.map(q => q.word_id)).size === 9, 'V13.94 각자 내 범위 questions: each list is from its own range, the n-th words are the same kind, and a small range is shuffled again');
    const [sa, sb] = pairedBattleQuestions(mk('cc', 12), mk('dd', 12, false), 'skill', 20);
    assert(sa.length === 20 && [...sa, ...sb].every(q => q.kind !== 'spell') && !spellable(mk('dd', 1, false)[0]), 'V13.94 when one range has no word to spell, both players get four choices only');
    const battle94 = source('../public/modules/battle.js'), css94 = source('../public/v1394.css'), build94 = source('./build-assets.mjs');
    assert(battle94.includes("data-yb=\"range-mode\"") && battle94.includes('range_mode: rangeMode()') && battle94.includes('range_codes: myRanges()') && battle94.includes('rangeDeal(room)') && battle94.includes('rangeDeal(invite)') && battle94.includes('const mine = e.own?.[v.me] || e;') && battle94.includes('e.answers?.[v.me] ?? e.answer') && battle94.includes('sumus-yacha-ranges:'), 'V13.94 야차전: the lobby sends 각자 내 범위 or 같은 범위로, a joining friend brings their own range and sees whose words come, and each phone draws its own word');
    assert(battle94.includes('class="ya-hero"') && battle94.includes('class="ya-panel ya-setup"') && ['대결 방식', '내 단어 범위', '판돈'].every(t => battle94.includes(`'${t}'`)) && battle94.includes('class="ya-cta"') && css94.includes('.ya-hero{') && css94.includes('@media (min-width:768px)') && css94.includes('.ya-play{grid-template-columns') && build94.includes('"v1394.css"') && !battle94.includes('const MAX_HP = 100'), 'V13.94 야차전 메뉴 화면: 밤의 대결장 히어로, 3단계 대결 준비, 패드에서는 두 칸');
  }
  /* ---------- V13.94 로보 연습 · 몬스터 잡기 · 공격 이펙트 · 호야 그림 ---------- */
  {
    assert(BOT_HP === 400 && BOT_LEVELS.easy.accuracy === .68 && BOT_LEVELS.normal.accuracy === .84 && BOT_LEVELS.hard.accuracy === .95 && BOT_LEVELS.hard.max <= 2700 && source('../public/modules/battle-bot.js').includes('hp = BOT_HP'), 'V13.94 로보 연습: 더 정확하고 빠른 로보, HP 400으로 한 판이 약 2분');
    const counts = new Map([['24', 47], ['29', 40], ['31', 27], ['32', 27], ['33', 28], ['2', 3], ['10', 20], ['L1', 68]]);
    const parts = monsterParts(counts);
    assert(parts.map(p => p.key).join('|') === '10+24|29+31|32+33+L1' && parts.every(p => p.words >= 8 && p.monster === MONSTERS[p.index % 9]) && monsterParts(new Map([...counts].reverse())).map(p => p.key).join('|') === parts.map(p => p.key).join('|'), 'V13.94 몬스터 파트: 범위를 번호 순서로 묶고(60단어 또는 3범위까지, 4단어 미만 범위 제외), 파트마다 몬스터가 정해진다');
    assert(monsterOpen({}, 'easy') && !monsterOpen({}, 'normal') && monsterOpen({ easy: 1 }, 'normal') && !monsterOpen({ easy: 1 }, 'hard') && monsterOpen({ easy: 1, normal: 1 }, 'hard'), 'V13.94 이지 → 노말 → 하드 순서로 열린다');
    /* ---------- V13.105 끝없는 레벨: 레벨마다 이지 → 노말 → 하드, 하드를 깨면 다음 레벨 ---------- */
    const lv = (stage, k) => stageLevel(stage, k);
    assert(['easy', 'normal', 'hard'].map(k => lv(1, k).first.coins).join() === '5,10,15' && ['easy', 'normal', 'hard'].map(k => lv(1, k).first.xp).join() === '60,120,240'
      && lv(2, 'hard').first.coins > lv(1, 'hard').first.coins && lv(11, 'hard').first.coins > lv(9, 'hard').first.coins
      && lv(99, 'hard').first.coins === STAGE_REWARD.hard.coins * STAGE_REWARD_MAX && lv(100, 'hard').first.coins === Math.round(STAGE_REWARD.hard.coins * STAGE_REWARD_MAX * 1.5)
      && ['easy', 'normal', 'hard'].every(k => lv(30, k).again.coins === Math.min(STAGE_AGAIN_MAX, Math.max(STAGE_AGAIN_MIN[k], Math.round(lv(30, k).first.coins * STAGE_AGAIN_SHARE))) && lv(30, k).again.coins * MONSTER_DAILY <= 125)
      && ['easy', 'normal', 'hard'].map(k => lv(1, k).again.coins).join() === '3,5,8' && ['easy', 'normal', 'hard'].map(k => lv(10, k).again.coins).join() === '8,16,24' && lv(100, 'hard').again.coins === 25 && ['easy', 'normal', 'hard'].every(k => [1, 5, 10, 30, 100].every(n => lv(n, k).again.coins < lv(n, k).first.coins)),
      'V13.106 보상: 레벨 1은 이지/노말/하드 5/10/15코인으로 낮게 시작해 레벨마다 오르고(최대 4배), 보스(5레벨마다)는 1.5배, 다시 잡기는 첫 처치의 50%(최소 3/5/8, 한 번에 최대 25코인, 하루 5번)');
    assert(['easy', 'normal', 'hard'].every(k => ['accuracy', 'min', 'max', 'need', 'hp', 'mode', 'skill'].every(key => lv(10, k)[key] === MONSTER_LEVELS[k][key]) && lv(10, k).monsterHp === Math.round(MONSTER_LEVELS[k].monsterHp * 1.08))
      && ['easy', 'normal', 'hard'].every(k => lv(1, k).accuracy < lv(5, k).accuracy && lv(5, k).accuracy < lv(10, k).accuracy && lv(10, k).accuracy < lv(30, k).accuracy && lv(30, k).accuracy < lv(200, k).accuracy && lv(1, k).min > lv(30, k).min)
      && lv(1, 'hard').mode === 'skill' && lv(1, 'easy').mode === 'speed' && isBossStage(5) && isBossStage(10) && !isBossStage(11) && lv(5, 'hard').boss && lv(15, 'normal').monsterHp > lv(14, 'normal').monsterHp,
      'V13.105 난이도: 레벨이 오를수록 몬스터가 정확하고 빨라지고(레벨 10이 V13.94의 이지·노말·하드), 하드는 실력전, 5레벨마다 보스');
    // The curve, from fights simulated on the real engine (server/monster-sim.mjs, fixed seed).
    const winRate = (stage, k, know) => simulateMonster(stage, k, know, 160);
    const w1 = winRate(1, 'hard', .98), w5e = winRate(5, 'easy', .75), w10 = winRate(10, 'hard', .98), w30 = winRate(30, 'hard', .98), w60n = winRate(60, 'normal', .9);
    assert(w1 >= .9 && w5e >= .85 && w10 >= .2 && w10 <= .6 && w30 <= .2 && w60n <= .2, `V13.105 시뮬레이션: 레벨 1 하드는 거의 다 아는 학생이 거의 이기고(${Math.round(w1 * 100)}%), 레벨 10 하드는 지금 하드 수준(${Math.round(w10 * 100)}%), 레벨 30 하드·레벨 60 노말은 아주 어렵다(${Math.round(w30 * 100)}%, ${Math.round(w60n * 100)}%)`);
    assert(MONSTER_ORDER.length === 18 && new Set(MONSTER_ORDER).size === 18 && MONSTER_ORDER.every(k => MONSTERS.some(m => m.key === k && m.temp?.pet && m.temp.filter)) && stageMonster(1).key === 'mochi' && stageMonster(18).key === 'finalking' && stageMonster(19).key === 'mochi' && stageMonster(19).round === 1 && stageMonster(19).title === '암기 모찌 +1' && stageMonster(37).round === 2,
      'V13.105 몬스터 18종(새 9종 포함)이 작은 것부터 큰 것 순서로 레벨을 지키고, 18레벨 뒤에는 "+1"로 더 세게 다시 나온다(그림이 오기 전에는 펫 그림 색 바꾸기)');
    const kid = { id: 'qa-mh', pets: [{ key: 'dog' }], bonus: {} };
    const t0 = Date.parse('2026-10-03T03:00:00Z');
    const fight = (stage, level, result, right, at) => { const r = monsterStart(kid, { stage, level, codes: ['1'], id: 'f-' + at, now: at }); return monsterFinish(kid, { id: r.id, result, right, now: at + 60000 }); };
    let refused = 0; try { monsterStart(kid, { stage: 1, level: 'normal', id: 'x', now: t0 }); } catch (err) { refused = err.status; }
    let ahead = 0; try { monsterStart(kid, { stage: 2, level: 'easy', id: 'y', now: t0 }); } catch (err) { ahead = err.status; }
    const firstWin = fight(1, 'easy', 'win', 9, t0);
    const again = fight(1, 'easy', 'win', 9, t0 + 100000);
    const few = fight(1, 'easy', 'lose', 2, t0 + 200000);
    const quick = monsterFinish(kid, { id: monsterStart(kid, { stage: 1, level: 'easy', id: 'q', now: t0 }).id, result: 'win', right: 9, now: t0 + 5000 });
    assert(refused === 409 && ahead === 409 && firstWin.paid && firstWin.first && firstWin.coins === lv(1, 'easy').first.coins && again.paid && !again.first && again.coins === lv(1, 'easy').again.coins && !few.paid && few.reason === 'few' && !quick.paid && quick.reason === 'short',
      'V13.105 몬스터 보상: 잠긴 난이도·안 열린 레벨은 거절, 첫 처치는 그 레벨의 보상, 다시 잡으면 작은 보상, 단어를 덜 맞히거나 너무 빨리 끝나면 없음');
    for (let i = 0; i < MONSTER_DAILY; i++) fight(1, 'easy', 'lose', 9, t0 + 300000 + i * 100000);
    const capped = fight(1, 'easy', 'win', 9, t0 + 900000);
    const normalFirst = fight(1, 'normal', 'win', 12, t0 + 1000000), hardFirst = fight(1, 'hard', 'win', 14, t0 + 1100000);
    const view1 = monsterView(kid, t0 + 1200000);
    const next = fight(2, 'easy', 'win', 9, t0 + 1300000);
    assert(!capped.paid && capped.reason === 'daily' && normalFirst.first && hardFirst.paid && hardFirst.first && hardFirst.stage_up === 2 && hardFirst.coins === lv(1, 'hard').first.coins && view1.stage === 2 && view1.best === 1 && !Object.keys(view1.clear).length
      && next.first && next.coins === lv(2, 'easy').first.coins && monsterView(kid, t0).clear.easy && kid.bonus.monster.hard_wins === 1 && kid.bonus.monster.wins >= 4,
      'V13.105 하루 다시 잡기 보상은 5번까지(첫 처치는 언제나), 하드를 처음 깨면 다음 레벨이 열리고(이지부터), 다음 레벨 첫 처치는 그 레벨 보상');
    // The 하드 farming the teacher saw: a cleared 하드 played again pays 20% of its first clear only.
    const farm = fight(1, 'hard', 'win', 14, t0 + DAY_MS);
    assert(farm.paid && !farm.first && farm.coins === lv(1, 'hard').again.coins && farm.coins === 8 && farm.coins < lv(1, 'hard').first.coins, 'V13.106 이미 깬 하드를 다시 잡으면 첫 처치의 절반쯤(레벨 1은 8코인)이고, 하루 5번·한 번 최대 25코인이라 반복만으로는 첫 처치보다 적다');
    assert(['monster1', 'monster10', 'monsterhard', 'monsterlord'].every(key => TITLES[key]?.group === 'monster') && TITLES.monsterlord.tier === 'legendary', 'V13.94 몬스터 칭호 4개');
    // V13.99: a lost fight is checked for time too, by how long the right answers take.
    const loser = { id: 'qa-mh-lose', pets: [{ key: 'dog' }], bonus: {} };
    const lose = (right, ms, at) => monsterFinish(loser, { id: monsterStart(loser, { stage: 1, level: 'easy', id: 'l-' + at, now: at }).id, result: 'lose', right, now: at + ms });
    const need1 = lv(1, 'easy').need;
    const fakeLoss = lose(9, 5000, t0);
    const fakeNeed = lose(need1, need1 * MONSTER_MS_PER_RIGHT - 1, t0 + 100000);
    // An honest quick loss: 3 s countdown, then each word at least ~1 s answer + 1.4 s reveal.
    const fastHonest = lose(need1, 3000 + need1 * 2400, t0 + 200000);
    assert(!fakeLoss.paid && fakeLoss.reason === 'short' && !fakeNeed.paid && fakeNeed.reason === 'short' && fastHonest.paid && MONSTER_MS_PER_RIGHT === 1500, 'V13.99 몬스터에게 진 판도 최소 시간(정답 1개당 1.5초) 검사를 받는다');
    // The engine: a monster brings its own HP and skill, and wins if time runs out.
    const mq = Array.from({ length: 6 }, (_, i) => ({ word_id: 'm' + i, prompt: 'w' + i, options: ['a', 'b', 'c', 'd'], answer: 0 }));
    const mb = createBattle({ id: 'mb', players: [{ id: 'me', name: '나', pet: { key: 'dog' } }, { id: 'mon', name: '슬라임', pet: { key: 'whale', skill: 'rage' }, monster: { key: 'slime', level: 'hard' }, hp: 330 }], questions: mq, hp: 300, timeoutWinner: 'mon', now: 0 });
    connect(mb, 'me', 0); connect(mb, 'mon', 0); tick(mb, BATTLE.COUNTDOWN_MS);
    const view = battleView(mb, 'me');
    const timeUp = tick(mb, mb.ends_at + 1).concat(tick(mb, mb.ends_at + 5000)).find(e => e.type === 'end');
    assert(mb.players.me.hp === 300 && mb.players.mon.hp === 330 && view.players.mon.max_hp === 330 && view.players.me.max_hp === 300 && view.players.mon.monster.key === 'slime' && petSkill(mb.players.mon.pet).name === MONSTER_SKILLS.rage.name && timeUp?.result.winner === 'mon', 'V13.94 몬스터는 자기 HP와 특기를 갖고, 시간 안에 쓰러뜨리지 못하면 몬스터가 이긴다');
    const battle94b = source('../public/modules/battle.js'), css94b = source('../public/v1394.css');
    assert(battle94b.includes("['monster', '몬스터']") && battle94b.includes('function monsterTab()') && battle94b.includes("registerStart('/monster/start'") && battle94b.includes("monster: '/monster/finish'") && battle94b.includes('ko: true') && css94b.includes('.mh-part{') && source('./service.mjs').includes("path === '/monster/start'"), 'V13.94 야차전의 몬스터 탭에서 파트별 몬스터를 이지·노말·하드로 잡는다');
    assert(battle94b.includes('function strike(') && battle94b.includes("strike(atk, def,") && battle94b.includes('skill: true, attacker: p') && battle94b.includes('function knockout(') && ['.fx-shot{', '.fx-ring{', '.fx-claw{', '.fx-beam{', '.fx-ko{', '@keyframes fx-shake-l'].every(x => css94b.includes(x)), 'V13.94 공격 이펙트: 날아가는 공격·충격파·불꽃·화면 흔들림, 특기는 광선, 몬스터는 할퀴기, 쓰러뜨리면 K.O.!');
    assert(battle94b.includes('ya-chip-study') && battle94b.includes('class="ya-picked') && battle94b.includes('ya-rm-duel') && battle94b.includes('친구가 다른 번호를 외우고 있다면?'), 'V13.94 내 단어 범위: 단어 수·학습 중 표시·고른 범위 요약·각자/같은 범위 그림 설명');
  }
  /* ---------- V13.105 옛 몬스터 기록 옮기기 (파트 → 레벨) · 서버 경로 ---------- */
  {
    const t0 = Date.parse('2026-10-05T03:00:00Z');
    // V13.100 helpers stay for the move: old part keys back into range codes, clears per range.
    assert(partKeyCodes('10+24+L1').join(',') === '10,24,L1' && partKeyCodes('1+2+5', ['1+2', '5']).join(',') === '1+2,5', 'V13.100 옛 파트 키를 범위 번호로 푼다(+가 들어간 범위 번호는 그대로)');
    const parts = monsterParts(new Map([['1', 30], ['2', 30], ['3', 40], ['4', 50], ['5', 60]]));
    // Two parts cleared up to 하드, a third with 이지 only: level 3 with 이지 already cleared, no coins again.
    const ranges = Object.fromEntries(parts.slice(0, 2).flatMap(p => p.codes).map(code => [`s|g|${code}`, { easy: t0, normal: t0 + 1, hard: t0 + 2 }]).concat(parts[2].codes.map(code => [`s|g|${code}`, { easy: t0 + 3 }])));
    const vet = { id: 'qa-mh104-vet', pets: [{ key: 'dog' }], bonus: { monster: { ranges: structuredClone(ranges), wins: 7, hard_wins: 2 } } };
    const read = monsterView(vet, t0, { scope: 's|g', parts });
    const coinsBefore = bonusRecords(vet).reduce((n, r) => n + r.reward_points, 0), unsaved = !vet.bonus.monster.stage;
    const started = monsterStart(vet, { stage: 3, level: 'normal', codes: ['1'], parts, scope: 's|g', id: 'v1', now: t0 });
    assert(parts.length === 3 && read.stage === 3 && read.best === 2 && read.clear.easy && !read.clear.normal && unsaved
      && started.stage === 3 && vet.bonus.monster.stage === 3 && vet.bonus.monster.best === 2 && vet.bonus.monster.from_parts?.parts === 2 && JSON.stringify(vet.bonus.monster.ranges) === JSON.stringify(ranges)
      && vet.bonus.monster.wins === 7 && bonusRecords(vet).reduce((n, r) => n + r.reward_points, 0) === coinsBefore,
      'V13.105 옛 기록: 하드까지 깬 파트 수만큼 레벨을 깬 것으로 치고(코인은 다시 주지 않음), 끝까지 못 깬 파트의 이지·노말은 이어서, 원래 기록은 그대로 둔다');
    const late = monsterFinish(vet, { id: 'v1', result: 'win', right: 12, scope: 's|g', parts, now: t0 + 60000 });
    assert(late.paid && late.first && late.coins === stageLevel(3, 'normal').first.coins && monsterProgress(vet, { scope: 's|g', parts }).stage === 3 && monsterView(vet, t0 + 60000, { scope: 's|g', parts }).clear.normal, 'V13.105 옮긴 뒤에는 레벨 3 노말부터 이어서 첫 처치 보상을 받는다');
    // V13.94–V13.99 cleared map (part keys) is read too.
    const old = { id: 'qa-mh104-old', pets: [{ key: 'dog' }], bonus: { monster: { cleared: { [parts[0].key]: { easy: 1, normal: 2, hard: 3 } } } } };
    assert(monsterView(old, t0, { scope: 's|g', parts }).stage === 2 && monsterProgress({ bonus: {} }).stage === 1 && monsterMigrate(old, 's|g', parts.flatMap(p => p.codes)) && old.bonus.monster.cleared_v1, 'V13.105 V13.94의 파트 기록도 레벨로 읽고, 기록이 없으면 레벨 1부터');
    // A fight of the old screen (a part, no level number) still settles: never a first clear.
    const legacyKid = { id: 'qa-mh104-leg', pets: [{ key: 'dog' }], bonus: { monster: { stage: 1, clear: {}, live: { id: 'old', part: '1+2', level: 'easy', at: t0 } } } };
    const legacyEnd = monsterFinish(legacyKid, { id: 'old', result: 'win', right: 9, now: t0 + 60000 });
    assert(legacyEnd.paid && !legacyEnd.first && legacyKid.bonus.monster.stage === 1 && !legacyKid.bonus.monster.clear.easy, 'V13.105 업데이트 전에 시작한 전투는 다시 잡기로 끝난다(레벨 기록은 그대로)');
    // Through the service: the ranges the student picked (their school and grade, 8 words or more).
    state.schools.push({ id: 'qa-mh-school', name: '몬스터고', full_name: '몬스터고등학교', division: 'high', active: true, sort_order: 90 });
    const words = [['1', 29], ['2', 30], ['3', 5]].flatMap(([code, n]) => Array.from({ length: n }, (_, i) => ({ id: `qa-mh-${code}-${i}`, range_code: code, word: `w${code}x${i}`, meaning: `뜻${code}-${i}` })));
    state.extraBooks.push({ id: 'qa-mh-book', school_id: 'qa-mh-school', school: '몬스터고', division: 'high', grade: '고1A', title: '몬스터 단어', words });
    state.profiles.push(student('qa-mh104-svc', '몬헌', { school_id: 'qa-mh-school', school: '몬스터고', bonus: { monster: { cleared: { '1+2+3': { easy: t0, normal: t0 + 1, hard: t0 + 2 } } } } }));
    const svcToken = await login('qa-mh104-svc');
    const shown = (await service(state, 'GET', '/bootstrap', {}, svcToken)).rewards.monster;
    let noRange = 0; try { await service(state, 'POST', '/monster/start', { stage: 2, level: 'easy', range_codes: [] }, svcToken); } catch (err) { noRange = err.status; }
    let tooFew = 0; try { await service(state, 'POST', '/monster/start', { stage: 2, level: 'easy', range_codes: ['3'] }, svcToken); } catch (err) { tooFew = err.status; }
    let strange = 0; try { await service(state, 'POST', '/monster/start', { stage: 2, level: 'easy', range_codes: ['99'] }, svcToken); } catch (err) { strange = err.status || 1; }
    let locked = 0; try { await service(state, 'POST', '/monster/start', { stage: 3, level: 'easy', range_codes: ['1'] }, svcToken); } catch (err) { locked = err.status; }
    const start = await service(state, 'POST', '/monster/start', { stage: 2, level: 'easy', range_codes: ['1', '3'] }, svcToken);
    const svc = profile('qa-mh104-svc');
    svc.bonus.monster.live.at -= 60000;
    const finish = await service(state, 'POST', '/monster/finish', { id: start.id, result: 'win', right: 20 }, svcToken);
    assert(shown.stage === 2 && shown.best === 1 && noRange === 400 && tooFew === 409 && strange && locked === 409 && start.stage === 2 && start.monster === stageMonster(2).key && svc.bonus.monster.live === undefined
      && JSON.stringify(svc.bonus.monster.ranges ? Object.keys(svc.bonus.monster.ranges).length : 0) !== '' && finish.paid && finish.first && finish.coins === stageLevel(2, 'easy').first.coins && finish.stage === 2 && finish.clear.easy,
      'V13.105 /monster/start: 레벨 번호와 고른 단어 범위(같은 학교·학년, 8단어 이상)로 시작하고, 안 열린 레벨은 거절, 끝내면 그 레벨 첫 처치 보상');
    const oldScreen = await service(state, 'POST', '/monster/start', { part: '1+2+3', level: 'normal' }, svcToken);
    assert(oldScreen.stage === 2 && oldScreen.level === 'normal' && svc.bonus.monster.live.codes.join() === '1,2,3', 'V13.105 예전 화면(파트로 시작)도 지금 레벨로 시작한다');
    delete svc.bonus.monster.live;
    const battle104 = source('../public/modules/battle.js'), css104 = source('../public/v13105.css');
    assert(battle104.includes("registerStart('/monster/start', { stage, level, range_codes: w.picked })") && battle104.includes('function stageCard(') && battle104.includes('function stageLocked(') && battle104.includes("data-yb=\"monster-go\" data-stage=") && battle104.includes('stage_up') && battle104.includes("label: `레벨 ${stage}${L.boss ? ' · 보스' : ''} · ${L.name}`")
      && css104.includes('.ms-plate{') && css104.includes('.ms-stage.boss.now') && css104.includes('.mon-temp.mon-round') && source('./build-assets.mjs').includes('"v13105.css"'),
      'V13.105 몬스터 탭: 지금 레벨 카드(이지·노말·하드), 다음 레벨 그림자, 지난 레벨 다시 하기, 레벨 판 숫자, 싸울 단어 범위 고르기, 레벨 업 안내');
  }
  /* ---------- V13.106 몬스터 2탄 그림 (시트 12-1 … 12-10) ---------- */
  {
    const { existsSync } = await import('node:fs');
    const asset = name => fileURLToPath(new URL(`../public/assets/${name}.webp`, import.meta.url));
    const webpSize = name => { const b = readFileSync(asset(name)); return b.toString('ascii', 12, 16) === 'VP8X' ? `${1 + b.readUIntLE(24, 3)}x${1 + b.readUIntLE(27, 3)}` : ''; };
    const second = ['mochi', 'pencilworm', 'mimic', 'sleepcloud', 'alarmwolf', 'scrollgoblin', 'proctor', 'cramwizard', 'mockhydra'];
    const plates = ['monster-stage', 'monster-stage-lock', 'monster-stage-clear', 'monster-stage-boss'];
    const { ART_READY } = await import('../public/modules/emblems.js');
    assert(second.every(k => MONSTER_ART.has(k) && ['', '-attack', '-hurt', '-down'].every(p => existsSync(asset(`monsters/${k}${p}`)) && webpSize(`monsters/${k}${p}`) === '512x512')) && MONSTER_ORDER.every(k => MONSTER_ART.has(k)),
      'V13.106 새 몬스터 9종(암기 모찌 … 모의고사 히드라)의 기본·공격·맞음·쓰러짐 36장이 있고 모두 그림으로 보인다(임시 펫 그림은 이제 안 쓴다)');
    assert(plates.every(k => ART_READY.has(k) && existsSync(asset(`ui/${k}`)) && webpSize(`ui/${k}`) === '256x256') && source('../public/modules/battle.js').includes("artOr('monster-stage' + (kind === 'open' ? '' : '-' + kind), '', 'ms-plate-art')"),
      'V13.106 몬스터 레벨 판 그림 4개(열림·잠김·깸·보스)가 있고 레벨 목록의 판에 쓰인다');
  }
  /* ---------- V13.95 몬스터 그림 (시트 10-1 … 10-10) ---------- */
  {
    const { existsSync } = await import('node:fs');
    const asset = name => fileURLToPath(new URL(`../public/assets/${name}.webp`, import.meta.url));
    // Canvas size from the webp header (VP8X chunk: width-1 and height-1, 24-bit little endian).
    const webpSize = name => { const b = readFileSync(asset(name)); return b.toString('ascii', 12, 16) === 'VP8X' ? `${1 + b.readUIntLE(24, 3)}x${1 + b.readUIntLE(27, 3)}` : ''; };
    const monsterArt = MONSTERS.flatMap(m => ['', ...MONSTER_POSES.map(p => '-' + p)].map(p => `monsters/${m.key}${p}`));
    assert(MONSTERS.every(m => MONSTER_ART.has(m.key)) && monsterArt.length === 72 && monsterArt.every(n => existsSync(asset(n)) && webpSize(n) === '512x512'), 'V13.95 · V13.106 몬스터 18종 × 기본·공격·맞음·쓰러짐 72장이 512px 그림으로 있다');
    assert(['monster-tab', 'monster-easy', 'monster-normal', 'monster-hard'].every(n => existsSync(asset('ui/' + n)) && webpSize('ui/' + n) === '256x256'), 'V13.95 몬스터 화면 아이콘 4개(몬스터 탭 · 이지 · 노말 · 하드 배지)');
    // Poses: a monster picture swaps like a pet's, and a knocked-out one stays down.
    const fakeArt = src => { const img = { src, isConnected: true, getAttribute: () => img.src, setAttribute: (k, v) => { img.src = v; } }; return { img, querySelector: () => img }; };
    const down = fakeArt('/assets/monsters/slime.webp');
    const held = holdPose(down, 'down');
    showPose(down, 'hurt', 10); // held: returns before loading anything (no Image in node)
    assert(held && down.img.src === '/assets/monsters/slime-down.webp' && down.img._held && !holdPose(fakeArt('/assets/monsters/slime.webp'), 'eat'),'V13.95 몬스터는 쓰러지면 쓰러짐 그림으로 바뀌고 그대로 남는다(맞은 그림으로 돌아가지 않는다)');
    const battle95 = source('../public/modules/battle.js'), css95 = source('../public/v1395.css');
    assert(battle95.includes("holdPose(pet, 'down')") && battle95.includes('avatar-art avatar-img mon-art') && battle95.includes("uiArt('monster-tab', 'ya-tab-art')") && battle95.includes("uiArt('monster-' + level, cls)") && !battle95.includes('LEVEL_ICONS') && css95.includes('.yb-pet.fx-down.mon-down{') && css95.includes('.mh-result-down.art{') && source('./build-assets.mjs').includes('"v1395.css"'), 'V13.95 몬스터 탭 아이콘, 이지·노말·하드 방패 배지, 쓰러짐 그림은 기울이지 않는다');
  }
  /* ---------- V13.96 칭호 메달 그림 주문서 (11-titles) ---------- */
  {
    const { existsSync } = await import('node:fs');
    const { TITLE_ART, titleEmblem } = await import('../public/modules/emblems.js');
    const map96 = source('../docs/asset-requests/runner/slice-map.csv').split('\n').filter(line => line.startsWith('"11-titles.txt"'));
    const prompts96 = source('../docs/asset-requests/runner/11-titles.txt').split('\n---\n');
    const keys96 = Object.keys(TITLES);
    assert(keys96.length === 65 && keys96.every(key => map96.some(line => line.endsWith(`"public/assets/titles/${key}.webp"`))) && map96.length === 68 && prompts96.length === 17, 'V13.96 칭호 65개(옛 뽑기 칭호 포함)마다 메달 그림 주문이 있다: 시트 17장 = 메달 65개 + 칭호 화면 그림 3개');
    assert(prompts96.every(p => p.includes('STYLE REFERENCE — before drawing, open') && p.includes('Google Drive folder') && /named exactly "11-\d+\.png"/.test(p) && p.includes('"SUMUS 칭호 11 (Runner용)"')) && prompts96.slice(1).every(p => p.includes('Also open "11-1.png"')), 'V13.96 칭호 주문서마다 Drive의 기존 그림을 열어 그림체를 맞추고, 정해진 Drive 폴더에 정확한 이름(11-N.png)으로 저장하라고 적혀 있다');
    // One frame per medal, by tier: as many frame lines of a tier as titles of that tier.
    const tierFrames = { common: 'mint-silver rim', rare: 'HEXAGON badge', epic: 'SHIELD-shaped crest', legendary: 'ROUND GOLD medal', limited: 'RAINBOW holographic rim' };
    const allText96 = prompts96.join('\n'), countOf = s => allText96.split(s).length - 1;
    assert(Object.entries(tierFrames).every(([tier, phrase]) => countOf(phrase) === keys96.filter(key => TITLES[key].tier === tier).length), 'V13.96 메달 테두리는 등급을 말한다(일반 민트 동그라미 · 희귀 육각형 · 영웅 방패 · 전설 금빛 햇살 · 한정 무지개)');
    // The app: a title with a picture shows it (big file from 58px, the 96px copy at 34px); the rest keep the SVG medal.
    const registered = [...TITLE_ART];
    TITLE_ART.clear(); TITLE_ART.add('rookie');
    const drawn = titleEmblem('rookie', { size: 'md' }), drawnSmall = titleEmblem('rookie', { size: 'sm', locked: true }), fallback = titleEmblem('focus', { size: 'md' });
    TITLE_ART.clear(); registered.forEach(key => TITLE_ART.add(key));
    assert(drawn.includes('src="/assets/titles/rookie.webp"') && drawnSmall.includes('src="/assets/titles/rookie-s.webp"') && drawnSmall.includes('tt-lock') && !drawn.includes('<svg viewBox="0 0 64 64">') && fallback.includes('<svg viewBox="0 0 64 64">') && registered.every(key => TITLES[key] && existsSync(fileURLToPath(new URL(`../public/assets/titles/${key}.webp`, import.meta.url))) && existsSync(fileURLToPath(new URL(`../public/assets/titles/${key}-s.webp`, import.meta.url)))), 'V13.96 그림이 등록된 칭호는 메달 그림(큰 그림 · 34px은 작은 그림)으로, 나머지는 지금 SVG 메달로 보이고, 등록된 그림은 파일이 있다');
    const ui96 = source('../public/modules/titles-ui.js'), css96 = source('../public/v1396.css');
    assert(["artOr('titles-hero'", "artOr('title-equipped'", "artOr('title-new'"].every(x => ui96.includes(x)) && css96.includes('.tt-emblem .tt-art{') && css96.includes('.tt-emblem.is-locked .tt-art{') && source('./build-assets.mjs').includes('"v1396.css"') && source('../docs/asset-requests/runner/fit-assets.mjs').includes("opt('--small')"), 'V13.96 칭호 도감 그림 3개 자리, 메달 그림의 잠김·미리보기 모습, 작은 그림을 만드는 --small');
  }
  /* ---------- V13.97 그림 연결: 칭호 메달 65개 · 가위바위보 팔 · 몬스터 화면 아이콘 ---------- */
  {
    const { existsSync } = await import('node:fs');
    const { TITLE_ART, ART_READY } = await import('../public/modules/emblems.js');
    const asset = name => fileURLToPath(new URL(`../public/assets/${name}.webp`, import.meta.url));
    const webpSize = name => { const b = readFileSync(asset(name)); return b.toString('ascii', 12, 16) === 'VP8X' ? `${1 + b.readUIntLE(24, 3)}x${1 + b.readUIntLE(27, 3)}` : ''; };
    const keys97 = Object.keys(TITLES);
    assert(keys97.every(key => TITLE_ART.has(key)) && TITLE_ART.size === keys97.length && keys97.every(key => webpSize(`titles/${key}`) === '256x256' && webpSize(`titles/${key}-s`) === '96x96'), 'V13.97 칭호 65개 모두 메달 그림이 있다(256px, 작은 그림 96px)');
    assert(['titles-hero', 'title-equipped', 'title-new'].every(key => ART_READY.has(key) && webpSize(`ui/${key}`) === '256x256'), 'V13.97 칭호 도감 그림 3개(진열장 · 장착 중 · 새 칭호)가 있고 등록되어 있다');
    const arms = ['robot-rock', 'robot-scissors', 'robot-paper', 'robot-flag', 'me-rock', 'me-scissors', 'me-paper', 'me-thumb'];
    const armSizes = arms.map(a => webpSize(`rps/arm-${a}`));
    assert(arms.every(a => existsSync(asset(`rps/arm-${a}`))) && armSizes.slice(0, 4).every(s => s === armSizes[0]) && armSizes.slice(4).every(s => s === armSizes[4]) && source('../public/modules/rps.js').includes('const ARM_ART = true'), 'V13.97 가위바위보 팔 8장이 있고, 로보 팔 4장·내 팔 4장은 크기가 같아 포즈를 바꿔도 팔이 움직이지 않는다');
  }
  /* ---------- V13.93 08 그림 40장 ---------- */
  const ready93 = [...emblems91.matchAll(/ART_READY = new Set\(\[([^\]]*)\]/g)].flatMap(m => [...m[1].matchAll(/'([a-z0-9-]+)'/g)].map(x => x[1]));
  const arcade93 = source('../public/modules/arcade.js'), shop93 = source('../public/modules/pet-moments.js');
  assert(ready93.length === 47 /* the 40 of list 08, + 3 for the 칭호 도감 (V13.97), + 4 monster level plates (V13.106) */ && wired91.every(key => ready93.includes(key)) && ['me-petbook', 'pet-epic-locked', 'epic-egg', 'epic-badge'].every(key => ready93.includes(key)) && student90.includes("'pet-epic-locked'") && arcade93.includes("artOr('epic-egg'") && lucky89.includes("artOr('epic-badge'") && shop93.includes("uiArt('epic-egg')"), 'V13.93 08 그림 40장(펫 도감·영웅 펫 4장 포함)이 모두 들어가 선 아이콘 대신 보인다');
  /* ---------- V13.92 영웅 펫 · 패드 화면 ---------- */
  assert(EPIC_PET_KEYS.join() === 'capybara,penguin,owl,hamster,shark,alpaca,hedgehog,otter' && STANDARD_PET_KEYS.length === 8 && EPIC_PET_KEYS.every(key => CHARACTERS[key].epic && !CHARACTERS[key].legendary && petTier(key) === 'epic') && petTier('dog') === 'basic' && petTier('qilin') === 'legendary' && EPIC_RATE === 3, 'V13.92 영웅 펫 8마리는 기본과 전설 사이 등급이고, 뽑기 확률은 3%다');
  const epicFiles = EPIC_PET_KEYS.flatMap(key => [0, 1, 2, 3].flatMap(f => [`/assets/pets/${key}-${f}.webp`, `/assets/pets/${key}-${f}-s.webp`, ...(f ? ['happy', 'eat', 'sad', 'cheer'] : ['happy', 'eat']).map(e => expressionSrc(key, f, e))]));
  assert(epicFiles.length === 8 * 4 * 2 + 8 * (2 + 12) && epicFiles.every(src => src && existsSync(fileURLToPath(new URL('../public' + src, import.meta.url)))), 'V13.92 영웅 펫 8마리의 알·아기·성장·최종 그림, 작은 그림, 표정 96장, 알 반응 16장이 모두 있다');
  assert(EPIC_PET_KEYS.every(key => PET_SKILLS[key]?.name && PET_SKILLS[key].desc && petSkill({ key }).key === key) && petSkill({ key: 'otter' }).need === 4 && petSkill({ key: 'owl' }).need === 3 && LEGENDARY_PET_KEYS.every(key => petSkill({ key }).key === 'none'), 'V13.92 영웅 펫마다 새 야차전 특기가 있고, 전설 펫에는 여전히 특기가 없다');
  const epicProfile = { pets: [{ key: 'dog' }], avatar_key: 'dog', lucky: {}, points_spent: 0 };
  const epicPull = pullLucky(epicProfile, 10, 100, { random: values([.5, .99, .01, .4]), now });
  const allEpic = { pets: [{ key: 'dog' }, ...EPIC_PET_KEYS.map(key => ({ key }))], lucky: {}, points_spent: 0 };
  const noEpic = pullLucky(allEpic, 10, 100, { random: values([.5, .99, 0]), now });
  assert(!epicPull.legendary && EPIC_PET_KEYS.includes(epicPull.epic?.key) && epicProfile.pets.some(pet => pet.key === epicPull.epic.key && pet.epic) && epicProfile.avatar_key === epicPull.epic.key && epicPull.lucky.epic.left === 7 && noEpic.epic === null && allEpic.pets.length === 9, 'V13.92 코인 뽑기에서 전설이 아니면 3% 확률로 아직 못 만난 영웅 펫의 알이 나오고, 다 모으면 더 나오지 않는다');
  const service92 = source('./service.mjs'), shop92 = source('../public/modules/pet-moments.js'), css92 = source('../public/v1392.css'), studentShell92 = source('../public/modules/student.js'), build92 = source('./build-assets.mjs');
  assert(service92.includes("const epic = body.kind === 'epic', price = epic ? EPIC_EGG_PRICE : EGG_PRICE;") && service92.includes('(epic ? EPIC_PET_KEYS : STANDARD_PET_KEYS).filter') && shop92.includes("await api('/shop/egg', { kind })") && shop92.includes('await epicShow({ key, from: \'shop\' })') && lucky89.includes('export function epicShow(') && lucky89.includes("if (res.epic) return epicShow(") && petbook91.includes('EPIC_PET_KEYS.map') && build92.includes('"v1392.css"'), 'V13.92 알 상점에서 영웅 알을 사면 영웅 연출이 나오고, 펫 도감에 영웅 펫 칸이 있다');
  assert(css92.includes('@media (min-width:768px)') && css92.includes('.bottom-nav .nav-brand{display:flex') && css92.includes('.home-stack-v1360{display:grid!important') && css92.includes('.session-app{max-width:680px!important') && studentShell92.includes('<div class="nav-brand" aria-hidden="true">'), 'V13.92 패드(768px 이상)에서는 메뉴가 왼쪽 세로 줄로 가고 화면을 넓게 쓰며, 휴대폰은 하단 메뉴 그대로다');

  {
    /* ---------- V13.98 영웅 알 800코인 · 영웅 알에서 전설 1% ---------- */
    assert(EPIC_EGG_PRICE === 800 && EGG_PRICE === 400 && EPIC_EGG_LEGENDARY_RATE === 1, 'V13.98 영웅 알은 800코인이고, 1% 확률로 전설 펫이 나온다(랜덤 알은 400코인 그대로)');
    const fresh = () => ({ pets: [{ key: 'dog' }], avatar_key: 'dog', points_spent: 0 });
    const lucky = fresh(), luckyEgg = openEgg(lucky, { epic: true, missing: EPIC_PET_KEYS, price: EPIC_EGG_PRICE, random: values([.0099, .5]), now });
    assert(luckyEgg.legendary && LEGENDARY_PET_KEYS.includes(luckyEgg.key) && lucky.pets.some(pet => pet.key === luckyEgg.key && pet.legendary) && lucky.avatar_key === luckyEgg.key && lucky.points_spent === 800 && lucky.lucky.legend_key === luckyEgg.key && lucky.purchases[0].item === 'epic_egg' && lucky.purchases[0].legendary, 'V13.98 영웅 알의 1% 행운이면 전설 펫이 나오고(코인 800 사용), 전설 기록이 남는다');
    const plain = fresh(), plainEgg = openEgg(plain, { epic: true, missing: EPIC_PET_KEYS, price: EPIC_EGG_PRICE, random: values([.01, .5]), now });
    assert(!plainEgg.legendary && EPIC_PET_KEYS.includes(plainEgg.key) && plain.pets.some(pet => pet.key === plainEgg.key && pet.epic), 'V13.98 1%를 넘으면 영웅 알은 영웅 펫이다');
    const owner = { pets: [{ key: 'dog' }, { key: 'haechi', legendary: true }], points_spent: 0 }, ownerEgg = openEgg(owner, { epic: true, missing: EPIC_PET_KEYS, price: EPIC_EGG_PRICE, random: values([0, .5]), now });
    assert(!ownerEgg.legendary && EPIC_PET_KEYS.includes(ownerEgg.key) && owner.pets.filter(pet => LEGENDARY_PET_KEYS.includes(pet.key)).length === 1, 'V13.98 전설 펫이 이미 있으면 영웅 알에서 전설이 다시 나오지 않는다(전설은 한 마리까지)');
    const basic = fresh(), basicEgg = openEgg(basic, { epic: false, missing: ['cat'], price: EGG_PRICE, random: values([0, 0]), now });
    assert(!basicEgg.legendary && basicEgg.key === 'cat' && basic.points_spent === 400, 'V13.98 랜덤 알에서는 전설이 나오지 않는다');
    const service98 = source('./service.mjs'), shop98 = source('../public/modules/pet-moments.js'), lucky98 = source('../public/modules/lucky.js');
    assert(service98.includes("openEgg(p, { epic, missing, price })") && service98.includes("announceLegend(state, p, key, '영웅 알')") && shop98.includes('if (res.legendary) { close(true); await legendaryShow(res); return; }') && lucky98.includes('export function legendaryShow(') && lucky98.includes('res.legendary.egg'), 'V13.98 영웅 알에서 전설이 나오면 전설 연출이 나오고 학교 소식이 전해진다');
    /* ---------- V13.98 가위바위보: 10분 넘게 둔 판은 이어 던지면 정리된다 ---------- */
    const day98 = dayKey(now), old98 = now - RPS_STALE_MS - 60000;
    const tie98 = { rps: { day: day98, plays: 1, live: { id: 'x', bet: 20, pot: 20, wins: 0, ties: 1, await: 'pick', at: old98 } }, points_spent: 20 };
    const tieRes = rpsPlay(tie98, { bet: NaN, pick: 'rock' }, 100, { random: values([0]), now });
    assert(tieRes.settled && tieRes.paid === 20 && tie98.rps.live === null && tie98.rps.plays === 1 && tie98.rps.paid === 20, 'V13.98 비긴 채 10분 넘게 둔 판을 이어 던지면 건 코인을 돌려받고 판이 정리된다(전에는 오류로 판이 멈춰 있었다)');
    const won98 = { rps: { day: day98, plays: 1, live: { id: 'y', bet: 10, pot: 20, wins: 1, ties: 0, await: 'choice', at: old98 } }, points_spent: 10 };
    const wonRes = rpsPlay(won98, { pick: 'rock', double: true }, 100, { random: values([0]), now });
    assert(wonRes.settled && wonRes.paid === 20 && won98.rps.live === null, 'V13.98 이긴 채 10분 넘게 둔 판에 더블을 누르면 딴 코인을 받고 판이 정리된다');
    const next98 = { rps: { day: day98, plays: 1, live: { id: 'z', bet: 10, pot: 10, wins: 0, ties: 1, await: 'pick', at: old98 } }, points_spent: 10 };
    const nextRes = rpsPlay(next98, { bet: 30, pick: 'rock' }, 100, { random: values([0]), now });
    assert(!nextRes.settled && nextRes.bet === 30 && next98.rps.plays === 2 && next98.rps.paid === 10 && next98.rps.log.length >= 1, 'V13.98 새 판(걸 코인 있음)을 시작하면 오래 둔 판은 정리되고 새 판이 바로 시작된다');
    const rps98 = source('../public/modules/rps.js');
    assert(rps98.includes('if (res.settled) {') && rps98.includes("setBalance(res.points_balance);\n      if (A.data.rewards && res.rps)") && rps98.includes('한 판 최대'), 'V13.98 가위바위보 화면은 던질 때마다 코인을 맞추고, 정리된 판을 알려 준다');
    /* ---------- V13.98 코인 뽑기 ‘오늘 ±’은 하루 전체를 센다 ---------- */
    const net98 = { pets: [{ key: 'dog' }, { key: 'haechi' }, ...EPIC_PET_KEYS.map(key => ({ key }))], lucky: {}, gacha: { tickets: 2 }, points_spent: 0 };
    const rolls98 = [.1, .95, .1, .95, .1, .5, .5];
    const pulls98 = rolls98.map((roll, i) => pullLucky(net98, 10, 1000, { ticket: i >= 5, random: values([roll]), now }));
    const want98 = pulls98.reduce((n, r) => n + (r.ticket ? r.paid : r.paid - r.bet), 0);
    assert(pulls98.length === 7 && net98.lucky.log.length === 6 && luckyViewOf(net98, now).today_net === want98 && luckyViewOf(net98, now + DAY_MS).today_net === null, 'V13.98 뽑기를 6번 넘게 해도 ‘오늘 ±’은 그날 뽑기를 모두 센다');
    /* ---------- V13.98 카드 잘림 · 자동 회전 ---------- */
    const css98 = source('../public/v1398.css'), student98 = source('../public/modules/student.js'), manifest98 = JSON.parse(source('../public/manifest.webmanifest'));
    assert(css98.includes('.partner-card-v1358 .partner-inner{grid-template-columns:minmax(0,1fr)}') && student98.includes('<span class="partner-stars" aria-label="모은 펫 ${owned}/${total}"><b aria-hidden="true">★</b>${owned}<small>/${total}</small></span>') && !student98.includes("'☆'.repeat") && source('./build-assets.mjs').includes('"v1398.css"'), 'V13.98 홈 파트너 카드는 펫이 20마리여도 카드 밖으로 잘리지 않는다(별 20개 대신 ★ 모은 수/전체)');
    assert(manifest98.orientation === 'any' && css98.includes('@media (min-width:768px) and (max-height:560px)'), 'V13.98 설치한 앱이 기기를 돌리는 대로 가로·세로로 바뀌고, 옆으로 눕힌 휴대폰에서도 메뉴 다섯 개가 다 보인다');
    /* ---------- V13.103 철자 쓰기는 폰 기본 키보드로 ---------- */
    const battle103 = source('../public/modules/battle.js');
    assert(battle103.includes('id="yb-spell-input"') && battle103.includes('autocapitalize="off" autocorrect="off" spellcheck="false"') && battle103.includes('enterkeyhint="send"') && battle103.includes('lang="en"') && !battle103.includes('KEY_ROWS') && !battle103.includes('class="yb-kb"') && !battle103.includes('data-yb="key"'), 'V13.103 야차전·몬스터전 철자 쓰기는 앱 자판 대신 시험 볼 때와 같은 폰 기본 키보드(자동 수정·대문자 꺼짐)로 쓴다');
    assert(battle103.includes("if (event.target?.id === 'yb-spell-input') return;") && battle103.includes("if (event.key === 'Enter' && !event.isComposing)") && battle103.includes("replace(/[^a-z]/g, '')") && battle103.includes('.slice(0, blanks(q))') && battle103.includes('function syncSpell(') && battle103.includes('input.value = q.typed.join') && /입력은 막지 않고|stays enabled/.test(battle103), 'V13.103 입력칸은 영어 a~z만 받고(한글은 안내), Enter로 공격하며, 낸 뒤에는 입력을 무시하되 키보드는 유지한다');
    assert(css98.includes('.yb-spell-input{position:absolute;inset:0') && css98.includes('font-size:16px') && css98.includes('.battle-app.yb-typing .yb-arena{aspect-ratio:16/8.2}') && battle103.includes("classList.add('yb-typing')"), 'V13.103 키보드가 올라오면 전투 화면(경기장)이 줄어 단어와 글자 칸이 키보드 위에 보인다(16px 글자로 확대 방지)');
    /* ---------- V13.105 전투 화면 효과 ---------- */
    const css104 = source('../public/v13105fx.css'), build104 = source('./build-assets.mjs');
    assert(/"v13105\.css",\s*"v13105fx\.css"\s*\]/.test(build104), 'V13.105 전투 효과 CSS(v13105fx.css)가 묶음 CSS 목록의 맨 끝에 들어간다');
    assert(battle103.includes('function hitStop(') && battle103.includes("classList.add('fx-stop')") && css104.includes('.yb-arena.fx-stop *{animation-play-state:paused!important}') && battle103.includes('function dmgTier(') && battle103.includes("const SHAKES = ['fx-shake-s', 'fx-shake-m', 'fx-shake-l', 'fx-shake-xl']") && battle103.includes("` fx-num t${dmgTier(+dmg)}"), 'V13.105 맞는 순간 잠깐 멈추고(히트스톱), 데미지가 클수록 더 세게 흔들리고 숫자가 커진다');
    assert(battle103.includes('function comboUp(') && battle103.includes('function comboReset(') && battle103.includes("if (atk === 'me') comboUp();") && (battle103.match(/comboReset\(\);/g) || []).length >= 3 && css104.includes('.fx-combo'), 'V13.105 내가 연속으로 맞히면 2콤보부터 내 HUD 위에 콤보가 뜨고, 틀리거나 놓치면 0으로 돌아간다(화면 표시만)');
    assert(battle103.includes('if (e.fast && e.dmg) critStamp(def);') && battle103.includes("'CRITICAL!'") && battle103.includes("crit ? 'fx-shake-xl'"), 'V13.105 빠른 정답(fast)이면 CRITICAL! 도장과 더 센 흔들림이 나온다');
    assert(battle103.includes('function finisher(') && battle103.includes('a.playbackRate = .3') && battle103.includes("later(drawResult, reduced() ? 0 : ko ? Math.max(700, 2000 - since) : 1100)") && battle103.includes("'K.O.!'"), 'V13.105 마지막 한 방은 슬로 모션·섬광·K.O. 뒤 결과가 나오고, 결과는 예전보다 0.3초만 늦어진다');
    assert(battle103.includes('function cutIn(') && battle103.includes('v.label || modeName(v.mode)') && battle103.includes('/보스/.test(label)') && css104.includes('.fx-cutin.monster') && css104.includes('.fx-cutin.boss') && css104.includes('.fx-cutin{inset:0;z-index:9;display:grid;place-items:center;overflow:hidden}') && /\.yb-arena \.fx-impact,[^{]*\{position:absolute;pointer-events:none\}/.test(css104), 'V13.105 시작 카운트다운에 상대 이름 컷인(몬스터는 크고 빨갛게, 보스는 어둡게)이 나오고 터치를 막지 않는다');
    assert(battle103.includes('function sfxThump(') && battle103.includes('function sfxCombo(') && battle103.includes('function sfxKO(') && battle103.includes("function buzzFx(pattern) { if (soundOn() && 'vibrate' in navigator)"), 'V13.105 데미지만큼 무거운 타격음, 콤보마다 올라가는 소리, K.O. 소리가 있고 진동은 소리를 켰을 때만 울린다');
    assert(battle103.includes('const FX_MAX = 24;') && css104.includes('@media (prefers-reduced-motion:reduce)') && css104.includes('.fx-impact,.fx-vignette,.fx-ko-rays{display:none}') && css104.includes('.battle-app.yb-typing .fx-combo'), 'V13.105 효과 조각은 24개까지만 그리고, 동작 줄이기에서는 새 효과가 멈추며, 글자 칠 때 짧아진 경기장에서도 맞게 보인다');
    /* ---------- V13.101 로보 연습전·몬스터 끝내기 영수증 ---------- */
    {
      const t1 = Date.parse('2026-10-04T03:00:00Z');
      const coinsOf = kid => bonusRecords(kid).reduce((n, r) => n + r.reward_points, 0);
      const xpOf = kid => bonusRecords(kid).reduce((n, r) => n + r.xp, 0);
      const kid = { id: 'qa-rc', pets: [{ key: 'dog' }], bonus: {} };
      botStart(kid, { level: 'hard', mode: 'speed', id: 'rc-1', now: t1 });
      const paid1 = botFinish(kid, { id: 'rc-1', result: 'win', right: 8, now: t1 + 60000 });
      const coins1 = coinsOf(kid), xp1 = xpOf(kid), count1 = kid.bonus.bot.count, wins1 = kid.bonus.bot.wins;
      const again1 = botFinish(kid, { id: 'rc-1', result: 'win', right: 8, now: t1 + 61000 });
      const again1b = botFinish(kid, { id: 'rc-1', result: 'lose', right: 99, now: t1 + 62000 });
      assert(paid1.paid && paid1.coins === BOT_WIN_REWARDS.hard.coins && !paid1.again && again1.paid && again1.again && again1.coins === paid1.coins && again1.xp === paid1.xp && again1.result === 'win' && again1b.coins === paid1.coins && again1b.result === 'win'
        && coinsOf(kid) === coins1 && xpOf(kid) === xp1 && kid.bonus.bot.count === count1 && kid.bonus.bot.wins === wins1 && again1.left === BOT_DAILY - 1,
        'V13.101 로보 연습전: 같은 id로 끝내기를 다시 보내면 같은 결과(코인·경험치·승패)를 돌려주고, 두 번 지급하지 않는다(판 수·승수도 그대로)');
      botStart(kid, { level: 'easy', mode: 'speed', id: 'rc-2', now: t1 + 100000 });
      const few2 = botFinish(kid, { id: 'rc-2', result: 'win', right: 1, now: t1 + 200000 });
      const few2again = botFinish(kid, { id: 'rc-2', result: 'win', right: 9, now: t1 + 201000 });
      assert(!few2.paid && few2.reason === 'few' && !few2again.paid && few2again.reason === 'few' && coinsOf(kid) === coins1, 'V13.101 보상 없는 결과도 영수증에 남아, 다시 보내도(맞힌 수를 바꿔도) 그대로다');
      botStart(kid, { level: 'normal', mode: 'speed', id: 'rc-3', now: t1 + 300000 });
      const old1 = botFinish(kid, { id: 'rc-1', result: 'win', right: 8, now: t1 + 301000 });
      let missing = 0; try { botFinish(kid, { id: 'rc-x', result: 'win', right: 8, now: t1 + 302000 }); } catch (err) { missing = err.status; }
      let blank = 0; try { botFinish(kid, { id: '', result: 'win', right: 8, now: t1 + 302000 }); } catch (err) { blank = err.status; }
      assert(old1.again && old1.coins === paid1.coins && kid.bonus.bot_live?.id === 'rc-3' && missing === 404 && blank === 404 && coinsOf(kid) === coins1, 'V13.101 새 판을 시작해도 지난 판의 영수증은 그대로 답하고(진행 중인 판은 지우지 않음), 모르는 id·빈 id는 찾지 못한다');
      // Monster fights: the first clear is answered again the same way, the clear is marked once.
      const mkid = { id: 'qa-rc-m', pets: [{ key: 'dog' }], bonus: {} };
      const mStart = monsterStart(mkid, { stage: 1, level: 'easy', codes: ['1'], id: 'rc-m1', now: t1 });
      const mWin = monsterFinish(mkid, { id: mStart.id, result: 'win', right: 9, now: t1 + 60000 });
      const mCoins = coinsOf(mkid), mWins = mkid.bonus.monster.wins, mClear = JSON.stringify(mkid.bonus.monster.clear);
      const mAgain = monsterFinish(mkid, { id: mStart.id, result: 'win', right: 9, now: t1 + 70000 });
      assert(mWin.paid && mWin.first && mWin.coins === stageLevel(1, 'easy').first.coins && mAgain.paid && mAgain.first && mAgain.again && mAgain.coins === mWin.coins && mAgain.xp === mWin.xp && mAgain.fought === mWin.fought
        && coinsOf(mkid) === mCoins && mkid.bonus.monster.wins === mWins && JSON.stringify(mkid.bonus.monster.clear) === mClear && mAgain.clear.easy,
        'V13.101 몬스터 끝내기: 같은 id로 다시 보내면 같은 첫 처치 결과를 돌려주고, 두 번 지급하지 않는다(처치 수·클리어 기록 그대로)');
      // Only the last few receipts are kept, and tidyProfileLogs drops the old ones.
      for (let i = 0; i < RECEIPT_KEEP + 4; i++) { botStart(kid, { level: 'easy', mode: 'speed', id: `rc-n${i}`, now: t1 + 400000 + i * 100000 }); botFinish(kid, { id: `rc-n${i}`, result: 'lose', right: 1, now: t1 + 450000 + i * 100000 }); }
      let gone = 0; try { botFinish(kid, { id: 'rc-1', result: 'win', right: 8, now: t1 + 9e6 }); } catch (err) { gone = err.status; }
      assert(kid.bonus.done.length === RECEIPT_KEEP && gone === 404 && coinsOf(kid) === coins1, `V13.101 영수증은 최근 ${RECEIPT_KEEP}개만 남고, 밀려난 판을 다시 보내도 지급하지 않는다`);
      const tidyState = { profiles: [kid, mkid] };
      const tidied = tidyProfileLogs(tidyState, t1 + RECEIPT_DAYS * DAY_MS + 120000);
      assert(tidied && mkid.bonus.done.length === 0 && kid.bonus.done.length === RECEIPT_KEEP && tidyProfileLogs(tidyState, t1 + (RECEIPT_DAYS + 1) * DAY_MS + 3e6) && kid.bonus.done.length === 0 && !tidyProfileLogs(tidyState, t1 + 30 * DAY_MS), `V13.101 tidyProfileLogs가 ${RECEIPT_DAYS}일 지난 영수증을 정리한다(한 번 정리하면 더 할 일이 없다)`);
      // Through the service: the reward answer lost on the way back is sent again.
      state.profiles.push(student('qa-rc-svc', '영수'));
      const rcToken = await login('qa-rc-svc'), rc = profile('qa-rc-svc');
      const rcBefore = (await service(state, 'GET', '/rewards', {}, rcToken)).points_balance;
      const svcStart = await service(state, 'POST', '/battle/practice/start', { level: 'normal', mode: 'speed' }, rcToken);
      rc.bonus.bot_live.at -= 60000;
      const svcPaid = await service(state, 'POST', '/battle/practice/finish', { id: svcStart.id, result: 'win', right: 6 }, rcToken);
      const svcAgain = await service(state, 'POST', '/battle/practice/finish', { id: svcStart.id, result: 'win', right: 6 }, rcToken);
      const rcPublic = JSON.stringify((await service(state, 'GET', '/bootstrap', {}, rcToken)).profile);
      assert(svcPaid.paid && svcAgain.paid && svcAgain.again && svcAgain.coins === svcPaid.coins && svcAgain.points_balance === svcPaid.points_balance && svcPaid.points_balance === rcBefore + BOT_WIN_REWARDS.normal.coins && rc.bonus.done.length === 1 && !rcPublic.includes(svcStart.id), 'V13.101 (서비스) 응답만 끊겨 다시 보내도 같은 결과·같은 잔액이고, 영수증은 학생에게 보내는 프로필에 실리지 않는다');
      // The app: claimed goes back on failure with 다시 받기, results wait on the phone, the start is registered first.
      const b101 = source('../public/modules/battle.js'), app101 = source('../public/app.js'), ui101 = source('../public/modules/ui.js'), css101 = source('../public/v13101.css');
      assert(b101.includes("const UNCLAIMED_KEY = 'sumus-yacha-unclaimed'") && b101.includes('if (retry) local.claimed = false;') && (b101.match(/if \(retry\) local\.claimed = false;/g) || []).length === 2 && b101.includes('data-yb="reward-retry"') && b101.includes("if (act === 'reward-retry') return retryReward(b);")
        && b101.includes('saveUnclaimed([...unclaimed().filter(x => x.id !== entry.id), entry]);') && b101.includes('if (settledError(err)) saveUnclaimed(') && app101.includes('resendUnclaimed(A.data.profile.id)') && app101.includes('function startPolling() {\n  resendBattleRewards();'),
        'V13.101 앱: 보상 요청이 실패하면 claimed를 되돌리고 다시 받기 버튼을 보여 주며, 결과는 답을 받을 때까지 휴대폰에 남아 앱을 다시 열면 다시 보낸다');
      assert(b101.includes("const reg = await registerStart('/battle/practice/start'") && b101.includes("const reg = await registerStart('/monster/start'") && b101.indexOf("registerStart('/battle/practice/start'") < b101.indexOf('function beginBotMatch(') && b101.includes("'보상 등록 실패'") && b101.includes('const before = await resendUnclaimed(B.A.data.profile.id);') && !b101.includes(".then(res => res.id).catch(() => null)"),
        'V13.101 앱: 시작 등록이 끝난 뒤에 전투를 시작하고, 실패하면 시작 전에 알려 준다(남은 결과를 먼저 보낸다)');
      // 야차전 포기 확인창: the app's dialog, keys wait, Tab stays inside, Escape closes, focus goes back.
      assert(b101.includes("'대결 포기 확인'") && b101.includes("modal(`<div class=\"yb-confirm-card\">") && b101.includes('if (!document.getElementById(\'yb-spell\') || dialogOpen() ||') && b101.includes('const ask = B.leaveAsk; B.leaveAsk = null; ask?.();') && !b101.includes("box.className = 'yb-confirm';\n  box.innerHTML = `<div class=\"yb-confirm-card\" role=\"dialog\"")
        && ui101.includes('role="dialog" aria-modal="true" aria-label="${esc(title)}"') && ui101.includes("if (e.key === 'Escape') { e.preventDefault(); close(); return; }") && ui101.includes("if (e.key === 'Tab') {") && ui101.includes('prior?.focus?.()') && ui101.includes('onClose?.();') && ui101.includes("export const dialogOpen = () => !!document.querySelector('#modal-root .modal, .yb-confirm');")
        && css101.includes('.modal.yb-modal-v13101{') && source('./build-assets.mjs').includes('"v13101.css"'),
        'V13.101 야차전 포기 확인창은 앱 공통 모달(이름·aria-modal·Tab 가두기·Escape·포커스 되돌리기)을 쓰고, 열려 있는 동안 철자 단축키(Enter·알파벳)가 멈추며, 경기가 끝나면 저절로 닫힌다');
    }
  }
}
