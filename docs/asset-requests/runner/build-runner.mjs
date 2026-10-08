// SUMUS Prompt Runner용 프롬프트 목록 만들기 (ChatGPT 웹, 프롬프트 사이는 ---).
//   node docs/asset-requests/runner/build-runner.mjs
// 한 프롬프트 = 그림 4장(2×2 시트, 1024×1024). 받은 시트는 slice-map.csv대로 4칸으로 잘라 앱에 넣어요.
// 급한 순서: 01 가위바위보·로보 → 02 펫 표정 → 03 UI 아이콘·트로피 → 04 다시 만들 것 → 05 가위바위보 팔(만화 연출)
// → 06 로보 쉬움·보통 표정, 코인 뽑기 머신·캡슐, 알 반응 (Codex 작업: CODEX_PROMPT_06.md)
// → 07 전설 펫 4종(뽑기 전용): 07a 설정 시트(참고 그림 없이) → 단계별 참고 그림 → 07b 표정·알 반응.
import { writeFileSync, mkdirSync } from 'node:fs';
import { TITLES, TITLE_TIERS } from '../../../public/modules/titles.js';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const CELLS = ['TOP-LEFT', 'TOP-RIGHT', 'BOTTOM-LEFT', 'BOTTOM-RIGHT'];
const CELL_KO = ['왼쪽 위', '오른쪽 위', '왼쪽 아래', '오른쪽 아래'];

const SHEET = `Create ONE square image, 1024×1024 pixels, laid out as a 2×2 sprite sheet: four separate illustrations, one centered in each quarter (each quarter is 512×512). Leave generous empty space around every illustration so nothing touches or crosses the middle lines or the image edges. Use a real transparent background (PNG alpha) — do NOT paint a checkerboard, white box, grid lines, frames or borders. No text, no letters, no numbers, no labels, no watermark, no ground shadow. Do not ask me any questions; just generate the image.`;
const STYLE = {
  pet: 'Style: premium cute chibi fantasy pet, soft 3D-painted anime illustration, fluffy fur drawn with fine strands, soft pastel colors, big glossy eyes with white highlights, light pink blush, a thin warm golden-white rim light along the outline, clean soft shading. Every cell shows exactly the same character design (same colors, markings, proportions and accessories); only the pose and expression change. Full body, 3/4 view facing the viewer\'s right, feet near the bottom of the cell.',
  robot: 'Style: premium cute chibi 3D toy robot mascot, glossy white plastic armor with mint/teal (#2CC4A8) accents, soft studio lighting, gentle rim light, clean shading. Every cell shows exactly the same robot design; only the pose and face-screen change.',
  icon: 'Style: glossy 3D game UI icon, soft pastel palette with SUMUS mint green (#10B981) accents, chunky friendly shapes, clean edges readable at 48 pixels, one object per cell, slight top-down front view.',
  emblem: 'Style: shiny 3D game trophy/badge, metallic with soft gem highlights, symmetric, readable at 64 pixels, one object per cell.',
  egg: 'Style: premium cute 3D-painted game illustration, soft pastel colors, gentle warm rim light, clean soft shading. Each egg keeps exactly the shape, pattern, colors and nest (if it has one) of the reference picture; only its tilt and the effect around it change. Front view, the bottom of the egg (or its nest) near the bottom of the cell.',
  arm: 'Style: glossy 3D cartoon game art, chunky friendly shapes, bold clean outline, soft studio lighting with a gentle rim light, clean shading, the same look as cute 3D mobile-game hand icons. Side view. Every cell shows exactly the same arm (same length, thickness, colors and sleeve); only the hand changes. In every cell the arm lies HORIZONTALLY across the middle of the cell at the same height, about 80% of the cell width long, so the four arms can be swapped in place.'
};

const ROBO = 'The robot "로보": a chubby chibi robot about 2.3 heads tall. Round white helmet head with a large black glossy visor screen; the screen shows its face as glowing mint lines (default: happy ^ ^ eyes and a tiny pink tongue smile). A thin antenna on top ending in a glossy mint ball. Round mint ear-discs on both sides of the head. White rounded body with a glowing mint circular core on the chest, mint panel lines, chunky white arms with mint joints, chunky robot hands with five rounded fingers, short sturdy legs with mint knee pads. Faces the viewer.';

// 펫 설명 (그림을 보고 쓴 것) — 형태 1 아기, 2 성장, 3 최종.
const PETS = {
  dog: { ko: '몽이', base: 'a Shiba-like puppy with cream and soft golden-orange fur, white chest and muzzle, large pointed ears with pink insides, big glossy brown eyes, a huge fluffy curled tail', f: {
    1: 'baby stage: small, very round and fluffy, big head, no accessories',
    2: 'grown stage: a little taller and slimmer, wearing a green bandana scarf with a small gold star charm',
    3: 'final stage: larger and proud, wearing a flowing green cape with gold trim fastened by a gold star clasp, small white feathered angel wings, a few golden sparkles around' } },
  pig: { ko: '핑키', base: 'a round pastel-pink piglet with soft pink skin, small floppy ears with pink insides, a big round pink pig snout with two nostrils (the snout must stay visible in every cell, also in the sad one — never a small dog nose), big glossy brown eyes, a tiny curly tail', f: {
    1: 'baby stage: small, very round, no accessories',
    2: 'grown stage: a little bigger, wearing a green scarf with a small gold star charm',
    3: 'final stage: wearing a green cape with a gold star clasp, small white feathered wings, a soft golden sparkle aura' } },
  cat: { ko: '나비', base: 'a silver-grey tabby cat with darker grey stripes, white chest, white paws and white muzzle, pink ear insides, big glossy amber eyes, a fluffy striped tail', f: {
    1: 'baby stage: small, round and fluffy, sitting-size proportions, no accessories',
    2: 'grown stage: a slim young cat (NOT a round kitten) with a longer body, long legs, upright pointed ears and a long thin striped tail curling up, a small gold star charm on the chest',
    3: 'final stage: a tall, slender, elegant adult cat with long legs and long flowing silky fur edged in a soft golden glow, a huge plume-like fluffy tail, a gold star charm, golden sparkles (NOT a round kitten)' } },
  dragon: { ko: '용이', base: 'a fluffy white dragon with pastel aqua-blue scales along the spine, tail and paws, small curved golden horns, aqua ear fins, big glossy sky-blue eyes', f: {
    1: 'baby stage: small and round, tiny wing nubs, no accessories',
    2: 'grown stage: a young dragon with a longer body and neck, standing on four legs, LARGE translucent pastel-blue bat-like wings raised behind it, a long scaled tail, a small gold star on the chest (NOT a round baby)',
    3: 'final stage: a majestic dragon with a long graceful body, VERY LARGE wide translucent blue wings edged in gold spread behind it, a golden crest, a long tail full of aqua scales, a gold star on the chest, golden sparkles (NOT a round baby)' } },
  panda: { ko: '밤부', base: 'a panda with very dark brown and white fur, dark eye patches, round dark ears, big glossy brown eyes, pink paw pads', f: {
    1: 'baby stage: small and round, holding a few green bamboo leaves',
    2: 'grown stage: a bigger, sturdier young panda with longer legs (NOT a round sitting cub), a garland of green bamboo leaves around the neck with a gold star',
    3: 'final stage: a large proud panda with a strong body and long legs, a bamboo-leaf crown with a gold star, glowing golden leaf patterns painted on its dark legs, soft golden sparkles (NOT a round cub)' } },
  snake: { ko: '초롱', base: 'a cute little snake with a cream belly and green leaf-shaped scales, a crest of leafy green "hair" on the head, big glossy green eyes, coiled body', f: {
    1: 'baby stage: short, chubby coil, small leaf crest',
    2: 'grown stage: longer S-shaped coil, more leaves along the back',
    3: 'final stage: a long, slender, elegant serpent rising tall in several graceful coils, a longer face, glowing golden-green leaf scales and a fuller leafy crest, golden sparkles (NOT a short chubby coil)' } },
  rabbit: { ko: '토리', base: 'a white bunny with soft pastel-pink petal-like patches on the fur, very long ears with pink insides, big glossy dark ruby eyes, a fluffy round tail', f: {
    1: 'baby stage: small and round with floppy long ears, no accessories',
    2: 'grown stage: slimmer and taller, upright ears, pink petal patches on the legs and tail',
    3: 'final stage: elegant with flowing pink petal-like fur on chest and tail, soft golden sparkles' } },
  fox: { ko: '호야', base: 'a bright orange fox with a white chest, white muzzle and white tail tip, flame-like golden fur accents, dark brown paws, pointed ears with dark tips, big glossy amber eyes, a big fluffy tail', f: {
    1: 'baby stage: small and round, sitting-size proportions, no accessories',
    2: 'grown stage: sleeker, flame-shaped golden fur patterns, a small gold star',
    3: 'final stage: majestic with a huge fluffy tail and glowing golden flame fur, a gold star, golden sparkles' } }
};
const FORM_KO = { 1: '아기', 2: '성장', 3: '최종' };
const EXPRS = [
  ['happy', '기뻐함', 'HAPPY: eyes closed in a big happy smile, rosy cheeks, two or three small pink hearts floating above the head'],
  ['eat', '냠냠', 'EATING: happily eating from a small round mint food bowl held in front, cheeks puffed, a few crumbs, eyes curved in joy'],
  ['sad', '시무룩', 'SAD: slightly sad pouty face with teary sparkling eyes, ears and head drooping a little, still cute (not crying hard); keep the same nose/snout, ears and markings as the other cells'],
  ['cheer', '응원', 'CHEERING: energetic pose with one front paw (or the tail tip for the snake) raised high, determined sparkling eyes, small motion sparkles']
];

const prompts = [];
const slices = [];
function sheet(file, title, styleKey, subject, cells) {
  const no = prompts.length + 1;
  const ref = styleKey === 'pet' || styleKey === 'robot' ? 'If a reference picture of this character was attached earlier in this conversation, match its face, colors and markings exactly.' : '';
  const stage = styleKey === 'pet' && /stage/.test(subject || '') && !/baby stage/.test(subject || '') ? 'IMPORTANT: draw this exact growth stage in every cell, with its full body size, proportions and accessories. Do not draw the younger baby version, and do not make it rounder, shorter or chubbier when it sits, eats or is sad.' : '';
  const lines = [SHEET, STYLE[styleKey], subject && `Subject: ${subject}`, ref, stage, ...cells.map((c, i) => `${CELLS[i]} cell: ${c[2]}`)].filter(Boolean);
  prompts.push({ file, no, title, text: lines.join('\n') });
  cells.forEach((c, i) => slices.push({ file, no, title, cell: CELL_KO[i], key: c[0], name: c[1], out: c[3] }));
}

/* 01 가위바위보 · 로보 (지금 앱에서 이모지로 보이는 자리) */
const F1 = '01-urgent-rps-robot.txt';
sheet(F1, '로보 가위바위보 손', 'robot', ROBO, [
  ['robot-rps-rock', '로보 바위', 'ROCK: the robot thrusts one closed fist forward toward the viewer, the fist large in the foreground, determined face screen (> < focused eyes), small speed lines', 'public/assets/rps/robot-rock.webp'],
  ['robot-rps-scissors', '로보 가위', 'SCISSORS: the robot holds one hand forward making a V-sign (two fingers up), cheeky winking face screen, small sparkle', 'public/assets/rps/robot-scissors.webp'],
  ['robot-rps-paper', '로보 보', 'PAPER: the robot pushes one open palm forward with all five fingers spread, surprised-cheerful face screen (o o eyes), small sparkle', 'public/assets/rps/robot-paper.webp'],
  ['robot-rps-ready', '로보 준비', 'READY: the robot holds one fist raised high beside its head, shaking it ("rock, paper, scissors!"), excited face screen, curved motion lines around the fist', 'public/assets/rps/robot-ready.webp']
]);
sheet(F1, '로보 반응', 'robot', ROBO, [
  ['robot-react-win', '로보 이김', 'ROBOT WINS: proud victory pose, one hand on hip and one hand making a V-sign, face screen shows smug happy ^ ^ eyes and a grin, small gold sparkles', 'public/assets/rps/robot-win.webp'],
  ['robot-react-lose', '로보 짐', 'ROBOT LOSES: slumped and dizzy, face screen shows spiral swirl eyes, a small grey puff of smoke from the antenna ball, one hand on the head', 'public/assets/rps/robot-lose.webp'],
  ['robot-react-shock', '로보 대충격(×8)', 'ROBOT IN SHOCK: leaning backward with both hands up, face screen glitching with X X eyes and a few pixel-noise blocks, small electric sparks around the antenna, comic but cute', 'public/assets/rps/robot-shock.webp'],
  ['robot-react-think', '로보 고민', 'ROBOT THINKING: one hand on its chin, head tilted, face screen shows three glowing mint dots in a row and one raised eyebrow line, a small question-mark-like swirl of light above the head', 'public/assets/rps/robot-think.webp']
]);
sheet(F1, '가위바위보 손 메달 + VS', 'icon', null, [
  ['rps-rock', '바위 메달', 'a round glossy RED badge (coral-red #FF6B6B rim) with a cute cartoon closed fist in a warm peach skin tone in the middle, slight 3D bulge', 'public/assets/rps/hand-rock.webp'],
  ['rps-scissors', '가위 메달', 'a round glossy BLUE badge (sky-blue #4DABF7 rim) with a cute cartoon hand making a V-sign (scissors) in a warm peach skin tone in the middle', 'public/assets/rps/hand-scissors.webp'],
  ['rps-paper', '보 메달', 'a round glossy GREEN badge (green #51CF66 rim) with a cute cartoon open palm, five fingers spread (paper), in a warm peach skin tone in the middle', 'public/assets/rps/hand-paper.webp'],
  ['rps-vs', 'VS 충돌', 'a clash emblem: two cartoon fists bumping together in the middle with a big yellow-white starburst and small sparks, gold and white, no letters', 'public/assets/rps/clash.webp']
]);
sheet(F1, '로보 야차전 연습 대결', 'robot', ROBO, [
  ['robot-attack', '로보 공격', 'ATTACK: a dynamic forward punch with a glowing mint energy trail behind the fist, focused face screen', 'public/assets/pets/robot-3-attack.webp'],
  ['robot-hurt', '로보 맞음', 'HIT: flinching backward with one arm raised to block, face screen shows > < eyes, a few small white impact stars', 'public/assets/pets/robot-3-hurt.webp'],
  ['robot-happy', '로보 기쁨', 'HAPPY: jumping with both arms up, face screen shows big happy ^ ^ eyes and a wide smile, small hearts', 'public/assets/pets/robot-3-happy.webp'],
  ['robot-sad', '로보 시무룩', 'SAD: sitting slumped, face screen shows teary droopy eyes, antenna ball drooping and dim', 'public/assets/pets/robot-3-sad.webp']
]);

/* 02 펫 표정 (교감 반응 · 야차전 승패) — 펫 8종 × 형태 3 × 표정 4 */
const F2 = '02-pet-expressions.txt';
for (const [key, pet] of Object.entries(PETS)) for (const form of [1, 2, 3]) {
  sheet(F2, `${pet.ko} ${FORM_KO[form]} 표정`, 'pet', `${pet.ko}, ${pet.base}. This is the ${pet.f[form]}.`,
    EXPRS.map(([expr, ko, text]) => [`${key}-${form}-${expr}`, `${pet.ko} ${FORM_KO[form]} ${ko}`, text, `public/assets/pets/${key}-${form}-${expr}.webp`]));
}

