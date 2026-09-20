export const DEFAULT_SCHOOLS = [
  { id: 'wonil-middle', name: '원일중', full_name: '원일중학교', division: 'middle', active: true, sort_order: 5 },
  { id: 'danwon-high', name: '단원고', full_name: '단원고등학교', division: 'high', active: true, sort_order: 10 },
  { id: 'seonbu-high', name: '선부고', full_name: '선부고등학교', division: 'high', active: true, sort_order: 20 },
  { id: 'gangseo-high', name: '강서고', full_name: '강서고등학교', division: 'high', active: true, sort_order: 30 }
];

export function emptyState() {
  return { schema_version: 16, schools: structuredClone(DEFAULT_SCHOOLS), profiles: [], tokens: [], sessions: [], mastery: {}, grammarProgress: {}, meaningAliases: {}, meaningDisputes: [], assignments: [], exams: [], examAttempts: [], practices: [], extraBooks: [] };
}

export function migrateState(state) {
  let changed = false;
  for (const key of ['profiles', 'tokens', 'sessions', 'assignments', 'exams', 'examAttempts', 'practices', 'extraBooks', 'meaningDisputes']) {
    if (!Array.isArray(state[key])) { state[key] = []; changed = true; }
  }
  if (!state.mastery || typeof state.mastery !== 'object' || Array.isArray(state.mastery)) { state.mastery = {}; changed = true; }
  if (!state.grammarProgress || typeof state.grammarProgress !== 'object' || Array.isArray(state.grammarProgress)) { state.grammarProgress = {}; changed = true; }
  if (!state.meaningAliases || typeof state.meaningAliases !== 'object' || Array.isArray(state.meaningAliases)) { state.meaningAliases = {}; changed = true; }
  // Completed practice payloads can be very large (questions, retries and idempotency responses).
  // Their durable summary already lives in sessions, so keep only active/unreconciled practice state.
  const sessionIds = new Set(state.sessions.map(item => item.id));
  const compactPractices = state.practices.filter(item => !item?.finished || (Number(item?.total || 0) > 0 && !sessionIds.has(item.id)) || Number(item?.finished_at || 0) > Date.now() - 10 * 60000);
  if (compactPractices.length !== state.practices.length) { state.practices = compactPractices; changed = true; }
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
  const byName = name => state.schools.find(school => school.name === name);
  for (const profile of state.profiles) {
    if (profile.role === 'student' && !profile.school_id && byName(profile.school)) { profile.school_id = byName(profile.school).id; changed = true; }
    if (profile.role === 'student') {
      const school = state.schools.find(item => item.id === profile.school_id);
      const division = school?.division || (/^중/.test(profile.class_name || '') ? 'middle' : 'high');
      if (profile.division !== division) { profile.division = division; changed = true; }
    }
    if (profile.role === 'teacher') {
      const allSchoolIds = state.schools.filter(school => school.active !== false).map(school => school.id);
      if (!Array.isArray(profile.school_ids)) { profile.school_ids = []; changed = true; }
      for (const schoolId of allSchoolIds) if (!profile.school_ids.includes(schoolId)) { profile.school_ids.push(schoolId); changed = true; }
      if (!Array.isArray(profile.division_ids) || !profile.division_ids.includes('middle') || !profile.division_ids.includes('high')) { profile.division_ids = ['middle','high']; changed = true; }
      if (!['middle','high'].includes(profile.active_division)) { profile.active_division = 'high'; changed = true; }
      const divisionSchools = state.schools.filter(school => school.active !== false && school.division === profile.active_division && profile.school_ids.includes(school.id));
      if (!profile.active_school_id || !divisionSchools.some(school => school.id === profile.active_school_id)) {
        profile.active_school_id = divisionSchools[0]?.id || state.schools.find(school => profile.school_ids.includes(school.id))?.id;
        changed = true;
      }
    }
  }
  for (const key of ['assignments', 'exams', 'sessions', 'practices']) {
    for (const record of state[key]) {
      if (!record.school_id && byName(record.school)) { record.school_id = byName(record.school).id; changed = true; }
      const school = state.schools.find(item => item.id === record.school_id);
      if (school && record.division !== school.division) { record.division = school.division; changed = true; }
    }
  }
  for (const dispute of state.meaningDisputes) {
    const school = state.schools.find(item => item.id === dispute.school_id);
    if (school && dispute.division !== school.division) { dispute.division = school.division; changed = true; }
  }
  if (state.schema_version !== 16) { state.schema_version = 16; changed = true; }
  return changed;
}
