// 그림 주문서 60 · 61: 칭호 4탄 메달 24개(구성안 docs/titles-plan-4.md).
//   60 = 칭호 4탄 ① 일반 4 · 희귀 7 · 영웅 1, 61 = 칭호 4탄 ② 영웅 5 · 전설 6 · 한정 1
//   (낚시 8 · 시험 범위 4 · 코인과 선물 4 · 펫 육성 4 · 몬스터 사냥 3 · 10초 맞추기 주간 1). 시트 하나 = 2×2 메달 4개(11 · 25 · 50번과 같은 방식).
//   node docs/asset-requests/runner/build-60.mjs
// 만드는 것: 60 · 61 주문서(.txt), split/ 시트별 파일, slice-map.csv의 60 · 61 줄(있으면 바꿔 쓴다), CODEX_PROMPT_60.md · 61.
//   (build-runner.mjs는 26번 이후를 모르므로 돌리지 않는다: slice-map.csv 뒤쪽이 지워진다.)
// 번호: 53은 심해 물고기, 54~59는 새 펫(곤충 · 공룡)용으로 비워 둔다.
// 칭호 key는 구성안의 "키(안)"이다. 지금 칭호(titles.js TITLES)와 key나 이름이 겹치면 멈춘다.
// 앱 코드는 고치지 않는다: 그림이 들어와도 칭호는 코드 등록(다음 세션: TITLES · TITLE_ART) 전까지 앱에 나오지 않는다.
// slice-map.csv의 prompt_no는 "그때 마지막 번호 다음"이라, 앞 번호(54~59) 주문서가 나중에 들어오면 이 파일을 다시 돌려 번호를 맞춘다.
import { readFileSync, writeFileSync, mkdirSync, readdirSync, unlinkSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { TITLES, TITLE_TIERS } from '../../../public/modules/titles.js';

const here = dirname(fileURLToPath(import.meta.url));
const DRIVE_11 = 'SUMUS 칭호 11 (Runner용)', DRIVE_25 = 'SUMUS 칭호 25 (Runner용)';
export const SETS = {
  60: { series: '60', file: '60-titles-4a.txt', drive: 'SUMUS 칭호 60 (Runner용)', ko: '칭호 4탄 ① 일반 · 희귀 · 영웅', short: '칭호 4탄 ①' },
  61: { series: '61', file: '61-titles-4b.txt', drive: 'SUMUS 칭호 61 (Runner용)', ko: '칭호 4탄 ② 영웅 · 전설 · 한정', short: '칭호 4탄 ②' }
};

// 11 · 25 · 50번과 똑같은 첫 두 줄(같은 메달 가족으로 보이게).
const SHEET = 'Create ONE square image, 1024×1024 pixels, laid out as a 2×2 sprite sheet: four separate illustrations, one centered in each quarter (each quarter is 512×512). Leave generous empty space around every illustration so nothing touches or crosses the middle lines or the image edges. Use a real transparent background (PNG alpha) — do NOT paint a checkerboard, white box, grid lines, frames or borders. No text, no letters, no numbers, no labels, no watermark, no ground shadow. Do not ask me any questions; just generate the image.';
const STYLE = 'Style: shiny 3D game achievement medal, glossy enamel and polished metal, soft gem highlights, a clean bold outline, a symmetric frame, front view, one medal per cell, centered, about 78% of the cell, readable at 48 pixels. The FRAME (shape, rim and enamel color) shows the rarity tier and must be exactly as described for each cell. The small picture in the middle of the medal is different for every medal: a simple bold cute 3D object, mostly white or light colored with soft color accents, slightly raised from the enamel. No text, no letters, no numbers on the medals.';
const SUBJECT = 'Subject: All medals of this set are one family with the title medals already in this game, like the achievement medals of one premium mobile game: the same lighting, metal finish, outline and level of detail. No letters and no numbers anywhere.';
// 등급 테두리: 11 · 25 · 50번 주문서의 문장 그대로(rewards-check.mjs의 tierFrames와 같은 말). build-50.mjs는 3탄이 TITLES에
// 등록된 뒤로는 불러오면 멈추므로(겹침 검사) 문장을 여기에 다시 적는다.
export const FRAMES = {
  common: 'a ROUND medal with a thick polished mint-silver rim and a soft MINT GREEN enamel face.',
  rare: 'a HEXAGON badge (pointy top) with a polished silver rim and a deep SAPPHIRE BLUE enamel face.',
  epic: 'a SHIELD-shaped crest with a polished lavender-silver rim, a rich AMETHYST PURPLE enamel face and a small violet gem at the top.',
  legendary: 'a ROUND GOLD medal ringed by a gold sunburst of short pointed rays, a small gold star on top, a rich golden enamel face and a warm golden glow.',
  limited: 'a ROUND medal with a shimmering RAINBOW holographic rim, a dark midnight-navy enamel face, and two short rainbow ribbon tails hanging below it.'
};
// Drive의 기존 메달 시트(등급별 대표, 50번과 같다): 11-1 일반 · 11-4 희귀 · 11-8 영웅 · 11-12 전설 · 11-16 한정 + 25-1 · 25-10.
const DRIVE_REF = { common: '11-1.png', rare: '11-4.png', epic: '11-8.png', legendary: '11-12.png', limited: '11-16.png' };
// Codex용 저장소 그림(public/assets/ 아래): 같은 등급의 기존 메달(1 · 2탄 하나 + 3탄 하나).
export const REPO_REF = {
  common: ['titles/rookie.webp', 'titles/mlv10.webp'],
  rare: ['titles/words500.webp', 'titles/mlv30.webp'],
  epic: ['titles/words1000.webp', 'titles/gram30.webp'],
  legendary: ['titles/words3000.webp', 'titles/mlv70.webp'],
  limited: ['titles/weekly1.webp', 'titles/level100.webp']
};
const CELLS = ['TOP-LEFT', 'TOP-RIGHT', 'BOTTOM-LEFT', 'BOTTOM-RIGHT'];
const CELL_KO = ['왼쪽 위', '오른쪽 위', '왼쪽 아래', '오른쪽 아래'];

// 칭호 4탄 24개(구성안 표와 같은 key · 이름 · 등급). center = 메달 가운데 그림(그림 GPT용, 영어, 글자 · 숫자 없음).
// set = 주문서 번호. 시트 안에서는 등급 순서(일반 → 한정)로 넣는다.
export const MEDALS = [
  // 60-1: 일반 4
  { set: 60, key: 'fishkg', ko: '월척이다!', tier: 'common', center: 'a chubby happy fish leaping out of a small splash with a fishing line and hook at its lip, a tiny sparkle.' },
  { set: 60, key: 'range1', ko: '범위 한 바퀴', tier: 'common', center: 'a small running track loop around a neat stack of blank word cards, a little arrow closing the loop.' },
  { set: 60, key: 'coin1k', ko: '티끌 모아 천 코인', tier: 'common', center: 'a small piggy bank beside a neat little tower of gold coins, tiny dust sparkles turning into coins.' },
  { set: 60, key: 'petname', ko: '작명소 사장님', tier: 'common', center: 'a cute bone-shaped pet name tag with a blank face and a little quill pen leaning on it.' },
  // 60-2 · 60-3: 희귀 7 · 영웅 1
  { set: 60, key: 'fishbook12', ko: '물고기 반장', tier: 'rare', center: 'a small proud fish wearing a tiny class-leader armband, leading two smaller fish in a neat line.' },
  { set: 60, key: 'fishday10', ko: '오늘 회식은 나야', tier: 'rare', center: 'a little bucket overflowing with many tiny fish, a pair of chopsticks and a curly party streamer.' },
  { set: 60, key: 'deep1', ko: '심해 첫 손님', tier: 'rare', center: 'a tiny round diving helmet with a glowing anglerfish lure light dangling in front of it and a few bubbles.' },
  { set: 60, key: 'mockcover', ko: '외부지문 완주', tier: 'rare', center: 'a running sneaker breaking a finish-line ribbon stretched over a small stack of blank exam papers.' },
  { set: 60, key: 'gift20', ko: '선물 자석', tier: 'rare', center: 'a big red-and-silver horseshoe magnet pulling three small wrapped gift boxes toward it.' },
  { set: 60, key: 'petfinal', ko: '다 컸네!', tier: 'rare', center: 'a cracked-open pet eggshell beside a tall height-measuring ruler (plain, no numbers) with a little star at its top.' },
  { set: 60, key: 'huntplace', ko: '우리 동네 터줏대감', tier: 'rare', center: 'a tiny village signpost with blank boards, a little tree, a wheat bundle and a seashell around its base.' },
  { set: 60, key: 'fishlegend', ko: '전설을 낚았다', tier: 'epic', center: 'a fishing rod bent in a deep arc, its line pulling up a glowing golden fish with a little crown-shaped fin.' },
  // 61-1 · 61-2: 영웅 5
  { set: 61, key: 'rod5', ko: '낚싯대 풀강', tier: 'epic', center: 'a fancy fishing rod with five glowing gem rings along its shaft and little sparks of power.' },
  { set: 61, key: 'mockclear', ko: '모의고사 씹어먹기', tier: 'epic', center: 'a cute round monster mouth taking a big bite out of a rolled-up blank exam paper, a few paper crumbs.' },
  { set: 61, key: 'broke', ko: '통장 텅장', tier: 'epic', center: 'an empty wallet turned upside down with one little moth fluttering out and a single tiny coin falling.' },
  { set: 61, key: 'care100', ko: '100일 집사', tier: 'epic', center: 'a small pet food bowl with a heart on it, a grooming brush, and a blank calendar page stamped with a paw print.' },
  { set: 61, key: 'huntnight', ko: '올빼미 포획단', tier: 'epic', center: 'a round owl wearing a tiny explorer cap, holding a monster capture ball under a crescent moon.' },
  // 61-2 · 61-3: 전설 6 · 한정 1
  { set: 61, key: 'fishall', ko: '수산시장 사장님', tier: 'legendary', center: 'a little fish market stall with a striped awning and a neat row of different cute fish, a gold coin hanging as a sign.' },
  { set: 61, key: 'deepall', ko: '심해 탐사대장', tier: 'legendary', center: 'a small round submarine with a glowing searchlight, surrounded by tiny deep-sea creatures: an anglerfish, a squid and a manta ray.' },
  { set: 61, key: 'rangeall', ko: '시험 범위 올킬', tier: 'legendary', center: 'a stack of blank exam papers each with a big check mark, a little sword planted on top like a victory flag.' },
  { set: 61, key: 'coin30k', ko: '걸어다니는 금고', tier: 'legendary', center: 'a cute round vault safe walking on two little legs, gold coins peeking out of its door.' },
  { set: 61, key: 'petmax', ko: '만렙 펫의 보호자', tier: 'legendary', center: 'a proud little pet silhouette wearing a tiny golden crown, standing on a small winner podium with paw-print sparkles.' },
  { set: 61, key: 'huntall', ko: '몬스터 동사무소장', tier: 'legendary', center: 'an official rubber stamp pressing a paw-and-horn seal onto a thick monster registry book, tiny cute monster faces peeking out of its pages.' },
  { set: 61, key: 'timingweek', ko: '주간 초시계왕', tier: 'limited', center: 'a golden stopwatch wearing a small crown, its single hand pointing straight up, a tiny burst of light.' }
];

// key · 이름이 지금 칭호와 겹치면 멈춘다(겹치면 앱이 다른 칭호 그림을 덮어쓴다).
{
  const names = new Set(Object.values(TITLES).map(t => t.name));
  const bad = MEDALS.filter(m => TITLES[m.key] || names.has(m.ko) || !FRAMES[m.tier] || !TITLE_TIERS[m.tier] || !/^[a-z0-9]+$/.test(m.key));
  if (bad.length || new Set(MEDALS.map(m => m.key)).size !== MEDALS.length || new Set(MEDALS.map(m => m.ko)).size !== MEDALS.length) throw new Error('칭호 key · 이름 · 등급 확인: ' + bad.map(m => m.key).join(', '));
}

const tierKo = t => TITLE_TIERS[t].name;
const sheetTitle = (set, i, medals) => `${SETS[set].short} ${i} (${[...new Set(medals.map(m => tierKo(m.tier)))].join('·')})`;

export function sheets60() {
  const out = [];
  for (const set of Object.keys(SETS).map(Number)) {
    const list = MEDALS.filter(m => m.set === set);
    if (list.length % 4) throw new Error(`${set}: 메달 수가 4의 배수가 아니다`);
    for (let i = 0; i < list.length / 4; i++) {
      const medals = list.slice(i * 4, i * 4 + 4), name = `${set}-${i + 1}`, drive = SETS[set].drive;
      const tiers = [...new Set(medals.map(m => m.tier))];
      const refs = [...new Set(['common', ...tiers].map(t => DRIVE_REF[t]))].map(f => `"${f}"`).join(' and ');
      const lines = [SHEET, STYLE,
        `STYLE REFERENCE — before drawing, open the existing title medals of this game in Google Drive and study them: ${refs} in the Google Drive folder "${DRIVE_11}" (the first set of title medals) and "25-1.png" and "25-10.png" in the Google Drive folder "${DRIVE_25}". Draw the medals in exactly that style: the same glossy 3D toy-like metal and enamel, the same chunky rounded shapes, the same medal size in the cell, the same clean edges and soft sparkles. A medal of the same tier must have exactly the same frame as those medals. Do NOT make it softer, blurrier, foggier, more painterly or more watercolor-like than the reference. Do NOT copy the reference medals' center pictures.`,
        ...(i ? [`Also open "${set}-1.png" in the same folder as this sheet ("${drive}") if it is there and match it.`] : []),
        SUBJECT,
        ...medals.map((m, c) => `${CELLS[c]} cell: FRAME: ${FRAMES[m.tier]} CENTER: ${m.center}`),
        `WHEN DONE — upload the finished transparent PNG to Google Drive, into the folder "${drive}", named exactly "${name}.png" (if a file with that name is already there, replace it; if the folder does not exist, create it). Actually save the file to Google Drive; showing the picture in the chat is not enough.`];
      out.push({ set, name, file: SETS[set].file, title: sheetTitle(set, i + 1, medals), medals, text: lines.join('\n'),
        cells: medals.map((m, c) => ({ cell: CELL_KO[c], key: `title-${m.key}`, name: `${m.ko} (${tierKo(m.tier)})`, out: `public/assets/titles/${m.key}.webp` })) });
    }
  }
  return out;
}
const toSplitName = s => `${s.name} ${s.title.replace(/[\\/:*?"<>|()·~.!]/g, ' ').replace(/\s+/g, ' ').trim()}.txt`;

// ── CODEX_PROMPT ──────────────────────────────────────────────────────────────────────────
function codex(set, list) {
  const S = SETS[set], first = `${set}-1`, medals = list.flatMap(s => s.medals);
  const rows = list.flatMap(s => s.medals.map((m, c) => `| \`${s.name}\` | ${CELL_KO[c]} | \`${m.key}\` | ${m.ko} | ${tierKo(m.tier)} |`)).join('\n');
  const tiers = [...new Set(medals.map(m => m.tier))];
  const refRows = tiers.map(t => `| ${tierKo(t)} | ${REPO_REF[t].map(x => `\`${x}\``).join(', ')} |`).join('\n');
  const fit = list.map(s => `node $R/fit-assets.mjs /tmp/art/${s.name}.png ${s.medals.map(m => `titles/${m.key}`).join(' ')} --fit-each --small 96 --preview /tmp/review/${s.name}.png`).join('\n');
  return `# Codex 작업 지시: 그림 ${set} (${S.ko} · 메달 ${medals.length}개 · ${list.length}시트)

## 목표
칭호 4탄(\`docs/titles-plan-4.md\`)에 쓸 칭호 메달 ${medals.length}개를 만들고, 잘라서 \`public/assets/titles/\`에 넣은 뒤 PR을 만든다.
메달마다 **256px 본그림(\`<key>.webp\`)과 96px 작은 그림(\`<key>-s.webp\`)** 두 장이다(${medals.length * 2}장).
**그림 파일만 넣는다. 앱 코드는 고치지 않는다.**

> ⚠️ **이 그림만으로는 새 칭호가 앱에 나오지 않는다.** 칭호 등록(\`public/modules/titles.js\` TITLES · \`emblems.js\` TITLE_ART)은 다음 세션에서 코드로 한다. 그림만 먼저 들어와도 앱은 바뀌지 않고 깨지지 않는다(아무 곳에서도 이 파일을 부르지 않는다). 선생님 결정: 칭호는 그림이 오면 코드와 **같이 머지**한다.

| 시트 | 칸 | 칭호 key | 이름 | 등급 |
|---|---|---|---|---|
${rows}

- 시트와 칸마다 넣을 파일은 \`slice-map.csv\`에서 \`list\` 열이 \`${S.file}\`인 줄을 본다. 앱은 \`public/assets/titles/<key>.webp\` · \`<key>-s.webp\`를 그대로 찾는다. **key를 바꾸지 않는다.**
- 메달 **테두리(모양 · 테두리 · 법랑 색)는 등급**이다: 일반 민트 동그라미 · 희귀 파란 육각형 · 영웅 보라 방패 · 전설 금빛 햇살 · 한정 무지개. 같은 등급의 기존 메달과 테두리가 **똑같아야** 한다.

## 꼭 지킬 것
- **기존 칭호 메달(1 · 2 · 3탄)과 같은 그림체**로 맞춘다. 더 흐리거나 뿌옇거나 수채화처럼 만들지 않는다. 기존 메달의 가운데 그림은 베끼지 않는다.
- 메달에 **글자 · 숫자 · 로고를 넣지 않는다**(\`티끌 모아 천 코인\` · \`100일 집사\` · \`걸어다니는 금고\`에도 숫자를 그리지 않는다, 달력 · 자 · 표지판은 비워 둔다). 배경 · 바닥 그림자 · 체크무늬가 없다(진짜 투명).
- 48px로 줄여도 알아볼 수 있는 큰 가운데 그림.
- **한 번에 시트 하나(메달 4개)씩** 만든다. ${list.length}시트를 한 장에 몰아 그리지 않는다.
- **PR까지만 만든다. 머지하지 않는다.** \`sumus-voca-prod-deploy\`에 머지하면 운영에 바로 배포된다. **운영 Supabase에 연결하지 않는다.**
- **그림은 Codex에 내장된 그림 생성 기능으로 만든다.** OpenAI API 키나 유료 API를 쓰지 않는다. 키가 없다고 멈추지 않는다.
- **Google Drive는 쓰지 않는다. 멈추지 않는다.** Codex에는 Drive가 없다. 아래 "프롬프트 손보기"대로 Drive 문구를 지우고 저장소 안의 기존 메달 그림을 참고 그림으로 붙인다.
- 고치는 파일: \`public/assets/titles/\` 아래 **새 그림**, 빌드가 바꿀 수 있는 \`public/sw.js\`, \`docs/asset-requests/runner/DONE_${set}.md\`. 그 밖의 앱 코드, 게임 규칙, 코인, 서버 로직, 점검 파일은 건드리지 않는다. 버전은 올리지 않는다.
- 기존 그림 파일은 지우거나 덮어쓰지 않는다. **새 파일만 추가**한다. 원본 시트 PNG는 커밋하지 않는다(\`/tmp/art/\`).
- **브랜치:** \`sumus-voca-prod-deploy\`에서 새로 만든다(예: \`codex/art-${set}\`). 그 브랜치에 \`docs/asset-requests/runner/${S.file}\`가 없으면 주문서 PR이 아직 머지되지 않은 것이다. 그때는 \`claude/titles-plan-4\`에서 시작하고 PR 대상도 그 브랜치로 한다.

## 입력 (저장소 안, \`docs/asset-requests/runner/\`)
- \`split/${first} …\` ~ \`${set}-${list.length} …\`: 시트 하나 = 프롬프트 하나. 묶음 전체는 \`${S.file}\`.
- \`slice-map.csv\`: 칸 이름 · 앱 파일. 칸 순서는 왼쪽 위 → 오른쪽 위 → 왼쪽 아래 → 오른쪽 아래.
- 자르기 도구: \`fit-assets.mjs\`(사용법은 파일 맨 위 주석). \`sharp\`가 없으면 \`npm i --no-save sharp\`.
- 보내는 순서: \`${list.map(s => s.name).join('` → `')}\`. 첫 시트가 먼저 있어야 뒤 시트가 맞출 수 있다.

### 프롬프트 손보기 (Drive 대신 참고 그림 첨부)
시트 프롬프트(\`split/\`)는 그림 GPT가 Google Drive를 여는 방식으로 쓰여 있다(Drive의 기존 칭호 메달 11 · 25번을 열어 그림체를 맞추고, 정해진 Drive 폴더 "${S.drive}"에 정확한 파일 이름 "${first}.png" … 으로 저장). Codex는 Drive를 쓰지 않으니 보내기 전에 이렇게 고친다.
1. 다음으로 **시작하는 줄을 지운다**: \`STYLE REFERENCE\`, \`Also open\`, \`WHEN DONE\`
2. 아래 표의 참고 그림(저장소 안 기존 메달)을 같이 보여 주고, 프롬프트 **세 번째 줄**에 이 문장을 넣는다:
   \`REFERENCE IMAGES ARE ATTACHED: they are title medals already in this game. Match their art style, glossy metal and enamel, medal size in the cell, crisp clean edges and colors exactly. A medal of the same tier must have exactly the same frame as the reference of that tier. Do NOT copy the center pictures of the references.\`
3. \`${set}-2\`부터는 참고 그림에 방금 만든 첫 시트 \`/tmp/art/${first}.png\`도 같이 붙인다(마감 · 칸 안 크기를 맞춘다. 가운데 그림은 베끼지 않는다).

### 참고 그림 (\`public/assets/\` 아래 경로, 시트에 나오는 등급만)
| 등급 | 참고 그림 |
|---|---|
${refRows}
| 모든 시트 | \`titles/preview-25.webp\` (칭호 2탄 40개를 한 장에 모은 그림: 메달 가족 전체 느낌) |
| ${set}-2 이후 | \`/tmp/art/${first}.png\` (같은 묶음의 첫 시트) |

### 후보 점검 (모두 통과해야 쓴다)
1. 배경이 진짜 투명이다(네 모서리 alpha 0, 체크무늬 · 흰 상자 · 흰 테두리 없음).
2. 칸마다 메달이 하나씩 따로 있고, 겹치거나 잘리지 않았다. 글자, 숫자, 로고, 바닥 그림자가 없다.
3. 칸마다 테두리가 표의 등급과 같고, 같은 등급의 기존 메달(참고 그림)과 테두리 모양 · 색이 같다.
4. 기존 메달과 나란히 놓아도 같은 게임 그림처럼 보이고, 48px로 줄여도 가운데 그림을 알아볼 수 있다.

이미지를 볼 수 있으면 눈으로 확인한다. 볼 수 없으면 1~2번만 확인하고 PR에 "눈으로 확인 필요"라고 적는다.

## 1. 그림 만들기
- **Codex의 내장 그림 생성 기능**으로 시트를 하나씩 만든다. API를 직접 부르지 않는다.
- 2×2 시트 1024×1024, **투명 배경 PNG**, 칸마다 메달 하나.
- 만든 그림은 \`/tmp/art/<시트 번호>.png\`로 저장한다(예: \`/tmp/art/${first}.png\`). 점검을 통과하지 못하면 같은 프롬프트로 다시 만든다. 시트마다 최대 4번이다.
- 한 번에 다 못 만들면 **시트 단위**로 끊는다. 못 만든 시트는 \`DONE_${set}.md\`의 "넣지 못한 그림"에 적는다.

## 2. 자르고 넣기
기존 메달과 같은 규격(256px 본그림 + 96px 작은 그림, 투명 webp, 칸마다 같은 크기 \`--fit-each\`)으로 자른다.
\`\`\`
R=docs/asset-requests/runner
${fit}
\`\`\`
- 칸 이름은 \`slice-map.csv\`의 \`app_file\`과 같아야 한다(키가 틀리면 앱이 그림을 못 찾는다).
- 한 칸이 점검을 통과하지 못하면 그 칸 이름을 \`-\`로 주어 버리고, 그 메달만 다시 만든다.

## 3. 마무리
\`\`\`
npm ci
npm run build:assets
npm run check             # release-check 전부 PASS
npm run check:cloudflare
\`\`\`
- 점검이 실패하면 점검 파일을 고치지 말고 PR에 실패 메시지를 그대로 적는다.
- 기존 그림의 \`D\`(삭제) · \`M\`(수정)이 없어야 한다: \`git diff --name-status origin/sumus-voca-prod-deploy -- public/assets\`
- \`docs/asset-requests/runner/DONE_${set}.md\`(한국어): 넣은 메달 표(시트 · 칸 · 칭호 · 파일 · 다시 만든 횟수), 넣지 못한 것과 이유, "눈으로 확인 필요". 마지막에 "새 칭호는 코드 등록(TITLES · TITLE_ART, 다음 세션) 후에 앱에 나온다"를 적는다.
- PR 제목 \`그림 ${set}: ${S.ko} 메달 ${medals.length}개\`, 본문 한국어. 미리보기 그림(\`/tmp/review/*.png\`)을 한 장으로 작게 합쳐 PR 코멘트로 올린다. 마지막 줄: \`> ⚠️ 머지하면 운영에 바로 배포됩니다. 선생님이 "머지해"라고 할 때만 머지합니다.\`
`;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const list = sheets60();
  for (const S of Object.values(SETS)) writeFileSync(resolve(here, S.file), list.filter(s => s.file === S.file).map(s => s.text).join('\n---\n') + '\n');
  for (const set of Object.keys(SETS)) writeFileSync(resolve(here, `CODEX_PROMPT_${set}.md`), codex(Number(set), list.filter(s => s.set === Number(set))));
  const split = resolve(here, 'split');
  mkdirSync(split, { recursive: true });
  for (const f of readdirSync(split)) if (/^6[01]-\d+ /.test(f)) unlinkSync(resolve(split, f));
  for (const s of list) writeFileSync(resolve(split, toSplitName(s)), s.text + '\n');
  // slice-map.csv: 60 · 61 줄을 지우고 뒤에 다시 붙인다(번호는 앞의 마지막 번호 다음부터).
  const mapPath = resolve(here, 'slice-map.csv');
  const files = Object.values(SETS).map(S => `"${S.file}"`);
  const rows = readFileSync(mapPath, 'utf8').replace(/\n+$/, '').split('\n').filter(r => !files.some(f => r.startsWith(f)));
  let no = Math.max(...rows.slice(1).map(r => Number(r.split(',')[1]?.replace(/"/g, '')) || 0));
  const csv = v => `"${String(v).replace(/"/g, '""')}"`;
  const first = no + 1;
  for (const s of list) { no++; for (const c of s.cells) rows.push([s.file, String(no).padStart(3, '0'), s.title, c.cell, c.key, c.name, c.out].map(csv).join(',')); }
  writeFileSync(mapPath, rows.join('\n') + '\n');
  console.log(`60 · 61: ${list.length}시트 → 메달 ${MEDALS.length}개, prompt_no ${String(first).padStart(3, '0')}~${String(no).padStart(3, '0')}`);
}
