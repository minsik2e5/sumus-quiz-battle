// V13.214 야차전 폰 화면 렉 검사(npm run check, 정적 검사 위주라 빠르다). 증상: 대회 중 "야차전 화면이 뚝뚝 끊긴다, 단어를
// 눌렀는데 렉"(모든 학생). 서버 쪽은 v13.212.0에서 고쳤고, 이번에는 폰 화면 쪽을 쟀다(docs/yacha-perf.mjs, 폰 390px · CPU 4× · 6×).
// 원인: 답 · 맞기마다 화면을 억지로 다시 배치(offsetWidth · getBoundingClientRect를 쓰기와 번갈아 읽기)하고, 시계 · 단어 막대를
// 매 프레임 다시 쓰고, 답 버튼 · HUD · 이모트를 통째로 다시 그리고, HP 막대 · 맞는 고리가 너비로 움직여 매 프레임 배치했다.
// 고친 것(보이는 연출은 그대로): 자리는 ResizeObserver로 한 번 읽어 두기, 바뀐 것만 쓰기, 단어 막대는 한 번의 애니메이션,
// HP · 고리 · 광선은 clip-path · transform, 자세 그림은 미리 풀어 두기, 긴 프레임이 이어지는 폰만 한 단계 가벼운 연출(.yb-lite).
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { FX2_CAP, FX2_LITE_CAP, fxCap, fxLite, fxIsLite, fxImpact, fxShot, fxSignature, fxSkillCutIn } from '../public/modules/battle-fx.js';

