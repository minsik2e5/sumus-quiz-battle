// 그림 주문서 54 · 55: 곤충 · 공룡 펫 12종(구성안 docs/pets-bug-dino-design.md).
//   54 = 1차 8종(일반 4 · 영웅 4), 55 = 2차 4종(전설 1 · 신화 1 · 특이 2). 56~59는 비워 둔다(60 이상은 칭호 4탄).
//   node docs/asset-requests/runner/build-54.mjs
// 펫은 아직 core.js(CHARACTERS)에 없다(그림이 온 뒤 코드 세션에서 등록). 그래서 키 · 이름 · 종류 · 등급을 여기 둔다.
//   코드 세션은 이 키 · 이름을 그대로 core.js에 넣는다(이름이 바뀌면 여기 ko만 고치고 다시 돌린다: 그림 파일 이름은 키라서 그대로).
// 만드는 것: 54a~55e 주문서(.txt), split/ 시트별 파일, slice-map.csv의 54 · 55 줄(있으면 같은 자리 · 같은 번호로 바꿔 쓴다), CODEX_PROMPT_54 · 55.md.
// (build-runner.mjs는 26번 이후를 모르므로 돌리지 않는다: slice-map.csv 뒤쪽이 지워진다.)
import { readFileSync, writeFileSync, mkdirSync, readdirSync, unlinkSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
export const DRIVE_54 = { 54: 'SUMUS 곤충·공룡 펫 54 (Runner용)', 55: 'SUMUS 곤충·공룡 펫 55 (Runner용)' };
export const FILES_54 = {
  '54a': '54a-bugdino-pets-design.txt', '54b': '54b-bugdino-pets-expressions.txt', '54c': '54c-bugdino-pets-battle-poses.txt',
  '55a': '55a-bugdino-pets2-design.txt', '55b': '55b-bugdino-pets2-expressions.txt', '55c': '55c-bugdino-pets2-battle-poses.txt',
  '55d': '55d-bugdino-mythic-reveal-poses.txt', '55e': '55e-bugdino-mythic-reveal-scene.txt'
};
const PET_SPRITES = 'SUMUS_PET_SPRITES_ALL_20261002/original_1254';
const KEEP = 'Do NOT make it softer, blurrier, foggier, more painterly or more watercolor-like than the reference.';
// 36 · 37 · 38번과 같은 첫 줄(같은 펫 가족으로 보이게).
const SHEET = 'Create ONE square image, 1024×1024 pixels, laid out as a 2×2 sprite sheet: four separate illustrations, one centered in each quarter (each quarter is 512×512). Leave generous empty space around every illustration so nothing touches or crosses the middle lines or the image edges. Use a real transparent background (PNG alpha) — do NOT paint a checkerboard, white box, grid lines, frames or borders. No text, no letters, no numbers, no labels, no watermark, no ground shadow. Do not ask me any questions; just generate the image.';
const STYLE = {
  pet: 'Style: premium cute chibi fantasy pet, soft 3D-painted anime illustration, soft pastel colors, big glossy eyes with white highlights, light pink blush, a thin warm golden-white rim light along the outline, clean soft shading. Every cell shows exactly the same character design (same colors, markings, proportions and accessories); only the pose and expression change. Full body, 3/4 view facing the viewer\'s right, feet near the bottom of the cell.',
  egg: 'Style: premium cute 3D-painted game illustration, soft pastel colors, gentle warm rim light, clean soft shading. Each egg keeps exactly the shape, pattern, colors and nest (if it has one) of the reference picture; only its tilt and the effect around it change. Front view, the bottom of the egg (or its nest) near the bottom of the cell.'
};
// 처음 그리는 그림: Drive의 기존 펫 그림을 열어 그림체를 맞춘다(모든 시트에 들어간다).
const STYLE_REF = `STYLE REFERENCE — before drawing, open these pictures in Google Drive and study them: the existing pets of this game in the Drive folder "${PET_SPRITES}" (the folders MONG, NABI, PINKY and BAMBOO, each with 01_baby.png, 02_grown.png and 03_final.png). Draw in exactly that art style: the same crisp, clean shapes and edges, the same clear soft pastel colors (not washed out, not hazy), the same glossy eyes with white highlights, the same light cel-like shading with a thin warm rim light and the same body proportions (big head, short legs). ${KEEP} Do NOT copy the reference animals.`;
// 등급마다 Drive에 확실히 있는 기존 그림(36 · 37번은 Codex가 저장소에 바로 넣어 Drive에 없을 수 있다).
const TIER_REF = {
  basic: 'Also open "24a-1.png" and "24a-5.png" in the Google Drive folder "SUMUS 새 펫 24 (Runner용)" (basic pets of this game) and match their finish, body size in the cell and level of detail exactly.',
  epic: 'Also open "24a-6.png" and "24a-8.png" in the Google Drive folder "SUMUS 새 펫 24 (Runner용)" (영웅 pets of this game) and match their finish, body size in the cell and level of detail exactly.',
  legendary: 'Also open "07a-1.png" (해치) and "07a-3.png" (별고래) in the Google Drive folder "SUMUS 전설 펫 07 (Runner용)" (the legendary pets of this game) and match their grandeur, golden aura and level of detail exactly. Do NOT copy those designs.',
  mythic: 'Also open "19a-2.png" (청룡) and "19a-4.png" (주작) in the Google Drive folder "SUMUS 신화 펫 19 (Runner용)" (the mythic pets of this game, the highest rank) and match their grandeur, prismatic rim light and level of detail exactly. Do NOT copy those designs.',
  limited: 'Also open "21a-1.png" (술술이) and "21a-2.png" (찰싹이) in the Google Drive folder "SUMUS 이벤트 펫 21 (Runner용)" (the funny event pets of this game) and match their finish, body size in the cell and playful charm exactly. Do NOT copy those designs.'
};
const MOOD = 'Extra small, round and soft like a plush toy: a very simple sweet face (small glossy eyes with white highlights, a tiny mouth, big round pink blush), short stubby limbs, often holding one small prop. Keep exactly the 3D-painted art style of the existing pets of this game. Do NOT copy or resemble any existing cartoon, anime or mascot character (for example Pokémon, Digimon or any dinosaur or bug cartoon): this is an original character. ';
const TIER_D = {
  basic: 'A basic pet. ',
  epic: 'A 영웅 (epic) pet, one rank below legendary: a little grander and more sparkling than a basic pet, with a soft golden rim light. ',
  legendary: 'A 전설 (legendary) pet, above 영웅 and below 신화: grand and majestic with a warm golden aura and a few floating golden sparkles, but still cute and friendly. Do NOT copy or resemble any existing cartoon, anime or mascot character: this is an original character. ',
  mythic: 'A 신화 (mythic) pet: the HIGHEST rank of this game, above legendary. It must be the most spectacular, richly detailed design of all pets, with a soft prismatic rainbow-gold rim light, a faint holographic shimmer and floating motifs of its own element. Cute and friendly, never scary. ',
  limited: 'A 특이 (special event) pet: quirky and funny like a cute school mascot, with one clear comic gimmick, in exactly the same art style as the other pets. '
};
const TIER_X = { basic: '', epic: ' A 영웅 (epic) pet: a soft golden rim light.', legendary: ' A 전설 (legendary) pet: a warm golden aura.', mythic: ' A 신화 (mythic) pet: a soft prismatic golden rim light.', limited: '' };
// 곤충 · 공룡 묶음(모든 펫 시트에 들어간다).
const GROUP = {
  bug: 'This is an INSECT pet. Draw it as a cute chibi bug, NEVER creepy: a round soft body, a big head with big glossy eyes, short antennae with tiny round tips, six very short stubby legs (it may stand on its back legs and use the front ones like arms), no realistic bug details (no hairs, no mandibles, no sharp parts).',
  dino: 'This is a DINOSAUR pet. Draw it as a cute chibi dinosaur, never scary: a round soft body, a big head, big glossy eyes, small rounded teeth only where described, rounded horns, plates and spikes (soft, never sharp). It is NOT a dragon: no fire, no feathered wings, no Eastern-dragon mane.'
};

// 키 · 이름 · 종류 · 등급(코드 세션이 core.js에 그대로 넣는다) + 생김새(그림 GPT용, 영어).
// `limb`: 응원 동작에서 드는 곳. `move`: 야차전 공격 자세.
export const PETS_54 = {
  ladybug: { series: 54, ko: '땡땡이', type: '무당벌레', group: 'bug', tier: 'basic', limb: 'one tiny front leg',
    move: 'flying forward to the right in a spin with its polka-dot shell spread open, little polka-dot shaped sparkles bursting',
    base: 'a round chubby baby ladybug with a glossy bright-red dome shell with big round black polka dots, a small black head with two short antennae tipped with little balls, big glossy black eyes with white highlights, pink blush, six tiny stubby black legs. It must look different from the rhinoceros beetle 장수 and the monster 포스트잇 나비: a round red dome with black polka dots, no horn',
    egg: 'a small round red egg with black polka dots, resting on a big green leaf with a tiny dewdrop', f: {
      1: 'baby stage: a tiny, very round baby ladybug sitting on a small leaf with its shell closed, no accessories',
      2: 'grown stage: a slightly bigger young ladybug standing upright on its back legs (NOT a round baby), its shell opened a little to show thin clear wings, holding a small daisy, a mint scarf with a small gold star charm',
      3: 'final stage: a proud ladybug hero hovering with its red polka-dot shell spread open and shimmering clear wings, a small golden crown with a ruby gem, a flowing red cape with gold trim fastened by a gold star clasp, small flower petals and golden sparkles (NOT a round baby)' } },
  ant: { series: 54, ko: '영차', type: '개미', group: 'bug', tier: 'basic', limb: 'one front arm',
    move: 'charging forward to the right and throwing a sugar cube, little sugar crumbs flying',
    base: 'a chubby little ant with a glossy cinnamon-red body made of three round parts (head, middle and a round bottom), two bent antennae with round tips, big glossy dark eyes, pink blush, six short stubby legs, always ready to carry something. It must look different from the monsters 샤프 벌레 and 클립 메뚜기: a small red-brown ant with three round body parts and no wings',
    egg: 'a small creamy-white oval egg with soft cinnamon dots, resting on a tiny mound of sand with a cookie crumb', f: {
      1: 'baby stage: a tiny round baby ant sitting and hugging a cookie crumb bigger than itself, no other accessories',
      2: 'grown stage: a sturdy young ant standing on its back legs (NOT a round baby), carrying a sugar cube above its head, a small yellow hard hat, a mint scarf with a small gold star charm',
      3: 'final stage: a strong cheerful ant captain standing on a little anthill, lifting a huge shiny sugar cube high with one arm, a small golden helmet with a star, a flowing cinnamon-red cape with gold trim fastened by a gold star clasp, golden sparkles (NOT a round baby)' } },
  triceratops: { series: 54, ko: '뿔뿔', type: '트리케라톱스', group: 'dino', tier: 'basic', limb: 'one front foot',
    move: 'charging forward to the right head first with its three rounded horns, a puff of dust behind its feet',
    base: 'a chubby baby triceratops with soft mint-teal skin, a peach belly, a big round frill around its head with small rounded bumps on the edge and soft yellow spots, two short rounded horns above the eyes and a tiny nose horn (all rounded, never sharp), big glossy eyes, pink blush, four short stubby legs and a short tail. It must look different from the dragon 용이, the rhino monster 체육대회 코뿔소 and the head-butt dinosaur 짱돌: a frill and three rounded horns, no wings, no fire',
    egg: 'a mint-teal dinosaur egg with soft yellow spots, resting in a small nest of fern leaves', f: {
      1: 'baby stage: a tiny round baby triceratops sitting with its horns just tiny nubs, nibbling a fern leaf, no accessories',
      2: 'grown stage: a sturdy young triceratops standing on four legs (NOT a round baby), a bigger frill with yellow spots, three rounded horns, a mint scarf with a small gold star charm',
      3: 'final stage: a big proud triceratops guardian standing on a mossy rock, a large frill shining with golden patterns, three rounded golden-tipped horns, a small golden crown, a flowing teal cape with gold trim fastened by a gold star clasp, ferns and golden sparkles (NOT a round baby; friendly, never angry)' } },
  brachio: { series: 54, ko: '길쭉', type: '브라키오사우루스', group: 'dino', tier: 'basic', limb: 'one front foot',
    move: 'swinging its long neck forward to the right like a big soft hammer, leaves flying',
    base: 'a gentle baby long-neck dinosaur (brachiosaurus) with soft lavender skin, a cream belly, a long curved neck, a small round head with big glossy eyes, pink blush and a tiny smile, a row of soft pastel-pink round spots along its back, four chubby legs and a long tail. It must look different from the legendary 기린, the snake 초롱 and the elephant 코롱: a dinosaur with a round body, a long neck and four legs, no horns, no mane, no trunk',
    egg: 'a lavender egg with pastel-pink round spots, resting in a soft nest of palm leaves', f: {
      1: 'baby stage: a tiny round baby long-neck dinosaur with a still-short neck, sitting and holding a small leaf, no accessories',
      2: 'grown stage: a taller young long-neck dinosaur standing on four legs (NOT a round baby), its neck now long and curved, a small leaf in its mouth, a mint scarf with a small gold star charm',
      3: 'final stage: a huge, gentle long-neck dinosaur of the jungle standing tall with its long neck raised, a small crown of golden leaves on its head, a flowing lavender cape with gold trim fastened by a gold star clasp on its chest, palm leaves and golden sparkles around (NOT a round baby)' } },
  beetle: { series: 54, ko: '장수', type: '장수풍뎅이', group: 'bug', tier: 'epic', limb: 'one front leg',
    move: 'lunging forward to the right and lifting with its big horn like a lever, flipping a small acorn into the air',
    base: 'a sturdy little Korean rhinoceros beetle with a glossy deep chestnut-brown shell with a soft cherry-wood shine, one big rounded upward-curving horn on its head and a small horn on its back, big glossy eyes, pink blush, six short stubby legs. It must look different from the monster 동사 사슴벌레 (no pincers: one big upward horn) and the ladybug 땡땡이',
    egg: 'a creamy oval egg with soft brown wood-grain patterns, resting on a small piece of oak bark with a tiny acorn', f: {
      1: 'baby stage: a tiny round baby beetle with only a tiny horn nub, sitting on an oak leaf, no accessories',
      2: 'grown stage: a strong young rhinoceros beetle standing on its back legs (NOT a round baby), a bigger curved horn, flexing one front leg proudly, a mint scarf with a small gold star charm',
      3: 'final stage: a majestic champion rhinoceros beetle standing on an oak branch, a gleaming armor-like shell with golden edges, a big golden-tipped horn, shimmering wings half open, a small golden crown, a flowing deep-red cape with gold trim fastened by a gold star clasp, golden sparkles (NOT a round baby)' } },
  butterfly: { series: 54, ko: '팔랑', type: '나비', group: 'bug', tier: 'epic', limb: 'one wing',
    move: 'fluttering forward to the right with one big wing flap, a swirl of glittering wing dust',
    base: 'a fluffy little butterfly with a soft round fuzzy cream body, big soft wings in pastel sky-blue and lilac with round white and peach spots, two curly antennae, big glossy eyes, pink blush, tiny stubby legs. It must look different from the cat 나비 (this is an insect), the monster 포스트잇 나비 (no sticky notes) and the hummingbird 윙윙',
    egg: 'a small pearly lilac egg with soft wing-shaped patterns, resting on a flower leaf', f: {
      1: 'baby stage: a tiny round fluffy baby butterfly with very small folded wings, sitting on a flower, no accessories',
      2: 'grown stage: a young butterfly fluttering beside a flower with its wings open (NOT a round baby), a mint scarf with a small gold star charm',
      3: 'final stage: a radiant butterfly fairy with large shimmering wings in sky-blue, lilac and gold with glowing round spots, a small golden tiara with a blue gem, a flowing sheer lilac cape with gold trim fastened by a gold star clasp, floating flower petals, glittering wing dust and golden sparkles (NOT a round baby)' } },
  stego: { series: 54, ko: '뾰족', type: '스테고사우루스', group: 'dino', tier: 'epic', limb: 'one front foot',
    move: 'spinning around and swinging its spiky tail forward to the right, small orange sparkles flying',
    base: 'a chubby baby stegosaurus with soft sage-green skin, a cream belly, a row of rounded pastel-orange back plates shaped like soft triangles, a small round head with big glossy eyes, pink blush, four short stubby legs and a short tail with four rounded spikes (soft, never sharp). It must look different from the hedgehog 도치, the crocodile 덥썩 and the triceratops 뿔뿔: back plates and a spiky tail, no frill, no horns',
    egg: 'a sage-green egg with rows of small orange triangle patterns, resting in a nest of ferns and pebbles', f: {
      1: 'baby stage: a tiny round baby stegosaurus with very small back plates, sitting and hugging a pebble, no accessories',
      2: 'grown stage: a sturdy young stegosaurus standing on four legs (NOT a round baby), bigger orange back plates, its spiky tail raised, a mint scarf with a small gold star charm',
      3: 'final stage: a mighty stegosaurus knight standing on a rock, its back plates glowing in sunset orange and gold, a golden tail with four rounded golden spikes, a small golden crown, a flowing orange cape with gold trim fastened by a gold star clasp, golden sparkles (NOT a round baby; friendly)' } },
  ptero: { series: 54, ko: '훨훨', type: '프테라노돈', group: 'dino', tier: 'epic', limb: 'one wing',
    move: 'diving forward to the right with its wings swept back, a gust of wind lines',
    base: 'a cute baby pteranodon (a flying reptile of the dinosaur age, NOT a bird and NOT a dragon) with soft coral-orange skin, big smooth leathery wings in a lighter peach color, a long pointed head crest, a long toothless beak, big glossy eyes, pink blush, small feet. It must look different from the dragon 용이, the parrot 앵두 and the flamingo 밍고: no feathers, smooth leathery wings and a long head crest',
    egg: 'a coral-orange egg with soft cloud patterns, resting on a small cliff-top nest', f: {
      1: 'baby stage: a tiny round baby pteranodon with small folded wings sitting in its cliff nest, no accessories',
      2: 'grown stage: a young pteranodon gliding with its wings spread wide (NOT a round baby), small aviator goggles on its forehead, a mint scarf with a small gold star charm',
      3: 'final stage: a majestic sky pteranodon soaring with huge wings edged in gold, a long golden-tipped crest, aviator goggles, a flowing sky-blue cape with gold trim fastened by a gold star clasp, small clouds and golden sparkles (NOT a round baby)' } },
  trex: { series: 55, ko: '쿵쾅', type: '티라노사우루스', group: 'dino', tier: 'legendary', limb: 'one tiny arm',
    move: 'stomping forward to the right with a huge mighty roar (small rounded teeth, never scary), shockwave rings around its feet',
    base: 'a chubby baby Tyrannosaurus with soft warm-red skin, a cream belly, a big round head, a wide happy grin showing a few tiny rounded teeth, funny tiny short arms, strong legs, big glossy amber eyes, pink blush, a row of small rounded bumps along its back. It must look different from the dragon 용이, the crocodile 덥썩 and the head-butt dinosaur 짱돌: it stands on two strong legs with tiny arms, no wings, no fire, no dome head',
    egg: 'a large glossy deep-red egg with softly glowing golden crack-like patterns, resting on a small warm volcanic rock with a golden aura (no fire)', f: {
      1: 'baby stage: a tiny round baby T-rex sitting and trying to reach a small drumstick with its tiny arms, no other accessories',
      2: 'grown stage: a strong young T-rex standing on two legs (NOT a round baby), its tiny arms raised proudly, a mint scarf with a small gold star charm',
      3: 'final stage: a grand legendary king T-rex standing on a volcanic rock with a soft golden aura, a big golden crown with a ruby gem, a flowing royal red cape with gold trim fastened by a gold star clasp, small golden bracers on its tiny arms, golden sparkles (NOT a round baby; mouth closed in a proud grin, never scary)' } },
  meganeura: { series: 55, ko: '태고', type: '고대 왕잠자리', group: 'bug', tier: 'mythic', limb: 'one front leg',
    move: 'zipping forward to the right faster than the eye with its four wings blurred, leaving shimmering amber afterimages',
    base: 'an ancient giant dragonfly from the time of the dinosaurs (meganeura), a mythic spirit of time: a slim jewel-like body glowing amber and emerald, FOUR long clear wings with golden veins like stained glass (always four wings), big round glossy eyes like shiny green gems with white highlights, pink blush, a gentle smile, small glowing amber orbs floating around it as if it came out of a drop of amber. It must look different from the butterfly 팔랑, the hummingbird 윙윙 and the azure dragon 청룡: an insect with four long clear wings, no fur, no feathers, no dragon body',
    egg: 'a large glowing golden-amber egg like a drop of tree amber with a tiny fern fossil shape inside, resting on a small floating stone with ancient spiral patterns', f: {
      1: 'baby stage: a tiny round baby dragonfly with four small clear wings sitting on a glowing amber stone, no other accessories',
      2: 'grown stage: a longer young dragonfly hovering with four clear wings (NOT a round baby), its body glowing amber and emerald, a small emerald ribbon with a gold star charm, a few amber orbs floating around it',
      3: 'final stage: a majestic ancient dragonfly spirit hovering above a ring of floating amber stones, four huge stained-glass wings with golden veins, its long body shimmering amber, emerald and gold, a small golden crown with an amber gem, glowing spiral fossil shapes in the air, prismatic sparkles (NOT a round baby; graceful and friendly)' } },
  mantis: { series: 55, ko: '합격이', type: '사마귀', group: 'bug', tier: 'limited', limb: 'both folded front arms',
    move: 'leaping forward to the right and chopping with both rounded front arms like a karate move, little four-leaf clovers flying',
    base: 'a cute little praying mantis with a soft leaf-green body, a big triangle head with huge round glossy eyes, pink blush, two soft rounded front arms always folded together like praying for good luck (no spikes), thin short legs; a funny exam-luck mascot. It must look different from the monster 클립 메뚜기 (no paper clip, folded praying arms) and the chameleon 카멜',
    egg: 'a pale green egg with a small four-leaf-clover pattern, resting on a little stack of two tiny books (no letters)', f: {
      1: 'baby stage: a tiny round baby mantis sitting with its tiny arms pressed together in a wish, a tiny four-leaf clover beside it, no other accessories',
      2: 'grown stage: a young mantis standing upright (NOT a round baby), arms folded in a wish, a plain white headband (no letters), a mint scarf with a small gold star charm',
      3: 'final stage: a proud lucky-charm mantis master standing on a stack of books (no letters), holding a small golden lucky pouch between its praying arms (no letters), a white headband with a small gold star, a flowing green cape with gold trim fastened by a gold star clasp, floating four-leaf clovers and golden sparkles (NOT a round baby)' } },
  pachy: { series: 55, ko: '짱돌', type: '파키케팔로사우루스', group: 'dino', tier: 'limited', limb: 'one short arm',
    move: 'running forward to the right head first and head-butting with its shiny dome, cartoon stars and a big bonk burst',
    base: 'a funny chubby baby pachycephalosaurus with soft sky-blue skin, a cream belly, a very big round shiny dome head like a polished stone with small rounded bumps around its rim, big glossy eyes, pink blush, a goofy confident grin, short arms and strong legs; a funny head-butting mascot. It must look different from the triceratops 뿔뿔 (no frill, no horns) and the T-rex 쿵쾅 (a big round dome head)',
    egg: 'a sky-blue egg with a big smooth round dome on top like a helmet, resting on a pile of small round pebbles', f: {
      1: 'baby stage: a tiny round baby with a small shiny dome head, bumping a tiny pebble with its head, no other accessories',
      2: 'grown stage: a sturdy young pachycephalosaurus standing on two legs (NOT a round baby), its dome head shining, a small bandage plaster on its dome, a mint scarf with a small gold star charm',
      3: 'final stage: a proud head-butt champion standing on a big round boulder, its dome head polished to a golden shine, a golden champion belt (no letters), a flowing sky-blue cape with gold trim fastened by a gold star clasp, little cartoon stars and golden sparkles (NOT a round baby)' } }
};
// 알 반응 · 전투 자세는 두 펫씩 한 시트.
export const PAIRS_54 = { 54: [['ladybug', 'ant'], ['triceratops', 'brachio'], ['beetle', 'butterfly'], ['stego', 'ptero']], 55: [['trex', 'meganeura'], ['mantis', 'pachy']] };
export const MYTHIC_54 = 'meganeura';
const pet = key => PETS_54[key];
const TIER_KO = { basic: '일반', epic: '영웅', legendary: '전설', mythic: '신화', limited: '특이' };
const GROUP_KO = { bug: '곤충', dino: '공룡' };

const FORM_KO = { 1: '아기', 2: '성장', 3: '최종' };
const CELLS = ['TOP-LEFT', 'TOP-RIGHT', 'BOTTOM-LEFT', 'BOTTOM-RIGHT'];
const CELL_KO = ['왼쪽 위', '오른쪽 위', '왼쪽 아래', '오른쪽 아래'];
const EXPRS = [
  ['happy', '기뻐함', 'HAPPY: eyes closed in a big happy smile, rosy cheeks, two or three small pink hearts floating above the head'],
  ['eat', '냠냠', 'EATING: happily eating from a small round mint food bowl in front of it, cheeks puffed, a few crumbs, eyes curved in joy'],
  ['sad', '시무룩', 'SAD: slightly sad pouty face with teary sparkling eyes, antennae, wings, crest or tail drooping a little, still cute (not crying hard); keep the same face, markings and items as the other cells'],
  ['cheer', '응원', 'CHEERING: energetic pose with one front leg, arm, wing or foot raised high, determined sparkling eyes, small motion sparkles']
];
const EGG_HAPPY = 'PETTED (기뻐함): the egg tilts to one side as if wiggling happily, two short curved motion lines on each side, three small pink hearts floating above. Do NOT crack the egg and do NOT give it a face.';
const EGG_WARM = 'WARMED (따뜻해짐): the egg glows with a soft warm orange-golden aura, three small wavy heat lines rising above it, a few tiny golden sparkles. Do NOT crack the egg, do NOT give it a face, no fire.';
const HURT_X = 'HURT: flinching from a hit that comes from the right: eyes squeezed shut, the body leaning back and to the left, antennae, wings, crest or tail flung back, two or three small impact stars and one sweat drop beside the head; still cute (NOT injured: no blood, no tears streaming, no wounds)';
const STAGE = 'IMPORTANT: draw this exact growth stage in every cell, with its full body size, proportions and accessories. Do not draw the younger baby version, and do not make it rounder, shorter or chubbier when it sits, eats or is sad.';
const REVEAL = 'REVEAL POSE: the pet in its FINAL stage in a dramatic heroic pose, front 3/4 view, drawn larger and more detailed than usual, filling about 92% of the cell height.';
const REVEAL_POSES = [
  'rising toward the viewer with its four stained-glass wings spread to their full width, a ring of glowing amber stones circling it',
  'hovering in front of a huge glowing drop of amber, wings shimmering, golden fossil spirals swirling around it',
  'perched proudly on a giant fern leaf with its four wings half open, light rays bursting behind it',
  'diving in a graceful curve with long amber light trails behind its wings, prismatic sparkles everywhere'
];
// 등장 배경: 세로 한 장(1024×1536, 투명 아님). 펫은 앱이 그 위에 올린다(38e와 같은 방식).
const BGT = 'Create ONE tall portrait image, 1024×1536 pixels: a full-screen 2D REVEAL BACKGROUND for a cute premium mobile pet game (players are high-school students), shown on a phone in portrait when a MYTHIC pet appears. Paint it fully to every edge (no transparency, no border, no frame, no rounded corners). NO characters, NO animals, NO creatures, NO insects, NO dinosaurs, NO people. No text, no letters, no numbers, no logos, no UI, no watermark. Do not ask me any questions; just generate the image.';
const BG_STYLE = 'Style: the same premium cute 3D-painted anime game art as the pets of this game: clear soft colors (not washed out, not hazy), clean shapes, soft cel-like shading, gentle rim light, friendly and inviting.';
const BG_REF = `STYLE REFERENCE — before drawing, open the pets of this game in the Google Drive folder "${PET_SPRITES}" (MONG, NABI, PINKY and BAMBOO, 03_final.png) and the mythic reveal backgrounds already in the game, "19e-2.png" and "19e-4.png" in the Google Drive folder "SUMUS 신화 펫 19 (Runner용)". The new background must look like it belongs in the same set as those backgrounds (same rendering quality, composition and color richness), and the pets must stand out clearly in front of it. ${KEEP} Do NOT draw any characters.`;
const BGT_LAYOUT = 'COMPOSITION (important, the game puts its own pet, light effects and a title on top): epic scale and a strong sense of awe. A bright glowing focal point sits at the CENTER, slightly below the middle, where the pet will appear (the area around it is open, soft and uncluttered, about 60% of the width and 45% of the height). The TOP 20% stays calm and simple (a title goes there). Put the rich details, depth and scenery around the outer edges and far away. Light rays and floating elements point toward the center. A gentle vignette toward the edges.';
const SCENE = 'a golden ancient forest of the dinosaur age at dawn: giant ferns and cycad trees framing the edges, huge drops of glowing amber hanging from the branches like lanterns, a misty distant volcano (no fire, just a soft glow) and fern-covered cliffs far away, faintly glowing spiral fossil shapes (ammonites) floating in the air, golden light rays, a bright amber-golden glow at the center.';

const ORDER = Object.keys(PETS_54);
const sheetOf = key => { const s = pet(key).series; return `${s}a-${ORDER.filter(k => pet(k).series === s).indexOf(key) + 1}`; };
const designRef = (series, keys) => `CHARACTER REFERENCE — before drawing, open ${keys.map(k => `"${sheetOf(k)}.png"`).join(' and ')} (the design sheet${keys.length > 1 ? 's' : ''}: egg, baby, grown, final) in the Google Drive folder "${DRIVE_54[series]}"`;
const subjectOf = p => `${p.base}. ${GROUP[p.group]}`;

export function sheets54() {
  const out = [], count = {};
  const add = (series, part, title, lines, cells, opt = {}) => {
    const s = `${series}${part}`, name = `${s}-${(count[s] = (count[s] || 0) + 1)}`;
    const text = [...lines.filter(Boolean),
      opt.bg ? `WHEN DONE — upload the finished PNG (1024×1536, fully painted, not transparent) to Google Drive, into the folder "${DRIVE_54[series]}", named exactly "${name}.png" (if a file with that name is already there, replace it; if the folder does not exist, create it). Actually save the file to Google Drive; showing the picture in the chat is not enough.`
        : `WHEN DONE — upload the finished transparent PNG to Google Drive, into the folder "${DRIVE_54[series]}", named exactly "${name}.png" (if a file with that name is already there, replace it; if the folder does not exist, create it). Actually save the file to Google Drive; showing the picture in the chat is not enough.`].join('\n');
    out.push({ series, file: FILES_54[s], name, title, text, cells: cells.map((c, i) => ({ cell: opt.bg ? '전체' : CELL_KO[i], key: c[0], name: c[1], out: c[3] })) });
  };
  const cellLines = cells => cells.map((c, i) => `${CELLS[i]} cell: ${c[2]}`);
  for (const series of [54, 55]) {
    const keys = ORDER.filter(k => pet(k).series === series);
    // a: 설정 시트(알 · 아기 · 성장 · 최종)
    for (const key of keys) {
      const p = pet(key);
      const cells = [
        [`${key}-0`, `${p.ko} 알`, `EGG: ${p.egg}. Just the egg, no creature`, `public/assets/pets/${key}-0.webp`],
        [`${key}-1`, `${p.ko} 아기`, `BABY: the ${p.f[1]}, happy calm face, front 3/4 view`, `public/assets/pets/${key}-1.webp`],
        [`${key}-2`, `${p.ko} 성장`, `GROWN: the ${p.f[2]}, happy calm face, front 3/4 view`, `public/assets/pets/${key}-2.webp`],
        [`${key}-3`, `${p.ko} 최종`, `FINAL: the ${p.f[3]}, happy calm face, front 3/4 view`, `public/assets/pets/${key}-3.webp`]
      ];
      add(series, 'a', `${p.ko} ${p.type} 설정 시트`, [SHEET, STYLE.pet, STYLE_REF, TIER_REF[p.tier],
        `Subject: ${p.ko}, ${subjectOf(p)} ${['legendary', 'mythic'].includes(p.tier) ? '' : MOOD}${TIER_D[p.tier]}Draw the same character at four growth steps; each cell must clearly be the same creature, getting bigger and grander.`, ...cellLines(cells)], cells);
    }
    // b: 표정(단계마다 4) + 알 반응(두 펫씩)
    for (const key of keys) for (const form of [1, 2, 3]) {
      const p = pet(key);
      const cells = EXPRS.map(([e, ko, text]) => [`${key}-${form}-${e}`, `${p.ko} ${FORM_KO[form]} ${ko}`, text, `public/assets/pets/${key}-${form}-${e}.webp`]);
      add(series, 'b', `${p.ko} ${FORM_KO[form]} 표정`, [SHEET, STYLE.pet, STYLE_REF,
        `${designRef(series, [key])} and match this pet's face, colors, markings, accessories and the body size of this growth stage exactly (baby = top-right cell, grown = bottom-left cell, final = bottom-right cell). ${KEEP}`,
        `Subject: ${p.ko}, ${subjectOf(p)} This is the ${p.f[form]}. In every cell that says a leg, arm, wing or foot is raised, this pet raises ${p.limb} instead.${TIER_X[p.tier]}`, form > 1 ? STAGE : '', ...cellLines(cells)], cells);
    }
    for (const [a, b] of PAIRS_54[series]) {
      const pa = pet(a), pb = pet(b);
      const cells = [[`${a}-0-happy`, `${pa.ko} 알 기뻐함`, EGG_HAPPY, `public/assets/pets/${a}-0-happy.webp`], [`${a}-0-eat`, `${pa.ko} 알 따뜻해짐`, EGG_WARM, `public/assets/pets/${a}-0-eat.webp`],
        [`${b}-0-happy`, `${pb.ko} 알 기뻐함`, EGG_HAPPY, `public/assets/pets/${b}-0-happy.webp`], [`${b}-0-eat`, `${pb.ko} 알 따뜻해짐`, EGG_WARM, `public/assets/pets/${b}-0-eat.webp`]];
      add(series, 'b', `${pa.ko} · ${pb.ko} 알 반응`, [SHEET, STYLE.egg, STYLE_REF, `${designRef(series, [a, b])} and match each egg (the top-left cell of each design sheet) exactly. ${KEEP}`,
        `Subject: two pet eggs (the reference pictures show them). The TOP row cells show ${pa.ko}'s egg: ${pa.egg}. The BOTTOM row cells show ${pb.ko}'s egg: ${pb.egg}.`, ...cellLines(cells)], cells);
    }
    // c: 야차전 · 던전 공격 · 맞음(두 펫씩, 단계마다)
    for (const [a, b] of PAIRS_54[series]) for (const form of [1, 2, 3]) {
      const pa = pet(a), pb = pet(b);
      const cells = [a, b].flatMap(key => [
        [`${key}-${form}-attack`, `${pet(key).ko} ${FORM_KO[form]} 공격`, `ATTACK: ${pet(key).ko} in a dynamic attack pose: ${pet(key).move}; the body stretched forward, a determined sparkling expression, motion lines behind it; still cute`, `public/assets/pets/${key}-${form}-attack.webp`],
        [`${key}-${form}-hurt`, `${pet(key).ko} ${FORM_KO[form]} 맞음`, HURT_X, `public/assets/pets/${key}-${form}-hurt.webp`]]);
      add(series, 'c', `${pa.ko} · ${pb.ko} ${FORM_KO[form]} 공격·맞음`, [SHEET, STYLE.pet, STYLE_REF,
        `${designRef(series, [a, b])}. Draw the growth step named in the Subject (baby = top-right cell, grown = bottom-left cell, final = bottom-right cell of each design sheet) and keep each pet's face, colors, markings, size and accessories exactly; only the pose changes. Also open "24c-1.png" in the Google Drive folder "SUMUS 새 펫 24 (Runner용)" and "20-1.png" in the Google Drive folder "SUMUS 전투 자세 20 (Runner용)" (attack and hurt poses already made for other pets) and match how strong and how cute those poses are.`,
        `Subject: two different pets of the same growth step (the reference pictures show each one). TOP row: ${pa.ko}, ${subjectOf(pa)} This is the ${pa.f[form]}. BOTTOM row: ${pb.ko}, ${subjectOf(pb)} This is the ${pb.f[form]}. Each pet keeps exactly the design, size and accessories of its reference picture of this growth step; only the pose changes. LEFT cell of each row: ATTACK, RIGHT cell: HURT.`, ...cellLines(cells)], cells);
    }
  }
  // 55d: 신화 등장 포즈(왼쪽 위) + 다른 포즈 여분 3칸(가장 좋은 것을 골라 왼쪽 위 이름으로 넣는다).
  {
    const k = MYTHIC_54, p = pet(k);
    const cells = REVEAL_POSES.map((pose, i) => [i ? `${k}-reveal-alt${i}` : `${k}-reveal`, i ? `${p.ko} 등장 포즈 (여분 ${i}, 고르기용)` : `${p.ko} 등장 포즈`, `${p.ko} (${p.type}), FINAL stage: ${REVEAL} ${pose}`, i ? `(여분: 왼쪽 위보다 나으면 이 칸을 pets/${k}-reveal로 넣는다)` : `public/assets/pets/${k}-reveal.webp`]);
    add(55, 'd', `${p.ko} 등장 포즈`, [SHEET, STYLE.pet, STYLE_REF,
      `${designRef(55, [k])}. The pet in this sheet is the FINAL stage (the bottom-right cell) of its design sheet: keep its face, colors, markings, accessories and proportions exactly (always four wings), only change the pose. Also open "19d-1.png" in the Google Drive folder "SUMUS 신화 펫 19 (Runner용)" (the reveal poses of the other mythic pets) and match their size in the cell, drama and level of detail. ${KEEP}`,
      `Subject: four pose options of ONE mythic pet, ${p.ko}, ${subjectOf(p)} TOP-LEFT is the main reveal pose; the other three cells are other options of the same pet.`, ...cellLines(cells)], cells);
  }
  // 55e: 신화 등장 배경(세로)
  add(55, 'e', `${pet(MYTHIC_54).ko} 등장 배경`, [BGT, BG_STYLE, BG_REF, `Scene: ${SCENE}`, BGT_LAYOUT],
    [[`bg-${MYTHIC_54}`, `${pet(MYTHIC_54).ko} 등장 배경`, '', `public/assets/reveal/bg-${MYTHIC_54}.webp`]], { bg: true });
  return out;
}

// Codex 작업 지시(CODEX_PROMPT_54 · 55.md): 표와 자르기 명령은 위 시트 목록에서 만든다.
const TITLE_54 = { 54: '곤충 · 공룡 펫 1차 8종(일반 4 · 영웅 4)', 55: '곤충 · 공룡 펫 2차 4종(전설 1 · 신화 1 · 특이 2)' };
// Codex가 붙일 참고 그림(저장소 public/assets/ 아래, 이미 있는 그림만). 등급마다.
export const REPO_REF = {
  basic: ['pets/panda-3.webp', 'pets/mouse-2.webp', 'pets/elephant-2.webp'],
  epic: ['pets/panda-3.webp', 'pets/flamingo-3.webp', 'pets/quokka-2.webp'],
  legendary: ['pets/panda-3.webp', 'pets/haechi-3.webp', 'pets/whale-3.webp'],
  mythic: ['pets/panda-3.webp', 'pets/cheongryong-3.webp', 'pets/jujak-3.webp'],
  limited: ['pets/panda-3.webp', 'pets/tissue-2.webp', 'pets/glue-2.webp']
};
const POSE_REF = ['pets/elephant-2-attack.webp', 'pets/elephant-2-hurt.webp'];
const REVEAL_REF = { pose: 'pets/cheongryong-reveal.webp', bg: ['reveal/bg-cheongryong.webp', 'reveal/bg-jujak.webp'] };
const code = s => `\`${s}\``;
export function codexPrompt(series, list = sheets54()) {
  const l = list.filter(s => s.series === series), keys = ORDER.filter(k => pet(k).series === series), R = 'docs/asset-requests/runner';
  const of = (part, key) => l.filter(s => s.file === FILES_54[`${series}${part}`] && s.cells.some(c => c.key.startsWith(`${key}-`))).map(s => s.name);
  const range = names => names.length > 1 ? `${names[0]}~${names.at(-1).split('-')[1]}` : names[0] || '-';
  const names = keys.map(k => `${pet(k).ko}(${pet(k).type})`).join(' · ');
  const parts = [...new Set(l.map(s => s.file.slice(0, 3)))];
  const tiers = [...new Set(keys.map(k => pet(k).tier))];
  const cmd = s => {
    if (s.file.endsWith('reveal-scene.txt')) return `# ${s.name}: 1024×1536 PNG → 720×1080 webp(150KB 이하): ${s.cells[0].out}`;
    const outs = s.cells.map(c => c.out.startsWith('public/assets/') ? c.out.replace('public/assets/', '').replace(/\.webp$/, '') : '-');
    if (/design\.txt$/.test(s.file)) return `node $R/fit-assets.mjs /tmp/art/${s.name}.png ${outs.join(' ')} --stand --preview /tmp/review/${s.name}.png`;
    if (/reveal-poses\.txt$/.test(s.file)) return `node $R/fit-assets.mjs /tmp/art/${s.name}.png ${outs.join(' ')} --fit-each --size 1024 --preview /tmp/review/${s.name}.png   # 여분 칸(-)이 더 나으면 그 칸을 pets/${MYTHIC_54}-reveal로`;
    return `node $R/fit-sheets.mjs /tmp/art/${s.name}.png ${outs.map(o => o.replace(/^pets\//, '')).join(' ')} --preview /tmp/review/${s.name}.png`;
  };
  const perPet = '기본 4 + 표정 12 + 알 반응 2 + 전투 6 + 작은 그림 4 = 28개';
  return `# Codex 작업 지시: 그림 ${series} (${TITLE_54[series]}: ${names})

## 목표
SUMUS VOCA(저장소 \`minsik2e5/sumus-quiz-battle\`)의 그림 주문서 ${series}로 곤충 · 공룡 새 펫 그림(설정 · 표정 · 알 반응 · 야차전 공격/맞음${series === 55 ? ' · 신화 등장 포즈 · 등장 배경' : ''})을 만들고, 잘라서 \`public/assets/\`에 넣은 뒤 PR을 만든다.
**그림 파일만 넣는다. 앱 코드는 고치지 않는다.** 이 펫들은 아직 \`public/modules/core.js\`(CHARACTERS)에 **등록되지 않았다.** 그림 PR이 머지되어도 학생에게는 나오지 않고, 그림이 다 온 뒤 다음 코드 세션에서 등록 · 특기 · 알 연결을 한다(구성안 \`docs/pets-bug-dino-design.md\`). 그래서 파일 이름(펫 key)을 **정확히** 지켜야 한다.

| 등급 | 묶음 | 펫 key | 이름(안) | 설정 시트 | 표정 시트 | 알 반응 | 전투 자세 |
|---|---|---|---|---|---|---|---|
${keys.map(k => `| ${TIER_KO[pet(k).tier]} | ${GROUP_KO[pet(k).group]} | \`${k}\` | ${pet(k).ko} · ${pet(k).type} | ${range(of('a', k))} | ${range(of('b', k).filter(n => !l.find(s => s.name === n).title.includes('알 반응')))} | ${range(of('b', k).filter(n => l.find(s => s.name === n).title.includes('알 반응')))} | ${range(of('c', k))} |`).join('\n')}

