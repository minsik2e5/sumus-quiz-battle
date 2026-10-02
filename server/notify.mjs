// V13.77 알림 bookkeeping inside the state (the sending itself is server/push.mjs, done by the
// Cloudflare wrapper after the change is saved):
//   state.push = {
//     vapid,                    the server's key pair (made on first use)
//     subject,                  https origin of the app (the contact the push services ask for)
//     subs: { profileId: [{ endpoint, keys, at, ua }] },   up to 4 phones per student
//     prefs: { profileId: { daily } },                     저녁 공부 알림 on/off (on by default)
//     reminded: { profileId: day },                        last evening reminder
//     notices: [{ id, school_id, class_name, text, at, from_name }]   선생님 공지 (last 30)
//   }
// A route that wants phones to buzz returns `_push: [{ to: [profileIds], title, body, url, tag }]`.
import { dayKey } from '../public/modules/core.js';
import { cleanSubscription } from './push.mjs';

export const PUSH_MAX_PER_STUDENT = 4;
export const NOTICE_MAX = 80;
export const NOTICE_SHOW_DAYS = 3;
export const LEGEND_SHOW_DAYS = 2;
const DAY = 86400000;
// 몽이가 / 루미가 / 용용이가: the subject particle that fits the name.
const ga = name => { const c = String(name).charCodeAt(String(name).length - 1) - 0xAC00; return c >= 0 && c <= 11171 && c % 28 ? `${name}이` : `${name}가`; };

export function pushState(state) {
  const push = state.push && typeof state.push === 'object' ? state.push : (state.push = {});
  push.subs ||= {}; push.prefs ||= {}; push.reminded ||= {};
  if (!Array.isArray(push.notices)) push.notices = [];
  return push;
}
const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };

export function pushView(state, p) {
  const push = state.push || {};
  return { on: (push.subs?.[p.id] || []).length > 0, daily: push.prefs?.[p.id]?.daily !== false, phones: (push.subs?.[p.id] || []).length };
}

// The same phone moves to whoever subscribed last on it (a shared tablet, a sibling's login).
export function addSubscription(state, p, raw, { ua = '', now = Date.now() } = {}) {
  const sub = cleanSubscription(raw);
  if (!sub) fail('알림을 켜지 못했어요. 브라우저를 확인해 주세요.');
  const push = pushState(state);
  for (const [id, list] of Object.entries(push.subs)) {
    const kept = list.filter(x => x.endpoint !== sub.endpoint);
    if (kept.length) push.subs[id] = kept; else delete push.subs[id];
  }
  push.subs[p.id] = [...(push.subs[p.id] || []), { ...sub, at: now, ua: String(ua).slice(0, 40) }].slice(-PUSH_MAX_PER_STUDENT);
  return push.subs[p.id].length;
}
export function removeSubscription(state, p, endpoint) {
  const push = pushState(state);
  const list = (push.subs[p.id] || []).filter(x => x.endpoint !== String(endpoint || ''));
  if (list.length) push.subs[p.id] = list; else delete push.subs[p.id];
}
// Phones whose push service answered 404/410 (the app was removed or the permission taken back).
export function dropEndpoints(state, endpoints) {
  const gone = new Set(endpoints);
  const push = state.push;
  if (!push?.subs || !gone.size) return false;
  let changed = false;
  for (const [id, list] of Object.entries(push.subs)) {
    const kept = list.filter(x => !gone.has(x.endpoint));
    if (kept.length === list.length) continue;
    changed = true;
    if (kept.length) push.subs[id] = kept; else delete push.subs[id];
  }
  return changed;
}

// 선생님 공지: saved (shown on the home screen for NOTICE_SHOW_DAYS) and pushed.
export function postNotice(state, teacher, school, students, { text, className = '', now = Date.now(), id }) {
  const clean = String(text || '').replace(/\s+/g, ' ').trim().slice(0, NOTICE_MAX);
  if (!clean) fail('공지 내용을 적어 주세요.');
  const push = pushState(state);
  const notice = { id, school_id: school.id, class_name: className || '', text: clean, at: now, from_name: teacher.display_name || '선생님' };
  push.notices = [...push.notices, notice].slice(-30);
  const to = students.map(s => s.id);
  const reach = to.filter(sid => (push.subs[sid] || []).length).length;
  return { notice, reach, total: to.length, message: { to, title: `📢 ${notice.from_name}`, body: clean, url: '/?go=home', tag: 'notice' } };
}
// V13.89 전설 소식: kept apart from 선생님 공지 — the home screen shows only the latest notice,
// so a legendary pull must never hide (or, in the teacher's sent list, pose as) the teacher's own.
export function postLegend(state, school, students, { text, now = Date.now(), id }) {
  const push = pushState(state);
  const news = { id, school_id: school.id, text, at: now };
  push.legends = [...(Array.isArray(push.legends) ? push.legends : []), news].slice(-30);
  return { news, message: { to: students.map(s => s.id), title: '🌟 전설 소식', body: text, url: '/?go=home', tag: 'legend' } };
}
export function legendFor(state, school, now = Date.now()) {
  const n = (state.push?.legends || []).filter(x => x.school_id === school?.id && now - x.at < LEGEND_SHOW_DAYS * DAY).at(-1);
  return n ? { id: n.id, text: n.text, at: n.at } : null;
}
export function noticeFor(state, p, school, now = Date.now()) {
  const list = (state.push?.notices || []).filter(n => n.school_id === school?.id && (!n.class_name || n.class_name === p.class_name) && now - n.at < NOTICE_SHOW_DAYS * DAY);
  const n = list.at(-1);
  return n ? { id: n.id, text: n.text, at: n.at, from_name: n.from_name, class_name: n.class_name } : null;
}

// 저녁 공부 알림: students with the app's 알림 on who have not studied today, once a day.
// studiedToday(p) and extra(p) come from the service (sessions, streak, pet).
export function eveningReminders(state, { now = Date.now(), studiedToday, extra = () => ({}) }) {
  const push = pushState(state);
  const today = dayKey(now);
  const messages = [];
  for (const p of state.profiles) {
    if (p.role !== 'student' || p.active === false) continue;
    if (!(push.subs[p.id] || []).length || push.prefs[p.id]?.daily === false || push.reminded[p.id] === today) continue;
    if (studiedToday(p)) continue;
    push.reminded[p.id] = today;
    const { streak = 0, pet = '' } = extra(p) || {};
    const title = streak >= 2 ? `🔥 연속 ${streak}일 기록이 끊기기 직전!` : `🐾 ${ga(pet || '펫')} 기다리고 있어요`;
    const body = streak >= 2 ? '오늘 단어 몇 개만 풀면 연속 기록이 이어져요.' : '오늘 단어 학습을 아직 안 했어요. 5분만 같이 해요!';
    messages.push({ to: [p.id], title, body, url: '/?go=practice', tag: 'daily' });
  }
  for (const id of Object.keys(push.reminded)) if (push.reminded[id] !== today) delete push.reminded[id];
  return messages;
}
