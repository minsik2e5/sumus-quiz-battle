// Release checks for V13.125 다른 학교와 야차전: students of the same 부 and 학년 battle across
// schools (friend list, challenge, room code, rematch), each with their own school's words, under
// a teacher switch (on by default). Tournaments, leagues and stakes stay as they were.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { emptyState, migrateState } from './state.mjs';
import { passwordHash } from './auth.mjs';
import { service, scopedWords, settleBattle } from './service.mjs';
import { DAY_MS, sameGradeBand } from './competition.mjs';

const source = path => readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8');

export async function runCrossSchoolChecks(assert, expectStatus) {
  /* ---------- the shared grade rule ---------- */
  assert(sameGradeBand({ division: 'high', class_name: '고1A' }, { division: 'high', class_name: '고1B' }) && !sameGradeBand({ division: 'high', class_name: '고1A' }, { division: 'high', class_name: '고2A' }) && !sameGradeBand({ division: 'middle', class_name: '중1' }, { division: 'high', class_name: '고1A' }) && !sameGradeBand({ division: 'high', class_name: '특강반' }, { division: 'high', class_name: '특강반' }), 'V13.125 sameGradeBand: the same 부 and 학년 (고1A = 고1B), never 중↔고, another grade or a class with no grade');

  /* ---------- an old state gets the switch, on ---------- */
  const old = emptyState();
  delete old.battleSettings;
  assert(migrateState(old) && old.battleSettings?.cross_school === true, 'V13.125 an old state gets 다른 학교와 야차전 허용 = on');
  const kept = { ...emptyState(), battleSettings: { cross_school: false } };
  migrateState(kept);
  assert(kept.battleSettings.cross_school === false && emptyState().battleSettings.cross_school === true, 'V13.125 a switch turned off stays off; a new state starts on');

  /* ---------- setup ---------- */
  const now = Date.now();
  const state = emptyState();
  const hash = await passwordHash('QaCross1!');
  const SCHOOLS = { 'gangseo-high': '강서고', 'danwon-high': '단원고', 'seonbu-high': '선부고', 'wonil-middle': '원일중' };
  const student = (id, name, school, cls) => ({ id, username: id, display_name: name, role: 'student', active: true, class_name: cls, school_id: school, school: SCHOOLS[school], division: school.endsWith('middle') ? 'middle' : 'high', password_hash: hash, pets: [{ key: 'dog', first: true, acquired_at: now - 9 * DAY_MS }], avatar_key: 'dog', created_at: now - 9 * DAY_MS });
  state.profiles.push(
    { id: 'qa-xs-teacher', username: 'qa_xs_teacher', display_name: '대결 선생님', role: 'teacher', active: true, password_hash: hash, school_ids: Object.keys(SCHOOLS), division_ids: ['middle', 'high'], active_division: 'high', active_school_id: 'gangseo-high', created_at: now - 9 * DAY_MS },
    student('qa-xs-g1', '강가람', 'gangseo-high', '고1A'), student('qa-xs-g2', '강나래', 'gangseo-high', '고1B'), student('qa-xs-g3', '강다온', 'gangseo-high', '고1A'),
    student('qa-xs-d1', '단라온', 'danwon-high', '고1A'), student('qa-xs-s1', '선마루', 'seonbu-high', '고1A'),
    student('qa-xs-d2', '단바다', 'danwon-high', '고2A'), student('qa-xs-m1', '원사랑', 'wonil-middle', '중1')
  );
  // Coins for the stakes, as the main release check does: a finished practice with reward points.
  for (const p of state.profiles.filter(x => x.role === 'student')) state.sessions.push({ id: 'qa-xs-coins-' + p.id, student_id: p.id, division: p.division, school_id: p.school_id, school: p.school, total: 1, correct: 1, xp: 0, reward_points: 1000, created_at: now - 120000 });
  migrateState(state);
  const login = async (username, division = 'high') => (await service(state, 'POST', '/login', { username, password: 'QaCross1!', division, role: username.includes('teacher') ? 'teacher' : undefined }, null))._cookie;
  const t = {};
  for (const p of state.profiles) t[p.id] = await login(p.username, p.division === 'middle' ? 'middle' : 'high');
  const wordIds = (school, codes, cls = '고1A') => new Set(scopedWords(state, school, codes, cls).map(w => w.id));
  // 29 is a range at both 강서고 and 단원고, with different words: the code alone says nothing.
  const sharedCode = '29', gIds = wordIds('gangseo-high', [sharedCode]), dIds = wordIds('danwon-high', [sharedCode]);
  assert(gIds.size >= 8 && dIds.size >= 8 && [...gIds].every(id => !dIds.has(id)), 'V13.125 check setup: range 29 exists at both schools with different words');
  const cleanup = () => { for (const b of state.battles) if (['waiting', 'active'].includes(b.status)) settleBattle(state, { id: b.id, reason: 'cancelled' }); };

  /* ---------- friend list ---------- */
  const friends = (await service(state, 'GET', '/battle/friends', {}, t['qa-xs-g1'])).friends;
  const ids = friends.map(f => f.id);
  assert(['qa-xs-g2', 'qa-xs-g3', 'qa-xs-d1', 'qa-xs-s1'].every(id => ids.includes(id)) && !ids.includes('qa-xs-d2') && !ids.includes('qa-xs-m1') && !ids.includes('qa-xs-g1'), 'V13.125 the friend list has the same grade at other schools; not another grade, not a middle schooler');
  assert(ids[0] === 'qa-xs-g3' && ids.indexOf('qa-xs-g2') < ids.indexOf('qa-xs-d1') && ids.indexOf('qa-xs-g2') < ids.indexOf('qa-xs-s1'), 'V13.125 my school first (my class on top), then other schools');
  assert(friends.find(f => f.id === 'qa-xs-d1').school === '단원고' && friends.find(f => f.id === 'qa-xs-g2').school === '강서고' && friends.every(f => Object.keys(f).every(k => ['id', 'name', 'school', 'class_name', 'same_class', 'pet', 'title', 'tier', 'busy', 'invited'].includes(k))) && friends.every(f => !('username' in f) && !('password_hash' in f) && !('school_id' in f)), 'V13.125 each friend carries the school name only (no login id or other private fields)');
  const middleFriends = (await service(state, 'GET', '/battle/friends', {}, t['qa-xs-m1'])).friends;
  assert(!middleFriends.some(f => f.id.startsWith('qa-xs-g') || f.id.startsWith('qa-xs-d') || f.id.startsWith('qa-xs-s')), 'V13.125 a middle schooler sees no high schooler');

  /* ---------- challenge across schools: words of each school, even with the same code ---------- */
  await expectStatus(404, () => service(state, 'POST', '/battle/challenge', { friend_id: 'qa-xs-d2', stake: 10, range_codes: [sharedCode] }, t['qa-xs-g1']), 'V13.125 a challenge to another grade is refused');
  await expectStatus(404, () => service(state, 'POST', '/battle/challenge', { friend_id: 'qa-xs-m1', stake: 10, range_codes: [sharedCode] }, t['qa-xs-g1']), 'V13.125 a challenge to a middle schooler is refused');
  const ch = await service(state, 'POST', '/battle/challenge', { friend_id: 'qa-xs-d1', stake: 10, range_codes: [sharedCode], range_mode: 'same' }, t['qa-xs-g1']);
  const chRow = state.battles.find(b => b.id === ch.id);
  assert(ch.challenge && ch.friend_school === '단원고' && chRow.school_id === 'gangseo-high' && chRow.range_mode === 'each' && ch.range_mode === 'each', 'V13.125 a challenge to another school opens a 강서고 room that is always 각자 내 범위 (a "same" request becomes "each")');
  assert(ch._push?.[0]?.title.includes('강서고') && ch._push[0].title.includes('강가람'), 'V13.125 the push says which school the challenge comes from');
  const invite = (await service(state, 'GET', '/battle/invite', {}, t['qa-xs-d1'])).invite;
  assert(invite?.id === ch.id && invite.host_school === '강서고' && invite.cross_school === true && invite.range_mode === 'each' && (await service(state, 'GET', '/bootstrap', {}, t['qa-xs-d1'])).battle_invite?.host_school === '강서고', 'V13.125 the challenged student sees the host\'s school');
  const joined = await service(state, 'POST', '/battle/join', { code: ch.code, stake: 10, range_codes: [sharedCode] }, t['qa-xs-d1']);
  const own = joined._battle?.own || {}, hostQs = own['qa-xs-g1'] || [], guestQs = own['qa-xs-d1'] || [];
  assert(joined.own_words && joined.opponent_school === '강서고' && joined.range_mode === 'each' && hostQs.length >= 8 && hostQs.length === guestQs.length && hostQs.every(q => gIds.has(q.word_id)) && guestQs.every(q => dIds.has(q.word_id)), 'V13.125 joining across schools: the host gets 강서고 words, the guest 단원고 words, though both picked range 29');
  assert(chRow.status === 'active' && chRow.range_mode === 'each' && chRow.guest_school_id === 'danwon-high' && joined._battle.guest.school === '단원고', 'V13.125 the match is stored as 각자 내 범위 between two schools');
  settleBattle(state, { id: ch.id, winner: 'qa-xs-d1', loser: 'qa-xs-g1', reason: 'end', hp: { 'qa-xs-g1': 0, 'qa-xs-d1': 30 }, max_hp: 250 });
  const record = (await service(state, 'GET', '/battle/history', {}, t['qa-xs-d1'])).record;
  assert(chRow.status === 'finished' && record.wins === 1, 'V13.125 a match across schools counts in the student\'s own record (wins, streak)');

  /* ---------- rematch across schools, same rule ---------- */
  const re = await service(state, 'POST', '/battle/rematch', { battle_id: ch.id }, t['qa-xs-g1']);
  const reRow = state.battles.find(b => b.id === re.id);
  assert(re.rematch && reRow.school_id === 'gangseo-high' && reRow.invite_id === 'qa-xs-d1' && reRow.range_mode === 'each', 'V13.125 a rematch across schools opens (각자 내 범위)');
  const reJoin = await service(state, 'POST', '/battle/join', { code: re.code, stake: 10 }, t['qa-xs-d1']);
  assert(reJoin.own_words && reJoin._battle.own['qa-xs-g1'].every(q => gIds.has(q.word_id)) && reJoin._battle.own['qa-xs-d1'].every(q => dIds.has(q.word_id)), 'V13.125 the rematch keeps each player\'s school words');
  cleanup();

  /* ---------- a code room: a 'same' room of another school still gives the guest their own words ---------- */
  const room = await service(state, 'POST', '/battle/rooms', { stake: 10, range_codes: [sharedCode], range_mode: 'same' }, t['qa-xs-g1']);
  const preview = await service(state, 'GET', '/battle/preview', { code: room.code }, t['qa-xs-s1']);
  assert(preview.host_school === '강서고' && preview.cross_school && preview.range_mode === 'each', 'V13.125 the preview of another school\'s room says 각자 내 범위 and the host\'s school');
  const samePreview = await service(state, 'GET', '/battle/preview', { code: room.code }, t['qa-xs-g2']);
  assert(samePreview.range_mode === 'same' && !samePreview.cross_school, 'V13.125 for a classmate of the same school the room stays 같은 범위로');
  await expectStatus(404, () => service(state, 'POST', '/battle/join', { code: room.code, stake: 10, range_codes: [sharedCode] }, t['qa-xs-d2']), 'V13.125 another grade cannot join by code');
  await expectStatus(404, () => service(state, 'GET', '/battle/preview', { code: room.code }, t['qa-xs-m1']), 'V13.125 a middle schooler cannot see a high school room');
  await expectStatus(409, () => service(state, 'POST', '/battle/join', { code: room.code, stake: 10, range_codes: [] }, t['qa-xs-s1']), 'V13.125 joining another school needs my own range');
  const sIds = wordIds('seonbu-high', ['36']);
  const codeJoin = await service(state, 'POST', '/battle/join', { code: room.code, stake: 10, range_codes: ['36'] }, t['qa-xs-s1']);
  const roomRow = state.battles.find(b => b.id === room.id);
  assert(codeJoin.own_words && codeJoin._battle.own['qa-xs-g1'].every(q => gIds.has(q.word_id)) && codeJoin._battle.own['qa-xs-s1'].every(q => sIds.has(q.word_id)) && roomRow.range_mode === 'each', 'V13.125 a 같은 범위로 room joined from another school becomes 각자 내 범위 (선부고 words for the guest)');
  cleanup();
  const sameSchool = await service(state, 'POST', '/battle/rooms', { stake: 10, range_codes: [sharedCode], range_mode: 'same' }, t['qa-xs-g1']);
  const sameJoin = await service(state, 'POST', '/battle/join', { code: sameSchool.code, stake: 10, range_codes: ['21'] }, t['qa-xs-g2']);
  assert(!sameJoin.own_words && state.battles.find(b => b.id === sameSchool.id).range_mode === 'same', 'V13.125 within one school 같은 범위로 works as before');
  cleanup();

  /* ---------- the teacher switch ---------- */
  const teacherBoot = await service(state, 'GET', '/bootstrap', {}, t['qa-xs-teacher']);
  assert(teacherBoot.battle_settings?.cross_school === true && (await service(state, 'GET', '/bootstrap', {}, t['qa-xs-g1'])).battle_cross_school === true, 'V13.125 the teacher bootstrap has the switch (on); students get it for the wording');
  await expectStatus(403, () => service(state, 'POST', '/teacher/battle-settings', { cross_school: false }, t['qa-xs-g1']), 'V13.125 only teachers change the switch');
  await expectStatus(400, () => service(state, 'POST', '/teacher/battle-settings', { cross_school: 'no' }, t['qa-xs-teacher']), 'V13.125 the switch takes true or false');
  const waitingOther = await service(state, 'POST', '/battle/rooms', { stake: 10, range_codes: [sharedCode] }, t['qa-xs-g1']);
  const waitingInvite = await service(state, 'POST', '/battle/challenge', { friend_id: 'qa-xs-s1', stake: 10, range_codes: [sharedCode] }, t['qa-xs-g3']);
  const off = await service(state, 'POST', '/teacher/battle-settings', { cross_school: false }, t['qa-xs-teacher']);
  assert(off.battle_settings.cross_school === false && state.battleSettings.cross_school === false && (await service(state, 'GET', '/bootstrap', {}, t['qa-xs-teacher'])).battle_settings.cross_school === false, 'V13.125 the teacher turns the switch off and it is stored');
  const offFriends = (await service(state, 'GET', '/battle/friends', {}, t['qa-xs-g1'])).friends.map(f => f.id);
  assert(offFriends.includes('qa-xs-g2') && !offFriends.includes('qa-xs-d1') && !offFriends.includes('qa-xs-s1'), 'V13.125 switch off: only my school in the friend list');
  await expectStatus(404, () => service(state, 'POST', '/battle/challenge', { friend_id: 'qa-xs-d1', stake: 10, range_codes: [sharedCode] }, t['qa-xs-g2']), 'V13.125 switch off: no challenge to another school');
  await expectStatus(404, () => service(state, 'POST', '/battle/join', { code: waitingOther.code, stake: 10, range_codes: [sharedCode] }, t['qa-xs-d1']), 'V13.125 switch off: a room of another school that was already waiting cannot be joined');
  assert((await service(state, 'GET', '/battle/invite', {}, t['qa-xs-s1'])).invite === null, 'V13.125 switch off: a challenge from another school no longer shows');
  await expectStatus(404, () => service(state, 'POST', '/battle/join', { code: waitingInvite.code, stake: 10, range_codes: ['36'] }, t['qa-xs-s1']), 'V13.125 switch off: that challenge cannot be accepted either');
  const offJoin = await service(state, 'POST', '/battle/join', { code: waitingOther.code, stake: 10, range_codes: [sharedCode] }, t['qa-xs-g2']);
  assert(offJoin.status === 'active', 'V13.125 switch off: the same school still battles');
  cleanup();
  await service(state, 'POST', '/teacher/battle-settings', { cross_school: true }, t['qa-xs-teacher']);

  /* ---------- tournaments stay in one school ---------- */
  await expectStatus(400, () => service(state, 'POST', '/teacher/tournaments', { class_name: '고1', student_ids: ['qa-xs-g1', 'qa-xs-d1'], range_codes: [sharedCode] }, t['qa-xs-teacher']), 'V13.125 a tournament still takes one school only');
  const tRoom = { id: 'qa-xs-tourney-room', code: '654321', status: 'waiting', school_id: 'gangseo-high', division: 'high', grade: '고1', host_id: 'qa-xs-g1', guest_id: null, stake: 0, range_codes: [sharedCode], tickets: {}, created_at: Date.now(), invite_id: 'qa-xs-d1', challenge: true, tournament_id: 'qa-xs-tourney', mode: 'speed', range_mode: 'same' };
  state.battles.push(tRoom);
  await expectStatus(404, () => service(state, 'POST', '/battle/join', { code: tRoom.code, stake: 0, range_codes: [sharedCode] }, t['qa-xs-d1']), 'V13.125 a tournament room never takes a student of another school');
  assert((await service(state, 'GET', '/battle/invite', {}, t['qa-xs-d1'])).invite === null, 'V13.125 a tournament room of another school is not shown as a challenge');
  state.battles = state.battles.filter(b => b.id !== tRoom.id);

  /* ---------- screens ---------- */
  const battleUi = source('../public/modules/battle.js'), teacherUi = source('../public/modules/teacher.js'), appUi = source('../public/app.js'), studentUi = source('../public/modules/student.js'), css = source('../public/v13125.css'), build = source('./build-assets.mjs'), service_ = source('./service.mjs');
  assert(!battleUi.includes('같은 학교·학년 친구에게 이 코드를') && !battleUi.includes("'<p class=\"yb-muted\">같은 학교·학년 친구가 아직 없어요") && battleUi.includes('const whoCanBattle = ') && source('../public/modules/friend-sheet.js').includes("[f.school, f.class_name].filter(Boolean).join(' · ')") && battleUi.includes('room.cross_school') && battleUi.includes('invite.host_school'), 'V13.125 the yacha screens name the school of each friend and follow the new rule');
  assert(studentUi.includes('invite.host_school') && appUi.includes("api('/teacher/battle-settings'") && appUi.includes("d.action === 'battle-cross-school'") && teacherUi.includes('다른 학교와 야차전 허용') && teacherUi.includes('data-action="battle-cross-school"') && teacherUi.indexOf('xs-switch-v13125') < teacherUi.indexOf('tn-intro-copy'), 'V13.125 the home challenge banner shows the school; the teacher switch sits at the top of the 야차 대회 tab');
  assert(css.includes('.xs-toggle-v13125.on') && build.includes('"v13125.css"') && !service_.includes("fail('같은 학교·학년 친구에게만 도전장을"), 'V13.125 the switch CSS is in the bundle and the old server message is gone');
}
