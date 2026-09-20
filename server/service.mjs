import { randomUUID, randomBytes } from 'node:crypto';
import builtinBooksData from '../data/vocabulary.json' with { type: 'json' };
import { EXAM_TYPES, PRACTICE_TYPES, CHARACTERS, ACCESSORIES, FRAMES, TITLES, unlocked, growthFor, buildQuestion, choosePracticeWord, shuffle, grade, clamp, dayKey, displayEnglish } from '../public/modules/core.js';
import { passwordHash, verifyPassword, hashToken, publicProfile, supabaseLogin } from './auth.mjs';
import { seonbu44Correction } from './seonbu44-correction.mjs';
export const builtinBooks = builtinBooksData;
const withoutLegacySeonbu44 = book => {
  const isSeonbu = book.school_id === 'seonbu-high' || book.school === '선부고';
  if (!isSeonbu || !Array.isArray(book.words) || !book.words.some(word => String(word.range_code) === '44')) return book;
  return { ...book, words: book.words.filter(word => String(word.range_code) !== '44') };
};
const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };
const requireRole = (p, role) => { if (p.role !== role) fail('이 기능을 사용할 권한이 없습니다.', 403); };
const integer = (n, min, max, label) => { if (!Number.isInteger(Number(n)) || Number(n) < min || Number(n) > max) fail(`${label}을 확인해주세요.`); return Number(n); };
const str = (s, max = 120) => typeof s === 'string' ? s.trim().slice(0, max) : '';
const safeGrammarAnswers = value => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const entries = Object.entries(value).slice(0, 400);
  const safe = {};
  for (const [key, answer] of entries) {
    if (!/^\d+:\d+$/.test(key) || typeof answer !== 'string' || answer.length > 160) continue;
    safe[key] = answer;
  }
  return safe;
};
const safeGrammarIndexes = (value, max = 120) => Array.isArray(value)
  ? [...new Set(value.map(Number).filter(n => Number.isInteger(n) && n >= 0 && n < max))].slice(0, max)
  : [];
const safeGrammarKeys = value => Array.isArray(value)
  ? [...new Set(value.map(String).filter(key => /^\d+:\d+$/.test(key)))].slice(0, 400)
  : [];
