import { FISH, FISH_KEYS } from './fishing-rules.js';
import { FISH_READY } from './fish-art.js';

// V13.190 낚시 손맛 더하기(docs/fishing-feel-design.md). 화면(reel.js)과 서버(server/reel.mjs)가 같이 쓰는 규칙 · 숫자.
//   ① 물고기마다 다른 몸부림(FEEL_STYLES): 기존 4가지 행동(mash · rhythm · thrash · dive) 위에 얹는 겉모습 · 소리 · 진동 · 움직임.
//      판정 숫자(FIGHT · 최소 파이팅 시간 · 진주)는 그대로. 행동 가중치는 '기울기'(leanOf)만 조금 더하고, 같은 등급 물고기끼리 합하면 0이라
//      등급 평균 행동 비율(= 평균 난이도)은 바닷가 · 깊은 바다 모두 원래와 똑같다.
//   ② 낚싯대 단계별 감촉(ROD_FEEL): 휘는 정도 · 용수철 · 릴 소리 · 진동 세기 · 줄 풀림 · 끊김 소리. 능력치(ROD.LEVELS)와 모양(ROD_LOOK)은 그대로.
//   ③ 월척(trophyOf): 전설이거나, 보통 이상에서 그 물고기 무게 범위 상위 15%. 신기록이면 NEW RECORD 도장(따로).
//   ④ 깊은 바다 분위기(DEEP_FX): 어두운 배경 · 발광 플랑크톤 · 낮은 울림 · 물방울 · 입질 직전 큰 그림자(물고기와 상관없는 무작위 크기).
// 이 파일은 브라우저 기능을 쓰지 않는다(서버 검사가 부른다).

