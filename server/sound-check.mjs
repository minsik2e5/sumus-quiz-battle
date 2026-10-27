// Release checks for the V13.116 sound files (public/assets/sfx + public/modules/sound.js).
// Every key has a small mp3, every place that made a tone plays the file first and keeps the tone
// as the fallback, and the service worker keeps the files with the deploy that brought them.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { SOUND_GAIN, SOUND_KEYS, SOUND_LOOP } from '../public/modules/sound.js';

const here = path => fileURLToPath(new URL(path, import.meta.url));
const read = path => readFileSync(here(path), 'utf8');

export function runSoundChecks(assert) {
  const dir = '../public/assets/sfx/';
  const files = readdirSync(here(dir)).filter(name => name.endsWith('.mp3'));
  const sizes = Object.fromEntries(files.map(name => [name.slice(0, -4), statSync(here(dir + name)).size]));
  assert(SOUND_KEYS.length === 76 && SOUND_KEYS.every(key => sizes[key] > 0) && files.length === SOUND_KEYS.length, 'V13.116 효과음(V13.130: 던전 전투 23개를 더해 49개, V13.149 짝 맞추기 3개를 더해 52개, V13.164 낚시 13개를 더해 65개, V13.180 10초 맞추기 11개를 더해 76개, key마다 public/assets/sfx/<key>.mp3 하나)이 있고 남는 파일이 없다');
  const mp3 = name => { const b = readFileSync(here(dir + name + '.mp3')); return (b[0] === 0x49 && b[1] === 0x44 && b[2] === 0x33) || (b[0] === 0xff && (b[1] & 0xe0) === 0xe0); };
  const total = Object.values(sizes).reduce((a, b) => a + b, 0);
  assert(SOUND_KEYS.every(mp3) && SOUND_KEYS.every(key => sizes[key] <= 200 * 1024) && total <= 2.2 * 1024 * 1024, `V13.116 효과음은 모두 mp3이고 하나에 200KB, 합쳐서 2.2MB 이하다(V13.130: 1.2MB → 2MB, V13.180: 10초 맞추기 120KB를 더해 2.2MB, 처음 쓸 때만 받는다) (지금 ${Math.round(total / 1024)}KB)`);
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
  assert(SOUND_KEYS.every(key => doc.includes(`\`${key}\``)) && doc.includes('CC0') && doc.includes('Mixkit'), 'V13.116 docs/sound-library.md에 효과음 76개의 출처와 라이선스가 있다');

  /* ---------- V13.130 던전 전투 효과음 ---------- */
  const dungeon = read('../public/modules/dungeon.js'), synth = read('../docs/sound/battle-synth.mjs');
  const battleKeys = ['atk-star', 'atk-leaf', 'atk-wind', 'hit-star', 'hit-leaf', 'hit-wind', 'dmg-tick', 'crit', 'boss-charge', 'warn-beep', 'boss-slam', 'shield-block', 'ult-riser', 'ult-impact', 'boss-roar', 'type-key', 'type-ok', 'type-wrong', 'spell-done', 'faint', 'revive', 'combo-10', 'boss-down'];
  assert(battleKeys.every(key => SOUND_KEYS.includes(key) && synth.includes(`def('${key}'`)), 'V13.130 던전 전투 효과음 23개는 sound.js에 있고 docs/sound/battle-synth.mjs로 다시 만들 수 있다');
  assert(dungeon.includes("from './sound.js'") && ['dmg-tick', 'boss-slam', 'shield-block', 'ult-riser', 'ult-impact', 'boss-roar', 'boss-down', 'type-key', 'type-ok', 'type-wrong', 'spell-done', 'faint', 'revive', 'combo-10', 'boss-charge', 'warn-beep', 'crit'].every(key => dungeon.includes(`'${key}'`)) && dungeon.includes('sfx(`atk-${snd}`') && dungeon.includes('sfx(e.kind === \'spell\' ? \'crit\' : `hit-${snd}`') && dungeon.includes('preloadSound(SFX_BATTLE)'), 'V13.130 던전 전투: 펫 속성별 발사 · 맞힘, 피해 숫자 틱, 보스 채점 · 내려찍기 · 포효, 방패, 합동 필살, 쓰기 글자 칸, 기절 · 부활에 소리가 있고 들어갈 때 미리 받는다');

  /* ---------- V13.164 낚시 전용 효과음 · 진동 ---------- */
  const reel = read('../public/modules/reel.js'), reelSynth = read('../docs/sound/reel-synth.mjs');
  const reelKeys = ['reel-cast', 'reel-plop', 'reel-nibble', 'reel-bite', 'reel-hook', 'reel-click', 'reel-strain', 'reel-creak', 'reel-snap', 'reel-run', 'reel-jump', 'reel-splash', 'reel-sparkle'];
  assert(reelKeys.every(key => SOUND_KEYS.includes(key) && reelSynth.includes(`def('${key}'`) && reel.includes(`'${key}'`)) && reel.includes('preloadSound([') && reel.includes('...REEL_SFX]'), 'V13.164 낚시 효과음 13개(던지기 휙 · 퐁당 · 입질 톡톡 · 쑥 · 챔질 · 릴 딸깍 · 줄 텐션 · 끼익 · 줄 끊김 · 돌진 · 점프 첨벙 · 끌어올림 물보라 · 퍼펙트)는 sound.js에 있고 docs/sound/reel-synth.mjs로 다시 만들 수 있으며, 낚시터에 들어갈 때 미리 받는다');
  const borrowed = ['slash', 'crit', 'warn-beep', 'wiggle', 'hit', 'crack', 'ult-riser', 'ult-impact', 'boss-roar', 'boss-charge', 'shield-block', 'type-ok', 'type-wrong', 'type-key', 'burst'];
  const play = reel.slice(reel.indexOf('/* ---------- ① 던지기 ---------- */'), reel.indexOf('function result('));
  assert(play.length > 1000 && borrowed.every(key => !play.includes(`sfx('${key}'`)), 'V13.164 낚시 판(던지기 ~ 공개)은 야차전 · 던전 소리를 빌려 쓰지 않고 낚시 소리를 낸다');
  assert(SOUND_LOOP['reel-strain'] === .8 && reelSynth.includes('const LOOP = .8;') && sound.includes('src.loop = true; src.loopStart = period; src.loopEnd = period * 2;') && sound.includes('const want = soundOn() ? Math.max(0, Math.min(1, level)) : 0;'), 'V13.164 줄 텐션은 이어지는 소리: 파일 가운데 주기만 끊김 없이 되풀이하고(주기는 합성과 같다), 소리를 끄면 크기 0이다');
  assert(reel.includes("R.strain = loopSound('reel-strain')") && reel.includes('R.strain?.set(strain ** 1.4') && (reel.match(/stopStrain\(\)/g) || []).length >= 4 && reel.includes('R.timers.forEach(clearTimeout); cancelAnimationFrame(R.raf); stopStrain();'), 'V13.164 줄 텐션 소리는 파이팅을 시작하면 켜져 텐션만큼 크고 높아지고, 끊김 · 놓침 · 마무리 · 나가기에서 꺼진다');
  assert(reel.includes("f.reelV = f.holding ?") && reel.includes("t - f.clickAt > lerp(210, 55, speed)") && reel.includes("sfx('reel-click', { rate: .75 + speed * .35"), 'V13.164 릴 딸깍은 감는 속도만큼 잦고 높다');
  assert(reel.includes('const canBuzz = () =>') && reel.includes("if (!soundOn()) return;\n    try { navigator.vibrate(p);") && reel.includes('if (!canBuzz() || !soundOn() ||') && reel.includes("navigator.vibrate(zone === 'red' ? 95 : Math.round(lerp(4, 38, k ** 1.6)))"), 'V13.164 안드로이드 진동은 소리 설정을 따르고, 파이팅 중에는 텐션만큼 길고 잦다(빨간 칸은 거의 쉬지 않음)');
  assert(reel.includes('nibble: [9, 75, 6]') && reel.includes('hook: [150, 40, 70]') && reel.includes('run: [260, 30, 200, 30, 160, 30, 120]') && reel.includes("feel('nibble')") && reel.includes("feel(fast ? 'hookFast' : 'hook')") && reel.includes("feel('run')") && reel.includes("feel('dive')"), 'V13.164 진동: 입질은 짧게, 챔질은 묵직하게, 돌진 · 잠수는 길게');
  assert(reel.includes("} else if (KICK[kind]) R.kick =") && reel.includes('if (R.phase === \'fight\' && R.f && !canBuzz()) a += Math.max(0, R.f.tension - 55)') && reel.includes('if (reduced()) a = 0;') && reel.includes('  quake(t);') && reel.includes('const FEEL = () => canBuzz() ? 1 : 1.2;'), 'V13.164 진동이 없는 아이폰은 화면 흔들림(텐션이 높으면 떨림)과 조금 큰 손맛 소리로 대신하고, 동작 줄이기면 흔들지 않는다');
}