const id = () => randomUUID();
const DIVISIONS = ['middle', 'high'];
const divisionLabel = division => division === 'middle' ? '중등부' : '고등부';
const divisionClassAllowed = (division, className) => division === 'middle' ? ['중2','중3'].includes(className) : ['고1A','고1B'].includes(className);
const schoolByRef = (state, value) => state.schools.find(s => s.active !== false && (s.id === value || s.name === value));
const schoolForProfile = (state, profile) => state.schools.find(s => s.id === profile.school_id);
const activeTeacherDivision = profile => DIVISIONS.includes(profile.active_division) ? profile.active_division : 'high';
const teacherSchools = (state, profile, division = activeTeacherDivision(profile)) => state.schools.filter(s => s.active !== false && s.division === division && profile.school_ids?.includes(s.id));
const activeTeacherSchool = (state, profile) => teacherSchools(state, profile).find(s => s.id === profile.active_school_id) || teacherSchools(state, profile)[0];
const sameSchool = (record, school) => !!record && !!school && record.school_id === school.id;
const wordForGrade = (state, word) => ({ ...word, accepted_meanings: state.meaningAliases?.[word.id] || [] });
const normalizeDisputeAnswer = value => String(value ?? '').normalize('NFKC').toLowerCase().replace(/[~～·•・.,;:!?()[\]{}"'‘’“”]/g, '').replace(/\s+/g, '').trim();
const findWord = (state, wordId) => allBooks(state).flatMap(book => book.words || []).find(word => word.id === wordId);
const addMeaningAlias = (state, wordId, alias) => {
  const value = str(alias, 80);
  if (!value) fail('허용할 뜻을 입력해주세요.');
  state.meaningAliases ??= {};
  state.meaningAliases[wordId] ??= [];
  if (!state.meaningAliases[wordId].some(item => normalizeDisputeAnswer(item) === normalizeDisputeAnswer(value))) state.meaningAliases[wordId].push(value);
  return state.meaningAliases[wordId];
};
function regradeMeaningDispute(state, dispute) {
  if (!dispute || dispute.regraded_at) return;
  if (dispute.source_type === 'exam') {
    const attempt = state.examAttempts.find(item => item.id === dispute.source_id && item.student_id === dispute.student_id);
    const index = Number(dispute.question_index);
    const detail = attempt?.details?.[index];
    if (attempt?.status === 'submitted' && detail && detail.type === 'write_meaning' && !detail.correct) {
      detail.correct = true;
      detail.corrected_by_dispute = true;
      attempt.correct = attempt.details.filter(item => item.correct).length;
      attempt.score = Math.round(attempt.correct / Math.max(1, attempt.details.length) * 100);
      attempt.regraded_at = Date.now();
    }
  } else if (dispute.source_type === 'practice') {
    const mastery = state.mastery?.[dispute.student_id]?.[dispute.word_id];
    if (mastery) {
      mastery.wrong = Math.max(0, Number(mastery.wrong || 0) - 1);
      mastery.correct = Number(mastery.correct || 0) + 1;
      mastery.mastery = clamp(Number(mastery.mastery || 0) + 18, 0, 100);
      mastery.last_seen = Date.now();
    }
    const practice = state.practices.find(item => item.id === dispute.source_id && item.student_id === dispute.student_id);
    if (practice && !practice.finished) {
      practice.correct = Math.min(practice.total, Number(practice.correct || 0) + 1);
      practice.xp = Number(practice.xp || 0) + 20;
      const retryIndex = practice.retry?.findIndex(item => item.id === dispute.word_id) ?? -1;
      if (retryIndex >= 0) practice.retry.splice(retryIndex, 1);
    }
    const session = state.sessions.find(item => item.id === dispute.source_id && item.student_id === dispute.student_id);
    if (session) {
      session.correct = Math.min(session.total, Number(session.correct || 0) + 1);
      session.xp = Number(session.xp || 0) + 20;
      session.regraded_at = Date.now();
    }
  }
  dispute.regraded_at = Date.now();
}
function autoResolveMeaningDisputes(state) {
  let resolved = 0;
  const now = Date.now();
  for (const dispute of state.meaningDisputes || []) {
    if (dispute.status !== 'pending') continue;
    const word = findWord(state, dispute.word_id);
    if (!word || !grade('write_meaning', dispute.answer, wordForGrade(state, word))) continue;
    regradeMeaningDispute(state, dispute);
    dispute.status = 'approved_auto';
    dispute.resolved_at = now;
    dispute.resolved_by = 'system';
    dispute.resolution_note = '기본 유효답 자동 인정';
    resolved++;
  }
  return resolved;
}
function wordRangeMastery(state, studentId, school) {
  if (!school) return { ranges: {}, mastered: 0, perfect: 0, total_ranges: 0, conquest: 0 };
  const words = allBooks(state).filter(book => book.school_id === school.id).flatMap(book => book.words || []);
  const grouped = new Map();
  for (const word of words) {
    const code = String(word.range_code || '');
    if (!code) continue;
    if (!grouped.has(code)) grouped.set(code, new Map());
    grouped.get(code).set(word.id, word);
  }
  const mastery = state.mastery?.[studentId] || {};
  const ranges = {};
  let mastered = 0, perfect = 0, conquestTotal = 0;
  for (const [code, map] of grouped) {
    const list = [...map.values()];
    let attempted = 0, correct = 0, totalAnswers = 0;
    for (const word of list) {
      const record = mastery[word.id];
      const tries = Number(record?.correct || 0) + Number(record?.wrong || 0);
      if (tries > 0) attempted++;
      correct += Number(record?.correct || 0);
      totalAnswers += tries;
    }
    const accuracy = totalAnswers ? Math.round(correct / totalAnswers * 100) : 0;
    const coverage = list.length ? Math.round(attempted / list.length * 100) : 0;
    let status = 'quest';
    if (attempted > 0 && accuracy <= 70) status = 'needs_work';
    else if (attempted < list.length) status = attempted ? 'in_progress' : 'quest';
    else if (accuracy === 100) status = 'perfect';
    else if (accuracy >= 95) status = 'master';
    else status = 'conquering';
    if (status === 'master' || status === 'perfect') mastered++;
    if (status === 'perfect') perfect++;
    const conquest = Math.round(accuracy * (coverage / 100));
    conquestTotal += conquest;
    ranges[code] = { range_code: code, total: list.length, attempted, accuracy, coverage, conquest, status };
  }
  return { ranges, mastered, perfect, total_ranges: grouped.size, conquest: grouped.size ? Math.round(conquestTotal / grouped.size) : 0 };
}
export function allBooks(state) { return [...builtinBooks.map(withoutLegacySeonbu44), seonbu44Correction, ...state.extraBooks]; }
export function scopedWords(state, schoolRef, ranges) {
  const school = schoolByRef(state, schoolRef);
  if (!school || !Array.isArray(ranges) || !ranges.length) fail('학교와 범위를 선택해주세요.');
  const words = allBooks(state).filter(b => sameSchool(b, school)).flatMap(b => b.words);
  if (!ranges.every(r => words.some(w => w.range_code === String(r)))) fail('선택한 범위를 찾을 수 없습니다.');
  return words.filter(w => ranges.map(String).includes(w.range_code));
}
function mySessions(state, student) { return state.sessions.filter(s => s.student_id === student); }
function stats(state, p, sessions = mySessions(state, p.id)) {
  const today = sessions.filter(s => dayKey(s.created_at) === dayKey(Date.now()));
  const recent = [...sessions].sort((a, b) => b.created_at - a.created_at).slice(0, 20);
  const total = recent.reduce((n, s) => n + s.total, 0), correct = recent.reduce((n, s) => n + s.correct, 0);
  return { ...growthFor(sessions), today_total: today.reduce((n, s) => n + s.total, 0), today_xp: today.reduce((n, s) => n + s.xp, 0), practice_count: sessions.length, accuracy: total ? Math.round(correct / total * 100) : 0, weak: Object.values(state.mastery[p.id] || {}).filter(m => m.wrong > 0 && m.mastery < 80).length };
}
function attemptView(a, state, profile) {
  const exam = state.exams.find(e => e.id === a.exam_id);
  const reveal = a.status === 'submitted' && (profile.role === 'teacher' || exam?.release_result);
  return { id: a.id, exam_id: a.exam_id, student_id: a.student_id, status: a.status, started_at: a.started_at, deadline: a.deadline, submitted_at: a.submitted_at, auto_submitted: a.auto_submitted, total: a.questions.length,
    ...(a.status === 'active' ? { questions: a.questions, answers: a.answers, revision: a.revision, lease: a.lease } : {}),
    ...(reveal ? { score: a.score, correct: a.correct, details: a.details } : {}) };
}
function attemptSummary(a, state, profile) {
  const view = attemptView(a, state, profile);
  if (a.status === 'active' && profile.role === 'student') return view;
  const { questions, answers, details, lease, revision, ...summary } = view;
  return summary;
}
function finishExam(a, state, auto = false) {
  if (a.status === 'submitted') return;
  let correct = 0;
  a.details = a.questions.map((q, i) => { const w = a.keys[i], answer = a.answers[i] || '', ok = grade(q.type, answer, wordForGrade(state, w)); if (ok) correct++; return { number: i + 1, word_id: w.id, type: q.type, word: displayEnglish(w.word), meaning: w.meaning, answer, correct: ok }; });
  a.correct = correct; a.score = Math.round(correct / a.questions.length * 100); a.status = 'submitted';
  a.submitted_at = Date.now(); a.auto_submitted = auto; a.lease = null;
}
export function sweep(state) {
  let changed = false;
  for (const a of state.examAttempts) if (a.status === 'active' && a.deadline <= Date.now()) { finishExam(a, state, true); changed = true; }
  if (autoResolveMeaningDisputes(state) > 0) changed = true;
  const tokens = state.tokens.filter(t => t.expires_at > Date.now());
  if (tokens.length !== state.tokens.length) { state.tokens = tokens; changed = true; }
  return changed;
}
export async function service(state, method, path, body, token) {
  if (path === '/health') return { ok: true, version: '13.11.0', schema_version: state.schema_version, ready: state.profiles.some(p => p.role === 'teacher') || process.env.AUTH_PROVIDER === 'supabase' };
  if (path === '/session' && method === 'GET') { const auth = state.tokens.find(t => t.hash === hashToken(token || '') && t.expires_at > Date.now()); return { authenticated: state.profiles.some(p => p.id === auth?.user_id && p.active) }; }
  if (path === '/login' && method === 'POST') {
    let p, supabaseAccessToken;
    if (process.env.AUTH_PROVIDER === 'supabase') {
      const result = await supabaseLogin(str(body.username), String(body.password || '')); p = result.profile; supabaseAccessToken = result.accessToken;
      const old = state.profiles.find(x => x.id === p.id);
      if (old) { const style = Object.fromEntries(['avatar_key', 'avatar_accessory', 'avatar_frame', 'avatar_title'].filter(k => old[k]).map(k => [k, old[k]])); Object.assign(old, p, style); p = old; }
      else state.profiles.push(p);
    } else {
      p = state.profiles.find(p => p.username === str(body.username).toLowerCase() && p.active);
      if (!(await verifyPassword(String(body.password || ''), p?.password_hash))) fail('아이디 또는 비밀번호를 확인해주세요.', 401);
    }
    if (p.role === 'teacher') {
      if (!Array.isArray(p.school_ids) || !p.school_ids.length) p.school_ids = state.schools.filter(s => s.active !== false).map(s => s.id);
      p.division_ids = Array.isArray(p.division_ids) && p.division_ids.length ? p.division_ids : ['middle','high'];
      const requestedDivision = DIVISIONS.includes(body.division) ? body.division : activeTeacherDivision(p);
      if (!p.division_ids.includes(requestedDivision)) fail('담당 부서를 확인해주세요.', 403);
      p.active_division = requestedDivision;
      const selectedTeacherSchool = activeTeacherSchool(state, p);
      if (!selectedTeacherSchool) fail('이 부서에 등록된 학교가 없습니다.', 409);
      p.active_school_id = selectedTeacherSchool.id;
    }
    if (p.role !== body.role) fail('학생 / 교사 선택을 확인해주세요.', 403);
    if (p.role === 'student') {
      const school = schoolForProfile(state, p);
      const division = p.division || school?.division || (/^중/.test(p.class_name || '') ? 'middle' : 'high');
      p.division = division;
      if (DIVISIONS.includes(body.division) && body.division !== division) fail(`${divisionLabel(division)} 계정입니다. ${divisionLabel(division)}로 로그인해주세요.`, 403);
    }
    const raw = randomBytes(32).toString('base64url');
    state.tokens.push({ hash: hashToken(raw), user_id: p.id, expires_at: Date.now() + (supabaseAccessToken ? 3500000 : 7 * 86400000), ...(supabaseAccessToken ? { supabase_access_token: supabaseAccessToken } : {}) });
    return { profile: publicProfile(p), _cookie: raw };
  }
  const auth = state.tokens.find(t => t.hash === hashToken(token || '') && t.expires_at > Date.now());
  const p = state.profiles.find(p => p.id === auth?.user_id && p.active);
  if (!p) fail('다시 로그인해주세요.', 401);
  if (path === '/logout') { state.tokens = state.tokens.filter(t => t !== auth); return { ok: true, _clearCookie: true }; }
  const teacher = p.role === 'teacher';
  if (path === '/bootstrap') {
    const studentSchool = schoolForProfile(state, p);
    const selectedDivision = teacher ? activeTeacherDivision(p) : (p.division || studentSchool?.division || 'high');
    const selectedSchool = teacher ? activeTeacherSchool(state, p) : studentSchool;
    if (!selectedSchool) fail('학교 설정을 확인해주세요.', 409);
    if (selectedSchool.division !== selectedDivision) fail('중등부/고등부 학교 설정을 확인해주세요.', 409);
    const visibleExams = state.exams.filter(e => e.division === selectedDivision && (teacher ? sameSchool(e, selectedSchool) : (e.class_name === p.class_name && sameSchool(e, studentSchool) && e.active)));
    const visibleExamIds = new Set(visibleExams.map(e => e.id));
    const studentProfiles = state.profiles.filter(x => x.role === 'student' && x.division === selectedDivision && (!teacher || x.school_id === selectedSchool.id));
    const studentIds = new Set(studentProfiles.map(s => s.id));
    const sessions = state.sessions.filter(s => s.division === selectedDivision && sameSchool(s, selectedSchool) && (teacher ? studentIds.has(s.student_id) : s.student_id === p.id)).sort((a, b) => b.created_at - a.created_at);
    const sessionsByStudent = new Map();
    if (teacher) for (const session of sessions) {
      if (!sessionsByStudent.has(session.student_id)) sessionsByStudent.set(session.student_id, []);
      sessionsByStudent.get(session.student_id).push(session);
    }
    const attempts = state.examAttempts.filter(a => teacher ? visibleExamIds.has(a.exam_id) : a.student_id === p.id);
    const books = allBooks(state).filter(b => sameSchool(b, selectedSchool));
    const schools = (teacher ? teacherSchools(state, p, selectedDivision) : [selectedSchool]).filter(Boolean).map(s => ({ id: s.id, name: s.name, full_name: s.full_name, division: s.division }));
    const profile = { ...publicProfile(p), division: selectedDivision, ...(teacher && selectedSchool ? { active_division: selectedDivision, active_school_id: selectedSchool.id, active_school: selectedSchool.name } : {}) };
    const meaningDisputes = state.meaningDisputes.filter(item => teacher ? (item.school_id === selectedSchool.id && item.division === selectedDivision) : item.student_id === p.id).sort((a, b) => b.created_at - a.created_at);
    const grammarProgress = teacher
      ? Object.fromEntries([...studentIds].map(studentId => [studentId, state.grammarProgress?.[studentId] || {}]))
      : (state.grammarProgress?.[p.id] || {});
    const wordMastery = teacher
      ? Object.fromEntries([...studentIds].map(studentId => [studentId, wordRangeMastery(state, studentId, selectedSchool)]))
      : wordRangeMastery(state, p.id, selectedSchool);
    return { profile, divisions: teacher ? ['middle','high'] : [selectedDivision], schools, books, stats: stats(state, p, sessions), mastery: state.mastery[p.id] || {}, word_mastery: wordMastery, grammar_progress: grammarProgress, meaning_aliases: teacher ? state.meaningAliases : {}, meaning_disputes: meaningDisputes,
      profiles: teacher ? studentProfiles.map(s => ({ ...publicProfile(s), stats: stats(state, s, sessionsByStudent.get(s.id) || []) })) : [],
      sessions, exams: visibleExams,
      assignments: state.assignments.filter(a => teacher ? sameSchool(a, selectedSchool) : (a.class_name === p.class_name && sameSchool(a, studentSchool) && a.active)),
      attempts: attempts.map(a => attemptSummary(a, state, p)), server_time: Date.now(),
      active_practice: state.practices.find(x => x.student_id === p.id && !x.finished)?.id || null,
      ranking: teacher ? [] : state.profiles.filter(x => x.active && x.role === 'student').map(s => {
        const records = mySessions(state, s.id), weekly = records.filter(r => r.created_at >= Date.now() - 7 * 86400000);
        const g = growthFor(records), isMe = s.id === p.id;
        const hidden = !isMe && (s.ranking_public === false || s.share_profile === false);
        const grade = /^중2/.test(s.class_name || '') ? '중2' : /^중3/.test(s.class_name || '') ? '중3' : /^고1/.test(s.class_name || '') ? '고1' : (s.division === 'middle' ? '중등' : '고등');
        return { id: hidden ? null : s.id, is_me: isMe, private: hidden, grade, division: s.division || (grade.startsWith('중') ? 'middle' : 'high'), display_name: hidden ? '비공개 학생' : s.display_name, avatar_key: hidden ? 'lumi' : (s.avatar_key || 'lumi'), level: hidden ? 1 : g.level, streak: g.streak, xp: weekly.reduce((n, r) => n + r.xp, 0), total: weekly.reduce((n, r) => n + r.total, 0) };
      })
    };
  }
  if (path === '/teacher/division' && method === 'PATCH') {
    requireRole(p, 'teacher');
    const division = str(body.division, 12);
    if (!DIVISIONS.includes(division) || !p.division_ids?.includes(division)) fail('담당 부서를 확인해주세요.', 403);
    const schools = teacherSchools(state, p, division);
    if (!schools.length) fail('이 부서에 등록된 학교가 없습니다.', 409);
    p.active_division = division;
    p.active_school_id = schools[0].id;
    return { active_division: division, active_school_id: schools[0].id, active_school: schools[0].name };
  }
  if (path === '/teacher/school' && method === 'PATCH') {
    requireRole(p, 'teacher');
    const school = schoolByRef(state, body.school_id || body.school);
    if (!school || !p.school_ids?.includes(school.id) || school.division !== activeTeacherDivision(p)) fail('현재 부서의 담당 학교를 확인해주세요.', 403);
    p.active_school_id = school.id;
    return { active_division: activeTeacherDivision(p), active_school_id: school.id, active_school: school.name };
  }
  if (path === '/profile/password' && method === 'PATCH') {
    if (process.env.AUTH_PROVIDER === 'supabase') fail('현재 로그인 방식에서는 계정 관리 화면에서 비밀번호를 변경해주세요.', 409);
    const currentPassword = String(body.current_password || '');
    const nextPassword = String(body.new_password || '');
    if (!(await verifyPassword(currentPassword, p.password_hash))) fail('현재 비밀번호가 맞지 않습니다.', 401);
    if (nextPassword.length < 8 || nextPassword.length > 128) fail('새 비밀번호는 8~128자로 입력해주세요.');
    if (await verifyPassword(nextPassword, p.password_hash)) fail('현재 비밀번호와 다른 새 비밀번호를 입력해주세요.');
    p.password_hash = await passwordHash(nextPassword);
    state.tokens = state.tokens.filter(item => item.user_id !== p.id || item === auth);
    return { ok: true };
  }
  if (/^\/grammar-progress\/[^/]+$/.test(path) && method === 'PATCH') {
    requireRole(p, 'student');
    state.grammarProgress ??= {};
    state.grammarProgress[p.id] ??= {};
    const passageId = decodeURIComponent(path.split('/')[2] || '');
    if (!/^[a-z0-9~._-]{3,80}$/i.test(passageId)) fail('지문 정보를 확인해주세요.');
    if (body.reset === true) {
      delete state.grammarProgress[p.id][passageId];
      return { ok: true, passage_id: passageId, reset: true };
    }
    const school = schoolForProfile(state, p);
    const sentenceCount = integer(body.sentence_count, 1, 120, '문장 수');
    const choiceCount = integer(body.choice_count, 1, 500, '선택지 수');
    const completedSentences = integer(body.completed_sentences ?? 0, 0, sentenceCount, '완료 문장 수');
    const activeSentenceIndex = integer(body.active_sentence_index ?? 0, 0, Math.max(0, sentenceCount - 1), '현재 문장');
    const firstRate = body.first_rate == null ? null : integer(body.first_rate, 0, 100, '1차 정답률');
    const progress = {
      passage_id: passageId,
      division: p.division || school?.division || 'high',
      school_id: school?.id || p.school_id || null,
      school: school?.name || p.school || null,
      sentence_count: sentenceCount,
      choice_count: choiceCount,
      completed_sentences: completedSentences,
      active_sentence_index: activeSentenceIndex,
      graded_sentences: safeGrammarIndexes(body.graded_sentences, sentenceCount),
      answers: safeGrammarAnswers(body.answers),
      wrong_keys: safeGrammarKeys(body.wrong_keys),
      first_rate: firstRate,
      first_wrong: integer(body.first_wrong ?? 0, 0, choiceCount, '1차 오답 수'),
      recall_attempts: integer(body.recall_attempts ?? 0, 0, 5000, '오답 리콜 횟수'),
      mastered: body.mastered === true,
      updated_at: Date.now()
    };
    state.grammarProgress[p.id][passageId] = progress;
    return progress;
  }
  if (path === '/profile/school' && method === 'PATCH') {
    requireRole(p, 'student');
    fail('학교 변경은 선생님에게 요청해주세요.', 403);
  }
  if (path === '/profile/style' && method === 'POST') {
    const growth = stats(state, p);
    if (!CHARACTERS[body.avatar_key] || !unlocked(ACCESSORIES[body.avatar_accessory], growth) || !unlocked(FRAMES[body.avatar_frame], growth) || !unlocked(TITLES[body.avatar_title], growth)) fail('아직 열리지 않은 보상입니다.');
    Object.assign(p, { avatar_key: body.avatar_key, avatar_accessory: body.avatar_accessory, avatar_frame: body.avatar_frame, avatar_title: body.avatar_title });
    return publicProfile(p);
  }
  if (path === '/students' && method === 'POST') {
    requireRole(p, 'teacher');
    const school = schoolByRef(state, body.school_id || body.school);
    if (!school || !p.school_ids?.includes(school.id) || school.division !== activeTeacherDivision(p)) fail('현재 부서의 담당 학교를 확인해주세요.', 403);
    if (process.env.AUTH_PROVIDER === 'supabase') {
      const response = await fetch(process.env.SUPABASE_URL + '/functions/v1/create-student', { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: process.env.SUPABASE_ANON_KEY, Authorization: 'Bearer ' + auth.supabase_access_token }, body: JSON.stringify({ username: body.username, password: body.password, display_name: body.display_name, class_name: body.class_name, school: school.name, school_id: school.id, division: school.division }), signal: AbortSignal.timeout(12000) });
      const result = await response.json(); if (!response.ok || result.error) fail(result.error || '기존 계정 생성 함수 연결을 확인해주세요.');
      const profiles = await fetch(process.env.SUPABASE_URL + '/rest/v1/profiles?username=eq.' + encodeURIComponent(str(body.username).toLowerCase()) + '&select=*', { headers: { apikey: process.env.SUPABASE_ANON_KEY, Authorization: 'Bearer ' + auth.supabase_access_token }, signal: AbortSignal.timeout(10000) });
      if (!profiles.ok) fail('계정은 생성됐지만 학생 목록을 불러오지 못했어요. 연결을 확인해주세요.');
      const [created] = await profiles.json(); if (created && !state.profiles.some(s => s.id === created.id)) state.profiles.push({ ...publicProfile(created), division: school.division });
      return { ok: true };
    }
    const username = str(body.username, 40).toLowerCase();
    if (!/^[a-z0-9_.-]{3,40}$/.test(username)) fail('아이디는 영문·숫자 3~40자로 입력해주세요.');
    if (state.profiles.some(p => p.username === username)) fail('이미 사용 중인 아이디입니다.');
    if (String(body.password || '').length < 8 || String(body.password).length > 128) fail('비밀번호는 8~128자로 입력해주세요.');
    if (!str(body.display_name) || !str(body.class_name)) fail('이름, 반, 학교를 확인해주세요.');
    if (!divisionClassAllowed(school.division, str(body.class_name, 30))) fail(`${divisionLabel(school.division)} 반을 선택해주세요.`);
    const student = { id: id(), role: 'student', username, password_hash: await passwordHash(body.password), display_name: str(body.display_name, 40), class_name: str(body.class_name, 30), division: school.division, school_id: school.id, school: school.name, active: true, created_at: Date.now() };
    state.profiles.push(student); return publicProfile(student);
  }
  if (/^\/students\/[^/]+$/.test(path) && method === 'PATCH') {
    requireRole(p, 'teacher'); const student = state.profiles.find(s => s.id === path.split('/')[2] && s.role === 'student');
    if (!student) fail('학생을 찾을 수 없습니다.', 404);
    const currentSchool = schoolForProfile(state, student);
    if (!currentSchool || !p.school_ids?.includes(currentSchool.id) || currentSchool.division !== activeTeacherDivision(p)) fail('현재 부서의 담당 학생만 변경할 수 있습니다.', 403);
    const nextSchool = body.school_id || body.school ? schoolByRef(state, body.school_id || body.school) : currentSchool;
    if (!nextSchool || !p.school_ids?.includes(nextSchool.id) || nextSchool.division !== activeTeacherDivision(p)) fail('현재 부서의 담당 학교를 확인해주세요.', 403);
    const nextClass = str(body.class_name, 30) || student.class_name;
    if (!divisionClassAllowed(nextSchool.division, nextClass)) fail(`${divisionLabel(nextSchool.division)} 반을 선택해주세요.`);
    if (typeof body.active === 'boolean') student.active = body.active;
    student.class_name = nextClass;
    if (student.school_id !== nextSchool.id) {
      for (const practice of state.practices.filter(item => item.student_id === student.id && !item.finished)) finishPractice(practice, state);
      student.division = nextSchool.division;
      student.school_id = nextSchool.id;
      student.school = nextSchool.name;
      state.tokens = state.tokens.filter(tokenItem => tokenItem.user_id !== student.id);
    }
    if (body.password) { if (process.env.AUTH_PROVIDER === 'supabase') fail('기존 Supabase 계정 관리에서 변경해주세요.'); if (body.password.length < 8) fail('비밀번호는 8자 이상 입력해주세요.'); student.password_hash = await passwordHash(body.password); state.tokens = state.tokens.filter(t => t.user_id !== student.id); }
    return publicProfile(student);
  }
  if (/^\/students\/[^/]+$/.test(path) && method === 'DELETE') {
    requireRole(p, 'teacher');
    const studentId = path.split('/')[2];
    const student = state.profiles.find(s => s.id === studentId && s.role === 'student');
    if (!student) fail('학생을 찾을 수 없습니다.', 404);
    const currentSchool = schoolForProfile(state, student);
    if (!currentSchool || !p.school_ids?.includes(currentSchool.id) || currentSchool.division !== activeTeacherDivision(p)) fail('현재 부서의 담당 학생만 삭제할 수 있습니다.', 403);
    state.profiles = state.profiles.filter(item => item.id !== studentId);
    state.tokens = state.tokens.filter(item => item.user_id !== studentId);
    state.sessions = state.sessions.filter(item => item.student_id !== studentId);
    state.practices = state.practices.filter(item => item.student_id !== studentId);
    state.examAttempts = state.examAttempts.filter(item => item.student_id !== studentId);
    delete state.mastery[studentId];
    if (state.grammarProgress) delete state.grammarProgress[studentId];
    state.meaningDisputes = state.meaningDisputes.filter(item => item.student_id !== studentId);
    return { ok: true, id: studentId };
  }
  if (/^\/meaning-aliases\/[^/]+$/.test(path) && method === 'POST') {
    requireRole(p, 'teacher');
    const wordId = decodeURIComponent(path.split('/')[2] || '');
    const school = activeTeacherSchool(state, p);
    const word = allBooks(state).filter(book => sameSchool(book, school)).flatMap(book => book.words || []).find(item => item.id === wordId);
    if (!word) fail('현재 학교의 단어를 찾을 수 없습니다.', 404);
    const alias = str(body.alias, 80);
    const aliases = addMeaningAlias(state, wordId, alias);
    const normalized = normalizeDisputeAnswer(alias);
    const now = Date.now();
    let regraded = 0;
    for (const dispute of state.meaningDisputes.filter(item => item.status === 'pending' && item.school_id === school.id && item.word_id === wordId && item.answer_normalized === normalized)) {
      regradeMeaningDispute(state, dispute);
      dispute.status = 'approved_global';
      dispute.resolved_at = now;
      dispute.resolved_by = p.id;
      regraded++;
    }
    return { word_id: wordId, aliases, regraded };
  }
  if (/^\/meaning-aliases\/[^/]+$/.test(path) && method === 'DELETE') {
    requireRole(p, 'teacher');
    const wordId = decodeURIComponent(path.split('/')[2] || '');
    if (state.meaningAliases) delete state.meaningAliases[wordId];
    return { word_id: wordId, aliases: [] };
  }
  if (path === '/meaning-disputes' && method === 'POST') {
    requireRole(p, 'student');
    const school = schoolForProfile(state, p);
    if (!school) fail('학교 설정을 확인해주세요.', 409);
    const sourceType = str(body.source_type, 12);
    const sourceId = str(body.source_id, 80);
    let word, submittedAnswer, sourceKey, questionIndex = null, questionId = null;
    if (sourceType === 'exam') {
      const attempt = state.examAttempts.find(item => item.id === sourceId && item.student_id === p.id && item.status === 'submitted');
      if (!attempt) fail('시험 답안을 찾을 수 없습니다.', 404);
      const exam = state.exams.find(item => item.id === attempt.exam_id);
      if (!exam || !sameSchool(exam, school) || exam.exam_type !== 'write_meaning') fail('뜻쓰기 시험에서만 이의제기할 수 있어요.', 403);
      questionIndex = integer(body.question_index, 0, Math.max(0, attempt.questions.length - 1), '문항 번호');
      const detail = attempt.details?.[questionIndex];
      word = attempt.keys?.[questionIndex] || findWord(state, detail?.word_id);
      submittedAnswer = detail?.answer || attempt.answers?.[questionIndex] || '';
      if (!word || detail?.correct || !submittedAnswer) fail('오답으로 채점된 뜻쓰기 답안만 이의제기할 수 있어요.', 409);
      sourceKey = String(questionIndex);
    } else if (sourceType === 'practice') {
      const practice = state.practices.find(item => item.id === sourceId && item.student_id === p.id);
      if (!practice || practice.school_id !== school.id) fail('연습 답안을 찾을 수 없습니다.', 404);
      questionId = str(body.question_id, 100);
      const response = practice.responses?.[questionId];
      const feedback = response?.feedback;
      if (!feedback || feedback.ok || feedback.type !== 'write_meaning' || !feedback.word_id || !feedback.answer) fail('오답으로 채점된 뜻쓰기 답안만 이의제기할 수 있어요.', 409);
      word = findWord(state, feedback.word_id);
      submittedAnswer = feedback.answer;
      sourceKey = questionId;
    } else fail('뜻쓰기 답안 정보를 확인해주세요.');
    if (!word || !submittedAnswer) fail('이의제기할 답안을 확인해주세요.');
    const duplicate = state.meaningDisputes.find(item => item.student_id === p.id && item.source_type === sourceType && item.source_id === sourceId && item.source_key === sourceKey);
    if (duplicate) return duplicate;
    const dispute = {
      id: id(), student_id: p.id, division: p.division || school.division, school_id: school.id, school: school.name,
      class_name: p.class_name, source_type: sourceType, source_id: sourceId, source_key: sourceKey,
      ...(questionIndex !== null ? { question_index: questionIndex } : {}), ...(questionId ? { question_id: questionId } : {}),
      word_id: word.id, word: displayEnglish(word.word), meaning: word.meaning, answer: str(submittedAnswer, 160),
      answer_normalized: normalizeDisputeAnswer(submittedAnswer), status: 'pending', created_at: Date.now()
    };
    state.meaningDisputes.push(dispute);
    if (grade('write_meaning', dispute.answer, wordForGrade(state, word))) {
      regradeMeaningDispute(state, dispute);
      dispute.status = 'approved_auto';
      dispute.resolved_at = Date.now();
      dispute.resolved_by = 'system';
      dispute.resolution_note = '기본 유효답 자동 인정';
    }
    return dispute;
  }
  if (/^\/meaning-disputes\/[^/]+\/resolve$/.test(path) && method === 'PATCH') {
    requireRole(p, 'teacher');
    const disputeId = path.split('/')[2];
    const dispute = state.meaningDisputes.find(item => item.id === disputeId);
    const school = activeTeacherSchool(state, p);
    if (!dispute || !school || dispute.school_id !== school.id || dispute.division !== activeTeacherDivision(p)) fail('현재 학교의 이의제기를 찾을 수 없습니다.', 404);
    if (dispute.status !== 'pending') return { dispute, resolved: 0 };
    const action = str(body.action, 24);
    const now = Date.now();
    let targets = [dispute];
    if (action === 'approve_global' || action === 'reject') {
      targets = state.meaningDisputes.filter(item => item.status === 'pending' && item.school_id === dispute.school_id && item.word_id === dispute.word_id && item.answer_normalized === dispute.answer_normalized);
    }
    if (action === 'approve_global') addMeaningAlias(state, dispute.word_id, dispute.answer);
    if (!['approve_global','approve_once','reject'].includes(action)) fail('처리 방식을 선택해주세요.');
    let regraded = 0;
    for (const item of targets) {
      if (action !== 'reject') { regradeMeaningDispute(state, item); regraded++; }
      item.status = action === 'approve_global' ? 'approved_global' : action === 'approve_once' ? 'approved_once' : 'rejected';
      item.resolved_at = now;
      item.resolved_by = p.id;
    }
    return { dispute, resolved: targets.length, regraded, aliases: state.meaningAliases?.[dispute.word_id] || [] };
  }
  if ((path === '/exams' || path === '/assignments') && method === 'POST') {
    requireRole(p, 'teacher');
    const school = schoolByRef(state, body.school_id || body.school);
    if (!school || !p.school_ids?.includes(school.id) || school.division !== activeTeacherDivision(p)) fail('현재 부서의 담당 학교를 확인해주세요.', 403);
    const words = scopedWords(state, school.id, body.range_codes);
    if (!str(body.title) || !str(body.class_name)) fail('제목과 반을 입력해주세요.');
    if (!divisionClassAllowed(school.division, str(body.class_name, 30))) fail(`${divisionLabel(school.division)} 반을 선택해주세요.`);
    const due = Number(body.due_at); if (!Number.isFinite(due) || due <= Date.now()) fail('마감 시간을 확인해주세요.');
    const common = { id: id(), teacher_id: p.id, title: str(body.title), class_name: str(body.class_name, 30), division: school.division, school_id: school.id, school: school.name, range_codes: [...new Set(body.range_codes.map(String))], book_id: words[0].book_id, active: true, created_at: Date.now(), due_at: due };
    if (path === '/assignments') { const a = { ...common, target_questions: integer(body.target_questions, 5, 500, '목표 학습량') }; state.assignments.unshift(a); return a; }
    if (!EXAM_TYPES[body.exam_type]) fail('시험 유형을 선택해주세요.');
    const available = Number(body.available_at); if (!Number.isFinite(available) || available >= due) fail('시작 시간은 마감 시간보다 빨라야 합니다.');
    // The UI offers 10/20/30 or all words. Resolve "all" against the
    // selected school/ranges so the stored exam remains a concrete question
    // count for students and grading, while keeping numeric API callers
    // backwards-compatible.
    const questionCount = body.question_count === 'all'
      ? words.length
      : integer(body.question_count, 1, Math.min(500, words.length), '문제 수');
    const e = { ...common, exam_type: body.exam_type, question_count: questionCount, duration_sec: integer(body.duration_sec, 5, 10800, '제한시간'), available_at: available, passing_score: integer(body.passing_score, 0, 100, '통과 점수'), max_attempts: integer(body.max_attempts, 1, 10, '응시 횟수'), release_result: body.release_result === true };
    state.exams.unshift(e); return e;
  }
  if (/^\/exams\/[^/]+$/.test(path) && method === 'PATCH') {
    requireRole(p, 'teacher');
    const e = state.exams.find(e => e.id === path.split('/')[2]);
    if (!e) fail('시험을 찾을 수 없습니다.', 404);
    const school = activeTeacherSchool(state, p);
    if (!sameSchool(e, school)) fail('현재 관리 중인 학교의 시험이 아닙니다.', 403);
    const attempts = state.examAttempts.filter(attempt => attempt.exam_id === e.id);
    const locked = attempts.length > 0;
    if (typeof body.active === 'boolean') e.active = body.active;
    if (typeof body.release_result === 'boolean') e.release_result = body.release_result;
    if (str(body.title)) e.title = str(body.title);
    if (body.due_at !== undefined) {
      const due = Number(body.due_at);
      if (!Number.isFinite(due) || due <= Date.now()) fail('마감 시간을 확인해주세요.');
      e.due_at = due;
    }
    const structuralKeys = ['class_name','range_codes','exam_type','question_count','duration_sec','available_at','passing_score','max_attempts'];
    if (locked && structuralKeys.some(key => body[key] !== undefined)) fail('이미 응시 기록이 있어 문제 구성은 바꿀 수 없습니다. 수정본으로 복제해주세요.', 409);
    if (!locked) {
      const ranges = body.range_codes !== undefined ? [...new Set((body.range_codes || []).map(String))] : e.range_codes;
      const words = scopedWords(state, school.id, ranges);
      if (body.class_name !== undefined) {
        const nextClass = str(body.class_name, 30);
        if (!divisionClassAllowed(school.division, nextClass)) fail(`${divisionLabel(school.division)} 반을 선택해주세요.`);
        e.class_name = nextClass;
      }
      if (body.range_codes !== undefined) { e.range_codes = ranges; e.book_id = words[0].book_id; }
      if (body.exam_type !== undefined) { if (!EXAM_TYPES[body.exam_type]) fail('시험 유형을 선택해주세요.'); e.exam_type = body.exam_type; }
      if (body.question_count !== undefined) e.question_count = body.question_count === 'all' ? words.length : integer(body.question_count, 1, Math.min(500, words.length), '문제 수');
      if (body.duration_sec !== undefined) e.duration_sec = integer(body.duration_sec, 5, 10800, '제한시간');
      if (body.available_at !== undefined) {
        const available = Number(body.available_at);
        if (!Number.isFinite(available) || available >= e.due_at) fail('시작 시간은 마감 시간보다 빨라야 합니다.');
        e.available_at = available;
      }
      if (body.passing_score !== undefined) e.passing_score = integer(body.passing_score, 0, 100, '통과 점수');
      if (body.max_attempts !== undefined) e.max_attempts = integer(body.max_attempts, 1, 10, '응시 횟수');
    }
    e.updated_at = Date.now();
    return { ...e, edit_locked: locked };
  }
  if (/^\/exams\/[^/]+\/clone$/.test(path) && method === 'POST') {
    requireRole(p, 'teacher');
    const source = state.exams.find(e => e.id === path.split('/')[2]);
    if (!source) fail('시험을 찾을 수 없습니다.', 404);
    const school = activeTeacherSchool(state, p);
    if (!sameSchool(source, school)) fail('현재 관리 중인 학교의 시험이 아닙니다.', 403);
    const now = Date.now();
    const copy = { ...source, id: id(), title: str(body.title || source.title + ' · 수정본'), active: false, release_result: false, created_at: now, updated_at: now, available_at: now, due_at: now + 3 * 86400000 };
    state.exams.unshift(copy);
    return copy;
  }
  if (/^\/exams\/[^/]+$/.test(path) && method === 'DELETE') {
    requireRole(p, 'teacher');
    const examId = path.split('/')[2];
    const e = state.exams.find(item => item.id === examId);
    if (!e) fail('시험을 찾을 수 없습니다.', 404);
    if (!sameSchool(e, activeTeacherSchool(state, p))) fail('현재 관리 중인 학교의 시험이 아닙니다.', 403);
    if (state.examAttempts.some(attempt => attempt.exam_id === examId)) fail('응시 기록이 있는 시험은 삭제할 수 없습니다. 배정을 중지해주세요.', 409);
    state.exams = state.exams.filter(item => item.id !== examId);
    return { ok: true, id: examId };
  }
  if (path === '/exams/start' && method === 'POST') {
    requireRole(p, 'student');
    const studentSchool = schoolForProfile(state, p);
    const e = state.exams.find(e => e.id === body.exam_id && e.division === p.division && e.class_name === p.class_name && sameSchool(e, studentSchool) && e.active);
    if (!e) fail('배정된 시험이 아닙니다.', 403);
    const existing = state.examAttempts.find(a => a.exam_id === e.id && a.student_id === p.id && a.status === 'active');
    if (existing) { existing.lease = id(); return { attempt: attemptView(existing, state, p), exam: e, server_time: Date.now() }; }
    if (Date.now() < e.available_at || Date.now() >= e.due_at) fail('응시 가능한 시간이 아닙니다.');
    if (state.examAttempts.filter(a => a.exam_id === e.id && a.student_id === p.id).length >= e.max_attempts) fail('응시 횟수를 모두 사용했습니다.');
    const words = scopedWords(state, e.school_id, e.range_codes), chosen = shuffle(words).slice(0, e.question_count);
    const a = { id: id(), exam_id: e.id, student_id: p.id, status: 'active', started_at: Date.now(), deadline: Math.min(Date.now() + e.duration_sec * 1000, e.due_at), questions: chosen.map(w => buildQuestion(w, e.exam_type, words)), keys: chosen, answers: {}, revision: 0, lease: id() };
    state.examAttempts.push(a); return { attempt: attemptView(a, state, p), exam: e, server_time: Date.now() };
  }
  if (/^\/attempts\/[^/]+(?:\/(?:draft|submit))?$/.test(path)) {
    const a = state.examAttempts.find(a => a.id === path.split('/')[2] && (teacher || a.student_id === p.id)); if (!a) fail('응시 기록을 찾을 수 없습니다.', 404);
    if (teacher && !sameSchool(state.exams.find(e => e.id === a.exam_id), activeTeacherSchool(state, p))) fail('현재 관리 중인 학교의 응시 기록이 아닙니다.', 403);
    if (a.status === 'active' && method !== 'GET') {
      requireRole(p, 'student');
      if (body.lease !== a.lease) fail('다른 탭이나 기기에서 시험을 열었습니다. 시험 목록에서 다시 이어주세요.', 409);
      if (body.revision !== a.revision) fail('최신 답안을 다시 확인해주세요.', 409);
      if (body.answers && typeof body.answers === 'object') {
        for (const [key, value] of Object.entries(body.answers)) {
          const i = Number(key); if (!Number.isInteger(i) || i < 0 || i >= a.questions.length || typeof value !== 'string' || value.length > 500) fail('답안을 확인해주세요.');
          const q = a.questions[i]; if (q.options.length && value && !q.options.includes(value)) fail('유효하지 않은 선택지입니다.');
          a.answers[key] = value;
        }
        a.revision++;
      }
      if (path.endsWith('/submit')) finishExam(a, state, false);
    }
    return { attempt: attemptView(a, state, p), exam: state.exams.find(e => e.id === a.exam_id), server_time: Date.now() };
  }
  if (path === '/practice/start' && method === 'POST') {
    requireRole(p, 'student');
    const active = state.practices.find(x => x.student_id === p.id && !x.finished);
    if (active) return practiceView(active, state);
    const school = schoolForProfile(state, p);
    if (!school) fail('학생 학교 설정을 확인해주세요.', 409);
    if (body.school_id && body.school_id !== school.id) fail('현재 학교의 범위만 학습할 수 있어요.', 403);
    const words = scopedWords(state, school.id, body.range_codes);
    if (!PRACTICE_TYPES[body.mode]) fail('연습 방식을 선택해주세요.');
    const coverAll = body.cover_all === true;
    const x = { id: id(), student_id: p.id, division: p.division || school.division, school_id: school.id, school: school.name, range_codes: body.range_codes, mode: body.mode, assignment_id: null, target: coverAll ? words.length : integer(body.target || 10, 5, 500, '학습량'), cover_all: coverAll, seen: [], total: 0, correct: 0, xp: 0, combo: 0, best: 0, retry: [], last: null, started_at: Date.now(), finished: false, responses: {}, words: words.map(w => w.id) };
    if (body.assignment_id) { const a = state.assignments.find(a => a.id === body.assignment_id && a.class_name === p.class_name && a.active); if (a && sameSchool(a, school) && JSON.stringify([...a.range_codes].sort()) === JSON.stringify([...x.range_codes].sort())) x.assignment_id = a.id; }
    state.practices.push(x); nextPractice(x, state); return practiceView(x, state);
  }
  if (/^\/practice\/[^/]+(?:\/(?:answer|next|finish))?$/.test(path)) {
    requireRole(p, 'student'); const x = state.practices.find(x => x.id === path.split('/')[2] && x.student_id === p.id); if (!x) fail('연습을 찾을 수 없습니다.', 404);
    if (path.endsWith('/answer')) {
      if (x.responses[body.question_id]) return x.responses[body.question_id];
      if (x.finished || x.feedback || body.question_id !== x.question_id) fail('현재 문제를 다시 확인해주세요.', 409);
      const word = allBooks(state).flatMap(b => b.words).find(w => w.id === x.question.word_id);
      const ok = grade(x.question.type, body.answer, wordForGrade(state, word));
      x.total++; x.last = word.id;
      state.mastery[p.id] ??= {}; const m = state.mastery[p.id][word.id] ??= { mastery: 0, correct: 0, wrong: 0, streak: 0 };
      let gain = 0;
      if (ok) { x.correct++; x.combo++; x.best = Math.max(x.best, x.combo); gain = 20 + Math.min(x.combo, 10) * 3; x.xp += gain; m.correct++; m.streak++; m.mastery = clamp(m.mastery + (m.streak >= 3 ? 14 : 10), 0, 100); }
      else { x.combo = 0; m.wrong++; m.streak = 0; m.mastery = clamp(m.mastery - 8, 0, 100); if (!x.retry.some(r => r.id === word.id)) x.retry.push({ id: word.id, at: x.total + 2 }); }
      m.last_seen = Date.now(); m.next_review_at = Date.now() + (ok ? 3600000 + m.mastery * 864000 : 120000);
      x.feedback = { ok, gain, mastery: m.mastery, word_id: word.id, type: x.question.type, question_id: body.question_id, answer: str(body.answer, 160), word: displayEnglish(word.word), meaning: word.meaning, combo: x.combo, retry: !ok, can_dispute: !ok && x.question.type === 'write_meaning', milestone: ok && [5, 10].includes(x.combo) };
      const result = practiceView(x, state);
      // Prepare the following question in the same persisted mutation. The
      // client can still show this answer's feedback, then switch instantly
      // without a second database round trip.
      if (body.prefetch_next === true) {
        advancePractice(x, state);
        result.prefetched_next = practiceView(x, state);
      }
      x.responses[body.question_id] = structuredClone(result);
      const responseKeys = Object.keys(x.responses);
      while (responseKeys.length > 3) delete x.responses[responseKeys.shift()];
      return result;
    }
    if (path.endsWith('/next') && !x.finished && x.feedback) {
      advancePractice(x, state);
    }
    if (path.endsWith('/finish') && !x.finished) finishPractice(x, state);
    return practiceView(x, state);
  }
  fail('요청한 기능을 찾을 수 없습니다.', 404);
}
function advancePractice(x, state) {
  const covered = !x.cover_all || (x.seen?.length || 0) >= x.words.length;
  if (covered && x.total >= x.target && (!x.retry.length || x.total >= x.target + 12)) finishPractice(x, state);
  else nextPractice(x, state);
}
function nextPractice(x, state) {
  const words = allBooks(state).flatMap(b => b.words).filter(w => x.words.includes(w.id));
  x.seen ??= [];
  const unseen = x.cover_all ? words.filter(w => !x.seen.includes(w.id)) : [];
  const due = x.retry.findIndex(r => r.at <= x.total);
  let word;
  if (unseen.length) {
    word = choosePracticeWord(unseen, state.mastery[x.student_id] || {}, { ...x, retry: [] });
  } else if (due >= 0) {
    const retry = x.retry.splice(due, 1)[0];
    word = words.find(w => w.id === retry.id);
  } else word = choosePracticeWord(words, state.mastery[x.student_id] || {}, x);
  if (!x.seen.includes(word.id)) x.seen.push(word.id);
  const mode = x.mode === 'mixed' ? shuffle(Object.keys(PRACTICE_TYPES).filter(k => k !== 'mixed'))[0] : x.mode;
  x.question = buildQuestion(word, mode, words); x.question_id = id(); x.feedback = null;
}
function finishPractice(x, state) {
  x.finished = true; x.finished_at = Date.now();
  if (!x.total) return;
  const rec = { id: x.id, student_id: x.student_id, assignment_id: x.assignment_id, division: x.division, school_id: x.school_id, school: x.school, range_codes: x.range_codes, mode: x.mode, correct: x.correct, total: x.total, xp: x.xp, best_combo: x.best, duration_sec: Math.round((Date.now() - x.started_at) / 1000), created_at: Date.now() };
  if (!state.sessions.some(s => s.id === rec.id)) state.sessions.push(rec);
}
function practiceView(x, state) {
  return { id: x.id, school: x.school, mode: x.mode, target: x.target, cover_all: !!x.cover_all, covered: x.seen?.length || 0, total: x.total, correct: x.correct, xp: x.xp, combo: x.combo, best: x.best, question: x.question, question_id: x.question_id, feedback: x.feedback, finished: x.finished, retry_count: x.retry.length, stats: growthFor(mySessions(state, x.student_id)) };
}
