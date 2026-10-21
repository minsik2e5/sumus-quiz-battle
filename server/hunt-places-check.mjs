// V13.166 검사: 몬스터 사냥 장소 몬스터 34종 → 70종(선생님 확정). 새 36종은 숲 · 들판 · 바닷가 · 밤 전용(장소마다 ★1 3 · ★2 2 · ★3 2 · ★4 1 · ★5 1),
// 기존 34종은 어디서나. 등급 확률 · 잡힘 · 도망 · 별조각 · 경험치는 그대로(경제 영향 없음). 그림이 다 들어온 몬스터만 지도에 나온다(monster-art.js).
// 도감 70칸 + 장소 탭 · 힌트, 그림 주문서 35(36시트, Drive 그림체 맞추기 · 정해진 폴더와 파일 이름).
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { CHARACTERS } from '../public/modules/core.js';
import { seeded } from '../public/modules/fishing-rules.js';
import { HUNT, HUNT_MONSTERS, MONSTER_KEYS, MONSTER_TIERS, HUNT_PLACES, monstersOf, monsterReady, fitsPlace, spawnPool, placeHint, huntSimAverage, dayValue } from '../public/modules/hunt-rules.js';
import { MONSTER_ART } from '../public/modules/monster-art.js';
import { huntMap, huntPlace } from './hunt.mjs';
import { sheets35, FILES_35, DRIVE_35, LOOKS_35 } from '../docs/asset-requests/runner/build-35.mjs';

const source = path => readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8');
const H = 3600000;
// 한국 시간 h시의 시각(2026-10-22 기준).
const kst = h => Date.parse('2026-10-22T00:00:00+09:00') + h * H;

