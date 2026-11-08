// V13.234 검사: 펫 아레나 랭크 시즌(public/modules/arena-rank-rules.js · server/arena-rank.mjs · arena-rank-ui.js).
//   RP 계산 · 티어 경계 · 시즌 경계 · 소프트 리셋 · 보상 한 번만 · 농사 막기 · 연습/컴퓨터 판 제외 · 랭킹 GET만(1분 캐시) · 예산.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { RANK, RANK_TIERS, SEASON_COINS, tierOf, tierIndex, seasonOf, softReset, rpDelta, rpRatio } from '../public/modules/arena-rank-rules.js';
import { rolledRank, rankView, applyRank, claimRank, rankTitleStats, rankBoard, rankBoardView, rankBand, clearRankCache, RANK_CACHE_MS } from './arena-rank.mjs';
import { arenaStart, arenaFinish, grantArenaTicket } from './arena.mjs';
import { liveSettleOne } from './arena-live.mjs';
import { ARENA, createArena, fighter } from '../public/modules/arena-rules.js';
import { playArena, seeded } from './arena-sim.mjs';
import { TITLES, TITLES_ARENA_RANK, titleUnlocked } from '../public/modules/titles.js';
import { STATE_BUDGET_KB, VIEW_LIKE_POST } from './perf-budget.mjs';
import { READ_POSTS, VIEW_POSTS } from './mutation-coordinator.mjs';

const source = path => readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8');
const DAY = 86400000;

