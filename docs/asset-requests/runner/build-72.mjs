// 그림 주문서 72: 위에서 내려다본 펫 아레나 경기장 바닥 7장(구성안 docs/arena-battle-reboot-plan.md 3-1 · 6-2).
//   node docs/asset-requests/runner/build-72.mjs
// 만드는 것: 72-arena-top-floors.txt, split/ 시트별 파일, slice-map.csv의 72 줄.
// 캔버스 전투는 "위에서 비스듬히 내려다보는 시점"이고, 규칙 경기장(FIELD 가로 84 · 세로 72, 같은 단위)을 그대로 그린다.
//   → 바닥 판은 가로가 세로보다 조금 긴 둥근 사각형(84:72), 그림의 정해진 칸(가로 6~94% · 세로 25~75%)에 딱 맞게.
//   위아래 남는 곳은 경기장 밖 풍경(세로 폰에서 카메라가 움직일 때 보이는 곳).
// 경기장 꾸미기 해금 7가지(arena-deco-rules.js bg: plaza · forest · night · sky · glacier · volcano · galaxy)를 모두 같은 장소로 다시 그린다.
// 넣는 곳: public/assets/arena/floor-<이름>.webp (1080×1620). 앱에 붙이는 일은 구성안 ⑥단계.
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { done, styleRef, writeOrder } from './arena-order.mjs';

const here = dirname(fileURLToPath(import.meta.url));
export const DRIVE = 'SUMUS 펫 아레나 72 (Runner용)';
const LIST = '72-arena-top-floors.txt';
const HEAD = 'Create ONE tall portrait image, 1024×1536 pixels, painted fully to every edge (no transparency, no border, no frame). No text, no letters, no numbers, no logos, no people, no characters, no creatures, no pets. Do not ask me any questions; just generate the image.';
const STYLE = 'Style: premium glossy 3D-painted mobile game background, rich clear colors, crisp clean shapes, bright and joyful.';
const LAYOUT = 'CAMERA AND LAYOUT (very important, the game places the fight exactly here): a TOP-DOWN view, looking almost straight DOWN (about 75 degrees) onto a flat battle platform. The battle PLATFORM is a rounded rectangle slightly WIDER THAN TALL (width:height = 84:72) that fills exactly from 6% to 94% of the image width and from 25% to 75% of the image height. The platform surface is flat, evenly lit, calm and simple (gentle texture only, no objects, no obstacles, no strong shadows, no painted circles or lines in the middle) so effects, cracks and pets stay readable on it; a clear decorative RIM marks its edge. ABOVE (0–25%) and BELOW (75–100%) the platform: the surroundings of the place, seen from the same top-down camera, a bit darker and lower in detail.';
const REF = (extra = []) => [['SUMUS 펫 아레나 65 (Runner용)', '"65-2.png" cherry-blossom arena, "65-3.png" forest arena, "65-4.png" night arena'], ['SUMUS 펫 아레나 68 (Runner용)', '"68-1.png" sky garden and ice cave arenas, "68-2.png" volcano and galaxy arenas'], ...extra];
const FIRST = 'For every sheet after 72-1, ALSO open "72-1.png" in the folder "SUMUS 펫 아레나 72 (Runner용)" and keep EXACTLY the same camera, platform size, platform position and rim thickness; only the place changes.';

export const SHEETS = [
  ['72-1', 'plaza', '벚꽃 광장', 'the CHERRY-BLOSSOM PLAZA of "65-2.png" seen from above: the platform is pale polished marble tiles with a thin gold-and-mint inlaid rim; around it cherry blossom tree crowns, petals on stone paths and a low stone railing.'],
  ['72-2', 'forest', '숲속 경기장', 'the FOREST CLEARING of "65-3.png" seen from above: the platform is flat mossy stone slabs with a soft glowing green rune rim; around it big tree crowns, ferns, mushrooms and sun spots.'],
  ['72-3', 'night', '밤의 경기장', 'the NIGHT ARENA of "65-4.png" seen from above: the platform is dark-navy crystal with faint constellation lines near the rim only and a glowing cyan-gold rim; around it deep night sky clouds and small floating lanterns.'],
  ['72-4', 'sky', '구름 위 하늘 정원', 'the SKY GARDEN of "68-1.png" (left) seen from above: the platform is short bright grass with a white stone rim and small flowers along the rim; around it fluffy clouds far below and a faint rainbow.'],
  ['72-5', 'glacier', '얼음 동굴', 'the ICE CAVE of "68-1.png" (right) seen from above: the platform is frosted (not mirror-shiny) pale blue ice with a white snowy rim; around it blue crystal pillars, snow and a soft aurora light on the ice.'],
  ['72-6', 'volcano', '화산 분화구', 'the VOLCANO CRATER of "68-2.png" (left) seen from above: the platform is dark basalt slabs with thin glowing orange cracks ONLY along the rim (the middle plain); around it a ring of flowing lava, black rocks and glowing embers.'],
  ['72-7', 'galaxy', '별빛 은하', 'the GALAXY STAGE of "68-2.png" (right) seen from above: the platform is glossy violet crystal with a soft starlight rim; around it deep space, a swirling pink-blue galaxy, a ringed planet and tiny stars.']
].map(([no, key, ko, body]) => ({ no, key, ko: `바닥: ${ko}`, body }));
export const promptOf = s => [HEAD, STYLE, styleRef(REF()), ...(s.no === '72-1' ? [] : [FIRST]), LAYOUT, `PLACE: ${s.body}`, 'Bright, friendly and beautiful, never scary. The platform must look clearly different in each place but always calm in the middle.', done(DRIVE, s.no)].join('\n');
export const ITEMS = SHEETS.map(s => ({ sheet: s, cell: '한 장', key: `arena-floor-${s.key}`, name: `${s.ko} (1080×1620)`, file: `public/assets/arena/floor-${s.key}.webp` }));

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const n = writeOrder(here, LIST, '펫 아레나 위에서 본', SHEETS.map(s => ({ ...s, prompt: promptOf(s) })), ITEMS);
  console.log(`[72] 시트 ${SHEETS.length}장 · 그림 ${ITEMS.length}장 · slice-map ${n}줄`);
}
