// 그림 주문서 69: 펫 아레나 랭크 티어 배지 5개(구성안 docs/pet-arena-v2-plan.md 6장 · v13.234.0).
//   node docs/asset-requests/runner/build-69.mjs
// 만드는 것: 69-arena-rank-tiers.txt, split/ 시트별 파일, slice-map.csv의 69 줄(있으면 바꿔 쓴다).
//   (build-runner.mjs는 26번 이후를 모르므로 돌리지 않는다.)
// 앱은 그림이 없어도 CSS 배지(티어 색 방패 + 보석 + 단계 숫자)로 완성되어 보인다. 그림(public/assets/arena/tier-<티어>.webp)이
//   들어오면 npm run build:assets가 public/modules/arena-art.js(ARENA_ART)에 이름을 적고, 배지가 그 그림으로 바뀐다(코드 등록 필요 없음).
//   단계 숫자(III · II · I)는 게임이 배지 아래에 글자로 붙이므로 그림에는 숫자를 넣지 않는다.
// CLAUDE.md 그림 주문서 규칙 두 가지를 시트마다 넣는다:
//   ① Drive의 기존 칭호 메달 · 아레나 그림을 열어 그림체를 맞추라 ② 정해진 Drive 폴더에 정확한 파일 이름으로 저장하라.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
export const DRIVE = 'SUMUS 펫 아레나 69 (Runner용)';
const LIST = '69-arena-rank-tiers.txt';
const SHEET = 'Create ONE square image, 1024×1024 pixels, laid out as a 2×2 sprite sheet: four separate illustrations, one centered in each quarter (each quarter is 512×512). Leave generous empty space around every illustration so nothing touches or crosses the middle lines or the image edges. Use a real transparent background (PNG alpha). Do NOT paint a checkerboard, white box, grid lines, frames or borders. No text, no letters, no numbers, no roman numerals, no logos, no watermark. Do not ask me any questions; just generate the image.';
const STYLE = 'Style: premium glossy 3D game rank emblem, like the season rank badges of a top mobile game: a symmetric heraldic shield with a gem in its upper center, metallic rim with soft gem highlights, bright rim light, crisp clean shapes, strong silhouette that reads at 30 pixels on a phone and still looks rich at 256 pixels. Front view, perfectly centered, each badge about 78% of its quarter. Each tier must look clearly MORE impressive than the one before (more wings, more gems, more glow).';
const STYLE_REF = 'STYLE REFERENCE — before drawing, open the existing pictures already in Google Drive and match their art style, rendering quality, metal and gem shading and finish exactly: the title medals "11-1.png" in the folder "SUMUS 칭호 11 (Runner용)" and "60-1.png" in the folder "SUMUS 칭호 60 (Runner용)" (the shiny tier medals) and the pet arena pictures in the folder "SUMUS 펫 아레나 65 (Runner용)" ("65-6.png" the banner and icon sheet). If those folders are not there, search Google Drive for the file names "11-1.png" and "65-6.png". The badges must look like they belong next to those medals and on that arena. Do NOT make them softer, blurrier, flatter or more watercolor-like than the references.';
const DONE = n => `WHEN DONE — upload the finished PNG to Google Drive, into the folder "${DRIVE}", named exactly "${n}.png" (if a file with that name is already there, replace it; if the folder does not exist, create it). Actually save the file to Google Drive; showing the picture in the chat is not enough.`;

