// 그림 주문서 36 · 37 · 38: 새 펫 14종(V13.168). 36 = 12지 기본 6, 37 = 영웅 6, 38 = 신화 2.
//   node docs/asset-requests/runner/build-36.mjs
// 펫 이름 · 종류 · 등급은 public/modules/core.js(CHARACTERS)에서 읽는다. 여기에는 생김새(영어)만 둔다.
// 만드는 것: 36a~38e 주문서(.txt), split/ 시트별 파일, slice-map.csv의 36~38 줄(있으면 바꿔 쓴다).
// (build-runner.mjs는 26번 이후를 모르므로 돌리지 않는다: slice-map.csv 뒤쪽이 지워진다.)
// 그림이 들어오면 앱은 자동으로 이 펫들을 알 · 선물 · 사냥 · 도감에 낸다(build:assets → public/modules/pet-art.js → core.js petReady).
import { readFileSync, writeFileSync, mkdirSync, readdirSync, unlinkSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { CHARACTERS } from '../../../public/modules/core.js';

const here = dirname(fileURLToPath(import.meta.url));
export const DRIVE_36 = { 36: 'SUMUS 새 펫 36 (Runner용)', 37: 'SUMUS 영웅 펫 37 (Runner용)', 38: 'SUMUS 신화 펫 38 (Runner용)' };
export const FILES_36 = {
  '36a': '36a-zodiac-pets-design.txt', '36b': '36b-zodiac-pets-expressions.txt', '36c': '36c-zodiac-pets-battle-poses.txt', '36d': '36d-zodiac-title-medal.txt',
  '37a': '37a-epic-pets-design.txt', '37b': '37b-epic-pets-expressions.txt', '37c': '37c-epic-pets-battle-poses.txt',
  '38a': '38a-mythic-pets-design.txt', '38b': '38b-mythic-pets-expressions.txt', '38c': '38c-mythic-pets-battle-poses.txt', '38d': '38d-mythic-reveal-poses.txt', '38e': '38e-mythic-reveal-scenes.txt'
};
const PET_SPRITES = 'SUMUS_PET_SPRITES_ALL_20261002/original_1254';
const KEEP = 'Do NOT make it softer, blurrier, foggier, more painterly or more watercolor-like than the reference.';
const SHEET = 'Create ONE square image, 1024×1024 pixels, laid out as a 2×2 sprite sheet: four separate illustrations, one centered in each quarter (each quarter is 512×512). Leave generous empty space around every illustration so nothing touches or crosses the middle lines or the image edges. Use a real transparent background (PNG alpha) — do NOT paint a checkerboard, white box, grid lines, frames or borders. No text, no letters, no numbers, no labels, no watermark, no ground shadow. Do not ask me any questions; just generate the image.';
const STYLE = {
  pet: 'Style: premium cute chibi fantasy pet, soft 3D-painted anime illustration, fluffy fur drawn with fine strands, soft pastel colors, big glossy eyes with white highlights, light pink blush, a thin warm golden-white rim light along the outline, clean soft shading. Every cell shows exactly the same character design (same colors, markings, proportions and accessories); only the pose and expression change. Full body, 3/4 view facing the viewer\'s right, feet near the bottom of the cell.',
  egg: 'Style: premium cute 3D-painted game illustration, soft pastel colors, gentle warm rim light, clean soft shading. Each egg keeps exactly the shape, pattern, colors and nest (if it has one) of the reference picture; only its tilt and the effect around it change. Front view, the bottom of the egg (or its nest) near the bottom of the cell.',
  title: 'Style: shiny 3D game achievement medal, glossy enamel and polished metal, soft gem highlights, a clean bold outline, a symmetric frame, front view, one medal per cell, centered, about 78% of the cell, readable at 48 pixels. The FRAME (shape, rim and enamel color) shows the rarity tier and must be exactly as described for each cell. The small picture in the middle of the medal is different for every medal: a simple bold cute 3D object, mostly white or light colored with soft color accents, slightly raised from the enamel. No text, no letters, no numbers on the medals.'
};
// 처음 그리는 그림: Drive의 기존 펫 그림을 열어 그림체를 맞춘다(모든 시트에 들어간다).
const STYLE_REF = `STYLE REFERENCE — before drawing, open these pictures in Google Drive and study them: the existing pets of this game in the Drive folder "${PET_SPRITES}" (the folders MONG, NABI, PINKY and BAMBOO, each with 01_baby.png, 02_grown.png and 03_final.png). Draw in exactly that art style: the same crisp, clean shapes and edges, the same clear soft pastel colors (not washed out, not hazy), the same glossy eyes with white highlights, the same light cel-like shading with a thin warm rim light, the same simple fur tufts and the same body proportions (big head, short legs). ${KEEP} Do NOT copy the reference animals.`;
const SERIES_REF = {
  36: 'Also open "24a-1.png" and "24a-5.png" in the Google Drive folder "SUMUS 새 펫 24 (Runner용)" (the newest basic pets of this game) and match their finish, body size in the cell and level of detail exactly. This pet is one of the twelve Korean zodiac animals; the zodiac pets already in the game are 토리 (rabbit), 용이 (dragon), 초롱 (snake), 뭉실 (sheep), 몽이 (dog) and 핑키 (pig), and the new one must fit in that family.',
  37: 'Also open "24a-6.png" and "24a-8.png" in the Google Drive folder "SUMUS 새 펫 24 (Runner용)" (the newest 영웅 pets of this game) and match their finish, body size in the cell and level of detail exactly.',
  38: 'Also open "19a-2.png" (청룡) and "19a-4.png" (주작) in the Google Drive folder "SUMUS 신화 펫 19 (Runner용)" (the mythic pets of this game, the highest rank) and match their grandeur, prismatic rim light and level of detail exactly. Do NOT copy those designs.'
};
const MOOD = 'Extra small, round and soft like a plush toy: a very simple sweet face (small glossy eyes with white highlights, a tiny mouth, big round pink blush), short stubby limbs, often holding one small prop. Keep exactly the 3D-painted art style of the existing pets of this game. Do NOT copy or resemble any existing cartoon, anime or mascot character (for example Chiikawa, Hachiware or Usagi): this is an original character. ';
const TIER_D = {
  basic: 'A zodiac pet (one of the twelve animals of the Korean zodiac). ',
  epic: 'A 영웅 (epic) pet, one rank below legendary: a little grander and more sparkling than a basic pet, with a soft golden rim light. ',
  mythic: 'A 신화 (mythic) pet: the HIGHEST rank of this game, above legendary. It must be the most spectacular, richly detailed design of all pets, with a soft prismatic rainbow-gold rim light, a faint holographic shimmer and floating motifs of its own element. Cute and friendly, never scary. '
};
const TIER_X = { basic: '', epic: ' A 영웅 (epic) pet: a soft golden rim light.', mythic: ' A 신화 (mythic) pet: a soft prismatic golden rim light.' };

// 생김새(그림 GPT용, 영어). `limb`: 응원 동작에서 드는 곳. `move`: 야차전 공격 자세. 이름 · 종류는 core.js에서.
export const PETS_36 = {
  mouse: { series: 36, limb: 'one tiny front paw', move: 'dashing forward to the right in a blur and nibbling with its tiny front teeth, small cheese crumbs flying',
    base: 'a tiny round baby mouse with soft dove-gray fur, a cream belly, very big round ears with pink insides, big glossy black eyes, pink blush, a tiny pink nose with short whiskers, a thin pink tail with a small curl. It must look different from the hamster 쿠키 and the chinchilla 친친: smaller, gray, with a long thin pink tail and no cheek pouches',
    egg: 'a small dove-gray egg with tiny cheese-yellow polka dots, resting in a little nest shaped like a wedge of cheese', f: {
      1: 'baby stage: a tiny, very round baby mouse sitting and holding a small piece of cheese with both paws, no other accessories',
      2: 'grown stage: a slimmer young mouse standing upright on its hind legs (NOT a round baby), carrying a small pencil over its shoulder, a mint scarf with a small gold star charm',
      3: 'final stage: a clever, proud mouse leader standing on a big golden wheel of cheese, a small golden crown with a sapphire gem, a flowing slate-blue cape with gold trim fastened by a gold star clasp, holding a small golden key, golden sparkles (NOT a round baby)' } },
  calf: { series: 36, limb: 'one front hoof', move: 'charging forward to the right head first with its small horns, a puff of dust behind its hooves',
    base: 'a chubby baby calf (a young Korean hanwoo cow) with soft warm golden-brown fur, a cream muzzle with a pink nose, tiny rounded horn nubs, floppy ears, big glossy brown eyes, pink blush, a little tuft of hair on the forehead and a small brass cowbell on a red ribbon. It must look different from the deer 새싹 and the alpaca 몽글: golden-brown with a pink muzzle and a cowbell, no antlers, no spots',
    egg: 'a creamy golden-brown egg with soft wheat-ear patterns, resting in a small nest of straw with a tiny cowbell', f: {
      1: 'baby stage: a tiny round calf sitting with its legs tucked, holding a small milk bottle, its cowbell on a red ribbon',
      2: 'grown stage: a sturdy young calf standing on four legs (NOT a round baby), short curved horns, the cowbell, a mint scarf with a small gold star charm',
      3: 'final stage: a large, gentle and strong golden bull of the fields, golden curved horns, a small wreath of golden rice ears on its head, a golden cowbell, a flowing harvest-red cape with gold trim fastened by a gold star clasp, golden sparkles (NOT a round baby; kind, never angry)' } },
  tiger: { series: 36, limb: 'one front paw', move: 'pouncing forward to the right with one front paw swiping (soft rounded paw, no claws), a small roar with its mouth closed in a grin',
    base: 'a round fluffy baby tiger with bright orange fur and soft dark-brown stripes, a white muzzle and chest, small round ears with white spots on the back, big glossy amber eyes, pink blush, a chubby striped tail; a friendly Korean folk-painting tiger. It must look different from the white tiger 백호, the fox 호야 and the red panda 단풍: bright orange with clear dark stripes, round ears, no fluffy fox tail, no ring tail',
    egg: 'an orange egg with soft dark-brown tiger stripes, resting on a small nest of pine needles with a pine cone', f: {
      1: 'baby stage: a tiny, very round tiger cub sitting and letting out a tiny cute roar (a small open mouth, no fangs), no accessories',
      2: 'grown stage: a sturdy young tiger standing on four legs (NOT a round cub), a cute little magpie friend perched on its back, a mint scarf with a small gold star charm',
      3: 'final stage: a large, majestic Korean folk-painting tiger standing proud on a rock under a pine branch, a small golden headband with a red gem, a flowing deep-blue cape with cloud patterns and gold trim fastened by a gold star clasp, the cute magpie friend on its shoulder, golden sparkles (NOT a round cub; mouth closed, friendly)' } },
  pony: { series: 36, limb: 'one front hoof', move: 'galloping forward to the right and kicking with both front hooves, a trail of dust and sparkles',
    base: 'a chubby little pony (a Jeju pony) with soft chestnut-brown fur, a fluffy cream mane and tail, a white blaze on the face, big glossy dark eyes, pink blush, short sturdy legs with cream hooves. It must look different from the winged horse 천마 and the alpaca 몽글: chestnut brown, NO wings, NO horn, short legs, a fluffy cream mane',
    egg: 'a chestnut-brown egg with a cream horseshoe pattern and small clover leaves, resting on a little patch of green grass', f: {
      1: 'baby stage: a tiny round foal sitting with its wobbly legs folded, a little daisy in its mane, no other accessories',
      2: 'grown stage: a sturdy young pony standing mid-trot on four legs (NOT a round foal), a braided mane with a small ribbon, a mint scarf with a small gold star charm',
      3: 'final stage: a proud galloping pony champion with a long flowing cream mane and tail, a golden bridle with a star, a small red-and-gold saddle cloth with cloud patterns, golden horseshoes leaving a trail of sparkles, a flowing red cape with gold trim fastened by a gold star clasp (NOT a round foal; no wings, no horn)' } },
  monkey: { series: 36, limb: 'one long arm', move: 'swinging forward to the right on its curly tail and throwing a small banana like a boomerang',
    base: 'a playful little monkey with soft caramel-brown fur, a big heart-shaped peach-colored face, big round ears with peach insides, big glossy dark eyes, pink blush, long arms and a long curly tail. It must look different from the sloth 늘보 and the koala 쿨쿨: caramel fur, a peach heart-shaped face, round ears and a long curly tail',
    egg: 'a caramel-brown egg with soft banana-leaf patterns, resting in a nest of big green leaves with a tiny banana', f: {
      1: 'baby stage: a tiny round baby monkey sitting and hugging a small banana, its tail curled, no other accessories',
      2: 'grown stage: a lively young monkey standing on its hind legs (NOT a round baby), holding a small peach, its tail curled like a question mark, a mint scarf with a small gold star charm',
      3: 'final stage: a clever, cheerful monkey hero swinging on a vine of flowers, a small golden crown with a peach-colored gem, a flowing orange cape with gold trim fastened by a gold star clasp, holding a golden peach, golden sparkles (NOT a round baby; NOT a golden headband, NOT a fighting staff)' } },
  rooster: { series: 36, limb: 'one wing', move: 'flapping forward to the right with its wings spread and a quick peck, a few feathers flying',
    base: 'a round fluffy yellow chick with a small bright red comb on top of its head, a tiny orange beak, small round wings, orange feet, big glossy black eyes and pink blush, that grows into a proud rooster. It must look different from the rice-ball chick 주먹이 (no rice-ball shape, no nori band), the duck 꽥꽥 and the long-tailed tit 포롱: bright yellow with a red comb, later white-and-gold rooster feathers with a long rainbow tail',
    egg: 'a warm cream-white egg with soft sunrise-orange stripes, resting in a small round straw nest with a tiny feather', f: {
      1: 'baby stage: a tiny, very round fluffy yellow chick with a tiny red comb, cheeping happily, no accessories',
      2: 'grown stage: a young rooster standing tall on its legs (NOT a round chick) with white-and-golden feathers, a bigger red comb and wattle, short arched tail feathers, a mint scarf with a small gold star charm',
      3: 'final stage: a majestic sunrise rooster standing proudly, a big red comb, gleaming white-and-gold feathers, a long sweeping tail of emerald, gold and crimson feathers, a small golden crown, a flowing sunrise-orange cape with gold trim fastened by a gold star clasp, a soft sunrise glow and golden sparkles behind (NOT a round chick)' } },
  flamingo: { series: 37, limb: 'one wing', move: 'spinning forward to the right on one long leg like a ballerina, its wings sweeping a pink gust of feathers',
    base: 'a graceful little flamingo with soft coral-pink feathers, a long elegant S-shaped neck, a curved pink beak with a black tip, long thin pink legs (often standing on one leg), big glossy dark eyes, pink blush. It must look different from the parrot 앵두 and the long-tailed tit 포롱: tall and pink with a long neck and long legs',
    egg: 'a pale coral-pink egg with soft wave patterns, resting on a small mud mound in shallow water with a tiny water lily', f: {
      1: 'baby stage: a tiny round fluffy pale-pink chick on short legs with a small curved beak, no accessories',
      2: 'grown stage: a slender young flamingo standing on one long leg (NOT a round chick), coral-pink feathers, a mint scarf with a small gold star charm',
      3: 'final stage: a radiant ballerina flamingo standing on one leg with its wings spread wide, rose-gold feather tips, a small golden tiara with a pink gem, a flowing sheer pink cape with gold trim fastened by a gold star clasp, water ripples, floating pink petals and golden sparkles (NOT a round chick)' } },
  quokka: { series: 37, limb: 'one small front paw', move: 'hopping forward to the right with a huge happy grin and a double-paw push, a burst of little smiling suns',
    base: 'a small round quokka with soft warm-brown fur, a cream belly, small round ears, a big happy wide smile (the happiest animal), big glossy dark eyes, pink blush, short legs and a short tail. It must look different from the capybara 유자, the hamster 쿠키, the meerkat 쫑긋 and the raccoon dog 너굴: a small round brown body, short round ears, a big happy smile, no face mask',
    egg: 'a sandy-brown egg with a soft smiling-sun pattern, resting on warm island sand with a small leafy plant', f: {
      1: 'baby stage: a tiny round quokka joey sitting and nibbling a small leaf with a big smile, no accessories',
      2: 'grown stage: a young quokka hopping upright on its hind legs (NOT a round baby), holding a small instant camera, a mint scarf with a small gold star charm',
      3: 'final stage: a grand, cheerful quokka with the biggest happy smile standing on a sunny island rock, a small golden crown with a sunshine-yellow gem, a flowing sunny-yellow cape with gold trim fastened by a gold star clasp, a little rainbow and golden sparkles behind (NOT a round baby)' } },
  chameleon: { series: 37, limb: 'one front foot', move: 'leaping forward to the right while its skin flashes rainbow colors and its spiral tail whips forward',
    base: 'a cute round chameleon with smooth mint-green skin that shifts softly to turquoise and pink in places, a curled spiral tail, big round turret eyes with glossy pupils and white highlights, pink blush, a small crest on its head, small grabbing feet. It must look different from the frog 폴짝, the crocodile 덥썩, the snake 초롱 and the axolotl 우파: big round turret eyes, a spiral tail and color-shifting skin',
    egg: 'a mint-green egg with soft rainbow color-shifting scale patterns, resting on a small leafy branch', f: {
      1: 'baby stage: a tiny round baby chameleon clinging to a small twig with its tail curled, no accessories',
      2: 'grown stage: a young chameleon standing on a branch (NOT a round baby), its skin shifting in pastel rainbow stripes, a mint scarf with a small gold star charm',
      3: 'final stage: a majestic rainbow chameleon on a glowing jungle branch, its skin shimmering with prismatic rainbow scales, a tall golden crest crown with a rainbow gem, a flowing iridescent cape with gold trim fastened by a gold star clasp, a long spiral tail, floating color sparkles (NOT a round baby)' } },
  polarbear: { series: 37, limb: 'one front paw', move: 'sliding forward to the right on its belly and swinging a big soft paw, ice crystals and snow flying',
    base: 'a chubby baby polar bear with fluffy snow-white fur, a small black nose, small round ears, big glossy dark eyes, pink blush, big round soft paws. It must look different from the brown bear 든든, the arctic fox 눈송, the seal 동글 and the white tiger 백호: a pure white round bear, no stripes, no pointed ears, no flippers',
    egg: 'a snow-white egg with soft icy-blue snowflake patterns, resting on a small ice floe', f: {
      1: 'baby stage: a tiny round polar bear cub sitting on a small ice floe and holding a tiny fish-shaped cookie, no other accessories',
      2: 'grown stage: a sturdy young polar bear standing on four legs (NOT a round cub), a knitted icy-blue scarf with a small gold star charm, a few snowflakes',
      3: 'final stage: a large, gentle polar bear guardian standing on a glacier, a small crown of ice crystals with a blue gem, a flowing icy-blue cape with aurora patterns and gold trim fastened by a gold star clasp, a soft aurora, snowflakes and golden sparkles (NOT a round cub)' } },
  snowleopard: { series: 37, limb: 'one front paw', move: 'leaping forward to the right from a rock with its huge tail streaming behind, one soft paw swiping (no claws)',
    base: 'a fluffy baby snow leopard with soft pale smoky-gray fur covered in dark gray ring-shaped rosette spots, a cream belly, small round ears, big glossy pale-green eyes, pink blush, and a VERY long, thick fluffy spotted tail it likes to hug. It must look different from the white tiger 백호 (rosette spots, NOT stripes), the cat 나비 (a huge thick tail and rosettes) and the arctic fox 눈송',
    egg: 'a pale smoky-gray egg with dark gray rosette spots, resting on a small snowy mountain rock', f: {
      1: 'baby stage: a tiny round snow leopard cub hugging its own huge fluffy tail like a pillow, no accessories',
      2: 'grown stage: a sleek young snow leopard standing on a rocky ledge (NOT a round cub), its long thick tail curled, a mint scarf with a small gold star charm',
      3: 'final stage: a majestic snow leopard of the high mountains standing on a snowy peak, silvery rosette fur shimmering, a small silver crown with an icy-green gem, a flowing silver-gray cape with gold trim fastened by a gold star clasp, swirling snow and starlight sparkles (NOT a round cub; mouth closed)' } },
  hummingbird: { series: 37, limb: 'one wing', move: 'darting forward to the right in a zigzag with blurred wings, leaving a shimmering emerald light trail',
    base: 'a tiny round hummingbird with shimmering emerald-green and turquoise feathers, a ruby-red throat, a long thin needle-like beak, tiny fast-blurred wings, big glossy dark eyes, pink blush and a short forked tail. It must look different from the parrot 앵두, the long-tailed tit 포롱 and the owl 올리: tiny, emerald-shimmering, a long thin beak and blurred hovering wings',
    egg: 'a small pearly mint egg with soft flower-petal patterns, resting in a tiny cup-shaped nest of moss and flower petals', f: {
      1: 'baby stage: a tiny round fluffy hummingbird chick sitting in a flower-cup nest, no accessories',
      2: 'grown stage: a sleek young hummingbird hovering beside a pink flower with blurred wings (NOT a round chick), a mint scarf with a small gold star charm',
      3: 'final stage: a radiant jewel hummingbird hovering with its wings glowing in prismatic light trails, iridescent emerald, sapphire and ruby feathers, a small golden crown with a ruby gem, a flowing sheer emerald cape with gold trim fastened by a gold star clasp, floating flowers and golden sparkles (NOT a round chick)' } },
  hwangryong: { series: 38, limb: 'one front claw', move: 'diving forward to the right in a golden coil with its claws out, the five colored orbs swirling around it',
    base: 'the Yellow Dragon of the Center (hwangryong), the leader of the four guardian beasts: a Korean-style Eastern dragon with a long graceful WINGLESS serpentine body in glossy golden-yellow scales shading to warm amber, a cream belly, a flowing white-gold mane and two long whiskers, golden antler-like horns, big glossy gold-amber eyes with white highlights, pink blush, a calm gentle closed-mouth smile, and five small glowing orbs in the five traditional Korean colors (blue, red, yellow, white, black) floating around it. It must look different from the azure dragon 청룡 (golden, not blue) and the dragon 용이 (wingless with a long body)',
    egg: 'a large glowing golden egg with fine dragon-scale patterns and a band of five-colored jewels (blue, red, yellow, white, black), resting on a small golden cloud', f: {
      1: 'baby stage: a tiny chubby golden baby dragon curled on a small golden cloud with tiny horn buds, holding a tiny glowing golden pearl, no other accessories',
      2: 'grown stage: a longer young golden dragon in graceful S-curves on clouds (NOT a short chubby baby), golden horns, a white-gold mane, a small five-colored ribbon with a gold star charm, the five small orbs floating around it',
      3: 'final stage: a majestic golden emperor dragon coiled in a grand spiral above a ring of five-colored clouds (blue, red, yellow, white, black), shimmering golden scales edged in white light, a long flowing white-gold mane and whiskers, big golden antler horns, a large radiant golden pearl at its chest, the five colored orbs orbiting it, soft golden light rays (NOT a short baby; powerful but friendly: mouth closed, no big teeth)' } },
  samjogo: { series: 38, limb: 'one wing', move: 'swooping forward to the right with its wings swept back and its sun disc blazing, golden embers streaming',
    base: 'the three-legged sun crow (samjogo) of Korean legend: a graceful round bird with glossy jet-black feathers that shimmer gold and crimson in the light, THREE small golden legs (always clearly three legs), a small golden beak, a crest of three golden feathers, big glossy ruby-gold eyes with white highlights, pink blush, and a glowing golden sun disc behind it. Cute and friendly, never spooky. It must look different from the vermilion bird 주작 (black-and-gold, three legs, a sun disc) and the owl 올리',
    egg: 'a glossy black egg glowing with golden sun-ray patterns, a small golden sun disc behind it, resting on a small golden cloud', f: {
      1: 'baby stage: a tiny round fluffy black chick with three tiny golden legs and a small golden sun halo, no other accessories',
      2: 'grown stage: a sleek young crow standing on its three golden legs (NOT a round chick), wings half open with gold-tipped feathers, a small crimson ribbon with a gold star charm, a golden sun disc behind its head',
      3: 'final stage: a majestic sun crow soaring with huge black wings edged in blazing gold and crimson, its three golden legs tucked beneath it (clearly three), a large blazing golden sun disc with soft rays behind it, a small golden crown, long elegant gold-tipped tail feathers, floating golden embers and prismatic sparkles (NOT a round chick; graceful and friendly)' } }
};
export const PAIRS_36 = { 36: [['mouse', 'calf'], ['tiger', 'pony'], ['monkey', 'rooster']], 37: [['flamingo', 'quokka'], ['chameleon', 'polarbear'], ['snowleopard', 'hummingbird']], 38: [['hwangryong', 'samjogo']] };
const tierOf = key => CHARACTERS[key].mythic ? 'mythic' : CHARACTERS[key].epic ? 'epic' : 'basic';
const pet = key => ({ ...PETS_36[key], ko: CHARACTERS[key].ko, type: CHARACTERS[key].type, tier: tierOf(key) });

const FORM_KO = { 1: '아기', 2: '성장', 3: '최종' };
const CELLS = ['TOP-LEFT', 'TOP-RIGHT', 'BOTTOM-LEFT', 'BOTTOM-RIGHT'];
const CELL_KO = ['왼쪽 위', '오른쪽 위', '왼쪽 아래', '오른쪽 아래'];
const EXPRS = [
  ['happy', '기뻐함', 'HAPPY: eyes closed in a big happy smile, rosy cheeks, two or three small pink hearts floating above the head'],
  ['eat', '냠냠', 'EATING: happily eating from a small round mint food bowl in front of it, cheeks puffed, a few crumbs, eyes curved in joy'],
  ['sad', '시무룩', 'SAD: slightly sad pouty face with teary sparkling eyes, ears, wings, feathers or tail drooping a little, still cute (not crying hard); keep the same face, markings and items as the other cells'],
  ['cheer', '응원', 'CHEERING: energetic pose with one front paw, arm, wing or hoof raised high, determined sparkling eyes, small motion sparkles']
];
const EGG_HAPPY = 'PETTED (기뻐함): the egg tilts to one side as if wiggling happily, two short curved motion lines on each side, three small pink hearts floating above. Do NOT crack the egg and do NOT give it a face.';
const EGG_WARM = 'WARMED (따뜻해짐): the egg glows with a soft warm orange-golden aura, three small wavy heat lines rising above it, a few tiny golden sparkles. Do NOT crack the egg, do NOT give it a face, no fire.';
const HURT_X = 'HURT: flinching from a hit that comes from the right: eyes squeezed shut, the body leaning back and to the left, ears, tail, wings or mane flung back, two or three small impact stars and one sweat drop beside the head; still cute (NOT injured: no blood, no tears streaming, no wounds)';
const STAGE = 'IMPORTANT: draw this exact growth stage in every cell, with its full body size, proportions and accessories. Do not draw the younger baby version, and do not make it rounder, shorter or chubbier when it sits, eats or is sad.';
const REVEAL = 'REVEAL POSE: the pet in its FINAL stage in a dramatic heroic pose, front 3/4 view, drawn larger and more detailed than usual, filling about 92% of the cell height.';
const POSE38 = {
  hwangryong: 'rising in a huge golden spiral toward the viewer, the five colored orbs circling it, the radiant pearl held up high, mane flowing',
  samjogo: 'wings spread to their full width in front of a blazing sun disc, rising upward, its three golden legs clearly visible'
};
const POSE38_ALT = {
  hwangryong: 'coiled proudly on a five-colored cloud, head raised toward the viewer, light rays bursting behind it',
  samjogo: 'perched proudly on a golden cloud on its three legs, wings half open, the sun disc glowing behind its head'
};
// 등장 배경: 세로 한 장(1024×1536, 투명 아님). 펫은 앱이 그 위에 올린다.
const BGT = 'Create ONE tall portrait image, 1024×1536 pixels: a full-screen 2D REVEAL BACKGROUND for a cute premium mobile pet game (players are high-school students), shown on a phone in portrait when a MYTHIC pet appears. Paint it fully to every edge (no transparency, no border, no frame, no rounded corners). NO characters, NO animals, NO creatures, NO people. No text, no letters, no numbers, no logos, no UI, no watermark. Do not ask me any questions; just generate the image.';
const BG_STYLE = 'Style: the same premium cute 3D-painted anime game art as the pets of this game: clear soft colors (not washed out, not hazy), clean shapes, soft cel-like shading, gentle rim light, friendly and inviting.';
const BG_REF = `STYLE REFERENCE — before drawing, open the pets of this game in the Google Drive folder "${PET_SPRITES}" (MONG, NABI, PINKY and BAMBOO, 03_final.png) and the mythic reveal backgrounds already in the game, "19e-2.png" and "19e-4.png" in the Google Drive folder "SUMUS 신화 펫 19 (Runner용)". The new background must look like it belongs in the same set as those backgrounds (same rendering quality, composition and color richness), and the pets must stand out clearly in front of it. Do NOT draw any characters.`;
const BGT_LAYOUT = 'COMPOSITION (important, the game puts its own pet, light effects and a title on top): epic scale and a strong sense of awe. A bright glowing focal point sits at the CENTER, slightly below the middle, where the pet will appear (the area around it is open, soft and uncluttered, about 60% of the width and 45% of the height). The TOP 20% stays calm and simple (a title goes there). Put the rich details, depth and scenery around the outer edges and far away. Light rays and floating elements point toward the center. A gentle vignette toward the edges.';
const SCENES_38 = {
  hwangryong: 'a golden dawn above a sea of clouds at the center of the world: five huge soft cloud banks in the five traditional Korean colors (blue in the east, red in the south, white in the west, black-navy in the north, yellow in the middle), distant floating mountain peaks with pine trees, a faint golden palace roof far away, golden light rays, a bright golden glow at the center.',
  samjogo: 'a blazing sunrise sky over layered mountain ridges: a gigantic golden sun filling the upper middle of the sky behind the center, crimson and gold clouds, floating golden embers and soft sun rays, a warm glowing haze, a bright golden-white glow at the center.'
};
// 칭호 '12지 수호자'(전설 테두리: 11 칭호와 같은 규칙).
const LEGEND_FRAME = 'FRAME: a ROUND GOLD medal ringed by a gold sunburst of short pointed rays, a small gold star on top, a rich golden enamel face and a warm golden glow';
const TITLE_REF = 'STYLE REFERENCE — before drawing, open "11-1.png" and "11-12.png" in the Google Drive folder "SUMUS 칭호 11 (Runner용)" (the title medals of this game; 11-12 has the legendary gold sunburst frame) and "25-10.png" in the Google Drive folder "SUMUS 칭호 25 (Runner용)" if it is there. Draw the medal in exactly that style: the same glossy 3D toy-like metal and enamel, the same frame for the legendary tier, the same size in the cell, clean edges and soft sparkles. ' + KEEP + ' Do NOT copy the reference medals\' center pictures.';

const designRef = (series, keys) => `CHARACTER REFERENCE — before drawing, open ${keys.map(k => `"${sheetOf(k)}.png"`).join(' and ')} (the design sheet${keys.length > 1 ? 's' : ''}: egg, baby, grown, final) in the Google Drive folder "${DRIVE_36[series]}"`;
const ORDER = Object.keys(PETS_36);
const sheetOf = key => { const s = PETS_36[key].series; return `${s}a-${ORDER.filter(k => PETS_36[k].series === s).indexOf(key) + 1}`; };

export function sheets36() {
  const out = [], count = {};
  const add = (series, part, title, lines, cells, opt = {}) => {
    const s = `${series}${part}`, name = `${s}-${(count[s] = (count[s] || 0) + 1)}`;
    const text = [...lines.filter(Boolean),
      opt.bg ? `WHEN DONE — upload the finished PNG (1024×1536, fully painted, not transparent) to Google Drive, into the folder "${DRIVE_36[series]}", named exactly "${name}.png" (if a file with that name is already there, replace it; if the folder does not exist, create it). Actually save the file to Google Drive; showing the picture in the chat is not enough.`
        : `WHEN DONE — upload the finished transparent PNG to Google Drive, into the folder "${DRIVE_36[series]}", named exactly "${name}.png" (if a file with that name is already there, replace it; if the folder does not exist, create it). Actually save the file to Google Drive; showing the picture in the chat is not enough.`].join('\n');
    out.push({ series, file: FILES_36[s], name, title, text, cells: cells.map((c, i) => ({ cell: opt.bg ? '전체' : CELL_KO[i], key: c[0], name: c[1], out: c[3] })) });
  };
  const cellLines = cells => cells.map((c, i) => `${CELLS[i]} cell: ${c[2]}`);
  for (const series of [36, 37, 38]) {
    const keys = ORDER.filter(k => PETS_36[k].series === series);
    // a: 설정 시트(알 · 아기 · 성장 · 최종)
    for (const key of keys) {
      const p = pet(key);
      const cells = [
        [`${key}-0`, `${p.ko} 알`, `EGG: ${p.egg}. Just the egg, no creature`, `public/assets/pets/${key}-0.webp`],
        [`${key}-1`, `${p.ko} 아기`, `BABY: the ${p.f[1]}, happy calm face, front 3/4 view`, `public/assets/pets/${key}-1.webp`],
        [`${key}-2`, `${p.ko} 성장`, `GROWN: the ${p.f[2]}, happy calm face, front 3/4 view`, `public/assets/pets/${key}-2.webp`],
        [`${key}-3`, `${p.ko} 최종`, `FINAL: the ${p.f[3]}, happy calm face, front 3/4 view`, `public/assets/pets/${key}-3.webp`]
      ];
      add(series, 'a', `${p.ko} ${p.type} 설정 시트`, [SHEET, STYLE.pet, STYLE_REF, SERIES_REF[series],
        `Subject: ${p.ko}, ${p.base}. ${p.tier === 'mythic' ? '' : MOOD}${TIER_D[p.tier]}Draw the same character at four growth steps; each cell must clearly be the same creature, getting bigger and grander.`, ...cellLines(cells)], cells);
    }
    // b: 표정(단계마다 4) + 알 반응(두 펫씩)
    for (const key of keys) for (const form of [1, 2, 3]) {
      const p = pet(key);
      const cells = EXPRS.map(([e, ko, text]) => [`${key}-${form}-${e}`, `${p.ko} ${FORM_KO[form]} ${ko}`, text, `public/assets/pets/${key}-${form}-${e}.webp`]);
      add(series, 'b', `${p.ko} ${FORM_KO[form]} 표정`, [SHEET, STYLE.pet, STYLE_REF,
        `${designRef(series, [key])} and match this pet's face, colors, markings, accessories and the body size of this growth stage exactly (baby = top-right cell, grown = bottom-left cell, final = bottom-right cell). ${KEEP}`,
        `Subject: ${p.ko}, ${p.base}. This is the ${p.f[form]}. In every cell that says a paw, arm, wing or hoof is raised, this pet raises ${p.limb} instead.${TIER_X[p.tier]}`, form > 1 ? STAGE : '', ...cellLines(cells)], cells);
    }
    for (const [a, b] of PAIRS_36[series]) {
      const pa = pet(a), pb = pet(b);
      const cells = [[`${a}-0-happy`, `${pa.ko} 알 기뻐함`, EGG_HAPPY, `public/assets/pets/${a}-0-happy.webp`], [`${a}-0-eat`, `${pa.ko} 알 따뜻해짐`, EGG_WARM, `public/assets/pets/${a}-0-eat.webp`],
        [`${b}-0-happy`, `${pb.ko} 알 기뻐함`, EGG_HAPPY, `public/assets/pets/${b}-0-happy.webp`], [`${b}-0-eat`, `${pb.ko} 알 따뜻해짐`, EGG_WARM, `public/assets/pets/${b}-0-eat.webp`]];
      add(series, 'b', `${pa.ko} · ${pb.ko} 알 반응`, [SHEET, STYLE.egg, STYLE_REF, `${designRef(series, [a, b])} and match each egg (the top-left cell of each design sheet) exactly. ${KEEP}`,
        `Subject: two pet eggs (the reference pictures show them). The TOP row cells show ${pa.ko}'s egg: ${pa.egg}. The BOTTOM row cells show ${pb.ko}'s egg: ${pb.egg}.`, ...cellLines(cells)], cells);
    }
    // c: 야차전 · 던전 공격 · 맞음(두 펫씩, 단계마다)
    for (const [a, b] of PAIRS_36[series]) for (const form of [1, 2, 3]) {
      const pa = pet(a), pb = pet(b);
      const cells = [a, b].flatMap(key => [
        [`${key}-${form}-attack`, `${pet(key).ko} ${FORM_KO[form]} 공격`, `ATTACK: ${pet(key).ko} in a dynamic attack pose: ${pet(key).move}; the body stretched forward, a determined sparkling expression, motion lines behind it; still cute`, `public/assets/pets/${key}-${form}-attack.webp`],
        [`${key}-${form}-hurt`, `${pet(key).ko} ${FORM_KO[form]} 맞음`, HURT_X, `public/assets/pets/${key}-${form}-hurt.webp`]]);
      add(series, 'c', `${pa.ko} · ${pb.ko} ${FORM_KO[form]} 공격·맞음`, [SHEET, STYLE.pet, STYLE_REF,
        `${designRef(series, [a, b])}. Draw the growth step named in the Subject (baby = top-right cell, grown = bottom-left cell, final = bottom-right cell of each design sheet) and keep each pet's face, colors, markings, size and accessories exactly; only the pose changes. Also open "24c-1.png" in the Google Drive folder "SUMUS 새 펫 24 (Runner용)" and "20-1.png" in the Google Drive folder "SUMUS 전투 자세 20 (Runner용)" (attack and hurt poses already made for other pets) and match how strong and how cute those poses are.`,
        `Subject: two different pets of the same growth step (the reference pictures show each one). TOP row: ${pa.ko}, ${pa.base}. This is the ${pa.f[form]}. BOTTOM row: ${pb.ko}, ${pb.base}. This is the ${pb.f[form]}. Each pet keeps exactly the design, size and accessories of its reference picture of this growth step; only the pose changes. LEFT cell of each row: ATTACK, RIGHT cell: HURT.`, ...cellLines(cells)], cells);
    }
  }
  // 36d: 칭호 '12지 수호자' 메달(왼쪽 위) + 같은 메달의 다른 시안 3개(여분, 가장 좋은 것을 골라 왼쪽 위 이름으로 넣는다).
  {
    const center = [
      'a small golden wheel with twelve tiny cute animal charms around its rim (rat, ox, tiger, rabbit, dragon, snake, horse, sheep, monkey, rooster, dog, pig), a small gold star in the middle',
      'a small round shield with a ring of twelve tiny paw, hoof and claw prints around a glowing gold star',
      'twelve tiny cute zodiac animal heads (rat, ox, tiger, rabbit, dragon, snake, horse, sheep, monkey, rooster, dog, pig) arranged in a neat circle like a clock face, a small gold star in the middle',
      'a small golden guardian crest with a tiny tiger and a tiny dragon facing each other above a ring of twelve small gems'
    ];
    const cells = center.map((c, i) => [i ? `title-zodiac12-alt${i}` : 'title-zodiac12', i ? `12지 수호자 메달 (여분 ${i}, 고르기용)` : '12지 수호자 메달 (전설)', `${LEGEND_FRAME}. CENTER: ${c}.`, i ? '(여분: 왼쪽 위보다 나으면 이 칸을 titles/zodiac12로 넣는다)' : 'public/assets/titles/zodiac12.webp']);
    add(36, 'd', '12지 수호자 칭호 메달', [SHEET, STYLE.title, TITLE_REF, 'Subject: four design options of ONE achievement medal ("Guardian of the 12 Zodiac Animals", a legendary-tier title of a teen vocabulary game). All four cells share exactly the same legendary frame; only the small picture in the middle changes. No letters and no numbers anywhere.', ...cellLines(cells)], cells);
  }
  // 38d: 등장 포즈(위 줄) + 다른 포즈 여분(아래 줄)
  {
    const cells = [...['hwangryong', 'samjogo'].map(key => [`${key}-reveal`, `${pet(key).ko} 등장 포즈`, `${pet(key).ko} (${pet(key).type}), FINAL stage: ${REVEAL} ${POSE38[key]}`, `public/assets/pets/${key}-reveal.webp`]),
      ...['hwangryong', 'samjogo'].map(key => [`${key}-reveal-alt`, `${pet(key).ko} 등장 포즈 (여분, 고르기용)`, `${pet(key).ko} (${pet(key).type}), FINAL stage: ${REVEAL} ${POSE38_ALT[key]}`, `(여분: 위 칸보다 나으면 이 칸을 pets/${key}-reveal로 넣는다)`])];
    add(38, 'd', '황룡 · 삼족오 등장 포즈', [SHEET, STYLE.pet, STYLE_REF,
      `${designRef(38, ['hwangryong', 'samjogo'])}. Each pet in this sheet is the FINAL stage (the bottom-right cell) of its design sheet: keep its face, colors, markings, accessories and proportions exactly, only change the pose. Also open "19d-1.png" in the Google Drive folder "SUMUS 신화 펫 19 (Runner용)" (the reveal poses of the other mythic pets) and match their size in the cell, drama and level of detail. ${KEEP}`,
      'Subject: two different mythic pets, each in a dramatic reveal pose of its FINAL stage. LEFT column: 황룡, RIGHT column: 삼족오. TOP row: the main reveal pose; BOTTOM row: a second pose option of the same pet.', ...cellLines(cells)], cells);
  }
  // 38e: 등장 배경(세로)
  for (const key of ['hwangryong', 'samjogo']) add(38, 'e', `${pet(key).ko} 등장 배경`, [BGT, BG_STYLE, BG_REF, `Scene: ${SCENES_38[key]}`, BGT_LAYOUT],
    [[`bg-${key}`, `${pet(key).ko} 등장 배경`, '', `public/assets/reveal/bg-${key}.webp`]], { bg: true });
  return out;
}

// Codex 작업 지시(CODEX_PROMPT_36 · 37 · 38.md): 표와 자르기 명령은 위 시트 목록에서 만든다.
const TIER_KO = { basic: '기본(12지)', epic: '영웅', mythic: '신화' };
const TITLE_36 = { 36: '12지 기본 펫 6종', 37: '영웅 펫 6종', 38: '신화 펫 2종' };
export function codexPrompt(series, list = sheets36()) {
  const l = list.filter(s => s.series === series), keys = ORDER.filter(k => PETS_36[k].series === series), R = 'docs/asset-requests/runner';
  const of = (part, key) => l.filter(s => s.file === FILES_36[`${series}${part}`] && s.cells.some(c => c.key.startsWith(`${key}-`))).map(s => s.name);
  const range = names => names.length > 1 ? `${names[0]}~${names.at(-1).split('-')[1]}` : names[0] || '-';
  const names = keys.map(k => `${CHARACTERS[k].ko}(${CHARACTERS[k].type})`).join(' · ');
  const parts = [...new Set(l.map(s => s.file.slice(0, 3)))];
  const cmd = s => {
    if (s.file.endsWith('reveal-scenes.txt')) return `# ${s.name}: 1024×1536 PNG → 720×1080 webp(150KB 이하): ${s.cells[0].out}`;
    const outs = s.cells.map(c => c.out.startsWith('public/assets/') ? c.out.replace('public/assets/', '').replace(/\.webp$/, '') : '-');
    if (/design\.txt$/.test(s.file)) return `node $R/fit-assets.mjs /tmp/art/${s.name}.png ${outs.join(' ')} --stand --preview /tmp/review/${s.name}.png`;
    if (/medal\.txt$/.test(s.file)) return `node $R/fit-assets.mjs /tmp/art/${s.name}.png ${outs.join(' ')} --fit-each --small 96 --preview /tmp/review/${s.name}.png   # 여분 칸이 더 나으면 그 칸을 titles/zodiac12로`;
    if (/reveal-poses\.txt$/.test(s.file)) return `node $R/fit-assets.mjs /tmp/art/${s.name}.png ${outs.join(' ')} --fit-each --size 1024 --preview /tmp/review/${s.name}.png   # 아래 줄(여분)이 더 나으면 그 칸을 pets/<키>-reveal로`;
    return `node $R/fit-sheets.mjs /tmp/art/${s.name}.png ${outs.map(o => o.replace(/^pets\//, '')).join(' ')} --preview /tmp/review/${s.name}.png`;
  };
  const perPet = series === 38 ? '기본 4 + 표정 12 + 알 반응 2 + 전투 6 + 작은 그림 4 + 등장 포즈 1 = 29개(+ 등장 배경 1장)' : '기본 4 + 표정 12 + 알 반응 2 + 전투 6 + 작은 그림 4 = 28개';
  return `# Codex 작업 지시: 그림 ${series} (${TITLE_36[series]}: ${names})

## 목표
SUMUS VOCA(저장소 \`minsik2e5/sumus-quiz-battle\`)의 그림 주문서 ${series}로 새 펫 그림(설정 · 표정 · 알 반응 · 야차전 공격/맞음${series === 38 ? ' · 신화 등장 포즈 · 등장 배경' : ''}${series === 36 ? ' · 칭호 메달' : ''})을 만들고, 잘라서 \`public/assets/\`에 넣은 뒤 PR을 만든다.
**그림 파일만 넣는다. 앱 코드는 고치지 않는다.** 펫 등록 · 특기 · 알 · 도감 연결은 이미 되어 있고, \`npm run build:assets\`가 그림 폴더를 보고 \`public/modules/pet-art.js\`를 다시 만들면 **그림이 다 들어온 펫만 자동으로** 알 · 선생님 선물 알 · 몬스터 사냥 · 낚시 교환소 · 도감에 나온다(한 장이라도 빠진 펫은 계속 숨는다).

| 등급 | 펫 key | 이름 | 설정 시트 | 표정 시트 | 알 반응 | 전투 자세 |
|---|---|---|---|---|---|---|
${keys.map(k => `| ${TIER_KO[tierOf(k)]} | \`${k}\` | ${CHARACTERS[k].ko} · ${CHARACTERS[k].type} | ${range(of('a', k))} | ${range(of('b', k).filter(n => !l.find(s => s.name === n).title.includes('알 반응')))} | ${range(of('b', k).filter(n => l.find(s => s.name === n).title.includes('알 반응')))} | ${range(of('c', k))} |`).join('\n')}

