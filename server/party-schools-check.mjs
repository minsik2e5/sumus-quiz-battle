// V13.199 검사: 교실 게임(보물 사냥 · 반 낚시) 학교별 단어. 선생님이 맡은 여러 학교(같은 부)의 같은 학년이 한 방에서 하고,
// 학생마다 자기 학교 범위의 문제를 받는다(도난 경보 문제도 막는 학생 자기 묶음). 순위 · 훔치기 · 이벤트는 다같이.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { emptyState } from './state.mjs';
import { passwordHash } from './auth.mjs';
import { service, allBooks } from './service.mjs';
import { createParty, joinParty, startParty, playerView, answer } from './party-engine.mjs';

const source = path => readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8');
const DAY = 86400000;
const q = (id, n) => ({ word_id: `${id}${n}`, prompt: `${id}-word-${n}`, options: ['a', 'b', 'c', 'd'], answer: n % 4 });

export async function runPartySchoolsChecks(assert) {
  // ---- 방 규칙: 학생마다 자기 묶음
  {
    const Q1 = Array.from({ length: 10 }, (_, i) => q('d', i)), Q2 = Array.from({ length: 10 }, (_, i) => q('g', i));
    const room = createParty({ id: 'r', code: '1234', kind: 'treasure', minutes: 5, questions: Q1, qsets: { 'gangseo-high': Q2, x1: Q2, x2: Q2, x3: Q2, x4: Q2 }, host: { id: 't' }, seed: 1, school_id: 'danwon-high' });
    assert(Object.keys(room.qsets).length === 4, 'V13.199 다른 학교 문제 묶음은 4개까지(방 저장 크기)');
    const t0 = 1_000_000;
    joinParty(room, { id: 'a', name: '단원' }, t0); joinParty(room, { id: 'b', name: '강서', qs: 'gangseo-high' }, t0); joinParty(room, { id: 'c', name: '모름', qs: 'nowhere' }, t0);
    assert(!room.players.a.qs && room.players.b.qs === 'gangseo-high' && !room.players.c.qs, 'V13.199 묶음이 있는 학교만 qs를 갖고, 모르는 학교는 선생님 학교 문제');
    startParty(room, t0);
    const prompts = pid => { const out = []; let t = t0; for (let i = 0; i < 6; i++) { t += 5000; const v = playerView(room, pid, t); if (!v.q) break; out.push(v.q.prompt); const cur = (room.players[pid].qs ? Q2 : Q1).find(x => x.prompt === v.q.prompt); answer(room, pid, (cur.answer + 1) % 4, t); } return out; };
    const pa = prompts('a'), pb = prompts('b'), pc = prompts('c');
    assert(pa.length >= 3 && pa.every(p => p.startsWith('d-')) && pb.length >= 3 && pb.every(p => p.startsWith('g-')) && pc.every(p => p.startsWith('d-')), 'V13.199 학생마다 자기 학교 문제(단원 d- · 강서 g-), 틀려도 다음 문제는 자기 묶음');
    const eng = source('./party-engine.mjs');
    assert(eng.includes('qi: hash(`${victim.id}:${pl.id}:${now}`) % Math.max(1, qsOf(room, victim).length)') && eng.includes('const qs = qsOf(room, pl), q = qs[a.qi % Math.max(1, qs.length)];') && eng.includes('const a = pl.alarm, aqs = qsOf(room, pl), aq = aqs[a.qi % Math.max(1, aqs.length)];'),
      'V13.199 도난 경보 문제도 막는 학생 자기 학교 묶음에서 나오고 채점된다');
  }

  // ---- 서버 경로
  const state = emptyState(), now = Date.now(), hash = await passwordHash('QaParty12!');
  const wordIds = (school, code) => new Set(allBooks(state).filter(b => b.school_id === school && (!b.grade || b.grade === '고1')).flatMap(b => b.words || []).filter(w => String(w.range_code) === code).map(w => w.id));
  const DANWON = wordIds('danwon-high', '24'), GANGSEO = wordIds('gangseo-high', '21');
  state.profiles.push({ id: 'qa-pt', username: 'qa-pt', display_name: '게임 선생님', role: 'teacher', active: true, password_hash: hash, school_ids: ['danwon-high', 'gangseo-high'], division_ids: ['high'], active_division: 'high', active_school_id: 'danwon-high', created_at: now - DAY });
  const student = (id, school, name) => ({ id, username: id, display_name: name, role: 'student', active: true, class_name: '고1A', school_id: school, school: { 'danwon-high': '단원고', 'gangseo-high': '강서고', 'seonbu-high': '선부고' }[school], division: 'high', password_hash: hash, avatar_key: 'dog', pets: [{ key: 'dog', first: true, acquired_at: now - DAY }], created_at: now - 9 * DAY });
  state.profiles.push(student('qa-pd', 'danwon-high', '단원'), student('qa-pg', 'gangseo-high', '강서'), student('qa-ps', 'seonbu-high', '선부'));
  const tokens = {};
  for (const u of ['qa-pt', 'qa-pd', 'qa-pg', 'qa-ps']) tokens[u] = (await service(state, 'POST', '/login', { username: u, password: 'QaParty12!', division: 'high' }, null))._cookie;
  const call = (u, method, path, body = {}) => service(state, method, path, body, tokens[u]);
  const status = p => p.then(() => 200, e => e.status || 500);
  const base = { kind: 'treasure', class_name: '고1', minutes: 5, steal: true, range_codes: ['24'] };

  // 예전처럼 한 학교 게임: 다른 학교 학생은 못 들어온다
  const solo = await call('qa-pt', 'POST', '/teacher/party', base);
  assert(!solo._parties.at(-1).party.qsets && await status(call('qa-pg', 'POST', '/party/join', { code: solo.party.code })) === 404, 'V13.199 함께할 학교를 고르지 않으면 예전처럼 그 학교만');
  assert(await status(call('qa-pt', 'POST', '/teacher/party', { ...base, class_name: '고1A', schools: [{ school_id: 'gangseo-high', range_codes: ['21'] }] })) === 400, 'V13.199 여러 학교 게임은 학년 전체로만');
  assert(await status(call('qa-pt', 'POST', '/teacher/party', { ...base, schools: [{ school_id: 'seonbu-high', range_codes: ['35'] }] })) === 403, 'V13.199 맡지 않은 학교는 함께할 수 없다');
  assert(await status(call('qa-pt', 'POST', '/teacher/party', { ...base, schools: [{ school_id: 'gangseo-high', range_codes: [] }] })) === 400, 'V13.199 함께할 학교마다 범위가 있어야 한다');

  const made = await call('qa-pt', 'POST', '/teacher/party', { ...base, schools: [{ school_id: 'gangseo-high', range_codes: ['21'] }] });
  const init = made._parties.at(-1), party = state.parties.find(x => x.id === made.party.id);
  assert(init.party.questions.every(x => DANWON.has(x.word_id)) && init.party.qsets['gangseo-high'].length >= 8 && init.party.qsets['gangseo-high'].every(x => GANGSEO.has(x.word_id)) && !init.party.qsets['danwon-high'],
    'V13.199 방에는 선생님 학교 문제(단원고 24번)와 함께한 학교 묶음(강서고 21번)');
  assert(party.school_ids.join() === 'danwon-high,gangseo-high' && party.school_ranges['gangseo-high'].join() === '21' && made.party.label.includes('학교별 단어'), 'V13.199 게임 기록에 학교 · 범위, 라벨에 학교별 단어');
  const jg = await call('qa-pg', 'POST', '/party/join', { code: made.party.code }), jd = await call('qa-pd', 'POST', '/party/join', { code: made.party.code });
  assert(jg._parties[0].player.qs === 'gangseo-high' && !jd._parties[0].player.qs && jg.room.id === party.id, 'V13.199 함께한 학교 학생도 들어오고(자기 학교 묶음 qs), 선생님 학교 학생은 기본 문제');
  assert(await status(call('qa-ps', 'POST', '/party/join', { code: made.party.code })) === 404, 'V13.199 함께하지 않은 학교 학생은 못 들어온다');

  // ---- 화면 · 안내 문구
  const tv = source('../public/modules/party-tv.js');
  assert(tv.includes('함께할 학교') && tv.includes("...(schools.length ? { schools } : {})") && tv.includes('놀이터 맨 아래 → 교실 게임 참가') && !tv.includes('야차전 → 게임 → 교실 게임 참가'),
    'V13.199 교실 게임 열기 창: 함께할 학교 · 학교마다 범위, 학생 참가 안내는 "놀이터 맨 아래"(예전 "야차전 → 게임" 문구를 고침)');
}
