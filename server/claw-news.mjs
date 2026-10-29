import { dollName } from '../public/modules/claw-rules.js';
import { gradeOf, isRankedStudent, isPrivate } from './competition.mjs';

// V13.191 인형뽑기 반 소식(docs/claw-upgrade-design.md §2). 전설 소식(service.mjs announceLegend · notify.mjs postLegend · legendFor)과 같은 결:
//   같은 학교 · 같은 부 · 같은 학년 친구가 황금 인형 · 대박(두 개) · 도감 완성 · 도감 N번째 새 인형을 뽑으면 한 줄 소식.
//   보이는 곳은 놀이터 인형뽑기 화면 위쪽 한 줄뿐이다(홈의 선생님 공지 · 전설 소식을 가리지 않게, 푸시 알림도 보내지 않는다).
//   비공개 학생(isPrivate) · 선생님 미리보기 계정 · 쉬는 계정은 소식을 만들지 않는다. 학생 한 명은 하루 PER_DAY개까지.
// 저장: state.clawNews(최상위 키 → 백업 조각 k:clawNews 하나, 상태 전체를 키우지 않게 최근 KEEP개만).
//   한 줄 { id, s: 학교 id, d: 부, g: 학년, p: 학생 id, t: 문구, at }. 응답에는 { id, text, at }만 나간다(판 배치 · 조준 같은 힌트 없음).
export const CLAW_NEWS = { KEEP: 50, SHOW: 3, SHOW_MS: 24 * 3600000, PER_DAY: 2, MILESTONES: [6], NAME_MAX: 10, ALL: 12 };
export const CLAW_NEWS_KINDS = ['complete', 'gold', 'jackpot', 'book'];
const DAY_MS = 24 * 3600000;
const kstDay = ms => Math.floor((Number(ms) + 9 * 3600000) / DAY_MS);

// 집게 하나의 서버 결과(res: claw.mjs clawDrop) → 소식 종류(없으면 null). 여럿이면 앞의 것 하나만(완성 > 황금 > 대박 > 도감 N번째).
export function clawNewsKind(res, kindsAfter) {
  if (!res || res.result !== 'win' || res.again) return null;
  if (res.complete) return 'complete';
  if (res.doll?.g || res.extra?.g) return 'gold';
  if (res.extra) return 'jackpot';
  return milestoneOf(res, kindsAfter) ? 'book' : null;
}
// 이번 집게로 넘은 도감 칸 수(MILESTONES 중 하나, 없으면 0). 황금 도감은 따로라서 일반 새 인형만 센다.
function milestoneOf(res, kindsAfter) {
  const freshPlain = (res.fresh_keys || []).filter(k => !String(k).startsWith('g-')).length;
  const after = Number(kindsAfter || 0), before = after - freshPlain;
  return freshPlain ? CLAW_NEWS.MILESTONES.find(m => before < m && after >= m) || 0 : 0;
}
const shortName = name => { const s = String(name || '').replace(/\s+/g, ' ').trim(); return [...s].length > CLAW_NEWS.NAME_MAX ? `${[...s].slice(0, CLAW_NEWS.NAME_MAX).join('')}…` : s || '친구'; };
export function clawNewsText(name, kind, res, kindsAfter) {
  const who = `${shortName(name)} 학생이`;
  if (kind === 'complete') return `${who} 인형 도감 ${CLAW_NEWS.ALL}종을 다 모았어요!`;
  if (kind === 'gold') { const g = res.doll?.g ? res.doll : res.extra; return `${who} ${dollName(g.k, true)} 인형을 뽑았어요!`; }
  if (kind === 'jackpot') return `${who} 대박! 인형 두 개를 한 번에 뽑았어요!`;
  if (kind === 'book') return `${who} 도감 ${milestoneOf(res, kindsAfter)}번째 새 인형을 모았어요!`;
  return '';
}
const list = state => Array.isArray(state.clawNews) ? state.clawNews : (state.clawNews = []);
// 소식을 남긴다. 남겼으면 그 줄, 아니면 null.
export function postClawNews(state, p, school, res, { kinds, now = Date.now(), id } = {}) {
  if (!school || !isRankedStudent(p) || isPrivate(p)) return null;
  const kind = clawNewsKind(res, kinds);
  if (!kind) return null;
  const all = list(state), today = kstDay(now);
  if (all.filter(n => n.p === p.id && kstDay(n.at) === today).length >= CLAW_NEWS.PER_DAY) return null;
  const news = { id: String(id || `cn-${now.toString(36)}`).slice(0, 40), s: school.id, d: p.division || school.division || '', g: gradeOf(p.class_name) || '', p: p.id, t: clawNewsText(p.display_name, kind, res, kinds), at: now };
  state.clawNews = [...all.filter(n => now - n.at < CLAW_NEWS.SHOW_MS * 2), news].slice(-CLAW_NEWS.KEEP);
  return news;
}
// 내 반(같은 학교 · 부 · 학년)의 최근 소식(새것부터 SHOW개). 학교가 없으면 빈 목록.
export function clawNewsFor(state, p, school, now = Date.now()) {
  if (!school || !p) return [];
  const g = gradeOf(p.class_name) || '';
  return (Array.isArray(state.clawNews) ? state.clawNews : [])
    .filter(n => n.s === school.id && n.d === (p.division || school.division || '') && n.g === g && now - n.at >= 0 && now - n.at < CLAW_NEWS.SHOW_MS)
    .slice(-CLAW_NEWS.SHOW).reverse().map(n => ({ id: n.id, text: n.t, at: n.at }));
}