/* 04 다시 만들 것 (v13.83 점검): 성장·최종이 아기 몸으로 나온 시트, 핑키 시무룩, 아직 없는 토리·호야 */
const F4 = '04-redo-and-missing.txt';
const pet4 = (key, form, exprs = EXPRS) => { const pet = PETS[key];
  sheet(F4, `${pet.ko} ${FORM_KO[form]} 표정(다시)`, 'pet', `${pet.ko}, ${pet.base}. This is the ${pet.f[form]}.`,
    exprs.map(([expr, ko, text]) => [`${key}-${form}-${expr}`, `${pet.ko} ${FORM_KO[form]} ${ko}`, text, `public/assets/pets/${key}-${form}-${expr}.webp`])); };
for (const [key, form] of [['cat', 2], ['cat', 3], ['dragon', 2], ['dragon', 3], ['panda', 2], ['panda', 3], ['snake', 3]]) pet4(key, form);
{ const sad = EXPRS.find(e => e[0] === 'sad'), pig = PETS.pig;
  sheet(F4, '핑키 시무룩 3단계(다시)', 'pet', `${pig.ko}, ${pig.base}. Draw the SAD pose of its three growth stages, one per cell: TOP-LEFT the ${pig.f[1]}; TOP-RIGHT the ${pig.f[2]}; BOTTOM-LEFT the ${pig.f[3]}; leave the BOTTOM-RIGHT cell empty.`,
    [1, 2, 3].map(form => [`pig-${form}-sad`, `핑키 ${FORM_KO[form]} 시무룩`, `${FORM_KO[form] === '아기' ? 'baby' : FORM_KO[form] === '성장' ? 'grown' : 'final'} stage: ${sad[2]}`, `public/assets/pets/pig-${form}-sad.webp`]).concat([['-', '(비움)', 'EMPTY: leave this cell completely empty and transparent', '']])); }
for (const key of ['rabbit', 'fox']) for (const form of [1, 2, 3]) pet4(key, form);

/* 03 UI 아이콘 · 시즌 트로피 (지금 이모지 자리) */
const F3 = '03-ui-icons-trophies.txt';
const ICONS = [
  ['care-feed', '밥 주기', 'a round mint pet food bowl piled with kibble and a small bone-shaped cookie, a little steam'],
  ['care-pet', '쓰다듬기', 'one soft round open palm with two small pink hearts and curved petting motion lines'],
  ['care-warm', '알 데워주기', 'a cream egg wrapped in a cozy mint blanket with a tiny warm sun glow'],
  ['notice', '선생님 공지', 'a mint megaphone with small sparkles'],
  ['bell', '알림', 'a golden bell with a small paw print on it, two ringing lines'],
  ['star-word', '어려운 단어', 'a chubby golden star badge with a soft shine'],
  ['stopwatch', '실전 시간', 'a mint stopwatch with motion lines on the hand'],
  ['leave-warn', '화면 이탈', 'an orange smartphone with a small cute exclamation sign, friendly warning'],
  ['coin', '코인', 'a shiny gold coin with a mint swirl engraved in the middle (no letters)'],
  ['xp', '경험치', 'a glowing mint crystal shard with sparkles'],
  ['attendance', '출석', 'a calendar page with a big mint check-mark stamp (no numbers)'],
  ['gift', '선물 상자', 'a pastel gift box with a mint ribbon, lid slightly lifted with sparkles'],
  ['egg-shop', '알 상점', 'a small shop stand with three colorful eggs on a cushion'],
  ['streak', '연속 학습', 'a friendly orange flame with a tiny smile'],
  ['install', '앱 설치', 'a smartphone with a mint app icon popping out and a small download arrow'],
  ['arcade', '놀이터', 'a small mint arcade cabinet with a glowing screen and a joystick']
];
for (let i = 0; i < ICONS.length; i += 4) {
  const group = ICONS.slice(i, i + 4);
  sheet(F3, `UI 아이콘 ${i / 4 + 1}`, 'icon', null, group.map(([key, ko, desc]) => [`ui-${key}`, ko, desc, `public/assets/ui/${key}.webp`]));
}
sheet(F3, '시즌 트로피', 'emblem', 'season-end league trophies of the same cup shape: a chubby cup on a short stem and a round base, two small wings on the sides, a gem in the middle of the cup.', [
  ['season-bronze', '시즌 트로피 브론즈', 'BRONZE finish trophy with a warm amber gem', 'public/assets/ui/season-bronze.webp'],
  ['season-silver', '시즌 트로피 실버', 'SILVER finish trophy with a pale blue gem', 'public/assets/ui/season-silver.webp'],
  ['season-gold', '시즌 트로피 골드', 'GOLD finish trophy with a ruby gem and a few sparkles', 'public/assets/ui/season-gold.webp'],
  ['season-diamond', '시즌 트로피 다이아', 'DIAMOND trophy made of shimmering pale cyan crystal with rainbow glints and a large faceted gem', 'public/assets/ui/season-diamond.webp']
]);

/* 05 가위바위보 팔 (만화 연출: 화면 양쪽 끝에서 팔이 들어와 가운데에서 맞부딪힘) */
const F5 = '05-rps-arms.txt';
const ROBO_ARM = 'the robot "로보"\'s right forearm and hand only (no body, no shoulder): glossy white plastic armor with mint/teal (#2CC4A8) panel lines, a round mint elbow joint at the LEFT end where the arm starts, a glowing mint ring around the wrist, a chunky white robot hand with five rounded fingers and mint finger joints. The arm comes from the LEFT and the hand points to the RIGHT (toward the opponent).';
const KID_ARM = 'a child\'s forearm and hand only (no body, no shoulder): warm peach skin with soft pink knuckles, chubby friendly fingers, wearing a mint green (#10B981) sporty jacket sleeve with a white stripe and a white ribbed cuff; the sleeve ends cleanly at the RIGHT edge of the drawing where the arm starts. The arm comes from the RIGHT and the hand points to the LEFT (toward the opponent).';
sheet(F5, '로보 팔 (왼쪽에서 들어옴)', 'arm', ROBO_ARM, [
  ['arm-robot-rock', '로보 팔 바위', 'ROCK: a tight closed fist, knuckles facing right toward the opponent, small speed lines behind the fist', 'public/assets/rps/arm-robot-rock.webp'],
  ['arm-robot-scissors', '로보 팔 가위', 'SCISSORS: index and middle fingers stretched straight forward to the right in a V shape, the other fingers folded', 'public/assets/rps/arm-robot-scissors.webp'],
  ['arm-robot-paper', '로보 팔 보', 'PAPER: an open flat hand, all five fingers stretched straight forward to the right and slightly spread, palm facing down', 'public/assets/rps/arm-robot-paper.webp'],
  ['arm-robot-flag', '로보 팔 항복', 'GIVE UP: the hand holds a small white flag on a short stick, the flag waving, a tiny sweat drop (used when 로보 loses big)', 'public/assets/rps/arm-robot-flag.webp']
]);
sheet(F5, '내 팔 (오른쪽에서 들어옴)', 'arm', KID_ARM, [
  ['arm-me-rock', '내 팔 바위', 'ROCK: a tight closed fist, knuckles facing left toward the opponent, small speed lines behind the fist', 'public/assets/rps/arm-me-rock.webp'],
  ['arm-me-scissors', '내 팔 가위', 'SCISSORS: index and middle fingers stretched straight forward to the left in a V shape, the other fingers folded', 'public/assets/rps/arm-me-scissors.webp'],
  ['arm-me-paper', '내 팔 보', 'PAPER: an open flat hand, all five fingers stretched straight forward to the left and slightly spread, palm facing down', 'public/assets/rps/arm-me-paper.webp'],
  ['arm-me-thumb', '내 팔 엄지척', 'THUMBS UP: a fist with the thumb pointing straight up, a few small sparkles (used when taking the coins)', 'public/assets/rps/arm-me-thumb.webp']
]);

/* 06 로보 쉬움·보통 표정 · 코인 뽑기 머신과 캡슐 · 알 반응 (Codex: CODEX_PROMPT_06.md) */
const F6 = '06-robot-lucky-eggs.txt';
const ROBO_FORM = {
  1: 'The robot "로보" in its smallest BABY form (yacha practice 쉬움): a tiny round chibi robot about 1.6 heads tall. A big round white helmet head with a large black glossy visor screen; the screen shows its face as glowing mint lines (default: happy ^ ^ eyes and a tiny pink tongue smile). A thin antenna with a glossy mint ball, round mint ear-discs, a small round white body with a glowing mint core on the chest, short stubby arms and legs with mint joints. NO shoulder spikes and NO armor plates (that is the final form). Faces the viewer.',
  2: 'The robot "로보" in its MIDDLE form (yacha practice 보통): the same face, antenna and ear-discs as the baby form, about 1.8 heads tall, a slightly bigger rounded white body with more mint panel lines, chunkier arms and legs with mint knee pads. Still round and cute: NO shoulder spikes and NO big armor (that is the final form). Faces the viewer.'
};
const ROBO_POSES = [
  ['attack', '공격', 'ATTACK: a dynamic forward punch with a glowing mint energy trail behind the fist, focused face screen'],
  ['hurt', '맞음', 'HIT: flinching backward with one arm raised to block, face screen shows > < eyes, a few small white impact stars'],
  ['happy', '기쁨', 'HAPPY: jumping with both arms up, face screen shows big happy ^ ^ eyes and a wide smile, small hearts'],
  ['sad', '시무룩', 'SAD: sitting slumped, face screen shows teary droopy eyes, antenna ball drooping and dim']
];
for (const form of [1, 2]) sheet(F6, `로보 ${form === 1 ? '쉬움(아기)' : '보통(성장)'} 야차전 동작`, 'robot', ROBO_FORM[form],
  ROBO_POSES.map(([key, ko, text]) => [`robot-${form}-${key}`, `로보 ${form === 1 ? '쉬움' : '보통'} ${ko}`, text, `public/assets/pets/robot-${form}-${key}.webp`]));
const MACHINE = 'a cute capsule toy machine (gachapon) seen straight from the front, taller than wide (about 3:4): a big round clear glass dome on top filled with colorful two-tone capsules (pink, sky-blue, yellow, mint, lavender), a row of small round light bulbs along the bottom rim of the dome, a chunky pastel coral-pink base with rounded corners and mint trim, a small golden coin slot on the FRONT RIGHT of the base, a round white dial with an orange handle in the FRONT CENTER of the base, and a dark rounded capsule chute opening at the BOTTOM CENTER of the base';
const CAPSULE = 'the same round toy capsule in every capsule cell: the top half is glossy with pastel rainbow stripes (pink, yellow, mint, sky-blue, lavender), the bottom half is glossy white, a thin lavender band where the halves meet';
sheet(F6, '코인 뽑기 머신', 'icon', null, [
  ['lucky-machine', '뽑기 머신', `MACHINE: ${MACHINE}; the bulbs are softly lit`, 'public/assets/lucky/machine.webp'],
  ['lucky-machine-lit', '뽑기 머신(번쩍)', `MACHINE LIT UP: exactly the same machine, same size and position, but every bulb shines bright yellow, the dome glows with a soft golden light and a few sparkles pop around it`, 'public/assets/lucky/machine-lit.webp'],
  ['lucky-ticket', '뽑기권', 'TICKET: a golden admission ticket with notched edges and a small capsule picture printed in the middle, slightly tilted, no letters', 'public/assets/lucky/ticket.webp'],
  ['lucky-jackpot', '잭팟', 'JACKPOT: an opened toy capsule with a fountain of shiny gold coins bursting out of it, golden rays behind, sparkles, no letters', 'public/assets/lucky/jackpot.webp']
]);
sheet(F6, '코인 뽑기 캡슐', 'icon', `Every capsule cell shows ${CAPSULE}. Draw all capsule parts at the same size, as if cut from one capsule.`, [
  ['lucky-capsule', '캡슐(닫힘)', 'CLOSED: the whole closed capsule, round, front view, a small white shine on the top half', 'public/assets/lucky/capsule.webp'],
  ['lucky-capsule-top', '캡슐 위 뚜껑', 'TOP HALF ONLY: just the striped top half of the capsule (a dome), its open flat side facing DOWN, nothing else', 'public/assets/lucky/capsule-top.webp'],
  ['lucky-capsule-bottom', '캡슐 아래', 'BOTTOM HALF ONLY: just the white bottom half of the capsule (a bowl), its open flat side facing UP, empty, nothing else', 'public/assets/lucky/capsule-bottom.webp'],
  ['lucky-miss', '꽝', 'MISS: the capsule opened and EMPTY, both halves tilted apart, a small grey puff of smoke and one tiny sweat drop, comic but cute, no letters', 'public/assets/lucky/miss.webp']
]);
const EGG = {
  dog: 'a cream egg with a yellow zigzag band around the middle, yellow dots, a small green leaf sprout and a gold star on top (no nest)',
  pig: 'a cream egg with a pink zigzag band, pink dots, a pink pig snout on the lower half, a small green leaf sprout and a gold star on top (no nest)',
  cat: 'a cream egg with grey paw prints and a small gold star, sitting in a woven straw nest with green leaves and white flowers',
  dragon: 'a cream egg with pale blue scale-like leaf patterns and a gold star, sitting in a woven straw nest with green leaves and white flowers',
  panda: 'a cream egg with dark brown paw prints and a gold star, sitting in a woven straw nest with green leaves and white flowers',
  snake: 'a cream egg with a green vine swirl pattern and a gold star, sitting in a woven straw nest with green leaves and white flowers',
  rabbit: 'a cream egg with pink bunny silhouettes and a gold star, sitting in a woven straw nest with green leaves and white flowers',
  fox: 'a cream egg with orange flame-like leaf patterns and a gold star, sitting in a woven straw nest with green leaves and white flowers'
};
const EGG_HAPPY = 'PETTED (기뻐함): the egg tilts to one side as if wiggling happily, two short curved motion lines on each side, three small pink hearts floating above. Do NOT crack the egg and do NOT give it a face.';
const EGG_WARM = 'WARMED (따뜻해짐): the egg glows with a soft warm orange-golden aura, three small wavy heat lines rising above it, a few tiny golden sparkles. Do NOT crack the egg, do NOT give it a face, no fire.';
for (const [a, b] of [['dog', 'pig'], ['cat', 'dragon'], ['panda', 'snake'], ['rabbit', 'fox']]) {
  sheet(F6, `${PETS[a].ko} · ${PETS[b].ko} 알 반응`, 'egg', `two pet eggs (the reference picture shows them side by side). The TOP row cells show ${PETS[a].ko}'s egg: ${EGG[a]}. The BOTTOM row cells show ${PETS[b].ko}'s egg: ${EGG[b]}.`, [
    [`${a}-0-happy`, `${PETS[a].ko} 알 기뻐함`, EGG_HAPPY, `public/assets/pets/${a}-0-happy.webp`],
    [`${a}-0-eat`, `${PETS[a].ko} 알 따뜻해짐`, EGG_WARM, `public/assets/pets/${a}-0-eat.webp`],
    [`${b}-0-happy`, `${PETS[b].ko} 알 기뻐함`, EGG_HAPPY, `public/assets/pets/${b}-0-happy.webp`],
    [`${b}-0-eat`, `${PETS[b].ko} 알 따뜻해짐`, EGG_WARM, `public/assets/pets/${b}-0-eat.webp`]
  ]);
}

/* 07 전설 펫 4종 (코인 뽑기에서만 나와요). 처음 그리는 캐릭터라 두 번에 나눠요.
   07a: 펫마다 설정 시트(알 · 아기 · 성장 · 최종)와 공용 전설 알 연출. 참고 그림 없이 새 대화에서.
   07b: 07a를 잘라 만든 단계별 참고 그림(ref-<펫>-<단계>.png)을 올리고 표정 4개씩, 알 반응. */
