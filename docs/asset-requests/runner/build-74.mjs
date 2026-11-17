// 그림 주문서 74: 펫 대행진(크라우드 러너) 그림 44장 · 14시트(구성안 docs/pet-runner-plan.md 10장).
//   node docs/asset-requests/runner/build-74.mjs
// 만드는 것: 74-pet-runner.txt(전체), split/ 시트별 파일, slice-map.csv의 74 줄(있으면 바꿔 쓴다).
//   (build-runner.mjs는 26번 이후를 모르므로 돌리지 않는다: slice-map.csv 뒤쪽이 지워진다.)
// 시점: 시험 페이지(public/proto/runner-fx.html, docs/screenshots/runner-fx-*.jpg)와 같다 — 카메라가 정령 무리 **뒤에서 비스듬히 내려다본다**.
//   길은 화면 아래 가운데에서 위쪽 지평선(화면 위에서 약 26%)으로 좁아지고, 문 · 바위 · 성은 길 위에서 카메라 쪽을 본다.
// 칸의 처리 방법(kind) — 자르기는 slice-74.mjs가 한다:
//   cut  — 투명 배경(진짜 알파)의 물체. 투명을 못 만들면 **순수 흰 배경**(검정 시트는 **순수 검정**)에 그리고, 자를 때 가장자리에서 이어진 배경만 뺀다.
//          hollow 칸(수정 감옥)은 안쪽 구멍의 배경도 뺀다.
//   add  — 검은 배경 위 빛(문 판 · 통과 빛 · 발사 빛). 게임이 더하기 섞기(lighter)로 그려 검정은 사라진다. 오려 내지 않는다.
//   tile — 길 타일: 위에서 똑바로 내려다본 판자 · 돌길 무늬. 자를 때 위아래가 이어지게 이음매를 섞는다.
//   bg   — 세로 한 장(1024×1536, 투명 아님) 배경. 앱에는 720×1080.
// 넣는 곳: public/assets/runner/<이름>.webp → npm run build:assets가 public/modules/runner-art.js의 RUNNER_ART에 이름을 적고,
//   게임은 RUNNER_ART에 있는 이름만 불러온다(없으면 지금의 코드 그림 그대로, 404 없음, 코드 등록 필요 없음).
// CLAUDE.md 그림 주문서 규칙 두 가지를 시트마다 넣는다:
//   ① Google Drive의 기존 그림(펫 07a-1 · 아레나 65 · 66 · 71)을 열어 그림체를 맞추라 ② 정해진 Drive 폴더에 정확한 파일 이름으로 저장하라.
import { readFileSync, writeFileSync, mkdirSync, readdirSync, unlinkSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
export const DRIVE = 'SUMUS 펫 대행진 74 (Runner용)';
export const LIST = '74-pet-runner.txt';

export const NO_TEXT = 'No text, no letters, no numbers, no watermark, no logo, no frames, no borders, no grid lines. Do not ask me any questions; just generate the image.';
export const CUT = `Create ONE square image, 1024×1024 pixels, laid out as a 2×2 grid: four separate game pictures, one centered in each quarter (each quarter is 512×512). TRANSPARENT background (real alpha). If you cannot make a transparent background, use a perfectly flat PURE WHITE (#FFFFFF) background instead — never a checkerboard pattern, never a gradient, scenery, floor, cast shadow or ground. Every picture stays inside its own quarter with at least 40 pixels of empty background before the middle lines and the image edges, so each quarter can be cut out cleanly. Every object has a clean, slightly darker outline so it separates from the background. ${NO_TEXT}`;
export const BLACK = `Create ONE square image, 1024×1024 pixels, laid out as a 2×2 grid: four separate game pictures, one centered in each quarter (each quarter is 512×512). The WHOLE background is PURE BLACK (#000000), flat, with no texture, no vignette, no gradient, no stars, no noise. Every picture fades out or ends at least 40 pixels before the middle lines and the image edges, so each quarter can be cut out cleanly. ${NO_TEXT}`;
const BG = `Create ONE tall image, 1024 pixels wide and 1536 pixels tall (portrait, 2:3), opaque (NOT transparent), filled edge to edge. It is the BACKGROUND behind a running game track, seen from the same camera as the game: behind and above a crowd, looking forward and slightly down. The HORIZON is a soft line about 26% from the top. The game draws the long road, the characters, gates and the castle ON TOP of this picture, so do NOT draw any road, bridge, path, rails, castle, building in the center, character, creature or pet. Keep the central vertical band (the middle 40% of the width, from the horizon down) calm and simple so the road reads clearly on top; put the interesting scenery on the left and right sides and far away at the horizon. ${NO_TEXT}`;
export const STYLE = 'Style: premium glossy 3D-rendered mobile game art, cute and lovable for elementary and middle school kids, soft rounded shapes, bright saturated but clean colors, gentle studio lighting from the upper left, crisp edges, readable when small on a phone. Original SUMUS pet-world designs only (sky bridges, little spirits, crystals, castles): do NOT copy or resemble any picture, character, creature, building, map, icon or logo from any other game (for example Last War, Count Masters, Mob Control or any other crowd-runner game), anime, cartoon or movie. Nothing scary, gory or violent; obstacles look like playful toys.';
export const CAMERA = 'Camera: like the game screen — seen from behind and above at about 35 degrees, looking forward down a long road that narrows toward the horizon (objects on the road face the camera and show a little of their top).';
export const STYLE_REF = refs => `STYLE REFERENCE — before drawing, open the existing pictures already in Google Drive and match their art style, rendering quality, outline thickness, color clarity and finish exactly: ${refs}. If a folder is not there, search Google Drive for those exact file names. Do NOT make it softer, blurrier, flatter or more watercolor-like than the references.`;
export const REF_PET = 'the pet picture "07a-1.png" in the folder "SUMUS 전설 펫 07 (Runner용)"';
export const REF_FLOOR = 'the arena floor "65-2.png" in the folder "SUMUS 펫 아레나 65 (Runner용)"';
export const REF_FX = 'the arena effect sheet "66-1.png" in the folder "SUMUS 펫 아레나 66 (Runner용)"';
export const REF_MAT = 'the effect material sheet "71-1.png" in the folder "SUMUS 펫 아레나 71 (Runner용)"';
const DONE = n => `WHEN DONE — upload the finished PNG to Google Drive, into the folder "${DRIVE}", named exactly "${n}.png" (if a file with that name is already there, replace it; if the folder does not exist, create it). Actually save the file to Google Drive; showing the picture in the chat is not enough.`;
export const KIND_NOTE = {
  cut: 'SOLID OBJECT with a clean crisp silhouette on the empty background (the game cuts the background away).',
  add: 'GLOWING light on black: the game draws it with additive blending, so black = invisible. Bright white-hot center, saturated colored glow fading smoothly to black; no hard dark outline.',
  tile: 'ROAD TILE: a flat SQUARE texture patch about 440×440 pixels in the middle of its quarter, seen from DIRECTLY ABOVE (no perspective, no shadows from outside, no objects on it). The road runs from the top edge of the patch to the bottom edge, its side trims run straight down the left and right edges of the patch, and the pattern repeats so the top edge continues seamlessly into the bottom edge.'
};
export const SPIRIT = 'THE SUMUS SPIRIT (the little hero that forms the running crowd): a tiny round jelly-drop spirit about as tall as it is wide, glossy sky-blue body with a soft white belly highlight and a little curled tip on the top of its head like a water drop, two big shiny dark-navy eyes with white sparkles, small rosy cheeks, tiny nub arms and two tiny round feet. Simple enough to read at 24 pixels; the same spirit, same size and same proportions in every quarter.';

// 시트: no · ko(한국어 이름) · head · cells [[cell, key, 이름, kind, [저장 w, h], 설명, 옵션]] · refs(Drive 참고 그림).
// key는 public/assets/runner/<key>.webp 이름이고 구성안 10장의 칸 이름 그대로다.
export const SHEETS = [
  { no: '74-1', ko: '정령(달리기 · 날아감 · 만세 · 튕김)', head: CUT, refs: [REF_PET, REF_FLOOR], extra: [SPIRIT, CAMERA],
    cells: [
      ['TOP-LEFT', 'spirit-run', '달리는 정령', 'cut', [160, 160], 'the spirit RUNNING AWAY from the camera, seen from behind and above, mid-stride with one foot up and arms swinging, head turned a little so one cheek and one eye peek out.'],
      ['TOP-RIGHT', 'spirit-fly', '날아가는 정령', 'cut', [160, 160], 'the spirit FLYING happily through the air toward the camera after a cannon launch, body stretched like a little comet, arms forward, delighted open-mouth smile, two short white speed streaks behind it.'],
      ['BOTTOM-LEFT', 'spirit-cheer', '만세하는 정령', 'cut', [160, 160], 'the spirit CHEERING, facing the camera, both arms up, eyes closed in happy arcs, big smile, a tiny hop (feet off the ground).'],
      ['BOTTOM-RIGHT', 'spirit-hurt', '튕겨 나간 정령', 'cut', [160, 160], 'the spirit BOUNCED BACK by an obstacle: tumbling backwards, dizzy swirl eyes, little sweat drop, squashed body — funny and cute, not hurt-looking.']
    ] },
  { no: '74-2', ko: '정령 스킨(금 · 잎 · 얼음 · 불꽃)', head: CUT, refs: [REF_PET, REF_FLOOR, 'the spirit sheet "74-1.png" in the folder "SUMUS 펫 대행진 74 (Runner용)" (draw it first)'], extra: [SPIRIT, CAMERA],
    cells: [
      ['TOP-LEFT', 'skin-gold', '금빛 정령', 'cut', [160, 160], 'the GOLD SKIN spirit, exactly the "running away" pose of 74-1: shiny polished gold body with warm highlights, a tiny crown-shaped tip on its head and a few small twinkles.'],
      ['TOP-RIGHT', 'skin-leaf', '새싹 정령', 'cut', [160, 160], 'the LEAF SKIN spirit, same running pose: fresh spring-green jelly body with a two-leaf sprout growing from the top of its head.'],
      ['BOTTOM-LEFT', 'skin-ice', '얼음 정령', 'cut', [160, 160], 'the ICE SKIN spirit, same running pose: pale icy-cyan glassy body with a small crystal tip on its head and frosty white sparkles.'],
      ['BOTTOM-RIGHT', 'skin-flame', '불꽃 정령', 'cut', [160, 160], 'the FLAME SKIN spirit, same running pose: warm orange-red jelly body with a little curling flame tuft on its head and a golden glow on the cheeks.']
    ] },
  { no: '74-3', ko: '숫자 문(좋은 문 판 · 나쁜 문 판 · 가운데 기둥 · 통과 빛)', head: BLACK, refs: [REF_FX, REF_MAT, REF_FLOOR], extra: [CAMERA],
    cells: [
      ['TOP-LEFT', 'gate-good', '좋은 문 판(파랑)', 'add', [384, 272], 'a GOOD GATE PANEL facing the camera: a wide glowing rectangle of soft sky-blue light (about 440×310 pixels) with rounded corners, a brighter glowing rim, a gentle shimmer of light waves inside and a few tiny sparkles. The middle stays fairly calm and dim so a big number can be printed on it by the game.'],
      ['TOP-RIGHT', 'gate-bad', '나쁜 문 판(빨강)', 'add', [384, 272], 'a BAD GATE PANEL, the exact same shape and size as the good panel, but in warm coral-red light with a brighter red rim and a few tiny sparks. The middle stays calm and dim for a number.'],
      ['BOTTOM-LEFT', 'gate-frame', '문 가운데 기둥 · 위 장식', 'cut', [192, 384], 'the GATE CENTER PILLAR standing between the two panels: a slim white-and-gold crystal pillar about 360 pixels tall with a round glowing sky-crystal ornament and two little golden wings on top. Solid object (no glow halo); no pure black inside it, its darkest shadows are deep navy.'],
      ['BOTTOM-RIGHT', 'gate-burst', '문 통과 빛', 'add', [256, 256], 'a GATE PASS BURST: a bright white-gold flash with soft rays and a ring of tiny sparkles flying outward, like light bursting as the crowd runs through a gate, about 420 pixels across.']
    ] },
  { no: '74-4', ko: '장애물(숫자 바위 · 톱날 · 망치 · 빈 수정 감옥)', head: CUT, refs: [REF_FLOOR, REF_PET, 'the effect material sheet "71-4.png" (rocks) in the folder "SUMUS 펫 아레나 71 (Runner용)"'], extra: [CAMERA],
    cells: [
      ['TOP-LEFT', 'rock-num', '숫자 바위', 'cut', [256, 240], 'a NUMBER BOULDER standing on the road, facing the camera: a chunky rounded warm-gray stone block with a few cute cracks and moss specks, and a big smooth, flat, lighter oval face in the middle of its front (the game prints the hit-point number there — keep that face completely empty).'],
      ['TOP-RIGHT', 'saw', '굴러다니는 톱날', 'cut', [256, 256], 'a ROLLING SAW TOY standing upright on its edge, facing the camera: a round candy-colored disc with soft rounded teeth (silver rim, red-and-white center like a peppermint, a shiny bolt in the middle). Playful, not sharp-looking or dangerous.'],
      ['BOTTOM-LEFT', 'hammer', '흔들리는 망치', 'cut', [192, 288], 'a SWINGING GIANT MALLET hanging straight down: a long golden pole from the top, a big rounded wooden-and-gold mallet head at the bottom (head about 300 pixels wide), seen from the front and slightly above. Toy-like and friendly.'],
      ['BOTTOM-RIGHT', 'crystal', '빈 수정 감옥', 'cut', [256, 288], 'an EMPTY CRYSTAL PRISON standing on the road: a ring of tall faceted violet-blue crystal spikes around an OPEN HOLLOW center, like a crystal crown cage about 400 pixels tall. The center inside the crystals is completely empty background (the game draws a trapped pet inside and a glass tint over it), so do not fill it.', { hollow: true }]
    ] },
  { no: '74-5', ko: '대포 · 성 조각(대포 · 발사 빛 · 성 파편 2)', head: BLACK, refs: [REF_FLOOR, REF_FX, REF_MAT], extra: [CAMERA],
    cells: [
      ['TOP-LEFT', 'cannon', '정령 대포', 'cut', [256, 256], 'a cute chunky SPIRIT CANNON on two big round wooden wheels, seen from BEHIND and above, its sky-blue-and-gold barrel pointing away from the camera and a little upward (toward a castle far ahead), a round crystal on top. Solid object; no pure black anywhere inside it (darkest shadows are deep navy or dark brown).'],
      ['TOP-RIGHT', 'cannon-fire', '대포 발사 빛', 'add', [256, 256], 'a CANNON MUZZLE BLAST seen from behind: a round white-hot flash with short golden spiky rays and a soft sky-blue glow, about 400 pixels across.'],
      ['BOTTOM-LEFT', 'castle-chunk-a', '성 파편 A', 'cut', [128, 128], 'a CASTLE WALL CHUNK flying apart: an angular broken block of beige castle stone with two or three bricks visible and a light top face, about 260 pixels across. No pure black inside (darkest outline dark brown).'],
      ['BOTTOM-RIGHT', 'castle-chunk-b', '성 파편 B', 'cut', [128, 128], 'a different CASTLE CHUNK: a small broken piece of tower with a bit of blue roof tile on top and beige stone below, about 240 pixels across. No pure black inside.']
    ] },
  { no: '74-6', ko: '하늘 다리 배경(한 장)', head: BG, refs: [REF_FLOOR, REF_PET], extra: [],
    cells: [['ONE IMAGE', 'bg-sky', '하늘 다리 배경', 'bg', [720, 1080], 'THEME SKY BRIDGE: a bright morning sky, soft blue at the top fading to warm cream near the horizon, big fluffy white cumulus clouds on both sides, a gentle sun glow at the upper right. Below the horizon a SEA OF CLOUDS stretches far away, with two or three tiny floating grassy islands and a faint rainbow on the left and right far in the distance.']] },
  { no: '74-7', ko: '하늘 다리 소품(길 타일 · 난간 기둥 · 구름 섬 · 하늘 성)', head: CUT, refs: [REF_FLOOR, REF_PET, 'the sky background "74-6.png" in the folder "SUMUS 펫 대행진 74 (Runner용)" (match its colors)'], extra: [CAMERA],
    cells: [
      ['TOP-LEFT', 'road-sky', '하늘 다리 길 타일', 'tile', [256, 256], 'SKY BRIDGE ROAD: warm honey-colored wooden planks laid crosswise, each plank with soft wood grain and tiny nail dots, a cream-and-gold trim running down both sides.'],
      ['TOP-RIGHT', 'post-sky', '하늘 다리 난간 기둥', 'cut', [96, 256], 'a SKY BRIDGE RAILING POST: a slim cream-white post about 380 pixels tall with gold bands and a round shiny golden knob on top, front view.'],
      ['BOTTOM-LEFT', 'cloud-isle', '구름 섬', 'cut', [384, 256], 'a small FLOATING CLOUD ISLAND for decoration beside the road: a fluffy white cloud base with a little grassy top, two round trees and a tiny crystal, about 420×280 pixels.'],
      ['BOTTOM-RIGHT', 'castle-sky', '하늘 성', 'cut', [512, 512], 'the SKY CASTLE (the end-of-stage siege target), front view slightly from above: white stone walls, three round towers with sky-blue cone roofs and golden flags, a big arched wooden gate in the middle, cloud puffs around its base. It fills about 440×440 pixels and the whole castle is inside the quarter (the game cuts it into 30 pieces when it collapses).']
    ] },
  { no: '74-8', ko: '사막 배경(한 장)', head: BG, refs: [REF_FLOOR, 'the sky background "74-6.png" in the folder "SUMUS 펫 대행진 74 (Runner용)" (same camera and horizon)'], extra: [],
    cells: [['ONE IMAGE', 'bg-desert', '사막 배경', 'bg', [720, 1080], 'THEME SUNNY DESERT: a warm apricot-and-turquoise sky with a big soft sun, smooth golden sand dunes rolling to the horizon, tall red-sandstone mesas far away on the left and right, a small oasis with palm trees in the far distance, light sand haze near the horizon.']] },
  { no: '74-9', ko: '사막 소품(길 타일 · 기둥 · 모래 소용돌이 · 사막 성)', head: CUT, refs: [REF_FLOOR, 'the desert background "74-8.png" and the props "74-7.png" in the folder "SUMUS 펫 대행진 74 (Runner용)" (same sizes and finish)'], extra: [CAMERA],
    cells: [
      ['TOP-LEFT', 'road-desert', '사막 길 타일', 'tile', [256, 256], 'DESERT ROAD: warm sandstone paving bricks with soft sand in the gaps and a few tiny pebbles, darker carved sandstone trim running down both sides.'],
      ['TOP-RIGHT', 'post-desert', '사막 기둥', 'cut', [96, 256], 'a DESERT POST: a slim carved sandstone pillar about 380 pixels tall with turquoise stripes and a round turquoise gem on top, front view.'],
      ['BOTTOM-LEFT', 'sand-whirl', '모래 소용돌이', 'cut', [192, 288], 'a SAND WHIRL obstacle: a small cute twisting tornado of golden sand, narrow at the bottom and wider at the top, with a few pebbles and swirl lines, about 380 pixels tall. Solid-looking (no transparent haze).'],
      ['BOTTOM-RIGHT', 'castle-desert', '사막 성', 'cut', [512, 512], 'the DESERT PALACE (siege target), front view slightly from above: sandstone walls, round towers with turquoise-and-gold onion domes, a big arched gate in the middle, palm trees at its sides. About 440×440 pixels, the whole palace inside the quarter.']
    ] },
  { no: '74-10', ko: '얼음 협곡 배경(한 장)', head: BG, refs: [REF_FLOOR, 'the sky background "74-6.png" in the folder "SUMUS 펫 대행진 74 (Runner용)" (same camera and horizon)'], extra: [],
    cells: [['ONE IMAGE', 'bg-ice', '얼음 협곡 배경', 'bg', [720, 1080], 'THEME ICE CANYON: a pale lavender-and-mint sky with a soft aurora ribbon, tall glossy blue-white ice cliffs on the left and right sides, snowy ledges, a frozen river and snowy pine trees far below, gentle falling snow sparkles.']] },
  { no: '74-11', ko: '얼음 소품(길 타일 · 기둥 · 미끄럼 판 · 얼음 성)', head: CUT, refs: [REF_FLOOR, 'the ice background "74-10.png" and the props "74-7.png" in the folder "SUMUS 펫 대행진 74 (Runner용)" (same sizes and finish)'], extra: [CAMERA],
    cells: [
      ['TOP-LEFT', 'road-ice', '얼음 길 타일', 'tile', [256, 256], 'ICE ROAD: frosted pale-blue ice bricks with shiny highlights and a little snow in the gaps, fluffy snow trim running down both sides.'],
      ['TOP-RIGHT', 'post-ice', '얼음 기둥', 'cut', [96, 256], 'an ICE POST: a slim clear-blue ice crystal pillar about 380 pixels tall with a snowy cap and a sparkling six-point crystal on top, front view.'],
      ['BOTTOM-LEFT', 'ice-slide', '미끄럼 얼음 판', 'cut', [320, 224], 'a SLIPPERY ICE PATCH lying flat on the road, seen from behind and above: a wide glossy oval of bright cyan ice with white shine streaks and a frosty rim, about 420×290 pixels.'],
      ['BOTTOM-RIGHT', 'castle-ice', '얼음 성', 'cut', [512, 512], 'the ICE CASTLE (siege target), front view slightly from above: translucent-looking blue-white ice walls, pointed crystal towers with snow caps, a big arched gate in the middle, icicles on the walls. About 440×440 pixels, the whole castle inside the quarter.']
    ] },
  { no: '74-12', ko: '화산 배경(한 장)', head: BG, refs: [REF_FLOOR, 'the sky background "74-6.png" in the folder "SUMUS 펫 대행진 74 (Runner용)" (same camera and horizon)'], extra: [],
    cells: [['ONE IMAGE', 'bg-volcano', '화산 배경', 'bg', [720, 1080], 'THEME VOLCANO: a warm sunset sky in orange, pink and purple with soft ash clouds, rounded dark-purple volcanic rock islands on the left and right, a friendly round volcano far away puffing a heart-shaped-ish smoke cloud, glowing orange lava rivers far below. Exciting but cute, not scary or dark.']] },
  { no: '74-13', ko: '화산 소품(길 타일 · 기둥 · 불기둥 · 화산 성)', head: CUT, refs: [REF_FLOOR, REF_FX, 'the volcano background "74-12.png" and the props "74-7.png" in the folder "SUMUS 펫 대행진 74 (Runner용)" (same sizes and finish)'], extra: [CAMERA],
    cells: [
      ['TOP-LEFT', 'road-volcano', '화산 길 타일', 'tile', [256, 256], 'VOLCANO ROAD: dark plum-gray basalt tiles with thin glowing orange cracks between them, warm rock trim running down both sides. Not pure black anywhere.'],
      ['TOP-RIGHT', 'post-volcano', '화산 기둥', 'cut', [96, 256], 'a VOLCANO POST: a slim dark-plum obsidian pillar about 380 pixels tall with orange glowing veins and a round glowing lava-lamp orb on top, front view.'],
      ['BOTTOM-LEFT', 'fire-pillar', '불기둥', 'cut', [192, 320], 'a FIRE PILLAR obstacle: a round rock vent with a tall column of bright cartoon flame shooting up from it (yellow core, orange body, red tips), about 400 pixels tall, solid flame shapes with a clean outline (no smoke haze).'],
      ['BOTTOM-RIGHT', 'castle-volcano', '화산 성', 'cut', [512, 512], 'the VOLCANO FORTRESS (siege target), front view slightly from above: dark plum stone walls with warm orange glowing windows, chunky towers with red roofs and little lava drips, a big arched gate in the middle. Cute and toy-like, not scary. About 440×440 pixels, the whole fortress inside the quarter.']
    ] },
  { no: '74-14', ko: 'UI(지도 칸 · 반 보스 · 첫 판 상자 · 카드 테두리)', head: CUT, refs: [REF_PET, REF_FLOOR, 'the castle props "74-7.png" in the folder "SUMUS 펫 대행진 74 (Runner용)"'], extra: [],
    cells: [
      ['TOP-LEFT', 'map-node', '스테이지 지도 칸', 'cut', [160, 160], 'a STAGE MAP NODE seen from the front and a bit above: a round thick cream-and-gold button plate like a coin stand with a sky-blue gem rim and an EMPTY flat center (the game prints the stage number there).'],
      ['TOP-RIGHT', 'raid-boss', '주간 반 보스 성 아이콘', 'cut', [256, 256], 'a WEEKLY CLASS BOSS icon: a big stormy purple castle with a spiky crown-shaped top, two glowing yellow window-eyes and a red pennant, sitting on a small cloud, shown as a bold game icon.'],
      ['BOTTOM-LEFT', 'daily-chest', '오늘 첫 판 상자', 'cut', [256, 256], 'a DAILY FIRST-RUN CHEST: a closed rounded treasure chest of sky-blue wood with gold corners and a glowing sky-crystal lock, a few sparkles around it.'],
      ['BOTTOM-RIGHT', 'card-frame', '카드 테두리', 'cut', [256, 384], 'a PICK-A-CARD FRAME: a tall portrait card (about 300×450 pixels) with a rounded gold border, a small sky-blue gem at the top center, and a soft plain cream inner panel (EMPTY: the game prints the card icon and words there).']
    ] }
];

export const isBg = s => s.cells[0][3] === 'bg';
export const promptOf = s => {
  const kinds = [...new Set(s.cells.map(c => c[3]))].filter(k => KIND_NOTE[k]);
  const lines = [s.head, STYLE, ...s.extra, STYLE_REF(s.refs.join(', ')), ...(isBg(s) ? [] : kinds.map(k => KIND_NOTE[k]))];
  for (const [cell, , , kind, , text] of s.cells) lines.push(isBg(s) ? text : `${cell}: ${text}${kinds.length > 1 ? ` [${kind === 'add' ? 'glowing on black' : kind === 'tile' ? 'road tile' : 'solid object'}]` : ''}`);
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
  for (const f of readdirSync(splitDir).filter(f => /^74-\d+ /.test(f))) unlinkSync(resolve(splitDir, f));
  for (const s of SHEETS) writeFileSync(resolve(splitDir, splitName(s)), promptOf(s) + '\n');
  // slice-map.csv: 74 줄을 지우고 끝에 다시 붙인다(번호는 74를 뺀 마지막 번호 다음).
  const csvPath = resolve(here, 'slice-map.csv');
  const rows = readFileSync(csvPath, 'utf8').split('\n').filter(l => l && !l.startsWith(`"${LIST}"`));
  let no = Math.max(...rows.slice(1).map(l => Number(l.split('","')[1]) || 0));
  const KO_CELL = { 'TOP-LEFT': '왼쪽 위', 'TOP-RIGHT': '오른쪽 위', 'BOTTOM-LEFT': '왼쪽 아래', 'BOTTOM-RIGHT': '오른쪽 아래', 'ONE IMAGE': '한 장' };
  const add = SHEETS.map(s => ++no && ITEMS.filter(x => x.sheet === s).map(x => `"${LIST}","${String(no).padStart(3, '0')}","${s.no} ${s.ko}","${KO_CELL[x.cell]}","runner-${x.key}","${x.name} (${x.kind} · ${x.size.join('×')})","public/assets/runner/${x.key}.webp"`)).flat();
  writeFileSync(csvPath, [...rows, ...add].join('\n') + '\n');
  console.log(`[74] 시트 ${SHEETS.length}장 · 그림 ${ITEMS.length}장 · slice-map ${add.length}줄`);
}
