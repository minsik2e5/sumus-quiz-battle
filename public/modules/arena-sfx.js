// V13.237 펫 아레나 새 소리 표(docs/arena-battle-reboot-plan.md 6-3 · docs/pet-arena-v2-plan.md 7장).
//   소리 파일: public/assets/sfx/ar-*.mp3 23개. docs/sound/arena-synth.mjs로 녹음 없이 합성했다.
//   연결: 전투 그리기(DOM이든 캔버스 arena-stage.js든)는 사건 이름만 부른다 → arenaSound('meteor', { at }) · arenaHitSound(e).
//   표(사건 → 소리)만 고치면 소리가 바뀐다. 같은 소리 파일은 0.05초에 한 번까지만 낸다(여러 마리가 한꺼번에 맞아도 겹쳐 터지지 않는다).
//   미리 받기: 펫 아레나에 들어갈 때(arena.js의 preloadSound)만. 첫 로딩에는 받지 않는다.
import { playSound, soundOn } from './sound.js';

// 사건 → 겹쳐 낼 소리 [파일 key, 옵션(rate · gain · at)]. 옵션은 부르는 쪽 옵션과 합친다(부르는 쪽이 이긴다).
export const ARENA_SFX = {
  // 맞힘 등급 5종(층 3개: 타격 · 속성 · 짧은 저음이 한 파일에 들어 있다).
  'hit-1': [['ar-hit-1']], 'hit-2': [['ar-hit-2']], 'hit-3': [['ar-hit-3']], 'hit-4': [['ar-hit-4']], 'hit-5': [['ar-hit-5']],
  crit: [['ar-crit']],
  hitstop: [['ar-hitstop']],
  // 필살 3단: 컷인 때 올라가는 소리(1.1초, 끝을 끊음) → 경기장이 멈춘 1.2초의 마지막 0.1초는 정적 → 터질 때 폭발.
  'ult-rise': [['ar-ult-rise']],
  'ult-blast': [['ar-ult-blast']],
  beam: [['ar-beam']],               // 광선 "웅-"(필살기 일직선)
  quake: [['ar-quake']],             // 지진 "쿵-우르르"(갈라진 땅)
  thunder: [['ar-thunder']],         // 번개 "찌직-쾅"(번개 사슬)
  // 스킬 ②(목록 14개)
  breath: [['ar-flame-breath']],
  meteor: [['ar-meteor']],           // 휘익 0.55초 뒤 쾅: 부르는 쪽이 at으로 떨어지는 때에 맞춘다(METEOR_HIT).
  jet: [['ar-water-jet']],
  bubblepop: [['ar-bubble-pop']],
  vine: [['ar-vine']],
  boulder: [['ar-rock-roll']],
  tornado: [['ar-tornado']],
  ice: [['ar-ice']],                 // 얼음 장판 · 얼음 창
  poison: [['ar-poison']],           // 독구름
  // 친구 대전 대기실
  invite: [['ar-invite']],
  ready: [['ar-ready']]
};
export const METEOR_HIT = .55; // ar-meteor 안에서 쾅이 나는 때(초)
export const ARENA_SFX_KEYS = [...new Set(Object.values(ARENA_SFX).flat().map(([key]) => key))];

const lastAt = new Map();
export const SAME_SOUND_GAP_MS = 50;
// 사건 하나의 소리를 낸다. 같은 파일은 0.05초에 한 번까지만. 낸 소리 수를 돌려준다.
export function arenaSound(event, opts = {}) {
  const list = ARENA_SFX[event]; if (!list || !soundOn()) return 0;
  const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
  let n = 0;
  for (const [key, base] of list) {
    if (now - (lastAt.get(key) ?? -1e9) < SAME_SOUND_GAP_MS) continue;
    lastAt.set(key, now);
    if (playSound(key, { ...base, ...opts })) n++;
  }
  return n;
}
// 맞는 순간의 등급(1~5): 1 스침 · 여러 번 맞는 스킬의 한 번 · 남끼리 친 것, 2 평타, 3 스킬, 4 강타(효과 굉장 · 치명타), 5 필살기.
export function hitGrade(e, near = true) {
  if (e.kind === 'ult') return 5;
  if (!near || e.tick) return 1;
  if (e.kind === 'atk') return e.crit ? 3 : 2;
  return e.crit || e.m > 1 ? 4 : 3;
}
// 맞는 순간 소리: 등급 소리 + (치명타) 치명타 소리 + (강타 · 필살) 히트스톱 퍽.
export function arenaHitSound(e, near = true) {
  const g = hitGrade(e, near);
  arenaSound(`hit-${g}`, { rate: g === 1 ? 1.1 : 1 });
  if (!near) return g;
  if (e.crit) arenaSound('crit');
  if (g >= 4) arenaSound('hitstop');
  return g;
}
