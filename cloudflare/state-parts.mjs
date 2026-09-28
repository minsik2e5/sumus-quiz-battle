// Splits the VOCA state into backup "parts" so the Supabase backup can upload only what
// changed (supabase/voca_v13_parts.sql), and puts the parts back together for a restore.
//
// Part keys:
//   o:keys               top-level key order
//   k:<key>              a top-level value kept whole (profiles, tokens, exams, ...)
//   a:<key>:<student>    one student's items of a per-student list (sessions, practices, ...)
//   o:<key>              order of that list: { ids: [students], seq: [index into ids per item] }
//   m:<key>:<student>    one student's entry of a per-student map (mastery, grammarProgress)
//   o:<key>              order of that map's keys
// An answer changes one student's mastery and practice parts (a few KB), not the whole state.

const BY_STUDENT_LISTS = new Set(['sessions', 'practices', 'examAttempts']);
const BY_STUDENT_MAPS = new Set(['mastery', 'grammarProgress']);
const isMap = value => !!value && typeof value === 'object' && !Array.isArray(value);

// Returns Map<part key, JSON text>.
export function partitionState(state) {
  const parts = new Map();
  const put = (key, value) => { if (value !== undefined) parts.set(key, JSON.stringify(value)); };
  const keys = Object.keys(state).filter(key => state[key] !== undefined);
  put('o:keys', keys);
  for (const key of keys) {
    const value = state[key];
    if (BY_STUDENT_LISTS.has(key) && Array.isArray(value)) {
      const ids = [], index = new Map(), groups = new Map(), seq = [];
      for (const item of value) {
        const sid = String(item?.student_id ?? '_');
        if (!index.has(sid)) { index.set(sid, ids.length); ids.push(sid); groups.set(sid, []); }
        seq.push(index.get(sid));
        groups.get(sid).push(item);
      }
      put(`o:${key}`, { ids, seq });
      for (const [sid, items] of groups) put(`a:${key}:${sid}`, items);
    } else if (BY_STUDENT_MAPS.has(key) && isMap(value)) {
      put(`o:${key}`, Object.keys(value));
      for (const [sid, entry] of Object.entries(value)) put(`m:${key}:${sid}`, entry);
    } else {
      put(`k:${key}`, value);
    }
  }
  return parts;
}

// parts: { part key: parsed value }. Parts missing from an order list (a restore taken
// between two uploads) are still kept, after the ordered ones.
export function assembleState(parts) {
  const all = Object.keys(parts);
  const withPrefix = prefix => all.filter(key => key.startsWith(prefix));
  const keys = [...(Array.isArray(parts['o:keys']) ? parts['o:keys'] : [])];
  for (const key of all) {
    const match = key.match(/^(?:k|o):(.+)$/) || key.match(/^(?:a|m):([^:]+):/);
    if (match && match[1] !== 'keys' && !keys.includes(match[1])) keys.push(match[1]);
  }
  const state = {};
  for (const key of keys) {
    if (Object.hasOwn(parts, `k:${key}`)) { state[key] = parts[`k:${key}`]; continue; }
    if (BY_STUDENT_LISTS.has(key)) {
      const order = isMap(parts[`o:${key}`]) ? parts[`o:${key}`] : { ids: [], seq: [] };
      const ids = Array.isArray(order.ids) ? order.ids : [];
      const queues = new Map(withPrefix(`a:${key}:`).map(part => [part.slice(`a:${key}:`.length), [...(parts[part] || [])]]));
      const list = [];
      for (const i of Array.isArray(order.seq) ? order.seq : []) {
        const queue = queues.get(String(ids[i]));
        if (queue?.length) list.push(queue.shift());
      }
      for (const queue of queues.values()) list.push(...queue);
      state[key] = list;
      continue;
    }
    if (BY_STUDENT_MAPS.has(key)) {
      const map = {};
      const order = Array.isArray(parts[`o:${key}`]) ? parts[`o:${key}`] : [];
      const entries = new Map(withPrefix(`m:${key}:`).map(part => [part.slice(`m:${key}:`.length), parts[part]]));
      for (const sid of order) if (entries.has(sid)) { map[sid] = entries.get(sid); entries.delete(sid); }
      for (const [sid, entry] of entries) map[sid] = entry;
      state[key] = map;
    }
  }
  return state;
}

export async function hashText(text) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
}

// Groups changed parts into uploads of at most `limit` characters (a bigger part goes alone).
export function batchParts(entries, limit = 256_000) {
  const batches = [];
  let current = [], size = 0;
  for (const entry of entries) {
    const length = entry[0].length + entry[1].length + 8;
    if (current.length && size + length > limit) { batches.push(current); current = []; size = 0; }
    current.push(entry); size += length;
  }
  if (current.length) batches.push(current);
  return batches;
}
