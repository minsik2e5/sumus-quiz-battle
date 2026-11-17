// 펫 대행진(크라우드 러너) 시험 페이지 소리: 아레나 시험 페이지 소리(arena-fx-sound.js)와 같은 방식으로 파일 없이 WebAudio로 합성한다.
//   - 첫 터치(pointerdown · keydown) 뒤에만 켜진다(브라우저 자동 재생 규칙). 음소거는 setMuted.
//   - 소리 하나 = 노드 몇 개(잡음 + 필터 + 사인/톱니 + 음량 곡선). 동시에 10개까지만(넘으면 버림) → 정령 수백 마리가 터져도 오디오 스레드가 가볍다.
//   - 같은 소리가 너무 촘촘하면 한 번만 낸다(사격 · 맞음 70~90ms). 큰 소리(폭발 · 붕괴 · 필살)가 울리는 0.15초 동안 사격음은 쉰다.
//   - 아레나 소리(타격 · 폭발 · 기 모으기 · 필살 · 얼음)는 같은 합성식을 그대로 쓰고, 러너 소리(문 통과 · 정령 퐁 · 톱날 · 대포 · 별)만 새로 만든다.
let AC = null, out = null, noise = null, muted = false, live = 0;
const MAX_VOICES = 10, last = {};
export const soundState = () => ({ on: !!AC && AC.state === 'running', muted, live });
export function setMuted(m) { muted = m; if (out) out.gain.setTargetAtTime(m ? 0 : .55, AC.currentTime, .02); }
export function unlockSound() {
  if (AC) { if (AC.state !== 'running') AC.resume(); return; }
  const C = window.AudioContext || window.webkitAudioContext; if (!C) return;
  AC = new C();
  const comp = AC.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4; comp.connect(AC.destination);
  out = AC.createGain(); out.gain.value = muted ? 0 : .55; out.connect(comp);
  noise = AC.createBuffer(1, AC.sampleRate, AC.sampleRate);
  const d = noise.getChannelData(0); let s = 7;
  for (let i = 0; i < d.length; i++) { s = (s * 16807) % 2147483647; d[i] = s / 1073741823.5 - 1; }
}
function voice(dur) { if (!AC || muted || AC.state !== 'running' || live >= MAX_VOICES) return null; live++; setTimeout(() => live--, dur * 1000 + 50); return AC.currentTime; }
function env(g, t, a, peak, dur, end = .0001) { g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(end, t + dur); }
function noiseSrc(t, dur, rate = 1) { const n = AC.createBufferSource(); n.buffer = noise; n.loop = true; n.playbackRate.value = rate; n.start(t, Math.random() * .5); n.stop(t + dur + .05); return n; }
function filt(type, f, q = 1) { const b = AC.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; return b; }
function osc(type, t, f0, f1, dur) { const o = AC.createOscillator(); o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur); o.start(t); o.stop(t + dur + .05); return o; }
function chain(...n) { for (let i = 0; i < n.length - 1; i++) n[i].connect(n[i + 1]); n[n.length - 1].connect(out); return n[0]; }
function tone(t, f, dur, v, type = 'triangle') { const g = AC.createGain(); env(g, t, .004, v, dur); chain(osc(type, t, f, f, dur), g); }

