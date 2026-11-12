// V13.238 펫 아레나 캔버스 무대(①단계) 검사: docs/arena-battle-reboot-plan.md 2장 · 5장 · 7장 ①행 · 7-1 렉 예산.
//   - 그리기만 바꿨다: 전투 규칙 · 서버 판정 파일은 그대로(내용 해시), 무대는 전투 상태를 읽기만 한다.
//   - 규칙이 내는 사건마다 연출이 있다(연출 없는 사건은 이유와 함께 목록에).
//   - 효과 저장소는 정해진 크기(풀 · 상한 목록), 바닥 자국은 한 장에 굽고 상한이 넘으면 아문다.
//   - 경기장에 DOM 효과 조각을 만들지 않는다 · 무대 모듈은 아레나를 열 때만 불러온다 · 품질 자동 4단계.
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const path = p => fileURLToPath(new URL(p, import.meta.url));
const source = p => readFileSync(path(p), 'utf8');
// 줄바꿈(CRLF · LF)과 상관없이 같은 내용이면 같은 값.
const hash = p => createHash('sha256').update(source(p).replace(/\r\n/g, '\n')).digest('hex').slice(0, 16);

// 캔버스 전환 동안(①~④) 바뀌면 안 되는 파일. 규칙을 일부러 바꾸는 PR은 여기 값도 새로 적고 PR에 이유를 쓴다.
const RULE_FILES = {
  '../public/modules/arena-rules.js': 'f4a27579d08b42e2',
  '../public/modules/arena-live-rules.js': 'c86eb6ae2b1db059',
  '../public/modules/arena-practice-rules.js': '0b1556e695d7e728',
  './arena.mjs': '65c08ead67fb47eb'
};
// 규칙이 내지만 따로 그리지 않는 사건: lunge(돌진 시작 — 맞을 때 dmg · pop이 그린다, 예전 DOM도 없음) · over(판 끝 — end()가 배너).
const QUIET_EVENTS = new Set(['lunge', 'over']);

