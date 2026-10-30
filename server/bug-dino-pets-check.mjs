// V13.195 검사: 곤충 · 공룡 시리즈 펫 12종(docs/bug-dino-pets-design.md, 그림 54 · 55 · 56).
// 12종 · 시리즈 등급 · 그림 게이트, 시리즈 알(1,000코인 · 등급 무게 · 중복 없음 · 다 모으면 거절 · 코인 부족 거절 · 신화 없음),
// 전역 풀(기본 · 영웅 · 전설 · 신화 · 한정 · 선물 · 뽑기 · 사냥)에 안 나옴, 영웅 20마리 · 도감 마스터 조건 그대로,
// 특기 세기(pet-sim 빠른 판), 테마 칭호 2개, 응답에 미리보기(어떤 펫이 나올지) 없음, 선생님 활동 기록, 화면.
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { CHARACTERS, SERIES_EGG, SERIES_PET_KEYS, SERIES_RANKS, seriesRank, seriesGroupKeys, STANDARD_PET_KEYS, EPIC_PET_KEYS, LEGENDARY_PET_KEYS, MYTHIC_PET_KEYS, LIMITED_PET_KEYS, ACTIVE_PET_KEYS, SOON_PET_KEYS, LEGEND_EGG_EPIC_NEED, petReady, petTier } from '../public/modules/core.js';
import { PET_ART } from '../public/modules/pet-art.js';
import { PET_SKILLS, PET_SKILL_TIERS, petSkill } from '../public/modules/battle-engine.js';
import { TITLES, TITLES_SERIES, titleUnlocked, titleCoins } from '../public/modules/titles.js';
import { TITLE_ART } from '../public/modules/emblems.js';
import { PETS_54 } from '../docs/asset-requests/runner/build-54.mjs';
import { seriesEggBuy, seriesEggView, seriesEggPick, seriesEggOdds, seriesLeft, giftEggPick, openEgg, epicCount, hasLegendPet, legendEggView, setMythicRandom } from './rewards.mjs';
import { createCompetition } from './competition.mjs';
import { ACTIVITY_MODES } from './activity.mjs';
import { tierField, groupRate } from './pet-sim.mjs';
import { seeded } from './monster-sim.mjs';
import { emptyState } from './state.mjs';
import { passwordHash } from './auth.mjs';
import { service } from './service.mjs';

const source = path => readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8');
const pub = path => fileURLToPath(new URL(`../public/${path}`, import.meta.url));
const throws = fn => { try { fn(); return null; } catch (e) { return e.status || 500; } };
const DAY = 86400000;
const BUG = ['ladybug', 'bee', 'ant', 'firefly', 'rhinobeetle', 'butterfly'];
const DINO = ['tricera', 'stego', 'brachio', 'ptera', 'ankylo', 'tyranno'];
const ALL = [...BUG, ...DINO];
const RANK = { ladybug: 'basic', bee: 'basic', ant: 'basic', firefly: 'basic', rhinobeetle: 'epic', butterfly: 'epic', tricera: 'basic', stego: 'basic', brachio: 'basic', ptera: 'epic', ankylo: 'epic', tyranno: 'legendary' };
const NAME = { ladybug: '점순이', bee: '붕붕이', ant: '영차', firefly: '반짝이', rhinobeetle: '장수', butterfly: '나풀', tricera: '뿔뿔이', stego: '삐죽이', brachio: '롱롱이', ptera: '휘익', ankylo: '단단이', tyranno: '렉스' };
const TIER_OF_54 = { basic: 'basic', epic: 'epic', legendary: 'legendary' };
const student = (extra = {}) => ({ id: 's', role: 'student', pets: [{ key: 'dog', first: true, acquired_at: 1 }], ...extra });

