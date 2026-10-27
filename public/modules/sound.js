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
  hit: .8, slash: .75, smash: .9, hurt: .75, skill: .8, boss: .9, door: .8, step: .6,
  // V13.130 던전 전투(docs/sound/battle-synth.mjs로 합성): 펫 속성별 발사 · 맞힘, 피해 숫자 틱, 치명타,
  // 보스 기 모으기 · 경고 · 내려찍기 · 포효 · 쓰러짐, 방패, 합동 필살, 영어 쓰기 글자 칸, 기절 · 부활, 10콤보.
  'atk-star': .6, 'atk-leaf': .65, 'atk-wind': .6, 'hit-star': .75, 'hit-leaf': .75, 'hit-wind': .75, 'dmg-tick': .4, crit: .85,
  'boss-charge': .75, 'warn-beep': .45, 'boss-slam': .9, 'shield-block': .8, 'ult-riser': .8, 'ult-impact': .95, 'boss-roar': .9,
  'type-key': .5, 'type-ok': .55, 'type-wrong': .4, 'spell-done': .7, faint: .6, revive: .7, 'combo-10': .7, 'boss-down': .9,
  // V13.149 짝 맞추기 고퀄(docs/sound/match-synth.mjs): 카드 뒤집기 · 날아가기 · 도장.
  'card-flip': .5, swoosh: .55, stamp: .85,
  // V13.164 낚시 전용(docs/sound/reel-synth.mjs): 던지기 휙 · 퐁당 · 입질 톡톡 · 쑥 · 챔질 · 릴 딸깍 · 줄 텐션(이어지는 소리) · 끼익 ·
  // 줄 끊김 · 돌진 · 점프 첨벙 · 끌어올림 물보라 · 퍼펙트 물빛.
  'reel-cast': .7, 'reel-plop': .65, 'reel-nibble': .55, 'reel-bite': .8, 'reel-hook': .9, 'reel-click': .4, 'reel-strain': .5,
  'reel-creak': .6, 'reel-snap': .9, 'reel-run': .6, 'reel-jump': .8, 'reel-splash': .75, 'reel-sparkle': .6,
  // V13.180 10초 맞추기(docs/sound/timing-synth.mjs): 카운트다운 · 시작 · 숨김 · 째깍 · 버튼 · 공개 · 등급 4개 · 기록 갱신.
  'tm-count': .55, 'tm-go': .7, 'tm-hide': .45, 'tm-tick': .3, 'tm-press': .85, 'tm-reveal': .7,
  'tm-perfect': .85, 'tm-great': .75, 'tm-good': .7, 'tm-miss': .6, 'tm-record': .85
};
// 이어지는 소리: key -> 한 주기(초). 파일은 같은 주기가 세 번 이어져 있고, 가운데 주기만 되풀이한다(reel-synth.mjs의 LOOP).
export const SOUND_LOOP = { 'reel-strain': .8 };
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

// V13.164 이어지는 소리(낚시 줄 텐션): loopSound(key)는 손잡이를 돌려준다. 매 프레임 set(크기 0~1, 높낮이)을 부르면
// 부드럽게 따라가고, stop()으로 끈다. 소리가 꺼져 있으면 크기 0으로 둔다(켜는 순간부터 다시 난다). 받지 못했으면 받을 때까지 조용하다.
export function loopSound(key) {
  const period = SOUND_LOOP[key];
  let src = null, g = null, dead = false;
  const start = () => {
    const c = context(), b = buffers.get(key);
    if (!c || !b || c.state !== 'running') { load(key); return; }
    try {
      src = c.createBufferSource(); g = c.createGain();
      src.buffer = b; src.loop = true; src.loopStart = period; src.loopEnd = period * 2;
      g.gain.value = 0; src.connect(g); g.connect(master); src.start(0, period);
    } catch { src = null; }
  };
  return {
    set(level, rate = 1) {
      if (dead || !period) return;
      const want = soundOn() ? Math.max(0, Math.min(1, level)) : 0;
      if (!src) { if (want < .01) return; start(); if (!src) return; }
      const t = ctx.currentTime;
      g.gain.setTargetAtTime(want * (SOUND_GAIN[key] || .5), t, .06);
      src.playbackRate.setTargetAtTime(Math.max(.25, rate), t, .08);
    },
    stop() {
      dead = true;
      if (!src) return;
      try { g.gain.setTargetAtTime(0, ctx.currentTime, .04); src.stop(ctx.currentTime + .3); } catch {}
      const s = src, gg = g; src = null; s.onended = () => { try { s.disconnect(); gg.disconnect(); } catch {} };
    }
  };
}