- 시트는 모두 **${l.length}장**(${parts.map(p => `${p} ${l.filter(s => s.file.startsWith(p)).length}`).join(' · ')}).
- 한 펫의 그림 = ${perPet}${series === 55 ? `. 신화 ${pet(MYTHIC_54).ko}는 여기에 등장 포즈 1 + 등장 배경 1` : ''}.
- 앱은 이 파일 이름을 그대로 읽는다(\`<key>-<단계>.webp\`, \`<key>-<단계>-<표정>.webp\`, \`<key>-<단계>-attack.webp\`${series === 55 ? ', `<key>-reveal.webp`, `reveal/bg-<key>.webp`' : ''}). 이름이 다르면 그 펫은 나오지 않는다.
${series === 55 ? `- \`55d-1\`은 ${pet(MYTHIC_54).ko}의 등장 포즈 네 가지다. 왼쪽 위가 기본이고, 다른 칸이 더 나으면 그 칸을 \`pets/${MYTHIC_54}-reveal\`로 넣는다.\n` : ''}
## 그림체 (중요)
- **기존 펫과 똑같은 그림체**(3D 페인팅, 반짝이는 큰 눈, 볼터치, 금빛 테두리 빛). 곤충 · 공룡도 다른 펫과 한 가족처럼 보여야 한다.
- 곤충은 **징그럽지 않게**(동글동글한 몸, 짧은 다리 6개, 털 · 집게 · 뾰족한 부분 없음). 공룡은 **무섭지 않게**(뿔 · 가시는 둥글게), **용처럼 보이지 않게**(불 · 깃털 날개 · 갈기 없음).
- ${series === 54 ? '영웅 펫은 일반 펫보다 성장 · 최종이 조금 더 화려하다.' : `전설 ${pet('trex').ko}: 해치 · 별고래처럼 금빛 오라. 신화 ${pet(MYTHIC_54).ko}: 청룡 · 주작만큼 웅장하게(무지개빛 금 테두리 빛). 특이 ${pet('mantis').ko} · ${pet('pachy').ko}: 술술이 · 찰싹이처럼 웃긴 마스코트 느낌.`}
- **만화 · 애니 캐릭터(포켓몬, 공룡 · 곤충 만화 등)를 따라 그리거나 닮게 그리지 않는다.** 모두 새 캐릭터다.
- 기존 펫 · 몬스터와 헷갈리지 않게 각 주문서의 "must look different" 문장을 지킨다.

