// 그림 주문서 42 · 43 · 44 · 45: 놀이터 새 게임 인형뽑기(docs/claw-machine-design.md).
//   42 = 인형 12종(12지 동물 봉제 인형, 시트 하나 = 인형 하나, 2×2: 기본 · 집힘 · 떨어짐 · 기쁨),
//   43 = 기계 본체(세로 한 장) + 앞 겹침 부품 · 집게 · 레일 · 조작 UI(2×2 시트 5장),
//   44 = 배경 3장(세로) + 놀이터 입구 카드 1장(가로), 45 = 도감 카드 틀 · 장식 · 황금 효과(2×2 시트 3장).
//   node docs/asset-requests/runner/build-42.mjs
// 만드는 것: 42a · 43 · 44 · 45 주문서(.txt), split/ 시트별 파일, slice-map.csv의 42 ~ 45 줄(있으면 바꿔 쓴다),
//   CODEX_PROMPT_42.md ~ 45. (build-runner.mjs는 26번 이후를 모르므로 돌리지 않는다: slice-map.csv 뒤쪽이 지워진다.)
// 앱 코드는 고치지 않는다: 그림이 들어와도 인형뽑기는 코드(다음 세션)와 그림 게이트(claw-art.js)가 생기기 전까지 나오지 않는다.
// slice-map.csv의 prompt_no는 "그때 마지막 번호 다음"이라, build-39.mjs를 이 파일 뒤에 다시 돌리면 39 ~ 41 번호가 42 ~ 45 뒤로 밀린다.
import { readFileSync, writeFileSync, mkdirSync, readdirSync, unlinkSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { ZODIAC_PET_KEYS, CHARACTERS } from '../../../public/modules/core.js';

const here = dirname(fileURLToPath(import.meta.url));
const ASSETS = resolve(here, '../../../public/assets');
export const DRIVE_42 = 'SUMUS 인형뽑기 42 (Runner용)';
export const DRIVE_43 = 'SUMUS 인형뽑기 기계 43 (Runner용)';
export const DRIVE_44 = 'SUMUS 인형뽑기 배경 44 (Runner용)';
export const DRIVE_45 = 'SUMUS 인형뽑기 도감·장식 45 (Runner용)';
export const FILES_42 = { 42: '42a-claw-dolls.txt', 43: '43-claw-machine.txt', 44: '44-claw-backgrounds.txt', 45: '45-claw-book-fx.txt' };
const PET_SPRITES = 'SUMUS_PET_SPRITES_ALL_20261002/original_1254';

const SHEET = 'Create ONE square image, 1024×1024 pixels, laid out as a 2×2 sprite sheet: four separate illustrations, one centered in each quarter (each quarter is 512×512). Leave generous empty space around every illustration so nothing touches or crosses the middle lines or the image edges. Use a real transparent background (PNG alpha) — do NOT paint a checkerboard, white box, grid lines, frames or borders. No text, no letters, no numbers, no labels, no watermark, no ground shadow. Do not ask me any questions; just generate the image.';
const KEEP = 'Do NOT make it softer, blurrier, foggier, more painterly or more watercolor-like than the reference.';
const CELLS = ['TOP-LEFT', 'TOP-RIGHT', 'BOTTOM-LEFT', 'BOTTOM-RIGHT'];
const CELL_KO = ['왼쪽 위', '오른쪽 위', '왼쪽 아래', '오른쪽 아래'];
const saveTo = (drive, name, what = 'transparent PNG') => `WHEN DONE — upload the finished ${what} to Google Drive, into the folder "${drive}", named exactly "${name}.png" (if a file with that name is already there, replace it; if the folder does not exist, create it). Actually save the file to Google Drive; showing the picture in the chat is not enough.`;

// ── 42: 인형 12종 ─────────────────────────────────────────────────────────────────────────
// key는 그림 파일 이름(public/assets/claw/doll-<key>*.webp)이다. 순서 = 12지 순서 = 도감 순서(p.claw.b 배열 순서).
// pet = 같은 동물의 진짜 12지 펫(core.js ZODIAC_PET_KEYS). 인형은 그 펫과 색 · 모양이 달라야 한다(헷갈리지 않게).
// looks = 인형 생김새(그림 GPT용, 영어). 펫 그림 색(펫 쪽 설명 · 그림의 주된 색)과 겹치지 않는 장난감 색으로 골랐다.
export const DOLLS = {
  rat: { ko: '쪼꼬 쥐', animal: '쥐', pet: 'mouse', looks: 'a round lilac-lavender plush mouse with big round ears lined in mint felt, a thin lilac tail with a small mint ribbon, hugging a small yellow felt cheese wedge', petColor: 'the dove-gray mouse pet' },
  ox: { ko: '음메 소', animal: '소', pet: 'calf', looks: 'a chubby milk-white plush ox with soft sky-blue cow spots, short rounded sky-blue felt horns, a big pale-pink muzzle with two stitched nostrils, a mint ribbon bow on its tail (NO bell)', petColor: 'the golden-brown calf pet with a brass bell' },
  tiger: { ko: '어흥 호랑이', animal: '호랑이', pet: 'tiger', looks: 'a chubby lemon-yellow plush tiger with coral-pink felt stripes sewn on as patches, a white belly patch and muzzle, a mint ribbon bow on one ear', petColor: 'the bright-orange tiger pet with brown stripes' },
  rabbit: { ko: '깡총 토끼', animal: '토끼', pet: 'rabbit', looks: 'a soft sky-blue plush bunny with a white tummy patch, very long floppy ears lined in pink felt, a small orange felt carrot badge sewn on its chest', petColor: 'the white rabbit pet' },
  dragon: { ko: '미르 용', animal: '용', pet: 'dragon', looks: 'a chubby coral-pink plush baby dragon with soft mint felt spikes down its back, tiny stubby felt wings, a yellow star-shaped belly patch with stitched scale lines, holding a small pearl bead', petColor: 'the white and teal dragon pet' },
  snake: { ko: '스르르 뱀', animal: '뱀', pet: 'snake', looks: 'a long plush snake with lavender and lemon-yellow stripes, coiled into a round cushion-like spiral with its head on top, a little red felt tongue, a polka-dot bow tie', petColor: 'the cream and green snake pet' },
  horse: { ko: '따각 말', animal: '말', pet: 'pony', looks: 'a chubby peach-orange plush pony with a fluffy rainbow yarn mane and tail, cream felt hooves, a white felt star patch on its forehead (NO horn, NO wings)', petColor: 'the chestnut-brown pony pet with a cream mane' },
  sheep: { ko: '몽실 양', animal: '양', pet: 'sheep', looks: 'a round plush sheep with curly baby-pink bouclé fleece, a cream felt face and stubby cream legs, small floppy ears, a sky-blue ribbon around its neck', petColor: 'the cream-white sheep pet' },
  monkey: { ko: '끼끼 원숭이', animal: '원숭이', pet: 'monkey', looks: 'a classic SOCK-MONKEY style plush: heather blue-gray knit fabric, a cream knit face and belly, a bright red knit mouth patch, long floppy arms with cream hands, a long tail with a red tip', petColor: 'the caramel-brown monkey pet' },
  rooster: { ko: '꼬꼬 닭', animal: '닭', pet: 'rooster', looks: 'a round snow-white plush rooster with a big puffy coral-red felt comb and wattle, a small orange felt beak, rainbow felt tail-feather tufts, sky-blue felt feet', petColor: 'the yellow chick-rooster pet' },
  dog: { ko: '멍멍 강아지', animal: '개', pet: 'dog', looks: 'a chubby chocolate-brown plush puppy with a cream muzzle and tummy, long floppy ears, a red bandana with white dots tied around its neck', petColor: 'the golden-orange dog pet' },
  pig: { ko: '꿀꿀 돼지', animal: '돼지', pet: 'pig', looks: 'a round mint-aqua plush piglet with a big pink felt snout with two stitched nostrils, small pink-lined ears, a curly pink pipe-cleaner tail, a yellow felt flower clip on one ear', petColor: 'the pink pig pet' }
};
const DOLL_STYLE = 'Style: a cute premium PLUSH TOY (stuffed animal) for a crane-game, drawn with the same rendering quality as the pets of this game: chubby squishy proportions (big round head, small soft body, stubby limbs), soft fuzzy felt and minky fabric you can almost touch, clearly visible stitched seams (small neat dashed stitches), shiny round black BUTTON eyes with a white highlight, a small embroidered smile, pink felt blush circles, a tiny silver ball-chain loop on top of the head (like a real crane-game prize), and a small BLANK white fabric tag sewn on one hip (no text on it). Crisp clean edges, clear saturated pastel colors, soft cel-like shading with a gentle rim light. Every cell shows exactly the same plush toy (same colors, shape, size, stitches, tag and accessories); only the pose changes. Full body, three-quarter front view, centered, about 72% of the cell height, transparent background, no ground shadow, no text.';
const DOLL_REF = `STYLE REFERENCE — before drawing, open the existing pictures of this game in Google Drive and study them: the pets in the Google Drive folder "${PET_SPRITES}" (MONG, NABI, PINKY and BAMBOO, 02_grown.png and 03_final.png), "36a-1.png" and "36a-3.png" in the Google Drive folder "SUMUS 새 펫 36 (Runner용)", "10-1.png" in the Google Drive folder "SUMUS 몬스터 10 (Runner용)" and "27c-1.png" in the Google Drive folder "SUMUS 낚시 27 (Runner용)". Draw the plush toy in exactly that art style: the same crisp clean shapes and edges, the same clear colors, the same glossy eyes with white highlights, the same light cel-like shading and rim light and the same level of detail, so it looks like it belongs in the same game. ${KEEP} Do NOT copy any pet; this is a new toy design.`;
const DOLL_POSES = [
  ['', '기본', 'SIT: sitting plush toy, slightly tilted head, happy calm face, paws resting in front (how it lies in the prize pile)'],
  ['-grab', '집힘', 'GRABBED: lifted up in the air as if pinched around the waist by an invisible crane claw (do NOT draw the claw): the middle of the body a little squished, arms, legs and tail dangling limply downward, surprised happy face with a small open mouth'],
  ['-fall', '떨어짐', 'TUMBLE: tumbling through the air, the whole toy rotated about 70 degrees to one side, limbs flopping outward, dizzy-cute face with a tiny open mouth, two small motion arcs beside it'],
  ['-joy', '기쁨', 'JOY: hopping up with both arms raised high, a big happy smile with closed happy eyes, three small sparkles around it (the toy celebrating being won)']
];
function checkDolls() {
  const keys = Object.keys(DOLLS);
  if (keys.length !== 12 || new Set(keys).size !== 12) throw new Error('인형은 12종이어야 해요.');
  const pets = keys.map(k => DOLLS[k].pet);
  if (pets.join() !== ZODIAC_PET_KEYS.join()) throw new Error(`인형 순서가 12지 펫 순서(core.js ZODIAC_PET_KEYS)와 달라요: ${pets.join(', ')}`);
}

// ── 43: 기계 · 집게 · UI ──────────────────────────────────────────────────────────────────
const MACHINE_STYLE = 'Style: glossy, cute premium mobile-game art, the same rendering quality as the pets and items of this game: chunky rounded shapes, candy-like glossy plastic and chrome, clear bright colors (fresh mint #10B981 to #6EE7B7 as the main color, with bubblegum-pink, lemon-yellow and sky-blue accents and polished silver metal), clean dark outlines, soft cel-like shading with crisp white highlights. Straight front view from slightly above (a gentle three-quarter high angle), so the inside floor of the machine is visible.';
const ITEM_STYLE = 'Style: glossy, cute premium mobile-game item art: chunky rounded shapes, clear bright colors (mint, bubblegum-pink, lemon-yellow, sky-blue and polished silver), clean dark outline, soft cel-like shading with one crisp white highlight, readable when shown small (about 64 pixels wide), one object per cell, straight front view.';
const ITEM_REF = `STYLE REFERENCE — before drawing, open "34b-1.png" and "34b-3.png" in the Google Drive folder "SUMUS 펫 사냥 34 (Runner용)" and "27c-1.png" and "29e-1.png" in the Google Drive folders "SUMUS 낚시 27 (Runner용)" and "SUMUS 낚시 29 (Runner용)": they show game art already used in this app. Draw the new items in exactly that style: the same glossy toy-like look, the same chunky rounded shapes, the same bright pastel-and-mint palette, the same clean edges and soft lighting. ${KEEP} Do NOT copy the reference objects.`;
const MACHINE_REF = `${ITEM_REF.replace('Draw the new items', 'Draw the machine')} Also look at the pets in the Google Drive folder "${PET_SPRITES}" (MONG and NABI, 02_grown.png): plush toys of this game will sit inside this machine, so it must look like their world.`;
const SINGLE_43 = 'Create ONE tall portrait image, 1024×1536 pixels, with a real transparent background (PNG alpha) around the object — do NOT paint a checkerboard, white box, floor, room or frame behind it. No text, no letters, no numbers, no logos, no labels, no watermark, no ground shadow. Do not ask me any questions; just generate the image.';
const MACHINE_SUBJECT = 'Subject: ONE cute premium CLAW-CRANE PRIZE MACHINE (a crane game cabinet), filling the picture top to bottom (about 94% of the height, about 84% of the width), centered. EMPTY inside: NO plush toys, NO prizes, NO claw, NO crane, NO rail and NO cable inside — the game draws the toys, the claw and its rail on top. Layout from top to bottom (keep these proportions, the game lines its pieces up with them): (1) top 0–13%: a rounded mint marquee crown with a row of small round light bulbs and a blank glossy sign panel (NO text) with a tiny star on top; (2) 13–64%: a big clear GLASS WINDOW showing the inside: a soft lit back wall with a gentle pink-to-mint gradient and small heart and star patterns, a plain pastel floor that fills the lower part of the window seen from slightly above (the prize-pile floor), and in the front-LEFT corner of that floor an open square prize hole (the chute opening) edged with a thin silver rim; thin silver frame pillars on both sides with tiny light bulbs; (3) 64–80%: a sloped control panel with an EMPTY round joystick socket on the left, an EMPTY round button socket on the right, a small token slot and a blank wide dark screen panel in the middle (NO numbers); (4) 80–100%: the lower cabinet, mint with pink trim, with a square prize pickup door on the LEFT (closed flap), and four short rounded feet.';
const SHEETS_43 = [
  { name: '43-1', title: '인형뽑기 기계 본체', single: true, cells: [['claw/machine', '기계 본체(속 비어 있음)']] },
  { name: '43-2', title: '인형뽑기 앞 겹침 부품', fit: '--trim --size 512',
    subject: 'Subject: separate overlay parts for the claw machine above (same mint, pink and silver look). Each part is drawn by itself, straight front view, filling about 70% of its cell.',
    cells: [['claw/chute-front', '배출구 앞벽', 'the FRONT WALL of the prize chute: a short clear see-through acrylic box wall (pale mint tint, glossy white reflections, a thin silver top rim), about as wide as it is tall, as seen from the front'],
      ['claw/glass-glare', '유리 반사', 'GLASS REFLECTION overlay: two or three soft diagonal white light streaks and a few tiny sparkles on a transparent background (semi-transparent white only, nothing else)'],
      ['claw/prize-door', '상품 문 열림', 'the PRIZE PICKUP DOOR, OPEN: a square mint door frame with pink trim and the flap swung open inward, the dark inside softly glowing with warm light (no toy in it)'],
      ['claw/chute-glow', '배출구 빛', 'CHUTE GLOW: a soft round ring of warm yellow-white light with tiny sparkles, seen slightly from above like light rising out of a hole (glow only)']] },
  { name: '43-3', title: '인형뽑기 집게', fit: '--union --size 384',
    subject: 'Subject: the CRANE CLAW of the machine: a glossy silver three-prong crane claw with a rounded mint motor hub on top, pink rubber tips on the prong ends, hanging straight down from the top of the cell by a short stub of cable. EXACTLY the same claw design, size and hub position in every cell (the game swaps these cells in place), the hub top always at the same height in the cell, centered left to right.',
    cells: [['claw/claw-open', '집게 열림', 'OPEN: all three prongs spread wide open, ready to drop'],
      ['claw/claw-closed', '집게 닫힘(빈)', 'CLOSED: all three prongs closed tightly together with nothing inside'],
      ['claw/claw-grip-back', '집게 쥠 뒤쪽', 'GRIP, BACK LAYER: the hub and only the ONE back prong, half closed (as if holding a fist-sized plush in front of it, leave that space empty); the two front prongs are NOT drawn'],
      ['claw/claw-grip-front', '집게 쥠 앞쪽', 'GRIP, FRONT LAYER: only the TWO front prongs, half closed around an empty fist-sized space in the middle, without the hub and without the back prong (the game puts this in front of the toy)']] },
  { name: '43-4', title: '인형뽑기 레일', fit: '--trim --size 512',
    subject: 'Subject: the crane RAIL parts of the machine (polished silver with mint and pink accents), straight front view.',
    cells: [['claw/carriage', '집게 받침', 'the CARRIAGE: a small rounded mint motor block with a pink cap and two silver wheels on top, a cable hole underneath (it rides on the rail and the cable hangs from it)'],
      ['claw/rail-x', '가로 레일', 'the HORIZONTAL RAIL: one long straight polished silver bar with a mint stripe and small rivets, lying left-to-right, filling the full cell width (the game stretches it)'],
      ['claw/rail-y', '세로 레일', 'the DEPTH RAIL: one straight polished silver bar going from the back to the front in perspective (narrower at the top, wider at the bottom), drawn upright in the cell'],
      ['claw/fx-clack', '집게 딸깍 효과', 'a small CLACK impact effect: a few short white and yellow burst lines with two tiny stars (effect only)']] },
  { name: '43-5', title: '인형뽑기 조작 버튼', fit: '--trim --size 384',
    subject: 'Subject: big touch controls of the claw game for a phone screen (the same glossy arcade look as the machine).',
    cells: [['claw/stick-base', '조이스틱 판', 'JOYSTICK BASE: a round glossy mint arcade joystick base plate seen from slightly above, a dark round socket in the middle, four tiny pale arrow bumps around it (no text)'],
      ['claw/stick-knob', '조이스틱 손잡이', 'JOYSTICK KNOB: a big glossy bubblegum-pink ball top on a short silver stick, with a crisp white highlight'],
      ['claw/btn-drop', 'DROP 버튼', 'DROP BUTTON, UP: a big round glossy coral-pink arcade push button in a silver ring, domed and raised, blank top (NO text, the game writes the label)'],
      ['claw/btn-drop-down', 'DROP 버튼 눌림', 'DROP BUTTON, PRESSED: the same button pushed down flat into its silver ring, a little darker, with a soft glow around the ring']] },
  { name: '43-6', title: '인형뽑기 숫자판 · 아이콘', fit: '--trim --size 512',
    subject: 'Subject: HUD pieces of the claw game (the same glossy arcade look as the machine). NO text and NO numbers anywhere (the game writes them).',
    cells: [['claw/readout', '숫자판', 'READOUT PANEL: a wide rounded dark-navy glass screen panel with a mint glowing border, small silver screws at the corners, completely EMPTY screen, about four times wider than tall'],
      ['claw/timer-ring', '타이머 테두리', 'TIMER RING: a round mint and silver stopwatch-like ring frame with a tiny button on top, EMPTY round middle'],
      ['claw/icon-ticket', '집게권 아이콘', 'CLAW TICKET icon: a pastel mint arcade ticket with a scalloped edge and a small silver crane-claw emblem in the middle (no text)'],
      ['claw/icon-box', '뽑은 인형 아이콘', 'PRIZE icon: a small round pink prize capsule (crane-game capsule ball), half open with a tiny plush ear and a heart peeking out']] }
];

// ── 44: 배경 · 입구 카드 ─────────────────────────────────────────────────────────────────
const BG_SHEET = 'Create ONE tall portrait image, 1024×1536 pixels: a full-screen 2D BACKGROUND behind a claw-crane machine in a cute premium mobile vocabulary game (players are high-school students), shown on a phone in portrait. Paint it fully to every edge (no transparency, no border, no frame, no rounded corners). NO claw machine, NO characters, NO animals, NO plush toys, NO people. No text, no letters, no numbers, no logos, no UI, no watermark. Do not ask me any questions; just generate the image.';
const BG_STYLE = 'Style: the same premium cute 3D-painted anime game art as the pets of this game: clear saturated colors (not washed out, not hazy), clean shapes, soft cel-like shading, gentle rim light, cheerful and dreamy.';
const BG_COMP = 'COMPOSITION (important, the game draws a big claw machine and buttons on top): the CENTER, about 80% of the width and from 10% to 90% of the height, is covered by the machine, so keep it soft, calm and fairly simple there (a gentle glow is fine). Put the details and depth around the outer edges and the top. The picture is shown about 390 pixels wide, so keep shapes big and readable. A gentle vignette toward the edges.';
const BG_REF = `STYLE REFERENCE — before drawing, open these pictures in Google Drive and match their rendering quality, color clarity and finish exactly: the pets in the folder "${PET_SPRITES}" (MONG, NABI, PINKY and BAMBOO, 02_grown.png), "34a-1.png" in the Google Drive folder "SUMUS 펫 사냥 34 (Runner용)" and "29a-1.png" in the Google Drive folder "SUMUS 낚시 29 (Runner용)" (backgrounds already used in this app: same level of detail, light and saturation). ${KEEP}`;
export const BG_44 = [
  { name: '44-1', key: 'bg-galaxy', title: '인형뽑기 반짝이 보라 배경', out: 'claw/bg-galaxy', size: [720, 1080],
    scene: 'Scene: a dreamy SPARKLY PURPLE arcade space: a deep violet-to-lilac gradient with soft pink and mint glows, floating glitter, tiny stars and round bokeh lights, a few soft pastel clouds drifting at the bottom, faint glowing heart and star shapes far away. Magical and sweet, like the inside of a toy-prize galaxy.' },
  { name: '44-2', key: 'bg-mint', title: '인형뽑기 민트 오락실 배경', out: 'claw/bg-mint', size: [720, 1080],
    scene: 'Scene: a bright, clean MINT GAME ARCADE in the daytime: mint and white tiled floor in gentle perspective at the bottom, soft out-of-focus rows of other colorful arcade cabinets and prize shelves (blank, no screens with text) along both sides, round paper lanterns and pastel bunting flags hanging from the ceiling, warm sunlight from big windows. Fresh, cheerful and tidy.' },
  { name: '44-3', key: 'bg-neon', title: '인형뽑기 밤 놀이공원 배경', out: 'claw/bg-neon', size: [720, 1080],
    scene: 'Scene: a cozy AMUSEMENT PARK AT NIGHT: a dusky navy-to-violet sky with stars, a glowing Ferris wheel and a carousel far away at the sides, strings of warm round bulbs crossing the top, soft neon glows in pink, mint and yellow (blank signs, NO letters), gentle fireworks sparkles high up. Exciting but friendly.' },
  { name: '44-4', key: 'entry', title: '인형뽑기 놀이터 입구 카드', out: 'claw/entry', size: [1280, 853], wide: true,
    scene: 'Scene: the PLAYGROUND ENTRY CARD of the claw game: a cute mint claw-crane machine (glossy, pink trim, light bulbs, NO text) on the RIGHT half, its glass full of a colorful pile of chubby pastel plush zodiac-animal toys (a lilac mouse, a sky-blue bunny, a coral-pink baby dragon, a lemon-yellow tiger with coral stripes, a baby-pink sheep and a mint piglet, each with button eyes, stitches and a tiny tag), the silver claw lifting one toy, a couple of toys tumbling out of the prize door with sparkles; soft sparkly lilac background. The LEFT 45% stays calm and simple (the game writes the title there).' }
].map(b => ({ ...b, text: [b.wide ? BG_SHEET.replace('ONE tall portrait image, 1024×1536 pixels: a full-screen 2D BACKGROUND behind a claw-crane machine', 'ONE wide landscape image, 1536×1024 pixels: a 2D CARD PICTURE for the claw-crane game').replace('NO claw machine, NO characters, NO animals, NO plush toys, NO people', 'NO characters, NO living animals, NO people (plush toys and the machine are fine)').replace(', shown on a phone in portrait', '') : BG_SHEET,
  BG_STYLE, BG_REF, b.scene, b.wide ? '' : BG_COMP, saveTo(DRIVE_44, b.name, `PNG (${b.wide ? '1536×1024' : '1024×1536'}, fully painted, not transparent)`)].filter(Boolean).join('\n') }));

// ── 45: 도감 카드 · 장식 · 황금 효과 ───────────────────────────────────────────────────
const SHEETS_45 = [
  { name: '45-1', title: '인형뽑기 도감 카드 틀', fit: '--trim --size 384',
    subject: 'Subject: COLLECTION-BOOK CARD frames for the plush toys of the claw game: tall rounded cards (about 3:4), all exactly the same size and shape, filling about 80% of the cell height. The middle of each card is a soft EMPTY window (the game puts the toy picture there). NO text, NO numbers.',
    cells: [['claw/card', '도감 카드 틀', 'the NORMAL card: a mint and cream card with a stitched felt border (dashed stitches), a small pink ribbon at the top, an empty soft pastel window'],
      ['claw/card-gold', '황금 카드 틀', 'the GOLDEN card: the same card in shiny gold and cream with a gold stitched border, a small gold ribbon and a few sparkles at the corners, an empty warm window'],
      ['claw/card-back', '아직 못 뽑은 카드', 'the NOT-YET card BACK: the same card shape turned over, a lilac quilted fabric pattern with a small embroidered claw emblem in the middle (no question mark, no text)'],
      ['claw/badge-complete', '도감 완성 배지', 'the COMPLETE badge: a round rosette badge with mint, pink and gold ribbon tails and a stitched plush heart in the middle, shiny and proud']] },
  { name: '45-2', title: '인형뽑기 장식', fit: '--fit-each --size 256',
    subject: 'Subject: small celebration decorations for the claw game, one per cell, each filling about 70% of its cell, glossy and cute.',
    cells: [['claw/fx-sparkle', '반짝임', 'a SPARKLE: a four-point white-gold twinkle star with a soft glow'],
      ['claw/fx-star', '별', 'a chubby glossy lemon-yellow STAR with a white highlight'],
      ['claw/fx-ribbon', '리본', 'a glossy bubblegum-pink RIBBON BOW with two short curled tails'],
      ['claw/fx-confetti', '색종이', 'a small burst of CONFETTI: mint, pink, yellow and sky-blue paper bits, tiny hearts and stars flying outward']] },
  { name: '45-3', title: '인형뽑기 황금 · 대박 효과', fit: '--fit-each --size 384',
    subject: 'Subject: golden and jackpot effects for the claw game, one per cell, glossy and festive.',
    cells: [['claw/gold-aura', '황금 오라', 'a GOLDEN AURA: a soft round ring of warm golden light with glitter and tiny stars, EMPTY in the middle (the game puts a toy in it)'],
      ['claw/gold-ribbon', '황금 리본 배지', 'a GOLD RIBBON TAG: a small shiny gold ribbon bow with a little gold star charm (the game pins it on a golden toy)'],
      ['claw/fx-jackpot', '대박 빛줄기', 'a JACKPOT BURST: bright rays of golden and white light bursting outward from the center with sparkles, round overall'],
      ['claw/trophy', '도감 완성 트로피', 'a cute PLUSH TROPHY: a chubby golden trophy cup made of shiny gold satin fabric with stitched seams, a pink ribbon tied on the handle, sparkles around it']] }
];
const ART_45_REF = ITEM_REF;

const toSplitName = s => `${s.name} ${s.title.replace(/[\\/:*?"<>|()★·]/g, ' ').replace(/\s+/g, ' ').trim()}.txt`;

// 시트 목록(주문 번호마다). cells: [app 이름(public/assets/ 아래, 확장자 없이), 한국어 이름]
export function sheets42() {
  checkDolls();
  const out = [];
  Object.entries(DOLLS).forEach(([key, d], i) => {
    const name = `42a-${i + 1}`, petName = CHARACTERS[d.pet]?.ko || d.animal;
    const lines = [SHEET, DOLL_STYLE, DOLL_REF];
    if (i > 0) lines.push(`Also open "42a-1.png" in the same Google Drive folder "${DRIVE_42}" (the first plush toy of this set) if it is there, and match its fabric look, stitches, button eyes, tag, ball-chain loop, size in the cell and level of detail exactly. Do NOT copy its animal or colors.`);
    lines.push(`Subject: "${d.ko} 인형", a plush zodiac-animal toy (${key}): ${d.looks}.`);
    lines.push(`It is a STUFFED TOY, not a living pet: it must look clearly different from ${d.petColor} of this game (${petName}) — different colors, plush fabric, visible stitches, button eyes, the blank hip tag and the ball-chain loop. Do NOT copy that pet.`);
    DOLL_POSES.forEach(([, , text], c) => lines.push(`${CELLS[c]} cell: ${text}`));
    lines.push(saveTo(DRIVE_42, name));
    out.push({ no: 42, key, name, file: FILES_42[42], title: `인형 ${d.ko}`, fit: '--stand-same --small 128', text: lines.join('\n'),
      cells: DOLL_POSES.map(([suffix, ko], c) => ({ cell: CELL_KO[c], key: `claw-doll-${key}${suffix}`, name: `${d.ko} 인형 ${ko}`, out: `public/assets/claw/doll-${key}${suffix}.webp` })) });
  });
  SHEETS_43.forEach((s, i) => {
    const lines = s.single ? [SINGLE_43, MACHINE_STYLE, MACHINE_REF, MACHINE_SUBJECT] : [SHEET, ITEM_STYLE, ITEM_REF];
    if (!s.single) {
      lines.push(`Also open "43-1.png" in the same Google Drive folder "${DRIVE_43}" (the claw machine of this set) if it is there, and match its colors, materials and finish exactly.`);
      lines.push(s.subject);
      s.cells.forEach(([, , text], c) => lines.push(`${CELLS[c]} cell: ${text}`));
    }
    lines.push(saveTo(DRIVE_43, s.name, s.single ? 'transparent PNG (1024×1536)' : 'transparent PNG'));
    out.push({ no: 43, key: s.name, name: s.name, file: FILES_42[43], title: s.title, single: !!s.single, fit: s.fit, text: lines.join('\n'),
      cells: s.cells.map(([app, ko], c) => ({ cell: s.single ? '전체' : CELL_KO[c], key: app.replace('/', '-'), name: ko, out: `public/assets/${app}.webp` })) });
  });
  for (const b of BG_44) out.push({ no: 44, key: b.key, name: b.name, file: FILES_42[44], title: b.title, bg: b, text: b.text,
    cells: [{ cell: '전체', key: b.out.replace('/', '-'), name: b.title, out: `public/assets/${b.out}.webp` }] });
  SHEETS_45.forEach(s => {
    const lines = [SHEET, ITEM_STYLE, ART_45_REF];
    if (s.name !== '45-1') lines.push(`Also open "45-1.png" in the same Google Drive folder "${DRIVE_45}" (the first sheet of this set) if it is there, and match its colors and finish exactly.`);
    lines.push(s.subject);
    s.cells.forEach(([, , text], c) => lines.push(`${CELLS[c]} cell: ${text}`));
    lines.push(saveTo(DRIVE_45, s.name));
    out.push({ no: 45, key: s.name, name: s.name, file: FILES_42[45], title: s.title, fit: s.fit, text: lines.join('\n'),
      cells: s.cells.map(([app, ko], c) => ({ cell: CELL_KO[c], key: app.replace('/', '-'), name: ko, out: `public/assets/${app}.webp` })) });
  });
  // 겹침 검사: 앱 파일 · key가 서로, 그리고 기존 slice-map(42 ~ 45 밖) · 그림 폴더와 겹치면 안 된다.
  const cells = out.flatMap(s => s.cells);
  const dup = (list, f) => list.map(f).filter((v, i, a) => a.indexOf(v) !== i);
  const twice = [...dup(cells, c => c.out), ...dup(cells, c => c.key)];
  if (twice.length) throw new Error(`주문서 42 ~ 45 안에서 겹쳐요: ${twice.join(', ')}`);
  const map = readFileSync(resolve(here, 'slice-map.csv'), 'utf8').split('\n').filter(r => r && !OWN_ROW.test(r));
  const taken = cells.filter(c => map.some(r => r.includes(`"${c.out}"`) || r.includes(`"${c.key}"`)));
  if (taken.length) throw new Error(`기존 slice-map과 겹쳐요: ${taken.map(c => c.out).join(', ')}`);
  const onDisk = cells.filter(c => existsSync(resolve(ASSETS, c.out.replace('public/assets/', ''))));
  if (onDisk.length) console.warn(`이미 있는 그림(바꿔 쓰지 않게 조심): ${onDisk.map(c => c.out).join(', ')}`);
  return out;
}
const OWN_ROW = /^"(42a-|43-claw|44-claw|45-claw)/;

// ── CODEX_PROMPT ──────────────────────────────────────────────────────────────────────────
// Codex에는 Drive가 없다: 시트 프롬프트의 Drive 줄을 지우고 저장소 안의 그림을 참고 그림으로 붙인다(36 ~ 41과 같은 "프롬프트 손보기").
const FIT_HEAD = 'R=docs/asset-requests/runner';
const BRANCH = 'claude/claw-design';
const head = (no, what, sheets, goal) => `# Codex 작업 지시: 그림 ${no} (인형뽑기 · ${what} · ${sheets}시트)

## 목표
놀이터 새 게임 **인형뽑기**(구성안 \`docs/claw-machine-design.md\`)에 쓸 ${goal}
**그림 파일만 넣는다. 앱 코드는 고치지 않는다.**

> ⚠️ **이 그림만으로는 인형뽑기가 앱에 나오지 않는다.** 게임 코드 · 서버 판정 · 그림 목록(\`claw-art.js\`, 그림 게이트)은 다음 세션에서 만든다(구성안 §8 · §13).
> 지금 \`public/assets/claw/\`를 읽는 코드가 없어서, 그림만 먼저 들어와도 앱은 바뀌지 않고 깨지지 않는다(\`build:assets\`는 새 폴더를 서비스 워커 목록에만 더한다).
`;
const rules = (no, file, drive, extra = '') => `## 꼭 지킬 것
- **기존 그림과 같은 게임 그림체**(펫 · 몬스터 · 낚시 · 몬스터 사냥 그림)로 맞춘다. 더 흐리거나 뿌옇거나 수채화처럼 만들지 않는다.
- 그림에 **글자 · 숫자 · 로고를 넣지 않는다**(버튼 · 숫자판 · 표지판은 비워 둔다. 글자는 앱이 쓴다).${extra}
- **PR까지만 만든다. 머지하지 않는다.** \`sumus-voca-prod-deploy\`에 머지하면 운영에 바로 배포된다. **운영 Supabase에 연결하지 않는다.**
- **그림은 Codex에 내장된 그림 생성 기능으로 만든다.** OpenAI API 키나 유료 API를 쓰지 않는다. 키가 없다고 멈추지 않는다.
- **Google Drive는 쓰지 않는다. 멈추지 않는다.** Codex에는 Drive가 없다. 아래 "프롬프트 손보기"대로 Drive 문구를 지우고 저장소 안의 그림을 참고 그림으로 붙인다.
- 고치는 파일: \`public/assets/claw/\` 아래 **새 그림**, 빌드가 바꾸는 \`public/sw.js\`, \`docs/asset-requests/runner/DONE_${no}.md\`. 앱 코드 · 게임 규칙 · 코인 · 서버 · 점검 파일은 건드리지 않는다. 버전은 올리지 않는다.
- 기존 그림 파일은 지우거나 덮어쓰지 않는다. **새 파일만 추가**한다. 원본 PNG는 커밋하지 않는다(\`/tmp/art/\`).
- **브랜치:** \`sumus-voca-prod-deploy\`에서 새로 만든다(예: \`codex/art-${no}\`). 그 브랜치에 \`docs/asset-requests/runner/${file}\`가 없으면 주문서 PR이 아직 머지되지 않은 것이다. 그때는 \`${BRANCH}\`에서 시작하고 PR 대상도 그 브랜치로 한다.

## 입력 (저장소 안, \`docs/asset-requests/runner/\`)
- \`split/${no}…\`: 시트 하나 = 프롬프트 하나. 묶음 전체는 \`${file}\`.
- \`slice-map.csv\`: \`list\` 열이 \`${file}\`인 줄 = 칸마다 넣을 앱 파일(\`app_file\`). **이 이름이 다음 세션 코드가 읽는 이름이다. 바꾸지 않는다.** 칸 순서는 왼쪽 위 → 오른쪽 위 → 왼쪽 아래 → 오른쪽 아래.
- 자르기 도구: \`fit-assets.mjs\`(사용법은 파일 맨 위 주석). \`sharp\`가 없으면 \`npm i --no-save sharp\`.

### 프롬프트 손보기 (Drive 대신 참고 그림 첨부)
시트 프롬프트(\`split/\`)는 그림 GPT가 Google Drive를 여는 방식으로 쓰여 있다(Drive의 기존 그림을 열어 그림체를 맞추고, 정해진 Drive 폴더 "${drive}"에 정확한 파일 이름으로 저장). Codex는 Drive를 쓰지 않으니 보내기 전에 이렇게 바꾼다.
1. 다음으로 **시작하는 줄을 지운다**: \`STYLE REFERENCE\`, \`CHARACTER REFERENCE\`, \`Also open\`, \`WHEN DONE\`
`;
const finish = (no, title, extraDone) => `## 3. 마무리
\`\`\`
npm ci
npm run build:assets
npm run check             # release-check 전부 PASS
npm run check:cloudflare
\`\`\`
- 점검이 실패하면 점검 파일을 고치지 말고 PR에 실패 메시지를 그대로 적는다.
- 기존 그림의 \`D\`(삭제) · \`M\`(수정)이 없어야 한다: \`git diff --name-status origin/sumus-voca-prod-deploy -- public/assets\`
- \`docs/asset-requests/runner/DONE_${no}.md\`(한국어): 넣은 그림 표(시트 · 파일 · 다시 만든 횟수), 넣지 못한 것과 이유, "눈으로 확인 필요".${extraDone} 마지막에 "인형뽑기는 게임 코드(다음 세션)가 생겨야 앱에 나온다"를 적는다.
- PR 제목 \`그림 ${no}: ${title}\`, 본문 한국어. 미리보기 그림(\`/tmp/review/*.png\`)을 한 장으로 작게 합쳐 PR 코멘트로 올린다. 마지막 줄: \`> ⚠️ 머지하면 운영에 바로 배포됩니다. 인형뽑기는 게임 코드가 생기기 전까지 앱에 나오지 않습니다.\` **머지하지 않는다.**
`;
const CHECK_SHEET = `### 후보 점검 (모두 통과해야 쓴다)
1. 배경이 진짜 투명이다(네 모서리 alpha 0, 체크무늬 · 흰 상자 · 흰 테두리 없음).
2. 칸마다 그림이 하나씩 따로 있고, 겹치거나 잘리지 않았다. 글자, 숫자, 로고, 바닥 그림자가 없다.
3. 기존 그림(참고 그림)과 나란히 놓아도 같은 게임 그림처럼 보인다.`;

function dollCodex(list) {
  const rows = list.map(s => `| \`${s.name}\` | \`${s.key}\` | ${s.title.replace('인형 ', '')} | ${DOLLS[s.key].animal} | \`pets/${DOLLS[s.key].pet}-1.webp\` |`).join('\n');
  const fit = list.map(s => `node $R/fit-assets.mjs /tmp/art/${s.name}.png ${s.cells.map(c => c.out.replace('public/assets/', '').replace('.webp', '')).join(' ')} ${s.fit} --preview /tmp/review/${s.name}.png`).join('\n');
  return `${head(42, '인형 12종', list.length, `12지 동물 **봉제 인형 12종**의 그림을 만들고, 잘라서 \`public/assets/claw/\`에 넣은 뒤 PR을 만든다. 인형마다 **기본 · 집힘 · 떨어짐 · 기쁨** 4자세(${list.length * 4}장, 모두 필요)와 작은 그림(\`-s\`, 128px)이다.`)}
