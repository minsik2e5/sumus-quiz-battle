// V13.214 선생님 결과 분석 탭 기록(GET /api/teacher/records)과 학생 기록 창(GET /api/teacher/student-detail/:id).
// 첫 화면(/bootstrap)에는 오늘 기록과 최근 실전시험만 오므로, 전체 기록은 그 탭 · 창을 열 때 작은 쪽(30개)으로 받는다.
// 같은 조건은 1분 동안 다시 묻지 않는다(캐시). 새로 받는 동안에는 직전에 보던 표를 그대로 보여 준다(깜빡임 없이).
import { api } from './ui.js';

export const RECORDS_PAGE = 30;
const FRESH_MS = 60000;
const entries = new Map();
let lastByView = {}, lastMetrics = null, loaded = null, timer = null, wanted = null;
export function onTeacherRecordsLoaded(callback) { loaded = callback; }

const keyOf = (view, cls, q) => JSON.stringify([view, cls || '', String(q || '').trim().toLowerCase()]);

async function fetchPage(key, view, cls, q, offset, limit) {
  const entry = entries.get(key);
  if (entry?.promise) return entry.promise;
  const params = new URLSearchParams({ view, offset: String(offset), limit: String(limit) });
  if (cls) params.set('class', cls);
  if (String(q || '').trim()) params.set('q', String(q).trim());
  const promise = api('/teacher/records?' + params.toString()).then(res => {
    const prev = entries.get(key);
    const rows = offset && prev && prev.at ? [...prev.rows.slice(0, offset), ...res.rows] : res.rows;
    const next = { rows, total: res.total, metrics: res.metrics, at: Date.now(), error: null };
    entries.set(key, next);
    lastByView[view] = next; lastMetrics = res.metrics;
    return next;
  }).catch(error => {
    const prev = entries.get(key);
    entries.set(key, { ...(prev || { rows: [], total: 0, metrics: null }), at: prev?.at || 0, error: error?.message || '기록을 불러오지 못했어요.', failedAt: Date.now() });
    throw error;
  }).finally(() => { const e = entries.get(key); if (e) delete e.promise; });
  entries.set(key, { ...(entry || { rows: [], total: 0, metrics: null, at: 0 }), promise });
  return promise;
}

// 화면이 그릴 때 부른다. 필요한 만큼(need개) 없거나 오래됐으면 받아 오고, 다 받으면 onTeacherRecordsLoaded로 다시 그린다.
// 검색어를 칠 때마다 묻지 않게 마지막 조건만 0.25초 뒤에 묻는다.
export function teacherRecords({ view, cls = '', q = '', need = RECORDS_PAGE }) {
  const key = keyOf(view, cls, q), entry = entries.get(key);
  const fresh = entry && entry.at && Date.now() - entry.at < FRESH_MS;
  const enough = fresh && (entry.rows.length >= Math.min(need, entry.total) || view === 'week');
  const failedRecently = entry?.error && Date.now() - (entry.failedAt || 0) < 5000;
  if (!enough && !entry?.promise && !failedRecently) {
    const offset = fresh ? entry.rows.length : 0;
    const limit = view === 'week' ? 1 : Math.min(100, Math.max(RECORDS_PAGE, need - offset));
    wanted = key;
    clearTimeout(timer);
    timer = setTimeout(() => {
      if (wanted !== key) return;
      fetchPage(key, view, cls, q, offset, limit).then(() => loaded?.()).catch(() => loaded?.());
    }, entry ? 0 : 250);
  }
  const shown = fresh || entry?.at ? entry : lastByView[view];
  return { rows: shown?.rows || [], total: shown?.total || 0, metrics: entry?.metrics || lastMetrics, loading: !enough, stale: !!shown && shown !== entry, error: entry?.error || null };
}

// 첫 화면을 새로 받으면(재채점 · 학생 정보 변경 뒤 등) 다음에 그릴 때 다시 받는다. 보던 표는 받는 동안 그대로 둔다.
export function markTeacherRecordsStale() { for (const entry of entries.values()) entry.at = 0; }
export function clearTeacherRecords() { entries.clear(); lastByView = {}; lastMetrics = null; }
export function findTeacherRecord(id) {
  for (const entry of entries.values()) { const hit = entry.rows.find(row => row.id === id); if (hit) return hit; }
  return null;
}

// 학생 기록 창: 최근 연습 5개 · 마지막 학습 · 시험범위 정복(단어 숙련도). 같은 학생은 1분 동안 다시 묻지 않는다.
const details = new Map();
export async function teacherStudentDetail(id, { force = false } = {}) {
  const hit = details.get(id);
  if (!force && hit && Date.now() - hit.at < FRESH_MS) return hit.data;
  const data = await api('/teacher/student-detail/' + encodeURIComponent(id));
  details.set(id, { data, at: Date.now() });
  if (details.size > 60) details.delete(details.keys().next().value);
  return data;
}
export function forgetStudentDetail(id) { if (id) details.delete(id); else details.clear(); }