export async function runArenaStageChecks(assert) {
  const stage = source('../public/modules/arena-stage.js'), ui = source('../public/modules/arena.js'), app = source('../public/app.js');
  const rules = ['../public/modules/arena-rules.js', '../public/modules/arena-live-rules.js', '../public/modules/arena-practice-rules.js'].map(source).join('\n');

  // 1) 규칙 · 서버 판정은 그대로, 무대는 읽기만
  const changed = Object.entries(RULE_FILES).filter(([p, h]) => hash(p) !== h).map(([p]) => p.split('/').pop());
  assert(!changed.length, `V13.238 캔버스 전환은 그리기만 바꾼다: 전투 규칙 · 서버 판정 파일이 그대로다${changed.length ? `(바뀜: ${changed.join(', ')})` : ''}`);
  assert(!/from '\.\/arena-(rules|live|live-rules|practice-rules)\.js'/.test(stage) && !/\bsim\b|\.step\(|api\(|fetch\(/.test(stage) && !/R\.(sim|inputs)/.test(stage),
    'V13.238 무대(arena-stage.js)는 규칙 · 입력 · 서버를 건드리지 않고 장면(앞 · 지금 틱 상태)만 읽는다');
  const tick = ui.slice(ui.indexOf('function tickOnce('), ui.indexOf('function onEvent('));
  assert(tick.includes('R.sim.push(x)') && tick.includes('const ev = R.sim.step();') && !tick.includes('stage') && !ui.includes('stopUntil'),
    'V13.238 틱(조작 기록 · 전투 한 걸음)은 그대로, 히트스톱은 연출 시간만 멈춘다(전투 시계를 늦추지 않음 → 혼자 판 · 친구 대전이 같은 느낌)');

  // 2) 사건마다 연출
  const emitted = [...new Set([...rules.matchAll(/[{ ,(]e: '([a-z0-9]+)'/g)].map(m => m[1]))];
  const handled = new Set([...ui.matchAll(/e\.e === '([a-z0-9]+)'/g)].map(m => m[1]));
  const missing = emitted.filter(e => !handled.has(e) && !QUIET_EVENTS.has(e));
  assert(emitted.length >= 30 && !missing.length, `V13.238 규칙이 내는 사건(${emitted.length}가지)마다 무대 연출이 있다${missing.length ? `(없음: ${missing.join(', ')})` : ''}`);
  const fxNames = ['spark', 'beam', 'claw', 'quake', 'bits', 'ring', 'impact', 'speedLines', 'crit', 'scorch', 'meteorfall', 'ultfx', 'ult2ring', 'ult2line', 'stream', 'num', 'pop', 'faint', 'afterimage', 'flash', 'recoil', 'pose', 'aura', 'hitStop', 'shake', 'zoom', 'slow'];
  const api = stage.slice(stage.indexOf('const api = {'), stage.indexOf('let darkE = null;'));
  const noApi = fxNames.filter(n => !new RegExp(`\\n    ${n}(\\(|: |,)`).test(api) && !api.includes(`    ${n},`) && !api.includes(`, ${n},`));
  assert(!noApi.length, `V13.238 지금 DOM 효과(.ar-fx 등)를 캔버스 효과로 1:1 옮겼다(무대 함수 ${fxNames.length}개)${noApi.length ? `: 없음 ${noApi.join(', ')}` : ''}`);

  // 3) 풀 · 상한 · 바닥 굽기(구성안 7-1 렉 예산)
  const num = re => Number((stage.match(re) || [])[1]);
  const pool = { bits: num(/POOL_MAX = \{ bits: (\d+)/), sparks: num(/POOL_MAX = \{[^}]*sparks: (\d+)/), glows: num(/POOL_MAX = \{[^}]*glows: (\d+)/), smoke: num(/POOL_MAX = \{[^}]*smoke: (\d+)/), debris: num(/POOL_MAX = \{[^}]*debris: (\d+)/) };
  const list = { fx: num(/LIST_MAX = \{ fx: (\d+)/), rings: num(/LIST_MAX = \{[^}]*rings: (\d+)/), nums: num(/LIST_MAX = \{[^}]*nums: (\d+)/), texts: num(/LIST_MAX = \{[^}]*texts: (\d+)/), ghosts: num(/LIST_MAX = \{[^}]*ghosts: (\d+)/) };
  assert(pool.bits <= 160 && pool.sparks <= 320 && pool.glows <= 300 && pool.smoke <= 96 && pool.debris <= 400 && list.fx <= 24 && list.rings <= 18 && list.nums <= 24 && list.texts <= 12 && list.ghosts <= 8,
    `V13.238 풀 상한(구성안 7-1): 조각 ${pool.bits} · 불꽃 ${pool.sparks} · 빛 ${pool.glows} · 연기 ${pool.smoke} · 파편 ${pool.debris} · 큰 효과 ${list.fx} · 고리 ${list.rings} · 숫자 ${list.nums} · 글자 ${list.texts} · 잔상 ${list.ghosts}`);
  const pools = ['const NB = POOL_MAX.bits', 'const NK = POOL_MAX.sparks', 'const NG = POOL_MAX.glows', 'const NM = POOL_MAX.smoke', 'const ND = POOL_MAX.debris'];
  const caps = ['if (B.n >= T.bits) return;', 'if (K.n >= T.sparks) return;', 'if (G.n >= T.glows) return;', 'if (M.n >= T.smoke) return;', 'if (D.n >= T.debris) return;', 'if (fx.length >= Math.min(LIST_MAX.fx, T.fx)) return null;', 'if (rings.length < LIST_MAX.rings)', 'if (nums.length >= LIST_MAX.nums) nums.shift();', 'if (pops.length >= LIST_MAX.texts) pops.shift();', 'if (ghosts.length >= LIST_MAX.ghosts) ghosts.shift();'];
  assert(stage.includes('const F = n => new Float32Array(n)') && pools.every(x => stage.includes(x)) && caps.every(x => stage.includes(x)) && stage.includes('const swapOut = '),
    'V13.238 효과 저장소는 미리 만든 Float32Array 풀 · 상한 목록(지우기는 맨 끝과 바꾸기) → 판이 길어져도 메모리가 늘지 않는다');
  assert(/export const SCAR_CAP = 36;/.test(stage) && stage.includes('if (scars > SCAR_CAP) heal();') && stage.includes("fctx.globalCompositeOperation = 'destination-out'") && stage.includes('if (floor && scars) ctx.drawImage(floor, 0, 0, W, H);'),
    'V13.238 바닥 자국은 바닥 캔버스 한 장에 굽고(매 프레임 그림 1장), 36이 넘으면 오래된 자국부터 아문다(끝없이 쌓이는 목록 없음)');
  assert(stage.includes('if (texts.size > 160) texts.clear();') && stage.includes('if (tintCache.size > 60) tintCache.clear();'), 'V13.238 글자 그림 · 색 입힌 재료 캐시도 상한(160 · 60)이 있다');

  // 4) 품질 자동 4단계 · 칠하기 비용
  const tiers = [...stage.matchAll(/\{ name: '(최저|낮음|중간|높음)', scale: ([\d.]+)/g)].map(m => [m[1], Number(m[2])]);
  assert(tiers.map(t => t.join()).join(' ') === '최저,0.75 낮음,1 중간,1.5 높음,2' && stage.includes('const TIER_KEY = \'sumus-arena-tier\', TIER_DAYS = 7, TIER_CHECK_MS = 2000, SLOW_MS = 20;')
    && stage.includes('if (auto && slow > .15 && tier > 0 && stats.frames > 90) setTier(Math.max(0, tier - (slow > .5 ? 2 : 1)));'),
    'V13.238 품질 4단계(해상도 0.75 · 1 · 1.5 · 2): 2초마다 20ms 넘은 프레임이 15% 넘으면 한 단계(50%면 두 단계) 내리고 올리지 않음, 내려간 단계는 7일 기억');
  const render = stage.slice(stage.indexOf('function render(now, f)'), stage.indexOf('/* ---------- 품질 자동'));
  assert(!/ctx\.filter\s*=|\.filter\s*=\s*['`"]blur/.test(stage) && !render.includes('getImageData') && !render.includes('new Image(') && !render.includes('querySelector') && stage.includes("if (!cvs.isConnected) return destroy();"),
    'V13.238 그리기 고리: 캔버스 blur 필터 · 픽셀 읽기 · 그림 새로 받기 · DOM 찾기 없음, 경기장 칸이 사라지면 스스로 멈춘다');

  // 5) 경기장 DOM: 효과 조각 없음 · 버튼 · HUD는 DOM 그대로 · 무대 모듈은 아레나를 열 때만
  const fieldFn = ui.slice(ui.indexOf('function field() {'), ui.indexOf('// 위 막대: 이름')), fxPart = ui.slice(ui.indexOf('// 다음 프레임에(한 프레임에'), ui.indexOf('// 쓰러짐 배너 글:'));
  assert(!ui.includes('ar-fx') && (fxPart.match(/createElement\(/g) || []).length === 1 && fxPart.includes('el.className = `ar-banner ${who}`') && fieldFn.includes('<canvas class="ar-cv" id="ar-cv" aria-hidden="true"></canvas>') && ['data-btn="atk"', 'id="ar-hud-me"', 'id="ar-clock"', 'id="ar-aim"', 'id="ar-cut"', 'id="ar-wash"'].every(x => fieldFn.includes(x)),
    'V13.238 경기장은 캔버스 한 장(효과 DOM 조각 없음, 배너만 DOM), 버튼 · 위 막대 · 조준 표시 · 컷인 · 물들이기는 DOM 그대로');
  assert(!app.includes('arena-stage') && ui.includes("import('./arena-stage.js')") && !/^import .*arena-stage/m.test(ui) && ui.includes('R.stageMod = await mod.catch(() => null);'),
    'V13.238 무대 모듈은 앱 첫 화면에서 읽지 않고 아레나 판을 시작할 때(VS 화면 동안) 불러온다');
  const css = source('../public/v13238.css'), build = source('./build-assets.mjs');
  assert(build.includes('"v13238.css"') && css.includes('.ar-field.cv .ar-cv{position:absolute;left:-40px;top:-110px;width:calc(100% + 80px);height:calc(100% + 140px);z-index:11') && stage.includes('const PAD = { l: 40, t: 110, r: 40, b: 30 };'),
    'V13.238 캔버스 크기 · 자리(CSS)와 무대의 여백(PAD)이 같다, 물들이기(10) 위 · 컷인(12) 아래');
  // 6) 모든 판이 같은 무대: 혼자 판 · 친구 대전(되감기) · 다시 보기 · 연습장 · 2:2 · 난투는 모두 play()로 들어온다
  assert((ui.match(/(?<!function )\bplay\(r\)/g) || []).length === 2 && ui.includes('R.stage = R.stageMod?.createStage($(\'ar-field\'), stageHost()) || null;') && source('../public/modules/arena-practice.js').includes("arenaUi.dummy?.('foe', P.dummy);") && stage.includes('function dummySprite('),
    'V13.238 혼자 판 · 친구 대전 · 다시 보기 · 연습장(허수아비) · 2:2 · 난투가 모두 같은 캔버스 무대로 그린다');
}
