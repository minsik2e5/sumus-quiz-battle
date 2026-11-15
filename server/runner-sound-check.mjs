// 검사: 펫 대행진(크라우드 러너) 효과음. 본보기는 펫 아레나 소리 검사(arena-sound-check.mjs).
//   소리 16개(rn-*.mp3)는 docs/sound/runner-synth.mjs로 다시 만들 수 있고, 사건 → 소리 표(runner-sfx.js) 하나로 게임에 이어진다.
//   같은 소리는 0.05초에 한 번, 사격은 무리가 클수록 드물게, 소리 끄면 아무것도 안 함, 미리 받기는 펫 대행진에 들어갈 때만.
import { readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { SOUND_GAIN, SOUND_KEYS } from '../public/modules/sound.js';

const here = path => fileURLToPath(new URL(path, import.meta.url));
const source = path => readFileSync(here(path), 'utf8');

export async function runRunnerSoundChecks(assert) {
  const { RUNNER_SFX, RUNNER_SFX_KEYS, SAME_SOUND_GAP_MS, BIG_HUSH_MS, START_GO, shootGap, shootGain } = await import('../public/modules/runner-sfx.js');
  const synth = source('../docs/sound/runner-synth.mjs');
  // ①단계가 부르는 사건 이름 16개 그대로
  const events = ['gate-good', 'gate-bad', 'multiply', 'shoot', 'rock-hit', 'rock-break', 'saw', 'hammer', 'rescue', 'card', 'cannon', 'castle-hit', 'castle-fall', 'star', 'fail', 'start'];
  assert(events.every(e => RUNNER_SFX[e]) && Object.keys(RUNNER_SFX).length === 16 && RUNNER_SFX_KEYS.length === 16 && events.every(e => RUNNER_SFX_KEYS.includes(`rn-${e}`)), '펫 대행진 소리: 사건 16개(좋은 문 · 나쁜 문 · ×문 · 사격 · 바위 맞음 · 바위 깨짐 · 톱날 · 망치 · 구출 · 카드 · 대포 · 성 맞음 · 성 무너짐 · 별 · 짐 · 출발)마다 rn-<사건>.mp3 하나');
  assert(RUNNER_SFX_KEYS.every(k => SOUND_KEYS.includes(k) && SOUND_GAIN[k] > 0 && SOUND_GAIN[k] <= 1 && synth.includes(`def('${k}'`)), '펫 대행진 소리마다 기본 음량이 있고 docs/sound/runner-synth.mjs로 다시 만들 수 있다(녹음 없음)');
  const size = k => statSync(here(`../public/assets/sfx/${k}.mp3`)).size;
  const total = RUNNER_SFX_KEYS.reduce((a, k) => a + size(k), 0);
  assert(RUNNER_SFX_KEYS.every(k => size(k) > 800 && size(k) <= 40 * 1024) && total <= 300 * 1024, `펫 대행진 소리는 하나에 40KB, 합쳐 300KB 이하다(지금 ${Math.round(total / 1024)}KB)`);
  assert(/def\('rn-start'[\s\S]{0,400}, 1\.5\)/.test(synth) && START_GO === 1.5, '출발 카운트: 삑 · 삑 · 삑 뒤 1.5초에 "출발!"(부르는 쪽이 START_GO에 맞춘다)');

  // 겹침 제한 · 소리 끔 · 사격 밀도
  const table = source('../public/modules/runner-sfx.js');
  assert(SAME_SOUND_GAP_MS === 50 && table.includes('if (now - (lastAt.get(key) ?? -1e9) < gap) continue;') && table.includes('if (!list || !soundOn()) return 0;'), '같은 소리 파일은 0.05초에 한 번까지만 내고, 소리를 끄면(야차전 소리 설정) 아무것도 안 한다');
  assert(shootGap(10) === 60 && shootGap(100) === 90 && shootGap(300) === 130 && shootGain(300) < shootGain(10) && table.includes("const gap = event === 'shoot' ? shootGap(crowd) : SAME_SOUND_GAP_MS;"), '사격 소리는 무리가 클수록 드물게(0.06 → 0.09 → 0.13초) · 조금 작게 낸다');
  assert(BIG_HUSH_MS === 150 && table.includes('if (HUSHED.has(event) && now - bigAt < BIG_HUSH_MS) return 0;'), '큰 소리(바위 깨짐 · 구출 · 성 무너짐 · 출발) 뒤 0.15초는 사격 · 맞음 소리를 쉰다');

  // 미리 받기는 펫 대행진에 들어갈 때만(첫 로딩 · 서비스 워커 영향 없음)
  const sound = source('../public/modules/sound.js'), sw = source('../public/sw.js'), app = source('../public/app.js');
  assert(table.includes('export function preloadRunnerSound() { preloadSound(RUNNER_SFX_KEYS); }') && !/const CORE = \[[^\]]*rn-/.test(sound) && !/rn-[a-z-]+\.mp3/.test(sw) && !/rn-(gate|shoot|castle|rescue)/.test(app) && !app.includes('runner-sfx'), '펫 대행진 소리는 들어갈 때 받고, 첫 터치 CORE · 서비스 워커 · 첫 화면 코드에는 없다');

  // 시험 페이지: 같은 사건에서 이 소리를 부른다
  const proto = source('../public/proto/runner-fx.js'), html = source('../public/proto/runner-fx.html');
  assert(/from '\/modules\/runner-sfx\.js\?v=[\w.]+'/.test(proto) && html.includes('/proto/runner-fx.js?v=1.1') && proto.includes("const PROTO_V = '1.1';"), '러너 시험 페이지가 소리 표를 불러오고 판(?v=)을 올렸다');
  for (const [ev, why] of [['shoot', '사격'], ['rock-break', '바위 깨짐'], ['saw', '톱날'], ['multiply', '×문'], ['gate-good', '좋은 문'], ['gate-bad', '나쁜 문'], ['card', '카드'], ['rescue', '구출'], ['cannon', '대포'], ['castle-hit', '성 맞음'], ['castle-fall', '성 무너짐'], ['star', '별'], ['fail', '짐'], ['start', '출발']])
    assert(proto.includes(`'${ev}'`) && /rs\(/.test(proto), `러너 시험 페이지: ${why}에 새 소리가 난다`);
  assert(proto.includes("rs('shoot', { crowd: S0.n })") && proto.includes("rs('star', { i })") && proto.includes("rs('card', { pick: true })"), '시험 페이지: 사격은 무리 수를 넘겨 밀도를 줄이고, 별은 한 음씩 높게, 카드 고름은 높게');
}
