import { dayKey } from '../public/modules/core.js';
import { BLANK_REWARDS, BLANK_DAILY_COINS } from '../public/modules/rewards.js';
import { BLANK_BOOKS, blankGroup, blankKey, blankStepOk, gradeBlankStep, blankMinMs } from '../public/modules/blank-rules.js';
import { addBonus } from './rewards.mjs';

// V13.177 빈칸영작 서버 쪽(중등 학습 → 빈칸영작). 학생 기록 p.blank:
//   { done: { ['5-1:2']: 첫 완료 시각 } (본문 × 단계, 최대 BLANK_DONE_MAX = 두 교과서 본문 수 × 5; YBM 본문은 'y5-1:2'), rate: { ['5-1:2']: 1차 정답률 0 ~ 100 (화면에 보이는 값, 가장 높은 것) }, day: { d: 'YYYY-MM-DD', coins: 오늘 받은 코인 },
//     live: { id, g: 본문, s: 단계, at }, last: { id, r: 마지막 끝 보고의 답 } }
// 몬스터전처럼 시작 신호 → 끝 보고 → 보상. 끝 보고는 문항별 최종 답이고, 서버가 같은 데이터 파일로 다시 채점한다.
// 보상은 본문 × 단계마다 첫 완료 때 한 번(BLANK_REWARDS). 하루 코인은 BLANK_DAILY_COINS까지, 넘으면 경험치만.
// 정직하게: 정답이 학생 폰에 있는 데이터 파일이라 끝 보고를 꾸밀 수는 있다. 서버 채점은 실수 · 가벼운 조작을 막는 용이고,
// 한 번뿐인 보상(전체 약 700코인)과 하루 상한으로 최악의 경우를 막는다.
const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };
// V13.196 교과서 두 벌(중2 YBM · 중3 동아)의 본문 × 5단계.
export const BLANK_DONE_MAX = BLANK_BOOKS.reduce((n, book) => n + Object.values(book.lessons).reduce((m, l) => m + l.groups.length, 0), 0) * 5;

export function blankMiddle(p) {
  return (p?.division || (/^중/.test(String(p?.class_name || '')) ? 'middle' : 'high')) === 'middle';
}
function guard(p, groupId, step) {
  if (p?.role !== 'student') fail('이 기능을 사용할 권한이 없습니다.', 403);
  if (!blankMiddle(p)) fail('빈칸영작은 중등 학생만 할 수 있어요.', 403);
  const found = blankGroup(String(groupId));
  if (!found || !found.items.length) fail('본문을 확인해주세요.');
  if (!blankStepOk(Number(step))) fail('단계를 확인해주세요.');
  return found;
}
export function blankView(p, now = Date.now()) {
  const b = p?.blank || {};
  const used = b.day?.d === dayKey(now) ? Number(b.day.coins || 0) : 0;
  return { done: { ...(b.done || {}) }, rate: { ...(b.rate || {}) }, left: Math.max(0, BLANK_DAILY_COINS - used), daily: BLANK_DAILY_COINS };
}
export function blankStart(p, { group, step, id, now = Date.now() }) {
  guard(p, group, Number(step));
  (p.blank ||= {}).live = { id, g: String(group), s: Number(step), at: now };
  return { id, ...blankView(p, now) };
}
export function blankFinish(p, { id, group, step, answers, rate, pet, now = Date.now() }) {
  const found = guard(p, group, Number(step));
  const s = Number(step), b = p.blank ||= {};
  if (id && b.last?.id === id) return { ...b.last.r, again: true, ...blankView(p, now) };
  const live = b.live;
  if (!id || !live || live.id !== id || live.g !== found.group.id || live.s !== s) return { paid: false, reason: 'nostart', ...blankView(p, now) };
  delete b.live;
  const base = { group: found.group.id, step: s };
  const keep = result => { b.last = { id, r: result }; return { ...result, ...blankView(p, now) }; };
  const graded = gradeBlankStep(found.items, s, answers);
  if (!graded.ok) return keep({ paid: false, reason: 'wrong', wrong: graded.wrong, ...base });
  const key = blankKey(found.group.id, s);
  // 1차 정답률은 화면에 보여 주는 값일 뿐(보상과 상관없음): 0 ~ 100 정수만, 가장 높은 값을 남긴다.
  const shown = rate == null ? -1 : Math.round(Number(rate));
  if (shown >= 0 && shown <= 100) { const r = b.rate ||= {}; r[key] = Math.max(Number(r[key] || 0), shown); }
  if (b.done?.[key]) return keep({ paid: false, reason: 'again', ...base });
  if (now - live.at < blankMinMs(found.items, s)) return keep({ paid: false, reason: 'short', ...base });
  const today = dayKey(now);
  if (b.day?.d !== today) b.day = { d: today, coins: 0 };
  const reward = BLANK_REWARDS[s];
  const coins = Math.max(0, Math.min(reward.coins, BLANK_DAILY_COINS - Number(b.day.coins || 0)));
  (b.done ||= {})[key] = now;
  b.day.coins = Number(b.day.coins || 0) + coins;
  addBonus(p, { xp: reward.xp, coins, pet, now });
  return keep({ paid: true, coins, xp: reward.xp, capped: coins < reward.coins, ...base });
}
