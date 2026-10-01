// SUMUS Prompt Runner용 프롬프트 목록 만들기 (ChatGPT 웹, 프롬프트 사이는 ---).
//   node docs/asset-requests/runner/build-runner.mjs
// 한 프롬프트 = 그림 4장(2×2 시트, 1024×1024). 받은 시트는 slice-map.csv대로 4칸으로 잘라 앱에 넣어요.
// 급한 순서: 01 가위바위보·로보 → 02 펫 표정 → 03 UI 아이콘·트로피.
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
  emblem: 'Style: shiny 3D game trophy/badge, metallic with soft gem highlights, symmetric, readable at 64 pixels, one object per cell.'
};

const ROBO = 'The robot "로보": a chubby chibi robot about 2.3 heads tall. Round white helmet head with a large black glossy visor screen; the screen shows its face as glowing mint lines (default: happy ^ ^ eyes and a tiny pink tongue smile). A thin antenna on top ending in a glossy mint ball. Round mint ear-discs on both sides of the head. White rounded body with a glowing mint circular core on the chest, mint panel lines, chunky white arms with mint joints, chunky robot hands with five rounded fingers, short sturdy legs with mint knee pads. Faces the viewer.';

// 펫 설명 (그림을 보고 쓴 것) — 형태 1 아기, 2 성장, 3 최종.
const PETS = {
  dog: { ko: '몽이', base: 'a Shiba-like puppy with cream and soft golden-orange fur, white chest and muzzle, large pointed ears with pink insides, big glossy brown eyes, a huge fluffy curled tail', f: {
    1: 'baby stage: small, very round and fluffy, big head, no accessories',
    2: 'grown stage: a little taller and slimmer, wearing a green bandana scarf with a small gold star charm',
    3: 'final stage: larger and proud, wearing a flowing green cape with gold trim fastened by a gold star clasp, small white feathered angel wings, a few golden sparkles around' } },
  pig: { ko: '핑키', base: 'a round pastel-pink piglet with soft pink skin, small floppy ears with pink insides, a round snout, big glossy brown eyes, a tiny curly tail', f: {
    1: 'baby stage: small, very round, no accessories',
    2: 'grown stage: a little bigger, wearing a green scarf with a small gold star charm',
    3: 'final stage: wearing a green cape with a gold star clasp, small white feathered wings, a soft golden sparkle aura' } },
  cat: { ko: '나비', base: 'a silver-grey tabby kitten with darker grey stripes, white chest, white paws and white muzzle, pink ear insides, big glossy amber eyes, a fluffy striped tail', f: {
    1: 'baby stage: small, round and fluffy, sitting-size proportions, no accessories',
    2: 'grown stage: slimmer and longer, a small gold star charm on the chest',
    3: 'final stage: a long elegant fluffy cat with flowing fur edged in a soft golden glow, a gold star charm, golden sparkles' } },
  dragon: { ko: '용이', base: 'a fluffy white baby dragon with pastel aqua-blue scales along the spine, tail and paws, small curved golden horns, aqua ear fins, big glossy sky-blue eyes', f: {
    1: 'baby stage: small and round, tiny wing nubs, no accessories',
    2: 'grown stage: translucent pastel-blue wings, longer scaled tail, a small gold star on the chest',
    3: 'final stage: larger with wide translucent blue wings edged in gold, more aqua scales, a gold star on the chest, golden sparkles' } },
  panda: { ko: '밤부', base: 'a round panda cub with very dark brown and white fur, dark eye patches, round dark ears, big glossy brown eyes, pink paw pads', f: {
    1: 'baby stage: small and round, holding a few green bamboo leaves',
    2: 'grown stage: bigger and sturdier, a garland of green bamboo leaves around the neck with a gold star',
    3: 'final stage: a bamboo-leaf crown, glowing golden leaf patterns on the dark fur, a gold star, soft golden sparkles' } },
  snake: { ko: '초롱', base: 'a cute little snake with a cream belly and green leaf-shaped scales, a crest of leafy green "hair" on the head, big glossy green eyes, coiled body', f: {
    1: 'baby stage: short, chubby coil, small leaf crest',
    2: 'grown stage: longer S-shaped coil, more leaves along the back',
    3: 'final stage: a long elegant coil with glowing golden-green leaf scales and a fuller leafy crest, golden sparkles' } },
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
  ['sad', '시무룩', 'SAD: slightly sad pouty face with teary sparkling eyes, ears and head drooping a little, still cute (not crying hard)'],
  ['cheer', '응원', 'CHEERING: energetic pose with one front paw (or the tail tip for the snake) raised high, determined sparkling eyes, small motion sparkles']
];

const prompts = [];
const slices = [];
function sheet(file, title, styleKey, subject, cells) {
  const no = prompts.length + 1;
  const ref = styleKey === 'pet' || styleKey === 'robot' ? 'If a reference picture of this character was attached earlier in this conversation, match its face, colors and markings exactly.' : '';
  const lines = [SHEET, STYLE[styleKey], subject && `Subject: ${subject}`, ref, ...cells.map((c, i) => `${CELLS[i]} cell: ${c[2]}`)].filter(Boolean);
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

/* 쓰기 */
const byFile = new Map();
for (const p of prompts) (byFile.get(p.file) || byFile.set(p.file, []).get(p.file)).push(p);
for (const [file, list] of byFile) writeFileSync(resolve(here, file), list.map(p => p.text).join('\n---\n') + '\n');
writeFileSync(resolve(here, '00-all-in-order.txt'), prompts.map(p => p.text).join('\n---\n') + '\n');
const csv = v => `"${String(v).replace(/"/g, '""')}"`;
writeFileSync(resolve(here, 'slice-map.csv'), '﻿' + ['list,prompt_no,sheet,cell,key,name,app_file', ...slices.map(s => [s.file, String(s.no).padStart(3, '0'), s.title, s.cell, s.key, s.name, s.out].map(csv).join(','))].join('\n') + '\n');
console.log([...byFile].map(([f, l]) => `${f}: ${l.length} prompts → ${l.length * 4} images`).join('\n'));
