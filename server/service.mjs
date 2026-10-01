import { randomUUID, randomBytes } from 'node:crypto';
import builtinBooksData from '../data/vocabulary.json' with { type: 'json' };
import { EXAM_TYPES, PRACTICE_TYPES, PRACTICE_SECONDS_PER_QUESTION, TEST_SECONDS_PER_QUESTION, testDurationSec, TEST_LEAVE_LIMIT, PET_CARE, PET_MISS_DAYS, STARS_MAX, CHARACTERS, ACCESSORIES, FRAMES, EGG_PRICE, unlocked, growthFor, petProgress, cleanPetName, buildQuestion, choosePracticeWord, shuffle, grade, clamp, dayKey, displayEnglish, practiceDurationSec } from '../public/modules/core.js';
import { TITLES, TITLE_KEYS, titleUnlocked } from '../public/modules/titles.js';
import { battleQuestions } from '../public/modules/battle-questions.js';
import { battleMode } from '../public/modules/battle-engine.js';
import { STUDY_COINS, GIFT_AMOUNTS } from '../public/modules/rewards.js';
import { tidyProfileLogs, rewardIncome, attendanceCoins, attendanceView, checkIn, gachaView, luckyView, pullLucky, addBonus, bonusRecords, careView, petCare, botStart, botFinish, botView, examReward, unpaidTitles, payTitles, giveGift, giftsWaiting, openGifts } from './rewards.mjs';
import { DAY_MS, rankingWeek, gradeOf, rankGrade, battleStreaks, createCompetition, leagueStandings, isRankedStudent, isPrivate } from './competition.mjs';
import { createTournament, decideMatch, findMatch, playerMatch, eliminatedIn, roundLabel, tournamentPrizes, TOURNAMENT_MIN_PLAYERS, TOURNAMENT_MAX_PLAYERS, TOURNAMENT_PRIZES } from './tournament.mjs';
import { passwordHash, verifyPassword, hashToken, publicProfile, supabaseLogin } from './auth.mjs';
import { createVapidKeys } from './push.mjs';
import { pushState, pushView, addSubscription, removeSubscription, postNotice, noticeFor, eveningReminders } from './notify.mjs';
import { seonbu44Correction } from './seonbu44-correction.mjs';
import { middleGrade3Books } from './middle-vocab.mjs';
import { middleGrade2Books } from './middle-vocab-grade2.mjs';
import { ybmKimHighBooks, ybmKimRetiredWords } from './high-vocab-ybm-kim.mjs';
import { compactSession } from './state.mjs';
import packageInfo from '../package.json' with { type: 'json' };
export const APP_VERSION = packageInfo.version;
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
// A table lookup by a key from the request: own keys only (never 'constructor' or '__proto__').
const own = (table, key) => typeof key === 'string' && Object.hasOwn(table, key) ? table[key] : undefined;
// Grammar keys are "sentence:part". Real passages have at most 14 sentences, 37 choices and
// answers of a few words, so anything far past that is not a real save.
const grammarKey = (key, sentences) => {
  const m = /^(\d{1,3}):(\d{1,3})$/.exec(String(key));
  return m && Number(m[1]) < sentences && Number(m[2]) < 200 ? `${Number(m[1])}:${Number(m[2])}` : null;
};
const safeGrammarAnswers = (value, sentences = 120, choices = 150) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const safe = {};
  let count = 0;
  for (const [raw, answer] of Object.entries(value).slice(0, 400)) {
    const key = grammarKey(raw, sentences);
    if (!key || typeof answer !== 'string' || answer.length > 40 || Object.hasOwn(safe, key)) continue;
    safe[key] = answer;
    if (++count >= choices) break;
  }
  return safe;
};
const GRAMMAR_PASSAGES_PER_STUDENT = 80;
const MAX_TOKENS_PER_USER = 10;
const RESERVED_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
// Questions sent to a student must not carry the word id: bootstrap ships the
// student's word books, so an id maps straight to the correct answer.
const publicQuestion = question => {
  if (!question || typeof question !== 'object') return question;
  const { word_id, ...rest } = question;
  return rest;
};
const safeGrammarIndexes = (value, max = 120) => Array.isArray(value)
  ? [...new Set(value.map(Number).filter(n => Number.isInteger(n) && n >= 0 && n < max))].slice(0, max)
  : [];
const safeGrammarKeys = (value, sentences = 120, choices = 150) => Array.isArray(value)
  ? [...new Set(value.slice(0, 400).map(key => grammarKey(key, sentences)).filter(Boolean))].slice(0, choices)
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
// Retired words are no longer offered, but in-progress practices, disputes and
// records may still point at them.
const findWord = (state, wordId) => allBooks(state).flatMap(book => book.words || []).find(word => word.id === wordId)
  || ybmKimRetiredWords.find(word => word.id === wordId);
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
// How far today's recommended study has gone: answers in daily-quest records finished today
// plus the one in progress. The goal is the running quest's size, or today's composed size.
export function dailyQuestProgress(sessions, activePractice, target, now = Date.now()) {
  const today = dayKey(now);
  const running = activePractice && activePractice.daily_quest && !activePractice.finished ? activePractice : null;
  const goal = Math.max(1, Number(running ? running.target : target) || 20);
  const finishedAnswers = (sessions || [])
    .filter(s => s.daily_quest && dayKey(s.created_at) === today)
    .reduce((n, s) => n + Number(s.answered_count ?? s.total ?? 0), 0);
  const done = Math.min(goal, finishedAnswers + (running ? Number(running.score_total || 0) : 0));
  return { done_today: done, goal_today: goal, completed_today: done >= goal };
}
export function allBooks(state) { return [...builtinBooks.map(withoutLegacySeonbu44), seonbu44Correction, ...middleGrade2Books, ...middleGrade3Books, ...ybmKimHighBooks, ...state.extraBooks]; }
export function scopedWords(state, schoolRef, ranges, grade = null) {
  const school = schoolByRef(state, schoolRef);
  if (!school || !Array.isArray(ranges) || !ranges.length) fail('학교와 범위를 선택해주세요.');
  const words = wordsForSchoolGrade(state, school, grade);
  if (!ranges.every(r => words.some(w => w.range_code === String(r)))) fail('선택한 범위를 찾을 수 없습니다.');
  return words.filter(w => ranges.map(String).includes(w.range_code));
}
function mySessions(state, student) { return state.sessions.filter(s => s.student_id === student); }
// V13.70 practices plus the bonus rows (robot matches, teacher exams): what 경험치, levels, pets
// and coins are counted from. Screens that list practices use mySessions.
function xpSessions(state, student, profile = state.profiles.find(x => x.id === student)) {
  return [...mySessions(state, student), ...bonusRecords(profile)];
}
// V13.77 저녁 공부 알림 (run by the daily Cloudflare cron): who gets one, and the messages.
export function runEveningReminders(state, now = Date.now()) {
  const today = dayKey(now);
  const studied = new Set();
  for (const s of state.sessions) if (Number(s.created_at || 0) > now - 2 * DAY_MS && dayKey(Number(s.created_at)) === today) studied.add(s.student_id);
  for (const x of state.practices) if (Number(x.started_at || 0) > now - 2 * DAY_MS && dayKey(Number(x.started_at)) === today && Number(x.total || 0) > 0) studied.add(x.student_id);
  return eveningReminders(state, {
    now,
    studiedToday: p => studied.has(p.id),
    extra: p => {
      const g = stats(state, p);
      const pet = g.pet?.name || CHARACTERS[g.pet?.key || p.avatar_key]?.ko || '';
      return { streak: Number(g.streak || 0), pet };
    }
  });
}
// V13.76 the student's last activity before today (for the pet's 보고 싶었어).
function lastActiveBefore(state, p, now = Date.now()) {
  const today = dayKey(now), times = [Number(p.care?.last_at || 0)];
  for (const s of state.sessions) if (s.student_id === p.id) times.push(Number(s.created_at || 0));
  for (const b of state.battles || []) if (b.host_id === p.id || b.guest_id === p.id) times.push(Number(b.finished_at || b.created_at || 0));
  for (const x of p.attendance?.log || []) times.push(Number(x.at || 0));
  // Robot matches and teacher exams count too (they pay through the bonus ledger).
  for (const r of bonusRecords(p)) times.push(Number(r.created_at || 0));
  for (const a of state.examAttempts || []) if (a.student_id === p.id) times.push(Number(a.submitted_at || a.started_at || 0));
  return Math.max(0, ...times.filter(t => t && dayKey(t) !== today));
}
const coinBalance = (state, p) => pointsAndPets(state, p, xpSessions(state, p.id, p)).points_balance;
// Coins (코인, stored as reward points) are earned per finished practice and as tournament
// prizes, spent in the shop, and won or lost in yacha battles; pets grow separately with 경험치.
function pointsAndPets(state, p, sessions) {
  const earned = sessions.reduce((n, s) => n + Number(s.reward_points || 0), 0);
  const spent = Number(p.points_spent || 0);
  const battle = battleRecord(state, p.id);
  const prizes = tournamentPrizes(state, p.id);
  const pets = petProgress(p.pets, sessions, p.avatar_key);
  // Stakes of matches that have not been settled yet are held back, so a late result can
  // never be absorbed by a balance that was spent in the meantime.
  // V13.67: attendance, capsule refunds, coin capsule and double-chance pay-outs (rewards.mjs).
  // V13.70: robot-match and exam coins come in `sessions` as bonus rows (xpSessions).
  const bonus = rewardIncome(p);
  return { reward_points: earned, points_spent: spent, prize_points: prizes, bonus_points: bonus, points_balance: Math.max(0, earned + prizes + bonus - spent + battle.net - battle.held), battle, pets, pet: pets.find(x => x.active) || null, needs_pet_pick: p.role === 'student' && !pets.length };
}

