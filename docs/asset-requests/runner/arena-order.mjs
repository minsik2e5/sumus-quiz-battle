// 펫 아레나 전투 다시 만들기(docs/arena-battle-reboot-plan.md) 그림 주문서 70 · 72 · 73이 같이 쓰는 도우미.
//   주문서 묶음 파일(NN-….txt) · split/ 시트별 파일 · slice-map.csv의 NN 줄(있으면 바꿔 쓴다)을 만든다.
//   CLAUDE.md 그림 주문서 규칙 두 가지는 시트마다 넣는다: ① Drive의 기존 그림을 열어 그림체를 맞추라(styleRef)
//   ② 정해진 Drive 폴더에 정확한 파일 이름으로 저장하라(done).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

export const done = (drive, no) => `WHEN DONE — upload the finished PNG to Google Drive, into the folder "${drive}", named exactly "${no}.png" (if a file with that name is already there, replace it; if the folder does not exist, create it). Actually save the file to Google Drive; showing the picture in the chat is not enough.`;
export const styleRef = refs => `STYLE REFERENCE — before drawing, open these existing pictures already in Google Drive and match their art style, rendering quality, color clarity, lighting direction (light from the upper-left) and finish exactly: ${refs.map(([folder, files]) => `the folder "${folder}" (${files})`).join(', ')}. If a folder is not there, search Google Drive for those exact file names. Original designs only: do NOT copy or resemble any character, creature, logo, icon or screen layout from any other game, anime, cartoon or movie.`;
export const KO_CELL = { 'TOP-LEFT': '왼쪽 위', 'TOP-RIGHT': '오른쪽 위', 'BOTTOM-LEFT': '왼쪽 아래', 'BOTTOM-RIGHT': '오른쪽 아래', '한 장': '한 장' };

// sheets: [{ no, ko, prompt }], items: [{ sheet, cell, key, name, file }] (file = 앱 경로 또는 '(참고용 · 앱에 넣지 않음)')
export function writeOrder(here, LIST, title, sheets, items) {
  writeFileSync(resolve(here, LIST), sheets.map(s => `### ${s.no} ${s.ko}\n${s.prompt}`).join('\n\n') + '\n');
  mkdirSync(resolve(here, 'split'), { recursive: true });
  for (const s of sheets) writeFileSync(resolve(here, 'split', `${s.no} ${title} ${s.ko.split('(')[0].trim()}.txt`), s.prompt + '\n');
  const csvPath = resolve(here, 'slice-map.csv');
  const rows = readFileSync(csvPath, 'utf8').split('\n').filter(l => l && !l.startsWith(`"${LIST}"`));
  let no = Math.max(...rows.slice(1).map(l => Number(l.split('","')[1]) || 0));
  const add = sheets.map(s => ++no && items.filter(x => x.sheet.no === s.no).map(x => `"${LIST}","${String(no).padStart(3, '0')}","${s.no} ${s.ko}","${KO_CELL[x.cell] || x.cell}","${x.key}","${x.name}","${x.file}"`)).flat();
  writeFileSync(csvPath, [...rows, ...add].join('\n') + '\n');
  return add.length;
}
