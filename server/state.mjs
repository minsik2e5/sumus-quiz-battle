export const DEFAULT_SCHOOLS = [
  { id: 'danwon-high', name: '단원고', full_name: '단원고등학교', active: true, sort_order: 10 },
  { id: 'seonbu-high', name: '선부고', full_name: '선부고등학교', active: true, sort_order: 20 },
  { id: 'gangseo-high', name: '강서고', full_name: '강서고등학교', active: true, sort_order: 30 }
];

export function emptyState() {
  return { schema_version: 13, schools: structuredClone(DEFAULT_SCHOOLS), profiles: [], tokens: [], sessions: [], mastery: {}, assignments: [], exams: [], examAttempts: [], practices: [], extraBooks: [] };
}

export function migrateState(state) {
  let changed = false;
  for (const key of ['profiles', 'tokens', 'sessions', 'assignments', 'exams', 'examAttempts', 'practices', 'extraBooks']) {
    if (!Array.isArray(state[key])) { state[key] = []; changed = true; }
  }
  if (!state.mastery || typeof state.mastery !== 'object' || Array.isArray(state.mastery)) { state.mastery = {}; changed = true; }
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
  state.schools.sort((a, b) => (a.sort_order || 999) - (b.sort_order || 999));
  const byName = name => state.schools.find(school => school.name === name);
  for (const profile of state.profiles) {
    if (profile.role === 'student' && !profile.school_id && byName(profile.school)) { profile.school_id = byName(profile.school).id; changed = true; }
    if (profile.role === 'teacher') {
      if (!Array.isArray(profile.school_ids) || !profile.school_ids.length) { profile.school_ids = state.schools.filter(school => school.active !== false).map(school => school.id); changed = true; }
      if (!profile.active_school_id || !state.schools.some(school => school.id === profile.active_school_id && profile.school_ids.includes(school.id))) {
        profile.active_school_id = profile.school_ids.find(schoolId => state.schools.some(school => school.id === schoolId && school.active !== false)) || state.schools[0]?.id;
        changed = true;
      }
    }
  }
  for (const key of ['assignments', 'exams', 'sessions', 'practices']) {
    for (const record of state[key]) if (!record.school_id && byName(record.school)) { record.school_id = byName(record.school).id; changed = true; }
  }
  if (state.schema_version !== 13) { state.schema_version = 13; changed = true; }
  return changed;
}