## 꼭 지킬 것
- 브랜치는 \`sumus-voca-prod-deploy\`에서 새로 만든다. 예: \`codex/art-${series}\`
  - 그 브랜치에 \`${R}/${FILES_54[`${series}a`]}\`가 없으면 주문서 PR이 아직 머지되지 않은 것이다. 그때는 \`claude/pets-bug-dino-plan\`에서 시작한다.
- **PR까지만 만든다. 머지하지 않는다.** 머지하면 운영에 바로 배포된다.
- **운영 Supabase에 연결하지 않는다.**
- **Google Drive는 쓰지 않는다. 멈추지 않는다.** 그림은 **Codex에 내장된 그림 생성 기능**으로 만든다. OpenAI API 키(\`OPENAI_API_KEY\`)나 유료 API를 쓰지 않는다. 키가 없다고 멈추지 않는다.
- \`public/assets/\` 아래 새 그림, \`${R}/DONE_${series}.md\`, 빌드가 바꾸는 \`public/sw.js\` · \`public/modules/pet-art.js\` 말고는 고치지 않는다. 앱 코드(core.js 포함), 게임 규칙, 코인, 확률, 서버 로직, 점검 파일은 건드리지 않는다.
- 원본 시트 PNG는 커밋하지 않는다. 임시 폴더(\`/tmp/art/\`)에 둔다. 미리보기(\`/tmp/review/\`)도 커밋하지 않는다.
- 기존 그림 파일은 지우거나 덮어쓰지 않는다. **새 파일만 추가**한다.

## 입력 (저장소 안, \`${R}/\`)
- \`split/\` 폴더: 시트 하나 = 프롬프트 하나. 파일 이름이 시트 번호다(예: \`split/${l[0].name} ${l[0].title}.txt\`).
- \`slice-map.csv\`: 각 칸의 이름(\`key\`)과 앱 파일(\`app_file\`). \`list\` 열이 \`${parts.join('…`·`')}…\`인 줄만 본다. 칸 순서는 왼쪽 위 → 오른쪽 위 → 왼쪽 아래 → 오른쪽 아래.
- 자르기 도구: \`fit-assets.mjs\`, \`fit-sheets.mjs\`(사용법은 파일 맨 위 주석). \`sharp\`가 없으면 \`npm i --no-save sharp\`.

### 프롬프트 손보기 (Drive 대신 저장소 그림을 참고 그림으로 첨부)
주문서는 그림 GPT가 Google Drive를 여는 방식으로 쓰여 있다(Drive의 기존 펫 그림을 열어 그림체를 맞추고, 정해진 Drive 폴더 "${DRIVE_54[series]}"에 정확한 파일 이름으로 저장). Codex는 Drive를 쓰지 않으니 보내기 전에 이렇게 바꾼다.
1. 다음으로 **시작하는 줄을 지운다**: \`STYLE REFERENCE\`, \`CHARACTER REFERENCE\`, \`Also open\`, \`WHEN DONE\`
2. 아래 표의 참고 그림(저장소 파일)을 같이 보여 주고, 프롬프트 **세 번째 줄**에 이 문장을 넣는다:
   \`REFERENCE IMAGES ARE ATTACHED: match their art style, rendering quality, crisp clean edges and colors exactly. If a reference shows this same character, keep its face, colors, markings and accessories exactly. Do NOT copy any other animal or character from the references, and do NOT copy or resemble any cartoon or anime character.\`

### 참고 그림 (\`public/assets/\` 아래 경로)
| 시트 | 참고 그림 |
|---|---|
${tiers.map(t => `| ${series}a 설정 · ${TIER_KO[t]} | ${REPO_REF[t].map(code).join(', ')} |`).join('\n')}
| ${series}b 표정 | 그 펫 · 단계의 새 그림 \`pets/<키>-<단계>.webp\` (예: ${l.find(s => s.file.endsWith('expressions.txt')).name} → \`pets/${keys[0]}-1.webp\`) |
| ${series}b 알 반응 | 두 펫의 \`pets/<키>-0.webp\` |
| ${series}c 전투 자세 | 두 펫의 그 단계 새 그림 + 기존 자세 ${POSE_REF.map(code).join(', ')} |
${series === 55 ? `| 55d 등장 포즈 | 새 \`pets/${MYTHIC_54}-3.webp\` + 기존 ${code(REVEAL_REF.pose)} |\n| 55e 등장 배경 | 기존 ${REVEAL_REF.bg.map(code).join(', ')} |\n` : ''}
### 후보 점검 (모두 통과해야 쓴다)
1. 배경이 진짜 투명이다(네 모서리 alpha 0, 체크무늬 · 흰 상자 · 흰 테두리 없음).${series === 55 ? ' 등장 배경(55e)만 투명이 아니고 가장자리까지 꽉 채운다.' : ''}
2. 칸마다 그림이 하나씩 따로 있고, 겹치거나 잘리지 않았다. 글자, 숫자, 테두리, 바닥 그림자가 없다.
3. 같은 시트의 칸들은 같은 캐릭터 디자인이다(색, 무늬, 소품).
4. 설정 시트는 알 → 아기 → 성장 → 최종으로 분명히 커지고 화려해진다. 알에는 얼굴이 없다. 표정 · 전투 자세는 같은 단계의 몸 크기와 소품이 설정 시트와 같다. 공격은 오른쪽으로 달려들고, 맞음은 오른쪽에서 맞아 왼쪽으로 몸을 젖힌다(피 · 상처 없이 귀엽게). 곤충은 징그럽지 않고 공룡은 무섭지 않다.${series === 55 ? ` ${pet(MYTHIC_54).ko}(고대 왕잠자리)는 모든 그림에서 날개가 4장이다.` : ''}