| 시트 | key | 이름 | 동물 | 헷갈리면 안 되는 진짜 펫(참고) |
|---|---|---|---|---|
${rows}

- 앱은 \`public/assets/claw/doll-<key>.webp\` · \`-grab\` · \`-fall\` · \`-joy\`(+ 각 \`-s\`)를 그대로 읽는다. 네 자세가 다 있는 인형만 게임에 나온다(그림 게이트). **key를 바꾸지 않는다.**
- **진짜 12지 펫과 헷갈리지 않게** 하는 것이 가장 중요하다: 시트마다 펫과 다른 색 · 봉제 선 · 단추 눈 · 엉덩이 쪽 빈 천 태그 · 머리 위 볼체인 고리가 들어간다.

${rules(42, FILES_42[42], DRIVE_42, '\n- **인형(봉제 장난감)**이지 살아 있는 펫이 아니다. 진짜 펫 그림을 베끼지 않는다. 128px로 줄여도 어떤 동물인지 알아볼 수 있는 큰 실루엣.')}2. 아래 표의 참고 그림을 같이 보여 주고, 프롬프트 **세 번째 줄**에 이 문장을 넣는다:
   \`REFERENCE IMAGES ARE ATTACHED: match their art style, rendering quality, crisp clean edges and colors exactly. The pet pictures show living pets of this game: make the plush toy clearly DIFFERENT from them (different colors, fabric, stitches, button eyes, tag, ball-chain loop). Do NOT copy any character from the references; this is a new toy design.\`
3. \`42a-2\`부터는 참고 그림에 방금 만든 첫 시트 \`/tmp/art/42a-1.png\`도 같이 붙인다(천 느낌 · 봉제 선 · 단추 눈 · 태그 · 칸 안 크기를 맞춘다. 동물 · 색은 베끼지 않는다).

### 참고 그림 (\`public/assets/\` 아래 경로)
| 시트 | 참고 그림 |
|---|---|
| 모든 시트 | \`pets/cat-1.webp\`, \`pets/panda-2.webp\`, \`pets/rabbit-1-happy.webp\` (우리 펫 그림체), \`monsters/mochi.webp\` (반짝임 · 테두리), \`fishing/bait-can.webp\`, \`hunt/ball-basic.webp\` (물건 그림 마감) |
| 시트마다 | 위 표의 "진짜 펫" 그림(예: \`42a-1\`은 \`pets/mouse-1.webp\`) — **다르게 그리기 위한** 참고 |
| 42a-2 이후 | \`/tmp/art/42a-1.png\` (같은 묶음의 첫 시트) |

${CHECK_SHEET}
4. 네 칸이 같은 인형(색 · 모양 · 크기 · 태그 · 고리가 같음), 자세만 다르다. 진짜 펫과 나란히 놓아도 "인형"으로 바로 보이고 색이 다르다. 128px로 줄여도 알아볼 수 있다.

이미지를 볼 수 있으면 눈으로 확인한다. 볼 수 없으면 1~2번만 확인하고 PR에 "눈으로 확인 필요"라고 적는다.

## 1. 그림 만들기
- **Codex의 내장 그림 생성 기능**으로 시트를 하나씩 만든다. API를 직접 부르지 않는다.
- 2×2 시트 1024×1024, **투명 배경 PNG**. 칸: 왼쪽 위 기본 · 오른쪽 위 집힘 · 왼쪽 아래 떨어짐 · 오른쪽 아래 기쁨.
- 만든 그림은 \`/tmp/art/<시트 번호>.png\`로 저장한다(예: \`/tmp/art/42a-1.png\`). 점검을 통과하지 못하면 같은 프롬프트로 다시 만든다. 시트마다 최대 4번이다.
- 보내는 순서: \`42a-1\` → \`42a-2\` … \`42a-12\`. 한 번에 다 못 만들면 **인형 하나를 끝까지** 만든 단위로 끊는다.

## 2. 자르고 넣기
네 자세를 같은 배율로 바닥에 세운다(\`--stand-same\`, 512×512 webp, 투명) + 작은 그림 128px(\`--small 128\`).
\`\`\`
mkdir -p public/assets/claw
${FIT_HEAD}
${fit}
\`\`\`
- 칸 이름은 \`slice-map.csv\`의 \`app_file\`과 같아야 한다(틀리면 앱이 그림을 못 찾는다).
- 네 자세 중 하나라도 못 넣은 인형은 네 장 모두 넣지 않는다(그림 게이트가 그 인형을 빼고 쓴다).

${finish(42, `인형뽑기 인형 12종 (${list.map(s => s.key).join(' · ')})`, ' 인형마다 "진짜 펫과 다르게 보이는 점"을 한 줄씩 적는다.')}`;
}

