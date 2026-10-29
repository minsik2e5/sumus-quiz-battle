// 그림 주문서 54 · 55 · 56: 새 펫 테마 곤충 6종 · 공룡 6종(구성안 docs/bug-dino-pets-design.md).
//   54 = 곤충 펫(기본 4 · 영웅 2), 55 = 공룡 펫(기본 3 · 영웅 2 · 전설 1), 56 = 테마 알 상점 아이콘(56a) · 테마 칭호 메달(56b).
//   57~59는 다음 테마용으로 비워 둔다. 시트 하나 = 2×2(36 · 37번과 같은 방식: 설정 · 표정 · 알 반응 · 야차전 공격/맞음).
//   node docs/asset-requests/runner/build-54.mjs
// 만드는 것: 54a~56b 주문서(.txt), split/ 시트별 파일, slice-map.csv의 54~56 줄(있으면 바꿔 쓴다), CODEX_PROMPT_54 · 55 · 56.md.
// (build-runner.mjs는 26번 이후를 모르므로 돌리지 않는다: slice-map.csv 뒤쪽이 지워진다.)
// 36번과 다른 점: 이 펫들은 아직 core.js(CHARACTERS)에 없다(코드는 그림이 온 뒤 다음 세션). 그래서 이름 · 종류 · 등급을 여기에 두고,
//   지금 펫 key · 이름과 겹치면 멈춘다. 그림만 먼저 들어와도 앱은 바뀌지 않는다(petReady는 CHARACTERS에 있는 펫만 본다).
import { readFileSync, writeFileSync, mkdirSync, readdirSync, unlinkSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { CHARACTERS } from '../../../public/modules/core.js';
import { TITLES } from '../../../public/modules/titles.js';

const here = dirname(fileURLToPath(import.meta.url));
export const DRIVE_54 = { 54: 'SUMUS 곤충 펫 54 (Runner용)', 55: 'SUMUS 공룡 펫 55 (Runner용)', 56: 'SUMUS 테마 알 · 칭호 56 (Runner용)' };
export const FILES_54 = {
  '54a': '54a-bug-pets-design.txt', '54b': '54b-bug-pets-expressions.txt', '54c': '54c-bug-pets-battle-poses.txt',
  '55a': '55a-dino-pets-design.txt', '55b': '55b-dino-pets-expressions.txt', '55c': '55c-dino-pets-battle-poses.txt',
  '56a': '56a-theme-egg-icons.txt', '56b': '56b-theme-title-medals.txt'
};
const PET_SPRITES = 'SUMUS_PET_SPRITES_ALL_20261002/original_1254';
const KEEP = 'Do NOT make it softer, blurrier, foggier, more painterly or more watercolor-like than the reference.';
const SHEET = 'Create ONE square image, 1024×1024 pixels, laid out as a 2×2 sprite sheet: four separate illustrations, one centered in each quarter (each quarter is 512×512). Leave generous empty space around every illustration so nothing touches or crosses the middle lines or the image edges. Use a real transparent background (PNG alpha) — do NOT paint a checkerboard, white box, grid lines, frames or borders. No text, no letters, no numbers, no labels, no watermark, no ground shadow. Do not ask me any questions; just generate the image.';
const STYLE = {
  pet: 'Style: premium cute chibi fantasy pet, soft 3D-painted anime illustration, soft plush-toy surfaces (fine fluffy fuzz only where the design says fuzzy or fluffy; otherwise a smooth glossy shell or soft smooth skin, never realistic scales or insect hairs), soft pastel colors, big glossy eyes with white highlights, light pink blush, a thin warm golden-white rim light along the outline, clean soft shading. Every cell shows exactly the same character design (same colors, markings, proportions and accessories); only the pose and expression change. Full body, 3/4 view facing the viewer\'s right, feet near the bottom of the cell.',
  egg: 'Style: premium cute 3D-painted game illustration, soft pastel colors, gentle warm rim light, clean soft shading. Each egg keeps exactly the shape, pattern, colors and nest (if it has one) of the reference picture; only its tilt and the effect around it change. Front view, the bottom of the egg (or its nest) near the bottom of the cell.',
  icon: 'Style: premium cute 3D-painted game icon, the same rendering as the pets and eggs of this game: soft pastel colors, glossy highlights, a gentle warm rim light, clean soft shading, a clear readable silhouette at 48 pixels. Front view, centered, about 80% of the cell.',
  title: 'Style: shiny 3D game achievement medal, glossy enamel and polished metal, soft gem highlights, a clean bold outline, a symmetric frame, front view, one medal per cell, centered, about 78% of the cell, readable at 48 pixels. The FRAME (shape, rim and enamel color) shows the rarity tier and must be exactly as described for each cell. The small picture in the middle of the medal is different for every medal: a simple bold cute 3D object, mostly white or light colored with soft color accents, slightly raised from the enamel. No text, no letters, no numbers on the medals.'
};
// 처음 그리는 그림: Drive의 기존 펫 그림을 열어 그림체를 맞춘다(모든 펫 시트에 들어간다, 36번과 같은 문장).
// STYLE.pet만 36번과 다르다: 곤충 · 공룡은 털이 아니라 껍질 · 매끈한 피부라 "털" 문장을 바꿨다.
const STYLE_REF = `STYLE REFERENCE — before drawing, open these pictures in Google Drive and study them: the existing pets of this game in the Drive folder "${PET_SPRITES}" (the folders MONG, NABI, PINKY and BAMBOO, each with 01_baby.png, 02_grown.png and 03_final.png). Draw in exactly that art style: the same crisp, clean shapes and edges, the same clear soft pastel colors (not washed out, not hazy), the same glossy eyes with white highlights, the same light cel-like shading with a thin warm rim light, the same simple fur tufts and the same body proportions (big head, short legs). ${KEEP} Do NOT copy the reference animals.`;
const SERIES_REF = {
  54: 'Also open "24a-1.png" and "24a-6.png" in the Google Drive folder "SUMUS 새 펫 24 (Runner용)" (newer pets of this game, a basic one and a 영웅 one) and match their finish, body size in the cell and level of detail exactly. This pet is one of a new family of six cute BUG pets (ladybug, honeybee, ant, firefly, rhinoceros beetle, swallowtail butterfly); it must fit in that family and in the game\'s pet family.',
  55: 'Also open "24a-1.png" and "24a-6.png" in the Google Drive folder "SUMUS 새 펫 24 (Runner용)" (newer pets of this game) and "07a-1.png" in the Google Drive folder "SUMUS 전설 펫 07 (Runner용)" (해치, a legendary pet) and match their finish, body size in the cell and level of detail exactly. This pet is one of a new family of six cute baby DINOSAUR pets (triceratops, stegosaurus, brachiosaurus, pteranodon, ankylosaurus, tyrannosaurus); it must fit in that family and must look clearly different from the dragon pet 용이 (a dinosaur has no wings except the pteranodon, no horns like a dragon, no fire).'
};
const BUG_MOOD = 'A BUG pet for teenagers who may not like real insects: make it adorable, round and soft like a plush toy, NEVER creepy or realistic. A big round head with big glossy eyes, a tiny smile and pink blush, a short round body, only SIX tiny stubby rounded legs (no thin spiky legs, no hairs, no mandibles, no realistic compound eyes), soft rounded antennae with little round tips. ';
const DINO_MOOD = 'A baby DINOSAUR pet: chubby, round and soft like a plush toy, a big head, big glossy eyes with white highlights, pink blush, a tiny friendly smile with NO sharp teeth showing, short stubby legs, smooth soft skin with gentle pastel patterns (no rough scales, no claws). Friendly and cute, never scary. ';
const MOOD_X = 'Keep exactly the 3D-painted art style of the existing pets of this game. Do NOT copy or resemble any existing cartoon, anime, game or movie character (for example Pokémon, Digimon, Barney or The Good Dinosaur): this is an original character. ';
const TIER_D = {
  basic: '',
  epic: 'A 영웅 (epic) pet, one rank above basic: a little grander and more sparkling than a basic pet, with a soft golden rim light. ',
  legendary: 'A 전설 (legendary) pet, two ranks above basic: the grandest pet of this family, with a warm golden aura, a few floating golden sparkles and a richer, more detailed final stage. Still cute and friendly, never scary. '
};
const TIER_X = { basic: '', epic: ' A 영웅 (epic) pet: a soft golden rim light.', legendary: ' A 전설 (legendary) pet: a warm golden aura and a few golden sparkles.' };

// 새 펫 12종. ko · type · tier는 구성안 표와 같다(코드 등록 때 core.js CHARACTERS에 그대로 쓴다).
// 생김새(그림 GPT용, 영어). `limb`: 응원 동작에서 드는 곳. `move`: 야차전 공격 자세.
export const PETS_54 = {
  // 54 곤충
  ladybug: { series: 54, ko: '점순이', type: '무당벌레', tier: 'basic', limb: 'one tiny front leg', move: 'rolling forward to the right like a little red ball, its shell closed, a trail of small sparkles',
    base: 'a round baby ladybug with a glossy cherry-red shell with big round black spots, a soft black-and-cream face, big glossy eyes, pink blush, two short rounded antennae with round tips, six tiny stubby legs. It must look different from the hunt monsters and from every pet of the game: a round red spotted shell, nothing like a turtle',
    egg: 'a small glossy red egg with round black polka dots like a ladybug, resting on a fresh green leaf with a dew drop', f: {
      1: 'baby stage: a tiny, very round baby ladybug sitting on its round shell, holding a small dew drop, no accessories',
      2: 'grown stage: a bigger young ladybug standing upright on its back legs (NOT a round baby), its shell a little open showing tiny clear wings, a mint scarf with a small gold star charm',
      3: 'final stage: a proud ladybug guardian standing tall, a shining red shell with golden-rimmed spots, small clear wings spread, a tiny golden leaf crown, a flowing green cape with gold trim fastened by a gold star clasp, golden sparkles (NOT a round baby)' } },
  bee: { series: 54, ko: '붕붕이', type: '꿀벌', tier: 'basic', limb: 'one tiny front leg', move: 'buzzing forward to the right at full speed with its wings a blur, a little honey drop flying ahead',
    base: 'a fluffy round baby honeybee with soft yellow fur and three soft brown stripes, a fuzzy cream collar, small clear rounded wings, big glossy eyes, pink blush, two short antennae with round tips, a tiny soft rounded stinger tip (not sharp). It must look different from the hummingbird 윙윙 and the long-tailed tit 포롱: a striped fuzzy bee body, no feathers, no beak',
    egg: 'a warm honey-gold egg with a soft hexagon honeycomb pattern, resting in a small piece of honeycomb with a drop of honey', f: {
      1: 'baby stage: a tiny, very round fuzzy baby bee sitting and hugging a small honey pot, tiny wings, no other accessories',
      2: 'grown stage: a bigger young bee hovering upright (NOT a round baby), carrying a small flower basket, a mint scarf with a small gold star charm',
      3: 'final stage: a cheerful queen-bee leader hovering proudly, shimmering golden wings, a tiny golden crown with an amber gem, a flowing honey-orange cape with gold trim fastened by a gold star clasp, holding a little golden honey dipper, golden sparkles (NOT a round baby)' } },
  ant: { series: 54, ko: '영차', type: '일개미', tier: 'basic', limb: 'one tiny front leg', move: 'charging forward to the right while lifting a big sugar cube over its head, a puff of dust behind',
    base: 'a small round baby ant with a glossy warm cocoa-brown body in three soft rounded parts, a big round head, big glossy eyes, pink blush, two bendy antennae with round tips, six tiny stubby legs, a tiny smile showing determination. It must look different from every pet of the game: a three-part rounded ant body in cocoa brown',
    egg: 'a smooth cocoa-cream egg with a soft tunnel pattern, resting in a little heap of sand with a sugar cube', f: {
      1: 'baby stage: a tiny, very round baby ant sitting and holding a sugar cube bigger than its head, no accessories',
      2: 'grown stage: a sturdy young ant standing on its back legs (NOT a round baby), a little yellow hard hat, carrying a small leaf over its shoulder, a mint scarf with a small gold star charm',
      3: 'final stage: a strong, proud ant captain standing on a big sugar cube, a small golden helmet with a ruby gem, a flowing red cape with gold trim fastened by a gold star clasp, lifting a golden crumb high with one arm, golden sparkles (NOT a round baby)' } },
  firefly: { series: 54, ko: '반짝이', type: '반딧불이', tier: 'basic', limb: 'one tiny front leg', move: 'zooming forward to the right with its tail lantern blazing, a ribbon of soft light behind it',
    base: 'a round baby firefly with a soft navy-blue body, a small orange-red head cap, big glossy eyes, pink blush, two short antennae with round tips, small clear wings, and a big round softly glowing lemon-yellow tail lantern. It must look different from the bee 붕붕이 and the ladybug 점순이: navy with a glowing round tail, no stripes, no spots',
    egg: 'a deep navy egg with tiny glowing yellow dots like stars, resting in a small nest of moss with a soft glow around it', f: {
      1: 'baby stage: a tiny, very round baby firefly sitting with its tail glowing softly like a night light, no accessories',
      2: 'grown stage: a bigger young firefly hovering upright (NOT a round baby), its tail lantern brighter, a tiny paper map in its hands, a mint scarf with a small gold star charm',
      3: 'final stage: a graceful night-sky firefly guide hovering proudly, a brilliant golden tail lantern lighting tiny stars around it, a small golden crescent tiara, a flowing midnight-blue cape with gold trim fastened by a gold star clasp, golden sparkles (NOT a round baby)' } },
  rhinobeetle: { series: 54, ko: '장수', type: '장수풍뎅이', tier: 'epic', limb: 'one front leg', move: 'charging forward to the right horn first, lifting a small acorn with its big curved horn, a burst of dust',
    base: 'a sturdy round baby rhinoceros beetle with a glossy deep chestnut-brown shell, one big smooth rounded curved horn on its head (soft tip, not sharp), big glossy eyes, pink blush, short rounded antennae, six tiny stubby legs. It must look different from the ladybug 점순이 and the ant 영차: a big glossy brown shell and one big curved horn',
    egg: 'a glossy chestnut-brown egg with a soft wood-grain pattern and a small horn-shaped bump on top, resting on a little log with a leaf', f: {
      1: 'baby stage: a tiny, very round baby rhinoceros beetle with a tiny horn nub, sitting and hugging an acorn, no accessories',
      2: 'grown stage: a strong young rhinoceros beetle standing on its back legs (NOT a round baby), a bigger curved horn, flexing one front leg proudly, a mint scarf with a small gold star charm',
      3: 'final stage: a mighty forest champion rhinoceros beetle standing tall on a log, a big golden-tipped curved horn, a gleaming bronze shell, a small golden crown ring around its horn, a flowing forest-green cape with gold trim fastened by a gold star clasp, golden sparkles (NOT a round baby)' } },
  butterfly: { series: 54, ko: '나풀', type: '호랑나비', tier: 'epic', limb: 'one wing', move: 'swooping forward to the right with its wings sweeping a shimmering cloud of sparkle dust',
    base: 'a round fluffy baby swallowtail butterfly with a soft cream fuzzy body, big rounded wings in pale lemon-yellow with soft black stripes and small sky-blue and orange spots near the tails, big glossy eyes, pink blush, two curly antennae with round tips. It must look different from the hummingbird 윙윙 and the flamingo 밍고: big soft butterfly wings, no feathers, no beak',
    egg: 'a soft pale-yellow egg with gentle butterfly-wing stripes, resting on a small flower with lavender petals', f: {
      1: 'baby stage: a tiny, very round fluffy caterpillar-like baby in soft lemon-green with tiny wing buds, sitting on a leaf and nibbling it, no accessories',
      2: 'grown stage: a young butterfly with its wings fully open (NOT a round baby), standing on a flower, a mint scarf with a small gold star charm',
      3: 'final stage: a radiant swallowtail queen with large shimmering wings edged in gold, glowing sky-blue and orange wing spots, a small golden flower crown, a flowing lavender cape with gold trim fastened by a gold star clasp, golden sparkles and floating petals (NOT a round baby)' } },
  // 55 공룡
  tricera: { series: 55, ko: '뿔뿔이', type: '아기 트리케라톱스', tier: 'basic', limb: 'one front foot', move: 'charging forward to the right head down with its three rounded horns, a puff of dust behind its feet',
    base: 'a chubby baby triceratops with soft mint-green skin, a big rounded peach-colored frill around its head with small cream dots, three short smooth rounded horns (soft tips), big glossy eyes, pink blush, a tiny smile, short stubby legs and a short tail. It must look different from the dragon 용이 and the calf 음매: a frill and three rounded horns, no wings, no mane',
    egg: 'a mint-green egg with peach-colored triangle patterns, resting in a small nest of fern leaves', f: {
      1: 'baby stage: a tiny, very round baby triceratops peeking out with a piece of eggshell still on its head, tiny horn nubs, no other accessories',
      2: 'grown stage: a sturdy young triceratops standing on four legs (NOT a round baby), clearer horns and frill, a mint scarf with a small gold star charm',
      3: 'final stage: a proud triceratops guardian standing on a mossy rock, golden-tipped horns, a large frill with a golden rim, a flowing teal cape with gold trim fastened by a gold star clasp, golden sparkles (NOT a round baby; kind, never angry)' } },
  stego: { series: 55, ko: '삐죽이', type: '아기 스테고사우루스', tier: 'basic', limb: 'one front foot', move: 'spinning to the right and swinging its tail with four soft rounded spikes, small leaves flying',
    base: 'a round baby stegosaurus with soft lavender skin and a cream belly, a row of rounded pastel-pink back plates like soft petals, a short tail with four small soft rounded spikes, big glossy eyes, pink blush, a tiny smile, short stubby legs. It must look different from the hedgehog 도치 and the chameleon 카멜: big rounded back plates on a dinosaur body',
    egg: 'a lavender egg with soft pink diamond plates on its top half, resting in a small nest of twigs', f: {
      1: 'baby stage: a tiny, very round baby stegosaurus with tiny back plates, sitting and holding a little leaf, no other accessories',
      2: 'grown stage: a sturdy young stegosaurus standing on four legs (NOT a round baby), taller back plates, a mint scarf with a small gold star charm',
      3: 'final stage: a magnificent stegosaurus with glowing rose-gold back plates, a small golden band on its tail, a flowing purple cape with gold trim fastened by a gold star clasp, golden sparkles (NOT a round baby)' } },
  brachio: { series: 55, ko: '롱롱이', type: '아기 브라키오사우루스', tier: 'basic', limb: 'one front foot', move: 'swinging its long neck forward to the right like a whip, a few leaves flying',
    base: 'a chubby baby brachiosaurus with soft sky-blue skin and a cream belly, a long gentle curved neck, a small round head with a tiny bump on top, big glossy eyes, pink blush, a sleepy sweet smile, four short stubby legs and a short tail, soft pale spots on its back. It must look different from the elephant 코롱 and the snake 초롱: a long neck on a round four-legged body',
    egg: 'a sky-blue egg with soft cream spots, resting in a small nest of big round leaves', f: {
      1: 'baby stage: a tiny, very round baby brachiosaurus with a short neck, sitting and munching a small leaf, no other accessories',
      2: 'grown stage: a taller young brachiosaurus standing on four legs (NOT a round baby), its neck longer, a little treetop branch in its mouth, a mint scarf with a small gold star charm',
      3: 'final stage: a tall, gentle giant brachiosaurus with its long neck held high, a small golden leaf crown on its head, a flowing sky-blue cape with gold trim fastened by a gold star clasp across its back, golden sparkles (NOT a round baby)' } },
  ptera: { series: 55, ko: '휘익', type: '아기 프테라노돈', tier: 'epic', limb: 'one wing', move: 'diving forward to the right with its wings swept back, a streak of wind behind it',
    base: 'a round baby pteranodon with soft coral-orange skin, a cream belly, wide soft leathery wings with rounded edges, a smooth rounded head crest, a short rounded beak, big glossy eyes, pink blush, tiny feet. It must look different from the parrot 앵두, the phoenix 불새 and the dragon 용이: smooth leathery wings, a head crest, no feathers, no fire',
    egg: 'a coral-orange egg with soft wind-swirl patterns, resting in a small cliff-top nest of twigs', f: {
      1: 'baby stage: a tiny, very round baby pteranodon sitting with its small wings folded, a tiny crest, no accessories',
      2: 'grown stage: a young pteranodon with its wings spread (NOT a round baby), standing on a rock, a pair of tiny goggles on its crest, a mint scarf with a small gold star charm',
      3: 'final stage: a majestic sky-ruler pteranodon gliding with wide wings edged in gold, a long golden-tipped crest, a small golden feather pin, a flowing sunset-orange cape with gold trim fastened by a gold star clasp, golden sparkles and soft clouds (NOT a round baby)' } },
  ankylo: { series: 55, ko: '단단이', type: '아기 안킬로사우루스', tier: 'epic', limb: 'one front foot', move: 'swinging its round club tail forward to the right with a big "bonk", small impact stars',
    base: 'a chubby, low and wide baby ankylosaurus with soft sand-beige skin and a shell-like armored back of rounded caramel bumps, a round club at the end of its tail, big glossy eyes, pink blush, a tiny smile, short stubby legs. It must look different from the turtle 느릿 and the hedgehog 도치: a wide armored dinosaur with a club tail, no shell to hide in, no spines',
    egg: 'a sand-beige egg with rounded caramel bumps like armor, resting in a small nest of pebbles', f: {
      1: 'baby stage: a tiny, very round baby ankylosaurus with tiny back bumps and a tiny club tail, sitting and smiling, no accessories',
      2: 'grown stage: a sturdy young ankylosaurus standing on four legs (NOT a round baby), its club tail bigger, a mint scarf with a small gold star charm',
      3: 'final stage: a mighty armored ankylosaurus champion with golden-rimmed back bumps, a shining bronze club tail, a small golden helmet with a topaz gem, a flowing orange cape with gold trim fastened by a gold star clasp, golden sparkles (NOT a round baby)' } },
  tyranno: { series: 55, ko: '렉스', type: '아기 티라노사우루스', tier: 'legendary', limb: 'one tiny arm', move: 'stomping forward to the right with a mighty roar (mouth open in a cute shout, small rounded teeth only), shock waves and golden sparkles',
    base: 'a chubby baby tyrannosaurus with soft warm orange-red skin and a cream belly, a big round head, big glossy eyes, pink blush, a wide cute grin with tiny rounded teeth, very short tiny arms, strong stubby legs and a thick short tail, soft darker stripes on its back. It must look different from the dragon 용이 and the crocodile 덥썩: a standing two-legged dinosaur with tiny arms, no wings, no horns, a short snout',
    egg: 'a large glossy amber-orange egg with golden crackle lines and a soft golden glow, resting in a nest of volcanic rocks and ferns', f: {
      1: 'baby stage: a tiny, very round baby tyrannosaurus sitting in half an eggshell, trying a tiny cute roar, no other accessories',
      2: 'grown stage: a sturdy young tyrannosaurus standing on its two legs (NOT a round baby), a proud pose, a mint scarf with a small gold star charm',
      3: 'final stage: a magnificent king tyrannosaurus standing tall on a volcanic rock, a golden crown with a ruby gem, golden stripes along its back, a flowing royal crimson cape with gold trim fastened by a gold star clasp, a warm golden aura and floating golden sparkles (NOT a round baby; proud and friendly, never scary)' } }
};
export const PAIRS_54 = { 54: [['ladybug', 'bee'], ['ant', 'firefly'], ['rhinobeetle', 'butterfly']], 55: [['tricera', 'stego'], ['brachio', 'ptera'], ['ankylo', 'tyranno']] };
// 56b 테마 칭호 메달(영웅 테두리, 11 · 25 · 50번 문장과 같다).
export const MEDALS_56 = [
  { key: 'bugall', ko: '곤충 채집왕', tier: 'epic', center: 'a small bug-catching net with a cute round ladybug, a tiny bee and a little butterfly peeking out of it.' },
  { key: 'dinoall', ko: '쥬라기 반장', tier: 'epic', center: 'a cracked dinosaur egg with a tiny class-leader armband tied around it and a small fern leaf.' }
];
const FRAME_EPIC = 'a SHIELD-shaped crest with a polished lavender-silver rim, a rich AMETHYST PURPLE enamel face and a small violet gem at the top.';

// 겹침 검사: 지금 펫 key · 이름, 칭호 key · 이름과 겹치면 멈춘다(그림 파일 이름은 key 그대로라 겹치면 기존 펫 그림을 덮는다).
// V13.195 코드 등록 뒤에는 같은 key · 같은 이름으로 등록된 자기 자신(시리즈 펫 · 테마 칭호)은 겹침이 아니다.
{
  const mine = (k, ko) => CHARACTERS[k]?.series && CHARACTERS[k].ko === ko, mineTitle = (k, ko) => TITLES[k]?.name === ko;
  const petNames = new Set(Object.entries(CHARACTERS).filter(([k]) => !PETS_54[k]).map(([, c]) => c.ko)), titleNames = new Set(Object.entries(TITLES).filter(([k]) => !MEDALS_56.some(m => m.key === k)).map(([, t]) => t.name));
  const bad = [...Object.entries(PETS_54).filter(([k, p]) => (CHARACTERS[k] && !mine(k, p.ko)) || petNames.has(p.ko) || !/^[a-z]+$/.test(k)).map(([k]) => k),
    ...MEDALS_56.filter(m => (TITLES[m.key] && !mineTitle(m.key, m.ko)) || titleNames.has(m.ko)).map(m => m.key)];
  if (bad.length || new Set(Object.values(PETS_54).map(p => p.ko)).size !== Object.keys(PETS_54).length) throw new Error('펫 · 칭호 key · 이름 확인: ' + bad.join(', '));
}

const FORM_KO = { 1: '아기', 2: '성장', 3: '최종' };
const CELLS = ['TOP-LEFT', 'TOP-RIGHT', 'BOTTOM-LEFT', 'BOTTOM-RIGHT'];
const CELL_KO = ['왼쪽 위', '오른쪽 위', '왼쪽 아래', '오른쪽 아래'];
const EXPRS = [
  ['happy', '기뻐함', 'HAPPY: eyes closed in a big happy smile, rosy cheeks, two or three small pink hearts floating above the head'],
  ['eat', '냠냠', 'EATING: happily eating from a small round mint food bowl in front of it, cheeks puffed, a few crumbs, eyes curved in joy'],
  ['sad', '시무룩', 'SAD: slightly sad pouty face with teary sparkling eyes, ears, wings, antennae or tail drooping a little, still cute (not crying hard); keep the same face, markings and items as the other cells'],
  ['cheer', '응원', 'CHEERING: energetic pose with one front paw, arm, leg, wing or foot raised high, determined sparkling eyes, small motion sparkles']
];
const EGG_HAPPY = 'PETTED (기뻐함): the egg tilts to one side as if wiggling happily, two short curved motion lines on each side, three small pink hearts floating above. Do NOT crack the egg and do NOT give it a face.';
const EGG_WARM = 'WARMED (따뜻해짐): the egg glows with a soft warm orange-golden aura, three small wavy heat lines rising above it, a few tiny golden sparkles. Do NOT crack the egg, do NOT give it a face, no fire.';
const HURT_X = 'HURT: flinching from a hit that comes from the right: eyes squeezed shut, the body leaning back and to the left, antennae, wings, crest or tail flung back, two or three small impact stars and one sweat drop beside the head; still cute (NOT injured: no blood, no tears streaming, no wounds)';
const STAGE = 'IMPORTANT: draw this exact growth stage in every cell, with its full body size, proportions and accessories. Do not draw the younger baby version, and do not make it rounder, shorter or chubbier when it sits, eats or is sad.';

const ORDER = Object.keys(PETS_54);
const sheetOf = key => { const s = PETS_54[key].series; return `${s}a-${ORDER.filter(k => PETS_54[k].series === s).indexOf(key) + 1}`; };
const designRef = (series, keys) => `CHARACTER REFERENCE — before drawing, open ${keys.map(k => `"${sheetOf(k)}.png"`).join(' and ')} (the design sheet${keys.length > 1 ? 's' : ''}: egg, baby, grown, final) in the Google Drive folder "${DRIVE_54[series]}"`;
const moodOf = p => (p.series === 54 ? BUG_MOOD : DINO_MOOD) + MOOD_X;

export function sheets54() {
  const out = [], count = {};
  const add = (series, part, title, lines, cells) => {
    const s = `${series}${part}`, name = `${s}-${(count[s] = (count[s] || 0) + 1)}`;
    const text = [...lines.filter(Boolean),
      `WHEN DONE — upload the finished transparent PNG to Google Drive, into the folder "${DRIVE_54[series]}", named exactly "${name}.png" (if a file with that name is already there, replace it; if the folder does not exist, create it). Actually save the file to Google Drive; showing the picture in the chat is not enough.`].join('\n');
    out.push({ series, file: FILES_54[s], name, title, text, cells: cells.map((c, i) => ({ cell: CELL_KO[i], key: c[0], name: c[1], out: c[3] })) });
  };
  const cellLines = cells => cells.map((c, i) => `${CELLS[i]} cell: ${c[2]}`);
  for (const series of [54, 55]) {
    const keys = ORDER.filter(k => PETS_54[k].series === series);
    // a: 설정 시트(알 · 아기 · 성장 · 최종)
    for (const key of keys) {
      const p = PETS_54[key];
      const cells = [
        [`${key}-0`, `${p.ko} 알`, `EGG: ${p.egg}. Just the egg, no creature`, `public/assets/pets/${key}-0.webp`],
        [`${key}-1`, `${p.ko} 아기`, `BABY: the ${p.f[1]}, happy calm face, front 3/4 view`, `public/assets/pets/${key}-1.webp`],
        [`${key}-2`, `${p.ko} 성장`, `GROWN: the ${p.f[2]}, happy calm face, front 3/4 view`, `public/assets/pets/${key}-2.webp`],
        [`${key}-3`, `${p.ko} 최종`, `FINAL: the ${p.f[3]}, happy calm face, front 3/4 view`, `public/assets/pets/${key}-3.webp`]
      ];
      add(series, 'a', `${p.ko} ${p.type} 설정 시트`, [SHEET, STYLE.pet, STYLE_REF, SERIES_REF[series],
        `Subject: ${p.ko}, ${p.base}. ${moodOf(p)}${TIER_D[p.tier]}Draw the same character at four growth steps; each cell must clearly be the same creature, getting bigger and grander.`, ...cellLines(cells)], cells);
    }
    // b: 표정(단계마다 4) + 알 반응(두 펫씩)
    for (const key of keys) for (const form of [1, 2, 3]) {
      const p = PETS_54[key];
      const cells = EXPRS.map(([e, ko, text]) => [`${key}-${form}-${e}`, `${p.ko} ${FORM_KO[form]} ${ko}`, text, `public/assets/pets/${key}-${form}-${e}.webp`]);
      add(series, 'b', `${p.ko} ${FORM_KO[form]} 표정`, [SHEET, STYLE.pet, STYLE_REF,
        `${designRef(series, [key])} and match this pet's face, colors, markings, accessories and the body size of this growth stage exactly (baby = top-right cell, grown = bottom-left cell, final = bottom-right cell). ${KEEP}`,
        `Subject: ${p.ko}, ${p.base}. This is the ${p.f[form]}. In every cell that says a paw, arm, leg, wing or foot is raised, this pet raises ${p.limb} instead.${TIER_X[p.tier]}`, form > 1 ? STAGE : '', ...cellLines(cells)], cells);
    }
    for (const [a, b] of PAIRS_54[series]) {
      const pa = PETS_54[a], pb = PETS_54[b];
      const cells = [[`${a}-0-happy`, `${pa.ko} 알 기뻐함`, EGG_HAPPY, `public/assets/pets/${a}-0-happy.webp`], [`${a}-0-eat`, `${pa.ko} 알 따뜻해짐`, EGG_WARM, `public/assets/pets/${a}-0-eat.webp`],
        [`${b}-0-happy`, `${pb.ko} 알 기뻐함`, EGG_HAPPY, `public/assets/pets/${b}-0-happy.webp`], [`${b}-0-eat`, `${pb.ko} 알 따뜻해짐`, EGG_WARM, `public/assets/pets/${b}-0-eat.webp`]];
      add(series, 'b', `${pa.ko} · ${pb.ko} 알 반응`, [SHEET, STYLE.egg, STYLE_REF, `${designRef(series, [a, b])} and match each egg (the top-left cell of each design sheet) exactly. ${KEEP}`,
        `Subject: two pet eggs (the reference pictures show them). The TOP row cells show ${pa.ko}'s egg: ${pa.egg}. The BOTTOM row cells show ${pb.ko}'s egg: ${pb.egg}.`, ...cellLines(cells)], cells);
    }
    // c: 야차전 · 던전 공격 · 맞음(두 펫씩, 단계마다)
    for (const [a, b] of PAIRS_54[series]) for (const form of [1, 2, 3]) {
      const pa = PETS_54[a], pb = PETS_54[b];
      const cells = [a, b].flatMap(key => [
        [`${key}-${form}-attack`, `${PETS_54[key].ko} ${FORM_KO[form]} 공격`, `ATTACK: ${PETS_54[key].ko} in a dynamic attack pose: ${PETS_54[key].move}; the body stretched forward, a determined sparkling expression, motion lines behind it; still cute`, `public/assets/pets/${key}-${form}-attack.webp`],
        [`${key}-${form}-hurt`, `${PETS_54[key].ko} ${FORM_KO[form]} 맞음`, HURT_X, `public/assets/pets/${key}-${form}-hurt.webp`]]);
      add(series, 'c', `${pa.ko} · ${pb.ko} ${FORM_KO[form]} 공격·맞음`, [SHEET, STYLE.pet, STYLE_REF,
        `${designRef(series, [a, b])}. Draw the growth step named in the Subject (baby = top-right cell, grown = bottom-left cell, final = bottom-right cell of each design sheet) and keep each pet's face, colors, markings, size and accessories exactly; only the pose changes. Also open "24c-1.png" in the Google Drive folder "SUMUS 새 펫 24 (Runner용)" and "20-1.png" in the Google Drive folder "SUMUS 전투 자세 20 (Runner용)" (attack and hurt poses already made for other pets) and match how strong and how cute those poses are.`,
        `Subject: two different pets of the same growth step (the reference pictures show each one). TOP row: ${pa.ko}, ${pa.base}. This is the ${pa.f[form]}. BOTTOM row: ${pb.ko}, ${pb.base}. This is the ${pb.f[form]}. Each pet keeps exactly the design, size and accessories of its reference picture of this growth step; only the pose changes. LEFT cell of each row: ATTACK, RIGHT cell: HURT.`, ...cellLines(cells)], cells);
    }
  }
  // 56a: 알 상점 테마 알 아이콘(위 줄) + 같은 알의 다른 시안(아래 줄, 고르기용)
  {
    const egg = (key, theme, look) => `${theme} THEME EGG for the egg shop: ${look}. A single egg with its little stand, no creature, no face`;
    const BUG = 'a glossy leaf-green egg with soft ladybug-red spots and a tiny honeycomb band, two small rounded antennae-like curls of vine on top, resting on a small round leaf', BUG2 = 'a pale lemon egg with soft butterfly-wing patterns, a tiny glowing firefly light at its top, resting in a little woven bug-catching basket';
    const DINO = 'a large amber-cream egg with soft stone-colored fossil crackle lines and a tiny fern leaf print, resting in a small nest of round volcanic pebbles', DINO2 = 'a mint egg with peach triangle plates along its top like a tiny dinosaur back, resting half-buried in sand with a little bone-shaped stone';
    const cells = [
      ['ui-bug-egg', '곤충 채집 알 (알 상점)', egg('bug', 'BUG', BUG), 'public/assets/ui/bug-egg.webp'],
      ['ui-dino-egg', '공룡 화석 알 (알 상점)', egg('dino', 'DINOSAUR', DINO), 'public/assets/ui/dino-egg.webp'],
      ['ui-bug-egg-alt', '곤충 채집 알 (여분, 고르기용)', egg('bug', 'BUG', BUG2), '(여분: 왼쪽 위보다 나으면 이 칸을 ui/bug-egg로 넣는다)'],
      ['ui-dino-egg-alt', '공룡 화석 알 (여분, 고르기용)', egg('dino', 'DINOSAUR', DINO2), '(여분: 오른쪽 위보다 나으면 이 칸을 ui/dino-egg로 넣는다)']
    ];
    add(56, 'a', '곤충 채집 알 · 공룡 화석 알 상점 아이콘', [SHEET, STYLE.icon,
      `STYLE REFERENCE — before drawing, open the egg-shop egg icons already in this game: "21b-8.png" in the Google Drive folder "SUMUS 이벤트 펫 21 (Runner용)" (the 가을 이벤트 알, top-left cell) and the existing pets of this game in the Drive folder "${PET_SPRITES}" (MONG and NABI, 01_baby.png). Draw the eggs in exactly that style and size. ${KEEP} Do NOT copy the reference egg's pattern.`,
      'Subject: two new egg-shop eggs of a cute pet game (players are teenagers): a BUG theme egg and a DINOSAUR theme egg. TOP row: the main design of each; BOTTOM row: a second design option of the same egg. Eggs only: no creature, no face, no text.', ...cellLines(cells)], cells);
  }
  // 56b: 테마 칭호 메달(위 줄) + 다른 시안(아래 줄)
  {
    const alt = { bugall: 'a small glass bug jar with a cork lid holding a tiny glowing firefly, a small rhinoceros beetle horn on the lid.', dinoall: 'a small round fossil stone with a cute baby dinosaur footprint, a tiny fern leaf and a little bone.' };
    const cells = [...MEDALS_56.map(m => [`title-${m.key}`, `${m.ko} (영웅)`, `FRAME: ${FRAME_EPIC} CENTER: ${m.center}`, `public/assets/titles/${m.key}.webp`]),
      ...MEDALS_56.map(m => [`title-${m.key}-alt`, `${m.ko} (여분, 고르기용)`, `FRAME: ${FRAME_EPIC} CENTER: ${alt[m.key]}`, `(여분: 위 칸보다 나으면 이 칸을 titles/${m.key}로 넣는다)`])];
    add(56, 'b', '곤충 채집왕 · 쥬라기 반장 칭호 메달', [SHEET, STYLE.title,
      'STYLE REFERENCE — before drawing, open the existing title medals of this game in Google Drive and study them: "11-1.png" and "11-8.png" in the Google Drive folder "SUMUS 칭호 11 (Runner용)" (the first set of title medals; 11-8 has the 영웅 amethyst shield frame) and "25-1.png" and "25-10.png" in the Google Drive folder "SUMUS 칭호 25 (Runner용)". Draw the medals in exactly that style: the same glossy 3D toy-like metal and enamel, the same chunky rounded shapes, the same medal size in the cell, the same clean edges and soft sparkles. A medal of the same tier must have exactly the same frame as those medals. ' + KEEP + ' Do NOT copy the reference medals\' center pictures.',
      'Subject: two achievement medals of a teen vocabulary game ("Bug Collector King" for collecting all bug pets, "Jurassic Class Leader" for collecting the dinosaur pets), both 영웅 tier. TOP row: the main design; BOTTOM row: a second design option of the same medal. No letters and no numbers anywhere.', ...cellLines(cells)], cells);
  }
  return out;
}

// Codex 작업 지시(CODEX_PROMPT_54 · 55 · 56.md). 36번 지시문과 같은 틀, 다른 점은 "코드 등록 전"이라는 것.
const TIER_KO = { basic: '기본', epic: '영웅', legendary: '전설' };
const TITLE_54 = { 54: '곤충 펫 6종', 55: '공룡 펫 6종', 56: '테마 알 아이콘 · 테마 칭호 메달' };
const REF_A = { 54: '`pets/panda-3.webp`, `pets/mouse-1.webp`, `pets/hummingbird-2.webp`, `pets/chameleon-3.webp`', 55: '`pets/panda-3.webp`, `pets/calf-1.webp`, `pets/polarbear-2.webp`, `pets/haechi-3.webp`(전설 렉스만)' };
export function codexPrompt(series, list = sheets54()) {
  const l = list.filter(s => s.series === series), R = 'docs/asset-requests/runner';
  const parts = [...new Set(l.map(s => s.file.slice(0, 3)))];
  const rule = `- **PR까지만 만든다. 머지하지 않는다.** \`sumus-voca-prod-deploy\`에 머지하면 운영에 바로 배포된다. **운영 Supabase에 연결하지 않는다.**
- **그림은 Codex에 내장된 그림 생성 기능으로 만든다.** OpenAI API 키(\`OPENAI_API_KEY\`)나 유료 API를 쓰지 않는다. 키가 없다고 멈추지 않는다.
- **Google Drive는 쓰지 않는다. 멈추지 않는다.** 아래 "프롬프트 손보기"대로 Drive 문구를 지우고 저장소 안의 기존 그림을 참고 그림으로 붙인다.
- 브랜치는 \`sumus-voca-prod-deploy\`에서 새로 만든다(예: \`codex/art-${series}\`). 그 브랜치에 \`${R}/${FILES_54[`${series}a`]}\`가 없으면 주문서 PR이 아직 머지되지 않은 것이다. 그때는 \`claude/bug-dino-pets-plan\`에서 시작하고 PR 대상도 그 브랜치로 한다.
- \`public/assets/\` 아래 **새 그림**, \`${R}/DONE_${series}.md\`, 빌드가 바꾸는 \`public/sw.js\` · \`public/modules/pet-art.js\` 말고는 고치지 않는다. 앱 코드, 게임 규칙, 코인, 확률, 서버 로직, 점검 파일은 건드리지 않는다. 버전은 올리지 않는다.
- 원본 시트 PNG는 커밋하지 않는다(\`/tmp/art/\`). 기존 그림 파일은 지우거나 덮어쓰지 않는다. **새 파일만 추가**한다.
- **한 번에 시트 하나씩** 만든다. 여러 시트를 한 장에 몰아 그리지 않는다.`;
  const fix = `### 프롬프트 손보기 (Drive 대신 참고 그림 첨부)
주문서는 그림 GPT가 Google Drive를 여는 방식으로 쓰여 있다(Drive의 기존 그림을 열어 그림체를 맞추고, 정해진 Drive 폴더 "${DRIVE_54[series]}"에 정확한 파일 이름 "${l[0].name}.png" … 으로 저장). Codex는 Drive를 쓰지 않으니 보내기 전에 이렇게 바꾼다.
1. 다음으로 **시작하는 줄을 지운다**: \`STYLE REFERENCE\`, \`CHARACTER REFERENCE\`, \`Also open\`, \`WHEN DONE\`
2. 아래 표의 참고 그림을 같이 보여 주고, 프롬프트 **세 번째 줄**에 이 문장을 넣는다:
   \`REFERENCE IMAGES ARE ATTACHED: match their art style, rendering quality, crisp clean edges and colors exactly. If a reference shows this same character, keep its face, colors, markings and accessories exactly. Do NOT copy any other animal or character from the references, and do NOT copy or resemble any cartoon, anime, game or movie character.\``;
  const check = `## 점검
\`\`\`
npm ci
npm run build:assets      # 펫 그림이면 public/modules/pet-art.js가 바뀐다(새 펫 key가 들어가도 core.js에 등록되기 전에는 앱에 나오지 않는다)
npm run check             # release-check 전부 PASS
npm run check:cloudflare
\`\`\`
- 점검이 실패하면 점검 파일을 고치지 말고 PR에 실패 메시지를 그대로 적는다.
- 기존 그림의 \`D\`(삭제) · \`M\`(수정)이 없어야 한다: \`git diff --name-status origin/sumus-voca-prod-deploy -- public/assets\`
- \`${R}/DONE_${series}.md\`(한국어): 넣은 그림 표, 넣지 못한 그림과 이유, 시트마다 다시 만든 횟수, "눈으로 확인 필요". 마지막에 "새 펫 · 알 · 칭호는 코드 등록(다음 세션) 후에 앱에 나온다"를 적는다.
- PR 제목 \`그림 ${series}: ${TITLE_54[series]}\`, 본문 한국어. 미리보기 그림(\`/tmp/review/*.png\`)을 한 장으로 작게 합쳐 PR 코멘트로 올린다. 마지막 줄: \`> ⚠️ 머지하면 운영에 바로 배포됩니다. 선생님이 "머지해"라고 할 때만 머지합니다.\`
`;
  if (series === 56) {
    const cmds = l.map(s => s.file.includes('egg') ? `node $R/fit-assets.mjs /tmp/art/${s.name}.png ui/bug-egg ui/dino-egg - - --fit-each --size 256 --preview /tmp/review/${s.name}.png   # 아래 줄(여분)이 더 나으면 그 칸을 ui/bug-egg · ui/dino-egg로`
      : `node $R/fit-assets.mjs /tmp/art/${s.name}.png titles/bugall titles/dinoall - - --fit-each --small 96 --preview /tmp/review/${s.name}.png   # 아래 줄(여분)이 더 나으면 그 칸을 titles/bugall · titles/dinoall로`);
    return `# Codex 작업 지시: 그림 56 (테마 알 상점 아이콘 2 · 테마 칭호 메달 2 · 2시트)

## 목표
곤충 · 공룡 새 펫 테마(\`docs/bug-dino-pets-design.md\`)의 알 상점 아이콘 2개(\`ui/bug-egg\` · \`ui/dino-egg\`, 256px)와 칭호 메달 2개(\`titles/bugall\` · \`titles/dinoall\`, 256px + 96px 작은 그림)를 만들어 \`public/assets/\`에 넣고 PR을 만든다.
**그림 파일만 넣는다. 앱 코드는 고치지 않는다.** 알 · 칭호 등록은 다음 세션 코드에서 한다(그림만 먼저 들어와도 앱은 바뀌지 않는다).

| 시트 | 칸 | 파일 | 내용 |
|---|---|---|---|
${l.flatMap(s => s.cells.map(c => `| \`${s.name}\` | ${c.cell} | ${c.out.startsWith('public/') ? `\`${c.out}\`` : c.out} | ${c.name} |`)).join('\n')}

- 두 시트 모두 **아래 줄은 같은 그림의 다른 시안(여분)** 이다. 위 줄보다 나으면 그 칸을 위 칸 파일 이름으로 넣는다. 여분은 따로 넣지 않는다.
- 메달 테두리는 **영웅(보라 방패)** 이다. 기존 영웅 메달과 테두리가 똑같아야 한다. 글자 · 숫자 없음.

## 꼭 지킬 것
${rule}

## 입력 (저장소 안, \`${R}/\`)
- \`split/56a-1 …\` · \`split/56b-1 …\`, 묶음 전체는 \`${FILES_54['56a']}\` · \`${FILES_54['56b']}\`, 칸과 파일은 \`slice-map.csv\`(\`list\` 열이 \`56a-…\` · \`56b-…\`).
- 자르기 도구: \`fit-assets.mjs\`(사용법은 파일 맨 위 주석). \`sharp\`가 없으면 \`npm i --no-save sharp\`.

${fix}

### 참고 그림 (\`public/assets/\` 아래 경로)
| 시트 | 참고 그림 |
|---|---|
| 56a 알 아이콘 | \`ui/event-egg.webp\`, \`ui/epic-egg.webp\`, \`ui/mythic-egg.webp\` |
| 56b 칭호 메달 | \`titles/words1000.webp\`, \`titles/gram30.webp\`, \`titles/preview-25.webp\` (영웅 테두리) |

## 자르고 넣기
\`\`\`
R=${R}
${cmds.join('\n')}
\`\`\`

${check}`;
  }
  const keys = ORDER.filter(k => PETS_54[k].series === series);
  const of = (part, key) => l.filter(s => s.file === FILES_54[`${series}${part}`] && s.cells.some(c => c.key.startsWith(`${key}-`))).map(s => s.name);
  const range = names => names.length > 1 ? `${names[0]}~${names.at(-1).split('-')[1]}` : names[0] || '-';
  const cmd = s => {
    const outs = s.cells.map(c => c.out.replace('public/assets/', '').replace(/\.webp$/, ''));
    if (/design\.txt$/.test(s.file)) return `node $R/fit-assets.mjs /tmp/art/${s.name}.png ${outs.join(' ')} --stand --preview /tmp/review/${s.name}.png`;
    return `node $R/fit-sheets.mjs /tmp/art/${s.name}.png ${outs.map(o => o.replace(/^pets\//, '')).join(' ')} --preview /tmp/review/${s.name}.png`;
  };
  return `# Codex 작업 지시: 그림 ${series} (${TITLE_54[series]}: ${keys.map(k => `${PETS_54[k].ko}(${PETS_54[k].type})`).join(' · ')})

## 목표
SUMUS VOCA(저장소 \`minsik2e5/sumus-quiz-battle\`)의 그림 주문서 ${series}로 새 펫 그림(설정 · 표정 · 알 반응 · 야차전 공격/맞음)을 만들고, 잘라서 \`public/assets/pets/\`에 넣은 뒤 PR을 만든다. 구성안: \`docs/bug-dino-pets-design.md\`.
**그림 파일만 넣는다. 앱 코드는 고치지 않는다.**

> ⚠️ **이 펫들은 아직 코드(\`public/modules/core.js\` CHARACTERS)에 없다.** 그림이 들어와도 펫 등록 · 특기 · 알은 다음 세션에서 코드로 하므로, 그림만으로는 앱이 바뀌지 않고 깨지지도 않는다(\`build:assets\`가 \`pet-art.js\`에 key를 넣어도 등록 전에는 아무도 부르지 않는다). 선생님 결정: 새 펫은 그림이 오면 코드와 **같이 머지**한다.

| 등급 | 펫 key | 이름 | 설정 시트 | 표정 시트 | 알 반응 | 전투 자세 |
|---|---|---|---|---|---|---|
${keys.map(k => `| ${TIER_KO[PETS_54[k].tier]} | \`${k}\` | ${PETS_54[k].ko} · ${PETS_54[k].type} | ${range(of('a', k))} | ${range(of('b', k).filter(n => !l.find(s => s.name === n).title.includes('알 반응')))} | ${range(of('b', k).filter(n => l.find(s => s.name === n).title.includes('알 반응')))} | ${range(of('c', k))} |`).join('\n')}

