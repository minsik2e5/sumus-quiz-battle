// V13.240 펫 아레나 캔버스 전환 ②단계 검사: docs/arena-battle-reboot-plan.md 3장(화면) · 7장 ②행 · 7-1 렉 예산.
//   - 위에서 비스듬히 내려다보는 시점: 규칙 좌표 → 경기장 px(가로 U · 세로 U × 기울기), 화면 폭에 규칙 60단위 · 펫 10단위.
//   - 카메라: 내 펫을 따라감(상대 쪽으로 앞서 봄) · 줌 0.9~1.18(2:2 · 난투 0.8배) · 지수 감쇠 · 충격량 흔들림 · 줌 펀치 · 화면 밖 상대 표시.
//   - 바닥은 DOM 바닥 층(transform만, 다시 칠하지 않음) + 자국을 그 한 장에 굽는다. 그림 72(floor-<이름>)가 오면 그림만 바뀐다.
//   - 위쪽 한 줄 HUD(얼굴 · 체력 · 필살 게이지 · 시간, 바뀔 때만 transform) · 부채꼴 버튼(공격 88 · 필살 72 · 스킬 60 · 회피 52 · 교체 44).
//   - 경기장 위 글자 5종(이름표 · 큰 외침 · 상태 · 숫자 · 배너), 안내 토스트 없음.
//   - 규칙 · 서버 판정 파일은 그대로(arena-stage-check.mjs의 해시 확인).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const source = p => readFileSync(fileURLToPath(new URL(p, import.meta.url)), 'utf8');

