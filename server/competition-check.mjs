// Release checks for V13.66: coins (코인), titles (칭호), the weekly yacha league, practice
// matches against the app and academy tournaments (학원 대회).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { emptyState } from './state.mjs';
import { passwordHash } from './auth.mjs';
import { service, settleBattle, scopedWords, tidyBattles } from './service.mjs';
import { createCompetition, rankingWeek, countedMatches, leagueSummary, DAY_MS } from './competition.mjs';
import { buildBracket, seedOrder, roundLabel } from './tournament.mjs';
import { TITLES, TITLE_KEYS, titleUnlocked, titleProgress, leagueTier, LEAGUE_TIERS } from '../public/modules/titles.js';
import { createBattle, connect, battleView } from '../public/modules/battle-engine.js';
import { createPracticeMatch, practiceQuestions, BOT_ID } from '../public/modules/battle-bot.js';

const source = path => readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8');

export async function runCompetitionChecks(assert, expectStatus) {
  const DAY = DAY_MS;
  const now = Date.now();
  const week = rankingWeek(now), lastWeek = rankingWeek(week.start - 1);
  const state = emptyState();
  const hash = await passwordHash('QaCompetition1!');
  const student = (id, name, className = '고1A', extra = {}) => ({ id, username: id, display_name: name, role: 'student', active: true, class_name: className, school_id: 'danwon-high', school: '단원고', division: 'high', password_hash: hash, pets: [{ key: 'dog', first: true, acquired_at: now - 30 * DAY }], avatar_key: 'dog', created_at: now - 30 * DAY, ...extra });
  state.profiles.push(
    { id: 'qa-cc-teacher', username: 'qa_cc_teacher', display_name: '대회 선생님', role: 'teacher', active: true, password_hash: hash, school_ids: ['danwon-high', 'seonbu-high'], division_ids: ['middle', 'high'], active_division: 'high', active_school_id: 'danwon-high', created_at: now - 30 * DAY },
    student('qa-cc-a', '가나'), student('qa-cc-b', '다라'), student('qa-cc-c', '마바', '고1B'), student('qa-cc-d', '사아'), student('qa-cc-e', '자차', '고1B'),
    student('qa-cc-other', '다른학교', '고1A', { school_id: 'seonbu-high', school: '선부고' }),
    student('qa-cc-nopet', '펫없음', '고1A', { pets: [] }),
    student('qa-cc-private', '비공개', '고1A', { ranking_public: false })
  );
  const login = async username => (await service(state, 'POST', '/login', { username, password: 'QaCompetition1!', division: 'high', role: username.includes('teacher') ? 'teacher' : undefined }, null))._cookie;
  const tokens = {};
  for (const id of ['qa_cc_teacher', 'qa-cc-a', 'qa-cc-b', 'qa-cc-c', 'qa-cc-d', 'qa-cc-e', 'qa-cc-private']) tokens[id] = await login(id);
  const session = (id, studentId, at, over = {}) => ({ id, student_id: studentId, division: 'high', school_id: 'danwon-high', school: '단원고', mode: 'eng2mean', run_mode: 'practice', total: 20, correct: 20, answered_count: 20, score: 100, perfect: true, xp: 500, reward_points: 30, best_combo: 20, created_at: at, ...over });
  const match = (id, host, guest, winner, at, over = {}) => ({ id, status: 'finished', school_id: 'danwon-high', division: 'high', grade: '고1', host_id: host, guest_id: guest, stake: 10, created_at: at - 60000, finished_at: at, winner, loser: winner ? (winner === host ? guest : host) : null, reason: 'end', hp: {}, ...over });

  /* ---------- titles ---------- */
  assert(TITLE_KEYS.length >= 30 && ['rookie', 'focus', 'combo', 'streak', 'master', 'legend', 'yacha3', 'yachaking'].every(key => TITLES[key]), 'V13.66 about 30 titles, keeping the eight V13.56 keys students may have equipped');
  assert(['common', 'rare', 'epic', 'legendary', 'limited'].every(tier => TITLE_KEYS.some(key => TITLES[key].tier === tier)) && TITLE_KEYS.every(key => TITLES[key].name && TITLES[key].how && TITLES[key].desc && TITLES[key].icon), 'V13.66 every title has a tier (일반·희귀·영웅·전설·한정), a name, how to get it and an emblem');
  const wantedTitles = [['words100', 'correct', 100], ['words500', 'correct', 500], ['words1000', 'correct', 1000], ['words3000', 'correct', 3000], ['streak3', 'best_days', 3], ['streak', 'best_days', 7], ['streak14', 'best_days', 14], ['streak30', 'best_days', 30], ['perfect1', 'perfect', 1], ['perfect5', 'perfect', 5], ['perfect20', 'perfect', 20], ['win10', 'wins', 10], ['win50', 'wins', 50], ['win100', 'wins', 100], ['comeback', 'comebacks', 1], ['flawless', 'flawless', 1], ['yacha3', 'win_streak', 3], ['yachaking', 'win_streak', 5]];
  assert(wantedTitles.every(([key, stat, goal]) => TITLES[key]?.stat === stat && TITLES[key].goal === goal), 'V13.66 the requested titles: words 100·500·1000·3000, study streak 3·7·14·30 days, 100 points 1·5·20, wins 10·50·100, comeback, flawless, 3 and 5 win streaks');
  assert(['weekly1', 'weekly2', 'weekly3'].every((key, i) => TITLES[key].tier === 'limited' && TITLES[key].stat === 'weekly_rank' && TITLES[key].goal === i + 1 && TITLES[key].exact), 'V13.66 last week\'s top 3 of the ranking get limited titles');
  assert(titleUnlocked('words100', { correct: 100 }) && !titleUnlocked('words100', { correct: 99 }) && titleUnlocked('weekly2', { weekly_rank: 2 }) && !titleUnlocked('weekly2', { weekly_rank: 1 }) && titleProgress('words500', { correct: 123 }).join() === '123,500' && titleProgress('weekly1', {}) === null, 'V13.66 titles unlock at their goal; limited ranks match exactly; progress bars for the rest');

  const boot0 = await service(state, 'GET', '/bootstrap', {}, tokens['qa-cc-a']);
  assert(boot0.titles?.intro === true && boot0.titles.unlocked.includes('rookie') && boot0.titles.equipped === 'rookie' && boot0.titles.fresh.length === 0 && typeof boot0.titles.stats?.correct === 'number', 'V13.66 a student who has not seen the collection gets one introduction (not a pop-up per title)');
  await service(state, 'POST', '/titles/seen', { all: true }, tokens['qa-cc-a']);
  const boot1 = await service(state, 'GET', '/bootstrap', {}, tokens['qa-cc-a']);
  assert(boot1.titles.intro === false && boot1.titles.fresh.length === 0, 'V13.66 after the introduction nothing is new');
  // Study: 9 days in a row, two sessions a day (one perfect), 37 words correct a day.
  // Both sessions of a day stay on the same KST day, also when the check runs just after midnight.
  const sinceMidnight = (now + 9 * 3600000) % DAY, [early, later] = [Math.min(3600000, sinceMidnight / 3), Math.min(7200000, sinceMidnight * 2 / 3)];
  for (let d = 0; d < 9; d++) {
    state.sessions.push(session(`qa-cc-s${d}a`, 'qa-cc-a', now - d * DAY - early));
    state.sessions.push(session(`qa-cc-s${d}b`, 'qa-cc-a', now - d * DAY - later, { correct: 17, score: 85, perfect: false, best_combo: 12 }));
  }
  const boot2 = await service(state, 'GET', '/bootstrap', {}, tokens['qa-cc-a']);
  const s2 = boot2.titles.stats;
  assert(s2.correct === 9 * 37 && s2.best_days === 9 && s2.perfect === 9 && s2.combo === 20, 'V13.66 title stats: words correct, longest run of study days, 100-point study (10+ questions) and best combo');
  assert(['words100', 'streak3', 'streak', 'perfect1', 'perfect5', 'combo', 'combo20'].every(key => boot2.titles.unlocked.includes(key) && boot2.titles.fresh.includes(key)) && !boot2.titles.unlocked.includes('words500') && !boot2.titles.unlocked.includes('streak14'), 'V13.66 new titles are unlocked and marked new until seen');
  await expectStatus(403, () => service(state, 'POST', '/profile/title', { key: 'words500' }, tokens['qa-cc-a']), 'V13.66 a title not won yet cannot be equipped');
  await expectStatus(400, () => service(state, 'POST', '/profile/title', { key: 'no-such-title' }, tokens['qa-cc-a']), 'V13.66 unknown titles are refused');
  assert((await service(state, 'POST', '/profile/title', { key: 'combo20' }, tokens['qa-cc-a'])).equipped === 'combo20', 'V13.66 a won title can be equipped from the collection');
  await service(state, 'POST', '/titles/seen', { keys: ['words100', 'streak3', 'fake'] }, tokens['qa-cc-a']);
  const boot3 = await service(state, 'GET', '/bootstrap', {}, tokens['qa-cc-a']);
  assert(!boot3.titles.fresh.includes('words100') && boot3.titles.fresh.includes('combo') && boot3.titles.equipped === 'combo20' && boot3.profile.avatar_title === 'combo20', 'V13.66 titles marked seen are no longer new; others stay new');
  const style = { avatar_key: 'dog', avatar_accessory: 'none', avatar_frame: 'basic' };
  assert((await service(state, 'POST', '/profile/style', { ...style, avatar_title: 'combo20' }, tokens['qa-cc-a'])).avatar_title === 'combo20', 'V13.66 saving the pet style keeps a new-style title');
  await expectStatus(400, () => service(state, 'POST', '/profile/style', { ...style, avatar_title: 'words3000' }, tokens['qa-cc-a']), 'V13.66 saving the pet style cannot equip a locked title');

  /* ---------- yacha records, counted wins, special wins ---------- */
  // Inside this ranking week even when the check runs just after Monday 00:00 KST.
  const t0 = Math.max(week.start + 1000, now - 5 * 3600000);
  state.battles.push(
    match('qa-cc-m6', 'qa-cc-a', 'qa-cc-d', null, t0),
    match('qa-cc-m1', 'qa-cc-a', 'qa-cc-b', 'qa-cc-a', t0 + 1000, { hp: { 'qa-cc-a': 12, 'qa-cc-b': 0 } }),
    match('qa-cc-m2', 'qa-cc-a', 'qa-cc-b', 'qa-cc-a', t0 + 2000, { hp: { 'qa-cc-a': 100, 'qa-cc-b': 0 } }),
    match('qa-cc-m3', 'qa-cc-a', 'qa-cc-b', 'qa-cc-a', t0 + 3000),
    match('qa-cc-m4', 'qa-cc-a', 'qa-cc-b', 'qa-cc-a', t0 + 4000),
    match('qa-cc-m5', 'qa-cc-a', 'qa-cc-c', 'qa-cc-a', t0 + 5000, { reason: 'forfeit', hp: { 'qa-cc-a': 100, 'qa-cc-c': 100 } }),
    match('qa-cc-m7', 'qa-cc-c', 'qa-cc-d', 'qa-cc-c', t0 + 7000),
    match('qa-cc-m8', 'qa-cc-a', 'qa-cc-d', 'qa-cc-a', t0 + 8000, { hp: { 'qa-cc-a': 55, 'qa-cc-d': 0 } })
  );
  const ctx = createCompetition(state, now);
  const aStats = ctx.titleStats(state.profiles.find(p => p.id === 'qa-cc-a'));
  assert(countedMatches(ctx.battlesOf('qa-cc-a'), 'qa-cc-a').length === 6 && aStats.wins === 5, 'V13.66 the same friend counts at most three times a day for titles and the league (4 wins over one friend count 3)');
  assert(aStats.comebacks === 1 && aStats.flawless === 1, 'V13.66 a win with 20 HP or less is a comeback and a win at 100 HP is flawless (a forfeit is neither)');
  assert(aStats.win_streak === 3 && titleUnlocked('win1', aStats) && titleUnlocked('comeback', aStats) && titleUnlocked('flawless', aStats) && titleUnlocked('yacha3', aStats) && !titleUnlocked('yachaking', aStats) && !titleUnlocked('win10', aStats), 'V13.66 yacha titles follow the record (3 wins in a row over different friends is 3연승 돌풍)');
  {
    // V13.94: full HP is 250 now; a comeback is a fifth of it or less, flawless is all of it.
    const s94 = structuredClone(state);
    s94.battles = [
      match('qa-cc-n1', 'qa-cc-a', 'qa-cc-b', 'qa-cc-a', t0 + 1000, { hp: { 'qa-cc-a': 50, 'qa-cc-b': 0 }, max_hp: 250 }),
      match('qa-cc-n2', 'qa-cc-a', 'qa-cc-c', 'qa-cc-a', t0 + 2000, { hp: { 'qa-cc-a': 250, 'qa-cc-c': 0 }, max_hp: 250 }),
      match('qa-cc-n3', 'qa-cc-a', 'qa-cc-d', 'qa-cc-a', t0 + 3000, { hp: { 'qa-cc-a': 100, 'qa-cc-d': 0 }, max_hp: 250 })
    ];
    const s94Stats = createCompetition(s94, now).titleStats(s94.profiles.find(p => p.id === 'qa-cc-a'));
    assert(s94Stats.comebacks === 1 && s94Stats.flawless === 1, 'V13.94 with 250 HP a win with 50 HP or less is a comeback and only a full 250 is flawless (100 left is neither)');
  }
  const lg = ctx.league('qa-cc-a');
  assert(lg.points === 5 * 3 + 1 && lg.wins === 5 && lg.draws === 1 && lg.losses === 0 && lg.win_rate === 83 && lg.tier.key === 'gold' && lg.tier.next.key === 'diamond' && lg.tier.next.need === 14, 'V13.66 weekly league: 3 points a win, 1 a draw, counted matches only; 16 points is gold, 14 short of diamond');
  assert(leagueTier(0).key === 'bronze' && leagueTier(6).key === 'silver' && leagueTier(15).key === 'gold' && leagueTier(30).key === 'diamond' && leagueTier(30).next === null && LEAGUE_TIERS.length === 4, 'V13.66 league tiers: bronze, silver 6, gold 15, diamond 30');
  assert(leagueSummary([match('x', 'p', 'q', 'q', now)], 'p').points === 0, 'V13.66 a loss takes no league points away');
  const table = await service(state, 'GET', '/battle/league', { period: 'week' }, tokens['qa-cc-b']);
  const rowOf = id => table.rows.find(r => r.id === id);
  assert(table.rows.length === 6 && !table.rows.some(r => r.name === '다른학교' || r.name === '펫없음') && table.rows.some(r => r.private && r.name === '비공개 학생' && r.id === null && r.title === null), 'V13.66 the league has the same school and grade (with pets); private students stay anonymous');
  assert(rowOf('qa-cc-a').rank === 1 && rowOf('qa-cc-a').points === 16 && rowOf('qa-cc-a').title === 'combo20' && rowOf('qa-cc-a').tier === 'gold' && rowOf('qa-cc-b').is_me && table.me.points === 0 && table.me.tier.key === 'bronze', 'V13.66 league rows carry rank, points, tier and title; the viewer gets their own card');
  const allTime = await service(state, 'GET', '/battle/league', { period: 'all' }, tokens['qa-cc-b']);
  assert(allTime.period === 'all' && allTime.rows.find(r => r.id === 'qa-cc-a').wins === 6 && allTime.rows.find(r => r.id === 'qa-cc-a').win_rate === 86, 'V13.66 all-time yacha ranking counts every win with the win rate');
  const history = await service(state, 'GET', '/battle/history', {}, tokens['qa-cc-a']);
  assert(history.record.win_rate === 86 && history.league?.tier?.key === 'gold' && history.league.rank === 1, 'V13.66 the lobby history carries the win rate and this week\'s league');
  const friends = (await service(state, 'GET', '/battle/friends', {}, tokens['qa-cc-b'])).friends;
  assert(friends.find(f => f.id === 'qa-cc-a')?.title === 'combo20' && friends.find(f => f.id === 'qa-cc-a')?.tier === 'gold', 'V13.66 the challenge list shows each friend\'s title and tier');

  /* ---------- last week's awards: limited titles ---------- */
  state.sessions.push(session('qa-cc-lw1', 'qa-cc-b', lastWeek.start + DAY, { xp: 900 }), session('qa-cc-lw2', 'qa-cc-c', lastWeek.start + DAY, { xp: 700 }), session('qa-cc-lw3', 'qa-cc-d', lastWeek.start + DAY, { xp: 700 }), session('qa-cc-lw4', 'qa-cc-e', lastWeek.start + DAY, { xp: 100 }));
  // qa-cc-a's own sessions of last week (from the nine study days) also count.
  const ctx2 = createCompetition(state, now);
  const aLast = ctx2.sessionsOf('qa-cc-a').filter(s => s.created_at >= lastWeek.start && s.created_at < lastWeek.end).reduce((n, s) => n + s.xp, 0);
  const ranks = ['qa-cc-a', 'qa-cc-b', 'qa-cc-c', 'qa-cc-d', 'qa-cc-e'].map(id => ctx2.titleStats(state.profiles.find(p => p.id === id)).weekly_rank);
  assert(aLast > 900 && ranks[0] === 1 && ranks[1] === 2 && ranks[2] === 3 && ranks[3] === 3 && ranks[4] === 0, 'V13.66 last week\'s 경험치 top 3 of the grade get a limited title; a tie shares the place');
  const lastWeekOnly = createCompetition({ ...state, sessions: state.sessions.filter(s => s.id.startsWith('qa-cc-lw')) }, now);
  assert(lastWeekOnly.titleStats(state.profiles.find(p => p.id === 'qa-cc-b')).weekly_rank === 1 && lastWeekOnly.titleStats(state.profiles.find(p => p.id === 'qa-cc-c')).weekly_rank === 2 && lastWeekOnly.titleStats(state.profiles.find(p => p.id === 'qa-cc-d')).weekly_rank === 2 && lastWeekOnly.titleStats(state.profiles.find(p => p.id === 'qa-cc-e')).weekly_rank === 0, 'V13.66 ranks: 900 first, two 700s share second, the next is fourth (no title)');
  const nextWeek = createCompetition({ ...state, sessions: state.sessions.filter(s => s.id.startsWith('qa-cc-lw')) }, now + 7 * DAY);
  const bProfile = { ...state.profiles.find(p => p.id === 'qa-cc-b'), avatar_title: 'weekly1' };
  assert(lastWeekOnly.displayTitle(bProfile) === 'weekly1' && nextWeek.displayTitle(bProfile) === 'rookie', 'V13.66 a limited title is shown only during its week, then falls back to 첫걸음');
  // League king: last week's league leader with at least 9 points.
  const lwMatches = [1, 2, 3].map(i => match(`qa-cc-lk${i}`, 'qa-cc-e', ['qa-cc-b', 'qa-cc-c', 'qa-cc-d'][i - 1], 'qa-cc-e', lastWeek.start + DAY + i * 1000));
  const kings = createCompetition({ ...state, battles: [...state.battles, ...lwMatches] }, now);
  assert(kings.titleStats(state.profiles.find(p => p.id === 'qa-cc-e')).league_king === 1 && kings.titleStats(state.profiles.find(p => p.id === 'qa-cc-b')).league_king === 0, 'V13.66 last week\'s league leader (3 wins or more) gets the limited 주간 야차왕 title');
  const diamondWeeks = Array.from({ length: 10 }, (_, i) => match(`qa-cc-dm${i}`, 'qa-cc-b', `qa-opp-${i}`, 'qa-cc-b', lastWeek.start + DAY + i * 1000));
  assert(createCompetition({ ...state, battles: diamondWeeks }, now).titleStats(state.profiles.find(p => p.id === 'qa-cc-b')).league_best === 3, 'V13.66 reaching 30 points in any week is the diamond tier (다이아 야차)');

  /* ---------- coins ---------- */
  const rank = (await service(state, 'GET', '/bootstrap', {}, tokens['qa-cc-b'])).ranking;
  const aRow = rank.find(r => r.id === 'qa-cc-a');
  const aWeekStudy = state.sessions.filter(s => s.student_id === 'qa-cc-a' && s.created_at >= week.start).reduce((n, s) => n + s.reward_points, 0);
  assert(aRow.coins === aWeekStudy + 6 * 10 && aRow.all_coins === 18 * 30 + 6 * 10 && aRow.title === 'combo20' && rank.find(r => r.private && r.display_name === '비공개 학생').title === null, 'V13.66 ranking by coins collected (study rewards + stakes won, spending not taken off), with titles');
  const pbalance = (await service(state, 'GET', '/bootstrap', {}, tokens['qa-cc-a'])).stats;
  assert(pbalance.prize_points === 0 && typeof pbalance.points_balance === 'number', 'V13.66 coin balance includes tournament prizes (none yet)');

  /* ---------- tournaments ---------- */
  assert(seedOrder(8).join() === '1,8,4,5,2,7,3,6' && roundLabel(4) === '8강' && roundLabel(1) === '결승', 'V13.66 tournament seeding puts the top seeds apart; rounds are named 8강·4강·결승');
  const five = buildBracket(['p1', 'p2', 'p3', 'p4', 'p5']);
  assert(five.length === 3 && five[0].length === 4 && five[0].filter(m => !m.b || !m.a).length === 3, 'V13.66 five players make an 8-player bracket with three byes');
  const range = ['24'];
  assert(scopedWords(state, 'danwon-high', range, '고1A').length >= 8, 'V13.66 tournament release check found a range with enough words');
  const teacher = tokens.qa_cc_teacher;
  await expectStatus(400, () => service(state, 'POST', '/teacher/tournaments', { class_name: '고1', student_ids: ['qa-cc-a'], range_codes: range }, teacher), 'V13.66 a tournament needs two players or more');
  await expectStatus(400, () => service(state, 'POST', '/teacher/tournaments', { class_name: '고1', student_ids: ['qa-cc-a', 'qa-cc-other'], range_codes: range }, teacher), 'V13.66 players come from the same school and grade');
  await expectStatus(409, () => service(state, 'POST', '/teacher/tournaments', { class_name: '고1', student_ids: ['qa-cc-a', 'qa-cc-nopet'], range_codes: range }, teacher), 'V13.66 every player needs a pet');
  await expectStatus(400, () => service(state, 'POST', '/teacher/tournaments', { class_name: '고1', student_ids: ['qa-cc-a', 'qa-cc-b'], range_codes: range, prize: 77 }, teacher), 'V13.66 prizes are 0, 50, 100 or 200 coins');
  await expectStatus(400, () => service(state, 'POST', '/teacher/tournaments', { class_name: '고1A', student_ids: ['qa-cc-a', 'qa-cc-c'], range_codes: range }, teacher), 'V13.66 a class tournament takes only that class');
  await expectStatus(403, () => service(state, 'POST', '/teacher/tournaments', { class_name: '고1', student_ids: ['qa-cc-a', 'qa-cc-b'], range_codes: range }, tokens['qa-cc-a']), 'V13.66 only teachers open tournaments');
  const created = await service(state, 'POST', '/teacher/tournaments', { name: '검사 대회', class_name: '고1', student_ids: ['qa-cc-a', 'qa-cc-b', 'qa-cc-c', 'qa-cc-d', 'qa-cc-e'], range_codes: range, prize: 100, seeding: 'league' }, teacher);
  const t = state.tournaments[0];
  assert(created.tournament?.id === t.id && t.status === 'active' && t.rounds.map(r => r.length).join() === '4,2,1' && created.tournament.rounds.map(r => r.label).join() === '8강,4강,결승' && t.players[0] === 'qa-cc-a', 'V13.66 a teacher opens a tournament; seeding by league points puts the league leader first');
  assert(t.rounds[0].filter(m => m.by === 'bye' && m.winner).length === 3 && t.rounds[1].every(m => m.a || m.b), 'V13.66 byes are decided at once and move the players on');
  await expectStatus(409, () => service(state, 'POST', '/teacher/tournaments', { class_name: '고1', student_ids: ['qa-cc-a', 'qa-cc-b'], range_codes: range }, teacher), 'V13.66 a student plays one tournament at a time');
  {
    // V13.71 교실 TV link: bracket only, no login; a new link ends the old one; teachers only.
    await expectStatus(403, () => service(state, 'POST', `/teacher/tournaments/${t.id}/tv`, {}, tokens['qa-cc-a']), 'V13.71 only teachers make a TV link');
    const { token: first } = await service(state, 'POST', `/teacher/tournaments/${t.id}/tv`, {}, teacher);
    const tv = await service(state, 'GET', '/tv/bracket', { token: first }, null);
    assert(tv.tournament?.id === t.id && tv.tournament.rounds.length === 3 && tv.tournament.me === null && !JSON.stringify(tv).includes('tv_hash') && !JSON.stringify(created).includes('tv_hash'), 'V13.71 a TV link shows the bracket without a login and without student-only fields');
    const { token: second } = await service(state, 'POST', `/teacher/tournaments/${t.id}/tv`, {}, teacher);
    await expectStatus(404, () => service(state, 'GET', '/tv/bracket', { token: first }, null), 'V13.71 making a new TV link ends the old one');
    await expectStatus(404, () => service(state, 'GET', '/tv/bracket', { token: 'x'.repeat(32) }, null), 'V13.71 a made-up TV link shows nothing');
    assert((await service(state, 'GET', '/tv/bracket', { token: second }, null)).tournament.id === t.id, 'V13.71 the newest TV link works');
  }
  const played = t.rounds[0].find(m => m.a && m.b);
  const [p1, p2] = [played.a, played.b];
  const boot1Tn = await service(state, 'GET', '/bootstrap', {}, tokens[p1]);
  const myTn = boot1Tn.tournaments.find(x => x.id === t.id);
  assert(myTn?.me?.match?.id === played.id && myTn.me.match.ready && myTn.me.match.opponent.id === p2 && myTn.rounds[0].matches.length === 4, 'V13.66 a player sees their next match and the bracket on the home screen');
  const teacherBoot = await service(state, 'GET', '/bootstrap', {}, teacher);
  assert(teacherBoot.tournaments.some(x => x.id === t.id && x.me === null), 'V13.66 the teacher gets the school\'s tournaments');
  const opened = await service(state, 'POST', '/tournament/play', { tournament_id: t.id, match_id: played.id }, tokens[p1]);
  const room = state.battles.find(b => b.id === opened.id);
  assert(opened.host && opened.stake === 0 && opened.tournament?.startsWith('대회') && room.tournament_id === t.id && room.match_id === played.id && room.invite_id === p2 && opened._battle?.label === opened.tournament, 'V13.66 starting a match opens a room without stake for the opponent');
  const invite = (await service(state, 'GET', '/battle/invite', {}, tokens[p2])).invite;
  assert(invite?.tournament?.id === t.id && invite.tournament.round && invite.stake === 0, 'V13.66 the opponent is told on the home screen (tournament invite)');
  const again = await service(state, 'POST', '/tournament/play', { tournament_id: t.id, match_id: played.id }, tokens[p1]);
  assert(again.id === opened.id && again.host && !again._battle, 'V13.66 starting again returns the same room');
  const joined = await service(state, 'POST', '/tournament/play', { tournament_id: t.id, match_id: played.id }, tokens[p2]);
  assert(joined.id === opened.id && !joined.host && joined._battle?.action === 'join' && room.status === 'active', 'V13.66 the opponent joins the same room from their card');
  settleBattle(state, { id: room.id, winner: null, loser: null, reason: 'end', hp: { [p1]: 40, [p2]: 40 } });
  assert(!played.winner && played.draws === 1, 'V13.66 a draw is played again');
  const replay = await service(state, 'POST', '/tournament/play', { tournament_id: t.id, match_id: played.id }, tokens[p2]);
  await service(state, 'POST', '/tournament/play', { tournament_id: t.id, match_id: played.id }, tokens[p1]);
  settleBattle(state, { id: replay.id, winner: p2, loser: p1, reason: 'end', hp: { [p1]: 0, [p2]: 30 } });
  const nextMatch = t.rounds[1].find(m => m.a === p2 || m.b === p2);
  assert(played.winner === p2 && played.by === 'match' && nextMatch, 'V13.66 the winner of a finished room moves on to the next round');
  const loserBoot = await service(state, 'GET', '/bootstrap', {}, tokens[p1]);
  assert(loserBoot.tournaments.find(x => x.id === t.id)?.me.out === '8강', 'V13.66 a player who lost sees where their run ended');
  await expectStatus(409, () => service(state, 'POST', '/tournament/play', { tournament_id: t.id, match_id: played.id }, tokens[p1]), 'V13.66 a decided match cannot be started again');
  const viewed = await service(state, 'GET', '/tournament/view', { id: t.id }, tokens[p1]);
  assert(viewed.tournament.id === t.id && viewed.tournament.rounds[0].matches.some(m => m.id === played.id && m.winner === p2), 'V13.66 a player opens the fresh bracket');
  await expectStatus(404, () => service(state, 'GET', '/tournament/view', { id: t.id }, tokens['qa-cc-private']), 'V13.66 only the players open a tournament bracket');
  // The teacher decides the rest (e.g. a student is absent); a waiting room of that match closes.
  const semi = t.rounds[1].find(m => !m.winner && m.a && m.b);
  const semiRoom = await service(state, 'POST', '/tournament/play', { tournament_id: t.id, match_id: semi.id }, tokens[semi.a]);
  await expectStatus(400, () => service(state, 'POST', `/teacher/tournaments/${t.id}/winner`, { match_id: semi.id, winner_id: 'qa-nobody' }, teacher), 'V13.66 the teacher picks one of the two players');
  const decided = await service(state, 'POST', `/teacher/tournaments/${t.id}/winner`, { match_id: semi.id, winner_id: semi.b }, teacher);
  assert(semi.winner === semi.b && semi.by === 'teacher' && decided._battles?.some(msg => msg.action === 'cancel' && msg.id === semiRoom.id) && state.battles.find(b => b.id === semiRoom.id).status === 'cancelled', 'V13.66 a teacher decision moves the winner on and closes the waiting room');
  for (const round of t.rounds) for (const m of round) if (!m.winner && m.a && m.b) await service(state, 'POST', `/teacher/tournaments/${t.id}/winner`, { match_id: m.id, winner_id: m.a }, teacher);
  const final = t.rounds.at(-1)[0];
  assert(t.status === 'finished' && t.champion === final.a && t.runner_up === final.b, 'V13.66 the final decides the champion and the runner-up');
  const champBoot = await service(state, 'GET', '/bootstrap', {}, tokens[t.champion]);
  const runnerBoot = await service(state, 'GET', '/bootstrap', {}, tokens[t.runner_up]);
  assert(champBoot.stats.prize_points === 100 && runnerBoot.stats.prize_points === 50 && champBoot.titles.unlocked.includes('champion') && champBoot.tournaments.find(x => x.id === t.id)?.me.champion, 'V13.66 the champion gets the prize and the SUMUS 챔피언 title; the runner-up half the prize');
  await expectStatus(409, () => service(state, 'POST', `/teacher/tournaments/${t.id}/cancel`, {}, teacher), 'V13.66 a finished tournament cannot be cancelled');
  // V13.69 the classroom TV bracket: the teacher polls one tournament with the players' pets.
  const tv = await service(state, 'GET', `/teacher/tournaments/${t.id}`, {}, teacher);
  assert(tv.tournament?.id === t.id && tv.tournament.status === 'finished' && tv.tournament.champion?.id === t.champion && tv.tournament.champion.pet?.key === 'dog' && tv.tournament.rounds.every(r => r.matches.every(m => (!m.a || m.a.pet) && (!m.b || m.b.pet))) && Number.isFinite(tv.server_time), 'V13.69 the TV bracket gets the tournament with every player\'s pet');
  await expectStatus(403, () => service(state, 'GET', `/teacher/tournaments/${t.id}`, {}, tokens['qa-cc-a']), 'V13.69 only teachers open the TV bracket');
  await expectStatus(404, () => service(state, 'GET', '/teacher/tournaments/qa-no-such', {}, teacher), 'V13.69 an unknown tournament is not found');
  state.profiles.push({ id: 'qa-cc-teacher2', username: 'qa_cc_teacher2', display_name: '다른 학교 선생님', role: 'teacher', active: true, password_hash: hash, school_ids: ['seonbu-high'], division_ids: ['high'], active_division: 'high', active_school_id: 'seonbu-high', created_at: now - 30 * DAY });
  const otherTeacher = await login('qa_cc_teacher2');
  await expectStatus(404, () => service(state, 'GET', `/teacher/tournaments/${t.id}`, {}, otherTeacher), 'V13.69 a teacher of another school cannot open the TV bracket');
  const tvSource = source('../public/modules/bracket-tv.js'), appTvSource = source('../public/app.js'), teacherTvSource = source('../public/modules/teacher.js'), buildTvSource = source('./build-assets.mjs');
  assert(tvSource.includes('export function openBracketTv(') && tvSource.includes('/teacher/tournaments/') && tvSource.includes('POLL_MS') && tvSource.includes('function celebrate(') && tvSource.includes('function announce(') && tvSource.includes('requestFullscreen') && appTvSource.includes("d.action === 'tournament-tv'") && appTvSource.includes("A.screen = 'bracket-tv'") && teacherTvSource.includes('data-action="tournament-tv"') && buildTvSource.includes('"v1369.css"'), 'V13.69 teachers open the live bracket on the classroom TV from the tournament panel');
  const second = await service(state, 'POST', '/teacher/tournaments', { class_name: '고1', student_ids: ['qa-cc-a', 'qa-cc-b'], range_codes: range }, teacher);
  const openedSecond = await service(state, 'POST', '/tournament/play', { tournament_id: second.tournament.id, match_id: 'r0m0' }, tokens['qa-cc-a']);
  const cancelled = await service(state, 'POST', `/teacher/tournaments/${second.tournament.id}/cancel`, {}, teacher);
  assert(state.tournaments.find(x => x.id === second.tournament.id).status === 'cancelled' && cancelled._battles?.some(msg => msg.id === openedSecond.id), 'V13.66 a teacher can call a tournament off; its waiting rooms close');
  const old = { ...state.tournaments.find(x => x.id === second.tournament.id) };
  tidyBattles(state, now + 8 * DAY);
  assert(!state.tournaments.some(x => x.id === old.id) && state.tournaments.some(x => x.id === t.id), 'V13.66 a cancelled tournament is forgotten after a week; finished ones stay');
  const workerSource = source('../cloudflare/worker.mjs');
  assert(workerSource.includes('result?._battles') && workerSource.includes('for (const message of roomMessages)'), 'V13.66 the worker forwards several room messages (a cancelled tournament)');

  /* ---------- engine and practice match ---------- */
  const players = [{ id: 'p1', name: 'A', pet: { key: 'dog', form: 1 }, title: 'combo20', tier: 'gold' }, { id: 'p2', name: 'B', pet: null, bot: true }];
  const engine = createBattle({ id: 'e1', players, questions: [{ word_id: 'w', prompt: 'x', options: ['a', 'b', 'c', 'd'], answer: 0 }], label: '연습 경기', now });
  const view = battleView(engine, 'p1');
  assert(view.label === '연습 경기' && view.players.p1.title === 'combo20' && view.players.p1.tier === 'gold' && view.players.p2.bot === true && connect(engine, 'p1', now).length === 1, 'V13.66 a room shows each player\'s title and tier and the match label');
  const words = scopedWords(state, 'danwon-high', range, '고1A');
  const questions = practiceQuestions(words);
  assert(questions.length >= 8 && questions.length <= 40 && questions.every(q => q.options.length === 4 && q.options[q.answer] && q.prompt), 'V13.66 practice matches build four-choice words from the student\'s range');
  const messages = [];
  const practice = createPracticeMatch({ me: players[0], questions, level: 'hard', onMessage: msg => messages.push(msg), random: () => .1 });
  practice.start();
  practice.send({ type: 'emote', emote: 'gg' });
  practice.close();
  assert(messages[0]?.type === 'view' && messages[0].view.players[BOT_ID]?.bot && messages[0].view.stake === 0 && messages[0].view.label === '연습 경기' && messages.some(m => m.type === 'events' && m.events.some(e => e.type === 'countdown')) && messages.some(m => m.events?.some(e => e.type === 'emote' && e.player === 'p1')), 'V13.66 a practice match runs on the phone: no stake, a computer pet, the countdown and emotes');

  /* ---------- screens ---------- */
  const studentUi = source('../public/modules/student.js'), battle = source('../public/modules/battle.js'), app = source('../public/app.js');
  const teacherUi = source('../public/modules/teacher.js'), titlesUi = source('../public/modules/titles-ui.js'), leagueUi = source('../public/modules/league-ui.js');
  const css = source('../public/v1366.css'), build = source('./build-assets.mjs'), sessionsUi = source('../public/modules/sessions.js'), petUi = source('../public/modules/pet-moments.js');
  assert(studentUi.includes('function coinChip(') && studentUi.includes('data-action="coins"') && app.includes('function walletModal(') && app.includes('경험치와 코인은 달라요') && css.includes('.coin-chip-v1366'), 'V13.66 coins sit in the header on every student tab and open a wallet that explains 경험치 vs 코인');
  assert(!/\d}P|}P<|\dP\b|포인트는/.test(battle + petUi) && battle.includes('코인') && sessionsUi.includes('<span>경험치</span>') && sessionsUi.includes('<span>코인</span>') && !sessionsUi.includes('성장 XP'), 'V13.66 students read 경험치 and 코인 (no XP or P) in results, the shop and yacha');
  assert(studentUi.includes("['coins', '코인']") && studentUi.includes('function podium(') && studentUi.includes('data-rank-view="league"') && studentUi.includes('data-league-board') && app.includes('mountLeagueBoard('), 'V13.66 the ranking adds 코인, a top-3 podium and the 야차 리그 board');
  assert(studentUi.includes('titles: titlesPage') && studentUi.includes('data-go="titles"') && titlesUi.includes('export function titlesPage(') && titlesUi.includes('export function maybeTitleMoment(') && titlesUi.includes("api('/titles/seen'") && app.includes('maybeTitleMoment(A'), 'V13.66 a title collection page, title details and a pop-up when a title is won');
  assert(studentUi.includes('partner-title-v1366') && studentUi.includes('partner-league-v1366') && battle.includes('yb-hud-title') && battle.includes('function vsSide(') && leagueUi.includes('titleBadge(title'), 'V13.66 titles show on the card, in the league, the ranking, the challenge list and in matches');
  assert(battle.includes('data-tab="record" data-sub="league"') && battle.includes('function recordTab(') && battle.includes('function myRecord(') && battle.includes("data-yb=\"bot\"") && battle.includes('createPracticeMatch(') && battle.includes('B.local.send(message)'), 'V13.66 the yacha lobby has 대결 and 기록 (V13.132: 리그 랭킹 | 내 전적 inside it) and a practice match against the app');
  assert(teacherUi.includes("['tournaments', '야차 대회', 'battle']") && teacherUi.includes('bracketHtml(t, { teacher: true })') && app.includes('function tournamentCreateModal(') && app.includes('startTournamentPolling') && studentUi.includes('data-action="tournament-play"') && css.includes('grid-template-columns:repeat(7,minmax(0,1fr))'), 'V13.66 teachers run tournaments from a new tab; students start their match from the home screen');
  assert(build.includes('"v1366.css"') && source('../public/sw.js').includes('"/modules/battle-bot.js"') && source('../public/sw.js').includes('"/modules/titles.js"'), 'V13.66 new styles are bundled and new modules precached');
}