- 시트는 모두 **${l.length}장**(${parts.map(p => `${p} ${l.filter(s => s.file.startsWith(p)).length}`).join(' · ')}).
- 한 펫의 그림 = 기본 4 + 표정 12 + 알 반응 2 + 전투 6 + 작은 그림 4 = 28개.
- 앱은 이 파일 이름을 그대로 읽는다(\`<key>-<단계>.webp\`, \`<key>-<단계>-<표정>.webp\`, \`<key>-<단계>-attack.webp\`). 이름이 다르면 그 펫은 나오지 않는다.

## 그림체 (중요)
- **기존 펫과 똑같은 그림체**(3D 페인팅, 반짝이는 큰 눈, 볼터치, 금빛 테두리 빛). 영웅은 성장 · 최종이 조금 더 화려하고${series === 55 ? ', 전설 렉스는 이 묶음에서 가장 화려하다(금빛 기운)' : ''}.
- ${series === 54 ? '**곤충을 싫어하는 학생도 귀엽게 볼 수 있게**: 인형처럼 동글동글, 다리는 짧고 뭉툭한 6개, 털 · 집게 · 겹눈 같은 실제 벌레 느낌 없음. 징그러우면 다시 만든다.' : '**무섭지 않게**: 인형처럼 통통, 날카로운 이빨 · 발톱 없음. 기존 용 펫(용이)과 헷갈리지 않게(날개는 프테라노돈만, 불 없음).'}
- **만화 · 애니 · 게임 · 영화 캐릭터를 따라 그리거나 닮게 그리지 않는다.** 모두 새 캐릭터다. 각 주문서의 "must look different" 문장을 지킨다.

## 꼭 지킬 것
${rule}

## 입력 (저장소 안, \`${R}/\`)
- \`split/\` 폴더: 시트 하나 = 프롬프트 하나(예: \`split/${l[0].name} ${l[0].title}.txt\`).
- \`slice-map.csv\`: 각 칸의 이름(\`key\`)과 앱 파일(\`app_file\`). \`list\` 열이 \`${parts.join('…`·`')}…\`인 줄만 본다. 칸 순서는 왼쪽 위 → 오른쪽 위 → 왼쪽 아래 → 오른쪽 아래.
- 자르기 도구: \`fit-assets.mjs\`, \`fit-sheets.mjs\`(사용법은 파일 맨 위 주석). \`sharp\`가 없으면 \`npm i --no-save sharp\`.

${fix}

### 참고 그림 (\`public/assets/\` 아래 경로)
| 시트 | 참고 그림 |
|---|---|
| ${series}a 설정 | ${REF_A[series]} |
| ${series}b 표정 | 그 펫 · 단계의 새 그림 \`pets/<키>-<단계>.webp\` (예: ${l.find(s => s.file.endsWith('expressions.txt')).name} → \`pets/${keys[0]}-1.webp\`) |
| ${series}b 알 반응 | 두 펫의 \`pets/<키>-0.webp\` |
| ${series}c 전투 자세 | 두 펫의 그 단계 새 그림 + 기존 자세 \`pets/elephant-2-attack.webp\`, \`pets/elephant-2-hurt.webp\` |

### 후보 점검 (모두 통과해야 쓴다)
1. 배경이 진짜 투명이다(네 모서리 alpha 0, 체크무늬 · 흰 상자 · 흰 테두리 없음).
2. 칸마다 그림이 하나씩 따로 있고, 겹치거나 잘리지 않았다. 글자, 숫자, 테두리, 바닥 그림자가 없다.
3. 같은 시트의 칸들은 같은 캐릭터 디자인이다(색, 무늬, 소품).
4. 설정 시트는 알 → 아기 → 성장 → 최종으로 분명히 커지고 화려해진다. 알에는 얼굴이 없다. 표정 · 전투 자세는 같은 단계의 몸 크기와 소품이 설정 시트와 같다. 공격은 오른쪽으로 달려들고, 맞음은 오른쪽에서 맞아 왼쪽으로 몸을 젖힌다(피 · 상처 없이 귀엽게).

이미지를 볼 수 있으면 4번과 "${series === 54 ? '징그럽지 않은지' : '무섭지 않은지'}"는 눈으로 확인한다. 볼 수 없으면 1~3번만 확인하고 PR에 "눈으로 확인 필요"라고 적는다.

## 1. 그림 만들기
- **Codex의 내장 그림 생성 기능**으로 시트를 하나씩 만든다. 2×2 시트 1024×1024, **투명 배경 PNG**. 만든 그림은 \`/tmp/art/<시트 번호>.png\`(예: \`/tmp/art/${l[0].name}.png\`).
- 점검을 통과하지 못하면 같은 프롬프트로 다시 만든다. 시트마다 최대 4번이다.
- **순서를 지킨다.** 설정 시트(\`${series}a\`)를 먼저 만들고 잘라 넣은 뒤, 그 그림을 참고로 표정 · 알 반응 · 전투 자세를 만든다. 순서: ${parts.join(' → ')}.
- 한 번에 다 못 만들면 **펫 하나를 끝까지**(설정 · 표정 · 알 반응 · 전투) 만든 단위로 끊는다. 못 만든 시트는 \`DONE_${series}.md\`의 "넣지 못한 그림"에 적는다.

## 2. 자르고 넣기
\`\`\`
R=${R}
${l.map(cmd).join('\n')}
\`\`\`
- **작은 그림**: 기본 그림(\`<키>-<단계>.webp\`, 단계 0~3)마다 \`<키>-<단계>-s.webp\`(160×160, 투명, \`fit: 'contain'\`)도 만든다. ${keys.length}종 × 4 = ${keys.length * 4}개.
- 도구가 "배경이 투명하지 않아요"나 "칸이 비어 있어요"로 멈추면 그 시트는 1단계로 돌아가 다시 만든다.

${check}`;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const list = sheets54();
  for (const file of Object.values(FILES_54)) writeFileSync(resolve(here, file), list.filter(s => s.file === file).map(s => s.text).join('\n---\n') + '\n');
  const split = resolve(here, 'split');
  mkdirSync(split, { recursive: true });
  for (const f of readdirSync(split)) if (/^5[456][a-c]-\d+ /.test(f)) unlinkSync(resolve(split, f));
  for (const s of list) writeFileSync(resolve(split, `${s.name} ${s.title.replace(/[\\/:*?"<>|()·]/g, ' ').replace(/\s+/g, ' ').trim()}.txt`), s.text + '\n');
  // slice-map.csv: 54~56 줄을 지우고 뒤에 다시 붙인다(번호는 앞의 마지막 번호 다음부터).
  const mapPath = resolve(here, 'slice-map.csv');
  const rows = readFileSync(mapPath, 'utf8').replace(/\n+$/, '').split('\n').filter(r => !/^"5[456][a-c]-/.test(r));
  let no = Math.max(...rows.slice(1).map(r => Number(r.split(',')[1]?.replace(/"/g, '')) || 0));
  const csv = v => `"${String(v).replace(/"/g, '""')}"`;
  const first = no + 1;
  for (const s of list) { no++; for (const c of s.cells) rows.push([s.file, String(no).padStart(3, '0'), s.title, c.cell, c.key, c.name, c.out].map(csv).join(',')); }
  writeFileSync(mapPath, rows.join('\n') + '\n');
  for (const series of [54, 55, 56]) writeFileSync(resolve(here, `CODEX_PROMPT_${series}.md`), codexPrompt(series, list));
  for (const series of [54, 55, 56]) { const l = list.filter(s => s.series === series); console.log(`${series}: ${l.length}시트 (${[...new Set(l.map(s => s.file))].map(f => `${f.slice(0, 3)} ${l.filter(s => s.file === f).length}`).join(' · ')})`); }
  console.log(`prompt_no ${String(first).padStart(3, '0')}~${String(no).padStart(3, '0')}`);
}