// Yacha battles: 1:1 word duels between students of the same school and grade. The
// match itself runs in a battle room (cloudflare/battle-room.mjs); this state only
// keeps rooms, tickets and results. The winner takes the stake from the loser.
export const BATTLE_STAKES = [10, 30, 50];
export const BATTLE_DAILY_LOSS_CAP = 150;
const BATTLE_WAIT_MS = 10 * 60000;   // a room nobody joins closes
const BATTLE_STALE_MS = 20 * 60000;  // after this a match that has not reported stops blocking new ones
const BATTLE_ABANDON_MS = 2 * 3600000; // a match that never reported by then is called off
const BATTLE_KEEP_CANCELLED_MS = 7 * 86400000;
const BATTLE_QUESTIONS = 40;
const BATTLE_REMATCH_WINDOW_MS = 2 * 60000; // a rematch can be asked for this long after a match
// V13.68: no daily limit on rematches or challenges; the daily coin-loss cap still applies, and
// the league and titles still count only three matches a day with the same friend.
const battleIsOpen = (b, now) => (b.status === 'waiting' && now - b.created_at < BATTLE_WAIT_MS) || (b.status === 'active' && now - (b.joined_at || b.created_at) < BATTLE_STALE_MS);
const openBattleFor = (state, pid, now) => (state.battles || []).find(b => (b.host_id === pid || b.guest_id === pid) && battleIsOpen(b, now));
function battleRecord(state, pid) {
  const rows = (state.battles || []).filter(b => b.status === 'finished' && (b.host_id === pid || b.guest_id === pid));
  const wins = rows.filter(b => b.winner === pid), losses = rows.filter(b => b.loser === pid);
  const held = (state.battles || []).filter(b => b.status === 'active' && (b.host_id === pid || b.guest_id === pid)).reduce((n, b) => n + b.stake, 0);
  return { wins: wins.length, losses: losses.length, draws: rows.length - wins.length - losses.length, win_rate: rows.length ? Math.round(wins.length / rows.length * 100) : null, net: wins.reduce((n, b) => n + b.stake, 0) - losses.reduce((n, b) => n + b.stake, 0), held, ...battleStreaks(rows, pid) };
}
// Closes rooms nobody joined, calls off matches that never reported, drops tickets and
// ranges once a battle is over, and forgets old cancelled rooms (the state is uploaded
// whole on every backup, so it should not keep growing).
export function tidyBattles(state, now = Date.now()) {
  if (!Array.isArray(state.battles)) return false;
  let changed = false;
  for (const b of state.battles) {
    const expired = (b.status === 'waiting' && now - b.created_at >= BATTLE_WAIT_MS) || (b.status === 'active' && now - (b.joined_at || b.created_at) >= BATTLE_ABANDON_MS);
    if (expired) { Object.assign(b, { status: 'cancelled', reason: 'expired', finished_at: now }); changed = true; }
    // A finished match keeps its ranges while a rematch can still be asked for.
    const rematchOpen = b.status === 'finished' && now - (b.finished_at || 0) < BATTLE_REMATCH_WINDOW_MS;
    if (!['waiting', 'active'].includes(b.status) && (b.tickets || (b.range_codes && !rematchOpen))) { delete b.tickets; if (!rematchOpen) delete b.range_codes; changed = true; }
  }
  const kept = state.battles.filter(b => !(b.status === 'cancelled' && now - (b.finished_at || b.created_at) >= BATTLE_KEEP_CANCELLED_MS));
  if (kept.length !== state.battles.length) { state.battles = kept; changed = true; }
  // V13.66: a tournament called off is forgotten after a week (finished ones stay: they
  // carry champions and prizes).
  if (Array.isArray(state.tournaments)) {
    const tournaments = state.tournaments.filter(t => !(t.status === 'cancelled' && now - (t.finished_at || t.created_at) >= BATTLE_KEEP_CANCELLED_MS));
    if (tournaments.length !== state.tournaments.length) { state.tournaments = tournaments; changed = true; }
  }
  return changed;
}
function findJoinableBattle(state, p, code, now) {
  const battle = (state.battles || []).find(b => b.code === code && b.status === 'waiting' && battleIsOpen(b, now));
  const school = schoolForProfile(state, p);
  // Rooms of other schools or grades, and rematch rooms for someone else, answer exactly
  // like missing ones, so codes cannot be probed.
  if (!battle || school?.id !== battle.school_id || gradeOf(p.class_name) !== battle.grade || (battle.invite_id && battle.invite_id !== p.id)) fail('대결 방을 찾지 못했어요. 코드를 다시 확인해주세요. 같은 학교·학년 친구의 방만 들어갈 수 있어요.', 404);
  return battle;
}
const battleLossToday = (state, pid, now) => (state.battles || []).filter(b => b.status === 'finished' && b.loser === pid && dayKey(b.finished_at) === dayKey(now)).reduce((n, b) => n + b.stake, 0);
// What the room shows about a player: pet, win streak, and (V13.66) title and league tier.
function battlePlayer(state, p, ctx = createCompetition(state)) {
  const pet = pointsAndPets(state, p, xpSessions(state, p.id, p)).pet;
  return { id: p.id, name: p.display_name, pet: pet ? { key: pet.key, form: pet.form, name: pet.name || '' } : null, streak: battleRecord(state, p.id).streak, title: ctx.displayTitle(p), tier: ctx.league(p.id).tier.key };
}
function checkBattleEntry(state, p, stake, now) {
  if (!p.pets?.length) fail('먼저 첫 펫을 골라주세요.', 409);
  if (openBattleFor(state, p.id, now)) fail('이미 진행 중인 대결이 있어요.', 409);
  const balance = pointsAndPets(state, p, xpSessions(state, p.id, p)).points_balance;
  if (balance < stake) fail(`판돈 ${stake}코인이 필요해요. 지금 ${balance}코인이 있어요.`);
  if (battleLossToday(state, p.id, now) + stake > BATTLE_DAILY_LOSS_CAP) fail(`대결로 하루에 잃을 수 있는 코인은 ${BATTLE_DAILY_LOSS_CAP}코인까지예요. 내일 다시 도전해요.`);
}
const battleTicket = () => randomBytes(18).toString('hex');
// Builds the questions and opens a waiting room (a new one, or a rematch with `extra`).
// Opening and cancelling rooms over and over would fill the battle list (and, for a
// challenge, the friend's phone): a student opens at most this many rooms in 10 minutes.
const BATTLE_ROOMS_PER_10_MIN = 12;
const CHALLENGE_PUSH_GAP_MS = 3 * 60000;
function openBattleRoom(state, p, school, stake, rangeCodes, now, extra = {}) {
  if (!rangeCodes.length) fail('대결할 단어 범위를 골라주세요.');
  if (!extra.tournament_id && (state.battles || []).filter(b => b.host_id === p.id && !b.tournament_id && now - (b.created_at || 0) < 600000).length >= BATTLE_ROOMS_PER_10_MIN) fail('방을 너무 자주 만들었어요. 잠시 뒤에 다시 해 주세요.', 429);
  const words = scopedWords(state, school.id, rangeCodes, p.class_name);
  if (words.length < 8) fail('단어가 8개 이상인 범위를 골라주세요.', 409);
  // V13.67: 스피드전 (four choices) or 실력전 (spelling words mixed in).
  const mode = battleMode(extra.mode);
  extra = { ...extra, mode };
  const questions = battleQuestions(words, mode, BATTLE_QUESTIONS);
  if (questions.length < 8) fail('뜻이 서로 다른 단어가 부족해요. 범위를 더 골라주세요.', 409);
  state.battles ||= [];
  const openCodes = new Set(state.battles.filter(b => battleIsOpen(b, now)).map(b => b.code));
  let code;
  do code = String(100000 + (randomBytes(4).readUInt32BE(0) % 900000)); while (openCodes.has(code));
  const battle = { id: randomUUID(), code, status: 'waiting', school_id: school.id, division: school.division, grade: gradeOf(p.class_name), host_id: p.id, guest_id: null, stake, range_codes: rangeCodes, tickets: { [p.id]: battleTicket() }, created_at: now, ...extra };
  state.battles.push(battle);
  return { id: battle.id, code, stake, status: 'waiting', ticket: battle.tickets[p.id], expires_at: now + BATTLE_WAIT_MS,
    mode, _battle: { action: 'init', id: battle.id, stake, label: extra.label || null, mode, host: battlePlayer(state, p), questions, tickets: battle.tickets, expires_at: now + BATTLE_WAIT_MS } };
}

// V13.61 challenges: a room for one named friend of the same school and grade. The friend
// sees it on the home screen (bootstrap + a light poll) and accepts or declines it there.
function battleFriends(state, p, now) {
  const school = schoolForProfile(state, p), grade = gradeOf(p.class_name);
  const ctx = createCompetition(state, now);
  return state.profiles
    .filter(x => x.id !== p.id && x.role === 'student' && x.active !== false && !x.preview_owner_id && x.pets?.length && schoolForProfile(state, x)?.id === school?.id && gradeOf(x.class_name) === grade)
    .map(x => { const pet = pointsAndPets(state, x, xpSessions(state, x.id, x)).pet; return { id: x.id, name: x.display_name, class_name: x.class_name || '', same_class: x.class_name === p.class_name, pet: pet ? { key: pet.key, form: pet.form } : null, title: ctx.displayTitle(x), tier: ctx.league(x.id).tier.key, busy: !!openBattleFor(state, x.id, now), invited: !!battleInviteFor(state, x, now) }; })
    .sort((a, b) => Number(b.same_class) - Number(a.same_class) || a.name.localeCompare(b.name, 'ko'));
}
function battleInviteFor(state, p, now) {
  const b = (state.battles || []).filter(x => x.challenge && x.invite_id === p.id && x.status === 'waiting' && battleIsOpen(x, now)).sort((x, y) => y.created_at - x.created_at)[0];
  if (!b) return null;
  const host = state.profiles.find(x => x.id === b.host_id);
  const t = b.tournament_id ? (state.tournaments || []).find(x => x.id === b.tournament_id) : null;
  return { id: b.id, code: b.code, stake: b.stake, mode: battleMode(b.mode), host: host?.display_name || '', expires_at: b.created_at + BATTLE_WAIT_MS, ...(t ? { tournament: { id: t.id, name: t.name, round: b.label || '' } } : {}) };
}

// Called by the battle room (never by a browser) when a match ends. Idempotent.
export function settleBattle(state, result) {
  const b = (state.battles || []).find(x => x.id === result?.id);
  if (!b || !['waiting', 'active'].includes(b.status)) return false;
  const players = [b.host_id, b.guest_id];
  if (result.reason === 'cancelled' || !b.guest_id) { b.status = 'cancelled'; b.finished_at = Date.now(); return true; }
  const winner = players.includes(result.winner) ? result.winner : null;
  const skills = Object.fromEntries(players.map(id => [id, Math.max(0, Math.min(99, Math.floor(Number(result.skills?.[id]) || 0)))]).filter(([, n]) => n > 0));
  Object.assign(b, { status: 'finished', winner, loser: winner ? players.find(id => id !== winner) : null, reason: String(result.reason || 'end').slice(0, 20), hp: result.hp || {}, ...(Object.keys(skills).length ? { skills } : {}), finished_at: Date.now() });
  if (b.tournament_id) settleTournamentMatch(state, b);
  return true;
}
// V13.66: a finished tournament room decides its match; a draw is played again.
function settleTournamentMatch(state, b) {
  const t = (state.tournaments || []).find(x => x.id === b.tournament_id);
  const found = t?.status === 'active' ? findMatch(t, b.match_id) : null;
  if (!found || found.match.winner) return;
  if (b.winner && [found.match.a, found.match.b].includes(b.winner)) decideMatch(t, found.match.id, b.winner, 'match', b.finished_at);
  else { found.match.draws = Number(found.match.draws || 0) + 1; delete found.match.battle_id; }
}
function activePetKey(state, studentId) {
  const p = state.profiles.find(x => x.id === studentId);
  return p?.pets?.some(x => x.key === p.avatar_key) ? p.avatar_key : undefined;
}
// Words answered correctly this ranking week (Monday 00:00 KST onward); grows through the week.
export function weekCorrect(sessions, now = Date.now()) {
  const { start, end } = rankingWeek(now);
  return (sessions || []).filter(s => s.created_at >= start && s.created_at < end).reduce((n, s) => n + Number(s.correct || 0), 0);
}
function stats(state, p, sessions = mySessions(state, p.id)) {
  // V13.70: 경험치 and coins also come from robot matches and exams (bonus rows); counts of
  // practices, words and accuracy stay with the practices.
  const all = [...sessions, ...bonusRecords(p)];
  const isToday = s => dayKey(s.created_at) === dayKey(Date.now());
  const today = sessions.filter(isToday), todayAll = all.filter(isToday);
  const recent = [...sessions].sort((a, b) => b.created_at - a.created_at).slice(0, 20);
  const total = recent.reduce((n, s) => n + s.total, 0), correct = recent.reduce((n, s) => n + s.correct, 0);
  return {
    ...growthFor(all),
    week_correct: weekCorrect(sessions),
    today_total: today.reduce((n, s) => n + s.total, 0),
    today_xp: todayAll.reduce((n, s) => n + (s.xp || 0), 0),
    ...pointsAndPets(state, p, all),
    today_reward_points: todayAll.reduce((n, s) => n + Number(s.reward_points || 0), 0),
    // V13.73: the wallet's daily bar counts study coins only, like the daily cap does.
    today_study_points: today.reduce((n, s) => n + Number(s.reward_points || 0), 0),
    practice_count: sessions.length,
    accuracy: total ? Math.round(correct / total * 100) : 0,
    gacha: p.gacha?.items || {},
    weak: Object.values(state.mastery[p.id] || {}).filter(m => m.wrong > 0 && m.mastery < 80).length
  };
}

// V13.66 coins collected in a period (study rewards + stakes won + tournament prizes). Spending
// and lost stakes are not taken off, so buying an egg never drops a student in the ranking.
function coinsCollected(state, ctx, pid, window = null) {
  const inside = at => !window || (at >= window.start && at < window.end);
  const study = ctx.sessionsOf(pid).filter(s => inside(s.created_at)).reduce((n, s) => n + Number(s.reward_points || 0), 0);
  const won = ctx.battlesOf(pid).filter(b => b.winner === pid && inside(b.finished_at)).reduce((n, b) => n + Number(b.stake || 0), 0);
  return study + won + tournamentPrizes(state, pid, window) + attendanceCoins(ctx.profiles.get(pid), window);
}
function rankingRows(state, ctx, p) {
  const period = ctx.week;
  // V13.71: the same students the weekly titles are given to (teacher preview accounts are left
  // out, so the 1st place shown is the one who gets 주간 챔피언); a preview still sees itself.
  return state.profiles.filter(x => isRankedStudent(x) || x.id === p.id).map(s => {
    const records = ctx.sessionsOf(s.id);
    const weekly = records.filter(r => r.created_at >= period.start && r.created_at < period.end);
    const g = growthFor(records), isMe = s.id === p.id;
    const hidden = !isMe && isPrivate(s);
    const grade = rankGrade(s);
    const pet = hidden ? null : petProgress(s.pets, records, s.avatar_key).find(x => x.active);
    return {
      id: hidden ? null : s.id, is_me: isMe, private: hidden, grade,
      division: s.division || (grade.startsWith('중') ? 'middle' : 'high'),
      display_name: hidden ? '비공개 학생' : s.display_name,
      avatar_key: hidden ? 'lumi' : (s.avatar_key || 'lumi'),
      pet_name: pet?.name || '', pet_form: pet ? pet.form : 1,
      title: hidden ? null : ctx.displayTitle(s),
      level: hidden ? 1 : g.level, streak: g.streak,
      xp: weekly.reduce((n, r) => n + Number(r.xp || 0), 0),
      total: weekly.reduce((n, r) => n + Number(r.total || 0), 0),
      coins: coinsCollected(state, ctx, s.id, period),
      all_xp: records.reduce((n, r) => n + Number(r.xp || 0), 0),
      all_total: records.reduce((n, r) => n + Number(r.total || 0), 0),
      all_coins: coinsCollected(state, ctx, s.id),
      all_streak: g.streak
    };
  });
}
// V13.74 반 대항전: this week's 경험치 of each class of a school (study, robot matches, exams),
// for the teacher dashboard and the classroom TV. Ranked by the class total, as 원장님 asked.
function classLeague(state, ctx, school, now = Date.now()) {
  const week = rankingWeek(now);
  const classes = new Map();
  for (const x of state.profiles) {
    if (!isRankedStudent(x) || !x.class_name || schoolForProfile(state, x)?.id !== school.id) continue;
    const xp = ctx.sessionsOf(x.id).filter(s => s.created_at >= week.start && s.created_at < week.end).reduce((n, s) => n + Number(s.xp || 0), 0);
    const c = classes.get(x.class_name) || { name: x.class_name, xp: 0, students: 0, active: 0, top: [] };
    c.xp += xp; c.students++;
    if (xp > 0) { c.active++; c.top.push({ name: x.display_name, xp }); }
    classes.set(x.class_name, c);
  }
  const rows = [...classes.values()]
    .map(c => ({ ...c, avg: c.students ? Math.round(c.xp / c.students) : 0, top: c.top.sort((a, b) => b.xp - a.xp).slice(0, 3) }))
    .sort((a, b) => b.xp - a.xp || a.name.localeCompare(b.name, 'ko'));
  return { school: school.name, week: { start: week.start, end: week.end }, classes: rows, updated_at: now };
}
// V13.74 선생님 알림판: students with no study, robot match, exam, attendance or yacha match
// this week (and for 3 days or more). Derived from records: nothing is written on a visit.
function idleStudents(state, ctx, school, now = Date.now()) {
  const week = rankingWeek(now), rows = [];
  for (const x of state.profiles) {
    if (!isRankedStudent(x) || schoolForProfile(state, x)?.id !== school.id) continue;
    const times = ctx.sessionsOf(x.id).map(s => Number(s.created_at || 0));
    for (const b of ctx.battlesOf(x.id)) times.push(Number(b.finished_at || 0));
    const day = x.attendance?.last;
    if (day) times.push(Date.parse(`${day}T00:00:00+09:00`) || 0);
    const last = Math.max(0, ...times);
    rows.push({ id: x.id, name: x.display_name, class_name: x.class_name || '', last: last || null, week: last < week.start, days: last ? Math.floor((now - last) / DAY_MS) : null });
  }
  return rows.filter(r => r.week || r.days === null || r.days >= 3).sort((a, b) => (a.last || 0) - (b.last || 0) || a.name.localeCompare(b.name, 'ko'));
}

