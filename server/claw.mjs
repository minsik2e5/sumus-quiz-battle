import { dayKey } from '../public/modules/core.js';
import { CLAW, DOLL_KEYS, DOLLS, AIM_CODE, dollName, dollReady, clawOpen, roundEnds, roundLayout, touchAt, guardAim, rollDrop, nextPity, jackpotBuddy, settleNudges } from '../public/modules/claw-rules.js';
import { findReceipt, keepReceipt, secureRandom } from './rewards.mjs';

// V13.180 인형뽑기(놀이터) 서버 쪽. 학생 기록 p.claw(작게, 구성안 §7):
//   { t (집게권), gd{ d, p, a, m } (오늘 받은 곳), r{ id, at, n, w, last } (열린 판: 시작 시각 · 쓴 집게 · 뽑힌 자리 비트 · 앞 집게 시각),
//     b[12] (도감 수, DOLL_KEYS 순서), gb (황금 도감 비트), n · ng (뽑은 인형 · 황금 합), m (연속 실패 보정 %p), q (최근 조준 글자),
//     cd · ct (코인 날짜 · 오늘 코인), coins (받은 코인 합: rewardIncome), bonus (도감 완성 보너스 받음 1), guide, done[] (영수증) }
// 판 배치는 저장하지 않는다: 판 id로 roundLayout을 매번 다시 만든다. 잡힘 · 놓침 · 대박은 서버 난수로 정한다(몬스터 사냥 huntThrow와 같다).
// 집게마다 영수증(id)을 남겨 같은 집게를 다시 보내도 집게를 또 쓰지 않는다. 판 시작도 판 id 영수증으로 한 번만.

const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };
const claw = p => p.claw ||= {};
const tickets = c => Number(c.t || 0);
const book = c => DOLL_KEYS.map((_, i) => Number(c.b?.[i] || 0));
const kinds = c => book(c).filter(Boolean).length;
const goldKinds = c => DOLL_KEYS.filter((_, i) => (Number(c.gb || 0) >> i) & 1).length;
const readyKeys = () => DOLL_KEYS.filter(k => dollReady(k));
// 판의 인형 종류: 그림이 12종 다 있으면 저장하지 않는다(r.keys 없음 = 12종 전부).
const keysOf = r => r.keys || DOLL_KEYS;

// 집게권 받기(공부로만). source: 'practice' | 'attend' | 'match'. 받았으면 true. 오늘 이미 받았거나 가득 찼으면 false.
export function grantClaw(p, source, { now = Date.now() } = {}) {
  if (!CLAW.SOURCES.includes(source) || !p || p.role === 'teacher') return false;
  const c = claw(p), d = dayKey(now), key = source[0];
  if (c.gd?.d !== d) c.gd = { d };
  if (c.gd[key] || tickets(c) >= CLAW.TICKET_MAX) return false;
  c.gd[key] = 1;
  c.t = tickets(c) + 1;
  return true;
}
// 교사 미리보기 계정: 들어올 때마다 집게권을 채운다(service.mjs가 부른다).
export function clawPreviewFill(p) { const c = claw(p); c.t = Math.max(tickets(c), CLAW.PREVIEW); }

// 시간이 지난 판을 닫는다(남은 집게는 버린다). 닫은 판의 요약을 돌려준다(없으면 null).
function closeStale(p, c, now) {
  if (!c.r || now <= roundEnds(c.r.at)) return null;
  const sum = summary(c.r);
  delete c.r;
  return sum;
}
function summary(r) {
  const dolls = roundLayout(r.id, keysOf(r));
  return { id: r.id, won: dolls.filter(d => (Number(r.w || 0) >> d.i) & 1).map(d => ({ k: d.k, g: d.g })), drops: Number(r.n || 0), coins: Number(r.coins || 0) };
}
const publicRound = (r, now) => ({ id: r.id, dolls: roundLayout(r.id, keysOf(r)), drops: CLAW.DROPS, time: CLAW.TIME, n: Number(r.n || 0), left: CLAW.DROPS - Number(r.n || 0), won: Number(r.w || 0),
  ends: roundEnds(r.at), aim_left: Math.max(0, Math.min(CLAW.TIME, Math.floor((roundEnds(r.at) - now - (CLAW.DROPS - Number(r.n || 0)) * CLAW.ANIM_MS - CLAW.GRACE_MS) / 1000))) });

