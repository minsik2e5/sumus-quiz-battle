// 그림 주문서 67: 펫 아레나 경기 버튼 · 조이스틱 · 이모트 · 아이콘(선생님: "옆에 버튼들 퀄이 너무 떨어져. 에셋으로 만들자.").
//   node docs/asset-requests/runner/build-67.mjs
// 만드는 것: 67-pet-arena-buttons.txt, split/ 시트별 파일, slice-map.csv의 67 줄(있으면 바꿔 쓴다), CODEX_PROMPT_67.md.
//   (build-runner.mjs는 26번 이후를 모르므로 돌리지 않는다: slice-map.csv 뒤쪽이 지워진다.)
// 앱은 그림이 없어도 CSS 버튼(금속 테두리 · 보석 바탕 · 원형 쿨타임)으로 완성되어 보인다. 그림(public/assets/arena/<이름>.webp)이 들어오면
//   npm run build:assets가 public/modules/arena-art.js(ARENA_ART)에 이름을 적고, 같은 자리(버튼 바탕 · 아이콘 · 조이스틱 · 이모트)가 그 그림으로 바뀐다.
//   (public/modules/arena.js uiArt · setIco, public/v13235.css .art-bg · .art-ico. 코드 등록 필요 없음.)
// 글자 · 숫자는 그리지 않는다(버튼 이름 · 쿨타임은 앱이 쓴다).
// CLAUDE.md 그림 주문서 규칙 두 가지를 시트마다 넣는다:
//   ① Drive의 기존 아레나 그림(65번 · 66번)을 열어 그림체를 맞추라 ② 정해진 Drive 폴더에 정확한 파일 이름으로 저장하라.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
export const DRIVE = 'SUMUS 펫 아레나 67 (Runner용)';
export const DRIVE_65 = 'SUMUS 펫 아레나 65 (Runner용)';
export const DRIVE_66 = 'SUMUS 펫 아레나 66 (Runner용)';
const LIST = '67-pet-arena-buttons.txt';

const SHEET = 'Create ONE square image, 1024×1024 pixels, laid out as a 2×2 sprite sheet: four separate illustrations, one centered in each quarter (each quarter is 512×512). Leave generous empty space around every illustration so nothing touches or crosses the middle lines or the image edges. Use a real transparent background (PNG alpha). Do NOT paint a checkerboard, white box, grid lines, frames or borders around the cells. No text, no letters, no numbers, no symbols that look like letters, no watermark. Do not ask me any questions; just generate the image.';
const STYLE_BTN = 'Style: premium glossy 3D-painted mobile game HUD buttons, like the on-screen controls of a top cute pet battle game: a thick polished GOLD metal rim with bevel highlights, a round faceted GEM or glass center with a bright top-left gloss highlight and a deeper color at the bottom, a slight 3D thickness under the button, crisp clean edges, rich saturated colors, readable at 60 pixels on a phone. Seen straight from the front (perfect circles, not tilted). Leave the CENTER of every button plain and clear (no icon, no symbol): the game puts its own icon on top.';
const STYLE_ICON = 'Style: premium glossy 3D-painted mobile game skill ICONS, bold and chunky, rich saturated colors, bright highlights, a thin dark outline and a soft glow so each icon reads clearly at 40 pixels on top of a round colored button. Icon only: NO round button, NO frame, NO background disc behind it (the game draws the button). Friendly and exciting, never scary or gory. No pets, no creatures, no characters.';
const STYLE_REF = `STYLE REFERENCE — before drawing, open the existing pet arena pictures already in Google Drive and match their art style, rendering quality, gold trim, color clarity and finish exactly: the folder "${DRIVE_65}" ("65-2.png" the arena floor, "65-5.png" the VS background, "65-6.png" the banner and icon sheet with the gold-rimmed ultimate icon) and the folder "${DRIVE_66}" ("66-1.png" … "66-4.png" the skill effects). If a folder is not there, search Google Drive for the file names "65-6.png" and "66-2.png". The buttons must look like they belong on that arena screen. Do NOT make it flatter, softer, blurrier or more watercolor-like than the references.`;
const DONE = n => `WHEN DONE — upload the finished PNG to Google Drive, into the folder "${DRIVE}", named exactly "${n}.png" (if a file with that name is already there, replace it; if the folder does not exist, create it). Actually save the file to Google Drive; showing the picture in the chat is not enough.`;