// The title collection of the signed-in student. `fresh`: titles unlocked since the student
// last looked (a limited title is new again each week it is won); `intro`: the student has not
// seen the V13.66 collection yet, so the app shows one summary instead of a pop-up per title.
const titleSeenKey = (ctx, key) => TITLES[key]?.tier === 'limited' ? `${key}@${ctx.lastWeek.key}` : key;
// V13.73 `unpaid`: held titles whose coins are not paid yet (new ones, and titles won before
// V13.73); they are paid when the app shows them (/titles/seen).
function titleView(ctx, p) {
  const stats = ctx.titleStats(p);
  const unlocked = TITLE_KEYS.filter(key => titleUnlocked(key, stats));
  const seen = Array.isArray(p.titles_seen) ? p.titles_seen : null;
  return {
    equipped: ctx.displayTitle(p), unlocked, stats,
    fresh: seen ? unlocked.filter(key => key !== 'rookie' && !seen.includes(titleSeenKey(ctx, key))) : [],
    intro: !seen,
    unpaid: unpaidTitles(p, unlocked, key => titleSeenKey(ctx, key)),
    week_end: ctx.week.end
  };
}
function leagueView(ctx, p) {
  const table = leagueStandings(ctx, p, 'week');
  const mine = table.find(row => row.is_me);
  const lg = ctx.league(p.id);
  return { points: lg.points, wins: lg.wins, losses: lg.losses, draws: lg.draws, played: lg.played, win_rate: lg.win_rate, tier: lg.tier, rank: mine?.rank ?? null, size: table.length, week_end: ctx.week.end, week_label: ctx.week.label };
}
function petSummary(ctx, profile) {
  if (!profile) return null;
  const pet = petProgress(profile.pets || [], ctx.sessionsOf(profile.id), profile.avatar_key).find(x => x.active);
  return pet ? { key: pet.key, form: pet.form } : null;
}
// V13.66 tournament as the app draws it: the bracket with names, which matches are being
// played, and for a student their own next match.
function tournamentView(state, ctx, t, viewer, now = Date.now()) {
  const person = id => { const x = id ? ctx.profiles.get(id) : null; return x ? { id: x.id, name: x.display_name, class_name: x.class_name || '', pet: petSummary(ctx, x) } : (id ? { id, name: '(탈퇴한 학생)', class_name: '' } : null); };
  const open = new Map((state.battles || []).filter(b => b.tournament_id === t.id && battleIsOpen(b, now)).map(b => [b.match_id, b]));
  const mine = viewer.role === 'student' ? playerMatch(t, viewer.id) : null;
  let match = null;
  if (mine) {
    const oppId = mine.match.a === viewer.id ? mine.match.b : mine.match.a;
    const opp = oppId ? ctx.profiles.get(oppId) : null;
    const room = open.get(mine.match.id);
    match = { id: mine.match.id, round: mine.label, ready: mine.ready, draws: Number(mine.match.draws || 0),
      opponent: opp ? { id: opp.id, name: opp.display_name, title: ctx.displayTitle(opp), pet: petSummary(ctx, opp) } : null,
      room: room ? { host: room.host_id === viewer.id, status: room.status } : null };
  }
  return {
    id: t.id, name: t.name, status: t.status, grade: t.grade, class_name: t.class_name || null, prize: Number(t.prize || 0), mode: battleMode(t.mode),
    created_at: t.created_at, finished_at: t.finished_at || null, players: t.players.length,
    champion: person(t.champion), runner_up: person(t.runner_up),
    rounds: t.rounds.map(round => ({ label: roundLabel(round.length), matches: round.map(m => ({ id: m.id, a: person(m.a), b: person(m.b), winner: m.winner || null, by: m.by || null, draws: Number(m.draws || 0), live: open.get(m.id)?.status || null })) })),
    me: viewer.role === 'student' ? { match, out: eliminatedIn(t, viewer.id), champion: t.champion === viewer.id } : null
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
    ...(a.status === 'active' ? { questions: a.questions.map(publicQuestion), answers: a.answers, revision: a.revision, lease: a.lease } : {}),
    // V13.70 the reward follows answered questions only, so it shows even before results are out.
    ...(submitted && a.reward ? { reward: a.reward } : {}),
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
  // V13.70 the first submitted attempt of an exam gives 경험치 per answered question and coins.
  const student = state.profiles.find(x => x.id === a.student_id);
  const first = !state.examAttempts.some(x => x !== a && x.exam_id === a.exam_id && x.student_id === a.student_id && x.status === 'submitted');
  if (student && first) {
    const answered = a.questions.filter((q, i) => String(a.answers[i] ?? '').trim()).length;
    const reward = examReward(answered, a.questions.length);
    addBonus(student, { xp: reward.xp, coins: reward.coins, pet: activePetKey(state, student.id), now: a.submitted_at });
    a.reward = reward;
  }
}
// Practices nobody touched for this long are closed: they were kept whole (question
// cache, answer responses, word list) and were a large share of the backed-up state.
export const STALE_PRACTICE_MS = 3 * DAY_MS;
function closeStalePractices(state, now) {
  let changed = false;
  for (const x of state.practices) {
    if (x.finished) continue;
    // V13.80: a 실전시험 left open past its time limit is handed in at that time.
    if (x.run_mode === 'test' && x.timer_mode !== 'question' && Number(x.deadline || 0) && now >= Number(x.deadline) + TEST_ANSWER_GRACE_MS) {
      if (Number(x.total || 0) > 0) finishPractice(x, state, true); else x.discarded = true;
      changed = true;
      continue;
    }
    const lastActivity = Math.max(Number(x.started_at || 0), ...(x.answer_records || []).map(item => Number(item?.at || 0)));
    if (lastActivity > now - STALE_PRACTICE_MS) continue;
    // Answers given: close it the way a finish does (the existing path used when a
    // student changes school), so the answers become a record. No answers: nothing to keep.
    if (Number(x.total || 0) > 0) finishPractice(x, state);
    else x.discarded = true;
    changed = true;
  }
  if (state.practices.some(x => x.discarded)) state.practices = state.practices.filter(x => !x.discarded);
  return changed;
}

// Answer records of sessions older than two days drop what can be rebuilt exactly: the
// English word and meaning when they equal the built-in word list, and false flags.
// /bootstrap rebuilds them (hydrateSession), so screens get the same records. Words from
// teacher-imported books are kept as stored because an imported book can be removed.
export const COMPACT_SESSION_AFTER_MS = 2 * DAY_MS;
let builtinWordIndex = null;
function builtinWords() {
  if (!builtinWordIndex) {
    builtinWordIndex = new Map();
    for (const word of ybmKimRetiredWords) builtinWordIndex.set(word.id, word);
    for (const book of allBooks({ extraBooks: [] })) for (const word of book.words || []) builtinWordIndex.set(word.id, word);
  }
  return builtinWordIndex;
}
function compactRecord(record, words) {
  if (!record || typeof record !== 'object') return false;
  let changed = false;
  if (record.timed_out === false) { delete record.timed_out; changed = true; }
  if (record.regraded === false) { delete record.regraded; changed = true; }
  const word = words.get(record.word_id);
  if (word && 'word' in record && 'meaning' in record && record.word === displayEnglish(word.word) && record.meaning === word.meaning) {
    delete record.word; delete record.meaning; changed = true;
  }
  return changed;
}
function compactOldSessions(state, now) {
  let changed = false, words = null;
  for (const session of state.sessions) {
    if (Number(session.created_at || 0) > now - COMPACT_SESSION_AFTER_MS) continue;
    for (const list of [session.answer_records, session.wrong_details]) {
      if (!Array.isArray(list)) continue;
      for (const record of list) {
        if (!record || (!('word' in record) && record.timed_out !== false && record.regraded !== false)) continue;
        words ??= builtinWords();
        if (compactRecord(record, words)) changed = true;
      }
    }
  }
  return changed;
}
function hydrateRecord(record, words) {
  if ('word' in record && 'meaning' in record && 'timed_out' in record && 'regraded' in record) return record;
  const word = words.get(record.word_id);
  return { ...record, word: record.word ?? (word ? displayEnglish(word.word) : ''), meaning: record.meaning ?? word?.meaning ?? '', timed_out: !!record.timed_out, regraded: !!record.regraded };
}
// V13.64: the teacher list only needs each record's scores and counts. The per-answer lists were
// ~85% of the teacher bootstrap, so they are left out here and loaded one record at a time
// (GET /sessions/:id) when the teacher opens "답안 보기".
export function sessionSummary(session) {
  const { answer_records, wrong_details, word_ids, ...rest } = session;
  return { ...rest, details_omitted: true };
}
export function hydrateSession(session) {
  const lists = ['answer_records', 'wrong_details'].filter(key => Array.isArray(session[key]) && session[key].some(record => record && !('word' in record && 'meaning' in record && 'timed_out' in record && 'regraded' in record)));
  if (!lists.length) return session;
  const words = builtinWords();
  return { ...session, ...Object.fromEntries(lists.map(key => [key, session[key].map(record => record ? hydrateRecord(record, words) : record)])) };
}

export function sweep(state, now = Date.now()) {
  let changed = false;
  for (const a of state.examAttempts) if (a.status === 'active' && a.deadline <= Date.now()) { finishExam(a, state, true); changed = true; }
  if (closeStalePractices(state, now)) changed = true;
  if (compactOldSessions(state, now)) changed = true;
  if (autoResolveMeaningDisputes(state) > 0) changed = true;
  if (tidyBattles(state)) changed = true;
  if (tidyProfileLogs(state, now)) changed = true;
  const tokens = state.tokens.filter(t => t.expires_at > Date.now());
  if (tokens.length !== state.tokens.length) { state.tokens = tokens; changed = true; }
  return changed;
}
// Checks a local password against a read-only state snapshot so the costly
// scrypt work can run before the request enters the serialized mutation queue.
// Returns the verified profile id, or null when the caller must fall back to
// the in-queue path (Supabase auth, unknown user).
export async function preauthenticateLogin(state, body) {
  const username = str(body?.username).toLowerCase();
  const password = String(body?.password || '');
  const localProfile = state.profiles.find(profile => profile.username === username && profile.active);
  if (!localProfile?.password_hash) return null;
  if (!(await verifyPassword(password, localProfile.password_hash))) fail('아이디 또는 비밀번호를 확인해주세요.', 401);
  return localProfile.id;
}
// Routes that change state. GET requests run against the live snapshot outside
// the durable queue, so they must never reach these handlers.
const MUTATING_WITHOUT_METHOD_CHECK = /^\/(?:logout|practice\/[^/]+\/(?:answer|next|finish|leave|pass))$/;
export async function service(state, method, path, body, token, options = {}) {
  if (method === 'GET' && MUTATING_WITHOUT_METHOD_CHECK.test(path)) fail('요청 방식을 확인해주세요.', 405);
  if (path === '/health') return { ok: true, version: APP_VERSION, schema_version: state.schema_version, ready: state.profiles.some(p => p.role === 'teacher') || process.env.AUTH_PROVIDER === 'supabase' };
  if (path === '/session' && method === 'GET') { const auth = state.tokens.find(t => t.hash === hashToken(token || '') && t.expires_at > Date.now()); return { authenticated: state.profiles.some(p => p.id === auth?.user_id && p.active) }; }
  // V13.71 교실 TV link: a bracket-only view for the classroom screen, opened with a random link
  // the teacher makes (no teacher login on the shared TV). It lasts until a day after the
  // tournament ends; making a new link ends the old one.
  if (path === '/tv/bracket' && method === 'GET') {
    const raw = str(body.token, 80);
    const t = raw.length >= 24 ? (state.tournaments || []).find(x => x.tv_hash && x.tv_hash === hashToken(raw)) : null;
    const now = Date.now();
    if (!t || t.status === 'cancelled' || (t.status !== 'active' && now - Number(t.finished_at || 0) > DAY_MS)) fail('TV 링크가 만료됐어요. 선생님께 새 링크를 받아 주세요.', 404);
    return { tournament: tournamentView(state, createCompetition(state), t, { role: 'tv', id: null }, now) };
  }
  // V13.74 반 대항전 on the classroom TV, opened with a link (no login), like the bracket.
  if (path === '/tv/classes' && method === 'GET') {
    const raw = str(body.token, 80);
    const t = raw.length >= 24 ? state.profiles.find(x => x.role === 'teacher' && x.active !== false && x.class_tv?.hash === hashToken(raw)) : null;
    const school = t ? schoolByRef(state, t.class_tv.school_id) : null;
    if (!school || !t.school_ids?.includes(school.id) || Date.now() - Number(t.class_tv.at || 0) > 60 * DAY_MS) fail('TV 링크가 만료됐어요. 선생님께 새 링크를 받아 주세요.', 404);
    return { league: classLeague(state, createCompetition(state), school) };
  }
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
      const preauthenticated = options.preauthenticatedUserId && options.preauthenticatedUserId === p.id;
      if (!preauthenticated && !(await verifyPassword(password, p.password_hash))) fail('아이디 또는 비밀번호를 확인해주세요.', 401);
    } else if (process.env.AUTH_PROVIDER === 'supabase') {
      const result = await supabaseLogin(username, password); p = result.profile; supabaseAccessToken = result.accessToken;
      const old = state.profiles.find(x => x.id === p.id);
      if (old) { const style = Object.fromEntries(['avatar_key', 'avatar_accessory', 'avatar_frame', 'avatar_title', 'titles_seen', 'pets', 'points_spent', 'purchases', 'attendance', 'gacha', 'lucky', 'chance', 'chance_live', 'bonus'].filter(k => old[k]).map(k => [k, old[k]])); Object.assign(old, p, style); p = old; }
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
    const userTokens = state.tokens.filter(t => t.user_id === p.id).sort((a, b) => a.expires_at - b.expires_at);
    if (userTokens.length >= MAX_TOKENS_PER_USER) {
      const drop = new Set(userTokens.slice(0, userTokens.length - MAX_TOKENS_PER_USER + 1));
      state.tokens = state.tokens.filter(t => !drop.has(t));
    }
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
    const now = Date.now();
    const competition = createCompetition(state, now);
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
      assignment_id: activePractice.assignment_id || null,
      daily_quest: !!activePractice.daily_quest
    } : null;
    return { profile, divisions: teacher ? ['middle','high'] : [selectedDivision], schools, books, stats: stats(state, p, sessions), mastery: state.mastery[p.id] || {}, word_mastery: wordMastery, daily_quest: dailyQuest ? { target: dailyQuest.target, mix: dailyQuest.mix, range_codes: dailyQuest.range_codes, ...dailyQuestProgress(sessions, activePractice, dailyQuest.target) } : null, battle_invite: p.role === 'student' ? battleInviteFor(state, p, Date.now()) : null, grammar_progress: grammarProgress, meaning_aliases: teacher ? state.meaningAliases : {}, meaning_alias_meta: teacher ? state.meaningAliasMeta : {}, meaning_disputes: meaningDisputes,
      profiles: teacher ? studentProfiles.map(s => ({ ...publicProfile(s), stars: undefined, care: undefined, stats: stats(state, s, sessionsByStudent.get(s.id) || []) })) : [],
      sessions: sessions.map(teacher ? sessionSummary : hydrateSession), exams: visibleExams,
      assignments: state.assignments.filter(a => teacher ? sameSchool(a, selectedSchool) : (a.class_name === p.class_name && sameSchool(a, studentSchool) && a.active)),
      attempts: attempts.map(a => attemptSummary(a, state, p)), server_time: Date.now(),
      active_practice: activePractice?.id || null,
      active_practice_summary: activePracticeSummary,
      ranking_period: rankingWeek(Date.now()),
      ranking: teacher ? [] : rankingRows(state, competition, p),
      titles: teacher ? null : titleView(competition, p),
      gifts: teacher ? null : giftsWaiting(p),
      gifts_sent: teacher ? (p.gifts_sent || []).slice(-10).reverse() : null,
      class_league: teacher && selectedSchool ? classLeague(state, competition, selectedSchool, now) : null,
      idle_students: teacher && selectedSchool ? idleStudents(state, competition, selectedSchool, now) : null,
      league: teacher ? null : leagueView(competition, p),
      rewards: teacher ? null : { attendance: attendanceView(p, now), gacha: gachaView(p), lucky: luckyView(p, now), bot: botView(p, now) },
      care: teacher ? null : careView(p, lastActiveBefore(state, p, now), now),
      push: teacher ? null : pushView(state, p),
      notice: teacher ? null : noticeFor(state, p, studentSchool, now),
      push_reach: teacher && selectedSchool ? studentProfiles.filter(s => (state.push?.subs?.[s.id] || []).length).length : null,
      notices_sent: teacher && selectedSchool ? (state.push?.notices || []).filter(n => n.school_id === selectedSchool.id).slice(-5).reverse() : null,
      tournaments: (state.tournaments || []).filter(t => teacher ? t.school_id === selectedSchool?.id && (t.status !== 'cancelled' || now - (t.finished_at || t.created_at) < DAY_MS) : t.players.includes(p.id) && (t.status === 'active' || (t.status === 'finished' && now - (t.finished_at || 0) < 3 * DAY_MS)))
        .sort((a, b) => b.created_at - a.created_at).slice(0, 12).map(t => tournamentView(state, competition, t, p, now))
    };
  }
  if (path === '/teacher/student-preview' && method === 'POST') {
    requireRole(p, 'teacher');
    const school = schoolByRef(state, body.school_id || body.school || p.active_school_id);
    if (!school || !p.school_ids?.includes(school.id)) fail('미리보기 학교를 확인해주세요.', 403);
    const grade = str(body.grade, 20);
    if (!divisionClassAllowed(school.division, grade)) fail('미리보기 학년/반을 확인해주세요.', 400);
    const previewId = `teacher-preview:${p.id}:${school.id}:${grade}`;
    let preview = state.profiles.find(item => item.id === previewId);
    if (!preview) {
      preview = {
        id: previewId, role: 'student', username: previewId, display_name: `미리보기 · ${school.name}`,
        class_name: grade, division: school.division, school_id: school.id, school: school.name,
        active: true, preview_owner_id: p.id, avatar_key: 'dog', pets: [{ key: 'dog', first: true, acquired_at: Date.now() }], avatar_accessory: 'none',
        avatar_frame: 'basic', avatar_title: 'rookie', ranking_public: false, share_profile: false,
        created_at: Date.now()
      };
      state.profiles.push(preview);
    } else {
      Object.assign(preview, { class_name: grade, division: school.division, school_id: school.id, school: school.name, active: true, preview_owner_id: p.id });
    }
    const raw = randomBytes(32).toString('base64url');
    state.tokens.push({ hash: hashToken(raw), user_id: preview.id, expires_at: Date.now() + 2 * 3600000, preview_owner_id: p.id });
    return { ok: true, profile: publicProfile(preview), _cookie: raw };
  }
  if (path === '/student-preview/exit' && method === 'POST') {
    requireRole(p, 'student');
    // Only the preview token the teacher was handed can go back to the teacher.
    if (!p.preview_owner_id || auth?.preview_owner_id !== p.preview_owner_id) fail('미리보기 계정이 아닙니다.', 403);
    const owner = state.profiles.find(item => item.id === p.preview_owner_id && item.role === 'teacher' && item.active);
    if (!owner) fail('교사 계정을 찾을 수 없습니다.', 404);
    const raw = randomBytes(32).toString('base64url');
    state.tokens.push({ hash: hashToken(raw), user_id: owner.id, expires_at: Date.now() + 7 * 86400000 });
    state.tokens = state.tokens.filter(item => item !== auth);
    return { ok: true, profile: publicProfile(owner), _cookie: raw };
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
    if (!/^[a-z0-9~._-]{3,80}$/i.test(passageId) || RESERVED_KEYS.has(passageId)) fail('지문 정보를 확인해주세요.');
    if (body.reset === true) {
      delete state.grammarProgress[p.id][passageId];
      return { ok: true, passage_id: passageId, reset: true };
    }
    if (!Object.hasOwn(state.grammarProgress[p.id], passageId) && Object.keys(state.grammarProgress[p.id]).length >= GRAMMAR_PASSAGES_PER_STUDENT) fail('저장할 수 있는 지문 수를 넘었어요. 선생님께 문의해주세요.', 409);
    const school = schoolForProfile(state, p);
    const sentenceCount = integer(body.sentence_count, 1, 120, '문장 수');
    const choiceCount = integer(body.choice_count, 1, 150, '선택지 수');
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
      answers: safeGrammarAnswers(body.answers, sentenceCount, choiceCount),
      wrong_keys: safeGrammarKeys(body.wrong_keys, sentenceCount, choiceCount),
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
    // V13.71: an accessory that no longer exists (the removed capsule badges) falls back to '기본'
    // instead of blocking every later change of look.
    if (!own(ACCESSORIES, body.avatar_accessory)) body.avatar_accessory = 'none';
    const titleOk = own(TITLES, body.avatar_title) && titleUnlocked(body.avatar_title, createCompetition(state).titleStats(p));
    if (!own(CHARACTERS, body.avatar_key) || !unlocked(own(ACCESSORIES, body.avatar_accessory), growth) || !unlocked(own(FRAMES, body.avatar_frame), growth) || !titleOk) fail('아직 열리지 않은 보상입니다.');
    if (p.pets?.length && !p.pets.some(x => x.key === body.avatar_key)) fail('아직 만나지 못한 펫이에요.', 403);
    Object.assign(p, { avatar_key: body.avatar_key, avatar_accessory: body.avatar_accessory, avatar_frame: body.avatar_frame, avatar_title: body.avatar_title });
    return publicProfile(p);
  }
  // V13.66 titles: equip one from the collection, and remember which new ones were shown.
  if (path === '/profile/title' && method === 'POST') {
    requireRole(p, 'student');
    const key = str(body.key, 40);
    if (!own(TITLES, key)) fail('칭호를 확인해주세요.');
    if (!titleUnlocked(key, createCompetition(state).titleStats(p))) fail('아직 얻지 못한 칭호예요.', 403);
    p.avatar_title = key;
    return { equipped: key };
  }
  if (path === '/titles/seen' && method === 'POST') {
    requireRole(p, 'student');
    const ctx = createCompetition(state);
    const stats = ctx.titleStats(p);
    const keys = (Array.isArray(body.keys) ? body.keys : []).map(key => str(key, 40)).filter(key => own(TITLES, key) && titleUnlocked(key, stats));
    // Every title held now counts as seen once the collection has been introduced. Limited
    // titles are remembered per week; older weeks are dropped.
    const all = body.all === true ? TITLE_KEYS.filter(key => titleUnlocked(key, stats)) : keys;
    const kept = (Array.isArray(p.titles_seen) ? p.titles_seen : []).filter(entry => typeof entry === 'string' && (!entry.includes('@') || entry.endsWith('@' + ctx.lastWeek.key)));
    // V13.73: the titles just shown pay their coins, and so do held titles already seen before
    // (titles won before coins were paid for them).
    const seenBefore = TITLE_KEYS.filter(key => titleUnlocked(key, stats) && kept.includes(titleSeenKey(ctx, key)));
    p.titles_seen = [...new Set([...kept, ...all.map(key => titleSeenKey(ctx, key))])].slice(0, 160);
    const paid = payTitles(p, [...new Set([...all, ...seenBefore])], key => titleSeenKey(ctx, key), ctx.lastWeek.key);
    return { ok: true, seen: p.titles_seen.length, paid, paid_coins: paid.reduce((n, x) => n + x.coins, 0), points_balance: coinBalance(state, p) };
  }
  // Pets: the first one is chosen once for free; others come from random eggs in the shop.
  if (path === '/pets/choose' && method === 'POST') {
    requireRole(p, 'student');
    if (p.pets?.length) fail('첫 펫은 이미 골랐어요. 새 친구는 상점의 알에서 만날 수 있어요.', 409);
    if (!own(CHARACTERS, body.key)) fail('펫을 확인해주세요.');
    p.pets = [{ key: body.key, first: true, acquired_at: Date.now() }];
    p.avatar_key = body.key;
    return publicProfile(p);
  }
  if (path === '/pets/active' && method === 'POST') {
    requireRole(p, 'student');
    if (!p.pets?.some(x => x.key === body.key)) fail('아직 만나지 못한 펫이에요.', 403);
    p.avatar_key = body.key;
    return publicProfile(p);
  }
  // V13.67 coin rewards and games: attendance and the coin capsule (the double chance left in V13.70).
  if (path === '/rewards' && method === 'GET') {
    requireRole(p, 'student');
    const now = Date.now();
    return { attendance: attendanceView(p, now), gacha: gachaView(p), lucky: luckyView(p, now), bot: botView(p, now), points_balance: coinBalance(state, p) };
  }
  // V13.73 coin gifts from a teacher: the student opens the waiting gift boxes.
  if (path === '/gifts/open' && method === 'POST') {
    requireRole(p, 'student');
    const gifts = openGifts(p, Date.now());
    return { gifts, coins: gifts.reduce((n, g) => n + g.amount, 0), points_balance: coinBalance(state, p) };
  }
  if (path === '/teacher/class-league' && method === 'GET') {
    requireRole(p, 'teacher');
    const school = activeTeacherSchool(state, p);
    if (!school) fail('관리 학교를 확인해주세요.', 409);
    return { league: classLeague(state, createCompetition(state), school) };
  }
  // A new link ends the old one; it lasts 60 days.
  if (path === '/teacher/class-league/tv' && method === 'POST') {
    requireRole(p, 'teacher');
    const school = activeTeacherSchool(state, p);
    if (!school) fail('관리 학교를 확인해주세요.', 409);
    const token = randomBytes(24).toString('base64url');
    p.class_tv = { hash: hashToken(token), school_id: school.id, at: Date.now() };
    return { token };
  }
  if (path === '/teacher/gifts' && method === 'POST') {
    requireRole(p, 'teacher');
    const school = activeTeacherSchool(state, p);
    if (!school) fail('관리 학교를 확인해주세요.', 409);
    const amount = Number(body.amount);
    if (!GIFT_AMOUNTS.includes(amount)) fail('선물할 코인을 골라주세요.');
    const pool = state.profiles.filter(x => isRankedStudent(x) && schoolForProfile(state, x)?.id === school.id);
    const className = str(body.class_name, 20);
    const ids = new Set((Array.isArray(body.student_ids) ? body.student_ids : []).map(value => str(value, 80)).filter(Boolean));
    const targets = body.all === true ? pool : className ? pool.filter(x => x.class_name === className) : pool.filter(x => ids.has(x.id));
    if (!targets.length) fail('선물 받을 학생을 골라주세요.');
    if (targets.length > 300) fail('한 번에 300명까지 선물할 수 있어요.');
    const now = Date.now(), note = str(body.note, 60);
    for (const x of targets) giveGift(x, { id: randomUUID(), amount, note, from: p.id, fromName: p.display_name || '선생님', now });
    const label = body.all === true ? `${school.name} 전체` : className ? className : targets.length === 1 ? targets[0].display_name : `${targets[0].display_name} 외 ${targets.length - 1}명`;
    p.gifts_sent = [...(p.gifts_sent || []), { at: now, amount, count: targets.length, label, note: note.slice(0, 40), school_id: school.id }].slice(-30);
    return { sent: targets.length, amount, total: targets.length * amount, gifts_sent: p.gifts_sent.slice(-10).reverse(),
      _push: [{ to: targets.map(x => x.id), title: `🎁 ${p.display_name || '선생님'}의 선물이 도착했어요`, body: `응원 코인 ${amount}개${note ? ` · ${note}` : ''}`, url: '/?go=home', tag: 'gift' }] };
  }
  // V13.76 펫 교감 (once a day each) and starred words (어려운 단어 ⭐, kept on the account).
  if (path === '/pet/care' && method === 'POST') {
    requireRole(p, 'student');
    const now = Date.now();
    const result = petCare(p, str(body.kind, 10), { pet: activePetKey(state, p.id), now });
    return { ...result, care: careView(p, lastActiveBefore(state, p, now), now), stats: stats(state, p) };
  }
  if (path === '/stars' && method === 'POST') {
    requireRole(p, 'student');
    const school = schoolForProfile(state, p);
    if (!school) fail('학생 학교 설정을 확인해주세요.', 409);
    const known = new Set(wordsForSchoolGrade(state, school, p.class_name).map(w => w.id));
    let stars = Array.isArray(p.stars) ? p.stars : [];
    if (Array.isArray(body.word_ids)) stars = [...new Set([...stars, ...body.word_ids.map(v => str(v, 120)).filter(v => known.has(v))])];
    else {
      const wordId = str(body.word_id, 120);
      // A star can always be taken off, even when the word left the student's list.
      if (body.on !== false && !known.has(wordId)) fail('단어를 찾을 수 없어요.', 404);
      stars = body.on === false ? stars.filter(v => v !== wordId) : [...new Set([...stars, wordId])];
    }
    p.stars = stars.slice(-STARS_MAX);
    return { stars: p.stars };
  }
  // V13.77 알림 (web push). The key pair is made on first use and kept in the state.
  if (path === '/push/key' && method === 'POST') {
    const push = pushState(state);
    if (!push.vapid) push.vapid = await createVapidKeys();
    return { key: push.vapid.public_key };
  }
  if (path === '/push/subscribe' && method === 'POST') {
    requireRole(p, 'student');
    const push = pushState(state);
    if (!push.vapid) fail('알림 준비가 아직 안 됐어요. 다시 눌러 주세요.', 409);
    // The contact address the push services see: this app's own address, never one sent by a phone.
    const origin = str(options.origin, 200);
    if (/^https:\/\/[a-z0-9.-]+(?::\d+)?$/i.test(origin)) push.subject = origin;
    addSubscription(state, p, body.subscription, { ua: str(body.device, 40) });
    if (typeof body.daily === 'boolean') push.prefs[p.id] = { ...(push.prefs[p.id] || {}), daily: body.daily };
    // quiet: the phone registered itself again (after an error), without the student asking.
    if (body.quiet === true) return { push: pushView(state, p) };
    return { push: pushView(state, p), _push: [{ to: [p.id], title: '🔔 알림이 켜졌어요', body: '선생님 공지, 도전장, 선물, 저녁 공부 알림을 여기로 보내 줄게요.', url: '/?go=me', tag: 'hello' }] };
  }
  if (path === '/push/unsubscribe' && method === 'POST') {
    requireRole(p, 'student');
    removeSubscription(state, p, str(body.endpoint, 1000));
    return { push: pushView(state, p) };
  }
  if (path === '/push/settings' && method === 'POST') {
    requireRole(p, 'student');
    const push = pushState(state);
    push.prefs[p.id] = { ...(push.prefs[p.id] || {}), daily: body.daily !== false };
    return { push: pushView(state, p) };
  }
  if (path === '/teacher/notice' && method === 'POST') {
    requireRole(p, 'teacher');
    const school = activeTeacherSchool(state, p);
    if (!school) fail('관리 학교를 확인해주세요.', 409);
    const className = str(body.class_name, 20);
    const students = state.profiles.filter(x => isRankedStudent(x) && schoolForProfile(state, x)?.id === school.id && (!className || x.class_name === className));
    if (!students.length) fail('공지를 받을 학생이 없어요.');
    const posted = postNotice(state, p, school, students, { text: body.text, className, id: randomUUID() });
    return { notice: posted.notice, reach: posted.reach, total: posted.total, _push: [posted.message] };
  }
  if (path === '/attendance/check' && method === 'POST') {
    requireRole(p, 'student');
    return { ...checkIn(p, Date.now()), points_balance: coinBalance(state, p), tickets: gachaView(p).tickets };
  }
  // V13.68 coin capsule: bet 10·20·30 coins (or a free ticket); ×0·×1·×2·×3 comes back.
  if (path === '/lucky/pull' && method === 'POST') {
    requireRole(p, 'student');
    // Like eggs: a stake waiting in a yacha room is not spent elsewhere (a free ticket is fine).
    if (body.ticket !== true && openBattleFor(state, p.id, Date.now())?.stake > 0) fail('대결이 끝난 뒤에 코인 뽑기를 할 수 있어요.', 409);
    const result = pullLucky(p, Number(body.bet), coinBalance(state, p), { ticket: body.ticket === true });
    return { ...result, points_balance: coinBalance(state, p) };
  }
  // V13.70 robot practice match: announced at the start, paid (a few coins and 경험치) at the end.
  if (path === '/battle/practice/start' && method === 'POST') {
    requireRole(p, 'student');
    return botStart(p, { level: str(body.level, 10), mode: battleMode(body.mode), id: id(), now: Date.now() });
  }
  if (path === '/battle/practice/finish' && method === 'POST') {
    requireRole(p, 'student');
    const result = botFinish(p, { id: str(body.id, 80), result: str(body.result, 10), right: Number(body.right), pet: activePetKey(state, p.id), now: Date.now() });
    return { ...result, points_balance: coinBalance(state, p), stats: stats(state, p) };
  }
  if (path === '/shop/egg' && method === 'POST') {
    requireRole(p, 'student');
    if (!p.pets?.length) fail('먼저 첫 펫을 골라주세요.', 409);
    const missing = Object.keys(CHARACTERS).filter(key => !p.pets.some(x => x.key === key));
    if (!missing.length) fail('모든 펫을 모았어요!', 409);
    if (openBattleFor(state, p.id, Date.now())) fail('대결이 끝난 뒤에 알을 살 수 있어요.', 409);
    const balance = pointsAndPets(state, p, xpSessions(state, p.id, p)).points_balance;
    if (balance < EGG_PRICE) fail(`코인이 ${EGG_PRICE - balance}개 부족해요.`);
    const key = missing[randomBytes(4).readUInt32BE(0) % missing.length];
    const now = Date.now();
    p.pets.push({ key, acquired_at: now });
    p.points_spent = Number(p.points_spent || 0) + EGG_PRICE;
    (p.purchases ||= []).push({ item: 'egg', key, price: EGG_PRICE, at: now });
    p.avatar_key = key;
    return { key, profile: publicProfile(p) };
  }
  if (path === '/profile/pet-name' && method === 'POST') {
    requireRole(p, 'student');
    const pet = p.pets?.find(x => x.key === p.avatar_key);
    if (!pet) fail('먼저 펫을 골라주세요.', 409);
    const { name, error } = cleanPetName(body.pet_name);
    if (error) fail(error);
    if (name) pet.name = name; else delete pet.name;
    return publicProfile(p);
  }
  // Yacha battle rooms. `_battle` in a response is consumed by the Cloudflare wrapper,
  // which forwards it to the battle room and strips it before replying.
  if (path === '/battle/rooms' && method === 'POST') {
    requireRole(p, 'student');
    const now = Date.now();
    tidyBattles(state, now);
    const stake = Number(body.stake);
    if (!BATTLE_STAKES.includes(stake)) fail('판돈을 선택해주세요.');
    checkBattleEntry(state, p, stake, now);
    const school = schoolForProfile(state, p);
    if (!school) fail('학생 학교 설정을 확인해주세요.', 409);
    const rangeCodes = Array.isArray(body.range_codes) ? [...new Set(body.range_codes.map(String))].slice(0, 60) : [];
    return openBattleRoom(state, p, school, stake, rangeCodes, now, { mode: body.mode });
  }
  // Rematch: either player may ask within two minutes of the end; the room is only for the
  // other player, who accepts it on the result screen (stake shown again before joining).
  if (path === '/battle/rematch' && method === 'POST') {
    requireRole(p, 'student');
    const now = Date.now();
    tidyBattles(state, now);
    const previous = (state.battles || []).find(b => b.id === str(body.battle_id, 64) && b.status === 'finished' && (b.host_id === p.id || b.guest_id === p.id));
    if (!previous) fail('설욕전을 신청할 대결을 찾지 못했어요.', 404);
    if (now - previous.finished_at > BATTLE_REMATCH_WINDOW_MS || !previous.range_codes?.length) fail('설욕전은 대결이 끝나고 2분 안에만 신청할 수 있어요.', 409);
    const opponentId = previous.host_id === p.id ? previous.guest_id : previous.host_id;
    const existing = (state.battles || []).find(b => b.rematch_of === previous.id && battleIsOpen(b, now));
    if (existing?.host_id === p.id) return { id: existing.id, code: existing.code, stake: existing.stake, status: existing.status, ticket: existing.tickets[p.id], expires_at: existing.created_at + BATTLE_WAIT_MS, rematch: true };
    if (existing) fail('상대가 먼저 설욕전을 신청했어요. 아래에서 수락해 주세요.', 409);
    checkBattleEntry(state, p, previous.stake, now);
    const school = schoolForProfile(state, p);
    if (!school || school.id !== previous.school_id) fail('학생 학교 설정을 확인해주세요.', 409);
    return { ...openBattleRoom(state, p, school, previous.stake, previous.range_codes, now, { invite_id: opponentId, rematch_of: previous.id, mode: previous.mode }), rematch: true };
  }
  if (path === '/battle/rematch-offer' && method === 'GET') {
    requireRole(p, 'student');
    const now = Date.now();
    const offer = (state.battles || []).find(b => b.rematch_of === str(body.battle_id, 64) && b.invite_id === p.id && b.status === 'waiting' && battleIsOpen(b, now));
    return { offer: offer ? { code: offer.code, stake: offer.stake, host: state.profiles.find(x => x.id === offer.host_id)?.display_name || '' } : null };
  }
  if (path === '/battle/rematch/decline' && method === 'POST') {
    requireRole(p, 'student');
    const offer = (state.battles || []).find(b => b.rematch_of === str(body.battle_id, 64) && b.invite_id === p.id && b.status === 'waiting');
    if (!offer) return { ok: true };
    Object.assign(offer, { status: 'cancelled', reason: 'declined', finished_at: Date.now() });
    return { ok: true, _battle: { action: 'cancel', id: offer.id, reason: 'declined' } };
  }
  if (path === '/battle/friends' && method === 'GET') {
    requireRole(p, 'student');
    return { friends: battleFriends(state, p, Date.now()) };
  }
  if (path === '/battle/challenge' && method === 'POST') {
    requireRole(p, 'student');
    const now = Date.now();
    tidyBattles(state, now);
    const stake = Number(body.stake);
    if (!BATTLE_STAKES.includes(stake)) fail('판돈을 선택해주세요.');
    checkBattleEntry(state, p, stake, now);
    const friend = battleFriends(state, p, now).find(x => x.id === str(body.friend_id, 64));
    if (!friend) fail('같은 학교·학년 친구에게만 도전장을 보낼 수 있어요.', 404);
    if (friend.busy) fail(`${friend.name}이(가) 지금 다른 대결 중이에요. 조금 뒤에 다시 보내요.`, 409);
    // The friend sees one challenge at a time, so a second one would wait unseen.
    if (friend.invited) fail(`${friend.name}이(가) 다른 도전장을 먼저 받았어요. 조금 뒤에 다시 보내요.`, 409);
    const school = schoolForProfile(state, p);
    if (!school) fail('학생 학교 설정을 확인해주세요.', 409);
    const rangeCodes = Array.isArray(body.range_codes) ? [...new Set(body.range_codes.map(String))].slice(0, 60) : [];
    // One phone alert per friend every few minutes, however often a challenge is re-sent.
    const pushedLately = (state.battles || []).some(b => b.challenge && !b.tournament_id && b.host_id === p.id && b.invite_id === friend.id && now - (b.created_at || 0) < CHALLENGE_PUSH_GAP_MS);
    return { ...openBattleRoom(state, p, school, stake, rangeCodes, now, { invite_id: friend.id, challenge: true, mode: body.mode }), challenge: true, friend: friend.name,
      _push: pushedLately ? [] : [{ to: [friend.id], title: `⚔️ ${p.display_name}의 도전장!`, body: `야차전 도전장이 왔어요${stake ? ` · 판돈 ${stake}코인` : ''}. 몇 분 안에 받아 주세요!`, url: '/?go=challenge', tag: 'challenge', urgent: true }] };
  }
  if (path === '/battle/invite' && method === 'GET') {
    requireRole(p, 'student');
    return { invite: battleInviteFor(state, p, Date.now()) };
  }
  if (path === '/battle/invite/decline' && method === 'POST') {
    requireRole(p, 'student');
    const invite = (state.battles || []).find(b => b.id === str(body.id, 64) && b.challenge && b.invite_id === p.id && b.status === 'waiting');
    if (!invite) return { ok: true };
    Object.assign(invite, { status: 'cancelled', reason: 'declined', finished_at: Date.now() });
    return { ok: true, _battle: { action: 'cancel', id: invite.id, reason: 'declined' } };
  }
  // Shows the stake and the host before a student commits to joining.
  if (path === '/battle/preview' && method === 'GET') {
    requireRole(p, 'student');
    const battle = findJoinableBattle(state, p, str(body.code, 12).replace(/\D/g, ''), Date.now());
    if (battle.host_id === p.id) fail('내가 만든 방이에요. 친구에게 코드를 알려주세요.', 409);
    return { code: battle.code, stake: battle.stake, mode: battleMode(battle.mode), host: state.profiles.find(x => x.id === battle.host_id)?.display_name || '', expires_at: battle.created_at + BATTLE_WAIT_MS };
  }
  if (path === '/battle/join' && method === 'POST') {
    requireRole(p, 'student');
    const now = Date.now();
    tidyBattles(state, now);
    const battle = findJoinableBattle(state, p, str(body.code, 12).replace(/\D/g, ''), now);
    if (battle.host_id === p.id) fail('내가 만든 방이에요. 친구에게 코드를 알려주세요.', 409);
    if (body.stake !== undefined && Number(body.stake) !== battle.stake) fail('방의 판돈이 바뀌었어요. 다시 확인해주세요.', 409);
    checkBattleEntry(state, p, battle.stake, now);
    const host = state.profiles.find(x => x.id === battle.host_id);
    if (!host) fail('대결 방을 찾지 못했어요.', 404);
    // The host's coins are only held once the match starts: coins spent while waiting
    // (코인 뽑기) must not leave a stake the host can no longer pay.
    if (battle.stake > 0 && coinBalance(state, host) < battle.stake) fail('방을 만든 친구의 코인이 판돈보다 적어졌어요. 다른 방에 들어가 주세요.', 409);
    Object.assign(battle, { guest_id: p.id, status: 'active', joined_at: now });
    battle.tickets[p.id] = battleTicket();
    return { id: battle.id, stake: battle.stake, status: 'active', ticket: battle.tickets[p.id], opponent: host.display_name,
      _battle: { action: 'join', id: battle.id, guest: battlePlayer(state, p), tickets: battle.tickets } };
  }
  if (path.startsWith('/battle/rooms/') && path.endsWith('/cancel') && method === 'POST') {
    requireRole(p, 'student');
    const battle = (state.battles || []).find(b => b.id === path.split('/')[3] && b.host_id === p.id && b.status === 'waiting');
    if (!battle) fail('취소할 대결 방이 없어요.', 404);
    battle.status = 'cancelled'; battle.finished_at = Date.now();
    return { ok: true, _battle: { action: 'cancel', id: battle.id } };
  }
  if (path === '/battle/current' && method === 'GET') {
    requireRole(p, 'student');
    const battle = openBattleFor(state, p.id, Date.now());
    if (!battle) return { battle: null };
    const opponentId = battle.host_id === p.id ? battle.guest_id : battle.host_id;
    return { battle: { id: battle.id, code: battle.code, status: battle.status, stake: battle.stake, mode: battleMode(battle.mode), host: battle.host_id === p.id, rematch: !!battle.rematch_of, challenge: !!battle.challenge, tournament: battle.tournament_id ? battle.label || '대회' : undefined, friend: battle.challenge ? state.profiles.find(x => x.id === battle.invite_id)?.display_name || '' : undefined, ticket: battle.tickets[p.id], opponent: state.profiles.find(x => x.id === opponentId)?.display_name || null, expires_at: battle.status === 'waiting' ? battle.created_at + BATTLE_WAIT_MS : null } };
  }
  if (path === '/battle/history' && method === 'GET') {
    requireRole(p, 'student');
    const rows = (state.battles || []).filter(b => b.status === 'finished' && (b.host_id === p.id || b.guest_id === p.id)).sort((a, b) => b.finished_at - a.finished_at).slice(0, 20);
    const ctx = createCompetition(state);
    return { record: battleRecord(state, p.id), league: leagueView(ctx, p), points_balance: pointsAndPets(state, p, xpSessions(state, p.id, p)).points_balance, stakes: BATTLE_STAKES, daily_loss_cap: BATTLE_DAILY_LOSS_CAP, lost_today: battleLossToday(state, p.id, Date.now()), battles: rows.map(b => {
      const opponentId = b.host_id === p.id ? b.guest_id : b.host_id;
      return { id: b.id, finished_at: b.finished_at, stake: b.stake, mode: battleMode(b.mode), outcome: b.winner === p.id ? 'win' : b.loser === p.id ? 'lose' : 'draw', reason: b.reason, tournament: b.tournament_id ? b.label || '대회' : undefined, hp: Number.isFinite(Number(b.hp?.[p.id])) ? Number(b.hp[p.id]) : undefined, opponent: state.profiles.find(x => x.id === opponentId)?.display_name || '' };
    }) };
  }
  // V13.66 weekly yacha league (this week) or the all-time record of the student's school + grade.
  if (path === '/battle/league' && method === 'GET') {
    requireRole(p, 'student');
    const period = body.period === 'all' ? 'all' : 'week';
    const ctx = createCompetition(state);
    return { period, week: { label: ctx.week.label, range: ctx.week.range, end: ctx.week.end }, rows: leagueStandings(ctx, p, period), me: leagueView(ctx, p) };
  }
  // V13.66 academy tournaments (학원 대회): the teacher opens a bracket for one grade.
  if (path === '/teacher/tournaments' && method === 'POST') {
    requireRole(p, 'teacher');
    const school = activeTeacherSchool(state, p);
    if (!school) fail('관리 학교를 확인해주세요.', 409);
    const now = Date.now();
    const className = str(body.class_name, 20);
    const grade = gradeOf(className);
    const grades = school.division === 'middle' ? ['중2', '중3'] : ['고1'];
    if (!grades.includes(grade) || (className !== grade && !divisionClassAllowed(school.division, className))) fail('대회 학년·반을 확인해주세요.');
    const ids = [...new Set((Array.isArray(body.student_ids) ? body.student_ids : []).map(value => str(value, 80)).filter(Boolean))];
    if (ids.length < TOURNAMENT_MIN_PLAYERS || ids.length > TOURNAMENT_MAX_PLAYERS) fail(`참가 학생은 ${TOURNAMENT_MIN_PLAYERS}~${TOURNAMENT_MAX_PLAYERS}명으로 골라주세요.`);
    const players = ids.map(pid => state.profiles.find(x => x.id === pid));
    if (players.some(x => !x || !isRankedStudent(x) || schoolForProfile(state, x)?.id !== school.id || gradeOf(x.class_name) !== grade || (className !== grade && x.class_name !== className))) fail('같은 학교·학년(반)의 활성 학생만 참가할 수 있어요.');
    const petless = players.filter(x => !x.pets?.length);
    if (petless.length) fail(`${petless.map(x => x.display_name).join(', ')} 학생이 아직 첫 펫을 고르지 않았어요.`, 409);
    const busy = (state.tournaments || []).find(t => t.status === 'active' && t.players.some(pid => ids.includes(pid)));
    if (busy) fail(`'${busy.name}' 대회에 이미 참가 중인 학생이 있어요.`, 409);
    const rangeCodes = [...new Set((Array.isArray(body.range_codes) ? body.range_codes : []).map(String))].slice(0, 60);
    if (!rangeCodes.length) fail('대결할 단어 범위를 골라주세요.');
    if (scopedWords(state, school.id, rangeCodes, players[0].class_name).length < 8) fail('단어가 8개 이상인 범위를 골라주세요.', 409);
    const prize = Number(body.prize || 0);
    if (!TOURNAMENT_PRIZES.includes(prize)) fail('상금을 확인해주세요.');
    const ctx = createCompetition(state, now);
    const seeded = body.seeding === 'league'
      ? shuffle(players).sort((a, b) => ctx.league(b.id).points - ctx.league(a.id).points)
      : shuffle(players);
    state.tournaments ||= [];
    const t = createTournament({ id: id(), name: str(body.name, 40) || `${school.name} ${className} 야차 대회`, teacher: p, school, grade, className: className === grade ? null : className, players: seeded.map(x => x.id), rangeCodes, prize, mode: battleMode(body.mode), now });
    state.tournaments.push(t);
    return { tournament: tournamentView(state, createCompetition(state, now), t, p, now) };
  }
  // V13.69 the classroom TV bracket polls one tournament.
  const tournamentOne = path.match(/^\/teacher\/tournaments\/([^/]+)$/);
  if (tournamentOne && method === 'GET') {
    requireRole(p, 'teacher');
    const t = (state.tournaments || []).find(x => x.id === tournamentOne[1] && p.school_ids?.includes(x.school_id));
    if (!t) fail('대회를 찾지 못했어요.', 404);
    return { tournament: tournamentView(state, createCompetition(state), t, p, Date.now()), server_time: Date.now() };
  }
  const tournamentTv = path.match(/^\/teacher\/tournaments\/([^/]+)\/tv$/);
  if (tournamentTv && method === 'POST') {
    requireRole(p, 'teacher');
    const t = (state.tournaments || []).find(x => x.id === tournamentTv[1] && p.school_ids?.includes(x.school_id));
    if (!t || t.status === 'cancelled') fail('대회를 찾지 못했어요.', 404);
    const token = randomBytes(24).toString('base64url');
    t.tv_hash = hashToken(token);
    t.tv_at = Date.now();
    return { token };
  }
  const tournamentRoute = path.match(/^\/teacher\/tournaments\/([^/]+)\/(winner|cancel)$/);
  if (tournamentRoute && method === 'POST') {
    requireRole(p, 'teacher');
    const t = (state.tournaments || []).find(x => x.id === tournamentRoute[1] && p.school_ids?.includes(x.school_id));
    if (!t) fail('대회를 찾지 못했어요.', 404);
    if (t.status !== 'active') fail('이미 끝난 대회예요.', 409);
    const now = Date.now();
    const waiting = (state.battles || []).filter(b => b.tournament_id === t.id && b.status === 'waiting');
    const closeRooms = rooms => {
      for (const b of rooms) Object.assign(b, { status: 'cancelled', reason: 'tournament', finished_at: now });
      return rooms.map(b => ({ action: 'cancel', id: b.id, reason: 'tournament' }));
    };
    if (tournamentRoute[2] === 'cancel') {
      Object.assign(t, { status: 'cancelled', finished_at: now });
      return { ok: true, _battles: closeRooms(waiting) };
    }
    const found = findMatch(t, str(body.match_id, 20));
    if (!found || found.match.winner) fail('이미 끝났거나 없는 경기예요.', 409);
    const winner = str(body.winner_id, 80);
    if (!found.match.a || !found.match.b || ![found.match.a, found.match.b].includes(winner)) fail('승자를 확인해주세요.');
    decideMatch(t, found.match.id, winner, 'teacher', now);
    const rooms = closeRooms(waiting.filter(b => b.match_id === found.match.id));
    return { tournament: tournamentView(state, createCompetition(state, now), t, p, now), _battles: rooms };
  }
  // A player's fresh bracket (the result screen and cards open it without reloading everything).
  if (path === '/tournament/view' && method === 'GET') {
    requireRole(p, 'student');
    const t = (state.tournaments || []).find(x => x.id === str(body.id, 80) && x.players.includes(p.id));
    if (!t) fail('대회를 찾지 못했어요.', 404);
    return { tournament: tournamentView(state, createCompetition(state), t, p, Date.now()) };
  }
  // A student starts their tournament match: opens the room for the opponent, or joins the
  // room the opponent already opened. There is no stake.
  if (path === '/tournament/play' && method === 'POST') {
    requireRole(p, 'student');
    const now = Date.now();
    tidyBattles(state, now);
    const t = (state.tournaments || []).find(x => x.id === str(body.tournament_id, 80) && x.status === 'active' && x.players.includes(p.id));
    if (!t) fail('대회를 찾지 못했어요.', 404);
    const mine = playerMatch(t, p.id);
    if (!mine || mine.match.id !== str(body.match_id, 20)) fail('지금 할 대회 경기가 없어요.', 409);
    if (!mine.ready) fail('상대가 정해지면 경기를 할 수 있어요.', 409);
    const opponentId = mine.match.a === p.id ? mine.match.b : mine.match.a;
    const opponent = state.profiles.find(x => x.id === opponentId);
    const room = (state.battles || []).find(b => b.tournament_id === t.id && b.match_id === mine.match.id && battleIsOpen(b, now));
    if (room && (room.host_id === p.id || room.guest_id === p.id)) {
      return { id: room.id, code: room.code, stake: 0, status: room.status, ticket: room.tickets[p.id], host: room.host_id === p.id, challenge: true, tournament: room.label, friend: opponent?.display_name || '', expires_at: room.status === 'waiting' ? room.created_at + BATTLE_WAIT_MS : null };
    }
    checkBattleEntry(state, p, 0, now);
    if (room && room.status === 'waiting' && room.invite_id === p.id) {
      Object.assign(room, { guest_id: p.id, status: 'active', joined_at: now });
      room.tickets[p.id] = battleTicket();
      return { id: room.id, stake: 0, status: 'active', ticket: room.tickets[p.id], host: false, tournament: room.label, opponent: opponent?.display_name || '',
        _battle: { action: 'join', id: room.id, guest: battlePlayer(state, p), tickets: room.tickets } };
    }
    const school = schoolForProfile(state, p);
    if (!school || school.id !== t.school_id) fail('학생 학교 설정을 확인해주세요.', 409);
    const label = `대회 ${mine.label}`;
    const opened = openBattleRoom(state, p, school, 0, t.range_codes, now, { invite_id: opponentId, challenge: true, tournament_id: t.id, match_id: mine.match.id, label, mode: t.mode });
    return { ...opened, host: true, challenge: true, tournament: label, friend: opponent?.display_name || '' };
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
    requireRole(p, 'teacher'); const student = state.profiles.find(s => s.id === path.split('/')[2] && s.role === 'student' && !s.preview_owner_id);
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
    if (body.password) { if (process.env.AUTH_PROVIDER === 'supabase') fail('기존 Supabase 계정 관리에서 변경해주세요.'); if (typeof body.password !== 'string' || body.password.length < 8 || body.password.length > 128) fail('비밀번호는 8~128자로 입력해주세요.'); student.password_hash = await passwordHash(body.password); state.tokens = state.tokens.filter(t => t.user_id !== student.id); }
    return publicProfile(student);
  }
  if (/^\/students\/[^/]+$/.test(path) && method === 'DELETE') {
    requireRole(p, 'teacher');
    const studentId = path.split('/')[2];
    const student = state.profiles.find(s => s.id === studentId && s.role === 'student' && !s.preview_owner_id);
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
    if (state.push) { delete state.push.subs?.[studentId]; delete state.push.prefs?.[studentId]; delete state.push.reminded?.[studentId]; }
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
      // A dispute reveals whether the answer was right and the correct meaning.
      if (!exam.release_result) fail('결과가 공개된 뒤에 이의제기할 수 있어요.', 403);
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
    if (!own(EXAM_TYPES, body.exam_type)) fail('시험 유형을 선택해주세요.');
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
      if (body.exam_type !== undefined) { if (!own(EXAM_TYPES, body.exam_type)) fail('시험 유형을 선택해주세요.'); e.exam_type = body.exam_type; }
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
  if (/^\/sessions\/[^/]+$/.test(path) && method === 'GET') {
    const session = state.sessions.find(s => s.id === path.split('/')[2]);
    const allowed = session && (session.student_id === p.id || (teacher && teacherSchools(state, p, session.division).some(school => sameSchool(session, school))));
    if (!allowed) fail('학습 기록을 찾을 수 없습니다.', 404);
    return hydrateSession(session);
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
          const i = Number(key); if (String(i) !== key || !Number.isInteger(i) || i < 0 || i >= a.questions.length || typeof value !== 'string' || value.length > 500) fail('답안을 확인해주세요.');
          const q = a.questions[i]; if (q.options.length && value && !q.options.includes(value)) fail('유효하지 않은 선택지입니다.');
          // Only canonical keys ("1", not "01"/"001") so one question has one entry.
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
    if (!own(PRACTICE_TYPES, body.mode)) fail('연습 방식을 선택해주세요.');
    const requestedRunMode = body.run_mode === 'test' ? 'test' : 'practice';
    const selfTestModes = ['write_meaning','spell','eng2mean','mean2eng'];
    const runMode = requestedRunMode === 'test' && selfTestModes.includes(body.mode) ? 'test' : 'practice';
    const examStyle = body.exam_style === true && selfTestModes.includes(body.mode);
    const isDailyQuest = body.daily_quest === true && school.division !== 'middle';
    const selectedWordIds = Array.isArray(body.word_ids)
      ? [...new Set(body.word_ids.map(value => String(value)).filter(Boolean))].slice(0, 200)
      : [];
    const gradeWords = wordsForSchoolGrade(state, school, p.class_name);
    const selectedWordSet = new Set(selectedWordIds);
    const manualWords = selectedWordIds.length ? gradeWords.filter(word => selectedWordSet.has(word.id)) : [];
    if (selectedWordIds.length && manualWords.length !== selectedWordIds.length) fail('선택한 단어를 다시 확인해주세요.', 409);
    const daily = isDailyQuest ? composeDailyQuest(state, p.id, school, p.class_name, 20) : null;
    // Ranges are kept on the practice record: no duplicates, and no more than a grade could have.
    const askedRanges = Array.isArray(body.range_codes) ? [...new Set(body.range_codes.map(value => String(value).slice(0, 40)))].slice(0, 60) : [];
    const words = manualWords.length ? manualWords : isDailyQuest ? daily.words : scopedWords(state, school.id, askedRanges, p.class_name);
    if (!words.length) fail('학습할 단어가 없습니다. 선생님에게 단어 범위를 확인해주세요.', 409);
    const manualSelection = manualWords.length > 0;
    const coverAll = manualSelection ? body.cover_all === true || body.target === undefined : isDailyQuest || body.cover_all === true;
    const rangeCodes = manualSelection ? [...new Set(words.map(word => String(word.range_code)))] : isDailyQuest ? daily.range_codes : askedRanges;
    const requestedTarget = manualSelection
      ? (body.target === undefined ? words.length : integer(body.target, 5, Math.min(500, words.length), '학습량'))
      : isDailyQuest ? daily.target : coverAll ? words.length : integer(body.target || 10, 5, 500, '학습량');
    const target = runMode === 'test' || examStyle ? Math.min(requestedTarget, words.length) : requestedTarget;
    const practiceWords = runMode === 'test' || examStyle ? shuffle(words).slice(0, target) : words;
    const startedAt = Date.now();
    const durationSec = practiceDurationSec(body.mode, target);
    const testSec = testDurationSec(body.mode, target);
    const x = { id: id(), student_id: p.id, division: p.division || school.division, school_id: school.id, school: school.name, grade: p.class_name, range_codes: rangeCodes, mode: body.mode, run_mode: runMode, exam_style: examStyle, assignment_id: null, target, cover_all: runMode === 'test' || examStyle ? true : coverAll, daily_quest: isDailyQuest, manual_selection: manualSelection, preserve_order: manualSelection && runMode !== 'test', quest_mix: daily?.mix || null, seen: [], total: 0, correct: 0, score_total: 0, score_correct: 0, xp: 0, combo: 0, best: 0, retry: [], last: null, started_at: startedAt, duration_sec: runMode === 'test' ? testSec : durationSec, timer_mode: runMode === 'test' ? 'session' : 'none', question_duration_sec: 0, question_started_at: null, question_deadline: null, deadline: runMode === 'test' ? startedAt + testSec * 1000 : null, auto_submitted: false, wrong_details: [], answer_records: [], finished: false, responses: {}, words: practiceWords.map(w => w.id) };
    if (body.assignment_id) { const a = state.assignments.find(a => a.id === body.assignment_id && a.class_name === p.class_name && a.active); if (a && sameSchool(a, school) && JSON.stringify([...a.range_codes].sort()) === JSON.stringify([...x.range_codes].sort())) x.assignment_id = a.id; }
    state.practices.push(x); nextPractice(x, state); return practiceView(x, state);
  }
  if (/^\/practice\/[^/]+(?:\/(?:answer|next|finish|share|leave|pass))?$/.test(path)) {
    requireRole(p, 'student'); const x = state.practices.find(x => x.id === path.split('/')[2] && x.student_id === p.id); if (!x) fail('연습을 찾을 수 없습니다.', 404); removePracticeTimer(x);
    // V13.76 실전시험: the phone reports leaving the app ('out') and coming back ('back' with
    // how long). The third time out hands the test in with the answers given so far.
    if (path.endsWith('/leave')) {
      // A test that already ended (e.g. the last answer arrived first) answers with its full result.
      if (x.finished) return { ...practiceView(x, state), leaves: Number(x.leaves || 0), limit: TEST_LEAVE_LIMIT };
      if (x.run_mode !== 'test') return { leaves: 0, limit: TEST_LEAVE_LIMIT, finished: false };
      if (body.phase === 'back') {
        x.leave_ms = Math.min(3600000, Number(x.leave_ms || 0) + Math.max(0, Math.min(3600000, Number(body.ms) || 0)));
        return { leaves: Number(x.leaves || 0), limit: TEST_LEAVE_LIMIT, finished: false };
      }
      // Time already up: hand it in as a time-out, not as leaving.
      if (x.timer_mode !== 'question' && Number(x.deadline || 0) && Date.now() >= Number(x.deadline) + TEST_ANSWER_GRACE_MS) { finishPractice(x, state, true); return { ...practiceView(x, state), leaves: Number(x.leaves || 0), limit: TEST_LEAVE_LIMIT }; }
      x.leaves = Number(x.leaves || 0) + 1;
      if (x.leaves >= TEST_LEAVE_LIMIT) {
        x.left_out = true;
        finishPractice(x, state, true);
        return { ...practiceView(x, state), leaves: x.leaves, limit: TEST_LEAVE_LIMIT };
      }
      return { leaves: x.leaves, limit: TEST_LEAVE_LIMIT, finished: false };
    }
    // V13.80 PASS: a word the student can't recall goes to the end of the test, once.
    if (path.endsWith('/pass')) {
      if (method !== 'POST') fail('요청 방식을 확인해주세요.', 405);
      if (x.run_mode !== 'test' || x.timer_mode === 'question') fail('이 시험에서는 넘길 수 없어요.', 409);
      if (x.finished) return practiceView(x, state);
      if (Number(x.deadline || 0) && Date.now() >= x.deadline + TEST_ANSWER_GRACE_MS) { finishPractice(x, state, true); return practiceView(x, state); }
      // A repeated tap (or a retry after the pass was saved) just gets the current question.
      if (body.question_id !== x.question_id) return practiceView(x, state);
      const wordId = x.question?.word_id;
      x.passed ??= []; x.passed_once ??= [];
      if (x.passed_once.includes(wordId)) fail('이 문제는 이미 한 번 넘겼어요. 이번엔 답을 골라 주세요.', 409);
      if (Number(x.target || 0) - Number(x.score_total || 0) <= 1) fail('마지막 문제는 넘길 수 없어요.', 409);
      x.passed.push(wordId); x.passed_once.push(wordId); x.pass_count = Number(x.pass_count || 0) + 1;
      nextPractice(x, state);
      return practiceView(x, state);
    }
    if (path.endsWith('/share')) {
      if (method !== 'POST') fail('요청 방식을 확인해주세요.', 405);
      if (!x.finished || x.run_mode !== 'test') fail('완료한 실전모드 결과만 선생님께 보낼 수 있어요.', 409);
      const sharedAt = x.shared_to_teacher_at || Date.now();
      x.shared_to_teacher_at = sharedAt;
      const session = state.sessions.find(item => item.id === x.id && item.student_id === p.id);
      if (session) session.shared_to_teacher_at = sharedAt;
      // V13.65: the phone only needs the time; the whole result view made this slow.
      return { id: x.id, shared_to_teacher_at: sharedAt };
    }
    if (path.endsWith('/answer')) {
      if (x.responses[body.question_id]) return x.responses[body.question_id];
      if (!x.finished && x.timer_mode !== 'question' && Number(x.deadline || 0) && Date.now() >= x.deadline + (x.run_mode === 'test' ? TEST_ANSWER_GRACE_MS : 0)) {
        finishPractice(x, state, true);
        return practiceView(x, state);
      }
      if (x.finished || x.feedback || body.question_id !== x.question_id) fail('현재 문제를 다시 확인해주세요.', 409);
      const timedOut = x.timer_mode === 'question' && Number(x.question_deadline || 0) > 0 && (Date.now() >= Number(x.question_deadline) + (x.run_mode === 'test' ? TEST_ANSWER_GRACE_MS : 0) || (body.timed_out === true && Date.now() + 150 >= Number(x.question_deadline)));
      const submittedAnswer = timedOut ? '' : body.answer;
      const word = findWord(state, x.question.word_id);
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
      else { x.combo = 0; m.wrong++; m.streak = 0; m.mastery = clamp(m.mastery - 8, 0, 100); m.last_wrong_at = Date.now(); if (x.run_mode !== 'test' && !x.exam_style && !x.retry.some(r => r.id === word.id)) x.retry.push({ id: word.id, at: x.total + 2 }); }
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
  if (covered && scoredDone && (x.exam_style || !x.retry.length || x.total >= x.target + 12)) finishPractice(x, state, false, { natural: true });
  else nextPractice(x, state);
}
function nextPractice(x, state, preparePreview = true) {
  if (x.next_preview) {
    const preview = x.next_preview;
    x.question = preview.question;
    x.question_id = preview.question_id;
    x.question_is_retry = !!preview.is_retry;
    if (preview.is_retry) {
      const index = x.retry.findIndex(item => item.id === preview.question.word_id);
      if (index >= 0) x.retry.splice(index, 1);
    }
    x.feedback = null;
    x.seen ??= [];
    if (!x.seen.includes(preview.question.word_id)) x.seen.push(preview.question.word_id);
    x.next_preview = null;
    const passedAt = (x.passed || []).indexOf(preview.question.word_id);
    if (passedAt >= 0) x.passed.splice(passedAt, 1);
    startQuestionTimer(x, preview.question.type);
    if (preparePreview) prepareNextPreview(x, state);
    return;
  }
  const words = allBooks(state).flatMap(b => b.words).filter(w => x.words.includes(w.id));
  // Every word of this practice was retired from its book: nothing left to ask.
  if (!words.length) { x.next_preview = null; finishPractice(x, state, false, { natural: true }); return; }
  x.seen ??= [];
  const unseen = x.cover_all ? words.filter(w => !x.seen.includes(w.id)) : [];
  const due = x.retry.findIndex(r => r.at <= x.total);
  let word, isRetry = false;
  if (unseen.length) {
    word = x.preserve_order
      ? unseen.sort((a, b) => x.words.indexOf(a.id) - x.words.indexOf(b.id))[0]
      : choosePracticeWord(unseen, state.mastery[x.student_id] || {}, { ...x, retry: [] });
  } else if (x.run_mode === 'test' && x.passed?.length && words.some(w => x.passed.includes(w.id))) {
    // V13.80: the words passed earlier come back, in the order they were passed.
    while (!word && x.passed.length) { const wid = x.passed.shift(); word = words.find(w => w.id === wid); }
  } else if (due >= 0) {
    const retry = x.retry.splice(due, 1)[0];
    word = words.find(w => w.id === retry.id);
    isRetry = true;
  } else word = choosePracticeWord(words, state.mastery[x.student_id] || {}, x);
  if (!x.seen.includes(word.id)) x.seen.push(word.id);
  const mode = x.mode === 'mixed' ? shuffle(Object.keys(PRACTICE_TYPES).filter(k => k !== 'mixed'))[0] : x.mode;
  x.question = buildQuestion(word, mode, words); x.question_id = id(); x.question_is_retry = isRetry; x.feedback = null;
  startQuestionTimer(x, mode);
  if (preparePreview) prepareNextPreview(x, state);
}
function startQuestionTimer(x, mode) {
  if (x.timer_mode !== 'question') return;
  x.question_duration_sec = x.run_mode === 'test'
    ? Number(TEST_SECONDS_PER_QUESTION[mode] || TEST_SECONDS_PER_QUESTION[x.mode] || 15)
    : Number(PRACTICE_SECONDS_PER_QUESTION[mode] || PRACTICE_SECONDS_PER_QUESTION[x.mode] || 8);
  x.question_started_at = Date.now();
  x.question_deadline = x.question_started_at + x.question_duration_sec * 1000;
}
// Picks the following question before the current one is answered, so the
// client can show it without waiting for the save. The choice does not depend
// on the answer: a wrong answer is retried at total + 2, never immediately,
// and the answered word is excluded as `last`.
// Test mode: only while the next advance cannot end the test.
// Practice mode: always; the next advance may still finish the session
// (e.g. last retry answered correctly), in which case the preview is unused
// and the client, which predicts that case, waits for the server instead.
function prepareNextPreview(x, state) {
  x.next_preview = null;
  const test = x.run_mode === 'test';
  // 실전시험 still shows the next word while the answer saves; its countdown starts when the
  // server moves on (the client waits for that deadline).
  if ((x.timer_mode === 'question' && !test) || (test && Number(x.score_total || 0) + 1 >= Number(x.target || 0))) return;
  const preview = {
    ...x,
    seen: [...(x.seen || [])],
    passed: [...(x.passed || [])],
    retry: test ? [] : x.retry.map(item => ({ ...item })),
    next_preview: null,
    total: x.total + 1,
    last: test ? x.last : x.question?.word_id
  };
  nextPractice(preview, state, false);
  x.next_preview = { question: preview.question, question_id: preview.question_id, is_retry: !!preview.question_is_retry };
}
// Grading data for on-device feedback in practice (not test) mode. The same
// word + accepted meanings the server grades with; practice already reveals the
// answer in its feedback, so this only moves that moment earlier.
function localCheck(state, wordId) {
  const word = findWord(state, wordId);
  if (!word) return null;
  const graded = wordForGrade(state, word);
  return { word: graded.word, meaning: graded.meaning, accepted_meanings: graded.accepted_meanings || [] };
}
// 실전시험: an answer sent just before the countdown ended still counts while it travels.
const TEST_ANSWER_GRACE_MS = 1500;
function removePracticeTimer(x) {
  // V13.76: 실전시험 keeps its countdown for every word (practice has none since V13.26).
  if (!x || x.finished || x.run_mode === 'test') return x;
  x.timer_mode = 'none';
  x.deadline = null;
  x.question_deadline = null;
  x.question_duration_sec = 0;
  x.question_started_at = null;
  return x;
}

// V13.73: coins are paid only for a practice finished to its target (or ended by its own
// timer) with at least 60% of the answers right (STUDY_COINS in public/modules/rewards.js):
// quitting midway or tapping at random pays no coins. XP for right answers is kept either way.
const hadBonus = (sessions, label) => sessions.some(session => (session.reward_breakdown || []).some(item => item.label === label));
function practiceReward(x, state, endedAt, answeredCount, perfect, { complete = true, correct = answeredCount } = {}) {
  // Rewards follow answers actually given, not the requested target: finishing
  // an empty practice must not earn points or keep a streak alive.
  if (answeredCount <= 0) return { points: 0, breakdown: [] };
  if (!complete) return { points: 0, breakdown: [], note: '끝까지 풀지 않아 코인은 없어요. 경험치는 그대로 받아요.' };
  if (correct / answeredCount < STUDY_COINS.min_accuracy) return { points: 0, breakdown: [], note: `정답률 ${Math.round(STUDY_COINS.min_accuracy * 100)}% 이상이면 코인을 받아요. 경험치는 그대로 받아요.` };
  const scoreTotal = answeredCount;
  const previous = mySessions(state, x.student_id).filter(session => session.answered_count !== 0);
  const todayKey = dayKey(endedAt);
  const todaySessions = previous.filter(session => dayKey(session.created_at) === todayKey);
  // "First" means the first practice today that paid its bonus: a practice left midway
  // (no coins) does not use up the day's first-study or recommended-study bonus.
  const firstToday = !hadBonus(todaySessions, '오늘 첫 학습');
  const breakdown = [];
  const add = (label, points) => { if (points > 0) breakdown.push({ label, points }); };

  const C = STUDY_COINS;
  const completion = scoreTotal >= 30 ? C.t30 : scoreTotal >= 20 ? C.t20 : scoreTotal >= 10 ? C.t10 : Math.max(1, Math.ceil(scoreTotal / 3));
  add('학습 완료', completion);
  if (perfect && scoreTotal >= 10) add('100점', C.perfect);
  // Once a day: doing the recommended study again is welcome but pays no second bonus.
  if (x.daily_quest && !hadBonus(todaySessions, '오늘 추천 학습')) add('오늘 추천 학습', C.daily);
  if (firstToday) add('오늘 첫 학습', C.first);

  if (firstToday) {
    const projected = growthFor([...previous, { created_at: endedAt, total: scoreTotal, xp: 0, best_combo: 0 }]).streak;
    if (projected === 3) add('3일 연속 학습', C.streak3);
    if (projected === 7) add('7일 연속 학습', C.streak7);
  }

  const raw = breakdown.reduce((sum, item) => sum + item.points, 0);
  const earnedToday = todaySessions.reduce((sum, session) => sum + Number(session.reward_points || 0), 0);
  const available = Math.max(0, C.cap - earnedToday);
  const points = Math.min(raw, available);
  if (points < raw) breakdown.push({ label: '일일 보상 한도 적용', points: points - raw });
  return { points, breakdown };
}

// `natural`: the practice ended by itself (every word done). A practice closed by the
// student midway, by the 3-day clean-up or by a school change pays no coins.
function finishPractice(x, state, autoSubmitted = false, { natural = false } = {}) {
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
  // A timer that ran out counts as finished only with at least half of the words answered.
  const complete = natural || answerRecords.length >= scoreTotal || (autoSubmitted && answerRecords.length * 2 >= scoreTotal);
  const reward = practiceReward(x, state, endedAt, answerRecords.length, perfect, { complete, correct: scoreCorrect });
  x.reward_points = reward.points;
  x.reward_breakdown = reward.breakdown;
  x.reward_note = reward.note || null;
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
    answered_count: answerRecords.length,
    score,
    wrong_count: wrongCount,
    unanswered_count: unansweredCount,
    perfect,
    xp: x.xp,
    pet_key: activePetKey(state, x.student_id),
    reward_points: reward.points,
    reward_breakdown: reward.breakdown,
    ...(reward.note ? { reward_note: reward.note } : {}),
    best_combo: x.best,
    duration_sec: Math.max(0, Math.round((endedAt - x.started_at) / 1000)),
    limit_sec: Number(x.duration_sec || 0),
    timer_mode: x.timer_mode || 'session',
    question_duration_sec: Number(x.question_duration_sec || 0),
    auto_submitted: !!x.auto_submitted,
    // V13.76 실전시험: how often and how long the student left the app, and whether that ended it.
    ...(x.run_mode === 'test' ? { leave_count: Number(x.leaves || 0), leave_ms: Number(x.leave_ms || 0), left_out: !!x.left_out, pass_count: Number(x.pass_count || 0) } : {}),
    ended_at: endedAt,
    finalized_at: finalizedAt,
    shared_to_teacher_at: x.shared_to_teacher_at || null,
    answer_records: answerRecords,
    word_ids: [...(x.words || [])],
    wrong_details: (x.wrong_details || []).map(item => ({ ...item })),
    created_at: endedAt
  };
  compactSession(rec);
  if (!state.sessions.some(s => s.id === rec.id)) state.sessions.push(rec);
}
function practiceView(x, state) {
  const scoreTotal = Math.max(1, Number(x.target || 0));
  const scoreCorrect = Math.min(scoreTotal, Number(x.score_correct || 0));
  const score = Math.round(scoreCorrect / scoreTotal * 100);
  const hideTestScore = x.run_mode === 'test' && !x.finished;
  const practiceKeys = x.run_mode !== 'test' && x.timer_mode !== 'question';
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
    xp: hideTestScore ? null : x.xp, reward_points: x.finished ? Number(x.reward_points || 0) : undefined, reward_breakdown: x.finished ? (x.reward_breakdown || []) : undefined, reward_note: x.finished ? (x.reward_note || null) : undefined, combo: hideTestScore ? null : x.combo, best: hideTestScore ? null : x.best,
    started_at: x.started_at, finished_at: x.finished_at || null, ended_at: x.ended_at || null, finalized_at: x.finalized_at || null, duration_sec: x.duration_sec, deadline: x.deadline,
    timer_mode: x.timer_mode || 'session', question_duration_sec: Number(x.question_duration_sec || 0), question_started_at: x.question_started_at || null, question_deadline: x.question_deadline || null,
    auto_submitted: !!x.auto_submitted,
    leaves: Number(x.leaves || 0), leave_ms: Number(x.leave_ms || 0), left_out: !!x.left_out,
    pass_count: Number(x.pass_count || 0), passed_left: (x.passed || []).length,
    revisit: !!(x.run_mode === 'test' && x.question && (x.passed_once || []).includes(x.question.word_id)),
    can_pass: !!(x.run_mode === 'test' && x.timer_mode !== 'question' && !x.finished && x.question && !(x.passed_once || []).includes(x.question.word_id) && Number(x.target || 0) - Number(x.score_total || 0) > 1),
    shared_to_teacher_at: x.shared_to_teacher_at || null,
    wrong_count: x.finished ? wrongCount : undefined,
    unanswered_count: x.finished ? unansweredCount : undefined,
    perfect: x.finished ? perfect : undefined,
    answer_records: x.finished ? answerRecords : undefined,
    wrong_details: x.finished ? (x.wrong_details || []) : undefined,
    question: publicQuestion(x.question), question_id: x.question_id, question_is_retry: !!x.question_is_retry,
    local_check: practiceKeys && !x.finished && !x.feedback && x.question ? localCheck(state, x.question.word_id) : undefined,
    next_preview: (hideTestScore || practiceKeys) && !x.finished
      ? (x.next_preview ? { question: publicQuestion(x.next_preview.question), question_id: x.next_preview.question_id, is_retry: !!x.next_preview.is_retry, ...(practiceKeys ? { local_check: localCheck(state, x.next_preview.question.word_id) } : {}) } : null)
      : undefined,
    feedback: hideTestScore ? null : x.feedback,
    finished: x.finished, retry_count: x.retry.length,
    stats: growthFor(xpSessions(state, x.student_id)), server_time: Date.now()
  };
}