const F7A = '07a-legend-design.txt', F7B = '07b-legend-expressions.txt';
const LEGENDS = {
  haechi: { ko: '해치', base: 'a Korean mythical guardian beast "haechi": a chubby lion-dog with fluffy cream-white fur, a soft jade-green curly mane and tail tip shaped like little clouds, one small jade horn on the forehead, a tiny golden bell on a red cord collar, big glossy amber eyes, pink blush', egg: 'a large pearl-white egg with jade-green cloud swirl patterns, a tiny golden bell charm and a small glowing jade gem on top, resting on a small golden cloud cushion', f: {
    1: 'baby stage: small, very round and fluffy, sitting, a tiny nub of a horn, the mane only a few small cloud curls',
    2: 'grown stage: bigger and standing on four legs, a fuller cloud-shaped jade mane, jade swirl markings on the legs, a longer horn (NOT a round sitting baby)',
    3: 'final stage: a majestic guardian standing proud, a large flowing cloud mane edged in gold, golden swirl markings, a glowing jade horn, soft golden clouds swirling around its paws, a few sparkles (NOT a round baby)' } },
  phoenix: { ko: '불새', base: 'a mythical firebird (phoenix): warm scarlet, orange and gold feathers, a curled golden crest of feathers on the head, a small red diamond gem on the forehead, long tail feathers tipped with soft flame-like gold, a small golden beak, big glossy dark eyes, pink blush; cute and friendly, not scary', egg: 'a large egg with a scarlet-to-gold gradient, flame-feather patterns and a small golden crown motif, softly glowing, resting in a little nest of golden feathers', f: {
    1: 'baby stage: a small round fluffy chick, tiny wings, a short tail with one flame feather, sitting',
    2: 'grown stage: a slimmer young bird with a longer neck, bigger folded wings and two long tail plumes, standing (NOT a round chick)',
    3: 'final stage: a majestic phoenix with wide spread flame-gold wings, long trailing tail plumes with golden eye-spots like a peacock, a crown of feathers, a few tiny floating embers and sparkles (NOT a round chick)' } },
  whale: { ko: '별고래', base: 'a mythical star whale that swims in the night sky: a deep indigo-blue back and a soft lavender belly, constellation patterns of tiny glowing stars on its back, rounded fins, a little spout of stardust, big glossy eyes, pink blush; it floats in the air', egg: 'an egg like a night sky: deep indigo with sparkling star dots and a small golden crescent moon, resting on a small soft cloud', f: {
    1: 'baby stage: a small round chubby baby whale with tiny fins, floating',
    2: 'grown stage: a longer young whale with wavy fins, more constellation stars and a soft aurora ribbon trailing behind (NOT a round baby)',
    3: 'final stage: a majestic star whale with a long graceful body, flowing translucent fins like a nebula, a glowing star crown, an aurora trail and two tiny planets orbiting it (NOT a round baby)' } },
  qilin: { ko: '기린', base: 'an East Asian mythical qilin (a gentle unicorn-like beast): a deer-like body with soft white fur, an iridescent pastel rainbow mane and tail (pink, mint, lavender, gold), little mint-and-gold scales along the back and legs, small golden ornaments on the forehead and legs, one golden spiral horn, golden hooves, big glossy violet eyes, pink blush', egg: 'a pearl egg with an iridescent rainbow scale pattern and a small golden spiral-horn motif on top, resting on a soft pastel cloud', f: {
    1: 'baby stage: a small round fawn-like baby, sitting, a nub of a horn, a tiny rainbow tuft',
    2: 'grown stage: a slender young qilin standing on long legs, a longer rainbow mane, more mint scales (NOT a round sitting baby)',
    3: 'final stage: a majestic qilin with a flowing silky rainbow mane, a glowing spiral horn, golden cloud-shaped flames around its hooves, sparkles (NOT a round baby)' } }
};
for (const [key, pet] of Object.entries(LEGENDS)) sheet(F7A, `${pet.ko} 설정 시트`, 'pet', `${pet.ko}, ${pet.base}. This is a LEGENDARY pet: a little more radiant than an ordinary pet, with a soft golden rim light. Draw the same character at four growth steps; each cell must clearly be the same creature, getting bigger and grander.`, [
  [`${key}-0`, `${pet.ko} 알`, `EGG: ${pet.egg}. Just the egg, no creature`, `public/assets/pets/${key}-0.webp`],
  [`${key}-1`, `${pet.ko} 아기`, `BABY: the ${pet.f[1]}, happy calm face, front 3/4 view`, `public/assets/pets/${key}-1.webp`],
  [`${key}-2`, `${pet.ko} 성장`, `GROWN: the ${pet.f[2]}, happy calm face, front 3/4 view`, `public/assets/pets/${key}-2.webp`],
  [`${key}-3`, `${pet.ko} 최종`, `FINAL: the ${pet.f[3]}, happy calm face, front 3/4 view`, `public/assets/pets/${key}-3.webp`]
]);
sheet(F7A, '전설 알 연출', 'icon', 'a LEGENDARY egg for a capsule-toy prize: the same egg in the first three cells — a large shiny golden egg with rainbow gem inlays and a laurel-leaf band around the middle.', [
  ['legend-egg', '전설 알', 'IDLE: the golden legendary egg floating, a soft rainbow halo behind it, a few sparkles', 'public/assets/lucky/legend-egg.webp'],
  ['legend-egg-glow', '전설 알(빛남)', 'ABOUT TO HATCH: the same egg shaking and glowing brighter, thin cracks of rainbow light running over the shell, motion lines', 'public/assets/lucky/legend-egg-glow.webp'],
  ['legend-egg-burst', '전설 알(깨짐)', 'BURST: the egg breaking open, the top shell flying up, beams of rainbow light and sparkles pouring out, no creature visible', 'public/assets/lucky/legend-egg-burst.webp'],
  ['legend-badge', '전설 배지', 'BADGE: a round legendary emblem in rainbow and gold with small wings on both sides and a star in the middle, no letters', 'public/assets/lucky/legend-badge.webp']
]);
// The firebird has wings and the whale fins: the poses say paw, wing or fin.
const EXPRS_L = EXPRS.map(([e, ko, text]) => [e, ko, e === 'sad' ? 'SAD: slightly sad pouty face with teary sparkling eyes, ears, crest or fins drooping a little, still cute (not crying hard); keep the same face, horn or crest and markings as the other cells'
  : e === 'cheer' ? 'CHEERING: energetic pose with one front paw, wing or fin raised high, determined sparkling eyes, small motion sparkles'
  : e === 'eat' ? 'EATING: happily eating from a small round mint food bowl in front of it, cheeks puffed, a few crumbs, eyes curved in joy' : text]);
for (const [key, pet] of Object.entries(LEGENDS)) for (const form of [1, 2, 3]) {
  sheet(F7B, `${pet.ko} ${FORM_KO[form]} 표정`, 'pet', `${pet.ko}, ${pet.base}. This is the ${pet.f[form]}. A legendary pet: a soft golden rim light.`,
    EXPRS_L.map(([expr, ko, text]) => [`${key}-${form}-${expr}`, `${pet.ko} ${FORM_KO[form]} ${ko}`, text, `public/assets/pets/${key}-${form}-${expr}.webp`]));
}
for (const [a, b] of [['haechi', 'phoenix'], ['whale', 'qilin']]) {
  sheet(F7B, `${LEGENDS[a].ko} · ${LEGENDS[b].ko} 알 반응`, 'egg', `two legendary pet eggs (the reference picture shows them side by side). The TOP row cells show ${LEGENDS[a].ko}'s egg: ${LEGENDS[a].egg}. The BOTTOM row cells show ${LEGENDS[b].ko}'s egg: ${LEGENDS[b].egg}.`, [
    [`${a}-0-happy`, `${LEGENDS[a].ko} 알 기뻐함`, EGG_HAPPY, `public/assets/pets/${a}-0-happy.webp`],
    [`${a}-0-eat`, `${LEGENDS[a].ko} 알 따뜻해짐`, EGG_WARM, `public/assets/pets/${a}-0-eat.webp`],
    [`${b}-0-happy`, `${LEGENDS[b].ko} 알 기뻐함`, EGG_HAPPY, `public/assets/pets/${b}-0-happy.webp`],
    [`${b}-0-eat`, `${LEGENDS[b].ko} 알 따뜻해짐`, EGG_WARM, `public/assets/pets/${b}-0-eat.webp`]
  ]);
}

/* 09 새 기본 펫 8종 (07 전설 펫과 같은 2단계: 09a 설정 시트 → 잘라서 참고 그림 → 09b 표정) */
const F9A = '09a-new-pets-design.txt', F9B = '09b-new-pets-expressions.txt';
const NEW_PETS = {
  capybara: { ko: '유자', type: '카피바라', base: 'a chubby round capybara with warm caramel-brown fur, a blunt rounded snout, tiny round ears, small calm eyes with a sleepy happy look, pink blush, a little orange yuzu fruit with one green leaf resting on its head', egg: 'a warm caramel egg with darker brown spots and a small orange yuzu-fruit pattern, resting in a little nest of green leaves', f: {
    1: 'baby stage: small and very round, sitting, a tiny yuzu on the head, no other accessories',
    2: 'grown stage: bigger and longer, standing on four short legs, a green leaf scarf with a small gold star charm (NOT a round sitting baby)',
    3: 'final stage: large, calm and proud, a fluffy mint towel worn like a cape fastened with a gold star clasp, a crown of three little yuzu fruits with leaves, soft steam swirls and golden sparkles around (NOT a small baby)' } },
  penguin: { ko: '펭이', type: '펭귄', base: 'a chubby penguin with a navy-blue back and head, a white belly and face, a small orange beak and orange feet, big glossy dark eyes, pink blush, a soft sky-blue knitted scarf', egg: 'a pale ice-blue egg with white snowflake patterns, resting on a small block of ice', f: {
    1: 'baby stage: a small fluffy blue-grey chick covered in soft down, tiny flippers, the sky-blue scarf a little too big',
    2: 'grown stage: a taller, sleek young penguin standing upright, the sky-blue scarf with a small gold star charm (NOT a fluffy chick)',
    3: 'final stage: a tall proud emperor-style penguin with a golden-yellow neck patch, a long flowing sky-blue scarf, a small ice crown, snowflake sparkles around (NOT a fluffy chick)' } },
  owl: { ko: '올리', type: '부엉이', base: 'a round little owl with soft lavender-purple and cream feathers, big tufted ear feathers, a heart-shaped cream face, big glossy amber eyes behind small round golden glasses, a tiny beak, pink blush', egg: 'a lavender egg with cream crescent-moon and tiny closed-book patterns (no letters), resting in a small nest of twigs', f: {
    1: 'baby stage: a small round fluffy owlet, the golden glasses slightly too big for its face',
    2: 'grown stage: a bigger owl with neatly folded wings, a small mint scholar cap with a gold star tassel (NOT a round fluffy owlet)',
    3: 'final stage: a majestic wise owl with wide spread wings edged in gold, the scholar cap, a small glowing open book with blank pages floating beside it, golden sparkles (NOT a round owlet)' } },
  hamster: { ko: '쿠키', type: '햄스터', base: 'a tiny chubby hamster with golden-yellow and cream fur, a white belly, round pink ears, big glossy black eyes, very puffy cheeks, a tiny pink nose, pink blush', egg: 'a cream-yellow egg with small sunflower-seed patterns, resting in a nest of soft wood shavings', f: {
    1: 'baby stage: a very small round fluff ball, no accessories',
    2: 'grown stage: a bit bigger, standing on its hind legs holding a sunflower seed, a small green scarf with a gold star charm',
    3: 'final stage: bigger and proud, a sunflower crown, a little golden cape with a gold star clasp, golden sparkles (NOT a tiny fluff ball)' } },
  shark: { ko: '파도', type: '아기 상어', base: 'a cute shark with smooth sky-blue skin, a white belly, a rounded dorsal fin, a happy smile with tiny friendly rounded teeth (never scary), big glossy dark eyes, pink blush; it floats in the air as if swimming', egg: 'a sky-blue egg with white wave patterns, resting on a little cushion of sea foam next to a small shell', f: {
    1: 'baby stage: a small round chubby baby shark floating, tiny fins',
    2: 'grown stage: a longer, sleek young shark with a small mint scarf and a gold star charm, a few bubbles around (NOT a round baby)',
    3: 'final stage: a big majestic friendly shark with a flowing aqua wave-shaped cape, a small coral crown, bubbles and golden sparkles (NOT a round baby, still friendly)' } },
  alpaca: { ko: '몽글', type: '알파카', base: 'a fluffy alpaca with cloud-like white wool tinted soft lavender at the tips, a long neck, a cream face, small upright ears, big glossy dark eyes with long lashes, pink blush, a little rainbow pom-pom tassel by one ear', egg: 'a fluffy-looking white egg with lavender wool-swirl patterns, resting on a small pastel blanket', f: {
    1: 'baby stage: a small round ball of wool with short legs, sitting',
    2: 'grown stage: taller with a long neck, standing on four legs, a woven mint scarf with a gold star charm (NOT a round sitting baby)',
    3: 'final stage: a grand alpaca with an enormous cloud-like fluffy mane, a colorful woven poncho with gold trim, little pom-pom flowers, golden sparkles (NOT a small baby)' } },
  hedgehog: { ko: '도치', type: '고슴도치', base: 'a tiny round hedgehog with soft beige-brown spines (rounded and soft-looking, not sharp), a cream face and belly, small round ears, big glossy dark eyes, a little pink nose, pink blush, a small red apple stuck on its back spines', egg: 'a beige egg covered in soft rounded spike bumps, resting in a nest of autumn leaves', f: {
    1: 'baby stage: a tiny round ball, the apple very small',
    2: 'grown stage: bigger, standing on its hind legs, a small green scarf with a gold star charm, the red apple on its back',
    3: 'final stage: bigger and proud, the spines tipped with gold, a crown of autumn leaves, a little golden cape, golden sparkles (NOT a tiny ball)' } },
  otter: { ko: '달이', type: '수달', base: 'a sleek little otter with glossy chocolate-brown fur, a cream face and belly, small round ears, whiskers, big glossy dark eyes, pink blush, holding a small pink seashell', egg: 'a chocolate-brown egg with cream wave stripes and a small pink seashell motif, resting on smooth river stones', f: {
    1: 'baby stage: a small round baby otter floating on its back, hugging the pink shell',
    2: 'grown stage: a longer young otter standing on its hind legs, a mint scarf with a gold star charm, holding the shell (NOT a round baby)',
    3: 'final stage: a grand otter with a flowing river-blue cape with gold trim, holding a shining pearl in an open shell, water-drop sparkles (NOT a round baby)' } }
};
for (const [key, pet] of Object.entries(NEW_PETS)) sheet(F9A, `${pet.ko} ${pet.type} 설정 시트`, 'pet', `${pet.ko}, ${pet.base}. Draw the same character at four growth steps; each cell must clearly be the same creature, getting bigger and grander.`, [
  [`${key}-0`, `${pet.ko} 알`, `EGG: ${pet.egg}. Just the egg, no creature`, `public/assets/pets/${key}-0.webp`],
  [`${key}-1`, `${pet.ko} 아기`, `BABY: the ${pet.f[1]}, happy calm face, front 3/4 view`, `public/assets/pets/${key}-1.webp`],
  [`${key}-2`, `${pet.ko} 성장`, `GROWN: the ${pet.f[2]}, happy calm face, front 3/4 view`, `public/assets/pets/${key}-2.webp`],
  [`${key}-3`, `${pet.ko} 최종`, `FINAL: the ${pet.f[3]}, happy calm face, front 3/4 view`, `public/assets/pets/${key}-3.webp`]
]);
// Wings, flippers and fins: the poses say so, and each pet keeps its own item.
const EXPRS_N = EXPRS.map(([e, ko, text]) => [e, ko, e === 'sad' ? 'SAD: slightly sad pouty face with teary sparkling eyes, ears, feathers or fins drooping a little, still cute (not crying hard); keep the same face, markings and item (fruit, glasses, scarf, apple or shell) as the other cells'
  : e === 'cheer' ? 'CHEERING: energetic pose with one front paw, wing, flipper or fin raised high, determined sparkling eyes, small motion sparkles'
  : e === 'eat' ? 'EATING: happily eating from a small round mint food bowl in front of it, cheeks puffed, a few crumbs, eyes curved in joy' : text]);