export async function runBugDinoPetsChecks(assert) {
  // ---- 12종 · 이름 · 시리즈 등급 · 묶음 · 그림 게이트
  assert(SERIES_PET_KEYS.length === 12 && ALL.every(key => SERIES_PET_KEYS.includes(key)) && ALL.every(key => CHARACTERS[key].ko === NAME[key] && CHARACTERS[key].rank === RANK[key] && CHARACTERS[key].series === SERIES_EGG.id)
    && BUG.every(key => CHARACTERS[key].group === 'bug' && CHARACTERS[key].artOrder === 54) && DINO.every(key => CHARACTERS[key].group === 'dino' && CHARACTERS[key].artOrder === 55),
    'V13.195 곤충 6(기본 4 · 영웅 2) · 공룡 6(기본 3 · 영웅 2 · 전설 렉스) = 12종, 이름 · 등급은 #226 구성안 그대로');
  assert(ALL.every(key => PETS_54[key] && PETS_54[key].ko === CHARACTERS[key].ko && PETS_54[key].type === CHARACTERS[key].type && TIER_OF_54[PETS_54[key].tier] === CHARACTERS[key].rank),
    'V13.195 이름 · 종류 · 등급은 그림 주문서(build-54.mjs PETS_54)와 같다');
  assert(ALL.filter(key => seriesRank(key) === 'basic').length === 7 && ALL.filter(key => seriesRank(key) === 'epic').length === 4 && ALL.filter(key => seriesRank(key) === 'legendary').join() === 'tyranno'
    && seriesGroupKeys('bug').join() === BUG.join() && seriesGroupKeys('dino').join() === DINO.join() && seriesRank('dog') === null && Object.keys(SERIES_RANKS).join() === 'basic,epic,legendary',
    'V13.195 시리즈 안 등급: 기본 7 · 영웅 4 · 전설 1(렉스)');
  // 그림 게이트: 기본(0~3) · 작은 그림 · 표정 · 알 반응 · 야차전 자세가 다 있어야 준비됨(petReady = PET_ART)
  const files = key => [0, 1, 2, 3].flatMap(f => [`${key}-${f}`, `${key}-${f}-s`]).concat([1, 2, 3].flatMap(f => ['happy', 'eat', 'sad', 'cheer', 'attack', 'hurt'].map(x => `${key}-${f}-${x}`)), [`${key}-0-happy`, `${key}-0-eat`]);
  assert(ALL.every(key => PET_ART.has(key) && petReady(key) && !SOON_PET_KEYS.includes(key) && files(key).every(f => existsSync(pub(`assets/pets/${f}.webp`)))),
    'V13.195 12종 모두 그림이 다 있어(그림 54 · 55) 알 · 도감에 나온다(petReady = 그림 게이트)');
  assert(source('../public/modules/core.js').includes("export const SERIES_PET_KEYS = readyKeys(c => c.series === SERIES_EGG.id);"), 'V13.195 시리즈 목록도 그림이 다 온 펫만(readyKeys)');
  assert(ALL.every(key => !CHARACTERS[key].epic && !CHARACTERS[key].legendary && !CHARACTERS[key].mythic && !CHARACTERS[key].limited && !CHARACTERS[key].sea && petTier(key) === 'basic'),
    'V13.195 시리즈 펫에는 전역 등급 표시(epic · legendary · mythic · limited)가 없다(전역 셈에 섞이지 않게)');

  // ---- 전역 풀에 안 나온다(기본 · 영웅 · 전설 · 신화 · 한정 알, 선물 알, 사냥, 코인 뽑기), 펫 수에는 들어간다
  const global = [...STANDARD_PET_KEYS, ...EPIC_PET_KEYS, ...LEGENDARY_PET_KEYS, ...MYTHIC_PET_KEYS, ...LIMITED_PET_KEYS];
  assert(ALL.every(key => !global.includes(key) && ACTIVE_PET_KEYS.includes(key)) && STANDARD_PET_KEYS.length === 27 && EPIC_PET_KEYS.length === 27 && LEGENDARY_PET_KEYS.join() === 'haechi,whale,qilin,cheonma' && MYTHIC_PET_KEYS.length === 5,
    'V13.195 시리즈 펫은 기본 · 영웅 · 전설 · 신화 · 한정 목록에 없고(기본 27 · 영웅 27 · 전설 4 · 신화 5 그대로) 펫 수(ACTIVE)에는 들어간다');
  {
    let hit = false;
    for (let i = 0; i < 400; i++) {
      const r = (k => () => ((k = (k * 9301 + 49297) % 233280) / 233280))(i + 1);
      const gift = giftEggPick(student(), r);
      const egg = openEgg(student(), { epic: i % 2 === 0, missing: (i % 2 ? STANDARD_PET_KEYS : EPIC_PET_KEYS), price: 0, random: r, now: 1 });
      if (ALL.includes(gift?.key) || ALL.includes(egg.key)) hit = true;
    }
    assert(!hit, 'V13.195 선생님 선물 알 · 기본 알 · 영웅 알(전설 1% · 신화 포함)에서는 시리즈 펫이 나오지 않는다');
  }
  const hunt = source('./hunt.mjs'), lucky = source('./rewards.mjs'), svc = source('./service.mjs');
  assert(/const missing = p => \(\{ basic: STANDARD_PET_KEYS\.filter[^\n]*epic: EPIC_PET_KEYS\.filter/.test(hunt) && lucky.includes('export const legendLeft = p => LEGENDARY_PET_KEYS.filter(') && lucky.includes('legends[Math.min(legends.length - 1') && lucky.includes("const epicLeft = EPIC_PET_KEYS")
    && (svc.match(/\(epic \? EPIC_PET_KEYS : STANDARD_PET_KEYS\)/g) || []).length >= 2,
    'V13.195 몬스터 사냥 · 코인 뽑기 · 낚시/사냥 교환소 알은 기본 · 영웅 목록만 쓴다(시리즈 펫 없음)');

  // ---- 영웅 20마리 보상 · 도감 마스터 · 전설 1마리 제한은 그대로
  {
    const p = student({ pets: [{ key: 'dog', first: true }, ...ALL.map(key => ({ key, series: SERIES_EGG.id }))] });
    assert(epicCount(p) === 0 && !hasLegendPet(p) && legendEggView(p).legend === false && legendEggView(p).can_buy === true && LEGEND_EGG_EPIC_NEED === 20,
      'V13.195 시리즈 영웅 · 렉스는 영웅 수(전설 알 20마리)에도, 전설 1마리 제한에도 들어가지 않는다');
    assert(TITLES['epic-dex'].goal === EPIC_PET_KEYS.length && EPIC_PET_KEYS.length === 27 && TITLES['epic-collector'].goal === 20, 'V13.195 도감 마스터(영웅 27마리 모두) · 영웅 수집가(20) 조건은 그대로');
  }

  // ---- 시리즈 알: 1,000코인, 등급 무게, 중복 없음, 다 모으면 거절, 코인 부족 거절, 신화 없음
  assert(SERIES_EGG.price === 1000 && SERIES_EGG.item === 'bugdino_egg' && JSON.stringify(SERIES_EGG.weights) === '{"basic":60,"epic":30,"legendary":2}',
    'V13.195 시리즈 알 1,000코인, 등급 무게 기본 60 · 영웅 30 · 전설 2');
  assert(JSON.stringify(seriesEggOdds(ALL)) === '{"basic":65.2,"epic":32.6,"legendary":2.2}' && JSON.stringify(seriesEggOdds(['tyranno', 'ptera'])) === '{"epic":93.8,"legendary":6.3}' && JSON.stringify(seriesEggOdds(['tyranno'])) === '{"legendary":100}',
    'V13.195 등급 확률은 남은 펫이 있는 등급끼리 나눈다(처음 기본 65.2 · 영웅 32.6 · 전설 2.2%)');
  {
    const r = seeded(195), n = 20000, count = { basic: 0, epic: 0, legendary: 0 };
    for (let i = 0; i < n; i++) count[CHARACTERS[seriesEggPick(ALL, r)].rank]++;
    const pct = k => count[k] / n * 100;
    assert(Math.abs(pct('basic') - 65.2) < 1.5 && Math.abs(pct('epic') - 32.6) < 1.5 && Math.abs(pct('legendary') - 2.2) < .6, `V13.195 첫 알의 등급은 무게대로 나온다(기본 ${pct('basic').toFixed(1)} · 영웅 ${pct('epic').toFixed(1)} · 전설 ${pct('legendary').toFixed(1)}%)`);
    // 기대 코인: 렉스는 평균 약 10.6개(10,600코인), 다 모으기 12개(12,000코인)가 천장.
    let rex = 0;
    for (let t = 0; t < 4000; t++) { const left = [...ALL]; for (let i = 1; left.length; i++) { const key = seriesEggPick(left, r); left.splice(left.indexOf(key), 1); if (key === 'tyranno') rex += i; } }
    assert(rex / 4000 > 10 && rex / 4000 < 11.2, `V13.195 렉스는 평균 약 10.6번째 알(지금 ${(rex / 4000).toFixed(2)}), 아무리 늦어도 12번째`);
  }
  {
    const t0 = Date.parse('2026-10-29T03:00:00Z');
    setMythicRandom(() => 0); // 신화를 굴렸다면 반드시 나왔을 운
    try {
      const p = student();
      assert(throws(() => seriesEggBuy(p, SERIES_EGG.price - 1, { now: t0 })) === 400 && !p.points_spent && p.pets.length === 1 && !p.purchases, 'V13.195 코인이 모자라면 거절(아무것도 바뀌지 않는다)');
      assert(throws(() => seriesEggBuy({ id: 'x', role: 'student', pets: [] }, 99999, { now: t0 })) === 409, 'V13.195 첫 펫이 없으면 거절');
      const got = [];
      for (let i = 0; i < 12; i++) {
        const res = seriesEggBuy(p, 99999, { random: () => .999, now: t0 + i });
        got.push(res.key);
        assert(res.series === SERIES_EGG.id && res.rank === CHARACTERS[res.key].rank && !res.mythic && !res.legendary && p.avatar_key === res.key, 'V13.195 시리즈 알은 시리즈 펫 하나(신화 · 전역 전설 없음), 바로 파트너');
      }
      assert(new Set(got).size === 12 && got.every(key => ALL.includes(key)) && p.points_spent === 12 * SERIES_EGG.price && p.pets.filter(x => x.series === SERIES_EGG.id).length === 12
        && p.purchases.length === 12 && p.purchases.every(x => x.item === 'bugdino_egg' && x.price === 1000 && ALL.includes(x.key)) && !p.pets.some(x => MYTHIC_PET_KEYS.includes(x.key)),
        'V13.195 12번이면 12종이 한 번씩(중복 없음), 1,000코인씩, 구입 기록 bugdino_egg');
      assert(throws(() => seriesEggBuy(p, 99999, { now: t0 + 99 })) === 409 && p.points_spent === 12000 && seriesEggView(p).done === true && seriesEggView(p).left === 0 && seriesLeft(p).length === 0,
        'V13.195 다 모으면 더 팔지 않는다(409, 코인 그대로)');
      const half = student({ pets: [{ key: 'dog' }, ...BUG.map(key => ({ key, series: SERIES_EGG.id }))] });
      for (let i = 0; i < 6; i++) assert(DINO.includes(seriesEggBuy(half, 99999, { random: () => i / 6, now: t0 }).key), 'V13.195 이미 가진 펫은 다시 나오지 않는다');
    } finally { setMythicRandom(null); }
  }

  // ---- 칭호: 펫 수 · 알 칭호에는 들어가고, 전설 칭호에는 안 들어간다. 테마 칭호 2개
  {
    const t0 = Date.parse('2026-10-29T03:00:00Z');
    const stats = q => createCompetition(emptyState(), t0).titleStats({ id: `t-${Math.random()}`, role: 'student', ...q });
    const p = student();
    for (let i = 0; i < 12; i++) seriesEggBuy(p, 99999, { random: () => .5, now: t0 + i });
    const s = stats(p);
    assert(s.pets === 13 && s.eggs === 12 && s.legend_pets === 0 && s.epic_pets === 0 && s.series_bug === 6 && s.series_dino === 6, 'V13.195 펫 수 · 알 구입 수에는 들어가고, 전설 · 영웅 펫 수에는 안 들어간다');
    assert(TITLES_SERIES.join() === 'bugall,dinoall' && TITLES.bugall.name === '곤충 채집왕' && TITLES.dinoall.name === '쥬라기 반장' && TITLES_SERIES.every(key => TITLES[key].tier === 'epic' && titleCoins(key) === 60 && TITLES[key].group === 'collect' && TITLES[key].goal === 6),
      'V13.195 테마 칭호 2개: 곤충 채집왕 · 쥬라기 반장(영웅 테두리, 60코인, 곤충 6 · 공룡 6)');
    assert(titleUnlocked('bugall', { series_bug: 6 }) && !titleUnlocked('bugall', { series_bug: 5 }) && titleUnlocked('dinoall', { series_dino: 6 }) && !titleUnlocked('dinoall', { series_dino: 5 }) && titleUnlocked('bugall', s) && titleUnlocked('dinoall', s),
      'V13.195 곤충 6종 · 공룡 6종(렉스 포함)을 다 모으면 칭호');
    assert(TITLES_SERIES.every(key => TITLE_ART.has(key) && existsSync(pub(`assets/titles/${key}.webp`)) && existsSync(pub(`assets/titles/${key}-s.webp`))), 'V13.195 칭호 메달 그림 56b(bugall · dinoall)');
  }

  // ---- 야차전 특기: 12종 모두, 세기(pet-sim 빠른 판)
  assert(ALL.every(key => PET_SKILLS[key]?.name && PET_SKILLS[key].desc && petSkill({ key }).key === key) && PET_SKILL_TIERS.series.join() === [...ALL.filter(k => RANK[k] === 'basic'), ...ALL.filter(k => RANK[k] === 'epic'), 'tyranno'].sort((a, b) => ['basic', 'epic', 'legendary'].indexOf(RANK[a]) - ['basic', 'epic', 'legendary'].indexOf(RANK[b])).join(),
    'V13.195 12종 모두 야차전 특기가 있다(PET_SKILL_TIERS.series)');
  assert(PET_SKILLS.tyranno.burst === 10 && PET_SKILLS.tyranno.boost.join() === '6' && PET_SKILLS.rhinobeetle.burst === 7 && PET_SKILLS.ladybug.guard.join() === '8,8', 'V13.195 특기 숫자는 문서 표 그대로(렉스: 바로 10 피해, 다음 공격 +6)');
  {
    const B = ALL.filter(k => RANK[k] === 'basic'), H = ALL.filter(k => RANK[k] === 'epic');
    const r = tierField([...B, ...H, 'tyranno'], { n: 6, groups: ['B', 'H'], seed: 195 });
    const avg = (keys, g) => (groupRate(r, 'speed', keys, g) + groupRate(r, 'skill', keys, g)) / 2 * 100;
    const b = avg(B, 'B'), h = avg(H, 'H'), rex = avg(['tyranno'], 'H');
    assert(b > 46 && b < 54 && h > 46 && h < 54 && rex > 50.5 && rex < 58 && rex > h, `V13.195 특기 세기(빠른 판): 시리즈 기본 vs 기본 ${b.toFixed(1)} · 영웅 vs 영웅 ${h.toFixed(1)} · 렉스 vs 영웅 ${rex.toFixed(1)}%(긴 판은 docs/pet-skills-balance.md)`);
  }

  // ---- 서버 경로: 홈 데이터 · 알 사기 · 활동 기록 · 응답에 미리보기 없음
  {
    const state = emptyState(), hash = await passwordHash('QaBugDino1!'), now = Date.now();
    const base = { role: 'student', active: true, class_name: '고1A', school_id: 'danwon-high', school: '단원고', division: 'high', password_hash: hash, avatar_key: 'dog', created_at: now - 9 * DAY };
    state.profiles.push({ ...base, id: 'qa-bd', username: 'qa-bd', display_name: '곤충', pets: [{ key: 'dog', first: true, acquired_at: now - 9 * DAY }], gift_box: { total: 12500 } });
    const token = (await service(state, 'POST', '/login', { username: 'qa-bd', password: 'QaBugDino1!', division: 'high' }, null))._cookie;
    const call = (method, path, body = {}) => service(state, method, path, body, token);
    const me = state.profiles.find(x => x.id === 'qa-bd');
    const boot = await call('GET', '/bootstrap');
    const noPreview = v => !ALL.some(key => JSON.stringify(v).includes(`"${key}"`));
    assert(boot.series_egg?.ready && boot.series_egg.price === 1000 && boot.series_egg.left === 12 && boot.series_egg.bug.total === 6 && noPreview(boot.series_egg) && !me.series_egg,
      'V13.195 홈 데이터의 시리즈 알: 가격 · 남은 수 · 등급 확률만(어떤 펫이 나올지는 없다), GET은 아무것도 쓰지 않는다');
    const seen = new Set();
    for (let i = 0; i < 12; i++) {
      const res = await call('POST', '/shop/egg', { kind: 'series' });
      seen.add(res.key);
      assert(ALL.includes(res.key) && res.series === SERIES_EGG.id && res.profile && res.stats && Number.isFinite(res.points_balance) && noPreview(res.series_egg), 'V13.195 서버가 열 때 정하고, 응답의 시리즈 알 보기에는 다음 펫이 없다');
    }
    assert(seen.size === 12 && me.pets.length === 13 && me.points_spent === 12000, 'V13.195 서버 경로: 12번에 12종(중복 없음)');
    assert(await call('POST', '/shop/egg', { kind: 'series' }).then(() => false, e => e.status === 409) && me.points_spent === 12000, 'V13.195 다 모은 뒤에는 서버가 거절');
    const rows = (me.activity || []).filter(x => x.k === 'egg');
    assert(rows.length === 12 && rows.every(x => x.t.startsWith(`${SERIES_EGG.name} · `)) && rows.some(x => x.t.includes('렉스(전설)')) && ACTIVITY_MODES.egg?.label === '곤충 · 공룡 알',
      'V13.195 선생님 활동 기록: 곤충 · 공룡 알에서 누가 나왔는지 한 줄씩');
    const poor = { ...base, id: 'qa-bd2', username: 'qa-bd2', display_name: '가난', pets: [{ key: 'cat', first: true, acquired_at: now - DAY }] };
    state.profiles.push(poor);
    const t2 = (await service(state, 'POST', '/login', { username: 'qa-bd2', password: 'QaBugDino1!', division: 'high' }, null))._cookie;
    assert(await service(state, 'POST', '/shop/egg', { kind: 'series' }, t2).then(() => false, e => e.status === 400) && !poor.points_spent && poor.pets.length === 1, 'V13.195 서버 경로: 코인이 모자라면 거절');
  }

  // ---- 화면: 알 상점 탭 · 연출 재사용 · 도감 시리즈 칸 · CSS · 알 그림
  const ui = source('../public/modules/pet-moments.js'), luckyUi = source('../public/modules/lucky.js'), book = source('../public/modules/petbook.js'), build = source('./build-assets.mjs');
  assert(ui.includes("api('/shop/egg', { kind: 'series' })") && ui.includes("series: { name: '곤충 · 공룡 알', price: se.price }") && ui.includes("'<span class=\"legend-egg-done\">다 모았어요</span>'") && ui.includes('이미 만난 친구는 다시 나오지 않아요!'),
    'V13.195 알 상점 새 탭 "곤충 · 공룡 알"(1,000코인, 다 모으면 "다 모았어요")');
  assert(ui.includes("legendaryShow({ legendary: { key: res.key, series: true } })") && ui.includes("epicShow({ key: res.key, from: 'series' })") && ui.includes('eggRevealHtml(body, res.key, () => close(true));') && luckyUi.includes("from === 'series'") && luckyUi.includes('res.legendary.series'),
    'V13.195 알 깨기 연출 재사용(기본 = 알 이름 카드 · 영웅 = 영웅 연출 · 렉스 = 전설 연출, 시리즈 문구)');
  assert(book.includes('seriesSection(') && book.includes('곤충 · 공룡 시리즈') && book.includes('...LIMITED_PET_KEYS, ...SERIES_PET_KEYS]'), 'V13.195 펫 도감에 곤충 · 공룡 시리즈 칸(학생 · 선생님 도감)');
  const list = JSON.parse(build.match(/const cssSources = (\[[\s\S]*?\]);/)?.[1] || '[]');
  assert(existsSync(pub('v13195.css')) && list.includes('v13195.css') && list.at(-1) === 'v13178.css' && existsSync(pub('assets/ui/bugdino-egg.webp')) && existsSync(pub('assets/ui/bug-egg.webp')) && existsSync(pub('assets/ui/dino-egg.webp')),
    'V13.195 시리즈 알 CSS는 번들에 들어가고(민트 CSS가 맨 끝), 알 그림은 그림 56의 두 알을 합친 bugdino-egg');
  assert(!existsSync(pub('assets/previews')) && !existsSync(pub('assets/ui/preview-56.webp')), 'V13.195 확인용 미리보기 그림(그림 54 · 55 · 56)은 앱에 넣지 않았다');
  // V13.197.1 놀이터 알 상점(arcade.js)에도 곤충 · 공룡 알 칸: 같은 서버 경로(/shop/egg kind series) · 같은 연출.
  {
    const arcade = source('../public/modules/arcade.js'), app = source('../public/app.js');
    assert(arcade.includes('function seriesSlot(A)') && arcade.includes('${seriesSlot(A)}') && arcade.includes('data-egg="series"') && arcade.includes("if (!se?.ready) return '';")
      && app.includes("['epic', 'season', 'series', 'legend'].includes(d.egg)") && ui.includes("{ kind: ['epic', 'season', 'series'].includes(kind) ? kind : 'basic' }") && ui.includes("(res.series && res.rank !== 'basic')")
      && list.includes('v13196.css') && list.at(-1) === 'v13178.css',
      'V13.197.1 놀이터 알 상점에도 곤충 · 공룡 알 칸(그림이 없으면 숨김, 같은 사기 경로 · 연출)');
  }
  const doc = source('../docs/bug-dino-pets-design.md');
  assert(doc.includes('시리즈 알') && doc.includes('1,000코인') && doc.includes('60 · 30 · 2'), 'V13.195 구성안 문서는 시리즈 알 결정으로 고쳤다');
}