export async function runArenaRankChecks(assert) {
  // 1) 티어 경계.
  {
    const L = rp => tierOf(rp).label;
    assert(L(0) === '브론즈 III' && L(99) === '브론즈 III' && L(100) === '브론즈 II' && L(299) === '브론즈 I' && L(300) === '실버 III' && L(600) === '골드 III' && L(899) === '골드 I' && L(900) === '플래티넘 III' && L(1199) === '플래티넘 I' && L(1200) === '다이아 III' && L(1400) === '다이아 I' && L(5000) === '다이아 I',
      'V13.234 티어 경계: 티어마다 300점(III · II · I 100점씩), 브론즈 0 · 실버 300 · 골드 600 · 플래티넘 900 · 다이아 1200');
    assert(tierOf(1450).next === null && tierOf(1450).pct === 100 && tierOf(720).pct === 20 && tierOf(720).next === 800 && tierOf(-50).label === '브론즈 III' && tierIndex('abc') === 0 && RANK_TIERS.length === 5,
      'V13.234 다이아 I은 끝(다음 없음), 막대는 단계 안 비율, 이상한 값은 0');
  }
  // 2) 시즌 경계(월요일 0시 한국 시간 · 4주).
  {
    const s1 = seasonOf(RANK.EPOCH), s2 = seasonOf(RANK.EPOCH + RANK.SEASON_MS), last = seasonOf(RANK.EPOCH + RANK.SEASON_MS - 1);
    const kst = new Date(RANK.EPOCH + 9 * 3600000);
    assert(kst.getUTCDay() === 1 && kst.getUTCHours() === 0 && s1.no === 1 && last.no === 1 && s2.no === 2 && s2.start === RANK.EPOCH + 28 * DAY && last.days_left === 1 && s1.days_left === 28 && seasonOf(RANK.EPOCH - DAY).no === 1,
      'V13.234 시즌: 2026-11-02(월) 0시(한국 시간)부터 4주씩, 번호 · 시작 · 끝은 날짜로만 계산(그 전 시간은 시즌 1)');
    assert(new Date(seasonOf(RANK.EPOCH + 100 * DAY).start + 9 * 3600000).getUTCDay() === 1, 'V13.234 모든 시즌은 월요일에 시작한다');
  }
  // 3) RP 계산: 승패 · 상대 힘 · 연승 · 브론즈 보호 · 난투 2등 · 무승부 · 0 아래 없음.
  {
    const win = rpDelta({ win: true, rp: 500, ratio: 1, streak: 1 }), lose = rpDelta({ win: false, rp: 500, ratio: 1 });
    assert(win === RANK.WIN && lose === -RANK.LOSE && rpDelta({ win: false, draw: true, rp: 500 }) === 0, 'V13.234 기본: 이기면 +20 · 지면 −16 · 무승부 0');
    assert(rpDelta({ win: true, rp: 500, ratio: 1.3, streak: 1 }) > win && rpDelta({ win: true, rp: 500, ratio: 0.5, streak: 1 }) < win && rpDelta({ win: true, rp: 500, ratio: 99, streak: 1 }) === Math.round(RANK.WIN * 1.3),
      'V13.234 상대 힘 보정: 센 상대를 이기면 더(최대 1.3배), 약한 상대면 덜(0.75배)');
    assert(rpDelta({ win: false, rp: 500, ratio: 1.3 }) > lose && rpDelta({ win: false, rp: 500, ratio: 0.75 }) < lose, 'V13.234 센 상대에게 지면 덜 깎이고 약한 상대에게 지면 더 깎인다');
    assert(rpDelta({ win: true, rp: 500, streak: 2 }) === win + 2 && rpDelta({ win: true, rp: 500, streak: 3 }) === win + 4 && rpDelta({ win: true, rp: 500, streak: 9 }) === win + 6, 'V13.234 연승 보너스 +2 · +4 · 최대 +6');
    assert(rpDelta({ win: false, rp: 200 }) === -Math.round(RANK.LOSE * RANK.BRONZE_LOSS) && rpDelta({ win: false, rp: 5 }) === -5 && rpDelta({ win: false, rp: 0 }) === 0,
      'V13.234 브론즈는 깎이는 점수 절반 · RP는 0 아래로 내려가지 않는다');
    assert(rpDelta({ win: false, rp: 500, place: 2 }) === -Math.round(RANK.LOSE * RANK.SECOND_LOSS), 'V13.234 난투 2등은 절반만 깎인다');
    assert(rpRatio(500, [700]) === 1.2 && rpRatio(500, []) === 1 && rpRatio(500, [300, 300]) === 0.8, 'V13.234 친구 판 상대 힘은 상대 RP 평균과의 차이로');
  }
  // 4) 소프트 리셋 · 시즌 넘기기(저장은 쓰기 때만, 보기는 계산만).
  {
    assert(softReset(700) === 400 && softReset(1500) === 900 && softReset(1200) === 900 && softReset(950) === 600 && softReset(250) === 0 && softReset(399) === 0,
      'V13.234 소프트 리셋: 한 티어 내려서(골드 II → 실버 II), 다이아는 플래티넘 III, 브론즈 · 실버 III은 0');
    const t1 = RANK.EPOCH + 3 * DAY, t2 = t1 + RANK.SEASON_MS;
    const p = { id: 'r1', role: 'student', games: { arena: { rank: { s: 1, rp: 720, b: 760, g: 9, w: 6, st: 2 } } } };
    const v = rankView(p, t2);
    assert(v.season === 2 && v.rp === 400 && v.games === 0 && v.pending.length === 1 && v.pending[0].key === 'gold' && v.pending[0].coins === SEASON_COINS[2] && p.games.arena.rank.s === 1,
      'V13.234 새 시즌을 보기(GET)만 하면 넘긴 모습만 계산하고 저장은 하지 않는다(받을 보상 표시)');
    const skip = rolledRank({ s: 1, rp: 1500, b: 1500, g: 5 }, RANK.EPOCH + 3 * RANK.SEASON_MS + DAY);
    assert(skip.s === 4 && skip.rp === 300 && skip.h.length === 1 && skip.h[0].s === 1, 'V13.234 몇 시즌 쉬면 쉰 시즌마다 한 티어씩(최대 3번) 내려가고, 판을 한 시즌만 기록');
    const none = rolledRank({ s: 1, rp: 0, g: 0 }, t2);
    assert(none.h.length === 0 && rolledRank(null, t1).rp === 0 && rolledRank(null, t1).s === 1, 'V13.234 판을 안 한 시즌은 기록에 남기지 않는다');
    let r = { s: 1, rp: 300, g: 5 };
    for (let k = 1; k <= 7; k++) r = { ...rolledRank(r, RANK.EPOCH + k * RANK.SEASON_MS), g: 5 };
    assert(r.h.length === RANK.HIST && r.h.at(-1).s === 7 && JSON.stringify(r).length < 450, `V13.234 지난 시즌 기록은 최근 ${RANK.HIST}개만(학생 프로필 안 약 ${JSON.stringify(r).length}바이트, 끝없이 쌓이지 않음)`);
  }
  // 5) 시즌 보상: 한 번만 · 판이 모자라면 없음 · 칭호.
  {
    const t2 = RANK.EPOCH + RANK.SEASON_MS + DAY;
    const p = { id: 'c1', role: 'student', games: { arena: { rank: { s: 1, rp: 1250, b: 1300, g: 12, w: 9 } } } };
    const c1 = claimRank(p, { now: t2 }), c2 = claimRank(p, { now: t2 + 1000 });
    const stats = rankTitleStats(p);
    assert(c1.coins === SEASON_COINS[4] && c1.got[0].tier === 'diamond' && c2.coins === 0 && c2.got.length === 0 && p.bonus.log.reduce((s, x) => s + x.c, 0) === SEASON_COINS[4] && rankView(p, t2).pending.length === 0,
      'V13.234 시즌 보상은 시즌마다 한 번만(코인은 기존 코인, 다이아 60)');
    assert(stats.arena_season_best === 5 && stats.arena_diamond_seasons === 1 && titleUnlocked('arena-diamond', stats) && titleUnlocked('arena-silver', stats) && !titleUnlocked('arena-diamond2', stats) && p.games.arena.rank.rp === 900,
      'V13.234 보상을 받으면 칭호가 열린다(다이아 → 실버~다이아 칭호, 다이아 두 시즌이면 아레나의 전설) · 새 시즌은 플래티넘 III부터');
    const q = { id: 'c2', role: 'student', games: { arena: { rank: { s: 1, rp: 650, b: 650, g: RANK.MIN_GAMES - 1 } } } };
    const c3 = claimRank(q, { now: t2 });
    assert(c3.coins === 0 && !q.bonus && q.games.arena.rank.h[0].c === 1 && rankTitleStats(q).arena_season_best === 0, `V13.234 그 시즌 랭크 판이 ${RANK.MIN_GAMES}판 미만이면 보상 없음(받은 것으로만 표시)`);
    assert(TITLES_ARENA_RANK.every(k => TITLES[k] && ['arena_season_best', 'arena_diamond_seasons'].includes(TITLES[k].stat)) && TITLES['arena-diamond'].tier === 'legendary' && /arena_season_best:/.test(source('./competition.mjs')) && /arena_diamond_seasons:/.test(source('./competition.mjs')),
      'V13.234 칭호 5개(실버 · 골드 · 플래티넘 · 다이아 전용 · 아레나의 전설)는 titles.js에 있고 titleStats가 센다');
    assert(!/coin|gem|ticket|point/i.test(Object.keys(rankView(p, t2)).filter(k => !['pending', 'history'].includes(k)).join(',')) && !/new_currency|rank_coin|trophy_point/.test(source('./arena-rank.mjs')),
      'V13.234 새 재화 없음(코인은 기존 코인, 나머지는 칭호 · 기록)');
  }
  // 6) 혼자 판: 코인 판 + 친구 팀만 RP. 연습 상대(컴퓨터 팀) · 입장권 없는 연습 판은 RP 없음.
  {
    const pets = [{ key: 'dog', form: 2, level: 12, active: true }, { key: 'bear', form: 2, level: 12 }, { key: 'fox', form: 2, level: 12 }];
    const t0 = RANK.EPOCH + 2 * DAY;
    const friends = [{ name: '친구', team: [['cat', 2, 12], ['pig', 2, 12], ['owl', 2, 12]] }];
    const play = (p, id, opts) => {
      const st = arenaStart(p, { id, pets, now: t0, random: seeded(7), ...opts });
      const A = createArena({ seed: st.seed, me: st.me.map(f => fighter(f)), foe: st.foe.team.map(f => fighter(f)), foeLevel: st.foe_level });
      const inputs = playArena(A, 2, 3);
      return { st, res: arenaFinish(p, { id, inputs, now: t0 + ARENA.COUNTDOWN_MS + A.S.t * ARENA.TICK_MS + 500 }) };
    };
    const p = { id: 'solo', role: 'student' };
    const free = play(p, 'f1', { friends });
    assert(!free.res.paid && !free.res.rp && !p.games.arena.rank, 'V13.234 입장권 없는 연습 판은 RP 없음');
    grantArenaTicket(p, 'practice', t0); grantArenaTicket(p, 'practice', t0);
    const bot = play(p, 'b1', { friends: [] });
    assert(bot.st.foe.bot && bot.res.paid && !bot.res.rp && !p.games.arena.rank, 'V13.234 연습 상대(컴퓨터 팀) 코인 판은 RP 없음');
    const real = play(p, 'r1', { friends });
    assert(!real.st.foe.bot && real.res.paid && typeof real.res.rp?.d === 'number' && p.games.arena.rank.g === 1 && p.games.arena.rank.rp === Math.max(0, real.res.rp.d) && real.res.rank.rp === p.games.arena.rank.rp,
      'V13.234 친구 팀 코인 판은 RP가 오르내리고, 판 끝 답에 RP 기록 · 내 랭크가 실린다');
    const again = arenaFinish(p, { id: 'r1', inputs: [], now: t0 + 999999 });
    assert(again.again && again.rp?.d === real.res.rp.d && p.games.arena.rank.g === 1, 'V13.234 같은 끝내기를 다시 보내도 RP는 한 번만(영수증)');
  }
  // 7) 친구 실시간 판: 코인 판만 · 같은 친구 하루 3판째부터 RP 없음(③ 규칙) · 컴퓨터 빈자리 판 제외 · 자리 비움 제외.
  {
    const now = RANK.EPOCH + 5 * DAY;
    const stu = (id, extra = {}) => ({ id, role: 'student', display_name: id, class_name: '고1A', active: true, games: { arena: { tk: 5, ...extra } } });
    const seat = (side, extra = {}) => ({ side, ko: 1, dealt: 300, ults: 0, inputs: 200, ai_half: false, ...extra });
    const a = stu('a'), b = stu('b', { rank: { s: 1, rp: 700, b: 700, g: 3 } });
    const r1 = liveSettleOne(a, { id: 'g1', seat: seat('me'), others: [b], winner: 'me', now });
    assert(r1.paid && r1.rp.d === Math.round(RANK.WIN * 1.3) && a.games.arena.rank.rp === r1.rp.d, 'V13.234 친구 판: 이기면 RP, 센 친구(RP가 높음)를 이기면 더');
    liveSettleOne(a, { id: 'g2', seat: seat('me'), others: [b], winner: 'foe', now });
    const third = liveSettleOne(a, { id: 'g3', seat: seat('me'), others: [b], winner: 'me', now });
    assert(!third.paid && third.reason === 'pair' && !third.rp && a.games.arena.rank.g === 2, 'V13.234 같은 친구와는 하루 2판까지만 RP(코인 판과 같은 ③ 농사 막기)');
    const c = stu('c');
    const withBot = liveSettleOne(c, { id: 'g4', seat: seat('me', { mode: '2v2' }), others: [a], winner: 'me', bots: true, now });
    assert(withBot.paid && !withBot.rp && !c.games.arena.rank, 'V13.234 컴퓨터 빈자리가 있던 판은 코인은 그대로, RP는 없음');
    const idle = liveSettleOne(c, { id: 'g5', seat: seat('me'), others: [a], winner: 'me', idle: true, now });
    const ai = liveSettleOne(c, { id: 'g6', seat: seat('me', { ai_half: true }), others: [b], winner: 'me', now });
    assert(!idle.rp && !ai.rp && !c.games.arena.rank, 'V13.234 자리 비움 · 컴퓨터가 절반 넘게 대신 조종한 판은 RP 없음');
    const live = source('./arena-live.mjs');
    assert(/const bots = \(Array\.isArray\(res\.seats\)/.test(live) && /bots, pet: activePet/.test(live), 'V13.234 방 보고에 컴퓨터 자리(bot)가 하나라도 있으면 그 판 RP는 없음');
  }
  // 8) 랭킹: GET만 · 1분 캐시 · 같은 학교 · 같은 학년 · 이번 시즌 판을 한 학생만.
  {
    clearRankCache();
    const now = RANK.EPOCH + 6 * DAY, school = { id: 's1', division: 'high' }, other = { id: 's2', division: 'high' };
    const P = (id, cls, rp, extra = {}) => ({ id, role: 'student', active: true, display_name: id, class_name: cls, games: { arena: { rank: { s: 1, rp, b: rp, g: 4, w: 2 } } }, ...extra });
    const profiles = [P('me', '고1A', 400), P('x1', '고1B', 900), P('x2', '고1A', 650), P('g2', '고2A', 1500), P('far', '고1A', 1300, { sch: 's2' }), P('old', '고1A', 1400), P('t', '고1A', 999, { role: 'teacher' }), P('pv', '고1A', 1100, { preview_owner_id: 'z' })];
    profiles[5].games.arena.rank.s = 0;
    const schoolOf = x => (x.sch === 's2' ? other : school);
    const v = rankBoardView(profiles, profiles[0], schoolOf, now);
    assert(v.top.map(x => x.name).join() === 'x1,x2,me' && v.place === 3 && v.total === 3 && v.top[0].label === '플래티넘 III' && v.top[2].mine && v.me.rp === 400,
      'V13.234 랭킹: 같은 학교 · 같은 학년만(다른 학년 · 다른 학교 · 선생님 · 미리보기 · 지난 시즌 빼고), RP 높은 순, 내 순위');
    profiles[0].games.arena.rank.rp = 2000;
    const cached = rankBoardView(profiles, profiles[0], schoolOf, now + RANK_CACHE_MS - 1), fresh = rankBoardView(profiles, profiles[0], schoolOf, now + RANK_CACHE_MS + 1);
    assert(cached.place === 3 && cached.me.rp === 2000 && fresh.place === 1, 'V13.234 순위는 1분 캐시(내 RP는 지금 값), 1분 지나면 다시 계산');
    assert(rankBand(profiles[0], school) === 's1|high|고1' && rankBand({ class_name: '수학반' }, school) === 's1|c:수학반' && rankBand(profiles[0], null) === '', 'V13.234 랭킹 묶음: 학교 · 학교급 · 학년(학년을 모르면 같은 반)');
    for (let i = 0; i < 260; i++) rankBoard([], { id: `q${i}`, class_name: `반${i}` }, () => school, now);
    const svc = source('./service.mjs');
    assert(/path === '\/games\/arena\/rank' && method === 'GET'/.test(svc) && !/path === '\/games\/arena\/rank' && method === 'POST'/.test(svc) && /path === '\/games\/arena\/rank\/claim' && method === 'POST'/.test(svc),
      'V13.234 랭킹 탭은 GET, 보상 받기만 POST');
    assert(!VIEW_LIKE_POST.test('/games/arena/rank/claim') && !READ_POSTS.has('/api/games/arena/rank') && !VIEW_POSTS.has('/api/games/arena/rank'), 'V13.234 랭킹은 GET이라 보기 POST 등록이 필요 없다');
    const rankSrc = source('./arena-rank.mjs');
    const applyBody = rankSrc.slice(rankSrc.indexOf('export function applyRank'), rankSrc.indexOf('// 친구 판 상대 힘'));
    const claimBody = rankSrc.slice(rankSrc.indexOf('export function claimRank'), rankSrc.indexOf('// ---------- 랭킹'));
    assert(!/profiles|state\./.test(applyBody + claimBody) && /RANK_CACHE_MS = 60000/.test(rankSrc) && /cache\.size > RANK_CACHE_MAX/.test(rankSrc),
      'V13.234 쓰기(판 끝 · 보상 받기)는 그 학생 랭크만 고치고 다른 학생을 훑지 않는다 · 랭킹 캐시는 1분 · 묶음 수 상한');
    const arenaSrc = source('./arena.mjs');
    assert(/live\.bot \? null : applyRank/.test(arenaSrc), 'V13.234 혼자 판 RP는 연습 상대(bot)를 뺀다');
  }
  // 9) 예산 · 화면.
  {
    assert(!('arenaRank' in STATE_BUDGET_KB) && /games\.arena\.rank/.test(source('./perf-budget.mjs')), 'V13.234 새 맨 위 묶음 없음: 랭크는 학생 프로필 안 작은 칸(perf-budget profiles에 적음), 랭킹은 캐시(상태에 저장 안 함)');
    const ui = source('../public/modules/arena-rank-ui.js'), css = source('../public/v13234.css'), arena = source('../public/modules/arena.js');
    assert(!/setInterval/.test(ui) && /api\('\/games\/arena\/rank'\)/.test(arena) && /Date\.now\(\) - R\.rankBoard\.at < 60000/.test(arena), 'V13.234 랭킹 탭은 자동 새로고침 없이 열 때 GET 한 번(1분 안에는 받아 둔 것)');
    const frames = css.match(/@keyframes[^{]+\{([^{}]*\{[^}]*\})+\s*\}/g) || [];
    assert(frames.length >= 6 && frames.every(f => !/(^|[{;\s])(width|height|left|top|right|bottom|margin|padding)\s*:/.test(f.replace(/@keyframes[^{]+\{/, ''))), 'V13.234 연출은 transform · opacity만(막대는 scaleX)');
    assert(/rankCard\(v\.rank\)/.test(arena) && /rankGain\(res\?\.rp\)/.test(arena) && /playRankGain/.test(arena) && /rankClaimHtml/.test(arena) && /rank: d\.rank/.test(source('../public/modules/arena-live.js')),
      'V13.234 화면: 아레나 입구 티어 배지 · RP 막대 · 남은 일수, 판 끝 RP 연출(혼자 · 친구 판), 랭킹 탭, 시즌 보상 받기 연출');
    assert(/ARENA_ART\.has\(`tier-\$\{k\}`\)/.test(ui) && /ark-shield/.test(ui) && /\.ark-shield\{/.test(css), 'V13.234 그림 69(tier-*.webp)가 오면 그림, 그 전에는 CSS 배지');
    const dir = '../docs/asset-requests/runner/', sheets = source(`${dir}69-arena-rank-tiers.txt`).split(/^### /m).filter(Boolean);
    const map = source(`${dir}slice-map.csv`).split('\n').filter(l => l.startsWith('"69-arena-rank-tiers.txt"'));
    assert(sheets.length === 2 && sheets.every(t => t.includes('STYLE REFERENCE') && t.includes('Google Drive') && t.includes('"SUMUS 칭호 11 (Runner용)"') && t.includes('"SUMUS 펫 아레나 65 (Runner용)"') && t.includes('"SUMUS 펫 아레나 69 (Runner용)"') && /named exactly "69-\d\.png"/.test(t))
      && map.length === 6 && ['bronze', 'silver', 'gold', 'platinum', 'diamond'].every(k => map.some(l => l.includes(`public/assets/arena/tier-${k}.webp`))) && source(`${dir}README.md`).includes('펫 아레나 랭크 티어 배지(69)'),
      'V13.234 그림 주문서 69: 시트마다 Drive의 기존 칭호 메달 · 아레나 그림을 열어 그림체를 맞추고 "SUMUS 펫 아레나 69 (Runner용)"에 정확한 이름(69-1.png · 69-2.png)으로 저장');
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  let n = 0;
  await runArenaRankChecks((ok, msg) => { if (!ok) throw new Error(`실패: ${msg}`); n++; });
  console.log(`arena-rank-check ${n}개 통과`);
}