이미지를 볼 수 있으면 4번은 눈으로 확인한다. 볼 수 없으면 1~3번만 확인하고 PR에 "눈으로 확인 필요"라고 적는다.

## 1. 그림 만들기
- **Codex의 내장 그림 생성 기능**으로 시트를 하나씩 만든다. API를 직접 부르지 않는다.
- 2×2 시트: 1024×1024, **투명 배경 PNG**.${series === 55 ? ' 등장 배경: 1024×1536, 투명 아님.' : ''} 만든 그림은 \`/tmp/art/<시트 번호>.png\`로 저장한다(예: \`/tmp/art/${l[0].name}.png\`).
- 점검을 통과하지 못하면 같은 프롬프트로 다시 만든다. 시트마다 최대 4번이다.
- **순서를 지킨다.** 설정 시트(\`${series}a\`)를 먼저 만들고 잘라 넣은 뒤, 그 그림을 참고로 표정 · 알 반응 · 전투 자세를 만든다. 순서: ${parts.join(' → ')}.
- 한 번에 다 못 만들면 **펫 하나를 끝까지**(설정 · 표정 · 알 반응 · 전투) 만든 단위로 끊는다. 못 만든 시트는 \`DONE_${series}.md\`의 "넣지 못한 그림"에 적는다.

## 2. 자르고 넣기
\`\`\`
R=${R}
${l.map(cmd).join('\n')}
\`\`\`
- **작은 그림**: 기본 그림(\`<키>-<단계>.webp\`, 단계 0~3)마다 \`<키>-<단계>-s.webp\`(160×160, 투명, \`fit: 'contain'\`)도 만든다. ${keys.length}종 × 4 = ${keys.length * 4}개. 이게 없으면 그 펫은 나중에 등록해도 앱에 나오지 않는다.
${series === 55 ? `- **등장 배경(55e)**: 고른 PNG를 \`sharp(src).resize(720, 1080, { fit: 'cover' }).webp({ quality: 80, effort: 6 })\`로 줄여 \`public/assets/reveal/bg-${MYTHIC_54}.webp\`로 저장한다. 등장 포즈와 등장 배경이 없으면 신화 펫은 나오지 않는다.\n` : ''}- 도구가 "배경이 투명하지 않아요"나 "칸이 비어 있어요"로 멈추면 그 시트는 1단계로 돌아가 다시 만든다.

