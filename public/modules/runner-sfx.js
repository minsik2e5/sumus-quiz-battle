// 펫 대행진(크라우드 러너) 소리 표. 본보기: 펫 아레나 소리 표(arena-sfx.js).
//   소리 파일: public/assets/sfx/rn-*.mp3 16개. docs/sound/runner-synth.mjs로 녹음 없이 합성했다.
//   연결: 게임 그리기는 사건 이름만 부른다 → runnerSound('gate-good') · runnerSound('shoot', { crowd: 무리 수 }) · runnerSound('star', { i: 0~2 }).
//   표(사건 → 소리)만 고치면 소리가 바뀐다. 소리를 끄면(야차전 소리 설정) 아무것도 안 한다.
//   겹침 제한: 같은 소리 파일은 0.05초에 한 번까지만. 사격은 무리가 클수록 더 드물게(0.06 → 0.09 → 0.13초) · 조금 작게,
//   큰 소리(바위 깨짐 · 구출 · 성 무너짐 · 출발)가 울린 뒤 0.15초 동안은 사격 · 맞음 소리를 쉰다.
//   미리 받기: 펫 대행진에 들어갈 때만 preloadRunnerSound()를 부른다. 첫 로딩 · 서비스 워커 미리 받기에는 넣지 않는다.
import { playSound, preloadSound, soundOn } from './sound.js';

// 사건 → 겹쳐 낼 소리 [파일 key, 옵션(rate · gain · at · vary)]. 옵션은 부르는 쪽 옵션과 합친다(부르는 쪽이 이긴다).
export const RUNNER_SFX = {
  'gate-good': [['rn-gate-good']],              // 좋은 문(+ · ×): 반짝 상승
  'gate-bad': [['rn-gate-bad']],                // 나쁜 문(− · ÷): 뿅 하강
  multiply: [['rn-multiply']],                  // ×문: 와르르 불어남
  shoot: [['rn-shoot', { vary: .06 }]],         // 연사(되풀이 OK, 높낮이를 조금씩 흔든다)
  'rock-hit': [['rn-rock-hit', { vary: .05 }]],
  'rock-break': [['rn-rock-break']],            // 깨짐 + 파편
  saw: [['rn-saw']],                            // 톱날 위잉
  hammer: [['rn-hammer']],                      // 쿵
  rescue: [['rn-rescue']],                      // 펫 구출 팡파르
  card: [['rn-card']],                          // 카드 등장(고를 때 { pick: true } → 한 단계 높게)
  cannon: [['rn-cannon', { vary: .04 }]],       // 대포 연사
  'castle-hit': [['rn-castle-hit', { vary: .06 }]],
  'castle-fall': [['rn-castle-fall']],          // 성 무너짐(크게)
  star: [['rn-star']],                          // 별 1~3({ i: 0 · 1 · 2 } → 한 음씩 높게)
  fail: [['rn-fail']],                          // 아깝게 짐(너무 우울하지 않게 끝음이 올라감)
  start: [['rn-start']]                         // 출발 카운트: 삑 · 삑 · 삑 → START_GO초에 출발!
};
export const START_GO = 1.5; // rn-start 안에서 "출발!"이 나는 때(초): 부르는 쪽이 출발 연출을 여기에 맞춘다
export const RUNNER_SFX_KEYS = [...new Set(Object.values(RUNNER_SFX).flat().map(([key]) => key))];
export const SAME_SOUND_GAP_MS = 50;
export const BIG_HUSH_MS = 150;
const BIG = new Set(['rock-break', 'rescue', 'castle-fall', 'start']);
const HUSHED = new Set(['shoot', 'rock-hit', 'castle-hit']);
const STEP = [1, 2 ** (2 / 12), 2 ** (4 / 12)]; // 별 1 · 2 · 3: 도 · 레 · 미처럼 한 음씩

// 사격 간격(ms): 무리가 클수록 정령이 많이 쏘지만 소리는 오히려 드물게 낸다(귀가 덜 피곤하고 오디오가 가볍다).
export const shootGap = (crowd = 0) => crowd > 150 ? 130 : crowd > 50 ? 90 : 60;
export const shootGain = (crowd = 0) => crowd > 150 ? .7 : crowd > 50 ? .85 : 1;

const lastAt = new Map();
let bigAt = -1e9;
// 펫 대행진에 들어갈 때 한 번 부른다(첫 화면 로딩에는 받지 않는다).
export function preloadRunnerSound() { preloadSound(RUNNER_SFX_KEYS); }
// 사건 하나의 소리를 낸다. 낸 소리 수를 돌려준다(막히면 0).
export function runnerSound(event, opts = {}) {
  const list = RUNNER_SFX[event]; if (!list || !soundOn()) return 0;
  const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
  if (HUSHED.has(event) && now - bigAt < BIG_HUSH_MS) return 0;
  const { crowd, pick, i, ...rest } = opts;
  const gap = event === 'shoot' ? shootGap(crowd) : SAME_SOUND_GAP_MS;
  const more = {};
  if (event === 'shoot') more.gain = shootGain(crowd);
  if (event === 'card' && pick) Object.assign(more, { rate: 1.26, gain: .9 });
  if (event === 'star') more.rate = STEP[Math.max(0, Math.min(2, i | 0))];
  let n = 0;
  for (const [key, base] of list) {
    if (now - (lastAt.get(key) ?? -1e9) < gap) continue;
    lastAt.set(key, now);
    if (playSound(key, { ...base, ...more, ...rest })) n++;
  }
  if (n && BIG.has(event)) bigAt = now;
  return n;
}