for (const [key, pet] of Object.entries(NEW_PETS)) for (const form of [1, 2, 3]) {
  sheet(F9B, `${pet.ko} ${FORM_KO[form]} 표정`, 'pet', `${pet.ko}, ${pet.base}. This is the ${pet.f[form]}.`,
    EXPRS_N.map(([expr, ko, text]) => [`${key}-${form}-${expr}`, `${pet.ko} ${FORM_KO[form]} ${ko}`, text, `public/assets/pets/${key}-${form}-${expr}.webp`]));
}
for (const [a, b] of [['capybara', 'penguin'], ['owl', 'hamster'], ['shark', 'alpaca'], ['hedgehog', 'otter']]) {
  sheet(F9B, `${NEW_PETS[a].ko} · ${NEW_PETS[b].ko} 알 반응`, 'egg', `two pet eggs (the reference picture shows them side by side). The TOP row cells show ${NEW_PETS[a].ko}'s egg: ${NEW_PETS[a].egg}. The BOTTOM row cells show ${NEW_PETS[b].ko}'s egg: ${NEW_PETS[b].egg}.`, [
    [`${a}-0-happy`, `${NEW_PETS[a].ko} 알 기뻐함`, EGG_HAPPY, `public/assets/pets/${a}-0-happy.webp`],
    [`${a}-0-eat`, `${NEW_PETS[a].ko} 알 따뜻해짐`, EGG_WARM, `public/assets/pets/${a}-0-eat.webp`],
    [`${b}-0-happy`, `${NEW_PETS[b].ko} 알 기뻐함`, EGG_HAPPY, `public/assets/pets/${b}-0-happy.webp`],
    [`${b}-0-eat`, `${NEW_PETS[b].ko} 알 따뜻해짐`, EGG_WARM, `public/assets/pets/${b}-0-eat.webp`]
  ]);
}

/* 08 메뉴 · 학습 화면 · 성취 배지 (선 아이콘과 이모지로 남아 있던 자리) */
const F8 = '08-menu-learning.txt';
const MENU = 'All icons in this set are one family (the same lighting, outline softness, color palette and level of detail), like the tab-bar icons of one premium mobile game. Keep every icon simple and bold so it stays clear at 28 pixels: big rounded shapes, at most three main colors, no thin lines, no tiny details. If a picture of earlier icons from this set was attached in this conversation, match its style exactly.';
const menu = (title, cells) => sheet(F8, title, 'icon', MENU, cells.map(([key, ko, desc]) => [`ui-${key}`, ko, desc, `public/assets/ui/${key}.webp`]));
menu('메뉴 아이콘 1 (하단 메뉴)', [
  ['nav-home', '하단 메뉴 홈', 'a small cozy house with a rounded mint roof, a round cream door and one warm yellow window'],
  ['nav-study', '하단 메뉴 학습', 'an open book with mint covers and a short yellow pencil lying across it'],
  ['nav-yacha', '하단 메뉴 야차전', 'two chunky cartoon swords crossed in an X with mint blades and gold handles, a small yellow lightning spark where they cross'],
  ['nav-arcade', '하단 메뉴 놀이터', 'a chunky handheld game controller in mint with one red round button and a yellow cross pad']
]);
menu('메뉴 아이콘 2 (나 · 나 화면 메뉴)', [
  ['nav-me', '하단 메뉴 나', 'a round friendly head-and-shoulders avatar bust of a child in a mint hoodie, simple happy face, no hair details'],
  ['me-pets', '내 펫·꾸미기', 'a big soft paw print in warm peach with a small pink bow ribbon on its top right'],
  ['me-ranking', '랭킹', 'a three-step winners podium in mint with a small golden crown floating above the tallest middle step'],
  ['me-titles', '칭호 도감', 'a chunky closed album book in lavender with a round gold medal and ribbon on its cover']
]);
menu('메뉴 아이콘 3 (나 화면 메뉴 · 야차전 방식)', [
  ['me-records', '내 기록', 'a mint clipboard with a white sheet showing a rising zigzag line graph and a small check mark'],
  ['me-settings', '계정·설정', 'a chunky rounded gear in soft gray-blue with a small mint circle in its center'],
  ['mode-speed', '스피드전', 'a bold yellow lightning bolt with short orange speed streaks behind it'],
  ['mode-skill', '실력전', 'a chunky mint pencil writing a short curved line next to a small red-and-white target']
]);
menu('메뉴 아이콘 4 (나 화면 메뉴)', [
  ['me-attendance', '출석 도장', 'a small mint calendar block with a big round red stamp mark pressed on it (no numbers)'],
  ['me-stars', '어려운 단어', 'a small stack of two word cards with a chubby golden star sticker on the top card (no letters)'],
  ['me-notify', '알림', 'a chunky golden bell with a mint bow on top and two short ringing curves'],
  ['me-install', '앱 설치', 'a chunky rounded smartphone in mint with a big white downward arrow on its screen']
]);
menu('메뉴 아이콘 5 (꾸미기 · 펫 잠금 · 빈 기록)', [
  ['me-gacha', '모은 꾸미기', 'a small round toy capsule half open with a pink ribbon and a tiny sparkle popping out'],
  ['pet-locked', '아직 못 만난 펫 (상점의 알)', 'a plain cream egg partly covered by a soft lavender cloth, a tiny sparkle, mysterious but friendly (no face, no question mark)'],
  ['pet-legend-locked', '아직 못 만난 전설 펫', 'a dark navy egg silhouette with a thin glowing golden outline and three tiny gold stars around it (no face, no question mark)'],
  ['empty-records', '아직 기록 없음', 'an empty mint clipboard with a small green sprout growing from its top clip']
]);
STYLE.scene = 'Style: premium cute 3D-painted mobile-game illustration, soft pastel colors with SUMUS mint green (#10B981) accents, gentle warm rim light, clean soft shading. One small object-group per cell (no characters, no scenery, no floor), slightly top-down front view, readable at 96 pixels, filling about 75% of its cell.';
sheet(F8, '학습 · 시험 카드 그림', 'scene', null, [
  ['ui-study-vocab', '단어 학습', 'a fan of three colorful word flash cards (blank, no letters) with a mint pencil and two small sparkles', 'public/assets/ui/study-vocab.webp'],
  ['ui-study-grammar', '어법·어휘', 'an open notebook with a few soft colored highlighter stripes on its pages (no readable text) and a mint highlighter pen lying on it', 'public/assets/ui/study-grammar.webp'],
  ['ui-exam-practice', '연습시험', 'a mint clipboard holding a sheet with three green check marks in a column and a short yellow pencil', 'public/assets/ui/exam-practice.webp'],
  ['ui-exam-test', '실전시험', 'an answer sheet with rows of round bubbles (a few filled in dark gray), a pencil, and a small round gold medal with a red ribbon on its corner', 'public/assets/ui/exam-test.webp']
]);
sheet(F8, '추천 학습 · 카드 외우기', 'scene', null, [
  ['ui-study-daily', '오늘의 추천 학습', 'a small stack of three books with a little mint flag planted on top and a warm small sun behind it', 'public/assets/ui/study-daily.webp'],
  ['ui-flash-deck', '카드로 외우기', 'a neat fan of three flash cards: each card is white on the top half and mint green on the bottom half (like a cover over the bottom), no letters', 'public/assets/ui/flash-deck.webp'],
  ['ui-flash-done', '다 외웠어요', 'the same white-and-mint flash cards tossed up joyfully with colorful confetti and a big round gold badge with a white check mark in front', 'public/assets/ui/flash-done.webp'],
  ['ui-word-empty', '빈 단어 목록', 'an empty woven basket in soft cream with a single small golden star resting beside it, calm and friendly', 'public/assets/ui/word-empty.webp']
]);
sheet(F8, '성취 배지', 'emblem', 'round achievement medals of the same shape and size: a thick round medal with a soft beveled rim and a short ribbon at the top.', [
  ['ui-badge-first100', '첫 100점', 'a GOLD medal with a big shining white star burst in the middle', 'public/assets/ui/badge-first100.webp'],
  ['ui-badge-streak90', '3회 연속 90점+', 'a SILVER medal with three small orange flames in a row rising from left to right', 'public/assets/ui/badge-streak90.webp'],
  ['ui-badge-english100', '영어쓰기 100점', 'a MINT-ENAMEL medal with a white fountain-pen nib in the middle and a few sparkles', 'public/assets/ui/badge-english100.webp'],
  ['ui-badge-master', '범위 MASTER', 'a PURPLE-GEM medal with a small golden crown above a golden laurel wreath', 'public/assets/ui/badge-master.webp']
]);

sheet(F8, '결과 도장', 'emblem', 'round result stamps of the same size, like a teacher\'s cute reward stamp: a thick round badge with a scalloped rim and a soft glossy finish (no letters, no numbers).', [
  ['ui-result-perfect', '결과 PERFECT (100점)', 'a GOLD scalloped stamp with a big shining star and a small crown on top, a few sparkles', 'public/assets/ui/result-perfect.webp'],
  ['ui-result-great', '결과 아주 잘했어요 (80점+)', 'a MINT scalloped stamp with a big white thumbs-up and two small stars', 'public/assets/ui/result-great.webp'],
  ['ui-result-good', '결과 잘했어요 (60점+)', 'a SKY-BLUE scalloped stamp with a big white smiling check mark', 'public/assets/ui/result-good.webp'],
  ['ui-result-retry', '결과 다시 도전 (60점 미만)', 'a soft PEACH scalloped stamp with a white curved arrow going around in a circle and a small heart', 'public/assets/ui/result-retry.webp']
]);
// V13.92: the pet dex tile and the 영웅 (epic) pets. Last in the list so 08-1~9 keep their numbers.
menu('메뉴 아이콘 6 (펫 도감 · 영웅 펫)', [
  ['me-petbook', '펫 도감', 'a chunky open picture book in soft peach showing a big paw print on the left page and a small egg on the right page, a tiny gold star bookmark (no letters)'],
  ['pet-epic-locked', '아직 못 만난 영웅 펫', 'a deep violet egg silhouette with a thin glowing lavender outline and three tiny silver stars around it (no face, no question mark)'],
  ['epic-egg', '영웅 알 (알 상점)', 'a glossy violet egg with a big white star on its front and small lilac star patterns, resting on a small round purple cushion with gold tassels, a few sparkles'],
  ['epic-badge', '영웅 배지', 'a shiny round violet gem badge with small silver wings on both sides and a white star in the middle, a soft lavender glow (no letters)']
]);

/* 10 몬스터 잡기 (V13.94): 몬스터 9종 × 기본·공격·맞음·쓰러짐 + 몬스터 화면 아이콘 */
const F10 = '10-monsters.txt';
STYLE.monster = 'Style: cute-but-mighty chibi 3D game monster for a teen vocabulary game, the same rendering quality as the pets of this game: bold readable silhouette, playful menace (never gory, never truly scary), glossy materials, crisp clean edges, clear saturated colors, strong soft rim light. Every cell shows exactly the same monster design (same colors, shape, size and accessories); only the pose and expression change. Full body, facing the viewer\'s LEFT (toward the player), centered, about 80% of the cell height, transparent background, no ground shadow, no text.';
const MONSTER_DESIGNS = [
  ['slime', '스펠링 슬라임', 'a wobbly jelly slime made of soft lime-green jelly with jumbled alphabet letter shapes floating inside (letters only as shapes, no readable words), two big silly eyes and a wide grin'],
  ['forgetghost', '까먹귀', 'a mischievous little lavender ghost holding a giant pink eraser, a trail of faded letter shapes behind it, cheeky closed-eye grin'],
  ['clock', '째깍 도둑', 'a sneaky round brass alarm-clock monster with a black bandit mask, clock hands as thin arms, a small sack of stolen minutes (glowing sand) on its back'],
  ['golem', '문법 골렘', 'a sturdy stone golem built from gray grammar blocks and big punctuation marks (comma, period, question mark shapes), glowing teal rune lines'],
  ['phone', '폰마왕', 'a demon-king smartphone with two red notification bubbles as horns, a glowing tempting screen face with a cheeky grin, a tiny purple cape'],
  ['pirate', '오답 해적 선장', 'a pirate captain made of crossed-out red answer sheets, a red X eyepatch, a pirate hat, a red pen held like a parrot on its shoulder'],
  ['owlnight', '밤샘 부엉 대장', 'a huge sleepy-but-grumpy navy owl general with dark circles under its eyes, armor of stacked notebooks, a tiny nightcap'],
  ['dictdragon', '딕셔너리 드래곤', 'a grand indigo dragon whose wings are open dictionary pages and whose scales look like tiny letter tiles (shapes only), golden horns'],
  ['finalking', '수능 대마왕', 'the final boss: a towering exam demon king in an armor of test papers, a crown of pencils, a long OMR-card cape (rows of bubbles), glowing red eyes but a funny smug face']
];
for (const [key, ko, look] of MONSTER_DESIGNS) sheet(F10, `몬스터 ${ko}`, 'monster', `"${ko}": ${look}.`, [
  [`monster-${key}`, `${ko} 기본`, 'IDLE: standing ready in a confident taunting pose, a playful smug face', `public/assets/monsters/${key}.webp`],
  [`monster-${key}-attack`, `${ko} 공격`, 'ATTACK: lunging forward to the LEFT with its signature move, motion lines and a burst of its own color, fierce but cute face', `public/assets/monsters/${key}-attack.webp`],
  [`monster-${key}-hurt`, `${ko} 맞음`, 'HURT: knocked back to the right, squinting eyes, small white impact stars around it', `public/assets/monsters/${key}-hurt.webp`],
  [`monster-${key}-down`, `${ko} 쓰러짐`, 'DEFEATED: flopped down on its back or side, swirly dizzy eyes, a few small stars circling above it, comical not sad', `public/assets/monsters/${key}-down.webp`]
]);
sheet(F10, '몬스터 화면 아이콘', 'icon', 'All icons in this set are one family, like the icons of one premium mobile game; keep each simple and bold so it stays clear at 32 pixels.', [
  ['ui-monster-tab', '몬스터 탭', 'a cute round purple monster face peeking over a crossed sword and shield, cheeky grin, one small sparkle', 'public/assets/ui/monster-tab.webp'],
  ['ui-monster-easy', '이지 배지', 'a small rounded shield badge in soft MINT GREEN with one white star in the middle', 'public/assets/ui/monster-easy.webp'],
  ['ui-monster-normal', '노말 배지', 'the same shield badge shape in SKY BLUE with two white stars side by side', 'public/assets/ui/monster-normal.webp'],
  ['ui-monster-hard', '하드 배지', 'the same shield badge shape in DEEP CRIMSON with three white stars and small orange flames licking up from behind it', 'public/assets/ui/monster-hard.webp']
]);

/* 11 칭호 메달 (V13.96): 칭호 65개(옛 뽑기 칭호 3개 포함)마다 자기 메달 + 칭호 화면 그림 3개.
   테두리(모양·색)는 등급을 말해요. 지금 앱의 SVG 메달과 같은 모양 규칙이에요:
   일반 동그라미 · 희귀 육각형 · 영웅 방패 · 전설 금빛 햇살 · 한정 무지개 리본. 가운데 그림은 칭호마다 달라요.
   칭호가 새로 생기면 TITLE_MOTIFS에 한 줄을 더해요(없으면 멈춰요). */
