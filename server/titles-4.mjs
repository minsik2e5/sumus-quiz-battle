import { dayKey, LEGEND_EGG_PRICE } from '../public/modules/core.js';
import { FISH, FISH_KEYS, DEEP_KEYS } from '../public/modules/fishing-rules.js';
import { trophyOf } from '../public/modules/reel-feel.js';
import { HUNT_MONSTERS, MONSTER_KEYS, HUNT_PLACES } from '../public/modules/hunt-rules.js';

// V13.191 칭호 4탄(docs/titles-plan-4.md)의 기록. 새로 저장하는 키는 넷뿐이고, 모두 이미 저장하는 곳에 숫자만 얹는다:
//   p.reel.dc = { d: 오늘, n: 오늘 잡은 수, b: 하루 최다 }        (끌어올리기 reelLand)
//   p.care.dn = 펫을 돌본 날 수(그날 첫 돌보기에 +1)                (펫 교감 petCare)
//   p.timing.pw = { k: 지난주 시작, b: 그 주 최고, n: 판 수 }      (10초 맞추기 끝: 주가 바뀌었으면 wk를 옮긴다)
//   p.range_best = { c, mc, mm, all }의 최고값                     (연습 끝 finishPractice)
// 나머지(낚시 · 몬스터 도감, 낚싯대, 코인, 펫 이름 · 레벨)는 지금 서버 기록에서 바로 센다. 학생 폰이 보낸 값은 쓰지 않는다.

// 잡은 물고기 한 마리(황금 알 물고기도 잡은 것). 날짜가 바뀌면 오늘 수는 0부터.
export function reelDayCatch(r, now = Date.now()) {
  const today = dayKey(now), dc = r.dc && r.dc.d === today ? r.dc : { d: today, n: 0, b: Number(r.dc?.b || 0) };
  dc.n = Number(dc.n || 0) + 1;
  dc.b = Math.max(Number(dc.b || 0), dc.n);
  r.dc = dc;
  return dc;
}

// 펫 교감 한 번. `firstToday`: 이 교감 전에 오늘 돌본 적이 없었다(c.day가 오늘이 아니었다).
export function careDayCount(c, firstToday) {
  if (firstToday) c.dn = Number(c.dn || 0) + 1;
  return Number(c.dn || 0);
}

// 10초 맞추기 판이 끝나기 전에: 기록된 주(wk.k)가 이번 주가 아니면 그 주 기록을 pw로 옮긴다(wk는 timing.mjs가 새로 만든다).
// timing.mjs는 건드리지 않는다: wk = { k, b, n, s } 구조만 읽는다.
export function keepTimingLastWeek(p, weekStart) {
  const t = p?.timing, wk = t?.wk;
  if (!wk?.n || wk.k === weekStart) return t?.pw || null;
  t.pw = { k: wk.k, b: wk.b, n: wk.n };
  return t.pw;
}
// 그 주(weekStart) 기록: 지난주에 판이 끝난 뒤로 하지 않았으면 wk가 그대로 그 주 것이고, 했으면 pw에 옮겨져 있다.
export function timingWeekOf(p, weekStart) {
  const t = p?.timing || {};
  if (t.wk?.k === weekStart && t.wk.n) return { b: Number(t.wk.b), n: Number(t.wk.n) };
  if (t.pw?.k === weekStart && t.pw.n) return { b: Number(t.pw.b), n: Number(t.pw.n) };
  return null;
}
// 지난주 10초 맞추기 1위(학년 묶음마다): 10초 맞추기 순위와 같은 줄 세우기(오차가 작을수록, 같으면 판이 많을수록). 완전히 같으면 함께 1위.
//   band(x): 같은 부 · 같은 학년 묶음 이름(없으면 순위에 들지 않음), ranked(x): 순위에 드는 학생(교사 미리보기 계정 빼고).
export function timingWeekKings(profiles, weekStart, { ranked = () => true, band = () => null } = {}) {
  const best = new Map();
  for (const x of profiles || []) {
    if (!ranked(x)) continue;
    const g = band(x), w = g ? timingWeekOf(x, weekStart) : null;
    if (!w) continue;
    const top = best.get(g);
    if (!top || w.b < top.b || (w.b === top.b && w.n > top.n)) best.set(g, { b: w.b, n: w.n, ids: [x.id] });
    else if (w.b === top.b && w.n === top.n) top.ids.push(x.id);
  }
  return new Set([...best.values()].flatMap(x => x.ids));
}

// 낚시 도감 p.games.fish.book{ 물고기: { n, kg } }(무게는 서버가 던질 때 정한다), 낚싯대 p.reel.rod.
export function fishTitleStats(p) {
  const book = p?.games?.fish?.book || {}, caught = Object.keys(book).filter(k => FISH[k] && Number(book[k]?.n || 0) > 0);
  return {
    // 월척: 게임 속 "월척!"과 같은 기준(trophyOf). 종마다 최고 무게를 넣어 하나라도 월척이면(배포 전에 잡은 것도 소급).
    fish_trophy: caught.filter(k => trophyOf({ caught: true, key: k, rarity: FISH[k].rarity, kg: Number(book[k].kg || 0) }).trophy).length,
    fish_kinds: caught.length,
    fish_shore: caught.filter(k => FISH_KEYS.includes(k)).length,
    fish_legend: caught.filter(k => FISH[k].rarity === 'legend').length,
    deep_kinds: caught.filter(k => DEEP_KEYS.includes(k)).length,
    fish_day_best: Number(p?.reel?.dc?.b || 0),
    reel_rod: Math.max(1, Math.min(5, Math.floor(Number(p?.reel?.rod || 1))))
  };
}