// 시트: no · 이름 · 몸통 · 칸 [[cell, key, 이름, 크기, 설명]] · 자르기 · 스타일.
export const SHEETS = [
  { no: '67-1', ko: '버튼 바탕 4개(공격 · 필살기 · 회피 · 교체)', style: STYLE_BTN, cut: '--trim --size 256',
    body: 'Four ROUND BUTTON BASES of the same size and the same gold rim, each a perfect circle about 400 pixels wide, centered in its quarter. Only the gem color changes.',
    cells: [
      ['TOP-LEFT', 'ui-btn-atk', '공격 버튼 바탕(빨강 보석)', '256×256', 'the ATTACK button base: a ruby-red gem center (light pink-red top, deep crimson bottom) in the gold rim, the most powerful-looking of the four.'],
      ['TOP-RIGHT', 'ui-btn-ult', '필살기 버튼 바탕(금 보석)', '256×256', 'the ULTIMATE button base: a sunny gold-amber gem center with a few tiny star sparkles in the glass, the gold rim a little more ornate (small wing-like flares at the sides, still round).'],
      ['BOTTOM-LEFT', 'ui-btn-dodge', '회피 버튼 바탕(하늘 보석)', '256×256', 'the DODGE button base: a sky-blue aquamarine gem center in a SILVER rim (instead of gold).'],
      ['BOTTOM-RIGHT', 'ui-btn-swap', '교체 버튼 바탕(보라 보석)', '256×256', 'the SWAP button base: an amethyst-violet gem center in a SILVER rim (instead of gold).']
    ] },
  { no: '67-2', ko: '스킬 버튼 바탕 · 누름 · 쿨타임 · 준비됨 빛', style: STYLE_BTN, cut: '--trim --size 256',
    body: 'Four round button pieces of exactly the same diameter (about 400 pixels) as each other, centered in their quarters. The three overlays (top-right, bottom-left, bottom-right) are laid on top of any button, so they must be the same size as the button and mostly see-through.',
    cells: [
      ['TOP-LEFT', 'ui-btn-skill', '스킬 버튼 바탕(짙은 유리 보석)', '256×256', 'the SKILL button base: a dark midnight-navy crystal glass center (so any colored skill icon shows well on it) with soft violet-cyan inner reflections, in the gold rim.'],
      ['TOP-RIGHT', 'ui-btn-press', '누른 모양 겹침', '256×256', 'a PRESSED overlay: a transparent circle with only a dark inner shadow ring along the inside of the rim and a slightly darker bottom half, as if the button is pushed in. The middle stays see-through.'],
      ['BOTTOM-LEFT', 'ui-btn-cd', '쿨타임 어둡게(원판)', '256×256', 'a COOLDOWN overlay: a flat round disc of smoky dark-navy tinted glass, evenly about 65% opaque, with a faint glossy reflection at the top. No rim, no symbols.'],
      ['BOTTOM-RIGHT', 'ui-btn-ready', '준비됨 빛 링', '256×256', 'a READY glow: a bright golden-white glowing ring with a soft outer halo and a few tiny twinkling star sparkles on it; the inside of the ring is completely transparent.']
    ] },
  { no: '67-3', ko: '조이스틱 바닥 · 손잡이 · 이모트 버튼 바탕', style: STYLE_BTN, cut: '--trim --size 256',
    body: 'Three pieces; the BOTTOM-RIGHT quarter stays completely EMPTY (transparent).',
    cells: [
      ['TOP-LEFT', 'ui-stick-base', '조이스틱 바닥', '256×256', 'the JOYSTICK BASE: a large round pad with a gold rim, a dark semi-transparent navy glass bowl inside, four small glowing arrow notches at top, right, bottom and left on the inner edge (simple triangles, not letters), and a softly glowing inner ring.'],
      ['TOP-RIGHT', 'ui-stick-knob', '조이스틱 손잡이', '256×256', 'the JOYSTICK KNOB: a round glossy sapphire-blue gem ball with a gold rim, a big shiny white highlight at the top-left, chunky and touchable.'],
      ['BOTTOM-LEFT', 'ui-btn-emote', '이모트 버튼 바탕', '256×160', 'an EMOTE chip base: a rounded pill-shaped white-cream glossy button (about twice as wide as tall) with a thin gold rim and a small speech-bubble tail at the bottom-left. Plain center (the game writes the emote there).'],
      ['BOTTOM-RIGHT', '-', '(비움)', '', 'nothing: leave this quarter empty and transparent.']
    ] },
  { no: '67-4', ko: '버튼 아이콘 4개(칼 · 필살기 · 회피 · 교체)', style: STYLE_ICON, cut: '--fit-each --size 256',
    body: 'Four ICONS, each about 360 pixels, centered in its quarter.',
    cells: [
      ['TOP-LEFT', 'ui-ico-atk', '공격 아이콘(칼)', '256×256', 'ATTACK: a short shiny silver sword with a gold hilt and a red gem, pointing up-right, with a small white slash spark.'],
      ['TOP-RIGHT', 'ui-ico-ult', '필살기 아이콘(폭발 별)', '256×256', 'ULTIMATE: a big golden eight-point star burst with a white-hot core and orange flare rays, very powerful.'],
      ['BOTTOM-LEFT', 'ui-ico-dodge', '회피 아이콘(바람 발걸음)', '256×256', 'DODGE: three curved white-cyan speed wind swooshes with a small sparkle, showing a quick side-step.'],
      ['BOTTOM-RIGHT', 'ui-ico-swap', '교체 아이콘(두 화살표)', '256×256', 'SWAP: two chunky curved arrows chasing each other in a circle (one blue, one orange), like a refresh symbol.']
    ] },
  { no: '67-5', ko: '스킬 ① 아이콘 4개(공격 · 강화 · 중독 · 지키기)', style: STYLE_ICON, cut: '--fit-each --size 256',
    body: 'Four ICONS for the first skill type, each about 360 pixels, centered in its quarter.',
    cells: [
      ['TOP-LEFT', 'ui-ico-burst', '스킬 ① 공격(터뜨리기)', '256×256', 'BURST attack: a bright magic energy blast, a glowing violet-white orb exploding with sparkles and short rays.'],
      ['TOP-RIGHT', 'ui-ico-boost', '스킬 ① 강화(힘 올리기)', '256×256', 'POWER UP: a fiery orange upward arrow wrapped in flames with small rising sparks.'],
      ['BOTTOM-LEFT', 'ui-ico-poison', '스킬 ① 중독', '256×256', 'POISON: a glossy purple-green poison droplet with small bubbles (cute, no skull).'],
      ['BOTTOM-RIGHT', 'ui-ico-guard', '스킬 ① 지키기(방패)', '256×256', 'GUARD: a sturdy round blue-and-gold shield with a soft protective glow.']
    ] },
  { no: '67-6', ko: '스킬 ② 아이콘 불 · 물(불 뿜기 · 운석 · 물대포 · 방울 보호막)', style: STYLE_ICON, cut: '--fit-each --size 256',
    body: 'Four ICONS for second skills, each about 360 pixels, centered in its quarter. Match the colors of the skill effects in "66-1.png" … "66-4.png".',
    cells: [
      ['TOP-LEFT', 'ui-s2-breath', '불 뿜기', '256×256', 'FLAME BREATH: a cone of roaring orange-yellow fire spreading to the right.'],
      ['TOP-RIGHT', 'ui-s2-meteor', '운석 낙하', '256×256', 'METEOR: a molten fireball falling diagonally with a blazing tail.'],
      ['BOTTOM-LEFT', 'ui-s2-jet', '물대포', '256×256', 'WATER CANNON: a thick straight aqua water jet with a splash at the end.'],
      ['BOTTOM-RIGHT', 'ui-s2-bubble', '방울 보호막', '256×256', 'BUBBLE SHIELD: a shiny see-through soap bubble with a rainbow-aqua rim.']
    ] },
  { no: '67-7', ko: '스킬 ② 아이콘 풀 · 땅(덩굴 · 꽃잎 · 바위 · 지진)', style: STYLE_ICON, cut: '--fit-each --size 256',
    body: 'Four ICONS for second skills, each about 360 pixels, centered in its quarter. Match the colors of the skill effects in "66-1.png" … "66-4.png".',
    cells: [
      ['TOP-LEFT', 'ui-s2-vine', '덩굴 묶기', '256×256', 'BINDING VINES: two curling green vines with leaves twisting into a knot.'],
      ['TOP-RIGHT', 'ui-s2-petal', '꽃잎 회복장', '256×256', 'HEALING PETALS: a ring of pink flower petals around a small green plus-shaped sparkle.'],
      ['BOTTOM-LEFT', 'ui-s2-boulder', '바위 굴리기', '256×256', 'ROLLING BOULDER: a big round brown rock with a curved motion swoosh.'],
      ['BOTTOM-RIGHT', 'ui-s2-crack', '지진 장판', '256×256', 'EARTHQUAKE: cracked ground with glowing amber cracks and small rocks jumping up.']
    ] },
  { no: '67-8', ko: '스킬 ② 아이콘 바람 · 얼음(회오리 · 질풍 베기 · 얼음 장판 · 얼음 창)', style: STYLE_ICON, cut: '--fit-each --size 256',
    body: 'Four ICONS for second skills, each about 360 pixels, centered in its quarter. Match the colors of the skill effects in "66-1.png" … "66-4.png".',
    cells: [
      ['TOP-LEFT', 'ui-s2-tornado', '회오리', '256×256', 'TORNADO: a mint-white spinning funnel with leaves in the swirl.'],
      ['TOP-RIGHT', 'ui-s2-gale', '질풍 연속 베기', '256×256', 'GALE SLASHES: three sharp parallel green-white wind slash marks.'],
      ['BOTTOM-LEFT', 'ui-s2-icefield', '얼음 장판', '256×256', 'ICE FLOOR: a shiny cyan frozen patch with a big snowflake glint.'],
      ['BOTTOM-RIGHT', 'ui-s2-spear', '얼음 창', '256×256', 'ICE SPEARS: three crystal-blue ice javelins fanning out to the upper-right.']
    ] },
  { no: '67-9', ko: '스킬 ② 아이콘 독 · 별(독구름 · 독침 · 번개 · 분신)', style: STYLE_ICON, cut: '--fit-each --size 256',
    body: 'Four ICONS for second skills, each about 360 pixels, centered in its quarter. Match the colors of the skill effects in "66-1.png" … "66-4.png".',
    cells: [
      ['TOP-LEFT', 'ui-s2-cloud', '독구름', '256×256', 'POISON CLOUD: a puffy purple-green gas cloud with little bubbles (cute, no skull).'],
      ['TOP-RIGHT', 'ui-s2-darts', '독침 연사', '256×256', 'POISON DARTS: five small purple-tipped darts flying to the right in a row with green trails.'],
      ['BOTTOM-LEFT', 'ui-s2-chain', '번개 연쇄', '256×256', 'CHAIN LIGHTNING: a bright white-gold zig-zag lightning bolt with violet glow and small forks.'],
      ['BOTTOM-RIGHT', 'ui-s2-clone', '분신 소환', '256×256', 'CLONE: two overlapping glowing golden-violet star-dust silhouettes of a round star shape (not a creature), one solid and one see-through.']
    ] }
];

