// 그림 주문서 68: 펫 아레나 경기장 꾸미기 · 연습장 그림(구성안 docs/pet-arena-v2-plan.md 6장 7 · 8번, V13.235).
//   node docs/asset-requests/runner/build-68.mjs
// 만드는 것: 68-pet-arena-deco.txt, split/ 시트별 파일, slice-map.csv의 68 줄(있으면 바꿔 쓴다). CODEX_PROMPT_68.md는 손으로 쓴다.
//   (build-runner.mjs는 26번 이후를 모르므로 돌리지 않는다: slice-map.csv 뒤쪽이 지워진다.)
// 앱은 그림이 없어도 CSS 연출로 완성되어 보인다. 그림(public/assets/arena/<이름>.webp)이 들어오면 npm run build:assets가
//   public/modules/arena-art.js(ARENA_ART)에 이름을 적고, 같은 자리의 CSS 칸이 그 그림으로 바뀐다(코드 등록 필요 없음).
// CLAUDE.md 그림 주문서 규칙 두 가지를 시트마다 넣는다:
//   ① Drive의 기존 아레나 그림(65번)을 열어 그림체를 맞추라 ② 정해진 Drive 폴더에 정확한 파일 이름으로 저장하라.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
export const DRIVE = 'SUMUS 펫 아레나 68 (Runner용)';
export const DRIVE_66 = 'SUMUS 펫 아레나 66 (Runner용)';
export const DRIVE_65 = 'SUMUS 펫 아레나 65 (Runner용)';
const LIST = '68-pet-arena-deco.txt';

const SHEET = 'Create ONE square image, 1024×1024 pixels, laid out as a 2×2 sprite sheet: four separate illustrations, one centered in each quarter (each quarter is 512×512). Leave generous empty space around every illustration so nothing touches or crosses the middle lines or the image edges. Use a real transparent background (PNG alpha). Do NOT paint a checkerboard, white box, grid lines, frames or borders. No text, no letters, no numbers, no watermark. Do not ask me any questions; just generate the image.';
const TALL2 = 'Create ONE wide image, 1536×1536 pixels, split into TWO tall portrait pictures side by side (LEFT half and RIGHT half, each 768×1536) with a thin plain dark gap between them. Each half is painted fully to its edges (no transparency, no border, no frame). No text, no letters, no numbers, no logos, no people, no characters, no creatures. Do not ask me any questions; just generate the image.';
const TALL = 'Create ONE tall portrait image, 1024×1536 pixels, painted fully to every edge (no transparency, no border, no frame). No text, no letters, no numbers, no logos, no people, no characters, no creatures. Do not ask me any questions; just generate the image.';
const STYLE_FX = 'Style: premium glossy 3D-painted mobile game VFX, like the skill effects of a top cute pet battle game: rich saturated colors, bright glowing cores, crisp clean shapes with soft outer glow, strong contrast so it reads at 120 pixels on a phone, exciting and spectacular ("화끈하고 화려하게") but friendly, never scary or gory. Effects only: no pets, no creatures, no characters inside the effects.';
const STYLE_REF = `STYLE REFERENCE — before drawing, open the existing pet arena pictures already in Google Drive and match their art style, rendering quality, color clarity, camera angle and finish exactly: the folder "${DRIVE_65}" ("65-2.png" the cherry-blossom arena floor, "65-5.png" the VS background, "65-6.png" the banner and icon sheet) and the folder "${DRIVE_66}" ("66-1.png" … "66-4.png" the skill effects, "66-5.png" the lobby background). If those folders are not there, search Google Drive for the file names "65-2.png", "65-6.png" and "66-1.png". The new pictures must look like they belong to the same arena, seen from the same high camera angle. Do NOT make them softer, blurrier, foggier or more watercolor-like than the references.`;
const DONE = n => `WHEN DONE — upload the finished PNG to Google Drive, into the folder "${DRIVE}", named exactly "${n}.png" (if a file with that name is already there, replace it; if the folder does not exist, create it). Actually save the file to Google Drive; showing the picture in the chat is not enough.`;

