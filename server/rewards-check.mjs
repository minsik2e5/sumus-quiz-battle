// Release checks for V13.67: 실력전 (spelling words in yacha), daily attendance (출석 체크) and the
// capsule machine (뽑기); V13.70: 경험치 and coins from robot matches and teacher exams, and the
// retired word double chance.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { emptyState } from './state.mjs';
import { passwordHash, publicProfile } from './auth.mjs';
import { service, scopedWords } from './service.mjs';
import { DAY_MS, rankingWeek } from './competition.mjs';
import { dayKey, unlocked, FRAMES, ACCESSORIES } from '../public/modules/core.js';
import { TITLES, TITLE_KEYS, visibleTitleKeys } from '../public/modules/titles.js';
import { createBattle, connect, answer, tick, battleView, SKILL_RULES, BATTLE } from '../public/modules/battle-engine.js';
import { battleQuestions, spellHint, spellable } from '../public/modules/battle-questions.js';
import { createPracticeMatch } from '../public/modules/battle-bot.js';
import { ATTENDANCE_REWARDS, GACHA_KEYS, LUCKY_BETS, LUCKY_DAILY, LUCKY_ODDS, drawLucky, BOT_WIN_REWARDS, BOT_TRY_REWARD, BOT_DAILY, EXAM_XP_PER_ANSWER, EXAM_COINS } from '../public/modules/rewards.js';
import { addBonus, bonusRecords, tidyProfileLogs, BADGE_REFUND } from './rewards.mjs';

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
  assert(wrongSpell[0].type === 'wrong' && hitSpell?.spell === true && hitSpell.fast === false && hitSpell.dmg === SKILL_RULES.SPELL_HIT + Math.round(8 * SKILL_RULES.SPEED_BONUS) && duel.players.x.ki === 2 && reveal?.answer === sq.text, 'V13.67 a typed spelling is checked without case or spaces; it hits hardest (no speed crits in 실력전) and the word is revealed after');
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
  assert(LUCKY_ODDS.reduce((n, o) => n + o.rate, 0) === 100 && LUCKY_ODDS.map(o => o.mult).join() === '0,1,2,3' && LUCKY_BETS.join() === '10,20,30' && LUCKY_DAILY === 3, 'V13.68 coin capsule: ×0·×1·×2·×3 for bets of 10·20·30 coins, three a day');
  assert(avg >= 90 && avg < 100, 'V13.68 on average a little less comes back than is bet (study stays the way to earn coins)');
  const counts = {}, rnd = seeded(7);
  for (let i = 0; i < 20000; i++) { const got = drawLucky(rnd); counts[got.mult] = (counts[got.mult] || 0) + 1; }
  assert(LUCKY_ODDS.every(o => Math.abs((counts[o.mult] || 0) / 200 - o.rate) < 1.2), 'V13.68 capsules come out at the odds shown on the machine');
  const poor = profile('qa-rw-c');
  poor.points_spent = 390; // 400 earned (a waiting room holds no stake): 10 left
  await expectStatus(400, () => service(state, 'POST', '/lucky/pull', { bet: 20 }, tokens['qa-rw-c']), 'V13.68 a coin capsule needs the coins it bets');
  await expectStatus(400, () => service(state, 'POST', '/lucky/pull', { bet: 15 }, tokens['qa-rw-c']), 'V13.68 bets are 10, 20 or 30 coins');
  poor.points_spent = 0;
  const b0 = await balance('qa-rw-c');
  const plays = [];
  for (let i = 0; i < 3; i++) plays.push(await service(state, 'POST', '/lucky/pull', { bet: 10 }, tokens['qa-rw-c']));
  const won = plays.reduce((n, r) => n + r.paid, 0);
  assert(plays.every(r => [0, 10, 20, 30].includes(r.paid) && r.paid === r.bet * r.mult) && plays[2].points_balance === b0 - 30 + won && plays[2].lucky.left === 0, 'V13.68 each capsule pays the bet times ×0·×1·×2·×3 into the balance');
  await expectStatus(409, () => service(state, 'POST', '/lucky/pull', { bet: 10 }, tokens['qa-rw-c']), 'V13.68 coin capsules are three a day');
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
  assert(battleV70.indexOf('id="yb-answers"') < battleV70.indexOf('id="yb-skillbar"') && battleV70.includes('yb-strip-v1370') && battleV70.includes('yb-hpn-'), 'V13.70 the match shows the answers right under the word, the clock beside the message line and HP numbers');
}