export const FEEL_MOVES = ['mash', 'rhythm', 'thrash', 'dive'];
// 몸부림 13가지. sig: 조금 더 자주 나오는 행동(leanOf), sil: 파이팅 그림자 실루엣(fishShadow 모양), pitch: 돌진 · 점프 · 물보라 소리 높낮이,
//   splash: 물보라 크기, kick: 아이폰 화면 흔들림 배율, mash: 탈출 연타 때 좌우 폭 · 주기(ms), haptic: 진동 패턴(기본 HAPTIC 위에 덮어씀), ev: 몸부림 순간 소리.
export const FEEL_STYLES = {
  quiver: { ko: '파르르 잔떨림', sig: 'rhythm', sil: 'sardine', pitch: 1.25, splash: .7, kick: .8, mash: [.22, 110], haptic: { run: [60, 20, 60, 20, 60, 20, 60, 20, 60], thrash: [12, 18, 12, 18, 12, 18, 12, 18, 12] } },
  sway: { ko: '묵직하게 좌우', sig: 'dive', sil: 'carp', pitch: .82, splash: 1.05, kick: 1.1, mash: [.26, 240], haptic: { run: [320, 60, 240], dive: [520, 80, 320], thrash: [60, 40, 60] } },
  zip: { ko: '쌩쌩 직진', sig: 'mash', sil: 'mackerel', pitch: 1.12, splash: .85, kick: .9, mash: [.32, 130], haptic: { run: [140, 20, 140, 20, 140] } },
  snake: { ko: '뱀처럼 휘기', sig: 'rhythm', sil: 'catfish', pitch: 1, splash: .9, kick: 1, mash: [.28, 200], haptic: { run: [80, 40, 120, 40, 160, 40, 120, 40, 80], thrash: [40, 40, 70, 40, 40] } },
  flutter: { ko: '바닥에서 퍼덕', sig: 'thrash', sil: 'flounder', pitch: 1.08, splash: .95, kick: 1, mash: [.2, 170], haptic: { thrash: [20, 30, 20, 30, 60], flap: [25, 20, 25] }, ev: { flap: ['reel-nibble', .7, .7] } },
  bob: { ko: '둥실둥실 뒤뚱', sig: 'dive', sil: 'puffer', pitch: .78, splash: 1.1, kick: 1.05, mash: [.18, 260], haptic: { dive: [200, 120, 200, 120, 200], run: [180, 90, 180] } },
  slash: { ko: '칼처럼 휘두르기', sig: 'thrash', sil: 'swordfish', pitch: .95, splash: 1.2, kick: 1.2, mash: [.34, 150], haptic: { thrash: [90, 30, 90], run: [220, 30, 220] } },
  jet: { ko: '툭툭 분사', sig: 'mash', sil: 'squid', pitch: 1.15, splash: .8, kick: .9, mash: [.3, 180], haptic: { jet: [30, 15, 70] }, ev: { jet: ['fish-ink', 1.5, .35] } },
  // 5종 대표 몸부림(참치 · 대왕오징어 · 가오리 · 아귀 · 상어)
  rush: { ko: '긴 직선 돌진 · 한 번 꺾기', sig: 'mash', sil: 'tuna', pitch: .9, splash: 1.3, kick: 1.25, mash: [.38, 0], haptic: { run: [600, 40, 120], turn: [90, 30, 160] }, ev: { turn: ['fish-turn', 1, 1] } },
  ink: { ko: '먹물 뿜고 잠수', sig: 'dive', sil: 'squid', pitch: .85, splash: 1.15, kick: 1.15, mash: [.3, 200], haptic: { dive: [700, 60, 200], ink: [40, 30, 40, 30, 260], jet: [30, 15, 70] }, ev: { ink: ['fish-ink', 1, 1], jet: ['fish-ink', 1.5, .3] } },
  glide: { ko: '좌우로 넓게 미끄러지기', sig: 'rhythm', sil: 'ray', pitch: .9, splash: 1.1, kick: 1, mash: [.4, 320], haptic: { glide: [120, 80, 60], run: [300, 60, 300] }, ev: { glide: ['fish-glide', 1, .8] } },
  lure: { ko: '발광 미끼 흔들기', sig: 'rhythm', sil: 'anglerfish', pitch: .8, splash: 1, kick: 1, mash: [.2, 220], haptic: { lure: [8, 90, 8, 90, 8] }, ev: { lure: ['fish-lure', 1, .55] } },
  strike: { ko: '세게 치고 빠지기', sig: 'thrash', sil: 'shark', pitch: .75, splash: 1.35, kick: 1.35, mash: [.34, 170], haptic: { strike: [180, 20, 40], thrash: [120, 30, 60, 30, 120] }, ev: { strike: ['fish-thump', 1, 1] } }
};
// 5종은 대표 몸부림, 나머지는 몸 모양(fishing-art body)마다 기본 몸부림 하나.
export const SPECIES_FEEL = { tuna: 'rush', squid: 'ink', ray: 'glide', anglerfish: 'lure', shark: 'strike' };
export const BODY_FEEL = { slim: 'quiver', round: 'sway', torpedo: 'zip', needle: 'snake', long: 'snake', flat: 'flutter', ball: 'bob', moon: 'bob', ray: 'glide', sword: 'slash', shark: 'strike', squid: 'jet' };
export const feelOf = key => SPECIES_FEEL[key] || BODY_FEEL[FISH[key]?.art?.body] || 'sway';