export const promptOf = s => {
  const lines = [SHEET, s.style, STYLE_REF, s.body];
  for (const [cell, , , , text] of s.cells) lines.push(`${cell}: ${text}`);
  lines.push(DONE(s.no));
  return lines.join('\n');
};
export const ITEMS = SHEETS.flatMap(s => s.cells.filter(c => c[1] !== '-').map(([cell, key, name, size]) => ({ sheet: s, cell, key, name, size })));
const cmd = s => `node docs/asset-requests/runner/fit-assets.mjs /tmp/art/${s.no}.png ${s.cells.map(c => c[1] === '-' ? '-' : `arena/${c[1]}`).join(' ')} ${s.cut}`;

const CODEX = () => `# Codex 작업 지시: 그림 67 (펫 아레나 경기 버튼 · 조이스틱 · 이모트 · 아이콘 ${ITEMS.length}장)

## 목표
선생님 주문: "옆에 버튼들 퀄이 너무 떨어져. **에셋으로 만들자.**" 경기장 오른쪽 버튼(공격 · 스킬 ① · 스킬 ② · 필살기 · 회피 · 교체), 왼쪽 조이스틱 바닥 · 손잡이, 이모트 버튼을 게임다운 그림 버튼으로 바꾼다.
v13.235에서 CSS 버튼(금속 테두리 · 보석 바탕 · 원형 쿨타임 · 준비됨 빛)과 그림 자리를 먼저 만들어 두었다. **그림 파일만 넣으면 된다.**

| 시트 | 내용 | 넣는 곳(\`public/assets/arena/\`) | 자르기 |
|---|---|---|---|
${SHEETS.map(s => `| ${s.no} | ${s.ko} | ${s.cells.filter(c => c[1] !== '-').map(c => `\`${c[1]}\``).join(' · ')} | \`${s.cut}\` |`).join('\n')}

