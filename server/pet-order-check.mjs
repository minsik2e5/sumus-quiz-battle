// Release checks for the pet art order 18 (새 펫 8종 2탄: docs/asset-requests/runner/18a·18b + CODEX_PROMPT_18.md).
// The order must stay in step with what the app reads (public/assets/pets/<key>-<form>[-<expression>].webp) and with
// the rules of the order files (Google Drive upload line, one sheet per prompt, no name that an existing pet has).
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { CHARACTERS } from '../public/modules/core.js';
import { MONSTERS } from '../public/modules/monsters.js';

const here = path => fileURLToPath(new URL(path, import.meta.url));
const read = path => readFileSync(here(path), 'utf8');
const KEYS = ['frog', 'sapsaree', 'deer', 'bear', 'seal', 'wolf', 'crocodile', 'octopus'];
const EPIC = ['seal', 'wolf', 'crocodile', 'octopus'];

export function runPetOrderChecks(assert) {
  const dir = '../docs/asset-requests/runner/';
  const design = read(`${dir}18a-new-pets-design.txt`).split('\n---\n'), expr = read(`${dir}18b-new-pets-expressions.txt`).split('\n---\n');
  assert(design.length === 8 && expr.length === 28, 'V13.114 그림 주문서 18: 설정 시트 8장(펫마다 1장), 표정 시트 24장 + 알 반응 4장');
  assert(KEYS.every(key => CHARACTERS[key]), 'V13.114 새 펫 8종의 key(frog sapsaree deer bear seal wolf crocodile octopus)가 앱에 등록됐다');
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
  assert(names.length === 8 && new Set(names).size === 8 && names.every((name, i) => name === own[KEYS[i]]), 'V13.114 주문서 이름 8개가 앱에 등록된 이름과 일치한다');
  assert(expr.filter(text => !/two pet eggs/.test(text)).filter(text => /^Subject: 말랑,/m.test(text)).every(text => text.includes('raises one tentacle instead')) && expr.filter(text => /^Subject: 폴짝,/m.test(text)).every(text => text.includes('raises one webbed hand instead')) && expr.filter(text => /^Subject: 동글,/m.test(text)).every(text => text.includes('raises one flipper instead')), 'V13.114 응원 동작은 펫 몸에 맞게 문어 촉수 · 개구리 손 · 물범 지느러미를 든다');
  assert(design.filter(text => /Shiba|shaggy/.test(text)).length >= 1 && design.every(text => !/(sharp teeth|fangs|blood|skull)/i.test(text.replace(/never scary[^.]*\./gi, '').replace(/no (sharp )?teeth[^.]*/gi, '').replace(/no fangs[^)]*/gi, ''))), 'V13.114 늑대·악어를 포함해 무서운 표현(날카로운 이빨, 피, 해골)이 주문에 없다');
  const codex = read(`${dir}CODEX_PROMPT_18.md`);
  assert(KEYS.every(key => codex.includes(`\`${key}\``)) && codex.includes('PR까지만 만든다. 머지하지 않는다.') && codex.includes('운영 Supabase에 연결하지 않는다') && codex.includes('앱 코드는 고치지 않는다') && codex.includes('내장 그림 생성 기능') && codex.includes('DONE_18.md') && codex.includes('`D`(삭제)와 `M`(수정)이 하나도 없어야 한다') && codex.includes('--stand') && codex.includes('fit-sheets.mjs') && codex.includes('-s.webp'), 'V13.114 Codex 지시서(CODEX_PROMPT_18.md): 8종 key, PR까지만, 운영 DB 금지, 앱 코드 금지, 내장 그림 기능, 새 파일만 추가, 자르기 명령, 작은 그림, 기록 파일이 있다');
  const readme = read(`${dir}README.md`), allCount = read(`${dir}00-all-in-order.txt`).split('\n---\n').length;
  assert(readme.includes('`18a-new-pets-design.txt`') && readme.includes('`18b-new-pets-expressions.txt`') && readme.includes(`| \`00-all-in-order.txt\` | ${allCount} | ${allCount * 4} |`), 'V13.114 주문서 README에 18a·18b와 합본 개수(프롬프트 수 × 4)가 적혀 있다');

  /* ---------- 19 신화 펫 5종 · 천마 · 이벤트 주먹이 + 신화 등장 연출 ---------- */
  const MYTHIC = ['gumiho', 'cheongryong', 'baekho', 'jujak', 'hyeonmu'], PETS19 = [...MYTHIC, 'cheonma', 'riceball'];
  const part = name => read(`${dir}${name}`).split('\n---\n');
  const d19 = part('19a-mythic-pets-design.txt'), e19 = part('19b-mythic-pets-expressions.txt'), f19 = part('19c-mythic-fx.txt'), p19 = part('19d-mythic-reveal-poses.txt'), s19 = part('19e-mythic-reveal-scenes.txt');
  assert(d19.length === 7 && e19.length === 25 && f19.length === 3 && p19.length === 2 && s19.length === 5, 'V13.115 그림 주문서 19: 설정 7 · 표정·알 반응 25 · 효과 3 · 등장 포즈 2 · 세로 배경 5');
  assert(MYTHIC.every(key => CHARACTERS[key]?.mythic) && CHARACTERS.cheonma?.legendary && CHARACTERS.riceball?.limited === 'autumn', 'V13.115 신화 5종(구미호 청룡 백호 주작 현무)과 천마는 V13.118에서, 주먹이는 V13.117에서 앱에 등록됐다');
  const rows19 = read(`${dir}slice-map.csv`).split('\n').filter(line => /^"19[a-e]-/.test(line)).map(line => line.match(/"((?:[^"]|"")*)"/g).map(cell => cell.slice(1, -1)));
  const files19 = rows19.map(row => row[6]);
  assert(rows19.length === 153 && new Set(files19).size === rows19.length, 'V13.115 slice-map: 19번 칸이 서로 다른 앱 파일 이름에 이어진다 (25 · 100 · 12 · 8 · 5 시트 칸)');
  assert(PETS19.every(key => {
    const names = files19.filter(file => file.startsWith(`public/assets/pets/${key}-`) && !file.endsWith('-reveal.webp')).map(file => file.slice('public/assets/pets/'.length, -5));
    const want = [0, 1, 2, 3].map(form => `${key}-${form}`);
    for (const form of [1, 2, 3]) for (const expression of ['happy', 'eat', 'sad', 'cheer']) want.push(`${key}-${form}-${expression}`);
    want.push(`${key}-0-happy`, `${key}-0-eat`);
    return names.length === 18 && want.every(name => names.includes(name));
  }), 'V13.115 펫 7종마다 앱이 읽는 그림 18개(알·아기·성장·최종 + 표정 12 + 알 반응 2)가 모두 주문에 있다');
  assert(['gumiho', 'cheongryong', 'baekho', 'jujak', 'hyeonmu', 'cheonma'].every(key => files19.includes(`public/assets/pets/${key}-reveal.webp`)) && ['crack-1', 'crack-2', 'crack-3', 'crack-4', 'rays', 'ring', 'stars', 'aurora'].every(name => files19.includes(`public/assets/fx/mythic-${name}.webp`)) && ['badge', 'frame', 'banner', 'egg', 'aura', 'sparkles'].every(name => files19.includes(`public/assets/ui/mythic-${name}.webp`)) && ['cheer-egg', 'cheer-deco'].every(name => files19.includes(`public/assets/ui/${name}.webp`)) && MYTHIC.every(key => files19.includes(`public/assets/reveal/bg-${key}.webp`)), 'V13.115 등장 연출 그림(등장 포즈 6 · 균열 4 · 빛 4 · 등급 장식과 오라 6 · 응원 아이콘 2 · 세로 배경 5)이 모두 주문에 있다');
  assert(d19.filter(text => text.includes('A 신화 (mythic) pet')).length === 5 && d19.filter(text => text.includes('A 전설 (legendary) pet')).length === 1 && d19.filter(text => text.includes('A limited event pet')).length === 1 && e19.filter(text => !/two pet eggs|event shop icons/.test(text) && text.includes('A 신화 (mythic) pet')).length === 15, 'V13.115 신화 문장은 신화 5종에만(설정 5장 + 표정 15장), 천마는 전설, 주먹이는 이벤트 한정이다');
  assert(d19.every(text => /STYLE REFERENCE/.test(text) && /Google Drive, into the folder "SUMUS 신화 펫 19 \(Runner용\)"/.test(text)) && [...e19, ...f19, ...p19, ...s19].every(text => text.includes('Google Drive, into the folder "SUMUS 신화 펫 19 (Runner용)"')), 'V13.115 모든 19번 시트에 "SUMUS 신화 펫 19 (Runner용)" 폴더로 올리라는 문장이 있다');
  assert(e19.filter(text => !/event shop icons/.test(text) && /^Subject:/m.test(text)).every(text => /CHARACTER REFERENCE — before drawing, open "19a-\d\.png"/.test(text)) && p19.every(text => /open "19a-\d\.png"/.test(text) && text.includes('FINAL stage')), 'V13.115 표정·알 반응·등장 포즈 시트는 같은 펫의 설정 시트(19a-N)를 열어 맞춘다');
  assert(s19.every(text => text.includes('1024×1536') && text.includes('NO characters, NO animals') && text.includes('The TOP 20% stays calm') && text.includes('not transparent')), 'V13.115 등장 배경 5장은 세로 1024×1536, 캐릭터 없음, 위 20% 비움, 투명 아님이다');
  assert(d19.filter(text => /Subject: 주먹이,/.test(text)).every(text => text.includes('ORIGINAL character') && text.includes('not make it look like a bear, a cat or any existing cartoon character')) && d19.some(text => /NINE huge flowing silky white tails/.test(text)) && d19.some(text => /THREE flowing tails/.test(text)) && d19.some(text => /ONE small fluffy tail/.test(text)), 'V13.115 주먹이는 새 캐릭터이고, 구미호는 꼬리가 1개 → 3개 → 9개로 늘어난다');
  const cheer = [...d19, ...e19, ...f19].join('\n');
  assert(!/(sharp teeth|fangs showing|blood|skull)/i.test(cheer.replace(/no (sharp |big )?teeth[^.]*/gi, '').replace(/no fangs[^).]*/gi, '').replace(/never (sly or )?scary[^.]*/gi, '')) && /mouth (closed|closed-mouth)|closed-mouth/.test(cheer), 'V13.115 호랑이·용 등 신화 펫이 무섭지 않다(입 다묾, 날카로운 이빨 없음)');
  const names19 = d19.map(text => text.match(/^Subject: ([^,]+),/m)?.[1]);
  assert(names19.length === 7 && new Set(names19).size === 7 && names19.every(name => name && Object.values(CHARACTERS).filter(c => c.ko === name).length === 1), 'V13.115 새 펫 7종의 임시 이름은 서로 다르고 지금 있는 펫 이름과 겹치지 않는다');
  const codex19 = read(`${dir}CODEX_PROMPT_19.md`);
  assert(PETS19.every(key => codex19.includes(`\`${key}\``)) && codex19.includes('PR까지만 만든다. 머지하지 않는다.') && codex19.includes('운영 Supabase에 연결하지 않는다') && codex19.includes('앱 코드는 고치지 않는다') && codex19.includes('내장 그림 생성 기능') && codex19.includes('DONE_19.md') && codex19.includes('`D`(삭제)와 `M`(수정)이 하나도 없어야 한다') && codex19.includes('실제 만화·게임 캐릭터를 따라 그리지 않는다') && codex19.includes('public/assets/reveal/bg-') && codex19.includes('--union') && codex19.includes('181개') && codex19.includes('-s.webp'), 'V13.115 Codex 지시서(CODEX_PROMPT_19.md): 7종 key, PR까지만, 운영 DB·앱 코드 금지, 내장 그림 기능, 새 파일만, 만화 캐릭터 금지, 균열 정렬, 세로 배경 저장, 181개, 작은 그림');
  assert(readme.includes('`19a-mythic-pets-design.txt`') && readme.includes('`19e-mythic-reveal-scenes.txt`') && readme.includes('CODEX_PROMPT_19.md') && readdirSync(here(`${dir}split`)).filter(name => /^19[a-e]-/.test(name)).length === 42, 'V13.115 주문서 README에 19a~19e가 있고 split/에 19번 시트 42장이 있다');

  /* ---------- 20 펫 전투 자세 (공격 · 맞음) ---------- */
  const POSE_KEYS = ['frog', 'sapsaree', 'deer', 'bear', 'seal', 'wolf', 'crocodile', 'octopus', 'gumiho', 'cheongryong', 'baekho', 'jujak', 'hyeonmu', 'cheonma'];
  const p20 = part('20-pet-battle-poses.txt');
  assert(p20.length === 21 && readdirSync(here(`${dir}split`)).filter(name => /^20-\d+ /.test(name)).length === 21, 'V13.116 그림 주문서 20: 같은 단계의 두 펫씩, 7쌍 × 3단계 = 시트 21장');
  const rows20 = read(`${dir}slice-map.csv`).split('\n').filter(line => /^"20-pet-battle-poses/.test(line)).map(line => line.match(/"((?:[^"]|"")*)"/g).map(cell => cell.slice(1, -1)));
  const files20 = rows20.map(row => row[6]);
  assert(rows20.length === 84 && new Set(files20).size === 84 && POSE_KEYS.every(key => [1, 2, 3].every(form => files20.includes(`public/assets/pets/${key}-${form}-attack.webp`) && files20.includes(`public/assets/pets/${key}-${form}-hurt.webp`))), 'V13.116 slice-map: 펫 14마리 × 3단계 × (attack · hurt) = 84칸이 앱이 읽는 이름(<key>-<단계>-attack / -hurt)에 이어진다');
  assert(p20.every(text => text.includes('Google Drive, into the folder "SUMUS 전투 자세 20 (Runner용)"') && text.includes('real transparent background') && /CHARACTER REFERENCE — before drawing, open "(18a|19a)-\d\.png"/.test(text) && text.includes('ATTACK: ') && text.includes('HURT: flinching') && text.includes('NOT injured: no blood, no tears streaming, no wounds')), 'V13.116 모든 자세 시트에 Drive 폴더 · 설정 시트 참조 · 공격 · 맞음 문장과 "다치지 않은 귀여운 모습" 규칙이 있다');
  assert(p20.filter(text => /Subject: two different pets of the same growth step/.test(text)).length === 21 && p20[0].includes('TOP row: 폴짝') && p20[0].includes('BOTTOM row: 복실') && p20[18].includes('TOP row: 현무') && p20[18].includes('BOTTOM row: 천마') && p20.filter(text => /predators keep the mouth closed/.test(text)).length === 21, 'V13.116 시트 하나는 같은 단계의 두 펫(위 줄 · 아래 줄)이고, 맹수는 입을 다문다');
  const codex20 = read(`${dir}CODEX_PROMPT_20.md`);
  assert(POSE_KEYS.every(key => codex20.includes(`\`${key}\``)) && codex20.includes('PR까지만 만든다. 머지하지 않는다.') && codex20.includes('운영 Supabase에 연결하지 않는다') && codex20.includes('앱 코드는 고치지 않는다') && codex20.includes('내장 그림 생성 기능') && codex20.includes('DONE_20.md') && codex20.includes('`D`(삭제)와 `M`(수정)이 없어야 한다') && codex20.includes('fit-sheets.mjs') && codex20.includes('84개') && codex20.includes('그림 19 PR이 아직 머지되지 않은 것'), 'V13.116 Codex 지시서(CODEX_PROMPT_20.md): 14종 key, PR까지만, 운영 DB·앱 코드 금지, 내장 그림 기능, 새 파일만, 자르기 명령, 84개, 그림 19가 없을 때의 순서');
  assert(readme.includes('`20-pet-battle-poses.txt`') && readme.includes('CODEX_PROMPT_20.md') && readme.includes('`20-1` ~ `20-21`'), 'V13.116 주문서 README에 20번 자세 주문서가 적혀 있다');
  /* ---------- 21 이벤트 펫 · 22 던전 몬스터 · 23 던전 배경·UI·칭호 ---------- */
  const EVENT21 = ['tissue', 'glue'];
  const SIZE22 = { nightzombie: 'M', redpenghost: 'M', wrongmummy: 'M', testspider: 'M', omrreaper: 'L', chalkangler: 'L', nightbat: 'S', blinkjelly: 'M', bagturtle: 'L', cheatninja: 'S', labskeleton: 'M', pianofang: 'L', homeworkogre: 'L', gatehound: 'L', sandwitch: 'M' };
  const MON22 = Object.keys(SIZE22), BOSS = 'killergolem';
  const d21 = part('21a-event-pets-design.txt'), e21 = part('21b-event-pets-expressions.txt'), m22 = part('22a-dungeon-monsters.txt'), b22 = part('22b-dungeon-boss.txt');
  const bg23 = part('23a-dungeon-backgrounds.txt'), ui23 = part('23b-dungeon-ui.txt'), t23 = part('23c-dungeon-titles.txt');
  assert(d21.length === 2 && e21.length === 8 && m22.length === 30 && b22.length === 3 && bg23.length === 8 && ui23.length === 5 && t23.length === 2, '그림 주문서 21~23: 이벤트 펫 설정 2·표정 8 / 던전 몬스터 30·보스 3 / 배경 8·UI 5·칭호 2');
  const cells = line => line.match(/"((?:[^"]|"")*)"/g).map(cell => cell.slice(1, -1));
  const rows2x = read(`${dir}slice-map.csv`).split('\n').filter(line => /^"2[123][abc]?-/.test(line)).map(cells);
  const rowsOf = prefix => rows2x.filter(row => row[0].startsWith(prefix)).map(row => row[6]);
  const oldFiles = new Set(read(`${dir}slice-map.csv`).split('\n').slice(1).filter(line => line && !/^"2[123][abc]?-/.test(line)).map(line => cells(line)[6])), newFiles = rows2x.map(row => row[6]);
  assert(rows2x.length === 40 + 132 + 8 + 20 + 8 && new Set(newFiles).size === newFiles.length && newFiles.every(file => !oldFiles.has(file)), '그림 주문서 21~23 slice-map: 새 칸 208개(펫 40 · 몬스터 132 · 배경 8 · UI 20 · 칭호 8)가 서로, 그리고 기존 주문서와 겹치지 않는 앱 파일 이름에 이어진다');
  const files21 = [...rowsOf('21a'), ...rowsOf('21b')];
  assert(EVENT21.every(key => CHARACTERS[key]?.limited === 'autumn') && ['술술이', '찰싹이'].every(name => Object.values(CHARACTERS).filter(c => c.ko === name).length === 1), '그림 주문서 21: 술술이(tissue) · 찰싹이(glue)는 V13.117에서 가을 이벤트 한정 펫으로 등록됐고 이름이 겹치지 않는다');
  assert(EVENT21.every(key => {
    const names = files21.filter(file => file.startsWith(`public/assets/pets/${key}-`)).map(file => file.slice('public/assets/pets/'.length, -5));
    const want = [0, 1, 2, 3].map(form => `${key}-${form}`);
    for (const form of [1, 2, 3]) for (const expression of ['happy', 'eat', 'sad', 'cheer']) want.push(`${key}-${form}-${expression}`);
    want.push(`${key}-0-happy`, `${key}-0-eat`);
    return names.length === 18 && want.every(name => names.includes(name));
  }) && ['event-egg', 'event-badge', 'event-deco-cheer', 'event-deco-autumn'].every(name => files21.includes(`public/assets/ui/${name}.webp`)), '그림 주문서 21: 이벤트 펫마다 앱이 읽는 그림 18개(알·아기·성장·최종 + 표정 12 + 알 반응 2)와 알 상점 아이콘 4개가 모두 주문에 있다');
  assert(d21.every(text => text.includes('A limited event pet') && text.includes('NOT an animal') && text.includes('ORIGINAL character') && text.includes('no striped cheek marks') && /STYLE REFERENCE/.test(text) && text.includes('SUMUS 이벤트 펫 21 (Runner용)')) && e21.every(text => text.includes('SUMUS 이벤트 펫 21 (Runner용)')) && e21.filter(text => !/Items for the autumn event shop/.test(text)).every(text => /CHARACTER REFERENCE — before drawing, open "21a-\d\.png"/.test(text)), '그림 주문서 21: 설정 시트는 동물이 아닌 새 캐릭터(줄무늬 볼 금지)이고 Drive 업로드·참고 줄이 있으며, 표정 시트는 그 펫의 21a 설정 시트를 열어 맞춘다');
  const files22 = [...rowsOf('22a'), ...rowsOf('22b')];
  const existingMonsters = new Set(MONSTERS.map(monster => monster.key));
  assert(MON22.length === 15 && [...MON22, BOSS].every(key => !existingMonsters.has(key)) && MON22.every(key => {
    const names = files22.filter(file => new RegExp(`^public/assets/monsters/${key}(-[a-z0-9]+)?\\.webp$`).test(file)).map(file => file.slice('public/assets/monsters/'.length, -5));
    const want = [key, `${key}-idle2`, `${key}-windup`, `${key}-attack`, `${key}-attack2`, `${key}-skill`, `${key}-hurt`, `${key}-down`];
    return names.length === 8 && want.every(name => names.includes(name));
  }), '그림 주문서 22: 던전 일반 몬스터 15종은 기존 몬스터 18종과 key가 다르고, 몬스터마다 8포즈(기본·기본2·준비·공격·공격2·스킬·맞음·쓰러짐)가 모두 주문에 있다');
  assert((() => {
    const names = files22.filter(file => new RegExp(`^public/assets/monsters/${BOSS}(-[a-z0-9]+)?\\.webp$`).test(file)).map(file => file.slice('public/assets/monsters/'.length, -5));
    return names.length === 12 && [BOSS, ...['idle2', 'windup', 'attack', 'attack2', 'skill', 'hurt', 'down', 'rage', 'core', 'roar', 'corehurt'].map(pose => `${BOSS}-${pose}`)].every(name => names.includes(name));
  })(), '그림 주문서 22: 보스 킬러 골렘(killergolem)은 12포즈(8포즈 + 분노 · 핵 노출 · 포효 · 핵 맞음)가 모두 주문에 있다');
  assert(m22.every(text => text.includes('SUMUS 던전 몬스터 22 (Runner용)') && text.includes('facing the viewer\'s LEFT') && text.includes('final-exam hell') && /STYLE REFERENCE/.test(text) && text.includes('never gory')) && b22.every(text => text.includes('SUMUS 던전 몬스터 22 (Runner용)') && text.includes('never gory')) && m22.filter((text, i) => i % 2 === 1).every((text, n) => text.includes(`Also open "22a-${2 * n + 1}.png"`)) && b22[1].includes('"22b-1.png"') && b22[2].includes('"22b-1.png" and "22b-2.png"'), '그림 주문서 22: 몬스터는 왼쪽을 보고 으스스하지만 피 없이 귀엽고, Drive 업로드·참고 줄이 있으며, 둘째·셋째 시트는 앞 시트를 열어 같은 디자인·크기로 맞춘다');
  const horror = [...m22, ...b22, ...bg23].join('\n').replace(/never gory/gi, '').replace(/no gore/gi, '').replace(/no skull/gi, '').replace(/no exposed bones/gi, '').replace(/no sharp teeth/gi, '').replace(/no sharp fangs/gi, '').replace(/no fangs/gi, '').replace(/never realistic or creepy/gi, '');
  assert(!/(sharp teeth|fangs showing|blood|gore\b|skull)/i.test(horror), '그림 주문서 22~23: 피 · 이빨 · 해골 표현이 없다(귀엽고 으스스한 수준)');
  const codex21 = read(`${dir}CODEX_PROMPT_21.md`), codex22 = read(`${dir}CODEX_PROMPT_22.md`);
  assert(EVENT21.every(key => codex21.includes(`\`${key}\``)) && codex21.includes('PR까지만 만든다. 머지하지 않는다.') && codex21.includes('운영 Supabase에 연결하지 않는다') && codex21.includes('앱 코드는 고치지 않는다') && codex21.includes('따라 그리지 않는다') && codex21.includes('**48개**') && codex21.includes('-s.webp'), '그림 주문서 21 Codex 지시서(CODEX_PROMPT_21.md): 2종 key, PR까지만, 운영 DB·앱 코드 금지, 새 캐릭터, 48개, 작은 그림');
  assert([...MON22, BOSS].every(key => new RegExp(`\`${key}\` \\| [^|]+ \\| ${SIZE22[key] || '보스'} \\|`).test(codex22)) && codex22.includes('PR까지만 만든다. 머지하지 않는다.') && codex22.includes('운영 Supabase에 연결하지 않는다') && codex22.includes('앱 코드는 고치지 않는다') && codex22.includes('--scale-max') && codex22.includes('**176개**') && codex22.includes('기존 몬스터 18종') && codex22.includes('따라 그리지 않는다'), '그림 주문서 22·23 Codex 지시서(CODEX_PROMPT_22.md): 몬스터 16종 key·크기 표, PR까지만, 운영 DB·앱 코드 금지, 두 시트 배율 맞추기, 176개, 기존 몬스터 보호');
  assert(bg23.every(text => text.includes('1536×1024') && text.includes('NO characters, NO animals') && text.includes('ONE LARGE monster') && text.includes('SUMUS 던전 배경·UI 23 (Runner용)')) && rowsOf('23a').join() === ['gate', 'f1', 'f2', 'f3', 'f4', 'f5', 'boss', 'endless'].map(name => `public/assets/dungeon/bg-${name}.webp`).join(), '그림 주문서 23: 던전 배경 8장은 가로 1536×1024, 캐릭터 없음, 큰 몬스터·파티 자리를 비워 두고 dungeon/bg-*.webp에 이어진다');
  assert(rowsOf('23b').length === 20 && rowsOf('23b').every(file => /^public\/assets\/ui\/dungeon-[a-z0-9-]+\.webp$/.test(file)) && rowsOf('23c').length === 8 && rowsOf('23c').every(file => /^public\/assets\/titles\/dungeon-[a-z0-9]+\.webp$/.test(file)) && ui23.every(text => text.includes('no letters') && text.includes('SUMUS 던전 배경·UI 23 (Runner용)')) && t23.every(text => text.includes('no letters and no numbers')), '그림 주문서 23: 던전 UI 아이콘 20개(ui/dungeon-*)와 칭호 메달 8개(titles/dungeon-*)가 글자 없이 주문에 있다');
  assert(readme.includes('`21a-event-pets-design.txt`') && readme.includes('`22a-dungeon-monsters.txt`') && readme.includes('`23c-dungeon-titles.txt`') && readme.includes('CODEX_PROMPT_21.md') && readme.includes('CODEX_PROMPT_22.md') && readme.includes(`| \`00-all-in-order.txt\` | ${allCount} | ${allCount * 4} |`) && readdirSync(here(`${dir}split`)).filter(name => /^2[123][a-c]?-/.test(name)).length === 58, '그림 주문서 21~23: README에 새 주문서와 Codex 지시서가 있고 합본 개수가 맞으며 split/에 21~23번 시트 58장이 있다');
  const fit = read(`${dir}fit-assets.mjs`), designDoc = read('../docs/dungeon-design.md');
  assert(fit.includes('--scale-max') && fit.includes('console.log(`scale ') && ['킬러 골렘', '불새', '2026-11-30', '120단어', '3등급 컷', '봇이 낀 파티는 기록 제외', 'dungeon-engine', 'DungeonRoom'].every(word => designDoc.includes(word)), '그림 주문서 21~23: 자르기 도구에 두 시트 배율 맞추기(--scale-max)가 있고 던전 설계 문서(docs/dungeon-design.md)에 확정 사항이 있다');
}
