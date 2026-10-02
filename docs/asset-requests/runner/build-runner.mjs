// SUMUS Prompt Runner용 프롬프트 목록 만들기 (ChatGPT 웹, 프롬프트 사이는 ---).
//   node docs/asset-requests/runner/build-runner.mjs
// 한 프롬프트 = 그림 4장(2×2 시트, 1024×1024). 받은 시트는 slice-map.csv대로 4칸으로 잘라 앱에 넣어요.
// 급한 순서: 01 가위바위보·로보 → 02 펫 표정 → 03 UI 아이콘·트로피 → 04 다시 만들 것 → 05 가위바위보 팔(만화 연출)
// → 06 로보 쉬움·보통 표정, 코인 뽑기 머신·캡슐, 알 반응 (Codex 작업: CODEX_PROMPT_06.md).
import { writeFileSync } from 'node:fs';
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

/* 쓰기 */
const byFile = new Map();
for (const p of prompts) (byFile.get(p.file) || byFile.set(p.file, []).get(p.file)).push(p);
for (const [file, list] of byFile) writeFileSync(resolve(here, file), list.map(p => p.text).join('\n---\n') + '\n');
writeFileSync(resolve(here, '00-all-in-order.txt'), prompts.map(p => p.text).join('\n---\n') + '\n');
const csv = v => `"${String(v).replace(/"/g, '""')}"`;
writeFileSync(resolve(here, 'slice-map.csv'), '﻿' + ['list,prompt_no,sheet,cell,key,name,app_file', ...slices.map(s => [s.file, String(s.no).padStart(3, '0'), s.title, s.cell, s.key, s.name, s.out].map(csv).join(','))].join('\n') + '\n');
console.log([...byFile].map(([f, l]) => `${f}: ${l.length} prompts → ${l.length * 4} images`).join('\n'));
