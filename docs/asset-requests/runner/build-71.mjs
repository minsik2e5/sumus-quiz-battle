// 그림 주문서 71: 펫 아레나 전투 "효과 재료" 텍스처 28장(구성안 docs/arena-battle-reboot-plan.md 6장).
//   node docs/asset-requests/runner/build-71.mjs
// 만드는 것: 71-arena-fx-materials.txt, split/ 시트별 파일, slice-map.csv의 71 줄(있으면 바꿔 쓴다).
//   (build-runner.mjs는 26번 이후를 모르므로 돌리지 않는다: slice-map.csv 뒤쪽이 지워진다.)
// 프레임 애니메이션 시트가 아니다. 코드(캔버스 무대)가 뿌리고 · 돌리고 · 키우고 · 색을 입혀 움직일 "재료" 한 장씩이다.
//   예: 연기 뭉치 1장을 40번 찍어 연기 구름을 만들고, 불티 1장을 200번 찍어 불꽃을 만든다.
// 배경 규칙(재료마다 처리 방법 kind):
//   add  — 검은 배경 위 빛나는 재료. 더하기 섞기(lighter)로 그리면 검정은 사라진다. 오려 내지 않는다.
//   luma — 검은 배경 위 흰 · 회색 모양(연기 · 먼지 · 속도선). 불러올 때 밝기를 투명도로 바꾸고, 코드가 속성 색을 입힌다.
//   key  — 검은 배경 위 단단한 물체(돌 · 얼음 조각 · 잎 · 물방울 · 독 거품). 불러올 때 거의 검정인 배경만 투명하게 뺀다
//          → 물체 안에 새까만 색을 쓰지 않는다(가장 어두운 곳도 짙은 갈색 · 남색).
//   mul  — 땅에 어둡게 남는 자국(금 · 그을음 · 구덩이)만 예외: **흰 배경** 위에 그리고 곱하기 섞기(multiply)로 바닥에 굽는다
//          → 흰색은 바닥을 바꾸지 않고, 어두운 곳만 바닥을 어둡게 한다.
// 넣는 곳: public/assets/arena/mat-<이름>.webp → npm run build:assets가 ARENA_ART에 적고, 시험 페이지(public/proto/arena-fx.js MATS)와
//   나중의 캔버스 무대가 같은 이름 칸의 코드 그림을 이 그림으로 바꾼다(코드 등록 필요 없음). 자르기: slice-71.mjs.
// CLAUDE.md 그림 주문서 규칙 두 가지를 시트마다 넣는다:
//   ① Drive의 기존 그림(아레나 fx-* · 펫 그림)을 열어 그림체를 맞추라 ② 정해진 Drive 폴더에 정확한 파일 이름으로 저장하라.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
export const DRIVE = 'SUMUS 펫 아레나 71 (Runner용)';
const LIST = '71-arena-fx-materials.txt';

const BLACK = 'Create ONE square image, 1024×1024 pixels, laid out as a 2×2 grid: four separate materials, one centered in each quarter (each quarter is 512×512). The WHOLE background is PURE BLACK (#000000), flat, with no texture, no vignette, no gradient, no stars, no noise. Every material fades out completely to pure black at least 40 pixels before the middle lines and the image edges, so each quarter can be cut out cleanly. No text, no letters, no numbers, no watermark, no frames, no borders, no grid lines. Do not ask me any questions; just generate the image.';
const WHITE = 'Create ONE square image, 1024×1024 pixels, laid out as a 2×2 grid: four separate ground marks, one centered in each quarter (each quarter is 512×512). The WHOLE background is PURE WHITE (#FFFFFF), flat, with no texture, no shadow, no paper grain, no gradient. Every mark fades out completely to pure white at least 40 pixels before the middle lines and the image edges. Marks are drawn ONLY in dark earthy tones (no bright colors, no white highlights inside the marks: the game multiplies this picture onto the arena floor, so white means "no change" and dark means "darker floor"). No text, no letters, no numbers, no watermark, no frames, no borders. Do not ask me any questions; just generate the image.';
const STYLE = 'Style: premium glossy 3D-painted mobile game VFX MATERIALS for a cute pet battle game, seen from a high top-down camera. Each quarter holds ONE isolated material (a single smoke puff, a single spark, a single rock …), not a whole scene: the game copies, rotates, scales, tints and scatters it hundreds of times by code. Crisp, clean, readable at 48 pixels; bright saturated cores; soft but not blurry edges. Original designs only: do NOT copy or resemble any effect, character, creature or logo from any other game, anime, cartoon or movie.';
const STYLE_REF = 'STYLE REFERENCE — before drawing, open the existing pictures already in Google Drive and match their art style, rendering quality, color clarity and finish exactly: the pet arena effect sheets in the folder "SUMUS 펫 아레나 66 (Runner용)" ("66-1.png" long beams, "66-2.png" meteor and crit burst, "66-3.png" floor fields), the arena floor "65-2.png" in the folder "SUMUS 펫 아레나 65 (Runner용)", and a pet picture "07a-1.png" in the folder "SUMUS 전설 펫 07 (Runner용)" (the effects must look like they belong next to these pets). If a folder is not there, search Google Drive for those exact file names. Do NOT make it softer, blurrier, foggier or more watercolor-like than the references.';
const DONE = n => `WHEN DONE — upload the finished PNG to Google Drive, into the folder "${DRIVE}", named exactly "${n}.png" (if a file with that name is already there, replace it; if the folder does not exist, create it). Actually save the file to Google Drive; showing the picture in the chat is not enough.`;
const KIND_NOTE = {
  add: 'GLOWING material on black: it will be drawn with additive blending, so black = invisible. Bright white-hot center, saturated colored glow fading smoothly to black.',
  luma: 'GRAYSCALE material on black: draw it ONLY in white and grays (no color at all). Brightness becomes opacity in the game (white = solid, black = invisible) and the game tints it per element.',
  key: 'SOLID OBJECT on black with a clean crisp silhouette (the game removes the black background). Do NOT use pure black anywhere inside the object: its darkest outline and shadows are deep brown, navy or dark purple. No glow halo, no drop shadow, no motion blur around it.',
  mul: 'DARK GROUND MARK on white (see above).'
};

