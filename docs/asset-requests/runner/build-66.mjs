// 그림 주문서 66: 펫 아레나 2탄 ② 스킬 연출 그림(구성안 docs/pet-arena-v2-plan.md 7장).
//   node docs/asset-requests/runner/build-66.mjs
// 만드는 것: 66-pet-arena-skills.txt, split/ 시트별 파일, slice-map.csv의 66 줄(있으면 바꿔 쓴다), CODEX_PROMPT_66.md.
//   (build-runner.mjs는 26번 이후를 모르므로 돌리지 않는다: slice-map.csv 뒤쪽이 지워진다.)
// 앱은 그림이 없어도 CSS 연출로 완성되어 보인다. 그림(public/assets/arena/<이름>.webp)이 들어오면 npm run build:assets가
//   public/modules/arena-art.js(ARENA_ART)에 이름을 적고, 같은 자리의 CSS 칸이 그 그림으로 바뀐다(코드 등록 필요 없음).
// CLAUDE.md 그림 주문서 규칙 두 가지를 시트마다 넣는다:
//   ① Drive의 기존 아레나 그림(65번)을 열어 그림체를 맞추라 ② 정해진 Drive 폴더에 정확한 파일 이름으로 저장하라.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
export const DRIVE = 'SUMUS 펫 아레나 66 (Runner용)';
export const DRIVE_65 = 'SUMUS 펫 아레나 65 (Runner용)';
const LIST = '66-pet-arena-skills.txt';

const SHEET = 'Create ONE square image, 1024×1024 pixels, laid out as a 2×2 sprite sheet: four separate illustrations, one centered in each quarter (each quarter is 512×512). Leave generous empty space around every illustration so nothing touches or crosses the middle lines or the image edges. Use a real transparent background (PNG alpha). Do NOT paint a checkerboard, white box, grid lines, frames or borders. No text, no letters, no numbers, no watermark. Do not ask me any questions; just generate the image.';
const TALL = 'Create ONE tall portrait image, 1024×1536 pixels, painted fully to every edge (no transparency, no border, no frame). No text, no letters, no numbers, no logos, no people, no characters, no creatures. Do not ask me any questions; just generate the image.';
const STYLE_FX = 'Style: premium glossy 3D-painted mobile game VFX, like the skill effects of a top cute pet battle game: rich saturated colors, bright glowing cores, crisp clean shapes with soft outer glow, strong contrast so it reads at 120 pixels on a phone, exciting and spectacular ("화끈하고 화려하게") but friendly, never scary or gory. Effects only: no pets, no creatures, no characters inside the effects.';
const STYLE_REF = `STYLE REFERENCE — before drawing, open the existing pet arena pictures (order 65) already in Google Drive and match their art style, rendering quality, color clarity and finish exactly: the folder "${DRIVE_65}" ("65-2.png" the cherry-blossom arena floor, "65-5.png" the VS background, "65-6.png" the banner and icon sheet). If that folder is not there, search Google Drive for the file names "65-2.png" and "65-6.png". The effects must look like they belong on that arena floor, seen from the same high camera angle. Do NOT make it softer, blurrier, foggier or more watercolor-like than the references.`;
const DONE = n => `WHEN DONE — upload the finished PNG to Google Drive, into the folder "${DRIVE}", named exactly "${n}.png" (if a file with that name is already there, replace it; if the folder does not exist, create it). Actually save the file to Google Drive; showing the picture in the chat is not enough.`;