export const SHEETS = [
  { no: '69-1', ko: '랭크 티어 배지 4개(브론즈 · 실버 · 골드 · 플래티넘)', cut: '--fit-each --size 256',
    body: 'Four RANK BADGES for a cute pet battle arena season (players are 10–18 years old), from the lowest to a high tier. They share the SAME base shield shape so they read as one family.',
    cells: [
      ['TOP-LEFT', 'tier-bronze', '브론즈', '256×256', 'BRONZE: a simple warm copper-bronze shield with a small round amber gem and one chevron stripe, no wings, modest glow.'],
      ['TOP-RIGHT', 'tier-silver', '실버', '256×256', 'SILVER: a polished bright silver shield with a pale blue-white gem, two chevron stripes and a thin laurel at the bottom, small sparkles.'],
      ['BOTTOM-LEFT', 'tier-gold', '골드', '256×256', 'GOLD: a rich shining gold shield with a big yellow-white star gem, small golden wings on both sides, a laurel wreath and warm glow.'],
      ['BOTTOM-RIGHT', 'tier-platinum', '플래티넘', '256×256', 'PLATINUM: a gleaming platinum shield with mint-teal crystal inlays and a large teal gem, larger silver-teal wings, a small crown spike on top and cool glow.']
    ] },
  { no: '69-2', ko: '랭크 티어 배지 다이아(한 칸) + 시즌 보상 상자', cut: '--fit-each --size 256',
    body: 'The TOP tier badge and a season reward chest, same family as sheet 69-1 (attach the finished 69-1 as a reference if you can). The BOTTOM-LEFT and BOTTOM-RIGHT quarters stay completely EMPTY (transparent).',
    cells: [
      ['TOP-LEFT', 'tier-diamond', '다이아', '256×256', 'DIAMOND: the most spectacular badge: an icy-blue and violet crystal shield with a huge brilliant cut diamond, big feathered crystal wings, a small floating crown above, light rays and tiny stars around it.'],
      ['TOP-RIGHT', 'rank-chest', '시즌 보상 상자', '256×256', 'a SEASON REWARD CHEST: a cute chunky treasure chest with gold trim and a shield-shaped lock, lid slightly open with bright golden light and sparkles bursting out (no coins with symbols, no text).'],
      ['BOTTOM-LEFT', '-', '(비움)', '', 'nothing: leave this quarter empty and transparent.'],
      ['BOTTOM-RIGHT', '-', '(비움)', '', 'nothing: leave this quarter empty and transparent.']
    ] }
];
export const promptOf = s => [SHEET, STYLE, STYLE_REF, s.body, ...s.cells.map(([cell, , , , text]) => `${cell}: ${text}`), DONE(s.no)].join('\n');
export const ITEMS = SHEETS.flatMap(s => s.cells.filter(c => c[1] !== '-').map(([cell, key, name, size]) => ({ sheet: s, cell, key, name, size })));

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  writeFileSync(resolve(here, LIST), SHEETS.map(s => `### ${s.no} ${s.ko}\n${promptOf(s)}`).join('\n\n') + '\n');
  mkdirSync(resolve(here, 'split'), { recursive: true });
  for (const s of SHEETS) writeFileSync(resolve(here, 'split', `${s.no} 펫 아레나 ${s.ko}.txt`), promptOf(s) + '\n');
  const csvPath = resolve(here, 'slice-map.csv');
  const rows = readFileSync(csvPath, 'utf8').split('\n').filter(l => l && !l.startsWith(`"${LIST}"`));
  let no = Math.max(...rows.slice(1).map(l => Number(l.split('","')[1]) || 0));
  const KO = { 'TOP-LEFT': '왼쪽 위', 'TOP-RIGHT': '오른쪽 위', 'BOTTOM-LEFT': '왼쪽 아래', 'BOTTOM-RIGHT': '오른쪽 아래' };
  const add = SHEETS.map(s => ++no && ITEMS.filter(x => x.sheet === s).map(x => `"${LIST}","${String(no).padStart(3, '0')}","${s.no} ${s.ko}","${KO[x.cell]}","arena-${x.key}","${x.name} (${x.size})","public/assets/arena/${x.key}.webp"`)).flat();
  writeFileSync(csvPath, [...rows, ...add].join('\n') + '\n');
  console.log(`[69] 시트 ${SHEETS.length}장 · 그림 ${ITEMS.length}장 · slice-map ${add.length}줄`);
}