function machineCodex(list) {
  const rows = list.map(s => `| \`${s.name}\` | ${s.title} | ${s.cells.map(c => `\`${c.out.replace('public/assets/', '')}\``).join(' · ')} |`).join('\n');
  const fit = list.filter(s => !s.single).map(s => `node $R/fit-assets.mjs /tmp/art/${s.name}.png ${s.cells.map(c => c.out.replace('public/assets/', '').replace('.webp', '')).join(' ')} ${s.fit} --preview /tmp/review/${s.name}.png`).join('\n');
  return `${head(43, '기계 · 집게 · 조작 UI', list.length, '**인형뽑기 기계 본체**(세로 한 장)와 그 위에 겹치는 부품 · 집게 · 레일 · 조작 버튼 · 숫자판 그림을 만들고, 잘라서 `public/assets/claw/`에 넣은 뒤 PR을 만든다.')}
| 시트 | 내용 | 넣을 파일 |
|---|---|---|
${rows}

- 앱은 그림을 층으로 쌓는다(뒤 → 앞): 배경 → **기계 본체(속이 빈 기계)** → 인형 더미 → 집게 뒤 발톱 → 잡힌 인형 → 집게 앞 발톱 · 레일 → 배출구 앞벽 → 유리 반사 → 버튼. 그래서 **기계 본체 안에는 인형 · 집게 · 레일을 그리지 않는다.**
- \`43-3\` 집게 네 칸은 **같은 크기 · 같은 위치**여야 한다(앱이 제자리에서 바꿔 끼운다). \`--union\`으로 같은 창으로 자른다.

${rules(43, FILES_42[43], DRIVE_43, '\n- 기계 본체는 프롬프트의 층 비율(위 장식 0~13% · 유리창 13~64% · 조작판 64~80% · 아래 몸통 80~100%, 배출구는 바닥 앞 왼쪽)을 지킨다. 다음 세션이 실제 그림에서 창 위치를 재서 맞춘다.')}2. 아래 표의 참고 그림을 같이 보여 주고, 프롬프트 **세 번째 줄**에 이 문장을 넣는다:
   \`REFERENCE IMAGES ARE ATTACHED: match their art style, rendering quality, glossy toy-like finish, crisp clean edges and colors exactly. Do NOT copy any object or character from the references; this is a new design.\`
3. \`43-2\`부터는 참고 그림에 방금 만든 기계 \`/tmp/art/43-1.png\`도 같이 붙인다(색 · 재질 · 마감을 맞춘다).

### 참고 그림 (\`public/assets/\` 아래 경로)
| 시트 | 참고 그림 |
|---|---|
| 모든 시트 | \`hunt/ball-basic.webp\`, \`hunt/ball-gold.webp\`, \`hunt/bag.webp\`, \`fishing/btn-cast.webp\`, \`fishing/btn-reel.webp\`, \`fishing/bait-can.webp\` (같은 게임의 물건 · 버튼 그림) |
| 43-1 기계 본체 | 위 + \`pets/cat-1.webp\`, \`pets/panda-1.webp\` (이 기계 안에 앉을 인형 그림체의 세계) |
| 43-2 이후 | 위 + \`/tmp/art/43-1.png\` (같은 묶음의 기계) |

${CHECK_SHEET}
4. \`43-1\`: 기계 하나만, 바깥은 투명, **속이 비었다**(인형 · 집게 · 레일 · 줄 없음), 위 장식 · 유리창 · 조작판 · 아래 몸통 비율이 대략 맞고, 배출구 구멍이 바닥 앞 왼쪽 · 상품 문이 아래 왼쪽에 있다. 표지판 · 화면이 비어 있다.
5. \`43-3\`: 집게 네 칸의 모터 머리 위치 · 크기가 같다. \`43-5\` · \`43-6\`: 버튼 · 숫자판에 글자가 없다.

이미지를 볼 수 있으면 눈으로 확인한다. 볼 수 없으면 1~2번만 확인하고 PR에 "눈으로 확인 필요"라고 적는다.

## 1. 그림 만들기
- **Codex의 내장 그림 생성 기능**으로 하나씩 만든다. \`43-1\`은 **세로 1024×1536 투명 PNG**, 나머지는 2×2 시트 1024×1024 투명 PNG.
- \`/tmp/art/43-1.png\` … \`/tmp/art/43-6.png\`로 저장한다. 점검을 통과하지 못하면 다시 만든다(장마다 최대 4번).
- 보내는 순서: \`43-1\` → \`43-2\` … \`43-6\` (기계가 먼저 있어야 부품이 맞출 수 있다).

## 2. 자르고 넣기
\`\`\`
mkdir -p public/assets/claw
# 43-1 기계 본체: 768×1152 webp(투명 유지), 300KB 이하(넘으면 quality를 낮춘다)
node --input-type=module -e "
import sharp from 'sharp';
await sharp('/tmp/art/43-1.png').resize(768, 1152, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).webp({ quality: 86, alphaQuality: 90, effort: 6 }).toFile('public/assets/claw/machine.webp');
"
${FIT_HEAD}
${fit}
\`\`\`
- 칸 이름은 \`slice-map.csv\`의 \`app_file\`과 같아야 한다.
- \`43-3\` 집게 네 장 중 하나라도 못 넣으면 네 장 모두 넣지 않는다.

${finish(43, '인형뽑기 기계 · 집게 · 조작 UI', ' `43-1`의 유리창 · 바닥 · 배출구 구멍 위치를 그림 높이의 %로 재서 적는다(다음 세션이 층을 맞출 때 쓴다).')}`;
}