const F11 = '11-titles.txt';
STYLE.title = 'Style: shiny 3D game achievement medal, glossy enamel and polished metal, soft gem highlights, a clean bold outline, a symmetric frame, front view, one medal per cell, centered, about 78% of the cell, readable at 48 pixels. The FRAME (shape, rim and enamel color) shows the rarity tier and must be exactly as described for each cell. The small picture in the middle of the medal is different for every medal: a simple bold cute 3D object, mostly white or light colored with soft color accents, slightly raised from the enamel. No text, no letters, no numbers on the medals.';
const TITLE_FRAMES = {
  common: 'FRAME: a ROUND medal with a thick polished mint-silver rim and a soft MINT GREEN enamel face',
  rare: 'FRAME: a HEXAGON badge (pointy top) with a polished silver rim and a deep SAPPHIRE BLUE enamel face',
  epic: 'FRAME: a SHIELD-shaped crest with a polished lavender-silver rim, a rich AMETHYST PURPLE enamel face and a small violet gem at the top',
  legendary: 'FRAME: a ROUND GOLD medal ringed by a gold sunburst of short pointed rays, a small gold star on top, a rich golden enamel face and a warm golden glow',
  limited: 'FRAME: a ROUND medal with a shimmering RAINBOW holographic rim, a dark midnight-navy enamel face, and two short rainbow ribbon tails hanging below it'
};
const TITLE_MOTIFS = {
  // 일반
  rookie: 'a small green sprout growing out of a tiny footprint',
  focus: 'a bullseye target with a pencil stuck in the very center like an arrow',
  words100: 'a little seedling whose two leaves are small blank word cards',
  streak3: 'three small flames side by side, the third one the brightest',
  perfect1: 'a white answer sheet with a big red circle mark on it and one small gold star',
  win1: 'one small silver sword pointing up with a tiny victory sparkle at its tip',
  pets2: 'two small paw prints side by side with a tiny pink heart above them',
  study10: 'an open notebook with a yellow pencil lying across it',
  attend7: 'a small calendar card filled with round red stamp marks',
  rps10: 'a cute cartoon hand making a V sign (scissors)',
  bot1: 'the cute white robot head with a black visor screen showing dizzy swirl eyes in mint lines',
  gift1: 'a small gift box with a mint ribbon and a heart-shaped tag',
  monster1: 'a cute lime-green jelly slime with dizzy swirl eyes and a small sword stuck in the ground beside it',
  // 희귀
  words500: 'a small open treasure chest overflowing with blank word cards',
  streak: 'a ring of seven small flames around a bright sparkle',
  perfect5: 'a rubber stamp stamping a gold star, with two more gold stars beside it',
  combo: 'a bright lightning bolt with a trail of small chain links behind it',
  pets4: 'four small paw prints arranged in a diamond, each a different pastel color',
  win10: 'a sword and a small round shield crossed',
  yacha3: 'a swirling white whirlwind gust with three small stars spinning in it',
  level10: 'a young sapling tree with a small upward arrow beside it',
  study50: 'a neat stack of three books with a red apple on top',
  attend30: 'a calendar with a mint ribbon rosette pinned on it',
  monster10: 'a target with a round horned monster silhouette in the center and three claw marks',
  bothunter: 'the cute white robot head inside a target reticle',
  skill10: 'a glowing pet paw crackling with small lightning sparks',
  exam3: 'a test paper with a small stopwatch in front of it',
  g_lucky: 'a glossy four-leaf clover with a tiny sparkle',
  // 영웅
  words1000: 'a craftsman\'s hammer above a glowing gem-like block of blank word cards',
  streak14: 'a big flame wrapped by a ribbon loop shaped like an infinity sign',
  perfect20: 'a radiant gold star with small white wings',
  combo20: 'a speeding little steam locomotive made of lightning',
  master: 'an open glowing spell book with sparkles rising from its pages',
  win50: 'a general\'s helmet with a tall red plume',
  yachaking: 'a small gold crown on top of two crossed swords',
  comeback: 'a heart with a crack that is sealed by a glowing lightning bolt',
  flawless: 'a spotless shining shield without a single scratch, one big sparkle on it',
  rpsjack: 'three cartoon hands in a row (fist, V sign, open palm) with a burst of gold coins above them',
  monsterhard: 'a sword planted in front of a small flaming crimson shield',
  words2000: 'a graduation cap on top of a thick book',
  study150: 'a glowing pencil with a golden halo and small wings',
  attend100: 'a calendar inside a laurel wreath',
  combo30: 'a tall roaring flame with lightning bolts inside it',
  skill50: 'a pet paw and a child\'s hand touching, a glowing heart between them',
  g_golden: 'a golden hand with sparkles around its fingertips',
  // 전설
  words3000: 'a floating glowing dictionary with small wings',
  streak30: 'a crescent moon with a bright flame beside it',
  legend: 'a pair of radiant white angel wings',
  pets8: 'a ring of small paw prints around a small crown',
  win100: 'a cute fierce yaksha (oni) mask with two small horns, not scary',
  diamond: 'a large brilliant faceted diamond',
  champion: 'a gold trophy cup with two handles',
  rpsgod: 'a glowing open hand with a golden halo above it',
  level30: 'a prismatic crystal shard glowing with rainbow light',
  level40: 'a sparkling rainbow star with little twinkles around it',
  level50: 'a phoenix rising with spread flaming wings',
  level60: 'a crown with one huge gem and small lightning sparks',
  monsterlord: 'a golden bow and arrow crossed over a curved monster horn',
  perfect50: 'a circle of small gold stars like a constellation around one big star',
  yacha10: 'a flaming sword pointing up',
  g_god: 'a golden capsule toy bursting open with light',
  // 한정
  weekly1: 'a gold medal with a laurel branch',
  weekly2: 'a silver medal with a laurel branch',
  weekly3: 'a bronze medal with a laurel branch',
  leagueking: 'a gold crown above a small league shield'
};
const TIER_ORDER_11 = ['common', 'rare', 'epic', 'legendary', 'limited'];
const titleKeys11 = TIER_ORDER_11.flatMap(tier => Object.keys(TITLES).filter(key => TITLES[key].tier === tier));
const missingMotif = Object.keys(TITLES).filter(key => !TITLE_MOTIFS[key]);
if (missingMotif.length) throw new Error(`11-titles: 가운데 그림(TITLE_MOTIFS)이 없는 칭호가 있어요: ${missingMotif.join(', ')}`);
// The leftover cells of the last sheet: pictures for the 칭호 도감 screen (same medal family).
const TITLE_EXTRAS = [
  ['ui-titles-hero', '칭호 도감 맨 위', 'NOT a medal: a small glass display shelf holding five medals of this set (a round mint one, a blue hexagon, a purple shield, a gold sunburst and a rainbow-ribbon one), a few sparkles', 'public/assets/ui/titles-hero.webp'],
  ['ui-title-equipped', '장착 중 표시', 'NOT a medal: a small mint green ribbon rosette pin with a white check mark in the middle', 'public/assets/ui/title-equipped.webp'],
  ['ui-title-new', '새 칭호 표시', 'NOT a medal: a small burst of golden light with a tiny sparkling medal in the middle and confetti bits flying out', 'public/assets/ui/title-new.webp']
];
const cells11 = [
  ...titleKeys11.map(key => [`title-${key}`, `${TITLES[key].name} (${TITLE_TIERS[TITLES[key].tier].name})`, `${TITLE_FRAMES[TITLES[key].tier]}. CENTER: ${TITLE_MOTIFS[key]}.`, `public/assets/titles/${key}.webp`]),
  ...TITLE_EXTRAS
].slice(0, Math.ceil(titleKeys11.length / 4) * 4);
// First sheet that shows each tier, so later sheets can match its frame.
const TITLE_TIER_SHEET = {};
for (let i = 0; i < cells11.length; i += 4) {
  const group = cells11.slice(i, i + 4);
  for (const c of group) { const key = c[0].replace(/^title-/, ''); if (TITLES[key] && !TITLE_TIER_SHEET[TITLES[key].tier]) TITLE_TIER_SHEET[TITLES[key].tier] = i / 4 + 1; }
  const tiers = [...new Set(group.map(c => TITLES[c[0].replace(/^title-/, '')]?.tier).filter(Boolean))].map(t => TITLE_TIERS[t].name);
  sheet(F11, `칭호 메달 ${i / 4 + 1} (${tiers.join('·')}${group.some(c => !c[0].startsWith('title-')) ? ' + 칭호 화면 그림' : ''})`, 'title', 'All medals of this set are one family, like the achievement medals of one premium mobile game: the same lighting, metal finish, outline and level of detail.', group);
}

/* 12 몬스터 2탄 (V13.104~): 레벨이 계속 이어지는 몬스터전에 쓸 새 몬스터 9종 + 단계 아이콘 4개.
   9종은 앞에서 뒤로 갈수록 덩치가 크고 위엄 있게 보여요(레벨이 올라갈수록 어려워지는 몬스터).
   각 몬스터는 10과 같은 4가지 모습(기본·공격·맞음·쓰러짐). 앱에서 쓰는 key는 아래 표와 같아요(코드는 나중에 이 key를 읽어요). */
const F12 = '12-monsters.txt';
const MONSTER2_DESIGNS = [
  ['mochi', '암기 모찌', 'a small, soft, round white rice-cake (mochi) blob with a pale pink cheek-blush, a tiny yellow sticky-note headband (no writing on it) and two sparkly sleepy-cute eyes; the smallest and friendliest monster of the whole set'],
  ['pencilworm', '샤프 벌레', 'a chubby mint-green caterpillar made of stacked mechanical-pencil segments, a sharp pencil-tip nose, a pink eraser cap on the tail end, thin blue lead-line streaks on its sides'],
  ['mimic', '노트 미믹', 'a treasure-chest-shaped monster disguised as a thick spiral notebook: the cover opens like a mouth with white paper pages as sharp teeth, a long pink bookmark tongue, two wide eyes peeking from the cover'],
  ['sleepcloud', '졸음 구름', 'a fluffy lavender-grey storm cloud with half-closed droopy eyes, a big yawn, floating little blue "z" shaped sparkles (no letters) and a tiny nightcap tuft, dripping dreamy sparkles instead of rain'],
  ['alarmwolf', '알람 늑대', 'a lean dark-blue wolf howling with a loud round alarm bell on top of its head like a crown, jagged yellow sound-wave rings around its mouth, bandaged-looking paws, bright amber eyes'],
  ['scrollgoblin', '무한 스크롤 도깨비', 'a mischievous orange goblin (dokkaebi) with one small horn, holding an endlessly long unrolling paper scroll that trails behind it in loops, hypnotic swirl eyes and a huge sly grin (generic scroll, no real app or brand logos)'],
  ['proctor', '감독 기사', 'a stern armored exam-proctor knight with a giant stopwatch as a round shield and a long red pen as a lance, a helmet with a small bell, steady-glaring but funny eyes behind the visor slit'],
  ['cramwizard', '벼락치기 마법사', 'an exhausted-but-powerful night-before-the-exam wizard with a tall crooked purple hat covered in sticky notes (no writing), a coffee cup glowing like a magic staff, messy hair, dark circles and crackling purple lightning around the hands'],
  ['mockhydra', '모의고사 히드라', 'a huge three-headed hydra made of rolled and folded test papers in cream, mint and pink, each head wearing a different silly expression, bubble-sheet circle patterns on its scales (shapes only), glowing gold eyes; the largest and most majestic monster of the set, but still cute-but-mighty']
];
for (const [key, ko, look] of MONSTER2_DESIGNS) sheet(F12, `몬스터2 ${ko}`, 'monster', `"${ko}": ${look}.`, [
  [`monster-${key}`, `${ko} 기본`, 'IDLE: standing ready in a confident taunting pose, a playful smug face', `public/assets/monsters/${key}.webp`],
  [`monster-${key}-attack`, `${ko} 공격`, 'ATTACK: lunging forward to the LEFT with its signature move, motion lines and a burst of its own color, fierce but cute face', `public/assets/monsters/${key}-attack.webp`],
  [`monster-${key}-hurt`, `${ko} 맞음`, 'HURT: knocked back to the right, squinting eyes, small white impact stars around it', `public/assets/monsters/${key}-hurt.webp`],
  [`monster-${key}-down`, `${ko} 쓰러짐`, 'DEFEATED: flopped down on its back or side, swirly dizzy eyes, a few small stars circling above it, comical not sad', `public/assets/monsters/${key}-down.webp`]
]);
sheet(F12, '몬스터 단계(레벨) 아이콘', 'icon', 'All icons in this set are one family, like the icons of one premium mobile game; keep each simple and bold so it stays clear at 48 pixels. Each icon is a "stage plate": a rounded shield-shaped plaque with a flat, EMPTY center (the app writes the level number there, so leave the middle plain and free of any drawing, letters or numbers).', [
  ['ui-monster-stage', '단계 판(열림)', 'a stage plate in warm sky BLUE metal with a thin white rim and two tiny crossed swords tucked behind it, a soft glow, flat empty center', 'public/assets/ui/monster-stage.webp'],
  ['ui-monster-stage-lock', '단계 판(잠김)', 'the same stage plate shape in dull steel GREY with a heavy chain wrapped around it and a small padlock hanging at the bottom, no glow, flat empty center', 'public/assets/ui/monster-stage-lock.webp'],
  ['ui-monster-stage-clear', '단계 판(깸)', 'the same stage plate shape in shiny GOLD with a small green leaf wreath on both sides and one big white star above it, a few sparkles, flat empty center', 'public/assets/ui/monster-stage-clear.webp'],
  ['ui-monster-stage-boss', '단계 판(보스)', 'the same stage plate shape in DEEP CRIMSON and black metal with two small curved horns on top and tiny orange flames licking up from behind it, flat empty center', 'public/assets/ui/monster-stage-boss.webp']
]);

/* 14 할로윈 한정 (가장 급함) · 15 전투 배경 · 16 몽이·핑키 다시 그리기 · 17 새 펫 8종 (V13.109~)
   14a·17a 설정 시트(알·아기·성장·최종) → 14b·17b 표정(그 펫의 설정 시트를 Drive에서 열어 맞춤).
   배경(14 할로윈 배경, 15)은 2×2 시트가 아니라 가로 그림 한 장(1536×1024, 투명 아님)이에요. */
