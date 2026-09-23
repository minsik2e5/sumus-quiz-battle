import { randomUUID, randomBytes } from 'node:crypto';
import builtinBooksData from '../data/vocabulary.json' with { type: 'json' };
import { EXAM_TYPES, PRACTICE_TYPES, PRACTICE_SECONDS_PER_QUESTION, CHARACTERS, ACCESSORIES, FRAMES, TITLES, unlocked, growthFor, buildQuestion, choosePracticeWord, shuffle, grade, clamp, dayKey, displayEnglish, practiceDurationSec } from '../public/modules/core.js';
import { passwordHash, verifyPassword, hashToken, publicProfile, supabaseLogin } from './auth.mjs';
import { seonbu44Correction } from './seonbu44-correction.mjs';
import { middleGrade3Books } from './middle-vocab.mjs';
import { middleGrade2Books } from './middle-vocab-grade2.mjs';
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
const MIDDLE_IMPORT_GRADES = ['중2', '중3'];
const hashText = value => {
  let hash = 2166136261;
  for (const char of String(value)) { hash ^= char.codePointAt(0); hash = Math.imul(hash, 16777619); }
  return (hash >>> 0).toString(36);
};
const importedWordId = (schoolId, grade, rangeCode, word) => `import:${schoolId}:${grade}:${rangeCode}:${hashText(String(word).normalize('NFKC').toLowerCase())}`;
function normalizeImportRows(rawRows) {
  if (!Array.isArray(rawRows)) fail('단어 파일 형식을 확인해주세요.');
  if (rawRows.length > 3000) fail('한 번에 최대 3,000단어까지 등록할 수 있어요.');
  const rows = [], issues = [], seen = new Set();
  rawRows.forEach((raw, index) => {
    const row = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
    const rangeCode = str(row.range_code ?? row.range ?? row['범위'] ?? row['번호'] ?? row.day ?? row.DAY, 40);
    const word = str(row.word ?? row.english ?? row['영어'] ?? row['단어'], 120);
    const meaning = str(row.meaning ?? row.korean ?? row['뜻'] ?? row['의미'], 200);
    if (!rangeCode || !word || !meaning) {
      issues.push({ row: index + 1, message: '범위·영어·뜻 중 빠진 항목이 있어 제외했어요.' });
      return;
    }
    const key = `${rangeCode}|${word.normalize('NFKC').toLowerCase()}`;
    if (seen.has(key)) {
      issues.push({ row: index + 1, message: '같은 범위의 중복 단어라 제외했어요.' });
      return;
    }
    seen.add(key);
    rows.push({ range_code: rangeCode, word, meaning });
  });
  return { rows, issues };
}
const id = () => randomUUID();
const DIVISIONS = ['middle', 'high'];
const ALL_CLASSES = '__ALL__';
const divisionLabel = division => division === 'middle' ? '중등부' : '고등부';
const divisionClassAllowed = (division, className) => division === 'middle' ? ['중2','중3'].includes(className) : ['고1A','고1B'].includes(className);
const examClassAllowed = (division, className) => division === 'high' && className === ALL_CLASSES ? true : divisionClassAllowed(division, className);
const examWordGrade = className => className === ALL_CLASSES ? null : className;
const examTargetMatches = (exam, profile) => !!exam && !!profile && (exam.class_name === ALL_CLASSES || exam.class_name === profile.class_name);
const normalizedSchoolRef = value => str(value, 80).replace(/\s+/g, '');
const schoolByRef = (state, value) => {
  const raw = str(value, 80);
  const normalized = normalizedSchoolRef(raw);
  return state.schools.find(s => s.active !== false && (
    s.id === raw ||
    normalizedSchoolRef(s.name) === normalized ||
    normalizedSchoolRef(s.full_name) === normalized
  ));
};
const schoolForProfile = (state, profile) => state.schools.find(s => s.id === profile.school_id) || schoolByRef(state, profile.school);
const activeTeacherDivision = profile => DIVISIONS.includes(profile.active_division) ? profile.active_division : 'high';
const teacherSchools = (state, profile, division = activeTeacherDivision(profile)) => state.schools.filter(s => s.active !== false && s.division === division && profile.school_ids?.includes(s.id));
const activeTeacherSchool = (state, profile) => teacherSchools(state, profile).find(s => s.id === profile.active_school_id) || teacherSchools(state, profile)[0];
const sameSchool = (record, school) => !!record && !!school && (
  record.school_id === school.id ||
  normalizedSchoolRef(record.school) === normalizedSchoolRef(school.name) ||
  normalizedSchoolRef(record.school) === normalizedSchoolRef(school.full_name)
);
const wordForGrade = (state, word) => ({ ...word, accepted_meanings: [...new Set([...(word.accepted_meanings || []), ...(state.meaningAliases?.[word.id] || [])])] });
const normalizeDisputeAnswer = value => String(value ?? '').normalize('NFKC').toLowerCase().replace(/[~～·•・.,;:!?()[\]{}"'‘’“”]/g, '').replace(/\s+/g, '').trim();
const findWord = (state, wordId) => allBooks(state).flatMap(book => book.words || []).find(word => word.id === wordId);
const addMeaningAlias = (state, wordId, alias, { source = 'teacher', created_by = null } = {}) => {
  const value = str(alias, 80);
  if (!value) fail('허용할 뜻을 입력해주세요.');
  state.meaningAliases ??= {};
  state.meaningAliasMeta ??= {};
  state.meaningAliases[wordId] ??= [];
  state.meaningAliasMeta[wordId] ??= [];
  const normalized = normalizeDisputeAnswer(value);
  const existingValue = state.meaningAliases[wordId].find(item => normalizeDisputeAnswer(item) === normalized);
  if (!existingValue) state.meaningAliases[wordId].push(value);
  const storedValue = existingValue || value;
  const meta = state.meaningAliasMeta[wordId].find(item => normalizeDisputeAnswer(item?.value) === normalized);
  if (!meta) state.meaningAliasMeta[wordId].push({ value: storedValue, source, created_at: Date.now(), created_by });
  else if (meta.source === 'legacy' && source !== 'legacy') Object.assign(meta, { source, created_at: Date.now(), created_by });
  return state.meaningAliases[wordId];
};
const removeMeaningAlias = (state, wordId, alias) => {
  const normalized = normalizeDisputeAnswer(alias);
  state.meaningAliases ??= {};
  state.meaningAliasMeta ??= {};
  state.meaningAliases[wordId] = (state.meaningAliases[wordId] || []).filter(item => normalizeDisputeAnswer(item) !== normalized);
  state.meaningAliasMeta[wordId] = (state.meaningAliasMeta[wordId] || []).filter(item => normalizeDisputeAnswer(item?.value) !== normalized);
  if (!state.meaningAliases[wordId].length) delete state.meaningAliases[wordId];
  if (!state.meaningAliasMeta[wordId].length) delete state.meaningAliasMeta[wordId];
  return state.meaningAliases[wordId] || [];
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
      mastery.recent_results = Array.isArray(mastery.recent_results) ? mastery.recent_results : [];
      const recentWrongIndex = [...mastery.recent_results].map((item, index) => ({ item, index })).reverse().find(entry => entry.item?.ok === false)?.index;
      if (recentWrongIndex !== undefined) mastery.recent_results[recentWrongIndex] = { ...mastery.recent_results[recentWrongIndex], ok: true, regraded: true };
      mastery.last_seen = Date.now();
    }
    const practice = state.practices.find(item => item.id === dispute.source_id && item.student_id === dispute.student_id);
    if (practice && !practice.finished) {
      practice.correct = Math.min(practice.total, Number(practice.correct || 0) + 1);
      practice.score_correct = Math.min(practice.target, Number(practice.score_correct || 0) + 1);
      practice.xp = Number(practice.xp || 0) + 20;
      const answerRecord = (practice.answer_records || []).find(item => item.question_id === dispute.question_id || (item.word_id === dispute.word_id && !item.regraded && item.correct === false));
      if (answerRecord && !answerRecord.correct) {
        answerRecord.correct = true;
        answerRecord.regraded = true;
        answerRecord.dispute_status = 'approved';
        answerRecord.corrected_at = Date.now();
      }
      const retryIndex = practice.retry?.findIndex(item => item.id === dispute.word_id) ?? -1;
      if (retryIndex >= 0) practice.retry.splice(retryIndex, 1);
    }
    const session = state.sessions.find(item => item.id === dispute.source_id && item.student_id === dispute.student_id);
    if (session) {
      const answerRecord = (session.answer_records || []).find(item => item.question_id === dispute.question_id || (item.word_id === dispute.word_id && !item.regraded && item.correct === false));
      const currentWrongCount = Number.isFinite(Number(session.wrong_count))
        ? Number(session.wrong_count)
        : (session.wrong_details || []).filter(item => !item.regraded).length;
      if (answerRecord && !answerRecord.correct) {
        answerRecord.correct = true;
        answerRecord.regraded = true;
        answerRecord.dispute_status = 'approved';
        answerRecord.corrected_at = Date.now();
      }
      session.correct = Math.min(session.total, Number(session.correct || 0) + 1);
      session.score = session.total ? Math.round(session.correct / session.total * 100) : 0;
      session.wrong_count = Math.max(0, currentWrongCount - 1);
      session.unanswered_count = Math.max(0, Number(session.unanswered_count || 0));
      session.perfect = session.score === 100 && session.wrong_count === 0 && session.unanswered_count === 0;
      session.xp = Number(session.xp || 0) + 20;
      session.regraded_at = Date.now();
      const detail = (session.wrong_details || []).find(item => item.question_id === dispute.question_id || (item.word_id === dispute.word_id && !item.regraded));
      if (detail) {
        detail.regraded = true;
        detail.dispute_status = 'approved';
        detail.corrected_at = Date.now();
      }
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
function booksForSchoolGrade(state, school, grade = null) {
  if (!school) return [];
  return allBooks(state).filter(book => book.school_id === school.id && (!book.grade || !grade || book.grade === grade));
}
function wordsForSchoolGrade(state, school, grade = null) {
  const map = new Map();
  for (const book of booksForSchoolGrade(state, school, grade)) {
    for (const word of book.words || []) map.set(word.id, word);
  }
  return [...map.values()];
}
function recentRangeResults(list, mastery, limit = 30) {
  return list.flatMap(word => (mastery[word.id]?.recent_results || []).map(item => ({ ...item, word_id: word.id })))
    .filter(item => Number.isFinite(Number(item.at)))
    .sort((a, b) => Number(b.at) - Number(a.at))
    .slice(0, limit);
}
function wordRangeMastery(state, studentId, school, grade = null) {
  if (!school) return { ranges: {}, mastered: 0, perfect: 0, total_ranges: 0, conquest: 0 };
  const words = wordsForSchoolGrade(state, school, grade);
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
    const recent = recentRangeResults(list, mastery, 30);
    const recentAccuracy = recent.length ? Math.round(recent.filter(item => item.ok).length / recent.length * 100) : accuracy;
    const recentMinimum = Math.min(20, list.length);
    const recentReady = recent.length >= recentMinimum;
    const achievementAccuracy = recentReady ? recentAccuracy : accuracy;
    let status = 'quest';
    if (attempted > 0 && achievementAccuracy <= 70) status = 'needs_work';
    else if (attempted < list.length) status = attempted ? 'in_progress' : 'quest';
    else if (achievementAccuracy === 100) status = 'perfect';
    else if (achievementAccuracy >= 95) status = 'master';
    else status = 'conquering';
    if (status === 'master' || status === 'perfect') mastered++;
    if (status === 'perfect') perfect++;
    const conquest = Math.round(achievementAccuracy * (coverage / 100));
    conquestTotal += conquest;
    ranges[code] = {
      range_code: code, total: list.length, attempted, accuracy, coverage, conquest, status,
      recent_accuracy: recentAccuracy, recent_samples: recent.length, recent_required: recentMinimum,
      achievement_accuracy: achievementAccuracy, achievement_source: recentReady ? 'recent30' : 'cumulative'
    };
  }
  return { ranges, mastered, perfect, total_ranges: grouped.size, conquest: grouped.size ? Math.round(conquestTotal / grouped.size) : 0 };
}
function composeDailyQuest(state, studentId, school, grade, target = 20) {
  const words = wordsForSchoolGrade(state, school, grade);
  const mastery = state.mastery?.[studentId] || {};
  const limit = Math.min(Math.max(1, Number(target) || 20), 20, words.length);
  const byLastSeen = (a, b) => Number(mastery[a.id]?.last_seen || 0) - Number(mastery[b.id]?.last_seen || 0);
  const wrongPool = words.filter(word => {
    const m = mastery[word.id];
    if (!m) return false;
    const recent = m.recent_results || [];
    return Number(m.wrong || 0) > 0 && (recent.at(-1)?.ok === false || Number(m.mastery || 0) < 80);
  }).sort((a, b) =>
    Number(mastery[b.id]?.last_wrong_at || 0) - Number(mastery[a.id]?.last_wrong_at || 0) ||
    Number(mastery[a.id]?.mastery || 0) - Number(mastery[b.id]?.mastery || 0)
  );
  const newPool = words.filter(word => {
    const m = mastery[word.id];
    return !m || Number(m.correct || 0) + Number(m.wrong || 0) === 0;
  });
  const selected = new Map();
  const mix = { wrong: 0, review: 0, new: 0 };
  const take = (pool, count, key) => {
    for (const word of pool) {
      if (selected.size >= limit || mix[key] >= count) break;
      if (selected.has(word.id)) continue;
      selected.set(word.id, word); mix[key]++;
    }
  };
  take(wrongPool, 8, 'wrong');
  const stalePool = words.filter(word => !selected.has(word.id) && !newPool.some(item => item.id === word.id) && mastery[word.id]?.last_seen).sort(byLastSeen);
  take(stalePool, 6, 'review');
  take(shuffle(newPool), 6, 'new');
  const fillPools = [
    ['wrong', wrongPool],
    ['review', stalePool],
    ['new', shuffle(newPool)],
    ['review', words.filter(word => !selected.has(word.id)).sort(byLastSeen)]
  ];
  for (const [key, pool] of fillPools) {
    for (const word of pool) {
      if (selected.size >= limit) break;
      if (selected.has(word.id)) continue;
      selected.set(word.id, word); mix[key]++;
    }
  }
  const chosen = [...selected.values()];
  return { words: chosen, mix, target: chosen.length, range_codes: [...new Set(chosen.map(word => String(word.range_code)))].filter(Boolean) };
}
export function allBooks(state) { return [...builtinBooks.map(withoutLegacySeonbu44), seonbu44Correction, ...middleGrade2Books, ...middleGrade3Books, ...state.extraBooks]; }
export function scopedWords(state, schoolRef, ranges, grade = null) {
  const school = schoolByRef(state, schoolRef);
  if (!school || !Array.isArray(ranges) || !ranges.length) fail('학교와 범위를 선택해주세요.');
  const words = wordsForSchoolGrade(state, school, grade);
  if (!ranges.every(r => words.some(w => w.range_code === String(r)))) fail('선택한 범위를 찾을 수 없습니다.');
  return words.filter(w => ranges.map(String).includes(w.range_code));
}
function mySessions(state, student) { return state.sessions.filter(s => s.student_id === student); }
const DAY_MS = 86400000;
const KST_OFFSET_MS = 9 * 3600000;
const KO_WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
function shortKstDate(ts) {
  const d = new Date(ts + KST_OFFSET_MS);
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()}(${KO_WEEKDAYS[d.getUTCDay()]})`;
}
function rankingWeek(now = Date.now()) {
  const local = new Date(now + KST_OFFSET_MS);
  const daysSinceMonday = (local.getUTCDay() + 6) % 7;
  const start = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() - daysSinceMonday) - KST_OFFSET_MS;
  const end = start + 7 * DAY_MS;
  const thursday = new Date(start + KST_OFFSET_MS + 3 * DAY_MS);
  const year = thursday.getUTCFullYear();
  const monthIndex = thursday.getUTCMonth();
  const month = monthIndex + 1;
  const firstOfMonth = new Date(Date.UTC(year, monthIndex, 1));
  const firstThursday = 1 + ((4 - firstOfMonth.getUTCDay() + 7) % 7);
  const week = 1 + Math.floor((thursday.getUTCDate() - firstThursday) / 7);
  return {
    start, end, year, month, week,
    key: `${year}-${String(month).padStart(2, '0')}-W${week}`,
    label: `${year}년 ${month}월 ${week}주차`,
    range: `${shortKstDate(start)} ~ ${shortKstDate(end - 1)}`
  };
}
function stats(state, p, sessions = mySessions(state, p.id)) {
  const today = sessions.filter(s => dayKey(s.created_at) === dayKey(Date.now()));
  const recent = [...sessions].sort((a, b) => b.created_at - a.created_at).slice(0, 20);
  const total = recent.reduce((n, s) => n + s.total, 0), correct = recent.reduce((n, s) => n + s.correct, 0);
  return {
    ...growthFor(sessions),
    today_total: today.reduce((n, s) => n + s.total, 0),
    today_xp: today.reduce((n, s) => n + (s.xp || 0), 0),
    reward_points: sessions.reduce((n, s) => n + Number(s.reward_points || 0), 0),
    today_reward_points: today.reduce((n, s) => n + Number(s.reward_points || 0), 0),
    practice_count: sessions.length,
    accuracy: total ? Math.round(correct / total * 100) : 0,
    weak: Object.values(state.mastery[p.id] || {}).filter(m => m.wrong > 0 && m.mastery < 80).length
  };
}
function attemptView(a, state, profile) {
  const exam = state.exams.find(e => e.id === a.exam_id);
  const submitted = a.status === 'submitted';
  const resultVisible = submitted && (profile.role === 'teacher' || exam?.release_result);
  const hasPendingDispute = submitted && (state.meaningDisputes || []).some(item => item.source_type === 'exam' && item.source_id === a.id && item.status === 'pending');
  const gradingStatus = submitted ? (hasPendingDispute ? 'provisional' : 'final') : 'pending';
  return {
    id: a.id, exam_id: a.exam_id, student_id: a.student_id, status: a.status,
    started_at: a.started_at, deadline: a.deadline, submitted_at: a.submitted_at,
    auto_submitted: a.auto_submitted, total: a.questions.length,
    result_visibility: resultVisible ? 'visible' : 'withheld',
    grading_status: gradingStatus,
    ...(a.status === 'active' ? { questions: a.questions, answers: a.answers, revision: a.revision, lease: a.lease } : {}),
    ...(resultVisible ? { score: a.score, correct: a.correct, details: a.details } : {})
  };
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
  if (path === '/health') return { ok: true, version: '13.41.0', schema_version: state.schema_version, ready: state.profiles.some(p => p.role === 'teacher') || process.env.AUTH_PROVIDER === 'supabase' };
  if (path === '/session' && method === 'GET') { const auth = state.tokens.find(t => t.hash === hashToken(token || '') && t.expires_at > Date.now()); return { authenticated: state.profiles.some(p => p.id === auth?.user_id && p.active) }; }
  if (path === '/login' && method === 'POST') {
    let p, supabaseAccessToken;
    const username = str(body.username).toLowerCase();
    const password = String(body.password || '');
    // Self-signup students are stored in the durable VOCA state with a local
    // password_hash. Authenticate those accounts locally even when Supabase
    // auth is enabled, so signup and subsequent login use the same credential.
    const localProfile = state.profiles.find(profile => profile.username === username && profile.active);
    if (localProfile?.password_hash) {
      p = localProfile;
      if (!(await verifyPassword(password, p.password_hash))) fail('아이디 또는 비밀번호를 확인해주세요.', 401);
    } else if (process.env.AUTH_PROVIDER === 'supabase') {
      const result = await supabaseLogin(username, password); p = result.profile; supabaseAccessToken = result.accessToken;
      const old = state.profiles.find(x => x.id === p.id);
      if (old) { const style = Object.fromEntries(['avatar_key', 'avatar_accessory', 'avatar_frame', 'avatar_title'].filter(k => old[k]).map(k => [k, old[k]])); Object.assign(old, p, style); p = old; }
      else state.profiles.push(p);
    } else {
      p = localProfile;
      if (!(await verifyPassword(password, p?.password_hash))) fail('아이디 또는 비밀번호를 확인해주세요.', 401);
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
    if (p.role === 'student') {
      const school = schoolForProfile(state, p);
      const division = p.division || school?.division || (/^중/.test(p.class_name || '') ? 'middle' : 'high');
      p.division = division;
      if (school) { p.school_id = school.id; p.school = school.name; }
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
    const visibleExams = state.exams.filter(e => e.division === selectedDivision && (teacher ? sameSchool(e, selectedSchool) : (examTargetMatches(e, p) && sameSchool(e, studentSchool) && e.active)));
    const visibleExamIds = new Set(visibleExams.map(e => e.id));
    const studentProfiles = state.profiles.filter(x => x.role === 'student' && x.division === selectedDivision && (!teacher || sameSchool(x, selectedSchool)));
    const studentIds = new Set(studentProfiles.map(s => s.id));
    const sessions = state.sessions.filter(s => s.division === selectedDivision && sameSchool(s, selectedSchool) && (teacher ? studentIds.has(s.student_id) : s.student_id === p.id)).sort((a, b) => b.created_at - a.created_at);
    const sessionsByStudent = new Map();
    if (teacher) for (const session of sessions) {
      if (!sessionsByStudent.has(session.student_id)) sessionsByStudent.set(session.student_id, []);
      sessionsByStudent.get(session.student_id).push(session);
    }
    const attempts = state.examAttempts.filter(a => teacher ? visibleExamIds.has(a.exam_id) : a.student_id === p.id);
    const books = allBooks(state).filter(b => sameSchool(b, selectedSchool) && (teacher || !b.grade || b.grade === p.class_name));
    const schools = (teacher ? teacherSchools(state, p, selectedDivision) : [selectedSchool]).filter(Boolean).map(s => ({ id: s.id, name: s.name, full_name: s.full_name, division: s.division }));
    const profile = { ...publicProfile(p), division: selectedDivision, ...(teacher && selectedSchool ? { active_division: selectedDivision, active_school_id: selectedSchool.id, active_school: selectedSchool.name } : {}) };
    const meaningDisputes = state.meaningDisputes.filter(item => teacher ? (item.school_id === selectedSchool.id && item.division === selectedDivision) : item.student_id === p.id).sort((a, b) => b.created_at - a.created_at);
    const grammarProgress = teacher
      ? Object.fromEntries([...studentIds].map(studentId => [studentId, state.grammarProgress?.[studentId] || {}]))
      : (state.grammarProgress?.[p.id] || {});
    const wordMastery = teacher
      ? Object.fromEntries(studentProfiles.map(student => [student.id, wordRangeMastery(state, student.id, selectedSchool, student.class_name)]))
      : wordRangeMastery(state, p.id, selectedSchool, p.class_name);
    const dailyQuest = teacher || selectedDivision === 'middle' ? null : composeDailyQuest(state, p.id, selectedSchool, p.class_name, 20);
    const activePractice = teacher ? null : state.practices.find(x => x.student_id === p.id && !x.finished);
    const activePracticeSummary = activePractice ? {
      id: activePractice.id,
      division: activePractice.division,
      school: activePractice.school,
      range_codes: activePractice.range_codes || [],
      mode: activePractice.mode,
      run_mode: activePractice.run_mode || 'practice',
      target: activePractice.target,
      score_total: Number(activePractice.score_total || 0),
      started_at: activePractice.started_at,
      deadline: activePractice.deadline,
      question_deadline: activePractice.question_deadline || null,
      question_duration_sec: activePractice.question_duration_sec || null,
      timer_mode: activePractice.timer_mode || 'session',
      assignment_id: activePractice.assignment_id || null
    } : null;
    return { profile, divisions: teacher ? ['middle','high'] : [selectedDivision], schools, books, stats: stats(state, p, sessions), mastery: state.mastery[p.id] || {}, word_mastery: wordMastery, daily_quest: dailyQuest ? { target: dailyQuest.target, mix: dailyQuest.mix, range_codes: dailyQuest.range_codes } : null, grammar_progress: grammarProgress, meaning_aliases: teacher ? state.meaningAliases : {}, meaning_alias_meta: teacher ? state.meaningAliasMeta : {}, meaning_disputes: meaningDisputes,
      profiles: teacher ? studentProfiles.map(s => ({ ...publicProfile(s), stats: stats(state, s, sessionsByStudent.get(s.id) || []) })) : [],
      sessions, exams: visibleExams,
      assignments: state.assignments.filter(a => teacher ? sameSchool(a, selectedSchool) : (a.class_name === p.class_name && sameSchool(a, studentSchool) && a.active)),
      attempts: attempts.map(a => attemptSummary(a, state, p)), server_time: Date.now(),
      active_practice: activePractice?.id || null,
      active_practice_summary: activePracticeSummary,
      ranking_period: rankingWeek(Date.now()),
      ranking: teacher ? [] : state.profiles.filter(x => x.active && x.role === 'student').map(s => {
        const records = mySessions(state, s.id);
        const period = rankingWeek(Date.now());
        const weekly = records.filter(r => r.created_at >= period.start && r.created_at < period.end);
        const g = growthFor(records), isMe = s.id === p.id;
        const hidden = !isMe && (s.ranking_public === false || s.share_profile === false);
        const grade = /^중2/.test(s.class_name || '') ? '중2' : /^중3/.test(s.class_name || '') ? '중3' : /^고1/.test(s.class_name || '') ? '고1' : (s.division === 'middle' ? '중등' : '고등');
        return {
          id: hidden ? null : s.id, is_me: isMe, private: hidden, grade,
          division: s.division || (grade.startsWith('중') ? 'middle' : 'high'),
          display_name: hidden ? '비공개 학생' : s.display_name,
          avatar_key: hidden ? 'lumi' : (s.avatar_key || 'lumi'),
          level: hidden ? 1 : g.level, streak: g.streak,
          xp: weekly.reduce((n, r) => n + Number(r.xp || 0), 0),
          total: weekly.reduce((n, r) => n + Number(r.total || 0), 0),
          all_xp: records.reduce((n, r) => n + Number(r.xp || 0), 0),
          all_total: records.reduce((n, r) => n + Number(r.total || 0), 0),
          all_streak: g.streak
        };
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
  if (path === '/vocab-import/preview' && method === 'POST') {
    requireRole(p, 'teacher');
    const school = activeTeacherSchool(state, p);
    if (!school || school.division !== 'middle' || activeTeacherDivision(p) !== 'middle') fail('중등부 학교에서 사용할 수 있어요.', 403);
    const grade = str(body.grade, 10);
    if (!MIDDLE_IMPORT_GRADES.includes(grade)) fail('중2 또는 중3을 선택해주세요.');
    const normalized = normalizeImportRows(body.rows);
    if (!normalized.rows.length) fail('등록할 수 있는 단어가 없습니다.');
    const rangeCodes = [...new Set(normalized.rows.map(row => row.range_code))];
    return {
      grade,
      school_id: school.id,
      school: school.name,
      valid: normalized.rows.length,
      skipped: normalized.issues.length,
      ranges: rangeCodes.map(range_code => ({
        range_code,
        count: normalized.rows.filter(row => row.range_code === range_code).length
      })),
      sample: normalized.rows.slice(0, 12),
      issues: normalized.issues.slice(0, 30)
    };
  }

  if (path === '/vocab-import/commit' && method === 'POST') {
    requireRole(p, 'teacher');
    const school = activeTeacherSchool(state, p);
    if (!school || school.division !== 'middle' || activeTeacherDivision(p) !== 'middle') fail('중등부 학교에서 사용할 수 있어요.', 403);
    const grade = str(body.grade, 10);
    if (!MIDDLE_IMPORT_GRADES.includes(grade)) fail('중2 또는 중3을 선택해주세요.');
    const normalized = normalizeImportRows(body.rows);
    if (!normalized.rows.length) fail('등록할 수 있는 단어가 없습니다.');
    const bookId = `import:${school.id}:${grade}`;
    const words = normalized.rows.map(row => ({
      id: importedWordId(school.id, grade, row.range_code, row.word),
      book_id: bookId,
      school_id: school.id,
      school: school.name,
      division: school.division,
      grade,
      range_code: row.range_code,
      word: row.word,
      meaning: row.meaning
    }));
    const book = {
      id: bookId,
      school_id: school.id,
      school: school.name,
      division: school.division,
      grade,
      title: `${school.name} ${grade} 단어`,
      source: 'teacher_import',
      imported_at: Date.now(),
      words
    };
    state.extraBooks = state.extraBooks.filter(item => item.id !== bookId);
    state.extraBooks.push(book);
    return {
      ok: true,
      book_id: bookId,
      grade,
      school: school.name,
      count: words.length,
      ranges: [...new Set(words.map(word => word.range_code))],
      skipped: normalized.issues.length
    };
  }

  if (/^\/meaning-aliases\/[^/]+$/.test(path) && method === 'POST') {
    requireRole(p, 'teacher');
    const wordId = decodeURIComponent(path.split('/')[2] || '');
    const school = activeTeacherSchool(state, p);
    const word = allBooks(state).filter(book => sameSchool(book, school)).flatMap(book => book.words || []).find(item => item.id === wordId);
    if (!word) fail('현재 학교의 단어를 찾을 수 없습니다.', 404);
    const alias = str(body.alias, 80);
    const aliases = addMeaningAlias(state, wordId, alias, { source: 'teacher', created_by: p.id });
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
    return { word_id: wordId, aliases, meta: state.meaningAliasMeta?.[wordId] || [], regraded };
  }
  if (/^\/meaning-aliases\/[^/]+\/[^/]+$/.test(path) && method === 'DELETE') {
    requireRole(p, 'teacher');
    const [, , rawWordId, rawAlias] = path.split('/');
    const wordId = decodeURIComponent(rawWordId || '');
    const alias = decodeURIComponent(rawAlias || '');
    const school = activeTeacherSchool(state, p);
    const word = allBooks(state).filter(book => sameSchool(book, school)).flatMap(book => book.words || []).find(item => item.id === wordId);
    if (!word) fail('현재 학교의 단어를 찾을 수 없습니다.', 404);
    const aliases = removeMeaningAlias(state, wordId, alias);
    return { word_id: wordId, aliases, meta: state.meaningAliasMeta?.[wordId] || [] };
  }
  if (/^\/meaning-aliases\/[^/]+$/.test(path) && method === 'DELETE') {
    requireRole(p, 'teacher');
    const wordId = decodeURIComponent(path.split('/')[2] || '');
    if (state.meaningAliases) delete state.meaningAliases[wordId];
    if (state.meaningAliasMeta) delete state.meaningAliasMeta[wordId];
    return { word_id: wordId, aliases: [], meta: [] };
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
      const session = state.sessions.find(item => item.id === sourceId && item.student_id === p.id);
      const source = session || practice;
      if (!source || source.school_id !== school.id) fail('연습 답안을 찾을 수 없습니다.', 404);
      questionId = str(body.question_id, 100);
      const durable = (source.answer_records || []).find(item => item.question_id === questionId);
      if (durable) {
        if (durable.correct || durable.type !== 'write_meaning' || !durable.word_id || !durable.answer) fail('오답으로 채점된 뜻쓰기 답안만 이의제기할 수 있어요.', 409);
        word = findWord(state, durable.word_id);
        submittedAnswer = durable.answer;
      } else {
        const response = practice?.responses?.[questionId];
        const feedback = response?.feedback;
        if (!feedback || feedback.ok || feedback.type !== 'write_meaning' || !feedback.word_id || !feedback.answer) fail('오답으로 채점된 뜻쓰기 답안만 이의제기할 수 있어요.', 409);
        word = findWord(state, feedback.word_id);
        submittedAnswer = feedback.answer;
      }
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
    if (action === 'approve_global') addMeaningAlias(state, dispute.word_id, dispute.answer, { source: 'appeal', created_by: p.id });
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
    const targetClass = str(body.class_name, 30);
    if (!str(body.title) || !targetClass) fail('제목과 대상을 입력해주세요.');
    if (path === '/assignments' && !divisionClassAllowed(school.division, targetClass)) fail(`${divisionLabel(school.division)} 반을 선택해주세요.`);
    if (path === '/exams' && !examClassAllowed(school.division, targetClass)) fail(school.division === 'high' ? '학교 전체 또는 고등부 반을 선택해주세요.' : '중등부 반을 선택해주세요.');
    const words = scopedWords(state, school.id, body.range_codes, path === '/exams' ? examWordGrade(targetClass) : targetClass);
    const due = Number(body.due_at); if (!Number.isFinite(due) || due <= Date.now()) fail('마감 시간을 확인해주세요.');
    const common = { id: id(), teacher_id: p.id, title: str(body.title), class_name: targetClass, division: school.division, school_id: school.id, school: school.name, range_codes: [...new Set(body.range_codes.map(String))], book_id: words[0].book_id, active: true, created_at: Date.now(), due_at: due };
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
      const targetClass = body.class_name !== undefined ? str(body.class_name, 30) : e.class_name;
      if (!examClassAllowed(school.division, targetClass)) fail(school.division === 'high' ? '학교 전체 또는 고등부 반을 선택해주세요.' : '중등부 반을 선택해주세요.');
      const words = scopedWords(state, school.id, ranges, examWordGrade(targetClass));
      if (body.class_name !== undefined) e.class_name = targetClass;
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
    const e = state.exams.find(e => e.id === body.exam_id && e.division === p.division && examTargetMatches(e, p) && sameSchool(e, studentSchool) && e.active);
    if (!e) fail('배정된 시험이 아닙니다.', 403);
    const existing = state.examAttempts.find(a => a.exam_id === e.id && a.student_id === p.id && a.status === 'active');
    if (existing) { existing.lease = id(); return { attempt: attemptView(existing, state, p), exam: e, server_time: Date.now() }; }
    if (Date.now() < e.available_at || Date.now() >= e.due_at) fail('응시 가능한 시간이 아닙니다.');
    if (state.examAttempts.filter(a => a.exam_id === e.id && a.student_id === p.id).length >= e.max_attempts) fail('응시 횟수를 모두 사용했습니다.');
    const words = scopedWords(state, e.school_id, e.range_codes, examWordGrade(e.class_name)), chosen = shuffle(words).slice(0, e.question_count);
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
    if (active) { removePracticeTimer(active); const view = practiceView(active, state); view.resumed_existing = true; return view; }
    const school = schoolForProfile(state, p);
    if (!school) fail('학생 학교 설정을 확인해주세요.', 409);
    if (body.school_id && body.school_id !== school.id) fail('현재 학교의 범위만 학습할 수 있어요.', 403);
    if (!PRACTICE_TYPES[body.mode]) fail('연습 방식을 선택해주세요.');
    const requestedRunMode = body.run_mode === 'test' ? 'test' : 'practice';
    const runMode = requestedRunMode === 'test' && ['write_meaning','spell'].includes(body.mode) ? 'test' : 'practice';
    const examStyle = body.exam_style === true && ['write_meaning','spell'].includes(body.mode);
    const isDailyQuest = body.daily_quest === true && school.division !== 'middle';
    const selectedWordIds = Array.isArray(body.word_ids)
      ? [...new Set(body.word_ids.map(value => String(value)).filter(Boolean))].slice(0, 200)
      : [];
    const gradeWords = wordsForSchoolGrade(state, school, p.class_name);
    const selectedWordSet = new Set(selectedWordIds);
    const manualWords = selectedWordIds.length ? gradeWords.filter(word => selectedWordSet.has(word.id)) : [];
    if (selectedWordIds.length && manualWords.length !== selectedWordIds.length) fail('선택한 단어를 다시 확인해주세요.', 409);
    const daily = isDailyQuest ? composeDailyQuest(state, p.id, school, p.class_name, 20) : null;
    const words = manualWords.length ? manualWords : isDailyQuest ? daily.words : scopedWords(state, school.id, body.range_codes, p.class_name);
    if (!words.length) fail('학습할 단어가 없습니다. 선생님에게 단어 범위를 확인해주세요.', 409);
    const manualSelection = manualWords.length > 0;
    const coverAll = manualSelection ? body.cover_all === true || body.target === undefined : isDailyQuest || body.cover_all === true;
    const rangeCodes = manualSelection ? [...new Set(words.map(word => String(word.range_code)))] : isDailyQuest ? daily.range_codes : body.range_codes;
    const requestedTarget = manualSelection
      ? (body.target === undefined ? words.length : integer(body.target, 5, Math.min(500, words.length), '학습량'))
      : isDailyQuest ? daily.target : coverAll ? words.length : integer(body.target || 10, 5, 500, '학습량');
    const target = runMode === 'test' || examStyle ? Math.min(requestedTarget, words.length) : requestedTarget;
    const practiceWords = runMode === 'test' || examStyle ? shuffle(words).slice(0, target) : words;
    const startedAt = Date.now();
    const durationSec = practiceDurationSec(body.mode, target);
    const x = { id: id(), student_id: p.id, division: p.division || school.division, school_id: school.id, school: school.name, grade: p.class_name, range_codes: rangeCodes, mode: body.mode, run_mode: runMode, exam_style: examStyle, assignment_id: null, target, cover_all: runMode === 'test' || examStyle ? true : coverAll, daily_quest: isDailyQuest, manual_selection: manualSelection, preserve_order: manualSelection && runMode !== 'test', quest_mix: daily?.mix || null, seen: [], total: 0, correct: 0, score_total: 0, score_correct: 0, xp: 0, combo: 0, best: 0, retry: [], last: null, started_at: startedAt, duration_sec: durationSec, timer_mode: 'none', question_duration_sec: 0, question_started_at: null, question_deadline: null, deadline: null, auto_submitted: false, wrong_details: [], answer_records: [], finished: false, responses: {}, words: practiceWords.map(w => w.id) };
    if (body.assignment_id) { const a = state.assignments.find(a => a.id === body.assignment_id && a.class_name === p.class_name && a.active); if (a && sameSchool(a, school) && JSON.stringify([...a.range_codes].sort()) === JSON.stringify([...x.range_codes].sort())) x.assignment_id = a.id; }
    state.practices.push(x); nextPractice(x, state); return practiceView(x, state);
  }
  if (/^\/practice\/[^/]+(?:\/(?:answer|next|finish|share))?$/.test(path)) {
    requireRole(p, 'student'); const x = state.practices.find(x => x.id === path.split('/')[2] && x.student_id === p.id); if (!x) fail('연습을 찾을 수 없습니다.', 404); removePracticeTimer(x);
    if (path.endsWith('/share')) {
      if (method !== 'POST') fail('요청 방식을 확인해주세요.', 405);
      if (!x.finished || x.run_mode !== 'test') fail('완료한 실전모드 결과만 선생님께 보낼 수 있어요.', 409);
      const sharedAt = x.shared_to_teacher_at || Date.now();
      x.shared_to_teacher_at = sharedAt;
      const session = state.sessions.find(item => item.id === x.id && item.student_id === p.id);
      if (session) session.shared_to_teacher_at = sharedAt;
      const view = practiceView(x, state);
      view.shared_to_teacher_at = sharedAt;
      return view;
    }
    if (path.endsWith('/answer')) {
      if (x.responses[body.question_id]) return x.responses[body.question_id];
      if (!x.finished && x.timer_mode !== 'question' && Number(x.deadline || 0) && Date.now() >= x.deadline) {
        finishPractice(x, state, true);
        return practiceView(x, state);
      }
      if (x.finished || x.feedback || body.question_id !== x.question_id) fail('현재 문제를 다시 확인해주세요.', 409);
      const timedOut = x.timer_mode === 'question' && Number(x.question_deadline || 0) > 0 && (Date.now() >= Number(x.question_deadline) || (body.timed_out === true && Date.now() + 150 >= Number(x.question_deadline)));
      const submittedAnswer = timedOut ? '' : body.answer;
      const word = allBooks(state).flatMap(b => b.words).find(w => w.id === x.question.word_id);
      const ok = timedOut ? false : grade(x.question.type, submittedAnswer, wordForGrade(state, word));
      x.total++; x.last = word.id;
      const scoredAttempt = !x.question_is_retry && Number(x.score_total || 0) < Number(x.target || 0);
      if (scoredAttempt) {
        x.score_total = Number(x.score_total || 0) + 1;
        if (ok) x.score_correct = Number(x.score_correct || 0) + 1;
        x.answer_records ??= [];
        x.answer_records.push({
          question_id: body.question_id,
          word_id: word.id,
          word: displayEnglish(word.word),
          meaning: word.meaning,
          answer: str(submittedAnswer, 160),
          timed_out: !!timedOut,
          type: x.question.type,
          correct: !!ok,
          at: Date.now(),
          regraded: false
        });
        if (x.answer_records.length > 500) x.answer_records.splice(0, x.answer_records.length - 500);
      }
      state.mastery[p.id] ??= {}; const m = state.mastery[p.id][word.id] ??= { mastery: 0, correct: 0, wrong: 0, streak: 0, recent_results: [] };
      m.recent_results = Array.isArray(m.recent_results) ? m.recent_results : [];
      let gain = 0;
      if (ok) { x.correct++; x.combo++; x.best = Math.max(x.best, x.combo); gain = 20 + Math.min(x.combo, 10) * 3; x.xp += gain; m.correct++; m.streak++; m.mastery = clamp(m.mastery + (m.streak >= 3 ? 14 : 10), 0, 100); }
      else { x.combo = 0; m.wrong++; m.streak = 0; m.mastery = clamp(m.mastery - 8, 0, 100); m.last_wrong_at = Date.now(); if (x.run_mode !== 'test' && !x.retry.some(r => r.id === word.id)) x.retry.push({ id: word.id, at: x.total + 2 }); }
      m.recent_results.push({ ok, at: Date.now() });
      if (m.recent_results.length > 5) m.recent_results.splice(0, m.recent_results.length - 5);
      m.last_seen = Date.now(); m.next_review_at = Date.now() + (ok ? 3600000 + m.mastery * 864000 : 120000);
      x.feedback = { ok, gain, mastery: m.mastery, word_id: word.id, type: x.question.type, question_id: body.question_id, answer: str(submittedAnswer, 160),
          timed_out: !!timedOut, word: displayEnglish(word.word), meaning: word.meaning, combo: x.combo, retry: !ok, can_dispute: !ok && !timedOut && scoredAttempt && x.question.type === 'write_meaning', scored: scoredAttempt, milestone: ok && [5, 10].includes(x.combo) };
      if (!ok && scoredAttempt) {
        x.wrong_details ??= [];
        x.wrong_details.push({
          question_id: body.question_id,
          word_id: word.id,
          word: displayEnglish(word.word),
          meaning: word.meaning,
          answer: str(submittedAnswer, 160),
          timed_out: !!timedOut,
          type: x.question.type,
          at: Date.now(),
          regraded: false
        });
        if (x.wrong_details.length > 200) x.wrong_details.splice(0, x.wrong_details.length - 200);
      }
      if (x.run_mode === 'test') {
        x.feedback = null;
        advancePractice(x, state);
        const result = practiceView(x, state);
        x.responses[body.question_id] = structuredClone(result);
        const responseKeys = Object.keys(x.responses);
        while (responseKeys.length > 3) delete x.responses[responseKeys.shift()];
        return result;
      }
      const result = practiceView(x, state);
      // Prepare the following question in the same persisted mutation. The
      // client can still show this answer's feedback, then switch instantly
      // without a second database round trip.
      if (body.prefetch_next === true && x.timer_mode !== 'question') {
        advancePractice(x, state);
        result.prefetched_next = practiceView(x, state);
      }
      x.responses[body.question_id] = structuredClone(result);
      const responseKeys = Object.keys(x.responses);
      while (responseKeys.length > 3) delete x.responses[responseKeys.shift()];
      return result;
    }
    if (path.endsWith('/next') && !x.finished && x.feedback) {
      if (x.timer_mode !== 'question' && Number(x.deadline || 0) && Date.now() >= x.deadline) finishPractice(x, state, true);
      else advancePractice(x, state);
    }
    if (path.endsWith('/finish') && !x.finished) {
      const expired = x.timer_mode !== 'question' && Number(x.deadline || 0) && Date.now() >= x.deadline;
      if (x.run_mode === 'test' && !expired && Number(x.score_total || 0) < Number(x.target || 0)) fail('실전 시험은 모든 문제를 완료해야 끝낼 수 있어요.', 409);
      finishPractice(x, state, expired);
    }
    return practiceView(x, state);
  }
  fail('요청한 기능을 찾을 수 없습니다.', 404);
}
function advancePractice(x, state) {
  const covered = !x.cover_all || (x.seen?.length || 0) >= x.words.length;
  const scoredDone = Number(x.score_total || 0) >= Number(x.target || 0);
  if (covered && scoredDone && (!x.retry.length || x.total >= x.target + 12)) finishPractice(x, state);
  else nextPractice(x, state);
}
function nextPractice(x, state) {
  const words = allBooks(state).flatMap(b => b.words).filter(w => x.words.includes(w.id));
  x.seen ??= [];
  const unseen = x.cover_all ? words.filter(w => !x.seen.includes(w.id)) : [];
  const due = x.retry.findIndex(r => r.at <= x.total);
  let word, isRetry = false;
  if (unseen.length) {
    word = x.preserve_order
      ? unseen.sort((a, b) => x.words.indexOf(a.id) - x.words.indexOf(b.id))[0]
      : choosePracticeWord(unseen, state.mastery[x.student_id] || {}, { ...x, retry: [] });
  } else if (due >= 0) {
    const retry = x.retry.splice(due, 1)[0];
    word = words.find(w => w.id === retry.id);
    isRetry = true;
  } else word = choosePracticeWord(words, state.mastery[x.student_id] || {}, x);
  if (!x.seen.includes(word.id)) x.seen.push(word.id);
  const mode = x.mode === 'mixed' ? shuffle(Object.keys(PRACTICE_TYPES).filter(k => k !== 'mixed'))[0] : x.mode;
  x.question = buildQuestion(word, mode, words); x.question_id = id(); x.question_is_retry = isRetry; x.feedback = null;
  if (x.timer_mode === 'question') {
    x.question_duration_sec = Number(PRACTICE_SECONDS_PER_QUESTION[mode] || PRACTICE_SECONDS_PER_QUESTION[x.mode] || 8);
    x.question_started_at = Date.now();
    x.question_deadline = x.question_started_at + x.question_duration_sec * 1000;
  }
}
function removePracticeTimer(x) {
  if (!x || x.finished) return x;
  x.timer_mode = 'none';
  x.deadline = null;
  x.question_deadline = null;
  x.question_duration_sec = 0;
  x.question_started_at = null;
  return x;
}

function practiceReward(x, state, endedAt, scoreTotal, perfect) {
  const previous = mySessions(state, x.student_id);
  const todayKey = dayKey(endedAt);
  const todaySessions = previous.filter(session => dayKey(session.created_at) === todayKey);
  const firstToday = todaySessions.length === 0;
  const breakdown = [];
  const add = (label, points) => { if (points > 0) breakdown.push({ label, points }); };

  const completion = scoreTotal >= 30 ? 18 : scoreTotal >= 20 ? 12 : scoreTotal >= 10 ? 5 : Math.max(1, Math.ceil(scoreTotal / 3));
  add('학습 완료', completion);
  if (perfect && scoreTotal >= 10) add('100점', 10);
  if (x.daily_quest) add('오늘 추천 학습', 5);
  if (firstToday) add('오늘 첫 학습', 5);

  if (firstToday) {
    const projected = growthFor([...previous, { created_at: endedAt, total: scoreTotal, xp: 0, best_combo: 0 }]).streak;
    if (projected === 3) add('3일 연속 학습', 8);
    if (projected === 7) add('7일 연속 학습', 20);
  }

  const raw = breakdown.reduce((sum, item) => sum + item.points, 0);
  const earnedToday = todaySessions.reduce((sum, session) => sum + Number(session.reward_points || 0), 0);
  const available = Math.max(0, 80 - earnedToday);
  const points = Math.min(raw, available);
  if (points < raw) breakdown.push({ label: '일일 보상 한도 적용', points: points - raw });
  return { points, breakdown };
}

function finishPractice(x, state, autoSubmitted = false) {
  const finalizedAt = Date.now();
  const endedAt = autoSubmitted && Number(x.deadline || 0) ? Math.min(finalizedAt, Number(x.deadline)) : finalizedAt;
  x.finished = true;
  x.ended_at = endedAt;
  x.finalized_at = finalizedAt;
  x.finished_at = endedAt;
  x.auto_submitted = !!autoSubmitted;
  const scoreTotal = Math.max(1, Number(x.target || 0));
  const scoreCorrect = Math.min(scoreTotal, Number(x.score_correct || 0));
  const score = Math.round(scoreCorrect / scoreTotal * 100);
  const answerRecords = (x.answer_records || []).map(item => ({ ...item }));
  const wrongCount = answerRecords.filter(item => item.correct === false && !item.regraded && !item.timed_out).length;
  const timedOutCount = answerRecords.filter(item => item.timed_out && !item.regraded).length;
  const unansweredCount = Math.max(0, scoreTotal - answerRecords.length) + timedOutCount;
  const perfect = score === 100 && wrongCount === 0 && unansweredCount === 0;
  const reward = practiceReward(x, state, endedAt, scoreTotal, perfect);
  x.reward_points = reward.points;
  x.reward_breakdown = reward.breakdown;
  const rec = {
    id: x.id,
    student_id: x.student_id,
    assignment_id: x.assignment_id,
    division: x.division,
    school_id: x.school_id,
    school: x.school,
    grade: x.grade || null,
    daily_quest: !!x.daily_quest,
    range_codes: x.range_codes,
    mode: x.mode,
    run_mode: x.run_mode || 'practice',
    exam_style: !!x.exam_style,
    correct: scoreCorrect,
    total: scoreTotal,
    attempts_total: x.total,
    score,
    wrong_count: wrongCount,
    unanswered_count: unansweredCount,
    perfect,
    xp: x.xp,
    reward_points: reward.points,
    reward_breakdown: reward.breakdown,
    best_combo: x.best,
    duration_sec: Math.max(0, Math.round((endedAt - x.started_at) / 1000)),
    limit_sec: Number(x.duration_sec || 0),
    timer_mode: x.timer_mode || 'session',
    question_duration_sec: Number(x.question_duration_sec || 0),
    auto_submitted: !!x.auto_submitted,
    ended_at: endedAt,
    finalized_at: finalizedAt,
    shared_to_teacher_at: x.shared_to_teacher_at || null,
    answer_records: answerRecords,
    word_ids: [...(x.words || [])],
    wrong_details: (x.wrong_details || []).map(item => ({ ...item })),
    created_at: endedAt
  };
  if (!state.sessions.some(s => s.id === rec.id)) state.sessions.push(rec);
}
function practiceView(x, state) {
  const scoreTotal = Math.max(1, Number(x.target || 0));
  const scoreCorrect = Math.min(scoreTotal, Number(x.score_correct || 0));
  const score = Math.round(scoreCorrect / scoreTotal * 100);
  const hideTestScore = x.run_mode === 'test' && !x.finished;
  const answerRecords = x.answer_records || [];
  const wrongCount = answerRecords.filter(item => item.correct === false && !item.regraded && !item.timed_out).length;
  const timedOutCount = answerRecords.filter(item => item.timed_out && !item.regraded).length;
  const unansweredCount = Math.max(0, scoreTotal - answerRecords.length) + timedOutCount;
  const perfect = x.finished && score === 100 && wrongCount === 0 && unansweredCount === 0;
  return {
    id: x.id, school: x.school, mode: x.mode, run_mode: x.run_mode || 'practice', target: x.target,
    range_codes: x.range_codes || [], cover_all: !!x.cover_all, daily_quest: !!x.daily_quest, assignment_id: x.assignment_id || null,
    manual_selection: !!x.manual_selection, exam_style: !!x.exam_style, quest_mix: x.quest_mix || null, word_ids: [...(x.words || [])],
    covered: x.seen?.length || 0, total: x.total, correct: hideTestScore ? null : x.correct, score_total: x.finished ? scoreTotal : (x.score_total || 0), score_correct: hideTestScore ? null : scoreCorrect, score: hideTestScore ? null : score,
    xp: hideTestScore ? null : x.xp, reward_points: x.finished ? Number(x.reward_points || 0) : undefined, reward_breakdown: x.finished ? (x.reward_breakdown || []) : undefined, combo: hideTestScore ? null : x.combo, best: hideTestScore ? null : x.best,
    started_at: x.started_at, finished_at: x.finished_at || null, ended_at: x.ended_at || null, finalized_at: x.finalized_at || null, duration_sec: x.duration_sec, deadline: x.deadline,
    timer_mode: x.timer_mode || 'session', question_duration_sec: Number(x.question_duration_sec || 0), question_started_at: x.question_started_at || null, question_deadline: x.question_deadline || null,
    auto_submitted: !!x.auto_submitted,
    shared_to_teacher_at: x.shared_to_teacher_at || null,
    wrong_count: x.finished ? wrongCount : undefined,
    unanswered_count: x.finished ? unansweredCount : undefined,
    perfect: x.finished ? perfect : undefined,
    answer_records: x.finished ? answerRecords : undefined,
    wrong_details: x.finished ? (x.wrong_details || []) : undefined,
    question: x.question, question_id: x.question_id, question_is_retry: !!x.question_is_retry, feedback: hideTestScore ? null : x.feedback,
    finished: x.finished, retry_count: x.retry.length,
    stats: growthFor(mySessions(state, x.student_id)), server_time: Date.now()
  };
}