const path = p => fileURLToPath(new URL(p, import.meta.url));
const source = p => readFileSync(path(p), 'utf8');
const fnBody = (src, name) => { const i = src.indexOf(`function ${name}(`); if (i < 0) return ''; const j = src.indexOf('\nfunction ', i + 10), k = src.indexOf('\nconst ', i + 10), l = src.indexOf('\n// ', i + 10); return src.slice(i, Math.min(...[j, k, l].filter(x => x > 0), src.length)); };
const LAYOUT_PROPS = /(^|[;{\s])(width|height|top|left|right|bottom|margin(-[a-z]+)?|padding(-[a-z]+)?|border(-[a-z]+)?-width|border-width|font-size|line-height|inset)\s*:/;

export function runYachaFpsChecks(assert) {
  const battle = source('../public/modules/battle.js'), fx = source('../public/modules/battle-fx.js'), character = source('../public/modules/character.js');
  const css = source('../public/v13214.css'), build = source('./build-assets.mjs');

  /* ---------- 1. 억지 배치 없음: 맞기 · 흔들기 · 섬광 · 콤보에서 offsetWidth로 다시 시작하지 않는다 ---------- */
  assert(!/void\s+[\w.]+\.offset(Width|Height)/.test(battle) && battle.includes('function replay(el, cls, ms, names, others = [])') && battle.includes("replay(arena, cls, 600, SHAKES, SHAKES)") && battle.includes("replay(pet, 'fx-white', 260, ['fx-white'])") && battle.includes("replay(f, 'on', 620, ['ybFlash'])") && battle.includes("replay(box, 'bump', 380, ['fx-combo-bump'])"),
    'V13.214 효과를 다시 시작할 때 offsetWidth로 화면 배치를 억지로 다시 하지 않는다(replay: 애니메이션만 처음으로 돌린다)');
  const hot = ['fxCenter', 'pop', 'critStamp', 'strike', 'impact', 'skillExtras', 'hit', 'lunge', 'drawCombo', 'comboUp', 'refreshHud', 'drawQuestion', 'applyEvent'];
  assert(hot.every(name => { const body = fnBody(battle, name); return body && !/getBoundingClientRect|offsetWidth|offsetHeight|getComputedStyle/.test(body); }),
    `V13.214 맞기 · 답 · HUD 함수(${hot.join(', ')})는 배치를 읽지 않는다(자리는 기억해 둔 geo())`);
  assert(battle.includes('geoWatch = new ResizeObserver(() => measureGeo())') && /function drawMatch\(\)[\s\S]*?watchGeo\(\);/.test(battle) && fnBody(battle, 'measureGeo').includes('getBoundingClientRect') && battle.includes('popWatch ||= new ResizeObserver('),
    'V13.214 경기장 · 펫 · HUD 자리는 브라우저가 배치를 끝낸 뒤(ResizeObserver) 한 번 읽어 두고, 큰 데미지 숫자도 같은 프레임에 안쪽으로 맞춘다');

  /* ---------- 2. 답할 때 통째로 다시 그리지 않는다 ---------- */
  const dq = fnBody(battle, 'drawQuestion'), da = fnBody(battle, 'drawAnswers');
  assert(dq.includes('drawAnswers(q)') && !/yb-answers'\)\.innerHTML\s*=/.test(battle) && da.includes("buttons.forEach((b, i) =>") && da.includes('if (b.className !== cls) b.className = cls;') && da.includes('if (b.disabled !== off) b.disabled = off;'),
    'V13.214 답 · 맞기 · 정답 공개 때 답 버튼 4개는 그대로 두고 글자 · 모양(class)만 바꾼다(버튼 수가 다를 때만 새로 그린다)');
  const ae = fnBody(battle, 'applyEvent');
  assert(!/\.innerHTML\s*=/.test(ae) && (ae.match(/drawMatch\(\)/g) || []).length === 2 && ae.includes("if (!document.getElementById('yb-arena')) return drawMatch();") && ae.includes("if (!document.getElementById('yb-arena')) drawMatch();"),
    'V13.214 대결 중 메시지(답 · 맞기 · 특기 · 이모트)는 경기장을 다시 그리지 않는다(경기장이 없을 때만 drawMatch)');
  assert(fnBody(battle, 'refreshHud').includes('setHtml(box,') && fnBody(battle, 'refreshHud').includes("setHtml(document.getElementById('yb-fx-' + side)") && !fnBody(battle, 'refreshHud').includes('.innerHTML =') && fnBody(battle, 'drawMySkill').includes('setHtml(box,') && fnBody(battle, 'drawEmotes').includes('setHtml(bar,') && fnBody(battle, 'say').includes('setHtml(') && battle.includes('function setHtml(el, html) { if (el && el._html !== html)'),
    'V13.214 HUD · 내 특기 · 이모트 · 안내 줄은 글이 바뀔 때만 다시 쓴다(같은 글이면 건너뛴다)');

  /* ---------- 3. 매 프레임 쓰지 않는다: 시계는 바뀔 때만, 단어 막대는 한 번의 애니메이션 ---------- */
  const loop = fnBody(battle, 'loop'), bar = fnBody(battle, 'turnBar');
  assert(loop.includes('setText(clock, clockText(left))') && loop.includes('if (clock._warn !== warn)') && !/clock\.textContent\s*=/.test(loop) && !/style\.transform\s*=/.test(loop) && loop.includes('turnBar(v, now)'),
    'V13.214 시계 글자 · 색은 바뀔 때(1초에 한 번)만 쓰고, 매 프레임 스타일을 쓰지 않는다');
  assert(bar.includes('if (bar._key === key)') && bar.includes("bar.animate([{ transform: `scaleX(${from})` }, { transform: 'scaleX(0)' }], { duration: left, easing: 'linear', fill: 'forwards' })") && bar.includes("bar._anim.pause()"),
    'V13.214 단어 시간 막대는 단어마다 transform 애니메이션 하나(같은 모양으로 줄어듦), 낱말 놀이 중에는 멈춘다');

  /* ---------- 4. 애니메이션 속성은 transform · opacity 위주(배치를 부르는 속성 없음) ---------- */
  const list = JSON.parse(build.match(/const cssSources = (\[[\s\S]*?\]);/)?.[1] || '[]');
  assert(existsSync(path('../public/v13214.css')) && list.includes('v13214.css') && list.indexOf('v13214.css') > list.indexOf('v13210.css') && list.indexOf('v13214.css') > list.indexOf('v1394.css') && list.indexOf('v13214.css') > list.indexOf('v1354.css') && list.at(-1) === 'v13178.css',
    'V13.214 v13214.css는 번들에서 예전 전투 CSS(v1354 · v1394) 뒤에 들어가 덮어쓴다(민트 CSS가 맨 끝)');
  // 번들에서 야차전 선택자(.yb- · .fx- · .fx2-)가 쓰는 @keyframes 가운데 배치 속성을 움직이는 것은 v13214.css가 덮은 것뿐이어야 한다.
  const bundlePath = path('../public/app.bundle.css');
  const all = list.map(name => existsSync(path(`../public/${name}`)) ? source(`../public/${name}`) : '').join('\n').replace(/\/\*[\s\S]*?\*\//g, '');
  const keyframes = new Map([...all.matchAll(/@keyframes\s+([\w-]+)\s*\{((?:[^{}]*\{[^{}]*\})*)\s*\}/g)].map(m => [m[1], m[2]]));
  const used = new Set();
  // 선택자마다 마지막 선언이 이긴다(같은 선택자 문자열 기준): 덮인 이름은 빼고 센다.
  const last = new Map();
  for (const m of all.matchAll(/([^{}@]+)\{([^{}]*)\}/g)) {
    const sel = m[1].trim().replace(/\s+/g, ' ');
    if (!/\.(yb|fx2?)-|\.fx2\b/.test(sel)) continue;
    const a = [...m[2].matchAll(/animation(?:-name)?\s*:([^;]+)/g)].at(-1);
    if (a) last.set(sel, a[1]);
  }
  for (const value of last.values()) for (const tok of value.split(/[\s,]+/)) if (keyframes.has(tok)) used.add(tok);
  const heavy = [...used].filter(name => keyframes.get(name).split(/[{}]/).some(chunk => LAYOUT_PROPS.test(' ' + chunk)));
  assert(heavy.length === 0, `V13.214 야차전 애니메이션은 배치 속성(너비 · 높이 · 위치 · 여백 · 테두리 굵기)을 움직이지 않는다(transform · opacity 위주): ${heavy.join(', ') || '없음'}`);
  assert(css.includes('.fx-ring{width:150px;height:150px;border-width:3px;animation:fx-ring-t') && css.includes('@keyframes fx-ring-t{from{transform:translate(-50%,-50%) scale(.14);opacity:1}to{transform:translate(-50%,-50%) scale(1);opacity:0}}') && css.includes('scale:1 .25') && battle.includes("rotate: `${ang}rad`, '--fx': color }, 520)"),
    'V13.214 맞는 고리는 transform으로 커지고, 스킬 광선 끝은 scale로 가늘어진다(각도는 rotate 속성)');
  assert(css.includes('.battle-app .yb-fill{width:100%;transition:clip-path .6s') && fnBody(battle, 'setHp').includes('fill.style.clipPath = clip') && !fnBody(battle, 'refreshHud').includes('style.width'),
    'V13.214 HP 막대는 너비 대신 clip-path로 줄어든다(같은 0.6초 · 같은 둥근 끝)');
  assert(css.includes('.battle-app .yb-arena{contain:layout paint}'), 'V13.214 경기장 안 효과가 붙고 떨어져도 배치 · 그리기는 경기장 안에서만');
  assert(existsSync(bundlePath) ? source('../public/app.bundle.css').includes('@keyframes fx-ring-t') : true, 'V13.214 번들에 새 고리 애니메이션이 들어간다');

  /* ---------- 5. 파티클 상한 · 저사양 단계 ---------- */
  assert(FX2_CAP.every(n => n <= 66) && FX2_LITE_CAP < FX2_CAP[0] && battle.includes('const FX_MAX = 24;') && fx.includes('if (!arena || live(arena) >= capNow) return null;'),
    'V13.214 효과 조각은 동시에 등급별 44~66개까지(저사양 단계는 28개), 불꽃 튀기는 24개까지');
  assert(/const LITE_KEY = 'sumus-yacha-lite', LITE_LONG_MS = 50, LITE_WINDOW_MS = 3000, LITE_LONG_COUNT = 8, LITE_DAYS = 7;/.test(battle) && fnBody(battle, 'loop').includes('applyLite()') && battle.includes('lagWatch(t);') && fnBody(battle, 'applyLite').includes("classList.toggle('yb-lite', on)") && fnBody(battle, 'applyLite').includes('fxLite(on)') && fnBody(battle, 'lagWatch').includes('d < 1000') && fnBody(battle, 'lagWatch').includes("pref(LITE_KEY, '') !== 'off'"),
    'V13.214 대결 중 3초 안에 50ms 넘는 프레임이 8번 넘게 나오는 폰만 저사양 단계로(7일 기억, 잠깐 꺼진 화면은 세지 않는다). 기본은 그대로');
  assert(css.includes('.battle-app.yb-lite .fx2-shot svg') && css.includes('mix-blend-mode:normal') && css.includes('.battle-app.yb-lite .yb-pet.fx-aura-1 .avatar-art img') && !/^[^/]*\.battle-app(?!\.yb-lite)[^{]*\{[^}]*mix-blend-mode:normal/m.test(css),
    'V13.214 저사양 단계는 섞기 · 빛 번짐만 끄고(모양 · 색 · 움직임은 같다), 보통 폰의 연출은 건드리지 않는다');
  // 가짜 경기장에서: 저사양이면 신화 펫이 아무리 몰아쳐도 조각은 28개를 넘지 않고, 보통은 등급 상한을 넘지 않는다.
  const realDoc = globalThis.document, realTimeout = globalThis.setTimeout;
  const make = () => { const el = { children: [], dataset: {}, style: { setProperty() {} }, className: '', setAttribute() {}, animate() { return {}; }, remove() {}, appendChild(c) { el.children.push(c); }, querySelectorAll(s) { return s === '[data-fx]' ? el.children.filter(c => 'fx' in c.dataset) : []; }, querySelector() { return make(); } }; return el; };
  globalThis.document = { createElement: make };
  globalThis.setTimeout = () => 0;
  try {
    const burst = arena => { for (let i = 0; i < 20; i++) { fxShot(arena, { x: 0, y: 0 }, { x: 100, y: 80 }, 'flame', { big: true, rank: 3 }); fxImpact(arena, { x: 100, y: 80 }, 'star', 3, 3); fxSignature(arena, { x: 0, y: 0 }, { x: 100, y: 80 }, 'gumiho'); fxSkillCutIn(arena, { side: 'me', el: 'water', rank: 3 }); } return arena.children.length; };
    fxLite(false); fxCap(3); const full = burst(make());
    fxLite(true); fxCap(3); const lite = burst(make()); const wasLite = fxIsLite();
    fxLite(false); fxCap(0);
    assert(full <= FX2_CAP[3] && full > FX2_LITE_CAP && lite <= FX2_LITE_CAP && wasLite && !fxIsLite(), `V13.214 조각 상한(보통 신화 ${full}개 ≤ ${FX2_CAP[3]}, 저사양 ${lite}개 ≤ ${FX2_LITE_CAP})`);
  } finally { globalThis.document = realDoc; globalThis.setTimeout = realTimeout; }

  /* ---------- 6. 그림: 자세 그림은 미리 받아 풀어 두고, 같은 그림을 매번 새로 풀지 않는다 ---------- */
  assert(character.includes('const POSE_KEEP = 16, POSES = new Map();') && character.includes("pre.decode?.().catch(() => {})") && character.includes('if (pre.ready) swap(); else pre.wait.then(swap, () => {});') && character.includes('export function preloadPoses(art') && /function drawMatch\(\)[\s\S]*?preloadPoses\(document\.getElementById\('yb-pet-' \+ side\)\)/.test(battle),
    'V13.214 펫 공격 · 아파하는 그림은 대결 시작 때 받아서 풀어 두고(최대 16장 기억), 맞을 때 바로 바뀐다');

  /* ---------- 7. 잰 도구는 docs에(검사에는 넣지 않는다) ---------- */
  const tool = existsSync(path('../docs/yacha-perf.mjs')) ? source('../docs/yacha-perf.mjs') : '';
  assert(tool.includes("Emulation.setCPUThrottlingRate") && tool.includes('width: 390, height: 844') && tool.includes("observe({ type: 'longtask'") && tool.includes('--root') && !source('./release-check.mjs').includes('yacha-perf'),
    'V13.214 프레임 측정 도구(docs/yacha-perf.mjs: 폰 390px · CPU 느리게 · 두 탭 대결 · 입력 지연)는 docs에 있고 npm run check에서 돌리지 않는다');
}