function bgCodex(list) {
  const rows = list.map(s => `| \`${s.name}\` | ${s.title.replace('인형뽑기 ', '')} | \`${s.cells[0].out}\` | ${s.bg.size.join('×')} |`).join('\n');
  const cmds = list.map(s => `  "${s.name}": ["${s.bg.out}", ${s.bg.size.join(', ')}]`).join(',\n');
  return `${head(44, '배경 3장 · 입구 카드', list.length, '**배경 3장**(세로, 기계 뒤에 깔림)과 **놀이터 입구 카드 1장**(가로)을 만들고, 줄여서 `public/assets/claw/`에 넣은 뒤 PR을 만든다.')}
| 시트 | 내용 | 넣을 파일 | 크기 |
|---|---|---|---|
${rows}

${rules(44, FILES_42[44], DRIVE_44, '\n- 투명 PNG가 아니다: 가장자리까지 꽉 채워 그린 그림이다. 배경 3장에는 기계 · 캐릭터 · 동물 · 인형 · 사람을 그리지 않는다(앱이 기계를 그 위에 그린다). 가운데는 조용하게.')}2. 아래 표의 참고 그림을 같이 보여 주고, 프롬프트 **세 번째 줄**에 이 문장을 넣는다:
   \`REFERENCE IMAGES ARE ATTACHED: match their art style, rendering quality, color clarity and finish exactly. The pictures must look like one set with the backgrounds shown. Do NOT draw any character, animal or monster from the references.\`
3. \`44-2\`부터는 방금 만든 \`/tmp/art/44-1.png\`도 같이 붙인다(마감 · 밝기 · 디테일을 맞춘다. 장면은 베끼지 않는다).

### 참고 그림 (\`public/assets/\` 아래 경로)
| 시트 | 참고 그림 |
|---|---|
| 모든 시트 | \`hunt/bg-forest-day.webp\`, \`hunt/bg-catch.webp\`, \`fishing/bg-entry.webp\`, \`fishing/bg-tank.webp\` (같은 게임의 배경) |
| 44-3 밤 놀이공원 | 위 + \`hunt/bg-forest-night.webp\` (밤 색감) |
| 44-4 입구 카드 | 위 + \`hunt/entry.webp\`, \`match/entry.webp\` (놀이터 입구 카드), \`pets/cat-1.webp\`, \`pets/panda-1.webp\` (인형 그림체) · 주문서 42 그림이 이미 있으면 \`claw/doll-rabbit.webp\` 등도 |
| 44-2 이후 | \`/tmp/art/44-1.png\` |

### 후보 점검 (모두 통과해야 쓴다)
1. 가장자리까지 꽉 찬 그림이다(투명 · 테두리 · 둥근 모서리 없음). 글자 · 숫자 · 로고 · UI가 없다.
2. 배경 3장: 기계 · 캐릭터 · 동물 · 인형 · 사람이 없고, 가운데(너비 80% · 높이 10~90%)가 조용하다.
3. 입구 카드: 왼쪽 45%가 조용하다(앱이 제목을 쓴다).
4. 기존 배경과 나란히 놓아도 같은 게임 그림이다. 폭 390px로 줄여도 알아볼 수 있다.

## 1. 그림 만들기
- **Codex의 내장 그림 생성 기능**으로 하나씩 만든다. 배경은 세로 1024×1536, 입구 카드는 가로 1536×1024 PNG. \`/tmp/art/44-1.png\` … \`/tmp/art/44-4.png\`로 저장한다. 점검을 통과하지 못하면 다시 만든다(장마다 최대 4번).

## 2. 줄여서 넣기
\`\`\`
mkdir -p public/assets/claw
node --input-type=module -e "
import sharp from 'sharp';
const map = {
${cmds}
};
for (const [n, [out, w, h]] of Object.entries(map)) await sharp('/tmp/art/' + n + '.png').resize(w, h, { fit: 'cover' }).webp({ quality: 80, effort: 6 }).toFile('public/assets/' + out + '.webp');
"
\`\`\`
- 배경 720×1080 webp는 장마다 **150KB 이하**, 입구 카드 1280×853은 **200KB 이하**(넘으면 quality를 낮춘다).

${finish(44, '인형뽑기 배경 3장 · 입구 카드 (반짝이 보라 · 민트 오락실 · 밤 놀이공원)', '')}`;
}