\`npm run build:assets\`가 \`public/modules/arena-art.js\`(\`ARENA_ART\`)에 이름을 적고, 경기 화면의 같은 자리(버튼 바탕 · 아이콘 · 조이스틱 · 이모트)가 알아서 그림으로 바뀐다(\`arena.js\` uiArt · setIco, \`v13235.css\` .art-bg · .art-ico). 앱 코드는 고치지 않는다.
스킬 ① 아이콘은 스킬 종류(공격 burst · 강화 boost · 중독 poison · 지키기 guard), 스킬 ② 아이콘은 스킬 id(\`EL_SKILLS\`의 16개)로 고른다.

## 꼭 지킬 것
- **PR까지만 만든다. 머지하지 않는다.** \`sumus-voca-prod-deploy\`에 머지하면 운영에 바로 배포된다. **운영 Supabase에 연결하지 않는다.**
- **그림은 Codex에 내장된 그림 생성 기능으로 만든다.** OpenAI API 키(\`OPENAI_API_KEY\`)나 유료 API를 쓰지 않는다. 키가 없다고 멈추지 않는다.
- **Google Drive는 쓰지 않는다. 멈추지 않는다.** 아래 "프롬프트 손보기"대로 Drive 문구를 지우고 저장소 안의 기존 아레나 그림(65 · 66번)을 참고 그림으로 붙인다.
- 브랜치는 \`sumus-voca-prod-deploy\`에서 새로 만든다(예: \`codex/art-67-arena-buttons\`).
- 고치는 파일: 위 표의 그림 ${ITEMS.length}장, \`docs/asset-requests/runner/DONE_67.md\`, 빌드가 바꾸는 \`public/sw.js\` · \`public/modules/arena-art.js\`. 그 밖의 앱 코드, 게임 규칙, 코인, 서버 로직, 점검 파일은 건드리지 않는다. 버전은 올리지 않는다.
- 원본 PNG는 커밋하지 않는다(\`/tmp/art/\`). 기존 그림 파일은 지우거나 덮어쓰지 않는다. **새 파일만 추가**한다.
- 그림에 **글자 · 숫자 · 로고가 없다**(버튼 이름 · 쿨타임 숫자는 앱이 쓴다). 펫 · 캐릭터를 그리지 않는다.
- 모든 시트는 **진짜 투명 배경**(PNG alpha → WebP alpha). 체크무늬 · 흰 상자가 그려져 있으면 다시 만든다.

## 입력 (저장소 안, \`docs/asset-requests/runner/\`)
- \`split/67-1 …\` ~ \`67-9 …\`: 시트 하나 = 프롬프트 하나. 묶음 전체는 \`${LIST}\`, 파일 자리는 \`slice-map.csv\`(\`list\` 열이 \`${LIST}\`). 프롬프트는 \`build-67.mjs\`가 만든다(손으로 고치지 말고 그 파일을 고쳐 다시 돌린다).
- 67-1 → 67-2 → 67-3 순서로 먼저 돌리고(테두리 · 크기가 맞아야 한다), 아이콘(67-4 ~ 67-9)은 따로 돌려도 된다(뒤 시트에 앞 시트 결과도 붙인다).

### 프롬프트 손보기 (Drive 대신 참고 그림 첨부)
주문서는 그림 GPT가 Google Drive를 여는 방식으로 쓰여 있다(Drive의 기존 아레나 그림 폴더 "${DRIVE_65}"의 "65-2.png" · "65-5.png" · "65-6.png", "${DRIVE_66}"의 "66-1.png" … "66-4.png"를 열어 그림체를 맞추고, 정해진 Drive 폴더 "${DRIVE}"에 정확한 파일 이름 "67-1.png" … "67-9.png"로 저장). Codex는 Drive를 쓰지 않으니 보내기 전에 이렇게 바꾼다.
1. 다음으로 **시작하는 줄을 지운다**: \`STYLE REFERENCE\`, \`WHEN DONE\`
2. 아래 표의 참고 그림을 같이 보여 주고, 프롬프트 **세 번째 줄**에 이 문장을 넣는다:
   \`REFERENCE IMAGES ARE ATTACHED: match their art style, rendering quality, gold trim, crisp clean edges, lighting and colors exactly. The buttons must look like they belong on the attached arena screen. Do NOT copy or resemble any cartoon, anime, game or movie character, logo, button or icon.\`

### 참고 그림 (\`public/assets/\` 아래 경로)
| 시트 | 참고 그림 |
|---|---|
| 모든 시트 | \`arena/ult-icon.webp\`(65번 금테 아이콘) · \`arena/banner-win.webp\` · \`arena/bg-plaza.webp\`(경기장) |
| 67-1 · 67-2 · 67-3 | + \`arena/vs.webp\`(같은 금빛 · 같은 에너지) |
| 67-4 · 67-5 | + \`arena/fx-crit.webp\` · \`arena/fx-bubble.webp\` |
| 67-6 ~ 67-9 | + 그 스킬의 66번 효과 그림(\`arena/fx-flame-breath.webp\` · \`fx-meteor\` · \`fx-water-jet\` · \`fx-bubble\` · \`fx-vine\` · \`fx-petal-field\` · \`fx-boulder\` · \`fx-crack-field\` · \`fx-tornado\` · \`fx-ice-field\` · \`fx-ice-spear\` · \`fx-poison-cloud\` · \`fx-lightning\` · \`fx-clone\`) |

### 후보 점검 (모두 통과해야 쓴다)
1. 크기: 시트는 1024×1024(2×2), 진짜 투명 배경. 글자 · 숫자 · 로고가 없다.
2. 칸 사이 · 가장자리에 여백이 있어 자를 때 이웃 칸이 섞이지 않는다. 비우라고 한 칸(67-3 오른쪽 아래)은 비어 있다.
3. 버튼 바탕(67-1 · 67-2 · 67-3)은 **정면에서 본 완전한 원**이고 같은 시트 안에서 지름이 같다. 바탕 가운데에 아이콘 · 무늬가 없다. 겹침(누름 · 쿨타임 · 준비됨 빛)은 가운데가 비치거나(누름 · 빛) 고르게 반투명(쿨타임)이다.
4. 아이콘(67-4 ~ 67-9)은 **아이콘만**(동그란 버튼 · 바탕 원판 없음). 40px로 줄여도 무슨 버튼 · 스킬인지 알아볼 수 있다.
5. \`arena/bg-plaza.webp\` 위 · 서로 옆에 놓았을 때 65 · 66번 그림과 같은 게임처럼 보인다.

이미지를 볼 수 있으면 눈으로 확인한다. 볼 수 없으면 1번만 확인하고 PR에 "눈으로 확인 필요"라고 적는다.

## 넣기
\`\`\`
npm i --no-save sharp   # 없으면
${SHEETS.map(cmd).join('\n')}
\`\`\`
한 장에 40KB 이하(넘으면 quality를 조금씩 낮춘다).

## 점검
\`\`\`
npm ci
npm run build:assets      # public/modules/arena-art.js의 ARENA_ART에 ui-btn-atk … 이 적힌다
npm run check             # release-check 전부 PASS
npm run check:cloudflare
\`\`\`
- 점검이 실패하면 점검 파일을 고치지 말고 PR에 실패 메시지를 그대로 적는다.
- 기존 그림의 \`D\`(삭제) · \`M\`(수정)이 없어야 한다: \`git diff --name-status origin/sumus-voca-prod-deploy -- public/assets\`
- \`docs/asset-requests/runner/DONE_67.md\`(한국어): 넣은 그림 ${ITEMS.length}장(경로 · 크기 · 용량), 다시 만든 횟수, "눈으로 확인 필요"(테스트 앱 아레나에서 버튼 · 조이스틱 · 이모트가 그림으로 바뀌었는지, 누를 때 · 쿨타임 · 필살기 준비 때 모양).
- 폰 390px 경기 화면 스크린샷(\`node docs/arena-perf.mjs --cpu 1 --seconds 15 --shot /tmp/after.png\`)을 작게 PR 코멘트로 올린다.
- PR 제목 \`그림 67: 펫 아레나 경기 버튼 · 조이스틱 · 아이콘\`, 본문 한국어. 마지막 줄: \`> ⚠️ 머지하면 운영에 바로 배포됩니다. 선생님이 "머지해"라고 할 때만 머지합니다.\`
`;

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const all = SHEETS.map(s => `### ${s.no} ${s.ko}\n${promptOf(s)}`).join('\n\n');
  writeFileSync(resolve(here, LIST), all + '\n');
  mkdirSync(resolve(here, 'split'), { recursive: true });
  for (const s of SHEETS) writeFileSync(resolve(here, 'split', `${s.no} 펫 아레나 ${s.ko}.txt`), promptOf(s) + '\n');
  writeFileSync(resolve(here, 'CODEX_PROMPT_67.md'), CODEX());
  // slice-map.csv: 67 줄을 지우고 끝에 다시 붙인다(번호는 67을 뺀 마지막 번호 다음).
  const csvPath = resolve(here, 'slice-map.csv');
  const rows = readFileSync(csvPath, 'utf8').split('\n').filter(l => l && !l.startsWith(`"${LIST}"`));
  let no = Math.max(...rows.slice(1).map(l => Number(l.split('","')[1]) || 0));
  const KO_CELL = { 'TOP-LEFT': '왼쪽 위', 'TOP-RIGHT': '오른쪽 위', 'BOTTOM-LEFT': '왼쪽 아래', 'BOTTOM-RIGHT': '오른쪽 아래' };
  const add = SHEETS.map(s => ++no && ITEMS.filter(x => x.sheet === s).map(x => `"${LIST}","${String(no).padStart(3, '0')}","${s.no} ${s.ko}","${KO_CELL[x.cell]}","arena-${x.key}","${x.name} (${x.size})","public/assets/arena/${x.key}.webp"`)).flat();
  writeFileSync(csvPath, [...rows, ...add].join('\n') + '\n');
  console.log(`[67] 시트 ${SHEETS.length}장 · 그림 ${ITEMS.length}장 · slice-map ${add.length}줄`);
}