// 시트: no · 이름 · 몸통 · 칸 [[cell, key, 이름, 크기, 설명]] · 자르기.
export const SHEETS = [
  { no: '68-1', ko: '새 경기장 바닥 2장(구름 위 하늘 정원 · 얼음 동굴)', head: TALL2, cut: '각 칸 720×1080 webp(왼쪽 · 오른쪽 반)', pair: true,
    body: 'Two arena backgrounds side by side (LEFT half and RIGHT half, each 768×1536, a clear thin gap between them), seen from the SAME high camera angle as the cherry-blossom arena floor "65-2.png": a big round battle floor in the middle-lower part (about 85% of the width, the center of the floor at about 60% of the height), the far scenery at the top. TOP 0–14% and BOTTOM 80–100% stay calmer and a little darker (the game draws the score bar and the buttons there). The middle of the floor stays open and evenly lit (pets fight there). No ring line painted on the floor (the game draws its own ring).',
    cells: [
      ['LEFT', 'bg-sky', '구름 위 하늘 정원', '720×1080', 'SKY GARDEN ARENA: a round grassy floating island floor with a soft white stone rim, small flowers at the edge, fluffy clouds all around below it, a pastel blue sky with a faint rainbow arch and two tiny floating islands in the distance.'],
      ['RIGHT', 'bg-glacier', '얼음 동굴', '720×1080', 'ICE CAVE ARENA: a round polished ice floor with frosty white edges inside a huge glittering ice cave, tall blue crystal pillars at the sides, a gentle green-violet aurora glow coming through an opening at the top, sparkles of snow.']
    ] },
  { no: '68-2', ko: '새 경기장 바닥 2장(화산 분화구 · 별빛 은하)', head: TALL2, cut: '각 칸 720×1080 webp(왼쪽 · 오른쪽 반)', pair: true,
    body: 'The same layout and camera as 68-1 (two backgrounds side by side, each 768×1536, a big round battle floor in the middle-lower part, calm darker top and bottom bands, no ring line painted on the floor). Exciting but friendly, never scary.',
    cells: [
      ['LEFT', 'bg-volcano', '화산 분화구', '720×1080', 'VOLCANO CRATER ARENA: a round dark basalt stone floor with thin glowing orange lava cracks only near the rim (the middle stays plain and readable), a ring of bright flowing lava around the floor, dark red sky with glowing embers, a smoking volcano peak in the distance.'],
      ['RIGHT', 'bg-galaxy', '별빛 은하', '720×1080', 'GALAXY STAGE ARENA: a round glossy violet crystal floor floating in deep space, a soft glowing rim of starlight, a swirling pink-blue galaxy, a ringed planet and twinkling stars in the background, a few tiny shooting stars.']
    ] },
  { no: '68-3', ko: '링(바닥 원) 4개(꽃 고리 · 마법진 · 황금 링 · 별자리 링)', head: SHEET, cut: '--trim --size 512',
    body: 'All four are FLAT FLOOR RINGS seen from the arena camera (high angle), so each is a WIDE ELLIPSE about twice as wide as tall (about 470×235 pixels) centered in its quarter. Only the ring band itself is drawn: the inside and the outside are fully TRANSPARENT (the arena floor shows through, pets stand inside). Thin and elegant (the band is about 6–8% of the width), glowing, crisp.',
    cells: [
      ['TOP-LEFT', 'ring-flower', '꽃 고리', '512×256', 'a FLOWER RING: a ring of small pink cherry blossoms, white petals and tiny green leaves woven together, a soft pink glow.'],
      ['TOP-RIGHT', 'ring-rune', '마법진', '512×256', 'a MAGIC RUNE CIRCLE: two thin glowing violet circles with simple geometric magic marks (no letters, no real-world symbols) between them, small bright dots, violet-blue glow.'],
      ['BOTTOM-LEFT', 'ring-gold', '황금 링', '512×256', 'a GOLDEN CHAMPION RING: a polished gold band with a bright white shine on top, four small gold star studs at the front, back, left and right, warm gold glow.'],
      ['BOTTOM-RIGHT', 'ring-star', '별자리 링', '512×256', 'a CONSTELLATION RING: a thin silver-blue line of star dust with small bright four-point stars linked by faint lines like a constellation, cool blue-violet glow.']
    ] },
  { no: '68-4', ko: '입장 효과 4개(연기 펑 · 번개 낙하 · 불꽃 기둥 · 무지개 포털)', head: SHEET, cut: '--fit-each --size 384',
    body: 'Four ENTRANCE effects that play where a pet appears on the arena floor (the pet stands in the middle, so the center stays open or see-through). Each is a single bold burst centered in its quarter, about 80% of the quarter, seen from the arena camera (high angle).',
    cells: [
      ['TOP-LEFT', 'entry-smoke', '연기 펑', '384×384', 'a POOF OF SMOKE: a puffy round cloud burst of white and pale gray smoke balls with a few tiny sparkles, cartoon style.'],
      ['TOP-RIGHT', 'entry-thunder', '번개 낙하', '384×384', 'a LIGHTNING STRIKE LANDING: a bright white-gold lightning bolt coming down from the top into a glowing impact ring on the floor, violet electric sparks.'],
      ['BOTTOM-LEFT', 'entry-flame', '불꽃 기둥', '384×384', 'a FIRE PILLAR: a tall swirling column of orange-yellow fire rising from a glowing ring on the floor, embers flying up (the bottom middle stays bright and open).'],
      ['BOTTOM-RIGHT', 'entry-rainbow', '무지개 포털', '384×384', 'a RAINBOW PORTAL: a round swirling portal ring of all rainbow colors standing slightly tilted on the floor, a bright white light in the middle, small stars.']
    ] },
  { no: '68-5', ko: '왕관 · 허수아비(승리 포즈 왕관 · 연습장 허수아비)', head: SHEET, cut: '--fit-each --size 256',
    body: 'Two separate objects in the game\'s glossy icon style (match the ribbons and icons of 65-6). The BOTTOM-LEFT and BOTTOM-RIGHT quarters stay completely EMPTY (transparent).',
    cells: [
      ['TOP-LEFT', 'pose-crown', '승리 왕관', '256×256', 'a small shiny GOLD CROWN for a winning pet: five rounded points with tiny colored gems (red, blue, green), bright highlights, a little sparkle, front view.'],
      ['TOP-RIGHT', 'dummy', '연습장 허수아비', '256×256', 'a cute TRAINING DUMMY: a straw-stuffed burlap body tied with rope on a wooden post, short stick arms, a round red-and-white target painted on the face (no eyes, no mouth, friendly), standing on a small round wooden base, front view, slightly worn.'],
      ['BOTTOM-LEFT', '-', '(비움)', '', 'nothing: leave empty and transparent.'],
      ['BOTTOM-RIGHT', '-', '(비움)', '', 'nothing: leave empty and transparent.']
    ] }
];