export async function runArenaViewChecks(assert) {
  const stage = source('../public/modules/arena-stage.js'), ui = source('../public/modules/arena.js'), css = source('../public/v13240.css'), build = source('./build-assets.mjs');
  const mod = await import('../public/modules/arena-stage.js');

  // 1) 시점 · 카메라 상수(구성안 3-2)
  const V = mod.VIEW;
  assert(V.units === 60 && V.petUnits === 10 && V.zMin === .9 && V.zMax === 1.18 && V.zMulti === .8 && V.follow === .3 && V.tilt > .7 && V.tilt < 1,
    `V13.240 시점: 화면 폭 규칙 60단위(경기장 84의 약 70%) · 펫 10단위(≈65px) · 줌 0.9~1.18 · 2:2/난투 0.8배 · 따라가기 0.3초 · 바닥 기울기 ${V.tilt}`);
  assert(stage.includes('U = W / VIEW.units; GW = 100 * U; GH = 100 * U * VIEW.tilt;') && stage.includes('px: (x, y) => ({ x: x / 100 * GW, y: y / 100 * GH }),') && !/\/ 100 \* [WH]\b/.test(stage),
    'V13.240 규칙 좌표 → 경기장 px는 한 가지(가로 U · 세로 U × 기울기): 펫 · 장판 · 줄기 · 날아가는 공격 · 효과가 모두 같은 바닥에 놓인다');
  const follow = stage.slice(stage.indexOf('function follow(sc, dt)'), stage.indexOf('function drawAim(sc)'));
  assert(follow.includes("alive(v.me) ? placeOf(sc, 'me')") && follow.includes('VIEW.lead') && follow.includes('Math.exp(-dt / VIEW.follow)') && follow.includes('multi ? VIEW.zMulti : 1') && follow.includes('clamp(view.x, lo + hw, hi - hw)'),
    'V13.240 카메라는 내 펫을 따라가고(상대 쪽 30% 앞서) 지수 감쇠로 부드럽게, 내 펫이 없으면 살아 있는 펫들 가운데, 경기장 밖은 거의 안 보이게 가둔다');
  assert(stage.includes('cam.trauma = Math.min(1, cam.trauma + (big ? .62 : .34))') && stage.includes('const amp = cam.trauma * cam.trauma * SHAKE_MAX;') && /Math\.sin\(view\.t \* \d+\)/.test(stage)
    && stage.includes('view.k = z * (1 + pv);') && ui.includes("stage()?.punch(e.who === 'me' ? 0.05 : 0.035, px(e.x, e.y - 6))"),
    'V13.240 흔들림은 충격량² × 최대폭(두 사인파, 무작위 떨림 아님) · 맞을 때 맞은 곳을 중심으로 줌 펀치(평타 · 장판 틱은 안 함)');
  const off = stage.slice(stage.indexOf('function drawOffscreen('), stage.indexOf('/* ---------- 그리기 ---------- */'));
  assert(off.includes("if (who === 'me' || sc.ally?.(who)) continue;") && off.includes('clamp(sx, m, W - m)') && off.includes('p.spr.body') && stage.includes('if (scene) drawOffscreen(scene, now);'),
    'V13.240 화면 밖 상대는 가장자리(HUD 아래 ~ 버튼 위)에 팀 색 동그라미 + 그 펫 얼굴 + 방향 삼각형(글자 없음)');

  // 2) 바닥 층: transform만 · 자국 굽기 · 그림 72 자리
  const render = stage.slice(stage.indexOf('function render(now, f)'), stage.indexOf('/* ---------- 품질 자동'));
  assert(render.includes('if (css !== view.css) { view.css = css; world.style.transform = css;') && render.includes('Math.round(view.ox + bsx - PX * view.k)') && stage.includes('view.gx = wx - bx') && render.includes('if (groundDirty && now - groundAt > 100) composeGround(now);') && !render.includes('paintBase(') && !render.includes('ctx.drawImage(floor, 0, 0'),
    'V13.240 바닥 층은 카메라 값이 바뀐 때만(1px 단위 · 데드존) transform 한 번(다시 칠하지 않음), 자국이 바뀐 때만 0.1초에 한 번까지 바닥 그림 + 자국을 합친다(매 프레임 바닥 그리기 없음)');
  assert(ui.includes('<div class="ar-world" id="ar-world" aria-hidden="true"><canvas class="ar-ground" id="ar-ground"></canvas><div class="ar-ring" aria-hidden="true"></div></div>') && css.includes('.ar-field.cam .ar-world{position:absolute;left:0;top:0;z-index:1;transform-origin:0 0;pointer-events:none;will-change:transform}'),
    'V13.240 바닥 층(.ar-world)에 바닥 캔버스 · 꾸미기 링이 함께 있어 카메라와 같이 움직인다(링 해금 그대로)');
  const F = mod.FLOORS, A = mod.FLOOR_ART;
  assert(['plaza', 'forest', 'night', 'sky', 'glacier', 'volcano', 'galaxy'].every(k => F[k]?.top?.length === 2 && F[k].rim?.length === 2) && stage.includes("ARENA_ART.has(`floor-${floorKey}`) ? image(`/assets/arena/floor-${floorKey}.webp`)")
    && Math.abs(A.x + .06 * A.w - 8) < 1e-9 && Math.abs(A.x + .94 * A.w - 92) < 1e-9 && Math.abs(A.y + .25 * A.h - 14) < 1e-9 && Math.abs(A.y + .75 * A.h - 86) < 1e-9 && ui.includes('floor: () => curBg'),
    'V13.240 바닥: 꾸미기 경기장 7곳마다 코드 바닥, 그림 72(floor-<이름>.webp)가 ARENA_ART에 들어오면 그림만 바뀐다(판 = 그림 가로 6~94% · 세로 25~75%, 주문서 72)');
  assert(stage.includes("fs = clamp(S, .75, 1.25);") && /export const FLOOR_PAD = \{ l: (\d+), r: (\d+), t: (\d+), b: (\d+) \};/.test(stage),
    'V13.240 바닥 캔버스 해상도는 1.25배까지(메모리), 크기는 경기장 + 여백(FLOOR_PAD) 한 장');

  // 3) 캔버스 = 경기장 = 화면 전체(칠하는 넓이가 ①과 같다)
  assert(stage.includes('const PAD = { l: 0, t: 0, r: 0, b: 0 };') && css.includes('.ar-play.cam .ar-field.cam{position:absolute;inset:0;') && css.includes('.ar-field.cv.cam .ar-cv{left:0;top:0;width:100%;height:100%}') && build.includes('"v13240.css"'),
    'V13.240 경기장 · 캔버스는 화면 전체(여백 없음), 위 HUD · 아래 버튼은 그 위에 겹친다');
  assert(!/backdrop-filter/.test(css) && !/animation:/.test(css), 'V13.240 HUD · 버튼 CSS에 backdrop blur · 무한 애니메이션 없음(캔버스가 매 프레임 바뀌어 blur는 매 프레임 다시 칠함)');

  // 4) 위쪽 한 줄 HUD · 부채꼴 버튼(구성안 3-4)
  const bars = ui.slice(ui.indexOf('function drawBars() {'), ui.indexOf('// 버튼 쿨타임 · 필살기 링'));
  assert(bars.includes('if (el._r === r) continue;') && bars.includes("el.style.transform = `scaleX(${r})`") && bars.includes('if (g && g._q !== q)') && ui.includes('function drawPad() {\n  drawBars();')
    && ui.includes('<i class="ah-hp"><i id="ar-hp-${who}"></i></i>') && ui.includes('id="ar-gauge-me"') && ui.includes('<span class="ar-clock" id="ar-clock">'),
    'V13.240 위쪽 한 줄 HUD: 얼굴 · 체력 · 내 필살 게이지 · 시간, 체력 · 게이지는 값이 바뀐 칸만 transform(scaleX) 한 번');
  const size = cls => { const m = css.match(new RegExp(`\\.ar-pad\\.fan \\.ar-btn\\.${cls}\\{left:(\\d+)px;top:(\\d+)px;width:(\\d+)px;height:(\\d+)px`)); return m ? m.slice(1).map(Number) : null; };
  const B = Object.fromEntries(['atk', 'ult', 'skill', 'skill2', 'dodge', 'swap'].map(k => [k, size(k)]));
  const want = { atk: 88, ult: 72, skill: 60, skill2: 60, dodge: 52, swap: 44 };
  const centers = Object.entries(B).filter(([, v]) => v).map(([k, [l, t, w]]) => [k, l + w / 2, t + w / 2, w / 2]);
  const overlap = centers.flatMap((a, i) => centers.slice(i + 1).filter(b => Math.hypot(a[1] - b[1], a[2] - b[2]) < a[3] + b[3]).map(b => `${a[0]}-${b[0]}`));
  assert(Object.entries(want).every(([k, w]) => B[k]?.[2] === w && B[k][3] === w) && !overlap.length && centers.every(([, x, y, r]) => x - r >= 0 && x + r <= 240 && y - r >= 0 && y + r <= 230),
    `V13.240 버튼 위계(공격 88 · 필살 72 · 스킬 60 · 회피 52 · 교체 44), 공격 둘레 부채꼴, 서로 겹치지 않고 버튼 판(240×230) 안${overlap.length ? `(겹침: ${overlap.join(', ')})` : ''}`);

  // 5) 경기장 위 글자 5종 · 안내 토스트 없음(구성안 3-5)
  assert(JSON.stringify(mod.TEXT_KINDS) === JSON.stringify(['tag', 'shout', 'status', 'num', 'count']) && stage.includes("if (!TEXT_KINDS.includes(kind)) { stats.dropped = (stats.dropped || 0) + 1; return; }")
    && stage.includes("if (o && o.t < .5) return;") && stage.includes("if (now - (statusAt.get(who) || 0) < .6) return;") && stage.includes("if (kind === 'tag' && who) { const o = pops.find(q => q.kind === 'tag' && q.who === who);"),
    'V13.240 경기장 위 글자는 5종(이름표 펫당 1 · 큰 외침 화면에 1(0.5초 안이면 버림) · 상태 펫당 0.6초에 1 · 숫자 · 배너)뿐, 나머지는 그리지 않는다');
  assert(!ui.includes('toastOnce') && !ui.includes("'hint')") && !ui.includes('치명타!') && !ui.includes('효과가 굉장해!') && !ui.includes('효과가 별로') && !ui.includes('등장!`') && !ui.includes("pop('교체!'")
    && ui.includes("pop('급소!'") && ui.includes("pop('효과 굉장!'") && ui.includes("(/\\bhint\\b/.test(cls) ? note(text) : pop(text, x, y, cls))"),
    'V13.240 안내 토스트 없음(필살 게이지 부족은 버튼만 떨림), "치명타!" → "급소!" · "효과가 굉장해!" → "효과 굉장!", 친구 연결 알림은 경기장이 아니라 HUD 아래 한 줄');
  const pops = [...ui.matchAll(/pop\('([^']+)'/g)].map(m => m[1]).filter(t => !/^[0-9]$/.test(t) && t !== 'FIGHT!');
  assert(pops.every(t => /[!)]$/.test(t)) && !pops.some(t => /\p{Extended_Pictographic}/u.test(t)), `V13.240 경기장 글자는 우리 말 + 느낌표, 이모지 없음(${pops.join(' · ')})`);

  // 6) 조준 표시는 바닥에 눕혀(무대) · 입력 방향은 기울기를 되돌려 규칙 방향으로
  assert(!ui.includes('id="ar-aim"') && ui.includes('scene.aim = R.drag?.on ? R.aimView : null;') && stage.includes('if (scene) { drawGround(scene, now); drawAim(scene); }')
    && ui.includes("R.dir = dirCode(dx, dy / (geo().tilt || 1), 0.28);") && ui.includes('const g = geo(), code = aimCode(dx / g.w, dy / g.h);') && ui.includes('R.geo ||= (R.stage?.world?.()'),
    'V13.240 조준 표시(화살표 · 부채꼴 · 원)는 무대가 바닥에 눕혀 그리고, 조이스틱 · 끌기 방향은 화면 기울기를 되돌려 규칙 방향으로 넣는다(규칙은 그대로)');
}