export function clawView(p, now = Date.now()) {
  const c = p.claw || {}, d = dayKey(now), gd = c.gd?.d === d ? c.gd : {};
  const live = c.r && now <= roundEnds(c.r.at) ? publicRound(c.r, now) : null;
  return {
    open: clawOpen(), ready: readyKeys(), tickets: tickets(c), max: CLAW.TICKET_MAX,
    got: Object.fromEntries(CLAW.SOURCES.map(s => [s, !!gd[s[0]]])),
    book: book(c), gold: Number(c.gb || 0), kinds: kinds(c), gold_kinds: goldKinds(c), all: DOLL_KEYS.length, n: Number(c.n || 0), ng: Number(c.ng || 0),
    coin_today: c.cd === d ? Number(c.ct || 0) : 0, coin_daily: CLAW.COIN_DAILY, pity: Number(c.m || 0), live, guide: !!c.guide
  };
}
// 집게권 넣기(판 시작). id: 화면이 만든 판 번호. 같은 id를 다시 보내면 같은 판(집게권을 또 쓰지 않는다).
export function clawStart(p, { id, now = Date.now() }) {
  const c = claw(p);
  const stale = closeStale(p, c, now);
  if (!clawOpen()) fail('인형뽑기는 곧 열려요! 조금만 기다려 주세요.', 409);
  if (c.r && c.r.id === id) return { round: publicRound(c.r, now), again: true, stale };
  if (c.r) return { round: publicRound(c.r, now), resumed: true, stale };
  if (!/^[a-z0-9-]{8,40}$/i.test(String(id || ''))) fail('판 번호를 확인해 주세요.');
  if (findReceipt(c, 'claw-start', id)) fail('이미 끝난 판이에요. 새로 시작해 주세요.', 409);
  if (tickets(c) < 1) fail('집게권이 없어요. 공부(연습 끝내기 · 출석 · 짝 맞추기 별 3)하면 받아요!', 409);
  c.t = tickets(c) - 1;
  const ready = readyKeys();
  c.r = { id, at: now, n: 0, w: 0, last: now, coins: 0, ...(ready.length < DOLL_KEYS.length ? { keys: ready } : {}) };
  keepReceipt(c, 'claw-start', id, { ok: 1 }, now);
  return { round: publicRound(c.r, now), stale };
}
// 집게 하나. 내린 위치(x · y, 바닥 0~1)는 화면이 보내고, 닿은 인형 · 조준 · 잡힘은 서버가 정한다.
export function clawDrop(p, { id, round, n, x, y, now = Date.now(), random = secureRandom }) {
  const c = claw(p);
  const seen = findReceipt(c, 'claw', id);
  if (seen) return { ...seen.r, again: true };
  if (!/^[a-z0-9-]{8,40}$/i.test(String(id || ''))) fail('집게 번호를 확인해 주세요.');
  const stale = closeStale(p, c, now);
  const r = c.r;
  if (!r || r.id !== round) fail(stale ? '시간이 지나서 판이 끝났어요.' : '진행 중인 판이 없어요. 집게권을 넣어 주세요.', 409);
  if (Number(n) !== Number(r.n || 0)) fail('집게 순서가 맞지 않아요. 다시 들어와 주세요.', 409);
  const fast = now - Number(r.last || r.at) < (r.n ? CLAW.GAP_MS : CLAW.FIRST_MS);
  const cx = Math.round(Math.min(1, Math.max(0, Number(x) || 0)) * 1000) / 1000, cy = Math.round(Math.min(1, Math.max(0, Number(y) || 0)) * 1000) / 1000;
  const dolls = roundLayout(r.id, keysOf(r)), won = Number(r.w || 0);
  const touch = fast ? { aim: 'miss', doll: null } : touchAt(dolls, cx, cy, won);
  const aim = guardAim(touch.aim, c.q || '');
  c.q = (String(c.q || '') + AIM_CODE[touch.aim]).slice(-CLAW.GUARD.WINDOW);
  const target = touch.doll, gold = !!target?.g;
  const roll = rollDrop(aim, { pity: Number(c.m || 0), gold }, random(), random(), random());
  c.m = target ? nextPity(c.m, roll.result) : Number(c.m || 0);
  r.n = Number(r.n || 0) + 1; r.last = now;
  const out = { n: r.n - 1, aim, target: target ? target.i : null, result: roll.result, slip: roll.slip, grip: roll.grip, doll: null, extra: null, fresh: false, coins: 0, nudge: [], left: CLAW.DROPS - r.n, end: r.n >= CLAW.DROPS,
    ...(aim !== touch.aim ? { claimed: touch.aim } : {}), ...(fast ? { fast: true } : {}) };
  if (roll.result === 'win') {
    const got = [target];
    const buddy = roll.jackpot ? jackpotBuddy(dolls, target, won) : null;
    if (buddy) got.push(buddy);
    let mask = won;
    for (const d of got) mask |= 1 << d.i;
    r.w = mask;
    const before = kinds(c), d0 = dayKey(now);
    if (c.cd !== d0) { c.cd = d0; c.ct = 0; }
    let coins = 0;
    const fresh = [];
    for (const d of got) {
      const idx = DOLL_KEYS.indexOf(d.k);
      if (d.g) { if (!((Number(c.gb || 0) >> idx) & 1)) fresh.push(`g-${d.k}`); c.gb = Number(c.gb || 0) | (1 << idx); c.ng = Number(c.ng || 0) + 1; }
      else { const b = book(c); if (!b[idx]) fresh.push(d.k); b[idx]++; c.b = b; }
      c.n = Number(c.n || 0) + 1;
      const pay = Math.max(0, Math.min(d.g ? CLAW.GOLD_COIN : CLAW.COIN, CLAW.COIN_DAILY - Number(c.ct || 0)));
      c.ct = Number(c.ct || 0) + pay; coins += pay;
    }
    // 도감 12종 완성 보너스(한 번). 하루 상한과 따로다.
    const complete = before < DOLL_KEYS.length && kinds(c) >= DOLL_KEYS.length && !c.bonus;
    if (complete) { c.bonus = 1; coins += CLAW.BOOK_BONUS; }
    c.coins = Number(c.coins || 0) + coins;
    r.coins = Number(r.coins || 0) + coins;
    Object.assign(out, { doll: { k: target.k, g: target.g }, extra: buddy ? { k: buddy.k, g: buddy.g, i: buddy.i } : null, fresh: fresh.length > 0, fresh_keys: fresh, coins, complete,
      nudge: settleNudges(dolls, target, mask) });
  }
  if (out.end) { out.summary = summary(r); delete c.r; }
  return keepReceipt(c, 'claw', id, out, now);
}
export function clawGuideSeen(p) { claw(p).guide = 1; }
// 활동 기록 한 줄(판이 끝났을 때).
export function clawActivityText(sum) {
  const won = sum?.won || [];
  if (!won.length) return `인형뽑기 꽝(집게 ${sum?.drops || 0}번)`;
  return `인형뽑기 ${won.length}개 (${won.map(d => dollName(d.k, !!d.g).replace(/^(황금 )?\S+ /, '$1')).join(' · ')})`;
}
export const clawTitleStats = p => ({ claw_dolls: Number(p?.claw?.n || 0), claw_kinds: kinds(p?.claw || {}), claw_gold: Number(p?.claw?.ng || 0) });
export { DOLLS };
