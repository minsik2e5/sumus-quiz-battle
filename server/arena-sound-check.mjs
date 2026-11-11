// V13.237 검사: 펫 아레나 새 소리(docs/arena-battle-reboot-plan.md 6-3 · docs/pet-arena-v2-plan.md 7장).
//   소리 23개(ar-*.mp3)는 docs/sound/arena-synth.mjs로 다시 만들 수 있고, 사건 → 소리 표(arena-sfx.js) 하나로 전투에 이어진다.
//   같은 소리는 0.05초에 한 번까지만, 미리 받기는 펫 아레나에 들어갈 때만(첫 로딩 영향 없음).
import { readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { SOUND_GAIN, SOUND_KEYS } from '../public/modules/sound.js';

const here = path => fileURLToPath(new URL(path, import.meta.url));
const source = path => readFileSync(here(path), 'utf8');

export async function runArenaSoundChecks(assert) {
  const { ARENA_SFX, ARENA_SFX_KEYS, METEOR_HIT, SAME_SOUND_GAP_MS, hitGrade } = await import('../public/modules/arena-sfx.js');
  const synth = source('../docs/sound/arena-synth.mjs');
  const list14 = ['ar-flame-breath', 'ar-meteor', 'ar-water-jet', 'ar-bubble-pop', 'ar-vine', 'ar-rock-roll', 'ar-tornado', 'ar-ice', 'ar-poison', 'ar-thunder', 'ar-crit', 'ar-hitstop', 'ar-invite', 'ar-ready'];
  const extra = ['ar-hit-1', 'ar-hit-2', 'ar-hit-3', 'ar-hit-4', 'ar-hit-5', 'ar-beam', 'ar-quake', 'ar-ult-rise', 'ar-ult-blast'];
  const all = [...list14, ...extra];
  assert(all.length === 23 && ARENA_SFX_KEYS.length === 23 && all.every(k => ARENA_SFX_KEYS.includes(k)), 'V13.237 펫 아레나 소리 23개: 목록 14개(불 뿜기 · 운석 · 물대포 · 방울 · 덩굴 · 바위 · 회오리 · 얼음 · 독 · 번개 · 치명타 · 히트스톱 · 초대 · 준비) + 맞힘 등급 5종 + 광선 · 지진 · 필살 2단(올라감 · 폭발)');
  assert(all.every(k => SOUND_KEYS.includes(k) && SOUND_GAIN[k] > 0 && SOUND_GAIN[k] <= 1 && synth.includes(`def('${k}'`) || (k.startsWith('ar-hit-') && synth.includes('def(`ar-hit-${i + 1}`'))), 'V13.237 소리마다 기본 음량이 있고 docs/sound/arena-synth.mjs로 다시 만들 수 있다(녹음 없음)');
  const size = k => statSync(here(`../public/assets/sfx/${k}.mp3`)).size;
  const total = all.reduce((a, k) => a + size(k), 0);
  assert(all.every(k => size(k) > 2000 && size(k) <= 100 * 1024) && total <= 560 * 1024, `V13.237 펫 아레나 소리는 하나에 100KB, 합쳐 560KB 이하다(지금 ${Math.round(total / 1024)}KB)`);
  // 층 3개 · 필살 3단
  assert(/HIT_GRADE\.forEach/.test(synth) && synth.includes('// 타격') && synth.includes('// 속성(밝은 기운)') && synth.includes('// 짧은 저음') && (synth.match(/\{ d: [.\d]+, f: \d+/g) || []).length === 5, 'V13.237 맞힘 소리는 등급 5종 모두 타격 · 속성 · 짧은 저음 3층이다');
  assert(synth.includes("def('ar-ult-rise'") && /const d = 1\.1,[\s\S]{0,700}return cut\(reverb\(o, \{[^}]*\}\), d, \.012\)/.test(synth), 'V13.237 필살 1단(올라감)은 1.1초에서 끊긴다: 경기장 멈춤 1.2초 중 마지막 0.1초가 정적 → 폭발');
  assert(METEOR_HIT === .55 && synth.includes("def('ar-meteor', () => { const o = buf(2.6), z = .55;"), 'V13.237 운석 소리의 쾅은 0.55초 지점이고, 부르는 쪽이 그 때를 떨어지는 때에 맞춘다');
  // 등급 고르기
  const g = (e, near) => hitGrade(e, near);
  assert(g({ kind: 'ult' }) === 5 && g({ kind: 'atk' }) === 2 && g({ kind: 'atk', crit: true }) === 3 && g({ kind: 'skill', m: 1 }) === 3 && g({ kind: 'skill2', m: 1.5 }) === 4 && g({ kind: 'skill', crit: true }) === 4 && g({ kind: 'skill', tick: true }) === 1 && g({ kind: 'skill' }, false) === 1,
    'V13.237 맞힘 등급: 필살 5 · 강타(효과 굉장 · 치명 스킬) 4 · 스킬 3 · 평타 2 · 여러 번 맞는 한 번 · 남끼리 1');

  // 같은 소리 0.05초에 한 번(표 쪽에서 파일마다 막는다)
  const table = source('../public/modules/arena-sfx.js');
  assert(SAME_SOUND_GAP_MS === 50 && table.includes('if (now - (lastAt.get(key) ?? -1e9) < SAME_SOUND_GAP_MS) continue;') && table.includes('if (!list || !soundOn()) return 0;'), 'V13.237 같은 소리 파일은 0.05초에 한 번까지만 내고, 소리를 끄면 아무것도 안 한다');
  assert(Object.values(ARENA_SFX).every(list => list.every(([k]) => all.includes(k))), 'V13.237 사건 → 소리 표의 소리는 모두 새 파일이다');

  // 전투에 이어짐: 사건 이름으로 부른다(캔버스 쪽도 같은 이름으로 부를 수 있게)
  const arena = source('../public/modules/arena.js'), live = source('../public/modules/arena-live.js');
  assert(arena.includes("import { arenaSound, arenaHitSound, ARENA_SFX_KEYS, METEOR_HIT } from './arena-sfx.js';") && arena.includes("arenaSound('ult-rise'); buzz(60);") && (arena.match(/arenaSound\('ult-blast'\)/g) || []).length === 2 && arena.includes("beam(from, end, e.el, true); arenaSound('beam');"),
    'V13.237 필살기: 컷인 때 올라감, 터질 때 폭발(두 번째 필살기도), 일직선은 광선 웅');
  assert(arena.includes('arenaHitSound(e);') && arena.includes('arenaHitSound(e, false)') && !arena.includes("sfx(e.kind === 'ult' ? 'crit' : 'hit'") && !arena.includes("if (e.crit) sfx('crit'"), 'V13.237 맞는 순간: 등급 소리(+ 치명타 · 히트스톱 퍽), 남끼리는 1등급 하나');
  for (const [ev, why] of [['breath', '불 뿜기'], ['meteor', '운석'], ['quake', '지진'], ['tornado', '회오리'], ['boulder', '바위'], ['jet', '물대포'], ['vine', '덩굴'], ['thunder', '번개'], ['bubblepop', '방울 깨짐']]) assert(arena.includes(`arenaSound('${ev}'`), `V13.237 ${why}에 새 소리가 난다`);
  assert(arena.includes("arenaSound(id === 'icefield' ? 'ice' : 'poison')") && arena.includes("if (id === 'spear') arenaSound('ice'"), 'V13.237 얼음 장판 · 얼음 창은 얼음 쨍, 독구름은 보글');
  assert(arena.includes("arenaSound('meteor', { at: Math.max(0, e.warn * ARENA.TICK_MS / 1000 - METEOR_HIT) })"), 'V13.237 운석 쾅은 떨어지는 때(경고 시간)에 맞춘다');
  assert(live.includes("arenaSound('invite')") && live.includes('d.invite.id !== L.heardInvite') && live.includes("if (all && !L.allReady) arenaSound('ready');"), 'V13.237 친구 대전: 새 초대가 보이면 한 번, 모두 준비가 된 순간 한 번');

  // 미리 받기는 그대로(펫 아레나에 들어갈 때), 첫 로딩 영향 없음
  const sound = source('../public/modules/sound.js'), sw = source('../public/sw.js'), app = source('../public/app.js');
  assert(arena.includes("'smash', 'swoosh', 'tap', ...ARENA_SFX_KEYS]);") && /const CORE = \[[^\]]*\]/.test(sound) && !/const CORE = \[[^\]]*ar-/.test(sound), 'V13.237 새 소리는 펫 아레나에 들어갈 때 받는다(첫 터치 CORE에는 없다)');
  assert(!/ar-[a-z-]+\.mp3/.test(sw) && !/ar-(hit|ult|crit|meteor)/.test(app), 'V13.237 서비스 워커 · 첫 화면 코드는 새 소리를 미리 받지 않는다(첫 로딩 그대로)');
}