// 몬스터 사냥 도감 p.hunt.book{ 몬스터: { n } }(잡힘은 서버가 정한다). 장소: 숲 · 들판 · 바닷가 9종씩, 밤 9종.
export const HUNT_DAY_PLACES = Object.keys(HUNT_PLACES).filter(k => k !== 'night');
export function huntTitleStats(p) {
  const book = p?.hunt?.book || {}, caught = MONSTER_KEYS.filter(k => Number(book[k]?.n || 0) > 0);
  const at = place => caught.filter(k => HUNT_MONSTERS[k].place === place).length;
  return { hunt_kinds: caught.length, hunt_night: at('night'), hunt_place_best: Math.max(0, ...HUNT_DAY_PLACES.map(at)) };
}

// 쓴 코인(p.points_spent)에서 전설 알(한 번뿐, 이미 '전설의 주인' 칭호가 있다)은 뺀다(선생님 결정 3).
export function coinSpent(p) {
  return Math.max(0, Number(p?.points_spent || 0) - (p?.legend_egg?.buy ? LEGEND_EGG_PRICE : 0));
}
// 번 코인: 연습 · 보너스 판(sessions의 reward_points) + 대회 상금 + 출석 · 칭호 · 선물 · 진주 · 별조각 · 인형 코인.
// 가위바위보 · 주식 · 뽑기 · 더블 찬스의 받은 돈과 야차전 코인은 넣지 않는다(건 돈을 돌려받는 것까지 들어 있어 부풀릴 수 있다).
export function coinEarned(p, sessions = [], prizes = 0) {
  return sessions.reduce((n, s) => n + Number(s.reward_points || 0), 0) + Number(prizes || 0)
    + Number(p?.attendance?.coins || 0) + Number(p?.title_reward?.total || 0) + Number(p?.gift_box?.total || 0)
    + Number(p?.reel?.coins || 0) + Number(p?.hunt?.coins || 0) + Number(p?.claw?.coins || 0);
}

// 시험 범위: 그 학생 학교 · 학년의 책(books, `exam_period` · `mock`)과 범위마다 상태(service.mjs wordRangeMastery의 ranges).
//   c 한 바퀴 돈 범위 수(모든 단어를 한 번 이상) · mc 모든 범위를 한 바퀴 돈 모의고사 책 수 · mm 모든 범위를 정복한 모의고사 책 수
//   all 모든 범위를 정복한 시험(중간 · 기말) 수 · books 모의고사 책 수(칭호 도감에 모의고사 칭호를 보일지)
const MASTERED = new Set(['master', 'perfect']);
export function rangeCounts(books = [], ranges = {}) {
  const codesOf = list => [...new Set(list.flatMap(b => (b.words || []).map(w => String(w.range_code || ''))).filter(code => ranges[code]))];
  const covered = code => ranges[code].total > 0 && ranges[code].attempted >= ranges[code].total, done = code => MASTERED.has(ranges[code].status);
  const mocks = books.filter(b => b.mock).map(b => codesOf([b])).filter(codes => codes.length);
  const periods = ['midterm', 'final'].map(period => codesOf(books.filter(b => (b.exam_period === 'final' ? 'final' : 'midterm') === period))).filter(codes => codes.length);
  return {
    c: Object.keys(ranges).filter(covered).length,
    mc: mocks.filter(codes => codes.every(covered)).length,
    mm: mocks.filter(codes => codes.every(done)).length,
    all: periods.filter(codes => codes.every(done)).length,
    books: mocks.length
  };
}
const RANGE_BEST_KEYS = ['c', 'mc', 'mm', 'all'];
// 지금 값과 기억한 최고값 중 큰 것: 정복은 최근 30문제 정답률이라 풀릴 수 있지만, 한 번 얻은 칭호는 그대로다(선생님 결정 2).
export function rangeTitleStats(p, now = null) {
  const best = p?.range_best || {}, v = k => Math.max(Number(now?.[k] || 0), Number(best[k] || 0));
  return { range_cover: v('c'), mock_cover: v('mc'), mock_clear: v('mm'), range_all: v('all'), mock_books: Number(now?.books || 0) };
}
// 연습이 끝날 때 최고값을 같이 갱신한다(세션 저장과 같은 쓰기라 저장 횟수는 늘지 않는다). 모두 0이면 키를 만들지 않는다.
export function rememberRangeBest(p, now) {
  const s = rangeTitleStats(p, now), next = { c: s.range_cover, mc: s.mock_cover, mm: s.mock_clear, all: s.range_all };
  if (RANGE_BEST_KEYS.some(k => next[k])) p.range_best = next;
  return p.range_best;
}

// 펫 육성: 이름 지어 준 펫, 가장 높은 펫 레벨(petProgress가 센 레벨).
export function petTitleStats(p, progress = []) {
  return {
    pet_named: (Array.isArray(p?.pets) ? p.pets : []).filter(pet => String(pet?.name || '').trim()).length,
    pet_best_level: Math.max(0, ...progress.map(x => Number(x.level || 0))),
    care_days: Number(p?.care?.dn || 0)
  };
}