// 같은 등급에서 같이 굴려지는 물고기(reelRoll과 같은 규칙): 깊은 바다의 희귀 이상은 그림이 있는 심해 물고기, 나머지는 바닷가 물고기.
export function poolOf(key, deep = false, ready = FISH_READY) {
  const rarity = FISH[key]?.rarity;
  if (!rarity) return [];
  if (rarity === 'golden') return ['goldenegg'];
  const sea = deep ? Object.keys(FISH).filter(k => FISH[k].deep && ready.has(k) && FISH[k].rarity === rarity) : [];
  return sea.length ? sea : FISH_KEYS.filter(k => FISH[k].rarity === rarity);
}
// 행동 가중치 기울기: 자기 몸부림의 행동(sig)에 +1, 같은 판(pool) 물고기들의 평균만큼 뺀다.
//   한 물고기의 가중치 합은 그대로(기울기 합 0), 같은 판 물고기 기울기를 모두 더하면 행동마다 0 → 등급 평균 행동 비율이 원래와 같다.
export const LEAN = 1;
export function leanOf(key, deep = false, ready = FISH_READY) {
  const pool = poolOf(key, deep, ready);
  if (pool.length < 2) return {};
  const mean = Object.fromEntries(FEEL_MOVES.map(m => [m, pool.filter(k => FEEL_STYLES[feelOf(k)].sig === m).length / pool.length]));
  const sig = FEEL_STYLES[feelOf(key)].sig, out = {};
  for (const m of FEEL_MOVES) { const v = LEAN * ((m === sig ? 1 : 0) - mean[m]); if (Math.abs(v) > 1e-9) out[m] = Math.round(v * 1e6) / 1e6; }
  return out;
}
// 화면이 쓰는 행동 가중치(서버가 보낸 moves + lean). 0 밑으로는 내려가지 않는다.
export const leanMoves = (moves, lean = {}) => Object.fromEntries(Object.entries(moves || { mash: 1 }).map(([k, w]) => [k, Math.max(0, w + Number(lean?.[k] || 0))]));

// 파이팅 그림자 움직임(매 프레임, 가벼운 계산만). t: ms, kind: 지금 행동('' = 쉬는 중), st: 파이팅마다 새 상태 객체, r: 0~1 난수 함수.
// 돌려주는 것: x(화면 가운데에서 폭 비율, -.4~.4) · y(px) · rot(도) · follow(따라가는 빠르기) · ev(몸부림 순간: 소리 · 진동 · 효과).
export function feelPath(style, t, kind, st, r = Math.random) {
  const S = Math.sin, C = Math.cos, F = FEEL_STYLES[style] || FEEL_STYLES.sway;
  let ev = '';
  if (kind === 'mash' && style !== 'rush') {
    const [a, p] = F.mash;
    return { x: a * S(t / p), y: 2 * S(t / 70), rot: 10 * C(t / p), follow: 6, ev };
  }
  if (style !== 'rush') st.run = null;
  switch (style) {
    case 'quiver': return { x: .18 * S(t / 1100) + .03 * S(t / 47), y: 1.5 * S(t / 61), rot: 5 * S(t / 53), follow: 4, ev };
    case 'zip': case 'rush': {
      if (style === 'rush' && kind === 'mash') {
        // 참치: 한쪽으로 길게 곧장 내달리다가 중간에 딱 한 번 방향을 꺾는다.
        if (!st.run) { st.dir = -(st.dir || 1); st.run = { dir: st.dir, t0: t, turned: false }; }
        if (!st.run.turned && t - st.run.t0 > 1300) { st.run.turned = true; st.run.dir *= -1; ev = 'turn'; }
        return { x: st.run.dir * .38, y: 0, rot: st.run.dir * 4, follow: st.run.turned && t - st.run.t0 < 1700 ? 4.5 : 2.2, ev };
      }
      st.run = null;
      const len = style === 'rush' ? 2400 : 1300, seg = Math.floor(t / len);
      if (seg !== st.seg) { st.seg = seg; st.tx = (r() < .5 ? -1 : 1) * (style === 'rush' ? .26 : .16 + r() * .14); }
      return { x: st.tx || 0, y: S(t / 300), rot: 0, follow: style === 'rush' ? 1.3 : 3.2, ev };
    }
    case 'snake': return { x: .22 * S(t / 900), y: 6 * S(t / 450), rot: 14 * S(t / 450 + .8), follow: 1.6, ev };
    case 'flutter': {
      const ph = (t % 1700) / 1700, hop = ph < .15 ? S(ph / .15 * Math.PI) : 0, seg = Math.floor(t / 1700);
      if (seg !== st.seg) { st.seg = seg; ev = 'flap'; }
      return { x: .14 * S(t / 1300), y: -10 * hop, rot: hop * 14 * S(t / 40), follow: 1.2, ev };
    }
    case 'bob': return { x: .15 * S(t / 1900), y: 9 * S(t / 620), rot: 8 * S(t / 950), follow: .6, ev };
    case 'slash': return { x: .26 * Math.tanh(3 * S(t / 700)), y: 2 * S(t / 200), rot: 18 * C(t / 700), follow: 3, ev };
    case 'jet': case 'ink': {
      const ph = (t % 1200) / 1200, seg = Math.floor(t / 1200);
      if (seg !== st.seg) { st.seg = seg; st.tx = Math.max(-.32, Math.min(.32, (st.tx || 0) + (r() < .5 ? -1 : 1) * .16)); ev = 'jet'; }
      if (style === 'ink') { if (kind === 'dive' && !st.inked) { st.inked = true; ev = 'ink'; } else if (kind !== 'dive') st.inked = false; }
      return { x: st.tx || 0, y: ph < .15 ? -6 * S(ph / .15 * Math.PI) : 0, rot: 0, follow: ph < .15 ? 5 : .3, ev };
    }
    case 'glide': {
      const c = C(t / 1700), side = c >= 0 ? 1 : -1;
      if (st.side && side !== st.side) ev = 'glide';
      st.side = side;
      return { x: .36 * S(t / 1700), y: 2 * S(t / 800), rot: 16 * c, follow: 1.3, ev };
    }
    case 'lure': {
      const seg = Math.floor(t / 2600);
      if (seg !== st.seg) { st.seg = seg; ev = 'lure'; }
      return { x: .12 * S(t / 2100), y: 4 * S(t / 900), rot: 5 * S(t / 1300), follow: .5, ev };
    }
    case 'strike': {
      if (!st.next) st.next = t + 2600 + r() * 1600;
      if (t > st.next) { st.next = t + 2600 + r() * 1600; st.until = t + 380; st.tx = (r() < .5 ? -1 : 1) * .34; ev = 'strike'; }
      if (t < (st.until || 0)) return { x: st.tx, y: -4, rot: Math.sign(st.tx) * 12, follow: 9, ev };
      return { x: .2 * S(t / 1400), y: 2 * S(t / 700), rot: 4 * S(t / 1400), follow: .8, ev };
    }
    default: return { x: .24 * S(t / 1500), y: 3 * S(t / 700), rot: 6 * S(t / 1500 + 1.2), follow: .7, ev }; // sway
  }
}

