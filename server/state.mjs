export const DEFAULT_SCHOOLS = [
  { id: 'wonil-middle', name: '원일중', full_name: '원일중학교', division: 'middle', active: true, sort_order: 5 },
  { id: 'danwon-high', name: '단원고', full_name: '단원고등학교', division: 'high', active: true, sort_order: 10 },
  { id: 'seonbu-high', name: '선부고', full_name: '선부고등학교', division: 'high', active: true, sort_order: 20 },
  { id: 'gangseo-high', name: '강서고', full_name: '강서고등학교', division: 'high', active: true, sort_order: 30 }
];

// Finished-session records are kept forever, so they are the part of the state that keeps
// growing. Their word_ids held the whole range (word ids are ~35 characters each), but the
// record screens only use it to list unanswered words: the ids not in answer_records, cut to
// the missing count, which is never above unanswered_count. Keeping exactly those ids gives
// the same review list. Records without answer_records or counts (older formats) are left as
// they are.
export function compactSession(session) {
  if (!session || typeof session !== 'object' || !Array.isArray(session.answer_records) || !Array.isArray(session.word_ids)) return false;
  const unanswered = Number(session.unanswered_count);
  if (!Number.isInteger(unanswered) || unanswered < 0) return false;
  const answered = new Set(session.answer_records.map(item => item?.word_id).filter(Boolean));
  const missing = session.word_ids.filter(id => !answered.has(id)).slice(0, unanswered);
  if (missing.length === session.word_ids.length) return false;
  session.word_ids = missing;
  return true;
}

// Size of each part of the state, for /api/health. Only sizes and counts, never content.
export function stateSizeReport(state) {
  const kb = value => Math.round((JSON.stringify(value ?? null)?.length || 0) / 102.4) / 10;
  const keys = Object.fromEntries(Object.keys(state || {}).map(key => [key, kb(state[key])]).sort((a, b) => b[1] - a[1]));
  const sessions = Array.isArray(state?.sessions) ? state.sessions : [];
  const practices = Array.isArray(state?.practices) ? state.practices : [];
  const field = (list, name) => kb(list.map(item => item?.[name] ?? null));
  const active = practices.filter(item => !item?.finished);
  const finished = practices.filter(item => item?.finished);
  return {
    keys_kb: keys,
    sessions: { count: sessions.length, answer_records_kb: field(sessions, 'answer_records'), wrong_details_kb: field(sessions, 'wrong_details'), word_ids_kb: field(sessions, 'word_ids'), reward_breakdown_kb: field(sessions, 'reward_breakdown') },
    practices: { active: active.length, active_kb: kb(active), stale_active: active.filter(item => Number(item?.started_at || 0) < Date.now() - 86400000).length, finished: finished.length, finished_kb: kb(finished), responses_kb: field(practices, 'responses'), words_kb: field(practices, 'words') },
    mastery_students: Object.keys(state?.mastery || {}).length
  };
}

export function emptyState() {
  return { schema_version: 18, schools: structuredClone(DEFAULT_SCHOOLS), profiles: [], tokens: [], sessions: [], mastery: {}, grammarProgress: {}, meaningAliases: {}, meaningAliasMeta: {}, meaningDisputes: [], assignments: [], exams: [], examAttempts: [], practices: [], extraBooks: [], battles: [], tournaments: [], battleSettings: { cross_school: true } };
}

