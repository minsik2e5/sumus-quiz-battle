// V13.235 검사: 펫 아레나 연습장 · 경기장 꾸미기.
//   연습장: 서버 요청 · 보상 · 기록 없음, 전투는 규칙 파일(createArena) 그대로, 일반 판과 같은 렉 예산.
//   꾸미기: 이긴 횟수(코인 판 승리 누적)로 열림 · 새 재화 없음 · 안 열린 것은 서버가 거부 · 프로필 작은 칸 예산 · 상대에게도 입장 효과.
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { DECO, DECO_SLOTS, DECO_DEF, BASE_BG, cleanDeco, decoLocked, decoFull, decoBg, decoNext, decoItem } from '../public/modules/arena-deco-rules.js';
import { DUMMIES, PRACTICE, createPractice, practiceFighter, dummyFighter, statsView, dummyKey } from '../public/modules/arena-practice-rules.js';
import { ARENA, fighter, matchup } from '../public/modules/arena-rules.js';
import { elementOf } from '../public/modules/battle-fx.js';
import { decoWins, bumpCoinWin, setDeco, decoView, decoOf } from './arena-deco.mjs';
import { arenaStart, arenaView, arenaPoolPut, arenaPoolFor, pickFoe } from './arena.mjs';
import { livePlayer, liveSettleOne } from './arena-live.mjs';
import { ArenaRoom } from '../cloudflare/arena-room.mjs';
import { STATE_BUDGET_KB } from './perf-budget.mjs';

const source = path => readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8');
const fails = (fn, word) => { try { fn(); return false; } catch (err) { return (!word || String(err.message).includes(word)) && err.status === 403; } };
const pets = keys => keys.map((key, i) => ({ key, form: 2, level: 12 - i, active: i === 0 }));
const seeded = s => () => { s = (s * 16807) % 2147483647; return s / 2147483647; };

