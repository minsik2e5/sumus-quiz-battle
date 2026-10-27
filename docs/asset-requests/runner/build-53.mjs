// 그림 주문서 53: 심해 물고기 8종(구성안 docs/fishing-upgrade-design.md, V13.185).
//   53a = 옆모습 2시트(26번과 같은 물고기 그림 · 256px), 53b = 줄에 매달린 그림 2시트(27b와 같은 방식 · 256px + 작은 그림 96px).
//   물고기마다 3장: fish/<key>.webp · fish/<key>-hang.webp · fish/<key>-hang-s.webp. 2×2 시트 하나 = 물고기 4마리.
//   node docs/asset-requests/runner/build-53.mjs
// 만드는 것: 53a · 53b 주문서(.txt), split/ 시트별 파일, slice-map.csv의 53 줄(있으면 바꿔 쓴다), CODEX_PROMPT_53.md.
// (build-runner.mjs는 26번 이후를 모르므로 돌리지 않는다: slice-map.csv 뒤쪽이 지워진다.)
// 물고기 key · 이름 · 등급은 public/modules/fishing-rules.js의 심해 물고기(deep)에서 읽는다. 그림이 들어오면 build:assets가
// public/modules/fish-art.js(FISH_READY)에 넣고, 그때부터 깊은 바다에서 나온다(앱 코드는 고치지 않아도 된다).
import { readFileSync, writeFileSync, mkdirSync, readdirSync, unlinkSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { FISH, DEEP_KEYS, RARITY } from '../../../public/modules/fishing-rules.js';

const here = dirname(fileURLToPath(import.meta.url));
export const DRIVE_53 = 'SUMUS 심해 물고기 53 (Runner용)';
const DRIVE_26 = 'SUMUS 낚시 26 (Runner용)', DRIVE_27 = 'SUMUS 낚시 27 (Runner용)';
export const SETS = {
  a: { series: '53a', file: '53a-deep-fish.txt', ko: '심해 물고기 옆모습', short: '심해 물고기' },
  b: { series: '53b', file: '53b-deep-fish-hanging.txt', ko: '심해 물고기 매달린 그림', short: '낚인 심해 물고기' }
};

// 26 · 27번과 똑같은 첫 두 줄(같은 물고기 가족으로 보이게).
const SHEET = 'Create ONE square image, 1024×1024 pixels, laid out as a 2×2 sprite sheet: four separate illustrations, one centered in each quarter (each quarter is 512×512). Leave generous empty space around every illustration so nothing touches or crosses the middle lines or the image edges. Use a real transparent background (PNG alpha) — do NOT paint a checkerboard, white box, grid lines, frames or borders. No text, no letters, no numbers, no labels, no watermark, no ground shadow. Do not ask me any questions; just generate the image.';
const STYLE = 'Style: glossy 3D game UI icon, soft pastel palette with SUMUS mint green (#10B981) accents, chunky friendly shapes, clean edges readable at 48 pixels, one object per cell, slight top-down front view.';
const KEEP = 'Do NOT make it softer, blurrier, foggier, more painterly or more watercolor-like than the reference.';
// 그림체 맞추기: Drive의 기존 물고기(26 · 27)를 연다. (Codex는 CODEX_PROMPT에서 이 줄을 지우고 저장소 물고기 그림을 붙인다.)
const STYLE_REF = `STYLE REFERENCE — before drawing, open the existing fish of this game in Google Drive and study them: "26-4.png", "26-5.png" and "26-6.png" in the Google Drive folder "${DRIVE_26}" (rare, epic and legendary fish of this game), and "06-3.png" and "06-4.png" in the Google Drive folder "SUMUS 에셋 05·06 (Runner용)". Draw the new fish in exactly that art style: the same glossy 3D toy-like look, the same big glossy friendly eyes with white highlights, the same clean outline, the same fish size in the cell and the same level of detail, so they look like they belong in the same fish book. ${KEEP} Do NOT copy the reference fish; these are new deep-sea fish.`;
const DEEP_MOOD = 'These fish live in the DEEP SEA: give them a mysterious deep-sea feeling (deep indigo, violet and midnight-blue tones, soft glowing bioluminescent spots or lures, big eyes, small cute teeth where described) but keep them cute and friendly, never scary or gory, and bright enough to read on a light card. The glow is drawn on the fish itself; the background stays transparent.';
// 등급 빛: 26번 주문서의 말 그대로(희귀 파란 빛 · 영웅 보라 오라 · 전설 금빛 오라와 반짝이).
const GLOW = { rare: 'bigger and bolder, a soft blue outline glow.', epic: 'large and impressive, a soft purple aura.', legend: 'the largest and most dazzling, a golden aura and sparkles.' };
// 생김새(그림 GPT용, 영어). 모두 옆모습 · 오른쪽을 본다.
export const LOOKS = {
  anglerfish: 'a round chubby dark-brown anglerfish with a wide grinning mouth full of tiny cute pointed teeth, small sparkly eyes and a long thin stalk on its head ending in a glowing cyan lantern lure',
  blobfish: 'a soft wobbly pink blobfish with a droopy jelly-like body, a big round nose, a funny grumpy-cute face and tiny fins, a little glossy shine',
  fireflysquid: 'a small sapphire-blue firefly squid with a pointed mantle and short arms, covered with rows of glowing bright-blue light dots like little stars',
  oarfish: 'a very long ribbon-like silver oarfish curving in a gentle S shape to fit the cell, a bright red crest of fin rays on its head and a red fin running along its whole back',
  toothfish: 'a big sturdy grey-black toothfish with a wide jaw showing neat cute little teeth, large pale eyes and a long rounded tail',
  vampiresquid: 'a dark wine-red vampire squid with big round blue eyes, two small ear-like fins on top and a webbed cape between its arms, a few soft glowing spots on the arm tips',
  manta: 'a huge midnight-blue giant manta ray gliding, seen slightly from above, wide pointed wings, two curled head fins, a white belly edge and starry white spots on its back',
  frilledshark: 'an ancient eel-like frilled shark, long brown body, six frilly ruffled gill slits behind the head, a small smiling mouth with tiny trident-like teeth and big glossy eyes'
};
export const EN = { anglerfish: 'anglerfish', blobfish: 'blobfish', fireflysquid: 'firefly squid', oarfish: 'oarfish', toothfish: 'toothfish', vampiresquid: 'vampire squid', manta: 'giant manta ray', frilledshark: 'frilled shark' };
const CELLS = ['TOP-LEFT', 'TOP-RIGHT', 'BOTTOM-LEFT', 'BOTTOM-RIGHT'];
const CELL_KO = ['왼쪽 위', '오른쪽 위', '왼쪽 아래', '오른쪽 아래'];
// Codex용 저장소 그림(public/assets/ 아래): 같은 등급의 기존 물고기.
export const REPO_REF = {
  a: ['fish/tuna.webp', 'fish/squid.webp', 'fish/shark.webp', 'fish/coelacanth.webp', 'fish/whaleshark.webp'],
  b: ['fish/tuna-hang.webp', 'fish/squid-hang.webp', 'fish/shark-hang.webp', 'fish/coelacanth-hang.webp']
};

// 심해 물고기는 fishing-rules.js에서 읽는다. 생김새가 없거나 key가 이상하면 멈춘다.
{
  const bad = DEEP_KEYS.filter(k => !LOOKS[k] || !GLOW[FISH[k].rarity] || !/^[a-z]+$/.test(k));
  if (bad.length || DEEP_KEYS.length % 4 || Object.keys(LOOKS).some(k => !FISH[k]?.deep) || DEEP_KEYS.some(k => !EN[k])) throw new Error('심해 물고기 key · 생김새 확인: ' + bad.join(', '));
}

const rarityKo = k => RARITY[FISH[k].rarity].name;
export function sheets53() {
  const out = [], groups = [];
  for (let i = 0; i < DEEP_KEYS.length / 4; i++) groups.push(DEEP_KEYS.slice(i * 4, i * 4 + 4));
  groups.forEach((fish, i) => {
    const name = `53a-${i + 1}`;
    const lines = [SHEET, STYLE, STYLE_REF,
      ...(i ? [`Also open "53a-1.png" in the same Google Drive folder "${DRIVE_53}" (the first sheet of this set) if it is there, and match its size, outline, eyes and finish exactly.`] : []),
      `Subject: Cute game-art deep-sea fish for a fishing mini game. Every fish is drawn in side view facing RIGHT, the whole body inside the cell with a little empty space around it, big glossy friendly eyes with white highlights, a clean outline, no water, no fishing line, no text and no numbers. All fish of this set are one family with the fish already in this game: the same lighting, outline and level of detail. ${DEEP_MOOD}`,
      ...fish.map((k, c) => `${CELLS[c]} cell: ${LOOKS[k]}; ${GLOW[FISH[k].rarity]}`),
      `WHEN DONE — upload the finished transparent PNG to Google Drive, into the folder "${DRIVE_53}", named exactly "${name}.png" (if a file with that name is already there, replace it; if the folder does not exist, create it). Actually save the file to Google Drive; showing the picture in the chat is not enough.`];
    out.push({ set: 'a', name, file: SETS.a.file, title: `${SETS.a.short} ${i + 1} (${fish.map(k => FISH[k].name).join('·')})`, fish, text: lines.join('\n'),
      cells: fish.map((k, c) => ({ cell: CELL_KO[c], key: `fish-${k}`, name: `${FISH[k].name} (${rarityKo(k)})`, out: `public/assets/fish/${k}.webp` })) });
  });
  groups.forEach((fish, i) => {
    const name = `53b-${i + 1}`, side = `53a-${i + 1}`;
    const lines = [SHEET, STYLE,
      `STYLE REFERENCE — before drawing, open "27b-4.png" and "27b-5.png" in the Google Drive folder "${DRIVE_27}" (fish of this game hanging from a fishing line) and "06-3.png" in the Google Drive folder "SUMUS 에셋 05·06 (Runner용)". Draw in exactly that style and pose: the same glossy 3D toy-like look, the same hanging pose, hook and line, the same clean edges and soft lighting. ${KEEP} Do NOT copy the reference fish.`,
      `CHARACTER REFERENCE — before drawing, open "${side}.png" in the Google Drive folder "${DRIVE_53}" (the same four fish drawn in side view, in the same cell order). Keep each fish's exact design: body shape, colors, glowing spots, fins, teeth and eyes. Only the pose changes. ${KEEP}`,
      `Subject: the "big reveal" pose of a fishing game: each fish has just been pulled up from the deep sea and HANGS VERTICALLY from a thin fishing line, head UP, mouth on a small silver hook at the very top center of the cell, body slightly curved as if wriggling, tail flicking at the bottom, a few water droplets flying off. Glossy wet shine, its deep-sea glow still shining softly. The thin line goes straight up out of the top of the fish to the top edge of the cell. Very long fish (oarfish, frilled shark) curl gently so the whole body fits inside the cell; the manta ray hangs by its mouth with its wings drooping. Same fish of sheet ${side}, same cell order.`,
      ...fish.map((k, c) => `${CELLS[c]} cell: the ${EN[k]} (same design as cell ${CELLS[c].toLowerCase()} of ${side}), hanging from the hook.`),
      `WHEN DONE — upload the finished transparent PNG to Google Drive, into the folder "${DRIVE_53}", named exactly "${name}.png" (if a file with that name is already there, replace it; if the folder does not exist, create it). Actually save the file to Google Drive; showing the picture in the chat is not enough.`];
    out.push({ set: 'b', name, file: SETS.b.file, title: `${SETS.b.short} ${i + 1} (${fish.map(k => FISH[k].name).join('·')})`, fish, text: lines.join('\n'),
      cells: fish.map((k, c) => ({ cell: CELL_KO[c], key: `fish-${k}-hang`, name: `${FISH[k].name} 걸림`, out: `public/assets/fish/${k}-hang.webp` })) });
  });
  return out;
}
const toSplitName = s => `${s.name} ${s.title.replace(/[\\/:*?"<>|()·~.]/g, ' ').replace(/\s+/g, ' ').trim()}.txt`;

// ── CODEX_PROMPT ──────────────────────────────────────────────────────────────────────────
function codex(list) {
  const files = (s, k) => s.set === 'b' ? `\`fish/${k}-hang\` + \`fish/${k}-hang-s\`` : `\`fish/${k}\``;
  const rows = list.flatMap(s => s.fish.map((k, c) => `| \`${s.name}\` | ${CELL_KO[c]} | \`${k}\` | ${FISH[k].name} | ${rarityKo(k)} | ${files(s, k)} |`)).join('\n');
  const fit = list.map(s => `node $R/fit-assets.mjs /tmp/art/${s.name}.png ${s.fish.map(k => `fish/${k}${s.set === 'b' ? '-hang' : ''}`).join(' ')} --fit-each${s.set === 'b' ? ' --small 96' : ''} --preview /tmp/review/${s.name}.png`).join('\n');
  const n = DEEP_KEYS.length;
  return `# Codex 작업 지시: 그림 53 (심해 물고기 ${n}종 · ${list.length}시트 · 그림 ${n * 3}장)

## 목표
놀이터 손맛 낚시의 **깊은 바다**(구성안 \`docs/fishing-upgrade-design.md\`)에 나오는 심해 물고기 ${n}종을 만들고, 잘라서 \`public/assets/fish/\`에 넣은 뒤 PR을 만든다.
물고기마다 **3장**: 옆모습 \`<key>.webp\`(256px), 매달린 그림 \`<key>-hang.webp\`(256px), 작은 매달린 그림 \`<key>-hang-s.webp\`(96px). 시트는 53a(옆모습) ${list.filter(s => s.set === 'a').length}장 · 53b(매달린 그림) ${list.filter(s => s.set === 'b').length}장이다.
**그림 파일만 넣는다. 앱 코드는 고치지 않는다.** 세 장이 다 들어온 물고기는 \`npm run build:assets\`가 \`public/modules/fish-art.js\`(FISH_READY)에 자동으로 넣고, 그때부터 깊은 바다에서 나온다.

| 시트 | 칸 | key | 이름 | 등급 | 파일 |
|---|---|---|---|---|---|
${rows}

- 시트와 칸마다 넣을 파일은 \`slice-map.csv\`에서 \`list\` 열이 \`${SETS.a.file}\` · \`${SETS.b.file}\`인 줄을 본다. **key를 바꾸지 않는다**(앱은 \`public/assets/fish/<key>.webp\`를 그대로 찾는다).
- 모든 물고기는 **옆모습, 오른쪽을 본다**(53a). 53b는 같은 물고기가 **머리를 위로, 낚싯바늘에 매달린** 모습이다(27b와 같은 자세).
- 심해 물고기답게 어둡고 신비한 느낌(발광 · 큰 눈 · 작은 이빨)이지만, **기존 물고기(26 · 27번)와 같은 그림체**여야 한다. 무섭거나 징그럽게 그리지 않는다.

## 꼭 지킬 것
- **기존 물고기 그림과 같은 그림체**로 맞춘다. 더 흐리거나 뿌옇거나 수채화처럼 만들지 않는다. 기존 물고기를 베끼지 않는다.
- 글자 · 숫자 · 로고 · 물 · 배경 · 바닥 그림자 · 체크무늬가 없다(진짜 투명).
- **한 번에 시트 하나(물고기 4마리)씩** 만든다. 53b는 같은 번호의 53a(\`53a-1\` → \`53b-1\`)가 먼저 있어야 맞출 수 있다.
- **PR까지만 만든다. 머지하지 않는다.** \`sumus-voca-prod-deploy\`에 머지하면 운영에 바로 배포된다. **운영 Supabase에 연결하지 않는다.**
- **그림은 Codex에 내장된 그림 생성 기능으로 만든다.** OpenAI API 키나 유료 API를 쓰지 않는다. 키가 없다고 멈추지 않는다.
- **Google Drive는 쓰지 않는다. 멈추지 않는다.** Codex에는 Drive가 없다. 아래 "프롬프트 손보기"대로 Drive 문구를 지우고 저장소 안의 기존 물고기 그림을 참고 그림으로 붙인다.
- 고치는 파일: \`public/assets/fish/\` 아래 **새 그림**, 빌드가 바꾸는 \`public/sw.js\` · \`public/modules/fish-art.js\`, \`docs/asset-requests/runner/DONE_53.md\`. 그 밖의 앱 코드, 게임 규칙, 코인, 서버 로직, 점검 파일은 건드리지 않는다. 버전은 올리지 않는다.
- 기존 그림 파일은 지우거나 덮어쓰지 않는다. **새 파일만 추가**한다. 원본 시트 PNG는 커밋하지 않는다(\`/tmp/art/\`).
- **브랜치:** \`sumus-voca-prod-deploy\`에서 새로 만든다(예: \`codex/art-53\`). 그 브랜치에 \`docs/asset-requests/runner/${SETS.a.file}\`가 없으면 주문서 PR이 아직 머지되지 않은 것이다. 그때는 \`claude/fishing-upgrade\`에서 시작하고 PR 대상도 그 브랜치로 한다.

## 입력 (저장소 안, \`docs/asset-requests/runner/\`)
- \`split/53a-1 …\` ~ \`53b-${list.filter(s => s.set === 'b').length} …\`: 시트 하나 = 프롬프트 하나. 묶음 전체는 \`${SETS.a.file}\` · \`${SETS.b.file}\`.
- \`slice-map.csv\`: 칸 이름 · 앱 파일. 칸 순서는 왼쪽 위 → 오른쪽 위 → 왼쪽 아래 → 오른쪽 아래.
- 자르기 도구: \`fit-assets.mjs\`(사용법은 파일 맨 위 주석). \`sharp\`가 없으면 \`npm i --no-save sharp\`.
- 보내는 순서: \`${list.map(s => s.name).join('` → `')}\`.

### 프롬프트 손보기 (Drive 대신 참고 그림 첨부)
시트 프롬프트(\`split/\`)는 그림 GPT가 Google Drive를 여는 방식으로 쓰여 있다(Drive의 기존 물고기 26 · 27번을 열어 그림체를 맞추고, 정해진 Drive 폴더 "${DRIVE_53}"에 정확한 파일 이름 "53a-1.png" … 으로 저장). Codex는 Drive를 쓰지 않으니 보내기 전에 이렇게 고친다.
1. 다음으로 **시작하는 줄을 지운다**: \`STYLE REFERENCE\`, \`CHARACTER REFERENCE\`, \`Also open\`, \`WHEN DONE\`
2. 아래 표의 참고 그림(저장소 안 기존 물고기)을 같이 보여 주고, 프롬프트 **세 번째 줄**에 이 문장을 넣는다:
   \`REFERENCE IMAGES ARE ATTACHED: they are fish already in this game. Match their art style, glossy 3D look, eyes, outline, size in the cell and finish exactly. Do NOT copy the reference fish; these are new deep-sea fish.\`
3. \`53a-2\`부터는 방금 만든 \`/tmp/art/53a-1.png\`도 붙이고, \`53b-N\`에는 **같은 번호의 \`/tmp/art/53a-N.png\`를 꼭 붙인다**(같은 물고기 디자인을 자세만 바꿔 그린다).

### 참고 그림 (\`public/assets/\` 아래 경로)
| 시트 | 참고 그림 |
|---|---|
| 53a | ${REPO_REF.a.map(x => `\`${x}\``).join(', ')} |
| 53b | ${REPO_REF.b.map(x => `\`${x}\``).join(', ')} + 같은 번호의 \`/tmp/art/53a-N.png\` |

### 후보 점검 (모두 통과해야 쓴다)
1. 배경이 진짜 투명이다(네 모서리 alpha 0, 체크무늬 · 흰 상자 · 흰 테두리 없음).
2. 칸마다 물고기가 하나씩 따로 있고, 겹치거나 잘리지 않았다. 글자, 숫자, 물, 바닥 그림자가 없다.
3. 53a는 오른쪽을 보는 옆모습, 53b는 머리가 위 · 바늘과 줄이 칸 위 가운데에 있다.
4. 기존 물고기와 나란히 놓아도 같은 게임 그림처럼 보이고, 48px로 줄여도 어떤 물고기인지 알아볼 수 있다.

이미지를 볼 수 있으면 눈으로 확인한다. 볼 수 없으면 1~2번만 확인하고 PR에 "눈으로 확인 필요"라고 적는다.

## 1. 그림 만들기
- **Codex의 내장 그림 생성 기능**으로 시트를 하나씩 만든다. API를 직접 부르지 않는다.
- 2×2 시트 1024×1024, **투명 배경 PNG**, 칸마다 물고기 하나.
- 만든 그림은 \`/tmp/art/<시트 번호>.png\`로 저장한다(예: \`/tmp/art/53a-1.png\`). 점검을 통과하지 못하면 같은 프롬프트로 다시 만든다. 시트마다 최대 4번이다.

## 2. 자르고 넣기
기존 물고기와 같은 규격(옆모습 256px, 매달린 그림 256px + 작은 그림 96px, 투명 webp, 칸마다 같은 크기 \`--fit-each\`)으로 자른다.
\`\`\`
R=docs/asset-requests/runner
${fit}
\`\`\`
- 칸 이름은 \`slice-map.csv\`의 \`app_file\`과 같아야 한다(키가 틀리면 앱이 그림을 못 찾는다).
- 한 물고기의 세 장(\`<key>\` · \`<key>-hang\` · \`<key>-hang-s\`)이 **다 있어야** 그 물고기가 나온다. 한 장이라도 빠지면 그 물고기는 나오지 않는다(앱은 깨지지 않는다).

## 3. 마무리
\`\`\`
npm ci
npm run build:assets      # public/modules/fish-art.js에 새 물고기가 들어간다
npm run check             # release-check 전부 PASS
npm run check:cloudflare
\`\`\`
- 점검이 실패하면 점검 파일을 고치지 말고 PR에 실패 메시지를 그대로 적는다.
- 기존 그림의 \`D\`(삭제) · \`M\`(수정)이 없어야 한다: \`git diff --name-status origin/sumus-voca-prod-deploy -- public/assets\`
- \`docs/asset-requests/runner/DONE_53.md\`(한국어): 넣은 물고기 표(시트 · 칸 · 물고기 · 파일 · 다시 만든 횟수), 넣지 못한 것과 이유, "눈으로 확인 필요". 마지막에 "세 장이 다 들어온 물고기는 깊은 바다(낚싯대 3단계)에서 바로 나온다"를 적는다.
- PR 제목 \`그림 53: 심해 물고기 ${n}종\`, 본문 한국어. 미리보기 그림(\`/tmp/review/*.png\`)을 한 장으로 작게 합쳐 PR 코멘트로 올린다. 마지막 줄: \`> ⚠️ 머지하면 운영에 바로 배포됩니다. 선생님이 "머지해"라고 할 때만 머지합니다.\`
`;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const list = sheets53();
  for (const S of Object.values(SETS)) writeFileSync(resolve(here, S.file), list.filter(s => s.file === S.file).map(s => s.text).join('\n---\n') + '\n');
  writeFileSync(resolve(here, 'CODEX_PROMPT_53.md'), codex(list));
  const split = resolve(here, 'split');
  mkdirSync(split, { recursive: true });
  for (const f of readdirSync(split)) if (/^53[ab]-\d+ /.test(f)) unlinkSync(resolve(split, f));
  for (const s of list) writeFileSync(resolve(split, toSplitName(s)), s.text + '\n');
  // slice-map.csv: 53 줄을 지우고 뒤에 다시 붙인다(번호는 앞의 마지막 번호 다음부터). 53b의 작은 그림(-hang-s)은 fit-assets --small이 만든다.
  const mapPath = resolve(here, 'slice-map.csv');
  const files = Object.values(SETS).map(S => `"${S.file}"`);
  const rows = readFileSync(mapPath, 'utf8').replace(/\n+$/, '').split('\n').filter(r => !files.some(f => r.startsWith(f)));
  let no = Math.max(...rows.slice(1).map(r => Number(r.split(',')[1]?.replace(/"/g, '')) || 0));
  const csv = v => `"${String(v).replace(/"/g, '""')}"`;
  const first = no + 1;
  for (const s of list) { no++; for (const c of s.cells) rows.push([s.file, String(no).padStart(3, '0'), s.title, c.cell, c.key, c.name, c.out].map(csv).join(',')); }
  writeFileSync(mapPath, rows.join('\n') + '\n');
  console.log(`53: ${list.length}시트 → 심해 물고기 ${DEEP_KEYS.length}종 · 그림 ${DEEP_KEYS.length * 3}장, prompt_no ${String(first).padStart(3, '0')}~${String(no).padStart(3, '0')}`);
}