// 시트: no · 이름 · 몸통 · 칸 [[cell, key, 이름, 크기]] · 자르기.
export const SHEETS = [
  { no: '66-1', ko: '긴 줄기 효과 4개(불 뿜기 · 물대포 · 번개 · 얼음 창)', head: SHEET, cut: '--trim --size 512',
    body: 'All four are LONG HORIZONTAL effects that start at the LEFT end (where the pet\'s mouth is) and shoot to the RIGHT, each about 480 pixels long and centered in its quarter, so the game can stretch and rotate them like a beam.',
    cells: [
      ['TOP-LEFT', 'fx-flame-breath', '불 뿜기', '512×256', 'a FLAME BREATH: three layered roaring fire streams (white-yellow core, orange middle, deep red edges) widening into a 60-degree cone toward the right, curling flame tongues, glowing embers and sparks.'],
      ['TOP-RIGHT', 'fx-water-jet', '물대포', '512×192', 'a WATER CANNON: a thick powerful straight jet of bright aqua-blue water with a white foamy core, spiral streaks, a big splash burst and flying droplets at the right end.'],
      ['BOTTOM-LEFT', 'fx-lightning', '번개', '512×128', 'a LIGHTNING BOLT: a bright white-gold zig-zag electric bolt with violet-blue glow, small forks and crackling sparks, thin and sharp.'],
      ['BOTTOM-RIGHT', 'fx-ice-spear', '얼음 창', '256×96', 'an ICE SPEAR: one sharp crystal-clear icy-blue javelin pointing to the right, faceted with white highlights, a short frosty trail of snowflakes behind it.']
    ] },
  { no: '66-2', ko: '덩어리 효과 4개(운석 · 바위 · 방울 보호막 · 치명타 별)', head: SHEET, cut: '--fit-each --size 256',
    body: 'Each effect is a compact round object centered in its quarter, about 80% of the quarter.',
    cells: [
      ['TOP-LEFT', 'fx-meteor', '운석', '256×256', 'a falling METEOR: a glowing molten rock fireball with cracks of orange lava, a short blazing fire tail toward the upper-left, seen from slightly above.'],
      ['TOP-RIGHT', 'fx-boulder', '굴러가는 바위', '256×256', 'a ROLLING BOULDER: a big round brown-gray rock with mossy spots and chips, a curved motion swoosh and a small dust cloud at the bottom.'],
      ['BOTTOM-LEFT', 'fx-bubble', '방울 보호막', '256×256', 'a BUBBLE SHIELD: a big transparent soap-bubble sphere with a rainbow-aqua rim highlight, a bright glossy window reflection on top-left, a few tiny bubbles around. The middle must stay see-through (a pet stands inside).'],
      ['BOTTOM-RIGHT', 'fx-crit', '치명타 별 터짐', '256×256', 'a CRITICAL HIT burst: a sharp bright yellow-white star explosion with eight spiky rays, a gold ring shock wave and tiny sparkles, very punchy.']
    ] },
  { no: '66-3', ko: '바닥 장판 4개(꽃잎 · 갈라진 땅 · 얼음판 · 독구름)', head: SHEET, cut: '--trim --size 384',
    body: 'All four are FLOOR AREA effects seen from the arena camera (high angle), so each is a WIDE ELLIPSE about twice as wide as tall (about 460×230 pixels) centered in its quarter. The edges fade softly into transparency.',
    cells: [
      ['TOP-LEFT', 'fx-petal-field', '꽃잎 회복장', '384×192', 'a HEALING PETAL FIELD: a soft glowing mint-green magic circle on the floor with pink and white flower petals swirling around its rim and small green plus-shaped sparkles.'],
      ['TOP-RIGHT', 'fx-crack-field', '지진 장판', '384×192', 'an EARTHQUAKE FIELD: cracked broken ground with glowing amber cracks, small rocks and pebbles popping up, a dusty brown rim.'],
      ['BOTTOM-LEFT', 'fx-ice-field', '얼음 장판', '384×192', 'an ICE FLOOR: a shiny slippery frozen sheet, pale cyan with white frost patterns at the rim, bright glints and a few small ice crystals.'],
      ['BOTTOM-RIGHT', 'fx-poison-cloud', '독구름', '384×256', 'a POISON CLOUD: a low puffy cloud of bright purple and toxic green gas with little bubbles and a few skull-free swirl marks (cute, not scary).']
    ] },
  { no: '66-4', ko: '덩굴 · 회오리 · 분신 별가루', head: SHEET, cut: '--fit-each --size 256',
    body: 'Three effects; the BOTTOM-RIGHT quarter stays completely EMPTY (transparent).',
    cells: [
      ['TOP-LEFT', 'fx-vine', '덩굴 묶기', '256×256', 'BINDING VINES: thick green vines with leaves and small thorns bursting up out of the ground and curling into a ring (a pet gets wrapped in the middle, so the middle is open), a few dirt chips.'],
      ['TOP-RIGHT', 'fx-tornado', '회오리 기둥', '256×384', 'a TORNADO: a tall spinning wind funnel (pale mint-white with green streaks), narrow at the bottom and wide at the top, leaves caught in the swirl. Taller than wide.'],
      ['BOTTOM-LEFT', 'fx-clone', '분신 별가루 테두리', '256×256', 'a CLONE AURA: a glowing ring outline of golden-violet star dust and tiny stars (a see-through pet copy stands inside, so the middle is open), soft shimmer.'],
      ['BOTTOM-RIGHT', '-', '(비움)', '', 'nothing: leave this quarter empty and transparent.']
    ] },
  { no: '66-5', ko: '친구 대전 대기실 배경', head: TALL, cut: '1080×720 → 720×1080 webp', single: 'lobby-bg', size: '720×1080',
    body: 'A FRIEND BATTLE LOBBY background for the same pet arena: a cozy locker-room / waiting room beside the arena, seen from the front: two team benches (blue on the left, red on the right) with soft spotlights, banners and confetti, a glowing doorway to the arena in the center top. TOP 0–14% and BOTTOM 70–100% stay calm and darker (game UI goes there). The middle stays open (the game places pet cards there).' },
  { no: '66-6', ko: '2:2 · 1:1:1 VS 화면 배경', head: TALL, cut: '1080×720 → 720×1080 webp', single: 'vs-2v2', size: '720×1080',
    body: 'A VS background for TEAM battles (2 vs 2, or three players): the same energy style as 65-5, but split into THREE colored energy zones meeting in the center (red-orange top-left, blue-cyan top-right, gold-green bottom), crackling white-gold seams between them, a bright empty burst in the exact center (the game writes "VS" there), and an empty glowing round pedestal in each zone (keep them empty).' },
  { no: '66-7', ko: '팀 깃발 2개(파랑 · 빨강)', head: SHEET, cut: '--fit-each --size 256',
    body: 'Two TEAM FLAG emblems in the game\'s glossy icon style (match the ribbons and icons of 65-6). The BOTTOM-LEFT and BOTTOM-RIGHT quarters stay completely EMPTY (transparent).',
    cells: [
      ['TOP-LEFT', 'team-blue', '파란 팀 깃발', '256×256', 'a BLUE TEAM flag: a waving royal-blue pennant on a short gold pole with a white star crest and a small wing motif, glossy, front view.'],
      ['TOP-RIGHT', 'team-red', '빨간 팀 깃발', '256×256', 'a RED TEAM flag: the same shape as the blue one but crimson-red with a white flame crest.'],
      ['BOTTOM-LEFT', '-', '(비움)', '', 'nothing: leave empty and transparent.'],
      ['BOTTOM-RIGHT', '-', '(비움)', '', 'nothing: leave empty and transparent.']
    ] }
];

