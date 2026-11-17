// 그림 주문서 75: 펫 대행진 ②단계(박진감 업) 새 그림 24장 · 6시트 — 적 정령 · 숫자 벽 · 벽 조각 · 좁은 다리 · 낭떠러지 · 성 수비 · 피버 · 충돌 빛.
//   node docs/asset-requests/runner/build-75.mjs
// 만드는 것: 75-pet-runner-2.txt(전체), split/ 시트별 파일(75-N …, 이름에 ':' 없음), slice-map.csv의 75 줄(있으면 바꿔 쓴다).
// 시점 · 그림체 · 처리 방법(cut · add · tile)은 주문서 74(build-74.mjs)와 같다. 자르기는 slice-74.mjs가 75-N도 받는다.
// 넣는 곳: public/assets/runner/<이름>.webp → npm run build:assets가 RUNNER_ART에 적고, 게임은 있는 그림만 쓴다(없으면 코드 그림).
// 거대 몬스터는 기존 던전 몬스터 그림(public/assets/dungeon/…)을 쓰므로 주문하지 않는다.
// CLAUDE.md 그림 주문서 규칙 두 가지를 시트마다 넣는다:
//   ① Google Drive의 기존 그림(74 시트 · 펫 그림)을 열어 그림체를 맞추라 ② 정해진 Drive 폴더에 정확한 파일 이름(75-N.png)으로 저장하라.
import { readFileSync, writeFileSync, mkdirSync, readdirSync, unlinkSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { CUT, BLACK, STYLE, CAMERA, STYLE_REF, REF_PET, REF_FLOOR, REF_FX, REF_MAT, KIND_NOTE, SPIRIT, DRIVE as DRIVE_74 } from './build-74.mjs';

const here = dirname(fileURLToPath(import.meta.url));
export const DRIVE = 'SUMUS 펫 대행진 75 (Runner용)';
export const LIST = '75-pet-runner-2.txt';

const DONE = n => `WHEN DONE — upload the finished PNG to Google Drive, into the folder "${DRIVE}", named exactly "${n}.png" (if a file with that name is already there, replace it; if the folder does not exist, create it). Actually save the file to Google Drive; showing the picture in the chat is not enough.`;
const R74 = (...files) => `the pet runner sheets ${files.map(f => `"${f}.png"`).join(', ')} in the folder "${DRIVE_74}"`;
const NO_COPY = 'Do NOT copy or resemble the enemies, walls, bridges, castles, banners or effects of any other game (for example Last War, Count Masters, Mob Control or any other crowd-runner game).';
const ENEMY = 'THE RED RIVAL SPIRIT (the enemy crowd that charges at the player\'s blue spirits): the SAME tiny round jelly-drop body, size and proportions as the blue SUMUS spirit in "74-1.png", but a glossy coral-red to cherry-red body, a small pointed flame-like tip on its head instead of the curl, two short determined eyebrows over big shiny dark eyes and a cheeky grin. Mischievous and cute, never scary. Readable at 24 pixels.';
const THEMES = 'The four road themes of the game are: SKY BRIDGE (honey wood, cream and gold, sky crystals), SUNNY DESERT (warm sandstone, turquoise), ICE CANYON (pale blue ice, snow), VOLCANO (dark plum basalt with glowing orange cracks). Match the colors of the theme props in "74-7.png", "74-9.png", "74-11.png" and "74-13.png".';

// 시트: no · ko(한국어 이름) · head · cells [[cell, key, 이름, kind, [저장 w, h], 설명, 옵션]] · refs(Drive 참고 그림).
export const SHEETS = [
  { no: '75-1', ko: '적 정령(달리기 · 맞음 · 쓰러짐 · 적 대장)', head: CUT, refs: [R74('74-1'), REF_PET, REF_FLOOR], extra: [SPIRIT, ENEMY, CAMERA],
    cells: [
      ['TOP-LEFT', 'enemy-run', '달려오는 적 정령', 'cut', [160, 160], 'the red rival spirit RUNNING TOWARD the camera (it charges at the player), mid-stride with one foot up and arms pumping, leaning forward, face fully visible with a cheeky determined grin.'],
      ['TOP-RIGHT', 'enemy-hit', '맞은 적 정령', 'cut', [160, 160], 'the red rival spirit just BUMPED: squashed sideways, eyes squeezed shut, a little white star pop beside its head, arms flung out — funny, not hurt-looking.'],
      ['BOTTOM-LEFT', 'enemy-down', '쓰러진 적 정령', 'cut', [160, 160], 'the red rival spirit KNOCKED OVER, lying flat on its back with dizzy swirl eyes, tongue a little out and tiny stars circling above — comic and cute.'],
      ['BOTTOM-RIGHT', 'enemy-boss', '적 대장 정령', 'cut', [256, 256], 'the RED RIVAL CAPTAIN facing the camera: the same red spirit but twice as big and rounder, wearing a small golden crown-helmet with a red plume, a tiny round wooden shield on one arm, arms crossed confidently, proud grin. Clearly the leader of the red crowd, still cute.']
    ] },
  { no: '75-2', ko: '숫자 벽(하늘 수정 · 사막 사암 · 얼음 · 용암 바위)', head: CUT, refs: [R74('74-4', '74-7', '74-9', '74-11', '74-13'), REF_FLOOR], extra: [THEMES, CAMERA],
    cells: [
      ['TOP-LEFT', 'wall-sky', '하늘 수정 벽', 'cut', [448, 224], 'a NUMBER WALL block for the SKY BRIDGE theme, standing across the road and facing the camera, showing a little of its top: a wide low wall (about 460×230 pixels) of pale cream stone bricks with sky-blue crystal studs along the top edge and golden corner caps. In the middle of its front there is a big smooth, flat, lighter rounded-rectangle panel (the game prints the wall\'s hit-point number there — keep that panel completely empty). The left and right ends are straight and tidy so several blocks can stand side by side.'],
      ['TOP-RIGHT', 'wall-desert', '사막 사암 벽', 'cut', [448, 224], 'the same NUMBER WALL shape and size for the SUNNY DESERT theme: warm carved sandstone blocks with turquoise tile stripes and a little sand piled at the base, the same empty flat lighter panel in the middle front.'],
      ['BOTTOM-LEFT', 'wall-ice', '얼음 벽', 'cut', [448, 224], 'the same NUMBER WALL shape and size for the ICE CANYON theme: glossy pale-blue ice bricks with a snowy top and small icicles, the same empty flat lighter (frosted white) panel in the middle front.'],
      ['BOTTOM-RIGHT', 'wall-volcano', '용암 바위 벽', 'cut', [448, 224], 'the same NUMBER WALL shape and size for the VOLCANO theme: chunky dark-plum basalt blocks with thin glowing orange cracks, the same empty flat lighter (warm gray) panel in the middle front. No pure black anywhere.']
    ] },
  { no: '75-3', ko: '벽 깨진 조각(하늘 · 사막 · 얼음 · 용암)', head: CUT, refs: [R74('74-5'), 'the effect material sheet "71-4.png" (rocks) in the folder "SUMUS 펫 아레나 71 (Runner용)"'], extra: [THEMES, CAMERA],
    cells: [
      ['TOP-LEFT', 'wall-chunk-sky', '하늘 벽 조각', 'cut', [128, 128], 'a BROKEN WALL CHUNK flying apart from the sky wall: an angular piece of cream stone brick with a sky-blue crystal shard stuck in it, light top face, about 260 pixels across.'],
      ['TOP-RIGHT', 'wall-chunk-desert', '사막 벽 조각', 'cut', [128, 128], 'a BROKEN WALL CHUNK from the desert wall: an angular piece of warm sandstone with a bit of turquoise tile, light top face, about 260 pixels across.'],
      ['BOTTOM-LEFT', 'wall-chunk-ice', '얼음 벽 조각', 'cut', [128, 128], 'a BROKEN WALL CHUNK from the ice wall: a glossy jagged pale-blue ice shard with a snowy edge and a white shine streak, about 260 pixels across.'],
      ['BOTTOM-RIGHT', 'wall-chunk-volcano', '용암 벽 조각', 'cut', [128, 128], 'a BROKEN WALL CHUNK from the volcano wall: an angular dark-plum basalt piece with one glowing orange crack, about 260 pixels across. No pure black (darkest color deep plum).']
    ] },
  { no: '75-4', ko: '좁은 다리 · 부서진 판자 · 낭떠러지 가장자리', head: CUT, refs: [R74('74-7', '74-6'), REF_FLOOR], extra: [CAMERA],
    cells: [
      ['TOP-LEFT', 'bridge-narrow', '좁은 다리 길 타일', 'tile', [256, 256], 'NARROW ROPE BRIDGE: short honey-colored wooden planks laid crosswise with small gaps, tied together by two thick cream ropes running straight down the left and right edges of the patch, a few tiny knots.'],
      ['TOP-RIGHT', 'plank-broken', '부서진 판자', 'cut', [256, 160], 'BROKEN BRIDGE PLANKS falling away: three short honey-wood planks snapped in the middle with splintered ends and a frayed bit of rope, tumbling in the air, seen from behind and above, about 420×260 pixels in total.'],
      ['BOTTOM-LEFT', 'cliff-edge', '낭떠러지 가장자리', 'cut', [448, 192], 'a CLIFF EDGE where the road suddenly ends: seen from behind and above, the broken front lip of a stone-and-wood road (about 460 pixels wide) with crumbled bricks and a few dangling roots, and the rocky underside of the road disappearing downward into soft white cloud mist. Only the edge piece, no sky or scenery behind it.'],
      ['BOTTOM-RIGHT', 'bridge-post', '좁은 다리 밧줄 기둥', 'cut', [96, 256], 'a ROPE BRIDGE POST: a short sturdy wooden post about 380 pixels tall with a cream rope wound around its top and one rope end hanging down, a small golden cap, front view.']
    ] },
  { no: '75-5', ko: '성 수비(탑 대포 · 방패 정령 · 깃발 · 대포알)', head: CUT, refs: [R74('74-5', '74-7', '74-1'), REF_PET], extra: [ENEMY, CAMERA],
    cells: [
      ['TOP-LEFT', 'tower-cannon', '성 탑 대포', 'cut', [256, 256], 'a CASTLE TOWER CANNON seen from the front (it stands on the castle wall and shoots back at the player): a short round stone turret with a chunky red-and-gold cannon barrel pointing toward the camera and a little downward, a red pennant on top. No pure black inside the barrel mouth (use deep plum).'],
      ['TOP-RIGHT', 'shield-guard', '방패 정령', 'cut', [192, 192], 'a red rival spirit GUARD facing the camera, crouching behind a big round red-and-gold shield with a star emblem that covers most of its body, only its determined eyes and head tip peeking over the top.'],
      ['BOTTOM-LEFT', 'castle-flag', '성 깃발', 'cut', [128, 256], 'a CASTLE FLAG: a slim golden pole about 380 pixels tall with a big waving red-and-cream swallow-tail banner near the top, a round golden knob, front view.'],
      ['BOTTOM-RIGHT', 'cannon-ball', '적 대포알', 'cut', [96, 96], 'an ENEMY CANNONBALL: a round glossy dark-red ball with a soft pink highlight, a tiny golden band and a small cartoon spark fuse on top, about 200 pixels across. No pure black.']
    ] },
  { no: '75-6', ko: '피버 · 충돌 연출(글자 판 · 빛 띠 · 무리 빛 · 충돌 빛)', head: BLACK, refs: [REF_FX, REF_MAT, R74('74-3', '74-5')], extra: [],
    cells: [
      ['TOP-LEFT', 'fever-plate', '피버 큰 글자 판', 'cut', [448, 224], 'a big FEVER BANNER PLATE (solid object, not glow): a wide rounded ribbon-shaped plate about 460×230 pixels in shiny gold with a hot-pink and orange gradient inner panel, little star rivets and two short ribbon tails. The inner panel is EMPTY and smooth (the game writes the word on it). No pure black inside it; darkest colors are deep plum.'],
      ['TOP-RIGHT', 'light-band', '빛 띠', 'add', [512, 128], 'a long horizontal LIGHT BAND: a thin streak of white-hot light with a soft golden-pink glow fading out at both ends and above and below, about 480 pixels wide and 80 pixels tall, a few tiny sparkles along it.'],
      ['BOTTOM-LEFT', 'fever-aura', '피버 무리 빛', 'add', [256, 256], 'a FEVER AURA: a soft round glowing ring of rainbow light (gold, pink, sky blue) with a brighter rim and short flame-like rays pointing outward, empty and dark in the very center, about 420 pixels across, seen slightly from above like a glow on the ground.'],
      ['BOTTOM-RIGHT', 'clash-burst', '충돌 빛', 'add', [256, 256], 'a CLASH BURST where the blue crowd and the red crowd collide: a white-hot center flash split into a sky-blue half on the left and a coral-red half on the right, sharp comic-style spikes and a ring of sparks flying outward, about 420 pixels across.']
    ] }
];

export const isBg = () => false;
export const promptOf = s => {
  const kinds = [...new Set(s.cells.map(c => c[3]))].filter(k => KIND_NOTE[k]);
  const lines = [s.head, STYLE, NO_COPY, ...s.extra, STYLE_REF(s.refs.join(', ')), ...kinds.map(k => KIND_NOTE[k])];
  for (const [cell, , , kind, , text] of s.cells) lines.push(`${cell}: ${text}${kinds.length > 1 ? ` [${kind === 'add' ? 'glowing on black' : kind === 'tile' ? 'road tile' : 'solid object'}]` : ''}`);
  lines.push(DONE(s.no));
  return lines.join('\n');
};
export const ITEMS = SHEETS.flatMap(s => s.cells.map(([cell, key, name, kind, size, , opt]) => ({ sheet: s, cell, key, name, kind, size, hollow: !!opt?.hollow })));
export const splitName = s => `${s.no} 펫 대행진 ${s.ko.split('(')[0].trim()}.txt`;

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const all = SHEETS.map(s => `### ${s.no} ${s.ko}\n${promptOf(s)}`).join('\n\n');
  writeFileSync(resolve(here, LIST), all + '\n');
  const splitDir = resolve(here, 'split');
  mkdirSync(splitDir, { recursive: true });
  for (const f of readdirSync(splitDir).filter(f => /^75-\d+ /.test(f))) unlinkSync(resolve(splitDir, f));
  for (const s of SHEETS) writeFileSync(resolve(splitDir, splitName(s)), promptOf(s) + '\n');
  const csvPath = resolve(here, 'slice-map.csv');
  const rows = readFileSync(csvPath, 'utf8').split('\n').filter(l => l && !l.startsWith(`"${LIST}"`));
  let no = Math.max(...rows.slice(1).map(l => Number(l.split('","')[1]) || 0));
  const KO_CELL = { 'TOP-LEFT': '왼쪽 위', 'TOP-RIGHT': '오른쪽 위', 'BOTTOM-LEFT': '왼쪽 아래', 'BOTTOM-RIGHT': '오른쪽 아래' };
  const add = SHEETS.map(s => ++no && ITEMS.filter(x => x.sheet === s).map(x => `"${LIST}","${String(no).padStart(3, '0')}","${s.no} ${s.ko}","${KO_CELL[x.cell]}","runner-${x.key}","${x.name} (${x.kind} · ${x.size.join('×')})","public/assets/runner/${x.key}.webp"`)).flat();
  writeFileSync(csvPath, [...rows, ...add].join('\n') + '\n');
  console.log(`[75] 시트 ${SHEETS.length}장 · 그림 ${ITEMS.length}장 · slice-map ${add.length}줄`);
}