const F14A = '14a-halloween-pets-design.txt', F14B = '14b-halloween-pets-expressions.txt', F15 = '15-battle-backgrounds.txt', F16 = '16-mong-pinky-remake.txt', F17A = '17a-new-pets-design.txt', F17B = '17b-new-pets-expressions.txt';
const HALLOWEEN_PETS = {
  pumpkincat: { ko: '호박냥', type: '호박 고양이', base: 'a cute orange tabby cat with soft tangerine fur and darker orange stripes, a cream belly and muzzle, big glossy golden-amber eyes, pink blush, a curly green vine with one small leaf wrapped around the tail tip, wearing a small carved jack-o\'-lantern pumpkin as a hat (its carved face is a friendly smile with a soft warm glow inside). Cute and cozy, never scary', egg: 'a round pumpkin-orange egg with soft pumpkin ribs, a short green stem and a curly vine on top, small purple bat and star patterns (no face on the egg), resting on a little purple cushion', f: {
    1: 'baby stage: a tiny round fluffy kitten sitting inside the bottom half of a small pumpkin shell, the pumpkin hat a little too big, no other accessories',
    2: 'grown stage: a slim young cat standing on four legs with a longer body and tail (NOT a round kitten), the jack-o\'-lantern hat, a purple scarf with a small gold star charm',
    3: 'final stage: a large, elegant, proud cat with long legs and silky fur edged in a warm golden-orange glow, a flowing purple-and-orange witch-style cape with gold trim fastened by a gold star clasp, a bigger glowing jack-o\'-lantern crown-hat with carved star shapes, two small friendly pumpkin lanterns floating beside it, golden-orange sparkles (NOT a round kitten)' } },
  ghost: { ko: '부우', type: '꼬마 유령', base: 'a cute round little ghost with a soft milky-white, slightly translucent glowing body that fades into a short wavy tail at the bottom (no legs), tiny round arms, big glossy dark-violet eyes with white highlights, pink blush, a small lavender bow on its head. It floats in the air. Friendly and adorable, never scary (no fangs, no dark holes for eyes)', egg: 'a pale lavender egg with a soft inner glow, white swirling wisp patterns and tiny stars (no face on the egg), resting on a small purple cushion', f: {
    1: 'baby stage: a tiny round ghost blob with a very short tail, the lavender bow, floating low',
    2: 'grown stage: a bigger ghost with a longer flowing tail and longer arms (NOT a tiny blob), a small purple witch hat with a gold star, holding a tiny glowing candy lantern',
    3: 'final stage: a grand floating ghost with a long flowing tail, a flowing starry midnight-purple cloak with gold trim and a gold star clasp, a small crown of floating soft lights, a ring of tiny friendly ghost-lights and stars circling it, lavender and golden sparkles (NOT a tiny blob, still cute)' } }
};
const NEW_PETS_17 = {
  squirrel: { ko: '도토리', type: '다람쥐', tier: 'basic', base: 'a chubby red squirrel with warm russet-orange fur, a cream belly, tufted ears with pink insides, big glossy dark eyes, pink blush, a huge fluffy curled tail, holding an acorn', egg: 'a warm brown egg with an acorn-cap pattern on top and small leaf patterns, resting in a nest of autumn leaves', f: {
    1: 'baby stage: small and very round, sitting and hugging an acorn, no other accessories',
    2: 'grown stage: a slimmer young squirrel standing on its hind legs (NOT a round baby), a leaf-green scarf with a small gold star charm, a tiny satchel full of acorns',
    3: 'final stage: large and proud, an acorn-cap crown with a gold star, a flowing autumn-leaf cape with gold trim, glowing golden acorns floating around, golden sparkles (NOT a round baby)' } },
  turtle: { ko: '느릿', type: '거북이', tier: 'basic', base: 'a cute little turtle with a soft mint-green body, a rounded glossy teal shell with soft hexagon patterns, big glossy happy eyes, pink blush, a calm sleepy smile', egg: 'a mint egg with a soft hexagon shell pattern, resting on a small mound of sand with one pebble', f: {
    1: 'baby stage: tiny and round with a small soft shell, no accessories',
    2: 'grown stage: bigger, standing on four sturdy legs (NOT a tiny baby), a mint scarf with a small gold star charm, a small flower growing on top of the shell',
    3: 'final stage: a large wise turtle whose shell is a tiny garden island with small trees, flowers and a little gold star on top, a golden rim around the shell, a small golden crown, glowing water-drop sparkles (NOT a tiny baby)' } },
  duck: { ko: '꽥꽥', type: '오리', tier: 'basic', base: 'a round fluffy duck with soft lemon-yellow feathers, a white chest, an orange bill and orange webbed feet, big glossy dark eyes, pink blush', egg: 'a pale yellow egg with small blue wave patterns, resting in a little nest of reeds', f: {
    1: 'baby stage: a tiny round fluffy duckling, no accessories',
    2: 'grown stage: a taller young duck with smooth feathers and folded wings (NOT a fluffy duckling), a little navy sailor collar with a small gold star charm',
    3: 'final stage: a grand duck captain with a navy captain coat with gold buttons and gold trim, a captain hat with a gold star, a small splash of water and golden sparkles around (NOT a fluffy duckling)' } },
  sheep: { ko: '뭉실', type: '양', tier: 'basic', base: 'a fluffy sheep with cream-white curly wool tinted soft peach at the tips (NOT lavender; it must look different from an alpaca: a short neck, a round body and small curled horns), a cream face, small curled golden-cream horns, big glossy dark eyes, pink blush, a small bell on a ribbon', egg: 'a fluffy-looking cream egg with soft peach cloud-swirl patterns, resting on a small tuft of green grass', f: {
    1: 'baby stage: a small round ball of wool with tiny legs, no horns yet, the little bell',
    2: 'grown stage: a bigger lamb standing on four legs (NOT a round ball), small curled horns, a mint ribbon with a gold star bell',
    3: 'final stage: a grand sheep with huge cloud-like wool glowing softly at the edges, large curled golden horns, a crown of tiny white flowers, small floating fluffy clouds and golden sparkles (NOT a round ball)' } },
  redpanda: { ko: '단풍', type: '레서판다', tier: 'epic', base: 'a red panda with rich russet-red fur, white face markings, dark brown legs, a big fluffy tail with cream rings, big glossy dark eyes, pink blush, a small red maple leaf tucked by one ear', egg: 'a russet-red egg with cream ring stripes and maple-leaf patterns, resting on a pile of red maple leaves', f: {
    1: 'baby stage: a small round fluffy cub holding a maple leaf, no other accessories',
    2: 'grown stage: a sleeker young red panda standing on its hind legs (NOT a round cub), a maple-leaf scarf with a small gold star charm',
    3: 'final stage: a grand red panda with tail rings glowing autumn-gold, a cape of red and orange maple leaves with gold trim and a gold star clasp, a maple-leaf crown, glowing maple leaves swirling around (NOT a round cub)' } },
  arcticfox: { ko: '눈송', type: '북극여우', tier: 'epic', base: 'a snow-white arctic fox with very fluffy fur, icy-blue tips on the ears and tail, a small pale-blue snowflake mark on the forehead, big glossy ice-blue eyes, pink blush, a big fluffy tail', egg: 'a white egg with frosty blue crystal patterns, resting on a small pile of snow', f: {
    1: 'baby stage: a small round fluffy kit, no accessories',
    2: 'grown stage: a sleek young fox with long legs (NOT a round kit), an icy-blue scarf with a small gold star charm',
    3: 'final stage: a majestic fox with three huge flowing snowy tails glowing icy-blue at the tips, an ice-crystal crown, soft aurora-colored ribbons of light around it, snowflake sparkles (NOT a round kit)' } },
  koala: { ko: '쿨쿨', type: '코알라', tier: 'epic', base: 'a soft grey koala with big round fluffy ears with white tufts, a big dark glossy nose, sleepy happy eyes, pink blush, holding a small eucalyptus sprig', egg: 'a soft grey egg with green eucalyptus-leaf patterns, resting in a small nest of branches', f: {
    1: 'baby stage: a small round sleepy baby koala hugging a eucalyptus leaf, no other accessories',
    2: 'grown stage: a bigger koala standing up (NOT a round baby), a small blue nightcap with a star pom-pom, a eucalyptus-leaf scarf with a gold star charm',
    3: 'final stage: a grand dream-guardian koala in a flowing midnight-blue cloak covered with tiny stars and gold trim, a crescent-moon crown, floating little stars and soft dreamy clouds, eucalyptus leaves (NOT a round baby)' } },
  parrot: { ko: '앵두', type: '앵무새', tier: 'epic', base: 'a cheerful parrot with bright scarlet-red, sunny yellow and sky-blue feathers, a curved ivory beak, big glossy dark eyes, pink blush, a small cherry pin on its head feather', egg: 'a red-and-yellow egg with tropical feather patterns, resting in a nest with one small cherry', f: {
    1: 'baby stage: a small round fluffy chick with tiny wings, no accessories',
    2: 'grown stage: a sleek young parrot with folded colorful wings and a longer tail (NOT a fluffy chick), a mint scarf with a small gold star charm',
    3: 'final stage: a majestic parrot with huge spread rainbow wings edged in gold, long flowing tail feathers, a small golden crown with a cherry-red gem, golden sparkles (NOT a fluffy chick)' } }
};
const EXPRS_X = EXPRS.map(([e, ko, text]) => [e, ko, e === 'sad' ? 'SAD: slightly sad pouty face with teary sparkling eyes, ears, wings, feathers or tail drooping a little, still cute (not crying hard); keep the same face, markings and item (hat, bow, scarf, acorn, leaf or shell) as the other cells'
  : e === 'cheer' ? 'CHEERING: energetic pose with one front paw, arm, wing or flipper raised high, determined sparkling eyes, small motion sparkles'
  : e === 'eat' ? 'EATING: happily eating from a small round mint food bowl in front of it (the ghost eats a candy from the bowl), cheeks puffed, a few crumbs, eyes curved in joy' : text]);
const designSheets = (file, pets, extra = () => '') => { for (const [key, pet] of Object.entries(pets)) sheet(file, `${pet.ko} ${pet.type} 설정 시트`, 'pet', `${pet.ko}, ${pet.base}. ${extra(pet)}Draw the same character at four growth steps; each cell must clearly be the same creature, getting bigger and grander.`, [
  [`${key}-0`, `${pet.ko} 알`, `EGG: ${pet.egg}. Just the egg, no creature`, `public/assets/pets/${key}-0.webp`],
  [`${key}-1`, `${pet.ko} 아기`, `BABY: the ${pet.f[1]}, happy calm face, front 3/4 view`, `public/assets/pets/${key}-1.webp`],
  [`${key}-2`, `${pet.ko} 성장`, `GROWN: the ${pet.f[2]}, happy calm face, front 3/4 view`, `public/assets/pets/${key}-2.webp`],
  [`${key}-3`, `${pet.ko} 최종`, `FINAL: the ${pet.f[3]}, happy calm face, front 3/4 view`, `public/assets/pets/${key}-3.webp`]
]); };
const exprSheets = (file, pets, pairs, extra = () => '') => {
  for (const [key, pet] of Object.entries(pets)) for (const form of [1, 2, 3]) sheet(file, `${pet.ko} ${FORM_KO[form]} 표정`, 'pet', `${pet.ko}, ${pet.base}. This is the ${pet.f[form]}.${extra(pet)}`,
    EXPRS_X.map(([expr, ko, text]) => [`${key}-${form}-${expr}`, `${pet.ko} ${FORM_KO[form]} ${ko}`, text, `public/assets/pets/${key}-${form}-${expr}.webp`]));
  for (const [a, b] of pairs) sheet(file, `${pets[a].ko} · ${pets[b].ko} 알 반응`, 'egg', `two pet eggs (the reference pictures show them). The TOP row cells show ${pets[a].ko}'s egg: ${pets[a].egg}. The BOTTOM row cells show ${pets[b].ko}'s egg: ${pets[b].egg}.`, [
    [`${a}-0-happy`, `${pets[a].ko} 알 기뻐함`, EGG_HAPPY, `public/assets/pets/${a}-0-happy.webp`],
    [`${a}-0-eat`, `${pets[a].ko} 알 따뜻해짐`, EGG_WARM, `public/assets/pets/${a}-0-eat.webp`],
    [`${b}-0-happy`, `${pets[b].ko} 알 기뻐함`, EGG_HAPPY, `public/assets/pets/${b}-0-happy.webp`],
    [`${b}-0-eat`, `${pets[b].ko} 알 따뜻해짐`, EGG_WARM, `public/assets/pets/${b}-0-eat.webp`]
  ]);
};
// A wide background picture (one image, not a 2×2 sheet).
const BG = 'Create ONE wide landscape image, 1536×1024 pixels: a 2D battle-stage BACKGROUND for a cute premium mobile pet-battle game (players are high-school students). Paint it fully to every edge (no transparency, no border, no frame, no rounded corners). NO characters, NO animals, NO creatures, NO people. No text, no letters, no numbers, no logos, no UI, no watermark. Do not ask me any questions; just generate the image.';
const BG_LAYOUT = 'COMPOSITION (important, the game puts its own characters and name tags on top): the camera looks slightly down at a wide flat stage floor that fills the lower 60% of the picture. One character will stand on the floor in the UPPER-RIGHT area and one in the LOWER-LEFT area, so keep those two standing spots flat, open and uncluttered. Name tags will cover the TOP-LEFT corner and the area right of the lower-left character, so keep the top-left corner and the lower-right quarter calm and simple (soft colors, little detail). Put the interesting details around the outer edges and in the far background. The floor is crisp; the far background is slightly softer and lighter for depth. A gentle vignette toward the edges.';
const BG_STYLE = 'Style: the same premium cute 3D-painted anime game art as the pets of this game: clear soft colors (not washed out, not hazy), clean shapes, soft cel-like shading, gentle rim light, friendly and inviting.';
const BG_REF = `STYLE REFERENCE — before drawing, open the pets of this game in the Google Drive folder "SUMUS_PET_SPRITES_ALL_20261002/original_1254" (MONG, NABI, PINKY and BAMBOO, 03_final.png) and the monsters "10-1.png" and "10-8.png" in the Google Drive folder "SUMUS 몬스터 10 (Runner용)". The background must look like it belongs in the same game as those characters (same rendering quality and color mood), and those characters must stand out clearly in front of it. Do NOT draw those characters.`;
function scene(file, title, key, look, out) {
  const no = prompts.length + 1;
  prompts.push({ file, no, title, bg: true, text: [BG, BG_STYLE, `Scene: ${look}`, BG_LAYOUT].join('\n') });
  slices.push({ file, no, title, cell: '전체', key, name: title, out });
}
designSheets(F14A, HALLOWEEN_PETS, () => 'A limited Halloween pet: spooky-cute, cozy and friendly (never scary). ');
exprSheets(F14B, HALLOWEEN_PETS, [['pumpkincat', 'ghost']], () => ' A limited Halloween pet: spooky-cute, never scary.');
sheet(F14B, '할로윈 알 상점 아이콘', 'icon', 'Halloween items for the pet shop of this game, spooky-cute and friendly, in purple, orange and gold.', [
  ['ui-halloween-egg', '할로윈 알', 'HALLOWEEN EGG: a round pumpkin-orange egg with small purple bat and star patterns and a short green stem with a curly vine on top, resting on a small purple velvet cushion with gold tassels, a few orange and purple sparkles around (the same size and framing as a shop egg icon)', 'public/assets/ui/halloween-egg.webp'],
  ['ui-limited-badge', '한정 배지', 'LIMITED BADGE: a small round badge in deep purple and orange enamel with a gold rim, a tiny jack-o\'-lantern and a star in the middle, a little ribbon below (no letters)', 'public/assets/ui/limited-badge.webp'],
  ['ui-halloween-deco-pumpkins', '할로윈 장식(호박)', 'DECORATION: a small cozy cluster of three smiling jack-o\'-lantern pumpkins with a soft warm glow inside, a few wrapped candies and a curly vine, seen from the front', 'public/assets/ui/halloween-deco-pumpkins.webp'],
  ['ui-halloween-deco-moon', '할로윈 장식(달)', 'DECORATION: a big friendly crescent moon with three small cute bats flying around it and a few twinkling stars', 'public/assets/ui/halloween-deco-moon.webp']
]);
scene(F14B, '할로윈 전투 배경', 'bg-halloween', 'a Halloween pumpkin-patch plaza at night under a big friendly moon: a round stone battle floor with an orange-and-purple painted ring, smiling jack-o\'-lantern lanterns and candy around the edges, strings of small orange and purple lights, a cute crooked little haunted house far back, tiny bat silhouettes in the sky. Spooky-cute and cozy, never scary; bright enough that the characters are easy to see.', 'public/assets/battle/bg-halloween.webp');
scene(F15, '야차전 아레나 배경', 'bg-arena', 'a school rooftop battle arena on a clear golden afternoon: a round painted battle circle on a light stone floor with mint-green and gold trim, a low railing, cheerful blank flags and pennants (no text) on poles, string lights, a few cherry trees in big pots, the top of a school building and soft clouds in a blue sky far back.', 'public/assets/battle/bg-arena.webp');
scene(F15, '로보 연습장 배경', 'bg-practice', 'a bright, clean high-tech training room: white and mint floor panels with a softly glowing mint circle in the middle, cute round training targets and padded training dummies at the sides, a few floating holographic panels with simple blank shapes (no text), big windows with daylight far back.', 'public/assets/battle/bg-practice.webp');
scene(F15, '몬스터 숲 배경', 'bg-forest', 'a magical forest clearing at blue dusk: a flat mossy floor with a ring of old stones, glowing blue and pink mushrooms, fireflies, tall soft trees, a little stream, light purple-blue mist far back. Mysterious and adventurous but friendly, not scary.', 'public/assets/battle/bg-forest.webp');
scene(F15, '보스방 배경', 'bg-boss', 'an ancient castle boss hall: a dark polished stone floor with a large glowing crimson-and-gold magic circle, tall stone pillars, braziers with warm flames, deep red banners (no text), red-violet light from high windows. Dramatic and powerful but still readable and suitable for students; the floor must stay clear and lit enough for the characters.', 'public/assets/battle/bg-boss.webp');
// 16 몽이·핑키: 알과 아기(1단계)는 그대로, 성장·최종을 밤부 최종만큼 화려하게 다시 그려요.
const REMAKE = {
  dog: { ko: '몽이', drive: 'MONG', base: PETS.dog.base, f: {
    2: 'NEW grown stage: a taller, athletic young Shiba with longer legs, a fuller curled tail and a cream ruff on the chest (clearly bigger and more mature than the round baby), a mint-green neckerchief with a gold star badge and a small leather satchel strap across the chest',
    3: 'NEW final stage: a large, majestic heroic Shiba guardian standing proud: a thick flowing cream-and-gold ruff like a mane, a flowing mint-and-white knight cape with gold embroidery fastened by a glowing gold star clasp, a light golden shoulder guard, the huge fluffy tail tipped with a soft golden glow, small floating golden stars and leaf motes around. NO wings' } },
  pig: { ko: '핑키', drive: 'PINKY', base: PETS.pig.base, f: {
    2: 'NEW grown stage: a sturdier, taller young pig with longer legs (clearly bigger than the round baby), a mint scarf with a gold star charm and a small crown of pink cherry blossoms between the ears',
    3: 'NEW final stage: a large, elegant noble pig standing proud: a flowing rose-pink and cream royal cape with gold trim and a gold star clasp, a small gold tiara with a pink gem, glowing cherry-blossom petals swirling around, a soft golden aura. NO wings. The big round pig snout stays clearly visible' } }
};
const REMAKE_EXPRS = EXPRS.map(([e, ko, text]) => [e, ko, e === 'eat' ? 'EATING: happily eating from a small round mint food bowl in front of it, cheeks puffed, a few crumbs, eyes curved in joy' : text]);
for (const [key, pet] of Object.entries(REMAKE)) for (const form of [2, 3]) {
  sheet(F16, `${pet.ko} 새 ${FORM_KO[form]}`, 'pet', `${pet.ko}, ${pet.base}. This is the ${pet.f[form]}. As grand, detailed and polished as the panda BAMBOO's final form.`, [
    [`${key}-${form}`, `${pet.ko} 새 ${FORM_KO[form]}`, `DEFAULT: standing, happy calm face, front 3/4 view`, `public/assets/pets/${key}-${form}.webp`],
    ...REMAKE_EXPRS.filter(([e]) => e !== 'cheer').map(([expr, ko, text]) => [`${key}-${form}-${expr}`, `${pet.ko} 새 ${FORM_KO[form]} ${ko}`, text, `public/assets/pets/${key}-${form}-${expr}.webp`])
  ]);
}
sheet(F16, '몽이 · 핑키 새 응원', 'pet', `TOP row: 몽이, ${PETS.dog.base}. BOTTOM row: 핑키, ${PETS.pig.base}. Each cell shows the NEW design of that pet and stage from the reference sheets.`, [
  ['dog-2-cheer', '몽이 새 성장 응원', `CHEERING: 몽이 ${REMAKE.dog.f[2]}; energetic pose with one front paw raised high, determined sparkling eyes, small motion sparkles`, 'public/assets/pets/dog-2-cheer.webp'],
  ['dog-3-cheer', '몽이 새 최종 응원', `CHEERING: 몽이 ${REMAKE.dog.f[3]}; energetic pose with one front paw raised high, determined sparkling eyes, small motion sparkles`, 'public/assets/pets/dog-3-cheer.webp'],
  ['pig-2-cheer', '핑키 새 성장 응원', `CHEERING: 핑키 ${REMAKE.pig.f[2]}; energetic pose with one front hoof raised high, determined sparkling eyes, small motion sparkles`, 'public/assets/pets/pig-2-cheer.webp'],
  ['pig-3-cheer', '핑키 새 최종 응원', `CHEERING: 핑키 ${REMAKE.pig.f[3]}; energetic pose with one front hoof raised high, determined sparkling eyes, small motion sparkles`, 'public/assets/pets/pig-3-cheer.webp']
]);
designSheets(F17A, NEW_PETS_17, pet => pet.tier === 'epic' ? 'A 영웅 (epic) pet, one rank below legendary: a little grander and more sparkling than a basic pet, with a soft golden rim light. ' : '');
exprSheets(F17B, NEW_PETS_17, [['squirrel', 'turtle'], ['duck', 'sheep'], ['redpanda', 'arcticfox'], ['koala', 'parrot']], pet => pet.tier === 'epic' ? ' A 영웅 (epic) pet: a soft golden rim light.' : '');

