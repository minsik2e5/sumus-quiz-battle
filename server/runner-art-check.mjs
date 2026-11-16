// 그림 주문서 74(펫 대행진) 형식 검사 + 그림 게이트(RUNNER_ART).
//   - 시트 14장 · 그림 44장, 칸 이름은 구성안(docs/pet-runner-plan.md 10장) 그대로.
//   - 시트마다 CLAUDE.md 규칙 두 가지: Drive의 기존 그림(실제 폴더 · 파일 이름)을 열어 그림체 맞추기 · 정해진 Drive 폴더에 정확한 이름으로 저장.
//   - 다른 게임 그림을 따라 하지 말라는 문장 · 글자 없음 · 배경 처리(투명 · 흰색 · 검정)가 칸 처리 방법과 맞는다.
//   - split 파일 이름에 ':'가 없다(윈도 · Drive에서 깨짐). slice-map.csv에 44줄, 넣는 곳은 public/assets/runner/<이름>.webp.
//   - Codex 지시문: Drive 없이 저장소 그림을 참고 그림으로 · 내장 그림 생성만(유료 API 키 없음) · PR까지만.
//   - build-assets가 public/assets/runner 그림을 RUNNER_ART에 적는다(그림이 없으면 빈 목록 → 게임은 코드 그림).
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const path = p => fileURLToPath(new URL(p, import.meta.url));
const source = p => readFileSync(path(p), 'utf8');
const DIR = '../docs/asset-requests/runner/';

