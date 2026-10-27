// V13.185 낚시 업그레이드 검사(선생님 피드백: "심해 물고기 추가" · "낚싯대를 강화해도 똑같아 보인다").
//   낚싯대: 단계별 그림(pov-rod · -t2~t5)을 조각내 휘는 곡선에 붙인다. 심해 물고기 8종: 깊은 바다(낚싯대 3단계)에서만, 그림이 다 들어온 것만.
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { FISH, FISH_KEYS, DEEP_KEYS, LURES, RARITY_KEYS, rollCast } from '../public/modules/fishing-rules.js';
import { FISH_READY } from '../public/modules/fish-art.js';
import { FISH_ART } from '../public/modules/fishing-art.js';
import { REEL, ROD, DEEP, CAST_TIERS, reelRoll, deepReady, deepOpen, pearlsOf } from '../public/modules/reel-rules.js';
import { rodArt, rodPieceMatrix, ROD_CUT } from '../public/modules/reel.js';
import { reelView, reelCast, reelLand, reelSell } from './reel.mjs';

const source = path => readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8');
const pub = path => fileURLToPath(new URL(`../public/${path}`, import.meta.url));
const throws = fn => { try { fn(); return null; } catch (e) { return e.status || 500; } };
const ALL = new Set([...FISH_KEYS, ...DEEP_KEYS]);
const NONE = new Set(FISH_KEYS);