export function migrateState(state) {
  let changed = false;
  for (const key of ['profiles', 'tokens', 'sessions', 'assignments', 'exams', 'examAttempts', 'practices', 'extraBooks', 'meaningDisputes', 'battles', 'tournaments']) {
    if (!Array.isArray(state[key])) { state[key] = []; changed = true; }
  }
  // V13.122: 다른 학교와 야차전 허용 starts on; a state from before has no switch yet.
  if (!state.battleSettings || typeof state.battleSettings !== 'object' || Array.isArray(state.battleSettings)) { state.battleSettings = { cross_school: true }; changed = true; }
  else if (typeof state.battleSettings.cross_school !== 'boolean') { state.battleSettings.cross_school = true; changed = true; }
  if (!state.mastery || typeof state.mastery !== 'object' || Array.isArray(state.mastery)) { state.mastery = {}; changed = true; }
  if (!state.grammarProgress || typeof state.grammarProgress !== 'object' || Array.isArray(state.grammarProgress)) { state.grammarProgress = {}; changed = true; }
  if (!state.meaningAliases || typeof state.meaningAliases !== 'object' || Array.isArray(state.meaningAliases)) { state.meaningAliases = {}; changed = true; }
  if (!state.meaningAliasMeta || typeof state.meaningAliasMeta !== 'object' || Array.isArray(state.meaningAliasMeta)) { state.meaningAliasMeta = {}; changed = true; }
  for (const [wordId, aliases] of Object.entries(state.meaningAliases)) {
    if (!Array.isArray(aliases)) { state.meaningAliases[wordId] = []; changed = true; continue; }
    state.meaningAliasMeta[wordId] ??= [];
    for (const alias of aliases) {
      if (typeof alias !== 'string' || !alias.trim()) continue;
      if (!state.meaningAliasMeta[wordId].some(item => item?.value === alias)) {
        state.meaningAliasMeta[wordId].push({ value: alias, source: 'legacy', created_at: 0, created_by: null });
        changed = true;
      }
    }
  }
  // Completed practice payloads can be very large (questions, retries and idempotency responses).
  // Their durable summary already lives in sessions, so keep only active/unreconciled practice state.
  const sessionIds = new Set(state.sessions.map(item => item.id));
  const compactPractices = state.practices.filter(item => !item?.finished || (Number(item?.total || 0) > 0 && !sessionIds.has(item.id)) || Number(item?.finished_at || 0) > Date.now() - 10 * 60000);
  if (compactPractices.length !== state.practices.length) { state.practices = compactPractices; changed = true; }
  for (const session of state.sessions) if (compactSession(session)) changed = true;
  const liveTokens = state.tokens.filter(item => Number(item?.expires_at || 0) > Date.now());
  if (liveTokens.length !== state.tokens.length) { state.tokens = liveTokens; changed = true; }
  if (!Array.isArray(state.schools)) { state.schools = []; changed = true; }
  for (const school of DEFAULT_SCHOOLS) {
    if (!state.schools.some(item => item.id === school.id || item.name === school.name)) { state.schools.push(structuredClone(school)); changed = true; }
  }
  for (const school of state.schools) {
    const inferred = school.id?.includes('middle') || /중학교$/.test(school.full_name || '') ? 'middle' : 'high';
    if (!school.division) { school.division = inferred; changed = true; }
  }
  state.schools.sort((a, b) => (a.sort_order || 999) - (b.sort_order || 999));
  const normalizeSchool = value => String(value || '').trim().replace(/\s+/g, '');
  const byRef = value => {
    const raw = String(value || '').trim();
    const normalized = normalizeSchool(raw);
    return state.schools.find(school =>
      school.id === raw ||
      normalizeSchool(school.name) === normalized ||
      normalizeSchool(school.full_name) === normalized
    );
  };
  for (const profile of state.profiles) {
    if (profile.role === 'student') {
      const school = byRef(profile.school_id) || byRef(profile.school);
      if (school && (profile.school_id !== school.id || profile.school !== school.name)) {
        profile.school_id = school.id;
        profile.school = school.name;
        changed = true;
      }
      const division = school?.division || (/^중/.test(profile.class_name || '') ? 'middle' : 'high');
      if (profile.division !== division) { profile.division = division; changed = true; }
    }
    if (profile.role === 'teacher') {
      const allSchoolIds = state.schools.filter(school => school.active !== false).map(school => school.id);
      const normalizedIds = [...new Set((Array.isArray(profile.school_ids) ? profile.school_ids : []).map(value => byRef(value)?.id).filter(Boolean))];
      for (const schoolId of allSchoolIds) if (!normalizedIds.includes(schoolId)) normalizedIds.push(schoolId);
      if (JSON.stringify(profile.school_ids || []) !== JSON.stringify(normalizedIds)) { profile.school_ids = normalizedIds; changed = true; }
      if (!Array.isArray(profile.division_ids) || !profile.division_ids.includes('middle') || !profile.division_ids.includes('high')) { profile.division_ids = ['middle','high']; changed = true; }
      if (!['middle','high'].includes(profile.active_division)) { profile.active_division = 'high'; changed = true; }
      const currentSchool = byRef(profile.active_school_id);
      const divisionSchools = state.schools.filter(school => school.active !== false && school.division === profile.active_division && profile.school_ids.includes(school.id));
      if (!currentSchool || !divisionSchools.some(school => school.id === currentSchool.id)) {
        profile.active_school_id = divisionSchools[0]?.id || state.schools.find(school => profile.school_ids.includes(school.id))?.id;
        changed = true;
      } else if (profile.active_school_id !== currentSchool.id) {
        profile.active_school_id = currentSchool.id;
        changed = true;
      }
    }
  }
  for (const key of ['assignments', 'exams', 'sessions', 'practices']) {
    for (const record of state[key]) {
      const school = byRef(record.school_id) || byRef(record.school);
      if (school && (record.school_id !== school.id || record.school !== school.name)) {
        record.school_id = school.id;
        record.school = school.name;
        changed = true;
      }
      if (school && record.division !== school.division) { record.division = school.division; changed = true; }
    }
  }
  for (const dispute of state.meaningDisputes) {
    const school = state.schools.find(item => item.id === dispute.school_id);
    if (school && dispute.division !== school.division) { dispute.division = school.division; changed = true; }
  }
  if (state.schema_version !== 18) { state.schema_version = 18; changed = true; }
  return changed;
}
