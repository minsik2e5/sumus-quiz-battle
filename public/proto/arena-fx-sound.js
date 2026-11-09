// 펫 아레나 연출 시험 페이지 소리(2판): 파일 없이 WebAudio로 그 자리에서 합성한다.
//   - 첫 터치(pointerdown · keydown) 뒤에만 켜진다(브라우저 자동 재생 규칙). 음소거는 setMuted.
//   - 소리 하나 = 노드 몇 개(잡음 + 필터 + 사인/톱니 + 음량 곡선). 동시에 8개까지만(넘으면 버림) → 큰 장면에서도 오디오 스레드가 가볍다.
//   - 같은 소리가 너무 촘촘하면(타격 90ms 안) 한 번만 낸다. 큰 소리(폭발 · 번개 · 필살)가 울리는 0.15초 동안 타격음은 쉰다.
let AC = null, out = null, noise = null, muted = false, live = 0;
const MAX_VOICES = 8, last = {};
export const soundState = () => ({ on: !!AC && AC.state === 'running', muted, live });
export function setMuted(m) { muted = m; if (out) out.gain.setTargetAtTime(m ? 0 : .55, AC.currentTime, .02); }
export function unlockSound() {
  if (AC) { if (AC.state !== 'running') AC.resume(); return; }
  const C = window.AudioContext || window.webkitAudioContext; if (!C) return;
  AC = new C();
  const comp = AC.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4; comp.connect(AC.destination);
  out = AC.createGain(); out.gain.value = muted ? 0 : .55; out.connect(comp);
  // 1초짜리 흰 잡음 한 번만 만들어 모든 소리가 같이 쓴다
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

const VOICES = {
  // 타격: 짧은 딱 + 낮은 쿵
  hit(v = 1) { const t = voice(.18); if (t == null) return; const g = AC.createGain(), g2 = AC.createGain(); env(g, t, .002, .5 * v, .09); env(g2, t, .003, .7 * v, .16); chain(noiseSrc(t, .1, 1.3), filt('bandpass', 1800, .9), g); chain(osc('sine', t, 160, 55, .16), g2); },
  // 폭발: 낮게 깔리는 잡음 + 아래로 떨어지는 사인
  boom(v = 1) { const t = voice(.9); if (t == null) return; const g = AC.createGain(), g2 = AC.createGain(), lp = filt('lowpass', 900, .7); lp.frequency.setValueAtTime(1600, t); lp.frequency.exponentialRampToValueAtTime(140, t + .8); env(g, t, .004, .9 * v, .85); env(g2, t, .004, .9 * v, .6); chain(noiseSrc(t, .9, .7), lp, g); chain(osc('sine', t, 90, 28, .6), g2); },
  // 번개: 찌직(높은 잡음 아주 짧게) → 우르르(낮은 잡음 길게)
  thunder(v = 1) { const t = voice(1.2); if (t == null) return; const g = AC.createGain(), g2 = AC.createGain(); env(g, t, .001, .8 * v, .07); env(g2, t + .03, .05, .7 * v, 1.1); chain(noiseSrc(t, .1, 2), filt('highpass', 2500, .7), g); chain(noiseSrc(t + .03, 1.15, .45), filt('lowpass', 420, .8), g2); },
  // 물: 쏴아(대역 잡음이 위로 쓸림) + 퐁퐁 방울
  water(v = 1) { const t = voice(.7); if (t == null) return; const g = AC.createGain(), bp = filt('bandpass', 700, 1.4); bp.frequency.setValueAtTime(600, t); bp.frequency.exponentialRampToValueAtTime(2600, t + .45); env(g, t, .02, .55 * v, .6); chain(noiseSrc(t, .65, 1), bp, g); for (let i = 0; i < 3; i++) { const gb = AC.createGain(), tb = t + .08 + i * .09; env(gb, tb, .005, .25 * v, .09); chain(osc('sine', tb, 500 + i * 180, 1300 + i * 200, .09), gb); } },
  // 불: 화르륵(낮은 대역 잡음 + 떨림)
  fire(v = 1) { const t = voice(.9); if (t == null) return; const g = AC.createGain(), lfo = AC.createOscillator(), lg = AC.createGain(); lfo.frequency.value = 18; lg.gain.value = .25 * v; lfo.connect(lg); lg.connect(g.gain); lfo.start(t); lfo.stop(t + .9); env(g, t, .05, .5 * v, .85); chain(noiseSrc(t, .9, .8), filt('bandpass', 520, .6), g); },
  // 얼음: 쨍(높은 사인 세 번) + 서걱
  ice(v = 1) { const t = voice(.6); if (t == null) return; [2400, 3200, 4100].forEach((f, i) => { const g = AC.createGain(), ti = t + i * .05; env(g, ti, .002, .22 * v, .35); chain(osc('triangle', ti, f, f * .98, .35), g); }); const g = AC.createGain(); env(g, t, .002, .3 * v, .12); chain(noiseSrc(t, .12, 2.2), filt('highpass', 4000, .7), g); },
  // 바람: 휙(잡음이 위로 쓸렸다 내려옴)
  wind(v = 1) { const t = voice(.6); if (t == null) return; const g = AC.createGain(), bp = filt('bandpass', 400, 2); bp.frequency.setValueAtTime(300, t); bp.frequency.exponentialRampToValueAtTime(2200, t + .22); bp.frequency.exponentialRampToValueAtTime(500, t + .5); env(g, t, .04, .5 * v, .5); chain(noiseSrc(t, .55, 1), bp, g); },
  // 기 모으기: 위로 올라가는 소리
  charge(v = 1) { const t = voice(.75); if (t == null) return; const g = AC.createGain(); env(g, t, .3, .22 * v, .7, .05); chain(osc('sawtooth', t, 140, 900, .7), filt('lowpass', 1800, 1), g); },
  // 필살기: 올라감 → 정적 0.1초 → 큰 폭발은 boom을 따로 부른다
  ult(v = 1) { const t = voice(.8); if (t == null) return; const g = AC.createGain(), g2 = AC.createGain(); env(g, t, .25, .3 * v, .65, .01); env(g2, t, .25, .25 * v, .65, .01); chain(osc('sawtooth', t, 110, 1400, .65), filt('lowpass', 2400, 1.2), g); chain(osc('square', t, 220, 2800, .65), filt('bandpass', 1800, 2), g2); },
  // 쓰러짐: 아래로 미끄러지는 소리
  faint(v = 1) { const t = voice(.7); if (t == null) return; const g = AC.createGain(); env(g, t, .01, .3 * v, .6); chain(osc('triangle', t, 520, 90, .6), g); }
};
export function sfx(name, v = 1) {
  const now = performance.now(); if (now - (last[name] || 0) < (name === 'hit' ? 90 : 30)) return;
  if (name === 'hit' && now - Math.max(last.boom || 0, last.thunder || 0, last.ult || 0) < 150) return;
  last[name] = now;
  try { VOICES[name]?.(v); } catch {}
}
