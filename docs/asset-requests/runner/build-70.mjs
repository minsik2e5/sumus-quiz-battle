// 그림 주문서 70: 펫 아레나 UI 묶음(구성안 docs/arena-battle-reboot-plan.md 6-2 · 부록 A, 앞 구성안 arena-ui-vfx-plan.md 3-A).
//   node docs/asset-requests/runner/build-70.mjs
// 만드는 것: 70-arena-ui-kit.txt, split/ 시트별 파일, slice-map.csv의 70 줄.
// 67(버튼 9장, 아직 안 그림)은 내지 않고 여기로 합쳤다: 버튼마다 같은 광택이 아니라 크기 · 재료로 위계를 준다
//   (공격 가장 화려 → 필살 → 스킬 → 회피 · 교체는 은 테두리 무광), 아이콘은 이모지 대신 한 시트 · 한 그림체.
// 순서: 70-1 스타일 가이드를 **먼저** 그려 선생님이 확인한 뒤, 70-2 ~ 70-5는 70-1을 열어 맞춘다.
// 넣는 곳: public/assets/arena/ui2-<이름>.webp(build:assets가 ARENA_ART에 적음). 앱에 붙이는 일은 구성안 ⑧단계(그때 CSS를 그림으로 바꿈).
// 자르기: 70-2(4×4)는 slice-grid.mjs, 2×2 시트는 fit-assets.mjs. 70-1은 참고용이라 자르지 않는다.
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { done, styleRef, writeOrder } from './arena-order.mjs';

const here = dirname(fileURLToPath(import.meta.url));
export const DRIVE = 'SUMUS 펫 아레나 70 (Runner용)';
const LIST = '70-arena-ui-kit.txt';
const REFS = [['SUMUS 펫 아레나 65 (Runner용)', '"65-2.png" the arena floor, "65-6.png" the banner and icon sheet'], ['SUMUS 펫 아레나 69 (Runner용)', '"69-1.png" the rank badges'], ['SUMUS 전설 펫 07 (Runner용)', '"07a-1.png" a pet']];
const REFS_70 = [['SUMUS 펫 아레나 70 (Runner용)', '"70-1.png" the style guide you must follow first of all'], ...REFS];
const GRID2 = 'Create ONE square image, 1024×1024 pixels, laid out as a 2×2 sprite sheet: four separate illustrations, one centered in each quarter (each quarter is 512×512). Leave generous empty space around every illustration so nothing touches or crosses the middle lines or the image edges. Use a real transparent background (PNG alpha). Do NOT paint a checkerboard, white box, grid lines, frames or borders. No text, no letters, no numbers, no watermark. Do not ask me any questions; just generate the image.';
const GRID4 = 'Create ONE square image, 1024×1024 pixels, laid out as a 4×4 icon sheet: sixteen separate icons, one centered in each cell (each cell is 256×256), every icon about 190 pixels wide with empty space around it so nothing touches the cell edges. Use a real transparent background (PNG alpha). Do NOT paint a checkerboard, grid lines, frames, cell borders or labels. No text, no letters, no numbers, no watermark. Do not ask me any questions; just generate the image.';
const UI_STYLE = 'Style: premium 3D-painted mobile game UI for a cute pet battle game, matching the glossy painted pets and arenas. ONE shared material language for everything: (1) dark NAVY GLASS panels (deep navy with a soft inner gradient and a thin bright top edge), (2) a GOLD metal trim in exactly three thicknesses (thick for the main button, medium for frames, thin for chips), (3) element GEMS only where told. Light always comes from the upper-left. Clean crisp edges, readable at small size, not noisy, not over-glowing: glow ONLY where the prompt says.';