function bookCodex(list) {
  const rows = list.map(s => `| \`${s.name}\` | ${s.title.replace('인형뽑기 ', '')} | ${s.cells.map(c => `\`${c.out.replace('public/assets/', '')}\``).join(' · ')} |`).join('\n');
  const fit = list.map(s => `node $R/fit-assets.mjs /tmp/art/${s.name}.png ${s.cells.map(c => c.out.replace('public/assets/', '').replace('.webp', '')).join(' ')} ${s.fit} --preview /tmp/review/${s.name}.png`).join('\n');
  return `${head(45, '도감 카드 · 장식 · 황금 효과', list.length, '**도감 카드 틀**(보통 · 황금 · 아직 못 뽑은 카드 뒷면 · 완성 배지), **축하 장식**(반짝임 · 별 · 리본 · 색종이), **황금 · 대박 효과**(황금 오라 · 황금 리본 · 대박 빛줄기 · 도감 완성 트로피)를 만들고, 잘라서 `public/assets/claw/`에 넣은 뒤 PR을 만든다.')}
| 시트 | 내용 | 넣을 파일 |
|---|---|---|
${rows}

- 인형별 도감 실루엣은 그리지 않는다: 다음 세션이 인형 기본 그림(주문서 42)을 코드로 검게 만들어 쓴다(늘 모양이 정확하다). 아직 못 뽑은 칸은 \`card-back\`.
- 황금 인형도 따로 그리지 않는다: 기본 그림에 금빛 필터 + \`gold-aura\` · \`gold-ribbon\`을 겹친다.

${rules(45, FILES_42[45], DRIVE_45)}2. 아래 표의 참고 그림을 같이 보여 주고, 프롬프트 **세 번째 줄**에 이 문장을 넣는다:
   \`REFERENCE IMAGES ARE ATTACHED: match their art style, rendering quality, glossy toy-like finish, crisp clean edges and colors exactly. Do NOT copy any object or character from the references; this is a new design.\`
3. \`45-2\`부터는 방금 만든 \`/tmp/art/45-1.png\`도 같이 붙인다.

### 참고 그림 (\`public/assets/\` 아래 경로)
| 시트 | 참고 그림 |
|---|---|
| 모든 시트 | \`hunt/fx-sparkle.webp\`, \`hunt/fx-star.webp\`, \`hunt/fx-burst.webp\`, \`hunt/ball-gold.webp\`, \`fishing/bait-can.webp\` (같은 게임의 효과 · 물건 그림) |
| 45-1 도감 카드 | 위 + \`titles/attend100.webp\` (칭호 메달 마감) |
| 45-2 이후 | \`/tmp/art/45-1.png\` |

${CHECK_SHEET}
4. \`45-1\` 카드 세 장(보통 · 황금 · 뒷면)이 같은 크기 · 모양이고, 가운데 창이 비어 있다. 물음표 · 글자가 없다.

## 1. 그림 만들기
- **Codex의 내장 그림 생성 기능**으로 하나씩 만든다. 2×2 시트 1024×1024 투명 PNG, \`/tmp/art/45-1.png\` … \`/tmp/art/45-3.png\`. 점검을 통과하지 못하면 다시 만든다(장마다 최대 4번).

## 2. 자르고 넣기
\`\`\`
mkdir -p public/assets/claw
${FIT_HEAD}
${fit}
\`\`\`
- 칸 이름은 \`slice-map.csv\`의 \`app_file\`과 같아야 한다.

${finish(45, '인형뽑기 도감 카드 · 장식 · 황금 효과', '')}`;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const list = sheets42();
  const of = no => list.filter(s => s.no === no);
  for (const no of [42, 43, 44, 45]) writeFileSync(resolve(here, FILES_42[no]), of(no).map(s => s.text).join('\n---\n') + '\n');
  writeFileSync(resolve(here, 'CODEX_PROMPT_42.md'), dollCodex(of(42)));
  writeFileSync(resolve(here, 'CODEX_PROMPT_43.md'), machineCodex(of(43)));
  writeFileSync(resolve(here, 'CODEX_PROMPT_44.md'), bgCodex(of(44)));
  writeFileSync(resolve(here, 'CODEX_PROMPT_45.md'), bookCodex(of(45)));
  const split = resolve(here, 'split');
  mkdirSync(split, { recursive: true });
  for (const f of readdirSync(split)) if (/^(42a|43|44|45)-\d+ /.test(f)) unlinkSync(resolve(split, f));
  for (const s of list) writeFileSync(resolve(split, toSplitName(s)), s.text + '\n');
  // slice-map.csv: 42 ~ 45 줄을 지우고 뒤에 다시 붙인다(번호는 앞의 마지막 번호 다음부터).
  const mapPath = resolve(here, 'slice-map.csv');
  const rows = readFileSync(mapPath, 'utf8').replace(/\n+$/, '').split('\n').filter(r => !OWN_ROW.test(r));
  let no = Math.max(...rows.slice(1).map(r => Number(r.split(',')[1]?.replace(/"/g, '')) || 0));
  const csv = v => `"${String(v).replace(/"/g, '""')}"`;
  const first = no + 1;
  for (const s of list) { no++; for (const c of s.cells) rows.push([s.file, String(no).padStart(3, '0'), s.title, c.cell, c.key, c.name, c.out].map(csv).join(',')); }
  writeFileSync(mapPath, rows.join('\n') + '\n');
  const pics = list.reduce((n, s) => n + s.cells.length, 0);
  console.log(`42 ~ 45: ${list.length}시트 → 그림 ${pics}장 (42 인형 ${of(42).length} · 43 기계 ${of(43).length} · 44 배경 ${of(44).length} · 45 도감 ${of(45).length}), prompt_no ${String(first).padStart(3, '0')}~${String(no).padStart(3, '0')}`);
}