/* 18 새 펫 8종 (V13.114~): 물범 · 개구리 · 삽살개 · 사슴 · 늑대 · 곰 · 악어 · 문어. 17과 같은 틀이에요.
   18a 설정 시트(알·아기·성장·최종) → 18b 표정(그 펫의 설정 시트를 열어 맞춤) + 알 반응.
   기본 4(개구리 · 삽살개 · 사슴 · 곰) + 영웅 4(물범 · 늑대 · 악어 · 문어). 이름(ko)은 그림 주문에만 쓰는 임시 이름이고, 앱 이름은 펫을 등록할 때 정해요.
   `limb`: 응원·쓰다듬기 동작에서 "앞발·팔을 들어요"가 이 펫에서는 어디를 뜻하는지(문어는 촉수, 개구리는 손). */
const F18A = '18a-new-pets-design.txt', F18B = '18b-new-pets-expressions.txt';
const NEW_PETS_18 = {
  frog: { ko: '폴짝', type: '개구리', tier: 'basic', limb: 'one webbed hand', base: 'a round chubby frog with a soft spring-green body, a cream-yellow belly, a few small darker-green spots on the back, big round glossy eyes on top of the head with white highlights, pink blush, a wide happy smile, small webbed hands and feet with round toe pads', egg: 'a pale green egg with soft jelly-bubble patterns and small lily-pad shapes, floating on a small lily pad', f: {
    1: 'baby stage: a tiny, very round froglet sitting on a small lily pad, no other accessories',
    2: 'grown stage: a longer-legged young frog crouching as if about to jump (NOT a round baby), a mint scarf with a small gold star charm, a small pink water-lily flower beside one eye',
    3: 'final stage: a large proud frog sitting upright on a big lily-pad throne, a small golden crown with a green gem, a flowing leaf-green cape with gold trim fastened by a gold star clasp, glowing water drops and golden sparkles around (NOT a round baby)' } },
  sapsaree: { ko: '복실', type: '삽살개', tier: 'basic', limb: 'one front paw', base: 'a fluffy Sapsaree (a Korean shaggy dog) with long, soft, wavy cream-white and light-gray fur that falls over its forehead like a fringe (the big glossy dark eyes and the round black nose still show through), small floppy ears half hidden in the fur, a fluffy tail curled up over its back, pink blush. It must look different from the orange Shiba 몽이: long shaggy cream-gray fur, no orange', egg: 'a cream egg with soft shaggy wavy-line fur patterns in light gray and a tiny blue ribbon, resting on a small cushion of fluffy cloud-like fur', f: {
    1: 'baby stage: a tiny round puffball of fur with only the eyes, nose and tiny paws showing, no accessories',
    2: 'grown stage: a bigger young dog standing on four legs with long flowing fur (NOT a round puffball), an indigo-blue scarf with a small gold star charm',
    3: 'final stage: a large, majestic guardian Sapsaree with long silky fur flowing like a cloud, a flowing indigo-blue cape with soft traditional Korean cloud patterns and gold trim fastened by a gold star clasp, a small gold ornament on the collar, glowing blue-white sparkles (NOT a round puffball)' } },
  deer: { ko: '새싹', type: '사슴', tier: 'basic', limb: 'one front hoof', base: 'a gentle young deer with warm caramel-brown fur, a cream belly, soft white spots on the back, big soft glossy eyes with long lashes, pink blush, small rounded ears with pink insides, a small white tail tuft, tiny budding antlers with one small green leaf sprouting from each', egg: 'a soft caramel egg with white spot patterns and a tiny green leaf sprout on top, resting on a bed of moss and clover', f: {
    1: 'baby stage: a tiny fawn with white spots and a single small green sprout between its ears, no antlers yet, no other accessories',
    2: 'grown stage: a slender young deer standing tall on long legs (NOT a wobbly fawn), small antlers with leaf buds, a mint scarf with a small gold star charm',
    3: 'final stage: a majestic stag with grand antlers shaped like a glowing blossoming tree with small cherry flowers, leaves and tiny gold stars hanging from them, a flowing leaf-green cape with gold trim fastened by a gold star clasp, golden-green fireflies and sparkles around (NOT a fawn)' } },
  bear: { ko: '든든', type: '곰', tier: 'basic', limb: 'one front paw', base: 'a sturdy round brown bear with soft chestnut-brown fur, a lighter tan muzzle and belly patch, small round ears with pink insides, big glossy dark eyes, pink blush, a small friendly smile. It must look different from the panda 밤부, the koala 쿨쿨 and the red panda 단풍: plain chestnut-brown, no black-and-white or red markings', egg: 'a warm honey-brown egg with golden honeycomb hexagon patterns and one small drip of honey, resting on a small log slice', f: {
    1: 'baby stage: a tiny round fluffy cub hugging a small honey pot, no other accessories',
    2: 'grown stage: a bigger young bear standing on its hind legs holding a honey jar (NOT a round cub), an amber scarf with a small gold star charm',
    3: 'final stage: a large, strong but friendly bear standing proud, a flowing amber-and-cream cape with gold trim fastened by a gold star clasp, a golden honeycomb crown with an amber gem, glowing honey drops and a few tiny cute bees floating around (NOT a round cub)' } },
  seal: { ko: '동글', type: '물범', tier: 'epic', limb: 'one flipper', base: 'a round chubby harbor-seal pup with smooth silver-gray fur sprinkled with soft dark spots, a cream belly, big glossy black eyes with white highlights, long white whiskers, a small button nose, pink blush, short flippers, a sleepy sweet smile. It must look different from the penguin 펭이, the otter 달이 and the shark 파도: a plump spotted seal body with no tail fin', egg: 'a pale silver-blue egg with soft wave and pebble patterns and small shell shapes, resting on a small rock at the water edge', f: {
    1: 'baby stage: a tiny, very round pup with soft white-gray fur lying on its belly, no accessories',
    2: 'grown stage: a sleeker young seal sitting upright on its tail with its front flippers raised (NOT a round pup), a sea-blue scarf with a small gold star charm and a small starfish clip',
    3: 'final stage: a grand seal with glossy silver-blue fur shimmering with a soft golden rim, a flowing sea-blue cape with white wave patterns and gold trim fastened by a gold star clasp, a crown of pearls and small shells, a big glowing pearl balanced on its nose, floating bubbles and golden sparkles (NOT a round pup)' } },
  wolf: { ko: '달빛', type: '늑대', tier: 'epic', limb: 'one front paw', base: 'a young wolf pup with soft silver-gray fur, a lighter cream chest and muzzle, a darker gray back and tail tip, pointed ears with pink insides, big glossy amber eyes, pink blush, a small silver crescent-moon mark on the forehead, a big fluffy tail, a calm kind smile with the mouth closed. It must look different from the arctic fox 눈송 and the fox 호야: a longer muzzle, gray (not white, not orange) fur, a crescent mark (not a snowflake)', egg: 'a deep blue-gray egg with silver crescent-moon and star patterns, resting on a bed of moonlit grass', f: {
    1: 'baby stage: a small round fluffy pup with oversized paws and ears, no accessories',
    2: 'grown stage: a leaner young wolf standing tall on four legs with a thick ruff around the neck (NOT a round pup), a navy scarf with a small gold star charm',
    3: 'final stage: a large, majestic and kind wolf, silver fur glowing softly like moonlight with a golden rim, a thick flowing ruff, a flowing deep-navy cape with silver stars and gold trim fastened by a gold star clasp, a glowing crescent-moon circlet, a big soft full moon behind it and floating starlight (NOT a round pup; noble and gentle, never fierce: mouth closed, no bared teeth)' } },
  crocodile: { ko: '덥썩', type: '악어', tier: 'epic', limb: 'one front foot', base: 'a cute baby-faced crocodile with a soft olive-green body, a cream-yellow belly, rounded bumpy darker-green scales along the back, a short wide snout with a closed friendly smile and two tiny round nostrils (no sharp teeth showing), big glossy golden eyes on top of the head with white highlights, pink blush, short stubby legs, a thick curled tail. Cute and friendly, never scary', egg: 'a speckled olive-green egg with darker scale-texture patterns, resting in a nest of reeds at the riverbank', f: {
    1: 'baby stage: a tiny, very round hatchling with a stubby tail and a small piece of eggshell still on its head, no other accessories',
    2: 'grown stage: a longer young crocodile standing on four short sturdy legs (NOT a round hatchling), a mint scarf with a small gold star charm, small rounded ridge spikes along the back',
    3: 'final stage: a grand crocodile king with glossy emerald scales edged in gold, a flowing jungle-green cape with gold trim fastened by a gold star clasp, a golden crown with an emerald gem, floating water-lily petals and golden sparkles around, a big friendly closed-mouth smile (NOT a round hatchling; never scary: no open jaws, no big teeth)' } },
  octopus: { ko: '말랑', type: '문어', tier: 'epic', limb: 'one tentacle', base: 'a cute round octopus with a soft coral-pink and lavender body, a big smooth round head, eight short curly tentacles with pale-pink suckers, big glossy dark-violet eyes with white highlights, pink blush, a tiny happy smile, a small seashell bow on the head. It must look different from the jellyfish-like or squid shapes: a round head and eight short curly tentacles', egg: 'a pearly lavender egg with soft swirling wave and bubble patterns and tiny suction-cup dots, resting on a seashell', f: {
    1: 'baby stage: a tiny, very round octopus with short stubby tentacles, the small seashell bow, no other accessories',
    2: 'grown stage: a bigger octopus with longer curly tentacles holding a tiny starfish and a small bubble (NOT a tiny baby), a mint ribbon with a small gold star charm',
    3: 'final stage: a grand octopus with long elegant swirling tentacles, each holding a small treasure (a pearl, a shell, a starfish, a tiny gold star), a pearl crown with an aqua gem, a shimmering sea-silk cape draped over its head with gold trim and a gold star clasp, floating bubbles and golden sparkles (NOT a tiny baby)' } }
};
designSheets(F18A, NEW_PETS_18, pet => pet.tier === 'epic' ? 'A 영웅 (epic) pet, one rank below legendary: a little grander and more sparkling than a basic pet, with a soft golden rim light. ' : '');
exprSheets(F18B, NEW_PETS_18, [['frog', 'sapsaree'], ['deer', 'bear'], ['seal', 'wolf'], ['crocodile', 'octopus']], pet => ` In every cell that says a paw, arm, wing, flipper or hand is raised, this pet raises ${pet.limb} instead.${pet.tier === 'epic' ? ' A 영웅 (epic) pet: a soft golden rim light.' : ''}`);