export const promptOf = s => {
  const lines = [s.head, s.single || s.pair ? 'Style: premium glossy 3D-painted mobile game background, rich clear colors, crisp clean shapes, same world as the pet arena references.' : STYLE_FX, STYLE_REF, s.body];
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
  // slice-map.csv: 68 줄을 지우고 끝에 다시 붙인다(번호는 68을 뺀 마지막 번호 다음).
  const csvPath = resolve(here, 'slice-map.csv');
  const rows = readFileSync(csvPath, 'utf8').split('\n').filter(l => l && !l.startsWith(`"${LIST}"`));
  let no = Math.max(...rows.slice(1).map(l => Number(l.split('","')[1]) || 0));
  const KO_CELL = { 'TOP-LEFT': '왼쪽 위', 'TOP-RIGHT': '오른쪽 위', 'BOTTOM-LEFT': '왼쪽 아래', 'BOTTOM-RIGHT': '오른쪽 아래', LEFT: '왼쪽 반', RIGHT: '오른쪽 반', '한 장': '한 장' };
  const add = SHEETS.map(s => ++no && ITEMS.filter(x => x.sheet === s).map(x => `"${LIST}","${String(no).padStart(3, '0')}","${s.no} ${s.ko}","${KO_CELL[x.cell]}","arena-${x.key}","${x.name} (${x.size})","public/assets/arena/${x.key}.webp"`)).flat();
  writeFileSync(csvPath, [...rows, ...add].join('\n') + '\n');
  console.log(`[68] 시트 ${SHEETS.length}장 · 그림 ${ITEMS.length}장 · slice-map ${add.length}줄`);
}