const VOICES = {
  // (아레나와 같은 식) 타격: 짧은 딱 + 낮은 쿵
  hit(v = 1) { const t = voice(.18); if (t == null) return; const g = AC.createGain(), g2 = AC.createGain(); env(g, t, .002, .4 * v, .08); env(g2, t, .003, .5 * v, .14); chain(noiseSrc(t, .1, 1.3), filt('bandpass', 1800, .9), g); chain(osc('sine', t, 160, 55, .14), g2); },
  // (아레나와 같은 식) 폭발
  boom(v = 1) { const t = voice(.9); if (t == null) return; const g = AC.createGain(), g2 = AC.createGain(), lp = filt('lowpass', 900, .7); lp.frequency.setValueAtTime(1600, t); lp.frequency.exponentialRampToValueAtTime(140, t + .8); env(g, t, .004, .9 * v, .85); env(g2, t, .004, .9 * v, .6); chain(noiseSrc(t, .9, .7), lp, g); chain(osc('sine', t, 90, 28, .6), g2); },
  // (아레나와 같은 식) 기 모으기 · 필살 · 얼음
  charge(v = 1) { const t = voice(.75); if (t == null) return; const g = AC.createGain(); env(g, t, .3, .22 * v, .7, .05); chain(osc('sawtooth', t, 140, 900, .7), filt('lowpass', 1800, 1), g); },
  ult(v = 1) { const t = voice(.8); if (t == null) return; const g = AC.createGain(), g2 = AC.createGain(); env(g, t, .25, .3 * v, .65, .01); env(g2, t, .25, .25 * v, .65, .01); chain(osc('sawtooth', t, 110, 1400, .65), filt('lowpass', 2400, 1.2), g); chain(osc('square', t, 220, 2800, .65), filt('bandpass', 1800, 2), g2); },
  ice(v = 1) { const t = voice(.6); if (t == null) return; [2400, 3200, 4100].forEach((f, i) => { const g = AC.createGain(), ti = t + i * .05; env(g, ti, .002, .22 * v, .35); chain(osc('triangle', ti, f, f * .98, .35), g); }); const g = AC.createGain(); env(g, t, .002, .3 * v, .12); chain(noiseSrc(t, .12, 2.2), filt('highpass', 4000, .7), g); },
  fire(v = 1) { const t = voice(.9); if (t == null) return; const g = AC.createGain(), lfo = AC.createOscillator(), lg = AC.createGain(); lfo.frequency.value = 18; lg.gain.value = .25 * v; lfo.connect(lg); lg.connect(g.gain); lfo.start(t); lfo.stop(t + .9); env(g, t, .05, .5 * v, .85); chain(noiseSrc(t, .9, .8), filt('bandpass', 520, .6), g); },
  // 사격: 아주 짧은 퓻(높은 잡음 + 위에서 내려오는 사인)
  shot(v = 1) { const t = voice(.08); if (t == null) return; const g = AC.createGain(); env(g, t, .002, .12 * v, .06); chain(osc('square', t, 1400, 500, .06), filt('lowpass', 2600, 1), g); },
  // 좋은 문: 올라가는 세 음(도 · 미 · 솔) + 반짝
  up(v = 1) { const t = voice(.5); if (t == null) return; [523, 659, 784, 1047].forEach((f, i) => tone(t + i * .055, f, .22, .2 * v)); const g = AC.createGain(); env(g, t, .002, .12 * v, .3); chain(noiseSrc(t, .3, 2.5), filt('highpass', 6000, .7), g); },
  // 나쁜 문: 내려가는 두 음(뿌우)
  down(v = 1) { const t = voice(.5); if (t == null) return; const g = AC.createGain(); env(g, t, .01, .3 * v, .45); chain(osc('sawtooth', t, 320, 110, .45), filt('lowpass', 900, 1), g); },
  // 정령 퐁(늘어날 때 · 쏟을 때)
  pop(v = 1) { const t = voice(.12); if (t == null) return; const g = AC.createGain(); env(g, t, .002, .18 * v, .1); chain(osc('sine', t, 600 + Math.random() * 500, 1500, .08), g); },
  // 톱날: 지잉(톱니 + 떨림)
  saw(v = 1) { const t = voice(.35); if (t == null) return; const g = AC.createGain(); env(g, t, .01, .2 * v, .3); chain(osc('sawtooth', t, 820, 600, .3), filt('bandpass', 1500, 3), g); },
  // 대포: 둥(낮은 사인 + 짧은 잡음)
  cannon(v = 1) { const t = voice(.3); if (t == null) return; const g = AC.createGain(), g2 = AC.createGain(); env(g, t, .002, .5 * v, .25); env(g2, t, .002, .3 * v, .08); chain(osc('sine', t, 140, 45, .25), g); chain(noiseSrc(t, .08, .9), filt('lowpass', 1200, .7), g2); },
  // 별 · 보상: 맑은 종소리
  star(v = 1) { const t = voice(.9); if (t == null) return; [1047, 1319, 1568].forEach((f, i) => tone(t + i * .03, f, .8, .16 * v, 'sine')); }
};
export function sfx(name, v = 1) {
  const now = performance.now(), gap = name === 'shot' ? 70 : name === 'hit' ? 90 : name === 'pop' ? 45 : 30;
  if (now - (last[name] || 0) < gap) return;
  if ((name === 'shot' || name === 'hit') && now - Math.max(last.boom || 0, last.ult || 0) < 150) return;
  last[name] = now;
  try { VOICES[name]?.(v); } catch {}
}
