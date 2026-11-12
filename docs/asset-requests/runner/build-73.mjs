// 그림 주문서 73: 펫 아레나 스킬트리 화면(구성안 docs/arena-battle-reboot-plan.md 6-4).
//   node docs/asset-requests/runner/build-73.mjs
// 만드는 것: 73-arena-skill-tree.txt, split/ 시트별 파일, slice-map.csv의 73 줄.
// 스킬트리 판: 아래(1층)에서 위(3층)로 자라는 나무. 층마다 가지 A · B 두 갈래. 열릴 때 빛이 줄기를 따라 흐르고, 고른 노드가 타오른다(코드 연출).
//   그림은 판 바탕 1장 + 노드 · 사슬 · 빛 조각만. 글자 · 레벨 숫자 · 스킬 아이콘은 게임이 위에 놓는다.
// 넣는 곳: public/assets/arena/tree-<이름>.webp. 앱에 붙이는 일은 구성안 ⑦단계.
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { done, styleRef, writeOrder } from './arena-order.mjs';

const here = dirname(fileURLToPath(import.meta.url));
export const DRIVE = 'SUMUS 펫 아레나 73 (Runner용)';
const LIST = '73-arena-skill-tree.txt';
const REFS = [['SUMUS 펫 아레나 70 (Runner용)', '"70-1.png" the UI style guide, "70-3.png" the navy glass panel and gold frame'], ['SUMUS 펫 아레나 71 (Runner용)', '"71-1.png" the glow materials'], ['SUMUS 펫 아레나 65 (Runner용)', '"65-6.png" the banner and icon sheet']];
const GRID2 = 'Create ONE square image, 1024×1024 pixels, laid out as a 2×2 sprite sheet: four separate illustrations, one centered in each quarter (each quarter is 512×512). Leave generous empty space around every illustration so nothing touches or crosses the middle lines or the image edges. Use a real transparent background (PNG alpha). Do NOT paint a checkerboard, white box, grid lines, frames or borders. No text, no letters, no numbers, no watermark. Do not ask me any questions; just generate the image.';
const STYLE = 'Style: premium 3D-painted mobile game UI for a cute pet battle game, the same navy glass + gold material language as the style guide, light from the upper-left, magical and spectacular but clean and readable.';

export const SHEETS = [
  { no: '73-1', ko: '스킬트리 판 바탕(세로 한 장)', head: 'Create ONE tall portrait image, 1024×1536 pixels, painted fully to every edge (no transparency, no border). No text, no letters, no numbers, no logos, no people, no characters, no pets. Do not ask me any questions; just generate the image.',
    body: ['A SKILL TREE BOARD background: a deep navy magical night backdrop with soft starlight, and in the middle a stylized glowing TREE drawn like an emblem, growing from the BOTTOM to the TOP: a sturdy trunk rising from roots at the bottom center, splitting into THREE levels of TWO branches each (left branch and right branch at about 70%, 45% and 20% of the height).',
      'At the end of every branch there is an EMPTY round socket (about 120 pixels wide, a darker recessed hole with a thin gold rim) where the game will place a node icon; six sockets in total, plus one bigger empty socket at the very top (the crown) and one at the bottom (the roots).',
      'The trunk and branches are dark bark with thin gold inlay channels running along them (the game makes light flow through these channels), not glowing yet: calm, so the game\'s light effects stand out.',
      'Keep a calm darker band at the top 0–8% and bottom 92–100% for the game UI.'], key: 'tree-bg', name: '스킬트리 판 바탕 (720×1080)' },
  { no: '73-2', ko: '노드 · 고른 빛 · 사슬 · 빛 줄기', grid: true,
    cells: [
      ['TOP-LEFT', 'tree-node', '노드 바탕(열림)', 'an OPEN NODE BASE: a round navy glass disc about 300 pixels wide with a MEDIUM gold rim and a plain middle (the game puts the skill icon there).'],
      ['TOP-RIGHT', 'tree-node-on', '고른 노드 빛', 'a CHOSEN NODE GLOW: a bright golden-white ring with soft radiant halo and a few sparkles, the same size as the node base; the inside is completely transparent.'],
      ['BOTTOM-LEFT', 'tree-lock', '잠긴 노드(사슬)', 'a LOCKED NODE: the same round node shape in dull gray-navy, wrapped by two crossing silver CHAINS with a small padlock at the crossing.'],
      ['BOTTOM-RIGHT', 'tree-flow', '빛 줄기 조각', 'a short LIGHT FLOW segment: a horizontal glowing golden energy stroke about 420 pixels long with a bright head on the RIGHT and a soft fading tail on the left, a few sparkles (the game moves it along the branches).']
    ] }
];
export const promptOf = s => {
  const lines = [s.head || GRID2, STYLE, styleRef(REFS), ...(s.body || [])];
  for (const c of s.cells || []) lines.push(`${c[0]}: ${c[3]}`);
  lines.push(done(DRIVE, s.no));
  return lines.join('\n');
};
export const ITEMS = SHEETS.flatMap(s => s.cells ? s.cells.map(([cell, key, name]) => ({ sheet: s, cell, key: 'arena-' + key, name, file: `public/assets/arena/${key}.webp` })) : [{ sheet: s, cell: '한 장', key: 'arena-' + s.key, name: s.name, file: `public/assets/arena/${s.key}.webp` }]);

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const n = writeOrder(here, LIST, '펫 아레나 스킬트리', SHEETS.map(s => ({ ...s, prompt: promptOf(s) })), ITEMS);
  console.log(`[73] 시트 ${SHEETS.length}장 · 그림 ${ITEMS.length}장 · slice-map ${n}줄`);
}