// 시트: no · 이름 · 머리 · 칸 [[cell, key(mat-…), 이름, kind, 저장 크기, 설명]].
// kind와 크기는 slice-71.mjs가 쓴다. key는 public/proto/arena-fx.js의 재료 칸(MATS) 이름과 1:1.
export const SHEETS = [
  { no: '71-1', ko: '빛 · 섬광(부드러운 빛 · 별빛 십자 · 충격파 고리 · 방사 섬광)', head: BLACK, kind: 'add',
    cells: [
      ['TOP-LEFT', 'glow', '부드러운 빛 원', 'add', 256, 'a SOFT GLOW ORB: a perfectly round white-hot center that falls off smoothly into a warm white halo, about 380 pixels wide, no rays, no rings. (Used for every flash and light bloom; the game tints it.)'],
      ['TOP-RIGHT', 'star', '별빛 십자 반짝', 'add', 256, 'a STAR GLINT: a sharp four-pointed sparkle cross (long thin horizontal and vertical rays, shorter diagonal rays) with a tiny bright core, white with a faint pale-blue edge, about 400 pixels across.'],
      ['BOTTOM-LEFT', 'ring', '충격파 고리', 'add', 256, 'a SHOCKWAVE RING seen from straight above: one thin bright white ring about 400 pixels wide with a soft inner glow and a crisp outer edge, slightly uneven like a burst of energy; the middle of the ring is black.'],
      ['BOTTOM-RIGHT', 'burst', '방사 섬광 터짐', 'add', 256, 'a RADIAL IMPACT BURST: a bright white-yellow core with 12 to 16 sharp spiky rays of different lengths shooting outward, a few tiny sparks between them, about 420 pixels across.']
    ] },
  { no: '71-2', ko: '불 · 번개(불꽃 혀 · 불티 · 번개 줄기 · 불꽃 줄)', head: BLACK, kind: 'add',
    cells: [
      ['TOP-LEFT', 'flame', '불꽃 혀', 'add', 256, 'a single FLAME TONGUE pointing UP: a curling teardrop flame, white-yellow core, orange middle, deep red tips, about 220 pixels wide and 400 pixels tall.'],
      ['TOP-RIGHT', 'ember', '불티', 'add', 128, 'a single glowing EMBER: a small bright orange-yellow speck with a white core and a soft orange glow, about 120 pixels across (the game scatters hundreds of them).'],
      ['BOTTOM-LEFT', 'bolt', '번개 줄기', 'add', 512, 'a LIGHTNING STROKE running HORIZONTALLY from the left edge area to the right edge area of the quarter (about 440 pixels long): a jagged zig-zag white-hot core with 2 or 3 small forks, wrapped in violet-blue electric glow. Keep it inside a horizontal band about 160 pixels tall through the exact middle of the quarter (pure black above and below).'],
      ['BOTTOM-RIGHT', 'streak', '불꽃 줄(빛 꼬리)', 'add', 256, 'a SPARK STREAK running HORIZONTALLY: a thin bright white line about 360 pixels long, thick and white-hot at the RIGHT end (the head), thinning and fading to warm yellow toward the left (the tail). Keep it inside a horizontal band about 160 pixels tall through the exact middle of the quarter (pure black above and below).']
    ] },
  { no: '71-3', ko: '물 · 얼음(물방울 · 물보라 · 얼음 조각 · 서리 반짝)', head: BLACK, kind: 'key',
    cells: [
      ['TOP-LEFT', 'drop', '물방울', 'key', 128, 'a single WATER DROPLET: a glossy round-teardrop drop of clear aqua-blue water with a bright white highlight at the top-left and a darker navy edge, about 140 pixels tall.'],
      ['TOP-RIGHT', 'splash', '물보라', 'key', 256, 'a WATER SPLASH seen from above: a crown-shaped ring of bright aqua water spikes and small flying droplets around an open center, white foam tips, navy-blue darkest edges, about 400 pixels wide.'],
      ['BOTTOM-LEFT', 'shard', '얼음 조각', 'key', 128, 'a single ICE SHARD: a sharp faceted crystal splinter of pale cyan ice with white edge highlights and deeper blue facets, navy outline, about 220 pixels long, pointing to the upper-right.'],
      ['BOTTOM-RIGHT', 'frost', '서리 반짝', 'add', 256, 'a FROST SPARKLE (glowing, additive): a delicate six-armed snowflake-like crystal of light, white core and pale icy-blue glow, about 360 pixels across.']
    ] },
  { no: '71-4', ko: '땅(바위 파편 2 · 흙덩이 · 작은 돌 무더기)', head: BLACK, kind: 'key',
    cells: [
      ['TOP-LEFT', 'rock-a', '바위 파편 A', 'key', 128, 'a ROCK CHUNK: one angular broken stone fragment, warm gray-brown with a light top-left face and darker bottom faces, small chips, dark-brown outline, about 260 pixels across.'],
      ['TOP-RIGHT', 'rock-b', '바위 파편 B', 'key', 128, 'a different ROCK CHUNK: a flatter, longer slab-shaped stone fragment, cooler gray with a mossy-green speck, dark-brown outline, about 280 pixels long.'],
      ['BOTTOM-LEFT', 'clod', '흙덩이', 'key', 128, 'a DIRT CLOD: one crumbly lump of rich brown earth with a few tiny grass blades and pebbles stuck to it, dark-brown outline, about 220 pixels across.'],
      ['BOTTOM-RIGHT', 'pebbles', '작은 돌 무더기', 'key', 256, 'a small SCATTER OF PEBBLES: 6 to 8 tiny round stones of different grays and browns lying together in a loose cluster about 300 pixels wide, each with a light top and dark-brown outline.']
    ] },
  { no: '71-5', ko: '연기 · 바람(연기 뭉치 · 흙먼지 · 속도선 · 바람 소용돌이)', head: BLACK, kind: 'luma',
    cells: [
      ['TOP-LEFT', 'smoke', '연기 뭉치', 'luma', 256, 'a single SMOKE PUFF: a round billowing cloud made of 5 to 7 soft overlapping lumps, bright white on the top-left lumps, mid gray in the creases, soft rounded edges, about 400 pixels across. White and grays only.'],
      ['TOP-RIGHT', 'dust', '흙먼지', 'luma', 256, 'a DUST BURST: a low wide puff of fine powder spreading sideways (wider than tall, about 420×240 pixels) with a grainy, slightly speckled texture and wispy edges. White and grays only.'],
      ['BOTTOM-LEFT', 'speed', '속도선', 'luma', 512, 'SPEED LINES: 9 to 12 straight horizontal white streaks of different lengths and thicknesses stacked loosely in a band about 440 pixels long, each streak sharp at the left and fading out to the right. White and grays only. Keep it inside a horizontal band about 160 pixels tall through the exact middle of the quarter (pure black above and below).'],
      ['BOTTOM-RIGHT', 'swirl', '바람 소용돌이', 'luma', 256, 'a WIND SWIRL seen from above: two or three curved crescent strokes spiraling around an open center like a gust, white fading to gray at the tails, about 380 pixels across. White and grays only.']
    ] },
  { no: '71-6', ko: '풀 · 독 · 별(잎 · 꽃잎 · 독 거품 · 별가루)', head: BLACK, kind: 'key',
    cells: [
      ['TOP-LEFT', 'leaf', '잎', 'key', 128, 'a single fresh GREEN LEAF: a pointed oval leaf with a light center vein, bright spring green with a yellow-green highlight and a dark forest-green outline, about 220 pixels long, tilted diagonally.'],
      ['TOP-RIGHT', 'petal', '꽃잎', 'key', 128, 'a single soft PINK FLOWER PETAL: a rounded cherry-blossom-like petal with a tiny notch at the tip, pink with a white-pink highlight and a deeper rose outline, about 160 pixels long.'],
      ['BOTTOM-LEFT', 'bubble', '독 거품', 'key', 128, 'a single POISON BUBBLE: a glossy round bubble of bright violet-magenta goo with a big white window highlight at the top-left, a toxic-green rim light at the bottom, dark-purple outline, about 180 pixels wide. Cute, not scary.'],
      ['BOTTOM-RIGHT', 'stardust', '별가루', 'add', 256, 'STAR DUST (glowing, additive): a loose sprinkle of 10 to 14 tiny golden-white star sparkles and dots of different sizes in a soft cluster about 340 pixels across, with a faint golden glow.']
    ] },
  { no: '71-7', ko: '바닥 자국(방사형 금 · 긴 금 · 그을음 · 구덩이 테) — 흰 배경', head: WHITE, kind: 'mul',
    cells: [
      ['TOP-LEFT', 'crack-star', '방사형 금', 'mul', 256, 'a STAR-SHAPED GROUND CRACK seen from straight above: 7 to 9 jagged dark-brown cracks radiating from a small broken center, branching a little, thinner toward the tips, about 440 pixels across. Thin, sharp, earthy; NOT spider-like and NOT thick blobs.'],
      ['TOP-RIGHT', 'crack-line', '긴 금', 'mul', 512, 'a LONG GROUND CRACK running HORIZONTALLY across the quarter (about 450 pixels long): one jagged dark-brown split with small side branches, widest in the middle, thin at both ends. Keep it inside a horizontal band about 160 pixels tall through the exact middle of the quarter (pure white above and below).'],
      ['BOTTOM-LEFT', 'scorch', '그을음', 'mul', 256, 'a SCORCH MARK seen from above: an irregular round burnt patch, sooty dark brown-gray in the middle fading softly to the white edges, a few darker flecks and streaks, about 400 pixels across.'],
      ['BOTTOM-RIGHT', 'crater', '구덩이 테', 'mul', 256, 'a SHALLOW CRATER seen from above: a round dent with a darker brown inner bowl, a slightly darker rim ring and small cracks around the rim, about 380 pixels across, fading to white outside.']
    ] }
];