## 3. 기록
- \`${R}/DONE_${series}.md\`를 한국어로 쓴다: 펫별 넣은 그림 표, 넣지 못한 그림과 이유, 시트마다 다시 만든 횟수, "눈으로 확인 필요" 항목, **빌드 뒤 \`pet-art.js\`의 PET_ART에 들어간 새 키**(core.js에 등록되기 전이라 아직 학생에게는 안 나온다).
- 버전은 올리지 않는다.

## 4. 점검
\`\`\`
npm ci
npm run build:assets      # public/modules/pet-art.js가 바뀐다(그림이 다 들어온 키가 PET_ART에 들어간다)
npm run check             # release-check 전부 PASS
npm run check:cloudflare
\`\`\`
- 점검이 실패하면 점검 파일을 고치지 말고 PR에 실패 메시지를 그대로 적는다.
- 기존 그림의 \`D\`(삭제) · \`M\`(수정)이 없어야 한다: \`git diff --name-status origin/sumus-voca-prod-deploy -- public/assets\`

## 5. PR
- 대상: \`sumus-voca-prod-deploy\`
- 제목: \`그림 ${series}: ${TITLE_54[series]}\`
- 본문은 한국어로 쓴다. 넣은 그림 표, 넣지 못한 그림과 이유, 점검 결과, "눈으로 확인 필요" 항목.
- 마지막 줄: \`> ⚠️ 그림만 들어갑니다. 펫 등록(core.js) · 특기 · 알 연결은 다음 코드 세션에서 합니다.\`
- 미리보기 그림(\`/tmp/review/*.png\`)을 한 장으로 합쳐 PR 코멘트로 올린다.
- **머지하지 않는다.**
`;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const list = sheets54();
  // Codex 참고 그림은 저장소에 이미 있어야 한다.
  const assets = resolve(here, '../../../public/assets');
  const refs = [...Object.values(REPO_REF).flat(), ...POSE_REF, REVEAL_REF.pose, ...REVEAL_REF.bg];
  const missing = refs.filter(f => !existsSync(resolve(assets, f)));
  if (missing.length) throw new Error(`참고 그림이 저장소에 없어요: ${missing.join(', ')}`);
  // 새 키가 기존 펫 그림과 겹치면 안 된다.
  const taken = new Set(readdirSync(resolve(assets, 'pets')).map(f => f.split('-')[0]));
  const clash = ORDER.filter(k => taken.has(k));
  if (clash.length) throw new Error(`이미 그림이 있는 키예요: ${clash.join(', ')}`);
  for (const file of Object.values(FILES_54)) writeFileSync(resolve(here, file), list.filter(s => s.file === file).map(s => s.text).join('\n---\n') + '\n');
  const split = resolve(here, 'split');
  mkdirSync(split, { recursive: true });
  for (const f of readdirSync(split)) if (/^5[45][a-e]-\d+ /.test(f)) unlinkSync(resolve(split, f));
  for (const s of list) writeFileSync(resolve(split, `${s.name} ${s.title.replace(/[\\/:*?"<>|()]/g, '').replace(/\s+/g, ' ').trim()}.txt`), s.text + '\n');
  // slice-map.csv: 54 · 55 줄이 있으면 같은 자리 · 같은 첫 번호로 바꿔 쓰고, 없으면 뒤에 붙인다(번호는 앞의 마지막 번호 다음부터).
  const mapPath = resolve(here, 'slice-map.csv');
  const all = readFileSync(mapPath, 'utf8').replace(/\n+$/, '').split('\n');
  const mine = r => /^"5[45][a-e]-/.test(r);
  const at = all.findIndex(mine), rows = all.filter(r => !mine(r));
  let no = at >= 0 ? Number(all[at].split(',')[1].replace(/"/g, '')) - 1 : Math.max(...rows.slice(1).map(r => Number(r.split(',')[1]?.replace(/"/g, '')) || 0));
  const csv = v => `"${String(v).replace(/"/g, '""')}"`;
  const added = [];
  for (const s of list) { no++; for (const c of s.cells) added.push([s.file, String(no).padStart(3, '0'), s.title, c.cell, c.key, c.name, c.out].map(csv).join(',')); }
  rows.splice(at >= 0 ? at : rows.length, 0, ...added);
  writeFileSync(mapPath, rows.join('\n') + '\n');
  for (const series of [54, 55]) writeFileSync(resolve(here, `CODEX_PROMPT_${series}.md`), codexPrompt(series, list));
  for (const series of [54, 55]) {
    const l = list.filter(s => s.series === series);
    console.log(`${series}: ${l.length}시트 · 그림 ${l.reduce((n, s) => n + s.cells.length, 0)}칸 (${[...new Set(l.map(s => s.file))].map(f => `${f.slice(0, 3)} ${l.filter(s => s.file === f).length}`).join(' · ')})`);
  }
}
