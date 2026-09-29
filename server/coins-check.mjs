// Release checks for V13.73: study coins (중간안: finished + 60% right, once-a-day bonuses,
// daily cap 100), the 400-coin egg, robot match coins, coins for titles (also titles won
// before), more titles, and teacher coin gifts.
import { emptyState } from './state.mjs';
import { passwordHash } from './auth.mjs';
import { service, settleBattle } from './service.mjs';
import { createCompetition } from './competition.mjs';
import { EGG_PRICE, meaningAccepted } from '../public/modules/core.js';
import { TITLES, TITLE_COINS, titleCoins, titleUnlocked } from '../public/modules/titles.js';
import { STUDY_COINS, BOT_WIN_REWARDS, BOT_TRY_REWARD, GIFT_AMOUNTS } from '../public/modules/rewards.js';
import { botStart, botFinish } from './rewards.mjs';

export async function runCoinsChecks(assert, expectStatus) {
  const state = emptyState();
  const hash = await passwordHash('QaCoins1!');
  const now = Date.now();
  const student = (id, name, className = '고1A', extra = {}) => ({ id, username: id, display_name: name, role: 'student', active: true, class_name: className, school_id: 'danwon-high', school: '단원고', division: 'high', password_hash: hash, pets: [{ key: 'dog', first: true, acquired_at: now - 9e8 }], avatar_key: 'dog', created_at: now - 9e8, ...extra });
  state.profiles.push(
    { id: 'qa-co-teacher', username: 'qa_co_teacher', display_name: '코인 선생님', role: 'teacher', active: true, password_hash: hash, school_ids: ['danwon-high'], division_ids: ['high'], active_division: 'high', active_school_id: 'danwon-high', created_at: now },
    { id: 'qa-co-other', username: 'qa_co_other', display_name: '다른 학교 선생님', role: 'teacher', active: true, password_hash: hash, school_ids: ['seonbu-high'], division_ids: ['high'], active_division: 'high', active_school_id: 'seonbu-high', created_at: now },
    student('qa-co-a', '가람'), student('qa-co-b', '나리'), student('qa-co-c', '다솜', '고1B'),
    student('qa-co-far', '먼학교', '고1A', { school_id: 'seonbu-high', school: '선부고' })
  );
  const login = async username => (await service(state, 'POST', '/login', { username, password: 'QaCoins1!', division: 'high', role: username.includes('_co_') ? 'teacher' : undefined }, null))._cookie;
  const tokens = {};
  for (const id of ['qa_co_teacher', 'qa_co_other', 'qa-co-a', 'qa-co-b', 'qa-co-c']) tokens[id] = await login(id);
  const profile = id => state.profiles.find(p => p.id === id);
  const balance = async id => (await service(state, 'GET', '/rewards', {}, tokens[id])).points_balance;
  // Every word a practice may ask (it mixes in words to review from other ranges).
  const words = (await service(state, 'GET', '/bootstrap', {}, tokens['qa-co-a'])).books.flatMap(book => book.words || []);
  // One practice: `rights` says which answers are right; `stopAt` finishes early after that many.
  async function study(id, { target = 10, rights = null, stopAt = null, daily = false } = {}) {
    const started = await service(state, 'POST', '/practice/start', { school: '단원고', range_codes: ['24'], mode: 'write_meaning', target, run_mode: 'practice', exam_style: true, ...(daily ? { daily_quest: true } : {}) }, tokens[id]);
    let view = started, n = 0;
    while (!view.finished && n < target + 15) {
      if (stopAt !== null && n >= stopAt) { view = await service(state, 'POST', `/practice/${started.id}/finish`, {}, tokens[id]); break; }
      const x = state.practices.find(item => item.id === started.id);
      const wordId = x.question_id === view.question_id ? x.question?.word_id : x.next_preview?.question?.word_id;
      const word = words.find(w => w.id === wordId);
      const right = rights ? rights[n] !== false : true;
      view = await service(state, 'POST', `/practice/${started.id}/answer`, { question_id: view.question_id, answer: right ? (meaningAccepted(word.meaning, word.accepted_meanings)[0] || word.meaning) : '__틀린답__', prefetch_next: false }, tokens[id]);
      n++;
      if (!view.finished) view = await service(state, 'POST', `/practice/${started.id}/next`, {}, tokens[id]);
    }
    return state.sessions.find(s => s.id === started.id);
  }

  /* ---------- study coins ---------- */
  const quit = await study('qa-co-a', { target: 10, stopAt: 4 });
  assert(quit.answered_count === 4 && quit.reward_points === 0 && /끝까지/.test(quit.reward_note) && quit.xp > 0, 'V13.73 a practice finished midway pays no coins (경험치 stays) and says why');
  const sloppy = await study('qa-co-a', { target: 10, rights: [true, true, true, true, true, false, false, false, false, false] });
  assert(sloppy.answered_count === 10 && sloppy.reward_points === 0 && /60%/.test(sloppy.reward_note), 'V13.73 a finished practice under 60% right pays no coins');
  // 추천 학습 is 20 words (its wrong words come back once more at the end).
  const good = await study('qa-co-a', { target: 20, daily: true, rights: [true, true, true, true, true, true, false, true, true, true, true, false] });
  const labels = (good.reward_breakdown || []).map(x => x.label);
  assert(good.reward_points === STUDY_COINS.t20 + STUDY_COINS.daily + STUDY_COINS.first && labels.includes('오늘 첫 학습') && labels.includes('오늘 추천 학습'), 'V13.73 a finished practice with 60%+ right pays: 20문제 16 + 추천 5 + 첫 학습 5 (the practices left midway did not use up 첫 학습)');
  const again = await study('qa-co-a', { target: 20, daily: true });
  const labels2 = (again.reward_breakdown || []).map(x => x.label);
  assert(again.reward_points === STUDY_COINS.t20 + STUDY_COINS.perfect && !labels2.includes('오늘 추천 학습') && !labels2.includes('오늘 첫 학습'), 'V13.73 the recommended-study and first-study bonuses are paid once a day; 100점 pays 12');
  assert(STUDY_COINS.t30 === 22 && STUDY_COINS.t20 === 16 && STUDY_COINS.cap === 100 && EGG_PRICE === 400, 'V13.73 중간안 numbers: 30문제 22, 20문제 16, daily cap 100, egg 400');
  // The cap counts study coins of the day: 90 already earned leaves 10.
  state.sessions.push({ id: 'qa-co-rich', student_id: 'qa-co-b', division: 'high', school_id: 'danwon-high', school: '단원고', mode: 'eng2mean', run_mode: 'practice', total: 30, correct: 30, answered_count: 30, score: 100, xp: 0, reward_points: 90, reward_breakdown: [{ label: '오늘 첫 학습', points: 5 }], created_at: now - 1000 });
  const capped = await study('qa-co-b', { target: 10 });
  assert(capped.reward_points === 10 && capped.reward_breakdown.some(x => x.label === '일일 보상 한도 적용'), 'V13.73 study coins stop at 100 a day');
  const bootB = await service(state, 'GET', '/bootstrap', {}, tokens['qa-co-b']);
  assert(bootB.stats.today_study_points === 100, 'V13.73 the wallet bar counts study coins of today');

  /* ---------- robot matches ---------- */
  assert(BOT_WIN_REWARDS.easy.coins === 5 && BOT_WIN_REWARDS.normal.coins === 8 && BOT_WIN_REWARDS.hard.coins === 12 && BOT_TRY_REWARD.coins === 3, 'V13.73 robot matches pay 5/8/12 for a win and 3 for trying');
  const pc = profile('qa-co-c');
  botStart(pc, { level: 'hard', mode: 'speed', id: 'bot1', now: now - 20000 });
  const won = botFinish(pc, { id: 'bot1', result: 'win', right: 5, now });
  botStart(pc, { level: 'easy', mode: 'speed', id: 'bot2', now: now - 20000 });
  botFinish(pc, { id: 'bot2', result: 'win', right: 5, now });
  assert(won.coins === 12 && pc.bonus.bot.wins === 2 && pc.bonus.bot.hard_wins === 1, 'V13.73 robot wins are counted (all, and at 어려움) for the 로보 titles');

  /* ---------- titles pay coins ---------- */
  assert(TITLE_COINS.common === 10 && TITLE_COINS.rare === 30 && TITLE_COINS.epic === 60 && TITLE_COINS.legendary === 120 && TITLE_COINS.limited === 60 && titleCoins('rookie') === 0 && titleCoins('g_god') === 0, 'V13.73 title coins by tier; 첫걸음 and retired capsule titles pay nothing');
  const added = ['pets2', 'study10', 'attend7', 'bot1', 'gift1', 'level10', 'study50', 'attend30', 'bothunter', 'skill10', 'exam3', 'words2000', 'study150', 'attend100', 'combo30', 'skill50', 'perfect50', 'yacha10'];
  assert(added.every(key => TITLES[key] && !TITLES[key].retired) && Object.values(TITLES).filter(t => !t.retired).length >= 51, 'V13.73 18 more titles (51 in all)');
  // 다솜 won titles before V13.73 and had already seen them: they pay once, when shown.
  const pcStats = createCompetition(state).titleStats(pc);
  assert(pcStats.bot_wins === 2 && pcStats.bot_hard_wins === 1 && titleUnlocked('bot1', pcStats), 'V13.73 title stats count robot wins');
  pc.titles_seen = ['bot1'];
  const beforeTitles = await balance('qa-co-c');
  const bootC = await service(state, 'GET', '/bootstrap', {}, tokens['qa-co-c']);
  assert(bootC.titles.unpaid.some(x => x.key === 'bot1' && x.coins === TITLE_COINS.common), 'V13.73 a title held before V13.73 shows as unpaid');
  const paid = await service(state, 'POST', '/titles/seen', { keys: [] }, tokens['qa-co-c']);
  assert(paid.paid.some(x => x.key === 'bot1') && paid.points_balance === beforeTitles + paid.paid_coins && (await balance('qa-co-c')) === beforeTitles + paid.paid_coins, 'V13.73 showing the titles pays their coins into the balance');
  const twice = await service(state, 'POST', '/titles/seen', { keys: ['bot1'] }, tokens['qa-co-c']);
  assert(twice.paid_coins === 0 && (await service(state, 'GET', '/bootstrap', {}, tokens['qa-co-c'])).titles.unpaid.length === 0, 'V13.73 a title pays only once');
  // A brand-new student sees the collection for the first time: everything held pays then.
  const intro = await service(state, 'POST', '/titles/seen', { all: true }, tokens['qa-co-a']);
  assert(intro.paid_coins === intro.paid.reduce((n, x) => n + x.coins, 0) && intro.paid.every(x => x.key !== 'rookie'), 'V13.73 the first look at the collection pays the titles held');

  /* ---------- pet skills in yacha matches count for titles ---------- */
  state.battles = [{ id: 'qa-co-battle', status: 'active', school_id: 'danwon-high', division: 'high', grade: '고1', host_id: 'qa-co-a', guest_id: 'qa-co-b', stake: 10, created_at: now - 60000, tickets: {} }];
  settleBattle(state, { id: 'qa-co-battle', winner: 'qa-co-a', reason: 'end', hp: { 'qa-co-a': 40, 'qa-co-b': 0 }, skills: { 'qa-co-a': 3, 'qa-co-b': 1 } });
  assert(state.battles[0].skills['qa-co-a'] === 3 && createCompetition(state).titleStats(profile('qa-co-a')).skills === 3, 'V13.73 a finished match keeps how many pet skills each player set off');

  /* ---------- teacher gifts ---------- */
  await expectStatus(403, () => service(state, 'POST', '/teacher/gifts', { amount: 30, all: true }, tokens['qa-co-a']), 'V13.73 students cannot send gifts');
  await expectStatus(400, () => service(state, 'POST', '/teacher/gifts', { amount: 7, all: true }, tokens['qa_co_teacher']), 'V13.73 a gift is one of the set amounts');
  const beforeGift = await balance('qa-co-a');
  const toClass = await service(state, 'POST', '/teacher/gifts', { amount: GIFT_AMOUNTS[1], class_name: '고1A', note: '이번 주 최고!' }, tokens['qa_co_teacher']);
  assert(toClass.sent === 2 && toClass.total === 2 * GIFT_AMOUNTS[1] && toClass.gifts_sent[0].label === '고1A', 'V13.73 a teacher gifts a whole class (only active students of the school)');
  assert((await balance('qa-co-a')) === beforeGift + GIFT_AMOUNTS[1] && !profile('qa-co-far').gift_box, 'V13.73 the gift counts at once, and never reaches another school');
  const one = await service(state, 'POST', '/teacher/gifts', { amount: 100, student_ids: ['qa-co-a', 'qa-co-far'] }, tokens['qa_co_teacher']);
  assert(one.sent === 1, 'V13.73 picked students of another school are left out');
  await expectStatus(400, () => service(state, 'POST', '/teacher/gifts', { amount: 10, student_ids: ['qa-co-far'] }, tokens['qa_co_teacher']), 'V13.73 a gift with nobody to receive it fails');
  const bootA = await service(state, 'GET', '/bootstrap', {}, tokens['qa-co-a']);
  assert(bootA.gifts.length === 2 && bootA.gifts[0].note === '이번 주 최고!' && bootA.gifts[0].from_name === '코인 선생님', 'V13.73 the student sees the waiting gift boxes with the note');
  const opened = await service(state, 'POST', '/gifts/open', {}, tokens['qa-co-a']);
  assert(opened.coins === GIFT_AMOUNTS[1] + 100 && opened.points_balance === (await balance('qa-co-a')) && (await service(state, 'GET', '/bootstrap', {}, tokens['qa-co-a'])).gifts.length === 0, 'V13.73 opening the boxes empties them (the coins were already there)');
  assert(createCompetition(state).titleStats(profile('qa-co-a')).gifts === 2, 'V13.73 gifts received count for the 선생님의 칭찬 title');
  const teacherBoot = await service(state, 'GET', '/bootstrap', {}, tokens['qa_co_teacher']);
  assert(teacherBoot.gifts_sent.length === 2 && teacherBoot.gifts_sent[0].amount === 100, 'V13.73 the teacher sees recent gifts, newest first');

  /* ---------- V13.74 반 대항전 and 선생님 알림판 ---------- */
  const tb = await service(state, 'GET', '/bootstrap', {}, tokens['qa_co_teacher']);
  const cl = tb.class_league;
  assert(cl.classes[0].name === '고1A' && cl.classes[0].xp > 0 && cl.classes[0].students === 2 && cl.classes.some(c => c.name === '고1B') && !JSON.stringify(cl).includes('먼학교'), 'V13.74 반 대항전 adds up the 경험치 of each class this week');
  const idle = tb.idle_students;
  assert(Array.isArray(idle) && !idle.some(r => r.id === 'qa-co-a'), 'V13.74 the 알림판 leaves out students who studied this week');
  await expectStatus(403, () => service(state, 'POST', '/teacher/class-league/tv', {}, tokens['qa-co-a']), 'V13.74 only teachers make a 반 대항전 TV link');
  const first = (await service(state, 'POST', '/teacher/class-league/tv', {}, tokens['qa_co_teacher'])).token;
  const tvView = await service(state, 'GET', '/tv/classes', { token: first }, null);
  assert(tvView.league.classes.length === cl.classes.length && !JSON.stringify(tvView).includes('class_tv'), 'V13.74 the TV link shows 반 대항전 without logging in');
  const second = (await service(state, 'POST', '/teacher/class-league/tv', {}, tokens['qa_co_teacher'])).token;
  await expectStatus(404, () => service(state, 'GET', '/tv/classes', { token: first }, null), 'V13.74 a new TV link ends the old one');
  assert((await service(state, 'GET', '/tv/classes', { token: second }, null)).league.school, 'V13.74 the newest TV link works');
}
