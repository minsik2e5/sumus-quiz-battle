// V13.142 학습 보상 이벤트: 선생님이 기간·대상을 정해 학습(연습·시험) 코인과 경험치를 1.5배 또는 2배로 준다.
//   state.rewardEvents = [{ id, name, multiplier, start_at, end_at, scope, school_ids, grade, created_by, created_at, ended_early_at }]
// - 시간은 서버 시간(ms)만 쓴다. 선생님이 고른 날짜·시간은 한국 시간(+09:00)으로 읽는다.
// - 대상: all(그 선생님이 맡은 모든 학교, 만들 때의 목록) · school(한 학교) · grade(한 학교의 한 학년, 고1 = 고1A·고1B).
// - 같은 학생에게 겹칠 수 있는 두 이벤트(기간이 겹치고 대상 학교가 겹치며 학년이 다르지 않음)는 만들 수 없다.
// - 계산(server/service.mjs practiceReward): 이벤트 추가 코인 = floor(기본 코인 × (배율 − 1)),
//   하루 학습 코인 한도 = STUDY_COINS.cap × 배율. 추가 경험치 = floor(경험치 × (배율 − 1)), 끝까지 푼 학습만.
//   코인이 0인 학습(중간 포기·정답률 미달)은 0 그대로.
import { gradeOf } from './competition.mjs';

export const EVENT_MULTIPLIERS = [1.5, 2];
export const EVENT_NAME_MAX = 30;
export const EVENT_MAX_DAYS = 31;
export const EVENT_MAX_OPEN = 20;
// 끝난 이벤트는 60일 동안 목록에 남는다.
const EVENT_KEEP_MS = 60 * 86400000;
const KST_INPUT = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;
const GRADES = { middle: ['중1', '중2', '중3'], high: ['고1', '고2', '고3'] };

const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };

