// Release checks for the V13.116 sound files (public/assets/sfx + public/modules/sound.js).
// Every key has a small mp3, every place that made a tone plays the file first and keeps the tone
// as the fallback, and the service worker keeps the files with the deploy that brought them.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { SOUND_GAIN, SOUND_KEYS } from '../public/modules/sound.js';

const here = path => fileURLToPath(new URL(path, import.meta.url));
const read = path => readFileSync(here(path), 'utf8');

export function runSoundChecks(assert) {
  const dir = '../public/assets/sfx/';
  const files = readdirSync(here(dir)).filter(name => name.endsWith('.mp3'));
  const sizes = Object.fromEntries(files.map(name => [name.slice(0, -4), statSync(here(dir + name)).size]));
  assert(SOUND_KEYS.length === 26 && SOUND_KEYS.every(key => sizes[key] > 0) && files.length === SOUND_KEYS.length, 'V13.116 효과음 26개(key마다 public/assets/sfx/<key>.mp3 하나)가 있고 남는 파일이 없다');
  const mp3 = name => { const b = readFileSync(here(dir + name + '.mp3')); return (b[0] === 0x49 && b[1] === 0x44 && b[2] === 0x33) || (b[0] === 0xff && (b[1] & 0xe0) === 0xe0); };
  const total = Object.values(sizes).reduce((a, b) => a + b, 0);
  assert(SOUND_KEYS.every(mp3) && SOUND_KEYS.every(key => sizes[key] <= 200 * 1024) && total <= 1.2 * 1024 * 1024, `V13.116 효과음은 모두 mp3이고 하나에 200KB, 합쳐서 1.2MB 이하다 (지금 ${Math.round(total / 1024)}KB)`);
  assert(SOUND_KEYS.every(key => SOUND_GAIN[key] > 0 && SOUND_GAIN[key] <= 1), 'V13.116 효과음마다 기본 음량(0~1)이 있다');

  const sound = read('../public/modules/sound.js');
  assert(sound.includes("localStorage.getItem(PREF) ?? 'on'") && sound.includes("PREF = 'sumus-yacha-sound'") && sound.includes('always = false') && sound.includes('if (!always && !soundOn()) return false;'), 'V13.116 효과음은 야차전 소리 설정을 따르고, 자기 설정이 있는 화면은 always로 부른다');
  assert(sound.includes("document.addEventListener(type, unlockSound") && sound.includes("ctx.resume?.()") && sound.includes('decodeAudioData(data, ok, no)') && sound.includes('MAX_VOICES'), 'V13.116 효과음은 터치마다 소리를 깨우고(iOS), 옛 사파리 디코딩과 동시 재생 상한을 지킨다');
  assert(/if \(!c \|\| !b \|\| c\.state !== 'running'\) \{ load\(key\); return false; \}/.test(sound), 'V13.116 받지 못한 소리는 false를 돌려줘 부른 쪽이 예전 신호음을 낸다');

  const battle = read('../public/modules/battle.js'), lucky = read('../public/modules/lucky.js'), moments = read('../public/modules/pet-moments.js'), sessions = read('../public/modules/sessions.js');
  assert(battle.includes("from './sound.js'") && battle.includes('if (file && playSound(...file))') && battle.includes("crit: ['smash']") && battle.includes("win: ['clear']") && battle.includes("lose: ['fail']") && battle.includes('o.connect(g); g.connect(audio.destination)'), 'V13.116 야차전·몬스터전: 정답 타격·크리티컬·승패가 소리 파일을 먼저 내고 예전 신호음을 대신으로 둔다');
  assert(battle.includes("playSound('correct', { rate: 2 ** (Math.min(Math.max(n - 2, 0), 6) / 6)") && battle.includes("playSound('smash', { rate: .8, gain: 1.1 })"), 'V13.116 콤보는 같은 정답 소리가 단계마다 높아지고(최대 한 옥타브), KO는 큰 타격 + 터짐이다');
  assert(lucky.includes("from './sound.js'") && lucky.includes("epic: () => { snd('fanfare-epic'") && lucky.includes("fanfare: () => snd('fanfare-legend'") && lucky.includes("rumble: () => { snd('boss', { dur: 1.5 }") && /epicShow[\s\S]{0,4000}SFX\.epic\(\)/.test(lucky) && (lucky.match(/preloadSound\(/g) || []).length === 4, 'V13.116 뽑기: 영웅·전설(V13.118: 신화) 연출과 코인 뽑기가 소리 파일을 쓰고, 연출이 시작될 때 필요한 소리를 미리 받는다');
  assert(moments.includes("playSound('wiggle', { rate: 1 + taps * .12") && moments.includes("playSound('pop'); playSound('fanfare-basic'") && moments.includes("playSound('levelup', { at: .2 })"), 'V13.116 알 부화(두드릴 때마다 높아지는 소리·금 가는 소리·팡파르)와 진화 장면에 소리가 있다');
  assert(sessions.includes("playSound(ok ? (milestone ? 'combo' : 'correct') : 'wrong', { always: true") && sessions.includes('if (A.sound) sound('), 'V13.116 학습 화면 정답·오답 소리는 학습 화면 자기 소리 설정(A.sound)을 따른다');

  const build = read('build-assets.mjs');
  assert(build.includes('webmanifest|mp3)$/') && build.includes('assets\\/.+\\.(?:webp|mp3))$/'), 'V13.116 효과음 파일도 배포 해시에 들어가고(바뀌면 설치된 앱이 새로 받음), 처음 쓸 때 받아 둔다');
  const doc = read('../docs/sound-library.md');
  assert(SOUND_KEYS.every(key => doc.includes(`\`${key}\``)) && doc.includes('CC0') && doc.includes('Mixkit'), 'V13.116 docs/sound-library.md에 효과음 26개의 출처와 라이선스가 있다');
}