export async function runRunnerArtChecks(assert) {
  if (!existsSync(path(`${DIR}build-74.mjs`))) return;
  const { SHEETS, ITEMS, DRIVE, LIST, promptOf, splitName, isBg } = await import(`${DIR}build-74.mjs`);
  const plan = existsSync(path('../docs/pet-runner-plan.md')) ? source('../docs/pet-runner-plan.md') : '';
  const planKeys = [...(plan.split('## 10.')[1] || '').split('## 11.')[0].matchAll(/^\| 74-\d+[^|]*\|([^|]+)\|/gm)].flatMap(m => [...m[1].matchAll(/`([a-z][a-z0-9-]*)`/g)].map(x => x[1]));
  const keys = ITEMS.map(x => x.key);
  assert(SHEETS.length === 14 && ITEMS.length === 44 && new Set(keys).size === 44 && SHEETS.every((s, i) => s.no === `74-${i + 1}`),
    '그림 74: 시트 14장(74-1 ~ 74-14) · 그림 44장, 이름이 겹치지 않는다');
  assert(!plan || (planKeys.length === 44 && planKeys.every(k => keys.includes(k))), `그림 74: 칸 이름이 구성안 10장 표와 같다(구성안 ${planKeys.length}개)`);
  assert(SHEETS.every(s => isBg(s) ? s.cells.length === 1 && /bg-/.test(s.cells[0][1]) : s.cells.length === 4) && SHEETS.filter(isBg).map(s => s.no).join() === '74-6,74-8,74-10,74-12',
    '그림 74: 배경 4장(74-6 · 8 · 10 · 12)은 세로 한 장, 나머지는 2×2');
  const split = readdirSync(path(`${DIR}split/`)).filter(f => /^74-\d+ /.test(f));
  assert(split.length === 14 && split.every(f => !f.includes(':')) && SHEETS.every(s => split.includes(splitName(s)) && source(`${DIR}split/${splitName(s)}`).trim() === promptOf(s).trim()),
    '그림 74: split 파일 14개가 build-74.mjs와 같고 파일 이름에 \':\'가 없다');
  const DRIVE_REFS = ['"SUMUS 전설 펫 07 (Runner용)"', '"07a-1.png"', '"SUMUS 펫 아레나 65 (Runner용)"'];
  for (const s of SHEETS) {
    const t = promptOf(s), kinds = new Set(s.cells.map(c => c[3]));
    assert(t.includes('STYLE REFERENCE') && t.includes('open the existing pictures already in Google Drive') && DRIVE_REFS.some(r => t.includes(r)) && /"\d{2}[a-z]?-\d+\.png"/.test(t),
      `그림 74 ${s.no}: Drive의 기존 그림(실제 폴더 · 파일 이름)을 열어 그림체를 맞추라는 문장`);
    assert(t.includes(`into the folder "${DRIVE}", named exactly "${s.no}.png"`) && DRIVE === 'SUMUS 펫 대행진 74 (Runner용)',
      `그림 74 ${s.no}: Drive 폴더 "${DRIVE}"에 정확한 이름 "${s.no}.png"로 저장하라는 문장`);
    assert(/Last War/.test(t) && /Count Masters/.test(t) && /Mob Control/.test(t) && /do NOT copy or resemble/.test(t) && /cute/.test(t) && /3D/.test(t) && /No text, no letters, no numbers/.test(t),
      `그림 74 ${s.no}: 다른 게임 그림을 따라 하지 않기 · 귀여운 3D 모바일 게임 그림 · 글자 없음`);
    const bgOk = isBg(s) ? /1536 pixels tall/.test(t) && /opaque/.test(t) && /do NOT draw any road/.test(t)
      : kinds.has('add') ? /PURE BLACK \(#000000\)/.test(t) && !/TRANSPARENT background/.test(t)
      : /TRANSPARENT background/.test(t) && /PURE WHITE \(#FFFFFF\)/.test(t) && /never a checkerboard/.test(t);
    assert(bgOk, `그림 74 ${s.no}: 배경 처리 문장이 칸 처리 방법과 맞다(빛 칸이 있으면 검정 · 아니면 투명 또는 흰색 · 배경은 한 장)`);
    assert(isBg(s) || /behind and above/.test(t) || s.no === '74-14', `그림 74 ${s.no}: 시험 페이지와 같은 시점(무리 뒤에서 비스듬히 내려다봄)`);
  }
  const map = source(`${DIR}slice-map.csv`).split('\n').filter(l => l.startsWith(`"${LIST}"`));
  assert(existsSync(path(`${DIR}${LIST}`)) && map.length === 44 && ITEMS.every(x => map.some(l => l.includes(`"runner-${x.key}"`) && l.endsWith(`"public/assets/runner/${x.key}.webp"`))),
    '그림 74: 74-pet-runner.txt가 있고 slice-map.csv에 44줄(넣는 곳 public/assets/runner/<이름>.webp)');
  const slice = source(`${DIR}slice-74.mjs`);
  assert(slice.includes("from './build-74.mjs'") && /'alpha'/.test(slice) && /'white'/.test(slice) && /'black'/.test(slice) && slice.includes('hollow') && slice.includes("kind === 'tile'") && slice.includes('public/assets/runner/'),
    '그림 74: slice-74.mjs가 build-74.mjs 칸 표를 쓰고 투명 · 흰색 · 검정 배경과 길 타일 · 수정 구멍을 처리한다');
  const codex = source(`${DIR}CODEX_PROMPT_74.md`), readme = source(`${DIR}README.md`);
  assert(codex.includes('REFERENCE IMAGES ARE ATTACHED') && codex.includes('Google Drive는 쓰지 않는다') && codex.includes('내장된 그림 생성') && codex.includes('OPENAI_API_KEY') && codex.includes('PR까지만')
    && codex.includes('pets/dragon-3.webp') && codex.includes('runner-fx-run.jpg') && codex.includes(DRIVE) && /Last War/.test(codex) && codex.includes('slice-74.mjs'),
    '그림 74: Codex 지시문 — Drive 없이 저장소 그림을 참고 그림으로, 내장 그림 생성만(유료 API 키 없음), PR까지만');
  assert(readme.includes('펫 대행진(74)') && readme.includes(DRIVE) && readme.includes('CODEX_PROMPT_74.md'), '그림 74: README 목록에 있다');
  // 그림 75(②단계 박진감 업): 6시트 · 24장, 74와 같은 규칙(Drive 그림체 · 정확한 이름 저장 · 다른 게임 따라 하지 않기 · 배경 처리).
  let keys75 = [];
  if (existsSync(path(`${DIR}build-75.mjs`))) {
    const m = await import(`${DIR}build-75.mjs`);
    keys75 = m.ITEMS.map(x => x.key);
    assert(m.SHEETS.length === 6 && m.ITEMS.length === 24 && new Set([...keys, ...keys75]).size === 68 && m.SHEETS.every((s, i) => s.no === `75-${i + 1}`)
      && ['enemy-run', 'enemy-boss', 'wall-sky', 'wall-volcano', 'wall-chunk-ice', 'bridge-narrow', 'cliff-edge', 'tower-cannon', 'shield-guard', 'castle-flag', 'fever-plate', 'clash-burst'].every(k => keys75.includes(k)),
      '그림 75: 시트 6장(75-1 ~ 75-6) · 그림 24장(적 정령 · 숫자 벽 4테마 · 조각 · 좁은 다리 · 낭떠러지 · 성 수비 · 피버), 74와 이름이 겹치지 않는다');
    const split75 = readdirSync(path(`${DIR}split/`)).filter(f => /^75-\d+ /.test(f));
    assert(split75.length === 6 && split75.every(f => !f.includes(':')) && m.SHEETS.every(s => split75.includes(m.splitName(s)) && source(`${DIR}split/${m.splitName(s)}`).trim() === m.promptOf(s).trim()),
      '그림 75: split 파일 6개가 build-75.mjs와 같고 파일 이름에 \':\'가 없다');
    for (const s of m.SHEETS) {
      const t = m.promptOf(s), kinds = new Set(s.cells.map(c => c[3]));
      assert(t.includes('open the existing pictures already in Google Drive') && t.includes('"SUMUS 펫 대행진 74 (Runner용)"') && /"74-\d+\.png"/.test(t),
        `그림 75 ${s.no}: Drive의 기존 그림(74 시트 · 펫 그림)을 열어 그림체를 맞추라는 문장`);
      assert(t.includes(`into the folder "${m.DRIVE}", named exactly "${s.no}.png"`) && m.DRIVE === 'SUMUS 펫 대행진 75 (Runner용)',
        `그림 75 ${s.no}: Drive 폴더 "${m.DRIVE}"에 정확한 이름 "${s.no}.png"로 저장하라는 문장`);
      assert(/Last War/.test(t) && /Count Masters/.test(t) && /Do NOT copy or resemble/.test(t) && /No text, no letters, no numbers/.test(t),
        `그림 75 ${s.no}: 다른 게임 그림을 따라 하지 않기 · 글자 없음`);
      assert(kinds.has('add') ? /PURE BLACK \(#000000\)/.test(t) && !/TRANSPARENT background/.test(t) : /TRANSPARENT background/.test(t) && /PURE WHITE \(#FFFFFF\)/.test(t),
        `그림 75 ${s.no}: 배경 처리 문장이 칸 처리 방법과 맞다`);
    }
    const map75 = source(`${DIR}slice-map.csv`).split('\n').filter(l => l.startsWith(`"${m.LIST}"`));
    assert(existsSync(path(`${DIR}${m.LIST}`)) && map75.length === 24 && m.ITEMS.every(x => map75.some(l => l.includes(`"runner-${x.key}"`) && l.endsWith(`"public/assets/runner/${x.key}.webp"`))),
      '그림 75: 75-pet-runner-2.txt가 있고 slice-map.csv에 24줄');
    assert(slice.includes("from './build-75.mjs'") && slice.includes('7[45]-'), '그림 75: slice-74.mjs가 75-N 시트도 자른다');
    const codex75 = source(`${DIR}CODEX_PROMPT_75.md`);
    assert(codex75.includes('REFERENCE IMAGES ARE ATTACHED') && codex75.includes('Google Drive는 쓰지 않는다') && codex75.includes('내장된 그림 생성') && codex75.includes('OPENAI_API_KEY') && codex75.includes('PR까지만')
      && codex75.includes('claude/pet-runner-1') && codex75.includes('sumus-voca-prod-deploy') && codex75.includes('상관없는 기존 검사가 실패하면') && codex75.includes('DONE_75.md') && codex75.includes(m.DRIVE) && /Last War/.test(codex75),
      '그림 75: Codex 지시문 — Drive 없이 저장소 그림 참고 · 내장 그림 생성만 · PR까지만 · 작업 브랜치(머지됐으면 prod-deploy) · 상관없는 검사 실패는 적고 계속');
    assert(readme.includes('펫 대행진 ②단계(75)') && readme.includes(m.DRIVE) && readme.includes('CODEX_PROMPT_75.md'), '그림 75: README 목록에 있다');
  }
  // 그림 게이트: build-assets가 public/assets/runner를 훑어 RUNNER_ART를 만든다.
  const build = source('build-assets.mjs'), artFile = path('../public/modules/runner-art.js');
  const dir = path('../public/assets/runner'), have = existsSync(dir) ? readdirSync(dir).filter(f => f.endsWith('.webp')).map(f => f.slice(0, -5)).sort() : [];
  assert(build.includes("'public/assets/runner'") && build.includes('export const RUNNER_ART = new Set(') && existsSync(artFile)
    && (readFileSync(artFile, 'utf8').match(/RUNNER_ART = new Set\((\[.*\])\)/) || [])[1] === JSON.stringify(have) && have.every(k => keys.includes(k) || keys75.includes(k)),
    `그림 74: build-assets가 runner 그림 ${have.length}장을 RUNNER_ART에 적고, 주문서에 없는 이름은 없다`);
}