export function runFishingUpgradeChecks(assert) {
  // ── 낚싯대: 단계마다 다른 그림 · 같은 곡선 ──
  const arts = [1, 2, 3, 4, 5].map(rodArt);
  assert(arts.every(a => a && existsSync(pub(`assets/fishing/${a.rod}.webp`)) && a.reel && existsSync(pub(`assets/fishing/${a.reel}.webp`)))
    && new Set(arts.map(a => a.rod)).size === 5 && new Set(arts.map(a => a.reel)).size === 5 && arts[0].rod === 'pov-rod' && arts[4].rod === 'pov-rod-t5',
    'V13.185 낚싯대 1~5단계는 서로 다른 그림(pov-rod · pov-rod-t2~t5)과 릴 그림(pov-reel · -t2~t5)으로 그린다(1단계도 그림: 초록 마디 · 코르크 손잡이 · 릴)');
  // 곡선을 따라 붙인 조각: 첫 조각의 손잡이 끝은 at(T0), 마지막 조각의 끝(그림 속 낚싯대 끝)은 at(1) = 줄 끝(tip). 이웃 조각은 이어진다.
  const curve = (B, C, T) => t => [(1 - t) ** 2 * B[0] + 2 * (1 - t) * t * C[0] + t * t * T[0], (1 - t) ** 2 * B[1] + 2 * (1 - t) * t * C[1] + t * t * T[1]];
  const apply = (m, [u, v]) => [m[0] * u + m[2] * v + m[4], m[1] * u + m[3] * v + m[5]];
  const near = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1]) < .01;
  const lerp = (a, b, k) => a + (b - a) * k;
  const bends = [[[234, 803], [254, 470], [261, 335]], [[234, 803], [256, 455], [370, 470]], [[234, 803], [250, 500], [120, 520]]];
  const fits = bends.every(([B, C, T]) => {
    const at = curve(B, C, T), { N, V0, V1, T0 } = ROD_CUT, cx = arts[2].cx;
    const ms = Array.from({ length: N }, (_, i) => rodPieceMatrix(at, i, cx, 1));
    return near(apply(ms[0], [cx, V0]), at(T0)) && near(apply(ms[N - 1], [cx, V1]), T)
      && ms.slice(1).every((m, i) => near(apply(m, [cx, lerp(V0, V1, (i + 1) / N)]), apply(ms[i], [cx, lerp(V0, V1, (i + 1) / N)])));
  });
  assert(fits, 'V13.185 낚싯대 그림 조각은 휘는 곡선을 따라 이어지고, 낚싯대 끝이 줄 끝(rodGeom tip)과 같은 자리다(곧게 · 오른쪽 · 왼쪽으로 휠 때 모두)');
  const ui = source('../public/modules/reel.js'), css = source('../public/v13154.css');
  assert(ui.includes("svg.dataset.rodArt = a ? a.rod : '';") && ui.includes("svg.classList.toggle('img', !!a);") && ui.includes('if (R.rodPieces) drawRodArt(g);') && ui.includes('paintRod();\n}\n// V13.154 낚싯대 단계')
    && /\.rl-rig\.img \.rl-rod-body,\.rl-rig\.img \.rl-rod-cork,\.rl-rig\.img #rl-guides\{display:none\}/.test(css),
    'V13.185 낚시 화면은 단계 그림 낚싯대(data-rod-art)를 그리고 코드 낚싯대는 숨긴다. 장면을 그릴 때 · 강화할 때 바로 바뀐다(그림이 없으면 코드 낚싯대)');
  // 손맛 연출(입질 · 끌어당김 · 줄 끊김)은 같은 낚싯대 곡선을 쓴다.
  assert(["R.rig.tBend = .32;", "Object.assign(R.rig, { tBack: .45, tBend: .5 });", "fx('snap', ...rodGeom().tip)", "R.rig.tBend = .18 + f.tension / 100 * .85"].every(x => ui.includes(x)),
    'V13.185 입질 · 챔질 · 파이팅 휨 · 줄 끊김(snap) 연출은 그대로(같은 rodGeom · tBend)');

  // ── 심해 물고기 8종 ──
  const want = { anglerfish: 'rare', blobfish: 'rare', fireflysquid: 'rare', oarfish: 'epic', toothfish: 'epic', vampiresquid: 'epic', manta: 'legend', frilledshark: 'legend' };
  assert(DEEP_KEYS.join() === Object.keys(want).join() && DEEP_KEYS.every(k => FISH[k].deep && FISH[k].rarity === want[k] && FISH[k].name && FISH[k].art?.body)
    && FISH_KEYS.length === 24 && !FISH_KEYS.some(k => FISH[k].deep) && FISH_KEYS.at(-1) === 'goldenegg',
    'V13.185 심해 물고기 8종(희귀 3 · 영웅 3 · 전설 2), 바닷가 물고기 24종은 그대로');
  const range = r => FISH_KEYS.filter(k => FISH[k].rarity === r).flatMap(k => FISH[k].kg);
  assert(DEEP_KEYS.every(k => { const [lo, hi] = FISH[k].kg; return lo > 0 && hi > lo && hi <= 2000; }) && DEEP_KEYS.every(k => pearlsOf(k) === REEL.PEARLS[FISH[k].rarity] && pearlsOf(k) > 0)
    && Math.max(...DEEP_KEYS.map(k => FISH[k].kg[1])) <= Math.max(...range('legend')),
    'V13.185 심해 물고기 무게 범위가 바르고(가장 큰 것도 고래상어 이하), 진주 값은 같은 등급 바닷가 물고기와 같다');
  // 확률: 깊은 바다도 등급 확률은 바닷가와 같다(같은 seed → 같은 등급). 희귀 · 영웅 · 전설은 심해 물고기로, 나머지는 바닷가 물고기.
  let same = true, deepSeen = new Set(), shoreDeep = 0;
  for (let seed = 1; seed <= 6000; seed++) for (const cast of CAST_TIERS) {
    const a = reelRoll(seed, cast), b = reelRoll(seed, cast, { deep: true, ready: ALL });
    if (a.rarity !== b.rarity || (DEEP.RARITIES.includes(b.rarity) ? !FISH[b.key].deep : b.key !== a.key)) same = false;
    if (FISH[b.key].deep) deepSeen.add(b.key);
    if (FISH[a.key].deep) shoreDeep++;
  }
  assert(same && deepSeen.size === 8 && !shoreDeep, 'V13.185 깊은 바다는 등급 확률이 바닷가와 같고, 희귀 이상은 심해 물고기 8종 중에서 나온다(바닷가에서는 안 나온다)');
  // 물고기마다 확률(%) 합 = 100(던지기 단계마다).
  const table = cast => {
    const L = LURES[CAST_TIERS.indexOf(cast)], total = RARITY_KEYS.reduce((n, r) => n + L.odds[r], 0), out = { goldenegg: L.golden };
    for (const r of RARITY_KEYS) { const pool = DEEP.RARITIES.includes(r) ? DEEP_KEYS.filter(k => FISH[k].rarity === r) : FISH_KEYS.filter(k => FISH[k].rarity === r); for (const k of pool) out[k] = (100 - L.golden) * L.odds[r] / total / pool.length; }
    return out;
  };
  assert(CAST_TIERS.every(c => Math.abs(Object.values(table(c)).reduce((a, b) => a + b, 0) - 100) < 1e-9) && Math.abs(table('ok').anglerfish - 5 / 3) < 1e-9,
    'V13.185 깊은 바다 물고기별 확률의 합은 100%(지렁이 던지기에서 아귀 약 1.67%)');
  // 반 전체 낚시(교실 게임)에는 심해 물고기가 나오지 않는다.
  let party = 0;
  for (let i = 0; i < 4000; i++) if (FISH[rollCast(77, i, i % 4, i % 7 * 1000).key].deep) party++;
  assert(!party && !/DEEP|deep/.test(source('./party-engine.mjs')), 'V13.185 반 전체 낚시(rollCast)에는 심해 물고기가 없다');

  // ── 그림 게이트 ──
  const files = new Set(readdirSync(pub('assets/fish')));
  const complete = k => ['', '-hang', '-hang-s'].every(x => files.has(`${k}${x}.webp`));
  assert([...ALL].every(k => FISH_READY.has(k) === complete(k)) && FISH_KEYS.every(k => FISH_READY.has(k) && FISH_ART.has(k)) && DEEP_KEYS.every(k => FISH_ART.has(k) === complete(k))
    && source('./build-assets.mjs').includes("const out = resolve(root, 'public/modules/fish-art.js');"),
    'V13.185 build:assets가 그림 폴더를 보고 fish-art.js(FISH_READY: 본그림 · -hang · -hang-s가 다 있는 물고기)를 만들고, 그림을 쓰는 목록(FISH_ART)도 이것을 따른다');
  assert(!deepReady(NONE).length && !deepOpen(5, NONE) && deepReady(ALL).length === 8 && !deepOpen(2, ALL) && deepOpen(3, ALL) && deepReady(new Set([...FISH_KEYS, 'manta'])).join() === 'manta',
    'V13.185 그림이 없는 심해 물고기는 나오지 않고, 그림이 들어오면 그 물고기만 나온다. 깊은 바다는 낚싯대 3단계부터');
  let leak = false;
  for (let seed = 1; seed <= 3000; seed++) { const r = reelRoll(seed, 'perfect', { deep: true, ready: NONE }); if (FISH[r.key].deep) leak = true; }
  const onlyManta = new Set([...FISH_KEYS, 'manta']), got = { legend: new Set(), rare: new Set() };
  for (let seed = 1; seed <= 20000; seed++) { const r = reelRoll(seed, 'perfect', { deep: true, ready: onlyManta }); got[r.rarity]?.add(r.key); }
  assert(!leak && [...got.legend].join() === 'manta' && got.rare.size === 4 && [...got.rare].every(k => !FISH[k].deep),
    'V13.185 깊은 바다에서 그림이 있는 등급만 심해 물고기, 그림이 없는 등급은 바닷가 물고기로 나온다');
  // 서버: 그림 · 낚싯대 단계 확인, 응답에 물고기 이름 · 무게 없음.
  const p = { reel: { bait: 3, rod: 2 } };
  assert(reelView(p, 0, NONE).deep === null && reelView(p, 0, ALL).deep.open === false && reelView(p, 0, ALL).deep.min_rod === 3 && reelView(p, 0, ALL).all === 32 && reelView(p, 0, NONE).all === 24,
    'V13.185 그림이 없으면 깊은 바다는 화면에 보이지 않고, 그림이 있으면 낚싯대 3단계부터 열린다(도감 수에도 그림이 있는 심해 물고기만)');
  assert(throws(() => reelCast(p, { id: 'deep-1', cast: 'perfect', spot: 'deep', now: 0, seed: 5, ready: ALL })) === 409 && p.reel.bait === 3
    && throws(() => reelCast({ reel: { bait: 3, rod: 5 } }, { id: 'deep-2', cast: 'ok', spot: 'deep', now: 0, seed: 5, ready: NONE })) === 409,
    'V13.185 낚싯대 3단계 전이거나 그림이 없으면 깊은 바다로 못 던진다(미끼도 안 쓴다)');
  let seed = 1; while (!DEEP.RARITIES.includes(reelRoll(seed, 'perfect').rarity)) seed++;
  const q = { reel: { bait: 3, rod: 3 }, games: {} };
  const res = reelCast(q, { id: 'deep-3', cast: 'perfect', spot: 'deep', now: 0, seed, ready: ALL }), text = JSON.stringify(res);
  assert(FISH[q.reel.live.key].deep && q.reel.live.spot === 'deep' && q.reel.bait === 2 && !('key' in res) && !('kg' in res) && !('rarity' in res) && !DEEP_KEYS.some(k => text.includes(k) || text.includes(FISH[k].name)),
    'V13.185 깊은 바다 던지기 응답에는 어떤 물고기인지(이름 · 키 · 무게) 없다');
  const key = q.reel.live.key, land = reelLand(q, { id: 'deep-3', result: 'caught', now: 60000 });
  assert(land.caught && land.key === key && land.pearls === REEL.PEARLS[FISH[key].rarity] && q.reel.net[key] === 1 && q.games.fish.book[key].n === 1 && reelSell(q, { key }).pearls === land.pearls,
    'V13.185 심해 물고기도 도감에 남고, 수조에 들어가고, 같은 등급 값의 진주로 팔린다');
  // 하루 보상: 미끼 하루 5개 · 진주 → 코인 하루 100은 그대로. 깊은 바다의 한 번 던지기 기대 진주 = 바닷가와 같다.
  const expect = cast => { const L = LURES[CAST_TIERS.indexOf(cast)], total = RARITY_KEYS.reduce((n, r) => n + L.odds[r], 0); return RARITY_KEYS.reduce((n, r) => n + REEL.PEARLS[r] * L.odds[r] / total, 0) * (100 - L.golden) / 100; };
  const deepExpect = cast => Object.entries(table(cast)).reduce((n, [k, pct]) => n + pearlsOf(k) * pct / 100, 0);
  assert(REEL.BAIT_DAILY === 5 && REEL.COIN_DAILY === 100 && CAST_TIERS.every(c => Math.abs(expect(c) - deepExpect(c)) < 1e-9) && REEL.BAIT_DAILY * deepExpect('perfect') < 200,
    'V13.185 하루 보상 상한은 그대로(미끼 5개 · 코인 교환 100). 깊은 바다의 기대 진주는 바닷가와 같다');
  // 화면 · 서버 연결
  const svc = source('./service.mjs');
  assert(svc.includes("spot: body.spot === 'deep' ? 'deep' : 'shore'") && svc.includes("logActivity(p, 'fish', res.caught ? `낚시 ${FISH[res.key]?.name || '물고기'} ${res.kg}kg`")
    && ui.includes("...(R.spot === 'deep' ? { spot: 'deep' } : {})") && ui.includes('const shore = byRarity(FISH_KEYS), deep = byRarity(deepReady()), keys = [...shore, ...deep];') && ui.includes('function spotSwitch()'),
    'V13.185 화면은 고른 장소를 보내고, 도감은 그림이 있는 심해 물고기만 따로 보여 준다. 선생님 활동 기록은 물고기 이름 그대로');
  // 그림 주문서 53: 물고기마다 3장, Drive 그림체 · 저장 문구, Codex는 Drive 없이.
  const R53 = '../docs/asset-requests/runner/';
  const sheets = ['53a-deep-fish.txt', '53b-deep-fish-hanging.txt'].flatMap(f => source(R53 + f).trim().split('\n---\n'));
  const map = source(R53 + 'slice-map.csv'), codex = source(R53 + 'CODEX_PROMPT_53.md');
  assert(sheets.length === 4 && sheets.every((t, i) => t.includes('STYLE REFERENCE — before drawing, open') && t.includes('Google Drive') && t.includes(`into the folder "SUMUS 심해 물고기 53 (Runner용)", named exactly "${['53a-1', '53a-2', '53b-1', '53b-2'][i]}.png"`))
    && DEEP_KEYS.every(k => map.includes(`"public/assets/fish/${k}.webp"`) && map.includes(`"public/assets/fish/${k}-hang.webp"`))
    && codex.includes('**Google Drive는 쓰지 않는다. 멈추지 않는다.**') && codex.includes('--small 96') && codex.includes('fish/tuna.webp') && codex.includes('`CHARACTER REFERENCE`'),
    'V13.185 그림 주문서 53: 4시트(옆모습 2 · 매달린 그림 2), Drive 기존 물고기로 그림체 맞추기 · 정해진 Drive 폴더에 정확한 이름으로 저장, Codex는 저장소 그림을 참고 그림으로');
}
