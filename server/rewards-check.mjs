// Release checks for V13.67: 실력전 (spelling words in yacha), daily attendance (출석 체크), the
// capsule machine (뽑기) and the word double chance (더블 찬스).
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
import { ATTENDANCE_REWARDS, GACHA_KEYS, LUCKY_BETS, LUCKY_DAILY, LUCKY_ODDS, drawLucky, CHANCE_DAILY, CHANCE_STEPS } from '../public/modules/rewards.js';

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
  await expectStatus(400, () => service(state, 'POST', '/profile/style', { ...styleBody, avatar_accessory: 'g_heart' }, tokens['qa-rw-c']), 'V13.68 a removed badge cannot be worn');
  assert(TITLES.g_lucky.retired && !visibleTitleKeys(['rookie']).includes('g_lucky') && visibleTitleKeys(['rookie', 'g_lucky']).includes('g_lucky') && (await service(state, 'POST', '/profile/title', { key: 'g_lucky' }, tokens['qa-rw-c'])).equipped === 'g_lucky', 'V13.68 capsule titles stay with their owners and are hidden from everyone else');
  await expectStatus(403, () => service(state, 'POST', '/profile/title', { key: 'g_god' }, tokens['qa-rw-c']), 'V13.67 a capsule title not pulled cannot be equipped');
  const bootC = await service(state, 'GET', '/bootstrap', {}, tokens['qa-rw-c']);
  assert(bootC.stats.gacha.aura_sakura === 1 && bootC.rewards.gacha.items.aura_sakura === 1 && bootC.rewards.lucky.left === 0, 'V13.68 the app gets the decorations owned and today\'s coin capsules');

  /* ---------- word double chance ---------- */
  const A = profile('qa-rw-a');
  await expectStatus(409, () => service(state, 'POST', '/chance/start', { bet: 10 }, tokens['qa-rw-a']), 'V13.67 double chance opens after studying enough words');
  state.mastery['qa-rw-a'] = Object.fromEntries(words.slice(0, 30).map(w => [w.id, { mastery: 40, wrong: 1 }]));
  await expectStatus(400, () => service(state, 'POST', '/chance/start', { bet: 15 }, tokens['qa-rw-a']), 'V13.67 bets are 10 or 20 coins');
  const cb0 = await balance('qa-rw-a');
  const started = await service(state, 'POST', '/chance/start', { bet: 10 }, tokens['qa-rw-a']);
  const live = A.chance_live, q1 = live.q;
  const sent = JSON.stringify(started) + JSON.stringify(await service(state, 'GET', '/bootstrap', {}, tokens['qa-rw-a']));
  assert(started.points_balance === cb0 - 10 && started.chance.live.question.options.length === 4 && started.chance.live.question.kind === 'choice' && started.chance.left === CHANCE_DAILY - 1 && !sent.includes('chance_live') && !sent.includes('"accept"') && !('chance_live' in publicProfile(A)), 'V13.67 the bet is taken at the start; the answer never leaves the server');
  assert(words.slice(0, 30).some(w => w.id === q1.word_id), 'V13.67 double chance only asks words the student studied');
  await expectStatus(409, () => service(state, 'POST', '/chance/start', { bet: 10 }, tokens['qa-rw-a']), 'V13.67 one double chance at a time');
  const r1 = await service(state, 'POST', '/chance/answer', { answer: q1.answer }, tokens['qa-rw-a']);
  assert(r1.right && r1.pot === 10 * CHANCE_STEPS[0].mult && r1.chance.live.status === 'decide' && r1.chance.live.next_pot === 10 * CHANCE_STEPS[1].mult, 'V13.67 a right answer doubles the pot; keep it or go on');
  const r2q = (await service(state, 'POST', '/chance/decide', { go: true }, tokens['qa-rw-a'])).chance.live.question;
  const q2 = A.chance_live.q;
  const w2 = words.find(w => w.id === q2.word_id);
  assert(r2q.kind === 'choice' && q2.word_id !== q1.word_id && r2q.prompt === w2.meaning && q2.options.length === 4 && q2.options[q2.answer].toLowerCase() === w2.word.toLowerCase().replace(/\([^)]*\)/g, '').trim(), 'V13.67 the second word asks the English word for a meaning');
  await service(state, 'POST', '/chance/answer', { answer: q2.answer }, tokens['qa-rw-a']);
  const r3q = (await service(state, 'POST', '/chance/decide', { go: true }, tokens['qa-rw-a'])).chance.live.question;
  const q3 = A.chance_live.q;
  const r3 = await service(state, 'POST', '/chance/answer', { answer: q3.text.toUpperCase() }, tokens['qa-rw-a']);
  assert(r3q.kind === 'spell' && r3q.hint === q3.hint && r3.right && r3.done && r3.paid === 10 * CHANCE_STEPS[2].mult && r3.points_balance === cb0 - 10 + r3.paid && !A.chance_live && A.chance.best === 3, 'V13.67 three right answers in a row (the last one spelled) pay eight times the bet, and it stops there');
  await service(state, 'POST', '/chance/start', { bet: 20 }, tokens['qa-rw-a']);
  const lossQ = A.chance_live.q;
  const lost = await service(state, 'POST', '/chance/answer', { answer: (lossQ.answer + 1) % 4 }, tokens['qa-rw-a']);
  assert(!lost.right && lost.lost === 20 && lost.reveal.word === lossQ.options[lossQ.answer] && !A.chance_live && lost.points_balance === cb0 - 10 + r3.paid - 20, 'V13.67 a wrong answer loses the pot and shows the right one');
  const keepStart = await service(state, 'POST', '/chance/start', { bet: 10 }, tokens['qa-rw-a']);
  A.chance_live.deadline = Date.now() - 2000;
  const late = await service(state, 'POST', '/chance/answer', { answer: A.chance_live.q.answer }, tokens['qa-rw-a']);
  assert(keepStart.chance.left === 0 && !late.right && late.late, 'V13.67 an answer after the time is up does not count');
  await expectStatus(409, () => service(state, 'POST', '/chance/start', { bet: 10 }, tokens['qa-rw-a']), 'V13.67 double chance is three times a day');
  A.chance.day = dayKey(now - DAY_MS);
  await service(state, 'POST', '/chance/start', { bet: 10 }, tokens['qa-rw-a']);
  const keepQ = A.chance_live.q;
  await service(state, 'POST', '/chance/answer', { answer: keepQ.answer }, tokens['qa-rw-a']);
  const bk = await balance('qa-rw-a');
  const kept = await service(state, 'POST', '/chance/decide', { go: false }, tokens['qa-rw-a']);
  assert(kept.paid === 20 && kept.points_balance === bk + 20 && !A.chance_live, 'V13.67 keeping the pot after a right answer pays it at once');
  await service(state, 'POST', '/chance/start', { bet: 10 }, tokens['qa-rw-a']);
  A.chance_live.deadline = Date.now() - 10000;
  const afterLeave = await service(state, 'GET', '/rewards', {}, tokens['qa-rw-a']);
  assert(afterLeave.chance.live === null && A.chance_live, 'V13.67 a word left open past its time shows as over (a GET does not change the state)');
  await service(state, 'POST', '/chance/start', { bet: 10 }, tokens['qa-rw-a']).catch(() => null);
  assert(A.chance.losses >= 3, 'V13.67 the next double chance request records a word left open as lost');
  const homeUi = source('../public/modules/student.js'), arcade = source('../public/modules/arcade.js');
  assert(homeUi.includes('attendanceCard(') && arcade.includes('/lucky/pull') && arcade.includes('/chance/answer') && arcade.includes('확률'), 'V13.67 the home screen has the attendance card; the coin arcade has the capsule machine (with its odds) and double chance');
}