// "2026-10-14T18:00" (한국 시간) → ms. 다른 모양은 받지 않는다.
export function parseKst(value) {
  const m = KST_INPUT.exec(String(value || '').trim());
  if (!m) return NaN;
  const ms = Date.parse(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:00+09:00`);
  // 2월 30일처럼 없는 날은 Date가 다음 달로 넘겨 버리므로 다시 맞춰 본다.
  return Number.isFinite(ms) && kstInput(ms) === `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}` ? ms : NaN;
}
export const kstInput = ms => new Date(ms + 9 * 3600000).toISOString().slice(0, 16);
export const kstLabel = ms => { const s = kstInput(ms); return `${Number(s.slice(5, 7))}/${Number(s.slice(8, 10))} ${s.slice(11, 16)}`; };
export const multiplierLabel = m => `×${m}`;

export function rewardEvents(state) {
  if (!Array.isArray(state.rewardEvents)) state.rewardEvents = [];
  return state.rewardEvents;
}
export function eventStatus(event, now = Date.now()) {
  if (now >= event.end_at) return 'ended';
  return now >= event.start_at ? 'live' : 'upcoming';
}
export function eventMatches(event, profile) {
  if (!event || !profile || profile.role !== 'student') return false;
  if (!(event.school_ids || []).includes(profile.school_id)) return false;
  return !event.grade || gradeOf(profile.class_name) === event.grade;
}
// 그 학생에게 `at`(서버 시간)에 걸린 이벤트. 겹치는 이벤트는 만들 수 없으니 많아야 하나지만, 혹시 모르니 큰 배율을 고른다.
export function activeEventFor(state, profile, at = Date.now()) {
  return (state.rewardEvents || [])
    .filter(e => e.start_at <= at && at < e.end_at && eventMatches(e, profile))
    .sort((a, b) => b.multiplier - a.multiplier || a.start_at - b.start_at)[0] || null;
}
const targetsOverlap = (a, b) => (a.school_ids || []).some(id => (b.school_ids || []).includes(id)) && (!a.grade || !b.grade || a.grade === b.grade);
const timesOverlap = (a, b) => a.start_at < b.end_at && b.start_at < a.end_at;
export const eventsOverlap = (a, b) => timesOverlap(a, b) && targetsOverlap(a, b);

export function targetLabel(state, event) {
  const name = id => state.schools.find(s => s.id === id)?.name || id;
  if (event.scope === 'all') return '전체';
  return `${name(event.school_ids[0])}${event.grade ? ` ${event.grade}` : ' 전체'}`;
}
export function teacherEventView(state, event, now = Date.now()) {
  return { id: event.id, name: event.name, multiplier: event.multiplier, start_at: event.start_at, end_at: event.end_at, scope: event.scope, school_ids: event.school_ids, grade: event.grade, target_label: targetLabel(state, event), status: eventStatus(event, now), ended_early: !!event.ended_early_at, created_at: event.created_at };
}
// 학생 화면에 보내는 것: 이름·배율·기간만.
export function studentEventView(event) {
  return event ? { id: event.id, name: event.name, multiplier: event.multiplier, start_at: event.start_at, end_at: event.end_at } : null;
}
// 선생님이 볼 수 있는 이벤트: 대상 학교가 모두 그 선생님이 맡은 학교인 것.
export const teacherOwns = (teacher, event) => (event.school_ids || []).length > 0 && event.school_ids.every(id => (teacher.school_ids || []).includes(id));

// 목록에 보일 이벤트(읽기만). 오래된 것은 만들 때 tidyEvents가 지운다.
export const keptEvents = (state, now = Date.now()) => (state.rewardEvents || []).filter(e => now - e.end_at < EVENT_KEEP_MS);
export function tidyEvents(state, now = Date.now()) {
  const list = rewardEvents(state);
  const kept = list.filter(e => now - e.end_at < EVENT_KEEP_MS);
  if (kept.length !== list.length) state.rewardEvents = kept;
  return state.rewardEvents;
}

export function createRewardEvent(state, teacher, body, { now = Date.now(), id }) {
  const name = String(body?.name ?? '').replace(/\s+/g, ' ').trim();
  if (!name) fail('이벤트 이름을 적어 주세요.');
  if ([...name].length > EVENT_NAME_MAX) fail(`이벤트 이름은 ${EVENT_NAME_MAX}자까지 쓸 수 있어요.`);
  const multiplier = Number(body?.multiplier);
  if (!EVENT_MULTIPLIERS.includes(multiplier)) fail('배율은 1.5배 또는 2배 중에서 골라 주세요.');
  const start = parseKst(body?.start), end = parseKst(body?.end);
  if (!Number.isFinite(start) || !Number.isFinite(end)) fail('시작과 끝 날짜·시간을 확인해 주세요.');
  if (end <= start) fail('끝나는 시간이 시작 시간보다 뒤여야 해요.');
  if (end <= now) fail('이미 지난 기간이에요. 끝나는 시간을 지금보다 뒤로 정해 주세요.');
  if (end - start > EVENT_MAX_DAYS * 86400000) fail(`이벤트는 ${EVENT_MAX_DAYS}일까지 열 수 있어요.`);
  const schools = state.schools.filter(s => s.active !== false && (teacher.school_ids || []).includes(s.id));
  const scope = ['all', 'school', 'grade'].includes(body?.scope) ? body.scope : null;
  if (!scope) fail('대상을 골라 주세요.');
  let school_ids, grade = null;
  if (scope === 'all') {
    school_ids = schools.map(s => s.id);
    if (!school_ids.length) fail('맡은 학교가 없어요.', 409);
  } else {
    const school = schools.find(s => s.id === body?.school_id);
    if (!school) fail('대상 학교를 확인해 주세요.', 403);
    school_ids = [school.id];
    if (scope === 'grade') {
      grade = String(body?.grade || '');
      if (!(GRADES[school.division] || []).includes(grade)) fail('대상 학년을 확인해 주세요.');
    }
  }
  const list = tidyEvents(state, now);
  if (list.filter(e => e.end_at > now).length >= EVENT_MAX_OPEN) fail(`진행 중·예정 이벤트는 ${EVENT_MAX_OPEN}개까지예요.`);
  // 지난 시각을 시작으로 고르면 지금부터 시작한다(이미 끝난 학습에는 소급하지 않는다). 그래서 방금 미리 끝낸 이벤트 뒤에 바로 이어 만들 수 있다.
  const event = { id, name, multiplier, start_at: Math.max(start, now), end_at: end, scope, school_ids, grade, created_by: teacher.id, created_at: now, ended_early_at: null };
  const clash = list.find(e => eventsOverlap(e, event));
  if (clash) fail(`“${clash.name}”(${kstLabel(clash.start_at)}~${kstLabel(clash.end_at)}, ${targetLabel(state, clash)})와 기간·대상이 겹쳐요. 같은 학생에게 이벤트가 두 개 걸릴 수 없어요.`, 409);
  list.push(event);
  return event;
}

function ownedEvent(state, teacher, eventId) {
  const event = rewardEvents(state).find(e => e.id === eventId);
  if (!event || !teacherOwns(teacher, event)) fail('이벤트를 찾을 수 없어요.', 404);
  return event;
}
// 미리 끝내기: 끝 시간을 지금으로. 예정이던 이벤트는 시작하지 않은 채 끝난다.
export function endRewardEvent(state, teacher, eventId, now = Date.now()) {
  const event = ownedEvent(state, teacher, eventId);
  if (event.end_at <= now) fail('이미 끝난 이벤트예요.', 409);
  event.end_at = now;
  if (event.start_at > now) event.start_at = now;
  event.ended_early_at = now;
  return event;
}
// 지우기: 목록에서 뺀다. 이미 받은 학습 보상(세션 기록)은 그대로 남는다.
export function deleteRewardEvent(state, teacher, eventId) {
  const event = ownedEvent(state, teacher, eventId);
  state.rewardEvents = rewardEvents(state).filter(e => e !== event);
  return event;
}

// 학습 한 번의 코인에 이벤트를 얹는다. breakdown은 기본 줄들(한도 적용 전), raw는 그 합.
// 돌려주는 값: 이벤트 줄(없으면 null)과 그날 한도.
export function eventCoins(event, raw, cap) {
  if (!event || raw <= 0) return { line: null, bonus: 0, cap };
  const bonus = Math.floor(raw * (event.multiplier - 1));
  return { line: bonus > 0 ? { label: `이벤트 ${multiplierLabel(event.multiplier)}`, points: bonus, event: true } : null, bonus, cap: Math.floor(cap * event.multiplier) };
}
export const eventXp = (event, xp) => event && xp > 0 ? Math.floor(xp * (event.multiplier - 1)) : 0;
