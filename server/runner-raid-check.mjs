// V13.243 펫 대행진 ③단계 검사: 오늘의 도전 맵 · 주간 반 보스.
//   날짜 씨앗 같음 · 강화 · 응원 끔 · 판 끝은 묶음 숫자 하나 더하기(O(1)) · 같은 판 두 번 안 셈 · 보상 한 번 · 주 바뀜 정리 · GET 1분 캐시 · 예산.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { RUNNER, makeMap, replay, runResult, baseStart } from '../public/modules/runner-rules.js';
import { DAILY, RAID, dailySpec, modeMap, modeOpts, dailyCompare, raidHp, raidBoss } from '../public/modules/runner-modes.js';
import { botRun, randomPet } from './runner-sim.mjs';
import { mulberry } from '../public/modules/runner-rules.js';
import { runnerStart, runnerFinish, runnerView, runnerDaily, runnerRaid, runnerRaidClaim, runnerRaidTeacher, raidEntry } from './runner.mjs';
import { STATE_BUDGET_KB } from './perf-budget.mjs';
import { rankingWeek } from './competition.mjs';
import { dayKey } from '../public/modules/core.js';

const source = p => readFileSync(fileURLToPath(new URL(p, import.meta.url)), 'utf8');
const fnBody = (js, name) => { const i = js.indexOf(`function ${name}(`); if (i < 0) return ''; let d = 0; for (let k = js.indexOf(') {', i) + 2; k < js.length; k++) { if (js[k] === '{') d++; else if (js[k] === '}' && --d === 0) return js.slice(i, k + 1); } return ''; };