export const promptOf = s => {
  const lines = [s.head, s.single ? 'Style: premium glossy 3D-painted mobile game background, rich clear colors, crisp clean shapes, same world as the pet arena references.' : STYLE_FX, STYLE_REF, s.body];
  if (s.cells) for (const [cell, , , , text] of s.cells) lines.push(`${cell}: ${text}`);
  lines.push(DONE(s.no));
  return lines.join('\n');
};
export const ITEMS = SHEETS.flatMap(s => s.single ? [{ sheet: s, cell: '한 장', key: s.single, name: s.ko, size: s.size }] : s.cells.filter(c => c[1] !== '-').map(([cell, key, name, size]) => ({ sheet: s, cell, key, name, size })));

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const all = SHEETS.map(s => `### ${s.no} ${s.ko}\n${promptOf(s)}`).join('\n\n');
  writeFileSync(resolve(here, LIST), all + '\n');
  mkdirSync(resolve(here, 'split'), { recursive: true });
  for (const s of SHEETS) writeFileSync(resolve(here, 'split', `${s.no} 펫 아레나 ${s.ko}.txt`), promptOf(s) + '\n');
  // slice-map.csv: 66 줄을 지우고 끝에 다시 붙인다(번호는 66을 뺀 마지막 번호 다음).
  const csvPath = resolve(here, 'slice-map.csv');
  const rows = readFileSync(csvPath, 'utf8').split('\n').filter(l => l && !l.startsWith(`"${LIST}"`));
  let no = Math.max(...rows.slice(1).map(l => Number(l.split('","')[1]) || 0));
  const KO_CELL = { 'TOP-LEFT': '왼쪽 위', 'TOP-RIGHT': '오른쪽 위', 'BOTTOM-LEFT': '왼쪽 아래', 'BOTTOM-RIGHT': '오른쪽 아래', '한 장': '한 장' };
  const add = SHEETS.map(s => ++no && ITEMS.filter(x => x.sheet === s).map(x => `"${LIST}","${String(no).padStart(3, '0')}","${s.no} ${s.ko}","${KO_CELL[x.cell]}","arena-${x.key}","${x.name} (${x.size})","public/assets/arena/${x.key}.webp"`)).flat();
  writeFileSync(csvPath, [...rows, ...add].join('\n') + '\n');
  console.log(`[66] 시트 ${SHEETS.length}장 · 그림 ${ITEMS.length}장 · slice-map ${add.length}줄`);
}
