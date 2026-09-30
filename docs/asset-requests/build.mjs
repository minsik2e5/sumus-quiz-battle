// SUMUS ASSET STUDIO 대기열 만들기.
//   node docs/asset-requests/build.mjs
// → asset-manifest.json (전체, 기계용) · queue-phase1.csv / queue-phase2.csv (아직 없는 그림만) ·
//   all-assets.csv (전체 목록, 이미 있는 것은 status=done)
//
// 규칙
// - phase 1 = 마스터(처음 그리는 캐릭터의 기준 그림). 사람이 한 장을 승인해 `file`에 저장.
// - phase 2 = 마스터나 기존 그림을 "고정 참조"로 그리는 나머지. 이전 결과물을 이어 쓰지 않음.
// - 파일 이름이 곧 앱 안의 자리예요. 같은 이름으로 저장되면 앱에 연결만 하면 됩니다.
import { existsSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../..');

/* ---------- 공통 스타일 (스튜디오의 스타일 프리셋) ---------- */
const PRESETS = {
  pet: 'Cute chibi 3D-rendered mascot in exactly the same art style as the reference image: soft pastel colors, big glossy eyes, gentle rim light, smooth clean shading, very thin soft outline. One character, full body, 3/4 front view, centered, feet resting on an invisible baseline at 88% of the image height, 8% empty margin on every side. Transparent background, no ground shadow, no text, no frame, no border.',
  robot: 'Cute chibi 3D toy-like robot mascot in the same art style as the reference image: rounded glossy plastic shell with soft metal parts, big friendly screen eyes, pastel colors, gentle rim light. One character, full body, 3/4 front view, centered, feet on an invisible baseline at 88% of the image height, 8% margin. Transparent background, no ground shadow, no text.',
  boss: 'Cute-but-mighty chibi 3D game boss for a teen vocabulary game, same rendering quality as the reference: bold readable silhouette, playful menace (never gory or truly scary), glossy materials, strong rim light. One character, full body, facing slightly left toward the player, centered, 6% margin. Transparent background, no ground shadow, no text.',
  icon: 'Glossy 3D game UI icon, one object only, slight top-down front view, soft pastel palette with SUMUS mint green (#10B981) accents, clean edges readable at 48px, centered with 10% margin. Transparent background, no text, no letters.',
  emblem: 'Shiny 3D game badge/trophy, metallic with soft gem highlights, symmetric, centered with 8% margin, readable at 64px. Transparent background, no text, no letters.',
  scene: 'Soft painterly 3D game background, bright and friendly, gentle depth of field, no characters, no text; keep the central 60% calm and uncluttered for UI on top.',
  app: 'Square app icon artwork, full-bleed background to every edge (no rounded corners, no transparency), important content inside the central 80%, bold and readable at 60px, no text except where asked.'
};

/* ---------- 기존 펫 8종 ---------- */
const PETS = [
  ['dog', '몽이', 'puppy'], ['pig', '핑키', 'piglet'], ['cat', '나비', 'kitten'], ['dragon', '용이', 'baby dragon'],
  ['panda', '밤부', 'panda'], ['snake', '초롱', 'little snake'], ['rabbit', '토리', 'bunny'], ['fox', '호야', 'fox']
];
const FORM = { 0: '알', 1: '아기', 2: '성장', 3: '최종' };
// 표정 (character.js EXPRESSIONS 자리: {pet}-{form}-{expr}.webp)
const EXPRS = {
  happy: ['기뻐함', 'eyes closed in a big happy smile, rosy cheeks, 2-3 small hearts floating above the head', '쓰다듬기 반응 · 야차전 승리'],
  eat: ['냠냠', 'happily eating from a small round food bowl held in front, cheeks puffed, a few crumbs, eyes curved in joy', '밥 주기 반응'],
  sad: ['시무룩', 'slightly sad pouty face with teary sparkling eyes, ears/head drooping a little, still cute (not crying hard)', '야차전 패배 · 오래 쉬었을 때'],
  cheer: ['응원', 'energetic cheering pose with one arm (or paw/wing/tail) raised high, determined sparkling eyes, small motion sparkles', '야차전 공격 · 학습 시작']
};

/* ---------- 새 펫 8종 (색은 앱 테마색 color/light/soft) ---------- */
const NEW_PETS = [
  ['penguin', '펭구', 'PENGU', 'baby penguin with a tiny scarf', '#4A6FA5', '#A9C6EE', '#EEF4FC'],
  ['hamster', '햄찌', 'HAMJJI', 'chubby golden hamster with stuffed cheeks', '#E0A458', '#F6D29B', '#FFF6E9'],
  ['tiger', '호랭', 'HORANG', 'Korean tiger cub with soft orange stripes', '#EE8A2F', '#FFC57A', '#FFF3E5'],
  ['bear', '곰돌', 'GOMDOL', 'brown teddy bear cub with a honey-colored belly', '#9A6B4A', '#D8B08C', '#F8EFE7'],
  ['turtle', '꼬북', 'KKOBUK', 'sea turtle with a glossy mint shell', '#3FAF9A', '#9BE3D2', '#EAF9F5'],
  ['unicorn', '유니', 'UNI', 'pastel unicorn foal with a rainbow mane and small star horn', '#B18CE8', '#E2D0FF', '#F7F1FF'],
  ['axolotl', '우파', 'UPA', 'pink axolotl with frilly gills and a sweet smile', '#F28DB2', '#FFC9DC', '#FFF0F6'],
  ['owl', '부엉', 'BUNG', 'round owlet with big study-glasses-like eye rings', '#8C6FBE', '#CDBEF0', '#F5F1FC']
];
const GROWTH = {
  1: 'the BABY stage of this exact character: smaller, rounder, bigger head, very young, simpler details, same colors and markings',
  3: 'the FINAL evolved stage of this exact character: taller and more majestic, same face and colors, one or two elegant extra details (small cape, glowing accents or ornaments), still cute',
  0: 'the EGG of this character: a smooth glossy egg with its colors and a hint of its markings (e.g. stripes, scales, spots), a small crack-free surface, same size and angle as the reference egg'
};

/* ---------- 자동 대결 로보 (연습 상대) ---------- */
const ROBOTS = [
  // key, 이름, 성격, 난이도/모드, 디자인
  ['ppippo', '삐뽀', '느긋한 청소 로봇. 가끔 틀려요', '쉬움', 'small round vacuum-cleaner robot with a mop tuft and sleepy blinking screen eyes, mint and white'],
  ['robo', '로보', '기본 연습 상대(지금의 로보)', '보통', 'use the existing robo design exactly'],
  ['zap', '번개봇', '엄청 빠르지만 덜렁대요', '스피드전', 'lightning-fast racing robot with a lightning-bolt antenna and wheel feet, yellow and electric blue'],
  ['speller', '스펠봇', '철자 쓰기의 달인', '실력전', 'typewriter-headed robot with keyboard-key buttons on its chest, cream and teal'],
  ['guardian', '가디언', '느리지만 거의 안 틀려요', '어려움', 'sturdy knight-like shield robot with a visor, navy and silver with gold trim'],
  ['ninja', '닌자봇', '갑자기 빨라졌다 느려졌다', '변칙', 'sleek ninja robot with a scarf and a tiny shuriken badge, charcoal and mint'],
  ['teacher', '티처봇', '틀린 단어를 다시 내는 선생님 로봇', '복습 대결', 'friendly teacher robot with round glasses, a pointer stick and a tiny chalkboard, green and beige'],
  ['king', '킹봇', '주간 최강 로봇(보스 전 단계)', '최강', 'royal robot with a crown-shaped head, cape and golden armor plates, purple and gold']
];

/* ---------- 보스 (나중에: 반 전체가 단어로 함께 무찌르는 보스전) ---------- */
const BOSSES = [
  ['slime', '스펠링 슬라임', 1, 'jelly slime made of jumbled alphabet letters floating inside, wobbly and silly'],
  ['forgetghost', '까먹귀', 2, 'mischievous little ghost that erases words, holding a giant pink eraser, trailing faded letters'],
  ['clock', '째깍 도둑', 3, 'sneaky clock monster with a mask and a sack of stolen minutes, ticking hands as arms'],
  ['golem', '문법 골렘', 4, 'stone golem built from grammar blocks and punctuation marks, glowing rune-like commas'],
  ['phone', '폰마왕', 5, 'demon-king smartphone with notification bubbles as horns, tempting glowing screen, cheeky grin'],
  ['pirate', '오답 해적 선장', 6, 'pirate captain made of crossed-out wrong answers, red X eyepatch, parrot-like red pen'],
  ['owlnight', '밤샘 부엉 대장', 7, 'huge sleepy-but-grumpy owl general with dark circles, armored in stacked notebooks'],
  ['dictdragon', '딕셔너리 드래곤', 8, 'grand dragon whose wings are open dictionary pages and scales are tiny letters'],
  ['finalking', '수능 대마왕', 9, 'final boss: towering exam demon king in an armor of test papers, crown of pencils, OMR-card cape']
];
const BOSS_STATES = {
  idle: ['기본', 'standing ready, confident taunting pose'],
  hurt: ['맞음', 'recoiling from a hit, squinting eyes, small impact stars, a few letters flying off'],
  rage: ['분노(체력 30% 이하)', 'furious powered-up form, glowing red-orange aura, fiercer eyes, same design'],
  down: ['쓰러짐', 'defeated and knocked down comically, swirl eyes, little stars circling the head']
};

/* ---------- 항목 만들기 ---------- */
const items = [];
const add = x => items.push({ quality: 'high', count: 3, background: 'transparent', ...x });

// 1. 기존 펫 표정 (고정 참조 = 그 펫·단계 기존 그림)
for (const [key, ko, kind] of PETS) for (const form of [1, 2, 3]) for (const [expr, [label, pose, use]] of Object.entries(EXPRS)) {
  add({ project: '01-pets-expressions', id: `pet-${key}-${form}-${expr}`, name: `${ko} ${FORM[form]} ${label}`, file: `public/assets/pets/${key}-${form}-${expr}.webp`, size: '1024x1024', out: '512x512', phase: 2, preset: 'pet',
    reference: [`public/assets/pets/${key}-${form}.webp`],
    prompt: `The exact same ${kind} character as the reference (${ko}, ${FORM[form]} stage): keep body proportions, colors, markings and accessories identical. Change only the expression and pose: ${pose}.`,
    use, priority: expr === 'happy' ? 1 : expr === 'eat' ? 2 : 3 });
}
// 2. 기존 펫 달리기 (6프레임 가로 시트, 어려움 → 후보 4장, 사람이 확인)
for (const [key, ko, kind] of PETS) for (const form of [1, 2, 3]) {
  add({ project: '02-pets-run', id: `pet-${key}-${form}-run`, name: `${ko} ${FORM[form]} 달리기 6프레임`, file: `public/assets/pets/${key}-${form}-run.webp`, size: '1536x256', out: '3072x512', phase: 2, preset: 'pet', count: 4,
    reference: [`public/assets/pets/${key}-${form}.webp`, 'public/assets/pets/dog-1-run.webp'],
    prompt: `A horizontal sprite sheet of 6 equal square frames (side by side, no gaps, no dividers) showing the exact same ${kind} character as the first reference running in a loop, side view facing right, like the second reference sheet. Identical character size and baseline in every frame.`,
    use: '홈 카드에서 펫을 누르면 달리기', priority: 4 });
}
// 3. 새 펫: phase 1 마스터(성장 단계), phase 2 나머지
for (const [key, ko, en, design, color, light, soft] of NEW_PETS) {
  const master = `public/assets/pets/${key}-2.webp`;
  add({ project: '03-new-pets', id: `pet-${key}-2`, name: `${ko} 성장 (마스터)`, file: master, size: '1024x1024', out: '512x512', phase: 1, preset: 'pet', count: 4,
    reference: ['public/assets/pets/dog-2.webp', 'public/assets/pets/dragon-2.webp'],
    prompt: `A brand-new pet character "${ko}" (${en}): ${design}. Growing (middle) stage, lively and friendly. Main color ${color}, light accent ${light}. Match the style, size, pose and lighting of the reference pets exactly, but it is a different animal.`,
    use: `새 펫 ${ko}의 기준 그림. 승인한 한 장이 이후 모든 그림의 참조`, priority: 1, theme: { color, light, soft }, en });
  for (const form of [0, 1, 3]) add({ project: '03-new-pets', id: `pet-${key}-${form}`, name: `${ko} ${FORM[form]}`, file: `public/assets/pets/${key}-${form}.webp`, size: '1024x1024', out: '512x512', phase: 2, preset: 'pet',
    reference: form === 0 ? [master, 'public/assets/pets/dog-0.webp'] : [master],
    prompt: `${GROWTH[form]}. Character: ${ko} (${design}).`, use: `새 펫 ${ko} ${FORM[form]} 단계`, priority: 1, after: `pet-${key}-2` });
  for (const form of [1, 2, 3]) for (const [expr, [label, pose, use]] of Object.entries(EXPRS)) add({ project: '03-new-pets', id: `pet-${key}-${form}-${expr}`, name: `${ko} ${FORM[form]} ${label}`, file: `public/assets/pets/${key}-${form}-${expr}.webp`, size: '1024x1024', out: '512x512', phase: 2, preset: 'pet',
    reference: [`public/assets/pets/${key}-${form}.webp`],
    prompt: `The exact same character as the reference (${ko}, ${FORM[form]} stage). Change only the expression and pose: ${pose}.`, use, priority: 3, after: `pet-${key}-${form}` });
}
// 4. 로보 (자동 대결 상대)
for (const [key, ko, personality, level, design] of ROBOTS) {
  const existing = key === 'robo';
  const master = existing ? 'public/assets/pets/robot-2.webp' : `public/assets/bots/${key}.webp`;
  if (!existing) add({ project: '04-robots', id: `bot-${key}`, name: `${ko} (마스터)`, file: master, size: '1024x1024', out: '512x512', phase: 1, preset: 'robot', count: 4,
    reference: ['public/assets/pets/robot-2.webp'],
    prompt: `A new practice-opponent robot "${ko}": ${design}. Personality: ${personality}. Same style family as the reference robot but clearly a different design.`,
    use: `연습 대결 상대 · ${level}`, priority: 2 });
  for (const [expr, [label, pose]] of Object.entries({ happy: EXPRS.happy, sad: EXPRS.sad, cheer: EXPRS.cheer })) {
    const forms = existing ? [1, 2, 3] : [null];
    for (const form of forms) add({ project: '04-robots', id: existing ? `pet-robot-${form}-${expr}` : `bot-${key}-${expr}`, name: `${ko}${form ? ` ${form}단계` : ''} ${label}`,
      file: existing ? `public/assets/pets/robot-${form}-${expr}.webp` : `public/assets/bots/${key}-${expr}.webp`, size: '1024x1024', out: '512x512', phase: 2, preset: 'robot',
      reference: [existing ? `public/assets/pets/robot-${form}.webp` : master],
      prompt: `The exact same robot as the reference. Change only the expression and pose (screen eyes may change shape): ${pose}.`,
      use: `로보 대결 ${expr === 'happy' ? '승리' : expr === 'sad' ? '패배' : '공격'}`, priority: 3, after: existing ? undefined : `bot-${key}` });
  }
}
// 5. 보스
for (const [key, ko, order, design] of BOSSES) {
  const master = `public/assets/bosses/${key}.webp`;
  add({ project: '05-bosses', id: `boss-${key}`, name: `보스 ${order}. ${ko} (마스터)`, file: master, size: '1024x1024', out: '768x768', phase: 1, preset: 'boss', count: 4,
    reference: ['public/assets/pets/dragon-3.webp'], prompt: `Boss #${order} "${ko}": ${design}. Pose: ${BOSS_STATES.idle[1]}.`, use: '보스전 기본 모습', priority: 5 });
  for (const [state, [label, pose]] of Object.entries(BOSS_STATES)) if (state !== 'idle') add({ project: '05-bosses', id: `boss-${key}-${state}`, name: `${ko} ${label}`, file: `public/assets/bosses/${key}-${state}.webp`, size: '1024x1024', out: '768x768', phase: 2, preset: 'boss',
    reference: [master], prompt: `The exact same boss as the reference ("${ko}"). Keep the design identical. Change only: ${pose}.`, use: `보스전 ${label}`, priority: 5, after: `boss-${key}` });
  add({ project: '05-bosses', id: `boss-${key}-badge`, name: `${ko} 격파 배지`, file: `public/assets/bosses/${key}-badge.webp`, size: '1024x1024', out: '256x256', phase: 2, preset: 'emblem', reference: [master, 'public/assets/ui/trophy.webp'],
    prompt: `A round victory badge with a tiny chibi face of the boss "${ko}" from the first reference in the center, laurel ring, ${order >= 7 ? 'gold and ruby' : order >= 4 ? 'silver and sapphire' : 'bronze and emerald'} finish.`, use: '보스 격파 기념(칭호 옆)', priority: 5, after: `boss-${key}` });
}
const ARENAS = [['classroom', '방과 후 교실', 'an empty sunny school classroom after class, desks pushed aside, chalkboard with doodles (no readable text)'], ['library', '한밤의 도서관', 'a magical library at night with floating books and warm lamps'], ['exam', '시험장', 'a dramatic exam hall with rows of desks under spotlights, slightly ominous purple sky through windows'], ['castle', '대마왕의 성', 'a cute-epic castle made of stacked textbooks and pencils, sunset sky']];
for (const [key, ko, desc] of ARENAS) add({ project: '05-bosses', id: `arena-${key}`, name: `보스 배경: ${ko}`, file: `public/assets/bosses/arena-${key}.webp`, size: '1536x1024', out: '1536x1024', phase: 2, preset: 'scene', background: 'opaque', count: 3,
  reference: [], prompt: `Boss battle stage background: ${desc}.`, use: '보스전 화면 배경', priority: 5 });
for (const [key, ko, desc] of [['hp-frame', '보스 체력바 틀', 'a long horizontal ornate health-bar frame, empty inside, gold and dark purple, 8:1 proportions'], ['hit', '타격 이펙트', 'a comic impact burst with stars and letter fragments, mint and yellow'], ['crit', '치명타 이펙트', 'a bigger explosive critical-hit burst with lightning, orange and pink'], ['chest-closed', '보상 상자(닫힘)', 'a treasure chest shaped like a pencil case, closed, gold trim'], ['chest-open', '보상 상자(열림)', 'the same pencil-case treasure chest opened, glowing coins and a star popping out']])
  add({ project: '05-bosses', id: `boss-ui-${key}`, name: ko, file: `public/assets/bosses/${key}.webp`, size: '1024x1024', out: key === 'hp-frame' ? '1024x128' : '512x512', phase: 2, preset: 'icon', reference: ['public/assets/ui/trophy.webp'], prompt: desc, use: '보스전 UI', priority: 5 });

// 6. UI 아이콘 (지금은 이모지)
const ICONS = [
  ['care-feed', '밥 주기', 'a round pet food bowl piled with kibble and a small bone-shaped cookie, a little steam', '교감 버튼 🍖'],
  ['care-pet', '쓰다듬기', 'one soft round open palm with two small hearts and curved petting motion lines', '교감 버튼 🤚'],
  ['care-warm', '알 데워주기', 'an egg wrapped in a cozy mint blanket with a tiny warm sun glow', '알 단계 교감 🔥'],
  ['notice', '선생님 공지', 'a mint megaphone with small sparkles', '공지 📢'],
  ['bell', '알림', 'a golden bell with a small paw print, two ringing lines', '알림 켜기 🔔'],
  ['star-word', '어려운 단어', 'a chubby golden star badge with a soft shine', '★ 모아서 연습'],
  ['stopwatch', '실전 시간', 'a mint stopwatch with motion lines on the hand', '실전시험 초시계'],
  ['leave-warn', '화면 이탈', 'an orange smartphone with a small cute exclamation sign, warning but friendly', '📵 경고'],
  ['coin', '코인', 'a shiny gold coin with a mint S-shaped swirl engraved (no letters)', '코인 표시'],
  ['xp', '경험치', 'a glowing mint crystal shard with sparkles', '경험치 표시'],
  ['attendance', '출석', 'a calendar page with a big mint check stamp', '출석 체크'],
  ['gift', '선물 상자', 'a pastel gift box with a mint ribbon, lid slightly lifted with sparkles', '선물 도착'],
  ['egg-shop', '알 상점', 'a small shop stand with three colorful eggs on a cushion', '알 상점'],
  ['streak', '연속 학습', 'a friendly flame with a tiny smile', '연속 학습 🔥'],
  ['install', '앱 설치', 'a phone with a mint app icon popping out and a small download arrow', '/install']
];
for (const [key, ko, desc, use] of ICONS) add({ project: '06-ui-icons', id: `ui-${key}`, name: ko, file: `public/assets/ui/${key}.webp`, size: '1024x1024', out: '256x256', phase: 2, preset: 'icon', reference: ['public/assets/ui/trophy.webp'], prompt: desc, use, priority: 2 });

// 7. 리그 시즌 트로피 · 대회
for (const [key, ko, finish] of [['bronze', '브론즈', 'bronze'], ['silver', '실버', 'silver'], ['gold', '골드', 'gold'], ['diamond', '다이아', 'diamond-crystal']])
  add({ project: '07-league', id: `season-${key}`, name: `시즌 트로피 ${ko}`, file: `public/assets/ui/season-${key}.webp`, size: '1024x1024', out: '256x256', phase: 2, preset: 'emblem', reference: [`public/assets/ui/league-${key}.webp`, 'public/assets/ui/trophy.webp'],
    prompt: `A season-end trophy matching the ${ko} league emblem in the first reference: ${finish} finish, cup shape like the second reference, small wings.`, use: '리그 시즌 마감 보상', priority: 4 });

// 8. 앱 · 이벤트
add({ project: '08-app', id: 'app-icon-master', name: '앱 아이콘 마스터', file: 'public/icons/app-icon-master.png', size: '1024x1024', out: '1024x1024', phase: 1, preset: 'app', background: 'opaque', count: 4,
  reference: ['public/sumus-logo-green.svg', 'public/assets/pets/dog-2.webp'], prompt: 'Mint gradient (#31D29A to #07956C) full-bleed background, a bold white rounded "S" stroke logo in the center like the first reference, and the puppy 몽이 from the second reference peeking from the bottom-right corner.', use: '홈 화면 아이콘(받으면 모든 크기로 변환)', priority: 3 });
add({ project: '08-app', id: 'install-hero', name: '설치 안내 그림', file: 'public/assets/ui/install-hero.webp', size: '1536x1024', out: '1024x640', phase: 2, preset: 'pet',
  reference: ['public/assets/pets/dog-2.webp'], prompt: 'The puppy from the reference holding a big smartphone with both paws; the phone screen shows a mint app icon; a few sparkles.', use: '/install 맨 위', priority: 3 });
for (const [key, ko, desc] of [['chuseok', '추석', 'full moon, songpyeon and persimmons'], ['halloween', '할로윈', 'cute pumpkins and candy'], ['christmas', '크리스마스', 'snow, a small tree and presents'], ['exam', '시험 기간', 'notebooks, pencils and a "you can do it" energy with stars (no text)']])
  add({ project: '08-app', id: `event-${key}`, name: `이벤트 배너: ${ko}`, file: `public/assets/events/${key}.webp`, size: '1536x1024', out: '1200x400', phase: 2, preset: 'scene', background: 'opaque',
    reference: ['public/assets/pets/dog-2.webp', 'public/assets/pets/rabbit-2.webp'], prompt: `Wide seasonal banner for ${ko}: ${desc}, with the two pets from the references celebrating on the right side; left side calm for text.`, use: '홈 이벤트 배너', priority: 5 });

/* ---------- 상태 · 출력 ---------- */
for (const x of items) {
  x.status = existsSync(resolve(root, x.file)) ? 'done' : 'todo';
  x.full_prompt = `${x.prompt}\n\n${PRESETS[x.preset]}`;
  x.folder = `${x.project}/${x.id}`;
}
const manifest = {
  generated_by: 'docs/asset-requests/build.mjs',
  rules: [
    'phase 1(마스터)을 먼저 만들고 한 장을 승인해 file 경로에 저장한 뒤 phase 2를 돌려요.',
    'reference는 항상 고정 이미지(기존 그림이나 승인된 마스터)예요. 직전 결과물을 참조로 이어 쓰지 않아요.',
    'size로 생성하고 out 크기로 줄여서 저장해요(투명 PNG로 주면 webp 변환은 제가 해요).',
    'status=done인 것은 이미 앱에 있어요.'
  ],
  presets: PRESETS,
  new_pets: NEW_PETS.map(([key, ko, en, design, color, light, soft]) => ({ key, ko, en, design, color, light, soft })),
  robots: ROBOTS.map(([key, ko, personality, level, design]) => ({ key, ko, personality, level, design })),
  bosses: BOSSES.map(([key, ko, order, design]) => ({ key, ko, order, design })),
  items
};
writeFileSync(resolve(here, 'asset-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
const cols = ['phase', 'priority', 'status', 'project', 'id', 'name', 'file', 'size', 'out', 'background', 'count', 'quality', 'reference', 'after', 'use', 'full_prompt'];
const esc = v => { const s = Array.isArray(v) ? v.join(' ; ') : v == null ? '' : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
const csv = list => '﻿' + [cols.join(','), ...list.map(x => cols.map(c => esc(x[c])).join(','))].join('\n') + '\n';
const order = (a, b) => a.phase - b.phase || a.priority - b.priority || a.project.localeCompare(b.project) || a.id.localeCompare(b.id);
const sorted = [...items].sort(order);
writeFileSync(resolve(here, 'all-assets.csv'), csv(sorted));
writeFileSync(resolve(here, 'queue-phase1.csv'), csv(sorted.filter(x => x.phase === 1 && x.status === 'todo')));
writeFileSync(resolve(here, 'queue-phase2.csv'), csv(sorted.filter(x => x.phase === 2 && x.status === 'todo')));
const count = (f) => items.filter(f).length;
const byProject = Object.entries(items.reduce((m, x) => ((m[x.project] ||= { todo: 0, done: 0 })[x.status]++, m), {}));
console.log(`total ${items.length} · todo ${count(x => x.status === 'todo')} · phase1 ${count(x => x.phase === 1 && x.status === 'todo')} · phase2 ${count(x => x.phase === 2 && x.status === 'todo')}`);
for (const [p, c] of byProject) console.log(`  ${p}: todo ${c.todo} · done ${c.done}`);