export async function runRunnerRaidChecks(assert) {
  const DAY = 86400000, now = Date.UTC(2026, 10, 16, 3);   // 월요일 12시(한국 시간)
  // 1) 오늘의 도전: 날짜 + 묶음 → 같은 씨앗 · 같은 맵, 날이 바뀌면(한국 시간 자정) 다른 맵
  {
    const a = dailySpec(dayKey(now), 'S|mid|중2'), b = dailySpec(dayKey(now + 3 * 3600000), 'S|mid|중2'), c = dailySpec(dayKey(now + DAY), 'S|mid|중2'), o = dailySpec(dayKey(now), 'S|mid|중3');
    const kstMidnight = Date.UTC(2026, 10, 16, 15);   // 17일 0시(한국 시간)
    assert(JSON.stringify(a) === JSON.stringify(b) && a.seed !== c.seed && a.seed !== o.seed && dayKey(kstMidnight - 1) !== dayKey(kstMidnight) && dailySpec(dayKey(kstMidnight - 1), 'x').seed !== dailySpec(dayKey(kstMidnight), 'x').seed,
      '오늘의 도전: 같은 날 · 같은 묶음은 같은 씨앗, 한국 시간 자정에 바뀌고 묶음마다 다르다');
    assert(JSON.stringify(modeMap(a).items) === JSON.stringify(modeMap({ ...a }).items) && JSON.stringify(modeMap(a).items) !== JSON.stringify(makeMap(a.stage).items) && JSON.stringify(makeMap(7)) === JSON.stringify(makeMap(7)),
      '오늘의 도전 맵은 씨앗으로 늘 같고, 같은 스테이지 일반 맵과 다르다(일반 맵은 그대로)');
    assert(DAILY.STAGES.every(s => s >= 12 && s % 10 !== 0 && s % 10 !== 1) && a.stage >= 12 && DAILY.ELS.includes(a.el), '난도 중상: 하늘 다리 12~25(보스 성 · 쉬어 가기 제외), 오늘의 속성은 8가지 중 하나');
    // 강화 · 응원 · 펫 등급 끔
    const opt = modeOpts(a, { start: 999, pet: { el: 'star', mul: 1.12 }, up: { s: 20 } });
    assert(opt.start === baseStart(a.stage) && opt.pet.mul === 1 && opt.pet.el === a.el && opt.up == null && modeOpts({ mode: 'stage', stage: 3 }, { start: 13, pet: { el: 'ice', mul: 1.06 } }).start === 13,
      '오늘의 도전은 강화 · 응원 정령 · 펫 등급 세기를 끈다(시작 정령 = 기본, 필살기 = 오늘의 속성 · 세기 1)');
    // 처음 도전 봇(일반 스테이지와 같은 흉내)으로 30일: 깸 55~80%(중상)
    let c2 = 0, n = 0;
    for (let d = 0; d < 30; d++) { const sp = dailySpec(dayKey(now + d * DAY), 'g' + d), map = modeMap(sp), R = mulberry(d + 1); for (let i = 0; i < 24; i++) { const { S } = botRun(map, modeOpts(sp), { skill: 0.35 + R() * 0.6, seed: Math.floor(R() * 1e9) }); n++; if (S.stars > 0) c2++; } }
    assert(c2 / n >= 0.6 && c2 / n <= 0.72, `오늘의 도전 난도 중상: 처음 도전 봇 깸 ${(c2 / n * 100).toFixed(0)}%(60~72%, 미리 맞춘 도전 맵 표 DAILY_TABLE)`);
    assert(dailyCompare({ s: 2, l: 50, t: 900, a: 2 }, { s: 1, l: 80, t: 800, a: 1 }) > 0 && dailyCompare({ s: 1, l: 80, t: 900, a: 2 }, { s: 1, l: 80, t: 800, a: 1 }) > 0 && dailyCompare({ s: 0, l: 99, t: 1, a: 1 }, { s: 1, l: 1, t: 999, a: 2 }) > 0,
      '오늘의 도전 순위: 깬 판 → 남은 정령 많이 → 시간 짧게 → 먼저 세운 기록');
  }
  // 2) 서버: 도전 판 시작 · 끝, 반 보스 O(1) 더하기, 같은 판 다시 보내기
  const state = { runnerRaid: {} }, G = 'S|mid|중2', raid = { bucket: state.runnerRaid, group: G };
  const mk = (id, name) => ({ id, role: 'student', display_name: name, pets: [{ key: 'dog', form: 2 }, { key: 'gumiho', form: 3 }], games: { runner: { st: 3, fs: 0 } } });
  const p = mk('s1', '하나'), q = mk('s2', '둘'), r = mk('s3', '셋');
  {
    p.games.runner.fs = 13; p.games.runner.fn = 9;   // 응원 정령이 있어도 도전에는 안 붙는다
    const st = runnerStart(p, { id: 'rn-dddd-0001', mode: 'daily', group: G, now, seed: 5 }), sp = dailySpec(dayKey(now), G);
    assert(st.mode === 'daily' && st.stage === sp.stage && st.map_seed === sp.seed && st.el === sp.el && st.cheer === 0 && st.start === baseStart(sp.stage) && st.pet.mul === 1 && st.pet.el === sp.el && p.games.runner.open.m === 'd',
      '도전 판 시작: 서버가 오늘의 스테이지 · 맵 씨앗 · 속성을 정하고, 응원 · 강화 · 펫 등급 없이 시작');
    const map = modeMap({ mode: 'daily', stage: st.stage, seed: st.map_seed, el: st.el }), opts = { start: st.start, pet: { el: st.pet.el, mul: st.pet.mul } };
    const best = botRun(map, opts, { skill: 1, seed: 3, cards: [0, 0] }), ms = best.S.tick * RUNNER.TICK;
    const res = runnerFinish(p, { id: st.id, input: best.input, now: now + ms + 2000, raid }), e = state.runnerRaid[G];
    const want = runResult(replay(map, opts, best.input));
    assert(res.valid && res.mode === 'daily' && res.stars === want.stars && res.left === want.left && p.games.runner.dd?.l === want.left && !p.games.runner.stars && p.games.runner.st === 3 && p.games.runner.fn === 9,
      '도전 판 끝: 서버 다시 돌리기 결과로만 기록(오늘 최고 하나), 지도 별 · 응원은 그대로');
    assert(res.raid?.dmg === want.dmg && e.d === want.dmg && e.n === 1 && p.games.runner.rw.d === want.dmg && e.hp === raidHp(RAID.GUESS_SIZE) && e.b === raidBoss(e.w, G),
      `반 보스: 도전 판의 공성전 피해(${want.dmg})가 묶음 합계와 내 기여에 더해진다`);
    const again = runnerFinish(p, { id: st.id, input: best.input, now: now + ms + 5000, raid });
    assert(again.again && state.runnerRaid[G].d === want.dmg && p.games.runner.rw.n === 1, '같은 판을 다시 보내면 영수증 그대로(보스 피해를 두 번 더하지 않음)');
    const fastSt = runnerStart(p, { id: 'rn-dddd-0002', mode: 'daily', group: G, now, seed: 5 }), fast = runnerFinish(p, { id: fastSt.id, input: best.input, now: now + 1000, raid });
    assert(!fast.valid && state.runnerRaid[G].d === want.dmg, '무효 판(너무 빠름)은 보스 피해에 안 들어간다');
    // 일반 판도 보스 피해에 들어간다
    const s2 = runnerStart(q, { id: 'rn-eeee-0001', stage: 2, now, seed: 1 }), m2 = makeMap(2), o2 = { start: s2.start, pet: { el: s2.pet.el, mul: s2.pet.mul } }, b2 = botRun(m2, o2, { skill: 1, seed: 2, cards: [0, 0] });
    const r2 = runnerFinish(q, { id: s2.id, input: b2.input, now: now + b2.S.tick * RUNNER.TICK + 2000, raid });
    assert(r2.valid && r2.raid.dmg === runResult(replay(m2, o2, b2.input)).dmg && state.runnerRaid[G].d === want.dmg + r2.raid.dmg && state.runnerRaid[G].n === 2, '일반 판의 공성전 피해도 같은 보스 합계에 더해진다(참여 2명)');
  }
  // O(1): 판 끝 코드는 학생 목록을 보지 않는다
  {
    const runner = source('./runner.mjs'), svc = source('./service.mjs');
    const finishCode = ['runnerFinish', 'settle', 'settleDaily', 'raidAdd', 'raidEntry'].map(n => fnBody(runner, n)).join('\n');
    assert(finishCode.length > 1500 && !/profiles|\.filter\(|\.sort\(\(a, b\) => b\.d/.test(finishCode.replace("keys.sort((a, b) => bucket[a].w - bucket[b].w)", '')) && /e\.d \+= hit;/.test(finishCode),
      '판 끝 쓰기는 학생 목록을 훑지 않고 묶음 숫자 하나만 더한다(O(1), 주가 바뀔 때만 묶음 수만큼 정리)');
    assert(svc.includes("raid: { bucket: (state.runnerRaid ||= {}), group: runnerGroupOf(state)(p) }") && svc.includes("path === '/runner/daily' && method === 'GET'") && svc.includes("path === '/runner/raid' && method === 'GET'") && svc.includes("path === '/runner/raid/claim' && method === 'POST'"),
      '서버: 도전 순위 · 보스 화면은 GET, 보상 받기만 POST, 판 끝이 묶음에 더한다');
  }
  // 3) 격파 · 보상 한 번(각 학생이 받기 버튼으로) · 전체에 나눠 주는 쓰기 없음
  {
    const sumC = x => (x.bonus?.log || []).reduce((n, row) => n + row.c, 0), pBefore = sumC(p), qBefore = sumC(q);
    const e = state.runnerRaid[G]; e.d = e.hp - 1;
    const s3 = runnerStart(r, { id: 'rn-ffff-0001', stage: 1, now, seed: 1 }), m1 = makeMap(1), o1 = { start: s3.start, pet: { el: s3.pet.el, mul: s3.pet.mul } }, b1 = botRun(m1, o1, { skill: 1, seed: 2, cards: [0, 0] });
    const kill = runnerFinish(r, { id: s3.id, input: b1.input, now: now + b1.S.tick * RUNNER.TICK + 2000, raid });
    assert(kill.raid.killed_now && kill.raid.killed && e.k > 0 && sumC(p) === pBefore && sumC(q) === qBefore, '격파한 판: "격파!" 소식, 보상은 그 자리에서 나눠 주지 않는다');
    const before = sumC(p), v = runnerView(p, now + 1000, raid);
    const got = runnerRaidClaim(p, { ...raid, now: now + 1000 });
    let again = ''; try { runnerRaidClaim(p, { ...raid, now: now + 2000 }); } catch (err) { again = err.message; }
    const stranger = mk('s9', '구'); let none = ''; try { runnerRaidClaim(stranger, { ...raid, now }); } catch (err) { none = err.message; }
    assert(v.raid.claim === RAID.COINS && got.coins === RAID.COINS && sumC(p) === before + RAID.COINS && /받을/.test(again) && /받을/.test(none) && RAID.COINS === 30,
      '반 보스 보상: 이번 주에 한 판이라도 한 학생만 받기 버튼으로 30코인, 한 번만(안 한 학생은 없음)');
    const cap = runnerView(p, now + 3000);
    assert(cap.coin_today <= RUNNER.COIN_DAILY, '반 보스 코인은 하루 판 코인 상한과 따로 센다');
  }
  // 4) 주가 바뀜: 새 보스, 지난주 한 줄만 남기고 오래된 묶음 정리. 지난주 보상은 다음 주에도 받을 수 있다
  {
    const W = 7 * DAY, next = now + W, e0 = state.runnerRaid[G];
    state.runnerRaid['old|x|중1'] = { w: rankingWeek(now).start - 2 * W, hp: 1, d: 0, n: 0, k: 0, b: 'golem', p: null };
    state.runnerRaid['prev|x|중1'] = { w: rankingWeek(now).start, hp: 1, d: 0, n: 0, k: 0, b: 'golem', p: null };
    const qClaim = runnerView(q, next, raid).raid.claim;
    const e1 = raidEntry(state.runnerRaid, G, next);
    assert(e1.w === rankingWeek(next).start && e1.d === 0 && e1.p?.w === e0.w && e1.p.k > 0 && !e1.p.p && !state.runnerRaid['old|x|중1'] && state.runnerRaid['prev|x|중1'] && qClaim === RAID.COINS,
      '주가 바뀌면 새 보스 한 줄 + 지난주 한 줄(p)만, 2주 넘은 묶음은 지운다');
    const late = runnerRaidClaim(q, { ...raid, now: next });
    let twice = ''; try { runnerRaidClaim(q, { ...raid, now: next + 1 }); } catch (err) { twice = err.message; }
    assert(late.coins === RAID.COINS && /받을/.test(twice), '지난주에 격파했으면 다음 주에 들어와서도 한 번 받는다');
    const third = raidEntry(state.runnerRaid, G, next + W);
    assert(third.p?.w === e1.w && third.p.d === 0 && !third.p.p && JSON.stringify(state.runnerRaid).length < STATE_BUDGET_KB.runnerRaid * 1024, '세 번째 주: 지난주(빈 주)만 남는다 · 묶음 표가 예산 안');
    const many = {}; for (let i = 0; i < RAID.GROUPS_MAX + 30; i++) raidEntry(many, `s${i}|mid|중${i % 3 + 1}`, now);
    for (const k of Object.keys(many)) many[k].p = { w: 1, hp: 24000, d: 23999, n: 40, k: now, b: 'reportdragon' };
    assert(Object.keys(many).length === RAID.GROUPS_MAX && JSON.stringify(many).length < STATE_BUDGET_KB.runnerRaid * 1024, `묶음은 ${RAID.GROUPS_MAX}개까지(${(JSON.stringify(many).length / 1024).toFixed(1)}KB, 예산 ${STATE_BUDGET_KB.runnerRaid}KB)`);
    assert(JSON.stringify(p.games.runner).length < 520, `학생 한 명 기록이 작다(${JSON.stringify(p.games.runner).length}바이트, 쌓이는 목록 없음)`);
  }
  // 5) GET 1분 캐시: 순위 · 기여 상위 5, 내 줄은 지금 기록
  {
    const st2 = { runnerRaid: {} }, rd = { bucket: st2.runnerRaid, group: G }, group = x => x.group || G;
    const kids = Array.from({ length: 8 }, (_, i) => ({ ...mk(`k${i}`, `학생${i}`), games: { runner: { tot: 1, dd: { d: dayKey(now), s: i % 4 ? 2 : 0, l: 10 * i, t: 1000 - i, a: now }, rw: { w: rankingWeek(now).start, d: 100 * i, n: 1 } } } }));
    kids.push({ ...mk('other', '다른 반'), group: 'X', games: { runner: { dd: { d: dayKey(now), s: 3, l: 999, t: 1, a: now } } } });
    const me = kids[1], opts = { group, ranked: () => true, now };
    const d1 = runnerDaily(kids, me, opts);
    assert(d1.top.length === 8 && d1.top[0].l === 70 && !d1.top.some(x => x.name === '다른 반') && d1.top.at(-1).s === 0 && d1.me.rank === d1.top.findIndex(x => x.me) + 1, '오늘의 도전 순위: 같은 묶음만, 깬 판 · 남은 정령 순, 상위 10 + 내 등수');
    kids[7].games.runner.dd.l = 1;   // 다른 학생 기록이 바뀌어도 1분 동안은 캐시
    me.games.runner.dd = { d: dayKey(now), s: 3, l: 500, t: 900, a: now + 1 };   // 내 기록은 바로
    const d2 = runnerDaily(kids, me, { ...opts, now: now + 1000 }), d3 = runnerDaily(kids, me, { ...opts, now: now + DAILY.CACHE_MS + 1 });
    assert(d2.cached_at === d1.cached_at && d2.top.find(x => x.name === '학생7').l === 70 && d2.me.rank === 1 && d3.top.find(x => x.name === '학생7').l === 1, '도전 순위 GET은 1분 캐시(다른 학생), 내 줄 · 등수는 지금 기록');
    const r1 = runnerRaid(kids, me, { ...opts, bucket: st2.runnerRaid });
    assert(r1.top.length === RAID.TOP && r1.top[0].d === 700 && r1.size === 8 && r1.hp === raidHp(8) && r1.me.dmg === 100 && r1.me.rank === 7 && !r1.killed, '보스 GET: 기여 상위 5 · 내 기여 · 묶음 크기로 HP(이번 주 첫 판 전에는 예상 HP)');
    raidEntry(st2.runnerRaid, G, now + 2000);
    assert(st2.runnerRaid[G].hp === raidHp(8), '보스 HP는 묶음 크기(GET이 센 값)에 맞춰 이번 주 첫 판 때 정해진다');
    kids[0].games.runner.rw.d = 99999;
    assert(runnerRaid(kids, me, { ...opts, bucket: st2.runnerRaid, now: now + 1000 }).top[0].d === 700 && runnerRaid(kids, me, { ...opts, bucket: st2.runnerRaid, now: now + RAID.CACHE_MS + 1 }).top[0].d === 99999, '보스 기여 순위 GET은 1분 캐시');
    const t = runnerRaidTeacher({ ...st2.runnerRaid, 'other|mid|중1': { ...st2.runnerRaid[G] } }, 'S', now + 3000);
    assert(t.length === 1 && t[0].grade === '중2' && typeof t[0].pct === 'number' && 'players' in t[0], '선생님 화면: 맡은 학교 묶음별 이번 주 보스 진행 · 참여 수 한 줄(묶음 표만)');
  }
  // 6) 화면 · 렉 방지
  {
    const ui = source('../public/modules/runner.js'), meta = source('../public/modules/runner-meta.js'), svc = source('./service.mjs'), act = source('../public/modules/teacher-activity.js'), card = source('../public/modules/arcade-games.js');
    const metaApi = [...meta.matchAll(/api\('([^']+)'(, \{\})?\)/g)].map(m => `${m[2] ? 'POST' : 'GET'} ${m[1]}`);
    assert(metaApi.sort().join() === 'GET /runner/daily,GET /runner/daily,GET /runner/raid,POST /runner/raid/claim' && !/setInterval|setTimeout\([^)]*api/.test(meta) && !/setInterval/.test(ui),
      '③ 화면 요청: 도전 순위 · 보스는 누를 때 GET 한 번, 보상 받기만 POST, 자동 새로고침 없음');
    assert(ui.includes('${metaCards(v)}') && meta.includes('오늘 할 것') && meta.includes('남음') && meta.includes('HP ${hpLeft}%') && meta.includes('보상 받기') && ui.includes('${resultMeta(res)}') && meta.includes('피해!') && meta.includes('등!`'),
      '펫 대행진 첫 화면: 오늘 할 것 + 오늘의 도전 · 반 보스 카드(남은 시간 · HP % · 보상), 결과 화면에 보스 피해 · 도전 등수');
    assert(ui.includes("modeMap({ mode: 'daily', stage: start.stage, seed: start.map_seed, el: start.el })") && card.includes('runnerMetaChips(v)') && act.includes('o.runner_raids') && svc.includes('runner_raids: runnerRaidTeacher(state.runnerRaid || {}, school.id, Date.now())'),
      '도전 판은 서버와 같은 맵(modeMap), 놀이터 카드 칩, 선생님 활동 화면에 반 보스 한 줄');
    const css = source('../public/v13243.css'), build = source('./build-assets.mjs');
    assert(build.includes('"v13243.css"') && !/blur\(|transition:[^;}]*(width|height|left|top|box-shadow)|@keyframes[^{]*\{[^}]*(width|height|left|top):/.test(css) && /var\(--a-gold\)/.test(css),
      '③ 화면 CSS: 아레나 디자인 토큰, 움직임은 transform · opacity만, blur 없음');
    assert(css.includes('.rn-top .yb-back{') && /\.rn-top \.yb-back\{[^}]*background:var\(--rn-glass\)[^}]*color:var\(--rn-cloud\)/.test(css) && ui.includes('data-rn="exit"'), '첫 화면 나가기 버튼: 유리판 위 흰 화살표(흰 바탕 빈 네모로 보이지 않게)');
    const load = source('./tournament-load.mjs'), stress = source('./stress-check.mjs');
    assert(load.includes("'GET /runner/daily'") && load.includes("'GET /runner/raid'") && stress.includes("p95('GET /runner/raid')"), '부하 시험(check:load)에 도전 순위 GET · 보스 GET · 판 끝이 들어 있다');
    assert(STATE_BUDGET_KB.runnerRaid > 0 && STATE_BUDGET_KB.runnerRaid <= 20, '반 보스 묶음 runnerRaid 예산(perf-budget.mjs)');
  }
  void randomPet;
}