export const promptOf = s => {
  const kinds = [...new Set(s.cells.map(c => c[3]))];
  const lines = [s.head, STYLE, STYLE_REF, ...kinds.map(k => KIND_NOTE[k])];
  for (const [cell, , , kind, , text] of s.cells) lines.push(`${cell}: ${text}${kind !== s.kind ? ` (${KIND_NOTE[kind].split(':')[0]})` : ''}`);
  lines.push(DONE(s.no));
  return lines.join('\n');
};
export const ITEMS = SHEETS.flatMap(s => s.cells.map(([cell, key, name, kind, size]) => ({ sheet: s, cell, key, name, kind, size })));

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const all = SHEETS.map(s => `### ${s.no} ${s.ko}\n${promptOf(s)}`).join('\n\n');
  writeFileSync(resolve(here, LIST), all + '\n');
  mkdirSync(resolve(here, 'split'), { recursive: true });
  for (const s of SHEETS) writeFileSync(resolve(here, 'split', `${s.no} 펫 아레나 효과 재료 ${s.ko.split('(')[0].trim()}.txt`), promptOf(s) + '\n');
  // slice-map.csv: 71 줄을 지우고 끝에 다시 붙인다(번호는 71을 뺀 마지막 번호 다음).
  const csvPath = resolve(here, 'slice-map.csv');
  const rows = readFileSync(csvPath, 'utf8').split('\n').filter(l => l && !l.startsWith(`"${LIST}"`));
  let no = Math.max(...rows.slice(1).map(l => Number(l.split('","')[1]) || 0));
  const KO_CELL = { 'TOP-LEFT': '왼쪽 위', 'TOP-RIGHT': '오른쪽 위', 'BOTTOM-LEFT': '왼쪽 아래', 'BOTTOM-RIGHT': '오른쪽 아래' };
  const add = SHEETS.map(s => ++no && ITEMS.filter(x => x.sheet === s).map(x => `"${LIST}","${String(no).padStart(3, '0')}","${s.no} ${s.ko}","${KO_CELL[x.cell]}","arena-mat-${x.key}","${x.name} (${x.kind} · ${x.size}px)","public/assets/arena/mat-${x.key}.webp"`)).flat();
  writeFileSync(csvPath, [...rows, ...add].join('\n') + '\n');
  console.log(`[71] 시트 ${SHEETS.length}장 · 재료 ${ITEMS.length}장 · slice-map ${add.length}줄`);
}