export const SHEETS = [
  { no: '70-1', ko: '스타일 가이드(재료 · 금 테두리 3단계 · 속성 색 8칸 · 아이콘 예시) — 먼저 그려 확인', cells: [], ref: REFS,
    head: 'Create ONE square image, 1024×1024 pixels, painted on a plain dark navy background (#121a33), laid out like a tidy design STYLE GUIDE board with generous spacing. No text, no letters, no numbers, no labels, no watermark. Do not ask me any questions; just generate the image.',
    body: ['TOP ROW: three horizontal GOLD trim samples (thick, medium, thin), each a short rounded bar with bevel highlights and the same gold color.',
      'SECOND ROW: one navy glass panel rectangle with medium gold trim and rounded corners, and next to it a small pill-shaped chip with thin gold trim.',
      'THIRD ROW: eight round element color chips in a line, each a small glossy gem: fire orange-red, water blue, leaf green, earth amber-brown, wind mint, ice pale cyan, poison violet, star yellow-gold.',
      'BOTTOM ROW: three sample icons in the shared icon style: a sword, a shield and a small gold coin, each a white-and-gold glossy silhouette with a thin dark outline, sitting on nothing.',
      'Everything shares one light direction (upper-left) and one finish. This board will be the reference for every later sheet.'] },
  { no: '70-2', ko: 'UI 아이콘 16개(4×4) — 이모지 대신', grid: 4, ref: REFS_70, cut: 'slice-grid.mjs --grid 4 --size 128',
    note: 'All sixteen icons share ONE style: a glossy white-and-gold silhouette with a thin dark navy outline and a tiny soft shadow below, no background plate, no circle behind them. Rows are listed left to right.',
    cells: [
      ['R1C1', 'ui2-ico-attack', '공격(칼)', 'a short broad SWORD pointing up-right'],
      ['R1C2', 'ui2-ico-ult', '필살기', 'a four-pointed STAR burst with a small flame tail'],
      ['R1C3', 'ui2-ico-dodge', '회피', 'a curved double SWOOSH arrow (a roll)'],
      ['R1C4', 'ui2-ico-swap', '교체', 'two curved ARROWS making a circle'],
      ['R2C1', 'ui2-ico-practice', '연습장', 'a straw TRAINING DUMMY with a round target on its chest'],
      ['R2C2', 'ui2-ico-deco', '꾸미기', 'a small PAINT BRUSH crossed with a flag pennant'],
      ['R2C3', 'ui2-ico-rank', '랭킹', 'a three-step PODIUM'],
      ['R2C4', 'ui2-ico-ticket', '입장권', 'a TICKET stub with a notched edge and a star'],
      ['R3C1', 'ui2-ico-coin', '코인', 'a gold COIN seen slightly from the side with a star stamp'],
      ['R3C2', 'ui2-ico-lock', '잠금', 'a chunky PADLOCK'],
      ['R3C3', 'ui2-ico-info', '설명(ⓘ 대신)', 'a round information BADGE with a small dot-and-bar mark (not a letter)'],
      ['R3C4', 'ui2-ico-exit', '나가기', 'a DOOR with an arrow pointing out'],
      ['R4C1', 'ui2-ico-medal1', '1위 메달', 'a GOLD MEDAL on a short red ribbon with one star on it'],
      ['R4C2', 'ui2-ico-medal2', '2위 메달', 'a SILVER MEDAL on a short blue ribbon with two small stars'],
      ['R4C3', 'ui2-ico-medal3', '3위 메달', 'a BRONZE MEDAL on a short green ribbon with three tiny stars'],
      ['R4C4', 'ui2-ico-emote', '이모트', 'a round SPEECH BUBBLE with a small heart inside']
    ] },
  { no: '70-3', ko: '유리 판 · 금 테 9-slice · 칩 · 위쪽 HUD 띠', grid: 2, ref: REFS_70, cut: 'fit-assets.mjs --trim --size 512',
    note: 'These are stretchable UI pieces (the game cuts them as 9-slice), so keep the corners identical and the middle plain and evenly colored.',
    cells: [
      ['TOP-LEFT', 'ui2-panel', '남색 유리 판(9-slice)', 'a NAVY GLASS PANEL: a rounded rectangle about 400×300 pixels, plain deep navy glass with a soft vertical gradient, a thin bright top edge, no trim.'],
      ['TOP-RIGHT', 'ui2-frame', '금 테두리(9-slice)', 'a GOLD FRAME: a rounded rectangle outline about 400×300 pixels in MEDIUM gold trim, the inside completely transparent, small decorative notches only at the four corners.'],
      ['BOTTOM-LEFT', 'ui2-chip', '알약 칩', 'a PILL CHIP: a small rounded pill about 260×90 pixels, navy glass with THIN gold trim, plain middle.'],
      ['BOTTOM-RIGHT', 'ui2-hudbar', '위쪽 HUD 띠', 'a TOP HUD STRIP: a wide shallow banner about 470×110 pixels, navy glass fading to transparent at the bottom edge, a thin gold line along the bottom, a small raised center plate (for the timer) with medium gold trim.']
    ] },
  { no: '70-4', ko: '전투 버튼 바탕 4개(공격 · 필살 · 스킬 · 회피) — 크기 · 재료로 위계', grid: 2, ref: REFS_70, cut: 'fit-assets.mjs --fit-each --size 256',
    note: 'Round on-screen battle BUTTON BASES. Hierarchy by material, not by more glow: only the attack button is fully jeweled; the others step down. The middle of each button stays plain (the game puts the icon and the element color on top).',
    cells: [
      ['TOP-LEFT', 'ui2-btn-attack', '공격 버튼(가장 화려)', 'the ATTACK button: the biggest and richest, THICK gold trim, a clear colorless crystal gem dome (the game tints it with the pet\'s element), strong glossy highlight.'],
      ['TOP-RIGHT', 'ui2-btn-ult', '필살 버튼(게이지 홈)', 'the ULTIMATE button: medium gold trim with a recessed empty GROOVE ring around it (the game fills it as a gauge), a dark navy glass center, small wing-like gold flares at the sides.'],
      ['BOTTOM-LEFT', 'ui2-btn-skill', '스킬 버튼', 'the SKILL button: medium gold trim, a dark navy glass center with a faint inner reflection, simpler than the two above.'],
      ['BOTTOM-RIGHT', 'ui2-btn-dodge', '회피 버튼(은 · 무광)', 'the DODGE button: a SILVER matte trim (not gold), a smoky gray-blue glass center, the plainest of the four.']
    ] },
  { no: '70-5', ko: '교체 버튼 · 조이스틱 바닥 · 손잡이 · 준비됨 빛 고리', grid: 2, ref: REFS_70, cut: 'fit-assets.mjs --fit-each --size 256',
    note: 'Same family as 70-4.',
    cells: [
      ['TOP-LEFT', 'ui2-btn-swap', '교체 버튼(은 · 작게)', 'the SWAP button: like the dodge button (silver matte trim, smoky glass) but with a slightly thinner rim.'],
      ['TOP-RIGHT', 'ui2-joy-base', '조이스틱 바닥', 'a JOYSTICK BASE: a large round shallow navy glass bowl, thin silver rim, four tiny arrow notches at top, right, bottom and left, mostly see-through in the middle.'],
      ['BOTTOM-LEFT', 'ui2-joy-knob', '조이스틱 손잡이', 'a JOYSTICK KNOB: a chunky round glossy navy-and-silver knob with a white highlight at the upper-left.'],
      ['BOTTOM-RIGHT', 'ui2-ready-ring', '준비됨 빛 고리', 'a READY GLOW RING: a thin bright golden-white ring with a soft halo and three tiny sparkles; the inside is completely transparent.']
    ] }
];
const CELL4 = c => `ROW ${c[1]}, COLUMN ${c[3]}`;
export const promptOf = s => {
  const lines = [s.head || (s.grid === 4 ? GRID4 : GRID2), s.head ? 'Style: the same premium 3D-painted mobile game UI as the references, light from the upper-left.' : UI_STYLE, styleRef(s.ref)];
  if (s.body) lines.push(...s.body);
  if (s.note) lines.push(s.note);
  for (const c of s.cells) lines.push(`${s.grid === 4 ? CELL4(c[0]) : c[0]}: ${c[3]}`);
  lines.push(done(DRIVE, s.no));
  return lines.join('\n');
};
export const ITEMS = SHEETS.flatMap(s => s.cells.length ? s.cells.map(([cell, key, name]) => ({ sheet: s, cell, key: 'arena-' + key, name: `${name}`, file: `public/assets/arena/${key}.webp` })) : [{ sheet: s, cell: '한 장', key: 'arena-ui2-style', name: '스타일 가이드(확인용)', file: '(참고용 · 앱에 넣지 않음)' }]);

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const n = writeOrder(here, LIST, '펫 아레나 UI', SHEETS.map(s => ({ ...s, prompt: promptOf(s) })), ITEMS);
  console.log(`[70] 시트 ${SHEETS.length}장 · 그림 ${ITEMS.length}장 · slice-map ${n}줄`);
}
