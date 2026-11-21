// V13.246 게임 렉 점검(docs/game-lag-2026-11.md)에서 고친 것이 되돌아가지 않게 막는 검사.
//   규칙: 판 중 프레임마다 (1) 큰 DOM을 통째로 다시 쓰지 않는다 (2) 같은 값은 다시 쓰지 않는다 (3) 요소를 프레임마다 다시 찾지 않는다.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const source = p => readFileSync(fileURLToPath(new URL(p, import.meta.url)), 'utf8');
const fnBody = (js, name) => { const i = js.indexOf(`function ${name}(`); if (i < 0) return ''; let d = 0; for (let k = js.indexOf('{', js.indexOf(')', i)); k < js.length; k++) { if (js[k] === '{') d++; else if (js[k] === '}' && --d === 0) return js.slice(i, k + 1); } return ''; };

export async function runGameLagChecks(assert) {
  // 1) 낚시: 낚싯대 SVG는 바뀐 속성만 고친다(프레임마다 innerHTML 금지), 같은 문자열 · 같은 속성 · 같은 글자는 건너뛴다
  {
    const js = source('../public/modules/reel.js'), rig = fnBody(js, 'drawRig'), patch = fnBody(js, 'patchSvg'), fight = fnBody(js, 'fightStep');
    assert(rig && !/\.innerHTML\s*=/.test(rig) && rig.includes('rv.__html !== html') && rig.includes('patchSvg(rv, html)'), '낚시 drawRig: 프레임마다 innerHTML을 쓰지 않고, 같은 모양이면 건너뛴다');
    assert(patch && patch.includes('el.setAttribute(a[1], a[2])') && patch.includes('root.innerHTML = html') && patch.includes('root.__sig'), '낚시 patchSvg: 바뀐 속성만 고치고, 요소 구성이 달라질 때만 통째로 다시 쓴다');
    assert(/setA\(reel, 'transform'/.test(rig) && /setA\(line, 'd'/.test(rig) && rig.includes('reel.__s !== s'), '낚시 drawRig: 릴 · 줄 속성은 값이 바뀔 때만, 릴 크기는 화면 크기가 바뀔 때만 쓴다');
    assert(fight && fight.includes('dn.__m !== m10') && !/\$\('rl-dist-n'\)\.textContent\s*=/.test(fight) && !/lane\?\.clientHeight \|\| 220;/.test(fight), '낚시 fightStep: 거리 글자는 바뀔 때만, 노트 칸 높이는 한 번만 잰다(프레임마다 배치 강제 없음)');
    // patchSvg가 실제로 같은 결과를 내는지: 가짜 요소로 돌려 본다(요소 수 같음 → 속성만, 다름 → 통째로)
    const make = new Function(`const SVG_EL = /<(\\w+)((?:\\s+[\\w-]+="[^"]*")*)\\s*\\/>/g, SVG_AT = /([\\w-]+)="([^"]*)"/g; ${patch}; return patchSvg;`)();
    const parse = html => [...html.matchAll(/<(\w+)((?:\s+[\w-]+="[^"]*")*)\s*\/>/g)].map(m => { const at = {}; for (const a of m[2].matchAll(/([\w-]+)="([^"]*)"/g)) at[a[1]] = a[2]; return { tag: m[1], at, sets: 0, setAttribute(k, v) { this.at[k] = v; this.sets++; } }; });
    const root = { children: [], writes: 0, set innerHTML(h) { this.writes++; this.children = parse(h); } };
    const A = '<path class="a" d="M1,2L3,4" fill="red"/><circle cx="1.0" cy="2.0" r="3.0" fill="none"/>', B = '<path class="a" d="M1,2L3,9" fill="red"/><circle cx="1.5" cy="2.0" r="3.0" fill="none"/>', C = A + '<path d="M0,0" fill="blue"/>';
    make(root, A); const first = root.children;
    make(root, B);
    assert(root.writes === 1 && root.children === first && first[0].at.d === 'M1,2L3,9' && first[1].at.cx === '1.5' && first[0].sets === 1 && first[1].sets === 1, '낚시 patchSvg: 같은 구성이면 요소를 그대로 두고 바뀐 속성 2개만 쓴다');
    make(root, C);
    assert(root.writes === 2 && root.children.length === 3, '낚시 patchSvg: 요소 수가 달라지면 통째로 다시 쓴다');
    make(root, A);
    assert(root.writes === 3 && root.children.length === 2 && root.children[0].at.d === 'M1,2L3,4', '낚시 patchSvg: 다시 줄어도 맞게 그린다');
  }
  // 2) 짝 맞추기: 시계 · 링 요소는 한 번만 찾고 값이 바뀔 때만 쓴다, 시계 칸은 크기 고정(contain)
  {
    const js = source('../public/modules/match-game.js'), tick = fnBody(js, 'tick'), hud = fnBody(js, 'hud'), css = source('../public/v13246.css');
    assert(tick.includes('M.clockEl?.isConnected') && tick.includes('txt !== M.clockTxt') && hud.includes('off !== M.ringOff') && hud.includes('M.ringFill?.isConnected'), '짝 맞추기 tick · hud: 요소를 프레임마다 찾지 않고 값이 바뀔 때만 쓴다');
    assert(/#mt-clock b\{[^}]*contain:size layout style/.test(css), '짝 맞추기 시계 칸: 크기 고정 + contain(글자가 바뀌어도 배치가 칸 밖으로 번지지 않음)');
  }
  // 2-2) 짝 맞추기: 맞힌 순간의 일을 두 프레임으로 나눈다(콤보 글자 · 펫 말풍선 · 달리기 표시는 다음 프레임), 피버 켜기는 바로
  {
    const js = source('../public/modules/match-game.js'), hit = fnBody(js, 'hit');
    assert(hit && /if \(feverNow\) feverOn\(\);\s*requestAnimationFrame\(\(\) => \{ if \(M !== m \|\| M\.closing\) return; comboText\(\); if \(cheer\) petSay\(cheer\[0\], cheer\[1\]\); meRun\(\); ghostGap\(split\); \}\);/.test(hit), '짝 맞추기 hit: 콤보 글자 · 말풍선 · 달리기 표시는 다음 프레임에, 판이 바뀌었으면 하지 않는다');
  }
  // 2-3) 펫 아레나: 스프라이트 묶음은 그림 · 크기 · 팀 색마다 한 번만 굽고, 대기 펫은 카운트다운 동안 한 프레임에 하나씩 미리 굽는다
  {
    const st = source('../public/modules/arena-stage.js'), ui = source('../public/modules/arena.js'), spr = fnBody(st, 'sprites'), warm = fnBody(st, 'warmStep'), rs = fnBody(st, 'resize');
    assert(spr.includes('sprC.get(key)') && spr.includes('`${im.src}|${px}|${color || \'\'}`') && spr.includes('if (sprC.size > 40) sprC.clear();'), '아레나 sprites: 같은 그림 · 크기 · 색은 캐시에서(상한 40)');
    assert(warm.includes("if (kind === 'spr') {") && warm.includes('break;') && rs.includes('sprC.clear();') && rs.includes('for (const w of sprWant) if (!warmQ.includes(w)) warmQ.push(w);'), '아레나: 스프라이트 미리 굽기는 한 프레임에 하나, 크기가 바뀌면 비우고 다시 굽는다');
    assert(/if \(i === R\.cur\?\.\[who\]\?\.idx\) return;[^\n]*jobs\.push\(\(\) => R\.stage\?\.warm\(\[\['spr', src, team\]\]\)\)/.test(ui), '아레나 warmArt: 대기 펫의 기본 · 공격 · 맞는 자세 그림을 카운트다운 동안 미리 굽게 맡긴다');
  }
  // 3) 새 CSS가 묶음에 들어 있고, 움직임을 새로 만들지 않는다
  {
    const css = source('../public/v13246.css'), build = source('./build-assets.mjs');
    assert(build.includes('"v13246.css"') && !/@keyframes|animation:|transition:/.test(css), 'v13246.css가 CSS 묶음에 들어 있고 새 애니메이션이 없다');
  }
  // 4) 측정 도구가 있다(다음 점검 때 같은 방법으로 잰다)
  {
    const gp = source('../docs/game-perf.mjs'), dr = source('../docs/game-perf-drivers.mjs');
    assert(gp.includes('heap_mb') && gp.includes('after_exit') && gp.includes('Emulation.setCPUThrottlingRate') && ['match', 'wall', 'timing', 'fishing', 'claw', 'rps', 'yabawi', 'hunt', 'yacha', 'monster'].every(g => dr.includes(`driver('${g}'`)), 'docs/game-perf.mjs: 게임 10개를 같은 조건으로 재는 공통 측정 스크립트');
  }
}
