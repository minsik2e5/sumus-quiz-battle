// V13.116 효과음: public/assets/sfx/<key>.mp3 소리 파일을 Web Audio로 재생한다.
// 소리 파일은 우리가 합성해 만든 소리와 Kenney(CC0) 소리다(docs/sound-library.md).
// playSound()는 파일이 아직 받아지지 않았거나 재생할 수 없으면 false를 돌려준다. 그러면 부른 쪽이
// 예전 신호음(오실레이터)을 낸다. 그래서 첫 재생이 늦거나 소리가 비는 일이 없다.
// 소리 켜기/끄기는 야차전과 같은 설정(sumus-yacha-sound)을 따른다. 학습 화면처럼 자기 설정이 있는
// 곳은 { always: true }로 부른다.

// key -> 기본 음량(소리끼리 크기를 맞춘 값). 파일 이름은 key와 같다.
export const SOUND_GAIN = {
  correct: .8, wrong: .7, combo: .75, tick: .45, tap: .45, coin: .75, coins: .7,
  wiggle: .85, crack: .9, burst: .9, pop: .85,
  'fanfare-basic': .8, 'fanfare-epic': .85, 'fanfare-legend': .9, 'fanfare-mythic': .95, clear: .85, levelup: .75, fail: .65,
  hit: .8, slash: .75, smash: .9, hurt: .75, skill: .8, boss: .9, door: .8, step: .6
};
export const SOUND_KEYS = Object.keys(SOUND_GAIN);
// 첫 터치 때 미리 받아 두는 작은 소리(자주 쓰이는 것). 큰 팡파르는 연출이 시작될 때 preloadSound로 받는다.
const CORE = ['tap', 'correct', 'wrong', 'combo', 'coin', 'tick', 'wiggle', 'crack', 'pop', 'hit', 'hurt', 'skill'];
const MAX_VOICES = 14;
const PREF = 'sumus-yacha-sound';

export const soundOn = () => { try { return (localStorage.getItem(PREF) ?? 'on') === 'on'; } catch { return true; } };

let ctx = null, master = null, voices = 0;
const buffers = new Map(), loading = new Map();

function context() {
  if (!ctx) {
    try {
      const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
      ctx = new AC(); master = ctx.createGain(); master.gain.value = .9; master.connect(ctx.destination);
    } catch { ctx = null; return null; }
  }
  // iOS는 앱이 뒤로 갔다 오거나 전화가 오면 소리를 멈춘다: 다음 터치 때 깨운다.
  if (ctx.state !== 'running') ctx.resume?.().catch(() => {});
  return ctx;
}
// 옛 사파리는 decodeAudioData가 Promise를 돌려주지 않는다.
const decode = data => new Promise((ok, no) => { try { const p = ctx.decodeAudioData(data, ok, no); if (p?.then) p.then(ok, no); } catch (err) { no(err); } });

function load(key) {
  if (!SOUND_GAIN[key] || buffers.has(key)) return Promise.resolve(buffers.get(key) || null);
  if (loading.has(key)) return loading.get(key);
  if (!context()) return Promise.resolve(null);
  const p = fetch(`/assets/sfx/${key}.mp3`).then(r => r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status))))
    .then(decode).then(b => { buffers.set(key, b); return b; })
    .catch(() => null).finally(() => loading.delete(key));
  loading.set(key, p);
  return p;
}

// 터치(사용자 동작) 안에서 부른다: 소리를 깨우고 자주 쓰는 소리를 미리 받는다.
export function unlockSound() {
  if (!soundOn()) return;
  if (context()) CORE.forEach(load);
}
// 어느 화면이든 터치할 때마다 소리를 깨운다(이미 깨어 있고 받아 둔 소리면 거의 일이 없다).
if (typeof document !== 'undefined') for (const type of ['pointerdown', 'touchend', 'keydown']) document.addEventListener(type, unlockSound, { capture: true, passive: true });
export function preloadSound(keys) { if (soundOn() && context()) [].concat(keys).forEach(load); }

// opts: rate(높낮이·빠르기 배율), gain(기본 음량에 곱함), at(몇 초 뒤), dur(몇 초만 재생하고 부드럽게 끔),
// vary(높낮이를 ±비율만큼 무작위로 흔들어 같은 소리가 반복돼도 덜 지루하게), always(소리 설정 무시).
export function playSound(key, { rate = 1, gain = 1, at = 0, dur = 0, vary = 0, always = false } = {}) {
  if (!always && !soundOn()) return false;
  const c = context(), b = buffers.get(key);
  if (!c || !b || c.state !== 'running') { load(key); return false; }
  if (voices >= MAX_VOICES) return true;
  try {
    const src = c.createBufferSource(), g = c.createGain(), t = c.currentTime + Math.max(0, at);
    src.buffer = b; src.playbackRate.value = Math.max(.25, rate * (1 + (vary ? (Math.random() * 2 - 1) * vary : 0)));
    g.gain.value = (SOUND_GAIN[key] || .8) * gain;
    if (dur) { g.gain.setValueAtTime(g.gain.value, t + Math.max(0, dur - .25)); g.gain.linearRampToValueAtTime(.0001, t + dur); }
    src.connect(g); g.connect(master);
    voices++; src.onended = () => { voices = Math.max(0, voices - 1); try { src.disconnect(); g.disconnect(); } catch {} };
    if (dur) src.start(t, 0, dur); else src.start(t);
    return true;
  } catch { return false; }
}