- 시트는 모두 **${l.length}장**(${parts.map(p => `${p} ${l.filter(s => s.file.startsWith(p)).length}`).join(' · ')}).
- 한 펫의 그림 = ${perPet}.
- 앱은 이 파일 이름을 그대로 읽는다(\`<key>-<단계>.webp\`, \`<key>-<단계>-<표정>.webp\`, \`<key>-<단계>-attack.webp\`${series === 38 ? ', `<key>-reveal.webp`, `reveal/bg-<key>.webp`' : ''}). 이름이 다르면 그 펫은 나오지 않는다.
${series === 36 ? '- `36d-1`은 칭호 \'12지 수호자\' 메달이다. 네 칸 모두 같은 메달의 시안이고, 왼쪽 위가 기본이다. 다른 칸이 더 나으면 그 칸을 `titles/zodiac12`로 넣는다(메달 그림이 있으면 앱이 자동으로 쓴다).\n' : ''}${series === 38 ? '- `38d-1` 아래 줄은 등장 포즈 여분이다. 위 줄보다 나으면 그 칸을 `pets/<키>-reveal`로 넣는다.\n' : ''}
## 그림체 (중요)
- **기존 펫과 똑같은 그림체**(3D 페인팅, 반짝이는 큰 눈, 볼터치, 금빛 테두리 빛). ${series === 37 ? '영웅 펫은 기본 펫보다 성장 · 최종이 조금 더 화려하다.' : series === 38 ? '신화 펫은 가장 높은 등급이라 가장 화려하다(무지개빛 금 테두리 빛). 기존 신화(청룡 · 주작)만큼 웅장하게.' : '12지 펫은 지금 있는 12지 펫(토리 · 용이 · 초롱 · 뭉실 · 몽이 · 핑키)과 한 가족처럼 보이게.'}
- **만화 · 애니 캐릭터를 따라 그리거나 닮게 그리지 않는다.** 모두 새 캐릭터다.
- 기존 펫과 헷갈리지 않게 각 주문서의 "must look different" 문장을 지킨다.

## 꼭 지킬 것
- 브랜치는 \`sumus-voca-prod-deploy\`에서 새로 만든다. 예: \`codex/art-${series}\`
  - 그 브랜치에 \`${R}/${FILES_36[`${series}a`]}\`가 없으면 주문서 PR이 아직 머지되지 않은 것이다. 그때는 \`claude/new-pets-14\`에서 시작한다.
- **PR까지만 만든다. 머지하지 않는다.** 머지하면 운영에 바로 배포되고, 그림이 다 들어온 펫은 바로 학생들에게 나온다.
- **운영 Supabase에 연결하지 않는다.**
- **그림은 Codex에 내장된 그림 생성 기능으로 만든다.** OpenAI API 키(\`OPENAI_API_KEY\`)나 유료 API를 쓰지 않는다. 키가 없다고 멈추지 않는다.
- \`public/assets/\` 아래 새 그림, \`${R}/DONE_${series}.md\`, 빌드가 바꾸는 \`public/sw.js\` · \`public/modules/pet-art.js\` 말고는 고치지 않는다. 앱 코드, 게임 규칙, 코인, 확률, 서버 로직, 점검 파일은 건드리지 않는다.
- 원본 시트 PNG는 커밋하지 않는다. 임시 폴더(\`/tmp/art/\`)에 둔다.
- 기존 그림 파일은 지우거나 덮어쓰지 않는다. **새 파일만 추가**한다.

## 입력 (저장소 안, \`${R}/\`)
- \`split/\` 폴더: 시트 하나 = 프롬프트 하나. 파일 이름이 시트 번호다(예: \`split/${l[0].name} ${l[0].title}.txt\`).
- \`slice-map.csv\`: 각 칸의 이름(\`key\`)과 앱 파일(\`app_file\`). \`list\` 열이 \`${parts.join('…`·`')}…\`인 줄만 본다. 칸 순서는 왼쪽 위 → 오른쪽 위 → 왼쪽 아래 → 오른쪽 아래.
- 자르기 도구: \`fit-assets.mjs\`, \`fit-sheets.mjs\`(사용법은 파일 맨 위 주석). \`sharp\`가 없으면 \`npm i --no-save sharp\`.

### 프롬프트 손보기 (Drive 대신 참고 그림 첨부)
주문서는 그림 GPT가 Google Drive를 여는 방식으로 쓰여 있다(기존 펫 그림을 열어 그림체를 맞추고, 정해진 Drive 폴더 "${DRIVE_36[series]}"에 정확한 파일 이름으로 저장). Codex는 Drive를 쓰지 않으니 보내기 전에 이렇게 바꾼다.
1. 다음으로 **시작하는 줄을 지운다**: \`STYLE REFERENCE\`, \`CHARACTER REFERENCE\`, \`Also open\`, \`WHEN DONE\`
2. 아래 표의 참고 그림을 같이 보여 주고, 프롬프트 **세 번째 줄**에 이 문장을 넣는다:
   \`REFERENCE IMAGES ARE ATTACHED: match their art style, rendering quality, crisp clean edges and colors exactly. If a reference shows this same character, keep its face, colors, markings and accessories exactly. Do NOT copy any other animal or character from the references, and do NOT copy or resemble any cartoon or anime character.\`

### 참고 그림 (\`public/assets/\` 아래 경로)
| 시트 | 참고 그림 |
|---|---|
| ${series}a 설정 | ${series === 36 ? '`pets/panda-3.webp`, `pets/dog-1.webp`, `pets/rabbit-2.webp`, `pets/elephant-2.webp`' : series === 37 ? '`pets/panda-3.webp`, `pets/capybara-3.webp`, `pets/chinchilla-2.webp`' : '`pets/panda-3.webp`, `pets/cheongryong-3.webp`, `pets/jujak-3.webp`'} |
| ${series}b 표정 | 그 펫 · 단계의 새 그림 \`pets/<키>-<단계>.webp\` (예: ${l.find(s => s.file.endsWith('expressions.txt')).name} → \`pets/${keys[0]}-1.webp\`) |
| ${series}b 알 반응 | 두 펫의 \`pets/<키>-0.webp\` |
| ${series}c 전투 자세 | 두 펫의 그 단계 새 그림 + 기존 자세 \`pets/elephant-2-attack.webp\`, \`pets/elephant-2-hurt.webp\` |
${series === 36 ? '| 36d 메달 | `titles/pets30.webp`, `titles/legend1.webp` (전설 테두리) |\n' : ''}${series === 38 ? '| 38d 등장 포즈 | 그 펫의 새 `pets/<키>-3.webp` + 기존 `pets/cheongryong-reveal.webp` |\n| 38e 등장 배경 | 기존 `reveal/bg-cheongryong.webp`, `reveal/bg-jujak.webp` |\n' : ''}
### 후보 점검 (모두 통과해야 쓴다)
1. 배경이 진짜 투명이다(네 모서리 alpha 0, 체크무늬 · 흰 상자 · 흰 테두리 없음).${series === 38 ? ' 등장 배경(38e)만 투명이 아니고 가장자리까지 꽉 채운다.' : ''}
2. 칸마다 그림이 하나씩 따로 있고, 겹치거나 잘리지 않았다. 글자, 숫자, 테두리, 바닥 그림자가 없다.
3. 같은 시트의 칸들은 같은 캐릭터 디자인이다(색, 무늬, 소품).
4. 설정 시트는 알 → 아기 → 성장 → 최종으로 분명히 커지고 화려해진다. 알에는 얼굴이 없다. 표정 · 전투 자세는 같은 단계의 몸 크기와 소품이 설정 시트와 같다. 공격은 오른쪽으로 달려들고, 맞음은 오른쪽에서 맞아 왼쪽으로 몸을 젖힌다(피 · 상처 없이 귀엽게).${series === 38 ? ' 삼족오는 모든 그림에서 다리가 3개다. 황룡은 날개가 없다.' : ''}

이미지를 볼 수 있으면 4번은 눈으로 확인한다. 볼 수 없으면 1~3번만 확인하고 PR에 "눈으로 확인 필요"라고 적는다.

## 1. 그림 만들기
- **Codex의 내장 그림 생성 기능**으로 시트를 하나씩 만든다. API를 직접 부르지 않는다.
- 2×2 시트: 1024×1024, **투명 배경 PNG**.${series === 38 ? ' 등장 배경: 1024×1536, 투명 아님.' : ''} 만든 그림은 \`/tmp/art/<시트 번호>.png\`로 저장한다(예: \`/tmp/art/${l[0].name}.png\`).
- 점검을 통과하지 못하면 같은 프롬프트로 다시 만든다. 시트마다 최대 4번이다.
- **순서를 지킨다.** 설정 시트(\`${series}a\`)를 먼저 만들고 잘라 넣은 뒤, 그 그림을 참고로 표정 · 알 반응 · 전투 자세를 만든다. 순서: ${parts.join(' → ')}.
- 한 번에 다 못 만들면 **펫 하나를 끝까지**(설정 · 표정 · 알 반응) 만든 단위로 끊는다. 그래야 그 펫이 앱에 나온다. 못 만든 시트는 \`DONE_${series}.md\`의 "넣지 못한 그림"에 적는다.

## 2. 자르고 넣기
\`\`\`
R=${R}
${l.map(cmd).join('\n')}
\`\`\`
- **작은 그림**: 기본 그림(\`<키>-<단계>.webp\`, 단계 0~3)마다 \`<키>-<단계>-s.webp\`(160×160, 투명, \`fit: 'contain'\`)도 만든다. ${keys.length}종 × 4 = ${keys.length * 4}개. 이게 없으면 그 펫은 앱에 나오지 않는다.
${series === 38 ? '- **등장 배경(38e)**: 고른 PNG를 `sharp(src).resize(720, 1080, { fit: \'cover\' }).webp({ quality: 80, effort: 6 })`로 줄여 `public/assets/reveal/bg-<키>.webp`로 저장한다. 등장 포즈와 등장 배경이 없으면 신화 펫은 나오지 않는다.\n' : ''}- 도구가 "배경이 투명하지 않아요"나 "칸이 비어 있어요"로 멈추면 그 시트는 1단계로 돌아가 다시 만든다.

## 3. 기록
- \`${R}/DONE_${series}.md\`를 한국어로 쓴다: 펫별 넣은 그림 표, 넣지 못한 그림과 이유, 시트마다 다시 만든 횟수, "눈으로 확인 필요" 항목, **빌드 뒤 \`pet-art.js\`에 들어간 펫**(= 앱에 나오는 펫).
- 버전은 올리지 않는다.

## 4. 점검
\`\`\`
npm ci
npm run build:assets      # public/modules/pet-art.js가 바뀐다(그림이 다 들어온 펫이 PET_ART에 들어간다)
npm run check             # release-check 전부 PASS
npm run check:cloudflare
\`\`\`
- 점검이 실패하면 점검 파일을 고치지 말고 PR에 실패 메시지를 그대로 적는다.
- 기존 그림의 \`D\`(삭제) · \`M\`(수정)이 없어야 한다: \`git diff --name-status origin/sumus-voca-prod-deploy -- public/assets\`

## 5. PR
- 대상: \`sumus-voca-prod-deploy\`
- 제목: \`그림 ${series}: ${TITLE_36[series]} (${keys.map(k => CHARACTERS[k].ko).join(' · ')})\`
- 본문은 한국어로 쓴다. 넣은 그림 표, 넣지 못한 그림과 이유, 점검 결과, "눈으로 확인 필요" 항목, 앱에 나오게 되는 펫.
- 마지막 줄: \`> ⚠️ 머지하면 운영에 바로 배포되고, 그림이 다 들어온 펫이 바로 학생들에게 나옵니다.\`
- 미리보기 그림(\`/tmp/review/*.png\`)을 한 장으로 합쳐 PR 코멘트로 올린다.
- **머지하지 않는다.**
`;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const list = sheets36();
  for (const file of Object.values(FILES_36)) writeFileSync(resolve(here, file), list.filter(s => s.file === file).map(s => s.text).join('\n---\n') + '\n');
  const split = resolve(here, 'split');
  mkdirSync(split, { recursive: true });
  for (const f of readdirSync(split)) if (/^3[678][a-e]-\d+ /.test(f)) unlinkSync(resolve(split, f));
  for (const s of list) writeFileSync(resolve(split, `${s.name} ${s.title.replace(/[\\/:*?"<>|()]/g, '').replace(/\s+/g, ' ').trim()}.txt`), s.text + '\n');
  // slice-map.csv: 36~38 줄을 지우고 뒤에 다시 붙인다(번호는 앞의 마지막 번호 다음부터).
  const mapPath = resolve(here, 'slice-map.csv');
  const rows = readFileSync(mapPath, 'utf8').replace(/\n+$/, '').split('\n').filter(r => !/^"3[678][a-e]-/.test(r));
  let no = Math.max(...rows.slice(1).map(r => Number(r.split(',')[1]?.replace(/"/g, '')) || 0));
  const csv = v => `"${String(v).replace(/"/g, '""')}"`;
  for (const s of list) { no++; for (const c of s.cells) rows.push([s.file, String(no).padStart(3, '0'), s.title, c.cell, c.key, c.name, c.out].map(csv).join(',')); }
  writeFileSync(mapPath, rows.join('\n') + '\n');
  for (const series of [36, 37, 38]) writeFileSync(resolve(here, `CODEX_PROMPT_${series}.md`), codexPrompt(series, list));
  for (const series of [36, 37, 38]) { const l = list.filter(s => s.series === series); console.log(`${series}: ${l.length}시트 (${[...new Set(l.map(s => s.file))].map(f => `${f.slice(0, 3)} ${l.filter(s => s.file === f).length}`).join(' · ')})`); }
}
