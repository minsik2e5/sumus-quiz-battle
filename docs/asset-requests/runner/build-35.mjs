// 그림 주문서 35: 몬스터 사냥 장소 몬스터 36종(숲 · 들판 · 바닷가 · 밤 × 9) × 기본 · 공격 · 맞음(+ 쓰러짐 여분).
//   node docs/asset-requests/runner/build-35.mjs
// 몬스터 이름 · 등급 · 장소는 public/modules/hunt-rules.js(HUNT_MONSTERS)에서 읽는다. 여기에는 생김새(영어)만 둔다.
// 만드는 것: 35a~35d 주문서(.txt), split/ 시트별 파일, slice-map.csv의 35 줄(있으면 바꿔 쓴다).
// (build-runner.mjs는 26번 이후를 모르므로 돌리지 않는다: slice-map.csv 뒤쪽이 지워진다.)
import { readFileSync, writeFileSync, mkdirSync, readdirSync, unlinkSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { HUNT_MONSTERS, HUNT_PLACES, tierLabel } from '../../../public/modules/hunt-rules.js';

const here = dirname(fileURLToPath(import.meta.url));
export const DRIVE_35 = 'SUMUS 몬스터 35 (Runner용)';
const PET_SPRITES = 'SUMUS_PET_SPRITES_ALL_20261002/original_1254';
export const FILES_35 = { forest: '35a-hunt-forest-monsters.txt', field: '35b-hunt-field-monsters.txt', beach: '35c-hunt-beach-monsters.txt', night: '35d-hunt-night-monsters.txt' };
const SERIES = { forest: '35a', field: '35b', beach: '35c', night: '35d' };

const SHEET = 'Create ONE square image, 1024×1024 pixels, laid out as a 2×2 sprite sheet: four separate illustrations, one centered in each quarter (each quarter is 512×512). Leave generous empty space around every illustration so nothing touches or crosses the middle lines or the image edges. Use a real transparent background (PNG alpha) — do NOT paint a checkerboard, white box, grid lines, frames or borders. No text, no letters, no numbers, no labels, no watermark, no ground shadow. Do not ask me any questions; just generate the image.';
const STYLE = 'Style: cute-but-mighty chibi 3D game monster for a teen vocabulary game, the same rendering quality as the pets of this game: bold readable silhouette, playful menace (never gory, never truly scary), glossy materials, crisp clean edges, clear saturated colors, strong soft rim light. Every cell shows exactly the same monster design (same colors, shape, size and accessories); only the pose and expression change. Full body, facing the viewer\'s LEFT (toward the player), centered, about 80% of the cell height, transparent background, no ground shadow, no text.';
const KEEP = 'Do NOT make it softer, blurrier, foggier, more painterly or more watercolor-like than the reference.';
// 그림체 맞추기: Drive의 기존 몬스터 그림(10 · 12 · 22)과 펫을 연다.
const STYLE_REF = `STYLE REFERENCE — before drawing, open the existing monster pictures of this game in Google Drive and study them: "10-1.png" and "10-8.png" in the Google Drive folder "SUMUS 몬스터 10 (Runner용)", "12-1.png" and "12-9.png" in the Google Drive folder "SUMUS 몬스터 12 (Runner용)", and "22a-1.png" in the Google Drive folder "SUMUS 던전 몬스터 22 (Runner용)", and the pets of this game in the Drive folder "${PET_SPRITES}" (MONG, NABI, PINKY and BAMBOO, 02_grown.png and 03_final.png). Draw the new monster in exactly that art style: the same crisp, clean shapes and edges, the same clear colors, the same glossy eyes with white highlights, the same light cel-like shading and rim light, the same body size in the cell and the same level of detail, so it looks like it belongs in the same game as those monsters. ${KEEP} Do NOT copy the existing monsters; this is a new design.`;
const PLACE_NOTE = {
  forest: 'It lives in the FOREST map of a creature-catching game: fresh greens, browns, wood, leaves and moss in its colors.',
  field: 'It lives in the sunny FIELD (meadow and farmland) map of a creature-catching game: warm yellows, wheat, sky blue and grass green in its colors.',
  beach: 'It lives on the BEACH (seaside) map of a creature-catching game: sea blues, sand beige, coral and shell colors. It is a MONSTER, not a pet: give it a cheeky monster face, school-supply parts and a playful menacing grin so it never looks like a cute pet animal.',
  night: 'It only comes out at NIGHT in a creature-catching game: deep indigo and violet colors with soft glowing accents (glowing eyes, moonlight rim light), still bright and readable on a dark map.'
};
const TIER_NOTE = {
  common: 'A ★1 small, weak and very friendly monster: small round body, simple shapes.',
  uncommon: 'A ★2 ordinary monster: a little bigger and cheekier than the smallest ones.',
  rare: 'A ★3 rare monster: more detail, a clear special feature and a confident look.',
  epic: 'A ★4 boss-class "captain" monster: big, sturdy and impressive, with a gold accent.',
  legend: 'A ★5 legendary BOSS monster: the grandest monster of its map, majestic and detailed, a soft golden-prismatic rim light, still cute-but-mighty.'
};
// 생김새(그림 GPT용, 영어). 글자 · 숫자는 그리지 않는다(종이 · 책은 줄무늬 · 동그라미 모양만).
export const LOOKS_35 = {
  wordsquirrel: 'a small chubby brown squirrel monster with a huge fluffy tail made of rolled-up paper word cards (blank cards, no writing), cheeks stuffed like it is hoarding words, a tiny acorn-shaped pencil cap on its head, mischievous buck-tooth grin',
  spellshroom: 'a small round mushroom monster with a bright red cap covered in white dots that look like scattered letter tiles (blank tiles, no letters), stubby legs, a wobbly stem body and a goofy confused smile',
  markerfly: 'a small round firefly monster whose glowing tail is a fluorescent highlighter-pen cap glowing neon yellow-green, tiny clear wings, big glossy eyes, leaving a faint neon highlighter stroke trail',
  dictpecker: 'a woodpecker monster with a beak shaped like a sharp pencil tip, a red crest like a teacher\'s red pen cap, a small notepad (blank) tucked under one wing, pecking rhythm lines around it, a strict cheeky face',
  vocabvine: 'a curly green vine monster made of twisting leafy stems with small blank flash-card leaves, two big glossy eyes in a flower bud head, tendril arms ready to wrap around things',
  verbbeetle: 'a glossy dark-green stag beetle monster with big shiny mandibles shaped like two curved arrows (action arrows), a hard shell with a bold arrow pattern, sturdy little legs, a proud fighter face',
  sentdryad: 'a gentle but mischievous tree-spirit (dryad) monster: a small wooden body with bark skin, long leafy hair braided with ribbon-like paper strips (blank), glowing green eyes, holding a long twig like a pointer stick',
  bearprincipal: 'a big sturdy brown forest bear monster dressed like a school principal: small round gold glasses, a forest-green vest with a gold acorn badge, a leafy tie, holding a huge wooden ruler like a staff, a stern but funny face; a boss-class captain',
  lexitreant: 'a huge ancient tree giant (treant) monster whose trunk is a giant open dictionary book with pages forming bark layers (pages blank or with only fine lines), mossy branches like antlers, glowing amber eyes, roots for feet, little fireflies around; the grandest and most majestic forest monster',
  eraserbunny: 'a small rabbit monster with a body made of a soft pink-and-white rubber eraser block, long ears with eraser-crumb tips, a tiny cotton tail, big glossy eyes and a mischievous grin; little eraser crumbs fall when it hops',
  cliphopper: 'a small grasshopper monster whose long jumping legs are bent silver paper clips, a lime-green body, big round eyes and springy antennae, a cheeky spring-loaded pose',
  postitfly: 'a small butterfly monster whose four wings are bright square sticky notes (yellow, pink, mint, sky blue, blank), a round fuzzy body, curly antennae, fluttering playfully',
  scarecrow: 'a straw scarecrow monster wearing a patched school uniform jacket, a straw hat with a stack of homework papers (blank) stuck on it, button eyes and a stitched grin, a crow-shaped paper airplane perched on its arm, standing on one wooden pole leg that it hops on',
  wordgoose: 'a plump white goose monster carrying a ring-bound vocabulary word-card booklet (blank cards) on a strap around its neck, an orange beak honking loudly, a cocky waddling attitude',
  millgolem: 'a stone-and-wood windmill golem monster: a round sturdy stone body, four windmill sails on its back made of notebook pages (blank, only lines), glowing sky-blue eyes, the sails spinning like a "review again" loop arrow',
  busbull: 'a muscular bull monster painted bright yellow like a cram-school shuttle bus, round headlight eyes, a bus-window stripe along its body, curved horns, a stop-sign shaped ear tag (blank), stomping and ready to charge',
  sportsrhino: 'a big heavy rhino monster dressed for sports day: a red-and-white headband, a sports jersey without numbers, a gold medal hanging on its chest, a horn shaped like a relay baton, a whistle on a cord, a determined champion face; a boss-class captain',
  stormbird: 'a giant thunder-storm bird monster (the "end of summer vacation" storm): wings made of swirling dark storm clouds and calendar pages (blank) torn off by the wind, glowing yellow lightning feathers, sky-blue glowing eyes, a long tail of wind swirls; the grandest and most majestic field monster',
  commacrab: 'a small red crab monster whose two claws are shaped like curly comma marks, a round glossy shell, eyes on stalks, scuttling sideways with a cheeky grin',
  quizconch: 'a small spiral sea-shell (conch) monster whose shell curls like a big question-mark shape, a soft lavender body peeking out with curious glossy eyes and a sly smile (it is a shell monster, NOT a hermit crab: no crab claws, no crab legs)',
  pencilgull: 'a seagull monster whose sharp beak is a yellow pencil tip and whose tail feathers are pencil shavings, a white-and-grey body, a mischievous greedy look as if it steals pencils',
  dotocto: 'an ink-black-and-violet octopus monster whose round head is a big glossy period dot, eight short tentacles each tipped with a little ink drop, squirting a round ink blot; a cheeky monster face with sharp-looking (but rounded) grin, NOT a cute pet octopus',
  adjstar: 'a starfish monster whose five arms are each a different bright color and pattern (stripes, dots, sparkles, wavy, checks) like describing words, a smug face in the center, sparkly decorations',
  tripshark: 'a shark monster dressed for a school trip: a tiny backpack, a sun hat, a camera on a strap, a big toothy grin (rounded cartoon teeth), fins with a souvenir wristband, excited and a little menacing',
  bookray: 'a wide flat manta-ray monster whose body is an open textbook (pages blank or with only lines) gliding like wings, a long bookmark-ribbon tail, glossy eyes on top, gliding gracefully',
  testkraken: 'a big kraken (giant squid) monster made of test papers: its tentacles are long rolled answer sheets with bubble-circle patterns (shapes only), a red-pen-marked head with check and cross shapes (no letters), glowing teal eyes; a boss-class captain',
  leviathan: 'a gigantic sea-serpent leviathan monster with deep-blue and gold scales patterned like grammar diagram lines and brackets (no letters), a crown-like fin crest, glowing golden eyes, waves and sea foam curling around its body; the grandest and most majestic beach monster',
  snackcoon: 'a small chubby raccoon monster with a bandit mask, holding a cup of instant noodles with chopsticks, a few crumbs on its cheeks, sneaky late-night-snack grin, a tiny lamp-glow on its face',
  sleeppillow: 'a small fluffy pillow monster with a sleepy face, drool-drop shaped tassel, a nightcap on top, eyes half closed, little floating sleep-bubble shapes (no letters) around it',
  tutorsquito: 'a small mosquito monster wearing tiny round glasses and carrying a pointer stick, a long needle-like nose shaped like a sharp pencil, buzzing wings, an annoying know-it-all face',
  wolf2am: 'a werewolf monster in pajamas at 2 a.m.: grey-blue fur, a hoodie, dark circles under glowing yellow eyes, a coffee mug in one paw, howling at a tiny crescent moon above',
  mutecat: 'a ghost cat monster, semi-transparent pale lavender body with a wispy tail, a crossed-out bell icon shape (a bell with a slash line, no letters) on its collar, glowing violet eyes, floating silently',
  nightmare: 'a "night-before-the-exam nightmare" monster: a dark purple cloud-and-blanket creature with many glowing eyes, scary-funny exam paper shapes (blank) swirling around it, a big wobbly grin, wisps of shadow, never truly scary',
  batking: 'a bat king monster with large velvety purple wings, a small golden crown tilted on its head, sleepy droopy glowing eyes, a long cape, yawning as it spreads drowsy sparkles around',
  moongrader: 'a tall moonlight grader monster: a glowing crescent-moon head with a calm stern face, a long dark-blue robe with star patterns, holding a giant glowing red-pen staff and a stack of papers (blank), check and circle shapes floating around; a boss-class captain',
  reportdragon: 'a huge midnight dragon monster whose wings are giant report cards (grids only, no letters or numbers), dark navy and gold scales, glowing moonlight eyes, a crown of stars, a long tail ending in a scroll; the grandest and most majestic night monster'
};
const POSES = [
  ['', '기본', 'IDLE: standing ready in a confident taunting pose, a playful smug face'],
  ['-attack', '공격', 'ATTACK: lunging forward to the LEFT with its signature move, motion lines and a burst of its own color, fierce but cute face'],
  ['-hurt', '맞음', 'HURT: knocked back to the right, squinting eyes, small white impact stars around it'],
  ['-down', '쓰러짐(여분)', 'DEFEATED: flopped down on its back or side, swirly dizzy eyes, a few small stars circling above it, comical not sad']
];
const CELLS = ['TOP-LEFT', 'TOP-RIGHT', 'BOTTOM-LEFT', 'BOTTOM-RIGHT'];
const CELL_KO = ['왼쪽 위', '오른쪽 위', '왼쪽 아래', '오른쪽 아래'];

export function sheets35() {
  const out = [];
  for (const place of Object.keys(FILES_35)) {
    const keys = Object.keys(HUNT_MONSTERS).filter(k => HUNT_MONSTERS[k].place === place);
    keys.forEach((key, i) => {
      const m = HUNT_MONSTERS[key], name = `${SERIES[place]}-${i + 1}`;
      const lines = [SHEET, STYLE, STYLE_REF];
      if (i > 0) lines.push(`Also open "${SERIES[place]}-1.png" in the same Google Drive folder "${DRIVE_35}" (the first monster of this ${HUNT_PLACES[place]} set) if it is there, and match its finish, body size in the cell and level of detail exactly. Do NOT copy its design.`);
      lines.push(`Subject: "${m.ko}": ${LOOKS_35[key]}. ${TIER_NOTE[m.tier]} ${PLACE_NOTE[place]}`);
      POSES.forEach(([, , text], c) => lines.push(`${CELLS[c]} cell: ${text}`));
      lines.push(`WHEN DONE — upload the finished transparent PNG to Google Drive, into the folder "${DRIVE_35}", named exactly "${name}.png" (if a file with that name is already there, replace it; if the folder does not exist, create it). Actually save the file to Google Drive; showing the picture in the chat is not enough.`);
      out.push({ place, key, name, file: FILES_35[place], title: `${HUNT_PLACES[place]} ${tierLabel(m.tier)} ${m.ko}`, text: lines.join('\n'),
        cells: POSES.map(([suffix, ko], c) => ({ cell: CELL_KO[c], key: `monster-${key}${suffix}`, name: `${m.ko} ${ko}`, out: `public/assets/monsters/${key}${suffix}.webp` })) });
    });
  }
  return out;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const list = sheets35();
  for (const file of Object.values(FILES_35)) writeFileSync(resolve(here, file), list.filter(s => s.file === file).map(s => s.text).join('\n---\n') + '\n');
  const split = resolve(here, 'split');
  mkdirSync(split, { recursive: true });
  for (const f of readdirSync(split)) if (/^35[a-d]-\d+ /.test(f)) unlinkSync(resolve(split, f));
  for (const s of list) writeFileSync(resolve(split, `${s.name} ${s.title.replace(/[\\/:*?"<>|()★]/g, '').replace(/\s+/g, ' ').trim()}.txt`), s.text + '\n');
  // slice-map.csv: 35 줄을 지우고 뒤에 다시 붙인다(번호는 앞의 마지막 번호 다음부터).
  const mapPath = resolve(here, 'slice-map.csv');
  const rows = readFileSync(mapPath, 'utf8').replace(/\n+$/, '').split('\n').filter(r => !/^"35[a-d]-/.test(r));
  let no = Math.max(...rows.slice(1).map(r => Number(r.split(',')[1]?.replace(/"/g, '')) || 0));
  const csv = v => `"${String(v).replace(/"/g, '""')}"`;
  for (const s of list) { no++; for (const c of s.cells) rows.push([s.file, String(no).padStart(3, '0'), s.title, c.cell, c.key, c.name, c.out].map(csv).join(',')); }
  writeFileSync(mapPath, rows.join('\n') + '\n');
  console.log(`35: ${list.length}시트 → 그림 ${list.length * 4}장(필수 ${list.length * 3}장 + 쓰러짐 여분 ${list.length})`);
}