// 낚싯대 단계별 감촉(1~5). bend: 휘는 정도 배율(rodGeom), spring: 용수철(k 단단함 · d 출렁임 잦아드는 빠르기),
//   click: 릴 소리 [소리, 높낮이, 크기], every: 딸깍 간격 배율, vib: 진동 세기 배율(안드로이드), kick: 화면 흔들림 배율(아이폰),
//   drag: 줄 풀리는 소리 [높낮이, 크기], snap: 끊어질 때 소리 [소리, 높낮이], shimmer: 감을 때 반짝이 소리 크기(0이면 없음).
export const ROD_FEEL = [
  { level: 1, ko: '가볍고 톡톡', bend: 1.18, spring: [215, 10], click: ['rod-tick', 1.25, .9], every: .9, vib: .7, kick: .8, drag: [1.35, .7], snap: ['reel-snap', 1.3], shimmer: 0 },
  { level: 2, ko: '맑게 딸깍', bend: 1.09, spring: [192, 11.5], click: ['rod-tick', 1, 1], every: .95, vib: .85, kick: .9, drag: [1.18, .8], snap: ['reel-snap', 1.12], shimmer: 0 },
  { level: 3, ko: '단단하게 찰칵', bend: 1, spring: [170, 13], click: ['reel-click', 1, 1], every: 1, vib: 1, kick: 1, drag: [1, .9], snap: ['reel-snap', 1], shimmer: 0 },
  { level: 4, ko: '묵직하게 드르륵 · 반짝', bend: .9, spring: [150, 14.5], click: ['rod-ratchet', 1.1, .95], every: 1.06, vib: 1.15, kick: 1.1, drag: [.9, 1], snap: ['rod-snap-heavy', 1.12], shimmer: .35 },
  { level: 5, ko: '아주 묵직하게 드르륵 · 반짝반짝', bend: .8, spring: [135, 16], click: ['rod-ratchet', .92, 1], every: 1.12, vib: 1.3, kick: 1.2, drag: [.8, 1], snap: ['rod-snap-heavy', .95], shimmer: .7 }
];
export const rodFeel = lv => ROD_FEEL[Math.max(1, Math.min(5, Math.floor(Number(lv) || 1))) - 1];