export async function runArenaDecoChecks(assert) {
  // 1) 꾸미기 목록: 칸 4개 · 칸마다 기본(0승) · 열리는 승리 수는 오름차순 · 새 경기장 3~4개 · 무작위는 예전과 같은 seed % 3.
  {
    assert(DECO_SLOTS.join() === 'bg,rg,en,ps' && DECO_SLOTS.every(s => decoItem(s, DECO_DEF[s])?.w === 0 && DECO[s].every((x, i, a) => !i || a[i - 1].w <= x.w)),
      'V13.235 꾸미기 칸 4개(경기장 · 링 · 입장 효과 · 승리 포즈) · 칸마다 기본은 0승 · 열리는 승리 수는 차례로 커진다');
    const fresh = DECO.bg.filter(x => x.k !== 'auto' && !BASE_BG.includes(x.k));
    assert(fresh.length >= 3 && fresh.length <= 4 && BASE_BG.every(k => decoItem('bg', k)?.w === 0) && [0, 1, 2, 3, 4, 5].every(s => decoBg('auto', s) === ['plaza', 'forest', 'night'][s % 3]) && decoBg('sky', 7) === 'sky',
      `V13.235 경기장: 기본 3개(무작위는 예전처럼 seed % 3) + 새 경기장 ${fresh.length}개`);
    assert(JSON.stringify(cleanDeco({ bg: 'sky', rg: 'nope', en: 'x'.repeat(99), ps: 'crown', coins: 9 })) === '{"bg":"sky","ps":"crown"}' && JSON.stringify(cleanDeco([1])) === '{}' && JSON.stringify(cleanDeco(null)) === '{}',
      'V13.235 꾸미기 정리: 알려진 칸 · 알려진 이름만 남긴다');
    const sky = decoItem('bg', 'sky').w;
    assert(decoLocked({ bg: 'sky' }, sky - 1).length === 1 && decoLocked({ bg: 'sky' }, sky).length === 0 && decoFull({ bg: 'sky', rg: 'gold' }, sky).bg === 'sky' && decoFull({ bg: 'sky', rg: 'gold' }, sky).rg === 'basic' && decoNext(0)?.left > 0 && decoNext(1e9) === null,
      'V13.235 열림: 승리 수가 모자라면 잠김 · 열린 것만 쓰고 나머지는 기본값 · "N승 더" 막대');
    const all = DECO_SLOTS.flatMap(s => DECO[s]);
    assert(all.every(x => Object.keys(x).join() === 'k,n,d,w,icon') && !/코인|coin|가격|price|cost|젬|gem/.test(source('../public/modules/arena-deco-rules.js').split('export const DECO')[1].split('export const DECO_SLOTS')[0]),
      'V13.235 새 재화 없음: 꾸미기는 승리 수(w)로만 열린다(가격 · 코인 칸이 없다)');
  }
  // 2) 서버: 승리 수(코인 판 승리 누적) · 안 열린 것 거부 · 판 시작 요청에 실어 확인 · 예산.
  {
    assert(decoWins({}) === 0 && decoWins({ wins: 4, live_wins: 2 }) === 6 && decoWins({ cw: 3, wins: 9 }) === 3,
      'V13.235 열림 승리 수: 코인 판 승리 누적(cw), 처음에는 지금까지의 승리(혼자 + 친구)로 채운다');
    const a = { wins: 7, live_wins: 1 }; bumpCoinWin(a); const first = a.cw; bumpCoinWin(a);
    assert(first === 8 && a.cw === 9, 'V13.235 코인 판에서 이기면 +1(처음에는 지금까지 승리로 채움: 정산이 승리 수를 이미 올린 뒤 부른다)');
    const b = { cw: 2 };
    assert(fails(() => setDeco(b, { bg: 'sky' }), '5승부터') && b.dc === undefined && fails(() => setDeco(b, { en: 'smoke', ps: 'crown' }), '승리 포즈') && b.dc === undefined,
      'V13.235 안 열린 꾸미기는 403으로 거부하고 아무것도 바꾸지 않는다(하나라도 잠겨 있으면 전부 거부)');
    setDeco(b, { en: 'smoke', rg: 'basic', bg: 'auto' });
    assert(JSON.stringify(b.dc) === '{"en":"smoke"}' && decoView(b).dc.en === 'smoke' && decoView(b).dc.bg === 'auto' && decoView(b).wins === 2 && setDeco(b, null).en === 'smoke',
      'V13.235 열린 것만 저장 · 기본값은 적지 않는다(작게) · 보낸 칸만 바꾼다');
    const big = { cw: 1e6 }; setDeco(big, Object.fromEntries(DECO_SLOTS.map(s => [s, DECO[s].at(-1).k])));
    assert(JSON.stringify(big).length < 120 && JSON.stringify(big.dc).length <= 60, `V13.235 프로필 칸 예산: 꾸미기 ${JSON.stringify(big.dc).length}바이트(60 이하) · 승리 누적 숫자 하나`);
    // 판 시작: 잠긴 것이면 판을 만들지 않는다. 열린 것이면 판 + 꾸미기 응답.
    const p = { id: 'p', role: 'student', games: { arena: { cw: 4 } } };
    assert(fails(() => arenaStart(p, { id: 'g1', pets: pets(['dog', 'cat', 'fox']), team: [], deco: { bg: 'sky' }, now: 1, random: seeded(3) }), '경기장') && !p.games.arena.live,
      'V13.235 판 시작 요청에 실은 꾸미기가 안 열렸으면 거부(판을 만들지 않는다)');
    const r = arenaStart(p, { id: 'g2', pets: pets(['dog', 'cat', 'fox']), team: [], deco: { en: 'smoke', ps: 'jump' }, now: 1, random: seeded(3) });
    assert(r.deco?.dc?.en === 'smoke' && r.deco.dc.ps === 'jump' && p.games.arena.live?.id === 'g2' && arenaView(p).deco.wins === 4,
      'V13.235 열린 꾸미기는 판 시작에 실려 저장되고, 화면 응답(arenaView)에 승리 수 · 고른 것');
    const svc = source('./service.mjs');
    assert(svc.includes("const deco = body.deco && typeof body.deco === 'object' && !Array.isArray(body.deco) ? body.deco : null;") && svc.includes('picks, tree, friends, deco, pets') && (svc.match(/liveDeco\(p, body\)/g) || []).length === 2,
      'V13.235 서버 요청: 혼자 판 시작 · 친구 방 열기 · 들어가기에 꾸미기를 실어 서버가 확인(새 요청 없음)');
    const settle = source('./arena.mjs'), live = source('./arena-live.mjs');
    const paidAt = settle.indexOf("a.tk = Number(a.tk || 0) - 1;"), bumpAt = settle.indexOf('if (base.win) bumpCoinWin(a);');
    assert(paidAt > 0 && bumpAt > paidAt && bumpAt < settle.indexOf('addBonus(p, { xp: ARENA.XP, coins, pet, now });', paidAt) && live.includes('if (win) bumpCoinWin(a);'),
      'V13.235 승리 누적은 코인 판(보상을 받은 판)에서 이겼을 때만 센다(입장권 · 하루 5판 밖의 판은 안 센다)');
    const q = { id: 'q', role: 'student', games: { arena: { tk: 1, cw: 0 } } };
    liveSettleOne(q, { id: 'L1', seat: { side: 'me', win: true, ko: 1, mode: '1v1' }, others: [{ id: 'o', display_name: '친구' }], winner: 'me', idle: false, now: 1 });
    liveSettleOne(q, { id: 'L2', seat: { side: 'me', win: true, ko: 1, mode: '1v1' }, others: [{ id: 'o2', display_name: '친구2' }], winner: 'me', idle: false, now: 2 });
    assert(q.games.arena.cw === 1 && q.games.arena.live_wins === 2, 'V13.235 친구 대전: 입장권이 있어 보상을 받은 승리만 +1(입장권 없는 둘째 판은 안 센다)');
  }
  // 3) 상대에게도 보이는 입장 효과: 친구 팀 목록 · 친구 대전 방.
  {
    const state = {}, me = { id: 'm', display_name: '민', class_name: '1-1', games: { arena: { cw: 50, dc: { en: 'thunder', bg: 'volcano' } } } };
    arenaPoolPut(state, me, 'sch', [['dog', 2, 5], ['cat', 2, 5], ['fox', 2, 5]], 10);
    const pool = arenaPoolFor(state, { id: 'x', class_name: '1-1' }, 'sch', 20);
    const foe = pickFoe([fighter({ key: 'dog', form: 2, level: 5 }), fighter({ key: 'cat', form: 2, level: 5 }), fighter({ key: 'fox', form: 2, level: 5 })], pool, seeded(5));
    assert(state.arenaTeams[0].e === 'thunder' && pool[0].en === 'thunder' && foe.en === 'thunder' && JSON.stringify(state.arenaTeams[0]).length < 160,
      'V13.235 내 팀을 만난 친구 화면에도 내 입장 효과(친구 팀 목록에 14바이트)');
    const locked = { id: 'n', display_name: '나', games: { arena: { cw: 1, dc: { en: 'rainbow' } } } };
    assert(livePlayer(me, pets(['dog'])).dc.en === 'thunder' && livePlayer(me, pets(['dog'])).dc.bg === 'volcano' && livePlayer(locked, pets(['dog'])).dc.en === 'basic' && decoOf(locked.games.arena).en === 'basic',
      'V13.235 친구 방에 보내는 꾸미기: 열린 것만(나중에 규칙이 바뀌어도 잠긴 것은 안 보낸다)');
    const room = { host: 'h', seats: [{ id: 'h', side: 'me', dc: { bg: 'galaxy', rg: 'rune', en: 'flame' } }, { id: 'g', side: 'foe', dc: { bg: 'sky', rg: 'gold', en: 'smoke' } }] };
    const v = ArenaRoom.prototype.decoView.call({ room });
    const roomSrc = source('../cloudflare/arena-room.mjs');
    assert(v.bg === 'galaxy' && v.rg === 'rune' && v.en.me === 'flame' && v.en.foe === 'smoke' && (roomSrc.match(/deco: this\.decoView\(\)/g) || []).length === 2 && (roomSrc.match(/dc: roomDeco\(/g) || []).length === 2,
      'V13.235 친구 대전 방: 경기장 · 링은 방장 것, 입장 효과는 사람마다(1:1 · 여러 명 시작 화면 모두)');
    const lv = source('../public/modules/arena-live.js');
    assert(lv.includes("deco: decoWant() })") && lv.includes('r.deco = liveDecoOf(msg.deco, side,'), 'V13.235 친구 대전 화면: 방 열기 · 들어가기에 내 꾸미기를 싣고, 방이 보낸 꾸미기를 내 화면 칸에 맞춘다');
  }
  // 4) 연습장: 서버 요청 · 보상 · 기록 없음, 전투는 규칙 파일 그대로.
  {
    const ui = source('../public/modules/arena-practice.js'), rules = source('../public/modules/arena-practice-rules.js');
    assert(![ui, rules].some(t => /\bapi\(|fetch\(|keepReplay|sendBeacon|XMLHttpRequest|localStorage/.test(t)) && !/import \{[^}]*\bapi\b/.test(ui),
      'V13.235 연습장은 서버 요청이 없다(api · fetch 없음) · 다시 보기 · 이 폰 기록에도 남기지 않는다');
    assert(ui.includes("finish: async () => ({ paid: false, reason: 'practice'") && source('../public/modules/arena.js').includes('if (R.live?.practice) return R.live.done();') && !/coins|xp:|addBonus/.test(rules),
      'V13.235 연습장은 보상 · 승패 기록이 없다(끝나면 연습 결과만)');
    assert(rules.includes("import { ARENA, TREE, createArena, fighter, dirCode, matchup } from './arena-rules.js';") && rules.includes('const sim = createArena({') && PRACTICE.MAX_TICKS === ARENA.MAX_TICKS,
      'V13.235 연습장 전투는 규칙 파일(createArena)을 그대로 쓴다(판 길이도 1:1과 같은 2분)');
    const out = [];
    for (const dummy of DUMMIES.map(d => d.k)) for (const key of ['dragon', 'dog', 'bear']) {
      const me = practiceFighter({ key, form: 3, level: 12, tr: '000' });
      const run = createPractice({ me, dummy, seed: 11 });
      const S = run.sim.S; S.ai.me = 1; // 검사: 내 쪽도 보통 솜씨 컴퓨터
      let n = 0; while (!S.over && n++ < ARENA.MAX_TICKS + 10) { if (n % 400 === 0) { run.resetCd(); run.fillUlt(); } run.sim.step(); }
      out.push({ dummy, key, v: statsView(run.stats, S.t), alive: S.foe.team[0].cur > 0 && S.me.team[0].cur > 0, ults: S.ults.me, foeUlts: S.ults.foe, t: S.t, x: S.foe.x, y: S.foe.y });
    }
    assert(out.every(o => o.alive && o.t === ARENA.MAX_TICKS && o.v.total > 0 && o.v.avg > 0 && o.v.best > 0 && o.foeUlts === 0 && o.ults >= 3),
      `V13.235 연습장 2분: 허수아비 3종 × 펫 3마리 모두 끝까지(다시 채우기로 안 쓰러짐) · DPS · 가장 센 한 방 · 쿨타임 바로 · 필살기 채우기 · 허수아비는 필살기 없음 (${out.map(o => `${o.dummy}/${o.key} ${o.v.avg}`).join(' · ')})`);
    assert(out.filter(o => o.dummy === 'still').every(o => Math.abs(o.x - 50) < 20 && o.y < 45),
      'V13.235 가만히 허수아비: 넉백으로 밀려도 제자리로 돌아온다');
    const low = practiceFighter({ key: 'dragon', form: 2, level: 5, tr: '000' }), real = fighter({ key: 'dragon', form: 2, level: 5 });
    assert(low.preview && low.ult2 && !real.ult2 && low.hp === real.hp && low.atk === real.atk && practiceFighter({ key: 'dragon', form: 2, level: 30, tr: '000' }).preview === undefined,
      'V13.235 잠긴 층 미리보기: 연습장에서만 두 번째 필살기 등 가지를 써 보고, 체력 · 공격은 내 레벨 그대로');
    const dk = dummyKey('flame'), d = dummyFighter(fighter({ key: 'dragon', form: 3, level: 12 }), 'fight');
    assert(matchup('flame', elementOf(dk)) === 1 && matchup(elementOf(dk), 'flame') === 1 && d.hp >= 3000 && d.atk < fighter({ key: d.key, form: 3, level: 12 }).atk,
      'V13.235 허수아비: 상성 1배 펫 몸 · 체력 넉넉 · 반격은 공격 60%');
    assert(ui.includes("if (act === 'pr-save')") && ui.includes('if (lv >= L) cur[i] = want[i];') && source('../public/modules/arena.js').includes('keep: (key, { tr, s2 }) =>'),
      'V13.235 연습장 저장은 대기실과 같은 규칙(열린 층만 · 이 폰에 기억 → 다음 판 시작 때 서버가 기억)');
  }
  // 5) 렉 예산 · 화면: 일반 판과 같은 효과 상한 · 저사양 단계, 입장 효과 조각 3개(저사양 1개) · 장면 조각 6개 · 그림 68 게이트.
  {
    const deco = source('../public/modules/arena-deco.js'), css = source('../public/v13235.css'), build = source('./build-assets.mjs'), arena = source('../public/modules/arena.js');
    assert(deco.includes("const parts = lite ? ['core'] : ['core', 'ring', 'bits'];") && deco.includes('setTimeout(() => el.remove(), 1600);') && (deco.match(/<i class="sc-/g) || []).length === 6 && deco.includes('<i class="sc-fx a"></i><i class="sc-fx b"></i><i class="sc-fx c"></i>'),
      'V13.235 렉: 입장 효과는 한 사람 조각 3개(저사양 1개) · 1.6초 뒤 지움, 경기장 장면은 조각 6개');
    assert(css.includes('.ar-lite .dc-scene *') && css.includes('.ar-lite .ar-ring.rg-on>i{animation:none!important}') && css.includes('prefers-reduced-motion') && !/\bfilter:blur\([^)]*\)[^}]*animation/.test(css.split('.sc-glacier .sc-fx.a')[0]) && build.includes('"v13235.css"'),
      'V13.235 렉: 저사양 · 움직임 줄이기면 장면 · 링 애니메이션을 멈춘다(움직임은 transform · opacity)');
    assert(['decoStage($(\'ar-stage\'), el, name)', 'decoMount(R);', "if (local === 'me') decoWin(R);", "setBg(decoBgOf(r));"].every(x => arena.includes(x)) && deco.includes("ARENA_ART.has(`bg-${name}`)") && deco.includes("ARENA_ART.has(`ring-${rg}`)") && deco.includes("ARENA_ART.has(`entry-${k}`)"),
      'V13.235 꾸미기는 판 화면 세 군데에만 붙고, 그림 68(bg-* · ring-* · entry-*)이 오면 같은 칸이 그림으로 바뀐다(없으면 CSS)');
    assert(!/\bapi\(/.test(deco) && deco.includes("save(KEY(),"), 'V13.235 꾸미기 탭은 서버 요청이 없다(고른 것은 이 폰에 기억 → 판 시작 요청에 실어 보낸다)');
    assert(STATE_BUDGET_KB.profiles === 1500 && source('./perf-budget.mjs').includes('games.arena.dc') && source('./perf-budget.mjs').includes('입장 효과 e'),
      'V13.235 예산: 새 상태 묶음 없음(프로필 안 작은 칸 · 친구 팀 목록 한 칸, perf-budget에 적음)');
  }
  // 6) 그림 주문서 68: 시트마다 ① Drive 기존 아레나 그림(65 · 66)을 열어 그림체 맞추기 ② 정해진 Drive 폴더에 정확한 파일 이름으로 저장.
  {
    const dir = '../docs/asset-requests/runner/';
    const list = source(dir + '68-pet-arena-deco.txt'), codex = source(dir + 'CODEX_PROMPT_68.md'), csv = source(dir + 'slice-map.csv');
    const sheets = list.split('### ').slice(1);
    assert(sheets.length >= 4 && sheets.every(t => t.includes('SUMUS 펫 아레나 65 (Runner용)') && t.includes('SUMUS 펫 아레나 66 (Runner용)') && t.includes('folder "SUMUS 펫 아레나 68 (Runner용)", named exactly "68-')),
      `V13.235 그림 주문서 68(${sheets.length}장): 시트마다 Drive의 기존 아레나 그림(65 · 66)을 열어 그림체를 맞추고, Drive 폴더 "SUMUS 펫 아레나 68 (Runner용)"에 정확한 파일 이름으로 저장`);
    const keys = ['bg-sky', 'bg-glacier', 'bg-volcano', 'bg-galaxy', 'ring-flower', 'ring-rune', 'ring-gold', 'ring-star', 'entry-smoke', 'entry-thunder', 'entry-flame', 'entry-rainbow', 'pose-crown', 'dummy'];
    assert(keys.every(k => csv.includes(`public/assets/arena/${k}.webp`)) && codex.includes('PR까지만') && existsSync(fileURLToPath(new URL(dir + 'build-68.mjs', import.meta.url))) && existsSync(fileURLToPath(new URL(dir + 'split', import.meta.url))),
      'V13.235 그림 68 자리표(slice-map.csv) · CODEX_PROMPT_68.md · build-68.mjs');
  }
}