/* Google Drive: 그림을 그리는 GPT는 Drive에서 참고 그림을 열어 보고, 결과를 Drive 폴더에 올려요.
   규칙: 시트별 파일(split/)로 나가는 모든 주문서는 DRIVE에 폴더가 있어야 하고(없으면 멈춰요),
   끝에 "이 폴더에 이 이름으로 올리기"가 붙어요. 처음 그리는 그림(08·09a)은 기존 그림을 열어 보고 그림체를 맞춰요. */
const DRIVE = {
  [F5]: 'SUMUS 에셋 05·06 (Runner용)', [F6]: 'SUMUS 에셋 05·06 (Runner용)',
  [F7A]: 'SUMUS 전설 펫 07 (Runner용)', [F7B]: 'SUMUS 전설 펫 07 (Runner용)',
  [F8]: 'SUMUS 메뉴·학습 08 (Runner용)',
  [F9A]: 'SUMUS 새 기본 펫 09 (Runner용)', [F9B]: 'SUMUS 새 기본 펫 09 (Runner용)',
  [F10]: 'SUMUS 몬스터 10 (Runner용)',
  [F12]: 'SUMUS 몬스터 12 (Runner용)',
  [F11]: 'SUMUS 칭호 11 (Runner용)',
  [F14A]: 'SUMUS 할로윈 14 (Runner용)', [F14B]: 'SUMUS 할로윈 14 (Runner용)',
  [F15]: 'SUMUS 전투 배경 15 (Runner용)',
  [F16]: 'SUMUS 몽이·핑키 16 (Runner용)',
  [F17A]: 'SUMUS 새 펫 17 (Runner용)', [F17B]: 'SUMUS 새 펫 17 (Runner용)',
  [F18A]: 'SUMUS 새 펫 18 (Runner용)', [F18B]: 'SUMUS 새 펫 18 (Runner용)'
};
const PET_SPRITES = 'SUMUS_PET_SPRITES_ALL_20261002/original_1254';
const KEEP = 'Do NOT make it softer, blurrier, foggier, more painterly or more watercolor-like than the reference.';
const STYLE_REF = {
  pets: `STYLE REFERENCE — before drawing, open these pictures in Google Drive and study them: the existing pets of this game in the Drive folder "${PET_SPRITES}" (the folders MONG, NABI, PINKY and BAMBOO, each with 01_baby.png, 02_grown.png and 03_final.png). Draw the new pet in exactly that art style: the same crisp, clean shapes and edges, the same clear soft pastel colors (not washed out, not hazy), the same glossy eyes with white highlights, the same light cel-like shading with a thin warm rim light, the same simple fur tufts and the same body proportions (big head, short legs). ${KEEP} Do NOT copy the reference animals.`,
  icons: `STYLE REFERENCE — before drawing, open "06-3.png" and "06-4.png" in the Google Drive folder "${DRIVE[F6]}": they show game art already used in this app (capsule machine, ticket, jackpot, capsules). Draw the new icons in exactly that style: the same glossy 3D toy-like look, the same chunky rounded shapes, the same bright pastel-and-mint palette, the same clean edges and soft lighting. Do NOT copy the reference objects.`,
  monsters: `STYLE REFERENCE — before drawing, open these pictures in Google Drive and study them: the pets of this game in the Drive folder "${PET_SPRITES}" (the folders MONG, NABI, PINKY and BAMBOO, 02_grown.png and 03_final.png) and "09a-1.png" in the Google Drive folder "${DRIVE[F9A]}". Draw the monster in exactly that art style and rendering quality: the same crisp, clean shapes and edges, the same clear colors, the same glossy eyes with white highlights, the same light cel-like shading and rim light, so it looks like it belongs in the same game as those pets. ${KEEP} Do NOT copy the reference pets. Also open "10-1.png" in the Google Drive folder "${DRIVE[F10]}" (the first monster of this set) if it is there, and match its finish and size.`,
  badges: `STYLE REFERENCE — before drawing, open "07a-5.png" in the Google Drive folder "${DRIVE[F7A]}" (legendary egg and badge) and "06-3.png" in the Google Drive folder "${DRIVE[F6]}" (jackpot): they show shiny game art already used in this app. Draw the new medals or stamps in exactly that style: the same shiny metal and gem rendering, the same clean outline and soft sparkles. Do NOT copy the reference objects.`,
  titles: `STYLE REFERENCE — before drawing, open these pictures in Google Drive and study them: "07a-5.png" in the Google Drive folder "${DRIVE[F7A]}" (legendary badge), "06-3.png" in the Google Drive folder "${DRIVE[F6]}" (jackpot and ticket) and "10-10.png" in the Google Drive folder "${DRIVE[F10]}" (shield badges) if it is there. They show shiny game art already used in this app. Draw the medals in exactly that style: the same glossy 3D toy-like metal and enamel, the same chunky rounded shapes, the same clean edges and soft sparkles, the same bright clear colors. ${KEEP} Do NOT copy the reference objects.`
};
STYLE_REF.monsters12 = STYLE_REF.monsters.replace(/Also open "10-1\.png"[^\n]*$/, `Also open the first monsters of this game in the Google Drive folder "${DRIVE[F10]}" ("10-1.png" and "10-8.png"; this new set is their second batch, so match their finish, size and level of detail exactly) and, if it is there, "12-1.png" in the Google Drive folder "${DRIVE[F12]}" (the first monster of the new set), and match its finish and size too. Do NOT copy the existing monsters; this is a new design.`);
STYLE_REF.icons12 = `${STYLE_REF.icons} Also open "10-10.png" in the Google Drive folder "${DRIVE[F10]}" (the monster screen icons: tab and difficulty badges) and match its finish and size.`;
const refOf = p => p.bg ? null : p.file === F14A || p.file === F17A || p.file === F18A ? 'pets' : p.file === F14B && /아이콘/.test(p.title) ? 'icons' : p.file === F11 ? 'titles' : p.file === F12 ? (/아이콘/.test(p.title) ? 'icons12' : 'monsters12') : p.file === F10 ? (/아이콘/.test(p.title) ? 'icons' : 'monsters') : p.file === F9A ? 'pets' : p.file !== F8 ? null : /성취 배지|결과 도장/.test(p.title) ? 'badges' : 'icons';
const NEW_ORDER = Object.keys(NEW_PETS);
const sheetName = (file, i) => `${file.slice(0, /^\d\d[ab]-/.test(file) ? 3 : 2)}-${i + 1}`;

/* 쓰기 */
const byFile = new Map();
for (const p of prompts) (byFile.get(p.file) || byFile.set(p.file, []).get(p.file)).push(p);
const SPLIT = new Set([F5, F6, F7A, F7B, F8, F9A, F9B, F10, F11, F12, F14A, F14B, F15, F16, F17A, F17B, F18A, F18B]);
for (const [file, list] of byFile) list.forEach((p, i) => {
  if (!SPLIT.has(file)) return;
  if (!DRIVE[file]) throw new Error(`${file}: Google Drive 폴더(DRIVE)가 없어요. 주문서에는 업로드 위치가 꼭 있어야 해요.`);
  let lines = p.text.split('\n');
  const ref = refOf(p);
  if (ref) {
    lines = lines.filter(l => !l.startsWith('If a reference picture of this character'));
    lines.splice(2, 0, STYLE_REF[ref]);
    p.ref = `Drive: ${ref === 'pets' || ref === 'monsters' ? PET_SPRITES : ref === 'monsters12' ? `${PET_SPRITES}, 10-1.png, 10-8.png` : ref === 'icons12' ? '06-3.png, 06-4.png, 10-10.png' : ref === 'icons' ? '06-3.png, 06-4.png' : ref === 'titles' ? '07a-5.png, 06-3.png, 10-10.png' : '07a-5.png, 06-3.png'}`;
  }
  // 11 칭호: 뒤 시트는 같은 등급이 처음 나온 시트(와 11-1)를 열어 테두리·크기를 똑같이 맞춰요.
  if (file === F11 && i > 0) {
    // Sheet numbers start at 1; this is sheet i + 1, so an earlier sheet has a number <= i.
    const tiersHere = Object.keys(TITLE_FRAMES).filter(tier => p.text.includes(TITLE_FRAMES[tier]));
    const earlier = [...new Set([1, ...tiersHere.map(tier => TITLE_TIER_SHEET[tier]).filter(n => n <= i)])].map(n => `"11-${n}.png"`);
    lines.splice(3, 0, `Also open ${earlier.join(' and ')} in the same Google Drive folder "${DRIVE[F11]}" (earlier medals of this set) if they are there, and match their medal size, metal finish and lighting exactly; a medal of the same tier must have exactly the same frame.`);
  }
  // 메뉴 아이콘 2~5번 시트: 같은 세트의 첫 시트(08-1.png)와도 맞춰요.
  if (file === F8 && ref === 'icons' && /메뉴 아이콘 [2-9]/.test(p.title)) lines.splice(3, 0, `Also open "08-1.png" in the same Google Drive folder "${DRIVE[F8]}" (the first icons of this set) if it is there, and match it exactly.`);
  // 09b: 그 펫의 설정 시트(09a-N.png)를 Drive에서 열어 얼굴·무늬·크기를 맞춰요.
  if (file === F9B) {
    const keys = NEW_ORDER.filter(k => p.title.includes(NEW_PETS[k].ko));
    const sheets = keys.map(k => `"09a-${NEW_ORDER.indexOf(k) + 1}.png"`).join(' and ');
    lines = lines.filter(l => !l.startsWith('If a reference picture of this character'));
    lines.splice(3, 0, `CHARACTER REFERENCE — before drawing, open ${sheets} (the design sheet${keys.length > 1 ? 's' : ''}: egg, baby, grown, final) in the Google Drive folder "${DRIVE[F9B]}" and match ${keys.length > 1 ? 'each egg' : 'this pet\'s face, colors, markings, accessories and the body size of this growth stage'} exactly. ${KEEP}`);
    p.ref = `Drive: ${sheets}`;
  }
  // 14b·17b: 그 펫의 설정 시트(14a-N / 17a-N)를 열어 맞춰요. 배경은 기존 캐릭터를 열어 그림체만 맞춰요.
  const XB = { [F14B]: [F14A, HALLOWEEN_PETS, '14a'], [F17B]: [F17A, NEW_PETS_17, '17a'], [F18B]: [F18A, NEW_PETS_18, '18a'] }[file];
  if (XB && !p.bg && !/아이콘/.test(p.title)) {
    const order = Object.keys(XB[1]), keys = order.filter(k => p.title.includes(XB[1][k].ko));
    const sheets = keys.map(k => `"${XB[2]}-${order.indexOf(k) + 1}.png"`).join(' and ');
    lines = lines.filter(l => !l.startsWith('If a reference picture of this character'));
    lines.splice(3, 0, `CHARACTER REFERENCE — before drawing, open ${sheets} (the design sheet${keys.length > 1 ? 's' : ''}: egg, baby, grown, final) in the Google Drive folder "${DRIVE[XB[0]]}" and match ${keys.length > 1 ? 'each egg' : 'this pet\'s face, colors, markings, accessories and the body size of this growth stage'} exactly. ${KEEP}`);
    p.ref = `Drive: ${sheets}`;
  }
  if (p.bg) {
    lines.splice(2, 0, BG_REF);
    if (file === F15 && i > 0) lines.splice(3, 0, `Also open "15-1.png" in the same Google Drive folder "${DRIVE[F15]}" (the first background of this set) if it is there, and match its camera angle, floor size, lighting style and level of detail exactly.`);
    p.ref = `Drive: ${PET_SPRITES}, 10-1.png, 10-8.png`;
  }
  // 16: 지금 몽이·핑키(아기는 그대로 이어받기)와 목표 퀄리티(밤부 최종)를 열어 보고, 뒤 시트는 앞 시트의 새 디자인을 따라요.
  if (file === F16) {
    const pets = Object.values(REMAKE).filter(r => p.title.includes(r.ko));
    lines = lines.filter(l => !l.startsWith('If a reference picture of this character'));
    lines.splice(2, 0, `STYLE AND CHARACTER REFERENCE — before drawing, open these pictures in the Google Drive folder "${PET_SPRITES}": ${pets.map(r => `${r.drive}/01_baby.png (keep exactly this face, fur colors, markings and eyes; the new design grows from this baby)`).join(' and ')}, and BAMBOO/03_final.png (the target quality: the new grown and final stages must be as grand, detailed and polished as this panda). This is a REDESIGN of the grown and final stages: do NOT copy the old ${pets.map(r => `${r.drive}/02_grown.png and ${r.drive}/03_final.png`).join(' or ')} (they were too plain), and make each stage clearly different and grander than the one before. Clean transparent cut-out: no white halo, no leftover background around the outline. ${KEEP}`);
    const earlier = { '몽이 새 최종': '16-1', '핑키 새 최종': '16-3', '몽이 · 핑키 새 응원': '16-1", "16-2", "16-3" and "16-4' }[p.title];
    if (earlier) lines.splice(3, 0, `Also open "${earlier}.png" in the same Google Drive folder "${DRIVE[F16]}" (the new design made earlier in this set) and keep the same new design exactly.`);
    p.ref = `Drive: ${pets.map(r => r.drive + '/01_baby').join(', ')}, BAMBOO/03_final`;
  }
  const name = sheetName(file, i);
  if (p.bg) {
    lines.push(`WHEN DONE — upload the finished PNG (1536×1024, fully painted, not transparent) to Google Drive, into the folder "${DRIVE[file]}", named exactly "${name}.png" (if a file with that name is already there, replace it). Actually save the file to Google Drive; showing the picture in the chat is not enough.`);
    p.text = lines.join('\n'); p.drive = `${DRIVE[file]} / ${name}.png`;
    return;
  }
  lines.push(`WHEN DONE — upload the finished transparent PNG to Google Drive, into the folder "${DRIVE[file]}", named exactly "${name}.png" (if a file with that name is already there, replace it). Actually save the file to Google Drive; showing the picture in the chat is not enough.`);
  p.text = lines.join('\n');
  p.drive = `${DRIVE[file]} / ${name}.png`;
});
for (const [file, list] of byFile) writeFileSync(resolve(here, file), list.map(p => p.text).join('\n---\n') + '\n');
writeFileSync(resolve(here, '00-all-in-order.txt'), prompts.map(p => p.text).join('\n---\n') + '\n');
// Sheets that each need their own chat (their own reference picture) also go one per file in split/.
mkdirSync(resolve(here, 'split'), { recursive: true });
for (const [file, list] of byFile) if (SPLIT.has(file)) list.forEach((p, i) => writeFileSync(resolve(here, 'split', `${sheetName(file, i)} ${p.title.replace(/[\\/:*?"<>|()]/g, '').replace(/\s+/g, ' ').trim()}.txt`), p.text + '\n'));
const csv = v => `"${String(v).replace(/"/g, '""')}"`;
writeFileSync(resolve(here, 'slice-map.csv'), '﻿' + ['list,prompt_no,sheet,cell,key,name,app_file', ...slices.map(s => [s.file, String(s.no).padStart(3, '0'), s.title, s.cell, s.key, s.name, s.out].map(csv).join(','))].join('\n') + '\n');
console.log([...byFile].map(([f, l]) => `${f}: ${l.length} prompts → ${l.length * 4} images`).join('\n'));
