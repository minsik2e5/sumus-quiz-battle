// 그림 주문서 39 · 40 · 41: 몬스터전 레벨 2.0(docs/monster-level-design.md)의 새 몬스터 18종 + 지역 배경.
//   39 = 한밤의 도서관 몬스터 9종, 40 = 기말고사 학교 몬스터 9종 (시트 하나 = 몬스터 하나, 2×2: 기본 · 공격 · 맞음 · 쓰러짐),
//   41 = 몬스터전 지역 배경(세로 1024×1536) 4장: 구성안의 8지역 중 아직 그림이 없는 지역만.
//   node docs/asset-requests/runner/build-39.mjs
// 만드는 것: 39a · 40a · 41 주문서(.txt), split/ 시트별 파일, slice-map.csv의 39 · 40 · 41 줄(있으면 바꿔 쓴다),
//   CODEX_PROMPT_39.md · 40 · 41. (build-runner.mjs는 26번 이후를 모르므로 돌리지 않는다: slice-map.csv 뒤쪽이 지워진다.)
// 몬스터 key는 여기서 새로 짓는다. 기존 key(monsters.js MONSTERS · hunt-rules.js HUNT_MONSTERS · 그림 폴더)와 겹치면 멈춘다.
// 앱 코드는 고치지 않는다: 그림이 들어와도 새 몬스터는 코드 등록(다음 세션) 전까지 지도 · 레벨에 나오지 않는다.
// slice-map.csv의 prompt_no는 "그때 마지막 번호 다음"이라, 36~38의 build-36.mjs를 이 파일 뒤에 다시 돌리면 번호가 밀린다(35 · 36 때와 같다).
import { readFileSync, writeFileSync, mkdirSync, readdirSync, unlinkSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { HUNT_MONSTERS, tierLabel } from '../../../public/modules/hunt-rules.js';
import { MONSTERS } from '../../../public/modules/monsters.js';

const here = dirname(fileURLToPath(import.meta.url));
const ASSETS = resolve(here, '../../../public/assets');
export const DRIVE_39 = 'SUMUS 몬스터 39 (Runner용)';
export const DRIVE_40 = 'SUMUS 몬스터 40 (Runner용)';
export const DRIVE_41 = 'SUMUS 몬스터전 지역 배경 41 (Runner용)';
const PET_SPRITES = 'SUMUS_PET_SPRITES_ALL_20261002/original_1254';
export const SETS = {
  library: { series: '39a', no: '39', file: '39a-library-monsters.txt', drive: DRIVE_39, ko: '한밤의 도서관', emoji: '📚' },
  school: { series: '40a', no: '40', file: '40a-school-monsters.txt', drive: DRIVE_40, ko: '기말고사 학교', emoji: '🏫' }
};
export const FILE_41 = '41-monster-region-backgrounds.txt';

const SHEET = 'Create ONE square image, 1024×1024 pixels, laid out as a 2×2 sprite sheet: four separate illustrations, one centered in each quarter (each quarter is 512×512). Leave generous empty space around every illustration so nothing touches or crosses the middle lines or the image edges. Use a real transparent background (PNG alpha) — do NOT paint a checkerboard, white box, grid lines, frames or borders. No text, no letters, no numbers, no labels, no watermark, no ground shadow. Do not ask me any questions; just generate the image.';
const STYLE = 'Style: cute-but-mighty chibi 3D game monster for a teen vocabulary game, the same rendering quality as the pets of this game: bold readable silhouette, playful menace (never gory, never truly scary), glossy materials, crisp clean edges, clear saturated colors, strong soft rim light. Every cell shows exactly the same monster design (same colors, shape, size and accessories); only the pose and expression change. Full body, facing the viewer\'s LEFT (toward the player), centered, about 80% of the cell height, transparent background, no ground shadow, no text.';
const KEEP = 'Do NOT make it softer, blurrier, foggier, more painterly or more watercolor-like than the reference.';
// 그림체 맞추기: Drive의 기존 몬스터 그림(10 · 12 · 22 · 35)과 펫을 연다. (Codex는 CODEX_PROMPT에서 이 줄을 지우고 저장소 그림을 첨부한다.)
const STYLE_REF = `STYLE REFERENCE — before drawing, open the existing monster pictures of this game in Google Drive and study them: "10-1.png" and "10-8.png" in the Google Drive folder "SUMUS 몬스터 10 (Runner용)", "12-1.png" and "12-9.png" in the Google Drive folder "SUMUS 몬스터 12 (Runner용)", "22a-1.png" in the Google Drive folder "SUMUS 던전 몬스터 22 (Runner용)", and (if it is there) "35a-1.png" and "35d-9.png" in the Google Drive folder "SUMUS 몬스터 35 (Runner용)", and the pets of this game in the Drive folder "${PET_SPRITES}" (MONG, NABI, PINKY and BAMBOO, 02_grown.png and 03_final.png). Draw the new monster in exactly that art style: the same crisp, clean shapes and edges, the same clear colors, the same glossy eyes with white highlights, the same light cel-like shading and rim light, the same body size in the cell and the same level of detail, so it looks like it belongs in the same game as those monsters. ${KEEP} Do NOT copy the existing monsters; this is a new design.`;
const PLACE_NOTE = {
  library: 'It lives in the MIDNIGHT LIBRARY map of a monster-fighting game: deep indigo and midnight blue with warm lamp amber, old-paper cream and brass gold in its colors, soft glowing accents (glowing eyes, floating dust sparkles), still bright and readable on a dark map. School-library props only (books, ribbons, cards, shelves, lamps), never a real brand.',
  school: 'It lives in the FINAL-EXAM SCHOOL map of a monster-fighting game: classroom yellow, chalkboard green, school-uniform navy and red-pen red with white and brass-gold in its colors. School props only (bells, trays, desks, rulers, test papers, bars), never a real brand or school name.'
};
const TIER_NOTE = {
  common: 'A ★1 small, weak and very friendly monster: small round body, simple shapes.',
  uncommon: 'A ★2 ordinary monster: a little bigger and cheekier than the smallest ones.',
  rare: 'A ★3 rare monster: more detail, a clear special feature and a confident look.',
  epic: 'A ★4 boss-class "captain" monster: big, sturdy and impressive, with a gold accent.',
  legend: 'A ★5 legendary BOSS monster: the grandest monster of its map, majestic and detailed, a soft golden-prismatic rim light, still cute-but-mighty.'
};
const POSES = [
  ['', '기본', 'IDLE: standing ready in a confident taunting pose, a playful smug face'],
  ['-attack', '공격', 'ATTACK: lunging forward to the LEFT with its signature move, motion lines and a burst of its own color, fierce but cute face'],
  ['-hurt', '맞음', 'HURT: knocked back to the right, squinting eyes, small white impact stars around it'],
  ['-down', '쓰러짐(여분)', 'DEFEATED: flopped down on its back or side, swirly dizzy eyes, a few small stars circling above it, comical not sad']
];
const CELLS = ['TOP-LEFT', 'TOP-RIGHT', 'BOTTOM-LEFT', 'BOTTOM-RIGHT'];
const CELL_KO = ['왼쪽 위', '오른쪽 위', '왼쪽 아래', '오른쪽 아래'];

// 새 몬스터 18종. key는 새로 지었다(겹치면 아래에서 멈춘다). tier는 hunt-rules.js의 등급 이름(common ★1 … legend ★5).
// looks = 생김새(그림 GPT용, 영어). 글자 · 숫자는 그리지 않는다(책 · 종이 · 시간표는 줄 · 칸 · 동그라미 모양만).
// diff = 기존 몬스터와 헷갈리지 않게 보이는 포인트(그림 GPT용, 영어). 구성안의 이름 그대로.
export const NEW_MONSTERS = {
  bookmarkbat: { set: 'library', tier: 'common', ko: '책갈피 박쥐',
    looks: 'a small round bat monster whose two wings are open book pages (blank, only faint lines) with a ribbon bookmark hanging from each wing tip, one pointed ear folded like a page corner, tiny round fangs and a sleepy-cheeky face; deep teal body with warm paper-cream wings',
    diff: 'must NOT look like the existing night bat ("nightbat") or the bat king: it is lighter, teal and cream, with book-page wings and dangling ribbon bookmarks, and no crown or cape' },
  dustbookworm: { set: 'library', tier: 'common', ko: '먼지 책벌레',
    looks: 'a chubby segmented worm monster whose body segments look like old book spines in faded brown, olive and mustard, a fluffy grey dust cloud puffing off its back, tiny round glasses, nibbling the corner of a blank page, a sleepy grin',
    diff: 'must NOT look like the green pencil worm ("pencilworm"): it is brown, olive and dusty with book-spine stripes and glasses, not a bright green caterpillar' },
  postitghost: { set: 'library', tier: 'common', ko: '포스트잇 유령',
    looks: 'a small round ghost whose body is a stack of curling sticky notes in pastel yellow, pink and mint (blank), the bottom edge peeling like a wispy tail, big glowing eyes and a shy mischievous smile, a few loose notes floating around it',
    diff: 'must NOT look like the forget-ghost ("forgetghost"), the red-pen ghost ("redpenghost") or the mute ghost cat: it is made of colorful square sticky notes with peeling edges, not a smooth lavender or white ghost' },
  librarianowl: { set: 'library', tier: 'uncommon', ko: '대출 사서 올빼미',
    looks: 'a round, fluffy owl monster dressed as a lending librarian: half-moon glasses on its beak, a lanyard card (blank) around its neck, one wing holding a big round due-date stamp (blank face) and the other wing raised with a feather finger pressed to its beak in a "keep quiet" pose, ear tufts like bookmarks; deep navy and warm amber',
    diff: 'must NOT look like the all-night owl general ("owlnight"): it is smaller and rounder, has half-moon glasses, a stamp and a lanyard, a librarian look, and no general uniform or medals' },
  dictspider: { set: 'library', tier: 'uncommon', ko: '사전 거미',
    looks: 'a fat spider monster whose round body is a thick closed dictionary with a red ribbon spine and gold corners, eight thin legs each tipped with a tiny colored index-tab notch, many small glowing eyes on the front, a web of thread strands with page-shaped scraps hanging from one corner',
    diff: 'must NOT look like the test-paper spider ("testspider"): it has a thick bound-book body with a ribbon and index-tab feet, in dark red and gold, not a flat paper body' },
  forbiddenmimic: { set: 'library', tier: 'rare', ko: '금서 미믹',
    looks: 'a mimic monster that is a huge old leather-bound tome wrapped in chains with a heavy brass lock, its cover flipped open like a mouth with rows of page-teeth and a long ribbon-bookmark tongue, glowing violet eyes inside the dark opening, gold corner guards and a faintly glowing seal circle (shapes only) on the cover',
    diff: 'must NOT look like the notebook mimic ("mimic"): it is a big dark chained leather tome with a lock and a ribbon tongue, purple and black with gold, not a plain notebook' },
  indexgolem: { set: 'library', tier: 'rare', ko: '색인 골렘',
    looks: 'a golem built from an old wooden library card-catalog cabinet: the body is a tall block of small drawers with brass handles and blank label slots, two drawers pulled out like arms, glowing lantern eyes in the top drawers, blank index cards fluttering out of it like confetti',
    diff: 'must NOT look like the grammar golem ("golem"), the killer golem ("killergolem") or the windmill golem: it is warm wood and brass drawers with card slots, not gray stone blocks' },
  libshadow: { set: 'library', tier: 'epic', ko: '도서관장 그림자',
    looks: 'a tall dark shadow of the library director: a long silhouette in a high-collared coat, a floating glowing monocle, long pale hands holding a huge ring of giant old keys, the lower body trailing off into smoke and loose pages, deep violet and indigo with gold trim',
    diff: 'must NOT look like the exam supervisor knight ("proctor") or the moonlight grader: it is a tall shadow-person with a monocle, a coat, smoke and a ring of keys, no armor and no moon head' },
  shelfdragon: { set: 'library', tier: 'legend', ko: '끝없는 서고의 용',
    looks: 'a huge serpent-like dragon whose long body is a winding bookshelf coiled upward, rows of tiny books for scales, wings that are two giant open books, a glowing reading lamp on its forehead like a lantern lure, golden eyes, a ribbon-bookmark tail and floating pages around it; indigo, amber and gold',
    diff: 'must NOT look like the dictionary dragon ("dictdragon"), the report-card dragon or the mock-exam hydra: its body is a coiled bookshelf of tiny books and its head has a lamp, with one head only' },
  latebell: { set: 'school', tier: 'common', ko: '지각 종소리',
    looks: 'a small round brass school-bell monster with a stubby clapper tongue, tiny running legs and an alarmed hurry-up face, curved sound-wave lines ringing out of it, a little stopwatch hanging from its handle (plain tick marks, no numerals)',
    diff: 'must NOT look like the ticking clock thief ("clock"): it is a golden handbell with a clapper and sound waves, not a clock with a face and hands' },
  lunchslime: { set: 'school', tier: 'common', ko: '급식 슬라임',
    looks: 'a squishy slime monster shaped like a school lunch tray: a translucent warm-orange soup-colored blob sitting in a tray with divided compartments, bits of carrot and pea shapes floating inside, a spoon stuck in its head like a hair clip, chubby cheeks and a hungry grin',
    diff: 'must NOT look like the spelling slime ("slime"): it is orange and soupy, sits in a lunch tray and has a spoon and food bits, not a plain green or blue blob' },
  timetablefairy: { set: 'school', tier: 'common', ko: '시간표 요정',
    looks: 'a tiny fairy monster with big glossy eyes whose four wings are paper timetable grids (colored square blocks only, no text or numbers), a chalk-stick wand with a star tip, a pencil-shaped hairpin, pastel colored squares floating around it',
    diff: 'must NOT look like a pet: it has a mischievous monster grin, grid-pattern wings and a chalk wand, in chalkboard-green and pastel colors' },
  staffroomguard: { set: 'school', tier: 'uncommon', ko: '교무실 문지기',
    looks: 'a stout door-guard monster using a wooden classroom sliding door with a small window as a big shield, wearing a teacher\'s vest, round glasses and a lanyard with a bunch of big keys, crossed thick eyebrows, a blank nameplate on its chest and a clipboard (blank) in its other hand',
    diff: 'must NOT look like the gate hound ("gatehound"): it is a stout humanoid with a sliding-door shield, glasses and keys, not a dog' },
  classrobot: { set: 'school', tier: 'uncommon', ko: '반장 로봇',
    looks: 'a boxy chibi class-president robot, dark navy and orange with sharp angular panels, a red visor eye, a sash across its chest (blank) with a badge-shaped emblem (shape only), one hand shaped like a wooden gavel, a megaphone mouth, an antenna with a tiny flag (blank)',
    diff: 'must NOT look like the white round robot mascot pet ("Robo") or any robot pet: it is dark navy and orange, angular and boxy, with a visor eye, a sash and a gavel hand' },
  examoctopus: { set: 'school', tier: 'rare', ko: '시험지 문어',
    looks: 'an octopus monster folded from exam paper: a flat cream-white head with a bubble-circle answer grid (circles only, no letters or numbers) and a red check-mark shape, eight tentacles each ending in a sharpened pencil, a pencil-case hat, wide eyes and a sneaky grin',
    diff: 'must NOT look like the ink octopus ("dotocto") or the test kraken: it is small and paper-cream with pencil tentacles and a pencil-case hat, not dark ink-colored and not giant' },
  barbargiant: { set: 'school', tier: 'rare', ko: '체육관 철봉 거인',
    looks: 'a muscular gym giant monster carrying a steel horizontal bar across its shoulders like a yoke, chalk-white dusted hands, a rolled gym mat as a cape, a jump rope belt, a whistle and a headband (no numbers), a goofy determined face; steel gray and white with red accents',
    diff: 'must NOT look like the sports-day rhino ("sportsrhino") or a stone golem: it is a tall humanoid giant with a horizontal steel bar on its shoulders and a gym mat cape' },
  examsetter: { set: 'school', tier: 'epic', ko: '출제 위원 마법사',
    looks: 'a wizard monster with a long robe patterned with answer-sheet bubble circles (circles only), a tall hat shaped like a huge sharpened pencil, thick glasses, a staff topped with a giant red-pen nib, floating blank question scrolls and check-mark shapes around it; deep navy and red-pen red with gold trim',
    diff: 'must NOT look like the cram wizard ("cramwizard"): it wears a pencil-shaped hat, a bubble-circle robe and glasses and carries a red-pen staff, not a purple coffee-drinking wizard' },
  yearendlord: { set: 'school', tier: 'legend', ko: '학년 말 대마왕',
    looks: 'a huge demon-lord monster with a graduation mortarboard crown with a gold tassel on its horned head, giant wings that are school calendars with torn-off blank pages, a cape made of stacked report cards (grid lines only, no letters or numbers), a giant rubber-stamp scepter, red-black armor with gold trim and glowing red eyes',
    diff: 'must NOT look like the great exam king ("finalking") or the midnight report-card dragon: it is a horned demon lord with a mortarboard crown, calendar wings and a stamp scepter' }
};

// 이름 겹침 검사: 새 key는 기존 몬스터(MONSTERS · HUNT_MONSTERS) · 그림 폴더의 어떤 key와도 같으면 안 된다.
function checkKeys() {
  const used = new Set([...MONSTERS.map(m => m.key), ...Object.keys(HUNT_MONSTERS)]);
  const dir = resolve(ASSETS, 'monsters');
  if (existsSync(dir)) for (const f of readdirSync(dir)) { const k = f.match(/^([a-z0-9]+?)(?:-[a-z0-9]+)?\.webp$/)?.[1]; if (k) used.add(k); }
  const dup = Object.keys(NEW_MONSTERS).filter(k => used.has(k));
  if (dup.length) throw new Error(`몬스터 key가 기존과 겹쳐요: ${dup.join(', ')}`);
}

export function sheets39() {
  checkKeys();
  const out = [];
  for (const [place, set] of Object.entries(SETS)) {
    const keys = Object.keys(NEW_MONSTERS).filter(k => NEW_MONSTERS[k].set === place);
    keys.forEach((key, i) => {
      const m = NEW_MONSTERS[key], name = `${set.series}-${i + 1}`;
      const lines = [SHEET, STYLE, STYLE_REF];
      if (i > 0) lines.push(`Also open "${set.series}-1.png" in the same Google Drive folder "${set.drive}" (the first monster of this ${set.ko} set) if it is there, and match its finish, body size in the cell and level of detail exactly. Do NOT copy its design.`);
      lines.push(`Subject: "${m.ko}": ${m.looks}. ${TIER_NOTE[m.tier]} ${PLACE_NOTE[place]}`);
      lines.push(`Clear difference from the existing monsters (so players never confuse them): it ${m.diff}.`);
      POSES.forEach(([, , text], c) => lines.push(`${CELLS[c]} cell: ${text}`));
      lines.push(`WHEN DONE — upload the finished transparent PNG to Google Drive, into the folder "${set.drive}", named exactly "${name}.png" (if a file with that name is already there, replace it; if the folder does not exist, create it). Actually save the file to Google Drive; showing the picture in the chat is not enough.`);
      out.push({ place, key, name, file: set.file, tier: m.tier, ko: m.ko, title: `${set.ko} ${tierLabel(m.tier)} ${m.ko}`, text: lines.join('\n'),
        cells: POSES.map(([suffix, ko], c) => ({ cell: CELL_KO[c], key: `monster-${key}${suffix}`, name: `${m.ko} ${ko}`, out: `public/assets/monsters/${key}${suffix}.webp` })) });
    });
  }
  return out;
}

// ── 41: 지역 배경 ─────────────────────────────────────────────────────────────────────────
// 구성안의 8지역 중 그림이 이미 있는 지역은 주문하지 않는다(REGIONS의 have). 새로 주문하는 4장만 BG_41에 있다.
export const REGIONS = [
  { no: 1, ko: '야자 교실', have: null, order: '41-1' },
  { no: 2, ko: '숲', have: 'public/assets/hunt/bg-forest-day.webp · bg-forest-night.webp (720×1080 세로, 몬스터 사냥 지도)' },
  { no: 3, ko: '들판', have: 'public/assets/hunt/bg-field-day.webp · bg-field-night.webp (720×1080 세로)' },
  { no: 4, ko: '바닷가', have: 'public/assets/hunt/bg-beach-day.webp · bg-beach-night.webp (720×1080 세로)' },
  { no: 5, ko: '밤', have: '사냥 지도의 밤 3장(hunt/bg-forest-night · bg-field-night · bg-beach-night)에서 코드 세션이 고른다' },
  { no: 6, ko: '한밤의 도서관', have: null, order: '41-2' },
  { no: 7, ko: '기말고사 학교', have: null, order: '41-3' },
  { no: 8, ko: '온 세상 보스 모음', have: null, order: '41-4' }
];
const BG_SHEET = 'Create ONE tall portrait image, 1024×1536 pixels: a full-screen 2D LEVEL-CARD BACKGROUND for the monster-fight levels of a cute premium mobile vocabulary game (players are high-school students), shown on a phone in portrait. Paint it fully to every edge (no transparency, no border, no frame, no rounded corners). NO characters, NO animals, NO creatures, NO monsters, NO people. No text, no letters, no numbers (a clock or calendar shows only plain tick marks), no logos, no UI, no map markers, no watermark. Do not ask me any questions; just generate the image.';
const BG_STYLE = 'Style: the same premium cute 3D-painted anime game art as the pets and monsters of this game: clear saturated colors (not washed out, not hazy), clean shapes, soft cel-like shading, gentle rim light, friendly and a little adventurous (never gory, never truly scary), like the stage backdrop of a premium creature-battle mobile game.';
const BG_COMP = 'COMPOSITION (important, the game draws its own monster, a level-number plate and buttons on top): the TOP 15% stays calm and simple (the plate goes there). Leave the CENTER-LOWER area, about 60% of the width and 40% of the height, open, soft and uncluttered like a stage floor where one monster stands. Put the rich details, depth and scenery around the outer edges and far away; keep the middle fairly calm. The picture is shown about 390 pixels wide, so keep shapes big and readable. A gentle vignette toward the edges.';
const BG_REF = `STYLE REFERENCE — before drawing, open these pictures in Google Drive and match their rendering quality, color clarity and finish exactly: the monsters of this game, "10-1.png" and "10-8.png" in the Google Drive folder "SUMUS 몬스터 10 (Runner용)" and "12-1.png" in the Google Drive folder "SUMUS 몬스터 12 (Runner용)" (a monster will stand on this picture, so it must look like their world), the backgrounds already used in this app: "34a-1.png" and "34a-7.png" in the Google Drive folder "SUMUS 펫 사냥 34 (Runner용)" and "23a-1.png" in the Google Drive folder "SUMUS 던전 배경·UI 23 (Runner용)" (same level of detail, light and saturation). ${KEEP}`;
export const BG_41 = [
  { name: '41-1', key: 'yaja', title: '몬스터전 야자 교실 배경', app: 'public/assets/monster-stage/bg-yaja.webp',
    scene: 'Scene: a school classroom during evening self-study time, seen from a slightly high three-quarter angle: rows of wooden desks and chairs (empty), a blank green chalkboard, warm ceiling lights, a big window with an orange-to-violet dusk sky and the first stars, stacks of workbooks with blank covers, pencil cases and a desk lamp on a few desks, a wall clock with plain tick marks only. Cozy, a little sleepy, adventurous. The open stage floor in the middle is the clear classroom aisle.' },
  { name: '41-2', key: 'library', title: '몬스터전 한밤의 도서관 배경', app: 'public/assets/monster-stage/bg-library.webp',
    scene: 'Scene: a huge MIDNIGHT LIBRARY: a long aisle between towering dark-wood bookshelves that rise to a vaulted ceiling, a rolling ladder, floating glowing books and drifting pages, brass lanterns and green reading lamps, moonlight through tall arched windows, a faint magical mist on the floor. Deep indigo and midnight blue with warm amber lamp light. Mysterious and adventurous but friendly, not scary. The open stage floor in the middle is the polished library aisle.' },
  { name: '41-3', key: 'school', title: '몬스터전 기말고사 학교 배경', app: 'public/assets/monster-stage/bg-school.webp',
    scene: 'Scene: a school on FINAL-EXAM day: a long bright hallway with polished floor, rows of lockers (no labels), classroom sliding doors with small windows, desks lined up in perfect rows seen through the doors, blank banners and paper streamers, a big blank bulletin board, a few oversized pencils and giant check-mark and circle shapes decorating the wall, strong window light from one side. Clean, tense but friendly. The open stage floor in the middle is the shiny hallway floor.' },
  { name: '41-4', key: 'world', title: '몬스터전 온 세상 보스 모음 배경', app: 'public/assets/monster-stage/bg-world.webp',
    scene: 'Scene: the final BOSS GATHERING arena above the whole world: a grand ancient stone battle platform at the center-bottom under a huge dramatic sky, floating islands all around it, each showing one land of the game (a green forest island, a golden wheat-field island, a sandy beach island with waves, a moonlit night island, a tiny library tower island and a tiny school building island), connected by glowing golden bridges, purple storm clouds on the horizon, golden light rays pointing down at the platform. Epic scale, a strong sense of awe. The open stage floor in the middle is the stone platform.' }
].map(b => ({ ...b, text: [BG_SHEET, BG_STYLE, BG_REF, b.scene, BG_COMP,
  `WHEN DONE — upload the finished PNG (1024×1536, fully painted, not transparent) to Google Drive, into the folder "${DRIVE_41}", named exactly "${b.name}.png" (if a file with that name is already there, replace it; if the folder does not exist, create it). Actually save the file to Google Drive; showing the picture in the chat is not enough.`].join('\n') }));

const toSplitName = s => `${s.name} ${s.title.replace(/[\\/:*?"<>|()★]/g, '').replace(/\s+/g, ' ').trim()}.txt`;

// ── CODEX_PROMPT ──────────────────────────────────────────────────────────────────────────
// 참고 그림(저장소 안): 기존 몬스터는 등급별로 고르고, 같은 묶음의 첫 시트는 /tmp/art/ 의 방금 만든 그림을 쓴다.
const REF_BY_TIER = {
  common: 'monsters/mochi.webp, monsters/slime.webp, monsters/nightbat.webp',
  uncommon: 'monsters/blinkjelly.webp, monsters/redpenghost.webp, monsters/forgetghost.webp',
  rare: 'monsters/chalkangler.webp, monsters/sandwitch.webp, monsters/testspider.webp',
  epic: 'monsters/gatehound.webp, monsters/omrreaper.webp, monsters/cramwizard.webp',
  legend: 'monsters/mockhydra.webp, monsters/dictdragon.webp, monsters/killergolem.webp'
};
const tierStar = { common: '★1', uncommon: '★2', rare: '★3', epic: '★4', legend: '★5' };
const FIT_HEAD = 'R=docs/asset-requests/runner';

function monsterCodex(set, list) {
  const n = set.no, first = `${set.series}-1`;
  const rows = list.map(s => `| \`${s.name}\` | ${tierStar[s.tier]} | \`${s.key}\` | ${s.ko} |`).join('\n');
  const refRows = Object.entries(REF_BY_TIER).map(([t, v]) => `| ${tierStar[t]} 시트 | ${v.split(', ').map(x => `\`${x}\``).join(', ')} |`).join('\n');
  const fit = list.map(s => `node $R/fit-assets.mjs /tmp/art/${s.name}.png monsters/${s.key} monsters/${s.key}-attack monsters/${s.key}-hurt monsters/${s.key}-down --stand-same --preview /tmp/review/${s.name}.png`).join('\n');
  const names = list.map(s => s.key).join(' · ');
  return `# Codex 작업 지시: 그림 ${n} (몬스터전 레벨 2.0 · ${set.ko} 몬스터 ${list.length}종 · ${list.length}시트)

## 목표
몬스터전 레벨 2.0(\`docs/monster-level-design.md\`)에 쓸 새 몬스터 ${list.length}종(${set.emoji} ${set.ko}: ★1 3 · ★2 2 · ★3 2 · ★4 1 · ★5 1)의 그림을 만들고, 잘라서 \`public/assets/monsters/\`에 넣은 뒤 PR을 만든다.
몬스터마다 **기본 · 공격 · 맞음** 3자세가 꼭 필요하다(${list.length * 3}장). 시트 넷째 칸 **쓰러짐**은 여분이다(있으면 넣고, 없어도 된다).
**그림 파일만 넣는다. 앱 코드는 고치지 않는다.**

> ⚠️ **이 그림만으로는 새 몬스터가 앱에 나오지 않는다.** 새 몬스터는 지도(몬스터 사냥)에 나오지 않고, 몬스터전 레벨 순서에도 아직 없다. 레벨 순서 · 지역 · 이름 등록은 다음 세션에서 코드로 한다(구성안 \`docs/monster-level-design.md\` §7의 세션 2).
> \`npm run build:assets\`가 그림 폴더를 보고 \`public/modules/monster-art.js\`(\`MONSTER_ART\`)를 만들 뿐이라, 그림만 먼저 들어와도 앱은 깨지지 않는다(새 key는 \`MONSTERS\` · \`HUNT_MONSTERS\`에 없으므로 어디에서도 쓰이지 않는다. 가짜 그림으로 \`build:assets\` · \`check\` · \`check:cloudflare\`가 통과하는 것을 확인했다).

| 시트 | 등급 | 몬스터 key | 이름 |
|---|---|---|---|
${rows}

- 시트와 칸마다 넣을 파일(키)은 \`slice-map.csv\`에서 \`list\` 열이 \`${set.series}-\`로 시작하는 줄을 본다. 앱은 \`public/assets/monsters/<key>.webp\` · \`<key>-attack.webp\` · \`<key>-hurt.webp\` · \`<key>-down.webp\`를 그대로 읽는다.
- 기존 몬스터(10 · 12 · 22 · 35)와 key가 겹치지 않게 새로 지은 이름이다. **key를 바꾸지 않는다.**

## 꼭 지킬 것
- **기존 몬스터와 같은 게임 그림체**로 맞춘다. 더 흐리거나 뿌옇거나 수채화처럼 만들지 않는다. 기존 몬스터를 베끼지 않는다(새 디자인). 시트마다 "기존 몬스터와 헷갈리지 않게 보이는 포인트" 문장이 있으니 지킨다.
- 그림에 **글자 · 숫자 · 로고를 넣지 않는다**(책 · 종이 · 시간표는 줄 · 칸 · 동그라미 모양만). 배경 · 바닥 그림자 · 체크무늬가 없다(진짜 투명).
- 128px로 줄여도 알아볼 수 있는 큰 실루엣.
- **PR까지만 만든다. 머지하지 않는다.** \`sumus-voca-prod-deploy\`에 머지하면 운영에 바로 배포된다. **운영 Supabase에 연결하지 않는다.**
- **그림은 Codex에 내장된 그림 생성 기능으로 만든다.** OpenAI API 키나 유료 API를 쓰지 않는다. 키가 없다고 멈추지 않는다.
- **Google Drive는 쓰지 않는다. 멈추지 않는다.** Codex에는 Drive가 없다. 아래 "프롬프트 손보기"대로 Drive 문구를 지우고 저장소 안의 그림을 참고 그림으로 붙인다.
- 고치는 파일: \`public/assets/monsters/\` 아래 **새 그림**, 빌드가 바꾸는 \`public/modules/monster-art.js\` · \`public/sw.js\`, \`docs/asset-requests/runner/DONE_${n}.md\`. 그 밖의 앱 코드, 게임 규칙, 코인, 서버 로직, 점검 파일은 건드리지 않는다. 버전은 올리지 않는다.
- 기존 그림 파일은 지우거나 덮어쓰지 않는다. **새 파일만 추가**한다. 원본 시트 PNG는 커밋하지 않는다(\`/tmp/art/\`).
- **브랜치:** \`sumus-voca-prod-deploy\`에서 새로 만든다(예: \`codex/art-${n}\`). 그 브랜치에 \`docs/asset-requests/runner/${set.file}\`가 없으면 주문서 PR이 아직 머지되지 않은 것이다. 그때는 \`claude/art-orders-39-41\`에서 시작하고 PR 대상도 그 브랜치로 한다.

## 입력 (저장소 안, \`docs/asset-requests/runner/\`)
- \`split/${set.series}-1 …\` ~ \`${set.series}-${list.length} …\`: 시트 하나 = 프롬프트 하나. 묶음 전체는 \`${set.file}\`.
- \`slice-map.csv\`: 칸 이름 · 앱 파일. 칸 순서는 왼쪽 위 → 오른쪽 위 → 왼쪽 아래 → 오른쪽 아래.
- 자르기 도구: \`fit-assets.mjs\`(사용법은 파일 맨 위 주석). \`sharp\`가 없으면 \`npm i --no-save sharp\`.
- 보내는 순서: \`${first}\` → \`${set.series}-2\` … \`${set.series}-${list.length}\`. 첫 시트가 먼저 있어야 뒤 시트가 맞출 수 있다.

### 프롬프트 손보기 (Drive 대신 참고 그림 첨부)
시트 프롬프트(\`split/\`)는 그림 GPT가 Google Drive를 여는 방식으로 쓰여 있다(기존 몬스터 그림을 열어 그림체를 맞추고, 정해진 Drive 폴더 "${set.drive}"에 정확한 파일 이름으로 저장). Codex는 Drive를 쓰지 않으니 보내기 전에 이렇게 바꾼다.
1. 다음으로 **시작하는 줄을 지운다**: \`STYLE REFERENCE\`, \`CHARACTER REFERENCE\`, \`Also open\`, \`WHEN DONE\`
2. 아래 표의 참고 그림을 같이 보여 주고, 프롬프트 **세 번째 줄**에 이 문장을 넣는다:
   \`REFERENCE IMAGES ARE ATTACHED: match their art style, rendering quality, crisp clean edges and colors exactly. If a reference shows this same monster, keep its face, colors, markings and accessories exactly. Do NOT copy any other monster from the references; this is a new design.\`
3. \`${set.series}-2\`부터는 참고 그림에 방금 만든 첫 시트 \`/tmp/art/${first}.png\`도 같이 붙인다(마감 · 칸 안 크기 · 디테일을 맞춘다. 디자인은 베끼지 않는다).

### 참고 그림 (\`public/assets/\` 아래 경로)
| 시트 | 참고 그림 |
|---|---|
${refRows}
| 모든 시트 | 기존 자세 \`monsters/mochi-attack.webp\`, \`monsters/mochi-hurt.webp\`, \`monsters/mochi-down.webp\` (공격 · 맞음 · 쓰러짐 포즈의 느낌) |
| ${set.series}-2 이후 | \`/tmp/art/${first}.png\` (같은 묶음의 첫 시트) |

### 후보 점검 (모두 통과해야 쓴다)
1. 배경이 진짜 투명이다(네 모서리 alpha 0, 체크무늬 · 흰 상자 · 흰 테두리 없음).
2. 칸마다 그림이 하나씩 따로 있고, 겹치거나 잘리지 않았다. 글자, 숫자, 로고, 바닥 그림자가 없다.
3. 네 칸이 같은 몬스터(색 · 모양 · 크기 · 소품이 같음), 왼쪽(플레이어 쪽)을 본다.
4. 기존 몬스터(10 · 12 · 22 · 35)와 나란히 놓아도 같은 게임 그림처럼 보이고, "헷갈리지 않게 보이는 포인트"가 분명하다. 128px로 줄여도 알아볼 수 있다.

이미지를 볼 수 있으면 눈으로 확인한다. 볼 수 없으면 1~3번만 확인하고 PR에 "눈으로 확인 필요"라고 적는다.

## 1. 그림 만들기
- **Codex의 내장 그림 생성 기능**으로 시트를 하나씩 만든다. API를 직접 부르지 않는다.
- 2×2 시트 1024×1024, **투명 배경 PNG**. 칸: 왼쪽 위 기본 · 오른쪽 위 공격 · 왼쪽 아래 맞음 · 오른쪽 아래 쓰러짐(여분).
- 만든 그림은 \`/tmp/art/<시트 번호>.png\`로 저장한다(예: \`/tmp/art/${first}.png\`). 점검을 통과하지 못하면 같은 프롬프트로 다시 만든다. 시트마다 최대 4번이다.
- 한 번에 다 못 만들면 **몬스터 하나를 끝까지** 만든 단위로 끊는다. 못 만든 시트는 \`DONE_${n}.md\`의 "넣지 못한 그림"에 적는다.

## 2. 자르고 넣기
기존 몬스터와 같은 규격(512×512 webp, 투명, 같은 배율로 바닥에 세움 \`--stand-same\`)으로 자른다.
\`\`\`
${FIT_HEAD}
${fit}
# 쓰러짐 칸을 못 쓰면 넷째 이름을 - 로 준다(버림): … monsters/${list[0].key}-hurt - --stand-same
\`\`\`
- 칸 이름은 \`slice-map.csv\`의 \`app_file\`과 같아야 한다(키가 틀리면 앱이 그림을 못 찾는다).
- 세 자세 중 하나라도 못 넣은 몬스터는 세 장 모두 넣지 않는다.

## 3. 마무리
\`\`\`
npm ci
npm run build:assets      # public/modules/monster-art.js에 넣은 몬스터 key가 들어갔는지 본다
npm run check             # release-check 전부 PASS
npm run check:cloudflare
\`\`\`
- 점검이 실패하면 점검 파일을 고치지 말고 PR에 실패 메시지를 그대로 적는다.
- 기존 그림의 \`D\`(삭제) · \`M\`(수정)이 없어야 한다: \`git diff --name-status origin/sumus-voca-prod-deploy -- public/assets\`
- \`docs/asset-requests/runner/DONE_${n}.md\`(한국어): 넣은 몬스터 표(시트 · 키 · 쓰러짐 여분 넣음 여부 · 다시 만든 횟수), 넣지 못한 것과 이유, "눈으로 확인 필요". 마지막에 "새 몬스터는 코드 등록(레벨 순서 · 지역)이 끝나야 앱에 나온다"를 적는다.
- PR 제목 \`그림 ${n}: ${set.ko} 몬스터 ${list.length}종 (${names})\`, 본문 한국어. 미리보기 그림(\`/tmp/review/*.png\`)을 한 장으로 작게 합쳐 PR 코멘트로 올린다. 마지막 줄: \`> ⚠️ 머지하면 운영에 바로 배포됩니다. 새 몬스터는 코드 등록 전까지 앱에 나오지 않습니다.\` **머지하지 않는다.**
`;
}

function bgCodex() {
  const rows = BG_41.map(b => `| \`${b.name}\` | ${b.title.replace('몬스터전 ', '').replace(' 배경', '')} | \`${b.app}\` |`).join('\n');
  const reg = REGIONS.map(r => `| ${r.no} | ${r.ko} | ${r.have ? `있음: ${r.have}` : `**새로 주문** (\`${r.order}\`)`} |`).join('\n');
  const cmds = BG_41.map(b => `  "${b.name}": "${b.app.replace('public/assets/', '')}"`).join(',\n');
  return `# Codex 작업 지시: 그림 41 (몬스터전 지역 배경 4장)

## 목표
몬스터전 레벨 2.0(\`docs/monster-level-design.md\`)은 10레벨마다 지역이 바뀐다. 구성안의 8지역 중 **배경 그림이 아직 없는 4지역**의 레벨 카드 배경(폰 세로 비율 1024×1536)을 만들고, 줄여서 \`public/assets/monster-stage/\`에 넣은 뒤 PR을 만든다.
**그림 파일만 넣는다. 앱 코드는 고치지 않는다.** 지역 구조 · 배경 연결은 다음 세션에서 코드로 한다(그림만 먼저 들어와도 앱은 바뀌지 않고 깨지지 않는다).

### 8지역과 이미 있는 배경
| # | 지역 | 배경 |
|---|---|---|
${reg}

- 있음으로 적은 지역은 중복으로 만들지 않는다(몬스터 사냥 지도 그림을 다음 세션이 재사용한다. 모양이 안 맞으면 그때 따로 주문한다).
- 표의 **새로 주문** 4장만 만든다.

| 시트 | 지역 | 넣을 파일 |
|---|---|---|
${rows}

시트와 칸마다 넣을 파일은 \`slice-map.csv\`에서 \`list\` 열이 \`${FILE_41}\`인 줄을 본다.

## 꼭 지킬 것
- **기존 그림과 같은 게임 그림체**(몬스터 10 · 12와 같은 깨끗한 색, 사냥 지도 34a와 같은 밝기). 더 흐리거나 뿌옇거나 수채화처럼 만들지 않는다.
- 배경에는 **캐릭터 · 동물 · 몬스터 · 사람을 그리지 않는다**(앱이 몬스터를 그 위에 그린다). 글자 · 숫자 · 로고 · UI도 없다. 가운데 아래는 몬스터가 서는 자리라 비워 둔다.
- 투명 PNG가 아니다: 가장자리까지 꽉 채워 그린 그림이다.
- **PR까지만 만든다. 머지하지 않는다.** \`sumus-voca-prod-deploy\`에 머지하면 운영에 바로 배포된다. **운영 Supabase에 연결하지 않는다.**
- **그림은 Codex에 내장된 그림 생성 기능으로 만든다.** OpenAI API 키나 유료 API를 쓰지 않는다.
- **Google Drive는 쓰지 않는다. 멈추지 않는다.** Codex에는 Drive가 없다. 아래 "프롬프트 손보기"대로 한다.
- 고치는 파일: \`public/assets/monster-stage/\` 아래 새 그림, 빌드가 바꿀 수 있는 \`public/sw.js\`, \`docs/asset-requests/runner/DONE_41.md\`. 앱 코드 · 규칙 · 서버 · 점검 파일은 건드리지 않는다. 버전은 올리지 않는다. 원본 PNG는 커밋하지 않는다(\`/tmp/art/\`).
- **브랜치:** \`sumus-voca-prod-deploy\`에서 새로 만든다(예: \`codex/art-41\`). 그 브랜치에 \`docs/asset-requests/runner/${FILE_41}\`가 없으면 \`claude/art-orders-39-41\`에서 시작하고 PR 대상도 그 브랜치로 한다.

## 입력 (저장소 안, \`docs/asset-requests/runner/\`)
- \`split/41-1 …\` ~ \`41-4 …\`: 시트 하나 = 프롬프트 하나. 묶음 전체는 \`${FILE_41}\`.
- 보내는 순서: \`41-1\` → \`41-2\` → \`41-3\` → \`41-4\`.

### 프롬프트 손보기 (Drive 대신 참고 그림 첨부)
시트 프롬프트는 그림 GPT가 Google Drive를 여는 방식으로 쓰여 있다(기존 그림을 열어 그림체를 맞추고, Drive 폴더 "${DRIVE_41}"에 정확한 파일 이름으로 저장). Codex는 Drive를 쓰지 않으니 보내기 전에 이렇게 바꾼다.
1. 다음으로 **시작하는 줄을 지운다**: \`STYLE REFERENCE\`, \`CHARACTER REFERENCE\`, \`Also open\`, \`WHEN DONE\`
2. 아래 표의 참고 그림을 같이 보여 주고, 프롬프트 **세 번째 줄**에 이 문장을 넣는다:
   \`REFERENCE IMAGES ARE ATTACHED: match their art style, rendering quality, color clarity and finish exactly. The backgrounds must look like one set with the monsters and backgrounds shown. Do NOT draw any character, animal or monster from the references.\`
3. \`41-2\`부터는 방금 만든 \`/tmp/art/41-1.png\`도 같이 붙인다(마감 · 밝기 · 디테일을 맞춘다. 장면은 베끼지 않는다).

### 참고 그림 (\`public/assets/\` 아래 경로)
| 시트 | 참고 그림 |
|---|---|
| 모든 시트 | \`hunt/bg-forest-day.webp\`, \`hunt/bg-catch.webp\`, \`dungeon/bg-f1.webp\`, \`battle/bg-forest.webp\` (같은 게임의 배경), \`monsters/mochi.webp\`, \`monsters/nightbat.webp\`, \`monsters/mockhydra.webp\` (몬스터가 이 위에 선다) |
| 41-1 야자 교실 | 위 + \`dungeon/bg-f2.webp\` |
| 41-2 한밤의 도서관 | 위 + \`hunt/bg-forest-night.webp\` (밤 색감) |
| 41-3 기말고사 학교 | 위 + \`dungeon/bg-f3.webp\` |
| 41-4 온 세상 보스 모음 | 위 + \`dungeon/bg-boss.webp\`, \`battle/bg-boss.webp\` (보스 느낌) |

### 후보 점검 (모두 통과해야 쓴다)
1. 가장자리까지 꽉 찬 그림이다(투명 · 테두리 · 둥근 모서리 없음). 글자 · 숫자 · 로고 · UI가 없다.
2. 캐릭터 · 동물 · 몬스터 · 사람이 없다.
3. 가운데 아래(너비 60% · 높이 40%)가 비어 있고 조용하다. 위 15%가 단순하다.
4. 기존 배경(사냥 지도 · 던전)과 나란히 놓아도 같은 게임 그림이다. 폭 390px로 줄여도 알아볼 수 있다.

## 1. 그림 만들기
- **Codex의 내장 그림 생성 기능**으로 하나씩 만든다. 세로 1024×1536 PNG, \`/tmp/art/41-1.png\` … \`/tmp/art/41-4.png\`로 저장. 점검을 통과하지 못하면 다시 만든다(장마다 최대 4번).

## 2. 줄여서 넣기
\`\`\`
mkdir -p public/assets/monster-stage
node --input-type=module -e "
import sharp from 'sharp';
const map = {
${cmds}
};
for (const [n, out] of Object.entries(map)) await sharp('/tmp/art/' + n + '.png').resize(720, 1080, { fit: 'cover' }).webp({ quality: 80, effort: 6 }).toFile('public/assets/' + out);
"
\`\`\`
- 720×1080 webp, 장마다 **150KB 이하**여야 한다(넘으면 quality를 낮춘다).
- \`sharp\`가 없으면 \`npm i --no-save sharp\`.

## 3. 마무리
\`\`\`
npm ci
npm run build:assets
npm run check
npm run check:cloudflare
\`\`\`
- 점검이 실패하면 점검 파일을 고치지 말고 PR에 실패 메시지를 그대로 적는다.
- \`docs/asset-requests/runner/DONE_41.md\`(한국어): 넣은 그림 표(시트 · 파일 · 크기 · 다시 만든 횟수), 넣지 못한 것과 이유, "눈으로 확인 필요". "배경은 지역 구조 코드(다음 세션)가 연결해야 앱에 나온다"를 적는다.
- PR 제목 \`그림 41: 몬스터전 지역 배경 4장 (야자 교실 · 한밤의 도서관 · 기말고사 학교 · 온 세상 보스 모음)\`, 본문 한국어. 네 장을 한 장으로 작게 합쳐 PR 코멘트로 올린다. 마지막 줄: \`> ⚠️ 머지하면 운영에 바로 배포됩니다.\` **머지하지 않는다.**
`;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const list = sheets39();
  for (const set of Object.values(SETS)) writeFileSync(resolve(here, set.file), list.filter(s => s.file === set.file).map(s => s.text).join('\n---\n') + '\n');
  writeFileSync(resolve(here, FILE_41), BG_41.map(s => s.text).join('\n---\n') + '\n');
  writeFileSync(resolve(here, 'CODEX_PROMPT_39.md'), monsterCodex(SETS.library, list.filter(s => s.place === 'library')));
  writeFileSync(resolve(here, 'CODEX_PROMPT_40.md'), monsterCodex(SETS.school, list.filter(s => s.place === 'school')));
  writeFileSync(resolve(here, 'CODEX_PROMPT_41.md'), bgCodex());
  const split = resolve(here, 'split');
  mkdirSync(split, { recursive: true });
  for (const f of readdirSync(split)) if (/^(39a|40a)-\d+ /.test(f) || /^41-\d+ /.test(f)) unlinkSync(resolve(split, f));
  for (const s of list) writeFileSync(resolve(split, toSplitName(s)), s.text + '\n');
  for (const s of BG_41) writeFileSync(resolve(split, toSplitName(s)), s.text + '\n');
  // slice-map.csv: 39 · 40 · 41 줄을 지우고 뒤에 다시 붙인다(번호는 앞의 마지막 번호 다음부터).
  const mapPath = resolve(here, 'slice-map.csv');
  const rows = readFileSync(mapPath, 'utf8').replace(/\n+$/, '').split('\n').filter(r => !/^"(39a|40a)-|^"41-monster/.test(r));
  let no = Math.max(...rows.slice(1).map(r => Number(r.split(',')[1]?.replace(/"/g, '')) || 0));
  const csv = v => `"${String(v).replace(/"/g, '""')}"`;
  const first = no + 1;
  for (const s of list) { no++; for (const c of s.cells) rows.push([s.file, String(no).padStart(3, '0'), s.title, c.cell, c.key, c.name, c.out].map(csv).join(',')); }
  for (const b of BG_41) { no++; rows.push([FILE_41, String(no).padStart(3, '0'), b.title, '전체', `monster-stage-bg-${b.key}`, b.title, b.app].map(csv).join(',')); }
  writeFileSync(mapPath, rows.join('\n') + '\n');
  console.log(`39 · 40: ${list.length}시트 → 그림 ${list.length * 4}장(필수 ${list.length * 3}장 + 쓰러짐 여분 ${list.length}), 41: 배경 ${BG_41.length}장, prompt_no ${String(first).padStart(3, '0')}~${String(no).padStart(3, '0')}`);
}
