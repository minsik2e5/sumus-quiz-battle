// Saving the planner document, shared by the planner page and the widget.
// - Loads once from the server; if that fails nothing is shown as saved data (no stale copy).
// - Saves 700 ms after the last change, and when the page is hidden or closed.
// - 409 (another device or the widget saved first): three-way merge of base / mine / theirs,
//   then saves the merged copy. Nothing typed on either side is lost.

export const isObj = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
export const clone = v => v === undefined ? undefined : JSON.parse(JSON.stringify(v));

// Three-way merge (base = last copy both sides agreed on). Objects merge key by key, arrays of
// {id} items merge item by item; other values take the side that changed (mine if both did).
// A key deleted on one side and unchanged on the other stays deleted.
const hasIds = v => Array.isArray(v) && v.length > 0 && v.every(x => isObj(x) && typeof x.id === 'string');
export function merge3(base, mine, theirs) {
  if (same(mine, base)) return clone(theirs);
  if (same(theirs, base) || same(theirs, mine)) return clone(mine);
  if (isObj(mine) && isObj(theirs)) {
    const b = isObj(base) ? base : {}, out = {};
    for (const k of new Set([...Object.keys(theirs), ...Object.keys(mine)])) { const v = merge3(b[k], mine[k], theirs[k]); if (v !== undefined) out[k] = v; }
    return out;
  }
  if ((hasIds(mine) || Array.isArray(mine)) && (hasIds(theirs) || Array.isArray(theirs)) && (hasIds(mine) || hasIds(theirs))) {
    const by = list => new Map((Array.isArray(list) ? list : []).filter(x => isObj(x) && x.id).map(x => [x.id, x]));
    const bm = by(base), mm = by(mine), tm = by(theirs), out = [];
    for (const id of [...mm.keys(), ...[...tm.keys()].filter(k => !mm.has(k))]) { const v = merge3(bm.get(id), mm.get(id), tm.get(id)); if (v !== undefined) out.push(v); }
    return out;
  }
  return clone(mine);
}

export async function api(path, options = {}) {
  const res = await fetch(path, { credentials: 'same-origin', ...options, headers: { 'Content-Type': 'application/json', ...(options.headers || {}) } });
  let body = null;
  try { body = await res.json(); } catch {}
  if (!res.ok) { const err = new Error(body?.error || `요청 실패 (${res.status})`); err.status = res.status; err.body = body; throw err; }
  return body;
}

// store = createStore({ normalize, onChange, onStatus })
export function createStore({ normalize = d => d, onChange = () => {}, onStatus = () => {} }) {
  let data = null, base = null, updatedAt = 0, timer = null, saving = null, dirty = false;
  const status = (state, extra = {}) => onStatus({ state, updatedAt, ...extra });

  async function load() {
    const doc = await api('/api/planner');
    data = normalize(clone(doc.state));
    base = clone(data);
    updatedAt = Number(doc.updatedAt || 0);
    dirty = false;
    status('saved');
    return data;
  }
  // render:false for typing in a text box (the page is not redrawn under the cursor).
  function change(mutator, { render = true } = {}) {
    mutator(data);
    dirty = true;
    status('dirty');
    if (render) onChange(data);
    clearTimeout(timer);
    timer = setTimeout(save, 700);
  }
  async function save() {
    clearTimeout(timer);
    if (saving) { await saving; if (!dirty) return; }
    if (!dirty) return;
    saving = (async () => {
      const sending = clone(data);
      dirty = false;
      status('saving');
      for (let attempt = 0; attempt < 4; attempt++) {
        try {
          const res = await api('/api/planner', { method: 'PUT', body: JSON.stringify({ state: sending, baseUpdatedAt: updatedAt }) });
          updatedAt = res.updatedAt; base = sending;
          status('saved');
          return;
        } catch (err) {
          if (err.status === 409 && err.body) {
            const theirs = normalize(clone(err.body.state));
            const merged = merge3(base, sending, theirs);
            // Changes typed while this save was running stay on top of the merge.
            const local = dirty ? merge3(sending, data, merged) : merged;
            base = theirs; updatedAt = Number(err.body.updatedAt || 0);
            Object.keys(data).forEach(k => delete data[k]); Object.assign(data, local);
            Object.keys(sending).forEach(k => delete sending[k]); Object.assign(sending, merged);
            onChange(data);
            continue;
          }
          dirty = true;
          status('error', { message: err.status === 401 ? '로그인이 풀렸어요. 새로고침해 주세요.' : '저장하지 못했어요. 인터넷 연결을 확인해 주세요.', auth: err.status === 401 });
          clearTimeout(timer); timer = setTimeout(save, 8000);
          return;
        }
      }
      dirty = true; status('error', { message: '다른 기기와 동시에 저장 중이에요. 잠시 후 다시 저장할게요.' });
      timer = setTimeout(save, 3000);
    })();
    try { await saving; } finally { saving = null; }
  }
  // Last chance to save when the window is hidden or closed.
  function flushOnLeave() {
    if (!dirty || !data) return;
    try {
      fetch('/api/planner', { method: 'PUT', keepalive: true, credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ state: data, baseUpdatedAt: updatedAt }) });
    } catch {}
  }
  addEventListener('pagehide', flushOnLeave);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') save(); });
  // Pick up changes made elsewhere (the widget or another PC) when nothing is waiting here.
  async function refresh() {
    if (dirty || saving || !data) return false;
    try {
      const doc = await api('/api/planner');
      if (Number(doc.updatedAt || 0) === updatedAt) return false;
      data = normalize(clone(doc.state)); base = clone(data); updatedAt = Number(doc.updatedAt || 0);
      onChange(data); status('saved');
      return true;
    } catch { return false; }
  }
  return { load, change, save, refresh, get data() { return data; }, get dirty() { return dirty; } };
}

// Today in Korea (the academy's day), as YYYY-MM-DD.
export function kstToday(now = Date.now()) {
  return new Date(now + 9 * 3600000).toISOString().slice(0, 10);
}
export function nowHM(now = Date.now()) {
  return new Date(now + 9 * 3600000).toISOString().slice(11, 16);
}