export async function runHuntPlacesChecks(assert) {
  const places = Object.keys(HUNT_PLACES), fresh = MONSTER_KEYS.filter(k => HUNT_MONSTERS[k].place);
  const count = list => Object.fromEntries(MONSTER_TIERS.map(t => [t, list.filter(k => HUNT_MONSTERS[k].tier === t).length]));

  /* ---------- 몬스터 수 · 장소 ---------- */
  assert(MONSTER_KEYS.length === 70 && fresh.length === 36 && places.join() === 'forest,field,beach,night'
    && JSON.stringify(count(MONSTER_KEYS)) === JSON.stringify({ common: 20, uncommon: 16, rare: 15, epic: 11, legend: 8 }),
    `V13.166 사냥 몬스터 70종(★1 20 · ★2 16 · ★3 15 · ★4 11 · ★5 8): 기존 34 + 장소 전용 36`);
  assert(places.every(at => JSON.stringify(count(fresh.filter(k => HUNT_MONSTERS[k].place === at))) === JSON.stringify({ common: 3, uncommon: 2, rare: 2, epic: 1, legend: 1 })),
    'V13.166 숲 · 들판 · 바닷가 · 밤마다 9종(★1 3 · ★2 2 · ★3 2 · ★4 1 · ★5 1)');
  const petNames = new Set(Object.values(CHARACTERS).map(c => c.ko));
  assert(new Set(MONSTER_KEYS.map(k => HUNT_MONSTERS[k].ko)).size === 70 && MONSTER_KEYS.every(k => /^[a-z0-9]{3,20}$/.test(k) && !petNames.has(HUNT_MONSTERS[k].ko))
    && fresh.every(k => !['소라게', '돌고래', '해마'].some(w => HUNT_MONSTERS[k].ko.includes(w))),
    'V13.166 몬스터 이름은 겹치지 않고 펫 이름과도 다르다(바다 펫 소라게 · 돌고래 · 해마와 헷갈리지 않게: 물음표 소라 → 물음표 고둥, 마침표 문어 → 마침표 먹물문어), 키는 영어 20자 이하(가방 팔기 키 길이)');
  assert(HUNT.SPAWN.common === 42 && HUNT.SPAWN.uncommon === 28 && HUNT.SPAWN.rare === 17 && HUNT.SPAWN.epic === 9 && HUNT.SPAWN.legend === 4 && HUNT.STARS.legend === 560 && HUNT.CATCH.common === 40 && HUNT.XP.legend === 14,
    'V13.166 등급 출현 확률 · 잡힘 · 별조각 · 경험치는 그대로(몬스터 수만 늘어서 경제 영향 없음)');
  const hard = huntSimAverage({ daily: 3, goodRolls: 2 }, 1000), easy = huntSimAverage({ daily: 1 }, 1000);
  assert(dayValue(hard) >= 75 && dayValue(hard) <= 105 && dayValue(easy) >= 24 && dayValue(easy) <= 40, `V13.166 시뮬레이션 그대로 통과: 하루 가치 열심 ${dayValue(hard)} · 보통 ${dayValue(easy)}코인어치`);

  /* ---------- 장소 · 시간 ---------- */
  const all = () => true;
  assert(fitsPlace('wordsquirrel', { area: 'forest', night: false }) && !fitsPlace('wordsquirrel', { area: 'beach', night: false }) && fitsPlace('wordsquirrel', { area: 'forest', night: true })
    && fitsPlace('snackcoon', { area: 'beach', night: true }) && !fitsPlace('snackcoon', { area: 'forest', night: false }) && fitsPlace('slime', { area: 'beach', night: false }),
    'V13.166 숲 · 들판 · 바닷가 몬스터는 그 지도(낮 · 밤)에서만, 밤 몬스터는 어느 지도든 밤에만, 기존 몬스터는 어디서나');
  const pool = spawnPool('legend', { area: 'field', night: true }, all);
  assert(pool.includes('stormbird') && pool.includes('reportdragon') && pool.includes('mockhydra') && !pool.includes('lexitreant') && !pool.includes('leviathan')
    && MONSTER_TIERS.every(t => places.every(area => spawnPool(t, { area, night: false }).length > 0 && spawnPool(t, { area, night: true }).length > 0)),
    'V13.166 그 등급 몬스터 중 장소가 맞는 것만 나오고, 어느 장소 · 등급이든 나올 몬스터가 있다(기존 34종)');
  assert(placeHint('lexitreant') === '숲에서 나와요' && placeHint('commacrab') === '바닷가에서 나와요' && placeHint('reportdragon').startsWith('밤(저녁 7시 ~ 아침 6시)') && placeHint('slime') === '어디서나 나와요',
    'V13.166 도감 힌트: "○○에서 나와요"');
  assert(huntPlace(kst(19)).night && huntPlace(kst(5.9)).night && !huntPlace(kst(6)).night && !huntPlace(kst(18.9)).night, 'V13.166 밤은 저녁 7시 ~ 아침 6시(한국 시간)');

  /* ---------- 그림이 있는 몬스터만 ---------- */
  const dir = fileURLToPath(new URL('../public/assets/monsters/', import.meta.url)), files = new Set(readdirSync(dir));
  const onDisk = [...files].map(f => f.match(/^([a-z0-9]+)\.webp$/)?.[1]).filter(k => k && files.has(`${k}-attack.webp`) && files.has(`${k}-hurt.webp`)).sort();
  assert(JSON.stringify([...MONSTER_ART]) === JSON.stringify(onDisk),
    'V13.166 public/modules/monster-art.js가 그림 폴더와 같다(그림을 넣었으면 npm run build:assets를 다시 돌린다)');
  assert(fresh.every(k => monsterReady(k) === ['', '-attack', '-hurt'].every(s => existsSync(`${dir}${k}${s}.webp`))) && MONSTER_KEYS.filter(k => !HUNT_MONSTERS[k].place).every(monsterReady),
    `V13.166 장소 몬스터는 기본 · 공격 · 맞음 그림이 다 있어야 나온다(지금 ${fresh.filter(monsterReady).length} / 36종 준비)`);
  {
    // 슬롯 · 시간마다 지도를 많이 뽑아 본다: 그림 없는 몬스터 · 장소가 다른 몬스터는 나오지 않는다.
    const rand = seeded(166), seen = new Set();
    let wrong = 0;
    for (let i = 0; i < 240; i++) {
      const now = kst(i * 1.7), p = { pets: [{ key: 'dog' }] }, where = huntPlace(now);
      for (const s of huntMap(p, now, rand).spots) { seen.add(s.key); if (!monsterReady(s.key) || !fitsPlace(s.key, where)) wrong++; }
    }
    assert(!wrong && [...seen].every(k => HUNT_MONSTERS[k]) && seen.size > 20, `V13.166 지도에는 그림이 있고 장소 · 시간이 맞는 몬스터만 나온다(${seen.size}종 봄)`);
    // 그림이 들어오면(build:assets가 monster-art.js에 넣으면) 자동으로 나온다: 검사 안에서만 잠깐 넣어 본다.
    const added = fresh.filter(k => !MONSTER_ART.has(k));
    for (const k of added) MONSTER_ART.add(k);
    const met = new Set();
    let off = 0;
    for (let i = 0; i < 600; i++) {
      const now = kst(i * 1.3), where = huntPlace(now);
      for (const s of huntMap({ pets: [{ key: 'dog' }] }, now, rand).spots) { met.add(s.key); if (!fitsPlace(s.key, where)) off++; }
    }
    const metFresh = fresh.filter(k => met.has(k)), byPlace = at => metFresh.filter(k => HUNT_MONSTERS[k].place === at).length;
    assert(!off && places.every(at => byPlace(at) >= 5), `V13.166 그림이 들어오면 장소 몬스터가 자동으로 나오고, 그 장소 · 시간에서만 나온다(숲 ${byPlace('forest')} · 들판 ${byPlace('field')} · 바닷가 ${byPlace('beach')} · 밤 ${byPlace('night')}종 봄)`);
    // 아침 6시가 되면 지도에 남은 밤 몬스터는 떠난다(만나는 중이면 그대로).
    const p = { pets: [{ key: 'dog' }], hunt: {} };
    huntMap(p, kst(5), rand);
    p.hunt.map.spots.push({ id: 'n1', kind: 'monster', key: 'snackcoon', tier: 'common', x: 50, y: 50, cell: 8 }, { id: 'n2', kind: 'monster', key: 'batking', tier: 'rare', x: 40, y: 40, cell: 7 });
    p.hunt.live = { spot: 'n2', kind: 'monster', key: 'batking', tier: 'rare', at: kst(5), throws: 0 };
    const morning = huntMap(p, kst(6.5), rand);
    assert(!morning.spots.some(s => s.id === 'n1') && morning.spots.some(s => s.id === 'n2') && p.hunt.live?.spot === 'n2', 'V13.166 아침 6시가 되면 밤 몬스터는 떠나고, 만나는 중인 몬스터는 그대로');
    for (const k of added) MONSTER_ART.delete(k);
  }

  /* ---------- 도감 화면 ---------- */
  {
    const hunt = source('../public/modules/hunt.js'), css = source('../public/v13166.css'), build = source('./build-assets.mjs');
    assert(hunt.includes("const BOOK_TABS = ['all', ...Object.keys(HUNT_PLACES)]") && hunt.includes("if (act === 'book-tab') return monsterBook(b.dataset.tab)") && hunt.includes("t === 'all' ? '전체'")
      && hunt.includes('placeHint(k)') && hunt.includes("'곧 나와요'") && hunt.includes('class="shadow"') && hunt.includes('v.all || MONSTER_KEYS.length'),
      'V13.166 도감 70칸 + 장소 탭(전체 · 숲 · 들판 · 바닷가 · 밤), 못 잡은 몬스터는 그림자 + "○○에서 나와요"(그림이 아직 없으면 ? + 곧 나와요)');
    assert(build.includes('"v13166.css"') && css.includes('.hn-book-tab.on') && css.includes('.hn-book-hint') && build.includes("public/modules/monster-art.js"), 'V13.166 도감 탭 스타일, build:assets가 monster-art.js를 만든다');
  }

  /* ---------- 그림 주문서 35 ---------- */
  {
    const R = '../docs/asset-requests/runner/';
    const list = sheets35(), map = source(R + 'slice-map.csv'), codex = source(R + 'CODEX_PROMPT_35.md'), readme = source(R + 'README.md');
    const orders = Object.values(FILES_35).flatMap(f => source(R + f).trim().split('\n---\n'));
    const split = readdirSync(fileURLToPath(new URL(R + 'split/', import.meta.url))).filter(f => /^35[a-d]-\d+ /.test(f));
    assert(list.length === 36 && orders.length === 36 && split.length === 36 && fresh.every(k => LOOKS_35[k]) && list.every(s => orders.includes(s.text)),
      'V13.166 그림 주문서 35: 장소마다 한 파일(35a 숲 · 35b 들판 · 35c 바닷가 · 35d 밤), 몬스터마다 한 시트(36시트), split/ 시트별 파일(build-35.mjs로 만든 그대로)');
    assert(orders.every(t => t.includes('STYLE REFERENCE — before drawing, open the existing monster pictures of this game in Google Drive') && t.includes('"SUMUS 몬스터 10 (Runner용)"')
      && /named exactly "35[a-d]-\d\.png"/.test(t) && t.includes(`into the folder "${DRIVE_35}"`) && t.includes('showing the picture in the chat is not enough')),
      'V13.166 주문서마다 Drive의 기존 몬스터 그림을 열어 그림체를 맞추고, 정해진 Drive 폴더("SUMUS 몬스터 35 (Runner용)")에 정확한 파일 이름으로 저장');
    assert(fresh.every(k => ['', '-attack', '-hurt'].every(s => map.includes(`"public/assets/monsters/${k}${s}.webp"`))) && (map.match(/^"35[a-d]-/gm) || []).length === 144,
      'V13.166 자르기 표: 36종 × 기본 · 공격 · 맞음(108장, 기존 몬스터 그림 규격 {key}.webp · -attack · -hurt) + 쓰러짐 여분');
    assert(codex.includes('Drive의 기존 몬스터 그림을 열어 그림체를 맞춘다') && codex.includes('정해진 Drive 폴더 "SUMUS 몬스터 35 (Runner용)"에 정확한 파일 이름') && codex.includes('--stand-same')
      && codex.includes('monster-art.js') && codex.includes('머지하지 않는다') && readme.includes('35a-hunt-forest-monsters.txt') && readme.includes('CODEX_PROMPT_35.md'),
      'V13.166 CODEX_PROMPT_35: 그림체 맞추기 · 정해진 폴더와 파일 이름 · 기존 규격(512 webp, --stand-same) · 넣으면 자동으로 나옴 · 머지 금지');
    assert(monstersOf('legend').length === 8, 'V13.166 ★5 보스 8종');
  }
}
