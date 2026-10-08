// Release checks for the pet art order 18 (새 펫 8종 2탄: docs/asset-requests/runner/18a·18b + CODEX_PROMPT_18.md).
// The order must stay in step with what the app reads (public/assets/pets/<key>-<form>[-<expression>].webp) and with
// the rules of the order files (Google Drive upload line, one sheet per prompt, no name that an existing pet has).
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { CHARACTERS } from '../public/modules/core.js';

const here = path => fileURLToPath(new URL(path, import.meta.url));
const read = path => readFileSync(here(path), 'utf8');
const KEYS = ['frog', 'sapsaree', 'deer', 'bear', 'seal', 'wolf', 'crocodile', 'octopus'];
const EPIC = ['seal', 'wolf', 'crocodile', 'octopus'];

export function runPetOrderChecks(assert) {
  const dir = '../docs/asset-requests/runner/';
  const design = read(`${dir}18a-new-pets-design.txt`).split('\n---\n'), expr = read(`${dir}18b-new-pets-expressions.txt`).split('\n---\n');
  assert(design.length === 8 && expr.length === 28, 'V13.114 그림 주문서 18: 설정 시트 8장(펫마다 1장), 표정 시트 24장 + 알 반응 4장');
  assert(KEYS.every(key => !CHARACTERS[key]), 'V13.114 새 펫 8종의 key(frog sapsaree deer bear seal wolf crocodile octopus)는 아직 앱에 없는 펫이다');
  const csv = read(`${dir}slice-map.csv`).split('\n').filter(line => /^"18[ab]-/.test(line));
  const rows = csv.map(line => line.match(/"((?:[^"]|"")*)"/g).map(cell => cell.slice(1, -1)));
  const files = rows.map(row => row[6]);
  assert(rows.length === 144 && new Set(files).size === 144 && files.every(file => /^public\/assets\/pets\/[a-z]+-[0-3](-(happy|eat|sad|cheer))?\.webp$/.test(file)), 'V13.114 slice-map: 새 펫 그림 144칸이 서로 다른 앱 파일 이름(<key>-<단계>[-<표정>].webp)에 이어진다');
  const perPet = Object.fromEntries(KEYS.map(key => [key, files.filter(file => file.startsWith(`public/assets/pets/${key}-`)).map(file => file.slice('public/assets/pets/'.length, -5))]));
  assert(KEYS.every(key => {
    const names = perPet[key], want = [0, 1, 2, 3].map(form => `${key}-${form}`);
    for (const form of [1, 2, 3]) for (const expression of ['happy', 'eat', 'sad', 'cheer']) want.push(`${key}-${form}-${expression}`);
    want.push(`${key}-0-happy`, `${key}-0-eat`);
    return names.length === 18 && want.every(name => names.includes(name));
  }), 'V13.114 펫마다 앱이 읽는 그림 18개(알·아기·성장·최종 + 아기·성장·최종 × 표정 4 + 알 반응 2)가 모두 주문에 있다');
  const splitDir = readdirSync(here(`${dir}split`)).filter(name => /^18[ab]-/.test(name));
  assert(splitDir.length === 36, 'V13.114 split/ 폴더에 18번 시트 36장이 한 장에 한 파일씩 있다');
  const all = [...design.map((text, i) => [`18a-${i + 1}`, text]), ...expr.map((text, i) => [`18b-${i + 1}`, text])];
  assert(all.every(([name, text]) => text.includes('Google Drive, into the folder "SUMUS 새 펫 18 (Runner용)"') && text.includes(`named exactly "${name}.png"`) && text.includes('real transparent background')), 'V13.114 모든 시트에 "SUMUS 새 펫 18 (Runner용)" 폴더·시트 이름으로 올리라는 문장과 투명 배경 규칙이 있다');
  assert(design.every(text => /STYLE REFERENCE/.test(text) && /SUMUS_PET_SPRITES_ALL_20261002\/original_1254/.test(text)) && expr.filter(text => !/two pet eggs/.test(text)).every(text => /CHARACTER REFERENCE — before drawing, open "18a-\d\.png"/.test(text)) && expr.filter(text => /two pet eggs/.test(text)).every(text => /open "18a-\d\.png" and "18a-\d\.png"/.test(text)), 'V13.114 그림체는 Drive의 기존 펫을 열어 맞추고, 표정·알 반응 시트는 같은 펫의 설정 시트(18a-N)를 열어 맞춘다');
  assert(EPIC.every(key => design.some(text => text.includes('A 영웅 (epic) pet')) ) && design.filter(text => text.includes('A 영웅 (epic) pet')).length === 4 && expr.filter(text => !/two pet eggs/.test(text) && text.includes('A 영웅 (epic) pet')).length === 12, 'V13.114 영웅 4종(물범·늑대·악어·문어)만 영웅 문장이 있다: 설정 4장 + 표정 12장');
  const own = Object.fromEntries(Object.entries(CHARACTERS).map(([key, value]) => [key, value.ko]));
  const koOf = text => text.match(/^Subject: ([^,]+),/m)?.[1];
  const names = design.map(koOf);
  assert(names.length === 8 && new Set(names).size === 8 && names.every(name => name && !Object.values(own).includes(name)), 'V13.114 새 펫의 임시 이름 8개는 서로 다르고 지금 있는 펫 이름과 겹치지 않는다');
  assert(expr.filter(text => !/two pet eggs/.test(text)).filter(text => /^Subject: 말랑,/m.test(text)).every(text => text.includes('raises one tentacle instead')) && expr.filter(text => /^Subject: 폴짝,/m.test(text)).every(text => text.includes('raises one webbed hand instead')) && expr.filter(text => /^Subject: 동글,/m.test(text)).every(text => text.includes('raises one flipper instead')), 'V13.114 응원 동작은 펫 몸에 맞게 문어 촉수 · 개구리 손 · 물범 지느러미를 든다');
  assert(design.filter(text => /Shiba|shaggy/.test(text)).length >= 1 && design.every(text => !/(sharp teeth|fangs|blood|skull)/i.test(text.replace(/never scary[^.]*\./gi, '').replace(/no (sharp )?teeth[^.]*/gi, '').replace(/no fangs[^)]*/gi, ''))), 'V13.114 늑대·악어를 포함해 무서운 표현(날카로운 이빨, 피, 해골)이 주문에 없다');
  const codex = read(`${dir}CODEX_PROMPT_18.md`);
  assert(KEYS.every(key => codex.includes(`\`${key}\``)) && codex.includes('PR까지만 만든다. 머지하지 않는다.') && codex.includes('운영 Supabase에 연결하지 않는다') && codex.includes('앱 코드는 고치지 않는다') && codex.includes('내장 그림 생성 기능') && codex.includes('DONE_18.md') && codex.includes('`D`(삭제)와 `M`(수정)이 하나도 없어야 한다') && codex.includes('--stand') && codex.includes('fit-sheets.mjs') && codex.includes('-s.webp'), 'V13.114 Codex 지시서(CODEX_PROMPT_18.md): 8종 key, PR까지만, 운영 DB 금지, 앱 코드 금지, 내장 그림 기능, 새 파일만 추가, 자르기 명령, 작은 그림, 기록 파일이 있다');
  assert(read(`${dir}README.md`).includes('`18a-new-pets-design.txt`') && read(`${dir}README.md`).includes('`18b-new-pets-expressions.txt`') && read(`${dir}README.md`).includes('| `00-all-in-order.txt` | 195 | 780 |'), 'V13.114 주문서 README에 18a·18b와 합본 개수(195장 · 780개)가 적혀 있다');
}
