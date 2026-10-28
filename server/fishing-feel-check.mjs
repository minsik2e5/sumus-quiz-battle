// V13.190 낚시 손맛 더하기 검사(docs/fishing-feel-design.md): 몸부림 · 낚싯대 감촉 · 월척 · 깊은 바다 분위기.
//   판정 숫자(FIGHT · 최소 파이팅 시간 · 진주 · 하루 한도)는 그대로, 몸부림 기울기는 같은 등급끼리 합이 0, 응답에 물고기 힌트 없음.
import { readFileSync, statSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { FISH, FISH_KEYS, DEEP_KEYS, RARITY_KEYS } from '../public/modules/fishing-rules.js';
import { FISH_READY } from '../public/modules/fish-art.js';
import { REEL, FIGHT, ROD, FINISH, CAST_TIERS, reelRoll } from '../public/modules/reel-rules.js';
import { FEEL_STYLES, FEEL_MOVES, SPECIES_FEEL, BODY_FEEL, feelOf, poolOf, leanOf, leanMoves, moveShare, feelPath, ROD_FEEL, rodFeel, TROPHY, trophyOf, TROPHY_FX, DEEP_FX, lowEndDevice, FEEL_SFX } from '../public/modules/reel-feel.js';
import { SOUND_KEYS, SOUND_LOOP } from '../public/modules/sound.js';
import { reelCast, reelLand } from './reel.mjs';

const source = path => readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8');
const pub = path => fileURLToPath(new URL(`../public/${path}`, import.meta.url));
const ALL = [...FISH_KEYS, ...DEEP_KEYS];
const ALL_READY = new Set(ALL);
const near = (a, b, e = 1e-5) => Math.abs(a - b) <= e;

export function runFishingFeelChecks(assert) {
  // ── 공정성: 판정 숫자는 그대로 ──
  const fightWas = {
    common: { hp: 100, pull: .55, dash: [2400, 3800], min: 4000, size: 1, dist: 14, moves: { mash: 3, rhythm: 2, thrash: 1, dive: 1 }, taps: 10, notes: 6, beat: 520 },
    uncommon: { hp: 140, pull: .75, dash: [2200, 3500], min: 5500, size: 1.25, dist: 18, moves: { mash: 3, rhythm: 3, thrash: 2, dive: 1 }, taps: 12, notes: 7, beat: 480 },
    rare: { hp: 190, pull: .95, dash: [2000, 3200], min: 7000, size: 1.55, dist: 24, moves: { mash: 3, rhythm: 3, thrash: 2, dive: 2 }, taps: 14, notes: 8, beat: 440 },
    epic: { hp: 250, pull: 1.2, dash: [1800, 2900], min: 9000, size: 1.9, dist: 30, moves: { mash: 3, rhythm: 3, thrash: 2, dive: 2 }, taps: 16, notes: 9, beat: 400 },
    legend: { hp: 320, pull: 1.45, dash: [1600, 2600], min: 11000, size: 2.3, dist: 38, moves: { mash: 3, rhythm: 4, thrash: 3, dive: 2 }, taps: 18, notes: 10, beat: 360 },
    golden: { hp: 190, pull: 1, dash: [2000, 3200], min: 7000, size: 1.5, dist: 24, moves: { mash: 3, rhythm: 3, thrash: 2, dive: 1 }, taps: 14, notes: 8, beat: 420 }
  };
  const server = source('./reel.mjs');
  assert(JSON.stringify(FIGHT) === JSON.stringify(fightWas) && JSON.stringify(ROD.LEVELS.map(x => [x.reel, x.tension, x.snap, x.skill])) === JSON.stringify([[1, 1, .75, 1], [1.06, .96, .85, 1.07], [1.12, .92, .95, 1.15], [1.18, .88, 1.05, 1.22], [1.25, .85, 1.2, 1.3]])
    && JSON.stringify(REEL.PEARLS) === JSON.stringify({ common: 10, uncommon: 25, rare: 60, epic: 150, legend: 400, golden: 0 }) && REEL.BAIT_DAILY === 5 && REEL.BAIT_MAX === 10 && REEL.COIN_DAILY === 100 && REEL.EGG_DAILY === 1 && REEL.EPIC_DAILY === 1 && FINISH.PERFECT_KG === 1.08
    && server.includes('const SLACK_MS = 1500;') && server.includes('else if (now - live.at + SLACK_MS < FIGHT[live.rarity].min / rodOf(live.rod).reel) out = { caught: false, reason: \'short\' };'),
    'V13.190 손맛을 더해도 판정 숫자(FIGHT 등급별 세기 · 행동 가중치 · 서버 최소 파이팅 시간 · 낚싯대 능력치 · 진주 · 미끼 · 코인 · 알 하루 한도 · 퍼펙트 +8%)는 그대로다');

  // ── ① 몸부림: 32종 모두 매핑, 5종 대표 + 몸 모양 기본 ──
  const bodies = new Set(ALL.map(k => FISH[k].art.body));
  assert(ALL.length === 32 && ALL.every(k => FEEL_STYLES[feelOf(k)]) && [...bodies].every(b => FEEL_STYLES[BODY_FEEL[b]])
    && feelOf('tuna') === 'rush' && feelOf('squid') === 'ink' && feelOf('ray') === 'glide' && feelOf('anglerfish') === 'lure' && feelOf('shark') === 'strike'
    && feelOf('minnow') === 'quiver' && feelOf('carp') === 'sway' && feelOf('catfish') === 'snake' && Object.keys(SPECIES_FEEL).length === 5
    && Object.values(FEEL_STYLES).every(s => FEEL_MOVES.includes(s.sig) && FISH[s.sil] && s.pitch > .5 && s.pitch < 1.5 && s.splash > .5 && s.splash < 1.5 && s.haptic && s.mash?.length === 2),
    'V13.190 물고기 32종 모두 몸부림이 있다(참치 · 대왕오징어 · 가오리 · 아귀 · 상어는 대표 몸부림, 나머지는 몸 모양 기본), 몸부림마다 실루엣 · 소리 높낮이 · 물보라 · 진동이 있다');
  // 그림자 움직임 · 소리 · 진동이 몸부림마다 다르다(같은 시각 · 같은 난수에서 움직임 자취가 서로 다름).
  const trace = style => { const st = {}; let seq = 0; const r = () => (seq = (seq * 9301 + 49297) % 233280) / 233280; return Array.from({ length: 80 }, (_, i) => { const p = feelPath(style, 1000 + i * 97, i % 20 < 6 ? 'mash' : '', st, r); return `${p.x.toFixed(3)},${p.y.toFixed(1)},${p.rot.toFixed(1)}`; }).join('|'); };
  const styles = Object.keys(FEEL_STYLES), traces = styles.map(trace);
  const finite = styles.every(s => { const st = {}; for (let t = 0; t < 30000; t += 16) { const p = feelPath(s, t, ['', 'mash', 'rhythm', 'thrash', 'dive'][Math.floor(t / 3000) % 5], st); if (![p.x, p.y, p.rot, p.follow].every(Number.isFinite) || Math.abs(p.x) > .42 || p.follow <= 0) return false; } return true; });
  const turns = (() => { const st = {}; let n = 0; for (let t = 0; t < 2600; t += 16) if (feelPath('rush', t, 'mash', st).ev === 'turn') n++; return n; })();
  const strikes = (() => { const st = {}; let n = 0; for (let t = 0; t < 20000; t += 16) if (feelPath('strike', t, '', st).ev === 'strike') n++; return n; })();
  const inks = (() => { const st = {}; let n = 0; for (let t = 0; t < 6000; t += 16) if (feelPath('ink', t, t > 2000 && t < 3900 ? 'dive' : '', st).ev === 'ink') n++; return n; })();
  assert(finite && new Set(traces).size === styles.length && turns === 1 && strikes >= 4 && strikes <= 8 && inks === 1
    && new Set(styles.map(s => JSON.stringify(FEEL_STYLES[s].haptic))).size === styles.length && new Set(styles.map(s => `${FEEL_STYLES[s].pitch}|${FEEL_STYLES[s].splash}|${FEEL_STYLES[s].sil}`)).size === styles.length,
    'V13.190 몸부림마다 그림자 움직임 · 진동 패턴 · 소리 높낮이 · 물보라가 다르다(참치는 돌진 한 번에 꺾기 한 번, 상어는 몇 초마다 한 번씩 치고 빠짐, 대왕오징어는 잠수마다 먹물 한 번)');

  // 행동 가중치 기울기: 같은 판(바닷가 · 깊은 바다 × 등급) 물고기끼리 합하면 0 → 등급 평균 행동 비율이 원래와 같다.
  let fair = true, perFish = true, worst = 0;
  for (const deep of [false, true]) for (const ready of [ALL_READY, FISH_READY]) for (const rarity of [...RARITY_KEYS, 'golden']) {
    const any = ALL.find(k => FISH[k].rarity === rarity && (deep || !FISH[k].deep));
    const pool = poolOf(any, deep, ready);
    if (!pool.length) continue;
    const base = FIGHT[rarity].moves, want = moveShare(base);
    const avg = Object.fromEntries(FEEL_MOVES.map(m => [m, pool.reduce((s, k) => s + moveShare(leanMoves(base, leanOf(k, deep, ready)))[m], 0) / pool.length]));
    if (!FEEL_MOVES.every(m => near(avg[m], want[m]))) fair = false;
    for (const k of pool) {
      const lean = leanOf(k, deep, ready), w = leanMoves(base, lean);
      if (!near(Object.values(lean).reduce((a, b) => a + b, 0), 0) || Object.values(w).some(x => x < 0) || Object.values(lean).some(x => Math.abs(x) > 1)) perFish = false;
      worst = Math.max(worst, ...FEEL_MOVES.map(m => Math.abs(moveShare(w)[m] - want[m])));
    }
  }
  assert(fair && perFish && worst < .15 && JSON.stringify(leanOf('goldenegg')) === '{}',
    `V13.190 몸부림 기울기는 물고기마다 행동 하나에 +1(가중치 합 그대로), 같은 등급 물고기끼리 합하면 0이라 등급 평균 행동 비율(= 평균 난이도)은 바닷가 · 깊은 바다 모두 원래와 같다(한 물고기 최대 차이 ${Math.round(worst * 100)}%p)`);

  // 서버 응답: 몸부림 이름(여러 물고기가 같이 씀)과 기울기만, 물고기 이름 · 무게는 없다.
  let hidden = true, sameFeel = true, seen = new Set();
  for (let seed = 1; seed <= 400; seed++) for (const spot of ['shore', 'deep']) {
    const p = { reel: { bait: 1, rod: 1 } };
    const c = reelCast(p, { id: `f${seed}`, cast: CAST_TIERS[seed % 3], spot, seed, now: 1e12, ready: ALL_READY }), live = p.reel.live, txt = JSON.stringify(c);
    seen.add(c.fight.feel);
    if (txt.includes(`"${live.key}"`) || txt.includes(FISH[live.key].name) || /"(kg|key|name|rarity)"/.test(txt) || 'key' in c || 'kg' in c || 'rarity' in c || 'key' in c.fight) hidden = false;
    if (Object.keys(c.fight).join() !== 'hp,pull,dash,size,min,dist,moves,taps,notes,beat,feel,lean' || c.fight.feel !== feelOf(live.key) || JSON.stringify(c.fight.lean) !== JSON.stringify(leanOf(live.key, spot === 'deep', ALL_READY)) || JSON.stringify(c.fight.moves) !== JSON.stringify(FIGHT[live.rarity].moves)) sameFeel = false;
  }
  const again = (() => { const p = { reel: { bait: 2 } }; const a = reelCast(p, { id: 'x', cast: 'ok', seed: 9, now: 1e12 }), b = reelCast(p, { id: 'x', cast: 'ok', seed: 10, now: 1e12 + 5 }); return JSON.stringify(a.fight) === JSON.stringify(b.fight) && b.again; })();
  const shared = styles.filter(s => ALL.filter(k => feelOf(k) === s).length >= 2).length;
  assert(hidden && sameFeel && again && seen.size >= 8 && shared >= 7,
    'V13.190 던지기 응답에는 파이팅 세기 · 그림자 크기 · 몸부림 이름(feel) · 기울기(lean)만 있고, 물고기 key · 이름 · 무게 · 등급은 없다(다시 보내도 같은 답, 몸부림 이름 대부분은 여러 물고기가 같이 쓴다)');

  // ── ② 낚싯대 단계별 감촉 ──
  assert(ROD_FEEL.length === ROD.MAX && ROD_FEEL.every((x, i) => x.level === i + 1 && rodFeel(i + 1) === x) && new Set(ROD_FEEL.map(x => JSON.stringify({ ...x, level: 0, ko: '' }))).size === 5 && new Set(ROD_FEEL.map(x => x.ko)).size === 5
    && ROD_FEEL.every((x, i) => !i || (x.bend < ROD_FEEL[i - 1].bend && x.vib > ROD_FEEL[i - 1].vib && x.drag[0] < ROD_FEEL[i - 1].drag[0] && x.spring[0] < ROD_FEEL[i - 1].spring[0]))
    && ROD_FEEL.every(x => SOUND_KEYS.includes(x.click[0]) && SOUND_KEYS.includes(x.snap[0])) && rodFeel(1).click[0] === 'rod-tick' && rodFeel(5).click[0] === 'rod-ratchet' && rodFeel(5).shimmer > rodFeel(4).shimmer && !rodFeel(1).shimmer && rodFeel(3).click[0] === 'reel-click',
    'V13.190 낚싯대 1~5단계마다 감촉이 다르다: 새싹은 많이 휘고 통통 튀며 가벼운 톡 · 높은 줄 풀림 · 약한 진동, 위로 갈수록 덜 휘고 묵직하게 드르륵 · 낮은 줄 풀림 · 센 진동, 보석 · 전설은 반짝이 · 굵은 줄 끊김');
  const ui = source('../public/modules/reel.js');
  assert(ui.includes('const [k, d] = R?.rodFeel?.spring || [170, 13];') && ui.includes('const bend = clamp(rig.bend * (R.rodFeel?.bend || 1), 0, 1.15);') && ui.includes('R.rodFeel = rodFeel(L.level);')
    && ui.includes('const k = Math.min(1, f.tension / 100 * (R.rodFeel?.vib || 1))') && ui.includes("const [sk, sr] = R.rodFeel?.snap || ['reel-snap', 1]; sfx(sk, { rate: sr });") && ui.includes("data-rl=\"rod-feel\"") && ui.includes("if (act === 'rod-feel') return rodPreview(")
    && /function rodPreview\(lv, b\) \{[\s\S]{0,200}if \(!soundOn\(\)\) return;/.test(ui),
    'V13.190 낚시 화면은 단계별 감촉(휘는 정도 · 용수철 · 릴 소리 · 진동 · 끊김 소리)을 쓰고, 낚싯대 강화 창에 감촉 미리듣기가 있다(소리를 끄면 조용히)');

  // ── ③ 월척 ──
  const T = (key, kg, extra = {}) => trophyOf({ caught: true, key, kg, rarity: FISH[key].rarity, ...extra });
  const at = (key, q) => FISH[key].kg[0] + (FISH[key].kg[1] - FISH[key].kg[0]) * q;
  assert(T('goldcarp', 30).trophy && T('goldcarp', 30).legend && T('carp', at('carp', .85)).trophy && !T('carp', at('carp', .84)).trophy && T('tuna', at('tuna', 1.08)).trophy && !T('minnow', at('minnow', 1)).trophy
    && !T('goldenegg', 7.7).trophy && !trophyOf({ caught: false }).trophy && T('carp', 1, { record: true }).record && !T('carp', 1, { record: true }).trophy && TROPHY.TOP === .15 && TROPHY_FX.SLOW_MS >= 400 && TROPHY_FX.SLOW_MS <= 600,
    'V13.190 월척: 전설이거나, 보통 이상 물고기가 무게 범위 상위 15%(경계 포함, 퍼펙트로 범위를 넘어도). 흔함 · 황금 알 · 놓침은 아니고, 신기록은 따로(NEW RECORD) · 슬로모션 0.4~0.6초');
  let caught = 0, trophies = 0, state = 7;
  const rand = () => (state = (state * 1103515245 + 12345) % 2147483648) / 2147483648;
  for (let i = 0; i < 40000; i++) {
    const r = rand(), cast = r < .4 ? 'ok' : r < .8 ? 'good' : 'perfect', f = reelRoll(1 + i * 7919, cast, { deep: i % 2 === 1, ready: ALL_READY });
    const kg = rand() < .3 && f.key !== 'goldenegg' ? Math.round(f.kg * FINISH.PERFECT_KG * 100) / 100 : f.kg;
    caught++; if (trophyOf({ caught: true, ...f, kg }).trophy) trophies++;
  }
  const perDay = trophies / caught * REEL.BAIT_DAILY * .8;
  assert(perDay > .2 && perDay < .55, `V13.190 월척은 너무 자주 뜨지 않는다(잡은 물고기의 ${(trophies / caught * 100).toFixed(1)}%, 미끼 하루 5개 · 80% 잡으면 하루 평균 ${perDay.toFixed(2)}번)`);
  const svc = source('./service.mjs');
  assert(ui.includes('const T = trophyOf(res);') && ui.includes('if (T.trophy) await trophyMoment(T);') && /async function trophyMoment\(T\) \{[\s\S]{0,200}if \(reduced\(\)\) \{ leap\?\.classList\.add\('trophy'\); return; \}/.test(ui)
    && ui.includes('<span>월척!</span>') && ui.includes('<b>NEW</b><span>RECORD</span>') && ui.includes("sfx('trophy-boom'") && ui.includes("fx('jump', x, y, 'big')")
    && svc.includes("logActivity(p, 'fish', res.caught ? `낚시 ${FISH[res.key]?.name || '물고기'} ${res.kg}kg` : '낚시 놓침', now);"),
    'V13.190 월척 연출: 끌어올리는 순간 멈춘 듯 0.5초 · 번쩍 · 큰 물보라 · 무게가 천천히 올라감 · "월척!" 도장, 신기록이면 "NEW RECORD" 도장 · 별. 동작 줄이기면 멈춤 · 번쩍 없이 글자로 보이고, 선생님 활동 기록은 그대로');

  // ── ④ 깊은 바다 ──
  const css = source('../public/v13190.css'), build = source('./build-assets.mjs');
  const passSrc = ui.slice(ui.indexOf('function deepPass()'), ui.indexOf('function deepPass()') + 700).split('\n}')[0];
  const ambSrc = ui.slice(ui.indexOf('function deepAmbience(t)'), ui.indexOf('function deepAmbience(t)') + 600).split('\n}')[0];
  assert(passSrc.includes("if (R.phase !== 'wait' || R.spot !== 'deep') return;") && !/fight|live|size|rarity/.test(passSrc.replace("R.phase !== 'wait'", '')) && passSrc.includes('rnd(DEEP_FX.PASS.SIZE)')
    && ui.includes("if (R.spot === 'deep' && Math.random() < DEEP_FX.PASS.CHANCE) later(deepPass,") && ambSrc.includes("if (R.spot !== 'deep') { if (R.hum) stopHum(); return; }")
    && ui.includes('stopStrain(); stopHum();') && ui.includes('${plankton()}') && DEEP_FX.PLANKTON <= 30 && DEEP_FX.PLANKTON_LOW < DEEP_FX.PLANKTON && lowEndDevice({ hardwareConcurrency: 4 }) && !lowEndDevice({ hardwareConcurrency: 8, deviceMemory: 8 })
    && css.includes('.rl-pov[data-spot="deep"] .rl-deep{') && css.includes('.rl-pov[data-spot="deep"]{background:#020617}') && SOUND_LOOP['deep-hum'] === DEEP_FX.HUM_LOOP && source('../docs/sound/feel-synth.mjs').includes('const HUM = 1.2;'),
    'V13.190 깊은 바다에서만: 더 어두운 물속 · 빛줄기 · 발광 플랑크톤(저사양 폰은 적게, 30개 이하) · 낮은 울림(1.2초 반복) · 물방울 · 입질 직전 큰 그림자(크기는 무작위, 물고기 정보는 쓰지 않는다). 바닷가로 가거나 나가면 울림이 꺼진다');

  // ── 소리 · 성능 · 접근성 ──
  const synth = source('../docs/sound/feel-synth.mjs');
  const newBytes = FEEL_SFX.reduce((s, k) => s + (existsSync(pub(`assets/sfx/${k}.mp3`)) ? statSync(pub(`assets/sfx/${k}.mp3`)).size : 1e9), 0);
  assert(FEEL_SFX.length === 14 && FEEL_SFX.every(k => SOUND_KEYS.includes(k) && synth.includes(`def('${k}'`)) && newBytes <= 160 * 1024 && ui.includes('...FEEL_SFX, ...REEL_SFX]')
    && Object.values(FEEL_STYLES).every(s => Object.values(s.ev || {}).every(([k]) => SOUND_KEYS.includes(k))),
    `V13.190 새 효과음 14개는 docs/sound/feel-synth.mjs로 다시 만들 수 있고, 합쳐서 160KB 이하(지금 ${Math.round(newBytes / 1024)}KB), 낚시터에 들어갈 때 미리 받는다`);
  const fightSrc = ui.slice(ui.indexOf('function fightStep(t, dt)'), ui.indexOf('function useSkill()'));
  assert(!/querySelectorAll|innerHTML|createElement/.test(fightSrc) && fightSrc.includes('const P = feelPath(R.style, t, m?.kind || \'\', R.fs)') && fightSrc.includes('rotate(${(reduced() ? 0 : P.rot).toFixed(1)}deg)')
    && css.includes('@media (prefers-reduced-motion:reduce)') && /prefers-reduced-motion:reduce\)\{[\s\S]*\.rl-plankton b\{animation:none/.test(css) && !/left:|top:|width:|height:/.test(css.slice(css.indexOf('@keyframes rl-plank'), css.indexOf('.rl-depth{'))),
    'V13.190 파이팅 루프에는 가벼운 계산만 더하고(매 프레임 요소를 새로 만들지 않음, 몸부림 순간에만 작은 효과), 효과는 transform · opacity 애니메이션, 동작 줄이기면 흔들림 · 떠오름을 멈춘다');
  const list = [...build.matchAll(/"([^"]+\.css)"/g)].map(m => m[1]);
  assert(list.includes('v13190.css') && list.indexOf('v13190.css') > list.indexOf('v13154.css') && list.at(-1) === 'v13178.css' && existsSync(pub('v13190.css')),
    'V13.190 손맛 CSS는 번들에 들어가고(낚시 CSS 뒤), 민트 목록 CSS가 맨 끝');
  // 진동 없음(아이폰) · 소리 꺼짐에서도: 몸부림 순간 화면 흔들림(KICK)이 있고, 진동 · 소리는 설정을 따른다.
  assert(['turn', 'ink', 'glide', 'lure', 'strike', 'jet', 'flap', 'trophy', 'pass'].every(k => new RegExp(`\\b${k}: [\\d.]+[,}]`).test(ui.match(/const KICK = \{[^}]*\}/)?.[0] || '')) && ui.includes('const vibScale = p =>') && ui.includes("if (!soundOn()) return;\n    try { navigator.vibrate(p);"),
    'V13.190 아이폰(진동 없음)은 몸부림 · 월척 · 큰 그림자 순간 화면을 흔들어 대신하고, 안드로이드 진동은 소리 설정을 따른다');
}