// 월척: 전설이거나, 보통 이상 물고기가 그 물고기 무게 범위의 상위 15%(퍼펙트 +8%를 곱한 뒤 무게). 황금 알 물고기는 아니다.
//   기준 빈도(검사가 다시 셈): 잡은 물고기의 약 9% · 미끼 하루 5개면 하루 평균 약 0.37번(주 2~3번).
// 신기록(record: 그 종의 내 최고 무게 갱신)은 NEW RECORD 도장 · 별(월척과 따로, 슬로모션 없이).
export const TROPHY = { TOP: .15, RARITIES: ['uncommon', 'rare', 'epic', 'legend'] };
export function trophyOf(res) {
  const f = FISH[res?.key];
  if (!res?.caught || !f || res.rarity === 'golden' || res.key === 'goldenegg') return { trophy: false, legend: false, record: !!res?.record, q: 0 };
  const [lo, hi] = f.kg, q = hi > lo ? (Number(res.kg) - lo) / (hi - lo) : 0;
  const legend = f.rarity === 'legend', big = TROPHY.RARITIES.includes(f.rarity) && q >= 1 - TROPHY.TOP - 1e-9;
  return { trophy: legend || big, legend, record: !!res.record, q: Math.round(q * 1000) / 1000 };
}
// 월척 연출 길이: 슬로모션 0.5초(동작 줄이기면 0, 번쩍 · 흔들림 없음).
export const TROPHY_FX = { SLOW_MS: 500, STARS: 14, STARS_LOW: 8 };

// 깊은 바다 분위기. 플랑크톤 수는 저사양(코어 4개 이하 · 메모리 3GB 이하)이면 적게. 모두 CSS 애니메이션(transform · opacity)이라 파이팅 루프에 일을 더하지 않는다.
//   PASS: 입질 직전 지나가는 큰 그림자. 크기는 물고기와 상관없이 무작위(SIZE 범위), 매번 나오지도 않는다(CHANCE). 어느 물고기인지 단서가 되지 않게.
export const DEEP_FX = { PLANKTON: 26, PLANKTON_LOW: 14, HUM: 'deep-hum', HUM_LOOP: 1.2, BUBBLE_MS: [3800, 7600], PASS: { CHANCE: .7, SIZE: [1.3, 2.1], MS: 2600, BEFORE: 1700 } };
export const lowEndDevice = (nav = typeof navigator !== 'undefined' ? navigator : {}) => (Number(nav.hardwareConcurrency) || 8) <= 4 || (Number(nav.deviceMemory) || 8) <= 3;

// 새 소리(docs/sound/feel-synth.mjs로 합성).
export const FEEL_SFX = ['fish-turn', 'fish-ink', 'fish-glide', 'fish-lure', 'fish-thump', 'rod-tick', 'rod-ratchet', 'rod-drag', 'rod-shimmer', 'rod-snap-heavy', 'trophy-boom', 'deep-hum', 'deep-bubble', 'deep-pass'];
// 검사용: 등급마다 원래 FIGHT 행동 비율.
export const moveShare = moves => { const T = Object.values(moves).reduce((a, b) => a + b, 0); return Object.fromEntries(FEEL_MOVES.map(m => [m, (moves[m] || 0) / T])); };
